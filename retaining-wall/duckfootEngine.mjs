/** Property-edge spread pads with a continuous beam ALONG the column line.
 * SI throughout. No piles, transverse strap, soil tension or beam bearing.
 * RC section resistance: ACI 318-14 Chapters 21/22/25. Load factors are explicit
 * project inputs, not a claimed automatic building-code combination generator.
 */
import { gaussSolve, toeStripActions } from './engine.mjs?rwv=20261003-main-equations-1&stay=20261004-alternate-1';
import { duckfootGeometry } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { normalizeDuckLoadInput } from './loadInput.mjs?rwv=20260930-load-units-1';

const PI=Math.PI, sizes=[12,16,20,25,28,32], area=d=>PI*d*d/4;
const num=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'คำนวณไม่ได้';
const check=(key,value,capacity,unit,fix)=>({key,value:num(value)+' '+unit,
  criterion:'≤ '+num(capacity)+' '+unit,ok:Number.isFinite(value)&&Number.isFinite(capacity)&&capacity>0&&value<=capacity+1e-9,
  dc:Number.isFinite(value)&&capacity>0?value/capacity:null,fix});
const beta1=fc=>Math.max(.65,.85-.05*Math.max(fc-28,0)/7);

/** Equal-span continuous beam, with piecewise uniform loads and free joint rotations. */
function solveBeamLine(n,L,loads){
  const K=Array.from({length:n},()=>Array(n).fill(0)),F=Array(n).fill(0),els=[];
  const gp=[-.906179845938664,-.538469310105683,0,.538469310105683,.906179845938664];
  const gw=[.236926885056189,.478628670499366,.568888888888889,.478628670499366,.236926885056189];
  for(let j=0;j<n-1;j++){
    const k=[[12/L**3,6/L**2,-12/L**3,6/L**2],[6/L**2,4/L,-6/L**2,2/L],
      [-12/L**3,-6/L**2,12/L**3,-6/L**2],[6/L**2,2/L,-6/L**2,4/L]];
    const f=[0,0,0,0];
    for(const [a,b,p] of loads)if(b>a&&p){
      for(let q=0;q<5;q++){
        const x=(a+b)/2+gp[q]*(b-a)/2,s=x/L;
        const N=[1-3*s*s+2*s**3,L*(s-2*s*s+s**3),3*s*s-2*s**3,L*(-s*s+s**3)];
        for(let z=0;z<4;z++)f[z]-=p*N[z]*gw[q]*(b-a)/2;
      }
    }
    K[j][j]+=k[1][1];K[j][j+1]+=k[1][3];K[j+1][j]+=k[3][1];K[j+1][j+1]+=k[3][3];
    F[j]+=f[1];F[j+1]+=f[3];els.push({k,f});
  }
  const rot=gaussSolve(K,F),reactions=Array(n).fill(0),spans=[];
  for(let j=0;j<els.length;j++){
    const {k,f}=els[j],u=[0,rot[j],0,rot[j+1]],r=k.map((row,z)=>row.reduce((s,v,p)=>s+v*u[p],0)-f[z]);
    reactions[j]+=r[0];reactions[j+1]+=r[2];
    const at=x=>loads.reduce((v,[a,b,p])=>{const l=Math.max(0,Math.min(x,b)-a);
      return {x,V:v.V-p*l,M:v.M-p*l*(x-a-l/2)};},{x,V:r[0],M:-r[1]+r[0]*x});
    const xs=[0,L,...loads.flatMap(([a,b])=>[a,b]),...Array.from({length:41},(_,z)=>L*z/40)];
    for(const [a,b,p] of loads){
      if(p>0){const x=a+at(a).V/p;if(x>a&&x<b)xs.push(x);}
    }
    const grid=xs.sort((a,b)=>a-b).filter((x,z,a)=>!z||Math.abs(x-a[z-1])>1e-10).map(at);
    spans.push({index:j,L,grid,leftReaction:r[0],rightReaction:r[2],leftMoment:-r[1],rightMoment:r[3]});
  }
  return {reactions,spans,totalLoad:(n-1)*loads.reduce((v,[a,b,p])=>v+(b-a)*p,0),
    moment:Math.max(...spans.flatMap(s=>s.grid.map(p=>Math.abs(p.M)))),
    shear:Math.max(...spans.flatMap(s=>s.grid.map(p=>Math.abs(p.V))))};
}

/** Beam above pads. Count full columns, then subtract ONLY actual column/beam
 * intersection from beam gravity. Concrete beyond the column width at each
 * joint is a direct joint gravity load, not a fictitious torsion distribution.
 * End columns intersect half a centre span. */
