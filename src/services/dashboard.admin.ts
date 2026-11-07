import { prisma } from '@/lib/prisma';

export async function getAdminDashboardStats() {
  const [
    totalMembers,
    transactionAgg,
    totalTransactions,
    totalWithdrawn,
    recentActivity,
  ] = await Promise.all([
    // Total anggota aktif
    prisma.user.count({
      where: { role: 'MEMBER', status: 'ACTIVE' },
    }),

    // Total sampah & nilai transaksi
    prisma.wasteTransaction.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { weight: true, totalValue: true },
      _count: true,
    }),

    // Total count transaksi
    prisma.wasteTransaction.count({
      where: { status: 'COMPLETED' },
    }),

    // Total penarikan yang sudah selesai (dikurangkan dari saldo gross)
    prisma.withdrawal.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amount: true },
    }),

    // 10 aktivitas terbaru
    prisma.wasteTransaction.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      take: 10,
      include: {
        member: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  const totalSavingsGross = transactionAgg._sum.totalValue ?? 0;
  const totalWithdrawnAmount = totalWithdrawn._sum.amount ?? 0;
  const totalNetSavings = totalSavingsGross - totalWithdrawnAmount;

  return {
    totalMembers,
    totalWasteCollected: transactionAgg._sum.weight ?? 0,
    totalTransactions,
    totalNetSavings,
    recentActivity: recentActivity.map((tx) => ({
      id: tx.id,
      memberName: tx.member.name,
      categoryName: tx.category.name,
      weight: tx.weight,
      totalValue: tx.totalValue,
      date: tx.date.toISOString(),
    })),
  };
}

export type AdminDashboardStats = Awaited<ReturnType<typeof getAdminDashboardStats>>;
