import process from 'node:process';
import { sqlite } from '../db/index';

const NULL_STRING_RE = /"null"/g;

const RETRY_AFTER_MS = 30_000;

export class JDownloaderClient {
  private host: string;
  private port: string;
  private available = true;
  private unavailableSince: number | null = null;
  private requestId = Date.now();

  constructor(host: string, port: string) {
    this.host = host;
    this.port = port;
    this.loadFromDb();
  }

  private loadFromDb() {
    try {
      const h = (sqlite.query('SELECT value FROM app_settings WHERE key = \'jd_host\'').get() as { value: string } | null)?.value;
      const p = (sqlite.query('SELECT value FROM app_settings WHERE key = \'jd_port\'').get() as { value: string } | null)?.value;
      if (h) {
        this.host = h;
      }
      if (p) {
        this.port = p;
      }
    } catch { /* table may not exist yet on very first run */ }
  }

  isConfigured(): boolean {
    return this.host.trim() !== '' && this.port.trim() !== '';
  }

  private get baseUrl() {
    return `http://${this.host}:${this.port}`;
  }

  private nextRid(): number {
    return ++this.requestId;
  }

  private adaptParams(params: unknown[]): unknown[] {
    return params.map((param) => {
      if (typeof param === 'string') {
        return param;
      }
      if (Array.isArray(param)) {
        return this.adaptParams(param);
      }
      if (param !== null && typeof param === 'object') {
        return param;
      }
      if (typeof param === 'boolean' || typeof param === 'number') {
        return JSON.stringify(param);
      }
      if (param === null) {
        return 'null';
      }
      return String(param);
    });
  }

  private isConnRefused(e: unknown): boolean {
    const code = (e as { code?: string })?.code ?? '';
    return code === 'ConnectionRefused' || code === 'ECONNREFUSED' || code === 'ECONNRESET';
  }

  private async post(path: string, params: unknown[]): Promise<unknown> {
    const rid = this.nextRid();
    const adapted = this.adaptParams(params);
    const payload: Record<string, unknown> = { apiVer: 1, url: path, params: adapted, rid };
    let body = JSON.stringify(payload);
    body = body.replace(NULL_STRING_RE, 'null');

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body,
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

  async call(path: string, params: unknown[] = []): Promise<unknown> {
    if (!this.isConfigured()) {
      throw Object.assign(new Error('JDownloader not configured'), { code: 'JD_NOT_CONFIGURED', status: 503 });
    }
    if (!this.available) {
      // Auto-retry after RETRY_AFTER_MS to allow recovery without manual intervention
      if (this.unavailableSince !== null && Date.now() - this.unavailableSince > RETRY_AFTER_MS) {
        this.available = true;
        this.unavailableSince = null;
      } else {
        throw Object.assign(new Error('JDownloader unavailable'), { code: 'JD_UNAVAILABLE', status: 503 });
      }
    }
    try {
      return await this.post(path, params);
    } catch (e) {
      if (this.isConnRefused(e)) {
        this.available = false;
        this.unavailableSince = Date.now();
      }
      throw e;
    }
  }

  // Probe JD directly, bypassing the circuit breaker — used by the health check.
  async probe(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    try {
      await this.post('/jd/version', []);
      return true;
    } catch {
      return false;
    }
  }

  async healthCheck(): Promise<void> {
    const ok = await this.probe();
    this.available = ok;
    this.unavailableSince = ok ? null : (this.unavailableSince ?? Date.now());
  }

  getConnection() {
    return { host: this.host, port: this.port };
  }

  setConnection(host: string, port: string) {
    this.host = host;
    this.port = port;
    sqlite.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (\'jd_host\', ?)', [host]);
    sqlite.run('INSERT OR REPLACE INTO app_settings (key, value) VALUES (\'jd_port\', ?)', [port]);
  }

  setAvailable(v: boolean) {
    this.available = v;
    this.unavailableSince = v ? null : (this.unavailableSince ?? Date.now());
  }

  isAvailable() {
    return this.available;
  }
}

export const jd = new JDownloaderClient(
  process.env.JDOWNLOADER_HOST ?? '',
  process.env.JDOWNLOADER_PORT ?? '',
);

// ─── Default Query Objects ────────────────────────────────────────────────────

export const DEFAULT_PACKAGE_QUERY = {
  maxResults: -1,
  startAt: 0,
  bytesLoaded: true,
  bytesTotal: true,
  speed: true,
  eta: true,
  status: true,
  hosts: true,
  finished: true,
  enabled: true,
  priority: true,
  childCount: true,
  comment: true,
};

export const DEFAULT_LINK_QUERY = {
  maxResults: -1,
  startAt: 0,
  bytesLoaded: true,
  bytesTotal: true,
  speed: true,
  eta: true,
  status: true,
  host: true,
  finished: true,
  enabled: true,
  priority: true,
  url: true,
  comment: true,
};

export const DEFAULT_GRABBER_PACKAGE_QUERY = {
  maxResults: -1,
  startAt: 0,
  bytesTotal: true,
  status: true,
  hosts: true,
  childCount: true,
  comment: true,
  enabled: true,
  priority: true,
};

export const DEFAULT_GRABBER_LINK_QUERY = {
  maxResults: -1,
  startAt: 0,
  bytesTotal: true,
  status: true,
  host: true,
  url: true,
  comment: true,
  availability: true,
  name: true,
  enabled: true,
  priority: true,
};

export const DEFAULT_ACCOUNTS_QUERY = {
  enabled: true,
  error: true,
  maxResults: -1,
  startAt: 0,
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

export const DEFAULT_PLUGINS_QUERY = {
  abstractType: true,
  className: true,
  defaultValue: true,
  displayName: true,
  docs: true,
  enumLabel: true,
  enumOptions: true,
  interfaceName: true,
  key: true,
  pattern: true,
  storage: true,
  type: true,
  value: true,
  version: true,
};
