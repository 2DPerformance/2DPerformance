/** Read-only engineering provenance. No resistance, force or verdict calculation. */
import {DESIGN_PROFILES} from './engine.mjs?rwv=20261003-final-acceptance-1';

const freeze=value=>{
  if(value&&typeof value==='object') {Object.values(value).forEach(freeze);Object.freeze(value);}
  return value;
};
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const EQUATION_LEDGER_VERSION='rw01-equation-ledger/1';
export const LEDGER_SOURCES=freeze({
  thai:{title:'กฎกระทรวงการออกแบบโครงสร้างอาคาร พ.ศ.2566',edition:'2566 / 6 กันยายน 2023',
    url:'https://ratchakitcha.soc.go.th/documents/140A054N0000000000400.pdf',
    evidence:'ตรวจต้นฉบับข้อ 6(1),(4), 7(1),(4) และข้อ 8 ตารางหน้า 9',verified:'load-and-resistance-factors'},
  foundation:{title:'กฎกระทรวงฐานรากของอาคารและพื้นดิน พ.ศ.2566',edition:'2566 / 31 สิงหาคม 2023',
    url:'https://ratchakitcha.soc.go.th/documents/140A053N0000000000900.pdf',
    evidence:'เกณฑ์ฐานราก/กำแพงกันดิน; ต้องใช้ร่วมกับข้อมูลสำรวจและการทดสอบ',verified:'source-document'},
  aci:{title:'ACI 318-14 — Transition Key 318-11 to 318-14',edition:'ACI 318-14',
    url:'https://www.concrete.org/Portals/0/Files/PDF/318-14_CrossReference_2011to2014.pdf',
    evidence:'ยืนยันเลขข้อ 5.3.8, 21.2, 22.2, 22.5, 25.4; ตารางนี้ไม่แทนตัวเล่มข้อกำหนด',verified:'clause-locator-only'},
  soil:{title:'FHWA NHI-06-089 — Soils and Foundations, Volume II',edition:'December 2006',
    url:'https://www.fhwa.dot.gov/engineering/geotech/pubs/nhi06089.pdf',
    evidence:'§8.4.3.1 — eccentric loading; §10.2.2–10.2.4 — active/passive pressure, cohesion and wall friction',verified:'geotechnical-method'},
  anchor:{title:'FHWA-IF-99-015 — Ground Anchors and Anchored Systems',edition:'June 1999',
    url:'https://www.fhwa.dot.gov/engineering/geotech/pubs/if99015.pdf',
    evidence:'Chapter 5 — earth pressure, anchors and wall components; capacity requires project data',verified:'system-method'},
  drivenPile:{title:'FHWA GEC12 — Design and Construction of Driven Pile Foundations, Volume I',edition:'NHI-16-009 / 2016',
    url:'https://www.fhwa.dot.gov/engineering/geotech/pubs/gec12/nhi16009_v1.pdf',
    evidence:'Chapter 7 — cohesive-soil shaft resistance: fs=αSu; sum along embedded pile. Alpha and allowable resistance require project geotechnical data.',verified:'shaft-resistance-method'},
});

