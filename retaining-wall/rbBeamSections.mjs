/** Read-only CAD sections of the Engine-owned FRONT RB nominal layout. */
import {drawing,poly,circle,dim,leader,text,line} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {fitCadView} from './a4DrawingSheet.mjs?rwv=20261003-cad-contour-1';
import {renderSvg} from './drafting/svgRenderer.js?rwv=20261003-cad-contour-1';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pt=([x,y])=>({x,y});
const n=v=>Number(v.toFixed(1)).toString();
export function rbBeamSectionModel(snapshot,mark,scale=25){
  const b=snapshot.reportSoldier?.capBeams.find(b=>b.name===mark);
  if(!b?.detailing)throw new TypeError('RB section requires the accepted beam detail');
  const d=b.detailing,w=d.width,h=d.depth,E=[];
  E.push(poly([[0,0],[w,0],[w,h],[0,h]].map(pt),'CUT','RW-CONCRETE',true));
  if(d.physicalOK){
    E.push(poly(d.link.map(pt),'REBAR','RW-REBAR',true));
    for(const face of ['top','bottom'])for(const p of d[face])E.push(circle(pt(p),b.db/2,'REBAR','RW-REBAR',true));
    const x=w+22*scale;
    for(const [face,count,y]of [['top',b.nTop,h-d.inset],['bottom',b.nBot,d.inset]]){
      const target=pt(d[face][d[face].length-1]),lane=face==='top'?h+6*scale:-6*scale;
      E.push(leader([target,{x:x-2*scale,y:lane},{x,y:lane}],count+'-DB'+b.db,2.8,'RW-TEXT'));
    }
    E.push(leader([pt(d.link[3]),{x:-18*scale,y:h+14*scale},{x:-16*scale,y:h+14*scale}],b.linkBar,2.8,'RW-TEXT'));
  }
  E.push(dim(pt([0,0]),pt([w,0]),-14*scale,'RW-DIM',{note:'b'}));
  E.push(dim(pt([0,0]),pt([0,h]),-10*scale,'RW-DIM',{note:'h',vertical:true}));
  E.push(dim(pt([w,d.inset]),pt([w,h]),9*scale,'RW-DIM',{note:'d',vertical:true}));
  return drawing('RW-'+mark+'-CROSS-SECTION',mark+' · เหล็กคานหน้า',E,
    {sourceStamp:snapshot.stamp,uniformScale:true,fabricationAuthority:false,spacingOK:d.spacingOK});
}

export function rbBeamSectionCad(snapshot,mark){
  const fit=fitCadView(scale=>rbBeamSectionModel(snapshot,mark,scale),{x:5,y:13,w:130,h:65});
  const b=snapshot.reportSoldier.capBeams.find(b=>b.name===mark),d=b.detailing;
  const E=[...fit.entities,text({x:5,y:84},mark+' · SECTION · ชั้นเดียว',3.4,'RW-TEXT',{bold:true}),
    line({x:5,y:80},{x:135,y:80},'DIM','RW-FRAME'),
    text({x:5,y:6},'c '+n(d.cover)+' · dt '+b.linkDb+' · d '+n(d.effectiveDepth)+' mm · 1:'+fit.scale,2.8,'RW-TEXT')];
  const cad=drawing('RW-'+mark+'-PAPER','รูปตัดคาน '+mark,E,{sourceStamp:snapshot.stamp,fabricationAuthority:false});
  return {drawing:cad,model:fit.model,scale:fit.scale};
}
export function renderRbBeamSection(snapshot,mark){
  const cad=rbBeamSectionCad(snapshot,mark);
  return renderSvg(cad.drawing,{scale:1,padPaper:0,page:{w:140,h:90}})
    .replace('<svg ','<svg data-rb-section="'+mark+'" data-source-stamp="'+esc(snapshot.stamp)+'" ');
}

export function renderRbBeamSections(snapshot,{report=false}={}){
  if(snapshot.type!=='soldier')return '';
  const beams=snapshot.reportSoldier.capBeams;
  if(!beams.length)return '';
  return '<section class="rw-rb-sections" data-report-stage="rb-sections"><h3>รูปตัดเหล็กคานหน้า RB</h3>'
    +'<p class="rw-report-note">เหล็ก '+(beams.every(b=>b.detailing.spacingOK)?'วางชั้นเดียวได้ตาม screen ระยะ':'มีรายการวางชั้นเดียวไม่ผ่าน — ดู D/C')
    +' · เส้นปลอกเป็นแกนรูปประกอบ ยังไม่ตรวจขอ/ดัด/ต่อ/ยึดเหนี่ยว</p>'
    +beams.map((b,j)=>'<details class="rw-rb-section print-keep" '+(report||j===0?'open':'')+'><summary>'+b.name+' · '
      +n(b.bw*100)+'×'+n(b.bh*100)+' cm · บน '+b.nTop+' / ล่าง '+b.nBot+'-DB'+b.db
      +' · '+b.linkBar+' · ระยะ '+(b.detailing.spacingOK?'ผ่าน':'ไม่ผ่าน')+'</summary>'
      +'<div class="drawing">'+renderRbBeamSection(snapshot,b.name)+'</div></details>').join('')
    +'<p class="rw-report-note">ระยะราบ: ACI318-14 US §25.2.1 แปลง 1 in=25.4 mm; แนวดิ่งใช้ screen โครงการเดียวกัน · ขนาดเหล็ก nominal · ยังไม่รับรองรายละเอียดครบมาตรฐาน</p></section>';
}
