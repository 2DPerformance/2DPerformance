/** Paper-only CAD projection. No loads, capacities, bar selection or verdicts.
 * All dimensions are measured in model mm before uniform placement on A4. */
import { drawing, line, poly, text } from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import { paperSize, placeDrawing, wrapText } from './drafting/sheetComposer.js?rwv=20261001-leader-layout-1';
import { drawnBoxOf } from './drafting/extentGeometry.js?rwv=20261001-leader-layout-1';
import { renderSvg } from './drafting/svgRenderer.js?rwv=20261003-cad-contour-1';
import { TEXT_HEIGHT } from './drafting/draftingStandard.js?rwv=20260930-load-units-1';
import {annotationLabelBoxes,prepareCadAnnotations} from './drafting/annotationClearance.mjs?rwv=20261001-leader-layout-1';

export const A4_CAD_FRAME = Object.freeze({ x:20, y:16, w:175, h:265 });
const L='RW-A4-TEXT', B='RW-A4-BORDER', H=2.8, PITCH=4.25;
const clean=s=>String(s??'').replace(/<br\s*\/?>/gi,' ').replace(/<[^>]*>/g,'')
  .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const rect=(x,y,w,h,pc='DIM')=>poly([{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],pc,B,true);
const put=(E,x,y,s,h=H,bold=false)=>E.push(text({x,y},String(s??''),h,L,{bold}));
function paragraph(E,x,top,s,width,h=H,pitch=PITCH) {
  const rows=wrapText(String(s??''),width,h);
  rows.forEach((row,j)=>put(E,x,top-j*pitch,row,h));
  return rows.length*pitch;
}

/** Factories may use the chosen scale to reserve physical dimension lanes.
 * Never stretch x/y independently, or replace a measured value with a label. */
export function fitCadView(source,viewport) {
  for(const scale of [25,40,50,60,75,100,125,150,200,250,300,400,500,750,1000,1500,2000,3000,5000,10000]) {
    const sourceView=typeof source==='function'?source(scale):source;
    if(!sourceView?.entities?.length)throw new TypeError('A4 CAD: complete drawing required');
    const raw=prepareCadAnnotations(sourceView,scale);
    const size=paperSize(raw,scale);
    if(size.w>viewport.w||size.h>viewport.h)continue;
    const ox=viewport.x+(viewport.w-size.w)/2+size.padLeft;
    const oy=viewport.y+(viewport.h-size.h)/2+size.padBottom;
    const entities=placeDrawing(raw,scale,ox,oy);
    const box=drawnBoxOf(entities,1);
    if(box.min.x<viewport.x-.1||box.max.x>viewport.x+viewport.w+.1
      ||box.min.y<viewport.y-.1||box.max.y>viewport.y+viewport.h+.1)
      throw new RangeError('A4 CAD: placed view outside reserved viewport');
    return {entities,scale,viewport:{...viewport},model:raw};
  }
  throw new RangeError('A4 CAD: geometry cannot fit A4 without clipping');
}

function frame(info,title,number,scale) {
  const E=[rect(20,16,175,265,'OUTLINE')];
  put(E,24,274,title,4.2,true);
  put(E,24,267,info.title,3.1,true);
  E.push(line({x:20,y:263},{x:195,y:263},'DIM',B));
  // Drawing title block: human signatures remain blank.
  E.push(rect(20,16,175,35));
  for(const y of [26,38])E.push(line({x:20,y},{x:195,y},'DIM',B));
  E.push(line({x:142,y:26},{x:142,y:51},'DIM',B));
  put(E,23,47,'โครงการ',H,true);
  const project=String(info.project||'ยังไม่ระบุ');
  const projectRows=wrapText(project,115,H);
  // Full long names are repeated above the drawing, rather than clipped here.
  put(E,23,41.5,projectRows.length===1?project:'ชื่อเต็มตามข้อมูลโครงการด้านบน');
  put(E,145,47,'เลขที่แบบ',H,true);put(E,145,41.5,number,3.1,true);
  put(E,23,33.7,info.profile,H,true);
  put(E,23,28.7,info.forceUnits?info.forceUnits+' | มม./ม. | A4 100%'
    :'kN · kN·m · kPa | แบบ มม. / ระดับ ม. | A4 100%');
  put(E,145,33.7,'มาตราส่วน',H,true);put(E,145,28.7,scale);
  for(const [j,label]of ['ผู้ออกแบบ','ผู้ตรวจสอบ','ผู้อนุมัติ'].entries()) {
    const x=20+j*175/3;
    if(j)E.push(line({x,y:16},{x,y:26},'DIM',B));
    put(E,x+3,22,label);put(E,x+3,18,'________________');
  }
  return E;
}

function noteBlock(E,info,extra=[]) {
  const paragraphs=[info.authority,...info.notes,...extra];
  // Leave room for Thai ascenders below the note-panel divider.
  let y=75;
  for(const p of paragraphs)y-=paragraph(E,24,y,p,167,H,4.8);
  if(y<49)throw new RangeError('A4 CAD: notes exceed their reserved panel');
  E.push(line({x:20,y:79},{x:195,y:79},'DIM',B));
}

function identityRows(info) {
  const rows=[info.statusLabel||('ผลตรวจ '+info.status+' · '+info.stamp),...(info.extraIdentity||[])];
  if(wrapText(String(info.project||''),115,H).length>1)rows.push('โครงการ: '+info.project);
  return rows;
}

const COLS=[{key:'mark',label:'มาร์ค',w:12},{key:'position',label:'ตำแหน่ง / สมาชิก',w:54},
  {key:'size',label:'ขนาดที่เลือก',w:26},{key:'detail',label:'รายละเอียดจากผลคำนวณ',w:75}];
function measureRows(rows) {
  return rows.map(row=>{
    const cells=COLS.map(c=>wrapText(clean(row[c.key]),c.w-4,H));
    return {row,cells,height:Math.max(...cells.map(c=>c.length))*PITCH+2.5};
  });
}
function table(E,rows,top) {
  let y=top;
  const height=7+rows.reduce((s,r)=>s+r.height,0);
  E.push(rect(24,top-height,167,height));
  let x=24;
  for(const c of COLS) {
    if(x>24)E.push(line({x,y:top},{x,y:top-height},'DIM',B));
    put(E,x+2,top-4.6,c.label,H,true);x+=c.w;
  }
  y-=7;E.push(line({x:24,y},{x:191,y},'DIM',B));
  for(const r of rows) {
    x=24;
    r.cells.forEach((lines,j)=>{lines.forEach((s,k)=>put(E,x+2,y-4.2-k*PITCH,s,H,j===0));x+=COLS[j].w;});
    y-=r.height;E.push(line({x:24,y},{x:191,y},'DIM',B));
  }
  return height;
}

function materialLegend(E,rows,top,reference) {
  put(E,24,top,'มาร์ค / ขนาด · รายละเอียดทั้งหมดดูตารางในแผ่น '+reference,H,true);
  rows.forEach((row,j)=>{
    const x=24+(j%3)*56,y=top-6-Math.floor(j/3)*4.3;
    if(y<82)throw new RangeError('A4 CAD: material mark legend exceeds reserved area');
    const label=clean(row.mark)+' · '+clean(row.size);
    if(wrapText(label,52,H).length!==1)throw new RangeError('A4 CAD: material mark legend too long');
    put(E,x,y,label);
  });
}

/** Every BBS row is kept. Long schedules flow to labelled sheets before the
 * single last Section sheet; font size and source strings are never shrunk. */
export function buildA4CadSheets({info,plan,section,rows,summaryRows=[]}) {
  if(!info?.stamp||!info.authority?.includes('NOT FOR CONSTRUCTION')
    ||!['PASS','FAIL'].includes(info.status)||!Array.isArray(rows)||!rows.length)
    throw new TypeError('A4 CAD: accepted identity, authority and complete schedule required');
  const identity=identityRows(info),identityH=identity.reduce((sum,row)=>sum+wrapText(String(row),167,H).length*PITCH,0);
  const measured=measureRows(rows),rowHeight=measured.reduce((sum,row)=>sum+row.height,0);
  const combinedBottom=86+7+rowHeight+11;
  // A short schedule can still leave too little space for dimension lanes.
  // Give a 1:250 Plan its own sheet instead of reducing a normal 12 m wall
  // to a tiny thumbnail beside a legible table. The model remains uniformly scaled.
  const separateSchedule=rowHeight>90||fitCadView(plan,{x:24,y:combinedBottom,w:167,h:259-identityH-combinedBottom}).scale>150;
  const chunks=separateSchedule?[[]]:[];
  let chunk=[],height=0;
  for(const row of measured) {
    const capacity=separateSchedule?155-identityH:90;
    if(row.height>capacity)throw new RangeError('A4 CAD: one schedule row exceeds an A4 sheet');
    if(chunk.length&&height+row.height>capacity){chunks.push(chunk);chunk=[];height=0;}
    chunk.push(row);height+=row.height;
  }
  if(chunk.length)chunks.push(chunk);
  const sheets=[];
  const reference=separateSchedule?(chunks.length>2?'P02–P'+String(chunks.length).padStart(2,'0'):'P02'):'P01';
  for(const [index,part]of chunks.entries()) {
    const scheduleH=7+part.reduce((s,row)=>s+row.height,0);
    const top=index?259-identityH-11:separateSchedule?118:86+scheduleH;
    const bottom=index?0:separateSchedule?134:top+11;
    const viewport={x:24,y:bottom,w:167,h:259-identityH-bottom};
    const view=index===0?fitCadView(plan,viewport):null;
    const sheetNo=`RW-${info.type.toUpperCase()}-P${String(index+1).padStart(2,'0')}`;
    const E=frame(info,index===0?'PLAN / MATERIAL SCHEDULE · ผังและวัสดุที่เลือก':'MATERIAL SCHEDULE · ตารางวัสดุ (ต่อ)',sheetNo,view?'1:'+view.scale:'—');
    let idY=259;identity.forEach(s=>{idY-=paragraph(E,24,idY,s,167);});
    if(view){E.push(...view.entities);put(E,24,top+5,'PLAN · แนวตัด A-A · 1:'+view.scale,H,true);}
    else put(E,24,top+5,'ตารางต่อเนื่องจาก RW-'+info.type.toUpperCase()+'-P01',H,true);
    if(part.length)table(E,part,top);
    else materialLegend(E,rows,112,reference);
    noteBlock(E,info);
    sheets.push(drawing(sheetNo,'ผังและตารางวัสดุ RW-01',E,{scale:1,sheetW:210,sheetH:297,
      cadSheet:true,viewKind:'PLAN',viewScale:view?.scale??null,viewport:view?.viewport,
      sourceStamp:info.stamp,rows:part.map(x=>({...x.row})),scheduleReference:reference}));
  }
  const view=fitCadView(section,{x:24,y:123,w:167,h:259-identityH-123});
  const E=frame(info,'SECTION SUMMARY · สรุปรูปตัดและเหล็กที่เลือก',`RW-${info.type.toUpperCase()}-S01`,'1:'+view.scale);
  let idY=259;identity.forEach(s=>{idY-=paragraph(E,24,idY,s,167);});
  E.push(...view.entities);
  put(E,24,117,'SECTION A-A · 1:'+view.scale+' · เหล็กตามผลคำนวณ',3.2,true);
  if(summaryRows.length) {
    summaryRows.forEach((row,j)=>{
      put(E,24,110-j*8.5,row.label,H,true);
      put(E,78,110-j*8.5,row.steel);
      put(E,143,110-j*8.5,'D/C '+row.dc);
    });
    if(summaryRows.length>3)throw new RangeError('A4 CAD: summary rows exceed reserved area');
  } else {
    materialLegend(E,rows,110,reference);
  }
  noteBlock(E,info);
  sheets.push(drawing(`RW-${info.type.toUpperCase()}-S01`,'สรุปรูปตัด RW-01',E,{scale:1,sheetW:210,sheetH:297,
    cadSheet:true,viewKind:'SECTION',viewScale:view.scale,viewport:view.viewport,sourceStamp:info.stamp,
    finalSectionSummary:true}));
  // Checking actual drawn extents uses the same metrics as the SVG renderer.
  for(const [index,s]of sheets.entries()){
    // Opt in only paper-sheet dimensions. This changes visible annotation
    // strokes, never measured endpoints, text, scale or Snapshot geometry.
    for(let k=0;k<s.entities.length;k++){
      const e=s.entities[k];
      if(e.t==='dim')s.entities[k]={...e,clearText:true};
    }
    // Extension lines and leaders can cross a different label or cut bubble.
    // Share paper-space label boxes with annotation strokes only: structural
    // outlines, rebar, soil hatches and physical head points are untouched.
    const boxes=annotationLabelBoxes(s.entities);
    for(let k=0;k<s.entities.length;k++){
      const e=s.entities[k];
      if(e.t==='dim'||e.t==='leader')s.entities[k]={...e,annotationClearance:boxes};
    }
    if(info.relativeSheetNumbers)put(s.entities,155,81,'แผ่นแบบ '+(index+1)+' / '+sheets.length);
    const box=drawnBoxOf(s.entities,1);
    if(box.min.x<19.5||box.max.x>195.5||box.min.y<15.5||box.max.y>281.5)
      throw new RangeError('A4 CAD: text or geometry outside sheet frame: '+s.id);
  }
  return sheets;
}

export function renderA4CadSheet(sheet) {
  if(!sheet?.meta?.cadSheet)throw new TypeError('A4 CAD: paper sheet required');
  // Native reports already have @page margins. Use the exact frame size in mm;
  // never fit a 210x297 drawing to a smaller printable box without labelling it.
  return renderSvg(sheet,{scale:1,padPaper:0,page:{w:210,h:297}})
    .replace(/viewBox="[^"]*"/,'viewBox="19.5 15.5 176 266"')
    .replace('<svg ','<svg width="176mm" height="266mm" data-a4-cad-sheet="'+sheet.meta.viewKind+'" ');
}
