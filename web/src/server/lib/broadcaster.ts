import type { SseServerMessage } from '../../shared/sse';
import type { EntityCache } from './entityDiff';
import type { EntityPatch, EventTopic } from './jdEvents';
import type { SseWriter } from './sseHub';
import { fetchDialogs } from './dialogs';
import { applyPatchesToCache, diffSnapshot, toEntityCache } from './entityDiff';
import { isExtracting, updateExtractionProgress } from './extractionProgress';
import {
  DEFAULT_GRABBER_LINK_QUERY,
  DEFAULT_GRABBER_PACKAGE_QUERY,
  DEFAULT_LINK_QUERY,
  DEFAULT_PACKAGE_QUERY,
  EXTRACTION_STATUS_QUERY,
  isJdConnError,
  jd as jdClient,
} from './jd';
import { JdEventListener } from './jdEvents';
import { addClient, broadcast, clientCount, removeClient, startHeartbeat } from './sseHub';

// Keep the JD subscription and cache alive this long after the last client
// leaves, so a quick reconnect (resync, tab switch) skips the full re-baseline.
const LISTENER_GRACE_MS = 30_000;
let listenerGraceTimer: ReturnType<typeof setTimeout> | null = null;

// True while clients are connected or the grace period is running.
function isActive(): boolean {
  return clientCount() > 0 || listenerGraceTimer !== null;
}

// ─── State cache (for diffing + initial full sync to new clients) ─────────────

type DownloadsMeta = {
  state: string;
  speed: number;
  exProgress: Record<number, number>;
  exProgressStr: string;
};

type DownloadsCache = EntityCache & DownloadsMeta;

type DownloadsDelta = Extract<SseServerMessage, { type: 'downloads'; full: false }>;

let cachedDownloads: DownloadsCache | null = null;
let cachedGrabber: EntityCache | null = null;
let lastHealthJd: boolean | null = null;
let lastNotifications: { str: string; msg: SseServerMessage } | null = null;

// One global monotonic sequence number across downloads + grabber. Every such
// message (full or delta) and every heartbeat carries it, so clients detect a
// dropped message (gap) and force a resync. Full snapshots re-baseline the client.
let seq = 0;

const asArray = (x: unknown): unknown[] => Array.isArray(x) ? x : [];

// Total speed = Σ link speeds (same source for syncs and diff patches).
function sumSpeed(links: Iterable<unknown>): number {
  let speed = 0;
  for (const l of links) {
    const s = (l as { speed?: number }).speed;
    if (typeof s === 'number' && s > 0) {
      speed += s;
    }
  }
  return speed;
}

function downloadsMeta(state: string, speed: number, links: unknown[]): DownloadsMeta {
  const exProgress = updateExtractionProgress(links);
  return { state, speed, exProgress, exProgressStr: JSON.stringify(exProgress) };
}

function metaDelta(prev: DownloadsMeta, next: DownloadsMeta): Partial<DownloadsDelta> {
  const d: Partial<DownloadsDelta> = {};
  if (next.state !== prev.state) {
    d.state = next.state;
  }
  if (next.speed !== prev.speed) {
    d.speed = next.speed;
  }
  if (next.exProgressStr !== prev.exProgressStr) {
    d.exProgress = next.exProgress;
  }
  return d;
}

function fullDownloadsMsg(c: DownloadsCache): SseServerMessage {
  return { type: 'downloads', full: true, seq, packages: c.packages, links: c.links, state: c.state, speed: c.speed, exProgress: c.exProgress };
}

function fullGrabberMsg(c: EntityCache): SseServerMessage {
  return { type: 'grabber', full: true, seq, packages: c.packages, links: c.links };
}

// Collapses concurrent calls: while a run is in flight, further calls mark it
// dirty and exactly one follow-up run starts afterwards. Prevents overlapping
// snapshots from landing out of order. Skips while inactive; JD connection
// errors are reported as health=false.
function singleFlight(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let dirty = false;
  const loop = async () => {
    do {
      dirty = false;
      if (!isActive()) {
        return;
      }
      try {
        await fn();
      } catch (e) {
        if (isJdConnError(e)) {
          reportJdDown();
        }
      }
    } while (dirty && isActive());
  };
  return () => {
    if (running) {
      dirty = true;
      return running;
    }
    running = loop().finally(() => {
      running = null;
    });
    return running;
  };
}

// ─── Sync functions ───────────────────────────────────────────────────────────

