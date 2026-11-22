// =====================================================
// ANALISIS.JS — Analisis keuangan & saran hemat
// Semua kalimat dibuat HANYA dari data yang tercatat.
// =====================================================

const dashAnalysis = document.getElementById('dash-analysis');
const reportAnalysis = document.getElementById('report-analysis');

// Saran hemat sederhana per kategori
const SAVING_TIPS = {
  'out-makan': 'Coba masak sendiri di kontrakan beberapa kali seminggu, atau bawa bekal ke kampus.',
  'out-minum': 'Bawa botol minum sendiri dari kontrakan agar tidak sering membeli minuman.',
  'out-bahan': 'Buat daftar belanja sebelum ke pasar atau minimarket, dan belanja untuk satu pekan sekaligus.',
  'out-jajan': 'Tetapkan batas jajan harian dan hindari jajan saat sedang tidak lapar.',
  'out-laundry': 'Cuci sendiri pakaian ringan agar biaya laundry berkurang.',
  'out-print': 'Cetak bolak-balik, atau baca materi dalam bentuk digital bila diizinkan dosen.',
  'out-bensin': 'Gabungkan beberapa keperluan dalam satu perjalanan, misalnya belanja sekalian pulang kuliah.',
  'out-pakaian': 'Tunda pembelian pakaian yang bukan kebutuhan; tunggu beberapa hari sebelum memutuskan.',
  'out-hiburan': 'Pilih hiburan yang gratis atau murah, dan hentikan langganan yang jarang dipakai.',
  'out-nongkrong': 'Batasi nongkrong menjadi beberapa kali sebulan, atau pilih tempat yang lebih hemat.',
  'out-rawat': 'Habiskan produk perawatan yang sudah ada sebelum membeli yang baru.',
  'out-rokok': 'Coba tetapkan batas pembelian per pekan dan kurangi sedikit demi sedikit — lebih hemat dan lebih baik untuk kesehatan.'
};
const DEFAULT_TIP = 'Tinjau kembali transaksi di kategori ini dan tetapkan batas pengeluaran bulanan.';

const LIFESTYLE_IDS = ['out-jajan', 'out-nongkrong', 'out-hiburan'];

const LEVEL_ORDER = { bad: 0, warn: 1, info: 2, good: 3 };
const LEVEL_ICON = { bad: 'error', warn: 'warning', info: 'insights', good: 'thumb_up' };


// ===== ALAT BANTU =====

// Total pengeluaran (tanpa yang disisihkan) per kategori dalam rentang tanggal
function spendingByCategory(start, end) {
  const result = {};
  appData.transactions.forEach(function (tx) {
    if (tx.date < start || tx.date > end) return;
    if (getTransactionKind(tx) !== 'keluar') return;
    result[tx.categoryId] = (result[tx.categoryId] || 0) + tx.amount;
  });
  return result;
}

function sumValues(obj) {
  return Object.keys(obj).reduce(function (sum, key) { return sum + obj[key]; }, 0);
}

function categoryName(id) {
  const cat = findCategory(id);
  return cat ? cat.name : 'Kategori terhapus';
}


