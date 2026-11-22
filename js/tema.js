// =====================================================
// TEMA.JS — Tema Terang / Gelap / Ikuti HP
// =====================================================
//
// Pilihan disimpan di appData.settings.theme:
//   'light' = terang, 'dark' = gelap (bawaan), 'auto' = ikuti pengaturan HP

const THEME_BAR_COLORS = { light: '#1d4ed8', dark: '#0b1120' };
const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

function getThemeSetting() {
  return appData.settings.theme || 'dark';
}

// Ubah 'auto' menjadi 'light' atau 'dark' sesuai pengaturan HP
function resolveTheme(setting) {
  if (setting === 'auto') return darkModeQuery.matches ? 'dark' : 'light';
  return setting;
}

function applyTheme() {
  const theme = resolveTheme(getThemeSetting());
  document.documentElement.setAttribute('data-theme', theme);

  // Warna bilah atas browser / HP
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_BAR_COLORS[theme]);
}

// Warna garis & teks grafik sesuai tema (dipakai dashboard.js & laporan.js)
function chartTheme() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    tick: dark ? '#94a3b8' : '#6b7280',
    grid: dark ? '#1e293b' : '#eef0f3',
    mutedRed: dark ? '#6b2a34' : '#f3a5a5'
  };
}

// Gambar ulang grafik agar warnanya ikut tema
function refreshChartsForTheme() {
  if (typeof renderDashChart === 'function') renderDashChart();
  if (typeof renderLaporan === 'function') renderLaporan();
}

function setTheme(setting) {
  appData.settings.theme = setting;
  saveData();
  applyTheme();
  refreshChartsForTheme();
}

// Mode "Ikuti HP": ikut berubah saat HP berpindah terang ↔ gelap
darkModeQuery.addEventListener('change', function () {
  if (getThemeSetting() === 'auto') {
    applyTheme();
    refreshChartsForTheme();
  }
});


// ===== SAAT APLIKASI DIBUKA =====
applyTheme();
