// =====================================================
// PENGATURAN.JS — Preferensi, pengingat backup, info
//                 penyimpanan, hapus semua data, tentang
// =====================================================

const APP_VERSION = '1.0';

// Nilai bawaan untuk data lama
if (appData.settings.backupReminderDays === undefined) {
  appData.settings.backupReminderDays = 7;
}

const settingsGeneral = document.getElementById('settings-general');
const settingsStorage = document.getElementById('settings-storage');
const settingsDanger = document.getElementById('settings-danger');
const settingsAbout = document.getElementById('settings-about');
const backupReminder = document.getElementById('backup-reminder');

let backupReminderDismissed = false;   // "Nanti" → disembunyikan sampai aplikasi dibuka lagi


// ===== 1. PREFERENSI =====
function renderSettingsGeneral() {
  const day = appData.settings.expectedTransferDay || '';
  const remind = appData.settings.backupReminderDays;
  const remindOptions = [[0, 'Mati'], [7, 'Setiap 7 hari'], [14, 'Setiap 14 hari'], [30, 'Setiap 30 hari']]
    .map(function (pair) {
      return `<option value="${pair[0]}" ${pair[0] === remind ? 'selected' : ''}>${pair[1]}</option>`;
    }).join('');

  // Pilihan tema: [nilai, ikon, label]
  const themeChoices = [['light', 'light_mode', 'Terang'], ['dark', 'dark_mode', 'Gelap'], ['auto', 'contrast', 'Ikuti HP']]
    .map(function (c) {
      return `
        <button type="button" class="segmented-btn ${getThemeSetting() === c[0] ? 'active' : ''}" data-theme-choice="${c[0]}">
          <span class="material-symbols-rounded">${c[1]}</span> ${c[2]}
        </button>
      `;
    }).join('');

  settingsGeneral.innerHTML = `
    <h2 class="card-title">Preferensi</h2>

    <div class="theme-label">Tema tampilan</div>
    <div class="segmented theme-picker">${themeChoices}</div>

    <form id="pref-form" novalidate>
      <div class="form-grid">
        <div class="field">
          <label for="pref-transfer-day">Tanggal kesepakatan transfer</label>
          <input type="number" id="pref-transfer-day" inputmode="numeric" min="1" max="31" value="${day}" placeholder="Contoh: 5">
        </div>
        <div class="field">
          <label for="pref-backup">Pengingat backup</label>
          <select id="pref-backup">${remindOptions}</select>
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">check</span> Simpan Preferensi
        </button>
      </div>
    </form>
  `;
}

function savePreferences(event) {
  event.preventDefault();

  const dayText = document.getElementById('pref-transfer-day').value.trim();
  const day = Number(dayText);
  if (dayText && (!Number.isInteger(day) || day < 1 || day > 31)) {
    showToast('Tanggal kesepakatan harus 1 sampai 31');
    return;
  }

  appData.settings.expectedTransferDay = dayText ? day : null;
  appData.settings.backupReminderDays = Number(document.getElementById('pref-backup').value);
  saveData();

  // Halaman Uang Bulanan memakai tanggal kesepakatan
  renderBulanan();
  if (!editingPeriodId) resetPeriodForm();

  backupReminderDismissed = false;
  renderBackupReminder();
  showToast('Preferensi disimpan');
}


// ===== 2. PENGINGAT BACKUP (banner di atas semua halaman) =====
function daysSinceLastBackup() {
  if (!appData.settings.lastBackupAt) return null;
  const last = dateToString(new Date(appData.settings.lastBackupAt));
  return daysBetween(last, todayString());
}

function renderBackupReminder() {
  const interval = appData.settings.backupReminderDays;
  const since = daysSinceLastBackup();

  // Tampil jika: pengingat aktif, sudah ada cukup data, dan sudah waktunya backup
  const due = interval > 0 &&
    appData.transactions.length >= 5 &&
    (since === null || since >= interval);

  if (!due || backupReminderDismissed) {
    backupReminder.innerHTML = '';
    return;
  }

  backupReminder.innerHTML = `
    <div class="reminder-item backup">
      <span class="material-symbols-rounded">backup</span>
      <div class="reminder-text">
        ${since === null
          ? '<strong>Data belum pernah di-backup.</strong> Simpan salinannya agar tidak hilang.'
          : `<strong>Backup terakhir ${since} hari lalu.</strong> Saatnya backup lagi.`}
      </div>
      <button type="button" class="link-btn" data-backup-now>Backup</button>
      <button type="button" class="link-btn" data-backup-later>Nanti</button>
    </div>
  `;
}


