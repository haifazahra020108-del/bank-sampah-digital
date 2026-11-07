import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export interface ReportFilter {
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  memberId?: string;
  status?: string; // 'COMPLETED', 'CANCELLED', or 'ALL'
}

export async function getReportFilterOptions() {
  const [categories, members] = await Promise.all([
    prisma.wasteCategory.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ 
      where: { role: 'MEMBER' },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' }
    })
  ]);

  return { categories, members };
}

function buildWhereClause(filters: ReportFilter) {
  const where: Prisma.WasteTransactionWhereInput = {};

  if (filters.status && filters.status !== 'ALL') {
    where.status = filters.status;
  }

  if (filters.categoryId && filters.categoryId !== 'ALL') {
    where.categoryId = filters.categoryId;
  }

  if (filters.memberId && filters.memberId !== 'ALL') {
    where.memberId = filters.memberId;
  }

  if (filters.startDate || filters.endDate) {
    where.date = {};
    if (filters.startDate) {
      where.date.gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      // Set to end of the day
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  return where;
}

export async function getReportAggregates(filters: ReportFilter) {
  const where = buildWhereClause(filters);

  // 1. Overall Totals
  const aggregate = await prisma.wasteTransaction.aggregate({
    where,
    _sum: { weight: true, totalValue: true },
    _count: true,
  });

  // 2. Breakdown by Category
  // Due to SQLite limitations in Prisma for groupBy with includes, 
  // we group by categoryId, then manually map category names.
  const groupBy = await prisma.wasteTransaction.groupBy({
    by: ['categoryId'],
    where,
    _sum: { weight: true, totalValue: true },
  });

  // Fetch category names for the grouped data
  const categories = await prisma.wasteCategory.findMany({
    where: { id: { in: groupBy.map(g => g.categoryId) } },
    select: { id: true, name: true, unit: true }
  });

  const categoryBreakdown = groupBy.map(g => {
    const cat = categories.find(c => c.id === g.categoryId);
    return {
      categoryId: g.categoryId,
      categoryName: cat?.name ?? 'Unknown',
      unit: cat?.unit ?? 'kg',
      totalWeight: g._sum.weight ?? 0,
      totalValue: g._sum.totalValue ?? 0,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);

  return {
    totalTransactions: aggregate._count,
    totalWeight: aggregate._sum.weight ?? 0,
    totalValue: aggregate._sum.totalValue ?? 0,
    categoryBreakdown,
  };
}

export async function getReportTransactions(filters: ReportFilter, page: number = 1, limit: number = 20) {
  const where = buildWhereClause(filters);
  const skip = (page - 1) * limit;

  const [transactions, totalCount] = await Promise.all([
    prisma.wasteTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { date: 'desc' },
      include: {
        member: { select: { name: true, email: true } },
        category: { select: { name: true, unit: true } },
        createdBy: { select: { name: true } },
      }
    }),
    prisma.wasteTransaction.count({ where })
  ]);

  return {
    data: transactions.map(tx => ({
      id: tx.id,
      date: tx.date.toISOString(),
      memberName: tx.member.name,
      memberEmail: tx.member.email,
      categoryName: tx.category.name,
      unit: tx.category.unit,
      weight: tx.weight,
      pricePerKgSnapshot: tx.pricePerKgSnapshot,
      totalValue: tx.totalValue,
      status: tx.status,
      createdByName: tx.createdBy.name,
    })),
    pagination: {
      total: totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    }
  };
}
