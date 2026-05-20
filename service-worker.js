/* LOTEKA / Grupo Ortiz
   Service Worker PWA estable
   App movil oficial: /app.html
   Web operacional: /index.html
   Version: 2026-05-20-v2
*/

const CACHE_NAME = "loteka-pwa-v20260520-v5";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/app.html",
  "/manifest.json",
  "/manifest-app-movil.json",
  "/icon-192.svg",
  "/icon-512.svg",
  "/sounds/whatsapp.mp3"
];

const APP_MOVIL = "/app.html";
const WEB_OPERACIONAL = "/index.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      for (const file of STATIC_FILES) {
        try {
          const response = await fetch(file, { cache: "reload" });
          if (response.ok) {
            await cache.put(file, response);
          }
        } catch (error) {
          console.warn("[LOTEKA SW] No se pudo cachear:", file);
        }
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("appwrite.io") ||
    url.hostname.includes("r2.dev") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  const isNavigation =
    request.mode === "navigate" ||
    request.headers.get("accept")?.includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(async () => {
        const path = url.pathname || "/";

        if (path.includes("app")) {
          return (
            (await caches.match(APP_MOVIL)) ||
            (await caches.match(WEB_OPERACIONAL))
          );
        }

        return (
          (await caches.match(WEB_OPERACIONAL)) ||
          (await caches.match(APP_MOVIL))
        );
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }

        return response;
      });
    })
  );
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "LOTEKA",
      body: "Nueva notificacion"
    };
  }

  const title = data.title || "LOTEKA Operaciones";

  const options = {
    body: data.body || "Tienes una nueva notificacion",
    icon: data.icon || "/icon-192.svg",
    badge: data.badge || "/icon-192.svg",
    vibrate: [200, 100, 200],
    tag: data.tag || "loteka-notificacion",
    renotify: true,
    data: {
      url: data.url || APP_MOVIL
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url
      ? event.notification.data.url
      : APP_MOVIL;

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(APP_MOVIL) && "focus" in client) {
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
