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

import { coverTable } from './drafting/draftingStandard.js?rwv=20260930-load-units-1';
import { RW_REBAR_GEOMETRY_HOLD } from './authorityContracts.mjs?rwv=20260930-load-units-1';
import { buildDesignRebarLayout, requireRebarProjection } from './rebarLayout.mjs?rwv=20261003-main-equations-1';
import { mountSmoothZoom } from './smoothZoom.mjs?rwv=20261001-component-camera-1';
import {resultUnits} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
import {mountStressOverlay} from './stressContour.mjs?rwv=20261003-cad-contour-1&stay=20261004-alternate-1';
import { fitCameraToBounds, mountCameraKeys } from './cameraControls.mjs?rwv=20261001-component-camera-1';

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
  force: 0xd75424,     // แรงกระทำ/resultant จาก Snapshot
  moment: 0x1f70c1,    // BMD จาก forceDesign
  shear: 0xd99016,     // SFD จาก forceDesign
  pass: 0x23865c,      // สถานะที่ Snapshot ระบุว่าผ่าน
  fail: 0xc43e35,      // สถานะที่ Snapshot ระบุว่าไม่ผ่าน
  hold: 0xb07a16,      // HOLD ที่ Snapshot ระบุไว้
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

/* แสดงแกนเหล็กออกแบบตามผลเลือกเหล็ก ไม่อ้างรายการตัด/ดัดเพื่อผลิต */
const SHOW_DESIGN_REBAR = true;

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
 * 3D ต้องใช้ contract ของ shared Engine layout มาร์ค ⑧ จาก Snapshot เดียวกัน
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
 * แปลง forceDesign + verdict ใน Snapshot เป็น contract สำหรับ 3D เท่านั้น.
 * ไม่มีการหาร D/C หรือสร้าง PASS/FAIL ใหม่ใน renderer นี้.
 */
