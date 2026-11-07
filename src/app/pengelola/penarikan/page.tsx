import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { getAllWithdrawalRequests } from '@/services/withdrawal';
import { PenarikanList } from './PenarikanList';
import styles from '../pengelola.module.css';

export const metadata = {
  title: 'Proses Penarikan — Bank Sampah Digital',
};

export default async function KelolaPenarikanPage() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    redirect('/forbidden');
  }

  let withdrawals: any[] = [];
  let error = false;
  try {
    withdrawals = await getAllWithdrawalRequests();
  } catch (e) {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/pengelola/penarikan">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>💸 Proses Penarikan</h1>
          <p className={styles.pageSubtitle}>
            Tinjau dan proses pengajuan penarikan saldo anggota.
          </p>
        </div>
      </div>

      {error ? (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat daftar penarikan. Coba muat ulang halaman.
        </div>
      ) : (
        <PenarikanList withdrawals={withdrawals} />
      )}
    </DashboardLayout>
  );
}
