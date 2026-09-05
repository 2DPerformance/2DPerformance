/**
 * สะพานเชื่อมหน้าจอของเจ้าของงาน เข้ากับ engine ที่ตรวจแล้ว
 *
 * หน้าจอ (retaining-wall-workbench.html) เป็นของเจ้าของงาน เขียนเอง มีสูตรย่อของตัวเองมาด้วย
 * ไฟล์นี้เข้ามาแทนที่ "สูตรย่อ" นั้นด้วย engine ตัวจริง โดยไม่แตะหน้าตาและตัวเรนเดอร์เดิมเลย
 *
 * กติกาที่ห้ามผิด (CONCRETE_CARD_1TO1_STANDARD ข้อ 4)
 *   · engine เป็นเจ้าของสูตรและคำตัดสินแต่ผู้เดียว
 *   · ชั้นนี้ทำได้แค่ "แปลงชื่อ" และ "แยกส่วนเพื่อแสดงผล" ห้ามคิดค่าออกแบบใหม่
 *   · ค่าที่แยกเพื่อแสดงผล ต้องบวกกลับได้เท่ากับค่าของ engine เสมอ ไม่งั้นต้องประกาศ
 */
import { createRetainingWallSnapshot, draftFingerprint } from './snapshot.mjs';
import { checksFor } from './engine.mjs';

const DEG = Math.PI / 180;

/**
 * แปลงค่าจากหน้าจอเป็น input ของ engine
 *
 * ★ จุดที่หน่วยไม่ตรงกันและเคยทำให้ผลผิดมาแล้ว
 *   · หน้าจอกรอกความสูงน้ำ "จากหลังฐานขึ้นมา" ส่วน engine รับ "ความลึกจากผิวดินลงไป"
 *   · หน้าจอกรอกมุมเสียดทานผนัง δ เป็นองศา ส่วน engine รับสัมประสิทธิ์เสียดทานใต้ฐาน μ
 *   · ระยะหุ้มคอนกรีตเป็นมิลลิเมตรทั้งสองฝั่ง แต่ความยาวอื่นเป็นเมตร
 */
