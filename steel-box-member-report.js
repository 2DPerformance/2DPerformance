(function(root){
  'use strict';
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(x,d=3)=>Number.isFinite(x)?Number(x.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d}):'—';
  const size=s=>`${s.H} × ${s.B} × ${s.t} mm`;
  const rawTable=(head,rows)=>`<table><thead><tr>${head.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const plot=(...args)=>root.NCYSC01MemberReportFigures.plot(...args);
  function build(r,input,{figure=null}={}){
    const C=root.NCYSC01MemberConnections;
    if(!C?.reportAllowed(r,input))throw Error('ยังเปิดรายงานไม่ได้: แก้ผลตรวจทุกชิ้นส่วนให้ผ่านและคำนวณข้อมูลล่าสุดก่อน');
    const d=r.input,g=r.grid,p=r.purlins,c=r.member,def=r.deflection,pr=d.project,V=root.NCYSC01MemberViews,tr=!!r.truss;
    const units=C.units,convertText=text=>String(text).replace(/(-?\d[\d,]*(?:\.\d+)?)\s*(kN·m|kN\/m²|kN\/m|kN|MPa)(?![a-zA-Z])/g,(_,v,u)=>n(units.toDisplay(Number(v.replaceAll(',','')),u,d))+' '+units.label(u,d)).replace(/kN·m|kN\/m²|kN\/m|kN|MPa/g,u=>units.label(u,d));
    const table=(head,rows)=>rawTable(head.map(convertText),rows.map(row=>row.map((v,i)=>{const unit=String(head[i]).match(/\((kN·m|kN\/m²|kN\/m|kN|MPa)\)/)?.[1];return unit&&(Number.isFinite(v)||/^-?\d[\d,]*(\.\d+)?$/.test(String(v)))?n(units.toDisplay(Number(String(v).replaceAll(',','')),unit,d)):convertText(v);})));
    const header=title=>`<header><h1>รายการคำนวณ · ${esc(title)}</h1><p>${esc(pr.name||'ไม่ระบุชื่อโครงการ')} · ${esc(pr.number)} · ${esc(pr.date)} · ผู้จัดทำ ${esc(pr.designer||'ไม่ระบุ')}</p><p>โปรไฟล์ ${esc(r.connections.hbeam&&d.design.profile!=='custom'?'AISC 360-22 · LRFD':r.profile.basis)} · หน่วยแรง ${esc(d.design.forceUnit)} · ความเค้น ${esc(d.design.stressUnit)}</p></header>`;
    const page=(title,body)=>`<section class="sm-sheet">${header(title)}${body}<footer>คำนวณตามข้อมูลและสมมติฐานในรายงาน · ฐานรองรับแข็ง</footer></section>`;
    const inputRows=[['จุดรองรับ',{'concrete-wall':'ผนังคอนกรีต','concrete-beam':'คานคอนกรีต','dual-columns':'เสาซ้าย–ขวาที่ฐาน + คานเชื่อม',hbeam:'เพลทเชื่อมกับ H-beam'}[d.support.type]+' · ยึดแน่น'],
      ...(d.support.type==='hbeam'?[['H-beam H × B × tw × tf',`${d.support.beamHMM} × ${d.support.beamBMM} × ${d.support.hbeam.webMM} × ${d.support.hbeam.flangeMM} mm · ถือว่าฐานแข็ง`]]:[]),
      ['ระบบ',tr?root.NCYSC01MemberTruss.types[d.truss.type]:'คานยื่น'+(d.cable.enabled?' + สลิงรั้งปลาย':'')],
      ['คาน / คอร์ด; แป',size(d.steel)+'; '+size(d.purlin)],...(tr?[['เหล็กทแยง / ตั้ง',size(d.web)],['ลึกโครง / ลึกปลาย / จำนวนช่อง',`${d.truss.depthMM} / ${d.truss.type==='tri_tapered'?d.truss.tipDepthMM:d.truss.depthMM} mm / ${d.truss.panels}`]]:[]),
      ['Fy / Fu / ตัวคูณความหนา',`${d.steel.Fy} MPa / ${d.steel.Fu} MPa / ${d.steel.thicknessFactor}`],['ความกว้างรวมตามผนัง / คานยื่นจากฐาน',`${d.geometry.widthM} / ${d.geometry.projectionM} m`],
      ['ช่วงแประหว่างคานรองรับ; ระยะ @ แปจริง',`${g.frames} คาน / ${g.bays} ช่วง × ${n(g.frameSpacingM)} m; ${g.purlins} แป: ${g.purlinIntervals.map(x=>n(x)).join(' + ')} m`],['DL ภายนอก / LL',`${n(d.loads.deadKPa,4)} kN/m² / ${d.loads.liveKPa} kN/m²`],
      ['น้ำหนักแป / เหล็กหลักบวกแยก',`${n(r.purlinDL)} kN/m² / ${n(r.mainSelfWeightKNm)} kN/m${tr?' เฉลี่ย; วิเคราะห์แยกทุกชิ้น':''}`],['แรงลมแนวดิ่ง',d.loads.windEnabled?`± ${d.loads.windKPa} kN/m²; SLS ใช้ W เต็มค่า`:'ไม่รวมในชุดนี้'],['เกณฑ์แอ่น',`ช่วงที่ตรวจ / ${d.geometry.deflectionLimit}`]];
const F=root.NCYSC01MemberReportFigures,math=[];
    const eq=(title,formula,sub,result,caseName='',source='ข้อมูลปัจจุบัน')=>{
      const i=math.length,row={title,formula,sub,result,caseName,group:source};
      math.push(`<table class="sm-equation-table c4-equation-single" data-formula-component="${esc(source)}"><tbody><tr>${root.NCYSC01Report.equationCell(row,i,source)}</tr></tbody></table>`);
      return `<div class="sm-equation-slot">[[R38-MATH-${i}]]</div>`;
    };
    const panel=F.panel,pair=F.pair,plots=(pts,key,title,unit,opts={})=>F.plot(pts.map(p=>({...p,[key]:units.toDisplay(p[key],unit,d)})),key,title,units.label(unit,d),opts);
    const drawing=root.NCYSC01MemberDrawings,drawings=drawing.build(d),draw=id=>`<div class="sm-cad-drawing">${drawing.svg(drawings.find(x=>x.id===id))}</div>`;
    const pages=[],add=(title,body)=>pages.push(page(title,body));
    const propertyCards=(sec,props,strength,label)=>[
      eq('ความหนาเหล็กที่ใช้คำนวณ','t_d = t_nom × k_t',`${sec.t} × ${sec.thicknessFactor??d.steel.thicknessFactor}`,`${n(props.t)} mm`,'',label),
      eq('พื้นที่หน้าตัดและโมเมนต์ความเฉื่อย','A = BH − (B−2t)(H−2t); Ix = [BH³ − (B−2t)(H−2t)³]/12',`B ${sec.B}; H ${sec.H}; t ${n(props.t)} mm`,`A = ${n(props.A)} mm²; Ix = ${n(props.Ix,0)} mm⁴; Sx = ${n(props.Sx)} mm³`,'',label),
      eq('กำลังดัดของหน้าตัด HSS','φMnx = min(φb Mp, φMn,FLB, φMn,WLB, φb Mn,LTB)',`${n(r.profile.phiB)} × ${n(strength.x.Mp)}; ${n(strength.x.flange.phiMn)}; ${n(strength.x.web.phiMn)}; ${n(r.profile.phiB)} × ${n(strength.x.ltb)} kN·m`,`φMnx = ${n(strength.phiMnx)} kN·m · ปีก ${strength.compactness.x.classF}; เอว ${strength.compactness.x.classW}`,'',label+' / AISC F7'),
      eq('กำลังเฉือนของหน้าตัด HSS','φVn = φv × 0.6 Fy Aw Cv / 1000',`${r.profile.phiV} × 0.6 × ${d.steel.Fy} × ${n(strength.Vx.Aw)} × ${n(strength.Vx.Cv)} / 1000`,`φVn = ${n(strength.Vx.phiVn)} kN`,'',label+' / AISC G4')
    ].join('');
    const byCase=(rows,score)=>{const key=x=>JSON.stringify([x.factors.D,x.factors.L,d.loads.windEnabled?x.factors.W:0]),groups=[...new Set(rows.map(key))];return groups.map(k=>{const q=rows.filter(x=>key(x)===k).reduce((a,b)=>score(a)>=score(b)?a:b);return {...q,caseName:d.loads.windEnabled?q.caseName:q.caseName.replace(/[+−-]W/g,'')};});};
    const scopeText='คาน แป การแอ่น และจุดต่อที่ระบุ ตามน้ำหนักและขนาดที่กรอก · ถือว่าฐานรองรับแข็ง ไม่รวมกำลังคานรองรับ เสา และฐานรากเดิม';
    add('ข้อมูลโครงการ / แปลนรวม',`<p>${scopeText}</p>${table(['ข้อมูลที่ใช้','ค่า'],inputRows)}${panel('PLAN · แปลนวางแปและคานทุกแนว',draw('plan'),'ตัวเลขมิติเป็น mm · แนวแปเริ่มจากหัวและท้าย เหลือเศษตามระยะจริง')}${table(['รายการตรวจ','ใช้กำลัง / เกณฑ์','ผล'],r.checks.map(q=>[q.label,`${n(q.ratio)} ≤ 1`,'✓ OK']))}`);
    // PURLIN: keep section, supports, load, every case and equations together.
    const pg=r.purlins.grid,pc=byCase(p.cases,x=>Math.max(Math.abs(x.moment),Math.abs(x.V))),pd=p.deflection.points.map(x=>({...x,deflection:x.D}));
    const purOpts={leftLabel:'A · รองรับที่คาน',rightLabel:'B · รองรับที่คาน'};
    add('แปหลังคา · PURLIN',`<h2>เลือกใช้แป RHS ${size(d.purlin)}</h2>
      ${pair(panel('รูปด้านแป / จุดรองรับ',draw('purlin')),panel('SECTION P–P · หน้าตัดแป',draw('purlin-section')))}
      ${table(['แนวแป','ตำแหน่งจากฐาน (m)','หน้ากว้างรับโหลด (m)'],pg.lines.map(x=>[x.id,n(x.zM),n(x.stripM)]))}
      <p>วิเคราะห์แปเป็นช่วงรองรับสองด้าน ยาว ${n(pg.spanM)} m; ทุกช่วงถ่ายแรงลงคานที่ตำแหน่งจริง · น้ำหนักแปบวกแยก ${n(p.ownWeightKNm)} kN/m</p>
      ${pair(panel('LOAD · แรงลงแป '+p.bending.id,F.member(d,r,p.bending,{purlin:true}),p.bending.caseName),plots(pd,'deflection','การแอ่น · แป '+p.deflection.id+' · '+p.deflection.caseName,'mm',purOpts))}
      ${pair(plots(p.shear.points,'V','SFD · แป '+p.shear.id+' · '+p.shear.caseName,'kN',purOpts),plots(p.bending.points,'M','BMD · แป '+p.bending.id+' · '+p.bending.caseName,'kN·m',purOpts))}
      ${propertyCards(d.purlin,p.properties,p.strength,'แป')}
      ${eq('น้ำหนักกระจายที่ลงแป','wD = DL × b_t + wแป; wL = LL × b_t',`${n(d.loads.deadKPa)} × ${n(p.bending.stripM)} + ${n(p.ownWeightKNm)}; ${n(d.loads.liveKPa)} × ${n(p.bending.stripM)}`,`wD = ${n(p.bending.components.D)} kN/m; wL = ${n(p.bending.components.L)} kN/m`,p.bending.id,'แป / น้ำหนัก')}
      ${pc.map(q=>eq('แรงในแป · '+q.caseName,'wu = Σ γi wi; Mmax = wu l²/8; |V|max = |wu| l/2',`wu ${n(q.w)} kN/m; l ${n(pg.spanM)} m; แป ${q.id}, bt ${n(q.stripM)} m`,`Mmax = ${n(q.moment)} kN·m; |V|max = ${n(Math.abs(q.V))} kN`,q.caseName,'แป / สมดุล')).join('')}
      ${eq('ตรวจการรับน้ำหนักของแป','D/C = max(|M|/φMnx, |V|/φVn)',`max(${n(Math.abs(p.bending.moment))}/${n(p.strength.phiMnx)}, ${n(Math.abs(p.shear.V))}/${n(p.strength.Vx.phiVn)})`,`${n(p.checks.purlinBending.ratio)} ≤ 1 — OK`,p.checks.purlinBending.governingCase,'แป / กำลัง')}
      ${eq('ตรวจการแอ่นของแป','δmax = 5 ws l⁴ / (384 E Ix); δallow = l / เกณฑ์',`ws ${n(p.deflection.w)} N/mm; l ${n(pg.spanM*1000)} mm; E 200000 MPa; Ix ${n(p.properties.Ix)} mm⁴`,`δmax = ${n(Math.abs(p.deflection.delta))} mm ≤ ${n(p.allowMM)} mm — OK`,p.deflection.caseName,'แป / SLS')}
      ${table(['กรณีแรง · แปควบคุม','w (kN/m)','V (kN)','M (kN·m)'],pc.map(q=>[q.caseName+' / '+q.id,q.w,q.V,q.moment]))}`);
    // MAIN: actual discrete purlin reactions, not an equivalent full UDL.
    add(tr?'โครงถัก / คอร์ดและ Web':'คานยื่น · MAIN',`<h2>${tr?root.NCYSC01MemberTruss.types[d.truss.type]:'คานยื่น'} · RHS ${size(d.steel)}</h2>
      ${pair(panel('รูปด้าน / ตำแหน่งแป',draw('main')),panel('SECTION M–M · หน้าตัดคาน / คอร์ด',draw('main-section')))}
      ${pair(tr?panel('แบบโครงถัก / แรงตามจุดต่อ',V.trussSVG(d,r),c.name):panel('LOAD · แปถ่ายลงคาน',F.member(d,r,c),c.name),plots(def.points,'deflection',`การแอ่น · ${tr?'โครงถัก':'คาน'} · ${def.name}`,'mm'))}
      ${pair(plots(c.points,'V',`SFD · ${tr?'ผลรวมโครงถัก':'คาน'} · ${c.name}`,'kN'),plots(c.points,'M',`BMD · ${tr?'ผลรวมโครงถัก':'คาน'} · ${c.name}`,'kN·m'))}
      ${!tr?table(['แรงแป · '+c.name,'a จากฐาน (m)','P ลงคาน (kN)'],c.pointLoads.map((x,i)=>['P'+String(i+1).padStart(2,'0'),n(x.a/1000),x.P/1000])):''}
      <p>โหลดแปถ่ายลงที่ตำแหน่งจริง; แปที่ฐานถ่ายเข้าจุดต่อโดยตรง แรงหน้าเพลทจึงรวมโหลดแปที่ฐานด้วย</p>
      ${propertyCards(d.steel,r.props,r.strength,tr?'คอร์ด':'คาน')}
      ${tr?eq('สมดุลโครงถัก','k = EA/L; Fint(u) = F; N = EA(l − L)/L',`${r.truss.geo.nodes.length} จุด; ${r.truss.geo.members.length} ชิ้น; E 200000 MPa`,`Residual = ${n(c.residual,10)}; รวมแรงแป น้ำหนักสมาชิก และการดัดเฉพาะคอร์ด`,c.name,'โครงถัก'):r.cases.map(q=>eq('แรงหน้าเพลท · '+q.name,d.cable.enabled?'Vy = −wL − ΣPi + T sinθ; Mx = wL²/2 + ΣPi ai − T sinθ L + N δL':'Vy = −wL − ΣPi; Mx = wL²/2 + ΣPi ai',`w ${n(q.selfW)} kN/m; L ${d.geometry.projectionM} m; ΣPi ${n(q.pointLoads.reduce((a,x)=>a+x.P/1000,0))} kN; ΣPi ai ${n(q.pointLoads.reduce((a,x)=>a+x.P*x.a/1e6,0))} kN·m${d.cable.enabled?`; T ${n(q.TKN)} kN; sinθ ${n(q.sin,5)}; N ${n(q.compressionKN)} kN; δL ${n(q.tipMM/1000,6)} m`:''}`,`Vy = ${n(q.rootVertical)} kN; Mx = ${n(q.rootMoment)} kN·m`,q.name,'คาน / สมดุล')).join('')}
      ${eq('ตรวจการรับน้ำหนักของคาน','D/C = √[PM² + (V/φVn)²]',tr?'ผลปฏิสัมพันธ์รายสมาชิกตามตารางด้านล่าง':`PM ${n(c.pm)}; V/φVn ${n(c.vr)}`,`${n(c.ratio)} ≤ 1 — OK`,c.name,'คาน / AISC H1')}
      ${eq('ตรวจการแอ่นของคาน',(d.cable.enabled?'EI y⁗ + N y″':'EI y⁗')+' = w + ΣPi δ(x−ai); δmax = max|y(x)|; δallow = L/เกณฑ์',`E 200000 MPa; Ix ${n(r.props.Ix)} mm⁴; L ${d.geometry.projectionM*1000} mm; เกณฑ์ L/${d.geometry.deflectionLimit}`,`${n(def.maxMM)} mm ≤ ${n(r.memberLimit)} mm — OK`,def.name,'คาน / SLS')}
      ${table(['กรณีแรง ULS','N อัด (kN)','Vy หน้าเพลท (kN)','Mx หน้าเพลท (kN·m)','ใช้กำลัง'],r.cases.map(q=>[q.name,q.compressionKN,q.rootVertical,q.rootMoment,n(q.ratio)]))}
      ${table(['กรณีใช้งาน SLS','แอ่นสูงสุด (mm)','แอ่นปลาย (mm)'],r.service.map(q=>[q.name,n(q.maxMM),n(q.tipMM)]))}`);
    if(tr){const envelope=r.truss.geo.members.map(m=>r.cases.reduce((best,q)=>{const b=q.members.find(x=>x.id===m.id);return !best||b.ratio>best.ratio?{...b,caseName:q.name}:best;},null));
      add('โครงถัก · รายสมาชิก / จุดต่อ',`${pair(panel('SECTION W–W · Web',draw('web-section')),panel('Gusset / แนวเชื่อม',draw('joints')))}<p>คอร์ด K = 2 นอกระนาบ; Web K = 1; ไม่ถือว่าแผ่นหลังคาเป็นค้ำยัน</p>${table(['สมาชิก / หน้าตัด','N (kN)','M (kN·m)','V (kN)','ใช้กำลัง / กรณี'],envelope.map(m=>[m.id+' / '+size(m.section),m.Nmax,m.maxM,m.maxV,n(m.ratio)+' / '+m.caseName]))}`);
    }
    if(d.cable.enabled){const cs=r.cableSLS,cu=r.cableULS;
      add('คาน · สลิงช่วยลดการแอ่น',`${panel('ตำแหน่งสลิงและฐานรองรับ',draw('main'))}${table(['ข้อมูลสลิง','ค่าที่ใช้'],[['ขนาด / ระดับยึด / ความยาว',`${d.cable.diameterMM} mm / ${d.cable.heightM} m / ${n(cs.lengthM)} m`],['EA / แรงดึงใช้งานที่ยอมให้',`${d.cable.EAkN} kN / ${d.cable.allowableKN} kN`],['แหล่งข้อมูล',d.cable.reference],['สมมติฐาน','รับแรงดึงเท่านั้น ตึงเริ่มต้น ไม่มีแรงดึงล่วงหน้า รวมปลายยึดในกำลังที่ระบุ']])}
      ${eq('แรงดึงสลิงร่วมกับการแอ่นคาน',tr?'T = max(0, EA ΔLc/Lc)':'T [Lc/EA + cos²θ L/(E Abeam)] = y(L) sinθ',`Lc ${n(cs.lengthM*1000)} mm; EA ${d.cable.EAkN*1000} N; L ${d.geometry.projectionM*1000} mm; Abeam ${n(r.props.A)} mm²`,`TSLS = ${n(cs.TKN)} kN ≤ ${d.cable.allowableKN} kN — OK`,cs.name,'สลิง / ความเข้ากันได้')}
      ${eq('ผลการลดแอ่นในกรณีใช้งานเดียวกัน','δก่อน = y(L,T=0); δหลัง = y(L,T=TSLS)',`แรงแปและน้ำหนักเดิม; TSLS ${n(cs.TKN)} kN`,`${n(cs.freeTipMM)} → ${n(cs.tipMM)} mm`,cs.name,'สลิง / SLS')}
      ${table(['ผลสลิง','ค่า'],[['แรงดึง ULS ออกแบบจุดยึด',`${n(cu.TKN)} kN · ${cu.name}`],['สลิงหย่อนในกรณี',r.service.filter(q=>q.slack).map(q=>q.name).join('; ')||'ไม่มีในชุดนี้'],['ขอบเขต','ไม่รวมสลิงหย่อนเริ่มต้น แรงด้านข้าง การสั่น หรือความยืดหยุ่นของฐานรองรับ']])}`);
    }
    const a=V.rootActions(d,r),connections=r.connections,view=F.connection(d,r),rootCase=connections.all.find(q=>q.caseName===view.caseName&&q.plateId===view.plateId);
    const rendered=figure&&figure.fingerprint===r.fingerprint?`<figure class="sm-connection-figure" data-report-force-case="${esc(figure.caseName)}"><div><img src="${figure.image}" alt="โมเดลเพลทและจุดยึดจากข้อมูลที่คำนวณ"/>${figure.overlay}</div><figcaption>3D จุดต่อ · ${esc(figure.caseName)} · ลูกศรแสดงแรงที่คำนวณ</figcaption></figure>`:'';
    add('เพลทและรอยเชื่อม',`${pair(panel('PL1 · ผังเพลท / หน้าตัดเหล็ก',view.front,view.plateId+' · '+view.caseName),panel('SECTION A–A · จุดรองรับ',view.section,connections.hbeam?'เพลทเชื่อมกับ H-beam':'รูปตัดพุก / ระยะฝัง'))}
      ${rendered}${panel('CAD · เพลท / รูปตัด / แนวเชื่อม',root.NCYSC01MemberDrawings.plateDetails(d).markup)}
      ${table(['รายละเอียดที่เลือก','ค่า'],[['เพลท',`${rootCase.plate.width} × ${rootCase.plate.height} × ${d.plate.thicknessMM} mm`],['เกรดเพลท',`Fy ${d.connection.plateFy} MPa / Fu ${d.connection.plateFu} MPa`],['W1 · เหล็ก → เพลท',`${d.connection.weldPattern} · ขา ${d.connection.weldSizeMM} mm · Fexx ${d.connection.weldFexx} MPa · ตัวคูณแนวเชื่อม ${d.connection.weldLengthFactor}`],...(connections.hbeam?[['W2 · เพลท → H-beam',`รอบเพลท ขา ${d.connection.supportWeldSizeMM} mm; หน้ารองรับแข็งเต็มแนว`]]:[])])}
      ${table(['ทุกกรณีแรงหน้าเพลท','N (kN)','Vx (kN)','Vy (kN)','Mx (kN·m)','My (kN·m)','Tz (kN·m)'],connections.all.map(q=>[q.plateId+' / '+q.caseName,...['N','Vx','Vy','Mx','My','Tz'].map(k=>q.action[k])]))}
      ${connections.checks.filter(q=>['plate','weld','support-weld','hardware-fit','support-fit'].includes(q.id)).map(q=>{
        const detail=q.detail||q;
        if(q.id.includes('weld')){const g=detail.geometry||q.geometry;return eq(q.label,'Aw = 0.707 w Leff; σeq = resultant(N/Aw, Mx y/Ix, My x/Iy, V/Aw, T r/J)',`w ${g?.leg??d.connection.weldSizeMM} mm; Leff ${n(g?.effectiveLength)} mm; σeq ${n(detail.maxStress)} MPa; φRn ${n(detail.cap)} MPa`,`σeq/φRn = ${n(detail.strengthRatio??q.ratio)}; เนื้อเหล็ก ${n(detail.baseRatio)}; ขา ${n(g?.leg)} mm อยู่ในช่วง ${n(q.minSize??detail.minSize)}–${n(q.maxSize??detail.maxSize)} mm — OK`,q.caseName,q.label)+'<p>'+esc(q.note)+'</p>';}
        if(q.id==='plate'&&connections.hbeam)return eq('แถบเพลทเชื่อมกับ H-beam','t_req = √[6 qn a/(φFy)]; DCb = qn a/(φFy t²/6); DCv = √3 qv/(φFy t)',`qn ${n(q.qn)} N/mm; qv ${n(q.qv)} N/mm; a ${n(q.outstand)} mm; φ ${r.profile.phiPlateY}; Fy ${d.connection.plateFy} MPa; t ${d.plate.thicknessMM} mm`,`t_req ${n(q.tReq)} mm; √(DCb² + DCv²) = √(${n(q.bending)}² + ${n(q.shear)}²) = ${n(q.ratio)} ≤ 1 — OK`,q.caseName,'เพลท / แถบยืดหยุ่น')+'<p>'+esc(q.assumption)+'</p>';
        return eq(q.label,q.id==='plate'?'t_req = √[6 T a/(φFy be)]':'ตรวจรูปทรงและระยะขอบจากข้อมูลจริง',q.note||'ตามค่าที่ระบุ',`ใช้กำลัง ${n(q.ratio)} ≤ 1 — OK`,q.caseName,'เพลท / รูปทรง');
      }).join('')}
      ${pair(panel('แนวฐานรองรับ',draw('support')),panel(connections.hbeam?'SECTION E–E · H-beam':'จุดต่อกับฐาน',draw(connections.hbeam?'support-section':'connection')))}<p>${scopeText}</p>`);
    if(!connections.hbeam){
      add('พุกและคอนกรีตรอบพุก',`${pair(panel('แรงพุก / แรงอัดสัมผัส',view.forceMap,view.caseName),panel('SECTION A–A · ระยะฝัง',view.section))}
      ${table(['พุก / คอนกรีต','ค่าที่ใช้'],[['ขนาด / ระยะฝัง',`M${d.plate.anchorMM} / hef ${d.connection.anchorHefMM} mm`],['ผลิตภัณฑ์ / เอกสาร',d.connection.product.name+' / '+d.connection.product.report],['คอนกรีต',`f′c ${d.connection.concreteFc} MPa; หนา ${d.connection.concreteThicknessMM} mm`]])}
      ${table(['พุก','x (mm)','y (mm)','T (kN)','Vx (kN)','Vy (kN)'],view.forces.map(x=>[x.id,n(x.x),n(x.y),x.T,x.Vx,x.Vy]))}
      ${connections.checks.filter(q=>!['plate','weld','support-weld','hardware-fit','support-fit'].includes(q.id)).map(q=>`<h2>${esc(q.label)}</h2><p>${esc(q.caseName||'')}</p><p>${esc(q.note||'')}</p>${table(['รายการ','ผล'],[['ใช้กำลัง / เกณฑ์',`${n(q.ratio)} ≤ 1 — OK`]])}`).join('')}`);
    }
    const dl=root.NCYSC01MemberLoads,materials=d.deadLoad.mode==='materials'?dl.selected(d):[];
    add('สรุปเลือกใช้ / แหล่งอ้างอิง',`<p class="sm-chosen">✓ เลือกใช้${tr?'คอร์ด':'คาน'}เหล็ก ${size(d.steel)} — OK${tr?'<br>✓ Web '+size(d.web)+' — OK':''}<br>✓ เลือกใช้แปเหล็ก ${size(d.purlin)} — OK<br>✓ เพลท ${n(a.plates[0].width)} × ${n(a.plates[0].height)} × ${d.plate.thicknessMM} mm — OK<br>✓ รอยเชื่อม ${d.connection.weldPattern} ขา ${d.connection.weldSizeMM} mm — OK${a.hbeam?'<br>✓ แนวเชื่อมเพลท → H-beam — OK':'<br>✓ พุก M'+d.plate.anchorMM+' ตามเอกสารที่ระบุ — OK'}${d.cable.enabled?'<br>✓ สลิงตาม EA / กำลังใช้งานที่ระบุ — OK':''}</p>
      <p>${esc(dl.description(d))}; DL ภายนอก ${n(d.loads.deadKPa,4)} kN/m²; น้ำหนักคานและแปบวกแยกหนึ่งครั้ง</p>
      ${materials.map(q=>`<p class="sm-dl-reference">${esc(q.label)} ${q.mass} kg/m² = ${n(q.mass*dl.GRAVITY,4)} kN/m² · ${esc(q.basis)}<br><a href="${esc(q.source)}">${esc(q.source)}</a></p>`).join('')}
      <p class="sm-dl-reference"><a href="${esc(root.NCYSC01SteelDesign.source)}">AISC 360-22 — E3/E7, F7, G4, H1 และ J2</a> · <a href="https://people.duke.edu/~hpgavin/cee421/beam-element.pdf">Duke: Beam element</a>${tr?' · <a href="https://people.duke.edu/~hpgavin/cee421/truss-finite-def.pdf">Duke: Truss finite deformation</a>':''}</p><p>สมการและบรรทัดแทนค่าใช้ SI; ค่าประกอบแสดงตามหน่วยโปรไฟล์ ผลใช้เฉพาะโหลด ขนาด และสมมติฐานในรายงานนี้</p>`);
    return pages.map((html,i)=>html.replace('<footer>',`<footer><span class="sm-page-number">หน้า ${i+1} / ${pages.length}</span>`).replace(/>([^<>]*)</g,(_,txt)=>'>'+convertText(txt)+'<')).join('').replace(/\[\[R38-MATH-(\d+)\]\]/g,(_,i)=>math[Number(i)]);

  }
  // The on-screen report and print report coexist. Hidden SVG definitions must
  // not capture the visible copy's paint/filter references when printing.
  function uniqueSvgIds(container,prefix){
    let index=0;for(const svg of container.querySelectorAll('svg')){
      const ids=new Map();for(const node of svg.querySelectorAll('[id]')){const old=node.id,next=prefix+'-'+index+++'-'+old;ids.set(old,next);node.id=next;}
      for(const node of [svg,...svg.querySelectorAll('*')])for(const attr of [...node.attributes]){
        let value=attr.value;for(const [old,next] of ids)value=value.replaceAll('url(#'+old+')','url(#'+next+')').replaceAll('url("#'+old+'")','url("#'+next+'")');
        if(['href','xlink:href'].includes(attr.name)&&ids.has(value.slice(1)))value='#'+ids.get(value.slice(1));
        if(value!==attr.value)node.setAttribute(attr.name,value);
      }
    }
  }
  // Paginate measured A4 content. Keep readable type; split tables by actual rows.
  function paginate(container){
    const doc=container.ownerDocument,sources=[...container.querySelectorAll(':scope > .sm-sheet')];if(!sources.length)return {pages:0};
    const header=sources[0].querySelector('header').cloneNode(true),footer=sources[0].querySelector('footer').cloneNode(true);
    header.querySelector('h1').textContent='รายการคำนวณ · แป → คาน → เพลท → จุดยึด';footer.querySelector('.sm-page-number')?.remove();
    const measure=doc.createElement('div');measure.className='sm-report-measure';doc.body.append(measure);
    const pages=[];let body,pending=[],sectionTitle='';
    function newPage(){const sheet=doc.createElement('section');sheet.className='sm-sheet sm-paginated';sheet.append(header.cloneNode(true));body=doc.createElement('div');body.className='sm-sheet-body';sheet.append(body,footer.cloneNode(true));measure.append(sheet);pages.push(sheet);}
    const over=()=>body.scrollHeight>body.clientHeight+1;
    const wrapper=node=>{if(!pending.length)return node;const group=doc.createElement('div');group.className='sm-keep-start';group.append(...pending,node);pending=[];return group;};
    function continuation(group){if(!body.children.length&&sectionTitle&&!group.querySelector?.('.sm-report-section-title')){const label=doc.createElement('p');label.className='sm-continuation';label.textContent=sectionTitle+' (ต่อ)';body.append(label);}}
    function place(node){const group=wrapper(node);group.dataset.reportSection=sectionTitle;body.append(group);if(over()&&body.children.length>1){group.remove();newPage();continuation(group);body.append(group);}if(over())throw Error('เนื้อหารายงานสูงเกินหน้า A4 กรุณาย่อข้อความโครงการ');}
    function table(node){
      const rows=[...node.querySelectorAll(':scope > tbody > tr')];if(!rows.length){place(node.cloneNode(true));return;}
      let current,holder,tb;
      function begin(){current=node.cloneNode(false);const head=node.querySelector('thead');if(head)current.append(head.cloneNode(true));tb=doc.createElement('tbody');current.append(tb);holder=wrapper(current);holder.dataset.reportSection=sectionTitle;continuation(holder);body.append(holder);}
      begin();
      for(const original of rows){const row=original.cloneNode(true);tb.append(row);if(!over())continue;
        row.remove();if(tb.children.length===0){holder.remove();newPage();continuation(holder);body.append(holder);tb.append(row);}
        else{newPage();begin();tb.append(row);}
        if(over())throw Error('แถวข้อมูลยาวเกินหน้า A4 กรุณาย่อข้อความโครงการ');
      }
    }
    try{newPage();for(const [i,source] of sources.entries()){
      const title=doc.createElement('h2');title.className='sm-report-section-title';title.textContent=String(i+1).padStart(2,'0')+'  '+source.querySelector('h1').textContent.replace(/^รายการคำนวณ · /,'');sectionTitle=title.textContent;pending.push(title);
      for(const original of [...source.children].filter(e=>!['HEADER','FOOTER'].includes(e.tagName))){const node=original.cloneNode(true);if(/^H[23]$/.test(node.tagName)){pending.push(node);continue;}if(node.tagName==='TABLE')table(node);else place(node);}
    }
    // Keep document order and type size, but avoid an almost empty final page.
    // Only whole blocks move; equations and paired diagrams are never divided.
    const used=b=>b.lastElementChild?(b.lastElementChild.getBoundingClientRect().bottom-b.getBoundingClientRect().top)/b.clientHeight:0;
    if(pages.length>1){
      const prev=pages.at(-2).querySelector('.sm-sheet-body'),last=pages.at(-1).querySelector('.sm-sheet-body');
      while(used(last)<.45){
        const item=prev.lastElementChild;if(!item||item.classList.contains('sm-continuation')||prev.children.length<2)break;
        const height=item.getBoundingClientRect().height/prev.clientHeight;if(used(prev)-height<.5||used(last)+height>.96)break;
        last.prepend(item);
      }
      for(const b of [prev,last]){
        b.querySelector(':scope > .sm-continuation')?.remove();const first=b.firstElementChild;
        if(first?.dataset.reportSection&&!first.querySelector('.sm-report-section-title')){const label=doc.createElement('p');label.className='sm-continuation';label.textContent=first.dataset.reportSection+' (ต่อ)';b.prepend(label);}
      }
    }
    pages.forEach((page,i)=>{const no=doc.createElement('span');no.className='sm-page-number';no.textContent='หน้า '+(i+1)+' / '+pages.length;page.querySelector('footer').prepend(no);});
    const usage=pages.map(page=>{const b=page.querySelector('.sm-sheet-body'),last=b.lastElementChild;return last?Math.round((last.getBoundingClientRect().bottom-b.getBoundingClientRect().top)/b.clientHeight*100):0;});
    container.replaceChildren(...pages);container.dataset.paginated='true';container.dataset.pageUsage=usage.join(',');return {pages:pages.length,usage};
    }finally{measure.remove();}
  }
  root.NCYSC01MemberReport=Object.freeze({build,paginate,plot,esc,n,size,uniqueSvgIds});
})(typeof window==='undefined'?globalThis:window);
