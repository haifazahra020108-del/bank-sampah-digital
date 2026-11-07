import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with development users...');

  // 1. ADMIN
  const adminPassword = await bcrypt.hash('Admin123!', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@banksampah.local' },
    update: {},
    create: {
      email: 'admin@banksampah.local',
      name: 'Admin Bank Sampah',
      password: adminPassword,
      role: 'ADMIN', // Sesuai schema Prisma
      status: 'ACTIVE',
    },
  });
  console.log(`Upserted ADMIN: ${admin.email}`);

  // 2. PENGELOLA (Role di schema: MANAGER)
  const pengelolaPassword = await bcrypt.hash('Pengelola123!', 10);
  const pengelola = await prisma.user.upsert({
    where: { email: 'pengelola@banksampah.local' },
    update: {},
    create: {
      email: 'pengelola@banksampah.local',
      name: 'Pengelola Bank Sampah',
      password: pengelolaPassword,
      role: 'MANAGER', // Sesuai schema Prisma yang menggunakan 'MANAGER' untuk pengelola
      status: 'ACTIVE',
    },
  });
  console.log(`Upserted PENGELOLA (MANAGER): ${pengelola.email}`);

  // 3. ANGGOTA (Role di schema: MEMBER)
  const anggotaPassword = await bcrypt.hash('Anggota123!', 10);
  const anggota = await prisma.user.upsert({
    where: { email: 'anggota@banksampah.local' },
    update: {},
    create: {
      email: 'anggota@banksampah.local',
      name: 'Anggota Bank Sampah',
      password: anggotaPassword,
      role: 'MEMBER', // Sesuai schema Prisma yang menggunakan 'MEMBER' untuk anggota
      status: 'ACTIVE',
    },
  });
  console.log(`Upserted ANGGOTA (MEMBER): ${anggota.email}`);

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
