/* Offline cache. Bump CACHE when files change so returning players pick up
   the new build instead of a stale one. */
var CACHE = 'blockhead-zombies-v1';
var ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './js/data.js', './js/mapdata.js', './js/audio.js', './js/secrets.js',
  './js/input.js', './js/render.js', './js/game.js', './js/main.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
      .catch(function () { /* a missing optional asset shouldn't block install */ })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  // Google Fonts and anything cross-origin: network, fall back to cache.
  if (url.origin !== location.origin) {
    e.respondWith(
      fetch(e.request).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return r;
      }).catch(function () { return caches.match(e.request); })
    );
    return;
  }
  // Own assets: cache first, so the game opens instantly and works on a plane.
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      return hit || fetch(e.request).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        return r;
      });
    })
  );
});
