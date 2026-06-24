import type { DownloadLink, DownloadPackage, GrabberLink, GrabberPackage, JdCaptcha, JdDialog } from '../lib/api';
import { createSignal } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import { setJdConnected } from './jd';
import { applyNotificationsMessage } from './notifications';

// ─── Per-topic signals (fed by SSE pushes) ───────────────────────────────────

export type DownloadsPayload = {
  packages: DownloadPackage[];
  links: DownloadLink[];
  state: string;
  speed: number;
  exProgress: Record<number, number>;
};

export type GrabberPayload = {
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

export const [sseConnected, setSseConnected] = createSignal(false);

// ─── Message types ────────────────────────────────────────────────────────────

type SseServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; full: true; seq: number; packages: DownloadPackage[]; links: DownloadLink[]; state: string; speed: number; exProgress: Record<number, number> }
    | { type: 'downloads'; full: false; seq: number; packages?: DownloadPackage[]; removedPackages?: number[]; links?: DownloadLink[]; removedLinks?: number[]; state?: string; speed?: number; exProgress?: Record<number, number> }
    | { type: 'grabber'; full: true; seq: number; packages: GrabberPackage[]; links: GrabberLink[] }
    | { type: 'grabber'; full: false; seq: number; packages?: GrabberPackage[]; removedPackages?: number[]; links?: GrabberLink[]; removedLinks?: number[] }
    | { type: 'notifications'; dialogs: JdDialog[]; captchas: JdCaptcha[]; updateAvailable: boolean }
    | { type: 'heartbeat'; seq: number };

// One global seq across downloads + grabber. A delta whose seq isn't exactly
// lastSeq+1 (or a heartbeat reporting a higher seq than we've applied) means a
// message was dropped → the local store has drifted → force a full resync.
let lastSeq = 0;

// ─── Message dispatch ─────────────────────────────────────────────────────────

function dispatch(msg: SseServerMessage) {
  switch (msg.type) {
    case 'health':
      setJdConnected(msg.jd);
      break;

    case 'downloads':
      if (msg.full) {
        lastSeq = msg.seq;
        setDlStore(reconcile(
          { packages: msg.packages, links: msg.links, state: msg.state, speed: msg.speed, exProgress: msg.exProgress },
          { key: 'uuid', merge: true },
        ));
      } else {
        if (msg.seq !== lastSeq + 1) {
          resync();
          return;
        }
        lastSeq = msg.seq;
        setDlStore(produce((s) => {
          if (msg.removedPackages?.length) {
            s.packages = s.packages.filter(p => !msg.removedPackages!.includes(p.uuid));
          }
          if (msg.removedLinks?.length) {
            s.links = s.links.filter(l => !msg.removedLinks!.includes(l.uuid));
          }
          for (const pkg of msg.packages ?? []) {
            const i = s.packages.findIndex(p => p.uuid === pkg.uuid);
            if (i >= 0) {
              s.packages[i] = pkg;
            } else {
              s.packages.push(pkg);
            }
          }
          for (const lnk of msg.links ?? []) {
            const i = s.links.findIndex(l => l.uuid === lnk.uuid);
            if (i >= 0) {
              s.links[i] = lnk;
            } else {
              s.links.push(lnk);
            }
          }
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
      if (msg.full) {
        lastSeq = msg.seq;
        setGrabStore(reconcile(
          { packages: msg.packages, links: msg.links },
          { key: 'uuid', merge: true },
        ));
      } else {
        if (msg.seq !== lastSeq + 1) {
          resync();
          return;
        }
        lastSeq = msg.seq;
        setGrabStore(produce((s) => {
          if (msg.removedPackages?.length) {
            s.packages = s.packages.filter(p => !msg.removedPackages!.includes(p.uuid));
          }
          if (msg.removedLinks?.length) {
            s.links = s.links.filter(l => !msg.removedLinks!.includes(l.uuid));
          }
          for (const pkg of msg.packages ?? []) {
            const i = s.packages.findIndex(p => p.uuid === pkg.uuid);
            if (i >= 0) {
              s.packages[i] = pkg;
            } else {
              s.packages.push(pkg);
            }
          }
          for (const lnk of msg.links ?? []) {
            const i = s.links.findIndex(l => l.uuid === lnk.uuid);
            if (i >= 0) {
              s.links[i] = lnk;
            } else {
              s.links.push(lnk);
            }
          }
        }));
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
      if (msg.seq > lastSeq) {
        resync();
      }
      break;
  }
}

// ─── Connection management ────────────────────────────────────────────────────

// Force a reconnect if no message arrives within this window. The server sends a
// heartbeat every 5s, so silence past this means a dead/half-open connection.
const WATCHDOG_MS = 11_000;

let es: EventSource | null = null;
let started = false;
let watchdog: ReturnType<typeof setTimeout> | null = null;

function petWatchdog() {
  if (watchdog) {
    clearTimeout(watchdog);
  }
  watchdog = setTimeout(resync, WATCHDOG_MS);
}

// Tear down the current stream and reconnect. The fresh connection receives a full
// snapshot from the server, re-baselining the sequence numbers and healing any
// drift — whether from a dropped delta (seq gap) or a dead/half-open connection.
function resync() {
  if (es) {
    es.close();
    es = null;
  }
  connect();
}

function connect() {
  es = new EventSource('/api/sse', { withCredentials: true });
  petWatchdog();

  es.onopen = () => {
    setSseConnected(true);
    petWatchdog();
  };

  es.onerror = () => {
    setSseConnected(false);
    setJdConnected(null);
    // EventSource auto-reconnects on clean drops; the watchdog covers half-open ones.
  };

  for (const event of ['health', 'downloads', 'grabber', 'notifications', 'heartbeat'] as const) {
    es.addEventListener(event, (e: MessageEvent) => {
      petWatchdog();
      try {
        const msg = JSON.parse(e.data as string) as SseServerMessage;
        dispatch(msg);
      } catch { /* ignore malformed messages */ }
    });
  }
}

export function startSse() {
  if (started) {
    return;
  }
  started = true;
  connect();
}

export function stopSse() {
  if (watchdog) {
    clearTimeout(watchdog);
    watchdog = null;
  }
  if (es) {
    es.close();
    es = null;
  }
  started = false;
  setSseConnected(false);
  setJdConnected(null);
}
