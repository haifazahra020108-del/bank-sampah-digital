import { prisma } from '@/lib/prisma';
import { consumeTelegramLinkCode } from '@/services/telegram-link';
import {
  escapeHtml,
  hasTelegramWebhookSecret,
  isTelegramConfigured,
  sanitizeTelegramError,
  sendTelegramMessage,
} from '@/services/telegram';
import { checkRateLimit } from '@/utils/rate-limit';

export const dynamic = 'force-dynamic';

type TgChat = { id: number; type?: string; first_name?: string };
type TgMessage = {
  message_id?: number;
  text?: string;
  chat?: TgChat;
  from?: { id: number; is_bot?: boolean };
};
type TgUpdate = {
  update_id: number;
  message?: TgMessage;
};

const BOT_USERNAME_HINT = 'Hubungi petugas Bank Sampah Digital untuk meminta tautan aktivasi.';

/**
 * Batas laju per chat Telegram.
 *
 * Tanpa batas ini, siapa pun bisa mengirim pesan apa saja ke bot dan setiap
 * pesan dibalas, sehingga chat bisa dipakai untuk membanjiri bot dengan pesan
 * (amplifikasi pesan) sekaligus untuk membakar kuota API bot.
 */
const RATE_LIMIT_MAX_PER_WINDOW = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * Batas lebih ketat untuk percobaan penyambungan. Kode hanya ditebak 1 dari
 * sekitar 2^60, sehingga batas ini terutama menahan percobaan otomatis dan
 * spam kode dari satu chat, bukan mencegah tebakan.
 */
const LINK_RATE_LIMIT_MAX = 5;

