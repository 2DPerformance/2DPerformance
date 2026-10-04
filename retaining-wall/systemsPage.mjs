import { SYSTEM_DEFAULTS, SYSTEM_INPUT_KEYS, SYSTEM_TYPES,
  createSystemSnapshot, validateSystemInput, normalizeSystemCover,normalizeRearAnchorInput } from './systemsSnapshot.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import { mountWorkflow, restoreSessionDraft, readPreviousDraft, keepSessionDraft, formUrl, pageForceSections } from './workflow.mjs?rwv=20261003-final-acceptance-1&fix=20261004-validation-1';
import { duckDesignEquations, duckChecks, duckBars, duckForceFigures } from './duckfootPresentation.mjs?rwv=20261003-main-equations-1';
import { soldierDrawing, duckfootDrawing } from './inputDiagram.mjs?rwv=20261003-main-equations-1';
import { renderNativeCadView } from './nativeCadScreen.mjs?rwv=20261003-cad-contour-1';
import { DUCK_BEAM_CLEAR_DEFAULT } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { getPassingExample, initialDraftValues } from './passingExamples.mjs?rwv=20261003-main-equations-1';
import { summarizeSystemFailure } from './failureSummary.mjs?rwv=20260930-load-units-1';
import { DESIGN_PROFILES,soldierCapGeometry } from './engine.mjs?rwv=20261003-final-acceptance-1';
import { finalSectionSummary } from './finalSectionSummary.mjs?rwv=20261001-leader-layout-1';
import { resultUnits, displayedChecks, displayEngineText, displayedBbsRow } from './resultUnits.mjs?rwv=20261002-legacy-output-units-1&apd=20261003-cast-together-1';
import { inputUnit, inputFromDisplay, inputDisplayString, inputToDisplay, validateInputUnitMode } from './inputUnits.mjs?rwv=20261003-final-acceptance-1';
import {renderEquationLedger} from './equationLedger.mjs?rwv=20261003-final-acceptance-1';

import {renderRearAnchorActions} from './rearAnchorPresentation.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import {reportLoadTable,nativeEquationTables,reportScope,reportTable,essentialCheckRows,ESSENTIAL_REPORT_VERSION} from './essentialReport.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import {renderRbBeamSections} from './rbBeamSections.mjs?rwv=20261003-main-equations-1';
import {compactReportHtml,compactReportPages,COMPACT_REPORT_CSS} from './compactReport.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import {printableDocument} from './drafting/rwPrintDocument.js?rwv=20261003-all-sheets-1';
import {supportSymbolSvg,supportModelSvg} from './supportSymbols.mjs?rwv=20261003-support-symbols-1';
import {contourLegend} from './stressContour.mjs?rwv=20261003-cad-contour-1';

const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const fmt = (v, n = 2) => Number.isFinite(v) ? Number(v).toFixed(n) : '—';
const defs = {
  project: ['ชื่อโครงการ', '', 'text'],
  profile: ['มาตรฐาน', '', 'profile'],
  unitMode: ['หน่วยกรอกและรายงาน', '', 'units'],
  hp: ['ความสูงดิน H', 'ม.'], Lw: ['ความยาวกำแพง', 'ม.'],
  gs: ['น้ำหนักดิน γ', 'kN/ม³'], phi: ['มุมเสียดทาน φ', 'องศา'],
  gsat: ['น้ำหนักดินอิ่มตัว γsat', 'kN/ม³'],
  c: ['แรงยึดเกาะดิน c', 'kPa'], beta: ['ความลาดหลังพนัง β', 'องศา'],
  zw: ['ระดับน้ำลึกจากผิวดิน (ว่าง=ไม่มีน้ำ)', 'ม.'],
  qa: ['กำลังแบกทานยอมให้ qa', 'kPa'],
  q: ['Surcharge รวม q = DL + LL', 'kPa'],
  qD: ['DL คงที่บนผิวดิน', 'kPa'], qL: ['LL จรบนผิวดิน', 'kPa'],
  fc: ["กำลังคอนกรีต f′c", 'MPa'],
  rbCover:['หุ้มคาน RB ถึงผิวนอกปลอก','มม.'],rbAgg:['มวลรวมหยาบสูงสุดคาน RB','มม.'],
  fy: ['กำลังเหล็ก fy', 'MPa'],
  gc: ['น้ำหนักคอนกรีต γc', 'kN/ม³'],
  toe: ['Toe ด้านหน้า', 'ม.'], t: ['พนังโคน t', 'ม.'],
  ttop: ['พนังยอด', 'ม.'], heel: ['Heel ด้านหลัง', 'ม.'],
  B: ['ฐานรวม B', 'ม.'], hz: ['ฐานหนา', 'ม.'],
  L: ['ครีบห่าง', 'ม.'], bs: ['ครีบหนา', 'ม.'],
  pileB: ['เข็มสี่เหลี่ยมด้านกว้าง', 'ม.'], pileEmb: ['เข็มฝัง', 'ม.'],
  pileSt: ['ระยะเข็ม Toe', 'ม.'], pileSh: ['ระยะเข็ม Heel', 'ม.'],
  pileEdT: ['ขอบเข็ม Toe', 'ม.'], pileEdH: ['ขอบเข็ม Heel', 'ม.'],
  Ppile: ['กำลังอัด Pa', 'ตัน/ต้น'], pileLat: ['กำลังราบ', 'ตัน/ต้น'],
  pileTen: ['กำลังถอนเข็ม (0=Engine ประมาณ)', 'ตัน/ต้น'],
  pileBatT: ['มุมเข็ม Toe', 'องศา'], pileBatH: ['มุมเข็ม Heel', 'องศา'],
  ipile: ['เข็มตัวไอ I', 'ซม.', 'ipile'], pileS: ['ระยะเข็ม S', 'ม.'],
  pileEmbS: ['ฝัง D (0=Auto)', 'ม.'], tLag: ['แผ่นเสียบหนา', 'ซม.'],
  soldierSys: ['ระบบยึดรั้ง', '', 'soldier'],
  frontBeamMode:['คานตามแนวกำแพง','','frontBeam'],
  weepN: ['ระดับระบายน้ำ', '', 'weep'],
  stayLvl: ['จุดยึดรั้งจากยอด (0=Auto)', 'ม.'],
  stayLb:['ระยะราบ Lb (0=Auto)','ม.'],capLvl:['หัวสมอลึก hcap (0=Auto)','ม.'],
  ancLe:['เข็มสมอยาว La (0=Auto)','ม.'],ancPileSec:['เข็มสมอ Ia','ซม.','ipile'],
  ancSu:['Su ดินรอบเข็มสมอ · วิธี α','kPa'],ancAlpha:['ตัวคูณยึดเกาะ α',''],
  stayBw:['สเตย์กว้าง b','ซม.'],stayBh:['สเตย์ลึก h','ซม.'],
  ancCapB:['แคปกว้าง X (0=รูปเบื้องต้น)','ม.'],ancCapL:['แคปยาว Z (0=รูปเบื้องต้น)','ม.'],ancCapH:['แคปหนา (0=รูปเบื้องต้น)','ม.'],
  ancDowelDb:['ขนาดเหล็กเดือย APd','มม.','dowel'],ancDowelN:['จำนวน APd (0=Engine เลือก)','เส้น/สมอ'],
  stayAng:['มุม Ground anchor','องศา'],gaFreeLength:['ความยาวอิสระ Lfree','ม.'],
  gaBondLength:['ความยาวยึดเหนี่ยว Lbond','ม.'],gaBondDia:['เส้นผ่านศูนย์กลาง grout','มม.'],
  gaBondStress:['แรงยึดเหนี่ยวยอมให้จากผลทดสอบ','kPa'],
  gaTendonCapacity:['กำลังดึงยอมให้ชุด tendon/หัวสมอ','kN'],
  gaTendonSpec:['รายละเอียด tendon/หัวสมอ','','text'],gaGroutSpec:['รายละเอียด grout','','text'],
  gaProtectionSpec:['ระบบป้องกันการกัดกร่อน','','text'],
  capL: ['ฐานยาวตามแนวเสา', 'ม.'], postSpacing: ['ระยะห่างเสาตามแนว', 'ม.'],
  nPosts: ['จำนวนเสาในแนวเดียวกัน', 'ต้น'],
  beamB: ['คานตีนเสากว้าง', 'ม.'], beamH: ['คานตีนเสาลึก', 'ม.'],
  beamClear: ['ผิวบนฐานถึงท้องคาน', 'ม.'],
  colDepth: ['เสาลึกในผัง', 'ม.'],
  Npost: ['แรงอัดยอดเสารวม N = DL + LL', 'kN'],
  NpostD: ['DL ที่ยอดเสา (ไม่รวมน้ำหนักตัวเอง)', 'kN'],NpostL: ['LL ที่ยอดเสา', 'kN'],
  Hpost: ['แรงราบที่ยอดเสา H', 'kN'],
  Mpost: ['โมเมนต์ที่ยอดเสา M', 'kN·m'],
  factorN:['ตัวคูณ DL โครงการ γD',''],factorL:['ตัวคูณ LL โครงการ γL',''],factorH:['ตัวคูณแรงราบ/โมเมนต์ γH',''],
  cov:['ระยะหุ้มเสา/คาน','มม.'],mu:['ความฝืดใต้ฐาน μ',''],qBeam:['โหลดเพิ่มบนคานรวม DL + LL','kN/ม.'],
  qBeamD:['DL เพิ่มบนคาน','kN/ม.'],qBeamL:['LL เพิ่มบนคาน','kN/ม.'],
};
const pileFields = ['pileB', 'pileEmb', 'pileSt', 'pileSh', 'pileEdT', 'pileEdH', 'Ppile', 'pileTen', 'pileLat', 'pileBatT', 'pileBatH'];
for(const p of ['rb1','rb2','rb3'])Object.assign(defs,{
  [p+'Bw']:['คานกว้าง (0=Auto)','ซม.'],[p+'Bh']:['คานลึก (0=Auto)','ซม.'],
  [p+'Db']:['เหล็กหลัก','มม.','beamMain'],[p+'Nt']:['เหล็กบน (0=Auto)','เส้น'],[p+'Nb']:['เหล็กล่าง (0=Auto)','เส้น'],
  [p+'Ldb']:['ปลอก','มม.','beamLink'],[p+'Lsp']:['ระยะปลอก (0=Auto)','ซม.']});