const syncDownloads = singleFlight(async () => {
  const [packages, links, state] = await Promise.all([
    jdClient.call('/downloadsV2/queryPackages', [DEFAULT_PACKAGE_QUERY]),
    jdClient.call('/downloadsV2/queryLinks', [DEFAULT_LINK_QUERY]),
    jdClient.call('/downloadcontroller/getCurrentState'),
  ]);
  const pkgArr = asArray(packages);
  const linkArr = asArray(links);
  const meta = downloadsMeta((state as string) ?? 'IDLE', sumSpeed(linkArr), linkArr);

  if (!cachedDownloads) {
    seq++;
    cachedDownloads = { ...toEntityCache(pkgArr, linkArr), ...meta };
    broadcast(fullDownloadsMsg(cachedDownloads));
  } else {
    const { cache, delta } = diffSnapshot(cachedDownloads, pkgArr, linkArr);
    const changedMeta = metaDelta(cachedDownloads, meta);
    if (delta || Object.keys(changedMeta).length > 0) {
      cachedDownloads = { ...cache, ...meta };
      broadcast({ ...delta, ...changedMeta, type: 'downloads', full: false, seq: ++seq });
    }
  }
  updateExtractionTicker();
});

const syncGrabber = singleFlight(async () => {
  const [packages, links] = await Promise.all([
    jdClient.call('/linkgrabberv2/queryPackages', [DEFAULT_GRABBER_PACKAGE_QUERY]),
    jdClient.call('/linkgrabberv2/queryLinks', [DEFAULT_GRABBER_LINK_QUERY]),
  ]);
  const pkgArr = asArray(packages);
  const linkArr = asArray(links);

  if (!cachedGrabber) {
    seq++;
    cachedGrabber = toEntityCache(pkgArr, linkArr);
    broadcast(fullGrabberMsg(cachedGrabber));
    return;
  }

  const { cache, delta } = diffSnapshot(cachedGrabber, pkgArr, linkArr);
  if (delta) {
    cachedGrabber = cache;
    broadcast({ ...delta, type: 'grabber', full: false, seq: ++seq });
  }
});

const syncNotifications = singleFlight(async () => {
  const [captchasRaw, updateRaw, dialogs] = await Promise.all([
    jdClient.call('/captcha/list', []),
    jdClient.call('/update/isUpdateAvailable'),
    fetchDialogs(),
  ]);
  const captchas = asArray(captchasRaw);
  const updateAvailable = updateRaw === true;

  const str = JSON.stringify({ dialogs, captchas, updateAvailable });
  if (str !== lastNotifications?.str) {
    lastNotifications = { str, msg: { type: 'notifications', dialogs, captchas, updateAvailable } };
    broadcast(lastNotifications.msg);
  }
});

// ─── Auto update ──────────────────────────────────────────────────────────────

const IDLE_STATES = new Set(['IDLE', 'STOPPED_STATE']);

// Runs regardless of connected clients.
async function autoUpdateTick() {
  if (!jdClient.isAutoUpdateEnabled()) {
    return;
  }
  try {
    const [updateRaw, state, links] = await Promise.all([
      jdClient.call('/update/isUpdateAvailable'),
      jdClient.call('/downloadcontroller/getCurrentState'),
      jdClient.call('/downloadsV2/queryLinks', [EXTRACTION_STATUS_QUERY]),
    ]);
    const idle = IDLE_STATES.has(state as string) && !asArray(links).some(l => isExtracting(l as { status?: string; statusIconKey?: string }));
    await jdClient.checkAutoUpdate(idle, updateRaw === true);
  } catch {}
}

function syncAll() {
  void syncDownloads();
  void syncGrabber();
  void syncNotifications();
}

// ─── Event-driven updates ─────────────────────────────────────────────────────
//
// JD's /events subscription API triggers queries only when something actually
// changed; per-field diff events update the cache directly. Requires a JD build
// that exposes /events/listpublisher.

// Coalesce event bursts (e.g. "50 links added") into a single query per topic.
// Grabber is slower: linkcollector fires uncollapsed per-link events during
// online checks / crawls.
const TOPIC_DEBOUNCE_MS: Record<EventTopic, number> = {
  downloads: 150,
  grabber: 1_000,
  notifications: 150,
};
const topicPollers: Record<EventTopic, () => Promise<void>> = {
  downloads: syncDownloads,
  grabber: syncGrabber,
  notifications: syncNotifications,
};
const topicTimers = new Map<EventTopic, ReturnType<typeof setTimeout>>();

function scheduleTopicPoll(topic: EventTopic) {
  if (topicTimers.has(topic)) {
    return;
  }
  topicTimers.set(topic, setTimeout(() => {
    topicTimers.delete(topic);
    void topicPollers[topic]();
  }, TOPIC_DEBOUNCE_MS[topic]));
}

// Cache-only tick (no JD calls). Re-derives extraction % — the elapsed/ETA
// interpolation needs wall-clock sampling between diff events — while extracting.
let exProgressTicker: ReturnType<typeof setInterval> | null = null;

function updateExtractionTicker() {
  const wantEx = clientCount() > 0 && cachedDownloads !== null && Object.keys(cachedDownloads.exProgress).length > 0;
  if (wantEx && exProgressTicker === null) {
    exProgressTicker = setInterval(recomputeExProgress, 2_000);
  } else if (!wantEx && exProgressTicker !== null) {
    clearInterval(exProgressTicker);
    exProgressTicker = null;
  }
}

