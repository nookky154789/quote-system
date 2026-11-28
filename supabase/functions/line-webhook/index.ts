import { createClient } from 'npm:@supabase/supabase-js@2';
import { isStockCmd, stockUpdate, stockCards } from './stock.ts';
const enc = new TextEncoder();
const BASE = 'https://nookky154789.github.io/quote-system/';
async function validSig(body: string, sig: string, secret: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(body)));
  return btoa(String.fromCharCode(...mac)) === sig;
}
const thDate = (s: string) => { const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${m[3]}/${m[2]}/${+m[1] + 543}` : ''; };
const n0 = (x: any) => (Number(x) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const HELP = 'วิธีใช้ LINE OA ของระบบ\n\n📋 งานของฉัน — ดูงานที่ค้างอยู่ พร้อมปุ่ม รายการของ (PDF) / สร้างใบเบิกของ / แบบไฟฟ้า / แบบเครื่องกล / ส่งงาน (ส่งรูป)\n🔎 ค้นหาสินค้า — กดเมนู "สต๊อก" > "ค้นหาสินค้า" ก่อน แล้วค่อยพิมพ์รหัสหรือชื่อสินค้า เช่น A9F74320 (เฉพาะผู้ที่ผู้ดูแลอนุญาต) พิมพ์ "เสร็จ" เมื่อค้นครบ\n⚠️ ของใกล้หมด — พิมพ์ "ของใกล้หมด" หรือกดเมนู "สต๊อก" > "ของใกล้หมด" เพื่อดูสินค้าที่ต่ำกว่าขั้นต่ำ พร้อมจำนวนที่ควรซื้อเพิ่ม และกดปุ่ม "ขอใบสั่งซื้อ (PDF)" เพื่อสร้างใบสั่งซื้อ (ซิงค์กับโปรแกรม) แล้วส่ง PDF ให้ฝ่ายจัดซื้อ\n📦 อัพเดทสต๊อก — กดเมนู "สต๊อก" > "อัพเดทสต๊อก" แล้วส่งไฟล์ Excel (.xlsx/.xls) หรือ CSV จาก Express (เฉพาะผู้ที่ได้รับสิทธิ์)\n✅ อนุมัติเอกสาร — ผู้อนุมัติจะได้รับการ์ดขออนุมัติใบเบิก/ใบสั่งซื้อ กดปุ่ม อนุมัติ หรือ ไม่อนุมัติ ได้ทันที\n🖥 เปิดโปรแกรม / เบิกของ / สต๊อก / ใบสั่งซื้อ — เปิดหน้านั้นในเบราว์เซอร์\n🔔 แจ้งเตือนอัตโนมัติเมื่อมีงานมอบหมาย / แก้ไข / เสร็จ / มีบันทึกใหม่\n\nพิมพ์ "เมนู" เพื่อดูเมนูทั้งหมด\nยังไม่ได้ผูกบัญชี? ในแอปกดเมนู "🔔 ผูก LINE" แล้วส่งรหัส 6 หลักให้แชทนี้';
const PER_BUBBLE = 5, PER_MSG = 10, MAX_MSG = 5;
const CMDS = ['งานของฉัน', 'ช่วยเหลือ', 'เมนู', 'เมนู:สต๊อก', 'เมนู:งาน', 'ค้นหาสินค้า', 'ของใกล้หมด'];
const DONE_WORDS = ['เสร็จ', 'จบ', 'ส่งงานเสร็จ', 'ยกเลิก'];
const FEAT_OFF_MSG = 'ฟีเจอร์นี้ถูกปิดสำหรับบัญชีของคุณ — ติดต่อผู้ดูแลระบบหากต้องการใช้งาน';
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('ok');
  const secret = Deno.env.get('LINE_SECRET'), token = Deno.env.get('LINE_TOKEN');
  const body = await req.text();
  if (!secret || !(await validSig(body, req.headers.get('x-line-signature') || '', secret))) return new Response('bad signature', { status: 401 });
  const SU = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(SU, SK);
  const reply = (rt: string, ...messages: any[]) => fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ replyToken: rt, messages }) });
  const txt = (text: string) => ({ type: 'text', text });
  const pdfCard = (ls: { no: string; url: string }[]) => ({ type: 'flex', altText: 'PDF ใบขอซื้อ', contents: { type: 'bubble', size: 'kilo', body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: '📄 PDF ใบขอซื้อ', weight: 'bold', size: 'md' }, { type: 'text', text: 'กดเปิดได้ทันที (ลิงก์อยู่ 3 วัน) — แนบในข้อความตอบกลับ ไม่ขึ้นกับโควตาข้อความ push ของ LINE', size: 'xs', color: '#777777', wrap: true }, ...ls.slice(0, 5).map((l) => ({ type: 'button', style: 'primary', color: '#0f6e84', height: 'sm', action: { type: 'uri', label: 'เปิด PDF ' + l.no, uri: l.url } }))] } } });
  const pushTo = async (userIds: string[], messages: any[]) => {
    const ids = [...new Set(userIds.filter(Boolean))]; if (!ids.length) return;
    const { data: ls } = await sb.from('line_links').select('line_user_id').in('user_id', ids);
    const to = (ls || []).map((l: any) => l.line_user_id); if (!to.length) return;
    await fetch('https://api.line.me/v2/bot/message/multicast', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ to, messages }) });
  };
  const getSettings = async () => { const { data } = await sb.from('records').select('data').eq('col', 'settings').eq('id', 'main').maybeSingle(); return data?.data || {}; };
  const leaders = async (): Promise<string[]> => ((await getSettings()).leaders || []).filter(Boolean);
  const stockUpdaters = async (): Promise<string[]> => ((await getSettings()).stockUpdaters || []).filter(Boolean);
  const offList = async (userId: string): Promise<string[]> => (((await getSettings()).lineOff || {})[userId] || []);
  const loadJa = async (id: string, userId: string) => {
    const { data: rec } = await sb.from('records').select('data').eq('col', 'ja').eq('id', id).maybeSingle();
    const a: any = rec?.data; if (!a) return { a: null, ok: false, why: 'ไม่พบงานนี้' };
    const { data: prof } = await sb.from('profiles').select('role,disabled,name,username').eq('id', userId).maybeSingle();
    const ok = !!prof && !prof.disabled && (prof.role === 'admin' || a.createdById === userId || (a.assignees || []).some((x: any) => x.id === userId));
    return { a, ok, why: ok ? '' : 'ไม่มีสิทธิ์ดูงานนี้', prof };
  };
  const jaBtns = (a: any, id: string, off: string[] = []) => {
    const pb = (label: string, data: string, primary = false) => ({ type: 'button', style: primary ? 'primary' : 'secondary', color: primary ? '#0f6e84' : undefined, height: 'sm', action: { type: 'postback', label, data, displayText: label } });
    const files: any[] = a.files || [], L: any[] = a.lines || [];
    const f: any[] = [];
    if (L.length && !off.includes('pdf')) f.push(pb('📄 รายการของ (PDF)', 'pdf:' + id, true));
    if (L.length && !off.includes('wd')) f.push(pb('🧾 สร้างใบเบิกของ', 'wd:' + id));
    if (!off.includes('dwg')) {
      if (files.some((x) => x.kind === 'elec')) f.push(pb('⚡ แบบไฟฟ้า', 'dwg:' + id + ':elec'));
      if (files.some((x) => x.kind === 'mech')) f.push(pb('⚙ แบบเครื่องกล', 'dwg:' + id + ':mech'));
    }
    if (!off.includes('sub')) f.push(pb('📤 ส่งงาน (ส่งรูป)', 'sub:' + id));
    f.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดในโปรแกรม', uri: BASE + '?go=monitor&openExternalBrowser=1' } });
    return f;
  };
  let events: any[] = [];
  try { events = JSON.parse(body).events || []; } catch (_) {}
  for (const ev of events) {
    const uid = ev.source?.userId; if (!uid || !ev.replyToken) continue;
    if (ev.type === 'follow') { await reply(ev.replyToken, txt('ยินดีต้อนรับ 👋 เปิดแอป > เมนู "🔔 ผูก LINE" แล้วพิมพ์รหัส 6 หลักที่ได้มาในแชทนี้ เพื่อรับแจ้งเตือนงานของคุณ')); continue; }
    const { data: lk } = await sb.from('line_links').select('user_id,stock_perm').eq('line_user_id', uid).maybeSingle();

    // ---------- postback ----------
    if (ev.type === 'postback') {
      const pd = String(ev.postback?.data || '');
      if (!lk) continue;
      if (pd.startsWith('ap:')) {
        const [, dec, kd, ...rest] = pd.split(':');
        try { await fetch(SU + '/functions/v1/line-approve', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'decide', lineUserId: uid, decision: dec, kind: kd, id: rest.join(':'), replyToken: ev.replyToken }) }); } catch (_) { await reply(ev.replyToken, txt('ดำเนินการไม่สำเร็จ ลองใหม่อีกครั้ง')); }
        continue;
      }
      if (pd === 'pol') {
        const S0: any = await getSettings();
        const { data: pr } = await sb.from('profiles').select('role,disabled,name,username').eq('id', lk.user_id).maybeSingle();
        const posBuy = Object.entries(S0.positions || {}).filter(([, v]: any) => v && v.buy).map(([k]) => k);
        const allowed = !!pr && !pr.disabled && (pr.role === 'admin' || (S0.stockUpdaters || []).includes(lk.user_id) || (S0.lowStockUsers || []).includes(lk.user_id) || (S0.leaders || []).includes(lk.user_id) || posBuy.includes((S0.posOf || {})[lk.user_id]));
        if (!allowed) { await reply(ev.replyToken, txt('คุณยังไม่ได้รับสิทธิ์ขอใบสั่งซื้อ ติดต่อผู้ดูแลระบบ')); continue; }
        const items: any[] = [];
        for (let from = 0; ; from += 1000) { const { data } = await sb.from('records').select('id,data').eq('col', 'items').order('id').range(from, from + 999); (data || []).forEach((r: any) => items.push({ ...r.data, id: r.id })); if (!data || data.length < 1000) break; }
        const low = items.filter((i: any) => (Number(i.min) || 0) > 0 && (Number(i.stock) || 0) <= Number(i.min));
        if (!low.length) { await reply(ev.replyToken, txt('ตอนนี้ไม่มีสินค้าที่ต่ำกว่าขั้นต่ำ ไม่ต้องสั่งซื้อ 🎉')); continue; }
        const { data: pos } = await sb.from('records').select('id,data').eq('col', 'po');
        const open = new Set<string>(); (pos || []).forEach((r: any) => { if (r.data?.status === 'draft') (r.data.lines || []).forEach((l: any) => l.itemId && open.add(l.itemId)); });
        const todo = low.filter((i: any) => !open.has(i.id));
        if (!todo.length) {
          const lowIds = new Set(low.map((i: any) => i.id));
          const drafts = (pos || []).filter((r: any) => r.data?.status === 'draft' && (r.data.lines || []).some((l: any) => lowIds.has(l.itemId))).sort((a: any, b: any) => String(b.data.no || '').localeCompare(String(a.data.no || ''))).slice(0, 3);
          const sent: string[] = []; const pl: { no: string; url: string }[] = [];
          for (const d of drafts) { let j: any = null; for (let t = 0; t < 2 && !(j && j.ok && j.n); t++) { try { j = await (await fetch(SU + '/functions/v1/purchase-notify', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'po', id: d.id, force: true, extraTo: [uid] }) })).json(); } catch (_) {} } if (j && j.url) pl.push({ no: String(d.data.no || ''), url: j.url }); sent.push('• ' + (d.data.no || '') + ' · ' + (d.data.lines || []).length + ' รายการ' + (j && j.ok && j.url ? '' : ' (ส่ง PDF ไม่สำเร็จ)')); }
          await reply(ev.replyToken, txt('ทุกรายการที่ใกล้หมดมีใบสั่งซื้อฉบับร่างอยู่แล้ว (' + low.length + ' รายการ)' + (sent.length ? '\n' + sent.join('\n') + '\n\nแนบลิงก์ PDF ของใบเดิมให้ด้านล่างแล้ว' : '') + '\nดูได้ในโปรแกรมหน้า "ใบสั่งซื้อ"'), ...(pl.length ? [pdfCard(pl)] : [])); continue;
        }
        const NOSUP = '(ยังไม่ระบุร้าน)', g = new Map<string, any[]>();
        for (const it of todo) {
          const s = (it.suppliers || []).filter((x: any) => Number(x.price) > 0).sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
          const name = s ? (s.name || NOSUP) : NOSUP, price = s ? Number(s.price) : (Number(it.cost) || 0);
          const mn = Number(it.min) || 0, st = Number(it.stock) || 0, qty = Number(it.buyQty) > 0 ? Number(it.buyQty) : Math.max(1, mn * 2 - st);
          if (!g.has(name)) g.set(name, []);
          g.get(name)!.push({ k: Math.random().toString(36).slice(2, 10), itemId: it.id, code: it.code || '', name: it.name || '', unit: it.unit || '', qty, price, recv: 0, sup: name === NOSUP ? '' : name });
        }
        const th = new Date(Date.now() + 7 * 3600000), pre = S0.poPrefix || 'PO';
        const head = pre + '-' + String(th.getUTCFullYear() + 543).slice(-2) + String(th.getUTCMonth() + 1).padStart(2, '0') + '-';
        const { data: nos } = await sb.rpc('doc_nos', { p_head: head });
        const used = [...(nos || []), ...(pos || []).map((r: any) => r.data?.no)].filter((x: any) => typeof x === 'string' && x.startsWith(head)).map((x: string) => parseInt(x.slice(head.length)) || 0);
        let seq = used.length ? Math.max(...used) : 0;
        const made: any[] = [];
        {
          const ls: any[] = [...g.values()].flat().sort((x: any, y: any) => String(x.sup || '￿').localeCompare(String(y.sup || '￿'), 'th'));
          const sups = [...new Set(ls.map((l: any) => l.sup).filter(Boolean))];
          const no = head + String(++seq).padStart(3, '0'), id = Math.random().toString(36).slice(2, 10);
          const rec = { no, date: th.toISOString().slice(0, 10), supplier: sups.join(', '), status: 'draft', lines: ls, job: '', note: 'สร้างจากของใกล้หมด (ผ่าน LINE)', by: pr?.name || pr?.username || '' };
          const { error } = await sb.from('records').insert({ col: 'po', id, data: rec, updated_by: lk.user_id });
          if (!error) {
            let j: any = null;
            for (let t = 0; t < 2 && !(j && j.ok && j.n); t++) try { j = await (await fetch(SU + '/functions/v1/purchase-notify', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'po', id, force: true, extraTo: [uid] }) })).json(); } catch (_) {}
            made.push({ url: j && j.url || '', no, sup: sups.length > 3 ? sups.length + ' ร้าน' : sups.length ? sups.join(', ') : '(ยังไม่ระบุร้าน)', n: ls.length, ok: !!(j && j.ok && j.url), cmp: j && j.cmp || 0, saving: j && j.saving || 0 });
          }
        }
        if (!made.length) { await reply(ev.replyToken, txt('สร้างใบสั่งซื้อไม่สำเร็จ ลองใหม่อีกครั้ง')); continue; }
        await reply(ev.replyToken, txt('🛒 สร้างใบสั่งซื้อแล้ว (ใบเดียว รวมทุกร้าน) (' + todo.length + ' รายการ' + (todo.length < low.length ? ' · ข้าม ' + (low.length - todo.length) + ' รายการที่มีฉบับร่างอยู่แล้ว' : '') + ')\n' + made.map((m) => '• ' + m.no + ' · ' + m.sup + ' · ' + m.n + ' รายการ' + (m.cmp ? ' · เทียบราคา ' + m.cmp + ' รายการ' : '') + (m.ok ? '' : ' (ส่ง PDF ไม่สำเร็จ)')).join('\n') + '\n\nแนบลิงก์ PDF ให้ด้านล่างแล้ว · ดูในโปรแกรมได้ที่หน้า "ใบสั่งซื้อ"'), ...(made.some((m: any) => m.url) ? [pdfCard(made.filter((m: any) => m.url).map((m: any) => ({ no: m.no, url: m.url })))] : []));
        continue;
      }
      const [cmd, id, kind] = pd.split(':');
      if (!['pdf', 'dwg', 'wd', 'sub'].includes(cmd) || !id) continue;
      const { a, ok, why, prof } = await loadJa(id, lk.user_id);
      if (!ok) { await reply(ev.replyToken, txt(why)); continue; }
      if (prof?.role !== 'admin' && (await offList(lk.user_id)).includes(cmd)) { await reply(ev.replyToken, txt(FEAT_OFF_MSG)); continue; }
      const title = String(a.no || '') + ' ' + String(a.title || '');
      if (cmd === 'pdf') {
        let j: any = null;
        try { j = await (await fetch(SU + '/functions/v1/ja-pdf', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })).json(); } catch (_) {}
        if (!j || !j.ok) { await reply(ev.replyToken, txt(j && j.error === 'no lines' ? 'งานนี้ไม่มีรายการเบิกของ' : 'สร้าง PDF ไม่สำเร็จ ลองใหม่อีกครั้ง')); continue; }
        await reply(ev.replyToken, { type: 'flex', altText: 'รายการของ ' + a.no, contents: { type: 'bubble', size: 'kilo',
          header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingAll: '12px', contents: [{ type: 'text', text: '📄 รายการของ', color: '#ffffff', weight: 'bold', size: 'sm' }] },
          body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: title, weight: 'bold', wrap: true }, { type: 'text', text: j.count + ' รายการ · ลิงก์ใช้ได้ 3 วัน', size: 'xs', color: '#777777' }] },
          footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#0f6e84', height: 'sm', action: { type: 'uri', label: 'เปิด / ดาวน์โหลด PDF', uri: j.url } }] } } });
        continue;
      }
      if (cmd === 'dwg') {
        const files = (a.files || []).filter((f: any) => f.kind === kind && f.path);
        const label = kind === 'elec' ? '⚡ แบบไฟฟ้า' : '⚙ แบบเครื่องกล';
        if (!files.length) { await reply(ev.replyToken, txt('งานนี้ยังไม่มีไฟล์' + label.slice(2))); continue; }
        const btns: any[] = [];
        for (const f of files.slice(0, 10)) {
          const bucket = f.bucket || 'ja-files';
          const { data: su } = await sb.storage.from(bucket).createSignedUrl(f.path, 3 * 86400, { download: String(f.name || 'drawing.pdf') });
          if (su?.signedUrl) btns.push({ type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: ('📄 ' + String(f.name || 'แบบ')).slice(0, 40), uri: su.signedUrl } });
        }
        if (!btns.length) { await reply(ev.replyToken, txt('เปิดไฟล์ไม่ได้ในขณะนี้ ลองใหม่อีกครั้ง')); continue; }
        await reply(ev.replyToken, { type: 'flex', altText: label + ' ' + a.no, contents: { type: 'bubble', size: 'kilo',
          header: { type: 'box', layout: 'vertical', backgroundColor: kind === 'elec' ? '#b7791f' : '#4a5568', paddingAll: '12px', contents: [{ type: 'text', text: label, color: '#ffffff', weight: 'bold', size: 'sm' }] },
          body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: title, weight: 'bold', wrap: true }, { type: 'text', text: files.length + ' ไฟล์ · ลิงก์ใช้ได้ 3 วัน', size: 'xs', color: '#777777' }] },
          footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: btns } } });
        continue;
      }
      if (cmd === 'wd') {
        const { data: r, error } = await sb.rpc('line_create_wd', { p_ja: id, p_user: lk.user_id });
        if (error || !r || !r.ok) { await reply(ev.replyToken, txt(r && r.error === 'nolines' ? 'งานนี้ไม่มีรายการที่ค้างเบิก (เบิกครบแล้ว)' : 'สร้างใบเบิกไม่สำเร็จ ลองใหม่อีกครั้ง')); continue; }
        await reply(ev.replyToken, { type: 'flex', altText: 'ใบเบิก ' + r.no, contents: { type: 'bubble', size: 'kilo',
          header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingAll: '12px', contents: [{ type: 'text', text: r.dup ? '🧾 มีคำขอเบิกค้างอยู่แล้ว' : '🧾 สร้างใบเบิกแล้ว', color: '#ffffff', weight: 'bold', size: 'sm' }] },
          body: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'text', text: String(r.no), weight: 'bold', size: 'lg' }, { type: 'text', text: title, wrap: true, size: 'sm' }, { type: 'text', text: r.n + ' รายการ · ' + (r.dup ? 'รอยืนยันและตัดสต๊อกในโปรแกรม' : 'ส่งขออนุมัติแล้ว · รอยืนยันและตัดสต๊อกในโปรแกรม'), size: 'xs', color: '#777777', wrap: true }] },
          footer: { type: 'box', layout: 'vertical', contents: [{ type: 'button', style: 'primary', color: '#0f6e84', height: 'sm', action: { type: 'uri', label: 'เปิดใบเบิกในโปรแกรม', uri: BASE + '?go=withdrawals&openExternalBrowser=1' } }] } } });
        if (!r.dup) {
          try { await fetch(SU + '/functions/v1/line-approve', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request', kind: 'wd', id: r.id, setPending: true }) }); } catch (_) {}
          await pushTo([a.createdById, ...(await leaders())].filter((x: string) => x && x !== lk.user_id), [txt('🧾 ' + (prof?.name || prof?.username || '') + ' ขอเบิกของ ' + r.no + ' (' + r.n + ' รายการ) งาน ' + title + ' — รออนุมัติ/ยืนยันในโปรแกรม')]);
        }
        continue;
      }
      if (cmd === 'sub') {
        await sb.from('line_pending').upsert({ line_user_id: uid, ja_id: id, expires: new Date(Date.now() + 20 * 60000).toISOString(), n: 0 }, { onConflict: 'line_user_id' });
        await reply(ev.replyToken, txt('📤 ส่งงาน ' + title + '\n\nส่งรูปและ/หรือพิมพ์ข้อความในแชทนี้ได้เลย ระบบจะบันทึกลงงานนี้ในโปรแกรมให้อัตโนมัติ\nพิมพ์ "เสร็จ" เมื่อส่งครบ (หมดเวลาใน 20 นาที)'));
        continue;
      }
      continue;
    }

    if (ev.type !== 'message') continue;
    const mt = ev.message?.type;

    // ---------- อัพเดทสต๊อกจากไฟล์ Excel/CSV (Express) ----------
    if (lk && (mt === 'text' || mt === 'file')) {
      const t0s = mt === 'text' ? String(ev.message.text).trim() : '';
      const isCmd = mt === 'text' && isStockCmd(t0s);
      const { data: pst } = await sb.from('line_pending').select('*').eq('line_user_id', uid).eq('ja_id', 'stock-update').gt('expires', new Date().toISOString()).maybeSingle();
      if (isCmd || mt === 'file' || (pst && t0s === 'ยกเลิก')) {
        const { data: pf } = await sb.from('profiles').select('role,disabled,name,username').eq('id', lk.user_id).maybeSingle();
        const admin = !!pf && !pf.disabled && (pf.role === 'admin' || (await stockUpdaters()).includes(lk.user_id));
        if (!admin) { if (isCmd) await reply(ev.replyToken, txt('คำสั่งอัพเดทสต๊อกใช้ได้เฉพาะผู้ที่ได้รับสิทธิ์ — ให้ admin ติ๊กชื่อคุณในหน้าตั้งค่า (ผู้มีสิทธิ์อัปเดตสต๊อกทาง LINE)')); continue; }
        if (isCmd) {
          await sb.from('line_pending').upsert({ line_user_id: uid, ja_id: 'stock-update', expires: new Date(Date.now() + 10 * 60000).toISOString(), n: 0 }, { onConflict: 'line_user_id' });
          await reply(ev.replyToken, txt('📦 อัพเดทสต๊อกจาก Express\n\nส่งไฟล์ Excel (.xlsx / .xls) หรือ CSV (.csv / .txt) ที่ export จาก Express มาในแชทนี้ได้เลย (ภายใน 10 นาที)\n• ต้องมีคอลัมน์ รหัสสินค้า และ จำนวนคงเหลือ (ถ้ามี ชื่อ/หน่วย/ต้นทุน/รหัสคลัง จะอัปเดตให้ด้วย)\n• ระบบจะสรุปรายการที่อัปเดต (ก่อน → หลัง) และรายการสินค้าใหม่ที่เพิ่มให้\n\nพิมพ์ "ยกเลิก" เพื่อยกเลิก'));
          continue;
        }
        if (mt === 'text') { await sb.from('line_pending').delete().eq('line_user_id', uid); await reply(ev.replyToken, txt('ยกเลิกการอัพเดทสต๊อกแล้ว')); continue; }
        const fname = String(ev.message.fileName || 'stock.csv');
        if (!pst) { await reply(ev.replyToken, txt('ถ้าจะอัพเดทสต๊อกจากไฟล์ ให้พิมพ์ "อัพเดทสต๊อก" ก่อน แล้วค่อยส่งไฟล์ Excel / CSV ครับ')); continue; }
        if (/\.(pdf|docx?)$/i.test(fname)) { await reply(ev.replyToken, txt('รองรับเฉพาะไฟล์ Excel (.xlsx / .xls) และ CSV (.csv / .txt) ครับ')); continue; }
        await sb.from('line_pending').delete().eq('line_user_id', uid);
        await reply(ev.replyToken, txt('📥 รับไฟล์ ' + fname + ' แล้ว กำลังอัปเดตสต๊อก... (อาจใช้เวลาครู่หนึ่ง) เสร็จแล้วจะส่งสรุปให้'));
        const msgId = ev.message.id, byName = pf?.name || pf?.username || 'LINE', byId = lk.user_id;
        const push = (to: string[], messages: any[]) => fetch('https://api.line.me/v2/bot/message/multicast', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ to, messages }) });
        const work = (async () => {
          try {
            const r0 = await fetch('https://api-data.line.me/v2/bot/message/' + msgId + '/content', { headers: { Authorization: 'Bearer ' + token } });
            if (!r0.ok) { await push([uid], [txt('ดึงไฟล์จาก LINE ไม่สำเร็จ ลองส่งใหม่อีกครั้ง')]); return; }
            const r: any = await stockUpdate(sb, new Uint8Array(await r0.arrayBuffer()), fname, byId, byName);
            if (!r.ok) { await push([uid], [txt('❌ อัพเดทสต๊อกไม่สำเร็จ: ' + r.error)]); return; }
            const msgs = stockCards(r, fname, BASE);
            for (let i = 0; i < msgs.length; i += 5) await push([uid], msgs.slice(i, i + 5));
            await pushTo((await leaders()).filter((x: string) => x !== byId), [txt('📦 ' + byName + ' อัพเดทสต๊อกจาก Express ผ่าน LINE: สต๊อก ' + r.upd.length + ' · ต้นทุน ' + r.cost.length + ' · สินค้าใหม่ ' + r.add.length + ' รายการ')]);
          } catch (e) { try { await push([uid], [txt('❌ อัพเดทสต๊อกผิดพลาด: ' + String((e as any)?.message || e).slice(0, 200))]); } catch (_) {} }
        })();
        if (typeof (globalThis as any).EdgeRuntime !== 'undefined') (globalThis as any).EdgeRuntime.waitUntil(work); else await work;
        continue;
      }
    }

    // ---------- ส่งงาน: รับรูป / ข้อความ ----------
    if (lk && (mt === 'image' || mt === 'text')) {
      const t0 = mt === 'text' ? String(ev.message.text).trim() : '';
      const { data: pend } = await sb.from('line_pending').select('*').eq('line_user_id', uid).gt('expires', new Date().toISOString()).maybeSingle();
      if (pend && pend.ja_id !== 'stock-update' && pend.ja_id !== 'item-search' && !(mt === 'text' && CMDS.includes(t0))) {
        const { a } = await loadJa(pend.ja_id, lk.user_id);
        const title = a ? String(a.no || '') + ' ' + String(a.title || '') : pend.ja_id;
        if (mt === 'text' && DONE_WORDS.includes(t0)) {
          await sb.from('line_pending').delete().eq('line_user_id', uid);
          if (t0 === 'ยกเลิก' && !pend.n) { await reply(ev.replyToken, txt('ยกเลิกการส่งงานแล้ว')); continue; }
          await reply(ev.replyToken, txt('✅ ส่งงาน ' + title + ' เรียบร้อย (บันทึก ' + pend.n + ' รายการ) ดูในโปรแกรมที่บันทึกของงานได้เลย'));
          if (a && pend.n > 0) { const { data: p } = await sb.from('profiles').select('name,username').eq('id', lk.user_id).maybeSingle(); await pushTo([a.createdById, ...(a.assignees || []).map((x: any) => x.id), ...(await leaders())].filter((x: string) => x && x !== lk.user_id), [txt('📤 ' + (p?.name || p?.username || '') + ' ส่งงาน ' + title + ' (' + pend.n + ' รายการ) — ดูบันทึกในโปรแกรม')]); }
          continue;
        }
        let files: string[] = [], text = '';
        if (mt === 'image') {
          const r = await fetch('https://api-data.line.me/v2/bot/message/' + ev.message.id + '/content', { headers: { Authorization: 'Bearer ' + token } });
          if (!r.ok) { await reply(ev.replyToken, txt('ดึงรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง')); continue; }
          const ct = r.headers.get('content-type') || 'image/jpeg';
          const ext = ct.includes('png') ? 'png' : 'jpg';
          const path = 'ja/' + pend.ja_id + '/' + crypto.randomUUID().replace(/-/g, '').slice(0, 12) + '.' + ext;
          const up = await sb.storage.from('ja-files').upload(path, new Uint8Array(await r.arrayBuffer()), { contentType: ct });
          if (up.error) { await reply(ev.replyToken, txt('บันทึกรูปไม่สำเร็จ ลองส่งใหม่อีกครั้ง')); continue; }
          files = [path];
        } else text = t0;
        const { error } = await sb.rpc('line_add_note', { p_ja: pend.ja_id, p_user: lk.user_id, p_text: text, p_files: files });
        if (error) { await reply(ev.replyToken, txt('บันทึกไม่สำเร็จ: ' + error.message)); continue; }
        await sb.from('line_pending').update({ n: pend.n + 1, expires: new Date(Date.now() + 20 * 60000).toISOString() }).eq('line_user_id', uid);
        if (pend.n === 0 || mt === 'text') await reply(ev.replyToken, txt((mt === 'image' ? '✅ บันทึกรูปแล้ว' : '📝 บันทึกข้อความแล้ว') + ' ส่งเพิ่มได้เลย · พิมพ์ "เสร็จ" เมื่อครบ'));
        continue;
      }
      if (mt === 'image') { await reply(ev.replyToken, txt('ถ้าจะส่งรูปงาน ให้กดปุ่ม "📤 ส่งงาน" ที่การ์ดของงานนั้นใน "งานของฉัน" ก่อนครับ')); continue; }
    }
    if (mt !== 'text') continue;

    // ---------- คำสั่งข้อความ ----------
    const text = String(ev.message.text).trim();
    if (text === 'ช่วยเหลือ') { await reply(ev.replyToken, txt(HELP)); continue; }
    const m = text.match(/^\D*(\d{6})\D*$/);
    if (m && !lk || (m && lk && /^\d{6}$/.test(text))) {
      const { data } = await sb.from('line_codes').select('*').eq('code', m![1]).gt('expires', new Date().toISOString()).maybeSingle();
      if (!data && !lk) await reply(ev.replyToken, txt('รหัสไม่ถูกต้องหรือหมดอายุ (อายุ 10 นาที) กรุณาขอรหัสใหม่ในแอป'));
      if (data) {
        await sb.from('line_links').delete().eq('line_user_id', uid);
        const { error } = await sb.from('line_links').upsert({ user_id: data.user_id, line_user_id: uid, linked_at: new Date().toISOString() }, { onConflict: 'user_id' });
        await sb.from('line_codes').delete().eq('code', m![1]);
        await reply(ev.replyToken, txt(error ? 'ผูกบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง' : 'ผูกบัญชีสำเร็จ ✅ ต่อไปจะได้รับแจ้งเตือนงานที่เกี่ยวกับคุณทาง LINE นี้ · กดเมนูด้านล่างเพื่อดู "งานของฉัน" ได้เลย'));
        continue;
      }
      if (!lk) continue;
    }
    if (!lk) { await reply(ev.replyToken, txt('พิมพ์รหัส 6 หลักจากเมนู "🔔 ผูก LINE" ในแอปเพื่อผูกบัญชี (พิมพ์ "ช่วยเหลือ" เพื่อดูวิธีใช้)')); continue; }
    const { data: prof } = await sb.from('profiles').select('role,disabled').eq('id', lk.user_id).maybeSingle();
    if (prof?.disabled) continue;
    const isAdm = prof?.role === 'admin';
    const off: string[] = isAdm ? [] : await offList(lk.user_id);

    if (text === 'งานของฉัน') {
      if (off.includes('jobs')) { await reply(ev.replyToken, txt(FEAT_OFF_MSG)); continue; }
      const { data: rows } = await sb.from('records').select('data').eq('col', 'ja').contains('data', { assignees: [{ id: lk.user_id }] }).neq('data->>status', 'done').limit(50);
      const list = (rows || []).map((r: any) => r.data).sort((a: any, b: any) => String(a.end || '9999').localeCompare(String(b.end || '9999'))).slice(0, 10);
      if (!list.length) { await reply(ev.replyToken, txt('ตอนนี้ไม่มีงานที่ค้างอยู่ 🎉')); continue; }
      const T = (t: string, o: any = {}) => ({ type: 'text', text: t, size: 'xs', color: '#555555', wrap: true, ...o });
      const bubbles = list.map((a: any) => {
        const tasks: any[] = a.tasks || [], done = tasks.filter((t) => t.done).length;
        const body: any[] = [
          { type: 'text', text: String(a.no || ''), size: 'xs', color: '#0f6e84', weight: 'bold' },
          { type: 'text', text: String(a.title || '(ไม่มีชื่องาน)'), size: 'md', wrap: true, weight: 'bold' },
        ];
        if (a.customer) body.push(T('ลูกค้า: ' + a.customer));
        body.push(T('กำหนด: ' + (a.end ? thDate(a.end) : 'ไม่ระบุ') + (a.start ? ' (เริ่ม ' + thDate(a.start) + ')' : '')));
        const as = (a.assignees || []).map((x: any) => x.name).join(', '); if (as) body.push(T('ผู้รับผิดชอบ: ' + as));
        if (a.createdBy) body.push(T('ผู้สั่งงาน: ' + a.createdBy));
        if (a.detail) { body.push(T('รายละเอียดงาน', { margin: 'md', weight: 'bold', color: '#0f6e84' })); body.push({ type: 'text', text: String(a.detail).slice(0, 800), size: 'sm', wrap: true }); }
        if (a.note) { body.push(T('Remark งานที่ได้รับมอบหมาย', { margin: 'md', weight: 'bold', color: '#0f6e84' })); body.push(T(String(a.note).slice(0, 300))); }
        if (tasks.length) { body.push(T('งานที่ต้องทำ ' + done + '/' + tasks.length, { margin: 'md', weight: 'bold', color: '#0f6e84' })); tasks.slice(0, 15).forEach((t) => body.push(T((t.done ? '✅ ' : '⬜ ') + t.text + (t.who ? (t.who.id === lk.user_id ? ' (คุณ)' : ' (' + t.who.name + ')') : '')))); }
        const L: any[] = a.lines || [];
        if (L.length) { body.push(T('วัสดุที่ต้องเบิก ' + L.length + ' รายการ', { margin: 'md', weight: 'bold', color: '#0f6e84' })); L.slice(0, 25).forEach((l) => body.push(T('• ' + (l.name || '') + ' ×' + n0(l.qty) + ' ' + (l.unit || '') + (Number(l.wdQty) > 0 ? ' (เบิกแล้ว ' + n0(l.wdQty) + ')' : '')))); if (L.length > 25) body.push(T('…และอีก ' + (L.length - 25) + ' รายการ (ดูครบใน PDF)', { color: '#999999' })); }
        const fl: any[] = a.files || [];
        if (fl.length) body.push(T('แบบแนบ: ไฟฟ้า ' + fl.filter((f) => f.kind === 'elec').length + ' · เครื่องกล ' + fl.filter((f) => f.kind === 'mech').length + ' ไฟล์', { margin: 'md' }));
        return { type: 'bubble', size: 'mega', header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingAll: '10px', contents: [{ type: 'text', text: '📋 งานของฉัน', color: '#ffffff', weight: 'bold', size: 'sm' }] }, body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body }, footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: jaBtns(a, a.id, off) } };
      });
      await reply(ev.replyToken, { type: 'flex', altText: 'งานของฉัน ' + list.length + ' งาน', contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles } });
      continue;
    }

    // ---- เมนู (ซ้อนหลายชั้น) / โหมดค้นหาสินค้า ----
    const perm = isAdm ? 'full' : (lk.stock_perm || 'none');
    const canStk = isAdm || (await stockUpdaters()).includes(lk.user_id);
    const rowBtn = (icon: string, color: string, label: string, sub: string, action: any) => ({ type: 'box', layout: 'horizontal', spacing: 'md', alignItems: 'center', backgroundColor: '#F1F6F8', cornerRadius: 'lg', paddingAll: 'md', margin: 'md', action, contents: [
      { type: 'box', layout: 'vertical', width: '52px', height: '52px', cornerRadius: 'lg', backgroundColor: color, justifyContent: 'center', alignItems: 'center', flex: 0, contents: [{ type: 'text', text: icon, size: 'xl', align: 'center' }] },
      { type: 'box', layout: 'vertical', flex: 1, contents: [{ type: 'text', text: label, size: 'lg', weight: 'bold', color: '#14323C', wrap: true }, ...(sub ? [{ type: 'text', text: sub, size: 'xs', color: '#7A8B93', wrap: true }] : [])] },
      { type: 'text', text: '›', size: 'xxl', color: '#9FB3BB', flex: 0, gravity: 'center' }] });
    const M = (icon: string, color: string, label: string, sub: string, t: string) => rowBtn(icon, color, label, sub, { type: 'message', label: label.slice(0, 20), text: t });
    const U = (icon: string, color: string, label: string, sub: string, uri: string) => rowBtn(icon, color, label, sub, { type: 'uri', label: label.slice(0, 20), uri });
    const menuCard = (title: string, hint: string, rows: any[]) => ({ type: 'flex', altText: title, contents: { type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingTop: '22px', paddingBottom: '18px', paddingStart: '20px', paddingEnd: '20px', contents: [{ type: 'text', text: title, color: '#ffffff', weight: 'bold', size: '3xl', wrap: true }, { type: 'text', text: hint, color: '#CFE6EC', size: 'sm', wrap: true, margin: 'sm' }] },
      body: { type: 'box', layout: 'vertical', paddingAll: '14px', contents: rows } } });
    const mainMenu = (hint: string) => menuCard('เมนูทั้งหมด', hint, [
      M('📦', '#BFEBDD', 'สต๊อก', 'ค้นหาสินค้า · ของใกล้หมด · อัพเดทสต๊อก', 'เมนู:สต๊อก'),
      ...(off.includes('jobs') ? [] : [M('📋', '#FFE0BD', 'งาน', 'งานของฉัน · ส่งงาน', 'เมนู:งาน')]),
      M('❓', '#E3D4FF', 'วิธีใช้งาน', 'ดูคำอธิบายทุกฟีเจอร์', 'ช่วยเหลือ'),
      U('🖥', '#C9E4FF', 'เปิดโปรแกรม', 'เปิดในเบราว์เซอร์', BASE + '?openExternalBrowser=1')]);
    if (text === 'เมนู') { await reply(ev.replyToken, mainMenu('เลือกหมวดที่ต้องการ')); continue; }
    if (text === 'เมนู:สต๊อก') {
      const f: any[] = [];
      if (perm !== 'none') f.push(M('🔎', '#C9E4FF', 'ค้นหาสินค้า', 'เช็คของ พิมพ์รหัสหรือชื่อสินค้า', 'ค้นหาสินค้า'));
      if (perm !== 'none' || canStk) f.push(M('⚠️', '#FFD6D6', 'ของใกล้หมด', 'ต่ำกว่าขั้นต่ำ · ต้องซื้อเพิ่ม', 'ของใกล้หมด'));
      if (canStk) f.push(M('📦', '#BFEBDD', 'อัพเดทสต๊อก', 'ส่งไฟล์ Excel / CSV จาก Express', 'อัพเดทสต๊อก'));
      f.push(U('🖥', '#E3D4FF', 'เปิดสต๊อกในโปรแกรม', 'ดูรายการเต็มในเบราว์เซอร์', BASE + '?go=items&openExternalBrowser=1'), M('‹', '#E4EBEE', 'กลับเมนูทั้งหมด', '', 'เมนู'));
      await reply(ev.replyToken, menuCard('สต๊อก', perm === 'none' && !canStk ? 'คุณยังไม่ได้รับสิทธิ์ใช้งานสต๊อกทาง LINE — ติดต่อผู้ดูแลระบบ' : 'เลือกสิ่งที่ต้องการ', f)); continue;
    }
    if (text === 'เมนู:งาน') {
      if (off.includes('jobs')) { await reply(ev.replyToken, txt(FEAT_OFF_MSG)); continue; }
      await reply(ev.replyToken, menuCard('งาน', 'เลือกสิ่งที่ต้องการ', [M('📋', '#FFE0BD', 'งานของฉัน', 'ดูงานที่ค้าง · รายการของ · ส่งงาน', 'งานของฉัน'), U('🖥', '#C9E4FF', 'เปิดงานในโปรแกรม', 'ดูรายละเอียดเต็มในเบราว์เซอร์', BASE + '?go=monitor&openExternalBrowser=1'), M('‹', '#E4EBEE', 'กลับเมนูทั้งหมด', '', 'เมนู')])); continue;
    }
    if (text === 'ของใกล้หมด') {
      if (perm === 'none' && !canStk) { await reply(ev.replyToken, txt('คุณยังไม่ได้รับสิทธิ์ดูข้อมูลสต๊อกทาง LINE ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์')); continue; }
      const all: any[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await sb.from('records').select('data').eq('col', 'items').order('id').range(from, from + 999);
        (data || []).forEach((r: any) => all.push(r.data));
        if (!data || data.length < 1000) break;
      }
      const low = all.filter((i: any) => (Number(i.min) || 0) > 0 && (Number(i.stock) || 0) <= Number(i.min)).sort((a: any, b: any) => (Number(a.stock) || 0) / Number(a.min) - (Number(b.stock) || 0) / Number(b.min));
      if (!low.length) { await reply(ev.replyToken, txt('ตอนนี้ไม่มีสินค้าที่ต่ำกว่าขั้นต่ำ 🎉')); continue; }
      const zero = low.filter((i: any) => (Number(i.stock) || 0) <= 0).length;
      const PER = 8, MAXB = 10, shown = low.slice(0, PER * MAXB), pages = Math.ceil(shown.length / PER);
      const TT = (t: string, o: any = {}) => ({ type: 'text', text: t, size: 'xs', color: '#555555', wrap: true, ...o });
      const bubbles: any[] = [];
      for (let p = 0; p < pages; p++) {
        const part = shown.slice(p * PER, (p + 1) * PER), items: any[] = [];
        part.forEach((it: any, i: number) => {
          if (i) items.push({ type: 'separator', margin: 'sm' });
          const st = Number(it.stock) || 0, mn = Number(it.min) || 0, buy = Number(it.buyQty) > 0 ? Number(it.buyQty) : Math.max(1, mn * 2 - st), u = String(it.unit || '');
          items.push({ type: 'box', layout: 'vertical', margin: 'sm', contents: [
            TT((st <= 0 ? '🔴 ' : '🟠 ') + String(it.code || ''), { color: '#0f6e84', weight: 'bold' }),
            TT(String(it.name || '')),
            TT('เหลือ ' + n0(st) + ' / ขั้นต่ำ ' + n0(mn) + ' ' + u, { color: st <= 0 ? '#c0392b' : '#b7791f', weight: 'bold', size: 'sm' }),
            TT('ควรซื้อเพิ่ม ' + n0(buy) + ' ' + u, { color: '#14323C', weight: 'bold', size: 'sm' })] });
        });
        bubbles.push({ type: 'bubble', size: 'mega',
          header: { type: 'box', layout: 'vertical', backgroundColor: '#c0392b', paddingAll: '12px', contents: [
            { type: 'text', text: '⚠️ ของใกล้หมด / ต้องซื้อเพิ่ม', color: '#ffffff', weight: 'bold', size: 'sm' },
            { type: 'text', text: 'ทั้งหมด ' + low.length + ' รายการ (หมด ' + zero + ') · หน้า ' + (p + 1) + '/' + pages + (pages > 1 ? ' (เลื่อนซ้าย-ขวา)' : ''), color: '#FFE0DC', size: 'xs' }] },
          body: { type: 'box', layout: 'vertical', contents: items },
          footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [{ type: 'button', style: 'primary', color: '#b7791f', height: 'sm', action: { type: 'postback', label: '🛒 ขอใบสั่งซื้อ (PDF)', data: 'pol', displayText: '🛒 ขอใบสั่งซื้อ (PDF)' } }, { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดหน้ารายการในโปรแกรม', uri: BASE + '?go=lowstock&openExternalBrowser=1' } }] } });
      }
      await reply(ev.replyToken, { type: 'flex', altText: '⚠️ ของใกล้หมด ' + low.length + ' รายการ (หมด ' + zero + ')', contents: bubbles.length === 1 ? bubbles[0] : { type: 'carousel', contents: bubbles } });
      continue;
    }
    if (text === 'ค้นหาสินค้า') {
      if (perm === 'none') { await reply(ev.replyToken, txt('คุณยังไม่ได้รับสิทธิ์ค้นหาสินค้าทาง LINE ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์')); continue; }
      await sb.from('line_pending').upsert({ line_user_id: uid, ja_id: 'item-search', expires: new Date(Date.now() + 10 * 60000).toISOString(), n: 0 }, { onConflict: 'line_user_id' });
      await reply(ev.replyToken, txt('🔎 โหมดค้นหาสินค้า\n\nพิมพ์รหัสหรือชื่อสินค้าได้เลย เช่น A9F74320 (ค้นต่อได้หลายครั้ง อยู่ในโหมดนี้ 10 นาที)\nพิมพ์ "เสร็จ" เมื่อค้นครบ'));
      continue;
    }
    const { data: sp } = await sb.from('line_pending').select('*').eq('line_user_id', uid).eq('ja_id', 'item-search').gt('expires', new Date().toISOString()).maybeSingle();
    if (!sp) { await reply(ev.replyToken, mainMenu('ถ้าจะค้นหาสินค้า ให้กด สต๊อก › ค้นหาสินค้า ก่อน แล้วค่อยพิมพ์รหัส')); continue; }
    if (DONE_WORDS.includes(text)) { await sb.from('line_pending').delete().eq('line_user_id', uid); await reply(ev.replyToken, txt('ออกจากโหมดค้นหาแล้ว — พิมพ์ "เมนู" เพื่อดูเมนู')); continue; }
    if (perm === 'none') { await reply(ev.replyToken, txt('คุณยังไม่ได้รับสิทธิ์ค้นหาสินค้าทาง LINE ติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์')); continue; }
    await sb.from('line_pending').update({ expires: new Date(Date.now() + 10 * 60000).toISOString() }).eq('line_user_id', uid);
    const q = text.replace(/[,()%*\\"']/g, ' ').trim();
    if (q.length < 2) { await reply(ev.replyToken, txt('พิมพ์อย่างน้อย 2 ตัวอักษรครับ')); continue; }
    const CAP = PER_BUBBLE * PER_MSG * MAX_MSG;
    const { data: rows } = await sb.from('records').select('data').eq('col', 'items').or(`data->>code.ilike.*${q}*,data->>name.ilike.*${q}*`).limit(1000);
    const ql = q.toLowerCase();
    const found = (rows || []).map((r: any) => r.data).sort((a: any, b: any) => {
      const sc = (x: any) => String(x.code || '').toLowerCase() === ql ? 0 : String(x.code || '').toLowerCase().startsWith(ql) ? 1 : 2;
      return sc(a) - sc(b) || String(a.code || '').localeCompare(String(b.code || ''));
    });
    if (!found.length) { await reply(ev.replyToken, txt('ไม่พบสินค้าที่ตรงกับ "' + q + '"')); continue; }
    const whNames = ((await getSettings()).whNames) || {};
    const show = found.slice(0, CAP);
    const rowOf = (it: any) => {
      const stock = Number(it.stock) || 0, min = Number(it.min) || 0;
      const low = min > 0 && stock <= min;
      const whs = String(it.stockWh || '').split(';').map((x: string) => x.trim()).filter(Boolean).map((x: string) => { const k = x.indexOf(':'); const c = (k < 0 ? x : x.slice(0, k)).trim(); return (whNames[c] || 'คลัง ' + c) + ': ' + n0(k < 0 ? 0 : x.slice(k + 1)); });
      const c: any[] = [
        { type: 'text', text: String(it.code || ''), size: 'xs', color: '#0f6e84', weight: 'bold', wrap: true },
        { type: 'text', text: String(it.name || ''), size: 'sm', weight: 'bold', wrap: true },
        { type: 'text', text: 'คงเหลือ ' + n0(stock) + ' ' + (it.unit || '') + (low ? '  ⚠ ต่ำกว่าจุดสั่งซื้อ' : ''), size: 'sm', color: low ? '#c0392b' : '#2e8b57', weight: 'bold', wrap: true },
      ];
      if (whs.length) c.push({ type: 'text', text: whs.join(' · '), size: 'xs', color: '#777777', wrap: true });
      if (perm === 'full') {
        if (Number(it.cost) > 0) c.push({ type: 'text', text: 'ต้นทุน ' + n0(it.cost) + ' บาท' + (it.costDate ? ' (' + thDate(it.costDate) + ')' : ''), size: 'xs', color: '#555555', wrap: true });
        const sup = (it.suppliers || []).filter((s: any) => Number(s.price) > 0).sort((a: any, b: any) => Number(a.price) - Number(b.price)).slice(0, 2);
        sup.forEach((s: any) => c.push({ type: 'text', text: 'ราคา ' + n0(s.price) + ' · ' + (s.name || '') + (s.date ? ' (' + thDate(s.date) + ')' : ''), size: 'xs', color: '#555555', wrap: true }));
      }
      return { type: 'box', layout: 'vertical', margin: 'md', spacing: 'xs', contents: c };
    };
    const pages = Math.ceil(show.length / PER_BUBBLE);
    const bubbles: any[] = [];
    for (let p = 0; p < pages; p++) {
      const part = show.slice(p * PER_BUBBLE, (p + 1) * PER_BUBBLE);
      const items: any[] = [];
      part.forEach((it: any, i: number) => { if (i) items.push({ type: 'separator', margin: 'md' }); items.push(rowOf(it)); });
      bubbles.push({ type: 'bubble', size: 'mega',
        header: { type: 'box', layout: 'vertical', backgroundColor: '#0f6e84', paddingAll: '12px', contents: [
          { type: 'text', text: '🔎 ' + q, color: '#ffffff', weight: 'bold', wrap: true },
          { type: 'text', text: 'พบ ' + found.length + ' รายการ · หน้า ' + (p + 1) + '/' + pages + (pages > 1 ? ' (เลื่อนซ้าย-ขวา)' : ''), color: '#d6eaf0', size: 'xs' }] },
        body: { type: 'box', layout: 'vertical', contents: items } });
    }
    const msgs: any[] = [];
    for (let i = 0; i < bubbles.length; i += PER_MSG) {
      const chunk = bubbles.slice(i, i + PER_MSG);
      msgs.push({ type: 'flex', altText: 'ผลค้นหา "' + q + '" ' + found.length + ' รายการ', contents: chunk.length === 1 ? chunk[0] : { type: 'carousel', contents: chunk } });
    }
    await reply(ev.replyToken, ...msgs.slice(0, 5));
  }
  return new Response('ok');
});
