/**
 * Snapshot ของการ์ดกำแพงกันดิน — สัญญาผู้ดัดแปลง (adapter contract) ตาม
 * CONCRETE_CARD_1TO1_STANDARD.md ข้อ 11
 *
 * กติกาที่ห้ามผิด (ข้อ 4 ของมาตรฐาน)
 *   1. engine เป็นเจ้าของสูตร แรง กำลัง อัตราส่วนใช้งาน เหล็กเสริม และคำตัดสิน แต่ผู้เดียว
 *   2. หน้าจอ รายงาน SVG และแบบ ห้ามคำนวณค่าทางวิศวกรรมซ้ำ — อ่านจาก Snapshot อย่างเดียว
 *   3. ทุกช่องทางออกต้องอ้าง Snapshot เดียวกัน จึงพก id และลายนิ้วมือไปด้วยทุกที่
 *   4. แก้ input หรือเปลี่ยนโปรไฟล์ = ผลเดิมกลายเป็น STALE ทันที
 *   6. input ที่ไม่รองรับ ไม่รู้จัก หรือไม่ครบ ต้องปิดประตู ไม่มีผลลัพธ์
 *
 * ไฟล์นี้เป็นชั้นเดียวที่ผูก engine เข้ากับชั้นแสดงผล และเป็นชั้นเดียวที่แช่แข็งผลลัพธ์
 */
import {
  designRetainingWall, checksFor, constructionSpec, setEngineUnits, DESIGN_PROFILES, FS_REQUIRED,
} from './engine.mjs?rwv=20261003-final-acceptance-1&stay=20261004-alternate-1';
import {buildEquationLedger} from './equationLedger.mjs?rwv=20261003-final-acceptance-1&stay=20261004-alternate-1';
import { retainingWallSection } from './drafting/rwSectionGeometry.js?rwv=20261001-leader-layout-1';
import { retainingWallPlan } from './drafting/rwPlanGeometry.js?rwv=20261001-leader-layout-1';
import { retainingWallRebarDetail, retainingWallButWallDetail } from './drafting/rwRebarDetailGeometry.js?rwv=20261001-leader-layout-1';
import { retainingWallBarSchedule } from './drafting/rwBarScheduleGeometry.js?rwv=20261001-leader-layout-1';
import { retainingWallCheckSummary } from './drafting/rwCheckSummaryGeometry.js?rwv=20260930-load-units-1';
import { retainingWallReport } from './drafting/rwReportGeometry.js?rwv=20261003-main-equations-1&stay=20261004-alternate-1';
import { composeSheetSet, scaleSummary } from './drafting/sheetComposer.js?rwv=20261002-rendered-text-1';
import { SHEET_SCALE, coverTable } from './drafting/draftingStandard.js?rwv=20260930-load-units-1';
import { buildRetainingWallPresentation } from './presentation.mjs?rwv=20260930-load-units-1';
import { buildRetainingWallRecoveryProjection } from './recovery.mjs?rwv=20260930-load-units-1';
import { RW_REBAR_GEOMETRY_HOLD } from './authorityContracts.mjs?rwv=20260930-load-units-1';
import { normalizeSurchargeInput } from './loadInput.mjs?rwv=20260930-load-units-1';
export { RW_REBAR_GEOMETRY_HOLD } from './authorityContracts.mjs?rwv=20260930-load-units-1';

/** รุ่นของชั้นคำนวณ — เปลี่ยนเมื่อสูตรหรือการตีความเปลี่ยน เพื่อให้ลายนิ้วมือต่างจากของเดิม */
export const RETAINING_WALL_ENGINE_VERSION = 'rw-engine-2026.09.30g';

/**
 * ขอบเขตที่รุ่นนี้รองรับจริง — นอกจากนี้ต้องปิดประตู ไม่ใช่คำนวณให้แล้วค่อยเตือน
 *
 * เกณฑ์ที่ใช้ตัดสินว่า "รองรับ" คือ engine คำนวณได้ **และ** ชั้นเขียนแบบวาดออกมาถูก
 *   cant     กำแพงยื่น — Rankine · มีเทียบ Das ตัวอย่าง 13.1 และ 8.1
 *   gravity  กำแพงมวล/กึ่งมวล — Coulomb พร้อมมุมเสียดทานผนัง δ · มี oracle อิสระใน engine
 *            รูปตัด ผัง รายละเอียดเหล็ก และตารางเหล็ก สร้างได้ครบเหมือนกำแพงยื่น
 *   but      กำแพงมีครีบ — สร้างชุดแบบ/รายงานได้ แต่คง CALCULATION REPORT · NOT FOR CONSTRUCTION จน PE ลงนาม
 *
 * ที่ยังไม่เปิด (engine คำนวณได้ แต่แบบยังวาดไม่ถูก จึงยังไม่ปล่อย)
 *   pilecf      กำแพงมีครีบบนเสาเข็ม — ยังไม่มีผังเข็มและรูปตัดเข็ม
 *   pile        กำแพงบนเสาเข็ม — ยังไม่มีผังเข็มและรูปตัดเข็ม
 *   soldier     เสาเข็มพืด — คนละแบบจำลอง ต้องมีชุดแบบของตัวเอง
 */
export const SUPPORTED_WALL_TYPES = Object.freeze(['cant', 'gravity', 'but']);

/**
 * ขอบเขต coverage ของ canonical verdict รุ่นนี้ — เป็น metadata คงที่ ไม่ใช่
 * สูตรหรือ PASS/FAIL เพิ่มเติม. STEM/HEEL/TOE อ่านผลจาก checksFor เหมือนกัน
 * coverage ครบไม่ได้แปลว่า input ชุดนั้นผ่าน หรือเอกสารได้รับการลงนาม.
 */
export const RW_ENGINEERING_COVERAGE = Object.freeze({
  status: 'REGISTERED_CHECKS_COMPLETE',
  releaseAuthority: false,
  excludedChecks: Object.freeze([]),
  label: 'BETA · ENGINE CHECKS · STEM / HEEL / TOE · NOT FOR CONSTRUCTION',
});

/**
 * อำนาจของเอกสารแยกตามโหมด — เป็นข้อมูลผลิตภัณฑ์ ไม่ใช่ผล PASS/FAIL
 * จึงห้ามอนุมานใหม่ใน renderer หรือปลดตราประทับจากผลตรวจที่ผ่านครบ
 */
export const RW_AUTHORITY_BY_MODE = Object.freeze({
  cant: Object.freeze({
    status: 'CALCULATION_REPORT',
    constructionAuthority: false,
    label: 'ENGINE CHECKS · NOT FOR CONSTRUCTION',
    reason: RW_ENGINEERING_COVERAGE.label + ' — ต้องให้วิศวกรผู้รับผิดชอบตรวจสอบและลงนามก่อนใช้งาน',
  }),
  gravity: Object.freeze({
    status: 'CALCULATION_REPORT',
    constructionAuthority: false,
    label: 'ENGINE CHECKS · NOT FOR CONSTRUCTION',
    reason: RW_ENGINEERING_COVERAGE.label + ' — ต้องให้วิศวกรผู้รับผิดชอบตรวจสอบและลงนามก่อนใช้งาน',
  }),
  but: Object.freeze({
    status: 'CALCULATION_REPORT',
    constructionAuthority: false,
    label: 'CALCULATION REPORT · ENGINE CHECKS · NOT FOR CONSTRUCTION',
    reason: 'CALCULATION REPORT · ' + RW_ENGINEERING_COVERAGE.label + ' — แบบ counterfort รอวิศวกรผู้รับผิดชอบตรวจสอบและลงนาม',
  }),
});

/* ── ช่องกรอกที่การ์ดนี้รับ ───────────────────────────────────────
   หน่วยเขียนกำกับไว้ตรงนี้ที่เดียว เพราะเคยพลาดเรื่องหน่วยมาแล้ว
   (ระยะหุ้มคอนกรีตเป็นมิลลิเมตร ส่วนความยาวอื่นเป็นเมตร ปนกันในอ็อบเจกต์เดียว) */
