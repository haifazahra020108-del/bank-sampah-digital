import { describe, it, expect } from 'vitest';
import { WasteTransactionSchema, WithdrawalSchema } from '@/models/validation';

describe('Unit Test: Zod Validation Schemas', () => {
  describe('WasteTransactionSchema', () => {
    it('harus menerima data transaksi setoran sampah yang valid', () => {
      const validData = {
        memberId: '550e8400-e29b-41d4-a716-446655440000',
        categoryId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        weight: 5.5,
        createdById: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
        status: 'COMPLETED' as const,
      };

      const result = WasteTransactionSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.weight).toBe(5.5);
        expect(result.data.status).toBe('COMPLETED');
      }
    });

    it('harus menolak transaksi jika berat bernilai 0 atau negatif', () => {
      const zeroWeight = {
        memberId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        categoryId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        weight: 0,
        createdById: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      };

      const negativeWeight = {
        ...zeroWeight,
        weight: -2.5,
      };

      expect(WasteTransactionSchema.safeParse(zeroWeight).success).toBe(false);
      expect(WasteTransactionSchema.safeParse(negativeWeight).success).toBe(false);
    });

    it('harus menolak transaksi jika field wajib kosong', () => {
      const missingCategory = {
        memberId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        weight: 10,
        createdById: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
      };

      const result = WasteTransactionSchema.safeParse(missingCategory);
      expect(result.success).toBe(false);
    });
  });

  describe('WithdrawalSchema', () => {
    it('harus menerima data penarikan saldo yang valid', () => {
      const validWithdrawal = {
        memberId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        amount: 50000,
      };

      const result = WithdrawalSchema.safeParse(validWithdrawal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(50000);
      }
    });

    it('harus menolak penarikan dengan nominal 0 atau negatif', () => {
      const zeroAmount = {
        memberId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        amount: 0,
      };

      const negativeAmount = {
        memberId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        amount: -10000,
      };

      expect(WithdrawalSchema.safeParse(zeroAmount).success).toBe(false);
      expect(WithdrawalSchema.safeParse(negativeAmount).success).toBe(false);
    });

    it('harus menolak penarikan tanpa memberId', () => {
      const missingMember = {
        amount: 25000,
      };

      expect(WithdrawalSchema.safeParse(missingMember).success).toBe(false);
    });
  });
});