export function duckBeam({nPosts,postSpacing,colDepth=0,t=0,beamB,beamH,gc,qBeam=0}){
  const L=postSpacing,g=colDepth/2,w=beamB*beamH*gc,overlapB=Math.min(t,beamB);
  const overlapW=overlapB*beamH*gc,x=beamB/2,jointX=(overlapB+beamB)/2;
  const segments=[[0,g,qBeam],[g,L-g,w+qBeam],[L-g,L,qBeam]];
  const force=solveBeamLine(nPosts,L,segments);
  const jointWeights=Array.from({length:nPosts},(_,j)=>(w-overlapW)*colDepth*(j===0||j===nPosts-1?.5:1));
  const reactions=force.reactions.map((R,j)=>R+jointWeights[j]);
  const reactionFirstMoments=force.reactions.map((R,j)=>R*x+jointWeights[j]*jointX);
  return {...force,w,qBeam,overlapW,overlapLength:(nPosts-1)*colDepth,
    reactions,spanReactions:force.reactions,jointWeights,jointX,
    totalLoad:force.totalLoad+jointWeights.reduce((a,b)=>a+b,0),
    concreteWeight:(nPosts-1)*(w*L-overlapW*colDepth),
    reactionFirstMoments,totalFirstMoment:reactionFirstMoments.reduce((a,b)=>a+b,0),
    note:'คานเหนือฐาน รองรับแนวดิ่งที่เสาทุกต้น หมุนได้ ทรุดเท่ากัน ไม่คิดดินช่วยรับคาน; แรงคานผ่านเสาลงฐานของตน ไม่ค้ำเสาในระนาบตั้งฉากเขต'};
}

export function duckContact(V,M,B,L){
  const x=M/V,e=x-B/2,inside=V>0&&x>0&&x<B,full=inside&&Math.abs(e)<=B/6;
  const width=inside?(full?B:3*Math.min(x,B-x)):null;
  const qBoundary=!inside?null:full?V/(B*L)*(1-6*e/B):x<B/2?2*V/(width*L):0;
  const qInside=!inside?null:full?V/(B*L)*(1+6*e/B):x>B/2?2*V/(width*L):0;
  return {totalV:V,totalM:M,xResultant:x,eccentricity:e,inside,fullContact:full,contactWidth:width,
    qBoundary,qInside,qMax:inside?Math.max(qBoundary,qInside):null};
}

/** Tied, symmetrical rectangular column; explicit strain-compatible resistance.
 * Bars lie on the two x faces and are distributed along the width. */
export function duckColumnCurve({b,h,fc,fy,cover,db,n}){
  const As=n*area(db),Ag=b*h*1e6,offset=cover+.01+db/2000;
  const layers=[{y:offset,A:As/2},{y:h-offset,A:As/2}];
  const Pmax=.8*.65*(.85*fc*(Ag-As)+fy*As)/1000;
  const states=[];
  for(let k=0;k<=480;k++){
    const c=h*Math.exp(Math.log(.002)+k/480*Math.log(1e5)),a=Math.min(beta1(fc)*c,h);
    let P=.85*fc*b*a*1e6,M=P*(h-a)/2;
    for(const s of layers){const stress=Math.max(-fy,Math.min(fy,200000*.003*(c-s.y)/c));
      const force=(stress-(s.y<=a?.85*fc:0))*s.A;P+=force;M+=force*(h/2-s.y);}
    const et=Math.max(0,.003*(h-offset-c)/c),ey=fy/200000;
    const phi=et<=ey?.65:et>=.005?.9:.65+.25*(et-ey)/(.005-ey);
    states.push({P:phi*P/1000,M:Math.abs(phi*M/1000),phi,c,et});
  }
  const capacityAt=P=>{
    if(P<0||P>Pmax)return 0;
    let cap=0;for(let j=1;j<states.length;j++){
      const a=states[j-1],b=states[j];
      if((P-a.P)*(P-b.P)<=0&&a.P!==b.P)cap=Math.max(cap,a.M+(b.M-a.M)*(P-a.P)/(b.P-a.P));
    }return cap;
  };
  return {As,Pmax,states,capacityAt,offset};
}