/**
 * Perbandingan waktu-konstan-ish untuk secret webhook.
 * Panjang juga dibandingkan karena `timingSafeEqual` menuntut panjang sama.
 */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function POST(request: Request) {
  // 1. Verifikasi secret webhook. Telegram mengirimnya sebagai header
  //    `X-Telegram-Bot-Api-Secret-Token` pada setiap request.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!hasTelegramWebhookSecret()) {
    console.error('[telegram-webhook] TELEGRAM_WEBHOOK_SECRET belum dikonfigurasi.');
    return new Response('Webhook tidak dikonfigurasi.', { status: 503 });
  }

  const provided = request.headers.get('x-telegram-bot-api-secret-token');
  if (!secretMatches(provided, expected as string)) {
    return new Response('Unauthorized.', { status: 401 });
  }

  // 2. Parse body.
  let update: TgUpdate;
  try {
    update = (await request.json()) as TgUpdate;
  } catch {
    return new Response('Bad Request.', { status: 400 });
  }

  const message = update?.message;
  const chat = message?.chat;

  // Pesan dari bot sendiri diabaikan agar tidak memicu loop.
  if (!chat || typeof chat.id !== 'number' || message?.from?.is_bot) {
    return Response.json({ ok: true, handled: false });
  }

  const chatId = String(chat.id);
  const text = String(message.text ?? '').trim();

  // 3. Batas laju per chat. Bot membalas pesan, jadi tanpa batas ini satu chat
  //    bisa membanjiri bot dengan permintaan dan memperbesar pemakaian API.
  const isStartCommand = /^\/start(@\w+)?(\s|$)/i.test(text);
  const limitMax = isStartCommand ? LINK_RATE_LIMIT_MAX : RATE_LIMIT_MAX_PER_WINDOW;
  const rateLimit = checkRateLimit(
    `tg-webhook:${isStartCommand ? 'start' : 'msg'}:${chatId}`,
    limitMax,
    RATE_LIMIT_WINDOW_MS
  );

  if (!rateLimit.allowed) {
    // Tetap balas 200 agar Telegram tidak mencoba ulang secara agresif.
    return Response.json({ ok: true, handled: false, rateLimited: true });
  }

  try {
    // ── /stop → putuskan sambungan ────────────────────────────────────────────
    if (/^\/stop(@\w+)?(\s|$)/i.test(text)) {
      await prisma.user.updateMany({
        where: { telegramChatId: chatId },
        data: { telegramChatId: null },
      });
      await sendTelegramMessage(
        chatId,
        'Sambungan Telegram diputus. Tidak ada lagi notifikasi Bank Sampah Digital yang dikirim ke chat ini.',
        { disableNotification: true }
      );
      return Response.json({ ok: true, handled: 'stop' });
    }

    // ── /start <kode> → hubungkan akun ───────────────────────────────────────
    const startMatch = text.match(/^\/start(?:@\w+)?\s+(\S+)/i);

    if (startMatch) {
      const code = startMatch[1];
      const result = await consumeTelegramLinkCode(code);

      if (!result.ok) {
        await sendTelegramMessage(
          chatId,
          [
            `<b>Penyambungan gagal.</b>`,
            '',
            result.message,
            '',
            'Minta tautan / kode aktivasi baru kepada petugas Bank Sampah Digital, lalu buka lagi tautan tersebut dari dalam Telegram.',
          ].join('\n')
        );
        return Response.json({ ok: true, handled: 'link-failed', reason: result.reason });
      }

      const user = await prisma.user.findUnique({
        where: { id: result.userId },
        select: { id: true, name: true, email: true, telegramChatId: true },
      });

      // Pengguna sudah tidak ada / terhapus.
      if (!user) {
        await sendTelegramMessage(chatId, 'Akun Bank Sampah Digital tidak ditemukan.');
        return Response.json({ ok: true, handled: 'link-failed', reason: 'USER_NOT_FOUND' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: chatId },
      });

      const lines = [
        `<b>Berhasil terhubung! ✅</b>`,
        '',
        `Halo ${escapeHtml(user.name)}, akun Telegram ini sekarang terhubung dengan akun Bank Sampah Digital Anda.`,
        '',
        `Nama: ${escapeHtml(user.name)}`,
        `Email akun: ${escapeHtml(user.email)}`,
        `Alamat login: ${escapeHtml(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')}/login`,
      ];

      // Kredensial HANYA dikirim ke chat yang baru saja memverifikasi kepemilikan
      // akun lewat kode sekali pakai, dan hanya bila payload terenkripsi tersedia.
      const payload = result.payload;
      if (payload?.temporaryPassword) {
        lines.push(
          '',
          '<b>Informasi akses awal</b>',
          `Email: ${escapeHtml(payload.email)}`,
          `Password sementara: <code>${escapeHtml(payload.temporaryPassword)}</code>`
        );
        if (payload.mustChangePassword) {
          lines.push(
            '',
            '⚠️ Password ini sementara dan <b>wajib diganti</b> saat Anda login pertama kali.'
          );
        }
        lines.push('', 'Simpan baik-baik. Jangan bagikan ke siapa pun.');
      } else {
        lines.push('', 'Semua notifikasi Bank Sampah Digital Anda akan dikirim ke chat ini.');
      }

      lines.push('', 'Putuskan sambungan kapan saja dengan perintah /stop.');

      await sendTelegramMessage(chatId, lines.join('\n'));

      return Response.json({ ok: true, handled: 'linked' });
    }

    // ── /start atau perintah lain → petunjuk ────────────────────────────────
    const linked = await prisma.user.findFirst({
      where: { telegramChatId: chatId },
      select: { id: true, name: true },
    });

    if (linked) {
      await sendTelegramMessage(
        chatId,
        [
          `<b>Telegram sudah terhubung.</b>`,
          '',
          `Akun: ${escapeHtml(linked.name)}`,
          'Semua notifikasi Bank Sampah Digital Anda dikirim ke sini.',
          '',
          'Putuskan sambungan dengan /stop.',
        ].join('\n')
      );
    } else {
      await sendTelegramMessage(
        chatId,
        [
          `<b>Bank Sampah Digital Bot</b>`,
          '',
          'Belum ada akun Bank Sampah Digital yang terhubung ke chat ini.',
          '',
          BOT_USERNAME_HINT,
        ].join('\n')
      );
    }

    return Response.json({ ok: true, handled: 'info' });
  } catch (error) {
    // Balas 200 agar Telegram tidak melakukan retry agresif untuk error tak terduga.
    console.error('[telegram-webhook] gagal memproses update:', sanitizeTelegramError(error));
    return Response.json({ ok: true, handled: false, error: true });
  }
}

export async function GET() {
  // Endpoint pemeriksaan kesehatan; tidak membocorkan token maupun konfigurasi.
  return Response.json({
    ok: true,
    telegramConfigured: isTelegramConfigured(),
    webhookSecretConfigured: hasTelegramWebhookSecret(),
  });
}