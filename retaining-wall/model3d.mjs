/**
 * แบบจำลองสามมิติของกำแพงกันดินยื่น
 *
 * ที่มา: ยกแนวทางการวางชิ้นส่วนและการจัดเหล็กมาจากแอปกำแพงกันดินเดิมของเจ้าของงาน
 * (changkid-engapp · build3D / buildRebarCant) แต่เขียนใหม่ให้เล็กและตรงขอบเขต
 * ของเรา — รองรับกำแพงยื่น/มวล/มีครีบ · ยังไม่ยกส่วนเสาเข็มพืด/เสาเข็ม
 * แผนที่ความร้อน และการแก้เหล็กชนกันมาด้วย
 *
 * กติกาที่ห้ามผิด
 *   · ทุกมิติและระยะเรียงเหล็กมาจากชุดผลของ engine ห้ามคิดเลขออกแบบใหม่ที่นี่
 *   · ระบบพิกัด  x = ตามความกว้างฐาน (−B/2 คือปลาย toe) · y = สูงจากท้องฐาน · z = ตามความยาวกำแพง
 *   · หน่วยเป็นเมตร เท่ากับที่ engine ใช้
 *
 * โมดูลนี้รับ THREE เข้ามาเป็นพารามิเตอร์ จึงไม่ผูกกับที่อยู่ของไลบรารี
 * และทดสอบฝั่งโหนดได้ด้วยการส่งของปลอมเข้ามา
 */

import { coverTable } from './drafting/draftingStandard.js';
import { RW_REBAR_GEOMETRY_HOLD } from './authorityContracts.mjs';

/** สีของแต่ละส่วน — เลือกให้แยกชิ้นส่วนออกจากกันได้ในภาพนิ่งขาวดำด้วย */
export const PALETTE = Object.freeze({
  base: 0xd8d8d2,      // ฐานราก
  stem: 0xe4e4de,      // พนัง
  key: 0xc9c9c2,       // shear key
  soil: 0xc99a5b,      // ดินถมหลังกำแพง
  water: 0x2f9fd0,     // ระดับน้ำ
  rebarMain: 0xd64545, // เหล็กหลัก
  rebarSec: 0xe08a3c,  // เหล็กเสริมทาง/เหล็กราบ
  edge: 0x2a3550,      // เส้นขอบ
  ground: 0x8f9bb3,    // ผิวดินหน้ากำแพง
});

/** ระยะเรียงที่วาดจริง — ถ้าเรียงถี่มากในกำแพงยาว ๆ จะได้เหล็กเป็นหมื่นเส้นจนเครื่องค้าง
    จึงขยายระยะเป็นเท่าตัวจนจำนวนเส้นไม่เกินเพดาน แล้วประกาศไว้ว่าเป็นภาพแทน */
function drawStep(spacingM, spanM, cap) {
  let s = Math.max(spacingM, 0.005);
  let guard = 0;
  while (spanM / s > cap && guard++ < 64) s *= 2;
  return s;
}

const positive = (v) => Number.isFinite(v) && v > 0;
const close = (a, b, tol = 1e-9) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol;

const EXPECTED_MARKS = Object.freeze({
  cant: Object.freeze(['①', '②', '③', '④', '⑤', '⑥', '⑧']),
  gravity: Object.freeze(['①', '②', '③', '④', '⑤', '⑥', '⑧']),
  but: Object.freeze(['①a', '①b', '②', '③', '④', '⑤', '⑥', '⑥b', '⑧', '⑦a', '⑦b']),
});

/* เปิดได้ต่อเมื่อ Owner/PE อนุมัติ placement contract ร่วม BBS ↔ A3 ↔ 3D ครบทุกมาร์ค */
const REBAR_3D_PLACEMENT_AUTHORIZED = false;

/**
 * รับ verdict ที่ Snapshot ปิดผลไว้แล้วเท่านั้น — 3D มีหน้าที่ตรวจ contract และฉายผลเดิม
 * ไม่ย้อนอ่าน checks เพื่อสร้าง PASS/FAIL ใหม่ใน renderer.
 */
function snapshotVerdictContract(snap) {
  const verdict = snap && snap.verdict;
  if (!verdict || typeof verdict.pass !== 'boolean'
      || !Number.isInteger(verdict.failedCount) || verdict.failedCount < 0
      || typeof verdict.statement !== 'string' || !verdict.statement.trim()
      || !Array.isArray(verdict.failed)
      || verdict.failed.length !== verdict.failedCount
      || verdict.pass !== (verdict.failedCount === 0)) {
    throw new TypeError('model3d: Snapshot verdict ขาด/ไม่สอดคล้อง — ปิดการสร้าง 3D');
  }
  return Object.freeze({
    source: 'snapshot.verdict',
    pass: verdict.pass,
    failedCount: verdict.failedCount,
    statement: verdict.statement,
    failed: Object.freeze(verdict.failed.map((item) => Object.freeze({ ...item }))),
  });
}

/**
 * 3D ต้องฉาย placement HOLD ของมาร์ค ⑧ จาก Snapshot ชุดเดียวกันแบบ exact เท่านั้น
 * ห้าม renderer สร้าง code/reason/label ของตัวเอง เพราะจะทำให้ A3/A4/DXF/3D คนละ authority.
 */
function snapshotRebarGeometryHoldContract(snap) {
  const hold = snap && snap.rebarGeometryHold;
  if (!hold || hold.status !== RW_REBAR_GEOMETRY_HOLD.status
      || hold.constructionAuthority !== false
      || !Array.isArray(hold.marks) || hold.marks.length !== 1 || hold.marks[0] !== '⑧'
      || hold.label !== RW_REBAR_GEOMETRY_HOLD.label
      || hold.reason !== RW_REBAR_GEOMETRY_HOLD.reason) {
    throw new TypeError('model3d: Snapshot rebarGeometryHold ของมาร์ค ⑧ ขาด/ถูกแก้ไข — ปิดการสร้าง 3D');
  }
  return hold;
}

/**
 * อ่านระยะเรียงที่ BBS ประกาศไว้เท่านั้น ไม่สร้างค่าแทนเมื่อข้อความไม่เป็น contract ที่อ่านได้
 * รูป `@150–200` เก็บเป็นช่วง; รูป `@175 ×4` เก็บเป็นค่าเดียว 175 มม.
 */
function bbsSpacingRange(row) {
  const match = String(row && row.detail).match(/@(\d+(?:\.\d+)?)(?:\s*[–-]\s*(\d+(?:\.\d+)?))?/);
  if (!match) return null;
  const a = Number(match[1]);
  const b = match[2] == null ? a : Number(match[2]);
  if (!positive(a) || !positive(b)) return null;
  return Object.freeze({ min: Math.min(a, b), max: Math.max(a, b) });
}

/** ตรวจความยาวตัดจาก bend contract เพื่อกัน renderer วาด shape ไม่ตรง BBS */
function bendContractLength(bend) {
  if (!bend || typeof bend !== 'object') return NaN;
  if (bend.type === 'straight' && positive(bend.a)) return bend.a;
  if (bend.type === 'L' && positive(bend.a) && positive(bend.b)) return bend.a + bend.b;
  if ((bend.type === 'hookB' || bend.type === 'U') && positive(bend.a) && positive(bend.b)) {
    return bend.a + 2 * bend.b;
  }
  if (bend.type === 'cog' && positive(bend.a) && positive(bend.b) && positive(bend.c)) {
    return bend.a + bend.b + bend.c;
  }
  return NaN;
}

/**
 * คืน row เฉพาะเมื่อข้อมูลจาก Snapshot ใช้สร้างรูป exact ได้ครบ
 * missing/unsupported row คืน null เพื่อให้ชั้นเรียกละเว้นและประกาศใน meta.omittedMarks
 */
