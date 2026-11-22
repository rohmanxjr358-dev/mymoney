// =====================================================
// FAB.JS — Tombol ➕ melayang: SATU-SATUNYA form untuk
//          mencatat DAN mengubah transaksi
// =====================================================

const fabButton = document.getElementById('fab');
const fabModal = document.getElementById('fab-modal');
const fabBody = document.getElementById('fab-body');
const fabTitle = document.getElementById('fab-title');

// Isian form yang sedang dibuka
let fabDraft = null;


// Kategori yang paling sering dipakai muncul duluan
function popularCategories(type, limit) {
  const count = {};
  appData.transactions.forEach(function (tx) {
    if (tx.type === type) count[tx.categoryId] = (count[tx.categoryId] || 0) + 1;
  });
  return getCategories(type)
    .filter(function (c) { return !c.fund; })
    .map(function (c, i) { return { cat: c, n: count[c.id] || 0, i: i }; })
    .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
    .slice(0, limit)
    .map(function (x) { return x.cat; });
}

function newFabDraft(type) {
  return {
    editId: null, type: type || 'keluar', amount: '', categoryId: '', note: '', source: '',
    date: todayString(), time: '', walletId: type === 'masuk' ? getIncomeWalletId() : getDefaultWalletId()
  };
}

// Simpan isian yang sedang diketik sebelum form digambar ulang
function readFabInputs() {
  if (!fabDraft || !document.getElementById('fab-amount')) return;
  fabDraft.amount = document.getElementById('fab-amount').value;
  fabDraft.categoryId = document.getElementById('fab-category').value;
  fabDraft.walletId = document.getElementById('fab-wallet').value;
  fabDraft.date = document.getElementById('fab-date').value;
  fabDraft.note = document.getElementById('fab-note').value;
  const source = document.getElementById('fab-source');
  if (source) fabDraft.source = source.value;
}

function renderFabForm() {
  const d = fabDraft;
  const editing = Boolean(d.editId);
  const chips = popularCategories(d.type, 8);
  if (d.categoryId && !chips.some(function (c) { return c.id === d.categoryId; })) {
    const selected = findCategory(d.categoryId);
    if (selected && selected.type === d.type) chips.splice(7, 1, selected);
  }

  fabTitle.textContent = editing ? 'Ubah Transaksi' : 'Catat';
  fabBody.innerHTML = `
    <div class="segmented fab-type ${editing ? 'two' : ''}">
      <button type="button" class="segmented-btn ${d.type === 'keluar' ? 'active' : ''}" data-fab-type="keluar">
        <span class="material-symbols-rounded">north_east</span> Keluar</button>
      <button type="button" class="segmented-btn ${d.type === 'masuk' ? 'active' : ''}" data-fab-type="masuk">
        <span class="material-symbols-rounded">south_west</span> Masuk</button>
      ${editing ? '' : `<button type="button" class="segmented-btn" data-fab-type="pindah">
        <span class="material-symbols-rounded">swap_horiz</span> Pindah</button>`}
    </div>

    <form id="fab-form" novalidate>
      <label class="fab-amount ${d.type}">
        <span>Rp</span>
        <input type="number" id="fab-amount" inputmode="numeric" min="1" step="1" placeholder="0" aria-label="Nominal" value="${d.amount}">
      </label>
      <div class="fab-preview" id="fab-preview">${Number(d.amount) ? formatRupiah(Number(d.amount)) : 'Ketik nominal'}</div>

      <div class="fab-label">Kategori</div>
      <input type="hidden" id="fab-category" value="${d.categoryId}">
      <div class="fab-cats">
        ${chips.map(function (c) {
          return `<button type="button" class="fab-cat ${c.id === d.categoryId ? 'active' : ''}" data-fab-cat="${c.id}">
            <span>${categoryEmoji(c.id)}</span><small>${escapeHtml(c.name)}</small></button>`;
        }).join('')}
      </div>
      <select id="fab-category-more" class="fab-more" aria-label="Kategori lain">
        <option value="">Kategori lain…</option>
        ${categoryOptionsHtml(d.type, chips.some(function (c) { return c.id === d.categoryId; }) ? '' : d.categoryId)}
        <option value="__baru">＋ Buat kategori baru…</option>
      </select>

      <div class="fab-label">${d.type === 'masuk' ? 'Masuk ke' : 'Bayar pakai'}</div>
      <input type="hidden" id="fab-wallet" value="${d.walletId}">
      ${walletPickerHtml('fab-wallet', d.walletId)}

      <div class="fab-extra">
        <input type="date" id="fab-date" value="${d.date}" aria-label="Tanggal">
        <input type="text" id="fab-note" maxlength="60" placeholder="Catatan (opsional)" aria-label="Catatan" value="${escapeHtml(d.note)}">
        ${d.type === 'masuk' ? `<input type="text" id="fab-source" class="fab-source" maxlength="40"
          placeholder="Dari siapa / sumber (opsional)" aria-label="Sumber" value="${escapeHtml(d.source)}">` : ''}
      </div>

      <button type="submit" class="btn btn-primary btn-block fab-save">
        <span class="material-symbols-rounded">check</span> ${editing ? 'Simpan Perubahan' : 'Simpan'}
      </button>
      ${editing ? `<button type="button" class="btn btn-danger btn-block fab-delete" data-fab-delete>
        <span class="material-symbols-rounded">delete</span> Hapus Transaksi</button>` : ''}
    </form>
  `;
}

