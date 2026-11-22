// =====================================================
// DOMPET.JS — Dompet & Rekening (tunai, bank, e-wallet)
// =====================================================
// appData.wallets:     { id, name, brand, initial, createdAt }
// appData.walletMoves: { id, kind: 'transfer', from, to, amount, fee, feeTxId, date, time, note, createdAt }
//                      { id, kind: 'adjust', walletId, amount (+/−), date, time, note, createdAt }
// Setiap transaksi punya walletId. Pindah uang & penyesuaian TIDAK dihitung
// sebagai pemasukan/pengeluaran — hanya mengubah saldo dompet.

// ===== MEREK (hanya nama & warna, bukan logo) =====
const WALLET_BRANDS = {
  tunai:     { label: 'Tunai',         badge: '💵',    color: '#16a34a', type: 'Tunai' },
  bca:       { label: 'BCA',           badge: 'BCA',   color: '#0b5cab', type: 'Bank' },
  bri:       { label: 'BRI',           badge: 'BRI',   color: '#00529c', type: 'Bank' },
  bni:       { label: 'BNI',           badge: 'BNI',   color: '#f26522', type: 'Bank' },
  mandiri:   { label: 'Mandiri',       badge: 'MDR',   color: '#0b3a74', type: 'Bank' },
  bsi:       { label: 'BSI',           badge: 'BSI',   color: '#00a39d', type: 'Bank' },
  seabank:   { label: 'SeaBank',       badge: 'SEA',   color: '#f05a28', type: 'Bank' },
  jago:      { label: 'Jago',          badge: 'JGO',   color: '#d99a00', type: 'Bank' },
  dana:      { label: 'DANA',          badge: 'DANA',  color: '#118eea', type: 'E-wallet' },
  gopay:     { label: 'GoPay',         badge: 'GoPay', color: '#00a5cf', type: 'E-wallet' },
  ovo:       { label: 'OVO',           badge: 'OVO',   color: '#4c3494', type: 'E-wallet' },
  shopeepay: { label: 'ShopeePay',     badge: 'SPay',  color: '#ee4d2d', type: 'E-wallet' },
  bank:      { label: 'Bank lain',     badge: '🏦',    color: '#475569', type: 'Bank' },
  ewallet:   { label: 'E-wallet lain', badge: '📱',    color: '#64748b', type: 'E-wallet' },
  utama:     { label: 'Dompet Utama',  badge: '💼',    color: '#1d4ed8', type: 'Dompet' }
};

const WALLET_BRAND_ORDER = ['tunai', 'bca', 'bri', 'bni', 'mandiri', 'bsi', 'seabank', 'jago',
                            'dana', 'gopay', 'ovo', 'shopeepay', 'bank', 'ewallet'];


// ===== DATA AWAL / PEMBARUAN DATA LAMA =====
if (!Array.isArray(appData.wallets) || !appData.wallets.length) {
  // Semua transaksi lama masuk ke satu dompet; bisa ditambah/diganti nanti
  appData.wallets = [{ id: 'w-utama', name: 'Dompet Utama', brand: 'utama', initial: 0, createdAt: new Date().toISOString() }];
  appData.settings.defaultWalletId = 'w-utama';
}
if (!Array.isArray(appData.walletMoves)) appData.walletMoves = [];

// Kategori untuk biaya admin transfer/top up
if (!appData.settings.adminCategoryAdded) {
  if (!appData.categories.some(function (c) { return c.id === 'out-admin'; })) {
    appData.categories.push({
      id: 'out-admin', name: 'Biaya Admin & Transfer', type: 'keluar',
      group: 'Lainnya', fund: null, isDefault: true
    });
  }
  appData.settings.adminCategoryAdded = true;
}


// ===== ALAT BANTU =====
function findWallet(id) {
  return appData.wallets.find(function (w) { return w.id === id; }) || null;
}

function getDefaultWalletId() {
  const id = appData.settings.defaultWalletId;
  return findWallet(id) ? id : appData.wallets[0].id;
}

function getIncomeWalletId() {
  const id = appData.settings.incomeWalletId;
  return findWallet(id) ? id : getDefaultWalletId();
}

function txWalletId(tx) {
  return tx.walletId && findWallet(tx.walletId) ? tx.walletId : getDefaultWalletId();
}

function walletBrand(wallet) {
  return WALLET_BRANDS[wallet && wallet.brand] || WALLET_BRANDS.bank;
}

