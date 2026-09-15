/* Isolated retained-engine teaching samples. This module never writes app or storage state. */
(function(root) {
  'use strict';
  const VERSION='SC01-DEMO-R7-20260904';
  const CATALOG=Object.freeze([
    Object.freeze({id:'plain',label:'เพลทตรง',description:'คานยื่นเหล็กกล่องกับเพลทตรง',scope:'สมดุลแรงคานยื่นและผลคัดกรองจุดต่อเดิม'}),
    Object.freeze({id:'stiffened',label:'เพลทมีครีบเสริม',description:'เพลทมีครีบเสริม 2 แผ่น',scope:'สมดุลแรงคานยื่นและผลคัดกรองครีบเดิม'}),
    Object.freeze({id:'bracket',label:'ขายึดมีค้ำยัน',description:'ค้ำล่างและจุดต่อแยกบนผนังตัวอย่าง',scope:'สมดุลแรงรวมคาน–ค้ำ ไม่ใช่การรับรองจุดต่อล่าง'}),
    Object.freeze({id:'truss',label:'Truss',description:'โครงถักยื่นกับเพลทรากคู่',scope:'สมดุลแรงระบบ Truss และผลคัดกรองจากโมดูล Truss เดิม'})
  ]);
  const PATCHES={
    plain:{connectionType:'plain','v61.systemType':'member'},
    stiffened:{connectionType:'stiffened','v61.systemType':'member'},
    bracket:{connectionType:'bracket','v61.systemType':'brace','v61.supportType':'wall','v61.supportWallThicknessMM':300,'brace.H':75,'brace.B':75,'brace.tNom':6,'brace.weldSize':5,'v65.braceLowerWeldMM':5},
    truss:{connectionType:'plain','v61.systemType':'truss','v61.supportType':'wall','v61.supportWallThicknessMM':300,'v64.washerODMM':50,'v64.washerThicknessMM':6}
  };
  const COMMON_LIMITATIONS=Object.freeze([
    'DEMO · ตัวอย่างแยกจากงานจริง ไม่ใช่ขนาดแนะนำสำหรับก่อสร้าง',
    'ตรวจเทียบเฉพาะสมการ/สมดุลที่แสดง ไม่ใช่การตรวจรับรองสูตรกำลังทุกมาตรฐาน',
    'ค่าพุกที่คงจากตัวอย่างเอนจิ้นไม่ใช่ข้อมูลพุกรุ่นจริง และยังไม่มีรายงานผลิตภัณฑ์ที่ยืนยัน',
    'หลักฐานหน้างาน โครงสร้างรองรับ กฎหมาย การตรวจอิสระ และ immutable snapshot ยังต้องตรวจจริง'
  ]);
  const stable=value=>{
    if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
    if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
    return JSON.stringify(value);
  };
  const set=(state,path,value)=>{const parts=path.split('.');let node=state;for(const part of parts.slice(0,-1))node=node[part];node[parts.at(-1)]=value;};
  function entry(id) {
    const found=CATALOG.find(item=>item.id===id);
    if(!found)throw Error('ไม่พบรูปแบบ Demo: '+String(id));
    return found;
  }
  function dependencies() {
    if(!root.NCYV5?.defaultState||!root.NCYAuto?.ensure||!root.NCYEngine?.calculate||!root.NCYV659Engine?.fingerprint)
      throw Error('เอนจิ้นตัวอย่างยังไม่พร้อม');
  }
  function create(id) {
    dependencies();const item=entry(id);
    const state=root.NCYAuto.ensure(root.NCYV5.defaultState());
    set(state,'weld.size',5);
    // Match the retained UI's derived display mirrors before the first render.
    state.quick.projectWidthM=state.takeoff.widthM;
    state.quick.frameSpacingM=state.loads.tributaryM;
    for(const [path,value] of Object.entries(PATCHES[id]))set(state,path,value);
    state.meta={...state.meta,projectName:'DEMO · '+item.label+' · ตัวอย่างตรวจสมการ',projectNo:'SC01-DEMO-R7-'+id.toUpperCase(),
      location:'ตัวอย่างแยกจากงานจริง',designer:'',checker:'',revision:'DEMO R7',date:'2026-09-04',
      notes:COMMON_LIMITATIONS.join('\n')};
    return state;
  }
  function identify(state) {
    return CATALOG.find(item=>state?.meta?.projectNo==='SC01-DEMO-R7-'+item.id.toUpperCase())?.id||null;
  }
  function binding(state) {
    if(!state)return null;
    const engine=root.NCYV659Engine;
    return engine.fingerprint(state)+'|'+stable(engine.authorityProjection(state));
  }
  function summary(result) {
    const entries=Object.entries(result?.checks||{}).map(([key,check])=>({key,label:check.label||key,state:check.state,
      engineState:check.engineState||check.state,ratio:check.ratio,note:check.note||'',methodReview:!!check.methodReview}));
    const active=entries.filter(check=>check.state!=='na');
    const unresolved=active.filter(check=>check.state!=='ok'||check.methodReview);
    const numeric=active.filter(check=>Number.isFinite(check.ratio)&&['ok','warn','fail'].includes(check.engineState));
    const numericFailed=numeric.filter(check=>check.ratio>1||check.engineState==='fail');
    const releaseOpen=(result?.releaseGate?.open||[]).map(row=>({key:row.key,note:row.note||''}));
    return {total:entries.length,active:active.length,notApplicable:entries.length-active.length,
      numericCount:numeric.length,numericWithin:numeric.length-numericFailed.length,numericFailed:numericFailed.length,
      counts:entries.reduce((counts,row)=>(counts[row.state||'unknown']=(counts[row.state||'unknown']||0)+1,counts),{}),
      unresolved,releaseOpen,allPass:false,readyForConstruction:false};
  }
  function evidenceRow(key,label,equation,substitution,expected,actual,unit,sourcePath,tolerance=1e-8) {
    const delta=Number.isFinite(expected)&&Number.isFinite(actual)?Math.abs(actual-expected):null;
    const limit=Number.isFinite(expected)?tolerance*Math.max(1,Math.abs(expected)):null;
    return {key,label,equation,substitution,expected,actual,unit,sourcePath,tolerance,limit,delta,
      ok:delta!==null&&Number.isFinite(limit)&&delta<=limit};
  }
  function scopedRows(state,result) {
    const fmt=value=>Number.isFinite(value)?Number(value.toPrecision(9)).toString():'—';
    const unsupported=(note,path)=>[evidenceRow('unsupported','นอกขอบเขตสมการตัวอย่าง','ไม่ได้ตรวจสมการนี้',note,null,null,'',path)];
    if(state.mode!=='basic')return unsupported('ตัวอย่างสมการนี้รองรับโหลดแบบ basic เท่านั้น','result.state.mode');
    if(state.v61.systemType==='truss') {
      const cases=result.v63?.truss?.cases;
      if(!Array.isArray(cases)||!cases.length||cases.length!==result.loads?.cases?.length||
        !cases.every((q,i)=>q.caseName===result.loads.cases[i].name))
        return unsupported('ผล Truss ไม่ครบกรณีแรง','result.v63.truss.cases');
      return cases.flatMap((q,index)=>{
        const nodes=q.geo?.nodes,F=q.F,u=q.u,members=q.members,reactions=q.reactions,topIndex=q.geo?.top?.[0],bottomIndex=q.geo?.bottom?.[0];
        const top=nodes?.[topIndex],bottom=nodes?.[bottomIndex],path=`result.v63.truss.cases[${index}]`;
        if(!Array.isArray(nodes)||!Array.isArray(F)||!Array.isArray(u)||!Array.isArray(members)||
          F.length!==nodes.length*2||u.length!==F.length||!top||!bottom||!reactions?.top||!reactions?.bottom||
          !F.every(Number.isFinite)||!u.every(Number.isFinite)||!nodes.every(n=>[n.x,n.y].every(Number.isFinite))||
          !members.length||!members.every(m=>Number.isFinite(m.N)&&[m.E,m.A,m.length].every(n=>Number.isFinite(n)&&n>0)))
          return unsupported('ข้อมูลแรง/โหนด/ผลเคลื่อนตัว Truss ไม่ครบ',path);
        const sumFx=nodes.reduce((sum,_,i)=>sum+F[2*i],0),sumFy=nodes.reduce((sum,_,i)=>sum+F[2*i+1],0);
        const moment=nodes.reduce((sum,node,i)=>sum+node.x*F[2*i+1]-node.y*F[2*i],0);
        const actualMoment=(top.x*reactions.top.Fy-top.y*reactions.top.Fx+bottom.x*reactions.bottom.Fy-bottom.y*reactions.bottom.Fx)/1000;
        const energy=members.reduce((sum,member)=>sum+(member.N*1000)**2*member.length/(member.E*member.A),0);
        const externalWork=F.reduce((sum,force,i)=>sum+force*u[i],0);
        return [
          evidenceRow('truss-Rx-'+index,'สมดุลแรงแนวนอน Truss','ΣRₓ = −ΣFₓ / 1000',`−(${fmt(sumFx)}) / 1000`,
            -sumFx/1000,reactions.top.Fx+reactions.bottom.Fx,'kN',path+'.reactions.top.Fx + '+path+'.reactions.bottom.Fx'),
          evidenceRow('truss-Ry-'+index,'สมดุลแรงแนวดิ่ง Truss','ΣRᵧ = −ΣFᵧ / 1000',`−(${fmt(sumFy)}) / 1000`,
            -sumFy/1000,reactions.top.Fy+reactions.bottom.Fy,'kN',path+'.reactions.top.Fy + '+path+'.reactions.bottom.Fy'),
          evidenceRow('truss-M-'+index,'สมดุลโมเมนต์ Truss','Σ(xRᵧ − yRₓ) = −Σ(xFᵧ − yFₓ) / 10⁶',`−(${fmt(moment)}) / 10⁶`,
            -moment/1e6,actualMoment,'kN·m',path+'.geo root coordinates × '+path+'.reactions'),
          evidenceRow('truss-energy-'+index,'เอกลักษณ์ F·u = 2U (สองเท่าพลังงานยืดหยุ่น)','ΣFᵢuᵢ = Σ(Nⱼ×1000)²ℓⱼ/(EⱼAⱼ) = 2U',
            `Σ ${members.length} ชิ้นส่วน = ${fmt(energy)}; Σ ${F.length} DOF = ${fmt(externalWork)}`,energy,externalWork,'N·mm',path+'.F · '+path+'.u')
        ].map(row=>({...row,caseName:q.caseName}));
      });
    }
    if(state.connectionType==='bracket') {
      const control=result.controls?.stiffener,b=control?.member?.brace,loads=control?.caseDef?.loadList;
      if(!b||!Array.isArray(loads)||loads.length!==1||loads[0].kind!=='udlV'||
        !result.loads?.cases?.some(q=>stable(q)===stable(control.caseDef)))
        return unsupported('สมการค้ำนี้ตรวจเฉพาะโหลดกระจายสม่ำเสมอ 1 รายการ ไม่ครอบคลุมชุดโหลดอื่น','result.controls.stiffener.caseDef.loadList');
      const w=loads[0].w,L=state.member.lengthM,a=state.brace.attachM,drop=state.brace.dropM;
      const Lmm=L*1000,amm=a*1000,len=Math.hypot(a,drop)*1000,sine=drop/Math.hypot(a,drop),E=200000,I=result.properties.Ix,Ab=b.props.A;
      const y0=w*amm**2*(6*Lmm**2-4*Lmm*amm+amm**2)/(24*E*I);
      const kv=E*Ab/len*sine**2;
      const reaction=-y0/(amm**3/(3*E*I)+1/kv)/1000;
      const base='result.controls.stiffener.member.brace';
      return [
        evidenceRow('brace-y0','การโก่งก่อนมีค้ำ ณ จุดค้ำ','y₀ = w a²(6L² − 4La + a²)/(24EI)',
          `${fmt(w)} × ${fmt(amm)}² × (6×${fmt(Lmm)}² − 4×${fmt(Lmm)}×${fmt(amm)} + ${fmt(amm)}²)/(24×${E}×${fmt(I)})`,y0,b.unbracedDeflectionAtBrace,'mm',base+'.unbracedDeflectionAtBrace'),
        evidenceRow('brace-kv','ความแข็งแนวดิ่งของค้ำ','kᵥ = EAᵦ sin²θ / ℓ',
          `${E} × ${fmt(Ab)} × ${fmt(sine)}² / ${fmt(len)}`,kv,b.kv,'N/mm',base+'.kv'),
        evidenceRow('brace-R','แรงค้ำจาก compatibility','R = −y₀ / [a³/(3EI) + 1/kᵥ] / 1000',
          `−${fmt(y0)} / [${fmt(amm)}³/(3×${E}×${fmt(I)}) + 1/${fmt(kv)}] / 1000`,reaction,b.R,'kN',base+'.R'),
        evidenceRow('brace-N','แรงตามแกนค้ำ','Nᵦ = −R / sinθ',`−(${fmt(reaction)}) / ${fmt(sine)}`,
          -reaction/sine,b.force,'kN',base+'.force'),
        evidenceRow('brace-V','สมดุลแรงเฉือนที่โคนคาน','V₀ = −(wL + R)',`−(${fmt(w)}×${fmt(L)} + (${fmt(reaction)}))`,
          -(w*L+reaction),b.points?.[0]?.V,'kN',base+'.points[0].V'),
        evidenceRow('brace-M','สมดุลโมเมนต์ที่โคนคาน','M₀ = wL²/2 + Ra',`${fmt(w)}×${fmt(L)}²/2 + (${fmt(reaction)})×${fmt(a)}`,
          w*L**2/2+reaction*a,b.points?.[0]?.M,'kN·m',base+'.points[0].M')
      ].map(row=>({...row,caseName:control.caseDef.name}));
    }
    const cases=result.cases,expected=result.loads?.cases;
    if(!Array.isArray(cases)||!cases.length||!Array.isArray(expected)||cases.length!==expected.length||
      state.plate.standOffMM!==0||state.loads.verticalEccentricityMM!==0||state.loads.lateralEccentricityMM!==0||
      !cases.every((q,i)=>stable(q.caseDef)===stable(expected[i])&&Array.isArray(q.caseDef.loadList)&&
        q.caseDef.loadList.every(load=>['udlV','pointV'].includes(load.kind))))
      return unsupported('ตรวจเฉพาะโหลดแนวดิ่ง udlV/pointV และไม่มี stand-off/eccentricity','result.cases');
    const L=state.member.lengthM,rows=cases.flatMap((q,index)=>{
      const force=q.caseDef.loadList.reduce((sum,load)=>sum+(load.kind==='udlV'?load.w*L:load.P),0);
      const moment=q.caseDef.loadList.reduce((sum,load)=>sum+(load.kind==='udlV'?load.w*L**2/2:load.P*load.a),0);
      const termsV=q.caseDef.loadList.map(load=>load.kind==='udlV'?`${fmt(load.w)}×${fmt(L)}`:fmt(load.P)).join(' + ');
      const termsM=q.caseDef.loadList.map(load=>load.kind==='udlV'?`${fmt(load.w)}×${fmt(L)}²/2`:`${fmt(load.P)}×${fmt(load.a)}`).join(' + ');
      return [
        evidenceRow('cantilever-V-'+index,'แรงเฉือนรวมจากโหลดคานยื่น','Vᵧ = −Σ(wL + P)',`−(${termsV})`,-force,q.action?.Vy,'kN',`result.cases[${index}].action.Vy`),
        evidenceRow('cantilever-M-'+index,'โมเมนต์รวมจากโหลดคานยื่น','Mₓ = Σ(wL²/2 + Pa)',termsM,moment,q.action?.Mx,'kN·m',`result.cases[${index}].action.Mx`)
      ].map(row=>({...row,caseName:q.caseDef.name}));
    });
    const service=result.loads?.service?.find(q=>q.name===result.deflection?.caseName);
    if(service?.loadList?.length===1&&service.loadList[0].kind==='udlV') {
      const w=service.loadList[0].w,Lmm=L*1000,E=200000,I=result.properties.Ix;
      rows.push({...evidenceRow('cantilever-deflection','การโก่งปลายคานยื่นแบบยึดแน่น','δ = |wL⁴/(8EI)|',
        `|${fmt(w)}×${fmt(Lmm)}⁴/(8×${E}×${fmt(I)})|`,Math.abs(w*Lmm**4/(8*E*I)),result.deflection.max,'mm','result.deflection.max',2e-4),caseName:service.name});
    }
    return rows;
  }
  function verify(state,result) {
    dependencies();const id=identify(state),item=id?entry(id):null;
    let stateMatches=false,fixtureUnmodified=false;
    try {
      stateMatches=!!result?.state&&binding(state)===binding(result.state);
      fixtureUnmodified=!!id&&binding(state)===binding(create(id));
    } catch(_) { /* Incomplete/malformed evidence remains unverified. */ }
    let rows=[];
    if(stateMatches)try{rows=scopedRows(state,result);}catch(_){rows=[evidenceRow('missing','หลักฐานสมการไม่ครบ','ยังตรวจไม่ได้','ผลลัพธ์ขาดหรือรูปแบบไม่ครบ',null,null,'','result')];}
    const limitations=[...COMMON_LIMITATIONS];
    if(id==='bracket')limitations.push('เอนจิ้น retained ยังไม่ได้ใช้ช่องขนาดรอยเชื่อมจุดต่อล่างแยกอย่างอิสระ ต้องตรวจรายละเอียดจุดต่อล่างก่อนใช้งานจริง');
    if(id==='stiffened')limitations.push('คานสมมุติยึดแน่น: ครีบไม่ได้เปลี่ยน E/I ของคานในเอนจิ้นเดิม จึงไม่ใช่การตรวจความแข็งจริงของครีบ');
    if(id==='truss')limitations.push('ผลรอยเชื่อม Truss ต้องอ่านผล root/truss ไม่ใช่นำ base cases.weld ของคานเดี่ยวมาอ้างแทน');
    if(id==='truss')limitations.push('สมดุลและพลังงานยืดหยุ่นนี้ตรวจโครงถักที่เอนจิ้นประกอบไว้ ไม่ใช่การตรวจถอดโหลดหรือกำลังจุดต่ออย่างอิสระ');
    if(!stateMatches)limitations.push('ข้อมูลกับผลคำนวณไม่ตรงกัน ต้องคำนวณใหม่ก่อนแสดงหลักฐาน');
    if(id&&!fixtureUnmodified)limitations.push('แก้ข้อมูล Demo แล้ว: ผลนี้เป็นการคำนวณปัจจุบัน ไม่ใช่ fixture ต้นฉบับที่ตรวจไว้');
    const actualForm=state?.v61?.systemType==='truss'?'truss':state?.connectionType==='bracket'?'bracket':state?.connectionType==='stiffened'?'stiffened':'plain';
    const actualItem=CATALOG.find(item=>item.id===actualForm);
    return {version:VERSION,id,actualForm,label:actualItem?.label||'การคำนวณปัจจุบัน',scope:actualItem?.scope||'หลักฐานตามผลปัจจุบัน',
      stateMatches,fixtureUnmodified,inputFingerprint:state?root.NCYV659Engine.fingerprint(state):null,
      fixtureFingerprint:id?root.NCYV659Engine.fingerprint(create(id)):null,
      rows,scopedEvidencePass:stateMatches&&rows.length>0&&rows.every(row=>row.ok),
      ...summary(result),limitations};
  }
  function calculate(id) {
    const state=create(id),result=root.NCYEngine.calculate(state);
    return {id,label:entry(id).label,state,result,verification:verify(state,result)};
  }
  root.NCYSC01Demos=Object.freeze({VERSION,CATALOG,create,calculate,verify,identify});
})(typeof window!=='undefined'?window:globalThis);
