// =====================================================
// PIN.JS — Kunci aplikasi dengan PIN 4 angka (opsional)
// =====================================================
// appData.settings.pin      = { salt, hash, recoverySalt, recoveryHash, timeout (menit), enabledAt }
// appData.settings.pinFails = { count, lockUntil }   → jeda setelah 5x salah
// PIN & kode pemulihan TIDAK disimpan aslinya, hanya hash (SHA-256 + salt).
// Catatan: ini kunci layar untuk mencegah orang lain mengintip, bukan enkripsi data.

const PIN_LENGTH = 4;
const PIN_MAX_TRIES = 5;
const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // tanpa huruf/angka yang mirip

let pinScreen = null;
let pinMode = null;      // 'unlock' | 'new' | 'confirm' | 'verify' | 'recover' | 'show-code'
let pinInput = '';
let pinFirst = '';       // PIN pertama saat membuat PIN baru
let pinAfterVerify = null;
let pinNewCode = '';
let pinHiddenAt = null;
let pinCountdown = null;


// ===== ALAT BANTU =====
function pinEnabled() {
  const p = appData.settings.pin;
  return Boolean(p && p.hash);
}

function randomString(length, alphabet) {
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, function (v) { return alphabet[v % alphabet.length]; }).join('');
}

async function hashText(salt, text) {
  const input = salt + ':' + text;
  if (window.crypto && crypto.subtle) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buffer), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
  }
  // Cadangan untuk alamat non-HTTPS (jarang): hash sederhana
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h * 33) ^ input.charCodeAt(i)) >>> 0;
  return 'x' + h.toString(16);
}

function normalizeCode(code) {
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^MM/, '');
}

function formatCode(raw) {
  return 'MM-' + raw.slice(0, 4) + '-' + raw.slice(4, 8);
}

function pinWaitSeconds() {
  const f = appData.settings.pinFails;
  if (!f || !f.lockUntil) return 0;
  return Math.max(0, Math.ceil((f.lockUntil - Date.now()) / 1000));
}


// ===== LAYAR PIN (satu komponen untuk semua mode) =====
function pinTexts() {
  return {
    unlock:  { title: 'Masukkan PIN', sub: 'MyMoney terkunci' },
    new:     { title: 'Buat PIN baru', sub: '4 angka yang mudah kamu ingat (jangan tanggal lahir)' },
    confirm: { title: 'Ulangi PIN', sub: 'Ketik sekali lagi untuk memastikan' },
    verify:  { title: 'Masukkan PIN saat ini', sub: 'Untuk mengubah pengaturan keamanan' }
  }[pinMode];
}

function openPinScreen(mode) {
  pinMode = mode;
  pinInput = '';
  if (!pinScreen) {
    pinScreen = document.createElement('div');
    pinScreen.className = 'pin-screen';
    pinScreen.setAttribute('role', 'dialog');
    pinScreen.setAttribute('aria-modal', 'true');
    document.body.appendChild(pinScreen);
    pinScreen.addEventListener('click', onPinClick);
    pinScreen.addEventListener('submit', onPinSubmit);
  }
  document.documentElement.classList.add('pin-open');
  renderPinScreen();
}

function closePinScreen() {
  if (pinScreen) { pinScreen.remove(); pinScreen = null; }
  clearInterval(pinCountdown);
  document.documentElement.classList.remove('pin-open', 'pin-locked');
  pinMode = null;
}

function keypadHtml(showForgot) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return `
    <div class="pin-keypad">
      ${keys.map(function (k) { return `<button type="button" class="pin-key" data-pin-key="${k}">${k}</button>`; }).join('')}
      ${showForgot
        ? '<button type="button" class="pin-key text" data-pin-action="forgot">Lupa PIN?</button>'
        : (pinMode === 'unlock' ? '<span></span>' : '<button type="button" class="pin-key text" data-pin-action="cancel">Batal</button>')}
      <button type="button" class="pin-key" data-pin-key="0">0</button>
      <button type="button" class="pin-key" data-pin-action="back" aria-label="Hapus">
        <span class="material-symbols-rounded">backspace</span>
      </button>
    </div>
  `;
}

