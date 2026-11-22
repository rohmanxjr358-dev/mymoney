// =====================================================
// ONBOARDING.JS — Pengaturan awal untuk pengguna baru (± 1 menit)
// =====================================================
// Hanya muncul jika aplikasi benar-benar baru (belum ada data apa pun).

const HABITS = [
  { key: 'motor',     emoji: '🏍️', label: 'Bensin motor',     cat: 'out-bensin',    amount: 20000, quick: 'Bensin' },
  { key: 'ojol',      emoji: '🛵', label: 'Ojol / angkot',    cat: 'out-ojol',      amount: 15000, quick: 'Ojol',
    newCat: { name: 'Ojol & Transportasi Umum', group: 'Transportasi' } },
  { key: 'parkir',    emoji: '🅿️', label: 'Parkir',           cat: 'out-parkir',    amount: 2000,  quick: 'Parkir',
    newCat: { name: 'Parkir', group: 'Transportasi' } },
  { key: 'kopi',      emoji: '☕', label: 'Kopi',             cat: 'out-kopi',      amount: 10000, quick: 'Kopi',
    newCat: { name: 'Kopi', group: 'Kebutuhan Sehari-hari' } },
  { key: 'jajan',     emoji: '🍢', label: 'Jajan',            cat: 'out-jajan',     amount: 10000, quick: 'Jajan' },
  { key: 'rokok',     emoji: '🚬', label: 'Rokok',            cat: 'out-rokok',     amount: 25000, quick: 'Rokok' },
  { key: 'nongkrong', emoji: '🧋', label: 'Nongkrong',        cat: 'out-nongkrong', amount: 25000, quick: 'Nongkrong' },
  { key: 'game',      emoji: '🎮', label: 'Game & top up',    cat: 'out-hiburan',   amount: 20000, quick: 'Game' },
  { key: 'laundry',   emoji: '🧺', label: 'Laundry',          cat: 'out-laundry',   amount: 15000, quick: 'Laundry' },
  { key: 'print',     emoji: '🖨️', label: 'Print & fotokopi', cat: 'out-print',     amount: 5000,  quick: 'Print' },
  { key: 'pulsa',     emoji: '📶', label: 'Pulsa & kuota',    cat: 'out-pulsa',     amount: 50000, quick: 'Kuota',
    newCat: { name: 'Pulsa & Kuota', group: 'Kebutuhan Pribadi' } },
  { key: 'langganan', emoji: '🎧', label: 'Langganan (Spotify, dll)', cat: 'out-langganan', amount: 25000, quick: 'Langganan',
    newCat: { name: 'Langganan Digital', group: 'Kebutuhan Pribadi' } }
];

const HOUSING = [
  { key: 'kos',       emoji: '🛏️', label: 'Kos',               sub: 'Bayar sewa kamar tiap bulan' },
  { key: 'kontrakan', emoji: '🏡', label: 'Kontrakan',         sub: 'Patungan iuran bulanan bareng' },
  { key: 'rumah',     emoji: '🏠', label: 'Rumah keluarga',    sub: 'Tidak bayar sewa' }
];

const INCOMES = [
  { key: 'ortu',      emoji: '💌', label: 'Kiriman orang tua' },
  { key: 'beasiswa',  emoji: '🎓', label: 'Beasiswa' },
  { key: 'sampingan', emoji: '💼', label: 'Kerja sampingan' }
];

// Data lama: tandai sudah melewati pengaturan awal
if (appData.settings.onboarded === undefined) {
  appData.settings.onboarded = Boolean(
    appData.transactions.length || appData.periods.length || appData.bills.length ||
    (appData.debts && appData.debts.length)
  );
  saveData();
}

const onboard = {
  step: 0,
  name: '',
  housing: '',
  housingAmount: '',
  housingDay: '',
  wallets: { tunai: '' },        // merek → saldo (teks)
  habits: ['jajan'],
  incomes: ['ortu'],
  transferDay: '',
  incomeWallet: 'tunai',
  received: false,
  receivedAmount: '',
  receivedDate: todayString()
};

const ONBOARD_STEPS = 7;   // 0 sambutan … 6 selesai
let onboardEl = null;


