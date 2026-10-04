/**
 * ตารางเหล็กเสริม (Bar Bending Schedule) — สร้างเป็น primitive ในหน่วย "มิลลิเมตรบนกระดาษ"
 *
 * ต่างจากรูปอื่นตรงที่ตารางไม่มีมาตราส่วน ขนาดที่วาดคือขนาดที่พิมพ์เลย
 * จึงคืน drawing ที่ meta.scale = 1
 *
 * ทุกตัวเลขที่พิมพ์มาจาก quantityProjection ของ Snapshot
 * ชั้นนี้ไม่คำนวณความยาวรวมหรือน้ำหนักเอง
 */
import { line, poly, text, drawing } from './cadPrimitives.js?rwv=20260930-load-units-1';
import { barName } from './draftingStandard.js?rwv=20260930-load-units-1';
import {wrapText} from './sheetComposer.js?rwv=20261001-leader-layout-1';

const LY = { TABLE: 'RW-TABLE', TEXT: 'RW-TEXT' };

const positive = (v) => Number.isFinite(v) && v > 0;
const wholeAtLeast = (v, min) => Number.isInteger(v) && v >= min;
const hasSourceBend = (row) => !!(row && row.bend && typeof row.bend === 'object'
  && ((typeof row.bend.code === 'string' && row.bend.code.trim())
    || (typeof row.bend.type === 'string' && row.bend.type.trim())));

const requireAuthority = (r, authority) => {
  if (!authority || typeof authority.status !== 'string' || !authority.status.trim()
    || authority.constructionAuthority !== false
    || typeof authority.label !== 'string' || !authority.label.trim()
    || typeof authority.reason !== 'string' || !authority.reason.trim()) {
    throw new TypeError('retainingWallBarSchedule: ต้องส่ง authority ที่ครบจาก Snapshot');
  }
  if (r.mode === 'but' && (authority.status !== 'CALCULATION_REPORT'
    || !authority.label.includes('CALCULATION REPORT') || !authority.reason.includes('CALCULATION REPORT'))) {
    throw new TypeError('retainingWallBarSchedule: counterfort ต้องระบุขอบเขตรายงานผลคำนวณ');
  }
  return authority;
};

/** ตรวจ projection กับ qty ต้นทาง แต่ข้อมูลที่วาดอ่านจาก projection เท่านั้น */
function requireScheduleSource(r, quantityProjection) {
  if (!r || !r.i || !r.qty || !Array.isArray(r.qty.bbs) || !r.qty.bbs.length) {
    throw new TypeError('retainingWallBarSchedule: ต้องส่งผลคำนวณที่มีตารางเหล็ก');
  }
  if (!positive(r.i.Lw)) {
    throw new TypeError('retainingWallBarSchedule: ต้องมี i.Lw จาก input ที่ normalize แล้ว');
  }
  if (!quantityProjection || quantityProjection.source !== 'engine.qty'
    || !Array.isArray(quantityProjection.bbs) || !quantityProjection.bbs.length
    || !positive(quantityProjection.steelKg)) {
    throw new TypeError('retainingWallBarSchedule: ต้องส่ง quantityProjection ที่มี bbs/steelKg จาก Snapshot');
  }
  if (!positive(r.qty.steelKg) || quantityProjection.steelKg !== r.qty.steelKg
    || quantityProjection.bbs.length !== r.qty.bbs.length) {
    throw new TypeError('retainingWallBarSchedule: quantityProjection ไม่ตรงกับ qty จาก engine');
  }
  const marks = new Set();
  for (let index = 0; index < quantityProjection.bbs.length; index++) {
    const b = quantityProjection.bbs[index];
    const source = r.qty.bbs[index];
    if (!b || typeof b.mk !== 'string' || !b.mk.trim() || marks.has(b.mk)) {
      throw new TypeError('retainingWallBarSchedule: มาร์ค BBS ต้องเป็นข้อความไม่ว่างและไม่ซ้ำ');
    }
    marks.add(b.mk);
    if (!positive(b.size) || !positive(b.len) || !wholeAtLeast(b.n, 1)
      || !positive(b.kg) || !positive(b.totalLen)
      || typeof b.detail !== 'string' || !b.detail.trim()
      || typeof b.bendLabel !== 'string' || !b.bendLabel.trim()) {
      throw new TypeError('retainingWallBarSchedule: BBS ' + b.mk
        + ' ต้องมี size/len/n/kg/totalLen/detail/bendLabel จาก Snapshot ที่ใช้ได้');
    }
    if (!source || !positive(source.size) || !positive(source.len) || !wholeAtLeast(source.n, 1)
      || !positive(source.kg) || typeof source.detail !== 'string' || !source.detail.trim()
      || !hasSourceBend(source)) {
      throw new TypeError('retainingWallBarSchedule: qty.bbs ' + b.mk + ' จาก engine ไม่ครบ');
    }
    if (b.mk !== source.mk || b.size !== source.size || b.len !== source.len
      || b.n !== source.n || b.kg !== source.kg || b.detail !== source.detail) {
      throw new TypeError('retainingWallBarSchedule: quantityProjection row ' + b.mk + ' ไม่ตรงกับ qty.bbs');
    }
    const sourceBendLabel = typeof source.bend.code === 'string' && source.bend.code.trim()
      ? source.bend.code : source.bend.type;
    if (b.bendLabel !== sourceBendLabel) {
      throw new TypeError('retainingWallBarSchedule: quantityProjection bendLabel ' + b.mk + ' ไม่ตรงกับ qty.bbs');
    }
  }
  if (r.mode === 'but') {
    const requiredMarks = ['⑥', '⑥b', '⑦a', '⑦b'];
    if (!requiredMarks.every((mark) => marks.has(mark))) {
      throw new TypeError('retainingWallBarSchedule: counterfort ต้องมี BBS ⑥/⑥b/⑦a/⑦b จาก Snapshot');
    }
  }
  return quantityProjection;
}

