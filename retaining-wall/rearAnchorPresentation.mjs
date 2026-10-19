/** Read-only inspection/report of one frozen rear-anchor action projection. */
import {resultUnits} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v,n=2)=>Number(v).toFixed(n);
const size=a=>a.size.map(v=>number(v,2)).join(' × ')+' ม. (X × H × Z)';
function arrow(x,y,dx,dy,color) {
  const l=Math.hypot(dx,dy);if(l<1e-10)return '';
  const u=dx/l,v=dy/l,ex=x+dx,ey=y+dy;
  return `<path d="M${x} ${y}L${ex} ${ey}" stroke="${color}" stroke-width="2" fill="none"/><path d="M${ex} ${ey}L${ex-8*u+4*v} ${ey-8*v-4*u}L${ex-8*u-4*v} ${ey-8*v+4*u}Z" fill="${color}"/>`;
}
function fbd(a,u) {
  const t=(x,y,label)=>`<text x="${x}" y="${y}" font-family="Sarabun,Arial,sans-serif" font-size="14" fill="#182f45">${esc(label)}</text>`;
  return '<svg class="rw-rear-fbd" data-rear-anchor-fbd="'+esc(a.mark)+'" viewBox="0 0 600 210" role="img" aria-label="'+esc('FBD '+a.mark+' แรงบนหัวสมอและปฏิกิริยาเข็มตรงข้าม')+'">'
    +'<rect x="130" y="75" width="105" height="48" fill="#edf2f6" stroke="#19364f" stroke-width="2"/>'
    +'<path d="M173 123V184M193 123V184M163 184H203" stroke="#496276" stroke-width="2" fill="none"/>'
    +'<circle cx="182" cy="99" r="4" fill="#172f47"/>'
    +arrow(182,99,105*Math.sign(a.load[0]),0,'#ae471a')+arrow(182,99,0,-57*Math.sign(a.load[1]),'#ae471a')
    +arrow(182,116,110*Math.sign(a.reaction[0]),0,'#315b79')+arrow(201,113,0,-70*Math.sign(a.reaction[1]),'#315b79')
    +t(20,64,'Fx '+u.quantity(a.load[0],'kN',1))+t(195,40,'Fy '+u.quantity(a.load[1],'kN',1))
    +t(241,145,'Rx')+t(211,188,'Ry')+t(20,20,a.mark+' · '+a.stayCount+' สเตย์')
    +t(360,40,'แรงบนแคป · SERVICE')+t(360,67,'Fz '+u.quantity(a.load[2],'kN',2))
    +t(360,105,'ปฏิกิริยาเข็ม R = −F')+t(360,133,'Rx '+u.quantity(a.reaction[0],'kN',1))
    +t(360,160,'Ry '+u.quantity(a.reaction[1],'kN',1))
    +t(20,207,'สัญลักษณ์ FBD · +X เข้าดิน / +Y ขึ้น / +Z ตามแนวกำแพง')+'</svg>';
}

