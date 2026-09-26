/**
 * RW-03 · รายละเอียดเหล็กเสริม — ขยายสองจุดวิกฤต
 *
 *   รายละเอียด A  โคนพนัง–ฐานราก : เดือย ระยะทาบ ของอ และการเข้ากันของเหล็ก 5 มาร์ค
 *   รายละเอียด B  ยอดพนัง        : ของอปลายบน และระยะหุ้ม
 *
 * มาตราส่วน 1:20 (แผนเดิมเขียนไว้ 1:10 — ที่ 1:10 ลงได้แค่รายละเอียดเดียวต่อแผ่น
 * เพราะ A กว้าง 170 มม. บนกระดาษแล้ว ส่วน 1:20 ลงได้ทั้งสองและยังอยู่ในบันไดมาตรฐาน)
 *
 * ตำแหน่งเหล็กทุกเส้นคำนวณจากตัวช่วยชุดเดียวกับ RW-01 เพื่อไม่ให้สองแผ่นวางเหล็กคนละที่
 */
import { poly, circle, text, dim, leader, drawing } from './cadPrimitives.js';
import { footingCovers, bbsRow, spacingOf, runPositions } from './rwSectionGeometry.js';
import { barName } from './draftingStandard.js';

const M = 1000;
const SCALE = 20;
const P = (paperMm) => paperMm * SCALE;
const LY = {
  CONCRETE: 'RW-CONCRETE', REBAR: 'RW-REBAR', DIM: 'RW-DIM', TEXT: 'RW-TEXT', HATCH: 'RW-HATCH',
};

/** เลื่อนชุด primitive ไปวางอีกตำแหน่งบนแผ่น (ใช้จัดรายละเอียดสองอันให้เรียงกัน) */
function shift(entities, dx, dy) {
  const mv = (p) => ({ x: p.x + dx, y: p.y + dy });
  return entities.map((e) => {
    const c = { ...e };
    if (c.a) c.a = mv(c.a);
    if (c.b) c.b = mv(c.b);
    if (c.p) c.p = mv(c.p);
    if (c.c) c.c = mv(c.c);
    if (c.pts) c.pts = c.pts.map(mv);
    return c;
  });
}

/** ตัดรูปหลายเหลี่ยมด้วยกรอบสี่เหลี่ยม (Sutherland–Hodgman) — ใช้จำกัดคอนกรีตให้อยู่ในกรอบรายละเอียด */
function clipPoly(pts, win) {
  const edges = [
    (p) => p.x >= win.x0, (p) => p.x <= win.x1,
    (p) => p.y >= win.y0, (p) => p.y <= win.y1,
  ];
  const inter = [
    (a, b) => ({ x: win.x0, y: a.y + ((b.y - a.y) * (win.x0 - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: win.x1, y: a.y + ((b.y - a.y) * (win.x1 - a.x)) / (b.x - a.x) }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (win.y0 - a.y)) / (b.y - a.y), y: win.y0 }),
    (a, b) => ({ x: a.x + ((b.x - a.x) * (win.y1 - a.y)) / (b.y - a.y), y: win.y1 }),
  ];
  let out = pts;
  for (let k = 0; k < 4; k++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      const cIn = edges[k](cur), pIn = edges[k](prev);
      if (cIn) {
        if (!pIn) out.push(inter[k](prev, cur));
        out.push(cur);
      } else if (pIn) out.push(inter[k](prev, cur));
    }
    if (!out.length) return [];
  }
  return out;
}


/** เส้นหักตัด (break line) — บอกว่ารูปถูกตัดจบตรงนี้ ไม่ใช่ขอบจริงของชิ้นส่วน */
function breakLine(x, ya, yb, amp) {
  const n = Math.max(3, Math.round(Math.abs(yb - ya) / (amp * 2.2)));
  const pts = [{ x, y: ya }];
  for (let k = 1; k < n; k++) {
    const y = ya + ((yb - ya) * k) / n;
    pts.push({ x: x + (k % 2 ? amp : -amp), y });
  }
  pts.push({ x, y: yb });
  return poly(pts, 'OUTLINE', LY.CONCRETE);
}

/* ────────────────────────────────────────────────
   รายละเอียด A · โคนพนัง–ฐานราก
   ──────────────────────────────────────────────── */
