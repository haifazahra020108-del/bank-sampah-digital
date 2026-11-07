import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function getMembersList(search?: string) {
  const whereClause: Prisma.UserWhereInput = {
    role: 'MEMBER',
  };

  if (search) {
    whereClause.OR = [
      { name: { contains: search } }, // default in sqlite is case insensitive for basic ascii, but can be tricky. We use basic contains.
      { email: { contains: search } },
    ];
  }

  const members = await prisma.user.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    include: {
      transactions: {
        where: { status: 'COMPLETED' },
        select: { totalValue: true, weight: true },
      },
      withdrawals: {
        where: { status: 'COMPLETED' },
        select: { amount: true },
      },
    },
  });

  // Calculate aggregated fields for list view
  return members.map((member) => {
    const totalIncome = member.transactions.reduce((sum, tx) => sum + tx.totalValue, 0);
    const totalWithdrawn = member.withdrawals.reduce((sum, w) => sum + w.amount, 0);
    const balance = totalIncome - totalWithdrawn;
    const totalWeight = member.transactions.reduce((sum, tx) => sum + tx.weight, 0);

    return {
      id: member.id,
      name: member.name,
      email: member.email,
      contact: member.contact,
      address: member.address,
      status: member.status,
      createdAt: member.createdAt.toISOString(),
      balance,
      totalWeight,
    };
  });
}

export async function getMemberDetail(id: string) {
  const member = await prisma.user.findUnique({
    where: { id, role: 'MEMBER' },
    include: {
      transactions: {
        where: { status: 'COMPLETED' },
        orderBy: { date: 'desc' },
        take: 10,
        include: {
          category: { select: { name: true } },
        },
      },
      withdrawals: {
        where: { status: 'COMPLETED' },
        select: { amount: true },
      },
    },
  });

  if (!member) return null;

  // Aggregate stats
  const allCompletedTransactions = await prisma.wasteTransaction.aggregate({
    where: { memberId: id, status: 'COMPLETED' },
    _sum: { totalValue: true, weight: true },
    _count: true,
  });

  const totalIncome = allCompletedTransactions._sum.totalValue ?? 0;
  const totalWithdrawn = member.withdrawals.reduce((sum, w) => sum + w.amount, 0);
  const balance = totalIncome - totalWithdrawn;
  const totalWeight = allCompletedTransactions._sum.weight ?? 0;

  return {
    id: member.id,
    name: member.name,
    email: member.email,
    contact: member.contact,
    address: member.address,
    status: member.status,
    createdAt: member.createdAt.toISOString(),
    stats: {
      balance,
      totalWeight,
      totalTransactions: allCompletedTransactions._count,
    },
    recentTransactions: member.transactions.map((tx) => ({
      id: tx.id,
      categoryName: tx.category.name,
      weight: tx.weight,
      totalValue: tx.totalValue,
      date: tx.date.toISOString(),
    })),
  };
}
