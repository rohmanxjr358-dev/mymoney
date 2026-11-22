// =====================================================
// BULANAN.JS — Uang bulanan dari orang tua
// =====================================================

// Pastikan tempat penyimpanan periode sudah ada (untuk data lama)
if (!Array.isArray(appData.periods)) {
  appData.periods = [];
}

const MONTHLY_CATEGORY_ID = 'in-bulanan';

const agreedDayForm = document.getElementById('agreed-day-form');
const agreedDayInput = document.getElementById('agreed-day');

const periodCurrentCard = document.getElementById('period-current');
const periodFormCard = document.getElementById('period-form-card');
const periodFormTitle = document.getElementById('period-form-title');
const periodForm = document.getElementById('period-form');
const periodAmount = document.getElementById('period-amount');
const periodAmountPreview = document.getElementById('period-amount-preview');
const periodExpected = document.getElementById('period-expected');
const periodReceived = document.getElementById('period-received');
const periodNext = document.getElementById('period-next');
const periodCarry = document.getElementById('period-carry');
const periodNote = document.getElementById('period-note');
const periodSubmitButton = document.getElementById('period-submit');
const periodCancelButton = document.getElementById('period-cancel');
const periodList = document.getElementById('period-list');

// Id periode yang sedang diedit (null = mencatat baru)
let editingPeriodId = null;


// ===== ALAT BANTU TANGGAL =====
function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Membuat tanggal; jika hari melebihi akhir bulan, pakai hari terakhir bulan itu
function makeDate(year, monthIndex, day) {
  const safeDay = Math.min(day, daysInMonth(year, monthIndex));
  return dateToString(new Date(year, monthIndex, safeDay));
}

// Tanggal yang sama di bulan berikutnya (memakai tanggal kesepakatan jika ada)
function addOneMonth(dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const day = appData.settings.expectedTransferDay || d.getDate();
  return makeDate(d.getFullYear(), d.getMonth() + 1, day);
}

// Perkiraan transfer bulan ini berdasarkan tanggal kesepakatan
function defaultExpectedDate() {
  const now = new Date();
  const day = appData.settings.expectedTransferDay || now.getDate();
  return makeDate(now.getFullYear(), now.getMonth(), day);
}

// Selisih hari antara dua tanggal (hasil positif jika "to" lebih akhir)
function daysBetween(fromString, toString) {
  const from = new Date(fromString + 'T00:00:00');
  const to = new Date(toString + 'T00:00:00');
  return Math.round((to - from) / 86400000);
}

function formatMonthYear(dateString) {
  return new Date(dateString + 'T00:00:00').toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric'
  });
}


// ===== MENCARI PERIODE =====
function findPeriod(id) {
  return appData.periods.find(function (p) {
    return p.id === id;
  }) || null;
}

// Urutkan: penerimaan terbaru di atas
function getSortedPeriods() {
  return appData.periods.slice().sort(function (a, b) {
    return b.receivedDate.localeCompare(a.receivedDate);
  });
}

// Periode berjalan = penerimaan terakhir yang tanggalnya tidak melebihi hari ini
function getCurrentPeriod() {
  const today = todayString();
  return getSortedPeriods().find(function (p) {
    return p.receivedDate <= today;
  }) || null;
}

// Status ketepatan transfer
function getTimingInfo(period) {
  const diff = daysBetween(period.expectedDate, period.receivedDate);
  if (diff === 0) return { label: 'Tepat waktu', cls: 'ok' };
  if (diff > 0) return { label: 'Terlambat ' + diff + ' hari', cls: 'late' };
  return { label: 'Lebih cepat ' + Math.abs(diff) + ' hari', cls: 'early' };
}

// Uang yang tersedia untuk dibagi = uang diterima + sisa bulan lalu
// untracked = bagian kiriman yang sudah terpakai sebelum mulai mencatat
// (diukur sekali di rencana.js), supaya rencana tidak membagi uang yang sudah tidak ada
function getAvailableMoney(period) {
  return period.amount + (period.carryOver || 0) - (period.untracked || 0);
}


// ===== TANGGAL KESEPAKATAN =====
function saveAgreedDay(event) {
  event.preventDefault();

  const value = agreedDayInput.value.trim();
  const day = Number(value);

  if (value && (!Number.isInteger(day) || day < 1 || day > 31)) {
    showToast('Isi tanggal antara 1 sampai 31');
    agreedDayInput.focus();
    return;
  }

  appData.settings.expectedTransferDay = value ? day : null;
  saveData();

  if (!editingPeriodId) resetPeriodForm();
  showToast(value ? 'Tanggal kesepakatan: setiap tanggal ' + day : 'Tanggal kesepakatan dikosongkan');
}