function detailBase(r) {
  const i = r.i;
  const toe = i.toe * M, t = i.t * M, heel = i.heel * M;
  const B = toe + t + heel, hz = i.hz * M, hp = i.hp * M;
  const yT = hz, xF = toe, xB = toe + t;
  const cS = i.cov;
  const cov = footingCovers(r);
  const E = [];

  /* กรอบรายละเอียด — พอเห็นเดือย ระยะทาบ และเหล็กฐานทั้งบนล่าง */
  const win = { x0: xF - P(18), y0: -P(6), x1: xB + P(45), y1: yT + P(52) };

  const wallPts = [
    { x: 0, y: 0 }, { x: B, y: 0 }, { x: B, y: yT }, { x: xB, y: yT },
    { x: xB, y: yT + hp }, { x: xF, y: yT + hp }, { x: xF, y: yT }, { x: 0, y: yT },
  ];
  const clipped = clipPoly(wallPts, win);
  if (clipped.length >= 3) {
    /* ไม่ใส่ลายคอนกรีตในแผ่นรายละเอียดเหล็ก — ลายจะแย่งสายตากับเส้นเหล็ก
       (แผ่นรูปตัด RW-01 ยังใส่ เพราะที่นั่นต้องบอกชนิดวัสดุ) */
    E.push(poly(clipped, 'CUT', LY.CONCRETE, true));
  }
  /* คอนกรีตยังยาวต่อไปทั้งสองข้างและขึ้นไปข้างบน — ทำเครื่องหมายว่ารูปถูกตัด */
  E.push(breakLine(win.x0, 0, yT, P(1.6)));
  E.push(breakLine(win.x1, 0, yT, P(1.6)));
  E.push(breakLine((xF + xB) / 2, yT + P(40), win.y1, P(1.6)));

  /* ── เหล็ก ── */
  const R = (pts) => E.push(poly(pts, 'REBAR', LY.REBAR));
  const dot = (x, y, db) => E.push(circle({ x, y }, db / 2, 'REBAR', LY.REBAR, true));

  const row1 = bbsRow(r, '①');
  const b1 = r.stemTab[r.stemTab.length - 1].bar;
  const db1 = b1.db;
  const x1 = xB - cS - db1 / 2;
  const hook1 = row1.bend.b * M;
  const lap1 = Math.max(row1.bend.a * M - hp, 0);
  R([{ x: x1, y: yT }, { x: x1, y: win.y1 }]);
  const xD = x1 - Math.max(db1 + 6, P(0.8));
  R([{ x: xD - hook1, y: cov.barCentreBot }, { x: xD, y: cov.barCentreBot }, { x: xD, y: yT + lap1 }]);

  const row2 = bbsRow(r, '②');
  const db2 = row2.size;
  const x2 = xF + cS + db2 / 2;
  const foot2 = row2.bend.a * M;
  R([{ x: x2 + foot2, y: cov.barCentreBot }, { x: x2, y: cov.barCentreBot }, { x: x2, y: win.y1 }]);

  const row3 = bbsRow(r, '③');
  const db3 = row3.size, s3 = spacingOf(row3, '③');
  for (const y of runPositions(yT + s3 / 2, s3, win.y1 - db3)) {
    dot(xB - cS - db1 - db3 / 2, y, db3);
    dot(x2 + db2 / 2 + db3 / 2, y, db3);
  }

  /* มาร์ค ⑧ แสดงใน BBS เท่านั้นในรุ่น Beta; placement ใน A3/DXF ถูกละเว้น
     จนกว่า centerline/cover/layer contract จะตรงกับ 3D และผ่าน Owner/PE review */

  const row4 = bbsRow(r, '④'), b4 = r.barH_;
  const y4 = hz - cov.barCentreTop;
  const ld4 = row4.bend.b * M;
  const x4end = Math.max(B - cov.earth - row4.bend.a * M, xF + cS);
  R([{ x: win.x1, y: y4 }, { x: x4end, y: y4 }, { x: x4end, y: Math.min(y4 + ld4, win.y1) }]);

  const row5 = bbsRow(r, '⑤'), b5 = r.barT;
  const y5 = cov.barCentreBot;
  R([{ x: cov.earth, y: y5 }, { x: win.x1, y: y5 }]);

  /* ── ระยะหุ้มและระยะทาบ — วัดถึงผิวเหล็ก ซึ่งคือนิยามของระยะหุ้ม ── */
  E.push(dim({ x: xB, y: yT + P(30) }, { x: x1 + db1 / 2, y: yT + P(30) }, 0, LY.DIM, { chain: 'covEarth:total' }));
  E.push(dim({ x: xF, y: yT + P(38) }, { x: x2 - db2 / 2, y: yT + P(38) }, 0, LY.DIM, { chain: 'covAir:total' }));
  E.push(dim({ x: xD, y: yT }, { x: xD, y: yT + lap1 }, -P(14), LY.DIM,
    { vertical: true, chain: 'lap:total' }));
  E.push(dim({ x: cov.earth, y: 0 }, { x: cov.earth, y: y5 - b5.db / 2 }, -P(9), LY.DIM,
    { vertical: true, chain: 'covBot:total' }));

  /* ── ป้าย ── */
  const call = (from, to, label) => E.push(leader([from, to], label, 3.5, LY.TEXT));
  call({ x: x1, y: yT + P(46) }, { x: xB + P(16), y: yT + P(50) }, '① ' + barName(i.fy, db1) + ' @' + b1.s);
  call({ x: x2, y: yT + P(24) }, { x: xF - P(16), y: yT + P(30) }, '② ' + barName(i.fy, db2) + ' @' + spacingOf(row2, '②'));
  call({ x: xD, y: yT + lap1 * 0.55 }, { x: xB + P(16), y: yT + P(30) }, 'เดือย ① ทาบ Class B');

  call({ x: x4end + P(20), y: y4 }, { x: win.x1 + P(3), y: yT + P(14) }, '④ ' + barName(i.fy, b4.db) + ' @' + b4.s);
  call({ x: cov.earth + P(10), y: y5 }, { x: win.x1 + P(3), y: -P(8) }, '⑤ ' + barName(i.fy, b5.db) + ' @' + b5.s);

  E.push(text({ x: win.x0, y: win.y0 - P(11) }, 'รายละเอียด A · โคนพนัง–ฐานราก   มาตราส่วน 1:' + SCALE, 5.0, LY.TEXT, { bold: true }));
  /* หมายเหตุอยู่ในบล็อกหมายเหตุทั่วไปของแผ่น */

  return { entities: E, win };
}

