import type { Context } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { applyAnswerToPackage } from '../lib/dialogs';
import {
  DEFAULT_ACCOUNTS_QUERY,
  DEFAULT_EXTENSIONS_QUERY,
  jd as jdClient,
} from '../lib/jd';

const jd = new Hono();

type Body = Record<string, any>;

// Registers a POST route that forwards to a JD call; toParams maps the request body to JD params.
function proxyPost(path: string, jdPath: string, toParams: (body: Body) => unknown[] = () => []) {
  jd.post(path, async (c) => {
    const body = await c.req.json<Body>().catch(() => ({}));
    return c.json(await jdClient.call(jdPath, toParams(body)));
  });
}

function idParam(c: Context): number {
  const id = Number.parseInt(c.req.param('id') ?? '');
  if (Number.isNaN(id)) {
    throw new HTTPException(400, { message: 'invalid id' });
  }
  return id;
}

const selection = (b: Body) => [b.linkIds ?? [], b.packageIds ?? []];
const configEntry = (b: Body) => [b.interfaceName, b.storage ?? null, b.key];

// ─── Download Controller ─────────────────────────────────────────────────────

proxyPost('/controller/start', '/downloadcontroller/start');
proxyPost('/controller/stop', '/downloadcontroller/stop');
proxyPost('/controller/pause', '/downloadcontroller/pause', b => [b.value ?? true]);

// ─── Downloads ────────────────────────────────────────────────────────────────

proxyPost('/downloads/force', '/downloadsV2/forceDownload', selection);
proxyPost('/downloads/reset', '/downloadsV2/resetLinks', selection);
proxyPost('/downloads/cleanup', '/downloadsV2/cleanup', b => [
  ...selection(b),
  'DELETE_ALL',
  b.deleteFiles ? 'REMOVE_LINKS_AND_DELETE_FILES' : 'REMOVE_LINKS_ONLY',
  'SELECTED',
]);
proxyPost('/downloads/enable', '/downloadsV2/setEnabled', b => [
  b.enabled ?? true,
  ...selection(b),
]);
proxyPost('/downloads/priority', '/downloadsV2/setPriority', b => [
  b.priority,
  ...selection(b),
]);
proxyPost('/downloads/check', '/downloadsV2/startOnlineStatusCheck', selection);
proxyPost('/downloads/extract', '/extraction/startExtractionNow', selection);

jd.patch('/downloads/packages/:id/name', async (c) => {
  const { name } = await c.req.json();
  return c.json(await jdClient.call('/downloadsV2/renamePackage', [
    idParam(c),
    name,
  ]));
});

// ─── Link Grabber ──────────────────────────────────────────────────────────

proxyPost('/grabber/add', '/linkgrabberv2/addLinks', b => [
  {
    links: b.links,
    packageName: b.packageName,
    extractPassword: b.extractPassword,
    downloadPassword: b.downloadPassword,
    destinationFolder: b.destinationFolder,
    autostart: b.autostart ?? false,
    assignJobID: true,
  },
]);
proxyPost('/grabber/addContainer', '/linkgrabberv2/addContainer', b => [b.type, b.content]);
proxyPost('/grabber/move', '/linkgrabberv2/moveToDownloadlist', selection);
proxyPost('/grabber/remove', '/linkgrabberv2/removeLinks', selection);
proxyPost('/grabber/enable', '/linkgrabberv2/setEnabled', b => [
  b.enabled ?? true,
  ...selection(b),
]);
proxyPost('/grabber/priority', '/linkgrabberv2/setPriority', b => [
  b.priority,
  ...selection(b),
]);
proxyPost('/grabber/new-package', '/linkgrabberv2/movetoNewPackage', b => [
  ...selection(b),
  b.name ?? '',
  b.downloadPath ?? '',
]);
proxyPost('/grabber/check', '/linkgrabberv2/startOnlineStatusCheck', selection);

jd.patch('/grabber/packages/:id/name', async (c) => {
  const { name } = await c.req.json();
  return c.json(await jdClient.call('/linkgrabberv2/renamePackage', [
    idParam(c),
    name,
  ]));
});

// ─── Accounts ─────────────────────────────────────────────────────────────────

jd.get('/accounts/hosters', async c => c.json(await jdClient.call('/accountsV2/listPremiumHoster')));
jd.get('/accounts', async c => c.json(await jdClient.call('/accountsV2/listAccounts', [DEFAULT_ACCOUNTS_QUERY])));

proxyPost('/accounts/enable', '/accountsV2/enableAccounts', b => [b.ids ?? []]);
proxyPost('/accounts/disable', '/accountsV2/disableAccounts', b => [b.ids ?? []]);
proxyPost('/accounts/refresh', '/accountsV2/refreshAccounts', b => [b.ids ?? []]);
proxyPost('/accounts/add', '/accountsV2/addAccount', b => [b.hoster, b.username, b.password]);

jd.delete('/accounts/:id', async c => c.json(await jdClient.call('/accountsV2/removeAccounts', [
  [
    idParam(c),
  ],
])));

jd.patch('/accounts/:id/credentials', async (c) => {
  const { username, password } = await c.req.json();
  return c.json(await jdClient.call('/accountsV2/setUserNameAndPassword', [
    idParam(c),
    username,
    password,
  ]));
});

// ─── Config / Settings ────────────────────────────────────────────────────────

function asArray(x: unknown): unknown[] {
  return Array.isArray(x)
    ? x
    : [];
}

jd.get('/settings/list', async (c) => {
  const pattern = c.req.query('pattern') ?? '.*';
  return c.json(asArray(await jdClient.call('/config/list', [pattern, true, true, true, true])));
});

