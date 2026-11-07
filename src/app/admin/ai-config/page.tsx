import React from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/utils/session';
import { DashboardLayout } from '@/components/DashboardLayout/DashboardLayout';
import { listAiConfigs } from '@/services/ai-config';
import { SUPPORTED_PROVIDERS } from '@/services/ai-providers';
import { AiConfigClient } from './AiConfigClient';
import styles from './ai-config.module.css';

export default async function AdminAiConfigPage() {
  const session = await getSession();
  if (!session || session.role !== 'ADMIN') {
    redirect('/forbidden');
  }

  const { active, allConfigs } = await listAiConfigs();

  const hasServerEncryptionKey = Boolean(
    process.env.AI_CONFIG_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET
  );

  const providerList = Object.values(SUPPORTED_PROVIDERS).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    baseUrl: p.baseUrl,
    allowedBaseUrls: p.allowedBaseUrls,
    defaultPrimary: p.defaultPrimary,
    defaultFallback: p.defaultFallback ?? null,
    docsUrl: p.docsUrl,
    curatedModels: p.curatedModels,
  }));

  const initialData = {
    active,
    allConfigs,
    supportedProviders: providerList,
    hasServerEncryptionKey,
  };

  return (
    <DashboardLayout session={session} currentPath="/admin/ai-config">
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Konfigurasi AI Provider</h1>
          <p className={styles.pageSubtitle}>
            Pusat kendali provider AI, model kecerdasan buatan, dan kredensial API Bank Sampah Digital.
          </p>
        </div>
      </div>

      <AiConfigClient initialData={initialData} />
    </DashboardLayout>
  );
}
