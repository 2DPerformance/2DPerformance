/* ============================================================
   ck-fnd.js — ช่างคิด Foundation shared math library
   ACI 318-19 (SI) implemented in Thai engineering units:
     force = kgf (loads often tonf → convert), length = cm,
     stress = ksc (kgf/cm²), moment fed as kgf·cm.
   Single source of truth for shear / punching / flexure so every
   Foundation module (combined/strap/mat footing, shear wall, stair)
   uses identical, verified formulas.
   Verified against the Phase-2 design+ACI audit (2026-07-09).

   ⚠ ตัวคูณลดกำลัง (φ) — อ่านก่อนใช้ค่า .phiVc / .phiVc_kgf / bearingPhiPn():
   ค่า φ ที่ "ฝังอยู่" ในไลบรารีนี้เป็นของ ACI 318-19 Table 21.2.1
   (เฉือน 0.75 · แรงแบกทาน 0.65) ซึ่ง **ไม่ใช่ φ ที่มีผลบังคับตามกฎหมายไทย**
   ลำดับมาตรฐานที่ใช้จริง: กฎกระทรวง พ.ศ. 2566 → ACI 318-19 → วสท.
   กฎกระทรวง พ.ศ. 2566 (ราชกิจจานุเบกษา ล.140 ต.54ก หน้า 9) กำหนด
   (กรณีมีการระบุมาตรฐานงานก่อสร้างและควบคุมคุณภาพวัสดุอย่างดี):
     แรงดัด 0.90 · แรงเฉือนและแรงบิด 0.85 · แรงแบกทานบนคอนกรีต 0.70
     เสาปลอกเกลียว 0.75 · เสาปลอกเดี่ยว 0.70
   และจับคู่กับตัวคูณน้ำหนักบรรทุก U = 1.4D + 1.7L (ข้อ 7) — เป็นชุดที่สอบเทียบกันเอง
   (กฎกระทรวงไม่ได้รับ 1.2D+1.6L + φ=0.75 ของ ACI มาใช้)
   → สูตรกำลังหน้าตัด (Vc, λs, ฯลฯ) ใช้ตาม ACI ได้ตามประกาศ มท. ข้อ 6(4)(ค)
     แต่ **φ ต้องใช้ค่าตามกฎกระทรวง** ดังนั้นผู้เรียก (caller) ต้องคูณ φ เอง:
       ใช้  .Vc × 0.85   (ไม่ใช่ .phiVc)
       ใช้  .Vc_kgf × 0.85  (ไม่ใช่ .phiVc_kgf)
       ใช้  bearingPn() × 0.70  (ไม่ใช่ bearingPhiPn())
   คงค่า .phiVc / bearingPhiPn() ไว้เหมือนเดิมเพื่อไม่ให้โค้ดเดิมที่พึ่งพาอยู่พัง
   ============================================================ */