function renderPinScreen() {
  if (!pinScreen) return;

  // Mode tampil kode pemulihan
  if (pinMode === 'show-code') {
    pinScreen.innerHTML = `
      <div class="pin-box wide">
        <div class="pin-logo">🔐</div>
        <h2>Simpan kode pemulihan</h2>
        <p class="pin-sub">Kode ini satu-satunya cara membuka MyMoney jika kamu lupa PIN. <strong>Screenshot atau catat sekarang</strong> — kode tidak akan ditampilkan lagi.</p>
        <div class="pin-code">${pinNewCode}</div>
        <button type="button" class="pin-link" data-pin-action="copy">
          <span class="material-symbols-rounded">content_copy</span> Salin kode</button>
        <label class="pin-check"><input type="checkbox" id="pin-saved"> Sudah saya simpan</label>
        <button type="button" class="pin-primary" data-pin-action="finish-setup">Selesai</button>
      </div>
    `;
    return;
  }

  // Mode memasukkan kode pemulihan
  if (pinMode === 'recover') {
    pinScreen.innerHTML = `
      <form class="pin-box wide" data-pin-recover>
        <div class="pin-logo">🗝️</div>
        <h2>Lupa PIN</h2>
        <p class="pin-sub">Masukkan kode pemulihan yang kamu simpan saat membuat PIN (contoh: MM-7K4Q-9XPA).</p>
        <input type="text" class="pin-code-input" id="pin-recover-code" autocomplete="off" autocapitalize="characters" placeholder="MM-XXXX-XXXX">
        <p class="pin-message" id="pin-message"></p>
        <button type="submit" class="pin-primary">Buka & buat PIN baru</button>
        <button type="button" class="pin-link" data-pin-action="back-to-unlock">Kembali</button>
      </form>
    `;
    return;
  }

  const t = pinTexts();
  const wait = pinMode === 'unlock' ? pinWaitSeconds() : 0;

  pinScreen.innerHTML = `
    <div class="pin-box">
      <div class="pin-logo">${pinMode === 'unlock' ? 'M' : '🔒'}</div>
      <h2>${t.title}</h2>
      <p class="pin-sub">${t.sub}</p>
      <div class="pin-dots" id="pin-dots">
        ${Array.from({ length: PIN_LENGTH }, function (_, i) { return `<i class="${i < pinInput.length ? 'on' : ''}"></i>`; }).join('')}
      </div>
      <p class="pin-message" id="pin-message">${wait ? 'Terlalu banyak salah. Coba lagi dalam <strong id="pin-wait">' + wait + '</strong> detik.' : ''}</p>
      ${keypadHtml(pinMode === 'unlock')}
    </div>
  `;
  pinScreen.classList.toggle('waiting', wait > 0);

  if (wait) {
    clearInterval(pinCountdown);
    pinCountdown = setInterval(function () {
      const left = pinWaitSeconds();
      const el = document.getElementById('pin-wait');
      if (el) el.textContent = left;
      if (!left) { clearInterval(pinCountdown); renderPinScreen(); }
    }, 1000);
  }
}

function updateDots(state) {
  const dots = document.getElementById('pin-dots');
  if (!dots) return;
  dots.querySelectorAll('i').forEach(function (dot, i) { dot.classList.toggle('on', i < pinInput.length); });
  dots.classList.remove('error', 'ok');
  if (state) {
    void dots.offsetWidth;
    dots.classList.add(state);
  }
}

function pinMessage(text) {
  const el = document.getElementById('pin-message');
  if (el) el.innerHTML = text;
}


