// ดึง usage จาก OpenAI Usage API + Cost API
//
// ⚠️ สำคัญ: API นี้รายงานการใช้งานของ **API platform** (platform.openai.com) เท่านั้น
// ไม่ใช่โควต้าข้อความของบัญชี ChatGPT Plus/Team — OpenAI ไม่เปิด API ให้ดูส่วนนั้น
//
// ต้องใช้ Admin API key (ขึ้นต้น sk-admin-...) สร้างที่
// https://platform.openai.com/settings/organization/admin-keys
// key ธรรมดา (sk-proj-...) เรียก endpoint กลุ่ม organization ไม่ได้

const BASE = 'https://api.openai.com/v1/organization';
const DAY = 86_400_000;

async function getJSON(url, key) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = body.slice(0, 200);
    throw err;
  }
  return res.json();
}

/** ไล่ page ให้ครบ — endpoint ทั้งสองใช้ next_page แบบเดียวกัน */
async function getAllBuckets(path, params, key) {
  const buckets = [];
  let page = null;
  for (let guard = 0; guard < 20; guard++) {
    const q = new URLSearchParams(params);
    if (page) q.set('page', page);
    const j = await getJSON(`${BASE}${path}?${q}`, key);
    buckets.push(...(j.data ?? []));
    if (!j.has_more || !j.next_page) break;
    page = j.next_page;
  }
  return buckets;
}

/**
 * @param {{key:string, days?:number, tz:string}} opts
 * @returns {Promise<object>} สรุป usage ในรูปแบบเดียวกับ provider อื่น
 */
export async function collectOpenAI({ key, days = 30, tz }) {
  if (!key) return { status: 'no-key' };
  if (!key.startsWith('sk-admin-')) {
    return {
      status: 'wrong-key-type',
      message: 'ต้องเป็น Admin API key (sk-admin-...) — key ธรรมดาเรียก endpoint นี้ไม่ได้',
    };
  }

  const startTime = Math.floor((Date.now() - days * DAY) / 1000);

  try {
    const [usageBuckets, costBuckets] = await Promise.all([
      getAllBuckets('/usage/completions', {
        start_time: String(startTime), bucket_width: '1d', limit: '31', group_by: 'model',
      }, key),
      getAllBuckets('/costs', {
        start_time: String(startTime), bucket_width: '1d', limit: '31',
      }, key),
    ]);

    const daily = new Map();
    const byModel = new Map();
    let input = 0, output = 0, cached = 0, requests = 0;

    const dayKey = (sec) => new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(sec * 1000));

    for (const b of usageBuckets) {
      const d = dayKey(b.start_time);
      if (!daily.has(d)) daily.set(d, { date: d, input: 0, output: 0, requests: 0, cost: 0 });
      const day = daily.get(d);
      for (const r of b.results ?? []) {
        const i = r.input_tokens ?? 0;
        const o = r.output_tokens ?? 0;
        const c = r.input_cached_tokens ?? 0;
        const n = r.num_model_requests ?? 0;
        input += i; output += o; cached += c; requests += n;
        day.input += i; day.output += o; day.requests += n;

        const m = r.model ?? 'unknown';
        if (!byModel.has(m)) byModel.set(m, { model: m, input: 0, output: 0, requests: 0, cost: 0 });
        const mm = byModel.get(m);
        mm.input += i; mm.output += o; mm.requests += n;
      }
    }

    // Cost API ให้ยอดเงินจริงที่ OpenAI คิด — แม่นกว่าการคำนวณเองจาก token
    let cost = 0;
    for (const b of costBuckets) {
      const d = dayKey(b.start_time);
      for (const r of b.results ?? []) {
        const v = r.amount?.value ?? 0;
        cost += v;
        if (daily.has(d)) daily.get(d).cost += v;
      }
    }

    return {
      status: 'ok',
      note: 'ตัวเลขนี้คือการใช้งาน API platform ไม่ใช่โควต้าข้อความของ ChatGPT Plus',
      totals: { input, output, cached, requests, cost },
      daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byModel: [...byModel.values()].sort((a, b) => b.requests - a.requests),
    };
  } catch (e) {
    if (e.status === 401) return { status: 'bad-key', message: 'key ไม่ถูกต้องหรือหมดอายุ' };
    if (e.status === 403) return { status: 'bad-key', message: 'key ไม่มีสิทธิ์อ่าน usage ขององค์กร' };
    return { status: 'error', message: `${e.message}${e.body ? ' — ' + e.body : ''}` };
  }
}
