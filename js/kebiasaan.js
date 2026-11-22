// =====================================================
// KEBIASAAN.JS — Streak harian, pengingat mencatat,
//                dan Dashboard yang terbuka bertahap
// =====================================================

if (!Array.isArray(appData.settings.zeroDays)) appData.settings.zeroDays = [];   // hari "nggak keluar uang"
if (!Array.isArray(appData.settings.unlocked)) appData.settings.unlocked = [];   // bagian Dashboard yang sudah terbuka

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];


// ===== 1. STREAK =====
// Hari "aktif" = hari kamu membuka aplikasi dan mencatat sesuatu
// (transaksi, pindah uang, atau menandai hari tanpa pengeluaran).
function getActiveDays() {
  const days = {};
  const mark = function (iso) { if (iso) days[dateToString(new Date(iso))] = true; };
  appData.transactions.forEach(function (tx) { mark(tx.createdAt); });
  (appData.walletMoves || []).forEach(function (m) { mark(m.createdAt); });
  appData.settings.zeroDays.forEach(function (d) { days[d] = true; });
  return days;
}

function getStreak() {
  const days = getActiveDays();
  const today = todayString();
  const doneToday = Boolean(days[today]);

  // Streak tetap hidup jika kemarin aktif walau hari ini belum
  let cursor = new Date();
  if (!doneToday) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days[dateToString(cursor)]) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  // Rekor terpanjang
  const sorted = Object.keys(days).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  sorted.forEach(function (d) {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });

  return { current: current, best: Math.max(best, current), doneToday: doneToday };
}

// Rayakan saat mencapai 3, 7, 14, 30 … hari
function checkStreakMilestone() {
  const s = getStreak();
  if (!s.doneToday) return;
  const reached = STREAK_MILESTONES.filter(function (m) { return s.current >= m; }).pop();
  if (!reached || (appData.settings.streakCelebrated || 0) >= reached) return;

  appData.settings.streakCelebrated = reached;
  saveData();
  setTimeout(function () {
    burstConfetti();
    showToast('🔥 ' + reached + ' hari mencatat beruntun! Keren, lanjutkan!');
  }, 400);
}


// ===== 2. KARTU PENGINGAT (atas Dashboard) =====
function nudgeMessage() {
  const h = new Date().getHours();
  if (h < 10) return { emoji: '☀️', title: 'Pagi! Sudah sarapan?', text: 'Catat pengeluaran pertamamu hari ini.' };
  if (h < 15) return { emoji: '🍛', title: 'Makan siang apa tadi?', text: 'Catat sekarang biar nggak lupa nominalnya.' };
  if (h < 18) return { emoji: '🧋', title: 'Ada jajan sore ini?', text: 'Hari ini belum ada catatan sama sekali.' };
  return { emoji: '🌙', title: 'Sebelum tidur, catat dulu yuk', text: 'Hari ini belum ada catatan. Cuma butuh 5 detik.' };
}

function renderDashNudge() {
  const box = document.getElementById('dash-nudge');
  if (!box) return;
  const s = getStreak();

  // Urutan prioritas slot: kiriman masuk → rencana bulan ini → pengingat catat → rekap
  const priority = (typeof transferCardHtml === 'function' && transferCardHtml()) ||
                   (typeof planCardHtml === 'function' && planCardHtml()) ||
                   (typeof pinOfferHtml === 'function' && pinOfferHtml());
  if (priority) {
    box.innerHTML = priority;
    return;
  }

  // SATU slot pemberitahuan: pengingat mencatat dulu; jika sudah mencatat, banner rekap (jika ada)
  if (s.doneToday) {
    box.innerHTML = typeof recapBannerHtml === 'function' ? recapBannerHtml() : '';
    return;
  }

  const m = nudgeMessage();
  box.innerHTML = `
    <div class="nudge">
      <span class="nudge-emoji">${m.emoji}</span>
      <div class="nudge-text">
        <strong>${m.title}</strong>
        <small>${s.current > 0
          ? `🔥 Streak ${s.current} hari — catat hari ini supaya tidak putus!`
          : m.text}</small>
      </div>
      <div class="nudge-actions">
        <button type="button" class="btn btn-primary" data-nudge="catat">
          <span class="material-symbols-rounded">add</span> Catat
        </button>
        <button type="button" class="nudge-zero" data-nudge="zero">Hari ini nggak keluar uang ✅</button>
      </div>
    </div>
  `;
}

// Chip 🔥 di kartu saldo
function renderStreakChip() {
  const top = document.querySelector('#dash-hero .dash-hero-top');
  if (!top) return;
  const s = getStreak();
  const old = top.querySelector('.streak-chip');
  if (old) old.remove();
  if (!s.current) return;

  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'streak-chip' + (s.doneToday ? ' lit' : '');
  chip.dataset.streakInfo = '';
  chip.title = 'Streak mencatat';
  chip.innerHTML = `<span class="streak-fire">🔥</span><strong>${s.current}</strong>`;
  top.appendChild(chip);
}

