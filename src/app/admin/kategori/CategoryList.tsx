'use client';

import React, { useState } from 'react';
import styles from './categories.module.css';
import { Button } from '@/components/Button/Button';
import { CategoryModal, CategoryData } from './CategoryModal';
import { toggleCategoryStatusAction } from '@/app/actions/category';

interface CategoryListProps {
  categories: {
    id: string;
    name: string;
    unit: string;
    pricePerKg: number;
    isActive: boolean;
    updatedAt: string;
  }[];
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

export function CategoryList({ categories }: CategoryListProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryData | null>(null);

  function handleAdd() {
    setEditingCategory(null);
    setIsModalOpen(true);
  }

  function handleEdit(cat: CategoryData) {
    setEditingCategory(cat);
    setIsModalOpen(true);
  }

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    const confirmMessage = currentStatus
      ? 'Nonaktifkan kategori ini? Kategori tidak akan bisa digunakan untuk transaksi baru.'
      : 'Aktifkan kembali kategori ini?';
    
    if (confirm(confirmMessage)) {
      await toggleCategoryStatusAction(id, currentStatus);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.tableWrapper}>
        <div style={{ padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid var(--border)' }}>
          <Button variant="primary" onClick={handleAdd}>
            + Tambah Jenis Sampah
          </Button>
        </div>
        
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama Jenis</th>
              <th>Harga</th>
              <th>Satuan</th>
              <th>Status</th>
              <th>Tgl Ubah</th>
              <th style={{ textAlign: 'right' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-muted)' }}>
                  Belum ada data jenis sampah.
                </td>
              </tr>
            ) : (
              categories.map((cat) => (
                <tr key={cat.id} className={!cat.isActive ? styles.inactive : ''}>
                  <td className={styles.boldCell}>{cat.name}</td>
                  <td className={styles.priceCell}>{formatCurrency(cat.pricePerKg)}</td>
                  <td>{cat.unit}</td>
                  <td>
                    <span className={`${styles.badge} ${cat.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                      {cat.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className={styles.dateCell}>{formatDate(cat.updatedAt)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" onClick={() => handleEdit(cat)}>
                        Edit
                      </Button>
                      <Button
                        variant={cat.isActive ? 'danger' : 'primary'}
                        onClick={() => handleToggleStatus(cat.id, cat.isActive)}
                      >
                        {cat.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        initialData={editingCategory}
      />
    </div>
  );
}
