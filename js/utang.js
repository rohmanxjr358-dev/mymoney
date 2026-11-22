// =====================================================
// UTANG.JS — Utang, piutang, dan patungan dengan teman
// =====================================================
// Data disimpan di appData.debts:
//   { id, person, dir: 'piutang' | 'utang', amount, note, date, dueDate,
//     payments: [{ id, amount, date }], settledAt, createdAt }
// 'piutang' = teman berutang padaku (uangku ada di teman)
// 'utang'   = aku berutang pada teman
// Catatan ini TERPISAH dari saldo: tidak mengubah "Uang di dompet".

if (!Array.isArray(appData.debts)) {
  appData.debts = [];
}

const debtHero = document.getElementById('debt-hero');
const debtPeopleCard = document.getElementById('debt-people');
const debtSettledCard = document.getElementById('debt-settled');
const debtModal = document.getElementById('debt-modal');
const debtModalTitle = document.getElementById('debt-modal-title');
const debtModalBody = document.getElementById('debt-modal-body');

let debtOpenPerson = null;   // orang yang sedang dibuka di jendela
let debtPayingId = null;     // catatan yang sedang diisi form "bayar"


// ===== ALAT HITUNG =====
function debtPaid(debt) {
  return (debt.payments || []).reduce(function (sum, p) { return sum + p.amount; }, 0);
}

function debtRemaining(debt) {
  return Math.max(0, debt.amount - debtPaid(debt));
}

function isDebtSettled(debt) {
  return debtRemaining(debt) === 0;
}

function personKey(name) {
  return String(name || '').trim().toLowerCase();
}

function findDebt(id) {
  return appData.debts.find(function (d) { return d.id === id; }) || null;
}

// Warna avatar tetap untuk nama yang sama
function personTone(name) {
  let hash = 0;
  const key = personKey(name);
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return QUICK_TONES[hash % QUICK_TONES.length];
}

function personInitial(name) {
  return escapeHtml((String(name).trim()[0] || '?').toUpperCase());
}

function avatarHtml(name, size) {
  return `<span class="debt-avatar ${size || ''} tone-${personTone(name)}">${personInitial(name)}</span>`;
}

function daysAgoText(dateString) {
  const days = daysBetween(dateString, todayString());
  if (days <= 0) return 'hari ini';
  if (days === 1) return 'kemarin';
  return days + ' hari lalu';
}

function getDebtTotals() {
  const totals = { piutang: 0, utang: 0 };
  appData.debts.forEach(function (d) { totals[d.dir] += debtRemaining(d); });
  return totals;
}

// Kelompokkan catatan yang belum lunas per orang
function getDebtPeople() {
  const people = {};
  const today = todayString();

  appData.debts.forEach(function (d) {
    if (isDebtSettled(d)) return;
    const key = personKey(d.person);
    if (!people[key]) {
      people[key] = { key: key, name: d.person.trim(), piutang: 0, utang: 0, items: [], oldest: d.date, overdue: false };
    }
    const p = people[key];
    p[d.dir] += debtRemaining(d);
    p.items.push(d);
    if (d.date < p.oldest) p.oldest = d.date;
    if (d.dueDate && d.dueDate < today) p.overdue = true;
  });

  return Object.keys(people).map(function (key) {
    const p = people[key];
    p.net = p.piutang - p.utang;
    return p;
  }).sort(function (a, b) { return Math.abs(b.net) - Math.abs(a.net); });
}

function knownPeopleNames() {
  const seen = {};
  appData.debts.forEach(function (d) { seen[personKey(d.person)] = d.person.trim(); });
  return Object.keys(seen).map(function (k) { return seen[k]; }).sort();
}


// ===== EFEK KONFETI (dipakai juga oleh Rekap) =====
function burstConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const layer = document.createElement('div');
  layer.className = 'confetti-layer';
  const colors = ['#3b82f6', '#60a5fa', '#a78bfa', '#34d399', '#fbbf24', '#fb7185', '#38bdf8'];

  for (let i = 0; i < 36; i++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', (Math.random() * 100) + 'vw');
    piece.style.setProperty('--drift', (Math.random() * 120 - 60) + 'px');
    piece.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
    piece.style.setProperty('--delay', (Math.random() * 0.3) + 's');
    piece.style.setProperty('--dur', (1.4 + Math.random() * 0.9) + 's');
    piece.style.background = colors[i % colors.length];
    layer.appendChild(piece);
  }

  document.body.appendChild(layer);
  setTimeout(function () { layer.remove(); }, 2600);
}


