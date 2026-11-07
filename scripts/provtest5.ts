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
const KEY = process.env.NVIDIA_API_KEY!;
const API = 'https://integrate.api.nvidia.com/v1';
(async () => {
  const small = 'You are AI Asisten Bank Sampah Digital. Jawab singkat.';
  for (const sz of [small, 'x'.repeat(40000)]) {
    const body = { model:'openai/gpt-oss-20b', messages:[{role:'system',content:sz},{role:'user',content:'Siapa Anda?'}], max_tokens:2048, stream:false, chat_template_kwargs:{reasoning_effort:'none'} };
    const t0 = Date.now();
    const r = await fetch(`${API}/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const ms = Date.now()-t0;
    const data = await r.json();
    console.log('promptlen', sz.length, 'status', r.status, 'ms', ms, 'content', (data?.choices?.[0]?.message?.content||'').length);
  }
})();