// ===== KERANGKA =====
function openOnboarding() {
  onboardEl = document.createElement('div');
  onboardEl.className = 'onboard';
  onboardEl.innerHTML = `
    <div class="onboard-blob a"></div><div class="onboard-blob b"></div><div class="onboard-blob c"></div>
    <div class="onboard-shell">
      <div class="onboard-dots"></div>
      <div class="onboard-body"></div>
      <div class="onboard-nav"></div>
    </div>
  `;
  document.body.appendChild(onboardEl);
  document.body.classList.add('onboarding-open');

  onboardEl.addEventListener('click', onOnboardClick);
  onboardEl.addEventListener('change', onOnboardInput);
  renderOnboardStep();
}

function renderOnboardStep() {
  const s = onboard.step;
  onboardEl.querySelector('.onboard-dots').innerHTML = s === 0 || s === ONBOARD_STEPS - 1 ? '' :
    Array.from({ length: ONBOARD_STEPS - 2 }, function (_, i) {
      return `<i class="${i + 1 < s ? 'done' : ''} ${i + 1 === s ? 'active' : ''}"></i>`;
    }).join('');

  const body = onboardEl.querySelector('.onboard-body');
  body.innerHTML = [stepWelcome, stepName, stepHousing, stepWallets, stepHabits, stepIncome, stepDone][s]();
  body.classList.remove('enter');
  void body.offsetWidth;
  body.classList.add('enter');

  const nav = onboardEl.querySelector('.onboard-nav');
  if (s === 0) {
    nav.innerHTML = `
      <button type="button" class="onboard-next big" data-ob="next">Mulai atur <span class="material-symbols-rounded">arrow_forward</span></button>
      <button type="button" class="onboard-link" data-ob="restore">Pindah HP? Pulihkan dari file backup</button>
      <button type="button" class="onboard-link muted" data-ob="skip">Lewati, atur sendiri nanti</button>
    `;
  } else if (s === ONBOARD_STEPS - 1) {
    nav.innerHTML = `<button type="button" class="onboard-next big" data-ob="finish">Masuk ke MyMoney <span class="material-symbols-rounded">rocket_launch</span></button>`;
  } else {
    nav.innerHTML = `
      <button type="button" class="onboard-back" data-ob="back"><span class="material-symbols-rounded">arrow_back</span></button>
      <button type="button" class="onboard-next" data-ob="next">${s === ONBOARD_STEPS - 2 ? 'Selesai' : 'Lanjut'}
        <span class="material-symbols-rounded">arrow_forward</span></button>
    `;
  }

  const focus = body.querySelector('[data-autofocus]');
  if (focus && window.innerWidth > 768) setTimeout(function () { focus.focus(); }, 300);
}


// ===== LANGKAH-LANGKAH =====
function stepWelcome() {
  return `
    <div class="onboard-hero">
      <div class="onboard-logo">M</div>
      <h1>Selamat datang di <span>MyMoney</span></h1>
      <p>Catat uang jajan, kiriman, tagihan, dan tabungan — semua tersimpan di HP-mu sendiri, tanpa akun.</p>
      <div class="onboard-perks">
        <span>⚡ Catat sekali ketuk</span><span>📅 Kalender boros</span><span>🤝 Patungan</span>
      </div>
      <small>Pengaturan awal hanya ±1 menit dan bisa diubah kapan saja.</small>
    </div>
  `;
}

function stepName() {
  return `
    <div class="onboard-q">
      <span class="onboard-emoji">👋</span>
      <h2>Panggilanmu siapa?</h2>
      <p>Biar sapaan di Dashboard terasa akrab.</p>
      <input type="text" class="onboard-input" id="ob-name" maxlength="20" placeholder="Contoh: Andi"
             value="${escapeHtml(onboard.name)}" data-autofocus autocomplete="given-name">
    </div>
  `;
}

