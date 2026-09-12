import { mountConcreteProjectControls } from './concrete-project-store.mjs';
import { openWorkspaceStore } from './shared/workspace-store.mjs';
import { selectMaterials } from './steel-box-member-autosize.mjs?v=20260912-r40';
import { componentSummary } from './steel-box-member-connection-selection.mjs?v=20260912-r40';

const A=window.NCYSC01MemberAnalysis,R=window.NCYSC01MemberReport,D=window.NCYSC01MemberLoads,V=window.NCYSC01MemberViews,T=window.NCYSC01MemberTruss,C=window.NCYSC01MemberConnections;
const legacy=!!window.__scSampleMode||new URLSearchParams(location.search).get('qa')==='1'&&new URLSearchParams(location.search).get('legacy')==='1';
if(!legacy){
  if(!A||!R||!C||!window.NCYSC01MemberDrawings||!window.NCYSC01MemberLoadDiagram)throw Error('โหลดส่วนตรวจสมาชิก จุดต่อ และแบบไม่ครบ');
  const {esc,n,size}=R,doc=document,by=id=>doc.getElementById(id);
  await new Promise((resolve,reject)=>{const until=Date.now()+10000;function ready(){
    if(['ncy670StageBar','sc01RunCalculation','sc01r12Report','viewerArea','saveBtn'].every(id=>by(id))&&window.NCYUI670)return resolve();
    if(Date.now()>until)return reject(Error('โครงหน้าจอเดิมโหลดไม่ครบ'));requestAnimationFrame(ready);
  }ready();});
  let input=A.fresh(),result=null,projection=null,frame=0,trial=0,view='purlin',selectedPurlin=1,selectedFrame=1,dimension='3d',scene=null,caseIndex=-1,barId='TC1';
  let diagramComponent='main',diagramKind='M',diagramCase=-1,diagramDimension='3d',diagramScene=null,cadSheet='plan';
  let selecting=false,selection=null,undoSelection=null;
  const get=path=>path.split('.').reduce((a,k)=>a[k],input);
  const set=(path,value)=>{const keys=path.split('.'),last=keys.pop();keys.reduce((a,k)=>a[k],input)[last]=value;};
  const options=rows=>rows.map(([v,l])=>`<option value="${esc(v)}">${esc(l)}</option>`).join('');
  const field=(path,label,unit='',extra='')=>`<label class="sm-field">${label}${unit?` <span data-sm-unit-label="${unit}">${unit}</span>`:''}<input id="sm-${path}" data-sm-path="${path}" data-sm-unit="${unit}" type="number" inputmode="decimal" step="any" ${extra}></label>`;
  const textField=(path,label)=>`<label class="sm-field">${label}<input data-sm-path="${path}" type="text" maxlength="1000"></label>`;
  const select=(path,label,rows)=>`<label class="sm-field">${label}<select data-sm-path="${path}">${options(rows)}</select></label>`;
  const check=(path,label)=>`<label class="sm-check"><input type="checkbox" data-sm-path="${path}">${label}</label>`;
  const records=(window.NCYSC01RetailMaterials?.records||[]).filter(r=>['member_dimensions','purlin_dimensions'].includes(r.mode));
  function sections(slot){
    const unique=new Map();for(const row of records.filter(r=>r.slot===(slot==='purlin'?'purlin':'member'))){const p=row.specs;
      if([p.depthMm,p.widthMm,p.thicknessMm].every(x=>Number.isFinite(x)&&x>0))unique.set(`${p.depthMm}x${p.widthMm}x${p.thicknessMm}`,row);
    }
    return [...unique.entries()].sort((a,b)=>a[1].specs.depthMm-b[1].specs.depthMm||a[1].specs.widthMm-b[1].specs.widthMm||a[1].specs.thicknessMm-b[1].specs.thicknessMm);
  }
  function sectionField(slot,label){return `<label class="sm-field">${label}<select id="sm-${slot}-catalog" data-sm-section="${slot}">${options(sections(slot).map(([k,r])=>[k,`${r.specs.depthMm} × ${r.specs.widthMm} × ${r.specs.thicknessMm} mm`]))}<option value="custom">ระบุขนาดเอง…</option></select></label>
    <div class="sm-custom sm-three" id="sm-${slot}-custom" hidden>${field(slot+'.H','สูง H','mm')}${field(slot+'.B','กว้าง B','mm')}${field(slot+'.t','หนา t','mm')}</div>`;}
  const markup=doc.createElement('div');markup.innerHTML=`
    <header class="sm-header"><div><h1>ตรวจเหล็กและการแอ่นตัว</h1><p>คานยื่นและแป · ฐานรองรับแข็ง</p></div><div id="sm-project-actions"></div></header>
    <div class="sm-layout">
      <form id="sm-form" class="sm-inputs" novalidate>
        <details class="sm-group" open><summary><span>1</span> จุดรองรับ</summary><div>
          ${select('support.type','ต่อคานกับ',[['concrete-wall','ผนังคอนกรีต'],['concrete-beam','คานคอนกรีต'],['dual-columns','เสา 2 ข้างที่ฐาน + คานเชื่อม'],['hbeam','เชื่อมเพลทกับ H-beam']])}
          <p class="sm-note">ถือว่าฐานยึดแน่น · ตรวจคาน แป และจุดต่อที่เลือก</p>
          <details class="sm-details" id="sm-support-dimensions"><summary>ขนาดคานและเสาที่ฐาน</summary><div class="sm-two">${field('support.beamBMM','คานรองรับกว้าง','mm')}${field('support.beamHMM','คานรองรับสูง','mm')}</div><div id="sm-hbeam-section" class="sm-two">${field('support.hbeam.webMM','H-beam หนาเอว tw','mm')}${field('support.hbeam.flangeMM','H-beam หนาปีก tf','mm')}</div><div id="sm-column-dimensions" class="sm-two">${field('support.columnBMM','เสากว้าง','mm')}${field('support.columnDMM','เสาลึก','mm')}${field('support.columnHeightM','เสาสูง','m')}</div><p class="sm-note">เสาซ้าย–ขวาที่แนวฐาน ไม่ค้ำปลายคานยื่น · ใช้ความหนาผิว H-beam ตรวจขนาดขารอยเชื่อม; ถือว่าฐานแข็งและไม่ตรวจรับรองกำลัง H-beam เดิม</p></details>
        </div></details>
        <details class="sm-group" open><summary><span>2</span> เลือกเหล็ก</summary><div>
          ${check('truss.enabled','ใช้โครงถัก Truss')}${select('truss.type','รูปแบบโครงถัก',Object.entries(T.types))}${sectionField('steel','คาน / คอร์ดเหล็กกล่อง H × B × t')}<div id="sm-web-input">${sectionField('web','เหล็กทแยงและตั้ง H × B × t')}</div>${sectionField('purlin','แปเหล็กกล่อง · H ตั้งแนวดิ่ง')}
          <details class="sm-details" id="sm-connection-inputs"><summary>เกรดเหล็ก · เพลท · รอยเชื่อม · พุก</summary>
            <p class="sm-note">ขนาดจากแค็ตตาล็อกตลาด กำลังใช้ Fy/Fu ด้านล่าง ต้องตรงกับเหล็กที่ใช้</p>
            <div class="sm-two">${field('steel.Fy','Fy','MPa')}${field('steel.Fu','Fu','MPa')}${field('steel.thicknessFactor','ตัวคูณความหนา')}</div>
            ${select('plate.allowanceMM','เพิ่มกว้าง–สูงเพลทรวม',[['25.4','1 นิ้ว (25.4 mm)'],['50.8','2 นิ้ว (50.8 mm)']])}
            <div class="sm-two">${field('plate.thicknessMM','เพลทหนา','mm')}<div id="sm-anchor-input">${select('plate.anchorMM','ขนาดพุกประกอบ',[['12','M12'],['16','M16'],['20','M20']])}</div></div>
            <p id="sm-plate-summary" class="sm-note"></p>${check('connection.plateAuto','ตั้งกว้าง–สูงเพลทตามหน้าตัดอัตโนมัติ')}
            <div id="sm-plate-manual" class="sm-two">${field('connection.plateWidthMM','เพลทกว้าง','mm')}${field('connection.plateHeightMM','เพลทสูง','mm')}</div>
            <div class="sm-two">${field('connection.plateFy','Fy เพลท','MPa')}${field('connection.plateFu','Fu เพลท','MPa')}</div>
            ${select('connection.weldPattern','แนวเชื่อมเหล็ก → เพลท',[['all','เชื่อมรอบหน้าตัด'],['horizontal','เชื่อม 2 แนวตามแกน X'],['vertical','เชื่อม 2 แนวตามแกน Y']])}
            <div class="sm-two">${field('connection.weldSizeMM','ขารอยเชื่อม w','mm')}${field('connection.weldFexx','Fexx ลวดเชื่อม','MPa')}${field('connection.weldLengthFactor','ตัวคูณความยาวแนวเชื่อม')}</div>
            <div id="sm-hbeam-weld">${field('connection.supportWeldSizeMM','ขารอยเชื่อมรอบเพลท → H-beam','mm')}<p class="sm-note">เชื่อมขอบเพลททั้งรอบกับหน้าคานที่รองรับเต็มแนว ถือว่าหน้า H-beam แข็ง</p></div>
            <details id="sm-node-details" class="sm-details"><summary>Gusset และรอยเชื่อมภายใน Truss</summary>${select('connection.node.type','รายละเอียดจุดต่อ',[['slotted_gusset','Gusset สอดร่อง HSS'],['surface_gusset','Gusset เชื่อมผิว HSS · ต้องตรวจ local joint']])}<div class="sm-two">${field('connection.node.thicknessMM','Gusset หนา','mm')}${field('connection.node.lengthMM','ระยะต่อใช้งาน','mm')}${field('connection.node.weldMM','ขารอยเชื่อม Gusset','mm')}${field('connection.node.Fy','Fy Gusset','MPa')}${field('connection.node.Fu','Fu Gusset','MPa')}${field('connection.node.bucklingK','K ของ Gusset')}${field('connection.node.widthMM','กว้างจำกัด · 0 ใช้ Whitmore','mm')}${field('connection.node.eccentricityMM','ระยะเยื้องศูนย์ joint','mm')}</div><p class="sm-note">คำนวณแรงและกำลังที่ทุกจุดต่อจากโครงที่เลือก รายละเอียด local HSS ที่สูตรยังไม่ครอบคลุมจะไม่สรุปผ่าน</p></details>
            <div id="sm-anchor-details">
              ${select('connection.anchorType','ประเภทพุก',[['adhesive','พุกเคมี'],['mechanical','พุกกล']])}
              <div class="sm-two">${field('connection.anchorRows','จำนวนแถวพุก')}${field('connection.anchorCols','จำนวนคอลัมน์พุก')}${field('connection.anchorEdgeXMM','ศูนย์พุกห่างขอบเพลท X','mm')}${field('connection.anchorEdgeYMM','ศูนย์พุกห่างขอบเพลท Y','mm')}${field('connection.anchorHefMM','ระยะฝังใช้งาน hef','mm')}${field('connection.anchorAseMM2','พื้นที่เกลียว Ase','mm²')}${field('connection.anchorFuta','กำลังดึงแกนพุก','MPa')}</div>
              <details class="sm-details"><summary>พุกรุ่นจริงและค่าจากเอกสารผู้ผลิต</summary>
                ${textField('connection.product.name','ยี่ห้อ / รุ่นพุกและน้ำยา')}${textField('connection.product.report','เลขที่รายงาน / แหล่งข้อมูล')}${textField('connection.product.revision','ฉบับเอกสาร')}
                <p class="sm-note">ใช้ค่าตามขนาด ระยะฝัง และสภาพติดตั้งที่เลือก · ช่องว่างไม่มีค่ากำลังสมมติ</p>
                <div class="sm-two">${Object.entries({NsaDesign:['กำลังดึงออกแบบ Nsa','kN'],VsaDesign:['กำลังเฉือนออกแบบ Vsa','kN'],tauCr:['แรงยึดเหนี่ยว คอนกรีตแตกร้าว','MPa'],tauUncr:['แรงยึดเหนี่ยว คอนกรีตไม่แตกร้าว','MPa'],phiBond:['φ bond',''],NpCrDesign:['กำลังถอน คอนกรีตแตกร้าว','kN'],NpUncrDesign:['กำลังถอน คอนกรีตไม่แตกร้าว','kN'],minEdge:['ขอบคอนกรีตขั้นต่ำ','mm'],minSpacing:['ระยะพุกขั้นต่ำ','mm'],minMemberThickness:['ความหนาคอนกรีตขั้นต่ำ','mm'],fcMin:['f′c ต่ำสุด','MPa'],fcMax:['f′c สูงสุด','MPa'],hefMin:['hef ต่ำสุด','mm'],hefMax:['hef สูงสุด','mm'],kcCr:['kc แตกร้าว',''],kcUncr:['kc ไม่แตกร้าว',''],kcp:['kcp',''],cac:['cac','mm']}).map(([k,[l,u]])=>field('connection.product.'+k,l,u)).join('')}</div>
                ${check('connection.product.confirmed','ตรวจค่าตรงกับเอกสารพุกรุ่นนี้แล้ว')}${check('connection.product.conditionQualified','สภาพติดตั้งอยู่ในขอบเขตเอกสาร')}
              </details>
              <details class="sm-details"><summary>คอนกรีตรอบพุก</summary><div class="sm-two">${field('connection.concreteFc','f′c','MPa')}${field('connection.concreteThicknessMM','คอนกรีตหนา','mm')}${field('connection.edgeTopMM','ศูนย์พุกริมถึงขอบบน','mm')}${field('connection.edgeBottomMM','ศูนย์พุกริมถึงขอบล่าง','mm')}${field('connection.edgeLeftMM','ศูนย์พุกริมถึงขอบซ้าย','mm')}${field('connection.edgeRightMM','ศูนย์พุกริมถึงขอบขวา','mm')}</div>${check('connection.concreteCracked','คอนกรีตแตกร้าว')}</details>
            </div>
          </details>
        </div></details>
        <details class="sm-group" open><summary><span>3</span> ระยะหลังคา</summary><div>
          <div class="sm-two">${field('geometry.widthM','ความกว้างรวมตามผนัง','m')}${field('geometry.projectionM','คานยื่นจากฐาน','m')}${field('geometry.frameSpacingM','ช่วงแปไม่เกิน','m','aria-describedby="sm-spacing-help sm-layout-note"')}${field('geometry.purlinSpacingM','ระยะ @ แปไม่เกิน','m','aria-describedby="sm-spacing-help sm-layout-note"')}</div>
          ${select('geometry.purlinLayout','วิธีวางแป',[['end-pitch','วางจากหัวถึงท้าย ตาม @ มีช่วงเศษท้ายได้'],['equal','แบ่งช่วงเท่ากัน ไม่เกิน @ ที่กรอก']])}
          <p id="sm-spacing-help" class="sm-note">ช่วงแป = ระยะระหว่างคานรองรับ · @ แป = ระยะซอยตามแนวคานยื่น<br>มีแปที่โคนและปลายคานเสมอ</p>
          <div id="sm-truss-input" class="sm-two">${field('truss.depthMM','ความลึกโครง','mm')}${field('truss.panels','จำนวนช่อง','ช่อง','step="1"')}<div id="sm-tip-depth">${field('truss.tipDepthMM','ความลึกปลาย','mm')}</div></div><p id="sm-layout-note" class="sm-note"></p>
          ${select('geometry.deflectionLimit','ยอมให้แอ่นไม่เกิน',[['180','ช่วง / 180'],['240','ช่วง / 240'],['360','ช่วง / 360']])}
        </div></details>
        <details class="sm-group" open><summary><span>4</span> น้ำหนักบรรทุก</summary><div>
          <div class="sm-mode" role="group" aria-label="วิธีกำหนด DL"><button type="button" data-sm-dl-mode="materials">เลือกวัสดุ DL</button><button type="button" data-sm-dl-mode="manual">กรอก DL เอง</button></div>
          <div id="sm-dl-materials" hidden>
            ${select('deadLoad.roof','วัสดุมุง',[['none','เลือกวัสดุมุง…'],...D.catalogue.filter(r=>r.group==='roof').map(r=>[r.id,r.label])])}
            ${select('deadLoad.ceiling','ฝ้า',[['none','ไม่มีฝ้า'],...D.catalogue.filter(r=>r.group==='ceiling').map(r=>[r.id,r.label])])}
            ${field('deadLoad.extraKPa','DL อื่นเพิ่ม','kN/m²')}
            <p class="sm-note">อุปกรณ์ รอยซ้อนตามยาว และโครงฝ้าที่ไม่ได้รวมในน้ำหนักแผ่น</p><div id="sm-dl-sources"></div>
          </div>
          <div id="sm-dl-manual">${field('loads.deadKPa','DL รวมวัสดุและอุปกรณ์','kN/m²')}</div>
          <p id="sm-dl-total" class="sm-load-total" aria-live="polite"></p>
          <details class="sm-details"><summary>ระบุที่มาของ DL / รายการอื่น</summary>${textField('deadLoad.reference','วัสดุ / ที่มาน้ำหนัก')}</details>
          <p class="sm-note">โปรแกรมบวกน้ำหนักคานและแปให้อีกหนึ่งครั้ง จึงไม่ต้องรวมใน DL ที่กรอก</p>
          ${field('loads.liveKPa','LL จร กระจายตลอดแนวแป','kN/m²')}
          ${check('loads.windEnabled','เพิ่มแรงลมแนวดิ่ง')}<div id="sm-wind-input" hidden>${field('loads.windKPa','แรงลม ± W','kN/m²')}<p class="sm-note">แรงลมระดับ LRFD; ตรวจแอ่นแบบเผื่อโดยใช้ W เต็มค่าร่วมกับ DL/LL ไม่รวมลมด้านข้าง</p></div>
        </div></details>
        <section class="sm-cable"><h2>ช่วยลดการแอ่น</h2>${check('cable.enabled','ใช้สลิงรั้งที่ปลายคาน')}
          <div id="sm-cable-inputs" hidden><p class="sm-note">หนึ่งเส้นต่อคาน ปลายบนยึดแน่น สลิงตึงเริ่มต้นและไม่มีแรงดึงล่วงหน้า</p>
            <div class="sm-two">${field('cable.heightM','จุดรั้งสูงกว่าแกนคาน','m')}${field('cable.diameterMM','ขนาดสลิงในภาพ','mm')}${field('cable.EAkN','ความแข็ง EA','kN')}${field('cable.allowableKN','แรงดึงใช้งานที่ยอมให้','kN')}</div>
            ${textField('cable.reference','รุ่น / เอกสารค่า EA และแรงดึงที่ยอมให้')}
            <p class="sm-note">ใช้ค่าของสลิงชุดจริงรวมปลายยึด ขนาดเส้นผ่านศูนย์กลางอย่างเดียวบอกกำลังและความแข็งไม่ได้ จุดรั้งบนต้องมีฐานยึดแน่นแยกตามตำแหน่งในภาพ</p>
          </div>
        </section>
        <details class="sm-details sm-project"><summary>โปรไฟล์ออกแบบ หน่วย และหัวรายงาน</summary>
          ${select('design.profile','โปรไฟล์ออกแบบ',[['aisc360-22_aci318-19','AISC 360-22 / ACI 318-19'],['aisc360-22_aci318-25','AISC 360-22 / ACI 318-25 · รอตรวจความต่าง'],['custom','กำหนดตัวคูณ φ เอง']])}
          <div class="sm-two">${select('design.forceUnit','หน่วยแรง',[['kN','kN'],['kgf','kgf']])}${select('design.stressUnit','หน่วยความเค้น',[['MPa','MPa'],['kgf/cm²','kgf/cm²']])}</div>
          <div id="sm-custom-factors" class="sm-two">${Object.keys(input.design.custom).map(k=>field('design.custom.'+k,k)).join('')}</div>
          ${textField('project.name','ชื่อโครงการ')}${textField('project.number','เลขที่งาน')}${textField('project.designer','ผู้จัดทำ')}${textField('project.date','วันที่')}</details>
        <div id="sm-input-errors" class="sm-errors" role="alert" hidden></div>
        <label class="sm-check sm-auto-choice"><input type="checkbox" id="sm-auto-material" checked>เลือกขนาดจากผลคำนวณอัตโนมัติ</label>
        <div class="sm-form-actions"><button type="submit" class="sm-primary" id="sm-calculate">คำนวณและดูผล</button><button type="button" data-sm-action="model">ดูการถ่ายแรง</button></div>
      </form>
      <section class="sm-workspace">
        <div class="sm-model-head"><h2>โหลดลงแป → แปถ่ายสู่คานยื่น</h2><span id="sm-model-status">ยังไม่คำนวณ</span></div>
        <div class="sm-mode" role="group" aria-label="ดูการถ่ายแรง"><button type="button" data-sm-load-view="purlin" aria-pressed="true">1 โหลดลงแป</button><button type="button" data-sm-load-view="main" aria-pressed="false">2 แปสู่คานยื่น</button><button type="button" data-sm-load-view="root" aria-pressed="false">3 เพลท / พุก</button></div>
        <div class="sm-toolbar"><button type="button" data-sm-dimension="2d" aria-pressed="false">2D</button><button type="button" data-sm-dimension="3d" aria-pressed="true">3D</button><button type="button" data-sm-camera="iso">ISO</button><button type="button" data-sm-camera="front">หน้า</button><button type="button" data-sm-camera="side">ข้าง</button><button type="button" data-sm-camera="top">บน</button><button type="button" data-sm-camera="fit">พอดีจอ</button><button type="button" id="sm-force-open">จุดต่อ + แรง / RGB</button></div>
        <div class="sm-two sm-view-select"><label class="sm-field">แนวแป<select id="sm-purlin-line"></select></label><label class="sm-field">แนวคาน<select id="sm-main-line"></select></label></div>
        <div id="sm-scene" class="sm-load-view"><div id="sm-load-drawing"></div><div id="sm-native-scene"><canvas id="sm-native-canvas" aria-label="3D เดิม ตามหน้าตัดที่เลือก"></canvas><svg id="sm-native-overlay" class="cad-overlay"></svg></div><div id="sm-root-actions"></div><p id="sm-geometry-error" hidden role="status"></p></div>
        <p id="sm-section-note" class="sm-note"></p>
        <section id="sm-results" aria-live="polite"><h2>ผลตรวจ</h2><p>เลือกขนาดและกรอกระยะ แล้วกด “คำนวณและดูผล”</p></section>
        <div id="sm-trials" aria-live="polite" hidden></div>
        <div class="sm-output-actions"><button id="sm-report" type="button" disabled>รายการคำนวณ / PDF</button><span id="sm-report-status">คำนวณให้ผ่านก่อนเปิดรายงาน</span></div>
        <p class="sm-scope">ตรวจสมาชิก การแอ่น และจุดต่อที่เลือก ตามน้ำหนักที่กรอก · ถือว่าโครงสร้างรองรับเดิมแข็ง กำลังคานรองรับ เสา และฐานรากเดิมต้องตรวจแยก</p>
      </section>
    </div>`;
  const root=by('appShell');doc.body.classList.add('sc01-member-active');
  // Keep the original shell and stage layout. Only scoped contents are replaced.
  const form=markup.querySelector('#sm-form');form.classList.add('sm-controls');by('inputPanel').append(form);
  const resultsPanel=doc.createElement('div');resultsPanel.id='sm-result-panel';resultsPanel.className='sm-controls';
  for(const selector of ['#sm-trials','#sm-results','.sm-output-actions','.sm-scope'])resultsPanel.append(markup.querySelector(selector));
  by('resultsPanel').append(resultsPanel);
  const workspace=markup.querySelector('.sm-workspace');workspace.id='sm-diagram-panel';workspace.className='sm-controls';by('viewerArea').append(workspace);
  for(const el of by('viewerArea').children)if(el!==workspace)el.style.setProperty('display','none','important');
  const projectActions=markup.querySelector('#sm-project-actions');by('saveBtn').after(projectActions);
  const statusNode=doc.createElement('span');statusNode.id='sm-shell-status';by('ncy670StageBar').append(statusNode);
  const iso=root.querySelector('#pageTabs [data-page="iso"]');iso.textContent='การถ่ายแรง';
  const general=root.querySelector('#pageTabs [data-page="general"]');general.textContent='SFD / BMD';
  const curves=doc.createElement('section');curves.id='sm-curves';curves.hidden=true;workspace.append(curves);
  curves.innerHTML='<div id="sm-curve-controls" class="sm-two"></div><p id="sm-curve-title"></p><div class="sm-toolbar"><button type="button" data-sm-graph-dimension="2d">2D</button><button type="button" data-sm-graph-dimension="3d">3D</button><button type="button" data-sm-graph-camera="iso">ISO</button><button type="button" data-sm-graph-camera="front">หน้า</button><button type="button" data-sm-graph-camera="top">บน</button><button type="button" data-sm-graph-camera="iso">พอดีจอ</button></div><div id="sm-curve-plot"></div><div id="sm-graph-scene"><canvas id="sm-graph-canvas" aria-label="กราฟแรงและการแอ่นสามมิติของชิ้นส่วนที่เลือก"></canvas><svg id="sm-graph-overlay" class="cad-overlay"></svg></div><p id="sm-graph-scale" class="sm-note"></p>';
  const plateView=doc.createElement('section');plateView.id='sm-plate-view';plateView.hidden=true;workspace.append(plateView);
  const plateSections=doc.createElement('section');plateSections.id='sm-plate-sections';plateSections.hidden=true;workspace.append(plateSections);
  const cad=doc.createElement('section');cad.id='sm-cad';cad.hidden=true;workspace.append(cad);
  by('viewerArea').hidden=false;
  for(const b of root.querySelectorAll('#pageTabs button:not([data-page="iso"]):not([data-page="general"]):not(#sc01ForceOpen):not(#sc01CoverageOpen),#pageTabs select'))b.hidden=true;
  const sectionTab=doc.createElement('button');sectionTab.type='button';sectionTab.dataset.page='sc01-section';sectionTab.textContent='เพลท / รูปตัด';by('pageTabs').insertBefore(sectionTab,iso);
  const plateTab=doc.createElement('button');plateTab.type='button';plateTab.dataset.page='sc01-plate';plateTab.textContent='3D เพลท / พุก + แรง';by('pageTabs').insertBefore(plateTab,iso);
  const cadTab=doc.createElement('button');cadTab.type='button';cadTab.dataset.page='sc01-cad';cadTab.textContent='แบบ CAD / DXF';by('pageTabs').append(cadTab);

  const dialog=doc.createElement('dialog');dialog.id='sm-report-dialog';dialog.innerHTML='<div class="sm-report-actions"><strong>รายการคำนวณ · สมาชิกและจุดต่อ</strong><button type="button" id="sm-print">พิมพ์ / บันทึก PDF</button><button type="button" id="sm-close-report">ปิด</button></div><div id="sm-report-content"></div>';doc.body.append(dialog);
  const printRoot=doc.createElement('div');printRoot.id='sm-print-root';doc.body.append(printRoot);
  const printNotice=doc.createElement('p');printNotice.id='sm-print-notice';printNotice.textContent='ยังออกเอกสารไม่ได้: ผลตรวจไม่ผ่าน ไม่ครบ หรือข้อมูลเปลี่ยนแล้ว กรุณาแก้ข้อมูลและคำนวณใหม่';doc.body.append(printNotice);
  function fill(){
    for(const el of root.querySelectorAll('[data-sm-path]')){const v=get(el.dataset.smPath);if(el.type==='checkbox')el.checked=v;else el.value=el.type==='number'&&v!==''?C.units.toDisplay(v,el.dataset.smUnit||'',input):v;}
    for(const el of root.querySelectorAll('[data-sm-unit-label]'))el.textContent=C.units.label(el.dataset.smUnitLabel,input);
    for(const slot of ['steel','purlin','web']){const p=input[slot],key=`${p.H}x${p.B}x${p.t}`,known=sections(slot).some(([k])=>k===key);by('sm-'+slot+'-catalog').value=known?key:'custom';by('sm-'+slot+'-custom').hidden=known;}
    conditional();scheduleGeometry();
  }
  function conditional(){
    by('sm-truss-input').hidden=!input.truss.enabled;by('sm-web-input').hidden=!input.truss.enabled;root.querySelector('[data-sm-path="truss.type"]').closest('label').hidden=!input.truss.enabled;by('sm-tip-depth').hidden=input.truss.type!=='tri_tapered';by('sm-cable-inputs').hidden=!input.cable.enabled;by('sm-wind-input').hidden=!input.loads.windEnabled;by('sm-anchor-input').hidden=input.support.type==='hbeam';
    const material=input.deadLoad.mode==='materials';by('sm-dl-materials').hidden=!material;by('sm-dl-manual').hidden=material;
    for(const b of root.querySelectorAll('[data-sm-dl-mode]'))b.setAttribute('aria-pressed',String(b.dataset.smDlMode===input.deadLoad.mode));
    by('sm-dl-total').textContent='DL ที่ใช้ = '+n(C.units.toDisplay(input.loads.deadKPa,'kN/m²',input),4)+' '+C.units.label('kN/m²',input);
    by('sm-dl-sources').innerHTML=D.selected(input).map(r=>`<p class="sm-note">${r.mass} kg/m² → ${n(C.units.toDisplay(r.mass*D.GRAVITY,'kN/m²',input),4)} ${C.units.label('kN/m²',input)} · <a href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">เอกสารผู้ผลิต</a><br>${esc(r.basis)}</p>`).join('');
    by('sm-plate-manual').hidden=input.connection.plateAuto;by('sm-anchor-details').hidden=input.support.type==='hbeam';by('sm-hbeam-weld').hidden=input.support.type!=='hbeam';
    by('sm-support-dimensions').hidden=input.support.type==='concrete-wall';by('sm-column-dimensions').hidden=input.support.type!=='dual-columns';by('sm-custom-factors').hidden=input.design.profile!=='custom';
    by('sm-hbeam-section').hidden=input.support.type!=='hbeam';
    by('sm-node-details').hidden=!input.truss.enabled;
    for(const path of ['connection.anchorRows','connection.anchorEdgeYMM'])root.querySelector(`[data-sm-path="${path}"]`).closest('label').hidden=input.truss.enabled;
  }
  function renderCurves(){
    const ready=!!result&&!result.errors.length;by('sm-curve-title').textContent=ready?'':'คำนวณข้อมูลปัจจุบันก่อนดูกราฟ';
    for(const id of ['sm-curve-controls','sm-curve-plot','sm-graph-scene','sm-graph-scale'])by(id).hidden=!ready;
    if(!ready){by('sm-curve-plot').replaceChildren();diagramScene?.viewer.clear();diagramScene?.viewer.draw();if(diagramScene)diagramScene.data=null;return;}
    if(diagramComponent==='bar'&&!result.truss)diagramComponent='main';if(diagramKind==='N'&&diagramComponent!=='bar')diagramKind='M';
    const series=V.diagramSeries(input,result,{component:diagramComponent,kind:diagramKind,caseIndex:diagramCase,purlinId:projection?.lines[selectedPurlin]?.id||'P01',barId});
    const choose=(id,label,rows)=>`<label class="sm-field">${label}<select id="${id}">${options(rows)}</select></label>`;
    by('sm-curve-controls').innerHTML=choose('sm-graph-component','ชิ้นส่วน',[['main',result.truss?'รวมโครงถัก':'คานยื่น'],['purlin','แป'],...(result.truss?[['bar','สมาชิกโครงถัก']]:[])])+choose('sm-graph-kind','กราฟ',[['V','SFD · แรงเฉือน'],['M','BMD · โมเมนต์'],['deflection','การแอ่นตัว'],...(diagramComponent==='bar'?[['N','แรงแกน N']]:[])])+choose('sm-graph-case',diagramKind==='deflection'?'กรณีใช้งาน SLS':'กรณีออกแบบ ULS',[[-1,'กรณีควบคุมกราฟนี้'],...series.choices.map((x,i)=>[i,x])])+(diagramComponent==='purlin'?choose('sm-graph-purlin','แนวแป',projection.lines.map((x,i)=>[i,x.id+' · '+n(x.zM)+' m'])):diagramComponent==='bar'?choose('sm-bar','สมาชิก',result.truss.geo.members.map(m=>[m.id,m.id])):'');
    by('sm-graph-component').value=diagramComponent;by('sm-graph-kind').value=diagramKind;by('sm-graph-case').value=diagramCase;if(by('sm-graph-purlin'))by('sm-graph-purlin').value=selectedPurlin;if(by('sm-bar'))by('sm-bar').value=barId;
    const u=C.units.label(series.unit,input),points=series.points.map(p=>({...p,[series.kind]:C.units.toDisplay(p[series.kind],series.unit,input)}));
    by('sm-curve-title').textContent=series.title+' · '+series.caseName+' · '+u;
    by('sm-curve-plot').innerHTML=R.plot(points,series.kind,series.title+' · '+series.caseName,u,diagramComponent==='purlin'?{leftLabel:'A · รองรับที่คาน',rightLabel:'B · รองรับที่คาน'}:{});by('sm-curve-plot').hidden=diagramDimension!=='2d';by('sm-graph-scene').hidden=diagramDimension!=='3d';
    for(const b of curves.querySelectorAll('[data-sm-graph-dimension]'))b.setAttribute('aria-pressed',String(b.dataset.smGraphDimension===diagramDimension));
    if(diagramDimension==='3d'&&!curves.hidden){diagramScene??=new V.DiagramScene(by('sm-graph-canvas'),by('sm-graph-overlay'));const data=diagramScene.update(series,input);by('sm-graph-scale').textContent=diagramKind==='deflection'?'ขยายการแอ่น '+n(data.scale,1)+' เท่า · ค่ากำกับเป็นการแอ่นจริง':'กราฟวางบนแกนสมาชิก · ขยายความสูงให้เห็นรูป ค่าแรงใช้หน่วยที่กำกับ';}
  }
  function renderCAD(){try{const sheets=[{id:'plate-detail',title:'เพลท / พิกัดรู / รูปตัดความหนา'},...window.NCYSC01MemberDrawings.build(input)],s=sheets.find(x=>x.id===cadSheet)||sheets[0];cad.innerHTML=`<div class="sm-toolbar"><label class="sm-field">ชิ้นส่วน / แบบ<select id="sm-cad-sheet">${options(sheets.map(x=>[x.id,x.title]))}</select></label><button type="button" id="sm-cad-export" ${C.reportAllowed(result,input)?'':'disabled'}>ส่งออก DXF ทุกแผ่น</button></div><h3>${esc(s.title)}</h3><p class="sm-note">${result?'ตามข้อมูลและผลคำนวณปัจจุบัน':'ภาพตามข้อมูลกรอก · รอคำนวณ'} · แบบใช้หน่วย mm</p><div class="sm-cad-drawing">${s.id==='plate-detail'?window.NCYSC01MemberDrawings.plateDetails(input).markup:window.NCYSC01MemberDrawings.svg(s)}</div>`;by('sm-cad-sheet').value=s.id;}catch(e){cad.innerHTML=`<p>${esc(e.message)}</p>`;}}
  let sectionCase=-1;
  function renderPlateSections(){
    const rows=result?.connections?.all;
    if(!rows?.length){plateSections.innerHTML='<p>คำนวณข้อมูลปัจจุบันก่อนดูเพลท รูปตัด และแรงที่จุดยึด</p>';return;}
    const index=sectionCase>=0&&sectionCase<rows.length?sectionCase:Math.max(0,rows.findIndex(x=>x.caseName===result.member.name)),q=rows[index],F=window.NCYSC01MemberReportFigures,v=F.connection(input,result,q);
    const table=(headers,data)=>`<table><thead><tr>${headers.map(x=>'<th>'+esc(x)+'</th>').join('')}</tr></thead><tbody>${data.map(xs=>'<tr>'+xs.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
    const val=(x,u='kN')=>n(C.units.toDisplay(x,u,input)),unit=C.units.label('kN',input);
    plateSections.innerHTML=`<div class="sm-toolbar"><label class="sm-field">เพลท / กรณีแรง<select id="sm-section-case">${options(rows.map((x,i)=>[i,x.plateId+' · '+x.caseName]))}</select></label></div>
      ${F.pair(F.panel('PL1 · ผังเพลท / พุก',v.front,q.plateId+' · '+q.caseName),F.panel('SECTION A–A · รูปตัด',v.section,input.support.type==='hbeam'?'เพลทเชื่อม H-beam':'ระยะฝัง / หน้าตัด / พุก'))}
      ${F.pair(v.forceMap?F.panel('แรงพุก / แรงอัดสัมผัส',v.forceMap,q.caseName):F.panel('จุดต่อกับ H-beam','<p class="sm-note">รอยเชื่อมเหล็ก → เพลท → หน้ารองรับแข็ง ไม่มีพุกคอนกรีตในจุดต่อนี้</p>'),F.panel('แรงหน้าเพลท',table(['แรง','ค่าปัจจุบัน'],['N','Vx','Vy','Mx','My','Tz'].map(k=>[k,val(q.action[k],['N','Vx','Vy'].includes(k)?'kN':'kN·m')+' '+C.units.label(['N','Vx','Vy'].includes(k)?'kN':'kN·m',input)])),q.caseName))}
      ${v.forces.length?table(['พุก','x (mm)','y (mm)','T ('+unit+')','Vx ('+unit+')','Vy ('+unit+')'],v.forces.map(a=>[a.id,n(a.x),n(a.y),val(a.T),val(a.Vx),val(a.Vy)])):''}<p class="sm-note">แรงจากกรณีที่เลือก · ผลกำลังและสถานะรวมทุกกรณีอยู่ในผลตรวจ รายงานใช้ผลที่ผ่านครบและคำนวณตรงกับข้อมูลล่าสุด</p>`;
    by('sm-section-case').value=index;
  }
  function shellStatus(){
    const current=!!result&&!result.errors.length;
    by('sm-shell-status').textContent=!result?'ข้อมูลเปลี่ยนแล้ว · กดคำนวณ':!current?'ข้อมูลยังไม่ครบ':result.ready?'✓ สมาชิกและจุดต่อผ่าน': '× ผลตรวจยังไม่ครบ / ไม่ผ่าน';
    const report=by('sc01r12Report');report.setAttribute('aria-disabled',String(!C.reportAllowed(result,input)));report.setAttribute('aria-label',C.reportAllowed(result,input)?'เอกสาร ผลตรวจครบทุกชิ้นส่วน':'เอกสาร แก้ผลตรวจทุกชิ้นส่วนให้ผ่านก่อน');report.removeAttribute('data-sc01-document-locked');
    renderCurves();if(!cad.hidden)renderCAD();if(!plateSections.hidden)renderPlateSections();by('sm-force-open').disabled=!current||A.validate(input,{geometryOnly:true}).length>0;
    const version=root.querySelector('.ncy670-version');if(version)version.textContent='UI R40 · ENGINEER';
    const title=root.querySelector('.project-heading h1');if(title)title.textContent=input.project.name||'จุดต่อคานยื่นรับหลังคา';
    by('projectCode').textContent=input.project.number||'SC01';
    by('saveStatus').textContent='สมาชิก · การแอ่น · เพลท · รอยเชื่อม · พุก';
    iso.textContent='การถ่ายแรง';
  }
  function stage(name){window.NCYUI670.setStage(name,{activateModel:false});by('viewerArea').hidden=false;}

  function invalidate(){
    selecting=false;selection=null;undoSelection=null;setSelecting(false);
    trial++;result=null;by('sm-report').disabled=true;by('sm-report-status').textContent='ข้อมูลเปลี่ยนแล้ว คำนวณใหม่ก่อนเปิดรายงาน';by('sm-model-status').textContent='ภาพอัปเดตแล้ว · รอคำนวณ';
    by('sm-results').innerHTML='<h2>ผลตรวจ</h2><p>ข้อมูลเปลี่ยนแล้ว กดคำนวณเพื่อดูผลชุดใหม่</p>';by('sm-trials').hidden=true;caseIndex=-1;shellStatus();window.dispatchEvent(new Event('sc01:member-input-changed'));
    reportCache=null;by('sm-report-content').replaceChildren();printRoot.replaceChildren();if(dialog.open)dialog.close();
  }
  function scheduleGeometry(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;try{
    projection=D.project(input,{purlin:selectedPurlin,frame:selectedFrame});by('sm-geometry-error').hidden=true;
    const g=projection.grid;selectedPurlin=projection.purlin.index;selectedFrame=projection.frame.index;
    by('sm-layout-note').textContent=`ใช้จริง: คานรองรับ ${g.frames} แนว · ช่วงแป ${g.bays} ช่วง × ${n(g.frameSpacingM)} m; แป ${g.purlins} แนว · ช่วง ${g.purlinIntervals.map(x=>n(x)).join(' + ')} m`;
    by('sm-section-note').textContent=`คาน ${size(input.steel)} · แป ${size(input.purlin)} · ผลตรวจใช้สมาชิกควบคุมทุกแนว`;
    const plate=V.nativeState(input).plate;by('sm-plate-summary').textContent=`เพลทที่เลือก: ${n(plate.width)} × ${n(plate.height)} × ${n(plate.thickness)} mm · ต้องผ่านผลตรวจขนาดและกำลัง`;
    for(const [id,rows,selected] of [['sm-purlin-line',projection.lines,selectedPurlin],['sm-main-line',projection.frames,selectedFrame]]){
      const el=by(id);el.innerHTML=options(rows.map((r,i)=>[i,`${r.id} · ${n(r.zM??r.xM)} m ${id==='sm-purlin-line'?'จากฐาน':'จากริมซ้าย'}`]));el.value=selected;
    }
    by('sm-load-drawing').hidden=dimension==='3d';by('sm-native-scene').hidden=dimension!=='3d';
    by('sm-load-drawing').innerHTML=view==='root'?V.rootSVG(input):input.truss.enabled&&view==='main'?V.trussSVG(input,result,{caseIndex}):window.NCYSC01MemberLoadDiagram.render(projection,view,by('sm-load-drawing').clientWidth<600,input);
    by('sm-root-actions').innerHTML=view==='root'?V.rootHTML(input,result,caseIndex):'';
    if(dimension==='3d'){scene??=new V.Scene(by('sm-native-canvas'),by('sm-native-overlay'));scene.update(input,projection,view,V.rootActions(input,result,caseIndex));}
    const ns=V.nativeState(input),ng=window.NCYV62.rootGeometry(ns);by('sm-plate-summary').textContent=`เพลท: ${n(input.truss.enabled?ng.plateW:ns.plate.width)} × ${n(input.truss.enabled?ng.plateH:ns.plate.height)} × ${n(ns.plate.thickness)} mm${input.truss.enabled?' · เพลทราก 2 แผ่น / จัดพุกพ้นหน้าตัด':''}`;
  }catch(e){projection=null;by('sm-load-drawing').replaceChildren();scene?.viewer.clear();scene?.viewer.draw();if(scene)scene.data=null;by('sm-root-actions').replaceChildren();by('sm-geometry-error').hidden=false;by('sm-geometry-error').textContent=e.message;by('sm-layout-note').textContent='กรอกขนาดและโหลดให้ครบเพื่อดูการถ่ายแรง';}});}
  function renderResult(){
    const r=result;if(!r)return;
    by('sm-input-errors').hidden=r.errors.length===0;by('sm-input-errors').innerHTML=r.errors.map(e=>`<p>${esc(e.message)}</p>`).join('');
    for(const el of root.querySelectorAll('[data-sm-path]'))el.setAttribute('aria-invalid',String(r.errors.some(e=>e.path===el.dataset.smPath)));
    if(r.errors.length){by('sm-results').innerHTML='<h2>ยังคำนวณไม่ได้</h2><p>แก้ช่องที่ระบุไว้ในข้อมูลกรอก</p>';by('sm-model-status').textContent='ข้อมูลยังไม่ครบ';return;}
    const row=(label,value,limit,pass)=>`<tr><th>${label}</th><td>${value}</td><td>${limit}</td><td class="${r.issues.length?'sm-pending':pass?'sm-ok':'sm-fail'}">${r.issues.length?'ตรวจขอบเขต':pass?'✓ ผ่าน':'× ไม่ผ่าน'}</td></tr>`;
    const p=r.purlins,ck=Object.fromEntries(r.checks.map(c=>[c.id,c]));
    by('sm-results').innerHTML=`<h2>${r.ready?'✓ ผ่านการตรวจสมาชิกและจุดต่อ':'ผลตรวจยังไม่ครบ / ไม่ผ่าน'}</h2>
      ${r.issues.length?`<div class="sm-errors">${r.issues.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}
      <h3>1. เหล็กรับน้ำหนักได้ไหม</h3><table><thead><tr><th>สมาชิก</th><th>ใช้กำลัง</th><th>เกณฑ์</th><th>ผล</th></tr></thead><tbody>
      ${row(input.truss.enabled?'โครงถัก · '+r.member.maxMember.id:'คาน',n(r.member.ratio*100,1)+'%','≤ 100%',ck['member-strength'].pass)}${row('แป',n(ck['purlin-strength'].ratio*100,1)+'%','≤ 100%',ck['purlin-strength'].pass)}</tbody></table>
      <h3>2. แอ่นตัวเท่าไร</h3><table><thead><tr><th>สมาชิก</th><th>แอ่นสูงสุด</th><th>ยอมให้</th><th>ผล</th></tr></thead><tbody>
      ${row('คาน',n(r.deflection.maxMM)+' mm',n(r.memberLimit)+' mm',ck['member-deflection'].pass)}${row('แป',n(Math.abs(p.deflection?.delta))+' mm',n(p.allowMM)+' mm',ck['purlin-deflection'].pass)}</tbody></table>
      ${input.cable.enabled?`<h3>สลิงที่เลือก</h3><p>แรงดึงใช้งาน <strong>${n(r.cableSLS.TKN)} / ${input.cable.allowableKN} kN</strong> <span class="${r.issues.length?'sm-pending':ck['cable-strength'].pass?'sm-ok':'sm-fail'}">${r.issues.length?'ยังสรุปไม่ได้':ck['cable-strength'].pass?'✓ ผ่าน':'× ไม่ผ่าน'}</span></p><p>ปลายคานก่อนรั้ง ${n(r.cableSLS.freeTipMM)} → หลังรั้ง ${n(r.cableSLS.tipMM)} mm · ${esc(r.cableSLS.name)}</p><p class="sm-note">แรงดึงออกแบบ ULS ${n(r.cableULS.TKN)} kN สำหรับตรวจจุดยึดแยก; สลิงหย่อนเมื่อแรงยก</p>`:''}
      ${!r.memberReady?`<div class="sm-advice"><p>ปรับขนาดหรือระยะ แล้วคำนวณใหม่ด้วยน้ำหนักชุดเดิม</p><button type="button" data-sm-trial="steel">หาเหล็กคาน / คอร์ดที่ผ่าน</button>${input.truss.enabled?'<button type="button" data-sm-trial="web">หาเหล็กทแยง / ตั้งที่ผ่าน</button>':''}<button type="button" data-sm-trial="purlin">หาแปที่ผ่าน</button>${!input.cable.enabled?'<button type="button" data-sm-action="cable">ลองสลิงรั้งปลาย</button>':''}</div>`:''}
      <details class="sm-details"><summary>สมการ กรณีแรง และค่าประกอบ</summary><p>อัตราใช้กำลัง = แรงที่ต้องรับ ÷ กำลังรับได้; คานรวมดัด เฉือน${input.cable.enabled?' และแรงอัดจากสลิง':''} ในสมการปฏิสัมพันธ์</p>
      <p>${r.truss?`${r.member.maxMember.id}: N ${n(r.member.maxMember.Nmax)} kN; M ${n(r.member.maxMember.maxM)} kN·m; φMn ${n(r.member.maxMember.hss.phiMnx)} kN·m`:`คาน φMn ${n(r.strength.phiMnx)} kN·m; Mmax ${n(r.member.maxM)} kN·m`} · ${esc(r.member.name)}</p><p>แอ่นคาน: ${esc(r.deflection.name)}; แป: ${esc(p.deflection?.caseName)}</p>
      <p>DL ภายนอก ${input.loads.deadKPa} + แป ${n(r.purlinDL)} kN/m²; คาน ${n(r.mainSelfWeightKNm)} kN/m; หน้ากว้างรับแรง ${n(r.grid.tributaryM)} m</p>
      ${R.plot(r.member.points,'M','BMD คาน','kN·m')}${R.plot(r.deflection.points,'deflection','การแอ่นคาน','mm')}</details>`;
    const names={ok:'✓ ผ่าน',warn:'✓ ผ่าน ใกล้กำลัง',fail:'× ไม่ผ่าน',incomplete:'ข้อมูลไม่ครบ',outside:'อยู่นอกขอบเขต',review:'รอตรวจวิธีคำนวณ'};
    const groups=[['plate','เพลท',['plate','hardware-fit','support-fit']],['weld','รอยเชื่อม',['weld','support-weld']],['anchors','พุกและคอนกรีตรอบพุก',['anchorSteel','productInteraction','breakoutT','bond','breakoutV','pryout','geometry','solver','productGate']],['other','จุดต่อโครงถัก / โปรไฟล์',['truss-joints','design-basis']]];
    by('sm-results').insertAdjacentHTML('beforeend','<h3>3. เพลท รอยเชื่อม และพุก</h3>'+groups.map(([id,label,ids])=>{
      const xs=(r.connections?.checks||[]).filter(x=>ids.includes(x.id));if(!xs.length)return id==='anchors'&&input.support.type==='hbeam'?'<p>พุกคอนกรีต: ไม่ใช้ในจุดต่อเชื่อมกับ H-beam</p>':'';
      const summary=componentSummary(xs);
      return `<section class="sm-connection-result"><details class="sm-details" data-sm-component="${id}"><summary>${label} <span class="${summary.tone}">${esc(summary.label)}</span></summary>${xs.map(q=>`<p><strong>${esc(q.label)}</strong> · ${esc(names[q.state]||q.state)}${Number.isFinite(q.ratio)?' · D/C '+n(q.ratio):''}<br>${esc(q.plateId||'')} · ${esc(q.caseName||'')}<br>${esc(q.note||'')}</p>`).join('')}</details>${summary.pass?'':`<p class="sm-connection-reason">${esc(summary.reason)}</p><button type="button" data-sm-action="connection" data-sm-focus="${esc(summary.path)}">${id==='anchors'?'ดูข้อมูลพุกและระยะติดตั้ง':id==='other'?'ดูรายละเอียดที่ยังติด':'ดูรายละเอียด'+label}</button>`}</section>`;
    }).join(''));
    by('sm-report').disabled=!C.reportAllowed(r,input);by('sm-report-status').textContent=r.ready?'ผลตรงกันทุกชิ้นส่วน เปิดรายงานได้':'แก้รายการที่ไม่ผ่าน / ไม่ครบ / รอตรวจ ก่อนเปิดรายงาน';by('sm-model-status').textContent='คำนวณตรงกับข้อมูลปัจจุบัน';
  }
  function calculate(){if(selecting){trial++;setSelecting(false);}try{result=C.calculate(input);renderResult();shellStatus();if(result.errors.length){const path=result.errors[0].path,el=root.querySelector(`[data-sm-path="${path}"]`);if(el){for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.focus();}}
    else stage('review');scheduleGeometry();if(!plateView.hidden)openForce(plateView);return A.clone(result);
  }catch(e){result=null;by('sm-results').innerHTML=`<h2>คำนวณไม่สำเร็จ</h2><p>${esc(e.message)}</p>`;by('sm-report').disabled=true;shellStatus();return null;}}
  function setSelecting(value){
    selecting=value;for(const id of ['sm-calculate','sc01RunCalculation']){by(id).disabled=value;by(id).setAttribute('aria-busy',String(value));}
    by('sm-auto-material').disabled=value;
    by('sm-report').disabled=value||!C.reportAllowed(result,input);
  }
  function renderSelection(){
    const box=by('sm-trials');box.hidden=false;const s=selection;if(!s)return;
    const labels={steel:'คาน / คอร์ด',web:'ทแยง / ตั้ง',purlin:'แป','plate.thicknessMM':'เพลทหนา','connection.weldSizeMM':'ขารอยเชื่อมเหล็ก → เพลท','connection.supportWeldSizeMM':'ขารอยเชื่อมเพลท → H-beam','connection.layout':'เพลทและการจัดพุก'};
    const display=x=>typeof x==='number'?n(x)+' mm':x.width?`${n(x.width)} × ${n(x.height)} mm; พุก ${x.rows} × ${x.cols} ตัว M${x.diameter}`:size(x);
    const dc=x=>Number.isFinite(x)?n(x):'—';
    const heading={selected:'เลือกวัสดุและคำนวณใหม่แล้ว',unchanged:'ขนาดเดิมผ่านการตรวจสมาชิก',unavailable:'ยังไม่พบชุดวัสดุที่ผ่าน',limited:'สิ้นสุดการค้นครั้งนี้',cancelled:'หยุดเลือกวัสดุแล้ว',invalid:'แก้ข้อมูลกรอกก่อนเลือกวัสดุ'}[s.status];
    box.innerHTML=`<h3>${heading}</h3>${s.changes.length?'<table><thead><tr><th>ชิ้นส่วน</th><th>เดิม → เลือกใช้</th><th>ผลหลังเลือก</th></tr></thead><tbody>'+s.changes.map(x=>`<tr><th>${labels[x.slot]}</th><td>${display(x.before)} → <strong>${display(x.after)}</strong></td><td>${x.slot==='connection.layout'?'ขนาดและระยะ':`D/C ${dc(x.beforeCheck.dc)} → <strong>${dc(x.afterCheck.dc)}</strong>`}${x.afterCheck.deflectionMM!==null?`<br>δ ${n(x.afterCheck.deflectionMM)} / ${n(x.afterCheck.allowMM)} mm`:''}<br>${x.afterCheck.pass?'✓ ผ่าน':Number.isFinite(x.afterCheck.dc)&&x.afterCheck.dc<=1?'ตัวเลขอยู่ในเกณฑ์ · รอตรวจรายละเอียด':'ยังไม่ผ่าน / ข้อมูลไม่ครบ'}</td></tr>`).join('')+'</tbody></table>':''}
      <p class="sm-note">ลองคำนวณ ${s.trials} ชุด · ผลตรวจใช้ขนาดที่เลือกแล้ว · โหลด ระยะ และเกรดเดิม</p>
      ${s.changes.some(x=>x.slot==='connection.layout')?'<p class="sm-note">คงขนาด เกรด และระยะฝังพุกที่กรอก · คงตำแหน่งขอบคอนกรีตเดิมและคำนวณระยะจากพุกใหม่ · ขนาดเพลทสำหรับตัดตามแบบ</p>':''}
      ${s.remaining.length?`<p class="sm-pending">${['selected','unchanged'].includes(s.status)?'จุดต่อยังไม่ผ่านครบ · รายงานยังเปิดไม่ได้':'ยังใช้วัสดุเดิม'}</p><details class="sm-details"><summary>รายการที่ยังต้องแก้</summary>${s.remaining.map(x=>`<p>${esc(x)}</p>`).join('')}</details>`:''}
      ${s.changes.length?'<button type="button" data-sm-action="undo-material">กลับไปใช้ขนาดก่อนเลือก</button>':''}
      <p class="sm-note">เลือกจากขนาดในแค็ตตาล็อกที่มีข้อมูล · ตรวจสอบเกรดและสต็อกก่อนสั่งซื้อ${s.changes.some(x=>x.slot.startsWith('plate.'))?' · เพลทเป็นความหนาที่เลือกสำหรับตัดตามแบบ ไม่ใช่ยืนยันรูของเพลทสำเร็จรูป':''}</p>`;
  }
  async function calculateSelected(){
    if(selecting)return;const auto=by('sm-auto-material').checked;invalidate();const initial=calculate();if(!auto||!initial||initial.errors.length&&(!input.truss.enabled||A.validate(input).length||C.validate(input).length||A.validate(input,{geometryOnly:true}).length))return initial;
    stage('review');
    const token=++trial,original=A.clone(input),fingerprint=A.stable(input),box=by('sm-trials');setSelecting(true);box.hidden=false;
    box.innerHTML='<h3>กำลังเลือกวัสดุ</h3><p data-sm-progress></p><button type="button" data-sm-action="cancel-material">หยุดเลือกและใช้ขนาดเดิม</button>';
    const active=()=>token===trial&&fingerprint===A.stable(input);
    try{
      const picked=await selectMaterials(original,{A,C,records:window.NCYSC01RetailMaterials.records,connectionLayout:V.connectionFootprint,weldGeometry:d=>window.NCYSC01WeldGeometry.describe(V.nativeState(d)),initial:result,active,progress:({label,count})=>{
        box.querySelector('[data-sm-progress]').textContent=`${label} · ลองแล้ว ${count} ชุด`;
      }});
      if(!active())return null;
      selection=picked;if(['selected','unchanged'].includes(picked.status)){input=A.clone(picked.input);result=picked.result;if(picked.changes.length)undoSelection=original;reportCache=null;by('sm-report-content').replaceChildren();printRoot.replaceChildren();fill();renderResult();shellStatus();scheduleGeometry();if(!plateView.hidden)openForce(plateView);}
      renderSelection();return A.clone(result);
    }catch(e){if(active()){selection={status:'unavailable',trials:0,changes:[],remaining:['เลือกวัสดุไม่สำเร็จ: '+e.message]};renderSelection();}return null;}
    finally{if(token===trial)setSelecting(false);}
  }
  async function suggest(slot){
    if(selecting){trial++;setSelecting(false);}selection=null;undoSelection=null;
    if(A.validate(input).length){calculate();return;}
    const token=++trial,original=A.stable(input),box=by('sm-trials');box.hidden=false;box.innerHTML='<p>กำลังลองขนาดด้วยโหลดและระยะเดิม…</p>';
    const rows=sections(slot),answers=[];let count=0;
    const ordered=rows.map(([key,row])=>({key,row,area:2*row.specs.thicknessMm*(row.specs.depthMm+row.specs.widthMm-2*row.specs.thicknessMm)})).sort((a,b)=>a.area-b.area);
    try{for(const {key,row} of ordered){
      if(token!==trial||original!==A.stable(input))return;
      const d=A.clone(input),p=row.specs;Object.assign(d[slot],{H:p.depthMm,B:p.widthMm,t:p.thicknessMm});const r=A.calculate(d);count++;
      const relevant=r.checks?.filter(c=>c.id.startsWith(slot==='purlin'?'purlin-':'member-'));
      if(relevant?.every(c=>c.pass)&&!r.issues.length)answers.push({key,section:d[slot],ready:r.ready});
      if(answers.length===4)break;if(count%4===0){box.textContent=`ลองแล้ว ${count} ขนาด…`;await new Promise(resolve=>setTimeout(resolve,0));}
    }
    if(token!==trial)return;
    box.innerHTML=`<h3>${slot==='steel'?'คาน / คอร์ด':slot==='web'?'เหล็กทแยง / ตั้ง':'แป'}ที่ผ่านกำลังและการแอ่น</h3>${answers.length?answers.map(a=>`<button type="button" data-sm-apply-slot="${slot}" data-sm-apply-key="${a.key}">${size(a.section)}${a.ready?'':' · หมวดอื่นยังต้องแก้'}</button>`).join(''):'<p>ไม่พบขนาดที่ผ่านในรายการนี้ ลองลดช่วงหรือระยะคาน หรือเพิ่มความแข็งของระบบ</p>'}<p class="sm-note">ลองจริง ${count} ขนาด · เลือกแล้วกดคำนวณเพื่อยืนยันผล</p>`;
    }catch(e){if(token===trial)box.innerHTML=`<p>ลองขนาดไม่สำเร็จ: ${esc(e.message)}</p>`;}
  }
  let reportCache=null;
  function reportInto(target){
    if(selecting)throw Error('รอเลือกวัสดุเสร็จ หรือหยุดการเลือกก่อนเปิดรายงาน');
    if(!C.reportAllowed(result,input))throw Error('แก้ผลตรวจทุกชิ้นส่วนและคำนวณใหม่ก่อนเปิดรายงาน');
    if(!reportCache||reportCache.result!==result)reportCache={result,html:R.build(result,input,{figure:window.NCYSC01ForceInspector.reportFigure(input,result)})};
    target.innerHTML=reportCache.html;R.uniqueSvgIds(target,target.id);return R.paginate(target);
  }
  function openReport(){try{reportInto(by('sm-report-content'));dialog.showModal();return true;}catch(e){by('sm-report-status').textContent=e.message;by('sm-report-content').replaceChildren();return false;}}
  function preparePrint(){
    let allowed=!selecting&&C.reportAllowed(result,input);doc.body.classList.remove('sc01-document-print-blocked');
    if(allowed){try{reportInto(printRoot);}catch(e){allowed=false;by('sm-report-status').textContent=e.message;}}if(!allowed)printRoot.replaceChildren();
    doc.body.classList.toggle('sm-print-blocked',!allowed);doc.body.classList.toggle('sm-print-ready',allowed);return allowed;
  }
  function openForce(host=null){
    if(!result||result.errors.length){if(host)host.innerHTML='<p>กรอกข้อมูลแล้วกดคำนวณ เพื่อดูเพลท พุก และแรงชุดปัจจุบัน</p>';return;}
    const accepted=result,acceptedInput=A.clone(input),nr=V.nativeResult(acceptedInput,accepted);
    window.NCYSC01ForceInspector.open({getState:()=>A.clone(input),getResult:()=>nr,getCase:()=>nr.governing,getBOQ:()=>null,getFormulaSteps:()=>null,getRevision:()=>0,getViewer:()=>null,renderView:()=>{},isCurrent:()=>result===accepted&&A.stable(input)===accepted.fingerprint,decorateViewer:v=>V.decorateSupport(v,acceptedInput)},{host});
  }
  root.addEventListener('input',e=>{
    const el=e.target;if(!el.dataset.smPath||el.tagName==='SELECT'||el.type==='checkbox')return;
    set(el.dataset.smPath,el.type==='number'?(el.value===''?'':C.units.toSI(Number(el.value),el.dataset.smUnit||'',input)):el.value);D.sync(input);invalidate();conditional();scheduleGeometry();
  });
  root.addEventListener('change',e=>{
    const el=e.target;
    if(el.dataset.smSection){const slot=el.dataset.smSection;if(el.value==='custom'){by('sm-'+slot+'-custom').hidden=false;return;}const [H,B,t]=el.value.split('x').map(Number);Object.assign(input[slot],{H,B,t});invalidate();fill();}
    else if(el.dataset.smPath&&(el.tagName==='SELECT'||el.type==='checkbox')){const path=el.dataset.smPath;set(path,el.type==='checkbox'?el.checked:typeof get(path)==='string'?el.value:Number(el.value));if(path==='plate.anchorMM'){input.connection.anchorAseMM2=window.NCYEngine.ANCHOR_THREAD_AREAS[input.plate.anchorMM]||Math.PI*input.plate.anchorMM**2/4*.78;input.connection.product.confirmed=false;input.connection.product.conditionQualified=false;}D.sync(input);invalidate();if(path.startsWith('design.')||path==='plate.anchorMM')fill();else conditional();scheduleGeometry();}
    if(el.id==='sm-purlin-line'){selectedPurlin=Number(el.value);scheduleGeometry();}
    if(el.id==='sm-section-case'){sectionCase=Number(el.value);renderPlateSections();}
    if(el.id==='sm-main-line'){selectedFrame=Number(el.value);scheduleGeometry();}if(el.id==='sm-case'){caseIndex=Number(el.value);renderCurves();scheduleGeometry();}if(el.id==='sm-bar'){barId=el.value;renderCurves();}
    if(el.id==='sm-graph-component'){diagramComponent=el.value;diagramCase=-1;renderCurves();}if(el.id==='sm-graph-kind'){diagramKind=el.value;diagramCase=-1;renderCurves();}if(el.id==='sm-graph-case'){diagramCase=Number(el.value);renderCurves();}if(el.id==='sm-graph-purlin'){selectedPurlin=Number(el.value);diagramCase=-1;renderCurves();}if(el.id==='sm-cad-sheet'){cadSheet=el.value;renderCAD();}
  });
  root.addEventListener('click',e=>{
    const el=e.target.closest('button');if(!el)return;
    if(el.dataset.smLoadView){view=el.dataset.smLoadView;workspace.scrollTop=0;by('viewerArea').scrollTop=0;for(const b of root.querySelectorAll('[data-sm-load-view]'))b.setAttribute('aria-pressed',String(b===el));scheduleGeometry();}
    if(el.dataset.smDimension){dimension=el.dataset.smDimension;for(const b of root.querySelectorAll('[data-sm-dimension]'))b.setAttribute('aria-pressed',String(b===el));scheduleGeometry();}if(el.dataset.smCamera)scene?.fit(el.dataset.smCamera==='fit'?'iso':el.dataset.smCamera);
    if(el.dataset.smGraphDimension){diagramDimension=el.dataset.smGraphDimension;renderCurves();}if(el.dataset.smGraphCamera)diagramScene?.fit(el.dataset.smGraphCamera);
    if(el.id==='sm-cad-export'&&C.reportAllowed(result,input)){const blob=new Blob([window.NCYSC01MemberDrawings.dxf(input,result)],{type:'application/dxf'}),url=URL.createObjectURL(blob),a=doc.createElement('a');a.href=url;a.download='SC01-current-components.dxf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    if(el.dataset.smDlMode){input.deadLoad.mode=el.dataset.smDlMode;D.sync(input);invalidate();fill();}
    if(el.dataset.smAction==='model'){stage('model');workspace.scrollTop=0;by('viewerArea').scrollTop=0;}
    if(el.dataset.smAction==='cable'){input.cable.enabled=true;invalidate();fill();stage('input');by('sm-cable-inputs').scrollIntoView({behavior:'smooth',block:'center'});}
    if(el.dataset.smAction==='connection'){stage('input');const target=root.querySelector(`[data-sm-path="${el.dataset.smFocus||'connection.weldSizeMM'}"]`);by('sm-connection-inputs').open=true;if(target){for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;if(target.dataset.smPath==='connection.plateWidthMM'&&input.connection.plateAuto){root.querySelector('[data-sm-path="connection.plateAuto"]').focus();}else target.focus();target.closest('label').scrollIntoView({block:'center'});}}
    if(el.dataset.smAction==='cancel-material'){trial++;setSelecting(false);selection={status:'cancelled',trials:0,changes:[],remaining:[]};renderSelection();}
    if(el.dataset.smAction==='undo-material'&&undoSelection){const original=undoSelection;apply(original);by('sm-auto-material').checked=false;calculate();by('sm-trials').hidden=false;by('sm-trials').textContent='กลับไปใช้ขนาดเดิมแล้ว · คำนวณตามขนาดที่กรอก เปิดเลือกอัตโนมัติได้เมื่อต้องการ';}
    if(el.dataset.smTrial)suggest(el.dataset.smTrial);
    if(el.dataset.smApplySlot){const [H,B,t]=el.dataset.smApplyKey.split('x').map(Number);Object.assign(input[el.dataset.smApplySlot],{H,B,t});invalidate();fill();stage('input');}
  });
  by('sm-form').addEventListener('submit',e=>{e.preventDefault();calculateSelected();});by('sm-report').onclick=openReport;
  by('sm-force-open').onclick=()=>openForce();
  by('sm-close-report').onclick=()=>dialog.close();by('sm-print').onclick=()=>{if(preparePrint())window.print();};
  window.addEventListener('afterprint',()=>doc.body.classList.remove('sm-print-blocked','sm-print-ready'));
  const apply=value=>{input=A.migrate(value);invalidate();fill();stage('input');};
  let store;
  if(!window.__scSampleMode)store=mountConcreteProjectControls({card:'sc01-member',host:by('sm-project-actions'),capture:()=>A.clone(input),validate:v=>{try{A.migrate(v);return true;}catch{return false;}},apply,
    description:'เก็บเหล็ก จุดต่อ ระยะ โหลด โปรไฟล์และหน่วย; เปิดแล้วคำนวณใหม่ โดยเก็บงาน SC01 รุ่นเดิมไว้',restoredMessage:'เปิดข้อมูลแล้ว กดคำนวณเพื่อดูผลล่าสุด'});
  if(store){
    const body=store.panel.querySelector('.sv-concrete-project-body'),status=body.querySelector('[role=status]');
    const add=(text,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=fn;body.append(b);return b;};
    async function importOld(read){
      const fingerprint=A.stable(input);status.textContent='กำลังอ่านข้อมูลเดิม…';
      try{const raw=await read();if(!raw)throw Error('ไม่พบร่าง SC01 เดิมในเครื่องนี้');
        if(raw.length>1024*1024*8)throw Error('ไฟล์เดิมใหญ่เกินขอบเขตนำเข้า');const next=A.fromLegacy(JSON.parse(raw));
        if(fingerprint!==A.stable(input))throw Error('ข้อมูลบนหน้าจอเปลี่ยนระหว่างอ่าน กรุณาลองใหม่');
        if(!window.confirm('อ่านเหล็ก จุดต่อ ระยะ โหลด โปรไฟล์และหน่วยจากงานเดิมแทนข้อมูลบนหน้าจอ? เก็บต้นฉบับเดิมไว้ครบ')){status.textContent='ยกเลิกการอ่านงานเดิม';return;}
        apply(next);status.textContent='อ่านข้อมูลเดิมพร้อมเพลท รอยเชื่อม พุก และโปรไฟล์แล้ว แยกน้ำหนักแปจาก DL ตามข้อมูลเดิม กดคำนวณใหม่ก่อนใช้ผล';
      }catch(e){status.textContent='อ่านงานเดิมไม่ได้: '+e.message;}
    }
    add('อ่านร่าง SC01 เดิม',()=>importOld(async()=>{const db=await openWorkspaceStore(),row=await db.read('concrete-sc01:inputs');return row.value??window.localStorage.getItem('ncy.connection.v5.draft');}));
    const picker=doc.createElement('input');picker.type='file';picker.accept='.json,application/json';picker.hidden=true;body.append(picker);
    add('อ่านไฟล์ SC01 เดิม',()=>{picker.value='';picker.click();});picker.onchange=()=>{const file=picker.files?.[0];if(file)importOld(()=>file.text());};
  }
  function handleShellEvent(e){
    const b=e.target.closest?.('button');if(!b||b.closest('.sm-controls')||b.closest('#sm-project-actions')||b.closest('#sm-report-dialog'))return false;
    let action=null;
    if(b.id==='sc01RunCalculation')action=calculateSelected;
    else if(b.id==='sc01ForceOpen')action=()=>openForce();
    else if(b.id==='sc01CoverageOpen')action=()=>{window.NCYSC01ForceInspector.close();stage('review');};
    else if(b.dataset.ncy670Stage)action=()=>stage(b.dataset.ncy670Stage);
    else if(b.id==='closeResults'||b.id==='inputToggle')action=()=>stage('input');
    else if(b.id==='closeInput')action=()=>stage('model');
    else if(b.id==='saveBtn')action=()=>{store?.save();if(store)store.panel.open=true;};
    else if(b.id==='loadBtn'||b.id==='g59Files'||b.id==='moreBtn')action=()=>{if(store)store.panel.open=!store.panel.open;};
    else if(b.matches('[data-sc01-report-profile-open]')||b.textContent.trim()==='โปรไฟล์รายงาน')action=()=>{stage('input');const el=root.querySelector('.sm-project');el.open=true;el.scrollIntoView({block:'start'});};
    else if(b.id==='sc01r12Report'||b.dataset.page==='a4')action=()=>{if(!openReport())stage('review');};
    else if(['iso','general','sc01-cad','sc01-plate','sc01-section'].includes(b.dataset.page))action=()=>{const page=b.dataset.page;window.NCYSC01ForceInspector.close();for(const el of workspace.children)el.hidden=el===curves?page!=='general':el===cad?page!=='sc01-cad':el===plateView?page!=='sc01-plate':el===plateSections?page!=='sc01-section':page!=='iso';for(const el of root.querySelectorAll('#pageTabs [data-page]')){el.classList.toggle('active',el===b);el.setAttribute('aria-pressed',String(el===b));}if(innerWidth<=920)stage('model');if(page==='general')requestAnimationFrame(renderCurves);if(page==='sc01-cad')renderCAD();if(page==='sc01-plate')openForce(plateView);if(page==='sc01-section')renderPlateSections();};
    else if(b.closest('#pageTabs')||b.closest('.rail'))action=()=>stage('input');
    if(!action)return false;e.preventDefault();e.stopImmediatePropagation();action();return true;
  }
  window.addEventListener('click',handleShellEvent,true);
  window.addEventListener('sc01:workspace-ready',shellStatus);
  new ResizeObserver(scheduleGeometry).observe(workspace);
  window.NCYSC01MemberWorkflow=Object.freeze({active:true,VERSION:'r40',calculate,calculateSelected,isSelecting:()=>selecting,getSelection:()=>selection?A.clone(selection):null,openReport,preparePrint,apply,handleShellEvent,
    capture:()=>A.clone(input),getResult:()=>result?A.clone(result):null,getLoadPath:()=>projection?A.clone(projection):null,
    getStore:()=>store,getDiagram:()=>diagramScene?.data?A.clone(diagramScene.data):null,getScene:()=>scene?.data?{native:scene.data.native,parts:scene.data.meshes.map(m=>({id:m.id,kind:m.kind,p:m.g.p.length,frameId:m.frameId})),supports:scene.data.supports,dimensions:scene.data.dims,annotations:scene.data.annotations,bounds:scene.data.bounds}:null});
  fill();shellStatus();stage('input');doc.body.dataset.sc01MemberWorkflow='r40';doc.body.dataset.sc01InputStorage='member-indexeddb';
}
