const CACHE = 'jdownloader-v1';
const PRECACHE = ['/', '/index.html'];

globalThis.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)),
  );
  globalThis.skipWaiting();
});

globalThis.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))),
    ),
  );
  globalThis.clients.claim();
});

globalThis.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Always use network for API requests
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests: try network, fall back to cached index.html
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html')),
    );
    return;
  }

  // For assets: cache-first
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request)),
  );
});
