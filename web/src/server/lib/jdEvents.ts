// JDownloader event subscription listener (long-poll based).
//
//   /events/subscribe   [subscriptions[], exclusions[]] -> { subscriptionid, ... }
//   /events/listen      [subscriptionid]                -> [{ publisher, eventid, eventdata }, ...]
//   /events/unsubscribe [subscriptionid]
//   /events/listpublisher                               -> [{ publisher, eventids }, ...]
//
//  - Subscription patterns are Java regexes matched with find() (substring!)
//    against "<publisher>.<eventid>" — therefore all patterns below are anchored.
//  - listen() blocks up to pollTimeout (default 25 s) for the first event, then
//    drains the queue. An empty array on timeout is NORMAL, not an error.
//  - Every listen() call refreshes the keepalive. A subscription that is not
//    polled for maxKeepalive (default 120 s) expires server-side and listen()
//    then fails — handled here by resubscribing + requesting a full resync.

export type EventTopic = 'downloads' | 'grabber' | 'notifications';

export type JdEvent = {
  publisher: string;
  eventid: string;
  eventdata?: unknown;
};

// A single per-field diff applied directly into the broadcaster's cached entity.
export type EntityPatch = {
  kind: 'link' | 'package';
  uuid: number;
  fields: Record<string, unknown>;
};

export type JdEventsClient = {
  call: (path: string, params?: unknown[]) => Promise<unknown>;
  callLongPoll: (path: string, params?: unknown[], timeoutMs?: number, signal?: AbortSignal) => Promise<unknown>;
};

export type JdEventListenerHandlers = {
  // One or more events arrived; topics is the deduplicated set of affected areas.
  onEvents: (topics: Set<EventTopic>, events: JdEvent[]) => void;
  // A (re)subscription happened — state may have changed while we were deaf,
  // so the owner must run a full poll of every topic.
  onResync: () => void;
  // The events API is not usable on this JD build.
  onUnsupported: () => void;
  // JD looks unreachable (connection-level error).
  onConnectionError: () => void;
  // Validated per-field diffs to apply straight into the cache.
  onDiffEvents?: (patches: EntityPatch[]) => void;
};

export type JdEventListenerOptions = {
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  // Client-side abort for a single listen() call. Must exceed JD's server-side
  // pollTimeout (25 s) so a normal empty poll never aborts.
  listenTimeoutMs?: number;
  // Consecutive listen failures before we throw the subscription away and
  // resubscribe instead of just retrying listen().
  maxListenFailures?: number;
  // JD-side push interval for diff events (setStatusEventInterval).
  statusEventIntervalMs?: number;
};

// Anchored (JD matches with find()).
export const EVENT_SUBSCRIPTIONS = [
  '^downloads\\.(REFRESH_STRUCTURE|REFRESH_CONTENT|ADD_|REMOVE_)',
  '^downloadwatchdog\\.',
  '^linkcollector\\.',
  '^captchas\\.',
  '^dialogs\\.',
];

// Per-field diff subscription (anchored). JD serializes these fields via the
// same toStorable() path as queryLinks, so values match our cached entities.
export const DIFF_SUBSCRIPTION
  = '^downloads\\.(LINK_UPDATE|PACKAGE_UPDATE)\\.(bytesLoaded|bytesTotal|eta|speed|status|statusIconKey)';

// Allowlisted fields we apply directly; any other field is ignored.
const LINK_DIFF_FIELDS = new Set(['bytesLoaded', 'bytesTotal', 'eta', 'speed', 'status', 'statusIconKey']);
const PACKAGE_DIFF_FIELDS = new Set(['bytesLoaded', 'bytesTotal', 'eta', 'speed', 'status', 'statusIconKey']);
const NUMBER_DIFF_FIELDS = new Set(['bytesLoaded', 'bytesTotal', 'eta', 'speed']);

function isValidDiffValue(field: string, value: unknown): boolean {
  if (NUMBER_DIFF_FIELDS.has(field)) {
    return typeof value === 'number' && Number.isFinite(value);
  }
  // status / statusIconKey
  return value === null || typeof value === 'string';
}

// Minimum publishers for event-driven mode to be worthwhile/safe.
const REQUIRED_PUBLISHERS = ['downloads', 'linkcollector'];

