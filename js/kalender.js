// =====================================================
// KALENDER.JS — Kalender pengeluaran (warna = besar pengeluaran)
// =====================================================

const calCard = document.getElementById('cal-card');
const calDayCard = document.getElementById('cal-day');
const calPatternCard = document.getElementById('cal-pattern');

const WEEKDAY_SHORT = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const WEEKDAY_LONG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();   // 0 = Januari
let calSelected = todayString();
let calSlide = '';                       // animasi saat buka / ganti bulan
let calBillDays = {};                    // tagihan per tanggal (bulan yang tampil)


// ===== DATA SATU BULAN (dipakai juga oleh Rekap) =====
// Mengembalikan angka per hari + ringkasan bulan itu.
function getMonthDays(year, month) {
  const total = new Date(year, month + 1, 0).getDate();
  const today = todayString();
  const days = [];

  for (let d = 1; d <= total; d++) {
    const date = dateToString(new Date(year, month, d));
    days.push({
      date: date, day: d,
      weekday: (new Date(year, month, d).getDay() + 6) % 7,   // 0 = Senin
      out: 0, in: 0, sisih: 0, count: 0,
      future: date > today
    });
  }

  const start = days[0].date;
  const end = days[days.length - 1].date;

  appData.transactions.forEach(function (tx) {
    if (tx.date < start || tx.date > end) return;
    const item = days[Number(tx.date.slice(8, 10)) - 1];
    const kind = getTransactionKind(tx);
    if (kind === 'keluar') item.out += tx.amount;
    if (kind === 'masuk') item.in += tx.amount;
    if (kind === 'sisih') item.sisih += tx.amount;
    item.count += 1;
  });

  // Ringkasan: hanya menghitung hari yang sudah lewat (termasuk hari ini)
  const elapsed = days.filter(function (d) { return !d.future; });
  const totalOut = days.reduce(function (s, d) { return s + d.out; }, 0);
  const spendDays = days.filter(function (d) { return d.out > 0; });
  const average = elapsed.length ? Math.round(totalOut / elapsed.length) : 0;
  const averageSpendDay = spendDays.length ? totalOut / spendDays.length : 0;
  const maxDay = spendDays.slice().sort(function (a, b) { return b.out - a.out; })[0] || null;
  const zeroDays = elapsed.filter(function (d) { return d.out === 0; }).length;
  const recordedDays = elapsed.filter(function (d) { return d.count > 0; }).length;

  // Hari hemat beruntun: mundur dari hari terakhir yang sudah lewat
  let streak = 0;
  if (average > 0) {
    for (let i = elapsed.length - 1; i >= 0; i--) {
      if (elapsed[i].out <= average) streak++;
      else break;
    }
  }

  // Rata-rata per hari dalam seminggu (Senin–Minggu)
  const weekday = [0, 1, 2, 3, 4, 5, 6].map(function (w) {
    const list = elapsed.filter(function (d) { return d.weekday === w; });
    const sum = list.reduce(function (s, d) { return s + d.out; }, 0);
    return { index: w, average: list.length ? Math.round(sum / list.length) : 0, count: list.length };
  });

  return {
    days: days, elapsed: elapsed.length, totalOut: totalOut, average: average,
    averageSpendDay: averageSpendDay, maxDay: maxDay, zeroDays: zeroDays,
    recordedDays: recordedDays, streak: streak, weekday: weekday
  };
}

// Tingkat warna 0–4, dibandingkan rata-rata hari yang ada pengeluarannya
function heatLevel(out, averageSpendDay) {
  if (!out) return 0;
  const r = out / (averageSpendDay || out);
  if (r < 0.5) return 1;
  if (r < 1) return 2;
  if (r < 1.75) return 3;
  return 4;
}

function monthTitle(year, month) {
  return new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}


