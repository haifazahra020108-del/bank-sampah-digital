import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { getMemberBalance } from '@/services/withdrawal';
import { PenarikanForm } from './PenarikanForm';
import styles from '../dashboard.module.css';

export const metadata = {
  title: 'Ajukan Penarikan — Bank Sampah Digital',
};

export default async function PenarikanPage() {
  const session = await getSession();
  if (!session || session.role !== 'MEMBER') {
    redirect('/forbidden');
  }

  if (session.mustChangePassword) {
    redirect('/dashboard/ganti-password');
  }

  let balanceData;
  let error = false;
  try {
    balanceData = await getMemberBalance(session.userId);
  } catch (e) {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/dashboard/penarikan">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Ajukan Penarikan</h1>
          <p className={styles.pageSubtitle}>
            Tarik saldo tabungan sampahmu secara tunai melalui pengelola.
          </p>
        </div>
      </div>

      {error ? (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat data saldo. Coba muat ulang halaman.
        </div>
      ) : (
        <div style={{ maxWidth: '600px' }}>
          <PenarikanForm availableBalance={balanceData?.availableBalance ?? 0} />
        </div>
      )}
    </DashboardLayout>
  );
}
