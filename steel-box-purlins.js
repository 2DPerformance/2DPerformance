/* R25: calculation-time RHS purlin result. No UI candidate search or approval. */
(function(root){
  'use strict';
  const E=root.NCYEngine, M=root.NCYV5, finite=Number.isFinite;
  const ELASTIC_MPA=200000; // Same steel modulus as retained NCYEngine (N/mm²).
  const clone=x=>JSON.parse(JSON.stringify(x));
  const num=x=>finite(x)?Number(x.toFixed(3)).toString():'ไม่มีค่า';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ratioState=x=>!finite(x)?'incomplete':x>1?'fail':x>.8?'warn':'ok';
  function layout(s){
    const t=s.takeoff||{}, L=s.member?.lengthM, W=t.widthM;
    if(![L,W,t.frameSpacingM,t.purlinSpacingM].every(x=>finite(x)&&x>0))throw Error('ระยะยื่น ความกว้าง ระยะคานและระยะแปต้องมากกว่า 0');
    const bays=Math.ceil(W/t.frameSpacingM), spaces=Math.ceil(L/t.purlinSpacingM);
    if(bays>500||spaces>200)throw Error('จำนวนช่วงเกินขอบเขตแป 500 ช่วง / 201 แนว');
    // Native and saved equal-bay projects retain their original stations.
    // End-pitch places both endpoints and keeps the entered pitch, with a final remainder.
    const endPitch=t.purlinLayout==='end-pitch',stations=Array.from({length:spaces},(_,i)=>endPitch?i*t.purlinSpacingM:i*L/spaces);
    while(stations.length>1&&L-stations.at(-1)<1e-9)stations.pop();stations.push(L);
    const intervals=stations.slice(1).map((x,i)=>x-stations[i]);
    return {lengthM:L,widthM:W,bays,frames:bays+1,spanM:W/bays,count:stations.length,spacingM:Math.max(...intervals),intervals,
      placement:endPitch?'end-pitch':'equal',lines:stations.map((zM,i)=>({id:'P'+String(i+1).padStart(2,'0'),zM,
        stripM:((i?zM-stations[i-1]:0)+(i<stations.length-1?stations[i+1]-zM:0))/2}))};
  }
  function simpleSpan(w,l,I){
    const V=w*l/2, moment=w*l*l/8, delta=5*w*(l*1000)**4/(384*ELASTIC_MPA*I);
    return {w,V,moment,delta,points:Array.from({length:41},(_,i)=>{
      const x=l*i/40,mm=x*1000,L=l*1000;
      return {x,V:w*(l/2-x),M:w*x*(l-x)/2,D:w*mm*(L**3-2*L*mm**2+mm**3)/(24*ELASTIC_MPA*I)};
    })};
  }
  const udl=loads=>(loads||[]).filter(x=>x.kind==='udlV').reduce((a,x)=>a+x.w,0);
  function factors(s,properties){
    const result={};
    for(const [key,path] of Object.entries({D:'deadKPa',L:'liveKPa',R:'roofKPa',W:'windUpliftKPa'})){
      const input=clone(s);input.member.includeSelfWeight=false;
      Object.assign(input.loads,{tributaryM:1,deadKPa:0,liveKPa:0,roofKPa:0,windUpliftKPa:0,lateralWindKPa:0,[path]:1});
      result[key]=E.buildBasicLoads(input,properties).cases.map(c=>({name:c.name,value:udl(c.loadList)}));
    }
    return result;
  }
  function analyze(s,profile){
    if(!s.takeoff?.includePurlins)return {state:'na',reason:'ไม่ได้รวมแปในงาน',checks:{}};
    const unknown=reason=>({state:'incomplete',reason,checks:{purlinBending:{label:'แปเหล็กกล่อง: ดัด / เฉือน',state:'incomplete',ratio:NaN,note:reason},purlinDeflection:{label:'แปเหล็กกล่อง: การแอ่นตัว',state:'incomplete',ratio:NaN,note:reason}}});
    if(s.mode!=='basic')return unknown('โหมดแรงหน้าเพลทโดยตรงยังไม่มีน้ำหนักพื้นที่สำหรับตรวจแป');
    let grid;try{grid=layout(s);}catch(error){return unknown(error.message);}
    const t=s.takeoff,section={...s.member,H:t.purlinH,B:t.purlinB,tNom:t.purlinT,lengthM:grid.spanM};
    if(![section.H,section.B,section.tNom,section.Fy,section.Fu,section.designThicknessFactor,section.deflectionLimit].every(x=>finite(x)&&x>0)
      ||section.designThicknessFactor>1||2*section.tNom>=Math.min(section.H,section.B)||section.tNom*section.designThicknessFactor<.1)
      return unknown('ขนาด H/B/t กำลังเหล็ก ตัวคูณความหนา หรือเกณฑ์แอ่นของแปไม่ถูกต้อง');
    const properties=E.rhsProps(section), nominal=E.rhsProps({...section,designThicknessFactor:1});
    const ownWeightKNm=nominal.weightKNm, ownDL=grid.count*ownWeightKNm/grid.lengthM, otherDL=s.loads.deadKPa-ownDL;
    if(!finite(otherDL)||otherDL<0)return {...unknown(`DL รวม ${num(s.loads.deadKPa)} kN/m² น้อยกว่าน้ำหนักแป ${num(ownDL)} kN/m²: เพิ่ม DL ให้รวมวัสดุอื่นและแปจริง`),grid,section,properties,ownDL,otherDL,ownWeightKNm};
    const strength=E.hssStrength({...s,member:section},properties,profile), cases=[],service=[],basis=factors(s,nominal);
    for(const line of grid.lines){
      const input=clone(s);input.member={...section,includeSelfWeight:true};
      input.loads={...input.loads,deadKPa:otherDL,tributaryM:line.stripM};
      // Retained point loads are applied to the main member, not invented on a
      // purlin. Read only UDL here; all case names/factors come from the engine.
      const loads=E.buildBasicLoads(input,nominal);
      for(const [i,c] of loads.cases.entries()){
        const f=Object.fromEntries(Object.entries(basis).map(([k,v])=>[k,v[i]?.name===c.name?v[i].value:NaN]));
        const components={D:otherDL*line.stripM+ownWeightKNm,L:s.loads.liveKPa*line.stripM,R:s.loads.roofKPa*line.stripM,W:s.loads.windUpliftKPa*line.stripM};
        const w=udl(c.loadList),total=Object.entries(f).reduce((a,[k,v])=>a+v*components[k],0);
        if(!finite(total)||Math.abs(total-w)>1e-8*Math.max(1,Math.abs(w)))return unknown('องค์ประกอบน้ำหนักแปไม่ตรงกับชุดแรงของเอนจิ้น');
        cases.push({...simpleSpan(w,grid.spanM,properties.Ix),id:line.id,caseName:c.name,stripM:line.stripM,zM:line.zM,factors:f,components});
      }
      for(const c of loads.service)service.push({...simpleSpan(udl(c.loadList),grid.spanM,properties.Ix),id:line.id,caseName:c.name,stripM:line.stripM,zM:line.zM});
    }
    if(!cases.length||!service.length||cases.some(c=>!finite(c.w))||service.some(c=>!finite(c.w)))return unknown('ไม่มีกรณี ULS/SLS ของแปที่ใช้ได้');
    const peak=(rows,k)=>rows.reduce((a,b)=>Math.abs(b[k])>Math.abs(a[k])?b:a,rows[0]);
    const bending=peak(cases,'moment'),shear=peak(cases,'V'),deflection=peak(service,'delta');
    const allowMM=grid.spanM*1000/section.deflectionLimit, bendRatio=Math.abs(bending.moment)/strength.phiMnx,
      shearRatio=Math.abs(shear.V)/strength.Vx.phiVn, defRatio=Math.abs(deflection.delta)/allowMM;
    const valid=finite(strength.phiMnx)&&strength.phiMnx>0&&finite(strength.Vx.phiVn)&&strength.Vx.phiVn>0;
    const reasons=[...(strength.x.outside?['หน้าตัดชะลูดเกินขอบเขตสูตร']:[]),...(Math.abs(s.loads.lateralWindKPa||0)>0?['มีแรงด้านข้าง ต้องตรวจปฏิสัมพันธ์แรงแกนแป']:[]),
      ...(s.v61?.systemType==='truss'&&s.v65?.spaceEnabled?['ผลนี้ยังไม่รวมแรงแกนจาก Space Truss กับแรงดัดแปชิ้นเดียวกัน']:[])];
    const outside=reasons.length>0;
    const scope='แปตั้ง H แนวดิ่ง แต่ละช่วงรองรับสองปลาย ไม่ให้ผลต่อเนื่อง; เกณฑ์แอ่น L/'+section.deflectionLimit+' ใช้ร่วมกับคาน; รอยยึดแปและแรงแกนจากระบบค้ำตรวจแยก';
    const check=(label,ratio,control,note)=>({label,ratio,state:!valid?'incomplete':outside?'outside':ratioState(ratio),governingCase:control.id+' · '+control.caseName,note:note+(outside?' · '+reasons.join('; '):'')});
    const checks={purlinBending:check('แปเหล็กกล่อง: ดัด / เฉือน',Math.max(bendRatio,shearRatio),bendRatio>=shearRatio?bending:shear,`M ${num(bending.moment)} / φMn ${num(strength.phiMnx)} kN·m; V ${num(shear.V)} / φVn ${num(strength.Vx.phiVn)} kN`),
      purlinDeflection:check('แปเหล็กกล่อง: การแอ่นตัว',defRatio,deflection,`δ ${num(Math.abs(deflection.delta))} / ${num(allowMM)} mm (L/${section.deflectionLimit})`)};
    return {state:outside?'outside':ratioState(Math.max(bendRatio,shearRatio,defRatio)),grid,section,properties,strength,ownWeightKNm,ownDL,otherDL,cases,service,reasons,
      bending,shear,deflection,allowMM,bendRatio,shearRatio,checks,scope,scopeNotes:[scope,
        'DL ที่กรอกเป็นยอดรวมรวมแปแล้ว ไม่บวกซ้ำ; คานหลักยังใช้แรงกระจายเทียบเท่า ไม่ใช่กราฟแรงกระโดด ณ แปแต่ละแนว',
        `ช่วงแปจริง ${num(grid.spanM)} m; ความกว้างรับแรง C01 ที่กรอก ${num(s.loads.tributaryM)} m`,
        ...(s.v61?.systemType==='truss'?['แปหลังคานี้แยกจาก Transverse tie ใน Space Truss; ยังไม่ตรวจปฏิสัมพันธ์แรงแกนและดัดร่วมของสมาชิกชิ้นเดียวกัน']:[])]};
  }
  function attach(r){
    const p=analyze(r.state,r.profile);r.purlins=p;Object.assign(r.checks,p.checks);
    const values=Object.values(p.checks).map(c=>c.ratio).filter(finite);
    if(values.length)r.overall.maxRatio=Math.max(r.overall.maxRatio||0,...values);
    if(Object.values(p.checks).some(c=>c.state==='fail'))r.overall.state='fail';
    else if(!['fail','outside','incomplete'].includes(r.overall.state)&&['outside','incomplete'].includes(p.state))r.overall.state=p.state;
    if(p.state!=='na'){
      // Adding this bounded check never grants authority to issue construction.
      if(r.releaseGate){r.releaseGate.readyForConstruction=false;r.releaseGate.readyForEngineerIssue=false;}
      for(const c of Object.values(p.checks))if(['fail','outside','incomplete'].includes(c.state))r.recommendations.push(c.label+': '+c.note);
    }
    return r;
  }
  function formulas(r){
    const p=r.purlins;if(!p?.bending)return [];
    const rows=[],add=(title,formula,sub,result,key,control)=>rows.push({group:'02 · แปเหล็กกล่อง',title,formula,sub,result,source:'R25: simply-supported elastic statics; retained AISC 360-22 HSS strength; E=200000 MPa',
      caseName:control?p[control].id+' · '+p[control].caseName:'รูปทรง / DL รวม',state:r.checks[key]?.state||'review',purlinKey:key});
    add('แป: น้ำหนักที่แยกจาก DL รวม','q_p = n w_p / L ; q_other = DL − q_p',`${p.grid.count}×${num(p.ownWeightKNm)}/${num(p.grid.lengthM)} ; ${num(r.state.loads.deadKPa)}−${num(p.ownDL)}`,`แป ${num(p.ownDL)}; ส่วนอื่น ${num(p.otherDL)} kN/m² ไม่บวกซ้ำ`,'purlinBending');
    add('แป: โหลดแนวควบคุม','w_u = fD wD + fL wL + fR wR + fW wW',Object.keys(p.bending.factors).map(k=>`${num(p.bending.factors[k])}×${num(p.bending.components[k])}`).join(' + '),`ULS w=${num(p.bending.w)} kN/m; wD=q_other×${num(p.bending.stripM)}+${num(p.ownWeightKNm)}; ช่วง ${num(p.grid.spanM)} m`,'purlinBending','bending');
    add('แป: หน้าตัดและกำลังที่ใช้','Ix = [BH³−(B−2t)(H−2t)³]/12 ; φMn = min(φMn,flange, φMn,web)',`B=${p.section.B}; H=${p.section.H}; t=${num(p.properties.t)} mm; min(${num(p.strength.x.flange.phiMn)},${num(p.strength.x.web.phiMn)})`,
      `Ix=${num(p.properties.Ix)} mm⁴; φMn=${num(p.strength.phiMnx)} kN·m; ${p.strength.compactness.x.classF}/${p.strength.compactness.x.classW}`,'purlinBending');
    add('แป: กำลังเฉือนของผนังตั้ง','φVn = φV × 0.6 Fy Aw Cv ; Aw=2hw t',`${r.profile.phiV}×0.6×${p.section.Fy}×${num(p.strength.Vx.Aw)}×${num(p.strength.Vx.Cv)}/1000`,`${num(p.strength.Vx.phiVn)} kN; hw=${num(p.strength.compactness.hw)} mm`,'purlinBending');
    add('แป: โมเมนต์และกำลังดัด','M = w l²/8 ; D/C_M = |M|/φMn',`${num(p.bending.w)}×${num(p.grid.spanM)}²/8 ; ${num(Math.abs(p.bending.moment))}/${num(p.strength.phiMnx)}`,`M ${num(p.bending.moment)} kN·m; D/C ${num(p.bendRatio)}`,'purlinBending','bending');
    add('แป: แรงเฉือนและแรงปฏิกิริยาต่อปลาย','V = R = w l/2 ; D/C_V = |V|/φVn',`${num(p.shear.w)}×${num(p.grid.spanM)}/2 ; ${num(Math.abs(p.shear.V))}/${num(p.strength.Vx.phiVn)}`,`V/R ${num(p.shear.V)} kN; D/C ${num(p.shearRatio)}; ค่าลบคือแรงยก`,'purlinBending','shear');
    add('แป: การแอ่นตัวใช้งาน','δ = 5 w_s l⁴/(384 E Ix) ; δ_allow = l / divisor',`5×${num(p.deflection.w)}×(${num(p.grid.spanM)}×1000)⁴/(384×${ELASTIC_MPA}×${num(p.properties.Ix)}) ; ${num(p.grid.spanM*1000)}/${p.section.deflectionLimit}`,`δ ${num(Math.abs(p.deflection.delta))} / ${num(p.allowMM)} mm; D/C ${num(r.checks.purlinDeflection.ratio)}`,'purlinDeflection','deflection');
    return rows;
  }
  function geometry(B,H,t,length,origin){
    const g=root.NCYCAD.geometry.hss(B,H,t,length);
    // Native HSS is along Z; rotate it onto X without its parallel-axis basis.
    for(let i=0;i<g.p.length;i+=3){const x=g.p[i],y=g.p[i+1],z=g.p[i+2];g.p[i]=origin[0]+z;g.p[i+1]=origin[1]+y;g.p[i+2]=origin[2]-x;}
    for(let i=0;i<g.n.length;i+=3){const x=g.n[i];g.n[i]=g.n[i+2];g.n[i+2]=-x;}
    return g;
  }
  function diagram(p,kind){
    const c=kind==='D'?p.deflection:p.bending;if(!c)return '';
    const vals=c.points.map(x=>x[kind]),max=Math.max(...vals.map(Math.abs))||1;
    const points=c.points.map(x=>`${30+x.x/p.grid.spanM*420},${65-x[kind]/max*38}`).join(' '),unit=kind==='D'?'mm':kind==='V'?'kN':'kN·m';
    return `<svg viewBox="0 0 480 132" class="sc01-purlin-diagram" role="img" aria-label="แป ${kind} ${esc(c.caseName)}"><path d="M30 65H450" fill="none" stroke="currentColor"/><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2"/><text x="30" y="17">${kind==='V'?'SFD':kind==='M'?'BMD':'การแอ่น SLS'} · |max| ${num(Math.max(...vals.map(Math.abs)))} ${unit}</text><text x="30" y="122">0</text><text x="450" y="122" text-anchor="end">${num(p.grid.spanM)} m</text></svg>`;
  }
  function blocks(r){
    const p=r.purlins;if(!p||p.state==='na')return [];
    if(!p.bending)return [`<p class="c4-note">แป: ${esc(p.reason)}</p>`];
    return [`<h3 class="c4-section">แปเหล็กกล่อง ${p.section.H}×${p.section.B}×${p.section.tNom} mm</h3>`,
      `<p class="c4-note">${p.grid.count} แนว @ ${num(p.grid.spacingM)} m; ช่วงคานจริง ${num(p.grid.spanM)} m; t ออกแบบ ${num(p.properties.t)} mm; Fy ${p.section.Fy} MPa</p>`,
      ...p.scopeNotes.map(x=>`<p class="c4-note">${esc(x)}</p>`),...['V','M','D'].map(k=>diagram(p,k))];
  }
  function advice(r){const p=r.purlins;if(!p?.bending)return p?.reason||'ตรวจข้อมูลแป';const prefix=p.state==='outside'?p.reasons.join('; '):Object.values(p.checks).some(x=>x.ratio>1)?'ลองเพิ่ม H/ความหนาแป หรือลดระยะคาน/ระยะแป แล้วคำนวณใหม่':'ขนาดแปนี้อยู่ในเกณฑ์ตัวเลขที่ตรวจ';return `${prefix}: ต้องมี φMn ≥ ${num(Math.abs(p.bending.moment))} kN·m, φVn ≥ ${num(Math.abs(p.shear.V))} kN และ Ix ≥ ${num(p.properties.Ix*Math.abs(p.deflection.delta)/p.allowMM)} mm⁴ ภายใต้โหลด/ช่วงชุดนี้`;}
  const api={VERSION:'r25',ELASTIC_MPA,layout,simpleSpan,analyze,attach,formulas,geometry,diagram,blocks,advice};
  root.NCYSC01Purlins=Object.freeze(api);
  const calculate=E.calculate;E.calculate=function(...args){return attach(calculate.apply(this,args));};
  const legacyFormulas=M.formulas;M.formulas=function(r,...args){return [...legacyFormulas.call(this,r,...args),...formulas(r)];};
  const legacyBOQ=M.boq;M.boq=function(...args){const b=legacyBOQ.apply(this,args);for(const x of b.items)if(x.id==='purlin'){x.name='แปเหล็กกล่อง';x.note='ตรวจดัด / เฉือน / แอ่นในรายการคำนวณแป; รอยยึดและแรงแกนระบบค้ำตรวจแยก';}return b;};
})(typeof window==='undefined'?globalThis:window);
