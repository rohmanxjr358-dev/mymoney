// =====================================================
// CEPAT.JS — "Catat Kilat": catat pengeluaran rutin sekali ketuk
// =====================================================
// Data disimpan di appData.quickTemplates:
//   { id, emoji, label, amount, categoryId }
// Transaksi yang dibuat dari sini diberi tanda quickId.

// ===== EMOJI UNTUK SETIAP KATEGORI (dipakai juga oleh Rekap) =====
const CATEGORY_EMOJI = {
  'out-iuran': '🏠', 'out-makan': '🍛', 'out-minum': '🥤', 'out-bahan': '🛒',
  'out-jajan': '🍢', 'out-mandi': '🧴', 'out-laundry': '🧺', 'out-rumah': '🧹',
  'out-print': '🖨️', 'out-atk': '✏️', 'out-praktikum': '🔬', 'out-proyek': '🛠️',
  'out-bensin': '⛽', 'out-kendaraan': '🏍️', 'out-pakaian': '👕', 'out-rawat': '💈',
  'out-kesehatan': '💊', 'out-hiburan': '🎮', 'out-nongkrong': '☕', 'out-rokok': '🚬',
  'out-tabungan': '🐷', 'out-darurat': '🛟', 'out-investasi': '📚', 'out-lainnya': '📦',
  'in-bulanan': '💌', 'in-beasiswa': '🎓', 'in-sampingan': '💼', 'in-hadiah': '🎁', 'in-lainnya': '💰'
};

function categoryEmoji(categoryId) {
  return CATEGORY_EMOJI[categoryId] || '💸';
}

// Pilihan emoji saat membuat tombol sendiri
const QUICK_EMOJI_CHOICES = ['⛽', '🍛', '🥤', '☕', '🍢', '🚬', '🧺', '🖨️', '🛒', '🍜', '🧃', '🏍️', '🎮', '💊', '🧴', '📦'];

// Warna-warni tombol (urutan tetap, bukan acak)
const QUICK_TONES = ['blue', 'violet', 'teal', 'amber', 'rose', 'sky', 'emerald', 'orange'];

const QUICK_MAX = 12;

const QUICK_DEFAULTS = [
  { emoji: '⛽', label: 'Bensin',  amount: 20000, categoryId: 'out-bensin' },
  { emoji: '🍛', label: 'Makan',   amount: 15000, categoryId: 'out-makan' },
  { emoji: '🥤', label: 'Minum',   amount: 5000,  categoryId: 'out-minum' },
  { emoji: '🚬', label: 'Rokok',   amount: 25000, categoryId: 'out-rokok' },
  { emoji: '🍢', label: 'Jajan',   amount: 10000, categoryId: 'out-jajan' },
  { emoji: '🧺', label: 'Laundry', amount: 15000, categoryId: 'out-laundry' },
  { emoji: '🖨️', label: 'Print',   amount: 5000,  categoryId: 'out-print' }
];

// Isi tombol bawaan saat fitur ini pertama kali dipakai
if (!Array.isArray(appData.quickTemplates)) {
  appData.quickTemplates = QUICK_DEFAULTS
    .filter(function (t) { return findCategory(t.categoryId); })
    .map(function (t) { return Object.assign({ id: generateId() }, t); });
  saveData();
}


