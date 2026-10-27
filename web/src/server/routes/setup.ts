import { Hono } from 'hono';
import { getAppSetting, setAppSetting } from '../db/appSettings';
import { probeJdOrThrow } from '../lib/jd';

const setupRouter = new Hono();

setupRouter.get('/status', (c) => {
  return c.json({ setupComplete: getAppSetting('setup_complete') === 'true' });
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
    await probeJdOrThrow(String(host).trim(), String(port).trim(), 5000);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ ok: false, error: (e as Error).message });
  }
});

export default setupRouter;
