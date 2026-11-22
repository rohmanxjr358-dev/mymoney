// =====================================================
// LAPORAN.JS — Laporan harian, mingguan, bulanan, tahunan
//              + grafik + ekspor CSV / Excel / PDF
// =====================================================

const reportControls = document.getElementById('report-controls');
const reportSummary = document.getElementById('report-summary');
const reportInsights = document.getElementById('report-insights');
const reportTrendCard = document.getElementById('report-trend');
const reportCompareCard = document.getElementById('report-compare');
const reportTxCard = document.getElementById('report-transactions');

let reportType = 'bulanan';          // harian / mingguan / bulanan / tahunan
let reportAnchor = new Date();       // tanggal acuan periode yang dilihat
let reportTrendChart = null;
let reportCompareChart = null;

const REPORT_TYPES = [
  ['harian', 'Harian'],
  ['mingguan', 'Mingguan'],
  ['bulanan', 'Bulanan'],
  ['tahunan', 'Tahunan']
];


// ===== RENTANG TANGGAL SUATU PERIODE =====
function getReportRange(type, anchor) {
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());

  if (type === 'harian') {
    const s = dateToString(d);
    return {
      start: s, end: s,
      label: d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    };
  }

  if (type === 'mingguan') {
    const offset = (d.getDay() + 6) % 7;        // Senin = 0
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset);
    const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
    const start = dateToString(monday);
    const end = dateToString(sunday);
    return { start: start, end: end, label: formatRange(start, end) + ' ' + sunday.getFullYear() };
  }

  if (type === 'bulanan') {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      start: dateToString(first), end: dateToString(last),
      label: first.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
    };
  }

  // tahunan
  return { start: d.getFullYear() + '-01-01', end: d.getFullYear() + '-12-31', label: 'Tahun ' + d.getFullYear() };
}

// Geser tanggal acuan satu periode ke depan (+1) atau ke belakang (−1)
function shiftAnchor(type, anchor, step) {
  const d = new Date(anchor);
  if (type === 'harian') d.setDate(d.getDate() + step);
  if (type === 'mingguan') d.setDate(d.getDate() + 7 * step);
  if (type === 'bulanan') { d.setDate(1); d.setMonth(d.getMonth() + step); }
  if (type === 'tahunan') d.setFullYear(d.getFullYear() + step);
  return d;
}


// ===== MENGHITUNG ISI LAPORAN =====
function getReport(start, end) {
  const txs = appData.transactions.filter(function (tx) {
    return tx.date >= start && tx.date <= end;
  });

  const totals = { masuk: 0, keluar: 0, sisih: 0 };
  const byCategory = {};
  const expenses = [];

  txs.forEach(function (tx) {
    const kind = getTransactionKind(tx);
    totals[kind] += tx.amount;
    if (kind === 'keluar') {
      byCategory[tx.categoryId] = (byCategory[tx.categoryId] || 0) + tx.amount;
      expenses.push(tx);
    }
  });

  // Pemakaian dana (dari menu Tabungan)
  const fundUses = appData.fundMovements.filter(function (m) {
    return m.kind === 'pakai' && m.date >= start && m.date <= end;
  });
  const emergencyUsed = fundUses
    .filter(function (m) { return m.fund === 'darurat'; })
    .reduce(function (sum, m) { return sum + m.amount; }, 0);

  const categories = Object.keys(byCategory)
    .map(function (id) {
      const cat = findCategory(id);
      return { id: id, name: cat ? cat.name : 'Kategori terhapus', amount: byCategory[id] };
    })
    .sort(function (a, b) { return b.amount - a.amount; });

  const largest = expenses.slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 5);

  return {
    txs: sortTransactionsNewest(txs),
    totals: totals,
    emergencyUsed: emergencyUsed,
    fundUses: fundUses,
    categories: categories,
    largest: largest,
    net: totals.masuk - totals.keluar - totals.sisih
  };
}

// Perubahan persen dibanding periode sebelumnya
function percentChange(now, before) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 100);
}


