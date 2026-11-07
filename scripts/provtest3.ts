import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { buildAiUserContext } from '@/services/ai-context';
import { buildSystemPrompt } from '@/services/ai';

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
  const ctx = await buildAiUserContext({ userId: member.id, role: member.role, name: member.name, email: member.email });
  const prompt = buildSystemPrompt(ctx);
  console.log('prompt chars:', prompt.length);
  const messages = [{ role:'user', content:'Siapa Anda?' }];

  const KEY = process.env.NVIDIA_API_KEY!;
  const API = 'https://integrate.api.nvidia.com/v1';
  const body = { model:'openai/gpt-oss-20b', messages:[{role:'system',content:prompt},...messages], max_tokens:2048, stream:false, chat_template_kwargs:{reasoning_effort:'low'} };
  const t0 = Date.now();
  console.log('fetching...');
  const r = await fetch(`${API}/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(body) });
  console.log('status', r.status, 'ms', Date.now()-t0);
  const data = await r.json();
  console.log('content len', (data?.choices?.[0]?.message?.content||'').length);
  console.log('reasoning len', (data?.choices?.[0]?.message?.reasoning_content||'').length);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });