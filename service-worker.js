const CACHE_NAME = "loteka-pwa-v16";
const APP_SHELL = [
  "/",
  "/app-reportes.html",
  "/manifest.json",
  "/icon-192.svg",
  "/icon-512.svg",
  "/sounds/whatsapp.mp3"
];

// INSTALACIÓN
self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

// ACTIVACIÓN
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// FETCH
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Nunca cachear API ni Supabase
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase.co")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            url.origin === self.location.origin
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          if (request.mode === "navigate") {
            return caches.match("/app-reportes.html");
          }
        });
    })
  );
});

// PUSH
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "LOTEKA",
      body: event.data ? event.data.text() : "Nueva notificación"
    };
  }

  const title = data.title || "LOTEKA Operaciones";
  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: data.icon || "/icon-192.svg",
    badge: data.badge || "/icon-192.svg",
    image: data.image || undefined,
    vibrate: [200, 100, 200],
    tag: data.tag || "loteka-notification",
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || "/app-reportes.html",
      operationId: data.operationId || null,
      type: data.type || "general",
      role: data.role || null
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// CLICK EN NOTIFICACIÓN
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : "/app-reportes.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/app-reportes.html") && "focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
