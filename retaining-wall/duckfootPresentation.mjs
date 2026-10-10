import {resultUnits,displayedChecks} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=(v,n=2)=>Number.isFinite(v)?v.toFixed(n):'—';
const eq=(title,body)=>'<section class="print-keep"><h3>'+esc(title)+'</h3><div class="equation">'+body+'</div></section>';
const table=(heads,rows)=>'<div class="table-wrap"><table><thead><tr>'+heads.map(h=>'<th>'+esc(h)+'</th>').join('')
  +'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(c=>'<td>'+esc(c)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';

export function duckChecks(s,mode='si'){
  const labels={t:'เสากว้าง',colDepth:'เสาลึก',B:'ฐานกว้าง',capL:'ฐานยาว',hz:'ฐานหนา',beamB:'คานกว้าง',beamH:'คานลึก'};
  const advice=s.recommendation?.changes.length?'<section class="print-keep"><h3>ขนาดที่ทดลองแล้วผ่านทุกเกณฑ์</h3><p>'
    +s.recommendation.changes.map(c=>esc(labels[c.key])+': '+f(c.from)+' → <b>'+f(c.to)+' ม.</b>').join(' · ')
    +'</p><p>ต้องใช้การเปลี่ยนแปลงชุดนี้ร่วมกัน แล้วกดคำนวณใหม่ · ทดลอง '+s.recommendation.trials+' ชุด</p></section>':'';
  return '<h2>ผลตรวจเสา ฐาน และคาน · '+(s.status==='PASS'?'ผ่าน':'ไม่ผ่าน')+'</h2>'
    +advice+table(['รายการ','ค่าที่ได้','เกณฑ์','D/C','ผล'],displayedChecks(s,mode).map(c=>[c.key,c.value,c.criterion,f(c.dc),c.ok?'ผ่าน':'ไม่ผ่าน · '+c.fix]));
}
export function duckBars(s){
  return '<h2>เหล็กที่เลือกจากแรงออกแบบ</h2><p>กำลังหน้าตัด ACI 318-14 · ค่าที่ไม่ผ่านให้ปรับขนาดแล้วคำนวณใหม่</p>'
    +table(['มาร์ค','ตำแหน่ง','เหล็ก','รายละเอียด'],s.bbs.map(b=>[b.mark,b.position,b.size,b.detail]));
}
export function duckDesignEquations(s,mode='si'){
  const u=resultUnits(mode),q=(v,unit,n=2)=>u.format(v,unit,n),l=unit=>u.label(unit);
  const capacity=(v,unit,n=2)=>f(v,n)+' '+unit+(mode==='kgf'?' = '+u.quantity(v,unit,n):'');
  const siBasis=mode==='kgf'?'<p class="legend" data-equation-basis="si">สูตรกำลังหน้าตัดและ second order ใช้ค่าคงที่ SI ตามโปรไฟล์; ขั้นที่ระบุ kN/MPa คงหน่วยสูตรเดิม แล้วแปลงผลเป็น kgf/ kgf·m/ kgf/cm² แยกชัดเจน ใช้ค่า D/C ก่อนปัดเศษ</p>':'';
  const i=s.input,e=s.equilibrium,c=s.column,b=s.beamDesign,p=s.footing;
  let html='<p><b>ACI 318-14 สำหรับกำลังหน้าตัด</b> · γD = '+f(i.factorN)+', γL = '+f(i.factorL)+' และ γH = '+f(i.factorH)
    +' เป็นตัวคูณแรงโครงการที่กรอก; ตรวจ γD D+γL L และ 0.9D+0L ร่วมกับแรงราบ/โมเมนต์ที่คูณ γH; โหลดเท่ากันทุกเสาและทุกช่วงคาน</p>'
    +eq('1. น้ำหนักและแรงเสา','Wเสา = t×d×H×γc = '+f(i.t)+'×'+f(i.colDepth)+'×'+f(i.hp)+'×'+q(i.gc,'kN/m³')+' = '+q(e.wCol,'kN',3)+(' ' + l('kN'))
      +'<br>Wฐาน = B×L×h×γc = '+f(i.B)+'×'+f(i.capL)+'×'+f(i.hz)+'×'+q(i.gc,'kN/m³')+' = '+q(e.wCap,'kN',3)+(' ' + l('kN'))
      +'<br>Nยอด=ND+NL = '+q(i.NpostD,'kN')+' + '+q(i.NpostL,'kN')+' = '+q(i.Npost,'kN')+(' ' + l('kN') + ' (ไม่รวมน้ำหนักเสา/คาน/ฐาน)')
      +'<br>Pโคนเสา '+(e.index+1)+' = N + Wเสา + Rคาน = '+q(i.Npost,'kN')+' + '+q(e.wCol,'kN',3)+' + '+q(e.beamReaction,'kN',3)+' = '+q(e.columnP,'kN',3)+(' ' + l('kN'))
      +'<br>PD=ND+Wเสา+RD; PL=NL+RL; Pu=γD PD+γL PL (กรณีแรงอัดต่ำใช้ 0.9PD+0PL)'
      +'<br>M₁ = Mยอด + Hยอด×Hเสา = '+q(i.Mpost,'kN·m')+' + '+q(i.Hpost,'kN')+'×'+f(i.hp)+' = '+q(e.columnM,'kN·m')+(' ' + l('kN·m'))
      +'<br>Mโคนเสารวม second order ที่ใช้หาดินรับแรง = '+q(e.baseM,'kN·m')+(' ' + l('kN·m')))
    +eq('2. คานเชื่อมเสาเหนือ footing','ผิวบน footing = 0; ท้องคาน c = '+f(i.beamClear)+' m; หลังคาน c+hb = '+f(s.geometry.beamTop)+' m'
      +'<br>แกนคาน a = c+hb/2 = '+f(i.beamClear)+' + '+f(i.beamH)+'/2 = '+f(s.geometry.beamAxis,3)+' m'
      +'<br>[K]{θ}={Fθ}; v=0 ที่จุดต่อเสาทุกต้น · สมดุลโมเมนต์ที่จุดต่อ · ไม่คิดดินรับคาน'
      +'<br>wคานเต็ม = b×h×γc = '+f(i.beamB)+'×'+f(i.beamH)+'×'+q(i.gc,'kN/m³')+' = '+q(s.beam.w,'kN/m',3)+(' ' + l('kN/m'))
      +'<br>wส่วนซ้อนเสา = min(t,b)×h×γc = '+f(Math.min(i.t,i.beamB))+'×'+f(i.beamH)+'×'+q(i.gc,'kN/m³')+' = '+q(s.beam.overlapW,'kN/m',3)+(' ' + l('kN/m'))
      +'<br>หักส่วนซ้อนเสารวม '+f(s.beam.overlapLength)+' m; คานอยู่เหนือฐาน จึงไม่หักช่วงเหนือ footing'
      +'<br>น้ำหนักคานช่วงพ้นหน้าเสาเข้าแบบจำลองคาน; ส่วนคานกว้างพ้นเสาที่รอยต่อรวม '+q(s.beam.jointWeights.reduce((a,b)=>a+b,0),'kN',3)+(' ' + l('kN') + ' ลงเสานั้นโดยตรง')+(s.beam.w>s.beam.overlapW?' ที่ x = '+f(s.beam.jointX,3)+' m':'')
      +'<br>q เพิ่ม = '+q(i.qBeam,'kN/m')+(' ' + l('kN/m') + '; ΣR = (n−1)[(w+q)S−wซ้อน×dc] = ')+(i.nPosts-1)+'×[('+q(s.beam.w,'kN/m',3)+'+'+q(i.qBeam,'kN/m')+')×'+f(i.postSpacing)+'−'+q(s.beam.overlapW,'kN/m',3)+'×'+f(i.colDepth)+'] = '+q(s.beam.totalLoad,'kN',3)+(' ' + l('kN'))
      +'<br>โมเมนต์จากคานเข้าเสา J = Tคาน−Rคาน×t/2; Tคาน คือผลรวมแรงคาน×ระยะจากแนวเขต โดยหักส่วนซ้อนเสาที่ตำแหน่งจริง'
      +'<br>qเพิ่ม,D='+q(i.qBeamD,'kN/m')+', qเพิ่ม,L='+q(i.qBeamL,'kN/m')+(' ' + l('kN/m') + '; qเพิ่ม,u=γD qD+γL qL=')+q(i.factorN*i.qBeamD+i.factorL*i.qBeamL,'kN/m')+(' ' + l('kN/m'))
      +'<br>แก้คานด้วยน้ำหนักตัวเอง×γD และ qเพิ่ม,u: Mตรวจ=max|Mu(x)| = '+q(b.M,'kN·m')+(' ' + l('kN·m') + '; Vตรวจ=max|Vu(x)| = ')+q(b.V,'kN')+(' ' + l('kN')))
    +'<h3>3. สมดุลและแรงกดทุกฐาน</h3><p>Pโคนเสา รวม Rคานแล้ว; V = Pโคนเสา + Wฐาน; Mขอบเขต = Pโคนเสา×t/2 + Wฐาน×B/2 + Mโคนเสารวม second order'
    +'<br>xR=M/V; e=xR−B/2; |e|≤B/6: q=V/(BL)(1±6e/B); กรณีสัมผัสบางส่วน a=3min(xR,B−xR), qmax=2V/(aL)</p>'
    +table(['เสา',('RD / RL ' + l('kN')),('JD / JL ' + l('kN·m')),('PD / PL ' + l('kN'))],s.pads.map(p=>[p.index+1,
      q(s.beamDead.reactions[p.index],'kN',3)+' / '+q(s.beamLive.reactions[p.index],'kN',3),
      q(p.beamCoupleD,'kN·m',3)+' / '+q(p.beamCoupleL,'kN·m',3),q(p.columnPD,'kN',3)+' / '+q(p.columnPL,'kN',3)]))
    +table(['ฐาน',('V ' + l('kN')),('M ' + l('kN·m')),'xR m',('qขอบ ' + l('kPa')),('qใน ' + l('kPa'))],s.pads.map(p=>[p.index+1,q(p.totalV,'kN',3),q(p.totalM,'kN·m',3),f(p.xResultant,3),q(p.qBoundary,'kPa'),q(p.qInside,'kPa')]))
    +siBasis+eq('4. เสา P–M และความชะลูด','Aₛ = '+c.n+'×π×'+c.db+'²/4 = '+f(c.As,1)+' mm² · '+esc(c.label)
      +'<br>εs=0.003(c−y)/c; fs=จำกัด Esεs ที่ ±fy; a=β₁c'
      +'<br>Pn=0.85f′c·b·a+Σ(fs−0.85f′c สำหรับเหล็กใน block)As'
      +'<br>Mn=ΣF×แขนจากศูนย์หน้าตัด; φ=0.65–0.90 ตาม εt; φPmax=0.80×0.65[0.85f′c(Ag−As)+fyAs]'
      +'<br>EI=0.2EcIg = '+capacity(c.EI,'kN·m²')+ '; Pcr=π²EI/(2H)² = '+capacity(c.Pcr,'kN')+ ''
      +'<br>k=√(P/EI); Mโคน=[Mยอด+Vยอด sin(kH)/k+J cos(k(H−a))]/cos(kH)'
      +'<br>M(z)=Mโคน cos(kz)−Vยอด sin(kz)/k−J cos(k(z−a)) เมื่อ z≥a; ก่อนถึงคานไม่หักพจน์ J'
      +'<br>ที่ P=0 ใช้ขีดจำกัด Mโคน=Mยอด+VยอดH+J; ความยาวโก่งเดาะยังเป็น 2H ไม่ลดเพราะคานตามแนวเขต'
      +'<br>ใช้ max|M(z)| และโมเมนต์ขั้นต่ำเทียบ P–M ครบทุกเสา/กรณีแรง; ส่ง Mโคนชุดเดียวกันลงฐาน'
      +'<br>โมเมนต์ขั้นต่ำสำหรับตรวจหน้าตัดเสา Mmin=P(0.015+0.03t) · ACI 318-14 §6.6.4.5.4'
      +'<br>ตรวจ Pcr ของแกนอ่อน; จำกัด sec(kH)≤1.40 ตามขอบเขต second order ACI 318-14 §6.2.6')
    +table(['กรณี','P ('+l('kN')+')','δ','M₂ ('+l('kN·m')+')','φMn ที่ P ('+l('kN·m')+')','D/C'],c.cases.map(c=>[c.name,q(c.P,'kN'),f(c.magnifier,3),q(c.M,'kN·m'),q(c.capacityM,'kN·m'),f(c.dc)]))
    +eq('5. สมการเลือกเหล็กดัด','Rₙ=Mᵤ/(φbd²); As,req=(0.85f′c/fy)[1−√(1−2Rₙ/(0.85f′c))]bd'
      +'<br>เลือกเหล็กให้ As,prov≥max(As,req,As,min); a=Asfy/(0.85f′c b); φMn=0.9Asfy(d−a/2) และ εt≥0.005'
      +'<br>คาน: d='+f(b.d,3)+' m, As,req='+f(b.AsReq,1)+' mm², As,prov='+f(b.AsProv,1)+' mm²'
      +', a='+f(b.a,3)+' m → φMn='+capacity(b.capacity,'kN·m')+ '; '+esc(b.label)
      +'<br>φVc=0.75×0.17√f′c·b·d = '+capacity(b.vc,'kN')+ '; φVs=0.75Avfy,ปลอก d/s'
      +'<br>φVn จำกัดด้วย φVmax = '+capacity(b.capacityV,'kN')+ ' · RB10@'+b.linkS+' · fy ปลอก 235 MPa');
  if(p){
    html+=eq('6. ฐาน: ดัดและเฉือนสองทิศ','ทิศ X: M(x)=∫qสุทธิ(s)(x−s)ds; V(x)=∫qสุทธิ(s)ds ตามแรงดันเชิงเส้น/สามเหลี่ยม'
      +'<br>Mx='+capacity(p.Mx,'kN·m/m')+ '; dX='+f(p.barX.d,3)+' m; As,req='+f(p.barX.AsReq,1)+' mm²/m → '+esc(p.barX.label)
      +'<br>ทิศ Y ใช้ซองแรงดันสูงสุด: My=(qmax−γDγc h)ℓ²/2 = '+capacity(p.My,'kN·m/m')+ ''
      +'; dY='+f(p.barY.d,3)+' m; As,req='+f(p.barY.AsReq,1)+' mm²/m → '+esc(p.barY.label)
      +'<br>เฉือนที่ระยะ d: Vx='+q(p.Vx,'kN/m')+' ≤ '+u.quantity(p.vcX,'kN/m')
      +'; Vy='+q(p.Vy,'kN/m')+' ≤ '+u.quantity(p.vcY,'kN/m'))
      +eq('7. เจาะทะลุที่ขอบฐานรวมโมเมนต์','เส้นวิกฤตสามด้านที่ d/2 จากเสา: d='+f(p.punch.d,3)+' m; b₀='+f(p.punch.b0,3)+' m'
        +'<br>v=|V|/(b₀d)+|M|·c/J = '+f(p.punch.V)+'/( '+f(p.punch.b0,3)+'×'+f(p.punch.d,3)+'×1000 )'
        +' + พจน์โมเมนต์ '+f(p.punch.M)+' kN·m → '+capacity(p.punch.stress,'MPa',3)+ ''
        +'<br>φvc=0.75min[0.17(1+2/β),0.083(2+30d/b₀),0.33]√f′c = '+capacity(p.punch.capacity,'MPa',3)+ ''
        +'<br>V และ M เป็นแรงสุทธิหลังหักดินภายในเส้นวิกฤต; คิดโมเมนต์ถ่ายด้วยแรงเฉือนเต็ม γv=1 · ACI 318-14 §22.6.5.2');
  }else html+='<p class="fail-row">แรงลัพธ์ประลัยอยู่นอกฐาน ไม่เกิดสมดุลแรงกด จึงไม่มีแรงออกแบบเหล็กฐานที่ใช้ได้</p>';
  html+=eq('8. รายละเอียดและสมมติฐาน','ldh=max(0.24fy/√f′c·db,8db,150 mm) = '+f(c.anchor.required,3)+' m'
    +'; ระยะฝัง h−ระยะหุ้ม−เหล็กฐานสองทิศ−ช่องว่าง 25 mm = '+f(c.anchor.available,3)+' m; ปลายงอ 12db = '+f(c.anchor.hook,3)+' m'
    +'<br>โก่งคานแบบซองแรงใช้งาน δ=5wL⁴/(384EIeff) = '+f(b.deflection,3)+' mm; เกณฑ์ L/360'
    +'<br>'+s.assumptions.map(esc).join('<br>'));
  return html;
}

