// =====================================================
// ALOKASI.JS — Membagi uang bulanan
// Alokasi hanya RENCANA, tidak dihitung sebagai pengeluaran.
// =====================================================

const FUND_KEYS = ['tabungan', 'darurat', 'investasi'];

const FUND_INFO = {
  tabungan:  { label: 'Tabungan Pribadi',        hint: 'Untuk kebutuhan pribadi' },
  darurat:   { label: 'Dana Darurat',            hint: 'Keadaan mendesak, termasuk servis motor' },
  investasi: { label: 'Investasi Leher ke Atas', hint: 'Buku, kursus, sertifikasi, keterampilan' }
};

const allocCard = document.getElementById('alloc-card');

let allocPeriodId = null;  // periode yang sedang dibagi
let allocDraft = null;     // salinan alokasi yang sedang diubah (belum disimpan)
let allocDirty = false;    // true jika ada perubahan yang belum disimpan


// ===== ALAT BANTU =====
function toAmount(value) {
  return Math.max(0, Math.round(Number(value) || 0));
}

// Alokasi awal: biaya tempat tinggal sebagai wajib bayar pertama
// (sewa kos jika ada, lalu iuran bulanan)
function createDefaultAllocations() {
  const wajib = [];
  ['out-kos', 'out-iuran'].forEach(function (id) {
    const category = findCategory(id);
    if (category) wajib.push({ id: generateId(), name: category.name, categoryId: id, amount: 0 });
  });
  return {
    wajib: wajib,
    funds: { tabungan: 0, darurat: 0, investasi: 0 }
  };
}

// Transaksi yang terjadi di dalam periode (dari tanggal diterima s/d sebelum transfer berikutnya)
function getPeriodTransactions(period) {
  return appData.transactions.filter(function (tx) {
    return tx.date >= period.receivedDate && tx.date < period.nextExpectedDate;
  });
}

// Total uang keluar untuk satu kategori di dalam periode
function getRealizedByCategory(period, categoryId) {
  if (!categoryId) return 0;
  return getPeriodTransactions(period)
    .filter(function (tx) { return tx.type === 'keluar' && tx.categoryId === categoryId; })
    .reduce(function (sum, tx) { return sum + tx.amount; }, 0);
}

// Total uang yang sudah disisihkan ke satu pos (tabungan/darurat/investasi) di dalam periode
function getRealizedFund(period, fundKey) {
  return getPeriodTransactions(period)
    .filter(function (tx) {
      const category = findCategory(tx.categoryId);
      return tx.type === 'keluar' && category && category.fund === fundKey;
    })
    .reduce(function (sum, tx) { return sum + tx.amount; }, 0);
}

// Hitung total alokasi (dipakai juga oleh fitur anggaran mingguan nanti)
function getAllocationTotals(period, allocations) {
  const alloc = allocations || period.allocations || createDefaultAllocations();
  const available = getAvailableMoney(period);
  const wajib = alloc.wajib.reduce(function (sum, item) { return sum + (item.amount || 0); }, 0);
  const sisih = FUND_KEYS.reduce(function (sum, key) { return sum + (alloc.funds[key] || 0); }, 0);

  return {
    available: available,
    wajib: wajib,
    sisih: sisih,
    remaining: available - wajib - sisih   // sisa untuk anggaran mingguan
  };
}

// Teks + bar kecil "sudah dibayar / sudah disisihkan"
function realizedHtml(realized, target, verb) {
  if (!target && !realized) return '';
  const percent = target > 0 ? Math.min(100, Math.round((realized / target) * 100)) : 100;
  const done = target > 0 && realized >= target;
  return `
    ${verb} ${formatRupiah(realized)} dari ${formatRupiah(target)}${done ? ' ✓' : ''}
    <div class="mini-bar ${done ? 'done' : ''}"><span style="width:${percent}%"></span></div>
  `;
}


// ===== PILIHAN KATEGORI UNTUK KEBUTUHAN WAJIB =====
function wajibCategoryOptions(selectedId) {
  let html = `<option value="">— Tidak dilacak —</option>`;
  getCategories('keluar').forEach(function (cat) {
    if (cat.fund) return; // kategori tabungan tidak dipakai di sini
    const selected = cat.id === selectedId ? 'selected' : '';
    html += `<option value="${cat.id}" ${selected}>${escapeHtml(cat.name)}</option>`;
  });
  return html;
}


// ===== BARIS-BARIS KEBUTUHAN WAJIB =====
function renderWajibRows() {
  const container = document.getElementById('alloc-wajib-list');

  if (allocDraft.wajib.length === 0) {
    container.innerHTML = '<p class="alloc-empty">Belum ada wajib bayar.</p>';
    return;
  }

  container.innerHTML = allocDraft.wajib.map(function (item) {
    return `
      <div class="alloc-row" data-wajib-id="${item.id}">
        <div class="alloc-wajib-grid">
          <input type="text" data-field="name" value="${escapeHtml(item.name)}" placeholder="Nama kebutuhan" maxlength="40">
          <select data-field="categoryId" title="Kategori untuk melacak pembayaran">
            ${wajibCategoryOptions(item.categoryId)}
          </select>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" data-field="amount" inputmode="numeric" min="0" step="1" placeholder="0" value="${item.amount || ''}">
          </div>
          <button type="button" class="icon-btn danger" data-alloc="remove-wajib" title="Hapus">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
        <div class="alloc-progress" data-progress-wajib="${item.id}"></div>
      </div>
    `;
  }).join('');
}