function walletName(id) {
  const w = findWallet(id);
  return w ? w.name : 'Dompet terhapus';
}

// Transaksi yang dibuat fitur lain (uang bulanan, tagihan, tabungan) diberi dompet otomatis
function stampWallets() {
  appData.transactions.forEach(function (tx) {
    if (tx.walletId && findWallet(tx.walletId)) return;
    tx.walletId = tx.categoryId === 'in-bulanan' ? getIncomeWalletId() : getDefaultWalletId();
  });
}

// (saveData di storage.js memanggil stampWallets setiap kali menyimpan)
saveData();


// ===== SALDO =====
function walletBalance(id) {
  const wallet = findWallet(id);
  let balance = wallet ? (wallet.initial || 0) : 0;

  appData.transactions.forEach(function (tx) {
    if (txWalletId(tx) !== id) return;
    balance += tx.type === 'masuk' ? tx.amount : -tx.amount;
  });

  appData.walletMoves.forEach(function (m) {
    if (m.kind === 'transfer') {
      if (m.from === id) balance -= m.amount;
      if (m.to === id) balance += m.amount;
    }
    if (m.kind === 'adjust' && m.walletId === id) balance += m.amount;
  });

  return balance;
}

// ===== LOKASI TABUNGAN =====
// Tabungan (tabungan pribadi / dana darurat / investasi) bisa "disimpan" di sebuah dompet.
// Saldo asli dompet = uang di dompet di dompet itu + tabungan yang disimpan di sana,
// sehingga angkanya sama dengan yang terlihat di aplikasi bank / e-wallet.
function getFundLocation(key) {
  const map = appData.settings.fundWallet || {};
  return map[key] && findWallet(map[key]) ? map[key] : null;
}

function fundsInWallet(id) {
  if (typeof FUND_KEYS === 'undefined') return 0;
  return FUND_KEYS.reduce(function (sum, key) {
    return sum + (getFundLocation(key) === id ? Math.max(0, getFundBalance(key)) : 0);
  }, 0);
}

function walletRealBalance(id) {
  return walletBalance(id) + fundsInWallet(id);
}

// Tambahan untuk "uang di dompet": saldo awal semua dompet + penyesuaian
// (dipakai oleh getWalletBalance di tabungan.js)
function getWalletExtras() {
  const initial = appData.wallets.reduce(function (s, w) { return s + (w.initial || 0); }, 0);
  const adjust = appData.walletMoves.reduce(function (s, m) { return s + (m.kind === 'adjust' ? m.amount : 0); }, 0);
  return initial + adjust;
}


// ===== TAMPILAN KECIL =====
function walletBadgeHtml(wallet, size) {
  const brand = walletBrand(wallet);
  const isEmoji = /[^\x00-\x7F]/.test(brand.badge);
  return `<span class="wallet-badge ${size || ''} ${isEmoji ? 'emoji' : ''}" style="--wc:${brand.color}">${brand.badge}</span>`;
}

