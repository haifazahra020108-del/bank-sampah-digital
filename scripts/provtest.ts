import fs from 'node:fs';
import path from 'node:path';
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
const API = 'https://integrate.api.nvidia.com/v1';
const KEY = process.env.NVIDIA_API_KEY!;
const MODEL = 'openai/gpt-oss-20b';

async function run(label: string, body: any) {
  const t0 = Date.now();
  const r = await fetch(`${API}/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const ms = Date.now()-t0;
  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  const reasoning = data?.choices?.[0]?.message?.reasoning_content ?? '';
  console.log(`${label}: ${ms}ms status=${r.status} content=${content.length} reasoning=${reasoning.length}`);
  if (!r.ok) console.log('ERR', JSON.stringify(data).slice(0,300));
}

const base = { model: MODEL, messages:[{role:'system',content:'You are helpful.'},{role:'user',content:'Siapa Anda?'}], max_tokens: 2048, stream:false };

(async () => {
  await run('with reasoning_effort low', { ...base, chat_template_kwargs:{reasoning_effort:'low'} });
  await run('no kwargs', base);
  await run('reasoning_effort none', { ...base, chat_template_kwargs:{reasoning_effort:'none'} });
  await run('max_tokens 512', { ...base, max_tokens:512, chat_template_kwargs:{reasoning_effort:'low'} });
})();