// ===== 1. KALENDER =====
function renderCalendar() {
  const data = getMonthDays(calYear, calMonth);
  const today = todayString();
  const key = monthKey(calYear, calMonth);
  const isCurrentMonth = key === currentMonthKey();
  const isFutureMonth = key > currentMonthKey();

  // Tanggal jatuh tempo tagihan bulan ini
  const billDays = {};
  if (Array.isArray(appData.bills)) {
    getBillsForMonth(key).forEach(function (bill) {
      const status = getBillStatus(bill, key);
      (billDays[status.dueDate] = billDays[status.dueDate] || []).push({ bill: bill, status: status });
    });
  }

  // Kotak kosong sebelum tanggal 1 (minggu dimulai Senin)
  const blanks = Array(data.days[0].weekday).fill('<span class="cal-cell blank"></span>').join('');

  const cells = data.days.map(function (d, i) {
    const level = heatLevel(d.out, data.averageSpendDay);
    const bills = billDays[d.date];
    const billUnpaid = bills && bills.some(function (b) { return b.status.code !== 'lunas'; });
    const classes = [
      'cal-cell', 'heat-' + level,
      d.date === today ? 'today' : '',
      d.date === calSelected ? 'selected' : '',
      d.future ? 'future' : ''
    ].join(' ');
    const title = formatLongDate(d.date) + (d.out ? ': keluar ' + formatRupiah(d.out) : ': tanpa pengeluaran');

    return `
      <button type="button" class="${classes}" data-cal-date="${d.date}" title="${title}" style="--d:${i}">
        <span class="cal-num">${d.day}</span>
        <span class="cal-amt">${d.out ? compactRupiah(d.out) : (d.future ? '' : '·')}</span>
        <span class="cal-dots">
          ${d.in ? '<i class="dot in"></i>' : ''}
          ${bills ? `<i class="dot bill ${billUnpaid ? '' : 'paid'}"></i>` : ''}
        </span>
      </button>
    `;
  }).join('');

  // Angka ringkas di atas kalender
  const chips = isFutureMonth ? '' : `
    <div class="cal-stats">
      <div class="cal-stat"><span>Total keluar</span><strong>${formatRupiah(data.totalOut)}</strong></div>
      <div class="cal-stat"><span>Rata-rata/hari</span><strong>${formatRupiah(data.average)}</strong></div>
      <div class="cal-stat zero"><span>Tanpa pengeluaran</span><strong>${data.zeroDays} hari</strong></div>
      ${isCurrentMonth
        ? `<div class="cal-stat streak ${data.streak >= 3 ? 'hot' : ''}"><span>Hemat beruntun</span><strong>${data.streak >= 3 ? '🔥 ' : ''}${data.streak} hari</strong></div>`
        : `<div class="cal-stat"><span>Hari tercatat</span><strong>${data.recordedDays}/${data.elapsed}</strong></div>`}
    </div>
  `;

  calCard.innerHTML = `
    <div class="cal-head">
      <button type="button" class="icon-btn" data-cal-nav="-1" title="Bulan sebelumnya">
        <span class="material-symbols-rounded">chevron_left</span>
      </button>
      <h2 class="cal-title">${monthTitle(calYear, calMonth)}</h2>
      <button type="button" class="icon-btn" data-cal-nav="1" title="Bulan berikutnya">
        <span class="material-symbols-rounded">chevron_right</span>
      </button>
    </div>
    ${chips}
    <div class="cal-grid ${calSlide}">
      ${WEEKDAY_SHORT.map(function (w, i) { return `<span class="cal-weekday ${i >= 5 ? 'weekend' : ''}">${w}</span>`; }).join('')}
      ${blanks}${cells}
    </div>
    <div class="cal-legend">
      <span class="cal-scale">Hemat
        <i class="heat-0"></i><i class="heat-1"></i><i class="heat-2"></i><i class="heat-3"></i><i class="heat-4"></i>
        Boros</span>
      <span><i class="dot in"></i> Uang masuk</span>
      <span><i class="dot bill"></i> Tagihan</span>
    </div>
    ${!isCurrentMonth ? `<button type="button" class="link-btn cal-today" data-cal-today>
        <span class="material-symbols-rounded">today</span> Kembali ke bulan ini</button>` : ''}
  `;

  calSlide = '';
  calBillDays = billDays;
  renderCalendarDay();
  renderCalendarPattern(data, isFutureMonth);
}


