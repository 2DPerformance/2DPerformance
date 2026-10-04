/**
 * รายการคำนวณกำแพงกันดิน — หน้า A4 สำหรับพิมพ์
 *
 * ทำไมใช้ primitive ชุดเดียวกับงานเขียนแบบ:
 * รายงานกับแบบต้องออกมาจากผลคำนวณชุดเดียวกันและผ่าน renderer ตัวเดียวกัน
 * ถ้าแยกทางเดินกัน วันหนึ่งตัวเลขในรายงานกับในแบบจะไม่ตรงกันโดยไม่มีใครรู้
 *
 * ทุกหน้าเป็น drawing ที่ meta.scale = 1 พิกัดคือมิลลิเมตรบนกระดาษ A4 จริง
 * ตัวจัดหน้าเป็นแบบไหล (flow) ขึ้นหน้าใหม่เองเมื่อพื้นที่หมด
 * จำนวนหน้าจึงเปลี่ยนตามเนื้อหา ไม่ได้ล็อกไว้ตายตัว
 *
 * ชั้นนี้ไม่คำนวณอะไรเองเลย ทุกตัวเลขมาจาก snapshot ของ engine
 */
import { line, poly, circle, text, drawing } from './cadPrimitives.js?rwv=20260930-load-units-1';
import { SHEET, TITLE_BLOCK, BAR_GRADES, barName } from './draftingStandard.js?rwv=20260930-load-units-1';
import { wrapText, TEXT_W, paperSize, placeDrawing } from './sheetComposer.js?rwv=20261001-leader-layout-1';
import { textWidth } from './textMetrics.js?rwv=20260930-load-units-1';
import { drawnBoxOf } from './extentGeometry.js?rwv=20261001-leader-layout-1';
import { RW_REBAR_GEOMETRY_HOLD } from '../authorityContracts.mjs?rwv=20260930-load-units-1';
import {LEDGER_SOURCES,EQUATION_LEDGER_VERSION} from '../equationLedger.mjs?rwv=20261003-main-equations-1';
import {projectReportMembers,governingReportMembers,ESSENTIAL_REPORT_VERSION} from '../essentialReport.mjs?rwv=20261003-main-equations-1';
import { retainingWallSection } from './rwSectionGeometry.js?rwv=20261001-leader-layout-1';
import { retainingWallPlan } from './rwPlanGeometry.js?rwv=20261001-leader-layout-1';
import { buildA4CadSheets } from '../a4DrawingSheet.mjs?rwv=20261003-cad-contour-1';
import {resultUnits, displayEngineText} from '../resultUnits.mjs?rwv=20261002-legacy-output-units-1';
import {legacyDisplayedChecks, legacyRecoveryQuantity} from '../legacyOutputUnits.mjs?rwv=20261002-legacy-output-units-1';

const LY = { TEXT: 'RW-TEXT', TABLE: 'RW-TABLE', BORDER: 'RW-BORDER' };

/* รายการคำนวณใช้ A4 แนวตั้ง ต่างจากแผ่นเขียนแบบที่เป็นแนวนอน */
const A4 = SHEET.A4P;
const MG = { l: 20, r: 15, t: 16, b: 30 };          // ขอบ — สำรอง footer authority/verdict แยกบรรทัดและซ้ายกว้างกว่าไว้เย็บเล่ม
const H_BODY = 2.8;
const H_HEAD = 4.0;
const H_SUB = 3.2;
const LINE_PITCH = 4.6;

/** ตัดแท็ก HTML ออกจากข้อความเตือนของ engine — เอกสารพิมพ์ไม่มี markup */
const plain = (s) => String(s == null ? '' : s)
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

/** เลขทศนิยมคงที่ กัน -0 และค่าเสียไม่ให้หลุดลงเอกสาร */
const f = (v, n = 2) => {
  if (!Number.isFinite(v)) return '—';
  const s = v.toFixed(n);
  return s === '-' + (0).toFixed(n) ? (0).toFixed(n) : s;
};

const positive = (v) => Number.isFinite(v) && v > 0;
const wholeAtLeast = (v, min) => Number.isInteger(v) && v >= min;
const sourceBendLabel = (row) => {
  if (row && row.bend && typeof row.bend.code === 'string' && row.bend.code.trim()) {
    return row.bend.code;
  }
  return row && row.mk === 'K1' && row.bend && row.bend.type === 'keyU' ? row.bend.type : null;
};

/**
 * ตรวจ Projection กับ qty ต้นทางเพื่อกัน Snapshot บางส่วน/สลับชุด
 * ข้อมูลที่พิมพ์อ่านจาก Projection เท่านั้น ไม่คำนวณ totalLen/steelKg ซ้ำใน renderer
 */
function requireQuantityProjection(r, projection, owner = 'retainingWallReport') {
  const q = r && r.qty;
  if (!q || !Array.isArray(q.bbs) || !q.bbs.length) {
    throw new TypeError(owner + ': ต้องมี qty.bbs จาก engine');
  }
  if (!projection || projection.source !== 'engine.qty'
    || !Array.isArray(projection.bbs) || !projection.bbs.length
    || !positive(projection.steelKg)) {
    throw new TypeError(owner + ': ต้องส่ง quantityProjection ที่มี bbs/steelKg จาก Snapshot');
  }
  if (!positive(q.steelKg) || projection.steelKg !== q.steelKg
    || projection.bbs.length !== q.bbs.length) {
    throw new TypeError(owner + ': quantityProjection ไม่ตรงกับ qty จาก engine');
  }
  const marks = new Set();
  for (let index = 0; index < projection.bbs.length; index++) {
    const b = projection.bbs[index];
    const source = q.bbs[index];
    if (!b || typeof b.mk !== 'string' || !b.mk.trim() || marks.has(b.mk)) {
      throw new TypeError(owner + ': มาร์ค BBS ต้องเป็นข้อความไม่ว่างและไม่ซ้ำ');
    }
    marks.add(b.mk);
    if (!positive(b.size) || !positive(b.len) || !wholeAtLeast(b.n, 1)
      || !positive(b.kg) || !positive(b.totalLen)
      || typeof b.detail !== 'string' || !b.detail.trim()
      || typeof b.bendLabel !== 'string' || !b.bendLabel.trim()) {
      throw new TypeError(owner + ': BBS ' + b.mk
        + ' ต้องมี size/len/n/kg/totalLen/detail/bendLabel จาก Snapshot ที่ใช้ได้');
    }
    const exactBendLabel = sourceBendLabel(source);
    if (!source || !positive(source.size) || !positive(source.len) || !wholeAtLeast(source.n, 1)
      || !positive(source.kg) || typeof source.detail !== 'string' || !source.detail.trim()
      || !exactBendLabel) {
      throw new TypeError(owner + ': qty.bbs ' + b.mk + ' จาก engine ไม่ครบ');
    }
    if (b.mk !== source.mk || b.size !== source.size || b.len !== source.len
      || b.n !== source.n || b.kg !== source.kg || b.detail !== source.detail
      || b.bendLabel !== exactBendLabel) {
      throw new TypeError(owner + ': quantityProjection row ' + b.mk + ' ไม่ตรงกับ qty.bbs');
    }
  }
  return projection;
}

function requireVerdict(checks, verdict) {
  if (!verdict || typeof verdict.pass !== 'boolean'
    || !Number.isInteger(verdict.failedCount) || verdict.failedCount < 0
    || !Array.isArray(verdict.failed) || verdict.failed.length !== verdict.failedCount
    || typeof verdict.statement !== 'string' || !verdict.statement.trim()
    || verdict.pass !== (verdict.failedCount === 0)) {
    throw new TypeError('retainingWallReport: ต้องส่ง verdict ที่ครบและสอดคล้องจาก Snapshot');
  }
  if (checks.some((c) => !c || typeof c.ok !== 'boolean')) {
    throw new TypeError('retainingWallReport: checks ต้องมีค่า ok แบบ boolean ทุกแถว');
  }
  const failedChecks = checks.filter((c) => c.ok === false);
  if (failedChecks.length !== verdict.failedCount) {
    throw new TypeError('retainingWallReport: verdict.failedCount ไม่ตรงกับ checks');
  }
  for (let k = 0; k < failedChecks.length; k++) {
    const c = failedChecks[k], v = verdict.failed[k];
    if (!v || v.k !== c.k || v.v !== c.v || v.req !== c.req || !Object.is(v.u, c.u)) {
      throw new TypeError('retainingWallReport: verdict.failed ไม่ตรงกับ checks แถวที่ ' + (k + 1));
    }
  }
  return verdict;
}

function requireRegisteredCheck(checks, key) {
  const matches = checks.filter((row) => row && row.k === key);
  if (matches.length !== 1) {
    throw new TypeError('retainingWallReport: ต้องมี registered check "' + key + '" เพียงหนึ่งรายการ');
  }
  const row = matches[0];
  if (typeof row.v !== 'string' || !row.v.trim()
      || typeof row.req !== 'string' || !row.req.trim()
      || !Number.isFinite(row.u) || typeof row.ok !== 'boolean') {
    throw new TypeError('retainingWallReport: registered check "' + key + '" มี v/req/u/ok ไม่ครบ');
  }
  return row;
}

function requireAuthority(r, authority) {
  if (!authority || typeof authority.status !== 'string' || !authority.status.trim()
    || authority.constructionAuthority !== false
    || typeof authority.label !== 'string' || !authority.label.trim()
    || typeof authority.reason !== 'string' || !authority.reason.trim()) {
    throw new TypeError('retainingWallReport: ต้องส่ง authority ที่ครบและยังไม่อนุมัติก่อสร้างจาก Snapshot');
  }
  if (r.mode === 'but' && (authority.status !== 'CALCULATION_REPORT'
    || !authority.label.includes('CALCULATION REPORT') || !authority.reason.includes('CALCULATION REPORT'))) {
    throw new TypeError('retainingWallReport: counterfort ต้องคง authority เป็น CALCULATION REPORT');
  }
  return authority;
}

function requireEngineeringCoverage(coverage) {
  if (!coverage || coverage.releaseAuthority !== false
      || coverage.status !== 'REGISTERED_CHECKS_COMPLETE'
      || !Array.isArray(coverage.excludedChecks)
      || coverage.excludedChecks.length !== 0
      || typeof coverage.label !== 'string' || !coverage.label.trim()) {
    throw new TypeError('retainingWallReport: engineering coverage ต้องมี registered checks ครบ');
  }
  return coverage;
}

function requireRebarGeometryHold(hold) {
  if (!hold || hold.status !== RW_REBAR_GEOMETRY_HOLD.status
      || hold.constructionAuthority !== false
      || !Array.isArray(hold.marks) || hold.marks.length !== 1 || hold.marks[0] !== '⑧'
      || hold.label !== RW_REBAR_GEOMETRY_HOLD.label
      || hold.reason !== RW_REBAR_GEOMETRY_HOLD.reason) {
    throw new TypeError('retainingWallReport: rebarGeometryHold ต้องเป็น mark ⑧ placement HOLD จาก Snapshot');
  }
  return hold;
}

function requireForceDesignProjection(projection) {
  if (!projection || projection.source !== 'engine.result'
      || projection.method !== 'AUTO_REBAR_FROM_ENGINE'
      || projection.diagramPolicy !== 'ENGINE_GRID_OR_ENGINE_POINTS_NO_INTERPOLATION'
      || !projection.engineeringCoverage
      || projection.engineeringCoverage.status !== 'REGISTERED_CHECKS_COMPLETE'
      || !Array.isArray(projection.engineeringCoverage.excludedChecks)
      || projection.engineeringCoverage.excludedChecks.length !== 0
      || !Array.isArray(projection.members) || projection.members.length !== 3) {
    throw new TypeError('retainingWallReport: ต้องส่ง forceDesign จาก Snapshot ครบสามองค์อาคาร');
  }
  const ids = projection.members.map((member) => member && member.id);
  if (ids.join('|') !== 'stem|heel|toe') {
    throw new TypeError('retainingWallReport: forceDesign ต้องเรียง stem/heel/toe');
  }
  for (const member of projection.members) {
    if (!member || !Number.isFinite(member.length) || member.length < 0
        || !Array.isArray(member.bmd) || member.bmd.length < 2
        || !Array.isArray(member.sfd) || member.sfd.length < 2
        || !Number.isFinite(member.moment) || !Number.isFinite(member.shear)
        || !positive(member.shearCapacity)
        || !['PASS', 'FAIL'].includes(member.shearStatus)
        || !Array.isArray(member.designs) || !member.designs.length
        || !member.maxDesignUtilization || !Number.isFinite(member.maxDesignUtilization.dc)) {
      throw new TypeError('retainingWallReport: forceDesign.' + (member && member.id || '?') + ' ไม่ครบ');
    }
    if (!Number.isFinite(member.shearDc) || member.shearIncludedInVerdict !== true) {
      throw new TypeError('retainingWallReport: forceDesign.' + member.id + ' ต้องอ้าง registered shear check');
    }
  }
  return projection;
}

function requireRecoveryProjection(checks, recovery) {
  if (!recovery || recovery.source !== 'engine.trial'
      || recovery.acceptance !== 'TARGET_PASS_AND_NO_BASELINE_REGRESSION'
      || recovery.authority !== 'ADVISORY_APPLY_THEN_RECALCULATE'
      || !Number.isInteger(recovery.evaluationsUsed) || recovery.evaluationsUsed < 0
      || !Number.isInteger(recovery.evaluationLimit) || recovery.evaluationLimit < 1
      || recovery.evaluationsUsed > recovery.evaluationLimit
      || typeof recovery.searchTruncated !== 'boolean'
      || !Array.isArray(recovery.items)) {
    throw new TypeError('retainingWallReport: ต้องส่ง Engine-trial recovery จาก Snapshot');
  }
  const failed = checks.filter((row) => !row.ok);
  if (recovery.items.length !== failed.length
      || recovery.items.some((item, index) => !item || item.checkKey !== failed[index].k
        || typeof item.searchTruncated !== 'boolean'
        || !Array.isArray(item.candidates) || !Array.isArray(item.testedBounds))) {
    throw new TypeError('retainingWallReport: recovery items ต้องตรงกับ registered failures ทุกแถว');
  }
  for (const item of recovery.items) {
    for (const candidate of item.candidates) {
      if (!candidate || candidate.checkKey !== item.checkKey || candidate.targetCheckPass !== true
          || !Array.isArray(candidate.newlyFailing) || candidate.newlyFailing.length !== 0
          || !Array.isArray(candidate.changes) || !candidate.changes.length
          || !candidate.targetResult || candidate.targetResult.ok !== true) {
        throw new TypeError('retainingWallReport: recovery candidate ต้องผ่าน target และไม่มี baseline regression');
      }
    }
  }
  return recovery;
}

