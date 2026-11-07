'use server';

import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/session';
import { checkRateLimit } from '@/utils/rate-limit';
import { createTelegramLinkCode } from '@/services/telegram-link';
import { getTelegramBotUsername, isTelegramConfigured } from '@/services/telegram';

/**
 * Batas laju pembuatan tautan aktivasi per pengguna.
 *
 * Setiap permintaan menulis baris baru ke database sekaligus membatalkan kode
 * sebelumnya, jadi tanpa batas ini akun yang sudah login bisa dipakai menulis
 * baris tanpa henti dan membatalkan kodenya sendiri berulang kali.
 */
const LINK_CODE_COOLDOWN_MS = 60_000;

export interface TelegramStatusResult {
  success: boolean;
  connected: boolean;
  botUsername: string | null;
  botConfigured: boolean;
  message?: string;
}

/**
 * Status sambungan Telegram milik pengguna yang sedang login.
 * Tidak pernah mengembalikan chat id ke client.
 */
export async function getTelegramStatusAction(): Promise<TelegramStatusResult> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      connected: false,
      botUsername: getTelegramBotUsername(),
      botConfigured: isTelegramConfigured(),
      message: 'Unauthorized',
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { telegramChatId: true },
  });

  return {
    success: true,
    connected: Boolean(user?.telegramChatId),
    botUsername: getTelegramBotUsername(),
    botConfigured: isTelegramConfigured(),
  };
}

export interface CreateLinkCodeResult {
  success: boolean;
  code?: string;
  deepLink?: string | null;
  expiresAt?: string;
  message?: string;
}

/**
 * Buat tautan aktivasi Telegram untuk pengguna yang sedang login.
 * Kode hanya berlaku sekali dan berkedaluwarsa dalam 30 menit.
 */
export async function createTelegramLinkCodeAction(): Promise<CreateLinkCodeResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Sesi tidak valid. Silakan login kembali.' };
  }

  const botUsername = getTelegramBotUsername();
  if (!botUsername) {
    return {
      success: false,
      message:
        'Integrasi Telegram belum dikonfigurasi di server. Hubungi admin untuk bantuan.',
    };
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { telegramChatId: true },
    });

    if (existing?.telegramChatId) {
      return {
        success: false,
        message: 'Telegram Anda sudah terhubung. Gunakan /stop di Telegram untuk memutus.',
      };
    }

    const rateLimit = checkRateLimit(
      `tg-link-code:${session.userId}`,
      1,
      LINK_CODE_COOLDOWN_MS
    );

    if (!rateLimit.allowed) {
      const waitSeconds = Math.ceil(rateLimit.retryAfterMs / 1000);
      return {
        success: false,
        message: `Tautan baru hanya bisa dibuat satu kali per menit. Coba lagi dalam ${waitSeconds} detik.`,
      };
    }

    const created = await createTelegramLinkCode(session.userId);

    return {
      success: true,
      code: created.code,
      deepLink: created.deepLink,
      expiresAt: created.expiresAt.toISOString(),
    };
  } catch {
    return {
      success: false,
      message: 'Gagal membuat tautan aktivasi. Silakan coba lagi.',
    };
  }
}

/** Putuskan sambungan Telegram milik pengguna yang sedang login. */
export async function disconnectTelegramAction(): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { success: false, message: 'Sesi tidak valid.' };

  try {
    await prisma.user.updateMany({
      where: { id: session.userId, telegramChatId: { not: null } },
      data: { telegramChatId: null },
    });

    // Kode yang belum terpakai ikut dibatalkan agar tidak bisa dipakai lagi.
    await prisma.telegramLinkCode.updateMany({
      where: { userId: session.userId, usedAt: null },
      data: { expiresAt: new Date(0) },
    });

    return { success: true, message: 'Sambungan Telegram diputus.' };
  } catch {
    return { success: false, message: 'Gagal memutus sambungan Telegram.' };
  }
}