// ===== SAAT 4 ANGKA LENGKAP =====
async function onPinComplete() {
  const entered = pinInput;
  const p = appData.settings.pin;

  if (pinMode === 'unlock' || pinMode === 'verify') {
    const ok = (await hashText(p.salt, entered)) === p.hash;
    if (ok) {
      appData.settings.pinFails = { count: 0, lockUntil: 0 };
      saveData();
      updateDots('ok');
      setTimeout(function () {
        if (pinMode === 'unlock') closePinScreen();
        else { const next = pinAfterVerify; pinAfterVerify = null; next(); }
      }, 180);
      return;
    }

    // Salah
    if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
    pinInput = '';
    updateDots('error');
    if (pinMode === 'unlock') {
      const f = appData.settings.pinFails || { count: 0, lockUntil: 0 };
      f.count += 1;
      if (f.count >= PIN_MAX_TRIES) {
        const seconds = Math.min(900, 30 * Math.pow(2, f.count - PIN_MAX_TRIES));
        f.lockUntil = Date.now() + seconds * 1000;
      }
      appData.settings.pinFails = f;
      saveData();
      if (f.lockUntil > Date.now()) { setTimeout(renderPinScreen, 400); return; }
      pinMessage('PIN salah. Sisa ' + (PIN_MAX_TRIES - f.count) + ' percobaan sebelum dijeda.');
    } else {
      pinMessage('PIN salah.');
    }
    return;
  }

  if (pinMode === 'new') {
    if (/^(\d)\1{3}$/.test(entered) || entered === '1234' || entered === '0123') {
      pinInput = '';
      updateDots('error');
      pinMessage('PIN terlalu mudah ditebak. Coba yang lain.');
      return;
    }
    pinFirst = entered;
    pinMode = 'confirm';
    pinInput = '';
    renderPinScreen();
    return;
  }

  if (pinMode === 'confirm') {
    if (entered !== pinFirst) {
      pinFirst = '';
      pinMode = 'new';
      pinInput = '';
      renderPinScreen();
      updateDots('error');
      pinMessage('PIN tidak sama. Ulangi dari awal ya.');
      return;
    }
    await savePin(pinFirst);
  }
}

// Menyimpan PIN baru (kode pemulihan dibuat baru jika belum ada)
async function savePin(pin) {
  const old = appData.settings.pin || {};
  const salt = randomString(16, RECOVERY_ALPHABET);
  const data = {
    salt: salt,
    hash: await hashText(salt, pin),
    timeout: old.timeout !== undefined ? old.timeout : 1,
    enabledAt: old.enabledAt || new Date().toISOString(),
    recoverySalt: old.recoverySalt,
    recoveryHash: old.recoveryHash
  };

  let showCode = false;
  if (!old.recoveryHash) {
    const raw = randomString(8, RECOVERY_ALPHABET);
    pinNewCode = formatCode(raw);
    data.recoverySalt = randomString(16, RECOVERY_ALPHABET);
    data.recoveryHash = await hashText(data.recoverySalt, raw);
    showCode = true;
  }

  appData.settings.pin = data;
  appData.settings.pinFails = { count: 0, lockUntil: 0 };
  delete appData.settings.pinSetupPending;
  saveData();
  renderSecurityCard();
  if (typeof renderDashNudge === 'function') renderDashNudge();

  if (showCode) {
    pinMode = 'show-code';
    renderPinScreen();
  } else {
    closePinScreen();
    showToast('🔒 PIN baru disimpan');
  }
}


// ===== TOMBOL DI LAYAR PIN =====
function onPinClick(event) {
  const key = event.target.closest('[data-pin-key]');
  if (key) { pressPinKey(key.dataset.pinKey); return; }

  const actionButton = event.target.closest('[data-pin-action]');
  if (!actionButton) return;
  const action = actionButton.dataset.pinAction;

  if (action === 'back') { pinInput = pinInput.slice(0, -1); updateDots(); }
  if (action === 'cancel') closePinScreen();
  if (action === 'forgot') { pinMode = 'recover'; renderPinScreen(); }
  if (action === 'back-to-unlock') { pinMode = 'unlock'; pinInput = ''; renderPinScreen(); }
  if (action === 'copy') {
    if (navigator.clipboard) navigator.clipboard.writeText(pinNewCode).then(function () { showToast('Kode disalin'); }).catch(function () {});
  }
  if (action === 'finish-setup') {
    if (!document.getElementById('pin-saved').checked) {
      showToast('Centang "Sudah saya simpan" dulu ya');
      return;
    }
    pinNewCode = '';
    closePinScreen();
    burstConfetti();
    showToast('🔒 PIN aktif. MyMoney akan terkunci saat dibuka lagi.');
  }
}

