'use server';

import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { createSession, clearSession } from '@/utils/session';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: unknown, formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email dan password harus diisi.' };
  }

  // Di-set di dalam try, dipakai DI LUAR try. `redirect()` melempar error
  // NEXT_REDIRECT yang akan tertangkap `catch` di bawah, jadi redirect tidak
  // boleh dipanggil dari dalam blok try.
  let mustChangePassword = false;
  let loggedInUserId: string | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return { error: 'Email atau password salah.' };
    }

    if (user.status !== 'ACTIVE') {
      return { error: 'Akun Anda tidak aktif.' };
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return { error: 'Email atau password salah.' };
    }

    await createSession({
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      mustChangePassword: Boolean(user.mustChangePassword),
    });

    // Akun dibuat dengan password sementara yang dibuat sistem -> wajib diganti
    // sebelum pengguna bisa memakai aplikasi.
    mustChangePassword = Boolean(user.mustChangePassword);
    loggedInUserId = user.id;
  } catch {
    return { error: 'Terjadi kesalahan pada server.' };
  }

  // Password sementara harus diganti lebih dulu, apa pun role penggunanya.
  if (mustChangePassword && loggedInUserId) {
    redirect('/dashboard/ganti-password');
  }

  // Need to fetch user role again to determine redirect path outside try/catch to avoid NEXT_REDIRECT error catching
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.role === 'ADMIN') {
    redirect('/admin');
  } else if (user?.role === 'MANAGER') {
    redirect('/pengelola');
  } else {
    redirect('/dashboard');
  }
}

export async function logoutAction() {
  await clearSession();
  redirect('/login');
}
