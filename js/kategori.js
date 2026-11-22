// =====================================================
// KATEGORI.JS — Tambah, edit, dan hapus kategori
// =====================================================

// Kategori yang dipakai fitur lain: boleh ganti nama, TIDAK boleh dihapus
const LOCKED_CATEGORY_IDS = [
  'in-bulanan', 'in-lainnya', 'out-iuran',
  'out-tabungan', 'out-darurat', 'out-investasi', 'out-lainnya'
];

const catForm = document.getElementById('category-form');
const catFormTitle = document.getElementById('category-form-title');
const catName = document.getElementById('cat-name');
const catGroup = document.getElementById('cat-group');
const catGroupOptions = document.getElementById('cat-group-options');
const catSubmitButton = document.getElementById('cat-submit');
const catCancelButton = document.getElementById('cat-cancel');
const catTypeButtons = document.querySelectorAll('#category-type .segmented-btn');
const catList = document.getElementById('category-list');

// Jenis kategori yang sedang ditampilkan: 'keluar' atau 'masuk'
let categoryType = 'keluar';

// Id kategori yang sedang diedit (null = sedang menambah baru)
let editingCategoryId = null;


// ===== ALAT BANTU =====
function defaultGroupFor(type) {
  return type === 'masuk' ? 'Pemasukan' : 'Kategori Saya';
}

function countCategoryUsage(id) {
  return appData.transactions.filter(function (tx) {
    return tx.categoryId === id;
  }).length;
}

// Cek apakah nama sudah dipakai kategori lain dengan jenis yang sama
function findCategoryByName(name, type, exceptId) {
  const lower = name.toLowerCase();
  return appData.categories.find(function (cat) {
    return cat.type === type && cat.id !== exceptId && cat.name.toLowerCase() === lower;
  }) || null;
}

// Perbarui semua tampilan yang memakai kategori
function refreshCategoryViews() {
  renderCategoryList();
  fillGroupOptions();

  renderRecentTransactions();
  updateBackupInfo();
  if (typeof renderQuickAll === 'function') renderQuickAll();   // nama kategori di tombol kilat
}


// ===== PILIH JENIS: KELUAR / MASUK =====
function setCategoryType(type) {
  categoryType = type;

  catTypeButtons.forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.type === type);
  });

  resetCategoryForm();
  fillGroupOptions();
}


// ===== SARAN GRUP (muncul saat mengetik di kolom Grup) =====
function fillGroupOptions() {
  const groups = [];
  getCategories(categoryType).forEach(function (cat) {
    if (!groups.includes(cat.group)) groups.push(cat.group);
  });

  catGroupOptions.innerHTML = groups.map(function (group) {
    return `<option value="${escapeHtml(group)}"></option>`;
  }).join('');

  catGroup.placeholder = 'Kosongkan = ' + defaultGroupFor(categoryType);
}


// ===== KOSONGKAN FORM (sekaligus keluar dari mode edit) =====
function resetCategoryForm() {
  editingCategoryId = null;
  catName.value = '';
  catGroup.value = '';

  catForm.classList.remove('editing');
  catFormTitle.textContent = 'Tambah Kategori';
  catSubmitButton.innerHTML = '<span class="material-symbols-rounded">add</span> Tambah';
  catCancelButton.hidden = true;

  renderCategoryList();
}


// ===== MULAI MENGEDIT KATEGORI =====
function startCategoryEdit(id) {
  const cat = findCategory(id);
  if (!cat) return;

  editingCategoryId = id;
  catName.value = cat.name;
  catGroup.value = cat.group;

  catForm.classList.add('editing');
  catFormTitle.textContent = 'Edit Kategori';
  catSubmitButton.innerHTML = '<span class="material-symbols-rounded">check</span> Simpan Perubahan';
  catCancelButton.hidden = false;

  renderCategoryList();
  catForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}


// ===== SIMPAN (kategori baru ATAU perubahan) =====
function saveCategory(event) {
  event.preventDefault();

  const name = catName.value.trim();
  const group = catGroup.value.trim() || defaultGroupFor(categoryType);

  if (!name) {
    showToast('Isi nama kategori terlebih dahulu');
    catName.focus();
    return;
  }
  if (findCategoryByName(name, categoryType, editingCategoryId)) {
    showToast('Kategori "' + name + '" sudah ada');
    catName.focus();
    return;
  }

  if (editingCategoryId) {
    const cat = findCategory(editingCategoryId);
    cat.name = name;
    cat.group = group;
    showToast('Kategori diperbarui');
  } else {
    appData.categories.push({
      id: generateId(),
      name: name,
      type: categoryType,
      group: group,
      fund: null,
      isDefault: false
    });
    showToast('Kategori "' + name + '" ditambahkan');
  }

  saveData();
  resetCategoryForm();
  refreshCategoryViews();
}