const equation=(id,title,formula,owner,reference,assumption)=>({id,title,formula,owner,reference,assumption});
function equationsFor(type,method,input) {
  const rows=[];
  if(type!=='duckfoot') rows.push(
    equation('surface','น้ำหนักบนผิวดิน','q = qD + qL; σh,q = Ka·q',
      'loadInput.normalizeSurchargeInput → engine.calc/calcSoldier','FHWA NHI-06-089, Chapter 10',
      'DL/LL เป็นแรงกระจายที่ผิวดิน; ไม่ใช่แรงจุดหรือแรงแนวนอนที่หัวกำแพง'),
    equation('earth','แรงดันดิน',type==='gravity'?'Ka = Coulomb(φ, δ, θ, β)':'Ka = Rankine(φ, β); β = 0: tan²(45° − φ/2)',
      'engine.kaRankine / kaCoulomb → calc/calcSoldier','FHWA NHI-06-089 §10.2.2–10.2.4',
      'ใช้ active earth pressure ตามดิน/น้ำ/ความลาดที่กรอก; seismic ใช้โดเมน Mononobe–Okabe ของ Engine'),
    equation('diagram','แรงเฉือนและโมเมนต์','V(z) = ∫p(z)dz; M(z) = ∫p(z)·arm(z)dz',
      type==='soldier'?'engine.pileDisp / soldierFrame':'engine.calc / toeStripActions / pileWallFrame',
      'สมดุลแรงและโมเมนต์; SFD/BMD จากผล Engine','อ่านเครื่องหมาย พิกัด และระดับ service/factored บนกราฟแต่ละสมาชิก'));
  else rows.push(
    equation('beam','คานต่อเนื่องตามแนวเสา','K·θ = F; ΣR = ΣwL; dM/dx = V; dV/dx = −w',
      'duckfootEngine.duckBeam / solveBeamLine','สมดุลแรงและโมเมนต์ / linear beam FE',
      'เสาอยู่ระนาบเดียวกัน; คานอยู่เหนือ footing ไม่รับแรงจากดิน; ช่วง/แรงรายเสาเท่ากันตามแบบจำลอง'),
    equation('column','เสาชิดเขต','P–M จาก strain compatibility; M รวมผล second order',
      'duckfootEngine.duckColumnActions / duckColumnCurve','ACI 318-14 Chapters 6, 21, 22 — applicability review retained',
      'ใช้ EI ลดรูปของ Engine และตัวคูณโครงการที่กรอก; ไม่สร้าง statutory load envelope อัตโนมัติ'));
  if(type!=='soldier') rows.push(
    method==='wsd'
      ? equation('flexure','ดัด WSD','fc,allow = 0.45f′c; n = max(Es/Ec, 6); j = 1 − k/3; As = M/(fs·j·d)',
        'engine.asReqWSD / fsAllowWSD','สูตร WSD ที่สืบทอดใน Engine; clause ของกำลังยอมให้ยังต้องทวนตัวเล่ม',
        'M เป็นโมเมนต์ใช้งาน; ไม่ใช้ φ หรือ Whitney ultimate stress block เป็นสูตร WSD')
      : equation('flexure','ดัด คสล.','a = As·fy/(0.85f′c·b); φMn = φb·As·fy·(d − a/2)',
        type==='duckfoot'?'duckfootEngine.flexural':'engine.asReq / designFlexuralBar',
        'ACI 318-14 §22.2; φ/strain §21.2; full applicability review retained',
        'N–mm–MPa; แปลง M จาก kN·m ก่อนแทนค่า; φ ของไทยมาจากกฎกระทรวง ไม่ใช่ ACI'),
    method==='wsd'
      ? equation('shear','เฉือน WSD','Vallow = 0.09√f′c·bw·d',
        'engine.phiVc (method = wsd)','สูตร WSD ที่สืบทอดใน Engine; coefficient clause review retained',
        'N–mm–MPa; ใช้แรงใช้งานและไม่เพิ่มกำลังจากแรงอัดแกน')
      : equation('shear','เฉือน คสล.','φVc = φv·0.17√f′c·bw·d',
        type==='duckfoot'?'duckfootEngine.calculateDuckfoot':'engine.phiVc / shearDesign',
        'ACI 318-14 §22.5.5.1; full applicability review retained',
        'N–mm–MPa; คอนกรีตน้ำหนักปกติ λ = 1; ปลอกและ pile axial boost ใช้สูตรแยกที่ Engine รายงาน'));
  if(type==='soldier') rows.push(equation('soldierCapacity','เข็มตัวไอ คสล.อัดแรงและแผ่นเสียบ','D/C = demand / supplied-or-estimated resistance',
    'engine.calcSoldier / pileDisp / soldierFrame','catalogue/project screening of prestressed concrete I-piles',
    'Mcap, Vcap, lagging และแรงยึดรั้งตามข้อมูล/แบบจำลอง; ต้องยืนยันหน้าตัดและกำลังผู้ผลิต'));
  if(type==='soldier'&&input.frontBeamMode!=='none')rows.push(equation('frontRbBeam',input.frontBeamMode==='waler'?'คานตามระดับยึดรั้ง RB2':'คานตามแบบเดิม RB1–RB3','M=γH·Hหน้า·S/10; V=γH·Hหน้า·0.6; หน้าตัด/As/ρ/เฉือนแยกแต่ละคาน',
    'engine.calcSoldier → capD.beams / flexuralDesignTrace / checksFor','แรงคานต่อเนื่องแบบประมาณและสูตรหน้าตัดของ Engine เดิม; full clause/material applicability review retained',
    'RB2 มีเฉพาะระดับยึดรั้งที่แยกจาก RB1; ไม่ใช่แคปสมอหลัง; shear/stirrup material และรายละเอียดรอยต่อยังต้องทวน'));
  if(type==='soldier') rows.push(equation('anchorDowel','เดือย DB เข็มสมอ V-stay',
    method==='wsd'?'As = max(Tservice·1000/fs,allow, 0.005Ag, 4ADB12)':'As = max(Tu·1000/(0.90fy), 0.005Ag, 4ADB12)',
    'engine.calcSoldier → stay.anchorPile.dowel','WSD service/SDM basis of existing Engine; minimum and stress coefficient applicability review retained',
    'ตรวจพื้นที่เหล็ก DB ของ V-stay เท่านั้น; WSD ใช้ fsAllowWSD เดิม; ไม่รวมกำลังยึดเหนี่ยว/ระยะฝัง/แคป/เข็มสมอ'));
  if(type==='soldier'&&input.soldierSys==='stay')rows.push(equation('rearShaft','กำลังถอนเข็มสมอ',
    'fs=αSu; Qshaft=fs·perimeter·La; estimate=min(Qshaft, catalogue tensile estimate); positive project uplift overrides estimate',
    'engine.calcSoldier → stay.anchorPile; rearAnchorActions.pileResistance','FHWA GEC12 NHI-16-009, Chapter 7, alpha method',
    'Su ของดินรอบสมอแยกจากดินหน้ากำแพง; ศูนย์ไม่สร้างแรงเสียดทานขั้นต่ำ; ค่าประมาณไม่ใช่กำลังยอมให้ที่รับรอง รวมรอยต่อ/แคป/แรงราบต้องตรวจแยก'));
  if(type==='duckfoot'||['cantilever','counterfort','gravity'].includes(type)) rows.push(
    equation('contact','แรงกดใต้ฐาน',type==='duckfoot'
      ?'e = xR − B/2; qเขต,ใน = V/A·(1 ∓ 6e/B); |e| > B/6: compression-only contact'
      :'e = B/2 − xR; qToe,Heel = V/A·(1 ± 6e/B); |e| > B/6: compression-only contact',
      type==='duckfoot'?'duckfootEngine.duckContact / footing actions':'engine.baseContactPressures / toeStripActions',
      'FHWA NHI-06-089 §8.4.3.1; compression contact from equilibrium',
      'ดินไม่รับแรงดึง; แรงลัพธ์ออกนอกฐานถือว่าไม่มีสมดุล; qa เป็นกำลังยอมให้ที่กรอก'));
  if(['pile','pilecf','soldier'].includes(type)) rows.push(equation('pile','เข็มและสปริงดิน','K·u = F; spring reaction = kh·u; pile group from force/moment equilibrium',
    'engine.pileDisp / pileWallFrame / soldierFrame','Winkler/linear FE; project soil/capacity inputs',
    'กราฟบางชุดแสดง Winkler ขณะที่แรงออกแบบอาจคุมจาก frame; ใช้ governing demand ที่ Engine เลือก'));
  return rows;
}

