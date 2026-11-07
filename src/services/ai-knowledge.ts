/**
 * Knowledge base terstruktur untuk AI Assistant Bank Sampah Digital.
 *
 * TUJUAN
 * Memberi AI gambaran lengkap tentang seluruh sistem dan fiturnya supaya AI bisa
 * menjawab SEMUA pertanyaan pengguna yang berkaitan dengan aplikasi
 * (menu, alur kerja, hak akses, aturan bisnis, status, kesalahan umum).
 *
 * CATATAN DESAIN
 * - Modul ini murni data dan renderer teks. Tidak ada query database di sini,
 *   sehingga tidak menambah beban query dan tidak mengubah perilaku data yang
 *   sudah ada di `ai-context.ts`.
 * - Blok ini adalah Deskripsi Sistem (dokumentasi fitur dan aturan), BUKAN data
 *   pengguna. Data pengguna yang nyata tetap hanya berasal dari blok DATA KONTEKS.
 * - Struktur data dipisah dari teks prompt supaya mudah dirawat: menambah atau
 *   mengubah fitur aplikasi cukup dilakukan di file ini.
 */

export type AiRole = 'ADMIN' | 'MANAGER' | 'MEMBER';

export const ROLE_LABEL: Record<AiRole, string> = {
  ADMIN: 'Admin Sistem',
  MANAGER: 'Pengelola Bank Sampah',
  MEMBER: 'Anggota Bank Sampah',
};

// ─── Kontak resmi Bank Sampah Digital ────────────────────────────────────────

/**
 * Nomor telepon/WhatsApp resmi Admin Bank Sampah Digital.
 * Perbarui hanya di sini agar konsisten di seluruh pengetahuan AI.
 */
export const ADMIN_CONTACT = {
  name: 'Admin Bank Sampah',
  number: '628388810329',
  whatsappUrl: 'https://wa.me/628388810329',
  whatsappRegisterUrl:
    'https://wa.me/628388810329?text=Halo%20Admin%20Bank%20Sampah%2C%20saya%20ingin%20mendaftar%20menjadi%20anggota%20Bank%20Sampah.%20Mohon%20informasi%20mengenai%20proses%20pendaftarannya',
};

// ─── Profil aplikasi ──────────────────────────────────────────────────────────

export const APP_PROFILE: string[] = [
  'Nama aplikasi: Bank Sampah Digital, yaitu aplikasi bank sampah digital untuk desa atau kelurahan.',
  'Fungsi utama: mencatat setoran sampah anggota, mengubahnya menjadi saldo tabungan dalam rupiah, memproses pengajuan penarikan saldo, mengelola data anggota, mengelola jenis sampah beserta harga, dan menyusun laporan.',
  'Cara kerja inti: anggota menyerahkan sampah kepada pengelola, pengelola mencatat setoran sehingga saldo anggota bertambah, lalu anggota mengajukan penarikan dan pengelola menyetujui atau menolak.',
  'Satuan nilai adalah rupiah (Rp). Satuan berat adalah kilogram (kg), dan dapat berbeda bila Admin mengubah satuan jenis sampah.',
  'Aplikasi ini berbentuk web. Di komputer menu berada di sisi kiri, sedangkan di ponsel menu dibuka lewat tombol menu di pojok kiri atas.',
  'Semua menu hanya dapat dibuka setelah berhasil login. Setiap pengguna otomatis diarahkan ke halaman sesuai perannya.',
];

// ─── Peran, menu, dan hak akses ───────────────────────────────────────────────

export interface RoleMenuItem {
  label: string;
  path: string;
  purpose: string;
}

export interface RoleGuide {
  role: AiRole;
  landingPath: string;
  menus: RoleMenuItem[];
  capabilities: string[];
  restrictions: string[];
}

