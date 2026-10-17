/** Report presentation only: values are read from an accepted result, never solved here. */
import {resultUnits,displayEngineText} from './resultUnits.mjs?rwv=20261003-main-equations-1';

export const ESSENTIAL_REPORT_VERSION='rw01-essential-report/2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=3)=>Number.isFinite(v)?v.toFixed(d):'ไม่มีผลที่ใช้ได้';
const row=(name,formula,substitution,result)=>[name,formula,substitution,result];
export function reportTable(heads,rows,kind='values'){
  return '<div class="table-wrap rw-report-table" data-report-table="'+esc(kind)+'"><table><thead><tr>'
    +heads.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'
    +rows.map(r=>'<tr>'+r.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
}
export function workedReportTable(rows){return reportTable(['รายการ','สูตร','แทนค่า','ผลลัพธ์'],rows,'substitution');}

/** A small accepted-result projection gives native reports the actual depths/As,
 * including counterfort strips. It does not infer them from a drawing or rerun design. */
export function projectReportMembers(r){
  if(!r?.i)throw new TypeError('RW-01 report needs accepted member results');
  const members=[];
  if(r.mode==='but')for(const s of r.strips||[]){
    members.push({name:'พนัง '+n(s.z1,1)+'–'+n(s.z2,1)+' m · ที่ครีบ',M:s.Mn_,d:s.d,As:s.As_,provided:s.b_?.prov,bar:s.b_?.txt});
    members.push({name:'พนัง '+n(s.z1,1)+'–'+n(s.z2,1)+' m · กลางช่วง',M:s.Mn$,d:s.d,As:s.As$,provided:s.b$?.prov,bar:s.b$?.txt});
  }else for(const s of r.stemTab||[])members.push({name:'พนัง z '+n(s.z,2)+' m',M:s.Mu,d:s.d,As:s.As,provided:s.bar?.prov,bar:s.bar?.txt});
  if(r.mode==='but')members.push({name:'ครีบค้ำพนัง',width:r.i.bs,M:r.but.MuB,d:r.but.dB,As:r.but.AsB,bar:'มาร์ค ⑥ / ⑥b ตามแบบ'});
  members.push({name:'Heel บน',M:r.MH_,d:r.dH,As:r.AsH_,provided:r.barH_?.prov,bar:r.barH_?.txt},
    {name:'Heel ล่าง',M:r.MH$,d:r.dHbottom,As:r.AsH$,provided:r.barH$?.prov,bar:r.barH$?.txt},
    {name:'Toe ล่าง',M:r.MT,d:r.dT,As:r.AsT,provided:r.barT?.prov,bar:r.barT?.txt});
  return members.filter(m=>Number.isFinite(m.M)&&Number.isFinite(m.d));
}
export const projectReportShear=r=>[
  {name:'STEM',d:r.dS,V:r.VuS,capacity:r.phiVcS},
  {name:'HEEL',d:r.dH,V:r.VuH,capacity:r.phiVcH},
  {name:'TOE',d:r.toeAnalysis.d,V:r.VuT,capacity:r.phiVcT},
];
export function projectSoldierReport(r){
  const t=r.stay;
  return {stay:r.SS==='stay'&&t?Object.fromEntries(['Tu','stayAxial','Lb','bw','bh','Ag','AsStr','AsCk','AsCr','AsTieReq','AsTie','fsSvc','fsAll','fr','nBr','db'].map(k=>[k,t[k]])):null,
    lag:r.lag?Object.fromEntries(['lagDesign','wuLag','lagSpanCl','MuLagM','VuLagM'].map(k=>[k,r.lag[k]])):null,
    frontHorizontal:r.Tpile,spacing:r.S,
    capBeams:(r.capD?.beams||[]).filter(b=>b.present).map(b=>Object.fromEntries(['name','bw','bh','dCap','covCap','linkDb','detailing','McapU','VuCap','AsMin','AsBotReq','AsTopReq','AsBot','AsTop','nBot','nTop','db','Av','linkSp','pVc','Vsd','phiVn','linkBar','flexure'].map(k=>[k,b[k]]))),
  };
}

export function reportLoadTable(s,mode='si'){
  const i=s.input,u=resultUnits(mode),q=(v,unit)=>u.quantity(v,unit,3),duck=s.type==='duckfoot';
  const rows=duck?[
    ['DL ยอดเสา Nᴅ',q(i.NpostD,'kN'),'ไม่รวมน้ำหนักตัวเอง'],
    ['LL ยอดเสา Nʟ',q(i.NpostL,'kN'),'ใช้ค่าเดียวกันทุกเสา'],
    ['DL เพิ่มบนคาน wᴅ',q(i.qBeamD,'kN/m'),'น้ำหนักตัวเองคิดแยก'],
    ['LL เพิ่มบนคาน wʟ',q(i.qBeamL,'kN/m'),'กระทำตามแนวคาน'],
    ['น้ำหนักตัวเองเสา',q(s.equilibrium.wCol,'kN'),'t × d × H × γc'],
    ['น้ำหนักตัวเองฐาน',q(s.equilibrium.wCap,'kN'),'B × L × hz × γc'],
    ['น้ำหนักตัวเองคาน',q(s.beam.w,'kN/m'),'bb × hb × γc; หักส่วนซ้อนเสาในแบบจำลอง'],
    ['แรงราบ / โมเมนต์ยอดเสา',q(i.Hpost,'kN')+' / '+q(i.Mpost,'kN·m'),'แรงโครงการที่กรอก'],
  ]:[
    ['DL ผิวดิน qᴅ',q(s.forces.load.surcharge.dead,'kPa'),'แรงกระจายบนผิวดิน'],
    ['LL ผิวดิน qʟ',q(s.forces.load.surcharge.live,'kPa'),'แรงกระจายบนผิวดิน'],
    ['q = qᴅ + qʟ',q(s.forces.load.surcharge.total,'kPa'),'ค่าใช้งานก่อนคูณตัวประกอบ'],
    ['ดิน γ / γsat',q(i.gs,'kN/m³')+' / '+q(i.gsat,'kN/m³'),'φ '+n(i.phi,1)+'° · c '+q(i.c,'kPa')],
    ['คอนกรีต γc',q(i.gc,'kN/m³'),s.type==='soldier'?'ไม่เพิ่มน้ำหนักต้านทานที่ Engine ไม่ได้ใช้':'คิดจากขนาดชิ้นส่วน ไม่กรอกซ้ำใน DL'],
    ...(s.reportWeights||[]).map(w=>[w.name,q(w.value,'kN/m'),'จากขนาดจริง · x '+n(w.x)+' m จาก Toe']),
    ['น้ำใต้ดิน',Number(i.zw)===99?'ไม่คิดน้ำ':n(i.zw)+' m จากผิวดิน','ใช้ระดับและเงื่อนไขระบายน้ำที่กรอก'],
  ];
  const f=s.equationLedger.factors;
  return '<section data-report-stage="loads"><h3>1. DL / LL และแรงกระทำ</h3>'
    +reportTable(['ประเภทแรง','ค่าที่ใช้','การกระทำ'],rows,'loads')
    +'<p class="rw-report-note">'+esc(duck?'ตัวคูณแรงโครงการ':'ตัวคูณตามโปรไฟล์')+': γD '+n(f.gD,2)+' · γL '+n(f.gL,2)+' · γH '+n(f.gH,2)
    +(duck?' · กรณีแรงอัดต่ำ 0.9D + 0L':' · น้ำหนักต้าน γD,r '+n(f.gDr,2))+'</p></section>';
}

export function nativeEquationRows(s,mode='si'){
  const i=s.input,u=resultUnits(mode),q=(v,unit,d=3)=>u.quantity(v,unit,d),rows=[];
  if(s.type==='duckfoot'){
    const e=s.equilibrium,b=s.beamDesign,c=s.column,p=s.footing;
    rows.push(row('น้ำหนักเสา','Wc = t·dc·H·γc',n(i.t)+' × '+n(i.colDepth)+' × '+n(i.hp)+' × '+n(i.gc),q(e.wCol,'kN')),
      row('น้ำหนักฐาน','Wf = B·L·hz·γc',n(i.B)+' × '+n(i.capL)+' × '+n(i.hz)+' × '+n(i.gc),q(e.wCap,'kN')),
      row('N ยอดเสา','N = ND + NL',n(i.NpostD)+' + '+n(i.NpostL)+' kN',q(i.Npost,'kN')),
      row('P โคนเสา '+(e.index+1),'P = N + Wc + Rbeam',n(i.Npost)+' + '+n(e.wCol)+' + '+n(e.beamReaction)+' kN',q(e.columnP,'kN')),
      row('ΣR คาน','ΣR = (n−1)[(w+q)S − wซ้อน·dc]',(i.nPosts-1)+' × [('+n(s.beam.w)+' + '+n(i.qBeam)+') × '+n(i.postSpacing)+' − '+n(s.beam.overlapW)+' × '+n(i.colDepth)+']',q(s.beam.totalLoad,'kN')),
      row('M ตรวจคาน','Mu = max|Mu(x)| จากกรณี γD·D + γL·L','γD '+n(i.factorN,2)+' · γL '+n(i.factorL,2)+' · S '+n(i.postSpacing)+' m',q(b.M,'kN·m')),
      row('V ตรวจคาน','Vu = max|Vu(x)| จากกรณี γD·D + γL·L','wD '+n(i.qBeamD)+' · wL '+n(i.qBeamL)+' kN/m',q(b.V,'kN')),
      row('xR ฐานคุม','xR = Mเขต / V',n(e.totalM)+' / '+n(e.totalV)+' m',n(e.xResultant)+' m'),
      row('e ฐานคุม','e = xR − B/2',n(e.xResultant)+' − '+n(i.B)+'/2',n(e.eccentricity)+' m'),
      row('qmax ใช้งาน','V/(BL)·(1±6e/B); เกิน kern ใช้ compression-only contact','V '+n(e.totalV)+' kN · B '+n(i.B)+' · L '+n(i.capL)+' · e '+n(e.eccentricity)+' m',q(e.qMax,'kPa')));
    // P–M resistance is read at the actual accepted axial force, not a zero-P capacity.
    for(const a of c.cases)rows.push(row('P–M · '+a.name,'D/C = Mตรวจ / φMn(Pตรวจ)',n(a.M)+' / '+n(a.capacityM),n(a.dc)));
    rows.push(row('As คาน','As = max(Asจาก Mu, As,min) · a = As·fy/(0.85f′c·b)',
      'Mu '+n(b.M)+' kN·m · b '+n(i.beamB)+' m · d '+n(b.d)+' m · f′c '+n(i.fc)+' · fy '+n(i.fy)+' MPa',n(b.AsReq,1)+' mm²; ใช้ '+n(b.AsProv,1)+' mm²'),
      row('กำลังดัดคาน','φMn = 0.9·As·fy·(d−a/2) / 10⁶',
        '0.9 × '+n(b.AsProv,1)+' × '+n(i.fy)+' × ('+n(b.d*1000,1)+' − '+n(b.a*1000,1)+'/2) / 10⁶',q(b.capacity,'kN·m')),
      row('กำลังเฉือนคาน','φVn = min(φVc + φVs, φVmax); φVc = 0.75·0.17√f′c·b·d',
        'φVc '+n(b.vc)+' kN · d '+n(b.d)+' m · RB10@'+b.linkS+' · fyปลอก 235 MPa',q(b.capacityV,'kN')));
    if(p){
      for(const [dir,bar,M,V,vc]of [['X',p.barX,p.Mx,p.Vx,p.vcX],['Y',p.barY,p.My,p.Vy,p.vcY]])rows.push(
        row('ฐาน '+dir+' · As','As = max(Asจาก Mตรวจ, As,min)', 'M '+n(M)+' kN·m/m · d '+n(bar.d)+' m · b 1 m · f′c '+n(i.fc)+' · fy '+n(i.fy)+' MPa',n(bar.AsReq,1)+' mm²/m · '+bar.label),
        row('ฐาน '+dir+' · กำลังดัด','φMn = φ·As·fy·(d−a/2) / 10⁶',n(bar.phi)+' × '+n(bar.AsProv,1)+' × '+n(i.fy)+' × ('+n(bar.d*1000,1)+' − '+n(bar.a*1000,1)+'/2) / 10⁶',q(bar.capacity,'kN·m/m')),
        row('ฐาน '+dir+' · เฉือน','φVc = 0.75·0.17√f′c·b·d / 1000','0.75 × 0.17√'+n(i.fc)+' × 1000 × '+n(bar.d*1000,1)+' / 1000; Vu '+n(V)+' kN/m',q(vc,'kN/m')));
      rows.push(row('เจาะทะลุ','v = |V|/(1000b0d) + |M|c/(1000J); c=max(x̄,a−x̄)',
        'V '+n(p.punch.V)+' kN · M '+n(p.punch.M)+' kN·m · b0 '+n(p.punch.b0)+' · d '+n(p.punch.d)+' · a '+n(p.punch.a)+' · x̄ '+n(p.punch.xbar)+' m · J '+n(p.punch.J,6)+' m⁴',q(p.punch.stress,'MPa')),
        row('ยึดเหล็กเสา','ldh = max(0.24fy·db/√f′c, 8db, 150 mm)','fy '+n(i.fy)+' MPa · '+c.label+' · f′c '+n(i.fc)+' MPa',n(c.anchor.required)+' m; มี '+n(c.anchor.available)+' m'),
        row('โก่งคานใช้งาน','δ = 5wL⁴/(384EIeff); Ec=4700√f′c MPa; Ieff=0.175bh³/12',
          'w '+n(s.beam.w+s.beam.qBeam)+' kN/m · L '+n(i.postSpacing)+' · b '+n(i.beamB)+' · h '+n(i.beamH)+' m · f′c '+n(i.fc)+' MPa',n(b.deflection)+' mm'));
    }
  }else{
    const f=s.forces,l=f.load,p=f.pile,t=p.designTrace,a=s.geometry.anchor;
    rows.push(row('q ผิวดิน','q = qD + qL',n(l.surcharge.dead)+' + '+n(l.surcharge.live)+' kPa',q(l.surcharge.total,'kPa')),
      row('Ka',s.type==='soldier'?'tan²(45°−φ/2)':'cosβ·(cosβ−√(cos²β−cos²φ))/(cosβ+√(cos²β−cos²φ))','φ '+n(i.phi,1)+'° · β '+n(i.beta,1)+'°',n(l.Ka,4)));
    if(l.surcharge.verticalFactored!=null)rows.push(row('q แนวดิ่งออกแบบ','qu = γD·qD + γL·qL',n(l.surcharge.verticalDeadFactor,2)+' × '+n(l.surcharge.dead)+' + '+n(l.surcharge.verticalLiveFactor,2)+' × '+n(l.surcharge.live),q(l.surcharge.verticalFactored,'kPa')));
    if(s.type==='soldier')rows.push(row('pa ที่ระดับขุด','pa(z) = max[Ka(σ′v+q)−2c√Ka,0] + pw(z)','H '+n(l.H)+' m · γ '+n(i.gs)+' kN/m³ · q '+n(l.surcharge.total)+' · c '+n(i.c)+' kPa',q(l.paAtExc,'kPa')));
    else rows.push(row('แรงดันรวม','Ph = Pa + Pw',n(l.Phs)+' + '+n(l.Pw)+' kN/m',q(l.Ph,'kN/m')),
      row('โมเมนต์แรงดัน','Mo = Ph·ȳ',n(l.Ph)+' × '+n(l.ybar)+' kN·m/m',q(l.Mo,'kN·m/m')),
      row('ปฏิกิริยาเข็ม Toe','Ptoe = [Rv/N + MCG·aToe/Ix]/cosβToe','Rv '+n(p.RvT)+' tf/m · N '+n(p.Ntot)+' · MCG '+n(p.Mcg)+' tf·m/m · a '+n(p.armT)+' · Ix '+n(p.Ix)+' · β '+n(p.btTdeg)+'°',q(p.axT,'tf/ต้น')),
      row('ปฏิกิริยาเข็ม Heel','Pheel = [Rv/N + MCG·aHeel/Ix]/cosβHeel','Rv '+n(p.RvT)+' tf/m · N '+n(p.Ntot)+' · MCG '+n(p.Mcg)+' tf·m/m · a '+n(p.armH)+' · Ix '+n(p.Ix)+' · β '+n(p.btHdeg)+'°',q(p.axH,'tf/ต้น')));
    rows.push(row('M ใช้งานที่คุม',s.type==='soldier'?'max|BMD FE|':'max(MWinkler, MFrame)',
        'FE '+n(t.springM)+' kN·m'+(t.frameM==null?'':' · Frame '+n(t.frameM)+' kN·m')+' · '+t.governing,q(t.serviceM,'kN·m')),
      row('M ตรวจ','Mตรวจ = γH·Mใช้งาน',n(t.lateralFactor,2)+' × '+n(t.serviceM)+' kN·m',q(p.Mu,'kN·m')),
      row('V ตรวจ','Vตรวจ = γH·Vใช้งาน',n(t.lateralFactor,2)+' × '+n(t.serviceV)+' kN',q(p.Vu,'kN')),
      row('D/C เข็มดัด','Mตรวจ / Mเกณฑ์',n(p.Mu)+' / '+n(p.Mcr)+' kN·m',n(s.checks.find(c=>['PILE MOMENT','PILE โมเมนต์ดัด'].includes(c.key))?.dc)),
      row('D/C เข็มเฉือน','Vตรวจ / Vเกณฑ์',n(p.Vu)+' / '+n(p.Vc)+' kN',n(s.checks.find(c=>['PILE SHEAR','PILE เฉือน (หักปลาย?)'].includes(c.key))?.dc)));
    if(f.unbracedPile){const u=f.unbracedPile;
      rows.push(row('เสาเว้นเสา · D ร่วม','Dauto = max(Dreq,มีสเตย์, Dreq,เข็มยื่น)',n(u.bracedDreq)+'; '+n(u.unbracedDreq)+' m',n(s.geometry.embed)+' m'+(+i.pileEmbS>0?' · กำหนดเอง':' · Auto')),
        row('เข็มเว้น · M ตรวจ','Mตรวจ = γH·max|BMD เข็มยื่น FE|',n(t.lateralFactor,2)+' × '+n(u.serviceM)+' kN·m',q(u.Mu,'kN·m')),
        row('เข็มเว้น · V ตรวจ','Vตรวจ = γH·max|SFD เข็มยื่น FE|',n(t.lateralFactor,2)+' × '+n(u.serviceV)+' kN',q(u.Vu,'kN')),
        row('เข็มเว้น · D/C ดัด / เฉือน','Mตรวจ/Mเกณฑ์; Vตรวจ/Vเกณฑ์',n(u.Mu)+'/'+n(u.Mcr)+'; '+n(u.Vu)+'/'+n(u.Vc),n(u.Mu/u.Mcr)+'; '+n(u.Vu/u.Vc)));
    }
    for(const m of s.reportMembers||[]){
      const wsd=s.equationLedger.method==='wsd',factors=s.equationLedger.factors;
      const unit=m.width?'mm²':'mm²/m';
      rows.push(row(m.name+' · As',wsd?'As = max[M/(fs·j·d), As,min]; j=1−k/3':'Rn=M/(φbd²); As=max[(0.85f′c/fy)(1−√(1−2Rn/0.85f′c))bd, As,min]',
        'M '+n(m.M)+' × 10⁶ N·mm · b '+n((m.width||1)*1000,1)+' · d '+n(m.d*1000,1)+' mm · f′c '+n(i.fc)+' · fy '+n(i.fy)+' MPa'+(wsd?' · fs,j ตามวิธี WSD ของ Engine':' · φ '+n(factors.phib,2)),
        n(m.As,1)+' '+unit+' · '+m.bar+(Number.isFinite(m.provided)?' ('+n(m.provided,1)+' '+unit+')':'')));
    }
    for(const m of s.reportShear||[]){
      const wsd=s.equationLedger.method==='wsd',phi=s.equationLedger.factors.phiv;
      rows.push(row(m.name+' · กำลังเฉือน',wsd?'Vallow = 0.09√f′c·b·d / 1000':'φVc = φv·0.17√f′c·b·d / 1000',
        (wsd?'0.09':n(phi,2)+' × 0.17')+' × √'+n(i.fc)+' × 1000 × '+n(m.d*1000,1)+' / 1000; Vตรวจ '+n(m.V)+' kN/m',q(m.capacity,'kN/m')));
    }
    const tie=s.reportSoldier?.stay;
    if(tie){
      const ap=s.forces.rearAnchor?.pileResistance;
      if(ap)rows.push(row('เข็มสมอ · แรงถอน',ap.projectOverride?'Rallow = กำลังถอนทั้งระบบจากโครงการ':'Rประมาณ = min(α·Su·p·La, Rsection)',
        ap.projectOverride?'ค่าโครงการ '+q(ap.capacity,'kN'):
          n(ap.alpha,2)+' × '+n(ap.su)+' kPa × '+n(ap.perimeter)+' m × '+n(ap.length)+' m = '+q(ap.shaft,'kN')+'; Rsection '+q(ap.section,'kN'),
        q(ap.capacity,'kN')+'; T '+q(ap.demand,'kN')+'; D/C '+n(ap.dc)));
      rows.push(row('สเตย์ · แรงดึง','T = Hหน้า·Lสเตย์/Lb; Tu=γH·T',
        n(p.stay.horizontal)+' × '+n(p.stay.length)+' / '+n(tie.Lb)+' kN; γH '+n(t.lateralFactor,2),q(tie.Tu,'kN')),
        row('สเตย์ · เหล็กดึง','As=max(Asกำลัง, T·1000/fs, Ag·fr/fy)',
          'Asกำลัง '+n(tie.AsStr,1)+' · Asรอยร้าว '+n(tie.AsCk,1)+' · Asแตกร้าว '+n(tie.AsCr,1)+' mm²',n(tie.AsTieReq,1)+' mm²; '+tie.nBr+'-DB'+tie.db+' ('+n(tie.AsTie,1)+' mm²)'),
        row('สเตย์ · รอยร้าว','fs,ใช้งาน = T·1000/As ≤ fs,allow',n(tie.stayAxial)+' × 1000 / '+n(tie.AsTie,1),q(tie.fsSvc,'MPa')+' ≤ '+q(tie.fsAll,'MPa')));
    }
    if(s.reportSoldier?.capBeams.length){
      const rb=s.reportSoldier,b=rb.capBeams[0];
      rows.push(row('RB · แรงคานตามแบบจำลองเดิม','M = γH·Hหน้า·S/10; V = γH·Hหน้า·0.6 (ค่าประมาณคานต่อเนื่อง)',
        'γH '+n(t.lateralFactor,2)+' · Hหน้า '+n(rb.frontHorizontal)+' kN · S '+n(rb.spacing)+' m',q(b.McapU,'kN·m')+'; '+q(b.VuCap,'kN')));
    }
    for(const b of s.reportSoldier?.capBeams||[]){
      const tr=b.flexure,wsd=tr.method==='wsd';
      const d=b.detailing;
      rows.push(row(b.name+' · ความลึกประสิทธิผล','d = h − c − dt − db/2 (ชั้นเดียว)',
        n(d.depth,1)+' − '+n(d.cover,1)+' − '+n(b.linkDb,1)+' − '+n(b.db,1)+'/2 mm',n(b.dCap*1000,1)+' mm'),
        row(b.name+' · ระยะจัดเหล็ก','smin=max(25.4, db, 4dagg/3); bneed=2(c+dt)+n db+(n−1)smin',
          'smin=max(25.4, '+b.db+', 4×'+n(d.aggregate,1)+'/3)='+n(d.clearMin,1)+' mm; bneed=2('
          +n(d.cover,1)+'+'+b.linkDb+')+'+Math.max(b.nTop,b.nBot)+'×'+b.db+'+'
          +(Math.max(b.nTop,b.nBot)-1)+'×'+n(d.clearMin,1)+' mm',
          'bneed '+n(d.requiredWidth,1)+' / b '+n(d.width,1)+' mm · ช่องบน/ล่าง '+n(d.clearTop,1)+'/'+n(d.clearBot,1)+' mm'),
        row(b.name+' · ช่องว่างแนวดิ่ง','Δy=h−2(c+dt+db); hneed=2(c+dt+db)+smin (screen โครงการ)',
          'Δy='+n(d.depth,1)+'−2('+n(d.cover,1)+'+'+b.linkDb+'+'+b.db+') mm; hneed=2('
          +n(d.cover,1)+'+'+b.linkDb+'+'+b.db+')+'+n(d.clearMin,1)+' mm',
          'Δy '+n(d.clearVertical,1)+' ≥ '+n(d.clearMin,1)+' mm · hneed '+n(d.requiredDepth,1)+' mm · '+(d.spacingOK?'ผ่าน':'ไม่ผ่าน')+' screen ชั้นเดียว'),
        row(b.name+' · ขีดจำกัดหน้าตัด',wsd?'Mlim = 0.5·fc,allow·k·j·b·d²/10⁶; k=1/(1+fs/(n·fc,allow))':'Rn=M·10⁶/(φbd²); radicand=1−2Rn/(0.85f′c) ≥0',
        wsd?'fc,allow '+n(tr.fcAllow)+' MPa · n '+n(tr.modularRatio)+' · fs '+n(tr.fsAllow)+' MPa · k '+n(tr.k,4)+' · j '+n(tr.j,4)+' · b '+n(b.bw*1000,1)+' · d '+n(b.dCap*1000,1)+' mm'
          :'φ '+n(tr.phi,2)+' · Rn '+n(tr.Rn,4)+' MPa · f′c '+n(tr.fc)+' MPa · radicand '+n(tr.radicand,4),
        q(tr.limitMoment,'kN·m')+'; '+(tr.sectionOK?'ผ่านขีดจำกัด':'ไม่ผ่านหน้าตัด')),
        row(b.name+' · เหล็กบน/ล่าง',wsd?'AsM=M·10⁶/(fs·j·d); Asmin=(1.4/fy)bd; Asneed=max(AsM,Asmin)':'AsM=(0.85f′c/fy)(1−√radicand)bd; Asmin=(1.4/fy)bd',
          'M '+n(b.McapU)+' kN·m · b '+n(b.bw*1000,1)+' · d '+n(b.dCap*1000,1)+' mm · fy '+n(tr.fy)+' MPa · Asmin '+n(b.AsMin,1)+' mm²',
          (tr.sectionOK?n(b.AsBotReq,1)+' mm²/ด้าน':'หน้าตัดไม่พอ; เหล็กขั้นต่ำเป็นเพียงรายการเบื้องต้น')+' · บน '+b.nTop+'-DB'+b.db+' ('+n(b.AsTop,1)+'); ล่าง '+b.nBot+'-DB'+b.db+' ('+n(b.AsBot,1)+') mm²'),
        row(b.name+' · เฉือน','Vเกณฑ์ = Vc,profile + φv·Av·fy·d/(s·1000) ตาม Engine เดิม',
          n(b.pVc)+' + '+n(s.equationLedger.factors.phiv,2)+' × '+n(b.Av,1)+' × '+n(i.fy)+' × '+n(b.dCap*1000,1)+' / ('+n(b.linkSp,1)+' × 1000) kN; Vตรวจ '+n(b.VuCap)+' kN · '+b.linkBar,q(b.phiVn,'kN')));
    }
    if(a)rows.push(row('กำลัง Ground anchor','Rallow = min(π·D·Lbond·τallow, Rtendon/head)','D '+n(a.bondDiameter)+' m · L '+n(a.bondLength)+' m · τ '+n(a.bondStress)+' kPa · Rtendon '+n(a.tendonCapacity)+' kN',q(a.capacity,'kN')));
    const rear=f.rearAnchor;
    if(rear?.anchors){
      for(const a of rear.anchors)rows.push(row(a.mark+' · ปฏิกิริยาเข็มสมอ','R = −ΣF ที่หัวสมอ; แกน +X เข้าดิน / +Y ขึ้น / +Z ตามแนวกำแพง',
        'F(X,Y,Z) = ('+a.load.map(v=>n(v)).join(', ')+') kN · '+a.stayCount+' คานสเตย์',
        '('+a.reaction.map(v=>u.format(v,'kN',3)).join(', ')+') '+u.label('kN')));
      if(rear.dowel){
        const dw=rear.dowel,wsd=dw.method==='wsd';
        if(dw.mode==='pcwire'){
          const p=dw.assessment.wire;
          rows.push(row('APd · ลวด PC','Aps=nπd²/4; Tscreen=φAps fpc/1000',
            p.count+' × π × '+n(p.diameter,1)+'² / 4 = '+n(p.area,1)+' mm²; '+n(p.phi,2)+' × '+n(p.area,1)+' × '+n(p.stress,1)+' / 1000',
            q(p.capacity,'kN')+' / Tu '+q(p.demand,'kN')+' · '+(dw.assessment.steelScreenOK?'ผ่าน':'ไม่ผ่าน')+'การประมาณกำลังลวด; ยังไม่ตรวจสมอปลาย'));
        }else rows.push(row('APd · As จากแรงถอน',wsd?'As,T = Tservice·1000/fs,allow':'As,T = Tu·1000/(0.90fy)',
          n(dw.designT)+' kN × 1000 / '+n(dw.stressLimitMPa,1)+' MPa',n(dw.AsRequired,1)+' mm²'),
          row('APd · เหล็กขั้นต่ำ','As,min = max(0.005Ag, 4ADB12)',
            'max(0.005 × '+n(dw.grossAreaMM2,1)+', 4 × '+n(dw.minimumBarAreaMM2,1)+') mm²',n(dw.AsMinimum,1)+' mm²'),
          row('APd · พื้นที่เหล็ก','As,need = max(As,T, As,min); As,prov = n·ADB ≥ As,need',
            'max('+n(dw.AsRequired,1)+', '+n(dw.AsMinimum,1)+') = '+n(dw.AsNeeded,1)+' mm²; '+dw.count+' × '+n(dw.barAreaMM2,1)+' = '+n(dw.AsProvided,1)+' mm²',
            dw.spec+' · '+(dw.steelOK?'ผ่านพื้นที่เหล็ก':'ไม่ผ่านพื้นที่เหล็ก')+'; ต้อง ≥ '+dw.autoCount+'-DB'+dw.db));
      }
    }
  }
  return rows;
}

export function nativeEquationTables(s,mode='si'){
  return '<section data-report-stage="equations"><h3>4. สมการและตารางแทนค่า</h3>'
    +'<p class="rw-report-note" data-equation-basis="si">ช่องแทนค่าใช้ SI ตามหน่วยที่ระบุ; สูตรหน้าตัดใช้ N–mm–MPa'
    +(['pile','pilecf'].includes(s.type)?'; ปฏิกิริยากลุ่มเข็มแสดงตัวตั้ง tf ตาม Engine (1 tf = 9.80665 kN)':'')+'. ผลลัพธ์จากการคำนวณชุดเดียวกัน'
    +(mode==='kgf'?' · ผล kgf ใช้ 1 kgf = 9.80665 N':'')+'</p>'
    +mainEquationSections(s,mode).map(group=>'<div class="rw-main-equation-group" data-main-equations="'+esc(group.key)+'"><h4>'+esc(group.title)+'</h4>'
      +workedReportTable(group.rows)+'</div>').join('')+'</section>';
}

/** Choose a worked example for each steel arrangement/face. All arrangements
 * remain in the separate selection table; this never re-designs a member. */
export function governingReportMembers(members){
  const groups=new Map();
  for(const m of members){
    const role=m.name.startsWith('พนัง ')?(m.name.includes('ที่ครีบ')?'พนังที่ครีบ':m.name.includes('กลางช่วง')?'พนังกลางช่วง':'พนัง'):m.name;
    const key=role+'|'+m.bar;
    const prior=groups.get(key);
    if(!prior||!Number.isFinite(m.As)||(Number.isFinite(prior.As)&&m.As>prior.As))groups.set(key,m);
  }
  return [...groups.values()];
}

/** The public calculation book is a load-to-design explanation, not the full
 * internal check ledger. The complete nativeEquationRows stays available to
 * diagnostic consumers. Rows below read only the accepted result. */
export function mainEquationSections(s,mode='si'){
  const all=nativeEquationRows(s,mode),find=name=>all.find(r=>r[0]===name),i=s.input;
  const groups=[],add=(key,title,rows)=>{rows=rows.filter(Boolean);if(rows.length)groups.push({key,title,rows});};
  const q=(v,unit)=>resultUnits(mode).quantity(v,unit,3);
  if(s.type==='duckfoot'){
    add('actions','4.1 แรงคุมจากกราฟและแรงกดใต้ฐาน',
      ['P โคนเสา '+(s.equilibrium.index+1),'M ตรวจคาน','V ตรวจคาน','e ฐานคุม','qmax ใช้งาน'].map(find));
    const c=s.column;
    add('column','4.2 เสา · แรงอัดร่วมโมเมนต์และเหล็กที่เลือก',[
      row('เสาต้น '+(c.index+1)+' · '+c.combination,'(Pu, Mu) ≤ กำลัง P–M ของเหล็กที่เลือก',
        'Pu '+n(c.P)+' kN; Mu '+n(c.M)+' kN·m; φPn,max '+n(c.capacityP)+' kN; φMn(Pu) '+n(c.capacityM)+' kN·m',
        c.label+' · As '+n(c.As,1)+' mm² · D/C '+n(c.dc)),
    ]);
    for(const [key,title,bar,M,b,h,mesh]of [
      ['beam','4.3 คานเหนือฐาน · เหล็กดัดและแรงเฉือน',s.beamDesign,s.beamDesign.M,i.beamB,i.beamH,false],
      ...s.footing?[['footing-x','4.4 ฐาน X · เหล็กดัดและแรงเฉือน',s.footing.barX,s.footing.Mx,1,i.hz,true],
                   ['footing-y','4.5 ฐาน Y · เหล็กดัดและแรงเฉือน',s.footing.barY,s.footing.My,1,i.hz,true]]:[],
    ]){
      const bb=b*1000,dd=bar.d*1000;
      const min=mesh?'0.0018 × '+n(bb,1)+' × '+n(h*1000,1):'max(0.25√'+n(i.fc)+'/'+n(i.fy)+', 1.4/'+n(i.fy)+') × '+n(bb,1)+' × '+n(dd,1);
      add(key,title,[row('As · '+(mesh?'ฐาน '+(key.endsWith('x')?'X':'Y'):'คาน'),
        'As = max[(0.85f′c/fy)(1−√(1−2Mu·10⁶/(0.9bd²·0.85f′c)))bd, As,min]',
        '(0.85×'+n(i.fc)+'/'+n(i.fy)+') × [1−√(1−2×'+n(M)+'×10⁶/(0.9×'+n(bb,1)+'×'+n(dd,1)+'²×0.85×'+n(i.fc)+'))] × '+n(bb,1)+' × '+n(dd,1)+'; As,min='+min,
        n(bar.AsReq,1)+' mm²'+(mesh?'/m':'')+' → '+bar.label+'; As,ใช้ '+n(bar.AsProv,1)),
        find(mesh?'ฐาน '+(key.endsWith('x')?'X':'Y')+' · กำลังดัด':'กำลังดัดคาน'),
        find(mesh?'ฐาน '+(key.endsWith('x')?'X':'Y')+' · เฉือน':'กำลังเฉือนคาน')]);
    }
    if(s.footing)add('punch','4.6 ฐานขอบเขต · เจาะทะลุ',[find('เจาะทะลุ')]);
  }else{
    add('actions','4.1 แรงดันดินและแรงออกแบบที่คุม',[
      find('Ka'),find('pa ที่ระดับขุด'),find('แรงดันรวม'),find('โมเมนต์แรงดัน'),
      find('ปฏิกิริยาเข็ม Toe'),find('ปฏิกิริยาเข็ม Heel'),find('M ใช้งานที่คุม'),find('M ตรวจ'),find('V ตรวจ')]);
    if(s.forces.unbracedPile)add('alternate-pile','เข็มที่เว้นสเตย์ · เข็มยื่นอิสระ',[
      find('เสาเว้นเสา · D ร่วม'),find('เข็มเว้น · M ตรวจ'),find('เข็มเว้น · V ตรวจ'),find('เข็มเว้น · D/C ดัด / เฉือน')]);
    if(s.reportMembers?.length){
      add('rc','4.2 พนัง / ครีบ / ฐาน · เหล็กดัดจากแรงที่คุม',
        governingReportMembers(s.reportMembers).map(m=>{
          const r=[...find(m.name+' · As')];
          if(s.equationLedger.method!=='wsd'){
            const bb=(m.width||1)*1000,dd=m.d*1000,phi=s.equationLedger.factors.phib;
            r[2]='(0.85×'+n(i.fc)+'/'+n(i.fy)+') × [1−√(1−2×'+n(m.M)+'×10⁶/('+n(phi,2)+'×'+n(bb,1)+'×'+n(dd,1)+'²×0.85×'+n(i.fc)+'))] × '+n(bb,1)+' × '+n(dd,1)+'; ใช้ไม่น้อยกว่า As,min ตามโปรไฟล์';
          }
          return r;
        }));
      add('shear','4.3 พนัง / ฐาน · กำลังเฉือน',(s.reportShear||[]).map(m=>find(m.name+' · กำลังเฉือน')));
    }
    const tie=s.reportSoldier?.stay;
    if(tie){
      const wsd=s.equationLedger.method==='wsd';
      add('stay','4.2 สเตย์ · แรงดึงและเหล็กที่เลือก',[find('สเตย์ · แรงดึง'),
        row('สเตย์ · As','As = max(Asกำลัง, Asรอยร้าว, Ag·fr/fy)',
          (wsd?n(tie.stayAxial)+'×1000/'+n(tie.fsAll):n(tie.Tu)+'×1000/(0.90×'+n(i.fy)+')')
          +' = '+n(tie.AsStr,1)+'; '+n(tie.stayAxial)+'×1000/'+n(tie.fsAll)+' = '+n(tie.AsCk,1)
          +'; '+n(tie.Ag,1)+'×'+n(tie.fr)+'/'+n(i.fy)+' = '+n(tie.AsCr,1)+' mm²',
          n(tie.AsTieReq,1)+' mm² → '+tie.nBr+'-DB'+tie.db+'; As,ใช้ '+n(tie.AsTie,1)+' mm²')]);
      if(s.forces.rearAnchor?.pileResistance)add('rear-uplift','4.2 เข็มสมอ · แรงถอนและที่มาของกำลัง',[find('เข็มสมอ · แรงถอน')]);
    }
    const rb=s.reportSoldier;
    if(rb?.lag){
      const l=rb.lag;
      add('lagging','แผ่นเสียบ · แรงดัดและแรงเฉือนต่อความสูง 1 ม.',[
        row('แผ่นเสียบ · Mu','Mu = wu·Lสุทธิ²/8',n(l.wuLag)+' × '+n(l.lagSpanCl)+'² / 8',q(l.MuLagM,'kN·m/m')),
        row('แผ่นเสียบ · Vu','Vu = wu·Lสุทธิ/2',n(l.wuLag)+' × '+n(l.lagSpanCl)+' / 2',q(l.VuLagM,'kN/m'))]);
    }
    if(rb?.capBeams.length){
      add('rb-actions','4.3 คานหน้า RB · แรงตามแนวกำแพง',[find('RB · แรงคานตามแบบจำลองเดิม')]);
      const equivalent=new Map();
      for(const b of rb.capBeams){
        const signature=JSON.stringify([b.bw,b.bh,b.dCap,b.McapU,b.VuCap,b.AsMin,b.AsBotReq,b.AsTopReq,b.AsTop,b.AsBot,b.nTop,b.nBot,b.db,b.pVc,b.phiVn,b.Av,b.linkDb,b.linkSp,b.flexure]);
        const entry=equivalent.get(signature);
        if(entry)entry.marks.push(b.name);else equivalent.set(signature,{b,marks:[b.name]});
      }
      for(const {b,marks}of equivalent.values()){
        const tr=b.flexure,wsd=tr.method==='wsd',bb=b.bw*1000,dd=b.dCap*1000;
        const label=marks.join(' / '),shear=[...find(b.name+' · เฉือน')];shear[0]=label+' · เฉือน';
        add(marks.join('-'),label+' · ออกแบบเหล็กบน/ล่างและแรงเฉือน',[
          row(label+' · As',wsd?'As = max[M·10⁶/(fs·j·d), (1.4/fy)bd]':'As = max[(0.85f′c/fy)(1−√(1−2M·10⁶/(φbd²·0.85f′c)))bd, (1.4/fy)bd]',
            (wsd?n(b.McapU)+'×10⁶/('+n(tr.fsAllow)+'×'+n(tr.j,4)+'×'+n(dd,1)+')':
              '(0.85×'+n(tr.fc)+'/'+n(tr.fy)+') × [1−√(1−2×'+n(b.McapU)+'×10⁶/('+n(tr.phi,2)+'×'+n(bb,1)+'×'+n(dd,1)+'²×0.85×'+n(tr.fc)+'))] × '+n(bb,1)+' × '+n(dd,1))
            +'; As,min=(1.4/'+n(tr.fy)+')×'+n(bb,1)+'×'+n(dd,1)+' = '+n(b.AsMin,1)+' mm²',
            (tr.sectionOK?n(b.AsBotReq,1)+' mm²/ด้าน':'หน้าตัดไม่พอ')+' → บน '+b.nTop+' / ล่าง '+b.nBot+'-DB'+b.db+'; '+b.linkBar),
          shear]);
      }
    }
    if(s.geometry.anchor)add('anchor','4.4 Ground anchor · กำลังยอมให้',[find('กำลัง Ground anchor')]);
    const dw=s.forces.rearAnchor?.dowel;
    if(dw)add('dowel',dw.mode==='pcwire'?'4.4 ลวด PC · กำลังลวดและสมอปลาย':'4.4 เหล็กเดือยหล่อพร้อมกัน · พื้นที่เหล็ก',dw.mode==='pcwire'
      ?[find('APd · ลวด PC')]:[find('APd · As จากแรงถอน'),find('APd · พื้นที่เหล็ก')]);
  }
  return groups;
}

/** Keep governing primary checks and every failed original row. Passed repeated
 * support/column cases collapse to their largest original D/C; no rechecking. */
export function essentialCheckRows(checks){
  const groups=new Map(),failed=checks.filter(c=>!c.ok);
  for(const c of checks.filter(c=>c.ok)){
    if(/point spring|ระยะจัดเหล็ก|จัดเหล็ก|ทิศแรงดึง|เสถียรภาพ|second order|ปลายของอ|ฝังยึด|^ECCENTRICITY|^REBAR/.test(c.key))continue;
    const key=c.key.replace(/ · (แรงอัดสูง|แรงอัดต่ำ).*$/,'');
    const previous=groups.get(key);
    if(!previous||(Number(c.dc)||0)>(Number(previous.dc)||0))groups.set(key,c);
  }
  const selected=new Set([...groups.values(),...failed]);
  return checks.filter(c=>selected.has(c));
}
export function reportScope(s,mode='si'){
  const l=s.equationLedger,notes=[...new Set(l.components.map(c=>c.note).filter(Boolean))];
  return '<section class="rw-report-scope print-keep"><h3>ขอบเขตผลคำนวณ</h3><p>'
    +esc(l.label)+' · ผ่านเฉพาะรายการที่แสดงในตาราง D/C · NOT FOR CONSTRUCTION</p>'
    +'<p>'+notes.map(esc).join(' · ')+'</p>'
    +s.checks.filter(c=>!c.ok&&c.fix).map(c=>'<p class="rw-report-fix">'+esc(c.key)+' · '+esc(displayEngineText(c.fix,mode))+'</p>').join('')+'</section>';
}
