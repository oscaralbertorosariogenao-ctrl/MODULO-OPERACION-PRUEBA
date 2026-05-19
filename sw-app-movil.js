/* LOTEKA App Movil PWA Service Worker v20260519-03
   FIX: Android instalado abriendo / o ruta vieja ya no muestra 404.
*/
const CACHE_NAME = 'loteka-app-movil-v20260519-03';
const APP_URL = '/app-movil-reportes.html';
const STATIC_ASSETS = [
  APP_URL,
  '/manifest-app-movil.json',
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

async function appFallback(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request, { cache: 'no-store' });

    // Si Vercel devuelve 404 para /, usamos la app móvil.
    if (response && response.ok) {
      if (request.mode === 'navigate' || new URL(request.url).pathname.endsWith('.html')) {
        cache.put(request, response.clone()).catch(() => null);
      }
      return response;
    }
  } catch (e) {}

  const appCached = await caches.match(APP_URL);
  if (appCached) return appCached;

  return fetch(APP_URL, { cache: 'no-store' });
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Nunca tocar API, Supabase ni R2.
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflarestorage.com')
  ) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Cualquier navegación del PWA debe caer en la app, no en 404.
  if (
    req.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname === '/app-reportes.html' ||
    url.pathname === '/app-movil-reportes' ||
    url.pathname.endsWith('.html')
  ) {
    event.respondWith(appFallback(req));
    return;
  }

  // Assets estáticos.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;

      return fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
        }
        return res;
      }).catch(() => cached);
    })
  );
});
