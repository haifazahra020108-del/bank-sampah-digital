'use server';

import { getSession } from '@/utils/session';
import {
  activateAiConfig,
  listAiConfigs,
  saveAiConfig,
  type AiConfigDTO,
  type ResolvedAiConfig,
} from '@/services/ai-config';
import {
  fetchRemoteModels,
  getProviderDefinition,
  isValidProvider,
  SUPPORTED_PROVIDERS,
  testProviderConnection,
  type ConnectionTestResult,
  type ModelOption,
} from '@/services/ai-providers';
import { decryptApiKey } from '@/services/ai-crypto';
import { prisma } from '@/lib/prisma';

export interface AiConfigPageData {
  active: ResolvedAiConfig;
  allConfigs: AiConfigDTO[];
   supportedProviders: Array<{
    id: 'groq' | 'nvidia' | 'gemini';
    name: string;
    description: string;
    baseUrl: string;
    allowedBaseUrls: string[];
    defaultPrimary: string;
    defaultFallback: string | null;
    docsUrl: string;
    curatedModels: ModelOption[];
  }>;
  hasServerEncryptionKey: boolean;
}

/**
 * Validasi otorisasi server-side khusus ADMIN.
 * Menolak role MEMBER atau MANAGER secara tegas tanpa mempercayai payload client.
 */
async function requireAdminSession() {
  const session = await getSession();
  if (!session || !session.userId || session.role !== 'ADMIN') {
    throw new Error('Akses ditolak. Hanya pengguna dengan peran ADMIN yang dapat mengelola Konfigurasi AI.');
  }
  return session;
}

/**
 * Mengambil data awal untuk halaman Konfigurasi AI Admin.
 */
export async function getAiConfigDataAction(): Promise<{
  success: boolean;
  data?: AiConfigPageData;
  error?: string;
}> {
  try {
    await requireAdminSession();

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

    return {
      success: true,
      data: {
        active,
        allConfigs,
        supportedProviders: providerList,
        hasServerEncryptionKey,
      },
    };
  } catch (error) {
    console.error('[AiConfigAction] getAiConfigDataAction error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat data konfigurasi AI.',
    };
  }
}

/**
 * Menguji koneksi provider secara server-side sebelum disimpan atau diaktifkan.
 */
export async function testAiConnectionAction(params: {
  provider: string;
  apiKeyInput?: string;
  useExistingKey?: boolean;
  configId?: string;
  baseUrl?: string | null;
  modelPrimary: string;
  modelFallback?: string | null;
  timeoutMs?: number;
}): Promise<{
  success: boolean;
  result?: ConnectionTestResult;
  error?: string;
}> {
  try {
    await requireAdminSession();

    const {
      provider,
      apiKeyInput,
      useExistingKey,
      configId,
      modelPrimary,
      modelFallback,
      timeoutMs = 15000,
    } = params;

    if (!isValidProvider(provider)) {
      return { success: false, error: `Provider "${provider}" tidak didukung.` };
    }

    let resolvedKey = '';

    if (apiKeyInput && apiKeyInput.trim().length > 0) {
      resolvedKey = apiKeyInput.trim();
    } else if (useExistingKey) {
      // Ambil key terenkripsi dari record target atau konfigurasi aktif provider tersebut
      let record;
      if (configId) {
        record = await prisma.aiConfig.findUnique({ where: { id: configId } });
      }
      if (!record) {
        record = await prisma.aiConfig.findFirst({
          where: { provider, isActive: true },
        });
      }
      if (!record) {
        // Cek fallback bootstrap env jika ada
        if (provider === 'groq' && process.env.GROQ_API_KEY) {
          resolvedKey = process.env.GROQ_API_KEY;
        } else {
          return {
            success: false,
            error: 'Tidak ditemukan API Key tersimpan untuk provider ini. Masukkan API Key baru.',
          };
        }
      } else {
        resolvedKey = decryptApiKey(record.apiKeyCipher);
      }
    } else {
      return { success: false, error: 'Masukkan API Key baru atau pilih gunakan key tersimpan.' };
    }

     const result = await testProviderConnection({
       provider,
       apiKey: resolvedKey,
       modelPrimary,
       modelFallback,
       baseUrl: params.baseUrl,
       timeoutMs,
     });

    console.log(
      `[AiConfigAction] testAiConnection: provider=${provider} model=${modelPrimary} status=${result.status} latency=${result.latencyMs}ms success=${result.success}`
    );

    return {
      success: true,
      result,
    };
  } catch (error) {
    console.error('[AiConfigAction] testAiConnectionAction error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Terjadi kesalahan saat menguji koneksi.',
    };
  }
}

