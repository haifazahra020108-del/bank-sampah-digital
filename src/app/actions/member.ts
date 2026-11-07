'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/session';
import { generateTemporaryPassword } from '@/utils/temporary-password';
import bcrypt from 'bcryptjs';
import {
  createNotification,
  createManyNotifications,
  getActiveAdmins,
  getActiveManagers,
} from '@/services/notification';
import { createTelegramLinkCode } from '@/services/telegram-link';
import { getTelegramBotUsername } from '@/services/telegram';

export interface CreateMemberResult {
  success: boolean;
  message: string;
  /** Berisi true bila proses pembuatan akun berhasil. */
  telegram?: {
    delivered: boolean;
    /** Tautan aktivasi yang perlu diteruskan Admin ke anggota. */
    activationLink: string | null;
    /** Password sementara bila sistem membuatnya otomatis. */
    temporaryPassword?: string;
    detail: string;
  };
}

interface TelegramWelcomeInput {
  userId: string;
  name: string;
  email: string;
  temporaryPassword: string | null;
  mustChangePassword: boolean;
}

/**
 * Lengkapi pendaftaran dengan tautan aktivasi Telegram.
 *
 * Anggota yang BARU dibuat belum punya `telegramChatId` (belum pernah memverifikasi
 * identitas Telegram-nya), jadi pesan tidak bisa dikirim ke chat mana pun. Sebagai
 * gantinya dibuat satu tautan aktivasi sekali pakai yang, ketika dibuka anggota di
 * dalam Telegram, memverifikasi kepemilikan chat DAN sekaligus mengembalikan
 * informasi akses awal (termasuk password sementara) di chat terverifikasi tersebut.
 *
 * Bila akun ternyata SUDAH punya `telegramChatId`, kabar pendaftaran TIDAK ditulis
 * ulang di sini. Pesan Telegram berasal dari record notifikasi website yang dibuat
 * `createNotification(..., notifyViaTelegram: true)`, sehingga isinya sama persis
 * dan tidak terkirim dua kali.
 *
 * Tidak pernah melempar error: pendaftaran anggota tetap dianggap sukses.
 */
async function deliverTelegramWelcome(
  input: TelegramWelcomeInput
): Promise<NonNullable<CreateMemberResult['telegram']>> {
  const base = {
    delivered: false,
    activationLink: null as string | null,
    ...(input.temporaryPassword ? { temporaryPassword: input.temporaryPassword } : {}),
  };

  try {
    const existing = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { telegramChatId: true },
    });

    // Akun sudah terhubung: biarkan mekanisme cermin notifikasi website yang
    // mengirim kabar pendaftaran. Jangan membuat pesan kedua yang berbeda.
    if (existing?.telegramChatId) {
      return {
        ...base,
        detail: 'Kabar pendaftaran akan dikirim melalui notifikasi Telegram akun anggota.',
      };
    }

    // Kasus umum: anggota baru belum pernah menghubungkan Telegram, jadi dibuatkan tautan.
    if (!getTelegramBotUsername()) {
      return {
        ...base,
        detail: 'Telegram belum terhubung: username bot belum dikonfigurasi di server.',
      };
    }

    const link = await createTelegramLinkCode(
      input.userId,
      {
        name: input.name,
        email: input.email,
        ...(input.temporaryPassword ? { temporaryPassword: input.temporaryPassword } : {}),
        mustChangePassword: input.mustChangePassword,
      }
    );

    if (!link.deepLink) {
      return {
        ...base,
        detail: 'Telegram belum terhubung: tautan aktivasi tidak dapat dibuat.',
      };
    }

    return {
      ...base,
      activationLink: link.deepLink,
      detail: `Telegram belum terhubung. Teruskan tautan aktivasi berikut ke anggota (berlaku 30 menit): ${link.deepLink}`,
    };
  } catch (error) {
    console.error('[createMemberAction] Telegram welcome error:', error);
    return {
      ...base,
      detail: 'Pengiriman Telegram belum berhasil, namun akun tetap berhasil dibuat.',
    };
  }
}

