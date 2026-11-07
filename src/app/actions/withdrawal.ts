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

export async function requestWithdrawalAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== 'MEMBER') {
    return { success: false, message: 'Unauthorized: Hanya anggota yang dapat mengajukan penarikan.' };
  }

  const amountStr = formData.get('amount') as string;
  const amount = parseFloat(amountStr);

  if (isNaN(amount) || amount <= 0) {
    return { success: false, message: 'Nominal penarikan harus lebih dari 0.' };
  }

  try {
    // Gunakan Prisma transaction untuk melakukan pengecekan saldo secara atomis
    const result = await prisma.$transaction(async (tx) => {
      // 1. Hitung total setoran yang sudah COMPLETED
      const completedDeposits = await tx.wasteTransaction.aggregate({
        where: { memberId: session.userId, status: 'COMPLETED' },
        _sum: { totalValue: true },
      });
      
      // 2. Hitung total penarikan PENDING dan COMPLETED
      const withdrawals = await tx.withdrawal.groupBy({
        by: ['status'],
        where: { memberId: session.userId, status: { in: ['COMPLETED', 'PENDING'] } },
        _sum: { amount: true },
      });

      const totalDeposits = completedDeposits._sum.totalValue ?? 0;
      let totalWithdrawn = 0;
      let totalPending = 0;

      withdrawals.forEach((w) => {
        if (w.status === 'COMPLETED') totalWithdrawn += (w._sum.amount ?? 0);
        if (w.status === 'PENDING') totalPending += (w._sum.amount ?? 0);
      });

      // 3. Hitung saldo tersedia (saldo riil - penarikan yang sedang diproses)
      const availableBalance = totalDeposits - totalWithdrawn - totalPending;

      // 4. Tolak jika amount melebihi saldo tersedia
      if (amount > availableBalance) {
        throw new Error(`Saldo tidak mencukupi. Saldo tersedia Anda saat ini adalah Rp${availableBalance.toLocaleString('id-ID')}.`);
      }

      // 5. Buat entri withdrawal baru
      return await tx.withdrawal.create({
        data: {
          memberId: session.userId,
          amount,
          status: 'PENDING',
        },
      });
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/penarikan');
    revalidatePath('/dashboard/transaksi');
    revalidatePath('/pengelola/penarikan');

    // ── Trigger real-event notifications ──────────────────────────────────
    try {
      // 1. Notifikasi untuk Anggota (MEMBER) pemilik pengajuan
      await createNotification({
        userId: session.userId,
        title: 'Pengajuan Penarikan Diterima',
        message: `Pengajuan penarikan saldo sebesar Rp${amount.toLocaleString('id-ID')} berhasil dibuat dan sedang menunggu persetujuan.`,
        type: 'WITHDRAWAL',
        link: '/dashboard/penarikan',
      });

      // 2. Notifikasi untuk Pengelola (tindakan pemeriksaan)
      const managers = await getActiveManagers();
      if (managers.length > 0) {
        await createManyNotifications(
          managers.map((mgr) => ({
            userId: mgr.id,
            title: 'Pengajuan Penarikan Baru',
            message: `Ada pengajuan penarikan saldo baru sebesar Rp${amount.toLocaleString('id-ID')} dari ${session.name} yang memerlukan pemeriksaan.`,
            type: 'WITHDRAWAL',
            link: '/pengelola/penarikan',
          }))
        );
      }

      // 3. Notifikasi untuk Admin (pemantauan administratif)
      const admins = await getActiveAdmins();
      if (admins.length > 0) {
        await createManyNotifications(
          admins.map((adm) => ({
            userId: adm.id,
            title: 'Pengajuan Penarikan Masuk',
            message: `Anggota ${session.name} mengajukan penarikan saldo sebesar Rp${amount.toLocaleString('id-ID')}.`,
            type: 'WITHDRAWAL',
            link: '/admin',
          }))
        );
      }
    } catch (notifErr) {
      console.error('[requestWithdrawalAction] Notification trigger error:', notifErr);
    }

    return { success: true, message: 'Pengajuan penarikan berhasil dibuat. Menunggu persetujuan.' };

  } catch (error: any) {
    console.error('Error requesting withdrawal:', error);
    return { success: false, message: error.message || 'Terjadi kesalahan sistem.' };
  }
}

export async function processWithdrawalAction(id: string, actionType: 'APPROVE' | 'REJECT') {
  const session = await getSession();
  if (!session || !['ADMIN', 'MANAGER'].includes(session.role)) {
    return { success: false, message: 'Unauthorized: Akses ditolak.' };
  }

  try {
    const existing = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, name: true } },
      },
    });
    if (!existing) {
      return { success: false, message: 'Pengajuan tidak ditemukan.' };
    }
    
    if (existing.status !== 'PENDING') {
      return { success: false, message: `Pengajuan sudah diproses dengan status ${existing.status}.` };
    }

    const newStatus = actionType === 'APPROVE' ? 'COMPLETED' : 'REJECTED';

    await prisma.withdrawal.update({
      where: { id },
      data: {
        status: newStatus,
        processedById: session.userId,
        completedDate: new Date(),
      },
    });

    // Invalidate path untuk semua yang berkaitan dengan withdrawal dan saldo
    revalidatePath('/pengelola/penarikan');
    revalidatePath('/admin/laporan');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/penarikan');
    revalidatePath('/dashboard/transaksi');
    revalidatePath('/admin');
    revalidatePath('/pengelola');

    // ── Trigger real-event notifications ──────────────────────────────────
    try {
      // 1. Notifikasi untuk Anggota (MEMBER) pemilik penarikan
      await createNotification({
        userId: existing.memberId,
        title: actionType === 'APPROVE' ? 'Pengajuan Penarikan Disetujui' : 'Pengajuan Penarikan Ditolak',
        message:
          actionType === 'APPROVE'
            ? `Pengajuan penarikan saldo sebesar Rp${existing.amount.toLocaleString('id-ID')} telah disetujui. Dana dapat diambil.`
            : `Pengajuan penarikan saldo sebesar Rp${existing.amount.toLocaleString('id-ID')} ditolak. Saldo telah dikembalikan ke akun Anda.`,
        type: 'WITHDRAWAL',
        link: actionType === 'APPROVE' ? '/dashboard/transaksi' : '/dashboard/penarikan',
        notifyViaTelegram: true,
      });

      // 2. Notifikasi untuk Admin (laporan / audit)
      const admins = await getActiveAdmins(session.role === 'ADMIN' ? session.userId : undefined);
      if (admins.length > 0) {
        await createManyNotifications(
          admins.map((adm) => ({
            userId: adm.id,
            title: actionType === 'APPROVE' ? 'Penarikan Disetujui' : 'Penarikan Ditolak',
            message: `Penarikan Rp${existing.amount.toLocaleString('id-ID')} untuk ${existing.member?.name ?? 'Anggota'} telah di-${actionType === 'APPROVE' ? 'setujui' : 'tolak'} oleh ${session.name}.`,
            type: 'WITHDRAWAL',
            link: '/admin/laporan',
          }))
        );
      }

      // 3. Notifikasi untuk Pengelola lain (sinkronisasi status)
      const managers = await getActiveManagers(session.role === 'MANAGER' ? session.userId : undefined);
      if (managers.length > 0) {
        await createManyNotifications(
          managers.map((mgr) => ({
            userId: mgr.id,
            title: actionType === 'APPROVE' ? 'Penarikan Disetujui' : 'Penarikan Ditolak',
            message: `Penarikan Rp${existing.amount.toLocaleString('id-ID')} untuk ${existing.member?.name ?? 'Anggota'} telah di-${actionType === 'APPROVE' ? 'setujui' : 'tolak'} oleh ${session.name}.`,
            type: 'WITHDRAWAL',
            link: '/pengelola/penarikan',
          }))
        );
      }
    } catch (notifErr) {
      console.error('[processWithdrawalAction] Notification trigger error:', notifErr);
    }

    return { success: true, message: `Pengajuan berhasil di-${actionType === 'APPROVE' ? 'setujui' : 'tolak'}.` };
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    return { success: false, message: 'Terjadi kesalahan sistem.' };
  }
}
