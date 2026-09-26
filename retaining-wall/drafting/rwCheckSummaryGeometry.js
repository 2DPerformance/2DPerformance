/**
 * ตารางสรุปผลตรวจสอบเสถียรภาพและกำลัง (RW-05)
 *
 * เหตุผลที่ต้องมีบนแบบ ไม่ใช่แค่ในรายการคำนวณ:
 * คนที่ถือแบบไปหน้างานมักไม่ได้ถือรายการคำนวณไปด้วย ถ้าแบบไม่บอกว่าผลตรวจสอบเป็นอย่างไร
 * ก็ไม่มีทางรู้ว่าหน้าตัดนี้ยังไม่ผ่าน — และนั่นคือความเสี่ยงที่ยอมไม่ได้
 *
 * เหมือน RW-04 คือเป็นตาราง ไม่มีมาตราส่วน (meta.scale = 1 หน่วยเป็นมิลลิเมตรบนกระดาษ)
 * ค่ารายแถวมาจาก checksFor(r) และสรุปรวมมาจาก Snapshot.verdict ตรง ๆ
 * ชั้นนี้เทียบรายการที่ตกเพื่อยืนยันสัญญา Snapshot เท่านั้น — ไม่ใช้ผลที่นับซ้ำ
 * ไปสร้างข้อความ ผลสรุป หรือ metadata แทน verdict
 */
import { line, poly, text, drawing } from './cadPrimitives.js';

const LY = { TABLE: 'RW-TABLE', TEXT: 'RW-TEXT' };

const COLS = [
  { key: 'k', th: 'รายการตรวจสอบ', w: 56, align: 'L' },
  { key: 'v', th: 'ค่าที่ได้', w: 30, align: 'R' },
  { key: 'req', th: 'เกณฑ์ยอมรับ', w: 52, align: 'L' },
  { key: 'u', th: 'อัตราส่วนใช้งาน', w: 20, align: 'R' },
  { key: 'ok', th: 'ผล', w: 14, align: 'C' },
];

const ROW_H = 6.5;
const HEAD_H = 8;
const PAD = 1.6;

/**
 * @param {object} r      ผลจาก designRetainingWall()
 * @param {Array}  checks ผลจาก checksFor(r) — ให้ผู้เรียกส่งเข้ามา เพื่อไม่ให้ชั้นวาดรูปเรียก engine เอง
 * @param {object} opt    ต้องมี verdict จาก Snapshot
 */
