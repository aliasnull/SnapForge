/* ============================================================================
 * SnapForge service worker — app shell only.
 *
 * What this caches, and what it deliberately does not:
 *
 *   CACHED     the HTML document, the JS/CSS bundles, the icons and manifest.
 *              These are the app itself, identical for every user.
 *
 *   NOT CACHED anything the user creates or opens. Processed images, original
 *              files and object URLs never reach the network at all, so there
 *              is nothing here for this worker to see. There is no `fetch`
 *              handler for cross-origin requests and no runtime caching of
 *              image responses.
 *
 * The strategy is stale-while-revalidate for the shell: a returning visitor
 * gets an instant paint from cache, and the next load picks up a new build.
 * Navigations fall back to the cached document so a hash route works offline.
 * ========================================================================== */

const VERSION = 'snapforge-v1';
const SHELL_CACHE = `${VERSION}-shell`;

/**
 * The document itself. `./` resolves against the worker's own scope, so this
 * works whether the app is served from a domain root or a `/repo-name/`
 * subpath on GitHub Pages.
 */
const SHELL_URLS = ['./', './manifest.webmanifest', './favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually, so one missing optional file cannot fail the install.
      await Promise.all(
        SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

/** Only same-origin GETs are considered; everything else goes straight out. */
function isCacheable(request, url) {
  if (request.method !== 'GET') return false;
  if (url.origin !== self.location.origin) return false;
  return true;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (!isCacheable(request, url)) return;

  // Navigations: serve the cached document immediately, refresh it in the
  // background. Hash fragments are not sent to the server, so every route in
  // the app maps onto this one document.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match('./', { ignoreSearch: true });
        const network = fetch(request)
          .then((response) => {
            if (response && response.ok) cache.put('./', response.clone()).catch(() => {});
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(network);
          return cached;
        }

        const response = await network;
        return response ?? new Response('SnapForge is offline and no cached copy is available.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })(),
    );
    return;
  }

  // Build assets: cache-first, because Vite fingerprints their file names, so
  // a cached copy of `index-a1b2c3.js` can never be stale.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const fallback = await cache.match(request, { ignoreSearch: true });
        if (fallback) return fallback;
        throw error;
      }
    })(),
  );
});

/* The app asks the worker to drop its cache when the user clears local data. */
self.addEventListener('message', (event) => {
  if (event.data === 'snapforge:clear-cache') {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          names.filter((name) => name.startsWith(VERSION)).map((name) => caches.delete(name)),
        );
      })(),
    );
  }
});
