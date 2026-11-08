import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { getMemberWithdrawals } from '@/services/withdrawal';
import { getMemberTransactions } from '@/services/transaction';
import styles from '../dashboard.module.css';

export const metadata = {
  title: 'Riwayat Transaksi — Bank Sampah Digital',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') {
    return <span className={styles.badgeSuccess}>Selesai</span>;
  }
  if (status === 'PENDING') {
    return <span className={styles.badgeWarning}>Menunggu</span>;
  }
  if (status === 'REJECTED') {
    return <span className={styles.badgeError}>Ditolak</span>;
  }
  return <span className={styles.badgeNeutral}>{status}</span>;
}

export default async function TransaksiPage() {
  const session = await getSession();
  if (!session || session.role !== 'MEMBER') {
    redirect('/forbidden');
  }

  if (session.mustChangePassword) {
    redirect('/dashboard/ganti-password');
  }

  let withdrawals: Awaited<ReturnType<typeof getMemberWithdrawals>> = [];
  let transactions: Awaited<ReturnType<typeof getMemberTransactions>> = [];
  let error = false;

  try {
    const [w, tx] = await Promise.all([
      getMemberWithdrawals(session.userId),
      getMemberTransactions(session.userId),
    ]);
    withdrawals = w;
    transactions = tx;
  } catch {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/dashboard/transaksi">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>📜 Riwayat Transaksi</h1>
          <p className={styles.pageSubtitle}>
            Semua riwayat setoran sampah dan penarikan saldomu.
          </p>
        </div>
      </div>

      {error ? (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat data transaksi. Coba muat ulang halaman.
        </div>
      ) : (
        <div className={styles.transactionGrids}>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>💰 Riwayat Penarikan</h2>
            <div className={styles.card}>
              {withdrawals.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada riwayat penarikan.
                </div>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tanggal Pengajuan</th>
                        <th>Nominal</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td>{new Date(w.requestDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                            {formatCurrency(w.amount)}
                          </td>
                          <td><StatusBadge status={w.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className={styles.section} style={{ marginTop: '2rem' }}>
            <h2 className={styles.sectionTitle}>♻️ Riwayat Setoran</h2>
            <div className={styles.card}>
              {transactions.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Belum ada setoran sampah.
                </div>
              ) : (
                <div className={styles.tableResponsive}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Jenis Sampah</th>
                        <th>Berat</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => (
                        <tr key={tx.id}>
                          <td>{new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td>{tx.category?.name ?? '-'}</td>
                          <td>{tx.weight} kg</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(tx.totalValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </DashboardLayout>
  );
}
