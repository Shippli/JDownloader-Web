import { isJdConnError } from './jd';

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

type JdEvent = {
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

type JdEventsClient = {
  call: (path: string, params?: unknown[]) => Promise<unknown>;
  callLongPoll: (path: string, params?: unknown[], timeoutMs?: number, signal?: AbortSignal) => Promise<unknown>;
};

type JdEventListenerHandlers = {
  // One or more events arrived; topics is the deduplicated set of affected areas.
  onEvents: (topics: Set<EventTopic>) => void;
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

const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;
// Client-side abort for a single listen() call. Must exceed JD's server-side
// pollTimeout (25 s) so a normal empty poll never aborts.
const LISTEN_TIMEOUT_MS = 35_000;
// Consecutive listen failures before we throw the subscription away and
// resubscribe instead of just retrying listen().
const MAX_LISTEN_FAILURES = 3;
// JD-side push interval for diff events (setStatusEventInterval).
const STATUS_EVENT_INTERVAL_MS = 2_000;

// Allowlisted payload fields per kind (must be fields our queries return).
const LINK_DIFF_FIELDS = new Set([
  'bytesLoaded',
  'bytesTotal',
  'eta',
  'speed',
  'status',
  'statusIconKey',
  'name',
  'enabled',
  'priority',
  'comment',
  'url',
]);
const PACKAGE_DIFF_FIELDS = new Set([
  'bytesLoaded',
  'bytesTotal',
  'eta',
  'speed',
  'status',
  'statusIconKey',
  'name',
  'enabled',
  'priority',
  'comment',
]);
const PACKAGE_FIELD_EVENTS = [...PACKAGE_DIFF_FIELDS].filter(f => f !== 'comment');

// Anchored (JD matches with find()). REFRESH_CONTENT is deliberately not
// subscribed: JD fires it on every link property change.
const SUBSCRIPTIONS = [
  '^downloads\\.(REFRESH_STRUCTURE|ADD_|REMOVE_)',
  // Changes without a usable diff payload → full downloads sync.
  '^downloads\\.LINK_UPDATE\\.(reset|resume|finished|availability)$',
  // Subscribed only so JD pushes status/statusIconKey via LINK_UPDATE.status.
  '^downloads\\.LINK_UPDATE\\.(skipped|extractionStatus)$',
  '^downloadwatchdog\\.',
  '^linkcollector\\.',
  '^captchas\\.',
  '^dialogs\\.',
  // Per-field diffs. Package comment is fired as "PACKAGE_UPDATE.COMMENT" but
  // gated on "PACKAGE_UPDATE" — both must match.
  `^downloads\\.LINK_UPDATE\\.(${[...LINK_DIFF_FIELDS].join('|')})$`,
  `^downloads\\.PACKAGE_UPDATE\\.(${PACKAGE_FIELD_EVENTS.join('|')})$`,
  '^downloads\\.PACKAGE_UPDATE(\\.COMMENT)?$',
];

const NUMBER_DIFF_FIELDS = new Set([
  'bytesLoaded',
  'bytesTotal',
  'eta',
  'speed',
]);
const BOOLEAN_DIFF_FIELDS = new Set(['enabled']);
const STRING_DIFF_FIELDS = new Set(['name', 'priority']);
// Events whose payload is redundant (status follows as LINK_UPDATE.status).
const IGNORED_EVENTS = new Set(['LINK_UPDATE.skipped', 'LINK_UPDATE.extractionStatus']);

function isValidDiffValue(field: string, value: unknown): boolean {
  if (NUMBER_DIFF_FIELDS.has(field)) {
    return typeof value === 'number' && Number.isFinite(value);
  }
  if (BOOLEAN_DIFF_FIELDS.has(field)) {
    return typeof value === 'boolean';
  }
  if (STRING_DIFF_FIELDS.has(field)) {
    return typeof value === 'string';
  }
  // status / statusIconKey / comment / url
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

export class JdEventListener {
  private client: JdEventsClient;
  private handlers: JdEventListenerHandlers;

  private running = false;
  private loopPromise: Promise<void> | null = null;
  private subscriptionId: number | null = null;
  private backoffMs = INITIAL_BACKOFF_MS;
  private listenAbort: AbortController | null = null;
  private wakeSleep: (() => void) | null = null;
  // null = not probed yet, true/false = probe result (cached per process)
  private supported: boolean | null = null;
  // One-shot warning for a dropped diff (bad value type / missing uuid).
  private loggedDiffDrop = false;
  // setStatusEventInterval fails until JD has created the channel collector.
  private intervalApplied = false;
  private lastListenOkAt = 0;

  private listenFailures = 0;

  constructor(client: JdEventsClient, handlers: JdEventListenerHandlers) {
    this.client = client;
    this.handlers = handlers;
  }

  start() {
    if (this.running || this.supported === false) {
      return;
    }
    this.running = true;
    this.backoffMs = INITIAL_BACKOFF_MS;
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
    this.listenFailures = 0;
    while (this.running) {
      try {
        // Capability probe (once per process)
        if (this.supported === null) {
          this.supported = await this.probe();
          if (!this.supported) {
            this.running = false;
            this.handlers.onUnsupported();
            return;
          }
        }
        await this.ensureSubscribed();
        await this.listen();
      } catch (e) {
        if (!this.running) {
          return;
        }
        this.handleLoopError(e);
        await this.sleep(this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
      }
    }
  }

  private async ensureSubscribed() {
    if (this.subscriptionId !== null) {
      return;
    }
    const resp = await this.client.call('/events/subscribe', [SUBSCRIPTIONS, []]) as
      { subscriptionid?: number; subscribed?: boolean } | null;
    if (!resp || typeof resp.subscriptionid !== 'number' || resp.subscribed === false) {
      throw Object.assign(new Error('subscribe returned no usable subscription'), { code: 'JD_EVENTS_SUBSCRIBE_FAILED' });
    }
    this.subscriptionId = resp.subscriptionid;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.listenFailures = 0;
    this.intervalApplied = false;
    await this.applyStatusEventInterval();
    // We may have been deaf — owner must re-baseline all topics.
    this.handlers.onResync();
  }

  // Long-poll. An empty array is a normal poll timeout.
  private async listen() {
    this.listenAbort = new AbortController();
    let events: unknown;
    try {
      events = await this.client.callLongPoll('/events/listen', [this.subscriptionId], LISTEN_TIMEOUT_MS, this.listenAbort.signal);
    } finally {
      this.listenAbort = null;
    }
    this.listenFailures = 0;
    this.backoffMs = INITIAL_BACKOFF_MS;
    this.lastListenOkAt = Date.now();
    if (!this.intervalApplied) {
      await this.applyStatusEventInterval();
    }
    if (Array.isArray(events) && events.length > 0) {
      this.dispatch(events as JdEvent[]);
    }
  }

  private handleLoopError(e: unknown) {
    if (isJdConnError(e)) {
      // JD gone — drop the subscription (it will expire anyway), tell the
      // owner, and retry with backoff.
      this.subscriptionId = null;
      this.listenFailures = 0;
      this.handlers.onConnectionError();
    } else if (this.subscriptionId !== null) {
      // HTTP-level error on listen (typically: subscription expired →
      // APIFileNotFoundException). Retry listen a couple of times for
      // transient errors, then resubscribe.
      this.listenFailures++;
      if (this.listenFailures >= MAX_LISTEN_FAILURES) {
        this.subscriptionId = null;
        this.listenFailures = 0;
      }
    }
  }

  // Throttles JD's per-field push cadence. Best-effort: until it succeeds JD
  // pushes at its 1 s default.
  private async applyStatusEventInterval() {
    const ok = await this.client
      .call('/downloadevents/setStatusEventInterval', [this.subscriptionId, STATUS_EVENT_INTERVAL_MS])
      .catch(() => false);
    this.intervalApplied = ok === true;
  }

  // True while long-polls keep succeeding (proves JD is reachable).
  isHealthy(): boolean {
    return this.running && this.subscriptionId !== null
      && Date.now() - this.lastListenOkAt < LISTEN_TIMEOUT_MS + 5_000;
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
      if (isJdConnError(e)) {
        throw e;
      }
      return false;
    }
  }

  private dispatch(events: JdEvent[]) {
    const topics = new Set<EventTopic>();
    const patches: EntityPatch[] = [];
    for (const ev of events) {
      if (IGNORED_EVENTS.has(ev?.eventid ?? '')) {
        continue;
      }
      // Per-field diff events are applied directly and must NOT also trigger a
      // full downloads poll (that would negate the whole optimization).
      if (this.isDiffEvent(ev)) {
        const patch = this.parseDiffEvent(ev);
        if (patch) {
          patches.push(patch);
          continue;
        }
        // Unusable payload (e.g. raw LINKSTATUS value) → fall back to a sync.
        if (patch === undefined) {
          continue;
        }
      }
      const topic = PUBLISHER_TOPIC[ev?.publisher ?? ''];
      if (topic) {
        topics.add(topic);
      }
    }
    if (topics.size > 0) {
      this.handlers.onEvents(topics);
    }
    if (patches.length > 0) {
      this.handlers.onDiffEvents?.(patches);
    }
  }

  private isDiffEvent(ev: JdEvent): boolean {
    if (ev?.publisher !== 'downloads' || typeof ev.eventid !== 'string') {
      return false;
    }
    const kind = ev.eventid.slice(0, ev.eventid.indexOf('.'));
    const field = ev.eventid.slice(kind.length + 1);
    if (kind === 'LINK_UPDATE') {
      return LINK_DIFF_FIELDS.has(field);
    }
    return kind === 'PACKAGE_UPDATE' && PACKAGE_DIFF_FIELDS.has(field === 'COMMENT'
      ? 'comment'
      : field);
  }

  // Returns a patch with every allowlisted payload field (JD's status event also
  // carries statusIconKey). undefined = drop silently, null = payload unusable.
  private parseDiffEvent(ev: JdEvent): EntityPatch | null | undefined {
    const kind: EntityPatch['kind'] = ev.eventid.startsWith('LINK_UPDATE.')
      ? 'link'
      : 'package';
    const allow = kind === 'link'
      ? LINK_DIFF_FIELDS
      : PACKAGE_DIFF_FIELDS;
    const data = ev.eventdata as Record<string, unknown> | undefined;
    if (!data || typeof data.uuid !== 'number') {
      this.warnDroppedDiff(`diff event ${ev.eventid} missing numeric uuid`);
      return undefined;
    }
    const fields: Record<string, unknown> = {};
    let invalid = false;
    for (const [field, value] of Object.entries(data)) {
      if (field === 'uuid' || !allow.has(field)) {
        continue;
      }
      if (isValidDiffValue(field, value)) {
        fields[field] = value;
      } else {
        invalid = true;
      }
    }
    if (Object.keys(fields).length > 0) {
      return { kind, uuid: data.uuid, fields };
    }
    return invalid ? null : undefined;
  }

  private warnDroppedDiff(reason: string) {
    if (this.loggedDiffDrop) {
      return;
    }
    this.loggedDiffDrop = true;
    console.warn(`[jd-events] dropping malformed diff event (logged once): ${reason}`);
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
