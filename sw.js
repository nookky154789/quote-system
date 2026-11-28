// Service worker: เก็บเฉพาะไฟล์หน้าเว็บ (ไม่เก็บข้อมูลธุรกิจ) เพื่อให้ติดตั้งเป็นแอปได้และเปิดเร็ว
// หน้าเว็บใช้ "เครือข่ายก่อน" เพื่อให้ได้เวอร์ชันล่าสุดเสมอ ถ้าออฟไลน์จึงใช้ที่เก็บไว้
const V = 'qs-shell-v4';
const SHELL = ['./', 'index.html', 'config.js', 'vendor/supabase.js', 'pdfbom.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.all(SHELL.map(u => fetch(u,{cache:'reload'}).then(r => r.ok ? c.put(u,r) : null).catch(() => {})))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // ไม่ยุ่งกับ Supabase / ฟอนต์
  const st = /\/(vendor|fonts)\//.test(u.pathname); // ไฟล์ไลบรารี/ฟอนต์: ใช้ที่เก็บไว้ก่อน แล้วอัปเดตเบื้องหลัง
  const net = () => fetch(e.request,{cache:st?'default':'no-store'}).then(r => { if(r.ok){ const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); } return r; });
  e.respondWith(st ? caches.match(e.request).then(h => { const n = net().catch(() => h); return h || n; }) : net().catch(() => caches.match(e.request)));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs => {
    for (const c of cs) { if ('focus' in c) return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
