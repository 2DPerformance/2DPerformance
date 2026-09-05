/**
 * ตัวจัดหน้ากระดาษ — เอารูปหลายรูปที่คนละมาตราส่วนมาวางลงแผ่นเดียว
 *
 * แนวคิดสำคัญ: แผ่นกระดาษก็คือ "รูป" อีกรูปหนึ่งที่มาตราส่วน 1:1
 *   พิกัดในแผ่น = มิลลิเมตรบนกระดาษจริง
 *   รูปย่อยถูกย่อด้วย 1/มาตราส่วนของตัวเอง แล้ววางลงตำแหน่งที่กำหนด
 *
 * ผลพลอยได้ที่สำคัญ: renderer ตัวเดิมใช้ได้ทันทีโดยไม่ต้องแก้
 *   ความสูงตัวอักษรเก็บเป็นมิลลิเมตรกระดาษอยู่แล้ว → เรนเดอร์ที่ 1:1 ได้ขนาดจริง
 *   ความหนาเส้นมาจาก projection class × มาตราส่วน → ที่ 1:1 ได้ค่าตามมาตรฐานพอดี
 */
import { line, poly, text, drawing, bboxOf, dimLength } from './cadPrimitives.js';
import { SHEET, TITLE_BLOCK, TEXT_HEIGHT, SHEET_SCALE, SHEET_TITLE } from './draftingStandard.js';
import { drawnBoxOf, drawnSize } from './extentGeometry.js';
import { textWidth } from './textMetrics.js';

const LY = { BORDER: 'RW-BORDER', TITLE: 'RW-TITLE', TEXT: 'RW-TEXT' };

/** ช่องไฟน้อยที่สุดระหว่างรูปสองรูป — แคบกว่านี้รูปจะติดกันจนอ่านยาก */
const MIN_GAP = 6;

/** ย่อและเลื่อนรูปหนึ่งรูปเข้าสู่พิกัดกระดาษ */
function place(dwg, scale, ox, oy) {
  const k = 1 / scale;
  const bb = dwg.bbox;
  const X = (x) => ox + (x - bb.min.x) * k;
  const Y = (y) => oy + (y - bb.min.y) * k;
  const mv = (p) => ({ x: X(p.x), y: Y(p.y) });
  return dwg.entities.map((e) => {
    const c = { ...e };
    /* ล็อกระยะจริงไว้ก่อนพิกัดจะถูกย่อ — ตัวเลขในแบบต้องเป็นระยะของอาคาร ไม่ใช่ของกระดาษ */
    if (c.t === 'dim' && !Number.isFinite(c.measured)) c.measured = dimLength(e);
    if (c.a) c.a = mv(c.a);
    if (c.b) c.b = mv(c.b);
    if (c.p) c.p = mv(c.p);
    if (c.c) c.c = mv(c.c);
    if (c.pts) c.pts = c.pts.map(mv);
    /* ความยาวที่เป็น "ระยะจริงของอาคาร" ต้องย่อด้วย · ความสูงตัวอักษรเป็นมิลลิเมตรกระดาษ ห้ามย่อ */
    if (typeof c.r === 'number') c.r = c.r * k;
    if (typeof c.off === 'number') c.off = c.off * k;
    if (typeof c.extendTo === 'number') c.extendTo = X(c.extendTo);
    return c;
  });
}

/** ความกว้างข้อความโดยประมาณ — ค่าเดียวกับที่ renderer ใช้ (Sarabun ผสมไทย-อังกฤษ) */
/** @deprecated เหลือไว้ให้โค้ดเก่า import — ความกว้างจริงใช้ textWidth จาก textMetrics */
export const TEXT_W = 0.58;

