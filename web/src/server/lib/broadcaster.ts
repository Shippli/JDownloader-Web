import type { EventTopic } from './jdEvents';
import process from 'node:process';
import {
  DEFAULT_GRABBER_LINK_QUERY,
  DEFAULT_GRABBER_PACKAGE_QUERY,
  DEFAULT_LINK_QUERY,
  DEFAULT_PACKAGE_QUERY,
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
    | { type: 'heartbeat'; seq: number };

// ─── Extraction progress tracking ────────────────────────────────────────────

const ETA_ALPHA = 0.3;
const extractStartMap = new Map<number, { startMs: number; smoothedEtaMs: number }>();

function updateExtractionProgress(links: unknown[]): Record<number, number> {
  const activeUuids = new Set<number>();

  for (const link of links) {
    const l = link as { uuid: number; status?: string; eta?: number };
    if (!l.status?.toLowerCase().includes('extracting')) {
      continue;
    }
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

  const linkByUuid = new Map((links as Array<{ uuid: number; eta?: number }>).map(x => [x.uuid, x]));
  const progress: Record<number, number> = {};
  for (const [uuid, entry] of extractStartMap) {
    const l = linkByUuid.get(uuid);
    if (!entry || entry.smoothedEtaMs === 0) {
      progress[uuid] = 0;
    } else if ((l?.eta ?? 0) <= 0) {
      progress[uuid] = 99;
    } else {
      const elapsedS = (Date.now() - entry.startMs) / 1000;
      progress[uuid] = Math.max(0, Math.min(99, Math.round((elapsedS / (elapsedS + entry.smoothedEtaMs / 1000)) * 100)));
    }
  }
  return progress;
}

// ─── Client registry ──────────────────────────────────────────────────────────

type SseWriter = (event: string, data: string) => void;
const clients = new Set<SseWriter>();

// ─── State cache (for diffing + initial full sync to new clients) ─────────────

type DownloadsCache = {
  pkgMap: Map<number, Record<string, unknown>>;
  linkMap: Map<number, Record<string, unknown>>;
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

// One global monotonic sequence number across downloads + grabber. Every such
// message (full or delta) and every heartbeat carries it, so clients detect a
// dropped message (gap) and force a resync. Full snapshots re-baseline the client.
let seq = 0;

function toUuidMap<T extends { uuid: number }>(arr: T[]): Map<number, Record<string, unknown>> {
  return new Map(arr.map(x => [x.uuid, x as unknown as Record<string, unknown>]));
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

// ─── Event-driven mode ────────────────────────────────────────────────────────
//
// Default: JD's /events subscription API triggers the polls above only when
// something actually changed (see events-plan.md). 'legacy' keeps the previous
// fixed-interval polling — used as automatic fallback when the events API is
// unavailable, or forced via JD_EVENTS=off.

type BroadcastMode = 'events' | 'legacy';
let mode: BroadcastMode = process.env.JD_EVENTS === 'off' ? 'legacy' : 'events';
let legacyTimersStarted = false;
let reconcileTimer: ReturnType<typeof setInterval> | null = null;

// Coalesce event bursts (e.g. "50 links added") into a single query per topic.
const TOPIC_DEBOUNCE_MS = 150;
const topicPollers: Record<EventTopic, () => Promise<void>> = {
  downloads: pollDownloads,
  grabber: pollGrabber,
  notifications: pollNotifications,
};
const topicTimers = new Map<EventTopic, ReturnType<typeof setTimeout>>();

function scheduleTopicPoll(topic: EventTopic) {
  if (topicTimers.has(topic)) {
    return;
  }
  topicTimers.set(topic, setTimeout(() => {
    topicTimers.delete(topic);
    void topicPollers[topic]();
  }, TOPIC_DEBOUNCE_MS));
}

// While downloads run or archives extract, bytesLoaded/speed/eta change
// continuously without emitting structure events, and the extraction-progress
// heuristic needs regular wall-clock sampling — so keep the old 2 s cadence,
// but only for as long as there is actual activity.
let progressTicker: ReturnType<typeof setInterval> | null = null;

function downloadsActive(): boolean {
  return cachedDownloads !== null
    && (cachedDownloads.state === 'RUNNING' || Object.keys(cachedDownloads.exProgress).length > 0);
}

function updateProgressTicker() {
  if (mode !== 'events') {
    return;
  }
  const shouldRun = clients.size > 0 && downloadsActive();
  if (shouldRun && progressTicker === null) {
    progressTicker = setInterval(() => void pollDownloads(), 2_000);
  } else if (!shouldRun && progressTicker !== null) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
}

function startLegacyTimers() {
  if (legacyTimersStarted) {
    return;
  }
  legacyTimersStarted = true;
  setInterval(() => void pollDownloads(), 2_000);
  setInterval(() => void pollGrabber(), 3_000);
  setInterval(() => void pollNotifications(), 5_000);
}

function switchToLegacy(reason: string) {
  if (mode === 'legacy') {
    return;
  }
  console.warn(`[broadcaster] falling back to fixed-interval polling: ${reason}`);
  mode = 'legacy';
  if (reconcileTimer !== null) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }
  if (progressTicker !== null) {
    clearInterval(progressTicker);
    progressTicker = null;
  }
  startLegacyTimers();
}

const eventListener = new JdEventListener(jdClient, {
  onEvents: (topics) => {
    for (const topic of topics) {
      scheduleTopicPoll(topic);
    }
  },
  onResync: () => {
    // We may have missed events while unsubscribed — re-baseline everything.
    void pollDownloads();
    void pollGrabber();
    void pollNotifications();
  },
  onUnsupported: () => switchToLegacy('JD events API unavailable or missing required publishers'),
  onConnectionError: () => reportJdDown(),
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
  if (cachedDownloads) {
    writer('downloads', JSON.stringify({ type: 'downloads', full: true, seq, packages: cachedDownloads.packages, links: cachedDownloads.links, state: cachedDownloads.state, speed: cachedDownloads.speed, exProgress: cachedDownloads.exProgress }));
  }
  if (cachedGrabber) {
    writer('grabber', JSON.stringify({ type: 'grabber', full: true, seq, packages: cachedGrabber.packages, links: cachedGrabber.links }));
  }
  if (lastHealthJd !== null) {
    writer('health', JSON.stringify({ type: 'health', jd: lastHealthJd }));
  }
  clients.add(writer);
  // only trigger immediate polls when we have no cached state yet
  if (!cachedDownloads) {
    void pollDownloads();
  }
  if (!cachedGrabber) {
    void pollGrabber();
  }
  if (lastHealthJd === null) {
    void pollHealth();
  }
  if (!lastNotificationsStr) {
    void pollNotifications();
  }
  if (mode === 'events') {
    eventListener.start();
    updateProgressTicker();
  }
}

export function removeSseClient(writer: SseWriter) {
  clients.delete(writer);
  if (clients.size === 0) {
    // No one is watching: park everything. The JD-side subscription expires on
    // its own (maxKeepalive), stop() also unsubscribes best-effort.
    void eventListener.stop();
    updateProgressTicker();
  }
}

function broadcast(msg: SseServerMessage) {
  const data = JSON.stringify(msg);
  for (const write of clients) {
    write(msg.type, data);
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

// ─── Error helper ─────────────────────────────────────────────────────────────

function isJdConnErr(e: unknown): boolean {
  const code = (e as { code?: string })?.code ?? '';
  return (
    code === 'JD_UNAVAILABLE'
    || code === 'JD_NOT_CONFIGURED'
    || code === 'ECONNREFUSED'
    || code === 'ConnectionRefused'
    || code === 'ECONNRESET'
  );
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
  try {
    await jdClient.healthCheck();
    const jd = jdClient.isConfigured() && jdClient.isAvailable();
    if (jd === lastHealthJd) {
      return;
    }
    lastHealthJd = jd;
    broadcast({ type: 'health', jd });
  } catch {
    if (lastHealthJd === false) {
      return;
    }
    lastHealthJd = false;
    broadcast({ type: 'health', jd: false });
  }
}

async function pollDownloads() {
  if (clients.size === 0) {
    return;
  }
  try {
    const [packages, links, state, speed] = await Promise.all([
      jdClient.call('/downloadsV2/queryPackages', [DEFAULT_PACKAGE_QUERY]),
      jdClient.call('/downloadsV2/queryLinks', [DEFAULT_LINK_QUERY]),
      jdClient.call('/downloadcontroller/getCurrentState'),
      jdClient.call('/downloadcontroller/getSpeedInBps'),
    ]);
    const pkgArr = Array.isArray(packages) ? packages : [];
    const linkArr = Array.isArray(links) ? links : [];
    const currState = (state as string) ?? 'IDLE';
    const currSpeed = (speed as number) ?? 0;
    const exProgress = updateExtractionProgress(linkArr);

    const exProgressStr = JSON.stringify(exProgress);

    if (!cachedDownloads) {
      seq++;
      cachedDownloads = { pkgMap: toUuidMap(pkgArr as Array<{ uuid: number }>), linkMap: toUuidMap(linkArr as Array<{ uuid: number }>), packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress, exProgressStr, seq };
      broadcast({ type: 'downloads', full: true, seq, packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress });
      updateProgressTicker();
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
      updateProgressTicker();
      return;
    }

    seq++;
    cachedDownloads = { pkgMap: pkgDiff.newMap, linkMap: linkDiff.newMap, packages: pkgArr, links: linkArr, state: currState, speed: currSpeed, exProgress, exProgressStr, seq };

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
    updateProgressTicker();
  } catch (e) {
    if (isJdConnErr(e)) {
      reportJdDown();
    }
  }
}

async function pollGrabber() {
  if (clients.size === 0) {
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
    if (isJdConnErr(e)) {
      reportJdDown();
    }
  }
}

async function pollNotifications() {
  if (clients.size === 0) {
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
    if (str === lastNotificationsStr) {
      return;
    }
    lastNotificationsStr = str;

    broadcast({ type: 'notifications', dialogs, captchas, updateAvailable });
  } catch (e) {
    if (isJdConnErr(e)) {
      reportJdDown();
    }
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

// Carries the current global seq so clients detect missed messages (incl. a lost
// last delta while idle) and force a resync. Also doubles as keepalive: its
// absence lets the client watchdog spot a dead/half-open connection (common on
// mobile). EventSource cannot observe SSE comments, so use a real event.
function broadcastHeartbeat() {
  const data = JSON.stringify({ type: 'heartbeat', seq });
  for (const write of clients) {
    write('heartbeat', data);
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

export function startBroadcaster() {
  void pollHealth();
  setInterval(() => void pollHealth(), 5_000);
  setInterval(broadcastHeartbeat, 5_000);
  if (mode === 'legacy') {
    startLegacyTimers();
    return;
  }
  // Safety net for missed/dropped events: cheap periodic reconciliation.
  // Also refreshes total speed / update-availability during long idle phases.
  reconcileTimer = setInterval(() => {
    void pollDownloads();
    void pollGrabber();
    void pollNotifications();
  }, 60_000);
  // The event listener itself starts with the first SSE client (addSseClient)
  // and stops with the last — no clients means no JD traffic beyond health.
}
