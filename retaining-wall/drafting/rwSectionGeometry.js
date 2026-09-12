/**
 * RW-01 · รูปตัดขวางกำแพงกันดิน — สร้าง primitive จากผลคำนวณ
 *
 * กฎเหล็กของไฟล์นี้
 *   1. ทุกมิติมาจาก snapshot ของ engine เท่านั้น ห้ามคำนวณค่าทางวิศวกรรมซ้ำที่นี่
 *      (คำนวณได้เฉพาะ "ตำแหน่งบนกระดาษ" เช่น เอา cover มาลบจากผิว)
 *   2. ไม่ import draftingStandard — ไม่รู้จักสีหรือความหนาเส้น รู้แค่ projection class
 *   3. พิกัดเป็นมิลลิเมตรของตัวอาคารจริง จุดกำเนิดอยู่ที่มุมล่างด้านหน้าของฐาน
 *      แกน x ชี้เข้าหาดินถม แกน y ชี้ขึ้น
 *
 * หน่วยที่ engine ใช้ (ยืนยันจากโค้ด ไม่ใช่เดา)
 *   ความยาว   เมตร        → คูณ 1000
 *   cov, db   มิลลิเมตร   → ใช้ตรง ๆ
 *   ระยะหุ้มพนังใช้ค่าที่ผู้ใช้กรอก · ระยะหุ้มฐานราก 75 มม. ตายตัว (หล่อติดดิน)
 */
import { line, poly, circle, text, dim, hatch, levelMark, sectionMark, leader, drawing } from './cadPrimitives.js';
import { barName } from './draftingStandard.js';

const M = 1000;
/* มาตราส่วนของแผ่นนี้ — ระยะเยื้องป้ายคิดเป็นมิลลิเมตรบนกระดาษแล้วคูณกลับ
   (เหตุผลเดียวกับ RW-02: ระยะที่ฝังเป็นมิลลิเมตรของอาคารจะพังเมื่อเปลี่ยนมาตราส่วน) */
const SCALE = 50;
const P = (paperMm) => paperMm * SCALE;
const LY = {
  CONCRETE: 'RW-CONCRETE', REBAR: 'RW-REBAR', SOIL: 'RW-SOIL', WATER: 'RW-WATER',
  DIM: 'RW-DIM', TEXT: 'RW-TEXT', HATCH: 'RW-HATCH', MARK: 'RW-MARK',
};

/** ระยะหุ้มของฐานรากที่ engine ใช้จริง — ได้จากการถอดกลับจาก d ไม่ใช่ค่าที่ตั้งเอง */
export function footingCovers(r) {
  const hz = r.i.hz * M;
  const db = r.i.db;                       // มม.
  const fromTop = hz - r.dH * M;           // = cover + db/2
  const fromBot = hz - r.dT * M;
  return {
    top: fromTop - db / 2,
    earth: fromBot - db / 2,
    barCentreTop: fromTop,                 // ระยะจากผิวบนถึงศูนย์กลางเหล็กบน
    barCentreBot: fromBot,
  };
}

export const bbsRow = (r, mk) => (r.qty && r.qty.bbs ? r.qty.bbs.find((b) => b.mk === mk) : null);

/** อ่านระยะเรียงจากคอลัมน์ detail ของ BBS — ไม่ตรงรูปแบบถือเป็นความผิดพลาด ไม่เดา */
export function spacingOf(row, mk) {
  const m = String(row && row.detail).match(/@(\d+(?:\.\d+)?)/);
  if (!m) throw new RangeError('rwSectionGeometry: อ่านระยะเรียงของเหล็ก ' + mk + ' ไม่ได้จาก "' + (row && row.detail) + '"');
  return Number(m[1]);
}

/**
 * ด่านข้อมูลของกำแพงมีครีบ — ชั้นวาดรูปอ่านค่าจาก engine/BBS เท่านั้น
 * ข้อมูลขาดหรือขัดกันต้องหยุด ไม่ย้อนกลับไปเดา geometry/เหล็กจากค่า input อื่น
 */
