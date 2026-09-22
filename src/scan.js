// อ่าน session log ของ Claude Code แบบ incremental
// แหล่งข้อมูล: ~/.claude/projects/<project-slug>/<session-id>.jsonl
// แต่ละไฟล์ต่อท้ายอย่างเดียว จึงจำ byte offset ที่อ่านไปแล้วไว้ใน .cache/state.json

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { costOf } from './pricing.js';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

function num(v) { return typeof v === 'number' && Number.isFinite(v) ? v : 0; }

/** แปลง cwd เป็นชื่อโปรเจกต์อ่านง่าย เช่น "C:\git\MWKConnect" -> "MWKConnect" */
function projectName(cwd, slug) {
  if (typeof cwd === 'string' && cwd.length) {
    const parts = cwd.split(/[\\/]/).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return slug;
}

/**
 * @param {{cacheDir:string}} opts
 * @returns {Promise<{events:Array, quota:Array, files:number, newLines:number}>}
 */
export async function scan({ cacheDir }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const statePath = path.join(cacheDir, 'state.json');
  const eventsPath = path.join(cacheDir, 'events.json');

  let state = { offsets: {} };
  let store = { events: [], quota: [] };
  try { state = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch { /* first run */ }
  try { store = JSON.parse(fs.readFileSync(eventsPath, 'utf8')); } catch { /* first run */ }

  const seen = new Set(store.events.map((e) => e.id));
  let files = 0;
  let newLines = 0;

  if (!fs.existsSync(PROJECTS_DIR)) {
    throw new Error(`ไม่พบโฟลเดอร์ log: ${PROJECTS_DIR}`);
  }

  for (const slug of fs.readdirSync(PROJECTS_DIR)) {
    const dir = path.join(PROJECTS_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) continue;

    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith('.jsonl')) continue;
      const file = path.join(dir, name);
      const size = fs.statSync(file).size;
      const key = `${slug}/${name}`;
      let from = num(state.offsets[key]);

      // ไฟล์หดลง = ถูกเขียนทับ/ตัดทิ้ง ให้อ่านใหม่ทั้งไฟล์
      if (size < from) from = 0;
      if (size === from) { files++; continue; }

      await new Promise((resolve, reject) => {
        const stream = fs.createReadStream(file, { start: from, encoding: 'utf8' });
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
        rl.on('line', (line) => {
          if (!line.trim()) return;
          newLines++;
          let j;
          try { j = JSON.parse(line); } catch { return; }

          // 1) เหตุการณ์ชนลิมิตจริง
          if (j.quotaLimits && j.quotaLimits.status) {
            store.quota.push({
              ts: j.timestamp,
              status: j.quotaLimits.status,
              type: j.quotaLimits.rateLimitType ?? null,
              resetsAt: num(j.quotaLimits.resetsAt) * 1000 || null,
              project: projectName(j.cwd, slug),
            });
          }

          // 2) การใช้ token
          if (j.type !== 'assistant') return;
          const m = j.message;
          if (!m || !m.usage || !m.id) return;
          if (m.model === '<synthetic>') return;   // ข้อความที่ไม่ได้เกิดจากการเรียกโมเดล
          if (seen.has(m.id)) return;              // กันนับซ้ำจาก streaming/replay
          seen.add(m.id);

          const u = m.usage;
          const cw1 = num(u.cache_creation?.ephemeral_1h_input_tokens);
          const cw5 = num(u.cache_creation?.ephemeral_5m_input_tokens);
          const cwTotal = num(u.cache_creation_input_tokens);
          const t = {
            input:        num(u.input_tokens),
            output:       num(u.output_tokens),
            cacheWrite1h: cw1,
            // ถ้า breakdown ไม่ครบ ให้ส่วนที่เหลือไปนับเป็น 5m (ถูกกว่า = ไม่ประเมินเกินจริง)
            cacheWrite5m: cw5 || Math.max(0, cwTotal - cw1),
            cacheRead:    num(u.cache_read_input_tokens),
          };

          store.events.push({
            id: m.id,
            ts: j.timestamp,
            model: m.model,
            sid: j.sessionId,
            project: projectName(j.cwd, slug),
            ...t,
            thinking: num(u.output_tokens_details?.thinking_tokens),
            cost: costOf(m.model, t),
          });
        });
        rl.on('close', resolve);
        rl.on('error', reject);
      });

      state.offsets[key] = size;
      files++;
    }
  }

  store.events.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
  store.quota.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  fs.writeFileSync(eventsPath, JSON.stringify(store));
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

  return { events: store.events, quota: store.quota, files, newLines };
}
