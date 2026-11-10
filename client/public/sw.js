/**
 * Aarogya-Drishti Service Worker
 * Phase 17: App shell precaching and offline reference data caching.
 * 
 * INVARIANTS:
 * 1. Precaches App Shell (index.html, manifest.json, bundled assets).
 * 2. Caches read-only reference datasets (villages, hospitals, specialists) using Stale-While-Revalidate.
 * 3. Never intercepts or caches mutating requests (POST/PUT/PATCH/DELETE) or sensitive patient/auth routes.
 */

const CACHE_NAME = 'aarogya-drishti-v2-shell';
const REFERENCE_CACHE_NAME = 'aarogya-drishti-v2-reference';

const APP_SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/models/oral_model.onnx',
  '/models/dental_model.onnx',
  '/wasm/ort-wasm-simd-threaded.wasm',
  '/wasm/ort-wasm-simd-threaded.jsep.wasm',
  '/wasm/ort-wasm-simd-threaded.jsep.mjs',
];

// Whitelist of safe, read-only reference data paths to cache offline
const REFERENCE_DATA_PATHS = [
  '/api/v1/reference/villages',
  '/api/v1/hospitals',
  '/api/v1/specialists',
  '/api/v1/map/connectivity-zones',
  '/api/v1/map/boundaries/mandals',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== REFERENCE_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Mutating requests (POST, PUT, DELETE, PATCH) are handled via encrypted Dexie queue
  if (event.request.method !== 'GET') {
    return;
  }

  // 2. Safe Reference Data Caching (Stale-While-Revalidate with offline fallback)
  const isReferenceData = REFERENCE_DATA_PATHS.some((path) => url.pathname.startsWith(path));
  if (isReferenceData) {
    event.respondWith(
      caches.open(REFERENCE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(event.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => {
              // Network failed (offline in Paderu interior) - return cached reference data
              return cachedResponse;
            });

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // 3. Sensitive / Private API Routes (Never cached in plain ServiceWorker cache)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 4. App Shell & Static Asset Caching
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html') || caches.match('/');
        }
      });
    })
  );
});