export const RW_FIELDS = Object.freeze([
  { key: 'hp', group: 'geometry', th: 'ความสูงพนังเหนือฐาน', unit: 'ม.', min: 0.5, max: 12, step: 0.1, required: true },
  { key: 'hz', group: 'geometry', th: 'ความหนาฐานราก', unit: 'ม.', min: 0.2, max: 2, step: 0.05, required: true },
  { key: 't', group: 'geometry', th: 'ความหนาพนังที่โคน', unit: 'ม.', min: 0.15, max: 2, step: 0.05, required: true },
  { key: 'ttop', group: 'geometry', th: 'ความหนาพนังที่ยอด', unit: 'ม.', min: 0.15, max: 2, step: 0.05, required: true },
  { key: 'B', group: 'geometry', th: 'ความกว้างฐานรวม B', unit: 'ม.', min: 0.5, max: 16, step: 0.05, required: true },
  { key: 'toe', group: 'geometry', th: 'ความยาวส่วนยื่นหน้า (toe)', unit: 'ม.', min: 0, max: 6, step: 0.05, required: true },
  { key: 'heel', group: 'geometry', th: 'ความยาวส่วนยื่นหลัง (heel)', unit: 'ม.', min: 0, max: 8, step: 0.05, required: true },
  { key: 'dk', group: 'geometry', th: 'ความลึก shear key', unit: 'ม.', min: 0, max: 2, step: 0.05, required: false },
  { key: 'Lw', group: 'geometry', th: 'ความยาวกำแพงที่คิดปริมาณ', unit: 'ม.', min: 1, max: 200, step: 0.5, required: true },

  { key: 'gs', group: 'soil', th: 'หน่วยน้ำหนักดินถม (ชื้น)', unit: 'kN/ม³', min: 12, max: 24, step: 0.5, required: true },
  { key: 'gsat', group: 'soil', th: 'หน่วยน้ำหนักดินถม (อิ่มตัว)', unit: 'kN/ม³', min: 12, max: 26, step: 0.5, required: true },
  { key: 'phi', group: 'soil', th: 'มุมเสียดทานภายใน φ', unit: 'องศา', min: 15, max: 45, step: 0.5, required: true },
  { key: 'c', group: 'soil', th: 'แรงยึดเกาะ c', unit: 'kPa', min: 0, max: 100, step: 1, required: false },
  { key: 'beta', group: 'soil', th: 'ความชันหลังกำแพง β', unit: 'องศา', min: 0, max: 30, step: 1, required: false },
  { key: 'q', group: 'soil', th: 'น้ำหนักจรบนผิวดิน', unit: 'kPa', min: 0, max: 100, step: 1, required: false },
  /* μ = tan(δb) — δb 0–45° ให้ μ 0–1.0 · พื้นเดิม 0.2 เคยยกฐานลื่นให้ฝืดเกินจริง */
  { key: 'mu', group: 'soil', th: 'สัมประสิทธิ์เสียดทานใต้ฐาน μ', unit: '', min: 0, max: 1.0, step: 0.05, required: true },
  /* พื้นเดิม 30 เคยยก qa=10 ของผู้ใช้เป็นสามเท่าเงียบ ๆ — ดินอ่อนจริงต้องคำนวณได้ */
  { key: 'qa', group: 'soil', th: 'กำลังแบกทานยอมให้ q_a', unit: 'kPa', min: 10, max: 1000, step: 5, required: true },
  { key: 'Df', group: 'soil', th: 'ระดับฝังฐาน D_f', unit: 'ม.', min: 0, max: 6, step: 0.1, required: false },

  { key: 'fc', group: 'material', th: "กำลังอัดคอนกรีต f′c", unit: 'MPa', min: 18, max: 50, step: 1, required: true },
  { key: 'fy', group: 'material', th: 'กำลังครากเหล็ก f_y', unit: 'MPa', min: 235, max: 490, step: 5, required: true },
  { key: 'gc', group: 'material', th: 'หน่วยน้ำหนักคอนกรีต', unit: 'kN/ม³', min: 22, max: 26, step: 0.5, required: true },
  { key: 'cov', group: 'material', th: 'ระยะหุ้มคอนกรีตพนัง', unit: 'มม.', min: 20, max: 100, step: 5, required: true },
  { key: 'db', group: 'material', th: 'ขนาดเหล็กหลักที่ต้องการ', unit: 'มม.', min: 10, max: 32, step: 2, required: true },
]);

/** กลุ่มช่องกรอกสำหรับจัดหน้าจอ */
export const RW_GROUPS = Object.freeze([
  { id: 'geometry', th: 'รูปทรงหน้าตัด' },
  { id: 'soil', th: 'ดินและน้ำ' },
  { id: 'material', th: 'วัสดุ' },
]);

/**
 * ค่าตั้งต้น — เป็นตัวอย่างที่ผ่านการตรวจสอบแล้วว่า engine รับได้
 * ไม่ใช่ "ค่าที่แนะนำให้ใช้ออกแบบ" ผู้ใช้ต้องกรอกของโครงการตัวเองเสมอ
 */
export const RW_DEFAULT_INPUT = Object.freeze({
  wtype: 'cant',
  hp: 5.4, hz: 0.6, t: 0.5, ttop: 0.5, B: 3.6, toe: 1.0, heel: 2.1, dk: 0, Lw: 12,
  gs: 18, gsat: 18, phi: 30, c: 0, beta: 0, q: 0, mu: 0.5, qa: 250, Df: 0,
  zw: 99,                    // ระดับน้ำที่ลึกกว่าฐาน = ไม่คิดแรงดันน้ำ
  fc: 24, fy: 390, gc: 24, cov: 50, db: 16,
  /* ★ ค่าตั้งต้นครีบเดิม L=10/bs=1 ทำให้กำแพงมีครีบตกทันที (REBAR FIT + SHEAR HEEL
     เพราะโมเมนต์ผนัง∝L²) — ชุด L=3.0/bs=0.3 ตรวจแล้วผ่านทุกแถบ */
  bs: 0.3, L: 3.0, cfL: 0, cfH: 0, kh: 0, kv: 0,
  cJoint: 10, cWeep: 2, cDrainDen: 200, cLean: 0.05, cFilter: 0.3,
  cFillLift: 0.3, cCompact: 95, cWork: 0.5, cAgg: 20, cWallLift: 1.5, cMassTrigger: 1,
  cTolPlan: 20, cTolLevel: 10, cTolPlumb: 10, cTolThk: 10,
  weep: true, weepN: 2, usePp: false, ppFS: 2,
});

/** แฮชแบบ FNV-1a — ใช้ทำลายนิ้วมือของชุด input ไม่ใช่งานเข้ารหัส */
function fingerprintOf(value) {
  const stable = (v) => {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  };
  const s = stable(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * ลายนิ้วมือของร่างที่กำลังกรอกอยู่ — หน้าจอใช้เทียบกับลายนิ้วมือของ Snapshot
 * เพื่อรู้ทันทีว่าผลที่เห็นอยู่ยังตรงกับ input ปัจจุบันหรือกลายเป็นของเก่าไปแล้ว
 */
export const draftFingerprint = (rawInput, profileId) =>
  fingerprintOf({ input: rawInput, profileId, v: RETAINING_WALL_ENGINE_VERSION });

/** แช่แข็งลึก — ผลคำนวณต้องแก้ไม่ได้หลังสร้างเสร็จ */
function deepFreeze(obj, seen = new WeakSet()) {
  if (obj === null || typeof obj !== 'object' || seen.has(obj)) return obj;
  seen.add(obj);
  for (const k of Object.getOwnPropertyNames(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object') deepFreeze(v, seen);
  }
  return Object.freeze(obj);
}

/** สำเนา plain-data เพื่อไม่ให้การ freeze projection ไป freeze/แก้ reference ในผล engine ต้นทาง */
function clonePlain(value) {
  if (Array.isArray(value)) {
    const copy = value.map(clonePlain);
    /* Array ของ Engine บางชุดพกข้อมูลประกอบแบบ enumerable (เช่น
       stemTab.grid) นอก index ปกติ ต้องสำเนาคีย์เหล่านี้ด้วย มิฉะนั้น
       Snapshot จะทำข้อมูล SFD/BMD ที่ Engine สร้างไว้หายระหว่างทาง */
    for (const key of Object.keys(value)) {
      if (!/^(0|[1-9]\d*)$/.test(key)) copy[key] = clonePlain(value[key]);
    }
    return copy;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clonePlain(item)]));
  }
  return value;
}

/**
 * Projection ปริมาณสำหรับ renderer — ขยายความยาวรวมครั้งเดียวที่ Snapshot
 * แล้ว renderer มีหน้าที่พิมพ์เท่านั้น ห้ามคำนวณ len × n ซ้ำเอง
 */
