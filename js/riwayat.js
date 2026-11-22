// =====================================================
// RIWAYAT.JS — Riwayat transaksi: cari, filter, urutkan
// =====================================================

const txTabButtons = document.querySelectorAll('#tx-tabs .tab');

const histSearch = document.getElementById('hist-search');
const histType = document.getElementById('hist-type');
const histCategory = document.getElementById('hist-category');
const histPeriod = document.getElementById('hist-period');
const histSort = document.getElementById('hist-sort');
const histFromField = document.getElementById('hist-from-field');
const histFrom = document.getElementById('hist-from');
const histToField = document.getElementById('hist-to-field');
const histTo = document.getElementById('hist-to');
const histResetButton = document.getElementById('hist-reset');
const histSummary = document.getElementById('hist-summary');
const histList = document.getElementById('hist-list');
const histMoreButton = document.getElementById('hist-more');

// Jumlah transaksi yang ditampilkan sekali muat
const HISTORY_PAGE_SIZE = 50;
let historyLimit = HISTORY_PAGE_SIZE;


// ===== PINDAH TAB: CATAT / RIWAYAT =====
function switchTransactionTab(tabName) {
  // Form "Catat" & Kalender sudah pindah (tombol ➕ dan Laporan) → hanya ada Riwayat.
  // Panggilan lama switchTransactionTab('catat') sebelum startEdit cukup diabaikan.
  if (tabName !== 'riwayat') return;
  txTabButtons.forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('#page-transaksi .tab-panel').forEach(function (panel) {
    panel.classList.toggle('active', panel.id === 'tab-' + tabName);
  });

  // Setiap kali Riwayat dibuka, tampilkan data terbaru
  if (tabName === 'riwayat') {
    fillHistoryCategoryOptions();
    historyLimit = HISTORY_PAGE_SIZE;
    renderHistory();
  }

  window.scrollTo(0, 0);
}


