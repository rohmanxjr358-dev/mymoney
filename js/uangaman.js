// =====================================================
// UANGAMAN.JS — Uang aman sampai transfer berikutnya
// =====================================================
//
// Rumus:
//   Uang di dompet saat ini
//   − wajib bayar yang belum dibayar
//   − tagihan yang jatuh tempo sebelum transfer berikutnya (belum dibayar)
//   − uang yang direncanakan disisihkan tetapi belum dipindah ke tabungan
//   = uang yang BENAR-BENAR bisa dipakai
//
//   Jatah harian = uang yang bisa dipakai ÷ jumlah hari sampai transfer berikutnya
//
// Semua angka berasal dari data yang tercatat — tidak ada angka tebakan.


// ===== PENGELUARAN "HARIAN" =====
// Dipakai untuk jatah harian: sama seperti anggaran mingguan —
// tidak termasuk uang yang disisihkan, pembayaran tagihan,
// dan kategori wajib bayar.
function isDailySpending(tx, wajibCategoryIds) {
  if (tx.type !== 'keluar' || tx.billId) return false;
  const category = findCategory(tx.categoryId);
  if (category && category.fund) return false;
  return !wajibCategoryIds.includes(tx.categoryId);
}

function getDailySpending(period, fromDate, toDate) {
  const wajibIds = period ? getWajibCategoryIds(period) : [];
  return appData.transactions
    .filter(function (tx) {
      return tx.date >= fromDate && tx.date <= toDate && isDailySpending(tx, wajibIds);
    })
    .reduce(function (sum, tx) { return sum + tx.amount; }, 0);
}


// ===== KEBUTUHAN WAJIB YANG BELUM DIBAYAR =====
// Dari alokasi periode berjalan: nominal rencana − yang sudah dibayar.
function getUnpaidWajib(period) {
  if (!period || !period.allocations) return { total: 0, items: [] };

  const items = period.allocations.wajib
    .map(function (item) {
      const paid = getRealizedByCategory(period, item.categoryId);
      return { name: item.name, amount: Math.max(0, item.amount - paid) };
    })
    .filter(function (item) { return item.amount > 0; });

  return {
    total: items.reduce(function (sum, i) { return sum + i.amount; }, 0),
    items: items
  };
}


// ===== TAGIHAN YANG JATUH TEMPO SEBELUM TRANSFER BERIKUTNYA =====
// Tagihan yang kategorinya sudah masuk wajib bayar tidak dihitung lagi
// (supaya tidak terhitung dua kali).
function getUnpaidBillsUntil(endDate, period) {
  const wajibIds = period ? getWajibCategoryIds(period) : [];
  const now = new Date();
  const items = [];

  // Periksa bulan lalu, bulan ini, dan bulan depan
  [-1, 0, 1].forEach(function (offset) {
    const key = monthKey(now.getFullYear(), now.getMonth() + offset);
    getBillsForMonth(key).forEach(function (bill) {
      if (wajibIds.includes(bill.categoryId)) return;
      const status = getBillStatus(bill, key);
      if (status.payment) return;
      if (status.dueDate < endDate) {
        items.push({ name: bill.name, amount: bill.amount, dueDate: status.dueDate });
      }
    });
  });

  return {
    total: items.reduce(function (sum, i) { return sum + i.amount; }, 0),
    items: items
  };
}


// ===== RENCANA DISISIHKAN YANG BELUM DIPINDAH =====
function getPendingSavings(period) {
  if (!period || !period.allocations) return { total: 0, items: [] };

  const items = FUND_KEYS
    .map(function (key) {
      const planned = period.allocations.funds[key] || 0;
      const moved = getRealizedFund(period, key);
      return { name: FUND_INFO[key].label, amount: Math.max(0, planned - moved) };
    })
    .filter(function (item) { return item.amount > 0; });

  return {
    total: items.reduce(function (sum, i) { return sum + i.amount; }, 0),
    items: items
  };
}


