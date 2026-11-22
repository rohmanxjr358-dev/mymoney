// =====================================================
// DASHBOARD.JS — Ringkasan seluruh keuangan di satu layar
// =====================================================

const dashHero = document.getElementById('dash-hero');
const dashSafe = document.getElementById('dash-safe');
const dashStats = document.getElementById('dash-stats');
const dashFunds = document.getElementById('dash-funds');
const dashCategories = document.getElementById('dash-categories');
const dashChartCard = document.getElementById('dash-chart');
const dashRecent = document.getElementById('dash-recent');

let dashChart = null;   // grafik Chart.js (disimpan agar bisa diganti saat diperbarui)


// ===== ALAT BANTU =====
function getMonthRange(offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + (offset || 0), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  return { start: dateToString(start), end: dateToString(end), date: start };
}

// Total masuk, pengeluaran (tanpa yang disisihkan), dan disisihkan dalam rentang tanggal
function getTotalsBetween(start, end) {
  const totals = { masuk: 0, keluar: 0, sisih: 0 };
  appData.transactions.forEach(function (tx) {
    if (tx.date < start || tx.date > end) return;
    totals[getTransactionKind(tx)] += tx.amount;
  });
  return totals;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 18) return 'Selamat sore';
  return 'Selamat malam';
}

function signedRupiah(value) {
  return value < 0 ? '−' + formatRupiah(Math.abs(value)) : formatRupiah(value);
}


// ===== 1. TOTAL SALDO KESELURUHAN =====
function renderDashHero() {
  const wallet = getWalletBalance();
  const funds = getTotalFunds();

  dashHero.innerHTML = `
    <div class="dash-hero-top">
      <div>
        <div class="dash-greeting">${greeting()} 👋</div>
        <div class="dash-hero-label">Total saldo keseluruhan</div>
        <div class="dash-hero-value">${signedRupiah(wallet + funds)}</div>
      </div>
      <button type="button" class="btn btn-light" data-dash-go="transaksi">
        <span class="material-symbols-rounded">add</span>
        Catat Transaksi
      </button>
    </div>
    <div class="dash-hero-split">
      <div><span>Uang pakai</span><strong>${signedRupiah(wallet)}</strong></div>
      <div><span>Dana tersimpan</span><strong>${formatRupiah(funds)}</strong></div>
    </div>
  `;
}