function flexural(M,b,h,cover,fc,fy,{mesh=false,under=0}={}){
  let last;
  for(const db of sizes){
    const d=h-cover-under-db/2000,bb=b*1000,dd=d*1000;
    const root=d>0?1-2*(M*1e6/(.9*bb*dd*dd))/(.85*fc):-1;
    const req=root>=0?.85*fc/fy*(1-Math.sqrt(root))*bb*dd:Infinity;
    const min=mesh?.0018*b*h*1e6:Math.max(.25*Math.sqrt(fc)/fy,1.4/fy)*bb*dd;
    const AsReq=Math.max(req,min);
    const n=mesh?null:Math.max(2,Math.ceil(AsReq/area(db)));
    const spacing=mesh?Math.min(250,Math.floor(1000*area(db)/AsReq/25)*25):null;
    const AsProv=mesh?(spacing>0?1000*area(db)/spacing:0):n*area(db);
    const a=AsProv*fy/(.85*fc*bb),c=a/beta1(fc),et=c>0?.003*(dd-c)/c:0;
    const clear=mesh?spacing-db:(b*1000-2*cover*1000-n*db)/(n-1);
    const capacity=d>0&&et>=.005?.9*AsProv*fy*(dd-a/2)/1e6:0;
    const ok=d>0&&AsProv>=AsReq&&clear>=Math.max(25,db)&&(!mesh||spacing>=75)&&capacity>=M;
    last={db,d,AsReq,AsProv,spacing,n,clear,a:a/1000,c:c/1000,et,phi:.9,capacity,dc:capacity>0?M/capacity:null,ok,
      label:mesh?'DB'+db+'@'+spacing:n+'-DB'+db};
    if(ok)return last;
  }return last;
}

/** Constant-P elastic cantilever, signed end moment and shear. The exact
 * solution avoids cancelling opposing first-order actions before amplification.
 * EI includes cracking and a sustained-load stiffness reduction. */
export function duckColumnActions(i,P,H,Mtop,node={}){
  const b=i.colDepth,h=i.t,cover=i.cov/1000,Ec=4700*Math.sqrt(i.fc)*1000;
  const EI=.2*Ec*b*h**3/12,EIweak=.2*Ec*Math.min(b*h**3,h*b**3)/12;
  const Pcr=PI*PI*EIweak/(2*i.hp)**2,k=Math.sqrt(Math.max(P,0)/EI);
  const J=node.moment||0,a=node.level||0;
  const angle=k*i.hp,stable=P<Pcr;
  const magnifier=stable?1/Math.cos(angle):null;
  const baseM=!stable?null:k<1e-8?Mtop+H*i.hp+J:
    (Mtop+H*Math.sin(angle)/k+J*Math.cos(k*(i.hp-a)))/Math.cos(angle);
  const at=(z,side=1)=>k<1e-8?Mtop+H*(i.hp-z)+(z<a||z===a&&side<0?J:0):
    baseM*Math.cos(k*z)-H*Math.sin(k*z)/k-(z>a||z===a&&side>0?J*Math.cos(k*(z-a)):0);
  const stations=Array.from({length:41},(_,j)=>({z:i.hp*j/40,side:1}));
  if(J)stations.push({z:a,side:-1},{z:a,side:1});
  if(stable&&k>1e-8)for(const [lo,hi,C,D] of [[0,J?a:i.hp,baseM,-H/k],
    ...(J?[[a,i.hp,baseM-J*Math.cos(k*a),-H/k-J*Math.sin(k*a)]]:[])]){
    for(let n=-1;n<=1;n++){const z=(Math.atan2(D,C)+n*PI)/k;if(z>lo&&z<hi)stations.push({z,side:1});}
  }
  const grid=stations.sort((u,v)=>u.z-v.z||u.side-v.side)
    .filter((s,j,all)=>!j||s.z!==all[j-1].z||s.side!==all[j-1].side)
    .map(({z,side})=>({z,v:H,m:stable?at(z,side):null,p:P,side}));
  const firstOrderM=Math.max(Math.abs(Mtop),Math.abs(Mtop+H*i.hp+J),
    Math.abs(Mtop+H*(i.hp-a)),Math.abs(Mtop+H*(i.hp-a)+J));
  const maxM=stable?Math.max(firstOrderM,...grid.map(p=>Math.abs(p.m))):Infinity;
  return {P,H,Mtop,baseM,firstOrderM,M:maxM,EI,Pcr,magnifier,stable,grid,nodeMoment:J,nodeLevel:a};
}

