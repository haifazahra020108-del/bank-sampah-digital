import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { StatCard } from '@/components/StatCard/StatCard';
import { ActivityList } from '@/components/ActivityList/ActivityList';
import { ShortcutCard } from '@/components/ShortcutCard/ShortcutCard';
import { getManagerDashboardStats } from '@/services/dashboard.manager';
import styles from './pengelola.module.css';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export default async function PengelolaPage() {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    redirect('/forbidden');
  }

  let stats;
  let error = false;
  try {
    stats = await getManagerDashboardStats();
  } catch (e) {
    error = true;
  }

  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <DashboardLayout session={session} currentPath="/pengelola">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard Pengelola</h1>
          <p className={styles.pageSubtitle}>Rekap operasional hari ini — {today}</p>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat data dashboard. Coba muat ulang halaman.
        </div>
      )}

      {stats && (
        <>
          {/* Aksi Cepat */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>⚡ Aksi Cepat</h2>
            <div className={styles.shortcutGrid}>
              <ShortcutCard
                href="/pengelola/setoran"
                icon="📝"
                label="Catat Setoran"
                description="Rekam setoran sampah anggota"
                accent="green"
              />
              <ShortcutCard
                href="/pengelola/penarikan"
                icon="💸"
                label="Proses Penarikan"
                description="Setujui atau tolak penarikan"
                accent="blue"
              />
              <ShortcutCard
                href="/pengelola/anggota"
                icon="👥"
                label="Data Anggota"
                description="Lihat daftar anggota aktif"
                accent="orange"
              />
            </div>
          </section>

          {/* Stats Hari Ini */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>📊 Rekap Hari Ini</h2>
            <div className={styles.statsGrid}>
              <StatCard
                icon="💵"
                label="Nilai Setoran Hari Ini"
                value={formatCurrency(stats.todayDepositsValue)}
                subValue="Total nilai transaksi"
                accent="green"
              />
              <StatCard
                icon="⚖️"
                label="Total Berat Hari Ini"
                value={`${stats.todayWeight.toFixed(1)} kg`}
                subValue="Sampah terkumpul hari ini"
                accent="blue"
              />
              <StatCard
                icon="🔢"
                label="Transaksi Hari Ini"
                value={stats.todayTransactionCount.toString()}
                subValue="Jumlah setoran tercatat"
                accent="orange"
              />
            </div>
          </section>

          {/* Transaksi Terbaru */}
          <ActivityList
            title="🕐 Transaksi Terbaru"
            items={stats.recentTransactions}
            showMemberName={true}
            emptyMessage="Belum ada transaksi hari ini."
          />
        </>
      )}
    </DashboardLayout>
  );
}
