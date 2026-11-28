import { createClient } from 'npm:@supabase/supabase-js@2';
import { PDFDocument, rgb, beginText, endText, setFontAndSize, showText, setTextMatrix, setFillingColor } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
const BASE = 'https://nookky154789.github.io/quote-system/';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
let FONTS: any = null;
async function fonts() {
  if (FONTS) return FONTS;
  const g = async (n: string) => new Uint8Array(await (await fetch(BASE + 'fonts/' + n)).arrayBuffer());
  const [th4, th7, la4, la7] = await Promise.all([g('sb-thai-400.ttf'), g('sb-thai-700.ttf'), g('sb-latin-400.ttf'), g('sb-latin-700.ttf')]);
  FONTS = { th4, th7, la4, la7 }; return FONTS;
}
const F0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }), F2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n0 = (x: any) => F0.format(Number(x) || 0);
const n2 = (x: any) => F2.format(Number(x) || 0);
const thDate = (s: string) => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}/${m[2]}/${+m[1] + 543}` : ''; };

async function buildForm(F: any, d: any) {
  const doc = await PDFDocument.create(); doc.registerFontkit(fontkit);
  const f: any = { th4: await doc.embedFont(F.th4, { subset: true }), th7: await doc.embedFont(F.th7, { subset: true }), la4: await doc.embedFont(F.la4, { subset: true }), la7: await doc.embedFont(F.la7, { subset: true }) };
  for (const k of Object.keys(f)) { const ft = f[k], orig = ft.encodeText.bind(ft), memo = new Map<string, any>(); ft.encodeText = (t: string) => { let v = memo.get(t); if (v === undefined) { v = orig(t); memo.set(t, v); } return v; }; }
  const isTh = (c: number) => c >= 0x0E00 && c <= 0x0E7F;
  const fontFor = (th: boolean, bold?: boolean) => th ? (bold ? f.th7 : f.th4) : (bold ? f.la7 : f.la4);
  const runs = (s: any) => { const out: any[] = []; let cur: boolean | null = null, run = ''; for (const ch of String(s)) { const t = isTh(ch.codePointAt(0)!); if (ch === ' ' && cur !== null) { run += ch; continue; } if (cur === null) cur = t; if (t !== cur) { out.push([run, cur]); run = ''; cur = t; } run += ch; } if (run) out.push([run, cur === null ? false : cur]); return out; };
  const cwm = new Map<string, number>();
  const chW = (ch: string, size: number, bold?: boolean): number => { const th = isTh(ch.codePointAt(0)!); const k = (bold ? 'b' : 'n') + (th ? 't' : 'l') + size + ch; let v = cwm.get(k); if (v === undefined) { const nv: number = fontFor(th, bold).widthOfTextAtSize(ch, size); cwm.set(k, nv); v = nv; } return v; };
  const width = (s: any, size: number, bold?: boolean) => { let a = 0; for (const ch of String(s)) a += chW(ch, size, bold); return a; };
  const W = 595.28, H = 841.89, M = 28, CW = W - 2 * M;
  let page: any, y = 0;
  const ink = rgb(0.08, 0.08, 0.08), red = rgb(0.85, 0.1, 0.1), teal = rgb(0.059, 0.431, 0.518), grey = rgb(0.45, 0.45, 0.45), green = rgb(0.1, 0.5, 0.25), shade = rgb(0.88, 0.92, 0.95), lightline = rgb(0.6, 0.6, 0.6);
  const fkeys = new Map<any, any>();
  const text = (s: any, x: number, yy: number, size: number, o: any = {}) => { s = String(s == null ? '' : s); if (!s) return; let cx = x; const w = width(s, size, o.bold); if (o.align === 'right') cx = x - w; else if (o.align === 'center') cx = x - w / 2; const col = o.color || ink; for (const [r, t] of runs(s)) { const ft = fontFor(t, o.bold); let fk = fkeys.get(page); if (!fk) { fk = new Map(); fkeys.set(page, fk); } let key = fk.get(ft); if (!key) { key = page.node.newFontDictionary(ft.name, ft.ref); fk.set(ft, key); } page.pushOperators(beginText(), setFillingColor(col), setFontAndSize(key, size), setTextMatrix(1, 0, 0, 1, cx, yy), showText(ft.encodeText(r)), endText()); cx += width(r, size, o.bold); } };
  const wrap = (s: any, maxW: number, size: number, bold?: boolean) => { const lines: string[] = []; for (const para of String(s || '').split(/\r?\n/)) { let cur = '', cw = 0; for (const ch of para) { const w = chW(ch, size, bold); if (cw + w > maxW && cur) { lines.push(cur); cur = ch === ' ' ? '' : ch; cw = ch === ' ' ? 0 : w; } else { cur += ch; cw += w; } } lines.push(cur); } return lines; };
  const hline = (x1: number, x2: number, yy: number, th = 0.7, c: any = ink) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: th, color: c });
  const vline = (xx: number, y1: number, y2: number, th = 0.7, c: any = ink) => page.drawLine({ start: { x: xx, y: y1 }, end: { x: xx, y: y2 }, thickness: th, color: c });
  // columns
  const cols: any[] = [['ลำดับ', 32, 'center'], ['รายการสินค้า', 0, 'left'], ['จำนวน', 54, 'center'], ['ราคา/หน่วย', 66, 'right'], ['ราคารวม', 72, 'right'], ['วันที่ต้องการใช้', 76, 'center']];
  cols[1][1] = CW - cols.reduce((a, c) => a + c[1], 0);
  const xs: number[] = []; { let x = M; for (const c of cols) { xs.push(x); x += c[1]; } xs.push(M + CW); }
  const SIGH = 74, RH = 20;
  const sigTop = () => M + SIGH;
  let frameTop = 0;
  const frame = () => { page.drawRectangle({ x: M, y: M, width: CW, height: frameTop - M, borderColor: ink, borderWidth: 1.6 }); };
  const colHead = (first?: boolean) => {
    const h1 = 22, h2 = 22;
    hline(M, M + CW, y, 0.9);
    // top tier
    text('ลำดับ', (xs[0] + xs[1]) / 2, y - 26, 10, { bold: true, align: 'center' });
    text('รายการสินค้า', (xs[1] + xs[2]) / 2, y - 26, 10, { bold: true, align: 'center' });
    text('จำนวนที่ขอซื้อใหม่', (xs[2] + xs[6]) / 2, y - 15, 10, { bold: true, align: 'center' });
    hline(xs[2], M + CW, y - h1, 0.9);
    ['จำนวน', 'ราคา/หน่วย', 'ราคารวม'].forEach((t: string, i: number) => text(t, (xs[2 + i] + xs[3 + i]) / 2, y - h1 - 15, 9.5, { bold: true, align: 'center' }));
    text('วันที่ต้องการใช้', (xs[5] + xs[6]) / 2, y - h1 - 15, 9.5, { bold: true, align: 'center', color: red });
    for (const i of [1, 2]) vline(xs[i], y, y - h1 - h2, 0.9);
    for (const i of [3, 4, 5]) vline(xs[i], y - h1, y - h1 - h2, 0.9);
    y -= h1 + h2; hline(M, M + CW, y, 0.9);
  };
  const newPage = (first?: boolean) => {
    page = doc.addPage([W, H]); frameTop = H - M; y = H - M;
    {
      // title
      text('ใบขอซื้อจากผู้ใช้ (PURCHASE REQUEST FROM USER)', W / 2, y - 24, 14, { bold: true, align: 'center' });
      y -= 38; hline(M, M + CW, y, 1.2);
      // header fields
      const fld = (label: string, val: any, x: number, yy: number, wd: number, req?: boolean) => { text(label, x, yy, 9.5, { bold: true, color: req ? red : ink }); const lw = width(label, 9.5, true) + 4; hline(x + lw, x + wd - 8, yy - 2, 0.5, lightline); const ls = wrap(val || '', wd - lw - 10, 9.5); text(ls[0] || '', x + lw + 2, yy, 9.5); };
      const c3 = CW / 3, fx = M + 6, y1 = y - 20, y2 = y - 42, y3 = y - 64;
      const fi = d.fields || {};
      fld('*ชื่อลูกค้า :', fi.customer, fx, y1, c3 - 4, true); fld('*ชื่องาน :', fi.job, fx + c3, y1, c3, true); fld('*ชื่อเครื่อง :', fi.machine, fx + 2 * c3, y1, c3 - 6, true);
      fld('*เลขที่JA.', fi.ja, fx, y2, c3 - 4, true); fld('แผนก :', fi.dept, fx + c3, y2, c3, false); fld('*วันที่ขอซื้อ :', fi.date, fx + 2 * c3, y2, c3 - 6, true);
      fld('PR.NO (จัดซื้อ) :', fi.prno, fx, y3, c3 + 40, false);
      y -= 76; hline(M, M + CW, y, 1.2);
    }
    colHead(first);
  };
  const fullRow = (cellsFn: () => void, h: number, vs?: number[]) => { // draws vertical grid + bottom line
    for (const i of (vs || [1, 2, 3, 4, 5])) vline(xs[i], y, y - h, 0.6);
    cellsFn(); y -= h; hline(M, M + CW, y, 0.6);
  };
  let curSup = '';
  const drawSig = () => {
    const sg = d.sign || {}, bw = CW / 4, sy = M + SIGH;
    hline(M, M + CW, sy, 1.2);
    [['ผู้ขอซื้อ', sg.req], ['ผู้รับผิดชอบ', sg.resp], ['ผู้ตรวจ', sg.chk], ['ผู้จัดซื้อ', sg.buy]].forEach(([t, nm]: any, i: number) => {
      const x0 = M + i * bw; if (i) vline(x0, sy, M, 1.0);
      text(t, x0 + bw / 2, sy - 18, 11, { align: 'center' });
      if (nm) text('(' + nm + ')', x0 + bw / 2, sy - 32, 9, { align: 'center', color: grey });
      text('วันที่ ____/____/____', x0 + 8, M + 12, 9.5);
    });
  };
  const ensure = (h: number) => { if (y - h < sigTop() + 2) { while (y - RH >= sigTop() + 1) fullRow(() => {}, RH); drawSig(); frame(); newPage(false); if (curSup) { page.drawRectangle({ x: M + 0.5, y: y - RH, width: CW - 1, height: RH, color: shade }); text(curSup + ' (\u0e15\u0e48\u0e2d)', xs[1] + 6, y - 14, 10, { bold: true, color: teal }); y -= RH; hline(M, M + CW, y, 0.6); } } };
  newPage(true);
  let no = 0;
  for (const g of d.groups) {
    curSup = '';
    if (g.sup) {
      ensure(RH + RH); curSup = '';
      page.drawRectangle({ x: M + 0.5, y: y - RH, width: CW - 1, height: RH, color: shade });
      text(g.sup, xs[1] + 6, y - 14, 10, { bold: true, color: teal }); text(g.rows.length + ' รายการ', M + CW - 8, y - 14, 9, { align: 'right', color: grey });
      y -= RH; hline(M, M + CW, y, 0.6); curSup = g.sup;
    }
    for (const r of g.rows) {
      const ls = wrap(r.name, cols[1][1] - 10, 9.5); const rh = Math.max(RH, ls.length * 11.5 + 8);
      ensure(rh);
      no++;
      fullRow(() => {
        text(no, (xs[0] + xs[1]) / 2, y - 14, 9.5, { align: 'center' });
        ls.forEach((l: string, i: number) => text(l, xs[1] + 5, y - 14 - i * 11.5, 9.5));
        text(r.qty, (xs[2] + xs[3]) / 2, y - 14, 9.5, { align: 'center' });
        text(r.price, xs[4] - 5, y - 14, 9.5, { align: 'right' });
        text(r.total, xs[5] - 5, y - 14, 9.5, { align: 'right' });
        text(r.need || '', (xs[5] + xs[6]) / 2, y - 14, 9.5, { align: 'center' });
      }, rh);
    }
    curSup = '';
    if (g.sup && d.groups.length > 1) {
      ensure(RH);
      fullRow(() => { text('รวม ' + g.sup, xs[4] - 6, y - 14, 9.5, { bold: true, align: 'right', color: grey }); text(g.sub, xs[5] - 5, y - 14, 9.5, { bold: true, align: 'right' }); }, RH, [4, 5]);
    }
  }
  if (d.total != null) { ensure(RH); fullRow(() => { text('รวมทั้งสิ้น (บาท)', xs[4] - 6, y - 14, 10.5, { bold: true, align: 'right' }); text(d.total, xs[5] - 5, y - 14, 10.5, { bold: true, align: 'right' }); }, RH, [4, 5]); }
  // pad blank rows to bottom of page
  while (y - RH >= sigTop() + 1) fullRow(() => {}, RH);
  // signatures
  drawSig();
  frame();
  // appendix: summary + comparison
  if ((d.summary && d.summary.length > 1) || (d.cmp && d.cmp.length)) {
    page = doc.addPage([W, H]); y = H - M;
    text('เอกสารแนบ — สรุปยอดและเปรียบเทียบราคา', M, y - 14, 14, { bold: true, color: teal }); text((d.fields && d.fields.prno) || '', W - M, y - 14, 11, { align: 'right', bold: true }); y -= 30; hline(M, M + CW, y, 1.2, teal); y -= 12;
    const need = (h: number) => { if (y - h < 40) { page = doc.addPage([W, H]); y = H - M; } };
    if (d.summary && d.summary.length > 1) {
      text('สรุปยอดแยกตามร้าน (' + d.summary.length + ' ร้าน)', M, y - 11, 11, { bold: true }); y -= 20;
      page.drawRectangle({ x: M, y: y - 16, width: CW, height: 16, color: shade });
      text('ร้าน', M + 4, y - 12, 10, { bold: true }); text('จำนวนรายการ', W - M - 110, y - 12, 10, { bold: true, align: 'right' }); text('ยอดรวม (บาท)', W - M - 4, y - 12, 10, { bold: true, align: 'right' }); y -= 16;
      for (const [n, c, t] of d.summary as any[]) { need(18); text(n, M + 4, y - 12, 10); text(c, W - M - 110, y - 12, 10, { align: 'right', color: grey }); text(t, W - M - 4, y - 12, 10, { align: 'right' }); y -= 17; hline(M, M + CW, y, 0.4, lightline); }
      need(20); text('รวมทุกร้าน', M + 4, y - 13, 10, { bold: true }); text(String(d.summary.reduce((a: number, s: any) => a + s[1], 0)), W - M - 110, y - 13, 10, { bold: true, align: 'right' }); text(d.total, W - M - 4, y - 13, 10, { bold: true, align: 'right' }); y -= 28;
    }
    if (d.cmp && d.cmp.length) {
      need(70); text('เปรียบเทียบราคาร้านค้า (' + d.cmp.length + ' รายการที่มีหลายร้าน)', M, y - 11, 11, { bold: true }); y -= 16;
      text('[เลือก] = ร้านที่ใช้สั่งในใบนี้ · ส่วนต่าง = เทียบกับร้านที่ราคาต่ำสุดของสินค้านั้น', M, y - 9, 8.5, { color: grey }); y -= 16;
      for (const c of d.cmp) {
        const hd = wrap((c.code ? c.code + '  ' : '') + c.name + '  (สั่ง ' + c.qtyT + ' ' + c.unit + ')', CW - 8, 10, true);
        need(hd.length * 13 + c.offers.length * 14 + 12);
        page.drawRectangle({ x: M, y: y - hd.length * 13 - 3, width: CW, height: hd.length * 13 + 3, color: shade });
        hd.forEach((l: string, i: number) => text(l, M + 4, y - 11 - i * 13, 10, { bold: true })); y -= hd.length * 13 + 3;
        c.offers.forEach((o: any, j: number) => { const chosen = o.name === c.chosen, lo = j === 0;
          text(o.name + (chosen ? '  [เลือก]' : ''), M + 12, y - 11, 10, { bold: chosen, color: chosen ? teal : ink });
          text('฿' + o.priceT + ' /' + c.unit, W - M - 200, y - 11, 10, { align: 'right', bold: lo, color: lo ? green : ink });
          text('รวม ' + o.totT, W - M - 90, y - 11, 10, { align: 'right' });
          text(o.diffT, W - M - 4, y - 11, 9.5, { align: 'right', color: lo ? green : red });
          y -= 14; });
        hline(M, M + CW, y - 2, 0.4, lightline); y -= 8;
      }
      if (d.savingT) { need(30); text('สั่งตามร้านที่เลือก ประหยัดกว่าร้านราคาสูงสุด รวม ' + d.savingT + ' บาท', W - M, y - 12, 11, { bold: true, align: 'right', color: green }); y -= 22; }
      if (d.overT) { need(24); text('มีรายการที่เลือกร้านที่ไม่ใช่ราคาต่ำสุด ส่วนต่างรวม ' + d.overT + ' บาท', W - M, y - 12, 10, { align: 'right', color: red }); y -= 20; }
    }
  }
  return await doc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const J = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  try {
    const SU = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, token = Deno.env.get('LINE_TOKEN')!;
    const sb = createClient(SU, SK);
    const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (bearer !== SK) {
      const { data } = await sb.auth.getUser(bearer); if (!data?.user) return J({ ok: false, error: 'unauthorized' }, 401);
      const { data: p } = await sb.from('profiles').select('disabled').eq('id', data.user.id).maybeSingle(); if (!p || p.disabled) return J({ ok: false, error: 'unauthorized' }, 401);
    }
    const b: any = await req.json().catch(() => ({}));
    const extraTo: string[] = bearer === SK && Array.isArray(b.extraTo) ? b.extraTo.map(String) : [];
    const col = b.kind === 'po' ? 'po' : b.kind === 'wd' ? 'withdrawals' : null; if (!col || !b.id) return J({ ok: false, error: 'bad request' }, 400);
    const { data: st } = await sb.from('records').select('data').eq('col', 'settings').eq('id', 'main').maybeSingle(); const S: any = st?.data || {};
    if (S.lineOn === false && !extraTo.length) return J({ ok: true, n: 0, skipped: 'line off' });
    const { data: rec } = await sb.from('records').select('data').eq('col', col).eq('id', b.id).maybeSingle(); const d: any = rec?.data; if (!d) return J({ ok: false, error: 'not found' });
    if (d.pnAt && !b.force) return J({ ok: true, n: 0, skipped: 'already notified' });
    const posBuy: string[] = Object.entries(S.positions || {}).filter(([, v]: any) => v && v.buy).map(([k]) => k);
    const posOf: Record<string, string> = S.posOf || {};
    const { data: profs } = await sb.from('profiles').select('id,disabled'); const act = new Set((profs || []).filter((p: any) => !p.disabled).map((p: any) => p.id));
    const uids = S.lineOn === false ? [] : Object.keys(posOf).filter((u) => posBuy.includes(posOf[u]) && act.has(u));
    if (!uids.length && !extraTo.length) return J({ ok: true, n: 0, skipped: 'no purchasing recipients' });
    const { data: ls } = uids.length ? await sb.from('line_links').select('line_user_id').in('user_id', uids) : { data: [] as any[] };
    const to = [...new Set([...(ls || []).map((l: any) => l.line_user_id), ...extraTo])];
    if (!to.length) return J({ ok: true, n: 0, skipped: 'recipients not linked' });
    const L: any[] = d.lines || []; const isPo = b.kind === 'po';
    let total: number | null = null;
    let keep: any[] = L; let summary: any[] = [], cmp: any[] = [], saving = 0, over = 0, supNames = '';
    let groups: any[] = [];
    const stock: Record<string, any> = {};
    const ids = L.map((l) => l.itemId).filter(Boolean);
    if (ids.length) { const { data: its } = await sb.from('records').select('id,data').eq('col', 'items').in('id', ids); for (const r of its || []) stock[r.id] = r.data; }
    if (isPo) {
      const supOf = (l: any) => String(l.sup || (String(d.supplier || '').includes(', ') ? '' : d.supplier) || '').trim();
      const sorted = [...L].sort((a, b2) => (supOf(a) || '￿').localeCompare(supOf(b2) || '￿', 'th'));
      keep = sorted; total = L.reduce((s: number, l: any) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
      const gm = new Map<string, { rows: any[]; t: number }>();
      for (const l of sorted) {
        const k = supOf(l) || 'ไม่ระบุร้าน'; const a = gm.get(k) || { rows: [], t: 0 }; const tt = (Number(l.qty) || 0) * (Number(l.price) || 0);
        a.t += tt; a.rows.push({ name: (l.code ? l.code + '  ' : '') + (l.name || ''), qty: n0(l.qty) + (l.unit ? ' ' + l.unit : ''), price: n2(l.price), total: n2(tt), need: l.need ? thDate(l.need) || String(l.need) : '' }); gm.set(k, a);
      }
      groups = [...gm].map(([k, a]) => ({ sup: k, rows: a.rows, sub: n2(a.t) }));
      summary = [...gm].map(([k, a]) => [k, a.rows.length, a.t]).sort((x: any, y2: any) => y2[2] - x[2]).map((r: any) => [r[0], r[1], n2(r[2])]);
      const nm = [...gm.keys()].filter((k) => k !== 'ไม่ระบุร้าน');
      supNames = nm.length > 3 ? nm.length + ' ร้าน' : nm.join(', ');
      for (const l of sorted) { const it = l.itemId ? stock[l.itemId] : null; if (!it) continue;
        const m = new Map<string, number>(); for (const s of it.suppliers || []) { const pr = Number(s.price) || 0; if (s.name && pr > 0 && (!m.has(s.name) || pr < m.get(s.name)!)) m.set(s.name, pr); }
        if (m.size < 2) continue; const offers = [...m].map(([name, price]) => ({ name, price })).sort((x, y2) => x.price - y2.price);
        const q = Number(l.qty) || 0, cur = Number(l.price) || 0;
        saving += Math.max(0, (offers[offers.length - 1].price - cur) * q); over += Math.max(0, (cur - offers[0].price) * q);
        const lo = offers[0].price;
        cmp.push({ code: l.code || '', name: l.name || '', qtyT: n0(q), unit: l.unit || '', chosen: supOf(l), offers: offers.map((o, j) => ({ name: o.name, priceT: n2(o.price), totT: n2(o.price * q), diffT: j === 0 ? 'ต่ำสุด' : '+' + n2(o.price - lo) + ' (+' + (lo > 0 ? Math.round((o.price / lo - 1) * 100) : 0) + '%)' })) }); }
    } else {
      keep = L.filter((l) => { if (l.nostock) return true; if (!l.itemId || l.free) return true; const it = stock[l.itemId]; return !it || (Number(it.stock) || 0) < (Number(l.qty) || 0); });
      if (!keep.length) return J({ ok: true, n: 0, skipped: 'no out-of-stock lines' });
      groups = [{ sup: '', sub: '', rows: keep.map((l) => { const it = l.itemId ? stock[l.itemId] : null; return { name: ((l.code || it?.code) ? (l.code || it?.code) + '  ' : '') + (l.name || ''), qty: n0(l.qty) + ((l.unit || it?.unit) ? ' ' + (l.unit || it?.unit) : ''), price: '', total: '', need: '' }; }) }];
    }
    const who = d.appr?.by || d.requester || d.by || '';
    const now = new Date(Date.now() + 7 * 3600000).toISOString();
    const form = {
      fields: { customer: d.customer || '', job: d.job || '', machine: d.machine || '', ja: d.jaNo || '', dept: d.dept || '', date: thDate(d.date) || thDate(now), prno: d.no || '' },
      groups, total: total != null ? n2(total) : null, summary, cmp, savingT: saving > 0 ? n2(saving) : '', overT: over > 0 ? n2(over) : '',
      sign: { req: d.requester || d.by || '', chk: d.appr?.by || '' },
    };
    const pdf = await buildForm(await fonts(), form);
    const path = 'pdf/' + (isPo ? 'PO-' : 'BUY-') + String(d.no || b.id).replace(/[^A-Za-z0-9_-]/g, '_') + '-' + Date.now() + '.pdf';
    const up = await sb.storage.from('ja-files').upload(path, pdf, { contentType: 'application/pdf' }); if (up.error) return J({ ok: false, error: 'upload ' + up.error.message });
    const { data: su } = await sb.storage.from('ja-files').createSignedUrl(path, 3 * 86400, { download: (isPo ? 'PR-' : 'BUY-') + String(d.no || 'doc') + '.pdf' });
    if (!su) return J({ ok: false, error: 'sign' });
    const T = (t: string, o: any = {}) => ({ type: 'text', text: t, size: 'xs', color: '#555555', wrap: true, ...o });
    const body: any[] = [{ type: 'text', text: String(d.no || ''), size: 'xl', weight: 'bold', color: '#14323C' }, T(isPo ? 'ร้าน: ' + (supNames || '-') : 'งาน: ' + (d.job || '-')), T('ผู้ขอ: ' + (who || '-') + ' · ' + keep.length + ' รายการ' + (total != null ? ' · รวม ' + n0(total) + ' บาท' : ''), { weight: 'bold', color: '#14323C' })];
    if (isPo && cmp.length) body.push(T('เทียบราคา ' + cmp.length + ' รายการ' + (saving > 0 ? ' · ประหยัด ' + n0(saving) + ' บาท' : ''), { color: '#1a7f4b', weight: 'bold', margin: 'sm' }));
    keep.slice(0, 6).forEach((l: any, i: number) => body.push(T((i + 1) + '. ' + String(l.name || '') + ' ×' + n0(l.qty) + ' ' + String(l.unit || ''), { margin: i ? 'xs' : 'md' })));
    if (keep.length > 6) body.push(T('…และอีก ' + (keep.length - 6) + ' รายการ (ดูครบใน PDF)', { color: '#999999' }));
    const msg = { type: 'flex', altText: '🛒 ' + (isPo ? 'ใบขอซื้อ ' : 'ขอซื้อ (จากใบเบิก) ') + d.no, contents: { type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#b7791f', paddingTop: '18px', paddingBottom: '14px', paddingStart: '18px', paddingEnd: '18px', contents: [{ type: 'text', text: '🛒 ' + (isPo ? 'มีใบขอซื้อใหม่' : 'มีรายการขอซื้อ'), color: '#ffffff', weight: 'bold', size: 'xl' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'button', style: 'primary', color: '#0f6e84', height: 'sm', action: { type: 'uri', label: 'เปิด / ดาวน์โหลด PDF', uri: su.signedUrl } }, { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดในโปรแกรม', uri: BASE + '?go=' + (isPo ? 'po' : 'withdrawals') + '&openExternalBrowser=1' } }] } } };
    const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
    for (let i = 0; i < to.length; i += 500) await fetch('https://api.line.me/v2/bot/message/multicast', { method: 'POST', headers: H, body: JSON.stringify({ to: to.slice(i, i + 500), messages: [msg] }) });
    await sb.from('records').update({ data: { ...d, pnAt: Date.now() } }).eq('col', col).eq('id', b.id);
    return J({ ok: true, n: to.length, lines: keep.length, url: su.signedUrl, no: d.no, supplier: supNames || '', total, cmp: cmp.length, saving });
  } catch (e) { return J({ ok: false, error: String((e as Error).message || e) }, 500); }
});
