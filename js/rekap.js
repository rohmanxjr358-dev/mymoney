// =====================================================
// REKAP.JS — Rekap bulanan bergaya "story" (ketuk untuk lanjut)
// =====================================================
// Semua angka diambil dari transaksi yang tercatat saja.

if (!appData.settings.recapSeen) appData.settings.recapSeen = {};

let recapSlides = [];
let recapIndex = 0;
let recapKey = '';


// ===== MENGUMPULKAN DATA SATU BULAN =====
function buildRecapData(year, month) {
  const start = dateToString(new Date(year, month, 1));
  const end = dateToString(new Date(year, month + 1, 0));
  const totals = getTotalsBetween(start, end);
  const monthData = getMonthDays(year, month);

  const txs = appData.transactions.filter(function (tx) { return tx.date >= start && tx.date <= end; });

  // Pengeluaran per kategori
  const byCategory = {};
  txs.forEach(function (tx) {
    if (getTransactionKind(tx) !== 'keluar') return;
    byCategory[tx.categoryId] = (byCategory[tx.categoryId] || 0) + tx.amount;
  });
  const categories = Object.keys(byCategory).map(function (id) {
    const cat = findCategory(id);
    return { id: id, name: cat ? cat.name : 'Kategori terhapus', amount: byCategory[id] };
  }).sort(function (a, b) { return b.amount - a.amount; });

  // Tombol Catat Kilat paling sering dipakai
  const quickCount = {};
  txs.forEach(function (tx) { if (tx.quickId) quickCount[tx.quickId] = (quickCount[tx.quickId] || 0) + 1; });
  const quickTopId = Object.keys(quickCount).sort(function (a, b) { return quickCount[b] - quickCount[a]; })[0];
  const quickTop = quickTopId && findQuickTemplate(quickTopId)
    ? { template: findQuickTemplate(quickTopId), count: quickCount[quickTopId] }
    : null;

  // Bulan sebelumnya (untuk perbandingan)
  const prevStart = dateToString(new Date(year, month - 1, 1));
  const prevEnd = dateToString(new Date(year, month, 0));
  const prevTotals = getTotalsBetween(prevStart, prevEnd);
  const prevCount = appData.transactions.filter(function (tx) { return tx.date >= prevStart && tx.date <= prevEnd; }).length;

  return {
    key: monthKey(year, month),
    name: new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'long' }),
    title: monthTitle(year, month),
    isCurrent: monthKey(year, month) === currentMonthKey(),
    totals: totals, month: monthData, count: txs.length,
    categories: categories, quickTop: quickTop,
    prev: prevCount ? prevTotals : null,
    prevName: new Date(year, month - 1, 1).toLocaleDateString('id-ID', { month: 'long' })
  };
}

function monthHasTransactions(year, month) {
  const start = dateToString(new Date(year, month, 1));
  const end = dateToString(new Date(year, month + 1, 0));
  return appData.transactions.some(function (tx) { return tx.date >= start && tx.date <= end; });
}

function percentOf(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0;
}

// Angka yang "menghitung naik" saat slide muncul
function countHtml(value, prefix) {
  return `<span data-count="${Math.round(value)}" data-prefix="${prefix || ''}">${prefix || ''}${formatRupiah(value)}</span>`;
}


