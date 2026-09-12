/* SC01 R33. Scoped member analysis; never changes the native connection verdict.
 * Units: input kN/m/mm/MPa, beam-column kernel N/mm. See the R33 technical spec. */
(function(root){
  'use strict';
  const E=root.NCYEngine, M=root.NCYV5, P=root.NCYSC01Purlins, K=E.memberPrimitives;
  const VERSION='r37', SCHEMA='sc01.member-inputs.v4', MODULUS=200000, D=root.NCYSC01MemberLoads,Steel=root.NCYSC01SteelDesign;
  const clone=x=>JSON.parse(JSON.stringify(x));
  const stable=x=>Array.isArray(x)?'['+x.map(stable).join(',')+']':x&&typeof x==='object'?
    '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+stable(x[k])).join(',')+'}':JSON.stringify(x);
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  const maxBy=(xs,fn)=>xs.reduce((a,b)=>!a||fn(b)>fn(a)?b:a,null);
  const fresh=()=>({schema:SCHEMA,project:{name:'',number:'',designer:'',date:new Date().toISOString().slice(0,10)},
    support:{type:'concrete-wall',beamBMM:250,beamHMM:400,columnBMM:250,columnDMM:250,columnHeightM:3,hbeam:{webMM:16,flangeMM:16}},steel:{H:100,B:50,t:3.2,Fy:245,Fu:400,thicknessFactor:0.93},
    purlin:{H:50,B:25,t:2.3},web:{H:50,B:50,t:2.3},truss:{enabled:false,type:'warren',depthMM:650,tipDepthMM:150,panels:4},plate:{allowanceMM:50.8,thicknessMM:6,anchorMM:16},
    connection:{plateAuto:true,plateWidthMM:100.8,plateHeightMM:150.8,plateFy:245,plateFu:400,
      weldPattern:'all',weldSizeMM:3,weldFexx:490,weldLengthFactor:1,supportWeldSizeMM:6,
      node:{type:'slotted_gusset',thicknessMM:8,lengthMM:180,weldMM:3,Fy:245,Fu:400,bucklingK:.65,widthMM:0,eccentricityMM:0},
      anchorType:'adhesive',anchorRows:2,anchorCols:2,anchorEdgeXMM:20,anchorEdgeYMM:20,anchorHefMM:140,anchorAseMM2:157,anchorFuta:500,
      concreteFc:24,concreteThicknessMM:300,concreteCracked:true,edgeTopMM:220,edgeBottomMM:220,edgeLeftMM:220,edgeRightMM:220,
      product:{...clone(M.defaultState().product),name:'',report:'',NsaDesign:0,VsaDesign:0,tauCr:0,tauUncr:0,confirmed:false,conditionQualified:false}},
    design:{profile:'aisc360-22_aci318-19',forceUnit:'kN',stressUnit:'MPa',custom:Object.fromEntries(Object.entries(M.defaultState().customFactors).filter(([k])=>k.startsWith('phi')))},
    geometry:{widthM:6,projectionM:1.2,frameSpacingM:1.2,purlinSpacingM:0.8,purlinLayout:'end-pitch',deflectionLimit:180},
    loads:{deadKPa:0.35,liveKPa:0.5,windEnabled:false,windKPa:0},deadLoad:D.fresh(),
    cable:{enabled:false,heightM:1,diameterMM:6,EAkN:'',allowableKN:'',reference:''}});
  const shape=fresh();
  function validDTO(x,template=shape,path=''){
    if(template&&typeof template==='object')return x&&typeof x==='object'&&!Array.isArray(x)&&
      Object.keys(x).length===Object.keys(template).length&&Object.keys(template).every(k=>
        Object.hasOwn(x,k)&&validDTO(x[k],template[k],path?path+'.'+k:k));
    if(typeof template==='boolean')return typeof x==='boolean';
    if(typeof template==='number')return finite(x)||x==='';
    if(['cable.EAkN','cable.allowableKN'].includes(path))return finite(x)||x==='';
    return typeof x==='string'&&x.length<=1000;
  }
  function validate(d,{geometryOnly=false}={}){
    if(!validDTO(d)||d.schema!==SCHEMA)return [{path:'schema',message:'รูปแบบข้อมูลไม่ตรงกับงานตรวจเหล็กและการแอ่น'}];
    const errors=[], check=(path,value,lo,hi)=>{if(!finite(value)||value<lo||value>hi)errors.push({path,message:`กรอก ${labels[path]||path} ระหว่าง ${lo}–${hi}`});};
    if(!['concrete-wall','concrete-beam','dual-columns','hbeam'].includes(d.support.type))errors.push({path:'support.type',message:'เลือกจุดรองรับ'});
    if(!['equal','end-pitch'].includes(d.geometry.purlinLayout))errors.push({path:'geometry.purlinLayout',message:'เลือกวิธีวางแป'});
    if(!['aisc360-22_aci318-19','aisc360-22_aci318-25','custom'].includes(d.design.profile))errors.push({path:'design.profile',message:'เลือกโปรไฟล์ออกแบบ'});
    if(!['kN','kgf'].includes(d.design.forceUnit)||!['MPa','kgf/cm²'].includes(d.design.stressUnit))errors.push({path:'design.forceUnit',message:'เลือกหน่วยที่รองรับ'});
    for(const slot of ['steel','purlin',...(d.truss.enabled?['web']:[])]){
      check(slot+'.H',d[slot].H,20,600);check(slot+'.B',d[slot].B,20,600);check(slot+'.t',d[slot].t,0.5,30);
      if(d[slot].t*2>=Math.min(d[slot].H,d[slot].B))errors.push({path:slot+'.t',message:'ความหนาต้องน้อยกว่าครึ่งหนึ่งของหน้าตัด'});
    }
    check('geometry.widthM',d.geometry.widthM,0.1,60);check('geometry.projectionM',d.geometry.projectionM,0.1,12);
    check('geometry.frameSpacingM',d.geometry.frameSpacingM,0.1,12);check('geometry.purlinSpacingM',d.geometry.purlinSpacingM,0.1,4);
    if(Math.ceil(d.geometry.widthM/d.geometry.frameSpacingM)>60)errors.push({path:'geometry.frameSpacingM',message:'รองรับไม่เกิน 60 ช่องคาน'});
    if(d.truss.enabled){
      if(!Object.hasOwn(root.NCYSC01MemberTruss.types,d.truss.type))errors.push({path:'truss.type',message:'เลือกรูปแบบโครงถัก'});
      check('truss.depthMM',d.truss.depthMM,100,d.geometry.projectionM*1000);check('truss.panels',d.truss.panels,2,12);
      if(!Number.isInteger(d.truss.panels))errors.push({path:'truss.panels',message:'จำนวนช่องโครงถักต้องเป็นจำนวนเต็ม'});
      if(d.truss.type==='tri_tapered')check('truss.tipDepthMM',d.truss.tipDepthMM,20,d.truss.depthMM);
    }
    if(geometryOnly){check('plate.allowanceMM',d.plate.allowanceMM,25.4,50.8);check('plate.thicknessMM',d.plate.thicknessMM,3,40);if(d.support.type!=='hbeam')check('plate.anchorMM',d.plate.anchorMM,8,36);}
    if(d.cable.enabled){check('cable.heightM',d.cable.heightM,0.1,12);check('cable.diameterMM',d.cable.diameterMM,2,60);}
    if(geometryOnly)return errors;
    errors.push(...D.validate(d));
    check('steel.Fy',d.steel.Fy,100,700);check('steel.Fu',d.steel.Fu,d.steel.Fy,1000);check('steel.thicknessFactor',d.steel.thicknessFactor,0.8,1);
    check('geometry.deflectionLimit',d.geometry.deflectionLimit,100,1000);check('loads.deadKPa',d.loads.deadKPa,0,20);check('loads.liveKPa',d.loads.liveKPa,0,20);
    if(d.loads.windEnabled)check('loads.windKPa',d.loads.windKPa,0.01,20);
    if(d.cable.enabled){
      check('cable.EAkN',d.cable.EAkN,1,1000000);check('cable.allowableKN',d.cable.allowableKN,0.01,10000);
      if(typeof d.cable.reference!=='string'||!d.cable.reference.trim())errors.push({path:'cable.reference',message:'ระบุแหล่งค่า EA และแรงดึงที่ยอมให้ของชุดสลิงรวมปลายยึด'});
    }
    return errors;
  }
  function migrate(value){
    const d=clone(value);
    if(d?.schema===SCHEMA&&!Object.hasOwn(d.support||{},'hbeam')){const prior=clone(shape);delete prior.support.hbeam;if(!validDTO(d,prior))throw Error('ข้อมูลรุ่นก่อนเพิ่มหน้าตัด H-beam ไม่ครบ');d.support.hbeam=clone(shape.support.hbeam);}
    if(['sc01.member-inputs.v1','sc01.member-inputs.v2','sc01.member-inputs.v3'].includes(d?.schema)){
      const old=clone(shape);delete old.connection;delete old.design;old.support={type:'concrete-wall'};delete old.geometry.purlinLayout;old.schema=d.schema;
      if(!d.schema.endsWith('.v3')){delete old.web;delete old.truss;}if(d.schema.endsWith('.v1'))delete old.deadLoad;
      if(!validDTO(d,old))throw Error('ข้อมูลตรวจเหล็กรุ่นเดิมไม่ครบหรือมีฟิลด์ที่ไม่รู้จัก');
      if(d.schema.endsWith('.v1'))d.deadLoad=D.fresh();if(!d.schema.endsWith('.v3')){d.web=clone(shape.web);d.truss=clone(shape.truss);}
      d.schema=SCHEMA;d.support={...clone(shape.support),...d.support};d.connection=clone(shape.connection);d.design=clone(shape.design);d.geometry.purlinLayout='equal';
    }
    if(!validDTO(d)||d.schema!==SCHEMA)throw Error('ไฟล์นี้ไม่ใช่ข้อมูลตรวจเหล็กและการแอ่นรุ่นที่รองรับ');
    return d;
  }
  const labels={'geometry.widthM':'ความกว้างหลังคา','geometry.projectionM':'ระยะยื่น','geometry.frameSpacingM':'ระยะคาน','geometry.purlinSpacingM':'ระยะแป',
    'cable.EAkN':'EA ของสลิง (kN)','cable.allowableKN':'แรงดึงใช้งานที่ยอมให้ (kN)','cable.heightM':'ระดับจุดยึดสลิง','truss.depthMM':'ความลึกโครงถัก','truss.tipDepthMM':'ความลึกปลาย','truss.panels':'จำนวนช่องโครงถัก'};
  function layout(d){
    const g=d.geometry,bays=Math.ceil(g.widthM/g.frameSpacingM);
    const pg=P.layout({member:{lengthM:g.projectionM},takeoff:{widthM:g.widthM,frameSpacingM:g.frameSpacingM,purlinSpacingM:g.purlinSpacingM,purlinLayout:g.purlinLayout}});
    return {bays,frames:bays+1,frameSpacingM:g.widthM/bays,purlins:pg.count,purlinSpacingM:pg.spacingM,purlinIntervals:pg.intervals,purlinLayout:pg.placement,
      tributaryM:g.widthM/bays*(bays===1?0.5:1),edgeTributaryM:g.widthM/bays/2};
  }
  function nativeState(d){
    const s=M.defaultState(),g=layout(d);s.mode='basic';s.connectionType='plain';s.v61.systemType='member';
    s.profile=d.design.profile;s.customFactors=clone(d.design.custom);Object.assign(s.v55,{forceUnit:d.design.forceUnit,stressUnit:d.design.stressUnit});
    Object.assign(s.member,{H:d.steel.H,B:d.steel.B,tNom:d.steel.t,designThicknessFactor:d.steel.thicknessFactor,
      Fy:d.steel.Fy,Fu:d.steel.Fu,lengthM:d.geometry.projectionM,deflectionLimit:d.geometry.deflectionLimit,Kx:2,Ky:2,includeSelfWeight:true});
    Object.assign(s.takeoff,{widthM:d.geometry.widthM,frameSpacingM:d.geometry.frameSpacingM,purlinSpacingM:d.geometry.purlinSpacingM,
      purlinH:d.purlin.H,purlinB:d.purlin.B,purlinT:d.purlin.t,purlinLayout:d.geometry.purlinLayout,includePurlins:true});
    const pp=E.rhsProps({...s.member,H:d.purlin.H,B:d.purlin.B,tNom:d.purlin.t,designThicknessFactor:1});
    const purlinDL=g.purlins*pp.weightKNm/d.geometry.projectionM;
    Object.assign(s.loads,{tributaryM:g.tributaryM,deadKPa:d.loads.deadKPa+purlinDL,liveKPa:d.loads.liveKPa,roofKPa:0,
      windUpliftKPa:d.loads.windEnabled?d.loads.windKPa:0,lateralWindKPa:0,pointMagnitudeKN:0,servicePointMagnitudeKN:0,
      pointPositionM:d.geometry.projectionM,verticalEccentricityMM:0,lateralEccentricityMM:0});
    return {s,grid:g,purlinDL};
  }
  // Elastic beam-column under constant compression P, full UDL w and tip force F.
  // Differential solution, fixed-free boundary conditions; P=0 uses native exact beam kernel.
  function beamColumn({L,EI,w,F=0,P:compression=0},x=L){
    if(![L,EI,w,F,compression,x].every(finite)||L<=0||EI<=0||compression<0||x<0||x>L)throw Error('ข้อมูล beam-column ไม่ถูกต้อง');
    const alpha=compression/(Math.PI**2*EI/(4*L*L));
    if(alpha>=1)throw Error('แรงอัดถึงจุดไร้เสถียรภาพของคาน');
    if(alpha<1e-5){
      const z=E.beamValue([{kind:'udlV',w},{kind:'pointV',P:F/1000,a:L/1000}],L/1000,x/1000,EI);
      return {x:x/1000,deflection:z.deflection,slope:z.slope,M:z.M,V:z.V};
    }
    const k=Math.sqrt(compression/EI),u=k*L,v=k*x,B=-(F+w*L)/(EI*k),A=-(B*Math.sin(u)+w/compression)/Math.cos(u);
    const curvature=A*Math.cos(v)+B*Math.sin(v)+w/compression;
    return {x:x/1000,deflection:A*(1-Math.cos(v))/(k*k)+B*(x/k-Math.sin(v)/(k*k))+w*x*x/(2*compression),
      slope:A*Math.sin(v)/k+B*(1-Math.cos(v))/k+w*x/compression,
      M:EI*curvature/1e6,V:EI*k*(-A*Math.sin(v)+B*Math.cos(v))/1000};
  }
  function beamWithPoints(args,points=[],x=args.L){
    const {L,EI,P=0}=args,answer=beamColumn(args,x);
    for(const q of points){
      if(q.a===0)continue;
      if(P/(Math.PI**2*EI/(4*L*L))<1e-5){const z=E.beamValue([{kind:'pointV',P:q.P/1000,a:q.a/1000}],L/1000,x/1000,EI);for(const key of ['deflection','slope','M','V'])answer[key]+=z[key];continue;}
      // Green function of EI y'' + P y = M0(x) + P y(L).
      // Each point reaction remains at its actual purlin station.
      const k=Math.sqrt(P/EI),a=q.a;
      const integral=z=>{const b=Math.min(z,a),t=z-b;return (-a*Math.cos(k*z)+(a-b)*Math.cos(k*t))/k**2+(Math.sin(k*z)-Math.sin(k*t))/k**3;};
      const derivative=z=>{const b=Math.min(z,a),t=z-b;return (a*Math.sin(k*z)-(a-b)*Math.sin(k*t))/k+(Math.cos(k*z)-Math.cos(k*t))/k**2;};
      const tip=q.P*integral(L)/(EI*Math.cos(k*L)),y=tip*(1-Math.cos(k*x))+q.P*integral(x)/EI,slope=tip*k*Math.sin(k*x)+q.P*derivative(x)/EI;
      answer.deflection+=y;answer.slope+=slope;answer.M+=(P*(tip-y)+q.P*Math.max(0,a-x))/1e6;answer.V+=(-P*slope-(x<a?q.P:0))/1000;
    }
    return answer;
  }
  function cableCase(d,p,w,pointLoads=[]){
    const L=d.geometry.projectionM*1000,EI=MODULUS*p.Ix,EA=MODULUS*p.A;
    const h=d.cable.heightM*1000,len=Math.hypot(L,h),sin=h/len,cos=L/len;
    const response=(args,x=L)=>beamWithPoints(args,pointLoads,x);
    const free=response({L,EI,w}),Pcr=Math.PI**2*MODULUS*Math.min(p.Ix,p.Iy)/(4*L*L);
    let T=0,issue='';
    if(d.cable.enabled&&free.deflection>0){
      const fc=len/(d.cable.EAkN*1000),fa=L/EA;
      const residual=t=>t*(fc+cos*cos*fa)-response({L,EI,w,F:-t*sin,P:t*cos}).deflection*sin;
      let lo=0,hi=Math.min((Math.abs(w*L)+pointLoads.reduce((v,q)=>v+Math.abs(q.P),0))/sin,0.799999*Pcr/cos);
      if(!(hi>0)||residual(hi)<0)issue='แรงอัดจากสลิงเกินขอบเขตเสถียรภาพของแบบจำลอง ลองเพิ่มหน้าตัดหรือยกระดับจุดรั้ง';
      else {for(let i=0;i<70;i++){const mid=(lo+hi)/2;if(residual(mid)>0)hi=mid;else lo=mid;}T=(lo+hi)/2;}
    }
    const args={L,EI,w,F:-T*sin,P:T*cos},points=[];
    for(let i=0;i<=160;i++)points.push(response(args,L*i/160));
    // Exact extrema are located by sign changes in slope (deflection) and shear (moment).
    for(const key of ['slope','V'])for(let i=1;i<=160;i++){
      let a=points[i-1].x*1000,b=points[i].x*1000,fa=points[i-1][key];
      if(fa*points[i][key]>=0)continue;
      for(let j=0;j<50;j++){const x=(a+b)/2,f=response(args,x)[key];if(f*fa>0){a=x;fa=f;}else b=x;}
      points.push(response(args,(a+b)/2));
    }
    for(const q of pointLoads)for(const x of [Math.max(0,q.a-1e-6),q.a,Math.min(L,q.a+1e-6)])points.push(response(args,x));
    points.sort((a,b)=>a.x-b.x);
    const maxD=maxBy(points,x=>Math.abs(x.deflection)),maxM=maxBy(points,x=>Math.abs(x.M)),maxV=maxBy(points,x=>Math.abs(x.V));
    const maxSlope=Math.max(...points.map(x=>Math.abs(x.slope))),strain=T/(d.cable.EAkN*1000||Infinity);
    if(d.cable.enabled&&!issue&&(maxSlope>0.05||Math.abs(maxD.deflection)>L/50||strain>0.01))issue='การเคลื่อนตัวหรือการยืดสลิงเกินขอบเขตแบบจำลองยืดหยุ่น ลองเพิ่มหน้าตัด/ความแข็ง';
    return {TKN:T/1000,compressionKN:T*cos/1000,verticalKN:T*sin/1000,lengthM:len/1000,sin,cos,strain,PcrKN:Pcr/1000,
      freeTipMM:free.deflection,tipMM:points.at(-1).deflection,maxMM:Math.abs(maxD.deflection),maxM:Math.abs(maxM.M),maxV:Math.abs(maxV.V),
      rootMoment:points[0].M,rootVertical:-(w*L+pointLoads.reduce((v,q)=>v+q.P,0)-T*sin)/1000,points,pointLoads,selfW:w,slack:d.cable.enabled&&T===0&&!issue,issue};
  }
  function calculate(input){
    const d=clone(input),errors=validate(d),base={version:VERSION,scope:'member-deflection-rigid-support',input:d,fingerprint:stable(d),errors,ready:false,constructionAuthorized:false};
    if(errors.length)return base;
    const {s,grid,purlinDL}=nativeState(d),profile=K.profileFor(s),props=E.rhsProps(s.member),nominal=E.rhsProps({...s.member,designThicknessFactor:1});
    const strength=Steel.hss(s,props,profile),axial=Steel.axial(s,props,profile),loads=E.buildBasicLoads(s,nominal);
    let truss=null;if(d.truss.enabled){try{truss=root.NCYSC01MemberTruss.analyze(d,profile);}catch(error){return {...base,errors:[{path:'truss.depthMM',message:error.message}]};}}
    const run=(c,tributaryM)=>{
      const f=c.f,pg=P.layout(s),ownP=E.rhsProps({...s.member,H:d.purlin.H,B:d.purlin.B,tNom:d.purlin.t,designThicknessFactor:1}).weightKNm;
      const pointLoads=pg.lines.map(p=>({a:p.zM*1000,P:((d.loads.deadKPa*p.stripM+ownP)*f.D+d.loads.liveKPa*p.stripM*f.L+(d.loads.windEnabled?d.loads.windKPa*p.stripM*f.W:0))*tributaryM*1000}));
      const selfW=nominal.weightKNm*f.D,w=selfW+pointLoads.reduce((v,p)=>v+p.P,0)/(d.geometry.projectionM*1000),response=cableCase(d,props,selfW,pointLoads);
      // Native interaction with our calculated section force envelope. The old connection solver is not called.
      const direct={...s,mode:'direct',direct:{...s.direct,memberDiagramConfirmed:true,serviceTipDeflectionMM:response.tipMM}};
      const action={N:-response.compressionKN,Vx:0,Vy:-response.maxV,Mx:response.maxM,My:0,Tz:0};
      const check=K.memberDemand(direct,props,{...strength,outside:strength.x.outside},axial,{name:c.name,action,loadList:[]});
      return {name:c.name+(tributaryM===grid.edgeTributaryM?' · แนวริม':' · แนวกลาง'),factors:f,tributaryM,w,...response,ratio:check.ratio,state:check.state,pm:check.pm,vr:check.vr};
    };
    const defs=root.NCYSC01MemberTruss.definitions(d),tribs=[...new Set([grid.tributaryM,grid.edgeTributaryM])];
    const cases=truss?truss.cases:tribs.flatMap(t=>defs.ul.map(c=>run(c,t))),service=truss?truss.service:tribs.flatMap(t=>defs.sl.map(c=>run(c,t))),member=maxBy(cases,c=>c.ratio),deflection=maxBy(service,c=>c.maxMM);
    const purlins=P.analyze(s,profile);
    if(purlins.bending){
      const ps=Steel.hss({...s,member:purlins.section},purlins.properties,profile);purlins.strength=ps;
      purlins.bendRatio=Math.abs(purlins.bending.moment)/ps.phiMnx;purlins.shearRatio=Math.abs(purlins.shear.V)/ps.Vx.phiVn;
      purlins.reasons=purlins.reasons.filter(x=>x!=='หน้าตัดชะลูดเกินขอบเขตสูตร');if(ps.x.outside)purlins.reasons.push('flange และ web ชะลูดพร้อมกัน: AISC F7 ไม่ครอบคลุม');
      const ratio=Math.max(purlins.bendRatio,purlins.shearRatio),state=v=>purlins.reasons.length?'outside':v>1?'fail':v>.8?'warn':'ok';
      purlins.checks.purlinBending={...purlins.checks.purlinBending,ratio,state:state(ratio),note:'กำลัง HSS ตาม AISC 360-22 F7/G4 รวมหน้าตัดประสิทธิผลและ LTB',governingCase:(purlins.bendRatio>=purlins.shearRatio?purlins.bending:purlins.shear).id+' · '+(purlins.bendRatio>=purlins.shearRatio?purlins.bending:purlins.shear).caseName};
      purlins.checks.purlinDeflection.state=state(purlins.checks.purlinDeflection.ratio);purlins.state=state(Math.max(ratio,purlins.checks.purlinDeflection.ratio));
    }
    const purlinStrength=purlins.checks?.purlinBending?.ratio??Infinity;
    if(d.loads.windEnabled&&purlins.deflection){
      for(const line of purlins.grid.lines)for(const sign of [1,-1]){
        const w=(d.loads.deadKPa+d.loads.liveKPa+sign*d.loads.windKPa)*line.stripM+purlins.ownWeightKNm;
        purlins.service.push({...P.simpleSpan(w,purlins.grid.spanM,purlins.properties.Ix),id:line.id,zM:line.zM,stripM:line.stripM,caseName:`SLS D+L${sign>0?'+':'−'}W (W เต็มค่า)`});
      }
      purlins.deflection=maxBy(purlins.service,x=>Math.abs(x.delta));
      const defRatio=Math.abs(purlins.deflection.delta)/purlins.allowMM,ratioState=x=>x>1+1e-9?'fail':x>0.8?'warn':'ok';
      const outside=!['ok','warn','fail'].includes(purlins.state);
      purlins.checks.purlinDeflection={...purlins.checks.purlinDeflection,ratio:defRatio,state:outside?purlins.state:ratioState(defRatio),
        governingCase:purlins.deflection.id+' · '+purlins.deflection.caseName,note:`δ ${Math.abs(purlins.deflection.delta).toFixed(3)} / ${purlins.allowMM.toFixed(3)} mm; รวม DL/LL/ลมใช้งานเต็มค่า`};
      if(!outside)purlins.state=ratioState(Math.max(purlinStrength,defRatio));
    }
    const caseText=text=>String(text||'').replace(' (example)','').replace(/\+0\.5R|\+1\.6R|\+R/g,'')
      .replace(/U4 Wv([+-]) H[+-]/,'U4 1.2D+L$1W').replace(/U5 Wv([+-]) H[+-]/,'U5 0.9D$1W');
    for(const q of [purlins.bending,purlins.shear,purlins.deflection,...(purlins.cases||[]),...(purlins.service||[])])if(q)q.caseName=caseText(q.caseName);
    for(const q of Object.values(purlins.checks||{}))q.governingCase=caseText(q.governingCase);
    const memberLimit=s.member.lengthM*1000/s.member.deflectionLimit;
    const issues=[...(truss?.issues||[]),...[...cases,...service].filter(c=>c.issue).map(c=>c.name+': '+c.issue)];
    if(!truss&&strength.x.outside)issues.push('หน้าตัดมี flange และ web ชะลูดพร้อมกัน ซึ่ง AISC F7 ไม่ครอบคลุม: เพิ่มความหนาหรือใช้หน้าตัดตลาด');
    if(!purlins.bending||!['ok','warn','fail'].includes(purlins.state))issues.push(purlins.reason||purlins.reasons?.join(' · ')||'หน้าตัดแปอยู่นอกขอบเขต');
    const cableSLS=maxBy(service,c=>c.TKN),cableULS=maxBy(cases,c=>c.TKN);
    const checks=[{id:'member-strength',label:'กำลังคาน',ratio:member.ratio},{id:'purlin-strength',label:'กำลังแป',ratio:purlinStrength},
      {id:'member-deflection',label:'การแอ่นคาน',ratio:deflection.maxMM/memberLimit},{id:'purlin-deflection',label:'การแอ่นแป',ratio:purlins.checks?.purlinDeflection?.ratio??Infinity}];
    if(d.cable.enabled)checks.push({id:'cable-strength',label:'แรงดึงใช้งานสลิง',ratio:cableSLS.TKN/d.cable.allowableKN});
    for(const c of checks)c.pass=finite(c.ratio)&&c.ratio<=1+1e-9;
    return {...base,s,grid,purlinDL,mainSelfWeightKNm:truss?truss.geo.totalWeightKN/d.geometry.projectionM:nominal.weightKNm,profile,props,strength,axial,loads,cases,service,member,deflection,truss,
      purlins,memberLimit,cableSLS,cableULS,checks,issues:[...new Set(issues)],ready:issues.length===0&&checks.every(c=>c.pass)};
  }
  function reportAllowed(result,input){return !!result&&result.version===VERSION&&result.scope==='member-deflection-rigid-support'&&
    result.fingerprint===stable(input)&&result.ready===true&&result.errors.length===0&&result.issues?.length===0&&result.checks?.length>0&&
    result.checks.every(c=>c.pass&&finite(c.ratio)&&c.ratio<=1+1e-9);}
  function fromLegacy(raw){
    const v=raw?.schema==='sv.concrete.inputs.v1'&&raw.card==='sc01'?raw.input:raw?.state||raw;
    if(!v?.member||!v?.takeoff||!v?.loads||!v?.plate||!v?.anchors)throw Error('ไม่พบข้อมูล SC01 เดิมครบชุด');
    if(!['aisc360-22_aci318-25','aisc360-22_aci318-19'].includes(v.profile)||
      v.scope?.seismic||v.scope?.fatigue||v.scope?.fire||v.scope?.impact||v.mode!=='basic'||!['member','truss'].includes(v.v61?.systemType)||v.connectionType!=='plain'||v.takeoff.includePurlins===false||v.takeoff.roofSlopeDeg!==0||
      v.loads.roofKPa!==0||v.loads.lateralWindKPa!==0||v.loads.pointMagnitudeKN!==0||v.loads.servicePointMagnitudeKN!==0||
      v.loads.verticalEccentricityMM!==0||v.loads.lateralEccentricityMM!==0||v.v55?.criteria?.loadSet!=='legacy'||
      v.v55.criteria.windFactor!==1||v.v55.criteria.serviceWindFactor!==1||v.member.Kx!==2||v.member.Ky!==2||!v.member.includeSelfWeight||
      !['wall','beam','dual_columns'].includes(v.v61.supportType))
      throw Error('งานเดิมมีค้ำยัน แรงอื่น หรือวิธีคำนวณต่างจากขอบเขตนี้ จึงไม่ตัดข้อมูลเหล่านั้นทิ้งเพื่อนำเข้า');
    const d=fresh();d.support.type=v.v61.supportType==='wall'?'concrete-wall':v.v61.supportType==='dual_columns'?'dual-columns':'concrete-beam';
    Object.assign(d.support,{beamBMM:v.v61.supportBeamBMM,beamHMM:v.v61.supportBeamHMM,columnBMM:v.v61.supportColumnBMM,columnDMM:v.v61.supportColumnDMM,columnHeightM:v.v61.supportColumnHeightM});
    Object.assign(d.steel,{H:v.member.H,B:v.member.B,t:v.member.tNom,Fy:v.member.Fy,Fu:v.member.Fu,thicknessFactor:v.member.designThicknessFactor});
    Object.assign(d.purlin,{H:v.takeoff.purlinH,B:v.takeoff.purlinB,t:v.takeoff.purlinT});
    Object.assign(d.web,{H:v.brace.H,B:v.brace.B,t:v.brace.tNom});Object.assign(d.truss,{enabled:v.v61.systemType==='truss',type:v.v61.trussType,depthMM:v.v61.trussDepthMM,tipDepthMM:v.v61.trussTipDepthMM,panels:v.v61.trussPanels});
    d.geometry.purlinLayout=v.takeoff.purlinLayout==='end-pitch'?'end-pitch':'equal';d.design.profile=v.profile;d.design.forceUnit=v.v55?.forceUnit||'kN';d.design.stressUnit=v.v55?.stressUnit||'MPa';for(const k of Object.keys(d.design.custom))if(finite(v.customFactors?.[k]))d.design.custom[k]=v.customFactors[k];
    Object.assign(d.plate,{thicknessMM:v.plate.thickness,anchorMM:v.anchors.diameter});
    Object.assign(d.connection,{plateAuto:false,plateWidthMM:d.truss.enabled?v.v62.rootPlateWidthMM:v.plate.width,plateHeightMM:d.truss.enabled?v.v62.rootPlateHeightMM:v.plate.height,plateFy:v.plate.Fy,plateFu:v.plate.Fu,
      weldPattern:v.weld.pattern,weldSizeMM:v.weld.size,weldFexx:v.weld.Fexx,weldLengthFactor:v.weld.effectiveLengthFactor,
      anchorType:v.anchors.type,anchorRows:v.anchors.rows,anchorCols:v.anchors.cols,anchorEdgeXMM:v.anchors.plateEdgeX,anchorEdgeYMM:v.anchors.plateEdgeY,anchorHefMM:v.anchors.hef,anchorAseMM2:v.anchors.Ase,anchorFuta:v.anchors.futa,
      concreteFc:v.concrete.fc,concreteThicknessMM:v.concrete.thickness,concreteCracked:v.concrete.cracked,edgeTopMM:v.concrete.edgeTop,edgeBottomMM:v.concrete.edgeBottom,edgeLeftMM:v.concrete.edgeLeft,edgeRightMM:v.concrete.edgeRight,product:clone(v.product)});
    Object.assign(d.connection.node,{type:v.v64.jointType,thicknessMM:v.v63.gussetThicknessMM,lengthMM:v.v64.gussetConnectionLengthMM,weldMM:v.v63.nodeWeldSizeMM,Fy:v.v64.gussetFyMPa,Fu:v.v64.gussetFuMPa,bucklingK:v.v64.gussetBucklingK,widthMM:v.v64.gussetMaxWidthMM,eccentricityMM:v.v64.jointEccentricityMM});
    Object.assign(d.geometry,{widthM:v.takeoff.widthM,projectionM:v.member.lengthM,frameSpacingM:v.takeoff.frameSpacingM,purlinSpacingM:v.takeoff.purlinSpacingM,deflectionLimit:v.member.deflectionLimit});
    Object.assign(d.project,{name:String(v.meta?.projectName||''),number:String(v.meta?.projectNo||''),designer:String(v.meta?.designer||''),date:String(v.meta?.date||d.project.date)});
    const p=E.rhsProps({...v.member,H:d.purlin.H,B:d.purlin.B,tNom:d.purlin.t,designThicknessFactor:1});
    const grid=layout(d),oldPurlinDL=grid.purlins*p.weightKNm/d.geometry.projectionM;
    Object.assign(d.loads,{deadKPa:v.loads.deadKPa-oldPurlinDL,liveKPa:v.loads.liveKPa,windEnabled:v.loads.windUpliftKPa>0,windKPa:v.loads.windUpliftKPa});
    // Restore supported connection fields without mutating the original store.
    if(!finite(v.loads.tributaryM)||Math.abs(v.loads.tributaryM-grid.tributaryM)>1e-7)throw Error('ความกว้างรับแรงเดิมไม่ตรงระยะคานจริง ต้องจัดข้อมูลก่อนนำเข้าเพื่อไม่เปลี่ยนแรงโดยเงียบ');
    const errors=validate(d);if(errors.length)throw Error(errors[0].message);
    return d;
  }
  root.NCYSC01MemberAnalysis=Object.freeze({VERSION,SCHEMA,fresh,stable,clone,validDTO,validate,migrate,layout,nativeState,beamColumn,beamWithPoints,cableCase,calculate,reportAllowed,fromLegacy});
})(typeof window==='undefined'?globalThis:window);
