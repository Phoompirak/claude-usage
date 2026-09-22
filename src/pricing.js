// ราคาต่อ 1M token (USD) — อัตรา Anthropic first-party API, ปรับปรุง 2026-09
//
// หมายเหตุ: บัญชี subscription (Pro/Max) ไม่ได้ถูกคิดเงินต่อ token จริง
// ตัวเลข cost ที่ dashboard แสดงคือ "มูลค่าเทียบเท่าถ้าจ่ายแบบ API"
// ใช้เป็นตัวชี้วัดปริมาณการใช้งาน ไม่ใช่ยอดเรียกเก็บจริง

const BASE = {
  'claude-opus-5':    { in: 5.0,  out: 25.0 },
  'claude-opus-4-8':  { in: 5.0,  out: 25.0 },
  'claude-opus-4-7':  { in: 5.0,  out: 25.0 },
  'claude-opus-4-6':  { in: 5.0,  out: 25.0 },
  'claude-sonnet-5':  { in: 2.0,  out: 10.0 },
  'claude-sonnet-4-6':{ in: 3.0,  out: 15.0 },
  'claude-haiku-4-5': { in: 1.0,  out: 5.0 },
  'claude-fable-5':   { in: 10.0, out: 50.0 },
  'claude-fable-5-1': { in: 10.0, out: 50.0 },
};

// ตัวคูณมาตรฐานของ prompt caching
const CACHE_WRITE_5M = 1.25; // เขียน cache อายุ 5 นาที = 1.25x input
const CACHE_WRITE_1H = 2.0;  // เขียน cache อายุ 1 ชั่วโมง = 2x input
const CACHE_READ     = 0.1;  // อ่าน cache = 0.1x input

const FALLBACK = { in: 5.0, out: 25.0 };

export function rateFor(model) {
  if (BASE[model]) return BASE[model];
  // เผื่อ model id ที่ยังไม่รู้จัก เดาจาก family เพื่อไม่ให้ค่าเป็น 0
  if (typeof model === 'string') {
    if (model.includes('haiku'))  return BASE['claude-haiku-4-5'];
    if (model.includes('sonnet')) return BASE['claude-sonnet-5'];
    if (model.includes('fable') || model.includes('mythos')) return BASE['claude-fable-5-1'];
    if (model.includes('opus'))   return BASE['claude-opus-5'];
  }
  return FALLBACK;
}

export function isPriced(model) {
  return Boolean(BASE[model]);
}

/**
 * คำนวณค่าใช้จ่ายเทียบเท่า API ของ usage หนึ่งก้อน
 * @param {string} model
 * @param {{input:number,output:number,cacheWrite5m:number,cacheWrite1h:number,cacheRead:number}} t
 * @returns {number} USD
 */
export function costOf(model, t) {
  const r = rateFor(model);
  const M = 1_000_000;
  return (
    (t.input        * r.in)                    +
    (t.output       * r.out)                   +
    (t.cacheWrite5m * r.in * CACHE_WRITE_5M)   +
    (t.cacheWrite1h * r.in * CACHE_WRITE_1H)   +
    (t.cacheRead    * r.in * CACHE_READ)
  ) / M;
}

export const MODELS = Object.keys(BASE);