// ===== MENYUSUN SLIDE =====
function buildRecapSlides(r) {
  const slides = [];
  const t = r.totals;

  // 1. Sampul
  slides.push({
    theme: 'cover',
    html: `
      <div class="recap-emoji big">🎁</div>
      <p class="recap-kicker">MyMoney Rekap</p>
      <h2 class="recap-headline">${r.title}</h2>
      <p class="recap-sub">${r.isCurrent
        ? 'Rekap sementara — bulan ini belum selesai.'
        : 'Yuk lihat ke mana saja uangmu pergi bulan ini.'}</p>
      <p class="recap-hint">Ketuk untuk lanjut →</p>
    `
  });

  // 2. Arus uang
  const leftover = t.masuk - t.keluar - t.sisih;
  slides.push({
    theme: 'flow',
    html: `
      <p class="recap-kicker">Arus uangmu</p>
      <div class="recap-flow">
        <div class="recap-flow-row in"><span>Masuk</span><strong>${countHtml(t.masuk, '+')}</strong></div>
        <div class="recap-flow-row out"><span>Keluar</span><strong>${countHtml(t.keluar, '−')}</strong></div>
        <div class="recap-flow-row save"><span>Disisihkan</span><strong>${countHtml(t.sisih)}</strong></div>
      </div>
      <p class="recap-sub">${t.masuk === 0
        ? 'Tidak ada pemasukan tercatat di bulan ini.'
        : leftover >= 0
          ? `Masih tersisa <strong>${formatRupiah(leftover)}</strong> setelah pengeluaran dan tabungan.`
          : `Pengeluaran + tabungan melebihi pemasukan bulan ini <strong>${formatRupiah(-leftover)}</strong> — sebagian memakai sisa bulan sebelumnya.`}</p>
    `
  });

  // 3. Kategori juara
  if (r.categories.length) {
    const top = r.categories[0];
    const top3 = r.categories.slice(0, 3);
    const max = top3[0].amount;
    slides.push({
      theme: 'category',
      html: `
        <p class="recap-kicker">Juara pengeluaran</p>
        <div class="recap-emoji big spin">${categoryEmoji(top.id)}</div>
        <h2 class="recap-headline">${escapeHtml(top.name)}</h2>
        <p class="recap-sub">${countHtml(top.amount)} · ${percentOf(top.amount, t.keluar)}% dari semua pengeluaran</p>
        <div class="recap-bars">
          ${top3.map(function (c, i) {
            return `
              <div class="recap-bar-row" style="--i:${i}">
                <span>${categoryEmoji(c.id)} ${escapeHtml(c.name)}</span>
                <div class="recap-bar"><i style="width:${Math.max(6, percentOf(c.amount, max))}%"></i></div>
                <strong>${compactRupiah(c.amount)}</strong>
              </div>
            `;
          }).join('')}
        </div>
      `
    });
  }

  // 4. Hari-hari
  const m = r.month;
  if (m.totalOut) {
    const topDay = m.weekday.slice().sort(function (a, b) { return b.average - a.average; })[0];
    slides.push({
      theme: 'days',
      html: `
        <p class="recap-kicker">Peta pengeluaranmu</p>
        <div class="recap-mini-cal">
          ${Array(m.days[0].weekday).fill('<i class="blank"></i>').join('')}
          ${m.days.map(function (d, i) {
            return `<i class="h${heatLevel(d.out, m.averageSpendDay)} ${d.future ? 'future' : ''}" style="--d:${i}"></i>`;
          }).join('')}
        </div>
        <div class="recap-facts">
          ${m.maxDay ? `<p>📍 Hari paling boros: <strong>${formatShortDate(m.maxDay.date)}</strong> (${formatRupiah(m.maxDay.out)})</p>` : ''}
          <p>📆 Rata-rata paling boros di hari <strong>${WEEKDAY_LONG[topDay.index]}</strong></p>
          <p>💚 <strong>${m.zeroDays} hari</strong> tanpa pengeluaran sama sekali</p>
          ${m.unrecordedDays ? `<p>🫥 <strong>${m.unrecordedDays} hari</strong> belum dicatat — angka di atas bisa kurang dari kenyataan</p>` : ''}
        </div>
      `
    });
  }

  // 5. Kebiasaan mencatat
  slides.push({
    theme: 'habit',
    html: `
      <p class="recap-kicker">Kebiasaan mencatat</p>
      <div class="recap-ring" style="--p:${percentOf(m.recordedDays, m.elapsed || 1)}">
        <div><strong>${m.recordedDays}</strong><span>dari ${m.elapsed} hari</span></div>
      </div>
      <p class="recap-sub">Kamu membuat <strong>${r.count}</strong> catatan transaksi.</p>
      ${r.quickTop ? `<p class="recap-sub">⚡ Tombol kilat favorit: <strong>${escapeHtml(r.quickTop.template.emoji)} ${escapeHtml(r.quickTop.template.label)}</strong> — dipakai ${r.quickTop.count}×</p>` : ''}
    `
  });

  // 6. Dibanding bulan lalu
  if (r.prev && r.prev.keluar && !r.isCurrent) {
    const diff = t.keluar - r.prev.keluar;
    const pct = percentOf(Math.abs(diff), r.prev.keluar);
    slides.push({
      theme: diff <= 0 ? 'better' : 'worse',
      html: `
        <p class="recap-kicker">Dibanding ${r.prevName}</p>
        <div class="recap-emoji big">${diff <= 0 ? '📉' : '📈'}</div>
        <h2 class="recap-headline">${diff <= 0 ? 'Turun' : 'Naik'} ${pct}%</h2>
        <p class="recap-sub">Pengeluaran ${formatRupiah(r.prev.keluar)} → <strong>${formatRupiah(t.keluar)}</strong></p>
        <p class="recap-sub">${diff <= 0 ? 'Kamu lebih hemat dari bulan sebelumnya. Keren!' : 'Ada kenaikan. Coba cek kategori juara tadi.'}</p>
      `
    });
  }

  // 7. Gelar bulan ini (berdasarkan data)
  let badge = { emoji: '📒', name: 'Pencatat Setia', why: `Kamu mencatat keuangan di ${m.recordedDays} hari bulan ini.` };
  if (t.masuk > 0 && t.sisih / t.masuk >= 0.2) {
    badge = { emoji: '🏆', name: 'Sang Penabung', why: `Kamu menyisihkan ${percentOf(t.sisih, t.masuk)}% dari pemasukan.` };
  } else if (t.masuk > 0 && t.keluar > t.masuk) {
    badge = { emoji: '🔥', name: 'Pejuang Akhir Bulan', why: 'Pengeluaran melebihi pemasukan. Bulan depan kita rem bareng!' };
  } else if (t.masuk > 0 && t.keluar <= t.masuk * 0.7) {
    badge = { emoji: '💪', name: 'Pengelola Andal', why: `Pengeluaranmu hanya ${percentOf(t.keluar, t.masuk)}% dari pemasukan.` };
  } else if (m.zeroDays >= 5) {
    badge = { emoji: '👑', name: 'Raja Hari Nol Rupiah', why: `${m.zeroDays} hari tanpa pengeluaran sama sekali.` };
  }

  const topCat = r.categories[0];
  const tip = topCat && typeof SAVING_TIPS !== 'undefined' && SAVING_TIPS[topCat.id];

  slides.push({
    theme: 'finale',
    finale: true,
    html: `
      <p class="recap-kicker">Gelar ${r.name}-mu</p>
      <div class="recap-badge">
        <span class="recap-emoji big">${badge.emoji}</span>
        <h2 class="recap-headline">${badge.name}</h2>
        <p class="recap-sub">${badge.why}</p>
      </div>
      ${tip ? `<p class="recap-tip">💡 <strong>${escapeHtml(topCat.name)}:</strong> ${tip}</p>` : ''}
      <button type="button" class="recap-done" data-recap-close>Selesai</button>
    `
  });

  return slides;
}