/** Contract เฉพาะกำแพงมีครีบ: ห้ามรายงานด้วยค่าทดแทนเมื่อ Snapshot ขาดบางส่วน */
function requireCounterfortReport(r, rows) {
  if (r.mode !== 'but') return null;
  if (!Array.isArray(r.strips) || !r.strips.length) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี strips จาก engine');
  }
  r.strips.forEach((s, k) => {
    if (!s || !Number.isFinite(s.z1) || !Number.isFinite(s.z2) || s.z2 <= s.z1
      || !Number.isFinite(s.wu) || !Number.isFinite(s.Mn_) || !Number.isFinite(s.Mn$)
      || !s.b_ || typeof s.b_.txt !== 'string' || !s.b_.txt.trim()
      || !s.b$ || typeof s.b$.txt !== 'string' || !s.b$.txt.trim()) {
      throw new TypeError('retainingWallReport: counterfort strip ' + (k + 1) + ' ไม่ครบ/ใช้ไม่ได้');
    }
  });
  if (!positive(r.cfLr) || !positive(r.cfHr)) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี cfLr/cfHr จาก engine');
  }
  if (!r.i || !positive(r.i.L) || !positive(r.i.bs)) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี i.L/i.bs จาก input ที่ normalize แล้ว');
  }
  if (!r.qty || !wholeAtLeast(r.qty.nBut, 2)) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี qty.nBut จาก engine');
  }
  const bu = r.but;
  if (!bu || typeof bu.barPre !== 'string' || !bu.barPre.trim() || !positive(bu.barSize)
    || !positive(bu.MuB) || !positive(bu.AsB)) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี but.barPre/barSize/MuB/AsB จาก engine');
  }
  const fc = bu.finCut;
  if (!fc || !positive(fc.Hf) || !Number.isFinite(fc.yTh) || fc.yTh < 0
    || !positive(fc.ext) || !positive(fc.cutLen) || !Number.isFinite(fc.frac)
    || fc.frac <= 0 || fc.frac > 1 || !wholeAtLeast(fc.nFul, 1)
    || !wholeAtLeast(fc.nCut, 1) || !positive(fc.db) || fc.db !== bu.barSize) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี but.finCut ครบและสอดคล้องกับ barSize');
  }

  const byMark = new Map(rows.map((b) => [b.mk, b]));
  const full = byMark.get('⑥'), cut = byMark.get('⑥b');
  const tieH = byMark.get('⑦a'), tieV = byMark.get('⑦b');
  if (!full || !cut || !tieH || !tieV) {
    throw new TypeError('retainingWallReport: counterfort ต้องมี BBS ⑥/⑥b/⑦a/⑦b จาก Snapshot');
  }
  if ([full, cut, tieH, tieV].some((b) => typeof b.pos !== 'string' || !b.pos.trim())) {
    throw new TypeError('retainingWallReport: BBS ⑥/⑥b/⑦a/⑦b ต้องมี pos จาก Snapshot');
  }
  if (full.size !== bu.barSize || cut.size !== bu.barSize) {
    throw new TypeError('retainingWallReport: BBS ⑥/⑥b ไม่สอดคล้องกับ barSize จาก Engine');
  }
  return { full, cut, tieH, tieV, fc };
}

/* ── ตัวจัดหน้าแบบไหล ─────────────────────────────────────────
   บล็อกเนื้อหาแต่ละก้อนถามพื้นที่ก่อนวาด ถ้าไม่พอก็ขึ้นหน้าใหม่
   วิธีนี้ทำให้จำนวนแถวของตาราง (เช่น stemTab หรือ BBS) เปลี่ยนได้โดยไม่ล้นหน้า */
class Flow {
  constructor(info, unitMode='si') {
    this.info = info || {};
    this.units = resultUnits(unitMode);
    this.pages = [];
    this.W = A4.w - MG.l - MG.r;
    this.newPage();
  }

  // Typed display conversion only. Keep the existing SI spelling/precision.
  value(v, unit, dec=2) { return f(this.units.value(v, unit), dec); }
  unit(unit) { return this.units.mode==='kgf' ? this.units.label(unit) : unit; }
  quantity(v, unit, dec=2) { return this.value(v, unit, dec)+' '+this.unit(unit); }
  prose(s) { return this.units.mode==='kgf' ? displayEngineText(s,'kgf') : s; }

  newPage() {
    this.E = [];
    this.y = A4.h - MG.t;
    this.pages.push(this.E);
    return this;
  }

  /** พื้นที่เหลือถึงขอบล่าง */
  get left() { return this.y - MG.b; }

  /** ขอให้มีที่ h มม. ถ้าไม่พอให้ขึ้นหน้าใหม่ */
  need(h) { if (this.left < h) this.newPage(); return this; }

  /** บังคับขึ้นหน้าใหม่ — ใช้กับหัวข้อที่เจ้าของงานสั่งให้แยกหน้าโดยเฉพาะ */
  pageBreak() { if (this.E.length) this.newPage(); return this; }

  gap(h) { this.y -= h; return this; }

  /** หัวข้อใหญ่พร้อมเส้นคาด — ห้ามให้หัวข้อค้างท้ายหน้าโดยไม่มีเนื้อหาตาม */
  h1(s) {
    this.need(18);
    this.y -= 2;
    this.E.push(text({ x: MG.l, y: this.y }, s, H_HEAD, LY.TEXT, { bold: true }));
    this.y -= 2.2;
    this.E.push(line({ x: MG.l, y: this.y }, { x: MG.l + this.W, y: this.y }, 'OUTLINE', LY.BORDER));
    this.y -= 5;
    return this;
  }

  h2(s) {
    this.need(12);
    this.E.push(text({ x: MG.l, y: this.y }, s, H_SUB, LY.TEXT, { bold: true }));
    this.y -= LINE_PITCH + 0.6;
    return this;
  }

  /** ข้อความยาว ตัดคำเองตามความกว้างหน้า */
  p(s, indent = 0) {
    const rows = wrapText(plain(s), this.W - indent, H_BODY);
    for (const rowText of rows) {
      this.need(LINE_PITCH);
      this.E.push(text({ x: MG.l + indent, y: this.y }, rowText, H_BODY, LY.TEXT));
      this.y -= LINE_PITCH;
    }
    return this;
  }

  /** บรรทัดสมการ: ชื่อ = สูตร = ผลลัพธ์ พร้อมที่มา
      เขียนสูตรพร้อมแทนค่าจริงเสมอ เพราะรายการคำนวณที่ตรวจไม่ได้ก็ไม่มีประโยชน์ */
  eq(name, formula, result, ref) {
    if (this.units.mode==='kgf') {
      const width=this.W-34;
      const formulas=wrapText(formula,width,H_BODY),results=wrapText(result,width,H_BODY);
      const refs=ref?wrapText(ref,width,2.2):[];
      this.need(LINE_PITCH*(formulas.length+results.length+refs.length));
      this.E.push(text({x:MG.l+4,y:this.y},name,H_BODY,LY.TEXT,{bold:true}));
      for(const row of formulas){this.E.push(text({x:MG.l+34,y:this.y},row,H_BODY,LY.TEXT));this.y-=LINE_PITCH;}
      for(const row of results){this.E.push(text({x:MG.l+this.W,y:this.y},row,H_BODY,LY.TEXT,{align:'R',bold:true}));this.y-=LINE_PITCH;}
      for(const row of refs){this.E.push(text({x:MG.l+34,y:this.y},row,2.2,LY.TEXT));this.y-=LINE_PITCH;}
      return this;
    }
    this.need(LINE_PITCH * (ref ? 2 : 1));
    this.E.push(text({ x: MG.l + 4, y: this.y }, name, H_BODY, LY.TEXT, { bold: true }));
    this.E.push(text({ x: MG.l + 34, y: this.y }, formula, H_BODY, LY.TEXT));
    this.E.push(text({ x: MG.l + this.W, y: this.y }, result, H_BODY, LY.TEXT, { align: 'R', bold: true }));
    this.y -= LINE_PITCH;
    if (ref) {
      this.E.push(text({ x: MG.l + 34, y: this.y }, ref, 2.2, LY.TEXT));
      this.y -= LINE_PITCH - 0.8;
    }
    return this;
  }

  /**
   * สมการแบบแสดงการแทนค่า — สามบรรทัด: สูตร → แทนค่า → ผลลัพธ์
   *
   * ★ ผลลัพธ์เป็นค่า authoritative จาก Engine Snapshot เท่านั้น
   *   renderer แค่จัดหน้าและพิมพ์สูตร/ค่าป้อนให้ไล่ตรวจได้ ห้ามคูณ หาร หาราก
   *   หรือตัดสินผลซ้ำ เพราะจะกลายเป็นแหล่งความจริงที่สอง
   *
   * @param {string} name    สัญลักษณ์
   * @param {string} symbol  สูตรเชิงสัญลักษณ์
   * @param {string} sub     สูตรที่แทนค่าแล้ว (ข้อความ)
   * @param {number} eng     ค่า authoritative จาก Engine Snapshot
   * @param {string} unit
   * @param {number} dec
   * @param {string} [ref]   ที่มาของสูตร
   */
  worked(name, symbol, sub, eng, unit, dec, ref) {
    if (!Number.isFinite(eng)) {
      throw new TypeError('retainingWallReport: Engine result "' + name + '" ต้องเป็นตัวเลขจำกัด');
    }
    const xF = MG.l + 26;
    const formulaWidth = this.W - 26;
    const symbolRows = wrapText('= ' + symbol, formulaWidth, H_BODY);
    const subRows = wrapText('= ' + sub, formulaWidth, H_BODY);
    const result = f(eng, dec) + (unit ? ' ' + unit : '');
    const resultLeft = MG.l + this.W - textWidth(result, H_BODY);
    const resultOnOwnLine = xF + textWidth(subRows.at(-1), H_BODY) + 2 > resultLeft;
    const refRows = ref ? wrapText(ref, formulaWidth, 2.2) : [];
    // SI operands and dimensioned constants remain SI. Append an explicit
    // display conversion rather than relabeling a mixed numerical equation.
    const convertible = this.units.mode==='kgf' &&
      ['kN','kN/ม.','kN/m','kN·m','kN·m/ม.','kN·m/m','kPa','MPa'].includes(unit);
    const conversion = convertible ? 'แปลงผล SI: '+f(eng,6)+' '+unit+' × '
      +(unit==='MPa'?'1000000 / (9.80665 × 10000)':'1000 / 9.80665')
      +' = '+this.quantity(eng,unit,2) : '';
    const conversionRows = conversion ? wrapText(conversion,formulaWidth,2.4) : [];
    this.need(LINE_PITCH * (symbolRows.length + subRows.length
      + (resultOnOwnLine ? 1 : 0) + refRows.length + conversionRows.length) + 1.4);
    this.E.push(text({ x: MG.l + 4, y: this.y }, name, H_BODY, LY.TEXT, { bold: true }));
    for (const row of symbolRows) {
      this.E.push(text({ x: xF, y: this.y }, row, H_BODY, LY.TEXT));
      this.y -= LINE_PITCH;
    }
    for (const [index, row] of subRows.entries()) {
      this.E.push(text({ x: xF, y: this.y }, row, H_BODY, LY.TEXT));
      if (index === subRows.length - 1 && !resultOnOwnLine) {
        this.E.push(text({ x: MG.l + this.W, y: this.y }, result,
          H_BODY, LY.TEXT, { align: 'R', bold: true }));
      }
      this.y -= LINE_PITCH;
    }
    if (resultOnOwnLine) {
      this.E.push(text({ x: MG.l + this.W, y: this.y }, result,
        H_BODY, LY.TEXT, { align: 'R', bold: true }));
      this.y -= LINE_PITCH;
    }
    for (const row of conversionRows) {
      this.E.push(text({x:xF,y:this.y},row,2.4,LY.TEXT,{bold:true}));
      this.y -= LINE_PITCH;
    }
    for (const row of refRows) {
      this.E.push(text({ x: xF, y: this.y }, row, 2.2, LY.TEXT));
      this.y -= LINE_PITCH - 1.0;
    }
    this.y -= 1.4;
    return this;
  }

  /** คู่ ชื่อ–ค่า สองคอลัมน์ต่อบรรทัด */
  kv(pairs) {
    // kgf quantities are wider: give each label/value the full page row,
    // wrapping inside its own column instead of colliding with the next pair.
    if (this.units.mode==='kgf') {
      for (const [label,value] of pairs) {
        const left=wrapText(String(label),87,H_BODY),right=wrapText(String(value),76,H_BODY);
        const rows=Math.max(left.length,right.length);this.need(rows*LINE_PITCH);
        left.forEach((row,k)=>this.E.push(text({x:MG.l+4,y:this.y-k*LINE_PITCH},row,H_BODY,LY.TEXT)));
        right.forEach((row,k)=>this.E.push(text({x:MG.l+this.W-4,y:this.y-k*LINE_PITCH},row,H_BODY,LY.TEXT,{align:'R',bold:true})));
        this.y-=rows*LINE_PITCH;
      }
      return this;
    }
    const colW = this.W / 2;
    for (let k = 0; k < pairs.length; k += 2) {
      this.need(LINE_PITCH);
      for (let c = 0; c < 2; c++) {
        const it = pairs[k + c];
        if (!it) continue;
        const x = MG.l + c * colW;
        this.E.push(text({ x: x + 4, y: this.y }, it[0], H_BODY, LY.TEXT));
        this.E.push(text({ x: x + colW - 4, y: this.y }, String(it[1]), H_BODY, LY.TEXT,
          { align: 'R', bold: true }));
      }
      this.y -= LINE_PITCH;
    }
    return this;
  }

