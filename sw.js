var CACHE_NAME = 'hsl-v1';
var ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/utils.js',
  './js/session.js',
  './js/api.js',
  './js/app.js',
  './manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  if (e.request.url.indexOf('script.google.com') !== -1) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (resp) {
        if (resp.ok && e.request.method === 'GET') {
          var clone = resp.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(e.request, clone);
          });
        }
        return resp;
      });
    }).catch(function () {
      if (e.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});
