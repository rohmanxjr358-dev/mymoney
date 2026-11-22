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


// ===== TAMPILAN TERKUNCI SEPERTI APLIKASI (tidak bisa di-zoom di HP) =====
// iPhone (Safari) mengabaikan "user-scalable=no", jadi gerakan cubit dicegah di sini.
['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
  document.addEventListener(name, function (event) { event.preventDefault(); }, { passive: false });
});

// Cubit dengan dua jari
document.addEventListener('touchmove', function (event) {
  if (event.touches.length > 1 || (event.scale !== undefined && event.scale !== 1)) event.preventDefault();
}, { passive: false });