  /**
   * ตาราง — ขึ้นหน้าใหม่พร้อมพิมพ์หัวตารางซ้ำ ไม่ปล่อยให้แถวลอยไร้หัว
   * @param {Array} cols [{th, w, align}]
   * @param {Array} rows แถวละ array ของสตริง (หรือ {cells, bold})
   */
  table(cols, rows, { cellH = 2.5, pitch = 4.0 } = {}) {
    const padX = 1.6;
    const headerRows = this.units.mode==='kgf'
      ? cols.map(c=>wrapText(c.th,c.w-padX*2,cellH)) : cols.map(c=>[c.th]);
    const headH = Math.max(6.2,Math.max(...headerRows.map(r=>r.length))*pitch+2.2);
    const W = cols.reduce((a, c) => a + c.w, 0);

    /* ★ ช่องตารางต้องตัดคำ ไม่ใช่ปล่อยให้ข้อความยาวทะลุขอบตารางออกไปนอกกระดาษ
       bbox ของ primitive วัดแค่จุดวางข้อความ จึงมองไม่เห็นการล้นแบบนี้ ต้องกันที่ต้นทาง */
    const linesOf = (raw) => {
      const r = Array.isArray(raw) ? { cells: raw } : raw;
      const per = cols.map((c, ci) =>
        wrapText(String(r.cells[ci] == null ? '' : r.cells[ci]), c.w - padX * 2, cellH));
      return { r, per, n: Math.max(1, ...per.map((x) => x.length)) };
    };

    const drawHead = () => {
      this.need(headH + pitch * 3);
      const yT = this.y;
      this.E.push(line({ x: MG.l, y: yT }, { x: MG.l + W, y: yT }, 'OUTLINE', LY.TABLE));
      let cx = MG.l;
      cols.forEach((c,ci) => {
        const x = c.align === 'R' ? cx + c.w - padX : c.align === 'C' ? cx + c.w / 2 : cx + padX;
        headerRows[ci].forEach((row,li)=>this.E.push(text({x,
          y:yT-headH/2+(headerRows[ci].length-1)*pitch/2-li*pitch},row,cellH,LY.TEXT,
          {align:c.align==='R'?'MR':c.align==='C'?'MC':'ML',bold:true})));
        cx += c.w;
      });
      this.y -= headH;
      this.E.push(line({ x: MG.l, y: this.y }, { x: MG.l + W, y: this.y }, 'OUTLINE', LY.TABLE));
      return yT;
    };

    const rule = (top, bottom) => {
      this.frame(MG.l, top, W, top - bottom);
      let cx = MG.l;
      for (const c of cols) {
        cx += c.w;
        if (cx < MG.l + W - 0.01) this.E.push(line({ x: cx, y: top }, { x: cx, y: bottom }, 'DIM', LY.TABLE));
      }
    };

    let top = drawHead();
    let bottom = this.y;
    for (const raw of rows) {
      const { r, per, n } = linesOf(raw);
      const rowH = n * pitch + 1.4;
      if (this.left < rowH + 4) {
        rule(top, bottom);
        this.newPage();
        top = drawHead();
        bottom = this.y;
      }
      const yTopRow = this.y;
      let cx = MG.l;
      cols.forEach((c, ci) => {
        const x = c.align === 'R' ? cx + c.w - padX : c.align === 'C' ? cx + c.w / 2 : cx + padX;
        per[ci].forEach((s, li) => {
          this.E.push(text({ x, y: yTopRow - 0.7 - pitch / 2 - li * pitch }, s, cellH, LY.TEXT,
            { align: c.align === 'R' ? 'MR' : c.align === 'C' ? 'MC' : 'ML', bold: !!r.bold }));
        });
        cx += c.w;
      });
      this.y -= rowH;
      this.E.push(line({ x: MG.l, y: this.y }, { x: MG.l + W, y: this.y }, 'DIM', LY.TABLE));
      bottom = this.y;
    }
    rule(top, bottom);
    this.y -= 4;
    return this;
  }

  frame(x, yTop, w, h) {
    this.E.push(poly([
      { x, y: yTop }, { x: x + w, y: yTop }, { x: x + w, y: yTop - h }, { x, y: yTop - h },
    ], 'OUTLINE', LY.TABLE, true));
    return this;
  }

  /** กล่องเน้น — ใช้กับผลที่ไม่ผ่านเท่านั้น ต้องเห็นแต่ไกล */
  callout(lines) {
    const rows = lines.flatMap((s) => wrapText(plain(s), this.W - 10, H_BODY));
    const h = rows.length * LINE_PITCH + 6;
    this.need(h + 2);
    const yT = this.y;
    this.frame(MG.l, yT, this.W, h);
    let y = yT - 5;
    for (const rowText of rows) {
      this.E.push(text({ x: MG.l + 5, y }, rowText, H_BODY, LY.TEXT, { bold: true }));
      y -= LINE_PITCH;
    }
    this.y = yT - h - 4;
    return this;
  }
}

/** The public essential report keeps worked equations in four explicit columns.
 * Queue adjacent rows so headings repeat only at a real table/page boundary. */
class EssentialFlow extends Flow {
  constructor(info,mode){super(info,mode);this.essential=true;this.equationRows=[];}
  flushEquations(){
    if(!this.equationRows.length||this.flushing)return this;
    const rows=this.equationRows;this.equationRows=[];this.flushing=true;
    try{super.table([{th:'รายการ',w:24},{th:'สูตร',w:48},{th:'แทนค่า',w:72},{th:'ผลลัพธ์',w:31}],rows,{cellH:2.7,pitch:4.4});}
    finally{this.flushing=false;}return this;
  }
  h1(s){this.flushEquations();return super.h1(this.heading(s));}
  h2(s){this.flushEquations();return super.h2(this.heading(s));}
  heading(s){return s.replace(/^([356])(?=[ .·])/,(m)=>({'3':'5','5':'3','6':'4'}[m]));}
  p(...a){this.flushEquations();return super.p(...a);}
  gap(...a){this.flushEquations();return super.gap(...a);}
  pageBreak(){this.flushEquations();return super.pageBreak();}
  kv(...a){this.flushEquations();return super.kv(...a);}
  table(...a){this.flushEquations();return super.table(...a);}
  callout(...a){this.flushEquations();return super.callout(...a);}
  worked(name,symbol,sub,eng,unit,dec,ref){
    if(!Number.isFinite(eng))throw new TypeError('retainingWallReport: Engine result "'+name+'" ต้องเป็นตัวเลขจำกัด');
    const convertible=['kN','kN/ม.','kN/m','kN·m','kN·m/ม.','kN·m/m','kPa','MPa'].includes(unit);
    const result=this.units.mode==='kgf'&&convertible?this.quantity(eng,unit,dec):f(eng,dec)+(unit?' '+unit:'');
    this.equationRows.push([name,symbol,sub,result+(ref?' · '+ref:'')]);return this;
  }
  eq(name,formula,result,ref){this.equationRows.push([name,formula,ref||'ค่าจากผลวิเคราะห์เดียวกัน',result]);return this;}
}

/* ── หัวและท้ายกระดาษ ───────────────────────────────────────── */
function pageFurniture(E, info, verdict, authority, engineeringCoverage, rebarGeometryHold, k, total, unitMode='si') {
  const yH = A4.h - MG.t + 6;
  E.push(text({ x: MG.l, y: yH }, info.title || 'รายการคำนวณกำแพงกันดิน คสล.',
    2.5, LY.TEXT, { bold: true }));
  E.push(text({ x: A4.w - MG.r, y: yH }, 'โครงการ ' + (info.project || '—'), 2.5, LY.TEXT, { align: 'R' }));
  E.push(line({ x: MG.l, y: yH - 2.2 }, { x: A4.w - MG.r, y: yH - 2.2 }, 'DIM', LY.BORDER));

  const yF = MG.b - 6;
  E.push(line({ x: MG.l, y: yF + 3.4 }, { x: A4.w - MG.r, y: yF + 3.4 }, 'DIM', LY.BORDER));
  E.push(text({ x: MG.l, y: yF }, 'BETA · ' + TITLE_BLOCK.stamp, 2.5, LY.TEXT, { bold: true }));
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: yF }, unitMode==='kgf'
    ? 'ผล kgf · kgf·m · kgf/m² · สมการแทนค่า SI · ระยะ เมตร'
    : 'แรง kN · โมเมนต์ kN·m · หน่วยแรง kPa · ระยะ เมตร (เว้นที่ระบุ)',
    2.2, LY.TEXT, { align: 'C' }));
  E.push(text({ x: A4.w - MG.r, y: yF }, 'หน้า ' + k + ' / ' + total, 2.5, LY.TEXT, { align: 'R' }));
  /* อำนาจเอกสารและคำตัดสินเป็นข้อมูล Snapshot — ต้องติดทุกหน้า แม้แยกหน้ากระดาษออกจากชุด */
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 19 }, authority.label,
    1.6, LY.TEXT, { align: 'C', bold: true }));
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 15 }, authority.reason,
    1.5, LY.TEXT, { align: 'C' }));
  const verdictLabel = 'ENGINE VERDICT ' + (verdict.pass ? 'PASS' : 'FAIL')
    + ' · FAILED ' + verdict.failedCount + ' · ' + verdict.statement;
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 10 }, verdictLabel,
    1.6, LY.TEXT, { align: 'C', bold: true }));
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 4.5 }, rebarGeometryHold.label,
    1.6, LY.TEXT, { align: 'C', bold: true }));
}

/* ── เนื้อหา ─────────────────────────────────────────────────── */

function sectionInput(F, r, opt) {
  if (!r.i || !positive(r.i.Lw)) {
    throw new TypeError('retainingWallReport: ต้องมี Lw ที่ normalize แล้วจาก Engine Snapshot');
  }
  F.h1('1 · ข้อมูลนำเข้าและมาตรฐานออกแบบ');

  F.h2('1.1 มาตรฐานที่ใช้');
  F.kv([
    ['โปรไฟล์ออกแบบ', opt.code || '—'],
    ['วิธีคำนวณแรงดันดิน', r.earthMethod || '—'],
    ['รูปแบบกำแพง', r.gravity ? 'กำแพงมวล (Gravity · Coulomb)'
      : r.mode === 'but' ? 'กำแพงมีครีบ (Counterfort)'
        : r.mode === 'cant' ? 'กำแพงยื่น (Cantilever)' : String(r.mode || '—')],
    ['ฐานรากวางบน', r.onPile ? 'เสาเข็ม' : 'ดิน'],
  ]);

  F.gap(2).h2('1.2 รูปทรงหน้าตัด (เมตร)');
  F.kv([
    ['ความสูงกำแพง H', f(r.H, 3)],
    ['ความกว้างฐาน B', f(r.i.B, 3)],
    ['ความหนาพนังที่โคน t', f(r.i.t, 3)],
    ['ความหนาพนังที่ยอด t_top', f(r.tTop, 3)],
    ['ความหนาฐาน hz', f(r.i.hz, 3)],
    ['ยื่นหน้า toe', f(r.i.toe, 3)],
    ['ยื่นหลัง heel', f(r.heel, 3)],
    ['ความยาวกำแพงที่คิด L', f(r.i.Lw, 3)],
  ]);

  F.gap(2).h2('1.3 ดินและน้ำ');
  /* ระดับน้ำที่ลึกกว่าท้องฐานคือ "ไม่มีน้ำในการคำนวณ" — พิมพ์ค่าดิบอย่าง 99.00 ม. ออกไป
     ผู้อ่านจะเข้าใจว่ามีการสำรวจแล้วพบน้ำที่ 99 เมตร ซึ่งไม่จริง */
  const zwTxt = Number.isFinite(r.hwb) && r.hwb > 0
    ? f(r.i.zw, 2) + ' ม. จากผิวดิน'
    : 'ต่ำกว่าท้องฐานราก (ไม่คิดแรงดันน้ำ)';
  F.kv([
    ['หน่วยน้ำหนักดินถม (ชื้น) γ', F.quantity(r.i.gs, 'kN/ม³')],
    ['หน่วยน้ำหนักดินถม (อิ่มตัว) γ_sat', F.quantity(r.i.gsat, 'kN/ม³')],
    ['มุมเสียดทานภายใน φ', f(r.i.phi, 1) + ' องศา'],
    ['แรงยึดเกาะ c', F.quantity(r.i.c, 'kPa')],
    ['ความชันหลังกำแพง β', f(r.beta, 1) + ' องศา'],
    ['DL คงที่บนผิวดิน q_DL', F.quantity(r.i.qD ?? 0, 'kPa',3)],
    ['LL จรบนผิวดิน q_LL', F.quantity(r.i.qL ?? r.i.q, 'kPa',3)],
    ['Surcharge รวม q = DL + LL', F.quantity(r.i.q, 'kPa',3)],
    ['ระดับน้ำใต้ดิน z_w', zwTxt],
    ['สัมประสิทธิ์เสียดทานใต้ฐาน μ', f(r.i.mu, 2)],
    ['ระดับฝังฐาน D_f', f(r.i.Df, 2) + ' ม.'],
    ['ความลึก shear key', r.i.dk > 0 ? f(r.i.dk, 2) + ' ม.' : 'ไม่มี'],
    ['สัมประสิทธิ์แรงดันเชิงรุก Ka', f(r.Ka, 4)],
    ['สัมประสิทธิ์แรงดันเชิงรับ Kp', f(r.Kp, 4)],
  ]);

  F.gap(2).h2('1.4 วัสดุ');
  F.kv([
    ['กำลังอัดคอนกรีต f′c', F.quantity(r.i.fc, 'MPa',F.units.mode==='kgf'?2:0)],
    ['กำลังครากเหล็ก f_y', F.quantity(r.i.fy, 'MPa',F.units.mode==='kgf'?2:0)],
    ['ชั้นคุณภาพเหล็ก', (BAR_GRADES[r.i.fy] && BAR_GRADES[r.i.fy].label) || '—'],
    ['ระยะหุ้มคอนกรีต (พนัง)', f(r.i.cov, 0) + ' มม.'],
  ]);
}

