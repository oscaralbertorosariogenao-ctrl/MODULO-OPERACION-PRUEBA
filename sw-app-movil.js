/* LOTEKA App Movil PWA Service Worker */
const CACHE_NAME = 'loteka-app-movil-v20260519-01';
const APP_SHELL = [
  '/app-movil-reportes.html',
  '/manifest-app-movil.json',
  '/icon-192.svg',
  '/icon-512.svg',
  '/sounds/whatsapp.mp3'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => null))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME && key.startsWith('loteka-app-movil-'))
        .map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Nunca interceptar métodos que suben datos/fotos.
  if (req.method !== 'GET') return;

  // No cachear API, Supabase ni R2 para no dañar datos reales.
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflarestorage.com')
  ) {
    event.respondWith(fetch(req));
    return;
  }

  // HTML siempre network-first para evitar versiones viejas.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
          return res;
        })
        .catch(() => caches.match(req).then(cached => cached || caches.match('/app-movil-reportes.html')))
    );
    return;
  }

  // Assets: cache-first con actualización silenciosa.
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