function usableBbsRow(rows, mark, { bendTypes, spacing = false } = {}) {
  const row = rows.get(mark);
  if (!row || row.mk !== mark || !positive(row.size) || !positive(row.len)
      || typeof row.detail !== 'string' || !row.detail.trim()
      || typeof row.bendLabel !== 'string' || !row.bendLabel.trim()
      || !row.bend || typeof row.bend !== 'object') return null;
  if (Array.isArray(bendTypes) && !bendTypes.includes(row.bend.type)) return null;
  if (!close(bendContractLength(row.bend), row.len, 1e-7)) return null;
  const spacingRange = spacing ? bbsSpacingRange(row) : null;
  if (spacing && !spacingRange) return null;
  return Object.freeze({ row, spacingRange });
}

/** กำแพงมีครีบต้องมีผล geometry ครบก่อนสร้างวัตถุชิ้นแรก ห้าม fallback เป็นค่าประมาณ */
function counterfort3DContract(r) {
  const fail = (field) => { throw new TypeError('model3d: counterfort ขาดข้อมูล authoritative ' + field); };
  const i = r.i || {};
  for (const [name, value] of [
    ['cfLr', r.cfLr], ['cfHr', r.cfHr], ['Lt', r.Lt], ['i.L', i.L], ['i.bs', i.bs], ['i.Lw', i.Lw],
    ['i.B', i.B], ['i.hz', i.hz], ['i.hp', i.hp], ['i.t', i.t], ['i.cov', i.cov],
  ]) if (!positive(value)) fail(name);
  if (!r.qty || !Number.isInteger(r.qty.nBut) || r.qty.nBut < 1) fail('qty.nBut');
  if (!Array.isArray(r.strips) || !r.strips.length) fail('strips');
  r.strips.forEach((strip, k) => {
    if (!Number.isFinite(strip.z1) || !Number.isFinite(strip.z2) || strip.z2 <= strip.z1) {
      fail('strips[' + k + '].z1/z2');
    }
    for (const face of ['b_', 'b$']) {
      const bar = strip[face];
      if (!bar || !positive(bar.db) || !positive(bar.s)) fail('strips[' + k + '].' + face);
    }
  });
  const nCut = r.but && r.but.finCut && Number.isInteger(r.but.finCut.nCut)
    && r.but.finCut.nCut >= 0 ? r.but.finCut.nCut : null;
  return { strips: r.strips, finCut: Object.freeze({ nCut }) };
}

/**
 * สร้างกลุ่มวัตถุสามมิติของกำแพงหนึ่งชุด
 *
 * @param {object} THREE  ไลบรารี three.js
 * @param {object} snap   Snapshot จาก createRetainingWallSnapshot()
 * @param {object} [opt]
 * @param {number} [opt.maxBarsPerRun=140] เพดานจำนวนเหล็กต่อชุด กันเครื่องค้าง
 * @returns {{group: object, meta: object}}
 */
