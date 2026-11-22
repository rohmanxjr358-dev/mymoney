// ===== DAFTAR JUDUL HALAMAN =====
const pageTitles = {
  dashboard: 'Beranda',
  transaksi: 'Riwayat Transaksi',
  anggaran: 'Anggaran Mingguan',
  bulanan: 'Uang Bulanan',
  tabungan: 'Tabungan',
  tagihan: 'Tagihan',
  utang: 'Utang & Patungan',
  laporan: 'Laporan',
  pengaturan: 'Pengaturan'
};

// Halaman yang ada di dalam menu "Lainnya" (khusus HP)
const morePages = ['bulanan', 'anggaran', 'tagihan', 'utang', 'pengaturan'];

const moreButton = document.getElementById('more-button');
const moreSheet = document.getElementById('more-sheet');
const moreBackdrop = document.getElementById('more-backdrop');


// ===== FUNGSI: PINDAH HALAMAN =====
function showPage(pageName) {
  // 1. Sembunyikan semua halaman
  document.querySelectorAll('.page').forEach(function (page) {
    page.classList.remove('active');
  });

  // 2. Tampilkan halaman yang dipilih
  document.getElementById('page-' + pageName).classList.add('active');

  // 3. Tandai menu yang sedang aktif (warna hijau)
  document.querySelectorAll('[data-page]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.page === pageName);
  });

  // 4. Di HP: tombol "Lainnya" ikut hijau jika halamannya ada di dalamnya
  moreButton.classList.toggle('active', morePages.includes(pageName));

  // 5. Ganti judul di bagian atas
  document.getElementById('page-title').textContent = pageTitles[pageName];

  // 6. Simpan nama halaman di alamat (agar tetap sama saat di-refresh)
  history.replaceState(null, '', '#' + pageName);

  closeMoreSheet();
  window.scrollTo(0, 0);
}


// ===== FUNGSI: BUKA / TUTUP PANEL "LAINNYA" =====
function openMoreSheet() {
  moreSheet.classList.add('open');
}

function closeMoreSheet() {
  moreSheet.classList.remove('open');
}


// ===== FUNGSI: TAMPILKAN TANGGAL HARI INI =====
function showTodayDate() {
  const today = new Date();
  const text = today.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
  document.getElementById('today-date').textContent = text;
}


// ===== MENGHUBUNGKAN TOMBOL DENGAN FUNGSI =====
document.querySelectorAll('[data-page]').forEach(function (button) {
  button.addEventListener('click', function () {
    showPage(button.dataset.page);
  });
});

moreButton.addEventListener('click', openMoreSheet);
moreBackdrop.addEventListener('click', closeMoreSheet);


// ===== SAAT APLIKASI PERTAMA DIBUKA =====
showTodayDate();

const startPage = location.hash.replace('#', '');
showPage(pageTitles[startPage] ? startPage : 'dashboard');