'use client';

import React, { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { changePasswordAction } from '@/app/actions/password';
import styles from './ganti-password.module.css';

export default function GantiPasswordClient() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(changePasswordAction, null);

  useEffect(() => {
    if (state?.success) {
      // Beri jeda singkat agar pesan sukses sempat terlihat, lalu masuk ke beranda.
      const timer = setTimeout(() => router.replace('/dashboard'), 1200);
      return () => clearTimeout(timer);
    }
  }, [state, router]);

  return (
    <form action={formAction} className={styles.form}>
      {state?.error && <div className={styles.errorAlert}>{state.error}</div>}

      {state?.success && (
        <div className={styles.notice}>
          Password berhasil diubah. Mengalihkan ke dashboard...
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="currentPassword">
          Password saat ini
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          className={styles.input}
          autoComplete="current-password"
          required
          disabled={isPending}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="newPassword">
          Password baru
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          className={styles.input}
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
        />
        <p className={styles.hint}>
          Minimal 8 karakter, dan harus memuat huruf besar, huruf kecil, angka, serta simbol.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="confirmPassword">
          Ulangi password baru
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          className={styles.input}
          autoComplete="new-password"
          required
          minLength={8}
          disabled={isPending}
        />
      </div>

      <button type="submit" className={styles.submitButton} disabled={isPending}>
        {isPending ? 'Menyimpan...' : 'Simpan password baru'}
      </button>
    </form>
  );
}