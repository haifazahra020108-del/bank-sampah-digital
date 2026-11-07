# PRODUCT REQUIREMENTS DOCUMENT (PRD) — REVISI

## Bank Sampah Digital Berbasis Web dengan Artificial Intelligence (AI)

| Item | Detail |
|---|---|
| Nama Produk | Bank Sampah Digital Berbasis Web dengan AI |
| Versi Dokumen | Revisi 1.0 (berdasarkan audit repository saat ini) |
| Status | Draft audit/revisi |
| Bahasa | Indonesia |
| Lingkup | Audit dan dokumentasi, tanpa perubahan kode |

---

## 1. Judul dan Identitas Dokumen

Dokumen ini adalah PRD revisi untuk sistem Bank Sampah Digital Berbasis Web dengan AI. Isi disesuaikan dengan implementasi aktual pada repository `projectrpl` (Next.js App Router, TypeScript, Prisma, SQLite). PRD lama digunakan sebagai kerangka konseptual, tetapi status setiap fitur ditentukan dari kode, skema database, route, dan konfigurasi yang benar-benar ada.

Lokasi implementasi utama: `src/`, `prisma/`, `scripts/`, `.env.example`, `.env.local`.

---

## 2. Pendahuluan

### 2.1 Latar Belakang

Sistem Bank Sampah Digital dibangun untuk membantu pencatatan setoran sampah, penghitungan saldo anggota, pengajuan dan pemrosesan penarikan saldo, pengelolaan anggota dan kategori sampah, pelaporan, notifikasi website, integrasi Telegram, serta asisten AI. Sistem menggunakan autentikasi berbasis cookie JWT dan pembatasan akses berdasarkan role.

### 2.2 Tujuan Produk

1. Menyediakan pencatatan transaksi setoran sampah secara terpusat.
2. Menghitung saldo anggota dari transaksi setoran dan penarikan.
3. Menyediakan alur pengajuan dan persetujuan penarikan saldo.
4. Menyediakan dashboard berbeda untuk Admin, Pengelola, dan Anggota.
5. Menyediakan pengelolaan anggota, kategori sampah, dan laporan.
6. Menyediakan notifikasi website dan integrasi Telegram opsional.
7. Menyediakan asisten AI yang dikonfigurasi melalui dashboard Admin.

### 2.3 Ruang Lingkup

In-scope (terverifikasi di repository):

- Autentikasi login/logout dan session.
- Role `ADMIN`, `MANAGER`, `MEMBER`.
- Dashboard Admin, Pengelola, Anggota.
- Manajemen anggota (Admin).
- Kategori dan harga sampah (Admin).
- Transaksi setoran sampah (Admin/Pengelola).
- Saldo dan penarikan saldo (Anggota mengajukan; Admin/Pengelola memproses).
- Riwayat transaksi.
- Laporan dan rekapitulasi.
- Notifikasi website.
- Integrasi Telegram (opsional, berbasis environment).
- AI Assistant dengan konfigurasi provider/model melalui dashboard Admin.
- Ganti password.

Out of scope / belum tersedia (lihat bagian 15):

- RAG, Computer Vision, Sentiment Analysis.
- Pendaftaran mandiri anggota.
- Pembayaran digital/non-tunai.
- Export laporan (Excel/PDF) tidak terverifikasi.
- Scheduler retry Telegram tidak tersedia.

---

## 3. Aktor dan Hak Akses

| Role | Kode | Akses Utama |
|---|---|---|
| Admin | `ADMIN` | Dashboard Admin, manajemen anggota, kategori sampah, laporan, konfigurasi AI, ganti password, proses penarikan (melalui guard `/pengelola` juga diizinkan), notifikasi. |
| Pengelola | `MANAGER` | Dashboard Pengelola, catat setoran, data anggota (read), penarikan, laporan, ganti password, notifikasi. |
| Anggota | `MEMBER` | Dashboard Anggota, riwayat transaksi, ajukan penarikan, tanya AI, ganti password, notifikasi. |

