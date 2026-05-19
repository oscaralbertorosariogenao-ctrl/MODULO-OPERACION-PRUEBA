/* LOTEKA App Movil PWA Service Worker v20260519-04
   Compatible Android + iPhone. No cachea Supabase/R2/API.
*/
const CACHE_NAME = 'loteka-app-movil-v20260519-04';
const APP_URL = '/app-movil-reportes.html';
const STATIC_ASSETS = [
  APP_URL,
  '/manifest-app-movil.webmanifest',
  '/icons/loteka-mobile-180.png',
  '/icons/loteka-mobile-192.png',
  '/icons/loteka-mobile-512.png',
  '/icons/loteka-mobile-maskable-192.png',
  '/icons/loteka-mobile-maskable-512.png',
  '/icon-192.svg',
  '/icon-512.svg',
  '/sounds/whatsapp.mp3'
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

async function navigationResponse(request) {
  try {
    const response = await fetch(APP_URL, { cache: 'no-store' });
    if(response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(APP_URL, response.clone()).catch(() => null);
      return response;
    }
  } catch(e) {}

  const cached = await caches.match(APP_URL);
  if(cached) return cached;

  return new Response('LOTEKA Móvil no pudo cargar.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if(req.method !== 'GET') return;

  if(isDataRequest(url)) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  if(req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(navigationResponse(req));
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
