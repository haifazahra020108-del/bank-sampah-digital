'use server';

import bcrypt from 'bcryptjs';

import { prisma } from '@/lib/prisma';
import { getSession, createSession } from '@/utils/session';
import { createNotification } from '@/services/notification';

const MIN_LENGTH = 8;
const MAX_LENGTH = 72;

/** Password baru harus punya minimal huruf besar, huruf kecil, angka, dan simbol. */
function validateNewPassword(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password baru minimal ${MIN_LENGTH} karakter.`;
  }
  if (password.length > MAX_LENGTH) {
    return `Password baru maksimal ${MAX_LENGTH} karakter.`;
  }
  if (!/[A-Z]/.test(password)) return 'Password baru harus memuat minimal satu huruf besar.';
  if (!/[a-z]/.test(password)) return 'Password baru harus memuat minimal satu huruf kecil.';
  if (!/[0-9]/.test(password)) return 'Password baru harus memuat minimal satu angka.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password baru harus memuat minimal satu simbol.';
  return null;
}

/**
 * Ganti password milik pengguna yang sedang login.
 * Dipakai untuk menyelesaikan password sementara yang dibuat sistem saat pendaftaran.
 */
export async function changePasswordAction(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession();
  if (!session) {
    return { error: 'Sesi tidak valid. Silakan login kembali.' };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return { error: 'Semua kolom wajib diisi.' };
  }

  if (newPassword !== confirmPassword) {
    return { error: 'Konfirmasi password tidak cocok.' };
  }

  const strengthError = validateNewPassword(newPassword);
  if (strengthError) {
    return { error: strengthError };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, name: true },
    });

    if (!user) {
      return { error: 'Pengguna tidak ditemukan.' };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return { error: 'Password saat ini salah.' };
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        // Password sementara sudah diganti -> regra wajib berubah dilepas.
        mustChangePassword: false,
      },
    });

    // Perbarui sesi aktif agar mustChangePassword langsung false
    await createSession({
      userId: session.userId,
      role: session.role,
      name: session.name,
      email: session.email,
      mustChangePassword: false,
    });

    // Notifikasi website (lonceng); cermin ke Telegram bila sudah terhubung.
    await createNotification({
      userId: user.id,
      title: 'Password Berhasil Diubah',
      message: 'Password akun Anda telah berhasil diperbarui. Gunakan password baru saat login berikutnya.',
      type: 'SYSTEM',
      link: '/dashboard',
    });

    return { success: true };
  } catch {
    return { error: 'Terjadi kesalahan pada server.' };
  }
}