export function buildRetainingWallQuantityProjection(quantity) {
  if (!quantity || !Array.isArray(quantity.bbs) || !quantity.bbs.length) {
    throw new TypeError('quantityProjection: ต้องมี qty.bbs จาก engine');
  }
  if (!Number.isFinite(quantity.steelKg) || quantity.steelKg < 0) {
    throw new TypeError('quantityProjection: ต้องมี qty.steelKg จาก engine ที่เป็นจำนวนไม่ติดลบ');
  }

  const marks = new Set();
  const bbs = quantity.bbs.map((source, index) => {
    if (!source || typeof source !== 'object') {
      throw new TypeError('quantityProjection: BBS แถว ' + (index + 1) + ' ต้องเป็นอ็อบเจกต์');
    }
    if (typeof source.mk !== 'string' || !source.mk.trim() || marks.has(source.mk)) {
      throw new TypeError('quantityProjection: มาร์ค BBS ต้องเป็นข้อความไม่ว่างและไม่ซ้ำ');
    }
    marks.add(source.mk);
    if (!Number.isFinite(source.size) || source.size <= 0
        || !Number.isFinite(source.len) || source.len <= 0
        || !Number.isInteger(source.n) || source.n < 1
        || !Number.isFinite(source.kg) || source.kg < 0
        || typeof source.detail !== 'string' || !source.detail.trim()) {
      throw new TypeError('quantityProjection: BBS ' + source.mk + ' ต้องมี size/len/n/kg/detail จาก engine ที่ใช้ได้');
    }
    const bend = source.bend;
    const bendCode = bend && typeof bend.code === 'string' && bend.code.trim() ? bend.code : null;
    const bendType = bend && typeof bend.type === 'string' && bend.type.trim() ? bend.type : null;
    if (!bend || typeof bend !== 'object' || (!bendCode && !bendType)) {
      throw new TypeError('quantityProjection: BBS ' + source.mk + ' ต้องมี bend.code หรือ bend.type จาก engine');
    }
    const totalLen = source.len * source.n;
    if (!Number.isFinite(totalLen) || totalLen <= 0) {
      throw new TypeError('quantityProjection: BBS ' + source.mk + ' สร้าง totalLen ไม่ได้');
    }
    return {
      ...clonePlain(source),
      totalLen,
      /* ใช้ข้อความ authority ของ engine ตรง ๆ: code มาก่อน และ type เป็น fallback ที่ประกาศจริง
         (K1 ใช้ bend.type=keyU โดยไม่มี bend.code — ห้าม renderer ประดิษฐ์ code เอง) */
      bendLabel: bendCode || bendType,
    };
  });

  return deepFreeze({
    source: 'engine.qty',
    bbs,
    steelKg: quantity.steelKg,
  });
}

/**
 * Projection แรงภายในและเหล็กอัตโนมัติสำหรับจอ/รายงาน
 *
 * Engine เป็นเจ้าของ M, V, As ที่ต้องการ เหล็กที่เลือก และ registered shear
 * checks ทั้งหมด ชั้นนี้เพียงจัดค่าชุดเดียวกันเป็น SFD/BMD และ D/C ที่ตรวจย้อนกลับได้:
 *   - D/C เหล็ก = As,req / As,prov
 *   - D/C เฉือน STEM/HEEL/TOE อ่าน u จาก registered checks โดยตรง
 *
 * จุดของ heel/toe เป็นค่าจุดคุมที่ Engine ส่งออก ไม่ลากเส้นสร้างรูปโค้งขึ้นเอง.
 * SHEAR-TOE อยู่ใน canonical verdict และใช้แถวตรวจเดียวกันทุกช่องทางออก
 * ห้าม renderer คำนวณ D/C หรือสร้าง PASS/FAIL ของตัวเอง.
 */
export function buildRetainingWallForceDesignProjection(r, checks) {
  if (!r || !r.i) throw new TypeError('forceDesign: ต้องมีผล Engine ที่ครบ');
  if (!Array.isArray(checks) || !checks.length) {
    throw new TypeError('forceDesign: ต้องมี registered checks จาก Engine');
  }

  const finite = (v, label) => {
    if (!Number.isFinite(v)) throw new TypeError('forceDesign: ' + label + ' ต้องเป็นตัวเลขจำกัด');
    return v;
  };
  const bar = (source, asReq, dc, face) => {
    if (!source || !Number.isFinite(source.db) || source.db <= 0
        || !Number.isFinite(source.s) || source.s <= 0
        || !Number.isFinite(source.prov) || source.prov <= 0
        || typeof source.txt !== 'string' || !source.txt.trim()) {
      throw new TypeError('forceDesign: เหล็ก ' + face + ' จาก Engine ไม่ครบ');
    }
    return {
      face,
      asReq: finite(asReq, face + '.asReq'),
      asProv: source.prov,
      dc: finite(dc, face + '.rebarDc'),
      selected: source.txt,
      db: source.db,
      spacing: source.s,
    };
  };
  const registeredShear = (key) => {
    const rows = checks.filter((row) => row && row.k === key);
    if (rows.length !== 1 || typeof rows[0].ok !== 'boolean' || !Number.isFinite(rows[0].u)) {
      throw new TypeError('forceDesign: registered check "' + key + '" ไม่ครบหรือไม่เป็นเอกลักษณ์');
    }
    return {
      status: rows[0].ok ? 'PASS' : 'FAIL',
      dc: rows[0].u,
      includedInVerdict: true,
      checkKey: key,
    };
  };
  const member = ({ id, label, axisLabel, length, bmd, sfd, moment, shear,
    shearCapacity, shearCheck, designs, diagramKind, note, bmdAlt = [] }) => {
    if (!Array.isArray(bmd) || bmd.length < 2 || !Array.isArray(sfd) || sfd.length < 2) {
      throw new TypeError('forceDesign: ' + id + ' ต้องมี BMD/SFD อย่างน้อยสองจุด');
    }
    const rows = designs.map((d) => bar(d.bar, d.asReq, d.dc, d.face));
    const maxDesignUtilization = rows.slice().sort((a, b) => b.dc - a.dc)[0];
    if (!shearCheck || !['PASS', 'FAIL'].includes(shearCheck.status)) {
      throw new TypeError('forceDesign: ' + id + '.shearCheck ไม่ครบ');
    }
    return {
      id, label, axisLabel, length, diagramKind, note,
      bmd: bmd.map((p) => ({ x: finite(p.x, id + '.bmd.x'), y: finite(p.y, id + '.bmd.y') })),
      bmdAlt: bmdAlt.map((p) => ({ x: finite(p.x, id + '.bmdAlt.x'), y: finite(p.y, id + '.bmdAlt.y') })),
      sfd: sfd.map((p) => ({ x: finite(p.x, id + '.sfd.x'), y: finite(p.y, id + '.sfd.y') })),
      moment: finite(moment, id + '.moment'),
      shear: finite(shear, id + '.shear'),
      shearCapacity: finite(shearCapacity, id + '.shearCapacity'),
      shearStatus: shearCheck.status,
      shearDc: Number.isFinite(shearCheck.dc) ? shearCheck.dc : null,
      shearIncludedInVerdict: shearCheck.includedInVerdict === true,
      shearCheckKey: shearCheck.checkKey || null,
      shearHoldReason: shearCheck.holdReason || null,
      designs: rows,
      maxDesignUtilization,
      governingSteel: rows.slice().sort((a,b)=>b.asReq-a.asReq)[0],
      rebarPass: rows.every((row) => row.dc <= 1 + 1e-9),
    };
  };

  let stem;
  if (!r.rebarDc || r.rebarDc.definition !== 'AS_REQ_OVER_AS_PROV'
      || !Array.isArray(r.rebarDc.stem) || !r.rebarDc.heel || !r.rebarDc.toe) {
    throw new TypeError('forceDesign: Engine ต้องส่ง rebarDc contract ที่ครบ');
  }
  if (r.mode === 'but') {
    if (!Array.isArray(r.strips) || !r.strips.length) {
      throw new TypeError('forceDesign: counterfort ต้องมี strips จาก Engine');
    }
    stem = member({
      id: 'stem', label: 'พนังระหว่างครีบ', axisLabel: 'ระดับแถบจากยอดพนัง', length: r.i.hp,
      bmd: r.strips.map((strip) => ({ x: strip.z, y: -strip.Mn_ })),
      bmdAlt: r.strips.map((strip) => ({ x: strip.z, y: strip.Mn$ })),
      sfd: r.strips.map((strip) => ({ x: strip.z, y: strip.Vu })),
      moment: Math.max(...r.strips.flatMap((strip) => [strip.Mn_, strip.Mn$])),
      /* คู่ Vu/φVc ต้องตรงกับ registered SHEAR — STEM ทุกหลัก ไม่จับค่า
         สูงสุดคนละ strip มารวมกันเป็น D/C ชุดใหม่ใน projection */
      shear: r.VuS,
      shearCapacity: r.phiVcS,
      shearCheck: registeredShear('SHEAR — STEM'),
      designs: r.strips.flatMap((strip, index) => [
        { face: 'z ' + strip.z1.toFixed(2) + '–' + strip.z2.toFixed(2) + ' ม. · หน้าดินที่ครีบ', asReq: strip.As_, dc: r.rebarDc.stem[index].support, bar: strip.b_ },
        { face: 'z ' + strip.z1.toFixed(2) + '–' + strip.z2.toFixed(2) + ' ม. · หน้านอกกลางช่วง', asReq: strip.As$, dc: r.rebarDc.stem[index].midspan, bar: strip.b$ },
      ]),
      diagramKind: 'engine-strip-points',
      note: 'จุด Engine ต่อแถบตามระดับ · ไม่สร้างเส้นโค้งต่อเนื่อง',
    });
  } else {
    if (!r.stemTab || !Array.isArray(r.stemTab.grid) || r.stemTab.grid.length < 2) {
      throw new TypeError('forceDesign: cantilever/gravity ต้องมี stemTab.grid จาก Engine');
    }
    const last = r.stemTab[r.stemTab.length - 1];
    stem = member({
      id: 'stem', label: 'พนัง', axisLabel: 'ความลึกจากยอดพนัง', length: r.i.hp,
      bmd: r.stemTab.grid.map((p) => ({ x: p.z, y: p.M })),
      sfd: r.stemTab.grid.map((p) => ({ x: p.z, y: p.V })),
      moment: last.Mu, shear: r.VuS, shearCapacity: r.phiVcS,
      shearCheck: registeredShear('SHEAR — STEM'),
      designs: r.stemTab.map((strip, index) => ({
        face: 'เหล็กหลักแนวตั้ง · z=' + strip.z.toFixed(2) + ' ม.', asReq: strip.As,
        dc: r.rebarDc.stem[index].main, bar: strip.bar,
      })),
      diagramKind: 'engine-grid',
      note: 'สะสมแรงดันตามความลึกจาก Engine grid',
    });
  }

  let heelSeries;
  if (r.mode === 'but') {
    const L = r.i.L;
    heelSeries = {
      bmd: [{ x: 0, y: -r.MH_ }, { x: L / 2, y: r.MH$ }, { x: L, y: -r.MH_ }],
      sfd: [{ x: 0, y: r.VuH }, { x: L / 2, y: 0 }, { x: L, y: -r.VuH }],
    };
  } else {
    heelSeries = {
      bmd: [{ x: 0, y: 0 }, { x: r.heel, y: r.MH_ }],
      sfd: [{ x: 0, y: 0 }, { x: Math.max(r.heel - r.dH, 0), y: r.VuH }],
    };
  }
  const heel = member({
    id: 'heel', label: 'ฐานหลัง Heel',
    axisLabel: r.mode === 'but' ? 'ช่วงระหว่างครีบ' : 'จากปลาย heel ถึงหน้าพนัง',
    length: r.mode === 'but' ? r.i.L : r.heel,
    ...heelSeries,
    moment: Math.max(r.MH_, r.MH$), shear: r.VuH, shearCapacity: r.phiVcH,
    shearCheck: registeredShear('SHEAR — HEEL'),
    designs: [
      { face: 'เหล็กบน', asReq: r.AsH_, dc: r.rebarDc.heel.top, bar: r.barH_ },
      { face: 'เหล็กล่าง', asReq: r.AsH$, dc: r.rebarDc.heel.bottom, bar: r.barH$ },
    ],
    diagramKind: r.mode === 'but' ? 'engine-design-points' : 'engine-critical-points',
    note: r.mode === 'but' ? 'ค่าจุดออกแบบพาดระหว่างครีบ · ไม่ลากเส้นอนุมาน' : 'ค่าจุดคุมจาก Engine · ไม่ลากเส้นอนุมาน',
  });

  const toe = member({
    id: 'toe', label: 'ฐานหน้า Toe', axisLabel: 'จากปลาย toe ถึงหน้าพนัง', length: r.i.toe,
    bmd: r.toeAnalysis.grid.map(p=>({x:p.x,y:p.M})),
    sfd: r.toeAnalysis.grid.map(p=>({x:p.x,y:p.V})),
    moment: Math.max(r.MT,r.MTtop), shear: r.VuT, shearCapacity: r.phiVcT,
    shearCheck: registeredShear('SHEAR — TOE'),
    designs: [
      { face: 'เหล็กล่าง', asReq: r.AsT, dc: r.rebarDc.toe.bottom, bar: r.barT },
      { face: 'เหล็กบน · มาร์ค ⑧', asReq: r.AsTtop, dc: r.rebarDc.toe.top, bar: r.barFT },
    ],
    diagramKind: 'engine-grid',
    note: 'สมดุลแรงดันใต้ฐาน/แรงเข็มจริง · ตรวจเฉือนห่างหน้าพนัง d · รวมในผลหลัก',
  });

  return deepFreeze({
    source: 'engine.result',
    method: 'AUTO_REBAR_FROM_ENGINE',
    dcDefinition: 'REBAR_AS_REQ_OVER_AS_PROV_AND_REGISTERED_SHEAR_U',
    diagramPolicy: 'ENGINE_GRID_OR_ENGINE_POINTS_NO_INTERPOLATION',
    engineeringCoverage: {
      status: RW_ENGINEERING_COVERAGE.status,
      excludedChecks: [...RW_ENGINEERING_COVERAGE.excludedChecks],
    },
    loads: {
      lateral: finite(r.Ph, 'loads.lateral'),
      water: finite(r.Pw, 'loads.water'),
      surcharge: finite(r.i.q, 'loads.surcharge'),
      bearingToe: finite(r.q1, 'loads.bearingToe'),
      bearingHeel: finite(r.q2, 'loads.bearingHeel'),
    },
    members: [stem, heel, toe],
  });
}

