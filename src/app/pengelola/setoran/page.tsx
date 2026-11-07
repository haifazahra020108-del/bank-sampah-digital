import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { SetoranForm } from './SetoranForm';
import { getActiveMembers, getActiveCategories } from '@/services/transaction';
import styles from '../pengelola.module.css';

export const metadata = {
  title: 'Catat Setoran — Bank Sampah Digital',
  description: 'Form pencatatan setoran sampah anggota oleh pengelola.',
};

export default async function SetoranPage() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    redirect('/forbidden');
  }

  // Fetch data kebutuhan form secara paralel
  const [members, categories] = await Promise.all([
    getActiveMembers(),
    getActiveCategories(),
  ]);

  const noMembers    = members.length === 0;
  const noCategories = categories.length === 0;

  return (
    <DashboardLayout session={session} currentPath="/pengelola/setoran">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>📝 Catat Setoran Sampah</h1>
          <p className={styles.pageSubtitle}>
            Rekam setoran sampah anggota — pilih anggota, jenis sampah, dan berat.
          </p>
        </div>
      </div>

      {/* Peringatan jika data prasyarat belum tersedia */}
      {(noMembers || noCategories) && (
        <div className={styles.errorAlert}>
          {noMembers && (
            <p>⚠️ Belum ada anggota aktif. Tambahkan anggota terlebih dahulu di halaman Manajemen Anggota.</p>
          )}
          {noCategories && (
            <p>⚠️ Belum ada jenis sampah aktif. Aktifkan atau tambahkan jenis sampah di halaman Jenis Sampah.</p>
          )}
        </div>
      )}

      {!noMembers && !noCategories && (
        <SetoranForm members={members} categories={categories} />
      )}
    </DashboardLayout>
  );
}
