'use server';

import { revalidatePath } from 'next/cache';

import { prisma } from '@/lib/prisma';
import { getSession, createSession } from '@/utils/session';
import { createNotification } from '@/services/notification';

export async function updateProfileAction(
  prevState: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await getSession();
  if (!session) {
    return { error: 'Sesi tidak valid. Silakan login kembali.' };
  }

  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();

  if (!name || name.length < 2) {
    return { error: 'Nama minimal 2 karakter.' };
  }
  if (name.length > 100) {
    return { error: 'Nama maksimal 100 karakter.' };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Format email tidak valid.' };
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { email, id: { not: session.userId } },
      select: { id: true },
    });
    if (existing) {
      return { error: 'Email sudah digunakan pengguna lain.' };
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
      data: { name, email },
      select: { id: true, role: true, name: true, email: true },
    });

    // Perbarui session agar nama/email baru tercermin di dashboard.
    await createSession({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    });

    try {
      await createNotification({
        userId: user.id,
        title: 'Profil Diperbarui',
        message: 'Informasi profil Anda berhasil diperbarui.',
        type: 'SYSTEM',
        link: '/profil',
      });
    } catch {
      // Notifikasi gagal tidak membatalkan pembaruan profil.
    }

    revalidatePath('/profil');
    revalidatePath('/dashboard');
    revalidatePath('/admin');
    revalidatePath('/pengelola');

    return { success: true };
  } catch {
    return { error: 'Terjadi kesalahan pada server.' };
  }
}
