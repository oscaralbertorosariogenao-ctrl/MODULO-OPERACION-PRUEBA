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

const SW_VERSION = "2026-07-27-v805.15-route-permissions";

const STATIC_CACHE = `loteka-static-${SW_VERSION}`;
const HTML_CACHE = `loteka-html-${SW_VERSION}`;
const RUNTIME_CACHE = `loteka-runtime-${SW_VERSION}`;
let userRequestedActivation = false;

const INDEX_HTML = "/index.html";
const APP_HTML = "/app.html";
const PANTALLA_HTML = "/pantalla.html";

const IS_DEV_HOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1" ||
  self.location.hostname === "0.0.0.0";

const HTML_ROUTES = new Set([
  "/",
  INDEX_HTML,
  APP_HTML,
  PANTALLA_HTML
]);

const SUPABASE_CDN_PRIMARY = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js";
const SUPABASE_CDN_FALLBACK = "https://unpkg.com/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js";
const ZXING_CDN = "https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js";

const CORE_ASSETS = [
  "/manifest-app-movil.json",
  "/version.json",
  "/assets/app/css/app.css",
  "/assets/app/css/base.css",
  "/assets/app/css/components.css",
  "/assets/app/css/layout.css",
  "/assets/app/css/pages/agencies.css",
  "/assets/app/css/pages/agency-detail.css",
  "/assets/app/css/pages/home.css",
  "/assets/app/css/pages/login.css",
  "/assets/app/css/pages/map.css",
  "/assets/app/css/pages/notifications.css",
  "/assets/app/css/pages/operation-detail.css",
  "/assets/app/css/pages/operation-form.css",
  "/assets/app/css/pages/operations.css",
  "/assets/app/css/pages/profile.css",
  "/assets/app/css/pages/scanner.css",
  "/assets/app/css/pages/technicians.css",
  "/assets/app/css/reset.css",
  "/assets/app/css/responsive.css",
  "/assets/app/css/tokens.css",
  "/assets/app/css/utilities.css",
  "/assets/app/img/app-icon-192.png",
  "/assets/app/img/app-icon-512.png",
  "/assets/app/img/app-icon-maskable-512.png",
  "/assets/app/img/grupo-ortiz-go-icon.png",
  "/assets/app/img/grupo-ortiz-icon.png",
  "/assets/app/img/grupo-ortiz-logo-clean.png",
  "/assets/app/img/grupo-ortiz-operaciones-wide.webp",
  "/assets/app/js/api/agencies-api.js",
  "/assets/app/js/api/equipment-api.js",
  "/assets/app/js/api/evidence-api.js",
  "/assets/app/js/api/notifications-api.js",
  "/assets/app/js/api/operations-api.js",
  "/assets/app/js/api/profiles-api.js",
  "/assets/app/js/app-controller.js",
  "/assets/app/js/auth.js",
  "/assets/app/js/components/action-dialogs.js",
  "/assets/app/js/components/app-drawer.js",
  "/assets/app/js/components/app-header.js",
  "/assets/app/js/components/bottom-navigation.js",
  "/assets/app/js/components/bottom-sheet.js",
  "/assets/app/js/components/confirm-dialog.js",
  "/assets/app/js/components/dom.js",
  "/assets/app/js/components/empty-state.js",
  "/assets/app/js/components/evidence-uploader.js",
  "/assets/app/js/components/filter-sheet.js",
  "/assets/app/js/components/loader.js",
  "/assets/app/js/components/modal.js",
  "/assets/app/js/components/offline-banner.js",
  "/assets/app/js/components/operation-card.js",
  "/assets/app/js/components/scanner-inventory-dialogs.js",
  "/assets/app/js/components/search-input.js",
  "/assets/app/js/components/skeleton.js",
  "/assets/app/js/components/status-badge.js",
  "/assets/app/js/components/toast.js",
  "/assets/app/js/config.js",
  "/assets/app/js/connectivity.js",
  "/assets/app/js/errors.js",
  "/assets/app/js/event-controller.js",
  "/assets/app/js/main.js",
  "/assets/app/js/permissions.js",
  "/assets/app/js/realtime.js",
  "/assets/app/js/router.js",
  "/assets/app/js/services/data-service.js",
  "/assets/app/js/services/draft-service.js",
  "/assets/app/js/services/evidence-service.js",
  "/assets/app/js/services/location-service.js",
  "/assets/app/js/services/notification-service.js",
  "/assets/app/js/services/operations-service.js",
  "/assets/app/js/services/pwa-service.js",
  "/assets/app/js/services/scanner-inventory-service.js",
  "/assets/app/js/services/scanner-service.js",
  "/assets/app/js/store.js",
  "/assets/app/js/supabase-client.js",
  "/assets/app/js/vendor/supabase-loader.js",
  "/assets/app/js/views/agencies-view.js",
  "/assets/app/js/views/agency-detail-view.js",
  "/assets/app/js/views/app-frame-view.js",
  "/assets/app/js/views/home-view.js",
  "/assets/app/js/views/login-view.js",
  "/assets/app/js/views/map-view.js",
  "/assets/app/js/views/notifications-view.js",
  "/assets/app/js/views/operation-detail-view.js",
  "/assets/app/js/views/operation-form-view.js",
  "/assets/app/js/views/operations-view.js",
  "/assets/app/js/views/profile-view.js",
  "/assets/app/js/views/scanner-view.js",
  "/assets/app/js/views/technicians-view.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js",
];

