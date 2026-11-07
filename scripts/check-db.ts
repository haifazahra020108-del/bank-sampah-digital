import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, name: true, role: true, email: true } });
  console.log('Users count:', users.length);
  users.forEach(u => console.log(`- ${u.role}: ${u.name} (${u.email}) [${u.id}]`));

  const notifs = await prisma.notification.findMany();
  console.log('\nNotifications count in DB:', notifs.length);
  notifs.forEach(n => console.log(`- [${n.type}] to ${n.userId} (read: ${n.isRead}): ${n.title} - ${n.message}`));

  const txs = await prisma.wasteTransaction.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log('\nRecent transactions count:', txs.length);

  const wds = await prisma.withdrawal.findMany({ take: 3, orderBy: { createdAt: 'desc' } });
  console.log('\nRecent withdrawals count:', wds.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
