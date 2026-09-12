/**
 * ตัวแปลง primitive → DXF R2010 (AC1024)
 *
 * ใช้ primitive ชุดเดียวกับ SVG ทุกอย่าง ภาพใน AutoCAD จึงตรงกับภาพบนจอโดยโครงสร้าง
 * ไม่ใช่โดยความบังเอิญ (สัญญาข้อ 3 ของชั้นเขียนแบบ)
 *
 * ระบบพิกัด
 *   DXF แกน y ชี้ขึ้นเหมือนโมเดล จึงไม่ต้องพลิกแกนเหมือนตอนทำ SVG
 *   หน่วยไฟล์เป็นมิลลิเมตร ($INSUNITS = 4)
 *   ความสูงตัวอักษรและระยะของลายเป็น "มิลลิเมตรบนกระดาษ" จึงคูณด้วยมาตราส่วนก่อนเขียนลงไฟล์
 *
 * การจัด layer
 *   หนึ่ง layer ต่อหนึ่ง projection class — สี ชนิดเส้น และน้ำหนักเส้นตั้งไว้ที่ layer
 *   ตามธรรมเนียม CAD ที่ถูกต้อง (ByLayer) ไม่ใช่ตั้งทับรายชิ้น
 *   คนเปิดแบบจึงปิดเส้นบอกระยะหรือเพิ่มน้ำหนักเส้นตัดได้ทั้งชุดในคลิกเดียว
 *
 * ข้อจำกัดที่ยอมรับไว้ในรุ่นแรก และเหตุผล
 *   1. ลายหน้าตัดถูกแตกเป็นเส้นจริง ไม่ได้เขียนเป็น HATCH entity
 *      เพราะ HATCH ที่นิยามผิดจะเพี้ยนเงียบ ๆ ในโปรแกรมปลายทาง
 *      ส่วนเส้นจริงนั้นเปิดที่ไหนก็เหมือนกัน — แลกด้วยขนาดไฟล์ที่ใหญ่ขึ้น
 *   2. ตัวเลขบอกระยะเขียนเป็นข้อความกำกับ (text override) ในเส้นบอกระยะจริง
 *      เพื่อรับประกันว่าตัวเลขใน CAD ตรงกับในแบบและในรายการคำนวณเสมอ
 *      แม้โปรแกรมปลายทางจะ regen ใหม่ด้วยสไตล์ของตัวเอง
 *   3. อ้างชื่อฟอนต์เท่านั้น ไม่ฝังไฟล์ฟอนต์ลงใน DXF (เรื่องลิขสิทธิ์ฟอนต์)
 */
import {
  LINE_STYLE, TEXT_HEIGHT, DIM_STYLE, SHEET_SCALE, paperToModel, dimTextIsTight, styleFor,
} from './draftingStandard.js';
import { dimLength } from './cadPrimitives.js';
import { hatchSegments } from './hatchGeometry.js';
import { drawnBoxOf } from './extentGeometry.js';

/** ชื่อ layer ใน DXF — ASCII ล้วน เพื่อให้เปิดได้ทุกโปรแกรม */
export const DXF_LAYER = Object.freeze(Object.fromEntries(
  Object.keys(LINE_STYLE).map((pc) => [pc, 'RW-' + pc])));

/** ชนิดเส้นที่ต้องประกาศในไฟล์ — [ชื่อ, คำอธิบาย, ความยาวรอบ, ช่วงขีด] หน่วยมิลลิเมตรบนกระดาษ */
const LTYPES = [
  ['CONTINUOUS', 'Solid line', 0, []],
  ['HIDDEN', 'Hidden __ __ __ __ __ __', 6, [4, -2]],
  ['CENTER', 'Center ____ _ ____ _ ____', 18, [12, -2, 2, -2]],
];

/** ตัวอักษร: อ้างชื่อไฟล์ฟอนต์เท่านั้น ไม่ฝังไฟล์ */
const DEFAULT_FONT = 'tahoma.ttf';           // มากับ Windows และมีอักขระไทยครบ
const DEFAULT_FONT_BOLD = 'tahomabd.ttf';

const STYLE_TEXT = 'RW-TEXT';
const STYLE_BOLD = 'RW-TEXT-B';
const DIMSTYLE = 'RW-ISO';

