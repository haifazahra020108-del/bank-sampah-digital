import React from 'react';
import styles from './ActivityList.module.css';

export interface ActivityItem {
  id: string;
  memberName?: string; // Admin/Manager sees member name; Member sees category
  categoryName: string;
  weight: number;
  totalValue: number;
  date: string;
}

interface ActivityListProps {
  title: string;
  items: ActivityItem[];
  showMemberName?: boolean;
  emptyMessage?: string;
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
    month: 'short',
    year: 'numeric',
  });
}

export function ActivityList({
  title,
  items,
  showMemberName = true,
  emptyMessage = 'Belum ada transaksi.',
}: ActivityListProps) {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{title}</h2>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>📭</span>
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {showMemberName && <th>Anggota</th>}
                <th>Jenis Sampah</th>
                <th>Berat</th>
                <th>Nilai</th>
                <th>Tanggal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {showMemberName && (
                    <td>
                      <div className={styles.memberCell}>
                        <span className={styles.memberAvatar}>
                          {(item.memberName ?? '?')[0].toUpperCase()}
                        </span>
                        <span>{item.memberName}</span>
                      </div>
                    </td>
                  )}
                  <td>
                    <span className={styles.categoryBadge}>{item.categoryName}</span>
                  </td>
                  <td className={styles.numericCell}>{new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 }).format(item.weight)} kg</td>
                  <td className={`${styles.numericCell} ${styles.valueCell}`}>
                    {formatCurrency(item.totalValue)}
                  </td>
                  <td className={styles.dateCell}>{formatDate(item.date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