// ===== HAPUS KATEGORI =====
function deleteCategory(id) {
  const cat = findCategory(id);
  if (!cat) return;

  if (LOCKED_CATEGORY_IDS.includes(id)) {
    showToast('Kategori ini dipakai fitur lain dan tidak bisa dihapus');
    return;
  }

  const used = countCategoryUsage(id);
  const fallbackId = cat.type === 'masuk' ? 'in-lainnya' : 'out-lainnya';
  const fallback = findCategory(fallbackId);

  let message = 'Hapus kategori "' + cat.name + '"?';
  if (used > 0) {
    message += '\n\n' + used + ' transaksi dengan kategori ini akan dipindahkan ke "' + fallback.name + '".';
  }
  if (!confirm(message)) return;

  // Pindahkan transaksi — dan semua yang merujuk kategori ini — ke kategori cadangan
  appData.transactions.forEach(function (tx) {
    if (tx.categoryId === id) tx.categoryId = fallbackId;
  });
  (appData.quickTemplates || []).forEach(function (t) { if (t.categoryId === id) t.categoryId = fallbackId; });
  (appData.bills || []).forEach(function (b) { if (b.categoryId === id) b.categoryId = fallbackId; });
  (appData.periods || []).forEach(function (p) {
    if (p.allocations && p.allocations.wajib) {
      p.allocations.wajib.forEach(function (w) { if (w.categoryId === id) w.categoryId = fallbackId; });
    }
  });

  // Hapus kategorinya
  appData.categories = appData.categories.filter(function (item) {
    return item.id !== id;
  });

  saveData();
  if (editingCategoryId === id) resetCategoryForm();
  refreshCategoryViews();
  showToast('Kategori dihapus');
}


// ===== TAMPILKAN DAFTAR KATEGORI PER GRUP =====
function renderCategoryList() {
  const groups = {};
  getCategories(categoryType).forEach(function (cat) {
    if (!groups[cat.group]) groups[cat.group] = [];
    groups[cat.group].push(cat);
  });

  catList.innerHTML = Object.keys(groups).map(function (groupName) {
    const items = groups[groupName].map(function (cat) {
      const used = countCategoryUsage(cat.id);
      const locked = LOCKED_CATEGORY_IDS.includes(cat.id);
      const meta = [
        used + ' transaksi',
        cat.isDefault ? 'Bawaan' : 'Buatan sendiri',
        locked ? 'Tidak bisa dihapus' : ''
      ].filter(Boolean).join(' · ');

      return `
        <div class="cat-item ${cat.id === editingCategoryId ? 'editing' : ''}">
          <div class="cat-info">
            <div class="cat-name">${escapeHtml(cat.name)}</div>
            <div class="cat-meta">${meta}</div>
          </div>
          <div class="tx-actions">
            <button type="button" class="icon-btn" data-action="edit" data-id="${cat.id}" title="Edit">
              <span class="material-symbols-rounded">edit</span>
            </button>
            ${locked ? '' : `
            <button type="button" class="icon-btn danger" data-action="delete" data-id="${cat.id}" title="Hapus">
              <span class="material-symbols-rounded">delete</span>
            </button>`}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="cat-group">
        <div class="cat-group-title">${escapeHtml(groupName)}</div>
        ${items}
      </div>
    `;
  }).join('');
}


// ===== MENGHUBUNGKAN TOMBOL =====
catTypeButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    setCategoryType(btn.dataset.type);
  });
});

catForm.addEventListener('submit', saveCategory);
catCancelButton.addEventListener('click', resetCategoryForm);

catList.addEventListener('click', function (event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  if (button.dataset.action === 'edit') startCategoryEdit(button.dataset.id);
  if (button.dataset.action === 'delete') deleteCategory(button.dataset.id);
});


// ===== SAAT APLIKASI DIBUKA =====
setCategoryType('keluar');