const PUBLISHER_TOPIC: Record<string, EventTopic> = {
  downloads: 'downloads',
  downloadwatchdog: 'downloads',
  linkcollector: 'grabber',
  linkcrawler: 'grabber',
  captchas: 'notifications',
  dialogs: 'notifications',
};

function isConnError(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? '';
  return (
    code === 'JD_UNAVAILABLE'
    || code === 'JD_NOT_CONFIGURED'
    || code === 'ECONNREFUSED'
    || code === 'ConnectionRefused'
    || code === 'ECONNRESET'
  );
}

export class JdEventListener {
  private client: JdEventsClient;
  private handlers: JdEventListenerHandlers;
  private opts: Required<JdEventListenerOptions>;

  private running = false;
  private loopPromise: Promise<void> | null = null;
  private subscriptionId: number | null = null;
  private backoffMs: number;
  private listenAbort: AbortController | null = null;
  private wakeSleep: (() => void) | null = null;
  // null = not probed yet, true/false = probe result (cached per process)
  private supported: boolean | null = null;
  // One-shot warning for a dropped diff (bad value type / missing uuid).
  private loggedDiffDrop = false;

  constructor(client: JdEventsClient, handlers: JdEventListenerHandlers, opts: JdEventListenerOptions = {}) {
    this.client = client;
    this.handlers = handlers;
    this.opts = {
      initialBackoffMs: opts.initialBackoffMs ?? 1_000,
      maxBackoffMs: opts.maxBackoffMs ?? 30_000,
      listenTimeoutMs: opts.listenTimeoutMs ?? 35_000,
      maxListenFailures: opts.maxListenFailures ?? 3,
      statusEventIntervalMs: opts.statusEventIntervalMs ?? 2_000,
    };
    this.backoffMs = this.opts.initialBackoffMs;
  }

  isRunning(): boolean {
    return this.running;
  }

