/* LOTEKA App Movil PWA Service Worker v20260519-02
   Regla clave: NO cachear datos, Supabase, R2 ni API. */
const CACHE_NAME = 'loteka-app-movil-v20260519-02';
const STATIC_ASSETS = [
  '/manifest-app-movil.json?v=20260519-02',
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
      .then(keys => Promise.all(keys.filter(key => key.startsWith('loteka-app-movil-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Nunca cachear HTML: así Android siempre carga la versión nueva.
  if (req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('/app-movil-reportes.html')));
    return;
  }

  // Nunca cachear API, Supabase, R2 ni dominios externos de datos.
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('r2.dev') ||
    url.hostname.includes('cloudflarestorage.com')
  ) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Solo assets estáticos.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => null);
        return res;
      });
    })
  );
});
