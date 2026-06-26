const CACHE_NAME = "risk-copilot-cache-v2";
const ASSETS = [
  "/manifest.json",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png"
];

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Caching app shell");
        return cache.addAll(ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              console.log("[Service Worker] Removing old cache", key);
              return caches.delete(key);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isServerStateRequest =
    url.pathname.startsWith("/v1/") || url.pathname === "/health" || url.pathname === "/ready";

  // Transaction state and SSE always go directly to the authoritative server.
  if (e.request.method !== "GET" || url.origin !== self.location.origin || isServerStateRequest) {
    return;
  }

  // Never serve cached HTML across deploys. Vite emits content-hashed assets, so stale
  // index.html can point at asset filenames that no longer exist on the static host.
  if (isNavigationRequest(e.request)) {
    e.respondWith(fetch(e.request, { cache: "no-store" }));
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (stale-while-revalidate)
        fetch(e.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse.clone()));
            }
          })
          .catch(() => {
            /* ignore background fetch errors */
          });

        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