  start() {
    if (this.running || this.supported === false) {
      return;
    }
    this.running = true;
    this.backoffMs = this.opts.initialBackoffMs;
    this.loopPromise = this.run().catch((e) => {
      console.error('[jd-events] listener loop crashed:', e);
    });
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }
    this.running = false;
    this.listenAbort?.abort();
    this.wakeSleep?.();
    const subId = this.subscriptionId;
    this.subscriptionId = null;
    await this.loopPromise?.catch(() => {});
    this.loopPromise = null;
    if (subId !== null) {
      // Best-effort: the subscription self-expires after maxKeepalive anyway.
      await this.client.call('/events/unsubscribe', [subId]).catch(() => {});
    }
  }

  private async run(): Promise<void> {
    let listenFailures = 0;
    while (this.running) {
      try {
        // 1) Capability probe (once per process)
        if (this.supported === null) {
          const supported = await this.probe();
          this.supported = supported;
          if (!supported) {
            this.running = false;
            this.handlers.onUnsupported();
            return;
          }
        }

        // 2) Subscribe if needed
        if (this.subscriptionId === null) {
          const resp = await this.client.call('/events/subscribe', [this.subscriptions(), []]) as
            { subscriptionid?: number; subscribed?: boolean } | null;
          if (!resp || typeof resp.subscriptionid !== 'number' || resp.subscribed === false) {
            throw Object.assign(new Error('subscribe returned no usable subscription'), { code: 'JD_EVENTS_SUBSCRIBE_FAILED' });
          }
          this.subscriptionId = resp.subscriptionid;
          this.backoffMs = this.opts.initialBackoffMs;
          listenFailures = 0;
          // Throttle JD's per-field push cadence. Best-effort: a failure only
          // means more frequent (1 s default) pushes.
          await this.client
            .call('/downloadevents/setStatusEventInterval', [this.subscriptionId, this.opts.statusEventIntervalMs])
            .catch(() => {});
          // We may have been deaf — owner must re-baseline all topics.
          this.handlers.onResync();
        }

        // 3) Long-poll. An empty array is a normal poll timeout.
        this.listenAbort = new AbortController();
        let events: unknown;
        try {
          events = await this.client.callLongPoll(
            '/events/listen',
            [this.subscriptionId],
            this.opts.listenTimeoutMs,
            this.listenAbort.signal,
          );
        } finally {
          this.listenAbort = null;
        }
        listenFailures = 0;
        this.backoffMs = this.opts.initialBackoffMs;
        if (Array.isArray(events) && events.length > 0) {
          this.dispatch(events as JdEvent[]);
        }
      } catch (e) {
        if (!this.running) {
          return;
        }
        if (isConnError(e)) {
          // JD gone — drop the subscription (it will expire anyway), tell the
          // owner, and retry with backoff.
          this.subscriptionId = null;
          listenFailures = 0;
          this.handlers.onConnectionError();
        } else if (this.subscriptionId !== null) {
          // HTTP-level error on listen (typically: subscription expired →
          // APIFileNotFoundException). Retry listen a couple of times for
          // transient errors, then resubscribe.
          listenFailures++;
          if (listenFailures >= this.opts.maxListenFailures) {
            this.subscriptionId = null;
            listenFailures = 0;
          }
        }
        await this.sleep(this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, this.opts.maxBackoffMs);
      }
    }
  }

  private async probe(): Promise<boolean> {
    // Throws on connection errors (bubbles to the retry path in run()).
    // Returns false only for definitive "this JD has no usable events API".
    try {
      const raw = await this.client.call('/events/listpublisher', []);
      if (!Array.isArray(raw)) {
        return false;
      }
      const names = new Set(
        (raw as Array<{ publisher?: string }>).map(p => p?.publisher).filter((n): n is string => typeof n === 'string'),
      );
      return REQUIRED_PUBLISHERS.every(p => names.has(p));
    } catch (e) {
      if (isConnError(e)) {
        throw e;
      }
      return false;
    }
  }

  private dispatch(events: JdEvent[]) {
    const topics = new Set<EventTopic>();
    const triggerEvents: JdEvent[] = [];
    const patches: EntityPatch[] = [];
    for (const ev of events) {
      // Per-field diff events are applied directly and must NOT also trigger a
      // full downloads poll (that would negate the whole optimization).
      if (this.isDiffEvent(ev)) {
        const patch = this.parseDiffEvent(ev);
        if (patch) {
          patches.push(patch);
        }
        continue;
      }
      triggerEvents.push(ev);
      const topic = PUBLISHER_TOPIC[ev?.publisher ?? ''];
      if (topic) {
        topics.add(topic);
      }
    }
    if (topics.size > 0) {
      this.handlers.onEvents(topics, triggerEvents);
    }
    if (patches.length > 0) {
      this.handlers.onDiffEvents?.(patches);
    }
  }

  private isDiffEvent(ev: JdEvent): boolean {
    return ev?.publisher === 'downloads'
      && (typeof ev.eventid === 'string')
      && (ev.eventid.startsWith('LINK_UPDATE.') || ev.eventid.startsWith('PACKAGE_UPDATE.'));
  }

  // Returns a validated patch, or null when the field is not allowlisted or the
  // payload fails a type guard (dropped; the 60 s reconciliation heals any drift).
  private parseDiffEvent(ev: JdEvent): EntityPatch | null {
    const dot = ev.eventid.indexOf('.');
    const kind: EntityPatch['kind'] = ev.eventid.slice(0, dot) === 'LINK_UPDATE' ? 'link' : 'package';
    const field = ev.eventid.slice(dot + 1);
    const allow = kind === 'link' ? LINK_DIFF_FIELDS : PACKAGE_DIFF_FIELDS;
    if (!allow.has(field)) {
      return null;
    }
    const data = ev.eventdata as Record<string, unknown> | undefined;
    if (!data || typeof data.uuid !== 'number') {
      this.warnDroppedDiff(`diff event ${ev.eventid} missing numeric uuid`);
      return null;
    }
    const value = data[field];
    if (!isValidDiffValue(field, value)) {
      this.warnDroppedDiff(`diff event ${ev.eventid} has invalid value type for field "${field}"`);
      return null;
    }
    return { kind, uuid: data.uuid, fields: { [field]: value } };
  }

  private warnDroppedDiff(reason: string) {
    if (this.loggedDiffDrop) {
      return;
    }
    this.loggedDiffDrop = true;
    console.warn(`[jd-events] dropping malformed diff event (logged once): ${reason}`);
  }

  private subscriptions(): string[] {
    return [...EVENT_SUBSCRIPTIONS, DIFF_SUBSCRIPTION];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const t = setTimeout(() => {
        this.wakeSleep = null;
        resolve();
      }, ms);
      this.wakeSleep = () => {
        clearTimeout(t);
        this.wakeSleep = null;
        resolve();
      };
    });
  }
}