// Pilihan dompet berbentuk chip (dipakai di banyak form)
function walletPickerHtml(inputId, selectedId, excludeId) {
  return `
    <div class="wallet-picker" data-input="${inputId}">
      ${appData.wallets.filter(function (w) { return w.id !== excludeId; }).map(function (w) {
        return `
          <button type="button" class="wallet-chip ${w.id === selectedId ? 'active' : ''}" data-wallet-pick="${w.id}" style="--wc:${walletBrand(w).color}">
            ${walletBadgeHtml(w, 'tiny')}
            <span>${escapeHtml(w.name)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

// Klik chip dompet di mana pun
document.addEventListener('click', function (event) {
  const chip = event.target.closest('[data-wallet-pick]');
  if (!chip) return;
  const picker = chip.closest('.wallet-picker');
  picker.querySelectorAll('.wallet-chip').forEach(function (c) { c.classList.toggle('active', c === chip); });
  const input = document.getElementById(picker.dataset.input);
  if (input) {
    input.value = chip.dataset.walletPick;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
});


// ===== STRIP DOMPET DI DASHBOARD =====
function renderDashWallets() {
  const box = document.getElementById('dash-wallets');
  if (!box) return;
  const hide = typeof maskedMoney === 'function';

  const cards = appData.wallets.map(function (w, i) {
    const balance = walletRealBalance(w.id);
    const saved = fundsInWallet(w.id);
    const text = (balance < 0 ? '−' : '') + formatRupiah(Math.abs(balance));
    return `
      <button type="button" class="wallet-card" data-wallet-open="${w.id}" style="--wc:${walletBrand(w).color}; --i:${i}">
        <div class="wallet-card-top">
          ${walletBadgeHtml(w)}
          ${w.id === getDefaultWalletId() ? '<span class="wallet-star" title="Dompet utama">★</span>' : ''}
        </div>
        <span class="wallet-card-name">${escapeHtml(w.name)}</span>
        <strong class="wallet-card-balance ${balance < 0 ? 'text-danger' : ''}">${hide ? maskedMoney(text) : text}</strong>
        ${saved > 0 ? `<small class="wallet-card-saved">🐷 ${appData.settings.hideBalance ? 'tabungan' : 'termasuk tabungan ' + compactRupiah(saved)}</small>` : ''}
      </button>
    `;
  }).join('');

  box.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Dompet &amp; Rekening</h2>
      <div class="wallet-head-actions">
        ${appData.wallets.length > 1 ? `<button type="button" class="link-btn" data-wallet-transfer>
          <span class="material-symbols-rounded">swap_horiz</span><span class="wlabel">Pindah</span></button>` : ''}
        <button type="button" class="link-btn" data-wallet-manage>
          <span class="material-symbols-rounded">tune</span><span class="wlabel">Kelola</span></button>
      </div>
    </div>
    <div class="wallet-row">
      ${cards}
      <button type="button" class="wallet-card add" data-wallet-add>
        <span class="material-symbols-rounded">add</span>
        <span class="wallet-card-name">Tambah</span>
      </button>
    </div>
  `;
}


// ===== JENDELA DOMPET =====
const walletModal = document.getElementById('wallet-modal');
const walletModalTitle = document.getElementById('wallet-modal-title');
const walletModalBody = document.getElementById('wallet-modal-body');

function openWalletModal() {
  walletModal.classList.add('open');
}

function closeWalletModal() {
  walletModal.classList.remove('open');
}

function afterWalletChange() {
  saveData();
  renderDashWallets();
  if (typeof refreshAfterTransactionChange === 'function') refreshAfterTransactionChange();
  if (document.getElementById('page-tabungan').classList.contains('active') && typeof renderTabungan === 'function') renderTabungan();
}

// --- a) Daftar semua dompet ---
function showWalletManager() {
  walletModalTitle.textContent = 'Dompet & Rekening';
  const total = appData.wallets.reduce(function (s, w) { return s + walletBalance(w.id); }, 0);

  walletModalBody.innerHTML = `
    <div class="wallet-total">
      <span>Total uang di dompet di semua dompet</span>
      <strong>${signedRupiah(total)}</strong>
    </div>
    <div class="wallet-list">
      ${appData.wallets.map(function (w) {
        const tags = [];
        if (w.id === getDefaultWalletId()) tags.push('<span class="wallet-tag">★ Utama</span>');
        if (w.id === getIncomeWalletId()) tags.push('<span class="wallet-tag income">💌 Terima kiriman</span>');
        return `
          <button type="button" class="wallet-list-row" data-wallet-open="${w.id}">
            ${walletBadgeHtml(w)}
            <div class="wallet-list-info">
              <strong>${escapeHtml(w.name)}</strong>
              <small>${walletBrand(w).type} ${tags.join(' ')}</small>
            </div>
            <strong class="${walletRealBalance(w.id) < 0 ? 'text-danger' : ''}">${signedRupiah(walletRealBalance(w.id))}</strong>
          </button>
        `;
      }).join('')}
    </div>
    <div class="button-row">
      <button type="button" class="btn btn-primary" data-wallet-add>
        <span class="material-symbols-rounded">add</span> Tambah Dompet
      </button>
      ${appData.wallets.length > 1 ? `<button type="button" class="btn btn-secondary" data-wallet-transfer>
        <span class="material-symbols-rounded">swap_horiz</span> Pindah Uang
      </button>` : ''}
    </div>
    <h3 class="sub-title fund-loc-title">🐷 Tabungan disimpan di mana?</h3>
    <p class="card-text">Kalau tabunganmu ada di rekening yang sama, pilih rekeningnya supaya saldo dompet di sini
      sama persis dengan saldo di aplikasi bank.</p>
    <div class="fund-loc-list">
      ${(typeof FUND_KEYS !== 'undefined' ? FUND_KEYS : []).map(function (key) {
        return `
          <label class="fund-loc-row">
            <span>${FUND_INFO[key].label}<small>${formatRupiah(Math.max(0, getFundBalance(key)))}</small></span>
            <select data-fund-loc="${key}">
              <option value="">Terpisah (tidak di dompet ini)</option>
              ${appData.wallets.map(function (w) {
                return `<option value="${w.id}" ${getFundLocation(key) === w.id ? 'selected' : ''}>${escapeHtml(w.name)}</option>`;
              }).join('')}
            </select>
          </label>
        `;
      }).join('')}
    </div>
    <p class="hint"><strong>Pindah Uang</strong> = memindahkan tempat (tarik tunai, top up).
      <strong>Sisihkan</strong> (di Tabungan) = memberi tujuan pada uang. Keduanya bukan pengeluaran.</p>
  `;
  openWalletModal();
}

// --- b) Detail satu dompet ---
function walletHistory(id) {
  const items = [];

  appData.transactions.forEach(function (tx) {
    if (txWalletId(tx) !== id) return;
    const cat = findCategory(tx.categoryId);
    // Disisihkan ke tabungan yang lokasinya di dompet ini → uangnya tidak pergi ke mana-mana
    const kept = cat && cat.fund && getFundLocation(cat.fund) === id;
    items.push({
      date: tx.date, time: tx.time, title: cat ? cat.name : 'Kategori terhapus',
      sub: kept ? 'Disisihkan · tetap di dompet ini' : (tx.note || tx.source || ''),
      amount: tx.type === 'masuk' ? tx.amount : -tx.amount, txId: tx.id,
      kept: kept, icon: kept ? 'savings' : null
    });
  });

  appData.walletMoves.forEach(function (m) {
    if (m.kind === 'transfer' && (m.from === id || m.to === id)) {
      const out = m.from === id;
      items.push({
        date: m.date, time: m.time,
        title: out ? 'Pindah ke ' + walletName(m.to) : 'Dari ' + walletName(m.from),
        sub: m.note || '', amount: out ? -m.amount : m.amount, moveId: m.id, icon: 'swap_horiz'
      });
    }
    if (m.kind === 'adjust' && m.walletId === id) {
      items.push({
        date: m.date, time: m.time, title: 'Penyesuaian saldo',
        sub: m.note || '', amount: m.amount, moveId: m.id, icon: 'tune'
      });
    }
  });

  return items.sort(function (a, b) {
    return (b.date + ' ' + b.time).localeCompare(a.date + ' ' + a.time);
  });
}

function showWalletDetail(id) {
  const w = findWallet(id);
  if (!w) { showWalletManager(); return; }
  const balance = walletRealBalance(id);
  const saved = fundsInWallet(id);
  const history = walletHistory(id).slice(0, 40);

  walletModalTitle.innerHTML = `<span class="wallet-modal-head">${walletBadgeHtml(w, 'small')} ${escapeHtml(w.name)}</span>`;
  walletModalBody.innerHTML = `
    <div class="wallet-hero" style="--wc:${walletBrand(w).color}">
      <span>Saldo${saved > 0 ? ' (sama dengan di aplikasi bank)' : ''}</span>
      <strong>${signedRupiah(balance)}</strong>
      <small>${saved > 0
        ? 'Uang di dompet ' + formatRupiah(walletBalance(id)) + ' · Tabungan ' + formatRupiah(saved)
        : walletBrand(w).type + (w.id === getDefaultWalletId() ? ' · ★ Dompet utama' : '')}</small>
    </div>
    <div class="wallet-actions">
      ${appData.wallets.length > 1 ? `<button type="button" class="wallet-action" data-wallet-transfer="${id}">
        <span class="material-symbols-rounded">swap_horiz</span>Pindah</button>` : ''}
      <button type="button" class="wallet-action" data-wallet-adjust="${id}">
        <span class="material-symbols-rounded">tune</span>Sesuaikan</button>
      <button type="button" class="wallet-action" data-wallet-edit="${id}">
        <span class="material-symbols-rounded">edit</span>Ubah</button>
      ${w.id !== getDefaultWalletId() ? `<button type="button" class="wallet-action" data-wallet-default="${id}">
        <span class="material-symbols-rounded">star</span>Jadikan utama</button>` : ''}
    </div>
    <h3 class="sub-title wallet-history-title">Riwayat</h3>
    <div class="wallet-history">
      ${history.length ? history.map(function (h) {
        return `
          <div class="wallet-history-row">
            <span class="material-symbols-rounded wh-icon ${h.kept ? 'kept' : (h.amount < 0 ? 'out' : 'in')}">${h.icon || (h.amount < 0 ? 'north_east' : 'south_west')}</span>
            <div class="wallet-list-info">
              <strong>${escapeHtml(h.title)}</strong>
              <small>${formatShortDate(h.date)}${h.sub ? ' · ' + escapeHtml(h.sub) : ''}</small>
            </div>
            <strong class="${h.kept ? 'wh-kept' : (h.amount < 0 ? 'text-danger' : 'text-success')}">${h.kept ? '' : (h.amount < 0 ? '−' : '+')}${formatRupiah(Math.abs(h.amount))}</strong>
            ${h.moveId ? `<button type="button" class="icon-btn danger" data-move-delete="${h.moveId}" data-wallet="${id}" title="Hapus">
              <span class="material-symbols-rounded">delete</span></button>` : ''}
          </div>
        `;
      }).join('') : '<p class="empty-state">Belum ada catatan di dompet ini.</p>'}
    </div>
    <div class="button-row">
      <button type="button" class="btn btn-secondary" data-wallet-manage>
        <span class="material-symbols-rounded">arrow_back</span> Semua dompet
      </button>
    </div>
  `;
  openWalletModal();
}

// --- c) Tambah / ubah dompet ---
function showWalletForm(id) {
  const w = id ? findWallet(id) : null;
  const brand = w ? w.brand : 'tunai';

  walletModalTitle.textContent = w ? 'Ubah Dompet' : 'Tambah Dompet';
  walletModalBody.innerHTML = `
    <form id="wallet-form" data-id="${w ? w.id : ''}" novalidate>
      <div class="brand-grid">
        ${WALLET_BRAND_ORDER.map(function (key) {
          const b = WALLET_BRANDS[key];
          return `
            <button type="button" class="brand-option ${key === brand ? 'active' : ''}" data-brand="${key}" style="--wc:${b.color}">
              ${walletBadgeHtml({ brand: key }, 'small')}
              <span>${b.label}</span>
            </button>
          `;
        }).join('')}
      </div>
      <input type="hidden" id="wf-brand" value="${brand}">
      <div class="form-grid">
        <div class="field field-full">
          <label for="wf-name">Nama</label>
          <input type="text" id="wf-name" maxlength="24" value="${escapeHtml(w ? w.name : WALLET_BRANDS[brand].label)}">
        </div>
        <div class="field field-full">
          <label for="wf-initial">${w ? 'Saldo awal' : 'Saldo sekarang'}</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="wf-initial" inputmode="numeric" step="1" placeholder="0" value="${w ? (w.initial || '') : ''}">
          </div>
          <small class="field-hint">${w
            ? 'Saldo sebelum transaksi pertama di dompet ini. Untuk mencocokkan saldo sekarang, pakai "Sesuaikan".'
            : 'Isi saldo yang ada saat ini (lihat di aplikasi bank / e-wallet).'}</small>
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">check</span> Simpan</button>
        ${w && appData.wallets.length > 1 ? `<button type="button" class="btn btn-danger" data-wallet-delete="${w.id}">
          <span class="material-symbols-rounded">delete</span> Hapus</button>` : ''}
      </div>
    </form>
  `;
  openWalletModal();
}

function saveWalletForm(form) {
  const name = document.getElementById('wf-name').value.trim();
  const brand = document.getElementById('wf-brand').value;
  const initial = Math.round(Number(document.getElementById('wf-initial').value) || 0);
  if (!name) { showToast('Isi nama dompet'); return; }

  let id = form.dataset.id;
  if (id) {
    Object.assign(findWallet(id), { name: name, brand: brand, initial: initial });
    showToast('Dompet diperbarui');
  } else {
    id = 'w-' + generateId();
    appData.wallets.push({ id: id, name: name, brand: brand, initial: initial, createdAt: new Date().toISOString() });
    showToast(name + ' ditambahkan');
  }
  afterWalletChange();
  showWalletDetail(id);
}

// --- d) Hapus (gabungkan ke dompet lain jika sudah dipakai) ---
function walletIsUsed(id) {
  return appData.transactions.some(function (tx) { return txWalletId(tx) === id; }) ||
         appData.walletMoves.some(function (m) { return m.from === id || m.to === id || m.walletId === id; });
}

function showWalletDelete(id) {
  const w = findWallet(id);
  if (!w) return;

  if (!walletIsUsed(id) && !(w.initial)) {
    if (!confirm('Hapus dompet "' + w.name + '"?')) return;
    removeWallet(id, null);
    return;
  }

  walletModalTitle.textContent = 'Hapus ' + w.name;
  walletModalBody.innerHTML = `
    <p class="card-text">Dompet ini sudah punya catatan. Semua catatannya akan <strong>dipindahkan</strong>
      ke dompet lain supaya total saldomu tidak berubah. Pilih tujuannya:</p>
    <input type="hidden" id="wd-target" value="">
    ${walletPickerHtml('wd-target', '', id)}
    <div class="button-row">
      <button type="button" class="btn btn-danger" data-wallet-merge="${id}">
        <span class="material-symbols-rounded">delete</span> Pindahkan &amp; Hapus
      </button>
      <button type="button" class="btn btn-secondary" data-wallet-open="${id}">Batal</button>
    </div>
  `;
}

function removeWallet(id, targetId) {
  const w = findWallet(id);
  if (targetId) {
    const target = findWallet(targetId);
    target.initial = (target.initial || 0) + (w.initial || 0);
    appData.transactions.forEach(function (tx) { if (txWalletId(tx) === id) tx.walletId = targetId; });
    appData.walletMoves.forEach(function (m) {
      if (m.from === id) m.from = targetId;
      if (m.to === id) m.to = targetId;
      if (m.walletId === id) m.walletId = targetId;
    });
    // Tombol kilat & lokasi tabungan ikut pindah ke dompet tujuan
    (appData.quickTemplates || []).forEach(function (t) { if (t.walletId === id) t.walletId = targetId; });
    const loc = appData.settings.fundWallet || {};
    Object.keys(loc).forEach(function (k) { if (loc[k] === id) loc[k] = targetId; });
    // Pindah uang ke dirinya sendiri tidak berarti apa-apa lagi
    appData.walletMoves = appData.walletMoves.filter(function (m) { return !(m.kind === 'transfer' && m.from === m.to); });
  }

  appData.wallets = appData.wallets.filter(function (x) { return x.id !== id; });
  if (appData.settings.defaultWalletId === id) appData.settings.defaultWalletId = targetId || appData.wallets[0].id;
  if (appData.settings.incomeWalletId === id) appData.settings.incomeWalletId = targetId || appData.settings.defaultWalletId;

  afterWalletChange();
  showToast('Dompet "' + w.name + '" dihapus');
  showWalletManager();
}

// --- e) Pindah uang ---
function showTransferForm(fromId) {
  if (appData.wallets.length < 2) {
    showToast('Tambahkan minimal 2 dompet dulu');
    showWalletForm(null);
    return;
  }
  const from = fromId && findWallet(fromId) ? fromId : getDefaultWalletId();
  const to = appData.wallets.find(function (w) { return w.id !== from; }).id;

  walletModalTitle.textContent = 'Pindah Uang';
  walletModalBody.innerHTML = `
    <p class="card-text">Tarik tunai, top up e-wallet, atau setor tunai. Tidak dihitung sebagai pengeluaran.</p>
    <form id="transfer-form" novalidate>
      <div class="field field-full transfer-field">
        <label>Dari</label>
        <input type="hidden" id="tf-from" value="${from}">
        <div id="tf-from-picker">${walletPickerHtml('tf-from', from)}</div>
      </div>
      <div class="transfer-arrow"><span class="material-symbols-rounded">south</span></div>
      <div class="field field-full transfer-field">
        <label>Ke</label>
        <input type="hidden" id="tf-to" value="${to}">
        <div id="tf-to-picker">${walletPickerHtml('tf-to', to)}</div>
      </div>
      <div class="form-grid">
        <div class="field">
          <label for="tf-amount">Nominal</label>
          <div class="input-prefix"><span>Rp</span>
            <input type="number" id="tf-amount" inputmode="numeric" min="1" step="1" placeholder="0"></div>
        </div>
        <div class="field">
          <label for="tf-fee">Biaya admin <span class="optional">(jika ada)</span></label>
          <div class="input-prefix"><span>Rp</span>
            <input type="number" id="tf-fee" inputmode="numeric" min="0" step="1" placeholder="0"></div>
        </div>
        <div class="field">
          <label for="tf-date">Tanggal</label>
          <input type="date" id="tf-date" value="${todayString()}">
        </div>
        <div class="field">
          <label for="tf-note">Catatan <span class="optional">(opsional)</span></label>
          <input type="text" id="tf-note" maxlength="40" placeholder="Contoh: Tarik tunai ATM">
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">swap_horiz</span> Pindahkan</button>
      </div>
    </form>
  `;
  openWalletModal();
}

function saveTransferForm() {
  const from = document.getElementById('tf-from').value;
  const to = document.getElementById('tf-to').value;
  const amount = Math.round(Number(document.getElementById('tf-amount').value));
  const fee = Math.max(0, Math.round(Number(document.getElementById('tf-fee').value) || 0));
  const date = document.getElementById('tf-date').value || todayString();
  const note = document.getElementById('tf-note').value.trim();

  if (from === to) { showToast('Dompet asal dan tujuan harus berbeda'); return; }
  if (!amount || amount <= 0) { showToast('Isi nominal'); return; }

  const now = new Date().toISOString();
  const move = {
    id: generateId(), kind: 'transfer', from: from, to: to, amount: amount, fee: fee, feeTxId: null,
    date: date, time: currentTimeString(), note: note, createdAt: now
  };

  // Biaya admin dicatat sebagai pengeluaran dari dompet asal
  if (fee > 0) {
    const fx = {
      id: generateId(), createdAt: now, type: 'keluar', amount: fee, date: date, time: move.time,
      categoryId: findCategory('out-admin') ? 'out-admin' : 'out-lainnya',
      source: '', note: 'Biaya ' + walletName(from) + ' → ' + walletName(to), walletId: from, moveId: move.id
    };
    appData.transactions.push(fx);
    move.feeTxId = fx.id;
  }

  appData.walletMoves.push(move);
  afterWalletChange();
  closeWalletModal();
  showToast(formatRupiah(amount) + ' dipindah: ' + walletName(from) + ' → ' + walletName(to));
}

// --- f) Sesuaikan saldo ---
function showAdjustForm(id) {
  const w = findWallet(id);
  const current = walletRealBalance(id);

  walletModalTitle.textContent = 'Sesuaikan Saldo ' + w.name;
  walletModalBody.innerHTML = `
    <p class="card-text">Saldo di MyMoney beda dengan saldo asli? Ketik saldo sebenarnya, selisihnya dicatat sebagai penyesuaian
      (tidak masuk laporan pemasukan/pengeluaran).</p>
    <form id="adjust-form" data-id="${id}" novalidate>
      <div class="adjust-compare">
        <div><span>Di MyMoney</span><strong>${signedRupiah(current)}</strong></div>
        <div><span>Selisih</span><strong id="af-diff">–</strong></div>
      </div>
      <div class="field field-full">
        <label for="af-real">Saldo sebenarnya sekarang</label>
        <div class="input-prefix"><span>Rp</span>
          <input type="number" id="af-real" inputmode="numeric" step="1" placeholder="0" data-current="${current}"></div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary"><span class="material-symbols-rounded">check</span> Sesuaikan</button>
        <button type="button" class="btn btn-secondary" data-wallet-open="${id}">Batal</button>
      </div>
    </form>
  `;
  openWalletModal();
  setTimeout(function () { const i = document.getElementById('af-real'); if (i && window.innerWidth > 768) i.focus(); }, 60);
}

function saveAdjustForm(form) {
  const id = form.dataset.id;
  const realText = document.getElementById('af-real').value;
  if (realText === '') { showToast('Isi saldo sebenarnya'); return; }
  const diff = Math.round(Number(realText)) - walletRealBalance(id);
  if (diff === 0) { showToast('Saldo sudah cocok 👍'); showWalletDetail(id); return; }

  appData.walletMoves.push({
    id: generateId(), kind: 'adjust', walletId: id, amount: diff,
    date: todayString(), time: currentTimeString(), note: diff > 0 ? 'Saldo ternyata lebih' : 'Saldo ternyata kurang',
    createdAt: new Date().toISOString()
  });
  afterWalletChange();
  showToast('Saldo ' + walletName(id) + ' disesuaikan (' + (diff > 0 ? '+' : '−') + formatRupiah(Math.abs(diff)) + ')');
  showWalletDetail(id);
}

function deleteMove(moveId, walletId) {
  const m = appData.walletMoves.find(function (x) { return x.id === moveId; });
  if (!m) return;
  const label = m.kind === 'transfer' ? 'pindah uang ' + formatRupiah(m.amount) : 'penyesuaian saldo';
  if (!confirm('Hapus catatan ' + label + '?')) return;

  appData.walletMoves = appData.walletMoves.filter(function (x) { return x.id !== moveId; });
  if (m.feeTxId) appData.transactions = appData.transactions.filter(function (tx) { return tx.id !== m.feeTxId; });
  afterWalletChange();
  showWalletDetail(walletId);
}


// ===== MENGHUBUNGKAN TOMBOL =====
function handleWalletClick(event) {
  const t = event.target;
  const el = function (sel) { return t.closest(sel); };
  let b;

  if (el('[data-wallet-close]')) { closeWalletModal(); return true; }
  if ((b = el('[data-wallet-open]'))) { showWalletDetail(b.dataset.walletOpen); return true; }
  if (el('[data-wallet-manage]')) { showWalletManager(); return true; }
  if (el('[data-wallet-add]')) { showWalletForm(null); return true; }
  if ((b = el('[data-wallet-transfer]'))) { showTransferForm(b.dataset.walletTransfer); return true; }
  if ((b = el('[data-wallet-adjust]'))) { showAdjustForm(b.dataset.walletAdjust); return true; }
  if ((b = el('[data-wallet-edit]'))) { showWalletForm(b.dataset.walletEdit); return true; }
  if ((b = el('[data-wallet-delete]'))) { showWalletDelete(b.dataset.walletDelete); return true; }
  if ((b = el('[data-wallet-default]'))) {
    appData.settings.defaultWalletId = b.dataset.walletDefault;
    afterWalletChange();
    showToast(walletName(b.dataset.walletDefault) + ' jadi dompet utama');
    showWalletDetail(b.dataset.walletDefault);
    return true;
  }
  if ((b = el('[data-wallet-merge]'))) {
    const target = document.getElementById('wd-target').value;
    if (!target) { showToast('Pilih dompet tujuan'); return true; }
    removeWallet(b.dataset.walletMerge, target);
    return true;
  }
  if ((b = el('[data-move-delete]'))) { deleteMove(b.dataset.moveDelete, b.dataset.wallet); return true; }
  return false;
}

walletModal.addEventListener('click', function (event) {
  const brand = event.target.closest('[data-brand]');
  if (brand) {
    const nameInput = document.getElementById('wf-name');
    const oldBrand = document.getElementById('wf-brand').value;
    // Ganti nama otomatis jika nama masih bawaan merek sebelumnya
    if (!nameInput.value.trim() || nameInput.value === WALLET_BRANDS[oldBrand].label) {
      nameInput.value = WALLET_BRANDS[brand.dataset.brand].label;
    }
    document.getElementById('wf-brand').value = brand.dataset.brand;
    walletModal.querySelectorAll('.brand-option').forEach(function (o) { o.classList.toggle('active', o === brand); });
    return;
  }
  handleWalletClick(event);
});

walletModal.addEventListener('submit', function (event) {
  event.preventDefault();
  if (event.target.id === 'wallet-form') saveWalletForm(event.target);
  if (event.target.id === 'transfer-form') saveTransferForm();
  if (event.target.id === 'adjust-form') saveAdjustForm(event.target);
});

walletModal.addEventListener('change', function (event) {
  const select = event.target.closest('[data-fund-loc]');
  if (!select) return;
  appData.settings.fundWallet = appData.settings.fundWallet || {};
  appData.settings.fundWallet[select.dataset.fundLoc] = select.value || null;
  afterWalletChange();
  showWalletManager();
  showToast(FUND_INFO[select.dataset.fundLoc].label + (select.value ? ' disimpan di ' + walletName(select.value) : ' dipisah dari dompet'));
});

walletModal.addEventListener('input', function (event) {
  if (event.target.id !== 'af-real') return;
  const diff = Math.round(Number(event.target.value)) - Number(event.target.dataset.current);
  document.getElementById('af-diff').innerHTML = event.target.value === ''
    ? '–'
    : `<span class="${diff < 0 ? 'text-danger' : 'text-success'}">${diff < 0 ? '−' : '+'}${formatRupiah(Math.abs(diff))}</span>`;
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && walletModal.classList.contains('open')) closeWalletModal();
});

document.getElementById('page-dashboard').addEventListener('click', function (event) {
  if (event.target.closest('#dash-wallets')) handleWalletClick(event);
});
