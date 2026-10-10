import { RW_DEFAULT_INPUT } from './snapshot.mjs?rwv=20261003-main-equations-1&stay=20261004-alternate-1';
import { DESIGN_PROFILES, checksFor, designRetainingWall, setEngineUnits, soldierCapGeometry } from './engine.mjs?rwv=20261003-final-acceptance-1&stay=20261004-alternate-1';
import { calculateDuckfoot, recommendDuckfoot } from './duckfootEngine.mjs?rwv=20261003-main-equations-1&stay=20261004-alternate-1';
import { DUCK_BEAM_CLEAR_DEFAULT } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { buildDesignRebarLayout,buildDuckDesignRebarLayout,buildSoldierDesignRebarLayout } from './rebarLayout.mjs?rwv=20261003-main-equations-1';
import {RB_DETAIL_DEFAULTS} from './soldierBeamDetailing.mjs?rwv=20261003-main-equations-1';
import { normalizeSurchargeInput, normalizeDuckLoadInput } from './loadInput.mjs?rwv=20260930-load-units-1';
import { validateInputUnitMode } from './inputUnits.mjs?rwv=20261003-final-acceptance-1';
import {rearPileCaps} from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import {buildRearAnchorActions} from './rearAnchorActions.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1';
import {buildEquationLedger} from './equationLedger.mjs?rwv=20261003-final-acceptance-1&stay=20261004-alternate-1';
import {projectReportMembers,projectReportShear,projectSoldierReport} from './essentialReport.mjs?rwv=20261003-final-acceptance-1&apd=20261003-cast-together-1&stay=20261004-alternate-1';
import {projectEngineContour} from './stressContour.mjs?rwv=20261003-cad-contour-1&stay=20261004-alternate-1';

export const SYSTEM_TYPES = Object.freeze({
  pile: 'กำแพงยื่นบนเสาเข็ม',
  pilecf: 'กำแพงครีบบนเสาเข็ม',
  soldier: 'กำแพงเสาเข็มพืด',
  duckfoot: 'ฐานตีนเป็ด · เสาชิดเขต',
});

export const SYSTEM_DEFAULTS = Object.freeze({
  ...RW_DEFAULT_INPUT,
  wtype: 'pile',
  pileShape: 'sq', pileB: 0.35, pileEmb: 6, pileSt: 2, pileSh: 2,
  pileEdT: 0.55, pileEdH: 0.55, Ppile: 30, pileTen: 0,
  pileLat: 2, pileBatT: 14, pileBatH: 0,
  ipile: 35, pileS: 1.2, pileEmbS: 0, tLag: 5, lagW: 30, soldierSys: 'stay',
  stayLvl:0,stayLb:0,capLvl:0,ancLe:0,ancPileSec:35,stayBw:25,stayBh:50,stayPattern:'all',ancCapB:0,ancCapL:0,ancCapH:0,ancDowelDb:16,ancDowelN:0,
  ancSu:19.6133,ancAlpha:.5,
  stayAng:20,gaFreeLength:0,gaBondLength:0,gaBondDia:0,gaBondStress:0,gaTendonCapacity:0,
  frontBeamMode:'none',
  gaTendonSpec:'',gaGroutSpec:'',gaProtectionSpec:'',
  capL: 1.2, colDepth: 0.15, postSpacing: 2.5, nPosts: 4,
  beamB: 0.20, beamH: 0.40, beamClear: DUCK_BEAM_CLEAR_DEFAULT,
  Npost: 100, Hpost: 10, Mpost: 0,
  factorN:1.4,factorH:1.7,qBeam:0,
});

