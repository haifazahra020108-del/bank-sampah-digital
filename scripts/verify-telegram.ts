/**
 * Verifikasi integrasi Telegram.
 *
 *   npx tsx scripts/verify-telegram.ts
 *
 * Menguji hal-hal yang BISA diuji tanpa bot sungguhan:
 *   1. Integrasi mati (tanpa token) -> notifikasi website tetap tersimpan normal.
 *   2. Anggota tanpa Telegram TIDAK menerima pesan (tidak ada kebocoran data).
 *   3. Tidak ada notifikasi ganda saat pengiriman dicoba ulang (idempotensi).
 *   4. Notifikasi milik anggota lain tidak pernah dikirim ke chat anggota ini.
 *   5. Kode aktivasi sekali pakai + kedaluwarsa, dan payload kredensial terenkripsi.
 *   6. Kode plaintext tidak pernah tersimpan di database.
 *   7. Kegagalan Telegram tidak menggagalkan pembuatan notifikasi website.
 *   8. Notifikasi lama (telegramStatus NULL) tidak ikut dikirim ulang.
 *
 * Semua notifikasi uji diberi awalan "[TG-TEST]" dan dibersihkan di akhir.
 */

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

import { prisma } from '../src/lib/prisma';
import { createNotification } from '../src/services/notification';
import { deliverNotificationToTelegram } from '../src/services/telegram-delivery';
import {
  consumeTelegramLinkCode,
  createTelegramLinkCode,
  decryptPayload,
  encryptPayload,
} from '../src/services/telegram-link';
import { isTelegramConfigured, sanitizeTelegramError } from '../src/services/telegram';

const PREFIX = '[TG-TEST]';
const FAKE_CHAT = '99887766';

let passed = 0;
let failed = 0;

function pass(label: string) {
  passed += 1;
  console.log(`  [PASS] ${label}`);
}

function fail(label: string, detail?: string) {
  failed += 1;
  console.error(`  [FAIL] ${label}${detail ? ` -> ${detail}` : ''}`);
}

function check(label: string, condition: boolean, detail?: string) {
  if (condition) pass(label);
  else fail(label, detail);
}

