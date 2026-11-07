'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button/Button';
import { requestWithdrawalAction } from '@/app/actions/withdrawal';
import styles from './penarikan.module.css';

interface PenarikanFormProps {
  availableBalance: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);
}

export function PenarikanForm({ availableBalance }: PenarikanFormProps) {
  const router = useRouter();
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const amount = parseFloat(amountStr);
  const isValid = !isNaN(amount) && amount > 0 && amount <= availableBalance;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSubmitting) return;
    
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('amount', amount.toString());

    const result = await requestWithdrawalAction(formData);

    if (result.success) {
      setSuccessMsg(result.message);
      setAmountStr('');
      // Redirect after short delay
      setTimeout(() => {
        router.push('/dashboard/transaksi');
      }, 2000);
    } else {
      setError(result.message);
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardHeaderIcon}>💸</span>
        <span className={styles.cardHeaderTitle}>Form Pengajuan Penarikan</span>
      </div>
      <div className={styles.cardBody}>
        
        {error && (
          <div className={styles.alertError} role="alert">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className={styles.alertSuccess} role="alert">
            <span>✅</span>
            <span>{successMsg}</span>
          </div>
        )}

        <div className={styles.balanceInfo}>
          <span className={styles.balanceLabel}>Saldo Tersedia:</span>
          <span className={styles.balanceValue}>{formatCurrency(availableBalance)}</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel} htmlFor="withdraw-amount">
              Nominal Penarikan (Rp) <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="withdraw-amount"
              type="number"
              className={styles.formInput}
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="Contoh: 50000"
              min="100"
              step="100"
              max={availableBalance}
              disabled={isSubmitting || availableBalance <= 0}
            />
            <p className={styles.formHint}>
              Masukkan nominal yang ingin ditarik. Saldo tidak boleh negatif.
            </p>
          </div>

          <div className={styles.actionBar}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/dashboard')}
              disabled={isSubmitting}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!isValid || isSubmitting || availableBalance <= 0}
            >
              {isSubmitting ? 'Mengajukan...' : 'Ajukan Penarikan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