// ===== PERHITUNGAN UTAMA =====
function getSafeMoney() {
  const today = todayString();
  const period = getCurrentPeriod();
  const wallet = getWalletBalance();

  // Tanpa uang bulanan, tidak ada tanggal transfer berikutnya
  if (!period) {
    return { ready: false, reason: 'no-period', wallet: wallet };
  }

  const nextDate = period.nextExpectedDate;
  const daysLeft = daysBetween(today, nextDate);   // hari ini s/d sehari sebelum transfer

  const wajib = getUnpaidWajib(period);
  const bills = getUnpaidBillsUntil(nextDate, period);
  const savings = getPendingSavings(period);

  const usable = wallet - wajib.total - bills.total - savings.total;

  // Jatah harian dihitung dari posisi AWAL hari ini
  // (pengeluaran hari ini dikembalikan dulu, supaya batasnya tidak bergeser sepanjang hari)
  const spentToday = getDailySpending(period, today, today);
  let dailyLimit = daysLeft > 0 ? Math.max(0, Math.floor((usable + spentToday) / daysLeft)) : 0;
  let limitSource = 'aman';

  // Jika anggaran pekan ini sudah diatur, jatah harian mengikuti sisa anggaran pekan
  // (diambil yang lebih kecil, supaya hanya ada SATU angka batas yang aman diikuti)
  const weekNow = getCurrentWeekStatus();
  if (daysLeft > 0 && weekNow && weekNow.week.available > 0) {
    const w = weekNow.week;
    const weekDaysLeft = Math.max(1, daysBetween(today, w.end) + 1);
    const weekDaily = Math.max(0, Math.floor((w.remaining + spentToday) / weekDaysLeft));
    if (weekDaily <= dailyLimit) {
      dailyLimit = weekDaily;
      limitSource = 'pekan';
    }
  }

  // Perkiraan: jika kebiasaan belanja sejauh ini berlanjut, apakah cukup?
  const daysElapsed = Math.max(1, daysBetween(period.receivedDate, today) + 1);
  const spentSoFar = getDailySpending(period, period.receivedDate, today);
  const averageDaily = Math.round(spentSoFar / daysElapsed);
  const remainingDays = Math.max(0, daysLeft - 1);   // hari setelah hari ini
  const projectedNeed = averageDaily * remainingDays;
  const projectedEnough = usable - projectedNeed >= 0;

  // ----- Peringatan -----
  const warnings = [];

  if (daysLeft <= 0) {
    warnings.push({
      level: 'late',
      text: 'Tanggal perkiraan transfer (' + formatShortDate(nextDate) + ') sudah lewat. ' +
            'Perbarui tanggalnya di menu Uang Bulanan agar perhitungan tepat.'
    });
  }
  if (usable < 0) {
    warnings.push({
      level: 'over',
      text: 'Uang di dompet tidak cukup untuk wajib bayar, tagihan, dan rencana tabungan. ' +
            'Kurang ' + formatRupiah(Math.abs(usable)) + '.'
    });
  }
  if (daysLeft > 0 && spentToday > dailyLimit) {
    warnings.push({
      level: 'over',
      text: 'Pengeluaran hari ini ' + formatRupiah(spentToday) +
            ' sudah melebihi jatah harian ' + formatRupiah(dailyLimit) + '.'
    });
  } else if (daysLeft > 0 && dailyLimit > 0 && spentToday >= dailyLimit * 0.8) {
    warnings.push({
      level: 'late',
      text: 'Pengeluaran hari ini sudah ' + Math.round((spentToday / dailyLimit) * 100) +
            '% dari jatah harian.'
    });
  }

  const weekInfo = getCurrentWeekStatus();
  if (weekInfo && weekInfo.week.available > 0) {
    const level = getBudgetLevel(weekInfo.week);
    if (level.cls === 'over') {
      warnings.push({
        level: 'over',
        text: 'Anggaran pekan ini terlampaui ' + formatRupiah(Math.abs(weekInfo.week.remaining)) + '.'
      });
    } else if (level.cls === 'late') {
      warnings.push({
        level: 'late',
        text: 'Anggaran pekan ini hampir habis (' + weekInfo.week.percent + '% terpakai).'
      });
    }
  }

  return {
    ready: true,
    period: period,
    wallet: wallet,
    wajib: wajib,
    bills: bills,
    savings: savings,
    usable: usable,
    nextDate: nextDate,
    daysLeft: daysLeft,
    dailyLimit: dailyLimit,
    limitSource: limitSource,
    spentToday: spentToday,
    averageDaily: averageDaily,
    projectedNeed: projectedNeed,
    projectedEnough: projectedEnough,
    warnings: warnings
  };
}
