// API client - communicates with our HonoJS backend
import { debugStore } from '../stores/debug';

const BASE = '/api';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = options?.method ?? 'GET';
  const startMs = performance.now();
  let body: unknown;
  if (options?.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = options.body;
    }
  }

  if (debugStore.enabled()) {
    console.warn(`[API] ${method} ${path}`);
    if (body !== undefined) {
      console.warn('  body →', body);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    if (debugStore.enabled()) {
      const ms = (performance.now() - startMs).toFixed(1);
      console.warn(`  ${res.status} ${res.statusText} (${ms} ms)`);
      console.warn('  error →', err);
    }
    throw Object.assign(new Error((err as { error?: string }).error ?? `HTTP ${res.status}`), { status: res.status });
  }

  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as T;

  if (debugStore.enabled()) {
    const ms = (performance.now() - startMs).toFixed(1);
    console.warn(`  ${res.status} OK (${ms} ms)`);
    console.warn('  data ←', data);
  }

  return data;
}

function get<T>(path: string) {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function patch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' });
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export const authApi = {
  checkUsers: () => get<{ hasUsers: boolean }>('/auth/check-users'),
  signIn: (email: string, password: string) =>
    post<{ user: User; session: { token: string } }>('/auth/sign-in/email', { email, password }),
  signUp: (email: string, password: string, name: string) =>
    post<{ user: User; session: { token: string } }>('/auth/sign-up/email', { email, password, name }),
  getSession: () => get<{ user: User; session: object } | null>('/auth/get-session'),
  signOut: () => post('/auth/sign-out'),
};

// ─── Users ────────────────────────────────────────────────────────────────

export const userApi = {
  list: () => get<UserRecord[]>('/users'),
  create: (data: { name: string; email: string; password: string }) => post<{ ok: boolean }>('/users', data),
  update: (id: string, data: { name: string; email: string }) => patch<{ ok: boolean }>(`/users/${id}`, data),
  changePassword: (id: string, password: string) => patch<{ ok: boolean }>(`/users/${id}/password`, { password }),
  delete: (id: string) => del<{ ok: boolean }>(`/users/${id}`),
};

// ─── JDownloader ──────────────────────────────────────────────────────────

export const jdApi = {
  // Controller
  start: () => post('/jd/controller/start'),
  stop: () => post('/jd/controller/stop'),
  pause: (value: boolean) => post('/jd/controller/pause', { value }),

  // Downloads
  forceDownload: (linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/force', { linkIds, packageIds }),
  resetDownloads: (linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/reset', { linkIds, packageIds }),
  cleanupDownloads: (linkIds: number[], packageIds: number[], deleteFiles: boolean) =>
    post('/jd/downloads/cleanup', { linkIds, packageIds, deleteFiles }),
  enableDownloads: (enabled: boolean, linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/enable', { enabled, linkIds, packageIds }),

  // Link Grabber
  addLinks: (params: AddLinksParams) => post('/jd/grabber/add', params),
  addContainer: (type: string, content: string) =>
    post('/jd/grabber/addContainer', { type, content }),
  moveToDownloads: (linkIds: number[], packageIds: number[]) =>
    post('/jd/grabber/move', { linkIds, packageIds }),
  removeGrabber: (linkIds: number[], packageIds: number[]) =>
    post('/jd/grabber/remove', { linkIds, packageIds }),
  renameGrabberPackage: (uuid: number, name: string) =>
    patch(`/jd/grabber/packages/${uuid}/name`, { name }),
  enableGrabber: (enabled: boolean, linkIds: number[], packageIds: number[]) =>
    post('/jd/grabber/enable', { enabled, linkIds, packageIds }),
  setGrabberPriority: (priority: string, linkIds: number[], packageIds: number[]) =>
    post('/jd/grabber/priority', { priority, linkIds, packageIds }),
  checkGrabberLinks: (linkIds: number[], packageIds: number[]) =>
    post('/jd/grabber/check', { linkIds, packageIds }),

  // Downloads extras
  setDownloadPriority: (priority: string, linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/priority', { priority, linkIds, packageIds }),
  checkDownloadLinks: (linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/check', { linkIds, packageIds }),
  renameDownloadPackage: (uuid: number, name: string) =>
    patch(`/jd/downloads/packages/${uuid}/name`, { name }),
  extractArchive: (linkIds: number[], packageIds: number[]) =>
    post('/jd/downloads/extract', { linkIds, packageIds }),
};

// ─── Config API ───────────────────────────────────────────────────────────

export const configApi = {
  // Accounts
  listPremiumHosters: () => get<string[]>('/jd/accounts/hosters'),
  listAccounts: () => get<JdAccount[]>('/jd/accounts'),
  enableAccounts: (ids: number[]) => post('/jd/accounts/enable', { ids }),
  disableAccounts: (ids: number[]) => post('/jd/accounts/disable', { ids }),
  refreshAccounts: (ids: number[]) => post('/jd/accounts/refresh', { ids }),
  addAccount: (hoster: string, username: string, password: string) =>
    post('/jd/accounts/add', { hoster, username, password }),
  deleteAccount: (id: number) =>
    request(`/jd/accounts/${id}`, { method: 'DELETE' }),
  setCredentials: (id: number, username: string, password: string) =>
    request(`/jd/accounts/${id}/credentials`, {
      method: 'PATCH',
      body: JSON.stringify({ username, password }),
    }),

  // Settings (/config namespace)
  listSettings: (pattern?: string) =>
    get<ConfigEntry[]>(`/jd/settings/list${pattern ? `?pattern=${encodeURIComponent(pattern)}` : ''}`),
  setSetting: (entry: { interfaceName: string; storage?: string; key: string; value: unknown }) =>
    post('/jd/settings/set', entry),
  resetSetting: (entry: { interfaceName: string; storage?: string; key: string }) =>
    post('/jd/settings/reset', entry),

  // Connection
  getConnection: () => get<{ host: string; port: string; configured: boolean }>('/jd/connection'),
  setConnection: (host: string, port: string) => post('/jd/connection', { host, port }),
  testConnection: () => post<{ ok: boolean; error?: string }>('/jd/connection/test'),

  // JD Info
  getInfo: () => get<JdInfo>('/jd/info'),

  // Download config
  getDownloadConfig: () => get<DownloadConfig>('/jd/downloads/dlconfig'),
  setDownloadConfig: (key: string, value: unknown) => post('/jd/downloads/dlconfig', { key, value }),

  // Storage
  getStorageInfos: () => get<StorageInfo[]>('/jd/storage'),

  // Update / System Actions
  runUpdateCheck: () => post('/jd/system/run-update-check'),
  restartJD: () => post('/jd/system/restart'),
  restartAndUpdate: () => post('/jd/system/restart-and-update'),
};

// ─── Extensions API ───────────────────────────────────────────────────────

export const extensionsApi = {
  listExtensions: () => get<ExtensionEntry[]>('/jd/extensions/list'),
  toggleExtension: (id: string, enabled: boolean) =>
    post('/jd/extensions/toggle', { id, enabled }),
};

// ─── Plugins API ──────────────────────────────────────────────────────────

export const pluginsApi = {
  listPlugins: () => get<PluginEntry[]>('/jd/plugins/list'),
  setPlugin: (entry: { interfaceName: string; storage?: string; key: string; value: unknown }) =>
    post('/jd/plugins/set', entry),
  resetPlugin: (entry: { interfaceName: string; storage?: string; key: string }) =>
    post('/jd/plugins/reset', entry),
};

// ─── Dialogs API ──────────────────────────────────────────────────────────

export const dialogsApi = {
  list: () => get<JdDialog[]>('/jd/dialogs'),
  get: (id: number) => get<JdDialogDetail>(`/jd/dialogs/${id}`),
  answer: (id: number, data: unknown) => post(`/jd/dialogs/${id}/answer`, data),
};

// ─── Captcha API ──────────────────────────────────────────────────────────

export const captchaApi = {
  list: () => get<JdCaptcha[]>('/jd/captcha'),
  get: (id: number) => get<JdCaptchaDetail>(`/jd/captcha/${id}`),
  solve: (id: number, solution: string) => post(`/jd/captcha/${id}/solve`, { solution }),
};

// ─── Types ────────────────────────────────────────────────────────────────

export type User = {
  id: string;
  email: string;
  name: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
};

export type DownloadPackage = {
  uuid: number;
  name: string;
  bytesLoaded: number;
  bytesTotal: number;
  speed: number;
  eta: number;
  status: string;
  statusIconKey?: string;
  hosts: string[];
  finished: boolean;
  enabled: boolean;
  priority: string;
  childCount: number;
  comment?: string;
};

export type DownloadLink = {
  uuid: number;
  packageUUID: number;
  name: string;
  bytesLoaded: number;
  bytesTotal: number;
  speed: number;
  eta: number;
  status: string;
  statusIconKey?: string;
  host: string;
  finished: boolean;
  enabled: boolean;
  priority?: string;
  url?: string;
  comment?: string;
};

export type GrabberPackage = {
  uuid: number;
  name: string;
  bytesTotal: number;
  status?: string;
  hosts?: string[];
  childCount: number;
  comment?: string;
  enabled?: boolean;
  priority?: string;
};

export type GrabberLink = {
  uuid: number;
  packageUUID: number;
  name: string;
  bytesTotal: number;
  status?: string;
  host?: string;
  url?: string;
  availability?: string;
  comment?: string;
  enabled?: boolean;
  priority?: string;
};

export type AddLinksParams = {
  links: string;
  packageName?: string;
  extractPassword?: string;
  downloadPassword?: string;
  destinationFolder?: string;
  autostart?: boolean;
};

export type JdAccount = {
  uuid: number;
  hostname: string;
  username: string;
  validUntil: number;
  trafficLeft: number;
  trafficMax: number;
  enabled: boolean;
  valid: boolean;
  error?: boolean;
};

export type ConfigEntry = {
  interfaceName: string;
  storage?: string;
  key: string;
  abstractType: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  docs?: string;
  displayName?: string;
  enumOptions?: string[][];
};

export type PluginEntry = {
  interfaceName: string;
  storage?: string;
  key: string;
  abstractType: string;
  type: string;
  value: unknown;
  defaultValue: unknown;
  docs?: string;
  className?: string;
  displayName?: string;
  enumLabel?: string;
  enumOptions?: string[][];
  pattern?: string;
  version?: string;
};

export type ExtensionEntry = {
  id?: string;
  name?: string;
  description?: string;
  enabled?: boolean;
  installed?: boolean;
  iconKey?: string;
  configInterface?: string;
};

export type JdSystemInfos = {
  hardware?: string;
  operatingSystem?: string;
  osString?: string;
  osFamily?: string;
  archString?: string;
  javaVersionString?: string;
  javaName?: string;
  heapMax?: number;
  heapUsed?: number;
  docker?: boolean;
  [key: string]: unknown;
};

export type JdInfo = {
  version: string | null;
  uptime: number | null;
  revision: number | null;
  systemInfos: JdSystemInfos | null;
};

export type DownloadConfig = {
  MaxChunksPerFile: number | null;
  MaxSimultaneDownloads: number | null;
  MaxSimultaneDownloadsPerHost: number | null;
  MaxDownloadsPerHostEnabled: boolean | null;
  DownloadSpeedLimit: number | null;
  DefaultDownloadFolder: string | null;
};

export type JdCaptcha = {
  id: number;
  hoster?: string;
  timeout?: number;
  explain?: string;
  type?: string;
};

export type JdCaptchaDetail = {
  captchaCategory?: string;
  /** Raw value from JD: "image/jpeg;base64,..." */
  imageData?: string | null;
} & JdCaptcha;

export type JdDialogProperties = {
  title?: string;
  message?: string;
  okbuttontext?: string;
  cancelbuttontext?: string;
  flags?: string;
  timeout?: string;
  [key: string]: unknown;
};

export type JdDialog = {
  id: number;
  type?: string;
  properties?: JdDialogProperties;
};

export type JdDialogDetail = {
  icon?: string;
} & JdDialog;

export type StorageInfo = {
  path: string;
  size: number;
  free: number;
  error: string | null;
};

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) {
    return '–';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatSpeed(bps: number): string {
  if (!bps || bps <= 0) {
    return '';
  }
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds: number): string {
  if (!seconds || seconds <= 0) {
    return '';
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  }
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