/**
 * ด่านความพร้อมจัดวางเหล็กครีบที่อ่านค่าจาก engine ตรง ๆ เท่านั้น
 *
 * engine เป็นเจ้าของการเลือกเหล็กและค่าช่องว่างขั้นต่ำ ชั้น Snapshot ไม่เลือกเหล็กใหม่
 * หรือเปลี่ยน PASS/FAIL แต่ต้องตรวจ geometry ของชุดเหล็กที่ engine เลือกด้วยค่าจริง
 * ก่อนการปัดเศษ มิฉะนั้นช่องว่าง 26.67 มม. อาจถูกปัดเป็น 27 มม. แล้วอ้าง READY
 * ทั้งที่ยังต่ำกว่าค่าขั้นต่ำ 27 มม.
 */
function counterfortPackingError(r, input) {
  if (!r || r.mode !== 'but') return null;
  const b = r.but;
  if (!b || typeof b.barTxt !== 'string' || !b.barTxt.trim()
      || !Number.isFinite(b.clrMin) || !Number.isFinite(b.clrUse)
      || !Number.isFinite(b.barSize) || b.barSize <= 0
      || !Number.isFinite(b.covB) || b.covB < 0
      || !Number.isInteger(b.nB25) || b.nB25 < 2
      || typeof b.twoLayer !== 'boolean'
      || !Number.isInteger(b.nLayer) || !Number.isInteger(b.nPerLayer) || b.nPerLayer < 1
      || b.nLayer !== (b.twoLayer ? 2 : 1)
      || b.nPerLayer !== (b.twoLayer ? Math.ceil(b.nB25 / 2) : b.nB25)
      || !input || !Number.isFinite(input.bs) || input.bs <= 0) {
    return 'ผล counterfort ขาดข้อมูลช่องว่างเหล็ก authoritative จาก engine';
  }

  /* Integrity check only: reconstruct exact clear spacing for the selected bars;
     do not select bars, change effective depth, or derive a design verdict here. */
  const availableWidth = input.bs * 1000 - 2 * b.covB - b.barSize;
  const exactClearance = (b.nPerLayer > 1
    ? availableWidth / (b.nPerLayer - 1)
    : availableWidth) - b.barSize;
  if (!Number.isFinite(exactClearance) || Math.round(exactClearance) !== b.clrUse) {
    return 'ผล counterfort มีข้อมูลช่องว่างเหล็กไม่สอดคล้องกับ geometry จาก engine';
  }
  if (exactClearance + 1e-9 < b.clrMin) {
    return 'เหล็กหลักครีบ ' + b.barTxt + ' จัดวางไม่ได้: ช่องว่างใช้งาน '
      + exactClearance.toFixed(2) + ' มม. < ขั้นต่ำ ' + b.clrMin
      + ' มม. — ระงับผลและเอกสารจนกว่า Owner/PE จะทบทวนการเลือกเหล็กและ effective depth';
  }
  return null;
}

