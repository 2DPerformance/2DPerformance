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
import { line, poly, text, drawing } from './cadPrimitives.js';
import { SHEET, TITLE_BLOCK, BAR_GRADES, barName } from './draftingStandard.js';
import { wrapText, TEXT_W } from './sheetComposer.js';
import { drawnBoxOf } from './extentGeometry.js';
import { RW_REBAR_GEOMETRY_HOLD } from '../authorityContracts.mjs';

const LY = { TEXT: 'RW-TEXT', TABLE: 'RW-TABLE', BORDER: 'RW-BORDER' };

/* รายการคำนวณใช้ A4 แนวตั้ง ต่างจากแผ่นเขียนแบบที่เป็นแนวนอน */
const A4 = SHEET.A4P;
const MG = { l: 20, r: 15, t: 16, b: 18 };          // ขอบ — ซ้ายกว้างกว่าไว้เย็บเล่ม
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
  if (r.mode === 'but' && (authority.status !== 'PE_HOLD'
    || !authority.label.includes('PE HOLD') || !authority.reason.includes('PE HOLD'))) {
    throw new TypeError('retainingWallReport: counterfort ต้องคง authority เป็น PE HOLD');
  }
  return authority;
}

function requireEngineeringCoverage(coverage) {
  if (!coverage || coverage.releaseAuthority !== false
      || coverage.status !== 'HOLD_MISSING_SHEAR_TOE'
      || !Array.isArray(coverage.excludedChecks)
      || !coverage.excludedChecks.includes('SHEAR-TOE')
      || typeof coverage.label !== 'string' || !coverage.label.trim()) {
    throw new TypeError('retainingWallReport: engineering coverage ต้อง HOLD_MISSING_SHEAR_TOE แบบ fail-closed');
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
  constructor(info) {
    this.info = info || {};
    this.pages = [];
    this.W = A4.w - MG.l - MG.r;
    this.newPage();
  }

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
    this.need(LINE_PITCH * (ref ? 4 : 3.2));
    const xF = MG.l + 26;
    this.E.push(text({ x: MG.l + 4, y: this.y }, name, H_BODY, LY.TEXT, { bold: true }));
    this.E.push(text({ x: xF, y: this.y }, '= ' + symbol, H_BODY, LY.TEXT));
    this.y -= LINE_PITCH;
    this.E.push(text({ x: xF, y: this.y }, '= ' + sub, H_BODY, LY.TEXT));
    this.E.push(text({ x: MG.l + this.W, y: this.y }, f(eng, dec) + (unit ? ' ' + unit : ''),
      H_BODY, LY.TEXT, { align: 'R', bold: true }));
    this.y -= LINE_PITCH;
    if (ref) {
      this.E.push(text({ x: xF, y: this.y }, ref, 2.2, LY.TEXT));
      this.y -= LINE_PITCH - 1.0;
    }

    this.y -= 1.4;
    return this;
  }

  /** คู่ ชื่อ–ค่า สองคอลัมน์ต่อบรรทัด */
  kv(pairs) {
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
  table(cols, rows) {
    const cellH = 2.5;
    const pitch = 4.0;
    const padX = 1.6;
    const headH = 6.2;
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
      cols.forEach((c) => {
        const x = c.align === 'R' ? cx + c.w - padX : c.align === 'C' ? cx + c.w / 2 : cx + padX;
        this.E.push(text({ x, y: yT - headH / 2 }, c.th, cellH, LY.TEXT,
          { align: c.align === 'R' ? 'MR' : c.align === 'C' ? 'MC' : 'ML', bold: true }));
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

/* ── หัวและท้ายกระดาษ ───────────────────────────────────────── */
function pageFurniture(E, info, verdict, authority, engineeringCoverage, rebarGeometryHold, k, total) {
  const yH = A4.h - MG.t + 6;
  E.push(text({ x: MG.l, y: yH }, info.title || 'รายการคำนวณกำแพงกันดิน คสล.',
    2.5, LY.TEXT, { bold: true }));
  E.push(text({ x: A4.w - MG.r, y: yH }, 'โครงการ ' + (info.project || '—'), 2.5, LY.TEXT, { align: 'R' }));
  E.push(line({ x: MG.l, y: yH - 2.2 }, { x: A4.w - MG.r, y: yH - 2.2 }, 'DIM', LY.BORDER));

  const yF = MG.b - 6;
  E.push(line({ x: MG.l, y: yF + 3.4 }, { x: A4.w - MG.r, y: yF + 3.4 }, 'DIM', LY.BORDER));
  E.push(text({ x: MG.l, y: yF }, 'BETA · ' + TITLE_BLOCK.stamp, 2.5, LY.TEXT, { bold: true }));
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: yF }, 'แรง kN · โมเมนต์ kN·m · หน่วยแรง kPa · ระยะ เมตร (เว้นที่ระบุ)',
    2.2, LY.TEXT, { align: 'C' }));
  E.push(text({ x: A4.w - MG.r, y: yF }, 'หน้า ' + k + ' / ' + total, 2.5, LY.TEXT, { align: 'R' }));
  /* อำนาจเอกสารและคำตัดสินเป็นข้อมูล Snapshot — ต้องติดทุกหน้า แม้แยกหน้ากระดาษออกจากชุด */
  E.push(text({ x: MG.l, y: 11.1 }, authority.label, 1.6, LY.TEXT, { bold: true }));
  E.push(text({ x: A4.w - MG.r, y: 11.1 }, authority.reason, 1.6, LY.TEXT, { align: 'R' }));
  const verdictLabel = 'ENGINE VERDICT ' + (verdict.pass ? 'PASS' : 'FAIL')
    + ' · FAILED ' + verdict.failedCount + ' · ' + verdict.statement;
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 7.3 }, verdictLabel,
    1.6, LY.TEXT, { align: 'C', bold: true }));
  E.push(text({ x: (MG.l + A4.w - MG.r) / 2, y: 3.6 }, rebarGeometryHold.label,
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
      : r.mode === 'but' ? 'กำแพงมีครีบ (Counterfort · PE HOLD)'
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
    ['หน่วยน้ำหนักดินถม (ชื้น) γ', f(r.i.gs, 2) + ' kN/ม³'],
    ['หน่วยน้ำหนักดินถม (อิ่มตัว) γ_sat', f(r.i.gsat, 2) + ' kN/ม³'],
    ['มุมเสียดทานภายใน φ', f(r.i.phi, 1) + ' องศา'],
    ['แรงยึดเกาะ c', f(r.i.c, 2) + ' kPa'],
    ['ความชันหลังกำแพง β', f(r.beta, 1) + ' องศา'],
    ['น้ำหนักจรบนผิวดิน q', f(r.i.q, 2) + ' kPa'],
    ['ระดับน้ำใต้ดิน z_w', zwTxt],
    ['สัมประสิทธิ์เสียดทานใต้ฐาน μ', f(r.i.mu, 2)],
    ['ระดับฝังฐาน D_f', f(r.i.Df, 2) + ' ม.'],
    ['ความลึก shear key', r.i.dk > 0 ? f(r.i.dk, 2) + ' ม.' : 'ไม่มี'],
    ['สัมประสิทธิ์แรงดันเชิงรุก Ka', f(r.Ka, 4)],
    ['สัมประสิทธิ์แรงดันเชิงรับ Kp', f(r.Kp, 4)],
  ]);

  F.gap(2).h2('1.4 วัสดุ');
  F.kv([
    ['กำลังอัดคอนกรีต f′c', f(r.i.fc, 0) + ' MPa'],
    ['กำลังครากเหล็ก f_y', f(r.i.fy, 0) + ' MPa'],
    ['ชั้นคุณภาพเหล็ก', (BAR_GRADES[r.i.fy] && BAR_GRADES[r.i.fy].label) || '—'],
    ['ระยะหุ้มคอนกรีต (พนัง)', f(r.i.cov, 0) + ' มม.'],
  ]);
}

