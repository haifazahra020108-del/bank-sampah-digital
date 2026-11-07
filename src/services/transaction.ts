import { prisma } from '@/lib/prisma';

/** Daftar anggota ACTIVE untuk dropdown pilih anggota */
export async function getActiveMembers() {
  return prisma.user.findMany({
    where: { role: 'MEMBER', status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true, contact: true },
  });
}

/** Daftar kategori aktif untuk dropdown pilih jenis sampah */
export async function getActiveCategories() {
  return prisma.wasteCategory.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, pricePerKg: true, unit: true },
  });
}

/** Riwayat transaksi per anggota — untuk halaman riwayat */
export async function getMemberTransactions(memberId: string) {
  return prisma.wasteTransaction.findMany({
    where: { memberId, status: 'COMPLETED' },
    orderBy: { date: 'asc' },
    include: {
      category: { select: { name: true, unit: true } },
      createdBy: { select: { name: true } },
    },
  });
}

export type ActiveMember = Awaited<ReturnType<typeof getActiveMembers>>[number];
export type ActiveCategory = Awaited<ReturnType<typeof getActiveCategories>>[number];