function counterfortContract(r) {
  const fail = (field) => {
    throw new TypeError('rwSectionGeometry: counterfort ขาดข้อมูล authoritative ' + field);
  };
  const positive = (v) => Number.isFinite(v) && v > 0;
  const i = r.i || {};
  if (!positive(r.cfLr)) fail('cfLr');
  if (!positive(r.cfHr)) fail('cfHr');
  if (!positive(i.L)) fail('i.L');
  if (!positive(i.bs)) fail('i.bs');
  if (!r.qty || !Number.isInteger(r.qty.nBut) || r.qty.nBut < 1) fail('qty.nBut');

  if (!Array.isArray(r.strips) || !r.strips.length) fail('strips');
  r.strips.forEach((strip, k) => {
    if (!Number.isFinite(strip.z1) || !Number.isFinite(strip.z2) || strip.z2 <= strip.z1) {
      fail('strips[' + k + '].z1/z2');
    }
    for (const face of ['b_', 'b$']) {
      const b = strip[face];
      if (!b || !positive(b.db) || !positive(b.s)) fail('strips[' + k + '].' + face);
    }
  });

  for (const name of ['barH_', 'barH$', 'barT', 'barFT']) {
    const b = r[name];
    if (!b || !positive(b.db) || !positive(b.s)) fail(name);
  }

  const but = r.but;
  const finCut = but && but.finCut;
  if (!but) fail('but');
  if (!positive(but.barSize)) fail('but.barSize');
  if (typeof but.barPre !== 'string' || !but.barPre.trim()) fail('but.barPre');
  if (!finCut) fail('but.finCut');
  if (!Number.isInteger(finCut.nFul) || finCut.nFul < 1) fail('but.finCut.nFul');
  if (!Number.isInteger(finCut.nCut) || finCut.nCut < 0) fail('but.finCut.nCut');
  if (!positive(finCut.cutLen) || finCut.cutLen > r.cfHr) fail('but.finCut.cutLen');
  if (!positive(finCut.frac) || finCut.frac > 1) fail('but.finCut.frac');
  if (!positive(finCut.db) || finCut.db !== but.barSize) fail('but.finCut.db');

  if (!Array.isArray(r.qty.bbs)) fail('qty.bbs');
  const rows = Object.fromEntries(r.qty.bbs.map((row) => [row.mk, row]));
  const required = ['①a', '①b', '②', '③', '④', '⑤', '⑥', '⑧', '⑦a', '⑦b'];
  if (finCut.nCut > 0) required.push('⑥b');
  for (const mk of required) {
    if (!rows[mk] || !positive(rows[mk].size)) fail('BBS ' + mk);
  }
  const spacing = (mk) => {
    const m = String(rows[mk] && rows[mk].detail).match(/@(\d+(?:\.\d+)?)/);
    const value = m ? Number(m[1]) : NaN;
    if (!positive(value)) fail('BBS ' + mk + ' spacing');
    return value;
  };
  const bend = (mk, keys) => {
    const b = rows[mk] && rows[mk].bend;
    if (!b || keys.some((key) => !positive(b[key]))) fail('BBS ' + mk + ' bend');
  };
  const s2 = spacing('②');
  spacing('⑦a');
  spacing('⑦b');
  const s8 = spacing('⑧');
  bend('②', ['b']);
  bend('⑤', ['a', 'b']);
  bend('⑧', ['b']);
  bend('⑦a', ['b']);
  bend('⑦b', ['b']);

  const mainName = but.barPre.trim() + but.barSize;
  if (rows['⑥'].size !== but.barSize
      || !String(rows['⑥'].detail).includes(finCut.nFul + '-' + mainName + '/ครีบ')) {
    fail('BBS ⑥ ↔ finCut');
  }
  if (finCut.nCut > 0 && (rows['⑥b'].size !== but.barSize
      || !String(rows['⑥b'].detail).includes(finCut.nCut + '-' + mainName + '/ครีบ'))) {
    fail('BBS ⑥b ↔ finCut');
  }
  if (rows['②'].size <= 0 || rows['⑧'].size !== r.barFT.db || s8 !== r.barFT.s) {
    fail('BBS ②/⑧ ↔ bar result');
  }

  return { strips: r.strips, rows, but, finCut, s2 };
}

/**
 * ด่านข้อมูลของ Cantilever/Gravity — renderer ห้ามสร้าง DB/spacing/bend เอง
 * เมื่อ BBS หรือผลเหล็ก authoritative ขาด ให้หยุดทั้งรูปตัดแทนการวาดค่าตั้งต้น
 */