// ===== 1. PILIHAN PERIODE & TOMBOL EKSPOR =====
function renderReportControls(range) {
  const chips = REPORT_TYPES.map(function (pair) {
    return `<button type="button" class="filter-chip ${reportType === pair[0] ? 'active' : ''}" data-report-type="${pair[0]}">${pair[1]}</button>`;
  }).join('');

  reportControls.innerHTML = `
    <div class="filter-chips report-types">${chips}</div>
    <div class="report-nav">
      <button type="button" class="icon-btn" data-report-step="-1" title="Sebelumnya">
        <span class="material-symbols-rounded">chevron_left</span>
      </button>
      <div class="report-label">${range.label}</div>
      <button type="button" class="icon-btn" data-report-step="1" title="Berikutnya">
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
      <button type="button" class="link-btn" data-report-step="0">Sekarang</button>
    </div>
    <div class="button-row report-export">
      <button type="button" class="btn btn-secondary btn-sm" data-export="csv">
        <span class="material-symbols-rounded">description</span> CSV
      </button>
      <button type="button" class="btn btn-secondary btn-sm" data-export="xlsx">
        <span class="material-symbols-rounded">table_view</span> Excel
      </button>
      <button type="button" class="btn btn-secondary btn-sm" data-export="pdf">
        <span class="material-symbols-rounded">picture_as_pdf</span> PDF
      </button>
    </div>
  `;
}


// ===== 2. RINGKASAN ANGKA =====
function renderReportSummary(report, range) {
  reportSummary.innerHTML = `
    <div class="print-title">Laporan Keuangan MyMoney — ${range.label}</div>
    <div class="dash-stats report-stats">
      <div class="stat">
        <span>Total pemasukan</span>
        <strong class="text-success">+${formatRupiah(report.totals.masuk)}</strong>
      </div>
      <div class="stat">
        <span>Total pengeluaran</span>
        <strong class="text-danger">−${formatRupiah(report.totals.keluar)}</strong>
        <small>Tidak termasuk yang disisihkan</small>
      </div>
      <div class="stat">
        <span>Total tabungan</span>
        <strong>${formatRupiah(report.totals.sisih)}</strong>
        <small>Uang yang disisihkan</small>
      </div>
      <div class="stat">
        <span>Penggunaan dana darurat</span>
        <strong>${formatRupiah(report.emergencyUsed)}</strong>
        <small>${report.fundUses.filter(function (m) { return m.fund === 'darurat'; }).length} kali dipakai</small>
      </div>
    </div>
    <div class="report-net">
      Selisih (pemasukan − pengeluaran − disisihkan)
      <strong class="${report.net < 0 ? 'text-danger' : 'text-success'}">${signedRupiah(report.net)}</strong>
    </div>
  `;
}