const soilFields = ['gs', 'phi', 'gsat', 'c', 'beta', 'qa', 'zw'];
const groups = {
  pile: [
    ['ขนาดกำแพงและฐาน', ['hp', 'Lw', 'toe', 't', 'ttop', 'heel', 'B', 'hz'], 'ขนาด'],
    ['ขนาดและตำแหน่งเสาเข็ม', pileFields.slice(0,6), 'เสาเข็ม'],
    ['กำลังและมุมเสาเข็ม', pileFields.slice(6), 'กำลังเข็ม'],
    ['ข้อมูลดินและน้ำ', soilFields, 'ดิน / น้ำ'],
    ['โหลดใช้งานบนผิวดิน', ['qD', 'qL', 'q'], 'แรงกระทำ'],
    ['วัสดุและมาตรฐาน', ['unitMode', 'fc', 'fy', 'gc', 'cov', 'profile'], 'วัสดุ'],
  ],
  pilecf: [
    ['ขนาดกำแพงและฐาน', ['hp', 'Lw', 'toe', 't', 'ttop', 'heel', 'B', 'hz'], 'ขนาด'],
    ['ขนาดและระยะครีบ', ['L','bs'], 'ครีบ'],
    ['ขนาดและตำแหน่งเสาเข็ม', pileFields.slice(0,6), 'เสาเข็ม'],
    ['กำลังและมุมเสาเข็ม', pileFields.slice(6), 'กำลังเข็ม'],
    ['ข้อมูลดินและน้ำ', soilFields, 'ดิน / น้ำ'],
    ['โหลดใช้งานบนผิวดิน', ['qD', 'qL', 'q'], 'แรงกระทำ'],
    ['วัสดุและมาตรฐาน', ['unitMode', 'fc', 'fy', 'gc', 'cov', 'profile'], 'วัสดุ'],
  ],
  soldier: [
    ['ขนาดเสาเข็มพืดและแผ่นเสียบ', ['hp', 'Lw', 'ipile', 'pileS', 'pileEmbS', 'tLag', 'soldierSys', 'stayLvl','frontBeamMode'], 'ขนาด'],
    ['ข้อมูลดิน น้ำ และการระบาย', ['gs', 'phi', 'gsat', 'c', 'zw', 'weepN'], 'ดิน / น้ำ'],
    ['โหลดใช้งานบนผิวดิน', ['qD', 'qL', 'q'], 'แรงกระทำ'],
    ['วัสดุและมาตรฐาน', ['unitMode', 'fc', 'fy', 'profile', 'rbCover', 'rbAgg'], 'วัสดุ'],
  ],
  duckfoot: [
    ['เสาชิดเขตและฐานแผ่ยื่นด้านเดียว', ['hp', 't', 'colDepth', 'B', 'capL', 'hz'], 'ขนาด'],
    ['คานเชื่อมเสาเหนือ footing', ['nPosts', 'postSpacing', 'beamB', 'beamH', 'beamClear'], 'แนวเสา / คาน'],
    ['โหลดใช้งานและตัวคูณแรงโครงการ', ['NpostD','NpostL','Npost','Hpost','Mpost','qBeamD','qBeamL','qBeam','factorN','factorL','factorH'], 'แรงกระทำ'],
    ['วัสดุและดิน · กำลังหน้าตัด ACI 318-14', ['unitMode','fc','fy','gc','cov','qa','mu'], 'วัสดุ / ดิน'],
  ],
};
const systemGuides = {
  pile: {
    use: 'พนังยื่นบนฐานที่ถ่ายแรงลงกลุ่มเสาเข็มแถว Toe/Heel เมื่อโครงการกำหนดระบบฐานรากเสาเข็ม',
    path: 'แรงดิน → พนังยื่น → ฐาน → เข็มสองแถว',
    input: 'ขนาดและระยะเข็ม กำลังเข็มจากข้อมูลโครงการ ดิน และระดับน้ำ',
  },
  pilecf: {
    use: 'พนังที่มีครีบเชื่อมกับฐานเป็นช่วง ๆ และฐานถ่ายแรงลงเข็มสองแถว',
    path: 'แรงดิน → แถบพนังระหว่างครีบ → ครีบ/ฐาน → เข็ม',
    input: 'ระยะและขนาดครีบ รวมทั้งข้อมูลเข็ม ดิน และระดับน้ำเช่นเดียวกับแบบพนังยื่น',
  },
  soldier: {
    use: 'แนวเสาเข็มตัวไอกับแผ่นเสียบที่รับแรงดินตามแนวขุด',
    path: 'แรงดิน/น้ำ → แผ่นเสียบ → เข็มฝังดินและระบบยึดรั้งที่เลือก',
    input: 'เลือกระบบยึดรั้ง ระดับน้ำ และการระบาย; Ground anchor ต้องกรอกความยาว ขนาด กำลังยึดเหนี่ยว และกำลังชุดสมอจากข้อมูลโครงการ',
  },
  duckfoot: {
    use: 'แนวเสาชิดเขตที่ต้องให้ฐานแผ่ยื่นเข้าที่ดินด้านเดียว; เป็นฐานเสา ไม่ใช่ผนังกำแพงกันดิน',
    path: 'คานเหนือ footing → เสาตามแนวเขต → ฐานแผ่รายเสา; N/H/M ที่ยอดเสารวมลงฐานเดียวกัน',
    input: 'ระบุแรงใช้งานต่อเสา ขนาดฐาน/คาน และข้อมูลดินจริง; ไม่มีเข็ม ไม่มีสเตย์',
  },
};

function guideHtml(guide) {
  return '<p><b>ใช้เมื่อ:</b> ' + esc(guide.use) + '</p>'
    + '<p><b>ทางรับแรง:</b> ' + esc(guide.path) + '</p>'
    + '<p><b>ต้องระบุ:</b> ' + esc(guide.input) + '</p>';
}
const drafts = new Map();
const duckDefaults = {
  wtype: 'duckfoot', project: '', profile: 'thai2566', gc: 24,
  hp: 2.3, t: .15, colDepth: .15, hz: .25, B: 1.5,
  capL: 1.2, postSpacing: 2.5, nPosts: 4, beamB: .20, beamH: .40, beamClear: DUCK_BEAM_CLEAR_DEFAULT,
  Npost: 100, Hpost: 10, Mpost: 0,
  factorN:1.4,factorH:1.7,qBeam:0,fc:24,fy:390,cov:40,qa:150,mu:.5,
};
let type = new URLSearchParams(location.search).get('type');
if (!SYSTEM_TYPES[type]) type = 'pile';
let draft = initialDraftValues(type);
let snap = null;
let snapKey = '';
let pane = 'plan';
let viewer = null;
let renderToken = 0;
let error = '';
let errorField = '';
let workflow = null;

function prepareDraft(value, systemType) {
  const prepared={...normalizeRearAnchorInput(normalizeSystemCover(value,systemType),systemType)};
  if(systemType!=='duckfoot'&&!Object.hasOwn(value,'qD')&&!Object.hasOwn(value,'qL')) {
    prepared.qD=0; prepared.qL=value.q;
  }
  if(systemType==='duckfoot') {
    for(const [total,dead,live] of [['Npost','NpostD','NpostL'],['qBeam','qBeamD','qBeamL']])
      if(!Object.hasOwn(value,dead)&&!Object.hasOwn(value,live)){prepared[dead]=value[total];prepared[live]=0;}
    if(!Object.hasOwn(value,'factorL'))prepared.factorL=1.7;
  }
  prepared.unitMode=validateInputUnitMode(Object.hasOwn(value,'unitMode')?value.unitMode:'si');
  return prepared;
}

function rememberDraft() {
  keepSessionDraft(type, { schema: 'rw01-systems-draft/2', type, draft: visibleDraft(draft, type) });
}
function restoreDraft(nextType) {
  const saved = restoreSessionDraft(nextType);
  if (saved?.schema !== 'rw01-systems-draft/2' || saved.type !== nextType || !saved.draft) return null;
  const values = prepareDraft(visibleDraft(saved.draft, nextType), nextType);
  for (const key of Object.keys(values)) {
    if (values[key] === null && !['project', 'profile', 'wtype', 'soldierSys'].includes(key)) values[key] = NaN;
  }
  return { ...(nextType === 'duckfoot' ? duckDefaults : SYSTEM_DEFAULTS), ...values, wtype: nextType };
}
draft = prepareDraft(restoreDraft(type) || draft, type);

const fieldLabel=(key,systemType)=>systemType==='duckfoot'&&key==='hp'?'ผิวบนฐานถึงยอดเสา H':
  systemType==='duckfoot'&&key==='t'?'เสากว้างตั้งฉากแนวเขต':
    systemType==='soldier'&&key==='pileTen'?'กำลังถอนยอมให้ทั้งระบบ (0=ประมาณ)':
    key==='cov'&&['pile','pilecf'].includes(systemType)?'ระยะหุ้มเหล็กพนัง / ครีบ':defs[key][0];

function field(key) {
  const [, canonicalUnit, kind] = defs[key];
  const unit = inputUnit(key,draft.unitMode || 'si',canonicalUnit);
  const shownLabel = fieldLabel(key,type);
  let control;
  if (kind === 'units') {
    control = '<select data-key="unitMode"><option value="si">SI · kN / kPa / MPa</option><option value="kgf">kgf · kgf/m² / kgf/cm²</option></select>';
  } else if (kind === 'profile') {
    control = '<select data-key="' + key + '"><option value="thai2566">SDM · กฎกระทรวง 2566</option><option value="aci318">SDM · ACI 318-14</option><option value="wsd">WSD · กฎกระทรวง 2566</option></select>';
  } else if (kind === 'soldier') {
    control = '<select data-key="' + key + '"><option value="stay">คานสเตย์</option><option value="cant">เข็มยื่น</option><option value="anchor">Ground anchor</option></select>';
  } else if(kind==='beamMain'||kind==='beamLink'){
    const sizes=kind==='beamMain'?[12,16,20,25,32]:[6,9,10,12],prefix=kind==='beamMain'?'DB':'RB';
    control='<select data-key="'+key+'"><option value="0">Auto</option>'+sizes.map(v=>'<option value="'+v+'">'+prefix+v+'</option>').join('')+'</select>';
  } else if(kind==='frontBeam'){
    control='<select data-key="frontBeamMode"><option value="none">ไม่มีคานตามแนวกำแพง</option><option value="waler">มีคาน คสล. เฉพาะระดับยึดรั้ง</option><option value="legacy">คานตามแบบเดิม 2–3 ระดับ</option></select>';
  } else if (kind === 'dowel') {
    control='<select data-key="'+key+'">'+[12,16,20,25,32].map(v=>'<option value="'+v+'">DB'+v+'</option>').join('')+'</select>';
  } else if (kind === 'ipile') {
    control = '<select data-key="' + key + '">'
      + [18, 22, 26, 30, 35, 40, 45].map((v) =>
        '<option value="' + v + '">I-' + v + '</option>').join('') + '</select>';
  } else if (kind === 'weep') {
    control = '<select data-key="' + key + '">'
      + '<option value="0">0 · ไม่ระบาย (แรงน้ำเต็ม)</option>'
      + '<option value="1">1 · Engine คิดแรงน้ำครึ่งหนึ่ง</option>'
      + '<option value="2">2 · Engine สมมติระบายเต็ม</option></select>';
  } else {
    const text = kind === 'text';
    control = '<input data-key="' + key + '" type="' + (text ? 'text' : 'number') + '"'
      + (text ? ' maxlength="100"' : ' step="any"')
      + (['q','Npost','qBeam'].includes(key) || key === 'B' && type !== 'duckfoot' ? ' readonly aria-readonly="true"' : '') + '>';
  }
  return '<label class="' + (['project','profile','unitMode','q'].includes(key) ? 'wide' : '') + '">'
    + esc(shownLabel) + (unit ? ' <small>(' + esc(unit) + ')</small>' : '') + control + '</label>';
}

function drawFields() {
  $('systemGuide').innerHTML = '<details><summary>การใช้รูปแบบนี้และทางรับแรง</summary>'+guideHtml(systemGuides[type])+'</details>';
  $('commonFields').innerHTML = field('project');
  const extraGroups=type==='soldier'&&draft.soldierSys==='anchor'?
    [['Ground anchor · ขนาดและกำลัง',['stayAng','gaFreeLength','gaBondLength','gaBondDia','gaBondStress','gaTendonCapacity'],'สมอ'],['Ground anchor · รายละเอียดติดตั้ง',['gaTendonSpec','gaGroutSpec','gaProtectionSpec'],'ติดตั้งสมอ']]:type==='soldier'&&draft.soldierSys==='stay'?
    [['สเตย์ V และเข็มสมอ',['stayLb','capLvl','ancLe','ancPileSec','stayBw','stayBh'],'สเตย์ / สมอ'],
      ['กำลังถอนเข็มสมอ · จากข้อมูลโครงการ',['ancSu','ancAlpha','pileTen'],'ดินเข็มสมอ'],
      ['ฐานหัวเข็มสมอและเหล็กเดือย',['ancCapB','ancCapL','ancCapH','ancDowelDb','ancDowelN'],'แคป / APd']]:[];
  const hasRb2=draft.soldierSys!=='cant'&&(+draft.stayLvl>0?+draft.stayLvl:Math.min(Math.max(+draft.hp/4,.8),+draft.hp-.2))>.25;
  const selectedBeams=type==='soldier'?soldierCapGeometry(draft,+draft.hp,+draft.ipile/100,hasRb2?1:0,draft.soldierSys!=='cant').filter(b=>b.present).map(b=>b.prefix):[];
  const beamGroups=selectedBeams.map(p=>[
    p.toUpperCase()+' · คานรัด'+({rb1:'หัวเข็มบนสุด',rb2:'ระดับยึดรั้ง',rb3:'ระดับขุด'}[p]),
    ['Bw','Bh','Db','Nt','Nb','Ldb','Lsp'].map(s=>p+s),p.toUpperCase()]);
  const shownGroups=[groups[type][0],...extraGroups,...beamGroups,...groups[type].slice(1)].map(([title,keys,label])=>
    [title,type==='soldier'&&!selectedBeams.length?keys.filter(k=>!['rbCover','rbAgg'].includes(k)):keys,label]);
  $('systemFields').innerHTML = shownGroups.map(([title, keys, label]) =>
    '<section data-input-group="'+keys[0]+'" data-group-label="'+esc(label)+'"><h2>' + esc(title) + '</h2><div class="field-grid">' + keys.map(field).join('') + '</div></section>').join('');
  document.querySelectorAll('[data-key]').forEach((el) => {
    const key=el.dataset.key;
    el.value = key === 'zw' && Number(draft.zw) === 99 ? ''
      : el.type === 'number' ? inputDisplayString(key,draft[key],draft.unitMode) : draft[key] ?? '';
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', onInput);
  });
  document.querySelectorAll('[data-type]').forEach((button) => {
    button.setAttribute('aria-selected', String(button.dataset.type === type));
  });
  document.querySelector('[data-type="' + type + '"]')?.scrollIntoView({
    block: 'nearest', inline: 'center',
  });
  document.querySelector('.input-note').textContent = type === 'duckfoot'
    ? 'กรอกแรงใช้งานต่อเสาเท่ากันทุกต้น · กำลังหน้าตัด ACI 318-14; ตัวคูณแรงเป็นค่าของโครงการที่กรอก · ฐานหุ้ม 75 มม.'
    : type === 'soldier'
      ? 'ระดับน้ำว่าง = ไม่มีน้ำ; 0 = น้ำถึงผิวดิน · จำนวนระดับระบายน้ำเป็นสมมติฐานของ Engine ต้องยืนยันหน้างาน · REVIEW / NOT FOR CONSTRUCTION'
      : 'ระดับน้ำว่าง = ไม่มีน้ำ; 0 = น้ำถึงผิวดิน · ระยะหุ้มพนัง/ครีบตามกรอก; ฐาน 75 มม. · กำลังเข็มและค่า qa ต้องอ้างข้อมูลโครงการ · REVIEW / NOT FOR CONSTRUCTION';
  workflow?.refreshInputGuide();
  workflow?.refreshInputGroups();
}

