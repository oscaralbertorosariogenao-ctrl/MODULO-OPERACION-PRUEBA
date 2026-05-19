/* LOTEKA cleanup mobile experimental service worker.
   This file intentionally unregisters itself and does not intercept requests. */
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k.indexOf('loteka-app-movil') === 0 || k.indexOf('app-movil') >= 0).map(k => caches.delete(k)));
    } catch(e) {}
    try { await self.registration.unregister(); } catch(e) {}
    try {
      const clientsList = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
      for (const client of clientsList) client.navigate(client.url);
    } catch(e) {}
  })());
});
self.addEventListener('fetch', event => { return; });