export function renderRearAnchorActions(actions,{mode='si',compact=false}={}) {
  if(!actions)return '';
  if(actions.schema!=='rw01-rear-anchor-actions/1'||!actions.identity||!actions.anchors.length
    ||actions.capacityVerified!==false||actions.constructionApproved!==false)
    throw new TypeError('Rear-anchor presentation requires the accepted force-only projection');
  const u=resultUnits(mode),a=actions.anchors[0],dw=actions.dowel,ap=actions.pileResistance;
  const member=actions.members.find(m=>m.anchorIndex===a.index);
  const rows=actions.anchors.map(c=>'<tr data-rear-anchor-row="'+esc(c.mark)+'"><td>'+esc(c.mark)
    +'</td><td>'+c.stayCount+'</td><td>'+number(c.head.z,2)+'</td><td>'+number(c.size[0])+'×'+number(c.size[2])+'×'+number(c.size[1])
    +'</td><td>'+u.format(c.load[0],'kN',1)+'</td><td>'+u.format(c.load[1],'kN',1)+'</td><td>'+u.format(c.load[2],'kN',2)
    +'</td><td>'+u.format(c.factoredLoad[1],'kN',1)+'</td></tr>').join('');
  const body='<p>ชุดผล '+esc(actions.identity)+' · '+esc(actions.basis)+'<br>'+esc(actions.assumption)+'</p>'
    +'<div class="print-keep rw-rear-node"><h3>FBD · '+esc(a.mark)+' และแรงที่หัวเข็มสมอ</h3>'+fbd(a,u)
    +'<p>ขนาด '+esc(size(a))+' · แรงออกแบบ = แรงใช้งาน × γH = '+number(actions.lateralFactor,2)+'</p></div>'
    +'<div class="table-wrap"><table class="rw-rear-table"><thead><tr><th>สมอ</th><th>สเตย์</th><th>Z (ม.)</th><th>B×L×H (ม.)</th>'
    +'<th>Fx '+u.label('kN')+'</th><th>Fy '+u.label('kN')+'</th><th>Fz '+u.label('kN')+'</th><th>Fy,u '+u.label('kN')+'</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="print-keep"><h3>แทนค่า · แรงแกนสเตย์และสมดุลหัวสมอ</h3>'
    +'<p>Nⱼ = Tpile · Lⱼ / Lb = '+u.format(actions.horizontalPerFront,'kN',2)+' × '+number(member.length,3)
    +' / '+number(actions.span,3)+' = '+u.quantity(member.axial,'kN',2)+'<br>'
    +'Fสมอ = Σ(−Nⱼ · uⱼ); uⱼ = (ΔX, ΔY, ΔZ) / Lⱼ<br>'
    +esc(a.mark)+' = ('+a.load.map(v=>u.format(v,'kN',2)).join(', ')+') '+u.label('kN')
    +'; Rเข็ม = −Fสมอ; ΣF = (0, 0, 0)<br>'
    +'Fy,u = γH · Fy = '+number(actions.lateralFactor,2)+' × '+u.format(a.load[1],'kN',2)+' = '+u.quantity(a.factoredLoad[1],'kN',2)
    +'</p><p>ปลายแนวคี่รับสเตย์ตัวเดียวตามผัง; ทะเบียน APd เดิมตรวจแรงคุมสมอคู่ ไม่ลดจำนวนเหล็กตามรูป FBD นี้</p></div>'
    +(dw?.mode==='pcwire'?'<div class="print-keep"><h3>APd · ลวด PC ที่ตรวจจริง</h3><p>'+esc(dw.spec)+' / สมอ · '
      +'<b>'+(dw.assessment.steelScreenOK?'ผ่านการประมาณกำลังลวด':'ไม่ผ่านการประมาณกำลังลวด')+'</b><br>'
      +'Aps = '+dw.assessment.wire.count+' × π × '+number(dw.assessment.wire.diameter,1)+'² / 4 = '+number(dw.assessment.wire.area,1)+' mm²<br>'
      +'φAps fpc / 1000 = '+number(dw.assessment.wire.phi,2)+' × '+number(dw.assessment.wire.area,1)+' × '+number(dw.assessment.wire.stress,1)+' / 1000 = '+u.quantity(dw.assessment.wire.capacity,'kN',2)
      +'; Tu = '+u.quantity(dw.assessment.wire.demand,'kN',2)+'<br>หน่วยแรงลวดเป็นค่าประมาณเดิม; <b>รอยต่อยังไม่ตรวจสมอปลายและการถ่ายแรง</b></p></div>':dw?'<div class="print-keep"><h3>APd · เหล็กเดือยที่ตรวจจริง</h3><p>'+esc(dw.spec)+' / สมอ · '
      +(dw.manualCount?'จำนวนกรอกเอง':'Engine เลือกจำนวน')+' · <b>'+(dw.steelOK?'พื้นที่เหล็กผ่าน':'พื้นที่เหล็กไม่ผ่าน')+'</b><br>'
      +(dw.method==='wsd'?'Tใช้งาน':'Tu')+' คุมจากทะเบียน = '+u.quantity(dw.designT??dw.Tu,'kN',2)
      +'; Asแรง = T × 1000 / '+(dw.method==='wsd'?'fs,allow':'(0.90fy)')+' = '+number(dw.AsRequired,1)
      +' mm²; '+(dw.method==='wsd'?'fs,allow':'0.90fy')+' = '+number(dw.stressLimitMPa,1)+' MPa; Asขั้นต่ำ = '+number(dw.AsMinimum,1)
      +'; Asต้องมี = '+number(dw.AsNeeded,1)+'; Asจัด = '+number(dw.AsProvided,1)+' mm²<br>'
      +'เหล็กเดือยหล่อพร้อมกัน · ตรวจพื้นที่เหล็กตามแรงที่คำนวณ</p></div>':'')
    +(ap?'<div class="print-keep"><h3>เข็มสมอ · แรงถอนและที่มาของกำลัง</h3><p>'+esc(ap.basis)+'<br>'
      +'Qshaft = α·Su·p·La = '+number(ap.alpha,2)+' × '+u.format(ap.su,'kPa',3)+' × '+number(ap.perimeter,3)+' × '+number(ap.length,3)+' = '+u.quantity(ap.shaft,'kN',2)
      +'<br>กำลังตรวจ '+u.quantity(ap.capacity,'kN',2)+' · แรงถอน '+u.quantity(ap.demand,'kN',2)+' · D/C '+number(ap.dc,3)
      +'<br>ค่า α-method เป็นการประมาณ; กำลังยอมให้ทั้งระบบต้องอ้างข้อมูลโครงการและผลทดสอบ</p></div>':'')
    +'<p class="legend" role="note"><b>ยังไม่มีผลกำลัง:</b> '+esc(actions.missingCapacity.filter(item=>dw?.mode==='pcwire'||!item.startsWith('แรงยึดเหนี่ยว/')).join(' · '))
    +'. ขนาดที่กรอกและสมดุลแรงไม่ยืนยันกำลังรอยต่อ · NOT FOR CONSTRUCTION</p>';
  return compact?'<details class="rw-rear-anchor-actions" data-rear-anchor-actions="'+esc(actions.identity)+'"><summary>ฐานหัวเข็มสมอ · แรงที่จุดต่อและ APd</summary>'+body+'</details>'
    :'<section class="rw-rear-anchor-actions" data-rear-anchor-actions="'+esc(actions.identity)+'"><h2>ฐานหัวเข็มสมอ · แรงที่จุดต่อและ APd</h2>'+body+'</section>';
}
