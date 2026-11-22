// =====================================================
// TABUNGAN.JS — Tabungan Pribadi, Dana Darurat,
//               Investasi Leher ke Atas
// =====================================================
//
// Cara menghitung saldo setiap pos:
//   + Setor      : transaksi "Disisihkan" (uang keluar dengan kategori Keuangan)
//   + Saldo awal : uang yang sudah ada sebelum memakai aplikasi
//   − Pakai      : uang diambil dari pos untuk suatu keperluan
//
// "Saldo awal" dan "Pakai" disimpan di appData.fundMovements,
// TIDAK sebagai transaksi, sehingga tidak mengubah uang di dompet
// maupun anggaran mingguan.

if (!Array.isArray(appData.fundMovements)) appData.fundMovements = [];
if (!appData.fundTargets) appData.fundTargets = { tabungan: 0, darurat: 0, investasi: 0 };

const FUND_CATEGORY_IDS = { tabungan: 'out-tabungan', darurat: 'out-darurat', investasi: 'out-investasi' };
const FUND_ICONS = { tabungan: 'savings', darurat: 'health_and_safety', investasi: 'school' };

// Saran keperluan saat memakai dana
const FUND_PURPOSES = {
  tabungan: ['Kebutuhan pribadi', 'Barang yang diinginkan', 'Keperluan lainnya'],
  darurat: ['Perawatan motor', 'Perbaikan motor', 'Kesehatan mendesak', 'Keperluan mendesak lainnya'],
  investasi: ['Buku', 'Kursus dan pelatihan', 'Sertifikasi', 'Pengembangan keterampilan',
              'Peralatan penunjang pendidikan', 'Pengembangan diri lainnya']
};

const fundSummaryCard = document.getElementById('fund-summary');
const fundGrid = document.getElementById('fund-grid');
const fundHistoryCard = document.getElementById('fund-history');
const fundModal = document.getElementById('fund-modal');
const fundModalTitle = document.getElementById('fund-modal-title');
const fundModalBody = document.getElementById('fund-modal-body');

let fundFilter = 'semua';   // filter riwayat: semua / tabungan / darurat / investasi


// ===== MENGHITUNG =====

// Pos tabungan dari sebuah transaksi (null jika bukan setoran)
function getFundOfTransaction(tx) {
  if (tx.type !== 'keluar') return null;
  const category = findCategory(tx.categoryId);
  return category && category.fund ? category.fund : null;
}

