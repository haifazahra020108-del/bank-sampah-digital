/**
 * Pengiriman notifikasi website -> Telegram.
 *
 * Prinsip yang dijaga file ini:
 *  1. Website TIDAK PERNAH bergantung pada Telegram. Fungsi ini tidak melempar error;
 *     notifikasi website sudah tersimpan sebelum dipanggil.
 *  2. Idempoten. Pengiriman diklaim secara atomik lewat `updateMany` berkondisi
 *     sehingga retry / double-click tidak menghasilkan pesan Telegram ganda.
 *  3. Hanya chat yang SUDAH diverifikasi yang menerima pesan. `telegramChatId` NULL
 *     berarti anggota belum menghubungkan Telegram -> ditandai SKIPPED, bukan dikirim.
 *  4. Riwayat lama tidak disentuh: notifikasi dengan `telegramStatus = null` hanya
 *     ikut saat proses normal membuat notifikasi baru, tidak pernah di-backfill.
 */

import { after } from 'next/server';

import { prisma } from '@/lib/prisma';
import {
  escapeHtml,
  isTelegramConfigured,
  sanitizeTelegramError,
  sendTelegramMessage,
} from '@/services/telegram';

export type TelegramDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

function formatNotificationText(title: string, message: string): string {
  const head = `<b>${escapeHtml(title)}</b>`;
  const body = escapeHtml(message);
  return `${head}\n\n${body}`;
}

/**
 * Klaim hak kirim untuk satu notifikasi.
 *
 * Hanya baris dengan `telegramStatus IS NULL` (= belum pernah dicoba) yang boleh
 * diklaim, sehingga satu notifikasi dijamin terkirim PALING BANYAK SEKALI seumur
 * hidup, berapa kali pun prosesnya diulang.
 *
 * Alasannya: bila pengiriman sebenarnya sudah sampai ke Telegram tapi kita
 * merekam FAILED (mis. timeout jaringan setelah server Telegram memproses),
 * mekanisme retry apa pun akan mengirim pesan yang sama dua kali. Karena aplikasi
 * ini tidak menjalankan scheduler retry, aturan aman "kirim paling banyak sekali"
 * adalah perilaku yang benar. Pengiriman ulang dilakukan manual dengan mengosongkan
 * kembali kolom telegramStatus bila memang dibutuhkan.
 *
 * Catatan SQL: `telegramStatus` nullable, dan `col IN (...)` TIDAK pernah cocok
 * dengan NULL, jadi kondisi ditulis eksplisit.
 */
async function claimNotification(notificationId: string): Promise<boolean> {
  const result = await prisma.notification.updateMany({
    where: { id: notificationId, telegramStatus: null },
    data: { telegramStatus: 'PENDING', telegramError: null },
  });
  return result.count > 0;
}

async function markStatus(
  notificationId: string,
  status: TelegramDeliveryStatus,
  error?: string
): Promise<void> {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        telegramStatus: status,
        telegramSentAt: status === 'SENT' ? new Date() : null,
        telegramError: error ? sanitizeTelegramError(error).slice(0, 300) : null,
      },
    });
  } catch (err) {
    // Kegagalan pencatatan status tidak boleh memengaruhi alur aplikasi.
    console.error('[telegram-delivery] gagal menyimpan status pengiriman:', sanitizeTelegramError(err));
  }
}

/**
 * Kirim satu notifikasi yang SUDAH tersimpan ke Telegram pemiliknya.
 * Selalu resolve, tidak pernah reject.
 */
export async function deliverNotificationToTelegram(notificationId: string): Promise<void> {
  try {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
        title: true,
        message: true,
        telegramStatus: true,
        user: { select: { telegramChatId: true, role: true } },
      },
    });

    if (!notification) return;

    // 1. Dedup: baris yang sudah pernah dicoba (status apa pun selain NULL)
    //    tidak boleh dikirim ulang.
    if (notification.telegramStatus !== null) {
      return;
    }

    // 2. Klaim secara atomik (mencegah balapan antar proses / retry).
    const claimed = await claimNotification(notification.id);
    if (!claimed) return;

    // 3. Bot belum dikonfigurasi -> jangan sentuh apa pun, cukup catat.
    if (!isTelegramConfigured()) {
      await markStatus(notification.id, 'SKIPPED');
      return;
    }

    // 4. Hanya MEMBER/ANGGOTA yang menerima cerminan Telegram, dan hanya ke
    //    chat yang SUDAH diverifikasi. Admin/Pengelola tetap memantau via website.
    const chatId = notification.user.telegramChatId;
    if (notification.user.role !== 'MEMBER' || !chatId || chatId.trim().length === 0) {
      await markStatus(notification.id, 'SKIPPED');
      return;
    }

    const text = formatNotificationText(notification.title, notification.message);

    const result = await sendTelegramMessage(chatId, text);

    if (result.ok) {
      await markStatus(notification.id, 'SENT');
    } else {
      await markStatus(notification.id, 'FAILED', `${result.reason}: ${result.description}`);
      console.warn(
        `[telegram-delivery] notifikasi ${notification.id} gagal dikirim (${result.reason}) - notifikasi website tetap tersimpan.`
      );
    }
  } catch (error) {
    console.error('[telegram-delivery] error tak terduga:', sanitizeTelegramError(error));
  }
}

/**
 * Jadwalkan pengiriman tanpa memblokir respons.
 * Di dalam Next.js request scope dipakai `after()` (stabil sejak Next 15.1);
 * di luar scope (mis. script `tsx`) dijalankan terpisah.
 */
export function scheduleNotificationDelivery(notificationId: string | null | undefined): void {
  if (!notificationId) return;

  const task = () => deliverNotificationToTelegram(notificationId);

  try {
    // `after()` (stabil sejak Next 15.1) menunda pekerjaan ini sampai respons
    // selesai dikirim, sehingga pengiriman Telegram tidak menambah latensi.
    after(task);
  } catch {
    // `after()` melempar error SINKRON di luar request scope (mis. script `tsx`
    // atau job terjadwal). Jalankan terpisah tanpa await.
    void task();
  }
}