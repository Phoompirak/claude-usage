// ปรับเทียบตัวเลขกับของจริงจากแผง /usage ใน Claude Code
//
// ทำไมต้องมี: log ในเครื่องบอกได้แค่ "ใช้ไปเท่าไหร่" แต่ไม่บอก "เพดานอยู่ตรงไหน"
// ก่อนหน้านี้เดาเพดานจากหน้าต่างที่เคยชนลิมิต ซึ่งคลาดได้มาก
// พอรู้ % จริงสักครั้ง ก็ถอดเพดานจริงออกมาได้ตรง ๆ: เพดาน = ยอดที่ใช้ ÷ เปอร์เซ็นต์
//
// วิธีใช้ — เปิด /usage ใน Claude Code แล้วอ่านเลขมาใส่:
//
//   node src/calibrate.js --session 55 --resets-in 1h
//   node src/calibrate.js --session 55 --resets-at 15:40 --weekly 18 --weekly-resets-in 2d
//
// ข้อควรรู้: ถ้าคุณใช้ Claude จากมือถือหรือเครื่องอื่นด้วย ค่าที่ปรับเทียบได้
// จะรวม "ส่วนที่มองไม่เห็น" เข้าไปเฉลี่ยอยู่ในเพดานโดยปริยาย
// ยิ่งใช้นอกเครื่องนี้มาก ค่าที่ได้ยิ่งเพี้ยนเร็ว ควรปรับเทียบบ่อยขึ้น

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { scan } from './scan.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOUR = 3600_000;
const DAY = 24 * HOUR;

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** "1h" "90m" "2d" -> มิลลิวินาที */
function parseDuration(s) {
  const m = /^(\d+(?:\.\d+)?)\s*([hmd])$/i.exec(String(s).trim());
  if (!m) return null;
  const n = Number(m[1]);
  return n * ({ m: 60_000, h: HOUR, d: DAY })[m[2].toLowerCase()];
}

/** "15:40" -> timestamp ของวันนี้ (หรือพรุ่งนี้ถ้าเวลานั้นผ่านไปแล้ว) */
function parseClock(s, tz) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m) return null;
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  // หา offset ของโซนเวลาโดยเทียบกับ UTC ณ เวลาปัจจุบัน
  const probe = new Date(`${today}T${m[1].padStart(2, '0')}:${m[2]}:00Z`);
  const offset = new Date(probe.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
               - new Date(probe.toLocaleString('en-US', { timeZone: tz })).getTime();
  let t = probe.getTime() + offset;
  if (t < Date.now() - 12 * HOUR) t += DAY;
  return t;
}

function resolveReset(inKey, atKey, tz) {
  const rin = arg(inKey);
  const rat = arg(atKey);
  if (rin) {
    const d = parseDuration(rin);
    if (d === null) throw new Error(`--${inKey} ต้องอยู่ในรูปแบบ 1h / 90m / 2d`);
    return Date.now() + d;
  }
  if (rat) {
    const t = parseClock(rat, tz);
    if (t === null) throw new Error(`--${atKey} ต้องอยู่ในรูปแบบ HH:MM`);
    return t;
  }
  return null;
}

