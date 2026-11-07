import React from 'react';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { StatCard } from '@/components/StatCard/StatCard';
import { ActivityList } from '@/components/ActivityList/ActivityList';
import { ShortcutCard } from '@/components/ShortcutCard/ShortcutCard';
import { TelegramSettings } from '@/components/TelegramSettings/TelegramSettings';
import { getMemberDashboardStats } from '@/services/dashboard.member';
import styles from './dashboard.module.css';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export default async function MemberDashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  // Admin dan Manager harusnya ke halamannya masing-masing
  // Proxy middleware sudah handle ini, tapi kita double check untuk amannya
  if (session.role === 'ADMIN') redirect('/admin');
  if (session.role === 'MANAGER') redirect('/pengelola');

  if (session.mustChangePassword) {
    redirect('/dashboard/ganti-password');
  }

  let stats;
  let error = false;
  try {
    stats = await getMemberDashboardStats(session.userId);
  } catch {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/dashboard">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard Anggota</h1>
          <p className={styles.pageSubtitle}>
            Halo, {session.name}. Ini ringkasan tabungan sampahmu.
          </p>
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
                href="/dashboard/transaksi"
                icon="📜"
                label="Riwayat Transaksi"
                description="Lihat semua setoranmu"
                accent="blue"
              />
              <ShortcutCard
                href="/dashboard/penarikan"
                icon="💰"
                label="Ajukan Penarikan"
                description="Cairkan saldo tabungan"
                accent="green"
              />
              <ShortcutCard
                href="/dashboard/ai"
                icon="🤖"
                label="Tanya AI"
                description="Edukasi pilah sampah"
                accent="orange"
              />
            </div>
          </section>

          {/* Stats Pribadi */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>📊 Tabungan Saya</h2>
            <div className={styles.statsGrid}>
              <StatCard
                icon="💳"
                label="Saldo Saat Ini"
                value={formatCurrency(stats.currentBalance)}
                subValue={stats.pendingWithdrawal > 0 ? `(Pending: ${formatCurrency(stats.pendingWithdrawal)})` : "Bisa ditarik kapan saja"}
                accent="green"
              />
              <StatCard
                icon="⚖️"
                label="Total Berat Disetor"
                value={`${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(stats.totalWeight)} kg`}
                subValue="Sejak awal bergabung"
                accent="blue"
              />
              <StatCard
                icon="🔄"
                label="Jumlah Transaksi"
                value={stats.totalTransactions.toString()}
                subValue="Total setoran selesai"
                accent="orange"
              />
            </div>
          </section>

          {/* Transaksi Terakhir */}
          <ActivityList
            title="dY? Transaksi Terakhir"
            items={stats.recentTransactions}
            showMemberName={false} // Anggota tidak perlu melihat namanya sendiri di tiap baris
            emptyMessage="Kamu belum memiliki transaksi setoran."
          />

          <div style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link href="/dashboard/transaksi" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
              Lihat Semua Riwayat
            </Link>
          </div>

          {/* Pengaturan Notifikasi Telegram */}
          <section className={styles.section}>
            <TelegramSettings />
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