/**
 * ขนาดที่รูปหนึ่งจะกินบนกระดาษ (มม.)
 *
 * ★ เดิมฟังก์ชันนี้วัดเองแบบไม่ครบ — เผื่อเฉพาะความกว้างข้อความของ text/leader/level
 *   แต่ไม่รู้ว่าเส้นบอกระยะไปวางอยู่ที่ระยะเยื้อง off ไม่ใช่ที่จุด a,b
 *   ผลคือรายงานว่ารูปเล็กกว่าความจริง แล้วตัวจัดหน้ายัดลงแผ่นจนโซ่บอกระยะยื่นพ้นกรอบ
 *   (เกิดจริง 2026-08-30: แผ่น 1 ล้นขอบบน 6.5 มม. · แผ่น 2 ล้นขอบซ้าย 5.0 มม.
 *    โดยที่ meta.overflow ยังรายงานว่าไม่ล้น)
 *   ตอนนี้ยกงานวัดไปให้ extentGeometry ซึ่งสะท้อนสิ่งที่ renderer วาดจริงทีละชนิด
 */
export function paperSize(dwg, scale) {
  const s = drawnSize(dwg, scale);
  return { w: s.w, h: s.h, padLeft: s.padLeft, padBottom: s.padBottom };
}

/* ── กรอบชื่อแบบ ─────────────────────────────────────────────
   ช่องที่ engine รู้ → เติมให้  ·  ช่องที่เป็นความรับผิดชอบของคน → เว้นว่าง
   ห้ามเติมชื่อโครงการ ชื่อผู้ออกแบบ หรือเลขใบอนุญาตแทนวิศวกรเด็ดขาด
   ─────────────────────────────────────────────────────────── */
function titleBlock(x0, y0, info) {
  if (!info || typeof info.coverageHold !== 'string' || !info.coverageHold.trim()) {
    throw new TypeError('titleBlock: ต้องส่ง info.coverageHold จาก Snapshot เพื่อสร้างแบบแบบ fail-closed');
  }
  const verdict = info.verdict;
  if (!verdict || typeof verdict.pass !== 'boolean'
      || !Number.isInteger(verdict.failedCount) || verdict.failedCount < 0
      || !Array.isArray(verdict.failed) || verdict.failed.length !== verdict.failedCount
      || typeof verdict.statement !== 'string' || !verdict.statement.trim()
      || verdict.pass !== (verdict.failedCount === 0)) {
    throw new TypeError('titleBlock: ต้องส่ง info.verdict authoritative จาก Snapshot เพื่อสร้างแบบแบบ fail-closed');
  }
  if (typeof info.rebarGeometryHold !== 'string' || !info.rebarGeometryHold.trim()) {
    throw new TypeError('titleBlock: ต้องส่ง info.rebarGeometryHold จาก Snapshot เพื่อเปิดเผย placement HOLD');
  }
  const W = TITLE_BLOCK.w, H = TITLE_BLOCK.h;
  const E = [];
  E.push(poly([
    { x: x0, y: y0 }, { x: x0 + W, y: y0 }, { x: x0 + W, y: y0 + H }, { x: x0, y: y0 + H },
  ], 'OUTLINE', LY.TITLE, true));

  const rows = [
    [['ชื่อโครงการ', info.project, 2], ['เลขที่แบบ', info.drawingNo, 1]],
    [['ชื่อแบบ', info.title, 2], ['แผ่นที่', info.sheetNo, 1]],
    [['มาตราส่วน', info.scales, 1], ['หน่วย', 'มิลลิเมตร', 1], ['วันที่', info.date, 1]],
    [['ออกแบบ/เขียน', info.designer, 1], ['ตรวจสอบ', info.checker, 1], ['อนุมัติ', info.approver, 1]],
    [['เลขที่ใบอนุญาต', info.licence, 2], ['แก้ไขครั้งที่', info.rev, 1]],
  ];
  const stampSources = [
    info.coverageHold.trim(),
    'ENGINE VERDICT ' + (verdict.pass ? 'PASS' : 'FAIL') + ' · FAILED ' + verdict.failedCount
      + ' · ' + verdict.statement.trim(),
    info.rebarGeometryHold.trim(),
  ];
  const stampLines = stampSources.flatMap((line) => wrapText(line, W - 4, TEXT_HEIGHT.MICRO));
  const stampLineH = 2.4;
  const stampH = Math.max(9, stampLines.length * stampLineH + 1.6);
  const rowH = (H - stampH) / rows.length;
  if (!Number.isFinite(rowH) || rowH < 4.6) {
    throw new RangeError('titleBlock: verdict/coverage/HOLD ยาวเกินพื้นที่กรอบชื่อแบบ');
  }
  rows.forEach((cells, ri) => {
    const yTop = y0 + H - rowH * ri;
    if (ri) E.push(line({ x: x0, y: yTop }, { x: x0 + W, y: yTop }, 'DIM', LY.TITLE));
    const units = cells.reduce((a, c) => a + c[2], 0);
    let cx = x0;
    for (const [label, value, span] of cells) {
      const cw = (W * span) / units;
      if (cx > x0 + 0.01) E.push(line({ x: cx, y: yTop }, { x: cx, y: yTop - rowH }, 'DIM', LY.TITLE));
      E.push(text({ x: cx + 1.6, y: yTop - 2.2 }, label, TITLE_BLOCK.labelHeight, LY.TITLE));
      E.push(text({ x: cx + 1.6, y: yTop - rowH + 1.8 },
        value == null || value === '' ? '—' : String(value), TITLE_BLOCK.valueHeight, LY.TITLE,
        { bold: value != null && value !== '' }));
      cx += cw;
    }
  });

  /* ตราประทับ — คงอยู่ตลอดช่วง Beta */
  const yStamp = y0;
  E.push(line({ x: x0, y: yStamp + stampH }, { x: x0 + W, y: yStamp + stampH }, 'DIM', LY.TITLE));
  /* Coverage, exact Snapshot verdict และ mark-specific HOLD ต้องติดทุกแผ่น/ทุก DXF */
  stampLines.forEach((stamp, index) => {
    const y = yStamp + stampH - 1.2 - (index + 0.5) * stampLineH;
    E.push(text({ x: x0 + W / 2, y }, stamp, TEXT_HEIGHT.MICRO, LY.TITLE,
      { align: 'MC', bold: true }));
  });
  return E;
}

