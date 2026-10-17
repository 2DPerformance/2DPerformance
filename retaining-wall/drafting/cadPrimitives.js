/**
 * โมเดล primitive กลางของงานเขียนแบบ
 *
 * สัญญาที่ห้ามผิด
 *   1. พิกัดทุกจุดเป็น "มิลลิเมตรของตัวอาคารจริง" (เช่น ฐานกว้าง 3.60 ม. → 3600)
 *      มาตราส่วนไปจัดการที่ viewport ตอน render ไม่ใช่ที่ geometry
 *   2. primitive ไม่มี สี ความหนาเส้น หรือชนิดเส้น อยู่ในตัว — มีแต่ projectionClass กับ layer
 *      renderer เป็นคนเปิด draftingStandard หาน้ำหนักเส้นเอง
 *   3. ค่าที่ไม่ใช่ตัวเลขจำกัดต้องโยน error ทันที ห้ามไหลเข้าไปในแบบ
 *      ค่าเพี้ยนใน CAD คือความเสียหายระดับหน้างาน ไม่ใช่แค่ภาพไม่สวย
 *
 * ไฟล์นี้ไม่ import draftingStandard โดยเจตนา — geometry ต้องไม่รู้จัก style
 */

const PROJECTION_CLASSES = new Set([
  'CUT', 'OUTLINE', 'REBAR', 'PROJECTION', 'HIDDEN', 'CENTRELINE', 'DIM', 'HATCH', 'BEYOND',
]);

/** ตัวเลขทุกตัวที่เข้าสู่แบบต้องผ่านด่านนี้ */
export function num(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new TypeError('cadPrimitives: ' + what + ' ต้องเป็นตัวเลขจำกัด แต่ได้ ' + String(v));
  }
  return v;
}
export function pt(x, y) {
  return { x: num(x, 'พิกัด x'), y: num(y, 'พิกัด y') };
}

function checkPc(pc) {
  if (!PROJECTION_CLASSES.has(pc)) {
    throw new RangeError('cadPrimitives: ไม่รู้จัก projection class "' + pc + '"');
  }
  return pc;
}

function checkLayer(layer) {
  if (typeof layer !== 'string' || !layer) throw new TypeError('cadPrimitives: ต้องระบุ layer');
  return layer;
}

/* ── primitive ── */

export const line = (a, b, pc, layer) => ({
  t: 'line', a: pt(a.x, a.y), b: pt(b.x, b.y), pc: checkPc(pc), layer: checkLayer(layer),
});

export const poly = (pts, pc, layer, closed = false) => {
  if (!Array.isArray(pts) || pts.length < 2) throw new TypeError('cadPrimitives: poly ต้องมีอย่างน้อย 2 จุด');
  return { t: 'poly', pts: pts.map((p) => pt(p.x, p.y)), closed: !!closed, pc: checkPc(pc), layer: checkLayer(layer) };
};

export const circle = (c, r, pc, layer, fill = false) => ({
  t: 'circle', c: pt(c.x, c.y), r: num(r, 'รัศมี'), fill: !!fill, pc: checkPc(pc), layer: checkLayer(layer),
});

export const arc = (c, r, a0, a1, pc, layer) => ({
  t: 'arc', c: pt(c.x, c.y), r: num(r, 'รัศมี'),
  a0: num(a0, 'มุมเริ่ม'), a1: num(a1, 'มุมจบ'), pc: checkPc(pc), layer: checkLayer(layer),
});

/**
 * ข้อความ — h เป็นความสูงบน "กระดาษ" (มม.) ไม่ใช่ในโมเดล
 * renderer จะคูณด้วยมาตราส่วนเอง เพื่อให้ตัวอักษรพิมพ์ออกมาสูงเท่ากันทุกมาตราส่วน
 */
export const text = (p, s, paperHeight, layer, opt = {}) => ({
  t: 'text', p: pt(p.x, p.y), s: String(s),
  h: num(paperHeight, 'ความสูงตัวอักษร'),
  align: opt.align || 'L',          // L C R | ML MC MR (m = กึ่งกลางแนวตั้ง)
  rot: num(opt.rot || 0, 'มุมหมุนข้อความ'),
  bold: !!opt.bold,
  layer: checkLayer(layer), pc: 'DIM',
});

/**
 * เส้นบอกระยะ — เก็บเฉพาะ "วัดจากไหนถึงไหน" กับ "เยื้องออกไปเท่าไร"
 * ตัวเลขคำนวณจากระยะจริงเสมอ ไม่ให้ใครพิมพ์ทับ (กันแบบที่ตัวเลขไม่ตรงรูป)
 */
export const dim = (a, b, offset, layer, opt = {}) => ({
  t: 'dim', a: pt(a.x, a.y), b: pt(b.x, b.y),
  off: num(offset, 'ระยะเยื้องเส้นบอกระยะ'),
  vertical: !!opt.vertical,
  note: opt.note ? String(opt.note) : null,   // ข้อความเสริม ต่อท้ายตัวเลข ไม่ใช่แทนที่
  /* ชื่อโซ่บอกระยะ · ระยะย่อยทุกเส้นในโซ่เดียวกันต้องรวมได้เท่าเส้น total ของโซ่นั้น
     ใช้ชื่อลงท้าย ':total' สำหรับเส้นรวม — เทสต์ปิดโซ่อ่านจากตรงนี้ */
  chain: opt.chain ? String(opt.chain) : null,
  /* ระยะจริงที่วัดได้ ล็อกไว้ตอนสร้าง — ใช้เมื่อรูปถูกย่อไปวางบนแผ่นกระดาษ
     null = คำนวณจากพิกัดปัจจุบัน (กรณีปกติที่ยังอยู่ในพิกัดของอาคาร) */
  measured: Number.isFinite(opt.measured) ? opt.measured : null,
  layer: checkLayer(layer), pc: 'DIM',
});