/**
 * Mengambil daftar model dari provider secara live (atau fallback kurasi).
 */
export async function fetchProviderModelsAction(params: {
  provider: string;
  apiKeyInput?: string;
  useExistingKey?: boolean;
  configId?: string;
}): Promise<{
  success: boolean;
  models?: ModelOption[];
  isLive?: boolean;
  error?: string;
}> {
  try {
    await requireAdminSession();

    const { provider, apiKeyInput, useExistingKey, configId } = params;

    if (!isValidProvider(provider)) {
      return { success: false, error: `Provider "${provider}" tidak didukung.` };
    }

    let resolvedKey = '';

    if (apiKeyInput && apiKeyInput.trim().length > 0) {
      resolvedKey = apiKeyInput.trim();
    } else if (useExistingKey) {
      let record;
      if (configId) {
        record = await prisma.aiConfig.findUnique({ where: { id: configId } });
      }
      if (!record) {
        record = await prisma.aiConfig.findFirst({
          where: { provider, isActive: true },
        });
      }
      if (!record) {
        if (provider === 'groq' && process.env.GROQ_API_KEY) {
          resolvedKey = process.env.GROQ_API_KEY;
        } else {
          // Kembalikan model kurasi statis jika key belum ada
          const def = getProviderDefinition(provider);
          return { success: true, models: def.curatedModels, isLive: false };
        }
      } else {
        resolvedKey = decryptApiKey(record.apiKeyCipher);
      }
    } else {
      const def = getProviderDefinition(provider);
      return { success: true, models: def.curatedModels, isLive: false };
    }

    const { models, isLive, error } = await fetchRemoteModels(provider, resolvedKey);

    return {
      success: true,
      models,
      isLive,
      error,
    };
  } catch (error) {
    console.error('[AiConfigAction] fetchProviderModelsAction error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal memuat daftar model provider.',
    };
  }
}

/**
 * Menyimpan dan/atau mengaktifkan konfigurasi AI.
 */
export async function saveAiConfigAction(params: {
  id?: string;
  name?: string;
  provider: 'groq' | 'nvidia' | 'gemini';
  rawApiKey?: string;
  useExistingKey?: boolean;
  baseUrl?: string | null;
  modelPrimary: string;
  modelFallback?: string | null;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  activateImmediately?: boolean;
}): Promise<{
  success: boolean;
  data?: AiConfigDTO;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireAdminSession();

    const saved = await saveAiConfig({
      ...params,
      adminUserId: session.userId,
    });

    const actionType = params.activateImmediately ? 'disimpan dan langsung diaktifkan' : 'disimpan sebagai draft';

    console.log(
      `[AiConfigAudit] Admin "${session.name}" (${session.userId}) ${actionType} konfigurasi AI provider=${params.provider} model=${params.modelPrimary}`
    );

    return {
      success: true,
      data: saved,
      message: `Konfigurasi AI berhasil ${actionType}.`,
    };
  } catch (error) {
    console.error('[AiConfigAction] saveAiConfigAction error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi AI.',
    };
  }
}

/**
 * Mengaktifkan konfigurasi AI yang tersimpan.
 */
export async function activateAiConfigAction(configId: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const session = await requireAdminSession();

    await activateAiConfig(configId);

    console.log(`[AiConfigAudit] Admin "${session.name}" (${session.userId}) mengaktifkan konfigurasi id=${configId}`);

    return {
      success: true,
      message: 'Konfigurasi AI berhasil diaktifkan tanpa restart server.',
    };
  } catch (error) {
    console.error('[AiConfigAction] activateAiConfigAction error:', error instanceof Error ? error.message : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal mengaktifkan konfigurasi AI.',
    };
  }
}
