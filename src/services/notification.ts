import { prisma } from '@/lib/prisma';
import { scheduleNotificationDelivery } from '@/services/telegram-delivery';

export type NotificationType = 'TRANSACTION' | 'WITHDRAWAL' | 'MEMBER' | 'SYSTEM';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  link?: string | null;
  /**
   * Hanya peristiwa yang memang wajib dicerminkan ke Telegram yang menyetel
   * ini `true`. Notifikasi website lain tetap tersimpan normal di lonceng,
   * tetapi tidak dijadwalkan untuk dikirim ke Telegram.
   */
  notifyViaTelegram?: boolean;
}

/**
 * Buat satu notifikasi untuk pengguna tertentu.
 *
 * Pengiriman ke Telegram dijalankan sebagai efek samping opsional: dijadwalkan
 * setelah notifikasi berhasil tersimpan dan TIDAP(await) sebelum respons, sehingga
 * notifikasi website tidak pernah bergantung pada ketersediaan Telegram.
 */
export async function createNotification(input: CreateNotificationInput) {
  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type,
        link: input.link || null,
        isRead: false,
      },
    });

    // Notifikasi website sudah aman tersimpan; Telegram hanya cermin opsional
    // untuk peristiwa yang memang wajib dikirim.
    if (input.notifyViaTelegram) {
      scheduleNotificationDelivery(created.id);
    }

    return created;
  } catch (error) {
    console.error('[createNotification] DB error:', error);
    return null;
  }
}

/**
 * Buat beberapa notifikasi sekaligus (misalnya untuk semua Admin & Pengelola).
 */
export async function createManyNotifications(inputs: CreateNotificationInput[]) {
  if (inputs.length === 0) return { count: 0 };
  try {
    const results = await Promise.allSettled(
      inputs.map((item) =>
        prisma.notification.create({
          data: {
            userId: item.userId,
            title: item.title,
            message: item.message,
            type: item.type,
            link: item.link || null,
            isRead: false,
          },
        })
      )
    );

    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      if (result.status === 'fulfilled' && inputs[i].notifyViaTelegram) {
        scheduleNotificationDelivery(result.value.id);
      }
    }

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    return { count: successCount };
  } catch (error) {
    console.error('[createManyNotifications] DB error:', error);
    return { count: 0 };
  }
}

/**
 * Dapatkan daftar Admin aktif.
 */
export async function getActiveAdmins(excludeUserId?: string) {
  try {
    return await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        status: 'ACTIVE',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: {
        id: true,
        role: true,
        name: true,
      },
    });
  } catch (error) {
    console.error('[getActiveAdmins] DB error:', error);
    return [];
  }
}

/**
 * Dapatkan daftar Pengelola (MANAGER) aktif.
 */
export async function getActiveManagers(excludeUserId?: string) {
  try {
    return await prisma.user.findMany({
      where: {
        role: 'MANAGER',
        status: 'ACTIVE',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: {
        id: true,
        role: true,
        name: true,
      },
    });
  } catch (error) {
    console.error('[getActiveManagers] DB error:', error);
    return [];
  }
}

/**
 * Dapatkan daftar Admin dan Pengelola aktif.
 */
export async function getActiveStaffUsers(excludeUserId?: string) {
  try {
    return await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'MANAGER'] },
        status: 'ACTIVE',
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: {
        id: true,
        role: true,
        name: true,
      },
    });
  } catch (error) {
    console.error('[getActiveStaffUsers] DB error:', error);
    return [];
  }
}

/**
 * Dapatkan daftar notifikasi milik pengguna yang sedang login.
 */
export async function getUserNotifications(userId: string, limit: number = 20) {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        link: true,
        isRead: true,
        createdAt: true,
      },
    });
  } catch (error) {
    console.error('[getUserNotifications] DB error:', error);
    return [];
  }
}

/**
 * Hitung jumlah notifikasi yang belum dibaca untuk pengguna.
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  try {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  } catch (error) {
    console.error('[getUnreadNotificationCount] DB error:', error);
    return 0;
  }
}

/**
 * Tandai satu notifikasi sebagai sudah dibaca (dengan filter kepemilikan userId).
 */
export async function markNotificationAsRead(id: string, userId: string) {
  try {
    // Validasi kepemilikan agar user lain tidak dapat memanipulasi ID
    const count = await prisma.notification.count({
      where: { id, userId },
    });
    if (count === 0) {
      return { success: false, message: 'Notifikasi tidak ditemukan atau bukan milik Anda.' };
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return { success: true };
  } catch (error) {
    console.error('[markNotificationAsRead] DB error:', error);
    return { success: false, message: 'Gagal memperbarui notifikasi.' };
  }
}

/**
 * Tandai semua notifikasi milik pengguna sebagai sudah dibaca.
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return { success: true };
  } catch (error) {
    console.error('[markAllNotificationsAsRead] DB error:', error);
    return { success: false, message: 'Gagal memperbarui semua notifikasi.' };
  }
}