proxyPost('/settings/set', '/config/set', b => [
  ...configEntry(b),
  b.value,
]);
proxyPost('/settings/reset', '/config/reset', configEntry);

// ─── Download Config ──────────────────────────────────────────────────────────

const DL_INTERFACE = 'org.jdownloader.settings.GeneralSettings';
const DL_KEYS = [
  'MaxChunksPerFile',
  'MaxSimultaneDownloads',
  'MaxSimultaneDownloadsPerHost',
  'MaxDownloadsPerHostEnabled',
  'DownloadSpeedLimit',
  'DefaultDownloadFolder',
] as const;

jd.get('/downloads/dlconfig', async (c) => {
  const results = await Promise.all(
    DL_KEYS.map(key => jdClient.call('/config/get', [DL_INTERFACE, null, key]).catch(() => null)),
  );
  const out: Record<string, unknown> = {};
  DL_KEYS.forEach((key, i) => {
    out[key] = results[i];
  });
  return c.json(out);
});

proxyPost('/downloads/dlconfig', '/config/set', b => [DL_INTERFACE, null, b.key, b.value]);

// ─── Storage Info ─────────────────────────────────────────────────────────────

jd.get('/storage', async c => c.json(await jdClient.call('/system/getStorageInfos?path=.*')));

// ─── Status ───────────────────────────────────────────────────────────────────

jd.get('/status', (c) => {
  return c.json({
    configured: jdClient.isConfigured(),
    connected: jdClient.isConfigured() && jdClient.isAvailable(),
  });
});

// ─── Connection Settings ──────────────────────────────────────────────────────

jd.get('/connection', (c) => {
  return c.json({
    ...jdClient.getConnection(),
    configured: jdClient.isConfigured(),
  });
});

jd.post('/connection', async (c) => {
  const { host, port } = await c.req.json();
  if (!host || !port) {
    return c.json({ error: 'host and port required' }, 400);
  }
  jdClient.setConnection(String(host).trim(), String(port).trim());
  return c.json({ ok: true });
});

// ─── Update Check ─────────────────────────────────────────────────────────────

jd.post('/system/restart', async (c) => {
  const data = await jdClient.call('/system/restartJD');
  return c.json({ ok: true, data });
});

jd.post('/system/restart-and-update', async (c) => {
  const data = await jdClient.call('/update/restartAndUpdate');
  return c.json({ ok: true, data });
});

jd.post('/system/run-update-check', async (c) => {
  const data = await jdClient.call('/update/runUpdateCheck');
  return c.json({ ok: true, data });
});

jd.get('/system/auto-update', c => c.json({
  enabled: jdClient.isAutoUpdateEnabled(),
}));

jd.post('/system/auto-update', async (c) => {
  const { enabled } = await c.req.json();
  jdClient.setAutoUpdateEnabled(Boolean(enabled));
  return c.json({ ok: true });
});

// ─── Extensions ───────────────────────────────────────────────────────────────

jd.get('/extensions/list', async (c) => {
  return c.json(asArray(await jdClient.call('/extensions/list', [DEFAULT_EXTENSIONS_QUERY])));
});

proxyPost('/extensions/toggle', '/extensions/setEnabled', b => [b.id, b.enabled]);

// ─── JD Info ──────────────────────────────────────────────────────────────────

jd.get('/info', async (c) => {
  jdClient.setAvailable(true);
  const [version, uptime, revision, systemInfos] = await Promise.allSettled([
    jdClient.call('/jd/version'),
    jdClient.call('/jd/uptime'),
    jdClient.call('/jd/getCoreRevision'),
    jdClient.call('/system/getSystemInfos'),
  ]);
  const valueOrNull = (r: PromiseSettledResult<unknown>) => r.status === 'fulfilled'
    ? r.value
    : null;
  return c.json({
    version: valueOrNull(version),
    uptime: valueOrNull(uptime),
    revision: valueOrNull(revision),
    systemInfos: valueOrNull(systemInfos),
  });
});

// ─── Captcha ──────────────────────────────────────────────────────────────────

jd.get('/captcha/:id', async (c) => {
  const id = idParam(c);
  const [imageData, list] = await Promise.allSettled([
    jdClient.call('/captcha/get', [id]),
    jdClient.call('/captcha/list', []),
  ]);
  const meta = list.status === 'fulfilled' && Array.isArray(list.value)
    ? (list.value as Record<string, unknown>[]).find(c => c.id === id) ?? {}
    : {};
  const raw = imageData.status === 'fulfilled' && typeof imageData.value === 'string'
    ? imageData.value
    : null;
  return c.json({ ...meta, id, imageData: raw });
});

jd.post('/captcha/:id/solve', async (c) => {
  const id = idParam(c);
  const { solution } = await c.req.json();
  return c.json(await jdClient.call('/captcha/solve', [id, solution ?? '']));
});

// ─── Dialogs ─────────────────────────────────────────────────────────────────

jd.get('/dialogs/:id', async (c) => {
  const id = idParam(c);
  const data = await jdClient.call('/dialogs/get', [id, true, true]);
  return c.json({ ...(data as Record<string, unknown>), id });
});

jd.post('/dialogs/:id/answer', async (c) => {
  const id = idParam(c);
  const { packageid, ...body } = await c.req.json();
  const data = await jdClient.call('/dialogs/answer', [id, body]);

  if (packageid) {
    applyAnswerToPackage(packageid, body).catch(() => {});
  }

  return c.json(data);
});

export default jd;
