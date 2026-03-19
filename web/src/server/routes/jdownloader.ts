import { Hono } from 'hono';
import {
  DEFAULT_ACCOUNTS_QUERY,
  DEFAULT_EXTENSIONS_QUERY,
  DEFAULT_PLUGINS_QUERY,
  jd as jdClient,
} from '../lib/jd';

const jd = new Hono();

// ─── Download Controller ─────────────────────────────────────────────────────

jd.post('/controller/start', async (c) => {
  const data = await jdClient.call('/downloadcontroller/start');
  return c.json(data);
});

jd.post('/controller/stop', async (c) => {
  const data = await jdClient.call('/downloadcontroller/stop');
  return c.json(data);
});

jd.post('/controller/pause', async (c) => {
  const body = await c.req.json().catch(() => ({ value: true }));
  const data = await jdClient.call('/downloadcontroller/pause', [body.value ?? true]);
  return c.json(data);
});

// ─── Downloads ────────────────────────────────────────────────────────────────

jd.post('/downloads/force', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/forceDownload', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/downloads/reset', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/resetLinks', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/downloads/cleanup', async (c) => {
  const { linkIds, packageIds, deleteFiles } = await c.req.json();
  const mode = deleteFiles ? 'REMOVE_LINKS_AND_DELETE_FILES' : 'REMOVE_LINKS_ONLY';
  const data = await jdClient.call('/downloadsV2/cleanup', [linkIds ?? [], packageIds ?? [], 'DELETE_ALL', mode, 'SELECTED']);
  return c.json(data);
});

