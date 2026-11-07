import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { MemberDetail } from '@/components/Member/MemberDetail';
import { getMemberDetail } from '@/services/member';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PengelolaMemberDetailPage({ params }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== 'MANAGER' && session.role !== 'ADMIN')) {
    redirect('/forbidden');
  }

  const { id } = await params;
  const member = await getMemberDetail(id);

  if (!member) {
    notFound();
  }

  return (
    <DashboardLayout session={session} currentPath="/pengelola/anggota">
      <MemberDetail member={member} backPath="/pengelola/anggota" />
    </DashboardLayout>
  );
}