function sectionEssentialInput(F,r,opt){
  F.h1('1 · DL / LL และแรงกระทำ');
  F.p((opt.code||'—')+' · '+(r.gravity?'กำแพงมวล (Gravity · Coulomb)':r.mode==='but'?'กำแพงมีครีบ (Counterfort)':'กำแพงยื่น (Cantilever)')
    +' · '+r.earthMethod+' · ต่อความยาวกำแพง 1 ม.');
  F.table([{th:'ประเภทแรง',w:50},{th:'ค่าที่ใช้',w:45},{th:'การกระทำ / สมมติฐาน',w:80}], [
    ['DL ผิวดิน qD',F.quantity(r.surcharge.dead,'kPa',3),'แรงกระจายบนผิวดิน'],
    ['LL ผิวดิน qL',F.quantity(r.surcharge.live,'kPa',3),'แรงกระจายบนผิวดิน'],
    ['q = qD + qL',F.quantity(r.surcharge.total,'kPa',3),'ค่าใช้งานก่อนคูณตัวประกอบ'],
    ...r.W.map(w=>[plain(w.n),F.quantity(w.v,'kN',3),'น้ำหนักตัวเอง / ดินถม · x '+f(w.x,3)+' ม. · '+(w.st?'ใช้ต้านทาน':'ไม่ใช้ต้านทาน')]),
  ],{cellH:2.7,pitch:4.4});
  F.p('Surcharge ไม่คิดซ้ำเป็นน้ำหนักช่วยต้านพลิก/เลื่อน; น้ำหนักตัวเองและดินถมจากขนาดจริง');
  const q=r.surcharge,fac=opt.equationLedger?.factors;
  F.p('γD '+f(q.verticalDeadFactor,2)+' · γL '+f(q.verticalLiveFactor,2)+' · γH '+f(q.lateralFactor,2)
    +(fac?' · γD,r '+f(fac.gDr,2):''));
  if(F.units.mode==='kgf')F.p('สมการแทนค่า SI; แปลงผล SI: kN × (1000 / 9.80665) = kgf; MPa × (100 / 9.80665) = kgf/cm²; D/C คงค่าเดิม');
  F.kv([['H / B / hz (ม.)',f(r.H,3)+' / '+f(r.i.B,3)+' / '+f(r.i.hz,3)],
    ['t / Toe / Heel (ม.)',f(r.i.t,3)+' / '+f(r.i.toe,3)+' / '+f(r.heel,3)],
    ['f′c / fy',F.quantity(r.i.fc,'MPa')+' / '+F.quantity(r.i.fy,'MPa')],
    ['ระยะหุ้มพนัง / ฐาน',''+f(r.i.cov,0)+' / 75 มม.'],
    ['γ / γsat',F.quantity(r.i.gs,'kN/m³')+' / '+F.quantity(r.i.gsat,'kN/m³')],
    ['φ / c / β',f(r.i.phi,1)+'° / '+F.quantity(r.i.c,'kPa')+' / '+f(r.beta,1)+'°'],
    ['น้ำใต้ดิน',r.hwb>0?f(r.i.zw,2)+' ม. จากผิวดิน':'ไม่คิดแรงดันน้ำ'],
    ['μ / qa',f(r.i.mu,3)+' / '+F.quantity(r.qaUse,'kPa')]]);
}

function chartPoints(points, x, y, w, h, xMin, xMax, yAbs) {
  return points.map((p) => ({
    x: x + 1.2 + (p.x - xMin) / Math.max(xMax - xMin, 1e-9) * Math.max(w - 2.4, 0),
    y: y + p.y / yAbs * h,
  }));
}

function drawForceChart(F, member, x, top, w, h, key, title) {
  const baseY = top - h / 2;
  const series = [member[key], ...(key === 'bmd' && member.bmdAlt.length ? [member.bmdAlt] : [])];
  const allPoints = series.flat();
  const xs = allPoints.map((p) => p.x);
  const ys = allPoints.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yAbs = Math.max(...ys.map((v) => Math.abs(v)), 1e-9);
  F.E.push(text({ x, y: top + 3 }, title, 2.4, LY.TEXT, { bold: true }));
  F.E.push(text({ x: x + w, y: top + 3 }, F.unit(key === 'bmd' ? 'kN·m/m' : 'kN/m'),
    2.4, LY.TEXT, { align: 'R' }));
  F.E.push(line({ x, y: baseY }, { x: x + w, y: baseY }, 'DIM', LY.TABLE));
  F.E.push(line({ x, y: top }, { x, y: top - h }, 'DIM', LY.TABLE));
  for (const points of series) {
    const plotted = chartPoints(points, x, baseY, w, h / 2 - 2, xMin, xMax, yAbs);
    if (member.diagramKind === 'engine-grid') {
      F.E.push(poly(plotted, 'OUTLINE', LY.BORDER));
    } else {
      for (const point of plotted) {
        F.E.push(line({ x: point.x - 1.1, y: point.y }, { x: point.x + 1.1, y: point.y }, 'OUTLINE', LY.BORDER));
        F.E.push(line({ x: point.x, y: point.y - 1.1 }, { x: point.x, y: point.y + 1.1 }, 'OUTLINE', LY.BORDER));
      }
    }
  }
  /* จุดทึบคือค่าสูงสุดสัมบูรณ์ของ ordinate ที่ Engine ส่งจริง;
     กราฟ critical/design points ยังคงเป็นจุด ไม่ต่อเส้นอนุมาน. */
  const peak = allPoints.reduce((found, point) => Math.abs(point.y) > Math.abs(found.y) ? point : found);
  const peakPoint = chartPoints([peak], x, baseY, w, h / 2 - 2, xMin, xMax, yAbs)[0];
  F.E.push(circle(peakPoint, 0.9, 'OUTLINE', LY.BORDER, true));
  // The ring marks the structural junction/counterfort support along this member,
  // never a foundation pin. Foundation reaction is distributed in the FBD above.
  const roots = member.id === 'stem' && member.diagramKind === 'engine-strip-points'
    ? [] : member.id === 'heel' && member.diagramKind === 'engine-design-points'
      ? [xMin, xMax] : [xMax];
  for (const root of roots) {
    const rootX = x + 1.2 + (root - xMin) / Math.max(xMax - xMin, 1e-9)
      * Math.max(w - 2.4, 0);
    F.E.push(circle({ x: rootX, y: baseY }, 1.55, 'DIM', LY.TABLE));
  }
}

function sectionForceDesign(F, r, projection) {
  F.pageBreak().h1(F.essential?'2 · Freebody Diagram / SFD / BMD':'2 · Plan / Section · แรงกระทำ · SFD/BMD');

  F.h2('2.1 Plan และ Section ที่ใช้วิเคราะห์');
  F.need(59);
  const yTop = F.y;
  const xSec = MG.l + 4, secW = 72, secH = 46;
  const xPlan = MG.l + 96, planW = 70, planH = 46;
  /* A4 เป็นภาพสรุป ไม่ใช่แบบมาตราส่วน: สองมุมมองใช้ข้อมูลฐานชุดเดียวกัน
     โดย x ของ Plan คือแนว Lw และ y คือ Toe → พนัง → Heel ตามขวางฐาน */
  const toeM = r.i.toe, stemM = r.i.t, heelM = r.heel;
  const baseM = toeM + stemM + heelM, wallM = r.i.Lw;
  if (![toeM, stemM, heelM, baseM, wallM, r.i.B, r.i.hp, r.i.hz].every(Number.isFinite)
      || toeM < 0 || stemM <= 0 || heelM <= 0 || wallM <= 0
      || r.i.B <= 0 || r.i.hp <= 0 || r.i.hz <= 0) {
    throw new TypeError('retainingWallReport: Plan/Section geometry จาก Engine ไม่ครบ');
  }
  /* ครีบตัวท้ายอาจถูกเลื่อนเข้าขอบ Lw ตามผัง A3; หยุดเมื่อเลื่อนแล้วทับตัวก่อนหน้า */
  if (r.mode === 'but' && (!Number.isInteger(r.qty?.nBut) || r.qty.nBut < 2
      || !positive(r.Lt) || !positive(r.i.bs) || r.i.bs >= wallM || !positive(r.cfLr)
      || Math.min((r.qty.nBut - 1) * r.Lt, wallM - r.i.bs)
      < (r.qty.nBut - 2) * r.Lt + r.i.bs - 1e-9)) {
    throw new TypeError('retainingWallReport: ผังครีบต้องมีจำนวนและตำแหน่งจาก Engine ครบ');
  }
  const heelFloored = Math.abs(baseM - r.i.B) > 1e-6;
  const sc = Math.min((secW - 28) / baseM, (secH - 10) / (r.i.hp + r.i.hz));
  const bx = baseM * sc, hz = r.i.hz * sc, toe = toeM * sc, stem = stemM * sc, hp = r.i.hp * sc;
  const baseX = xSec + 12 + (secW - 28 - bx) / 2, baseY = yTop - secH + 8;
  const stemTop = (Number.isFinite(r.tTop) ? r.tTop : (r.i.ttop || r.i.t)) * sc;
  const backAt = (y) => baseX + toe + stem + (stemTop - stem) * (y - baseY - hz) / hp;
  F.E.push(poly([
    { x: baseX, y: baseY }, { x: baseX + bx, y: baseY },
    { x: baseX + bx, y: baseY + hz }, { x: baseX, y: baseY + hz },
  ], 'CUT', LY.BORDER, true));
  F.E.push(poly([
    { x: baseX + toe, y: baseY + hz }, { x: baseX + toe + stem, y: baseY + hz },
    { x: baseX + toe + stemTop, y: baseY + hz + hp }, { x: baseX + toe, y: baseY + hz + hp },
  ], 'CUT', LY.BORDER, true));
  /* Match the Engine's two bearing regimes. xbar is measured from Toe:
     full contact inside the kern, triangular compression over 3*xbar or
     3*(B-xbar) outside it. Arrows are representative distributed pressure. */
  const fullContact = Math.abs(r.e) <= r.kern;
  const contactStartM = fullContact ? 0 : r.e > 0 ? 0 : Math.max(0, r.i.B - 3 * (r.i.B - r.xbar));
  const contactEndM = fullContact ? r.i.B : r.e > 0 ? Math.min(r.i.B, 3 * r.xbar) : r.i.B;
  const contactStartX = baseX + Math.max(0, Math.min(1, contactStartM / r.i.B)) * bx;
  const contactEndX = baseX + Math.max(0, Math.min(1, contactEndM / r.i.B)) * bx;
  if (contactEndX > contactStartX) F.E.push(line(
    { x: contactStartX, y: baseY - 1.1 }, { x: contactEndX, y: baseY - 1.1 },
    'HATCH', LY.TABLE));
  for (let k = 1; k <= 5; k++) {
    const xx = contactStartX + (contactEndX - contactStartX) * k / 6;
    if (contactEndX <= contactStartX) break;
    F.E.push(line({ x: xx, y: baseY - 3.5 }, { x: xx, y: baseY - 1.4 },
      'DIM', LY.TABLE));
    F.E.push(line({ x: xx - .65, y: baseY - 2.1 }, { x: xx, y: baseY - 1.4 },
      'DIM', LY.TABLE));
    F.E.push(line({ x: xx + .65, y: baseY - 2.1 }, { x: xx, y: baseY - 1.4 },
      'DIM', LY.TABLE));
  }
  if (r.mode === 'but' && positive(r.cfLr) && positive(r.cfHr)) {
    F.E.push(line(
      { x: baseX + toe + stem, y: baseY + hz + r.cfHr * sc },
      { x: baseX + toe + stem + r.cfLr * sc, y: baseY + hz },
      'HIDDEN', LY.TABLE,
    ));
  }
  F.E.push(line({ x: baseX + toe + stemTop, y: baseY + hz + hp },
    { x: baseX + bx + 5, y: baseY + hz + hp }, 'HIDDEN', LY.TABLE));
  for (let k = 1; k <= 5; k++) {
    const yy = baseY + hz + hp * k / 6;
    const tipX = backAt(yy) + 1;
    const len = 4 + 13 * (6 - k) / 5;
    F.E.push(line({ x: tipX + len, y: yy }, { x: tipX, y: yy }, 'DIM', LY.TABLE));
    F.E.push(line({ x: tipX + 1.5, y: yy + 0.8 }, { x: tipX, y: yy }, 'DIM', LY.TABLE));
    F.E.push(line({ x: tipX + 1.5, y: yy - 0.8 }, { x: tipX, y: yy }, 'DIM', LY.TABLE));
  }
  F.E.push(text({ x: xSec, y: yTop + 2 }, 'SECTION A-A · แนวแรงด้านข้าง (สัญลักษณ์)', 2.5, LY.TEXT, { bold: true }));
  F.E.push(text({ x: xSec, y: baseY - 6 }, 'H ' + f(r.i.hp, 2) + ' · ฐานหนา ' + f(r.i.hz, 2) + ' ม.', 2.3, LY.TEXT));
  F.E.push(text({ x: xSec, y: baseY - 10 }, 'Toe ' + f(toeM, 2) + ' · พนัง ' + f(stemM, 2)
    + ' · Heel ' + f(heelM, 2) + ' ม.' + (heelFloored ? ' (Engine ขั้นต่ำ)' : ''), 2.2, LY.TEXT));

  const planSc = Math.min((planW - 12) / wallM, (planH - 19) / baseM);
  const planDrawW = wallM * planSc, planDrawH = baseM * planSc;
  const planX = xPlan + 6 + (planW - 12 - planDrawW) / 2;
  const planY = baseY + 6 + (planH - 19 - planDrawH) / 2;
  const stemFrontY = planY + toeM * planSc, stemBackY = stemFrontY + stemM * planSc;
  F.E.push(poly([
    { x: planX, y: planY }, { x: planX + planDrawW, y: planY },
    { x: planX + planDrawW, y: planY + planDrawH }, { x: planX, y: planY + planDrawH },
  ], 'OUTLINE', LY.BORDER, true));
  F.E.push(poly([
    { x: planX, y: stemFrontY }, { x: planX + planDrawW, y: stemFrontY },
    { x: planX + planDrawW, y: stemBackY }, { x: planX, y: stemBackY },
  ], 'CUT', LY.BORDER, true));
  if (r.mode === 'but') {
    const ribTop = Math.min(stemBackY + r.cfLr * planSc, planY + planDrawH);
    for (let k = 0; k < r.qty.nBut; k++) {
      const ribX = planX + Math.min(k * r.Lt, wallM - r.i.bs) * planSc;
      F.E.push(poly([
        { x: ribX, y: stemBackY }, { x: ribX + r.i.bs * planSc, y: stemBackY },
        { x: ribX + r.i.bs * planSc, y: ribTop }, { x: ribX, y: ribTop },
      ], 'OUTLINE', LY.BORDER, true));
    }
  }
  const cutX = planX + planDrawW * 0.28;
  F.E.push(line({ x: cutX, y: planY - 2 }, { x: cutX, y: planY + planDrawH + 2 }, 'CENTRELINE', LY.TABLE));
  F.E.push(text({ x: cutX + 1, y: planY - 3 }, 'A', 2.3, LY.TEXT, { bold: true }));
  F.E.push(text({ x: cutX + 1, y: planY + planDrawH + 2.5 }, 'A', 2.3, LY.TEXT, { bold: true }));
  if (toeM * planSc >= 5) F.E.push(text({ x: planX + planDrawW * 0.65, y: planY + toeM * planSc / 2 },
    'TOE · ด้านหน้า', 2.1, LY.TEXT, { align: 'MC' }));
  if (heelM * planSc >= 5) F.E.push(text({ x: planX + planDrawW * 0.65, y: stemBackY + heelM * planSc / 2 },
    'HEEL · ดินถม', 2.1, LY.TEXT, { align: 'MC' }));
  F.E.push(text({ x: xPlan, y: yTop + 2 }, r.mode === 'but'
    ? 'PLAN · ผังฐานรวม / ครีบ ' + r.qty.nBut + ' ตัว'
    : 'PLAN · ผังฐานรวมตลอดแนวกำแพง', 2.5, LY.TEXT, { bold: true }));
  F.E.push(text({ x: xPlan, y: baseY - 4 }, 'Lw ' + f(wallM, 2) + ' · B กรอก ' + f(r.i.B, 2) + ' ม.', 2.3, LY.TEXT));
  F.E.push(text({ x: xPlan, y: baseY - 8 }, heelFloored
    ? 'Heel ขั้นต่ำจาก Engine · ตรวจ B / Toe / t'
    : 'Toe ' + f(toeM, 2) + ' · พนัง ' + f(stemM, 2) + ' · Heel ' + f(heelM, 2) + ' ม.', 2.2, LY.TEXT));
  F.E.push(text({ x: xPlan, y: baseY - 11 }, fullContact
    ? 'ฐานรับแรงดินกระจาย ไม่ใช่จุด pin/fixed'
    : 'ฐานสัมผัสดินบางส่วน · q=0 ที่ขอบยกตัว', 2.1, LY.TEXT));
  // Reserve the complete figure captions before the next report heading.
  F.y = baseY - 15;

  F.h2('2.2 Freebody Diagram · แรงกระทำจาก Engine Snapshot');
  F.kv([
    ['แรงด้านข้างรวม P_h', F.quantity(projection.loads.lateral,'kN/ม.')],
    ['แรงดันน้ำ P_w', F.quantity(projection.loads.water,'kN/ม.')],
    ['Surcharge q', F.quantity(projection.loads.surcharge,'kPa')],
    ['แรงกดใต้ฐาน q_toe / q_heel', F.value(projection.loads.bearingToe,'kPa')+' / '
      +F.quantity(projection.loads.bearingHeel,'kPa')],
  ]);

  F.h2('2.3 SFD / BMD · ○ จุดต่อสมาชิก · ● ค่าสุดขีดจาก Engine');
  F.need(63);
  const forceTop = F.y - 6;
  const forceColW = 53;
  projection.members.forEach((member, index) => {
    const x = MG.l + index * 60;
    F.E.push(text({ x, y: forceTop + 7 }, member.label, 2.6, LY.TEXT, { bold: true }));
    drawForceChart(F, member, x, forceTop, forceColW, 18, 'bmd', 'BMD · M ' + F.value(member.moment,'kN·m/m'));
    drawForceChart(F, member, x, forceTop - 23, forceColW, 18, 'sfd', 'SFD · V ' + F.value(member.shear,'kN/m'));
    const shearText = 'เฉือน D/C ' + f(member.shearDc, 3) + ' · ' + member.shearStatus;
    F.E.push(text({ x, y: forceTop - 45 },
      'As สูงสุด ' + member.governingSteel.selected + ' · D/Cmax ' + f(member.maxDesignUtilization.dc, 3),
      2.1, LY.TEXT, { bold: true }));
    F.E.push(text({ x, y: forceTop - 50 }, shearText, 2.1, LY.TEXT, { bold: true }));
  });
  F.y = forceTop - 56;

  F.gap(1).h2('2.4 กติกา D/C และการเลือกเหล็ก');
  F.p('เหล็กที่แสดงเป็นผลเลือกอัตโนมัติจาก Engine · D/C เหล็ก = As,req / As,prov · ตารางแทนค่าเต็มอยู่ในหัวข้อออกแบบหน้าตัด');
  F.p('D/C เฉือน STEM/HEEL/TOE อ่านจาก registered Engine check และรวมในคำตัดสินหลักทุกองค์อาคาร');
}