const common = [
  ['hp', 0.5, 12], ['Lw', 1, 200], ['gs', 12, 24], ['phi', 15, 45],
  ['q', 0, 100], ['fc', 18, 50], ['fy', 235, 490],
];
const pileConcrete = [['gc', 15, 35], ['cov', 20, 100]];
const pileSoil = [
  ['gsat', 12, 26], ['c', 0, 100], ['beta', 0, 30],
  ['zw', 0, 99], ['qa', 10, 1000],
];
const soldierSoil = [
  ['gsat', 12, 26], ['c', 0, 100], ['zw', 0, 99],
  ['weepN', 0, 2], ['stayLvl', 0, 12],
];
const base = [
  ['hz', 0.2, 2], ['t', 0.15, 2], ['ttop', 0.15, 2], ['B', 0.5, 16],
  ['toe', 0, 6], ['heel', 0.1, 8],
];
const pile = [
  ['pileB', 0.2, 1.2], ['pileEmb', 2, 30], ['pileSt', 0.6, 8],
  ['pileSh', 0.6, 8], ['pileEdT', 0.3, 3], ['pileEdH', 0.3, 3],
  ['Ppile', 1, 500], ['pileTen', 0, 500], ['pileLat', 0, 200],
  ['pileBatT', 0, 30], ['pileBatH', 0, 30],
];
const counterfort = [['L', 0.5, 8], ['bs', 0.15, 1]];
const soldier = [
  ['ipile', 18, 45], ['pileS', 0.6, 4], ['pileEmbS', 0, 30], ['tLag', 4, 10], ['lagW', 20, 40],
];
const I_PILE_CATALOG = Object.freeze([18, 22, 26, 30, 35, 40, 45]);
const stayNumeric=[['stayLb',0,30],['capLvl',0,12],['ancLe',0,40],['ancPileSec',18,45],['stayBw',15,100],['stayBh',20,150]];
const rearSoilNumeric=[['ancSu',0,5000],['ancAlpha',0,1],['pileTen',0,500]];
const rearDetailNumeric=[['ancCapB',0,5],['ancCapL',0,5],['ancCapH',0,3],['ancDowelDb',12,32],['ancDowelN',0,100]];
export const SOLDIER_BEAM_KEYS=Object.freeze(['rb1','rb2','rb3'].flatMap(p=>['Bw','Bh','Db','Nt','Nb','Ldb','Lsp'].map(s=>p+s)));
const beamNumeric=SOLDIER_BEAM_KEYS.map(key=>[key,0,key.endsWith('Bw')?200:key.endsWith('Bh')?150:key.endsWith('Ldb')?12:key.endsWith('Db')?32:key.endsWith('Lsp')?30:100]);
const beamDetailNumeric=[['rbCover',25,100],['rbAgg',5,40]];
const REAR_DETAIL_DEFAULTS=Object.freeze({ancCapB:0,ancCapL:0,ancCapH:0,ancDowelDb:16,ancDowelN:0});
export function normalizeRearAnchorInput(input,type){
  if(type!=='soldier')return input;
  const oldSu=Object.hasOwn(input,'su')?(input.su==null||input.su===''||typeof input.su==='boolean'?input.su:Number(input.su)*9.80665):19.6133;
  const defaults={frontBeamMode:'legacy',lagW:30,stayPattern:'all',ancSu:oldSu,ancAlpha:.5,pileTen:0,...REAR_DETAIL_DEFAULTS,...RB_DETAIL_DEFAULTS,...Object.fromEntries(SOLDIER_BEAM_KEYS.map(key=>[key,0]))};
  return {...Object.fromEntries(Object.entries(defaults).filter(([key])=>!Object.hasOwn(input,key))),...input};
}
const anchorNumeric=[['stayAng',5,45],['gaFreeLength',.1,100],['gaBondLength',.1,100],
  ['gaBondDia',25,1000],['gaBondStress',1,5000],['gaTendonCapacity',1,10000]];
const anchorText=['gaTendonSpec','gaGroutSpec','gaProtectionSpec'];
const textKeys=['wtype','project','profile','soldierSys','stayPattern','frontBeamMode','unitMode',...anchorText];
const duck = [
  ['hp', 0.5, 12], ['t', 0.1, 1.5], ['colDepth', 0.1, 2],
  ['B', 0.6, 6], ['hz', 0.2, 1.5],
  ['gc', 15, 35],
  ['capL', 0.6, 6], ['postSpacing', 0.8, 12], ['nPosts', 2, 20],
  ['beamB', 0.15, 1.5], ['beamH', 0.2, 1.5], ['beamClear', 0, 12],
  ['Npost', 0, 10000], ['Hpost', -1000, 1000],
  ['Mpost', -10000, 10000],
  ['fc',18,50],['fy',235,490],['cov',25,75],['qa',10,1000],['mu',0,1],
  ['factorN',1,2],['factorL',1,2],['factorH',1,2],['qBeam',0,100],
  ['NpostD',0,10000],['NpostL',0,10000],['qBeamD',0,100],['qBeamL',0,100],
];
const DUCK_KEYS = Object.freeze(['wtype', 'project', 'unitMode',
  ...duck.map(([key]) => key)]);
const fieldKeys = (fields) => fields.map(([key]) => key);
export const SYSTEM_INPUT_KEYS = Object.freeze({
  pile: Object.freeze(['wtype', 'project', 'profile', 'unitMode', 'qD', 'qL', ...fieldKeys(common),
    ...fieldKeys(pileConcrete), ...fieldKeys(pileSoil), ...fieldKeys(base), ...fieldKeys(pile)]),
  pilecf: Object.freeze(['wtype', 'project', 'profile', 'unitMode', 'qD', 'qL', ...fieldKeys(common),
    ...fieldKeys(pileConcrete), ...fieldKeys(pileSoil), ...fieldKeys(base), ...fieldKeys(counterfort), ...fieldKeys(pile)]),
  soldier: Object.freeze(['wtype', 'project', 'profile', 'unitMode', 'frontBeamMode', 'qD', 'qL', ...fieldKeys(common),
    ...fieldKeys(soldierSoil), ...fieldKeys(soldier), 'soldierSys','stayPattern',...fieldKeys(stayNumeric),...fieldKeys(rearSoilNumeric),...fieldKeys(rearDetailNumeric),...fieldKeys(beamNumeric),...fieldKeys(beamDetailNumeric),...fieldKeys(anchorNumeric),...anchorText]),
  duckfoot: DUCK_KEYS,
});

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