// ===== ALAT BANTU =====
// 20000 → "20rb", 1500000 → "1,5jt"
function compactRupiah(value) {
  const n = Math.abs(Number(value) || 0);
  if (n >= 1000000) return (n / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'jt';
  if (n >= 1000) return (n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + 'rb';
  return String(n);
}

function findQuickTemplate(id) {
  return appData.quickTemplates.find(function (t) { return t.id === id; }) || null;
}

function quickUsedToday(templateId) {
  const today = todayString();
  return appData.transactions.filter(function (tx) {
    return tx.quickId === templateId && tx.date === today;
  }).length;
}

// Semua bagian yang menampilkan transaksi ikut diperbarui
function refreshAfterTransactionChange() {
  renderRecentTransactions();
  updateBackupInfo();
  renderQuickAll();
  if (document.getElementById('page-dashboard').classList.contains('active')) renderDashboard();
  if (typeof renderCalendarIfOpen === 'function') renderCalendarIfOpen();
}


// ===== NOTIFIKASI DENGAN TOMBOL "BATALKAN" =====
function showSnack(message, actionLabel, onAction) {
  let snack = document.getElementById('snack');
  if (!snack) {
    snack = document.createElement('div');
    snack.id = 'snack';
    snack.className = 'snack';
    snack.setAttribute('role', 'status');
    document.body.appendChild(snack);
  }

  snack.innerHTML = `
    <span class="snack-text">${message}</span>
    ${actionLabel ? `<button type="button" class="snack-action">${actionLabel}</button>` : ''}
    <span class="snack-timer"></span>
  `;

  const button = snack.querySelector('.snack-action');
  if (button) {
    button.addEventListener('click', function () {
      snack.classList.remove('show');
      onAction();
    });
  }

  // Ulang animasi garis waktu
  snack.classList.remove('show');
  void snack.offsetWidth;
  snack.classList.add('show');

  clearTimeout(snack.hideTimer);
  snack.hideTimer = setTimeout(function () {
    snack.classList.remove('show');
  }, 5000);
}


// ===== TAMPILKAN TOMBOL-TOMBOL KILAT =====
function renderQuick(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const templates = appData.quickTemplates.filter(function (t) { return findCategory(t.categoryId); });

  const chips = templates.map(function (t, i) {
    const used = quickUsedToday(t.id);
    return `
      <button type="button" class="quick-chip tone-${QUICK_TONES[i % QUICK_TONES.length]}"
              data-quick="${t.id}" title="${escapeHtml(t.label)} ${formatRupiah(t.amount)}">
        <span class="quick-emoji">${escapeHtml(t.emoji)}</span>
        <span class="quick-label">${escapeHtml(t.label)}</span>
        <span class="quick-amount">${compactRupiah(t.amount)}</span>
        ${used ? `<span class="quick-count">×${used}</span>` : ''}
      </button>
    `;
  }).join('');

  container.innerHTML = `
    <div class="card-header">
      <div>
        <h2 class="card-title quick-title"><span class="quick-bolt">⚡</span> Catat Kilat</h2>
        <p class="quick-sub">Ketuk = langsung tercatat · tahan = ubah nominal dulu</p>
      </div>
      <button type="button" class="link-btn" data-quick-manage>
        <span class="material-symbols-rounded">tune</span> Atur
      </button>
    </div>
    ${templates.length
      ? `<div class="quick-row">${chips}</div>`
      : `<p class="empty-state">Belum ada tombol. Ketuk "Atur" untuk membuatnya.</p>`}
  `;
}

function renderQuickAll() {
  renderQuick('dash-quick');
  renderQuick('tx-quick');
}


// ===== SEKALI KETUK: CATAT =====
function recordQuick(templateId, chip) {
  const t = findQuickTemplate(templateId);
  if (!t) return;

  const tx = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    type: 'keluar',
    amount: t.amount,
    date: todayString(),
    time: currentTimeString(),
    categoryId: t.categoryId,
    source: '',
    note: '',
    quickId: t.id
  };

  appData.transactions.push(tx);
  saveData();

  // Efek: angka melayang dari tombol + getar singkat (Android)
  if (chip) flyAmount(chip, '−' + compactRupiah(t.amount));
  if (navigator.vibrate) navigator.vibrate(12);

  refreshAfterTransactionChange();

  showSnack(
    escapeHtml(t.emoji) + ' <strong>' + escapeHtml(t.label) + ' ' + formatRupiah(t.amount) + '</strong> tercatat',
    'Batalkan',
    function () {
      appData.transactions = appData.transactions.filter(function (item) { return item.id !== tx.id; });
      saveData();
      refreshAfterTransactionChange();
      showToast('Dibatalkan');
    }
  );
}

function flyAmount(chip, text) {
  const rect = chip.getBoundingClientRect();
  const fly = document.createElement('span');
  fly.className = 'quick-fly';
  fly.textContent = text;
  fly.style.left = (rect.left + rect.width / 2) + 'px';
  fly.style.top = rect.top + 'px';
  document.body.appendChild(fly);
  setTimeout(function () { fly.remove(); }, 1000);
}


// ===== TAHAN LAMA: buka form dengan isian dari tombol =====
function openQuickInForm(templateId) {
  const t = findQuickTemplate(templateId);
  if (!t) return;

  showPage('transaksi');
  switchTransactionTab('catat');
  resetTransactionForm();
  setTransactionType('keluar');
  txCategory.value = t.categoryId;
  txAmount.value = t.amount;
  txNote.value = '';
  updateAmountPreview();
  txAmount.focus();
  txAmount.select();
  showToast('Ubah nominalnya, lalu Simpan');
}


// ===== JENDELA "ATUR TOMBOL" =====
const quickModal = document.getElementById('quick-modal');
const quickModalBody = document.getElementById('quick-modal-body');
let quickEditingId = null;

function categoryOptionsHtml(type, selectedId) {
  const groups = {};
  getCategories(type).forEach(function (cat) {
    (groups[cat.group] = groups[cat.group] || []).push(cat);
  });
  return Object.keys(groups).map(function (group) {
    return `<optgroup label="${escapeHtml(group)}">${groups[group].map(function (cat) {
      return `<option value="${cat.id}" ${cat.id === selectedId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
    }).join('')}</optgroup>`;
  }).join('');
}

function renderQuickManager() {
  const list = appData.quickTemplates.map(function (t, i) {
    const category = findCategory(t.categoryId);
    return `
      <div class="quick-manage-row ${t.id === quickEditingId ? 'editing' : ''}">
        <span class="quick-manage-emoji tone-${QUICK_TONES[i % QUICK_TONES.length]}">${escapeHtml(t.emoji)}</span>
        <div class="quick-manage-info">
          <strong>${escapeHtml(t.label)} · ${formatRupiah(t.amount)}</strong>
          <small>${category ? escapeHtml(category.name) : '⚠️ Kategori sudah dihapus'}</small>
        </div>
        <div class="quick-manage-actions">
          <button type="button" class="icon-btn" data-qm="up" data-id="${t.id}" title="Naikkan" ${i === 0 ? 'disabled' : ''}>
            <span class="material-symbols-rounded">arrow_upward</span>
          </button>
          <button type="button" class="icon-btn" data-qm="edit" data-id="${t.id}" title="Ubah">
            <span class="material-symbols-rounded">edit</span>
          </button>
          <button type="button" class="icon-btn danger" data-qm="delete" data-id="${t.id}" title="Hapus">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  const editing = quickEditingId ? findQuickTemplate(quickEditingId) : null;
  const data = editing || { emoji: '⛽', label: '', amount: '', categoryId: '' };
  const full = !editing && appData.quickTemplates.length >= QUICK_MAX;

  quickModalBody.innerHTML = `
    <div class="quick-manage-list">${list || '<p class="empty-state">Belum ada tombol.</p>'}</div>

    <h3 class="sub-title">${editing ? 'Ubah Tombol' : 'Tambah Tombol'}</h3>
    ${full ? `<p class="card-text">Maksimal ${QUICK_MAX} tombol. Hapus salah satu untuk menambah yang baru.</p>` : `
    <form id="quick-form" novalidate>
      <div class="emoji-picker">
        ${QUICK_EMOJI_CHOICES.map(function (e) {
          return `<button type="button" class="emoji-option ${e === data.emoji ? 'active' : ''}" data-emoji="${e}">${e}</button>`;
        }).join('')}
      </div>
      <input type="hidden" id="qf-emoji" value="${escapeHtml(data.emoji)}">
      <div class="form-grid">
        <div class="field">
          <label for="qf-label">Nama tombol</label>
          <input type="text" id="qf-label" maxlength="14" placeholder="Contoh: Kopi" value="${escapeHtml(data.label)}">
        </div>
        <div class="field">
          <label for="qf-amount">Nominal</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="qf-amount" inputmode="numeric" min="1" step="1" placeholder="0" value="${data.amount}">
          </div>
        </div>
        <div class="field field-full">
          <label for="qf-category">Kategori</label>
          <select id="qf-category">
            <option value="">— Pilih kategori —</option>
            ${categoryOptionsHtml('keluar', data.categoryId)}
          </select>
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">check</span> ${editing ? 'Simpan Perubahan' : 'Tambah Tombol'}
        </button>
        ${editing ? '<button type="button" class="btn btn-secondary" data-qm="cancel">Batal</button>' : ''}
      </div>
    </form>`}
  `;
}

function openQuickManager() {
  quickEditingId = null;
  renderQuickManager();
  quickModal.classList.add('open');
}

function closeQuickManager() {
  quickModal.classList.remove('open');
  renderQuickAll();
}

function saveQuickForm(event) {
  event.preventDefault();
  const label = document.getElementById('qf-label').value.trim();
  const amount = Math.round(Number(document.getElementById('qf-amount').value));
  const categoryId = document.getElementById('qf-category').value;
  const emoji = document.getElementById('qf-emoji').value || '💸';

  if (!label) { showToast('Isi nama tombol'); return; }
  if (!amount || amount <= 0) { showToast('Isi nominal'); return; }
  if (!categoryId) { showToast('Pilih kategori'); return; }

  if (quickEditingId) {
    Object.assign(findQuickTemplate(quickEditingId), { label: label, amount: amount, categoryId: categoryId, emoji: emoji });
    showToast('Tombol diperbarui');
  } else {
    appData.quickTemplates.push({ id: generateId(), label: label, amount: amount, categoryId: categoryId, emoji: emoji });
    showToast('Tombol ditambahkan');
  }

  saveData();
  quickEditingId = null;
  renderQuickManager();
  renderQuickAll();
}


// ===== MENGHUBUNGKAN TOMBOL =====
// Ketuk vs tahan lama, berlaku untuk semua wadah Catat Kilat
let quickPressTimer = null;
let quickLongPressed = false;

document.addEventListener('pointerdown', function (event) {
  const chip = event.target.closest('[data-quick]');
  if (!chip) return;
  quickLongPressed = false;
  chip.classList.add('pressing');
  quickPressTimer = setTimeout(function () {
    quickLongPressed = true;
    chip.classList.remove('pressing');
    if (navigator.vibrate) navigator.vibrate(25);
    openQuickInForm(chip.dataset.quick);
  }, 550);
});

['pointerup', 'pointercancel', 'pointerleave'].forEach(function (name) {
  document.addEventListener(name, function (event) {
    // "pointerleave" juga terjadi saat kursor pindah antar-bagian di dalam tombol; abaikan itu
    if (name === 'pointerleave' && !(event.target.matches && event.target.matches('[data-quick]'))) return;
    clearTimeout(quickPressTimer);
    document.querySelectorAll('.quick-chip.pressing').forEach(function (c) { c.classList.remove('pressing'); });
  }, true);
});

// Menahan jari di HP biasanya memunculkan menu; matikan khusus di tombol kilat
document.addEventListener('contextmenu', function (event) {
  if (event.target.closest('[data-quick]')) event.preventDefault();
});

document.addEventListener('click', function (event) {
  const chip = event.target.closest('[data-quick]');
  if (chip) {
    if (quickLongPressed) { quickLongPressed = false; return; }
    chip.classList.remove('popped');
    void chip.offsetWidth;
    chip.classList.add('popped');
    recordQuick(chip.dataset.quick, chip);
    return;
  }
  if (event.target.closest('[data-quick-manage]')) openQuickManager();
});

quickModal.addEventListener('click', function (event) {
  if (event.target.closest('[data-quick-close]')) { closeQuickManager(); return; }

  const emojiButton = event.target.closest('[data-emoji]');
  if (emojiButton) {
    document.getElementById('qf-emoji').value = emojiButton.dataset.emoji;
    quickModal.querySelectorAll('.emoji-option').forEach(function (b) { b.classList.toggle('active', b === emojiButton); });
    return;
  }

  const button = event.target.closest('[data-qm]');
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.qm;

  if (action === 'edit') { quickEditingId = id; renderQuickManager(); }
  if (action === 'cancel') { quickEditingId = null; renderQuickManager(); }
  if (action === 'up') {
    const i = appData.quickTemplates.findIndex(function (t) { return t.id === id; });
    if (i > 0) {
      const moved = appData.quickTemplates.splice(i, 1)[0];
      appData.quickTemplates.splice(i - 1, 0, moved);
      saveData();
      renderQuickManager();
    }
  }
  if (action === 'delete') {
    const t = findQuickTemplate(id);
    if (t && confirm('Hapus tombol "' + t.label + '"? Transaksi yang sudah tercatat tidak ikut terhapus.')) {
      appData.quickTemplates = appData.quickTemplates.filter(function (item) { return item.id !== id; });
      if (quickEditingId === id) quickEditingId = null;
      saveData();
      renderQuickManager();
    }
  }
});

quickModal.addEventListener('submit', function (event) {
  if (event.target.id === 'quick-form') saveQuickForm(event);
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && quickModal.classList.contains('open')) closeQuickManager();
});


// ===== SAAT APLIKASI DIBUKA =====
renderQuickAll();
