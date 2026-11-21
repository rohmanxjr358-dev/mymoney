// =====================================================
// PWA.JS — Mendaftarkan service worker (mode aplikasi & offline)
// =====================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (error) {
      console.warn('Service worker tidak bisa didaftarkan:', error);
    });
  });
}

// true jika dibuka dari ikon layar utama (bukan dari browser)
function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