async function main() {
  console.log('--- VERIFIKASI INTEGRASI TELEGRAM ---\n');

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const memberA = await prisma.user.findFirst({ where: { role: 'MEMBER', status: 'ACTIVE' } });
  const memberB = await prisma.user.findFirst({
    where: { role: 'MEMBER', status: 'ACTIVE', ...(memberA ? { id: { not: memberA.id } } : {}) },
  });

  if (!admin || !memberA) {
    console.error('Butuh minimal satu user ADMIN dan satu MEMBER aktif di database.');
    process.exit(1);
  }
  // narrowing eksplisit agar TypeScript understands memberA non-null di closures.
  const memberPrimary = memberA;
  pass(`User uji ditemukan (member: ${memberPrimary.name})`);

  // Simpan nilai awal supaya pulih persis seperti semula.
  const originalChatId = memberA.telegramChatId;
  const originalMustChange = memberA.mustChangePassword;

  const createdNotificationIds: string[] = [];
  const createdCodeIds: string[] = [];

  /**
   * Baris notifikasi dibuat LANGSUNG lewat prisma (tanpa createNotification).
   * Dipakai pada pengujian yang memeriksa `telegramStatus`, supaya tidak ada
   * pengiriman latar dari createNotification yang memegang klaim PENDING dan
   * membuat hasil pengujian bergantung pada urutan (race).
   */
  async function createRow(userId: string, title: string, message: string) {
    const row = await prisma.notification.create({
      data: { userId, title, message, type: 'SYSTEM', isRead: false },
    });
    createdNotificationIds.push(row.id);
    return row;
  }

  async function cleanup() {
    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({ where: { id: { in: createdNotificationIds } } });
    }
    if (createdCodeIds.length > 0) {
      await prisma.telegramLinkCode.deleteMany({ where: { id: { in: createdCodeIds } } });
    }
    await prisma.user
      .update({
        where: { id: memberPrimary.id },
        data: { telegramChatId: originalChatId, mustChangePassword: originalMustChange },
      })
      .catch(() => undefined);
  }

  try {
    // ── 1. Integrasi mati: notifikasi website tetap normal ──────────────────
    console.log('\n[1] Integrasi Telegram tidak terkonfigurasi');
    {
      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      check('isTelegramConfigured() bernilai false', isTelegramConfigured() === false);

      const notif = await createNotification({
        userId: memberA.id,
        title: `${PREFIX} Notifikasi saat integrasi mati`,
        message: 'Pesan ini harus tetap muncul di lonceng website.',
        type: 'SYSTEM',
        link: '/dashboard',
      });

      check('Notifikasi website tetap dibuat', notif !== null);
      if (notif) {
        createdNotificationIds.push(notif.id);
        await deliverNotificationToTelegram(notif.id);

        const row = await prisma.notification.findUnique({
          where: { id: notif.id },
          select: { telegramStatus: true, isRead: true },
        });
        check(
          'Status ditandai SKIPPED, bukan error',
          row?.telegramStatus === 'SKIPPED',
          `telegramStatus=${row?.telegramStatus}`
        );
        check('Status baca tidak berubah', row?.isRead === false);
      }

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    }

    // ── 1b. Jalur createNotification(): lonceng tetap berfungsi ─────────────
    console.log('\n[1b] createNotification() tetap mengisi lonceng website');
    {
      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const bell = await createNotification({
        userId: memberA.id,
        title: `${PREFIX} Lonceng tetap berfungsi`,
        message: 'Pesan ini harus muncul di lonceng.',
        type: 'SYSTEM',
        link: '/dashboard',
      });

      check('createNotification mengembalikan baris notifikasi', bell !== null);
      if (bell) {
        createdNotificationIds.push(bell.id);
        const row = await prisma.notification.findUnique({
          where: { id: bell.id },
          select: { title: true, isRead: true, link: true },
        });
        check('Judul tersimpan utuh di database', row?.title === `${PREFIX} Lonceng tetap berfungsi`);
        check('Tautan tersimpan utuh', row?.link === '/dashboard');
        check('Notifikasi masuk sebagai belum dibaca', row?.isRead === false);
      }

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
    }

    // ── 2. Anggota tanpa Telegram tidak boleh dikirimi apa pun ──────────────
    console.log('\n[2] Anggota yang belum menghubungkan Telegram');
    {
      await prisma.user.update({
        where: { id: memberA.id },
        data: { telegramChatId: null },
      });

      // Token palsu berformat valid akan mencoba menghubungi Telegram,
      // namun pengiriman tetap berhenti karena chatId kosong.
      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      const notif = await createRow(
        memberA.id,
        `${PREFIX} Anggota belum menghubungkan Telegram`,
        'Anggota ini belum punya Telegram.'
      );
      check('Notifikasi tetap dibuat', notif !== null);

      await deliverNotificationToTelegram(notif.id);

      const row = await prisma.notification.findUnique({
        where: { id: notif.id },
        select: { telegramStatus: true },
      });
      check(
        'Tidak dikirim: SKIPPED karena chatId belum diverifikasi',
        row?.telegramStatus === 'SKIPPED',
        `telegramStatus=${row?.telegramStatus}`
      );

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }

    // ── 3. Idempotensi: tidak ada pesan Telegram ganda saat diulang ─────────
    console.log('\n[3] Idempotensi (pencegahan notifikasi duplikat)');
    {
      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      // Token format-valid tapi pasti gagal ke jaringan -> status FAILED.
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      await prisma.user.update({
        where: { id: memberA.id },
        data: { telegramChatId: FAKE_CHAT },
      });

      const notif = await createRow(
        memberA.id,
        `${PREFIX} Uji idempotensi`,
        'Dikirim dua kali untuk memeriksa duplikasi.'
      );
      check('Notifikasi dibuat', notif !== null);

      // Pengiriman pertama benar-benar dicoba dan dicatat.
      await deliverNotificationToTelegram(notif.id);
      const afterFirst = await prisma.notification.findUnique({
        where: { id: notif.id },
        select: { telegramStatus: true, telegramError: true },
      });

      // Pengiriman kedua & ketiga: tidak boleh mengubah apa pun.
      await deliverNotificationToTelegram(notif.id);
      await deliverNotificationToTelegram(notif.id);

      const row = await prisma.notification.findUnique({
        where: { id: notif.id },
        select: { telegramStatus: true, telegramError: true },
      });

      check(
        'Pengiriman pertama dicatat (token palsu ditolak Telegram)',
        afterFirst?.telegramStatus === 'FAILED',
        `telegramStatus=${afterFirst?.telegramStatus}`
      );
      check(
        'Percobaan kedua & ketiga diabaikan: tidak ada pesan Telegram ganda',
        row?.telegramStatus === 'FAILED' &&
          (row.telegramError ?? '') === (afterFirst?.telegramError ?? ''),
        `telegramStatus=${row?.telegramStatus}`
      );
      check(
        'Pesan error tersanitasi tercatat untuk diagnosis',
        (afterFirst?.telegramError ?? '').length > 0 &&
          !(afterFirst?.telegramError ?? '').includes('1234567890:'),
        afterFirst?.telegramError ?? '(kosong)'
      );

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }

    // ── 4. Kegagalan Telegram tidak merusak notifikasi website ──────────────
    console.log('\n[4] Telegram gagal -> notifikasi website tetap utuh');
    {
      await prisma.user.update({
        where: { id: memberA.id },
        data: { telegramChatId: FAKE_CHAT },
      });

      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

      const before = await prisma.notification.count({ where: { userId: memberA.id } });
      const notif = await createNotification({
        userId: memberA.id,
        title: `${PREFIX} Notifikasi harus tetap ada`,
        message: 'Meskipun Telegram gagal, baris ini harus tetap tersimpan.',
        type: 'SYSTEM',
      });
      const after = await prisma.notification.count({ where: { userId: memberA.id } });

      check('Notifikasi tetap tersimpan', notif !== null);
      check('Jumlah notifikasi bertambah tepat 1', after === before + 1, `${before} -> ${after}`);
      if (notif) createdNotificationIds.push(notif.id);

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }

    // ── 5. Kode aktivasi sekali pakai, berlaku, dan terenkripsi ─────────────
    console.log('\n[5] Kode aktivasi sekali pakai + enkripsi payload');
    {
      const link = await createTelegramLinkCode(memberA.id, {
        name: 'Anggota Uji',
        email: 'anggota.uji@example.com',
        temporaryPassword: 'RahasiaKuat123!',
        mustChangePassword: true,
      });

      const record = await prisma.telegramLinkCode.findFirst({
        where: { userId: memberA.id, expiresAt: { gt: new Date(0) } },
        orderBy: { createdAt: 'desc' },
      });
      if (record) createdCodeIds.push(record.id);

      check('Kode memiliki bentuk XXXX-XXXX-XXXX', /^[0-9A-Z]{4}(-[0-9A-Z]{4}){2}$/.test(link.code), link.code);
      check('Deep link tersusun bila username bot diset', link.deepLink === null || link.deepLink.includes(link.code));

      // Kode plaintext tidak boleh tersimpan.
      check(
        'Kode plaintext tidak tersimpan di database',
        record !== null && !JSON.stringify(record).includes(link.code)
      );
      check(
        'Payload kredensial tersimpan dalam bentuk terenkripsi',
        record?.payloadCipher !== null && record?.payloadCipher !== undefined && record.payloadCipher.includes('.')
      );
      check(
        'Password sementara tidak bocor di ciphertext',
        record?.payloadCipher ? !record.payloadCipher.includes('RahasiaKuat123!') : false
      );

      // Uji round-trip enkripsi & dekripsi payload.
      const cipher = encryptPayload({ name: 'A', email: 'a@b.c', mustChangePassword: false });
      const plain = decryptPayload(cipher);
      check('Enkripsi & dekripsi payload berhasil', plain?.email === 'a@b.c');

      // Klaim pertama harus sukses.
      const first = await consumeTelegramLinkCode(link.code);
      check('Klaim kode pertama berhasil', first.ok === true);
      check(
        'Payload kredensial terbaca hanya pada klaim sah',
        first.ok && first.payload?.temporaryPassword === 'RahasiaKuat123!'
      );

      // Klaim kedua harus ditolak (sekali pakai).
      const second = await consumeTelegramLinkCode(link.code);
      check('Klaim kedua ditolak (kode sekali pakai)', second.ok === false && second.reason === 'USED');

      // Normalisasi kode (huruf kecil + tanpa tanda pisah) tetap dikenali.
      const link2 = await createTelegramLinkCode(memberA.id);
      const rec2 = await prisma.telegramLinkCode.findFirst({
        where: { userId: memberA.id, expiresAt: { gt: new Date(0) } },
        orderBy: { createdAt: 'desc' },
      });
      if (rec2) createdCodeIds.push(rec2.id);

      const messy = link2.code.toLowerCase().replace(/-/g, '');
      const third = await consumeTelegramLinkCode(messy);
      check('Kode tetap dikenali meski huruf kecil & tanpa tanda pisah', third.ok === true);

      // Kode kedaluwarsa harus ditolak.
      const link3 = await createTelegramLinkCode(memberA.id);
      const rec3 = await prisma.telegramLinkCode.findFirst({
        where: { userId: memberA.id, expiresAt: { gt: new Date(0) } },
        orderBy: { createdAt: 'desc' },
      });
      if (rec3) createdCodeIds.push(rec3.id);
      await prisma.telegramLinkCode.update({
        where: { id: rec3!.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const expired = await consumeTelegramLinkCode(link3.code);
      check(
        'Kode kedaluwarsa ditolak',
        expired.ok === false && (expired.reason === 'EXPIRED' || expired.reason === 'NOT_FOUND'),
        expired.ok ? 'ok' : expired.reason
      );

      // Kode tak dikenal harus ditolak.
      const unknown = await consumeTelegramLinkCode('ZZZZ-ZZZZ-ZZZZ');
      check('Kode tak dikenal ditolak', unknown.ok === false);
    }

    // ── 6. Isolasi data antar anggota ───────────────────────────────────────
    console.log('\n[6] Isolasi antar anggota');
    {
      if (memberB) {
        await prisma.user.updateMany({
          where: { id: { in: [memberA.id, memberB.id] } },
          data: { telegramChatId: null },
        });
        await prisma.user.update({
          where: { id: memberA.id },
          data: { telegramChatId: FAKE_CHAT },
        });

        const savedToken = process.env.TELEGRAM_BOT_TOKEN;
        process.env.TELEGRAM_BOT_TOKEN = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

        const notifB = await createRow(
          memberB.id,
          `${PREFIX} Rahasia anggota B`,
          'Pesan privat anggota B.'
        );
        check('Notifikasi anggota B dibuat', notifB !== null);
        await deliverNotificationToTelegram(notifB.id);

        const rowB = await prisma.notification.findUnique({
          where: { id: notifB.id },
          select: { telegramStatus: true },
        });
        check(
          'Notifikasi anggota B tidak dikirim (chatId B belum diverifikasi)',
          rowB?.telegramStatus === 'SKIPPED',
          `telegramStatus=${rowB?.telegramStatus}`
        );

        if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
        else delete process.env.TELEGRAM_BOT_TOKEN;
      } else {
        console.log('  [SKIP] Hanya ada satu anggota aktif di database.');
      }
    }

    // ── 7. Sanitasi error tidak membocorkan token ──────────────────────────
    console.log('\n[7] Kebocoran kredensial');
    {
      const fakeToken = '1234567890:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      const savedToken = process.env.TELEGRAM_BOT_TOKEN;
      process.env.TELEGRAM_BOT_TOKEN = fakeToken;

      // Jalur 1: token yang sedang dikonfigurasi.
      const leaky = `Gagal request ke https://api.telegram.org/bot${fakeToken}/sendMessage`;
      const sanitized = sanitizeTelegramError(leaky);
      check('Token hilang dari pesan error', !sanitized.includes(fakeToken), sanitized);
      check('Nilai yang disanitasi ada penanda [REDACTED]', sanitized.includes('[REDACTED]'));

      // Jalur 2: pola token generic dari upstream, saat env tidak menyetelnya.
      delete process.env.TELEGRAM_BOT_TOKEN;
      const generic = sanitizeTelegramError('upstream said 9876543210:ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ');
      check('Pola token generic juga dibersihkan', !generic.includes('9876543210'), generic);

      if (savedToken !== undefined) process.env.TELEGRAM_BOT_TOKEN = savedToken;
      else delete process.env.TELEGRAM_BOT_TOKEN;
    }

    // ── 8. Notifikasi lama tidak dikirim ulang ─────────────────────────────
    console.log('\n[8] Notifikasi lama (telegramStatus NULL) tidak ikut dikirim');
    {
      const legacy = await prisma.notification.findFirst({
        where: { telegramStatus: null, title: { not: { startsWith: PREFIX } } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, telegramStatus: true },
      });

      if (legacy) {
        check('Ditemukan notifikasi lama dengan status NULL', legacy.telegramStatus === null);
        check(
          'Status lama tetap NULL setelah semua pengujian',
          (await prisma.notification.findUnique({
            where: { id: legacy.id },
            select: { telegramStatus: true },
          }))?.telegramStatus === null
        );
      } else {
        console.log('  [SKIP] Tidak ada notifikasi lama di database.');
      }
    }
  } finally {
    await cleanup();
  }

  console.log(`\n--- RINGKASAN: ${passed} lulus, ${failed} gagal ---`);
  if (failed > 0) process.exit(1);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('Test gagal total:', err);
    await prisma.$disconnect();
    process.exit(1);
  });