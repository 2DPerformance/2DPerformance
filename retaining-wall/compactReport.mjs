import {separatePaperLabels} from './drafting/paperLabels.mjs?rwv=20261003-cad-contour-1';
/** A4 presentation from one accepted run. No analysis, design or acceptance is performed here. */
import {stressContourFor,contourSvg,CONTOUR_SOURCE,CONTOUR_LABEL,CONTOUR_CSS} from './stressContour.mjs?rwv=20261003-cad-contour-1';
import {reportLoadTable,mainEquationSections,governingReportMembers,projectReportMembers,projectReportShear,essentialCheckRows,reportTable,workedReportTable} from './essentialReport.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import {resultUnits,displayEngineText,displayedChecks,displayedBbsRow} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1&apd=20261003-cast-together-1';
import {calculationCadView} from './calculationCadView.mjs?rwv=20261003-cad-contour-1';
import {fitCadView} from './a4DrawingSheet.mjs?rwv=20261003-cad-contour-1';
import {drawing} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {renderSvg} from './drafting/svgRenderer.js?rwv=20261003-cad-contour-1';
import {supportModelSvg} from './supportSymbols.mjs?rwv=20261003-support-symbols-1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'—';
const labels={cantilever:'กำแพงยื่น · ฐานแผ่',counterfort:'กำแพงมีครีบ · ฐานแผ่',gravity:'กำแพงมวล',pile:'กำแพงยื่น · เสาเข็ม',pilecf:'กำแพงมีครีบ · เสาเข็ม',soldier:'เสาเข็มพืด',duckfoot:'ฐานตีนเป็ด · เสาชิดเขต'};
export const COMPACT_REPORT_VERSION='rw01-compact-a4/3';
export const COMPACT_REPORT_CSS=`
@page rwcompact{size:210mm 297mm;margin:0}
.rw-compact-report{color:#142d44;font-family:Sarabun,Arial,sans-serif;background:#edf2f6;line-height:1.38;overflow:visible}
.rw-compact-page{page:rwcompact;box-sizing:border-box;width:210mm;min-height:297mm;padding:11mm 12mm 13mm;background:white;margin:0 auto 14px;break-after:page;position:relative;color:#142d44;box-shadow:0 2px 10px #17344d18;font-size:10.5px;line-height:1.38;overflow:visible}
.rw-compact-page:last-child{break-after:auto}
.rw-compact-page:last-child h3{margin-top:1.5mm}.rw-compact-page::after{content:'';position:absolute;inset:7mm;border:1px solid #bdc9d2;pointer-events:none}.rw-compact-body{padding-bottom:3mm}
.rw-compact-page *{box-sizing:border-box}.rw-compact-page h2{font-size:18px;margin:0 0 2mm;color:#113b5c}.rw-compact-page h3{font-size:12px;margin:3mm 0 1.4mm;padding:0;border:0;color:#113b5c}.rw-compact-page p{margin:1.4mm 0}.rw-compact-page small{font-size:10px}
.rw-compact-header{display:grid;grid-template-columns:1fr auto;gap:3mm;border-bottom:1px solid #163e5f;padding:2mm 0 3mm;margin-bottom:3mm}.rw-compact-header b{font-size:14px}.rw-compact-header .meta{text-align:right;font-variant-numeric:tabular-nums;font-size:10px}.rw-compact-header .meta strong{display:block;font-size:12px}
.rw-compact-columns{display:grid;grid-template-columns:1fr 1fr;gap:4mm;align-items:start}.rw-compact-columns.wide-figure{grid-template-columns:.95fr 1.05fr}
.rw-compact-page table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:10px;line-height:1.25}.rw-compact-page th{background:#eaf1f5;font-weight:700;text-align:left;border-bottom:1px solid #8397a8}.rw-compact-page td,.rw-compact-page th{padding:1.1mm 1.3mm;border:1px solid #c8d3db;vertical-align:top;overflow-wrap:anywhere}.rw-compact-page tr{break-inside:avoid}
.rw-compact-page [data-report-table=substitution] th:nth-child(1){width:16%}.rw-compact-page [data-report-table=substitution] th:nth-child(2){width:25%}.rw-compact-page [data-report-table=substitution] th:nth-child(3){width:40%}.rw-compact-page [data-report-table=substitution] th:nth-child(4){width:19%}
.rw-compact-page .table-wrap{overflow:visible;max-height:none}.rw-compact-page .rw-report-note,.rw-compact-caption{font-size:10px;color:#506577;line-height:1.45}
.rw-compact-page svg{display:block;width:100%;height:auto!important;max-width:100%;background:white}.rw-compact-page .rw-cad-compact svg{height:auto!important}.rw-compact-page .rw-contour-svg{height:60mm!important}.rw-compact-page .fbd-svg{height:45mm!important}.rw-compact-page .diagram-grid{display:grid;grid-template-columns:1fr 1fr;gap:3mm}.rw-compact-page .diagram-grid figure{margin:0;padding:0;border:0;background:white}.rw-compact-page .diagram-grid svg{height:31mm!important}.rw-compact-page .diagram-grid figcaption{font-size:10px;font-weight:700}.rw-compact-page .print-keep{break-inside:avoid}.rw-compact-page .rw-cad-overview svg{height:74mm!important}
.rw-compact-footer{position:absolute;left:12mm;right:12mm;bottom:11mm;border-top:1px solid #92a5b5;padding-top:2mm;font-size:10px;display:flex;justify-content:space-between;gap:4mm}.rw-report-verdict{padding:2mm 3mm;background:#eef5f8;border:1px solid #a3b7c5}.rw-report-verdict.fail{background:#fff0eb;border-color:#b64627}
.rw-compact-page [data-report-table=steel] th:nth-child(1){width:8%}.rw-compact-page [data-report-table=steel] th:nth-child(2){width:29%}.rw-compact-page [data-report-table=steel] th:nth-child(3){width:16%}.rw-compact-page [data-report-table=steel] th:nth-child(4){width:47%}.rw-compact-page [data-report-table=substitution] td:last-child{font-weight:700}
.rw-compact-page .rw-cad-overview svg{height:auto!important}.rw-compact-page .fbd-svg{height:45mm!important}.rw-compact-page .diagram-grid svg{height:28mm!important}.rw-compact-page .rw-analysis-single .diagram-grid svg{height:55mm!important}.rw-compact-page .rw-contour-svg{height:43mm!important}.rw-compact-page .rw-analysis-single .rw-contour-svg{height:92mm!important}.rw-graph-values{display:flex;gap:3mm;justify-content:space-between;padding-top:1mm;font-size:10px;font-variant-numeric:tabular-nums}.rw-compact-page .diagram-grid figcaption{padding-bottom:1mm;border-bottom:1px solid #c8d3db}.rw-compact-page .diagram-grid{gap:4mm}.rw-drawing-note{padding:2mm 0;border-top:1px solid #bdc9d2}.rw-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin-top:5mm;font-size:10px}.rw-signatures span{border-top:1px solid #92a5b5;padding-top:1.5mm}
.rw-dc-grid{display:grid;grid-template-columns:1fr 1fr;gap:1mm 3mm}.rw-dc-item{display:flex;justify-content:space-between;gap:2mm;padding:1.2mm 0;border-bottom:1px solid #ccd7df;font-size:10.5px}.rw-dc-item b{white-space:nowrap;color:#225e48}.rw-dc-item.fail b{color:#ac4027}.rw-dc-item span{max-width:72%}
${CONTOUR_CSS}
.rw-compact-page .fbd-svg[viewBox="0 0 720 220"]{height:29mm!important}
.rw-compact-page .rw-fbd-views{display:grid;grid-template-columns:1fr 1fr;gap:3mm;align-items:start}
.rw-compact-page .rw-analysis-multiple .diagram-grid svg{height:26mm!important}
.rw-compact-page .rw-contour-views .rw-contour-svg{height:37mm!important}
@media print{html,body{margin:0!important;padding:0!important}.rw-compact-report{background:white!important;width:210mm!important;max-width:none!important}.rw-compact-page{margin:0!important;box-shadow:none!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}#reportPane{width:210mm!important}.rw-compact-page .table-wrap{overflow:visible!important}.rw-compact-page svg text{font-family:Sarabun,Arial,sans-serif}}
`;
function info(s,mode){
 const legacy=!!s.result,type=legacy?(s.result.mode==='but'?'counterfort':s.result.i.wtype==='gravity'?'gravity':'cantilever'):s.type;
 const i=legacy?s.result.i:s.input,checks=legacy?s.checks.map(c=>({key:c.k,value:displayEngineText(c.v,mode),criterion:displayEngineText(c.req,mode),dc:c.u,ok:c.ok})):displayedChecks(s,mode);
 return {type,i,checks,legacy,id:s.id||s.stamp,profile:s.equationLedger.label,
   rows:legacy?s.result.qty.bbs.map(b=>({mark:b.mk,position:b.pos,size:b.secTag||(b.size?'DB'+b.size:''),detail:b.detail})):s.bbs.map(row=>displayedBbsRow(s,row))};
}
function cad(s,view,height,{overview=false}={}){
 const source=calculationCadView(s,view,{overview});
 const width=overview?88:186,fit=fitCadView(source,{x:2,y:2,w:width-4,h:height-4}),d=drawing('RW-A4-'+view,view,separatePaperLabels(fit.entities,{x:2,y:2,w:width-4,h:height-4}),{sheetW:width,sheetH:height});
 return '<div class="rw-cad-compact" data-cad-view="'+view+'" data-cad-scale="'+fit.scale+'" data-cad-overview="'+overview+'">'+renderSvg(d,{scale:1,padPaper:0,page:{w:width,h:height}})+'<p class="rw-compact-caption">'+view.toUpperCase()+' · '+(overview?'รูปอ่านขนาด (มม.) · แบบเหล็กอยู่หน้าสุดท้าย':'มาตราส่วน 1:'+fit.scale+' เมื่อพิมพ์ขนาดจริง')+'</p></div>';
}
function legacyLoads(s,mode){
 const r=s.result,i=r.i,stub={type:'cantilever',input:i,forces:{load:{surcharge:r.surcharge}},equationLedger:s.equationLedger,reportWeights:r.W.filter(w=>w.ms&&w.v!==0).map(w=>({name:w.n,value:w.v,x:w.x}))};
 return reportLoadTable(stub,mode);
}
function compactLoads(s,d,mode){
 const i=d.i,u=resultUnits(mode),q=(v,unit)=>u.quantity(v,unit,2),rows=[];
 if(d.type==='duckfoot')rows.push(['DL / LL ยอดเสา',q(i.NpostD,'kN')+' / '+q(i.NpostL,'kN')],['DL / LL บนคาน',q(i.qBeamD,'kN/m')+' / '+q(i.qBeamL,'kN/m')],['แรงราบ / Mยอด',q(i.Hpost,'kN')+' / '+q(i.Mpost,'kN·m')],['DL ตัวเสา / ฐาน',q(s.equilibrium.wCol,'kN')+' / '+q(s.equilibrium.wCap,'kN')],['DL ตัวคาน',q(s.beam.w,'kN/m')]);
 else{
  const l=s.result?s.result:s.forces.load,qLoad=l.surcharge;
  rows.push(['DL ผิวดิน qD',q(qLoad.dead,'kPa')],['LL ผิวดิน qL',q(qLoad.live,'kPa')],['ดิน γ / γsat',q(i.gs,'kN/m³')+' / '+q(i.gsat,'kN/m³')],['φ / c',n(i.phi,1)+'° / '+q(i.c,'kPa')],['ระดับน้ำจากผิวดิน',i.zw>=99?'ไม่มีน้ำ':n(i.zw,2)+' m'],['คอนกรีต γc',q(i.gc,'kN/m³')]);
  const weights=s.result?s.result.W.filter(w=>w.ms&&w.v!==0).map(w=>({name:w.n,value:w.v})):s.reportWeights||[];
  for(const w of weights)rows.push([w.name,q(w.value,'kN/m')]);
 }
 const f=s.equationLedger.factors;rows.push(['ตัวคูณแรง γD / γL / γH',n(f.gD,2)+' / '+n(f.gL,2)+' / '+n(f.gH,2)]);
 return '<h3>DL / LL และน้ำหนักตัวเอง</h3>'+reportTable(['รายการกระทำ','ค่าที่กรอก / ค่าใช้งาน'],rows,'loads');
}
function legacyEquations(s,mode){
 const r=s.result,i=r.i,u=resultUnits(mode),q=(v,unit)=>u.quantity(v,unit,3),fs=s.designBasis.factors,wsd=s.designBasis.method==='wsd';
 const rows=[['แรงดันดิน/น้ำ','Ph = Pa + Pw',n(r.Phs)+' + '+n(r.Pw)+' kN/m',q(r.Ph,'kN/m')],
 ['โมเมนต์พลิก','Mo = Ph·ȳ',n(r.Ph)+' × '+n(r.ybar)+' kN·m/m',q(r.Mo,'kN·m/m')],
 ['พลิกคว่ำ','FSot = ΣMr / ΣMo',n(r.SMs)+' / '+n(r.MoT)+' kN·m/m',n(r.FSot)],
 ['เลื่อนไถล','FSsl = (Rfric + Radh + Pp)/Ph','('+n(r.slideFric)+' + '+n(r.slideAdh)+' + '+n(r.PpAll)+') / '+n(r.Ph)+' kN/m',n(r.FSsl)],
 ['แรงกดใต้ฐาน','q = V/B(1±6e/B) หรือสามเหลี่ยมเมื่อเกิน kern','V '+n(r.Vb)+' kN/m · B '+n(i.B)+' m · e '+n(r.e)+' m',q(r.qMax,'kPa')],
 ['DL/LL ออกแบบแนวดิ่ง','qu = γD·qD + γL·qL',n(fs.gD,2)+'×'+n(r.surcharge.dead)+' + '+n(fs.gL,2)+'×'+n(r.surcharge.live)+' kPa',q(r.surcharge.verticalFactored,'kPa')],
 ['แรงลง Heel','wu = γD[γ(H−hs)+γsat·hs+γc·tf+qD]+γL·qL',n(fs.gD,2)+'['+n(i.gs)+'×('+n(i.hp)+'−'+n(r.hsub)+')+'+n(i.gsat)+'×'+n(r.hsub)+'+'+n(i.gc)+'×'+n(i.hz)+'+'+n(r.surcharge.dead)+']+'+n(fs.gL,2)+'×'+n(r.surcharge.live),q(r.wuH,'kPa')]];
 for(const m of governingReportMembers(projectReportMembers(r))){
   const b=(m.width||1)*1000,d=m.d*1000;
   rows.push([m.name+' · As',wsd?'As=max(M/(fs·j·d), As,min)':'As=max[(0.85f′c/fy)(1−√(1−2M/(φbd²·0.85f′c)))bd, As,min]',
     (wsd?'M '+n(m.M)+' ×10⁶ N·mm · b '+n(b,1)+' · d '+n(d,1)+' mm; fs,j จากโปรไฟล์':
       '(0.85×'+n(i.fc)+'/'+n(i.fy)+') [1−√(1−2×'+n(m.M)+'×10⁶/('+n(fs.phib,2)+'×'+n(b,1)+'×'+n(d,1)+'²×0.85×'+n(i.fc)+'))] ×'+n(b,1)+'×'+n(d,1)),n(m.As,1)+' mm²'+(m.width?'':'/m')+' → '+m.bar]);
 }
 for(const m of projectReportShear(r))rows.push([m.name+' · เฉือน',wsd?'Vallow=0.09√f′c·bd/1000':'φVc=φv·0.17√f′c·bd/1000',
   (wsd?'0.09':n(fs.phiv,2)+'×0.17')+'×√'+n(i.fc)+'×1000×'+n(m.d*1000,1)+'/1000; V '+n(m.V)+' kN/m',q(m.capacity,'kN/m')]);
 return [{key:'main',title:'สมการหลัก · แรง เสถียรภาพ และเหล็ก',rows:rows.map(row=>row.map(v=>displayEngineText(v,mode)))}];
}
export function legacyFbd(s,mode='si'){
 const r=s.result,u=resultUnits(mode),q=(v,unit)=>u.quantity(v,unit,2);
 return '<svg class="fbd-svg" role="img" aria-label="Freebody Diagram" viewBox="0 0 720 220">'
 +'<defs><marker id="rw-fbd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#a34d21"/></marker></defs>'
 +'<path d="M225 35V153H475M125 153H225" stroke="#426782" stroke-width="15" fill="none"/>'
 +'<path d="M350 79H243" stroke="#a34d21" stroke-width="2" marker-end="url(#rw-fbd-arrow)"/><text x="355" y="80" font-size="22">Ph '+q(r.Ph,'kN/m')+'</text>'
 +'<path d="M320 17V131" stroke="#a34d21" stroke-width="2" marker-end="url(#rw-fbd-arrow)"/><text x="336" y="36" font-size="22">Vb '+q(r.Vb,'kN/m')+'</text>'
 +'<path data-support="soil-contact" d="M125 176H475M135 177l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12m35-12l-12 12" stroke="#6c8294" fill="none"/>'
 +'<text x="135" y="210" font-size="22">ดินรับแรงกดกระจาย · qmax '+q(r.qMax,'kPa')+'</text></svg>'+supportModelSvg(s);
}
export function compactGraph(points,title,unit,mode='si',support='จุดต่อ/จุดคุม'){
 if(!points?.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))throw new TypeError('Report graph requires accepted finite ordinates');
 const u=resultUnits(mode),start=points[0].x,end=points.at(-1).x,max=Math.max(1e-9,...points.map(p=>Math.abs(p.y))),peak=points.reduce((a,b)=>Math.abs(b.y)>Math.abs(a.y)?b:a),lo=points.reduce((a,b)=>b.y<a.y?b:a),hi=points.reduce((a,b)=>b.y>a.y?b:a);
 const X=x=>48+(x-start)/(end-start||1)*336,Y=y=>68-y/max*38,xy=p=>X(p.x).toFixed(2)+','+Y(p.y).toFixed(2),path=points.map(xy).join(' '),color=title.startsWith('BMD')?'#315b86':'#a34d21';
 const ticks=[0,.5,1].map(t=>{const x=start+t*(end-start),px=X(x);return '<path d="M'+px+' 116v4" stroke="#708496"/><text x="'+px+'" y="136" text-anchor="middle" font-size="14">'+n(x,2)+'</text>';}).join('');
 return '<figure data-graph-peak="'+peak.y+'" data-graph-station="'+peak.x+'"><figcaption>'+esc(title)+' · '+u.label(unit)+'</figcaption><svg role="img" aria-label="'+esc(title)+'" viewBox="0 0 430 140">'
 +'<path d="M48 28H384M48 116H384" stroke="#dce3e9" fill="none"/><path d="M48 25V116M48 68H384" stroke="#708496" fill="none"/><text x="40" y="72" font-size="14" text-anchor="end">0</text><text x="40" y="32" font-size="14" text-anchor="end">+</text><text x="40" y="109" font-size="14" text-anchor="end">−</text>'
 +'<polygon points="48,68 '+path+' 384,68" fill="'+color+'24"/><polyline points="'+path+'" stroke="'+color+'" fill="none" stroke-width="2.2"/>'
 +'<circle data-critical-point="true" cx="'+X(peak.x)+'" cy="'+Y(peak.y)+'" r="3.7" fill="'+color+'" stroke="white" stroke-width="1.2"/>'+ticks+'<text x="420" y="136" font-size="14" text-anchor="end">m</text></svg>'
 +'<div class="rw-graph-values"><b>จุดคุม '+u.quantity(peak.y,unit,2)+' @ '+n(peak.x,2)+' m</b></div><div class="rw-graph-values"><span>min '+u.format(lo.y,unit,2)+'</span><span>max '+u.format(hi.y,unit,2)+'</span></div></figure>';
}
function diagrams(s,mode){
 const datasets=[];
 if(s.result)for(const f of s.forceDesign.members)datasets.push({label:f.label+' · '+(s.designBasis.method==='wsd'?'WSD / SERVICE':'DESIGN'),bmd:f.bmd,sfd:f.sfd,unit:['kN/m','kN·m/m'],note:f.note});
 else if(s.type==='duckfoot'){
   datasets.push({label:'เสา · '+s.column.combination,bmd:s.column.grid.map(p=>({x:p.z,y:p.m})),sfd:s.column.grid.map(p=>({x:p.z,y:p.v})),unit:['kN','kN·m']});
   const span=s.factoredBeam.spans.reduce((a,b)=>Math.max(...b.grid.map(p=>Math.abs(p.M)))>Math.max(...a.grid.map(p=>Math.abs(p.M)))?b:a);
   datasets.push({label:'คานช่วง '+(span.index+1)+' · DESIGN',bmd:span.grid.map(p=>({x:p.x,y:p.M})),sfd:span.grid.map(p=>({x:p.x,y:p.V})),unit:['kN','kN·m']});
   if(s.footing)datasets.push({label:'ฐาน X · DESIGN',bmd:s.footing.diagram.map(p=>({x:p.x,y:p.M})),sfd:s.footing.diagram.map(p=>({x:p.x,y:p.V})),unit:['kN/m','kN·m/m']});
 }else{
   const f=s.forces,p=f.pile;
   datasets.push({label:'เข็ม · '+p.diagram.basis,bmd:p.diagram.m.map((y,k)=>({x:k*p.diagram.step,y})),sfd:p.diagram.v.map((y,k)=>({x:k*p.diagram.step,y})),unit:['kN','kN·m']});
   if(f.stem){
     const ps=f.stem.diagram||f.stem.strips.flatMap(p=>[{z:p.from,m:-p.supportM,v:p.V},{z:p.to,m:-p.supportM,v:p.V}]);
     datasets.push({label:'พนัง · DESIGN'+(f.stem.diagram?'':' · จุดแถบครีบ'),bmd:ps.map(p=>({x:p.z,y:p.m})),sfd:ps.map(p=>({x:p.z,y:p.v})),unit:['kN/m','kN·m/m']});
     datasets.push({label:'Toe · DESIGN',bmd:f.toe.diagram.map(p=>({x:p.z,y:p.m})),sfd:f.toe.diagram.map(p=>({x:p.z,y:p.v})),unit:['kN/m','kN·m/m']});
   }
 }
 return datasets.map(f=>'<section class="print-keep"><h3>'+esc(f.label)+'</h3><div class="diagram-grid">'+compactGraph(f.sfd,'SFD',f.unit[0],mode)+compactGraph(f.bmd,'BMD',f.unit[1],mode)+'</div></section>').join('');
}
/** Explicit page blocks. Append overflow equations/checks; never discard a FAIL to meet a page budget. */
export function compactReportPages(s,mode='si',{fbdHTML}={}){
 if(!s.result&&!fbdHTML)throw new TypeError('Native report requires its accepted Freebody Diagram');
 const d=info(s,mode),u=resultUnits(mode),c=stressContourFor(s),failed=d.checks.filter(x=>!x.ok),primary=essentialCheckRows(d.checks);
 const title=labels[d.type],identity=d.id,profile=d.profile,groups=s.result?legacyEquations(s,mode):mainEquationSections(s,mode);
 const status='<div class="rw-report-verdict'+(failed.length?' fail':'')+'"><b>'+ (failed.length?'ไม่ผ่าน '+failed.length+' รายการ':'ผ่านรายการตรวจที่ลงทะเบียน')+'</b> · ตรวจทั้งหมด '+d.checks.length+' รายการ · '+esc(u.title)+'</div>';
 const materials='<p class="rw-compact-caption">f′c '+u.quantity(d.i.fc,'MPa',1)+' · fy '+u.quantity(d.i.fy,'MPa',1)+' · H '+n(d.i.hp,2)+' m · โปรไฟล์ '+esc(profile)+'</p>';
 const checks=reportTable(['รายการตรวจ','ค่าที่ได้','เกณฑ์','D/C','ผล'],primary.map(x=>[x.label??x.key,x.value,x.criterion,n(x.dc,3),x.ok?'ผ่าน':'ไม่ผ่าน']),'checks');
 const governing=new Map();for(const check of primary){const key=check.ok?check.key.replace(/ฐาน \d+/g,'ฐานทุกตำแหน่ง').replace(/เสา \d+/g,'เสาทุกต้น'):check.key;const prev=governing.get(key);if(!prev||(check.dc??-1)>(prev.dc??-1))governing.set(key,check);}
 const summary='<section data-report-stage="checks"><h3>ผลตรวจ D/C · รายการที่คุม</h3><div class="rw-dc-grid">'+[...governing.values()].map(check=>'<div class="rw-dc-item'+(check.ok?'':' fail')+'"><span>'+esc(check.label??check.key)+'</span><b>'+(check.ok?'✓ ผ่าน':'! ไม่ผ่าน')+' · '+n(check.dc,3)+'</b></div>').join('')+'</div><p class="rw-compact-caption">รายการซ้ำแสดงตำแหน่งที่คุม · D/C ไม่มีค่าจะแสดง — · ค่าตรวจ/เกณฑ์ครบทุกแถวอยู่ใน Flow ตรวจ D/C</p></section>';
 const body=[];
 body.push({title:'01 · ข้อมูลและแรงกระทำ',html:status+materials+'<div class="rw-compact-columns wide-figure"><div data-report-stage="loads">'+compactLoads(s,d,mode)+'</div><div class="rw-cad-overview"><h3>Section · รูปตัดและขนาด</h3>'+cad(s,'section',75,{overview:true})+'</div></div>'
 +'<section data-report-stage="fbd"><h3>Freebody Diagram · แรงลัพธ์และการรับแรง</h3>'+(fbdHTML||legacyFbd(s,mode))+'</section><p class="rw-compact-caption">แรงใช้งานและแรงออกแบบระบุแยกกันในกราฟ/สมการ · ไม่บวกน้ำหนักตัวเองซ้ำใน DL</p>'+(governing.size<=16?summary:'')});
 const graphHTML=diagrams(s,mode),single=(graphHTML.match(/class="diagram-grid"/g)||[]).length===1;
 body.push({title:'02 · '+CONTOUR_LABEL,html:'<div class="'+(single?'rw-analysis-single':'rw-analysis-multiple')+'">'+contourSvg(s,mode,{height:single?420:220,detail:true})+'<p class="rw-compact-caption">'+esc('สีระหว่างสถานีประมาณเชิงเส้น · แถบครีบ/ฐาน/RB แสดงค่าจุดคุม')+'</p><section data-report-stage="diagrams">'+graphHTML+'</section><p class="rw-compact-caption">แกนนอน: ระยะตามสมาชิก (m) · กราฟคงเครื่องหมายแรงจากแบบจำลอง · จุดสี: |แรง| สูงสุด · จุดรับแรงอ่านจาก Freebody Diagram หน้า 1</p></div>'});
 // Size budget is based on text lengths at >= 10.5 px, not hidden overflow.
 const chunks=[];let chunk=[],weight=0;
 for(const g of groups)for(const row of g.rows){const cost=Math.max(1,Math.ceil(Math.max(...row.map(v=>String(v).length))/68));if(weight+cost>38&&chunk.length){chunks.push(chunk);chunk=[];weight=0;}chunk.push(row);weight+=cost;}
 if(chunk.length)chunks.push(chunk);
 const stressRows=c.fields.map(f=>[f.label+' · '+f.basis,'|σb|=|M|c/Ig / 1000',n(f.peak.m)+' kN·m × '+n(f.peak.c,4)+' m / '+n(f.peak.Ig,7)+' m⁴ / 1000',u.quantity(Math.abs(f.peak.sigma),'MPa',3)]);
 chunks[0]||=[];
 for(let j=0;j<chunks.length;j++)body.push({title:'03 · สมการหลัก'+(chunks.length>1?' · '+(j+1):''),html:'<section data-report-stage="equations">'+workedReportTable(chunks[j])+'</section>'+(j===chunks.length-1?'<h3>Stress Contour Plot · สูตรและค่าจุดคุม</h3>'+workedReportTable(stressRows)+'<p class="rw-compact-caption">MIT 3.11 Lecture 13 · Flexure formula p.7 · Ig หน้าตัดรวม · σb แสดงขนาดความเค้นที่ผิวนอกทั้งสองด้าน; เครื่องหมายจริง ±My/I · '+esc(CONTOUR_SOURCE)+'</p>':'')});
 // Keep all primary/failed rows. Native/Soldier many rows receive a separate page.
 if(governing.size>16)body.push({title:'03 · ผลตรวจ D/C',html:status+'<section data-report-stage="checks">'+checks+'</section><p class="rw-compact-caption">แสดงรายการหลักและรายการไม่ผ่านทั้งหมด · ทะเบียนเต็มเปิดได้ใน Flow ตรวจ D/C</p>'});
 const steel=reportTable(['มาร์ค','ตำแหน่ง / สมาชิก','ขนาดที่เลือก','รายละเอียดจากผลคำนวณ'],d.rows.map(b=>[b.mark,b.position.replace(/\s*\([^)]*\)/g,'').split(' — ')[0],b.size,b.detail]),'steel');
 const finalSection='<section data-report-final-section="'+d.type+'"><h3>SECTION SUMMARY · รูปตัดและเหล็กเสริม</h3>'+cad(s,'section',180)+'</section><p class="rw-compact-caption rw-drawing-note">มิติแบบ มม. / ระดับ ม. · แบบแสดงเหล็กที่เลือก ไม่ใช่รายการตัดดัด · '+(d.type==='duckfoot'?'ฐานแผ่บนดิน ไม่มีเสาเข็ม · คานเชื่อมเสาเหนือ footing':'อ่านร่วมกับแรงและผลตรวจในหน้าก่อน')+'</p><div class="rw-signatures"><span>ผู้ออกแบบ __________________</span><span>ผู้ตรวจสอบ __________________</span><span>วันที่ __________________</span></div>';
 body.push({title:'04 · เหล็กที่เลือกและแปลน',html:'<h3>ตารางเหล็กจากผลเดียวกัน</h3>'+steel+'<h3>PLAN · ผังตำแหน่ง</h3>'+cad(s,'plan',110)});
 body.push({title:'05 · รูปตัดสรุป',html:'<p class="rw-compact-caption">มาร์คเหล็กตรงกับตารางในหน้าก่อน · มิติแบบ มม. / ระดับ ม.</p>'+finalSection});
 return body.map((p,j)=>'<section class="sheet rw-compact-page pa4p" data-compact-page="'+(j+1)+'" data-report-stamp="'+esc(identity)+'"><header class="rw-compact-header"><div><b>RW-01 · '+esc(title)+'</b><div>โครงการ '+esc(s.info?.project||s.input.project||'ยังไม่ระบุ')+'</div></div><div class="meta">'+esc(profile)+'<strong>หน้า '+(j+1)+' / '+body.length+'</strong></div></header><div class="rw-compact-body"><h2>'+p.title+'</h2>'+p.html+'</div><footer class="rw-compact-footer"><span>NOT FOR CONSTRUCTION · ผลตามแบบจำลองที่ระบุ</span><span>'+esc(identity)+'</span></footer></section>');
}
export function compactReportHtml(s,mode='si',options={}){return '<style>'+COMPACT_REPORT_CSS+'</style><article class="rw-compact-report" data-report-layout="'+COMPACT_REPORT_VERSION+'">'+compactReportPages(s,mode,options).join('')+'</article>';}