function stepHousing() {
  const h = onboard.housing;
  const extra = h === 'kos' || h === 'kontrakan' ? `
    <div class="onboard-extra">
      <p>${h === 'kos' ? 'Sewa kos per bulan' : 'Iuran kontrakan per bulan'} <span>(boleh dikosongkan)</span></p>
      <div class="onboard-row">
        <div class="onboard-money"><span>Rp</span>
          <input type="number" id="ob-house-amount" inputmode="numeric" placeholder="0" value="${onboard.housingAmount}"></div>
        <div class="onboard-day"><span>Tgl</span>
          <input type="number" id="ob-house-day" inputmode="numeric" min="1" max="31" placeholder="1" value="${onboard.housingDay}"></div>
      </div>
      <small>Akan jadi pengingat tagihan bulanan otomatis.</small>
    </div>` : '';

  return `
    <div class="onboard-q">
      <span class="onboard-emoji">🏘️</span>
      <h2>Sekarang tinggal di mana?</h2>
      <div class="onboard-cards">
        ${HOUSING.map(function (x) {
          return `<button type="button" class="onboard-card ${h === x.key ? 'active' : ''}" data-ob-housing="${x.key}">
            <span>${x.emoji}</span><strong>${x.label}</strong><small>${x.sub}</small></button>`;
        }).join('')}
      </div>
      ${extra}
    </div>
  `;
}

function stepWallets() {
  const chosen = Object.keys(onboard.wallets);
  return `
    <div class="onboard-q">
      <span class="onboard-emoji">👛</span>
      <h2>Uangmu disimpan di mana saja?</h2>
      <p>Pilih semua yang kamu pakai, lalu isi saldonya sekarang.</p>
      <div class="onboard-brands">
        ${WALLET_BRAND_ORDER.filter(function (k) { return k !== 'bank' && k !== 'ewallet'; }).map(function (key) {
          return `<button type="button" class="onboard-brand ${chosen.includes(key) ? 'active' : ''}" data-ob-wallet="${key}" style="--wc:${WALLET_BRANDS[key].color}">
            ${walletBadgeHtml({ brand: key }, 'small')}<span>${WALLET_BRANDS[key].label}</span></button>`;
        }).join('')}
      </div>
      <div class="onboard-balances">
        ${chosen.map(function (key) {
          return `<label class="onboard-balance" style="--wc:${WALLET_BRANDS[key].color}">
            ${walletBadgeHtml({ brand: key }, 'tiny')}<span>${WALLET_BRANDS[key].label}</span>
            <div class="onboard-money small"><span>Rp</span>
              <input type="number" inputmode="numeric" data-ob-balance="${key}" placeholder="0" value="${onboard.wallets[key]}"></div>
          </label>`;
        }).join('')}
      </div>
    </div>
  `;
}

function stepHabits() {
  return `
    <div class="onboard-q">
      <span class="onboard-emoji">🧾</span>
      <h2>Pengeluaran yang sering kamu lakukan?</h2>
      <p>Pilihanmu jadi kategori & tombol <strong>⚡ Catat Kilat</strong>. Makan & minum sudah otomatis.</p>
      <div class="onboard-chips">
        ${HABITS.map(function (x) {
          return `<button type="button" class="onboard-chip ${onboard.habits.includes(x.key) ? 'active' : ''}" data-ob-habit="${x.key}">
            <span>${x.emoji}</span>${x.label}</button>`;
        }).join('')}
      </div>
    </div>
  `;
}

