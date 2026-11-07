import { formatIDR, type AiUserContext } from '@/services/ai-context';

/**
 * Fast-path response handler untuk sapaan, identitas, dan data akun terverifikasi
 * tanpa membebani provider AI eksternal atau memicu timeout.
 */

export interface QuickUserContext {
  name: string;
  role: string;
  roleLabel: string;
}

// Regex sapaan sederhana (misal: "hai", "halo", "hello", "selamat pagi", dll)
const GREETING_REGEX =
  /^(hai|halo|hello|hi|hey|hei|p|ping|assalamu['’]?alaikum|assalamu alaikum|selamat\s+(pagi|siang|sore|malam))(\s+(ai|asisten|admin|bot))?[!.,?]*$/i;

// Regex pertanyaan bantuan sederhana (misal: "apa yang bisa kamu bantu?", "kamu bisa apa?", dll)
const HELP_REGEX =
  /^(apa\s+(saja\s+)?(yang\s+)?bisa\s+kamu\s+bantu\??|kamu\s+bisa\s+(bantu\s+)?apa\s*(saja)?\??|apa\s+fitur(mu)?\??|bisa\s+bantu\s+apa\s*(saja)?\??|bantuan\??)$/i;

// Regex pertanyaan identitas AI (misal: "Siapa Anda?", "Kamu siapa?", dll)
const BOT_IDENTITY_REGEX =
  /^(siapa\s+(kamu|anda|nama\s+(anda|kamu)|ai\s+ini)\??|kamu\s+siapa\??|anda\s+siapa\??|apa\s+nama\s+anda\??)$/i;

// Regex pertanyaan identitas pengguna (misal: "Siapa saya?", "Saya ini siapa?", dll)
const USER_IDENTITY_REGEX =
  /^(siapa\s+saya\??|saya\s+(ini\s+)?siapa\??|apa\s+peran\s+saya\??|saya\s+login\s+sebagai\s+apa\??)$/i;

// Regex pertanyaan saldo anggota
const BALANCE_REGEX =
  /^(berapa\s+(sisa\s+)?(saldo|tabungan)\s+(saya|ku)(\s+sekarang)?\??|(cek|lihat|tampilkan)\s+(saldo|tabungan)\??|(saldo|tabungan)\s+(saya|ku)\s+berapa\??|sisa\s+saldo(\s+(saya|ku))?\??)$/i;

// Regex pertanyaan total berat setoran anggota
const WEIGHT_REGEX =
  /^(berapa\s+(total\s+)?berat\s+(setoran|sampah)\s+(saya|ku)(\s+sekarang)?\??|total\s+berat\s+(setoran|sampah)(\s+(saya|ku))?(\s+sekarang)?\??|berapa\s+kg\s+(sampah\s+)?(yang\s+sudah\s+)?(saya|ku)\s+setor(kan)?\??)$/i;

// Regex pertanyaan apakah pernah bertransaksi
const TRANSACTION_CHECK_REGEX =
  /^(apakah\s+(saya|ku)\s+pernah\s+bertransaksi(\s+dengan\s+bank\s+sampah)?\??|apakah\s+(saya|ku)\s+(punya|memiliki)\s+transaksi(\s+dengan\s+bank\s+sampah)?\??|pernahkah\s+(saya|ku)\s+bertransaksi(\s+dengan\s+bank\s+sampah)?\??|apakah\s+(saya|ku)\s+sudah\s+pernah\s+setor(kan)?\s+sampah\??)$/i;

// Regex pertanyaan riwayat transaksi
const TRANSACTION_HISTORY_REGEX =
  /^(bagaimana\s+riwayat\s+transaksi\s+(saya|ku)\??|riwayat\s+transaksi(\s+(saya|ku))?\??|(lihat|tampilkan|cek)\s+riwayat\s+transaksi(\s+(saya|ku))?\??|riwayat\s+setoran(\s+(saya|ku))?\??)$/i;

// Regex pertanyaan daftar anggota aktif untuk Admin
const ADMIN_ACTIVE_MEMBERS_REGEX =
  /^(siapa\s+saja\s+anggota(\s+bank\s+sampah)?\s+yang\s+aktif\??|daftar\s+anggota(\s+bank\s+sampah)?\s+aktif\??|siapa\s+anggota\s+aktif\??)$/i;

/**
 * Cek apakah pesan pengguna dapat dijawab langsung melalui fast-path.
 * Mengembalikan string balasan jika cocok, atau null jika perlu diproses oleh model AI.
 */
export function getQuickAiResponse(
  message: string,
  user: QuickUserContext,
  context?: AiUserContext | null
): string | null {
  if (!message) return null;
  const trimmed = message.trim();

  // 1. Sapaan sederhana
  if (GREETING_REGEX.test(trimmed)) {
    if (user.role === 'ADMIN') {
      return `Halo, ${user.name}! 👋 Saya AI Asisten Bank Sampah Digital. Ada yang bisa saya bantu terkait operasional bank sampah, data anggota, atau ringkasan sistem hari ini?`;
    }
    if (user.role === 'MANAGER') {
      return `Halo, ${user.name}! 👋 Saya AI Asisten Bank Sampah Digital. Ada yang bisa saya bantu seputar pencatatan setoran, proses penarikan, atau operasional hari ini?`;
    }
    return `Halo, ${user.name}! 👋 Saya AI Asisten Bank Sampah Digital. Ada yang bisa saya bantu seputar tabungan sampah, setoran, penarikan, atau pemilahan sampah hari ini?`;
  }

  // 2. Pertanyaan bantuan / kapabilitas umum
  if (HELP_REGEX.test(trimmed)) {
    if (user.role === 'ADMIN') {
      return `Saya adalah AI Asisten Bank Sampah Digital. Sebagai **Admin Sistem**, saya dapat membantu Anda dengan:
- Memberikan ringkasan data operasional (total anggota aktif, daftar anggota aktif, total sampah, dan tabungan bersih anggota).
- Menjelaskan fitur dan hak akses pada Dashboard Admin, Manajemen Anggota, Jenis Sampah, dan Laporan.
- Memberikan panduan pengelolaan sampah, pemilahan sampah, dan bantuan teknis umum.

Ada informasi tertentu yang ingin Anda periksa atau tanyakan?`;
    }
    if (user.role === 'MANAGER') {
      return `Saya adalah AI Asisten Bank Sampah Digital. Sebagai **Pengelola Bank Sampah**, saya dapat membantu Anda dengan:
- Alur pencatatan setoran sampah anggota dan perhitungan nilai tabungan.
- Alur verifikasi dan proses pengajuan penarikan saldo anggota.
- Panduan jenis sampah resmi, satuan, dan aturan operasional bank sampah.

Ada yang bisa saya bantu sekarang?`;
    }
    return `Saya adalah AI Asisten Bank Sampah Digital. Sebagai **Anggota Bank Sampah**, saya dapat membantu Anda dengan:
- Memeriksa informasi saldo tabungan dan riwayat transaksi setoran Anda.
- Panduan cara memilah sampah di rumah dan jenis sampah yang diterima beserta harga resminya.
- Alur pengajuan penarikan tabungan dan penggunaan menu aplikasi.
- Edukasi daur ulang dan tips ramah lingkungan.

Ada yang ingin Anda tanyakan hari ini?`;
  }

  // 3. Pertanyaan identitas AI
  if (BOT_IDENTITY_REGEX.test(trimmed)) {
    return 'Saya adalah AI Asisten Bank Sampah Digital. Saya membantu Anda mendapatkan informasi tentang pengelolaan sampah, pemilahan sampah, bank sampah, transaksi, dan penggunaan sistem Bank Sampah Digital.';
  }

  // 4. Pertanyaan identitas pengguna
  if (USER_IDENTITY_REGEX.test(trimmed)) {
    if (user.role === 'ADMIN') {
      return `Anda adalah ${user.name}, seorang ${user.roleLabel} (Admin). Anda memiliki akses ke fitur administrasi seperti Dashboard Admin, Manajemen Anggota, Kategori Sampah, dan Laporan.`;
    }
    if (user.role === 'MANAGER') {
      return `Anda adalah ${user.name}, seorang ${user.roleLabel} (Pengelola). Anda memiliki akses ke Dashboard Pengelola, Catat Setoran, Proses Penarikan, dan Data Anggota.`;
    }
    return `Anda adalah ${user.name}, seorang ${user.roleLabel} (Anggota). Anda dapat mengakses Dashboard, Riwayat Transaksi, Ajukan Penarikan, dan Tanya AI.`;
  }

  // 5. Pertanyaan berbasis Data Konteks Akun Sendiri (MEMBER)
  if (context?.ownAccount) {
    const a = context.ownAccount;

    // a. Cek Saldo
    if (BALANCE_REGEX.test(trimmed)) {
      return `Halo, ${user.name}! Saldo tabungan Bank Sampah Anda saat ini adalah **${formatIDR(a.saldoTersedia)}** (tersedia untuk ditarik).

Ringkasan tabungan Anda:
- **Total Nilai Setoran:** ${formatIDR(a.totalSetoran)}
- **Total Penarikan Selesai:** ${formatIDR(a.totalDitarik)}
${a.penarikanMenunggu > 0 ? `- **Penarikan Menunggu Diproses:** ${formatIDR(a.penarikanMenunggu)}\n` : ''}
Anda dapat mengajukan penarikan saldo melalui menu **Ajukan Penarikan**.`;
    }

    // b. Cek Total Berat Setoran
    if (WEIGHT_REGEX.test(trimmed)) {
      if (a.jumlahTransaksi === 0 || a.totalBeratKg === 0) {
        return `Halo, ${user.name}! Anda belum memiliki catatan setoran sampah di Bank Sampah Digital (total berat: **0 kg**).`;
      }
      return `Halo, ${user.name}! Hingga saat ini, total berat sampah yang telah Anda setorkan adalah **${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(a.totalBeratKg)} kg** dari total **${a.jumlahTransaksi} transaksi** setoran yang berhasil dicatat.`;
    }

    // c. Cek Apakah Pernah Bertransaksi
    if (TRANSACTION_CHECK_REGEX.test(trimmed)) {
      if (a.jumlahTransaksi > 0) {
        return `Ya, ${user.name}, Anda sudah pernah bertransaksi dengan Bank Sampah Digital.

Berikut ringkasan transaksi Anda yang tercatat di sistem:
- **Jumlah Transaksi Selesai:** ${a.jumlahTransaksi} kali
- **Total Berat Sampah:** ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(a.totalBeratKg)} kg
- **Total Nilai Hasil Setoran:** ${formatIDR(a.totalSetoran)}
- **Saldo Tersedia Saat Ini:** ${formatIDR(a.saldoTersedia)}

Detail tanggal dan jenis sampah dapat Anda lihat langsung pada menu **Riwayat Transaksi**.`;
      } else {
        return `Halo, ${user.name}! Anda belum pernah melakukan transaksi setoran sampah dengan Bank Sampah Digital.

Untuk mulai menyetorkan sampah dan mendapatkan tabungan:
1. Pilah sampah di rumah (kardus, botol plastik, kaleng, dll).
2. Bawa sampah yang sudah dipilah ke lokasi Bank Sampah.
3. Pengelola akan menimbang dan mencatat setoran Anda ke sistem, lalu saldo tabungan otomatis masuk ke akun Anda.`;
      }
    }

    // d. Cek Riwayat Transaksi
    if (TRANSACTION_HISTORY_REGEX.test(trimmed)) {
      if (a.jumlahTransaksi === 0) {
        return `Halo, ${user.name}! Anda belum memiliki riwayat transaksi setoran sampah di Bank Sampah Digital.

Setelah Anda menyetorkan sampah kepada pengelola, rincian tanggal, kategori sampah, berat, dan rupiah akan otomatis tercatat dan dapat dilihat pada menu **Riwayat Transaksi**.`;
      }

      let txList = '';
      if (a.recentTransactions && a.recentTransactions.length > 0) {
        txList =
          '**Transaksi Setoran Terakhir:**\n' +
          a.recentTransactions
            .map(
              (tx, i) =>
                `${i + 1}. **${tx.date}** — ${tx.categoryName} (${tx.weight} kg) = ${formatIDR(tx.totalValue)}`
            )
            .join('\n') +
          '\n\n';
      }

      return `Berikut adalah ringkasan riwayat transaksi Anda di Bank Sampah Digital:

- **Total Transaksi Selesai:** ${a.jumlahTransaksi} transaksi
- **Total Berat Sampah:** ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(a.totalBeratKg)} kg
- **Total Nilai Hasil Setoran:** ${formatIDR(a.totalSetoran)}
- **Saldo Tersedia Saat Ini:** ${formatIDR(a.saldoTersedia)}

${txList}Untuk melihat seluruh riwayat secara lengkap beserta statusnya, silakan buka menu **Riwayat Transaksi**.`;
    }
  }

  // 6. Pertanyaan Khusus Admin (Daftar Anggota Aktif)
  if (context?.adminData && ADMIN_ACTIVE_MEMBERS_REGEX.test(trimmed)) {
    const d = context.adminData;
    if (d.daftarAnggotaAktif.length === 0) {
      return 'Berdasarkan data Bank Sampah saat ini, belum ada anggota dengan status aktif.';
    }
    const list = d.daftarAnggotaAktif.map((n, i) => `${i + 1}. ${n}`).join('\n');
    return `Berdasarkan data Bank Sampah saat ini, terdapat **${d.totalAnggotaAktif} anggota aktif**:\n\n${list}\n\nData ini berdasarkan status anggota yang tercatat di sistem.`;
  }

  return null;
}