function designColumn(i,actions){
  let result;
  const b=i.colDepth,h=i.t,cover=i.cov/1000;
  for(const db of sizes)for(const n of [4,6,8,10,12,14,16]){
    const curve=duckColumnCurve({b,h,fc:i.fc,fy:i.fy,cover,db,n});
    const rho=curve.As/(b*h*1e6),clear=(b*1000-2*(cover*1000+10)-(n/2)*db)/(n/2-1);
    const fit=clear>=Math.max(40,1.5*db)&&rho>=.01&&rho<=.04
      &&h>2*(cover+.01+db/1000);
    const cases=actions.map(a=>{const minimumM=a.P*(.015+.03*h),M=Math.max(a.M,minimumM),cap=curve.capacityAt(a.P);
      const dc=Math.max(a.P/curve.Pmax,cap>0?M/cap:Infinity);
      return {...a,M,minimumM,capacityM:cap,capacityP:curve.Pmax,dc,db,n,As:curve.As,
        ok:fit&&a.stable&&a.magnifier<=1.4&&dc<=1};});
    const worst=cases.reduce((a,b)=>b.dc>a.dc?b:a),dc=worst.dc;
    const candidate={...worst,cases,db,n,label:n+'-DB'+db,As:curve.As,
      dc,fit,rho,clear,ok:cases.every(c=>c.ok)};
    if(!result||candidate.ok||fit&&!result.fit||fit===result.fit&&dc<result.dc)result=candidate;
    if(candidate.ok)return result;
  }return result;
}