// options: { type } | { editId } | { template }
function openFab(options) {
  options = options || {};

  if (options.editId) {
    const tx = findTransaction(options.editId);
    if (!tx) return;

    // Uang bulanan diubah lewat menunya sendiri supaya periodenya ikut benar
    if (appData.periods.some(function (p) { return p.transactionId === tx.id; })) {
      showToast('Ubah uang bulanan lewat menu Uang Bulanan');
      showPage('bulanan');
      if (typeof renderBulanan === 'function') renderBulanan();
      return;
    }

    fabDraft = {
      editId: tx.id, type: tx.type, amount: tx.amount, categoryId: tx.categoryId, note: tx.note || '',
      source: tx.source || '', date: tx.date, time: tx.time, walletId: txWalletId(tx)
    };
  } else if (options.template) {
    const t = options.template;
    fabDraft = newFabDraft('keluar');
    fabDraft.amount = t.amount;
    fabDraft.categoryId = t.categoryId;
    if (t.walletId && findWallet(t.walletId)) fabDraft.walletId = t.walletId;
  } else {
    fabDraft = newFabDraft(options.type);
  }

  renderFabForm();
  fabModal.classList.add('open');
  fabButton.classList.add('open');

  const amount = document.getElementById('fab-amount');
  if (options.template) { amount.focus(); amount.select(); showToast('Ubah nominalnya, lalu Simpan'); }
  else if (window.innerWidth > 768) setTimeout(function () { amount.focus(); }, 80);
}

function closeFab() {
  fabModal.classList.remove('open');
  fabButton.classList.remove('open');
}

function selectFabCategory(id) {
  document.getElementById('fab-category').value = id;
  fabBody.querySelectorAll('.fab-cat').forEach(function (b) { b.classList.toggle('active', b.dataset.fabCat === id); });
  const more = document.getElementById('fab-category-more');
  more.value = fabBody.querySelector('[data-fab-cat="' + id + '"]') ? '' : id;
}

function afterFabChange() {
  refreshAfterTransactionChange();
  if (document.getElementById('page-transaksi').classList.contains('active')) renderHistory();
  if (document.getElementById('page-laporan').classList.contains('active')) renderLaporan();
}

