import type { ServerWebSocket, WebSocketHandler } from 'bun';
import {
  DEFAULT_GRABBER_LINK_QUERY,
  DEFAULT_GRABBER_PACKAGE_QUERY,
  DEFAULT_LINK_QUERY,
  DEFAULT_PACKAGE_QUERY,
  jd as jdClient,
} from './jd';

// ─── Message types ────────────────────────────────────────────────────────────

export type WsServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; packages: unknown[]; links: unknown[]; state: string; speed: number }
    | { type: 'grabber'; packages: unknown[]; links: unknown[] }
    | { type: 'notifications'; dialogs: unknown[]; captchas: unknown[]; updateAvailable: boolean };

type WsClientMessage = { type: 'refresh'; topic: 'downloads' | 'grabber' | 'notifications' };

// ─── Client registry ──────────────────────────────────────────────────────────

const clients = new Set<ServerWebSocket<unknown>>();

function broadcast(msg: WsServerMessage) {
  const text = JSON.stringify(msg);
  for (const ws of clients) {
    ws.send(text);
  }
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

// ─── Poll functions ───────────────────────────────────────────────────────────

async function pollHealth() {
  try {
    await jdClient.healthCheck();
    broadcast({ type: 'health', jd: jdClient.isConfigured() && jdClient.isAvailable() });
  } catch {
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
    broadcast({
      type: 'downloads',
      packages: Array.isArray(packages) ? packages : [],
      links: Array.isArray(links) ? links : [],
      state: (state as string) ?? 'IDLE',
      speed: (speed as number) ?? 0,
    });
  } catch (e) {
    if (isJdConnErr(e)) {
      broadcast({ type: 'health', jd: false });
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
    broadcast({
      type: 'grabber',
      packages: Array.isArray(packages) ? packages : [],
      links: Array.isArray(links) ? links : [],
    });
  } catch (e) {
    if (isJdConnErr(e)) {
      broadcast({ type: 'health', jd: false });
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

    broadcast({ type: 'notifications', dialogs, captchas, updateAvailable });
  } catch (e) {
    if (isJdConnErr(e)) {
      broadcast({ type: 'health', jd: false });
    }
  }
}

// ─── WebSocket handler ────────────────────────────────────────────────────────

export const websocketHandler: WebSocketHandler<unknown> = {
  open(ws) {
    clients.add(ws);
    // Immediately push current state to all clients (new client gets it, others get a refresh)
    void pollHealth();
    void pollDownloads();
    void pollGrabber();
    void pollNotifications();
  },
  close(ws) {
    clients.delete(ws);
  },
  message(_ws, raw) {
    try {
      const msg = JSON.parse(String(raw)) as WsClientMessage;
      if (msg.type === 'refresh') {
        if (msg.topic === 'downloads') {
          void pollDownloads();
        } else if (msg.topic === 'grabber') {
          void pollGrabber();
        } else if (msg.topic === 'notifications') {
          void pollNotifications();
        }
      }
    } catch { /* ignore malformed messages */ }
  },
};

// ─── Start ────────────────────────────────────────────────────────────────────

export function startBroadcaster() {
  void pollHealth();
  setInterval(() => void pollHealth(), 5_000);
  setInterval(() => void pollDownloads(), 2_000);
  setInterval(() => void pollGrabber(), 3_000);
  setInterval(() => void pollNotifications(), 5_000);
}
