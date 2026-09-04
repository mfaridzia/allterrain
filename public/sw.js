// ALLTERRAIN PWA Service Worker
const CACHE_NAME = "allterrain-cache-v1";

const PRECACHE_URLS = [
  "/",
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/favicon.ico"
];

// 1. Install Event: Precache core assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up old caches & take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// 3. Fetch Event Strategy:
// - API calls (/api/): Network only
// - Navigation requests (pages): Network-first with cache fallback
// - Static assets (_next/static, images, fonts): Cache-first with network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Bypass API routes completely
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Navigation requests (HTML pages): Network-first
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const fallback = await caches.match("/");
          if (fallback) return fallback;
          return new Response("Offline. Harap periksa koneksi internet Anda.", {
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        })
    );
    return;
  }

  // Static Assets (_next/static, images, icons, fonts): Stale-While-Revalidate
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2|ttf)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
  }
});