/** ตัวเลขในไฟล์ DXF — ทศนิยมคงที่ ผลลัพธ์จึงเท่ากันทุกครั้งที่เขียน */
const n = (v) => {
  if (!Number.isFinite(v)) throw new RangeError('dxfWriter: พบค่าที่ใช้ไม่ได้ในพิกัด (' + v + ')');
  const s = v.toFixed(4);
  return s === '-0.0000' ? '0.0000' : s;
};

/** DXF เก็บน้ำหนักเส้นเป็นหน่วย 1/100 มม. */
const lw = (mm) => Math.round(mm * 100);

/* ── ตัวเขียนไฟล์ ─────────────────────────────────────────────── */

class Dxf {
  constructor() {
    this.out = [];
    this.seed = 0x100;
  }

  /** คู่ (group code, value) — หัวใจของรูปแบบ DXF ทั้งไฟล์ */
  g(code, value) { this.out.push(String(code), String(value)); return this; }

  handle() { return (this.seed++).toString(16).toUpperCase(); }

  text() { return this.out.join('\n') + '\n'; }
}

/** จัดข้อความให้ปลอดภัยสำหรับ DXF — ตัดอักขระควบคุมที่ทำให้ไฟล์เสีย */
const safe = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/\^/g, '');

/**
 * แปลงรูปเป็นไฟล์ DXF
 *
 * @param {object} dwg  ผลจาก drawing() ใน cadPrimitives
 * @param {object} [opt]
 * @param {number} [opt.scale]  ส่วนหลังของ 1:N — ไม่ระบุจะใช้ meta.scale ของรูป แล้วจึง SHEET_SCALE
 * @param {string} [opt.font]   ชื่อไฟล์ฟอนต์ที่จะให้ CAD ปลายทางไปหาเอง
 * @returns {string} เนื้อไฟล์ DXF (เข้ารหัส UTF-8)
 */