/**
 * ตัดคำให้พอดีความกว้างที่มี
 * ไทยไม่มีช่องว่างระหว่างคำ จึงตัดที่ช่องว่างก่อน ถ้ายังยาวเกินค่อยตัดกลางคำ
 * ไม่มีการตัดคำ = หมายเหตุยาว ๆ จะยื่นออกนอกกรอบกระดาษ (เจอจริงตอนแผ่นที่ 2)
 */
export function wrapText(s, width, h) {
  /* ตัดคำด้วยความกว้างสะสมจริงจากตาราง metric — เดิมนับ "จำนวนตัวอักษร" ด้วยค่าเฉลี่ย
     ซึ่งตัดสั้นไปกับข้อความที่มีอักขระกว้าง และตัดยาวไปกับข้อความไทยที่มีสระซ้อนกว้างศูนย์ */
  const out = [];
  const spaceW = textWidth(' ', h);
  let line = '';
  let lineW = 0;
  for (const word of String(s).split(' ')) {
    const wordW = textWidth(word, h);
    if (line && lineW + spaceW + wordW <= width) {
      line += ' ' + word;
      lineW += spaceW + wordW;
      continue;
    }
    if (!line && wordW <= width) { line = word; lineW = wordW; continue; }
    if (line) { out.push(line); line = ''; lineW = 0; }
    /* คำเดียวยาวเกินความกว้าง — ตัดกลางคำตามความกว้างจริงทีละอักขระ */
    for (const ch of word) {
      const cw = textWidth(ch, h);
      if (line && lineW + cw > width) { out.push(line); line = ''; lineW = 0; }
      line += ch;
      lineW += cw;
    }
  }
  if (line) out.push(line);
  return out;
}

/** ความสูงที่บล็อกหมายเหตุจะกินเมื่อตัดคำแล้ว */
export function notesBlockHeight(lines, width, h = 2.5) {
  const rows = lines.reduce((a, s, k) => a + wrapText((k + 1) + '. ' + s, width, h).length, 0);
  return 5.5 + rows * (h * 1.6) + lines.length * 1.2;
}