function stepIncome() {
  const ortu = onboard.incomes.includes('ortu');
  const walletKeys = Object.keys(onboard.wallets);
  if (!walletKeys.includes(onboard.incomeWallet)) onboard.incomeWallet = walletKeys[0];

  return `
    <div class="onboard-q">
      <span class="onboard-emoji">💰</span>
      <h2>Uangmu datang dari mana?</h2>
      <div class="onboard-chips">
        ${INCOMES.map(function (x) {
          return `<button type="button" class="onboard-chip ${onboard.incomes.includes(x.key) ? 'active' : ''}" data-ob-income="${x.key}">
            <span>${x.emoji}</span>${x.label}</button>`;
        }).join('')}
      </div>
      ${ortu ? `
        <div class="onboard-extra">
          <p>Kiriman biasanya tanggal berapa? <span>(boleh dikosongkan)</span></p>
          <div class="onboard-day wide"><span>Setiap tanggal</span>
            <input type="number" id="ob-transfer-day" inputmode="numeric" min="1" max="31" placeholder="5" value="${onboard.transferDay}"></div>
          <p>Masuk ke</p>
          <div class="onboard-pills">
            ${walletKeys.map(function (k) {
              return `<button type="button" class="onboard-pill ${onboard.incomeWallet === k ? 'active' : ''}" data-ob-income-wallet="${k}" style="--wc:${WALLET_BRANDS[k].color}">
                ${walletBadgeHtml({ brand: k }, 'tiny')} ${WALLET_BRANDS[k].label}</button>`;
            }).join('')}
          </div>
          <label class="onboard-toggle">
            <input type="checkbox" id="ob-received" ${onboard.received ? 'checked' : ''}>
            Kiriman bulan ini sudah masuk
          </label>
          ${onboard.received ? `
            <div class="onboard-row even">
              <div class="onboard-money"><span>Rp</span>
                <input type="number" id="ob-received-amount" inputmode="numeric" placeholder="Nominal" value="${onboard.receivedAmount}"></div>
              <input type="date" class="onboard-date" id="ob-received-date" value="${onboard.receivedDate}">
            </div>
            <small>Saldo yang kamu isi tadi dianggap sudah termasuk kiriman ini, jadi tidak dihitung dua kali.</small>
          ` : ''}
        </div>` : ''}
    </div>
  `;
}

function stepDone() {
  const habits = HABITS.filter(function (h) { return onboard.habits.includes(h.key); });
  const total = Object.keys(onboard.wallets).reduce(function (s, k) { return s + (Number(onboard.wallets[k]) || 0); }, 0);
  return `
    <div class="onboard-hero done">
      <div class="onboard-check"><span class="material-symbols-rounded">check</span></div>
      <h1>Siap${onboard.name ? ', ' + escapeHtml(onboard.name) : ''}! 🎉</h1>
      <div class="onboard-summary">
        <div><span>👛 Dompet</span><strong>${Object.keys(onboard.wallets).length} · ${formatRupiah(total)}</strong></div>
        <div><span>⚡ Tombol kilat</span><strong>${habits.length + 2} tombol</strong></div>
        ${onboard.housing ? `<div><span>🏘️ Tinggal</span><strong>${HOUSING.find(function (h) { return h.key === onboard.housing; }).label}</strong></div>` : ''}
      </div>
      <label class="onboard-pin">
        <input type="checkbox" id="ob-pin">
        <span><strong>🔒 Kunci dengan PIN</strong><small>Supaya aman kalau HP dipinjam teman. Bisa diatur nanti juga.</small></span>
      </label>
      <p>Tips: ketuk tombol <strong>➕</strong> di pojok kanan bawah untuk mencatat dari halaman mana pun.</p>
    </div>
  `;
}


// ===== MENYIMPAN ISIAN SEBELUM PINDAH LANGKAH =====
function readOnboardInputs() {
  const v = function (id) { const el = document.getElementById(id); return el ? el.value : null; };
  if (v('ob-name') !== null) onboard.name = v('ob-name').trim();
  if (v('ob-house-amount') !== null) onboard.housingAmount = v('ob-house-amount');
  if (v('ob-house-day') !== null) onboard.housingDay = v('ob-house-day');
  if (v('ob-transfer-day') !== null) onboard.transferDay = v('ob-transfer-day');
  if (v('ob-received-amount') !== null) onboard.receivedAmount = v('ob-received-amount');
  if (v('ob-received-date') !== null) onboard.receivedDate = v('ob-received-date') || todayString();
  onboardEl.querySelectorAll('[data-ob-balance]').forEach(function (input) {
    onboard.wallets[input.dataset.obBalance] = input.value;
  });
}

function validDay(text) {
  if (!text) return true;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= 31;
}

