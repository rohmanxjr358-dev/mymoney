// =====================================================
// STORAGE.JS — Semua urusan menyimpan & membaca data
// =====================================================

// Nama "laci" tempat data disimpan di browser
const STORAGE_KEY = 'mymoney-data';


// ===== KATEGORI BAWAAN =====
// type: 'masuk' = pemasukan, 'keluar' = pengeluaran
// fund: menandai kategori yang sebenarnya "menyisihkan uang" ke pos tabungan
const DEFAULT_CATEGORIES = [
  // --- Pemasukan ---
  { id: 'in-bulanan',  name: 'Uang Bulanan dari Orang Tua', type: 'masuk', group: 'Pemasukan' },
  { id: 'in-beasiswa', name: 'Beasiswa',                    type: 'masuk', group: 'Pemasukan' },
  { id: 'in-sampingan',name: 'Pekerjaan Sampingan',         type: 'masuk', group: 'Pemasukan' },
  { id: 'in-hadiah',   name: 'Hadiah',                      type: 'masuk', group: 'Pemasukan' },
  { id: 'in-lainnya',  name: 'Pemasukan Lainnya',           type: 'masuk', group: 'Pemasukan' },

  // --- A. Tempat tinggal ---
  { id: 'out-iuran',   name: 'Iuran Kontrakan Bulanan',     type: 'keluar', group: 'Tempat Tinggal' },

  // --- B. Kebutuhan sehari-hari ---
  { id: 'out-makan',   name: 'Makan',                       type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-minum',   name: 'Minum',                       type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-bahan',   name: 'Belanja Bahan Makanan',       type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-jajan',   name: 'Jajan',                       type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-mandi',   name: 'Kebutuhan Mandi',             type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-laundry', name: 'Laundry',                     type: 'keluar', group: 'Kebutuhan Sehari-hari' },
  { id: 'out-rumah',   name: 'Kebutuhan Rumah Lainnya',     type: 'keluar', group: 'Kebutuhan Sehari-hari' },

  // --- C. Kuliah ---
  { id: 'out-print',     name: 'Print dan Fotokopi',        type: 'keluar', group: 'Kebutuhan Kuliah' },
  { id: 'out-atk',       name: 'Alat Tulis',                type: 'keluar', group: 'Kebutuhan Kuliah' },
  { id: 'out-praktikum', name: 'Praktikum',                 type: 'keluar', group: 'Kebutuhan Kuliah' },
  { id: 'out-proyek',    name: 'Proyek',                    type: 'keluar', group: 'Kebutuhan Kuliah' },

  // --- D. Transportasi ---
  { id: 'out-bensin',    name: 'Bensin',                    type: 'keluar', group: 'Transportasi' },
  { id: 'out-kendaraan', name: 'Kebutuhan Kendaraan Lainnya', type: 'keluar', group: 'Transportasi' },

  // --- E. Kebutuhan pribadi ---
  { id: 'out-pakaian',   name: 'Pakaian',                   type: 'keluar', group: 'Kebutuhan Pribadi' },
  { id: 'out-rawat',     name: 'Perawatan Diri',            type: 'keluar', group: 'Kebutuhan Pribadi' },
  { id: 'out-kesehatan', name: 'Kesehatan',                 type: 'keluar', group: 'Kebutuhan Pribadi' },
  { id: 'out-hiburan',   name: 'Hiburan',                   type: 'keluar', group: 'Kebutuhan Pribadi' },
  { id: 'out-nongkrong', name: 'Nongkrong',                 type: 'keluar', group: 'Kebutuhan Pribadi' },
  { id: 'out-rokok',     name: 'Rokok',                     type: 'keluar', group: 'Kebutuhan Pribadi' },

  // --- F. Keuangan (menyisihkan uang, BUKAN pengeluaran habis pakai) ---
  { id: 'out-tabungan',  name: 'Tabungan Pribadi',          type: 'keluar', group: 'Keuangan', fund: 'tabungan' },
  { id: 'out-darurat',   name: 'Dana Darurat',              type: 'keluar', group: 'Keuangan', fund: 'darurat' },
  { id: 'out-investasi', name: 'Investasi Leher ke Atas',   type: 'keluar', group: 'Keuangan', fund: 'investasi' },

  // --- Lainnya ---
  { id: 'out-lainnya',   name: 'Pengeluaran Lainnya',       type: 'keluar', group: 'Lainnya' }
];


// ===== MEMBUAT DATA KOSONG (dipakai saat pertama kali) =====
function createEmptyData() {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES.map(function (cat) {
      return {
        id: cat.id,
        name: cat.name,
        type: cat.type,
        group: cat.group,
        fund: cat.fund || null,
        isDefault: true
      };
    }),
    transactions: [],
    settings: {
      expectedTransferDay: null
    }
  };
}


// ===== MEMBACA DATA DARI BROWSER =====
function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  // Belum pernah ada data → buat data baru
  if (!saved) {
    return createEmptyData();
  }

  try {
    const parsed = JSON.parse(saved);
    // Gabungkan dengan data kosong agar bagian baru (fitur baru) selalu ada
    return Object.assign(createEmptyData(), parsed);
  } catch (error) {
    // Data rusak → simpan salinannya dulu supaya tidak hilang, lalu mulai baru
    localStorage.setItem(STORAGE_KEY + '-rusak-' + Date.now(), saved);
    console.error('Data tidak bisa dibaca. Salinan disimpan.', error);
    return createEmptyData();
  }
}


// ===== MENYIMPAN DATA KE BROWSER =====
function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}


// ===== MEMBUAT ID UNIK (untuk setiap transaksi/kategori baru) =====
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}


// ===== MENGAMBIL KATEGORI BERDASARKAN JENIS =====
function getCategories(type) {
  return appData.categories.filter(function (cat) {
    return cat.type === type;
  });
}


// ===== MULAI: muat data saat aplikasi dibuka =====
let appData = loadData();

// ===== PEMBARUAN DATA LAMA =====
// Kategori bawaan yang ditambahkan SETELAH aplikasi pertama kali dipakai
// tidak otomatis ada di data lama, jadi ditambahkan di sini (hanya sekali).
const NEW_DEFAULT_CATEGORIES = [
  { version: 2, id: 'out-rokok', after: 'out-nongkrong' }
];

NEW_DEFAULT_CATEGORIES.forEach(function (item) {
  if ((appData.settings.categoryVersion || 1) >= item.version) return;

  const exists = appData.categories.some(function (cat) { return cat.id === item.id; });
  if (!exists) {
    const base = DEFAULT_CATEGORIES.find(function (cat) { return cat.id === item.id; });
    const newCategory = {
      id: base.id, name: base.name, type: base.type,
      group: base.group, fund: base.fund || null, isDefault: true
    };

    // Letakkan tepat setelah kategori tertentu (jika masih ada)
    const index = appData.categories.findIndex(function (cat) { return cat.id === item.after; });
    if (index >= 0) appData.categories.splice(index + 1, 0, newCategory);
    else appData.categories.push(newCategory);
  }
  appData.settings.categoryVersion = item.version;
});

saveData();

// Minta browser agar tidak menghapus data ini secara otomatis
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}