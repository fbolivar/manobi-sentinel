// Manobi Sentinel — Service Worker (offline-first + Web Push)
const CACHE_STATIC = 'manobi-static-v3';
const CACHE_API = 'manobi-api-v3';

const STATIC_ASSETS = ['/', '/index.html'];

const API_CACHEABLE = ['/api/alertas', '/api/alertas/summary', '/api/parques/geojson',
  '/api/parques', '/api/predicciones/latest', '/api/eventos-climaticos'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_STATIC).then((c) => c.addAll(STATIC_ASSETS).catch(() => {})),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys
        .filter((k) => k !== CACHE_STATIC && k !== CACHE_API)
        .map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.pathname.startsWith('/assets/') || url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached || fetch(e.request).then((r) => {
          const c = r.clone();
          caches.open(CACHE_STATIC).then((ch) => ch.put(e.request, c));
          return r;
        }),
      ),
    );
    return;
  }

  if (API_CACHEABLE.some((p) => url.pathname.startsWith(p))) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) { const c = r.clone(); caches.open(CACHE_API).then((ch) => ch.put(e.request, c)); }
          return r;
        })
        .catch(() => caches.match(e.request).then((c) => c || new Response('{"offline":true}', {
          status: 503, headers: { 'Content-Type': 'application/json' },
        }))),
    );
    return;
  }

  if (url.pathname === '/' || (!url.pathname.includes('.') && !url.pathname.startsWith('/api/'))) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('/index.html')),
    );
  }
});

self.addEventListener('push', (e) => {
  let data = { title: 'Manobi Sentinel', body: 'Alerta nueva', nivel: 'amarillo' };
  try { if (e.data) data = { ...data, ...e.data.json() }; } catch {}
  const icon = data.nivel === 'rojo' ? '/icon-red.png' : '/icon.png';
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body, icon, badge: icon,
      tag: `manobi-${data.nivel}`, requireInteraction: data.nivel === 'rojo',
      data: { url: '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow(e.notification.data?.url || '/dashboard'));
});
