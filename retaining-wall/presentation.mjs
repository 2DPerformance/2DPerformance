/**
 * สร้าง projection สำหรับหน้าจอจากผล engine ที่อยู่ใน Snapshot เท่านั้น
 *
 * โมดูลนี้ไม่เรียก engine และไม่ตัดสิน PASS/FAIL ใหม่ การคำนวณด้านล่างเป็นเพียง
 * การจัดรูป/แปลงหน่วยของค่าที่ engine และ Snapshot สร้างไว้แล้ว เพื่อให้ renderer
 * อ่านอ็อบเจกต์แช่แข็งชุดเดียวโดยไม่ต้องคิดเลขซ้ำเอง
 *
 * สำคัญ: โมดูลนี้ห้ามสร้างค่าทางวิศวกรรมจากสูตรซ้ำ หาก engine ไม่มีค่าที่หน้าจอ
 * เคยแยกแสดง ให้ส่ง NaN/ละเว้นอย่างซื่อสัตย์แทนการคำนวณทดแทน
 */

const STATUS_MAP = [
  ['ot', /OVERTURNING/i],
  ['sl', /SLIDING/i],
  ['be', /BEARING/i],
  ['ec', /ECCENTRICITY/i],
];

const G = 9.80665;

/**
 * @param {{
 *   input: object,
 *   result: object,
 *   checks: Array<object>,
 *   verdict: object,
 *   warnings: Array,
 *   snapshotId: string,
 *   profileShort: string,
 *   authority: object,
 *   engineeringCoverage: object,
 * }} source
 */
