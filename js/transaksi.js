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


// ===== CEGAH SALAH KETIK =====
// Nominal sangat besar (kemungkinan kelebihan nol) dan tanggal yang belum terjadi
// minta konfirmasi dulu, karena keduanya langsung mengubah saldo.
const AMOUNT_WARN_LIMIT = 10000000;

function confirmAmount(amount) {
  if (amount <= AMOUNT_WARN_LIMIT) return true;
  return confirm('Nominal ' + formatRupiah(amount) + ' — sudah benar?\n\nCek lagi, mungkin ada angka nol yang berlebih.');
}

function confirmFutureDate(date) {
  if (!date || date <= todayString()) return true;
  return confirm('Tanggal ' + formatShortDate(date) + ' belum terjadi.\n\nSaldo langsung berubah sejak sekarang. Tetap simpan?');
}


// ===== UBAH TRANSAKSI → buka form ➕ dalam mode ubah =====
function startEdit(id) {
  openFab({ editId: id });
}


// ===== HAPUS TRANSAKSI =====
function deleteTransaction(id) {
  const tx = findTransaction(id);
  if (!tx) return;

  // Uang bulanan dihapus lewat menunya sendiri supaya periodenya ikut terhapus
  if (appData.periods && appData.periods.some(function (p) { return p.transactionId === tx.id; })) {
    showToast('Hapus uang bulanan lewat menu Uang Bulanan');
    return;
  }

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

  if (typeof refreshAfterTransactionChange === 'function') refreshAfterTransactionChange();
  else updateBackupInfo();
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
