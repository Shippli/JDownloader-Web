import { Hono } from 'hono';
import { getAppSetting, setAppSetting } from '../db/appSettings';

const setupRouter = new Hono();

setupRouter.get('/status', (c) => {
  try {
    return c.json({ setupComplete: getAppSetting('setup_complete') === 'true' });
  } catch {
    return c.json({ setupComplete: false });
  }
});

setupRouter.post('/complete', (c) => {
  setAppSetting('setup_complete', 'true');
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
