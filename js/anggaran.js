// =====================================================
// ANGGARAN.JS — Anggaran mingguan
// Pekan dihitung dari tanggal uang bulanan diterima.
// =====================================================

const budgetCurrentCard = document.getElementById('budget-current');
const budgetCard = document.getElementById('budget-card');

let budgetPeriodId = null;  // periode yang sedang diatur
let budgetDraft = null;     // { budgets: [...], carry: true/false } — belum disimpan
let budgetDirty = false;


// ===== ALAT BANTU TANGGAL =====
function addDays(dateString, n) {
  const d = new Date(dateString + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateToString(d);
}

// "7–13 Nov" atau "28 Nov – 4 Des"
function formatRange(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const month = function (d) { return d.toLocaleDateString('id-ID', { month: 'short' }); };
  if (start === end) return s.getDate() + ' ' + month(s);
  if (s.getMonth() === e.getMonth()) return s.getDate() + '–' + e.getDate() + ' ' + month(e);
  return s.getDate() + ' ' + month(s) + ' – ' + e.getDate() + ' ' + month(e);
}


// ===== MEMBAGI PERIODE MENJADI PEKAN =====
// Pekan 1 = 7 hari pertama sejak uang diterima, dst.
// Hari yang tersisa di akhir menjadi pekan terakhir (misalnya Pekan 5).
function getPeriodWeeks(period) {
  const weeks = [];
  const lastDay = addDays(period.nextExpectedDate, -1);
  let start = period.receivedDate;
  let index = 0;

  while (start <= lastDay) {
    let end = addDays(start, 6);
    if (end > lastDay) end = lastDay;
    weeks.push({ index: index, start: start, end: end, days: daysBetween(start, end) + 1 });
    start = addDays(end, 1);
    index++;
  }
  return weeks;
}


// ===== PENGELUARAN DALAM SATU PEKAN =====
// Tidak dihitung: uang yang disisihkan (tabungan, dll.)
// dan kategori yang sudah masuk "Kebutuhan wajib" di alokasi.
function getWajibCategoryIds(period) {
  if (!period.allocations) return [];
  return period.allocations.wajib
    .map(function (w) { return w.categoryId; })
    .filter(Boolean);
}

function getWeekSpending(period, start, end) {
  const excluded = getWajibCategoryIds(period);

  return appData.transactions
    .filter(function (tx) {
      if (tx.type !== 'keluar' || tx.date < start || tx.date > end) return false;
      if (tx.billId) return false;   // pembayaran tagihan rutin

      const category = findCategory(tx.categoryId);
      if (category && category.fund) return false;
      return !excluded.includes(tx.categoryId);
    })
    .reduce(function (sum, tx) { return sum + tx.amount; }, 0);
}


// ===== STATUS SETIAP PEKAN =====
function getWeekStatuses(period, budgets, carryOn) {
  const today = todayString();
  const statuses = [];

  // Sisa hanya dibawa jika anggaran mingguan sudah diisi
  const hasBudgets = budgets.some(function (b) { return b > 0; });

  getPeriodWeeks(period).forEach(function (week, i) {
    const previous = statuses[i - 1];
    const budget = budgets[i] || 0;

    // Sisa dibawa hanya dari pekan yang SUDAH selesai
    const carryIn = carryOn && hasBudgets && previous && previous.state === 'selesai' ? previous.remaining : 0;

    const available = budget + carryIn;
    const spent = getWeekSpending(period, week.start, week.end);
    const remaining = available - spent;

    let state = 'berjalan';
    if (today < week.start) state = 'akan';
    else if (today > week.end) state = 'selesai';

    let percent = 0;
    if (available > 0) percent = Math.round((spent / available) * 100);
    else if (spent > 0) percent = 100;

    statuses.push(Object.assign({}, week, {
      budget: budget,
      carryIn: carryIn,
      available: available,
      spent: spent,
      remaining: remaining,
      state: state,
      percent: percent
    }));
  });

  return statuses;
}

// Tingkat kewaspadaan: aman / hampir habis / melebihi
function getBudgetLevel(status) {
  if (status.remaining < 0) return { cls: 'over', label: 'Melebihi anggaran' };
  if (status.percent >= 80) return { cls: 'late', label: 'Hampir habis' };
  return { cls: 'ok', label: 'Aman' };
}

// Status pekan yang sedang berjalan (dipakai juga oleh Dashboard nanti)
function getCurrentWeekStatus() {
  const period = getCurrentPeriod();
  if (!period) return null;
  const statuses = getWeekStatuses(period, period.weekBudgets || [], period.carryWeeks !== false);
  const current = statuses.find(function (s) { return s.state === 'berjalan'; });
  return current ? { period: period, week: current } : null;
}

// Uang yang boleh dibagi ke pekan-pekan (dari alokasi yang tersimpan)
function getWeeklyPool(period) {
  return getAllocationTotals(period).remaining;
}


// ===== KARTU "PEKAN INI" =====
function renderCurrentWeek() {
  const info = getCurrentWeekStatus();

  if (!info) {
    budgetCurrentCard.innerHTML = `
      <h2 class="card-title">Pekan Ini</h2>
      <p class="empty-state">
        Belum ada periode uang bulanan yang sedang berjalan.<br>
        Catat uang bulanan terlebih dahulu.
      </p>
      <div class="button-row">
        <button type="button" class="btn btn-primary" data-go="bulanan">
          <span class="material-symbols-rounded">account_balance_wallet</span>
          Buka Uang Bulanan
        </button>
      </div>
    `;
    return;
  }

  const week = info.week;
  const level = getBudgetLevel(week);
  const daysLeft = daysBetween(todayString(), week.end) + 1;
  const dailyLimit = week.remaining > 0 ? Math.floor(week.remaining / daysLeft) : 0;
  const barWidth = Math.min(100, week.percent);

  budgetCurrentCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Pekan Ini</h2>
      <span class="status-badge ${level.cls}">${level.label}</span>
    </div>
    <div class="week-label">
      Pekan ${week.index + 1} · ${formatRange(week.start, week.end)} · ${daysLeft} hari lagi
    </div>

    <div class="budget-hero">
      <span>Sisa anggaran pekan ini</span>
      <strong class="${week.remaining < 0 ? 'negative' : ''}">
        ${week.remaining < 0 ? '−' + formatRupiah(Math.abs(week.remaining)) : formatRupiah(week.remaining)}
      </strong>
    </div>
    <div class="budget-bar ${level.cls === 'ok' ? '' : (level.cls === 'late' ? 'warn' : 'over')}">
      <span style="width:${barWidth}%"></span>
    </div>

    <div class="stat-grid three">
      <div class="stat">
        <span>Anggaran</span>
        <strong>${formatRupiah(week.available)}</strong>
        <small>${week.carryIn ? (week.carryIn > 0 ? '+' : '−') + formatRupiah(Math.abs(week.carryIn)) + ' dari pekan lalu' : 'Tanpa bawaan'}</small>
      </div>
      <div class="stat">
        <span>Terpakai</span>
        <strong>${formatRupiah(week.spent)}</strong>
        <small>${week.percent}% dari anggaran</small>
      </div>
      <div class="stat">
        <span>Boleh per hari</span>
        <strong>${formatRupiah(dailyLimit)}</strong>
        <small>untuk ${daysLeft} hari tersisa</small>
      </div>
    </div>

    ${week.available === 0 ? '<p class="inline-hint">Anggaran pekan ini belum diisi. Atur di bawah.</p>' : ''}
  `;
}


// ===== BARIS-BARIS PEKAN DI EDITOR =====
function weekStatusHtml(status) {
  if (!status.available && !status.spent) return '';

  const level = getBudgetLevel(status);
  const barClass = level.cls === 'ok' ? '' : (level.cls === 'late' ? 'warn' : 'over');
  const carryText = status.carryIn
    ? ` (termasuk ${status.carryIn > 0 ? 'bawaan' : 'potongan'} ${formatRupiah(Math.abs(status.carryIn))})`
    : '';
  const remainingText = status.remaining < 0
    ? 'Lebih ' + formatRupiah(Math.abs(status.remaining))
    : 'Sisa ' + formatRupiah(status.remaining);

  return `
    Terpakai ${formatRupiah(status.spent)} dari ${formatRupiah(status.available)}${carryText} · ${remainingText}
    <div class="mini-bar ${barClass}"><span style="width:${Math.min(100, status.percent)}%"></span></div>
  `;
}

function updateBudgetSummary() {
  const period = findPeriod(budgetPeriodId);
  if (!period) return;

  const statuses = getWeekStatuses(period, budgetDraft.budgets, budgetDraft.carry);
  const pool = getWeeklyPool(period);
  const total = statuses.reduce(function (sum, s) { return sum + s.budget; }, 0);
  const unallocated = pool - total;
  const isOver = unallocated < 0;

  // Status tiap pekan
  statuses.forEach(function (status) {
    const el = budgetCard.querySelector(`[data-week-status="${status.index}"]`);
    if (el) el.innerHTML = weekStatusHtml(status);
  });

  // Ringkasan
  document.getElementById('budget-summary').innerHTML = `
    <div class="alloc-lines">
      <div class="alloc-line">Sisa untuk anggaran mingguan<strong>${formatRupiah(pool)}</strong></div>
      <div class="alloc-line">Total anggaran ${statuses.length} pekan<strong>${formatRupiah(total)}</strong></div>
      <div class="alloc-line total ${isOver ? 'negative' : ''}">
        Belum dialokasikan
        <strong>${isOver ? '−' + formatRupiah(Math.abs(unallocated)) : formatRupiah(unallocated)}</strong>
      </div>
    </div>
    ${isOver ? `<p class="alloc-warning">Total anggaran mingguan melebihi uang yang tersedia sebesar ${formatRupiah(Math.abs(unallocated))}.</p>` : ''}
  `;

  budgetCard.querySelector('[data-budget="save"]').disabled = isOver;
}


// ===== KARTU "ATUR ANGGARAN MINGGUAN" =====
function renderBudgetEditor() {
  if (appData.periods.length === 0) {
    budgetPeriodId = null;
    budgetDraft = null;
    budgetCard.innerHTML = `
      <h2 class="card-title">Atur Anggaran Mingguan</h2>
      <p class="empty-state">Belum ada uang bulanan untuk dibagi per pekan.</p>
    `;
    return;
  }

  if (!findPeriod(budgetPeriodId)) {
    budgetPeriodId = (getCurrentPeriod() || getSortedPeriods()[0]).id;
  }
  const period = findPeriod(budgetPeriodId);
  const weeks = getPeriodWeeks(period);

  budgetDraft = {
    budgets: weeks.map(function (w, i) { return (period.weekBudgets || [])[i] || 0; }),
    carry: period.carryWeeks !== false
  };
  budgetDirty = false;

  const today = todayString();
  const stateLabels = { selesai: 'Selesai', berjalan: 'Berjalan', akan: 'Akan datang' };

  const periodOptions = getSortedPeriods().map(function (p) {
    const selected = p.id === budgetPeriodId ? 'selected' : '';
    return `<option value="${p.id}" ${selected}>${formatMonthYear(p.receivedDate)}</option>`;
  }).join('');

  const weekRows = weeks.map(function (week, i) {
    let state = 'berjalan';
    if (today < week.start) state = 'akan';
    else if (today > week.end) state = 'selesai';

    return `
      <div class="week-row state-${state}">
        <div class="week-grid">
          <div>
            <div class="week-title">
              Pekan ${i + 1}
              <span class="week-state">${stateLabels[state]}</span>
            </div>
            <div class="week-dates">${formatRange(week.start, week.end)} · ${week.days} hari</div>
          </div>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" data-week-input="${i}" inputmode="numeric" min="0" step="1" placeholder="0" value="${budgetDraft.budgets[i] || ''}">
          </div>
        </div>
        <div class="week-status" data-week-status="${i}"></div>
      </div>
    `;
  }).join('');

  budgetCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Atur Anggaran Mingguan</h2>
      <select class="mini-select" id="budget-period" title="Pilih periode">${periodOptions}</select>
    </div>
    <p class="card-text">
      Tentukan sendiri nominal tiap pekan. Uang yang disisihkan ke tabungan dan
      pengeluaran kategori kebutuhan wajib tidak dihitung di sini.
    </p>

    <div class="alloc-available">
      <span>Sisa untuk anggaran mingguan</span>
      <strong>${formatRupiah(getWeeklyPool(period))}</strong>
    </div>
    ${period.allocations ? '' : '<p class="inline-hint">Alokasi periode ini belum disimpan. Atur dulu di menu Uang Bulanan agar angka di atas akurat.</p>'}

    <div class="week-list">${weekRows}</div>

    <label class="check-row">
      <input type="checkbox" id="budget-carry" ${budgetDraft.carry ? 'checked' : ''}>
      Bawa sisa pekan sebelumnya ke pekan berikutnya
    </label>

    <div class="alloc-summary" id="budget-summary"></div>

    <div class="button-row">
      <button type="button" class="btn btn-primary" data-budget="save">
        <span class="material-symbols-rounded">check</span>
        Simpan Anggaran
      </button>
      <button type="button" class="btn btn-secondary" data-budget="auto">
        <span class="material-symbols-rounded">auto_fix_high</span>
        Isi Otomatis Sesuai Jumlah Hari
      </button>
      <button type="button" class="btn btn-secondary" data-budget="reset">
        Batalkan Perubahan
      </button>
    </div>
  `;

  updateBudgetSummary();
}


// ===== ISI OTOMATIS (opsional) =====
// Membagi sisa uang sebanding jumlah hari tiap pekan, dibulatkan ke ribuan.
function autoFillBudgets() {
  const period = findPeriod(budgetPeriodId);
  const weeks = getPeriodWeeks(period);
  const pool = Math.max(0, getWeeklyPool(period));
  const totalDays = weeks.reduce(function (sum, w) { return sum + w.days; }, 0);

  const hasValues = budgetDraft.budgets.some(function (b) { return b > 0; });
  if (hasValues && !confirm('Nominal yang sudah diisi akan diganti. Lanjutkan?')) return;

  let used = 0;
  budgetDraft.budgets = weeks.map(function (week, i) {
    if (i === weeks.length - 1) return pool - used;   // pekan terakhir menerima sisanya
    const value = Math.floor((pool * week.days / totalDays) / 1000) * 1000;
    used += value;
    return value;
  });

  budgetCard.querySelectorAll('[data-week-input]').forEach(function (input) {
    input.value = budgetDraft.budgets[Number(input.dataset.weekInput)] || '';
  });

  budgetDirty = true;
  updateBudgetSummary();
}


// ===== SIMPAN =====
function saveBudgets() {
  const period = findPeriod(budgetPeriodId);
  if (!period) return;

  const total = budgetDraft.budgets.reduce(function (sum, b) { return sum + b; }, 0);
  if (total > getWeeklyPool(period)) {
    showToast('Total anggaran melebihi uang yang tersedia');
    return;
  }

  period.weekBudgets = budgetDraft.budgets.slice();
  period.carryWeeks = budgetDraft.carry;
  saveData();

  renderAnggaran(true);
  showToast('Anggaran mingguan disimpan');
}


// ===== TAMPILKAN HALAMAN =====
// force = true: tampilkan ulang walaupun ada perubahan yang belum disimpan
function renderAnggaran(force) {
  renderCurrentWeek();
  if (force || !budgetDirty) renderBudgetEditor();
}


// ===== MENGHUBUNGKAN TOMBOL & KOLOM =====
budgetCard.addEventListener('input', function (event) {
  const el = event.target;
  if (!budgetDraft || el.dataset.weekInput === undefined) return;

  budgetDraft.budgets[Number(el.dataset.weekInput)] = toAmount(el.value);
  budgetDirty = true;
  updateBudgetSummary();
});

budgetCard.addEventListener('change', function (event) {
  const el = event.target;

  if (el.id === 'budget-carry') {
    budgetDraft.carry = el.checked;
    budgetDirty = true;
    updateBudgetSummary();
  }

  if (el.id === 'budget-period') {
    if (budgetDirty && !confirm('Perubahan yang belum disimpan akan hilang. Lanjutkan?')) {
      el.value = budgetPeriodId;
      return;
    }
    budgetPeriodId = el.value;
    renderBudgetEditor();
  }
});

budgetCard.addEventListener('click', function (event) {
  const button = event.target.closest('[data-budget]');
  if (!button) return;

  const action = button.dataset.budget;
  if (action === 'save') saveBudgets();
  if (action === 'auto') autoFillBudgets();
  if (action === 'reset' && (!budgetDirty || confirm('Batalkan semua perubahan yang belum disimpan?'))) {
    renderAnggaran(true);
  }
});

// Tombol "Buka Uang Bulanan" saat belum ada data
budgetCurrentCard.addEventListener('click', function (event) {
  const button = event.target.closest('[data-go]');
  if (button) showPage(button.dataset.go);
});

// Perbarui setiap kali menu Anggaran Mingguan dibuka
document.querySelectorAll('[data-page="anggaran"]').forEach(function (btn) {
  btn.addEventListener('click', function () { renderAnggaran(false); });
});


// ===== SAAT APLIKASI DIBUKA =====
renderAnggaran(true);