// ===== RINGKASAN (diperbarui setiap kali angka diubah) =====
function updateAllocSummary() {
  const period = findPeriod(allocPeriodId);
  if (!period) return;

  const totals = getAllocationTotals(period, allocDraft);
  const isOver = totals.remaining < 0;

  // --- Bar berwarna ---
  const base = Math.max(totals.available, totals.wajib + totals.sisih, 1);
  const pct = function (value) { return (Math.max(0, value) / base) * 100; };

  document.getElementById('alloc-summary').innerHTML = `
    <div class="alloc-bar">
      <span class="seg-wajib" style="width:${pct(totals.wajib)}%"></span>
      <span class="seg-sisih" style="width:${pct(totals.sisih)}%"></span>
      <span class="seg-sisa" style="width:${pct(totals.remaining)}%"></span>
    </div>
    <div class="alloc-lines">
      <div class="alloc-line"><span class="dot seg-wajib"></span>Wajib bayar<strong>${formatRupiah(totals.wajib)}</strong></div>
      <div class="alloc-line"><span class="dot seg-sisih"></span>Disisihkan<strong>${formatRupiah(totals.sisih)}</strong></div>
      <div class="alloc-line total ${isOver ? 'negative' : ''}">
        <span class="dot seg-sisa"></span>Sisa untuk anggaran mingguan
        <strong>${isOver ? '−' + formatRupiah(Math.abs(totals.remaining)) : formatRupiah(totals.remaining)}</strong>
      </div>
    </div>
    ${isOver ? `<p class="alloc-warning">Total rencana melebihi uang tersedia sebesar ${formatRupiah(Math.abs(totals.remaining))}. Kurangi salah satu nominal.</p>` : ''}
  `;

  // --- Progres realisasi tiap wajib bayar ---
  allocDraft.wajib.forEach(function (item) {
    const el = allocCard.querySelector(`[data-progress-wajib="${item.id}"]`);
    if (!el) return;
    el.innerHTML = item.categoryId
      ? realizedHtml(getRealizedByCategory(period, item.categoryId), item.amount, 'Sudah dibayar')
      : (item.amount ? 'Tidak dilacak — pilih kategori untuk melihat yang sudah dibayar' : '');
  });

  // --- Progres realisasi tiap pos tabungan ---
  FUND_KEYS.forEach(function (key) {
    const el = allocCard.querySelector(`[data-progress-fund="${key}"]`);
    if (el) el.innerHTML = realizedHtml(getRealizedFund(period, key), allocDraft.funds[key], 'Sudah disisihkan');
  });

  // --- Tombol simpan tidak bisa dipakai jika melebihi ---
  allocCard.querySelector('[data-alloc="save"]').disabled = isOver;
}


