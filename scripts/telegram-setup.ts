/**
 * Skrip setup & diagnosis integrasi Telegram.
 *
 *   npx tsx scripts/telegram-setup.ts status    -> cek konfigurasi (tanpa memanggil Telegram)
 *   npx tsx scripts/telegram-setup.ts verify    -> panggil getMe untuk memvalidasi token
 *   npx tsx scripts/telegram-setup.ts webhook   -> daftarkan webhook ke Telegram
 *   npx tsx scripts/telegram-setup.ts unwhook   -> hapus webhook
 *   npx tsx scripts/telegram-setup.ts test <chatId> -> kirim pesan uji ke satu chat
 *
 * Catatan keamanan: token bot TIDAK PERNAH dicetak oleh skrip ini, tidak pernah
 * masuk ke argumen command line, dan tidak pernah ditulis ke log.
 */

// Muat .env.local secara manual (tsx tidak memuat .env secara otomatis).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const rawLine of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

import {
  deleteTelegramWebhook,
  getBotInfo,
  isTelegramConfigured,
  sendTelegramMessage,
  setTelegramWebhook,
} from '../src/services/telegram';

const TOKEN_SHAPE = /^\d+:[A-Za-z0-9_-]{20,}$/;

function mask(value: string | undefined): string {
  if (!value) return '(kosong)';
  return '(terisi, disembunyikan)';
}

async function status() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const url = process.env.TELEGRAM_WEBHOOK_URL;

  console.log('--- STATUS KONFIGURASI TELEGRAM ---');
  console.log(`TELEGRAM_BOT_TOKEN    : ${mask(token)}`);
  console.log(`  format valid        : ${token ? TOKEN_SHAPE.test(token.trim()) : false}`);
  console.log(`TELEGRAM_BOT_USERNAME : ${process.env.TELEGRAM_BOT_USERNAME || '(kosong)'}`);
  console.log(`TELEGRAM_WEBHOOK_SECRET: ${mask(secret)}`);
  console.log(
    `  panjang >= 16       : ${typeof secret === 'string' && secret.length >= 16}`
  );
  console.log(`TELEGRAM_WEBHOOK_URL  : ${url || '(kosong)'}`);
  console.log(`NEXTAUTH_SECRET       : ${mask(process.env.NEXTAUTH_SECRET)}`);
  console.log(`Integrasi aktif       : ${isTelegramConfigured()}`);

  if (!isTelegramConfigured()) {
    console.log(
      '\n>> Integrasi Telegram BELUM AKTIF. Aplikasi tetap berjalan normal tanpa Telegram.'
    );
  }
}

async function verify() {
  if (!isTelegramConfigured()) {
    console.error('TELEGRAM_BOT_TOKEN belum diset atau formatnya tidak valid.');
    process.exit(1);
  }
  console.log('Memvalidasi token dengan Telegram (getMe)...');
  const result = await getBotInfo();
  if (!result.ok) {
    console.error(`GAGAL: ${result.reason} - ${result.description}`);
    process.exit(1);
  }
  console.log(`Token valid.`);
  console.log(`  Bot    : ${result.bot.firstName}`);
  console.log(`  Username: @${result.bot.username}`);
  console.log(`\nTambahkan ke .env.local:`);
  console.log(`  TELEGRAM_BOT_USERNAME="${result.bot.username}"`);
}

async function webhook() {
  const url = process.env.TELEGRAM_WEBHOOK_URL;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!url) {
    console.error('TELEGRAM_WEBHOOK_URL belum diset. Contoh: https://domain-anda.com/api/telegram/webhook');
    process.exit(1);
  }
  if (typeof secret !== 'string' || secret.length < 16) {
    console.error('TELEGRAM_WEBHOOK_SECRET belum diset atau terlalu pendek (minimal 16 karakter).');
    process.exit(1);
  }
  if (!isTelegramConfigured()) {
    console.error('TELEGRAM_BOT_TOKEN belum diset.');
    process.exit(1);
  }

  console.log(`Mendaftarkan webhook: ${url}`);
  const result = await setTelegramWebhook(url, secret);
  if (!result.ok) {
    console.error(`GAGAL: ${result.reason} - ${result.description}`);
    process.exit(1);
  }
  console.log('Webhook berhasil didaftarkan.');
}

async function unwhook() {
  const result = await deleteTelegramWebhook();
  if (!result.ok) {
    console.error(`GAGAL: ${result.reason} - ${result.description}`);
    process.exit(1);
  }
  console.log('Webhook berhasil dihapus.');
}

async function test(chatId?: string) {
  if (!chatId) {
    console.error('Pakai: npx tsx scripts/telegram-setup.ts test <chatId>');
    process.exit(1);
  }
  const result = await sendTelegramMessage(
    chatId,
    '<b>Uji integrasi Bank Sampah Digital</b>\n\nJika Anda menerima pesan ini, pengiriman Telegram berfungsi.'
  );
  if (!result.ok) {
    console.error(`GAGAL: ${result.reason} - ${result.description}`);
    process.exit(1);
  }
  console.log(`Pesan uji berhasil dikirim ke chat ${chatId}.`);
}

// Dibungkus dalam async main() karena tsx mengompilasi skrip ini sebagai CommonJS
// (package.json tidak menyetel "type": "module"), sehingga top-level await akan gagal.
async function main() {
  const [command, arg] = process.argv.slice(2);

  switch (command) {
    case 'status':
      await status();
      break;
    case 'verify':
      await verify();
      break;
    case 'webhook':
      await webhook();
      break;
    case 'unwhook':
      await unwhook();
      break;
    case 'test':
      await test(arg);
      break;
    default:
      console.log(
        'Pakai salah satu perintah: status | verify | webhook | unwhook | test <chatId>'
      );
  }
}

main().catch((error) => {
  console.error('Gagal menjalankan skrip:', error instanceof Error ? error.message : error);
  process.exit(1);
});