/** บล็อกหมายเหตุทั่วไป — ย่อหน้าแขวน เลขข้ออยู่นอกแนวข้อความ */
function generalNotes(x0, yTop, w, lines) {
  const E = [];
  const h = TEXT_HEIGHT.SMALL;
  const pitch = h * 1.6;
  E.push(text({ x: x0, y: yTop }, 'หมายเหตุทั่วไป', TEXT_HEIGHT.BODY, LY.TEXT, { bold: true }));
  let y = yTop - 5.5;
  lines.forEach((s, k) => {
    const rows = wrapText(s, w - 6, h);
    E.push(text({ x: x0, y }, (k + 1) + '.', h, LY.TEXT));
    rows.forEach((rowText, ri) => {
      E.push(text({ x: x0 + 6, y: y - ri * pitch }, rowText, h, LY.TEXT));
    });
    y -= rows.length * pitch + 1.2;
  });
  return E;
}

/**
 * ประกอบแผ่นเดียว
 * @param {Array}  views  [{ drawing, scale }] เรียงตามลำดับที่จะวาง
 * @param {object} opt
 * @param {string} [opt.size='A3']
 * @param {object} [opt.info]   ข้อมูลกรอบชื่อแบบ — ช่องที่ไม่ส่งมาจะพิมพ์ขีด
 * @param {Array}  [opt.notes]  หมายเหตุทั่วไป
 * @returns {object} drawing ที่มาตราส่วน 1:1 พร้อมเรนเดอร์หรือส่งออก DXF
 */