export const ROLE_GUIDES: RoleGuide[] = [
  {
    role: 'ADMIN',
    landingPath: '/admin',
    menus: [
      {
        label: 'Dashboard',
        path: '/admin',
        purpose:
          'Ringkasan seluruh bank sampah: total anggota aktif, total sampah terkumpul dalam kilogram, jumlah transaksi selesai, total nilai tabungan, dan aktivitas transaksi terbaru.',
      },
      {
        label: 'Manajemen Anggota',
        path: '/admin/anggota',
        purpose:
          'Daftar semua anggota beserta saldo dan total berat sampahnya. Admin dapat mencari anggota, menambah anggota baru, mengubah data, mengaktifkan atau menonaktifkan anggota, dan membuka detail satu anggota.',
      },
      {
        label: 'Jenis Sampah',
        path: '/admin/kategori',
        purpose:
          'Master data jenis sampah beserta satuan dan harga beli per satuan. Admin dapat menambah, mengubah, serta mengaktifkan atau menonaktifkan jenis sampah.',
      },
      {
        label: 'Laporan',
        path: '/admin/laporan',
        purpose:
          'Laporan transaksi lengkap dengan penyaring rentang tanggal, jenis sampah, anggota, dan status, ditambah rekap per jenis sampah, tabel detail, navigasi halaman, ekspor CSV, dan cetak PDF.',
      },
    ],
    capabilities: [
      'Menambah, mengubah, serta mengaktifkan dan menonaktifkan anggota.',
      'Menambah, mengubah, serta mengaktifkan dan menonaktifkan jenis sampah beserta harganya.',
      'Melihat seluruh data anggota, termasuk saldo dan riwayat transaksinya.',
      'Melihat dan mengunduh laporan seluruh transaksi.',
    ],
    restrictions: [
      'Menu Admin tidak memuat pencatatan setoran maupun pemrosesan penarikan karena keduanya berada di area Pengelola. Jangan mengarang menu setoran di area Admin.',
      'Anggota dan jenis sampah tidak dapat dihapus permanen, hanya dapat dinonaktifkan agar riwayat lama tetap utuh.',
      'Admin tidak dapat melihat atau mengubah kata sandi anggota.',
    ],
  },
  {
    role: 'MANAGER',
    landingPath: '/pengelola',
    menus: [
      {
        label: 'Dashboard',
        path: '/pengelola',
        purpose:
          'Rekap operasional hari ini: nilai setoran hari ini, total berat hari ini, jumlah transaksi hari ini, dan transaksi terbaru.',
      },
      {
        label: 'Catat Setoran',
        path: '/pengelola/setoran',
        purpose:
          'Mencatat setoran sampah anggota dalam tiga langkah: pilih anggota, pilih jenis sampah dan berat, lalu konfirmasi.',
      },
      {
        label: 'Proses Penarikan',
        path: '/pengelola/penarikan',
        purpose:
          'Memeriksa daftar pengajuan penarikan, menyaring berdasarkan status, lalu menyetujui atau menolak setiap pengajuan.',
      },
      {
        label: 'Data Anggota',
        path: '/pengelola/anggota',
        purpose:
          'Daftar anggota beserta saldo dan detail satu anggota. Menu ini hanya untuk dibaca, bukan untuk menambah atau mengubah data.',
      },
      {
        label: 'Laporan',
        path: '/pengelola/laporan',
        purpose:
          'Laporan transaksi dengan penyaring rentang tanggal, jenis sampah, anggota, dan status, lengkap dengan rekap, ekspor CSV, dan cetak PDF.',
      },
    ],
    capabilities: [
      'Mencatat setoran sampah anggota sehingga saldo anggota bertambah.',
      'Menyetujui atau menolak pengajuan penarikan anggota.',
      'Melihat daftar anggota, saldo, dan riwayat transaksinya.',
      'Melihat laporan transaksi beserta ekspor dan cetaknya.',
    ],
    restrictions: [
      'Tidak dapat menambah, mengubah, atau menonaktifkan anggota.',
      'Tidak dapat mengubah harga atau data jenis sampah karena itu tugas Admin.',
      'Tidak dapat menghapus transaksi atau penarikan yang sudah tercatat.',
    ],
  },
  {
    role: 'MEMBER',
    landingPath: '/dashboard',
    menus: [
      {
        label: 'Dashboard',
        path: '/dashboard',
        purpose:
          'Ringkasan tabungan pribadi: saldo saat ini, penarikan yang menunggu diproses, total berat sampah yang pernah disetor, jumlah transaksi selesai, transaksi terakhir, dan pintasan ke menu lain.',
      },
      {
        label: 'Riwayat Transaksi',
        path: '/dashboard/transaksi',
        purpose:
          'Daftar seluruh setoran milik anggota sendiri beserta tanggal, jenis sampah, berat, harga, total, dan status, ditambah riwayat pengajuan penarikan dan statusnya.',
      },
      {
        label: 'Ajukan Penarikan',
        path: '/dashboard/penarikan',
        purpose:
          'Form pengajuan penarikan saldo. Saldo tersedia ditampilkan, dan nominal tidak boleh melebihi saldo tersebut.',
      },
      {
        label: 'Tanya AI',
        path: '/dashboard/ai',
        purpose:
          'Mengobrol dengan asisten AI untuk bertanya apa saja: cara memakai fitur aplikasi, kunci cara menyetor sampah, dan edukasi pemilahan sampah serta pengelolaan lingkungan.',
      },
    ],
    capabilities: [
      'Melihat seluruh datanya sendiri, yaitu saldo, berat, jumlah transaksi, dan riwayat.',
      'Mengajukan penarikan saldo, lalu memantau status pengajuannya.',
      'Bertanya kepada asisten AI tentang fitur aplikasi dan pengelolaan sampah.',
    ],
    restrictions: [
      'Tidak dapat mencatat setoran sendiri karena setoran harus dicatat oleh pengelola saat sampah diterima.',
      'Tidak dapat menyetujui atau menolak penarikan, termasuk penarikannya sendiri.',
      'Tidak dapat mengubah harga jenis sampah, menambah anggota, atau membuka menu pengelola dan admin.',
      'Tidak dapat melihat data anggota lain karena sistem memang tidak menyediakan akses tersebut.',
    ],
  },
];

// ─── Panduan langkah setiap fitur ──────────────────────────────────────────────

export interface FeatureGuide {
  title: string;
  who: string;
  menu: string;
  purpose: string;
  steps: string[];
  notes: string[];
}