// ===== 2. RINCIAN HARI YANG DIPILIH =====
function renderCalendarDay() {
  const inMonth = calSelected.slice(0, 7) === monthKey(calYear, calMonth);
  if (!inMonth) {
    calDayCard.hidden = true;
    return;
  }
  calDayCard.hidden = false;

  const list = sortTransactionsNewest(appData.transactions.filter(function (tx) {
    return tx.date === calSelected;
  }));

  const totals = { masuk: 0, keluar: 0, sisih: 0 };
  list.forEach(function (tx) { totals[getTransactionKind(tx)] += tx.amount; });

  const bills = calBillDays[calSelected] || [];
  const billsHtml = bills.map(function (b) {
    return `
      <div class="cal-bill">
        <span class="material-symbols-rounded">event</span>
        <span>Tagihan <strong>${escapeHtml(b.bill.name)}</strong> ${formatRupiah(b.bill.amount)}</span>
        <span class="status-badge ${b.status.cls}">${b.status.label}</span>
      </div>
    `;
  }).join('');

  const isFuture = calSelected > todayString();
  const emptyText = isFuture
    ? 'Hari ini belum tiba.'
    : 'Tidak ada pengeluaran di hari ini. Mantap! 💚';

  calDayCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">${formatLongDate(calSelected)}</h2>
      ${totals.keluar ? `<span class="cal-day-total">−${formatRupiah(totals.keluar)}</span>` : ''}
    </div>
    ${totals.masuk || totals.sisih ? `
      <p class="card-text">
        ${totals.masuk ? `Masuk <strong class="text-success">+${formatRupiah(totals.masuk)}</strong>` : ''}
        ${totals.masuk && totals.sisih ? ' · ' : ''}
        ${totals.sisih ? `Disisihkan <strong>${formatRupiah(totals.sisih)}</strong>` : ''}
      </p>` : ''}
    ${billsHtml}
    <div class="tx-list">
      ${list.length
        ? list.map(function (tx) { return historyItemHtml(tx, false); }).join('')
        : `<p class="empty-state">${emptyText}</p>`}
    </div>
  `;
}


// ===== 3. POLA HARIAN =====
function renderCalendarPattern(data, isFutureMonth) {
  const active = data.weekday.filter(function (w) { return w.count > 0; });
  if (isFutureMonth || !data.totalOut || !active.length) {
    calPatternCard.hidden = true;
    return;
  }
  calPatternCard.hidden = false;

  const max = Math.max.apply(null, data.weekday.map(function (w) { return w.average; }));
  const top = data.weekday.find(function (w) { return w.average === max; });
  const low = active.slice().sort(function (a, b) { return a.average - b.average; })[0];

  const bars = data.weekday.map(function (w) {
    const height = max ? Math.max(4, Math.round((w.average / max) * 100)) : 4;
    const isTop = w.index === top.index && max > 0;
    return `
      <div class="pattern-col ${isTop ? 'top' : ''}" title="${WEEKDAY_LONG[w.index]}: rata-rata ${formatRupiah(w.average)}">
        <span class="pattern-value">${isTop ? compactRupiah(w.average) : ''}</span>
        <div class="pattern-track"><span style="height:${w.count ? height : 0}%; --i:${w.index}"></span></div>
        <span class="pattern-label">${WEEKDAY_SHORT[w.index]}</span>
      </div>
    `;
  }).join('');

  let insight = `Kamu paling banyak keluar uang di hari <strong>${WEEKDAY_LONG[top.index]}</strong>
    (rata-rata ${formatRupiah(top.average)}).`;
  if (low && low.index !== top.index) {
    insight += ` Paling hemat di hari <strong>${WEEKDAY_LONG[low.index]}</strong> (${formatRupiah(low.average)}).`;
  }
  if (data.maxDay) {
    insight += ` Hari terbesar bulan ini: <strong>${formatShortDate(data.maxDay.date)}</strong> — ${formatRupiah(data.maxDay.out)}.`;
  }

  calPatternCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Pola Hari</h2>
      <span class="card-sub">Rata-rata pengeluaran per hari</span>
    </div>
    <div class="pattern-chart" role="img" aria-label="Rata-rata pengeluaran per hari dalam seminggu">${bars}</div>
    <p class="pattern-insight">${insight}</p>
    <details class="chart-table">
      <summary>Lihat sebagai tabel</summary>
      <table>
        <thead><tr><th>Hari</th><th>Rata-rata</th></tr></thead>
        <tbody>${data.weekday.map(function (w) {
          return `<tr><td>${WEEKDAY_LONG[w.index]}</td><td>${formatRupiah(w.average)}</td></tr>`;
        }).join('')}</tbody>
      </table>
    </details>
  `;
}