export function composeSheet(views, opt = {}) {
  const key = opt.size || 'A3';
  const sh = SHEET[key];
  if (!sh) throw new RangeError('composeSheet: ไม่รู้จักขนาดกระดาษ "' + key + '"');
  if (!Array.isArray(views) || !views.length) throw new TypeError('composeSheet: ต้องมีรูปอย่างน้อยหนึ่งรูป');

  const L = sh.bindingMargin, R = sh.margin, T = sh.margin, Bm = sh.margin;
  const area = { x0: L, y0: Bm, x1: sh.w - R, y1: sh.h - T };
  const E = [];

  /* กรอบกระดาษ */
  E.push(poly([
    { x: area.x0, y: area.y0 }, { x: area.x1, y: area.y0 },
    { x: area.x1, y: area.y1 }, { x: area.x0, y: area.y1 },
  ], 'OUTLINE', LY.BORDER, true));

  /* ── จัดสองคอลัมน์ ──
     ซ้าย : รูปตัด แล้วผัง        (รูปที่ต้องดูคู่กันตอนวางผัง)
     ขวา  : รายละเอียด ตาราง หมายเหตุ กรอบชื่อแบบ (ไล่จากบนลงล่าง)

     ★ ความกว้างคอลัมน์คิดจากเนื้อหาจริง ไม่ใช่ครึ่งแผ่นตายตัว
       ผังฐานรากที่ 1:100 กว้าง 204 มม. เพราะป้ายชี้ยาว ถ้าบังคับครึ่งแผ่น (191 มม.)
       มันจะไม่มีวันลง ทั้งที่แผ่นยังมีที่เหลือ เพราะคอลัมน์ซ้ายกว้างแค่ 172 มม.

     ★ รูปบนสุดชิดขอบบน รูปล่างสุดชิดขอบล่าง ช่องไฟที่เหลือหารเท่ากัน
       (เจ้าของงานสั่ง 2026-08-30: "เอาตารางเลื่อนลงมาชิดสิ และขยับโมเดลลงมา")
       แบบที่มีของกองอยู่ครึ่งบนแล้วเว้นครึ่งล่างว่าง อ่านเหมือนแบบยังทำไม่เสร็จ */
  const sizeOf = (v) => drawnSize(v.drawing, v.scale);
  const wantLeft = views.filter((v) => v.column !== 'right');
  const wantRight = views.filter((v) => v.column === 'right');

  /* ★ ต้องตรวจความจุตามแกน x ด้วย ไม่ใช่แกน y อย่างเดียว
     เดิมตำแหน่งคอลัมน์ขวาถูกดันออกไปเรื่อย ๆ เมื่อคอลัมน์ซ้ายกว้าง จนหลุดออกนอกกระดาษ
     วัดได้จริงกับกำแพงสูง hp 9.0 ม.: เนื้อหาไปถึง x 450.8 บนกระดาษกว้าง 420 มม.
     คือพ้นขอบกระดาษ 30.8 มม. โดยไม่มีอะไรทัดทาน
     ถ้าสองคอลัมน์ไม่พอ ให้ยุบเหลือคอลัมน์เดียวเรียงลงมา — ห้ามวางทับกันเด็ดขาด */
  const xLeftEdge = area.x0 + 4;
  const roomX = (area.x1 - 2) - xLeftEdge;
  const widthOf = (col) => (col.length ? Math.max(...col.map((v) => sizeOf(v).w)) : 0);
  const twoColumnsFit = wantRight.length > 0
    && (widthOf(wantLeft) + MIN_GAP + Math.max(TITLE_BLOCK.w, widthOf(wantRight))) <= roomX;

  const left = twoColumnsFit ? wantLeft : [...wantLeft, ...wantRight];
  const right = twoColumnsFit ? wantRight : [];
  const colLW = widthOf(left);
  const colRW = Math.max(TITLE_BLOCK.w, widthOf(right));

  const inset = 3;
  const notes = opt.notes || [];
  const notesH = notes.length ? notesBlockHeight(notes, colRW - 6) : 0;
  /* คอลัมน์ขวาต้องเผื่อที่ให้หมายเหตุและกรอบชื่อแบบเสมอ ไม่งั้นรูปจะทับกรอบชื่อแบบ */
  const rightReserve = notesH + TITLE_BLOCK.h + 2 + (notesH ? 9 : 0) + 9;

  const MAX_GAP = 34;
  /** ช่องไฟที่ทำให้รูปบนสุดชิดบน และรูปล่างสุดชิดล่างพอดี */
  const gapFor = (col, avail) => {
    if (col.length < 2) return MIN_GAP;
    const sum = col.reduce((a, v) => a + sizeOf(v).h, 0);
    const g = (avail - sum) / (col.length - 1);
    if (!Number.isFinite(g)) return MIN_GAP;
    return Math.max(MIN_GAP, Math.min(MAX_GAP, g));
  };

  const availFull = (area.y1 - area.y0) - 2 * inset;
  /* คอลัมน์เดียวก็ต้องเผื่อที่ให้กรอบชื่อแบบและหมายเหตุ ไม่งั้นรูปล่างสุดจะไปทับ */
  const availL = right.length ? availFull : availFull - rightReserve;
  const availR = availFull - rightReserve;
  const gapL = gapFor(left, availL);
  const gapR = gapFor(right, availR);

  const xL = xLeftEdge;
  const xR = right.length
    ? Math.max(xL + colLW + MIN_GAP, area.x1 - colRW - 2)
    : Math.max(xL, area.x1 - colRW - 2);

  /* จดตำแหน่งที่วางจริงไว้ใน meta ด้วย ชั้นบนและชุดทดสอบจะได้ตรวจได้ว่ารูปไม่ทับกัน */
  const placed = [];
  let yCursor = area.y1 - inset;
  for (const v of left) {
    const s = sizeOf(v);
    const x = xL, y = yCursor - s.h;
    E.push(...place(v.drawing, v.scale, x + s.padLeft, y + s.padBottom));
    placed.push({ id: v.drawing.id, scale: v.scale, w: s.w, h: s.h, x, y, column: 'left' });
    yCursor -= s.h + gapL;
  }
  const leftBottom = yCursor;

  yCursor = area.y1 - inset;
  for (const v of right) {
    const s = sizeOf(v);
    const x = xR, y = yCursor - s.h;
    E.push(...place(v.drawing, v.scale, x + s.padLeft, y + s.padBottom));
    placed.push({ id: v.drawing.id, scale: v.scale, w: s.w, h: s.h, x, y, column: 'right' });
    yCursor -= s.h + gapR;
  }
  /* หมายเหตุเริ่มเหนือกรอบชื่อแบบเสมอ ไม่ใช่ต่อท้ายรูปสุดท้าย
     ไม่งั้นคอลัมน์ที่รูปน้อยจะดันหมายเหตุลอยกลางแผ่น */
  yCursor = Math.min(yCursor, area.y0 + inset + TITLE_BLOCK.h + 9 + notesH);

  /* หมายเหตุทั่วไป แล้วกรอบชื่อแบบชิดมุมล่างขวา */
  if (notes.length) {
    E.push(...generalNotes(xR, yCursor, colRW, notes));
    yCursor -= notesH + MIN_GAP;
  }
  const tbY = area.y0 + 2;
  E.push(...titleBlock(area.x1 - TITLE_BLOCK.w - 2, tbY, opt.info || {}));

  /* ★ ตัวตรวจล้นกรอบต้องวัดด้วยไม้บรรทัดอันเดียวกับตัวจัดหน้า
     เดิมมันวัดจาก bboxOf แล้วเผื่อความกว้างข้อความเพิ่มเอง ซึ่งยังไม่เห็นเส้นบอกระยะ
     จึงรายงานว่า "ไม่ล้น" ทั้งที่ล้นจริง — ตัวตรวจที่โกหกอันตรายกว่าไม่มีตัวตรวจ */
  const bb = drawnBoxOf(E, 1);
  const overflow = bb.min.x < area.x0 - 0.5 || bb.min.y < area.y0 - 0.5
    || bb.max.x > area.x1 + 0.5 || bb.max.y > area.y1 + 0.5;

  /* ★ id ต้องไม่ซ้ำกันระหว่างแผ่น — ชื่อไฟล์ DXF และ PNG สร้างจาก id
     เดิมทุกแผ่นได้ id เดียวกัน ('SHEET-A3') เซฟแผ่น 2 แล้วทับแผ่น 1 แบบหายไปเงียบ ๆ */
  const sheetNo = String((opt.info && opt.info.sheetNo) || '').split('/')[0].trim();
  const sheetId = 'SHEET-' + key + (sheetNo ? '-' + sheetNo.padStart(2, '0') : '');
  return drawing(sheetId, 'แผ่นแบบ ' + key + (sheetNo ? ' แผ่นที่ ' + sheetNo : ''), E, {
    scale: 1,
    sheet: key,
    sheetW: sh.w,
    sheetH: sh.h,
    area,
    overflow,
    /* รายการละเมิดกรอบแบบอ่านออก — ชั้นบนต้องเอาไปตัดสินใจได้ ไม่ใช่มีไว้ดูเฉย ๆ */
    violations: (() => {
      const v = [];
      if (bb.min.x < area.x0 - 0.5) v.push({ side: 'left', mm: area.x0 - bb.min.x });
      if (bb.max.x > area.x1 + 0.5) v.push({ side: 'right', mm: bb.max.x - area.x1 });
      if (bb.min.y < area.y0 - 0.5) v.push({ side: 'bottom', mm: area.y0 - bb.min.y });
      if (bb.max.y > area.y1 + 0.5) v.push({ side: 'top', mm: bb.max.y - area.y1 });
      return v;
    })(),
    twoColumns: twoColumnsFit && right.length > 0,
    contentBox: bb,
    freeBelowLeft: leftBottom - area.y0,
    views: placed,
  });
}