function loadEnv() {
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    const k = s.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = s.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

export const CALIBRATION_FILE = 'calibration.json';

export function loadCalibration(root) {
  try { return JSON.parse(fs.readFileSync(path.join(root, CALIBRATION_FILE), 'utf8')); }
  catch { return null; }
}

async function main() {
  loadEnv();
  const tz = process.env.CU_TZ || 'Asia/Bangkok';

  const sessionPct = Number(arg('session'));
  if (!Number.isFinite(sessionPct) || sessionPct <= 0 || sessionPct > 100) {
    console.error(`ต้องระบุ --session เป็นตัวเลข 1-100 (เปอร์เซ็นต์ Session (5hr) จากแผง /usage)

ตัวอย่าง:
  node src/calibrate.js --session 55 --resets-in 1h
  node src/calibrate.js --session 55 --resets-at 15:40 --weekly 18 --weekly-resets-in 2d`);
    process.exit(1);
  }

  const sessionReset = resolveReset('resets-in', 'resets-at', tz);
  if (!sessionReset) {
    console.error('ต้องระบุ --resets-in (เช่น 1h) หรือ --resets-at (เช่น 15:40) ด้วย');
    process.exit(1);
  }

  const { events } = await scan({ cacheDir: path.join(ROOT, '.cache') });
  const sessionStart = sessionReset - 5 * HOUR;

  const inWindow = events.filter((e) => {
    const t = new Date(e.ts).getTime();
    return t >= sessionStart && t < sessionReset;
  });
  const localCost = inWindow.reduce((s, e) => s + e.cost, 0);

  if (localCost <= 0) {
    console.error('ไม่พบการใช้งานบนเครื่องนี้ในหน้าต่างดังกล่าว — ปรับเทียบไม่ได้');
    console.error(`หน้าต่างที่คำนวณได้: ${new Date(sessionStart).toLocaleString('th-TH', { timeZone: tz })}`
      + ` ถึง ${new Date(sessionReset).toLocaleString('th-TH', { timeZone: tz })}`);
    process.exit(1);
  }

  const cal = {
    at: new Date().toISOString(),
    tz,
    session: {
      pct: sessionPct,
      reset: sessionReset,
      start: sessionStart,
      localCost,
      // เพดานที่ถอดกลับได้ — หน่วยเดียวกับ cost ที่ dashboard ใช้
      capCost: localCost / (sessionPct / 100),
    },
  };

  const weeklyPct = Number(arg('weekly'));
  if (Number.isFinite(weeklyPct) && weeklyPct > 0) {
    const weeklyReset = resolveReset('weekly-resets-in', 'weekly-resets-at', tz);
    if (!weeklyReset) {
      console.error('ใส่ --weekly แล้วต้องใส่ --weekly-resets-in (เช่น 2d) ด้วย');
      process.exit(1);
    }
    const weeklyStart = weeklyReset - 7 * DAY;
    const wCost = events
      .filter((e) => { const t = new Date(e.ts).getTime(); return t >= weeklyStart && t < weeklyReset; })
      .reduce((s, e) => s + e.cost, 0);
    if (wCost > 0) {
      cal.weekly = {
        pct: weeklyPct, reset: weeklyReset, start: weeklyStart,
        localCost: wCost, capCost: wCost / (weeklyPct / 100),
      };
    } else {
      console.warn('ข้าม weekly: ไม่พบการใช้งานในช่วง 7 วันที่ระบุ');
    }
  }

  const prev = loadCalibration(ROOT);
  fs.writeFileSync(path.join(ROOT, CALIBRATION_FILE), JSON.stringify(cal, null, 2));

  const fmt = (n) => '$' + n.toFixed(2);
  console.log('ปรับเทียบเรียบร้อย\n');
  console.log(`  หน้าต่าง 5 ชม. : ${new Date(sessionStart).toLocaleTimeString('th-TH', { timeZone: tz, hour12: false })}`
    + ` -> ${new Date(sessionReset).toLocaleTimeString('th-TH', { timeZone: tz, hour12: false })}`);
  console.log(`  ใช้ไปในเครื่องนี้: ${fmt(localCost)}  =  ${sessionPct}% ตามของจริง`);
  console.log(`  เพดานที่ถอดได้   : ${fmt(cal.session.capCost)}`);
  if (prev?.session) {
    console.log(`  เพดานเดิม        : ${fmt(prev.session.capCost)}`
      + `  (${cal.session.capCost > prev.session.capCost ? '+' : ''}`
      + `${((cal.session.capCost / prev.session.capCost - 1) * 100).toFixed(0)}%)`);
  }
  if (cal.weekly) {
    console.log(`\n  รายสัปดาห์      : ใช้ไป ${fmt(cal.weekly.localCost)} = ${weeklyPct}%`
      + ` -> เพดาน ${fmt(cal.weekly.capCost)}`);
  }
  console.log(`\nบันทึกลง ${CALIBRATION_FILE} แล้ว — รัน "node src/sync.js --force" เพื่อให้เว็บใช้ค่าใหม่`);
}

// ไฟล์นี้ถูก import โดย sync.js เพื่อใช้ loadCalibration ด้วย
// จึงต้องรัน CLI เฉพาะตอนถูกเรียกตรง ๆ ไม่งั้น sync จะเด้ง usage ออกมาแล้วตาย
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((e) => { console.error('ปรับเทียบล้มเหลว:', e.message); process.exit(1); });
}