// ===== ANALISIS SATU BULAN =====
// anchor: tanggal mana saja di bulan yang dianalisis
function analyzeMonth(anchor) {
  const now = new Date();
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  // Rentang bulan ini (bulan berjalan: sampai hari ini)
  const start = dateToString(new Date(year, month, 1));
  const end = isCurrent ? todayString() : dateToString(new Date(year, month + 1, 0));

  // Rentang pembanding di bulan sebelumnya (bulan berjalan: tanggal yang sama)
  const dayCount = now.getDate();
  const prevLastDay = new Date(year, month, 0).getDate();
  const prevStart = dateToString(new Date(year, month - 1, 1));
  const prevEnd = isCurrent
    ? dateToString(new Date(year, month - 1, Math.min(dayCount, prevLastDay)))
    : dateToString(new Date(year, month, 0));

  const monthName = new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const prevName = new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long' });
  const compareNote = isCurrent
    ? `periode yang sama bulan lalu (1–${Math.min(dayCount, prevLastDay)} ${prevName})`
    : `${prevName}`;

  const current = spendingByCategory(start, end);
  const previous = spendingByCategory(prevStart, prevEnd);
  const curTotal = sumValues(current);
  const prevTotal = sumValues(previous);
  const txCount = appData.transactions.filter(function (tx) { return tx.date >= start && tx.date <= end; }).length;

  const insights = [];
  function add(level, text, tip) { insights.push({ level: level, text: text, tip: tip || '' }); }

  if (txCount === 0) {
    add('info', `Belum ada transaksi di ${monthName}. Analisis akan muncul setelah ada transaksi yang dicatat.`);
    return { monthName: monthName, insights: insights };
  }

  // ----- A. Kondisi saat ini (hanya untuk bulan berjalan) -----
  if (isCurrent) {
    const safe = getSafeMoney();

    if (safe.ready) {
      if (safe.usable < 0) {
        add('bad',
          `Uang di dompet kurang ${formatRupiah(Math.abs(safe.usable))} untuk menutup wajib bayar, tagihan, dan rencana tabungan sampai ${formatShortDate(safe.nextDate)}.`,
          'Tunda pengeluaran yang tidak wajib, lalu tinjau ulang rencana bulan ini di menu Uang Bulanan.');
      }

      if (safe.daysLeft > 0 && safe.spentToday > safe.dailyLimit) {
        add('bad',
          `Pengeluaran hari ini ${formatRupiah(safe.spentToday)} sudah melebihi jatah harian ${formatRupiah(safe.dailyLimit)}.`,
          'Kurangi pengeluaran besok agar rata-ratanya kembali di bawah jatah harian.');
      }

      if (safe.averageDaily > 0 && safe.daysLeft > 0 && safe.usable >= 0) {
        if (safe.projectedEnough) {
          add('good',
            `Dengan rata-rata pengeluaran ${formatRupiah(safe.averageDaily)}/hari, uang diperkirakan cukup sampai transfer berikutnya (${formatShortDate(safe.nextDate)}).`);
        } else {
          add('warn',
            `Dengan rata-rata pengeluaran ${formatRupiah(safe.averageDaily)}/hari, uang diperkirakan kurang ${formatRupiah(safe.projectedNeed - safe.usable)} sebelum transfer berikutnya.`,
            `Usahakan pengeluaran harian maksimal ${formatRupiah(safe.dailyLimit)} sampai ${formatShortDate(safe.nextDate)}.`);
        }
      }

      if (safe.savings.total > 0 && safe.daysLeft <= 7) {
        add('info',
          `Rencana tabungan ${formatRupiah(safe.savings.total)} belum dipindahkan ke pos tabungan.`,
          'Pindahkan sekarang lewat menu Tabungan → Setor agar tidak ikut terpakai.');
      }
    }

    const weekInfo = getCurrentWeekStatus();
    if (weekInfo && weekInfo.week.available > 0) {
      const w = weekInfo.week;
      const daysLeft = daysBetween(todayString(), w.end) + 1;
      const level = getBudgetLevel(w);
      if (level.cls === 'over') {
        add('bad',
          `Anggaran Pekan ${w.index + 1} terlampaui ${formatRupiah(Math.abs(w.remaining))} (terpakai ${formatRupiah(w.spent)} dari ${formatRupiah(w.available)}).`,
          'Kelebihan ini akan mengurangi anggaran pekan berikutnya. Prioritaskan kebutuhan pokok saja.');
      } else if (level.cls === 'late') {
        add('warn',
          `Anggaran pekan ini hampir habis: ${w.percent}% terpakai, sisa ${formatRupiah(w.remaining)} untuk ${daysLeft} hari.`,
          `Batasi pengeluaran sekitar ${formatRupiah(Math.floor(w.remaining / daysLeft))} per hari sampai akhir pekan.`);
      }
    }

    getBillReminders()
      .filter(function (r) { return r.status.code === 'terlambat'; })
      .forEach(function (r) {
        add('bad',
          `Tagihan ${escapeHtml(r.bill.name)} (${formatRupiah(r.bill.amount)}) terlambat ${r.status.label.replace('Terlambat ', '')}.`,
          'Bayar lewat menu Tagihan agar tidak menumpuk dengan tagihan bulan berikutnya.');
      });
  }

  // ----- B. Kategori pengeluaran terbesar -----
  const ranked = Object.keys(current).sort(function (a, b) { return current[b] - current[a]; });
  if (ranked.length) {
    const topId = ranked[0];
    const share = Math.round((current[topId] / curTotal) * 100);
    add('info',
      `Pengeluaran terbesar ${monthName} adalah <strong>${escapeHtml(categoryName(topId))}</strong>: ${formatRupiah(current[topId])} (${share}% dari pengeluaran).`,
      share >= 35 ? (SAVING_TIPS[topId] || DEFAULT_TIP) : '');
  }

  // ----- C. Total pengeluaran dibanding bulan lalu -----
  if (prevTotal > 0) {
    const change = Math.round(((curTotal - prevTotal) / prevTotal) * 100);
    if (change >= 10) {
      add('warn',
        `Pengeluaran ${monthName} ${change}% lebih besar dibanding ${compareNote}: ${formatRupiah(prevTotal)} → ${formatRupiah(curTotal)}.`,
        'Periksa kategori yang naik untuk mengetahui penyebabnya.');
    } else if (change <= -10) {
      add('good',
        `Pengeluaran ${monthName} ${Math.abs(change)}% lebih kecil dibanding ${compareNote}: ${formatRupiah(prevTotal)} → ${formatRupiah(curTotal)}. Pertahankan!`);
    } else {
      add('info',
        `Pengeluaran ${monthName} relatif sama dengan ${compareNote} (${formatRupiah(prevTotal)} → ${formatRupiah(curTotal)}).`);
    }
  }

  // ----- D. Kategori yang naik (maksimal 3) -----
  Object.keys(current)
    .filter(function (id) {
      const before = previous[id] || 0;
      return before > 0 && current[id] - before >= 20000 && (current[id] - before) / before >= 0.25;
    })
    .sort(function (a, b) { return (current[b] - previous[b]) - (current[a] - previous[a]); })
    .slice(0, 3)
    .forEach(function (id) {
      const pct = Math.round(((current[id] - previous[id]) / previous[id]) * 100);
      add('warn',
        `Pengeluaran <strong>${escapeHtml(categoryName(id))}</strong> meningkat ${pct}% dibanding ${compareNote}: ${formatRupiah(previous[id])} → ${formatRupiah(current[id])}.`,
        SAVING_TIPS[id] || DEFAULT_TIP);
    });

  // ----- E. Kategori yang paling turun -----
  const dropped = Object.keys(previous)
    .filter(function (id) {
      const now = current[id] || 0;
      return previous[id] >= 20000 && (previous[id] - now) / previous[id] >= 0.25;
    })
    .sort(function (a, b) { return (previous[b] - (current[b] || 0)) - (previous[a] - (current[a] || 0)); })[0];
  if (dropped) {
    add('good',
      `Pengeluaran <strong>${escapeHtml(categoryName(dropped))}</strong> turun dibanding ${compareNote}: ${formatRupiah(previous[dropped])} → ${formatRupiah(current[dropped] || 0)}. Bagus!`);
  }

  // ----- F. Porsi jajan, nongkrong, hiburan -----
  const lifestyle = LIFESTYLE_IDS.reduce(function (sum, id) { return sum + (current[id] || 0); }, 0);
  if (curTotal >= 100000 && lifestyle / curTotal >= 0.3) {
    add('warn',
      `Jajan, nongkrong, dan hiburan mencapai ${Math.round((lifestyle / curTotal) * 100)}% dari pengeluaran ${monthName} (${formatRupiah(lifestyle)}).`,
      'Tentukan batas bulanan untuk ketiganya, lalu pantau lewat menu Laporan.');
  }

  // ----- G. Data masih sedikit -----
  if (txCount < 5) {
    add('info',
      `Data ${monthName} baru ${txCount} transaksi. Analisis akan lebih akurat jika semua pemasukan dan pengeluaran dicatat.`);
  }

  // Urutkan: buruk → perlu perhatian → info → baik
  insights.sort(function (a, b) { return LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]; });

  // Saran yang sama hanya ditampilkan sekali, pada poin yang paling atas
  const usedTips = [];
  insights.forEach(function (item) {
    if (!item.tip) return;
    if (usedTips.includes(item.tip)) item.tip = '';
    else usedTips.push(item.tip);
  });

  return { monthName: monthName, insights: insights };
}