/* ════════════════════════════════════════════════════════════
   แบ่งเป็นหลายแผ่นอัตโนมัติ
   ขนาดกระดาษเป็นสิ่งที่เจ้าของงานกำหนด (A3 สำหรับงาน CAD)
   ถ้าเนื้อหาไม่ลงแผ่นเดียว ให้ขึ้นแผ่นใหม่ — ไม่ใช่ย่อมาตราส่วนจนอ่านไม่ออก
   ════════════════════════════════════════════════════════════ */

/** ความสูงที่บล็อกหมายเหตุจะกิน (มม.) */
const notesHeight = (notes, width) => (notes && notes.length ? notesBlockHeight(notes, width || 180) : 0);

/**
 * จัดรูปทั้งชุดลงกระดาษขนาดที่กำหนด โดยขึ้นแผ่นใหม่เมื่อเต็ม
 *
 * @param {Array}  views  [{ drawing, scale }] เรียงตามลำดับความสำคัญ
 * @param {object} opt
 * @param {string} [opt.size='A3']
 * @param {object} [opt.info]   ข้อมูลกรอบชื่อแบบ — แผ่นที่ x/N เติมให้อัตโนมัติ
 * @param {Array}  [opt.notes]  หมายเหตุทั่วไป — พิมพ์บนแผ่นสุดท้าย
 * @returns {Array} drawing หนึ่งตัวต่อหนึ่งแผ่น
 */