/* ────────────────────────────────────────────────
   รายละเอียด B · ยอดพนัง
   ──────────────────────────────────────────────── */
function detailCrest(r) {
  const i = r.i;
  const toe = i.toe * M, t = i.t * M;
  const hz = i.hz * M, hp = i.hp * M;
  const yC = hz + hp, xF = toe, xB = toe + t;
  const tTop = (r.tTop != null ? r.tTop : i.ttop || i.t) * M;
  const xBT = toe + tTop;
  const cS = i.cov;
  const E = [];

  const win = { x0: xF - P(10), y0: yC - P(46), x1: xBT + P(10), y1: yC + P(8) };

  const stem = [{ x: xF, y: win.y0 }, { x: xB, y: win.y0 }, { x: xBT, y: yC }, { x: xF, y: yC }];
  E.push(poly(stem, 'CUT', LY.CONCRETE, true));

  const R = (pts) => E.push(poly(pts, 'REBAR', LY.REBAR));
  const dot = (x, y, db) => E.push(circle({ x, y }, db / 2, 'REBAR', LY.REBAR, true));

  const b1 = r.stemTab[r.stemTab.length - 1].bar;
  const db1 = b1.db;
  R([{ x: xBT - cS - db1 / 2, y: win.y0 }, { x: xBT - cS - db1 / 2, y: yC - cS }]);

  const row2 = bbsRow(r, '②');
  const db2 = row2.size;
  const x2 = xF + cS + db2 / 2;
  const cog2 = Math.min(row2.bend.c * M, tTop - 2 * cS);
  R([{ x: x2, y: win.y0 }, { x: x2, y: yC - cS }, { x: x2 + cog2, y: yC - cS }]);

  const row3 = bbsRow(r, '③');
  const db3 = row3.size, s3 = spacingOf(row3, '③');
  const ys = runPositions(yC - cS - db3 - s3 * 3, s3, yC - cS - db3);
  for (const y of ys) {
    dot(xBT - cS - db1 - db3 / 2, y, db3);
    dot(x2 + db2 / 2 + db3 / 2, y, db3);
  }

  E.push(dim({ x: xF, y: yC }, { x: xBT, y: yC }, P(9), LY.DIM, { chain: 'crest:total' }));
  E.push(dim({ x: xBT - cS - db1 / 2, y: yC }, { x: xBT - cS - db1 / 2 + db1 / 2, y: yC - cS }, -P(16), LY.DIM,
    { vertical: true, chain: 'covTop:total' }));

  const call = (from, to, label) => E.push(leader([from, to], label, 3.5, LY.TEXT));
  call({ x: x2 + cog2 * 0.6, y: yC - cS }, { x: xBT + P(9), y: yC + P(4) }, 'ของอปลายบน ' + Math.round(cog2) + ' มม.');
  call({ x: xBT - cS - db1 / 2, y: yC - P(22) }, { x: xBT + P(9), y: yC - P(20) }, '① ยอดตรง');

  E.push(text({ x: win.x0, y: win.y0 - P(11) }, 'รายละเอียด B · ยอดพนัง   มาตราส่วน 1:' + SCALE, 5.0, LY.TEXT, { bold: true }));

  return { entities: E, win };
}