function onboardNext() {
  readOnboardInputs();
  const s = onboard.step;

  if (s === 2 && !onboard.housing) { showToast('Pilih salah satu dulu'); return; }
  if (s === 2 && !validDay(onboard.housingDay)) { showToast('Tanggal harus 1 sampai 31'); return; }
  if (s === 3 && !Object.keys(onboard.wallets).length) { showToast('Pilih minimal satu tempat'); return; }
  if (s === 5 && !validDay(onboard.transferDay)) { showToast('Tanggal harus 1 sampai 31'); return; }
  if (s === 5 && onboard.received && !(Number(onboard.receivedAmount) > 0)) { showToast('Isi nominal kiriman bulan ini'); return; }

  onboard.step = Math.min(ONBOARD_STEPS - 1, s + 1);
  renderOnboardStep();
  if (onboard.step === ONBOARD_STEPS - 1) burstConfetti();
}


// ===== TERAPKAN SEMUA PILIHAN =====
function addCategoryIfMissing(id, name, group) {
  if (!appData.categories.some(function (c) { return c.id === id; })) {
    appData.categories.push({ id: id, name: name, type: 'keluar', group: group, fund: null, isDefault: false });
  }
}

function applyOnboarding() {
  const s = appData.settings;
  const now = new Date().toISOString();
  s.name = onboard.name;
  s.housing = onboard.housing;

  // --- Tempat tinggal ---
  const iuran = appData.categories.find(function (c) { return c.id === 'out-iuran'; });
  const houseAmount = Math.round(Number(onboard.housingAmount) || 0);
  const houseDay = Number(onboard.housingDay) || 1;

  if (onboard.housing === 'kos') {
    addCategoryIfMissing('out-kos', 'Sewa Kos', 'Tempat Tinggal');
    if (iuran) iuran.name = 'Iuran Bulanan (listrik, air, Wi-Fi)';
  } else if (onboard.housing === 'rumah' && iuran) {
    iuran.name = 'Iuran Bulanan';
  }
  if (houseAmount > 0 && (onboard.housing === 'kos' || onboard.housing === 'kontrakan')) {
    appData.bills.push({
      id: generateId(),
      name: onboard.housing === 'kos' ? 'Sewa Kos' : 'Iuran Kontrakan',
      amount: houseAmount, dueDay: houseDay,
      categoryId: onboard.housing === 'kos' ? 'out-kos' : 'out-iuran',
      remindDays: 3, note: '', active: true, startMonth: currentMonthKey(), createdAt: now
    });
  }

  // --- Dompet ---
  const keys = Object.keys(onboard.wallets);
  appData.wallets = keys.map(function (key) {
    return {
      id: 'w-' + key, name: WALLET_BRANDS[key].label, brand: key,
      initial: Math.round(Number(onboard.wallets[key]) || 0), createdAt: now
    };
  });
  s.defaultWalletId = 'w-' + (keys.includes('tunai') ? 'tunai' : keys[0]);
  s.incomeWalletId = 'w-' + (keys.includes(onboard.incomeWallet) ? onboard.incomeWallet : keys[0]);

  // --- Kebiasaan → kategori & tombol kilat ---
  const chosen = HABITS.filter(function (h) { return onboard.habits.includes(h.key); });
  chosen.forEach(function (h) { if (h.newCat) addCategoryIfMissing(h.cat, h.newCat.name, h.newCat.group); });

  const remove = [];
  if (!onboard.habits.includes('rokok')) remove.push('out-rokok');
  if (!onboard.habits.includes('motor')) remove.push('out-bensin', 'out-kendaraan');
  appData.categories = appData.categories.filter(function (c) { return !remove.includes(c.id); });

  appData.quickTemplates = [
    { id: generateId(), emoji: '🍛', label: 'Makan', amount: 15000, categoryId: 'out-makan' },
    { id: generateId(), emoji: '🥤', label: 'Minum', amount: 5000, categoryId: 'out-minum' }
  ].concat(chosen.map(function (h) {
    return { id: generateId(), emoji: h.emoji, label: h.quick, amount: h.amount, categoryId: h.cat };
  })).slice(0, QUICK_MAX);

  // --- Sumber uang ---
  s.incomeSources = onboard.incomes.slice();
  if (onboard.incomes.includes('ortu')) {
    s.expectedTransferDay = onboard.transferDay ? Number(onboard.transferDay) : null;

    if (onboard.received && Number(onboard.receivedAmount) > 0) {
      const amount = Math.round(Number(onboard.receivedAmount));
      const received = onboard.receivedDate || todayString();
      const r = new Date(received + 'T00:00:00');
      const expected = s.expectedTransferDay ? makeDate(r.getFullYear(), r.getMonth(), s.expectedTransferDay) : received;
      let next = addOneMonth(expected);
      while (next <= received) next = addOneMonth(next);

      const period = {
        id: generateId(), transactionId: null, allocations: null, createdAt: now,
        amount: amount, expectedDate: expected, receivedDate: received, nextExpectedDate: next,
        carryOver: 0, note: ''
      };
      appData.periods.push(period);
      syncPeriodTransaction(period);
      findTransaction(period.transactionId).walletId = s.incomeWalletId;

      // Saldo yang diisi sudah termasuk kiriman ini → jangan dihitung dua kali
      const w = appData.wallets.find(function (x) { return x.id === s.incomeWalletId; });
      w.initial -= amount;
    }
  }

  s.onboarded = true;
  s.simpleDashboard = true;   // Dashboard terbuka bertahap (kebiasaan.js)
  s.lastSeenVersion = APP_VERSION;
  saveData();
}