export async function createMemberAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' } as CreateMemberResult;
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const contact = formData.get('contact') as string;
  const address = formData.get('address') as string;
  const passwordProvided = formData.get('password') as string;

  if (!name || name.trim() === '' || !email || email.trim() === '') {
    return { success: false, message: 'Nama dan Email wajib diisi.' } as CreateMemberResult;
  }

  // Password hanya dibangkitkan bila Admin tidak mengisinya sendiri.
  const usesTemporaryPassword = !passwordProvided || passwordProvided.trim() === '';
  const passwordRaw = usesTemporaryPassword
    ? generateTemporaryPassword()
    : passwordProvided;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email: email.trim() },
    });
    if (existingUser) {
      return { success: false, message: 'Email sudah terdaftar.' } as CreateMemberResult;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordRaw, salt);

    // 1. Akun dibuat DULU. Tidak ada kredensial yang dikirim ke mana pun sebelum
    //    baris ini berhasil.
    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        password: hashedPassword,
        role: 'MEMBER',
        contact: contact?.trim() || null,
        address: address?.trim() || null,
        status: 'ACTIVE',
        mustChangePassword: usesTemporaryPassword,
      },
    });

    revalidatePath('/admin/anggota');
    revalidatePath('/pengelola/anggota');

    // 2. Notifikasi website (lonceng) — tidak pernah bergantung pada Telegram.
    try {
      // 2a. Notifikasi selamat datang untuk anggota baru
      await createNotification({
        userId: newUser.id,
        title: 'Selamat Datang di Bank Sampah Digital!',
        message: 'Akun Anda telah berhasil dibuat oleh Admin. Silakan mulai menyetor sampah untuk mengumpulkan saldo tabungan.',
        type: 'MEMBER',
        link: '/dashboard',
        notifyViaTelegram: true,
      });

      // 2b. Notifikasi untuk semua Pengelola (tugas operasional anggota)
      const managers = await getActiveManagers();
      if (managers.length > 0) {
        await createManyNotifications(
          managers.map((mgr) => ({
            userId: mgr.id,
            title: 'Anggota Baru Terdaftar',
            message: `Anggota baru atas nama ${name.trim()} (${email.trim()}) telah didaftarkan ke sistem.`,
            type: 'MEMBER',
            link: '/pengelola/anggota',
          }))
        );
      }

      // 2c. Notifikasi untuk Admin lain
      const admins = await getActiveAdmins(session.userId);
      if (admins.length > 0) {
        await createManyNotifications(
          admins.map((adm) => ({
            userId: adm.id,
            title: 'Anggota Baru Terdaftar',
            message: `Anggota baru ${name.trim()} (${email.trim()}) berhasil didaftarkan oleh ${session.name}.`,
            type: 'MEMBER',
            link: '/admin/anggota',
          }))
        );
      }
    } catch (notifErr) {
      console.error('[createMemberAction] Notification trigger error:', notifErr);
    }

    // 3. Integrasi Telegram. Kegagalan di sini TIDAK membatalkan pendaftaran.
    const telegram = await deliverTelegramWelcome({
      userId: newUser.id,
      name: name.trim(),
      email: email.trim(),
      temporaryPassword: usesTemporaryPassword ? passwordRaw : null,
      mustChangePassword: usesTemporaryPassword,
    });

    const parts = ['Anggota berhasil ditambahkan.'];
    parts.push(telegram.detail);
    if (usesTemporaryPassword) {
      parts.push(
        `Password sementara: ${passwordRaw} (wajib diganti saat login pertama).`
      );
    }

    return {
      success: true,
      message: parts.join(' '),
      telegram,
    } as CreateMemberResult;
  } catch (error) {
    console.error('Error creating member:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' } as CreateMemberResult;
  }
}