Guard route (`src/proxy.ts`):

- `/admin/*`: hanya `ADMIN`.
- `/pengelola/*`: `ADMIN` atau `MANAGER`.
- `/dashboard/*`, `/profil`: semua role terautentikasi.
- Session berbasis cookie `session`, JWT HS256, kedaluwarsa 1 hari.

---

## 4. Kebutuhan Fungsional

| ID | Kebutuhan | Status | Bukti |
|---|---|---|---|
| FR-01 | Sistem menyediakan login berbasis email/password. | TERIMPLEMENTASI | `src/app/(auth)/login/page.tsx`, `src/app/actions/auth.ts`, `src/utils/session.ts` |
| FR-02 | Sistem membatasi akses berdasarkan role. | TERIMPLEMENTASI | `src/proxy.ts` |
| FR-03 | Admin dapat mengelola anggota (tambah, ubah, nonaktifkan/aktifkan, reset password). | TERIMPLEMENTASI | `src/app/admin/anggota/*`, `src/app/actions/member.ts` |
| FR-04 | Admin dapat mengelola kategori sampah dan harga. | TERIMPLEMENTASI | `src/app/admin/kategori/*`, `src/app/actions/category.ts` |
| FR-05 | Admin/Pengelola dapat mencatat setoran sampah. | TERIMPLEMENTASI | `src/app/pengelola/setoran/*`, `src/app/actions/transaction.ts` |
| FR-06 | Sistem menyimpan harga snapshot dan total nilai transaksi. | TERIMPLEMENTASI | `prisma/schema.prisma` (`WasteTransaction`), `src/app/actions/transaction.ts` |
| FR-07 | Anggota dapat melihat riwayat transaksi dan saldo. | TERIMPLEMENTASI | `src/app/(dashboard)/dashboard/transaksi/page.tsx`, `src/services/dashboard.member.ts` |
| FR-08 | Anggota dapat mengajukan penarikan saldo. | TERIMPLEMENTASI | `src/app/(dashboard)/dashboard/penarikan/*`, `src/app/actions/withdrawal.ts` |
| FR-09 | Admin/Pengelola dapat menyetujui/menolak penarikan. | TERIMPLEMENTASI | `src/app/pengelola/penarikan/*`, `src/app/actions/withdrawal.ts` |
| FR-10 | Sistem menghitung saldo tersedia (deposit - withdrawal completed/pending). | TERIMPLEMENTASI | `src/app/actions/withdrawal.ts`, `src/services/dashboard.member.ts` |
| FR-11 | Sistem menyimpan notifikasi per pengguna. | TERIMPLEMENTASI | `prisma/schema.prisma` (`Notification`), `src/services/notification.ts` |
| FR-12 | Notifikasi website dapat ditandai baca/seluruhnya. | TERIMPLEMENTASI | `src/app/actions/notification.ts` |
| FR-13 | Integrasi Telegram opsional (deep link, webhook, pengiriman). | TERIMPLEMENTASI SEBAGIAN | `src/services/telegram*.ts`, `src/app/api/telegram/webhook/route.ts` |
| FR-14 | AI Assistant dengan konteks pengguna dan data sistem. | TERIMPLEMENTASI | `src/services/ai*.ts`, `src/app/(dashboard)/dashboard/ai/*` |
| FR-15 | Konfigurasi AI provider/model/base URL/API key melalui dashboard Admin. | TERIMPLEMENTASI | `src/app/admin/ai-config/*`, `src/app/actions/ai-config.ts`, `src/services/ai-config.ts` |
| FR-16 | Pengguna dapat mengganti password. | TERIMPLEMENTASI | `src/app/(dashboard)/dashboard/ganti-password/*`, `src/app/actions/password.ts` |
| FR-17 | Laporan dan rekapitulasi. | TERIMPLEMENTASI SEBAGIAN | `src/app/admin/laporan/page.tsx`, `src/app/pengelola/laporan/page.tsx`, `src/services/report.ts`, `src/components/Report/ReportDashboard.tsx` |