(function (root) {
  'use strict';

  /* ---------- unit + number helpers ---------- */
  var TF_KN = 9.80665, KSC_MPA = 0.0980665;
  function fmt(x, n) { return isFinite(x) ? Number(x).toLocaleString('en-US', { minimumFractionDigits: n, maximumFractionDigits: n }) : '–'; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function barDia(t) { var m = String(t).match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; }        // mm
  function barAreaCm2(t) { var d = barDia(t); return Math.PI * d * d / 4 / 100; }                             // cm² (db in mm)
  function barMass(dmm) { return dmm * dmm / 162; }                                                            // kg/m (db in mm)

  /* ---------- ACI 318-19 size-effect factor (members w/o min shear reinf) ---------- */
  // §22.5.5.1.3 :  λs = sqrt(2/(1 + d/250))  (d in mm) ≤ 1
  function lambdaS(d_cm) { return Math.min(1, Math.sqrt(2 / (1 + (d_cm * 10) / 250))); }

  /* ---------- One-way (beam) shear, member WITHOUT min shear reinforcement ----------
     ACI 318-19 Table 22.5.5.1(b):  Vc = 0.66·λs·λ·(ρw)^(1/3)·√fc'·bw·d   (SI)
     ksc/cm/kgf coefficient = 0.66·√(1/0.0980665)/9.80665·100 ≈ 2.11
     Returns {Vc:kgf, phiVc:kgf, ls, rho, vc_ksc}.  λ=1 normalweight.
     ⚠ .phiVc ใช้ φ=0.75 ของ ACI — ไม่ใช่ φ ตามกฎหมายไทย. caller ต้องใช้ .Vc × 0.85
       (φ แรงเฉือน ตามกฎกระทรวง พ.ศ. 2566 ล.140 ต.54ก น.9) */
  function oneWayVcNoStirrup(fc, b, d, As, lambda) {
    lambda = lambda || 1;
    var rho = Math.max(1e-4, Math.min((As || 0) / (b * d), 0.02));
    var ls = lambdaS(d);
    var Vc = 2.11 * ls * lambda * Math.pow(rho, 1 / 3) * Math.sqrt(fc) * b * d;   // kgf
    return { Vc: Vc, phiVc: 0.75 * Vc, ls: ls, rho: rho, vc_ksc: Vc / (b * d) };
  }
  // Legacy 0.53√fc' form (only valid if Av≥Av,min) — exposed for members WITH stirrups (strap beam)
  // ⚠ .phiVc ใช้ φ=0.75 ของ ACI — ไม่ใช่ φ ตามกฎหมายไทย. caller ต้องใช้ .Vc × 0.85
  //   (กฎกระทรวง พ.ศ. 2566 ไม่แยก φ ตามมี/ไม่มีเหล็กปลอก — แยกเฉพาะ "สูตร" Vc เท่านั้น)
  function oneWayVcStirrup(fc, b, d, lambda) {
    lambda = lambda || 1;
    var Vc = 0.53 * lambda * Math.sqrt(fc) * b * d; // kgf
    return { Vc: Vc, phiVc: 0.75 * Vc };
  }

  /* ---------- Two-way (punching) shear ----------
     ACI 318-19 §22.6.5.2 : vc = min of three, EACH × λs (§22.6.5.2 size effect).
     β = long/short of loaded area ; αs = 40 interior / 30 edge / 20 corner.
     bo, d in cm ; returns {vc_ksc, Vc_kgf, phiVc_kgf, ls, gov}. λ=1.
     ⚠ .phiVc_kgf ใช้ φ=0.75 ของ ACI — ไม่ใช่ φ ตามกฎหมายไทย. caller ต้องใช้ .Vc_kgf × 0.85 */
  function punchingVc(fc, bo, d, beta, alphaS, lambda) {
    lambda = lambda || 1;
    var ls = lambdaS(d), s = lambda * Math.sqrt(fc);
    var v1 = 1.06 * s, v2 = 0.53 * (1 + 2 / beta) * s, v3 = 0.27 * (2 + alphaS * d / bo) * s;
    // pick the governing term BEFORE scaling by λs — deriving it from (vc/ls)===v1 is a float
    // round-trip that is not IEEE-754-safe and mislabels ~11% of cases (numbers were unaffected).
    var vmin = Math.min(v1, v2, v3);
    var gov = (vmin === v1) ? '1.06√fc′' : (vmin === v2) ? '0.53(1+2/β)√fc′' : '0.27(2+αs·d/bo)√fc′';
    var vc = vmin * ls;
    return { vc_ksc: vc, Vc_kgf: vc * bo * d, phiVc_kgf: 0.75 * vc * bo * d, ls: ls, gov: gov };
  }

  /* ---------- Punching around a column by position (interior/edge/corner) ----------
     Returns truncated critical perimeter bo, αs, in-footing critical area (cm²), and φVc.
     pos: 'interior' (4 sides) | 'edge' (3 sides, one free edge) | 'corner' (2 sides). cx,cy,d in cm.
     ⚠ .phiVc_kgf ใช้ φ=0.75 ของ ACI — ไม่ใช่ φ ตามกฎหมายไทย.
       caller ต้องใช้ .vc.Vc_kgf × 0.85 (ค่า nominal อยู่ใน .vc ที่ส่งกลับมาด้วย) */
  function punchColumn(fc, cx, cy, d, pos) {
    var bo, aS, critA;
    if (pos === 'corner') { bo = (cx + d / 2) + (cy + d / 2); aS = 20; critA = (cx + d / 2) * (cy + d / 2); }
    else if (pos === 'edge') { bo = 2 * (cx + d / 2) + (cy + d); aS = 30; critA = (cx + d / 2) * (cy + d); }
    else { bo = 2 * (cx + d) + 2 * (cy + d); aS = 40; critA = (cx + d) * (cy + d); }
    var beta = Math.max(cx, cy) / Math.min(cx, cy);
    var pv = punchingVc(fc, bo, d, beta, aS);
    return { bo: bo, aS: aS, critA: critA, vc: pv, phiVc_kgf: pv.phiVc_kgf, ls: pv.ls };
  }

  /* ---------- Flexure: solve As for factored moment ----------
     Mu in kgf·cm, b,d in cm, fc,fy in ksc. φ=0.90 tension-controlled.
     Mu = φ·As·fy·(d − a/2), a = As·fy/(0.85·fc·b). Returns {As, a, over, rho}. */
  function solveAs(Mu, b, d, fc, fy, phi) {
    phi = phi || 0.9;
    var k = phi * fy, m2 = phi * fy * fy / (1.7 * fc * b);
    var disc = k * k * d * d - 4 * m2 * Mu;
    if (disc < 0) return { As: NaN, over: true };
    var As = (k * d - Math.sqrt(disc)) / (2 * m2);
    return { As: As, a: As * fy / (0.85 * fc * b), over: false, rho: As / (b * d) };
  }
  // φMn for provided As (kgf·cm)
  function phiMn(As, b, d, fc, fy, phi) {
    phi = phi || 0.9; var a = As * fy / (0.85 * fc * b);
    return phi * As * fy * (d - a / 2);
  }

  /* ---------- As,min ----------
     Beam flexural (§9.6.1.1): max(0.8√fc'/fy, 14/fy)·b·d  (ksc, cm) → cm² */
  function AsMinBeam(fc, fy, b, d) { return Math.max(0.8 * Math.sqrt(fc) / fy, 14 / fy) * b * d; }

  /* Slab/footing temperature & shrinkage ratio — ACI 318-19 Table 24.4.3.2 (เหล็กข้ออ้อย)
       fy < 420 MPa            → 0.0020
       fy ≥ 420 MPa            → max(0.0018 × 420/fy , 0.0014)
     fy หน่วย ksc · 420 MPa ≈ 4,283 ksc
     ⚠ เดิม AsMinTemp คืน 0.0018 คงที่ (ไม่รับ fy เลย) → SD40 = 4,000 ksc = 392 MPa < 420
       จึงต้องเป็น 0.0020 ⇒ ของเดิมต่ำกว่าที่ ACI กำหนด ~11% · และสูตร 0.0018×4000/fy ที่ใช้ในแอปพื้น
       ยังขาดพื้น 0.0014 ทำให้ fy = 6,000 เคยได้ 0.0012 (ต่ำกว่า ACI 17%)
     หมายเหตุ: fy ≤ 2,400 (SR24) เป็น "เหล็กกลม" ซึ่งอยู่นอกขอบเขตตาราง ACI (ตารางเป็นของเหล็กข้ออ้อย)
       จึงคงค่าปฏิบัติเดิม 0.0025 ซึ่งอนุรักษ์กว่าทุกแถวในตาราง */
  var FY_420_KSC = 4283;
  function tempRatio(fy) {
    if (fy == null) return 0.0020;              // ไม่ระบุ fy → ใช้แถว fy < 420 MPa (อนุรักษ์)
    if (fy <= 2400) return 0.0025;              // SR24 เหล็กกลม — นอกตาราง ACI
    if (fy < FY_420_KSC) return 0.0020;
    return Math.max(0.0018 * FY_420_KSC / fy, 0.0014);
  }
  function AsMinTemp(b, h, fy) { return tempRatio(fy) * b * h; }

  /* ---------- Development lengths (ACI 318-19, ksc/cm) ----------
     Straight tension ld simplified §25.4.2.4 (ksc-converted):
       ld = (fy·ψt·ψe) / (6.6·λ·√fc') · db     [cm, db in cm]   (≥30cm)
       (SI simplified 25.4.2.3:  ld = fy·ψt·ψe/(2.1λ√fc')·db (MPa) → ksc const 2.1·√10.197≈6.7)
     Std hook §25.4.3.1 (2019, db^1.5), ksc-converted:
       ldh = (fy·ψe·ψr·ψo·ψc)/(23·λ·√fc'(MPa))·db(mm)^1.5   → compute in SI then →cm */
  function ldTension(fy, fc, db_cm, psi_t, psi_e, lambda) {
    psi_t = psi_t || 1; psi_e = psi_e || 1; lambda = lambda || 1;
    var ld = (fy * psi_t * psi_e) / (6.7 * lambda * Math.sqrt(fc)) * db_cm;
    return Math.max(ld, 30);
  }
  function ldCompression(fy, fc, db_cm) {
    // §25.4.9: ldc = max(0.24·fy/√fc'·db, 0.043·fy·db) (SI MPa) → ksc: 0.075·fy/√fc'·db & 0.0044·fy·db
    return Math.max(0.075 * fy / Math.sqrt(fc) * db_cm, 0.0044 * fy * db_cm, 20);
  }
  function ldHook(fy, fc, db_mm, psi_e, psi_r, psi_o, psi_c, lambda) {
    psi_e = psi_e || 1; psi_r = psi_r || 1; psi_o = psi_o || 1; lambda = lambda || 1;
    var fyM = fy * KSC_MPA, fcM = fc * KSC_MPA;              // → MPa
    var pc = (psi_c != null) ? psi_c : (fcM / 105 + 0.6);
    var ldh_mm = (fyM * psi_e * psi_r * psi_o * pc) / (23 * lambda * Math.sqrt(fcM)) * Math.pow(db_mm, 1.5);
    return Math.max(ldh_mm / 10, 8 * db_mm / 10, 15);        // cm ; floors 8db, 15cm
  }

  /* ---------- Bearing on concrete §22.8 ----------
     Nominal Pn = 0.85·fc'·A1·min(√(A2/A1),2)  [kgf]  (A1,A2 in cm²) — ยังไม่คูณ φ
     ใช้ตัวนี้แล้วคูณ φ เอง:  bearingPn(...) × 0.70
       (φ แรงแบกทานบนคอนกรีต ตามกฎกระทรวง พ.ศ. 2566 ล.140 ต.54ก น.9) */
  function bearingPn(fc, A1, A2) {
    var enh = Math.min(Math.sqrt((A2 || A1) / A1), 2);
    return 0.85 * fc * A1 * enh;          // kgf (nominal — no φ)
  }
  /* φPn = 0.65·0.85·fc'·A1·min(√(A2/A1),2)  [kgf]
     ⚠ 0.65 คือ φ ของ ACI 318-19 §22.8 — **ไม่ใช่** φ ตามกฎหมายไทย (กฎกระทรวง 2566 = 0.70)
       คงไว้เพื่อความเข้ากันได้ย้อนหลัง; โค้ดใหม่ให้ใช้ bearingPn() × 0.70 แทน */
  function bearingPhiPn(fc, A1, A2) {
    var enh = Math.min(Math.sqrt((A2 || A1) / A1), 2);
    return 0.65 * 0.85 * fc * A1 * enh;   // kgf — นิพจน์เดิม ไม่แตะ เพื่อให้ค่าที่คืนเท่าเดิมทุกบิต
  }

  /* ---------- Strength-reduction φ (ACI 318-19 Table 21.2.2) ----------
     εty = fy/Es (Es=2,040,000 ksc). Tension-controlled at εt ≥ εty+0.003.
     Transition: φ = 0.65 + 0.25·(εt−εty)/0.003, clamped [0.65,0.90]. */
  function ES() { return 2040000; }
  function epsY(fy) { return fy / 2040000; }
  function phiFlexure(et, fy) {
    var ety = epsY(fy);
    if (et >= ety + 0.003) return 0.90;
    if (et <= ety) return 0.65;
    return Math.min(0.9, Math.max(0.65, 0.65 + 0.25 * (et - ety) / 0.003));
  }

  /* ---------- ตัวคูณลดกำลัง φ — กฎกระทรวง พ.ศ. ๒๕๖๖ (ราชกิจจานุเบกษา เล่ม ๑๔๐ ตอนที่ ๕๔ ก หน้า ๙) ----------
     แหล่งความจริงเดียวของทั้งชุด. สองคอลัมน์ตามตัวบท:
       std   = มีการระบุมาตรฐานงานก่อสร้างและควบคุมคุณภาพวัสดุอย่างดี
       nostd = ไม่มีการระบุ
     ⚠ φ ชุดนี้ผูกกับชุดผสมแรง U = 1.4D + 1.7L (ข้อ ๗) — ห้ามจับคู่กับ 1.2/1.6 + φ 0.75 ของ ACI
        (คนละชุด calibrate กัน · การผสมข้ามชุด = ระดับความปลอดภัยไม่ตรงตามที่กฎหมายตั้งใจ)
     ⚠ กฎหมายกำหนด φ เป็น "เพดาน": ใช้ค่า*ต่ำกว่า*ได้เสมอเมื่อมีเหตุผลทางวิศวกรรม
        (เช่น ACI Sec.21.2.4.1 special structural wall ที่เฉือนคุม → φ=0.60) แต่ห้ามใช้สูงกว่า */
  var PHI_TABLE = {
    std:   { flex: 0.90, tension: 0.90, spiral: 0.75,  tied: 0.70, shear: 0.85, bearing: 0.70 },
    nostd: { flex: 0.75, tension: 0.75, spiral: 0.625, tied: 0.60, shear: 0.70, bearing: 0.60 }
  };
  function phiSet(key) { return (key === 'nostd') ? PHI_TABLE.nostd : PHI_TABLE.std; }

  /* สถานะ "มี/ไม่มี มาตรฐานงานก่อสร้าง" ใช้ร่วมทั้งชุด — โครงการหนึ่งย่อมมีสถานะเดียว
     phiStd() อ่าน · phiStd('nostd') เขียน · default = 'std' */
  var PHI_KEY = 'ck_phi_std';
  function phiStd(v) {
    try {
      if (v === undefined) return localStorage.getItem(PHI_KEY) === 'nostd' ? 'nostd' : 'std';
      localStorage.setItem(PHI_KEY, v === 'nostd' ? 'nostd' : 'std');
    } catch (e) { /* localStorage ปิดอยู่ (private mode) → ใช้ค่า default */ }
    return v === 'nostd' ? 'nostd' : 'std';
  }

  /* ---------- BBS shape library (BS 8666:2020, verified Collins chart) ----------
     dims in cm ; returns cutting length in cm. r = 2d(≤16mm)/3.5d(≥20mm). */
  var SHAPES = {
    '00': { name: 'ตรง (straight)', f: function (m) { return m.A; }, dims: ['A'] },
    '11': { name: 'งอ 90° ปลายเดียว (L)', f: function (m) { return m.A + m.B - 0.5 * m.r - m.d; }, dims: ['A', 'B'] },
    '21': { name: 'ตัว U/∩ งอ 2 มุม', f: function (m) { return m.A + m.B + m.C - m.r - 2 * m.d; }, dims: ['A', 'B', 'C'] },
    '51': { name: 'ปลอกปิด (closed link)', f: function (m) { return 2 * (m.A + m.B) - 2.5 * m.r - 5 * m.d + 2 * Math.max(10 * m.d, 7.5); }, dims: ['A', 'B'] },
    '77': { name: 'ปลอกเกลียว (helical)', f: function (m) { return m.C * Math.sqrt(Math.pow(Math.PI * (m.A - m.d), 2) + m.B * m.B); }, dims: ['A', 'B', 'C'] },
    '99': { name: 'รูปพิเศษ (custom)', f: function (m) { return m.A; }, dims: ['A'] }
  };
  function cutLen(code, dims, dmm) {
    var d = dmm / 10, r = (dmm <= 16 ? 2 : 3.5) * d;
    var m = { A: dims.A || 0, B: dims.B || 0, C: dims.C || 0, D: dims.D || 0, d: d, r: r };
    return (SHAPES[code] || SHAPES['00']).f(m);
  }
  // build a BBS row (lengths cm → m). n = total number of bars.
  function bbsRow(mark, member, code, dmm, n, dims, note) {
    var Lc = cutLen(code, dims, dmm) / 100, um = barMass(dmm);
    return { mark: mark, member: member, code: code, size: dmm, n: n, dims: dims, Lcut: Lc, unitMass: um, totLen: n * Lc, totMass: n * Lc * um, note: note || '' };
  }

  /* ---------- Minimal Three.js orbit-viewer scaffold ----------
     make3D(canvasId, wrapId) → viewer with layers/mats + build helpers.
     Modules add meshes to viewer.layers[key]; call viewer.commit(). */
  function make3D(canvasId, wrapId, groups) {
    if (window.__threeFailed || typeof THREE === 'undefined') return null;
    var V = { r: 6, theta: 0.82, phi: 0.6, tgt: { x: 0, y: 0, z: 0 }, layers: {}, mats: {}, vis: {}, groups: groups };
    V.canvas = document.getElementById(canvasId); V.wrap = document.getElementById(wrapId);
    V.scene = new THREE.Scene(); V.scene.background = new THREE.Color('#f7f9fc');
    V.renderer = new THREE.WebGLRenderer({ canvas: V.canvas, antialias: true });
    V.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    V.camera = new THREE.PerspectiveCamera(42, 1, 0.02, 400);
    V.scene.add(new THREE.AmbientLight(0xffffff, 0.62));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.7); d1.position.set(5, 9, 6); V.scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-5, 4, -6); V.scene.add(d2);
    V.mats.conc = new THREE.MeshLambertMaterial({ color: '#9fb8d6', transparent: true, opacity: 0.22, depthWrite: false });
    V.mats.edge = new THREE.LineBasicMaterial({ color: 0x1f2937, transparent: true, opacity: 0.55 });
    groups.forEach(function (g) { if (g.k !== 'conc') V.mats[g.k] = new THREE.MeshLambertMaterial({ color: g.c }); V.layers[g.k] = new THREE.Group(); V.scene.add(V.layers[g.k]); V.vis[g.k] = true; });
    if (!V.layers.conc) { V.layers.conc = new THREE.Group(); V.scene.add(V.layers.conc); V.vis.conc = true; }
    var drag = false, lx = 0, ly = 0;
    function dn(x, y) { drag = true; lx = x; ly = y; }
    function mv(x, y) { if (!drag) return; V.theta -= (x - lx) * 0.008; V.phi -= (y - ly) * 0.008; V.phi = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.02, V.phi)); lx = x; ly = y; V.render(); }
    V.canvas.addEventListener('mousedown', function (e) { dn(e.clientX, e.clientY); }); window.addEventListener('mouseup', function () { drag = false; }); window.addEventListener('mousemove', function (e) { mv(e.clientX, e.clientY); });
    V.canvas.addEventListener('wheel', function (e) { e.preventDefault(); V.r *= (e.deltaY > 0 ? 1.08 : 0.92); V.r = Math.max(1, Math.min(80, V.r)); V.render(); }, { passive: false });
    V.canvas.addEventListener('touchstart', function (e) { if (e.touches.length === 1) dn(e.touches[0].clientX, e.touches[0].clientY); });
    window.addEventListener('touchend', function () { drag = false; });
    V.canvas.addEventListener('touchmove', function (e) { if (e.touches.length === 1) { e.preventDefault(); mv(e.touches[0].clientX, e.touches[0].clientY); } }, { passive: false });
    V.resize = function () { var w = V.wrap.clientWidth || V.wrap.offsetWidth, h = V.wrap.clientHeight || V.wrap.offsetHeight; if (w < 10) { w = (document.querySelector('.wrap') || {}).clientWidth || document.documentElement.clientWidth - 24; } if (w < 10 || h < 10) return; V.renderer.setSize(w, h, false); V.camera.aspect = w / h; V.camera.updateProjectionMatrix(); };
    V.render = function () { var cx = V.tgt.x + V.r * Math.cos(V.phi) * Math.cos(V.theta), cy = V.tgt.y + V.r * Math.sin(V.phi), cz = V.tgt.z + V.r * Math.cos(V.phi) * Math.sin(V.theta); V.camera.position.set(cx, cy, cz); V.camera.lookAt(V.tgt.x, V.tgt.y, V.tgt.z); V.renderer.render(V.scene, V.camera); };
    V.clearAll = function () { Object.keys(V.layers).forEach(function (k) { var L = V.layers[k]; while (L.children.length) { var c = L.children[0]; L.remove(c); if (c.geometry) c.geometry.dispose(); } }); };
    V.box = function (layer, w, h, d, cx, cy, cz, mat, edges) { var g = new THREE.BoxGeometry(w, h, d); var m = new THREE.Mesh(g, mat || V.mats.conc); m.position.set(cx, cy, cz); V.layers[layer].add(m); if (edges) V.layers[layer].add(new THREE.LineSegments(new THREE.EdgesGeometry(g), V.mats.edge)); };
    V.cyl = function (layer, p1, p2, rad, mat) { var v = new THREE.Vector3(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]); var len = v.length(); if (len < 1e-4) return; var g = new THREE.CylinderGeometry(rad, rad, len, 8); var m = new THREE.Mesh(g, mat); m.position.set((p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, (p1[2] + p2[2]) / 2); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize()); V.layers[layer].add(m); };
    V.setView = function (name) { if (name === 'iso') { V.theta = 0.82; V.phi = 0.6; } else if (name === 'plan') { V.theta = 0; V.phi = Math.PI / 2 - 0.03; } else if (name === 'front') { V.theta = 0; V.phi = 0.06; } else if (name === 'side') { V.theta = Math.PI / 2; V.phi = 0.06; } V.render(); };
    V.commit = function () { V.groups.forEach(function (g) { if (V.layers[g.k]) V.layers[g.k].visible = V.vis[g.k]; }); V.resize(); V.render(); };
    window.addEventListener('resize', function () { V.resize(); V.render(); });
    return V;
  }

  root.CKF = {
    TF_KN: TF_KN, KSC_MPA: KSC_MPA, fmt: fmt, esc: esc,
    barDia: barDia, barAreaCm2: barAreaCm2, barMass: barMass,
    lambdaS: lambdaS, oneWayVcNoStirrup: oneWayVcNoStirrup, oneWayVcStirrup: oneWayVcStirrup,
    punchingVc: punchingVc, punchColumn: punchColumn, solveAs: solveAs, phiMn: phiMn,
    AsMinBeam: AsMinBeam, AsMinTemp: AsMinTemp, tempRatio: tempRatio,
    ldTension: ldTension, ldCompression: ldCompression, ldHook: ldHook,
    bearingPn: bearingPn, bearingPhiPn: bearingPhiPn, ES: ES, epsY: epsY, phiFlexure: phiFlexure,
    PHI_TABLE: PHI_TABLE, phiSet: phiSet, phiStd: phiStd,
    SHAPES: SHAPES, cutLen: cutLen, bbsRow: bbsRow, make3D: make3D
  };
})(window);
