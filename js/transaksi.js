// =====================================================
// TRANSAKSI.JS — Catat, edit, dan hapus transaksi
// =====================================================

const txForm = document.getElementById('transaction-form');
const txFormCard = txForm.closest('.card');
const txFormTitle = document.getElementById('form-title');
const txSubmitButton = txForm.querySelector('button[type="submit"]');
const txAmount = document.getElementById('tx-amount');
const txAmountPreview = document.getElementById('tx-amount-preview');
const txDate = document.getElementById('tx-date');
const txTime = document.getElementById('tx-time');
const txCategory = document.getElementById('tx-category');
const txSourceField = document.getElementById('tx-source-field');
const txSource = document.getElementById('tx-source');
const txNote = document.getElementById('tx-note');
const txResetButton = document.getElementById('tx-reset');
const typeButtons = txForm.querySelectorAll('.segmented-btn');
const recentContainer = document.getElementById('recent-transactions');

// Jenis yang sedang dipilih: 'keluar' atau 'masuk'
let currentType = 'keluar';

// Id transaksi yang sedang diedit (null = sedang mencatat transaksi baru)
let editingId = null;


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


// ===== PILIH JENIS: KELUAR / MASUK =====
function setTransactionType(type) {
  currentType = type;

  typeButtons.forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  // Kolom "Sumber pemasukan" hanya muncul untuk uang masuk
  txSourceField.hidden = (type !== 'masuk');

  fillCategoryOptions();
}


// ===== ISI PILIHAN KATEGORI (dikelompokkan per grup) =====
function fillCategoryOptions() {
  txCategory.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '— Pilih kategori —';
  txCategory.appendChild(placeholder);

  const groups = {};

  getCategories(currentType).forEach(function (cat) {
    if (!groups[cat.group]) {
      groups[cat.group] = document.createElement('optgroup');
      groups[cat.group].label = cat.group;
      txCategory.appendChild(groups[cat.group]);
    }

    const option = document.createElement('option');
    option.value = cat.id;
    option.textContent = cat.name;
    groups[cat.group].appendChild(option);
  });
}


// ===== PRATINJAU RUPIAH SAAT MENGETIK =====
function updateAmountPreview() {
  txAmountPreview.textContent = formatRupiah(txAmount.value);
}


// ===== UBAH TAMPILAN FORM: MODE CATAT / MODE EDIT =====
function setFormMode(isEditing) {
  txFormCard.classList.toggle('editing', isEditing);
  txFormTitle.textContent = isEditing ? 'Edit Transaksi' : 'Catat Transaksi';
  txSubmitButton.innerHTML = isEditing
    ? '<span class="material-symbols-rounded">check</span> Simpan Perubahan'
    : '<span class="material-symbols-rounded">check</span> Simpan Transaksi';
  txResetButton.textContent = isEditing ? 'Batal Edit' : 'Kosongkan';
}


// ===== KOSONGKAN FORM (sekaligus keluar dari mode edit) =====
function resetTransactionForm() {
  editingId = null;
  setFormMode(false);

  txAmount.value = '';
  txDate.value = todayString();
  txTime.value = currentTimeString();
  txCategory.value = '';
  txSource.value = '';
  txNote.value = '';
  updateAmountPreview();

  renderRecentTransactions();
}


// ===== MULAI MENGEDIT: isi form dengan data transaksi lama =====
function startEdit(id) {
  const tx = findTransaction(id);
  if (!tx) return;

  editingId = id;
  setTransactionType(tx.type);

  txAmount.value = tx.amount;
  txDate.value = tx.date;
  txTime.value = tx.time;
  txCategory.value = tx.categoryId;
  txSource.value = tx.source || '';
  txNote.value = tx.note || '';
  updateAmountPreview();

  setFormMode(true);
  renderRecentTransactions();

  // Pindah ke halaman Transaksi & gulir ke atas (ke form)
  showPage('transaksi');
}


