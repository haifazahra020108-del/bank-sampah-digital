import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { ReportDashboard } from '@/components/Report/ReportDashboard';
import { getReportFilterOptions } from '@/services/report';
import styles from '../admin.module.css';

export const metadata = {
  title: 'Laporan Transaksi — Bank Sampah Digital',
};

export default async function LaporanAdminPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  const filterOptions = await getReportFilterOptions();

  return (
    <DashboardLayout session={session} currentPath="/admin/laporan">
      <div className={styles.pageHeader} style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className={styles.pageTitle}>📊 Laporan Bank Sampah</h1>
          <p className={styles.pageSubtitle}>
            Tinjau rekapitulasi data transaksi setoran, saring berdasarkan kriteria, dan ekspor ke CSV/PDF.
          </p>
        </div>
      </div>

      <ReportDashboard filterOptions={filterOptions} />
    </DashboardLayout>
  );
}
