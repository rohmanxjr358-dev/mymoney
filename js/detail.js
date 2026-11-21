// =====================================================
// DETAIL.JS — Jendela detail transaksi
// =====================================================

const detailModal = document.getElementById('detail-modal');
const detailBody = document.getElementById('detail-body');
const detailEditButton = document.getElementById('detail-edit');
const detailDeleteButton = document.getElementById('detail-delete');

// Id transaksi yang sedang dilihat
let detailId = null;


// ===== BUKA DETAIL =====
function openDetail(id) {
  const tx = findTransaction(id);
  if (!tx) return;

  detailId = id;

  const category = findCategory(tx.categoryId);
  const categoryName = category ? category.name : 'Kategori terhapus';
  const kind = getTransactionKind(tx);

  const icons = { masuk: 'south_west', keluar: 'north_east', sisih: 'savings' };
  const kindLabels = {
    masuk: 'Uang Masuk',
    keluar: 'Uang Keluar',
    sisih: 'Uang Keluar · Disisihkan ke tabungan'
  };
  const sign = tx.type === 'masuk' ? '+' : '−';

  // Baris-baris informasi: [label, nilai]
  const rows = [
    ['Jenis', kindLabels[kind]],
    ['Kategori', categoryName],
    ['Grup', category ? category.group : '-'],
    ['Tanggal', formatLongDate(tx.date)],
    ['Jam', tx.time]
  ];
  if (tx.type === 'masuk') {
    rows.push(['Sumber pemasukan', tx.source || '-']);
  }
  rows.push(['Dicatat pada', formatDateTime(tx.createdAt)]);
  if (tx.updatedAt) {
    rows.push(['Terakhir diubah', formatDateTime(tx.updatedAt)]);
  }

  detailBody.innerHTML = `
    <div class="detail-hero">
      <div class="tx-icon ${kind}">
        <span class="material-symbols-rounded">${icons[kind]}</span>
      </div>
      <div class="tx-amount ${kind} detail-amount">${sign}${formatRupiah(tx.amount)}</div>
      <div class="detail-category">${escapeHtml(categoryName)}</div>
    </div>

    <div class="detail-note">
      <div class="detail-label">Keterangan</div>
      <div class="detail-note-text">${tx.note ? escapeHtml(tx.note) : '<em>Tidak ada keterangan</em>'}</div>
    </div>

    <div class="info-list">
      ${rows.map(function (row) {
        return `
          <div class="info-row">
            <span>${row[0]}</span>
            <strong>${escapeHtml(row[1])}</strong>
          </div>
        `;
      }).join('')}
    </div>
  `;

  detailModal.classList.add('open');
}


// ===== TUTUP DETAIL =====
function closeDetail() {
  detailModal.classList.remove('open');
  detailId = null;
}


// ===== EDIT DARI DETAIL =====
function editFromDetail() {
  const id = detailId;
  closeDetail();
  switchTransactionTab('catat');
  startEdit(id);
}


// ===== HAPUS DARI DETAIL =====
function deleteFromDetail() {
  const id = detailId;
  const countBefore = appData.transactions.length;

  deleteTransaction(id);   // menampilkan konfirmasi

  // Jika benar-benar terhapus (tidak klik Cancel), tutup jendela
  if (appData.transactions.length < countBefore) {
    closeDetail();
    renderHistory();
  }
}


// ===== KLIK TRANSAKSI DI DAFTAR → BUKA DETAIL =====
function handleTransactionListClick(event) {
  // Abaikan jika yang diklik adalah tombol edit/hapus
  if (event.target.closest('[data-action]')) return;

  const item = event.target.closest('.tx-item');
  if (!item) return;

  const editButton = item.querySelector('[data-action="edit"]');
  if (editButton) openDetail(editButton.dataset.id);
}


// ===== MENGHUBUNGKAN TOMBOL =====
recentContainer.addEventListener('click', handleTransactionListClick);
histList.addEventListener('click', handleTransactionListClick);

detailEditButton.addEventListener('click', editFromDetail);
detailDeleteButton.addEventListener('click', deleteFromDetail);

// Tutup lewat tombol X atau area gelap
detailModal.querySelectorAll('[data-close]').forEach(function (el) {
  el.addEventListener('click', closeDetail);
});

// Tutup lewat tombol Esc di keyboard
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && detailModal.classList.contains('open')) {
    closeDetail();
  }
});