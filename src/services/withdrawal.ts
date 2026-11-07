import { prisma } from '@/lib/prisma';

export async function getMemberBalance(memberId: string) {
  const [completedDeposits, withdrawals] = await Promise.all([
    prisma.wasteTransaction.aggregate({
      where: { memberId, status: 'COMPLETED' },
      _sum: { totalValue: true },
    }),
    prisma.withdrawal.groupBy({
      by: ['status'],
      where: { memberId },
      _sum: { amount: true },
    }),
  ]);

  const totalDeposits = completedDeposits._sum.totalValue ?? 0;
  
  let totalWithdrawn = 0;
  let totalPending = 0;

  withdrawals.forEach((w) => {
    if (w.status === 'COMPLETED') totalWithdrawn += (w._sum.amount ?? 0);
    if (w.status === 'PENDING') totalPending += (w._sum.amount ?? 0);
  });

  const availableBalance = totalDeposits - totalWithdrawn - totalPending;

  return {
    totalDeposits,
    totalWithdrawn,
    totalPending,
    availableBalance,
  };
}

export async function getMemberWithdrawals(memberId: string) {
  return prisma.withdrawal.findMany({
    where: { memberId },
    orderBy: { requestDate: 'desc' },
  });
}

export async function getAllWithdrawalRequests(statusFilter?: string) {
  const where = statusFilter && statusFilter !== 'ALL' ? { status: statusFilter } : {};
  return prisma.withdrawal.findMany({
    where,
    orderBy: { requestDate: 'desc' },
    include: {
      member: {
        select: { name: true, email: true },
      },
      processedBy: {
        select: { name: true },
      },
    },
  });
}