/**
 * สร้างแผ่นรายละเอียดเหล็ก RW-03
 * @param {object} r ผลจาก designRetainingWall()
 */
/* ────────────────────────────────────────────────
   รายละเอียดกำแพงมีครีบ (counterfort) — มาตราส่วน 1:25
   ที่ 1:20 ครีบสูง 6 ม. กินกระดาษ 300 มม. เกิน A3 · 1:25 อยู่ในบันไดมาตรฐานถัดไป
   ──────────────────────────────────────────────── */
const SCALE_BUT = 25;
const Q = (paperMm) => paperMm * SCALE_BUT;

/* รายละเอียด C · ครีบยึด — ตัดตามระนาบครีบ (เห็นสามเหลี่ยมเต็ม) */
function detailButRib(r) {
  const i = r.i;
  const positive = (v) => Number.isFinite(v) && v > 0;
  if (!Number.isFinite(r.cfLr) || r.cfLr <= 0 || !Number.isFinite(r.cfHr) || r.cfHr <= 0) {
    throw new TypeError('rwRebarDetailGeometry: counterfort ต้องมี cfLr/cfHr จากผลคำนวณ');
  }
  if (!r.but || !r.but.finCut || !positive(r.but.barSize)) {
    throw new TypeError('rwRebarDetailGeometry: counterfort ต้องมีผลออกแบบครีบและ finCut จาก engine');
  }
  if (typeof r.but.barPre !== 'string' || !r.but.barPre.trim()) {
    throw new TypeError('rwRebarDetailGeometry: counterfort ต้องมี but.barPre จาก engine ห้ามเดา DB');
  }
  const fc = r.but.finCut;
  if (!Number.isInteger(fc.nFul) || fc.nFul < 1
      || !Number.isInteger(fc.nCut) || fc.nCut < 0
      || !positive(fc.cutLen) || fc.cutLen > r.cfHr
      || !positive(fc.frac) || fc.frac > 1
      || !positive(fc.db) || fc.db !== r.but.barSize) {
    throw new TypeError('rwRebarDetailGeometry: counterfort finCut ต้องมี nFul/nCut/cutLen/frac/db ครบจาก engine');
  }
  const row6 = bbsRow(r, '⑥');
  const row6b = fc.nCut > 0 ? bbsRow(r, '⑥b') : null;
  const mainName = r.but.barPre.trim() + r.but.barSize;
  if (!row6 || row6.size !== r.but.barSize
      || !String(row6.detail).includes(fc.nFul + '-' + mainName + '/ครีบ')) {
    throw new TypeError('rwRebarDetailGeometry: BBS ⑥ ต้องตรงกับ finCut ยาวตลอด');
  }
  if (fc.nCut > 0 && (!row6b || row6b.size !== r.but.barSize
      || !String(row6b.detail).includes(fc.nCut + '-' + mainName + '/ครีบ'))) {
    throw new TypeError('rwRebarDetailGeometry: BBS ⑥b ต้องตรงกับ finCut cutoff');
  }
  const t = i.t * M, hz = i.hz * M;
  const cfL = r.cfLr * M, cfH = r.cfHr * M;
  const cS = i.cov;
  const cov = footingCovers(r);
  const yT = hz;
  const xB = 0;                                  // อ้างพิกัดที่ผิวหลังพนัง — รายละเอียดนี้ไม่สนใจ toe
  const xW = xB - t;                             // ผิวหน้าพนัง
  const slope = Math.hypot(cfL, cfH);
  const bu = r.but;
  const fcB = bu.finCut;

  /* กรอบ — ครีบอาจสูงกว่ากระดาษ ตัดที่ ~150 มม. แล้วขีดเส้นหักตัด (ระดับตัด ⑥b ยังต่ำกว่านี้
     ที่ค่าตั้งต้น cutLen≈0.59H) — ตัวเลขจริงประกาศในป้าย ไม่พึ่งการวัดจากรูป */
  const winTop = Math.min(yT + cfH + Q(4), yT + Q(150));
  const cut = winTop < yT + cfH;                 // รูปโดนตัดยอดหรือไม่
  const win = { x0: xW - Q(14), y0: -Q(6), x1: xB + cfL + Q(16), y1: winTop };
  const E = [];

  /* คอนกรีต: ฐาน + พนัง + สามเหลี่ยมครีบ — ระนาบตัดผ่านทั้งหมด */
  const basePts = clipPoly([
    { x: win.x0 + Q(2), y: 0 }, { x: win.x1 - Q(2), y: 0 },
    { x: win.x1 - Q(2), y: yT }, { x: win.x0 + Q(2), y: yT },
  ], win);
  if (basePts.length >= 3) E.push(poly(basePts, 'CUT', LY.CONCRETE, true));
  const wallPts = clipPoly([
    { x: xW, y: yT }, { x: xB, y: yT }, { x: xB, y: win.y1 + Q(2) }, { x: xW, y: win.y1 + Q(2) },
  ], win);
  if (wallPts.length >= 3) E.push(poly(wallPts, 'CUT', LY.CONCRETE, true));
  const ribPts = clipPoly([
    { x: xB, y: yT }, { x: xB + cfL, y: yT }, { x: xB, y: yT + cfH },
  ], win);
  if (ribPts.length >= 3) E.push(poly(ribPts, 'CUT', LY.CONCRETE, true));
  E.push(breakLine(win.x0 + Q(2), 0, yT, Q(1.6)));
  E.push(breakLine(win.x1 - Q(2), 0, yT, Q(1.6)));
  if (cut) E.push(breakLine((xW + xB) / 2, win.y1 - Q(3), win.y1, Q(1.6)));

  const R = (pts) => E.push(poly(pts, 'REBAR', LY.REBAR));

  /* ⑥/⑥b เหล็กหลักครีบ — ขนานขอบเอียง เยื้องเข้าตามระยะหุ้ม
     เส้นขนานที่เยื้องตั้งฉาก o มีระยะราบ = o·slope/cfH */
  const db6 = bu.barSize;
  const xHyp = (y) => xB + cfL * (1 - (y - yT) / cfH);
  const barAt = (o, yEnd, topLeg) => {
    const off = (o * slope) / cfH;
    const yLo = yT + cS + db6 / 2;
    /* ปลายบนของเส้นเต็ม: จุดที่เส้นเยื้องแตะแนวระยะหุ้มของพนัง แล้วล้วงเข้าเนื้อผนัง ≥ ld */
    const yWall = yT + cfH * (1 - (cS + off) / cfL);
    const yHi = Math.min(yEnd, yWall, win.y1 - Q(2));
    const pts = [
      { x: Math.max(xHyp(yLo) - off - Q(10), xW + cS), y: yLo },   // ขายึดล่างตามท้องครีบ
      { x: xHyp(yLo) - off, y: yLo },
      { x: xHyp(yHi) - off, y: yHi },
    ];
    if (topLeg && yHi === yWall) pts.push({ x: xW + cS, y: yHi });  // ล้วงเข้าผนัง
    R(pts);
    return { x: xHyp((yLo + yHi) / 2) - off, y: (yLo + yHi) / 2 };
  };
  const gap6 = 2.5 * db6;
  const p6 = barAt(cS + db6 / 2, Infinity, true);
  barAt(cS + db6 / 2 + gap6, Infinity, true);
  let p6b = null;
  if (fcB && fcB.nCut > 0) {
    p6b = barAt(cS + db6 / 2 + 2 * gap6, yT + fcB.cutLen * M, false);
  }

  /* ⑦a U-tie ราบ (พนัง↔ครีบ) — ขายาว t+0.45·cfL โผล่จากผิวหน้าพนังเข้าครีบ
     วาดตัวแทน ~4 เส้น ความถี่จริงประกาศในป้าย (วาดครบทุกเส้นแล้วรูปดำทึบ) */
  const row7a = bbsRow(r, '⑦a');
  if (!row7a || !positive(row7a.size) || !row7a.bend || !positive(row7a.bend.b)) {
    throw new TypeError('rwRebarDetailGeometry: BBS ต้องมี ⑦a และระยะขา U-tie');
  }
  const s7a = spacingOf(row7a, '⑦a');
  const leg7a = row7a.bend.b * M;
  const ys7a = runPositions(yT + s7a, s7a, Math.min(yT + cfH - Q(2), win.y1 - Q(4)));
  const show7a = ys7a.filter((_, k) => k % Math.max(1, Math.ceil(ys7a.length / 4)) === 0);
  for (const y of show7a) {
    if (xHyp(y) - (xW + cS) < leg7a * 0.3) continue;              // ครีบแคบเกินจะวางขา
    R([{ x: xW + cS, y }, { x: Math.min(xW + cS + leg7a, xHyp(y) - cS), y }]);
  }

  /* ⑦b U-tie ดิ่ง (ฐาน↔ครีบ) — ขายาว hz+0.3·cfH เสียบจากฐานขึ้นครีบ */
  const row7b = bbsRow(r, '⑦b');
  if (!row7b || !positive(row7b.size) || !row7b.bend || !positive(row7b.bend.b)) {
    throw new TypeError('rwRebarDetailGeometry: BBS ต้องมี ⑦b และระยะขา U-tie');
  }
  const s7b = spacingOf(row7b, '⑦b');
  const leg7b = row7b.bend.b * M;
  const xs7b = runPositions(xB + s7b, s7b, xB + cfL - Q(2));
  const show7b = xs7b.filter((_, k) => k % Math.max(1, Math.ceil(xs7b.length / 4)) === 0);
  for (const x of show7b) {
    const yTopRib = yT + cfH * (1 - (x - xB) / cfL);
    R([{ x, y: cov.barCentreBot }, { x, y: Math.min(cov.barCentreBot + leg7b, yTopRib - cS, win.y1 - Q(3)) }]);
  }

  /* ── ป้ายและระยะ ── */
  const nm6 = bu.barPre.trim() + db6;
  E.push(leader([p6, { x: p6.x + Q(16), y: p6.y + Q(10) }],
    '⑥ ' + fcB.nFul + '-' + nm6 + ' ยาวตลอด/ครีบ', 3.5, LY.TEXT));
  if (p6b) {
    E.push(leader([p6b, { x: p6b.x + Q(20), y: p6b.y - Q(8) }],
      '⑥b ' + fcB.nCut + '-' + nm6 + ' ตัดที่ +' + (fcB.cutLen).toFixed(2) + ' ม. ('
      + Math.round(fcB.frac * 100) + '%H · ACI 9.7.3.3)', 3.5, LY.TEXT));
    /* ระดับตัด — ระยะดิ่งจากผิวบนฐาน ตามนิยามของ engine */
    E.push(dim({ x: xB + cfL + Q(4), y: yT }, { x: xB + cfL + Q(4), y: yT + fcB.cutLen * M },
      Q(5), LY.DIM, { vertical: true, chain: 'butcut' }));
  }
  if (show7a.length) {
    const y7 = show7a[0];
    E.push(leader([{ x: xW + cS + leg7a * 0.55, y: y7 }, { x: xB + cfL + Q(6), y: y7 - Q(9) }],
      '⑦a U-tie ' + barName(i.fy, row7a.size) + ' @' + s7a + ' (พนัง↔ครีบ)', 3.5, LY.TEXT));
  }
  if (show7b.length) {
    const x7 = show7b[show7b.length - 1];
    E.push(leader([{ x: x7, y: cov.barCentreBot + leg7b * 0.35 }, { x: x7 + Q(8), y: -Q(10) }],
      '⑦b U-tie ' + barName(i.fy, row7b.size) + ' @' + s7b + ' (ฐาน↔ครีบ)', 3.5, LY.TEXT));
  }
  E.push(dim({ x: xB, y: 0 }, { x: xB + cfL, y: 0 }, -Q(10), LY.DIM, { chain: 'butrib' }));
  E.push(text({ x: win.x0, y: win.y1 + Q(6) },
    'รายละเอียด C · ครีบยึด (ตัดตามระนาบครีบ)' + (cut ? ' — ตัดยอดรูป ยอดจริง +' + ((cfH + hz) / M).toFixed(2) + ' ม.' : ''),
    5.0, LY.TEXT, { bold: true }));
  return { entities: E, win };
}