const COLS = [
  { key: 'mk', th: 'มาร์ค', w: 14, align: 'C' },
  { key: 'size', th: 'ขนาด', w: 16, align: 'C' },
  { key: 'shape', th: 'รูปดัด', w: 20, align: 'C' },
  { key: 'detail', th: 'ระยะเรียง / หมายเหตุ', w: 46, align: 'L' },
  { key: 'len', th: 'ยาว/เส้น (ม.)', w: 24, align: 'R' },
  { key: 'n', th: 'จำนวน', w: 16, align: 'R' },
  { key: 'total', th: 'ยาวรวม (ม.)', w: 22, align: 'R' },
  { key: 'kg', th: 'น้ำหนัก (กก.)', w: 22, align: 'R' },
];

const ROW_H = 6.5;
const HEAD_H = 8;
const PAD = 1.6;
const TEXT_H=2.5,LINE_PITCH=4;
function measuredRows(rows){
  return rows.map(row=>{
    const shape=wrapText(row.bendLabel,COLS[2].w-2*PAD,TEXT_H);
    const detail=wrapText(row.detail,COLS[3].w-2*PAD,TEXT_H);
    return {row,shape,detail,height:Math.max(ROW_H,Math.max(shape.length,detail.length)*LINE_PITCH+2.5)};
  });
}

/**
 * @param {object} r ผลจาก designRetainingWall()
 * @param {object} [opt]
 * @param {number} [opt.x0] มุมซ้ายบนของตาราง (มม. บนกระดาษ)
 * @param {number} [opt.y0]
 */
