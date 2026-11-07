/**
 * Pembatas laju sederhana berbasis memori, untuk Protect endpoint dari
 * penyalahgunaan dan pengiriman pesan berulang.
 *
 * Sifat penting:
 *  1. SELALU memungkinkan lalu lintas. Fungsi `checkRateLimit` tidak pernah
 *     melempar error. Bila penyimpanannya bermasalah, pemanggil tetap jalan
 *     (fail-open) alih-alih aplikasi error.
 *  2. Status disimpan di memori proses, jadi batasnya berlaku per instance.
 *     Untuk deployment multi-instance ini hanyalah lapisan pertahanan pertama
 *     yang menahan penyalahgunaan terstruktur, bukan pengganti proteksi di edge.
 *  3. Entri yang sudah kedaluwarsa dibuang secara malas (lazy) saat Map dipindai,
 *     sehingga Map tidak tumbuh tanpa batas.
 */

interface Bucket {
  /** Waktu (ms) saat jendela ini dimulai. */
  startedAt: number;
  /** Jumlah pemakaian dalam jendela berjalan. */
  count: number;
}

const buckets = new Map<string, Bucket>();

/** Batas jumlah entri sebelum pemindaian pembersihan dilakukan. */
const MAX_ENTRIES = 10_000;

function sweep(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.startedAt >= windowMs) {
      buckets.delete(key);
    }
  }
}

export interface RateLimitResult {
  /** true bila pemakaian DITERIMA pada panggilan ini. */
  allowed: boolean;
  /** Sisa kuota dalam jendela berjalan (0 bila sudah habis). */
  remaining: number;
  /** Berapa milidetik lagi jendela berjalan berakhir. */
  retryAfterMs: number;
}

/**
 * Periksa sekaligus naikkan penghitung untuk sebuah kunci.
 *
 * @param key   Pengenal unik pemanggil, mis. `tg-webhook:99887766`.
 * @param limit Jumlah pemakaian maksimum dalam satu jendela.
 * @param windowMs Panjang jendela dalam milidetik.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  try {
    // Bersihkan sesekali agar Map tidak menumpuk tanpa batas.
    if (buckets.size > MAX_ENTRIES) {
      sweep(now, windowMs);
    }

    const existing = buckets.get(key);

    // Jendela berjalan sudah habis -> mulai jendela baru.
    if (!existing || now - existing.startedAt >= windowMs) {
      buckets.set(key, { startedAt: now, count: 1 });
      return { allowed: true, remaining: limit - 1, retryAfterMs: 0 };
    }

    existing.count += 1;

    if (existing.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: windowMs - (now - existing.startedAt),
      };
    }

    return { allowed: true, remaining: limit - existing.count, retryAfterMs: 0 };
  } catch {
    // Fail-open: jangan sampai penyimit laju menjatuhkan aplikasi.
    return { allowed: true, remaining: limit, retryAfterMs: 0 };
  }
}

/** Kosongkan semua penghitung. Hanya untuk keperluan skrip uji. */
export function resetRateLimits(): void {
  buckets.clear();
}