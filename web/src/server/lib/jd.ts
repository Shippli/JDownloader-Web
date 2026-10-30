import process from 'node:process';
import { getAppSetting, setAppSetting } from '../db/appSettings';

const RETRY_AFTER_MS = 30_000;

const CONN_REFUSED_CODES = new Set(['ECONNREFUSED', 'ConnectionRefused', 'ECONNRESET']);
const JD_CONN_ERROR_CODES = new Set([...CONN_REFUSED_CODES, 'JD_UNAVAILABLE', 'JD_NOT_CONFIGURED']);

const errorCode = (e: unknown) => (e as { code?: string })?.code ?? '';

function isConnRefused(e: unknown): boolean {
  return CONN_REFUSED_CODES.has(errorCode(e));
}

export function isJdConnError(e: unknown): boolean {
  return JD_CONN_ERROR_CODES.has(errorCode(e));
}

async function postJd(baseUrl: string, path: string, params: unknown[], rid: number, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      apiVer: 1,
      url: path,
      params: adaptParams(params),
      rid,
    }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`JD API error: ${res.status}`), { status: res.status, body: err });
  }

  const text = await res.text();
  if (!text) {
    return null;
  }
  const json = JSON.parse(text);
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function adaptParams(params: unknown[]): unknown[] {
  return params.map((param) => {
    if (typeof param === 'string') {
      return param;
    }
    if (Array.isArray(param)) {
      return adaptParams(param);
    }
    if (param !== null && typeof param === 'object') {
      return param;
    }
    if (typeof param === 'boolean' || typeof param === 'number') {
      return JSON.stringify(param);
    }
    if (param === null) {
      return null;
    }
    return String(param);
  });
}

class JDownloaderClient {
  private host: string;
  private port: string;
  private available = true;
  private unavailableSince: number | null = null;
  private requestId = Date.now();
  private autoUpdateEnabled = false;
  private autoUpdateTriggered = false;

  constructor(host: string, port: string) {
    this.host = host;
    this.port = port;
    this.loadFromDb();
  }

  private loadFromDb() {
    const h = getAppSetting('jd_host');
    const p = getAppSetting('jd_port');
    if (h) {
      this.host = h;
    }
    if (p) {
      this.port = p;
    }
    this.autoUpdateEnabled = getAppSetting('auto_update_enabled') === 'true';
  }

  isConfigured(): boolean {
    return this.host.trim() !== '' && this.port.trim() !== '';
  }

