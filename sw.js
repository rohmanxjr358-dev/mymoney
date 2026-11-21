// =====================================================
// SW.JS — Service worker: agar aplikasi tetap bisa dibuka saat offline
// =====================================================
//
// Cara kerja "network first":
//   1. Selalu coba ambil versi terbaru dari internet.
//   2. Simpan salinannya di cache.
//   3. Jika sedang offline, pakai salinan dari cache.
// Jadi setiap pembaruan di GitHub langsung terpakai saat online.

const CACHE_NAME = 'mymoney-v1';

// Alamat luar yang boleh disimpan (huruf, ikon, grafik)
const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(['./', './index.html']);
    })
  );
});

// Hapus cache versi lama
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameSite = url.origin === self.location.origin;
  if (!sameSite && !CACHEABLE_HOSTS.includes(url.hostname)) return;

  event.respondWith(
    fetch(request)
      .then(function (response) {
        if (response.ok || response.type === 'opaque') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      })
      .catch(function () {
        return caches.match(request, { ignoreSearch: true }).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
  );
});
