import { z } from 'zod';

export const UserSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['ADMIN', 'MANAGER', 'MEMBER']),
  contact: z.string().optional(),
  address: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

export const WasteCategorySchema = z.object({
  name: z.string().min(2, 'Nama kategori minimal 2 karakter'),
  unit: z.string().min(1, 'Satuan tidak boleh kosong'),
  pricePerKg: z.number().positive('Harga per kg harus lebih dari 0'),
  isActive: z.boolean().default(true),
});

export const WasteTransactionSchema = z.object({
  memberId: z.string().uuid(),
  categoryId: z.string().uuid(),
  weight: z.number().positive('Berat harus lebih dari 0'),
  createdById: z.string().uuid(),
  status: z.enum(['COMPLETED', 'CANCELLED']).default('COMPLETED'),
});

export const WithdrawalSchema = z.object({
  memberId: z.string().uuid(),
  amount: z.number().positive('Jumlah penarikan harus lebih dari 0'),
});