/* รายละเอียด D · ผังพนังระหว่างครีบ — ตัดราบผ่านพนัง มองลง เห็นหนึ่งช่วง */
function detailButWall(r) {
  const i = r.i;
  const t = i.t * M, bs = i.bs * M, L = i.L * M;
  const cS = i.cov;
  const strips = r.strips;
  if (!Array.isArray(strips) || !strips.length
      || !strips[0].b_ || !strips[0].b$
      || !strips[strips.length - 1].b_ || !strips[strips.length - 1].b$) {
    throw new TypeError('rwRebarDetailGeometry: counterfort ต้องมี strips และเหล็กสองหน้าจาก engine');
  }
  const sTop_ = strips[0].b_;
  const sTop$ = strips[0].b$;
  const sB_ = strips[strips.length - 1].b_;
  const sB$ = strips[strips.length - 1].b$;

  /* พิกัด: x ตามยาวกำแพง ครอบหนึ่งช่วง + ครีบสองข้าง · y = ความหนาพนัง (0=ผิวนอก t=ผิวดิน) */
  const x0 = 0, x1 = bs + L + bs;
  const ribShow = Math.min(Q(24), i.heel * M);   // โชว์ครีบยื่นฝั่งดินพอเห็น แล้วหักตัด
  const win = { x0: x0 - Q(6), y0: -Q(4), x1: x1 + Q(6), y1: t + ribShow + Q(2) };
  const E = [];

  /* พนัง — แถบตัด */
  E.push(poly([{ x: x0 - Q(4), y: 0 }, { x: x1 + Q(4), y: 0 }, { x: x1 + Q(4), y: t }, { x: x0 - Q(4), y: t }],
    'CUT', LY.CONCRETE, true));
  /* ครีบสองข้าง — โดนตัดเช่นกัน ยื่นไปฝั่งดิน (y > t) */
  for (const rx of [x0, x1 - bs]) {
    E.push(poly([{ x: rx, y: t }, { x: rx + bs, y: t }, { x: rx + bs, y: t + ribShow }, { x: rx, y: t + ribShow }],
      'CUT', LY.CONCRETE, true));
  }
  E.push(breakLine(x0 - Q(4), 0, t, Q(1.6)));
  E.push(breakLine(x1 + Q(4), 0, t, Q(1.6)));

  const R = (pts) => E.push(poly(pts, 'REBAR', LY.REBAR));
  const dot = (x, y, db) => E.push(circle({ x, y }, db / 2, 'REBAR', LY.REBAR, true));

  /* ①a เหล็กราบหน้าดิน — ชั้นนอก ของอ 90° สองปลายล้วงเข้าครีบ */
  const row1a = bbsRow(r, '①a');
  if (!row1a || !row1a.bend || !Number.isFinite(row1a.bend.b)) {
    throw new TypeError('rwRebarDetailGeometry: BBS ต้องมี ①a และระยะของอ');
  }
  const hook1a = row1a.bend.b * M;
  const y1a = t - cS - sB_.db / 2;
  R([
    { x: x0 + cS, y: Math.max(y1a - hook1a, cS) }, { x: x0 + cS, y: y1a },
    { x: x1 - cS, y: y1a }, { x: x1 - cS, y: Math.max(y1a - hook1a, cS) },
  ]);
  /* ①b เหล็กราบหน้านอก */
  const row1b = bbsRow(r, '①b');
  if (!row1b || !row1b.bend || !Number.isFinite(row1b.bend.b)) {
    throw new TypeError('rwRebarDetailGeometry: BBS ต้องมี ①b และระยะของอ');
  }
  const hook1b = row1b.bend.b * M;
  const y1b = cS + sB$.db / 2;
  R([
    { x: x0 + cS, y: Math.min(y1b + hook1b, t - cS) }, { x: x0 + cS, y: y1b },
    { x: x1 - cS, y: y1b }, { x: x1 - cS, y: Math.min(y1b + hook1b, t - cS) },
  ]);

  /* ② เหล็กตั้ง — ตั้งฉากระนาบตัดนี้ = จุด สองหน้า */
  const row2 = bbsRow(r, '②');
  if (!row2 || !Number.isFinite(row2.size)) {
    throw new TypeError('rwRebarDetailGeometry: BBS ต้องมี ② และขนาดเหล็ก');
  }
  const db2 = row2.size;
  const s2 = spacingOf(row2, '②');
  for (const x of runPositions(x0 + bs + s2 / 2, s2, x1 - bs)) {
    dot(x, y1a - sB_.db / 2 - db2 / 2, db2);
    dot(x, y1b + sB$.db / 2 + db2 / 2, db2);
  }

  /* ── ป้ายและระยะ ── */
  /* วางป้าย ①a ในช่องเหนือครีบ แต่ต่ำกว่าชื่อรายละเอียด D หนึ่งชั้นข้อความ */
  E.push(leader([{ x: x0 + bs + L * 0.22, y: y1a }, { x: x0 + bs + L * 0.22 + Q(8), y: win.y1 }],
    '①a ' + barName(i.fy, sB_.db) + ' @' + sTop_.s + '–' + sB_.s + ' หน้าดิน · ของอเข้าครีบ', 3.5, LY.TEXT));
  E.push(leader([{ x: x0 + bs + L * 0.6, y: y1b }, { x: x0 + bs + L * 0.6 + Q(8), y: -Q(12) }],
    '①b ' + barName(i.fy, sB$.db) + ' @' + sTop$.s + '–' + sB$.s + ' หน้านอก', 3.5, LY.TEXT));
  E.push(leader([{ x: x0 + bs + L * 0.82, y: y1a - sB_.db / 2 - db2 / 2 }, { x: x0 + bs + L * 0.82 + Q(8), y: t + ribShow + Q(14) }],
    '② ' + barName(i.fy, db2) + ' @' + s2 + ' ตั้ง 2 หน้า', 3.5, LY.TEXT));
  E.push(dim({ x: x0, y: 0 }, { x: x0 + bs, y: 0 }, -Q(8), LY.DIM, { chain: 'butbay' }));
  E.push(dim({ x: x0 + bs, y: 0 }, { x: x1 - bs, y: 0 }, -Q(8), LY.DIM, { chain: 'butbay' }));
  E.push(dim({ x: x1 - bs, y: 0 }, { x: x1, y: 0 }, -Q(8), LY.DIM, { chain: 'butbay' }));
  E.push(text({ x: win.x0, y: win.y1 + Q(6) },
    'รายละเอียด D · ผังพนังระหว่างครีบ (ตัดราบ มองลง)', 5.0, LY.TEXT, { bold: true }));
  return { entities: E, win };
}

