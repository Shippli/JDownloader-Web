import type { DownloadLink, DownloadPackage, GrabberLink, GrabberPackage, JdCaptcha, JdDialog } from '../lib/api';
import { createSignal } from 'solid-js';
import { setJdConnected } from './jd';
import { applyNotificationsMessage } from './notifications';

// ─── Per-topic signals (fed by WS pushes) ────────────────────────────────────

export type DownloadsPayload = {
  packages: DownloadPackage[];
  links: DownloadLink[];
  state: string;
  speed: number;
};

export type GrabberPayload = {
  packages: GrabberPackage[];
  links: GrabberLink[];
};

export const [wsDownloads, setWsDownloads] = createSignal<DownloadsPayload | null>(null);
export const [wsGrabber, setWsGrabber] = createSignal<GrabberPayload | null>(null);
export const [wsConnected, setWsConnected] = createSignal(false);

// ─── Message dispatch ─────────────────────────────────────────────────────────

type WsServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; packages: DownloadPackage[]; links: DownloadLink[]; state: string; speed: number }
    | { type: 'grabber'; packages: GrabberPackage[]; links: GrabberLink[] }
    | { type: 'notifications'; dialogs: JdDialog[]; captchas: JdCaptcha[]; updateAvailable: boolean };

function dispatch(msg: WsServerMessage) {
  switch (msg.type) {
    case 'health':
      setJdConnected(msg.jd);
      break;
    case 'downloads':
      setWsDownloads({ packages: msg.packages, links: msg.links, state: msg.state, speed: msg.speed });
      break;
    case 'grabber':
      setWsGrabber({ packages: msg.packages, links: msg.links });
      break;
    case 'notifications':
      applyNotificationsMessage({ dialogs: msg.dialogs, captchas: msg.captchas, updateAvailable: msg.updateAvailable });
      break;
  }
}

// ─── Connection management ────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let retryDelay = 1000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In dev mode (Vite), connect directly to the backend — Vite's WS proxy
  // is unreliable for app WS connections alongside its own HMR socket.
  if (import.meta.env.DEV) {
    return `${proto}//localhost:3001/ws`;
  }
  return `${proto}//${location.host}/ws`;
}

function scheduleReconnect() {
  if (retryTimer !== null) {
    return;
  }
  retryTimer = setTimeout(connect, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30_000);
}

function connect() {
  retryTimer = null;
  ws = new WebSocket(getWsUrl());

  ws.onopen = () => {
    setWsConnected(true);
    retryDelay = 1000;
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string) as WsServerMessage;
      dispatch(msg);
    } catch { /* ignore malformed messages */ }
  };

  ws.onclose = () => {
    setWsConnected(false);
    ws = null;
    setJdConnected(null);
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose fires after onerror — reconnect is handled there
  };
}

export function startWs() {
  if (started) {
    return;
  }
  started = true;
  connect();
}

export function sendRefresh(topic: 'downloads' | 'grabber' | 'notifications') {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'refresh', topic }));
  }
}