/** Validate the selected-bar fixed point; preferred i.db is not a depth. */
export function selectedDiameterDepthError(r) {
  if(!r?.i)return 'ผล Engine ขาด input สำหรับตรวจ effective depth';
  const checks=[];
  for(const [n,s] of (r.stemTab||[]).entries())
    checks.push(['stem '+n,s.d,s.th,r.i.cov/1000,s.bar,.02]);
  for(const [n,s] of (r.strips||[]).entries()){
    checks.push(['strip top '+n,s.d_,s.th,r.i.cov/1000,s.b_,.02]);
    checks.push(['strip bottom '+n,s.d$,s.th,r.i.cov/1000,s.b$,.02]);
  }
  checks.push(['heel top',r.dH,r.i.hz,.075,r.barH_,0],
    ['heel bottom',r.dHbottom,r.i.hz,.075,r.barH$,0],
    ['toe bottom',r.dT,r.i.hz,.075,r.barT,0],
    ['toe top',r.dTtop,r.i.hz,.075+r.toeTopLayer,r.barFT,0]);
  for(const [name,d,h,c,bar,min] of checks){
    if(!Number.isFinite(d)||!Number.isFinite(bar?.db)||bar.db<=0
      ||Math.abs(d-Math.max(h-c-bar.db/2000,min))>1e-9)
      return 'effective depth ไม่ตรงกับเหล็กที่เลือกจริง: '+name+' — ต้องคำนวณใหม่';
  }
  return null;
}

/** เรียก API ที่พึ่ง module-global units แบบ synchronous แล้วคืน engine สู่ SI เสมอ */
function withEngineUnits(mode, operation) {
  setEngineUnits(mode);
  try {
    return operation();
  } finally {
    /* SI เป็น resting state ของ engine; ป้องกันคำสั่งถัดไปติดภาษาจาก projection ก่อนหน้า */
    setEngineUnits('si');
  }
}

/** MKS เป็นเพียงข้อความ/หน่วยแสดงผล ห้ามเปลี่ยนลำดับ ชื่อ คำตัดสิน หรือ utilization */
function assertCheckProjectionParity(siChecks, displayChecks) {
  if (siChecks.length !== displayChecks.length) {
    throw new Error('CHECK_PROJECTION_MISMATCH: จำนวนรายการตรวจ SI/MKS ไม่เท่ากัน');
  }
  for (let i = 0; i < siChecks.length; i++) {
    const si = siChecks[i];
    const display = displayChecks[i];
    const sameU = Object.is(si.u, display.u)
      || (Number.isFinite(si.u) && Number.isFinite(display.u) && Math.abs(si.u - display.u) <= 1e-12);
    if (si.k !== display.k || si.ok !== display.ok || !sameU) {
      throw new Error('CHECK_PROJECTION_MISMATCH: k/ok/u ต่างกันที่รายการ ' + (i + 1));
    }
  }
}

/**
 * ตรวจและทำให้ input เป็นมาตรฐาน — ต้องปิดประตูก่อนคำนวณเสมอ
 * @returns {{value: object|null, errors: Array<{key: string, message: string}>}}
 */