export function retainingWallRebarDetail(r) {
  if (!r || !r.i) throw new TypeError('retainingWallRebarDetail: ต้องส่งผลคำนวณจาก designRetainingWall()');
  if (r.soldier) throw new RangeError('retainingWallRebarDetail: รุ่นนี้เขียนแบบเฉพาะกำแพงยื่นบนฐานแผ่');

  if (r.mode === 'but') {
    /* กำแพงมีครีบ: รายละเอียดโคน/ยอดพนังแบบยื่นใช้ไม่ได้ (ไม่มี stemTab) —
       จุดวิกฤตจริงคือครีบกับพนังพาดราบ จึงเป็นรายละเอียด C/D วางข้างกัน */
    /* C อยู่ RW-03 · D แยกเป็น RW-06 — รวมแผ่นเดียวแล้วเกินกระดาษทั้งกว้างและสูง
       (เจอจริง: ข้างกัน 390>384 · ซ้อนกัน 332>271 มม.) — ให้ composer จัดหน้าเอง */
    const Ar = detailButRib(r);
    return drawing('RW-03', 'รายละเอียดเหล็กเสริม', Ar.entities, {
      scale: SCALE_BUT,
      details: ['C · ครีบยึด'],
      note: 'มาตราส่วน 1:25 — ครีบสูงเต็มที่ 1:20 เกินกระดาษ A3',
    });
  }

  const A = detailBase(r);
  const Bd = detailCrest(r);

  /* วางรายละเอียด B ไว้ใต้ A ชิดขอบซ้ายเดียวกัน
     เรียงข้างกันทำให้แผ่นกว้าง 231 มม. ซึ่งเกินคอลัมน์ของ A3 */
  const gap = P(30);
  const dx = A.win.x0 - Bd.win.x0;
  const dy = A.win.y0 - gap - (Bd.win.y1 - Bd.win.y0) - Bd.win.y0;

  const E = [...A.entities, ...shift(Bd.entities, dx, dy)];

  return drawing('RW-03', 'รายละเอียดเหล็กเสริม', E, {
    scale: SCALE,
    details: ['A · โคนพนัง–ฐานราก', 'B · ยอดพนัง'],
    note: 'มาตราส่วน 1:20 แทน 1:10 เพราะที่ 1:10 ลงกระดาษ A3 ได้เพียงรายละเอียดเดียว',
  });
}

/**
 * RW-06 · ผังพนังระหว่างครีบ — เฉพาะกำแพงมีครีบ
 * แยกจาก RW-03 เพราะสองรายละเอียดรวมกันเกินกรอบ A3 — ให้ sheet composer จัดลงแผ่นเอง
 */
export function retainingWallButWallDetail(r) {
  if (!r || !r.i) throw new TypeError('retainingWallButWallDetail: ต้องส่งผลคำนวณจาก designRetainingWall()');
  if (r.mode !== 'but') throw new RangeError('retainingWallButWallDetail: ใช้เฉพาะกำแพงมีครีบ (wtype=but)');
  const Bw = detailButWall(r);
  return drawing('RW-06', 'ผังพนังระหว่างครีบ', Bw.entities, {
    scale: SCALE_BUT,
    details: ['D · ผังพนังระหว่างครีบ'],
  });
}