// Old pile drafts did not expose cover. Only an absent field receives the
// former 50 mm default; an explicit blank or invalid value stays invalid.
export function normalizeSystemCover(input, type) {
  return (type === 'pile' || type === 'pilecf') && !Object.hasOwn(input, 'cov')
    ? { ...input, cov: SYSTEM_DEFAULTS.cov } : input;
}

export function validateSystemInput(input, type) {
  if (!SYSTEM_TYPES[type]) throw new RangeError('ไม่รู้จักระบบกำแพง');
  validateInputUnitMode(Object.hasOwn(input,'unitMode')?input.unitMode:'si');
  input=type==='duckfoot'?normalizeDuckLoadInput(input):normalizeSurchargeInput(input);
  input=normalizeRearAnchorInput(normalizeSystemCover(input,type),type);
  if (input.project != null && (typeof input.project !== 'string' || input.project.length > 100)) {
    throw new RangeError('ชื่อโครงการต้องเป็นข้อความไม่เกิน 100 ตัวอักษร');
  }
  const H=+input.hp,tie=input.soldierSys!=='cant';
  const a=tie?(+input.stayLvl>0?Math.min(+input.stayLvl,H-.2):Math.min(Math.max(H/4,.8),H-.2)):0;
  const beamPrefixes=new Set(soldierCapGeometry(input,H,+input.ipile/100,a,tie).filter(b=>b.present).map(b=>b.prefix));
  if(type==='soldier'&&!['none','waler','legacy'].includes(input.frontBeamMode))throw new RangeError('เลือกคานตามแนวกำแพงให้ถูกต้อง');
  if(type==='soldier'&&input.frontBeamMode==='waler'&&!beamPrefixes.has('rb2'))throw new RangeError('คานระดับยึดรั้งใช้ได้เมื่อมีสเตย์หรือสมอและระดับยึดรั้งมากกว่า 0.25 ม.');
  const activeBeamFields=beamNumeric.filter(([key])=>beamPrefixes.has(key.slice(0,3)));
  const fields = type === 'soldier' ? [...common, ...soldierSoil, ...soldier,...activeBeamFields,...(beamPrefixes.size?beamDetailNumeric:[]),...(input.soldierSys==='anchor'?anchorNumeric:input.soldierSys==='stay'?[...stayNumeric,...rearSoilNumeric,...rearDetailNumeric]:[])]
    : type === 'duckfoot' ? duck
      : [...common, ...pileConcrete, ...pileSoil, ...base,
        ...(type === 'pilecf' ? counterfort : []), ...pile];
  for (const [key, min, max] of fields) {
    const rawValue = input[key], value = Number(rawValue);
    if (rawValue == null || rawValue === '' || typeof rawValue === 'boolean'
      || !Number.isFinite(value) || value < min || value > max) {
      throw new RangeError(key + ' ต้องอยู่ระหว่าง ' + min + '–' + max);
    }
  }
  if (type === 'pile' || type === 'pilecf') {
    const minThickness=Math.min(Number(input.t),Number(input.ttop),type==='pilecf'?Number(input.bs):Infinity);
    if (2 * Number(input.cov) / 1000 >= minThickness) {
      throw new RangeError('cov สองด้านต้องน้อยกว่าความหนาพนังทั้งฐานและยอด รวมถึงครีบ');
    }
    if (Math.abs(Number(input.B) - Number(input.toe) - Number(input.t) - Number(input.heel)) > 1e-6) {
      throw new RangeError('B ต้องเท่ากับ Toe + ความหนาพนัง + Heel');
    }
    const edgeMin = 1.5 * Number(input.pileB);
    if (Number(input.pileEdT) < edgeMin || Number(input.pileEdH) < edgeMin) {
      throw new RangeError('ระยะขอบถึงศูนย์เข็มต้องไม่น้อยกว่า 1.5 เท่าขนาดเข็ม');
    }
    if (Number(input.B) < Number(input.pileEdT) + Number(input.pileEdH) + Number(input.pileB)) {
      throw new RangeError('ฐานกว้างไม่พอสำหรับเข็มสองแถวและคอนกรีตหุ้มขอบ');
    }
    if (Number(input.pileEdT) + Number(input.pileB) / 2 > Number(input.toe)
      || Number(input.pileEdH) + Number(input.pileB) / 2 > Number(input.heel)) {
      throw new RangeError('แถวเข็ม Toe/Heel ต้องอยู่ในช่วงฐานด้านนั้นทั้งหน้าตัด');
    }
    if (Number(input.beta) >= Number(input.phi)) {
      throw new RangeError('ความลาดหลังพนัง β ต้องน้อยกว่ามุมเสียดทานดิน φ');
    }
    if (type === 'pilecf' && Number(input.L) + Number(input.bs) >= Number(input.Lw)) {
      throw new RangeError('ช่วงครีบ L + ความหนาครีบ ต้องน้อยกว่าความยาวกำแพงเพื่อให้มีครีบอย่างน้อย 2 ตัว');
    }
  }
  if (type === 'duckfoot') {
    if (Number(input.t) >= Number(input.B)) {
      throw new RangeError('เสาชิดขอบต้องแคบกว่าความกว้างฐาน');
    }
    if (Number(input.colDepth) > Number(input.capL)
      || !Number.isInteger(Number(input.nPosts))
      || Number(input.capL) > Number(input.postSpacing)) {
      throw new RangeError('จำนวนเสาต้องเป็นจำนวนเต็ม เสาต้องอยู่บนฐาน และฐานแต่ละต้นต้องไม่ซ้อนกัน');
    }
    if (Number(input.beamB) > Number(input.B)) {
      throw new RangeError('beamB ต้องไม่เกินความกว้างฐาน B');
    }
    if (Number(input.beamClear) + Number(input.beamH) > Number(input.hp) + 1e-9) {
      throw new RangeError('beamClear + ความลึกคาน ต้องไม่เกินความสูงเสา hp ที่วัดจากผิวบนฐาน');
    }
  }
  if (type === 'soldier' && !['cant', 'stay', 'anchor'].includes(input.soldierSys)) {
    throw new RangeError('ชนิดระบบยึดรั้งไม่ถูกต้อง');
  }
  if(type==='soldier'&&input.soldierSys==='anchor')for(const key of anchorText){
    if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>100)
      throw new RangeError(key+' ต้องระบุข้อมูล Ground anchor ของโครงการไม่เกิน 100 ตัวอักษร');
  }
  if (type === 'soldier' && !I_PILE_CATALOG.includes(Number(input.ipile))) {
    throw new RangeError('เลือกหน้าตัดเข็มตัวไอตามรายการ I-18, 22, 26, 30, 35, 40, 45');
  }
  // An inactive RB2 draft must not block a system that has no such member.
  // Keep its entered values; enforce them again when the member is re-enabled.
  if(type==='soldier')for(const p of beamPrefixes){
    for(const [key,min,max]of beamNumeric.filter(([key])=>key.startsWith(p))){
      const value=input[key];
      if(value==null||value===''||!Number.isFinite(Number(value))||Number(value)<min||Number(value)>max)
        throw new RangeError(key+' ต้องเป็นตัวเลข 0–'+max+' (0=Auto)');
    }
    for(const suffix of ['Nt','Nb'])if(!Number.isInteger(+input[p+suffix])||(+input[p+suffix]>0&&+input[p+suffix]<2))
      throw new RangeError(p+suffix+' ต้องเป็นจำนวนเต็ม ≥2 หรือ 0=Auto');
    if(![0,12,16,20,25,32].includes(+input[p+'Db'])||![0,6,9,10,12].includes(+input[p+'Ldb']))
      throw new RangeError(p+' เลือกขนาด DB/RB จากรายการหรือ 0=Auto');
    if(+input[p+'Bw']>0&&+input[p+'Bw']<+input.ipile+10)
      throw new RangeError(p+'Bw ต้องไม่น้อยกว่าหน้าเข็ม + หุ้มสองด้าน = '+(+input.ipile+10)+' ซม. หรือ 0=Auto');
    if(+input[p+'Bh']>0&&+input[p+'Bh']<20)throw new RangeError(p+'Bh ต้อง ≥20 ซม. หรือ 0=Auto');
    if(+input[p+'Lsp']>0&&+input[p+'Lsp']<5)throw new RangeError(p+'Lsp ต้อง ≥5 ซม. หรือ 0=Auto');
  }
  if(type==='soldier'&&input.soldierSys==='stay'){
    if(!['all','alternate'].includes(input.stayPattern))throw new RangeError('เลือกรูปแบบสเตย์ทุกเสาหรือเสาเว้นเสา');
    if(input.stayPattern==='alternate'&&input.frontBeamMode!=='none')throw new RangeError('stayPattern เสาเว้นเสา: frontBeamMode ต้องเลือกไม่มีคานตามแนวกำแพง; หากมีคานต้องวิเคราะห์การถ่ายแรงระหว่างเข็มก่อน');
    const a=+input.stayLvl>0?+input.stayLvl:Math.min(Math.max(+input.hp/4,.8),+input.hp-.2);
    if(+input.capLvl>0&&(+input.capLvl<=a||+input.capLvl>=+input.hp))
      throw new RangeError('hcap ต้องลึกกว่าจุดต่อ a และอยู่เหนือระดับขุด (hcap < H)');
    if(![12,16,20,25,32].includes(+input.ancDowelDb)||!Number.isInteger(+input.ancDowelN))
      throw new RangeError('เลือก DB12/16/20/25/32 และจำนวนเดือยเป็นจำนวนเต็ม (0=Engine เลือก)');
    for(const key of ['ancCapB','ancCapL'])if(+input[key]>0&&+input[key]<=+input.ancPileSec/100)
      throw new RangeError(key+' ต้องกว้างกว่าหน้าตัดเข็มสมอ');
    if(+input.ancCapH>0&&+input.ancCapH<.2)throw new RangeError('ancCapH ต้องไม่น้อยกว่า 0.20 ม. หรือ 0=รูปเบื้องต้น');
    const capLength=+input.ancCapL||Math.max(.55,+input.ancPileSec/100+.20);
    const frontCount=Math.ceil(+input.Lw/+input.pileS-1e-9)+1;
    const centres=[];
    const indices=Array.from({length:frontCount},(_,k)=>k).filter(k=>input.stayPattern!=='alternate'||k%2===0);
    for(let k=0;k<indices.length;k+=2){
      const first=Math.min(indices[k]*+input.pileS,+input.Lw),last=indices[k+1]==null?first:Math.min(indices[k+1]*+input.pileS,+input.Lw);
      centres.push((first+last)/2);
    }
    if(centres.some((z,k)=>k>0&&z-centres[k-1]<capLength-1e-9))
      throw new RangeError('ancCapL ยาวเกินระยะสมอ ทำให้ฐานหัวเข็มสมอซ้อนกัน');
    if(!I_PILE_CATALOG.includes(+input.ancPileSec))throw new RangeError('เลือกขนาดเข็มสมอจากรายการ I-pile');
  }
  if (type !== 'duckfoot' && Number(input.zw) < Number(input.hp)
    && Number(input.gsat) < Number(input.gs)) {
    throw new RangeError('เมื่อมีน้ำ น้ำหนักดินอิ่มตัว γsat ต้องไม่ต่ำกว่าน้ำหนักดินชื้น γ');
  }
  if (type === 'soldier' && !Number.isInteger(Number(input.weepN))) {
    throw new RangeError('จำนวนระดับระบายน้ำต้องเป็น 0, 1 หรือ 2');
  }
  if (type === 'soldier' && Number(input.stayLvl) > 0
    && Number(input.stayLvl) > Number(input.hp) - 0.2 + 1e-9) {
    throw new RangeError('ระดับจุดยึดรั้งต้องอยู่เหนือระดับขุดอย่างน้อย 0.20 ม.');
  }
  if ((type === 'pile' || type === 'pilecf') && Number(input.ttop) > Number(input.t)) {
    throw new RangeError('พนังยอดต้องไม่หนากว่าพนังโคน');
  }
}