// ===== TAMPILAN STORY =====
function ensureRecapShell() {
  let shell = document.getElementById('recap');
  if (shell) return shell;

  shell = document.createElement('div');
  shell.id = 'recap';
  shell.className = 'recap';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.innerHTML = `
    <div class="recap-stage">
      <div class="recap-progress"></div>
      <button type="button" class="recap-close" data-recap-close title="Tutup">
        <span class="material-symbols-rounded">close</span>
      </button>
      <div class="recap-slide"></div>
      <button type="button" class="recap-tap prev" data-recap-step="-1" aria-label="Sebelumnya"></button>
      <button type="button" class="recap-tap next" data-recap-step="1" aria-label="Berikutnya"></button>
    </div>
  `;
  document.body.appendChild(shell);

  shell.addEventListener('click', function (event) {
    if (event.target.closest('[data-recap-close]')) { closeRecap(); return; }
    const step = event.target.closest('[data-recap-step]');
    if (step) goRecap(recapIndex + Number(step.dataset.recapStep));
  });

  return shell;
}

function openRecap(year, month) {
  const data = buildRecapData(year, month);
  recapSlides = buildRecapSlides(data);
  recapKey = data.key;
  recapIndex = 0;

  const shell = ensureRecapShell();
  shell.querySelector('.recap-progress').innerHTML = recapSlides.map(function () {
    return '<span><i></i></span>';
  }).join('');

  document.body.classList.add('recap-open');
  shell.classList.add('open');
  goRecap(0);

  if (!data.isCurrent) {
    appData.settings.recapSeen[data.key] = true;
    saveData();
  }
}

function goRecap(index) {
  if (index < 0) index = 0;
  if (index >= recapSlides.length) { closeRecap(); return; }
  recapIndex = index;

  const shell = document.getElementById('recap');
  const slide = recapSlides[index];
  const box = shell.querySelector('.recap-slide');

  shell.querySelector('.recap-stage').className = 'recap-stage theme-' + slide.theme;
  box.innerHTML = slide.html;
  box.classList.remove('show');
  void box.offsetWidth;
  box.classList.add('show');

  // Tombol "lanjut" tidak menutupi tombol Selesai di slide terakhir
  shell.querySelector('.recap-tap.next').hidden = Boolean(slide.finale);

  shell.querySelectorAll('.recap-progress span').forEach(function (bar, i) {
    bar.classList.toggle('done', i < index);
    bar.classList.toggle('active', i === index);
  });

  runCountUps(box);
  if (slide.finale) setTimeout(burstConfetti, 250);
}

