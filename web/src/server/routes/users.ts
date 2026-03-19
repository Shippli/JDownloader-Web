import { count, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../db';
import { account, user } from '../db/schema';
import { auth } from '../lib/auth';

const usersRouter = new Hono();

// GET /api/users – list all users
usersRouter.get('/', async (c) => {
  const users = await db
    .select({ id: user.id, name: user.name, email: user.email, createdAt: user.createdAt })
    .from(user)
    .orderBy(user.createdAt);
  return c.json(users);
});

// POST /api/users – create new user
usersRouter.post('/', async (c) => {
  const { name, email, password } = await c.req.json<{ name: string; email: string; password: string }>();

  if (!name?.trim() || !email?.trim() || !password) {
    return c.json({ error: 'Name, E-Mail und Passwort sind erforderlich' }, 400);
  }
  if (password.length < 8) {
    return c.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, 400);
  }

  const result = await auth.api.signUpEmail({
    body: { name: name.trim(), email: email.trim().toLowerCase(), password },
  });

  if (!result?.user) {
    return c.json({ error: 'Benutzer konnte nicht erstellt werden' }, 500);
  }

  return c.json({ ok: true });
});

// PATCH /api/users/:id – update name + email
usersRouter.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const { name, email } = await c.req.json<{ name: string; email: string }>();

  if (!name?.trim() || !email?.trim()) {
    return c.json({ error: 'Name und E-Mail sind erforderlich' }, 400);
  }

  await db
    .update(user)
    .set({ name: name.trim(), email: email.trim().toLowerCase(), updatedAt: new Date() })
    .where(eq(user.id, id));

  return c.json({ ok: true });
});

// PATCH /api/users/:id/password – set password for any user
usersRouter.patch('/:id/password', async (c) => {
  const id = c.req.param('id');
  const { password } = await c.req.json<{ password: string }>();

  if (!password || password.length < 8) {
    return c.json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' }, 400);
  }

  const hash = await Bun.password.hash(password, { algorithm: 'bcrypt', cost: 10 });

  await db
    .update(account)
    .set({ password: hash, updatedAt: new Date() })
    .where(eq(account.userId, id));

  return c.json({ ok: true });
});

// DELETE /api/users/:id – delete user (not self, not last user)
usersRouter.delete('/:id', async (c) => {
  const id = c.req.param('id');

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user.id === id) {
    return c.json({ error: 'Du kannst deinen eigenen Account nicht löschen' }, 400);
  }

  const [{ total }] = await db.select({ total: count() }).from(user);
  if (total <= 1) {
    return c.json({ error: 'Der letzte Benutzer kann nicht gelöscht werden' }, 400);
  }

  await db.delete(user).where(eq(user.id, id));
  return c.json({ ok: true });
});

export default usersRouter;
