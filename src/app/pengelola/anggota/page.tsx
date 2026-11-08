import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { MemberList } from '@/components/Member/MemberList';
import { getMembersList } from '@/services/member';
import styles from '../pengelola.module.css';

interface PageProps {
  searchParams: Promise<{ search?: string }>;
}

export default async function PengelolaAnggotaPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== 'MANAGER' && session.role !== 'ADMIN')) {
    redirect('/forbidden');
  }

  const { search } = await searchParams;

  let members: Awaited<ReturnType<typeof getMembersList>> = [];
  let error = false;
  try {
    members = await getMembersList(search);
  } catch {
    error = true;
  }

  return (
    <DashboardLayout session={session} currentPath="/pengelola/anggota">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Daftar Anggota</h1>
          <p className={styles.pageSubtitle}>
            {members.length} anggota terdaftar
            {search ? ` · pencarian: "${search}"` : ''}
          </p>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger)',
            padding: '1rem 1.25rem',
            borderRadius: '0.75rem',
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
          }}
        >
          ⚠️ Gagal memuat data anggota. Coba muat ulang halaman.
        </div>
      )}

      {/* Pengelola is read-only; isAdmin=false hides add/edit/toggle buttons */}
      <MemberList members={members} isAdmin={false} basePath="/pengelola/anggota" />
    </DashboardLayout>
  );
}