export function buildWall3D(THREE, snap, opt = {}) {
  if (!snap || !snap.ok) throw new TypeError('buildWall3D: ต้องมี Snapshot ที่คำนวณสำเร็จ');
  const verdict = snapshotVerdictContract(snap);
  const rebarGeometryHold = snapshotRebarGeometryHoldContract(snap);
  const snapAuthority = snap.authority;
  if (!snapAuthority || snapAuthority.constructionAuthority !== false
      || typeof snapAuthority.status !== 'string' || !snapAuthority.status.trim()
      || typeof snapAuthority.label !== 'string' || !snapAuthority.label.trim()) {
    throw new TypeError('model3d: Snapshot authority ต้องปิด construction และมี status/label ครบ');
  }
  const snapCoverage = snap.engineeringCoverage;
  if (!snapCoverage || snapCoverage.releaseAuthority !== false
      || snapCoverage.status !== 'HOLD_MISSING_SHEAR_TOE'
      || !Array.isArray(snapCoverage.excludedChecks)
      || !snapCoverage.excludedChecks.includes('SHEAR-TOE')
      || typeof snapCoverage.label !== 'string'
      || !snapCoverage.label.includes('BETA')
      || !snapCoverage.label.includes('SHEAR-TOE')
      || !snapCoverage.label.includes('NOT FOR CONSTRUCTION')) {
    throw new TypeError('model3d: Snapshot engineeringCoverage ต้องประกาศ BETA/SHEAR-TOE HOLD แบบ fail-closed');
  }
  for (const [name, value] of [
    ['id', snap.id], ['fingerprint', snap.fingerprint], ['engineVersion', snap.engineVersion],
  ]) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new TypeError('model3d: Snapshot trace ขาด ' + name);
    }
  }
  const i = snap.input;
  const r = snap.result;
  const cf = r.mode === 'but' ? counterfort3DContract(r) : null;
  const cap = Number.isFinite(opt.maxBarsPerRun) ? opt.maxBarsPerRun : 140;

  const B = i.B, hz = i.hz, hp = i.hp, t = i.t, toe = i.toe;
  const heel = r.heel;
  for (const [name, value] of [
    ['input.B', B], ['input.hz', hz], ['input.hp', hp], ['input.t', t],
    ['input.Lw', i.Lw], ['input.cov', i.cov], ['result.heel', heel],
  ]) {
    if (!positive(value)) throw new TypeError('model3d: ขาด geometry authoritative ' + name);
  }
  /* toe=0 เป็นค่าขอบที่ normalizeInput ประกาศรองรับ และ downstream ข้ามกล่องดินหน้าอยู่แล้ว */
  if (!Number.isFinite(toe) || toe < 0) {
    throw new TypeError('model3d: ขาด geometry authoritative input.toe');
  }
  const Lw = i.Lw;
  const cov = i.cov / 1000;
  const baseCoverContract = coverTable(i).find((row) => row.th === 'ฐานราก — ท้องฐาน (หล่อติดดิน)');
  if (!baseCoverContract || !positive(baseCoverContract.mm)
      || typeof baseCoverContract.src !== 'string' || !baseCoverContract.src.trim()) {
    throw new TypeError('model3d: ขาดระยะหุ้มฐาน authoritative');
  }
  const baseCov = baseCoverContract.mm / 1000;
  const tTop = r.tapered ? r.tTop : t;
  const xFront = -B / 2 + toe;          // ผิวหน้าพนัง (ด้าน toe)
  const xBack = xFront + t;             // ผิวหลังพนัง (ด้านดิน)
  const yTop = hz + hp;

  const group = new THREE.Group();
  const parts = { concrete: new THREE.Group(), soil: new THREE.Group(), rebar: new THREE.Group() };
  parts.concrete.name = 'concrete';
  parts.soil.name = 'soil';
  parts.rebar.name = 'rebar';
  parts.rebar.visible = false;
  parts.dims = new THREE.Group();
  parts.dims.name = 'dims';
  group.add(parts.concrete, parts.soil, parts.rebar, parts.dims);

  const edgeMat = new THREE.LineBasicMaterial({ color: PALETTE.edge, transparent: true, opacity: 0.55 });
  const solid = (color, opacity) => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, metalness: 0.02,
    transparent: opacity != null && opacity < 1, opacity: opacity == null ? 1 : opacity,
    side: THREE.DoubleSide,
  });

  /** กล่องพร้อมเส้นขอบ — เส้นขอบทำให้อ่านรูปทรงออกแม้ตอนหมุนเร็ว ๆ */
  const box = (w, h, d, mat, pos) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    return mesh;
  };

  /* ── คอนกรีต ── */
  parts.concrete.add(box(B, hz, Lw, solid(PALETTE.base), [0, hz / 2, 0]));

  if (r.tapered && Math.abs(tTop - t) > 1e-6) {
    /* ผนังสอบ: ผิวหน้าดิ่ง ผิวหลังเอียงเข้า — ใช้รูปตัดแล้วอัดออกตามความยาวกำแพง */
    const shape = new THREE.Shape();
    shape.moveTo(xFront, 0);
    shape.lineTo(xBack, 0);
    shape.lineTo(xFront + tTop, hp);
    shape.lineTo(xFront, hp);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: Lw, bevelEnabled: false });
    const mesh = new THREE.Mesh(geo, solid(PALETTE.stem));
    mesh.position.set(0, hz, -Lw / 2);
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
    parts.concrete.add(mesh);
  } else {
    parts.concrete.add(box(t, hp, Lw, solid(PALETTE.stem), [xFront + t / 2, hz + hp / 2, 0]));
  }

  if (i.dk > 0) {
    parts.concrete.add(box(t, i.dk, Lw, solid(PALETTE.key), [xFront + t / 2, -i.dk / 2, 0]));
  }

  /* ครีบยึด (counterfort) — สามเหลี่ยมอัดออกตามหนาครีบ bs
     ตำแหน่งฉาย c/c = r.Lt จาก engine โดยตรง; renderer ห้ามสร้าง Lt = L+bs ซ้ำ
     (เกลี่ยเท่ากันจะได้ช่วงกว้างกว่า L ที่ใช้ออกแบบ = ไม่อนุรักษ์) — เหมือน RW-02 */
  /* meta ด้านล่างใช้ค่านี้ — ประกาศนอก branch เพราะทั้งสองโหมดต้องรายงานความซื่อเรื่องระยะเรียง */
  let metaDrawnV = null, metaActualV = null;
  if (r.mode === 'but') {
    const cfL3 = r.cfLr, cfH3 = r.cfHr;
    const bs3 = i.bs;
    const Lt3 = r.Lt;
    const nBut3 = r.qty.nBut;
    const ribShape = new THREE.Shape();
    ribShape.moveTo(xBack, 0);
    ribShape.lineTo(xBack + cfL3, 0);
    ribShape.lineTo(xBack, cfH3);
    ribShape.closePath();
    for (let k = 0; k < nBut3; k++) {
      const z0 = Math.min(k * Lt3, Lw - bs3) - Lw / 2;
      const geo = new THREE.ExtrudeGeometry(ribShape, { depth: bs3, bevelEnabled: false });
      const mesh = new THREE.Mesh(geo, solid(PALETTE.key));
      mesh.position.set(0, hz, z0);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      parts.concrete.add(mesh);
    }
  }

  /* ── ดินถมหลังกำแพงและระดับน้ำ ── */
  if (heel > 0.01) {
    if (r.tapered && Math.abs(tTop - t) > 1e-6) {
      /* ผนังสอบ: หลังผนังเอียงเข้า ดินต้องไหลตามแนวสอบ ไม่ใช่กล่องที่ทิ้งลิ่มอากาศไว้ */
      const shape = new THREE.Shape();
      shape.moveTo(xBack, 0);
      shape.lineTo(xBack + heel, 0);
      shape.lineTo(xBack + heel, hp);
      shape.lineTo(xFront + tTop, hp);
      shape.closePath();
      const geo = new THREE.ExtrudeGeometry(shape, { depth: Lw, bevelEnabled: false });
      const mesh = new THREE.Mesh(geo, solid(PALETTE.soil, 0.55));
      mesh.position.set(0, hz, -Lw / 2);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      parts.soil.add(mesh);
    } else {
      parts.soil.add(box(heel, hp, Lw, solid(PALETTE.soil, 0.55),
        [xBack + heel / 2, hz + hp / 2, 0]));
    }
  }
  /* ผิวดินหน้ากำแพง — engine วัด D_f จากผิวดินหน้าลงมาถึงท้องฐาน
     รูปตัด 2D วาดเส้นผิวดินที่ y = Df จากท้องฐาน · 3D ต้องตรงกัน */
  if (i.Df > 0.01 && toe > 0.01) {
    parts.soil.add(box(toe, i.Df, Lw, solid(PALETTE.ground, 0.4),
      [-B / 2 + toe / 2, i.Df / 2, 0]));
  }
  const hw = Number.isFinite(r.hwb) ? r.hwb : 0;
  if (hw > 0.01 && heel > 0.01) {
    /* ★ hwb ของ engine วัดจาก "ท้องฐาน" (y=0) — รูปตัด 2D วาดที่ y=hwb
       เคยวางที่ hz+hwb ทำให้ระนาบน้ำใน 3D ลอยสูงกว่าแบบ 2D หนึ่งความหนาฐาน */
    parts.soil.add(box(heel, 0.012, Lw, solid(PALETTE.water, 0.6),
      [xBack + heel / 2, hw, 0]));
  }

  /* ── เหล็กเสริม ──
     3D เป็น projection ของ BBS ใน Snapshot เท่านั้น: shape/size/spacing/extent ขาดหรือไม่ exact = ไม่วาด */
  const barMatMain = REBAR_3D_PLACEMENT_AUTHORIZED ? solid(PALETTE.rebarMain) : null;
  const barMatSec = REBAR_3D_PLACEMENT_AUTHORIZED ? solid(PALETTE.rebarSec) : null;
  let barCount = 0;
  const rebarRuns = {};
  const renderedMarks = new Set();
  const projectionHolds = [];
  const quantityProjection = snap.quantityProjection;
  const bbsRows = new Map(quantityProjection && quantityProjection.source === 'engine.qty'
      && Array.isArray(quantityProjection.bbs)
    ? quantityProjection.bbs.map((row) => [row.mk, row]) : []);
  const modeKey = r.mode === 'but' ? 'but' : (r.gravity ? 'gravity' : 'cant');
  /* baseline ครอบมาร์คมาตรฐาน; union กับ BBS จริงทำให้ optional K1/มาร์คใหม่ถูก disclose ด้วย */
  const expectedMarks = [...new Set([...EXPECTED_MARKS[modeKey], ...bbsRows.keys()])].filter((mark) =>
    !(mark === '⑥b' && cf && cf.finCut.nCut === 0 && !bbsRows.has(mark)));
  expectedMarks.forEach((mark) => projectionHolds.push(Object.freeze({
    mark,
    code: mark === '⑧' ? rebarGeometryHold.status : 'DRAWING_3D_PLACEMENT_CONTRACT_REQUIRED',
    reason: mark === '⑧'
      ? rebarGeometryHold.reason
      : 'A3 ↔ 3D centerline/cover/layer placement ยังไม่มี shared contract ที่ Owner/PE อนุมัติ',
    ...(mark === '⑧' ? { label: rebarGeometryHold.label } : {}),
  })));

  const rowTrace = (row) => Object.freeze({
    source: 'snapshot.quantityProjection.bbs',
    mark: row.mk,
    sizeMm: row.size,
    detail: row.detail,
    unitLengthM: row.len,
    bendLabel: row.bendLabel,
    bend: Object.freeze({ ...row.bend }),
    extentM: Object.freeze({
      type: row.bend.type,
      a: row.bend.a,
      ...(Number.isFinite(row.bend.b) ? { b: row.bend.b } : {}),
      ...(Number.isFinite(row.bend.c) ? { c: row.bend.c } : {}),
    }),
  });
  const recordRun = (key, row, data, beforeCount) => {
    if (barCount <= beforeCount) return false;
    rebarRuns[key] = Object.freeze({ ...data, ...rowTrace(row) });
    renderedMarks.add(row.mk);
    return true;
  };

  const pathLength = (points) => points.slice(1).reduce((total, point, index) => {
    const prev = points[index];
    return total + Math.hypot(point[0] - prev[0], point[1] - prev[1], point[2] - prev[2]);
  }, 0);
  const barFromBbs = (row, points, mat) => {
    if (!row || !positive(row.size) || !Array.isArray(points) || points.length < 2
        || points.some((point) => !Array.isArray(point) || point.length !== 3
          || point.some((value) => !Number.isFinite(value)))) return false;
    if (!REBAR_3D_PLACEMENT_AUTHORIZED) return false;
    if (!close(pathLength(points), row.len, 1e-7)) return false;
    if (typeof THREE.CurvePath !== 'function' || typeof THREE.LineCurve3 !== 'function') {
      throw new TypeError('model3d: THREE ต้องรองรับ CurvePath/LineCurve3 เพื่อวาด BBS path แบบเส้นตรง exact');
    }
    const pts = points.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
    const curve = new THREE.CurvePath();
    for (let index = 1; index < pts.length; index++) {
      curve.add(new THREE.LineCurve3(pts[index - 1], pts[index]));
    }
    const geo = new THREE.TubeGeometry(curve, Math.max(2, pts.length * 3), row.size / 2000, 6, false);
    parts.rebar.add(new THREE.Mesh(geo, mat));
    barCount++;
    return true;
  };

  const zEnd = Lw / 2 - cov;
  const zStart = -Lw / 2 + cov;
  const hookedWallPath = (row, x, y, hookDirection) => {
    const { a, b } = row.bend;
    return [
      [x + hookDirection * b, y, -a / 2],
      [x, y, -a / 2],
      [x, y, a / 2],
      [x + hookDirection * b, y, a / 2],
    ];
  };

  if (r.mode === 'but') {
    /* ①a/①b: BBS ให้ hookB + ช่วงระยะเรียง; strips ให้ค่าระยะรายแถบที่ BBS สรุป min–max */
    const renderStripFace = (key, mark, face, x, hookDirection, mat) => {
      const contract = usableBbsRow(bbsRows, mark, { bendTypes: ['hookB'], spacing: true });
      if (!contract || !close(contract.row.bend.a, Lw, 1e-7)) return;
      const spacingValues = cf.strips.map((strip) => strip[face].s);
      const sizeValues = cf.strips.map((strip) => strip[face].db);
      if (sizeValues.some((size) => size !== contract.row.size)
          || !close(Math.min(...spacingValues), contract.spacingRange.min)
          || !close(Math.max(...spacingValues), contract.spacingRange.max)) return;
      const before = barCount;
      const drawnSpacingsM = [];
      const capBand = Math.max(3, Math.floor(cap / cf.strips.length));
      cf.strips.forEach((strip) => {
        const yLo = hz + hp - strip.z2;
        const yHi = hz + hp - strip.z1;
        const drawn = drawStep(strip[face].s / 1000, yHi - yLo, capBand);
        drawnSpacingsM.push(drawn);
        for (let y = yLo + drawn / 2; y < yHi; y += drawn) {
          barFromBbs(contract.row, hookedWallPath(contract.row, x, y, hookDirection), mat);
        }
      });
      recordRun(key, contract.row, {
        actualSpacingMm: spacingValues[spacingValues.length - 1],
        actualSpacingsMm: Object.freeze([...spacingValues]),
        drawnSpacingM: drawnSpacingsM[drawnSpacingsM.length - 1],
        drawnSpacingsM: Object.freeze([...drawnSpacingsM]),
        spacingRangeMm: contract.spacingRange,
        spacingSource: 'result.strips',
        orientation: 'wall-length-z',
        face: face === 'b_' ? 'soil' : 'outer',
      }, before);
    };
    renderStripFace('wallHorizontalSoilFace', '①a', 'b_', xBack - cov, -1, barMatMain);
    renderStripFace('wallHorizontalOuterFace', '①b', 'b$', xFront + cov, 1, barMatSec);
    const primaryRun = rebarRuns.wallHorizontalSoilFace;
    if (primaryRun) {
      metaActualV = primaryRun.actualSpacingMm;
      metaDrawnV = primaryRun.drawnSpacingM;
    }

    /* ②: วาดเฉพาะ L shape ที่ a+b เท่าความยาวตัด BBS; ไม่ clamp หรือเติมระยะเอง */
    const vertical = usableBbsRow(bbsRows, '②', { bendTypes: ['L'], spacing: true });
    if (vertical && close(vertical.spacingRange.min, vertical.spacingRange.max)) {
      const row = vertical.row;
      const yEnd = yTop - cov;
      const yStart = yEnd - row.bend.a;
      if (yStart >= -baseCov && yEnd <= yTop) {
        const drawn = drawStep(vertical.spacingRange.min / 1000, Lw, Math.min(cap, 20));
        const before = barCount;
        for (let z = zStart + drawn / 2; z < zEnd; z += drawn) {
          for (const [x, direction] of [[xBack - cov, -1], [xFront + cov, 1]]) {
            barFromBbs(row, [
              [x + direction * row.bend.b, yStart, z],
              [x, yStart, z],
              [x, yStart + row.bend.a, z],
            ], barMatSec);
          }
        }
        recordRun('wallVertical', row, {
          actualSpacingMm: vertical.spacingRange.min,
          drawnSpacingM: drawn,
          spacingRangeMm: vertical.spacingRange,
          orientation: 'vertical-y',
          faces: 2,
        }, before);
      }
    }

    /* ④ เป็น straight ตามยาวกำแพง; ③ rib-band และมาร์คครีบอื่น ๆ ยังไม่มี exact placement จึง omit */
    const heelBottom = usableBbsRow(bbsRows, '④', { bendTypes: ['straight'], spacing: true });
    if (heelBottom && close(heelBottom.row.bend.a, Lw, 1e-7)
        && close(heelBottom.spacingRange.min, heelBottom.spacingRange.max)) {
      const row = heelBottom.row;
      const drawn = drawStep(heelBottom.spacingRange.min / 1000, heel, cap);
      const before = barCount;
      const y = baseCov + row.size / 2000;
      for (let x = xBack + baseCov + drawn / 2; x < B / 2 - baseCov; x += drawn) {
        barFromBbs(row, [[x, y, -row.bend.a / 2], [x, y, row.bend.a / 2]], barMatSec);
      }
      recordRun('heelBottom', row, {
        actualSpacingMm: heelBottom.spacingRange.min,
        drawnSpacingM: drawn,
        spacingRangeMm: heelBottom.spacingRange,
        orientation: 'wall-length-z',
        layer: 'bottom',
      }, before);
    }
  } else {
    /* ③: เหล็กราบพนังสองหน้า — exact hookB จาก BBS; ไม่สร้าง DB/spacing เอง */
    const wallHorizontal = usableBbsRow(bbsRows, '③', { bendTypes: ['hookB'], spacing: true });
    if (wallHorizontal && close(wallHorizontal.row.bend.a, Lw, 1e-7)
        && close(wallHorizontal.spacingRange.min, wallHorizontal.spacingRange.max)) {
      const row = wallHorizontal.row;
      const drawn = drawStep(wallHorizontal.spacingRange.min / 1000, hp, Math.min(cap, 28));
      const before = barCount;
      for (let y = hz + drawn / 2; y < yTop - cov; y += drawn) {
        barFromBbs(row, hookedWallPath(row, xBack - cov, y, -1), barMatMain);
        barFromBbs(row, hookedWallPath(row, xFront + cov, y, 1), barMatSec);
      }
      if (recordRun('wallHorizontal', row, {
        actualSpacingMm: wallHorizontal.spacingRange.min,
        drawnSpacingM: drawn,
        spacingRangeMm: wallHorizontal.spacingRange,
        orientation: 'wall-length-z',
        faces: 2,
      }, before)) {
        metaActualV = wallHorizontal.spacingRange.min;
        metaDrawnV = drawn;
      }
    }

    /* ⑥: straight ตามยาวกำแพง บน+ล่าง */
    const baseLong = usableBbsRow(bbsRows, '⑥', { bendTypes: ['straight'], spacing: true });
    if (baseLong && close(baseLong.row.bend.a, Lw, 1e-7)
        && close(baseLong.spacingRange.min, baseLong.spacingRange.max)) {
      const row = baseLong.row;
      const drawn = drawStep(baseLong.spacingRange.min / 1000, B - 2 * baseCov, cap);
      const before = barCount;
      const ys = [baseCov + row.size / 2000, hz - baseCov - row.size / 2000];
      for (const y of ys) {
        for (let x = -B / 2 + baseCov + drawn / 2; x < B / 2 - baseCov; x += drawn) {
          barFromBbs(row, [[x, y, -row.bend.a / 2], [x, y, row.bend.a / 2]], barMatSec);
        }
      }
      recordRun('baseDistribution', row, {
        actualSpacingMm: baseLong.spacingRange.min,
        drawnSpacingM: drawn,
        spacingRangeMm: baseLong.spacingRange,
        orientation: 'wall-length-z',
        layers: 2,
      }, before);
    }
  }

  /* ⑧ และมาร์คอื่นถูก HOLD ทั้งชั้นด้านบน — renderer ห้ามเลือก placement แทน Owner/PE */

  const omittedMarks = Object.freeze(expectedMarks.filter((mark) => !renderedMarks.has(mark)));

  /* ── ระยะ · ค่าระดับ · ขนาด — ทุกตัวเลขมาจากชุดผล ไม่คิดเอง ──
     อ้างระดับเดียวกับรูปตัด RW-01: ±0.000 ที่ท้องฐาน · +hz ผิวบนฐาน · +hz+hp ยอดพนัง
     ป้ายข้อความใช้ canvas texture จึงมีเฉพาะฝั่งเบราว์เซอร์ — ใน node (ทดสอบ fake) วาดเฉพาะเส้น */
  {
    const dark = Number.isFinite(opt.background) && opt.background < 0x808080;
    const dimColor = dark ? 0x9fb3d1 : 0x3f4c5e;
    const lineMat = new THREE.LineBasicMaterial({ color: dimColor });
    const seg = (a, b) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]);
      parts.dims.add(new THREE.Line(g, lineMat));
    };
    const canLabel = !!(THREE.Sprite && THREE.CanvasTexture && typeof document !== 'undefined');
    const H = hz + hp;
    const labelH = Math.max(0.28, Math.max(B, H, Lw) * 0.045);   // สูงป้ายตามสัดส่วนโมเดล
    const label = (txt, x, y, z) => {
      if (!canLabel) return;
      const cnv = document.createElement('canvas');
      const ctx = cnv.getContext('2d');
      const fs = 44;
      ctx.font = fs + 'px Sarabun, "Noto Sans Thai", Tahoma, sans-serif';
      const w = Math.ceil(ctx.measureText(txt).width) + 18;
      cnv.width = w; cnv.height = fs + 18;
      const c2 = cnv.getContext('2d');
      c2.font = fs + 'px Sarabun, "Noto Sans Thai", Tahoma, sans-serif';
      c2.textBaseline = 'middle';
      /* พื้นจาง ๆ ให้อ่านออกทับทุกฉากหลัง ไม่ว่าโหมดสว่างหรือมืด */
      c2.fillStyle = dark ? 'rgba(13,21,34,0.82)' : 'rgba(255,255,255,0.82)';
      c2.fillRect(0, 0, w, cnv.height);
      c2.fillStyle = dark ? '#cfe0f5' : '#22303f';
      c2.fillText(txt, 9, cnv.height / 2);
      const tex = new THREE.CanvasTexture(cnv);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      sp.position.set(x, y, z);
      sp.scale.set(labelH * (w / cnv.height), labelH, 1);
      sp.renderOrder = 10;
      parts.dims.add(sp);
    };
    const fmt2 = (v) => v.toFixed(2);
    const lv = (v) => (Math.abs(v) < 5e-4 ? '±0.000' : (v > 0 ? '+' : '−') + Math.abs(v).toFixed(3));
    const tick = 0.10 + Math.max(B, H, Lw) * 0.012;
    const zF = Lw / 2 + 0.02;                      // ระนาบหน้าสุดของกำแพง
    const yD = -tick * 2.2;                        // แนวเส้นระยะใต้ท้องฐาน

    /* โซ่ระยะหน้ากำแพง: toe · t · heel + รวม B (เหมือนโซ่สองชั้นของ RW-01) */
    const xs = [-B / 2, -B / 2 + toe, -B / 2 + toe + t, B / 2];
    seg([xs[0], yD, zF], [xs[3], yD, zF]);
    for (const x of xs) seg([x, yD - tick / 2, zF], [x, yD + tick / 2, zF]);
    /* ป้ายโซ่อยู่ "ใต้" เส้น — ที่ว่างเหนือเส้นเป็นของธงค่าระดับ (เคยทับกันตรงมุมขวา) */
    const yLb = yD - tick * 1.15;
    label(fmt2(toe), (xs[0] + xs[1]) / 2, yLb, zF);
    label(fmt2(i.t), (xs[1] + xs[2]) / 2, yLb, zF);
    label(fmt2(heel), (xs[2] + xs[3]) / 2, yLb, zF);
    const yD2 = yD - tick * 3.1;
    seg([xs[0], yD2, zF], [xs[3], yD2, zF]);
    seg([xs[0], yD2 - tick / 2, zF], [xs[0], yD2 + tick / 2, zF]);
    seg([xs[3], yD2 - tick / 2, zF], [xs[3], yD2 + tick / 2, zF]);
    label('B = ' + fmt2(B) + ' ม.', 0, yD2 - tick * 1.6, zF);

    /* ความสูง: hz และ hp ที่ขอบหน้าซ้าย */
    const xL = -B / 2 - tick * 2.2;
    seg([xL, 0, zF], [xL, H, zF]);
    for (const y of [0, hz, H]) seg([xL - tick / 2, y, zF], [xL + tick / 2, y, zF]);
    label(fmt2(hz), xL - tick * 1.2, hz / 2, zF);
    label(fmt2(hp), xL - tick * 1.2, hz + hp / 2, zF);

    /* ความยาวกำแพง Lw ตามแนว z ที่ขอบ toe */
    const xF2 = -B / 2 - tick * 0.6;
    seg([xF2, yD, -Lw / 2], [xF2, yD, Lw / 2]);
    seg([xF2, yD - tick / 2, -Lw / 2], [xF2, yD + tick / 2, -Lw / 2]);
    seg([xF2, yD - tick / 2, Lw / 2], [xF2, yD + tick / 2, Lw / 2]);
    label('Lw = ' + fmt2(Lw) + ' ม.', xF2 - tick, yD + tick * 1.6, 0);

    /* ค่าระดับ — ธงสามระดับตรงมุมหลัง อ้างท้องฐาน = ±0.000 เหมือนแบบ 2D */
    const xR = B / 2 + tick * 2.6;
    for (const [y, txt] of [[0, lv(0)], [hz, lv(hz)], [H, lv(H)]]) {
      seg([B / 2, y, zF], [xR, y, zF]);
      /* sprite ถูกวางที่ "กึ่งกลาง" — ดันศูนย์กลางออกไปอีก ไม่งั้นครึ่งซ้ายจะทับป้าย heel */
      label(txt, xR + tick * 2.1, y + tick * 0.7, zF);
    }

    /* กำแพงมีครีบ — บอกระยะครีบตามสมมติฐาน engine เดียวกับผัง RW-02 */
    if (r.mode === 'but') {
      label('ครีบ ' + r.qty.nBut + ' ตัว @' + fmt2(r.Lt) + ' ม.',
        xBack + r.cfLr / 2, hz + r.cfHr + tick * 1.6, 0);
    }

    /* ผนังสอบต้องเปิดเผยความหนายอดจาก Snapshot; ไม่อนุมานจากความหนาโคน */
    if (!close(tTop, t, 1e-9)) {
      const xT0 = xFront;
      const xT1 = xFront + tTop;
      const yTT = H + tick * 1.4;
      seg([xT0, yTT, zF], [xT1, yTT, zF]);
      seg([xT0, yTT - tick / 2, zF], [xT0, yTT + tick / 2, zF]);
      seg([xT1, yTT - tick / 2, zF], [xT1, yTT + tick / 2, zF]);
      label('tTop = ' + fmt2(tTop) + ' ม.', (xT0 + xT1) / 2, yTT + tick, zF);
    }
  }

  const spacingSimplified = Object.values(rebarRuns).some((run) => {
    if (Array.isArray(run.actualSpacingsMm) && Array.isArray(run.drawnSpacingsM)
        && run.actualSpacingsMm.length === run.drawnSpacingsM.length) {
      return run.actualSpacingsMm.some((actual, index) =>
        Number.isFinite(actual) && Number.isFinite(run.drawnSpacingsM[index])
          && Math.abs(run.drawnSpacingsM[index] - actual / 1000) > 1e-6);
    }
    return Number.isFinite(run.actualSpacingMm) && Number.isFinite(run.drawnSpacingM)
      && Math.abs(run.drawnSpacingM - run.actualSpacingMm / 1000) > 1e-6;
  });
  const verticalSimplified = Number.isFinite(metaActualV) && Number.isFinite(metaDrawnV)
    && Math.abs(metaDrawnV - metaActualV / 1000) > 1e-6;

  return {
    group,
    parts,
    meta: {
      bars: barCount,
      /* ★ ถ้าระยะเรียงถูกขยายเพื่อวาด ต้องประกาศ ไม่ใช่ปล่อยให้เข้าใจว่าเหล็กห่างจริงเท่านี้ */
      drawnSpacingV: metaDrawnV,
      actualSpacingV: metaActualV,
      simplified: verticalSimplified || spacingSimplified,
      rebarRuns: Object.freeze({ ...rebarRuns }),
      geometryMarks: Object.freeze([...renderedMarks]),
      visibleMarks: Object.freeze([]),
      representedMarks: Object.freeze([]),
      omittedMarks,
      projectionHolds: Object.freeze([...projectionHolds]),
      rebarGeometryHold,
      authority: Object.freeze({
        status: 'PRESENTATION_ONLY',
        constructionAuthority: false,
        label: 'PRESENTATION ONLY · ' + snapCoverage.label + ' · ' + snapAuthority.label,
        verdictPass: verdict.pass,
        failedCount: verdict.failedCount,
        verdictStatement: verdict.statement,
        upstreamStatus: snapAuthority.status,
        upstreamLabel: snapAuthority.label,
        coverageStatus: snapCoverage.status,
        coverageLabel: snapCoverage.label,
        rebarGeometryHold,
      }),
      trace: Object.freeze({
        snapshotId: snap.id,
        fingerprint: typeof snap.fingerprint === 'string' ? snap.fingerprint : null,
        engineVersion: typeof snap.engineVersion === 'string' ? snap.engineVersion : null,
        verdictSource: verdict.source,
        verdictPass: verdict.pass,
        failedCount: verdict.failedCount,
        verdictStatement: verdict.statement,
        quantitySource: quantityProjection && quantityProjection.source === 'engine.qty'
          ? quantityProjection.source : null,
        baseCoverMm: baseCoverContract.mm,
        baseCoverSource: baseCoverContract.src,
        rebarGeometryHold,
      }),
      verdict,
      bounds: { B, hz, hp, Lw, heel, toe, t, tTop },
      snapshotId: snap.id,
    },
  };
}