function freezeChecks(rows) {
  return rows.map((c) => ({
    key: c.k, value: c.v, criterion: c.req, ok: c.ok === true,
    dc: Number.isFinite(c.u) && c.u >= 0 ? c.u : null,
    fix: typeof c.fix === 'string' ? c.fix.replace(/<[^>]*>/g, '') : '',
  }));
}

function pileForce(r, profile) {
  const stem = r.stemTab?.grid || [];
  const strips = r.strips || [];
  const stemBars = r.mode === 'but'
    ? strips.flatMap((s) => [
      { req: s.As_, prov: s.b_?.prov, bar: s.b_?.txt },
      { req: s.As$, prov: s.b$?.prov, bar: s.b$?.txt },
    ])
    : (r.stemTab || []).map((s) => ({ req: s.As, prov: s.bar?.prov, bar: s.bar?.txt }));
  const governingBar = stemBars.sort((a, b) =>
    b.req / Math.max(b.prov || 0, 1) - a.req / Math.max(a.prov || 0, 1))[0];
  return {
    load: { surcharge:r.surcharge, H: r.H, Hq: r.Hq, beta: r.beta, Ka: r.Ka, Phs: r.Phs, Pw: r.Pw,
      Ph: r.Ph, Mo: r.Mo, ybar: r.ybar },
    stem: {
      M: r.mode === 'but' ? Math.max(...strips.map((s) => Math.abs(s.Mn_ || 0)), 0)
        : Math.max(...stem.map((s) => Math.abs(s.M || 0)), r.stemTab?.[3]?.Mu || 0),
      V: r.VuS, capacityV: r.phiVcS,
      AsReq: governingBar?.req, AsProv: governingBar?.prov, bar: governingBar?.bar,
      diagram: r.mode === 'but' ? null : stem.map((s) => ({ z: s.z, m: s.M, v: s.V })),
      strips: r.mode === 'but' ? strips.map((s) => ({
        from: s.z1, to: s.z2, supportM: s.Mn_, spanM: s.Mn$, V: s.Vu,
        barSupport: s.b_?.txt, barSpan: s.b$?.txt,
      })) : [],
    },
    heel: { M: r.MH_, V: r.VuH, capacityV: r.phiVcH,
      AsReq: r.AsH_, AsProv: r.barH_?.prov, bar: r.barH_?.txt },
    toe: { M: r.MT, V: r.VuT, capacityV: r.phiVcT,
      AsReq: r.AsT, AsProv: r.barT?.prov, bar: r.barT?.txt,
      Mtop:r.MTtop,AsTop:r.AsTtop,barTop:r.barFT?.txt,
      diagram:r.toeAnalysis.grid.map(p=>({z:p.x,m:p.M,v:p.V})) },
    pile: {
      toeX: r.pile.xT, heelX: r.pile.xH, Bp: r.pile.Bp,
      Pa: r.pile.Pa, axT: r.pile.axT, axH: r.pile.axH,
      nT: r.pile.nT, nH: r.pile.nH, Ntot: r.pile.Ntot,
      CG: r.pile.CG, Ix: r.pile.Ix, RvT: r.pile.RvT,
      OTM: r.pile.OTM, armRv: r.pile.armRv, Mcg: r.pile.Mcg,
      armT: r.pile.armT, armH: r.pile.armH,
      axTv: r.pile.axTv, axHv: r.pile.axHv,
      btTdeg: r.pile.btTdeg, btHdeg: r.pile.btHdeg,
      Rh: r.pile.Rh, hcap: r.pile.hcap, embed: Number(r.i.pileEmb),
      Mu: r.pile.struct?.MuP, Mcr: r.pile.struct?.Mcr,
      Vu: r.pile.struct?.VuP, Vc: r.pile.struct?.phiVc,
      dowel: r.pile.struct?.dowel ? {
        AsReq: r.pile.struct.dowel.AsReq, AsProv: r.pile.struct.dowel.Asprov,
        count: r.pile.struct.dowel.n, db: r.pile.struct.dowel.db,
      } : null,
      diagram: r.pile.disp ? {
        step: r.pile.disp.h,
        m: [...r.pile.disp.Mprof], v: [...r.pile.disp.Vprof],
        basis: 'SERVICE · ต่อเข็ม',
      } : null,
      designTrace: {
        springM: r.pile.disp?.mMax ?? null,
        frameM: r.pile.frame?.Mpile ?? null,
        serviceM: Math.max(r.pile.disp?.mMax || 0, r.pile.frame?.Mpile || 0),
        serviceV: r.pile.struct?.VuP == null ? null
          : r.pile.struct.VuP / DESIGN_PROFILES[profile].gH,
        lateralFactor: DESIGN_PROFILES[profile].gH,
        governing: (r.pile.frame?.Mpile || 0) > (r.pile.disp?.mMax || 0)
          ? 'FRAME' : 'WINKLER',
      },
    },
  };
}