export function calculateDuckfoot(i){
  i=normalizeDuckLoadInput(i);
  const checks=[],gc=i.gc,B=i.B,L=i.capL,g=duckfootGeometry(i);
  const wCol=i.t*i.colDepth*i.hp*gc,wCap=B*L*i.hz*gc,xCol=i.t/2,xBeam=i.beamB/2;
  const beam=duckBeam(i),columnM=i.Mpost+i.Hpost*i.hp,topColumnP=i.Npost+wCol;
  const beamDead=duckBeam({...i,qBeam:i.qBeamD}),beamLive=duckBeam({...i,gc:0,qBeam:i.qBeamL});
  const pads=beam.reactions.map((R,index)=>{
    const columnP=topColumnP+R,beamMoment=beam.reactionFirstMoments[index],beamCouple=beamMoment-R*xCol;
    const serviceColumn=duckColumnActions(i,columnP,i.Hpost,i.Mpost,{moment:beamCouple,level:g.beamAxis});
    const columnPD=i.NpostD+wCol+beamDead.reactions[index],columnPL=i.NpostL+beamLive.reactions[index];
    const beamCoupleD=beamDead.reactionFirstMoments[index]-beamDead.reactions[index]*xCol;
    const beamCoupleL=beamLive.reactionFirstMoments[index]-beamLive.reactions[index]*xCol;
    return {index,beamReaction:R,beamMoment,beamCouple,columnP,columnPD,columnPL,beamCoupleD,beamCoupleL,serviceColumn,
      ...duckContact(columnP+wCap,serviceColumn.stable?columnP*xCol+wCap*B/2+serviceColumn.baseM:NaN,B,L)};
  });
  const governing=pads.reduce((a,b)=>(b.qMax??Infinity)>(a.qMax??Infinity)?b:a);
  for(const p of pads){
    checks.push({key:'ฐาน '+(p.index+1)+' · สมดุลแรงกด',value:'xR '+num(p.xResultant,3)+' ม.',criterion:'0 < xR < '+num(B)+' ม.',ok:p.inside,dc:null,fix:'ปรับ B/ขนาดเสา/โหลด เพื่อให้แรงลัพธ์อยู่ภายในฐานจริง'});
    checks.push(check('ฐาน '+(p.index+1)+' · กำลังแบกทาน',p.qMax??Infinity,i.qa,'kPa','เพิ่มพื้นที่ฐานหรือความหนาฐาน แล้วคำนวณสมดุลใหม่'));
    checks.push(check('ฐาน '+(p.index+1)+' · เลื่อนไถล',1.5*Math.abs(i.Hpost),i.mu*p.totalV,'kN','เพิ่มน้ำหนัก/ขนาดฐาน; ไม่เพิ่มค่าความฝืดโดยไม่มีข้อมูลดิน'));
  }
  const cases=[{name:'แรงอัดสูง',gN:i.factorN,gL:i.factorL},{name:'แรงอัดต่ำ',gN:.9,gL:0}];
  const column=designColumn(i,cases.flatMap(c=>pads.map(p=>({...c,index:p.index,
    name:c.name+' · เสา '+(p.index+1),combination:c.name,
    ...duckColumnActions(i,c.gN*p.columnPD+c.gL*p.columnPL,i.factorH*i.Hpost,i.factorH*i.Mpost,
      {moment:c.gN*p.beamCoupleD+c.gL*p.beamCoupleL,level:g.beamAxis})}))));
  for(const c of column.cases){
    checks.push(check('เสา · P–M · '+c.name,c.M,c.capacityM,'kN·m','เพิ่มหน้าตัดเสา; ระบบเลือกเหล็กจาก P–M ใหม่'));
    checks.push(check('เสา · แรงอัด · '+c.name,c.P,c.capacityP,'kN','เพิ่มหน้าตัดเสาหรือกำลังวัสดุที่มีจริง'));
    checks.push(check('เสา · เสถียรภาพ · '+c.name,c.P,c.Pcr,'kN','เพิ่มหน้าตัดเสาหรือลดความสูงไม่มีค้ำยัน'));
    checks.push(check('เสา · ขีดจำกัด second order · '+c.name,c.magnifier??Infinity,1.4,'เท่า','เพิ่มหน้าตัดเสาให้ผลขยายไม่เกิน 1.40 เท่า'));
  }
  checks.push({key:'เสา · จัดเหล็ก',value:column.label+' · ρ '+num(column.rho*100)+'%',criterion:'ρ 1–4%; ช่องว่าง ≥ max(40 mm, 1.5db)',ok:column.fit,dc:null,fix:'เพิ่มหน้าตัดเสาให้จัดเหล็กและคอนกรีตหุ้มได้'});
  const tieSpacing=Math.max(50,Math.floor(Math.min(16*column.db,48*10,i.t*1000,i.colDepth*1000)/25)*25);
  column.tie={db:10,spacing:tieSpacing,label:'RB10@'+tieSpacing};
  const hookDevelopment=Math.max(.24*i.fy/Math.sqrt(i.fc)*column.db,8*column.db,150)/1000;
  column.anchor={required:hookDevelopment,available:i.hz-.075,hook:12*column.db/1000};
  const dCol=i.t-i.cov/1000-.01-column.db/2000;
  checks.push(check('เสา · แรงเฉือน',i.factorH*Math.abs(i.Hpost),.75*.17*Math.sqrt(i.fc)*i.colDepth*Math.max(dCol,0)*1000,'kN','เพิ่มหน้าตัดเสา; ไม่คิดกำลังปลอกเพิ่มในรายการนี้'));
  const factoredBeam=duckBeam({...i,gc:i.factorN*i.gc,qBeam:i.factorN*i.qBeamD+i.factorL*i.qBeamL});
  const beamM=i.qBeamL===0?i.factorN*beam.moment:factoredBeam.moment;
  const beamV=i.qBeamL===0?i.factorN*beam.shear:factoredBeam.shear;
  const beamBar=flexural(beamM,i.beamB,i.beamH,i.cov/1000+.01,i.fc,i.fy);
  const vc=.75*.17*Math.sqrt(i.fc)*i.beamB*Math.max(beamBar.d,0)*1000;
  const linkDb=10,Av=2*area(linkDb),fyLink=235;
  const maxS=Math.min(beamBar.d/2,.6),requiredS=beamV>vc?.75*Av*fyLink*beamBar.d/(1000*(beamV-vc)):maxS;
  const linkS=Math.floor(Math.min(maxS,requiredS)*1000/25)*25;
  const beamCapacity=linkS>0?vc+.75*Av*fyLink*beamBar.d/linkS:0;
  const vMax=.75*.83*Math.sqrt(i.fc)*i.beamB*Math.max(beamBar.d,0)*1000;
  const beamDesign={...beamBar,M:beamM,V:beamV,vc,capacityV:Math.min(beamCapacity,vMax),linkDb,linkS,
    label:beamBar.label+' บน+ล่าง · RB10@'+linkS};
  checks.push(check('คานตีนเสา · ดัด',beamM,beamBar.capacity,'kN·m','เพิ่มความลึก/ความกว้างคาน'));
  checks.push(check('คานตีนเสา · เฉือน',beamV,beamDesign.capacityV,'kN','เพิ่มหน้าตัดคาน'));
  checks.push({key:'คานตีนเสา · จัดเหล็ก',value:beamDesign.label,criterion:'เหล็กอยู่ในหน้าตัด; ปลอก ≥50 mm',ok:beamBar.ok&&linkS>=50,dc:null,fix:'เพิ่มหน้าตัดคานให้จัดเหล็กได้'});
  beamDesign.deflection=5*(beam.w+beam.qBeam)*i.postSpacing**4/(384*(.175*4700*Math.sqrt(i.fc)*1000*i.beamB*i.beamH**3/12))*1000;
  checks.push(check('คานตีนเสา · การโก่งใช้งาน',beamDesign.deflection,i.postSpacing*1000/360,'มม.','เพิ่มความลึกคาน'));
  const footingCases=[];
  for(const c of cases)for(const p of pads){
    const columnAction=column.cases.find(v=>v.combination===c.name&&v.index===p.index);
    const factoredP=c.gN*p.columnPD+c.gL*p.columnPL;
    const V=factoredP+c.gN*wCap,M=columnAction.stable?
      factoredP*xCol+c.gN*wCap*B/2+columnAction.baseM:NaN;
    const contact=duckContact(V,M,B,L);
    if(!contact.inside){checks.push({key:'ฐาน '+(p.index+1)+' · '+c.name,value:'แรงลัพธ์อยู่นอกฐาน',criterion:'มีสมดุลแรงกด',ok:false,dc:null,fix:'ปรับรูปทรงและโหลดก่อนออกแบบเหล็กฐาน'});continue;}
    const a=toeStripActions({B,toe:B-i.t,V:V/L,xbar:B-contact.xResultant,dead:c.gN*gc*i.hz});
    const My=Math.max(contact.qMax-c.gN*gc*i.hz,0)*((L-i.colDepth)/2)**2/2;
    footingCases.push({name:c.name,index:p.index,contact,actions:a,gN:c.gN,gL:c.gL,Mx:Math.max(a.bottomMoment,a.topMoment),My,
      columnP:factoredP,columnM:columnAction.baseM});
  }
  let footing=null;
  if(footingCases.length){
    const Mx=Math.max(...footingCases.map(c=>c.Mx)),My=Math.max(...footingCases.map(c=>c.My));
    const barX=flexural(Mx,1,i.hz,.075,i.fc,i.fy,{mesh:true});
    const barY=flexural(My,1,i.hz,.075,i.fc,i.fy,{mesh:true,under:barX.db/1000});
    const vcX=.75*.17*Math.sqrt(i.fc)*Math.max(barX.d,0)*1000,vcY=.75*.17*Math.sqrt(i.fc)*Math.max(barY.d,0)*1000;
    const vx=Math.max(...footingCases.map(c=>Math.abs(c.actions.at(Math.max(B-i.t-barX.d,0)).V)));
    const vy=Math.max(...footingCases.map(c=>Math.max(c.contact.qMax-c.gN*gc*i.hz,0)*Math.max((L-i.colDepth)/2-barY.d,0)));
    const d=Math.min(barX.d,barY.d),a=i.t+d/2,b=i.colDepth+d,b0=2*a+b;
    // Three-sided edge perimeter. Integrate net soil pressure INSIDE the cut
    // before shifting the signed force/moment to the perimeter centroid.
    // Transfer all residual moment by shear (gamma_v=1, conservative).
    const xbar=(a*a+a*b)/b0,J=d*(2*a**3/3+b*a*a-b0*xbar*xbar),Avp=b0*d;
    const perimeterFits=a<B&&b<L&&d>0;
    const stressCap=perimeterFits?.75*Math.min(.17*(1+2/Math.max(i.t/i.colDepth,i.colDepth/i.t)),.083*(2+30*d/b0),.33)*Math.sqrt(i.fc):0;
    const punches=footingCases.map(c=>{
      const soil=toeStripActions({B,toe:Math.min(a,B),V:c.contact.totalV/L,xbar:c.contact.xResultant,dead:c.gN*gc*i.hz}).at(Math.min(a,B));
      const soilV=soil.V*b,soilMoment=(a*soil.V-soil.M)*b;
      const V=c.columnP-soilV,
      M=Math.abs(c.columnM+c.columnP*(xCol-xbar)-(soilMoment-soilV*xbar));
      return {...c,V,M,stress:Avp>0&&J>0?Math.abs(V)/(Avp*1000)+M*Math.max(xbar,a-xbar)/(J*1000):Infinity};});
    const punch=punches.reduce((a,b)=>b.stress>a.stress?b:a);
    footing={Mx,My,barX,barY,Vx:vx,Vy:vy,vcX,vcY,punch:{V:punch.V,M:punch.M,d,b0,a,b,xbar,J,stress:punch.stress,capacity:stressCap},
      diagram:footingCases.reduce((a,b)=>b.Mx>a.Mx?b:a).actions.grid,perimeterFits,
      cases:footingCases.map(c=>({name:c.name,index:c.index,contact:c.contact,Mx:c.Mx,My:c.My,
        gN:c.gN,gL:c.gL,columnP:c.columnP,columnM:c.columnM}))};
    checks.push(check('ฐาน · ดัดตั้งฉากเขต',Mx,barX.capacity,'kN·m/ม.','เพิ่มความหนาฐาน'));
    checks.push(check('ฐาน · ดัดขนานเขต',My,barY.capacity,'kN·m/ม.','เพิ่มความหนาฐาน'));
    checks.push(check('ฐาน · เฉือนตั้งฉากเขต',vx,vcX,'kN/ม.','เพิ่มความหนาฐาน'));
    checks.push(check('ฐาน · เฉือนขนานเขต',vy,vcY,'kN/ม.','เพิ่มความหนาฐาน'));
    checks.push(check('ฐาน · เจาะทะลุขอบรวมโมเมนต์',punch.stress,stressCap,'MPa','เพิ่มความหนาฐานหรือขนาดเสา'));
    checks.push({key:'ฐาน · จัดเหล็ก',value:barX.label+' / '+barY.label,criterion:'สองทิศบน+ล่าง; cover 75 mm',
      ok:barX.ok&&barY.ok&&i.hz>=.15+2*(barX.db+barY.db)/1000+.025,dc:null,fix:'เพิ่มความหนาฐานให้มีระยะหุ้มและช่องว่างระหว่างชั้น'});
  }
  const anchorReserve=.075+(footing?(footing.barX.db+footing.barY.db)/1000:0)+.025;
  column.anchor.available=i.hz-anchorReserve;
  column.anchor.reserve=anchorReserve;
  checks.push(check('เสา · ฝังยึดของอ 90°',hookDevelopment,column.anchor.available,'ม.',
    'เพิ่มความหนาฐานให้ไม่น้อยกว่า '+num(hookDevelopment+anchorReserve,3)+' ม. รวมชั้นเหล็กฐานและช่องว่าง'));
  checks.push(check('เสา · ปลายของอในฐาน',column.anchor.hook,Math.max(B-i.t-.075,0),'ม.','เพิ่มระยะฐานยื่นเข้าที่ดิน'));
  const equilibrium={...governing,xCol,xBeam,gap:i.postSpacing-i.colDepth,wCol,wCap,wBeam:governing.beamReaction,
    columnP:governing.columnP,topColumnP,columnM,baseM:governing.serviceColumn.baseM,mLateral:i.Hpost*i.hp,
    columnArea:i.t*i.colDepth,columnStress:governing.columnP/(i.t*i.colDepth)/1000,
    note:beam.note,columnDiagram:governing.serviceColumn.grid};
  const bbs=[{mark:'C1',position:'เหล็กยืนเสา',size:column.label,detail:column.tie.label,length:null,count:i.nPosts},
    {mark:'GB1',position:'คานเชื่อมเสาเหนือ footing',size:beamBar.label,detail:'บน+ล่าง · RB10@'+linkS,length:null,count:i.nPosts-1},
    ...(footing?[{mark:'F1',position:'ฐานทิศตั้งฉากเขต',size:footing.barX.label,detail:'บน+ล่าง · cover 75 mm',length:null,count:i.nPosts},
      {mark:'F2',position:'ฐานทิศขนานเขต',size:footing.barY.label,detail:'บน+ล่าง · cover 75 mm',length:null,count:i.nPosts}]:[])];
  return {checks,beam,beamDead,beamLive,factoredBeam,beamDesign,column,footing,pads,equilibrium,bbs,geometry:g,
    status:checks.every(c=>c.ok)?'PASS':'FAIL',designBasis:'ACI 318-14 RC sections; explicit project load factors',
    assumptions:['N/H/M เป็นแรงใช้งานที่ยอดเสาเท่ากันทุกต้น; น้ำหนักเสา/ฐาน/คานคำนวณเพิ่ม',
      'เสาเป็นคานยื่นสูง hp จากผิวบนฐาน ไม่มีค้ำในระนาบตั้งฉากเขต; EI=0.2EcIg; ใช้ P ที่โคนรวมแรงคานคงที่ตลอดเสา; ตรวจโก่งเดาะทั้งสองแกนและ secant ≤1.40',
      'คานอยู่เหนือ footing ตาม beamClear; หักปริมาตรซ้อนเสาจากน้ำหนักคาน; แรงคานและโมเมนต์เยื้องศูนย์เข้าที่แกนคานผ่านเสาลงฐานรายต้น',
      'ฐานรับแรงแยกแต่ละต้น ดินไม่รับแรงดึง; คานไม่ถ่ายโมเมนต์ข้ามไปแก้เยื้องศูนย์ฐาน',
      'ฐานรับโมเมนต์ second order ของเสา; เจาะทะลุขอบหักแรงดันดินภายในเส้นวิกฤต และให้แรงเฉือนรับโมเมนต์สุทธิเต็ม; ไม่รวมการทรุดต่างระดับ']};
}

