import type { EntityPatch, EventTopic } from './jdEvents';
import process from 'node:process';
import {
  DEFAULT_GRABBER_LINK_QUERY,
  DEFAULT_GRABBER_PACKAGE_QUERY,
  DEFAULT_LINK_QUERY,
  DEFAULT_PACKAGE_QUERY,
  isJdConnError,
  jd as jdClient,
} from './jd';
import { JdEventListener } from './jdEvents';

// ─── Message types ────────────────────────────────────────────────────────────

export type SseServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; full: true; seq: number; packages: unknown[]; links: unknown[]; state: string; speed: number; exProgress: Record<number, number> }
    | { type: 'downloads'; full: false; seq: number; packages?: unknown[]; removedPackages?: number[]; links?: unknown[]; removedLinks?: number[]; state?: string; speed?: number; exProgress?: Record<number, number> }
    | { type: 'grabber'; full: true; seq: number; packages: unknown[]; links: unknown[] }
    | { type: 'grabber'; full: false; seq: number; packages?: unknown[]; removedPackages?: number[]; links?: unknown[]; removedLinks?: number[] }
    | { type: 'notifications'; dialogs: unknown[]; captchas: unknown[]; updateAvailable: boolean }
    | { type: 'hello'; epoch: string; heartbeatMs: number }
    | { type: 'heartbeat'; epoch: string; seq: number };

// ─── Extraction progress tracking ────────────────────────────────────────────

const ETA_ALPHA = 0.3;
const extractStartMap = new Map<number, { startMs: number; smoothedEtaMs: number }>();

// JD's IconKey.ICON_EXTRACT; status text is localized, so it is only a fallback.
function isExtracting(l: { status?: string; statusIconKey?: string }): boolean {
  return l.statusIconKey === 'extract' || !!l.status?.toLowerCase().includes('extracting');
}

function updateExtractionProgress(links: unknown[]): Record<number, number> {
  const activeUuids = new Set<number>();
  const etaByUuid = new Map<number, number>();

  for (const link of links) {
    const l = link as { uuid: number; status?: string; statusIconKey?: string; eta?: number };
    if (!isExtracting(l)) {
      continue;
    }
    etaByUuid.set(l.uuid, l.eta ?? 0);
    activeUuids.add(l.uuid);
    const eta = l.eta ?? 0;
    if (!extractStartMap.has(l.uuid)) {
      extractStartMap.set(l.uuid, { startMs: Date.now(), smoothedEtaMs: eta > 0 ? eta : 0 });
    } else if (eta > 0) {
      const entry = extractStartMap.get(l.uuid)!;
      entry.smoothedEtaMs = entry.smoothedEtaMs === 0
        ? eta
        : ETA_ALPHA * eta + (1 - ETA_ALPHA) * entry.smoothedEtaMs;
    }
  }

  for (const uuid of extractStartMap.keys()) {
    if (!activeUuids.has(uuid)) {
      extractStartMap.delete(uuid);
    }
  }

  const progress: Record<number, number> = {};
  for (const [uuid, entry] of extractStartMap) {
    if (!entry || entry.smoothedEtaMs === 0) {
      progress[uuid] = 0;
    } else if ((etaByUuid.get(uuid) ?? 0) <= 0) {
      progress[uuid] = 99;
    } else {
      const elapsedS = (Date.now() - entry.startMs) / 1000;
      progress[uuid] = Math.max(0, Math.min(99, Math.round((elapsedS / (elapsedS + entry.smoothedEtaMs / 1000)) * 100)));
    }
  }
  return progress;
}

// ─── Client registry ──────────────────────────────────────────────────────────

// Receives a fully encoded SSE frame, shared by all clients.
type SseWriter = (frame: Uint8Array) => void;
const clients = new Set<SseWriter>();
const encoder = new TextEncoder();

export const HEARTBEAT_MS = 5_000;
// Identifies this server process; a new epoch means seq was reset.
const EPOCH = Date.now().toString(36);
// Keep the JD subscription and cache alive this long after the last client
// leaves, so a quick reconnect (resync, tab switch) skips the full re-baseline.
const LISTENER_GRACE_MS = 30_000;
let listenerGraceTimer: ReturnType<typeof setTimeout> | null = null;

