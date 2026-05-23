/* ==========================================================================
   LOTEKA / Grupo Ortiz
   CAPA 7 · Service Worker seguro / anti-caídas / control de versiones

   Objetivo:
   - Evitar caídas durante deploy en Vercel.
   - No mezclar index.html, app.html y pantalla.html.
   - Supabase/Appwrite/R2/API siempre network-only.
   - HTML principales network-first + fallback exacto.
   - Assets cacheados por versión.
   - Sin skipWaiting agresivo ni clients.claim automático.
   ========================================================================== */

const SW_VERSION = "2026-05-23-capa7-safe-v1";

const STATIC_CACHE = `loteka-static-${SW_VERSION}`;
const HTML_CACHE = `loteka-html-${SW_VERSION}`;
const RUNTIME_CACHE = `loteka-runtime-${SW_VERSION}`;

const INDEX_HTML = "/index.html";
const APP_HTML = "/app.html";
const APP_REPORTES_HTML = "/app-reportes.html";
const PANTALLA_HTML = "/pantalla.html";
const MONITOREO_HTML = "/monitoreo-operaciones.html";

const IS_DEV_HOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "0.0.0.0";

const HTML_ROUTES = new Set([
  "/",
  INDEX_HTML,
  APP_HTML,
  APP_REPORTES_HTML,
  PANTALLA_HTML,
  MONITOREO_HTML
]);

const STATIC_ASSETS = [
  "/manifest.json",
  "/manifest-app-movil.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192.svg",
  "/icon-512.svg",
  "/loteka-go-logo.webp",
  "/sounds/whatsapp.mp3",
  "/assets/bg/login-brand-bg.webp",
  "/assets/logos/grupo-ortiz-home-watermark.png",
  "/assets/logos/grupo-ortiz-home-wide.png",
  "/assets/logos/grupo-ortiz-operaciones-watermark.webp",
  "/assets/logos/grupo-ortiz-operaciones-wide.webp",
  "/assets/logos/loteka-grupo-ortiz-icon.png",
  "/assets/logos/loteka-neon-bg.webp"
];

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isDynamicOrExternalApi(url) {
  return (
    url.hostname.includes("supabase.co") ||
    url.hostname.includes("appwrite.io") ||
    url.hostname.includes("r2.dev") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/storage/v1/object")
  );
}

function isServiceWorkerFile(url) {
  return url.pathname === "/service-worker.js";
}

function isHtmlRoute(url) {
  return HTML_ROUTES.has(url.pathname);
}

function isHtmlRequest(request, url) {
  const accept = request.headers.get("accept") || "";
  return request.mode === "navigate" || accept.includes("text/html") || isHtmlRoute(url);
}

function normalizeHtmlPath(pathname) {
  if (pathname === "/") return INDEX_HTML;
  return pathname;
}

function isManifest(url) {
  return url.pathname === "/manifest.json" || url.pathname === "/manifest-app-movil.json";
}

function isStaticAsset(url) {
  const path = url.pathname;

  if (isServiceWorkerFile(url)) return false;
  if (path.startsWith("/assets/")) return true;
  if (path.startsWith("/sounds/")) return true;
  if (path.startsWith("/icon-")) return true;
  if (path === "/loteka-go-logo.webp") return true;

  return /\.(png|jpg|jpeg|webp|svg|gif|ico|mp3|wav|ogg|css|js|json|woff2?|ttf)$/i.test(path);
}