export async function updateMemberAction(id: string, formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const contact = formData.get('contact') as string;
  const address = formData.get('address') as string;

  if (!name || name.trim() === '' || !email || email.trim() === '') {
    return { success: false, message: 'Nama dan Email wajib diisi.' };
  }

  try {
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: email.trim() },
        id: { not: id },
      },
    });
    if (existingUser) {
      return { success: false, message: 'Email sudah terdaftar oleh pengguna lain.' };
    }

    await prisma.user.update({
      where: { id },
      data: {
        name: name.trim(),
        email: email.trim(),
        contact: contact?.trim() || null,
        address: address?.trim() || null,
      },
    });

    revalidatePath('/admin/anggota');
    revalidatePath(`/admin/anggota/${id}`);
    return { success: true, message: 'Data anggota berhasil diperbarui.' };
  } catch (error) {
    console.error('Error updating member:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}

export async function toggleMemberStatusAction(id: string, currentStatus: string) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized' };
  }

  try {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    
    await prisma.user.update({
      where: { id },
      data: { status: newStatus },
    });

    revalidatePath('/admin/anggota');
    revalidatePath(`/admin/anggota/${id}`);
    revalidatePath('/pengelola/anggota');

    // ── Trigger notification on status change ─────────────────────────────
    try {
      await createNotification({
        userId: id,
        title: newStatus === 'ACTIVE' ? 'Akun Anda Telah Diaktifkan' : 'Pemberitahuan Status Akun',
        message:
          newStatus === 'ACTIVE'
            ? 'Akun Anda telah diaktifkan kembali oleh Admin. Anda dapat kembali menggunakan layanan Bank Sampah.'
            : 'Akun Anda telah dinonaktifkan sementara oleh Admin. Hubungi pengurus jika ada pertanyaan.',
        type: 'MEMBER',
        link: '/dashboard',
      });
    } catch (notifErr) {
      console.error('[toggleMemberStatusAction] Notification trigger error:', notifErr);
    }

    return { success: true, message: `Anggota berhasil di${newStatus === 'ACTIVE' ? 'aktifkan' : 'nonaktifkan'}.` };
  } catch (error) {
    console.error('Error toggling member status:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}

export interface ResetMemberPasswordParams {
  memberId: string;
  mode: 'AUTO' | 'MANUAL';
  manualPassword?: string;
  mustChangePassword?: boolean;
}

export interface ResetMemberPasswordResult {
  success: boolean;
  message: string;
  temporaryPassword?: string;
  email?: string;
  name?: string;
}

/**
 * Eksekusi reset password anggota dengan validasi otorisasi, penolakan role non-MEMBER,
 * hashing bcrypt, dan pembaruan database tanpa merusak data anggota lainnya.
 */
export async function executeResetMemberPassword(
  params: ResetMemberPasswordParams,
  actorRole?: string
): Promise<ResetMemberPasswordResult> {
  if (actorRole !== 'ADMIN') {
    return { success: false, message: 'Unauthorized: Hanya Admin yang dapat mereset password anggota.' };
  }

  const { memberId, mode, manualPassword, mustChangePassword } = params;

  if (!memberId || typeof memberId !== 'string') {
    return { success: false, message: 'ID anggota tidak valid.' };
  }

  try {
    const target = await prisma.user.findUnique({
      where: { id: memberId },
    });

    if (!target) {
      return { success: false, message: 'Anggota tidak ditemukan.' };
    }

    if (target.role !== 'MEMBER') {
      return {
        success: false,
        message: 'Aksi ditolak: Reset password melalui menu ini hanya dapat dilakukan untuk akun dengan role MEMBER.',
      };
    }

    let passwordPlain = '';
    let requireChange = false;

    if (mode === 'AUTO') {
      passwordPlain = generateTemporaryPassword();
      requireChange = mustChangePassword ?? true;
    } else if (mode === 'MANUAL') {
      if (!manualPassword || manualPassword.trim().length < 6) {
        return { success: false, message: 'Password manual minimal 6 karakter.' };
      }
      passwordPlain = manualPassword.trim();
      requireChange = Boolean(mustChangePassword);
    } else {
      return { success: false, message: 'Mode reset password tidak valid.' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(passwordPlain, salt);

    // Update HANYA password dan mustChangePassword. Jangan merusak field lain (email, role, status, dll.)
    await prisma.user.update({
      where: { id: target.id },
      data: {
        password: hashedPassword,
        mustChangePassword: requireChange,
      },
    });

    try {
      revalidatePath('/admin/anggota');
      revalidatePath(`/admin/anggota/${target.id}`);
      revalidatePath('/pengelola/anggota');
    } catch {
      // Ignored outside Next.js request context
    }

    // Notifikasi website untuk anggota
    try {
      await createNotification({
        userId: target.id,
        title: 'Password Akun Telah Direset',
        message: requireChange
          ? 'Password akun Anda telah direset oleh Admin dengan password sementara. Anda wajib mengganti password saat login berikutnya.'
          : 'Password akun Anda telah direset oleh Admin. Silakan gunakan password baru Anda untuk login.',
        type: 'SYSTEM',
        link: '/dashboard',
      });
    } catch (notifErr) {
      console.error('[resetMemberPasswordAction] Notification trigger error:', notifErr);
    }

    return {
      success: true,
      message: 'Password anggota berhasil direset.',
      temporaryPassword: passwordPlain,
      email: target.email,
      name: target.name,
    };
  } catch (error) {
    console.error('[resetMemberPasswordAction] Error resetting password:', error);
    return { success: false, message: 'Terjadi kesalahan sistem saat mereset password.' };
  }
}

/**
 * Server Action: Reset password anggota oleh Admin.
 * Memverifikasi sesi Admin di sisi server dan mendelegasikan ke executeResetMemberPassword.
 */
export async function resetMemberPasswordAction(
  params: ResetMemberPasswordParams
): Promise<ResetMemberPasswordResult> {
  let session = null;
  try {
    session = await getSession();
  } catch {
    // Di luar request context
  }

  if (!session || session.role !== 'ADMIN') {
    return { success: false, message: 'Unauthorized: Hanya Admin yang dapat mereset password anggota.' };
  }

  return executeResetMemberPassword(params, session.role);
}

