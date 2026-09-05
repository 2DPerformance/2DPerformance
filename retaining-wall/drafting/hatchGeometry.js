/**
 * ลายหน้าตัด — แปลงรูปหลายเหลี่ยม + ชื่อลาย เป็นเส้นและจุดจริง
 *
 * ทำไมต้องแยกออกมา:
 * SVG กับ DXF ต้องได้ลายเดียวกันเป๊ะ ถ้าต่างคนต่างสร้าง วันหนึ่งแบบบนจอกับแบบใน CAD
 * จะไม่ตรงกันโดยไม่มีใครสังเกต — และแบบสองใบที่ไม่ตรงกันคือปัญหาหน้างานเสมอ
 *
 * ผลลัพธ์ต้อง deterministic: ลายโปรยจุดใช้ตัวสุ่มที่ seed มาจากรูปหลายเหลี่ยมนั้นเอง
 * ไม่ใช่ Math.random เพราะแบบที่วาดสองครั้งแล้วไม่เหมือนกันเทียบไม่ได้
 *
 * ระยะของลายเป็น "มิลลิเมตรบนกระดาษ" จึงต้องคูณมาตราส่วนเข้าไปก่อนใช้กับพิกัดโมเดล
 */
import { HATCH_PATTERN, paperToModel } from './draftingStandard.js';
import { bboxOf } from './cadPrimitives.js';

export function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ตัดเส้นตรงด้วยรูปหลายเหลี่ยม คืนช่วงที่อยู่ข้างใน (เรียงตาม t) */
export function clipSegment(ax, ay, bx, by, pts) {
  const ts = [0, 1];
  const dx = bx - ax, dy = by - ay;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const x1 = pts[j].x, y1 = pts[j].y, x2 = pts[i].x, y2 = pts[i].y;
    const ex = x2 - x1, ey = y2 - y1;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((x1 - ax) * ey - (y1 - ay) * ex) / den;
    const u = ((x1 - ax) * dy - (y1 - ay) * dx) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i < ts.length - 1; i++) {
    const tm = (ts[i] + ts[i + 1]) / 2;
    if (pointInPoly(ax + dx * tm, ay + dy * tm, pts)) {
      out.push([ax + dx * ts[i], ay + dy * ts[i], ax + dx * ts[i + 1], ay + dy * ts[i + 1]]);
    }
  }
  return out;
}

/** ตัวสุ่มที่ทำซ้ำได้ — seed มาจากรูปหลายเหลี่ยมเอง */
export function seededRandom(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

export const polySeed = (pts) => {
  let h = 2166136261;
  for (const p of pts) {
    h = Math.imul(h ^ Math.round(p.x), 16777619);
    h = Math.imul(h ^ Math.round(p.y), 16777619);
  }
  return h >>> 0;
};

/**
 * สร้างเส้นและจุดของลายหน้าตัดหนึ่งชิ้น
 *
 * ★ ลำดับการสร้างสำคัญ — ทั้ง SVG และ DXF ต้องได้ลำดับเดียวกัน
 *   จึงคืนเป็นอาร์เรย์ที่เรียงแล้ว ไม่ใช่ set
 *
 * @param {object} e      primitive ชนิด hatch
 * @param {number} scale  ส่วนหลังของ 1:N
 * @returns {{segs: Array<[number,number,number,number]>, dots: Array<{x:number,y:number,r:number}>}}
 */
export function hatchSegments(e, scale) {
  const pat = HATCH_PATTERN[e.pattern];
  if (!pat) throw new RangeError('hatchSegments: ไม่รู้จักลายหน้าตัด "' + e.pattern + '"');
  const P = (paperMm) => paperToModel(paperMm, scale);
  const hb = bboxOf([{ t: 'poly', pts: e.pts, pc: 'HATCH', layer: e.layer, closed: true }]);
  const segs = [];
  const dots = [];

  if (pat.kind === 'lines' || pat.kind === 'cross') {
    const angles = pat.kind === 'cross' ? [pat.angle, pat.angle + 90] : [pat.angle];
    const step = P(pat.spacing);
    for (const ang of angles) {
      const a = (ang * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const nx = -dy, ny = dx;                       // ทิศตั้งฉากกับเส้นลาย
      const corners = [
        { x: hb.min.x, y: hb.min.y }, { x: hb.max.x, y: hb.min.y },
        { x: hb.max.x, y: hb.max.y }, { x: hb.min.x, y: hb.max.y },
      ];
      const proj = corners.map((c) => c.x * nx + c.y * ny);
      const span = Math.hypot(hb.max.x - hb.min.x, hb.max.y - hb.min.y);
      const kMin = Math.ceil(Math.min(...proj) / step);
      const kMax = Math.floor(Math.max(...proj) / step);
      for (let k = kMin; k <= kMax; k++) {
        const px = nx * k * step, py = ny * k * step;
        for (const s of clipSegment(px - dx * span, py - dy * span, px + dx * span, py + dy * span, e.pts)) {
          segs.push(s);
        }
      }
    }
  } else if (pat.kind === 'stipple') {
    const area = (hb.max.x - hb.min.x) * (hb.max.y - hb.min.y);
    const paperArea = area / (scale * scale);
    const count = Math.min(4000, Math.round(paperArea * pat.density));
    const rnd = seededRandom(polySeed(e.pts));
    const dotR = P(0.25);
    let placed = 0;
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const px = hb.min.x + rnd() * (hb.max.x - hb.min.x);
      const py = hb.min.y + rnd() * (hb.max.y - hb.min.y);
      if (!pointInPoly(px, py, e.pts)) continue;
      placed++;
      if (placed % pat.dashEvery === 0) {
        const half = P(pat.dashLength) / 2;
        segs.push([px - half, py, px + half, py]);
      } else {
        dots.push({ x: px, y: py, r: dotR });
      }
    }
  } else if (pat.kind === 'water') {
    const step = P(pat.spacing);
    for (let y = hb.min.y + step; y < hb.max.y; y += step) {
      for (const s of clipSegment(hb.min.x, y, hb.max.x, y, e.pts)) segs.push(s);
    }
  }

  return { segs, dots };
}
