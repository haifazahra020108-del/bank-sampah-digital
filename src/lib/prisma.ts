import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  const cached = globalForPrisma.prisma;
  // Jika instance yang di-cache di globalThis belum memiliki model notification,
  // maka instance tersebut adalah instance usang sebelum migrasi dan harus diperbarui.
  if (cached && 'notification' in cached) {
    return cached;
  }

  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = getPrismaClient();
