import { Hono } from 'hono';
import { auth } from '../lib/auth';

const TRAILING_SLASH_RE = /\/$/;

const authRouter = new Hono();

// Extension sign-in: rewrite origin so Better Auth accepts the request.
// Browser extension popups send Origin: moz-extension://... which is not trusted.
authRouter.post('/sign-in-ext', async (c) => {
  const body = await c.req.json();
  const baseUrl = (auth.options.baseURL ?? 'http://localhost:3001').replace(TRAILING_SLASH_RE, '');
  const req = new Request(`${baseUrl}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'origin': baseUrl },
    body: JSON.stringify(body),
  });
  return auth.handler(req);
});

// Forward all auth requests to better-auth
authRouter.on(['GET', 'POST'], '*', async (c) => {
  return auth.handler(c.req.raw);
});

export default authRouter;
