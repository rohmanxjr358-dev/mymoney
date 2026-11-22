// =====================================================
// RENCANA.JS — Persiapan bulanan yang (hampir) otomatis
// =====================================================
// 1. Kartu "Kiriman sudah masuk?" → sekali ketuk mencatat uang bulanan
// 2. Rencana bulan ini dibuat otomatis (wajib bayar, tabungan, jatah per pekan)
// 3. Status satu kalimat di kartu saldo: "Hari ini masih boleh pakai Rp…"

if (!appData.settings.planDismissed) appData.settings.planDismissed = {};


// ===== ALAT BANTU =====
function roundDown(value, step) {
  return Math.max(0, Math.floor(value / step) * step);
}

function latestPeriod() {
  return getSortedPeriods()[0] || null;
}

function expectsParentTransfer() {
  const sources = appData.settings.incomeSources;
  return !Array.isArray(sources) || sources.includes('ortu');
}


// ===== 1. RENCANA OTOMATIS =====
// Bulan berikutnya meniru rencana bulan sebelumnya. Jika belum pernah ada:
// wajib bayar diambil dari Tagihan, lalu 10% tabungan + 5% dana darurat + 5% investasi
// dari sisanya, dan sisanya dibagi rata ke setiap pekan sebagai jatah jajan.
function buildAutoPlan(period, previous) {
  let alloc;

  if (previous && previous.allocations) {
    alloc = {
      wajib: previous.allocations.wajib.map(function (item) {
        return { id: generateId(), name: item.name, categoryId: item.categoryId, amount: item.amount };
      }),
      funds: Object.assign({}, previous.allocations.funds)
    };
  } else {
    alloc = createDefaultAllocations();
    alloc.wajib.forEach(function (item) {
      const bill = appData.bills.find(function (b) { return b.active !== false && b.categoryId === item.categoryId; });
      if (bill) item.amount = bill.amount;
    });
    const wajibTotal = alloc.wajib.reduce(function (s, i) { return s + i.amount; }, 0);
    const rest = Math.max(0, getAvailableMoney(period) - wajibTotal);
    alloc.funds = {
      tabungan: roundDown(rest * 0.10, 10000),
      darurat: roundDown(rest * 0.05, 10000),
      investasi: roundDown(rest * 0.05, 10000)
    };
  }

  // Jangan sampai rencana melebihi uang yang ada
  if (getAllocationTotals(period, alloc).remaining < 0) {
    alloc.funds = { tabungan: 0, darurat: 0, investasi: 0 };
  }
  period.allocations = alloc;

  // Jatah per pekan: sebanding dengan jumlah hari di pekan itu
  const weeks = getPeriodWeeks(period);
  const pool = Math.max(0, getAllocationTotals(period).remaining);
  const totalDays = weeks.reduce(function (s, w) { return s + w.days; }, 0) || 1;
  let used = 0;
  period.weekBudgets = weeks.map(function (week, i) {
    if (i === weeks.length - 1) return pool - used;
    const value = roundDown(pool * week.days / totalDays, 1000);
    used += value;
    return value;
  });
  period.carryWeeks = true;
  period.autoPlan = true;
}

function planSummary(period) {
  const totals = getAllocationTotals(period);
  const weeks = (period.weekBudgets || []).filter(function (b) { return b > 0; });
  const perWeek = weeks.length ? Math.round(weeks.reduce(function (s, b) { return s + b; }, 0) / weeks.length) : 0;
  return { wajib: totals.wajib, sisih: totals.sisih, perWeek: perWeek, weeks: weeks.length };
}


// ===== 2. KIRIMAN SEKALI KETUK =====
function recordTransfer(amount) {
  const previous = latestPeriod();
  const today = todayString();
  const day = appData.settings.expectedTransferDay;
  const now = new Date();

  const expected = previous ? previous.nextExpectedDate
    : (day ? makeDate(now.getFullYear(), now.getMonth(), day) : today);
  let next = addOneMonth(expected);
  while (next <= today) next = addOneMonth(next);

  const period = {
    id: generateId(), transactionId: null, allocations: null, createdAt: now.toISOString(),
    amount: amount, expectedDate: expected, receivedDate: today, nextExpectedDate: next,
    carryOver: Math.max(0, getWalletBalance()), note: ''
  };
  appData.periods.push(period);
  syncPeriodTransaction(period);
  const tx = findTransaction(period.transactionId);
  if (tx) tx.walletId = getIncomeWalletId();

  buildAutoPlan(period, previous);
  appData.settings.planToReview = period.id;
  delete appData.settings.transferSnooze;
  saveData();

  burstConfetti();
  showToast('💌 Kiriman ' + formatRupiah(amount) + ' tercatat — rencana bulan ini sudah dibuat');
  renderDashboard();
}