// ===== 3. PENGELUARAN TERBESAR, KATEGORI, PERBANDINGAN =====
function renderReportInsights(report, range) {
  // Perbandingan dengan periode sebelumnya
  const prevRange = getReportRange(reportType, shiftAnchor(reportType, reportAnchor, -1));
  const prev = getReport(prevRange.start, prevRange.end);
  const change = percentChange(report.totals.keluar, prev.totals.keluar);
  const periodWord = { harian: 'hari', mingguan: 'pekan', bulanan: 'bulan', tahunan: 'tahun' }[reportType];

  let compareText;
  if (report.totals.keluar === 0 && prev.totals.keluar === 0) {
    compareText = 'Belum ada pengeluaran di periode ini maupun ' + periodWord + ' sebelumnya.';
  } else if (change === null) {
    compareText = `Tidak ada pengeluaran tercatat pada ${periodWord} sebelumnya (${prevRange.label}).`;
  } else if (change === 0) {
    compareText = `Pengeluaran sama dengan ${periodWord} sebelumnya (${formatRupiah(prev.totals.keluar)}).`;
  } else {
    compareText = `Pengeluaran <strong>${Math.abs(change)}% ${change > 0 ? 'lebih besar' : 'lebih kecil'}</strong> dibanding ${periodWord} sebelumnya (${prevRange.label}: ${formatRupiah(prev.totals.keluar)}).`;
  }

  // Kategori
  const max = report.categories.length ? report.categories[0].amount : 0;
  const categoryRows = report.categories.length === 0
    ? '<p class="empty-state">Belum ada pengeluaran.</p>'
    : report.categories.map(function (c) {
        const width = max ? Math.max(2, Math.round((c.amount / max) * 100)) : 0;
        const share = report.totals.keluar ? Math.round((c.amount / report.totals.keluar) * 100) : 0;
        return `
          <div class="cat-bar-row">
            <div class="cat-bar-label">
              <span>${escapeHtml(c.name)}</span>
              <strong>${formatRupiah(c.amount)} <small>${share}%</small></strong>
            </div>
            <div class="cat-bar"><span style="width:${width}%"></span></div>
          </div>
        `;
      }).join('');

  // Pengeluaran terbesar
  const largestRows = report.largest.length === 0
    ? '<p class="empty-state">Belum ada pengeluaran.</p>'
    : report.largest.map(function (tx, i) {
        const cat = findCategory(tx.categoryId);
        return `
          <div class="rank-row">
            <span class="rank-no">${i + 1}</span>
            <div class="rank-info">
              <strong>${escapeHtml(cat ? cat.name : 'Kategori terhapus')}</strong>
              <small>${formatShortDate(tx.date)}${tx.note ? ' · ' + escapeHtml(tx.note) : ''}</small>
            </div>
            <span class="rank-amount">${formatRupiah(tx.amount)}</span>
          </div>
        `;
      }).join('');

  const top = report.categories[0];

  reportInsights.innerHTML = `
    <div class="card">
      <h2 class="card-title">Sorotan</h2>
      <div class="highlight-list">
        <div class="highlight">
          <span class="material-symbols-rounded">trending_up</span>
          <div>${compareText}</div>
        </div>
        <div class="highlight">
          <span class="material-symbols-rounded">category</span>
          <div>${top
            ? `Kategori paling banyak menghabiskan uang: <strong>${escapeHtml(top.name)}</strong> (${formatRupiah(top.amount)}, ${Math.round((top.amount / report.totals.keluar) * 100)}% dari pengeluaran).`
            : 'Belum ada kategori pengeluaran.'}</div>
        </div>
        <div class="highlight">
          <span class="material-symbols-rounded">receipt_long</span>
          <div>${report.largest[0]
            ? `Pengeluaran terbesar: <strong>${formatRupiah(report.largest[0].amount)}</strong> untuk ${escapeHtml((findCategory(report.largest[0].categoryId) || { name: 'kategori terhapus' }).name)} pada ${formatShortDate(report.largest[0].date)}.`
            : 'Belum ada pengeluaran.'}</div>
        </div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="card">
        <h2 class="card-title">Pengeluaran Terbesar</h2>
        <div class="rank-list">${largestRows}</div>
      </div>
      <div class="card">
        <h2 class="card-title">Pengeluaran per Kategori</h2>
        <div class="cat-bars">${categoryRows}</div>
      </div>
    </div>
  `;
}


// ===== GRAFIK (dipakai bersama) =====
const compactNumber = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });

function chartOptions(stacked) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (ctx) { return ctx.dataset.label + ': ' + formatRupiah(ctx.parsed.y); }
        }
      }
    },
    scales: {
      x: {
        stacked: !!stacked,
        grid: { display: false },
        ticks: { color: chartTheme().tick, font: { family: 'Plus Jakarta Sans', size: 11 }, maxRotation: 0, autoSkip: true }
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartTheme().grid },
        ticks: {
          color: chartTheme().tick,
          font: { family: 'Plus Jakarta Sans', size: 11 },
          maxTicksLimit: 5,
          callback: function (v) { return 'Rp' + compactNumber.format(v); }
        }
      }
    }
  };
}

