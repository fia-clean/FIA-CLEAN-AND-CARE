const CACHE_NAME = 'fia-clean-care-v51.2.33';

// Static core assets to pre-cache immediately on service worker install
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.png',
  './lib/tailwind.js',
  './lib/firebase-app-compat.js',
  './lib/firebase-database-compat.js',
  './lib/firebase-auth-compat.js',
  './lib/html2canvas.min.js',
  './lib/html2pdf.bundle.min.js',
  './lib/jspdf.umd.min.js',
  './lib/zxing.min.js',
  './modules/app.js',
  './modules/core/state.js',
  './modules/core/db.js',
  './modules/core/auth.js',
  './modules/core/biometrics.js',
  './modules/dashboard/dashboard.js',
  './modules/customers/customer.js',
  './modules/billing/invoice-preview.js',
  './modules/billing/billing-history.js',
  './modules/billing/billing.js',
  './modules/billing/product-analysis.js',
  './modules/operations/stock.js',
  './modules/operations/purchases.js',
  './modules/operations/expenses.js',
  './modules/daybook/daybook.js',
  './modules/dno/dno.js'
];

// External CDN dependencies to cache dynamically
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'www.gstatic.com',
  'accounts.google.com'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_ASSETS.map((asset) =>
          fetch(new Request(asset, { cache: 'reload' }))
            .then((res) => {
              if (res.ok) return cache.put(asset, res);
            })
            .catch((err) => {
              console.warn('Pre-cache warning for asset:', asset, err);
            })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Do not intercept non-GET requests (e.g. POST, PUT)
  if (request.method !== 'GET') {
    return;
  }

  // Bypass all Firebase database, auth, websocket and Google live endpoints
  if (
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // 1. Navigation / Document requests: Fast Network with 1200ms timeout, falling back to instant cache!
  if (request.mode === 'navigate' || request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: true })
          || await cache.match('./index.html', { ignoreSearch: true })
          || await cache.match('./');

        // If no cached version (first install), fetch from network
        if (!cached) {
          return fetch(request).then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          });
        }

        // Fast network race: If network responds within 1200ms, use it; otherwise serve cached shell instantly!
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => resolve(cached), 1200);
        });

        const networkPromise = fetch(request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              cache.put(request, networkRes.clone());
            }
            return networkRes;
          })
          .catch(() => cached);

        return Promise.race([networkPromise, timeoutPromise]);
      })
    );
    return;
  }

  // 2. Local app assets (HTML, manifest, icons, JS modules, CSS) - Stale While Revalidate (Instant Cache response!)
  if (url.origin === location.origin) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request, { ignoreSearch: true })
          || await cache.match(request.url.split('?')[0], { ignoreSearch: true });

        // Update in background silently
        const networkFetch = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => null);

        // If available in cache, serve IMMEDIATELY (0ms latency on mobile!)
        if (cached) {
          return cached;
        }

        // If not yet in cache, await network fetch
        const res = await networkFetch;
        return res || cached;
      })
    );
    return;
  }

  // 3. External CDN Libraries (Tailwind, Fonts, ZXing, html2pdf, Firebase SDK)
  const isCdn = CDN_HOSTS.some((host) => url.hostname.includes(host));
  if (isCdn) {
    event.respondWith(
      caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve from cache immediately, and refresh cache in background if online
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
            })
            .catch(() => {/* offline, ignore */});
          return cachedResponse;
        }

        // Not yet cached, fetch and store
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('Offline fetch failed for CDN resource:', request.url, err);
          });
      })
    );
  }
});
