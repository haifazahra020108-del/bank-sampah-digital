import React from 'react';
import { redirect } from 'next/navigation';

import { getSession } from '@/utils/session';
import { prisma } from '@/lib/prisma';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import ProfilClient from './ProfilClient';

export default async function ProfilPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, role: true },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardLayout session={session} currentPath="/profil">
      <ProfilClient
        initialName={user.name}
        initialEmail={user.email}
        role={user.role}
      />
    </DashboardLayout>
  );
}
