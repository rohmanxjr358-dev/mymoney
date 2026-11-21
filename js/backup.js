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


// ===== UNDUH BACKUP =====
function downloadBackup() {
  // Catat waktu backup
  appData.settings.lastBackupAt = new Date().toISOString();
  saveData();

  // Ubah data menjadi teks rapi, lalu jadikan file
  const text = JSON.stringify(appData, null, 2);
  const file = new Blob([text], { type: 'application/json' });

  // Buat link unduhan sementara, klik otomatis, lalu hapus
  const link = document.createElement('a');
  link.href = URL.createObjectURL(file);
  link.download = 'mymoney-backup-' + todayString() + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();

  updateBackupInfo();
  showToast('Backup berhasil diunduh');
}


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
    appData = Object.assign(createEmptyData(), parsed);
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