/* R37: current member reactions -> connection checks. No native project/store mutation. */
(function(root){
  'use strict';
  const A=root.NCYSC01MemberAnalysis,E=root.NCYEngine,V=root.NCYSC01MemberViews;
  const VERSION='r37',finite=Number.isFinite,good=s=>['ok','warn'].includes(s);
  const rank=s=>({fail:5,outside:4,incomplete:4,review:3,warn:1,ok:0,na:-1}[s]??4);
  const worst=xs=>xs.reduce((a,b)=>!a||rank(b.state)>rank(a.state)||rank(b.state)===rank(a.state)&&(b.ratio||0)>(a.ratio||0)?b:a,null);
  const status=r=>!finite(r)?'incomplete':r>1+1e-9?'fail':r>.8?'warn':'ok';
  const check=(id,label,q,extra={})=>({...q,...extra,id,label,pass:good(q.state)&&finite(q.ratio)&&q.ratio<=1+1e-9});
  const missing=(id,label,note)=>check(id,label,{state:'incomplete',ratio:NaN,note});
  function validate(d){
    const c=d.connection,errors=[],number=(key,lo,hi)=>{const x=c[key];if(!finite(x)||x<lo||x>hi)errors.push({path:'connection.'+key,message:`${labels[key]||key}: ${lo}–${hi}`});};
    for(const [k,lo,hi] of [['plateFy',100,700],['plateFu',c.plateFy,1000],['weldSizeMM',.1,25],['weldFexx',200,1000],['weldLengthFactor',.01,1]])number(k,lo,hi);
    if(!c.plateAuto){number('plateWidthMM',d.steel.B,1200);number('plateHeightMM',d.steel.H,1200);}
    if(!['all','horizontal','vertical'].includes(c.weldPattern))errors.push({path:'connection.weldPattern',message:'เลือกแนวเชื่อม X / Y / รอบ'});
    if(d.support.type==='hbeam'){
      number('supportWeldSizeMM',.1,25);
      for(const [k,lo,hi] of [['webMM',2,d.support.beamBMM/2],['flangeMM',2,d.support.beamHMM/3]])if(!finite(d.support.hbeam[k])||d.support.hbeam[k]<lo||d.support.hbeam[k]>hi)errors.push({path:'support.hbeam.'+k,message:`H-beam ${k}: ${lo}–${hi}`});
    }
    else{
      for(const [k,lo,hi] of [['anchorRows',1,8],['anchorCols',1,8],['anchorEdgeXMM',5,300],['anchorEdgeYMM',5,300],['anchorHefMM',20,1000],['anchorAseMM2',20,1500],['anchorFuta',200,1200],['concreteFc',10,100],['concreteThicknessMM',50,2000],...['edgeTopMM','edgeBottomMM','edgeLeftMM','edgeRightMM'].map(k=>[k,10,5000])])number(k,lo,hi);
      for(const k of ['anchorRows','anchorCols'])if(!Number.isInteger(c[k]))errors.push({path:'connection.'+k,message:'จำนวนพุกต้องเป็นจำนวนเต็ม'});
      if(c.anchorAseMM2>Math.PI*d.plate.anchorMM**2/4)errors.push({path:'connection.anchorAseMM2',message:'พื้นที่เกลียวต้องไม่เกินพื้นที่เต็มของพุกขนาดที่เลือก'});
      if(!['adhesive','mechanical'].includes(c.anchorType))errors.push({path:'connection.anchorType',message:'เลือกชนิดพุก'});
    }
    const supportSizes=[...(d.support.type==='concrete-wall'?[]:[['beamBMM',80],['beamHMM',d.truss.enabled?160:120]]),...(d.support.type==='dual-columns'?[['columnBMM',100],['columnDMM',100],['columnHeightM',.6]]:[])];
    for(const [k,min] of supportSizes)if(!finite(d.support[k])||d.support[k]<min)errors.push({path:'support.'+k,message:`ขนาดรองรับ ${k} ต้องไม่น้อยกว่า ${min}; ไม่ปรับภาพเป็นขนาดอื่นแทน`});
    if(d.truss.enabled)for(const [k,lo,hi] of [['thicknessMM',2,40],['lengthMM',20,1000],['weldMM',.1,25],['Fy',100,700],['Fu',c.node.Fy,1000],['bucklingK',.5,2],['widthMM',0,2000],['eccentricityMM',0,500]])if(!finite(c.node[k])||c.node[k]<lo||c.node[k]>hi)errors.push({path:'connection.node.'+k,message:`จุดต่อ Truss ${k}: ${lo}–${hi}`});
    if(d.design.profile==='custom')for(const [k,v] of Object.entries(d.design.custom))if(!finite(v)||v<=0||v>1)errors.push({path:'design.custom.'+k,message:'ตัวคูณกำลังต้องมากกว่า 0 และไม่เกิน 1'});
    return errors;
  }
  const labels={weldSizeMM:'ขารอยเชื่อม',plateWidthMM:'กว้างเพลท',plateHeightMM:'สูงเพลท',weldLengthFactor:'ตัวคูณแนวเชื่อม'};
  function boundaryWeld(s,action){
    // A plate perimeter welded to a rigid, continuously available support face.
    // Same retained elastic weld group; no directional-strength enhancement.
    const q=A.clone(s);q.member={...s.member,B:s.plate.width,H:s.plate.height,tNom:s.plate.thickness,designThicknessFactor:1,Fy:s.plate.Fy,Fu:s.plate.Fu};
    q.plate={...s.plate,thickness:s.r37Support.webMM};q.weld={...s.weld,size:s.r37SupportWeldSize,pattern:'all'};
    return root.NCYSC01WeldGeometry.check(q,E.rhsProps(q.member),E.memberPrimitives.profileFor(s),action);
  }
  function weldedPlate(s,action){
    // Conservative unit-width elastic strips carry peak HSS weld traction to
    // the supported plate perimeter. N/mm * outstand gives N mm/mm.
    // No membrane, yield-line redistribution or contact benefit is taken.
    const B=s.member.B,H=s.member.H,f=s.weld.effectiveLengthFactor,hor=s.weld.pattern!=='vertical',ver=s.weld.pattern!=='horizontal',seg=[{x:-B/2,y:-H/2},{x:B/2,y:-H/2},{x:B/2,y:H/2},{x:-B/2,y:H/2}];
    const L=((hor?2*B:0)+(ver?2*H:0))*f,Ix=((hor?B*H*H/2:0)+(ver?H**3/6:0))*f,Iy=((hor?B**3/6:0)+(ver?H*B*B/2:0))*f,J=Ix+Iy;
    const outstand=Math.max((s.plate.width-s.member.B)/2,(s.plate.height-s.member.H)/2),profile=E.memberPrimitives.profileFor(s);
    const qn=Math.max(...seg.map(p=>Math.abs(action.N*1000/L+action.Mx*1e6*p.y/Ix-action.My*1e6*p.x/Iy)));
    const qv=Math.max(...seg.map(p=>Math.hypot(action.Vx*1000/L-action.Tz*1e6*p.y/J,action.Vy*1000/L+action.Tz*1e6*p.x/J)));
    const t=s.plate.thickness,bending=qn*outstand/(profile.phiPlateY*s.plate.Fy*t*t/6),shear=Math.sqrt(3)*qv/(profile.phiPlateY*s.plate.Fy*t),ratio=Math.hypot(bending,shear);
    const within=outstand>=0&&s.plate.height<=s.v61.supportBeamHMM-2*s.r37Support.flangeMM&&s.plate.width>=s.member.B&&s.plate.height>=s.member.H;
    return {ratio,state:within?status(ratio):'outside',bending,shear,qn,qv,outstand,tReq:Math.sqrt(6*qn*outstand/(profile.phiPlateY*s.plate.Fy)),
      note:within?'แถบเพลทยืดหยุ่นกว้างหนึ่งหน่วย: qn·a / (φFy t²/6); รวมเฉือนแบบปฏิสัมพันธ์ ไม่มี membrane/contact benefit':'เพลทเกินหน้ารองรับระหว่างปีก H-beam: เพิ่มความสูงคานรองรับหรือแก้รายละเอียด',
      assumption:'เชื่อมรอบขอบเพลทกับหน้า H-beam ที่ถือว่าแข็ง; ไม่รวมกำลังเฉพาะที่ของ H-beam'};
  }
  function concreteCase(s,action){
    const state=A.clone(s);state.mode='direct';state.v61.systemType='member';state.connectionType='plain';
    Object.assign(state.direct,{Nu:action.N,Vx:action.Vx,Vy:action.Vy,Mx:action.Mx,My:action.My,Tz:action.Tz,memberDiagramConfirmed:true,serviceTipDeflectionMM:0});
    const raw=E.calculate(state),q=E.connectionCase(state,action),checks=[];
    const keys={plate:'เพลท: ดัด รูเจาะ หน้าตัดสุทธิ และแรงกด',weld:'รอยเชื่อมเหล็ก → เพลท',anchorSteel:'แกนพุก: ดึง / เฉือน',productInteraction:'กำลังจากเอกสารพุก',breakoutT:'คอนกรีตแตกหลุดจากแรงดึง',bond:s.anchors.type==='adhesive'?'กำลังยึดเหนี่ยวน้ำยา':'กำลังถอนพุก',breakoutV:'คอนกรีตแตกหลุดจากแรงเฉือน',pryout:'คอนกรีตงัดหลุด',geometry:'ระยะพุก ขอบ และความหนาคอนกรีต',solver:'สมดุลแรงกลุ่มพุก',productGate:'ข้อมูลพุกรุ่นจริง'};
    for(const [id,label] of Object.entries(keys)){
      const x=raw.checks[id],detail=id==='bond'?q[s.anchors.type==='adhesive'?'bond':'pullout']:q[id];
      if(x&&x.state!=='na'){const selected=detail?{...x,...detail,state:good(detail.state)&&x.methodReview?'review':detail.state}:x;checks.push(check(id,label,selected,{detail}));}
    }
    const radius=Math.max(18,1.25*s.anchors.diameter),clearance=radius+s.weld.size;
    const fits=q.group.forces.every(a=>Math.abs(a.x)+radius<=s.plate.width/2+1e-9&&Math.abs(a.y)+radius<=s.plate.height/2+1e-9&&Math.hypot(Math.max(0,Math.abs(a.x)-s.member.B/2),Math.max(0,Math.abs(a.y)-s.member.H/2))>=clearance);
    checks.push(check('hardware-fit','รูพุก / แหวน / แนวเชื่อมไม่ชนหน้าตัด',{ratio:fits?0:NaN,state:fits?'ok':'outside',note:fits?'แหวนอยู่ในเพลทและพ้นแนวเชื่อมรอบ HSS':'ตำแหน่งพุกหรือแหวนชนหน้าตัด / เลยขอบเพลท: ปรับกว้าง–สูงเพลทและตำแหน่งพุก'}));
    // Do not turn retained method-review states into numerical approval.
    return {checks,group:q.group,normal:q.normal};
  }
  function evaluate(d,r){
    const s=V.nativeState(d),all=[],profile=E.memberPrimitives.profileFor(s);s.r37SupportWeldSize=d.connection.supportWeldSizeMM;
    for(let i=0;i<r.cases.length;i++){
      const a=V.rootActions(d,r,i);
      for(const p of a.plates){
        const state=A.clone(s);state.plate.width=p.width;state.plate.height=p.height;
        if(d.truss.enabled){const g=root.NCYV62.rootGeometry(s);state.anchors.rows=1;state.anchors.cols=g.anchorXs.length;state.anchors.plateEdgeX=g.plateW/2+Math.min(...g.anchorXs);state.anchors.plateEdgeY=g.plateH/2;}
        const action={N:p.N,Vx:0,Vy:p.Vy,Mx:p.M,My:0,Tz:0};let data;
        if(d.support.type==='hbeam')data={checks:[check('weld','รอยเชื่อมเหล็ก → เพลท',root.NCYSC01WeldGeometry.check(state,E.rhsProps(state.member),profile,action)),check('plate','เพลทเชื่อมกับ H-beam',weldedPlate(state,action)),check('support-weld','รอยเชื่อมเพลท → H-beam',boundaryWeld(state,action))],group:null,normal:null};
        else data=concreteCase(state,action);
        for(const q of data.checks){q.caseName=a.caseName;q.plateId=p.id;}
        all.push({caseIndex:i,caseName:a.caseName,plateId:p.id,action,plate:state.plate,...data});
      }
    }
    const checks=[...new Set(all.flatMap(x=>x.checks.map(c=>c.id)))].map(id=>worst(all.flatMap(x=>x.checks.filter(q=>q.id===id))));
    if(d.design.profile==='aisc360-22_aci318-25'&&d.support.type!=='hbeam')checks.push(missing('design-basis','โปรไฟล์ออกแบบ','ACI 318-25 ยังใช้ adapter 318-19 เดิม: ยังไม่มีการตรวจความต่างรายข้อ จึงไม่รับรองผลเป็นฉบับ 2025'));
    let nodes=null;
    if(d.truss.enabled){
      const g=root.NCYV62.rootGeometry(s);checks.push(check('support-fit','เพลทรากทั้งสองอยู่ภายในหน้าฐานรองรับ',{ratio:g.fits?0:NaN,state:g.fits?'ok':'outside',note:g.fits?'ขนาดจริงตามที่เลือก ไม่มีการลดเพลทหรือความลึกโครงอัตโนมัติ':'เพลทรากอยู่นอกฐานรองรับหรือซ้อนกัน: เพิ่มความสูงฐาน / ความลึกโครง หรือแก้ขนาดเพลท'}));
      const node=d.connection.node;Object.assign(s.v63,{gussetThicknessMM:node.thicknessMM,nodeWeldSizeMM:node.weldMM});Object.assign(s.v64,{jointType:node.type,gussetConnectionLengthMM:node.lengthMM,gussetFyMPa:node.Fy,gussetFuMPa:node.Fu,gussetBucklingK:node.bucklingK,gussetMaxWidthMM:node.widthMM,jointEccentricityMM:node.eccentricityMM});
      nodes=root.NCYV64.nodeAnalysis(s,{profile},r.cases.map(q=>({...q,caseName:q.name})));
      const q=nodes.governing;checks.push(q?check('truss-joints','Gusset / แนวเชื่อม / ผนัง HSS ภายใน Truss',{...q,state:good(q.state)?'review':q.state,methodReview:true,note:q.note+' · สูตร joint screening เดิม: ต้องตรวจรายละเอียด joint ก่อนรับรองผลทั้งชุด'}):missing('truss-joints','จุดต่อสมาชิกภายใน Truss','ไม่มีผลจุดต่อ'));
    }
    return {version:VERSION,all,checks,nodes,profile,hbeam:d.support.type==='hbeam',anchorsApplicable:d.support.type!=='hbeam'};
  }
  function calculate(d){
    const r=A.calculate(d),errors=r.errors.length?r.errors:[...A.validate(d,{geometryOnly:true}),...validate(d)];
    if(errors.length)return {...r,scope:'member-and-connection',ready:false,errors,connections:null};
    const connections=evaluate(d,r),checks=[...r.checks,...connections.checks];
    return {...r,scope:'member-and-connection',memberReady:r.ready,connections,checks,ready:r.ready&&connections.checks.length>0&&connections.checks.every(c=>c.pass)};
  }
  function reportAllowed(r,d){const pass=q=>q.pass&&finite(q.ratio)&&q.ratio<=1+1e-9;return !!r&&r.version===A.VERSION&&r.scope==='member-and-connection'&&r.fingerprint===A.stable(d)&&r.ready===true&&r.memberReady===true&&r.errors?.length===0&&r.issues?.length===0&&r.connections?.version===VERSION&&r.connections.checks.length>0&&r.checks.every(pass)&&r.connections.checks.every(pass)&&r.connections.all.length>0&&r.connections.all.every(q=>q.checks.every(pass));}
  function unitState(d){return {v55:{forceUnit:d.design.forceUnit,stressUnit:d.design.stressUnit}};}
  const units={label:(u,d)=>root.NCYUnits.label(u,unitState(d)),toDisplay:(v,u,d)=>root.NCYUnits.toDisplay(v,u,unitState(d)),toSI:(v,u,d)=>root.NCYUnits.toSI(v,u,unitState(d))};
  root.NCYSC01MemberConnections=Object.freeze({VERSION,calculate,evaluate,validate,reportAllowed,weldedPlate,boundaryWeld,units});
})(typeof window==='undefined'?globalThis:window);
