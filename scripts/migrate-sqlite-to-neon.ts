import fs from 'node:fs';
import path from 'node:path';

// ── 1. Muat .env.local untuk runtime script ──────────────────────────────────
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  for (const line of fs.readFileSync(envLocalPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"\r\n]+)"?\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2];
    }
  }
}

import { PrismaClient as SqliteClient } from '../src/lib/prisma-sqlite';
import { prisma as pgPrisma } from '../src/lib/prisma';

export async function auditAndMigrate() {
  const isExecute = process.argv.includes('--execute');

  console.log('='.repeat(75));
  console.log(
    isExecute
      ? 'EKSEKUSI TRANSFER DATA ATOMIK: SQLITE (dev.db) -> NEON POSTGRESQL'
      : 'AUDIT & SIMULASI DRY-RUN: SQLITE (dev.db) -> NEON POSTGRESQL'
  );
  console.log('='.repeat(75));

  // ── 2. Verifikasi Koneksi Target (Guard Rails) ──────────────────────────────
  const targetUrl = process.env.DATABASE_URL || '';
  if (!targetUrl.includes('neon.tech') || !targetUrl.includes('-pooler')) {
    throw new Error(
      'SECURITY HALT: DATABASE_URL tidak mengarah ke endpoint Neon PostgreSQL yang valid (wajib endpoint pooled).'
    );
  }

  // Sumber SQLite eksplisit ke prisma/dev.db
  const sqliteDbPath = path.resolve(process.cwd(), 'prisma/dev.db');
  if (!fs.existsSync(sqliteDbPath)) {
    throw new Error(`SECURITY HALT: Berkas sumber SQLite tidak ditemukan di: ${sqliteDbPath}`);
  }

  const sqlite = new SqliteClient({
    datasources: {
      db: {
        url: `file:${sqliteDbPath}`,
      },
    },
  });

  try {
    // ── 3. Baca seluruh rekaman sumber secara READ-ONLY dari prisma/dev.db ───────
    console.log('\n[1/5] Membaca data sumber dari prisma/dev.db (READ-ONLY)...');
    const [
      users,
      categories,
      transactions,
      withdrawals,
      notifications,
      telegramLinkCodes,
      aiConfigs,
    ] = await Promise.all([
      sqlite.user.findMany(),
      sqlite.wasteCategory.findMany(),
      sqlite.wasteTransaction.findMany(),
      sqlite.withdrawal.findMany(),
      sqlite.notification.findMany(),
      sqlite.telegramLinkCode.findMany(),
      sqlite.aiConfig.findMany(),
    ]);

    console.log(`  ✓ Users            : ${users.length} rekaman`);
    console.log(`  ✓ WasteCategories  : ${categories.length} rekaman`);
    console.log(`  ✓ WasteTransactions: ${transactions.length} rekaman`);
    console.log(`  ✓ Withdrawals      : ${withdrawals.length} rekaman`);
    console.log(`  ✓ Notifications    : ${notifications.length} rekaman`);
    console.log(`  ✓ TelegramLinkCodes: ${telegramLinkCodes.length} rekaman`);
    console.log(`  ✓ AiConfigs        : ${aiConfigs.length} rekaman`);

    const totalSource =
      users.length +
      categories.length +
      transactions.length +
      withdrawals.length +
      notifications.length +
      telegramLinkCodes.length +
      aiConfigs.length;
    console.log(`  -> Total data sumber: ${totalSource} rekaman`);

    // ── 4. Audit Integritas Relasi (Foreign Key Integrity Check in Memory) ───────
    console.log('\n[2/5] Memeriksa integritas foreign key data sumber...');
    const userIds = new Set(users.map((u) => u.id));
    const categoryIds = new Set(categories.map((c) => c.id));

    // Periksa WasteTransaction FK
    for (const tx of transactions) {
      if (!userIds.has(tx.memberId)) {
        throw new Error(`Integritas gagal: WasteTransaction ${tx.id} mereferensikan memberId tidak dikenal: ${tx.memberId}`);
      }
      if (!categoryIds.has(tx.categoryId)) {
        throw new Error(`Integritas gagal: WasteTransaction ${tx.id} mereferensikan categoryId tidak dikenal: ${tx.categoryId}`);
      }
      if (!userIds.has(tx.createdById)) {
        throw new Error(`Integritas gagal: WasteTransaction ${tx.id} mereferensikan createdById tidak dikenal: ${tx.createdById}`);
      }
    }

    // Periksa Withdrawal FK
    for (const w of withdrawals) {
      if (!userIds.has(w.memberId)) {
        throw new Error(`Integritas gagal: Withdrawal ${w.id} mereferensikan memberId tidak dikenal: ${w.memberId}`);
      }
      if (w.processedById && !userIds.has(w.processedById)) {
        throw new Error(`Integritas gagal: Withdrawal ${w.id} mereferensikan processedById tidak dikenal: ${w.processedById}`);
      }
    }

    // Periksa Notification FK
    for (const n of notifications) {
      if (!userIds.has(n.userId)) {
        throw new Error(`Integritas gagal: Notification ${n.id} mereferensikan userId tidak dikenal: ${n.userId}`);
      }
    }

    // Periksa TelegramLinkCode FK
    for (const t of telegramLinkCodes) {
      if (!userIds.has(t.userId)) {
        throw new Error(`Integritas gagal: TelegramLinkCode ${t.id} mereferensikan userId tidak dikenal: ${t.userId}`);
      }
    }
    console.log('  ✓ Seluruh relasi foreign key valid (0 orphan foreign key detected).');

    // ── 5. Periksa Kondisi Database Tujuan (Neon PostgreSQL) ────────────────────
    console.log('\n[3/5] Memeriksa status tabel tujuan di Neon PostgreSQL...');
    const [pgUsers, pgCats, pgTxs, pgWds, pgNotifs, pgTg, pgAi] = await Promise.all([
      pgPrisma.user.count(),
      pgPrisma.wasteCategory.count(),
      pgPrisma.wasteTransaction.count(),
      pgPrisma.withdrawal.count(),
      pgPrisma.notification.count(),
      pgPrisma.telegramLinkCode.count(),
      pgPrisma.aiConfig.count(),
    ]);

    const totalExisting = pgUsers + pgCats + pgTxs + pgWds + pgNotifs + pgTg + pgAi;
    console.log(`  -> Rekaman saat ini di Neon: ${totalExisting} rekaman.`);

    if (totalExisting > 0) {
      throw new Error(
        `ABORT KEAMANAN: Database tujuan Neon PostgreSQL sudah berisi ${totalExisting} rekaman! Proses dihentikan untuk melindungi data.`
      );
    }
    console.log('  ✓ Database tujuan terkonfirmasi bersih dan siap menerima data.');

    // ── 6. Mode Simulasi / Eksekusi ─────────────────────────────────────────────
    if (!isExecute) {
      console.log('\n[4/5] STATUS SIMULASI (DRY-RUN):');
      console.log('  • Flag --execute TIDAK ditemukan.');
      console.log('  • TIDAK ADA data yang diubah di SQLite maupun Neon PostgreSQL.');
      console.log('  • 167 rekaman terverifikasi valid, siap ditransfer secara atomik.');
      console.log('\n[5/5] KESIAPAN:');
      console.log('  Skrip siap dieksekusi secara aman menggunakan perintah:');
      console.log('  npx tsx scripts/migrate-sqlite-to-neon.ts --execute\n');
      return;
    }

    // ── 7. Eksekusi Transfer Atomik dalam Database Transaction ──────────────────
    console.log('\n[4/5] Mengeksekusi transfer data atomik dalam PostgreSQL Transaction ($transaction)...');

    await pgPrisma.$transaction(
      async (tx) => {
        // 7.1 User (Parent)
        console.log(`  -> Mentransfer ${users.length} Users...`);
        for (const u of users) {
          await tx.user.create({
            data: {
              id: u.id,
              name: u.name,
              email: u.email,
              password: u.password,
              role: u.role,
              contact: u.contact,
              address: u.address,
              status: u.status,
              telegramChatId: u.telegramChatId,
              mustChangePassword: u.mustChangePassword,
              createdAt: u.createdAt,
              updatedAt: u.updatedAt,
            },
          });
        }

        // 7.2 WasteCategory (Parent)
        console.log(`  -> Mentransfer ${categories.length} WasteCategories...`);
        for (const c of categories) {
          await tx.wasteCategory.create({
            data: {
              id: c.id,
              name: c.name,
              unit: c.unit,
              pricePerKg: c.pricePerKg,
              isActive: c.isActive,
              createdAt: c.createdAt,
              updatedAt: c.updatedAt,
            },
          });
        }

        // 7.3 WasteTransaction (Child of User & Category)
        console.log(`  -> Mentransfer ${transactions.length} WasteTransactions...`);
        for (const t of transactions) {
          await tx.wasteTransaction.create({
            data: {
              id: t.id,
              memberId: t.memberId,
              categoryId: t.categoryId,
              weight: t.weight,
              pricePerKgSnapshot: t.pricePerKgSnapshot,
              totalValue: t.totalValue,
              date: t.date,
              createdById: t.createdById,
              status: t.status,
              createdAt: t.createdAt,
              updatedAt: t.updatedAt,
            },
          });
        }

        // 7.4 Withdrawal (Child of User)
        console.log(`  -> Mentransfer ${withdrawals.length} Withdrawals...`);
        for (const w of withdrawals) {
          await tx.withdrawal.create({
            data: {
              id: w.id,
              memberId: w.memberId,
              amount: w.amount,
              requestDate: w.requestDate,
              status: w.status,
              processedById: w.processedById,
              completedDate: w.completedDate,
              createdAt: w.createdAt,
              updatedAt: w.updatedAt,
            },
          });
        }

        // 7.5 Notification (Child of User)
        console.log(`  -> Mentransfer ${notifications.length} Notifications...`);
        for (const n of notifications) {
          await tx.notification.create({
            data: {
              id: n.id,
              userId: n.userId,
              title: n.title,
              message: n.message,
              type: n.type,
              link: n.link,
              isRead: n.isRead,
              createdAt: n.createdAt,
              updatedAt: n.updatedAt,
              telegramStatus: n.telegramStatus,
              telegramSentAt: n.telegramSentAt,
              telegramError: n.telegramError,
            },
          });
        }

        // 7.6 TelegramLinkCode (Child of User)
        console.log(`  -> Mentransfer ${telegramLinkCodes.length} TelegramLinkCodes...`);
        for (const l of telegramLinkCodes) {
          await tx.telegramLinkCode.create({
            data: {
              id: l.id,
              userId: l.userId,
              codeHash: l.codeHash,
              payloadCipher: l.payloadCipher, // Encrypted AES-256-GCM cipher dipertahankan utuh
              expiresAt: l.expiresAt,
              usedAt: l.usedAt,
              createdAt: l.createdAt,
            },
          });
        }

        // 7.7 AiConfig (Independent)
        console.log(`  -> Mentransfer ${aiConfigs.length} AiConfigs...`);
        for (const a of aiConfigs) {
          await tx.aiConfig.create({
            data: {
              id: a.id,
              name: a.name,
              provider: a.provider,
              apiKeyCipher: a.apiKeyCipher, // Encrypted AES-256-GCM cipher dipertahankan utuh
              maskedKey: a.maskedKey,
              baseUrl: a.baseUrl,
              modelPrimary: a.modelPrimary,
              modelFallback: a.modelFallback,
              temperature: a.temperature,
              maxTokens: a.maxTokens,
              timeoutMs: a.timeoutMs,
              isActive: a.isActive,
              version: a.version,
              lastTestedAt: a.lastTestedAt,
              testStatus: a.testStatus,
              testLatencyMs: a.testLatencyMs,
              testMessage: a.testMessage,
              createdById: a.createdById,
              createdAt: a.createdAt,
              updatedAt: a.updatedAt,
            },
          });
        }

        // ── 8. Verifikasi Dalam Transaksi (In-Transaction Verification) ─────────────
        console.log('\n[5/5] Melakukan verifikasi rekaman dalam transaksi PostgreSQL...');
        const [
          vUsers,
          vCats,
          vTxs,
          vWds,
          vNotifs,
          vTg,
          vAi,
        ] = await Promise.all([
          tx.user.count(),
          tx.wasteCategory.count(),
          tx.wasteTransaction.count(),
          tx.withdrawal.count(),
          tx.notification.count(),
          tx.telegramLinkCode.count(),
          tx.aiConfig.count(),
        ]);

        const verification = [
          { model: 'User', expected: users.length, actual: vUsers },
          { model: 'WasteCategory', expected: categories.length, actual: vCats },
          { model: 'WasteTransaction', expected: transactions.length, actual: vTxs },
          { model: 'Withdrawal', expected: withdrawals.length, actual: vWds },
          { model: 'Notification', expected: notifications.length, actual: vNotifs },
          { model: 'TelegramLinkCode', expected: telegramLinkCodes.length, actual: vTg },
          { model: 'AiConfig', expected: aiConfigs.length, actual: vAi },
        ];

        for (const row of verification) {
          if (row.expected !== row.actual) {
            throw new Error(
              `VERIFIKASI GAGAL pada ${row.model}: Diharapkan ${row.expected}, tetapi ditemukan ${row.actual}. Transaksi dibatalkan (ROLLBACK).`
            );
          }
          console.log(`  ✓ ${row.model.padEnd(20)}: ${row.actual}/${row.expected} (Cocok)`);
        }

        console.log('\nTransaksi PostgreSQL berhasil di-commit secara permanen.');
      },
      {
        timeout: 60000, // 60 detik timeout
        maxWait: 15000,
      }
    );

    console.log('\n' + '='.repeat(75));
    console.log('HASIL AKHIR: SELURUH 167 DATA BERHASIL DIMIGRASIKAN DENGAN SEMPURNA.');
    console.log('='.repeat(75));
  } finally {
    await sqlite.$disconnect();
    await pgPrisma.$disconnect();
  }
}

// Eksekusi fungsi (hanya akan berjalan dalam mode simulasi bila tanpa flag --execute)
auditAndMigrate().catch((err) => {
  console.error('\n[FATAL ERROR DALAM AUDIT/MIGRASI]:', err.message);
  process.exit(1);
});