// Emits a delta only when an extraction % actually moved.
function recomputeExProgress() {
  if (!cachedDownloads || !isActive()) {
    return;
  }
  const meta = downloadsMeta(cachedDownloads.state, cachedDownloads.speed, cachedDownloads.links);
  if (meta.exProgressStr === cachedDownloads.exProgressStr) {
    return;
  }
  Object.assign(cachedDownloads, meta);
  broadcast({ type: 'downloads', full: false, seq: ++seq, exProgress: meta.exProgress });
}

// Apply a batch of validated per-field diffs into the cache and emit one
// standard SSE delta, identical in shape to a poll-diff delta.
function applyFieldPatches(patches: EntityPatch[]) {
  if (!cachedDownloads || !isActive()) {
    return;
  }
  const cache = cachedDownloads;
  const r = applyPatchesToCache(cache, patches);
  if (r.unknownUuids) {
    scheduleTopicPoll('downloads');
  }
  if (Object.keys(r.delta).length === 0) {
    return;
  }

  const speed = r.changedLinks.length > 0 ? sumSpeed(cache.links) : cache.speed;
  const meta = downloadsMeta(cache.state, speed, cache.links);
  const changedMeta = metaDelta(cache, meta);
  Object.assign(cache, meta);
  broadcast({ ...r.delta, ...changedMeta, type: 'downloads', full: false, seq: ++seq });
  updateExtractionTicker();
}

const eventListener = new JdEventListener(jdClient, {
  onEvents: (topics) => {
    for (const topic of topics) {
      scheduleTopicPoll(topic);
    }
  },
  // We may have missed events while unsubscribed — re-baseline everything.
  onResync: syncAll,
  onUnsupported: () => console.error('[broadcaster] JD events API unavailable — real-time updates disabled. Ensure your JD build exposes /events/listpublisher.'),
  onConnectionError: () => reportJdDown(),
  onDiffEvents: patches => applyFieldPatches(patches),
});

// ─── Clients ──────────────────────────────────────────────────────────────────

export function addSseClient(writer: SseWriter) {
  if (listenerGraceTimer) {
    clearTimeout(listenerGraceTimer);
    listenerGraceTimer = null;
  }
  const initial: SseServerMessage[] = [];
  if (cachedDownloads) {
    initial.push(fullDownloadsMsg(cachedDownloads));
  }
  if (cachedGrabber) {
    initial.push(fullGrabberMsg(cachedGrabber));
  }
  if (lastNotifications) {
    initial.push(lastNotifications.msg);
  }
  if (lastHealthJd !== null) {
    initial.push({ type: 'health', jd: lastHealthJd });
  }
  addClient(writer, initial);
  // only trigger immediate polls when we have no cached state yet
  if (!cachedDownloads) {
    void syncDownloads();
  }
  if (!cachedGrabber) {
    void syncGrabber();
  }
  if (lastHealthJd === null) {
    void pollHealth();
  }
  if (!lastNotifications) {
    void syncNotifications();
  }
  eventListener.start();
  updateExtractionTicker();
}

export function removeSseClient(writer: SseWriter) {
  if (!removeClient(writer)) {
    return;
  }
  updateExtractionTicker();
  // No one is watching: park everything after the grace period. stop() also
  // unsubscribes best-effort.
  listenerGraceTimer = setTimeout(() => {
    listenerGraceTimer = null;
    if (clientCount() === 0) {
      void eventListener.stop();
    }
  }, LISTENER_GRACE_MS);
}

// ─── Health ───────────────────────────────────────────────────────────────────

// Returns true if the health state changed.
function setHealth(jd: boolean): boolean {
  if (jd === lastHealthJd) {
    return false;
  }
  lastHealthJd = jd;
  broadcast({ type: 'health', jd });
  return true;
}

function reportJdDown() {
  setHealth(false);
}

async function pollHealth() {
  // A succeeding long-poll already proves JD is reachable.
  if (eventListener.isHealthy()) {
    jdClient.setAvailable(true);
    setHealth(true);
    return;
  }
  await jdClient.healthCheck();
  const jd = jdClient.isAvailable();
  // Restart the event listener when JD comes back (covers the case where
  // the listener exited unexpectedly while clients were connected).
  if (setHealth(jd) && jd && clientCount() > 0) {
    eventListener.start();
  }
}

// ─── Start / stop ─────────────────────────────────────────────────────────────

export function startBroadcaster() {
  void pollHealth();
  setInterval(() => void pollHealth(), 5_000);
  startHeartbeat(() => seq);
  // Safety net for missed/dropped events: cheap periodic reconciliation.
  // Also refreshes total speed / update-availability during long idle phases.
  setInterval(syncAll, 60_000);
  setInterval(() => void autoUpdateTick(), 60_000);
  // The event listener itself starts with the first SSE client (addSseClient)
  // and stops with the last — no clients means no JD traffic beyond health.
}

// Best-effort unsubscribe (the subscription would self-expire in <=3 min anyway).
export function stopBroadcaster(): Promise<void> {
  return eventListener.stop();
}