// ===== 2. UANG AMAN SAMPAI TRANSFER BERIKUTNYA =====
function renderDashSafe() {
  const safe = getSafeMoney();

  if (!safe.ready) {
    dashSafe.innerHTML = `
      <h2 class="card-title">Uang Aman sampai Transfer Berikutnya</h2>
      <p class="empty-state">
        Catat uang bulanan terlebih dahulu agar aplikasi tahu kapan transfer berikutnya.
      </p>
      <div class="button-row">
        <button type="button" class="btn btn-primary" data-dash-go="bulanan">
          <span class="material-symbols-rounded">account_balance_wallet</span>
          Buka Uang Bulanan
        </button>
      </div>
    `;
    return;
  }

  // Rincian pengurang
  const lines = [
    { label: 'Uang pakai saat ini', value: safe.wallet, sign: '' }
  ];
  if (safe.wajib.total) lines.push({ label: 'Kebutuhan wajib belum dibayar', value: safe.wajib.total, sign: '−', items: safe.wajib.items });
  if (safe.bills.total) lines.push({ label: 'Tagihan sebelum transfer berikutnya', value: safe.bills.total, sign: '−', items: safe.bills.items });
  if (safe.savings.total) lines.push({ label: 'Rencana disisihkan, belum dipindah', value: safe.savings.total, sign: '−', items: safe.savings.items });

  const linesHtml = lines.map(function (line) {
    const detail = line.items
      ? `<div class="safe-sub">${line.items.map(function (i) { return escapeHtml(i.name) + ' ' + formatRupiah(i.amount); }).join(' · ')}</div>`
      : '';
    return `
      <div class="safe-line">
        <div><span>${line.label}</span>${detail}</div>
        <strong>${line.sign}${signedRupiah(line.value)}</strong>
      </div>
    `;
  }).join('');

  const projection = safe.daysLeft <= 0
    ? ''
    : safe.averageDaily === 0
      ? 'Belum ada pengeluaran harian di periode ini untuk dijadikan perkiraan.'
      : safe.projectedEnough
        ? `Dengan rata-rata pengeluaran ${formatRupiah(safe.averageDaily)}/hari sejauh ini, uang diperkirakan <strong>cukup</strong> sampai transfer berikutnya.`
        : `Dengan rata-rata pengeluaran ${formatRupiah(safe.averageDaily)}/hari sejauh ini, uang diperkirakan <strong>kurang ${formatRupiah(safe.projectedNeed - safe.usable)}</strong> sebelum transfer berikutnya.`;

  const warningsHtml = safe.warnings.map(function (w) {
    return `
      <div class="dash-warning ${w.level}">
        <span class="material-symbols-rounded">${w.level === 'over' ? 'error' : 'warning'}</span>
        <span>${w.text}</span>
      </div>
    `;
  }).join('');

  const todayPercent = safe.dailyLimit > 0 ? Math.min(100, Math.round((safe.spentToday / safe.dailyLimit) * 100)) : 0;
  const todayClass = safe.spentToday > safe.dailyLimit ? 'over' : (todayPercent >= 80 ? 'warn' : '');

  dashSafe.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Uang Aman sampai Transfer Berikutnya</h2>
      <span class="status-badge ${safe.usable < 0 ? 'over' : (safe.projectedEnough ? 'ok' : 'late')}">
        ${safe.usable < 0 ? 'Kurang' : (safe.projectedEnough ? 'Cukup' : 'Perlu hemat')}
      </span>
    </div>

    <div class="safe-main">
      <div class="safe-big">
        <span>Bisa dipakai</span>
        <strong class="${safe.usable < 0 ? 'text-danger' : ''}">${signedRupiah(safe.usable)}</strong>
        <small>sampai ${formatShortDate(safe.nextDate)} · ${Math.max(0, safe.daysLeft)} hari lagi</small>
      </div>
      <div class="safe-big">
        <span>Batas pengeluaran harian</span>
        <strong>${formatRupiah(safe.dailyLimit)}</strong>
        <small>Hari ini terpakai ${formatRupiah(safe.spentToday)}</small>
        <div class="budget-bar ${todayClass}"><span style="width:${todayPercent}%"></span></div>
      </div>
    </div>

    <div class="safe-lines">
      ${linesHtml}
      <div class="safe-line total">
        <span>Bisa dipakai</span>
        <strong>${signedRupiah(safe.usable)}</strong>
      </div>
    </div>

    ${projection ? `<p class="safe-projection">${projection}</p>` : ''}
    ${warningsHtml}
  `;
}


// ===== 3. ANGKA BULAN INI, SISA UANG BULANAN, PEKAN INI =====
function renderDashStats() {
  const month = getMonthRange(0);
  const totals = getTotalsBetween(month.start, month.end);
  const monthName = month.date.toLocaleDateString('id-ID', { month: 'long' });

  // Sisa uang bulanan: uang tersedia periode berjalan − semua uang keluar di periode itu
  const period = getCurrentPeriod();
  let periodTile = `
    <div class="stat"><span>Sisa uang bulanan</span><strong>–</strong><small>Belum ada uang bulanan</small></div>
  `;
  if (period) {
    const available = getAvailableMoney(period);
    const out = appData.transactions
      .filter(function (tx) {
        return tx.type === 'keluar' && tx.date >= period.receivedDate && tx.date < period.nextExpectedDate;
      })
      .reduce(function (sum, tx) { return sum + tx.amount; }, 0);
    periodTile = `
      <div class="stat">
        <span>Sisa uang bulanan</span>
        <strong class="${available - out < 0 ? 'text-danger' : ''}">${signedRupiah(available - out)}</strong>
        <small>dari ${formatRupiah(available)} (${formatMonthYear(period.receivedDate)})</small>
      </div>
    `;
  }

  // Pekan berjalan
  const weekInfo = getCurrentWeekStatus();
  let weekTile = `
    <div class="stat"><span>Anggaran pekan ini</span><strong>–</strong><small>Belum diatur</small></div>
  `;
  if (weekInfo && weekInfo.week.available === 0) {
    weekTile = `
      <div class="stat">
        <span>Anggaran pekan ini</span>
        <strong>Belum diatur</strong>
        <small>Terpakai ${formatRupiah(weekInfo.week.spent)} · atur di menu Anggaran</small>
      </div>
    `;
  } else if (weekInfo) {
    const w = weekInfo.week;
    const level = getBudgetLevel(w);
    weekTile = `
      <div class="stat">
        <span>Pekan ${w.index + 1} · sisa anggaran</span>
        <strong class="${w.remaining < 0 ? 'text-danger' : ''}">${signedRupiah(w.remaining)}</strong>
        <small>Terpakai ${formatRupiah(w.spent)} dari ${signedRupiah(w.available)}</small>
        <div class="budget-bar ${level.cls === 'ok' ? '' : (level.cls === 'late' ? 'warn' : 'over')}">
          <span style="width:${Math.min(100, w.percent)}%"></span>
        </div>
      </div>
    `;
  }

  dashStats.innerHTML = `
    <div class="stat">
      <span>Uang masuk ${monthName}</span>
      <strong class="text-success">+${formatRupiah(totals.masuk)}</strong>
      <small>Semua pemasukan bulan ini</small>
    </div>
    <div class="stat">
      <span>Uang keluar ${monthName}</span>
      <strong class="text-danger">−${formatRupiah(totals.keluar)}</strong>
      <small>${totals.sisih ? 'Disisihkan ' + formatRupiah(totals.sisih) + ' (tidak termasuk)' : 'Tidak termasuk yang disisihkan'}</small>
    </div>
    ${periodTile}
    ${weekTile}
  `;
}


// ===== 4. TABUNGAN =====
function renderDashFunds() {
  dashFunds.innerHTML = FUND_KEYS.map(function (key) {
    const balance = getFundBalance(key);
    const target = appData.fundTargets[key] || 0;
    const percent = target > 0 ? Math.min(100, Math.round((Math.max(0, balance) / target) * 100)) : 0;
    return `
      <button type="button" class="dash-fund" data-dash-go="tabungan">
        <div class="tx-icon sisih small">
          <span class="material-symbols-rounded">${FUND_ICONS[key]}</span>
        </div>
        <div class="dash-fund-info">
          <span>${FUND_INFO[key].label}</span>
          <strong>${formatRupiah(balance)}</strong>
          ${target > 0
            ? `<div class="mini-bar ${balance >= target ? 'done' : ''}"><span style="width:${percent}%"></span></div>`
            : ''}
        </div>
      </button>
    `;
  }).join('');
}


// ===== 5. PENGELUARAN PER KATEGORI (bulan ini) =====
function renderDashCategories() {
  const month = getMonthRange(0);
  const byCategory = {};

  appData.transactions.forEach(function (tx) {
    if (tx.date < month.start || tx.date > month.end) return;
    if (getTransactionKind(tx) !== 'keluar') return;
    byCategory[tx.categoryId] = (byCategory[tx.categoryId] || 0) + tx.amount;
  });

  const rows = Object.keys(byCategory)
    .map(function (id) {
      const category = findCategory(id);
      return { name: category ? category.name : 'Kategori terhapus', amount: byCategory[id] };
    })
    .sort(function (a, b) { return b.amount - a.amount; });

  // Maksimal 6 baris; sisanya digabung menjadi "Lainnya"
  let shown = rows;
  if (rows.length > 6) {
    const rest = rows.slice(5).reduce(function (sum, r) { return sum + r.amount; }, 0);
    shown = rows.slice(0, 5).concat([{ name: 'Lainnya (' + (rows.length - 5) + ' kategori)', amount: rest }]);
  }

  const total = rows.reduce(function (sum, r) { return sum + r.amount; }, 0);
  const max = shown.length ? shown[0].amount : 0;

  const body = shown.length === 0
    ? '<p class="empty-state">Belum ada pengeluaran bulan ini.</p>'
    : shown.map(function (r) {
        const width = max ? Math.max(2, Math.round((r.amount / max) * 100)) : 0;
        const share = total ? Math.round((r.amount / total) * 100) : 0;
        return `
          <div class="cat-bar-row" title="${escapeHtml(r.name)}: ${formatRupiah(r.amount)} (${share}%)">
            <div class="cat-bar-label">
              <span>${escapeHtml(r.name)}</span>
              <strong>${formatRupiah(r.amount)} <small>${share}%</small></strong>
            </div>
            <div class="cat-bar"><span style="width:${width}%"></span></div>
          </div>
        `;
      }).join('');

  dashCategories.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Pengeluaran per Kategori</h2>
      <span class="card-sub">${month.date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
    </div>
    <div class="cat-bars">${body}</div>
    ${total ? `<div class="cat-total">Total pengeluaran <strong>${formatRupiah(total)}</strong></div>` : ''}
  `;
}


