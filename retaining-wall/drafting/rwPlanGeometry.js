/**
 * RW-02 · ผังฐานราก — มองลงจากด้านบน
 *
 * ระนาบตัดเป็นแนวนอนเหนือผิวบนฐานเล็กน้อย ดังนั้น
 *   พนัง        ถูกตัด → เส้น CUT + ลายคอนกรีต
 *   ขอบฐานราก  อยู่ใต้ระนาบแต่มองเห็น → เส้น OUTLINE
 *   ท่อระบายน้ำหลังพนัง อยู่ใต้ดิน → เส้น HIDDEN
 *
 * ระบบพิกัดของแผ่นนี้ต่างจากรูปตัด (ตั้งใจ)
 *   x = ตามความยาวกำแพง 0…Lw   (วางนอนเพื่อให้แผ่นเป็นแนวนอน อยู่ในจอเดียว)
 *   y = ตามความกว้างฐาน 0…B    (y = 0 คือปลาย toe · y = B คือปลาย heel)
 *
 * ทุกระยะมาจาก Snapshot ของ engine และ constructionSpec ที่ Snapshot ส่งให้เท่านั้น
 */
import { poly, circle, text, dim, hatch, sectionMark, leader, drawing } from './cadPrimitives.js';

const M = 1000;
/* มาตราส่วนของแผ่นนี้ — ระยะเยื้องป้ายต้องคิดเป็น 'มิลลิเมตรบนกระดาษ' แล้วคูณกลับ
   ถ้าฝังเป็นมิลลิเมตรของอาคาร พอเปลี่ยนมาตราส่วนป้ายจะทับกันทันที (เจอจริง 1:50 → 1:100) */
const SCALE = 100;
const P = (paperMm) => paperMm * SCALE;
const LY = {
  CONCRETE: 'RW-CONCRETE', SOIL: 'RW-SOIL', WATER: 'RW-WATER',
  DIM: 'RW-DIM', TEXT: 'RW-TEXT', HATCH: 'RW-HATCH', MARK: 'RW-MARK', GRID: 'RW-GRID',
};

/** แบ่งความยาวกำแพงเป็นช่วงรอยต่อ — ช่วงสุดท้ายรับเศษ ไม่ปัดทิ้ง */
function jointBays(Lw, joint) {
  if (!(joint > 0) || joint >= Lw) return [Lw];
  const n = Math.ceil(Lw / joint);
  const even = Lw / n;
  return Array.from({ length: n }, () => even);
}

/**
 * สร้างผังฐานราก RW-02
 * @param {object} r ผลจาก designRetainingWall()
 * @param {object} spec constructionSpec ที่สร้างและถือครองโดย Snapshot
 */
