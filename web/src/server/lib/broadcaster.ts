import {
  DEFAULT_GRABBER_LINK_QUERY,
  DEFAULT_GRABBER_PACKAGE_QUERY,
  DEFAULT_LINK_QUERY,
  DEFAULT_PACKAGE_QUERY,
  jd as jdClient,
} from './jd';

// ─── Message types ────────────────────────────────────────────────────────────

export type SseServerMessage
  = | { type: 'health'; jd: boolean }
    | { type: 'downloads'; packages: unknown[]; links: unknown[]; state: string; speed: number; exProgress: Record<number, number> }
    | { type: 'grabber'; packages: unknown[]; links: unknown[] }
    | { type: 'notifications'; dialogs: unknown[]; captchas: unknown[]; updateAvailable: boolean };

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

  const progress: Record<number, number> = {};
  for (const [uuid, entry] of extractStartMap) {
    const l = (links as Array<{ uuid: number; eta?: number }>).find(x => x.uuid === uuid);
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

export function addSseClient(writer: SseWriter) {
  clients.add(writer);
  void pollHealth();
  void pollDownloads();
  void pollGrabber();
  void pollNotifications();
}

export function removeSseClient(writer: SseWriter) {
  clients.delete(writer);
}

function broadcast(msg: SseServerMessage) {
  const data = JSON.stringify(msg);
  for (const write of clients) {
    write(msg.type, data);
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
    const linkArr = Array.isArray(links) ? links : [];
    broadcast({
      type: 'downloads',
      packages: Array.isArray(packages) ? packages : [],
      links: linkArr,
      state: (state as string) ?? 'IDLE',
      speed: (speed as number) ?? 0,
      exProgress: updateExtractionProgress(linkArr),
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

// ─── Start ────────────────────────────────────────────────────────────────────

export function startBroadcaster() {
  void pollHealth();
  setInterval(() => void pollHealth(), 5_000);
  setInterval(() => void pollDownloads(), 2_000);
  setInterval(() => void pollGrabber(), 3_000);
  setInterval(() => void pollNotifications(), 5_000);
}
