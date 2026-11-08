import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { StatCard } from '@/components/StatCard/StatCard';
import { ActivityList } from '@/components/ActivityList/ActivityList';
import { getAdminDashboardStats } from '@/services/dashboard.admin';
import styles from './admin.module.css';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  let stats;
  let error = false;
  try {
    stats = await getAdminDashboardStats();
  } catch {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/admin">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard Admin</h1>
          <p className={styles.pageSubtitle}>
            Selamat datang, {session.name}. Berikut ringkasan Bank Sampah.
          </p>
        </div>
        <div className={styles.dateBadge}>
          {new Date().toLocaleDateString('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat data dashboard. Coba muat ulang halaman.
        </div>
      )}

      {stats && (
        <>
          <div className={styles.statsGrid}>
            <StatCard
              icon="👥"
              label="Total Anggota Aktif"
              value={stats.totalMembers.toString()}
              subValue="Anggota terdaftar"
              accent="blue"
            />
            <StatCard
              icon="♻️"
              label="Total Sampah Terkumpul"
              value={`${stats.totalWasteCollected.toFixed(1)} kg`}
              subValue="Sejak awal beroperasi"
              accent="green"
            />
            <StatCard
              icon="📋"
              label="Total Transaksi"
              value={stats.totalTransactions.toString()}
              subValue="Setoran selesai"
              accent="orange"
            />
            <StatCard
              icon="💰"
              label="Total Nilai Tabungan"
              value={formatCurrency(stats.totalNetSavings)}
              subValue="Saldo bersih semua anggota"
              accent="green"
            />
          </div>

          <ActivityList
            title="🕐 Aktivitas Transaksi Terbaru"
            items={stats.recentActivity}
            showMemberName={true}
            emptyMessage="Belum ada transaksi setoran."
          />
        </>
      )}
    </DashboardLayout>
  );
}