// ===== 3. INFO PENYIMPANAN =====
function renderSettingsStorage() {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  const sizeKb = (new Blob([raw]).size / 1024).toFixed(1);

  const rows = [
    ['Transaksi', appData.transactions.length],
    ['Kategori', appData.categories.length],
    ['Uang bulanan', appData.periods.length],
    ['Tagihan rutin', appData.bills.length],
    ['Catatan dana (saldo awal & pakai)', appData.fundMovements.length],
    ['Ukuran data', sizeKb + ' KB'],
    ['Dibuka sebagai aplikasi', isStandaloneApp() ? 'Ya' : 'Tidak (lewat browser)'],
    ['Dilindungi dari penghapusan otomatis', '<span id="persist-status">Memeriksa…</span>']
  ];

  settingsStorage.innerHTML = `
    <h2 class="card-title">Data & Penyimpanan</h2>
    <p class="card-text">Semua data hanya tersimpan di perangkat ini dan tidak dikirim ke mana pun.</p>
    <div class="info-list">
      ${rows.map(function (row) {
        return `<div class="info-row"><span>${row[0]}</span><strong>${row[1]}</strong></div>`;
      }).join('')}
    </div>
  `;

  // Apakah browser menjamin data tidak dihapus otomatis?
  const status = document.getElementById('persist-status');
  if (navigator.storage && navigator.storage.persisted) {
    navigator.storage.persisted().then(function (persisted) {
      status.textContent = persisted ? 'Ya' : 'Belum dijamin — rutin backup';
    });
  } else {
    status.textContent = 'Tidak diketahui — rutin backup';
  }
}


// ===== 4. HAPUS SEMUA DATA =====
function renderSettingsDanger() {
  settingsDanger.innerHTML = `
    <h2 class="card-title text-danger">Hapus Semua Data</h2>
    <p class="card-text">
      Menghapus seluruh transaksi, kategori buatan sendiri, uang bulanan, tabungan, dan tagihan
      di perangkat ini. Tindakan ini tidak bisa dibatalkan.
    </p>
    <label class="check-row">
      <input type="checkbox" id="danger-backup-first" checked>
      Unduh backup terlebih dahulu
    </label>
    <div class="button-row">
      <button type="button" class="btn btn-danger" id="btn-delete-all">
        <span class="material-symbols-rounded">delete_forever</span> Hapus Semua Data
      </button>
    </div>
  `;
}

function deleteAllData() {
  if (!confirm('Yakin ingin menghapus SEMUA data MyMoney di perangkat ini?')) return;

  const typed = prompt('Ketik HAPUS (huruf besar) untuk mengonfirmasi:');
  if (typed !== 'HAPUS') {
    showToast('Dibatalkan — data tidak dihapus');
    return;
  }

  if (document.getElementById('danger-backup-first').checked) {
    downloadBackup();
  }

  // Beri waktu agar file backup selesai diunduh, lalu hapus
  setTimeout(function () {
    Object.keys(localStorage)
      .filter(function (key) { return key.indexOf('mymoney-') === 0; })
      .forEach(function (key) { localStorage.removeItem(key); });
    location.hash = '#dashboard';
    location.reload();
  }, 1000);
}


// ===== 5. TENTANG APLIKASI =====
function renderSettingsAbout() {
  settingsAbout.innerHTML = `
    <div class="about">
      <img src="icons/icon-192.png" alt="" class="about-icon">
      <div>
        <div class="about-name">MyMoney – Personal Finance Tracker</div>
        <div class="about-meta">Versi ${APP_VERSION} · dibuat dengan HTML, CSS, dan JavaScript</div>
        <div class="about-meta">${location.origin + location.pathname.replace('index.html', '')}</div>
      </div>
    </div>
  `;
}


// ===== TAMPILKAN SEMUA =====
function renderPengaturan() {
  renderSettingsGeneral();
  renderSettingsStorage();
  renderSettingsDanger();
  renderSettingsAbout();
}


// ===== MENGHUBUNGKAN TOMBOL =====
settingsGeneral.addEventListener('submit', savePreferences);

// Ganti tema langsung saat tombol diklik (tanpa perlu tombol Simpan)
settingsGeneral.addEventListener('click', function (event) {
  const choice = event.target.closest('[data-theme-choice]');
  if (!choice) return;

  setTheme(choice.dataset.themeChoice);
  renderSettingsGeneral();
  showToast('Tema: ' + { light: 'Terang', dark: 'Gelap', auto: 'Ikuti HP' }[choice.dataset.themeChoice]);
});

settingsDanger.addEventListener('click', function (event) {
  if (event.target.closest('#btn-delete-all')) deleteAllData();
});

backupReminder.addEventListener('click', function (event) {
  if (event.target.closest('[data-backup-now]')) {
    downloadBackup();
    renderBackupReminder();
    renderSettingsStorage();
  }
  if (event.target.closest('[data-backup-later]')) {
    backupReminderDismissed = true;
    renderBackupReminder();
  }
});

// Setelah backup dari halaman Pengaturan, sembunyikan pengingat
document.getElementById('btn-backup').addEventListener('click', function () {
  setTimeout(renderBackupReminder, 0);
});

// Setiap pindah menu: perbarui pengingat; saat membuka Pengaturan: perbarui isinya
document.querySelectorAll('[data-page]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    renderBackupReminder();
    if (btn.dataset.page === 'pengaturan') renderPengaturan();
  });
});


// ===== SAAT APLIKASI DIBUKA =====
renderPengaturan();
renderBackupReminder();