// Kartu di slot pemberitahuan Dashboard (dipanggil kebiasaan.js)
function transferCardHtml() {
  if (!expectsParentTransfer()) return '';
  const today = todayString();
  if (appData.settings.transferSnooze === today) return '';

  const last = latestPeriod();
  // Muncul mulai 1 hari sebelum perkiraan tanggal kiriman (atau jika belum pernah dicatat)
  if (last && addDays(last.nextExpectedDate, -1) > today) return '';

  const month = new Date().toLocaleDateString('id-ID', { month: 'long' });
  const late = last && last.nextExpectedDate < today ? daysBetween(last.nextExpectedDate, today) : 0;

  return `
    <div class="transfer-card">
      <div class="transfer-head">
        <span class="transfer-emoji">💌</span>
        <div>
          <strong>Kiriman ${month} sudah masuk?</strong>
          <small>${last
            ? 'Perkiraan ' + formatShortDate(last.nextExpectedDate) + (late ? ' · lewat ' + late + ' hari' : '') + ' · terakhir ' + formatRupiah(last.amount)
            : 'Catat sekali ketuk, nanti jatah harianmu langsung dihitung.'}</small>
        </div>
      </div>
      <div class="transfer-actions">
        ${last ? `<button type="button" class="btn btn-primary" data-transfer="same">
          <span class="material-symbols-rounded">check</span> Sudah, ${formatRupiah(last.amount)}</button>` : ''}
        <button type="button" class="btn ${last ? 'btn-secondary' : 'btn-primary'}" data-transfer="other">
          ${last ? 'Jumlah lain' : '<span class="material-symbols-rounded">add</span> Catat kiriman'}</button>
        <button type="button" class="transfer-later" data-transfer="later">Belum</button>
      </div>
      <form class="transfer-other" data-transfer-form hidden>
        <div class="input-prefix"><span>Rp</span>
          <input type="number" id="transfer-amount" inputmode="numeric" min="1" step="1" placeholder="Nominal kiriman"></div>
        <button type="submit" class="btn btn-primary">Simpan</button>
      </form>
    </div>
  `;
}

// Kartu tinjau rencana (setelah dibuat otomatis) atau tawaran membuat rencana
function planCardHtml() {
  const period = getCurrentPeriod();
  if (!period) return '';

  const hasPlan = period.allocations || (period.weekBudgets || []).some(function (b) { return b > 0; });

  if (!hasPlan) {
    if (appData.settings.planDismissed[period.id]) return '';
    return `
      <div class="plan-card">
        <div class="transfer-head">
          <span class="transfer-emoji">📋</span>
          <div>
            <strong>Mau dibuatkan rencana bulan ini?</strong>
            <small>Wajib bayar, tabungan, dan jatah jajan per pekan dihitung otomatis. Bisa diubah kapan saja.</small>
          </div>
        </div>
        <div class="transfer-actions">
          <button type="button" class="btn btn-primary" data-plan="make">
            <span class="material-symbols-rounded">auto_awesome</span> Buatkan rencana</button>
          <button type="button" class="transfer-later" data-plan="dismiss">Nanti saja</button>
        </div>
      </div>
    `;
  }

  if (appData.settings.planToReview !== period.id) return '';
  const p = planSummary(period);
  return `
    <div class="plan-card">
      <div class="transfer-head">
        <span class="transfer-emoji">📋</span>
        <div>
          <strong>Rencana ${formatMonthYear(period.receivedDate)} sudah dibuat</strong>
          <small>${period.autoPlan ? 'Dibuat otomatis — cek sebentar, ubah jika perlu.' : ''}</small>
        </div>
      </div>
      <div class="plan-lines">
        <div><span>🏠 Wajib bayar</span><strong>${formatRupiah(p.wajib)}</strong></div>
        <div><span>🐷 Ditabung</span><strong>${formatRupiah(p.sisih)}</strong></div>
        <div><span>🍛 Jatah jajan / pekan</span><strong>±${formatRupiah(p.perWeek)}</strong></div>
      </div>
      <div class="transfer-actions">
        <button type="button" class="btn btn-primary" data-plan="ok">Oke 👍</button>
        <button type="button" class="btn btn-secondary" data-plan="edit">
          <span class="material-symbols-rounded">edit</span> Ubah rencana</button>
      </div>
    </div>
  `;
}


