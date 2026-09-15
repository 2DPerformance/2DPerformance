/* SC01 R47, AISC DG1 (2024) §§4.3.2/4.3.7/4.3.8 and Appendix B.4.
 * Scoped static uniaxial HSS end plate, flush to concrete, symmetric anchor
 * lines outside two opposing HSS faces. Equal rods on each line. No arbitrary
 * strip-width floor, contact-spring depth, plate stiffness tolerance or prying
 * reduction. Cantilever plate bending uses elastic yield (t²/6), conservatively
 * below DG1's plastic bending strength (t²/4). R47 dispatches outside-HSS
 * layouts to the STI corner/straight-plane checks; legacy R44 results remain
 * unchanged. See both specifications and independent benchmarks. */
(function(root){
  'use strict';
  const VERSION='r47',E=200000,sum=(a,f=x=>x)=>a.reduce((v,x)=>v+f(x),0),finite=Number.isFinite;
  const state=r=>!finite(r)?'incomplete':r>1+1e-9?'fail':r>.8?'warn':'ok';
  const unique=a=>[...new Set(a)].sort((x,y)=>x-y),close=(a,b)=>Math.abs(a-b)<1e-7;
  function coordinates(s){const {rows,cols,plateEdgeX:ex,plateEdgeY:ey}=s.anchors,{width:W,height:H}=s.plate,out=[];
    for(let i=0;i<rows;i++)for(let j=0;j<cols;j++)out.push({id:'A'+(i*cols+j+1),row:i+1,col:j+1,x:cols===1?0:-W/2+ex+j*(W-2*ex)/(cols-1),y:rows===1?0:-H/2+ey+i*(H-2*ey)/(rows-1)});return out;}
  function layout(s,action){
    const anchors=coordinates(s),xs=unique(anchors.map(a=>a.x)),ys=unique(anchors.map(a=>a.y));
    const outside=s.r47AnchorLayout==='outside-hss';
    const rotate=!outside&&ys.length===1&&xs.length===2&&Math.abs(action.Mx)<1e-9;
    const a=anchors.map(q=>({...q,u:rotate?q.y:q.x,v:rotate?-q.x:q.y})),us=unique(a.map(q=>q.u)),vs=unique(a.map(q=>q.v));
    const W=rotate?s.plate.height:s.plate.width,H=rotate?s.plate.width:s.plate.height,B=rotate?s.member.H:s.member.B,D=rotate?s.member.B:s.member.H;
    const t=s.member.tNom*s.member.designThicknessFactor,flat=B-2*t,issues=[];
    if(s.plate.standOffMM!==0)issues.push('เพลทต้องแนบคอนกรีต ไม่มีช่องว่างหรือระยะยก');
    if(Math.abs(action.My)>1e-9||Math.abs(action.Tz)>1e-9||Math.abs(action.Vx)>1e-9)issues.push('วิธี DG1 ชุดนี้ใช้ N, Vy และ Mx ในระนาบคาน');
    if(vs.length!==2||!close(vs[0],-vs[1])||us.some(u=>!us.some(v=>close(u,-v))))issues.push('จัดพุกเป็นแนวสมมาตรตามรูปแบบที่รองรับ');
    if(vs.length===2&&Math.abs(vs[1])<=D/2+s.weld.size)issues.push('แนวพุกต้องอยู่นอกผิวเหล็กและแนวเชื่อม');
    if(outside){
      if(us.length!==2||us.some(u=>Math.abs(u)<=B/2+s.weld.size)||vs.length!==2)issues.push('จัดพุก 4 มุมของเพลท ให้พ้นหน้าตัดเหล็กทั้งสองแกน');
      if(s.weld.pattern!=='all')issues.push('พุกนอกหน้าตัดต้องเชื่อมรอบ HSS รวมบริเวณมุม');
    }else if(us.some(u=>Math.abs(u)>=flat/2))issues.push('แนวพุกต้องถ่ายแรงเข้าด้านตรงของ HSS: ใช้แนวกลางหนึ่งตัวต่อด้าน หรือจัดระยะแนวพุกให้อยู่ในความกว้างหน้าตัด');
    if(rotate&&s.weld.pattern==='horizontal'||!rotate&&s.weld.pattern==='vertical')issues.push('เพิ่มแนวเชื่อมที่ด้านรับแรงจากแนวพุก หรือเลือกเชื่อมรอบหน้าตัด');
    return {anchors,a,us,vs,W,H,B,D,t,flat,rotate,issues,outside,corner:outside};
  }
  function normalAnalysis(s,p,action){
    const g=layout(s,action),fail=message=>({ok:false,issues:[...g.issues,message].filter(Boolean),layout:g});
    if(g.issues.length)return fail('');
    const {W,H,rotate,a}=g,f=g.vs[1],M=Math.abs(action.Mx)*1e6,N=action.N*1000,sign=action.Mx<0?-1:1;
    const fpCap=p.phiBearing*.85*s.concrete.fc,qmax=fpCap*W;let Y=0,fp=0,Tpos=0,Tneg=0,C=0,mode;
    if(N>=0&&M<=N*f){Tpos=(N+M/f)/2;Tneg=(N-M/f)/2;mode='tension';}
    else if(N<0&&M/(-N)<=H/2-(-N)/(2*qmax)){
      Y=H-2*M/(-N);fp=(-N)/(W*Y);C=-N;mode='compression';
    }else{
      const lever=f+H/2,S=M-N*f,discriminant=lever**2-2*S/qmax;
      if(discriminant<0)return fail('พื้นที่เพลทหรือคอนกรีตรับแรงกดไม่พอสำหรับสมดุลแรง: เพิ่มขนาดเพลทหรือแก้จุดต่อ');
      Y=2*S/qmax/(lever+Math.sqrt(discriminant));C=qmax*Y;Tpos=N+C;fp=fpCap;mode='moment';
      if(Y>H+1e-7||Tpos<-1e-7)return fail('ช่วงแรงกดอยู่นอกเพลท: ต้องปรับขนาดหรือรายละเอียดจุดต่อ');
    }
    const forces=a.map(q=>{const T=(q.v*sign>0?Tpos:Tneg)/g.us.length/1000,Vx=action.Vx/a.length,Vy=action.Vy/a.length;return {...q,T:Math.max(0,T),Vx,Vy,V:Math.hypot(Vx,Vy),delta:Math.max(0,T)*1000*(s.anchors.hef+s.plate.thickness)/(E*s.anchors.Ase)};});
    const contact=[];
    if(Y>0&&C>0)for(let iy=0;iy<8;iy++)for(let ix=0;ix<12;ix++){
      const u=-W/2+(ix+.5)*W/12,v=sign*(-H/2+(iy+.5)*Y/8),x=rotate?-v:u,y=rotate?u:v,dx=rotate?Y/8:W/12,dy=rotate?W/12:Y/8;
      contact.push({x,y,dx,dy,area:dx*dy,C:fp*dx*dy/1000,pressure:fp});
    }
    const eqN=sum(forces,q=>q.T)-sum(contact,q=>q.C),eqMx=(sum(forces,q=>q.T*q.y)-sum(contact,q=>q.C*q.y))/1000,eqMy=(-sum(forces,q=>q.T*q.x)+sum(contact,q=>q.C*q.x))/1000;
    const residuals={N:eqN-action.N,Mx:eqMx-action.Mx,My:eqMy-action.My};
    const residualRatio=Math.max(Math.abs(residuals.N)/Math.max(1,Math.abs(action.N)),Math.abs(residuals.Mx)/Math.max(1,Math.abs(action.Mx)),Math.abs(residuals.My)/Math.max(1,Math.abs(action.My)));
    return {ok:true,layout:g,mode,Y,fp,fpCap,C:C/1000,sign,f,group:{forces,sx:g.rotate?2*f:(g.us.length>1?g.us[1]-g.us[0]:0),sy:g.rotate?0:2*f,maxT:Math.max(...forces.map(q=>q.T)),maxV:Math.max(...forces.map(q=>q.V)),sumT:sum(forces,q=>q.T),Vres:Math.hypot(action.Vx,action.Vy)},
      normal:{anchors:forces,contact,converged:true,iterations:0,sumT:sum(forces,q=>q.T),sumC:C/1000,maxPressure:fp,contactArea:W*Y,equilibrium:{N:eqN,Mx:eqMx,My:eqMy},residuals,residualRatio,
        methodSource:'AISC DG1 2024 §§4.3.7–4.3.8; rectangular bearing block',bearingMode:mode,bearingLength:Y},
      solver:{ratio:residualRatio,state:residualRatio<=1e-8?'ok':'outside',methodReview:false,note:`DG1 สมดุล N/M; residual ${residualRatio.toExponential(2)}`}};
  }
  function plateCheck(s,p,n){
    const {layout:g,Y,fp,fpCap}=n,{W,H,D,B,t}=g,th=s.plate.thickness,fy=s.plate.Fy,fu=s.plate.Fu,hole=s.plate.holeDiameterMM,d=s.anchors.diameter;
    const outside=g.outside?root.NCYSC01CornerAnchors.tension(s,n):null;
    let tensionMoment=outside?.tensionMoment??0;const strips=outside?.strips??[];
    if(!outside)for(const a of n.group.forces){
      const lever=Math.abs(a.v)-(D/2-t/2),i=g.us.indexOf(a.u),left=i===0?-g.flat/2:(a.u+g.us[i-1])/2,right=i===g.us.length-1?g.flat/2:(a.u+g.us[i+1])/2;
      const be=Math.max(0,Math.min(right,a.u+lever)-Math.max(left,a.u-lever)),moment=be>0?a.T*1000*lever/be:Infinity;
      strips.push({id:a.id,lever,be,T:a.T,moment});tensionMoment=Math.max(tensionMoment,moment);
    }
    const m=(H-D+t)/2,lateral=(W-B+t)/2;
    const bearingMoment=Y>=m?fp*m*m/2:fp*Y*(m-Y/2),lateralMoment=Y>0?fp*lateral*lateral/2:0;
    // No favorable two-way width enhancement (DG1 B.4); elastic moments from
    // perpendicular directions are added at the bearing-side corner.
    const compressionMoment=bearingMoment+lateralMoment,capacity=p.phiPlateY*fy*th*th/6;
    const tensionRatio=tensionMoment/capacity,compressionRatio=compressionMoment/capacity,contactRatio=fp/fpCap;
    // Conservative plate punching perimeter at the hole, smaller than the
    // bearing perimeter of a compatible ESR nut/washer. No assumed washer
    // diameter is used to increase strength (AISC J4.2 shear limit states).
    const punchCap=Math.min(p.phiPlateR*.6*fu,p.phiPlateY*.6*fy)*Math.PI*hole*th/1000;
    const punchRatio=Math.max(...n.group.forces.map(a=>punchCap>0?a.T/punchCap:Infinity));
    let holeRatio=0,blockRatio=0,minLc=Infinity;
    for(const a of n.group.forces)for(const [axis,component]of [['x',a.Vx],['y',a.Vy]]){
      if(component===0)continue;
      const span=axis==='x'?s.plate.width:s.plate.height,sign=Math.sign(component),other=axis==='x'?'y':'x';
      let lc=span/2-sign*a[axis]-hole/2;
      for(const q of n.group.forces)if(q!==a&&close(q[other],a[other])&&sign*(q[axis]-a[axis])>0)lc=Math.min(lc,sign*(q[axis]-a[axis])-hole);
      minLc=Math.min(minLc,lc);
      const cap=p.phiPlateR*Math.min(1.2*Math.max(0,lc)*th*fu,2.4*d*th*fu)/1000;
      holeRatio=Math.max(holeRatio,cap>0?Math.abs(component)/cap:Infinity);
      // AISC J4.3: two shear tear-out planes toward the free edge, with no
      // transverse tension-plane contribution. This lower bound also bounds
      // block shear; plate net section shear is checked independently below.
      const shearArea=2*Math.max(0,lc)*th,tearCap=Math.min(p.phiPlateR*.6*fu*shearArea,p.phiPlateY*.6*fy*shearArea)/1000;
      blockRatio=Math.max(blockRatio,tearCap>0?Math.abs(component)/tearCap:Infinity);
    }
    const widthNet=Math.min(s.plate.width-s.anchors.cols*hole,s.plate.height-s.anchors.rows*hole),area=Math.max(0,widthNet)*th;
    const shearCap=Math.min(p.phiPlateR*.6*fu*area,p.phiPlateY*.6*fy*area)/1000;
    const netRatio=shearCap>0?sum(n.group.forces,a=>a.V)/shearCap:Infinity;
    const bendingRatio=Math.max(tensionRatio,compressionRatio),combined=Math.hypot(bendingRatio,netRatio),ratio=Math.max(combined,contactRatio,holeRatio,blockRatio,punchRatio);
    return {ratio,state:state(ratio),methodReview:false,methodSource:'AISC DG1 §§4.3.2/4.3.7/4.3.8, B.4; AISC 360-22 J4/J3.10; elastic plate strips',
      outside:!!outside,cornerSource:outside?.source,strips,tensionMoment,bearingMoment,lateralMoment,tensionRatio,compressionRatio,stripRatio:bendingRatio,contactRatio,holeRatio,netRatio,blockRatio,punchRatio,punchCap,minLc,tReq:Math.sqrt(6*Math.max(tensionMoment,compressionMoment)/(p.phiPlateY*fy)),Y,fp,fpCap,
      assumption:outside?'DG1 / STI: พุกพ้นหน้าตัด ตรวจดัดแนวตรงและมุม 45° ตามผัง; เพลทแนบคอนกรีต เชื่อมรอบรวมมุม ใช้กำลังครากยืดหยุ่น':'DG1: เพลทแนบคอนกรีต พุกสมมาตรสองแนว ถ่ายเข้าด้านตรงของ HSS; ดัดแบบคานยื่น ใช้กำลังครากยืดหยุ่น ไม่มีผลเพิ่มกำลังจาก membrane หรือ two-way width',
      note:`DG1 ดัดด้านดึง ${tensionRatio.toFixed(3)} / ด้านแรงกด ${compressionRatio.toFixed(3)}; t_req ${Math.sqrt(6*Math.max(tensionMoment,compressionMoment)/(p.phiPlateY*fy)).toFixed(2)} mm; Y ${Y.toFixed(2)} mm; แรงกด ${fp.toFixed(3)}/${fpCap.toFixed(3)} MPa`};
  }
  function loadPathWeld(s,p,action,n){
    if(n.layout.outside)return root.NCYSC01CornerAnchors.weld(s,p,action,n);
    const g=n.layout,throat=.707*s.weld.size,spacing=g.D-g.t,faceForces=[Math.abs(action.N*1000/2+action.Mx*1e6/spacing),Math.abs(action.N*1000/2-action.Mx*1e6/spacing)];
    const run=Math.max(g.flat,g.D)/s.weld.size,beta=run<=100?1:run<=300?1.2-.002*run:180/run;
    const length=Math.min(g.flat,sum(n.layout.us,u=>{const q=n.group.forces.find(a=>a.u===u);return n.plate.strips.find(a=>a.id===q.id).be;}))*s.weld.effectiveLengthFactor*beta;
    const qn=Math.max(...faceForces)/length,qv=Math.abs(action.Vy)*1000/(2*length),stress=Math.hypot(qn,qv)/throat,cap=p.phiWeld*.6*s.weld.Fexx;
    const baseNormal=Math.min(p.phiPlateY*s.member.Fy,p.phiPlateR*s.member.Fu)*g.t,baseShear=Math.min(p.phiPlateY*.6*s.member.Fy,p.phiPlateR*.6*s.member.Fu)*g.t;
    const ratio=Math.max(stress/cap,qn/baseNormal+qv/baseShear);
    return {ratio,state:state(ratio),length,faceForces,stress,cap,baseNormal,baseShear,methodSource:'DG1 4.3.2 consistent HSS face load path; AISC 360-22 J2/J4',note:`แนวเชื่อมด้านรับแรง: Leff ${length.toFixed(1)} mm/ด้าน; แรงด้านหน้าตัด ${faceForces.map(f=>(f/1000).toFixed(3)).join(' / ')} kN; D/C ${ratio.toFixed(3)}`};
  }
  function calculate(s,p,action){const n=normalAnalysis(s,p,action);if(n.ok){n.plate=plateCheck(s,p,n);n.loadPathWeld=loadPathWeld(s,p,action,n);}return n;}
  root.NCYSC01PlateMethods=Object.freeze({VERSION,coordinates,layout,normalAnalysis,plateCheck,loadPathWeld,calculate});
})(typeof window==='undefined'?globalThis:window);
