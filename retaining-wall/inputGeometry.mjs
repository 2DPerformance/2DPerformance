// Input-only geometry. No force, capacity, result status or reinforcement is fabricated.
import { duckfootGeometry, duckfootConcreteBoxes, DUCK_BEAM_CLEAR_DEFAULT } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { soldierStayGeometry,soldierCapGeometry } from './engine.mjs?rwv=20261003-main-equations-1';
import { rearPileCaps } from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
const positive=(v,f)=>Number.isFinite(+v)&&+v>0?+v:f;
const surface=(parts,x0,x1,y0,length,beta=0)=>{
  // A thin visible terrain skin follows the entered backfill slope. It carries no loads.
  const bounded=Math.max(-60,Math.min(60,Number.isFinite(+beta)?+beta:0));
  const rise=(x1-x0)*Math.tan(bounded*Math.PI/180);
  parts.push({kind:'ground',polygon:[[x0,y0-.025],[x1,y0+rise-.025],[x1,y0+rise+.025],[x0,y0+.025]],depth:length,z:-length/2});
};
export function inputGeometry(type,raw={}){
  const i={...raw};
  for(const [a,b]of Object.entries({H:'hp',baseT:'hz',stemT:'t',wallLength:'Lw',cfSpan:'L',cfThick:'bs',cfDepth:'cfL',cfHeight:'cfH'}))if(raw[a]!=null)i[b]=raw[a];
  const parts=[],box=(kind,position,size)=>parts.push({kind,position,size});
  if(type==='duckfoot'){
    const defaults={hp:2.3,t:.15,colDepth:.15,hz:.25,B:1.5,capL:1.2,postSpacing:2.5,nPosts:4,beamB:.2,beamH:.4};
    const safe=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,positive(i[k],v)]));safe.nPosts=Math.max(2,Math.min(20,Math.round(safe.nPosts)));
    safe.beamClear=i.beamClear!==''&&Number.isFinite(+i.beamClear)&&+i.beamClear>=0?+i.beamClear:DUCK_BEAM_CLEAR_DEFAULT;
    const g=duckfootGeometry(safe);parts.push(...duckfootConcreteBoxes(g));
    box('soil',[g.B/2,-g.hz-.17,0],[g.B+.3,.3,g.beamSpan+g.capL+.5]);
    box('ground',[g.B/2,-g.hz-.015,0],[g.B+.3,.03,g.beamSpan+g.capL+.5]);
    box('boundary',[-.04,-.015,0],[.025,.025,g.beamSpan+g.capL+.7]);
    return{type,g,parts,note:'คาน '+g.beamB.toFixed(2)+' × '+g.beamH.toFixed(2)+' ม. วิ่งเชื่อมเสาเหนือฐาน · ไม่มีเสาเข็ม'};
  }
  const H=positive(i.hp,3),Lw=positive(i.Lw,10);
  if(type==='soldier'){
    const D=positive(i.pileEmbS,H*.7),S=positive(i.pileS,1.2),w=positive(i.ipile,35)/100;
    const a=positive(i.stayLvl,Math.min(Math.max(H/4,.8),H-.2)),Lb=positive(i.stayLb,H),system=i.soldierSys||'stay';
    const g={hp:H,Lw,embed:D,pileS:S,pileB:w,stayLevel:a,stayLength:Lb,staySystem:system};
    g.capBeams=soldierCapGeometry(i,H,w,system==='cant'?0:a,system!=='cant').filter(b=>b.present);
    for(const b of g.capBeams)box('base',[0,b.y,0],[b.width,b.depth,Lw]);
    const count=Math.min(340,Math.ceil(Lw/S-1e-9)+1);
    for(let j=0;j<count;j++){
      const z=-Lw/2+Math.min(j*S,Lw);
      box('pile',[0,(H-D)/2,z-w*.32],[w,H+D,w*.17]);box('pile',[0,(H-D)/2,z+w*.32],[w,H+D,w*.17]);box('pile',[0,(H-D)/2,z],[w*.23,H+D,w*.64]);
    }
    for(let y=0;y<H;y+=.4)box('wall',[.03,y+Math.min(.4,H-y)/2,0],[positive(i.tLag,5)/100,Math.min(.4,H-y)*.95,Lw]);
    if(system==='stay'){
      const layout=soldierStayGeometry({H,D,S,Lw,a,Lb,capLvl:+i.capLvl||0,ancLe:+i.ancLe||0,ancB:positive(i.ancPileSec,i.ipile||35)/100,bw:positive(i.stayBw,25)/100,bh:positive(i.stayBh,50)/100});g.stayLayout=layout;
      for(const member of layout.members)parts.push({kind:'strap',member});
      for(const p of layout.anchors)box('pile',[p.head.x,(p.head.y+p.tip.y)/2,p.head.z],[p.width,p.head.y-p.tip.y,p.width]);
      g.rearCaps=rearPileCaps(layout,i);
      for(const cap of g.rearCaps)parts.push({kind:'cap',...cap});
    }else if(system==='anchor'){
      const angle=positive(i.stayAng,20)*Math.PI/180,l=positive(i.gaFreeLength,H),b=positive(i.gaBondLength,1);
      for(let j=0;j<count;j++)parts.push({kind:'strap',line:[[0,H-a,-Lw/2+Math.min(j*S,Lw)],[(l+b)*Math.cos(angle),H-a-(l+b)*Math.sin(angle),-Lw/2+Math.min(j*S,Lw)]],diameter:positive(i.gaBondDia,100)/1000});
    }
    const soilReach=Math.max(2.2,Lb+1.2);
    box('soil',[soilReach/2,H/2,0],[soilReach,H,Lw]);
    surface(parts,0,soilReach,H,Lw,i.beta);
    box('ground',[-.6,-.015,0],[1.2,.03,Lw]);
    return{type,g,parts,note:system==='stay'?'แคปหัวเข็มสมอด้านหลังเป็นรูปประกอบ · ยังไม่ตรวจหน้าตัด/เหล็กของแคป':'เข็มหน้าและระบบยึดรั้งตามที่เลือก · ระยะ Auto เป็นภาพสมมติจนกดคำนวณ'};
  }
  const g={hp:H,Lw,B:positive(i.B,3),hz:positive(i.hz,.35),t:positive(i.t,.3),toe:Math.max(0,+i.toe||0),heel:Math.max(0,+i.heel||0),ttop:positive(i.ttop,positive(i.t,.3))};
  box('base',[g.B/2,-g.hz/2,0],[g.B,g.hz,Lw]);
  parts.push({kind:'wall',polygon:[[g.toe,0],[g.toe+g.t,0],[g.toe+g.ttop,H],[g.toe,H]],depth:Lw,z:-Lw/2});
  if(['counterfort','pilecf'].includes(type)){
    const thick=positive(i.bs,.25),step=positive(i.L,2)+thick;
    for(let z=0;z<Lw;z+=step)parts.push({kind:'rib',polygon:[[g.toe+g.t,0],[g.toe+g.t,positive(i.cfH,H)],[g.toe+g.t+positive(i.cfL,g.heel||1),0]],depth:Math.min(thick,Lw-z),z:z-Lw/2});
  }
  if(['pile','pilecf'].includes(type)){
    const w=positive(i.pileB,.35),D=positive(i.pileEmb,6);
    // Engine/Plan/Section define edge distance to the pile centre, not its face.
    for(const [x,spacing,bat]of [[positive(i.pileEdT,.55),positive(i.pileSt,2),+i.pileBatT||0],[g.B-positive(i.pileEdH,.55),positive(i.pileSh,2),+i.pileBatH||0]]){
      const count=Math.max(2,Math.min(340,Math.max(1,Math.round(Lw/Math.max(spacing,.6)))+1));
      for(let k=0;k<count;k++){const z=-Lw/2+k*Lw/(count-1);parts.push({kind:'pile',line:[[x,-g.hz,z],[x-D*Math.tan(bat*Math.PI/180),-g.hz-D,z]],diameter:w});}
    }
  }
  box('soil',[g.toe+g.t+g.heel/2,H/2,0],[Math.max(.1,g.heel),H,Lw]);
  surface(parts,g.toe+g.t,g.toe+g.t+Math.max(.1,g.heel),H,Lw,i.beta);
  box('ground',[-.6,-.015,0],[1.2,.03,Lw]);
  return{type,g,parts,note:'ดินถมด้านหลัง · ฐาน Toe ด้านหน้า / Heel ด้านหลัง · รูปทรงตามขนาดกรอก'};
}