function currentKey() {
  const physical={...draft}; delete physical.unitMode;
  return JSON.stringify({ type, draft:physical });
}

function syncB() {
  if (type === 'soldier' || type === 'duckfoot') return;
  draft.B = Number(draft.toe) + Number(draft.t) + Number(draft.heel);
  const b = document.querySelector('[data-key="B"]');
  if (b) b.value = Number.isFinite(draft.B) ? fmt(draft.B, 3).replace(/0+$/, '').replace(/\.$/, '') : '';
}

function onInput(event) {
  const el = event.currentTarget, key = el.dataset.key;
  if(key==='unitMode') {
    draft.unitMode=validateInputUnitMode(el.value); drafts.set(type,{...draft});
    try {rememberDraft();} catch {workflow?.notice('บันทึกร่างไม่ได้ กรุณาบันทึกไฟล์');}
    drawFields(); if(snap)refreshOutputViews(); setState(); return;
  }
  draft[key] = key === 'zw' && el.value === '' ? 99
    : el.type === 'number' ? inputFromDisplay(key,el.value,draft.unitMode)
      : key === 'weepN' ? Number(el.value) : el.value;
  if(key==='qD'||key==='qL') {
    draft.q=Number(draft.qD)+Number(draft.qL);
    const total=document.querySelector('[data-key="q"]');
    if(total)total.value=inputDisplayString('q',draft.q,draft.unitMode);
  }
  for(const [total,dead,live] of [['Npost','NpostD','NpostL'],['qBeam','qBeamD','qBeamL']])
    if(key===dead||key===live){draft[total]=Number(draft[dead])+Number(draft[live]);
      const control=document.querySelector('[data-key="'+total+'"]');
      if(control)control.value=inputDisplayString(total,draft[total],draft.unitMode);}
  if (['toe', 't', 'heel'].includes(key)) syncB();
  if(key==='soldierSys'||key==='frontBeamMode')drawFields();
  drafts.set(type, { ...draft });
  error = '';
  $('error').textContent = '';
  try { rememberDraft(); } catch { workflow?.notice('เก็บร่างในแท็บไม่ได้ กรุณาบันทึกไฟล์ก่อนสลับรูปแบบ'); }
  if (snap && snapKey !== currentKey()) {
    disposeViewer();
    snap = null;
    renderCurrent();
  } else setState();
}

function setType(next) {
  if (next === type) return;
  rememberDraft();
  if (!SYSTEM_TYPES[next]) {
    workflow.navigateType(next,formUrl(next));
    return;
  }
  drafts.set(type, { ...draft });
  const project = draft.project;
  type = next;
  const existing = drafts.get(type) || restoreDraft(type);
  draft = prepareDraft(initialDraftValues(type, existing),type);
  if (!existing) draft.project = project;
  draft.wtype = type;
  if (type === 'duckfoot') draft.profile = 'thai2566';
  if (type !== 'soldier' && type !== 'duckfoot') {
    draft.B = Number(draft.toe) + Number(draft.t) + Number(draft.heel);
  }
  snap = null; snapKey = ''; error = '';
  $('error').textContent = '';
  workflow?.setType(type);
  workflow?.notice('');
  disposeViewer();
  drawFields();
  document.querySelector('.inputs').scrollTop = 0;
  renderCurrent();
  setPane('plan');
}

function setPane(next) {
  pane = next;
  workflow?.show(next);
  document.querySelectorAll('[data-pane]').forEach((button) =>
    button.setAttribute('aria-selected', String(button.dataset.pane === pane)));
  document.querySelectorAll('.pane').forEach((el) => el.classList.toggle('active', el.id === pane + 'Pane'));
  if (pane === 'model' && snap) mountViewer();
}

function setState() {
  const status = snap ? snap.status : 'STALE';
  const failure = status === 'FAIL' ? summarizeSystemFailure({...snap, checks:checkRows(snap),
    recommendations:snap.recommendations?.map(row=>({...row,value:outputText(row.value)}))}) : null;
  $('state').dataset.status = status;
  $('stateTag').textContent = snap ? status : 'INPUT';
  $('stateTitle').textContent = snap ? SYSTEM_TYPES[type] + ' · ' + (status === 'FAIL'
    ? 'ไม่ผ่าน ' + (failure?.count || 0) + ' รายการ' : 'ผ่านรายการตรวจที่คำนวณ')
    : 'ยังไม่มีผลคำนวณปัจจุบัน';
  $('stateReason').textContent = snap ? snap.authority : error || 'กรอกขนาดและแรงกระทำ แล้วกดคำนวณระบบนี้';
  $('stateStamp').textContent = snap ? 'ผลชุดเดียว · ' + new Date(snap.stamp).toLocaleString('th-TH') : '';
  $('print').disabled = !snap;
  $('png').disabled = !snap || !viewer;
  workflow?.setState({ state: error ? 'ERROR' : status,
    title: error ? 'ข้อมูลยังคำนวณไม่ได้' : $('stateTitle').textContent,
    detail: $('stateReason').textContent, failure, ready: !!snap,
    validationErrors:error?[{field:errorField,message:error}]:[] });
  if (parent !== window) {
    parent.postMessage({ type: 'rw:workbench-state', state: 'READY', marker: 'rw01-systems' }, location.origin);
  }
}

const empty = (message) => '<div class="empty"><b>ยังไม่มีผลที่ใช้ได้</b><p>'
  + esc(message) + '</p></div>';
const outputUnits=()=>resultUnits(draft.unitMode||'si');
const qu=unit=>outputUnits().label(unit);
const qn=(x,unit,p=2)=>outputUnits().format(x,unit,p);
const checkRows=s=>displayedChecks(s,draft.unitMode||'si');
const outputText=text=>displayEngineText(text,draft.unitMode||'si');
const number = (x, p = 2) => x == null || x === '' ? '—' : fmt(Number(x), p);
const svgText = (x, y, text, extra = '') => '<text x="' + x + '" y="' + y
  + '" font-size="15" font-family="Prompt,Sarabun,sans-serif" fill="#344b60" ' + extra
  + '>' + esc(text) + '</text>';
const supportPointSvg = (x, y, kind) => '<circle data-support="' + esc(kind)
  + '" cx="' + x + '" cy="' + y
  + '" r="9" fill="#fff" stroke="#a65c15" stroke-width="3"/>'
  + '<circle cx="' + x + '" cy="' + y + '" r="2.4" fill="#a65c15"/>';
const supportBandSvg = (x, y, width, kind) => '<path data-support="' + esc(kind)
  + '" d="M' + x + ' ' + y + 'h' + Math.max(0, width)
  + '" stroke="#a65c15" stroke-width="7" stroke-linecap="square"/>';

function supportDescription(s) {
  if (s.type === 'pile' || s.type === 'pilecf') {
    const p = s.forces.pile;
    return 'วงแหวนสีส้ม = จุดต่อหัวเข็มแถว Toe/Heel; แรงแกนต่อเข็ม '
      + qn(p.axT,'tf/ต้น') + ' / ' + qn(p.axH,'tf/ต้น') + (' ' + qu('ตัน') + ' เทียบ Pa ')
      + qn(p.Pa,'tf/ต้น') + (' ' + qu('ตัน/ต้น') + ' · จุดต่อไม่ใช่ข้อต่อ pin/fixed');
  }
  if (s.type === 'soldier') {
    return s.geometry.staySystem === 'cant'
      ? 'แถบสีส้ม = ดินรับแรงกระจายตามช่วงฝัง; ไม่มีจุดยึดรั้งภายนอกและไม่สมมติปลายเข็มเป็น fixed'
      : 'วงแหวนสีส้ม = จุดต่อระบบยึดรั้งที่ระดับ ' + number(s.geometry.stayLevel)
        + ' ม. จากยอด; แถบสีส้ม = ดินรับแรงกระจายตามช่วงฝัง · กำลังยึดรั้งต้องตรวจแยก';
  }
  return 'วงแหวนสีส้ม = จุดต่อเสา–ฐาน และคาน–เสา; แถบสีส้ม = พื้นที่สัมผัสดินใต้ฐานรายเสา'
    + ' · ไม่มีเข็มหรือสเตย์ · แรงกดแยกทุกฐาน';
}

// Reports retain their equation-page figures; the complete A4 CAD sheets already
// use nativeCadViews. Screen views now use those same physical CAD primitives.
const planSvg=s=>renderNativeCadView(s,'plan');
const sectionSvg=s=>renderNativeCadView(s,'section');

function reportPlanSvg(s) {
  const g = s.geometry;
  if(s.type==='soldier')return soldierDrawing(g,'plan');
  if(s.type==='duckfoot')return duckfootDrawing(g,'plan','',s.equilibrium);
  // Both axes follow the frozen geometry. They are laid out independently so
  // a 200 m wall remains readable beside its much narrower footing width.
  const x0=70,y0=79,w=400,h=132,sx=w/g.Lw,sy=h/g.B;
  const y=x=>y0+x*sy,stemFront=y(g.toe),stemBack=y(g.toe+g.t);
  let body='<svg viewBox="0 0 540 326" role="img" aria-label="ผังฐานและหัวเข็มจากผลคำนวณ">'
    +'<rect x="18" y="18" width="504" height="290" fill="#f9fbfc"/>'
    +'<rect x="'+x0+'" y="'+y0+'" width="'+w+'" height="'+h+'" fill="#e4ebf0" stroke="#496579" stroke-width="2"/>'
    +'<rect x="'+x0+'" y="'+stemFront+'" width="'+w+'" height="'+Math.max(1.5,g.t*sy)
    +'" fill="#8ba2b4" stroke="#38536d" stroke-width="1.5"/>';
  if(s.type==='pilecf'){
    const count=Math.max(2,g.ribCount),shown=Math.min(count,9),thickness=Math.max(2,g.ribThickness*sx);
    for(let k=0;k<shown;k++){
      const index=Math.round(k*(count-1)/(shown-1));
      const z=Math.min(index*g.ribCentreSpacing,g.Lw-g.ribThickness);
      body+='<rect data-member="counterfort" x="'+(x0+z*sx)+'" y="'+stemBack
        +'" width="'+thickness+'" height="'+(g.ribLength*sy)
        +'" fill="#526f85" opacity=".85"/>';
    }
  }
  for(const [centre,spacing,row] of [[g.pileToeX,g.pileSt,'toe'],[g.pileHeelX,g.pileSh,'heel']]){
    const count=Math.max(2,Math.round(g.Lw/spacing)+1),shown=Math.min(count,9);
    for(let k=0;k<shown;k++){
      const index=Math.round(k*(count-1)/(shown-1));
      const cx=x0+index/(count-1)*w,cy=y(centre);
      body+='<circle cx="'+cx+'" cy="'+cy+'" r="5" fill="#294968"/>'
        +supportPointSvg(cx,cy,'pile-head-'+row);
    }
  }
  const cut=x0+w*.28;
  body+='<path data-section-cut="A-A" d="M'+cut+' '+(y0-10)+'V'+(y0+h+10)
    +'" stroke="#a65c15" stroke-width="1.5" stroke-dasharray="6 4"/>'
    +svgText(cut+6,y0-10,'A','font-size="12"')
    +svgText(cut+6,y0+h+20,'A','font-size="12"')
    +svgText(x0,y0-20,'TOE · ด้านหน้า','font-size="13"')
    +svgText(x0,y0+h+29,'HEEL · ดินถม','font-size="13"')
    +svgText(270,258,'Lw '+number(g.Lw)+' ม. · B '+number(g.B)+' ม.','text-anchor="middle" font-size="13"')
    +svgText(270,281,'Toe '+number(g.toe)+' · t '+number(g.t)+' · Heel '+number(g.heel)
      +' · sT/sH '+number(g.pileSt)+'/'+number(g.pileSh)+' ม.','text-anchor="middle" font-size="12"')
    +svgText(270,307,'แสดงหัวเข็ม/ครีบบางตำแหน่ง · จำนวนรวมจาก Engine '+s.quantities.piles+'/'+s.quantities.ribs,
      'text-anchor="middle" font-size="11"')+'</svg>';
  return body;
}

