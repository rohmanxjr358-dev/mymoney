// =====================================================
// BACKUP.JS — Unduh backup & pulihkan data
// =====================================================

const btnBackup = document.getElementById('btn-backup');
const btnRestore = document.getElementById('btn-restore');
const restoreFile = document.getElementById('restore-file');


// ===== TAMPILKAN RINGKASAN DATA =====
function updateBackupInfo() {
  document.getElementById('info-total-transaksi').textContent = appData.transactions.length;
  document.getElementById('info-total-kategori').textContent = appData.categories.length;
  document.getElementById('info-last-backup').textContent = appData.settings.lastBackupAt
    ? formatDateTime(appData.settings.lastBackupAt)
    : 'Belum pernah';
}


// ===== BACKUP =====
// Di HP: membuka menu Bagikan → simpan ke Google Drive / Files / kirim ke WhatsApp sendiri.
// Di laptop (atau jika menu Bagikan tidak tersedia): langsung mengunduh file.
function downloadBackup() {
  const fileName = 'mymoney-backup-' + todayString() + '.json';
  const text = JSON.stringify(appData, null, 2);

  const markDone = function (message) {
    appData.settings.lastBackupAt = new Date().toISOString();
    saveData();
    updateBackupInfo();
    if (typeof renderBackupReminder === 'function') renderBackupReminder();
    showToast(message);
  };

  const download = function () {
    const blob = new Blob([text], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    markDone('Backup berhasil diunduh');
  };

  const isPhone = window.matchMedia('(max-width: 768px)').matches;
  let file = null;
  try { file = new File([text], fileName, { type: 'application/json' }); } catch (e) { file = null; }

  if (isPhone && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: 'Backup MyMoney', text: 'Backup MyMoney ' + todayString() })
      .then(function () { markDone('Backup terkirim ✅ Simpan baik-baik ya'); })
      .catch(function (error) {
        // Dibatalkan pengguna → tidak apa-apa; error lain → unduh biasa
        if (error && error.name !== 'AbortError') download();
      });
    return;
  }
  download();
}


// ===== CADANGAN OTOMATIS (dibuat storage.js setiap hari) =====
function renderAutoBackup() {
  const card = document.getElementById('auto-backup');
  if (!card) return;

  const boxes = AUTO_BACKUP_KEYS.map(function (key) { return { key: key, box: readAutoBackup(key) }; })
    .filter(function (x) { return x.box; });

  card.innerHTML = `
    <h2 class="card-title">Cadangan Otomatis</h2>
    <p class="card-text">MyMoney menyalin datamu otomatis setiap hari (2 hari terakhir) di HP ini.
      Berguna jika ada yang salah setelah pembaruan. Ini <strong>bukan pengganti</strong> backup ke Drive,
      karena ikut hilang jika aplikasi dihapus.</p>
    ${appData.settings.recoveredFromAuto ? `<p class="card-text text-danger">⚠️ Data utama sempat rusak dan sudah
      dipulihkan otomatis dari cadangan ${formatDateTime(appData.settings.recoveredFromAuto)}.</p>` : ''}
    <div class="auto-backup-list">
      ${boxes.length ? boxes.map(function (x) {
        const count = Array.isArray(x.box.data.transactions) ? x.box.data.transactions.length : 0;
        return `
          <div class="info-row">
            <span>${formatDateTime(x.box.savedAt)}<br><small>${count} transaksi</small></span>
            <button type="button" class="btn btn-secondary" data-auto-restore="${x.key}">
              <span class="material-symbols-rounded">history</span> Kembalikan
            </button>
          </div>
        `;
      }).join('') : '<p class="empty-state">Cadangan pertama dibuat besok saat aplikasi dibuka.</p>'}
    </div>
  `;
}

function restoreAutoBackup(key) {
  const box = readAutoBackup(key);
  if (!box) return;
  const count = Array.isArray(box.data.transactions) ? box.data.transactions.length : 0;
  if (!confirm('Kembalikan data ke kondisi ' + formatDateTime(box.savedAt) + ' (' + count + ' transaksi)?\n\n' +
    'Catatan setelah waktu itu akan hilang. Data sekarang disalin dulu untuk berjaga-jaga.')) return;

  localStorage.setItem(STORAGE_KEY + '-sebelum-restore', JSON.stringify(appData));
  appData = sanitizeData(box.data);
  saveData();
  alert('Data dikembalikan. Aplikasi akan dimuat ulang.');
  location.reload();
}

document.getElementById('auto-backup').addEventListener('click', function (event) {
  const button = event.target.closest('[data-auto-restore]');
  if (button) restoreAutoBackup(button.dataset.autoRestore);
});


// ===== PULIHKAN DARI FILE BACKUP =====
function restoreBackup(file) {
  const reader = new FileReader();

  reader.onload = function () {
    let parsed;

    // 1. Pastikan isi file bisa dibaca
    try {
      parsed = JSON.parse(reader.result);
    } catch (error) {
      showToast('File tidak bisa dibaca. Pilih file backup MyMoney (.json).');
      return;
    }

    // 2. Pastikan ini benar-benar file backup MyMoney
    if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions)) {
      showToast('File ini bukan backup MyMoney.');
      return;
    }

    // 3. Minta konfirmasi
    const ok = confirm(
      'Data di perangkat ini akan DIGANTI dengan isi file backup (' +
      parsed.transactions.length + ' transaksi). Lanjutkan?'
    );
    if (!ok) return;

    // 4. Simpan salinan data lama untuk berjaga-jaga
    localStorage.setItem(STORAGE_KEY + '-sebelum-restore', JSON.stringify(appData));

    // 5. Ganti data, simpan, lalu muat ulang aplikasi
    appData = sanitizeData(parsed);
    saveData();
    alert('Data berhasil dipulihkan. Aplikasi akan dimuat ulang.');
    location.reload();
  };

  reader.readAsText(file);
}


// ===== MENGHUBUNGKAN TOMBOL =====
btnBackup.addEventListener('click', downloadBackup);

btnRestore.addEventListener('click', function () {
  restoreFile.value = '';   // reset agar file yang sama bisa dipilih lagi
  restoreFile.click();      // buka jendela pilih file
});

restoreFile.addEventListener('change', function () {
  if (restoreFile.files[0]) {
    restoreBackup(restoreFile.files[0]);
  }
});

// Tampilkan ringkasan saat aplikasi dibuka
updateBackupInfo();
renderAutoBackup();