export function retainingWallCheckSummary(r, checks, opt = {}) {
  if (!r || !r.i) throw new TypeError('retainingWallCheckSummary: ต้องส่งผลคำนวณ');
  if (!Array.isArray(checks) || !checks.length) {
    throw new TypeError('retainingWallCheckSummary: ต้องส่งรายการตรวจสอบจาก checksFor()');
  }
  if (checks.some((check) => !check || typeof check !== 'object' || typeof check.ok !== 'boolean')) {
    throw new TypeError('retainingWallCheckSummary: check.ok ทุกแถวต้องเป็น boolean จาก checksFor()');
  }
  const verdict = opt.verdict;
  if (!verdict || typeof verdict !== 'object'
      || typeof verdict.pass !== 'boolean'
      || !Number.isInteger(verdict.failedCount) || verdict.failedCount < 0
      || !Array.isArray(verdict.failed)
      || verdict.failed.length !== verdict.failedCount
      || typeof verdict.statement !== 'string' || !verdict.statement.trim()
      || verdict.pass !== (verdict.failedCount === 0)) {
    throw new TypeError('retainingWallCheckSummary: ต้องส่ง verdict ที่ครบและสอดคล้องจาก Snapshot');
  }
  if (verdict.failedCount > checks.length) {
    throw new RangeError('retainingWallCheckSummary: verdict.failedCount มากกว่าจำนวนแถวตรวจสอบ');
  }

  /* Snapshot.verdict เป็น authority ของข้อความและ metadata แต่ต้องตรงกับ checks
     แบบหนึ่งต่อหนึ่งก่อนวาด มิฉะนั้นแถว FAIL อาจอยู่คู่กับสรุป PASS ได้เงียบ ๆ */
  const failedChecks = checks.filter((check) => check.ok === false);
  const verdictKeys = ['k', 'v', 'req', 'u'];
  const failedParity = verdict.failedCount === failedChecks.length
    && verdict.failed.every((item, index) => item && typeof item === 'object'
      && verdictKeys.every((key) => Object.is(item[key], failedChecks[index]?.[key])));
  if (!failedParity) {
    throw new TypeError('retainingWallCheckSummary: verdict.failed ไม่ตรงกับ checks จาก Snapshot');
  }
  const x0 = Number.isFinite(opt.x0) ? opt.x0 : 0;
  const yTop = Number.isFinite(opt.y0) ? opt.y0 : 0;

  const W = COLS.reduce((a, c) => a + c.w, 0);
  const H = HEAD_H + checks.length * ROW_H + ROW_H;          // + แถวสรุป
  const E = [];

  E.push(poly([
    { x: x0, y: yTop }, { x: x0 + W, y: yTop }, { x: x0 + W, y: yTop - H }, { x: x0, y: yTop - H },
  ], 'OUTLINE', LY.TABLE, true));
  E.push(line({ x: x0, y: yTop - HEAD_H }, { x: x0 + W, y: yTop - HEAD_H }, 'OUTLINE', LY.TABLE));

  let cx = x0;
  const colX = [];
  for (const c of COLS) {
    colX.push(cx); cx += c.w;
    if (cx < x0 + W - 0.01) E.push(line({ x: cx, y: yTop }, { x: cx, y: yTop - H }, 'DIM', LY.TABLE));
  }

  const cell = (ci, y, s, h, bold) => {
    const c = COLS[ci];
    const x = c.align === 'L' ? colX[ci] + PAD : c.align === 'R' ? colX[ci] + c.w - PAD : colX[ci] + c.w / 2;
    E.push(text({ x, y }, s, h, LY.TEXT,
      { align: c.align === 'L' ? 'ML' : c.align === 'R' ? 'MR' : 'MC', bold: !!bold }));
  };

  COLS.forEach((c, ci) => cell(ci, yTop - HEAD_H / 2, c.th, 2.5, true));

  checks.forEach((c, k) => {
    const y = yTop - HEAD_H - ROW_H * k - ROW_H / 2;
    if (k) E.push(line({ x: x0, y: y + ROW_H / 2 }, { x: x0 + W, y: y + ROW_H / 2 }, 'DIM', LY.TABLE));
    cell(0, y, String(c.k), 2.5);
    cell(1, y, String(c.v), 2.5);
    cell(2, y, String(c.req), 2.5);
    cell(3, y, Number.isFinite(c.u) ? c.u.toFixed(2) : '—', 2.5);
    /* ตัวหนาเฉพาะช่องที่ไม่ผ่าน เพื่อให้สายตาไปหยุดตรงนั้นก่อน */
    cell(4, y, c.ok ? 'ผ่าน' : 'ไม่ผ่าน', 2.5, !c.ok);
  });

  /* แถวสรุป — ถ้ามีข้อใดไม่ผ่าน ต้องพูดตรง ๆ ห้ามเลี่ยงคำ */
  const ys = yTop - HEAD_H - ROW_H * checks.length - ROW_H / 2;
  E.push(line({ x: x0, y: ys + ROW_H / 2 }, { x: x0 + W, y: ys + ROW_H / 2 }, 'OUTLINE', LY.TABLE));
  cell(0, ys, 'สรุปผล', 2.5, true);
  E.push(text({ x: colX[1] + PAD, y: ys }, verdict.statement,
    2.5, LY.TEXT, { align: 'ML', bold: true }));

  E.push(text({ x: x0, y: yTop + 5 }, 'สรุปผลตรวจสอบ · DESIGN CHECK SUMMARY', 3.5, LY.TEXT, { bold: true }));
  E.push(text({ x: x0 + W, y: yTop + 5 },
    /* ชื่อมาตรฐานต้องให้ผู้เรียกส่งมา เพราะ engine ไม่ได้ติดโปรไฟล์กลับมากับผลลัพธ์
       ถ้าไม่ส่งมาก็พิมพ์ขีด ห้ามเดาแทนผู้ออกแบบ */
    'มาตรฐานออกแบบ ' + (opt.code || '—'), 2.5, LY.TEXT, { align: 'R' }));

  return drawing('RW-05', 'สรุปผลตรวจสอบ', E, {
    scale: 1,
    widthMm: W,
    heightMm: H + 8,
    rows: checks.length,
    failed: verdict.failedCount,
    pass: verdict.pass,
    statement: verdict.statement,
    authority: opt.authority || null,
  });
}

/** ขนาดที่ตารางจะกินบนกระดาษ — ให้ตัวจัดหน้าเผื่อที่ได้ก่อนสร้างจริง */
export const checkSummarySize = (checks) => ({
  w: COLS.reduce((a, c) => a + c.w, 0),
  h: HEAD_H + checks.length * ROW_H + ROW_H + 8,
});
