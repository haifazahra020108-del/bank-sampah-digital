'use client';

import React, { useActionState } from 'react';
import { Button } from '@/components/Button/Button';
import { Input } from '@/components/Input/Input';
import styles from './login.module.css';
import { loginAction } from '@/app/actions/auth';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>Bank Sampah Digital</h1>
          <p className={styles.subtitle}>Masuk untuk mengelola sampah Anda</p>
        </div>

        <form className={styles.form} action={formAction}>
          {state?.error && (
            <div className={styles.errorAlert}>
              {state.error}
            </div>
          )}

          <Input
            label="Email"
            name="email"
            type="email"
            placeholder="Masukkan email Anda"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Masukkan password Anda"
            required
          />

          <div className={styles.actions}>
            <Button type="submit" fullWidth variant="primary" disabled={isPending}>
              {isPending ? 'Memproses...' : 'Masuk'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