function runCountUps(root) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.querySelectorAll('[data-count]').forEach(function (el) {
    const target = Number(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    if (reduce || !target) return;
    const startTime = performance.now();
    const duration = 900;
    function frame(now) {
      const p = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + formatRupiah(Math.round(target * eased));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

function closeRecap() {
  const shell = document.getElementById('recap');
  if (shell) shell.classList.remove('open');
  document.body.classList.remove('recap-open');
  renderDashRecap();
  renderRecapList();
}


// ===== BANNER REKAP (tampil di slot pemberitahuan Dashboard, lihat kebiasaan.js) =====
// Hanya muncul untuk rekap bulan lalu yang BELUM dibuka. Rekap lain ada di Laporan → Rekap.
function recapBannerHtml() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = monthKey(prev.getFullYear(), prev.getMonth());
  if (appData.settings.recapSeen[prevKey] || !monthHasTransactions(prev.getFullYear(), prev.getMonth())) return '';

  return `
    <button type="button" class="recap-banner" data-recap-open="${prev.getFullYear()}-${prev.getMonth()}">
      <span class="recap-banner-gift">🎁</span>
      <span class="recap-banner-text">
        <strong>Rekap ${prev.toLocaleDateString('id-ID', { month: 'long' })} sudah siap!</strong>
        <small>Ketuk untuk melihat perjalanan uangmu</small>
      </span>
      <span class="material-symbols-rounded">arrow_forward</span>
    </button>
  `;
}

function renderDashRecap() {
  if (typeof renderDashNudge === 'function') renderDashNudge();
}

// ===== DAFTAR REKAP (Laporan → Rekap) =====
function renderRecapList() {
  const box = document.getElementById('recap-list');
  if (!box) return;

  const now = new Date();
  const months = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    if (!monthHasTransactions(d.getFullYear(), d.getMonth())) continue;
    const start = dateToString(d);
    const end = dateToString(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    months.push({ year: d.getFullYear(), month: d.getMonth(), totals: getTotalsBetween(start, end), current: i === 0,
      unseen: i > 0 && !appData.settings.recapSeen[monthKey(d.getFullYear(), d.getMonth())] });
  }

  box.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Rekap Bulanan</h2>
      <span class="card-sub">Cerita singkat tiap bulan</span>
    </div>
    ${months.length ? `<div class="recap-months">${months.map(function (m, i) {
      return `
        <button type="button" class="recap-month ${m.unseen ? 'unseen' : ''}" data-recap-open="${m.year}-${m.month}" style="--i:${i}">
          <span class="recap-month-emoji">${m.current ? '👀' : '🎁'}</span>
          <span class="recap-month-info">
            <strong>${monthTitle(m.year, m.month)}</strong>
            <small>${m.current ? 'Sementara · bulan berjalan' : 'Keluar ' + formatRupiah(m.totals.keluar)}</small>
          </span>
          ${m.unseen ? '<span class="recap-new">Baru</span>' : '<span class="material-symbols-rounded">play_circle</span>'}
        </button>
      `;
    }).join('')}</div>` : '<p class="empty-state">Belum ada transaksi untuk dibuat rekap.</p>'}
  `;
}

// Tombol pembuka rekap di mana pun (Dashboard atau Laporan)
document.addEventListener('click', function (event) {
  const button = event.target.closest('[data-recap-open]');
  if (!button) return;
  const parts = button.dataset.recapOpen.split('-');
  openRecap(Number(parts[0]), Number(parts[1]));
});

document.addEventListener('keydown', function (event) {
  const shell = document.getElementById('recap');
  if (!shell || !shell.classList.contains('open')) return;
  if (event.key === 'Escape') closeRecap();
  if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); goRecap(recapIndex + 1); }
  if (event.key === 'ArrowLeft') goRecap(recapIndex - 1);
});


// ===== BAGIAN TAMBAHAN DASHBOARD (dipanggil oleh renderDashboard) =====
function renderDashExtras() {
  if (typeof renderHeroStatus === 'function') renderHeroStatus();
  renderDashWallets();
  renderQuick('dash-quick');
  renderDashDebt();
  if (typeof renderDashHabit === 'function') renderDashHabit();
}

renderDashExtras();
