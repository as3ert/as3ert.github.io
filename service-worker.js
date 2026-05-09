// kill-switch — neutralizes any prior service worker
// (al-folio shipped one at this URL; this replaces it with a SW
// that wipes caches, unregisters itself, and reloads clients.)
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch (_) { /* best-effort */ }
  })());
});
self.addEventListener('fetch', (e) => {
  // never serve from cache; always passthrough
  e.respondWith(fetch(e.request));
});
