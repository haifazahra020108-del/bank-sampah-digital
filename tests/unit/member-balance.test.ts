import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMemberBalance } from '@/services/withdrawal';
import { prisma } from '@/lib/prisma';

// Mock Prisma Client agar unit test terisolasi 100% dari database
vi.mock('@/lib/prisma', () => ({
  prisma: {
    wasteTransaction: {
      aggregate: vi.fn(),
    },
    withdrawal: {
      groupBy: vi.fn(),
    },
  },
}));

// Tipe helper untuk mock return value — menghindari `as any`
type AggregateResult = Awaited<ReturnType<typeof prisma.wasteTransaction.aggregate>>;
type GroupByResult = Awaited<ReturnType<typeof prisma.withdrawal.groupBy>>;

describe('Unit Test: Perhitungan Saldo Anggota (getMemberBalance)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('harus menghitung saldo bersih dengan benar saat ada setoran dan penarikan selesai', async () => {
    // Mock: Setoran selesai = Rp 150.000
    vi.mocked(prisma.wasteTransaction.aggregate).mockResolvedValue({
      _sum: { totalValue: 150000 },
    } as unknown as AggregateResult);

    // Mock: Penarikan selesai = Rp 50.000, Penarikan pending = Rp 20.000
    vi.mocked(prisma.withdrawal.groupBy).mockResolvedValue([
      { status: 'COMPLETED', _sum: { amount: 50000 } },
      { status: 'PENDING', _sum: { amount: 20000 } },
    ] as unknown as GroupByResult);

    const balance = await getMemberBalance('member-123');

    expect(balance.totalDeposits).toBe(150000);
    expect(balance.totalWithdrawn).toBe(50000);
    expect(balance.totalPending).toBe(20000);
    // Saldo tersedia = 150.000 - 50.000 - 20.000 = 80.000
    expect(balance.availableBalance).toBe(80000);
  });

  it('harus mengembalikan saldo 0 jika anggota belum memiliki transaksi', async () => {
    vi.mocked(prisma.wasteTransaction.aggregate).mockResolvedValue({
      _sum: { totalValue: null },
    } as unknown as AggregateResult);

    vi.mocked(prisma.withdrawal.groupBy).mockResolvedValue([] as unknown as GroupByResult);

    const balance = await getMemberBalance('new-member-000');

    expect(balance.totalDeposits).toBe(0);
    expect(balance.totalWithdrawn).toBe(0);
    expect(balance.totalPending).toBe(0);
    expect(balance.availableBalance).toBe(0);
  });

  it('harus mengabaikan penarikan berstatus REJECTED dalam kalkulasi saldo berkurang', async () => {
    vi.mocked(prisma.wasteTransaction.aggregate).mockResolvedValue({
      _sum: { totalValue: 100000 },
    } as unknown as AggregateResult);

    vi.mocked(prisma.withdrawal.groupBy).mockResolvedValue([
      { status: 'REJECTED', _sum: { amount: 40000 } },
      { status: 'COMPLETED', _sum: { amount: 15000 } },
    ] as unknown as GroupByResult);

    const balance = await getMemberBalance('member-rejected-check');

    expect(balance.totalDeposits).toBe(100000);
    expect(balance.totalWithdrawn).toBe(15000);
    expect(balance.totalPending).toBe(0);
    // Saldo tersedia = 100.000 - 15.000 = 85.000 (status REJECTED tidak memotong saldo)
    expect(balance.availableBalance).toBe(85000);
  });
});