export const FEATURE_GUIDES: FeatureGuide[] = [
  {
    title: 'Masuk atau Login',
    who: 'Semua pengguna',
    menu: 'Halaman /login',
    purpose: 'Membuka akses ke aplikasi sesuai peran masing-masing.',
    steps: [
      'Buka halaman Login.',
      'Isi kolom Email. Email dipakai sebagai nama pengguna atau akun, dan wajib unik.',
      'Isi kolom Password.',
      'Klik tombol Masuk.',
      'Sistem otomatis mengarahkan ke dashboard sesuai peran: Admin ke dashboard Admin, Pengelola ke dashboard Pengelola, dan Anggota ke dashboard Anggota.',
    ],
    notes: [
      `Akun anggota dibuat oleh Admin, bukan mendaftar sendiri. Anggota yang belum punya akun harus minta ditambahkan oleh Admin. Untuk pendaftaran, hubungi ${ADMIN_CONTACT.name} melalui WhatsApp ${ADMIN_CONTACT.number} atau langsung klik [Chat Admin via WhatsApp](${ADMIN_CONTACT.whatsappRegisterUrl}).`,
      'Akun yang dinonaktifkan tidak dapat login meskipun email dan password-nya sudah benar.',
      'Sesi login berlaku satu hari. Setelah berakhir, pengguna diminta masuk lagi.',
      'Kolom Email berisi nama akun, bukan nama lengkap, jadi penulisan email harus tepat.',
    ],
  },
  {
    title: 'Keluar atau Logout',
    who: 'Semua pengguna',
    menu: 'Tombol Keluar di bagian bawah menu samping',
    purpose: 'Mengakhiri sesi login.',
    steps: ['Klik tombol Keluar di bagian bawah menu samping.'],
    notes: ['Setelah keluar, pengguna harus login kembali untuk masuk ke aplikasinya.'],
  },
  {
    title: 'Berpindah menu',
    who: 'Semua pengguna',
    menu: 'Menu samping, atau tombol menu di ponsel',
    purpose: 'Menuju ke setiap fitur aplikasi.',
    steps: [
      'Di komputer, pilih menu di sisi kiri. Di ponsel, ketuk tombol menu di pojok kiri atas lalu pilih menu yang diinginkan.',
      'Menu yang sedang aktif akan menyala di sisi kiri dan tampil sebagai judul di bagian atas.',
      'Gunakan tombol Keluar di menu samping untuk keluar dari aplikasi.',
    ],
    notes: [
      'Menu yang muncul berbeda untuk setiap peran. Anggota hanya melihat empat menu miliknya sendiri.',
      'Daftar menu anggota adalah Dashboard, Riwayat Transaksi, Ajukan Penarikan, dan Tanya AI.',
    ],
  },
  {
    title: 'Dashboard Anggota',
    who: 'Anggota',
    menu: 'Menu Dashboard',
    purpose: 'Melihat kondisi tabungan sampah sendiri.',
    steps: [
      'Klik menu Dashboard.',
      'Periksa kartu Saldo Saat Ini. Bila ada penarikan yang menunggu, catatan nominal menunggu ikut ditampilkan.',
      'Periksa Total Berat Disetor dalam kilogram sejak pertama bergabung.',
      'Periksa Jumlah Transaksi, yaitu jumlah setoran yang sudah selesai.',
      'Periksa daftar Transaksi Terakhir, lalu gunakan pintasan Aksi Cepat untuk membuka Riwayat Transaksi, Ajukan Penarikan, atau Tanya AI.',
    ],
    notes: [
      'Anggota tidak dapat mencatat setoran sendiri. Saldo bertambah setelah pengelola mencatat setorannya.',
      'Transaksi berstatus Selesai sudah menambah saldo, sedangkan transaksi berstatus Dibatalkan tidak menambah saldo.',
    ],
  },
  {
    title: 'Riwayat Transaksi Anggota',
    who: 'Anggota',
    menu: 'Menu Riwayat Transaksi',
    purpose: 'Memeriksa seluruh setoran dan pengajuan penarikan milik anggota sendiri.',
    steps: [
      'Klik menu Riwayat Transaksi.',
      'Pada tabel setoran, periksa tanggal, jenis sampah, berat, harga per satuan, nilai total, dan status setiap transaksi.',
      'Pada tabel penarikan, periksa tanggal pengajuan, nominal, dan status pengajuan.',
      'Ubah filter bila ingin menyaring status tertentu.',
    ],
    notes: [
      'Data yang tampil hanya milik anggota yang sedang login.',
      'Harga yang tampil adalah harga saat transaksi dicatat, bukan harga yang berlaku hari ini.',
      'Transaksi berstatus Selesai sudah menambah saldo, sedangkan transaksi berstatus Dibatalkan tidak menambah saldo.',
      'Pengajuan penarikan berstatus Menunggu belum cair dan menunggu keputusan pengelola.',
    ],
  },
  {
    title: 'Mengajukan Penarikan',
    who: 'Anggota',
    menu: 'Menu Ajukan Penarikan',
    purpose: 'Mengubah saldo tabungan menjadi uang.',
    steps: [
      'Klik menu Ajukan Penarikan.',
      'Periksa nilai Saldo Tersedia yang ditampilkan di atas form.',
      'Isi kolom Nominal Penarikan dalam rupiah, misalnya 50000.',
      'Klik tombol Ajukan Penarikan.',
      'Setelah berhasil, sistem mengarahkan ke Riwayat Transaksi agar hasilnya dapat diperiksa.',
    ],
    notes: [
      'Nominal harus lebih besar dari nol, tidak boleh melebihi Saldo Tersedia, dan tidak boleh membuat saldo menjadi negatif.',
      'Pengajuan baru berstatus Menunggu dan uangnya belum cair. Cair hanya setelah disetujui pengelola.',
      'Saldo tersedia langsung dikurangi selama pengajuan berstatus Menunggu agar dana tidak dipakai dua kali.',
      'Anggota boleh mengajukan lebih dari sekali, selama total semua pengajuan yang menunggu tidak melebihi Saldo Tersedia.',
      'Bila pengajuan ditolak, dananya otomatis kembali ke Saldo Tersedia.',
      'Anggota tidak dapat membatalkan pengajuannya sendiri dari aplikasi, sehingga perlu menghubungi pengelola bila ada kendala.',
    ],
  },
  {
    title: 'Mencatat Setoran Sampah',
    who: 'Pengelola, dan Admin juga boleh',
    menu: 'Menu Catat Setoran atau pintasan Catat Setoran di dashboard pengelola',
    purpose: 'Mencatat sampah yang diterima dari anggota sehingga saldo anggota bertambah.',
    steps: [
      'Buka menu Catat Setoran.',
      'Langkah satu Pilih Anggota: cari anggota dengan kolom cari nama, email, atau nomor kontak, klik kartu anggota yang tepat, lalu klik Lanjut.',
      'Langkah dua Isi Setoran: pilih Jenis Sampah dari daftar, isi Berat dalam kilogram memakai titik untuk desimal, lalu klik Lihat Preview.',
      'Langkah tiga Konfirmasi: periksa anggota, jenis sampah, harga per satuan, berat, tanggal, dan estimasi total, lalu klik Konfirmasi dan Simpan.',
      'Setelah berhasil, layar menampilkan ringkasan nilai diterima, dan saldo anggota otomatis bertambah.',
    ],
    notes: [
      'Menu ini berada di area Pengelola. Admin memang berwenang mencatat setoran, tetapi menu Catat Setoran tidak muncul di sidebar Admin, sehingga Admin perlu membuka area Pengelola atau meminta pengelola mencatatkannya.',
      'Nilai total dihitung di server sebagai berat dikali harga satuan saat itu, lalu dibulatkan ke dua angka di belakang koma. Angka di layar hanya estimasi.',
      'Harga satuan tersimpan pada transaksi sebagai harga saat itu. Bila Admin kemudian mengubah harga, transaksi lama tetap memakai harga lamanya.',
      'Berat wajib lebih besar dari nol dan tidak boleh melebihi 10.000 kilogram per transaksi.',
      'Hanya anggota berstatus Aktif dan jenis sampah yang aktif yang dapat dipilih.',
      'Bila muncul pesan bahwa anggota nonaktif, minta Admin mengaktifkan keanggotaan anggota tersebut lebih dulu.',
      'Transaksi yang sudah tersimpan tidak dapat dihapus dari aplikasi.',
    ],
  },
  {
    title: 'Memproses Pengajuan Penarikan',
    who: 'Pengelola, dan Admin juga boleh',
    menu: 'Menu Proses Penarikan',
    purpose: 'Memutuskan apakah uang anggota dicairkan atau dikembalikan.',
    steps: [
      'Buka menu Proses Penarikan.',
      'Pilih filter Semua, Menunggu, Selesai, atau Ditolak untuk menyaring daftar.',
      'Periksa nama anggota, nominal, dan tanggal pengajuan.',
      'Klik tombol Setuju untuk menyetujui, atau tombol Tolak untuk menolak, lalu jawab konfirmasi yang muncul.',
      'Status berubah menjadi Selesai atau Ditolak, dan nama serta waktu pemroses tersimpan.',
    ],
    notes: [
      'Hanya pengajuan berstatus Menunggu yang memiliki tombol Setuju dan Tolak.',
      'Satu pengajuan tidak dapat diproses dua kali karena setelah diproses tombol aksinya hilang.',
      'Setuju berarti penarikan dianggap selesai dan mengurangi saldo anggota.',
      'Tolak berarti pengajuan batal dan dananya kembali ke Saldo Tersedia anggota.',
      'Setelah diproses, keputusan tidak dapat diubah dari aplikasi.',
    ],
  },
  {
    title: 'Menambah Anggota Baru',
    who: 'Admin',
    menu: 'Menu Manajemen Anggota',
    purpose: 'Membuat akun anggota agar dapat login dan menyetor sampah.',
    steps: [
      'Buka menu Manajemen Anggota.',
      'Klik tombol tambah anggota.',
      'Isi Nama Lengkap, kolom ini wajib.',
      'Isi Email sebagai nama pengguna, dan pastikan belum dipakai akun lain.',
      'Isi Password, atau kosongkan bila memakai password bawaan yang tertera pada formulir.',
      'Isi Nomor Kontak dan Alamat sebagai data tambahan yang bersifat opsional.',
      'Klik Simpan, lalu cari anggota melalui kolom pencarian bila perlu.',
    ],
    notes: [
      'Akun baru otomatis berstatus Aktif dan berperan sebagai Anggota, bukan Admin atau Pengelola.',
      'Satu email hanya dapat dipakai oleh satu akun.',
      'Bila kolom password dikosongkan, sistem memakai password bawaan yang tertulis di formulir. Password ini sebaiknya langsung diganti atau disampaikan hanya kepada pemilik akun.',
      'Jangan membagikan email dan password anggota kepada siapa pun.',
    ],
  },
  {
    title: 'Mengubah Data dan Status Anggota',
    who: 'Admin',
    menu: 'Menu Manajemen Anggota',
    purpose: 'Memperbarui informasi anggota dan mengendalikan akses masuknya.',
    steps: [
      'Buka menu Manajemen Anggota.',
      'Cari anggota dengan kolom pencarian bila perlu.',
      'Klik tombol ubah untuk mengganti Nama, Email, Nomor Kontak, atau Alamat, lalu klik Simpan.',
      'Klik tombol status untuk mengembalikan status dari Aktif menjadi Nonaktif atau sebaliknya.',
      'Buka detail anggota bila perlu melihat saldo, total berat, dan riwayat transaksinya.',
    ],
    notes: [
      'Email tidak boleh sama dengan akun lain.',
      'Menonaktifkan anggota menyebabkan akunnya tidak dapat login dan tidak dapat menerima setoran baru.',
      'Saldo, transaksi, dan riwayat anggota tidak hilang ketika dinonaktifkan.',
      'Mengaktifkan kembali anggota langsung mengembalikan aksesnya.',
      'Tombol hapus tidak tersedia supaya riwayat pembukuan tetap utuh.',
    ],
  },
  {
    title: 'Mengelola Jenis Sampah dan Harga',
    who: 'Admin',
    menu: 'Menu Jenis Sampah',
    purpose: 'Menentukan jenis sampah yang diterima beserta satuan dan harga belinya.',
    steps: [
      'Buka menu Jenis Sampah.',
      'Klik tombol tambah jenis sampah.',
      'Isi Nama Jenis Sampah, misalnya Kardus Bekas.',
      'Isi Satuan, biasanya kg.',
      'Isi Harga per Satuan dalam rupiah, kolom ini wajib dan tidak boleh negatif.',
      'Klik Simpan. Untuk mengubah data lama, klik tombol ubah. Untuk menonaktifkan, klik tombol status.',
    ],
    notes: [
      'Nama jenis sampah harus unik.',
      'Perubahan harga hanya berlaku untuk transaksi baru. Transaksi lama tetap memakai harga saat dicatat.',
      'Jenis sampah yang dinonaktifkan tidak dapat dipilih lagi untuk transaksi baru, tetapi transaksinya tetap tercatat.',
      'Harga beli pada sistem hanya merupakan nilai teknis. Ketentuan setempat seperti jam operasional dan syarat berat minimum tetap dikonfirmasi langsung kepada pengelola bank sampah.',
    ],
  },
  {
    title: 'Membuka Laporan dan Mengekspor Data',
    who: 'Admin dan Pengelola',
    menu: 'Menu Laporan',
    purpose: 'Menganalisis dan menyajikan data transaksi.',
    steps: [
      'Buka menu Laporan.',
      'Atur penyaring: Mulai Tanggal, Sampai Tanggal, Jenis Sampah, Anggota, dan Status Transaksi.',
      'Klik Reset bila ingin menghapus semua penyaring.',
      'Periksa tiga kartu ringkasan: jumlah transaksi, total nilai transaksi, dan total berat sampah.',
      'Periksa Rekap per Jenis Sampah untuk melihat kontribusi tiap jenis sampah.',
      'Gunakan tombol Prev dan Next untuk berpindah halaman pada tabel detail.',
      'Klik Export CSV untuk mengunduh data tabel yang sedang tampil, atau klik Cetak PDF untuk mencetak halaman laporan.',
    ],
    notes: [
      'Penyaring rentang tanggal memasukkan tanggal akhir sampai pukul 23.59.59.',
      'Data laporan dipecah per halaman, dan berkas CSV hanya berisi baris pada halaman yang sedang tampil. Persempit filter bila membutuhkan data seluruh periode.',
      'Pilih Semua pada penyaring agar hasil tidak terbatas.',
      'Status transaksi yang dapat disaring adalah Semua Status, Selesai, dan Dibatalkan.',
    ],
  },
  {
    title: 'Dashboard Admin',
    who: 'Admin',
    menu: 'Menu Dashboard pada area Admin',
    purpose: 'Memantau kondisi keseluruhan bank sampah.',
    steps: [
      'Buka menu Dashboard.',
      'Periksa Total Anggota Aktif, Total Sampah Terkumpul, Jumlah Transaksi, dan Total Nilai Tabungan.',
      'Periksa daftar Aktivitas Transaksi Terbaru beserta nama anggota yang menyetor.',
    ],
    notes: ['Angka di sini bersifat agregat untuk seluruh bank sampah, bukan milik satu anggota.'],
  },
  {
    title: 'Dashboard Pengelola',
    who: 'Pengelola',
    menu: 'Menu Dashboard pada area Pengelola',
    purpose: 'Memantau operasional harian.',
    steps: [
      'Buka menu Dashboard.',
      'Periksa Nilai Setoran Hari Ini, Total Berat Hari Ini, dan Transaksi Hari Ini.',
      'Periksa daftar Transaksi Terbaru beserta nama anggota.',
      'Gunakan pintasan Aksi Cepat untuk langsung mencatat setoran, memproses penarikan, atau membuka data anggota.',
    ],
    notes: ['Rekap di sini khusus untuk hari ini, bukan akumulasi sepanjang masa.'],
  },
  {
    title: 'Bertanya kepada Asisten AI',
    who: 'Semua pengguna yang sudah login',
    menu: 'Menu Tanya AI',
    purpose: 'Mendapatkan penjelasan tentang fitur aplikasi dan pengelolaan sampah.',
    steps: [
      'Buka menu Tanya AI.',
      'Tulis pertanyaan di kolom pesan, atau klik salah satu pertanyaan contoh yang tersedia.',
      'Tekan Enter atau klik tombol Kirim.',
      'Tunggu jawaban muncul di layar.',
    ],
    notes: [
      'Riwayat percakapan hanya bertahan selama halaman tetap terbuka. Memuat ulang halaman akan mengosongkan percakapan.',
      'Asisten hanya dapat menjawab data pribadi milik pengguna yang sedang login, misalnya saldo sendiri.',
      'Asisten tidak dapat menampilkan data anggota lain. Data pribadi anggota hanya dapat dilihat oleh pemilik akun atau pengelola yang berwenang.',
    ],
  },
];

