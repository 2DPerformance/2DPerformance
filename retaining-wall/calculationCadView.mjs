/** One accepted calculation-drawing vocabulary for screen and A4. Presentation only. */
import {nativeCadViews} from './nativeCadViews.mjs?rwv=20261003-main-equations-1';
import {retainingWallSection} from './drafting/rwSectionGeometry.js?rwv=20261001-leader-layout-1';
import {retainingWallPlan} from './drafting/rwPlanGeometry.js?rwv=20261001-leader-layout-1';
import {bboxOf} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
export function calculationCadView(s,view,{overview=false,screen=false}={}) {
 const reportDrawing=raw=>({...raw,entities:raw.entities.filter(e=>!(e.t==='text'&&/มาตราส่วน/.test(e.s||e.text||''))&&!(e.t==='leader'&&/ท่อ|ร่อง|ระบายน้ำ|กรอง|รอยต่อ/.test(e.label||''))).map(e=>{
  if(e.t!=='leader')return e;
  const rib=e.label.match(/^ครีบยึด\s+([\d.]+)×([\d.]+) ม\. × (\d+) ตัว/);
  if(rib)return {...e,label:'CF · '+Math.round(+rib[1]*1000)+'×'+Math.round(+rib[2]*1000)+' · '+rib[3]+' ตัว',h:2.8};
  // Full orientation/detailing stays in the selected schedule. Short, real
  // mark + bar callouts reserve readable lanes around the calculation view.
  const m=e.label.match(/^(\S+)\s+((?:\d+-)?(?:DB|RB)\d+(?:\s*@\d+(?:[–-]\d+)?)?)/);
  return m?{...e,label:m[0]+(e.label.includes('/ครีบ')?'/ครีบ':'')}:e;
 })});
 const factories=s.result?{section:()=>reportDrawing(retainingWallSection(s.result)),plan:()=>reportDrawing(retainingWallPlan(s.result,s.construct))}:nativeCadViews(s);
 return scale=>{
  let raw=factories[view](scale);
  if(s.result){
   const widths=raw.entities.filter(e=>e.t==='dim'&&e.chain===(view==='plan'?'width':'base'));
   const singleBay=raw.entities.filter(e=>e.t==='dim'&&e.chain==='length').length===1;
   raw={...raw,entities:raw.entities.filter(e=>e.t!=='text'&&!(singleBay&&e.t==='dim'&&e.chain==='length')&&!(e.t==='dim'&&e.chain==='height:total')).map(e=>{
    if(['sectionMark','level'].includes(e.t))return {...e,textHeight:2.8};
    if(e.t!=='dim')return e;
    const index=widths.indexOf(e);
    if(index>=0)return {...e,off:-(10+index*8)*scale,note:['Toe','t','Heel'][index]};
    if(['width:total','base:total'].includes(e.chain))return {...e,off:-36*scale,note:'B'};
    if(e.chain==='length:total')return {...e,off:-20*scale,note:'Lw'};
    if(e.chain==='height')return {...e,off:-13*scale,note:e.a.y===0?'hz':'H'};
    return {...e,off:e.off*scale/(view==='plan'?100:50)};
   })};
   if(view==='section'&&!overview){
    // Put callout tails beyond the soil outline before laying out paper lanes.
    // Preserve every bar target and all physical concrete/soil coordinates.
    const soil=bboxOf(raw.entities.filter(e=>e.layer==='RW-SOIL'&&['poly','hatch'].includes(e.t)));
    raw={...raw,entities:raw.entities.map(e=>{
     if(e.t!=='leader'||!Number.isFinite(soil.max.x))return e;
     const last=e.pts.at(-1),previous=e.pts.at(-2);
     if(last.x<previous.x)return e;
     const x=Math.max(last.x,soil.max.x+8*scale);
     return {...e,pts:e.pts.map((p,j)=>j>=Math.max(1,e.pts.length-2)?{...p,x}:p)};
    })};
   }
  }else if(!screen)raw={...raw,entities:raw.entities.filter(e=>!(e.t==='text'&&/^แนวเขต · ฐาน/.test(e.s))).map(e=>e.t==='text'?{...e,h:Math.max(e.h,2.8)}:e)};
  if(!overview)return raw;
  // Geometry overview has no rebar or callouts. Complete dimensions and marks
  // remain on the final drawing. Never alter the physical concrete/soil/piles.
  return {...raw,entities:raw.entities.filter(e=>e.layer!=='RW-REBAR'&& !['leader','text','level','sectionMark'].includes(e.t)
    &&(e.t!=='dim'||['H','B','hz','Le','t top'].includes(e.note)||['base:total','height','crest:total'].includes(e.chain)))};
 };
}
