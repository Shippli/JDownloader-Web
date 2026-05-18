import { Hono } from 'hono';
import { sqlite } from '../db/index';

const setupRouter = new Hono();

setupRouter.get('/status', (c) => {
  try {
    const row = sqlite
      .query('SELECT value FROM app_settings WHERE key = \'setup_complete\'')
      .get() as { value: string } | null;
    return c.json({ setupComplete: row?.value === 'true' });
  } catch {
    return c.json({ setupComplete: false });
  }
});

setupRouter.post('/complete', (c) => {
  sqlite
    .query('INSERT OR REPLACE INTO app_settings (key, value) VALUES (\'setup_complete\', \'true\')')
    .run();
  return c.json({ ok: true });
});

// Public connection test — used during setup before user exists/is authenticated.
// Does not modify jdClient state.
setupRouter.post('/test-connection', async (c) => {
  const { host, port } = await c.req.json();
  if (!host || !port) {
    return c.json({ ok: false, error: 'host and port required' }, 400);
  }
  try {
    const rid = Date.now();
    const res = await fetch(`http://${String(host).trim()}:${String(port).trim()}/jd/version`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ apiVer: 1, url: '/jd/version', params: [], rid }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return c.json({ ok: false, error: `HTTP ${res.status}` });
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message });
  }
});

export default setupRouter;