export function buildWall3DEngineeringProjection(snap) {
  const verdict = snapshotVerdictContract(snap);
  const force = snap && snap.forceDesign;
  if (!force || force.source !== 'engine.result' || !force.loads
      || !Array.isArray(force.members) || force.members.length !== 3) {
    throw new TypeError('model3d: Snapshot forceDesign ต้องมาจาก engine.result และครบสามองค์อาคาร');
  }
  for (const key of ['lateral', 'water', 'surcharge', 'bearingToe', 'bearingHeel']) {
    if (!Number.isFinite(force.loads[key])) {
      throw new TypeError('model3d: forceDesign.loads.' + key + ' ต้องเป็นตัวเลขจำกัด');
    }
  }
  const members = new Map(force.members.map((member) => [member && member.id, member]));
  if (members.size !== 3 || !members.has('stem') || !members.has('heel') || !members.has('toe')) {
    throw new TypeError('model3d: forceDesign.members ต้องมี stem/heel/toe อย่างละหนึ่ง');
  }

  const failedByTarget = { stem: [], heel: [], toe: [], base: [], global: [] };
  for (const item of verdict.failed) {
    const key = String(item && item.k || '');
    /* Registered member failures map to their physical host. */
    if (/STEM/i.test(key)) failedByTarget.stem.push(key);
    else if (/HEEL/i.test(key)) failedByTarget.heel.push(key);
    else if (/TOE/i.test(key)) failedByTarget.toe.push(key);
    else if (/OVERTURNING|SLIDING|BEARING|ECCENTRICITY|GLOBAL SLIP|SECTION SIZE|REBAR FIT|PILE/i.test(key)) {
      failedByTarget.base.push(key);
    } else failedByTarget.global.push(key);
  }

  const memberProjection = ['stem', 'heel', 'toe'].map((id) => {
    const member = members.get(id);
    if (!member || !Array.isArray(member.bmd) || !Array.isArray(member.sfd)
        || member.bmd.length < 2 || member.sfd.length < 2
        || !Number.isFinite(member.moment) || !Number.isFinite(member.shear)
        || !Number.isFinite(member.shearCapacity)
        || !['PASS', 'FAIL'].includes(member.shearStatus)
        || !Number.isFinite(member.shearDc) || !member.shearIncludedInVerdict
        || !member.maxDesignUtilization || !Number.isFinite(member.maxDesignUtilization.dc)
        || !member.governingSteel?.selected) {
      throw new TypeError('model3d: forceDesign member ' + id + ' ไม่ครบ');
    }
    const failed = failedByTarget[id].length > 0;
    const status = failed ? 'FAIL' : 'PASS';
    return Object.freeze({
      id,
      label: member.label,
      axisLabel: member.axisLabel,
      diagramKind: member.diagramKind,
      status,
      statusSource: 'snapshot.verdict.failed',
      failedChecks: Object.freeze([...failedByTarget[id]]),
      moment: member.moment,
      shear: member.shear,
      shearCapacity: member.shearCapacity,
      shearStatus: member.shearStatus,
      shearDc: member.shearDc,
      shearIncludedInVerdict: member.shearIncludedInVerdict,
      selectedRebar: member.governingSteel.selected + ' · ' + member.governingSteel.face,
      rebarDc: member.maxDesignUtilization.dc,
      rebarPass: member.rebarPass,
      length: member.length,
      bmd: Object.freeze(member.bmd.map((point) => Object.freeze({ x: point.x, y: point.y }))),
      sfd: Object.freeze(member.sfd.map((point) => Object.freeze({ x: point.x, y: point.y }))),
    });
  });

  return Object.freeze({
    source: 'snapshot.forceDesign+snapshot.verdict',
    loadSource: 'snapshot.forceDesign.loads',
    diagramSource: 'snapshot.forceDesign.members[].bmd/sfd',
    statusSource: 'snapshot.verdict.failed',
    loads: Object.freeze({ ...force.loads }),
    members: Object.freeze(memberProjection),
    baseStatus: failedByTarget.base.length ? 'FAIL' : 'PASS',
    baseFailedChecks: Object.freeze([...failedByTarget.base]),
    unmappedFailedChecks: Object.freeze([...failedByTarget.global]),
    legend: Object.freeze({ force: 'แรงกระทำ', moment: 'BMD', shear: 'SFD', pass: 'PASS', fail: 'FAIL', hold: 'HOLD' }),
  });
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
  let displayUnits=resultUnits(opt.unitMode==='kgf'?'kgf':'si');
  const quantityLabels=[];
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
      || snapCoverage.status !== 'REGISTERED_CHECKS_COMPLETE'
      || !Array.isArray(snapCoverage.excludedChecks)
      || snapCoverage.excludedChecks.length !== 0
      || typeof snapCoverage.label !== 'string'
      || !snapCoverage.label.includes('STEM / HEEL / TOE')
      || !snapCoverage.label.includes('NOT FOR CONSTRUCTION')) {
    throw new TypeError('model3d: Snapshot engineeringCoverage ต้องครอบคลุม STEM/HEEL/TOE');
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
  const engineering = buildWall3DEngineeringProjection(snap);
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
  const parts = {
    concrete: new THREE.Group(), soil: new THREE.Group(), rebar: new THREE.Group(),
    loads: new THREE.Group(), diagrams: new THREE.Group(), status: new THREE.Group(),
  };
  parts.concrete.name = 'concrete';
  parts.soil.name = 'soil';
  parts.rebar.name = 'rebar';
  parts.loads.name = 'loads';
  parts.diagrams.name = 'diagrams';
  parts.status.name = 'status';
  parts.rebar.visible = false;
  parts.loads.visible = false;
  parts.diagrams.visible = false;
  parts.status.visible = false;
  parts.dims = new THREE.Group();
  parts.dims.name = 'dims';
  group.add(parts.concrete, parts.soil, parts.rebar, parts.loads, parts.diagrams, parts.status, parts.dims);

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

  /* ── ชั้นข้อมูลวิศวกรรม ──
     ทุกค่าอ่านจาก Snapshot.forceDesign/verdict ที่ validate แล้วด้านบน. เส้น/ลูกศรเป็น
     presentation glyph เท่านั้น ไม่คำนวณแรงหรือ PASS/FAIL ซ้ำใน 3D. */
  const overlayGap = Math.max(0.14, Math.min(B, hp + hz, Lw) * 0.055);
  const overlayZ = Lw / 2 + overlayGap * 1.2;
  const lineMaterial = (color, opacity = 1) => new THREE.LineBasicMaterial({
    color, transparent: opacity < 1, opacity,
  });
  const polyline = (parent, points, material) => {
    if (!Array.isArray(points) || points.length < 2
        || points.some((point) => !Array.isArray(point) || point.length !== 3
          || point.some((value) => !Number.isFinite(value)))) return null;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((point) =>
      new THREE.Vector3(point[0], point[1], point[2])));
    const line = new THREE.Line(geometry, material);
    parent.add(line);
    return line;
  };
  const arrow = (parent, start, end, material) => {
    polyline(parent, [start, end], material);
    const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
    const length = Math.hypot(dx, dy, dz);
    if (!(length > 1e-9)) return;
    const ux = dx / length, uy = dy / length, uz = dz / length;
    const head = Math.min(length * 0.28, overlayGap * 0.72);
    /* เลือกเวกเตอร์ตั้งฉากที่อ่านได้ในระนาบหลักของลูกศร */
    let px = -uy, py = ux, pz = 0;
    let plen = Math.hypot(px, py, pz);
    if (plen < 1e-9) { px = -uz; py = 0; pz = ux; plen = Math.hypot(px, py, pz); }
    px /= plen; py /= plen; pz /= plen;
    const spread = head * 0.48;
    const base = [end[0] - ux * head, end[1] - uy * head, end[2] - uz * head];
    polyline(parent, [end, [base[0] + px * spread, base[1] + py * spread, base[2] + pz * spread]], material);
    polyline(parent, [end, [base[0] - px * spread, base[1] - py * spread, base[2] - pz * spread]], material);
  };

  const glyphLabel = (parent, txt, x, y, z, color = '#16263c', quantity=null) => {
    if (!(THREE.Sprite && THREE.CanvasTexture && typeof document !== 'undefined')) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const fontSize = 40;
    ctx.font = '800 ' + fontSize + 'px Sarabun, "Noto Sans Thai", Tahoma, sans-serif';
    const texture = new THREE.CanvasTexture(canvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
    const height = Math.max(0.3, Math.max(B, hp + hz, Lw) * 0.042);
    sprite.position.set(x, y, z);
    const paint=()=>{
      const label=quantity?quantity.prefix+' '+displayUnits.quantity(quantity.value,quantity.unit,1):txt;
      ctx.font='800 '+fontSize+'px Sarabun, "Noto Sans Thai", Tahoma, sans-serif';
      const width=Math.ceil(ctx.measureText(label).width)+24;
      canvas.width=width;canvas.height=fontSize+20;
      const draw=canvas.getContext('2d');
      draw.font='800 '+fontSize+'px Sarabun, "Noto Sans Thai", Tahoma, sans-serif';
      draw.textBaseline='middle';draw.fillStyle='rgba(255,255,255,0.92)';
      draw.fillRect(0,0,width,canvas.height);draw.strokeStyle=color;draw.lineWidth=3;
      draw.strokeRect(1.5,1.5,width-3,canvas.height-3);draw.fillStyle=color;
      draw.fillText(label,12,canvas.height/2);texture.needsUpdate=true;
      sprite.scale.set(height*width/canvas.height,height,1);
      // The mounted scene freezes matrixAutoUpdate after construction.
      // Repaint can change just this sprite's width without moving the model.
      sprite.updateMatrix();
      sprite.userData.quantityLabel=label;
    };
    paint();if(quantity)quantityLabels.push(paint);
    sprite.renderOrder = 20;
    parent.add(sprite);
  };

  const actionArrow = (start, end, label, labelPosition, quantity=null) => {
    if (typeof THREE.ArrowHelper === 'function') {
      const dx = end[0] - start[0], dy = end[1] - start[1], dz = end[2] - start[2];
      const length = Math.hypot(dx, dy, dz);
      const direction = new THREE.Vector3(dx, dy, dz).normalize();
      const helper = new THREE.ArrowHelper(direction, new THREE.Vector3(...start), length,
        PALETTE.force, Math.min(length * 0.34, overlayGap * 1.15), Math.min(length * 0.2, overlayGap * 0.65));
      parts.loads.add(helper);
    } else arrow(parts.loads, start, end, forceMat);
    glyphLabel(parts.loads, label, labelPosition[0], labelPosition[1], labelPosition[2], '#b33b18',quantity);
  };

  const forceMat = lineMaterial(PALETTE.force);
  const forceLength = Math.max(0.52, Math.min(Math.max(B, hp), 8) * 0.23);
  if (Math.abs(engineering.loads.lateral) > 1e-9) {
    actionArrow(
      [xBack + forceLength, hz + hp / 3, overlayZ],
      [xBack + overlayGap * 0.12, hz + hp / 3, overlayZ],
      'Ph ' + engineering.loads.lateral.toFixed(1) + ' kN/m',
      [xBack + forceLength * 0.58, hz + hp / 3 + overlayGap * 1.1, overlayZ],
      {prefix:'Ph',value:engineering.loads.lateral,unit:'kN/m'});
  }
  if (Math.abs(engineering.loads.water) > 1e-9) {
    const waterY = Math.max(hz + overlayGap, Math.min(yTop - overlayGap, hw / 3));
    actionArrow(
      [xBack + forceLength * 0.82, waterY, overlayZ + overlayGap * 0.35],
      [xBack + overlayGap * 0.12, waterY, overlayZ + overlayGap * 0.35],
      'Pw ' + engineering.loads.water.toFixed(1) + ' kN/m',
      [xBack + forceLength * 0.52, waterY + overlayGap * 1.1, overlayZ + overlayGap * 0.35],
      {prefix:'Pw',value:engineering.loads.water,unit:'kN/m'});
  }
  if (Math.abs(engineering.loads.surcharge) > 1e-9 && heel > 0.01) {
    const x = xBack + heel * 0.62;
    actionArrow([x, yTop + forceLength, overlayZ], [x, yTop + overlayGap * 0.08, overlayZ],
      'q ' + engineering.loads.surcharge.toFixed(1) + ' kPa',
      [x + overlayGap * 1.35, yTop + forceLength * 0.62, overlayZ],
      {prefix:'q',value:engineering.loads.surcharge,unit:'kPa'});
  }
  const bearingArrow = (x, value, label) => {
    if (Math.abs(value) <= 1e-9) return;
    const start = value >= 0 ? [x, -forceLength, overlayZ] : [x, -overlayGap * 0.08, overlayZ];
    const end = value >= 0 ? [x, -overlayGap * 0.08, overlayZ] : [x, -forceLength, overlayZ];
    actionArrow(start, end, label + ' ' + value.toFixed(1) + ' kPa',
      [x + overlayGap * 1.45, -forceLength * 0.55, overlayZ],{prefix:label,value,unit:'kPa'});
  };
  bearingArrow(-B / 2 + Math.max(toe, t) * 0.38, engineering.loads.bearingToe, 'qtoe');
  bearingArrow(xBack + Math.max(heel, t) * 0.62, engineering.loads.bearingHeel, 'qheel');
  glyphLabel(parts.loads, 'BASE REACTION · qtoe / qheel', 0,
    -forceLength * 1.3, overlayZ, '#8a5e0a');

  const momentMat = lineMaterial(PALETTE.moment);
  const shearMat = lineMaterial(PALETTE.shear);
  const axisMat = lineMaterial(PALETTE.edge, 0.58);
  const maxAbs = (points) => Math.max(1e-9, ...points.map((point) => Math.abs(point.y)));
  const engineeringMember = (id) => engineering.members.find((member) => member.id === id);
  const stemEngineering = engineeringMember('stem');
  const stemPlot = (points, axisX, material) => {
    const scale = overlayGap * 3.5 / maxAbs(points);
    const plot = points.map((point) => [axisX - point.y * scale, yTop - point.x, overlayZ]);
    polyline(parts.diagrams, [[axisX, hz, overlayZ], [axisX, yTop, overlayZ]], axisMat);
    polyline(parts.diagrams, plot, material);
  };
  stemPlot(stemEngineering.bmd, xFront - overlayGap * 1.2, momentMat);
  stemPlot(stemEngineering.sfd, xFront - overlayGap * 3.7, shearMat);
  glyphLabel(parts.diagrams, 'BMD', xFront - overlayGap * 1.2, yTop + overlayGap, overlayZ, '#1f70c1');
  glyphLabel(parts.diagrams, 'SFD', xFront - overlayGap * 3.7, yTop + overlayGap, overlayZ, '#b06d0a');

  const basePlot = (member, side, level, material, points) => {
    const scale = overlayGap * 2.35 / maxAbs(points);
    if (r.mode === 'but' && side === 'heel') {
      const x = xBack + heel / 2;
      const z0 = -member.length / 2;
      polyline(parts.diagrams, [[x, level, z0], [x, level, z0 + member.length]], axisMat);
      polyline(parts.diagrams,
        points.map((point) => [x, level + point.y * scale, z0 + point.x]), material);
      return;
    }
    const xOf = side === 'heel'
      ? (distance) => B / 2 - distance
      : (distance) => -B / 2 + distance;
    polyline(parts.diagrams,
      [[xOf(0), level, overlayZ], [xOf(member.length), level, overlayZ]], axisMat);
    polyline(parts.diagrams,
      points.map((point) => [xOf(point.x), level + point.y * scale, overlayZ]), material);
  };
  for (const id of ['heel', 'toe']) {
    const member = engineeringMember(id);
    basePlot(member, id, hz + overlayGap * 1.2, momentMat, member.bmd);
    basePlot(member, id, hz + overlayGap * 3.7, shearMat, member.sfd);
  }

  const statusMaterial = (status) => solid(
    status === 'FAIL' ? PALETTE.fail : status === 'HOLD' ? PALETTE.hold : PALETTE.pass, 0.23);
  const stemStatus = engineeringMember('stem').status;
  parts.status.add(box(t + overlayGap * 0.09, hp + overlayGap * 0.09, Lw + overlayGap * 0.09,
    statusMaterial(stemStatus), [xFront + t / 2, hz + hp / 2, 0]));
  glyphLabel(parts.status, 'STEM ' + stemStatus, xFront + t / 2, yTop + overlayGap, overlayZ,
    stemStatus === 'FAIL' ? '#a52822' : '#18714c');
  if (heel > 0.01) {
    const heelStatus = engineeringMember('heel').status;
    parts.status.add(box(heel, hz + overlayGap * 0.06, Lw + overlayGap * 0.08,
      statusMaterial(heelStatus), [xBack + heel / 2, hz / 2, 0]));
    glyphLabel(parts.status, 'HEEL ' + heelStatus, xBack + heel / 2, hz + overlayGap * 1.45, overlayZ,
      heelStatus === 'FAIL' ? '#a52822' : '#18714c');
  }
  if (toe > 0.01) {
    const toeStatus = engineeringMember('toe').status;
    parts.status.add(box(toe, hz + overlayGap * 0.06, Lw + overlayGap * 0.08,
      statusMaterial(toeStatus), [-B / 2 + toe / 2, hz / 2, 0]));
    glyphLabel(parts.status, 'TOE ' + toeStatus, -B / 2 + toe / 2, hz + overlayGap * 1.45, overlayZ,
      toeStatus === 'HOLD' ? '#8a5e0a' : toeStatus === 'FAIL' ? '#a52822' : '#18714c');
  }
  if (engineering.baseStatus === 'FAIL') {
    parts.status.add(box(B + overlayGap * 0.08, hz + overlayGap * 0.11, Lw + overlayGap * 0.12,
      solid(PALETTE.fail, 0.08), [0, hz / 2, 0]));
    glyphLabel(parts.status, 'BASE / STABILITY FAIL', 0, -overlayGap * 1.25, overlayZ, '#a52822');
  }

  /* Selected reinforcement axes: engineering illustration, not cut/bend geometry. */
  const layout=buildDesignRebarLayout(r);
  const quantityProjection=requireRebarProjection(r,snap.quantityProjection);
  const barMatMain=solid(PALETTE.rebarMain),barMatSec=solid(PALETTE.rebarSec);
  const rebarRuns={},renderedMarks=new Set(),projectionHolds=[];
  let barCount=0;
  const totalPaths=layout.groups.reduce((n,g)=>n+g.paths.length,0);
  const stride=Math.max(1,Math.ceil(totalPaths/1600));
  for(const [index,run] of layout.groups.entries()){
    for(let j=0;j<run.paths.length;j+=stride){
      const points=run.paths[j];
      if(points.some(p=>p.some(x=>!Number.isFinite(x))))throw new TypeError('model3d: invalid design reinforcement axis');
      const curve=new THREE.CurvePath();
      const pts=points.map(([x,y,z])=>new THREE.Vector3(x-B/2,y,z-Lw/2));
      for(let k=1;k<pts.length;k++)curve.add(new THREE.LineCurve3(pts[k-1],pts[k]));
      parts.rebar.add(new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(2,pts.length*3),run.db/2000,6,false),
        ['①','①a','③','④','⑤','⑥'].includes(run.mark)?barMatMain:barMatSec));
      barCount++;
    }
    renderedMarks.add(run.mark);
    rebarRuns[run.mark+'-'+index]=Object.freeze({source:run.source,mark:run.mark,sizeMm:run.db,
      actualSpacingMm:run.spacing,drawnSpacingM:run.spacing==null?null:run.spacing*stride/1000,
      orientation:run.face,designAxisCount:run.paths.length,purpose:layout.purpose,
      fabricationAuthority:false,layoutSchema:layout.schema});
  }
  const omittedMarks=Object.freeze([]);

  /* ── ระยะ · ค่าระดับ · ขนาด — ทุกตัวเลขมาจากชุดผล ไม่คิดเอง ──
     อ้างระดับเดียวกับรูปตัด RW-01: ±0.000 ที่ท้องฐาน · +hz ผิวบนฐาน · +hz+hp ยอดพนัง
     ป้ายข้อความใช้ canvas texture จึงมีเฉพาะฝั่งเบราว์เซอร์ — ใน node (ทดสอบ fake) วาดเฉพาะเส้น */
  {
    const dark = Number.isFinite(opt.background) && opt.background < 0x808080;
    const dimColor = dark ? 0x9fb3d1 : 0x3f4c5e;
    const lineMat = new THREE.LineBasicMaterial({ color: dimColor });
    const xChainDims = new THREE.Group();
    const heightDims = new THREE.Group();
    const baseDims = new THREE.Group();
    const lengthDims = new THREE.Group();
    xChainDims.name = 'x-chain-dims';
    heightDims.name = 'height-dims';
    baseDims.name = 'base-dims';
    lengthDims.name = 'length-dims';
    parts.dims.add(xChainDims, heightDims, baseDims, lengthDims);
    const seg = (a, b, parent = xChainDims) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2])]);
      parent.add(new THREE.Line(g, lineMat));
    };
    const canLabel = !!(THREE.Sprite && THREE.CanvasTexture && typeof document !== 'undefined');
    const H = hz + hp;
    /* ความยาวกำแพงไม่ควรทำให้ตัวหนังสือโตกว่าช่วง toe/ความหนาฐานจนทับกัน */
    const label = (txt, x, y, z, parent = xChainDims) => {
      if (!canLabel) return;
      const labelH = parent === xChainDims || parent === heightDims
        ? Math.max(0.20, Math.min(0.30, Math.max(B, H) * 0.052))
        : Math.max(0.34, Math.min(0.48, Lw * 0.045));
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
      parent.add(sp);
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
    seg([xs[0], yD2, zF], [xs[3], yD2, zF], baseDims);
    seg([xs[0], yD2 - tick / 2, zF], [xs[0], yD2 + tick / 2, zF], baseDims);
    seg([xs[3], yD2 - tick / 2, zF], [xs[3], yD2 + tick / 2, zF], baseDims);
    label('B = ' + fmt2(B) + ' ม.', 0, yD2 - tick * 1.6, zF, baseDims);

    /* ความสูง: hz และ hp ที่ขอบหน้าซ้าย */
    const xL = -B / 2 - tick * 2.2;
    seg([xL, 0, zF], [xL, H, zF], heightDims);
    for (const y of [0, hz, H]) seg([xL - tick / 2, y, zF], [xL + tick / 2, y, zF], heightDims);
    label(fmt2(hz), xL - tick * 1.2, hz / 2, zF, heightDims);
    label(fmt2(hp), xL - tick * 1.2, hz + hp / 2, zF, heightDims);

    /* ความยาวกำแพง Lw ตามแนว z ที่ขอบ toe */
    const xF2 = -B / 2 - tick * 0.6;
    seg([xF2, yD, -Lw / 2], [xF2, yD, Lw / 2], lengthDims);
    seg([xF2, yD - tick / 2, -Lw / 2], [xF2, yD + tick / 2, -Lw / 2], lengthDims);
    seg([xF2, yD - tick / 2, Lw / 2], [xF2, yD + tick / 2, Lw / 2], lengthDims);
    label('Lw = ' + fmt2(Lw) + ' ม.', xF2 - tick, yD + tick * 1.6, 0, lengthDims);

    /* ค่าระดับ — ธงสามระดับตรงมุมหลัง อ้างท้องฐาน = ±0.000 เหมือนแบบ 2D */
    const xR = B / 2 + tick * 2.6;
    for (const [y, txt] of [[0, lv(0)], [hz, lv(hz)], [H, lv(H)]]) {
      seg([B / 2, y, zF], [xR, y, zF], heightDims);
      /* sprite ถูกวางที่ "กึ่งกลาง" — ดันศูนย์กลางออกไปอีก ไม่งั้นครึ่งซ้ายจะทับป้าย heel */
      label(txt, xR + tick * 2.1, y + tick * 0.7, zF, heightDims);
    }

    /* กำแพงมีครีบ — บอกระยะครีบตามสมมติฐาน engine เดียวกับผัง RW-02 */
    if (r.mode === 'but') {
      label('ครีบ ' + r.qty.nBut + ' ตัว @' + fmt2(r.Lt) + ' ม.',
        xBack + r.cfLr / 2, hz + r.cfHr + tick * 1.6, 0, heightDims);
    }

    /* ผนังสอบต้องเปิดเผยความหนายอดจาก Snapshot; ไม่อนุมานจากความหนาโคน */
    if (!close(tTop, t, 1e-9)) {
      const xT0 = xFront;
      const xT1 = xFront + tTop;
      const yTT = H + tick * 1.4;
      seg([xT0, yTT, zF], [xT1, yTT, zF], heightDims);
      seg([xT0, yTT - tick / 2, zF], [xT0, yTT + tick / 2, zF], heightDims);
      seg([xT1, yTT - tick / 2, zF], [xT1, yTT + tick / 2, zF], heightDims);
      label('tTop = ' + fmt2(tTop) + ' ม.', (xT0 + xT1) / 2, yTT + tick, zF, heightDims);
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
    setUnitMode(mode){displayUnits=resultUnits(mode==='kgf'?'kgf':'si');quantityLabels.forEach(paint=>paint());},
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
      engineering,
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
import {mountSceneAppearance} from './sceneAppearance.mjs?rwv=20261004-material-realism-1';
import {mountSceneInteraction,mountCameraTransition,mountCameraRenderSignal} from './sceneInteraction.mjs?rwv=20261004-material-realism-1';
export function mountWall3D(THREE, OrbitControls, canvas, snap, opt = {}) {
  const built = buildWall3D(THREE, snap, opt);
  const { B, hz, hp, Lw } = built.meta.bounds;
  const stress=mountStressOverlay(THREE,built.group,snap,{xShift:-B/2,yShift:hz});
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
  const layerState = {
    concrete: true, soil: true, rebar: false, loads: false, diagrams: false,
    status: false, dims: true, grid: true,
  };

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500);
  /* preserveDrawingBuffer ให้ภาพค้างอยู่ในบัฟเฟอร์หลังวาดเสร็จ
     จำเป็นสำหรับการบันทึกภาพและการจับภาพหน้าจอ — ค่าปริยายของ three คือลบทิ้งทันที */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;

  const appearance=mountSceneAppearance(THREE,scene,renderer,{dark});
  let memberIndex=0;
  built.parts.concrete.children.forEach(obj=>{if(obj.isMesh){appearance.dress(obj,memberIndex===0?'base':memberIndex===1?'wall':obj.geometry.type==='BoxGeometry'?'key':'rib');memberIndex++;}});
  built.parts.soil.traverse(obj=>{if(obj.isMesh&&obj.material?.color?.getHex()!==PALETTE.water)appearance.dress(obj,'soil');});
  built.parts.rebar.traverse(obj=>{if(obj.isMesh)appearance.dress(obj,'rebar');});
  const physicalBounds=new THREE.Box3().setFromObject(built.parts.concrete);physicalBounds.union(new THREE.Box3().setFromObject(built.parts.soil));appearance.update(physicalBounds);
  const controls = new OrbitControls(camera, renderer.domElement);
  const motion=window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  let reducedMotion = !!motion?.matches;
  const onMotion=()=>{reducedMotion=!!motion?.matches;controls.enableDamping=!reducedMotion;};
  motion?.addEventListener?.('change',onMotion);
  controls.enableDamping = !reducedMotion;
  controls.dampingFactor = 0.12;
  controls.target.set(0, (hz + hp) / 2.2, 0);

  controls.minDistance=Math.max(.4,modelR*.12);controls.maxDistance=modelR*6;
  const zoom=mountSmoothZoom(camera,controls,renderer.domElement);

  let dirty=true;const invalidate=()=>{dirty=true;};const cameraSignal=mountCameraRenderSignal(camera,controls,invalidate);
  const cameraMotion=mountCameraTransition(camera,controls,canvas,{invalidate});
  const interaction=mountSceneInteraction(THREE,{canvas,scene,camera,controls,renderer,appearance,model:built.group,zoom,invalidate,transition:cameraMotion});
  const resizeNow = () => {
    const w = Math.max(canvas.clientWidth || 0, 320);
    const h = Math.max(canvas.clientHeight || 0, 240);
    cameraMotion.cancel();renderer.setSize(w, h, false);invalidate();
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
    built.parts.dims.visible = dimensionsRequested;
    /* เส้นระดับและความสูงจะยุบเป็นจุดเดียวในมุมบน ส่วนมิติยาวจะยุบในมุมปลาย
       แยกชั้นตามการฉายจริงเพื่อให้ป้ายที่เหลืออ่านได้โดยไม่เปลี่ยน geometry */
    for (const layer of built.parts.dims.children) {
      if (layer.name === 'x-chain-dims') layer.visible = activeView !== 'elevation';
      else if (layer.name === 'height-dims') layer.visible = activeView !== 'top';
      else if (layer.name === 'base-dims') {
        layer.visible = activeView !== 'elevation';
        layer.position.z = activeView === 'top' ? Math.max(0.5, B * 0.2) : 0;
        /* ฉากหยุด matrixAutoUpdate เพื่อประหยัด GPU — ขยับป้ายแล้วต้องอัปเดตเอง */
        layer.updateMatrix();
        layer.updateMatrixWorld(true);
      } else if (layer.name === 'length-dims') layer.visible = activeView !== 'end';
    }
    /* ป้าย PASS/FAIL/HOLD อ้างตำแหน่งหน้าตัดเดียวกัน เมื่อมองตามแนวบน/ด้านข้าง
       จะทับกันทั้งหมด; แผงตรวจขวายังแสดงค่าและสถานะจาก Snapshot ครบ */
    built.parts.status.visible = !!layerState.status && activeView !== 'top' && activeView !== 'elevation';
  };
  const setViewNow = (name = 'iso') => {
    const requested = name === 'front' ? 'end' : name;
    const view = ['iso', 'end', 'elevation', 'top'].includes(requested) ? requested : 'iso';
    const distance = modelR * 1.85;
    controls.target.set(0, (hz + hp) / 2.2, 0);
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
    zoom.cancel();
    const bounds=new THREE.Box3().setFromObject(built.parts.concrete);
    bounds.union(new THREE.Box3().setFromObject(built.parts.soil));
    fitCameraToBounds(THREE,camera,controls,bounds);
    activeView = view;
    presetFrames.set(view, Object.freeze({
      direction: new THREE.Vector3().copy(camera.position).sub(controls.target).normalize(),
      up: new THREE.Vector3().copy(camera.up).normalize(),
    }));
    settingPreset = false;
    syncDimensionVisibility();
    invalidate();
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

  const fitViewNow = () => {
    resizeNow();zoom.cancel();
    const bounds=new THREE.Box3().setFromObject(built.parts.concrete);
    bounds.union(new THREE.Box3().setFromObject(built.parts.soil));
    fitCameraToBounds(THREE,camera,controls,bounds);
    invalidate();
  };
  const fitNow = () => {
    /* ★ ตอนเพิ่งเปิดกล่อง canvas อาจยังกว้างศูนย์ ถ้าปล่อยผ่าน aspect จะกลายเป็น NaN
       แล้วเมทริกซ์ฉายพังทั้งฉาก จอจะว่างเปล่าโดยไม่มี error ให้เห็น */
    resizeNow();
    controls.target.set(0, (hz + hp) / 2.2, 0);
    setViewNow('iso');
  };
  fitNow();
  controls.addEventListener('change', onControlsChange);
  const setView = (name = 'iso') => {let view;cameraMotion.run(()=>{view=setViewNow(name);});return view;};
  const fitView=()=>cameraMotion.run(fitViewNow);
  const fit=()=>cameraMotion.run(fitNow);
  const keys=mountCameraKeys(canvas,controls,zoom,{fit:fitView,reset:fit});

  /* Display mode เปิดเฉพาะ projection ที่มีอยู่ใน Snapshot; ไม่มีโหมดใดสร้างแรง
     หรือคำตัดสินใหม่. ชั้นเหล็กยังคงถูกปิดจนกว่า placement contract จะอนุมัติ. */
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
    const allowed = ['overview', 'loads', 'diagrams', 'checks'];
    const mode = allowed.includes(name)
      ? name : (name === 'rebar' && SHOW_DESIGN_REBAR ? 'rebar' : 'overview');
    restoreMaterials(concreteMaterials);
    restoreMaterials(soilMaterials);
    appearance.setInspection(mode !== 'overview');
    built.parts.loads.visible = mode === 'loads';
    built.parts.diagrams.visible = mode === 'diagrams';
    built.parts.status.visible = mode === 'checks';
    built.parts.rebar.visible = mode === 'rebar';
    stress.setRebar(built.parts.rebar.visible);
    layerState.rebar = built.parts.rebar.visible;
    layerState.loads = built.parts.loads.visible;
    layerState.diagrams = built.parts.diagrams.visible;
    layerState.status = built.parts.status.visible;
    syncDimensionVisibility();
    if (mode === 'rebar') {
      fadeMaterials(concreteMaterials, 0.22);
      fadeMaterials(soilMaterials, 0.18);
    } else if (mode === 'loads') {
      fadeMaterials(concreteMaterials, 0.72);
      fadeMaterials(soilMaterials, 0.32);
    } else if (mode === 'diagrams') {
      fadeMaterials(concreteMaterials, 0.38);
      fadeMaterials(soilMaterials, 0.12);
    } else if (mode === 'checks') {
      fadeMaterials(concreteMaterials, 0.48);
      fadeMaterials(soilMaterials, 0.15);
    }
    activeDisplayMode = mode;interaction.update();appearance.invalidate();invalidate();
    renderer.render(scene, camera);
    return activeDisplayMode;
  };

  /* โมเดลนิ่งสนิท — ปิดการคำนวณเมทริกซ์ซ้ำทุกเฟรมของออบเจกต์นับร้อยชิ้น */
  built.group.updateMatrixWorld(true);
  built.group.traverse((o) => { o.matrixAutoUpdate = false; });

  let alive = true;
  let disposed = false;
  let animationFrameId = null;
  const tick = (time) => {
    if (!alive) return;
    animationFrameId = window.requestAnimationFrame(tick);
    /* กล่อง 3D ถูกปิดแต่ viewer ยังอยู่ — หยุดเผา GPU เงียบ ๆ จนกว่าจะเปิดใหม่ */
    if (window.frameElement?.hidden||document.visibilityState==='hidden'||canvas.offsetParent === null) return;
    const moving=cameraMotion.update(time),zooming=zoom.update(time),changed=controls.update();interaction.update();
    if(dirty||moving||zooming){renderer.render(scene,camera);dirty=false;}
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
    const modeLabels = {
      overview: 'OVERVIEW', loads: 'ACTIONS', diagrams: 'SFD / BMD', checks: 'CHECK STATUS', rebar: 'REBAR',
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
    ctx.fillText('RW-3D · 3D ENGINEERING VIEWER · '
      + (modeLabels[activeDisplayMode] || activeDisplayMode.toUpperCase())
      + ' · ' + viewLabels[activeView], pad, Math.round(22 * scale), width - pad * 2);

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
        + ' · soil ' + (layerState.soil ? 'ON' : 'OFF') + ' · rebar '+(layerState.rebar?'ON':'OFF')
        + ' · actions ' + (layerState.loads ? 'ON' : 'OFF')
        + ' · SFD/BMD ' + (layerState.diagrams ? 'ON' : 'OFF')
        + ' · checks ' + (layerState.status ? 'ON' : 'OFF')
        + ' · dimensions ' + (built.parts.dims.visible ? 'ON' : 'OFF') + ' · grid ' + (layerState.grid ? 'ON' : 'OFF'),
      'Omitted marks: ' + omitted,
      'Projection issues: ' + holds,
      'Rebar basis: ' + rebarGeometryHold.label,
    ];
    const footerHeight = pad * 2 + line * footerLines.length;
    const footerY = Math.max(Math.round(48 * scale), height - footerHeight);
    ctx.fillStyle = 'rgba(4, 21, 46, 0.92)';
    ctx.fillRect(0, footerY, width, height - footerY);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    footerLines.forEach((text, index) => {
      const highlighted = text.startsWith('Authority:') || text.startsWith('Engine verdict:')
        || text.startsWith('Projection issues:') || text.startsWith('Rebar basis:');
      ctx.font = `${highlighted ? 800 : 650} ${index === 1 ? small : normal}px Prompt, Sarabun, sans-serif`;
      ctx.fillStyle = highlighted ? '#ffb36b' : '#edf4ff';
      ctx.fillText(text, pad, footerY + pad + index * line, width - pad * 2);
    });
    return output.toDataURL('image/png');
  };

  return {
    setContour(visible){stress.setVisible(visible);renderer.render(scene,camera);},
    setUnitMode(mode){built.setUnitMode(mode);renderer.render(scene,camera);},
    get meta() { return {...built.meta,
      visibleMarks:built.parts.rebar.visible?built.meta.geometryMarks:[],
      representedMarks:built.parts.rebar.visible?built.meta.geometryMarks:[]}; },
    fit,
    fitView,
    zoomBy:factor=>zoom.by(factor),
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
        appearance.setInspection(visible || activeDisplayMode !== 'overview');
        stress.setRebar(visible);
        layerState.rebar = !!visible;
        if (g) g.visible = !!visible;
      } else if (g) {
        layerState[name] = !!visible;
        g.visible = !!visible;
        if (name === 'status') syncDimensionVisibility();
      }
      renderer.render(scene, camera);
    },
    setGrid(visible) {
      layerState.grid = !!visible;
      grid.visible = !!visible;invalidate();
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
      stress.dispose();interaction.dispose();cameraMotion.dispose();appearance.dispose();cameraSignal.dispose();
      disposed = true;
      alive = false;
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      window.removeEventListener('resize', queueResize);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (resizeObserver) resizeObserver.disconnect();
      keys.dispose();
      motion?.removeEventListener?.('change',onMotion);
      zoom.dispose();
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