/** Bounded geometry trials, preserving loads, material strength and soil data. */
export function recommendDuckfoot(input,baseline,maxTrials=96){
  if(baseline.status==='PASS')return {trials:0,changes:[],verified:true};
  const score=r=>r.checks.reduce((sum,c)=>sum+(c.ok?0:1000+Math.min(Number.isFinite(c.dc)?c.dc:100,100)),0);
  let current={...input},result=baseline,trials=0;
  const visited=new Set([JSON.stringify(current)]);
  while(trials<maxTrials){
    const round=v=>Math.round(v*100)/100;
    const candidates=[
      {...current,t:round(current.t+.05),colDepth:round(current.colDepth+.05)},
      {...current,hz:round(current.hz+.05)},
      {...current,capL:round(current.capL+.1)},
      {...current,B:round(current.B+.1)},
      {...current,B:round(current.B-.1)},
      {...current,beamB:round(current.beamB+.05),beamH:round(current.beamH+.05)},
    ].filter(c=>c.t<=1.5&&c.colDepth<=2&&c.hz<=1.5&&c.capL<=Math.min(c.postSpacing,6)
      &&c.B>=.6&&c.B<=6&&c.t<c.B&&c.colDepth<=c.capL&&duckfootGeometry(c).beamTop<=c.hp&&c.beamB<=c.B&&c.beamB<=1.5&&c.beamH<=1.5);
    let best=null;
    for(const candidate of candidates){
      if(trials>=maxTrials)break;
      const key=JSON.stringify(candidate);if(visited.has(key))continue;visited.add(key);trials++;
      const next=calculateDuckfoot(candidate);
      if(next.status==='PASS'){current=candidate;result=next;best={candidate,next};break;}
      if(score(next)<score(result)&&(!best||score(next)<score(best.next)))best={candidate,next};
    }
    if(!best)break;
    current=best.candidate;result=best.next;
    if(result.status==='PASS')break;
  }
  // A combination of changes can be necessary even when no single small step
  // improves the score. Try bounded joint changes, then reduce excess dimensions.
  if(result.status!=='PASS')for(const factor of [1.25,1.5,1.75,2,2.5,3]){
    if(trials>=maxTrials)break;
    const up=(v,max)=>Math.min(max,Math.ceil(v*factor*20-1e-9)/20);
    const candidate={...input,t:up(input.t,Math.min(1.5,input.B-.1)),colDepth:up(input.colDepth,2),
      hz:up(input.hz,1.5),capL:up(input.capL,Math.min(input.postSpacing,6))};
    if(candidate.colDepth>candidate.capL)continue;
    const next=calculateDuckfoot(candidate);trials++;
    if(next.status==='PASS'){current=candidate;result=next;break;}
  }
  if(result.status==='PASS')for(const [keys,step] of [[['t','colDepth'],.05],[['hz'],.05],[['capL'],.1]]){
    while(trials<maxTrials){
      const candidate={...current};
      for(const k of keys)candidate[k]=Math.round((current[k]-step)*100)/100;
      if(keys.some(k=>candidate[k]<input[k])||candidate.capL<candidate.colDepth)break;
      const next=calculateDuckfoot(candidate);trials++;
      if(next.status!=='PASS')break;
      current=candidate;result=next;
    }
  }
  return {trials,verified:result.status==='PASS',
    changes:result.status==='PASS'?['t','colDepth','B','capL','hz','beamB','beamH'].filter(k=>input[k]!==current[k]).map(k=>({key:k,from:input[k],to:current[k]})):[],
    input:result.status==='PASS'?current:null,
    reason:result.status==='PASS'?'ขนาดชุดนี้ผ่านการคำนวณซ้ำครบทุกเกณฑ์ด้วยโหลด วัสดุ และดินเดิม':'ยังไม่พบขนาดผ่านครบภายในช่วงที่ทดลอง; ต้องปรับขนาดหรือแบบจำลองแล้วคำนวณใหม่'};
}
