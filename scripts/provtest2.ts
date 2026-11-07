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
console.log('key present:', !!process.env.NVIDIA_API_KEY);
const API = 'https://integrate.api.nvidia.com/v1';
const KEY = process.env.NVIDIA_API_KEY!;
const MODEL = 'openai/gpt-oss-20b';

(async () => {
  const body = { model: MODEL, messages:[{role:'system',content:'You are helpful.'},{role:'user',content:'Siapa Anda?'}], max_tokens: 2048, stream:false, chat_template_kwargs:{reasoning_effort:'low'} };
  const t0 = Date.now();
  console.log('fetching...');
  const r = await fetch(`${API}/chat/completions`, { method:'POST', headers:{Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}, body: JSON.stringify(body) });
  console.log('status', r.status, 'ms', Date.now()-t0);
  const data = await r.json();
  console.log('content len', (data?.choices?.[0]?.message?.content||'').length);
  console.log('reasoning len', (data?.choices?.[0]?.message?.reasoning_content||'').length);
})();