// ─── Aturan bisnis dan sistem ──────────────────────────────────────────────────

export const SYSTEM_RULES: Array<{ title: string; lines: string[] }> = [
  {
    title: 'Peran dan akses',
    lines: [
      'Ada tiga peran, yaitu Admin, Pengelola, dan Anggota. Setiap peran hanya dapat membuka menunya sendiri.',
      'Admin dan Pengelola dapat mencatat setoran serta memproses penarikan. Anggota tidak dapat melakukan keduanya.',
      'Hanya Admin yang dapat menambah, mengubah, dan menonaktifkan anggota serta jenis sampah.',
      'Anggota tidak dapat melihat data anggota lain dalam bentuk apa pun.',
      'Membuka menu yang bukan haknya akan diarahkan ke halaman Akses Ditolak.',
    ],
  },
  {
    title: 'Perhitungan saldo anggota',
    lines: [
      'Saldo Tersedia sama dengan total nilai seluruh setoran berstatus Selesai, dikurangi total penarikan berstatus Selesai, dikurangi total penarikan yang masih berstatus Menunggu.',
      'Pengajuan penarikan yang masih Menunggu langsung mengurangi Saldo Tersedia supaya dana tidak dipakai dua kali.',
      'Penarikan yang ditolak tidak mengurangi saldo karena dananya otomatis kembali tersedia.',
      'Saldo anggota tidak pernah menjadi negatif karena sistem menolak pengajuan yang melebihi Saldo Tersedia.',
      'Total Berat Disetor dan Jumlah Transaksi hanya menghitung setoran yang sudah berstatus Selesai.',
    ],
  },
  {
    title: 'Perhitungan nilai setoran',
    lines: [
      'Nilai setoran sama dengan Berat dalam kilogram dikali Harga per Satuan jenis sampah pada saat itu, lalu dibulatkan ke dua angka di belakang koma.',
      'Harga satuan dikunci atau disimpan pada transaksi sebagai harga saat itu, sehingga perubahan harga di kemudian hari tidak mengubah transaksi lama.',
      'Angka total yang tampil di layar sebelum konfirmasi hanya estimasi. Nilai final dihitung ulang di server dan itulah yang tersimpan.',
    ],
  },
  {
    title: 'Aturan validasi',
    lines: [
      'Berat setoran wajib lebih besar dari nol dan maksimal 10.000 kilogram per transaksi. Gunakan titik sebagai tanda desimal, misalnya 2.5.',
      'Nominal penarikan wajib lebih besar dari nol dan tidak boleh melebihi Saldo Tersedia.',
      'Harga jenis sampah tidak boleh bernilai negatif.',
      'Nama jenis sampah harus unik, dan email anggota juga harus unik.',
      'Nama lengkap dan email wajib diisi saat menambah atau mengubah anggota.',
      'Kolom nomor kontak dan alamat bersifat opsional.',
    ],
  },
  {
    title: 'Dampak status aktif dan nonaktif',
    lines: [
      'Anggota nonaktif tidak dapat login dan tidak dapat menerima setoran baru, tetapi saldonya dan riwayatnya tetap utuh.',
      'Jenis sampah nonaktif tidak dapat dipilih untuk transaksi baru, tetapi transaksi lamanya tetap tercatat dengan harga lamanya.',
      'Sistem tidak menyediakan penghapusan pada anggota, jenis sampah, transaksi, maupun penarikan supaya riwayat pembukuan tetap utuh.',
    ],
  },
  {
    title: 'Alur status',
    lines: [
      'Transaksi setoran langsung berstatus Selesai saat dibuat. Transaksi berstatus Dibatalkan tidak menambah saldo.',
      'Penarikan berstatus Menunggu, lalu menjadi Selesai bila disetujui atau Ditolak bila ditolak.',
      'Anggota dan jenis sampah berstatus Aktif atau Nonaktif, dan dapat ditukar statusnya oleh Admin kapan saja.',
    ],
  },
  {
    title: 'Data yang boleh dan tidak boleh dibagikan',
    lines: [
      'Asisten boleh memakai angka dan fakta yang ada di DATA KONTEKS untuk menjawab pertanyaan pengguna.',
      'Asisten boleh memakai penjelasan fitur dan aturan sistem yang ada di blok PENGETAHUAN SISTEM, misalnya batas berat, urutan menu, dan syarat pengajuan.',
      'Nama anggota lain, saldo, transaksi, alamat, nomor kontak, kata sandi, PIN, isi basis data, kode internal, kunci API, dan cara masuk ke sistem tidak boleh dibagikan kepada siapa pun.',
      'Bila pengguna menanyakan sesuatu yang tidak ada di DATA KONTEKS maupun PENGETAHUAN SISTEM, katakan dengan jujur bahwa informasinya belum tersedia, lalu arahkan ke menu terkait atau ke pengelola.',
    ],
  },
  {
    title: 'Pendaftaran anggota baru dan kontak resmi WhatsApp Admin',
    lines: [
      'Pendaftaran akun anggota baru sepenuhnya dibantu dan dibuat oleh Admin Bank Sampah. Pengguna belum dapat mendaftar mandiri di aplikasi maupun di chatbot AI ini.',
      `Nomor WhatsApp resmi Admin Bank Sampah: ${ADMIN_CONTACT.number}.`,
      `Tautan WhatsApp resmi dengan pesan pendaftaran otomatis: [Chat Admin via WhatsApp](${ADMIN_CONTACT.whatsappRegisterUrl})`,
      'Jika pengguna ingin bergabung atau mendaftar, AI harus menjelaskan alur ini secara ramah, menyebutkan nomor WhatsApp resmi, dan menyertakan tautan WhatsApp yang bisa diklik.',
      'AI tidak boleh mengaku telah mendaftarkan pengguna atau membuat akun secara otomatis.',
    ],
  },
];