function reportSectionSvg(s) {
  const g = s.geometry;
  if(s.type==='soldier')return soldierDrawing(g,'section');
  if(s.type==='duckfoot')return duckfootDrawing(g,'section','',s.equilibrium);
  const rise=Math.max(0,g.heel)*Math.tan(Math.max(0,Math.min(30,s.input.beta||0))*Math.PI/180);
  const sx=Math.min(350/Math.max(g.B,.001),95),wallScale=105/Math.max(g.hp,.001);
  const pileScale=64/Math.max(g.pileEmb,.001);
  const risePx=Math.min(18,rise*wallScale);
  const baseW=g.B*sx,x0=(540-baseW)/2,wallTop=27+risePx;
  const baseTop=wallTop+105,baseBottom=baseTop+14,pileBottom=baseBottom+64;
  const X=x=>x0+x*sx,topT=g.ttop>0&&g.ttop<g.t-.005?g.ttop:g.t;
  const front=X(g.toe),backBase=X(g.toe+g.t),backTop=X(g.toe+topT);
  const soilRight=Math.min(505,X(g.B)+17),soilTopFar=wallTop-risePx;
  let body='<svg viewBox="0 0 540 310" role="img" aria-label="รูปตัดฐาน พนัง ดินถม และเข็มจากผลคำนวณ">'
    +'<rect x="18" y="18" width="504" height="274" fill="#f9fbfc"/>'
    +'<path d="M'+backBase+' '+baseTop+'L'+backTop+' '+wallTop+'L'+soilRight+' '+soilTopFar
      +'V'+baseTop+'Z" fill="#e7dfcd" stroke="none"/>'
    +'<path d="M'+backTop+' '+wallTop+'L'+soilRight+' '+soilTopFar
      +'" stroke="#8b7655" stroke-width="1.5" fill="none"/>'
    +'<rect x="'+x0+'" y="'+baseTop+'" width="'+baseW+'" height="14" fill="#849aad" stroke="#38536d" stroke-width="1.5"/>'
    +'<path d="M'+front+' '+baseTop+'V'+wallTop+'H'+backTop+'L'+backBase+' '+baseTop
      +'Z" fill="#b6c2cd" stroke="#38536d" stroke-width="1.5"/>';
  if(s.type==='pilecf')body+='<path data-member="counterfort" d="M'+backBase+' '+(baseTop-g.ribHeight*wallScale)
    +'L'+X(Math.min(g.B,g.toe+g.t+g.ribLength))+' '+baseTop+'H'+backBase
    +'Z" fill="#748ca0" opacity=".72"/>';
  for(const [centre,batter,row] of [[g.pileToeX,s.input.pileBatT,'toe'],[g.pileHeelX,s.input.pileBatH,'heel']]){
    const head=X(centre),tip=head-g.pileEmb*Math.tan((batter||0)*Math.PI/180)*pileScale;
    body+='<path data-member="pile-'+row+'" d="M'+head+' '+baseBottom+'L'+tip+' '+pileBottom
      +'" fill="none" stroke="#294968" stroke-width="'+Math.max(5,g.pileB*sx)+'"/>'
      +supportPointSvg(head,baseBottom,'pile-head-'+row);
  }
  body+='<path data-dimension="H" d="M48 '+wallTop+'V'+baseTop
    +'M43 '+wallTop+'h10M43 '+baseTop+'h10" stroke="#597084" fill="none"/>'
    +'<path data-dimension="pileEmb" d="M490 '+baseBottom+'V'+pileBottom
    +'M485 '+baseBottom+'h10M485 '+pileBottom+'h10" stroke="#597084" fill="none"/>'
    +'<path data-dimension="B" d="M'+x0+' 254H'+(x0+baseW)
    +'M'+x0+' 249v10M'+(x0+baseW)+' 249v10" stroke="#597084" fill="none"/>'
    +svgText(40,(wallTop+baseTop)/2,'H '+number(g.hp)+' ม.','text-anchor="middle" dominant-baseline="central" transform="rotate(-90 40 '+((wallTop+baseTop)/2)+')" font-size="12"')
    +svgText(480,(baseBottom+pileBottom)/2,'Le '+number(g.pileEmb)+' ม.','text-anchor="end" font-size="12"')
    +svgText(270,272,'B '+number(g.B)+' · hz '+number(g.hz)+' · Toe '+number(g.toe)
      +' · t '+number(g.t)+' · Heel '+number(g.heel)+' ม.','text-anchor="middle" font-size="12"')
    +svgText(270,295,'○ = จุดต่อหัวเข็ม ไม่ใช่ pin/fixed · ช่วงเข็มย่อแกนลึก',
      'text-anchor="middle" font-size="11"')+'</svg>';
  return body;
}

const fbdArrow = (x1, y1, x2, y2, label, lx, ly) => {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const px = -uy, py = ux;
  return '<path d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2
    + '" fill="none" stroke="#a65c15" stroke-width="2.5"/>'
    + '<path d="M' + x2 + ' ' + y2 + 'L' + (x2 - ux * 11 + px * 5)
    + ' ' + (y2 - uy * 11 + py * 5) + 'L' + (x2 - ux * 11 - px * 5)
    + ' ' + (y2 - uy * 11 - py * 5) + 'Z" fill="#a65c15"/>'
    + svgText(lx, ly, label);
};

function freebodySvg(s,{report=false}={}) {
  const g = s.geometry;
  let body = '<svg class="fbd-svg" viewBox="0 0 540 230" role="img" aria-label="Freebody Diagram และตำแหน่งการรับแรง">'
    + '<rect width="540" height="230" fill="#fafcfd"/>';
  if (s.type === 'pile' || s.type === 'pilecf') {
    const p = s.forces.pile, l = s.forces.load;
    const toeX = 64 + g.pileToeX / g.B * 400;
    const heelX = 64 + g.pileHeelX / g.B * 400;
    body += '<path d="M64 165H464M220 165V42" stroke="#38536d" stroke-width="10" fill="none"/>'
      + fbdArrow(375, 95, 238, 95, 'Pₕ ' + qn(l.Ph,'kN/m') + (' ' + qu('kN/m')), 365, 75);
    for (const [x, demand, label] of [[toeX, p.axT, 'Toe'], [heelX, p.axH, 'Heel']]) {
      body += supportSymbolSvg('rotation-spring',x,165,{scale:.65,id:'pile-head-rotation-spring'})
        + '<path d="M'+x+' 172v23" stroke="#38536d" stroke-width="4"/>'
        + supportSymbolSvg('spring',x,190,{scale:.65,id:'pile-soil-spring'})
        + fbdArrow(x, 213, x, 180, label + ' ' + qn(demand,'tf/ต้น') + (' ' + qu('ตัน/ต้น')),
          Math.max(12, Math.min(x - 55, 400)), 222);
    }
    body += svgText(270, 33, 'Winkler หัวเข็ม: สปริงหมุน · Pa ' + qn(p.Pa,'tf/ต้น') + (' ' + qu('ตัน/ต้น')), 'text-anchor="middle"');
  } else if (s.type === 'soldier') {
    const l = s.forces.load;
    body += '<path d="M225 35V203" stroke="#38536d" stroke-width="13"/>'
      + '<path d="M42 134H487" stroke="#9dacb9" stroke-width="2" stroke-dasharray="6 4"/>'
      + '<rect data-support="embedded-soil" x="212" y="136" width="27" height="67" fill="#d58d39" opacity=".24"/>'
      + [147,171,195].map(y=>supportSymbolSvg('spring',232,y,{scale:.6,id:'embedded-soil-spring'})).join('')
      + fbdArrow(390, 85, 246, 85, 'ดิน active ' + qn(l.activeDry,'kN/m') + (' ' + qu('kN/m')), 310, 65)
      + svgText(260, 222, 'ดินรับแรงกระจายช่วงฝัง D ' + number(g.embed) + ' ม.');
    if (g.staySystem !== 'cant') {
      const y = 35 + g.stayLevel / (g.hp + g.embed) * 168;
      const st=s.forces.pile.stay,dy=g.staySystem==='stay'?81*st.drop/st.span:81*Math.tan((g.anchor?.angle||20)*Math.PI/180);
      body += supportPointSvg(225, y, 'soldier-tie')
        + fbdArrow(225,y,306,y+dy,(g.staySystem==='anchor'?'Nสมอ ':'Nสเตย์ ')+qn(st?.axial,'kN')+(' ' + qu('kN')),300,25)
        + svgText(18,105,'Rh → '+qn(st?.horizontal,'kN')+(' ' + qu('kN') + '/เข็ม'))
        + svgText(18,133,'V ↓ '+qn(st?.vertical,'kN')+(' ' + qu('kN') + '/เข็ม'));
    }
  } else {
    const e = s.equilibrium;
    const beamY=159-g.beamAxis/g.hp*116;
    body += '<path d="M83 159H467M92 159V43" stroke="#38536d" stroke-width="10" fill="none"/>'
      + supportPointSvg(92, 159, 'column-pad-joint')
      + fbdArrow(92, 18, 92, 52, 'N ' + qn(s.input.Npost,'kN') + (' ' + qu('kN')), 108, 33)
      + fbdArrow(192, 73, 104, 73, 'H ' + qn(s.input.Hpost,'kN') + (' ' + qu('kN')), 315, 76)
      + svgText(250, 44, 'Mยอด ' + qn(s.input.Mpost,'kN·m') + (' ' + qu('kN·m')))
      + '<rect data-member="raised-beam" x="83" y="'+(beamY-7)+'" width="25" height="14" fill="#426986"/>'
      + fbdArrow(135,beamY-32,135,beamY,'Rคาน '+qn(e.beamReaction,'kN')+(' ' + qu('kN')),315,104)
      + svgText(315,132,'Jคาน '+qn(e.beamCouple,'kN·m')+(' ' + qu('kN·m') + ' · เสา ')+(e.index+1));
    if (e.contactWidth != null) {
      const x = e.fullContact || e.xResultant < g.B / 2 ? 83
        : 83 + (g.B - e.contactWidth) / g.B * 384;
      const width=e.contactWidth / g.B * 384;
      body += supportBandSvg(x, 171, width, 'soil-contact')
        + [.125,.375,.625,.875].map(t=>supportSymbolSvg('contact',x+t*width,177,{scale:Math.min(.8,width/180),id:'soil-compression-contact'})).join('')
        + fbdArrow(83 + e.xResultant / g.B * 384, 214,
          83 + e.xResultant / g.B * 384, 181,
          'ΣV ' + qn(e.totalV,'kN') + (' ' + qu('kN') + ' · xR ') + number(e.xResultant) + ' ม.', 207, 208);
    } else {
      body += svgText(185, 198, 'ไม่ผ่าน · แรงลัพธ์อยู่นอกฐาน ไม่มีสมดุลแรงกด');
    }
  }
  const figures=body + '</svg>' + supportModelSvg(s,{compact:report});
  return report?'<div class="rw-fbd-views">'+figures+'</div>':figures;
}

