// =====================================================
// UI.JS — Alat bantu tampilan yang dipakai banyak fitur
// =====================================================

// ===== FORMAT RUPIAH: 20000 → "Rp20.000" =====
function formatRupiah(angka) {
  return 'Rp' + Number(angka || 0).toLocaleString('id-ID');
}

// ===== TANGGAL HARI INI: "2026-11-10" (waktu lokal, bukan UTC) =====
function todayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

// ===== FORMAT TANGGAL + JAM: "10 November 2026 pukul 23.05" =====
function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== NOTIFIKASI SINGKAT DI BAWAH LAYAR =====
function showToast(message) {
  let toast = document.getElementById('toast');

  // Buat elemennya sekali saja
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('show');

  clearTimeout(toast.hideTimer);
  toast.hideTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2500);
}