// Express stock update from XLSX/CSV/TSV (LINE flow)
import * as XLSX from 'npm:xlsx@0.18.5';
export const isStockCmd = (t: string) => /^(อัพเดท|อัปเดต|อัพเดต|อัปเดท)\s*(สต๊อก|สต๊อค|สต็อก|สต็อค|สตอก|สตอค)$/.test(t.replace(/\s+/g, ' ').trim());
const EXP_COLS: [string, RegExp][] = [['code', /รหัส|code|item\s*no|sku/i], ['name', /ชื่อ|รายการ|description|name|desc/i], ['unit', /หน่วย|unit|uom/i], ['qty', /คงเหลือ|ยอด|จำนวน|balance|qty|quantity|stock/i], ['cost', /ต้นทุน|ราคาทุน|ราคา|cost|price/i], ['wh', /คลัง|wh|warehouse/i]];
const num = (x: any) => Number(x) || 0;
const n0 = (x: any) => (Number(x) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const expNum = (v: any): number | null => { if (typeof v === 'number') return v; const x = parseFloat(String(v == null ? '' : v).replace(/[,\s฿]/g, '').replace(/^\((.*)\)$/, '-$1')); return isNaN(x) ? null : x; };
export function decode(buf: Uint8Array): string {
  let s: string;
  try { s = new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (_) { s = new TextDecoder('windows-874').decode(buf); }
  return s.replace(/^﻿/, '');
}
const isExcel = (b: Uint8Array) => b.length > 4 && ((b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf));
function sheetRows(buf: Uint8Array): string[][] {
  const wb = XLSX.read(buf, { type: 'array' });
  let best: any[][] = [];
  for (const n of wb.SheetNames) { const r = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }) as any[][]; if (r.length > best.length) best = r; }
  return best.map((r) => r.map((c) => String(c == null ? '' : c).trim())).filter((r) => r.some((x) => x !== ''));
}
export function parseCsv(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const sample = lines.slice(0, 15).join('\n');
  const cnt = (c: string) => sample.split(c).length - 1;
  const d = [',', '\t', ';', '|'].map((c) => [c, cnt(c)] as [string, number]).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = []; let row: string[] = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur.trim()); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur.trim()); cur = ''; if (row.some((x) => x !== '')) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur.trim()); if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}
function detect(rows: any[][]) {
  let hi = 0, best = -1;
  rows.slice(0, 15).forEach((r, i) => { const sc = r.filter((c) => typeof c === 'string' && EXP_COLS.some(([, re]) => re.test(c))).length; if (sc > best) { best = sc; hi = i; } });
  const head = (rows[hi] || []).map((c, i) => String(c || '').trim() || ('คอลัมน์ ' + (i + 1))); const map: Record<string, number> = {};
  EXP_COLS.forEach(([k, re]) => { map[k] = head.findIndex((c, i) => re.test(c) && !Object.values(map).includes(i)); });
  if (map.qty >= 0 && map.qty === map.cost) map.cost = -1;
  return { hi, head, map };
}
const bangkokDay = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const csvCell = (v: any) => { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };

// ---- LINE cards: summary + full detail carousels ----
const showUnit = (u: any) => { const s = String(u == null ? '' : u).trim(); return /^[\d.,\s-]*$/.test(s) ? '' : s; };
export function stockCards(r: any, fname: string, BASE: string): any[] {
  const T = (t: string, o: any = {}) => ({ type: 'text', text: t, size: 'xs', color: '#555555', wrap: true, ...o });
  const body: any[] = [
    { type: 'text', text: fname, size: 'xs', color: '#777777', wrap: true },
    T('📝 สต๊อกเปลี่ยน ' + r.upd.length + ' รายการ', { weight: 'bold', color: '#222222', size: 'sm', margin: 'md' }),
    T('💰 ต้นทุนเปลี่ยน ' + r.cost.length + ' รายการ', { weight: 'bold', color: '#222222', size: 'sm' }),
    T('➕ สินค้าใหม่ ' + r.add.length + ' รายการ', { weight: 'bold', color: '#222222', size: 'sm' }),
    T('ไม่เปลี่ยน ' + r.same + ' · ไม่พบในไฟล์ (ไม่ได้แก้ไข) ' + r.miss, { color: '#999999', margin: 'md' }),
  ];
  if (r.fail) body.push(T('⚠ บันทึกไม่สำเร็จ ' + r.fail + ' รายการ', { color: '#c0392b' }));
  const rows: any[] = [];
  r.upd.forEach((x: any) => rows.push({ tag: '📝', code: x.code, name: x.name, line: n0(x.from) + ' → ' + n0(x.to) + ' ' + showUnit(x.unit), color: x.to < x.from ? '#c0392b' : '#2e8b57' }));
  r.cost.forEach((x: any) => rows.push({ tag: '💰', code: x.code, name: x.name, line: 'ต้นทุน ' + n0(x.from) + ' → ' + n0(x.to), color: '#b7791f' }));
  r.add.forEach((x: any) => rows.push({ tag: '➕', code: x.code, name: x.name, line: 'สินค้าใหม่ · คงเหลือ ' + n0(x.qty) + ' ' + showUnit(x.unit), color: '#0f6e84' }));
  const PER = 10, PERMSG = 5, MAXDETAIL = 4;
  const cap = PER * PERMSG * MAXDETAIL;
  const shown = rows.slice(0, cap);
  if (rows.length > cap) body.push(T('แสดงใน LINE ' + cap + ' รายการแรก — ที่เหลือ ' + (rows.length - cap) + ' รายการดูในไฟล์รายงาน CSV', { color: '#999999', margin: 'md' }));
  if (!rows.length) body.push(T('ข้อมูลตรงกับในระบบอยู่แล้ว ไม่มีรายการเปลี่ยน', { margin: 'md' }));
  else body.push(T('รายละเอียดทุกรายการอยู่ในการ์ดถัดไป (เลื่อนซ้าย-ขวา)', { margin: 'md' }));
  const footer: any[] = [];
  if (r.url) footer.push({ type: 'button', style: 'primary', color: '#0f6e84', height: 'sm', action: { type: 'uri', label: 'ดาวน์โหลดรายงาน CSV', uri: r.url } });
  footer.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดสต๊อกในโปรแกรม', uri: BASE + '?go=items&openExternalBrowser=1' } });
  const msgs: any[] = [{ type: 'flex', altText: '✅ อัพเดทสต๊อกแล้ว: สต๊อก ' + r.upd.length + ' · ใหม่ ' + r.add.length, contents: { type: 'bubble', size: 'mega', header: { type: 'box', layout: 'vertical', backgroundColor: '#2e8b57', paddingAll: '12px', contents: [{ type: 'text', text: '✅ อัพเดทสต๊อกสำเร็จ', color: '#ffffff', weight: 'bold' }] }, body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body }, footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: footer } } }];
  const pages = Math.ceil(shown.length / PER), bubbles: any[] = [];
  for (let p = 0; p < pages; p++) {
    const part = shown.slice(p * PER, (p + 1) * PER);
    const items: any[] = [];
    part.forEach((x: any, i: number) => { if (i) items.push({ type: 'separator', margin: 'sm' }); items.push({ type: 'box', layout: 'vertical', margin: 'sm', contents: [T(x.tag + ' ' + String(x.code), { color: '#0f6e84', weight: 'bold' }), T(String(x.name)), T(x.line, { weight: 'bold', color: x.color, size: 'sm' })] }); });
    bubbles.push({ type: 'bubble', size: 'mega', header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingAll: '10px', contents: [{ type: 'text', text: '📦 รายละเอียด หน้า ' + (p + 1) + '/' + pages, color: '#ffffff', weight: 'bold', size: 'sm' }, { type: 'text', text: 'รายการที่ ' + (p * PER + 1) + '–' + (p * PER + part.length) + ' จาก ' + rows.length, color: '#d6eaf0', size: 'xs' }] }, body: { type: 'box', layout: 'vertical', contents: items } });
  }
  for (let i = 0; i < bubbles.length; i += PERMSG) { const ch = bubbles.slice(i, i + PERMSG); msgs.push({ type: 'flex', altText: '📦 รายละเอียดสต๊อกที่อัปเดต', contents: ch.length === 1 ? ch[0] : { type: 'carousel', contents: ch } }); }
  return msgs;
}

