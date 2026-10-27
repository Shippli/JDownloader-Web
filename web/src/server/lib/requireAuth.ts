import { createMiddleware } from 'hono/factory';
import { auth } from './auth';

type Session = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export type AuthEnv = { Variables: { session: Session } };

// Stores the session in context so downstream handlers don't need a second
// getSession() lookup.
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  c.set('session', session);
  await next();
});