export const hatch = (pts, pattern, layer) => {
  if (!Array.isArray(pts) || pts.length < 3) throw new TypeError('cadPrimitives: hatch ต้องมีอย่างน้อย 3 จุด');
  return { t: 'hatch', pts: pts.map((p) => pt(p.x, p.y)), pattern: String(pattern), layer: checkLayer(layer), pc: 'HATCH' };
};

/** เครื่องหมายระดับ +/− แบบสามเหลี่ยมชี้ลง */
export const levelMark = (p, value, layer, opt = {}) => ({
  t: 'level', p: pt(p.x, p.y), value: num(value, 'ค่าระดับ'),
  side: opt.side === 'left' ? 'left' : 'right',
  /* ยืดออกไปวางป้ายนอกรูปที่พิกัด x นี้ ด้วยเส้นประ — กันป้ายระดับไปกองกันที่ผิวชิ้นส่วน
     null = วางติดจุดที่วัด (พฤติกรรมเดิม) */
  extendTo: opt.extendTo == null ? null : num(opt.extendTo, 'พิกัดปลายเส้นระดับ'),
  layer: checkLayer(layer), pc: 'DIM',
});

/** เครื่องหมายแนวตัด A-A */
export const sectionMark = (a, b, label, layer, opt = {}) => ({
  t: 'sectionMark', a: pt(a.x, a.y), b: pt(b.x, b.y), label: String(label),
  flip: !!opt.flip, layer: checkLayer(layer), pc: 'CENTRELINE',
});

/** เส้นชี้ป้าย — จุดสุดท้ายคือที่วางข้อความ */
export const leader = (pts, label, paperHeight, layer) => {
  if (!Array.isArray(pts) || pts.length < 2) throw new TypeError('cadPrimitives: leader ต้องมีอย่างน้อย 2 จุด');
  return {
    t: 'leader', pts: pts.map((p) => pt(p.x, p.y)), label: String(label),
    h: num(paperHeight, 'ความสูงตัวอักษร'), layer: checkLayer(layer), pc: 'DIM',
  };
};

/* ── รวมเป็นรูป ── */

/**
 * @param {string} id       รหัสรูป เช่น 'RW-01'
 * @param {string} title    ชื่อรูปภาษาไทย
 * @param {Array}  entities primitive ทั้งหมด
 * @param {object} meta     ข้อมูลประกอบ เช่น มาตราส่วนที่ตั้งใจ
 */
export function drawing(id, title, entities, meta = {}) {
  if (!Array.isArray(entities)) throw new TypeError('drawing: entities ต้องเป็น array');
  return Object.freeze({
    id: String(id), title: String(title),
    entities, meta: Object.freeze({ ...meta }),
    bbox: bboxOf(entities),
  });
}

/** กรอบครอบทุก primitive — ใช้จัดรูปลงกระดาษ */
export function bboxOf(entities) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const eat = (p) => { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; };
  for (const e of entities) {
    switch (e.t) {
      case 'line': case 'dim': case 'sectionMark': eat(e.a); eat(e.b); break;
      case 'poly': case 'hatch': e.pts.forEach(eat); break;
      case 'leader': e.pts.forEach(eat); break;
      case 'circle': case 'arc':
        eat({ x: e.c.x - e.r, y: e.c.y - e.r }); eat({ x: e.c.x + e.r, y: e.c.y + e.r }); break;
      case 'text': eat(e.p); break;
      case 'level': eat(e.p); if (e.extendTo != null) eat({ x: e.extendTo, y: e.p.y }); break;
      default: throw new RangeError('bboxOf: ไม่รู้จัก primitive ชนิด "' + e.t + '"');
    }
  }
  if (!Number.isFinite(x0)) return { min: pt(0, 0), max: pt(0, 0) };
  return { min: pt(x0, y0), max: pt(x1, y1) };
}

/** ระยะที่เส้นบอกระยะหนึ่งเส้นวัดได้จริง — ตัวเลขในแบบมาจากฟังก์ชันนี้เท่านั้น */
export const dimLength = (d) => (Number.isFinite(d.measured)
  ? d.measured
  : (d.vertical ? Math.abs(d.b.y - d.a.y) : Math.abs(d.b.x - d.a.x)));

/** ด่านตรวจก่อนส่งรูปออกไป render — เรียกในเทสต์และก่อนส่งออกไฟล์ */
export function assertDrawingSound(dwg) {
  const bad = [];
  const walk = (v, path) => {
    if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(path + ' = ' + v); return; }
    if (Array.isArray(v)) { v.forEach((x, n) => walk(x, path + '[' + n + ']')); return; }
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) walk(v[k], path + '.' + k); }
  };
  walk(dwg.entities, dwg.id + '.entities');
  if (bad.length) throw new Error('รูป ' + dwg.id + ' มีค่าที่ใช้ไม่ได้: ' + bad.slice(0, 5).join(', '));
  for (const e of dwg.entities) {
    if (!PROJECTION_CLASSES.has(e.pc)) throw new RangeError('รูป ' + dwg.id + ': primitive "' + e.t + '" ไม่มี projection class ที่ถูกต้อง');
    if (!e.layer) throw new Error('รูป ' + dwg.id + ': primitive "' + e.t + '" ไม่มี layer');
  }
  return true;
}