function groupsFor(type,input) {
  if(type==='duckfoot')return [
    ['column','เสาชิดเขต',k=>k.startsWith('เสา ·'),'รอยต่อเสา–คานและกำลังรอยต่อเต็มชุดยังไม่ได้ออกแบบ'],
    ['beam','คานตีนเสาเหนือฐาน',k=>k.startsWith('คานตีนเสา'),'ไม่มีแรงรองรับจากดิน; joint continuity/settlement ยังต้องตรวจ'],
    ['pad','ฐานแผ่รายเสา',k=>k.startsWith('ฐาน'),'แรงกด/ดัด/เฉือน/เจาะทะลุตามแบบจำลอง; การทรุดต่างระดับยังไม่ได้ตรวจ']];
  if(type==='soldier')return [
    ['pile','เข็มตัวไอ คสล.อัดแรงและดิน',k=>/PILE MOMENT|PILE SHEAR|EMBEDMENT|กันพลิก|พฤติกรรมเข็ม|การเคลื่อน/.test(k),'Mcap/Vcap เป็นค่าคัดกรองเข็มอัดแรง; ต้องยืนยัน catalogue ผู้ผลิต'],
    ['lagging','แผ่นเสียบ',k=>k.includes('LAGGING'),'ตรวจแผ่นสำเร็จตามแบบจำลอง; ไม่ใช่การออกแบบแผ่น RC ทั่วไป'],
    ['restraint','ระบบยึดรั้ง',k=>/STAY|สมอ|คานยึดรั้ง|ANCHOR|RB[123]|CAP/.test(k),
      input.soldierSys==='stay'?'แคป/เข็มสมอหลัง: ยังไม่ตรวจดัด เฉือน ระยะฝัง และกำลังราบ/ดัดของเข็ม':'รอยต่อยึดรั้ง/กำลังระบบจริงต้องยืนยันตามชนิดที่กรอก'],
    ['global','เสถียรภาพรวม',k=>k.includes('GLOBAL'),'Bishop เป็นการค้นหาวงตามดินที่กรอก ไม่แทนรายงานสำรวจดิน']];
  const groups=[
    ['stem','พนังกำแพง',k=>k.includes('STEM'),'พนัง–ฐาน: รายละเอียด joint/dowel/development เต็มชุดยังต้องทวน'],
    ['heel','ฐานด้านหลัง Heel',k=>k.includes('HEEL'),'กำลังหน้าตัดไม่แทนการตรวจรอยต่อเต็มชุด'],
    ['toe','ฐานด้านหน้า Toe',k=>k.includes('TOE'),'แรงกดดินหรือปฏิกิริยาเข็มตามระบบที่เลือก'],
    ['base','ฐานและเสถียรภาพ',k=>/F\.S\.|BEARING|ECCENTRICITY|GLOBAL|SLOPE|SEISMIC|KEY|REBAR/.test(k),'qa/ดิน/น้ำ/แผ่นดินไหวตามที่กรอกและขอบเขต Engine']];
  if(['counterfort','pilecf'].includes(type))groups.push(['rib','ครีบค้ำพนัง',k=>/BUTTRESS|ครีบ|RIB/.test(k),
    'แรง/เหล็กครีบอยู่ในผลออกแบบ; ผังรอยต่อครีบ–พนัง–ฐานยังต้องตรวจแยก']);
  if(['pile','pilecf'].includes(type))groups.push(['pile','กลุ่มเสาเข็มและเดือย',k=>/PILE|การเคลื่อน|dowel/.test(k),
    'แรงถอน/ราบ/แกน/ดัด/เฉือน/เดือยเฉพาะที่ลงทะเบียน; pile capacity ไม่ใช่ผลรับรองสำรวจดิน']);
  return groups;
}