export function duckForceFigures(s,graph,mode='si',{essential=false}={}){
  const u=resultUnits(mode);
  const pair=(title,grid,xKey,vKey,mKey,length,support,units=['kN','kN·m'])=>'<section class="print-keep"><h3>'+esc(title)+'</h3><div class="diagram-grid">'
    +'<figure><figcaption>SFD · '+esc(u.label(units[0]))+'</figcaption>'+graph(grid.map(p=>p[vKey]),'SFD '+title,units[0],
      {...support,xValues:grid.map(p=>p[xKey]),length})+'</figure><figure><figcaption>BMD · '+esc(u.label(units[1]))+'</figcaption>'
    +graph(grid.map(p=>p[mKey]),'BMD '+title,units[1],{...support,xValues:grid.map(p=>p[xKey]),length})+'</figure></div></section>';
  let html=pair('เสา '+(s.equilibrium.index+1)+' · แรงใช้งาน',s.equilibrium.columnDiagram,'z','v','m',s.input.hp,{at:0,kind:'column-pad-joint',label:'ผิวบนฐาน',axis:'สูงจากผิวบนฐาน'});
  html+='<p>จุดต่อคานที่ a='+f(s.geometry.beamAxis,3)+' m เหนือ footing; โมเมนต์กระโดด J='+u.format(s.equilibrium.beamCouple,'kN·m',3)+' '+u.label('kN·m')+' · คานไม่เป็นจุดค้ำยันด้านข้าง</p>';
  const spans=essential?[...new Set(['M','V'].map(key=>s.beam.spans.reduce((best,span)=>
    Math.max(...span.grid.map(p=>Math.abs(p[key])))>Math.max(...best.grid.map(p=>Math.abs(p[key])))?span:best)))]:s.beam.spans;
  for(const span of spans)html+=pair('คานช่วง '+(span.index+1)+' · แรงใช้งาน'+(essential?' · ช่วงที่คุม':''),span.grid,'x','V','M',span.L,
    {at:0,atEnd:1,kind:'beam-column-support',label:'เสารับคาน',axis:'ระยะจากเสาต้นช่วง'});
  if(s.footing)html+=pair('ฐานทิศ X ต่อเมตร · แรงออกแบบ',s.footing.diagram,'x','V','M',s.input.B-s.input.t,
    {at:1,kind:'column-pad-face',label:'หน้าเสา',axis:'ระยะตามฐานทิศ X'},['kN/m','kN·m/m']);
  return html;
}
