# HANDOVER — ระบบประมาณราคา / เสนอราคา / เบิกของ / ใบสั่งซื้อ (ZENSOCON Thailand)

เอกสารนี้ให้ AI/นักพัฒนาคนใหม่รับช่วงต่อได้ทันที **ห้ามใส่คีย์ลับหรือข้อมูลธุรกิจลงใน repo นี้ (เป็น public)**

## 1. ภาพรวม
- เว็บแอปไฟล์เดียว `index.html` (vanilla JS ไม่มี build step) ใช้งานจริงที่ https://nookky154789.github.io/quote-system/ (GitHub Pages ดีพลอยอัตโนมัติเมื่อ push `main`)
- หลังบ้าน = Supabase โปรเจกต์ `rdycjuuzehjcyrpbrgch` (Auth + Postgres + Storage bucket `ja-files` + Edge Functions)
- ผู้ใช้หลายคน ล็อกอินด้วย username/รหัสผ่าน สิทธิ์: admin / editor / viewer / custom (`profiles.perms`)
- แจ้งเตือนและอนุมัติผ่าน LINE Official Account (webhook + flex card)
- ผู้ใช้พูดภาษาไทย ตอบเป็นภาษาไทย กระชับ ไม่ซับซ้อน

## 2. โครงสร้างไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `index.html` | แอปทั้งหมด (CSS + JS) ~3,600 บรรทัด |
| `config.js` | URL + anon key ของ Supabase (anon key เปิดเผยได้ ความปลอดภัยอยู่ที่ RLS) |
| `supabase/schema.sql` | ตาราง + RLS |
| `supabase/functions/purchase-notify/` | สร้าง PDF ใบสั่งซื้อ (pdf-lib) อัปโหลด bucket `ja-files` แล้วส่ง flex card ทาง LINE |
| `supabase/functions/line-webhook/` | รับข้อความ/ปุ่มจาก LINE (เช็กสต๊อก, สร้างใบสั่งซื้อ, ผูกบัญชี) — `index.ts` + `stock.ts` |
| `supabase/functions/line-approve/` | ขอ/อนุมัติใบสั่งซื้อและใบเบิกผ่าน LINE |
| `pdfbom.js`, `vendor/`, `fonts/` | สร้าง PDF ฝั่งเว็บ ฟอนต์ไทย |
| `คู่มือติดตั้ง.md` | วิธีติดตั้งตั้งแต่ต้น |

Edge functions อื่นที่ deploy อยู่ใน Supabase แต่ยังไม่ได้ copy มาไว้ใน repo: `line-push`, `line-digest`, `low-alert`, `line-setup`, `ja-pdf`, `line-diag` (ชั่วคราว ควรลบ) ดูโค้ดได้ที่ Supabase Dashboard > Edge Functions

## 3. ข้อมูล
- ตารางหลัก `records(col,id,data jsonb)` เก็บทุกอย่างเป็น JSON แยกตาม `col`: `items, quotes, po, ja, estimates, boms, withdrawals, moves, settings(id=main)` ฯลฯ
- ตารางอื่น: `profiles`, `audit_log`, `records_snapshots`, `line_links` (ผูก user กับ LINE), `line_codes`, `line_pending`, `signup_allow`, `cron_key`, และ `records_backup_*` (สำรอง ลบได้เมื่อมั่นใจ)
- ใบสั่งซื้อ (`po`): `form` ('tech'|'buy'), `customer, job, machine, jaNo, dept, wh, needBy, prno`, `appr{st: pending|approved|rejected, by, byId, decBy}`, `status` draft/sent/partial/received/cancelled
- ผู้อนุมัติ: `settings.approvers` (ตั้งที่หน้า LINE > แท็บ "รายบุคคล") + role admin

## 4. Edge Functions และ secrets
Secrets (ตั้งใน Supabase > Edge Functions > Secrets ไม่อยู่ใน repo): `LINE_TOKEN`, `LINE_SECRET` (+ `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` มีให้อัตโนมัติ)
- `purchase-notify` v11, `line-webhook` v27, `line-approve` v3 (verify_jwt: true สำหรับ line-approve)
- Deploy: Supabase CLI `supabase functions deploy <ชื่อ> --project-ref rdycjuuzehjcyrpbrgch` หรือ MCP `deploy_edge_function` (ต้องส่งไฟล์เต็ม) ตรวจหลัง deploy ว่าโค้ดตรงกับใน repo
- LINE: `reply` ฟรีไม่จำกัด แต่ `push/multicast` นับโควตารายเดือน

## 5. ข้อควรรู้ / ข้อห้าม
- ห้าม commit ข้อมูลธุรกิจ (seed/boms/jobs/stock) หรือ service_role key
- แก้ `index.html` ตรวจ syntax ก่อน push: ดึงโค้ดใน `<script>` แล้วรัน `new Function(code)` ด้วย node
- ธีมใช้ CSS variables (light/dark/nature/sea/mountain) + ชั้น glass (UI v3) + ตัวเลือกพื้นหลัง `data-bg` (soft/theme/vivid/plain)
- ชื่อฟังก์ชันหลักในแอป: `vHome, poModal, poCreate, poFormHtml, poBuyHtml, tPo, exportAs, pdfSave, bomMake, themeModal`
- แอปออฟไลน์ (EXE) **ไม่ได้อัปเดต** ตามเวอร์ชันออนไลน์

## 6. งานที่ยังค้าง / ข้อจำกัดปัจจุบัน
1. โควตา LINE push เต็ม (429) → การ์ดแจ้งเตือนส่งไม่ได้จนกว่าจะรีเซ็ตต้นเดือนหรืออัปเกรดแพ็กเกจ (ปุ่ม "ขอใบสั่งซื้อ (PDF)" แนบการ์ดในข้อความตอบ จึงยังได้ลิงก์)
2. PDF ผ่าน LINE ยังเป็นฟอร์มช่างอย่างเดียว (ฟอร์มจัดซื้อแนวนอนมีเฉพาะในเว็บ) และใช้เลข PO แทน `prno`
3. ยังไม่ได้ทดสอบจริงโดยผู้ใช้: ตัวเลือกฟอร์มใบสั่งซื้อ, ปุ่ม BOM "สร้างใบงาน", รายการใบสั่งซื้อแยกตามสถานะอนุมัติ, ช่องหัวฟอร์มแยกช่าง/จัดซื้อ, หน้าภาพรวมใหม่
4. ยังไม่ได้ทำ: ใบคืนพัสดุ, แบนเนอร์เตือนในแอปเมื่อโควตา LINE เต็ม, ตรวจรหัสซ้ำ `160016071TD-10NA1IN`, ตรวจ CSV รายงานสต๊อก
5. ลบ edge function ชั่วคราว `line-diag`

## 7. วิธีเริ่มทำต่อ
1. clone repo นี้ อ่านไฟล์นี้ แล้วเปิด `index.html`
2. ขอสิทธิ์ Supabase (คีย์แยกที่ถอนได้) ถ้าจะแก้ edge function/ฐานข้อมูล
3. ทำทีละเรื่อง ทดสอบ push `main` แล้วรอ 1–2 นาที Ctrl+F5
4. รายงานผู้ใช้เป็นภาษาไทยตามจริง บอกสิ่งที่ยังไม่ได้ทดสอบ