// ===== 1. RINGKASAN ATAS =====
function renderDebtHero() {
  const totals = getDebtTotals();
  const sum = totals.piutang + totals.utang;
  const leftPercent = sum ? Math.round((totals.piutang / sum) * 100) : 50;
  const net = totals.piutang - totals.utang;

  let netText = 'Belum ada catatan yang berjalan. Semua bersih ✨';
  if (sum) {
    netText = net > 0
      ? `Kalau semua lunas, kamu <strong>+${formatRupiah(net)}</strong>`
      : net < 0
        ? `Kalau semua lunas, kamu <strong>−${formatRupiah(-net)}</strong>`
        : 'Utang dan piutangmu <strong>impas</strong>';
  }

  debtHero.innerHTML = `
    <div class="debt-hero-grid">
      <div class="debt-side in">
        <span><span class="material-symbols-rounded">call_received</span> Uangku di teman</span>
        <strong>${formatRupiah(totals.piutang)}</strong>
      </div>
      <div class="debt-side out">
        <span><span class="material-symbols-rounded">call_made</span> Utangku</span>
        <strong>${formatRupiah(totals.utang)}</strong>
      </div>
    </div>
    <div class="debt-tug ${sum ? '' : 'empty'}" aria-hidden="true">
      <span class="tug-in" style="width:${leftPercent}%"></span>
      <span class="tug-knot" style="left:${leftPercent}%"></span>
    </div>
    <p class="debt-net">${netText}</p>
    <div class="debt-actions">
      <button type="button" class="debt-action in" data-debt-new="piutang">
        <span class="material-symbols-rounded">volunteer_activism</span>
        <span>Teman pinjam</span>
      </button>
      <button type="button" class="debt-action out" data-debt-new="utang">
        <span class="material-symbols-rounded">front_hand</span>
        <span>Aku pinjam</span>
      </button>
      <button type="button" class="debt-action split" data-debt-split>
        <span class="material-symbols-rounded">diversity_3</span>
        <span>Bagi patungan</span>
      </button>
    </div>
  `;
}