// ===== TAMPILKAN KARTU ALOKASI =====
function renderAllocation() {
  // Belum ada uang bulanan sama sekali
  if (appData.periods.length === 0) {
    allocPeriodId = null;
    allocDraft = null;
    allocCard.innerHTML = `
      <h2 class="card-title">Rencana Bulan Ini</h2>
      <p class="empty-state">Catat uang bulanan terlebih dahulu, lalu bagi di sini.</p>
    `;
    return;
  }

  // Pilih periode: yang sedang dibuka, atau periode berjalan
  if (!findPeriod(allocPeriodId)) {
    allocPeriodId = (getCurrentPeriod() || getSortedPeriods()[0]).id;
  }
  const period = findPeriod(allocPeriodId);

  // Salinan alokasi supaya perubahan baru tersimpan saat tombol Simpan diklik
  allocDraft = JSON.parse(JSON.stringify(period.allocations || createDefaultAllocations()));
  allocDirty = false;

  const periodOptions = getSortedPeriods().map(function (p) {
    const selected = p.id === allocPeriodId ? 'selected' : '';
    return `<option value="${p.id}" ${selected}>${formatMonthYear(p.receivedDate)}</option>`;
  }).join('');

  const fundRows = FUND_KEYS.map(function (key) {
    return `
      <div class="alloc-row">
        <div class="alloc-fund-grid">
          <div class="alloc-fund-head">
            <div class="tx-icon sisih small"><span class="material-symbols-rounded">savings</span></div>
            <div>
              <div class="alloc-name">${FUND_INFO[key].label}</div>
              <div class="alloc-hint">${FUND_INFO[key].hint}</div>
            </div>
          </div>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" data-fund="${key}" inputmode="numeric" min="0" step="1" placeholder="0" value="${allocDraft.funds[key] || ''}">
          </div>
        </div>
        <div class="alloc-progress" data-progress-fund="${key}"></div>
      </div>
    `;
  }).join('');

  allocCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Rencana Bulan Ini</h2>
      <select class="mini-select" id="alloc-period" title="Pilih periode">${periodOptions}</select>
    </div>
    <p class="card-text">
      Rencana pembagian uang. Rencana ini <strong>tidak</strong> dihitung sebagai pengeluaran —
      uang baru berkurang saat transaksinya dicatat.
    </p>

    <div class="alloc-available">
      <span>Uang tersedia untuk dibagi</span>
      <strong>${formatRupiah(getAvailableMoney(period))}</strong>
    </div>

    <h3 class="alloc-section-title">Wajib bayar</h3>
    <div id="alloc-wajib-list"></div>
    <button type="button" class="link-btn" data-alloc="add-wajib">
      <span class="material-symbols-rounded">add</span>
      Tambah wajib bayar
    </button>

    <h3 class="alloc-section-title">Disisihkan</h3>
    ${fundRows}

    <div class="alloc-summary" id="alloc-summary"></div>

    <div class="button-row">
      <button type="button" class="btn btn-primary" data-alloc="save">
        <span class="material-symbols-rounded">check</span>
        Simpan Rencana
      </button>
      <button type="button" class="btn btn-secondary" data-alloc="reset">
        Batalkan Perubahan
      </button>
    </div>
  `;

  renderWajibRows();
  updateAllocSummary();
}


// ===== BUKA ALOKASI PERIODE TERTENTU (dari tombol di riwayat) =====
function openAllocation(periodId) {
  if (allocDirty && periodId !== allocPeriodId &&
      !confirm('Perubahan rencana yang belum disimpan akan hilang. Lanjutkan?')) {
    return;
  }
  allocPeriodId = periodId;
  renderAllocation();
  allocCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}


// ===== SIMPAN ALOKASI =====
function saveAllocation() {
  const period = findPeriod(allocPeriodId);
  if (!period) return;

  const totals = getAllocationTotals(period, allocDraft);
  if (totals.remaining < 0) {
    showToast('Total rencana melebihi uang tersedia');
    return;
  }

  // Rapikan: buang baris kosong, beri nama default jika nama kosong
  const wajib = allocDraft.wajib
    .filter(function (item) { return item.name.trim() || item.amount > 0; })
    .map(function (item) {
      return {
        id: item.id,
        name: item.name.trim() || 'Wajib bayar',
        categoryId: item.categoryId || '',
        amount: toAmount(item.amount)
      };
    });

  period.allocations = {
    wajib: wajib,
    funds: {
      tabungan: toAmount(allocDraft.funds.tabungan),
      darurat: toAmount(allocDraft.funds.darurat),
      investasi: toAmount(allocDraft.funds.investasi)
    },
    updatedAt: new Date().toISOString()
  };

  saveData();
  renderAllocation();
  showToast('Rencana ' + formatMonthYear(period.receivedDate) + ' disimpan');
}


// ===== MENGHUBUNGKAN TOMBOL & KOLOM =====

// Mengetik angka / nama / memilih kategori
allocCard.addEventListener('input', function (event) {
  if (!allocDraft) return;
  const el = event.target;

  if (el.dataset.fund) {
    allocDraft.funds[el.dataset.fund] = toAmount(el.value);
  }

  const row = el.closest('[data-wajib-id]');
  if (row && el.dataset.field) {
    const item = allocDraft.wajib.find(function (w) { return w.id === row.dataset.wajibId; });
    if (el.dataset.field === 'amount') item.amount = toAmount(el.value);
    else item[el.dataset.field] = el.value;
  }

  allocDirty = true;
  updateAllocSummary();
});

// Ganti periode lewat pilihan di pojok kanan atas
allocCard.addEventListener('change', function (event) {
  if (event.target.id !== 'alloc-period') return;
  const newId = event.target.value;

  if (allocDirty && !confirm('Perubahan rencana yang belum disimpan akan hilang. Lanjutkan?')) {
    event.target.value = allocPeriodId;
    return;
  }
  allocPeriodId = newId;
  renderAllocation();
});

// Tombol-tombol di dalam kartu
allocCard.addEventListener('click', function (event) {
  const button = event.target.closest('[data-alloc]');
  if (!button || !allocDraft) return;
  const action = button.dataset.alloc;

  if (action === 'add-wajib') {
    allocDraft.wajib.push({ id: generateId(), name: '', categoryId: '', amount: 0 });
    allocDirty = true;
    renderWajibRows();
    updateAllocSummary();
    const inputs = allocCard.querySelectorAll('#alloc-wajib-list [data-field="name"]');
    inputs[inputs.length - 1].focus();
  }

  if (action === 'remove-wajib') {
    const row = button.closest('[data-wajib-id]');
    allocDraft.wajib = allocDraft.wajib.filter(function (w) { return w.id !== row.dataset.wajibId; });
    allocDirty = true;
    renderWajibRows();
    updateAllocSummary();
  }

  if (action === 'save') {
    saveAllocation();
  }

  if (action === 'reset') {
    if (!allocDirty || confirm('Batalkan semua perubahan yang belum disimpan?')) {
      renderAllocation();
    }
  }
});


// ===== SAAT APLIKASI DIBUKA =====
renderAllocation();
