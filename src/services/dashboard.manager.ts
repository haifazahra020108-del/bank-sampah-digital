import { prisma } from '@/lib/prisma';

function getTodayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function getManagerDashboardStats() {
  const { start, end } = getTodayRange();

  const [todayAgg, recentTransactions] = await Promise.all([
    // Agregasi setoran hari ini
    prisma.wasteTransaction.aggregate({
      where: {
        status: 'COMPLETED',
        date: { gte: start, lte: end },
      },
      _sum: { weight: true, totalValue: true },
      _count: true,
    }),

    // 8 transaksi terbaru (tidak hanya hari ini) untuk referensi cepat
    prisma.wasteTransaction.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      take: 8,
      include: {
        member: { select: { name: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

  return {
    todayDepositsValue: todayAgg._sum.totalValue ?? 0,
    todayWeight: todayAgg._sum.weight ?? 0,
    todayTransactionCount: todayAgg._count,
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      memberName: tx.member.name,
      categoryName: tx.category.name,
      weight: tx.weight,
      totalValue: tx.totalValue,
      date: tx.date.toISOString(),
    })),
  };
}

export type ManagerDashboardStats = Awaited<ReturnType<typeof getManagerDashboardStats>>;
