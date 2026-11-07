import React from 'react';
import Link from 'next/link';
import styles from './member.module.css';
import { StatCard } from '@/components/StatCard/StatCard';

interface Transaction {
  id: string;
  categoryName: string;
  weight: number;
  totalValue: number;
  date: string;
}

interface MemberDetailProps {
  member: {
    id: string;
    name: string;
    email: string;
    contact: string | null;
    address: string | null;
    status: string;
    createdAt: string;
    stats: {
      balance: number;
      totalWeight: number;
      totalTransactions: number;
    };
    recentTransactions: Transaction[];
  };
  backPath: string; // '/admin/anggota' or '/pengelola/anggota'
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getInitial(name: string) {
  return name.charAt(0).toUpperCase();
}

export function MemberDetail({ member, backPath }: MemberDetailProps) {
  return (
    <div>
      {/* Back link */}
      <Link
        href={backPath}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
          marginBottom: '1.5rem',
          textDecoration: 'none',
        }}
      >
        ← Kembali ke Daftar Anggota
      </Link>

      {/* Header */}
      <div className={styles.detailHeader}>
        <div className={styles.detailAvatar}>{getInitial(member.name)}</div>
        <div className={styles.detailInfo}>
          <h1>{member.name}</h1>
          <p>{member.email}</p>
          <span
            style={{
              display: 'inline-block',
              marginTop: '0.4rem',
              padding: '0.2rem 0.7rem',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              backgroundColor:
                member.status === 'ACTIVE'
                  ? 'rgba(16,185,129,0.15)'
                  : 'rgba(107,114,128,0.15)',
              color: member.status === 'ACTIVE' ? '#10b981' : '#6b7280',
            }}
          >
            {member.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        <StatCard
          icon="💰"
          label="Saldo"
          value={formatCurrency(member.stats.balance)}
          subValue="Total saldo bersih"
          accent="green"
        />
        <StatCard
          icon="♻️"
          label="Total Sampah Disetor"
          value={`${member.stats.totalWeight.toFixed(2)} kg`}
          subValue="Keseluruhan setoran"
          accent="blue"
        />
        <StatCard
          icon="📋"
          label="Jumlah Transaksi"
          value={member.stats.totalTransactions.toString()}
          subValue="Transaksi selesai"
          accent="orange"
        />
      </div>

      {/* Contact Info */}
      <div className={styles.contactGrid}>
        <div className={styles.contactItem}>
          <h4>ID Anggota</h4>
          <p style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{member.id}</p>
        </div>
        <div className={styles.contactItem}>
          <h4>Nomor Kontak</h4>
          <p>{member.contact ?? '—'}</p>
        </div>
        <div className={styles.contactItem}>
          <h4>Alamat</h4>
          <p>{member.address ?? '—'}</p>
        </div>
        <div className={styles.contactItem}>
          <h4>Tanggal Bergabung</h4>
          <p>{formatDate(member.createdAt)}</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <div
        style={{
          backgroundColor: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            fontWeight: 700,
            fontSize: '1rem',
          }}
        >
          🕐 Riwayat Transaksi Terbaru
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Jenis Sampah</th>
                <th>Berat</th>
                <th style={{ textAlign: 'right' }}>Nilai</th>
              </tr>
            </thead>
            <tbody>
              {member.recentTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      padding: '2.5rem 0',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Belum ada transaksi yang tercatat.
                  </td>
                </tr>
              ) : (
                member.recentTransactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.date)}</td>
                    <td className={styles.boldCell}>{tx.categoryName}</td>
                    <td>{tx.weight.toFixed(2)} kg</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {formatCurrency(tx.totalValue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
