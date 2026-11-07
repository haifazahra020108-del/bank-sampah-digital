'use server';

import { getSession } from '@/utils/session';
import { getReportAggregates, getReportTransactions, ReportFilter } from '@/services/report';

export async function loadReportDataAction(filters: ReportFilter, page: number = 1) {
  const session = await getSession();
  
  // Security check: Only ADMIN and MANAGER can access this comprehensive report data
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, error: 'Unauthorized access' };
  }

  try {
    const [aggregates, transactionsData] = await Promise.all([
      getReportAggregates(filters),
      getReportTransactions(filters, page, 15) // Limit 15 per page
    ]);

    return {
      success: true,
      data: {
        aggregates,
        transactions: transactionsData.data,
        pagination: transactionsData.pagination
      }
    };
  } catch (error) {
    console.error('Error loading report data:', error);
    return { success: false, error: 'Terjadi kesalahan saat memuat data laporan.' };
  }
}
