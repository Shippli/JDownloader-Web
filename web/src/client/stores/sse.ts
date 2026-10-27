import type { DownloadsSnapshot, EntityDelta, SseServerMessage as SharedSseServerMessage } from '../../shared/sse';
import type { DownloadLink, DownloadPackage, GrabberLink, GrabberPackage, JdCaptcha, JdDialog } from '../lib/api';
import { createSignal } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import { setJdConnected } from './jd';
import { applyNotificationsMessage } from './notifications';

// ─── Per-topic signals (fed by SSE pushes) ───────────────────────────────────

type DownloadsPayload = DownloadsSnapshot<DownloadPackage, DownloadLink>;

type GrabberPayload = {
  packages: GrabberPackage[];
  links: GrabberLink[];
};

const [_dlLoaded, setDlLoaded] = createSignal(false);
const [_dlStore, setDlStore] = createStore<DownloadsPayload>({
  packages: [],
  links: [],
  state: 'IDLE',
  speed: 0,
  exProgress: {},
});

const [_grabLoaded, setGrabLoaded] = createSignal(false);
const [_grabStore, setGrabStore] = createStore<GrabberPayload>({
  packages: [],
  links: [],
});

export const sseDownloads = (): DownloadsPayload | null => _dlLoaded() ? _dlStore : null;
export const sseGrabber = (): GrabberPayload | null => _grabLoaded() ? _grabStore : null;

// ─── Message types ────────────────────────────────────────────────────────────

type SseServerMessage = SharedSseServerMessage<{
  downloadPackage: DownloadPackage;
  downloadLink: DownloadLink;
  grabberPackage: GrabberPackage;
  grabberLink: GrabberLink;
  dialog: JdDialog;
  captcha: JdCaptcha;
}>;

// One global seq across downloads + grabber. A delta whose seq isn't exactly
// lastSeq+1 (or a heartbeat reporting a higher seq than we've applied) means a
// message was dropped → the local store has drifted → force a full resync.
let lastSeq = 0;
// Server process id; seq numbers are only comparable within one epoch.
let epoch: string | null = null;

// Force a reconnect if no message arrives within this window. Derived from the
// server's heartbeat interval (hello); silence past it means a dead/half-open
// connection.
let watchdogMs = 12_500;

// ─── Delta application ────────────────────────────────────────────────────────

type Keyed = { uuid: number };

// Non-reactive uuid → array index, so deltas don't scan the store proxy.
type EntityIndex = { packages: Map<number, number>; links: Map<number, number> };

function indexOf(arr: Keyed[]): Map<number, number> {
  return new Map(arr.map((x, i) => [x.uuid, i]));
}

const dlIndex: EntityIndex = { packages: new Map(), links: new Map() };
const grabIndex: EntityIndex = { packages: new Map(), links: new Map() };

function removeEntities<T extends Keyed>(arr: T[], uuids: number[] | undefined): T[] | null {
  if (!uuids?.length) {
    return null;
  }
  const removed = new Set(uuids);
  return arr.filter(x => !removed.has(x.uuid));
}

function upsertEntities<T extends Keyed>(arr: T[], idx: Map<number, number>, items: T[] | undefined) {
  for (const item of items ?? []) {
    const i = idx.get(item.uuid);
    if (i !== undefined) {
      Object.assign(arr[i], item);
    } else {
      idx.set(item.uuid, arr.length);
      arr.push(item);
    }
  }
}

function applyEntityDelta<P extends Keyed, L extends Keyed>(
  s: { packages: P[]; links: L[] },
  index: EntityIndex,
  msg: EntityDelta<P, L>,
) {
  const pkgs = removeEntities(s.packages, msg.removedPackages);
  if (pkgs) {
    s.packages = pkgs;
    index.packages = indexOf(pkgs);
  }
  const links = removeEntities(s.links, msg.removedLinks);
  if (links) {
    s.links = links;
    index.links = indexOf(links);
  }
  upsertEntities(s.packages, index.packages, msg.packages);
  upsertEntities(s.links, index.links, msg.links);
}

function resetIndex(index: EntityIndex, payload: { packages: Keyed[]; links: Keyed[] }) {
  index.packages = indexOf(payload.packages);
  index.links = indexOf(payload.links);
}

// ─── Message dispatch ─────────────────────────────────────────────────────────

// Full snapshots re-baseline; a delta must be exactly lastSeq+1, else resync.
function acceptSeq(msg: { full: boolean; seq: number }): boolean {
  if (!msg.full && msg.seq !== lastSeq + 1) {
    resync();
    return false;
  }
  lastSeq = msg.seq;
  return true;
}

