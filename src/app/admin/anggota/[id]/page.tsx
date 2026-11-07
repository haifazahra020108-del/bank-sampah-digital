import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { MemberDetail } from '@/components/Member/MemberDetail';
import { getMemberDetail } from '@/services/member';
import styles from '../../admin.module.css';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminMemberDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  const { id } = await params;
  const member = await getMemberDetail(id);

  if (!member) {
    notFound();
  }

  return (
    <DashboardLayout session={session} currentPath="/admin/anggota">
      <MemberDetail member={member} backPath="/admin/anggota" />
    </DashboardLayout>
  );
}
