# claude-usage

Dashboard ส่วนตัวสำหรับดูการใช้งาน Claude Code จากที่ไหนก็ได้ ไม่ต้องล็อกอินบัญชี Claude หรืออีเมล

เครื่องนี้อ่าน log ของ Claude Code ในเครื่อง → สรุปยอด → **เข้ารหัส** → push ขึ้น GitHub Pages
เปิดหน้าเว็บจากมือถือ ใส่รหัสผ่านที่ตั้งเอง แล้วดูได้ทันที

---

## แพลตฟอร์มที่รองรับ

| แพลตฟอร์ม | แหล่งข้อมูล | ดึงอัตโนมัติ |
|---|---|---|
| Claude Code | log ในเครื่อง `~/.claude/projects` | ✅ |
| ChatGPT / OpenAI | Usage API + Cost API (ต้องมี Admin key) | ✅ เฉพาะฝั่ง **API platform** |
| Gemini | — | ❌ ไม่มี endpoint บอก usage |
| Consensus | — | ❌ ไม่มี public API |
| SciSpace | — | ❌ ไม่มี public API |

ตัวที่ดึงไม่ได้ กรอกตัวเลขเองได้ใน `manual.json` (ดูตัวอย่างที่ `manual.example.json`)

> **ChatGPT Plus/Team ไม่มี API บอกโควต้าข้อความ** — Usage API ของ OpenAI รายงานเฉพาะการเรียก API
> ผ่าน platform.openai.com ซึ่งเป็นคนละกระเป๋ากับ subscription

---

## สิ่งที่ดูได้ (Claude Code)

| ส่วน | รายละเอียด |
|---|---|
| หน้าต่าง 5 ชั่วโมง | ใช้ไปกี่ % ของเพดาน · เหลือเวลาอีกเท่าไหร่ก่อนรีเซ็ต |
| ค่าใช้จ่ายรายวัน | กราฟ 30 วันล่าสุด (สลับดูเป็นตารางได้) |
| แยกตามโมเดล | Opus / Sonnet / Haiku |
| แยกตามโปรเจกต์ | เรียงจากใช้มากไปน้อย |
| ประวัติชนลิมิต | หน้าต่างไหนเคยชนลิมิตจริง พร้อมเวลารีเซ็ต |

---

## ข้อจำกัดที่ต้องรู้ก่อนใช้

**0. ตัวเลขสดได้เท่าที่เครื่องที่ sync ยังเปิดอยู่**
ปิดคอมแล้วเว็บยังเปิดดูได้ (GitHub เป็นคนโฮสต์) แต่ตัวเลขจะค้างที่ค่าล่าสุดก่อนปิด
ถ้าข้อมูลเก่ากว่า 25 นาที หน้าเว็บจะขึ้นแถบเตือนสีส้มบอกว่าเงียบไปนานเท่าไหร่
เปิดเครื่องกลับมาแล้ว sync จะตามเก็บ log ย้อนหลังให้เองครบ ไม่มีข้อมูลหาย

**1. Anthropic ไม่มี public API บอกโควต้าคงเหลือ**
คำสั่ง `/usage` ใน Claude Code เรียก endpoint ภายในด้วย OAuth token ที่เก็บใน Windows Credential Manager
โปรเจกต์นี้ **ไม่แตะ credential** เลย — ตัวเลข "เหลือเท่าไหร่" จึงเป็นการ*ประมาณ*จาก log แทน

เพดานถูกประมาณจากหน้าต่างที่**เคยชนลิมิตจริง** (log เก็บ `quotaLimits` ไว้ตอนโดน 429)
ยิ่งใช้ไปนานยิ่งแม่นขึ้น หน้าเว็บจะบอกตรง ๆ ว่าตัวเลขมาจากฐานไหน

**2. นับเฉพาะ session ที่รันบนเครื่องนี้**
ใช้ Claude ผ่านเว็บ มือถือ หรือคอมเครื่องอื่น จะไม่ถูกรวม