---

## 5. User Stories dan Acceptance Criteria

### US-01 Login
Sebagai pengguna, saya ingin login dengan email dan password.
Acceptance Criteria:
- Login berhasil dengan kredensial valid.
- Session cookie httpOnly diset.
- Role menentukan redirect dashboard.
- Kredensial invalid ditolak.

### US-02 Manajemen Anggota (Admin)
Sebagai Admin, saya ingin menambah/mengubah/menonaktifkan anggota.
Acceptance Criteria:
- Email unik.
- Password sementara wajib diganti saat login pertama bila dibuat otomatis.
- Notifikasi dan tautan Telegram opsional dibuat.

### US-03 Setoran Sampah
Sebagai Pengelola, saya ingin mencatat setoran.
Acceptance Criteria:
- Harga diambil dari database, bukan frontend.
- Berat > 0 dan <= 10000.
- Anggota aktif.
- Kategori aktif.
- Transaksi atomic.
- Notifikasi dibuat untuk anggota/admin/pengelola.

### US-04 Penarikan Saldo
Sebagai Anggota, saya ingin mengajukan penarikan.
Acceptance Criteria:
- Nominal > 0.
- Saldo tersedia cukup (termasuk pending).
- Status `PENDING`.
- Notifikasi dibuat.

### US-05 Proses Penarikan
Sebagai Pengelola/Admin, saya ingin menyetujui/menolak penarikan.
Acceptance Criteria:
- Hanya status `PENDING` yang dapat diproses.
- Status menjadi `COMPLETED` atau `REJECTED`.
- Notifikasi ke anggota dan staf.

### US-06 AI Assistant
Sebagai pengguna terautentikasi, saya ingin bertanya ke AI.
Acceptance Criteria:
- Konteks pengguna dan data sistem dimasukkan ke prompt.
- Provider/model diambil dari konfigurasi aktif.
- Quick response deterministik tersedia untuk pertanyaan tertentu.
- Error provider dikembalikan sebagai pesan yang dapat dipahami.

### US-07 Konfigurasi AI (Admin)
Sebagai Admin, saya ingin mengatur provider/model/API key.
Acceptance Criteria:
- Provider hanya groq/nvidia/gemini.
- Base URL divalidasi terhadap daftar HTTPS resmi.
- API key dienkripsi AES-256-GCM.
- Koneksi diuji sebelum simpan.
- Hanya satu konfigurasi aktif.

---

## 6. Kebutuhan Non-Fungsional

| ID | Kebutuhan | Implementasi |
|---|---|---|
| NFR-01 | Keamanan sesi | JWT HS256, cookie httpOnly, sameSite lax |
| NFR-02 | Kontrol akses | Middleware role-based |
| NFR-03 | Validasi input | Validasi server-side pada actions |
| NFR-04 | Atomisitas transaksi | Prisma `$transaction` |
| NFR-05 | Kerahasiaan API key | AES-256-GCM di `src/services/ai-crypto.ts` |
| NFR-06 | Sanitasi error Telegram | `sanitizeTelegramError` |
| NFR-07 | Opsionalitas Telegram | Sistem tetap berjalan tanpa token |
| NFR-08 | Rate limiting webhook | `src/utils/rate-limit.ts` |
| NFR-09 | Database | SQLite via Prisma |
| NFR-10 | UI responsif | CSS Modules |

---

## 7. Spesifikasi Fitur AI

Provider terverifikasi di `src/services/ai-providers.ts`:

- `groq` (Groq, OpenAI-compatible)
- `nvidia` (NVIDIA NIM)
- `gemini` (Google Gemini OpenAI-compatible)

Model yang dapat dipilih:

- Groq: `openai/gpt-oss-120b`, `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `mixtral-8x7b-32768`, `gemma2-9b-it`.
- NVIDIA: `openai/gpt-oss-20b`, `meta/llama-3.3-70b-instruct`, `meta/llama-3.1-70b-instruct`, `mistralai/mixtral-8x7b-instruct-v0.1`.
- Gemini: `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`.

Mekanisme:

- Konfigurasi aktif diambil dari tabel `AiConfig` (`isActive = true`), fallback ke `GROQ_API_KEY` environment.
- Cache in-memory 60 detik, diinvalidasi saat perubahan.
- Base URL divalidasi terhadap allowed list HTTPS.
- API key disimpan terenkripsi AES-256-GCM dan ditampilkan masked.
- Pengujian koneksi sebelum simpan.
- Model fallback field tersedia, tetapi pada eksekusi chat (`executeChatWithConfig`) hanya model primary yang dipanggil; fallback tidak otomatis digunakan saat error primary.
- Quick response deterministik tersedia (`src/services/ai-quick-response.ts`).
- Konteks data pengguna/sistem dimasukkan ke prompt (`src/services/ai-context.ts`, `src/services/ai-knowledge.ts`).

Catatan: OpenAI tidak tersedia sebagai provider aktif. NVIDIA disebut dalam kode sebagai provider yang didukung, tetapi konfigurasi aktif bergantung pada data database/environment.

---

## 8. Deskripsi Use Case

| Use Case | Aktor | Alur Singkat |
|---|---|---|
| UC-01 Login | Semua | Input kredensial -> session -> redirect sesuai role. |
| UC-02 Kelola Anggota | Admin | Tambah/ubah/status/reset password anggota. |
| UC-03 Kelola Kategori | Admin | Tambah/ubah/hapus/nonaktifkan kategori. |
| UC-04 Catat Setoran | Admin/Pengelola | Pilih anggota & kategori, input berat -> transaksi. |
| UC-05 Lihat Saldo/Riwayat | Anggota | Dashboard dan halaman transaksi. |
| UC-06 Ajukan Penarikan | Anggota | Input nominal -> validasi saldo -> status PENDING. |
| UC-07 Proses Penarikan | Admin/Pengelola | Approve/Reject. |
| UC-08 Notifikasi | Semua | Lonceng, baca, tandai semua. |
| UC-09 Telegram | Anggota (opsional) | Aktivasi deep link, webhook, pengiriman. |
| UC-10 Tanya AI | Semua | Chat dengan konteks. |
| UC-11 Konfigurasi AI | Admin | Simpan/test/aktivasi konfigurasi. |

---

## 9. Aturan Bisnis

1. Harga sampah diambil dari database saat transaksi, tidak dari frontend.
2. Berat setoran harus > 0 dan <= 10000 kg.
3. Anggota harus berstatus `ACTIVE` untuk setoran.
4. Kategori harus `isActive` untuk transaksi baru.
5. Saldo anggota = total nilai setoran `COMPLETED` - penarikan `COMPLETED` - penarikan `PENDING`.
6. Pengajuan penarikan hanya untuk role `MEMBER`.
7. Penarikan hanya dapat diproses jika status `PENDING`.
8. Pendaftaran anggota dilakukan oleh Admin, tidak ada self-registration.
9. Telegram opsional; kegagalan Telegram tidak membatalkan transaksi/notifikasi website.
10. Notifikasi Telegram hanya untuk role `MEMBER` dengan `telegramChatId` terverifikasi.
11. Kode aktivasi Telegram sekali pakai, berlaku 30 menit, disimpan sebagai SHA-256.
12. AI prompt menyertakan identitas pengguna dari session server, bukan dari isi chat.

---

## 10. Teknologi yang Digunakan (Terverifikasi)

- Next.js 16.3.4 (App Router)
- React 19.2.8 / React DOM 19.2.8
- TypeScript 5
- Prisma 5.11.0 (devDependency)
- `@prisma/client` 5.11.0
- SQLite (`file:./dev.db`)
- bcryptjs 3.0.3
- jose 6.2.10 (JWT)
- zod 4.5.4
- `@google/genai` 2.24.0
- ESLint 9 + eslint-config-next 16.3.4
- CSS Modules
- Node.js (v18.17+ disarankan README)

---

## 11. Rencana Pengujian Sistem

Tersedia script pengujian:

- `scripts/ai-regression.ts` (`npm run ai:regression`)
- `scripts/test-ai-config-center.ts`
- `scripts/test-member-password-management.ts`
- `scripts/verify-ai-roles.ts`
- `scripts/verify-notifications.ts`
- `scripts/verify-telegram.ts`
- `scripts/check-db.ts`
- `scripts/timing.ts`

Pengujian manual yang disarankan:

1. Login setiap role dan verifikasi redirect.
2. CRUD anggota dan status.
3. CRUD kategori.
4. Setoran dengan berbagai berat dan kategori.
5. Penarikan melebihi saldo.
6. Approve/reject penarikan.
7. Notifikasi baca/tandai semua.
8. Telegram dengan dan tanpa konfigurasi.
9. Konfigurasi AI: simpan, test, aktivasi, penggunaan chat.

---

## 12. Risiko dan Penanganan

| Risiko | Penanganan Aktual |
|---|---|
| API key bocor | Enkripsi AES-256-GCM, masked display, sanitasi error |
| Telegram down | Notifikasi website tetap tersimpan; status FAILED/SKIPPED |
| Race condition penarikan | Prisma transaction |
| Race condition kode Telegram | `updateMany` kondisional |
| Provider AI error | Pesan error yang dapat dipahami; tidak ada auto-fallback saat chat |
| Session expired | Redirect login |
| Akses tidak sah | Middleware + guard action |

---

## 13. Indikator Keberhasilan

- Transaksi setoran dapat dibuat dan tersimpan.
- Saldo anggota konsisten dengan transaksi.
- Penarikan mengikuti aturan saldo.
- Notifikasi muncul sesuai peristiwa.
- Telegram berfungsi bila dikonfigurasi dan tidak mengganggu fitur lain bila tidak.
- AI merespons dengan konfigurasi aktif.
- Konfigurasi AI dapat diuji dan diaktifkan Admin.

---

## 14. Kesimpulan

Sistem Bank Sampah Digital telah mengimplementasikan fitur inti bank sampah: manajemen anggota, kategori sampah, setoran, saldo, penarikan, notifikasi, Telegram opsional, dan AI Assistant dengan konfigurasi multi-provider. Beberapa fitur seperti laporan lanjutan, auto-fallback model AI, dan ekspor laporan belum terverifikasi penuh. PRD ini merefleksikan kondisi aktual tanpa mengklaim fitur yang belum ada.

---

## 15. Tabel Pemetaan PRD Lama dan Sistem Aktual

Catatan: PRD lama tidak ditemukan sebagai file di repository. Pemetaan berikut menyusun fitur umum PRD Bank Sampah Digital terhadap implementasi aktual.

| ID Fitur | Deskripsi PRD Lama (umum) | Bukti Implementasi | Status | Catatan Aktual |
|---|---|---|---|---|
| F-01 | Login pengguna | `src/app/(auth)/login/page.tsx`, `src/app/actions/auth.ts` | TERIMPLEMENTASI | JWT cookie |
| F-02 | Role Admin/Pengelola/Anggota | `src/proxy.ts`, `prisma/schema.prisma` | TERIMPLEMENTASI | Kode role: ADMIN/MANAGER/MEMBER |
| F-03 | Manajemen anggota | `src/app/admin/anggota/*`, `src/app/actions/member.ts` | TERIMPLEMENTASI | Admin only |
| F-04 | Kategori sampah | `src/app/admin/kategori/*`, `src/app/actions/category.ts` | TERIMPLEMENTASI | Harga per kg |
| F-05 | Setoran sampah | `src/app/pengelola/setoran/*`, `src/app/actions/transaction.ts` | TERIMPLEMENTASI | Atomic |
| F-06 | Saldo anggota | `src/services/dashboard.member.ts`, withdrawal action | TERIMPLEMENTASI | Pending diperhitungkan |
| F-07 | Penarikan saldo | `src/app/(dashboard)/dashboard/penarikan/*`, `src/app/pengelola/penarikan/*` | TERIMPLEMENTASI | Approve/reject |
| F-08 | Riwayat transaksi | `src/app/(dashboard)/dashboard/transaksi/page.tsx` | TERIMPLEMENTASI | Filter terbatas |
| F-09 | Laporan | `src/app/admin/laporan/page.tsx`, `src/app/pengelola/laporan/page.tsx` | TERIMPLEMENTASI SEBAGIAN | Export tidak terverifikasi |
| F-10 | Notifikasi website | `src/services/notification.ts`, `src/components/NotificationBell/*` | TERIMPLEMENTASI | Per pengguna |
| F-11 | Integrasi Telegram | `src/services/telegram*.ts`, webhook route | TERIMPLEMENTASI SEBAGIAN | Opsional, env based |
| F-12 | AI Assistant | `src/services/ai.ts`, dashboard ai | TERIMPLEMENTASI | Multi-provider config |
| F-13 | RAG/Computer Vision/Sentiment | Tidak ditemukan | BELUM TERIMPLEMENTASI | Hanya rencana |
| F-14 | Self-registration anggota | Tidak ditemukan | BELUM TERIMPLEMENTASI | Admin creates member |
| F-15 | Pembayaran digital | Tidak ditemukan | BELUM TERIMPLEMENTASI | Tidak ada |
| F-16 | Export Excel/PDF | Tidak ditemukan | BELUM TERIMPLEMENTASI | Belum terverifikasi |

---

## 16. Daftar Fitur yang Sudah Berjalan

- Login/logout dan session.
- Role-based access control.
- Dashboard per role.
- Manajemen anggota (Admin).
- Kategori sampah (Admin).
- Setoran sampah (Admin/Pengelola).
- Saldo dan penarikan (Anggota/Pengelola/Admin).
- Notifikasi website.
- AI Assistant dan konfigurasi AI (Admin).
- Ganti password.
- Telegram opsional (deep link, webhook, delivery).

## 17. Daftar Fitur yang Baru Berjalan Sebagian

- Laporan (UI tersedia, export tidak terverifikasi).
- Telegram (bergantung env dan konfigurasi manual webhook).
- AI model fallback (field tersedia, auto-fallback saat chat tidak dijalankan).
- Filter/pencarian anggota (search by name/email tersedia di service; UI perlu verifikasi).

## 18. Daftar Fitur yang Belum Tersedia / Rencana Pengembangan

- RAG, Computer Vision, Sentiment Analysis.
- Self-registration anggota.
- Pembayaran digital.
- Export laporan Excel/PDF.
- Scheduler retry Telegram.
- Auto-fallback model AI saat error.
- Pengujian otomatis komprehensif (unit/integration) tidak terverifikasi.

## 19. Catatan Keterbatasan yang Ditemukan

- Database menggunakan SQLite; belum ada konfigurasi PostgreSQL aktif meskipun `.env.example` menyebut placeholder.
- `.env.local` berisi kredensial sensitif di environment lokal; dokumen ini tidak menyalin nilainya.
- Telegram memerlukan konfigurasi manual token, username, secret, dan URL publik.
- AI provider aktif bergantung pada konfigurasi database atau `GROQ_API_KEY`.
- Tidak ada migrasi ke provider OpenAI; kode tidak mendukung provider OpenAI.
- Fallback model tidak otomatis digunakan pada `executeChatWithConfig`.
- Belum ada bukti test framework otomatis; hanya script verifikasi manual.

---

## 20. Sumber Audit (File/Folder Utama)

- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma/migrations/*`
- `src/proxy.ts`, `src/utils/session.ts`
- `src/app/actions/*`
- `src/services/*`
- `src/app/(dashboard)/*`, `src/app/admin/*`, `src/app/pengelola/*`
- `src/app/api/telegram/webhook/route.ts`
- `scripts/*`
- `.env.example`, `.env.local`
- `package.json`