// ===== TAMPILAN =====
function insightsHtml(insights) {
  return insights.map(function (item) {
    return `
      <div class="insight ${item.level}">
        <span class="material-symbols-rounded">${LEVEL_ICON[item.level]}</span>
        <div>
          <p>${item.text}</p>
          ${item.tip ? `<p class="insight-tip"><strong>Saran:</strong> ${item.tip}</p>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Kartu di Dashboard: 4 poin terpenting bulan ini
function renderDashAnalysis() {
  if (!dashAnalysis) return;
  const result = analyzeMonth(new Date());
  const shown = result.insights.slice(0, 4);
  const more = result.insights.length - shown.length;

  dashAnalysis.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Analisis & Saran</h2>
      <button type="button" class="link-btn" data-analysis-more>
        ${more > 0 ? 'Lihat ' + more + ' lainnya' : 'Lihat laporan'}
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
    </div>
    <div class="insight-list">${insightsHtml(shown)}</div>
  `;
}

// Kartu di Laporan: hanya untuk laporan bulanan, sesuai bulan yang dipilih
function renderReportAnalysis() {
  if (!reportAnalysis) return;

  if (reportType !== 'bulanan') {
    reportAnalysis.hidden = true;
    return;
  }
  reportAnalysis.hidden = false;

  const result = analyzeMonth(reportAnchor);
  reportAnalysis.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Analisis & Saran</h2>
      <span class="card-sub">${result.monthName}</span>
    </div>
    <div class="insight-list">${insightsHtml(result.insights)}</div>
    <p class="insight-note">Analisis dibuat hanya dari transaksi yang tercatat di aplikasi.</p>
  `;
}


// ===== MENGHUBUNGKAN TOMBOL =====
if (dashAnalysis) {
  dashAnalysis.addEventListener('click', function (event) {
    if (!event.target.closest('[data-analysis-more]')) return;
    reportType = 'bulanan';
    reportAnchor = new Date();
    showPage('laporan');
    renderLaporan();
  });
}


// ===== SAAT APLIKASI DIBUKA =====
renderDashAnalysis();
renderReportAnalysis();
