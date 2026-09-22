// จุดเริ่มงาน: scan -> aggregate -> encrypt -> เขียน docs/ -> commit & push
// รันด้วย `npm run sync` หรือให้ Task Scheduler เรียกทุก 10 นาที

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { scan } from './scan.js';
import { aggregate } from './aggregate.js';
import { encryptJSON } from './encrypt.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NO_PUSH = process.argv.includes('--no-push');

/** โหลด .env.local แบบง่าย ๆ (KEY=value ต่อบรรทัด) โดยไม่พึ่ง dependency */
function loadEnv() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
}

function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', ...opts }).trim();
}

async function main() {
  loadEnv();

  const passphrase = process.env.CU_PASSPHRASE;
  if (!passphrase) {
    console.error('ไม่พบ CU_PASSPHRASE — คัดลอก .env.local.example เป็น .env.local แล้วตั้งค่าก่อน');
    process.exit(1);
  }

  const tz = process.env.CU_TZ || 'Asia/Bangkok';
  const label = process.env.CU_LABEL || '';
  const plan = process.env.CU_PLAN || 'pro';

  const { events, quota, files, newLines } = await scan({ cacheDir: path.join(ROOT, '.cache') });
  const data = aggregate({ events, quota, tz, label, plan });

  const outFile = path.join(ROOT, 'docs', 'data.enc.json');
  const previous = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8') : '';
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(encryptJSON(data, passphrase)));

  const pct = data.current ? (data.current.pct * 100).toFixed(1) + '%' : '—';
  console.log(
    `สแกน ${files} ไฟล์ (+${newLines} บรรทัดใหม่) -> ${events.length} ข้อความ | ` +
    `หน้าต่างปัจจุบัน ${pct} | รวม $${data.totals.cost.toFixed(2)}`,
  );

  if (NO_PUSH) { console.log('ข้าม git push (--no-push)'); return; }

  // ciphertext เปลี่ยนทุกครั้งเพราะ salt/iv สุ่มใหม่ จึงเทียบ "มีข้อมูลใหม่ไหม" จากจำนวน event แทน
  const stampFile = path.join(ROOT, '.cache', 'published.json');
  let lastCount = -1;
  try { lastCount = JSON.parse(fs.readFileSync(stampFile, 'utf8')).events; } catch { /* first run */ }
  const unchanged = lastCount === events.length && previous !== '';
  if (unchanged) { console.log('ไม่มีข้อความใหม่ตั้งแต่ push ล่าสุด — ไม่ push'); return; }

  let remote = '';
  try { remote = git(['remote', 'get-url', 'origin']); } catch { /* ยังไม่ได้ตั้ง remote */ }
  if (!remote) {
    console.log('ยังไม่ได้ตั้ง git remote "origin" — ข้ามการ push (ไฟล์ถูกเขียนลง docs/ แล้ว)');
    return;
  }

  git(['add', 'docs/data.enc.json']);
  const staged = git(['diff', '--cached', '--name-only']);
  if (!staged) { console.log('ไม่มีอะไรให้ commit'); return; }

  git(['commit', '-m', `usage: ${new Date().toISOString()} (${events.length} msgs)`]);
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  git(['push', 'origin', branch]);
  fs.writeFileSync(stampFile, JSON.stringify({ events: events.length, at: Date.now() }));
  console.log(`push ขึ้น ${remote} (${branch}) เรียบร้อย`);
}

main().catch((err) => {
  console.error('sync ล้มเหลว:', err.message);
  process.exit(1);
});
