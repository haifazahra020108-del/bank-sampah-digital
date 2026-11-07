import { prisma } from '@/lib/prisma';
import { getMemberBalance } from '@/services/withdrawal';

export async function getMemberDashboardStats(userId: string) {
  const [balanceStats, txAgg, recentTransactions, recentWithdrawals] = await Promise.all([
    getMemberBalance(userId),
    // Total setoran anggota ini
    prisma.wasteTransaction.aggregate({
      where: { memberId: userId, status: 'COMPLETED' },
      _sum: { weight: true },
      _count: true,
    }),
    // 5 transaksi terakhir anggota ini
    prisma.wasteTransaction.findMany({
      where: { memberId: userId, status: 'COMPLETED' },
      orderBy: { date: 'desc' },
      take: 5,
      include: {
        category: { select: { name: true } },
      },
    }),
    // 5 penarikan terakhir
    prisma.withdrawal.findMany({
      where: { memberId: userId },
      orderBy: { requestDate: 'desc' },
      take: 5,
    })
  ]);

  return {
    currentBalance: balanceStats.availableBalance,
    pendingWithdrawal: balanceStats.totalPending,
    totalWeight: txAgg._sum.weight ?? 0,
    totalTransactions: txAgg._count,
    recentTransactions: recentTransactions.map((tx) => ({
      id: tx.id,
      categoryName: tx.category.name,
      weight: tx.weight,
      totalValue: tx.totalValue,
      date: tx.date.toISOString(),
    })),
    recentWithdrawals: recentWithdrawals.map(w => ({
      id: w.id,
      amount: w.amount,
      status: w.status,
      date: w.requestDate.toISOString(),
    }))
  };
}

export type MemberDashboardStats = Awaited<ReturnType<typeof getMemberDashboardStats>>;