// Dipanggil setelah transaksi berubah dari tempat lain
function renderCalendarIfOpen() {
  const panel = document.getElementById('tab-kalender');
  if (panel && panel.classList.contains('active')) renderCalendar();
}


// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById('tab-kalender').addEventListener('click', function (event) {
  const nav = event.target.closest('[data-cal-nav]');
  if (nav) {
    const step = Number(nav.dataset.calNav);
    const d = new Date(calYear, calMonth + step, 1);
    calYear = d.getFullYear();
    calMonth = d.getMonth();
    calSlide = step > 0 ? 'slide-left' : 'slide-right';
    // Pilih tanggal 1 (atau hari ini jika kembali ke bulan ini)
    calSelected = monthKey(calYear, calMonth) === currentMonthKey()
      ? todayString()
      : dateToString(new Date(calYear, calMonth, 1));
    renderCalendar();
    return;
  }

  if (event.target.closest('[data-cal-today]')) {
    const now = new Date();
    calSlide = monthKey(calYear, calMonth) < currentMonthKey() ? 'slide-left' : 'slide-right';
    calYear = now.getFullYear();
    calMonth = now.getMonth();
    calSelected = todayString();
    renderCalendar();
    return;
  }

  const cell = event.target.closest('[data-cal-date]');
  if (cell) {
    calSelected = cell.dataset.calDate;
    calCard.querySelectorAll('.cal-cell.selected').forEach(function (c) { c.classList.remove('selected'); });
    cell.classList.add('selected');
    renderCalendarDay();
    if (window.innerWidth <= 768) calDayCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  // Edit / hapus / detail pada transaksi hari itu
  const action = event.target.closest('[data-action]');
  if (action) {
    if (action.dataset.action === 'edit') {
      switchTransactionTab('catat');
      startEdit(action.dataset.id);
    }
    if (action.dataset.action === 'delete') {
      deleteTransaction(action.dataset.id);
      renderCalendar();
    }
    return;
  }

  const item = event.target.closest('.tx-item[data-id]');
  if (item) openDetail(item.dataset.id);
});

// Geser kiri/kanan di HP untuk ganti bulan
let calTouchX = null;
calCard.addEventListener('touchstart', function (event) {
  calTouchX = event.touches[0].clientX;
}, { passive: true });

calCard.addEventListener('touchend', function (event) {
  if (calTouchX === null) return;
  const dx = event.changedTouches[0].clientX - calTouchX;
  calTouchX = null;
  if (Math.abs(dx) < 60) return;
  const button = calCard.querySelector('[data-cal-nav="' + (dx < 0 ? '1' : '-1') + '"]');
  if (button) button.click();
}, { passive: true });

document.querySelector('#tx-tabs [data-tab="kalender"]').addEventListener('click', function () {
  calSlide = 'enter';
  renderCalendar();
});

// Setelah transaksi dihapus dari jendela detail, perbarui kalender
detailDeleteButton.addEventListener('click', function () {
  setTimeout(renderCalendarIfOpen, 0);
});