function recommendations(r, checks, input, profile, type) {
  if (type === 'soldier') {
    if (checks.every((c) => c.ok)) return [];
    for (const size of I_PILE_CATALOG.filter((n) => n > Number(input.ipile))) {
      const trial = designRetainingWall({ ...input, ipile: size }, { profile });
      if (checksFor(trial).every((c) => c.ok === true)) {
        return [{
          title: 'เข็มตัวไอที่ผ่านทะเบียน Engine ชุดนี้',
          value: 'I-' + size,
          basis: 'ทดสอบใหม่ทุกเกณฑ์ด้วย input เดิม เปลี่ยนเฉพาะ ipile; ต้องยืนยันแค็ตตาล็อกและข้อมูลดิน',
        }];
      }
    }
    return [{
      title: 'ขนาดเข็มตัวไอในทะเบียนยังไม่ผ่านครบ',
      value: 'ไม่พบใน I-18 ถึง I-45',
      basis: 'ต้องแก้ระบบยึดรั้ง ระยะเข็ม หรือข้อมูลโครงการ แล้วคำนวณใหม่',
    }];
  }
  const out = [];
  if (r.pile) {
    if (!r.pile.tension && Math.max(r.pile.ratT, r.pile.ratH) > 1) {
      out.push({
        title: 'กำลังอัดเสาเข็มขั้นต่ำสำหรับรายการแกน',
        value: 'Pa ≥ ' + Math.ceil(Math.max(r.pile.axT, r.pile.axH)) + ' ตัน/ต้น',
        basis: 'จากแรงแกน toe/heel ปัจจุบัน; เป็นกำลังจากผลทดสอบหรือข้อมูลธรณีเทคนิค ไม่ใช่ขนาดเข็มสำเร็จรูป',
      });
    }
    if (!r.pile.hOK) {
      const needed = Math.max(0, Number(input.pileLat)
        + (r.pile.Rh - r.pile.hcap) / r.pile.Ntot);
      out.push({
        title: 'กำลังต้านราบขั้นต่ำสำหรับรายการแรงราบ',
        value: 'Hlat ≥ ' + (Math.ceil(needed * 2) / 2).toFixed(1) + ' ตัน/ต้น',
        basis: 'ที่มุม batter และระยะเข็มปัจจุบัน; ต้องยืนยัน Broms/ผลทดสอบก่อนกรอก',
      });
    }
    if (r.pile.struct && (!r.pile.struct.McrOK || !r.pile.struct.VuOK)) {
      out.push({
        title: 'กำลังหน้าตัดเข็มที่ต้องมี',
        value: 'Mต้าน ≥ ' + r.pile.struct.MuP.toFixed(1) + ' kN·m; Vต้าน ≥ '
          + r.pile.struct.VuP.toFixed(1) + ' kN',
        basis: 'ต้องเลือกหน้าตัดหรือแค็ตตาล็อกที่ให้กำลังสองรายการนี้พร้อมกัน แล้วคำนวณใหม่',
      });
    }
  }
  return out;
}