function markZeroDay() {
  const today = todayString();
  if (!appData.settings.zeroDays.includes(today)) appData.settings.zeroDays.push(today);
  saveData();
  renderDashHabit();
  checkStreakMilestone();
  showToast('💚 Mantap, hari tanpa pengeluaran tercatat!');
}


// ===== 3. DASHBOARD TERBUKA BERTAHAP (khusus pengguna baru) =====
// Bagian Dashboard muncul setelah datanya ada, supaya awalnya tidak membingungkan.
function getDashboardLocks() {
  const txCount = appData.transactions.length;
  const outCount = appData.transactions.filter(function (tx) { return getTransactionKind(tx) === 'keluar'; }).length;
  const hasPeriod = appData.periods.length > 0;
  const hasFund = appData.fundMovements.length > 0 ||
    appData.transactions.some(function (tx) { return getTransactionKind(tx) === 'sisih'; }) ||
    Object.keys(appData.fundTargets || {}).some(function (k) { return appData.fundTargets[k] > 0; });

  return [
    { key: 'recent',   ids: ['dash-recent', 'dash-stats'], emoji: '🧾', label: 'Ringkasan & transaksi terbaru',
      done: txCount >= 1, progress: Math.min(1, txCount), need: 1, hint: 'Catat 1 transaksi' },
    { key: 'chart',    ids: ['dash-grid'], emoji: '📊', label: 'Grafik & kategori',
      done: outCount >= 3, progress: Math.min(3, outCount), need: 3, hint: 'Catat 3 pengeluaran' },
    { key: 'safe',     ids: ['dash-safe'], emoji: '🛡️', label: 'Jatah Aman & jatah harian',
      done: hasPeriod, progress: hasPeriod ? 1 : 0, need: 1, hint: 'Catat uang bulanan', go: 'bulanan' },
    { key: 'funds',    ids: ['dash-funds'], emoji: '🐷', label: 'Tabungan',
      done: hasFund, progress: hasFund ? 1 : 0, need: 1, hint: 'Sisihkan uang pertamamu', go: 'tabungan' }
  ];
}

function applyDashboardLevel() {
  const box = document.getElementById('dash-unlock');
  const simple = Boolean(appData.settings.simpleDashboard);
  const locks = getDashboardLocks();

  locks.forEach(function (lock) {
    lock.ids.forEach(function (id) {
      const el = id === 'dash-grid' ? document.querySelector('#page-dashboard .dash-grid') : document.getElementById(id);
      if (el) el.hidden = simple && !lock.done;
    });

    // Beri tahu sekali saat sebuah bagian baru terbuka
    if (simple && lock.done && !appData.settings.unlocked.includes(lock.key)) {
      appData.settings.unlocked.push(lock.key);
      saveData();
      if (document.getElementById('page-dashboard').classList.contains('active')) {
        setTimeout(function () { showToast('🔓 ' + lock.label + ' sekarang terbuka!'); }, 900);
      }
    }
  });

  if (!box) return;
  const locked = locks.filter(function (l) { return !l.done; });
  if (!simple || !locked.length) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    <div class="card unlock-card">
      <div class="card-header">
        <h2 class="card-title">🔓 Segera terbuka</h2>
        <span class="card-sub">${locks.length - locked.length}/${locks.length} terbuka</span>
      </div>
      <div class="unlock-list">
        ${locked.map(function (l) {
          const pct = Math.round((l.progress / l.need) * 100);
          return `
            <button type="button" class="unlock-row" ${l.go ? `data-dash-go="${l.go}"` : 'data-nudge="catat"'}>
              <span class="unlock-emoji">${l.emoji}</span>
              <span class="unlock-info">
                <strong>${l.label}</strong>
                <small>${l.hint}${l.need > 1 ? ` · ${l.progress}/${l.need}` : ''}</small>
                <span class="mini-bar"><span style="width:${pct}%"></span></span>
              </span>
              <span class="material-symbols-rounded">${l.go ? 'chevron_right' : 'add'}</span>
            </button>
          `;
        }).join('')}
      </div>
      <button type="button" class="link-btn unlock-all" data-unlock-all>Tampilkan semua bagian sekarang</button>
    </div>
  `;
}


// ===== DIPANGGIL OLEH renderDashboard (lewat renderDashExtras) =====
function renderDashHabit() {
  renderDashNudge();
  renderStreakChip();
  applyDashboardLevel();
}


// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById('page-dashboard').addEventListener('click', function (event) {
  const nudge = event.target.closest('[data-nudge]');
  if (nudge) {
    if (nudge.dataset.nudge === 'catat') openFab();
    if (nudge.dataset.nudge === 'zero') markZeroDay();
    return;
  }

  if (event.target.closest('[data-streak-info]')) {
    const s = getStreak();
    showToast(s.doneToday
      ? '🔥 ' + s.current + ' hari beruntun · rekor ' + s.best + ' hari'
      : '🔥 ' + s.current + ' hari — catat hari ini supaya tidak putus!');
    return;
  }

  if (event.target.closest('[data-unlock-all]')) {
    appData.settings.simpleDashboard = false;
    saveData();
    renderDashboard();
    showToast('Semua bagian Dashboard ditampilkan');
  }
});


// ===== SAAT APLIKASI DIBUKA =====
renderDashHabit();
