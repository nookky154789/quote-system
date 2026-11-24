/* อ่านรายการวัสดุจาก PDF (ข้อความในไฟล์ PDF เท่านั้น ไม่ใช่ OCR)
   ใช้ pdf.js (vendor/pdf.min.js) ดึงข้อความ แล้วหาตาราง BOM จากหัวตาราง ถ้าไม่เจอตารางจะคืนข้อความทีละบรรทัดให้เลือกเอง */
(function(root){
  var HDR = {
    qty:   /(\bq'?ty\b|\bquantity\b|\bqnty\b|จำนวน)/i,
    name:  /(description|\bdesc\b|part\s*name|\bname\b|รายการ|ชื่อ|รายละเอียด|\bitem\s*name)/i,
    code:  /(part\s*(no|number|code)|\bcode\b|รหัส|drawing\s*no|\bdwg\b|p\/n)/i,
    size:  /(material|\bspec|\bsize\b|ขนาด|วัสดุ|สเปค|dimension)/i,
    model: /(\bmodel\b|รุ่น|\btype\b|ยี่ห้อ|\bbrand\b|\bmaker\b)/i,
    unit:  /(^unit$|หน่วย)/i,
    remark:/(remark|\bnote\b|หมายเหตุ)/i,
    no:    /(^item$|^no\.?$|^#$|^item\s*no|^ลำดับ|^ที่$|^pos\.?$|^mark$)/i
  };
  var ORDER = ['qty','name','code','size','model','unit','remark','no'];

  function numOf(s){ var m=String(s==null?'':s).replace(/,/g,'').match(/-?\d+(\.\d+)?/); return m?parseFloat(m[0]):null; }

  /* items: [{str,x,y,w,h}] ต่อหน้า -> บรรทัด (เรียง y มากไปน้อย) แต่ละบรรทัดมี cells เรียงตาม x */
  function toLines(items){
    var its=items.filter(function(i){return i.str&&i.str.trim();}).sort(function(a,b){return b.y-a.y||a.x-b.x;});
    var lines=[];
    its.forEach(function(it){
      var tol=Math.max(2,(it.h||8)*0.45), L=null;
      for(var k=lines.length-1;k>=0&&k>=lines.length-6;k--){ if(Math.abs(lines[k].y-it.y)<=tol){ L=lines[k]; break; } }
      if(!L){ L={y:it.y,h:it.h||8,items:[]}; lines.push(L); }
      L.items.push(it);
    });
    lines.forEach(function(L){
      L.items.sort(function(a,b){return a.x-b.x;});
      var cells=[], h=L.h||8;
      L.items.forEach(function(it){
        var c=cells[cells.length-1], x2=it.x+(it.w||0);
        if(c && it.x-c.x2 < h*0.6){ c.str+=(it.x-c.x2>h*0.15?' ':'')+it.str; c.x2=Math.max(c.x2,x2); }
        else cells.push({x:it.x,x2:x2,str:it.str});
      });
      cells.forEach(function(c){ c.str=c.str.replace(/\s+/g,' ').trim(); });
      L.cells=cells.filter(function(c){return c.str;});
    });
    return lines.filter(function(L){return L.cells.length;}).sort(function(a,b){return b.y-a.y;});
  }

  function headerOf(L){
    var cols=[], used={};
    L.cells.forEach(function(c){
      var s=c.str;
      for(var i=0;i<ORDER.length;i++){ var k=ORDER[i]; if(used[k]) continue; if(HDR[k].test(s)){ used[k]=1; cols.push({key:k,x:c.x,x2:c.x2}); return; } }
    });
    if(used.qty && used.name && cols.length>=3) return cols.sort(function(a,b){return a.x-b.x;});
    return null;
  }

  function colOf(cols,c){
    var best=-1,bo=0;
    for(var i=0;i<cols.length;i++){
      var lo=i===0?-1e9:(cols[i-1].x2+cols[i].x)/2, hi=i===cols.length-1?1e9:(cols[i].x2+cols[i+1].x)/2;
      var ov=Math.min(c.x2,hi)-Math.max(c.x,lo);
      if(ov>bo){ bo=ov; best=i; }
    }
    if(best>=0) return best;
    var cx=(c.x+c.x2)/2, d=1e9; for(var j=0;j<cols.length;j++){ var dj=Math.abs((cols[j].x+cols[j].x2)/2-cx); if(dj<d){d=dj;best=j;} }
    return best;
  }

  function rowOf(cols,L){
    var r={}; L.cells.forEach(function(c){ var k=cols[colOf(cols,c)].key; r[k]=r[k]?r[k]+' '+c.str:c.str; });
    return r;
  }

  function walk(cols,lines,start,dir,usedIdx){
    var rows=[], bad=0, last=null, prevY=lines[start].y, gapMax=Math.max(40,(lines[start].h||8)*6);
    for(var i=start+dir;i>=0&&i<lines.length;i+=dir){
      var L=lines[i];
      if(Math.abs(L.y-prevY)>gapMax) break;
      var r=rowOf(cols,L), hasNo=r.no!=null&&/^\d+$/.test(r.no.trim()), q=r.qty!=null?numOf(r.qty):null;
      var ok=(hasNo&&(r.name||r.code))||(r.name&&q!=null&&(r.no==null||hasNo));
      if(ok){ rows.push({no:hasNo?+r.no:null,name:(r.name||'').trim(),code:(r.code||'').trim(),size:[r.size,r.unit&&!r.size?r.unit:''].filter(Boolean).join(' ').trim(),model:(r.model||'').trim(),qty:q!=null?q:1,remark:(r.remark||'').trim(),_i:i}); last=rows[rows.length-1]; bad=0; prevY=L.y; }
      else if(last && r.name && !r.qty && r.no==null && Object.keys(r).length===1){ last.name+=' '+r.name.trim(); bad=0; prevY=L.y; } /* ชื่อที่ขึ้นบรรทัดใหม่ */
      else { bad++; if(bad>=2) break; prevY=L.y; }
    }
    return rows;
  }

  function parseTables(pages){
    var out=[];
    pages.forEach(function(items,pi){
      var lines=toLines(items), doneIdx={};
      for(var h=0;h<lines.length;h++){
        if(doneIdx[h]) continue;
        var cols=headerOf(lines[h]); if(!cols) continue;
        var below=walk(cols,lines,h,1), above=walk(cols,lines,h,-1);
        var rows=below.length>=above.length?below:above;
        rows.forEach(function(r){ doneIdx[r._i]=1; delete r._i; r.page=pi+1; out.push(r); });
      }
    });
    return out;
  }

  var NOISE=/^(scale|sheet|drawn|checked|approved|date|title|rev|revision|dwg|drawing|unit:?\s*mm|mm|tolerance|material|finish|weight|note|notes|qty)\b/i;
  function parseText(pages){
    var seen={}, out=[];
    pages.forEach(function(items,pi){
      toLines(items).forEach(function(L){
        L.cells.forEach(function(c){
          var s=c.str.trim();
          if(s.length<4) return;
          if(!/[A-Za-z฀-๿]{2,}/.test(s)) return;
          if(NOISE.test(s)) return;
          var qty=1, m;
          if((m=s.match(/(\d+)\s*(x|pcs|ea|ชิ้น|ตัว|อัน|ชุด|set)\b/i))){ qty=+m[1]; }
          else if((m=s.match(/\bx\s*(\d+)\b/i))){ qty=+m[1]; }
          var key=s.toLowerCase(); if(seen[key]) return; seen[key]=1;
          out.push({no:null,name:s,code:'',size:'',model:'',qty:qty,remark:'',page:pi+1});
        });
      });
    });
    return out;
  }

  /* pages: [ [ {str,x,y,w,h}, ... ], ... ] */
  function parse(pages){
    var chars=0; pages.forEach(function(p){ p.forEach(function(i){ chars+=i.str.length; }); });
    if(!chars) return {mode:'empty',rows:[],chars:0,pages:pages.length};
    var t=parseTables(pages);
    if(t.length){ if(t.every(function(r){return r.no!=null;})) t.sort(function(a,b){return a.page-b.page||a.no-b.no;}); return {mode:'table',rows:t,chars:chars,pages:pages.length}; }
    return {mode:'text',rows:parseText(pages),chars:chars,pages:pages.length};
  }

  /* ผลจาก pdf.js getTextContent().items -> รูปแบบที่ parse ใช้ (ข้ามข้อความที่หมุน) */
  function normalize(tcItems){
    var out=[];
    tcItems.forEach(function(it){
      if(!it.str||!it.str.trim()) return;
      var t=it.transform||[1,0,0,1,0,0];
      if(Math.abs(t[1])>Math.abs(t[0])*0.2) return;
      out.push({str:it.str,x:t[4],y:t[5],w:it.width||0,h:it.height||Math.abs(t[3])||8});
    });
    return out;
  }

  async function extract(file){
    var lib=root.pdfjsLib;
    if(!lib) throw new Error('ไม่พบตัวอ่าน PDF (vendor/pdf.min.js)');
    lib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';
    var buf=await file.arrayBuffer();
    var doc=await lib.getDocument({data:buf}).promise, pages=[];
    for(var p=1;p<=doc.numPages;p++){ var pg=await doc.getPage(p); var tc=await pg.getTextContent(); pages.push(normalize(tc.items)); }
    return pages;
  }

  var API={parse:parse,normalize:normalize,extract:extract,toLines:toLines};
  root.PDFBOM=API;
  if(typeof module!=='undefined'&&module.exports) module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
