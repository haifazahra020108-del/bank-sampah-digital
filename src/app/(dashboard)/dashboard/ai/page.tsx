import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { AiHubClient } from './AiHubClient';

export default async function AiAssistantPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  if (session.mustChangePassword) {
    redirect('/dashboard/ganti-password');
  }

  return (
    <DashboardLayout session={session} currentPath="/dashboard/ai">
      <AiHubClient userName={session.name} />
    </DashboardLayout>
  );
}
