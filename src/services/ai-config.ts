import { prisma } from '@/lib/prisma';
import { decryptApiKey, encryptApiKey, maskApiKey } from './ai-crypto';
import { getProviderDefinition, isValidProvider, testProviderConnection, normalizeAndValidateBaseUrl } from './ai-providers';

export interface ResolvedAiConfig {
  id: string | null;
  name: string;
  provider: 'groq' | 'nvidia' | 'gemini';
  apiKey: string;
  maskedKey: string;
  baseUrl: string;
  modelPrimary: string;
  modelFallback: string | null;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  isActive: boolean;
  version: number;
  isBootstrap: boolean;
  source: 'DATABASE' | 'BOOTSTRAP_ENV';
}

export interface AiConfigDTO {
  id: string;
  name: string;
  provider: string;
  maskedKey: string;
  baseUrl: string;
  modelPrimary: string;
  modelFallback: string | null;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  isActive: boolean;
  version: number;
  lastTestedAt: string | null;
  testStatus: string | null;
  testLatencyMs: number | null;
  testMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

// In-memory cache untuk konfigurasi aktif
let cachedActiveConfig: { config: ResolvedAiConfig; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000; // 60 detik (akan di-invalidasi seketika saat ada perubahan)

/**
 * Invalidasi cache konfigurasi aktif secara langsung di memori.
 * Dipanggil saat ADMIN mengaktifkan atau memperbarui konfigurasi.
 */
export function invalidateAiConfigCache(): void {
  cachedActiveConfig = null;
  console.log('[AiConfigService] In-memory active configuration cache invalidated.');
}

/**
 * Mendapatkan konfigurasi AI aktif saat ini.
 * Urutan prioritas:
 * 1. Konfigurasi aktif dari tabel database (AiConfig where isActive = true).
 * 2. Jika belum ada konfigurasi database yang aktif: fallback aman ke Bootstrap Environment (GROQ_API_KEY).
 *
 * Mengembalikan objek snapshot yang aman dan immutable untuk permintaan yang sedang berjalan.
 */
export async function getActiveAiConfig(): Promise<ResolvedAiConfig> {
  const now = Date.now();
  if (cachedActiveConfig && now - cachedActiveConfig.timestamp < CACHE_TTL_MS) {
    return cachedActiveConfig.config;
  }

  // Cari konfigurasi aktif di database
  try {
    const dbConfig = await prisma.aiConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (dbConfig) {
      if (!isValidProvider(dbConfig.provider)) {
        console.warn(`[AiConfigService] Provider "${dbConfig.provider}" di database tidak valid. Fallback ke bootstrap.`);
      } else {
        try {
          const decryptedKey = decryptApiKey(dbConfig.apiKeyCipher);
          const resolved: ResolvedAiConfig = {
            id: dbConfig.id,
            name: dbConfig.name,
            provider: dbConfig.provider,
             apiKey: decryptedKey,
             maskedKey: dbConfig.maskedKey,
             baseUrl: normalizeAndValidateBaseUrl(dbConfig.provider, dbConfig.baseUrl),
             modelPrimary: dbConfig.modelPrimary,
            modelFallback: dbConfig.modelFallback,
            temperature: dbConfig.temperature,
            maxTokens: dbConfig.maxTokens,
            timeoutMs: dbConfig.timeoutMs,
            isActive: true,
            version: dbConfig.version,
            isBootstrap: false,
            source: 'DATABASE',
          };

          cachedActiveConfig = { config: Object.freeze(resolved), timestamp: now };
          return cachedActiveConfig.config;
        } catch (decryptErr) {
          console.error('[AiConfigService] Gagal mendekripsi API key dari database:', decryptErr);
          // Jika gagal didekripsi (misal secret berubah), lanjutkan ke bootstrap fallback
        }
      }
    }
  } catch (dbErr) {
    console.error('[AiConfigService] Gagal membaca AiConfig dari database:', dbErr);
  }

  // Fallback Bootstrap Environment (GROQ_API_KEY dari .env.local)
  const envGroqKey = process.env.GROQ_API_KEY || '';
  const groqDef = getProviderDefinition('groq');

  const bootstrapConfig: ResolvedAiConfig = {
    id: null,
    name: 'Bootstrap Environment',
    provider: 'groq',
     apiKey: envGroqKey,
     maskedKey: envGroqKey ? maskApiKey(envGroqKey) : '',
     baseUrl: groqDef.baseUrl,
     modelPrimary: groqDef.defaultPrimary,
    modelFallback: groqDef.defaultFallback ?? null,
    temperature: 0.7,
    maxTokens: 2048,
    timeoutMs: 45000,
    isActive: true,
    version: 0,
    isBootstrap: true,
    source: 'BOOTSTRAP_ENV',
  };

  cachedActiveConfig = { config: Object.freeze(bootstrapConfig), timestamp: now };
  return cachedActiveConfig.config;
}

/**
 * Mengambil daftar konfigurasi untuk ditampilkan di UI Admin (tanpa API key rahasia).
 */
export async function listAiConfigs(): Promise<{
  active: ResolvedAiConfig;
  allConfigs: AiConfigDTO[];
}> {
  const active = await getActiveAiConfig();

  const configs = await prisma.aiConfig.findMany({
    orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
  });

  const allConfigs: AiConfigDTO[] = configs.map((c) => ({
    id: c.id,
    name: c.name,
    provider: c.provider,
    maskedKey: c.maskedKey,
    baseUrl: normalizeAndValidateBaseUrl(c.provider, c.baseUrl),
    modelPrimary: c.modelPrimary,
    modelFallback: c.modelFallback,
    temperature: c.temperature,
    maxTokens: c.maxTokens,
    timeoutMs: c.timeoutMs,
    isActive: c.isActive,
    version: c.version,
    lastTestedAt: c.lastTestedAt ? c.lastTestedAt.toISOString() : null,
    testStatus: c.testStatus,
    testLatencyMs: c.testLatencyMs,
    testMessage: c.testMessage,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }));

  return { active, allConfigs };
}

/**
 * Menyimpan konfigurasi baru atau memperbarui konfigurasi yang ada.
 * Mendukung opsi aktivasi langsung secara atomik.
 */
export async function saveAiConfig(params: {
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
  adminUserId?: string;
}): Promise<AiConfigDTO> {
  const {
    id,
    name = 'Konfigurasi AI',
    provider,
     rawApiKey,
     useExistingKey,
     baseUrl,
     modelPrimary,
    modelFallback,
    temperature = 0.7,
    maxTokens = 2048,
    timeoutMs = 45000,
    activateImmediately = true,
    adminUserId,
  } = params;

  if (!isValidProvider(provider)) {
    throw new Error(`Provider "${provider}" tidak didukung.`);
  }

  if (!modelPrimary || modelPrimary.trim().length === 0) {
    throw new Error('Model utama (Primary Model) wajib dipilih.');
  }

  const normalizedBaseUrl = normalizeAndValidateBaseUrl(provider, baseUrl);

  let apiKeyCipher: string;
  let maskedKey: string;

  if (rawApiKey && rawApiKey.trim().length > 0) {
    // Validasi & enkripsi key baru
    apiKeyCipher = encryptApiKey(rawApiKey.trim());
    maskedKey = maskApiKey(rawApiKey.trim());
  } else if (useExistingKey) {
    // 1. Cek apakah ada record di database untuk id atau provider
    let existingRecord;
    if (id) {
      existingRecord = await prisma.aiConfig.findUnique({ where: { id } });
    }
    if (!existingRecord) {
      existingRecord = await prisma.aiConfig.findFirst({
        where: { provider, isActive: true },
      });
    }

    if (existingRecord) {
      apiKeyCipher = existingRecord.apiKeyCipher;
      maskedKey = existingRecord.maskedKey;
    } else {
      // 2. Bootstrap migration: jika belum ada record tersimpan di database,
      // periksa apakah provider yang dipilih memiliki API key bootstrap dari environment.
      let bootstrapKey = '';
      if (provider === 'groq' && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 0) {
        bootstrapKey = process.env.GROQ_API_KEY.trim();
      }

      if (!bootstrapKey) {
        throw new Error(
          'Tidak ditemukan API key tersimpan di database maupun konfigurasi environment untuk provider ini. ' +
          'Silakan masukkan API key baru.'
        );
      }

      // Enkripsi bootstrap key menggunakan AES-256-GCM yang sudah ada sebelum disimpan ke SQLite
      apiKeyCipher = encryptApiKey(bootstrapKey);
      maskedKey = maskApiKey(bootstrapKey);
    }
  } else {
    throw new Error('API Key wajib diisi untuk konfigurasi baru.');
  }

  // Pengujian koneksi sebelum penyimpanan permanen jika aktivasi langsung
  const testKey = rawApiKey?.trim() || decryptApiKey(apiKeyCipher);
  const testResult = await testProviderConnection({
    provider,
    apiKey: testKey,
    modelPrimary,
    modelFallback,
    timeoutMs: Math.min(timeoutMs, 15000),
  });

  const now = new Date();

  // Jalankan penyimpanan dalam transaksi Prisma
  const saved = await prisma.$transaction(async (tx) => {
    let resultRecord;

    if (id) {
      resultRecord = await tx.aiConfig.update({
        where: { id },
        data: {
           name,
           provider,
           apiKeyCipher,
           maskedKey,
           baseUrl: normalizedBaseUrl,
           modelPrimary,
          modelFallback: modelFallback || null,
          temperature,
          maxTokens,
          timeoutMs,
          isActive: activateImmediately,
          version: { increment: 1 },
          lastTestedAt: now,
          testStatus: testResult.status,
          testLatencyMs: testResult.latencyMs,
          testMessage: testResult.message,
          createdById: adminUserId ?? null,
        },
      });
    } else {
      resultRecord = await tx.aiConfig.create({
        data: {
           name,
           provider,
           apiKeyCipher,
           maskedKey,
           baseUrl: normalizedBaseUrl,
           modelPrimary,
          modelFallback: modelFallback || null,
          temperature,
          maxTokens,
          timeoutMs,
          isActive: activateImmediately,
          version: 1,
          lastTestedAt: now,
          testStatus: testResult.status,
          testLatencyMs: testResult.latencyMs,
          testMessage: testResult.message,
          createdById: adminUserId ?? null,
        },
      });
    }

    // Jika diaktifkan langsung, non-aktifkan konfigurasi lain HANYA setelah baris baru berhasil disimpan
    if (activateImmediately) {
      await tx.aiConfig.updateMany({
        where: {
          id: { not: resultRecord.id },
          isActive: true,
        },
        data: { isActive: false },
      });
    }

    return resultRecord;
  });

  // Jika diaktifkan, invalidasi cache segera agar request berikutnya langsung memakai konfigurasi baru
  if (activateImmediately) {
    invalidateAiConfigCache();
  }

  return {
    id: saved.id,
    name: saved.name,
    provider: saved.provider,
     maskedKey: saved.maskedKey,
     baseUrl: normalizeAndValidateBaseUrl(saved.provider, saved.baseUrl),
     modelPrimary: saved.modelPrimary,
    modelFallback: saved.modelFallback,
    temperature: saved.temperature,
    maxTokens: saved.maxTokens,
    timeoutMs: saved.timeoutMs,
    isActive: saved.isActive,
    version: saved.version,
    lastTestedAt: saved.lastTestedAt ? saved.lastTestedAt.toISOString() : null,
    testStatus: saved.testStatus,
    testLatencyMs: saved.testLatencyMs,
    testMessage: saved.testMessage,
    createdAt: saved.createdAt.toISOString(),
    updatedAt: saved.updatedAt.toISOString(),
  };
}

/**
 * Mengaktifkan konfigurasi AI yang sudah tersimpan secara atomik.
 */
export async function activateAiConfig(configId: string): Promise<void> {
  const target = await prisma.aiConfig.findUnique({ where: { id: configId } });
  if (!target) {
    throw new Error('Konfigurasi AI tidak ditemukan.');
  }

  await prisma.$transaction(async (tx) => {
    // Aktifkan konfigurasi target terlebih dahulu
    await tx.aiConfig.update({
      where: { id: configId },
      data: { isActive: true },
    });
    // Baru kemudian non-aktifkan konfigurasi yang lain
    await tx.aiConfig.updateMany({
      where: {
        id: { not: configId },
        isActive: true,
      },
      data: { isActive: false },
    });
  });

  invalidateAiConfigCache();
}