function chartUnavailable(card) {
  card.querySelector('.chart-box').innerHTML =
    '<p class="empty-state">Grafik membutuhkan koneksi internet.</p>';
}


// ===== 4. GRAFIK TREN DALAM PERIODE =====
function renderReportTrend(range) {
  if (reportTrendChart) { reportTrendChart.destroy(); reportTrendChart = null; }

  // Laporan harian tidak memakai grafik tren
  if (reportType === 'harian') {
    reportTrendCard.hidden = true;
    return;
  }
  reportTrendCard.hidden = false;

  const buckets = [];
  if (reportType === 'tahunan') {
    const year = Number(range.start.slice(0, 4));
    for (let m = 0; m < 12; m++) {
      const first = new Date(year, m, 1);
      buckets.push({
        label: first.toLocaleDateString('id-ID', { month: 'short' }),
        start: dateToString(first),
        end: dateToString(new Date(year, m + 1, 0))
      });
    }
  } else {
    let day = range.start;
    while (day <= range.end) {
      const d = new Date(day + 'T00:00:00');
      buckets.push({
        label: reportType === 'mingguan'
          ? d.toLocaleDateString('id-ID', { weekday: 'short' }) + ' ' + d.getDate()
          : String(d.getDate()),
        start: day,
        end: day
      });
      day = addDays(day, 1);
    }
  }

  const masuk = [];
  const keluar = [];
  buckets.forEach(function (b) {
    const t = getTotalsBetween(b.start, b.end);
    masuk.push(t.masuk);
    keluar.push(t.keluar);
  });

  reportTrendCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Tren Pemasukan & Pengeluaran</h2>
      <span class="card-sub">${reportType === 'tahunan' ? 'per bulan' : 'per hari'}</span>
    </div>
    <div class="chart-legend">
      <span><i class="legend-dot" style="background:#059669"></i>Pemasukan</span>
      <span><i class="legend-dot" style="background:#dc2626"></i>Pengeluaran</span>
    </div>
    <div class="chart-box"><canvas id="report-trend-canvas" role="img" aria-label="Grafik tren pemasukan dan pengeluaran"></canvas></div>
  `;

  if (typeof Chart === 'undefined') { chartUnavailable(reportTrendCard); return; }

  reportTrendChart = new Chart(document.getElementById('report-trend-canvas'), {
    type: 'bar',
    data: {
      labels: buckets.map(function (b) { return b.label; }),
      datasets: [
        { label: 'Pemasukan', data: masuk, backgroundColor: '#059669', borderRadius: 4, maxBarThickness: 16 },
        { label: 'Pengeluaran', data: keluar, backgroundColor: '#dc2626', borderRadius: 4, maxBarThickness: 16 }
      ]
    },
    options: chartOptions(false)
  });
}


// ===== 5. PERBANDINGAN PENGELUARAN ANTARBULAN =====
function renderReportCompare(range) {
  if (reportCompareChart) { reportCompareChart.destroy(); reportCompareChart = null; }

  // 6 bulan sampai bulan dari periode yang sedang dilihat
  const endDate = new Date(range.end + 'T00:00:00');
  const months = [];
  for (let i = -5; i <= 0; i++) {
    const first = new Date(endDate.getFullYear(), endDate.getMonth() + i, 1);
    months.push({
      label: first.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
      start: dateToString(first),
      end: dateToString(new Date(first.getFullYear(), first.getMonth() + 1, 0))
    });
  }
  const values = months.map(function (m) { return getTotalsBetween(m.start, m.end).keluar; });

  const last = values[values.length - 1];
  const before = values[values.length - 2];
  const change = percentChange(last, before);

  const tableRows = months.map(function (m, i) {
    return `<tr><td>${m.label}</td><td>${formatRupiah(values[i])}</td></tr>`;
  }).join('');

  reportCompareCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Perbandingan Pengeluaran Antarbulan</h2>
      <span class="card-sub">6 bulan</span>
    </div>
    <p class="card-text">
      ${change === null
        ? 'Belum ada pengeluaran bulan sebelumnya untuk dibandingkan.'
        : `${months[5].label}: ${formatRupiah(last)} — ${change === 0 ? 'sama dengan' : Math.abs(change) + '% ' + (change > 0 ? 'lebih besar dari' : 'lebih kecil dari')} ${months[4].label} (${formatRupiah(before)}).`}
    </p>
    <div class="chart-box"><canvas id="report-compare-canvas" role="img" aria-label="Grafik pengeluaran 6 bulan"></canvas></div>
    <details class="chart-table">
      <summary>Lihat sebagai tabel</summary>
      <table>
        <thead><tr><th>Bulan</th><th>Pengeluaran</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </details>
  `;

  if (typeof Chart === 'undefined') { chartUnavailable(reportCompareCard); return; }

  reportCompareChart = new Chart(document.getElementById('report-compare-canvas'), {
    type: 'bar',
    data: {
      labels: months.map(function (m) { return m.label; }),
      datasets: [{
        label: 'Pengeluaran',
        data: values,
        // Bulan terakhir ditonjolkan, bulan lainnya lebih pudar
        backgroundColor: values.map(function (v, i) { return i === values.length - 1 ? '#dc2626' : chartTheme().mutedRed; }),
        borderRadius: 4,
        maxBarThickness: 28
      }]
    },
    options: chartOptions(false)
  });
}