function soldierForce(r, profile) {
  return {
    ...(r.alternate?{unbracedPile:{
      indices:r.alternate.unbracedIndices,bracedIndices:r.alternate.bracedIndices,basis:r.alternate.basis,
      Mu:r.alternate.unbraced.Mpile,Vu:r.alternate.unbraced.Vpile,
      Mcr:r.alternate.unbraced.Mcap,Vc:r.alternate.unbraced.Vcap,
      requiredD:r.alternate.requiredD,unbracedDreq:r.alternate.unbraced.Dreq,bracedDreq:r.Dreq,
      serviceM:r.alternate.unbraced.disp.mMax,serviceV:r.alternate.unbraced.disp.vMax,
      diagram:{step:r.alternate.unbraced.disp.h,m:[...r.alternate.unbraced.disp.Mprof],v:[...r.alternate.unbraced.disp.Vprof],basis:'SERVICE · เข็มเว้นสเตย์ · เข็มยื่น FE ต่อเข็ม'},
    }}:{}),
    load: { surcharge:r.surcharge, H: r.H, Ka: r.Ka, Kp: r.Kp, paAtExc: r.pa(r.H),
      activeDry: r.Ka * (Number(r.i.gs) * r.H * r.H / 2 + Number(r.i.q) * r.H) },
    pile: {
      Bp: r.Bp, embed: r.D, Dreq: r.Dreq, Mu: r.Mpile,
      Mcr: r.Mcap, Vu: r.Vpile, Vc: r.Vcap,
      spacing: r.S, n: r.nPile, stay: r.stay ? {
        axial: r.stay.stayAxial, level: r.a, span: r.stay.Lb,
        bar: r.stay.nBr + '-DB' + r.stay.db,
        horizontal:r.stay.T,horizontalPerMetre:r.T,vertical:r.stay.verticalPerFront,
        anchorHorizontal:r.stay.horizontalPerAnchor,anchorUplift:r.stay.upliftPerAnchor,
        length:r.stay.layout?.maxLength||r.stay.groundAnchor?.freeLength,
        drop:r.stay.layout?.drop||0,
        planOffset:r.stay.layout?.maxPlanOffset||0,
      } : null,
      diagram: {
        step: r.disp.h, m: [...r.disp.Mprof], v: [...r.disp.Vprof],
        basis: 'SERVICE · FE ต่อเข็ม',
      },
      designTrace: {
        springM: r.disp.mMax, frameM: null, serviceM: r.disp.mMax,
        serviceV: r.disp.vMax, lateralFactor: DESIGN_PROFILES[profile].gH,
        governing: 'FE',
      },
    },
    lagging: { thickness: r.tLag, width: r.lag?.plankW, dc: r.lag?.lagUtil },
  };
}