// ===== MENJAGA TRANSAKSI PEMASUKAN TETAP SESUAI =====
// Setiap periode punya satu transaksi "Uang Bulanan dari Orang Tua"
function syncPeriodTransaction(period) {
  const now = new Date().toISOString();
  let tx = period.transactionId ? findTransaction(period.transactionId) : null;

  const txData = {
    type: 'masuk',
    amount: period.amount,
    date: period.receivedDate,
    categoryId: MONTHLY_CATEGORY_ID,
    source: 'Orang tua',
    note: period.note || 'Uang bulanan ' + formatMonthYear(period.receivedDate)
  };

  if (tx) {
    Object.assign(tx, txData, { updatedAt: now });
  } else {
    tx = Object.assign({ id: generateId(), time: currentTimeString(), createdAt: now }, txData);
    appData.transactions.push(tx);
    period.transactionId = tx.id;
  }
}


// ===== PRATINJAU RUPIAH =====
function updatePeriodPreview() {
  periodAmountPreview.textContent = formatRupiah(periodAmount.value);
}


// ===== KOSONGKAN FORM =====
function resetPeriodForm() {
  editingPeriodId = null;

  periodAmount.value = '';
  periodExpected.value = defaultExpectedDate();
  periodReceived.value = todayString();
  periodNext.value = addOneMonth(periodExpected.value);
  periodCarry.value = '';
  periodNote.value = '';
  updatePeriodPreview();

  periodFormCard.classList.remove('editing');
  periodFormTitle.textContent = 'Catat Uang Bulanan Diterima';
  periodSubmitButton.innerHTML = '<span class="material-symbols-rounded">check</span> Simpan';
  periodCancelButton.hidden = true;
}