function drawPlan() {
  if (!snap) { $('planPane').innerHTML = empty('กดคำนวณเพื่อสร้าง Plan / Section จากข้อมูลชุดปัจจุบัน'); return; }
  const f = snap.forces?.load;
  $('planPane').innerHTML = '<h2>ผังและรูปตัด · ' + esc(SYSTEM_TYPES[type]) + '</h2>'
    + '<div class="usage-line">' + guideHtml(systemGuides[type]) + '</div>'
    + '<div class="drawing-row"><div class="drawing"><header>PLAN · ตำแหน่งระบบ</header>'
    + planSvg(snap) + '<p>' + (type === 'duckfoot'
      ? 'เสาทุกต้นชิดเขตแนวเดียวกัน · คานเชื่อมเสาเหนือ footing · c = '+number(snap.geometry.beamClear)+' ม.'
      : 'จำนวนเสาเข็ม/ครีบจาก Engine: '
        + esc((snap.quantities?.piles || 0) + ' / ' + (snap.quantities?.ribs || 0)))
    + '</p></div><div class="drawing"><header>'
    + (type === 'duckfoot' ? 'SECTION A-A · เสาชิดเขต' : 'SECTION A-A · แนวแรงดันดิน')
    + '</header>' + sectionSvg(snap)
    + '<p>รูปทรงอ่านขนาดจาก Snapshot · งานเหล็กและหน้าตัดรอตรวจอนุมัติ</p></div></div>'
    + '<p class="legend support-note">' + esc(supportDescription(snap)
      .replace(/วงแหวนสีส้ม/g,'○ ในแบบ / จุดต่อใน FBD').replace(/แถบสีส้ม/g,'แนวรับแรงดินใน FBD')) + '</p>'
    + '<div class="drawing fbd"><header>FREEBODY DIAGRAM · แรงกระทำและตำแหน่งรับแรง</header>'
    + freebodySvg(snap) + '</div>'
    + (f ? '<div class="load-strip">'
      + '<div><small>Ka จาก Engine</small><b>' + number(f.Ka, 4) + '</b></div>'
      + '<div><small>' + (type === 'soldier' ? 'แรงดิน active (ไม่รวมน้ำ)' : 'แรงดันดิน Ph รวม')
      + '</small><b>' + qn(type === 'soldier' ? f.activeDry : f.Ph,'kN/m') + (' ' + qu('kN/m') + '</b></div>')
      + '<div><small>ฐาน / ระยะฝัง</small><b>' + esc(type === 'soldier' ? number(snap.geometry.embed) + ' m' : number(snap.geometry.B) + ' m') + '</b></div>'
      + '<div><small>สถานะ</small><b>' + esc(snap.status) + '</b></div></div>'
      : type === 'duckfoot' ? '<div class="load-strip">'
      + '<div><small>เสาในแนวเดียวกัน</small><b>' + snap.geometry.nPosts + ' ต้น</b></div>'
      + '<div><small>N ใช้งานต่อเสา</small><b>' + qn(snap.input.Npost,'kN') + (' ' + qu('kN') + '</b></div>')
      + '<div><small>ΣV ต่อฐาน</small><b>' + qn(snap.equilibrium.totalV,'kN') + (' ' + qu('kN') + '</b></div>')
      + '<div><small>q สูงสุดรายฐาน</small><b>'
        + qn(Math.max(snap.equilibrium.qBoundary ?? NaN,
          snap.equilibrium.qInside ?? NaN),'kPa') + (' ' + qu('kPa') + '</b></div></div>')
      : '');
}

function graph(values, label, unit, support = null) {
  const units=outputUnits();
  values=values?.map(value=>units.value(value,unit));
  unit=units.label(unit);
  if (!values?.length) return empty('ไม่มีข้อมูลเส้นแรงจาก Engine');
  const samples = values.filter(Number.isFinite);
  if (samples.length !== values.length) return empty('ไม่มีเส้นแรงที่ใช้ได้: ตรวจรายการเสถียรภาพและสมดุลก่อน');
  const max = Math.max(...samples.map(Math.abs), .001);
  const stations = support?.xValues?.length === values.length
    && support.xValues.every(Number.isFinite) ? support.xValues : null;
  const start = stations ? stations[0] : 0;
  const end = stations ? stations[stations.length - 1]
    : Number.isFinite(support?.length) && support.length > 0 ? support.length : values.length - 1;
  const span = Math.abs(end - start) > 1e-9 ? end - start : 1;
  const xAt = (i) => 48 + (stations ? (stations[i] - start) / span
    : i / Math.max(values.length - 1, 1)) * 428;
  const yAt = (v) => 112 - v / max * 72;
  const points = values.map((v, i) => xAt(i).toFixed(1) + ',' + yAt(v).toFixed(1)).join(' ');
  const peakIndex = values.reduce((best, v, i) => Math.abs(v) > Math.abs(values[best]) ? i : best, 0);
  const peakStation = stations ? stations[peakIndex]
    : start + (end - start) * peakIndex / Math.max(values.length - 1, 1);
  const peak = values[peakIndex];
  const axis = support?.axis || 'ตำแหน่งตามชิ้นส่วน';
  const bandStart = Number.isFinite(support?.bandStart)
    ? Math.max(0, Math.min(1, support.bandStart)) : null;
  return '<svg viewBox="0 0 520 250" role="img" aria-label="' + esc(label) + '">'
    + '<title>' + esc(label + ': ค่าสูงสุดสัมบูรณ์ ' + number(Math.abs(peak)) + ' ' + unit
      + ' ที่ ' + axis + ' ' + number(peakStation) + ' ม.') + '</title>'
    + '<rect x="0" y="0" width="520" height="250" fill="#fafcfd"/>'
    + (bandStart == null ? '' : '<rect data-support="embedded-soil" x="'
      + (48 + bandStart * 428) + '" y="36" width="' + ((1 - bandStart) * 428)
      + '" height="155" fill="#d58d39" opacity=".12"/>')
    + '<path d="M48 36V192H476M48 76H476M48 112H476M48 148H476" stroke="#c6d3de" fill="none"/>'
    + '<path d="M48 112H476" stroke="#627e94" stroke-width="1.3"/>'
    + '<polyline points="' + points + '" fill="none" stroke="#1d597b" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>'
    + '<circle cx="' + xAt(peakIndex).toFixed(1) + '" cy="' + yAt(peak).toFixed(1)
      + '" r="4" fill="#e46a24" stroke="#fff" stroke-width="1.3"/>'
    + (support?.atEnd != null ? supportPointSvg(48 + 428 * support.atEnd, 112,
      support.kind || 'beam-pad-support') : '')
    + (support?.at != null ? (() => {
      const x = 48 + Math.max(0, Math.min(1, support.at)) * 428;
      const atRight = x > 360;
      return '<path data-support="' + esc(support.kind || 'member-joint')
        + '" d="M' + x + ' 36V192" stroke="#a65c15" stroke-width="1.4" stroke-dasharray="4 4"/>'
        + supportPointSvg(x, 112, support.kind || 'member-joint')
        + svgText(atRight ? x - 8 : x + 8, 185, support.label,
          'text-anchor="' + (atRight ? 'end' : 'start') + '" font-size="10"');
    })() : '')
    + svgText(48, 22, 'max |' + (label.startsWith('SFD') ? 'V' : 'M') + '| '
      + number(Math.abs(peak)) + ' ' + unit + ' @ ' + number(peakStation) + ' ม.',
      'font-size="11" font-weight="700"')
    + svgText(476, 55, '+' + number(max), 'text-anchor="end" font-size="10"')
    + svgText(476, 106, '0', 'text-anchor="end" font-size="10"')
    + svgText(476, 162, '−' + number(max), 'text-anchor="end" font-size="10"')
    + svgText(48, 213, number(start) + ' ม.', 'font-size="10"')
    + svgText(476, 213, number(end) + ' ม.', 'text-anchor="end" font-size="10"')
    + svgText(262, 234, axis, 'text-anchor="middle" font-size="11"') + '</svg>';
}

const duckEquations = duckDesignEquations;

function pileForceFigures(s, reportIntro = '') {
  const diagram = s.forces.pile.diagram;
  const support = s.type === 'soldier'
    ? { at: s.geometry.staySystem === 'cant' ? null
      : s.geometry.stayLevel / (s.geometry.hp + s.geometry.embed),
    bandStart: s.geometry.hp / (s.geometry.hp + s.geometry.embed),
    kind: 'soldier-tie', label: 'จุดยึดรั้ง', axis: 'ลึกจากยอดเข็ม',
    length: diagram.step * Math.max(diagram.m.length - 1, 0) }
    : { at: 0, kind: 'pile-head', label: 'หัวเข็ม/ฐาน', axis: 'ลึกจากหัวเข็ม',
      length: diagram.step * Math.max(diagram.m.length - 1, 0) };
  let html = (reportIntro ? '<section class="print-keep">' + reportIntro : '')
    + '<div class="diagram-grid"><figure><figcaption>SFD · '
    + esc(diagram.basis) + (' · ' + qu('kN') + '</figcaption>')
    + graph(diagram.v, 'SFD', 'kN', support) + '</figure><figure><figcaption>BMD · '
    + esc(diagram.basis) + (' · ' + qu('kN·m') + '</figcaption>')
    + graph(diagram.m, 'BMD', 'kN·m', support) + '</figure></div>'
    + (reportIntro ? '</section>' : '');
  const stem = s.forces.stem;
  if (stem?.diagram?.length) {
    html += (reportIntro ? '<section class="print-keep">' : '')
      + '<h3>พนังยื่น · แนวสูง</h3><div class="diagram-grid">'
      + '<figure><figcaption>SFD · แรงออกแบบพนังต่อเมตร</figcaption>'
      + graph(stem.diagram.map((row) => row.v), 'SFD พนัง', 'kN/m',
        { at: 1, kind: 'stem-base-joint', label: 'โคนพนัง/ฐาน',
          axis: 'ลึกจากยอดพนัง', xValues: stem.diagram.map((row) => row.z) })
      + '</figure><figure><figcaption>BMD · แรงออกแบบพนังต่อเมตร</figcaption>'
      + graph(stem.diagram.map((row) => row.m), 'BMD พนัง', 'kN·m/m',
        { at: 1, kind: 'stem-base-joint', label: 'โคนพนัง/ฐาน',
          axis: 'ลึกจากยอดพนัง', xValues: stem.diagram.map((row) => row.z) })
      + '</figure></div>' + (reportIntro ? '</section>' : '');
  }
  return html;
}

function drawForces() {
  if (!snap) { $('forcesPane').innerHTML = empty('กดคำนวณเพื่ออ่าน SFD / BMD จากผล Engine'); return; }
  if (type === 'duckfoot') {
    $('forcesPane').innerHTML = '<h2>SFD / BMD · เสา ฐาน และคานตีนเสา</h2>'
      + '<p>กราฟเสาและคานเป็นแรงใช้งาน; ฐานเป็นแรงออกแบบต่อเมตรตามกรณีควบคุม</p>'
      + duckForceFigures(snap,graph,draft.unitMode);
    pageForceSections($('forcesPane'));
    return;
  }
  const pile = snap.forces.pile;
  const pileTitle = type === 'soldier' ? 'เสาเข็มพืด I-' + snap.input.ipile : 'เสาเข็มใต้ฐาน';
  let html = '<h2>แรงภายใน · ' + esc(pileTitle) + '</h2>'
    + '<p class="legend">เส้น SFD/BMD เป็นผลระดับแรงใช้งานจาก FE ของ Engine ต่อเข็มตามความลึก'
    + ' ส่วน Mᵤ / Vᵤ ในตารางตรวจเป็นแรงออกแบบที่ Engine แปลงตามโปรไฟล์'
    + ' ห้ามเปรียบเทียบเส้น Service กับกำลังออกแบบโดยตรง</p>'
    + '<div class="load-strip">'
    + '<div><small>M ตรวจ</small><b>' + qn(pile.Mu,'kN·m') + (' ' + qu('kN·m') + '</b></div>')
    + '<div><small>M เกณฑ์ Engine</small><b>' + qn(pile.Mcr,'kN·m') + (' ' + qu('kN·m') + '</b></div>')
    + '<div><small>V ตรวจ</small><b>' + qn(pile.Vu,'kN') + (' ' + qu('kN') + '</b></div>')
    + '<div><small>V เกณฑ์ Engine</small><b>' + qn(pile.Vc,'kN') + (' ' + qu('kN') + '</b></div></div>')
    + pileForceFigures(snap);
  const stem = snap.forces.stem;
  if (stem?.strips?.length) {
    html += '<h3>พนังระหว่างครีบ · ค่า Engine รายแถบ</h3><div class="table-wrap"><table>'
      + '<thead><tr><th>ช่วงสูง (ม.)</th><th>M เหนือครีบ ('+qu('kN·m/m')+')</th><th>M กลางช่วง ('+qu('kN·m/m')+')</th><th>V ('+qu('kN/m')+')</th><th>เหล็กที่เลือก</th></tr></thead><tbody>'
      + stem.strips.map((row) => '<tr><td>' + number(row.from) + '–' + number(row.to)
        + '</td><td class="num">' + qn(row.supportM,'kN·m/m') + '</td><td class="num">'
        + qn(row.spanM,'kN·m/m') + '</td><td class="num">' + qn(row.V,'kN/m') + '</td><td>'
        + esc(row.barSupport) + ' / ' + esc(row.barSpan) + '</td></tr>').join('')
      + '</tbody></table></div>';
  }
  $('forcesPane').innerHTML = html+renderRearAnchorActions(snap.forces.rearAnchor,{mode:draft.unitMode});
  pageForceSections($('forcesPane'));
}