// ===== SIMPAN (transaksi baru ATAU perubahan) =====
function saveTransaction(event) {
  event.preventDefault(); // cegah halaman ter-refresh

  const amount = Math.round(Number(txAmount.value));

  // Pemeriksaan isian
  if (!amount || amount <= 0) {
    showToast('Isi nominal terlebih dahulu');
    txAmount.focus();
    return;
  }
  if (!txDate.value) {
    showToast('Isi tanggal terlebih dahulu');
    txDate.focus();
    return;
  }
  if (!txCategory.value) {
    showToast('Pilih kategori terlebih dahulu');
    txCategory.focus();
    return;
  }

  const data = {
    type: currentType,
    amount: amount,
    date: txDate.value,
    time: txTime.value || '00:00',
    categoryId: txCategory.value,
    source: currentType === 'masuk' ? txSource.value.trim() : '',
    note: txNote.value.trim()
  };

  if (editingId) {
    // --- Mode edit: perbarui transaksi lama ---
    const tx = findTransaction(editingId);
    if (tx) {
      Object.assign(tx, data, { updatedAt: new Date().toISOString() });
      showToast('Perubahan disimpan');
    }
  } else {
    // --- Mode catat: tambahkan transaksi baru ---
    const newTransaction = Object.assign(
      { id: generateId(), createdAt: new Date().toISOString() },
      data
    );
    appData.transactions.push(newTransaction);
    showToast('Transaksi tersimpan: ' + formatRupiah(amount));
  }

  saveData();
  resetTransactionForm();
  updateBackupInfo();
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

  // Simpan semua transaksi KECUALI yang dihapus
  appData.transactions = appData.transactions.filter(function (item) {
    return item.id !== id;
  });
  saveData();

  // Jika yang dihapus sedang diedit, kosongkan form
  if (editingId === id) {
    resetTransactionForm();
  } else {
    renderRecentTransactions();
  }

  updateBackupInfo();
  showToast('Transaksi dihapus');
}


// ===== URUTKAN: TERBARU DI ATAS =====
function sortTransactionsNewest(list) {
  return list.slice().sort(function (a, b) {
    const keyA = a.date + ' ' + a.time;
    const keyB = b.date + ' ' + b.time;
    if (keyA === keyB) {
      return b.createdAt.localeCompare(a.createdAt);
    }
    return keyB.localeCompare(keyA);
  });
}


// ===== TAMPILKAN 10 TRANSAKSI TERBARU =====
function renderRecentTransactions() {
  const list = sortTransactionsNewest(appData.transactions).slice(0, 10);

  if (list.length === 0) {
    recentContainer.innerHTML = '<p class="empty-state">Belum ada transaksi. Yuk catat transaksi pertamamu!</p>';
    return;
  }

  recentContainer.innerHTML = list.map(function (tx) {
    const category = findCategory(tx.categoryId);
    const categoryName = category ? category.name : 'Kategori terhapus';
    const isFund = Boolean(category && category.fund);

    // Jenis tampilan: masuk (hijau), keluar (merah), sisih (tabungan)
    let kind = 'keluar';
    if (tx.type === 'masuk') kind = 'masuk';
    else if (isFund) kind = 'sisih';

    const icons = { masuk: 'south_west', keluar: 'north_east', sisih: 'savings' };
    const sign = tx.type === 'masuk' ? '+' : '−';
    const details = [tx.source, tx.note].filter(Boolean).join(' · ');
    const editingClass = tx.id === editingId ? 'editing' : '';

    return `
      <div class="tx-item ${editingClass}">
        <div class="tx-icon ${kind}">
          <span class="material-symbols-rounded">${icons[kind]}</span>
        </div>
        <div class="tx-info">
          <div class="tx-category">
            ${escapeHtml(categoryName)}
            ${isFund ? '<span class="tx-badge">Disisihkan</span>' : ''}
          </div>
          ${details ? `<div class="tx-note">${escapeHtml(details)}</div>` : ''}
          <div class="tx-meta">${formatShortDate(tx.date)} · ${tx.time}</div>
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
  }).join('');
}


// ===== MENGHUBUNGKAN TOMBOL & KOLOM =====
typeButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    setTransactionType(btn.dataset.type);
  });
});

txAmount.addEventListener('input', updateAmountPreview);
txForm.addEventListener('submit', saveTransaction);
txResetButton.addEventListener('click', resetTransactionForm);

// Satu "pendengar" untuk semua tombol edit/hapus di daftar
recentContainer.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  if (button.dataset.action === 'edit') startEdit(button.dataset.id);
  if (button.dataset.action === 'delete') deleteTransaction(button.dataset.id);
});


// ===== SAAT APLIKASI DIBUKA =====
setTransactionType('keluar');
resetTransactionForm();