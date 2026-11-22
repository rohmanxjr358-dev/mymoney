// =====================================================
// VERSI.JS — "Apa yang baru" (muncul sekali setelah pembaruan)
// =====================================================
// Cara merilis versi baru:
//   1. Ubah APP_VERSION di pengaturan.js (misalnya '2.1')
//   2. Tambahkan catatan di paling atas CHANGELOG di bawah ini
//   3. Commit & Sync → semua pengguna melihat jendela ini sekali

const CHANGELOG = [
  {
    version: '2.5',
    date: 'November 2026',
    items: [
      { emoji: '🔒', title: 'Kunci dengan PIN', text: 'Opsional: PIN 4 angka + kode pemulihan jika lupa. Pasang di Pengaturan → Keamanan.' },
      { emoji: '⏱️', title: 'Terkunci otomatis', text: 'MyMoney terkunci lagi setelah ditinggal (langsung, 1 menit, atau 5 menit — kamu yang pilih).' }
    ]
  },
  {
    version: '2.4',
    date: 'November 2026',
    items: [
      { emoji: '💬', title: 'Status satu kalimat', text: 'Kartu saldo langsung menjawab: hari ini masih boleh pakai berapa, dan berapa hari lagi kiriman berikutnya.' },
      { emoji: '💌', title: 'Kiriman sekali ketuk', text: 'Saat tanggal kiriman tiba, ketuk "Sudah" — uang bulanan langsung tercatat.' },
      { emoji: '📋', title: 'Rencana bulan ini otomatis', text: 'Wajib bayar, tabungan, dan jatah jajan per pekan dibuat otomatis (meniru bulan lalu). Tinggal cek dan ketuk Oke.' },
      { emoji: '🗂️', title: 'Istilah & menu lebih simpel', text: 'Uang di dompet · Tabungan · Wajib bayar · Jatah harian. Menu bawah: Beranda · Riwayat · Laporan · Tabungan.' }
    ]
  },
  {
    version: '2.3',
    date: 'November 2026',
    items: [
      { emoji: '🛟', title: 'Cadangan otomatis', text: 'Datamu disalin otomatis setiap hari (2 hari terakhir). Bisa dikembalikan di Pengaturan jika ada yang salah.' },
      { emoji: '📤', title: 'Backup sekali ketuk', text: 'Tombol "Backup Sekarang" membuka menu Bagikan — simpan langsung ke Google Drive atau kirim ke WhatsApp sendiri.' },
      { emoji: '📶', title: 'Lancar walau sinyal lemah', text: 'Semua bagian aplikasi (termasuk grafik & ikon) tersimpan di HP, jadi tetap terbuka cepat saat offline atau sinyal jelek.' },
      { emoji: '🏷️', title: 'Kategori baru dari form ➕', text: 'Pilih "Buat kategori baru…" di daftar kategori tanpa harus ke Pengaturan.' }
    ]
  },
  {
    version: '2.2',
    date: 'November 2026',
    items: [
      { emoji: '➕', title: 'Satu form untuk semuanya', text: 'Mencatat dan mengubah transaksi sekarang lewat tombol ➕. Menu Transaksi jadi Riwayat.' },
      { emoji: '📊', title: 'Laporan jadi pusat analisis', text: 'Ringkasan, Kalender, dan semua Rekap bulanan ada di satu tempat: Laporan.' },
      { emoji: '🎯', title: 'Satu jatah harian', text: 'Kalau anggaran pekan ini sudah diatur, jatah harian di Jatah Aman ikut menyesuaikan — tidak ada lagi dua angka berbeda.' },
      { emoji: '❓', title: 'Kalender lebih jujur', text: 'Hari yang lupa dicatat ditandai "?" dan tidak dihitung sebagai hari hemat. Tandai ✓ jika memang tidak keluar uang.' },
      { emoji: '🐷', title: 'Lokasi tabungan', text: 'Pilih rekening tempat tabunganmu disimpan (Dompet → Kelola), supaya saldo dompet sama dengan di aplikasi bank.' },
      { emoji: '🧘', title: 'Dashboard lebih tenang', text: 'Pengingat dan rekap berbagi satu tempat, dan animasi dikurangi.' }
    ]
  },
  {
    version: '2.1',
    date: 'November 2026',
    items: [
      { emoji: '🔥', title: 'Streak mencatat', text: 'Catat setiap hari dan lihat apinya menyala di kartu saldo. Ada perayaan di hari ke-3, 7, 14, 30, dan seterusnya.' },
      { emoji: '🔔', title: 'Pengingat di Dashboard', text: 'Kalau hari ini belum mencatat, muncul ajakan kecil. Tidak belanja? Ketuk "Hari ini nggak keluar uang" supaya streak tetap jalan.' },
      { emoji: '🔓', title: 'Dashboard bertahap', text: 'Untuk pengguna baru, bagian Dashboard terbuka satu per satu seiring kamu mulai mencatat.' }
    ]
  },
  {
    version: '2.0',
    date: 'November 2026',
    items: [
      { emoji: '👛', title: 'Dompet & Rekening', text: 'Pisahkan saldo tunai, bank, dan e-wallet. Ada Pindah Uang (tarik tunai/top up) dan Sesuaikan saldo.' },
      { emoji: '➕', title: 'Tombol catat melayang', text: 'Ketuk ➕ di pojok kanan bawah untuk mencatat dari halaman mana pun.' },
      { emoji: '⚡', title: 'Catat Kilat', text: 'Pengeluaran rutin cukup sekali ketuk. Tahan tombolnya untuk ubah nominal.' },
      { emoji: '📅', title: 'Kalender pengeluaran', text: 'Tab baru di Transaksi: warna makin pekat = makin boros. Lihat juga pola harianmu.' },
      { emoji: '🤝', title: 'Utang & Patungan', text: 'Catat siapa pinjam apa, bagi patungan rata, dan kirim pengingat sopan lewat chat.' },
      { emoji: '🎁', title: 'Rekap bulanan', text: 'Cerita singkat perjalanan uangmu tiap awal bulan, lengkap dengan gelar bulananmu.' },
      { emoji: '👁️', title: 'Sembunyikan saldo', text: 'Ketuk ikon mata di kartu saldo saat ada yang ikut melihat layar.' },
      { emoji: '🌙', title: 'Tema gelap', text: 'Pilih Terang, Gelap, atau Ikuti HP di Pengaturan.' }
    ]
  }
];