function drawChecks() {
  if (!snap) { $('checksPane').innerHTML = empty('กดคำนวณเพื่ออ่านผลตรวจจาก Engine'); return; }
  if (type === 'duckfoot') {
    $('checksPane').innerHTML = duckChecks(snap,draft.unitMode)+renderEquationLedger(snap.equationLedger,{compact:true});
    return;
  }
  const p = snap.forces.pile;
  const ratios = [
    ['โมเมนต์เสาเข็ม', p.Mu, p.Mcr, 'kN·m'],
    ['แรงเฉือนเสาเข็ม', p.Vu, p.Vc, 'kN'],
  ];
  if (snap.forces.stem) ratios.push(
    ['แรงเฉือนพนัง', snap.forces.stem.V, snap.forces.stem.capacityV, 'kN/m'],
    ['แรงเฉือนฐานหลัง', snap.forces.heel.V, snap.forces.heel.capacityV, 'kN/m'],
  );
  const advice = snap.recommendations?.length
    ? '<h3>ขนาด/กำลังที่ต้องการจากการตรวจชุดนี้</h3><div class="table-wrap"><table>'
      + '<thead><tr><th>รายการ</th><th>ค่าที่แนะนำ</th><th>ขอบเขต</th></tr></thead><tbody>'
      + snap.recommendations.map((row) => '<tr><td>' + esc(row.title) + '</td><td><b>'
        + esc(outputText(row.value)) + '</b></td><td>' + esc(outputText(row.basis)) + '</td></tr>').join('')
      + '</tbody></table></div>' : '';
  $('checksPane').innerHTML = '<h2>Demand / เกณฑ์ตรวจที่ Engine ใช้</h2>'
    + '<div class="table-wrap"><table><thead><tr><th>รายการ</th><th>Demand</th><th>Capacity</th><th>D/C</th></tr></thead><tbody>'
    + ratios.map(([name, d, c, unit]) => {
      const dc = c > 0 ? d / c : NaN;
      return '<tr class="' + (dc > 1 ? 'fail-row' : 'pass-row') + '"><td>' + esc(name)
        + '</td><td class="num">' + qn(d,unit) + ' ' + qu(unit) + '</td><td class="num">'
        + qn(c,unit) + ' ' + qu(unit) + '</td><td class="num">'
        + number(dc) + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    + advice + '<h3>ทะเบียนตรวจทั้งหมดจาก Engine</h3>'
    + '<p class="legend">M ของเข็ม คสล.อัดแรงเทียบเกณฑ์ Mcr เพื่อคัดกรอง ส่วนเข็มตัวไอใช้ Mcap ประมาณของ Engine'
    + ' ต้องยืนยันกำลังจริงกับแค็ตตาล็อกผู้ผลิต ค่า u ของ Engine บางแถวเป็นตัวชี้สถานะหรือเกณฑ์ FS ไม่ใช่ D/C ของหน้าตัด'
    + ' จึงแสดงแยกจากตาราง Demand/Capacity ข้างบน</p>'
    + '<div class="table-wrap"><table><thead><tr><th>รายการ</th><th>ค่าที่ได้</th><th>เกณฑ์</th><th>u</th><th>ผล</th></tr></thead><tbody>'
    + checkRows(snap).map((row) => '<tr class="' + (row.ok ? 'pass-row' : 'fail-row')
      + '"><td>' + esc(row.label??row.key) + '</td><td>' + esc(outputText(row.value)) + '</td><td>'
      + esc(row.criterion) + '</td><td class="num">' + number(row.dc)
      + '</td><td><span class="badge ' + (row.ok ? '' : 'fail') + '">'
      + (row.ok ? 'ผ่าน' : 'ไม่ผ่าน') + '</span>'
      + (!row.ok && row.fix ? '<br><small>' + esc(row.fix) + '</small>' : '')
      + '</td></tr>').join('') + '</tbody></table></div>'
    + (type === 'soldier' && snap.input.soldierSys === 'stay'
      ? '<p class="legend" role="note"><b>ยังไม่ตรวจฐานหัวเข็มสมอหลัง:</b> ค่า APd ตรวจแรงถอน/เหล็กเดือยเท่านั้น ยังไม่มี D/C ดัด เฉือน ระยะฝังเหล็กของแคป และแรงราบ/ดัดของเข็มหลัง</p>'
      : '')+renderEquationLedger(snap.equationLedger,{compact:true})+renderRearAnchorActions(snap.forces.rearAnchor,{mode:draft.unitMode,compact:true});
}

function drawBars() {
  if (!snap) { $('barsPane').innerHTML = empty('กดคำนวณเพื่ออ่านรายการที่ Engine เลือก'); return; }
  if (type === 'duckfoot') {
    $('barsPane').innerHTML = duckBars(snap);
    return;
  }
  const stem = snap.forces.stem;
  const summary = stem ? '<div class="load-strip">'
    + '<div><small>พนัง As ต้องการ</small><b>' + number(stem.AsReq, 0) + ' mm²/m</b></div>'
    + '<div><small>เหล็กพนัง</small><b>' + esc(stem.bar) + '</b></div>'
    + '<div><small>เหล็กฐานหลัง</small><b>' + esc(snap.forces.heel.bar) + '</b></div>'
    + '<div><small>เหล็กฐานหน้า</small><b>' + esc(snap.forces.toe.bar) + '</b></div></div>' : '';
  $('barsPane').innerHTML = '<h2>รายการหน้าตัดและเหล็กที่ Engine เลือก</h2>'
    + '<p class="legend">รายการนี้อ่านจาก BBS ของ Engine เดียวกับผลตรวจ'
    + ' ภาพเหล็กแสดงตำแหน่งและทิศจากผลออกแบบ ไม่ใช่รายการตัดดัด</p>'
    + summary
    + '<div class="table-wrap"><table><thead><tr><th>Mark</th><th>ตำแหน่ง</th><th>ชนิด</th><th>รายละเอียด</th><th>ยาว (ม.)</th><th>จำนวน</th></tr></thead><tbody>'
    + snap.bbs.map(row=>displayedBbsRow(snap,row)).map((row) => '<tr><td>' + esc(row.mark) + '</td><td>'
      + esc(row.position) + '</td><td>' + esc(row.size) + '</td><td>'
      + esc(row.detail) + '</td><td class="num">' + number(row.length)
      + '</td><td class="num">' + number(row.count, 0) + '</td></tr>').join('')
    + '</tbody></table></div>'+renderRbBeamSections(snap);
}

function inputLedger(s) {
  const presentRb=new Set((s.geometry.capBeams||[]).map(b=>b.mark.toLowerCase()));
  const rows = SYSTEM_INPUT_KEYS[s.type].filter((key) =>
    !['wtype', 'project', 'profile'].includes(key)
    && !(s.type === 'soldier' && s.input.soldierSys !== 'anchor'
      && (key === 'stayAng' || key.startsWith('ga')))
    && !(s.type==='soldier'&&s.input.soldierSys!=='stay'&&['stayLb','capLvl','ancLe','ancPileSec','stayBw','stayBh','ancCapB','ancCapL','ancCapH','ancDowelDb','ancDowelN'].includes(key))
    && !(s.type==='soldier'&&/^rb[123]/.test(key)&&!presentRb.has(key.slice(0,3)))
    && !(s.type==='soldier'&&!presentRb.size&&['rbCover','rbAgg'].includes(key))).map((key) => {
    const [, canonicalUnit, kind] = defs[key];
    const mode=draft.unitMode || 'si';
    const unit=inputUnit(key,mode,canonicalUnit);
    const value = kind === 'text' ? s.input[key]
      : key === 'zw' && Number(s.input.zw) === 99 ? 'ไม่มีน้ำ'
      : key === 'weepN' ? ['ไม่ระบาย', 'ลดแรงน้ำครึ่งหนึ่ง', 'สมมติระบายเต็ม'][Number(s.input.weepN)]
        : key === 'frontBeamMode' ? {none:'ไม่มีคานตามแนวกำแพง',waler:'คาน คสล. เฉพาะระดับยึดรั้ง',legacy:'คานตามแบบเดิม 2–3 ระดับ'}[s.input.frontBeamMode]
        : key === 'soldierSys' ? { cant: 'เข็มยื่น', stay: 'คานสเตย์',
          anchor: 'Ground anchor' }[s.input.soldierSys]
        : key === 'stayLvl' && s.input.soldierSys === 'cant' ? 'ไม่ใช้ (เข็มยื่น)'
          : ['stayLvl','stayLb','capLvl','ancLe','pileEmbS'].includes(key) && Number(s.input[key]) === 0 ? 'อัตโนมัติ'
          : key === 'pileTen' && Number(s.input.pileTen) === 0 ? 'Engine ประมาณ 0.3Pa'
            : kind==='units' ? (mode==='kgf'?'kgf':'SI')
              : number(inputToDisplay(key,s.input[key],mode),key==='nPosts'?0:3);
    return '<tr data-input-key="' + esc(key) + '"><td>' + esc(fieldLabel(key,s.type)) + '</td><td class="num">'
      + esc(value) + '</td><td>' + esc(unit) + '</td></tr>';
  }).join('');
  return '<h3>' + (s.type === 'duckfoot' ? 'ค่าตั้งต้นที่ใช้คำนวณฐานรายเสา'
    : 'ค่าตั้งต้นที่ส่งเข้า Engine / สมดุลฐาน') + '</h3>'
    + '<p class="legend" data-output-units="'+(draft.unitMode||'si')+'">หน่วยแสดงผล '+esc(outputUnits().title)+'; แบบใช้ ม./มม. · D/C และเหล็กจากผลคำนวณชุดเดิม'
    + (draft.unitMode==='kgf'?'; 1 kgf = 9.80665 N; 1 kgf/cm² = 0.0980665 MPa':'')
    + (s.type==='pile'||s.type==='pilecf'?'; กำลังเข็มที่กรอกเป็น tf: 1 tf = 9.80665 kN = 1000 kgf':'')+'</p>'
    + '<div class="table-wrap"><table><thead><tr><th>ตัวแปร</th><th>ค่าที่กรอก</th>'
    + '<th>หน่วย</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function loadEquations(s) {
  const i = s.input, f = s.forces.load, p = s.forces.pile;
  if (s.type === 'soldier') {
    const system = { cant: 'เข็มยื่น', stay: 'คานสเตย์', anchor: 'Ground anchor' }[i.soldierSys];
    return '<div class="equation">ระบบที่เลือก = ' + esc(system)
      + '; H = ' + number(f.H) + ' m; S = ' + number(p.spacing) + ' m<br>'
      + 'Ka = tan²(45°−φ/2) = tan²(45°−' + number(i.phi) + '°/2) = '
      + number(f.Ka, 4) + '; Kp = tan²(45°+φ/2) = ' + number(f.Kp, 4) + '<br>'
      + 'p<sub>a,ดิน</sub>(H) = Ka(γH+q) = ' + number(f.Ka, 4) + '×('
      + qn(i.gs,'kN/m³') + '×' + number(f.H) + '+' + qn(i.q,'kPa') + ') = '
      + qn(f.paAtExc,'kPa') + (' ' + qu('kPa') + '<br>')
      + 'P<sub>a,ดิน</sub> = Ka(γH²/2+qH) = ' + number(f.Ka, 4) + '×('
      + qn(i.gs,'kN/m³') + '×' + number(f.H) + '²/2+'
      + qn(i.q,'kPa') + '×' + number(f.H) + ') = '
      + qn(f.activeDry,'kN/m') + (' ' + qu('kN/m') + '<br>')
      + 'p<sub>net</sub>(z&gt;H) = Ka(γz+q) + p<sub>น้ำ</sub>(z) − Kpγ(z−H); '
      + 'D = ' + number(p.embed) + ' m เทียบ D<sub>ต้องการ</sub> = '
      + number(p.Dreq) + ' m</div>'
      + '<p>ค่า P<sub>a,ดิน</sub> ไม่รวมน้ำและไม่ใช่แรงรวมของ Engine'
      + ' ซึ่งวิเคราะห์น้ำ, passive ใต้ระดับขุด และจุดยึดรั้งตาม Snapshot'
      + ' ต้องยืนยันระดับน้ำและการระบายที่กรอกกับสภาพหน้างาน'
      + ' เส้น SFD/BMD เป็นแรงใช้งานต่อเข็ม; M/V ตรวจเป็นค่าออกแบบจาก Engine</p>'
      +(p.stay&&i.soldierSys==='stay'?'<h3>แรงสเตย์จากจุดต่อจริง · คู่ V สมมาตร</h3><div class="equation">'
        +'Rh (สมดุล free-earth support) = Tต่อเมตร·S = '+qn(p.stay.horizontalPerMetre,'kN/m')+'×'+number(p.spacing)+' = '+qn(p.stay.horizontal,'kN')+(' ' + qu('kN') + ' / เข็มหน้า<br>')
        +'Δy = (H−a)−ycap = '+number(p.stay.drop)+' m; Lb = '+number(p.stay.span)+' m<br>'
        +'Δz = '+number(p.stay.planOffset)+' m (ครึ่งช่วงคู่เข็มในผัง); L = √(Lb²+Δy²+Δz²) = '+number(p.stay.length)+' m<br>'
        +'Nstay = Rh·L/Lb = '+qn(p.stay.horizontal,'kN')+'×'+number(p.stay.length)+'/'+number(p.stay.span)+' = '+qn(p.stay.axial,'kN')+(' ' + qu('kN') + ' / สเตย์<br>')
        +'Vfront = Rh·Δy/Lb = '+qn(p.stay.horizontal,'kN')+'×'+number(p.stay.drop)+'/'+number(p.stay.span)+' = '+qn(p.stay.vertical,'kN')+(' ' + qu('kN') + ' / เข็มหน้า (ลง)<br>')
        +'Hanchor = 2Rh = '+qn(p.stay.anchorHorizontal,'kN')+(' ' + qu('kN') + '; Uanchor = 2Vfront = ')+qn(p.stay.anchorUplift,'kN')+(' ' + qu('kN') + ' (ขึ้น)</div>')
        +'<p>แรงออกแบบต่อเข็มใช้ช่วง S เต็ม; คู่ท้ายที่สั้นกว่าและสมอปลายเดี่ยวใช้ขนาดสมาชิกเดียวกับคู่ควบคุม การโก่งตัวใช้คู่ V สมมาตรฉายเป็นกรอบ 2D กับสปริงดินเชิงเส้น คานรัดยึดการเคลื่อนตัวตามแนวกำแพง (uz=0) และไม่มีโหลดนอกระนาบ ไม่ใช่การวิเคราะห์กรอบสามมิติทั้งแนว กำลังรับแรงราบของสมอต้องตรวจแยกจากกำลังถอน</p>':'');
  }
  return '<div class="equation">φ = ' + number(i.phi) + '°; γ = '
    + qn(i.gs,'kN/m³') + (' ' + qu('kN/m³') + '; q = ') + qn(i.q,'kPa')
    + (' ' + qu('kPa') + '; c = ') + qn(i.c,'kPa') + (' ' + qu('kPa') + '; β = ') + number(f.beta) + '°<br>'
    + 'p<sub>ดิน</sub>(z) = max[Ka(σ′v(z)+q)−2c√Ka, 0]cosβ'
    + ' = max[' + number(f.Ka, 4) + '(σ′v(z)+' + qn(i.q,'kPa')
    + ')−2×' + qn(i.c,'kPa') + '√' + number(f.Ka, 4)
    + ', 0]cos(' + number(f.beta) + '°)<br>'
    + 'H = hp+hz = ' + number(i.hp) + '+'
    + number(i.hz) + ' = ' + number(f.H) + ' m; '
    + 'Hq = H+Heel·tanβ = ' + number(f.H) + '+'
    + number(s.geometry.heel) + '×tan(' + number(f.beta) + '°) = '
    + number(f.Hq) + ' m<br>'
    + 'Ka (Engine) = ' + number(f.Ka, 4)
    + '; P<sub>ดิน</sub> = ' + qn(f.Phs,'kN/m') + (' ' + qu('kN/m') + '; ')
    + 'P<sub>น้ำ</sub> = ' + qn(f.Pw,'kN/m') + (' ' + qu('kN/m') + '<br>')
    + 'Ph = P<sub>ดิน</sub>+P<sub>น้ำ</sub> = '
    + qn(f.Phs,'kN/m') + '+' + qn(f.Pw,'kN/m') + ' = '
    + qn(f.Ph,'kN/m') + (' ' + qu('kN/m') + '<br>')
    + 'Mo = Σ(p<sub>ดิน</sub>+p<sub>น้ำ</sub>)·แขน·Δz = '
    + qn(f.Mo,'kN·m/m') + (' ' + qu('kN·m/m') + '; ȳ = Mo/Ph = ')
    + qn(f.Mo,'kN·m/m') + '/' + qn(f.Ph,'kN/m') + ' = '
    + number(f.ybar) + ' m</div>'
    + '<p>แรงดินและน้ำรวมจากการแบ่ง 400 ช่วงของ Engine ตาม Snapshot'
    + ' ต้องยืนยันระดับน้ำและกำลังดินที่กรอกกับสภาพหน้างาน'
    + ' เส้น SFD/BMD เข็มเป็นแรงใช้งานต่อเข็ม ส่วน M/V ตรวจเป็นค่าออกแบบ</p>';
}

function surchargeEquations(s) {
  const q=s.forces?.load?.surcharge;
  if(!q)return '';
  return '<h3>โหลดใช้งาน DL / LL ที่ผิวดิน</h3><div class="equation" data-load-ledger="surcharge">'
    +'q = qDL + qLL = '+qn(q.dead,'kPa',3)+' + '+qn(q.live,'kPa',3)+' = '+qn(q.total,'kPa',3)+(' ' + qu('kPa') + '<br>')
    +(q.verticalFactored==null?'':('qᵤ,vertical = γD·qDL + γL·qLL = '+number(q.verticalDeadFactor,2)+'×'+qn(q.dead,'kPa',3)
      +' + '+number(q.verticalLiveFactor,2)+'×'+qn(q.live,'kPa',3)+' = '+qn(q.verticalFactored,'kPa',3)+(' ' + qu('kPa') + '<br>')))
    +'แรงดันดินใช้ q รวม; ตัวคูณแรงราบ γH = '+number(q.lateralFactor,2)
    +'</div><p class="legend">น้ำหนักคอนกรีตและดินคิดจากขนาด/หน่วยน้ำหนักใน Engine; ไม่กรอกซ้ำใน DL ผิวดิน'
    +(s.type==='soldier'?'':' · ไม่นำน้ำหนัก Surcharge มาช่วยเพิ่มแรงต้านทานพลิก/เลื่อนในแบบจำลองนี้')+'</p>';
}

function pileReactionEquations(s) {
  if (s.type === 'soldier') return '';
  const p = s.forces.pile, g = s.geometry;
  return '<h3>ปฏิกิริยากลุ่มเสาเข็มสองแถว</h3><div class="equation">'
    + 'n<sub>toe</sub> = 1/s<sub>toe</sub> = 1/' + number(g.pileSt)
    + ' = ' + number(p.nT, 3) + ' ต้น/ม.; '
    + 'n<sub>heel</sub> = 1/s<sub>heel</sub> = 1/' + number(g.pileSh)
    + ' = ' + number(p.nH, 3) + ' ต้น/ม.<br>'
    + 'CG = (n<sub>toe</sub>x<sub>toe</sub>+n<sub>heel</sub>x<sub>heel</sub>)/N'
    + ' = (' + number(p.nT, 3) + '×' + number(p.toeX)
    + '+' + number(p.nH, 3) + '×' + number(p.heelX)
    + ')/' + number(p.Ntot, 3) + ' = ' + number(p.CG) + ' m<br>'
    + 'M<sub>CG</sub> = M<sub>พลิก</sub>−R<sub>v</sub>(x<sub>Rv</sub>−CG)'
    + ' = ' + qn(p.OTM,'tf·m/m') + '−' + qn(p.RvT,'tf/m')
    + '×(' + number(p.armRv) + '−' + number(p.CG) + ') = '
    + qn(p.Mcg,'tf·m/m') + (' ' + qu('ตัน·ม./ม.') + '<br>')
    + 'P<sub>toe</sub> = [Rv/N+M<sub>CG</sub>a<sub>toe</sub>/Ix]/cosβ'
    + ' = [' + qn(p.RvT,'tf/m') + '/' + number(p.Ntot, 3)
    + '+' + qn(p.Mcg,'tf·m/m') + '×' + number(p.armT)
    + '/' + number(p.Ix, 3) + ']/cos(' + number(p.btTdeg) + '°) = '
    + qn(p.axT,'tf/ต้น') + (' ' + qu('ตัน/ต้น') + '<br>')
    + 'P<sub>heel</sub> = [Rv/N+M<sub>CG</sub>a<sub>heel</sub>/Ix]/cosβ'
    + ' = [' + qn(p.RvT,'tf/m') + '/' + number(p.Ntot, 3)
    + '+' + qn(p.Mcg,'tf·m/m') + '×' + number(p.armH)
    + '/' + number(p.Ix, 3) + ']/cos(' + number(p.btHdeg) + '°) = '
    + qn(p.axH,'tf/ต้น') + (' ' + qu('ตัน/ต้น') + '; Pa = ') + qn(p.Pa,'tf/ต้น') + (' ' + qu('ตัน/ต้น') + '</div>');
}

function designTraceEquations(s) {
  const p = s.forces.pile, d = p.designTrace;
  if (!d) return '';
  const mBasis = s.type === 'soldier'
    ? 'max|BMD FE ใช้งาน| = ' + qn(d.springM,'kN·m') + (' ' + qu('kN·m'))
    : 'max(M_Winkler, M_Frame) = max(' + qn(d.springM,'kN·m') + ', '
      + (d.frameM == null ? 'ไม่มีผล Frame' : qn(d.frameM,'kN·m')) + ') = '
      + qn(d.serviceM,'kN·m') + (' ' + qu('kN·m') + ' · คุมโดย ') + esc(d.governing);
  const vBasis = s.type === 'soldier' ? 'max|SFD FE ใช้งาน|'
    : 'แรงเฉือนใช้งานที่หัวเข็มจากแรงราบคงเหลือ';
  return '<div class="equation"><b>สายแรงที่ใช้ตรวจหน้าตัด</b><br>Mใช้งาน = '
    + mBasis + '<br>Mตรวจ = Mใช้งาน × γH = ' + qn(d.serviceM,'kN·m')
    + ' × ' + number(d.lateralFactor) + ' = ' + qn(p.Mu,'kN·m')
    + (' ' + qu('kN·m') + '<br>') + vBasis + ' = ' + qn(d.serviceV,'kN')
    + (' ' + qu('kN') + '; Vตรวจ = Vใช้งาน × γH = ') + qn(d.serviceV,'kN')
    + ' × ' + number(d.lateralFactor) + ' = ' + qn(p.Vu,'kN')
    + (' ' + qu('kN') + '</div>');
}

function anchorEquations(s){
  const a=s.geometry.anchor;
  if(!a)return '';
  return '<h3>Ground anchor · กำลังยอมให้จากข้อมูลที่กรอก</h3><div class="equation">'
    +'L<sub>free,x</sub> = L<sub>free</sub> cosθ = '+number(a.freeLength)+' × cos('+number(a.angle)
    +'°) = '+number(a.horizontalFree)+' m ≥ '+number(a.wedgeBackAtHead)+' + '+number(a.requiredClearance)+' m<br>'
    +'R<sub>bond</sub> = π D L<sub>bond</sub> τ<sub>allow</sub> = π × '+number(a.bondDiameter,3)
    +' × '+number(a.bondLength)+' × '+qn(a.bondStress,'kPa')+' = '+qn(a.bondCapacity,'kN')+(' ' + qu('kN') + '<br>')
    +'R<sub>allow</sub> = min(R<sub>bond</sub>, R<sub>tendon/head</sub>) = min('+qn(a.bondCapacity,'kN')
    +', '+qn(a.tendonCapacity,'kN')+') = '+qn(a.capacity,'kN')+(' ' + qu('kN') + '<br>')
    +'D/C = T<sub>service</sub> / R<sub>allow</sub> = '+qn(a.serviceDemand,'kN')+' / '+qn(a.capacity,'kN')
    +' = '+number(a.dc,3)+'</div>';
}

function currentFinalSection() {
  return finalSectionSummary(snap, {
    title: SYSTEM_TYPES[snap.type], profileLabel: DESIGN_PROFILES[snap.profile].short,
    support: supportDescription(snap), unitMode:draft.unitMode||'si',
  });
}

function drawReport() {
  if (!snap) { $('reportPane').innerHTML = empty('กดคำนวณก่อนเปิดรายการคำนวณ'); return; }
  $('reportPane').innerHTML=compactReportHtml(snap,draft.unitMode,{fbdHTML:freebodySvg(snap,{report:true})});
}

function modelOverlay(s) {
  return supportDescription(s)
    + (s.type === 'soldier' && s.input.soldierSys === 'stay' ? ' · แคปหัวเข็มสมอหลังเป็นรูปประกอบ ยังไม่ตรวจหน้าตัด/เหล็ก' : '')
    + (s.type==='soldier'?(s.geometry.capBeams.length?' · เหล็กคานตามแนวกำแพงที่เลือก; ไม่รวมสเตย์/แคปสมอ':' · ไม่มีคานตามแนวกำแพง; รอยต่อสเตย์/เข็มต้องออกแบบตามโครงการ'):'')
    + ' · ภาพตำแหน่งเหล็กออกแบบ ไม่ใช่รายการตัดดัด';
}
function refreshOutputViews() {
  const forcePage=[...$('forcesPane').querySelectorAll('.rw-result-sections button')]
    .findIndex(button=>button.getAttribute('aria-pressed')==='true');
  drawPlan(); drawForces(); drawChecks(); drawBars(); drawReport();
  if(forcePage>=0)$('forcesPane').querySelectorAll('.rw-result-sections button')[forcePage]?.click();
  $('modelPane').querySelector('.overlay').textContent = modelOverlay(snap);
  if($('stressLegend'))$('stressLegend').innerHTML=contourLegend(snap,draft.unitMode);
}

function renderCurrent() {
  setState();
  drawPlan();
  $('modelPane').querySelector('.viewport').hidden = !snap;
  $('modelPending').hidden = !!snap;
  $('stressLegend').hidden = !snap || !$('stressLayer').checked;
  $('modelPane').querySelectorAll('[data-view],#soilLayer,#rebarLayer,#stressLayer').forEach((control) => { control.disabled = !snap; });
  $('modelPane').querySelectorAll('[data-model-camera]').forEach(control=>{control.disabled=!viewer;});
  $('rebarLayer').disabled=!snap?.rebarLayout;
  $('modelPane').querySelector('.overlay').textContent = snap
    ? modelOverlay(snap)
    : 'รูปทรงจากขนาดใน Snapshot · กดคำนวณเพื่อแสดงตำแหน่งรับแรง';
  $('forcesPane').innerHTML = snap ? '' : empty('กดคำนวณเพื่ออ่านแรงภายใน');
  $('checksPane').innerHTML = snap ? '' : empty('กดคำนวณเพื่ออ่าน D/C');
  $('barsPane').innerHTML = snap ? '' : empty('กดคำนวณเพื่ออ่านเหล็ก');
  $('reportPane').innerHTML = snap ? '' : empty('กดคำนวณเพื่อเปิดเอกสาร');
  if (snap) {
    drawForces(); drawChecks(); drawBars(); drawReport();
    if (pane === 'model') mountViewer();
  }
}

function disposeViewer() {
  renderToken += 1;
  viewer?.dispose();
  viewer = null;
  $('systemCanvas').dataset.ready = 'false';
  $('png').disabled = true;
  $('modelPane').querySelectorAll('[data-model-camera]').forEach(control=>{control.disabled=true;});
}

async function mountViewer() {
  if (!snap || viewer || pane !== 'model') return;
  const token = ++renderToken;
  try {
    const [THREE, controls, systems3d] = await Promise.all([
      import('three'), import('three/addons/controls/OrbitControls.js'), import('./systems3d.mjs?rwv=20261003-cad-contour-1'),
    ]);
    if (token !== renderToken || !snap || pane !== 'model') return;
    viewer = systems3d.mountSystem3D(THREE, controls.OrbitControls, $('systemCanvas'), snap,{onViewChange:name=>{
      $('modelPane').querySelectorAll('button[data-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.view===name)));
    }});
    viewer.setSoil($('soilLayer').checked);
    viewer.setRebar($('rebarLayer').checked);
    viewer.setContour($('stressLayer').checked);
    $('stressLegend').innerHTML=contourLegend(snap,draft.unitMode);$('stressLegend').hidden=!$('stressLayer').checked;
    $('systemCanvas').dataset.ready = 'true';
    $('png').disabled = false;
    $('modelPane').querySelectorAll('[data-model-camera]').forEach(control=>{control.disabled=false;});
  } catch (caught) {
    $('error').textContent = 'เปิด 3D ไม่สำเร็จ: ' + String(caught.message || caught);
  }
}

function download(name, content, mime) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function visibleDraft(source, systemType) {
  return Object.fromEntries(SYSTEM_INPUT_KEYS[systemType].map((key) => [key, source[key]])
    .filter(([, value]) => value !== undefined));
}

function readDraft(data) {
  if (!['rw01-systems-draft/1', 'rw01-systems-draft/2'].includes(data?.schema)
    || data.schema === 'rw01-systems-draft/1' && data.type === 'duckfoot'
    || !SYSTEM_TYPES[data.type]
    || !data.draft || typeof data.draft !== 'object' || Array.isArray(data.draft)) {
    throw new Error('ไฟล์ร่าง RW-01 ไม่ถูกต้อง');
  }
  const allowed = new Set(SYSTEM_INPUT_KEYS[data.type]);
  const hidden = Object.entries(data.draft).filter(([key, value]) => !allowed.has(key)
    && !(data.type === 'duckfoot' && key === 'profile'
      && ['thai2566', 'aci318', 'wsd'].includes(value))
    && !(Object.hasOwn(SYSTEM_DEFAULTS, key) && Object.is(value, SYSTEM_DEFAULTS[key])));
  if (hidden.length) {
    throw new Error('ไฟล์ร่างมีค่าที่หน้านี้ไม่แสดง: ' + hidden.map(([key]) => key).join(', '));
  }
  if (data.draft.wtype != null && data.draft.wtype !== data.type) {
    throw new Error('ชนิดระบบในไฟล์ร่างไม่ตรงกัน');
  }
  if (data.draft.profile != null
    && !['thai2566', 'aci318', 'wsd'].includes(data.draft.profile)) {
    throw new Error('มาตรฐานในไฟล์ร่างไม่ถูกต้อง');
  }
  if (data.draft.project != null
    && (typeof data.draft.project !== 'string' || data.draft.project.length > 100)) {
    throw new Error('ชื่อโครงการในไฟล์ร่างไม่ถูกต้อง');
  }
  const picked = prepareDraft(visibleDraft(data.draft, data.type),data.type);
  for (const key of Object.keys(picked)) {
    if (picked[key] === null && !['project', 'profile', 'wtype', 'soldierSys'].includes(key)) {
      picked[key] = NaN;
    }
  }
  const draft = { ...(data.type === 'duckfoot' ? duckDefaults : SYSTEM_DEFAULTS),
    ...picked, wtype: data.type };
  validateSystemInput(draft, data.type);
  return { type: data.type, draft };
}

function calculate() {
  try {
    disposeViewer();
    const current = { ...draft, wtype: type };
    snap = createSystemSnapshot(current, type === 'duckfoot' ? 'thai2566' : draft.profile);
    snapKey = currentKey();
    drafts.set(type, { ...draft });
    error = '';
    $('error').textContent = '';
    renderCurrent();
    workflow.select('summary');
  } catch (caught) {
    snap = null;
    errorField=String(caught.message||'').match(/\b[A-Za-z][A-Za-z0-9]*\b/g)?.find(key=>defs[key])||'';
    error = String(caught.message || caught).replace(/\b[A-Za-z][A-Za-z0-9]*\b/g,(key)=>{
      const label=defs[key];return label?fieldLabel(key,type)+(label[1]?' ('+label[1]+')':''):key;
    });
    $('error').textContent = error;
    renderCurrent();
    if(errorField)workflow?.revealInput(document.querySelector('[data-key="'+errorField+'"]'));
  }
}

document.querySelectorAll('[data-type]').forEach((button) =>
  button.addEventListener('click', () => setType(button.dataset.type)));
document.querySelectorAll('[data-pane]').forEach((button) =>
  button.addEventListener('click', () => setPane(button.dataset.pane)));
document.querySelectorAll('[data-view]').forEach((button) =>
  button.addEventListener('click', () => viewer?.setView(button.dataset.view)));
document.querySelectorAll('[data-model-camera]').forEach(button=>button.addEventListener('click',()=>{
  const action=button.dataset.modelCamera;
  if(action==='in')viewer?.zoomBy(.8);
  if(action==='out')viewer?.zoomBy(1.25);
  if(action==='fit')viewer?.fit();
  if(action==='reset')viewer?.setView('iso');
}));
$('soilLayer').addEventListener('change', (event) => viewer?.setSoil(event.currentTarget.checked));
$('rebarLayer').addEventListener('change', (event) => viewer?.setRebar(event.currentTarget.checked));
$('stressLayer').addEventListener('change',event=>{viewer?.setContour(event.currentTarget.checked);$('stressLegend').hidden=!event.currentTarget.checked;});
$('calculate').addEventListener('click', calculate);
$('back').addEventListener('click', () => {
  const qa = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
    && new URLSearchParams(location.search).get('qa') === '1';
  location.href = '../retaining-wall-workbench.html' + (qa ? '?qa=1' : '');
});
function openPrintableReport(){
  if(!snap||snapKey!==currentKey())return;
  const html=printableDocument(compactReportPages(snap,draft.unitMode,{fbdHTML:freebodySvg(snap,{report:true})})
    .map(html=>({html,size:'A4P'})),{title:'RW-01 · '+SYSTEM_TYPES[type]+' · '+snap.stamp,
      fontHref:'/fonts/sarabun/sarabun.css',additionalCss:COMPACT_REPORT_CSS});
  const target=window.open('','_blank');
  if(!target){alert('เบราว์เซอร์บล็อกเอกสารพิมพ์ กรุณาอนุญาตหน้าต่างใหม่แล้วกดพิมพ์อีกครั้ง');return;}
  target.document.write(html);target.document.close();
}
$('print').addEventListener('click',openPrintableReport);
$('png').addEventListener('click', () => {
  if (viewer) download('RW-01-' + type + '-3D.png',
    Uint8Array.from(atob(viewer.image().split(',')[1]), (c) => c.charCodeAt(0)), 'image/png');
});
$('save').addEventListener('click', () => {
  download('RW-01-' + type + '-draft.json',
    JSON.stringify({ schema: 'rw01-systems-draft/2', type,
      draft: visibleDraft(draft, type) }, null, 2), 'application/json');
});
$('open').addEventListener('click', () => $('draftFile').click());
$('draftFile').addEventListener('change', async (event) => {
  const picker = event.currentTarget;
  const file = picker.files?.[0];
  if (!file) return;
  const beforeImport = currentKey();
  try {
    const next = readDraft(JSON.parse(await file.text()));
    if (currentKey() !== beforeImport) throw new Error('ข้อมูลเปลี่ยนระหว่างอ่านไฟล์ กรุณาเปิดไฟล์ใหม่');
    type = next.type;
    draft = next.draft;
    drafts.set(type, { ...draft });
    snap = null; snapKey = '';
    error = ''; $('error').textContent = '';
    workflow?.setType(type); workflow?.notice('');
    try { rememberDraft(); } catch { workflow?.notice('เปิดไฟล์แล้ว แต่เก็บร่างในแท็บไม่ได้ กรุณาบันทึกไฟล์ก่อนเปลี่ยนรูปแบบ'); }
    disposeViewer(); drawFields(); renderCurrent();
    setPane('plan');
  } catch (caught) {
    $('error').textContent = 'เปิดร่างไม่ได้: ' + String(caught.message || caught);
  }
  picker.value = '';
});
const modelPending = document.createElement('div'); modelPending.id = 'modelPending'; modelPending.className = 'rw-flow-empty';
modelPending.textContent = 'กรอกข้อมูลแล้วกดคำนวณ เพื่อเปิดแบบจำลอง 3D'; $('modelPane').prepend(modelPending);
workflow = mountWorkflow({ type, inputs: document.querySelector('.inputs'), work: document.querySelector('.work'),
  readInputGuide:()=>({type,input:draft,snapshot:snap}),
  panes: Object.fromEntries(['plan', 'model', 'forces', 'checks', 'bars', 'report'].map((key) => [key, $(key + 'Pane')])),
  onType: setType, onCalculate: calculate, onView: setPane,
  hasPreviousDraft: next => Boolean(readPreviousDraft(next)),
  onRestorePrevious: () => {
    const previous = readPreviousDraft(type); if (!previous) return;
    draft = { ...(type === 'duckfoot' ? duckDefaults : SYSTEM_DEFAULTS), ...prepareDraft(previous,type), wtype: type };
    drafts.set(type, { ...draft }); snap = null; snapKey = ''; error = '';
    disposeViewer(); drawFields(); renderCurrent();
    rememberDraft(); workflow.notice('คืนร่างก่อนอัปเดตแล้ว · กดคำนวณเพื่อตรวจค่าของร่างนี้');
  },
  onExample: () => {
    const sample = getPassingExample(type);
    draft = prepareDraft({ ...sample.values },type);
    drafts.set(type, { ...draft });
    snap = null; snapKey = ''; error = '';
    $('error').textContent = '';
    disposeViewer(); drawFields(); renderCurrent();
    try { rememberDraft(); workflow.notice('โหลดตัวอย่างที่ผ่านเฉพาะรายการตรวจของ Engine แล้ว · ตรวจข้อมูลโครงการและกดคำนวณ'); }
    catch { workflow.notice('โหลดตัวอย่างแล้ว แต่เก็บร่างในแท็บไม่ได้ · บันทึกไฟล์ก่อนปิดหน้า'); }
  },
  onSave: () => $('save').click(), onOpen: () => $('open').click(),
  onPrint:openPrintableReport,
  onBack: () => {
    rememberDraft();
    if (parent !== window) parent.postMessage({ type: 'rw:workbench-back' }, location.origin);
    else location.href = '/';
  },
});
drawFields();
renderCurrent();
