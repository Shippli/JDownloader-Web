import type { DownloadLink, DownloadPackage, GrabberLink, GrabberPackage, JdCaptcha, JdDialog } from '../lib/api';
import { createSignal } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
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

// ─── Message dispatch ─────────────────────────────────────────────────────────

type SseServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; packages: DownloadPackage[]; links: DownloadLink[]; state: string; speed: number; exProgress: Record<number, number> }
    | { type: 'grabber'; packages: GrabberPackage[]; links: GrabberLink[] }
    | { type: 'notifications'; dialogs: JdDialog[]; captchas: JdCaptcha[]; updateAvailable: boolean };

function dispatch(msg: SseServerMessage) {
  switch (msg.type) {
    case 'health':
      setJdConnected(msg.jd);
      break;
    case 'downloads':
      setDlStore(reconcile(
        { packages: msg.packages, links: msg.links, state: msg.state, speed: msg.speed, exProgress: msg.exProgress },
        { key: 'uuid', merge: true },
      ));
      if (!_dlLoaded()) {
        setDlLoaded(true);
      }
      break;
    case 'grabber':
      setGrabStore(reconcile(
        { packages: msg.packages, links: msg.links },
        { key: 'uuid', merge: true },
      ));
      if (!_grabLoaded()) {
        setGrabLoaded(true);
      }
      break;
    case 'notifications':
      applyNotificationsMessage({ dialogs: msg.dialogs, captchas: msg.captchas, updateAvailable: msg.updateAvailable });
      break;
  }
}

// ─── Connection management ────────────────────────────────────────────────────

let es: EventSource | null = null;
let started = false;

function connect() {
  es = new EventSource('/api/sse', { withCredentials: true });

  es.onopen = () => setSseConnected(true);

  es.onerror = () => {
    setSseConnected(false);
    setJdConnected(null);
    // EventSource auto-reconnects — no manual retry needed
  };

  for (const event of ['health', 'downloads', 'grabber', 'notifications'] as const) {
    es.addEventListener(event, (e: MessageEvent) => {
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