// '2.1' > '2.0' → true
function isNewerVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function openWhatsNew(showAll) {
  // Tampilkan semua versi yang belum pernah dilihat (atau versi terbaru saja)
  const unseen = CHANGELOG.filter(function (c) { return isNewerVersion(c.version, appData.settings.lastSeenVersion); });
  const entries = showAll || !unseen.length ? [CHANGELOG[0]] : unseen;
  const entry = {
    version: entries[0].version,
    date: entries[0].date,
    items: entries.reduce(function (all, c) { return all.concat(c.items); }, [])
  };

  let modal = document.getElementById('whatsnew-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'whatsnew-modal';
    document.body.appendChild(modal);
    modal.addEventListener('click', function (event) {
      if (event.target.closest('[data-whatsnew-close]')) closeWhatsNew();
    });
  }

  modal.innerHTML = `
    <div class="modal-backdrop" data-whatsnew-close></div>
    <div class="modal-panel whatsnew" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
      <div class="whatsnew-head">
        <span class="whatsnew-spark">🎉</span>
        <div>
          <small>Versi ${entry.version} · ${entry.date}</small>
          <h3 id="whatsnew-title">Apa yang baru di MyMoney</h3>
        </div>
      </div>
      <div class="whatsnew-list">
        ${entry.items.map(function (item, i) {
          return `
            <div class="whatsnew-item" style="--i:${i}">
              <span class="whatsnew-emoji">${item.emoji}</span>
              <div><strong>${item.title}</strong><p>${item.text}</p></div>
            </div>
          `;
        }).join('')}
      </div>
      <button type="button" class="btn btn-primary btn-block" data-whatsnew-close>Mantap, coba sekarang</button>
    </div>
  `;

  requestAnimationFrame(function () { modal.classList.add('open'); });
}

function closeWhatsNew() {
  const modal = document.getElementById('whatsnew-modal');
  if (modal) modal.classList.remove('open');
  appData.settings.lastSeenVersion = APP_VERSION;
  saveData();
}

// Tombol "Apa yang baru" di Pengaturan → Tentang
document.addEventListener('click', function (event) {
  if (event.target.closest('[data-whatsnew-open]')) openWhatsNew(true);
});

// Tampilkan sekali setelah pembaruan (bukan untuk pengguna yang baru mulai)
if (appData.settings.onboarded && appData.settings.lastSeenVersion !== APP_VERSION) {
  setTimeout(openWhatsNew, 700);
}
