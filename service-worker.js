/* LOTEKA / Grupo Ortiz
   CAPA 4 · Service Worker / Cache / PWA / Redirecciones
   Objetivo: evitar HTML viejo, mezclar web/app/monitoreo y cachear Supabase/API.
   Web operacional: /index.html
   App móvil: /app.html
   Monitoreo: /pantalla.html
   Versión: 2026-05-22-capa4-v1
*/

const SW_VERSION = "2026-05-22-capa4-v2";
const STATIC_CACHE = `loteka-static-${SW_VERSION}`;
const HTML_CACHE = `loteka-html-${SW_VERSION}`;
const RUNTIME_CACHE = `loteka-runtime-${SW_VERSION}`;

const WEB_OPERACIONAL = "/index.html";
const APP_MOVIL = "/app.html";
const APP_MOVIL_ALT = "/app-reportes.html";
const MONITOREO = "/pantalla.html";
const MONITOREO_ALT = "/monitoreo-operaciones.html";

const HTML_ROUTES = new Set([
  "/",
  WEB_OPERACIONAL,
  APP_MOVIL,
  APP_MOVIL_ALT,
  MONITOREO,
  MONITOREO_ALT
]);

const PRECACHE_STATIC = [
  "/manifest.json",
  "/manifest-app-movil.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192.svg",
  "/icon-512.svg",
  "/loteka-go-logo.webp",
  "/sounds/whatsapp.mp3"
];

function normalizeHtmlPath(pathname) {
  if (pathname === "/") return WEB_OPERACIONAL;
  if (pathname === APP_MOVIL_ALT) return APP_MOVIL_ALT;
  if (pathname === MONITOREO_ALT) return MONITOREO_ALT;
  return pathname;
}

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isSupabaseOrExternalApi(url) {
  return (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("appwrite.io") ||
    url.hostname.includes("r2.dev") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/storage/v1/object")
  );
}

function isHtmlRequest(request, url) {
  const acceptsHtml = (request.headers.get("accept") || "").includes("text/html");
  return request.mode === "navigate" || acceptsHtml || HTML_ROUTES.has(url.pathname);
}

function isManifest(url) {
  return url.pathname === "/manifest.json" || url.pathname === "/manifest-app-movil.json";
}

function isStaticAsset(url) {
  const path = url.pathname;

  if (path === "/service-worker.js") return false;

  if (path.startsWith("/assets/") || path.startsWith("/sounds/")) return true;
  if (path.startsWith("/icon-") || path === "/loteka-go-logo.webp") return true;

  return /\.(png|jpg|jpeg|webp|svg|gif|ico|mp3|wav|ogg|css|js|json|woff2?|ttf)$/i.test(path);
}

async function putSafe(cacheName, keyUrl, response) {
  try {
    if (!response || !response.ok) return;

    const cache = await caches.open(cacheName);
    await cache.put(keyUrl, response.clone());
  } catch (error) {
    console.warn("[LOTEKA SW] No se pudo guardar en cache:", keyUrl, error);
  }
}

async function networkFirstHtml(request, url) {
  const normalizedPath = normalizeHtmlPath(url.pathname);
  const cacheKey = new Request(new URL(normalizedPath, self.location.origin).toString(), {
    method: "GET"
  });

  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok) {
      await putSafe(HTML_CACHE, cacheKey, response);
    }

    return response;
  } catch (error) {
    const cachedExact = await caches.match(cacheKey);

    if (cachedExact) return cachedExact;

    // No mezclar web, móvil y monitoreo.
    // Solo "/" puede caer a index porque "/" representa la web operacional.
    if (url.pathname === "/") {
      const cachedIndex = await caches.match(
        new Request(new URL(WEB_OPERACIONAL, self.location.origin).toString())
      );

      if (cachedIndex) return cachedIndex;
    }

    return new Response(
      "<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>LOTEKA sin conexión</title></head><body style=\"font-family:system-ui;background:#071d32;color:#eaf6ff;padding:24px\"><h1>Sin conexión</h1><p>No se pudo cargar esta pantalla. Revisa tu conexión e intenta de nuevo.</p></body></html>",
      {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/html; charset=utf-8" }
      }
    );
  }
}

async function networkFirstManifest(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });

    if (response && response.ok) {
      await putSafe(STATIC_CACHE, request, response);
    }

    return response;
  } catch (error) {
    return (await caches.match(request)) || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);

  if (cached) return cached;

  const response = await fetch(request);

  if (response && response.ok) {
    await putSafe(STATIC_CACHE, request, response);
  }

  return response;
}

async function staleWhileRevalidateRuntime(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  return cached || networkPromise || Response.error();
}

self.addEventListener("install", (event) => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      for (const file of PRECACHE_STATIC) {
        try {
          const response = await fetch(file, { cache: "no-store" });

          if (response && response.ok) {
            await cache.put(file, response.clone());
          }
        } catch (error) {
          console.warn("[LOTEKA SW] No se pudo precargar:", file);
        }
      }
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => {
              return (
                key.startsWith("loteka-") &&
                ![STATIC_CACHE, HTML_CACHE, RUNTIME_CACHE].includes(key)
              );
            })
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Nunca cachear Supabase, Appwrite, R2, APIs del proyecto ni evidencias dinámicas.
  if (!sameOrigin(url) || isSupabaseOrExternalApi(url)) return;

  if (url.pathname === "/service-worker.js") {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirstHtml(request, url));
    return;
  }

  if (isManifest(url)) {
    event.respondWith(networkFirstManifest(request));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  event.respondWith(staleWhileRevalidateRuntime(request));
});

self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {
      title: "LOTEKA",
      body: "Nueva notificación"
    };
  }

  const title = data.title || "LOTEKA Operaciones";
  const targetUrl = data.url || APP_MOVIL;

  const options = {
    body: data.body || "Tienes una nueva notificación",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    vibrate: [200, 100, 200],
    tag: data.tag || "loteka-notificacion",
    renotify: true,
    data: {
      url: targetUrl
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

  const absoluteTarget = new URL(targetUrl, self.location.origin);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);

          if (
            clientUrl.origin === absoluteTarget.origin &&
            clientUrl.pathname === absoluteTarget.pathname &&
            "focus" in client
          ) {
            return client.focus();
          }
        } catch (error) {}
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteTarget.toString());
      }
    })
  );
});