function sectionChecks(F, checks, verdict, engineeringCoverage) {
  F.gap(3).h1('2 · สรุปผลตรวจสอบ');

  /* canonical verdict ยังไม่ครอบคลุม SHEAR-TOE — ห้ามแสดง PASS เดี่ยว ๆ */
  F.callout([
    engineeringCoverage.label,
    verdict.pass
      ? 'REGISTERED CHECKS PASS — ผ่านเฉพาะรายการที่ Engine ลงทะเบียน ไม่ใช่ผลอนุมัติทั้งระบบ'
      : verdict.statement,
    ...(!verdict.pass ? [
      'รายการที่ไม่ผ่าน: ' + verdict.failed.map((c) => plain(c.k)).join(' · '),
      'ต้องแก้ไขหน้าตัดหรือเงื่อนไขดิน แล้วคำนวณใหม่ทั้งชุดก่อนนำไปใช้',
    ] : []),
  ]);

  F.table([
    { th: 'รายการตรวจสอบ', w: 52, align: 'L' },
    { th: 'ค่าที่ได้', w: 28, align: 'R' },
    { th: 'เกณฑ์ยอมรับ', w: 62, align: 'L' },
    { th: 'อัตราส่วนใช้งาน', w: 22, align: 'R' },
    { th: 'ผล', w: 11, align: 'C' },
  ], checks.map((c) => ({
    cells: [plain(c.k), plain(c.v), plain(c.req), Number.isFinite(c.u) ? f(c.u, 2) : '—',
      c.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    bold: !c.ok,
  })));

  if (verdict.pass) F.p('REGISTERED CHECKS PASS · ENGINE COVERAGE HOLD · NOT FOR CONSTRUCTION');
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
  F.h1('3 · มาตรฐาน ข้อกำหนด และสมการที่ระบบรันจริง');
  F.p('รายการนี้คือสิ่งที่ระบบใช้คำนวณจริงในชุดผลนี้ ไม่ใช่รายการอ้างอิงทั่วไป '
    + 'ผู้ตรวจสามารถไล่จากสมการในหัวข้อถัดไปกลับมาที่ข้อกำหนดตรงนี้ได้');
  F.gap(1.5);
  for (const e of list) F.p('· ' + plain(e), 4);
}

function sectionStability(F, r, checks) {
  const i = r.i;
  const overturningCheck = requireRegisteredCheck(checks, 'F.S. OVERTURNING');
  const slidingCheck = requireRegisteredCheck(checks, 'F.S. SLIDING');
  F.gap(3).h1('4 · แรงดันดินและเสถียรภาพ');

  F.h2('4.1 สัมประสิทธิ์แรงดันดินเชิงรุก');
  if (r.earthMethod === 'Rankine' && r.beta === 0) {
    F.worked('K_a', 'tan²(45° − φ/2)',
      'φ = ' + f(i.phi, 1) + '° · β = ' + f(r.beta, 1) + '°', r.Ka, '', 4,
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

  F.gap(1).h2('4.2 แรงดันดินและแรงดันน้ำ');
  F.worked('P_a', '∫₀^Hq max[K_a(σ′_v(z)+q) − 2c√K_a, 0] · C_h dz',
    'K_a = ' + f(r.Ka, 4) + ' · H_q = ' + f(r.Hq, 3) + ' ม. · d_1/d_2 = '
      + f(r.d1, 3) + '/' + f(r.d2, 3) + ' ม. · γ/γ_sat = ' + f(i.gs, 2) + '/' + f(i.gsat, 2)
      + ' kN/ม³ · q = ' + f(i.q, 2) + ' kPa · c = ' + f(r.cc, 2) + ' kPa',
    r.Phs, 'kN/ม.', 2, 'ผลรวมจาก Engine pressure integration ต่อความยาวกำแพง 1 ม.');

  F.worked('P_w', '∫γ_w(z−d_1) dz เฉพาช่วงใต้ระดับน้ำ',
    'γ_w = 9.81 kN/ม³ · H_q = ' + f(r.Hq, 3) + ' ม. · d_1 = ' + f(r.d1, 3) + ' ม.',
    r.Pw, 'kN/ม.', 2, 'แรงดันน้ำสถิตจาก Engine pressure integration');

  F.worked('P_h', 'P_a + P_w',
    'P_a = ' + f(r.Phs, 2) + ' และ P_w = ' + f(r.Pw, 2) + ' kN/ม.', r.Ph, 'kN/ม.', 2);
  if (r.Pv) {
    F.eq('P_v', 'องค์ประกอบแนวดิ่งของแรงดันดินเมื่อหลังกำแพงลาดเอียง', f(r.Pv, 2) + ' kN/ม.');
  }

  F.worked('M_o', '∫(p_s+p_w)y dz',
    'P_h = ' + f(r.Ph, 2) + ' kN/ม. · ȳ = ' + f(r.ybar, 3) + ' ม. เหนือท้องฐาน',
    r.Mo, 'kN·m/ม.', 2, 'โมเมนต์แรงดันจาก Engine integration รอบปลาย toe');

  F.gap(1).h2('4.3 น้ำหนักต้านทานและโมเมนต์ยึด');
  const wRows = (r.W || []).map((w) => [plain(w.n), f(w.v, 2), f(w.x, 3), '—', w.st ? 'คิด' : 'ไม่คิด']);
  F.table([
    { th: 'ส่วนที่คิดน้ำหนัก', w: 78, align: 'L' },
    { th: 'น้ำหนัก (kN)', w: 26, align: 'R' },
    { th: 'แขน x (ม.)', w: 24, align: 'R' },
    { th: 'โมเมนต์จาก Engine', w: 30, align: 'R' },
    { th: 'สถานะ', w: 17, align: 'C' },
  ], wRows.concat([{ cells: ['Engine totals', f(r.SVs, 2), '', f(r.SMs, 2), 'authoritative'], bold: true }]));

  F.h2('4.4 เสถียรภาพการพลิกคว่ำและการเลื่อนไถล');
  F.worked('F.S._พลิกคว่ำ', 'ΣM_ต้าน / M_o,รวมแรงยก',
    'ΣM_ต้าน = ' + f(r.SMs, 2) + ' · M_o,รวมแรงยก = ' + f(r.MoT, 2) + ' kN·m/ม.', r.FSot, '', 2,
    overturningCheck.req);

  F.worked('F.S._เลื่อนไถล', '(R_เสียดทาน + R_ยึดเกาะ + P_p) / P_h',
    'R_f = ' + f(r.slideFric, 2) + ' · R_a = ' + f(r.slideAdh, 2) + ' · P_p = '
      + f(r.PpAll, 2) + ' · P_h = ' + f(r.Ph, 2) + ' kN/ม.', r.FSsl, '', 2,
    slidingCheck.req);

  F.gap(1).h2('4.5 ตำแหน่งแรงลัพธ์และแรงกดใต้ฐาน');
  F.worked('x̄', '(ΣM_ฐาน − M_o,รวมแรงยก) / V_b',
    'ΣM_ฐาน = ' + f(r.SMb, 2) + ' · M_o,รวมแรงยก = ' + f(r.MoT, 2)
      + ' kN·m/ม. · V_b = ' + f(r.Vb, 2) + ' kN/ม.', r.xbar, 'ม.', 3, 'วัดจากปลาย toe');
  F.worked('e', 'B/2 − x̄',
    'B = ' + f(i.B, 3) + ' ม. · x̄ = ' + f(r.xbar, 3) + ' ม.', r.e, 'ม.', 3,
    'เกณฑ์ e ≤ B/6 = ' + f(r.kern, 3) + ' ม. (แรงลัพธ์อยู่ในหนึ่งส่วนสามกลางฐาน)');
  const bearingSymbol = 'Engine bearing distribution: V_b/B·(1±6e/B) ใน middle third; รูปสามเหลี่ยมเมื่อเกิน kern';
  const bearingSub = 'V_b = ' + f(r.Vb, 2) + ' kN/ม. · B = ' + f(i.B, 3) + ' ม. · e = '
    + f(r.e, 3) + ' ม. · x̄ = ' + f(r.xbar, 3) + ' ม. · kern = ' + f(r.kern, 3) + ' ม.';
  F.worked('q_max', bearingSymbol, bearingSub, r.q1, 'kPa', 2);
  F.worked('q_min', bearingSymbol, bearingSub, r.q2, 'kPa', 2);
  F.eq('q_a', 'กำลังแบกทานยอมให้ที่ใช้ในการตรวจสอบ', f(r.qaUse, 2) + ' kPa');
}

function sectionSection(F, r, checks, quantityProjection) {
  F.gap(3).h1('5 · ออกแบบหน้าตัดและเหล็กเสริม');

  if (r.mode === 'but') {
    /* กำแพงมีครีบ — พนังพาดราบระหว่างครีบ ออกแบบเป็นแถบ (r.strips) ไม่ใช่คานยื่น (stemTab) */
    F.h2('5.1 พนังพาดราบระหว่างครีบ — แถบตามความลึก (M=w·L²/12 ที่ครีบ · w·L²/16 กลางช่วง)');
    F.table([
      { th: 'แถบ z (ม.)', w: 28, align: 'R' },
      { th: 'w_u (kN/ม²)', w: 24, align: 'R' },
      { th: 'M ที่ครีบ (kN·m)', w: 28, align: 'R' },
      { th: 'M กลางช่วง (kN·m)', w: 28, align: 'R' },
      { th: 'เหล็กหน้าดิน', w: 24, align: 'L' },
      { th: 'เหล็กหน้านอก', w: 24, align: 'L' },
    ], r.strips.map((s) => ({
      cells: [f(s.z1, 1) + '–' + f(s.z2, 1), f(s.wu, 1), f(s.Mn_, 1), f(s.Mn$, 1),
        s.b_.txt, s.b$.txt],
      bold: !!s.bad,
    })));
    const bu = r.but, fcB = bu.finCut;
    const byMark = new Map(quantityProjection.bbs.map((b) => [b.mk, b]));
    const row6 = byMark.get('⑥'), row6b = byMark.get('⑥b');
    const row7a = byMark.get('⑦a'), row7b = byMark.get('⑦b');
    F.h2('5.1ข ครีบยึด (COUNTERFORT)');
    F.kv([
      ['จำนวนครีบ', r.qty.nBut + ' ตัว @ c/c ' + f(r.Lt, 2) + ' ม. (ช่วงว่าง ' + f(r.i.L, 2) + ' ม.)'],
      ['หน้าตัดครีบ', f(r.i.bs, 2) + ' × ' + f(r.cfLr, 2) + ' ม. · สูง ' + f(r.cfHr, 2) + ' ม.'],
      ['M_u ครีบ', f(bu.MuB, 1) + ' kN·m · As = ' + f(bu.AsB, 0) + ' มม²'],
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
  F.h2('5.1 พนัง (STEM) ตามความลึก');
  F.table([
    { th: 'ระดับ z จากยอด (ม.)', w: 30, align: 'R' },
    { th: 'ความหนา (ม.)', w: 24, align: 'R' },
    { th: 'd (ม.)', w: 20, align: 'R' },
    { th: 'M_u (kN·m)', w: 26, align: 'R' },
    { th: 'V_u (kN)', w: 22, align: 'R' },
    { th: 'As ต้องการ (มม²)', w: 28, align: 'R' },
    { th: 'เหล็กที่ใช้', w: 25, align: 'L' },
  ], (r.stemTab || []).map((s) => ({
    cells: [f(s.z, 2), f(s.th, 3), f(s.d, 3), f(s.Mu, 2), f(s.Vu, 2), f(s.As, 0),
      s.bar ? s.bar.txt : '—'],
    bold: !!s.bad,
  })));
  }

  F.h2('5.2 ฐานราก');
  F.table([
    { th: 'ส่วน', w: 40, align: 'L' },
    { th: 'M_u (kN·m)', w: 30, align: 'R' },
    { th: 'As ต้องการ (มม²)', w: 32, align: 'R' },
    { th: 'เหล็กที่ใช้', w: 32, align: 'L' },
    { th: 'As ที่ได้ (มม²)', w: 31, align: 'R' },
  ], [
    ['heel — เหล็กบน', f(r.MH_, 2), f(r.AsH_, 0), r.barH_ ? r.barH_.txt : '—',
      r.barH_ ? f(r.barH_.prov, 0) : '—'],
    ['heel — เหล็กล่าง', f(r.MH$, 2), f(r.AsH$, 0), r.barH$ ? r.barH$.txt : '—',
      r.barH$ ? f(r.barH$.prov, 0) : '—'],
    ['toe — เหล็กล่าง', f(r.MT, 2), f(r.AsT, 0), r.barT ? r.barT.txt : '—',
      r.barT ? f(r.barT.prov, 0) : '—'],
  ]);

  F.h2('5.3 ความลึกประสิทธิผลและกำลังรับแรงเฉือน');
  const dStem = (r.stemTab && r.stemTab.length) ? r.stemTab[r.stemTab.length - 1].d : null;
  const stemShear = requireRegisteredCheck(checks, 'SHEAR — STEM');
  const heelShear = requireRegisteredCheck(checks, 'SHEAR — HEEL');
  if (Number.isFinite(dStem)) {
    F.worked('d (พนัง)', 't − ระยะหุ้ม − d_b/2',
      't = ' + f(r.i.t, 3) + ' ม. · ระยะหุ้ม = ' + f(r.i.cov, 0) + ' มม. · d_b = ' + f(r.i.db, 0) + ' มม.',
      dStem, 'ม.', 3,
      'ระยะหุ้มพนัง ' + f(r.i.cov, 0) + ' มม. · เหล็ก ' + barName(r.i.fy, r.i.db));
  }
  F.worked('d (ฐาน)', 'h_z − ระยะหุ้ม − d_b/2',
    'h_z = ' + f(r.i.hz, 3) + ' ม. · ระยะหุ้ม = 75 มม. · d_b = ' + f(r.i.db, 0) + ' มม.',
    r.dH, 'ม.', 3,
    'ระยะหุ้มฐานรากที่หล่อติดดิน 75 มม.');

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
  F.table([
    { th: 'หน้าตัดวิกฤต', w: 52, align: 'L' },
    { th: 'ค่า Engine', w: 34, align: 'R' },
    { th: 'เกณฑ์ Engine', w: 34, align: 'R' },
    { th: 'V_u / φV_c', w: 28, align: 'R' },
    { th: 'ผล', w: 27, align: 'C' },
  ], [
    ['พนังที่ระยะ d จากโคน', stemShear.v, stemShear.req, f(stemShear.u, 2),
      stemShear.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    ['heel ที่หน้าพนัง', heelShear.v, heelShear.req, f(heelShear.u, 2),
      heelShear.ok ? 'ผ่าน' : 'ไม่ผ่าน'],
    ['toe ที่หน้าพนัง · ENGINE CHECK NOT REGISTERED', f(r.VuT, 2), f(r.phiVcT, 2), '—',
      'NOT EVALUATED'],
  ]);
  F.p('SHEAR-TOE · NOT EVALUATED · ENGINE CHECK NOT REGISTERED · ห้ามอนุมาน PASS/FAIL ในรายงาน');
}

function sectionQty(F, r, quantityProjection) {
  F.gap(3).h1('6 · ปริมาณวัสดุและตารางเหล็ก');

  const q = r.qty || {};
  F.kv([
    ['คอนกรีตต่อความยาว 1 ม.', f(q.conc, 3) + ' ม³'],
    ['คอนกรีตทั้งกำแพง', f(q.concTot, 2) + ' ม³'],
    ['แบบหล่อ', f(q.form, 2) + ' ม²'],
    ['คอนกรีตหยาบ', f(q.lean, 2) + ' ม³'],
    ['เหล็กเสริมรวม (รวมเผื่อทาบ/สูญเสีย 8%)', f(quantityProjection.steelKg, 0) + ' กก.'],
    ['เข็มที่ใช้', r.onPile && q.nPile ? String(q.nPile) + ' ต้น' : 'ไม่ใช้เข็ม'],
  ]);

  F.gap(2).h2('6.1 ตารางเหล็กเสริม');
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

function sectionNotes(F, r, spec) {
  F.gap(3).h1('7 · ข้อกำหนดก่อสร้างและคำเตือน');

  if (spec) {
    F.h2('7.1 ข้อกำหนดการเทและรอยต่อ');
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
    F.gap(1).h2('7.2 ความคลาดเคลื่อนที่ยอมให้');
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
    F.gap(1).h2('7.3 ผลตรวจข้อกำหนดก่อสร้าง');
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
    F.gap(1).h2('7.4 คำเตือนจากการคำนวณ');
    r.warn.forEach((w, k) => F.p((k + 1) + '. ' + w, 2));
  }

  /* ★ ช่องลงนามต้องว่างเสมอ ระบบไม่มีสิทธิ์ลงชื่อแทนวิศวกรผู้รับผิดชอบ */
  F.gap(4).h2('7.5 ผู้รับผิดชอบ');
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

/**
 * สร้างรายการคำนวณเป็นหน้า A4
 *
 * @param {object} r       ผลจาก designRetainingWall()
 * @param {Array}  checks  ผลจาก checksFor(r)
 * @param {object} [opt]
 * @param {object} [opt.quantityProjection] Snapshot projection สำหรับ BBS/steelKg/totalLen
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
  const verdict = requireVerdict(checks, opt.verdict);
  const authority = requireAuthority(r, opt.authority);
  const engineeringCoverage = requireEngineeringCoverage(opt.engineeringCoverage);
  const rebarGeometryHold = requireRebarGeometryHold(opt.rebarGeometryHold);
  requireCounterfortReport(r, quantityProjection.bbs);
  const info = opt.info || {};
  const F = new Flow(info);

  sectionInput(F, r, opt);
  sectionChecks(F, checks, verdict, engineeringCoverage);
  sectionEvidence(F, opt);
  sectionStability(F, r, checks);
  sectionSection(F, r, checks, quantityProjection);
  sectionQty(F, r, quantityProjection);
  sectionNotes(F, r, opt.spec);

  const total = F.pages.length;
  /* Backward-compatible empty field: renderer ไม่รันสมการตรวจซ้ำอีกแล้ว
     ตัวเลขทุกตัวเป็น projection จาก Engine Snapshot เท่านั้น */
  const mismatch = [];
  return F.pages.map((E, k) => {
    pageFurniture(E, info, verdict, authority, engineeringCoverage, rebarGeometryHold, k + 1, total);
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
      });
  });
}

/** ขอบกระดาษที่ใช้ — ให้ตัวทดสอบและตัวพิมพ์อ้างค่าเดียวกับที่วางจริง */
export const REPORT_MARGIN = Object.freeze({ ...MG });
export const REPORT_TEXT_W = TEXT_W;
export { plain as stripMarkup };