// ===== 6. GRAFIK PEMASUKAN & PENGELUARAN (6 bulan) =====
function renderDashChart() {
  const months = [];
  for (let i = -5; i <= 0; i++) months.push(getMonthRange(i));

  const labels = months.map(function (m) {
    return m.date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
  });
  const masuk = [];
  const keluar = [];
  months.forEach(function (m) {
    const t = getTotalsBetween(m.start, m.end);
    masuk.push(t.masuk);
    keluar.push(t.keluar);
  });

  // Tabel sederhana (juga dipakai jika grafik tidak bisa dimuat)
  const tableRows = months.map(function (m, i) {
    return `<tr><td>${labels[i]}</td><td>${formatRupiah(masuk[i])}</td><td>${formatRupiah(keluar[i])}</td></tr>`;
  }).join('');

  dashChartCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Pemasukan & Pengeluaran</h2>
      <span class="card-sub">6 bulan terakhir</span>
    </div>
    <div class="chart-legend">
      <span><i class="legend-dot" style="background:#059669"></i>Pemasukan</span>
      <span><i class="legend-dot" style="background:#dc2626"></i>Pengeluaran</span>
    </div>
    <div class="chart-box"><canvas id="dash-chart-canvas" aria-label="Grafik pemasukan dan pengeluaran 6 bulan terakhir" role="img"></canvas></div>
    <details class="chart-table">
      <summary>Lihat sebagai tabel</summary>
      <table>
        <thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </details>
  `;

  // Chart.js dimuat dari internet; jika tidak tersedia, tabel tetap ada
  if (typeof Chart === 'undefined') {
    dashChartCard.querySelector('.chart-box').innerHTML =
      '<p class="empty-state">Grafik membutuhkan koneksi internet. Lihat tabel di bawah.</p>';
    return;
  }

  if (dashChart) dashChart.destroy();

  const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

  dashChart = new Chart(document.getElementById('dash-chart-canvas'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Pemasukan', data: masuk, backgroundColor: '#059669', borderRadius: 4, maxBarThickness: 18 },
        { label: 'Pengeluaran', data: keluar, backgroundColor: '#dc2626', borderRadius: 4, maxBarThickness: 18 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },   // legenda dibuat sendiri di atas grafik
        tooltip: {
          callbacks: {
            label: function (ctx) { return ctx.dataset.label + ': ' + formatRupiah(ctx.parsed.y); }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: chartTheme().tick, font: { family: 'Plus Jakarta Sans', size: 11 } }
        },
        y: {
          beginAtZero: true,
          border: { display: false },
          grid: { color: chartTheme().grid },
          ticks: {
            color: chartTheme().tick,
            font: { family: 'Plus Jakarta Sans', size: 11 },
            maxTicksLimit: 5,
            callback: function (value) { return 'Rp' + compact.format(value); }
          }
        }
      }
    }
  });
}


// ===== 7. TRANSAKSI TERBARU =====
function renderDashRecent() {
  const list = sortTransactionsNewest(appData.transactions).slice(0, 5);

  dashRecent.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Transaksi Terbaru</h2>
      <button type="button" class="link-btn" data-dash-go="riwayat">
        Lihat semua <span class="material-symbols-rounded">chevron_right</span>
      </button>
    </div>
    <div class="tx-list">
      ${list.length
        ? list.map(function (tx) { return historyItemHtml(tx, true); }).join('')
        : '<p class="empty-state">Belum ada transaksi.</p>'}
    </div>
  `;
}