jd.post('/downloads/enable', async (c) => {
  const { enabled, linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/setEnabled', [enabled ?? true, linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/downloads/priority', async (c) => {
  const { priority, linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/setPriority', [priority, linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/downloads/check', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/startOnlineStatusCheck', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.patch('/downloads/packages/:id/name', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const { name } = await c.req.json();
  const data = await jdClient.call('/downloadsV2/renamePackage', [id, name]);
  return c.json(data);
});

jd.post('/downloads/extract', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/extraction/startExtractionNow', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

// ─── Link Grabber ──────────────────────────────────────────────────────────

jd.post('/grabber/add', async (c) => {
  const body = await c.req.json();
  const query = {
    links: body.links,
    packageName: body.packageName,
    extractPassword: body.extractPassword,
    downloadPassword: body.downloadPassword,
    destinationFolder: body.destinationFolder,
    autostart: body.autostart ?? false,
    assignJobID: true,
  };
  const data = await jdClient.call('/linkgrabberv2/addLinks', [query]);
  return c.json(data);
});

jd.post('/grabber/addContainer', async (c) => {
  const { type, content } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/addContainer', [type, content]);
  return c.json(data);
});

jd.post('/grabber/move', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/moveToDownloadlist', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/grabber/remove', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/removeLinks', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.patch('/grabber/packages/:id/name', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const { name } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/renamePackage', [id, name]);
  return c.json(data);
});

jd.post('/grabber/enable', async (c) => {
  const { enabled, linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/setEnabled', [enabled ?? true, linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/grabber/priority', async (c) => {
  const { priority, linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/setPriority', [priority, linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

jd.post('/grabber/check', async (c) => {
  const { linkIds, packageIds } = await c.req.json();
  const data = await jdClient.call('/linkgrabberv2/startOnlineStatusCheck', [linkIds ?? [], packageIds ?? []]);
  return c.json(data);
});

// ─── Accounts ─────────────────────────────────────────────────────────────────

jd.get('/accounts/hosters', async (c) => {
  const data = await jdClient.call('/accountsV2/listPremiumHoster');
  return c.json(data);
});

jd.get('/accounts', async (c) => {
  const data = await jdClient.call('/accountsV2/listAccounts', [DEFAULT_ACCOUNTS_QUERY]);
  return c.json(data);
});

jd.post('/accounts/enable', async (c) => {
  const { ids } = await c.req.json();
  const data = await jdClient.call('/accountsV2/enableAccounts', [ids ?? []]);
  return c.json(data);
});

jd.post('/accounts/disable', async (c) => {
  const { ids } = await c.req.json();
  const data = await jdClient.call('/accountsV2/disableAccounts', [ids ?? []]);
  return c.json(data);
});

jd.post('/accounts/refresh', async (c) => {
  const { ids } = await c.req.json();
  const data = await jdClient.call('/accountsV2/refreshAccounts', [ids ?? []]);
  return c.json(data);
});

jd.post('/accounts/add', async (c) => {
  const { hoster, username, password } = await c.req.json();
  const data = await jdClient.call('/accountsV2/addAccount', [hoster, username, password]);
  return c.json(data);
});

jd.delete('/accounts/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const data = await jdClient.call('/accountsV2/removeAccounts', [[id]]);
  return c.json(data);
});

jd.patch('/accounts/:id/credentials', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const { username, password } = await c.req.json();
  const data = await jdClient.call('/accountsV2/setUserNameAndPassword', [id, username, password]);
  return c.json(data);
});

// ─── Config / Settings ────────────────────────────────────────────────────────

jd.get('/settings/list', async (c) => {
  const pattern = c.req.query('pattern') ?? '.*';
  const data = await jdClient.call('/config/list', [pattern, true, true, true, true]);
  return c.json(Array.isArray(data) ? data : []);
});

jd.post('/settings/set', async (c) => {
  const body = await c.req.json();
  const data = await jdClient.call('/config/set', [body.interfaceName, body.storage ?? null, body.key, body.value]);
  return c.json(data);
});

jd.post('/settings/reset', async (c) => {
  const body = await c.req.json();
  const data = await jdClient.call('/config/reset', [body.interfaceName, body.storage ?? null, body.key]);
  return c.json(data);
});

// ─── Download Config ──────────────────────────────────────────────────────────

const DL_INTERFACE = 'org.jdownloader.settings.GeneralSettings';
const DL_KEYS = ['MaxChunksPerFile', 'MaxSimultaneDownloads', 'MaxSimultaneDownloadsPerHost', 'MaxDownloadsPerHostEnabled', 'DownloadSpeedLimit', 'DefaultDownloadFolder'] as const;

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

jd.post('/downloads/dlconfig', async (c) => {
  const { key, value } = await c.req.json();
  const data = await jdClient.call('/config/set', [DL_INTERFACE, null, key, value]);
  return c.json(data);
});

// ─── Storage Info ─────────────────────────────────────────────────────────────

jd.get('/storage', async (c) => {
  const data = await jdClient.call('/system/getStorageInfos?path=.*');
  return c.json(data);
});

// ─── Status ───────────────────────────────────────────────────────────────────

jd.get('/status', (c) => {
  return c.json({
    configured: jdClient.isConfigured(),
    connected: jdClient.isConfigured() && jdClient.isAvailable(),
  });
});

// ─── Connection Settings ──────────────────────────────────────────────────────

jd.get('/connection', (c) => {
  return c.json({ ...jdClient.getConnection(), configured: jdClient.isConfigured() });
});

jd.post('/connection', async (c) => {
  const { host, port } = await c.req.json();
  if (!host || !port) {
    return c.json({ error: 'host and port required' }, 400);
  }
  jdClient.setConnection(String(host).trim(), String(port).trim());
  return c.json({ ok: true });
});

jd.post('/connection/test', async (c) => {
  jdClient.setAvailable(true);
  try {
    await jdClient.call('/jd/version');
    return c.json({ ok: true });
  } catch (e) {
    jdClient.setAvailable(false);
    return c.json({ ok: false, error: (e as Error).message });
  }
});

// ─── Update Check ─────────────────────────────────────────────────────────────

jd.get('/update-available', async (c) => {
  const data = await jdClient.call('/update/isUpdateAvailable');
  return c.json({ available: data === true });
});

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

// ─── Extensions ───────────────────────────────────────────────────────────────

jd.get('/extensions/list', async (c) => {
  const data = await jdClient.call('/extensions/list', [DEFAULT_EXTENSIONS_QUERY]);
  return c.json(Array.isArray(data) ? data : []);
});

jd.post('/extensions/toggle', async (c) => {
  const { id, enabled } = await c.req.json();
  const data = await jdClient.call('/extensions/setEnabled', [id, enabled]);
  return c.json(data);
});

// ─── Plugins ──────────────────────────────────────────────────────────────────

jd.get('/plugins/list', async (c) => {
  const data = await jdClient.call(`/plugins/list?query=${encodeURIComponent(JSON.stringify(DEFAULT_PLUGINS_QUERY))}`);
  return c.json(Array.isArray(data) ? data : []);
});

jd.post('/plugins/set', async (c) => {
  const body = await c.req.json();
  const data = await jdClient.call('/plugins/set', [body.interfaceName, body.storage ?? null, body.key, body.value]);
  return c.json(data);
});

jd.post('/plugins/reset', async (c) => {
  const body = await c.req.json();
  const data = await jdClient.call('/plugins/reset', [body.interfaceName, body.storage ?? null, body.key]);
  return c.json(data);
});

// ─── JD Info ──────────────────────────────────────────────────────────────────

jd.get('/info', async (c) => {
  jdClient.setAvailable(true);
  const [version, uptime, revision, systemInfos] = await Promise.allSettled([
    jdClient.call('/jd/version'),
    jdClient.call('/jd/uptime'),
    jdClient.call('/jd/getCoreRevision'),
    jdClient.call('/system/getSystemInfos'),
  ]);
  return c.json({
    version: version.status === 'fulfilled' ? version.value : null,
    uptime: uptime.status === 'fulfilled' ? uptime.value : null,
    revision: revision.status === 'fulfilled' ? revision.value : null,
    systemInfos: systemInfos.status === 'fulfilled' ? systemInfos.value : null,
  });
});

// ─── Captcha ──────────────────────────────────────────────────────────────────

jd.get('/captcha', async (c) => {
  const data = await jdClient.call('/captcha/list', []);
  return c.json(Array.isArray(data) ? data : []);
});

jd.get('/captcha/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
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
  const id = Number.parseInt(c.req.param('id'));
  const { solution } = await c.req.json();
  const data = await jdClient.call('/captcha/solve', [id, solution ?? '']);
  return c.json(data);
});

// ─── Dialogs ─────────────────────────────────────────────────────────────────

jd.get('/dialogs', async (c) => {
  const ids = await jdClient.call('/dialogs/list');
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json([]);
  }
  const results = await Promise.allSettled(
    ids.map((id: unknown) =>
      jdClient.call('/dialogs/get', [id, false, true])
        .then(data => ({ ...(data as Record<string, unknown>), id })),
    ),
  );
  return c.json(
    results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<unknown>).value),
  );
});

jd.get('/dialogs/:id', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const data = await jdClient.call('/dialogs/get', [id, true, true]);
  return c.json({ ...(data as Record<string, unknown>), id });
});

jd.post('/dialogs/:id/answer', async (c) => {
  const id = Number.parseInt(c.req.param('id'));
  const body = await c.req.json();
  const data = await jdClient.call('/dialogs/answer', [id, body]);
  return c.json(data);
});

export default jd;