const OPTIONAL_ASSETS = [
  "/manifest.json",
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
  "/assets/logos/loteka-neon-bg.webp",
  "https://unpkg.com/@supabase/supabase-js@2.57.0/dist/umd/supabase.min.js",
  "https://unpkg.com/@zxing/browser@0.2.1/umd/zxing-browser.min.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css",
  "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/layers.png",
  "https://unpkg.com/leaflet@1.9.4/dist/images/layers-2x.png",
];

const STATIC_ASSETS = [...CORE_ASSETS, ...OPTIONAL_ASSETS];
const TRUSTED_CDN_ASSETS = new Set(STATIC_ASSETS.filter((asset) => /^https?:\/\//.test(asset)));

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isTrustedCdn(url) {
  return TRUSTED_CDN_ASSETS.has(url.href);
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

async function fetchPrecacheAsset(asset) {
  const external = /^https?:\/\//.test(asset);
  const response = await fetch(asset, {
    cache: "no-store",
    credentials: external ? "omit" : "same-origin",
    mode: external ? "cors" : "same-origin"
  });
  if (!response || !response.ok) {
    throw new Error(`No se pudo precargar ${asset}: ${response?.status || "sin respuesta"}`);
  }
  return response;
}

async function runPrecachePool(assets, worker, concurrency = 6) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, assets.length) }, async () => {
    while (cursor < assets.length) {
      const index = cursor++;
      await worker(assets[index]);
    }
  });
  await Promise.all(runners);
}

async function precacheRequiredAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await runPrecachePool(CORE_ASSETS, async (asset) => {
    const response = await fetchPrecacheAsset(asset);
    await cache.put(asset, response.clone());
  });
}

async function precacheOptionalAssets() {
  const cache = await caches.open(STATIC_CACHE);
  await runPrecachePool(OPTIONAL_ASSETS, async (asset) => {
    try {
      const response = await fetchPrecacheAsset(asset);
      await cache.put(asset, response.clone());
    } catch (error) {
      console.warn("[LOTEKA SW] Asset opcional no precargado:", asset);
    }
  }, 4);
}

async function precacheAppShellHtml() {
  const cache = await caches.open(HTML_CACHE);
  const response = await fetch(APP_HTML, { cache: "no-store", credentials: "same-origin" });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("text/html")) {
    throw new Error(`app.html no es válido: ${response.status}`);
  }
  await cache.put(APP_HTML, response.clone());
}

self.addEventListener("install", (event) => {
  /*
    El núcleo móvil es obligatorio. Si durante un deploy falta un módulo,
    esta versión no se instala y el teléfono conserva el Service Worker anterior.
  */
  event.waitUntil((async () => {
    await Promise.all([
      precacheRequiredAssets(),
      precacheAppShellHtml()
    ]);
    await precacheOptionalAssets();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      await Promise.all(
        keys
          .filter((key) => key.startsWith("loteka-") && key !== STATIC_CACHE && key !== HTML_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      // Solo tomamos control inmediato cuando el usuario pulsó “Actualizar”.
      if (userRequestedActivation) await clients.claim();
    })
  );
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
    userRequestedActivation = true;
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // En Live Server/local no cacheamos nada.
  if (IS_DEV_HOST) return;

  // Nunca interceptar Supabase, Appwrite, R2 ni APIs internas.
  if (isDynamicOrExternalApi(url)) return;

  // Solo dependencias CDN fijadas y conocidas pueden cachearse desde origen externo.
  if (!sameOrigin(url) && !isTrustedCdn(url)) return;
  if (isTrustedCdn(url)) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

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
            const navigatePromise = "navigate" in client && client.url !== absoluteTarget.toString()
              ? client.navigate(absoluteTarget.toString()).catch(() => client)
              : Promise.resolve(client);
            return navigatePromise.then((targetClient) => targetClient?.focus?.());
          }
        } catch (error) {}
      }

      if (clients.openWindow) {
        return clients.openWindow(absoluteTarget.toString());
      }
    })
  );
});
