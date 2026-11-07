'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/utils/session';
import {
  createNotification,
  createManyNotifications,
  getActiveAdmins,
  getActiveManagers,
} from '@/services/notification';

export interface TransactionResult {
  success: boolean;
  message: string;
  transactionId?: string;
  /** Preview data returned after validation — used for server-side preview if needed */
  preview?: {
    memberName: string;
    categoryName: string;
    weight: number;
    pricePerKgSnapshot: number;
    totalValue: number;
  };
}

/**
 * Server action: buat transaksi setoran sampah.
 *
 * Semua kalkulasi dilakukan server-side.
 * Harga diambil langsung dari DB (bukan dari frontend).
 * Disimpan dengan prisma.$transaction untuk atomisitas.
 */
export async function createTransactionAction(
  formData: FormData
): Promise<TransactionResult> {
  // ── 1. Auth guard ───────────────────────────────────────────────────────────
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, message: 'Unauthorized: hanya Pengelola yang dapat mencatat setoran.' };
  }

  // ── 2. Parse input dari form ────────────────────────────────────────────────
  const memberId   = (formData.get('memberId')   as string | null)?.trim() ?? '';
  const categoryId = (formData.get('categoryId') as string | null)?.trim() ?? '';
  const weightStr  = (formData.get('weight')     as string | null)?.trim() ?? '';

  // ── 3. Validasi awal ─────────────────────────────────────────────────────────
  if (!memberId || !categoryId) {
    return { success: false, message: 'Anggota dan jenis sampah wajib dipilih.' };
  }

  const weight = parseFloat(weightStr);
  if (isNaN(weight)) {
    return { success: false, message: 'Berat harus berupa angka.' };
  }
  if (weight <= 0) {
    return { success: false, message: 'Berat harus lebih dari 0 kg.' };
  }
  if (weight > 10000) {
    return { success: false, message: 'Berat melebihi batas maksimum (10.000 kg).' };
  }

  // ── 4. Ambil data dari DB — jangan percaya nilai dari client ─────────────────
  const [member, category] = await Promise.all([
    prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, status: true, role: true },
    }),
    prisma.wasteCategory.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true, pricePerKg: true, isActive: true },
    }),
  ]);

  // ── 5. Validasi entitas ──────────────────────────────────────────────────────
  if (!member || member.role !== 'MEMBER') {
    return { success: false, message: 'Anggota tidak ditemukan.' };
  }
  if (member.status !== 'ACTIVE') {
    return { success: false, message: `Anggota "${member.name}" berstatus nonaktif dan tidak dapat melakukan setoran.` };
  }
  if (!category) {
    return { success: false, message: 'Jenis sampah tidak ditemukan.' };
  }
  if (!category.isActive) {
    return { success: false, message: `Jenis sampah "${category.name}" sedang nonaktif dan tidak dapat digunakan untuk transaksi baru.` };
  }

  // ── 6. Kalkulasi server-side (TIDAK mempercayai nilai dari frontend) ─────────
  const pricePerKgSnapshot = category.pricePerKg;           // snapshot saat ini
  const totalValue = parseFloat((weight * pricePerKgSnapshot).toFixed(2));

  // ── 7. Simpan dengan atomic transaction ─────────────────────────────────────
  try {
    const created = await prisma.$transaction(async (tx) => {
      return tx.wasteTransaction.create({
        data: {
          memberId,
          categoryId,
          weight,
          pricePerKgSnapshot,
          totalValue,
          date: new Date(),
          createdById: session.userId,
          status: 'COMPLETED',
        },
      });
    });

    // ── 8. Invalidate cache ──────────────────────────────────────────────────
    revalidatePath('/pengelola/setoran');
    revalidatePath('/pengelola');
    revalidatePath(`/admin/anggota/${memberId}`);
    revalidatePath(`/pengelola/anggota/${memberId}`);
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/transaksi');

    // ── 9. Trigger real-event notifications ──────────────────────────────────
    try {
      // 1. Notifikasi untuk Anggota (MEMBER) pemilik setoran
      await createNotification({
        userId: memberId,
        title: 'Setoran Berhasil Dicatat',
        message: `Setoran sampah ${category.name} seberat ${weight} kg telah dicatat. Saldo bertambah Rp${totalValue.toLocaleString('id-ID')}.`,
        type: 'TRANSACTION',
        link: '/dashboard/transaksi',
        notifyViaTelegram: true,
      });

      // 2. Notifikasi untuk semua Admin (pemantauan administratif)
      const admins = await getActiveAdmins(session.role === 'ADMIN' ? session.userId : undefined);
      if (admins.length > 0) {
        await createManyNotifications(
          admins.map((adm) => ({
            userId: adm.id,
            title: 'Setoran Sampah Dicatat',
            message: `${member.name} menyetor ${weight} kg ${category.name} (Rp${totalValue.toLocaleString('id-ID')}) dicatat oleh ${session.name}.`,
            type: 'TRANSACTION',
            link: '/admin/laporan',
          }))
        );
      }

      // 3. Notifikasi untuk Pengelola lain (koordinasi operasional)
      const managers = await getActiveManagers(session.userId);
      if (managers.length > 0) {
        await createManyNotifications(
          managers.map((mgr) => ({
            userId: mgr.id,
            title: 'Setoran Sampah Baru',
            message: `Setoran sampah ${category.name} seberat ${weight} kg untuk ${member.name} berhasil dicatat oleh ${session.name}.`,
            type: 'TRANSACTION',
            link: '/pengelola',
          }))
        );
      }
    } catch (notifErr) {
      console.error('[createTransactionAction] Notification trigger error:', notifErr);
    }

    return {
      success: true,
      message: `Setoran ${weight} kg berhasil dicatat. Total: Rp${totalValue.toLocaleString('id-ID')}.`,
      transactionId: created.id,
      preview: {
        memberName: member.name,
        categoryName: category.name,
        weight,
        pricePerKgSnapshot,
        totalValue,
      },
    };
  } catch (error) {
    console.error('[createTransactionAction] DB error:', error);
    return { success: false, message: 'Terjadi kesalahan saat menyimpan transaksi. Silakan coba lagi.' };
  }
}
