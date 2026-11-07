'use client';

import React, { useState } from 'react';
import { Button } from '@/components/Button/Button';
import { processWithdrawalAction } from '@/app/actions/withdrawal';
import styles from './penarikan.module.css';

interface WithdrawalRequest {
  id: string;
  amount: number;
  requestDate: Date;
  status: string;
  member: { name: string; email: string };
  processedBy?: { name: string } | null;
}

interface PenarikanListProps {
  withdrawals: WithdrawalRequest[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'COMPLETED') return <span className={styles.badgeSuccess}>Selesai</span>;
  if (status === 'PENDING') return <span className={styles.badgeWarning}>Menunggu</span>;
  if (status === 'REJECTED') return <span className={styles.badgeError}>Ditolak</span>;
  return <span className={styles.badgeNeutral}>{status}</span>;
}

export function PenarikanList({ withdrawals }: PenarikanListProps) {
  const [filter, setFilter] = useState('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  
  const filtered = filter === 'ALL' ? withdrawals : withdrawals.filter(w => w.status === filter);

  async function handleProcess(id: string, actionType: 'APPROVE' | 'REJECT') {
    if (processingId) return;
    
    const confirmMessage = actionType === 'APPROVE' 
      ? 'Apakah Anda yakin ingin menyetujui penarikan ini?' 
      : 'Apakah Anda yakin ingin menolak penarikan ini? Saldo akan dikembalikan ke anggota.';
      
    if (!confirm(confirmMessage)) return;

    setProcessingId(id);
    setActionError(null);

    const result = await processWithdrawalAction(id, actionType);

    if (!result.success) {
      setActionError(result.message);
    }
    
    setProcessingId(null);
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.filterGroup}>
          <button 
            className={`${styles.filterBtn} ${filter === 'ALL' ? styles.active : ''}`}
            onClick={() => setFilter('ALL')}
          >
            Semua
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'PENDING' ? styles.active : ''}`}
            onClick={() => setFilter('PENDING')}
          >
            Menunggu
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'COMPLETED' ? styles.active : ''}`}
            onClick={() => setFilter('COMPLETED')}
          >
            Selesai
          </button>
          <button 
            className={`${styles.filterBtn} ${filter === 'REJECTED' ? styles.active : ''}`}
            onClick={() => setFilter('REJECTED')}
          >
            Ditolak
          </button>
        </div>
      </div>

      <div className={styles.cardBody}>
        {actionError && (
          <div className={styles.alertError} role="alert">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            Tidak ada data pengajuan penarikan.
          </div>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Anggota</th>
                  <th>Nominal</th>
                  <th>Tanggal Pengajuan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => (
                  <tr key={w.id}>
                    <td>
                      <div className={styles.memberName}>{w.member.name}</div>
                      <div className={styles.memberEmail}>{w.member.email}</div>
                    </td>
                    <td className={styles.amountValue}>{formatCurrency(w.amount)}</td>
                    <td>{new Date(w.requestDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><StatusBadge status={w.status} /></td>
                    <td>
                      {w.status === 'PENDING' ? (
                        <div className={styles.actionButtons}>
                          <Button 
                            variant="primary" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => handleProcess(w.id, 'APPROVE')}
                            disabled={processingId === w.id}
                          >
                            ✓ Setuju
                          </Button>
                          <Button 
                            variant="danger" 
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                            onClick={() => handleProcess(w.id, 'REJECT')}
                            disabled={processingId === w.id}
                          >
                            ✕ Tolak
                          </Button>
                        </div>
                      ) : (
                        <span className={styles.processedText}>
                          Diproses oleh {w.processedBy?.name ?? 'Admin'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