function dispatch(msg: SseServerMessage) {
  switch (msg.type) {
    case 'hello':
      if (msg.epoch !== epoch) {
        epoch = msg.epoch;
        lastSeq = 0;
      }
      watchdogMs = Math.round(msg.heartbeatMs * 2.5);
      petWatchdog();
      break;

    case 'health':
      setJdConnected(msg.jd);
      break;

    case 'downloads':
      if (!acceptSeq(msg)) {
        return;
      }
      if (msg.full) {
        setDlStore(reconcile(
          { packages: msg.packages, links: msg.links, state: msg.state, speed: msg.speed, exProgress: msg.exProgress },
          { key: 'uuid', merge: true },
        ));
        resetIndex(dlIndex, msg);
      } else {
        setDlStore(produce((s) => {
          applyEntityDelta(s, dlIndex, msg);
          if (msg.state !== undefined) {
            s.state = msg.state;
          }
          if (msg.speed !== undefined) {
            s.speed = msg.speed;
          }
          if (msg.exProgress !== undefined) {
            s.exProgress = msg.exProgress;
          }
        }));
      }
      if (!_dlLoaded()) {
        setDlLoaded(true);
      }
      break;

    case 'grabber':
      if (!acceptSeq(msg)) {
        return;
      }
      if (msg.full) {
        setGrabStore(reconcile(
          { packages: msg.packages, links: msg.links },
          { key: 'uuid', merge: true },
        ));
        resetIndex(grabIndex, msg);
      } else {
        setGrabStore(produce(s => applyEntityDelta(s, grabIndex, msg)));
      }
      if (!_grabLoaded()) {
        setGrabLoaded(true);
      }
      break;

    case 'notifications':
      applyNotificationsMessage({ dialogs: msg.dialogs, captchas: msg.captchas, updateAvailable: msg.updateAvailable });
      break;

    case 'heartbeat':
      // Server reports a higher seq than we've applied → we missed a message
      // (e.g. a lost last delta while idle) → resync. Equal means in sync.
      if (msg.epoch !== epoch || msg.seq > lastSeq) {
        resync();
      }
      break;
  }
}

// ─── Connection management ────────────────────────────────────────────────────

let es: EventSource | null = null;
let started = false;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function petWatchdog() {
  if (watchdog) {
    clearTimeout(watchdog);
  }
  watchdog = setTimeout(resync, watchdogMs);
}

// Tear down the current stream and reconnect. The fresh connection receives a full
// snapshot from the server, re-baselining the sequence numbers and healing any
// drift — whether from a dropped delta (seq gap) or a dead/half-open connection.
function resync() {
  closeSource();
  connect();
}

function closeSource() {
  es?.close();
  es = null;
}

function connect() {
  es = new EventSource('/api/sse', { withCredentials: true });
  petWatchdog();

  es.onopen = petWatchdog;

  es.onerror = () => {
    setJdConnected(null);
    // EventSource auto-reconnects on clean drops; the watchdog covers half-open ones.
  };

  for (const event of ['hello', 'health', 'downloads', 'grabber', 'notifications', 'heartbeat'] as const) {
    es.addEventListener(event, (e: MessageEvent) => {
      petWatchdog();
      try {
        const msg = JSON.parse(e.data as string) as SseServerMessage;
        dispatch(msg);
      } catch { /* ignore malformed messages */ }
    });
  }
}

// Close the stream after the tab has been hidden this long; the server stops its
// JD event listener once no client is connected.
const HIDDEN_DISCONNECT_MS = 60_000;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

function disconnect() {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
  closeSource();
  setJdConnected(null);
}

function onVisibilityChange() {
  if (document.hidden) {
    hiddenTimer ??= setTimeout(disconnect, HIDDEN_DISCONNECT_MS);
    return;
  }
  if (hiddenTimer) {
    clearTimeout(hiddenTimer);
    hiddenTimer = null;
  }
  if (es) {
    // Timers may fire late after a frozen tab resumes; give buffered events a
    // fresh window before declaring the connection dead.
    petWatchdog();
  } else {
    connect();
  }
}

export function startSse() {
  if (started) {
    return;
  }
  started = true;
  document.addEventListener('visibilitychange', onVisibilityChange);
  connect();
}

export function stopSse() {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (hiddenTimer) {
    clearTimeout(hiddenTimer);
    hiddenTimer = null;
  }
  disconnect();
  started = false;
}
