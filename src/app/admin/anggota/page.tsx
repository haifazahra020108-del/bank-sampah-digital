import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { MemberList } from '@/components/Member/MemberList';
import { getMembersList } from '@/services/member';
import styles from '../admin.module.css';

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function AdminAnggotaPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  const { search } = await searchParams;

  let members: Awaited<ReturnType<typeof getMembersList>> = [];
  let error = false;
  try {
    members = await getMembersList(search);
  } catch (e) {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/admin/anggota">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Manajemen Anggota</h1>
          <p className={styles.pageSubtitle}>
            {members.length} anggota terdaftar
            {search ? ` · pencarian: "${search}"` : ''}
          </p>
        </div>
      </div>

      {error && (
        <div className={styles.errorAlert}>
          ⚠️ Gagal memuat data anggota. Coba muat ulang halaman.
        </div>
      )}

      <MemberList members={members} isAdmin={true} basePath="/admin/anggota" />
    </DashboardLayout>
  );
}
