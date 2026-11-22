// =====================================================
// TAGIHAN.JS — Tagihan & pengeluaran rutin
// =====================================================
//
// appData.bills = daftar tagihan rutin:
//   { id, name, amount, dueDay, categoryId, remindDays, active, note, startMonth }
//
// Pembayaran TIDAK disimpan terpisah: tagihan dianggap lunas jika ada
// transaksi uang keluar dengan billId & billMonth yang cocok.
// Jika transaksi itu dihapus, tagihan otomatis kembali "belum dibayar".

if (!Array.isArray(appData.bills)) appData.bills = [];

const billMonthCard = document.getElementById('bill-month');
const billListCard = document.getElementById('bill-list');
const billReminder = document.getElementById('bill-reminder');
const billModal = document.getElementById('bill-modal');
const billModalTitle = document.getElementById('bill-modal-title');
const billModalBody = document.getElementById('bill-modal-body');

// Bulan yang sedang dilihat (default: bulan ini)
let billViewYear = new Date().getFullYear();
let billViewMonth = new Date().getMonth();   // 0 = Januari


// ===== ALAT BANTU BULAN =====
function monthKey(year, monthIndex) {
  const d = new Date(year, monthIndex, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function currentMonthKey() {
  const now = new Date();
  return monthKey(now.getFullYear(), now.getMonth());
}

function monthLabel(key) {
  return formatMonthYear(key + '-01');
}

function keyToYearMonth(key) {
  const parts = key.split('-');
  return { year: Number(parts[0]), month: Number(parts[1]) - 1 };
}

function findBill(id) {
  return appData.bills.find(function (b) { return b.id === id; }) || null;
}


// ===== STATUS TAGIHAN PADA SUATU BULAN =====
function getBillPayment(bill, key) {
  return appData.transactions.find(function (tx) {
    return tx.billId === bill.id && tx.billMonth === key;
  }) || null;
}

function isBillSettled(bill, key) {
  return Array.isArray(bill.settled) && bill.settled.includes(key);
}

function setBillSettled(bill, key, on) {
  const list = Array.isArray(bill.settled) ? bill.settled.filter(function (k) { return k !== key; }) : [];
  if (on) list.push(key);
  bill.settled = list;
}

function getBillStatus(bill, key) {
  const ym = keyToYearMonth(key);
  const dueDate = makeDate(ym.year, ym.month, bill.dueDay);
  const payment = getBillPayment(bill, key);

  if (payment) {
    return { code: 'lunas', label: 'Lunas', cls: 'ok', dueDate: dueDate, payment: payment };
  }
  // Ditandai lunas tanpa transaksi (dibayar sebelum mulai mencatat)
  if (isBillSettled(bill, key)) {
    return { code: 'lunas', label: 'Lunas', cls: 'ok', dueDate: dueDate, settled: true };
  }

  const diff = daysBetween(todayString(), dueDate);   // negatif = sudah lewat
  if (diff < 0) return { code: 'terlambat', label: 'Terlambat ' + Math.abs(diff) + ' hari', cls: 'over', dueDate: dueDate };
  if (diff === 0) return { code: 'hariini', label: 'Jatuh tempo hari ini', cls: 'late', dueDate: dueDate };
  if (diff <= (bill.remindDays || 0)) return { code: 'segera', label: diff + ' hari lagi', cls: 'late', dueDate: dueDate };
  return { code: 'belum', label: diff + ' hari lagi', cls: 'neutral', dueDate: dueDate };
}

// Tagihan yang berlaku pada suatu bulan (aktif & sudah dimulai)
function getBillsForMonth(key) {
  return appData.bills.filter(function (bill) {
    return bill.active !== false && bill.startMonth <= key;
  }).sort(function (a, b) { return a.dueDay - b.dueDay; });
}


// ===== PENGINGAT (banner di atas semua halaman) =====
function getBillReminders() {
  const thisMonth = currentMonthKey();
  const now = new Date();
  const lastMonth = monthKey(now.getFullYear(), now.getMonth() - 1);
  const reminders = [];

  [lastMonth, thisMonth].forEach(function (key) {
    getBillsForMonth(key).forEach(function (bill) {
      const status = getBillStatus(bill, key);
      if (['terlambat', 'hariini', 'segera'].includes(status.code)) {
        reminders.push({ bill: bill, key: key, status: status });
      }
    });
  });
  return reminders;
}

function renderBillReminder() {
  const reminders = getBillReminders();

  billReminder.innerHTML = reminders.map(function (r) {
    const overdue = r.status.code === 'terlambat';
    return `
      <div class="reminder-item ${overdue ? 'overdue' : ''}">
        <span class="material-symbols-rounded">${overdue ? 'error' : 'notifications_active'}</span>
        <div class="reminder-text">
          <strong>${escapeHtml(r.bill.name)} ${formatRupiah(r.bill.amount)}</strong>
          — ${r.status.label.toLowerCase()} (${formatShortDate(r.status.dueDate)})
        </div>
        <button type="button" class="link-btn" data-bill-goto="${r.key}">Lihat</button>
      </div>
    `;
  }).join('');

  // Titik merah di menu Tagihan & tombol Lainnya
  const hasAlert = reminders.length > 0;
  document.querySelectorAll('[data-page="tagihan"], #more-button').forEach(function (el) {
    el.classList.toggle('has-alert', hasAlert);
  });
}


// ===== KARTU "TAGIHAN BULAN ..." =====
function renderBillMonth() {
  const key = monthKey(billViewYear, billViewMonth);
  const bills = getBillsForMonth(key);

  let total = 0;
  let paid = 0;

  const rows = bills.map(function (bill) {
    const status = getBillStatus(bill, key);
    const amount = status.payment ? status.payment.amount : bill.amount;
    total += amount;
    if (status.code === 'lunas') paid += amount;

    const category = findCategory(bill.categoryId);
    const action = status.settled
      ? `<button type="button" class="btn btn-secondary btn-sm" data-bill-unsettle="${bill.id}">
           <span class="material-symbols-rounded">undo</span> Batalkan
         </button>`
      : status.payment
      ? `<button type="button" class="btn btn-secondary btn-sm" data-bill-unpay="${status.payment.id}">
           <span class="material-symbols-rounded">undo</span> Batalkan
         </button>`
      : `<button type="button" class="btn btn-primary btn-sm" data-bill-pay="${bill.id}">
           <span class="material-symbols-rounded">payments</span> Bayar
         </button>`;

    return `
      <div class="bill-row">
        <div class="tx-icon ${status.code === 'lunas' ? 'masuk' : (status.cls === 'over' ? 'keluar' : 'sisih')}">
          <span class="material-symbols-rounded">${status.code === 'lunas' ? 'task_alt' : 'event'}</span>
        </div>
        <div class="tx-info">
          <div class="tx-category">${escapeHtml(bill.name)}</div>
          <div class="tx-meta">
            Jatuh tempo ${formatShortDate(status.dueDate)}
            ${category ? ' · ' + escapeHtml(category.name) : ''}
          </div>
          <div class="bill-status-line">
            <span class="status-badge ${status.cls}">${status.label}</span>
            ${status.payment ? `<span class="bill-paid-on">dibayar ${formatShortDate(status.payment.date)}</span>` : ''}
            ${status.settled ? '<span class="bill-paid-on">sudah dibayar sebelumnya</span>' : ''}
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">${formatRupiah(amount)}</div>
          ${action}
        </div>
      </div>
    `;
  }).join('');

  billMonthCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Tagihan ${monthLabel(key)}</h2>
      <div class="month-nav">
        <button type="button" class="icon-btn" data-bill-month="-1" title="Bulan sebelumnya">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>
        <button type="button" class="icon-btn" data-bill-month="0" title="Bulan ini">
          <span class="material-symbols-rounded">today</span>
        </button>
        <button type="button" class="icon-btn" data-bill-month="1" title="Bulan berikutnya">
          <span class="material-symbols-rounded">chevron_right</span>
        </button>
      </div>
    </div>

    <div class="stat-grid three">
      <div class="stat"><span>Total tagihan</span><strong>${formatRupiah(total)}</strong></div>
      <div class="stat"><span>Sudah dibayar</span><strong class="text-success">${formatRupiah(paid)}</strong></div>
      <div class="stat"><span>Belum dibayar</span><strong class="${total - paid > 0 ? 'text-danger' : ''}">${formatRupiah(total - paid)}</strong></div>
    </div>

    <div class="bill-rows">
      ${rows || '<p class="empty-state">Tidak ada tagihan untuk bulan ini.</p>'}
    </div>
  `;
}


// ===== KARTU "DAFTAR TAGIHAN RUTIN" =====
function renderBillList() {
  const items = appData.bills.slice().sort(function (a, b) { return a.dueDay - b.dueDay; });

  const rows = items.map(function (bill) {
    return `
      <div class="tx-item">
        <div class="tx-icon ${bill.active === false ? '' : 'sisih'}">
          <span class="material-symbols-rounded">${bill.active === false ? 'pause_circle' : 'event_repeat'}</span>
        </div>
        <div class="tx-info">
          <div class="tx-category">${escapeHtml(bill.name)}${bill.active === false ? ' <span class="tx-badge">Nonaktif</span>' : ''}</div>
          <div class="tx-meta">
            Setiap tanggal ${bill.dueDay} · ingatkan ${bill.remindDays} hari sebelumnya
          </div>
          ${bill.note ? `<div class="tx-note">${escapeHtml(bill.note)}</div>` : ''}
        </div>
        <div class="tx-right">
          <div class="tx-amount">${formatRupiah(bill.amount)}</div>
          <div class="tx-actions">
            <button type="button" class="icon-btn" data-bill-edit="${bill.id}" title="Edit">
              <span class="material-symbols-rounded">edit</span>
            </button>
            <button type="button" class="icon-btn danger" data-bill-delete="${bill.id}" title="Hapus">
              <span class="material-symbols-rounded">delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const hasIuran = appData.bills.some(function (b) { return b.categoryId === 'out-iuran'; });

  billListCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Daftar Tagihan Rutin</h2>
      <button type="button" class="link-btn" data-bill-new="">
        <span class="material-symbols-rounded">add</span> Tambah
      </button>
    </div>
    <div class="tx-list">
      ${rows || '<p class="empty-state">Belum ada tagihan rutin.</p>'}
    </div>
    ${hasIuran ? '' : `
      <div class="button-row">
        <button type="button" class="btn btn-primary" data-bill-new="iuran">
          <span class="material-symbols-rounded">home</span>
          Tambah Iuran Kontrakan Bulanan
        </button>
      </div>`}
  `;
}


// ===== TAMPILKAN SELURUH HALAMAN =====
function renderTagihan() {
  renderBillMonth();
  renderBillList();
  renderBillReminder();
}


// ===== JENDELA FORM =====
function closeBillModal() {
  billModal.classList.remove('open');
}

// Form tambah / edit tagihan rutin
function openBillForm(billId, preset) {
  const bill = billId ? findBill(billId) : null;
  const data = bill || {
    name: preset === 'iuran' ? 'Iuran Kontrakan Bulanan' : '',
    amount: '',
    dueDay: appData.settings.expectedTransferDay || 5,
    categoryId: preset === 'iuran' ? 'out-iuran' : '',
    remindDays: 3,
    note: preset === 'iuran' ? 'Wi-Fi, air, dan kebutuhan bersama' : '',
    active: true
  };

  const categoryOptions = getCategories('keluar')
    .filter(function (cat) { return !cat.fund; })
    .map(function (cat) {
      return `<option value="${cat.id}" ${cat.id === data.categoryId ? 'selected' : ''}>${escapeHtml(cat.name)}</option>`;
    }).join('');

  const remindOptions = [0, 1, 2, 3, 5, 7].map(function (n) {
    const label = n === 0 ? 'Hanya pada hari jatuh tempo' : n + ' hari sebelumnya';
    return `<option value="${n}" ${n === data.remindDays ? 'selected' : ''}>${label}</option>`;
  }).join('');

  billModalTitle.textContent = bill ? 'Edit Tagihan' : 'Tambah Tagihan';
  billModalBody.innerHTML = `
    <form id="bill-form" data-bill-id="${bill ? bill.id : ''}" novalidate>
      <div class="form-grid">
        <div class="field field-full">
          <label for="bill-name">Nama tagihan</label>
          <input type="text" id="bill-name" maxlength="40" value="${escapeHtml(data.name)}" placeholder="Contoh: Iuran Kontrakan Bulanan">
        </div>
        <div class="field field-full">
          <label for="bill-amount">Nominal</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="bill-amount" inputmode="numeric" min="1" step="1" placeholder="0" value="${data.amount || ''}">
          </div>
        </div>
        <div class="field">
          <label for="bill-due">Jatuh tempo tanggal</label>
          <input type="number" id="bill-due" inputmode="numeric" min="1" max="31" value="${data.dueDay}">
        </div>
        <div class="field">
          <label for="bill-category">Kategori</label>
          <select id="bill-category">
            <option value="">Pengeluaran Lainnya</option>
            ${categoryOptions}
          </select>
        </div>
        <div class="field field-full">
          <label for="bill-remind">Ingatkan</label>
          <select id="bill-remind">${remindOptions}</select>
        </div>
        <div class="field field-full">
          <label for="bill-note">Keterangan <span class="optional">(boleh dikosongkan)</span></label>
          <input type="text" id="bill-note" maxlength="100" value="${escapeHtml(data.note || '')}">
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" id="bill-active" ${data.active !== false ? 'checked' : ''}>
        Tagihan aktif
      </label>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">check</span> Simpan
        </button>
      </div>
    </form>
  `;
  billModal.classList.add('open');
}

// Form bayar tagihan
function openPayForm(billId, key) {
  const bill = findBill(billId);
  if (!bill) return;

  billModalTitle.textContent = 'Bayar ' + bill.name;
  billModalBody.innerHTML = `
    <form id="pay-form" data-bill-id="${bill.id}" data-month="${key}" novalidate>
      <p class="card-text">
        Tagihan ${monthLabel(key)}. Pembayaran otomatis dicatat sebagai uang keluar
        dan tidak memotong anggaran mingguan.
      </p>
      <div class="form-grid">
        <div class="field field-full">
          <label for="pay-amount">Nominal dibayar</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="pay-amount" inputmode="numeric" min="1" step="1" value="${bill.amount}">
          </div>
        </div>
        <div class="field">
          <label for="pay-date">Tanggal bayar</label>
          <input type="date" id="pay-date" value="${todayString()}">
        </div>
        <div class="field">
          <label for="pay-time">Jam</label>
          <input type="time" id="pay-time" value="${currentTimeString()}">
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">payments</span> Tandai Lunas
        </button>
      </div>
      <div class="bill-settle-box">
        <p>Sudah bayar <strong>sebelum mulai pakai MyMoney</strong>? Saldo dompetmu sudah terpotong, jadi cukup tandai lunas tanpa mencatat pengeluaran lagi.</p>
        <button type="button" class="btn btn-secondary btn-block" data-bill-settle="${bill.id}" data-month="${key}">
          <span class="material-symbols-rounded">task_alt</span> Sudah dibayar sebelumnya
        </button>
      </div>
    </form>
  `;
  billModal.classList.add('open');
}


// ===== SIMPAN TAGIHAN RUTIN =====
function saveBillForm(form) {
  const name = document.getElementById('bill-name').value.trim();
  const amount = toAmount(document.getElementById('bill-amount').value);
  const dueDay = Number(document.getElementById('bill-due').value);

  if (!name) { showToast('Isi nama tagihan'); return; }
  if (!amount) { showToast('Isi nominal tagihan'); return; }
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    showToast('Tanggal jatuh tempo harus 1 sampai 31');
    return;
  }

  const data = {
    name: name,
    amount: amount,
    dueDay: dueDay,
    categoryId: document.getElementById('bill-category').value || 'out-lainnya',
    remindDays: Number(document.getElementById('bill-remind').value),
    note: document.getElementById('bill-note').value.trim(),
    active: document.getElementById('bill-active').checked
  };

  const existing = findBill(form.dataset.billId);
  if (existing) {
    Object.assign(existing, data);
    showToast('Tagihan diperbarui');
  } else {
    appData.bills.push(Object.assign({
      id: generateId(),
      startMonth: currentMonthKey(),
      createdAt: new Date().toISOString()
    }, data));
    showToast('Tagihan "' + name + '" ditambahkan');
  }

  saveData();
  closeBillModal();
  renderTagihan();
}


// ===== SIMPAN PEMBAYARAN =====
function savePayForm(form) {
  const bill = findBill(form.dataset.billId);
  const key = form.dataset.month;
  const amount = toAmount(document.getElementById('pay-amount').value);
  const date = document.getElementById('pay-date').value;

  if (!amount) { showToast('Isi nominal pembayaran'); return; }
  if (!date) { showToast('Isi tanggal bayar'); return; }

  appData.transactions.push({
    id: generateId(),
    type: 'keluar',
    amount: amount,
    date: date,
    time: document.getElementById('pay-time').value || '00:00',
    categoryId: bill.categoryId || 'out-lainnya',
    source: '',
    note: bill.name + ' ' + monthLabel(key),
    billId: bill.id,
    billMonth: key,
    createdAt: new Date().toISOString()
  });

  saveData();
  closeBillModal();
  renderTagihan();
  renderRecentTransactions();
  updateBackupInfo();
  showToast(bill.name + ' ' + monthLabel(key) + ' lunas');
}


// ===== HAPUS TAGIHAN RUTIN =====
function deleteBill(id) {
  const bill = findBill(id);
  if (!bill) return;

  const ok = confirm(
    'Hapus tagihan "' + bill.name + '"?\n\n' +
    'Transaksi pembayaran yang sudah tercatat TIDAK ikut dihapus.'
  );
  if (!ok) return;

  appData.bills = appData.bills.filter(function (b) { return b.id !== id; });
  saveData();
  renderTagihan();
  showToast('Tagihan dihapus');
}


// ===== MENGHUBUNGKAN TOMBOL =====
billMonthCard.addEventListener('click', function (event) {
  const nav = event.target.closest('[data-bill-month]');
  if (nav) {
    const step = Number(nav.dataset.billMonth);
    if (step === 0) {
      billViewYear = new Date().getFullYear();
      billViewMonth = new Date().getMonth();
    } else {
      const d = new Date(billViewYear, billViewMonth + step, 1);
      billViewYear = d.getFullYear();
      billViewMonth = d.getMonth();
    }
    renderBillMonth();
    return;
  }

  const pay = event.target.closest('[data-bill-pay]');
  if (pay) {
    openPayForm(pay.dataset.billPay, monthKey(billViewYear, billViewMonth));
    return;
  }

  const unsettle = event.target.closest('[data-bill-unsettle]');
  if (unsettle) {
    const bill = findBill(unsettle.dataset.billUnsettle);
    if (bill) {
      setBillSettled(bill, monthKey(billViewYear, billViewMonth), false);
      saveData();
      renderTagihan();
      showToast('Tanda lunas dibatalkan');
    }
    return;
  }

  const unpay = event.target.closest('[data-bill-unpay]');
  if (unpay) {
    deleteTransaction(unpay.dataset.billUnpay);   // menampilkan konfirmasi
    renderTagihan();
  }
});

billListCard.addEventListener('click', function (event) {
  const add = event.target.closest('[data-bill-new]');
  if (add) { openBillForm(null, add.dataset.billNew); return; }

  const edit = event.target.closest('[data-bill-edit]');
  if (edit) { openBillForm(edit.dataset.billEdit); return; }

  const del = event.target.closest('[data-bill-delete]');
  if (del) deleteBill(del.dataset.billDelete);
});

billModalBody.addEventListener('click', function (event) {
  const settle = event.target.closest('[data-bill-settle]');
  if (!settle) return;
  const bill = findBill(settle.dataset.billSettle);
  if (!bill) return;
  setBillSettled(bill, settle.dataset.month, true);
  saveData();
  closeBillModal();
  renderTagihan();
  showToast(bill.name + ' ' + monthLabel(settle.dataset.month) + ' ditandai lunas');
});

billModalBody.addEventListener('submit', function (event) {
  event.preventDefault();
  if (event.target.id === 'bill-form') saveBillForm(event.target);
  if (event.target.id === 'pay-form') savePayForm(event.target);
});

billModal.querySelectorAll('[data-bill-close]').forEach(function (el) {
  el.addEventListener('click', closeBillModal);
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && billModal.classList.contains('open')) closeBillModal();
});

// Tombol "Lihat" di banner pengingat
billReminder.addEventListener('click', function (event) {
  const go = event.target.closest('[data-bill-goto]');
  if (!go) return;
  const ym = keyToYearMonth(go.dataset.billGoto);
  billViewYear = ym.year;
  billViewMonth = ym.month;
  showPage('tagihan');
  renderTagihan();
});

// Setiap kali pindah menu: perbarui pengingat (transaksi mungkin berubah)
document.querySelectorAll('[data-page]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    if (btn.dataset.page === 'tagihan') renderTagihan();
    else renderBillReminder();
  });
});


// ===== SAAT APLIKASI DIBUKA =====
renderTagihan();
