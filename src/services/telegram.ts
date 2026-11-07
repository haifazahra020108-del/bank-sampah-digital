/**
 * Klien Telegram Bot API — KHUSUS SERVER.
 *
 * Aturan keamanan yang dijaga file ini:
 *  1. `TELEGRAM_BOT_TOKEN` hanya dibaca dari `process.env` (server-only). Tidak pernah
 *     ditulis ke kode sumber, tidak pernah dikirim ke browser, tidak pernah di-log.
 *  2. Setiap pesan error disanitasi: kemunculan token di dalam teks apa pun dihapus
 *     sebelum dikembalikan ke pemanggil maupun ditulis ke log.
 *  3. Modul ini tidak boleh diimpor dari komponen client / file berextensi `.tsx`
 *     yang memakai `use client`.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 8000;
const MAX_MESSAGE_LENGTH = 4096;

/** Bentuk kasar token bot: digit sebelum titik dua, lalu secret. */
const TOKEN_SHAPE = /^\d+:[A-Za-z0-9_-]{20,}$/;

/** Chat ID Telegram selalu bilangan bulat, bisa negatif (grup/kanal). */
const CHAT_ID_SHAPE = /^-?\d+$/;

/**
 * Nama variabel env yang boleh ditampilkan di pesan error.
 * Token TIDAK termasuk di sini.
 */
const REDACTED = '[REDACTED]';

/**
 * Hapus jejak token dari teks apa pun sebelum dicatat atau dikembalikan.
 * Dipanggil pada setiap jalur error.
 */
export function sanitizeTelegramError(value: unknown): string {
  const raw =
    value instanceof Error
      ? `${value.name}: ${value.message}`
      : typeof value === 'string'
        ? value
        : safeStringify(value);

  const token = process.env.TELEGRAM_BOT_TOKEN;
  let out = raw;

  if (token && token.length > 0) {
    out = out.split(token).join(REDACTED);
    // Token bisa muncul dalam bentuk URL-encoded, bersihkan juga varian itu.
    out = out.split(encodeURIComponent(token)).join(REDACTED);
  }

  // Bersihkan pola token generik yang mungkin bocor dari respons upstream.
  // Sengaja TANPA \b di depan: pada URL ".../bot123456789:AAA..." tidak ada
  // batas kata sebelum digit, sehingga \b akan menggagalkan pencocokan.
  out = out.replace(/\d{6,12}:[A-Za-z0-9_-]{20,}/g, REDACTED);

  return out.slice(0, 500);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Bot username tanpa "@", mis. "BankSampahDigitalBot". */
function readBotUsername(): string | null {
  const raw = process.env.TELEGRAM_BOT_USERNAME;
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/^@/, '');
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Apakah integrasi Telegram sudah dikonfigurasi?
 * Jika `false`, seluruh fitur Telegram menjadi no-op dan aplikasi tetap berjalan normal.
 */
export function isTelegramConfigured(): boolean {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  return typeof token === 'string' && TOKEN_SHAPE.test(token.trim());
}

export function getTelegramBotUsername(): string | null {
  return readBotUsername();
}

export function hasTelegramWebhookSecret(): boolean {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET;
  return typeof s === 'string' && s.length >= 16;
}

export type TelegramResult =
  | { ok: true }
  | { ok: false; reason: string; description: string };

export interface SendTelegramMessageOptions {
  /** Telegram akan menampilkan preview tautan. */
  disableWebPagePreview?: boolean;
  /** Nonaktifkan notifikasi suara. */
  disableNotification?: boolean;
}

function truncateMessage(text: string): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return `${text.slice(0, MAX_MESSAGE_LENGTH - 3)}...`;
}

/** Escape teks agar aman dipakai sebagai `parse_mode: 'HTML'`. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Panggil satu method Telegram Bot API.
 * Tidak pernah melempar error — selalu mengembalikan hasil ternormalisasi.
 */
