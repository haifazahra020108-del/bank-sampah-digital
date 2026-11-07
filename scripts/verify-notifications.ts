import { prisma } from '../src/lib/prisma';
import {
  createNotification,
  createManyNotifications,
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getActiveStaffUsers,
} from '../src/services/notification';

async function runTests() {
  console.log('--- STARTING NOTIFICATION SYSTEM VERIFICATION ---');

  // 1. Fetch test users
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const manager = await prisma.user.findFirst({ where: { role: 'MANAGER' } });
  const member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });

  if (!admin || !manager || !member) {
    throw new Error('Test users (admin/manager/member) not found in database.');
  }

  console.log(`[PASS] Users found - Admin: ${admin.name}, Manager: ${manager.name}, Member: ${member.name}`);

  // 2. Test staff lookup
  const staff = await getActiveStaffUsers(admin.id);
  console.log(`[PASS] getActiveStaffUsers found ${staff.length} staff excluding admin`);

  // 3. Clean up any previous test notifications for the member
  await prisma.notification.deleteMany({
    where: { userId: member.id, title: { contains: '[TEST]' } },
  });

  // 4. Test Notification Creation for Member (Deposit & Withdrawal)
  const notif1 = await createNotification({
    userId: member.id,
    title: '[TEST] Setoran Sampah Berhasil Dicatat',
    message: 'Setoran sampah Kardus seberat 5 kg berhasil dicatat. Saldo bertambah Rp15.000.',
    type: 'TRANSACTION',
    link: '/dashboard/transaksi',
  });

  const notif2 = await createNotification({
    userId: member.id,
    title: '[TEST] Pengajuan Penarikan Diterima',
    message: 'Pengajuan penarikan saldo sebesar Rp50.000 berhasil dibuat dan sedang menunggu persetujuan.',
    type: 'WITHDRAWAL',
    link: '/dashboard/penarikan',
  });

  if (!notif1 || !notif2) {
    throw new Error('Failed to create test notifications.');
  }
  console.log('[PASS] Notification creation successful for Member.');

  // 5. Test Unread Count
  const unreadBefore = await getUnreadNotificationCount(member.id);
  console.log(`[PASS] Unread count for member: ${unreadBefore} (>= 2)`);
  if (unreadBefore < 2) throw new Error('Unread count is less than expected.');

  // 6. Test User Isolation: Admin fetching member's notifications should only get Admin's notifications
  const adminNotifs = await getUserNotifications(admin.id);
  const containsMemberNotif = adminNotifs.some((n) => n.id === notif1.id || n.id === notif2.id);
  if (containsMemberNotif) {
    throw new Error('Data leak! Admin received member private notification.');
  }
  console.log('[PASS] User isolation verified: Admin cannot view member notification.');

  // 7. Test Security: Admin cannot mark Member's notification as read
  const hackAttempt = await markNotificationAsRead(notif1.id, admin.id);
  if (hackAttempt.success) {
    throw new Error('Security breach! User was able to mark another user notification as read.');
  }
  console.log('[PASS] Security verified: Cannot mark another user notification as read.');

  // 8. Test Mark Single Notification as Read
  const markRes = await markNotificationAsRead(notif1.id, member.id);
  if (!markRes.success) throw new Error('Failed to mark single notification as read.');

  const updatedNotifs = await getUserNotifications(member.id);
  const readItem = updatedNotifs.find((n) => n.id === notif1.id);
  if (!readItem?.isRead) throw new Error('Notification isRead was not updated to true.');
  console.log('[PASS] Single notification successfully marked as read.');

  // 9. Test Mark All as Read
  const markAllRes = await markAllNotificationsAsRead(member.id);
  if (!markAllRes.success) throw new Error('Failed to mark all notifications as read.');

  const unreadAfter = await getUnreadNotificationCount(member.id);
  console.log(`[PASS] Mark all as read verified: Unread count is now ${unreadAfter}`);
  if (unreadAfter !== 0) throw new Error('Unread count is not 0 after markAllAsRead.');

  // 10. Clean up test notifications
  await prisma.notification.deleteMany({
    where: { userId: member.id, title: { contains: '[TEST]' } },
  });

  console.log('--- ALL NOTIFICATION VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  });