// True while clients are connected or the grace period is running.
function isActive(): boolean {
  return clients.size > 0 || listenerGraceTimer !== null;
}

function encodeFrame(event: string, data: string): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${data}\n\n`);
}

// ─── State cache (for diffing + initial full sync to new clients) ─────────────

type DownloadsCache = {
  pkgMap: Map<number, Record<string, unknown>>;
  linkMap: Map<number, Record<string, unknown>>;
  pkgIdx: Map<number, number>;
  linkIdx: Map<number, number>;
  packages: unknown[];
  links: unknown[];
  state: string;
  speed: number;
  exProgress: Record<number, number>;
  exProgressStr: string;
  seq: number;
};

type GrabberCache = {
  pkgMap: Map<number, Record<string, unknown>>;
  linkMap: Map<number, Record<string, unknown>>;
  packages: unknown[];
  links: unknown[];
  seq: number;
};

let cachedDownloads: DownloadsCache | null = null;
let cachedGrabber: GrabberCache | null = null;
let lastHealthJd: boolean | null = null;
let lastNotificationsStr: string | null = null;
let lastNotificationsMsg: SseServerMessage | null = null;

// One global monotonic sequence number across downloads + grabber. Every such
// message (full or delta) and every heartbeat carries it, so clients detect a
// dropped message (gap) and force a resync. Full snapshots re-baseline the client.
let seq = 0;

function toUuidMap<T extends { uuid: number }>(arr: T[]): Map<number, Record<string, unknown>> {
  return new Map(arr.map(x => [x.uuid, x as unknown as Record<string, unknown>]));
}

function toIndexMap(arr: unknown[]): Map<number, number> {
  return new Map(arr.map((x, i) => [(x as { uuid: number }).uuid, i]));
}

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

// Collapses concurrent calls: while a run is in flight, further calls mark it
// dirty and exactly one follow-up run starts afterwards. Prevents overlapping
// snapshots from landing out of order.
function singleFlight(fn: () => Promise<void>): () => Promise<void> {
  let running: Promise<void> | null = null;
  let dirty = false;
  const loop = async () => {
    do {
      dirty = false;
      await fn();
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

// Shallow equality for flat JD API entities (primitives + arrays of primitives,
// e.g. `hosts`). Detects changed, added and removed keys. Falls back to a
// JSON.stringify comparison for any nested object values, so correctness is
// preserved even if JD ever returns nested structures.
export function shallowEntityEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) {
    return false;
  }
  for (const k of aKeys) {
    const av = a[k];
    const bv = b[k];
    if (av === bv) {
      continue;
    }
    if (av === null || bv === null || typeof av !== 'object' || typeof bv !== 'object') {
      return false;
    }
    if (Array.isArray(av) && Array.isArray(bv)) {
      if (av.length !== bv.length) {
        return false;
      }
      let arraysEqual = true;
      for (let i = 0; i < av.length; i++) {
        const x = av[i];
        const y = bv[i];
        if (x !== y && (typeof x !== 'object' || typeof y !== 'object' || JSON.stringify(x) !== JSON.stringify(y))) {
          arraysEqual = false;
          break;
        }
      }
      if (!arraysEqual) {
        return false;
      }
      continue;
    }
    if (JSON.stringify(av) !== JSON.stringify(bv)) {
      return false;
    }
  }
  return true;
}

// ─── Sync functions ───────────────────────────────────────────────────────────

const syncDownloads = singleFlight(async () => {
  if (!isActive()) {
    return;
  }
  try {
    const [packages, links, state] = await Promise.all([
      jdClient.call('/downloadsV2/queryPackages', [DEFAULT_PACKAGE_QUERY]),
      jdClient.call('/downloadsV2/queryLinks', [DEFAULT_LINK_QUERY]),
      jdClient.call('/downloadcontroller/getCurrentState'),
    ]);
    const pkgArr = Array.isArray(packages) ? packages : [];
    const linkArr = Array.isArray(links) ? links : [];
    const currState = (state as string) ?? 'IDLE';
    const currSpeed = sumSpeed(linkArr);
    const exProgress = updateExtractionProgress(linkArr);

    const exProgressStr = JSON.stringify(exProgress);

    if (!cachedDownloads) {
      seq++;
      cachedDownloads = { pkgMap: toUuidMap(pkgArr as Array<{ uuid: number }>), linkMap: toUuidMap(linkArr as Array<{ uuid: number }>), pkgIdx: toIndexMap(pkgArr), linkIdx: toIndexMap(linkArr), packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress, exProgressStr, seq };
      broadcast({ type: 'downloads', full: true, seq, packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress });
      updateExtractionTicker();
      return;
    }

    const pkgDiff = diffArrays(cachedDownloads.pkgMap, pkgArr as Array<{ uuid: number }>);
    const linkDiff = diffArrays(cachedDownloads.linkMap, linkArr as Array<{ uuid: number }>);
    const stateChanged = currState !== cachedDownloads.state;
    const speedChanged = currSpeed !== cachedDownloads.speed;
    const exProgressChanged = exProgressStr !== cachedDownloads.exProgressStr;

    const hasChanges
      = pkgDiff.changed.length > 0
        || pkgDiff.removedUuids.length > 0
        || linkDiff.changed.length > 0
        || linkDiff.removedUuids.length > 0
        || stateChanged
        || speedChanged
        || exProgressChanged;

    if (!hasChanges) {
      updateExtractionTicker();
      return;
    }

    seq++;
    cachedDownloads = { pkgMap: pkgDiff.newMap, linkMap: linkDiff.newMap, pkgIdx: toIndexMap(pkgArr), linkIdx: toIndexMap(linkArr), packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress, exProgressStr, seq };

    const delta: SseServerMessage & { type: 'downloads'; full: false } = { type: 'downloads', full: false, seq };
    if (pkgDiff.changed.length > 0) {
      delta.packages = pkgDiff.changed;
    }
    if (pkgDiff.removedUuids.length > 0) {
      delta.removedPackages = pkgDiff.removedUuids;
    }
    if (linkDiff.changed.length > 0) {
      delta.links = linkDiff.changed;
    }
    if (linkDiff.removedUuids.length > 0) {
      delta.removedLinks = linkDiff.removedUuids;
    }
    if (stateChanged) {
      delta.state = currState;
    }
    if (speedChanged) {
      delta.speed = currSpeed;
    }
    if (exProgressChanged) {
      delta.exProgress = exProgress;
    }

    broadcast(delta);
    updateExtractionTicker();
  } catch (e) {
    if (isJdConnError(e)) {
      reportJdDown();
    }
  }
});

const syncGrabber = singleFlight(async () => {
  if (!isActive()) {
    return;
  }
  try {
    const [packages, links] = await Promise.all([
      jdClient.call('/linkgrabberv2/queryPackages', [DEFAULT_GRABBER_PACKAGE_QUERY]),
      jdClient.call('/linkgrabberv2/queryLinks', [DEFAULT_GRABBER_LINK_QUERY]),
    ]);
    const pkgArr = Array.isArray(packages) ? packages : [];
    const linkArr = Array.isArray(links) ? links : [];

    if (!cachedGrabber) {
      seq++;
      cachedGrabber = { pkgMap: toUuidMap(pkgArr as Array<{ uuid: number }>), linkMap: toUuidMap(linkArr as Array<{ uuid: number }>), packages: pkgArr, links: linkArr, seq };
      broadcast({ type: 'grabber', full: true, seq, packages: pkgArr, links: linkArr });
      return;
    }

    const pkgDiff = diffArrays(cachedGrabber.pkgMap, pkgArr as Array<{ uuid: number }>);
    const linkDiff = diffArrays(cachedGrabber.linkMap, linkArr as Array<{ uuid: number }>);

    const hasChanges
      = pkgDiff.changed.length > 0
        || pkgDiff.removedUuids.length > 0
        || linkDiff.changed.length > 0
        || linkDiff.removedUuids.length > 0;

    if (!hasChanges) {
      return;
    }

    seq++;
    cachedGrabber = { pkgMap: pkgDiff.newMap, linkMap: linkDiff.newMap, packages: pkgArr, links: linkArr, seq };

    const delta: SseServerMessage & { type: 'grabber'; full: false } = { type: 'grabber', full: false, seq };
    if (pkgDiff.changed.length > 0) {
      delta.packages = pkgDiff.changed;
    }
    if (pkgDiff.removedUuids.length > 0) {
      delta.removedPackages = pkgDiff.removedUuids;
    }
    if (linkDiff.changed.length > 0) {
      delta.links = linkDiff.changed;
    }
    if (linkDiff.removedUuids.length > 0) {
      delta.removedLinks = linkDiff.removedUuids;
    }

    broadcast(delta);
  } catch (e) {
    if (isJdConnError(e)) {
      reportJdDown();
    }
  }
});

const syncNotifications = singleFlight(async () => {
  if (!isActive()) {
    return;
  }
  try {
    const [captchasRaw, updateRaw, dialogIdsRaw] = await Promise.all([
      jdClient.call('/captcha/list', []),
      jdClient.call('/update/isUpdateAvailable'),
      jdClient.call('/dialogs/list'),
    ]);

    const captchas = Array.isArray(captchasRaw) ? captchasRaw : [];
    const updateAvailable = updateRaw === true;

    let dialogs: unknown[] = [];
    if (Array.isArray(dialogIdsRaw) && dialogIdsRaw.length > 0) {
      const results = await Promise.allSettled(
        (dialogIdsRaw as unknown[]).map(id =>
          jdClient.call('/dialogs/get', [id, false, true])
            .then(data => ({ ...(data as Record<string, unknown>), id })),
        ),
      );
      dialogs = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<unknown>).value);
    }

    const str = JSON.stringify({ dialogs, captchas, updateAvailable });
    if (str !== lastNotificationsStr) {
      lastNotificationsStr = str;
      lastNotificationsMsg = { type: 'notifications', dialogs, captchas, updateAvailable };
      broadcast(lastNotificationsMsg);
    }

    const idle = cachedDownloads?.state === 'IDLE' && extractStartMap.size === 0;
    void jdClient.checkAutoUpdate(idle, updateAvailable);
  } catch (e) {
    if (isJdConnError(e)) {
      reportJdDown();
    }
  }
});

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
  downloads: () => syncDownloads(),
  grabber: () => syncGrabber(),
  notifications: () => syncNotifications(),
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

function extractionsActive(): boolean {
  return cachedDownloads !== null && Object.keys(cachedDownloads.exProgress).length > 0;
}

function updateExtractionTicker() {
  const wantEx = clients.size > 0 && extractionsActive();
  if (wantEx && exProgressTicker === null) {
    exProgressTicker = setInterval(recomputeExProgress, 2_000);
  } else if (!wantEx && exProgressTicker !== null) {
    clearInterval(exProgressTicker);
    exProgressTicker = null;
  }
}

// Cache-only re-derivation of extraction progress percentages. Reads the cached
// links, makes no JD call, and emits a delta only when a % actually moved.
function recomputeExProgress() {
  if (!cachedDownloads || !isActive()) {
    return;
  }
  const exProgress = updateExtractionProgress(cachedDownloads.links);
  const exProgressStr = JSON.stringify(exProgress);
  if (exProgressStr === cachedDownloads.exProgressStr) {
    return;
  }
  seq++;
  Object.assign(cachedDownloads, { exProgress, exProgressStr, seq });
  broadcast({ type: 'downloads', full: false, seq, exProgress });
}

export type PatchTarget = {
  linkMap: Map<number, Record<string, unknown>>;
  pkgMap: Map<number, Record<string, unknown>>;
  linkIdx: Map<number, number>;
  pkgIdx: Map<number, number>;
  links: unknown[];
  packages: unknown[];
};

export type PatchResult = {
  changedLinks: unknown[];
  changedPkgs: unknown[];
  unknownUuids: boolean;
};

// Applies patches to the cache in place. Changed entities are replaced by new
// objects so already-sent snapshots are never mutated.
export function applyPatchesToCache(cache: PatchTarget, patches: EntityPatch[]): PatchResult {
  const merged = { link: new Map<number, Record<string, unknown>>(), package: new Map<number, Record<string, unknown>>() };
  let unknownUuids = false;
  for (const p of patches) {
    const cacheMap = p.kind === 'link' ? cache.linkMap : cache.pkgMap;
    if (!cacheMap.has(p.uuid)) {
      unknownUuids = true;
      continue;
    }
    const target = merged[p.kind];
    target.set(p.uuid, Object.assign(target.get(p.uuid) ?? {}, p.fields));
  }

  const apply = (
    fields: Map<number, Record<string, unknown>>,
    map: Map<number, Record<string, unknown>>,
    idx: Map<number, number>,
    arr: unknown[],
  ) => {
    const changed: unknown[] = [];
    for (const [uuid, f] of fields) {
      const prev = map.get(uuid)!;
      const next = { ...prev, ...f };
      if (shallowEntityEqual(prev, next)) {
        continue;
      }
      map.set(uuid, next);
      const i = idx.get(uuid);
      if (i !== undefined) {
        arr[i] = next;
      }
      changed.push(next);
    }
    return changed;
  };

  return {
    changedLinks: apply(merged.link, cache.linkMap, cache.linkIdx, cache.links),
    changedPkgs: apply(merged.package, cache.pkgMap, cache.pkgIdx, cache.packages),
    unknownUuids,
  };
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
  if (r.changedLinks.length === 0 && r.changedPkgs.length === 0) {
    return;
  }

  const speed = r.changedLinks.length > 0 ? sumSpeed(cache.links) : cache.speed;
  const exProgress = updateExtractionProgress(cache.links);
  const exProgressStr = JSON.stringify(exProgress);
  const speedChanged = speed !== cache.speed;
  const exProgressChanged = exProgressStr !== cache.exProgressStr;

  seq++;
  Object.assign(cache, { speed, exProgress, exProgressStr, seq });

  const delta: SseServerMessage & { type: 'downloads'; full: false } = { type: 'downloads', full: false, seq };
  if (r.changedPkgs.length > 0) {
    delta.packages = r.changedPkgs;
  }
  if (r.changedLinks.length > 0) {
    delta.links = r.changedLinks;
  }
  if (speedChanged) {
    delta.speed = speed;
  }
  if (exProgressChanged) {
    delta.exProgress = exProgress;
  }
  broadcast(delta);
  updateExtractionTicker();
}

const eventListener = new JdEventListener(jdClient, {
  onEvents: (topics) => {
    for (const topic of topics) {
      scheduleTopicPoll(topic);
    }
  },
  onResync: () => {
    // We may have missed events while unsubscribed — re-baseline everything.
    void syncDownloads();
    void syncGrabber();
    void syncNotifications();
  },
  onUnsupported: () => console.error('[broadcaster] JD events API unavailable — real-time updates disabled. Ensure your JD build exposes /events/listpublisher.'),
  onConnectionError: () => reportJdDown(),
  onDiffEvents: patches => applyFieldPatches(patches),
});

// Best-effort unsubscribe on shutdown (the subscription would self-expire in
// <=3 min anyway). Registering signal handlers suppresses the default exit, so
// exit explicitly — with a hard deadline in case JD hangs.
function shutdown(code: number) {
  const deadline = setTimeout(() => process.exit(code), 2_000);
  void eventListener.stop().finally(() => {
    clearTimeout(deadline);
    process.exit(code);
  });
}
process.once('SIGTERM', () => shutdown(0));
process.once('SIGINT', () => shutdown(0));

export function addSseClient(writer: SseWriter) {
  if (listenerGraceTimer) {
    clearTimeout(listenerGraceTimer);
    listenerGraceTimer = null;
  }
  writer(encoder.encode(`retry: 2000\nevent: hello\ndata: ${JSON.stringify({ type: 'hello', epoch: EPOCH, heartbeatMs: HEARTBEAT_MS })}\n\n`));
  if (cachedDownloads) {
    writer(encodeFrame('downloads', JSON.stringify({ type: 'downloads', full: true, seq, packages: cachedDownloads.packages, links: cachedDownloads.links, state: cachedDownloads.state, speed: cachedDownloads.speed, exProgress: cachedDownloads.exProgress })));
  }
  if (cachedGrabber) {
    writer(encodeFrame('grabber', JSON.stringify({ type: 'grabber', full: true, seq, packages: cachedGrabber.packages, links: cachedGrabber.links })));
  }
  if (lastNotificationsMsg) {
    writer(encodeFrame('notifications', JSON.stringify(lastNotificationsMsg)));
  }
  if (lastHealthJd !== null) {
    writer(encodeFrame('health', JSON.stringify({ type: 'health', jd: lastHealthJd })));
  }
  clients.add(writer);
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
  if (!lastNotificationsStr) {
    void syncNotifications();
  }
  eventListener.start();
  updateExtractionTicker();
}

export function removeSseClient(writer: SseWriter) {
  if (!clients.delete(writer) || clients.size > 0) {
    return;
  }
  updateExtractionTicker();
  // No one is watching: park everything after the grace period. stop() also
  // unsubscribes best-effort.
  listenerGraceTimer = setTimeout(() => {
    listenerGraceTimer = null;
    if (clients.size === 0) {
      void eventListener.stop();
    }
  }, LISTENER_GRACE_MS);
}

function broadcast(msg: SseServerMessage) {
  const frame = encodeFrame(msg.type, JSON.stringify(msg));
  for (const write of clients) {
    write(frame);
  }
}

// ─── Diff helper ──────────────────────────────────────────────────────────────

export function diffArrays<T extends { uuid: number }>(
  prevMap: Map<number, Record<string, unknown>>,
  curr: T[],
): { changed: T[]; removedUuids: number[]; newMap: Map<number, Record<string, unknown>> } {
  const changed: T[] = [];
  const newMap = new Map<number, Record<string, unknown>>();
  for (const item of curr) {
    const obj = item as unknown as Record<string, unknown>;
    newMap.set(item.uuid, obj);
    const prev = prevMap.get(item.uuid);
    if (!prev || !shallowEntityEqual(prev, obj)) {
      changed.push(item);
    }
  }
  const removedUuids: number[] = [];
  for (const uuid of prevMap.keys()) {
    if (!newMap.has(uuid)) {
      removedUuids.push(uuid);
    }
  }
  return { changed, removedUuids, newMap };
}

function reportJdDown() {
  if (lastHealthJd === false) {
    return;
  }
  lastHealthJd = false;
  broadcast({ type: 'health', jd: false });
}

// ─── Poll functions ───────────────────────────────────────────────────────────

async function pollHealth() {
  // A succeeding long-poll already proves JD is reachable.
  if (eventListener.isHealthy()) {
    jdClient.setAvailable(true);
    if (lastHealthJd !== true) {
      lastHealthJd = true;
      broadcast({ type: 'health', jd: true });
    }
    return;
  }
  try {
    await jdClient.healthCheck();
    const jd = jdClient.isConfigured() && jdClient.isAvailable();
    if (jd === lastHealthJd) {
      return;
    }
    lastHealthJd = jd;
    broadcast({ type: 'health', jd });
    // Restart the event listener when JD comes back (covers the case where
    // the listener exited unexpectedly while clients were connected).
    if (jd && clients.size > 0) {
      eventListener.start();
    }
  } catch {
    if (lastHealthJd === false) {
      return;
    }
    lastHealthJd = false;
    broadcast({ type: 'health', jd: false });
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

// Carries the current global seq so clients detect missed messages (incl. a lost
// last delta while idle) and force a resync. Also doubles as keepalive: its
// absence lets the client watchdog spot a dead/half-open connection (common on
// mobile). EventSource cannot observe SSE comments, so use a real event.
function broadcastHeartbeat() {
  if (clients.size === 0) {
    return;
  }
  const frame = encodeFrame('heartbeat', JSON.stringify({ type: 'heartbeat', epoch: EPOCH, seq }));
  for (const write of clients) {
    write(frame);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

export function startBroadcaster() {
  void pollHealth();
  setInterval(() => void pollHealth(), 5_000);
  setInterval(broadcastHeartbeat, HEARTBEAT_MS);
  // Safety net for missed/dropped events: cheap periodic reconciliation.
  // Also refreshes total speed / update-availability during long idle phases.
  setInterval(() => {
    void syncDownloads();
    void syncGrabber();
    void syncNotifications();
  }, 60_000);
  // The event listener itself starts with the first SSE client (addSseClient)
  // and stops with the last — no clients means no JD traffic beyond health.
}