export function createSystemSnapshot(raw, profile = 'thai2566') {
  const type = raw?.wtype;
  if (!SYSTEM_TYPES[type]) throw new RangeError('ไม่รู้จักระบบกำแพง');
  raw={...(type==='duckfoot'?normalizeDuckLoadInput(raw):normalizeSurchargeInput(raw)),unitMode:Object.hasOwn(raw,'unitMode')?raw.unitMode:'si'};
  raw=normalizeRearAnchorInput(normalizeSystemCover(raw,type),type);
  if(type==='duckfoot'&&!Object.hasOwn(raw,'beamClear'))raw={...raw,beamClear:DUCK_BEAM_CLEAR_DEFAULT};
  validateSystemInput(raw, type);
  if (!DESIGN_PROFILES[profile]) throw new RangeError('โปรไฟล์มาตรฐานไม่ถูกต้อง');
  const picked = Object.fromEntries(SYSTEM_INPUT_KEYS[type].map((key) => [key,
    textKeys.includes(key)
      ? raw[key] : Number(raw[key])]));
  const input = type === 'duckfoot' ? picked
    : { ...SYSTEM_DEFAULTS, ...picked, wtype: type };
  input.profile = profile;
  const stamp = new Date().toISOString();
  if (type === 'duckfoot') {
    const design = calculateDuckfoot(input);
    return deepFreeze({
      schema: 'rw01-systems/4', stamp, type, profile, input,
      authority: 'รายงานผลคำนวณตามแบบจำลองและตัวคูณแรงที่ระบุ · NOT FOR CONSTRUCTION',
      ...design, recommendation:recommendDuckfoot(input,design),
      equationLedger:buildEquationLedger({type,profile,input,checks:design.checks,identity:stamp}),
      rebarLayout:buildDuckDesignRebarLayout(input,design),
      forces:{column:design.column,beam:design.beamDesign,footing:design.footing},
      geometry: design.geometry,
      warnings: ['เสาทุกต้นอยู่ระนาบเดียวกันชิดแนวเขต ฐานแผ่ยื่นเข้าที่ดินด้านเดียว คานต่อเนื่องอยู่เหนือ footing ตามแนวยาว',
        ...design.assumptions],
    });
  }
  setEngineUnits('si');
  const result = designRetainingWall(input, { profile });
  const checks = freezeChecks(checksFor(result));
  const advice = recommendations(result, checks, input, profile, type);
  const forces = type === 'soldier' ? soldierForce(result, profile)
    : pileForce(result, profile);
  forces.load.surcharge=result.surcharge;
  if(type==='soldier')forces.rearAnchor=buildRearAnchorActions(result,DESIGN_PROFILES[profile].gH,stamp);
  const geometry = type === 'soldier'
    ? { hp: result.H, Lw: result.Lw, pileB: result.Bp, pileS: result.S, embed: result.D,
      lagT: result.tLag, lagW: result.lag?.plankW || .3, stayLevel: result.a,
      stayLength: result.stay?.Lb || 0, staySystem: result.SS,
      anchor:result.stay?.groundAnchor||null,stayLayout:result.stay?.layout||null,
      stayB:result.stay?.bw,stayH:result.stay?.bh,rearCaps:rearPileCaps(result.stay?.layout,input),
      capBeams:(result.capD?.beams||[]).filter(b=>b.present).map(b=>({mark:b.name,width:b.bw,depth:b.bh,
        y:b.name==='RB1'?result.H:b.name==='RB2'?result.H-result.a:0})) }
    : { hp: +input.hp, hz: +input.hz, t: +input.t, ttop: +input.ttop,
      toe: +input.toe, heel: +input.heel, B: +input.B, Lw: +input.Lw,
      pileB: result.pile.Bp, pileEmb: +input.pileEmb,
      pileSt: result.pile.sT, pileSh: result.pile.sH,
      pileToeX: result.pile.xT, pileHeelX: result.pile.xH,
      ribHeight:result.cfHr,ribLength:result.cfLr,ribCount:result.qty.nBut,ribCentreSpacing:result.Lt,
      ribSpacing: type === 'pilecf' ? +input.L : 0, ribThickness: type === 'pilecf' ? +input.bs : 0 };
  return deepFreeze({
    schema: 'rw01-systems/1', stamp, type, profile, input,
    authority: 'รายงานผลคำนวณและเหล็กตามแบบจำลอง · NOT FOR CONSTRUCTION',
    status: checks.some((c) => !c.ok) ? 'FAIL' : 'PASS',
    checks, forces, geometry,
    stressContour:projectEngineContour(result,type,stamp),
    reportMembers:type==='soldier'?[]:projectReportMembers(result),
    reportShear:type==='soldier'?[]:projectReportShear(result),
    reportSoldier:type==='soldier'?projectSoldierReport(result):null,
    reportWeights:type==='soldier'?[]:result.W.filter(w=>w.ms&&w.v!==0).map(w=>({name:w.n,value:w.v,x:w.x})),
    equationLedger:buildEquationLedger({type,profile,input,checks,identity:stamp}),
    rebarLayout:type==='soldier'?buildSoldierDesignRebarLayout(result):buildDesignRebarLayout(result),
    recommendations: advice,
    bbs: (result.qty?.bbs || []).map((b) => ({
      mark: b.mk, position: b.pos, size: b.secTag || (b.size ? 'DB' + b.size : ''),
      detail: b.detail, length: b.len, count: b.n,
    })),
    quantities: { piles: result.qty?.nPile || 0, ribs: result.qty?.nBut || 0 },
    warnings: [...(result.warn || [])].map((w) => String(w).replace(/<[^>]*>/g, '')),
  });
}
