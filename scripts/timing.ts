import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { GroqService } from '@/services/ai';
import { buildAiUserContext } from '@/services/ai-context';

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2].trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    if (value) process.env[m[1]] = value;
  }
}
loadEnvLocal();

async function main() {
  const member = await prisma.user.findFirst({ where: { role: 'MEMBER' } });
  if (!member) throw new Error('no member');

  let t0 = Date.now();
  const ctx = await buildAiUserContext({ userId: member.id, role: member.role, name: member.name, email: member.email });
  console.log('buildContext ms:', Date.now() - t0);

  const ai = new GroqService();
  t0 = Date.now();
  const reply = await ai.chat('Siapa Anda?', [], ctx);
  console.log('chat ms:', Date.now() - t0);
  console.log('reply len:', reply.length);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });