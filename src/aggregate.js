// รวมยอดจาก event ดิบ -> โครงสร้างที่ dashboard ใช้

const HOUR = 3600_000;
const WINDOW_MS = 5 * HOUR;
const TEN_MIN = 10 * 60_000;

const zero = () => ({
  events: 0, input: 0, output: 0, thinking: 0,
  cacheWrite: 0, cacheRead: 0, cost: 0,
});

function add(acc, e) {
  acc.events += 1;
  acc.input += e.input;
  acc.output += e.output;
  acc.thinking += e.thinking;
  acc.cacheWrite += e.cacheWrite5m + e.cacheWrite1h;
  acc.cacheRead += e.cacheRead;
  acc.cost += e.cost;
  return acc;
}

function dayKey(ts, tz) {
  // en-CA ให้รูปแบบ YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(ts));
}

/**
 * แบ่ง event เป็นหน้าต่าง 5 ชั่วโมงตามกติกาที่ calibrate จาก log จริง:
 * หน้าต่างเริ่มที่ event แรกหลังหน้าต่างก่อนหน้าหมดอายุ ปัดลงเป็นนาทีลงท้าย 0
 * แล้วหมดอายุอีก 5 ชั่วโมงถัดมา
 */
export function buildWindows(events) {
  const windows = [];
  let cur = null;
  for (const e of events) {
    const t = new Date(e.ts).getTime();
    if (!cur || t >= cur.reset) {
      const start = Math.floor(t / TEN_MIN) * TEN_MIN;
      cur = { start, reset: start + WINDOW_MS, hitLimit: false, ...zero() };
      windows.push(cur);
    }
    add(cur, e);
  }
  return windows;
}

/**
 * ประเมินเพดานของหน้าต่าง 5 ชม. จากประวัติจริง
 *
 * ทุกหน้าต่างที่ผ่านมาเป็น "ขอบล่าง" ของเพดานทั้งสิ้น — ถ้าเคยใช้ถึง X ได้
 * เพดานจริงย่อมไม่น้อยกว่า X จึงใช้ค่าสูงสุดที่เคยใช้เป็นตัวประมาณ
 * ห้ามใช้ค่าต่ำสุดของหน้าต่างที่ชนลิมิต เพราะหน้าต่างนั้นอาจถูกเติมเต็ม
 * ด้วยการใช้งานจากเครื่องอื่นที่ log นี้มองไม่เห็น
 */
export function estimateCap(windows) {
  if (!windows.length) return { cost: 1, basis: 'no-data', samples: 0, confident: false };
  const top = windows.reduce((m, w) => (w.cost > m.cost ? w : m), windows[0]);
  return {
    cost: top.cost || 1,
    basis: top.hitLimit ? 'hit' : 'lower-bound',
    // ถ้าหน้าต่างที่ใช้มากสุดคือหน้าต่างที่ชนลิมิตพอดี แปลว่าเพดานจริงอยู่ใกล้ค่านี้
    confident: top.hitLimit,
    samples: windows.filter((w) => w.hitLimit).length,
    windows: windows.length,
  };
}

export function aggregate({ events, quota, tz, label, plan }) {
  const windows = buildWindows(events);

  // ผูกเหตุการณ์ชนลิมิตเข้ากับหน้าต่างที่มันเกิด
  for (const q of quota) {
    if (q.status !== 'rejected') continue;
    const t = new Date(q.ts).getTime();
    const w = windows.find((x) => t >= x.start && t < x.reset);
    if (w) {
      w.hitLimit = true;
      if (q.resetsAt) w.reset = q.resetsAt; // เวลาจากเซิร์ฟเวอร์เชื่อถือได้กว่าที่คำนวณเอง
    }
  }

  const cap = estimateCap(windows);

  const dailyMap = new Map();
  const modelMap = new Map();
  const projectMap = new Map();

  for (const e of events) {
    const d = dayKey(e.ts, tz);
    if (!dailyMap.has(d)) dailyMap.set(d, { date: d, byModel: {}, ...zero() });
    const day = dailyMap.get(d);
    add(day, e);
    day.byModel[e.model] = (day.byModel[e.model] ?? 0) + e.cost;

    if (!modelMap.has(e.model)) modelMap.set(e.model, { model: e.model, ...zero() });
    add(modelMap.get(e.model), e);

    if (!projectMap.has(e.project)) projectMap.set(e.project, { project: e.project, ...zero() });
    add(projectMap.get(e.project), e);
  }

  const now = Date.now();
  const last = windows[windows.length - 1];
  const active = last && now < last.reset ? last : null;

  const totals = events.reduce(add, zero());

  // เติมวันที่ไม่มีการใช้งานให้ครบ 30 วันย้อนหลัง กราฟจะได้ไม่บีบวันว่างทิ้ง
  const daily = [];
  for (let i = 29; i >= 0; i--) {
    const d = dayKey(now - i * 24 * HOUR, tz);
    daily.push(dailyMap.get(d) ?? { date: d, byModel: {}, ...zero() });
  }
  // วันที่เก่ากว่า 30 วันยังเก็บไว้ท้าย totals แต่ไม่ใส่ในกราฟ
  const olderDays = [...dailyMap.keys()].filter((d) => d < daily[0].date).length;

  // 7 วันล่าสุดตามวันปฏิทินของโซนเวลาที่ตั้งไว้
  const last7 = daily.slice(-7).reduce(
    (acc, d) => { acc.cost += d.cost; acc.events += d.events; return acc; },
    { cost: 0, events: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    label,
    plan,
    tz,
    olderDaysNotCharted: olderDays,
    source: {
      note: 'นับเฉพาะ session ที่รันบนเครื่องนี้ — การใช้งานผ่านเว็บหรือเครื่องอื่นไม่ถูกรวม',
      firstTs: events.length ? events[0].ts : null,
      lastTs: events.length ? events[events.length - 1].ts : null,
    },
    totals,
    cap,
    current: active
      ? {
          start: active.start,
          reset: active.reset,
          cost: active.cost,
          events: active.events,
          input: active.input,
          output: active.output,
          cacheWrite: active.cacheWrite,
          cacheRead: active.cacheRead,
          pct: cap.cost > 0 ? Math.min(1, active.cost / cap.cost) : 0,
          hitLimit: active.hitLimit,
        }
      : null,
    last7,
    daily,
    windows: windows.slice(-40),
    byModel: [...modelMap.values()].sort((a, b) => b.cost - a.cost),
    byProject: [...projectMap.values()].sort((a, b) => b.cost - a.cost),
    quota: quota.slice(-20),
  };
}