function cantileverContract(r) {
  const fail = (field) => {
    throw new TypeError('rwSectionGeometry: cantilever/gravity ขาดข้อมูล authoritative ' + field);
  };
  const positive = (value) => Number.isFinite(value) && value > 0;
  if (!r.qty || !Array.isArray(r.qty.bbs)) fail('qty.bbs');
  const rows = Object.fromEntries(r.qty.bbs.map((row) => [row.mk, row]));
  const spacing = {};
  for (const mk of ['①', '②', '③', '④', '⑤', '⑥', '⑧']) {
    const row = rows[mk];
    if (!row || !positive(row.size)) fail('BBS ' + mk);
    spacing[mk] = spacingOf(row, mk);
    if (!positive(spacing[mk])) fail('BBS ' + mk + ' spacing');
  }
  const requireBend = (mk, keys) => {
    const bend = rows[mk]?.bend;
    if (!bend || keys.some((key) => !positive(bend[key]))) fail('BBS ' + mk + ' bend');
  };
  requireBend('①', ['a', 'b']);
  requireBend('②', ['a', 'c']);
  requireBend('④', ['a', 'b']);
  requireBend('⑤', ['a', 'b']);
  requireBend('⑧', ['b']);

  const stemBar = Array.isArray(r.stemTab) && r.stemTab.length
    ? r.stemTab[r.stemTab.length - 1].bar : null;
  const barH = r.barH_;
  const barT = r.barT;
  if (!stemBar || !positive(stemBar.db) || !positive(stemBar.s)) fail('stemTab.bar');
  if (!barH || !positive(barH.db) || !positive(barH.s)) fail('barH_');
  if (!barT || !positive(barT.db) || !positive(barT.s)) fail('barT');
  if (rows['①'].size !== stemBar.db || spacing['①'] !== stemBar.s) fail('BBS ① ↔ stemTab.bar');
  if (rows['④'].size !== barH.db || spacing['④'] !== barH.s) fail('BBS ④ ↔ barH_');
  if (rows['⑤'].size !== barT.db || spacing['⑤'] !== barT.s) fail('BBS ⑤ ↔ barT');

  return { rows, spacing, stemBar, barH, barT };
}

/** ตำแหน่งเหล็กในแนวเรียง — คิดจากดัชนี ไม่สะสมค่า จะได้ไม่คลาดสะสม */
export function runPositions(start, step, end) {
  const n = Math.floor((end - start) / step + 1e-9);
  return Array.from({ length: Math.max(n + 1, 0) }, (_, k) => start + k * step);
}

/**
 * สร้างรูปตัดขวาง RW-01
 * @param {object} r ผลจาก designRetainingWall()
 * @returns {object} drawing ที่พร้อมส่งเข้า renderer
 */
