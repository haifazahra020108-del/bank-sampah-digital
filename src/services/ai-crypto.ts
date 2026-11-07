import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Domain separator khusus untuk menurunkan kunci AES-256-GCM.
 * Memastikan kunci enkripsi konfigurasi AI terisolasi secara kriptografis
 * dari fungsi lain di dalam aplikasi (seperti JWT atau Telegram link).
 */
const DOMAIN_SEPARATOR = 'bank-sampah-ai-config-aes-256-gcm:v1:';

/**
 * Mengambil kunci enkripsi 32-byte (256 bit) dari environment server.
 * Memprioritaskan AI_CONFIG_ENCRYPTION_KEY, lalu NEXTAUTH_SECRET.
 * Jika keduanya tidak ada, melempar error dan menolak operasi penyimpanan rahasia.
 */
export function getAiConfigEncryptionKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;

  if (!secret || secret.trim().length === 0) {
    throw new Error(
      'Kunci enkripsi server (AI_CONFIG_ENCRYPTION_KEY atau NEXTAUTH_SECRET) belum dikonfigurasi di environment variables. ' +
      'Penyimpanan konfigurasi rahasia dihentikan demi keamanan data.'
    );
  }

  // Turunkan 256-bit symmetric key menggunakan SHA-256 dengan domain separation
  return createHash('sha256')
    .update(`${DOMAIN_SEPARATOR}${secret.trim()}`)
    .digest();
}

/**
 * Enkripsi API Key menggunakan authenticated encryption AES-256-GCM.
 * Output berformat `iv.authTag.ciphertext` dalam encoding base64url.
 */
export function encryptApiKey(rawKey: string): string {
  if (!rawKey || typeof rawKey !== 'string' || rawKey.trim().length === 0) {
    throw new Error('API key tidak boleh kosong.');
  }

  const keyBuffer = getAiConfigEncryptionKey();
  const iv = randomBytes(12); // Rekomendasi NIST untuk GCM: 96-bit (12 bytes)
  const cipher = createCipheriv('aes-256-gcm', keyBuffer, iv);

  const plaintext = Buffer.from(rawKey.trim(), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes authentication tag

  return [
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

/**
 * Dekripsi API Key dari format `iv.authTag.ciphertext`.
 * Melakukan verifikasi integrity & authenticity tag.
 */
export function decryptApiKey(encodedCipher: string): string {
  if (!encodedCipher || typeof encodedCipher !== 'string') {
    throw new Error('Ciphertext API key tidak valid.');
  }

  const parts = encodedCipher.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('Format ciphertext API key tidak valid (harus iv.tag.cipher).');
  }

  const [ivB64, tagB64, cipherB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const ciphertext = Buffer.from(cipherB64, 'base64url');

  if (iv.length !== 12 || authTag.length !== 16) {
    throw new Error('Panjang IV atau Auth Tag enkripsi tidak valid.');
  }

  const keyBuffer = getAiConfigEncryptionKey();

  try {
    const decipher = createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error(
      'Gagal mendekripsi API key. Kunci enkripsi server tidak cocok atau ciphertext telah dimanipulasi.'
    );
  }
}

/**
 * Menghasilkan representasi tersamar (masked) dari API Key untuk ditampilkan di UI Admin.
 * Contoh: "gsk_••••••••••••••••3aB9" atau "nvapi-••••••••••••••••4xY1".
 * Tidak pernah membocorkan badan utama key.
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || typeof apiKey !== 'string') return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) {
    return '••••••••';
  }

  // Periksa apakah memiliki prefix yang umum dikenal
  const prefixMatch = trimmed.match(/^([a-zA-Z0-9_-]{3,8}_)/);
  const prefix = prefixMatch ? prefixMatch[1] : trimmed.slice(0, 4);
  const suffix = trimmed.slice(-4);

  return `${prefix}••••••••••••••••${suffix}`;
}
