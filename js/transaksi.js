// =====================================================
// TRANSAKSI.JS — Alat bantu transaksi yang dipakai di seluruh aplikasi
// =====================================================
// Mencatat & mengubah transaksi dilakukan lewat tombol ➕ (fab.js).
// File ini hanya berisi fungsi bantu, hapus, dan urutkan.


// ===== ALAT BANTU =====
function currentTimeString() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function formatShortDate(dateString) {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

// Mencegah tulisan keterangan dianggap sebagai kode HTML
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function findCategory(id) {
  return appData.categories.find(function (cat) {
    return cat.id === id;
  }) || null;
}

function findTransaction(id) {
  return appData.transactions.find(function (tx) {
    return tx.id === id;
  }) || null;
}


// ===== UBAH TRANSAKSI → buka form ➕ dalam mode ubah =====
function startEdit(id) {
  openFab({ editId: id });
}


// ===== HAPUS TRANSAKSI =====
function deleteTransaction(id) {
  const tx = findTransaction(id);
  if (!tx) return;

  const category = findCategory(tx.categoryId);
  const name = category ? category.name : 'Transaksi';

  const ok = confirm(
    'Hapus transaksi "' + name + '" sebesar ' + formatRupiah(tx.amount) + '?\n\n' +
    'Transaksi yang dihapus tidak bisa dikembalikan.'
  );
  if (!ok) return;

  appData.transactions = appData.transactions.filter(function (item) {
    return item.id !== id;
  });
  saveData();

  updateBackupInfo();
  showToast('Transaksi dihapus');
}


// ===== URUTKAN: TERBARU DI ATAS =====
function sortTransactionsNewest(list) {
  return list.slice().sort(function (a, b) {
    const keyA = a.date + ' ' + a.time;
    const keyB = b.date + ' ' + b.time;
    if (keyA === keyB) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    }
    return keyB.localeCompare(keyA);
  });
}


// ===== DIPANGGIL FITUR LAIN SETELAH DATA BERUBAH =====
// (dulu menggambar daftar di form Catat; sekarang cukup memperbarui Dashboard jika sedang dibuka)
function renderRecentTransactions() {
  const dashboard = document.getElementById('page-dashboard');
  if (dashboard && dashboard.classList.contains('active') && typeof renderDashboard === 'function') {
    renderDashboard();
  }
}