// ===== 6. DAFTAR TRANSAKSI DALAM PERIODE =====
function renderReportTransactions(report) {
  reportTxCard.innerHTML = `
    <details class="report-tx-details" ${report.txs.length <= 10 ? 'open' : ''}>
      <summary>
        <span class="card-title">Transaksi dalam periode ini</span>
        <span class="card-sub">${report.txs.length} transaksi</span>
      </summary>
      <div class="tx-list">
        ${report.txs.length
          ? report.txs.map(function (tx) { return historyItemHtml(tx, true); }).join('')
          : '<p class="empty-state">Tidak ada transaksi.</p>'}
      </div>
    </details>
  `;
}


// ===== TAMPILKAN SELURUH LAPORAN =====
function renderLaporan() {
  const range = getReportRange(reportType, reportAnchor);
  const report = getReport(range.start, range.end);

  renderReportControls(range);
  renderReportSummary(report, range);
  renderReportInsights(report, range);
  renderReportTrend(range);
  renderReportCompare(range);
  renderReportTransactions(report);

  // Kartu analisis (dibuat di analisis.js)
  if (typeof renderReportAnalysis === 'function') renderReportAnalysis();
}


// ===== EKSPOR =====
function reportRows(report) {
  return report.txs.map(function (tx) {
    const cat = findCategory(tx.categoryId);
    const kindLabel = { masuk: 'Pemasukan', keluar: 'Pengeluaran', sisih: 'Disisihkan' }[getTransactionKind(tx)];
    return {
      Tanggal: tx.date,
      Jam: tx.time,
      Jenis: kindLabel,
      Kategori: cat ? cat.name : 'Kategori terhapus',
      Grup: cat ? cat.group : '',
      Dompet: walletName(txWalletId(tx)),
      Nominal: tx.type === 'masuk' ? tx.amount : -tx.amount,
      Sumber: tx.source || '',
      Keterangan: tx.note || ''
    };
  });
}

function exportFileName(range, ext) {
  return 'laporan-mymoney-' + reportType + '-' + range.start + (range.start === range.end ? '' : '_' + range.end) + '.' + ext;
}

function downloadBlob(blob, filename) {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function () { URL.revokeObjectURL(link.href); }, 2000);
}

// --- CSV ---
function exportCsv() {
  const range = getReportRange(reportType, reportAnchor);
  const rows = reportRows(getReport(range.start, range.end));
  if (rows.length === 0) { showToast('Tidak ada transaksi untuk diekspor'); return; }

  const headers = Object.keys(rows[0]);
  const escape = function (value) {
    const text = String(value);
    return /[",;\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  const lines = [headers.join(',')].concat(rows.map(function (row) {
    return headers.map(function (h) { return escape(row[h]); }).join(',');
  }));

  // ﻿ = penanda agar Excel membaca huruf Indonesia dengan benar
  downloadBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), exportFileName(range, 'csv'));
  showToast('File CSV diunduh');
}