export function normalizeInput(raw, profileId) {
  const errors = [];
  let src = raw && typeof raw === 'object' ? raw : {};
  try { src = normalizeSurchargeInput(src); }
  catch (error) { errors.push({key:'q',message:error.message}); }
  const out = { ...RW_DEFAULT_INPUT };
  out.qD=src.qD; out.qL=src.qL;

  if (!DESIGN_PROFILES[profileId]) {
    errors.push({ key: 'profile', message: 'ต้องเลือกโปรไฟล์มาตรฐานออกแบบที่ระบบรันได้จริง' });
  }

  /* หน่วยแสดงผล — ค่าใน out เป็น SI เสมอ (สะพานแปลงก่อนส่งมา)
     units คุมเฉพาะภาษาป้ายของ engine (ตัน/kN) — ห้ามใช้ตีความค่าตัวเลข */
  const units = src.units === 'mks' ? 'mks' : (src.units === 'si' || src.units === undefined) ? 'si' : null;
  if (units === null) {
    errors.push({ key: 'units', message: 'ระบบหน่วยต้องเป็น si หรือ mks — ได้ "' + src.units + '"' });
  } else out.units = units;

  const wtype = src.wtype || RW_DEFAULT_INPUT.wtype;
  if (!SUPPORTED_WALL_TYPES.includes(wtype)) {
    errors.push({
      key: 'wtype',
      message: 'รุ่นนี้รองรับกำแพงยื่น (cantilever) · กำแพงมวล (gravity) · กำแพงมีครีบ (counterfort) — ชนิด "'
        + wtype + '" ยังไม่รองรับ เพราะชั้นเขียนแบบยังวาดรูปของชนิดนี้ไม่ถูก',
    });
  }
  out.wtype = wtype;

  /* ★ กำแพงมวลใช้ทฤษฎี Coulomb ซึ่งมีมุมเสียดทานผนัง δ เป็นตัวแปรจริง
     adapter ส่งค่าดิบมาที่นี่ ห้าม clamp/แทนค่าเสียเงียบๆ */
  if (wtype === 'gravity') {
    const rawWallDelta = src.wallDelta;
    if (rawWallDelta === '' || rawWallDelta === null || rawWallDelta === undefined) {
      out.wallDelta = 15;
    } else {
      const wd = typeof rawWallDelta === 'number' ? rawWallDelta : Number(String(rawWallDelta).trim());
      if (!Number.isFinite(wd)) {
        errors.push({ key: 'wallDelta', message: 'มุมเสียดทานผนัง δ ต้องเป็นตัวเลข' });
      } else if (wd < 0 || wd > 45) {
        errors.push({ key: 'wallDelta', message: 'มุมเสียดทานผนัง δ ต้องอยู่ระหว่าง 0 ถึง 45 องศา' });
      } else out.wallDelta = wd;
    }
  } else {
    out.wallDelta = 0;
  }

  /* ★ พารามิเตอร์ครีบ — มีผลเฉพาะชนิด but · L=ช่วงว่างระหว่างครีบ bs=หนาครีบ
     โมเมนต์พนัง ∝ L² — ปล่อยผ่านโดยไม่ตรวจขอบไม่ได้ */
  if (wtype === 'but') {
    const cf = [
      ['L', 'ช่วงว่างระหว่างครีบ', 0.5, 8, true],
      ['bs', 'ความหนาครีบ', 0.15, 1.0, true],
      ['cfL', 'ความลึกครีบ (0 = เต็ม heel)', 0, 8, false],
      ['cfH', 'ความสูงครีบ (0 = เต็มพนัง)', 0, 12, false],
    ];
    for (const [key, th, mn, mx, reqd] of cf) {
      const v = src[key];
      if (v === '' || v === null || v === undefined) {
        if (reqd) errors.push({ key, message: 'ต้องกรอก ' + th });
        continue;
      }
      const n = typeof v === 'number' ? v : Number(String(v).trim());
      if (!Number.isFinite(n)) { errors.push({ key, message: th + ' ต้องเป็นตัวเลข' }); continue; }
      if (n < mn || n > mx) { errors.push({ key, message: th + ' ต้องอยู่ระหว่าง ' + mn + ' ถึง ' + mx + ' ม.' }); continue; }
      out[key] = n;
    }
  }

  for (const f of RW_FIELDS) {
    const v = src[f.key];
    if (v === '' || v === null || v === undefined) {
      if (f.required) errors.push({ key: f.key, message: 'ต้องกรอก ' + f.th });
      continue;
    }
    const n = typeof v === 'number' ? v : Number(String(v).trim());
    if (!Number.isFinite(n)) {
      errors.push({ key: f.key, message: f.th + ' ต้องเป็นตัวเลข' });
      continue;
    }
    if (n < f.min || n > f.max) {
      errors.push({
        key: f.key,
        message: f.th + ' ต้องอยู่ระหว่าง ' + f.min + ' ถึง ' + f.max + (f.unit ? ' ' + f.unit : ''),
      });
      continue;
    }
    out[f.key] = n;
  }

  /* ★ ระดับน้ำใช้ค่าตัวแทนเมื่อ "ไม่มีน้ำ" — ห้ามให้ผู้ใช้เห็นเลข 99 ดิบ ๆ
     ผู้ใช้ติ๊กว่ามีน้ำใต้ดินหรือไม่ แล้วชั้นนี้แปลงให้ */
  if (src.hasWater) {
    const zw = Number(src.zw);
    if (!Number.isFinite(zw)) {
      errors.push({ key: 'zw', message: 'ต้องกรอกระดับน้ำใต้ดินเป็นตัวเลข' });
    } else if (zw < 0) {
      /* zw ติดลบ = ผู้ใช้กรอกน้ำสูงกว่าหลังกำแพง — บอกเหตุจริง ไม่ใช่บ่นเรื่องเครื่องหมาย */
      errors.push({ key: 'zw', message: 'ระดับน้ำสูงกว่าหลังกำแพง — ต้องไม่เกินความสูงพนัง' });
    } else out.zw = zw;
  } else {
    out.zw = 99;
  }

  /* ความสัมพันธ์ระหว่างช่อง — B เป็น input จริง ห้ามเขียนทับด้วยผลรวมเงียบ ๆ
     มิฉะนั้นแก้ B แล้ว draft fingerprint ไม่ stale และผู้ใช้เห็นค่าคนละตัวกับ engine */
  if (Number.isFinite(out.toe) && Number.isFinite(out.heel) && Number.isFinite(out.t)
      && !errors.some((e) => ['B', 'toe', 'heel', 't'].includes(e.key))) {
    const componentB = out.toe + out.t + out.heel;
    if (Math.abs(out.B - componentB) > 1e-6) {
      errors.push({
        key: 'B',
        message: 'ความกว้างฐาน B ต้องเท่ากับ toe + ความหนาพนัง + heel ('
          + componentB.toFixed(3) + ' ม.) — ได้ ' + out.B + ' ม.',
      });
    }
  }
  /* engine บังคับ heel <= 0.05 เป็น 0.05 เงียบ ๆ เพื่อกัน geometry พัง
     ด่านกลางต้องปฏิเสธก่อน เพื่อให้ค่าที่ผู้ใช้กรอก = ค่าที่ engine ใช้จริง */
  if (Number.isFinite(out.heel) && out.heel <= 0.05) {
    errors.push({ key: 'heel', message: 'ความยาวส่วนยื่นหลัง (heel) ต้องมากกว่า 0.05 ม. เพื่อไม่ให้ engine ปรับค่าเงียบ ๆ' });
  }
  if (Number.isFinite(out.ttop) && Number.isFinite(out.t) && out.ttop > out.t + 1e-9) {
    errors.push({ key: 'ttop', message: 'ความหนาพนังที่ยอดต้องไม่มากกว่าที่โคน' });
  }
  /* ★ engine จะ clamp cfL>heel / cfH>hp เงียบ ๆ — ด่านนี้ปฏิเสธดัง ๆ แทน
     เพราะค่าที่ผู้ใช้เห็นกับค่าที่คำนวณต้องเป็นตัวเดียวกันเสมอ */
  if (out.wtype === 'but') {
    if (Number.isFinite(out.cfL) && out.cfL > 0 && Number.isFinite(out.heel) && out.cfL > out.heel + 1e-6) {
      errors.push({ key: 'cfL', message: 'ความลึกครีบต้องไม่เกิน heel (' + out.heel + ' ม.)' });
    }
    if (Number.isFinite(out.cfH) && out.cfH > 0 && Number.isFinite(out.hp) && out.cfH > out.hp + 1e-6) {
      errors.push({ key: 'cfH', message: 'ความสูงครีบต้องไม่เกินความสูงพนัง (' + out.hp + ' ม.)' });
    }
    if (Number.isFinite(out.L) && Number.isFinite(out.Lw) && out.L + out.bs >= out.Lw) {
      errors.push({ key: 'L', message: 'ช่วงครีบ L+bs ต้องน้อยกว่าความยาวกำแพง Lw — มิฉะนั้นมีครีบไม่ถึง 2 ตัว' });
    }
  }

  if (Number.isFinite(out.beta) && Number.isFinite(out.phi) && out.beta >= out.phi) {
    errors.push({
      key: 'beta',
      message: 'ความชันหลังกำแพงต้องน้อยกว่ามุมเสียดทานภายใน (β < φ) มิฉะนั้นทฤษฎีแรงดันดินใช้ไม่ได้',
    });
  }

  /* ข้อมูลประกอบ projection หน้าจอผ่านด่านเดียวกับ input อื่น ๆ แต่ไม่ถูกใช้โดย engine
     เพื่อให้ snapshot.presentation สร้างครั้งเดียวและ renderer ไม่ต้องอ่านฟอร์มหรือคิดซ้ำ */
  const psrc = src.presentationInput;
  if (psrc !== undefined && (psrc === null || typeof psrc !== 'object' || Array.isArray(psrc))) {
    errors.push({ key: 'presentationInput', message: 'ข้อมูลประกอบการแสดงผลต้องเป็นอ็อบเจกต์' });
  }
  const p = psrc && typeof psrc === 'object' && !Array.isArray(psrc) ? psrc : {};
  const derivedDelta = Number.isFinite(out.mu) ? Math.atan(out.mu) * 180 / Math.PI : NaN;
  const deltaValue = p.delta === undefined ? derivedDelta : Number(p.delta);
  const passiveValue = p.passiveFactor === undefined ? 0 : Number(p.passiveFactor);
  const waterEnabled = p.waterEnabled === undefined ? !!src.hasWater : p.waterEnabled;
  const derivedWaterHeight = waterEnabled && Number.isFinite(out.hp) && Number.isFinite(out.zw) && out.zw < 90
    ? out.hp - out.zw
    : 0;
  const waterHeightValue = p.waterHeight === undefined ? derivedWaterHeight : Number(p.waterHeight);
  const includeSurchargeWeight = p.includeSurchargeWeight === undefined ? false : p.includeSurchargeWeight;
  if (!Number.isFinite(deltaValue)) {
    errors.push({ key: 'presentationInput.delta', message: 'มุมเสียดทานใต้ฐานสำหรับการแสดงผลต้องเป็นตัวเลข' });
  } else if (deltaValue < 0 || deltaValue > 45) {
    errors.push({ key: 'presentationInput.delta', message: 'มุมเสียดทานใต้ฐานสำหรับการแสดงผลต้องอยู่ระหว่าง 0 ถึง 45 องศา' });
  }
  if (!Number.isFinite(passiveValue)) {
    errors.push({ key: 'presentationInput.passiveFactor', message: 'ค่า passive สำหรับการแสดงผลต้องเป็นตัวเลข' });
  } else if (passiveValue < 0 || passiveValue > 1) {
    errors.push({ key: 'presentationInput.passiveFactor', message: 'ค่า passive สำหรับการแสดงผลต้องอยู่ระหว่าง 0 ถึง 1' });
  }
  if (typeof waterEnabled !== 'boolean') {
    errors.push({ key: 'presentationInput.waterEnabled', message: 'สถานะน้ำใต้ดินสำหรับการแสดงผลต้องเป็น boolean' });
  }
  if (!Number.isFinite(waterHeightValue)) {
    errors.push({ key: 'presentationInput.waterHeight', message: 'ความสูงน้ำสำหรับภาพประกอบต้องเป็นตัวเลข' });
  } else if (waterHeightValue < 0 || (Number.isFinite(out.hp) && waterHeightValue > out.hp + 1e-6)) {
    errors.push({ key: 'presentationInput.waterHeight', message: 'ความสูงน้ำสำหรับภาพประกอบต้องอยู่ระหว่าง 0 ถึงความสูงพนัง' });
  } else if (Number.isFinite(derivedWaterHeight) && Math.abs(waterHeightValue - derivedWaterHeight) > 1e-6) {
    errors.push({ key: 'presentationInput.waterHeight', message: 'ความสูงน้ำสำหรับภาพประกอบไม่ตรงกับระดับน้ำ canonical' });
  }
  if (typeof includeSurchargeWeight !== 'boolean') {
    errors.push({ key: 'presentationInput.includeSurchargeWeight', message: 'สถานะน้ำหนักจรบน heel ต้องเป็น boolean' });
  }
  out.presentationInput = {
    delta: deltaValue,
    waterEnabled: typeof waterEnabled === 'boolean' ? waterEnabled : false,
    /* geometry-only projection ผ่าน normalizeInput และตรวจ parity กับ zw แล้ว */
    waterHeight: Number.isFinite(waterHeightValue) ? waterHeightValue : 0,
    /* Owner/PE ยังไม่อนุมัติ passive resistance: เก็บค่าดิบไว้เฉพาะ fingerprint
       แต่ normalized Snapshot และทุก projection ต้องแสดง 0 ตรงกับ engine authority */
    passiveFactor: 0,
    includeSurchargeWeight: typeof includeSurchargeWeight === 'boolean' ? includeSurchargeWeight : false,
  };

  return { value: errors.length ? null : out, errors };
}

/**
 * สร้าง Snapshot หนึ่งชุด — ทางเดียวที่การ์ดนี้ได้ผลคำนวณ
 *
 * @param {object} rawInput  ค่าจากฟอร์ม
 * @param {string} profileId คีย์ใน DESIGN_PROFILES
 * @param {object} [meta]    ข้อมูลโครงการ — ช่องที่ระบุตัวบุคคลต้องปล่อยว่าง
 * @returns {object} Snapshot ที่แช่แข็งแล้ว (ok = true) หรือผลปฏิเสธ (ok = false)
 */