async function callTelegram<T>(
  method: string,
  payload: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<{ ok: true; result: T } | { ok: false; reason: string; description: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token || !TOKEN_SHAPE.test(token.trim())) {
    return {
      ok: false,
      reason: 'NOT_CONFIGURED',
      description: 'TELEGRAM_BOT_TOKEN belum dikonfigurasi atau formatnya tidak valid.',
    };
  }

  let response: Response;
  try {
    response = await fetch(`${TELEGRAM_API_BASE}/bot${token.trim()}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const aborted =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    return {
      ok: false,
      reason: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
      description: sanitizeTelegramError(error),
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      ok: false,
      reason: 'BAD_RESPONSE',
      description: `HTTP ${response.status}: respons Telegram bukan JSON valid.`,
    };
  }

  const data = body as { ok?: boolean; result?: T; description?: string; error_code?: number };
  if (!response.ok || data.ok !== true) {
    return {
      ok: false,
      reason: `TELEGRAM_${data.error_code ?? response.status}`,
      description: sanitizeTelegramError(data.description ?? `HTTP ${response.status}`),
    };
  }

  return { ok: true, result: data.result as T };
}

/**
 * Kirim pesan teks ke chat yang SUDAH diverifikasi.
 * Tidak ada parameter "userId" di sini — pemanggil wajib sudah memverifikasi
 * chat id dari database sebelum memanggil fungsi ini.
 */
export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options: SendTelegramMessageOptions = {}
): Promise<TelegramResult> {
  const id = String(chatId ?? '').trim();
  if (!CHAT_ID_SHAPE.test(id)) {
    return {
      ok: false,
      reason: 'INVALID_CHAT_ID',
      description: 'Chat ID Telegram tidak valid.',
    };
  }

  const body = truncateMessage(text);
  if (body.trim().length === 0) {
    return { ok: false, reason: 'EMPTY_MESSAGE', description: 'Pesan kosong.' };
  }

  const result = await callTelegram('sendMessage', {
    chat_id: id,
    text: body,
    parse_mode: 'HTML',
    disable_web_page_preview: options.disableWebPagePreview ?? true,
    disable_notification: options.disableNotification ?? false,
  });

  if (result.ok) return { ok: true };
  return {
    ok: false,
    reason: result.reason,
    description: result.description,
  };
}

export interface TelegramBotInfo {
  id: number;
  username: string;
  firstName: string;
}

/** Validasi token sekaligus mengambil username bot (dipakai script setup). */
export async function getBotInfo(): Promise<
  { ok: true; bot: TelegramBotInfo } | { ok: false; reason: string; description: string }
> {
  const result = await callTelegram<TelegramBotInfo>('getMe', {}, 10000);
  if (!result.ok) return result;
  return {
    ok: true,
    bot: {
      id: result.result.id,
      username: result.result.username,
      firstName: result.result.firstName,
    },
  };
}

/**
 * Daftarkan webhook. `secretToken` diverifikasi oleh Telegram pada setiap request
 * dan dibandingkan di route handler kita (lihat app/api/telegram/webhook/route.ts).
 */
export async function setTelegramWebhook(
  url: string,
  secretToken: string
): Promise<TelegramResult> {
  const result = await callTelegram('setWebhook', {
    url,
    secret_token: secretToken,
    allowed_updates: JSON.stringify(['message']),
    drop_pending_updates: false,
  });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason, description: result.description };
}

export async function deleteTelegramWebhook(): Promise<TelegramResult> {
  const result = await callTelegram('deleteWebhook', { drop_pending_updates: false });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason, description: result.description };
}

/**
 * Bangun deep link aktivasi Telegram untuk sebuah kode.
 * Contoh: https://t.me/BankSampahDigitalBot?start=ABCD1234
 * Mengembalikan null bila username bot belum dikonfigurasi.
 */
export function buildTelegramDeepLink(code: string): string | null {
  const username = readBotUsername();
  if (!username) return null;
  return `https://t.me/${username}?start=${encodeURIComponent(code)}`;
}