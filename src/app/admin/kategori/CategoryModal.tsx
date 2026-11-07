'use client';

import React, { useState, useEffect } from 'react';
import styles from './categories.module.css';
import { Button } from '@/components/Button/Button';
import { createCategoryAction, updateCategoryAction } from '@/app/actions/category';

export interface CategoryData {
  id?: string;
  name: string;
  unit: string;
  pricePerKg: number;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: CategoryData | null;
}

export function CategoryModal({ isOpen, onClose, initialData }: CategoryModalProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [pricePerKg, setPricePerKg] = useState('');

  const isEdit = !!initialData?.id;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setUnit(initialData.unit);
        setPricePerKg(initialData.pricePerKg.toString());
      } else {
        setName('');
        setUnit('kg');
        setPricePerKg('');
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('unit', unit);
    formData.append('pricePerKg', pricePerKg);

    let result;
    if (isEdit && initialData?.id) {
      result = await updateCategoryAction(initialData.id, formData);
    } else {
      result = await createCategoryAction(formData);
    }

    setIsPending(false);

    if (result.success) {
      onClose();
    } else {
      setError(result.message);
    }
  }

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            {isEdit ? 'Ubah Jenis Sampah' : 'Tambah Jenis Sampah'}
          </h3>
          <button className={styles.closeButton} onClick={onClose} disabled={isPending}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {error && <p className={styles.errorText}>{error}</p>}

            {isEdit && (
              <div className={styles.modalAlert}>
                <span>⚠️</span>
                <span>
                  Perubahan harga hanya berlaku untuk transaksi baru. Transaksi lama tetap
                  menggunakan harga saat transaksi tersebut dibuat.
                </span>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Nama Jenis Sampah</label>
              <input
                type="text"
                className={styles.formInput}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Kardus Bekas"
                required
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Satuan</label>
              <input
                type="text"
                className={styles.formInput}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Contoh: kg"
                required
                disabled={isPending}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Harga per Satuan (Rp)</label>
              <input
                type="number"
                className={styles.formInput}
                value={pricePerKg}
                onChange={(e) => setPricePerKg(e.target.value)}
                placeholder="Contoh: 1500"
                min="0"
                step="100"
                required
                disabled={isPending}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
