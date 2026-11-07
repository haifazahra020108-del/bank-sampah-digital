'use server';

import { getSession } from '@/utils/session';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notification';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface GetNotificationsResult {
  success: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  message?: string;
}

/**
 * Server Action: Ambil daftar notifikasi dan unread count milik user yang sedang login.
 */
export async function getNotificationsAction(): Promise<GetNotificationsResult> {
  const session = await getSession();
  if (!session) {
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      message: 'Unauthorized',
    };
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      getUserNotifications(session.userId, 20),
      getUnreadNotificationCount(session.userId),
    ]);

    const formattedNotifications: NotificationItem[] = notifications.map((n) => ({
      ...n,
      createdAt: typeof n.createdAt === 'string' ? n.createdAt : n.createdAt.toISOString(),
    }));

    return {
      success: true,
      notifications: formattedNotifications,
      unreadCount,
    };
  } catch (error) {
    console.error('[getNotificationsAction] error:', error);
    return {
      success: false,
      notifications: [],
      unreadCount: 0,
      message: 'Gagal mengambil notifikasi',
    };
  }
}

/**
 * Server Action: Tandai satu notifikasi sebagai sudah dibaca (kepemilikan diverifikasi di server).
 */
export async function markAsReadAction(notificationId: string): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized' };
  }

  if (!notificationId || typeof notificationId !== 'string') {
    return { success: false, message: 'ID notifikasi tidak valid' };
  }

  return await markNotificationAsRead(notificationId, session.userId);
}

/**
 * Server Action: Tandai semua notifikasi milik pengguna yang sedang login sebagai sudah dibaca.
 */
export async function markAllAsReadAction(): Promise<{ success: boolean; message?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: 'Unauthorized' };
  }

  return await markAllNotificationsAsRead(session.userId);
}