export function buildEquationLedger({type,profile,input,checks,identity}) {
  if(!['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'].includes(type)
    ||!DESIGN_PROFILES[profile]||!input||!Array.isArray(checks)||!checks.length||!identity)
    throw new TypeError('RW-01 equation ledger requires a known current complete result');
  const selected=DESIGN_PROFILES[profile],duck=type==='duckfoot',method=duck?'project-strength':selected.method;
  const factors=duck?{gD:input.factorN,gL:input.factorL,gH:input.factorH,gDr:.9}
    :Object.fromEntries(['gD','gL','gH','gDr','phib','phiv'].map(key=>[key,selected[key]]));
  if(Object.values(factors).some(v=>!Number.isFinite(v)||v<0))throw new TypeError('RW-01 incomplete profile factors');
  const rows=checks.map((c,index)=>{
    const key=c.key??c.k;
    if(typeof key!=='string'||typeof c.ok!=='boolean')throw new TypeError('RW-01 incomplete registered check');
    return {index,key,ok:c.ok};
  });
  const assigned=new Set(),components=groupsFor(type,input).map(([id,label,match,note])=>{
    const registered=rows.filter(row=>!assigned.has(row.index)&&match(row.key));
    registered.forEach(row=>assigned.add(row.index));
    return {id,label,checks:registered,registered:registered.length,failed:registered.filter(row=>!row.ok).length,note};
  });
  const remaining=rows.filter(row=>!assigned.has(row.index));
  if(remaining.length)components.push({id:'other',label:'รายการเฉพาะแบบจำลอง',checks:remaining,
    registered:remaining.length,failed:remaining.filter(row=>!row.ok).length,note:'อ่านเกณฑ์แต่ละรายการในตารางผลตรวจเดิม'});
  const assumptions=[duck
    ?'ตัวคูณ DL/LL/H เป็นค่าของโครงการ; กำลังหน้าตัดอ้างวิธี ACI 318-14; ไม่ใช่โปรไฟล์ไทย/ACI/WSD ที่เลือกอยู่ในระบบอื่น'
    :'เสถียรภาพใช้แรงใช้งาน; หน้าตัดใช้วิธี/ตัวคูณของโปรไฟล์นี้; แรงผิวดินที่ช่วยต้านการเลื่อน/พลิกคว่ำไม่นับเป็นกำลังต้าน',
    profile==='thai2566'&&!duck
      ?'φb = 0.90 และ φv = 0.85 ใช้กรณีมีมาตรฐานงานก่อสร้างและควบคุมคุณภาพวัสดุตามข้อ 8; มยผ.1101-64 เป็นมาตรฐานงานวัสดุ/ก่อสร้าง ไม่ใช่ต้นฉบับ Whitney/shear'
      :method==='wsd'?'ตัวคูณแรงใช้งานตรวจข้อ 6; ที่มาของ coefficient กำลัง WSD ยังต้องทวนตัวเล่ม':'ACI clause locator ยืนยันเลขข้อเท่านั้น; full code applicability/joint review ยังแยกจาก numerical PASS',
    'สมการกำลังใช้ N–mm–MPa ภายใน; แรงวิเคราะห์ใช้ kN–m; หน่วยแสดงผลที่เลือกใช้ข้อมูลชุดเดียวกัน'];
  if(type==='soldier')assumptions.push('เข็มตัวไอเป็น คสล.อัดแรงตาม catalogue ใน Engine; gH ใช้คูณแรงตรวจ ส่วน Mcap/Vcap เป็นค่าประมาณ ไม่ได้เปลี่ยนเป็น φVc ของพนังเมื่อสลับโปรไฟล์');
  return freeze({schema:EQUATION_LEDGER_VERSION,type,profile:duck?'project-strength-aci318-14':profile,
    identity:String(identity),method,factors,checkCount:rows.length,failed:rows.filter(row=>!row.ok).length,
    label:duck?'ACI 318-14 · กำลังหน้าตัด / ตัวคูณแรงโครงการ':selected.short,
    equations:equationsFor(type,method,input),components,assumptions,
    sourceKeys:[...(duck?['aci','foundation','soil']:profile==='aci318'?['aci','foundation','soil']:['thai','foundation','aci','soil']),
      ...(type==='soldier'?['anchor',...(input.soldierSys==='stay'?['drivenPile']:[])]:[])],scope:'REGISTERED_RESULT_TRACE_ONLY',constructionApproved:false});
}

