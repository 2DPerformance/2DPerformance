/** Accepted native-system geometry -> CAD primitives, model millimetres.
 * Rebar axes are projected from Snapshot; no fabrication paths are inferred. */
import {drawing,line,poly,circle,text,dim,hatch,leader,levelMark,sectionMark} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {rearPileCaps} from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import {duckfootConcreteBoxes} from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import {pileDrawingRows} from './pileDrawingLayout.mjs?rwv=20261001-a4-cad-1';
import {dimensionLinework} from './drafting/dimensionLinework.mjs?rwv=20261001-leader-layout-1';

const G='RW-CONCRETE',D='RW-DIM',T='RW-TEXT',R='RW-REBAR',S='RW-SOIL';
const mm=v=>v*1000,pt=(x,y)=>({x:mm(x),y:mm(y)});
const polygon=(points,pc='CUT',layer=G)=>poly(points.map(([x,y])=>pt(x,y)),pc,layer,true);
function concrete(E,points,pc='CUT') {
  if(pc==='CUT')E.push(hatch(points.map(([x,y])=>pt(x,y)),'CONCRETE','RW-HATCH'));
  E.push(polygon(points,pc));
}
function box(E,x,y,w,h,pc='CUT'){concrete(E,[[x,y],[x+w,y],[x+w,y+h],[x,y+h]],pc);}
function soil(E,points){E.push(hatch(points.map(([x,y])=>pt(x,y)),'SOIL_FILL',S),polygon(points,'PROJECTION',S));}
function centre(E,a,b){E.push(line(pt(...a),pt(...b),'CENTRELINE','RW-CENTRE'));}
function dimension(E,a,b,offset,scale,note,vertical=false,chain=null) {
  E.push(dim(pt(...a),pt(...b),offset*scale,D,{vertical,note,chain}));
}
function caption(E,x,y,label){E.push(text(pt(x,y),label,2.8,T));}
function connection(E,x,y,scale){E.push(circle(pt(x,y),1.1*scale,'DIM','RW-CONNECTION'));
}
function level(E,x,y,value,side='right',extendTo=null){
  E.push({...levelMark(pt(x,y),mm(value),D,{side,extendTo:extendTo==null?null:mm(extendTo)}),textHeight:2.8});
}
function iSection(E,cx,cy,b,pc='CUT') {
  const h=b/2,w=b*.085,web=b*.115;
  E.push(polygon([[cx-h,cy-h],[cx+h,cy-h],[cx+h,cy-h+w],[cx+web,cy-h+w],
    [cx+web,cy+h-w],[cx+h,cy+h-w],[cx+h,cy+h],[cx-h,cy+h],[cx-h,cy+h-w],
    [cx-web,cy+h-w],[cx-web,cy-h+w],[cx-h,cy-h+w]],pc));
}
function beamEnvelope(E,a,b,depth) {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(!(len>0&&depth>0))throw new TypeError('Native CAD: complete beam axis required');
  const nx=-dy/len*depth/2,ny=dx/len*depth/2;
  concrete(E,[[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],'OUTLINE');
  centre(E,a,b);
}

/** Deduplicate axes that occupy the same cut projection. Longitudinal axes
 * appear as actual-diameter dots; the other paths retain accepted coordinates.
 * Callouts label marks only; sizes and all detailing stay in the full schedule. */
function rebarSection(E,s,scale) {
  const seen=new Set(),heads=new Map(),shift=['duckfoot','soldier'].includes(s.type)?0:s.geometry.hz;
  for(const group of s.rebarLayout?.groups||[]) {
    for(const path of group.paths) {
      const projected=path.map(([x,y])=>pt(x,y-shift));
      const key=projected.map(p=>[p.x.toFixed(3),p.y.toFixed(3)]).join('|')+'|'+group.db;
      if(seen.has(key))continue;seen.add(key);
      const a=projected[0],b=projected[projected.length-1];
      const collapsed=projected.every(p=>Math.hypot(p.x-a.x,p.y-a.y)<.001);
      if(collapsed)E.push(circle(a,group.db/2,'REBAR',R,true));
      else E.push(poly(projected,'REBAR',R));
      if(s.type==='soldier')continue; // existing RB geometry labels; dedicated sections show sizes
      const mark=group.mark.replace(/-ties$/,'');
      if(s.type==='duckfoot'&&mark==='GB1')continue; // geometry callout already labels the raised beam
      if(!heads.has(mark))heads.set(mark,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    }
  }
  if(s.type==='soldier')return {lastLabelY:0,labelX:0};
  // Keep labels in separate lanes outside concrete. Full selected sizes remain
  // on the sheet legend and P01; a callout cannot establish fabrication detail.
  const g=s.geometry,x=s.type==='duckfoot'?(g.B+.35)*1000:g.B*1000+24*scale,top=g.hp*1000;
  const sorted=[...heads].sort((a,b)=>b[1].y-a[1].y);
  let previous=top+6*scale;
  sorted.forEach(([mark,head])=>{
    let y=Math.min(head.y,previous-6*scale);
    // The raised beam has its own geometry callout. Reserve its label lane
    // when beamClear changes instead of placing the column mark on top of it.
    if(s.type==='duckfoot'&&Math.abs(y-(g.beamTop+.016*scale)*1000)<7*scale)y=(g.beamTop+.016*scale)*1000-7*scale;
    previous=y;
    E.push(leader([head,{x:x+4*scale,y},{x:x+6*scale,y}],mark,2.8,T));
  });
  return {lastLabelY:sorted.length?previous:-shift*1000,labelX:x+6*scale};
}

function piledSection(s,scale) {
  const E=[],g=s.geometry,i=s.input,p=s.forces.pile,H=g.hp,hz=g.hz,x=g.toe;
  const back=x+g.t,top=x+g.ttop,reach=Math.max(g.B,back+.5);
  soil(E,[[back,0],[reach,0],[reach,H+(reach-back)*Math.tan(i.beta*Math.PI/180)],[top,H]]);
  box(E,0,-hz,g.B,hz);
  concrete(E,[[x,0],[x,H],[top,H],[back,0]]);
  if(s.type==='pilecf')concrete(E,[[back,0],[back,g.ribHeight],[back+g.ribLength,0]],'OUTLINE');
  const supportHeads=[];
  for(const [px,angle]of [[g.pileToeX,p.btTdeg],[g.pileHeelX,p.btHdeg]]) {
    const dx=Math.tan(angle*Math.PI/180)*g.pileEmb;
    beamEnvelope(E,[px,-hz],[px-dx,-hz-g.pileEmb],g.pileB);
    connection(E,px,-hz,scale);supportHeads.push([px,-hz]);
  }
  const barLabels=rebarSection(E,s,scale);
  // Put base chains beyond the pile tips, outside the concrete/pile/rebar view.
  // Extension lines still originate at the accepted footing endpoints.
  const belowPiles=-g.pileEmb*1000/scale;
  const toeText=dimensionLinework(dim(pt(0,-hz),pt(x,-hz),-6*scale,D,{note:'Toe'}),scale).textBox;
  const heelText=dimensionLinework(dim(pt(back,-hz),pt(g.B,-hz),-6*scale,D,{note:'Heel'}),scale).textBox;
  // Tight text is moved outside its span. Compare those actual extents, not
  // a midpoint estimate, before sharing a chain lane.
  const separateBaseLabels=Math.max(toeText.min.x,heelText.min.x)<Math.min(toeText.max.x,heelText.max.x)+3*scale;
  dimension(E,[0,-hz],[g.B,-hz],belowPiles-(separateBaseLabels?19:13),scale,'B');
  dimension(E,[0,-hz],[x,-hz],belowPiles-6,scale,'Toe','', 'base');
  dimension(E,[back,-hz],[g.B,-hz],belowPiles-(separateBaseLabels?12:6),scale,'Heel','', 'base');
  dimension(E,[x,0],[x,H],-17,scale,'H',true);
  dimension(E,[g.B,-hz],[g.B,0],8,scale,'hz',true);
  dimension(E,[g.pileHeelX,-hz],[g.pileHeelX,-hz-g.pileEmb],-8,scale,'Le',true);
  dimension(E,[x,H],[top,H],6,scale,'t top');
  level(E,reach,H,H,'right',reach+.1);
  level(E,0,0,0,'left',-.2);
  const supportY=barLabels.lastLabelY-8*scale;
  E.push(leader([pt(...supportHeads[1]),{x:barLabels.labelX-2*scale,y:supportY},{x:barLabels.labelX,y:supportY}],
    '○ จุดต่อหัวเข็ม',2.8,T));
  caption(E,back+.12,H*.58,'ดินถม');
  return drawing('RW-NATIVE-SECTION','รูปตัดพนังและฐานบนเสาเข็ม',E,{sourceStamp:s.stamp,physicalUnits:'mm'});
}

function piledPlan(s,scale) {
  const E=[],g=s.geometry,p=s.forces.pile;
  // Engine quantity ledger uses rounded bays (engine.mjs BBS nPT/nPH).
  // nT/nH in the force ledger are pile densities per metre, not piece counts.
  const rows=pileDrawingRows(g,s.quantities.piles),counts=rows.map(row=>row.count);
  box(E,0,0,g.Lw,g.B,'OUTLINE');
  box(E,0,g.toe,g.Lw,g.t);
  if(s.type==='pilecf')for(let j=0;j<g.ribCount;j++){
    const z=Math.min(j*g.ribCentreSpacing,g.Lw-g.ribThickness);
    box(E,z,g.toe+g.t,g.ribThickness,g.ribLength);
  }
  for(const {x,count,stations} of rows) {
    if(!(Number.isInteger(count)&&count>=2))throw new TypeError('Native CAD: engine pile count required');
    for(let j=0;j<count;j++){
      const z=stations[j];
      if(s.input.pileShape==='sq')box(E,z-g.pileB/2,x-g.pileB/2,g.pileB,g.pileB,'HIDDEN');
      else E.push(circle(pt(z,x),mm(g.pileB/2),'HIDDEN',G));
      centre(E,[z-g.pileB,x],[z+g.pileB,x]);
    }
  }
  E.push({...sectionMark(pt(0,-.022*scale),pt(0,g.B+.025*scale),'A','RW-MARK'),textHeight:2.8});
  dimension(E,[0,0],[g.Lw,0],-13,scale,'Lw');
  dimension(E,[g.Lw,0],[g.Lw,g.B],10,scale,'B',true);
  dimension(E,[0,0],[g.Lw/(counts[0]-1),0],-6,scale,'sT ผัง');
  if(s.type==='pilecf')dimension(E,[0,g.B],[g.ribCentreSpacing,g.B],6,scale,'ครีบ c/c');
  caption(E,g.Lw*.05,g.B+scale*.014,'เสาเข็ม '+counts[0]+' + '+counts[1]+' ต้น · ตามจำนวน BBS');
  caption(E,g.Lw*.05,g.B+scale*.019,'sT / sH ออกแบบ '+mm(g.pileSt)+' / '+mm(g.pileSh)+' มม. · ผังแบ่งช่วงตามจำนวน');
  return drawing('RW-NATIVE-PLAN','ผังฐานและเสาเข็ม',E,{sourceStamp:s.stamp,pileCounts:counts});
}

function duckSection(s,scale) {
  const E=[],g=s.geometry;
  soil(E,[[-.25,-g.hz-.35],[g.B+.3,-g.hz-.35],[g.B+.3,-g.hz],[0,-g.hz]]);
  box(E,0,-g.hz,g.B,g.hz);box(E,0,0,g.t,g.hp);
  box(E,0,g.beamBottom,g.beamB,g.beamH);
  centre(E,[g.t/2,-g.hz-.08],[g.t/2,g.hp+.1]);
  E.push(line(pt(-.08,-g.hz-.4),pt(-.08,g.hp+.15),'CENTRELINE','RW-BOUNDARY'));
  rebarSection(E,s,scale);
  dimension(E,[0,-g.hz],[g.B,-g.hz],-10,scale,'B');
  dimension(E,[0,0],[0,g.hp],-12,scale,'H',true);
  dimension(E,[g.B,-g.hz],[g.B,0],8,scale,null,true);
  dimension(E,[g.t,0],[g.t,g.beamBottom],8,scale,null,true);
  dimension(E,[g.beamB,g.beamBottom],[g.beamB,g.beamTop],18,scale,null,true);
  dimension(E,[0,g.hp],[g.t,g.hp],6,scale,'t');
  // The datum stays outside the beam/clearance dimension lanes at any scale.
  level(E,g.B,0,0,'right',Math.max(g.B+.35,g.beamB+.028*scale));
  caption(E,-.35,-g.hz-.65,'แนวเขต · ฐานแผ่บนดิน ไม่มีเสาเข็ม');
  // Reserve a paper-sized lane above the short beam/clearance dimensions.
  // A tall failed column chooses a coarser scale; fixed model offsets overlap.
  const beamLabelY=g.beamTop+.016*scale;
  const beamLabelX=Math.max(g.B+.4,g.beamB+.026*scale);
  E.push(leader([pt(g.beamB,g.beamAxis),pt(beamLabelX-.15,beamLabelY),pt(beamLabelX,beamLabelY)],
    'GB1 · คานเหนือ footing '+mm(g.beamB)+'×'+mm(g.beamH),2.8,T));
  return drawing('RW-NATIVE-SECTION','รูปตัดฐานตีนเป็ด เสาชิดเขตและคานเหนือฐาน',E,{sourceStamp:s.stamp,
    beamBottom:g.beamBottom,beamTop:g.beamTop,noPiles:true});
}
function duckPlan(s,scale) {
  const E=[],g=s.geometry;
  for(const m of duckfootConcreteBoxes(g)){
    const [x,,z]=m.position,[w,,d]=m.size;
    box(E,z-d/2,x-w/2,d,w,m.kind==='wall'?'CUT':m.kind==='base'?'HIDDEN':'OUTLINE');
  }
  const z0=-g.beamSpan/2,z1=g.beamSpan/2;
  centre(E,[z0-g.capL/2-.3,g.t/2],[z1+g.capL/2+.3,g.t/2]);
  E.push(line(pt(z0-g.capL/2,-.08),pt(z1+g.capL/2,-.08),'CENTRELINE','RW-BOUNDARY'));
  dimension(E,[z0,g.B],[z1,g.B],10,scale,'แนวศูนย์เสา');
  dimension(E,[z0,g.B],[z0+g.postSpacing,g.B],5,scale,'Spost');
  dimension(E,[z0-g.capL/2,0],[z0+g.capL/2,0],-10,scale,'Lpad');
  dimension(E,[z1+g.capL/2,0],[z1+g.capL/2,g.B],10,scale,'B',true);
  E.push({...sectionMark(pt(z0,-.3),pt(z0,g.B+.3),'A','RW-MARK'),textHeight:2.8});
  caption(E,z0,g.B+.018*scale,g.nPosts+' เสาอยู่ระนาบเดียวกัน · คาน GB1 ต่อเนื่องตามแนวเขต');
  return drawing('RW-NATIVE-PLAN','ผังฐานตีนเป็ดและแนวคาน',E,{sourceStamp:s.stamp,columns:g.nPosts});
}

function soldierSection(s,scale) {
  const E=[],g=s.geometry,H=g.hp,Dp=g.embed,b=g.pileB,layout=g.stayLayout;
  const reach=Math.max(2,layout?.Lb||g.anchor?.horizontalFree||0)+.8;
  soil(E,[[b/2,0],[reach,0],[reach,H],[b/2,H]]);
  soil(E,[[-.7,-Dp],[b/2,-Dp],[b/2,0],[-.7,0]]);
  box(E,-b/2,-Dp,b,H+Dp,'OUTLINE');
  centre(E,[0,-Dp-.1],[0,H+.2]);
  // Thin lagging and registered longitudinal beams are distinct from the pile.
  box(E,b/2,0,g.lagT,H,'OUTLINE');
  let capLabelY=H*1000+8*scale;
  for(const beam of [...g.capBeams].sort((a,b)=>b.y-a.y)){
    box(E,-beam.width/2,beam.y-beam.depth/2,beam.width,beam.depth);
    const target=[beam.width/2,beam.y];
    capLabelY=Math.min((beam.y+.1)*1000,capLabelY-7*scale);
    const labelX=(-b/2)*1000-15*scale;
    E.push(leader([pt(...target),{x:labelX+2*scale,y:capLabelY},{x:labelX,y:capLabelY}],beam.mark,2.8,T));
  }
  rebarSection(E,s,scale);
  if(g.staySystem==='stay'&&layout?.members.length) {
    const m=layout.members[0];
    beamEnvelope(E,[m.front.x,m.front.y],[m.rear.x,m.rear.y],m.depth);
    connection(E,m.front.x,m.front.y,scale);connection(E,m.rear.x,m.rear.y,scale);
    const ap=layout.anchors[m.anchorIndex];
    box(E,ap.head.x-ap.width/2,ap.tip.y,ap.width,ap.head.y-ap.tip.y,'OUTLINE');
    const cap=(g.rearCaps||rearPileCaps(layout))[m.anchorIndex];
    box(E,cap.position[0]-cap.size[0]/2,cap.position[1]-cap.size[1]/2,cap.size[0],cap.size[1],'OUTLINE');
    // Separate the support/member labels from the ground level marks even for
    // a 0.5 m wall; their physical sizes and actual connection points stay fixed.
    E.push(leader([pt(ap.head.x,ap.head.y),pt(reach+.2,H+.017*scale),pt(reach+.35,H+.017*scale)],'CAP สมอ · รูปประกอบ',2.8,T));
    E.push(leader([pt((m.front.x+m.rear.x)/2,(m.front.y+m.rear.y)/2),pt(reach+.2,H+.010*scale),pt(reach+.35,H+.010*scale)],'B1 · สเตย์ฉายบนระนาบ',2.8,T));
    dimension(E,[0,H],[layout.Lb,H],10,scale,'Lb');
    dimension(E,[ap.head.x,ap.tip.y],[ap.head.x,ap.head.y],9,scale,'La',true);
  }else if(g.staySystem==='anchor'&&g.anchor?.complete) {
    const a=g.anchor,angle=a.angle*Math.PI/180,head=[0,H-g.stayLevel],free=[a.horizontalFree,head[1]-a.freeLength*Math.sin(angle)],
      end=[a.totalLength*Math.cos(angle),head[1]-a.totalLength*Math.sin(angle)];
    E.push(line(pt(...head),pt(...free),'OUTLINE','RW-ANCHOR'),line(pt(...free),pt(...end),'REBAR','RW-ANCHOR'));
    connection(E,...head,scale);caption(E,free[0],free[1]-.1,'GA · free / bond');
  }
  dimension(E,[-b/2,0],[-b/2,H],-30,scale,'H',true);
  dimension(E,[-b/2,-Dp],[-b/2,0],-30,scale,'D',true);
  if(g.staySystem!=='cant')dimension(E,[b/2,H-g.stayLevel],[b/2,H],8,scale,'a',true);
  E.push(line(pt(-.9,0),pt(reach+.3,0),'HIDDEN','RW-GROUND'));
  level(E,reach,0,0,'right',reach+.2);level(E,reach,H,H,'right',reach+.2);
  caption(E,.6,H*.7,'ดินถม');
  return drawing('RW-NATIVE-SECTION','รูปตัดเสาเข็มพืดและระบบยึดรั้ง',E,{sourceStamp:s.stamp,
    projectedStay:g.staySystem==='stay',rearCapAuthority:false});
}

function soldierPlan(s,scale) {
  const E=[],g=s.geometry,layout=g.stayLayout,L=g.Lw,b=g.pileB;
  const fronts=layout?.fronts||Array.from({length:Math.ceil(L/g.pileS-1e-9)+1},(_,j)=>({x:0,z:-L/2+Math.min(j*g.pileS,L)}));
  for(const f of fronts)iSection(E,f.z,0,b);
  box(E,-L/2,b/2,L,g.lagT,'OUTLINE');
  const beams=g.capBeams;
  if(beams.length)box(E,-L/2,-beams[0].width/2,L,beams[0].width,'OUTLINE');
  for(const m of layout?.members||[])beamEnvelope(E,[m.front.z,m.front.x],[m.rear.z,m.rear.x],m.width);
  for(const cap of g.rearCaps||rearPileCaps(layout))box(E,cap.position[2]-cap.size[2]/2,cap.position[0]-cap.size[0]/2,cap.size[2],cap.size[0],'OUTLINE');
  for(const a of layout?.anchors||[])iSection(E,a.head.z,a.head.x,a.width,'HIDDEN');
  const depth=Math.max(.5,layout?.Lb||0);
  const cut=layout?.members[0];
  const dx=cut?cut.rear.z-cut.front.z:0,dy=cut?cut.rear.x-cut.front.x:1,len=Math.hypot(dx,dy),ex=.006*scale*dx/len,ey=.006*scale*dy/len;
  const start=cut?[cut.front.z-.022*scale*dx/len,cut.front.x-.022*scale*dy/len]:[-L/2,-.022*scale];
  const end=cut?[cut.rear.z+ex,cut.rear.x+ey]:[-L/2,depth+ey];
  E.push({...sectionMark(pt(...start),pt(...end),'A','RW-MARK'),textHeight:2.8});
  dimension(E,[-L/2,0],[L/2,0],-9,scale,'Lw');
  dimension(E,[-L/2,0],[-L/2+Math.min(g.pileS,L),0],-4,scale,'S');
  if(layout)dimension(E,[L/2,0],[L/2,layout.Lb],8,scale,'Lb',true);
  caption(E,-L/2,depth+.017*scale,'เข็มหน้า '+fronts.length+' ต้น'+(layout?' · สมอ '+layout.anchors.length+' ต้น · V-stay'+(s.input.stayPattern==='alternate'?' เสาเว้นเสา '+layout.members.length+' แนว':''):' · '+g.staySystem));
  return drawing('RW-NATIVE-PLAN','ผังเสาเข็มพืดและระบบยึดรั้ง',E,{sourceStamp:s.stamp,
    frontCount:fronts.length,anchorCount:layout?.anchors.length||0});
}

export function nativeCadViews(s) {
  if(!s?.geometry||!s.bbs?.length||!s.stamp)throw new TypeError('Native CAD: accepted Snapshot required');
  const factories=s.type==='duckfoot'?[duckPlan,duckSection]:s.type==='soldier'?[soldierPlan,soldierSection]
    :['pile','pilecf'].includes(s.type)?[piledPlan,piledSection]:null;
  if(!factories)throw new TypeError('Native CAD: unsupported system');
  return {plan:scale=>factories[0](s,scale),section:scale=>factories[1](s,scale)};
}