export async function stockUpdate(sb: any, buf: Uint8Array, filename: string, byId: string, byName: string) {
  let rows: string[][];
  try { rows = isExcel(buf) ? sheetRows(buf) : parseCsv(decode(buf)); } catch (e) { return { ok: false, error: 'อ่านไฟล์ไม่ได้: ' + String((e as any)?.message || e).slice(0, 120) }; }
  if (rows.length < 2) return { ok: false, error: 'อ่านไฟล์ไม่ได้ หรือไม่มีข้อมูล (รองรับไฟล์ .xlsx / .xls / .csv / .txt)' };
  const { hi, head, map } = detect(rows);
  if (map.code < 0 || map.qty < 0) return { ok: false, error: 'ไม่พบคอลัมน์ "รหัสสินค้า" และ "จำนวนคงเหลือ" ในไฟล์ (หัวตารางที่พบ: ' + head.slice(0, 10).join(' | ') + ')' };
  // load all items
  const items: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('records').select('id,data').eq('col', 'items').order('id').range(from, from + 999);
    if (error) return { ok: false, error: 'โหลดสินค้าไม่สำเร็จ: ' + error.message };
    items.push(...(data || [])); if (!data || data.length < 1000) break;
  }
  const by = new Map<string, any>(); items.forEach((r) => { const c = String(r.data.code || '').trim().toLowerCase(); if (c && !by.has(c)) by.set(c, r); });
  // aggregate per code (warehouse column)
  let body: any[][] = rows.slice(hi + 1);
  if (map.wh >= 0) {
    const g = new Map<string, any>(), ord: any[] = [];
    body.forEach((r) => { const code = String(r[map.code] ?? '').trim(); if (!code) return; const w = String(r[map.wh] ?? '').trim(); const q = expNum(r[map.qty]); if (q == null) return;
      let o = g.get(code.toLowerCase()); if (!o) { o = { row: r.slice(), wh: new Map(), tot: 0 }; g.set(code.toLowerCase(), o); ord.push(o); } o.tot += q; if (w) o.wh.set(w, (o.wh.get(w) || 0) + q); });
    body = ord.map((o) => { const r: any = o.row; r[map.qty] = o.tot; r._wh = [...o.wh.entries()].filter(([, v]: any) => v !== 0).map(([k, v]: any) => k + ':' + (+v.toFixed(4))).join(';'); return r; });
  }
  const stamp = bangkokDay(), upd: any[] = [], cost: any[] = [], add: any[] = [], writes: Map<string, any> = new Map();
  let same = 0, skip = 0; const seen = new Set<string>();
  for (const r of body as any[]) {
    const code = String(r[map.code] ?? '').trim(); const name = map.name >= 0 ? String(r[map.name] || '').trim() : '';
    if (!code && !name) { skip++; continue; }
    const q = expNum(r[map.qty]), c = map.cost >= 0 ? expNum(r[map.cost]) : null, unit = map.unit >= 0 ? String(r[map.unit] || '').trim() : '';
    const rec = code ? by.get(code.toLowerCase()) : null;
    if (rec) {
      if (seen.has(rec.id)) continue; seen.add(rec.id);
      const it = rec.data; const d = { ...it }; const logs: string[] = []; let ch = false;
      if (q != null && (num(it.stock) !== q || (r._wh && r._wh !== (it.stockWh || '')))) {
        upd.push({ code: it.code, name: it.name, unit: it.unit, from: num(it.stock), to: q, fromWh: it.stockWh || '', wh: r._wh || '' });
        d.stock = q; if (r._wh) d.stockWh = r._wh; d.stockAsOf = stamp; logs.push('คงเหลือ ' + num(it.stock) + ' → ' + q); ch = true;
      }
      if (c != null && c > 0 && Math.abs(num(it.cost) - c) > 0.0049) {
        cost.push({ code: it.code, name: it.name, from: num(it.cost), to: c }); d.cost = c; d.costDate = stamp; logs.push('ต้นทุน ' + num(it.cost) + ' → ' + c); ch = true;
      }
      if (ch) { d.log = [{ ts: Date.now(), by: byName, text: 'อัปเดตจาก Express ผ่าน LINE (' + filename + '): ' + logs.join(' · ') }, ...(it.log || [])].slice(0, 100); writes.set(rec.id, d); } else same++;
    } else if (name && code) {
      add.push({ code, name, unit: unit || 'ชิ้น', qty: q || 0, cost: c || 0, wh: r._wh || '' });
    } else skip++;
  }
  const miss = items.filter((r) => r.data.code && !seen.has(r.id)).length;
  // apply
  let fail = 0; const ids = [...writes.keys()];
  for (let i = 0; i < ids.length; i += 15) {
    await Promise.all(ids.slice(i, i + 15).map(async (id) => { const { error } = await sb.from('records').update({ data: writes.get(id), updated_by: byId }).eq('col', 'items').eq('id', id); if (error) fail++; }));
  }
  for (let i = 0; i < add.length; i += 15) {
    await Promise.all(add.slice(i, i + 15).map(async (a) => {
      const d: any = { code: a.code, name: a.name, unit: a.unit, cost: a.cost, stock: a.qty, min: 0, suppliers: [], category: '', stockAsOf: stamp, log: [{ ts: Date.now(), by: byName, text: 'นำเข้าจาก Express ผ่าน LINE (' + filename + ')' }] };
      if (a.wh) d.stockWh = a.wh; if (a.cost > 0) d.costDate = stamp;
      const { error } = await sb.from('records').insert({ col: 'items', id: crypto.randomUUID(), data: d, updated_by: byId }); if (error) fail++;
    }));
  }
  // settings
  try {
    const { data: st } = await sb.from('records').select('data').eq('col', 'settings').eq('id', 'main').maybeSingle();
    if (st?.data) await sb.from('records').update({ data: { ...st.data, expressImport: { ts: Date.now(), by: byName, file: filename + ' (LINE)', upd: upd.length, cost: cost.length, add: add.length } } }).eq('col', 'settings').eq('id', 'main');
  } catch (_) {}
  // report csv
  const L: any[][] = [['ประเภท', 'รหัส', 'ชื่อ', 'ก่อน', 'หลัง', 'คลัง (ก่อน)', 'คลัง (หลัง)']];
  upd.forEach((x) => L.push(['สต๊อกเปลี่ยน', x.code, x.name, x.from, x.to, x.fromWh, x.wh]));
  cost.forEach((x) => L.push(['ต้นทุนเปลี่ยน', x.code, x.name, x.from, x.to, '', '']));
  add.forEach((x) => L.push(['สินค้าใหม่', x.code, x.name, '', x.qty, '', x.wh]));
  let url = '';
  try {
    const path = 'stock-updates/' + Date.now() + '.csv';
    const up = await sb.storage.from('ja-files').upload(path, new TextEncoder().encode('﻿' + L.map((r) => r.map(csvCell).join(',')).join('\r\n')), { contentType: 'text/csv; charset=utf-8' });
    if (!up.error) { const { data: su } = await sb.storage.from('ja-files').createSignedUrl(path, 3 * 86400, { download: 'stock-update-' + stamp + '.csv' }); url = su?.signedUrl || ''; }
  } catch (_) {}
  return { ok: true, upd, cost, add, same, miss, skip, fail, url, total: rows.length - hi - 1 };
}
