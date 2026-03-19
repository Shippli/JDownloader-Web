import type { Server } from 'bun';
import process from 'node:process';
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
import { auth } from './lib/auth';
import { startBroadcaster, websocketHandler } from './lib/broadcaster';
import authRouter from './routes/auth';
import jdRouter from './routes/jdownloader';
import usersRouter from './routes/users';

const app = new Hono();
const PORT = Number.parseInt(process.env.PORT ?? '3001');

// CORS for dev + browser extensions
const isDev = process.env.NODE_ENV !== 'production';
const extraOrigins = process.env.TRUSTED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) ?? [];
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // In dev mode allow all origins (LAN access via Vite dev server)
      if (isDev) {
        return origin;
      }
      const allowed = ['http://localhost:5173', 'http://localhost:3001', ...extraOrigins];
      if (allowed.includes(origin)) {
        return origin;
      }
      // Allow Firefox/Chrome browser extension background pages
      if (origin.startsWith('moz-extension://') || origin.startsWith('chrome-extension://')) {
        return origin;
      }
      return null;
    },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
  }),
);

// CNL check – public, no auth required (browser loads this as a <script> tag)
app.get('/api/cnl/jdcheck.js', (c) => {
  return c.text('var jdownloader = true;\r\n', 200, {
    'Content-Type': 'text/javascript',
    'Access-Control-Allow-Origin': '*',
  });
});

// Auth middleware for protected routes
async function requireAuth(c: any, next: any) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return next();
}

app.use('/api/jd/*', requireAuth);
app.use('/api/users/*', requireAuth);

function isJdConnErr(code: string | undefined) {
  return code === 'ConnectionRefused' || code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'JD_UNAVAILABLE';
}

// JD error handler: catch connection errors silently, return 503 without logging
app.use('/api/jd/*', async (c, next) => {
  try {
    await next();
  } catch (e) {
    const err = e as Error & { code?: string; status?: number };
    if (!isJdConnErr(err.code)) {
      console.error('[JD Error]', err);
    }
    return c.json({ error: isJdConnErr(err.code) ? 'JDownloader unavailable' : err.message, code: err.code }, isJdConnErr(err.code) ? 503 : 500);
  }
});

// Routes
app.route('/api/auth', authRouter);
app.route('/api/jd', jdRouter);
app.route('/api/users', usersRouter);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './dist/public' }));
  app.get('*', serveStatic({ path: './dist/public/index.html' }));
}

// Error handler
app.onError((err, c) => {
  const code = (err as { code?: string }).code;
  if (!isJdConnErr(code)) {
    console.error('[Server Error]', err);
  }
  const status = (err as { status?: number }).status ?? 500;
  return c.json({ error: err.message }, status as 500);
});

// WebSocket upgrade handler — auth check before upgrading
async function handleWsUpgrade(req: Request, server: Server<unknown>): Promise<Response | undefined> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }
  server.upgrade(req, { data: undefined });
  return undefined;
}

// Use Bun's native server with WebSocket support
const server = Bun.serve({
  async fetch(req, srv) {
    if (new URL(req.url).pathname === '/ws') {
      return handleWsUpgrade(req, srv as Server<unknown>);
    }
    return app.fetch(req);
  },
  websocket: websocketHandler,
  port: PORT,
});

console.warn(`Server running on http://localhost:${server.port}`);

// Start broadcaster — owns server-side JD polling and pushes to WS clients
startBroadcaster();