export function uiToEngineInput(ui) {
  /* ★ สะพานเลิก "ปัดค่าเข้าเขตเงียบ ๆ" ทั้งหมดแล้ว
     เดิม δb ต่ำถูกยกเป็น μ=0.2 (แรงต้านเลื่อนโป่งเกินจริง) · qa 10 ถูกยกเป็น 30
     (กำลังแบกทานยอมให้โป่งสามเท่า) · φ ต่ำถูกยกเป็น 15 · ช่องว่างถูกแทนด้วยค่าตั้งต้น
     — ทุกตัวเอียงฝั่งไม่อนุรักษ์และผู้ใช้ไม่มีทางรู้
     ตอนนี้ค่าดิบวิ่งไปให้ normalizeInput ปฏิเสธพร้อมข้อความรายช่อง — ด่านเดียว ตัดสินที่เดียว */
  /* ช่องว่างคืน undefined (ให้ด่านตรวจทวง "ต้องกรอก") · ตัวเลขเสียคืน NaN ("ต้องเป็นตัวเลข") */
  const raw = (v) => (v === '' || v === null || v === undefined ? undefined : Number(v));
  /* หน่วยไทย (ตัน·kgf) → SI ที่สะพานจุดเดียว — engine ภายในเป็น SI เสมอ
     โหมดไทยกรอก γ เป็น ตัน/ม³ · q,qa เป็น ตัน/ม² — คูณ g เข้า SI ก่อนเข้าด่านตรวจ */
  const unitMode = ui.unitMode === undefined || ui.unitMode === null || ui.unitMode === ''
    ? 'si'
    : ui.unitMode;
  /* หน้าเว็บเก็บค่ากายภาพใน canonical SI ledger และส่งโหมดป้ายแยกต่างหาก
     API เดิมที่ส่ง unitMode อย่างเดียวยังคงทำงานเหมือนเดิม */
  const presentationUnitMode = ui.presentationUnitMode === undefined
    || ui.presentationUnitMode === null || ui.presentationUnitMode === ''
    ? unitMode
    : ui.presentationUnitMode;
  const MKS = unitMode === 'mks';
  const G = 9.80665;
  const den = (v) => (MKS && Number.isFinite(v) ? v * G : v);
  const hp = raw(ui.H);
  const t = raw(ui.stemT);
  const toe = raw(ui.toe);
  const heel = raw(ui.heel);
  const hz = raw(ui.baseT);
  /* δb clamp เฉพาะทิศอนุรักษ์: ติดลบไร้ความหมาย → 0 (μ ต่ำสุด) · เกิน 45° → 45 (กัน tan โป่ง) */
  const deltaRaw = raw(ui.delta);
  const delta = Number.isFinite(deltaRaw) ? Math.min(45, Math.max(0, deltaRaw)) : NaN;
  /* ติ๊กมีน้ำแต่กรอกศูนย์ = ตั้งใจบอกว่าไม่มีน้ำ · เว้นว่าง = ต้องถูกทวงให้กรอก */
  const waterOn = !!ui.waterEnabled && raw(ui.waterH) !== 0;
  const waterH = waterOn ? raw(ui.waterH) : 0;
  const optionalAuto = (v) => {
    const n = raw(v);
    return n === undefined ? 0 : n;
  };

  /* ★ ชนิดกำแพงต้องแปลงแบบปิด: รู้จักก็แปลง ไม่รู้จักก็ส่งดิบไปให้ด่านตรวจปฏิเสธ */
  const WTYPE_MAP = { cantilever: 'cant', cant: 'cant', gravity: 'gravity', counterfort: 'but', but: 'but' };
  const wtype = WTYPE_MAP[ui.wtype] || ui.wtype || 'cant';

  const pf = Number.isFinite(raw(ui.passiveFactor)) ? raw(ui.passiveFactor) : 0;
  return {
    wtype,
    hp, hz, t, ttop: t, toe, heel,
    /* B เป็นช่องกรอกจริงบน UI — ต้องส่งค่าดิบเข้า normalizeInput เพื่อให้
       การแก้ B ทำให้ draft fingerprint เปลี่ยนทันที และให้ด่านกลางตรวจ
       ความสัมพันธ์ B = toe + t + heel; ห้ามเขียนทับ B ของผู้ใช้เงียบ ๆ */
    B: raw(ui.B),
    Lw: raw(ui.wallLength),
    dk: 0,
    /* พารามิเตอร์ครีบ — มีผลเฉพาะโหมดกำแพงมีครีบ · L=ช่วงว่างระหว่างครีบ bs=หนาครีบ
       cfL/cfH เว้นว่างหรือศูนย์ = อัตโนมัติ (ลึกเท่า heel · สูงเท่าพนัง) */
    L: raw(ui.cfSpan),
    bs: raw(ui.cfThick),
    cfL: optionalAuto(ui.cfDepth),
    cfH: optionalAuto(ui.cfHeight),

    gs: den(raw(ui.gamma)),
    gsat: den(raw(ui.gammaSat)),
    phi: raw(ui.phi),
    c: 0,
    beta: 0,
    q: den(raw(ui.surcharge)),
    /* δb องศา → μ ใต้ฐาน — ส่ง tan(δ) ตรง ๆ ไม่มีพื้นยกอีกต่อไป
       δb=5° ได้ μ=0.087 จริง แล้วเช็กเลื่อนไถลของ engine จะตกอย่างซื่อสัตย์ */
    mu: Number.isFinite(delta) ? Math.tan(delta * DEG) : NaN,
    /* δ ผนัง (Coulomb) — เฉพาะกำแพงมวล · ค่าตั้งต้น φ/2 ตาม USACE */
    wallDelta: wtype === 'gravity' ? raw(ui.wallDelta) : 0,
    qa: den(raw(ui.qa)),
    Df: raw(ui.frontDepth),
    /* ความสูงน้ำเหนือหลังฐาน → ความลึกจากผิวดิน · ไม่มีน้ำใช้ค่าตัวแทน 99
       น้ำสูงกว่าพนัง → zw ติดลบ → ด่านตรวจปฏิเสธพร้อมข้อความ ไม่ตัดยอดเงียบ ๆ */
    hasWater: waterOn,
    zw: waterOn ? hp - waterH : 99,

    fc: raw(ui.fc),
    fy: raw(ui.fy),
    gc: den(raw(ui.gammaC)),
    cov: raw(ui.cover),
    db: 16,

    usePp: pf > 0,
    ppFS: pf > 0 ? Math.max(1, 1 / pf) : 2,
    units: presentationUnitMode,
    presentationInput: {
      delta: Number.isFinite(raw(ui.delta)) ? raw(ui.delta) : NaN,
      waterEnabled: !!ui.waterEnabled,
      waterHeight: Number.isFinite(waterH) ? waterH : NaN,
      passiveFactor: raw(ui.passiveFactor) === undefined ? 0 : raw(ui.passiveFactor),
      includeSurchargeWeight: !!ui.includeSurchargeWeight,
    },
  };
}

/**
 * คำนวณหนึ่งครั้ง แล้วคืนอ็อบเจกต์รูปทรงเดียวกับที่ตัวเรนเดอร์เดิมของหน้าจอต้องการ
 * @returns {{ok: boolean, c: object|null, snapshot: object, errors: Array}}
 */
export function computeForUi(ui, profileId = 'thai2566', meta = {}) {
  const input = uiToEngineInput(ui);
  const snapshot = createRetainingWallSnapshot(input, profileId, meta);
  if (!snapshot.ok) return { ok: false, c: null, snapshot, errors: snapshot.errors };
  return { ok: true, c: snapshot.presentation, snapshot, errors: [] };
}

export { draftFingerprint, checksFor };