// ─── Kamus status ──────────────────────────────────────────────────────────────

export const STATUS_DICTIONARY: Array<{
  status: string;
  meaning: string;
  effect: string;
}> = [
  {
    status: 'Selesai (COMPLETED)',
    meaning: 'Transaksi setoran sudah tercatat lengkap, atau penarikan sudah disetujui.',
    effect: 'Setoran menambah saldo, sedangkan penarikan mengurangi saldo.',
  },
  {
    status: 'Dibatalkan (CANCELLED)',
    meaning: 'Transaksi setoran dibatalkan sehingga tidak ikut dihitung.',
    effect: 'Tidak menambah saldo.',
  },
  {
    status: 'Menunggu (PENDING)',
    meaning: 'Pengajuan penarikan sudah diajukan anggota tetapi belum diputuskan pengelola.',
    effect: 'Sudah mengurangi Saldo Tersedia sampai diputuskan.',
  },
  {
    status: 'Ditolak (REJECTED)',
    meaning: 'Pengajuan penarikan ditolak pengelola.',
    effect: 'Dananya kembali ke Saldo Tersedia.',
  },
  {
    status: 'Aktif (ACTIVE)',
    meaning: 'Anggota atau jenis sampah boleh digunakan.',
    effect: 'Anggota dapat login dan menerima setoran, dan jenis sampah dapat dipilih.',
  },
  {
    status: 'Nonaktif (INACTIVE)',
    meaning: 'Anggota atau jenis sampah dinonaktifkan oleh Admin.',
    effect: 'Anggota tidak dapat login dan tidak dapat menerima setoran baru, dan jenis sampah tidak dapat dipilih lagi.',
  },
];