export function createRetainingWallSnapshot(rawInput, profileId = 'thai2566', meta = {}) {
  const { value, errors } = normalizeInput(rawInput, profileId);
  const fingerprint = fingerprintOf({ input: rawInput, profileId, v: RETAINING_WALL_ENGINE_VERSION });

  if (!value) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors,
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  let r;
  try {
    /* ผล canonical (รวม warnings) สร้างใน SI เสมอ ไม่ขึ้นกับหน่วยหน้าจอ
       และต้องตัด reference จาก memo/cache ภายใน engine ก่อน deepFreeze เสมอ
       มิฉะนั้น Snapshot รอบแรกจะ freeze object ที่ engine ต้องแก้ในรอบถัดไป */
    r = clonePlain(withEngineUnits('si', () => designRetainingWall(value, { profile: profileId })));
  } catch (err) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'engine', message: 'คำนวณไม่สำเร็จ — ' + err.message }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  const packingError = counterfortPackingError(r, value);
  if (packingError) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'counterfortRebarPacking', message: packingError }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  const depthError = selectedDiameterDepthError(r);
  if (depthError) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'analysisDepthRebarMismatch', message: depthError }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  const profile = DESIGN_PROFILES[profileId];
  const checks = withEngineUnits('si', () => checksFor(r));
  const spec = constructionSpec(r);
  let quantityProjection;
  let forceDesign;
  try {
    quantityProjection = buildRetainingWallQuantityProjection(r.qty);
    forceDesign = buildRetainingWallForceDesignProjection(r, checks);
  } catch (err) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'resultProjection', message: 'สร้างชุดปริมาณ/แรงภายในไม่สำเร็จ — ' + err.message }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }
  const failed = checks.filter((c) => !c.ok);
  let recovery;
  try {
    recovery = buildRetainingWallRecoveryProjection({
      input: value,
      checks,
      evaluate: (candidate) => {
        const candidateResult = clonePlain(withEngineUnits('si', () =>
          designRetainingWall(candidate, { profile: profileId })));
        const projectionError = counterfortPackingError(candidateResult, candidate)
          || selectedDiameterDepthError(candidateResult);
        return {
          ok: !projectionError,
          error: projectionError,
          checks: withEngineUnits('si', () => checksFor(candidateResult)),
        };
      },
    });
  } catch (err) {
    /* คำแนะนำเป็น advisory projection — ถ้าสร้างไม่ได้ต้องปิดเฉพาะคำแนะนำ
       ห้ามทำให้ผล Engine/แบบ/รายงานที่ตรวจได้อยู่แล้วหายไปทั้งชุด */
    recovery = {
      source: 'engine.trial',
      version: 'rw-recovery-unavailable',
      acceptance: 'TARGET_PASS_AND_NO_BASELINE_REGRESSION',
      authority: 'ADVISORY_APPLY_THEN_RECALCULATE',
      baselineFailureCount: failed.length,
      evaluationsUsed: 0,
      evaluationLimit: 1,
      searchTruncated: false,
      status: 'UNAVAILABLE',
      error: err instanceof Error ? err.message : String(err),
      items: failed.map((row) => ({
        checkKey: row.k, status: 'UNAVAILABLE', candidates: [], testedBounds: [],
        searchTruncated: false,
        reason: 'ไม่สามารถรันชุดทดลอง Engine สำหรับคำแนะนำได้',
      })),
    };
  }
  const id = 'RW-' + fingerprint.slice(0, 6).toUpperCase();
  const equationLedger=buildEquationLedger({
    type:({cant:'cantilever',but:'counterfort',gravity:'gravity'})[value.wtype],
    profile:profileId,input:value,checks,identity:id,
  });
  const verdict = {
    pass: failed.length === 0,
    failedCount: failed.length,
    failed: failed.map((c) => ({ k: c.k, v: c.v, req: c.req, u: c.u })),
    /* ★ ผลไม่ผ่าน = ห้ามบอกผ่าน และห้ามปล่อยเอกสารก่อสร้าง */
    statement: failed.length
      ? 'ไม่ผ่าน ' + failed.length + ' รายการ — ห้ามใช้แบบและรายการคำนวณชุดนี้ในการก่อสร้าง'
      : 'ผ่านรายการตรวจคำนวณ · รวมแรงเฉือน STEM / HEEL / TOE · NOT FOR CONSTRUCTION',
  };
  const authority = RW_AUTHORITY_BY_MODE[value.wtype];
  if (!authority) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'authority', message: 'ไม่พบทะเบียนอำนาจเอกสารสำหรับโหมด "' + value.wtype + '"' }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  /* รูปทั้งชุดสร้างจากผลชุดเดียวกัน — นี่คือสิ่งที่ทำให้จอ รายงาน และแบบตรงกันโดยโครงสร้าง */
  const views = [
    { drawing: retainingWallSection(r), scale: SHEET_SCALE['RW-01'] },
    { drawing: retainingWallPlan(r, spec), scale: SHEET_SCALE['RW-02'] },
    { drawing: retainingWallCheckSummary(r, checks, { code: profile.short, verdict, authority }), scale: 1 },
    /* มาตราส่วนเอาจากตัวรูป — กำแพงมีครีบใช้ 1:25 ต่างจากกำแพงยื่น (1:20) */
    (() => { const d = retainingWallRebarDetail(r); return { drawing: d, scale: d.meta.scale || SHEET_SCALE['RW-03'] }; })(),
    { drawing: retainingWallBarSchedule(r, { quantityProjection, authority }), scale: 1 },
    /* เฉพาะกำแพงมีครีบ: แผ่นผังพนังระหว่างครีบ — ต่อท้าย array เพื่อไม่เลื่อน index ของ views เดิม */
    ...(r.mode === 'but' ? [{ drawing: retainingWallButWallDetail(r), scale: SHEET_SCALE['RW-06'] }] : []),
  ];

  const cov = coverTable(r.i).map((c) => c.th + ' ' + c.mm).join(' · ');
  const notes = [
    authority.reason,
    verdict.statement,
    RW_REBAR_GEOMETRY_HOLD.reason,
    'หน่วยระยะทั้งหมดเป็นมิลลิเมตร ยกเว้นที่ระบุไว้เป็นอย่างอื่น',
    'ห้ามวัดระยะจากแบบ ให้ใช้ตัวเลขที่เขียนกำกับเท่านั้น',
    'คอนกรีตกำลังอัดประลัย f′c = ' + r.i.fc + ' MPa · เหล็กเสริม f_y = ' + r.i.fy + ' MPa',
    'ระยะหุ้มคอนกรีต — ' + cov + ' มม.',
    'ทาบเหล็กตาม Class B · ของอปลายตามตารางเหล็ก · ห้ามทาบเกินครึ่งหนึ่งของเหล็กที่หน้าตัดวิกฤตเดียวกัน',
    'ดินถมหลังกำแพงต้องเป็นวัสดุระบายน้ำได้ บดอัดเป็นชั้น และติดตั้งระบบระบายน้ำก่อนถมชั้นถัดไป',
    'กำลังรับน้ำหนักของดินฐานรากต้องยืนยันด้วยรายงานเจาะสำรวจก่อนก่อสร้าง',
    'แบบนี้ยังไม่ผ่านการรับรองเพื่อการก่อสร้าง ต้องให้วิศวกรผู้รับผิดชอบตรวจสอบและลงนามก่อนใช้งาน',
  ];

  const baseDrawingTitle = meta.title || 'กำแพงกันดิน คสล.';
  const info = {
    project: meta.project || '',
    title: r.mode === 'but'
      ? 'BETA · ' + baseDrawingTitle + ' · CALCULATION REPORT · ENGINE CHECKS'
      : 'BETA · ' + baseDrawingTitle + ' · ENGINE CHECKS',
    coverageHold: RW_ENGINEERING_COVERAGE.label,
    verdict: clonePlain(verdict),
    rebarGeometryHold: RW_REBAR_GEOMETRY_HOLD.label,
    drawingNo: meta.drawingNo || '',
    scales: scaleSummary(views),
    date: meta.date || '',
    /* ★ ช่องที่ระบุตัวผู้รับผิดชอบต้องว่างเสมอ ระบบไม่มีสิทธิ์ลงชื่อแทนวิศวกร */
    designer: '', checker: '', approver: '', licence: '',
    rev: meta.rev || '0',
    sheetNo: '',
  };

  let sheets = null;
  let sheetError = null;
  try {
    sheets = composeSheetSet(views, { size: meta.sheetSize || 'A3', info, notes });
  } catch (err) {
    sheetError = err.message;
    /* Snapshot หนึ่งชุดต้องออกผลบนทุก surface ได้ครบ ถ้าจัด A3 ไม่ลงห้ามประกาศ READY
       แม้ engine จะคำนวณสำเร็จ เพราะ UI/report/drawing จะไม่ใช่ bundle เดียวกันอีกต่อไป */
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'drawingPack', message: 'สร้างชุดแบบ A3 ไม่สำเร็จ — ' + sheetError }],
      sheetError,
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  const evidence = [
    profile.ev.loadSrc + ' — ' + profile.ev.loadClause,
    profile.ev.phiClause,
    profile.ev.memberSrc + ' — ' + profile.ev.memberClause,
    profile.ev.stabClause,
    ...profile.ev.eq,
  ];

  let report = null;
  let reportError = null;
  try {
    report = retainingWallReport(r, checks, {
      spec, verdict, authority, engineeringCoverage: RW_ENGINEERING_COVERAGE,
      rebarGeometryHold: RW_REBAR_GEOMETRY_HOLD,
      quantityProjection, forceDesign, recovery, equationLedger, code: profile.short, evidence, layout:'essential',
      info: {
        title: r.mode === 'but'
          ? 'BETA · CALCULATION REPORT · ENGINE CHECKS · NOT FOR CONSTRUCTION · รายการคำนวณกำแพงกันดิน'
          : 'BETA · ENGINE CHECKS · NOT FOR CONSTRUCTION · รายการคำนวณกำแพงกันดิน คสล.',
        project: info.project,
      },
    });
    if (!Array.isArray(report) || !report.length
        || report.some((page) => !page || !page.meta
          || page.meta.calculationAuthority !== 'ENGINE_RESULT_PROJECTION_ONLY'
          || page.meta.rendererRecomputed !== false
          || !Array.isArray(page.meta.mismatch) || page.meta.mismatch.length !== 0)) {
      throw new TypeError('รายงาน A4 ไม่ยืนยันว่าเป็น Engine-result projection โดยไม่คำนวณซ้ำ');
    }
  } catch (err) {
    reportError = err instanceof Error ? err.message : String(err);
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'reportPack', message: 'สร้างรายการคำนวณ A4 ไม่สำเร็จ — ' + reportError }],
      reportError,
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  const warnings = Array.isArray(r.warn) ? r.warn : [];
  let presentationChecks;
  let presentation;
  try {
    presentationChecks = value.units === 'mks'
      ? withEngineUnits('mks', () => checksFor(r))
      : checks;
    assertCheckProjectionParity(checks, presentationChecks);
    presentation = buildRetainingWallPresentation({
      input: value,
      result: r,
      checks: presentationChecks,
      verdict,
      warnings,
      snapshotId: id,
      profileShort: profile.short,
      authority,
      engineeringCoverage: RW_ENGINEERING_COVERAGE,
      forceDesign, recovery,
    });
  } catch (err) {
    return deepFreeze({
      ok: false,
      state: 'ERROR',
      id: null,
      fingerprint,
      errors: [{ key: 'presentation', message: 'สร้างชุดแสดงผลไม่สำเร็จ — ' + err.message }],
      engineVersion: RETAINING_WALL_ENGINE_VERSION,
    });
  }

  return deepFreeze({
    ok: true,
    state: 'READY',
    id,
    fingerprint,
    engineVersion: RETAINING_WALL_ENGINE_VERSION,
    createdAtNote: 'เวลาสร้างให้ชั้นบนเป็นผู้บันทึก — Snapshot ต้องคำนวณซ้ำได้ผลเดิมเสมอ',

    input: value,
    designBasis: {
      profileId,
      profileName: profile.name,
      profileShort: profile.short,
      method: profile.method,
      factors: { gD: profile.gD, gL: profile.gL, gH: profile.gH, phib: profile.phib, phiv: profile.phiv },
      evidence,
      /* imported engine constants must never be frozen through a Snapshot reference */
      required: clonePlain(FS_REQUIRED),
    },

    equationLedger,

    result: r,
    checks,
    construct: spec,
    quantityProjection,
    forceDesign,
    recovery,
    verdict,
    authority,
    engineeringCoverage: RW_ENGINEERING_COVERAGE,
    rebarGeometryHold: RW_REBAR_GEOMETRY_HOLD,
    warnings,
    presentation,

    views,
    sheets,
    sheetError,
    report,
    reportError,
    notes,
    info,
  });
}