  private get baseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  // Throws if unconfigured; trips the breaker on connection-level errors.
  private async send(path: string, params: unknown[], signal?: AbortSignal): Promise<unknown> {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('JDownloader not configured'), { code: 'JD_NOT_CONFIGURED', status: 503 });
    }
    try {
      return await postJd(this.baseUrl, path, params, ++this.requestId, signal);
    } catch (e) {
      if (isConnRefused(e)) {
        this.setAvailable(false);
      }
      throw e;
    }
  }

  async call(path: string, params: unknown[] = []): Promise<unknown> {
    if (this.isConfigured() && !this.available) {
      // Auto-retry after RETRY_AFTER_MS to allow recovery without manual intervention
      if (this.unavailableSince !== null && Date.now() - this.unavailableSince > RETRY_AFTER_MS) {
        this.available = true;
        this.unavailableSince = null;
      } else {
        throw Object.assign(new Error('JDownloader unavailable'), { code: 'JD_UNAVAILABLE', status: 503 });
      }
    }
    return this.send(path, params);
  }

  // Long-poll variant for /events/listen. Bypasses the circuit breaker's
  // availability short-circuit: a listen call parked for up to ~25 s (JD's
  // server-side pollTimeout) is normal operation, and the dedicated event
  // listener loop does its own backoff on failures. Connection-level errors
  // still trip the breaker so regular calls fail fast.
  async callLongPoll(path: string, params: unknown[] = [], timeoutMs = 35_000, signal?: AbortSignal): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException('listen timeout', 'TimeoutError')), timeoutMs);
    const onAbort = () => ctrl.abort(signal?.reason);
    signal?.addEventListener('abort', onAbort, { once: true });
    try {
      return await this.send(path, params, ctrl.signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  // Probes JD directly, bypassing the circuit breaker.
  async healthCheck(): Promise<void> {
    this.setAvailable(this.isConfigured() && await probeJd(this.host, this.port));
  }

  getConnection() {
    return { host: this.host, port: this.port };
  }

  setConnection(host: string, port: string) {
    this.host = host;
    this.port = port;
    setAppSetting('jd_host', host);
    setAppSetting('jd_port', port);
  }

  isAutoUpdateEnabled(): boolean {
    return this.autoUpdateEnabled;
  }

  setAutoUpdateEnabled(v: boolean) {
    this.autoUpdateEnabled = v;
    setAppSetting('auto_update_enabled', String(v));
  }

  // Called by the auto-update tick (see broadcaster.ts) with the current
  // update-availability and idle state.
  // Fires the actual update+restart at most once per update becoming available,
  // and re-arms once it's gone.
  async checkAutoUpdate(idle: boolean, updateAvailable: boolean): Promise<void> {
    if (!updateAvailable) {
      this.autoUpdateTriggered = false;
      return;
    }
    if (!this.autoUpdateEnabled || this.autoUpdateTriggered || !idle) {
      return;
    }
    this.autoUpdateTriggered = true;
    try {
      await this.call('/update/restartAndUpdate');
    } catch {
      this.autoUpdateTriggered = false;
    }
  }

  setAvailable(v: boolean) {
    this.available = v;
    this.unavailableSince = v
      ? null
      : (this.unavailableSince ?? Date.now());
  }

  isAvailable() {
    return this.available;
  }
}

// Probes an arbitrary JD instance; throws on failure.
export async function probeJdOrThrow(host: string, port: string, timeoutMs?: number): Promise<void> {
  await postJd(`http://${host}:${port}`, '/jd/version', [], Date.now(), timeoutMs
    ? AbortSignal.timeout(timeoutMs)
    : undefined);
}

async function probeJd(host: string, port: string): Promise<boolean> {
  return probeJdOrThrow(host, port).then(() => true, () => false);
}

export const jd = new JDownloaderClient(
  process.env.JDOWNLOADER_HOST ?? '',
  process.env.JDOWNLOADER_PORT ?? '',
);

// ─── Default Query Objects ────────────────────────────────────────────────────

const PAGE_ALL = { maxResults: -1, startAt: 0 };
const COMMON_FIELDS = {
  bytesTotal: true,
  status: true,
  comment: true,
  enabled: true,
  priority: true,
};
const DOWNLOAD_FIELDS = {
  ...COMMON_FIELDS,
  bytesLoaded: true,
  speed: true,
  eta: true,
  finished: true,
};

export const DEFAULT_PACKAGE_QUERY = {
  ...PAGE_ALL,
  ...DOWNLOAD_FIELDS,
  hosts: true,
  childCount: true,
};

export const DEFAULT_LINK_QUERY = {
  ...PAGE_ALL,
  ...DOWNLOAD_FIELDS,
  host: true,
  url: true,
};

export const EXTRACTION_STATUS_QUERY = { ...PAGE_ALL, status: true };

export const DEFAULT_GRABBER_PACKAGE_QUERY = {
  ...PAGE_ALL,
  ...COMMON_FIELDS,
  hosts: true,
  childCount: true,
};

export const DEFAULT_GRABBER_LINK_QUERY = {
  ...PAGE_ALL,
  ...COMMON_FIELDS,
  host: true,
  url: true,
  availability: true,
  name: true,
};

export const DEFAULT_ACCOUNTS_QUERY = {
  ...PAGE_ALL,
  enabled: true,
  error: true,
  trafficLeft: true,
  trafficMax: true,
  userName: true,
  valid: true,
  validUntil: true,
};

export const DEFAULT_EXTENSIONS_QUERY = {
  configInterface: true,
  description: true,
  enabled: true,
  iconKey: true,
  id: true,
  installed: true,
  name: true,
};
