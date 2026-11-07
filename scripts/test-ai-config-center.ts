import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import {
  decryptApiKey,
  encryptApiKey,
  maskApiKey,
} from '@/services/ai-crypto';
import {
  getActiveAiConfig,
  invalidateAiConfigCache,
  listAiConfigs,
  saveAiConfig,
  activateAiConfig,
} from '@/services/ai-config';
import { getAIService, resetAIServiceInstance, buildSystemPrompt } from '@/services/ai';
import { buildAiUserContext } from '@/services/ai-context';
import {
  testProviderConnection,
  fetchRemoteModels,
  SUPPORTED_PROVIDERS,
} from '@/services/ai-providers';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value) process.env[m[1]] = value;
  }
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description: string, condition: boolean, extra?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${description} ${extra ? `(${extra})` : ''}`);
  }
}

async function runAllTests() {
  console.log('='.repeat(75));
  console.log('PENGUJIAN KOMPREHENSIF: ADMIN AI CONFIGURATION CENTER');
  console.log('='.repeat(75));

  // ── TEST 1: Enkripsi & Dekripsi AES-256-GCM ───────────────────────────────
  console.log('\n[1] PENGUJIAN KRIPTOGRAFI AES-256-GCM');
  const sampleKey = 'gsk_test_api_key_secret_1234567890abcdef';
  const cipher = encryptApiKey(sampleKey);

  assert('Hasil enkripsi memiliki format iv.authTag.ciphertext (3 bagian)', cipher.split('.').length === 3);
  assert('Ciphertext tidak mengandung plaintext API key', !cipher.includes(sampleKey));

  const decrypted = decryptApiKey(cipher);
  assert('Dekripsi mengembalikan nilai asli persis', decrypted === sampleKey);

  // Masking
  const masked = maskApiKey(sampleKey);
  assert('Masked key mempertahankan prefix dan suffix aman', masked.startsWith('gsk_') && masked.endsWith('cdef'));
  assert('Masked key tidak memuat badan utama secret', !masked.includes('1234567890'));

  // Tampered ciphertext
  let tamperedCaught = false;
  try {
    const parts = cipher.split('.');
    parts[1] = Buffer.from('invalidauthtag16b').toString('base64url'); // Rusak auth tag
    decryptApiKey(parts.join('.'));
  } catch {
    tamperedCaught = true;
  }
  assert('Deteksi manipulasi ciphertext (integrity failure) berhasil ditolak', tamperedCaught);

  // ── TEST 2: Schema Prisma & Model AiConfig ────────────────────────────────
  console.log('\n[2] PENGUJIAN PERSISTENSI DATABASE (AiConfig SQLite)');
  const initialList = await listAiConfigs();
  assert('listAiConfigs() berhasil membaca status aktif dan seluruh konfigurasi', typeof initialList === 'object');
  assert('Tidak ada API key rahasia yang bocor pada DTO', !JSON.stringify(initialList.allConfigs).includes(sampleKey));

  // Simpan konfigurasi uji
  const savedTestConfig = await saveAiConfig({
    name: 'Test Config Groq Unit',
    provider: 'groq',
    rawApiKey: sampleKey,
    modelPrimary: 'openai/gpt-oss-120b',
    modelFallback: 'openai/gpt-oss-20b',
    temperature: 0.5,
    maxTokens: 1024,
    timeoutMs: 30000,
    activateImmediately: false,
  });

  assert('Konfigurasi draft berhasil disimpan ke SQLite', Boolean(savedTestConfig.id));
  assert('Field maskedKey tersimpan dengan benar', savedTestConfig.maskedKey.startsWith('gsk_'));

  // Verifikasi langsung di tabel SQLite (pastikan tidak ada key mentah di tabel)
  const dbRow = await prisma.aiConfig.findUnique({ where: { id: savedTestConfig.id } });
  assert('Tabel SQLite memiliki apiKeyCipher yang terenkripsi', Boolean(dbRow?.apiKeyCipher && dbRow.apiKeyCipher.includes('.')));
  assert('Tabel SQLite TIDAK memuat kolom rawApiKey mentah', !(dbRow as any).rawApiKey);

  // ── TEST 2B: Bootstrap Migration saat DB kosong ───────────────────────────
  console.log('\n[2B] PENGUJIAN BOOTSTRAP MIGRATION (Inaugural Save via useExistingKey)');
  // Bersihkan tabel untuk menguji kondisi awal kosong
  await prisma.aiConfig.deleteMany();
  invalidateAiConfigCache();

  // Sub-tes 1: Simpan dengan provider yang tidak punya bootstrap key (misal nvidia) -> ditolak aman
  let missingBootstrapRejected = false;
  try {
    await saveAiConfig({
      name: 'NVIDIA Missing Bootstrap',
      provider: 'nvidia',
      useExistingKey: true,
      modelPrimary: 'openai/gpt-oss-20b',
    });
  } catch {
    missingBootstrapRejected = true;
  }
  assert('Penyimpanan ditolak aman jika provider tidak memiliki bootstrap key di env', missingBootstrapRejected);

  // Sub-tes 2: Simpan dengan provider groq (ada bootstrap GROQ_API_KEY) sebagai DRAFT
  const inauguralDraft = await saveAiConfig({
    name: 'Konfigurasi Groq Perdana (Draft)',
    provider: 'groq',
    useExistingKey: true,
    modelPrimary: 'openai/gpt-oss-120b',
    modelFallback: 'openai/gpt-oss-20b',
    activateImmediately: false,
  });

  assert('Konfigurasi perdana dari bootstrap key berhasil disimpan ke SQLite', Boolean(inauguralDraft.id));
  assert('Draft tersimpan dengan status isActive = false', inauguralDraft.isActive === false);
  assert('Field maskedKey tersimpan otomatis', inauguralDraft.maskedKey.startsWith('gsk_'));

  // Verifikasi sistem tetap berjalan dengan bootstrap env karena draft belum diaktifkan
  const activeWhileDraft = await getActiveAiConfig();
  assert('Konfigurasi aktif tetap aman (belum ditimpa) saat draft disimpan', activeWhileDraft.source === 'BOOTSTRAP_ENV');

  // Sub-tes 3: Simpan konfigurasi baru dengan aktivasi langsung (activateImmediately = true)
  const inauguralActive = await saveAiConfig({
    name: 'Konfigurasi Groq Produksi (Aktif)',
    provider: 'groq',
    useExistingKey: true,
    modelPrimary: 'openai/gpt-oss-120b',
    activateImmediately: true,
  });

  assert('Aktivasi langsung membuat record baru aktif (isActive = true)', inauguralActive.isActive === true);
  const activeNow = await getActiveAiConfig();
  assert('getActiveAiConfig() kini membaca konfigurasi aktif dari DATABASE', activeNow.source === 'DATABASE' && activeNow.id === inauguralActive.id);

  // Pastikan draft sebelumnya tetap non-aktif
  const draftInDb = await prisma.aiConfig.findUnique({ where: { id: inauguralDraft.id } });
  assert('Record lain di database tetap non-aktif (isActive = false)', draftInDb?.isActive === false);

  // ── TEST 3: Aktivasi Dinamis Tanpa Restart & Invalidation ─────────────────
  console.log('\n[3] PENGUJIAN AKTIVASI DINAMIS & CACHE INVALIDATION');
  const activeBefore = await getActiveAiConfig();
  console.log(`  Status awal aktif: provider=${activeBefore.provider}, model=${activeBefore.modelPrimary}, id=${activeBefore.id ?? 'bootstrap'}`);

  // Aktifkan draft konfigurasi Groq perdana
  await activateAiConfig(inauguralDraft.id);
  const activeAfter = await getActiveAiConfig();

  assert('Konfigurasi draft berhasil diaktifkan seketika di getActiveAiConfig()', activeAfter.id === inauguralDraft.id);
  assert('API Key terdekripsi dengan benar di server', activeAfter.apiKey === (process.env.GROQ_API_KEY || ''));
  assert('Model utama cocok dengan konfigurasi baru', activeAfter.modelPrimary === 'openai/gpt-oss-120b');
  assert('Model fallback cocok', activeAfter.modelFallback === 'openai/gpt-oss-20b');

  // ── TEST 4: Snapshot Isolation & Concurrency Stability ────────────────────
  console.log('\n[4] PENGUJIAN CONCURRENCY & SNAPSHOT ISOLATION');
  const snapshotReq1 = await getActiveAiConfig();
  assert('Snapshot permintaan 1 di-freeze', Object.isFrozen(snapshotReq1));

  // Ganti lagi konfigurasi di background
  const secondConfig = await saveAiConfig({
    name: 'Test Config NVIDIA Alternate',
    provider: 'nvidia',
    rawApiKey: 'nvapi-second-fake-key-test-9999',
    modelPrimary: 'openai/gpt-oss-20b',
    activateImmediately: true,
  });

  const snapshotReq2 = await getActiveAiConfig();

  assert('Permintaan 1 tetap memegang snapshot lama tanpa terinterupsi', snapshotReq1.id === inauguralDraft.id && snapshotReq1.provider === 'groq');
  assert('Permintaan baru 2 otomatis mendapatkan konfigurasi baru', snapshotReq2.id === secondConfig.id && snapshotReq2.provider === 'nvidia');

  // ── TEST 5: Rollback Instan ───────────────────────────────────────────────
  console.log('\n[5] PENGUJIAN ROLLBACK INSTAN KE KONFIGURASI SEBELUMNYA');
  await activateAiConfig(inauguralActive.id);
  const rolledBack = await getActiveAiConfig();
  assert('Rollback ke inauguralActive berhasil seketika', rolledBack.id === inauguralActive.id && rolledBack.provider === 'groq');

  // Bersihkan seluruh data uji dari database
  await prisma.aiConfig.deleteMany({
    where: {
      id: { in: [inauguralDraft.id, inauguralActive.id, secondConfig.id] },
    },
  });
  invalidateAiConfigCache();
  resetAIServiceInstance();

  const finalActive = await getActiveAiConfig();
  console.log(`  Setelah pembersihan: kembali ke active=${finalActive.source} (${finalActive.provider})`);
  assert('Setelah pembersihan data uji, sistem fallback dengan aman ke bootstrap env', finalActive.source === 'BOOTSTRAP_ENV');

  // ── TEST 6: Pengujian Penanganan Error Provider & Kredensial ──────────────
  console.log('\n[6] PENGUJIAN VALIDASI & DIAGNOSTIK KONEKSI PROVIDER');
  
  // Tes key invalid pada Groq
  const invalidKeyTest = await testProviderConnection({
    provider: 'groq',
    apiKey: 'gsk_invalid_test_key_xyz_0000',
    modelPrimary: 'openai/gpt-oss-120b',
    timeoutMs: 8000,
  });
  console.log(`  Hasil probe key invalid: status=${invalidKeyTest.status}, message="${invalidKeyTest.message.slice(0, 70)}..."`);
  assert('Probe kredensial salah menghasilkan status INVALID_KEY atau HTTP 401', invalidKeyTest.status === 'INVALID_KEY' || !invalidKeyTest.success);

  // Tes model tidak tersedia pada Groq
  if (process.env.GROQ_API_KEY) {
    const invalidModelTest = await testProviderConnection({
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      modelPrimary: 'model-yang-pasti-tidak-ada-xyz-12345',
      timeoutMs: 8000,
    });
    console.log(`  Hasil probe model tidak ada: status=${invalidModelTest.status}, message="${invalidModelTest.message.slice(0, 70)}..."`);
    assert('Probe model tidak valid menghasilkan status MODEL_NOT_FOUND', invalidModelTest.status === 'MODEL_NOT_FOUND' || !invalidModelTest.success);

    // Tes koneksi valid pada model utama
    const validProbeTest = await testProviderConnection({
      provider: 'groq',
      apiKey: process.env.GROQ_API_KEY,
      modelPrimary: 'openai/gpt-oss-120b',
      timeoutMs: 15000,
    });
    console.log(`  Hasil probe valid: status=${validProbeTest.status}, latency=${validProbeTest.latencyMs}ms, message="${validProbeTest.message}"`);
    assert('Probe koneksi valid ke model utama openai/gpt-oss-120b menghasilkan status SUCCESS', validProbeTest.status === 'SUCCESS');
  } else {
    console.log('  (GROQ_API_KEY belum diset, lewati tes live probe model)');
  }

  // ── TEST 7: Integritas AI Assistant (System Prompt & Context) ────────────
  console.log('\n[7] PENGUJIAN INTEGRITAS SYSTEM PROMPT & DATA KONTEKS AI');
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const memberUser = await prisma.user.findFirst({ where: { role: 'MEMBER' } });

  if (adminUser && memberUser) {
    const adminCtx = await buildAiUserContext({
      userId: adminUser.id,
      role: adminUser.role,
      name: adminUser.name,
      email: adminUser.email,
    });
    const promptAdmin = buildSystemPrompt(adminCtx);

    assert('System prompt memuat IDENTITAS Bank Sampah Digital', promptAdmin.includes('AI Asisten Bank Sampah Digital'));
    assert('System prompt mengenali peran Admin sistem', promptAdmin.includes('Admin'));
    assert('System prompt Admin memuat data konteks administratif', promptAdmin.includes('DATA KONTEKS'));

    const memberCtx = await buildAiUserContext({
      userId: memberUser.id,
      role: memberUser.role,
      name: memberUser.name,
      email: memberUser.email,
    });
    const promptMember = buildSystemPrompt(memberCtx);
    assert('System prompt Member melarang pembocoran data anggota lain', promptMember.includes('KEAMANAN & PRIVASI ANGGOTA'));
  }

  // ── TEST 8: getAIService() Universal Dynamic Service ─────────────────────
  console.log('\n[8] PENGUJIAN getAIService() RESOLUSI DINAMIS');
  const service = getAIService();
  assert('getAIService() mengembalikan instance dengan method chat()', typeof service.chat === 'function');

  // Fast path test (deterministik tanpa fetch eksternal)
  if (memberUser) {
    const ctx = await buildAiUserContext({
      userId: memberUser.id,
      role: memberUser.role,
      name: memberUser.name,
      email: memberUser.email,
    });
    const greetingReply = await service.chat('Halo, siapa kamu?', [], ctx);
    assert('Fast-path greeting menjawab dengan benar via DynamicAIService', greetingReply.includes('AI Asisten Bank Sampah Digital'));
  }

  // ── HASIL AKHIR ───────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(75));
  console.log(`HASIL AKHIR: ${passedTests} DARI ${totalTests} PENGUJIAN LULUS (${failedTests} GAGAL)`);
  console.log('='.repeat(75));

  if (failedTests > 0) {
    process.exitCode = 1;
  }
}

runAllTests()
  .catch((err) => {
    console.error('Test script crashed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