// ─── Pertanyaan umum dan penanganan masalah ────────────────────────────────────

export const TROUBLESHOOTING: Array<{ question: string; answer: string }> = [
  {
    question: 'Saya tidak bisa login.',
    answer:
      'Pastikan email dan password diketik dengan benar dan email itu memang email akun Anda, bukan nama lengkap. Akun yang dinonaktifkan oleh Admin juga tidak dapat login. Hubungi Admin bila akun Anda berstatus Nonaktif atau Anda belum memiliki akun.',
  },
  {
    question: 'Saya lupa password saya.',
    answer:
      'Aplikasi tidak menyediakan pemulihan password mandiri. Minta Admin memeriksa atau mengatur ulang akun Anda.',
  },
  {
    question: 'Saldo saya belum bertambah setelah saya menyetor sampah.',
    answer:
      'Saldo bertambah setelah pengelola mencatat setorannya. Periksa menu Riwayat Transaksi. Bila transaksi Anda belum tercatat di sana, hubungi pengelola agar setoran dapat dicatat.',
  },
  {
    question: 'Saya tidak bisa mengajukan penarikan.',
    answer:
      'Periksa Saldo Tersedia. Pengajuan ditolak bila nominalnya nol, tidak valid, atau melebihi Saldo Tersedia. Periksa juga apakah ada pengajuan lain yang masih berstatus Menunggu sehingga saldo sedang terpakai.',
  },
  {
    question: 'Pengajuan penarikan saya belum selesai.',
    answer:
      'Status Menunggu berarti masih menunggu keputusan pengelola atau Admin. Pantau statusnya melalui menu Riwayat Transaksi.',
  },
  {
    question: 'Saya tidak bisa mencatat setoran.',
    answer:
      'Menu Catat Setoran hanya dapat dipakai oleh Pengelola dan Admin. Hubungi pengelola di lokasi bank sampah agar setoran Anda dapat dicatat.',
  },
  {
    question: 'Nama anggota tidak muncul saat mencatat setoran.',
    answer:
      'Cari dengan kolom pencarian menggunakan nama, email, atau nomor kontak. Bila memang tidak ada, berarti anggota itu belum terdaftar dan Admin perlu menambahkannya.',
  },
  {
    question: 'Saya tidak bisa memilih salah satu jenis sampah.',
    answer:
      'Jenis sampah tersebut sedang nonaktif. Minta Admin mengaktifkannya kembali melalui menu Jenis Sampah.',
  },
  {
    question: 'Ada pesan bahwa anggota berstatus nonaktif.',
    answer:
      'Anggota tersebut berstatus Nonaktif sehingga tidak dapat menerima setoran. Minta Admin mengaktifkan keanggotaannya lebih dulu.',
  },
  {
    question: 'Harga di laporan berbeda dengan harga sekarang.',
    answer:
      'Perbedaan itu memang wajar. Harga pada transaksi dikunci saat transaksi dicatat, sehingga transaksi lama tetap menampilkan harga lamanya meski harga sudah diperbarui.',
  },
  {
    question: 'Bagaimana cara saya menjadi anggota bank sampah?',
    answer:
      `Halo! 👋 Ingin bergabung menjadi anggota Bank Sampah? Pendaftaran anggota baru dibantu oleh ${ADMIN_CONTACT.name}.\n\nSilakan hubungi Admin melalui WhatsApp untuk meminta bantuan pendaftaran akun.\n📱 WhatsApp Admin Bank Sampah: ${ADMIN_CONTACT.number}\n\nKlik tautan berikut untuk langsung menghubungi admin:\n[Chat Admin via WhatsApp](${ADMIN_CONTACT.whatsappRegisterUrl})\n\nAdmin akan membantu menjelaskan proses pendaftaran akun anggota. Terima kasih sudah tertarik bergabung dengan Bank Sampah! ♻️`,
  },
  {
    question: 'Apakah saya bisa daftar sendiri online lewat aplikasi atau chatbot?',
    answer:
      `Pendaftaran belum dapat dilakukan secara mandiri lewat aplikasi maupun chatbot ini. Pembuatan akun sepenuhnya dibantu oleh ${ADMIN_CONTACT.name}.\n\nSilakan hubungi WhatsApp resmi Admin di ${ADMIN_CONTACT.number} atau langsung klik tautan berikut:\n[Chat Admin via WhatsApp](${ADMIN_CONTACT.whatsappRegisterUrl})`,
  },
  {
    question: 'Berapa nomor WhatsApp atau telepon admin untuk pendaftaran?',
    answer:
      `Nomor WhatsApp resmi ${ADMIN_CONTACT.name} adalah ${ADMIN_CONTACT.number}.\n\nKlik tautan berikut untuk langsung mengirim pesan pendaftaran ke Admin:\n[Chat Admin via WhatsApp](${ADMIN_CONTACT.whatsappRegisterUrl})`,
  },
  {
    question: 'Apakah saya bisa membatalkan transaksi atau penarikan sendiri?',
    answer:
      'Anggota tidak dapat menghapus atau membatalkan secara mandiri. Untuk pembatalan, hubungi pengelola atau Admin agar tercatat dengan benar.',
  },
  {
    question: 'Bagaimana cara menemukan menu yang saya cari?',
    answer:
      'Semua menu berada di sisi kiri dan menyesuaikan peran Anda. Untuk anggota, menunya adalah Dashboard, Riwayat Transaksi, dan Ajukan Penarikan. Asisten AI dapat dibuka melalui tombol chat di pojok kanan bawah layar.',
  },
];