// --- Excel (pustaka SheetJS dimuat saat dibutuhkan) ---
function loadSheetJs() {
  return new Promise(function (resolve, reject) {
    if (window.XLSX) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function exportXlsx() {
  const range = getReportRange(reportType, reportAnchor);
  const report = getReport(range.start, range.end);

  showToast('Menyiapkan file Excel…');
  loadSheetJs().then(function () {
    const summary = [
      ['Laporan Keuangan MyMoney'],
      ['Periode', range.label],
      ['Dari', range.start],
      ['Sampai', range.end],
      [],
      ['Total pemasukan', report.totals.masuk],
      ['Total pengeluaran', report.totals.keluar],
      ['Total disisihkan (tabungan)', report.totals.sisih],
      ['Penggunaan dana darurat', report.emergencyUsed],
      ['Selisih', report.net],
      [],
      ['Pengeluaran per kategori', 'Nominal']
    ].concat(report.categories.map(function (c) { return [c.name, c.amount]; }));

    const book = XLSX.utils.book_new();
    const sheet1 = XLSX.utils.aoa_to_sheet(summary);
    sheet1['!cols'] = [{ wch: 32 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(book, sheet1, 'Ringkasan');

    const sheet2 = XLSX.utils.json_to_sheet(reportRows(report));
    sheet2['!cols'] = [{ wch: 12 }, { wch: 7 }, { wch: 13 }, { wch: 26 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(book, sheet2, 'Transaksi');

    XLSX.writeFile(book, exportFileName(range, 'xlsx'));
    showToast('File Excel diunduh');
  }).catch(function () {
    showToast('Gagal memuat pustaka Excel. Periksa koneksi internet, atau pakai CSV.');
  });
}

// --- PDF (lewat fitur cetak browser) ---
function exportPdf() {
  // Buka semua bagian yang terlipat agar ikut tercetak
  document.querySelectorAll('#page-laporan details').forEach(function (d) { d.open = true; });
  showToast('Pilih "Simpan sebagai PDF" di jendela cetak');
  setTimeout(function () { window.print(); }, 300);
}


// ===== MENGHUBUNGKAN TOMBOL =====
reportControls.addEventListener('click', function (event) {
  const typeBtn = event.target.closest('[data-report-type]');
  if (typeBtn) {
    reportType = typeBtn.dataset.reportType;
    renderLaporan();
    return;
  }

  const stepBtn = event.target.closest('[data-report-step]');
  if (stepBtn) {
    const step = Number(stepBtn.dataset.reportStep);
    reportAnchor = step === 0 ? new Date() : shiftAnchor(reportType, reportAnchor, step);
    renderLaporan();
    return;
  }

  const exportBtn = event.target.closest('[data-export]');
  if (exportBtn) {
    const kind = exportBtn.dataset.export;
    if (kind === 'csv') exportCsv();
    if (kind === 'xlsx') exportXlsx();
    if (kind === 'pdf') exportPdf();
  }
});

// Klik transaksi di daftar laporan → detail / edit / hapus
reportTxCard.addEventListener('click', function (event) {
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'edit') {
      switchTransactionTab('catat');
      startEdit(action.dataset.id);
    }
    if (action.dataset.action === 'delete') {
      deleteTransaction(action.dataset.id);
      renderLaporan();
    }
    return;
  }
  const item = event.target.closest('.tx-item[data-id]');
  if (item) openDetail(item.dataset.id);
});

// Perbarui setiap kali menu Laporan dibuka
document.querySelectorAll('[data-page="laporan"]').forEach(function (btn) {
  btn.addEventListener('click', renderLaporan);
});


// ===== SAAT APLIKASI DIBUKA =====
renderLaporan();