function pressPinKey(digit) {
  if (pinMode === 'unlock' && pinWaitSeconds()) return;
  if (pinInput.length >= PIN_LENGTH) return;
  pinInput += digit;
  updateDots();
  if (pinInput.length === PIN_LENGTH) setTimeout(onPinComplete, 120);
}

async function onPinSubmit(event) {
  event.preventDefault();
  if (!event.target.matches('[data-pin-recover]')) return;
  const p = appData.settings.pin;
  const raw = normalizeCode(document.getElementById('pin-recover-code').value);
  const ok = raw.length === 8 && (await hashText(p.recoverySalt, raw)) === p.recoveryHash;
  if (!ok) {
    pinMessage('Kode pemulihan salah. Periksa lagi huruf dan angkanya.');
    return;
  }
  appData.settings.pinFails = { count: 0, lockUntil: 0 };
  saveData();
  pinMode = 'new';
  pinInput = '';
  renderPinScreen();
  pinMessage('Kode benar ✅ Sekarang buat PIN baru. Kode pemulihanmu tetap sama.');
}

// Keyboard laptop: angka & Backspace
document.addEventListener('keydown', function (event) {
  if (!pinScreen || !['unlock', 'new', 'confirm', 'verify'].includes(pinMode)) return;
  if (/^\d$/.test(event.key)) { event.preventDefault(); pressPinKey(event.key); }
  if (event.key === 'Backspace') { event.preventDefault(); pinInput = pinInput.slice(0, -1); updateDots(); }
});


// ===== KUNCI OTOMATIS =====
function lockNow() {
  if (!pinEnabled() || pinMode === 'unlock') return;
  document.documentElement.classList.add('pin-locked');
  openPinScreen('unlock');
}

document.addEventListener('visibilitychange', function () {
  if (!pinEnabled()) return;
  if (document.hidden) {
    pinHiddenAt = Date.now();
    document.documentElement.classList.add('pin-privacy');   // samarkan isi di daftar aplikasi
    return;
  }
  document.documentElement.classList.remove('pin-privacy');
  const timeout = (appData.settings.pin.timeout || 0) * 60000;
  if (pinHiddenAt && Date.now() - pinHiddenAt >= timeout) lockNow();
  pinHiddenAt = null;
});


// ===== PENGATURAN → KEAMANAN =====
function renderSecurityCard() {
  const card = document.getElementById('settings-security');
  if (!card) return;
  const p = appData.settings.pin;

  if (!pinEnabled()) {
    card.innerHTML = `
      <h2 class="card-title">🔒 Keamanan</h2>
      <p class="card-text">Kunci MyMoney dengan PIN 4 angka supaya aman saat HP dipinjam teman.
        Kamu juga akan mendapat kode pemulihan jika lupa PIN.</p>
      <button type="button" class="btn btn-primary" data-security="setup">
        <span class="material-symbols-rounded">lock</span> Pasang PIN</button>
    `;
    return;
  }

  const options = [[0, 'Langsung'], [1, '1 menit'], [5, '5 menit']];
  card.innerHTML = `
    <h2 class="card-title">🔒 Keamanan</h2>
    <div class="info-list">
      <div class="info-row"><span>PIN</span><strong class="text-success">Aktif</strong></div>
      <div class="info-row"><span>Sejak</span><strong>${formatShortDate(p.enabledAt.slice(0, 10))}</strong></div>
    </div>
    <p class="sub-title security-sub">Kunci lagi setelah ditinggal</p>
    <div class="segmented security-timeout">
      ${options.map(function (o) {
        return `<button type="button" class="segmented-btn ${p.timeout === o[0] ? 'active' : ''}" data-security-timeout="${o[0]}">${o[1]}</button>`;
      }).join('')}
    </div>
    <div class="button-row">
      <button type="button" class="btn btn-secondary" data-security="lock">
        <span class="material-symbols-rounded">lock</span> Kunci sekarang</button>
      <button type="button" class="btn btn-secondary" data-security="change">
        <span class="material-symbols-rounded">password</span> Ubah PIN</button>
      <button type="button" class="btn btn-danger" data-security="off">
        <span class="material-symbols-rounded">lock_open</span> Matikan PIN</button>
    </div>
    <p class="hint">PIN adalah kunci layar untuk mencegah orang lain mengintip. File backup tidak ikut terkunci, jadi simpan di tempat aman.</p>
  `;
}