function saveFab() {
  readFabInputs();
  const d = fabDraft;
  const amount = Math.round(Number(d.amount));
  if (!amount || amount <= 0) { showToast('Isi nominal'); document.getElementById('fab-amount').focus(); return; }
  if (!d.categoryId) { showToast('Pilih kategori'); return; }
  if (!confirmAmount(amount) || !confirmFutureDate(d.date)) return;

  const data = {
    type: d.type,
    amount: amount,
    date: d.date || todayString(),
    categoryId: d.categoryId,
    source: d.type === 'masuk' ? (d.source || '').trim() : '',
    note: (d.note || '').trim(),
    walletId: d.walletId || getDefaultWalletId()
  };

  const cat = findCategory(d.categoryId);
  const label = categoryEmoji(d.categoryId) + ' <strong>' + escapeHtml(cat ? cat.name : '') + ' ' +
    (d.type === 'masuk' ? '+' : '−') + formatRupiah(amount) + '</strong>';

  if (d.editId) {
    const tx = findTransaction(d.editId);
    Object.assign(tx, data, { updatedAt: new Date().toISOString() });
    saveData();
    closeFab();
    afterFabChange();
    showToast('Perubahan disimpan');
    return;
  }

  const tx = Object.assign({ id: generateId(), createdAt: new Date().toISOString(), time: currentTimeString() }, data);
  appData.transactions.push(tx);
  saveData();
  closeFab();
  afterFabChange();

  showSnack(label + ' tercatat', 'Batalkan', function () {
    appData.transactions = appData.transactions.filter(function (item) { return item.id !== tx.id; });
    saveData();
    afterFabChange();
    showToast('Dibatalkan');
  });
}


// ===== MENGHUBUNGKAN TOMBOL =====
fabButton.addEventListener('click', function () {
  if (fabModal.classList.contains('open')) closeFab();
  else openFab();
});

fabModal.addEventListener('click', function (event) {
  if (event.target.closest('[data-fab-close]')) { closeFab(); return; }

  if (event.target.closest('[data-fab-delete]')) {
    const id = fabDraft.editId;
    const before = appData.transactions.length;
    deleteTransaction(id);   // meminta konfirmasi dulu
    if (appData.transactions.length < before) { closeFab(); afterFabChange(); }
    return;
  }

  const typeButton = event.target.closest('[data-fab-type]');
  if (typeButton) {
    if (typeButton.dataset.fabType === 'pindah') {
      closeFab();
      showTransferForm();
      return;
    }
    readFabInputs();
    if (fabDraft.type !== typeButton.dataset.fabType) {
      fabDraft.type = typeButton.dataset.fabType;
      fabDraft.categoryId = '';
      if (!fabDraft.editId) fabDraft.walletId = fabDraft.type === 'masuk' ? getIncomeWalletId() : getDefaultWalletId();
    }
    renderFabForm();
    return;
  }

  const cat = event.target.closest('[data-fab-cat]');
  if (cat) selectFabCategory(cat.dataset.fabCat);
});

fabModal.addEventListener('change', function (event) {
  if (event.target.id !== 'fab-category-more' || !event.target.value) return;
  if (event.target.value === '__baru') { createFabCategory(); return; }
  selectFabCategory(event.target.value);
});

// Buat kategori baru langsung dari form ➕
function createFabCategory() {
  readFabInputs();
  const input = prompt('Nama kategori baru (' + (fabDraft.type === 'masuk' ? 'uang masuk' : 'uang keluar') + '):');
  const name = input ? input.trim() : '';
  if (!name) { renderFabForm(); return; }

  const existing = appData.categories.find(function (c) {
    return c.type === fabDraft.type && c.name.toLowerCase() === name.toLowerCase();
  });
  if (existing) {
    fabDraft.categoryId = existing.id;
    showToast('Kategori sudah ada, langsung dipilih');
  } else {
    const category = {
      id: generateId(), name: name, type: fabDraft.type,
      group: fabDraft.type === 'masuk' ? 'Pemasukan' : 'Kategori Saya', fund: null, isDefault: false
    };
    appData.categories.push(category);
    saveData();
    fabDraft.categoryId = category.id;
    showToast('Kategori "' + name + '" dibuat');
  }
  renderFabForm();
}

fabModal.addEventListener('input', function (event) {
  if (event.target.id !== 'fab-amount') return;
  const value = Number(event.target.value);
  document.getElementById('fab-preview').textContent = value ? formatRupiah(value) : 'Ketik nominal';
});

fabModal.addEventListener('submit', function (event) {
  event.preventDefault();
  saveFab();
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && fabModal.classList.contains('open')) closeFab();
});
