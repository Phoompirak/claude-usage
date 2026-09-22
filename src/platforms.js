// ประกอบข้อมูลของทุกแพลตฟอร์มให้อยู่ในรูปแบบเดียวกัน เพื่อให้หน้าเว็บวาดการ์ดได้เหมือนกันหมด
//
// แต่ละแพลตฟอร์มมี "แหล่งข้อมูล" ต่างกัน และนี่คือความจริงที่เปลี่ยนไม่ได้:
//
//   auto   = ดึงตัวเลขจริงได้เอง
//   manual = ไม่มี API ต้องกรอกเองใน manual.json
//   link   = ไม่มีทั้ง API และตัวเลข เหลือแค่ลิงก์เปิดใช้งาน
//
// ถ้าวันหนึ่งแพลตฟอร์มไหนเปิด API ขึ้นมา ให้ย้ายจาก manual/link เป็น auto
// แล้วเขียน provider เพิ่มใน src/providers/

import fs from 'node:fs';
import path from 'node:path';

/** ทะเบียนแพลตฟอร์ม — เรียงตามลำดับที่อยากให้แสดง */
export const REGISTRY = [
  {
    id: 'claude',
    name: 'Claude',
    tagline: 'อ่านเอกสารยาว วิเคราะห์ และเขียนงานเป็นโครงสร้าง',
    kind: 'CHAT',
    tier: 'Pro',
    url: 'https://claude.ai/',
    source: 'auto',
    sourceNote: 'อ่าน log ของ Claude Code ในเครื่องนี้',
    accent: '#eb6834',
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    tagline: 'คุย วิเคราะห์ไฟล์ สร้างคอนเทนต์ และช่วยเขียน',
    kind: 'CHAT',
    tier: 'Plus / Team',
    url: 'https://chatgpt.com/',
    source: 'auto',
    sourceNote: 'ดึงจาก OpenAI Usage API — เป็นยอดฝั่ง API platform ไม่ใช่โควต้าข้อความของ Plus',
    accent: '#1baf7a',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    tagline: 'ผู้ช่วยของ Google สำหรับค้นคว้า สรุป และทำงานกับบัญชี Google',
    kind: 'CHAT',
    tier: 'Advanced',
    url: 'https://gemini.google.com/',
    source: 'manual',
    sourceNote: 'Gemini API มีแค่ countTokens ไม่มี endpoint บอก usage หรือโควต้าคงเหลือ',
    accent: '#2a78d6',
  },
  {
    id: 'consensus',
    name: 'Consensus',
    tagline: 'หาคำตอบอิงหลักฐานจากงานวิจัยและบทความวิชาการ',
    kind: 'RESEARCH',
    tier: 'Pro',
    url: 'https://consensus.app/',
    source: 'manual',
    sourceNote: 'ไม่มี public API',
    accent: '#008300',
  },
  {
    id: 'scispace',
    name: 'SciSpace',
    tagline: 'อ่าน อธิบาย และจัดการเปเปอร์วิชาการ',
    kind: 'RESEARCH',
    tier: 'Premium',
    url: 'https://typeset.io/',
    source: 'manual',
    sourceNote: 'ไม่มี public API',
    accent: '#4a3aa7',
  },
];

/** โหลดตัวเลขที่กรอกเอง — รูปแบบ { platformId: { "YYYY-MM-DD": จำนวนครั้ง } } */
export function loadManual(root) {
  const file = path.join(root, 'manual.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

function sumManual(byDate, sinceDate) {
  let total = 0;
  let recent = 0;
  for (const [d, n] of Object.entries(byDate ?? {})) {
    const v = Number(n) || 0;
    total += v;
    if (d >= sinceDate) recent += v;
  }
  return { total, recent };
}

/**
 * รวมทุกแพลตฟอร์มเป็น array เดียวให้หน้าเว็บใช้
 * @param {{claude:object, openai:object, manual:object, tz:string}} input
 */
export function buildPlatforms({ claude, openai, manual, tz }) {
  const now = Date.now();
  const dayKey = (ms) => new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ms));
  const since7 = dayKey(now - 6 * 86_400_000);

  return REGISTRY.map((p) => {
    const card = {
      id: p.id, name: p.name, tagline: p.tagline, kind: p.kind, tier: p.tier,
      url: p.url, source: p.source, sourceNote: p.sourceNote, accent: p.accent,
    };

    if (p.id === 'claude') {
      return {
        ...card,
        status: 'ok',
        headline: claude.current ? Math.round(claude.current.pct * 100) + '%' : '—',
        headlineLabel: 'ของหน้าต่าง 5 ชม.',
        stats: [
          { k: '7 วันล่าสุด', v: '$' + claude.last7.cost.toFixed(2) },
          { k: 'ข้อความ 7 วัน', v: String(claude.last7.events) },
        ],
      };
    }

    if (p.id === 'openai') {
      if (openai.status !== 'ok') {
        return {
          ...card,
          status: openai.status,
          message: openai.message ?? null,
          headline: '—',
          headlineLabel: openai.status === 'no-key' ? 'ยังไม่ได้ใส่ Admin key' : 'ดึงข้อมูลไม่ได้',
          stats: [],
        };
      }
      const last7 = openai.daily.filter((d) => d.date >= since7);
      return {
        ...card,
        status: 'ok',
        note: openai.note,
        headline: '$' + openai.totals.cost.toFixed(2),
        headlineLabel: 'ค่าใช้จ่าย API 30 วัน',
        stats: [
          { k: '7 วันล่าสุด', v: '$' + last7.reduce((s, d) => s + d.cost, 0).toFixed(2) },
          { k: 'คำขอทั้งหมด', v: String(openai.totals.requests) },
        ],
        daily: openai.daily,
        byModel: openai.byModel,
      };
    }

    // manual / link
    const { total, recent } = sumManual(manual[p.id], since7);
    return {
      ...card,
      status: total > 0 ? 'manual' : 'no-data',
      headline: total > 0 ? String(total) : '—',
      headlineLabel: total > 0 ? 'ครั้งที่บันทึกเอง' : 'ไม่มีแหล่งข้อมูล',
      stats: total > 0 ? [{ k: '7 วันล่าสุด', v: String(recent) }] : [],
    };
  });
}