function startPinSetup() {
  pinFirst = '';
  openPinScreen('new');
}

function requireCurrentPin(next) {
  pinAfterVerify = next;
  openPinScreen('verify');
}

document.addEventListener('click', function (event) {
  const timeoutButton = event.target.closest('[data-security-timeout]');
  if (timeoutButton) {
    appData.settings.pin.timeout = Number(timeoutButton.dataset.securityTimeout);
    saveData();
    renderSecurityCard();
    showToast('Kunci otomatis: ' + timeoutButton.textContent.trim());
    return;
  }

  const button = event.target.closest('[data-security]');
  if (!button) return;
  const action = button.dataset.security;

  if (action === 'setup') startPinSetup();
  if (action === 'lock') lockNow();
  if (action === 'change') requireCurrentPin(function () { pinFirst = ''; pinMode = 'new'; pinInput = ''; renderPinScreen(); });
  if (action === 'off') {
    requireCurrentPin(function () {
      delete appData.settings.pin;
      appData.settings.pinFails = { count: 0, lockUntil: 0 };
      saveData();
      closePinScreen();
      renderSecurityCard();
      showToast('PIN dimatikan');
    });
  }
});


// ===== TAWARAN MEMASANG PIN (slot pemberitahuan Beranda) =====
// Muncul setelah datanya mulai berharga (15 transaksi atau 3 hari mencatat).
// "Nanti saja" 2 kali → tidak ditawarkan lagi (tetap bisa dari Pengaturan).
function pinOfferHtml() {
  if (pinEnabled()) return '';
  const offer = appData.settings.pinOffer || { dismissed: 0, lastDismiss: null };
  if (offer.dismissed >= 2) return '';
  if (offer.lastDismiss && daysBetween(offer.lastDismiss, todayString()) < 3) return '';

  const activeDays = typeof getActiveDays === 'function' ? Object.keys(getActiveDays()).length : 0;
  if (appData.transactions.length < 15 && activeDays < 3) return '';

  return `
    <div class="plan-card pin-offer">
      <div class="transfer-head">
        <span class="transfer-emoji">🔒</span>
        <div>
          <strong>Kunci MyMoney dengan PIN?</strong>
          <small>Catatanmu sudah ${appData.transactions.length} transaksi. Supaya aman kalau HP dipinjam teman.</small>
        </div>
      </div>
      <div class="transfer-actions">
        <button type="button" class="btn btn-primary" data-security="setup">
          <span class="material-symbols-rounded">lock</span> Pasang PIN</button>
        <button type="button" class="transfer-later" data-pin-offer="later">Nanti saja</button>
      </div>
    </div>
  `;
}

document.getElementById('page-dashboard').addEventListener('click', function (event) {
  if (!event.target.closest('[data-pin-offer]')) return;
  const offer = appData.settings.pinOffer || { dismissed: 0, lastDismiss: null };
  offer.dismissed += 1;
  offer.lastDismiss = todayString();
  appData.settings.pinOffer = offer;
  saveData();
  if (typeof renderDashNudge === 'function') renderDashNudge();
  showToast(offer.dismissed >= 2 ? 'Oke. PIN tetap bisa dipasang di Pengaturan → Keamanan' : 'Oke, nanti ditawarkan lagi');
});


// ===== SAAT APLIKASI DIBUKA =====
renderSecurityCard();

if (pinEnabled()) {
  lockNow();
} else {
  document.documentElement.classList.remove('pin-locked');
  // Dipilih di layar akhir pengaturan awal → langsung buat PIN
  if (appData.settings.pinSetupPending) setTimeout(startPinSetup, 400);
}
if (typeof renderDashNudge === 'function') renderDashNudge();
