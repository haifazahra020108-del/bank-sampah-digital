import React from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import GantiPasswordClient from './GantiPasswordClient';
import styles from './ganti-password.module.css';

export default async function GantiPasswordPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <DashboardLayout session={session} currentPath="/dashboard/ganti-password">
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.title}>Ganti Password</h1>
            <p className={styles.subtitle}>
              Halo {session.name}. Password sementara yang dibuat sistem hanya berlaku untuk sekali
              login. Demi keamanan akun, mohon tetapkan password baru Anda sekarang.
            </p>
          </div>

          <GantiPasswordClient />
        </div>

        {!session.mustChangePassword ? (
          <a className={styles.exitLink} href="/dashboard">
            Kembali ke dashboard
          </a>
        ) : (
          <p className={styles.exitLink} style={{ color: 'var(--text-muted)', cursor: 'default' }}>
            🔒 Anda wajib mengganti password sementara sebelum dapat mengakses menu dashboard.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}