// Semua catatan dana (setor + saldo awal + pakai), terbaru di atas
function getFundEntries(filterKey) {
  const entries = [];

  appData.transactions.forEach(function (tx) {
    const key = getFundOfTransaction(tx);
    if (!key) return;
    entries.push({
      source: 'tx', id: tx.id, fund: key, kind: 'setor',
      amount: tx.amount, date: tx.date, time: tx.time,
      purpose: '', note: tx.note, createdAt: tx.createdAt
    });
  });

  appData.fundMovements.forEach(function (m) {
    entries.push(Object.assign({ source: 'mv' }, m));
  });

  return entries
    .filter(function (e) { return !filterKey || filterKey === 'semua' || e.fund === filterKey; })
    .sort(function (a, b) {
      const byDate = (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time);
      return byDate || (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

function getFundStats(key) {
  const stats = { setor: 0, awal: 0, pakai: 0 };
  getFundEntries(key).forEach(function (e) { stats[e.kind] += e.amount; });
  stats.balance = stats.setor + stats.awal - stats.pakai;
  return stats;
}

function getFundBalance(key) {
  return getFundStats(key).balance;
}

function getTotalFunds() {
  return FUND_KEYS.reduce(function (sum, key) { return sum + getFundBalance(key); }, 0);
}

// Uang di dompet = semua pemasukan dikurangi semua uang keluar (termasuk yang disisihkan)
function getWalletBalance() {
  const fromTransactions = appData.transactions.reduce(function (sum, tx) {
    return sum + (tx.type === 'masuk' ? tx.amount : -tx.amount);
  }, 0);
  // + saldo awal dompet & penyesuaian saldo (dompet.js)
  return fromTransactions + (typeof getWalletExtras === 'function' ? getWalletExtras() : 0);
}


// ===== KARTU RINGKASAN =====
function renderFundSummary() {
  const totalFunds = getTotalFunds();
  const wallet = getWalletBalance();

  fundSummaryCard.innerHTML = `
    <h2 class="card-title">Ringkasan Dana</h2>
    <div class="fund-total">
      <span>Total tabungan</span>
      <strong>${formatRupiah(totalFunds)}</strong>
    </div>
    <div class="stat-grid">
      <div class="stat">
        <span>Uang di dompet</span>
        <strong class="${wallet < 0 ? 'text-danger' : ''}">${formatRupiah(wallet)}</strong>
        <small>Pemasukan dikurangi semua uang keluar</small>
      </div>
      <div class="stat">
        <span>Total saldo keseluruhan</span>
        <strong>${formatRupiah(wallet + totalFunds)}</strong>
        <small>Uang di dompet + semua dana</small>
      </div>
    </div>
  `;
}


// ===== KARTU SETIAP POS =====
function renderFundCards() {
  fundGrid.innerHTML = FUND_KEYS.map(function (key) {
    const stats = getFundStats(key);
    const target = appData.fundTargets[key] || 0;
    const percent = target > 0 ? Math.min(100, Math.round((Math.max(0, stats.balance) / target) * 100)) : 0;
    const reached = target > 0 && stats.balance >= target;

    const targetText = target > 0
      ? `Target ${formatRupiah(target)} · ${percent}%${reached ? ' ✓ Tercapai' : ''}`
      : 'Belum ada target';

    return `
      <div class="fund-card">
        <div class="fund-card-head">
          <div class="tx-icon sisih small">
            <span class="material-symbols-rounded">${FUND_ICONS[key]}</span>
          </div>
          <div>
            <div class="fund-name">${FUND_INFO[key].label}</div>
            <div class="fund-hint">${FUND_INFO[key].hint}</div>
          </div>
        </div>

        <div class="fund-balance">${formatRupiah(stats.balance)}</div>
        <div class="fund-target">${targetText}</div>
        ${target > 0 ? `<div class="mini-bar ${reached ? 'done' : ''}"><span style="width:${percent}%"></span></div>` : ''}

        <div class="fund-stats">
          Disetor ${formatRupiah(stats.setor + stats.awal)} · Dipakai ${formatRupiah(stats.pakai)}
        </div>

        <div class="fund-actions">
          <button type="button" class="btn btn-primary btn-sm" data-fund-action="setor" data-fund="${key}">
            <span class="material-symbols-rounded">add</span> Setor
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-fund-action="pakai" data-fund="${key}">
            <span class="material-symbols-rounded">remove</span> Pakai
          </button>
          <button type="button" class="icon-btn" data-fund-action="target" data-fund="${key}" title="Atur target">
            <span class="material-symbols-rounded">flag</span>
          </button>
        </div>
      </div>
    `;
  }).join('');
}


// ===== RIWAYAT DANA =====
function renderFundHistory() {
  const entries = getFundEntries(fundFilter);

  const chips = [['semua', 'Semua']].concat(FUND_KEYS.map(function (key) {
    return [key, FUND_INFO[key].label];
  })).map(function (pair) {
    return `<button type="button" class="filter-chip ${fundFilter === pair[0] ? 'active' : ''}" data-fund-filter="${pair[0]}">${pair[1]}</button>`;
  }).join('');

  const kindInfo = {
    setor: { label: 'Setor', icon: 'add_circle', cls: 'sisih', sign: '+' },
    awal:  { label: 'Saldo awal', icon: 'account_balance', cls: 'masuk', sign: '+' },
    pakai: { label: 'Pakai', icon: 'shopping_bag', cls: 'keluar', sign: '−' }
  };

  const list = entries.length === 0
    ? '<p class="empty-state">Belum ada catatan dana.</p>'
    : entries.map(function (e) {
        const info = kindInfo[e.kind];
        const title = e.kind === 'pakai' && e.purpose ? info.label + ' · ' + e.purpose : info.label;
        return `
          <div class="tx-item">
            <div class="tx-icon ${info.cls}">
              <span class="material-symbols-rounded">${info.icon}</span>
            </div>
            <div class="tx-info">
              <div class="tx-category">${escapeHtml(title)}</div>
              ${e.note ? `<div class="tx-note">${escapeHtml(e.note)}</div>` : ''}
              <div class="tx-meta">${FUND_INFO[e.fund].label} · ${formatShortDate(e.date)} · ${e.time}</div>
            </div>
            <div class="tx-right">
              <div class="tx-amount ${info.cls}">${info.sign}${formatRupiah(e.amount)}</div>
              <div class="tx-actions">
                <button type="button" class="icon-btn danger" data-fund-delete="${e.id}" data-source="${e.source}" title="Hapus">
                  <span class="material-symbols-rounded">delete</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

  fundHistoryCard.innerHTML = `
    <h2 class="card-title">Riwayat Dana</h2>
    <div class="filter-chips">${chips}</div>
    <div class="tx-list">${list}</div>
  `;
}


// ===== TAMPILKAN SELURUH HALAMAN =====
function renderTabungan() {
  renderFundSummary();
  renderFundCards();
  renderFundHistory();
}


// ===== JENDELA FORM: SETOR / PAKAI / TARGET =====
function openFundForm(mode, key) {
  const label = FUND_INFO[key].label;
  const balance = getFundBalance(key);
  let html = '';

  if (mode === 'setor') {
    fundModalTitle.textContent = 'Setor ke ' + label;
    html = `
      <p class="card-text">Uang dipindahkan dari uang di dompet ke ${label} dan tercatat sebagai transaksi "Disisihkan".</p>
      <div class="form-grid">
        ${amountFieldHtml('Nominal setor')}
        ${dateTimeFieldsHtml()}
        <div class="field field-full">
          <label for="fund-note">Keterangan <span class="optional">(boleh dikosongkan)</span></label>
          <input type="text" id="fund-note" maxlength="100" placeholder="Contoh: Sisihkan dari uang bulanan">
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" id="fund-initial">
        Saldo awal — uang yang sudah ada sebelum memakai aplikasi (tidak mengurangi uang di dompet)
      </label>
    `;
  }

  if (mode === 'pakai') {
    fundModalTitle.textContent = 'Pakai ' + label;
    const options = FUND_PURPOSES[key].map(function (p) { return `<option value="${p}"></option>`; }).join('');
    html = `
      <div class="fund-available">
        <span>Saldo ${label}</span>
        <strong>${formatRupiah(balance)}</strong>
      </div>
      <div class="form-grid">
        ${amountFieldHtml('Nominal dipakai')}
        ${dateTimeFieldsHtml()}
        <div class="field field-full">
          <label for="fund-purpose">Keperluan</label>
          <input type="text" id="fund-purpose" list="fund-purpose-options" maxlength="50" placeholder="Pilih atau ketik keperluan">
          <datalist id="fund-purpose-options">${options}</datalist>
        </div>
        <div class="field field-full">
          <label for="fund-note">Keterangan <span class="optional">(boleh dikosongkan)</span></label>
          <input type="text" id="fund-note" maxlength="100" placeholder="Contoh: Ganti oli dan kampas rem">
        </div>
      </div>
      <p class="hint">Pemakaian dana tidak mengurangi uang di dompet maupun anggaran mingguan.</p>
    `;
  }

  if (mode === 'target') {
    fundModalTitle.textContent = 'Target ' + label;
    html = `
      <div class="form-grid">
        ${amountFieldHtml('Target', appData.fundTargets[key] || '')}
      </div>
      <p class="hint">Isi 0 atau kosongkan jika tidak ingin memakai target.</p>
    `;
  }

  fundModalBody.innerHTML = `
    <form id="fund-form" data-mode="${mode}" data-fund="${key}" novalidate>
      ${html}
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">check</span>
          Simpan
        </button>
      </div>
    </form>
  `;

  if (mode !== 'target') {
    document.getElementById('fund-date').value = todayString();
    document.getElementById('fund-time').value = currentTimeString();
  }

  fundModal.classList.add('open');
  setTimeout(function () { document.getElementById('fund-amount').focus(); }, 100);
}

function amountFieldHtml(label, value) {
  return `
    <div class="field field-full">
      <label for="fund-amount">${label}</label>
      <div class="input-prefix">
        <span>Rp</span>
        <input type="number" id="fund-amount" inputmode="numeric" min="0" step="1" placeholder="0" value="${value || ''}">
      </div>
    </div>
  `;
}

function dateTimeFieldsHtml() {
  return `
    <div class="field">
      <label for="fund-date">Tanggal</label>
      <input type="date" id="fund-date">
    </div>
    <div class="field">
      <label for="fund-time">Jam</label>
      <input type="time" id="fund-time">
    </div>
  `;
}

function closeFundForm() {
  fundModal.classList.remove('open');
}


// ===== SIMPAN DARI JENDELA FORM =====
function saveFundForm(form) {
  const mode = form.dataset.mode;
  const key = form.dataset.fund;
  const label = FUND_INFO[key].label;
  const amount = toAmount(document.getElementById('fund-amount').value);

  // --- Target ---
  if (mode === 'target') {
    appData.fundTargets[key] = amount;
    saveData();
    closeFundForm();
    renderTabungan();
    showToast(amount ? 'Target ' + label + ': ' + formatRupiah(amount) : 'Target ' + label + ' dihapus');
    return;
  }

  // --- Setor / Pakai ---
  const date = document.getElementById('fund-date').value;
  const time = document.getElementById('fund-time').value || '00:00';
  const note = document.getElementById('fund-note').value.trim();

  if (!amount) {
    showToast('Isi nominal terlebih dahulu');
    return;
  }
  if (!date) {
    showToast('Isi tanggal terlebih dahulu');
    return;
  }

  const now = new Date().toISOString();

  if (mode === 'setor') {
    const isInitial = document.getElementById('fund-initial').checked;

    if (isInitial) {
      appData.fundMovements.push({
        id: generateId(), fund: key, kind: 'awal', amount: amount,
        date: date, time: time, purpose: '', note: note, createdAt: now
      });
    } else {
      appData.transactions.push({
        id: generateId(), type: 'keluar', amount: amount, date: date, time: time,
        categoryId: FUND_CATEGORY_IDS[key], source: '', note: note, createdAt: now
      });
    }
    showToast(formatRupiah(amount) + ' disetor ke ' + label);
  }

  if (mode === 'pakai') {
    const purpose = document.getElementById('fund-purpose').value.trim();
    const balance = getFundBalance(key);

    if (!purpose) {
      showToast('Isi keperluan pemakaian dana');
      return;
    }
    if (amount > balance) {
      showToast('Saldo ' + label + ' tidak cukup (' + formatRupiah(balance) + ')');
      return;
    }

    appData.fundMovements.push({
      id: generateId(), fund: key, kind: 'pakai', amount: amount,
      date: date, time: time, purpose: purpose, note: note, createdAt: now
    });
    showToast(formatRupiah(amount) + ' dipakai dari ' + label);
  }

  saveData();
  closeFundForm();
  renderTabungan();
  renderRecentTransactions();
  updateBackupInfo();
}


// ===== HAPUS CATATAN DANA =====
function deleteFundEntry(id, source) {
  if (source === 'tx') {
    // Setoran adalah transaksi biasa → pakai fungsi hapus transaksi
    deleteTransaction(id);
  } else {
    const movement = appData.fundMovements.find(function (m) { return m.id === id; });
    if (!movement) return;

    const label = movement.kind === 'awal' ? 'saldo awal' : 'pemakaian';
    if (!confirm('Hapus catatan ' + label + ' ' + formatRupiah(movement.amount) + ' dari ' +
                 FUND_INFO[movement.fund].label + '?')) {
      return;
    }

    appData.fundMovements = appData.fundMovements.filter(function (m) { return m.id !== id; });
    saveData();
    showToast('Catatan dana dihapus');
  }

  renderTabungan();
}


// ===== MENGHUBUNGKAN TOMBOL =====
fundGrid.addEventListener('click', function (event) {
  const button = event.target.closest('[data-fund-action]');
  if (button) openFundForm(button.dataset.fundAction, button.dataset.fund);
});

fundHistoryCard.addEventListener('click', function (event) {
  const chip = event.target.closest('[data-fund-filter]');
  if (chip) {
    fundFilter = chip.dataset.fundFilter;
    renderFundHistory();
    return;
  }

  const del = event.target.closest('[data-fund-delete]');
  if (del) deleteFundEntry(del.dataset.fundDelete, del.dataset.source);
});

fundModalBody.addEventListener('submit', function (event) {
  event.preventDefault();
  saveFundForm(event.target);
});

fundModal.querySelectorAll('[data-fund-close]').forEach(function (el) {
  el.addEventListener('click', closeFundForm);
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && fundModal.classList.contains('open')) closeFundForm();
});

// Perbarui setiap kali menu Tabungan dibuka
document.querySelectorAll('[data-page="tabungan"]').forEach(function (btn) {
  btn.addEventListener('click', renderTabungan);
});


// ===== SAAT APLIKASI DIBUKA =====
renderTabungan();
