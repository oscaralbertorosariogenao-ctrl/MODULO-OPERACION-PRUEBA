/* LOTEKA App Movil PWA v20260519-05
   Scope aislado: /app-movil/
   No cachea API, Supabase ni R2.
*/
const CACHE_NAME = 'loteka-app-movil-v20260519-05';
const APP_URL = '/app-movil/';
const STATIC_ASSETS = [
  '/app-movil/',
  '/app-movil/manifest.webmanifest',
  '/app-movil/icons/loteka-mobile-180.png',
  '/app-movil/icons/loteka-mobile-192.png',
  '/app-movil/icons/loteka-mobile-512.png',
  '/app-movil/icons/loteka-mobile-maskable-192.png',
  '/app-movil/icons/loteka-mobile-maskable-512.png'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => null))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith('loteka-app-movil-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isDataRequest(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflarestorage.com')
  );
}

async function appResponse() {
  try {
    const response = await fetch('/app-movil/index.html', { cache: 'no-store' });
    if(response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put('/app-movil/', response.clone()).catch(() => null);
      return response;
    }
  } catch(e) {}

  const cached = await caches.match('/app-movil/');
  if(cached) return cached;

  return new Response('LOTEKA Móvil no pudo cargar.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if(req.method !== 'GET') return;

  if(isDataRequest(url)) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  if(req.mode === 'navigate' || url.pathname === '/app-movil/' || url.pathname === '/app-movil/index.html') {
    event.respondWith(appResponse());
    return;
  }

  event.respondWith(
    caches.match(req).then(cached => {
      if(cached) return cached;
      return fetch(req).then(res => {
        if(res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
        }
        return res;
      }).catch(() => cached);
    })
  );
});