export function retainingWallPlan(r, spec) {
  if (!r || !r.i) throw new TypeError('retainingWallPlan: ต้องส่งผลคำนวณจาก designRetainingWall()');
  if (r.soldier) throw new RangeError('retainingWallPlan: รุ่นนี้เขียนแบบเฉพาะกำแพงยื่นบนฐานแผ่');
  if (!spec || typeof spec !== 'object') {
    throw new TypeError('retainingWallPlan: ต้องส่ง constructionSpec จาก Snapshot');
  }
  for (const key of ['joint', 'weep', 'filter']) {
    if (!Object.prototype.hasOwnProperty.call(spec, key) || !Number.isFinite(spec[key])) {
      throw new TypeError('retainingWallPlan: constructionSpec.' + key + ' ต้องเป็นค่าจาก Snapshot');
    }
  }
  if (spec.joint <= 0 || spec.weep < 0 || spec.filter < 0) {
    throw new RangeError('retainingWallPlan: constructionSpec joint ต้องมากกว่าศูนย์ และ weep/filter ต้องไม่ติดลบ');
  }

  const i = r.i;
  for (const key of ['Lw', 'B', 't']) {
    if (!Number.isFinite(i[key]) || i[key] <= 0) {
      throw new TypeError('retainingWallPlan: ต้องมี i.' + key + ' จาก input ที่ normalize แล้ว');
    }
  }
  for (const key of ['toe', 'heel']) {
    if (!Number.isFinite(i[key]) || i[key] < 0) {
      throw new TypeError('retainingWallPlan: ต้องมี i.' + key + ' จาก input ที่ normalize แล้ว');
    }
  }
  if (Math.abs(i.B - (i.toe + i.t + i.heel)) > 1e-6) {
    throw new RangeError('retainingWallPlan: i.B ไม่ตรงกับ toe + t + heel ใน Snapshot');
  }
  const toe = i.toe * M, t = i.t * M, heel = i.heel * M;
  const B = i.B * M;
  const Lw = i.Lw * M;
  const joint = spec.joint * M;
  const weep = spec.weep * M;
  const filter = spec.filter * M;

  const yF = toe, yB = toe + t;              // ผิวหน้า/ผิวหลังของพนังในผัง
  const E = [];

  /* ── 1. ขอบฐานราก (อยู่ใต้ระนาบตัด จึงเป็นเส้นขอบไม่ใช่เส้นตัด) ── */
  E.push(poly([
    { x: 0, y: 0 }, { x: Lw, y: 0 }, { x: Lw, y: B }, { x: 0, y: B },
  ], 'OUTLINE', LY.CONCRETE, true));

  /* ── 2. พนัง — ระนาบตัดผ่าน ── */
  const stemPts = [{ x: 0, y: yF }, { x: Lw, y: yF }, { x: Lw, y: yB }, { x: 0, y: yB }];
  E.push(hatch(stemPts, 'CONCRETE', LY.HATCH));
  E.push(poly(stemPts, 'CUT', LY.CONCRETE, true));

  /* ── 2ข. ครีบยึด (counterfort) — ระนาบตัดผ่านครีบเช่นกัน → CUT + ลาย ──
     ★ ตำแหน่งต้องฉายระยะ c/c = r.Lt ที่ engine ส่งมาโดยตรงจากปลายซ้าย
     ช่วงท้ายจึงสั้นกว่า — ห้ามเกลี่ยระยะให้เท่ากันหรือสร้าง Lt = L+bs ซ้ำใน renderer
     เพราะจะได้ช่วงว่างกว้างกว่า L ที่ใช้ออกแบบพนัง = แบบไม่อนุรักษ์กว่าการคำนวณ */
  const ribX = [];
  if (r.mode === 'but') {
    if (!Number.isFinite(r.cfLr) || r.cfLr <= 0) {
      throw new TypeError('retainingWallPlan: counterfort ต้องมี cfLr จากผลคำนวณ');
    }
    if (!r.qty || !Number.isInteger(r.qty.nBut) || r.qty.nBut < 2) {
      throw new TypeError('retainingWallPlan: counterfort ต้องมีจำนวนครีบ nBut จาก BBS/Snapshot');
    }
    if (!Number.isFinite(r.Lt) || r.Lt <= 0) {
      throw new TypeError('retainingWallPlan: counterfort ต้องมี r.Lt จากผลคำนวณ');
    }
    if (!Number.isFinite(i.bs) || i.bs <= 0 || !Number.isFinite(i.L) || i.L <= 0) {
      throw new TypeError('retainingWallPlan: counterfort ต้องมี i.bs/i.L จาก input ที่ normalize แล้ว');
    }
    const bsR = i.bs * M, LtR = r.Lt * M;
    const cfLr = r.cfLr * M;
    const nBut = r.qty.nBut;
    const yRib1 = Math.min(yB + cfLr, B);
    for (let k = 0; k < nBut; k++) {
      const x0 = Math.min(k * LtR, Lw - bsR);
      ribX.push(x0);
      const ribPts = [{ x: x0, y: yB }, { x: x0 + bsR, y: yB }, { x: x0 + bsR, y: yRib1 }, { x: x0, y: yRib1 }];
      E.push(hatch(ribPts, 'CONCRETE', LY.HATCH));
      E.push(poly(ribPts, 'CUT', LY.CONCRETE, true));
    }
    const mid = ribX[Math.min(1, ribX.length - 1)];
    /* แยกแถบป้ายบนเป็น lane แนวตั้งบนกระดาษ: filter +6 · weep +12 · rib +18 มม.
       ป้ายครีบจึงไม่ทับทั้งป้ายท่อกรองและตัว A ของแนวตัดหลัง compose ลงแผ่น */
    E.push(leader([
      { x: mid + bsR / 2, y: (yB + yRib1) / 2 },
      { x: mid + bsR / 2 + P(7), y: B + P(18) },
    ],
      'ครีบยึด ' + (i.bs).toFixed(2) + '×' + (cfLr / M).toFixed(2) + ' ม. × ' + nBut +
      ' ตัว @' + (r.Lt).toFixed(2) + ' ม. (ช่วงว่าง ≤ ' + (i.L).toFixed(2) + ' ม.)', 3.5, LY.TEXT));
    if (ribX.length > 1) {
      E.push(dim({ x: ribX[0], y: B }, { x: ribX[1], y: B }, P(6), LY.DIM, { chain: 'rib' }));
    }
  }

  /* ── 3. รอยต่อก่อสร้าง — ตัดขาดทั้งพนังและฐาน ── */
  const bays = jointBays(Lw, joint);
  let x = 0;
  const jointX = [];
  for (let k = 0; k < bays.length - 1; k++) {
    x += bays[k];
    jointX.push(x);
    E.push(poly([{ x, y: -P(2) }, { x, y: B + P(2) }], 'CENTRELINE', LY.GRID));
  }
  if (jointX.length) {
    E.push(leader([{ x: jointX[0], y: B * 0.18 }, { x: jointX[0] + P(5), y: -P(5) }],
      'รอยต่อก่อสร้าง @ ' + (bays[0] / M).toFixed(2) + ' ม.', 3.5, LY.TEXT));
  }

  /* ── 4. ท่อระบายน้ำหลังพนัง + ชั้นกรอง (อยู่ใต้ดิน จึงเป็นเส้นบัง) ── */
  if (filter > 0) {
    const yD = Math.min(yB + filter / 2, B - 60);
    E.push(poly([{ x: 0, y: yD }, { x: Lw, y: yD }], 'HIDDEN', LY.WATER));
    E.push(leader([{ x: Lw * 0.72, y: yD }, { x: Lw * 0.72 + P(5), y: B + P(6) }],
      'ท่อระบายน้ำ + ชั้นกรองหลังพนัง กว้าง ' + (filter / M).toFixed(2) + ' ม.', 3.5, LY.TEXT));
  }

  /* ── 5. รูระบายน้ำผ่านพนัง ── */
  const weepX = [];
  if (weep > 0) {
    const n = Math.floor(Lw / weep);
    for (let k = 0; k <= n; k++) {
      const wx = (Lw - n * weep) / 2 + k * weep;
      weepX.push(wx);
      E.push(circle({ x: wx, y: (yF + yB) / 2 }, 37.5, 'HIDDEN', LY.WATER, false));
    }
    if (weepX.length) {
      E.push(leader([{ x: weepX[Math.floor(weepX.length / 2)], y: (yF + yB) / 2 },
        { x: weepX[Math.floor(weepX.length / 2)] + P(5), y: B + P(12) }],
        'รูระบายน้ำ Ø75 @ ' + (weep / M).toFixed(2) + ' ม.', 3.5, LY.TEXT));
    }
  }

  /* ── 6. แนวตัด A-A ตรงกับรูป RW-01 ── */
  const xCut = Lw * 0.28;
  E.push(sectionMark({ x: xCut, y: -P(5) }, { x: xCut, y: B + P(5) }, 'A', LY.MARK));

  /* ── 7. บอกระยะ ── */
  const dimBelow = -P(11);
  let acc = 0;
  for (const bay of bays) {
    E.push(dim({ x: acc, y: 0 }, { x: acc + bay, y: 0 }, dimBelow, LY.DIM, { chain: 'length' }));
    acc += bay;
  }
  E.push(dim({ x: 0, y: 0 }, { x: Lw, y: 0 }, dimBelow - P(9), LY.DIM, { chain: 'length:total' }));

  const dimLeft = -P(11);
  E.push(dim({ x: 0, y: 0 }, { x: 0, y: yF }, dimLeft, LY.DIM, { vertical: true, chain: 'width' }));
  E.push(dim({ x: 0, y: yF }, { x: 0, y: yB }, dimLeft, LY.DIM, { vertical: true, chain: 'width' }));
  E.push(dim({ x: 0, y: yB }, { x: 0, y: B }, dimLeft, LY.DIM, { vertical: true, chain: 'width' }));
  E.push(dim({ x: 0, y: 0 }, { x: 0, y: B }, dimLeft - P(9), LY.DIM, { vertical: true, chain: 'width:total' }));

  /* ── 8. ป้ายชิ้นส่วน ── */
  E.push(text({ x: Lw * 0.16, y: (yF + yB) / 2 }, 'พนัง ' + (t / M).toFixed(2) + ' ม.', 2.5, LY.TEXT, { align: 'MC' }));
  E.push(text({ x: Lw * 0.16, y: yF / 2 }, 'toe ' + (toe / M).toFixed(2) + ' ม.', 2.5, LY.TEXT, { align: 'MC' }));
  E.push(text({ x: Lw * 0.16, y: yB + heel / 2 }, 'heel ' + (heel / M).toFixed(2) + ' ม.', 2.5, LY.TEXT, { align: 'MC' }));

  /* ── 9. ชื่อรูปและหมายเหตุ ── */
  E.push(text({ x: 0, y: dimBelow - P(20) }, 'ผังฐานราก   มาตราส่วน 1:' + SCALE, 5.0, LY.TEXT, { bold: true }));
  /* หมายเหตุอยู่ในบล็อกหมายเหตุทั่วไปของแผ่น */

  return drawing('RW-02', 'ผังฐานราก', E, {
    scale: SCALE,
    origin: 'ปลาย toe ที่ปลายกำแพงด้านซ้าย',
    wallLength: Lw,
    bays: bays.length,
    weepHoles: weepX.length,
    ribs: ribX.length,
    constructionSpec: { joint: spec.joint, weep: spec.weep, filter: spec.filter },
  });
}