// ===== MULAI EDIT =====
function startPeriodEdit(id) {
  const period = findPeriod(id);
  if (!period) return;

  editingPeriodId = id;

  periodAmount.value = period.amount;
  periodExpected.value = period.expectedDate;
  periodReceived.value = period.receivedDate;
  periodNext.value = period.nextExpectedDate;
  periodCarry.value = period.carryOver || '';
  periodNote.value = period.note || '';
  updatePeriodPreview();

  periodFormCard.classList.add('editing');
  periodFormTitle.textContent = 'Edit Uang Bulanan';
  periodSubmitButton.innerHTML = '<span class="material-symbols-rounded">check</span> Simpan Perubahan';
  periodCancelButton.hidden = false;

  periodFormCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ===== SIMPAN =====
function savePeriod(event) {
  event.preventDefault();

  const amount = Math.round(Number(periodAmount.value));
  const carryOver = Math.max(0, Math.round(Number(periodCarry.value) || 0));

  if (!amount || amount <= 0) {
    showToast('Isi nominal uang yang diterima');
    periodAmount.focus();
    return;
  }
  if (!periodExpected.value || !periodReceived.value || !periodNext.value) {
    showToast('Lengkapi semua tanggal');
    return;
  }
  if (periodNext.value <= periodReceived.value) {
    showToast('Perkiraan transfer berikutnya harus setelah tanggal diterima');
    periodNext.focus();
    return;
  }

  const data = {
    amount: amount,
    expectedDate: periodExpected.value,
    receivedDate: periodReceived.value,
    nextExpectedDate: periodNext.value,
    carryOver: carryOver,
    note: periodNote.value.trim()
  };

  if (editingPeriodId) {
    const period = findPeriod(editingPeriodId);
    Object.assign(period, data, { updatedAt: new Date().toISOString() });
    syncPeriodTransaction(period);
    showToast('Perubahan disimpan');
  } else {
    const period = Object.assign({
      id: generateId(),
      transactionId: null,
      allocations: null,
      createdAt: new Date().toISOString()
    }, data);
    appData.periods.push(period);
    syncPeriodTransaction(period);
    showToast('Uang bulanan ' + formatRupiah(amount) + ' tercatat');
  }

  saveData();
  resetPeriodForm();
  renderBulanan();
  renderRecentTransactions();
  updateBackupInfo();
}


// ===== HAPUS =====
function deletePeriod(id) {
  const period = findPeriod(id);
  if (!period) return;

  const ok = confirm(
    'Hapus data uang bulanan ' + formatMonthYear(period.receivedDate) + '?\n\n' +
    'Transaksi pemasukan ' + formatRupiah(period.amount) + ' yang tercatat otomatis juga akan dihapus.'
  );
  if (!ok) return;

  appData.transactions = appData.transactions.filter(function (tx) {
    return tx.id !== period.transactionId;
  });
  appData.periods = appData.periods.filter(function (p) {
    return p.id !== id;
  });
  saveData();

  if (editingPeriodId === id) resetPeriodForm();
  renderBulanan();
  renderRecentTransactions();
  updateBackupInfo();
  showToast('Data uang bulanan dihapus');
}


// ===== TAMPILKAN PERIODE BERJALAN =====
function renderCurrentPeriod() {
  const period = getCurrentPeriod();

  if (!period) {
    periodCurrentCard.innerHTML = `
      <h2 class="card-title">Periode Berjalan</h2>
      <p class="empty-state">
        Belum ada uang bulanan yang dicatat.<br>
        Isi formulir di bawah saat uang dari orang tua diterima.
      </p>
    `;
    return;
  }

  const timing = getTimingInfo(period);
  const daysLeft = daysBetween(todayString(), period.nextExpectedDate);

  let daysText = daysLeft + ' hari lagi';
  let daysClass = '';
  if (daysLeft === 0) {
    daysText = 'Hari ini';
  } else if (daysLeft < 0) {
    daysText = 'Sudah lewat ' + Math.abs(daysLeft) + ' hari — perbarui jika jadwal bergeser';
    daysClass = 'warn';
  }

  periodCurrentCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Periode Berjalan</h2>
      <span class="status-badge ${timing.cls}">${timing.label}</span>
    </div>

    <div class="period-hero">
      <div class="period-amount">${formatRupiah(period.amount)}</div>
      <div class="period-sub">
        Diterima ${formatLongDate(period.receivedDate)}
        · perkiraan ${formatShortDate(period.expectedDate)}
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat">
        <span>Uang tersedia untuk dibagi</span>
        <strong>${formatRupiah(getAvailableMoney(period))}</strong>
        <small>${period.untracked
          ? formatRupiah(period.untracked) + ' sudah terpakai sebelum mulai mencatat'
          : period.carryOver ? 'Termasuk sisa bulan lalu ' + formatRupiah(period.carryOver) : 'Tanpa sisa bulan lalu'}</small>
      </div>
      <div class="stat">
        <span>Perkiraan transfer berikutnya</span>
        <strong>${formatShortDate(period.nextExpectedDate)}</strong>
        <small class="${daysClass}">${daysText}</small>
      </div>
    </div>
  `;
}


// ===== TAMPILKAN RIWAYAT UANG BULANAN =====
function renderPeriodList() {
  const periods = getSortedPeriods();

  if (periods.length === 0) {
    periodList.innerHTML = '<p class="empty-state">Belum ada riwayat uang bulanan.</p>';
    return;
  }

  periodList.innerHTML = periods.map(function (period) {
    const timing = getTimingInfo(period);

    return `
      <div class="tx-item">
        <div class="tx-icon masuk">
          <span class="material-symbols-rounded">account_balance_wallet</span>
        </div>
        <div class="tx-info">
          <div class="tx-category">${formatMonthYear(period.receivedDate)}</div>
          ${period.note ? `<div class="tx-note">${escapeHtml(period.note)}</div>` : ''}
          <div class="tx-meta">
            Diterima ${formatShortDate(period.receivedDate)}
            <span class="status-badge ${timing.cls}">${timing.label}</span>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount masuk">+${formatRupiah(period.amount)}</div>
          <div class="tx-actions">
            <button type="button" class="icon-btn" data-action="alloc-period" data-id="${period.id}" title="Atur rencana">
              <span class="material-symbols-rounded">tune</span>
            </button>
            <button type="button" class="icon-btn" data-action="edit-period" data-id="${period.id}" title="Edit">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button type="button" class="icon-btn danger" data-action="delete-period" data-id="${period.id}" title="Hapus">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


// ===== TAMPILKAN SELURUH HALAMAN UANG BULANAN =====
function renderBulanan() {
  agreedDayInput.value = appData.settings.expectedTransferDay || '';
  renderCurrentPeriod();
  renderPeriodList();

  // Perbarui kartu alokasi (dibuat di alokasi.js)
  if (typeof renderAllocation === 'function') renderAllocation();
}


// ===== MENGHUBUNGKAN TOMBOL & KOLOM =====
agreedDayForm.addEventListener('submit', saveAgreedDay);
periodForm.addEventListener('submit', savePeriod);
periodCancelButton.addEventListener('click', resetPeriodForm);
periodAmount.addEventListener('input', updatePeriodPreview);

// Saat perkiraan tanggal diubah, perkiraan berikutnya ikut menyesuaikan
periodExpected.addEventListener('change', function () {
  if (periodExpected.value) periodNext.value = addOneMonth(periodExpected.value);
});

periodList.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  if (button.dataset.action === 'edit-period') startPeriodEdit(button.dataset.id);
  if (button.dataset.action === 'delete-period') deletePeriod(button.dataset.id);
  if (button.dataset.action === 'alloc-period') openAllocation(button.dataset.id);
});

// Perbarui tampilan setiap kali menu Uang Bulanan dibuka
document.querySelectorAll('[data-page="bulanan"]').forEach(function (btn) {
  btn.addEventListener('click', renderBulanan);
});


// ===== SAAT APLIKASI DIBUKA =====
resetPeriodForm();
renderBulanan();