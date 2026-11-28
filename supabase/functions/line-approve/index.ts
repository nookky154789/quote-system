import { createClient } from 'npm:@supabase/supabase-js@2';
const BASE = 'https://nookky154789.github.io/quote-system/';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const n0 = (x: any) => (Number(x) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const T = (t: string, o: any = {}) => ({ type: 'text', text: t, size: 'xs', color: '#555555', wrap: true, ...o });
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const SU = Deno.env.get('SUPABASE_URL')!, SK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, token = Deno.env.get('LINE_TOKEN')!;
  const sb = createClient(SU, SK);
  const J = (o: any, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const svc = bearer === SK;
  let caller: any = null;
  if (!svc) {
    const { data } = await sb.auth.getUser(bearer);
    if (!data?.user) return J({ ok: false, error: 'unauthorized' }, 401);
    const { data: p } = await sb.from('profiles').select('id,name,username,role,disabled').eq('id', data.user.id).maybeSingle();
    if (!p || p.disabled) return J({ ok: false, error: 'unauthorized' }, 401);
    caller = p;
  }
  let b: any = {}; try { b = await req.json(); } catch (_) {}
  const col = b.kind === 'po' ? 'po' : b.kind === 'wd' ? 'withdrawals' : null;
  if (!col || !b.id) return J({ ok: false, error: 'bad request' }, 400);
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const reply = (rt: string, text: string) => fetch('https://api.line.me/v2/bot/message/reply', { method: 'POST', headers: H, body: JSON.stringify({ replyToken: rt, messages: [{ type: 'text', text }] }) });
  let pushErr = '';
  const multicast = async (to: string[], messages: any[]) => { for (let i = 0; i < to.length; i += 500) { try { const r = await fetch('https://api.line.me/v2/bot/message/multicast', { method: 'POST', headers: H, body: JSON.stringify({ to: to.slice(i, i + 500), messages }) }); if (!r.ok) pushErr = 'LINE ' + r.status + ' ' + (await r.text()).slice(0, 120); } catch (e) { pushErr = String((e as Error).message || e); } } };
  const { data: st } = await sb.from('records').select('data').eq('col', 'settings').eq('id', 'main').maybeSingle();
  const S: any = st?.data || {};
  const { data: rec } = await sb.from('records').select('data').eq('col', col).eq('id', b.id).maybeSingle();

  if (b.action === 'request') {
    if (!rec) return J({ ok: false, error: 'not found' });
    let d: any = rec.data;
    if (b.setPending && svc) {
      d = { ...d, appr: { st: 'pending', by: d.requester || '', byId: d.byId || '', ts: Date.now() } };
      await sb.from('records').update({ data: d, updated_by: d.byId || null }).eq('col', col).eq('id', b.id);
    }
    // แจ้งฝ่ายจัดซื้อพร้อม PDF (ถ้าตำแหน่งถูกตั้งไว้ และยังไม่เคยแจ้ง)
    try { await fetch(SU + '/functions/v1/purchase-notify', { method: 'POST', headers: { Authorization: 'Bearer ' + SK, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: b.kind, id: b.id }) }); } catch (_) {}
    const ap = d.appr;
    if (ap?.st !== 'pending') return J({ ok: false, error: 'not pending' });
    if (S.lineOn === false) return J({ ok: true, n: 0 });
    const { data: profs } = await sb.from('profiles').select('id,role,disabled');
    const act = new Set((profs || []).filter((p: any) => !p.disabled).map((p: any) => p.id));
    const adm = (profs || []).filter((p: any) => p.role === 'admin' && !p.disabled).map((p: any) => p.id);
    let ids: string[] = [...new Set<string>([...adm, ...((S.approvers || []) as string[]).filter((i) => act.has(i))])];
    const others = ids.filter((i) => i !== ap.byId); if (others.length) ids = others;
    const { data: ls } = await sb.from('line_links').select('line_user_id').in('user_id', ids.length ? ids : ['-']);
    const to = (ls || []).map((l: any) => l.line_user_id);
    if (!to.length) return J({ ok: true, n: 0 });
    const isPo = b.kind === 'po', L: any[] = d.lines || [];
    const total = L.reduce((s: number, l: any) => s + (Number(l.qty) || 0) * (Number(l.price) || 0), 0);
    const body: any[] = [
      { type: 'text', text: String(d.no || ''), size: 'xl', weight: 'bold', color: '#14323C' },
      T((isPo ? 'ผู้ขาย: ' + (d.supplier || '-') + (d.job ? ' · อ้างอิง ' + d.job : '') : 'งาน: ' + (d.job || '-'))),
      T('ผู้ขอ: ' + (ap.by || d.requester || '-') + ' · ' + L.length + ' รายการ' + (isPo ? ' · รวม ' + n0(total) + ' บาท' : ''), { weight: 'bold', color: '#14323C' }),
    ];
    L.slice(0, 8).forEach((l: any, i: number) => body.push(T((i + 1) + '. ' + String(l.name || '') + ' ×' + n0(l.qty) + ' ' + String(l.unit || '') + (isPo && Number(l.price) > 0 ? ' @' + n0(l.price) : ''), { margin: i ? 'xs' : 'md' })));
    if (L.length > 8) body.push(T('…และอีก ' + (L.length - 8) + ' รายการ — ดูครบในโปรแกรม', { color: '#999999' }));
    const pb = (label: string, data: string, color: string) => ({ type: 'button', style: 'primary', color, height: 'sm', action: { type: 'postback', label, data, displayText: label } });
    const msg = { type: 'flex', altText: (isPo ? 'ขออนุมัติใบสั่งซื้อ ' : 'ขออนุมัติใบเบิกของ ') + (d.no || ''), contents: { type: 'bubble', size: 'mega',
      header: { type: 'box', layout: 'vertical', backgroundColor: isPo ? '#b7791f' : '#0f6e84', paddingTop: '18px', paddingBottom: '14px', paddingStart: '18px', paddingEnd: '18px', contents: [{ type: 'text', text: isPo ? 'ขออนุมัติใบสั่งซื้อ' : 'ขออนุมัติใบเบิกของ', color: '#ffffff', weight: 'bold', size: 'xl' }] },
      body: { type: 'box', layout: 'vertical', spacing: 'xs', contents: body },
      footer: { type: 'box', layout: 'vertical', spacing: 'sm', contents: [
        { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [pb('✅ อนุมัติ', 'ap:ok:' + b.kind + ':' + b.id, '#2e8b57'), pb('❌ ไม่อนุมัติ', 'ap:no:' + b.kind + ':' + b.id, '#c0392b')] },
        { type: 'button', style: 'secondary', height: 'sm', action: { type: 'uri', label: 'เปิดในโปรแกรม', uri: BASE + '?go=' + (isPo ? 'po' : 'withdrawals') + '&openExternalBrowser=1' } }] } } };
    await multicast(to, [msg]);
    return J({ ok: true, n: to.length, pushErr, skippedRequester: others.length > 0 && !!ap.byId });
  }

  if (b.action === 'decide') {
    if (!svc) return J({ ok: false, error: 'forbidden' }, 403);
    const rt: string = b.replyToken || '';
    const say = async (t: string) => { if (rt) await reply(rt, t); };
    const { data: lk } = await sb.from('line_links').select('user_id').eq('line_user_id', b.lineUserId).maybeSingle();
    if (!lk) return J({ ok: false });
    const { data: p } = await sb.from('profiles').select('id,name,username,role,disabled').eq('id', lk.user_id).maybeSingle();
    const isAp = !!p && !p.disabled && (p.role === 'admin' || ((S.approvers || []) as string[]).includes(lk.user_id));
    if (!isAp) { await say('คุณไม่มีสิทธิ์อนุมัติเอกสาร — ติดต่อผู้ดูแลระบบ'); return J({ ok: false }); }
    if (!rec) { await say('ไม่พบเอกสาร (อาจถูกลบแล้ว)'); return J({ ok: false }); }
    const ap = rec.data.appr;
    if (!ap || ap.st !== 'pending') { await say('เอกสารนี้ดำเนินการแล้ว: ' + (ap?.st === 'approved' ? 'อนุมัติ' : ap?.st === 'rejected' ? 'ไม่อนุมัติ' : 'ยังไม่ได้ขออนุมัติ') + (ap?.decBy ? ' โดย ' + ap.decBy : '')); return J({ ok: false }); }
    const ok = b.decision === 'ok', who = p.name || p.username;
    const nd: any = { ...rec.data, appr: { ...ap, st: ok ? 'approved' : 'rejected', decBy: who, decById: lk.user_id, at: Date.now() } };
    if (!ok && b.kind === 'wd') nd.status = 'rejected';
    const { data: upd } = await sb.from('records').update({ data: nd, updated_by: lk.user_id }).eq('col', col).eq('id', b.id).eq('data->appr->>st', 'pending').select('id');
    if (!upd?.length) { await say('เอกสารนี้ถูกดำเนินการไปแล้ว'); return J({ ok: false }); }
    const no = String(rec.data.no || '');
    await say((ok ? '✅ อนุมัติ ' : '❌ ไม่อนุมัติ ') + (b.kind === 'po' ? 'ใบสั่งซื้อ ' : 'ใบเบิกของ ') + no + ' แล้ว');
    if (ap.byId && ap.byId !== lk.user_id) {
      const { data: rl } = await sb.from('line_links').select('line_user_id').eq('user_id', ap.byId).maybeSingle();
      if (rl) await multicast([rl.line_user_id], [{ type: 'text', text: (ok ? '✅ ' : '❌ ') + (b.kind === 'po' ? 'ใบสั่งซื้อ ' : 'ใบเบิกของ ') + no + (ok ? ' ได้รับอนุมัติ' : ' ไม่ได้รับอนุมัติ') + ' โดย ' + who }]);
    }
    return J({ ok: true });
  }
  return J({ ok: false, error: 'bad action' }, 400);
});