function sectionChecks(F, checks, verdict, engineeringCoverage, recovery) {
  F.gap(3).h1('3 · สรุปผลตรวจสอบ');

  /* Calculation verdict and document signing remain separate. */
  F.callout([
    engineeringCoverage.label,
    verdict.pass
      ? 'REGISTERED CHECKS PASS — ผ่านเฉพาะรายการที่ Engine ลงทะเบียน ไม่ใช่ผลอนุมัติทั้งระบบ'
      : verdict.statement,
    ...(!verdict.pass ? [
      'รายการที่ไม่ผ่าน: ' + verdict.failed.map((c) => plain(c.k)).join(' · '),
      'ดูค่าที่ Engine ทดลองซ้ำด้านล่าง แล้วคำนวณใหม่ทั้งชุดก่อนนำไปใช้',
    ] : []),
  ]);

  F.table([
    { th: 'รายการตรวจสอบ', w: 52, align: 'L' },
    { th: 'ค่าที่ได้', w: 28, align: 'R' },
    { th: 'เกณฑ์ยอมรับ', w: 57, align: 'L' },
    { th: 'อัตราส่วนใช้งาน', w: 22, align: 'R' },
    { th: 'ผล', w: 16, align: 'C' },
  ], checks.map((c) => ({
    cells: [plain(c.k), plain(c.v), plain(c.req), Number.isFinite(c.u) ? f(c.u, 2) : '—',
      c.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    bold: !c.ok,
  })));

  if (!verdict.pass) {
    F.gap(2).h2('3.1 ค่าปรับปรุงที่ Engine ทดลองซ้ำ');
    const displayValue = (value, unit) => {
      const shown = legacyRecoveryQuantity(value,unit,F.units.mode);
      return f(shown.value,unit==='MPa'?0:2);
    };
    const displayUnit = unit => legacyRecoveryQuantity(0,unit,F.units.mode).unit;
    recovery.items.forEach((item) => {
      if (item.status === 'FOUND' && item.candidates.length) {
        item.candidates.forEach((candidate) => {
          const coupled = candidate.changes.filter((change) => change.key !== candidate.field
            && change.key !== 'ttop').map((change) => change.key + ' '
              + displayValue(change.from, change.unit) + ' → '
              + displayValue(change.to, change.unit) + ' ' + displayUnit(change.unit));
          const scope = candidate.allRegisteredPass
            ? 'ผ่านทุกรายการที่ลงทะเบียน'
            : 'ผ่านเฉพาะรายการนี้ · ยังเหลือ ' + candidate.remainingFailures.length + ' รายการ: '
              + candidate.remainingFailures.join(' · ');
          F.p(plain(item.checkKey) + ' — ' + (candidate.direction === 'down' ? 'ลด ' : 'เพิ่ม ')
            + plain(candidate.label) + ' ' + displayValue(candidate.from, candidate.unit) + ' → '
            + displayValue(candidate.to, candidate.unit) + ' ' + displayUnit(candidate.unit)
            + (coupled.length ? ' · ปรับร่วม ' + coupled.join(' · ') : '')
            + ' · Engine ตรวจซ้ำ '+(F.units.mode==='kgf'?'(SI) ':'') + plain(candidate.targetResult.v) + ' ('
            + plain(candidate.targetResult.req) + ') · ' + scope, 2.05);
        });
      } else {
        const tested = item.testedBounds.map((bound) => 'ทดลอง ' + plain(bound.label) + ' ถึง '
          + displayValue(bound.value, bound.unit) + ' ' + displayUnit(bound.unit) + ' ได้ '
          +(F.units.mode==='kgf'?'(SI) ':'')
          + plain(bound.targetResult && bound.targetResult.v || '—') + ' ('
          + plain(bound.targetResult && bound.targetResult.req || '—') + ')').join(' · ');
        F.p(plain(item.checkKey) + ' — ' + plain(item.reason)
          + (tested ? ' · ' + tested : ''), 2.05);
      }
    });
    F.p('คำแนะนำนี้เป็น ENGINE TRIAL แบบตัวแปรเดียว กรอกค่าแล้วต้องคำนวณ Snapshot ใหม่ และยังไม่ใช่อำนาจอนุมัติก่อสร้าง', 2.05);
  }

  if (verdict.pass) F.p('REGISTERED CHECKS PASS · ENGINE CHECKS · NOT FOR CONSTRUCTION');
}

/**
 * สายหลักฐานของโปรไฟล์ — มาตรฐาน ข้อ และสมการที่ระบบรันจริง
 *
 * ★ ย้ายออกจากหน้าแรกตามที่เจ้าของงานสั่ง (2026-08-30)
 *   หน้าแรกควรตอบให้ได้ก่อนว่า "ออกแบบอะไร ด้วยเกณฑ์ไหน ผ่านหรือไม่ผ่าน"
 *   ส่วนรายการข้อกฎหมายและสมการเต็ม ๆ เป็นของผู้ตรวจ ไม่ใช่ของคนเปิดอ่านหน้าแรก
 *   เอาไว้หน้าแรกทำให้ข้อมูลนำเข้ากับผลตรวจถูกดันตกไปหน้าอื่น อ่านต่อเนื่องไม่ได้
 */
function sectionEvidence(F, opt) {
  const list = Array.isArray(opt.evidence) ? opt.evidence.filter(Boolean) : [];
  if (!list.length) return;
  /* เจ้าของงานสั่งให้ย้ายก้อนนี้ออกจากหน้าแรกไปอยู่หน้าที่สอง จึงบังคับขึ้นหน้าใหม่
     ไม่ปล่อยให้ไหลต่อท้ายหน้าแรกเมื่อยังมีที่เหลือ */
  F.pageBreak();
  F.h1('4 · มาตรฐาน ข้อกำหนด และสมการที่ระบบรันจริง');
  F.p('รายการนี้คือสิ่งที่ระบบใช้คำนวณจริงในชุดผลนี้ ไม่ใช่รายการอ้างอิงทั่วไป '
    + 'ผู้ตรวจสามารถไล่จากสมการในหัวข้อถัดไปกลับมาที่ข้อกำหนดตรงนี้ได้');
  F.gap(1.5);
  for (const e of list) F.p('· ' + plain(e), 4);
}

function sectionEquationLedger(F,ledger) {
  if(!ledger)return; // Existing low-level report callers keep their page contract.
  if(ledger.schema!==EQUATION_LEDGER_VERSION||!ledger.checkCount||ledger.constructionApproved!==false)
    throw new TypeError('RW-01 report requires complete equation ledger projection');
  F.pageBreak();
  F.h1('โปรไฟล์ สมการ และขอบเขตชิ้นส่วน');
  F.p(ledger.label+' · ชุดผล '+ledger.identity+' · '+ledger.checkCount+' รายการตรวจ · ไม่ผ่าน '+ledger.failed);
  const f=ledger.factors;
  F.p('DL '+f.gD+' · LL '+f.gL+' · H '+f.gH+' · D ต้าน '+f.gDr
    +(ledger.method==='wsd'?' · ไม่ใช้ φ':' · φb '+f.phib+' · φv '+f.phiv));
  for(const note of ledger.assumptions)F.p('· '+note);
  F.h2('สมการและเจ้าของค่า');
  for(const e of ledger.equations) {
    F.h2(e.title);F.p(e.formula);F.p(e.assumption);
    F.p('อ้างอิง: '+e.reference);F.p('เจ้าของค่า: '+e.owner);
  }
  F.h2('ชิ้นส่วนและขอบเขตรายการตรวจ');
  F.table([{th:'ชิ้นส่วน',w:38},{th:'รายการตรวจ',w:33},{th:'ขอบเขต',w:104}],ledger.components.map(c=>[
    c.label,c.registered?c.registered+' รายการ / ไม่ผ่าน '+c.failed:'ไม่มีรายการแยก',c.note]),{cellH:2.8,pitch:4.3});
  F.h2('ต้นฉบับและสถานะการอ้างอิง');
  for(const key of ledger.sourceKeys) {const s=LEDGER_SOURCES[key];F.p(s.title+' · '+s.edition);F.p(s.evidence);F.p(s.url);}
}

function sectionStability(F, r, checks) {
  const i = r.i;
  const overturningCheck = requireRegisteredCheck(checks, 'F.S. OVERTURNING');
  const slidingCheck = requireRegisteredCheck(checks, 'F.S. SLIDING');
  F.gap(3).h1('5 · แรงดันดินและเสถียรภาพ');
  if (F.units.mode==='kgf') F.p('สมการและค่าที่แทนในหัวข้อ 5–6 ใช้ SI ตาม Engine ทุกบรรทัด; แถวแปลงผลใช้ค่าก่อนปัดจาก Snapshot · 1 kgf = 9.80665 N (NIST SP811 B.8)');

  F.h2('5.1 สัมประสิทธิ์แรงดันดินเชิงรุก');
  if (r.earthMethod === 'Rankine' && r.beta === 0) {
    F.worked('K_a', 'tan²(45° − φ/2)',
      'tan²(45° − ' + f(i.phi, 1) + '°/2) · β = ' + f(r.beta, 1) + '°', r.Ka, '', 4,
      'Rankine · หลังกำแพงราบ (β = 0)');
  } else if (r.earthMethod === 'Rankine') {
    F.worked('K_a', 'cos β · (cos β − √(cos²β − cos²φ)) / (cos β + √(cos²β − cos²φ))',
      'β = ' + f(r.beta, 1) + '° · φ = ' + f(i.phi, 1) + '°', r.Ka, '', 4,
      'Rankine · หลังกำแพงลาดเอียง · FHWA NHI-01-094 Eq.6-2');
  } else {
    /* วิธี Coulomb และ Mononobe–Okabe มีตัวแปรมุมผนัง δ และมุมเอียง θ เข้ามาด้วย
       การเขียนสูตรย่อแล้วแทนค่าไม่ครบจะทำให้ผู้ตรวจเข้าใจผิด จึงระบุวิธีและค่าที่ได้ตรง ๆ */
    F.eq('K_a', 'คำนวณตามวิธี ' + r.earthMethod + ' (δ = ' + f(r.wallDelta, 1) + '° · θ = '
      + f(r.wallTheta || 0, 1) + '°)', f(r.Ka, 4));
  }

  F.gap(1).h2('5.2 แรงดันดินและแรงดันน้ำ');
  F.worked('P_a', '∫₀^Hq max[K_a(σ′_v(z)+q) − 2c√K_a, 0] · C_h dz',
    'K_a = ' + f(r.Ka, 4) + ' · H_q = ' + f(r.Hq, 3) + ' ม. · d_1/d_2 = '
      + f(r.d1, 3) + '/' + f(r.d2, 3) + ' ม. · γ/γ_sat = ' + f(i.gs, 2) + '/' + f(i.gsat, 2)
      + ' kN/ม³ · q = ' + f(i.q, 2) + ' kPa · c = ' + f(r.cc, 2) + ' kPa',
    r.Phs, 'kN/ม.', 2, 'ผลรวมจาก Engine pressure integration ต่อความยาวกำแพง 1 ม.');

  F.worked('P_w', '∫γ_w(z−d_1) dz เฉพาช่วงใต้ระดับน้ำ',
    r.Pw > 0
      ? '0.5 × 9.81 × (' + f(r.Hq, 3) + ' − ' + f(r.d1, 3) + ')² kN/ม.'
      : 'ไม่มีแรงดันน้ำ · γ_w = 9.81 kN/ม³',
    r.Pw, 'kN/ม.', 2, 'แรงดันน้ำสถิตจาก Engine pressure integration');

  F.worked('P_h', 'P_a + P_w',
    f(r.Phs, 2) + ' + ' + f(r.Pw, 2) + ' kN/ม.', r.Ph, 'kN/ม.', 2);
  if (r.Pv) {
    F.eq('P_v', 'องค์ประกอบแนวดิ่งของแรงดันดินเมื่อหลังกำแพงลาดเอียง', F.quantity(r.Pv,'kN/ม.'));
  }

  F.worked('M_o', '∫(p_s+p_w)y dz',
    f(r.Ph, 2) + ' × ' + f(r.ybar, 3) + ' kN·m/ม. (ȳ เหนือท้องฐาน)',
    r.Mo, 'kN·m/ม.', 2, 'โมเมนต์แรงดันจาก Engine integration รอบปลาย toe');

  F.gap(1).h2('5.3 น้ำหนักต้านทานและโมเมนต์ยึด');
  const wRows = (r.W || []).map((w) => [plain(w.n), F.value(w.v,'kN'), f(w.x, 3), '—', w.st ? 'คิด' : 'ไม่คิด']);
  if(!F.essential) F.table([
    { th: 'ส่วนที่คิดน้ำหนัก', w: 78, align: 'L' },
    { th: 'น้ำหนัก ('+F.unit('kN')+')', w: 26, align: 'R' },
    { th: 'แขน x (ม.)', w: 24, align: 'R' },
    { th: 'โมเมนต์จาก Engine'+(F.units.mode==='kgf'?' ('+F.unit('kN·m')+')':''), w: 30, align: 'R' },
    { th: 'สถานะ', w: 17, align: 'C' },
  ], wRows.concat([{ cells: ['Engine totals', F.value(r.SVs,'kN'), '', F.value(r.SMs,'kN·m'), 'authoritative'], bold: true }]));

  F.h2('5.4 เสถียรภาพการพลิกคว่ำและการเลื่อนไถล');
  F.worked('F.S._พลิกคว่ำ', 'ΣM_ต้าน / M_o,รวมแรงยก',
    f(r.SMs, 2) + ' / ' + f(r.MoT, 2), r.FSot, '', 2,
    overturningCheck.req);

  F.worked('F.S._เลื่อนไถล', '(R_เสียดทาน + R_ยึดเกาะ + P_p) / P_h',
    '(' + f(r.slideFric, 2) + ' + ' + f(r.slideAdh, 2) + ' + '
      + f(r.PpAll, 2) + ') / ' + f(r.Ph, 2), r.FSsl, '', 2,
    slidingCheck.req);

  F.gap(1).h2('5.5 ตำแหน่งแรงลัพธ์และแรงกดใต้ฐาน');
  F.worked('x̄', '(ΣM_ฐาน − M_o,รวมแรงยก) / V_b',
    '(' + f(r.SMb, 2) + ' − ' + f(r.MoT, 2)
      + ') / ' + f(r.Vb, 2) + ' ม.', r.xbar, 'ม.', 3, 'วัดจากปลาย toe');
  F.worked('e', 'B/2 − x̄',
    f(i.B, 3) + '/2 − ' + f(r.xbar, 3) + ' ม.', r.e, 'ม.', 3,
    'เกณฑ์ e ≤ B/6 = ' + f(r.kern, 3) + ' ม. (แรงลัพธ์อยู่ในหนึ่งส่วนสามกลางฐาน)');
  const bearingSymbol = 'Engine bearing distribution: V_b/B·(1±6e/B) ใน middle third; รูปสามเหลี่ยมเมื่อเกิน kern';
  const bearingSub = 'V_b = ' + f(r.Vb, 2) + ' kN/ม. · B = ' + f(i.B, 3) + ' ม. · e = '
    + f(r.e, 3) + ' ม. · x̄ = ' + f(r.xbar, 3) + ' ม. · kern = ' + f(r.kern, 3) + ' ม.';
  /* q1/q2 เป็นแรงกดที่ Toe/Heel; เมื่อ e ติดลบ Heel อาจสูงกว่า Toe
     จึงห้ามตั้งชื่อค่าปลายทั้งสองว่า max/min โดยอนุมานจากทิศของแรงลัพธ์ */
  F.worked('q_toe', bearingSymbol, bearingSub, r.q1, 'kPa', 2);
  F.worked('q_heel', bearingSymbol, bearingSub, r.q2, 'kPa', 2);
  F.eq('q_max', 'max(q_toe, q_heel) · ควบคุมที่ ' + (r.q1 >= r.q2 ? 'Toe' : 'Heel'),
    F.quantity(r.qMax,'kPa'));
  F.eq('q_min', 'min(q_toe, q_heel)', F.quantity(r.qMin,'kPa'));
  if (Math.abs(r.qmaxEff - r.qMax) > 1e-9) {
    F.eq('q_design', 'แรงกดสำหรับตรวจ bearing จาก B′ ตาม Engine', F.quantity(r.qmaxEff,'kPa'));
  }
  F.eq('q_a', 'กำลังแบกทานยอมให้ที่ใช้ในการตรวจสอบ', F.quantity(r.qaUse,'kPa'));
}

function sectionSection(F, r, checks, quantityProjection, displayChecks=checks) {
  F.gap(3).h1('6 · ออกแบบหน้าตัดและเหล็กเสริม');

  if (r.mode === 'but') {
    /* กำแพงมีครีบ — พนังพาดราบระหว่างครีบ ออกแบบเป็นแถบ (r.strips) ไม่ใช่คานยื่น (stemTab) */
    F.h2('6.1 พนังพาดราบระหว่างครีบ — แถบตามความลึก (M=w·L²/12 ที่ครีบ · w·L²/16 กลางช่วง)');
    F.table([
      { th: 'แถบ z (ม.)', w: 28, align: 'R' },
      { th: 'w_u ('+F.unit('kN/ม²')+')', w: 24, align: 'R' },
      { th: 'M ที่ครีบ ('+F.unit('kN·m')+')', w: 28, align: 'R' },
      { th: 'M กลางช่วง ('+F.unit('kN·m')+')', w: 28, align: 'R' },
      { th: 'เหล็กหน้าดิน', w: 24, align: 'L' },
      { th: 'เหล็กหน้านอก', w: 24, align: 'L' },
    ], r.strips.map((s) => ({
      cells: [f(s.z1, 1) + '–' + f(s.z2, 1), F.value(s.wu,'kPa',1), F.value(s.Mn_,'kN·m',1), F.value(s.Mn$,'kN·m',1),
        s.b_.txt, s.b$.txt],
      bold: !!s.bad,
    })));
    const bu = r.but, fcB = bu.finCut;
    const byMark = new Map(quantityProjection.bbs.map((b) => [b.mk, b]));
    const row6 = byMark.get('⑥'), row6b = byMark.get('⑥b');
    const row7a = byMark.get('⑦a'), row7b = byMark.get('⑦b');
    F.h2('6.1ข ครีบยึด (COUNTERFORT)');
    F.kv([
      ['จำนวนครีบ', r.qty.nBut + ' ตัว @ c/c ' + f(r.Lt, 2) + ' ม. (ช่วงว่าง ' + f(r.i.L, 2) + ' ม.)'],
      ['หน้าตัดครีบ', f(r.i.bs, 2) + ' × ' + f(r.cfLr, 2) + ' ม. · สูง ' + f(r.cfHr, 2) + ' ม.'],
      ['M_u ครีบ', F.quantity(bu.MuB,'kN·m',1) + ' · As = ' + f(bu.AsB, 0) + ' มม²'],
    ]);
    /* รายละเอียดเหล็กครีบยาวกว่าครึ่งหน้าอย่างมีนัยสำคัญ ต้องใช้ตารางเต็มความกว้าง
       ห้ามวางแบบ key/value สองคอลัมน์เพราะข้อความ ⑥/⑥b จะชนกันหรือถูกตัด */
    F.table([
      { th: 'มาร์ค / หน้าที่', w: 35, align: 'L' },
      { th: 'รายละเอียดจาก BBS ใน Snapshot', w: 140, align: 'L' },
    ], [
      ['⑥ · ยาวตลอด', plain(row6.pos) + ' · ' + plain(row6.detail)
        + ' · รูปดัด ' + row6.bendLabel + ' · รวม ' + row6.n + ' เส้น · ยาวรวม ' + f(row6.totalLen, 1) + ' ม.'],
      ['⑥b · Cutoff', plain(row6b.pos) + ' · ' + plain(row6b.detail)
        + ' · ตัดที่ +' + f(fcB.cutLen, 2) + ' ม. · รูปดัด ' + row6b.bendLabel
        + ' · รวม ' + row6b.n + ' เส้น · ยาวรวม ' + f(row6b.totalLen, 1) + ' ม.'],
      ['⑦a · U-tie ราบ', plain(row7a.pos) + ' · ' + plain(row7a.detail)
        + ' · รูปดัด ' + row7a.bendLabel + ' · รวม ' + row7a.n + ' เส้น · ยาวรวม ' + f(row7a.totalLen, 1) + ' ม.'],
      ['⑦b · U-tie ดิ่ง', plain(row7b.pos) + ' · ' + plain(row7b.detail)
        + ' · รูปดัด ' + row7b.bendLabel + ' · รวม ' + row7b.n + ' เส้น · ยาวรวม ' + f(row7b.totalLen, 1) + ' ม.'],
    ]);
  } else {
  F.h2('6.1 พนัง (STEM) ตามความลึก');
  F.table([
    { th: 'ระดับ z จากยอด (ม.)', w: 30, align: 'R' },
    { th: 'ความหนา (ม.)', w: 24, align: 'R' },
    { th: 'd (ม.)', w: 20, align: 'R' },
    { th: 'M_u ('+F.unit('kN·m')+')', w: 26, align: 'R' },
    { th: 'V_u ('+F.unit('kN')+')', w: 22, align: 'R' },
    { th: 'As ต้องการ (มม²)', w: 28, align: 'R' },
    { th: 'เหล็กที่ใช้', w: 25, align: 'L' },
  ], (r.stemTab || []).map((s) => ({
    cells: [f(s.z, 2), f(s.th, 3), f(s.d, 3), F.value(s.Mu,'kN·m'), F.value(s.Vu,'kN'), f(s.As, 0),
      s.bar ? s.bar.txt : '—'],
    bold: !!s.bad,
  })));
  }

  F.h2('6.2 ฐานราก');
  if(r.surcharge) {
    const q=r.surcharge;
    F.worked('q_u,q','γ_D q_DL + γ_L q_LL',
      f(q.verticalDeadFactor,2)+' × '+f(q.dead,3)+' + '+f(q.verticalLiveFactor,2)+' × '+f(q.live,3)+' kPa',
      q.verticalFactored,'kPa',3,'ตัวคูณจากโปรไฟล์ที่ Engine ใช้; แรงดันดินใช้ Surcharge รวมและ γ_H');
    F.worked('w_u,H','γ_D[γ(h_p−h_sub)+γ_sat h_sub+γ_c h_z+q_DL] + γ_L q_LL',
      f(q.verticalDeadFactor,2)+' × ['+f(r.i.gs,2)+' × ('+f(r.i.hp,3)+' − '+f(r.hsub,3)+') + '
      +f(r.i.gsat,2)+' × '+f(r.hsub,3)+' + '+f(r.i.gc,2)+' × '+f(r.i.hz,3)+' + '+f(q.dead,3)+'] + '
      +f(q.verticalLiveFactor,2)+' × '+f(q.live,3)+' kPa',r.wuH,'kPa',3,
      'น้ำหนักคอนกรีต/ดินจากรูปทรง; Surcharge ไม่ถูกนับซ้ำ');
  }
  F.table([
    { th: 'ส่วน', w: 40, align: 'L' },
    { th: 'M_u ('+F.unit('kN·m')+')', w: 30, align: 'R' },
    { th: 'As ต้องการ (มม²)', w: 32, align: 'R' },
    { th: 'เหล็กที่ใช้', w: 32, align: 'L' },
    { th: 'As ที่ได้ (มม²)', w: 31, align: 'R' },
  ], [
    ['heel — เหล็กบน', F.value(r.MH_,'kN·m'), f(r.AsH_, 0), r.barH_ ? r.barH_.txt : '—',
      r.barH_ ? f(r.barH_.prov, 0) : '—'],
    ['heel — เหล็กล่าง', F.value(r.MH$,'kN·m'), f(r.AsH$, 0), r.barH$ ? r.barH$.txt : '—',
      r.barH$ ? f(r.barH$.prov, 0) : '—'],
    ['toe — เหล็กล่าง', F.value(r.MT,'kN·m'), f(r.AsT, 0), r.barT ? r.barT.txt : '—',
      r.barT ? f(r.barT.prov, 0) : '—'],
  ]);

  F.h2('6.3 ความลึกประสิทธิผลและกำลังรับแรงเฉือน');
  const stemBase = r.mode === 'but'
    ? (r.strips && r.strips.length ? r.strips[r.strips.length - 1] : null)
    : (r.stemTab && r.stemTab.length ? r.stemTab[r.stemTab.length - 1] : null);
  const stemBar = stemBase && (r.mode === 'but' ? stemBase.b_ : stemBase.bar);
  const dStem = Number.isFinite(r.dS) ? r.dS : (stemBase && stemBase.d);
  const stemShear = requireRegisteredCheck(checks, 'SHEAR — STEM');
  const heelShear = requireRegisteredCheck(checks, 'SHEAR — HEEL');
  const toeShear = requireRegisteredCheck(checks, 'SHEAR — TOE');
  if (Number.isFinite(dStem) && stemBar && Number.isFinite(stemBar.db)) {
    F.worked('d (พนัง)', 't − ระยะหุ้ม − d_b/2',
      f(r.i.t, 3) + ' − ' + f(r.i.cov, 0) + '/1000 − ' + f(stemBar.db, 0) + '/2000 ม.',
      dStem, 'ม.', 3,
      'ระยะหุ้มพนัง ' + f(r.i.cov, 0) + ' มม. · เหล็ก ' + barName(stemBar.grade || r.i.fy, stemBar.db));
  }
  F.worked('d (ฐาน Heel)', 'h_z − ระยะหุ้ม − d_b/2',
    f(r.i.hz, 3) + ' − 75/1000 − ' + f(r.barH_.db, 0) + '/2000 ม.',
    r.dH, 'ม.', 3,
    'ระยะหุ้มฐานรากที่หล่อติดดิน 75 มม. · เหล็ก ' + barName(r.barH_.grade || r.i.fy, r.barH_.db));

  /* สมการกำลังเฉือนและค่า φ/ค่ายอมให้ขึ้นกับ profile ของ Engine
     renderer จึงพิมพ์ค่า result/check ตรง ๆ และไม่เดา profile หรือคำนวณ φV_c ซ้ำ */
  if (Number.isFinite(dStem)) {
    F.worked('กำลังเฉือน (พนัง)', 'สมการตาม profile ที่ Engine รันจริง',
      stemShear.req + ' · d = ' + f(dStem, 3) + ' ม. · f′c = ' + f(r.i.fc, 0) + ' MPa',
      r.phiVcS, 'kN', 2, 'ค่าจาก Engine result และ registered check SHEAR — STEM');
  }
  F.worked('กำลังเฉือน (ฐาน)', 'สมการตาม profile ที่ Engine รันจริง',
    heelShear.req + ' · d = ' + f(r.dH, 3) + ' ม. · f′c = ' + f(r.i.fc, 0) + ' MPa',
    r.phiVcH, 'kN', 2, 'ค่าจาก Engine result และ registered check SHEAR — HEEL');

  F.gap(1);
  const shownStem = requireRegisteredCheck(displayChecks,'SHEAR — STEM');
  const shownHeel = requireRegisteredCheck(displayChecks,'SHEAR — HEEL');
  const shownToe = requireRegisteredCheck(displayChecks,'SHEAR — TOE');
  F.table([
    { th: 'หน้าตัดวิกฤต', w: 52, align: 'L' },
    { th: 'ค่า Engine', w: 34, align: 'R' },
    { th: 'เกณฑ์ Engine', w: 34, align: 'R' },
    { th: 'V_u / φV_c', w: 28, align: 'R' },
    { th: 'ผล', w: 27, align: 'C' },
  ], [
    ['พนังที่ระยะ d จากโคน', shownStem.v, shownStem.req, f(stemShear.u, 2),
      stemShear.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    ['heel ที่หน้าพนัง', shownHeel.v, shownHeel.req, f(heelShear.u, 2),
      heelShear.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    ['toe ห่างหน้าพนัง d', shownToe.v, shownToe.req, f(toeShear.u, 2),
      toeShear.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
  ]);
  F.worked('V (Toe)', '∫₀ˣ [q_u(s) − γ_D γ_c h_z] ds + Σ R_u',
    'x = ' + f(r.toeAnalysis.criticalX,3) + ' ม. · d = ' + f(r.toeAnalysis.d,3)
      + ' ม. · น้ำหนักฐาน = ' + f(r.toeAnalysis.dead,2) + ' kPa',
    r.VuT, 'kN/ม.', 2, 'แรงดันแบบเชิงเส้น/สามเหลี่ยม; รวมเฉพาะแรงเข็มนอกหน้าตัดวิกฤต');
}

function sectionQty(F, r, quantityProjection) {
  F.gap(3).h1('7 · ปริมาณวัสดุและตารางเหล็ก');

  const q = r.qty || {};
  F.kv([
    ['คอนกรีตต่อความยาว 1 ม.', f(q.conc, 3) + ' ม³'],
    ['คอนกรีตทั้งกำแพง', f(q.concTot, 2) + ' ม³'],
    ['แบบหล่อ', f(q.form, 2) + ' ม²'],
    ['คอนกรีตหยาบ', f(q.lean, 2) + ' ม³'],
    ['เหล็กเสริมรวม (รวมเผื่อทาบ/สูญเสีย 8%)', f(quantityProjection.steelKg, 0) + ' กก.'],
    ['เข็มที่ใช้', r.onPile && q.nPile ? String(q.nPile) + ' ต้น' : 'ไม่ใช้เข็ม'],
  ]);

  F.gap(2).h2('7.1 ตารางเหล็กเสริม');
  F.table([
    { th: 'มาร์ค', w: 14, align: 'C' },
    { th: 'ขนาด', w: 18, align: 'C' },
    { th: 'รูปดัด', w: 14, align: 'C' },
    { th: 'ระยะเรียง / หมายเหตุ', w: 44, align: 'L' },
    { th: 'ยาว/เส้น (ม.)', w: 24, align: 'R' },
    { th: 'จำนวน', w: 18, align: 'R' },
    { th: 'ยาวรวม (ม.)', w: 22, align: 'R' },
    { th: 'น้ำหนัก (กก.)', w: 21, align: 'R' },
  ], quantityProjection.bbs.map((b) => [String(b.mk), barName(r.i.fy, b.size), b.bendLabel, plain(b.detail),
    f(b.len, 3), String(b.n), f(b.totalLen, 1), f(b.kg, 1)]).concat([{
    cells: ['', '', '', 'รวมเผื่อทาบ/สูญเสีย 8%', '', '', '', f(quantityProjection.steelKg, 1)],
    bold: true,
  }]));
}

function sectionEssentialDesign(F,r,checks,opt){
  F.gap(3).h1('6 · ออกแบบหน้าตัดและเหล็กเสริม');
  const method=opt.equationLedger.method,factors=opt.equationLedger.factors;
  F.p(method==='wsd'?'WSD · ใช้แรงใช้งานและกำลังยอมให้ ไม่ใช้ φ':'SDM · แรงออกแบบจาก SFD/BMD และตัวคูณโปรไฟล์');
  const q=r.surcharge;
  F.worked('qu ผิวดิน','γD·qD + γL·qL',f(q.verticalDeadFactor,2)+' × '+f(q.dead,3)+' + '+f(q.verticalLiveFactor,2)+' × '+f(q.live,3),q.verticalFactored,'kPa',3);
  F.worked('wu Heel','γD[γ(hp−hsub)+γsat·hsub+γc·hz+qD] + γL·qL',
    f(q.verticalDeadFactor,2)+' × ['+f(r.i.gs,2)+' × ('+f(r.i.hp,3)+' − '+f(r.hsub,3)+') + '+f(r.i.gsat,2)+' × '+f(r.hsub,3)+' + '+f(r.i.gc,2)+' × '+f(r.i.hz,3)+' + '+f(q.dead,3)+'] + '+f(q.verticalLiveFactor,2)+' × '+f(q.live,3),r.wuH,'kPa',3);
  F.h2('เหล็กดัดจากหน้าตัดที่ใช้วิเคราะห์');
  const formula=method==='wsd'?'As = max[M/(fs·j·d), As,min]; j=1−k/3'
    :'Rn=M/(φbd²); As=max[(0.85f′c/fy)(1−√(1−2Rn/0.85f′c))bd, As,min]';
  const members=projectReportMembers(r).filter(m=>!m.width);
  for(const m of governingReportMembers(members)){
    if(!Number.isFinite(m.As)){F.eq(m.name,'หน้าตัดไม่พอหรือไม่มีเหล็กที่ใช้ได้','ไม่ผ่าน');continue;}
    F.worked(m.name,formula,'M '+f(m.M,3)+' × 10⁶ N·mm · b 1000 mm · d '+f(m.d*1000,1)+' mm · f′c '+f(r.i.fc,2)+' · fy '+f(r.i.fy,2)+' MPa'
      +(method==='wsd'?' · fs,j จากวิธี WSD':' · φ '+f(factors.phib,2)),m.As,'มม²/ม.',1,
      m.bar+' · As,prov '+f(m.provided,1)+' มม²/ม.');
  }
  F.h2('เหล็กที่เลือกในแต่ละตำแหน่ง');
  F.table([{th:'ตำแหน่ง',w:61},{th:'M ที่ใช้ ('+F.unit('kN·m/m')+')',w:30},{th:'As ต้องการ (mm²/m)',w:28},{th:'เหล็ก / As ที่ได้ (mm²/m)',w:56}],
    members.map(m=>[m.name,F.value(m.M,'kN·m/m',3),f(m.As,1),m.bar+' / '+f(m.provided,1)]));
  if(r.mode==='but'){
    const b=r.but;
    F.worked('ครีบ · As',formula,'M '+f(b.MuB,3)+' × 10⁶ N·mm · b '+f(r.i.bs*1000,1)+' mm · d '+f(b.dB*1000,1)+' mm · f′c '+f(r.i.fc,2)+' · fy '+f(r.i.fy,2)+' MPa',b.AsB,'มม²',1,
      'เหล็กหลัก / Cutoff / U-tie ตามมาร์คในแบบท้ายรายงาน');
  }
  F.h2('กำลังเฉือนของหน้าตัดจริง');
  for(const [name,d,V,cap]of [['STEM',r.dS,r.VuS,r.phiVcS],['HEEL',r.dH,r.VuH,r.phiVcH],['TOE',r.toeAnalysis.d,r.VuT,r.phiVcT]]){
    const c=requireRegisteredCheck(checks,'SHEAR — '+name);
    F.worked(name,method==='wsd'?'Vallow = 0.09√f′c·b·d / 1000':'φVc = φv·0.17√f′c·b·d / 1000',
      (method==='wsd'?'0.09':f(factors.phiv,2)+' × 0.17')+' × √'+f(r.i.fc,2)+' × 1000 × '+f(d*1000,1)+' / 1000 · Vตรวจ '+f(V,3)+' kN/m'
      +(name==='TOE'?' · toe ห่างหน้าพนัง d · หน้าที่คุม '+r.toeAnalysis.criticalFace:''),cap,'kN/m',3,c.ok?'ผ่าน':'ไม่ผ่าน');
  }
}

function sectionNotes(F, r, spec) {
  F.gap(3).h1('8 · ข้อกำหนดก่อสร้างและคำเตือน');

  if (spec) {
    F.h2('8.1 ข้อกำหนดการเทและรอยต่อ');
    F.kv([
      ['ระยะรอยต่อก่อสร้าง', f(spec.joint, 2) + ' ม.'],
      ['ระยะรูระบายน้ำ', f(spec.weep, 2) + ' ม.'],
      ['ความหนาชั้นกรองหลังพนัง', f(spec.filter, 2) + ' ม.'],
      ['ความหนาคอนกรีตหยาบ', f(spec.lean, 2) + ' ม.'],
      ['ความหนาชั้นถมบดอัด', f(spec.fillLift, 2) + ' ม.'],
      ['ความแน่นบดอัดที่ต้องการ', f(spec.compact, 0) + ' %'],
      ['ความสูง lift เทพนัง', f(spec.wallLift, 2) + ' ม.'],
      ['ขนาดมวลรวมหยาบ', f(spec.agg, 0) + ' มม.'],
    ]);
    F.gap(1).h2('8.2 ความคลาดเคลื่อนที่ยอมให้');
    F.kv([
      ['ตำแหน่งในผัง', '± ' + f(spec.tolPlan, 0) + ' มม.'],
      ['ระดับ', '± ' + f(spec.tolLevel, 0) + ' มม.'],
      ['ความดิ่ง', '± ' + f(spec.tolPlumb, 0) + ' มม.'],
      ['ความหนา', '± ' + f(spec.tolThk, 0) + ' มม.'],
    ]);
  }

  /* ผลตรวจข้อกำหนดก่อสร้างอยู่ใน snapshot ไม่ใช่ใน constructionSpec()
     เคยพลาดมาแล้วตรงนี้ จนหัวข้อหายไปทั้งหัวข้อโดยไม่มีใครเห็น */
  const cChecks = (r.construct && Array.isArray(r.construct.checks)) ? r.construct.checks : [];
  if (cChecks.length) {
    F.gap(1).h2('8.3 ผลตรวจข้อกำหนดก่อสร้าง');
    F.table([
      { th: 'หัวข้อ', w: 58, align: 'L' },
      { th: 'ผล', w: 16, align: 'C' },
      { th: 'รายละเอียด', w: 101, align: 'L' },
    ], cChecks.map((c) => ({
      cells: [plain(c.label || c.code), c.ok ? 'ผ่าน' : 'ต้องแก้', plain(c.detail)],
      bold: !c.ok,
    })));
  }

  if (Array.isArray(r.warn) && r.warn.length) {
    F.gap(1).h2('8.4 คำเตือนจากการคำนวณ');
    r.warn.forEach((w, k) => F.p((k + 1) + '. ' + w, 2));
  }

  /* ★ ช่องลงนามต้องว่างเสมอ ระบบไม่มีสิทธิ์ลงชื่อแทนวิศวกรผู้รับผิดชอบ */
  F.gap(4).h2('8.5 ผู้รับผิดชอบ');
  F.need(34);
  const colW = (A4.w - MG.l - MG.r) / 3;
  const roles = ['ผู้ออกแบบ / คำนวณ', 'ผู้ตรวจสอบ', 'ผู้อนุมัติ'];
  const yT = F.y;
  roles.forEach((role, k) => {
    const x = MG.l + k * colW;
    F.E.push(line({ x: x + 4, y: yT - 16 }, { x: x + colW - 8, y: yT - 16 }, 'DIM', LY.BORDER));
    F.E.push(text({ x: x + colW / 2 - 2, y: yT - 20 }, role, 2.5, LY.TEXT, { align: 'C' }));
    F.E.push(text({ x: x + colW / 2 - 2, y: yT - 25 }, 'เลขที่ใบอนุญาต ______________', 2.2, LY.TEXT, { align: 'C' }));
    F.E.push(text({ x: x + colW / 2 - 2, y: yT - 30 }, 'วันที่ ______________', 2.2, LY.TEXT, { align: 'C' }));
  });
  F.y = yT - 34;
}

function sectionFinalSummary(F, r, projection, opt, verdict) {
  const compact = (dwg) => ({ ...dwg, entities: dwg.entities
    .filter(e => !(e.t === "text" && /รูปตัดขวาง A-A|ผังฐานราก|มาตราส่วน/.test(e.s)))
    .map(e => e.t === "leader" ? { ...e, h: 2.8,
      label: e.label.replace(/^(\S+)\s+(.+)$/, (all, mark) =>
        opt.quantityProjection.bbs.some(row => mark.replace(/\.$/, "") === row.mk) ? mark.replace(/\.$/, "") : all) }
      : ["level", "sectionMark"].includes(e.t) ? { ...e, textHeight: 2.8 }
      : e.t === "text" ? { ...e, h: Math.max(2.8, e.h) } : e) });
  const title = r.mode === "but" ? "กำแพงมีครีบ · ฐานแผ่" : r.gravity ? "กำแพงมวล" : "กำแพงยื่น · ฐานแผ่";
  const planSource = compact(retainingWallPlan(r, opt.spec));
  const widthDimensions = planSource.entities.filter(e => e.t === "dim" && e.vertical && e.chain === "width");
  const plan = scale => ({ ...planSource, entities: planSource.entities.map(e => {
    // Short wall-thickness dimensions need a separate paper lane. Keep the
    // measured endpoints, independent of the chosen view scale.
    if (e.t !== "dim" || !e.vertical || !["width", "width:total"].includes(e.chain)) return e;
    const lane = e.chain === "width:total" ? 11 + 7 * widthDimensions.length : 11 + 7 * widthDimensions.indexOf(e);
    return { ...e, off: -lane * scale };
  }) });
  const cad = buildA4CadSheets({
    info: { type: r.mode === "but" ? "counterfort" : r.gravity ? "gravity" : "cantilever",
      title, project: opt.info?.project || "", profile: opt.code || "โปรไฟล์ตามผลคำนวณ",
      stamp: "ENGINE_RESULT_PROJECTION_ONLY", status: verdict.pass ? "PASS" : "FAIL",
      statusLabel: "ENGINE VERDICT " + (verdict.pass ? "PASS" : "FAIL") + " · FAILED " + verdict.failedCount + " · " + verdict.statement,
      authority: opt.authority.label, ...(F.units.mode==='kgf'?{forceUnits:'kgf · kgf·m · kgf/m² · สมการ SI'}:{}), notes: [opt.authority.reason, opt.rebarGeometryHold.label,
        "ฐานรับแรงกดกระจายจากดิน · ไม่สมมติเป็นจุด pin/fixed · ภาพออกแบบ ไม่ใช่รายการตัดดัด"] },
    plan, section: compact(retainingWallSection(r)),
    rows: opt.quantityProjection.bbs.map(row => ({mark:row.mk, position:plain(row.pos),
      size:barName(r.i.fy,row.size), detail:plain(row.detail)})),
    summaryRows: projection.members.map(member => ({label:member.label, steel:member.governingSteel.selected,
      dc:f(member.maxDesignUtilization.dc,3)})),
  });
  F.cadPages = new Map();
  for (const sheet of cad) {
    F.pageBreak(); F.E.push(...sheet.entities); F.cadPages.set(F.E, sheet.meta);
  }
}

/**
 * สร้างรายการคำนวณเป็นหน้า A4
 *
 * @param {object} r       ผลจาก designRetainingWall()
 * @param {Array}  checks  ผลจาก checksFor(r)
 * @param {object} [opt]
 * @param {object} [opt.quantityProjection] Snapshot projection สำหรับ BBS/steelKg/totalLen
 * @param {object} [opt.forceDesign]        Snapshot projection สำหรับ SFD/BMD/D/C/เหล็กอัตโนมัติ
 * @param {object} [opt.verdict]            คำตัดสิน immutable จาก Snapshot
 * @param {object} [opt.authority]          อำนาจเอกสาร immutable จาก Snapshot
 * @param {object} [opt.rebarGeometryHold]  สถานะมาร์ค ⑧ immutable จาก Snapshot
 * @param {object} [opt.spec]      ผลจาก constructionSpec(r)
 * @param {string} [opt.code]      ชื่อโปรไฟล์มาตรฐานที่ใช้
 * @param {Array}  [opt.evidence]  สายหลักฐานของโปรไฟล์
 * @param {object} [opt.info]      ชื่อโครงการ/ชื่อเอกสาร — ช่องที่ระบุตัวบุคคลต้องเว้นว่าง
 * @returns {Array} drawing หนึ่งตัวต่อหนึ่งหน้า A4
 */
export function retainingWallReport(r, checks, opt = {}) {
  if (!r || !r.i) throw new TypeError('retainingWallReport: ต้องส่งผลคำนวณ');
  if (!Array.isArray(checks) || !checks.length) {
    throw new TypeError('retainingWallReport: ต้องส่งรายการตรวจสอบจาก checksFor()');
  }
  const quantityProjection = requireQuantityProjection(r, opt.quantityProjection);
  const forceDesign = requireForceDesignProjection(opt.forceDesign);
  const verdict = requireVerdict(checks, opt.verdict);
  const recovery = requireRecoveryProjection(checks, opt.recovery);
  const authority = requireAuthority(r, opt.authority);
  const engineeringCoverage = requireEngineeringCoverage(opt.engineeringCoverage);
  const rebarGeometryHold = requireRebarGeometryHold(opt.rebarGeometryHold);
  requireCounterfortReport(r, quantityProjection.bbs);
  const info = opt.info || {};
  const unitMode = opt.unitMode ?? 'si';
  const essential=opt.layout==='essential';
  const F = essential?new EssentialFlow(info,unitMode):new Flow(info, unitMode);
  F.method=opt.equationLedger?.method;

  if(essential)sectionEssentialInput(F,r,opt);else sectionInput(F, r, opt);
  sectionForceDesign(F, r, forceDesign);
  const displayChecks = legacyDisplayedChecks({result:r, checks}, unitMode);
  if(!essential){sectionChecks(F, displayChecks, verdict, engineeringCoverage, recovery);sectionEvidence(F, opt);}
  sectionStability(F, r, checks);
  if(essential)sectionEssentialDesign(F,r,checks,opt);else sectionSection(F, r, checks, quantityProjection, displayChecks);
  if(essential){
    F.flushEquations();
    if(F.y<150)F.pageBreak();
    sectionChecks(F, displayChecks, verdict, engineeringCoverage, recovery);
    F.gap(2).h2('ขอบเขตผลคำนวณ');
    F.p('มาตรฐาน: '+(opt.code||'—')+' · สมการ/ค่าแทนใช้ SI · กำลังและผลตรวจจาก Engine ชุดเดียวกัน');
    F.p('ผ่านเฉพาะทะเบียนตรวจที่แสดง; รอยต่อ/ระยะยึดเต็มระบบและข้อมูลดินต้องยืนยัน · NOT FOR CONSTRUCTION');
    for(const note of [...new Set(opt.equationLedger.components.map(c=>c.note).filter(Boolean))])F.p(note);
  }else{sectionQty(F, r, quantityProjection);sectionNotes(F, r, opt.spec);sectionEquationLedger(F,opt.equationLedger);}
  sectionFinalSummary(F, r, forceDesign, opt, verdict);

  const total = F.pages.length;
  /* Backward-compatible empty field: renderer ไม่รันสมการตรวจซ้ำอีกแล้ว
     ตัวเลขทุกตัวเป็น projection จาก Engine Snapshot เท่านั้น */
  const mismatch = [];
  return F.pages.map((E, k) => {
    if (!F.cadPages.has(E)) pageFurniture(E, info, verdict, authority, engineeringCoverage, rebarGeometryHold, k + 1, total, unitMode);
    else E.push(text({x:191,y:81}, "หน้า " + (k+1) + " / " + total, 2.8, LY.TEXT, {align:"R"}));
    /* ★ รายการคำนวณคือเอกสารที่ยื่นขออนุญาต ถ้าเนื้อหาล้นออกนอกกรอบพิมพ์
       ตัวแปลงเป็นภาพจะครอบตัดทิ้งเงียบ ๆ แล้วผู้ตรวจจะไม่มีทางรู้ว่าอ่านไม่ครบ
       จึงต้องวัดด้วยไม้บรรทัดตัวเดียวกับงานเขียนแบบ แล้วรายงานออกมาให้ชั้นบนตรวจได้ */
    const box = drawnBoxOf(E, 1);
    const violations = [];
    if (box.min.x < MG.l - 0.5) violations.push({ side: 'left', mm: MG.l - box.min.x });
    if (box.max.x > A4.w - MG.r + 0.5) violations.push({ side: 'right', mm: box.max.x - (A4.w - MG.r) });
    if (box.min.y < 2) violations.push({ side: 'bottom', mm: 2 - box.min.y });
    if (box.max.y > A4.h - 2) violations.push({ side: 'top', mm: box.max.y - (A4.h - 2) });
    return drawing('RW-CALC-' + String(k + 1).padStart(2, '0'),
      'รายการคำนวณกำแพงกันดิน หน้า ' + (k + 1), E, {
        scale: 1, sheetW: A4.w, sheetH: A4.h, page: k + 1, pages: total,
        margins: { ...MG }, mismatch, calculationAuthority: 'ENGINE_RESULT_PROJECTION_ONLY',
        rendererRecomputed: false, contentBox: box, violations,
        overflow: violations.length > 0, verdict, authority, engineeringCoverage, rebarGeometryHold,
        ...(essential?{reportLayout:ESSENTIAL_REPORT_VERSION,reportOrder:['loads','fbd','diagrams','equations','checks','final-section']}:{}),
        ...F.cadPages.get(E), finalSectionSummary: k === total - 1,
        ...(unitMode==='kgf' ? {displayUnitMode:'kgf', equationBasis:'si'} : {}),
      });
  });
}

/** ขอบกระดาษที่ใช้ — ให้ตัวทดสอบและตัวพิมพ์อ้างค่าเดียวกับที่วางจริง */
export const REPORT_MARGIN = Object.freeze({ ...MG });
export const REPORT_TEXT_W = TEXT_W;
export { plain as stripMarkup };
