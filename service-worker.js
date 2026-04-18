const CACHE_NAME = "loteka-app-v1";

// Archivos básicos a cachear
const urlsToCache = [
  "/",
  "/app-reportes.html",
  "/manifest.json"
];

// 🔹 INSTALACIÓN
self.addEventListener("install", event => {
  console.log("Service Worker instalado");
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

// 🔹 ACTIVACIÓN
self.addEventListener("activate", event => {
  console.log("Service Worker activado");

  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// 🔹 FETCH (manejo de solicitudes)
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