export function renderEquationLedger(ledger,{compact=false}={}) {
  if(ledger?.schema!==EQUATION_LEDGER_VERSION||!ledger.checkCount||ledger.constructionApproved!==false)
    throw new TypeError('RW-01 invalid equation ledger projection');
  const f=ledger.factors,wsd=ledger.method==='wsd';
  const factors='DL '+f.gD+' · LL '+f.gL+' · H '+f.gH+' · D ต้าน '+f.gDr
    +(Object.hasOwn(f,'phib')?(wsd?' · ไม่ใช้ φ':' · φb '+f.phib+' · φv '+f.phiv):' · φ ตาม strain/หน้าตัดในสมการ');
  const body='<div class="rw-ledger-identity"><b>'+esc(ledger.label)+'</b><br>'+esc(factors)
    +'<br>ชุดผล '+esc(ledger.identity)+' · '+ledger.checkCount+' รายการตรวจ · ไม่ผ่าน '+ledger.failed+'</div>'
    +'<ul>'+ledger.assumptions.map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>'
    +'<h3>สมการและเจ้าของค่า</h3><div class="table-wrap"><table><thead><tr><th>หัวข้อ</th><th>สมการ / ขอบเขต</th><th>อ้างอิง</th></tr></thead><tbody>'
    +ledger.equations.map(e=>'<tr data-equation-id="'+esc(e.id)+'"><td>'+esc(e.title)+'</td><td>'+esc(e.formula)
      +'<br><small>'+esc(e.assumption)+'</small></td><td>'+esc(e.reference)+'<br><small>'+esc(e.owner)+'</small></td></tr>').join('')+'</tbody></table></div>'
    +'<h3>ชิ้นส่วนและขอบเขตรายการตรวจ</h3><div class="table-wrap"><table><thead><tr><th>ชิ้นส่วน</th><th>รายการตรวจ / ผล</th><th>ขอบเขต</th></tr></thead><tbody>'
    +ledger.components.map(c=>'<tr data-component-id="'+esc(c.id)+'"><td>'+esc(c.label)+'</td><td>'
      +(c.registered?c.registered+' รายการ · ไม่ผ่าน '+c.failed:'ไม่มีรายการแยกในทะเบียน')+'</td><td>'+esc(c.note)+'</td></tr>').join('')+'</tbody></table></div>'
    +'<h3>ต้นฉบับและสถานะการอ้างอิง</h3><ol>'+ledger.sourceKeys.map(key=>{const s=LEDGER_SOURCES[key];
      return '<li><a href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc(s.title)+'</a> · '+esc(s.edition)+'<br>'+esc(s.evidence)+'</li>';}).join('')+'</ol>';
  return compact?'<details class="rw-equation-ledger" data-equation-ledger="'+esc(ledger.type)+'"><summary>โปรไฟล์ สมการ และขอบเขตชิ้นส่วน</summary>'+body+'</details>'
    :'<section class="rw-equation-ledger rw-report-ledger" data-equation-ledger="'+esc(ledger.type)+'"><h2>โปรไฟล์ สมการ และขอบเขตชิ้นส่วน</h2>'+body+'</section>';
}