พิสูจน์แล้วด้วยของจริง: 22 ก.ย. เซิร์ฟเวอร์บอกว่าหน้าต่าง 5 ชม. เริ่ม 10:40
แต่ event แรกบนเครื่องนี้คือ 11:40 — ชั่วโมงนั้นเกิดที่อื่นและมองไม่เห็น

**3. ตัวเลข `$` คือมูลค่าเทียบเท่าอัตรา API ไม่ใช่ยอดเรียกเก็บจริง**
แพ็กเกจ Pro/Max คิดเป็นรายเดือน ไม่ได้คิดต่อ token — ตัวเลขนี้ใช้วัด*ปริมาณ*การใช้งาน

---

## ติดตั้ง

### 1. ตั้งรหัสผ่าน

```bash
cp .env.local.example .env.local
```

แก้ `.env.local`:

```
CU_PASSPHRASE=<ตั้งรหัสยาว ๆ ตามใจ — ใช้รหัสนี้เปิดดูหน้าเว็บ>
CU_LABEL=อีเมลหรือชื่อที่อยากให้โชว์
CU_PLAN=pro
CU_TZ=Asia/Bangkok
```

`.env.local` อยู่ใน `.gitignore` ไม่ถูก push ขึ้นไป

### 2. ทดสอบก่อน push

```bash
npm run sync:nopush
```

ควรเห็นบรรทัดสรุป เช่น `สแกน 4 ไฟล์ ... หน้าต่างปัจจุบัน 4.1% | รวม $207.34`

### 3. ต่อกับ GitHub Pages

```bash
gh auth login                                  # ถ้ายังไม่เคยล็อกอิน
gh repo create claude-usage --public --source=. --remote=origin
git add -A && git commit -m "init"
git push -u origin master
gh api -X POST repos/:owner/claude-usage/pages -f build_type=legacy \
  -f 'source[branch]=master' -f 'source[path]=/docs'
```

> repo ต้องเป็น **public** ถ้าบัญชีไม่ใช่ GitHub Pro (Pages จาก private repo เป็นฟีเจอร์เสียเงิน)
> ข้อมูลที่ push ขึ้นไปเป็น ciphertext ล้วน — ตัวเลข ชื่อโปรเจกต์ และอีเมล อ่านไม่ได้ถ้าไม่มีรหัส

URL จริงของโปรเจกต์นี้: https://phoompirak.github.io/claude-usage/

