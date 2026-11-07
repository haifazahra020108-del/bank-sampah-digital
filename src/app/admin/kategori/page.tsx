import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { prisma } from '@/lib/prisma';
import { CategoryList } from './CategoryList';
import styles from './categories.module.css';

export default async function AdminKategoriPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  const categories = await prisma.wasteCategory.findMany({
    orderBy: { createdAt: 'desc' },
  });

  const serializedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    unit: cat.unit,
    pricePerKg: cat.pricePerKg,
    isActive: cat.isActive,
    updatedAt: cat.updatedAt.toISOString(),
  }));

  return (
    <DashboardLayout session={session} currentPath="/admin/kategori">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Jenis & Harga Sampah</h1>
          <p className={styles.pageSubtitle}>
            Kelola master data jenis sampah, satuan, dan harga beli per satuan.
          </p>
        </div>
      </div>

      <CategoryList categories={serializedCategories} />
    </DashboardLayout>
  );
}
