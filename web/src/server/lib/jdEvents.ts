// JDownloader event subscription listener (long-poll based).
//
// JD's remote API exposes an event system on the same local API port this app
// already uses (verified in RemoteAPIController.java: the EventsAPI and all
// publishers are registered on the deprecated API handler):
//
//   /events/subscribe   [subscriptions[], exclusions[]] -> { subscriptionid, ... }
//   /events/listen      [subscriptionid]                -> [{ publisher, eventid, eventdata }, ...]
//   /events/unsubscribe [subscriptionid]
//   /events/listpublisher                               -> [{ publisher, eventids }, ...]
//
// Semantics (from org.appwork.remoteapi.events.{EventsAPI,Subscriber}):
//  - Subscription patterns are Java regexes matched with find() (substring!)
//    against "<publisher>.<eventid>" — therefore all patterns below are anchored.
//  - listen() blocks up to pollTimeout (default 25 s) for the first event, then
//    drains the queue. An empty array on timeout is NORMAL, not an error.
//  - Every listen() call refreshes the keepalive. A subscription that is not
//    polled for maxKeepalive (default 120 s) expires server-side and listen()
//    then fails — handled here by resubscribing + requesting a full resync.
//
// This module deliberately treats events as *triggers only*: it never parses
// eventdata. The broadcaster re-queries JD on a trigger, so any missed or
// malformed event is self-healing. See events-plan.md.

export type EventTopic = 'downloads' | 'grabber' | 'notifications';

export type JdEvent = {
  publisher: string;
  eventid: string;
  eventdata?: unknown;
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
  // The events API is not usable on this JD build — fall back to fixed polling.
  onUnsupported: () => void;
  // JD looks unreachable (connection-level error).
  onConnectionError: () => void;
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
};

// Anchored (JD matches with find()). Progress fields (LINK_UPDATE.* interval
// events) are intentionally NOT subscribed — while downloads run, the
// broadcaster's progress ticker polls anyway; see events-plan.md Phase E3.
export const EVENT_SUBSCRIPTIONS = [
  '^downloads\\.(REFRESH_STRUCTURE|REFRESH_CONTENT|ADD_|REMOVE_)',
  '^downloadwatchdog\\.',
  '^linkcollector\\.',
  '^captchas\\.',
  '^dialogs\\.',
];

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

  constructor(client: JdEventsClient, handlers: JdEventListenerHandlers, opts: JdEventListenerOptions = {}) {
    this.client = client;
    this.handlers = handlers;
    this.opts = {
      initialBackoffMs: opts.initialBackoffMs ?? 1_000,
      maxBackoffMs: opts.maxBackoffMs ?? 30_000,
      listenTimeoutMs: opts.listenTimeoutMs ?? 35_000,
      maxListenFailures: opts.maxListenFailures ?? 3,
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
          const resp = await this.client.call('/events/subscribe', [EVENT_SUBSCRIPTIONS, []]) as
            { subscriptionid?: number; subscribed?: boolean } | null;
          if (!resp || typeof resp.subscriptionid !== 'number' || resp.subscribed === false) {
            throw Object.assign(new Error('subscribe returned no usable subscription'), { code: 'JD_EVENTS_SUBSCRIBE_FAILED' });
          }
          this.subscriptionId = resp.subscriptionid;
          this.backoffMs = this.opts.initialBackoffMs;
          listenFailures = 0;
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
    for (const ev of events) {
      const topic = PUBLISHER_TOPIC[ev?.publisher ?? ''];
      if (topic) {
        topics.add(topic);
      }
    }
    if (topics.size > 0) {
      this.handlers.onEvents(topics, events);
    }
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