export function retainingWallSection(r) {
  if (!r || !r.i) throw new TypeError('retainingWallSection: ต้องส่งผลคำนวณจาก designRetainingWall()');
  if (r.soldier) throw new RangeError('retainingWallSection: รุ่นนี้เขียนแบบเฉพาะกำแพงยื่นบนฐานแผ่ ยังไม่รองรับเข็มพืด');

  const i = r.i;
  const toe = i.toe * M, t = i.t * M, heel = i.heel * M;
  const B = toe + t + heel;
  const hz = i.hz * M, hp = i.hp * M, dk = (i.dk || 0) * M;
  const tTop = (r.tTop != null ? r.tTop : i.ttop || i.t) * M;
  const yT = hz, yC = hz + hp;
  const xF = toe, xB = toe + t, xBT = toe + tTop;
  const cS = i.cov;                                   // ระยะหุ้มพนัง (มม.)
  const cov = footingCovers(r);

  /** ผิวหลังพนังที่ระดับ y (รองรับพนังสอบ) */
  const xBack = (y) => xB + (xBT - xB) * ((y - yT) / hp);
  const secant = Math.hypot(hp, xBT - xB) / hp;       // ชดเชยระยะหุ้มบนผิวเอียง

  const E = [];

  /* ── 1. ดินและน้ำ (วางก่อนคอนกรีตเพื่อให้คอนกรีตทับด้านบน) ──
     ระยะดินและระยะป้ายคุมไว้ให้แคบพอที่รูปทั้งแผ่นจะอยู่ในหน้าจอเดียวโดยไม่ต้องเลื่อน
     ถ้าปล่อยให้ดินยาวเกินจำเป็น สัดส่วนรูปจะสูงจนต้องสกรอลล์ */
  const soilRight = B + P(26);
  const soilTopBack = yC;
  E.push(hatch([
    { x: xB, y: yT }, { x: soilRight, y: yT }, { x: soilRight, y: soilTopBack }, { x: xBT, y: soilTopBack },
  ], 'SOIL_FILL', LY.HATCH));
  E.push(poly([{ x: xBT, y: soilTopBack }, { x: soilRight, y: soilTopBack }], 'PROJECTION', LY.SOIL));

  const soilLeft = -P(16);
  const Df = (i.Df || 0) * M;
  if (Df > 0) {
    E.push(hatch([
      { x: soilLeft, y: yT - hz }, { x: xF, y: yT - hz }, { x: xF, y: Df }, { x: soilLeft, y: Df },
    ], 'SOIL_NATURAL', LY.HATCH));
    E.push(poly([{ x: soilLeft, y: Df }, { x: xF, y: Df }], 'PROJECTION', LY.SOIL));
  }
  E.push(poly([{ x: soilLeft, y: 0 }, { x: soilRight, y: 0 }], 'PROJECTION', LY.SOIL));

  const hwb = (r.hwb || 0) * M;
  if (hwb > 0) {
    const yw = hwb;
    E.push(poly([{ x: xB, y: yw }, { x: soilRight, y: yw }], 'PROJECTION', LY.WATER));
    E.push(levelMark({ x: soilRight - 300, y: yw }, yw, LY.WATER, { side: 'left' }));
    /* ★ ป้ายคำอธิบายต้องอยู่เหนือป้ายค่าระดับให้พ้นกัน
       เดิมเยื้องขึ้นแค่ 120 หน่วยโมเดล (2.4 มม.บนกระดาษ) ซึ่งน้อยกว่าความสูงตัวอักษรเอง
       ป้าย "+4.000" ของเครื่องหมายระดับจึงพิมพ์ทับคำว่า "ระดับน้ำใต้ดิน" (เจ้าของงานเห็นจากแบบ) */
    E.push(text({ x: soilRight - 320, y: yw + P(6.8) }, 'ระดับน้ำใต้ดิน', 3.5, LY.TEXT, { align: 'R' }));
  }

  /* ── 2. คอนกรีต — ระนาบตัดผ่าน จึงเป็น CUT ทั้งหมด ── */
  /* เดินรอบเนื้อคอนกรีตตามเข็มนาฬิกา:
     ท้องฐาน → ปลาย heel → ผิวบน heel → โคนพนังด้านดิน → ยอดพนังด้านดิน
     → ยอดพนังด้านนอก → โคนพนังด้านนอก → ผิวบน toe → ปิดที่ปลาย toe
     จุด {xB, yT} คือโคนพนังด้านดิน — ขาดจุดนี้แล้วพนังจะกลายเป็นลิ่มสามเหลี่ยม */
  const wallPts = [
    { x: 0, y: 0 }, { x: B, y: 0 }, { x: B, y: yT }, { x: xB, y: yT },
    { x: xBT, y: yC }, { x: xF, y: yC }, { x: xF, y: yT }, { x: 0, y: yT },
  ];
  E.push(hatch(wallPts, 'CONCRETE', LY.HATCH));
  E.push(poly(wallPts, 'CUT', LY.CONCRETE, true));

  if (dk > 0) {
    const xk0 = xF, xk1 = xB;
    const keyPts = [{ x: xk0, y: 0 }, { x: xk1, y: 0 }, { x: xk1, y: -dk }, { x: xk0, y: -dk }];
    E.push(hatch(keyPts, 'CONCRETE', LY.HATCH));
    E.push(poly(keyPts, 'CUT', LY.CONCRETE, true));
    /* ★ ป้าย shear key เคยลงมาที่ระดับเดียวกับป้ายเหล็กล่างของ toe แล้วพิมพ์ทับกัน
       (เจอตอนกวาดรูปทรงที่มี shear key) จึงลากลงต่ำกว่าอีกหนึ่งช่วงบรรทัด
       และยื่นไปทางซ้ายให้พ้นแนวป้ายเหล็ก */
    E.push(leader([{ x: (xk0 + xk1) / 2, y: -dk / 2 }, { x: xk0 - P(22), y: -dk - P(16) }],
      'Shear key ' + (dk / M).toFixed(2) + ' ม.', 3.5, LY.TEXT));
  }

  /* ── 3. เหล็กเสริม ──────────────────────────────────────────────
     เหล็กที่วิ่งในระนาบกระดาษ  → เส้น (bar-line)
     เหล็กที่วิ่งขนานกำแพง คือ ตั้งฉากกับระนาบตัด → จุดทึบ (cut-dot)
     ถ้าวาดผิดชนิด ช่างที่หน้างานจะอ่านจำนวนเหล็กผิด
     ─────────────────────────────────────────────────────────────── */
  const rebar = [];
  const R = (pts) => rebar.push(poly(pts, 'REBAR', LY.REBAR));
  const dot = (x, y, db) => rebar.push(circle({ x, y }, db / 2, 'REBAR', LY.REBAR, true));

  let marksDrawn;
  if (r.mode === 'but') {
    /* ═══ กำแพงมีครีบ (counterfort) ═══
       ผนังพาดราบระหว่างครีบ → เหล็กหลักของพนังวิ่ง "ขนานกำแพง" (ตั้งฉากระนาบตัด) = จุด
       ครีบอยู่หลังระนาบตัด A-A → เส้นประ HIDDEN · เหล็กครีบ ⑥ ดูรายละเอียดใน RW-03
       ★ ระยะเรียง ①a/①b อ่านจาก r.strips ตรง ๆ ห้าม regex คอลัมน์ detail —
       รูปแบบ "@200–175 (ถี่ลงล่าง)" จะถูก spacingOf อ่านได้เลขแรกตัวเดียวแบบเงียบ ๆ */
    const cf = counterfortContract(r);
    const strips = cf.strips;
    const sB_ = strips[strips.length - 1].b_;
    const sB$ = strips[strips.length - 1].b$;

    /* ①a/①b เหล็กราบพนัง — จุดทึบ ระยะเรียงเปลี่ยนเป็นชั้นตามแถบออกแบบ */
    for (const s of strips) {
      const yHi = yC - s.z1 * M, yLo = yC - s.z2 * M;
      for (const y of runPositions(yLo + s.b_.s / 2, s.b_.s, yHi)) {
        dot(xBack(y) - (cS + s.b_.db / 2) * secant, y, s.b_.db);
      }
      for (const y of runPositions(yLo + s.b$.s / 2, s.b$.s, yHi)) {
        dot(xF + cS + s.b$.db / 2, y, s.b$.db);
      }
    }

    /* ② เหล็กตั้ง 2 หน้า — อยู่ในระนาบกระดาษ = เส้น · ชั้นในถัดจากเหล็กราบ
       (ราบเป็นเหล็กหลักจึงอยู่นอกสุดเพื่อ d มากสุดของช่วงพาดระหว่างครีบ) */
    const row2 = cf.rows['②'];
    const db2 = row2.size;
    const s2 = cf.s2;
    const hook2 = row2.bend.b * M;
    const x2a = xBack((yT + yC) / 2) - (cS + sB_.db + db2 / 2) * secant;
    const x2b = xF + cS + sB$.db + db2 / 2;
    R([{ x: x2a - hook2, y: cov.barCentreBot }, { x: x2a, y: cov.barCentreBot }, { x: x2a, y: yC - cS }]);
    R([{ x: x2b + hook2, y: cov.barCentreBot }, { x: x2b, y: cov.barCentreBot }, { x: x2b, y: yC - cS }]);

    /* ③ เหล็กบนฐานหลัง — ขนานกำแพง (แถบเหนือครีบ) = จุด · ชั้นนอกสุดด้านบน heel */
    const db3 = r.barH_.db, y3 = hz - cov.barCentreTop;
    for (const x of runPositions(xB + cS + db3 / 2, r.barH_.s, B - cov.earth - db3 / 2)) dot(x, y3, db3);

    /* ④ เหล็กล่างฐานหลัง — ขนานกำแพง = จุด · ซ้อนเหนือชั้นเหล็กขวาง ⑤ */
    const db4 = r.barH$.db, y4 = cov.barCentreBot + (r.barT.db + db4) / 2;
    for (const x of runPositions(xB + cS + db4 / 2, r.barH$.s, B - cov.earth - db4 / 2)) dot(x, y4, db4);

    /* ⑤ เหล็กล่างฐานหน้า ตามขวาง — เส้น ชั้นนอกสุดด้านล่าง */
    const row5 = cf.rows['⑤'];
    const y5 = cov.barCentreBot;
    const a5 = row5.bend.a * M;
    const ld5 = row5.bend.b * M;
    R([{ x: cov.earth, y: y5 }, { x: Math.min(cov.earth + a5 + ld5, B - cov.earth), y: y5 }]);

    /* มาร์ค ⑧ คงอยู่ใน BBS/ปริมาณจาก Engine แต่ยังไม่มี shared placement contract
       ระหว่าง BBS, A3/DXF และ 3D จึงห้ามวาดแนวเหล็กโดยประมาณในรุ่น Beta */

    E.push(...rebar);

    /* ครีบอยู่หลังระนาบตัด — ขอบเอียงเป็นเส้นประ (ขอบตั้ง/ขอบนอนทับแนวพนังกับผิวฐานอยู่แล้ว) */
    const cfL = r.cfLr * M, cfH = r.cfHr * M;
    E.push(poly([{ x: xB, y: yT + cfH }, { x: xB + cfL, y: yT }], 'HIDDEN', LY.CONCRETE));

    /* ── ป้ายเหล็ก ── */
    const callout = (from, to, label) => E.push(leader([from, to], label, 3.5, LY.TEXT));
    const nm = (db) => barName(i.fy, db);
    const stepTxt = (top, bot) => (top === bot ? '@' + bot : '@' + top + '–' + bot + ' (ถี่ลงล่าง)');
    const t0_ = strips[0].b_.s;
    const t0$ = strips[0].b$.s;
    const y1a = yT + hp * 0.42;
    callout({ x: xBack(y1a) - (cS + sB_.db / 2) * secant, y: y1a }, { x: xB + P(19), y: y1a + P(8) },
      '①a ' + nm(sB_.db) + ' ' + stepTxt(t0_, sB_.s) + ' ราบ·หน้าดิน');
    const y1b = yT + hp * 0.66;
    callout({ x: xF + cS + sB$.db / 2, y: y1b }, { x: xF - P(16), y: y1b + P(8) },
      '①b ' + nm(sB$.db) + ' ' + stepTxt(t0$, sB$.s) + ' ราบ·หน้านอก');
    callout({ x: x2b, y: yT + hp * 0.24 }, { x: xF - P(16), y: yT + hp * 0.24 - P(10) },
      '② ' + nm(db2) + ' @' + s2 + ' ตั้ง 2 หน้า');
    callout({ x: B - P(8), y: y3 }, { x: B - P(6), y: yT + P(23) },
      '③ ' + nm(db3) + ' @' + r.barH_.s + ' (แถบเหนือครีบ)');
    callout({ x: (xB + B) / 2, y: y4 }, { x: B * 0.55, y: -P(20) },
      '④ ' + nm(db4) + ' @' + r.barH$.s + ' (ขนานกำแพง)');
    callout({ x: cov.earth + a5 * 0.45, y: y5 }, { x: xF - P(16), y: -P(14) },
      '⑤ ' + nm(r.barT.db) + ' @' + r.barT.s);
    const bu = cf.but, fcB = cf.finCut;
    const mainName = bu.barPre.trim() + bu.barSize;
    callout({ x: xB + cfL * 0.45, y: yT + cfH * 0.55 }, { x: B + P(12), y: yT + cfH * 0.72 },
      '⑥ ' + fcB.nFul + '-' + mainName + '/ครีบ ยาวตลอด (หลังระนาบตัด · ดู RW-03)');
    if (fcB.nCut > 0) {
      const y6b = yT + fcB.cutLen * M;
      const x6b = xB + cfL * (1 - fcB.cutLen / r.cfHr);
      callout({ x: x6b, y: y6b }, { x: B + P(12), y: yT + cfH * 0.56 },
        '⑥b ' + fcB.nCut + '-' + mainName + '/ครีบ ตัดที่ +' + fcB.cutLen.toFixed(2) + ' ม. (ดู RW-03)');
    }

    marksDrawn = ['①a', '①b', '②', '③', '④', '⑤', '⑥']
      .concat(fcB.nCut > 0 ? ['⑥b'] : []);
  } else {
    const cc = cantileverContract(r);
    /* ① เหล็กตั้งหลัก ผิวหน้าดิน + เดือยทาบ */
    const row1 = cc.rows['①'];
    const b1 = cc.stemBar;
    const db1 = b1.db;
    const s1 = b1.s;
    const x1 = xBack(yT) - (cS + db1 / 2) * secant;
    const hook1 = row1.bend.b * M;
    const lap1 = Math.max(row1.bend.a * M - hp, 0);
    R([{ x: x1, y: yT }, { x: x1, y: yC - cS }]);
    /* เดือยเขียนเยื้องเล็กน้อยเพื่อให้เห็นว่าเป็นคนละท่อนกับเหล็กพนัง */
    const xD = x1 - Math.max(db1 + 6, P(0.6));
    R([{ x: xD - hook1, y: cov.barCentreBot }, { x: xD, y: cov.barCentreBot }, { x: xD, y: yT + lap1 }]);


    /* ② เหล็กตั้งผิวนอก */
    const row2 = cc.rows['②'];
    const db2 = row2.size;
    const s2 = cc.spacing['②'];
    const x2 = xF + cS + db2 / 2;
    const foot2 = row2.bend.a * M;
    const cog2 = row2.bend.c * M;
    R([
      { x: x2 + foot2, y: cov.barCentreBot }, { x: x2, y: cov.barCentreBot },
      { x: x2, y: yC - cS }, { x: x2 + Math.min(cog2, tTop - 2 * cS), y: yC - cS },
    ]);

    /* ③ เหล็กราบพนัง 2 หน้า — ขนานกำแพง จึงเป็นจุด */
    const row3 = cc.rows['③'];
    const db3 = row3.size;
    const s3 = cc.spacing['③'];
    const yTop3 = yC - cS - db3;
    const ys3 = runPositions(yT + s3 / 2, s3, yTop3);
    for (const y of ys3) {
      dot(xBack(y) - (cS + db1 + db3 / 2) * secant, y, db3);
      dot(x2 + db2 / 2 + db3 / 2, y, db3);
    }

    /* มาร์ค ⑧ คงอยู่ใน BBS/ปริมาณจาก Engine แต่ placement ยัง HOLD
       ห้าม renderer สร้าง centerline/cover/layer เอง */

    /* ④ เหล็กบนฐานหลัง — ชั้นนอกสุดด้านบน */
    const row4 = cc.rows['④'];
    const b4 = cc.barH;
    const db4 = b4.db;
    const y4 = hz - cov.barCentreTop;
    const a4 = row4.bend.a * M;
    const ld4 = row4.bend.b * M;
    const x4start = B - cov.earth;
    const x4end = Math.max(x4start - a4, xF + cS);
    R([{ x: x4start, y: y4 }, { x: x4end, y: y4 }, { x: x4end, y: Math.min(y4 + ld4, yC - cS) }]);

    /* ⑤ เหล็กล่างฐานหน้า — ชั้นนอกสุดด้านล่าง */
    const row5 = cc.rows['⑤'];
    const b5 = cc.barT;
    const db5 = b5.db;
    const y5 = cov.barCentreBot;
    const a5 = row5.bend.a * M;
    const ld5 = row5.bend.b * M;
    R([{ x: cov.earth, y: y5 }, { x: Math.min(cov.earth + a5 + ld5, B - cov.earth), y: y5 }]);

    /* ⑥ เหล็กกระจายฐาน ขนานกำแพง บน+ล่าง — จุด */
    const row6 = cc.rows['⑥'];
    const db6 = row6.size;
    const s6 = cc.spacing['⑥'];
    const xs6 = runPositions(cov.earth + s6 / 2, s6, B - cov.earth - db6);
    for (const x of xs6) {
      dot(x, y4 - db4 / 2 - db6 / 2, db6);
      dot(x, y5 + db5 / 2 + db6 / 2, db6);
    }

    E.push(...rebar);

    /* ── 4. ป้ายเหล็ก ── */
    const callout = (from, to, label) => E.push(leader([from, to], label, 3.5, LY.TEXT));
    const barLabel = (mk, db, s, extra) =>
      mk + ' ' + barName(i.fy, db) + ' @' + s + (extra ? ' ' + extra : '');
    callout({ x: x1, y: yT + hp * 0.42 }, { x: xB + P(19), y: yT + hp * 0.52 }, barLabel('①', db1, s1));
    callout({ x: x2, y: yT + hp * 0.66 }, { x: xF - P(16), y: yT + hp * 0.76 }, barLabel('②', db2, s2));
    if (ys3.length) {
      const mid = ys3[Math.floor(ys3.length / 2)];
      callout({ x: xBack(mid) - (cS + db1 + db3 / 2) * secant, y: mid },
        { x: xB + P(19), y: mid + P(8) }, barLabel('③', db3, s3, '(2 หน้า)'));
    }
    callout({ x: x4start - a4 * 0.35, y: y4 }, { x: B - P(6), y: yT + P(23) }, barLabel('④', db4, b4.s));
    callout({ x: cov.earth + a5 * 0.45, y: y5 }, { x: xF - P(16), y: -P(14) }, barLabel('⑤', db5, b5.s));
    if (xs6.length) {
      callout({ x: xs6[Math.floor(xs6.length / 2)], y: y5 + db5 / 2 + db6 / 2 },
        { x: B * 0.55, y: -P(20) }, barLabel('⑥', db6, s6, '(ขนานกำแพง)'));
    }
    marksDrawn = ['①', '②', '③', '④', '⑤', '⑥'];
  }

  /* ── 5. บอกระยะ ── */
  const dimBelow = -P(25);
  E.push(dim({ x: 0, y: 0 }, { x: toe, y: 0 }, dimBelow, LY.DIM, { chain: 'base' }));
  E.push(dim({ x: toe, y: 0 }, { x: xB, y: 0 }, dimBelow, LY.DIM, { chain: 'base' }));
  E.push(dim({ x: xB, y: 0 }, { x: B, y: 0 }, dimBelow, LY.DIM, { chain: 'base' }));
  E.push(dim({ x: 0, y: 0 }, { x: B, y: 0 }, dimBelow - P(9), LY.DIM, { chain: 'base:total' }));

  const dimLeft = -P(12);
  E.push(dim({ x: 0, y: 0 }, { x: 0, y: yT }, dimLeft, LY.DIM, { vertical: true, chain: 'height' }));
  E.push(dim({ x: 0, y: yT }, { x: 0, y: yC }, dimLeft, LY.DIM, { vertical: true, chain: 'height' }));
  E.push(dim({ x: 0, y: 0 }, { x: 0, y: yC }, dimLeft - P(9), LY.DIM, { vertical: true, chain: 'height:total' }));

  E.push(dim({ x: xF, y: yC }, { x: xBT, y: yC }, P(12), LY.DIM, { chain: 'crest:total' }));

  /* ── 6. ระดับและแนวตัด ── */
  /* ป้ายระดับยืดออกไปเรียงที่แนวเดียวกันนอกรูป ด้วยเส้นประ
     เดิมวางติดผิวคอนกรีต ทำให้ +0.600 กับ ±0.000 ที่ห่างกันแค่ 600 มม. ไปกองทับกัน */
  const levelX = soilLeft - P(3);
  E.push(levelMark({ x: xF, y: 0 }, 0, LY.DIM, { side: 'left', extendTo: levelX }));
  E.push(levelMark({ x: xF, y: yT }, yT, LY.DIM, { side: 'left', extendTo: levelX }));
  E.push(levelMark({ x: xBT, y: yC }, yC, LY.DIM, { side: 'right', extendTo: soilRight - P(3) }));
  E.push(sectionMark({ x: xF - P(18), y: yT + hp * 0.22 }, { x: xB + P(22), y: yT + hp * 0.22 }, 'B', LY.MARK));

  /* ── 7. ชื่อรูปและหมายเหตุระยะหุ้ม ── */
  E.push(text({ x: 0, y: dimBelow - P(20) }, 'รูปตัดขวาง A-A   มาตราส่วน 1:' + SCALE, 5.0, LY.TEXT, { bold: true }));
  /* หมายเหตุอยู่ในบล็อกหมายเหตุทั่วไปของแผ่น ไม่ซ้ำไว้ใต้ทุกรูป */

  return drawing('RW-01', 'รูปตัดขวางกำแพงกันดิน', E, {
    scale: SCALE,
    origin: 'มุมล่างด้านหน้าของฐานราก',
    coverStem: cS,
    coverFooting: cov.earth,
    marksDrawn,
    omittedMarks: ['⑧'],
    projectionHolds: [{
      mark: '⑧',
      code: 'BBS_A3_GEOMETRY_UNRECONCILED',
      reason: 'มาร์ค ⑧ มีเฉพาะ BBS/ปริมาณจาก Engine; A3/DXF ละเว้น placement จนกว่า Owner/PE จะอนุมัติ shared geometry contract',
    }],
  });
}