export function toDxf(dwg, opt = {}) {
  if (!dwg || !Array.isArray(dwg.entities)) throw new TypeError('toDxf: ต้องส่งรูปที่มี entities');
  const scale = Number.isFinite(opt.scale) ? opt.scale
    : (Number.isFinite(dwg.meta && dwg.meta.scale) ? dwg.meta.scale : SHEET_SCALE[dwg.id]);
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('toDxf: ต้องระบุมาตราส่วนของรูป "' + dwg.id + '"');
  }
  const P = (paperMm) => paperToModel(paperMm, scale);
  const font = opt.font || DEFAULT_FONT;

  const d = new Dxf();
  /* ★ $EXTMIN/$EXTMAX ต้องมาจากไม้บรรทัดตัวเดียวกับที่ใช้จัดหน้า
     เดิมใช้ bboxOf ซึ่งมองไม่เห็นเส้นบอกระยะที่ระยะเยื้องและป้ายปลายเส้นชี้
     ผลคือใน AutoCAD สั่ง Zoom Extents หรือ Plot area = Extents แล้วป้ายถูกตัดหาย */
  const bb = drawnBoxOf(dwg.entities, scale);

  /* จองแฮนเดิลของตารางและบล็อกไว้ล่วงหน้า เพราะ entity ต้องอ้างเจ้าของ */
  const hTables = {};
  for (const k of ['VPORT', 'LTYPE', 'LAYER', 'STYLE', 'VIEW', 'UCS', 'APPID', 'DIMSTYLE', 'BLOCK_RECORD']) {
    hTables[k] = d.handle();
  }
  const hModelBR = d.handle();
  const hPaperBR = d.handle();

  /* เส้นบอกระยะแต่ละเส้นต้องมีบล็อกเรขาคณิตของตัวเอง — จองชื่อและแฮนเดิลไว้ก่อน */
  const dims = dwg.entities.filter((e) => e.t === 'dim');
  const dimBlocks = dims.map((e, k) => ({
    e, name: '*D' + (k + 1), hBlockRecord: d.handle(),
  }));

  /* ── HEADER ── */
  d.g(0, 'SECTION').g(2, 'HEADER');
  d.g(9, '$ACADVER').g(1, 'AC1024');
  d.g(9, '$HANDSEED').g(5, 'FFFF');
  d.g(9, '$INSUNITS').g(70, 4);                 // 4 = มิลลิเมตร
  d.g(9, '$MEASUREMENT').g(70, 1);              // 1 = ระบบเมตริก
  d.g(9, '$LUNITS').g(70, 2);
  d.g(9, '$LUPREC').g(70, 4);
  d.g(9, '$LTSCALE').g(40, n(P(1)));            // ลายเส้นประเป็นมิลลิเมตรบนกระดาษ
  d.g(9, '$PSLTSCALE').g(70, 0);
  d.g(9, '$CLAYER').g(8, '0');
  d.g(9, '$TEXTSTYLE').g(7, STYLE_TEXT);
  d.g(9, '$DIMSTYLE').g(2, DIMSTYLE);
  d.g(9, '$EXTMIN').g(10, n(bb.min.x)).g(20, n(bb.min.y)).g(30, n(0));
  d.g(9, '$EXTMAX').g(10, n(bb.max.x)).g(20, n(bb.max.y)).g(30, n(0));
  d.g(0, 'ENDSEC');

  /* ── TABLES ── */
  d.g(0, 'SECTION').g(2, 'TABLES');

  const openTable = (name, count) => {
    d.g(0, 'TABLE').g(2, name).g(5, hTables[name]).g(330, '0')
      .g(100, 'AcDbSymbolTable').g(70, count);
  };
  const record = (tableName, className, name) => {
    const h = d.handle();
    d.g(0, tableName).g(5, h).g(330, hTables[tableName])
      .g(100, 'AcDbSymbolTableRecord').g(100, className).g(2, name);
    return h;
  };

  openTable('VPORT', 1);
  d.g(0, 'VPORT').g(5, d.handle()).g(330, hTables.VPORT)
    .g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbViewportTableRecord').g(2, '*ACTIVE').g(70, 0)
    .g(10, '0.0').g(20, '0.0').g(11, '1.0').g(21, '1.0')
    .g(12, n((bb.min.x + bb.max.x) / 2)).g(22, n((bb.min.y + bb.max.y) / 2))
    .g(13, '0.0').g(23, '0.0').g(14, '10.0').g(24, '10.0').g(15, '0.0').g(25, '0.0')
    .g(16, '0.0').g(26, '0.0').g(36, '1.0').g(17, '0.0').g(27, '0.0').g(37, '0.0')
    .g(40, n(Math.max(1, bb.max.y - bb.min.y))).g(41, '1.5').g(42, '50.0').g(43, '0.0').g(44, '0.0')
    .g(50, '0.0').g(51, '0.0').g(71, 0).g(72, 100).g(73, 1).g(74, 3).g(75, 0).g(76, 0).g(77, 0).g(78, 0);
  d.g(0, 'ENDTAB');

  openTable('LTYPE', LTYPES.length + 2);
  for (const nameOnly of ['ByBlock', 'ByLayer']) {
    record('LTYPE', 'AcDbLinetypeTableRecord', nameOnly);
    d.g(70, 0).g(3, '').g(72, 65).g(73, 0).g(40, '0.0');
  }
  for (const [name, desc, total, dashes] of LTYPES) {
    record('LTYPE', 'AcDbLinetypeTableRecord', name);
    d.g(70, 0).g(3, desc).g(72, 65).g(73, dashes.length).g(40, n(P(total)));
    for (const dash of dashes) d.g(49, n(P(dash))).g(74, 0);
  }
  d.g(0, 'ENDTAB');

  /* หนึ่ง layer ต่อหนึ่ง projection class + layer 0 ที่ทุกไฟล์ต้องมี */
  const pcs = Object.keys(LINE_STYLE);
  openTable('LAYER', pcs.length + 1);
  record('LAYER', 'AcDbLayerTableRecord', '0');
  d.g(70, 0).g(62, 7).g(6, 'CONTINUOUS').g(370, lw(0.25));
  for (const pc of pcs) {
    const st = styleFor(pc);
    record('LAYER', 'AcDbLayerTableRecord', DXF_LAYER[pc]);
    d.g(70, 0).g(62, st.dxfColor).g(6, st.dxfLtype).g(370, lw(st.w));
  }
  d.g(0, 'ENDTAB');

  openTable('STYLE', 3);
  for (const [name, file] of [['Standard', font], [STYLE_TEXT, font], [STYLE_BOLD, opt.fontBold || DEFAULT_FONT_BOLD]]) {
    record('STYLE', 'AcDbTextStyleTableRecord', name);
    d.g(70, 0).g(40, '0.0').g(41, '1.0').g(50, '0.0').g(71, 0).g(42, n(P(TEXT_HEIGHT.SMALL)))
      .g(3, file).g(4, '');
  }
  d.g(0, 'ENDTAB');

  openTable('VIEW', 0); d.g(0, 'ENDTAB');
  openTable('UCS', 0); d.g(0, 'ENDTAB');

  openTable('APPID', 1);
  record('APPID', 'AcDbRegAppTableRecord', 'ACAD');
  d.g(70, 0);
  d.g(0, 'ENDTAB');

  openTable('DIMSTYLE', 1);
  {
    const h = d.handle();
    d.g(0, 'DIMSTYLE').g(105, h).g(330, hTables.DIMSTYLE)
      .g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbDimStyleTableRecord').g(2, DIMSTYLE).g(70, 0);
    d.g(40, '1.0')                                   // DIMSCALE — เขียนเรขาคณิตมาแล้วในหน่วยโมเดล
      .g(41, n(P(DIM_STYLE.tickLength)))             // DIMASZ
      .g(42, n(P(DIM_STYLE.extGap)))                 // DIMEXO
      .g(44, n(P(DIM_STYLE.extBeyond)))              // DIMEXE
      .g(140, n(P(DIM_STYLE.textHeight)))            // DIMTXT
      .g(147, n(P(DIM_STYLE.textGap)))               // DIMGAP
      .g(271, DIM_STYLE.decimals)                    // DIMDEC
      .g(73, 0).g(74, 0).g(77, 1)                    // ตัวเลขวางเหนือเส้น
      .g(176, 4).g(178, 7)                           // สีเส้นและตัวเลขตามชั้นเส้นบอกระยะ
      .g(340, hTables.STYLE);
  }
  d.g(0, 'ENDTAB');

  openTable('BLOCK_RECORD', 2 + dimBlocks.length);
  for (const [name, h] of [['*Model_Space', hModelBR], ['*Paper_Space', hPaperBR]]) {
    d.g(0, 'BLOCK_RECORD').g(5, h).g(330, hTables.BLOCK_RECORD)
      .g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, name).g(70, 0).g(280, 1).g(281, 0);
  }
  for (const b of dimBlocks) {
    d.g(0, 'BLOCK_RECORD').g(5, b.hBlockRecord).g(330, hTables.BLOCK_RECORD)
      .g(100, 'AcDbSymbolTableRecord').g(100, 'AcDbBlockTableRecord').g(2, b.name).g(70, 0).g(280, 1).g(281, 0);
  }
  d.g(0, 'ENDTAB');
  d.g(0, 'ENDSEC');

  /* ── ตัวช่วยเขียน entity ── */
  const ent = (type, layer, owner) => {
    d.g(0, type).g(5, d.handle()).g(330, owner)
      .g(100, 'AcDbEntity').g(8, layer);
  };

  const putLine = (a, b, pc, owner) => {
    ent('LINE', DXF_LAYER[pc], owner);
    d.g(100, 'AcDbLine')
      .g(10, n(a.x)).g(20, n(a.y)).g(30, '0.0')
      .g(11, n(b.x)).g(21, n(b.y)).g(31, '0.0');
  };

  const putPoly = (pts, pc, owner, closed) => {
    ent('LWPOLYLINE', DXF_LAYER[pc], owner);
    d.g(100, 'AcDbPolyline').g(90, pts.length).g(70, closed ? 1 : 0).g(43, '0.0');
    for (const p of pts) d.g(10, n(p.x)).g(20, n(p.y));
  };

  const putCircle = (c, r, pc, owner) => {
    ent('CIRCLE', DXF_LAYER[pc], owner);
    d.g(100, 'AcDbCircle').g(10, n(c.x)).g(20, n(c.y)).g(30, '0.0').g(40, n(r));
  };

  /* วงกลมทึบ = โดนัทที่รูในเป็นศูนย์ — เก็บเป็น LWPOLYLINE สองจุด โก่ง 1 ทั้งคู่ กว้างเท่ารัศมี
     วิธีนี้เปิดได้ทุกโปรแกรมและไม่ต้องใช้ HATCH */
  const putDot = (c, r, pc, owner) => {
    ent('LWPOLYLINE', DXF_LAYER[pc], owner);
    d.g(100, 'AcDbPolyline').g(90, 2).g(70, 1).g(43, n(r))
      .g(10, n(c.x - r / 2)).g(20, n(c.y)).g(42, '1.0')
      .g(10, n(c.x + r / 2)).g(20, n(c.y)).g(42, '1.0');
  };

  const putArc = (c, r, a0, a1, pc, owner) => {
    const norm = (deg) => ((deg % 360) + 360) % 360;
    ent('ARC', DXF_LAYER[pc], owner);
    d.g(100, 'AcDbCircle').g(10, n(c.x)).g(20, n(c.y)).g(30, '0.0').g(40, n(r))
      .g(100, 'AcDbArc').g(50, n(norm(a0))).g(51, n(norm(a1)));
  };

  /* การจัดวางข้อความ: 72 = แนวนอน (0 ซ้าย 1 กลาง 2 ขวา) · 73 = แนวตั้ง (0 ฐาน 2 กลาง)
     เมื่อไม่ใช่ "ซ้าย-ฐาน" ต้องเขียนจุดจัดวางที่ 11/21 ด้วย ไม่งั้นข้อความจะเลื่อน */
  const H_JUST = { L: 0, ML: 0, C: 1, MC: 1, R: 2, MR: 2 };
  const putText = (p, s, paperH, layerPc, align, rot, bold, owner) => {
    const h = P(paperH);
    const hj = H_JUST[align] || 0;
    const vj = String(align).startsWith('M') ? 2 : 0;
    ent('TEXT', DXF_LAYER[layerPc], owner);
    d.g(100, 'AcDbText')
      .g(10, n(p.x)).g(20, n(p.y)).g(30, '0.0')
      .g(40, n(h)).g(1, safe(s)).g(50, n(rot || 0))
      .g(7, bold ? STYLE_BOLD : STYLE_TEXT)
      .g(72, hj)
      .g(11, n(p.x)).g(21, n(p.y)).g(31, '0.0')
      .g(100, 'AcDbText').g(73, vj);
  };

  /* ── BLOCKS ── */
  d.g(0, 'SECTION').g(2, 'BLOCKS');

  const openBlock = (name, hBR, base) => {
    d.g(0, 'BLOCK').g(5, d.handle()).g(330, hBR)
      .g(100, 'AcDbEntity').g(8, '0').g(100, 'AcDbBlockBegin')
      .g(2, name).g(70, 0)
      .g(10, n(base ? base.x : 0)).g(20, n(base ? base.y : 0)).g(30, '0.0')
      .g(3, name).g(1, '');
  };
  const closeBlock = (hBR) => {
    d.g(0, 'ENDBLK').g(5, d.handle()).g(330, hBR)
      .g(100, 'AcDbEntity').g(8, '0').g(100, 'AcDbBlockEnd');
  };

  openBlock('*Model_Space', hModelBR); closeBlock(hModelBR);
  openBlock('*Paper_Space', hPaperBR); closeBlock(hPaperBR);

  /* เรขาคณิตของเส้นบอกระยะ — วาดแบบเดียวกับที่ SVG วาด เพื่อให้ภาพตรงกัน
     คืนจุดกึ่งกลางข้อความไว้ให้ DIMENSION อ้าง */
  const dimGeometry = (e, owner) => {
    const len = dimLength(e);
    const label = len.toFixed(DIM_STYLE.decimals) + (e.note ? ' ' + e.note : '');
    const gap = P(DIM_STYLE.extGap), beyond = P(DIM_STYLE.extBeyond);
    const tick = P(DIM_STYLE.tickLength) / 2;
    const s = Math.sign(e.off) || 1;
    let textAt;
    if (e.vertical) {
      const xl = e.a.x + e.off;
      const ya = Math.min(e.a.y, e.b.y), yb = Math.max(e.a.y, e.b.y);
      putLine({ x: e.a.x + s * gap, y: e.a.y }, { x: xl + s * beyond, y: e.a.y }, 'DIM', owner);
      putLine({ x: e.b.x + s * gap, y: e.b.y }, { x: xl + s * beyond, y: e.b.y }, 'DIM', owner);
      putLine({ x: xl, y: ya }, { x: xl, y: yb }, 'DIM', owner);
      for (const y of [ya, yb]) {
        putLine({ x: xl - tick, y: y - tick }, { x: xl + tick, y: y + tick }, 'DIM', owner);
      }
      const tight = dimTextIsTight(e, scale);
      const ty = tight ? yb + P(DIM_STYLE.textHeight * 1.1) : (ya + yb) / 2;
      textAt = { x: xl, y: ty };
      putText(textAt, label, DIM_STYLE.textHeight, 'DIM', tight ? 'ML' : 'MC', 90, false, owner);
    } else {
      const yl = e.a.y + e.off;
      const xa = Math.min(e.a.x, e.b.x), xb = Math.max(e.a.x, e.b.x);
      putLine({ x: e.a.x, y: e.a.y + s * gap }, { x: e.a.x, y: yl + s * beyond }, 'DIM', owner);
      putLine({ x: e.b.x, y: e.b.y + s * gap }, { x: e.b.x, y: yl + s * beyond }, 'DIM', owner);
      putLine({ x: xa, y: yl }, { x: xb, y: yl }, 'DIM', owner);
      for (const x of [xa, xb]) {
        putLine({ x: x - tick, y: yl - tick }, { x: x + tick, y: yl + tick }, 'DIM', owner);
      }
      const tight = dimTextIsTight(e, scale);
      const tx = tight ? xb + P(DIM_STYLE.textHeight * 0.6) : (xa + xb) / 2;
      textAt = { x: tx, y: yl + s * P(DIM_STYLE.textGap) };
      putText(textAt, label, DIM_STYLE.textHeight, 'DIM', tight ? 'L' : 'C', 0, false, owner);
    }
    return { label, textAt };
  };

  const dimInfo = new Map();
  for (const b of dimBlocks) {
    openBlock(b.name, b.hBlockRecord);
    dimInfo.set(b.e, dimGeometry(b.e, b.hBlockRecord));
    closeBlock(b.hBlockRecord);
  }
  d.g(0, 'ENDSEC');

  /* ── ENTITIES ── */
  d.g(0, 'SECTION').g(2, 'ENTITIES');
  const MS = hModelBR;

  for (const e of dwg.entities) {
    switch (e.t) {
      case 'line':
        putLine(e.a, e.b, e.pc, MS);
        break;

      case 'poly':
        putPoly(e.pts, e.pc, MS, e.closed);
        break;

      case 'circle':
        if (e.fill) putDot(e.c, e.r, e.pc, MS);
        else putCircle(e.c, e.r, e.pc, MS);
        break;

      case 'arc':
        putArc(e.c, e.r, e.a0, e.a1, e.pc, MS);
        break;

      case 'text':
        putText(e.p, e.s, e.h, 'DIM', e.align, e.rot, e.bold, MS);
        break;

      case 'hatch': {
        const { segs, dots } = hatchSegments(e, scale);
        for (const dot of dots) putDot({ x: dot.x, y: dot.y }, dot.r, 'HATCH', MS);
        for (const s of segs) putLine({ x: s[0], y: s[1] }, { x: s[2], y: s[3] }, 'HATCH', MS);
        break;
      }

      case 'dim': {
        /* DIMENSION จริง ผูกกับบล็อกเรขาคณิตที่เขียนไว้แล้ว
           70 = 0 (แนวนอน/แนวตั้ง/หมุน) + 32 (บล็อกนี้ใช้กับเส้นนี้เส้นเดียว) + 128 (ผู้ใช้กำหนดตำแหน่งข้อความ)
           กลุ่ม 1 คือข้อความกำกับ — ใส่ไว้เพื่อล็อกให้ตัวเลขใน CAD ตรงกับในแบบเสมอ */
        const b = dimBlocks.find((x) => x.e === e);
        const info = dimInfo.get(e);
        const s = Math.sign(e.off) || 1;
        const linePt = e.vertical
          ? { x: e.a.x + e.off, y: (e.a.y + e.b.y) / 2 }
          : { x: (e.a.x + e.b.x) / 2, y: e.a.y + e.off };
        ent('DIMENSION', DXF_LAYER.DIM, MS);
        d.g(100, 'AcDbDimension')
          .g(2, b.name)
          .g(10, n(linePt.x)).g(20, n(linePt.y)).g(30, '0.0')
          .g(11, n(info.textAt.x)).g(21, n(info.textAt.y)).g(31, '0.0')
          .g(70, 0 + 32 + 128).g(71, 5).g(1, safe(info.label)).g(3, DIMSTYLE)
          .g(100, 'AcDbAlignedDimension')
          .g(13, n(e.a.x)).g(23, n(e.a.y)).g(33, '0.0')
          .g(14, n(e.b.x)).g(24, n(e.b.y)).g(34, '0.0')
          .g(50, e.vertical ? '90.0' : '0.0')
          .g(100, 'AcDbRotatedDimension');
        void s;
        break;
      }

      case 'level': {
        const h = P(TEXT_HEIGHT.SMALL);
        const half = h * 0.6;
        const px = e.extendTo == null ? e.p.x : e.extendTo;
        if (e.extendTo != null) {
          putLine(e.p, { x: px, y: e.p.y }, 'HIDDEN', MS);
        }
        putPoly([
          { x: px, y: e.p.y },
          { x: px - half, y: e.p.y + h },
          { x: px + half, y: e.p.y + h },
        ], 'DIM', MS, true);
        const label = (e.value >= 0 ? '+' : '−') + Math.abs(e.value / 1000).toFixed(3);
        const dir = e.side === 'left' ? -1 : 1;
        putText({ x: px + dir * half * 2, y: e.p.y + P(1.2) }, label, TEXT_HEIGHT.SMALL,
          'DIM', e.side === 'left' ? 'R' : 'L', 0, false, MS);
        break;
      }

      case 'sectionMark': {
        putLine(e.a, e.b, 'CENTRELINE', MS);
        const r = P(3.5);
        for (const p of [e.a, e.b]) {
          putCircle(p, r, 'DIM', MS);
          putText(p, e.label, TEXT_HEIGHT.SMALL, 'DIM', 'MC', 0, true, MS);
        }
        break;
      }

      case 'leader': {
        putPoly(e.pts, 'DIM', MS, false);
        const head = e.pts[0], tail = e.pts[e.pts.length - 1];
        putDot(head, P(0.6), 'DIM', MS);
        const prev = e.pts[e.pts.length - 2];
        const toRight = tail.x >= prev.x;
        putText({ x: tail.x + (toRight ? P(1.2) : -P(1.2)), y: tail.y }, e.label, e.h,
          'DIM', toRight ? 'ML' : 'MR', 0, false, MS);
        break;
      }

      default:
        throw new RangeError('toDxf: ไม่รู้จัก primitive ชนิด "' + e.t + '"');
    }
  }
  d.g(0, 'ENDSEC');

  /* ── OBJECTS — พจนานุกรมรากที่ไฟล์ R13 ขึ้นไปต้องมี ── */
  const hRoot = d.handle();
  const hGroup = d.handle();
  d.g(0, 'SECTION').g(2, 'OBJECTS');
  d.g(0, 'DICTIONARY').g(5, hRoot).g(330, '0').g(100, 'AcDbDictionary').g(281, 1)
    .g(3, 'ACAD_GROUP').g(350, hGroup);
  d.g(0, 'DICTIONARY').g(5, hGroup).g(330, hRoot).g(100, 'AcDbDictionary').g(281, 1);
  d.g(0, 'ENDSEC');

  d.g(0, 'EOF');
  return d.text();
}

/** ชื่อไฟล์ที่แนะนำสำหรับรูปหนึ่งรูป */
export const dxfFileName = (dwg) => String(dwg.id || 'drawing').replace(/[^\w-]/g, '_') + '.dxf';
