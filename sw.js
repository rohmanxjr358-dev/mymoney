// =====================================================
// SW.JS — Service worker: aplikasi tetap bisa dibuka saat offline / sinyal lemah
// =====================================================
//
// 1. Saat dipasang: SEMUA file aplikasi langsung disimpan (dibaca otomatis dari
//    index.html), termasuk grafik (Chart.js), huruf, dan ikon. Jadi walau sebuah
//    halaman belum pernah dibuka, tetap bisa tampil saat offline.
// 2. Saat dipakai: coba ambil versi terbaru dari internet. Jika internet lambat
//    (lebih dari 3,5 detik), langsung pakai salinan tersimpan supaya aplikasi cepat
//    terbuka — versi terbaru tetap diunduh di belakang untuk pembukaan berikutnya.
//
// Ganti CACHE_NAME jika ingin memaksa semua HP membuang salinan lama.

const CACHE_NAME = 'mymoney-v2';
const NETWORK_TIMEOUT = 3500;

// Alamat luar yang boleh disimpan (huruf, ikon, grafik)
const CACHEABLE_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];


// ===== 1. PASANG: simpan semua file aplikasi =====
async function precacheAll() {
  const cache = await caches.open(CACHE_NAME);
  const indexResponse = await fetch('./index.html', { cache: 'no-cache' });
  const html = await indexResponse.clone().text();
  await cache.put('./index.html', indexResponse);
  await cache.put('./', new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }));

  // Semua css/, js/, icons/ dan alamat luar yang disebut di index.html
  const local = new Set(['./manifest.webmanifest']);
  const external = new Set();
  const pattern = /(?:href|src)="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(html))) {
    const url = match[1];
    if (/^(css|js|icons)\//.test(url) || url === 'manifest.webmanifest') local.add('./' + url);
    else if (/^https:\/\//.test(url) && CACHEABLE_HOSTS.includes(new URL(url).hostname)) external.add(url);
  }

  // File sendiri: satu gagal tidak membatalkan yang lain
  await Promise.all(Array.from(local).map(function (url) {
    return cache.add(url).catch(function () {});
  }));

  // File luar (Chart.js, CSS huruf) + file huruf di dalam CSS tersebut
  await Promise.all(Array.from(external).map(async function (url) {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) return;
      await cache.put(url, response.clone());
      if (url.includes('fonts.googleapis.com')) {
        const css = await response.text();
        const fonts = css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"]+/g) || [];
        await Promise.all(fonts.map(function (fontUrl) {
          return fetch(fontUrl, { mode: 'cors' })
            .then(function (r) { if (r.ok) return cache.put(fontUrl, r); })
            .catch(function () {});
        }));
      }
    } catch (e) { /* offline saat pemasangan — akan disimpan saat dipakai */ }
  }));
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(precacheAll().catch(function () {}));
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


// ===== 2. PAKAI: internet dulu, salinan jika lambat / offline =====
self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameSite = url.origin === self.location.origin;
  if (!sameSite && !CACHEABLE_HOSTS.includes(url.hostname)) return;

  const fromNetwork = fetch(request).then(function (response) {
    if (response.ok || response.type === 'opaque') {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
    }
    return response;
  });

  const fromCache = function () {
    return caches.match(request, { ignoreSearch: true }).then(function (cached) {
      if (cached) return cached;
      return request.mode === 'navigate' ? caches.match('./index.html') : undefined;
    });
  };

  event.respondWith(new Promise(function (resolve) {
    let done = false;
    const finish = function (response) {
      if (!done && response) { done = true; resolve(response); }
    };

    // Internet lambat → pakai salinan (jika ada)
    const timer = setTimeout(function () { fromCache().then(finish); }, NETWORK_TIMEOUT);

    fromNetwork
      .then(function (response) { clearTimeout(timer); finish(response); })
      .catch(function () {
        clearTimeout(timer);
        fromCache().then(function (cached) {
          finish(cached || new Response('Offline', { status: 503, statusText: 'Offline' }));
        });
      });
  }));

  // Biarkan unduhan versi terbaru selesai walau salinan sudah dipakai
  event.waitUntil(fromNetwork.catch(function () {}));
});