export function buildRetainingWallPresentation(source) {
  const {
    input, result: r, checks, verdict, warnings,
    snapshotId, profileShort, authority, engineeringCoverage,
  } = source;
  if (!authority || authority.constructionAuthority !== false
      || typeof authority.status !== 'string' || !authority.status.trim()
      || typeof authority.label !== 'string' || !authority.label.trim()) {
    throw new TypeError('presentation: Snapshot authority ต้องปิด construction และมี status/label ครบ');
  }
  if (!engineeringCoverage || engineeringCoverage.releaseAuthority !== false
      || engineeringCoverage.status !== 'HOLD_MISSING_SHEAR_TOE'
      || !Array.isArray(engineeringCoverage.excludedChecks)
      || !engineeringCoverage.excludedChecks.includes('SHEAR-TOE')) {
    throw new TypeError('presentation: engineering coverage ต้อง HOLD_MISSING_SHEAR_TOE แบบ fail-closed');
  }
  const hint = input.presentationInput || {};
  const g = {
    H: input.hp, B: input.B, baseT: input.hz, stemT: input.t,
    toe: input.toe, heel: input.heel,
  };

  const statusOf = (key) => {
    const found = checks.find((c) => STATUS_MAP.find(([k, re]) => k === key && re.test(c.k)));
    return found ? found.ok : null;
  };

  /* กำแพงมีครีบไม่มี stemTab — ใช้แถบวิกฤตล่างสุดที่ engine ส่งมา */
  const butBottom = (r.strips && r.strips.length) ? r.strips[r.strips.length - 1] : null;
  const stemLast = (r.stemTab && r.stemTab.length)
    ? r.stemTab[r.stemTab.length - 1]
    : (butBottom ? { Mu: butBottom.Mn_, As: butBottom.As_, bar: butBottom.b_ } : null);

  /* ชื่อชนิดเหล็กต้องอ่านจากผลเลือกเหล็กของ engine โดยตรง ถ้าผลไม่มี prefix
     ให้ projection ส่ง null เพื่อให้ renderer ปิดผล แทนการเดา DB/RB จาก fy */
  const barPrefix = (bar) => {
    const match = bar && typeof bar.txt === 'string'
      ? bar.txt.trim().match(/^(DB|RB)/)
      : null;
    return match ? match[1] : null;
  };

  /* ไม่มี phiMn รายเส้นจาก engine จึงคง NaN ให้หน้าจอแสดงขีดอย่างซื่อสัตย์ */
  const design = (As, bar) => ({
    asReq: As,
    selected: bar
      ? { db: bar.db, spacing: bar.s, asProv: bar.prov, phiMn: NaN, prefix: barPrefix(bar) }
      : null,
  });

  const c = {
    ...g,
    phi: input.phi, gamma: input.gs, gammaSat: input.gsat,
    delta: hint.delta,
    qa: input.qa, q: input.q, gammaC: input.gc,
    /* ความสูงน้ำเป็น normalized screen geometry จาก Snapshot ไม่อนุมานจาก zw ที่นี่ */
    Hw: hint.waterHeight,
    waterEnabled: hint.waterEnabled,
    lineLoad: 0, lineLoadHeight: 0,
    frontDepth: input.Df, passiveFactor: hint.passiveFactor,
    includeSurchargeWeight: hint.includeSurchargeWeight,
    Ka: r.Ka, Kp: r.Kp,
    /* engine ส่งเฉพาะแรงดันดินรวม Phs จึงไม่แยก Pq ซ้ำด้วยสูตรในชั้นนำเสนอ */
    Pa: r.Phs, Pq: NaN, Pw: r.Pw, P: r.Ph,
    activePressure: r.Phs,
    Mo: r.Mo,
    V: r.SVs, Mr: r.SMs,
    PpUltimate: r.Pp, Pp: r.PpAll, friction: r.slideFric,
    fsOt: r.FSot, fsSl: r.FSsl, xR: r.xbar, e: r.e, kern: r.kern,
    qToe: r.q1, qHeel: r.q2,
    /* demand สำหรับการ์ด Bearing ต้องเป็นตัวเดียวกับ checksFor: soil ใช้ qmaxEff นอกนั้นใช้ q1 */
    qMax: r.bcap ? r.qmaxEff : r.q1,
    qMin: r.q2,
    bearingFs: r.FoSbear,
    contactWidth: r.Bpeff,

    otPass: statusOf('ot'), slPass: statusOf('sl'),
    bePass: statusOf('be'), ecPass: statusOf('ec'),

    muStem: stemLast ? stemLast.Mu : NaN,
    muToe: r.MT,
    muHeel: r.MH_,
    /* หน้ารับแรงอ้างชื่อผลออกแบบ footing ของ engine โดยตรง ไม่อนุมานจากเครื่องหมายโมเมนต์ใน renderer */
    toeFace: r.barT && Number.isFinite(r.AsT) ? 'เหล็กล่าง' : null,
    heelFace: r.barH_ && Number.isFinite(r.AsH_) ? 'เหล็กบน' : null,
    stemDesign: design(stemLast ? stemLast.As : NaN, stemLast ? stemLast.bar : null),
    toeDesign: design(r.AsT, r.barT),
    heelDesign: design(r.AsH_, r.barH_),

    checks,
    verdict,
    warnings,
    snapshotId,
    profileShort,
    authority,
    engineeringCoverage,
    splitExact: false,
  };

  /* แปลงเฉพาะ projection หน้าจอ ค่า canonical ใน Snapshot ยังคง SI */
  const isMks = input.units === 'mks';
  if (isMks) {
    for (const k of ['Pa', 'Pq', 'Pw', 'P', 'activePressure', 'Pp', 'PpUltimate', 'friction', 'V', 'Mr', 'Mo',
      'qToe', 'qHeel', 'qMax', 'qMin', 'qa', 'q',
      'muStem', 'muToe', 'muHeel']) {
      if (Number.isFinite(c[k])) c[k] = c[k] / G;
    }
  }
  c.units = isMks ? 'mks' : 'si';
  c.uL = isMks
    ? { F: ' ตัน/ม.', M: ' ตัน·ม./ม.', P: ' ตัน/ม²', UW: 'ตัน/ม³' }
    : { F: ' kN/m', M: ' kN·m/m', P: ' kPa', UW: 'kN/m³' };

  return c;
}