function finishOnboarding() {
  const wantsPin = document.getElementById('ob-pin');
  if (wantsPin && wantsPin.checked) appData.settings.pinSetupPending = true;
  applyOnboarding();
  onboardEl.classList.add('leaving');
  setTimeout(function () { location.reload(); }, 450);
}

function skipOnboarding() {
  appData.settings.onboarded = true;
  appData.settings.simpleDashboard = true;
  appData.settings.lastSeenVersion = APP_VERSION;
  // Dompet bawaan untuk yang melewati: Tunai
  appData.wallets = [{ id: 'w-tunai', name: 'Tunai', brand: 'tunai', initial: 0, createdAt: new Date().toISOString() }];
  appData.settings.defaultWalletId = 'w-tunai';
  saveData();
  location.reload();
}


// ===== KLIK & KETIK =====
function onOnboardClick(event) {
  const t = event.target;
  const btn = t.closest('[data-ob]');
  if (btn) {
    const a = btn.dataset.ob;
    if (a === 'next') onboardNext();
    if (a === 'back') { readOnboardInputs(); onboard.step = Math.max(0, onboard.step - 1); renderOnboardStep(); }
    if (a === 'finish') finishOnboarding();
    if (a === 'skip') skipOnboarding();
    if (a === 'restore') { restoreFile.value = ''; restoreFile.click(); }
    return;
  }

  let b;
  if ((b = t.closest('[data-ob-housing]'))) {
    readOnboardInputs();
    onboard.housing = b.dataset.obHousing;
    renderOnboardStep();
    return;
  }
  if ((b = t.closest('[data-ob-wallet]'))) {
    readOnboardInputs();
    const key = b.dataset.obWallet;
    if (key in onboard.wallets) delete onboard.wallets[key];
    else onboard.wallets[key] = '';
    renderOnboardStep();
    const input = onboardEl.querySelector('[data-ob-balance="' + key + '"]');
    if (input && window.innerWidth > 768) input.focus();
    return;
  }
  if ((b = t.closest('[data-ob-habit]'))) {
    const key = b.dataset.obHabit;
    const i = onboard.habits.indexOf(key);
    if (i >= 0) onboard.habits.splice(i, 1); else onboard.habits.push(key);
    b.classList.toggle('active');
    return;
  }
  if ((b = t.closest('[data-ob-income]'))) {
    readOnboardInputs();
    const key = b.dataset.obIncome;
    const i = onboard.incomes.indexOf(key);
    if (i >= 0) onboard.incomes.splice(i, 1); else onboard.incomes.push(key);
    renderOnboardStep();
    return;
  }
  if ((b = t.closest('[data-ob-income-wallet]'))) {
    readOnboardInputs();
    onboard.incomeWallet = b.dataset.obIncomeWallet;
    renderOnboardStep();
  }
}

function onOnboardInput(event) {
  if (event.target.id === 'ob-received') {
    readOnboardInputs();
    onboard.received = event.target.checked;
    renderOnboardStep();
  }
}


// ===== SAAT APLIKASI DIBUKA =====
if (!appData.settings.onboarded) {
  openOnboarding();
}
