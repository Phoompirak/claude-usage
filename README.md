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

**1. Anthropic ไม่มี public API บอกโควต้าคงเหลือ**
คำสั่ง `/usage` ใน Claude Code เรียก endpoint ภายในด้วย OAuth token ที่เก็บใน Windows Credential Manager
โปรเจกต์นี้ **ไม่แตะ credential** เลย — ตัวเลข "เหลือเท่าไหร่" จึงเป็นการ*ประมาณ*จาก log แทน

เพดานถูกประมาณจากหน้าต่างที่**เคยชนลิมิตจริง** (log เก็บ `quotaLimits` ไว้ตอนโดน 429)
ยิ่งใช้ไปนานยิ่งแม่นขึ้น หน้าเว็บจะบอกตรง ๆ ว่าตัวเลขมาจากฐานไหน

**2. นับเฉพาะ session ที่รันบนเครื่องนี้**
ใช้ Claude ผ่านเว็บ มือถือ หรือคอมเครื่องอื่น จะไม่ถูกรวม

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

## โครงสร้าง

```
src/pricing.js    ตารางราคาต่อ 1M token + สูตรคิดค่า cache
src/scan.js       อ่าน ~/.claude/projects/**/*.jsonl แบบ incremental (จำ byte offset)
src/aggregate.js  แบ่งหน้าต่าง 5 ชม. · ประมาณเพดาน · สรุปรายวัน/โมเดล/โปรเจกต์
src/platforms.js  ประกอบการ์ดของทุกแพลตฟอร์มให้รูปแบบเดียวกัน
src/providers/openai.js  ดึง OpenAI Usage API + Cost API
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
- รหัสผ่านไม่เคยถูกส่งขึ้นเครือข่าย — ถอดรหัสในเบราว์เซอร์ทั้งหมด
- ถ้าติ๊ก "จำรหัสไว้" รหัสจะอยู่ใน `localStorage` ของเบราว์เซอร์นั้นเท่านั้น กดปุ่ม **ล็อก** เพื่อลบ
- **เปลี่ยนรหัสผ่าน** = แก้ `.env.local` แล้ว `npm run sync` ใหม่ (snapshot เก่าใน git history ยังเปิดด้วยรหัสเดิมได้ ถ้ากังวลให้สร้าง repo ใหม่)
- โปรเจกต์นี้ไม่อ่านและไม่เก็บ credential ของบัญชี Claude
