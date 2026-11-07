/**
 * Mekanisme menghubungkan akun Telegram anggota.
 *
 * Alur:
 *   1. Server membuat kode aktivasi SEKALI PAKAI berumur pendek (default 30 menit).
 *      Kode disimpan hanya dalam bentuk SHA-256, plaintext-nya sekali saja dikembalikan
 *      ke pemanggil untuk dijadikan deep link `https://t.me/<bot>?start=<kode>`.
 *   2. Anggota membuka deep link itu di Telegram -> bot menerima `/start <kode>`.
 *   3. Webhook memverifikasi kode, menandai kode sebagai terpakai, lalu menyimpan
 *      `telegramChatId` milik anggota.
 *
 * Untuk pendaftaran anggota baru, informasi akses awal (password sementara) ikut
 * disertakan dalam bentuk TERENKSI (AES-256-GCM) di dalam record kode. Jadi kredensial
 * hanya terbuka bagi siapa saja yang benar-benar memegang tautan tersebut di akun
 * Telegram-nya sendiri, dan otomatis kedaluwarsa bersama kodenya. Password tidak pernah
 * ditulis plaintext ke database dan tidak pernah diambil dari hash.
 */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { buildTelegramDeepLink, getTelegramBotUsername } from '@/services/telegram';

/** Alfabet Crockford base32 (tanpa I, L, O, U) agar kode mudah dibaca & dictate. */
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_GROUPS = 3;
const CODE_GROUP_LEN = 4;

export const LINK_CODE_TTL_MINUTES = 30;

export interface LinkCodePayload {
  /** Nama anggota. */
  name: string;
  /** Email akun (alamat login website). */
  email: string;
  /** Password sementara, HANYA ada bila sistem membuatkannya otomatis. */
  temporaryPassword?: string;
  /** true bila password harus diganti saat login pertama. */
  mustChangePassword: boolean;
}

export interface CreatedLinkCode {
  code: string;
  deepLink: string | null;
  expiresAt: Date;
  /** null bila username bot belum dikonfigurasi. */
  botUsername: string | null;
}

// ── Kunci enkripsi ────────────────────────────────────────────────────────────

/**
 * Turunkan kunci AES-256 dari NEXTAUTH_SECRET.
 * Kalau secret tidak diset, AmbangMode tetap berjalan dengan kunci turunan dari
 * nilai statis — payload hanya hidup 30 menit sehingga risikonya terbatas, dan
 * integrasi tetap berfungsi. Token bot sendiri tetap wajib diset.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET || 'banksampah-digital-telegram-link-key';
  return createHash('sha256').update(`telegram-link-payload:${secret}`).digest();
}

export function encryptPayload(payload: LinkCodePayload): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv, authTag, ciphertext]
    .map((part) => part.toString('base64url'))
    .join('.');
}

export function decryptPayload(encoded: string): LinkCodePayload | null {
  try {
    const parts = encoded.split('.');
    if (parts.length !== 3) return null;

    const [iv, authTag, ciphertext] = parts.map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);

    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const parsed = JSON.parse(plaintext.toString('utf8')) as LinkCodePayload;

    if (typeof parsed?.name !== 'string' || typeof parsed?.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

// ── Kode aktivasi ────────────────────────────────────────────────────────────

/**
 * Hash kanonik dari kode aktivasi.
 * Huruf besar + tanda pisah dibuang, sehingga kode yang sama selalu menghasilkan
 * hash yang sama apakah dikirim sebagai "ABCD-1234-EFGH", "abcd1234efgh", atau
 * bentuk campuran dari Telegram.
 */
function hashCode(code: string): string {
  const canonical = String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
  return createHash('sha256').update(canonical).digest('hex');
}

function generateCode(): string {
  const rawLen = CODE_GROUPS * CODE_GROUP_LEN;
  const bytes = randomBytes(rawLen);
  let out = '';

  for (let i = 0; i < rawLen; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }

  return out.replace(/(.{4})(?=.)/g, '$1-');
}

/**
 * Buat kode aktivasi baru untuk seorang pengguna.
 * Kode lama yang belum terpakai langsung dinonaktifkan agar hanya satu tautan valid.
 */
export async function createTelegramLinkCode(
  userId: string,
  payload: LinkCodePayload | null = null
): Promise<CreatedLinkCode> {
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MINUTES * 60 * 1000);

  // Nonaktifkan kode lama yang masih menggantung, sehingga hanya satu tautan valid.
  await prisma.telegramLinkCode.updateMany({
    where: { userId, usedAt: null },
    data: { expiresAt: new Date(0) },
  });

  // Periksa bentrok hash (sangat tidak mungkin, tapi tetap dijaga).
  let code = generateCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const clash = await prisma.telegramLinkCode.findUnique({
      where: { codeHash: hashCode(code) },
      select: { id: true },
    });
    if (!clash) break;
    code = generateCode();
  }

  await prisma.telegramLinkCode.create({
    data: {
      userId,
      codeHash: hashCode(code),
      payloadCipher: payload ? encryptPayload(payload) : null,
      expiresAt,
    },
  });

  return {
    code,
    deepLink: buildTelegramDeepLink(code),
    expiresAt,
    botUsername: getTelegramBotUsername(),
  };
}

export type ConsumeResult =
  | { ok: true; userId: string; payload: LinkCodePayload | null }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'USED' | 'MALFORMED'; message: string };

/**
 * Verifikasi + klaim kode SEKALI PAKAI secara atomik. Klaim dilakukan lewat
 * `updateMany` berkondisi sehingga dua request webhook yang bersamaan tidak bisa
 * memakai kode yang sama dua kali.
 */
export async function consumeTelegramLinkCode(rawCode: string): Promise<ConsumeResult> {
  const normalized = String(rawCode ?? '').trim().toUpperCase();
  if (normalized.length === 0) {
    return { ok: false, reason: 'MALFORMED', message: 'Kode kosong.' };
  }

  const record = await prisma.telegramLinkCode.findUnique({
    where: { codeHash: hashCode(normalized) },
    select: { id: true, userId: true, payloadCipher: true, expiresAt: true, usedAt: true },
  });

  if (!record) {
    return { ok: false, reason: 'NOT_FOUND', message: 'Kode aktivasi tidak dikenali.' };
  }

  const now = new Date();

  if (record.usedAt) {
    return { ok: false, reason: 'USED', message: 'Kode aktivasi sudah pernah dipakai.' };
  }

  if (record.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'EXPIRED', message: 'Kode aktivasi sudah kedaluwarsa.' };
  }

  const claimed = await prisma.telegramLinkCode.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  if (claimed.count === 0) {
    return { ok: false, reason: 'USED', message: 'Kode aktivasi sudah pernah dipakai.' };
  }

  return {
    ok: true,
    userId: record.userId,
    payload: record.payloadCipher ? decryptPayload(record.payloadCipher) : null,
  };
}

/** Membersihkan kode kedaluwarsa / terpakai lama. Dipanggil dari script berkala. */
export async function pruneTelegramLinkCodes(olderThanHours = 24): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
  const result = await prisma.telegramLinkCode.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { usedAt: { not: null, lt: cutoff } }],
    },
  });
  return result.count;
}