// ===== ALAT BANTU TANGGAL =====
function dateToString(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatLongDate(dateString) {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Menghasilkan tanggal awal & akhir sesuai pilihan periode
function getPeriodRange(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  if (period === 'hari-ini') {
    return { from: todayString(), to: todayString() };
  }
  if (period === '7-hari') {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { from: dateToString(start), to: todayString() };
  }
  if (period === 'bulan-ini') {
    return { from: dateToString(new Date(year, month, 1)), to: dateToString(new Date(year, month + 1, 0)) };
  }
  if (period === 'bulan-lalu') {
    return { from: dateToString(new Date(year, month - 1, 1)), to: dateToString(new Date(year, month, 0)) };
  }
  if (period === 'custom') {
    return { from: histFrom.value, to: histTo.value };
  }
  return { from: '', to: '' };   // semua waktu
}


// ===== JENIS TAMPILAN: masuk / keluar / sisih =====
function getTransactionKind(tx) {
  if (tx.type === 'masuk') return 'masuk';
  const category = findCategory(tx.categoryId);
  return category && category.fund ? 'sisih' : 'keluar';
}


// ===== ISI PILIHAN KATEGORI DI FILTER =====
function fillHistoryCategoryOptions() {
  const selected = histCategory.value;

  let html = '<option value="">Semua kategori</option>';
  [['masuk', 'Uang Masuk'], ['keluar', 'Uang Keluar']].forEach(function (pair) {
    html += `<optgroup label="${pair[1]}">`;
    getCategories(pair[0]).forEach(function (cat) {
      html += `<option value="${cat.id}">${escapeHtml(cat.name)}</option>`;
    });
    html += '</optgroup>';
  });

  histCategory.innerHTML = html;
  histCategory.value = selected;
  if (histCategory.value !== selected) histCategory.value = '';

  // Pilihan dompet (hanya tampil jika dompet lebih dari satu)
  const walletSelect = document.getElementById('hist-wallet');
  const walletSelected = walletSelect.value;
  walletSelect.innerHTML = '<option value="">Semua dompet</option>' + appData.wallets.map(function (w) {
    return `<option value="${w.id}">${escapeHtml(w.name)}</option>`;
  }).join('');
  walletSelect.value = walletSelected;
  if (walletSelect.value !== walletSelected) walletSelect.value = '';
  document.getElementById('hist-wallet-field').hidden = appData.wallets.length < 2;
}


// ===== SARING TRANSAKSI SESUAI FILTER =====
function getFilteredTransactions() {
  const keyword = histSearch.value.trim().toLowerCase();
  const type = histType.value;
  const categoryId = histCategory.value;
  const range = getPeriodRange(histPeriod.value);

  let list = appData.transactions.filter(function (tx) {
    const kind = getTransactionKind(tx);

    // Filter jenis
    if (type === 'masuk' && tx.type !== 'masuk') return false;
    if (type === 'keluar' && tx.type !== 'keluar') return false;
    if (type === 'pengeluaran' && kind !== 'keluar') return false;
    if (type === 'sisih' && kind !== 'sisih') return false;

    // Filter kategori
    if (categoryId && tx.categoryId !== categoryId) return false;

    // Filter dompet
    const walletFilter = document.getElementById('hist-wallet').value;
    if (walletFilter && txWalletId(tx) !== walletFilter) return false;

    // Filter tanggal
    if (range.from && tx.date < range.from) return false;
    if (range.to && tx.date > range.to) return false;

    // Pencarian kata
    if (keyword) {
      const category = findCategory(tx.categoryId);
      const text = [
        category ? category.name : '',
        tx.note,
        tx.source,
        String(tx.amount),
        formatRupiah(tx.amount)
      ].join(' ').toLowerCase();
      if (!text.includes(keyword)) return false;
    }

    return true;
  });

  // Urutan
  const sort = histSort.value;
  if (sort === 'terbaru') {
    list = sortTransactionsNewest(list);
  } else if (sort === 'terlama') {
    list = sortTransactionsNewest(list).reverse();
  } else if (sort === 'terbesar') {
    list.sort(function (a, b) { return b.amount - a.amount; });
  } else if (sort === 'terkecil') {
    list.sort(function (a, b) { return a.amount - b.amount; });
  }

  return list;
}


// ===== HTML SATU TRANSAKSI DI RIWAYAT =====
function historyItemHtml(tx, showDate) {
  const category = findCategory(tx.categoryId);
  const categoryName = category ? category.name : 'Kategori terhapus';
  const kind = getTransactionKind(tx);

  const icons = { masuk: 'south_west', keluar: 'north_east', sisih: 'savings' };
  const sign = tx.type === 'masuk' ? '+' : '−';
  const details = [tx.source, tx.note].filter(Boolean).join(' · ');
  let meta = showDate ? formatShortDate(tx.date) + ' · ' + tx.time : tx.time;
  if (appData.wallets.length > 1) meta += ' · ' + escapeHtml(walletName(txWalletId(tx)));

  return `
    <div class="tx-item" data-id="${tx.id}">
      <div class="tx-icon ${kind}">
        <span class="material-symbols-rounded">${icons[kind]}</span>
      </div>
      <div class="tx-info">
        <div class="tx-category">
          ${escapeHtml(categoryName)}
          ${kind === 'sisih' ? '<span class="tx-badge">Disisihkan</span>' : ''}
        </div>
        ${details ? `<div class="tx-note">${escapeHtml(details)}</div>` : ''}
        <div class="tx-meta">${meta}</div>
      </div>
      <div class="tx-right">
        <div class="tx-amount ${kind}">${sign}${formatRupiah(tx.amount)}</div>
        <div class="tx-actions">
          <button type="button" class="icon-btn" data-action="edit" data-id="${tx.id}" title="Edit">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button type="button" class="icon-btn danger" data-action="delete" data-id="${tx.id}" title="Hapus">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    </div>
  `;
}


// ===== TAMPILKAN RIWAYAT =====
function renderHistory() {
  const list = getFilteredTransactions();

  // --- Ringkasan total dari hasil filter ---
  let totalMasuk = 0;
  let totalKeluar = 0;
  let totalSisih = 0;

  list.forEach(function (tx) {
    const kind = getTransactionKind(tx);
    if (kind === 'masuk') totalMasuk += tx.amount;
    else if (kind === 'sisih') totalSisih += tx.amount;
    else totalKeluar += tx.amount;
  });

  histSummary.innerHTML = `
    <div class="summary-count">${list.length} transaksi ditemukan</div>
    <div class="summary-chips">
      <span class="chip masuk">Masuk +${formatRupiah(totalMasuk)}</span>
      <span class="chip keluar">Keluar −${formatRupiah(totalKeluar)}</span>
      <span class="chip sisih">Disisihkan ${formatRupiah(totalSisih)}</span>
    </div>
  `;

  // --- Daftar kosong ---
  if (list.length === 0) {
    histList.innerHTML = appData.transactions.length === 0
      ? '<p class="empty-state">Belum ada transaksi yang dicatat.</p>'
      : '<p class="empty-state">Tidak ada transaksi yang cocok dengan filter.</p>';
    histMoreButton.hidden = true;
    return;
  }

  // --- Daftar transaksi ---
  const shown = list.slice(0, historyLimit);
  const groupByDate = histSort.value === 'terbaru' || histSort.value === 'terlama';

  let html = '';
  let lastDate = null;

  shown.forEach(function (tx) {
    // Tambahkan judul tanggal setiap kali tanggal berganti
    if (groupByDate && tx.date !== lastDate) {
      html += `<div class="date-header">${formatLongDate(tx.date)}</div>`;
      lastDate = tx.date;
    }
    html += historyItemHtml(tx, !groupByDate);
  });

  histList.innerHTML = html;

  // --- Tombol "Tampilkan lebih banyak" ---
  const remaining = list.length - historyLimit;
  histMoreButton.hidden = remaining <= 0;
  histMoreButton.textContent = 'Tampilkan lebih banyak (' + remaining + ' lagi)';
}


// ===== SAAT FILTER BERUBAH =====
function onFilterChange() {
  historyLimit = HISTORY_PAGE_SIZE;
  renderHistory();
}

function onPeriodChange() {
  const isCustom = histPeriod.value === 'custom';
  histFromField.hidden = !isCustom;
  histToField.hidden = !isCustom;

  // Isi otomatis: awal bulan ini sampai hari ini
  if (isCustom && !histFrom.value && !histTo.value) {
    const now = new Date();
    histFrom.value = dateToString(new Date(now.getFullYear(), now.getMonth(), 1));
    histTo.value = todayString();
  }

  onFilterChange();
}

function resetHistoryFilter() {
  histSearch.value = '';
  histType.value = 'semua';
  histCategory.value = '';
  document.getElementById('hist-wallet').value = '';
  histPeriod.value = 'semua';
  histSort.value = 'terbaru';
  histFrom.value = '';
  histTo.value = '';
  histFromField.hidden = true;
  histToField.hidden = true;
  onFilterChange();
}


// ===== MENGHUBUNGKAN TOMBOL & KOLOM =====
txTabButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    switchTransactionTab(btn.dataset.tab);
  });
});

histSearch.addEventListener('input', onFilterChange);
histType.addEventListener('change', onFilterChange);
histCategory.addEventListener('change', onFilterChange);
document.getElementById('hist-wallet').addEventListener('change', onFilterChange);
histSort.addEventListener('change', onFilterChange);
histPeriod.addEventListener('change', onPeriodChange);
histFrom.addEventListener('change', onFilterChange);
histTo.addEventListener('change', onFilterChange);
histResetButton.addEventListener('click', resetHistoryFilter);

histMoreButton.addEventListener('click', function () {
  historyLimit += HISTORY_PAGE_SIZE;
  renderHistory();
});

// Tombol edit & hapus di dalam riwayat
histList.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const id = button.dataset.id;

  if (button.dataset.action === 'edit') {
    switchTransactionTab('catat');
    startEdit(id);
  }
  if (button.dataset.action === 'delete') {
    deleteTransaction(id);
    renderHistory();
  }
});

// Setiap kali halaman Riwayat dibuka, tampilkan data terbaru
document.querySelectorAll('[data-page="transaksi"]').forEach(function (btn) {
  btn.addEventListener('click', function () { switchTransactionTab('riwayat'); });
});
if (location.hash === '#transaksi') switchTransactionTab('riwayat');