function htmlOfflineResponse() {
  return new Response(
    `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>LOTEKA sin conexión</title>
  <style>
    body{
      margin:0;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      font-family:system-ui,-apple-system,Segoe UI,sans-serif;
      background:#071d32;
      color:#eaf6ff;
    }
    .box{
      width:min(440px,calc(100% - 32px));
      padding:24px;
      border-radius:22px;
      background:rgba(255,255,255,.07);
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 24px 70px rgba(0,0,0,.35);
    }
    h1{margin:0 0 8px;font-size:24px;}
    p{margin:0;color:#b8d7ee;line-height:1.5;}
    button{
      margin-top:18px;
      border:0;
      border-radius:14px;
      padding:12px 16px;
      font-weight:800;
      color:white;
      background:#0ea5c6;
      cursor:pointer;
    }
  </style>
</head>
<body>
  <div class="box">
    <h1>No se pudo cargar la pantalla</h1>
    <p>Revisa tu conexión o intenta actualizar nuevamente. Si acabas de desplegar una versión nueva, espera a que Vercel termine de propagar los archivos.</p>
    <button onclick="location.reload()">Intentar de nuevo</button>
  </div>
</body>
</html>`,
    {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );
}

async function putCacheSafe(cacheName, request, response) {
  try {
    if (!response || !response.ok) return;

    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  } catch (error) {
    console.warn("[LOTEKA SW] No se pudo guardar en cache:", error);
  }
}

async function networkFirstHtml(request, url) {
  const normalizedPath = normalizeHtmlPath(url.pathname);
  const cacheKey = new Request(new URL(normalizedPath, self.location.origin).toString(), {
    method: "GET",
    headers: {
      accept: "text/html"
    }
  });

  try {
    const response = await fetch(request, {
      cache: "no-store",
      credentials: "same-origin"
    });

    const contentType = response.headers.get("content-type") || "";
    const isValidHtml = response.ok && contentType.includes("text/html");

    if (isValidHtml) {
      await putCacheSafe(HTML_CACHE, cacheKey, response);
      return response;
    }

    if (response.status >= 500) {
      const cached = await caches.match(cacheKey);
      if (cached) return cached;
    }

    return response;
  } catch (error) {
    const cached = await caches.match(cacheKey);
    if (cached) return cached;

    return htmlOfflineResponse();
  }
}

async function networkFirstManifest(request) {
  try {
    const response = await fetch(request, {
      cache: "no-store",
      credentials: "same-origin"
    });

    if (response && response.ok) {
      await putCacheSafe(STATIC_CACHE, request, response);
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request, {
    cache: "reload",
    credentials: "same-origin"
  });

  if (response && response.ok) {
    await putCacheSafe(STATIC_CACHE, request, response);
  }

  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  return cached || networkPromise || Response.error();
}

self.addEventListener("install", (event) => {
  /*
    IMPORTANTE:
    No usamos self.skipWaiting() automático.

    Así evitamos que el service worker nuevo tome control mientras Vercel
    está en medio del deploy y todavía puede estar sirviendo archivos en transición.
  */

  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(
        STATIC_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, {
              cache: "no-store",
              credentials: "same-origin"
            });

            if (response && response.ok) {
              await cache.put(asset, response.clone());
            }
          } catch (error) {
            console.warn("[LOTEKA SW] Asset no precargado:", asset);
          }
        })
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => {
            return (
              key.startsWith("loteka-") &&
              key !== STATIC_CACHE &&
              key !== HTML_CACHE &&
              key !== RUNTIME_CACHE
            );
          })
          .map((key) => caches.delete(key))
      );
    })
  );

  /*
    IMPORTANTE:
    No usamos clients.claim() automático.

    La nueva versión tomará control en la próxima carga normal,
    o cuando el usuario acepte actualizar desde el aviso del sistema.
  */
});

self.addEventListener("message", (event) => {
  const data = event.data || {};

  /*
    Esto permite que index.html / app.html / pantalla.html muestren:
    “Nueva versión disponible”.

    Solo si el usuario toca “Actualizar ahora”, se manda:
    { type: "LOTEKA_ACTIVATE_NEW_VERSION" }
  */
  if (data && data.type === "LOTEKA_ACTIVATE_NEW_VERSION") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // En Live Server/local no cacheamos nada.
  if (IS_DEV_HOST) return;

  // Nunca interceptar Supabase, Appwrite, R2, APIs internas o externos.
  if (!sameOrigin(url) || isDynamicOrExternalApi(url)) return;

  // El service worker siempre debe buscarse directo de red.
  if (isServiceWorkerFile(url)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  // HTML principales: red primero, cache exacto solo como respaldo.
  if (isHtmlRequest(request, url)) {
    event.respondWith(networkFirstHtml(request, url));
    return;
  }

  // Manifest: red primero para evitar instalaciones viejas.
  if (isManifest(url)) {
    event.respondWith(networkFirstManifest(request));
    return;
  }

  // Assets: cache first, porque son pesados y cambian menos.
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // Otros recursos internos: rápido, con actualización de fondo.
  event.respondWith(staleWhileRevalidate(request));
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
  const targetUrl = data.url || APP_HTML;

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
      : APP_HTML;

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