/* ── ตัวเลือกสำหรับ Flow 01–08 ────────────────────────────────────
   ทุกตัวอ่านจาก Snapshot อย่างเดียว ห้ามคำนวณอะไรใหม่ */

const need = (snap) => {
  if (!snap || !snap.ok) throw new TypeError('selector: ต้องมี Snapshot ที่คำนวณสำเร็จก่อน');
  return snap;
};

/** Flow 01 — ภาพรวม */
export const flowOverview = (snap) => {
  const s = need(snap);
  const r = s.result;
  return {
    geometry: { H: r.H, B: r.i.B, t: r.i.t, hz: r.i.hz, toe: r.i.toe, heel: r.heel, Lw: r.i.Lw },
    governing: s.checks.slice().sort((a, b) => (b.u || 0) - (a.u || 0))[0] || null,
    ratios: s.checks.map((c) => ({ k: c.k, u: c.u, ok: c.ok })),
    verdict: s.verdict,
    section: s.views[0].drawing,
  };
};

/** Flow 02 — ตรวจ D/C */
export const flowChecks = (snap) => need(snap).checks;

/** Flow 03 — วิเคราะห์ (แรงดันดินและเสถียรภาพ) */
export const flowAnalysis = (snap) => {
  const r = need(snap).result;
  return {
    method: r.earthMethod, Ka: r.Ka, Kp: r.Kp,
    Ph: r.Ph, Pv: r.Pv, Phs: r.Phs, Pw: r.Pw, ybar: r.ybar, Mo: r.Mo,
    weights: r.W, SVs: r.SVs, SMs: r.SMs,
    FSot: r.FSot, FSsl: r.FSsl, xbar: r.xbar, e: r.e, kern: r.kern,
    q1: r.q1, q2: r.q2, qaUse: r.qaUse,
    slideFric: r.slideFric, slideAdh: r.slideAdh, PpAll: r.PpAll,
    gslip: r.gslip,
  };
};

/** Flow 04 — รูปตัดและเหล็ก */
export const flowSection = (snap) => {
  const s = need(snap);
  return {
    section: s.views[0].drawing,
    detail: s.views[3].drawing,
    schedule: s.views[4].drawing,
    stem: s.result.stemTab,
    strips: Array.isArray(s.result.strips) ? s.result.strips : null,
    footing: {
      heelTop: { M: s.result.MH_, As: s.result.AsH_, bar: s.result.barH_ },
      heelBottom: { M: s.result.MH$, As: s.result.AsH$, bar: s.result.barH$ },
      toeBottom: { M: s.result.MT, As: s.result.AsT, bar: s.result.barT },
    },
    bbs: s.result.qty.bbs,
    forceDesign: s.forceDesign,
  };
};

/** Flow 05 — 3D เป็น projection เพื่อสื่อสารรูปทรง ไม่ใช่แบบก่อสร้างหรือผลคำนวณชุดใหม่ */
export const flowModel3d = (snap) => {
  const s = need(snap);
  return {
    available: true,
    authority: 'PRESENTATION_ONLY',
    snapshotAuthority: s.authority,
    constructionAuthority: s.authority.constructionAuthority,
    snapshotId: s.id,
    reason: 'แบบจำลองสามมิติอ่านจาก Snapshot เพื่อสื่อสารรูปทรงเท่านั้น — ห้ามใช้แทนแบบก่อสร้าง',
  };
};

/** Flow 06 — รายงาน A4 */
export const flowReport = (snap) => need(snap).report;

/** Flow 07 — รายการคำนวณเต็ม (หน้าเดียวกับ A4 แต่เน้นสมการและการแทนค่า) */
export const flowCalculationBook = (snap) => {
  const s = need(snap);
  return {
    pages: s.report,
    evidence: s.designBasis.evidence,
    mismatch: s.report[0] ? s.report[0].meta.mismatch : [],
    authority: s.authority,
  };
};

/** Flow 08 — ชุดแบบ */
export const flowDrawingPack = (snap) => {
  const s = need(snap);
  return {
    sheets: s.sheets,
    error: s.sheetError,
    views: s.views,
    notes: s.notes,
    info: s.info,
    authority: s.authority,
    quantityProjection: s.quantityProjection,
  };
};

/** โปรไฟล์ที่ผู้ใช้เลือกได้ — มีเฉพาะโปรไฟล์ที่ engine รันได้จริง */
export const availableProfiles = () => Object.entries(DESIGN_PROFILES)
  .map(([id, p]) => ({ id, name: p.name, short: p.short, method: p.method }));