// ─── Renderer ─────────────────────────────────────────────────────────────────

export function bullets(lines: string[]): string {
  return lines.map((l) => `  - ${l}`).join('\n');
}

function normalizeRole(role?: string | null): AiRole | null {
  if (role === 'ADMIN' || role === 'MANAGER' || role === 'MEMBER') return role;
  return null;
}

/**
 * Membangun blok PENGETAHUAN SISTEM untuk system prompt.
 *
 * Peran pengguna dipakai untuk menandai bagian yang paling relevan, tanpa
 * menyembunyikan bagian peran lain karena pengguna sering menanyakan tentang
 * peran yang berbeda dari perannya sendiri.
 */
export function buildSystemKnowledge(role?: string | null): string {
  const currentRole = normalizeRole(role);
  const lines: string[] = [];

  lines.push('PENGETAHUAN SISTEM (Dokumentasi resmi aplikasi Bank Sampah Digital):');

  lines.push('\n1. PROFIL APLIKASI:');
  lines.push('Bank Sampah Digital adalah sistem pencatatan sampah desa menjadi tabungan rupiah (Rp). Satuan berat kg, nilai rupiah. Anggota menyetor sampah ke pengelola, pengelola mencatat setoran sehingga saldo bertambah, lalu anggota dapat mengajukan penarikan saldo.');

  lines.push('\n2. PERAN, MENU, DAN HAK AKSES:');
  for (const g of ROLE_GUIDES) {
    const isCurrent = g.role === currentRole ? ' [PERAN PENGGUNA SAAT INI]' : '';
    lines.push(`- ${ROLE_LABEL[g.role]}${isCurrent} (Halaman awal: ${g.landingPath})`);
    lines.push(`  * Menu: ${g.menus.map((m) => `${m.label} (${m.path})`).join(', ')}`);
    lines.push(`  * Hak: ${g.capabilities.join('; ')}`);
    lines.push(`  * Batasan: ${g.restrictions.join('; ')}`);
  }

  lines.push('\n3. ATURAN BISNIS, VALIDASI & PROSEDUR:');
  lines.push('- Batas setoran sampah: berat wajib > 0 kg dan maksimal 10.000 kg per transaksi. Nilai = berat x harga resmi saat transaksi.');
  lines.push('- Saldo bertambah saat pengelola mencatat setoran di menu Catat Setoran (/pengelola/setoran). Cek di Riwayat Transaksi.');
  lines.push('- Penarikan saldo: diajukan anggota di menu Ajukan Penarikan (/dashboard/penarikan), nominal <= Saldo Tersedia. Status awal Menunggu (PENDING) hingga diproses pengelola/admin.');
  lines.push('- Pendaftaran anggota baru: dibantu dan didaftarkan oleh Admin Bank Sampah melalui WhatsApp resmi: 628388810329 ([Chat Admin via WhatsApp](https://wa.me/628388810329)). Tidak ada pendaftaran mandiri.');
  lines.push('- Mengubah jenis/harga sampah: hanya Admin yang berwenang di menu Jenis Sampah (/admin/kategori).');
  lines.push('- Mencatat setoran: hanya Pengelola dan Admin (menu Catat Setoran untuk Pengelola; tidak ada halaman /admin/setoran).');
  lines.push('- Laporan: tersedia di menu Laporan dengan filter tanggal, jenis sampah, anggota, status, serta ekspor CSV dan cetak PDF.');
  lines.push('- Status: COMPLETED (Selesai, menambah saldo setoran / mengurangi saldo penarikan), PENDING (Menunggu persetujuan), REJECTED (Ditolak, dana kembali), CANCELLED (Dibatalkan), ACTIVE (Aktif), INACTIVE (Nonaktif).');

  return lines.join('\n');
}