export function retainingWallBarSchedule(r, opt = {}) {
  const quantityProjection = requireScheduleSource(r, opt.quantityProjection);
  const authority = requireAuthority(r, opt.authority);
  const rows = quantityProjection.bbs;
  const measured=measuredRows(rows);
  const x0 = Number.isFinite(opt.x0) ? opt.x0 : 0;
  const yTop = Number.isFinite(opt.y0) ? opt.y0 : 0;

  const W = COLS.reduce((a, c) => a + c.w, 0);
  const H = HEAD_H + measured.reduce((sum,row)=>sum+row.height,0) + ROW_H;
  const E = [];

  /* กรอบนอกและเส้นแบ่ง */
  E.push(poly([
    { x: x0, y: yTop }, { x: x0 + W, y: yTop }, { x: x0 + W, y: yTop - H }, { x: x0, y: yTop - H },
  ], 'OUTLINE', LY.TABLE, true));
  E.push(line({ x: x0, y: yTop - HEAD_H }, { x: x0 + W, y: yTop - HEAD_H }, 'OUTLINE', LY.TABLE));

  let cx = x0;
  const colX = [];
  for (const c of COLS) { colX.push(cx); cx += c.w; if (cx < x0 + W - 0.01) E.push(line({ x: cx, y: yTop }, { x: cx, y: yTop - H }, 'DIM', LY.TABLE)); }

  const cell = (ci, y, s, h, bold) => {
    const c = COLS[ci];
    const x = c.align === 'L' ? colX[ci] + PAD : c.align === 'R' ? colX[ci] + c.w - PAD : colX[ci] + c.w / 2;
    E.push(text({ x, y }, s, h, LY.TEXT, { align: c.align === 'L' ? 'ML' : c.align === 'R' ? 'MR' : 'MC', bold: !!bold }));
  };

  /* หัวตาราง */
  COLS.forEach((c, ci) => cell(ci, yTop - HEAD_H / 2, c.th, 2.5, true));

  /* แถวข้อมูล */
  let rowTop=yTop-HEAD_H;
  measured.forEach(({row:b,shape,detail,height},k) => {
    const y = rowTop-height/2;
    if (k) E.push(line({ x: x0, y: rowTop }, { x: x0 + W, y: rowTop }, 'DIM', LY.TABLE));
    cell(0, y, String(b.mk), 3.5, true);
    cell(1, y, barName(r.i.fy, b.size), 2.5);
    shape.forEach((s,j)=>cell(2,y+(shape.length-1)*LINE_PITCH/2-j*LINE_PITCH,s,TEXT_H));
    detail.forEach((s,j)=>cell(3,y+(detail.length-1)*LINE_PITCH/2-j*LINE_PITCH,s,TEXT_H));
    cell(4, y, b.len.toFixed(3), 2.5);
    cell(5, y, String(b.n), 2.5);
    cell(6, y, b.totalLen.toFixed(1), 2.5);
    cell(7, y, b.kg.toFixed(1), 2.5);
    rowTop-=height;
  });

  /* แถวสรุป */
  const ys = rowTop - ROW_H / 2;
  E.push(line({ x: x0, y: ys + ROW_H / 2 }, { x: x0 + W, y: ys + ROW_H / 2 }, 'OUTLINE', LY.TABLE));
  cell(3, ys, 'รวมเผื่อทาบ/สูญเสีย 8%', 2.5, true);
  cell(7, ys, quantityProjection.steelKg.toFixed(0), 3.5, true);

  E.push(text({ x: x0, y: yTop + 7 }, 'ตารางเหล็กเสริม · BAR BENDING SCHEDULE', 3.5, LY.TEXT, { bold: true }));
  E.push(text({ x: x0 + W / 2, y: yTop + 2 }, authority.label, 2.2, LY.TEXT, { align: 'C', bold: true }));
  E.push(text({ x: x0 + W, y: yTop + 7 }, 'ต่อความยาวกำแพง ' + r.i.Lw.toFixed(2) + ' ม.', 2.5, LY.TEXT, { align: 'R' }));

  return drawing('RW-04', 'ตารางเหล็กเสริม', E, {
    scale: 1, widthMm: W, heightMm: H + 10, rows: rows.length,
    totalKg: quantityProjection.steelKg, authority,
  });
}

/** ขนาดที่ตารางจะกินบนกระดาษ — รับ Projection เดียวกับ renderer ห้ามย้อนอ่าน r.qty */
export const barScheduleSize = (quantityProjection) => {
  if (!quantityProjection || !Array.isArray(quantityProjection.bbs) || !quantityProjection.bbs.length) {
    throw new TypeError('barScheduleSize: ต้องส่ง quantityProjection จาก Snapshot');
  }
  return {
    w: COLS.reduce((a, c) => a + c.w, 0),
    h: HEAD_H + measuredRows(quantityProjection.bbs).reduce((sum,row)=>sum+row.height,0) + ROW_H + 10,
  };
};
