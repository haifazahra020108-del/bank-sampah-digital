# Bank Sampah Digital

Aplikasi pengelolaan bank sampah di lingkungan desa. Proyek ini dibangun menggunakan Next.js (App Router), TypeScript, dan CSS Modules.

## Persyaratan
- Node.js (v18.17 atau lebih baru)
- npm / yarn / pnpm

## Cara Menjalankan Proyek

1. **Clone repositori dan masuk ke direktori:**
   (Jika belum)

2. **Install dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment:**
   Salin file `.env.example` menjadi `.env.local`
   ```bash
   cp .env.example .env.local
   ```
   *Anda tidak perlu mengubah nilai untuk menjalankan versi MVP saat ini.*

4. **Jalankan Development Server:**
   ```bash
   npm run dev
   ```

5. **Akses Aplikasi:**
   Buka [http://localhost:3000](http://localhost:3000) di browser Anda. Anda akan diarahkan ke halaman Login.

## Struktur Direktori Utama
- `src/app`: Konfigurasi routing Next.js App Router.
- `src/components`: Komponen UI yang dapat digunakan kembali (Button, Input).
- `src/models`: (Masa Depan) Tipe data dan antarmuka TypeScript.
- `src/services`: (Masa Depan) Logika API dan eksternal.
- `src/utils`: (Masa Depan) Fungsi helper.

## Catatan
Aplikasi ini dibangun dengan fokus pada arsitektur yang scalable. Pengaturan UI diimplementasikan secara responsif menggunakan Vanilla CSS Modules dengan desain modern (hijau zamrud/emerald).