// ===== 3. STATUS SATU KALIMAT =====
function heroStatusText() {
  const safe = getSafeMoney();
  if (!safe.ready) {
    return expectsParentTransfer()
      ? '💌 Catat kiriman bulan ini, nanti jatah harianmu langsung kelihatan.'
      : '📝 Catat uang masuk & keluar, ringkasannya muncul di sini.';
  }

  // Sudah waktunya kiriman tapi belum dicatat → jatah lama sudah selesai
  if (safe.daysLeft <= 0) {
    return '💌 Hari ini jadwal kiriman. Kalau sudah masuk, catat di kartu bawah supaya jatah barumu dihitung.';
  }

  const left = safe.dailyLimit - safe.spentToday;
  let text;
  if (safe.usable < 0) {
    text = `⚠️ Uangmu <strong>kurang ${formatRupiah(-safe.usable)}</strong> untuk wajib bayar & tagihan.`;
  } else if (left > 0) {
    text = (safe.projectedEnough ? '👍 Aman. ' : '🙂 Masih aman, tapi rem sedikit. ') +
      `Hari ini masih boleh pakai <strong>${formatRupiah(left)}</strong>.`;
  } else {
    text = '✋ Jatah hari ini sudah habis' +
      (left < 0 ? ` (lebih <strong>${formatRupiah(-left)}</strong>)` : '') + '. Tahan dulu sampai besok ya.';
  }

  text += ` Kiriman berikutnya ${safe.daysLeft} hari lagi.`;
  return text;
}

function renderHeroStatus() {
  const hero = document.getElementById('dash-hero');
  if (!hero) return;
  let line = hero.querySelector('.hero-status');
  if (!line) {
    line = document.createElement('p');
    line.className = 'hero-status';
    hero.appendChild(line);
  }
  line.innerHTML = heroStatusText();
}


// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById('page-dashboard').addEventListener('click', function (event) {
  const t = event.target.closest('[data-transfer]');
  if (t) {
    const action = t.dataset.transfer;
    if (action === 'same') recordTransfer(latestPeriod().amount);
    if (action === 'later') {
      appData.settings.transferSnooze = todayString();
      saveData();
      renderDashboard();
      showToast('Oke, diingatkan lagi besok');
    }
    if (action === 'other') {
      const form = document.querySelector('[data-transfer-form]');
      form.hidden = false;
      document.getElementById('transfer-amount').focus();
    }
    return;
  }

  const p = event.target.closest('[data-plan]');
  if (!p) return;
  const period = getCurrentPeriod();
  const action = p.dataset.plan;

  if (action === 'make') {
    buildAutoPlan(period, getSortedPeriods().find(function (x) { return x.id !== period.id && x.allocations; }) || null);
    appData.settings.planToReview = period.id;
    saveData();
    renderDashboard();
    showToast('📋 Rencana bulan ini dibuat');
  }
  if (action === 'dismiss') {
    appData.settings.planDismissed[period.id] = true;
    saveData();
    renderDashboard();
  }
  if (action === 'ok') {
    delete appData.settings.planToReview;
    saveData();
    renderDashboard();
    showToast('Sip! Jatah harianmu mengikuti rencana ini');
  }
  if (action === 'edit') {
    delete appData.settings.planToReview;
    saveData();
    showPage('bulanan');
    renderBulanan();
    openAllocation(period.id);
  }
});

document.getElementById('page-dashboard').addEventListener('submit', function (event) {
  if (!event.target.matches('[data-transfer-form]')) return;
  event.preventDefault();
  const amount = Math.round(Number(document.getElementById('transfer-amount').value));
  if (!amount || amount <= 0) { showToast('Isi nominal kiriman'); return; }
  recordTransfer(amount);
});

// ===== SAAT APLIKASI DIBUKA =====
renderHeroStatus();
if (typeof renderDashNudge === 'function') renderDashNudge();
