/* ════════════════════════════════════════════════════════════════
   ws-layer.js — Foundation Lab · Workstation Behavior (display-only)
   ใช้คู่กับ ws-theme.css · ต้องโหลด "หลัง" สคริปต์ engine ของเครื่องมือ
   ไม่แตะการคำนวณ — อ่านผลแล้วแสดง:
     · ตาราง Design Check (D/C ratio) ลงใน #wsDash
     · สถานะ PASS/FAIL บน #wsStatus (appbar) + #wsSbStatus (status bar)
     · scrollspy ของ #secnav
   per-page config (ก่อนโหลดไฟล์นี้):
     window.WS_CONFIG = {
       renderFn: 'render',          // ชื่อฟังก์ชัน render ของ engine (default 'render')
       rows: function(){            // optional — คืน array ของแถว D/C
         return [{name,sub,dem,cap,unit,ratio,ok}, ...];
       }
     };
   ถ้าไม่มี rows → สร้างตารางสถานะจากชิป .chk และ .verdict ใน DOM แทน
   ════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  function $(s,c){ return (c||document).querySelector(s); }
  function $$(s,c){ return [].slice.call((c||document).querySelectorAll(s)); }
  function fmtN(x,n){
    return (typeof x==='number'&&isFinite(x))
      ? x.toLocaleString('en-US',{minimumFractionDigits:n,maximumFractionDigits:n}) : '–';
  }
  function ratCls(r,ok){
    if(!ok) return 'r-bad';
    if(!isFinite(r)) return 'r-ok';
    if(r>1.0001) return 'r-bad';
    if(r>0.85) return 'r-warn';
    return 'r-ok';
  }

  function buildRows(rows){
    return rows.map(function(o){
      var cls=ratCls(o.ratio,o.ok);
      var hasR=isFinite(o.ratio);
      var pct=hasR? Math.max(2,Math.min(100,(o.ratio/1.2)*100)) : (o.ok?2:100);
      return '<tr>'
        +'<td class="nm">'+o.name+(o.sub?'<small>'+o.sub+'</small>':'')+'</td>'
        +'<td class="num">'+fmtN(o.dem,2)+(o.unit?' <small>'+o.unit+'</small>':'')+'</td>'
        +'<td class="num">'+fmtN(o.cap,2)+(o.unit?' <small>'+o.unit+'</small>':'')+'</td>'
        +'<td class="rat '+cls+'">'+(hasR?fmtN(o.ratio,2):'–')+'</td>'
        +'<td class="barcell"><div class="dcbar"><i class="'+cls+'" style="width:'+pct.toFixed(1)+'%"></i></div></td>'
        +'<td><span class="dc-chip '+(o.ok?'ok':'bad')+'">'+(o.ok?'ผ่าน':'ไม่ผ่าน')+'</span></td>'
        +'</tr>';
    }).join('');
  }

  // fallback: สร้างจากชิปผลตรวจที่มีอยู่ใน DOM (ไม่มีตัวเลข D/C)
  function domRows(){
    var rows=[];
    $$('.checks .chk').forEach(function(c){
      rows.push({name:c.textContent.trim(), ok:c.classList.contains('ok'), ratio:NaN});
    });
    $$('.spacing-row').forEach(function(r){
      var lab=r.querySelector('.lab'), vd=r.querySelector('.verdict');
      if(lab&&vd) rows.push({
        name:(lab.childNodes[0]?lab.childNodes[0].textContent:lab.textContent).trim(),
        sub:'ระยะเรียงที่เลือกใช้',
        ok:vd.classList.contains('ok'), ratio:NaN
      });
    });
    return rows;
  }

  function wsDash(){
    var cfg=window.WS_CONFIG||{};
    var rows=null;
    if(typeof cfg.rows==='function'){ try{ rows=cfg.rows(); }catch(e){ rows=null; } }
    var rws=(rows&&rows.length)? rows : domRows();
    var host=$('#wsDash');
    if(host && rws.length){
      host.innerHTML='<div class="dc-wrap"><table class="dc">'
        +'<thead><tr><th>รายการตรวจสอบ</th><th>DEMAND</th><th>CAPACITY</th><th>D/C</th><th class="thbar">UTILIZATION</th><th>ผล</th></tr></thead>'
        +'<tbody>'+buildRows(rws)+'</tbody></table></div>'
        +'<div class="dc-foot">'
        +'<span><i style="background:#15803D"></i>D/C ≤ 0.85</span>'
        +'<span><i style="background:#D97706"></i>0.85 &lt; D/C ≤ 1.00</span>'
        +'<span><i style="background:#C0392B"></i>D/C &gt; 1.00</span>'
        +'<span>| เส้นแบ่งบนแถบ = D/C 1.00 (สเกลเต็ม 1.20)</span>'
        +'</div>';
    }
    var oks=0,bads=0;
    rws.forEach(function(r){ r.ok?oks++:bads++; });
    var n=oks+bads, all=n>0&&bads===0;
    var hd=$('#wsStatus');
    if(hd&&n>0){
      hd.textContent=(all?'PASS':'FAIL')+' · '+oks+'/'+n;
      hd.className='ws-status '+(all?'pass':'fail');
    }
    var sb=$('#wsSbStatus');
    if(sb&&n>0){
      sb.textContent=all?('PASS — ผ่านทุกรายการ ('+oks+'/'+n+')'):('FAIL — ไม่ผ่าน '+bads+' รายการ');
      sb.className='sb-item sb-live '+(all?'pass':'fail');
    }
  }

  // ห่อ render ของ engine — ทุกรอบคำนวณ dashboard อัปเดตตาม
  var rn=(window.WS_CONFIG&&window.WS_CONFIG.renderFn)||'render';
  if(typeof window[rn]==='function'){
    var __orig=window[rn];
    window[rn]=function(){
      var out=__orig.apply(this,arguments);
      try{ wsDash(); }catch(e){}
      return out;
    };
  }
  try{ wsDash(); }catch(e){}
  window.wsRefresh=wsDash;   // สำหรับเครื่องมือที่อัปเดตด้วยกลไกอื่น

  // fallback: engine บางตัวผูก listener ด้วย reference ตรง (addEventListener('input',render))
  // ทำให้ wrapper ไม่ถูกเรียก — ดักอีเวนต์ระดับ document แบบ debounce แทน (อ่านผลอย่างเดียว)
  var __t=null;
  function queueDash(){ clearTimeout(__t); __t=setTimeout(function(){ try{ wsDash(); }catch(e){} },80); }
  ['input','change','click'].forEach(function(ev){
    document.addEventListener(ev,queueDash,false);
  });

  /* ---- scrollspy ---- */
  var links=$$('#secnav a');
  var secs=links.map(function(a){ return $(a.getAttribute('href')); }).filter(Boolean);
  function setOn(id){
    links.forEach(function(a){ a.classList.toggle('on',a.getAttribute('href')==='#'+id); });
  }
  if('IntersectionObserver' in window && secs.length){
    var cur=secs[0].id;
    var io=new IntersectionObserver(function(es){
      es.forEach(function(en){ if(en.isIntersecting) cur=en.target.id; });
      setOn(cur);
    },{rootMargin:'-160px 0px -58% 0px',threshold:0});
    secs.forEach(function(s){ io.observe(s); });
  }
  links.forEach(function(a){
    a.addEventListener('click',function(){ setOn(a.getAttribute('href').slice(1)); });
  });
})();