### 4. ตั้งให้อัปเดตเอง

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-task.ps1
```

ตั้ง Scheduled Task รันทุก 10 นาที แบบไม่มีหน้าต่างเด้ง
เปลี่ยนรอบได้ด้วย `-IntervalMinutes 15` · ถอนออกด้วย `-Uninstall`

---

## ใช้งานประจำวัน

ปกติ**ไม่ต้องทำอะไรเลย** — Scheduled Task sync ให้ทุก 10 นาที แค่เปิด URL ดู

บนหน้าเว็บมีปุ่ม **↻** มุมขวาบน กดเพื่อโหลดไฟล์ล่าสุดจากเซิร์ฟเวอร์ทันที
หน้าเว็บยังดึงให้เองเงียบ ๆ ทุก 5 นาที และทุกครั้งที่กลับมาเปิดแท็บ

> ปุ่มนี้โหลด**ไฟล์ที่ PC sync ไว้ล่าสุด** ไม่ได้สั่งให้ PC sync ใหม่ — GitHub Pages เป็น static host รันอะไรไม่ได้
> ถ้ากดแล้วขึ้น `ข้อมูลใหม่สุดแล้ว` แปลว่าต้องรอ PC sync รอบถัดไป

### เช็คว่ายังทำงานปกติไหม

```powershell
Get-Content .cache\sync.log -Tail 6
```

บรรทัดที่ควรเห็น:

```
[Tue 09/22/2026 13:40:00]
สแกน 4 ไฟล์ (+21 บรรทัดใหม่) -> 1725 ข้อความ | หน้าต่างปัจจุบัน 24.1% | รวม $220.51
แพลตฟอร์ม: Claude=ok · ChatGPT=no-key · ...
push ขึ้น https://github.com/... (master) เรียบร้อย
```

ถ้าเห็นคำว่า `sync ล้มเหลว:` ให้อ่านข้อความต่อท้าย — บอกสาเหตุตรง ๆ

### ปรับเทียบตัวเลขกับของจริง (สำคัญที่สุด)

log ในเครื่องบอกได้แค่ "ใช้ไปเท่าไหร่" ไม่บอก "เพดานอยู่ตรงไหน"
ถ้าไม่ปรับเทียบ ตัวเลข % จะคลาดมาก — ครั้งแรกที่วัดจริง: แสดง **32%** ทั้งที่ของจริง **55%**

เปิด `/usage` ใน Claude Code อ่านเลขมาใส่:

```powershell
node src/calibrate.js --session 55 --resets-in 1h --weekly 18 --weekly-resets-in 2d
node src/sync.js --force
```

| อาร์กิวเมนต์ | คือ |
|---|---|
| `--session` | % ของ Session (5hr) |
| `--resets-in` / `--resets-at` | `1h` `90m` หรือเวลานาฬิกา `15:40` |
| `--weekly` | % ของ Weekly (7 day) — ไม่ใส่ก็ได้ |
| `--weekly-resets-in` | เช่น `2d` |

สูตร: **เพดาน = ยอดที่ใช้ในเครื่องนี้ ÷ เปอร์เซ็นต์จริง**

ควรปรับเทียบใหม่ทุก 1-2 วัน หน้าเว็บจะเตือนเองเมื่อค่าเก่าเกิน 48 ชม.
ยิ่งใช้ Claude จากมือถือหรือเครื่องอื่นมาก ยิ่งต้องปรับเทียบบ่อย
เพราะการปรับเทียบจะดูดส่วนที่มองไม่เห็นนั้นเข้าไปเฉลี่ยในเพดาน

### สั่ง sync เดี๋ยวนี้

```powershell
node src/sync.js --force
```

`--force` จำเป็นเมื่อ**ไม่มีข้อความใหม่**แต่ยังอยากให้ push (เช่น เปลี่ยนรหัส แก้หน้าเว็บ แก้ manual.json)

### บันทึกการใช้แพลตฟอร์มที่ไม่มี API

สร้าง `manual.json` (คัดลอกจาก `manual.example.json`) แล้วใส่จำนวนครั้งต่อวัน:

```json
{
  "gemini":    { "2026-09-22": 12, "2026-09-23": 8 },
  "consensus": { "2026-09-22": 3 },
  "scispace":  { "2026-09-22": 5 }
}
```

แล้วรัน `node src/sync.js --force` การ์ดจะอัปเดตตาม
ไฟล์นี้อยู่ใน `.gitignore` — ไม่ขึ้น GitHub แบบอ่านได้ ตัวเลขไปโผล่ในไฟล์เข้ารหัสเท่านั้น

### เปิดใช้ตัวเลข OpenAI

1. สร้าง Admin key ที่ https://platform.openai.com/settings/organization/admin-keys
2. ใส่ใน `.env.local`: `OPENAI_ADMIN_KEY=sk-admin-...`
3. `node src/sync.js --force`

### จัดการ Scheduled Task

```powershell
Get-ScheduledTaskInfo -TaskName ClaudeUsageSync          # ดูรอบล่าสุด
Start-ScheduledTask   -TaskName ClaudeUsageSync          # สั่งรันเดี๋ยวนี้
Disable-ScheduledTask -TaskName ClaudeUsageSync          # พักไว้ก่อน
Enable-ScheduledTask  -TaskName ClaudeUsageSync          # เปิดกลับ
powershell -File scripts\install-task.ps1 -IntervalMinutes 30   # เปลี่ยนรอบ
powershell -File scripts\install-task.ps1 -Uninstall            # ถอนออก
```

### ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `npm : ... running scripts is disabled` | PowerShell บล็อก `.ps1` — ใช้ `node src/sync.js` หรือ `npm.cmd` แทน |
| เว็บขึ้น "รหัสผ่านไม่ถูกต้อง" ทั้งที่รหัสถูก | เบราว์เซอร์จำรหัสเก่า — กดปุ่ม **ล็อก** มุมขวาบน แล้วใส่ใหม่ |
| ตัวเลขบนเว็บไม่ขยับ | ดู `.cache\sync.log` · ถ้าไม่มีบรรทัดใหม่เลย แปลว่า Task ไม่ได้รัน |
| แก้ `.env.local` แล้วไม่มีผล | ยังไม่ได้กด Ctrl+S |
| sync บอก "ไม่มีข้อความใหม่" | ปกติ — ใช้ `--force` ถ้าต้องการบังคับ push |

---

## โครงสร้าง

```
src/pricing.js    ตารางราคาต่อ 1M token + สูตรคิดค่า cache
src/scan.js       อ่าน ~/.claude/projects/**/*.jsonl แบบ incremental (จำ byte offset)
src/aggregate.js  แบ่งหน้าต่าง 5 ชม. · ประมาณเพดาน · สรุปรายวัน/โมเดล/โปรเจกต์
src/platforms.js  ประกอบการ์ดของทุกแพลตฟอร์มให้รูปแบบเดียวกัน
src/providers/openai.js  ดึง OpenAI Usage API + Cost API
src/calibrate.js  ปรับเทียบเพดานกับแผง /usage ของจริง (CLI)
src/encrypt.js    AES-256-GCM + PBKDF2 (250k รอบ, SHA-256)
src/sync.js       ร้อยทุกอย่างเข้าด้วยกัน แล้ว commit + push
docs/index.html   dashboard หน้าเดียว ถอดรหัสด้วย WebCrypto ในเบราว์เซอร์
docs/data.enc.json  ไฟล์เดียวที่ข้อมูลอยู่ — ciphertext ล้วน
```

### กติกาหน้าต่าง 5 ชั่วโมง

calibrate จากเหตุการณ์ชนลิมิตจริงใน log:

> หน้าต่างเริ่มที่ข้อความแรกหลังหน้าต่างก่อนหน้าหมดอายุ **ปัดลงเป็นนาทีลงท้าย 0**
> แล้วหมดอายุอีก 5 ชั่วโมงถัดมา

ตรงกับ `resetsAt` ที่เซิร์ฟเวอร์ส่งกลับมา เมื่อการใช้งานทั้งหน้าต่างเกิดบนเครื่องนี้
ถ้ามีการใช้งานจากเครื่องอื่นปนอยู่ ค่าที่คำนวณจะต่ำกว่าความจริง

---

## ความปลอดภัย

- ไฟล์ที่ push ขึ้น public URL มีแต่ ciphertext (AES-256-GCM, คีย์จาก PBKDF2 250,000 รอบ)
- **ความแข็งแรงขึ้นกับความยาวรหัสล้วน ๆ** — ไฟล์อยู่บน public URL ใครก็โหลดไปลองเดาแบบออฟไลน์ได้ไม่จำกัดครั้ง ถ้ารหัสสั้นกว่า 12 ตัว sync จะเตือนทุกครั้งแต่ไม่ห้าม
- รหัสผ่านไม่เคยถูกส่งขึ้นเครือข่าย — ถอดรหัสในเบราว์เซอร์ทั้งหมด
- ถ้าติ๊ก "จำรหัสไว้" รหัสจะอยู่ใน `localStorage` ของเบราว์เซอร์นั้นเท่านั้น กดปุ่ม **ล็อก** เพื่อลบ
- **เปลี่ยนรหัสผ่าน** = แก้ `.env.local` แล้ว `node src/sync.js --force` (snapshot เก่าใน git history ยังเปิดด้วยรหัสเดิมได้ ถ้ากังวลให้สร้าง repo ใหม่)
- โปรเจกต์นี้ไม่อ่านและไม่เก็บ credential ของบัญชี Claude