// ===== TAMPILKAN SELURUH DASHBOARD =====
function renderDashboard() {
  renderDashHero();
  renderDashSafe();
  renderDashStats();
  renderDashFunds();
  renderDashCategories();
  renderDashChart();
  renderDashRecent();

  // Kartu analisis (dibuat di analisis.js)
  if (typeof renderDashAnalysis === 'function') renderDashAnalysis();

  // Catat Kilat, utang, dan rekap (dibuat di cepat.js, utang.js, rekap.js)
  if (typeof renderDashExtras === 'function') renderDashExtras();
}


// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById('page-dashboard').addEventListener('click', function (event) {
  // Tombol pindah halaman
  const go = event.target.closest('[data-dash-go]');
  if (go) {
    const target = go.dataset.dashGo;
    if (target === 'riwayat') {
      showPage('transaksi');
      switchTransactionTab('riwayat');
    } else {
      showPage(target);
      if (target === 'transaksi') switchTransactionTab('catat');
      if (target === 'tabungan') renderTabungan();
      if (target === 'bulanan') renderBulanan();
      if (target === 'utang') renderUtang();
    }
    return;
  }

  // Tombol edit / hapus pada transaksi terbaru
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'edit') {
      switchTransactionTab('catat');
      startEdit(action.dataset.id);
    }
    if (action.dataset.action === 'delete') {
      deleteTransaction(action.dataset.id);
      renderDashboard();
    }
    return;
  }

  // Klik baris transaksi → buka detail
  const item = event.target.closest('.tx-item[data-id]');
  if (item) openDetail(item.dataset.id);
});

// Setelah transaksi dihapus dari jendela detail, perbarui dashboard
detailDeleteButton.addEventListener('click', function () {
  setTimeout(renderDashboard, 0);
});

// Perbarui setiap kali menu Dashboard dibuka
document.querySelectorAll('[data-page="dashboard"]').forEach(function (btn) {
  btn.addEventListener('click', renderDashboard);
});


// ===== SAAT APLIKASI DIBUKA =====
renderDashboard();