/**
 * ติดตั้งฉากสามมิติลงบน canvas — ต้องรันในเบราว์เซอร์
 *
 * @returns {{dispose: Function, fit: Function, setView: Function, setDisplayMode: Function,
 *   setLayer: Function, setGrid: Function, meta: object}}
 */
export function mountWall3D(THREE, OrbitControls, canvas, snap, opt = {}) {
  const built = buildWall3D(THREE, snap, opt);
  const { B, hz, hp, Lw } = built.meta.bounds;
  const modelR = Math.max(Lw, B, hz + hp);

  const scene = new THREE.Scene();
  /* สีพื้นฉากรับจากหน้าที่เรียก — โหมดมืดของหน้าจอจะได้ไม่เจอฉากขาวจ้า */
  scene.background = new THREE.Color(Number.isFinite(opt.background) ? opt.background : 0xf3f6fb);
  scene.add(built.group);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(B * 1.6, (hz + hp) * 2.2, Lw * 1.1);
  scene.add(sun);

  /* พื้นอ้างอิงบาง ๆ ช่วยให้รู้ว่าอะไรคือระดับท้องฐาน */
  const dark = Number.isFinite(opt.background) && opt.background < 0x808080;
  const grid = new THREE.GridHelper(Math.max(B, Lw) * 2.2, 20,
    dark ? 0x33415c : 0xc3ccdb, dark ? 0x1d2941 : 0xe1e7f0);
  grid.position.y = 0;
  scene.add(grid);
  const layerState = { concrete: true, soil: true, rebar: false, dims: true, grid: true };

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  /* preserveDrawingBuffer ให้ภาพค้างอยู่ในบัฟเฟอร์หลังวาดเสร็จ
     จำเป็นสำหรับการบันทึกภาพและการจับภาพหน้าจอ — ค่าปริยายของ three คือลบทิ้งทันที */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const controls = new OrbitControls(camera, renderer.domElement);
  const reducedMotion = !!(window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.12;
  controls.target.set(0, (hz + hp) / 2.2, 0);

  /* ★ ล้อเมาส์ของ OrbitControls ถีบระยะทีละสเต็ปทันที (dolly ไม่ผ่าน damping)
     ทำให้ zoom กระตุกเป็นห้วง ๆ — ดักล้อเองใน capture phase (กัน handler
     ของ OrbitControls) สะสมเป็นระยะเป้า แล้วค่อย ๆ ไล่เข้าหาใน render loop
     · นิ้วหนีบบนจอสัมผัสยังใช้ของ OrbitControls ตามเดิม (ไม่โดนดัก) */
  const ZOOM_MIN = Math.max(0.4, modelR * 0.12);
  const ZOOM_MAX = modelR * 6;
  let zoomDist = null;
  const onWheel = (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    const cur = zoomDist == null ? camera.position.distanceTo(controls.target) : zoomDist;
    zoomDist = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, cur * Math.pow(1.0015, e.deltaY)));
  };
  /* reduced-motion ใช้ wheel ของ OrbitControls แบบทันที ไม่เพิ่ม interpolation เคลื่อนไหว */
  if (!reducedMotion) {
    renderer.domElement.addEventListener('wheel', onWheel, { capture: true, passive: false });
  }

  const resizeNow = () => {
    const w = Math.max(canvas.clientWidth || 0, 320);
    const h = Math.max(canvas.clientHeight || 0, 240);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };

  /** มุมกล้องเป็น presentation transform เท่านั้น ไม่อ่าน/สร้างค่ากำลังหรือระยะออกแบบ */
  let activeView = 'iso';
  let dimensionsRequested = true;
  let settingPreset = false;
  const presetFrames = new Map();
  const cameraOffset = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const syncDimensionVisibility = () => {
    built.parts.dims.visible = dimensionsRequested && activeView === 'iso';
  };
  const setView = (name = 'iso') => {
    const requested = name === 'front' ? 'end' : name;
    const view = ['iso', 'end', 'elevation', 'top'].includes(requested) ? requested : 'iso';
    const distance = modelR * 1.85;
    const ty = controls.target.y;
    if (view === 'end') {
      camera.up.set(0, 1, 0);
      camera.position.set(0, ty, distance);
    } else if (view === 'elevation') {
      camera.up.set(0, 1, 0);
      camera.position.set(distance, ty, 0);
    } else if (view === 'top') {
      camera.up.set(0, 0, -1);
      camera.position.set(0, ty + distance, 0);
    } else {
      camera.up.set(0, 1, 0);
      camera.position.set(distance * 0.72, (hz + hp) * 1.18, distance * 0.72);
    }
    settingPreset = true;
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    zoomDist = camera.position.distanceTo(controls.target);
    controls.update();
    activeView = view;
    presetFrames.set(view, Object.freeze({
      direction: new THREE.Vector3().copy(camera.position).sub(controls.target).normalize(),
      up: new THREE.Vector3().copy(camera.up).normalize(),
    }));
    settingPreset = false;
    syncDimensionVisibility();
    return activeView;
  };

  /** Orbit/Pan/Zoom ที่ยังตรงแกนเดิมคงชื่อ preset; เมื่อทิศกล้องพ้น preset ให้เป็น CUSTOM ทันที */
  const onControlsChange = () => {
    if (settingPreset) return;
    cameraOffset.copy(camera.position).sub(controls.target).normalize();
    cameraUp.copy(camera.up).normalize();
    let matched = null;
    for (const [name, frame] of presetFrames) {
      if (cameraOffset.dot(frame.direction) > 0.99999 && cameraUp.dot(frame.up) > 0.99999) {
        matched = name;
        break;
      }
    }
    const nextView = matched || 'custom';
    if (nextView === activeView) return;
    activeView = nextView;
    syncDimensionVisibility();
    if (typeof opt.onViewStateChange === 'function') {
      opt.onViewStateChange(Object.freeze({ view: activeView, dimensionsVisible: built.parts.dims.visible }));
    }
  };

  const fit = () => {
    /* ★ ตอนเพิ่งเปิดกล่อง canvas อาจยังกว้างศูนย์ ถ้าปล่อยผ่าน aspect จะกลายเป็น NaN
       แล้วเมทริกซ์ฉายพังทั้งฉาก จอจะว่างเปล่าโดยไม่มี error ให้เห็น */
    resizeNow();
    controls.target.set(0, (hz + hp) / 2.2, 0);
    setView('iso');
  };
  fit();
  controls.addEventListener('change', onControlsChange);

  /* โหมดเปิดชั้นเหล็กลดความทึบของผิว presentation เดิมเท่านั้น
     visibility ของแต่ละ layer ยังถูกควบคุมแยกและไม่มีการสร้าง geometry ใหม่ */
  const materialState = new Map();
  const meshMaterials = (root) => {
    const found = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((mat) => {
        if (!materialState.has(mat)) {
          materialState.set(mat, {
            opacity: Number.isFinite(mat.opacity) ? mat.opacity : 1,
            transparent: !!mat.transparent,
            depthWrite: mat.depthWrite !== false,
          });
        }
        found.add(mat);
      });
    });
    return found;
  };
  const concreteMaterials = meshMaterials(built.parts.concrete);
  const soilMaterials = meshMaterials(built.parts.soil);
  const restoreMaterials = (materials) => materials.forEach((mat) => {
    const state = materialState.get(mat);
    mat.opacity = state.opacity;
    mat.transparent = state.transparent;
    mat.depthWrite = state.depthWrite;
    mat.needsUpdate = true;
  });
  const fadeMaterials = (materials, factor) => materials.forEach((mat) => {
    const state = materialState.get(mat);
    mat.opacity = Math.max(0.08, state.opacity * factor);
    mat.transparent = true;
    mat.depthWrite = false;
    mat.needsUpdate = true;
  });
  let activeDisplayMode = 'overview';
  const setDisplayMode = (name = 'overview') => {
    const mode = name === 'rebar' && REBAR_3D_PLACEMENT_AUTHORIZED ? 'rebar' : 'overview';
    restoreMaterials(concreteMaterials);
    restoreMaterials(soilMaterials);
    if (mode === 'rebar') {
      fadeMaterials(concreteMaterials, 0.22);
      fadeMaterials(soilMaterials, 0.18);
    }
    activeDisplayMode = mode;
    return activeDisplayMode;
  };

  /* โมเดลนิ่งสนิท — ปิดการคำนวณเมทริกซ์ซ้ำทุกเฟรมของออบเจกต์นับร้อยชิ้น */
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => { o.matrixAutoUpdate = false; });

  let alive = true;
  let disposed = false;
  let animationFrameId = null;
  const zoomOff = new THREE.Vector3();
  const tick = () => {
    if (!alive) return;
    animationFrameId = window.requestAnimationFrame(tick);
    /* กล่อง 3D ถูกปิดแต่ viewer ยังอยู่ — หยุดเผา GPU เงียบ ๆ จนกว่าจะเปิดใหม่ */
    if (canvas.offsetParent === null) return;
    if (zoomDist != null) {
      zoomOff.copy(camera.position).sub(controls.target);
      const cur = zoomOff.length();
      const next = cur + (zoomDist - cur) * 0.18;
      if (Math.abs(next - cur) > 1e-4) {
        camera.position.copy(controls.target).addScaledVector(zoomOff.normalize(), next);
      }
    }
    controls.update();
    renderer.render(scene, camera);
  };
  tick();

  let resizeTimer = null;
  const queueResize = () => {
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      resizeNow();
    }, 60);
  };
  window.addEventListener('resize', queueResize);
  const resizeObserver = typeof window.ResizeObserver === 'function'
    ? new window.ResizeObserver(queueResize) : null;
  if (resizeObserver) resizeObserver.observe(canvas.parentElement || canvas);

  /**
   * ฝัง authority ลงใน bitmap จริง ไม่พึ่ง DOM overlay ที่จะหายเมื่อส่งไฟล์ PNG ต่อ
   * ข้อความทั้งหมดอ่านจาก Snapshot/metadata; ไม่มีการคำนวณกำลังหรือ geometry ที่นี่
   */
  const stampedPng = () => {
    if (typeof document === 'undefined') throw new TypeError('model3d: PNG export ต้องรันใน browser');
    const trace = built.meta.trace || {};
    const authorityMeta = built.meta.authority;
    const verdictMeta = built.meta.verdict;
    const rebarGeometryHold = snapshotRebarGeometryHoldContract({
      rebarGeometryHold: built.meta.rebarGeometryHold,
    });
    if (!authorityMeta || authorityMeta.constructionAuthority !== false
        || typeof authorityMeta.label !== 'string' || !authorityMeta.label.trim()
        || !verdictMeta || verdictMeta.source !== 'snapshot.verdict'
        || typeof verdictMeta.pass !== 'boolean'
        || !Number.isInteger(verdictMeta.failedCount) || verdictMeta.failedCount < 0
        || typeof verdictMeta.statement !== 'string' || !verdictMeta.statement.trim()
        || !Array.isArray(verdictMeta.failed)
        || verdictMeta.failed.length !== verdictMeta.failedCount
        || verdictMeta.pass !== (verdictMeta.failedCount === 0)
        || authorityMeta.verdictPass !== verdictMeta.pass
        || authorityMeta.failedCount !== verdictMeta.failedCount
        || authorityMeta.verdictStatement !== verdictMeta.statement
        || trace.verdictSource !== verdictMeta.source
        || trace.verdictPass !== verdictMeta.pass
        || trace.failedCount !== verdictMeta.failedCount
        || trace.verdictStatement !== verdictMeta.statement
        || authorityMeta.rebarGeometryHold !== rebarGeometryHold
        || trace.rebarGeometryHold !== rebarGeometryHold
        || typeof trace.snapshotId !== 'string' || !trace.snapshotId.trim()
        || typeof trace.fingerprint !== 'string' || !trace.fingerprint.trim()
        || typeof trace.engineVersion !== 'string' || !trace.engineVersion.trim()) {
      throw new TypeError('model3d: PNG authority/trace ไม่ครบ — ปิดการส่งออก');
    }
    const width = Math.max(1, canvas.width || 0);
    const height = Math.max(1, canvas.height || 0);
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const ctx = output.getContext('2d');
    if (!ctx) throw new TypeError('model3d: browser ไม่รองรับ PNG stamp canvas');
    ctx.drawImage(canvas, 0, 0, width, height);

    const scale = Math.max(0.72, Math.min(1.8, width / 1200));
    const pad = Math.round(16 * scale);
    const line = Math.round(18 * scale);
    const small = Math.round(12 * scale);
    const normal = Math.round(13 * scale);
    const viewLabels = {
      iso: 'ISOMETRIC PERSPECTIVE', end: 'FROM +Z · PERSPECTIVE', elevation: 'FROM +X · PERSPECTIVE',
      top: 'FROM +Y · PERSPECTIVE', custom: 'CUSTOM ORBIT · PERSPECTIVE',
    };
    const geometryMarks = built.meta.geometryMarks.length ? built.meta.geometryMarks.join(', ') : 'NONE';
    const visibleMarks = layerState.rebar && built.meta.geometryMarks.length
      ? built.meta.geometryMarks.join(', ') : 'NONE';
    const omitted = built.meta.omittedMarks.length ? built.meta.omittedMarks.join(', ') : 'NONE';
    const holdGroups = new Map();
    built.meta.projectionHolds.forEach((item) => {
      if (!holdGroups.has(item.code)) holdGroups.set(item.code, []);
      holdGroups.get(item.code).push(item.mark);
    });
    const holds = holdGroups.size
      ? [...holdGroups].map(([code, marks]) => marks.join(', ') + ' · ' + code).join(' | ') : 'NONE';
    const authority = authorityMeta.label;
    const verdictLabel = verdictMeta.pass ? 'PASS' : 'FAIL';
    const verdictWatermark = verdictMeta.pass
      ? 'ENGINE VERDICT: PASS · REGISTERED CHECKS ONLY'
      : 'ENGINE VERDICT: FAIL · ' + verdictMeta.failedCount + ' FAILED';

    ctx.fillStyle = 'rgba(4, 21, 46, 0.94)';
    ctx.fillRect(0, 0, width, Math.round(46 * scale));
    ctx.fillStyle = '#ff6a00';
    ctx.fillRect(0, Math.round(43 * scale), width, Math.max(2, Math.round(3 * scale)));
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${Math.round(15 * scale)}px Prompt, Sarabun, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('RW-3D · 3D ENGINEERING VIEWER · ' + viewLabels[activeView], pad, Math.round(22 * scale), width - pad * 2);

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(-Math.PI / 14);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(170, 54, 18, 0.22)';
    ctx.font = `900 ${Math.max(18, Math.round(Math.min(width, height) * 0.075))}px Prompt, Sarabun, sans-serif`;
    ctx.fillText(verdictWatermark, 0, -line * 2.8, width * 0.88);
    ctx.fillText('PRESENTATION ONLY', 0, 0, width * 0.88);
    ctx.fillText('NOT FOR CONSTRUCTION', 0, line * 2.8, width * 0.88);
    ctx.restore();

    const footerLines = [
      'Snapshot: ' + (trace.snapshotId || built.meta.snapshotId || '—') + ' · Engine: ' + (trace.engineVersion || '—'),
      'Fingerprint: ' + (trace.fingerprint || '—'),
      'Authority: ' + authority,
      'Engine verdict: ' + verdictLabel + ' · Failed registered checks: ' + verdictMeta.failedCount,
      'Verdict statement: ' + verdictMeta.statement,
      'Geometry marks available: ' + geometryMarks,
      'Visible marks in export: ' + visibleMarks,
      'Layer state: concrete ' + (layerState.concrete ? 'ON' : 'OFF')
        + ' · soil ' + (layerState.soil ? 'ON' : 'OFF') + ' · rebar HOLD/OFF'
        + ' · dimensions ' + (built.parts.dims.visible ? 'ON' : 'OFF') + ' · grid ' + (layerState.grid ? 'ON' : 'OFF'),
      'Omitted marks: ' + omitted,
      'Projection HOLD: ' + holds,
      'Rebar geometry HOLD: ' + rebarGeometryHold.label,
    ];
    const footerHeight = pad * 2 + line * footerLines.length;
    const footerY = Math.max(Math.round(48 * scale), height - footerHeight);
    ctx.fillStyle = 'rgba(4, 21, 46, 0.92)';
    ctx.fillRect(0, footerY, width, height - footerY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    footerLines.forEach((text, index) => {
      const highlighted = text.startsWith('Authority:') || text.startsWith('Engine verdict:')
        || text.startsWith('Projection HOLD:') || text.startsWith('Rebar geometry HOLD:');
      ctx.font = `${highlighted ? 800 : 650} ${index === 1 ? small : normal}px Prompt, Sarabun, sans-serif`;
      ctx.fillStyle = highlighted ? '#ffb36b' : '#edf4ff';
      ctx.fillText(text, pad, footerY + pad + index * line, width - pad * 2);
    });
    return output.toDataURL('image/png');
  };

  return {
    meta: built.meta,
    fit,
    setView,
    setDisplayMode,
    /* จำนวนครั้งที่วาดจริง — ใช้ยืนยันว่าฉากถูกเรนเดอร์ ไม่ใช่จอว่างเพราะ error เงียบ */
    renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    /** บันทึกภาพมุมที่เห็นอยู่พร้อม authority stamp ใน bitmap */
    toPng: stampedPng,
    setLayer(name, visible) {
      const g = built.parts[name];
      if (name === 'dims') {
        dimensionsRequested = !!visible;
        layerState.dims = dimensionsRequested;
        syncDimensionVisibility();
      } else if (name === 'rebar') {
        layerState.rebar = false;
        if (g) g.visible = false;
      } else if (g) {
        layerState[name] = !!visible;
        g.visible = !!visible;
      }
    },
    setGrid(visible) {
      layerState.grid = !!visible;
      grid.visible = !!visible;
    },
    viewState: () => ({
      view: activeView,
      displayMode: activeDisplayMode,
      reducedMotion,
      dimensionsVisible: built.parts.dims.visible,
      layerState: Object.freeze({ ...layerState, dims: built.parts.dims.visible }),
    }),
    dispose() {
      if (disposed) return;
      disposed = true;
      alive = false;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      window.removeEventListener('resize', queueResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      if (!reducedMotion) renderer.domElement.removeEventListener('wheel', onWheel, true);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      const disposedTextures = new Set();
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
          if (m.map && typeof m.map.dispose === 'function' && !disposedTextures.has(m.map)) {
            disposedTextures.add(m.map);
            m.map.dispose();
          }
          m.dispose();
        });
      });
      renderer.dispose();
    },
  };
}