export function composeSheetSet(views, opt = {}) {
  const key = opt.size || 'A3';
  const sh = SHEET[key];
  if (!sh) throw new RangeError('composeSheetSet: ไม่รู้จักขนาดกระดาษ "' + key + '"');
  if (!Array.isArray(views) || !views.length) throw new TypeError('composeSheetSet: ต้องมีรูปอย่างน้อยหนึ่งรูป');

  const area = { x0: sh.bindingMargin, y0: sh.margin, x1: sh.w - sh.margin, y1: sh.h - sh.margin };
  const roomX = (area.x1 - 2) - (area.x0 + 4);
  const colH = area.y1 - area.y0 - 6;
  /* คีย์ด้วยตัว drawing เพราะ view ถูกคัดลอกใหม่ทุกครั้งที่ย้ายคอลัมน์หรือย้ายแผ่น
     ถ้าคีย์ด้วยตัว view ค่าจะหายทันทีที่มีการคัดลอก */
  const sizeCache = new Map(views.map((v) => [v.drawing, drawnSize(v.drawing, v.scale)]));
  const size = { get: (v) => sizeCache.get(v.drawing) };

  /* รูปที่กว้างเกินหน้ากระดาษ ไม่มีทางจัดลงได้ไม่ว่าจะแบ่งกี่แผ่น — ต้องบอกตรง ๆ ตั้งแต่ต้น
     ห้ามส่งแบบที่หลุดกรอบออกไป เพราะปลายทางคือกระดาษที่เอาไปหน้างานจริง */
  for (const v of views) {
    const s = size.get(v);
    if (s.w > roomX + 0.5) {
      throw new RangeError('composeSheetSet: รูป ' + v.drawing.id + ' กว้าง ' + s.w.toFixed(0)
        + ' มม. เกินพื้นที่เขียนแบบของ ' + key + ' (' + roomX.toFixed(0) + ' มม.)'
        + ' — ต้องลดมาตราส่วน ย้ายป้ายให้แคบลง หรือเปลี่ยนขนาดกระดาษ');
    }
    if (s.h > colH + 0.5) {
      throw new RangeError('composeSheetSet: รูป ' + v.drawing.id + ' สูง ' + s.h.toFixed(0)
        + ' มม. เกินพื้นที่เขียนแบบของ ' + key + ' (' + colH.toFixed(0) + ' มม.)'
        + ' — ต้องลดมาตราส่วนหรือเปลี่ยนขนาดกระดาษ');
    }
  }

  const notesH = notesHeight(opt.notes, Math.max(TITLE_BLOCK.w, roomX / 2));
  const reserve = notesH + TITLE_BLOCK.h + 18;

  /** จัดรูปลงหน้าแบบโลภ โดยรู้ทั้งความสูงและความกว้าง */
  const pack = (list) => {
    const pages = [];
    let page = { left: [], right: [] };
    let hL = 0, hR = 0;
    const widest = (col) => (col.length ? Math.max(...col.map((v) => size.get(v).w)) : 0);
    for (const v of list) {
      const s = size.get(v);
      if (!page.left.length || hL + s.h + MIN_GAP <= colH) {
        page.left.push(v); hL += s.h + MIN_GAP; continue;
      }
      /* ★ ลงคอลัมน์ขวาได้ก็ต่อเมื่อ "กว้างพอ" ด้วย ไม่ใช่แค่สูงพอ */
      const wideEnough = widest(page.left) + MIN_GAP
        + Math.max(TITLE_BLOCK.w, widest(page.right), s.w) <= roomX;
      if (wideEnough && hR + s.h + MIN_GAP <= colH - reserve) {
        page.right.push({ ...v, column: 'right' }); hR += s.h + MIN_GAP; continue;
      }
      pages.push(page);
      page = { left: [v], right: [] }; hL = s.h + MIN_GAP; hR = 0;
    }
    pages.push(page);
    return pages;
  };

  const build = (pages) => {
    const total = pages.length;
    return pages.map((p, k) => composeSheet([...p.left, ...p.right], {
      size: key,
      notes: k === total - 1 ? opt.notes : [],
      info: {
        ...(opt.info || {}),
        sheetNo: (k + 1) + ' / ' + total,
        drawingNo: opt.info && opt.info.drawingNo
          ? opt.info.drawingNo + (total > 1 ? '-' + (k + 1) : '')
          : (opt.info ? opt.info.drawingNo : ''),
      },
    }));
  };

  /* ★ วัดผลจริงหลังประกอบเสร็จ แล้วถอยรูปสุดท้ายไปแผ่นถัดไปถ้ายังล้น
     ตัวคำนวณล่วงหน้าไม่มีวันแม่นทุกกรณี จึงต้องมีด่านที่ดูของจริง
     วนได้จำกัดจำนวนรอบ เพื่อไม่ให้กลายเป็นวงวนไม่รู้จบ */
  let pages = pack(views);
  const MAX_REPACK = views.length + 2;
  for (let round = 0; round < MAX_REPACK; round++) {
    const sheets = build(pages);
    const bad = sheets.findIndex((s) => s.meta.violations.length > 0);
    if (bad < 0) return sheets;
    const p = pages[bad];
    const all = [...p.left, ...p.right];
    if (all.length <= 1) {
      const s = sheets[bad];
      throw new RangeError('composeSheetSet: แผ่นที่ ' + (bad + 1) + ' วางรูป '
        + all.map((v) => v.drawing.id).join(', ') + ' ลงกระดาษ ' + key + ' ไม่ได้ — ล้น '
        + s.meta.violations.map((x) => x.side + ' ' + x.mm.toFixed(1) + ' มม.').join(' · ')
        + ' — ต้องลดมาตราส่วนหรือเปลี่ยนขนาดกระดาษ');
    }
    /* ถอยรูปสุดท้ายของแผ่นที่ล้น ไปตั้งต้นแผ่นถัดไป */
    const moved = all[all.length - 1];
    const rest = all.slice(0, -1);
    const next = pages[bad + 1] ? [...pages[bad + 1].left, ...pages[bad + 1].right] : [];
    const rebuilt = [
      ...pages.slice(0, bad).map((q) => [...q.left, ...q.right]),
      rest,
      [{ ...moved, column: undefined }, ...next.map((v) => ({ ...v, column: undefined }))],
      ...pages.slice(bad + 2).map((q) => [...q.left, ...q.right]),
    ];
    pages = rebuilt.filter((g) => g.length).flatMap((g) => pack(g));
  }
  throw new RangeError('composeSheetSet: จัดหน้าไม่ลงตัวหลังพยายาม ' + MAX_REPACK
    + ' รอบ — ต้องทบทวนมาตราส่วนหรือขนาดกระดาษ');
}

/** ข้อความมาตราส่วนรวมของแผ่น เช่น "รูปตัด 1:50 · ผัง 1:100 · รายละเอียด 1:20" */
export const scaleSummary = (views) => {
  const scales = [...new Set(views.filter((v) => v.scale > 1).map((v) => v.scale))];
  if (!scales.length) return 'ไม่มีมาตราส่วน';
  if (scales.length === 1) return '1:' + scales[0];
  /* ธรรมเนียมงานเขียนแบบ: แผ่นที่มีหลายมาตราส่วนเขียน "ตามที่ระบุ" ในกรอบชื่อแบบ
     แล้วให้ชื่อรูปแต่ละรูปพกมาตราส่วนของตัวเองไป */
  return 'ตามที่ระบุ';
};

export { SHEET_SCALE };
