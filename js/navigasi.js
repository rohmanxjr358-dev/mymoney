// =====================================================
// NAVIGASI.JS — Supaya terasa seperti aplikasi sungguhan
//   1. Tombol Kembali (Android) menutup popup / kembali ke Beranda
//   2. Ganti hari otomatis (tanggal & jatah "hari ini" ikut berganti)
//   3. Ajakan "Pasang ke layar utama" (data lebih aman & tidak terhapus)
// =====================================================


// ===== 1. TOMBOL KEMBALI =====
// Satu "lapisan" riwayat disisipkan. Saat tombol Kembali ditekan, lapisan itu
// terpakai → kita tutup yang sedang terbuka, lalu sisipkan lagi.
function pushBackGuard() {
  history.pushState({ mmGuard: true }, '', location.hash || '#dashboard');
}

// Menutup lapisan paling atas yang sedang terbuka. true = ada yang ditutup.
function closeTopLayer() {
  // Layar PIN tidak boleh dilewati dengan tombol Kembali
  if (document.documentElement.classList.contains('pin-open') ||
      document.documentElement.classList.contains('pin-locked')) return true;

  // Pengaturan awal: biarkan, jangan keluar
  if (document.querySelector('.onboard')) return true;

  const recap = document.getElementById('recap');
  if (recap && recap.classList.contains('open')) { closeRecap(); return true; }

  const fab = document.getElementById('fab-modal');
  if (fab && fab.classList.contains('open')) { closeFab(); return true; }

  const modals = document.querySelectorAll('.modal.open');
  if (modals.length) {
    const top = modals[modals.length - 1];
    const close = top.querySelector('.modal-header button[title="Tutup"]') ||
                  top.querySelector('.modal-backdrop') ||
                  top.querySelector('.btn-block');
    if (close) close.click();
    else top.classList.remove('open');
    return true;
  }

  const sheet = document.getElementById('more-sheet');
  if (sheet && sheet.classList.contains('open')) { closeMoreSheet(); return true; }

  const active = document.querySelector('.page.active');
  if (active && active.id !== 'page-dashboard') {
    const nav = document.querySelector('.bottom-nav [data-page="dashboard"], [data-page="dashboard"]');
    if (nav) nav.click(); else showPage('dashboard');
    return true;
  }
  return false;   // sudah di Beranda dan tidak ada yang terbuka
}

window.addEventListener('popstate', function () {
  if (closeTopLayer()) pushBackGuard();
  else history.back();   // keluar dari aplikasi seperti biasa
});

pushBackGuard();


// ===== 2. GANTI HARI OTOMATIS =====
// Di HP, aplikasi sering "dilanjutkan" dari latar belakang tanpa dimuat ulang.
let shownDay = todayString();

function refreshIfNewDay() {
  if (todayString() === shownDay) return;
  // Jangan ganggu saat sedang mengisi form; coba lagi nanti
  if (document.querySelector('.modal.open, #fab-modal.open, .onboard') ||
      document.documentElement.classList.contains('pin-open')) return;

  shownDay = todayString();
  showTodayDate();
  if (typeof renderBillReminder === 'function') renderBillReminder();
  if (typeof renderQuickAll === 'function') renderQuickAll();

  const active = document.querySelector('.page.active');
  const page = active ? active.id.replace('page-', '') : 'dashboard';
  if (page === 'dashboard') renderDashboard();
  else {
    const nav = document.querySelector('[data-page="' + page + '"]');
    if (nav) nav.click();   // menu memuat ulang isinya sendiri
  }
}

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'visible') refreshIfNewDay();
});
window.addEventListener('focus', refreshIfNewDay);
setInterval(refreshIfNewDay, 60000);


// ===== 3. AJAKAN PASANG KE LAYAR UTAMA =====
let installPromptEvent = null;   // Android/Chrome: tombol "Pasang" langsung

window.addEventListener('beforeinstallprompt', function (event) {
  event.preventDefault();
  installPromptEvent = event;
  if (typeof renderDashNudge === 'function') renderDashNudge();
});

window.addEventListener('appinstalled', function () {
  installPromptEvent = null;
  if (typeof renderDashNudge === 'function') renderDashNudge();
});

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function installCardHtml() {
  if (isStandaloneApp()) return '';
  if (!window.matchMedia('(max-width: 768px)').matches) return '';   // laptop: tidak perlu
  const snooze = appData.settings.installSnooze;
  if (snooze && daysBetween(snooze, todayString()) < 3) return '';

  const how = installPromptEvent
    ? 'Sekali ketuk, MyMoney jadi aplikasi di layar utama.'
    : isIos()
      ? 'Di Safari: ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas) → <strong>Tambah ke Layar Utama</strong>.'
      : 'Di Chrome: ketuk menu <strong>⋮</strong> → <strong>Tambahkan ke layar utama</strong>.';

  return `
    <div class="plan-card">
      <div class="transfer-head">
        <span class="transfer-emoji">📲</span>
        <div>
          <strong>Pasang MyMoney ke layar utama</strong>
          <small>Kalau dibuka lewat browser, catatanmu bisa terhapus otomatis oleh HP. ${how}</small>
        </div>
      </div>
      <div class="transfer-actions">
        ${installPromptEvent ? `<button type="button" class="btn btn-primary" data-install="go">
          <span class="material-symbols-rounded">install_mobile</span> Pasang</button>` : ''}
        <button type="button" class="transfer-later" data-install="later">Nanti saja</button>
      </div>
    </div>
  `;
}

document.addEventListener('click', function (event) {
  const btn = event.target.closest('[data-install]');
  if (!btn) return;
  if (btn.dataset.install === 'go' && installPromptEvent) {
    installPromptEvent.prompt();
    installPromptEvent = null;
  } else {
    appData.settings.installSnooze = todayString();
    saveData();
  }
  renderDashNudge();
});

if (typeof renderDashNudge === 'function') renderDashNudge();


// ===== 4. DUA TAB / JENDELA SEKALIGUS =====
// Jika data diubah di tab lain, tab ini memuat ulang supaya tidak menimpa catatan baru
// dengan data lamanya. Saat sedang mengisi form, pemuatan ulang ditunda sampai form ditutup.
let reloadFromOtherTab = false;

function isBusy() {
  return Boolean(document.querySelector('.modal.open, #fab-modal.open, .onboard, #recap.open')) ||
    document.documentElement.classList.contains('pin-open');
}

function reloadIfOtherTabChanged() {
  if (reloadFromOtherTab && !isBusy()) location.reload();
}

window.addEventListener('storage', function (event) {
  if (event.key !== STORAGE_KEY) return;
  reloadFromOtherTab = true;
  if (isBusy()) showToast('Data diperbarui di tab lain — dimuat ulang setelah form ditutup');
  reloadIfOtherTabChanged();
});
setInterval(reloadIfOtherTabChanged, 1500);

// Pengaman terakhir: menyimpan saat tab lain baru saja mengubah data →
// gabungkan dulu catatan dari tab lain (berdasarkan id) supaya tidak ada yang hilang.
function mergeFromStorage() {
  let stored;
  try { stored = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return; }
  if (!stored) return;
  Object.keys(stored).forEach(function (key) {
    const theirs = stored[key];
    const mine = appData[key];
    if (!Array.isArray(theirs) || !Array.isArray(mine)) return;
    const ids = new Set(mine.map(function (x) { return x && x.id; }));
    theirs.forEach(function (item) {
      if (item && item.id && !ids.has(item.id)) mine.push(item);
    });
  });
}

const originalSaveData = saveData;
saveData = function () {
  if (reloadFromOtherTab) mergeFromStorage();
  originalSaveData();
};
