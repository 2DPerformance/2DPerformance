var __typeError = (msg) => {
  throw TypeError(msg);
};
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _OverhangView_instances, bind_fn, project_fn, ground_fn;
import "./modulepreload-polyfill-DaKOjhqt.js";
const deepFreeze = (value) => {
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) deepFreeze(value[key]);
    Object.freeze(value);
  }
  return value;
};
const SOURCE = "DOH Standard Drawing 2025 · RS-501/502/503/504 (OCT 2024)";
const AUTHORITY = "ถอดจากแบบมาตรฐาน · ไม่ได้ตรวจกำลัง · NOT FOR CONSTRUCTION";
const COMMON = deepFreeze({
  clearance_min: 5.5,
  // road surface to sign bottom
  pedestalAboveRoad: 0.1,
  // pedestal top above the highest level of travelled way
  signToEdgeFromPoleCL_min: 0.75,
  armToSignFarEdge_max: 4.25,
  // pole CL to far edge of sign
  armTipInsideSignEdge: 0.15,
  armFromSignEdge: 0.35,
  // arm CL from sign top / bottom edge
  poleTopAboveUpperArm: 0.35,
  signTilt_deg: 2.5,
  signPlate_mm: 3,
  embedSpread_min: 1,
  lateralClear_sideSlope_min: 0.6,
  lateralClear_curb_min: 1.2,
  basePlate: { t_mm: 28, edge: 0.07, holes: 8, hole_mm: 41, cableHole_mm: 50, ribs: 8, rib_t_mm: 12, rib_h: 0.25, rib_w: 0.14 },
  topPlate_t_mm: 4.5,
  flange: { t_mm: 20, gap_mm: 20, bolts: 8, bolt: "M20", rib_t_mm: 9 },
  handhole: { z: 1, w: 0.15, h: 0.2, cover: [0.2, 0.31] },
  stiffener: "2L-75x75x6 mm welded back to back",
  stiffener_mm: [150, 75],
  // two L75 back to back, overall 150 x 75
  anchor: { count: 8, size: "M36", d_mm: 36, grade: "ASTM A307", projection: 0.12 },
  anchorFrame: { member: "L-90x6", leg: 0.09, frames: 2, weld_mm: 3 },
  // outer size = base plate B; depth not dimensioned
  cover: 0.075,
  materials: {
    pipe: "JIS G3444 STK400",
    section: "TIS 1227 SM400",
    galvanizing: "≥ 550 g/m²",
    bolts: "TIS 291 / ASTM A325",
    concrete: "f'c 30 MPa (cube 15 cm, 28 d)",
    deformed: "SD40",
    round: "SR24",
    lean: "1:3:6, 0.10 m",
    sand: "compacted sand 0.05 m",
    piles: "RC/PC square, TIS 395/396, dowel 4-DB25, SF 2.0"
  }
});
const POLE_TYPES = deepFreeze({
  I: {
    dwg: "RS-501",
    label: "Type I",
    sides: 1,
    area_max_m2: 5.28,
    L_max: 3.5,
    W_max: 2.2,
    L_min: 0,
    W_min: 0,
    pole: { D_mm: 267.4, t_mm: 6 },
    arm: { D_mm: 139.8, t_mm: 4.5 },
    carrier: { D_mm: 101.6, t_mm: 3.2 },
    bracket: "C-125x65x6",
    jointOffset: 0.3,
    flange: { D: 0.3, pcd: 0.22 },
    topPlate_D: 0.3,
    basePlate: { B: 0.58, pitch: 0.22 },
    stiffenerFromEnd: (L) => L <= 2.4 ? [0.5, 0.5] : [0.75, 0.75],
    foundations: { pile: "A", spread: "B" }
  },
  II: {
    dwg: "RS-502",
    label: "Type II",
    sides: 1,
    area_max_m2: 10.8,
    L_max: 3.5,
    W_max: 3.3,
    L_min: 2.5,
    W_min: 2.2,
    pole: { D_mm: 318.5, t_mm: 6 },
    arm: { D_mm: 165.2, t_mm: 5 },
    carrier: { D_mm: 139.8, t_mm: 4.5 },
    bracket: "C-150x75x6.5",
    jointOffset: 0.35,
    flange: { D: 0.325, pcd: 0.24 },
    topPlate_D: 0.34,
    basePlate: { B: 0.62, pitch: 0.24 },
    stiffenerFromEnd: () => [0.7, 0.7],
    // 0.55 to the arm tip + 0.15 tip set-back
    foundations: { pile: "C", spread: "D" }
  },
  III: {
    dwg: "RS-503",
    label: "Type III",
    sides: 2,
    area_max_m2: 5.28,
    area_total_max_m2: 10.56,
    L_max: 3.5,
    W_max: 2.2,
    L_min: 0,
    W_min: 0,
    pole: { D_mm: 406.4, t_mm: 12 },
    arm: { D_mm: 139.8, t_mm: 4.5 },
    carrier: { D_mm: 101.6, t_mm: 3.2 },
    bracket: "C-125x65x6",
    jointOffset: 0.4,
    flange: { D: 0.44, pcd: 0.29 },
    topPlate_D: 0.44,
    // joint detail 0.40 (elevation prints 0.30)
    basePlate: { B: 0.7, pitch: 0.28 },
    stiffenerFromEnd: (L) => L <= 2.4 ? [0.5, 0.5] : [0.75, 0.75],
    foundations: { pile: "C", spread: "D" }
  }
});
const FOUNDATIONS = deepFreeze({
  A: {
    kind: "pile",
    dwg: "RS-504",
    block: { L: 1.6, B: 0.8, H: 0.5 },
    pedestal: { B: 0.8, H_max: 2, chamfer: 0.1 },
    piles: { count: 2, size: 0.18, spacing: 0.8, edge: 0.4, capacity_t_min: 8 },
    bars: { pedestal: [12, 25], stirrup: [9, 0.15], a: [4, 16], b: [2, 12], bottom: [5, 16] }
  },
  B: {
    kind: "spread",
    dwg: "RS-504",
    block: { L: 2.5, B: 1.3, H: 1 },
    pedestal: { B: 0.8, H_max: 2, chamfer: 0.1 },
    bars: { pedestal: [12, 25], stirrup: [9, 0.15], a: [4, 20], b: [2, 12], bottom: [8, 20] }
  },
  C: {
    kind: "pile",
    dwg: "RS-504",
    block: { L: 2, B: 0.9, H: 1 },
    pedestal: { B: 0.9, H_max: 2, chamfer: 0.1 },
    piles: { count: 2, size: 0.22, spacing: 1.2, edge: 0.4, capacity_t_min: 14 },
    bars: { pedestal: [12, 25], stirrup: [9, 0.15], a: [4, 16], b: [2, 12], bottom: [5, 20] }
  },
  D: {
    kind: "spread",
    dwg: "RS-504",
    block: { L: 3, B: 1.5, H: 1 },
    pedestal: { B: 0.9, H_max: 2, chamfer: 0.1 },
    bars: { pedestal: [12, 25], stirrup: [9, 0.15], a: [4, 20], b: [2, 12], bottom: [10, 20] }
  }
});
const SPREAD_ONLY_IF_QA_GT = 100;
const OPEN_ITEMS = deepFreeze([
  { id: "V2", text: "ตอม่อฐาน D พิมพ์ 2.00 (MIN.) ขณะที่ A/B/C พิมพ์ (MAX.) — ใช้เป็นค่าสูงสุดไปก่อน" },
  { id: "V7", text: "RS-503 รูปด้านบอกหน้าแปลนห่าง CL เสา 0.30 แต่ joint detail บอก 0.40 — ใช้ 0.40" },
  { id: "V8", text: "ความยาวสลักยึด ระดับกรอบ L-90x6 และระยะงอเหล็กไม่ได้ระบุในแบบ — วาดเป็นแผนภาพ" },
  { id: "V9", text: "ขนาดขา L-90x6 ในกรอบอ่านได้ 0.09 (แนวนอน) / 0.08 (แนวตั้ง)" }
]);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const P = (x, y, z) => [r4(x), r4(y), r4(z)];
const spread = (n, lo, hi) => n === 1 ? [(lo + hi) / 2] : Array.from({ length: n }, (_, i) => lo + (hi - lo) * i / (n - 1));
const loopXY = (h, z) => [P(-h, -h, z), P(h, -h, z), P(h, h, z), P(-h, h, z), P(-h, -h, z)];
function buildRebar(id, f, lv) {
  const c = COMMON.cover, tie = f.bars.stirrup[0] / 1e3, sTie = f.bars.stirrup[1];
  const pb = f.pedestal.B / 2, { L, B } = f.block, groups = [];
  const db = (mm) => mm / 1e3;
  const hTie = pb - c - tie / 2, pedTies = [];
  for (let z = lv.zTop - f.pedestal.chamfer - 0.05; z > lv.zBlockTop + 0.02; z -= sTie) pedTies.push(loopXY(hTie, z));
  groups.push({ mark: "S1", role: "pedestalTie", dia_mm: f.bars.stirrup[0], grade: "SR24", spacing: sTie, shape: "closed tie", bars: pedTies });
  const [nP, dP] = f.bars.pedestal, a = pb - c - tie - db(dP) / 2, zBend = lv.zBlockBottom + c + tie + db(f.bars.bottom[1]) + db(dP) / 2;
  const ring = [];
  for (const u of [-a, -a / 3, a / 3]) ring.push([u, -a], [a, u], [-u, a], [-a, -u]);
  const bend = 12 * db(dP), vert = ring.slice(0, nP).map(([x, y]) => {
    const onX = Math.abs(x) >= Math.abs(y), sx = Math.sign(x) || 1, sy = Math.sign(y) || 1;
    const end = onX ? P(x - sx * bend, y, zBend) : P(x, y - sy * bend, zBend);
    return [P(x, y, lv.zTop - f.pedestal.chamfer - 0.025), P(x, y, zBend), end];
  });
  groups.push({ mark: "P1", role: "pedestalVertical", dia_mm: dP, grade: "SD40", shape: "L (bend 12db, schematic)", bars: vert });
  const yEnd = L / 2 - c - tie, xIn = B / 2 - c - tie;
  const along = (n, dmm, z, xs) => xs.map((x) => [P(x, -yEnd, z), P(x, yEnd, z)]);
  const [nBot, dBot] = f.bars.bottom, [nTop, dTop] = f.bars.a, [nSide, dSide] = f.bars.b;
  const zBot = lv.zBlockBottom + c + tie + db(dBot) / 2, zTopBar = lv.zBlockTop - c - tie - db(dTop) / 2;
  groups.push({
    mark: "F1",
    role: "bottomLong",
    dia_mm: dBot,
    grade: "SD40",
    shape: "straight",
    bars: along(nBot, dBot, zBot, spread(nBot, -xIn + db(dBot) / 2, xIn - db(dBot) / 2))
  });
  groups.push({
    mark: "F2",
    role: "topLong",
    dia_mm: dTop,
    grade: "SD40",
    shape: "straight",
    bars: along(nTop, dTop, zTopBar, spread(nTop, -xIn + db(dTop) / 2, xIn - db(dTop) / 2))
  });
  const zMid = (lv.zBlockTop + lv.zBlockBottom) / 2, sideX = xIn - db(dSide) / 2;
  groups.push({
    mark: "F3",
    role: "sideLong",
    dia_mm: dSide,
    grade: "SD40",
    shape: "straight",
    bars: along(nSide, dSide, zMid, nSide === 2 ? [-sideX, sideX] : spread(nSide, -sideX, sideX))
  });
  const blockTies = [], hx = B / 2 - c - tie / 2, zl = lv.zBlockBottom + c + tie / 2, zh = lv.zBlockTop - c - tie / 2;
  for (let y = -yEnd; y <= yEnd + 1e-9; y += sTie) blockTies.push([P(-hx, y, zl), P(hx, y, zl), P(hx, y, zh), P(-hx, y, zh), P(-hx, y, zl)]);
  groups.push({ mark: "S2", role: "blockTie", dia_mm: f.bars.stirrup[0], grade: "SR24", spacing: sTie, shape: "closed tie", bars: blockTies });
  const standardCount = { P1: nP, F1: nBot, F2: nTop, F3: nSide };
  const counts = Object.fromEntries(groups.map((g) => [g.mark, g.bars.length]));
  const mismatch = Object.entries(standardCount).filter(([k, n]) => counts[k] !== n).map(([k]) => k);
  return {
    foundation: id,
    cover: c,
    groups,
    counts,
    standardCount,
    consistent: mismatch.length === 0,
    mismatch,
    note: "จำนวน/ขนาดตาม RS-504; ระยะงอและระยะฝังเหล็กไม่ได้ระบุในแบบ วาดเป็นแผนภาพ"
  };
}
const r3 = (v) => Math.round(v * 1e3) / 1e3;
const num = (v) => v === "" || v == null ? NaN : Number(v);
const DEFAULT_INPUT = Object.freeze({
  type: "I",
  signL: 3,
  signW: 1.7,
  signL2: 3,
  signOffset: 0.75,
  clearance: 5.5,
  pedestalH: 1.2,
  groundBelowRoad: 0,
  pilesDrivable: true,
  qa: "",
  foundation: "auto",
  pileLength: 6
});
function selectFoundation(type, { pilesDrivable = true, qa = "", foundation = "auto" } = {}) {
  const pole = POLE_TYPES[type];
  if (!pole) return { id: null, auto: false, reason: "ไม่รู้จักชนิดเสา" };
  const { pile, spread: spread2 } = pole.foundations, q = num(qa);
  if (foundation && foundation !== "auto") {
    if (foundation !== pile && foundation !== spread2)
      return { id: null, auto: false, reason: `${pole.label} ใช้ได้เฉพาะฐาน ${pile} หรือ ${spread2}` };
    if (foundation === spread2 && !(q > SPREAD_ONLY_IF_QA_GT))
      return { id: null, auto: false, reason: `ฐานแผ่ ${spread2} ใช้ได้เมื่อ qa > ${SPREAD_ONLY_IF_QA_GT} kN/m² (RS-504)` };
    return { id: foundation, auto: false, reason: "ผู้ใช้เลือกเอง (ไม่ใช่ค่าเริ่ม)" };
  }
  if (q > SPREAD_ONLY_IF_QA_GT) return { id: spread2, auto: true, reason: `qa ${q} > ${SPREAD_ONLY_IF_QA_GT} kN/m² → ฐานแผ่ ${spread2}` };
  if (pilesDrivable) return { id: pile, auto: true, reason: `ตอกเข็มได้ → ฐานเข็ม ${pile}` };
  if (!Number.isFinite(q)) return { id: null, auto: true, reason: "ตอกเข็มไม่ได้ และยังไม่ทราบ qa → กรอก qa เพื่อพิจารณาฐานแผ่" };
  return { id: null, auto: true, reason: `ตอกเข็มไม่ได้ และ qa ไม่เกิน ${SPREAD_ONLY_IF_QA_GT} kN/m² → ไม่มีฐานในแบบมาตรฐาน ต้องออกแบบเฉพาะ` };
}
function validateInput(raw) {
  const input = { ...DEFAULT_INPUT, ...raw }, errors = [], warnings = [];
  const pole = POLE_TYPES[input.type];
  if (!pole) return { ok: false, errors: ["ไม่รู้จักชนิดเสา " + input.type], warnings, input };
  const L = num(input.signL), W = num(input.signW), L2 = pole.sides === 2 ? num(input.signL2) : null;
  const off = num(input.signOffset), clr = num(input.clearance), H = num(input.pedestalH);
  const sides = pole.sides === 2 ? [["ป้ายขวา", L], ["ป้ายซ้าย", L2]] : [["ป้าย", L]];
  if (!(W > 0)) errors.push("ต้องกรอกความสูงป้าย");
  for (const [name, len] of sides) {
    if (!(len > 0)) {
      errors.push(`ต้องกรอกความยาว${name}`);
      continue;
    }
    if (len > pole.L_max) errors.push(`${name}ยาว ${len} m เกิน ${pole.L_max} m (${pole.dwg})`);
    if (len < pole.L_min) errors.push(`${name}ยาว ${len} m น้อยกว่า ${pole.L_min} m ที่ ${pole.dwg} กำหนด`);
    const ends = pole.stiffenerFromEnd(len);
    if (len < ends[0] + ends[1] + 0.2) errors.push(`${name}สั้นเกินกว่าจะวางเหล็ก 2L ห่างปลาย ${ends.join("/")} m`);
    if (W > 0 && len * W > pole.area_max_m2 + 1e-9)
      errors.push(`${name} ${r3(len * W)} m² เกินพื้นที่ ${pole.area_max_m2} m² (${pole.dwg})`);
    if (off + len > COMMON.armToSignFarEdge_max + 1e-9)
      errors.push(`${name}: ระยะ CL เสาถึงปลายป้าย ${r3(off + len)} m เกิน ${COMMON.armToSignFarEdge_max} m`);
  }
  if (W > pole.W_max) errors.push(`ป้ายสูง ${W} m เกิน ${pole.W_max} m (${pole.dwg})`);
  if (W < pole.W_min) errors.push(`ป้ายสูง ${W} m น้อยกว่า ${pole.W_min} m ที่ ${pole.dwg} กำหนด`);
  if (W > 0 && W < 1) errors.push("ป้ายสูงน้อยกว่า 1.00 m: แขนสองเส้นห่างขอบ 0.35 m จะชิดกันเกินกว่าที่แบบแสดง");
  if (!(off >= COMMON.signToEdgeFromPoleCL_min)) errors.push(`ระยะ CL เสาถึงขอบป้ายต้องไม่น้อยกว่า ${COMMON.signToEdgeFromPoleCL_min} m`);
  if (!(clr >= COMMON.clearance_min)) errors.push(`ช่องลอดใต้ป้ายต้องไม่น้อยกว่า ${COMMON.clearance_min} m`);
  const fdn = selectFoundation(input.type, input);
  if (!fdn.id) errors.push(fdn.reason);
  else {
    const f = FOUNDATIONS[fdn.id];
    if (!(H > 0) || H > f.pedestal.H_max) errors.push(`ตอม่อสูง (ใต้ลบมุม) ${input.pedestalH} m ต้องมากกว่า 0 และไม่เกิน ${f.pedestal.H_max} m (RS-504)`);
    const g = num(input.groundBelowRoad) || 0, embed = H - g;
    if (g < 0) errors.push("ระดับดินที่เสาต้องไม่สูงกว่าผิวทาง (หัวตอม่อต้องสูงกว่าผิวทาง 0.10 m)");
    if (f.kind === "spread" && H > 0 && embed < COMMON.embedSpread_min - 1e-9)
      errors.push(`ฐานแผ่ต้องฝังในดินอย่างน้อย ${COMMON.embedSpread_min} m: ตอนนี้ ${r3(embed)} m (ตอม่อ ${r3(H)} − ดินต่ำกว่าผิวทาง ${r3(g)})`);
    if (f.kind === "pile" && !(num(input.pileLength) > 0)) errors.push("ต้องกรอกความยาวเข็ม");
    if (fdn.id === "D") warnings.push("V2: แบบ RS-504 พิมพ์ตอม่อฐาน D เป็น 2.00 (MIN.) — ใช้เป็นค่าสูงสุดตาม A/B/C ไปก่อน");
  }
  if (!fdn.auto && fdn.id) warnings.push("ฐานรากถูกเลือกเอง ไม่ใช่ค่าตามกติกา RS-504");
  return { ok: errors.length === 0, errors, warnings, input, foundation: fdn };
}
const hexBox = (x0, x1, y0, y1, z0, z1) => [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
const box = (id, role, mat, c, s) => ({ id, role, mat, shape: "hex", v: hexBox(c[0] - s[0] / 2, c[0] + s[0] / 2, c[1] - s[1] / 2, c[1] + s[1] / 2, c[2] - s[2] / 2, c[2] + s[2] / 2) });
const cyl = (id, role, mat, a, b, r, extra = {}) => ({ id, role, mat, shape: "cyl", a, b, r, ...extra });
function buildOverhangModel(raw) {
  const check = validateInput(raw);
  if (!check.ok) return { ok: false, errors: check.errors, warnings: check.warnings, authority: AUTHORITY };
  const input = check.input, pole = POLE_TYPES[input.type], fid = check.foundation.id, fdn = FOUNDATIONS[fid];
  const W = num(input.signW), off = num(input.signOffset), H = num(input.pedestalH);
  const parts = [];
  const bp = COMMON.basePlate, tBP = bp.t_mm / 1e3, R = pole.pole.D_mm / 2e3, Ra = pole.arm.D_mm / 2e3;
  const zRoad = -COMMON.pedestalAboveRoad, zb = zRoad + num(input.clearance), zt = zb + W;
  const zArms = [zt - COMMON.armFromSignEdge, zb + COMMON.armFromSignEdge];
  parts.push(box("BP", "basePlate", "steel", [0, 0, tBP / 2], [pole.basePlate.B, pole.basePlate.B, tBP]));
  parts.push(cyl("POLE", "pole", "steel", [0, 0, tBP], [0, 0, zt], R, { tube: pole.pole.t_mm / 1e3 }));
  parts.push(cyl("TOP", "topPlate", "steel", [0, 0, zt], [0, 0, zt + COMMON.topPlate_t_mm / 1e3], pole.topPlate_D / 2));
  const ribT = bp.rib_t_mm / 1e3, ribL = Math.min(bp.rib_w, pole.basePlate.B / 2 - R - 0.01);
  for (let i = 0; i < bp.ribs; i++) {
    const a = (i + 0.5) * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a), nx = -sa * ribT / 2, ny = ca * ribT / 2;
    const p = (r, z, s) => [ca * r + s * nx, sa * r + s * ny, z];
    parts.push({ id: "RIB" + (i + 1), role: "baseRib", mat: "steel", shape: "hex", v: [
      p(R, tBP, -1),
      p(R + ribL, tBP, -1),
      p(R + ribL, tBP, 1),
      p(R, tBP, 1),
      p(R, tBP + bp.rib_h, -1),
      p(R + 0.02, tBP + bp.rib_h, -1),
      p(R + 0.02, tBP + bp.rib_h, 1),
      p(R, tBP + bp.rib_h, 1)
    ] });
  }
  const hh = COMMON.handhole;
  parts.push(box("HH", "handhole", "cover", [-(R + 4e-3), 0, hh.z], [0.01, hh.cover[0], hh.cover[1]]));
  const sideList = pole.sides === 2 ? [[1, num(input.signL)], [-1, num(input.signL2)]] : [[1, num(input.signL)]];
  const tilt = Math.tan(COMMON.signTilt_deg * Math.PI / 180), ySign = -0.2;
  const ySignAt = (z) => ySign - (z - zArms[1]) * tilt;
  const stiffX = [], signs = [];
  for (const [dir, L] of sideList) {
    const tag = dir > 0 ? "R" : "L", j = pole.jointOffset, xTip = off + L - COMMON.armTipInsideSignEdge;
    zArms.forEach((z, k) => {
      const n = `${tag}${k + 1}`;
      parts.push(cyl("STUB" + n, "armStub", "steel", [dir * R * 0.9, 0, z], [dir * (j - 0.02), 0, z], Ra));
      parts.push(cyl("FL" + n + "a", "flange", "steel", [dir * (j - 0.02), 0, z], [dir * j, 0, z], pole.flange.D / 2));
      parts.push(cyl("FL" + n + "b", "flange", "steel", [dir * j, 0, z], [dir * (j + 0.02), 0, z], pole.flange.D / 2));
      parts.push(cyl("ARM" + n, "arm", "steel", [dir * (j + 0.02), 0, z], [dir * xTip, 0, z], Ra, { tube: pole.arm.t_mm / 1e3 }));
    });
    const [e1, e2] = pole.stiffenerFromEnd(L), xs = [off + e1, off + L - e2];
    const [sw, sd] = COMMON.stiffener_mm.map((v) => v / 1e3);
    xs.forEach((x, k) => {
      const X = dir * x, n = `${tag}${k + 1}`;
      stiffX.push(r3(X));
      parts.push(cyl("CAR" + n, "carrier", "steel", [X, 0, zArms[1] + Ra], [X, 0, zArms[0] - Ra], pole.carrier.D_mm / 2e3));
      const y0 = ySignAt(zb) + 4e-3, y1 = ySignAt(zt) + 4e-3;
      parts.push({ id: "2L" + n, role: "stiffener", mat: "steel", shape: "hex", v: [
        [X - sw / 2, y0, zb],
        [X + sw / 2, y0, zb],
        [X + sw / 2, y0 + sd, zb],
        [X - sw / 2, y0 + sd, zb],
        [X - sw / 2, y1, zt],
        [X + sw / 2, y1, zt],
        [X + sw / 2, y1 + sd, zt],
        [X - sw / 2, y1 + sd, zt]
      ] });
      zArms.forEach((z, m) => {
        const yA = ySignAt(z) + 4e-3 + sd, yB = -Ra;
        parts.push(box(`BR${n}${m + 1}`, "bracket", "steel", [X, (yA + yB) / 2, z], [0.065, Math.max(0.02, yB - yA), 0.125]));
      });
    });
    const x0 = dir * off, x1 = dir * (off + L);
    parts.push({
      id: "SIGN" + tag,
      role: "signPlate",
      mat: "sign",
      shape: "quad",
      v: [[x0, ySignAt(zb), zb], [x1, ySignAt(zb), zb], [x1, ySignAt(zt), zt], [x0, ySignAt(zt), zt]]
    });
    signs.push({ side: tag, L, W, area: r3(L * W), x0: r3(Math.min(x0, x1)), x1: r3(Math.max(x0, x1)), zb: r3(zb), zt: r3(zt) });
  }
  const pitch = pole.basePlate.pitch, anc = COMMON.anchor, zAncBot = -Math.max(0.3, H);
  const anchorXY = [[-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]].map(([a, b]) => [a * pitch, b * pitch]);
  anchorXY.forEach(([x, y], i) => parts.push(cyl("AB" + (i + 1), "anchorBolt", "bolt", [x, y, zAncBot], [x, y, anc.projection], anc.d_mm / 2e3)));
  const fr = COMMON.anchorFrame, hB = pole.basePlate.B / 2, leg = fr.leg;
  [-0.15, zAncBot + 0.1].forEach((z, k) => {
    parts.push(box(`AF${k + 1}S`, "anchorFrame", "steel", [0, -hB + leg / 2, z], [2 * hB, leg, 6e-3]));
    parts.push(box(`AF${k + 1}N`, "anchorFrame", "steel", [0, hB - leg / 2, z], [2 * hB, leg, 6e-3]));
    parts.push(box(`AF${k + 1}W`, "anchorFrame", "steel", [-hB + leg / 2, 0, z], [leg, 2 * hB - 2 * leg, 6e-3]));
    parts.push(box(`AF${k + 1}E`, "anchorFrame", "steel", [hB - leg / 2, 0, z], [leg, 2 * hB - 2 * leg, 6e-3]));
  });
  const pb = fdn.pedestal.B / 2, ch = fdn.pedestal.chamfer, Hp = H + ch;
  parts.push({ id: "PED", role: "pedestal", mat: "concrete", shape: "hex", v: hexBox(-pb, pb, -pb, pb, -Hp, -ch) });
  parts.push({ id: "PEDTOP", role: "pedestal", mat: "concrete", shape: "hex", v: [
    [-pb, -pb, -ch],
    [pb, -pb, -ch],
    [pb, pb, -ch],
    [-pb, pb, -ch],
    [-pb + ch, -pb + ch, 0],
    [pb - ch, -pb + ch, 0],
    [pb - ch, pb - ch, 0],
    [-pb + ch, pb - ch, 0]
  ] });
  const blk = fdn.block, zBt = -Hp, zBb = -Hp - blk.H;
  parts.push({
    id: "BLK",
    role: fdn.kind === "pile" ? "pileCap" : "footing",
    mat: "concrete",
    shape: "hex",
    v: hexBox(-blk.B / 2, blk.B / 2, -blk.L / 2, blk.L / 2, zBb, zBt)
  });
  parts.push({ id: "LEAN", role: "lean", mat: "lean", shape: "hex", v: hexBox(-blk.B / 2, blk.B / 2, -blk.L / 2, blk.L / 2, zBb - 0.1, zBb) });
  parts.push({ id: "SAND", role: "sand", mat: "sand", shape: "hex", v: hexBox(-blk.B / 2, blk.B / 2, -blk.L / 2, blk.L / 2, zBb - 0.15, zBb - 0.1) });
  if (fdn.kind === "pile") {
    const s = fdn.piles.size, Lp = num(input.pileLength);
    [-1, 1].forEach((k, i) => parts.push({
      id: "PILE" + (i + 1),
      role: "pile",
      mat: "pile",
      shape: "hex",
      v: hexBox(-s / 2, s / 2, k * fdn.piles.spacing / 2 - s / 2, k * fdn.piles.spacing / 2 + s / 2, zBb - Lp, zBb)
    }));
  }
  const rebar = buildRebar(fid, fdn, { zTop: 0, zBlockTop: zBt, zBlockBottom: zBb });
  const armLen = sideList.map(([, L]) => r3(off + L - COMMON.armTipInsideSignEdge - pole.jointOffset - 0.02));
  return {
    ok: true,
    standardMode: true,
    source: SOURCE,
    authority: AUTHORITY,
    canIssue: false,
    type: input.type,
    poleType: pole,
    foundationId: fid,
    foundation: check.foundation,
    input,
    warnings: check.warnings,
    openItems: OPEN_ITEMS,
    levels: { road: r3(zRoad), ground: r3(zRoad - (num(input.groundBelowRoad) || 0)), signBottom: r3(zb), signTop: r3(zt), arms: zArms.map(r3), poleTop: r3(zt), blockBottom: r3(zBb) },
    dims: {
      poleLength: r3(zt - tBP),
      armLength: armLen,
      signs,
      stiffenerX: stiffX,
      signArea: r3(signs.reduce((s, x) => s + x.area, 0)),
      pedestalH: H,
      pedestalTotal: r3(Hp),
      embed: r3(H - (num(input.groundBelowRoad) || 0)),
      anchorLength: r3(anc.projection - zAncBot)
    },
    parts,
    rebar
  };
}
const MAT = {
  steel: [150, 160, 170],
  bolt: [95, 102, 112],
  cover: [120, 128, 138],
  sign: [22, 110, 64],
  concrete: [200, 195, 185],
  lean: [170, 165, 155],
  sand: [214, 196, 150],
  pile: [182, 176, 166]
};
const REBAR = { P1: "#c2410c", S1: "#2563eb", F1: "#b91c1c", F2: "#7c3aed", F3: "#0f766e", S2: "#2563eb" };
const CONCRETE = /* @__PURE__ */ new Set(["concrete", "lean", "sand", "pile"]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(...a) || 1;
  return a.map((v) => v / l);
};
function cylFaces(p, seg = 20) {
  const axis = sub(p.b, p.a), n = norm(axis), ref = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(n, ref)), v = cross(n, u), ring = (c) => Array.from({ length: seg }, (_, i) => {
    const t = 2 * Math.PI * i / seg, cs = Math.cos(t) * p.r, sn = Math.sin(t) * p.r;
    return [c[0] + u[0] * cs + v[0] * sn, c[1] + u[1] * cs + v[1] * sn, c[2] + u[2] * cs + v[2] * sn];
  });
  const A = ring(p.a), B = ring(p.b), faces = [A.slice().reverse(), B];
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    faces.push([A[i], A[j], B[j], B[i]]);
  }
  return faces;
}
const HEX = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
const MAX_EDGE = 0.35;
const lerp = (u, v, t) => u.map((x, k) => x + (v[k] - x) * t);
function splitQuad(q) {
  if (q.length !== 4) return [q];
  const [a, b, c, d] = q, len = (u, v) => Math.hypot(...sub(u, v));
  const n = Math.max(1, Math.ceil(Math.max(len(a, b), len(d, c)) / MAX_EDGE)), m = Math.max(1, Math.ceil(Math.max(len(a, d), len(b, c)) / MAX_EDGE));
  if (n === 1 && m === 1) return [q];
  const at = (i, j) => lerp(lerp(a, b, i / n), lerp(d, c, i / n), j / m), out = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out.push([at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]);
  return out;
}
function partFaces(p) {
  const faces = p.shape === "cyl" ? cylFaces(p) : p.shape === "quad" ? [p.v] : HEX.map((f) => f.map((i) => p.v[i]));
  return faces.flatMap(splitQuad);
}
class OverhangView {
  constructor(canvas) {
    __privateAdd(this, _OverhangView_instances);
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.cam = { yaw: -0.9, pitch: 0.28, dist: 16, target: [1.2, 0, 2.5] };
    this.opts = { xray: false, rebar: false, sign: true };
    this.faces = [];
    this.lines = [];
    this.model = null;
    __privateMethod(this, _OverhangView_instances, bind_fn).call(this);
    new ResizeObserver(() => this.draw()).observe(canvas);
  }
  setModel(model) {
    this.model = model;
    this.faces = [];
    this.lines = [];
    if (!(model == null ? void 0 : model.ok)) {
      this.draw();
      return;
    }
    for (const p of model.parts) for (const f of partFaces(p)) this.faces.push({ pts: f, mat: p.mat, role: p.role, id: p.id });
    for (const g of model.rebar.groups) for (const bar of g.bars)
      for (let i = 0; i < bar.length - 1; i++) this.lines.push({ a: bar[i], b: bar[i + 1], color: REBAR[g.mark] || "#b91c1c", w: g.dia_mm });
    this.draw();
  }
  view(name) {
    const m = this.model;
    if (!(m == null ? void 0 : m.ok)) return;
    const top = m.levels.poleTop, bot = m.levels.blockBottom, xs = m.dims.signs.flatMap((s) => [s.x0, s.x1]);
    const cx = (Math.min(0, ...xs) + Math.max(0, ...xs)) / 2;
    const presets = {
      iso: { yaw: -0.9, pitch: 0.28, dist: (top - bot) * 1.9, target: [cx, 0, (top + bot) / 2] },
      front: { yaw: -Math.PI / 2, pitch: 0, dist: (top - bot) * 1.8, target: [cx, 0, (top + bot) / 2] },
      side: { yaw: 0, pitch: 0, dist: (top - bot) * 1.8, target: [0, 0, (top + bot) / 2] },
      footing: { yaw: -0.7, pitch: 0.35, dist: 7, target: [0, 0, -m.dims.pedestalTotal] }
    };
    Object.assign(this.cam, presets[name] || presets.iso);
    this.draw();
  }
  draw() {
    var _a;
    const c = this.canvas, dpr = window.devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    if (c.width !== Math.round(W * dpr)) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!((_a = this.model) == null ? void 0 : _a.ok)) return;
    const { eye, proj } = __privateMethod(this, _OverhangView_instances, project_fn).call(this), light = norm([0.4, -0.6, 0.8]), items = [];
    for (const face of this.faces) {
      if (!this.opts.sign && face.mat === "sign") continue;
      const pts = face.pts.map(proj);
      if (pts.some((p) => !p)) continue;
      const n = norm(cross(sub(face.pts[1], face.pts[0]), sub(face.pts[2], face.pts[0])));
      const toEye = sub(eye, face.pts[0]), facing = n[0] * toEye[0] + n[1] * toEye[1] + n[2] * toEye[2];
      const lit = 0.45 + 0.55 * Math.abs(n[0] * light[0] + n[1] * light[1] + n[2] * light[2]);
      const concrete = CONCRETE.has(face.mat);
      if (face.mat !== "sign" && facing < 0 && !(this.opts.xray && concrete)) continue;
      const bias = face.mat === "sign" ? eye[1] < face.pts[0][1] ? 0.3 : -0.3 : 0;
      items.push({
        z: pts.reduce((s, p) => s + p[2], 0) / pts.length - bias,
        pts,
        rgb: MAT[face.mat] || MAT.steel,
        lit,
        alpha: this.opts.xray && concrete ? 0.13 : 1,
        edge: concrete
      });
    }
    if (this.opts.rebar && this.opts.xray) for (const l of this.lines) {
      const a = proj(l.a), b = proj(l.b);
      if (!a || !b) continue;
      items.push({ z: (a[2] + b[2]) / 2 - 50, line: [a, b], color: l.color, w: l.w });
    }
    items.sort((p, q) => q.z - p.z);
    __privateMethod(this, _OverhangView_instances, ground_fn).call(this, proj);
    const focal = Math.min(W, H) * 1.6;
    for (const it of items) {
      if (it.line) {
        ctx.strokeStyle = it.color;
        ctx.lineWidth = Math.max(1, focal * it.w / 1e3 / Math.max(it.line[0][2], 0.1));
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(it.line[0][0], it.line[0][1]);
        ctx.lineTo(it.line[1][0], it.line[1][1]);
        ctx.stroke();
        continue;
      }
      const [r, g, b] = it.rgb.map((v) => Math.round(v * it.lit));
      ctx.globalAlpha = it.alpha;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath();
      it.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}
_OverhangView_instances = new WeakSet();
bind_fn = function() {
  let drag = null;
  this.canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
    this.canvas.setPointerCapture(e.pointerId);
  });
  this.canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    if (drag.pan) {
      const s = this.cam.dist / 600, cy = Math.cos(this.cam.yaw), sy = Math.sin(this.cam.yaw);
      this.cam.target = [this.cam.target[0] - cy * dx * s, this.cam.target[1] - sy * dx * s, this.cam.target[2] + dy * s];
    } else {
      this.cam.yaw -= dx * 8e-3;
      this.cam.pitch = Math.max(-1.45, Math.min(1.45, this.cam.pitch + dy * 8e-3));
    }
    this.draw();
  });
  const end = () => {
    drag = null;
  };
  this.canvas.addEventListener("pointerup", end);
  this.canvas.addEventListener("pointercancel", end);
  this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  this.canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    this.cam.dist = Math.max(1.5, Math.min(80, this.cam.dist * Math.exp(e.deltaY * 1e-3)));
    this.draw();
  }, { passive: false });
};
project_fn = function() {
  const { yaw, pitch, dist, target } = this.cam, cp = Math.cos(pitch), sp = Math.sin(pitch);
  const eye = [target[0] + dist * cp * Math.cos(yaw), target[1] + dist * cp * Math.sin(yaw), target[2] + dist * sp];
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f);
  const W = this.canvas.clientWidth, H = this.canvas.clientHeight, focal = Math.min(W, H) * 1.6;
  return { eye, f, proj: (p) => {
    const d = sub(p, eye), z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
    if (z < 0.05) return null;
    return [W / 2 + focal * (d[0] * r[0] + d[1] * r[1] + d[2] * r[2]) / z, H / 2 - focal * (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z, z];
  } };
};
ground_fn = function(proj) {
  const m = this.model, z = m.levels.road, ctx = this.ctx, xs = m.dims.signs.flatMap((s) => [s.x0, s.x1]);
  const x0 = Math.min(-2, ...xs) - 1, x1 = Math.max(2, ...xs) + 1;
  ctx.strokeStyle = "rgba(80,90,100,0.45)";
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  for (let y = -3; y <= 3; y += 1.5) {
    const a = proj([x0, y, z]), b = proj([x1, y, z]);
    if (a && b) {
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
};
const $ = (s) => document.querySelector(s);
const f2 = (v) => Number(v).toFixed(2);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const view = new OverhangView($("#ov-canvas"));
const form = $("#ov-form");
function readForm() {
  const d = Object.fromEntries(new FormData(form));
  return { ...DEFAULT_INPUT, ...d, pilesDrivable: form.elements.pilesDrivable.checked };
}
function limitsText(type) {
  const p = POLE_TYPES[type];
  const area = p.sides === 2 ? `${p.area_max_m2} m² ต่อข้าง (รวม ${p.area_total_max_m2})` : `${p.area_max_m2} m²`;
  const len = p.L_min ? `${f2(p.L_min)}–${f2(p.L_max)}` : `≤ ${f2(p.L_max)}`, wid = p.W_min ? `${f2(p.W_min)}–${f2(p.W_max)}` : `≤ ${f2(p.W_max)}`;
  return `${p.dwg} · พื้นที่ ≤ ${area} · ยาว ${len} m · สูง ${wid} m`;
}
function row(k, v) {
  return `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
}
function render() {
  var _a;
  const input = readForm(), m = buildOverhangModel(input), pole = POLE_TYPES[input.type];
  form.dataset.type = input.type;
  $("#ov-limits").textContent = limitsText(input.type);
  const st = $("#ov-status");
  if (!m.ok) {
    st.className = "ov-status fail";
    st.innerHTML = `<b>ไม่อยู่ในแบบมาตรฐาน</b><ul>${m.errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
    $("#ov-dims").innerHTML = "";
    $("#ov-rebar").innerHTML = "";
    view.setModel(null);
    return;
  }
  const fdn = FOUNDATIONS[m.foundationId];
  st.className = "ov-status ok";
  st.innerHTML = `<b>อยู่ในแบบมาตรฐาน ${pole.dwg} + RS-504 · ฐาน ${m.foundationId}</b><div>ตรวจเฉพาะขนาดตามขอบเขตของแบบ · ไม่ได้ตรวจกำลัง</div><div>${esc(m.foundation.reason)}</div>` + m.warnings.map((w) => `<div class="warn">${esc(w)}</div>`).join("");
  const d = m.dims, pp = pole.pole, pa = pole.arm, pc = pole.carrier;
  $("#ov-dims").innerHTML = "<table>" + row("เสา", `Ø${pp.D_mm}×${pp.t_mm} mm · ยาว ${f2(d.poleLength)} m`) + row("แขน", `Ø${pa.D_mm}×${pa.t_mm} mm · ${pole.sides * 2} เส้น · ยาว ${d.armLength.map(f2).join(" / ")} m`) + row("ท่อยึดระหว่างแขน", `Ø${pc.D_mm}×${pc.t_mm} mm · ${d.stiffenerX.length} ต้น · x = ${d.stiffenerX.map(f2).join(", ")} m`) + row("ป้าย", d.signs.map((s) => `${f2(s.L)}×${f2(s.W)} m (${f2(s.area)} m²)`).join(" + ") + ` · Al ${COMMON.signPlate_mm} mm · เอียง ${COMMON.signTilt_deg}°`) + row("ระดับ", `ใต้ป้าย +${f2(m.levels.signBottom - m.levels.road)} m จากผิวทาง · หัวตอม่อ +${f2(COMMON.pedestalAboveRoad)} m`) + row("หน้าแปลนแขน", `Ø${pole.flange.D.toFixed(3)} · PCD ${pole.flange.pcd.toFixed(2)} · 2×PL-20 · 8-M20 (A325) · ห่าง CL เสา ${f2(pole.jointOffset)} m`) + row("Base plate", `${f2(pole.basePlate.B)}×${f2(pole.basePlate.B)}×0.028 m · rib 8×PL-12`) + row("สลักยึด", `8-${COMMON.anchor.size} (${COMMON.anchor.grade}) · @${f2(pole.basePlate.pitch)} · โผล่ ${f2(COMMON.anchor.projection)} m · กรอบ 2×${COMMON.anchorFrame.member}`) + row("ตอม่อ", `${f2(fdn.pedestal.B)}×${f2(fdn.pedestal.B)} m · สูง ${f2(d.pedestalH)} + ลบมุม 0.10 m · ฝังในดิน ${f2(d.embed)} m`) + row(fdn.kind === "pile" ? "ฐานเข็ม" : "ฐานแผ่", `${f2(fdn.block.B)}×${f2(fdn.block.L)}×${f2(fdn.block.H)} m (ด้านยาวตามแนวถนน)`) + (fdn.piles ? row("เข็ม", `2 × □${f2(fdn.piles.size)} m · @${f2(fdn.piles.spacing)} · ≥ ${fdn.piles.capacity_t_min} t/ต้น · ยาว ${f2(m.input.pileLength)} m`) : "") + "</table>";
  $("#ov-rebar").innerHTML = `<table><tr><th>Mark</th><th>ตำแหน่ง</th><th>จำนวน</th><th>ขนาด</th></tr>` + m.rebar.groups.map((g) => `<tr><td>${g.mark}</td><td>${esc({ pedestalTie: "ปลอกตอม่อ", pedestalVertical: "เหล็กยืนตอม่อ", bottomLong: "เหล็กล่าง (ตามยาว)", topLong: "เหล็กบน (ตามยาว)", sideLong: "เหล็กข้าง", blockTie: "ปลอกฐาน" }[g.role])}</td><td>${g.spacing ? `@${f2(g.spacing)} (${g.bars.length})` : g.bars.length}</td><td>${g.grade === "SR24" ? "RB" : "DB"}${g.dia_mm}</td></tr>`).join("") + `</table><p class="note">${esc(m.rebar.note)} · cover ${COMMON.cover * 100} cm</p>`;
  $("#ov-open").innerHTML = m.openItems.map((o) => `<li><b>${o.id}</b> ${esc(o.text)}</li>`).join("");
  const first = !((_a = view.model) == null ? void 0 : _a.ok);
  view.setModel(m);
  if (first) view.view("iso");
}
form.addEventListener("input", render);
for (const b of document.querySelectorAll("[data-view]")) b.addEventListener("click", () => view.view(b.dataset.view));
const toggle = (name, on) => {
  const el = document.querySelector(`[data-toggle="${name}"]`);
  el.checked = on;
  view.opts[name] = on;
};
for (const b of document.querySelectorAll("[data-toggle]")) b.addEventListener("change", () => {
  toggle(b.dataset.toggle, b.checked);
  if (b.dataset.toggle === "rebar" && b.checked) toggle("xray", true);
  if (b.dataset.toggle === "xray" && !b.checked) toggle("rebar", false);
  view.draw();
});
const hash = new URLSearchParams(location.hash.slice(1));
for (const [k, v] of hash) {
  const el = form.elements[k];
  if ((el == null ? void 0 : el.type) === "checkbox") el.checked = v === "1";
  else if (el) el.value = v;
  const t = document.querySelector(`[data-toggle="${k}"]`);
  if (t) {
    t.checked = v === "1";
    view.opts[k] = t.checked;
  }
}
if (view.opts.rebar) toggle("xray", true);
render();
if (hash.get("view")) view.view(hash.get("view"));