// ===== 2. DAFTAR ORANG =====
function renderDebtPeople() {
  const people = getDebtPeople();

  const rows = people.map(function (p, i) {
    const label = p.net > 0 ? 'berutang padamu' : p.net < 0 ? 'kamu berutang' : 'impas';
    const cls = p.net > 0 ? 'in' : p.net < 0 ? 'out' : '';
    return `
      <button type="button" class="debt-person" data-person="${escapeHtml(p.key)}" style="--i:${i}">
        ${avatarHtml(p.name)}
        <div class="debt-person-info">
          <strong>${escapeHtml(p.name)}</strong>
          <small>
            ${p.items.length} catatan · sejak ${daysAgoText(p.oldest)}
            ${p.overdue ? '<span class="status-badge over">Lewat tempo</span>' : ''}
          </small>
        </div>
        <div class="debt-person-amount ${cls}">
          <strong>${formatRupiah(Math.abs(p.net))}</strong>
          <small>${label}</small>
        </div>
        <span class="material-symbols-rounded debt-chevron">chevron_right</span>
      </button>
    `;
  }).join('');

  debtPeopleCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">Belum Lunas</h2>
      <span class="card-sub">${people.length} orang</span>
    </div>
    ${people.length
      ? `<div class="debt-list">${rows}</div>`
      : `<div class="debt-empty">
           <span>🤝</span>
           <p>Tidak ada utang atau piutang yang berjalan.<br>Talangin iuran Wi-Fi? Pakai <strong>Bagi patungan</strong>.</p>
         </div>`}
    <p class="hint">Catatan ini terpisah dari saldo. Jika kamu membayar penuh lalu ditalangi teman,
      catat pembayarannya seperti biasa di Transaksi — di sini cukup catat siapa yang belum bayar.</p>
  `;
}


// ===== 3. SUDAH LUNAS =====
function renderDebtSettled() {
  const settled = appData.debts
    .filter(isDebtSettled)
    .sort(function (a, b) { return String(b.settledAt || b.date).localeCompare(String(a.settledAt || a.date)); });

  if (!settled.length) {
    debtSettledCard.hidden = true;
    return;
  }
  debtSettledCard.hidden = false;

  debtSettledCard.innerHTML = `
    <details class="debt-settled">
      <summary>
        <span class="material-symbols-rounded">task_alt</span>
        Sudah lunas <span class="card-sub">(${settled.length})</span>
      </summary>
      <div class="debt-settled-list">
        ${settled.slice(0, 30).map(function (d) {
          return `
            <div class="debt-settled-row">
              ${avatarHtml(d.person, 'small')}
              <div class="debt-person-info">
                <strong>${escapeHtml(d.person)}</strong>
                <small>${escapeHtml(d.note || (d.dir === 'piutang' ? 'Pinjam ke kamu' : 'Kamu pinjam'))}
                  · lunas ${d.settledAt ? formatShortDate(d.settledAt.slice(0, 10)) : ''}</small>
              </div>
              <span class="debt-settled-amount">${formatRupiah(d.amount)}</span>
              <button type="button" class="icon-btn danger" data-debt-delete="${d.id}" title="Hapus catatan">
                <span class="material-symbols-rounded">delete</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    </details>
  `;
}

function renderUtang() {
  renderDebtHero();
  renderDebtPeople();
  renderDebtSettled();
}


// ===== JENDELA: SATU ORANG =====
function renderPersonModal() {
  const person = getDebtPeople().find(function (p) { return p.key === debtOpenPerson; });

  if (!person) {
    closeDebtModal();
    return;
  }

  debtModalTitle.innerHTML = `<span class="debt-modal-head">${avatarHtml(person.name)} ${escapeHtml(person.name)}</span>`;

  const items = person.items.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  const today = todayString();

  const itemsHtml = items.map(function (d) {
    const paid = debtPaid(d);
    const remaining = debtRemaining(d);
    const percent = Math.round((paid / d.amount) * 100);
    const overdue = d.dueDate && d.dueDate < today;

    const paymentsHtml = (d.payments || []).map(function (p) {
      return `<li>Dibayar ${formatRupiah(p.amount)} · ${formatShortDate(p.date)}</li>`;
    }).join('');

    const payForm = d.id === debtPayingId ? `
      <form class="debt-pay-form" data-pay-form="${d.id}" novalidate>
        <div class="input-prefix">
          <span>Rp</span>
          <input type="number" id="dpay-amount" inputmode="numeric" min="1" step="1" value="${remaining}">
        </div>
        <input type="date" id="dpay-date" value="${today}">
        <button type="submit" class="btn btn-primary">Simpan</button>
      </form>
    ` : '';

    return `
      <div class="debt-item ${d.dir}">
        <div class="debt-item-top">
          <span class="debt-dir ${d.dir}">${d.dir === 'piutang' ? 'Pinjam ke kamu' : 'Kamu pinjam'}</span>
          ${overdue ? '<span class="status-badge over">Lewat tempo</span>' : ''}
          <div class="debt-item-tools">
            <button type="button" class="icon-btn" data-debt-edit="${d.id}" title="Ubah"><span class="material-symbols-rounded">edit</span></button>
            <button type="button" class="icon-btn danger" data-debt-delete="${d.id}" title="Hapus"><span class="material-symbols-rounded">delete</span></button>
          </div>
        </div>
        <strong class="debt-item-note">${escapeHtml(d.note || 'Tanpa keterangan')}</strong>
        <small class="debt-item-meta">${formatShortDate(d.date)}${d.dueDate ? ' · tempo ' + formatShortDate(d.dueDate) : ''}</small>
        <div class="debt-item-amounts">
          <span>Sisa <strong>${formatRupiah(remaining)}</strong></span>
          <span>dari ${formatRupiah(d.amount)}</span>
        </div>
        <div class="mini-bar debt-bar"><span style="width:${percent}%"></span></div>
        ${paymentsHtml ? `<ul class="debt-payments">${paymentsHtml}</ul>` : ''}
        ${payForm}
        <div class="debt-item-buttons">
          <button type="button" class="btn btn-secondary" data-debt-pay="${d.id}">
            <span class="material-symbols-rounded">payments</span> Bayar sebagian
          </button>
          <button type="button" class="btn btn-primary" data-debt-settle="${d.id}">
            <span class="material-symbols-rounded">check_circle</span> Lunas
          </button>
        </div>
      </div>
    `;
  }).join('');

  const netText = person.net > 0
    ? `${escapeHtml(person.name)} berutang <strong class="text-success">${formatRupiah(person.net)}</strong> padamu`
    : person.net < 0
      ? `Kamu berutang <strong class="text-danger">${formatRupiah(-person.net)}</strong> ke ${escapeHtml(person.name)}`
      : 'Impas — utang dan piutang saling menutup';

  debtModalBody.innerHTML = `
    <p class="debt-modal-net">${netText}</p>
    <div class="debt-items">${itemsHtml}</div>
    <div class="button-row">
      ${person.piutang > 0 ? `
        <button type="button" class="btn btn-secondary" data-debt-remind="${escapeHtml(person.key)}">
          <span class="material-symbols-rounded">send</span> Ingatkan lewat chat
        </button>` : ''}
      <button type="button" class="btn btn-secondary" data-debt-new-for="${escapeHtml(person.name)}">
        <span class="material-symbols-rounded">add</span> Tambah catatan
      </button>
    </div>
  `;
}

function openPerson(key) {
  debtOpenPerson = key;
  debtPayingId = null;
  renderPersonModal();
  debtModal.classList.add('open');
}


// ===== JENDELA: FORM TAMBAH / UBAH =====
function renderDebtForm(dir, debt, presetName) {
  const data = debt || {
    dir: dir, person: presetName || '', amount: '', note: '', date: todayString(), dueDate: ''
  };
  debtOpenPerson = null;

  debtModalTitle.textContent = debt ? 'Ubah Catatan' : 'Catatan Baru';
  debtModalBody.innerHTML = `
    <form id="debt-form" data-id="${debt ? debt.id : ''}" novalidate>
      <div class="segmented debt-dir-picker">
        <button type="button" class="segmented-btn ${data.dir === 'piutang' ? 'active' : ''}" data-dir="piutang">
          <span class="material-symbols-rounded">call_received</span> Teman pinjam
        </button>
        <button type="button" class="segmented-btn ${data.dir === 'utang' ? 'active' : ''}" data-dir="utang">
          <span class="material-symbols-rounded">call_made</span> Aku pinjam
        </button>
      </div>
      <input type="hidden" id="df-dir" value="${data.dir}">
      <div class="form-grid">
        <div class="field field-full">
          <label for="df-person">Nama teman</label>
          <input type="text" id="df-person" maxlength="30" list="df-people" placeholder="Contoh: Andi" value="${escapeHtml(data.person)}">
          <datalist id="df-people">${knownPeopleNames().map(function (n) { return `<option value="${escapeHtml(n)}">`; }).join('')}</datalist>
        </div>
        <div class="field field-full">
          <label for="df-amount">Nominal</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="df-amount" inputmode="numeric" min="1" step="1" placeholder="0" value="${data.amount}">
          </div>
        </div>
        <div class="field field-full">
          <label for="df-note">Untuk apa <span class="optional">(boleh dikosongkan)</span></label>
          <input type="text" id="df-note" maxlength="60" placeholder="Contoh: Talangin makan siang" value="${escapeHtml(data.note)}">
        </div>
        <div class="field">
          <label for="df-date">Tanggal</label>
          <input type="date" id="df-date" value="${data.date}">
        </div>
        <div class="field">
          <label for="df-due">Janji bayar <span class="optional">(opsional)</span></label>
          <input type="date" id="df-due" value="${data.dueDate || ''}">
        </div>
      </div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">check</span> Simpan
        </button>
      </div>
    </form>
  `;
  debtModal.classList.add('open');
  setTimeout(function () {
    const first = document.getElementById(data.person ? 'df-amount' : 'df-person');
    if (first && window.innerWidth > 768) first.focus();
  }, 50);
}

function saveDebtForm(form) {
  const person = document.getElementById('df-person').value.trim();
  const amount = Math.round(Number(document.getElementById('df-amount').value));
  const date = document.getElementById('df-date').value || todayString();

  if (!person) { showToast('Isi nama teman'); return; }
  if (!amount || amount <= 0) { showToast('Isi nominal'); return; }

  const data = {
    dir: document.getElementById('df-dir').value,
    person: person,
    amount: amount,
    note: document.getElementById('df-note').value.trim(),
    date: date,
    dueDate: document.getElementById('df-due').value || ''
  };

  if (form.dataset.id) {
    const debt = findDebt(form.dataset.id);
    Object.assign(debt, data);
    updateSettledStamp(debt);
    showToast('Catatan diperbarui');
  } else {
    appData.debts.push(Object.assign({ id: generateId(), payments: [], settledAt: null, createdAt: new Date().toISOString() }, data));
    showToast(data.dir === 'piutang'
      ? person + ' pinjam ' + formatRupiah(amount) + ' — tercatat'
      : 'Utangmu ke ' + person + ' ' + formatRupiah(amount) + ' — tercatat');
  }

  saveData();
  renderUtang();
  openPerson(personKey(person));
}

function updateSettledStamp(debt) {
  if (isDebtSettled(debt)) {
    if (!debt.settledAt) debt.settledAt = new Date().toISOString();
  } else {
    debt.settledAt = null;
  }
}


// ===== JENDELA: BAGI PATUNGAN =====
function renderSplitForm() {
  debtOpenPerson = null;
  debtModalTitle.textContent = 'Bagi Patungan';
  debtModalBody.innerHTML = `
    <p class="card-text">Kamu bayar dulu, lalu dibagi rata. Setiap teman otomatis dicatat berutang padamu.</p>
    <form id="split-form" novalidate>
      <div class="form-grid">
        <div class="field field-full">
          <label for="sf-name">Untuk apa</label>
          <input type="text" id="sf-name" maxlength="40" placeholder="Contoh: Wi-Fi November">
        </div>
        <div class="field field-full">
          <label for="sf-total">Total yang kamu bayar</label>
          <div class="input-prefix">
            <span>Rp</span>
            <input type="number" id="sf-total" inputmode="numeric" min="1" step="1" placeholder="0">
          </div>
        </div>
        <div class="field field-full">
          <label for="sf-people">Nama teman (pisahkan dengan koma)</label>
          <input type="text" id="sf-people" placeholder="Contoh: Andi, Budi, Citra">
          <div class="split-suggest">
            ${knownPeopleNames().slice(0, 8).map(function (n) {
              return `<button type="button" class="split-chip" data-split-name="${escapeHtml(n)}">+ ${escapeHtml(n)}</button>`;
            }).join('')}
          </div>
        </div>
      </div>
      <label class="check-row">
        <input type="checkbox" id="sf-me" checked>
        Aku juga ikut menanggung bagian
      </label>
      <div class="split-preview" id="split-preview"></div>
      <div class="button-row">
        <button type="submit" class="btn btn-primary">
          <span class="material-symbols-rounded">diversity_3</span> Bagi & Catat
        </button>
      </div>
    </form>
  `;
  debtModal.classList.add('open');
  updateSplitPreview();
}

function getSplitInput() {
  const total = Math.round(Number(document.getElementById('sf-total').value)) || 0;
  const names = document.getElementById('sf-people').value
    .split(',')
    .map(function (n) { return n.trim(); })
    .filter(Boolean)
    .filter(function (n, i, arr) {
      return arr.findIndex(function (m) { return personKey(m) === personKey(n); }) === i;
    });
  const withMe = document.getElementById('sf-me').checked;
  const count = names.length + (withMe ? 1 : 0);
  const share = count ? Math.ceil(total / count) : 0;
  return { total: total, names: names, withMe: withMe, count: count, share: share };
}

function updateSplitPreview() {
  const preview = document.getElementById('split-preview');
  if (!preview) return;
  const s = getSplitInput();

  if (!s.total || !s.names.length) {
    preview.innerHTML = '<span class="split-hint">Isi total dan nama teman untuk melihat pembagiannya.</span>';
    return;
  }

  preview.innerHTML = `
    <div class="split-people">
      ${s.withMe ? `<div class="split-person me"><span class="debt-avatar small tone-blue">Aku</span><small>${compactRupiah(s.share)}</small></div>` : ''}
      ${s.names.map(function (n) {
        return `<div class="split-person">${avatarHtml(n, 'small')}<small>${compactRupiah(s.share)}</small></div>`;
      }).join('')}
    </div>
    <p>Dibagi <strong>${s.count}</strong> orang → masing-masing <strong>${formatRupiah(s.share)}</strong>.<br>
       Yang akan kembali ke kamu: <strong class="text-success">${formatRupiah(s.share * s.names.length)}</strong></p>
  `;
}

function saveSplitForm() {
  const s = getSplitInput();
  const name = document.getElementById('sf-name').value.trim() || 'Patungan';

  if (!s.total) { showToast('Isi total yang kamu bayar'); return; }
  if (!s.names.length) { showToast('Isi minimal satu nama teman'); return; }

  const now = new Date().toISOString();
  s.names.forEach(function (n) {
    appData.debts.push({
      id: generateId(), person: n, dir: 'piutang', amount: s.share,
      note: name, date: todayString(), dueDate: '', payments: [], settledAt: null, createdAt: now
    });
  });

  saveData();
  closeDebtModal();
  renderUtang();
  showToast(name + ' dibagi ke ' + s.names.length + ' teman · ' + formatRupiah(s.share) + '/orang');
}


// ===== BAYAR & LUNAS =====
function addDebtPayment(id, amount, date) {
  const debt = findDebt(id);
  if (!debt) return;

  const remaining = debtRemaining(debt);
  const value = Math.min(remaining, Math.round(amount));
  if (!value || value <= 0) { showToast('Isi nominal pembayaran'); return; }

  debt.payments = debt.payments || [];
  debt.payments.push({ id: generateId(), amount: value, date: date || todayString() });
  updateSettledStamp(debt);
  saveData();

  debtPayingId = null;
  renderUtang();

  if (isDebtSettled(debt)) {
    burstConfetti();
    showToast('🎉 ' + debt.person + ' — lunas!');
  } else {
    showToast('Pembayaran ' + formatRupiah(value) + ' dicatat · sisa ' + formatRupiah(debtRemaining(debt)));
  }

  // Jendela tetap terbuka jika orang ini masih punya catatan
  renderPersonModal();
}

function remindPerson(key) {
  const person = getDebtPeople().find(function (p) { return p.key === key; });
  if (!person) return;

  const lines = person.items
    .filter(function (d) { return d.dir === 'piutang'; })
    .map(function (d) { return '• ' + (d.note || 'Pinjaman') + ' (' + formatShortDate(d.date) + '): ' + formatRupiah(debtRemaining(d)); });

  const text =
    'Halo ' + person.name + '! 👋\n' +
    'Mau ngingetin catatan kecil ya:\n' +
    lines.join('\n') + '\n' +
    'Total ' + formatRupiah(person.piutang) + '. Kalau sudah longgar boleh ditransfer. Makasih banyak 🙏';

  if (navigator.share) {
    navigator.share({ text: text }).catch(function () {});
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
}

function deleteDebt(id) {
  const debt = findDebt(id);
  if (!debt) return;
  if (!confirm('Hapus catatan ' + debt.person + ' ' + formatRupiah(debt.amount) + '? Tidak bisa dikembalikan.')) return;

  appData.debts = appData.debts.filter(function (d) { return d.id !== id; });
  saveData();
  renderUtang();
  if (debtOpenPerson) renderPersonModal();
  showToast('Catatan dihapus');
}

function closeDebtModal() {
  debtModal.classList.remove('open');
  debtOpenPerson = null;
  debtPayingId = null;
}


// ===== RINGKASAN KECIL DI DASHBOARD =====
function renderDashDebt() {
  const box = document.getElementById('dash-debt');
  if (!box) return;
  const totals = getDebtTotals();

  if (!totals.piutang && !totals.utang) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = `
    <button type="button" class="dash-debt" data-dash-go="utang">
      <span class="dash-debt-icon">🤝</span>
      <span class="dash-debt-text">
        ${totals.piutang ? `Di teman <strong class="text-success">${formatRupiah(totals.piutang)}</strong>` : ''}
        ${totals.piutang && totals.utang ? '<i>·</i>' : ''}
        ${totals.utang ? `Utangmu <strong class="text-danger">${formatRupiah(totals.utang)}</strong>` : ''}
      </span>
      <span class="material-symbols-rounded">chevron_right</span>
    </button>
  `;
}


// ===== MENGHUBUNGKAN TOMBOL =====
document.getElementById('page-utang').addEventListener('click', function (event) {
  const newButton = event.target.closest('[data-debt-new]');
  if (newButton) { renderDebtForm(newButton.dataset.debtNew); return; }

  if (event.target.closest('[data-debt-split]')) { renderSplitForm(); return; }

  const personButton = event.target.closest('[data-person]');
  if (personButton) { openPerson(personButton.dataset.person); return; }

  const del = event.target.closest('[data-debt-delete]');
  if (del) deleteDebt(del.dataset.debtDelete);
});

debtModal.addEventListener('click', function (event) {
  if (event.target.closest('[data-debt-close]')) { closeDebtModal(); return; }

  const dirButton = event.target.closest('[data-dir]');
  if (dirButton) {
    document.getElementById('df-dir').value = dirButton.dataset.dir;
    debtModal.querySelectorAll('[data-dir]').forEach(function (b) { b.classList.toggle('active', b === dirButton); });
    return;
  }

  const nameChip = event.target.closest('[data-split-name]');
  if (nameChip) {
    const input = document.getElementById('sf-people');
    const current = input.value.split(',').map(function (n) { return n.trim(); }).filter(Boolean);
    if (!current.some(function (n) { return personKey(n) === personKey(nameChip.dataset.splitName); })) {
      current.push(nameChip.dataset.splitName);
    }
    input.value = current.join(', ');
    nameChip.classList.add('used');
    updateSplitPreview();
    return;
  }

  const pay = event.target.closest('[data-debt-pay]');
  if (pay) {
    debtPayingId = debtPayingId === pay.dataset.debtPay ? null : pay.dataset.debtPay;
    renderPersonModal();
    const input = document.getElementById('dpay-amount');
    if (input) input.select();
    return;
  }

  const settle = event.target.closest('[data-debt-settle]');
  if (settle) {
    const debt = findDebt(settle.dataset.debtSettle);
    if (debt) addDebtPayment(debt.id, debtRemaining(debt), todayString());
    return;
  }

  const edit = event.target.closest('[data-debt-edit]');
  if (edit) { const d = findDebt(edit.dataset.debtEdit); if (d) renderDebtForm(d.dir, d); return; }

  const del = event.target.closest('[data-debt-delete]');
  if (del) { deleteDebt(del.dataset.debtDelete); return; }

  const remind = event.target.closest('[data-debt-remind]');
  if (remind) { remindPerson(remind.dataset.debtRemind); return; }

  const addFor = event.target.closest('[data-debt-new-for]');
  if (addFor) renderDebtForm('piutang', null, addFor.dataset.debtNewFor);
});

debtModal.addEventListener('submit', function (event) {
  event.preventDefault();
  const form = event.target;
  if (form.id === 'debt-form') saveDebtForm(form);
  if (form.id === 'split-form') saveSplitForm();
  if (form.dataset.payForm) {
    addDebtPayment(form.dataset.payForm,
      Number(document.getElementById('dpay-amount').value),
      document.getElementById('dpay-date').value);
  }
});

debtModal.addEventListener('input', function (event) {
  if (event.target.closest('#split-form')) updateSplitPreview();
});
debtModal.addEventListener('change', function (event) {
  if (event.target.id === 'sf-me') updateSplitPreview();
});

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape' && debtModal.classList.contains('open')) closeDebtModal();
});

document.querySelectorAll('[data-page="utang"]').forEach(function (btn) {
  btn.addEventListener('click', renderUtang);
});


// ===== SAAT APLIKASI DIBUKA =====
renderUtang();
