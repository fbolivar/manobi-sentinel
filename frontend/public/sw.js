// Self-unregistering SW — se instala solo para limpiar SWs viejos que pudieron
// quedar cacheados del cert/origen anterior. Al activarse borra todos los
// caches y se desregistra. Versión previa en sw.js.real (se puede restaurar).
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.navigate(c.url));
  })());
});
