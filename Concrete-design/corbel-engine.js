(function initCorbelEngine(global) {
'use strict';

const KGF_TO_N = 9.80665;
const PHI_CORBEL = 0.75;
const PHI_BEARING = 0.65;
const WALL_LOAD_CATALOG_VERSION = '2026-07-18';
const THAI_DEAD_LOAD_BASIS = Object.freeze({
  code: 'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคาร พ.ศ. 2566',
  clause: 'ข้อ 7(1)',
  combination: 'U = 1.4D + 1.7L; dead-only preliminary takeoff uses 1.4D',
  sourceUrl: 'https://ratchakitcha.soc.go.th/documents/140A054N0000000000400.pdf',
  status: 'project-load-envelope-confirmation-required',
});

const CORBEL_CODE_BASIS = Object.freeze({
  code: 'ACI 318-19(22)',
  projectBasis: 'EIT 011008-21',
  projectBasisStatus: 'responsible-engineer-clause-verification-required',
  crossCheck: 'ACI 318-19(22)',
  calculationStatus: 'preliminary-local-cross-check',
  corbel: '16.5',
  shearFriction: '22.9',
  bearing: '22.8',
  phiCorbel: PHI_CORBEL,
  phiBearing: PHI_BEARING,
});

const WALL_LOAD_PRESETS = Object.freeze({
  aac_75: Object.freeze({
    key: 'aac_75',
    label: 'อิฐมวลเบา 7.5 ซม.',
    wallWeightKgM2: 56.7,
    finishWeightKgM2: 34.7,
    wallThicknessMm: 75,
    basis: 'มวลก้อน AAC จากผู้ผลิต 56.7 kg/m²; ไม่รวมปูนก่อและฉาบ',
    finishBasis: 'มวลปูนฉาบหนา 10 mm รวม 2 ด้าน 34.7 kg/m² (ค่าเริ่มต้น TPI)',
    sourceLabel: 'Diamond AAC + TPI (ข้อมูลผู้ผลิต)',
    sourceUrl: 'https://www.dbp.co.th/th/product/diamond-brand-lightweight-bricks',
    finishSourceUrl: 'https://www.tpipolene.co.th/th/product/block/item/246-tpiblock',
  }),
  aac_100: Object.freeze({
    key: 'aac_100',
    label: 'อิฐมวลเบา 10 ซม.',
    wallWeightKgM2: 75.8,
    finishWeightKgM2: 34.7,
    wallThicknessMm: 100,
    basis: 'มวลก้อน AAC จากผู้ผลิต 75.8 kg/m²; ไม่รวมปูนก่อและฉาบ',
    finishBasis: 'มวลปูนฉาบหนา 10 mm รวม 2 ด้าน 34.7 kg/m² (ค่าเริ่มต้น TPI)',
    sourceLabel: 'Diamond AAC + TPI (ข้อมูลผู้ผลิต)',
    sourceUrl: 'https://www.dbp.co.th/th/product/diamond-brand-lightweight-bricks',
    finishSourceUrl: 'https://www.tpipolene.co.th/th/product/block/item/246-tpiblock',
  }),
  aac_150: Object.freeze({
    key: 'aac_150',
    label: 'อิฐมวลเบา 15 ซม.',
    wallWeightKgM2: 113.3,
    finishWeightKgM2: 34.7,
    wallThicknessMm: 150,
    basis: 'มวลก้อน AAC จากผู้ผลิต 113.3 kg/m²; ไม่รวมปูนก่อและฉาบ',
    finishBasis: 'มวลปูนฉาบหนา 10 mm รวม 2 ด้าน 34.7 kg/m² (ค่าเริ่มต้น TPI)',
    sourceLabel: 'Diamond AAC + TPI (ข้อมูลผู้ผลิต)',
    sourceUrl: 'https://www.dbp.co.th/th/product/diamond-brand-lightweight-bricks',
    finishSourceUrl: 'https://www.tpipolene.co.th/th/product/block/item/246-tpiblock',
  }),
  red_brick_100: Object.freeze({
    key: 'red_brick_100',
    label: 'ผนังอิฐแดง 10 ซม. (ค่าอ้างอิง)',
    wallWeightKgM2: 180,
    finishWeightKgM2: 0,
    wallThicknessMm: 100,
    basis: 'ค่าน้ำหนักระบบผนังอ้างอิง 180 kg/m²; ต้องตรวจชนิดอิฐ ปูนก่อ และความหนาจริง',
    finishBasis: 'ไม่บวกฉาบซ้ำในค่าเริ่มต้น; เพิ่มเฉพาะเมื่อยืนยันระบบจริง',
    sourceLabel: 'สภาวิศวกร (เอกสารอบรมอ้างอิง)',
    sourceUrl: 'https://coe.or.th/wp-content/uploads/2023/11/%E0%B8%AD.%E0%B8%AA%E0%B8%B4%E0%B8%A3%E0%B8%B4%E0%B8%A7%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B9%8C-%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B8%B9%E0%B9%89%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%AD%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%A5%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%99%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B1%E0%B8%9A%E0%B8%87%E0%B8%B2.pdf',
    finishSourceUrl: '',
  }),
  concrete_block_100: Object.freeze({
    key: 'concrete_block_100',
    label: 'ผนังคอนกรีตบล็อก 10 ซม. (ค่าสูงอ้างอิง)',
    wallWeightKgM2: 200,
    finishWeightKgM2: 0,
    wallThicknessMm: 100,
    basis: 'ค่าสูงของช่วงน้ำหนักระบบผนังอ้างอิง 100–200 kg/m²; ต้องตรวจบล็อกและปูนจริง',
    finishBasis: 'ไม่บวกฉาบซ้ำในค่าเริ่มต้น; เพิ่มเฉพาะเมื่อยืนยันระบบจริง',
    sourceLabel: 'สภาวิศวกร (เอกสารอบรมอ้างอิง)',
    sourceUrl: 'https://coe.or.th/wp-content/uploads/2023/11/%E0%B8%AD.%E0%B8%AA%E0%B8%B4%E0%B8%A3%E0%B8%B4%E0%B8%A7%E0%B8%B1%E0%B8%92%E0%B8%99%E0%B9%8C-%E0%B8%84%E0%B8%A7%E0%B8%B2%E0%B8%A1%E0%B8%A3%E0%B8%B9%E0%B9%89%E0%B8%9B%E0%B8%A3%E0%B8%B0%E0%B8%81%E0%B8%AD%E0%B8%9A%E0%B8%81%E0%B8%B2%E0%B8%A3%E0%B9%80%E0%B8%A5%E0%B8%B7%E0%B9%88%E0%B8%AD%E0%B8%99%E0%B8%A3%E0%B8%B0%E0%B8%94%E0%B8%B1%E0%B8%9A%E0%B8%87%E0%B8%B2.pdf',
    finishSourceUrl: '',
  }),
  custom: Object.freeze({
    key: 'custom',
    label: 'กำหนดน้ำหนักเอง',
    wallWeightKgM2: 100,
    finishWeightKgM2: 0,
    wallThicknessMm: null,
    basis: 'ค่าที่ผู้ใช้กำหนด',
    finishBasis: 'ค่าที่ผู้ใช้กำหนด',
    sourceLabel: 'ผู้ใช้กำหนด',
    sourceUrl: '',
    finishSourceUrl: '',
  }),
});

const DEFAULT_WALL_LOAD_INPUT = Object.freeze({
  materialKey: 'aac_100',
  wallHeightM: 2.8,
  tributaryWidthMm: 300,
  wallWeightKgM2: WALL_LOAD_PRESETS.aac_100.wallWeightKgM2,
  finishWeightKgM2: WALL_LOAD_PRESETS.aac_100.finishWeightKgM2,
  wallThicknessMm: WALL_LOAD_PRESETS.aac_100.wallThicknessMm,
  otherPermanentKg: 0,
  deadLoadFactor: 1.4,
});

const DEFAULT_CORBEL_INPUT = Object.freeze({
  memberId: 'CB-01',
  vuKg: 2000,
  widthMm: 300,
  heightMm: 500,
  tipHeightMm: 250,
  lengthMm: 450,
  depthMm: 430,
  wallThicknessMm: 100,
  noseSetbackMm: 60,
  coverMm: 40,
  fcMpa: 24,
  fyMpa: 400,
  lambda: 1,
  surface: 'monolithic',
});

const SURFACE_MU = Object.freeze({ monolithic: 1.4, rough: 1.0, smooth: 0.6 });
const MAIN_DIAMETERS = Object.freeze([12, 16, 20, 25]);
const TIE_DIAMETERS = Object.freeze([9, 10, 12]);

const finite = (value) => Number.isFinite(Number(value));
const valueOr = (value, fallback) => finite(value) ? Number(value) : fallback;
const area = (diameterMm) => Math.PI * diameterMm * diameterMm / 4;
const ratio = (demand, capacity) => capacity > 0 ? demand / capacity : Infinity;
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));

const WALL_LAYOUT_LIMITS = Object.freeze({
  wallRunMm: Object.freeze([150, 30_000]),
  supportCount: Object.freeze([1, 100]),
  maxSpacingMm: Object.freeze([150, 2_000]),
  governingTributaryWidthMm: Object.freeze([150, 2_000]),
});

function calculateWallSupportLayout(rawInput = {}) {
  const layoutMethod = rawInput.layoutMethod ?? 'count';
  const wallRunMm = rawInput.wallRunMm === undefined ? DEFAULT_WALL_LOAD_INPUT.tributaryWidthMm : Number(rawInput.wallRunMm);
  const requestedSupportCount = rawInput.supportCount === undefined ? 1 : Number(rawInput.supportCount);
  const requestedMaxSpacingMm = rawInput.maxSpacingMm === undefined ? 2_000 : Number(rawInput.maxSpacingMm);
  const distributionConfirmed = rawInput.distributionConfirmed === true;
  const errors = [];

  if (layoutMethod !== 'count' && layoutMethod !== 'max-spacing') {
    errors.push({ field: 'layoutMethod', message: 'วิธีแบ่งหูช้างต่อเนื่องต้องเป็นจำนวนช่วงหรือความกว้างช่วงสูงสุด' });
  }
  const [wallRunMin, wallRunMax] = WALL_LAYOUT_LIMITS.wallRunMm;
  if (!Number.isFinite(wallRunMm) || wallRunMm < wallRunMin || wallRunMm > wallRunMax) {
    errors.push({ field: 'wallRunMm', message: 'ความยาวผนังรวมต้องอยู่ระหว่าง 150–30,000 mm' });
  }

  let supportCount = NaN;
  let spacingMm = null;
  if (layoutMethod === 'count') {
    const [countMin, countMax] = WALL_LAYOUT_LIMITS.supportCount;
    if (!Number.isInteger(requestedSupportCount) || requestedSupportCount < countMin || requestedSupportCount > countMax) {
      errors.push({ field: 'supportCount', message: 'จำนวนแถบออกแบบหูช้างต้องเป็นจำนวนเต็มระหว่าง 1–100 แถบ' });
    } else {
      supportCount = requestedSupportCount;
    }
  } else if (layoutMethod === 'max-spacing') {
    const [spacingMin, spacingMax] = WALL_LAYOUT_LIMITS.maxSpacingMm;
    const [, countMax] = WALL_LAYOUT_LIMITS.supportCount;
    if (!Number.isFinite(requestedMaxSpacingMm) || requestedMaxSpacingMm < spacingMin || requestedMaxSpacingMm > spacingMax) {
      errors.push({ field: 'maxSpacingMm', message: 'ความกว้างแถบออกแบบสูงสุดต้องอยู่ระหว่าง 150–2,000 mm' });
    } else if (Number.isFinite(wallRunMm) && wallRunMm > 0) {
      supportCount = Math.max(1, Math.ceil(wallRunMm / requestedMaxSpacingMm));
      if (supportCount > countMax) {
        errors.push({ field: 'maxSpacingMm', message: 'ระยะที่กำหนดทำให้ต้องแบ่งแถบออกแบบเกิน 100 แถบ; เพิ่มระยะหรือลดความยาวผนัง' });
        supportCount = NaN;
      }
    }
  }

  const canResolve = Number.isFinite(wallRunMm) && wallRunMm > 0 && Number.isInteger(supportCount) && supportCount >= 1;
  const stripWidthMm = canResolve ? wallRunMm / supportCount : NaN;
  if (canResolve && supportCount > 1) spacingMm = stripWidthMm;

  const supportPositionsMm = [];
  const tributaryWidthsMm = [];
  if (canResolve) {
    for (let index = 0; index < supportCount; index += 1) {
      supportPositionsMm.push(round((index + 0.5) * stripWidthMm));
      tributaryWidthsMm.push(round(stripWidthMm));
    }
  }

  const governingTributaryWidthMm = tributaryWidthsMm.length ? Math.max(...tributaryWidthsMm) : NaN;
  const governingSupportIndices = tributaryWidthsMm
    .map((widthMm, index) => Math.abs(widthMm - governingTributaryWidthMm) <= 0.000001 ? index + 1 : null)
    .filter((index) => index !== null);
  const totalTributaryWidthMm = round(tributaryWidthsMm.reduce((sum, widthMm) => sum + widthMm, 0));
  const tributaryBalanceErrorMm = canResolve ? round(totalTributaryWidthMm - wallRunMm) : NaN;

  if (canResolve) {
    const [tributaryMin, tributaryMax] = WALL_LAYOUT_LIMITS.governingTributaryWidthMm;
    if (governingTributaryWidthMm < tributaryMin || governingTributaryWidthMm > tributaryMax) {
      errors.push({
        field: layoutMethod === 'count' ? 'supportCount' : 'maxSpacingMm',
        message: 'ความกว้างแถบออกแบบต่อเนื่องต้องอยู่ระหว่าง 150–2,000 mm; ปรับจำนวนแถบหรือระยะสูงสุด',
      });
    }
    if (supportCount > 1 && !distributionConfirmed) {
      errors.push({
        field: 'distributionConfirmed',
        message: 'กรุณายืนยันว่าเป็นหูช้างหรือชั้นรองรับคอนกรีตต่อเนื่องเต็มความยาวผนังและไม่มีช่องว่างระหว่างแถบออกแบบ',
      });
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    input: {
      wallRunMm,
      layoutMethod,
      requestedSupportCount: layoutMethod === 'count' ? requestedSupportCount : null,
      requestedMaxSpacingMm: layoutMethod === 'max-spacing' ? requestedMaxSpacingMm : null,
      distributionConfirmed,
    },
    schemaVersion: 1,
    assumption: 'contiguous-ledge-equal-design-strips',
    positionRule: 'equal-strip-centers-on-full-width-contiguous-ledge',
    edgeTributaryRule: 'equal-contiguous-strip-boundaries',
    supportCount: Number.isInteger(supportCount) ? supportCount : null,
    spacingMm: Number.isFinite(spacingMm) ? round(spacingMm) : null,
    supportPositionsMm,
    tributaryWidthsMm,
    governingTributaryWidthMm: Number.isFinite(governingTributaryWidthMm) ? round(governingTributaryWidthMm) : null,
    requiredPhysicalWidthMm: Number.isFinite(governingTributaryWidthMm) ? round(governingTributaryWidthMm) : null,
    governingSupportIndices,
    totalTributaryWidthMm,
    tributaryBalanceErrorMm: Number.isFinite(tributaryBalanceErrorMm) ? tributaryBalanceErrorMm : null,
    distributionConfirmed,
  };
}

function calculateWallLoad(rawInput = {}) {
  const requestedMaterialKey = rawInput.materialKey ?? DEFAULT_WALL_LOAD_INPUT.materialKey;
  const materialKey = Object.hasOwn(WALL_LOAD_PRESETS, requestedMaterialKey) ? requestedMaterialKey : 'custom';
  const preset = WALL_LOAD_PRESETS[materialKey];
  const hasLayoutInput = ['wallRunMm', 'layoutMethod', 'supportCount', 'maxSpacingMm', 'distributionConfirmed']
    .some((field) => rawInput[field] !== undefined);
  const layout = hasLayoutInput ? calculateWallSupportLayout(rawInput) : null;
  const tributaryWidthMm = layout
    ? (layout.governingTributaryWidthMm == null ? NaN : Number(layout.governingTributaryWidthMm))
    : valueOr(rawInput.tributaryWidthMm, DEFAULT_WALL_LOAD_INPUT.tributaryWidthMm);
  const input = {
    materialKey,
    materialLabel: preset.label,
    wallHeightM: valueOr(rawInput.wallHeightM, DEFAULT_WALL_LOAD_INPUT.wallHeightM),
    tributaryWidthMm,
    wallWeightKgM2: valueOr(rawInput.wallWeightKgM2, preset.wallWeightKgM2),
    finishWeightKgM2: valueOr(rawInput.finishWeightKgM2, preset.finishWeightKgM2),
    wallThicknessMm: valueOr(rawInput.wallThicknessMm, preset.wallThicknessMm ?? DEFAULT_WALL_LOAD_INPUT.wallThicknessMm),
    otherPermanentKg: valueOr(rawInput.otherPermanentKg, DEFAULT_WALL_LOAD_INPUT.otherPermanentKg),
    deadLoadFactor: valueOr(rawInput.deadLoadFactor, DEFAULT_WALL_LOAD_INPUT.deadLoadFactor),
    unitBasis: 'equivalent-gravity-load-kgf',
  };
  const errors = layout ? [...layout.errors] : [];
  const bounds = [
    ['wallHeightM', 0.3, 6, 'ความสูงผนังต้องอยู่ระหว่าง 0.30–6.00 m'],
    ['tributaryWidthMm', 150, 2000, 'ความกว้างช่วงออกแบบ b = Btrib ต้องอยู่ระหว่าง 150–2,000 mm'],
    ['wallWeightKgM2', 0.01, 2500, 'น้ำหนักผนังเทียบเท่าต้องมากกว่า 0 และไม่เกิน 2,500 kgf/m²'],
    ['finishWeightKgM2', 0, 1000, 'น้ำหนักปูน/ฉาบ/ตกแต่งเทียบเท่าต้องอยู่ระหว่าง 0–1,000 kgf/m²'],
    ['wallThicknessMm', 50, 450, 'ความหนาผนังต้องอยู่ระหว่าง 50–450 mm'],
    ['otherPermanentKg', 0, 100000, 'น้ำหนักถาวรอื่นต้องอยู่ระหว่าง 0–100,000 kgf ต่อช่วงออกแบบ'],
    ['deadLoadFactor', 1, 3, 'ตัวคูณน้ำหนักถาวรต้องอยู่ระหว่าง 1.00–3.00'],
  ];
  for (const [field, min, max, message] of bounds) {
    if (!Number.isFinite(input[field]) || input[field] < min || input[field] > max) {
      errors.push({ field, message });
    }
  }

  const areaM2 = input.wallHeightM * input.tributaryWidthMm / 1000;
  const totalWeightKgM2 = input.wallWeightKgM2 + input.finishWeightKgM2;
  const wallServiceKg = input.wallWeightKgM2 * areaM2;
  const finishServiceKg = input.finishWeightKgM2 * areaM2;
  const serviceKg = wallServiceKg + finishServiceKg + input.otherPermanentKg;
  const vuKg = serviceKg * input.deadLoadFactor;
  const supportServiceLoadsKg = layout
    ? layout.tributaryWidthsMm.map((widthMm) => round(
      totalWeightKgM2 * input.wallHeightM * widthMm / 1000 + input.otherPermanentKg
    ))
    : [round(serviceKg)];
  const supportFactoredLoadsKg = layout
    ? layout.tributaryWidthsMm.map((widthMm) => round(
      (totalWeightKgM2 * input.wallHeightM * widthMm / 1000 + input.otherPermanentKg) * input.deadLoadFactor
    ))
    : [round(vuKg)];
  const distributedServiceTotalKg = round(supportServiceLoadsKg.reduce((sum, loadKg) => sum + loadKg, 0));
  const expectedDistributedServiceTotalKg = layout
    ? round(totalWeightKgM2 * input.wallHeightM * layout.input.wallRunMm / 1000 + input.otherPermanentKg * layout.supportCount)
    : round(serviceKg);
  const layoutWithLoads = layout ? {
    ...layout,
    supportServiceLoadsKg,
    supportFactoredLoadsKg,
    distributedServiceTotalKg,
    distributedFactoredTotalKg: round(supportFactoredLoadsKg.reduce((sum, loadKg) => sum + loadKg, 0)),
    serviceLoadBalanceErrorKg: round(distributedServiceTotalKg - expectedDistributedServiceTotalKg),
  } : null;
  const overrideFields = materialKey === 'custom' ? [] : [
    Math.abs(input.wallWeightKgM2 - preset.wallWeightKgM2) > 0.049 ? 'wallWeightKgM2' : '',
    Math.abs(input.finishWeightKgM2 - preset.finishWeightKgM2) > 0.049 ? 'finishWeightKgM2' : '',
    Number.isFinite(preset.wallThicknessMm) && Math.abs(input.wallThicknessMm - preset.wallThicknessMm) > 0.49 ? 'wallThicknessMm' : '',
  ].filter(Boolean);
  const provenance = materialKey === 'custom' ? 'custom' : (overrideFields.length ? 'preset-overridden' : 'preset');
  return {
    ok: errors.length === 0,
    mode: 'wall',
    errors,
    input,
    preset,
    layout: layoutWithLoads,
    requiredPhysicalWidthMm: layoutWithLoads?.requiredPhysicalWidthMm ?? null,
    tributaryWidthProvenance: layout ? 'contiguous-strip-layout' : 'legacy-tributary-width',
    catalogVersion: WALL_LOAD_CATALOG_VERSION,
    loadBasis: THAI_DEAD_LOAD_BASIS,
    provenance,
    overridden: overrideFields.length > 0,
    overrideFields,
    areaM2: round(areaM2),
    totalWeightKgM2: round(totalWeightKgM2),
    wallServiceKg: round(wallServiceKg),
    finishServiceKg: round(finishServiceKg),
    serviceKg: round(serviceKg),
    vuKg: round(vuKg),
  };
}

function beta1(fcMpa) {
  if (fcMpa <= 28) return 0.85;
  return Math.max(0.65, 0.85 - 0.05 * ((fcMpa - 28) / 7));
}

function requiredFlexuralSteel({ muNmm, widthMm, depthMm, fcMpa, fyMpa }) {
  const a = PHI_CORBEL * fyMpa * fyMpa / (2 * 0.85 * fcMpa * widthMm);
  const b = -PHI_CORBEL * fyMpa * depthMm;
  const c = muNmm;
  const disc = b * b - 4 * a * c;
  if (!(disc >= 0) || !(a > 0)) return Infinity;
  return (-b - Math.sqrt(disc)) / (2 * a);
}

function flexuralCapacity({ steelMm2, widthMm, depthMm, fcMpa, fyMpa }) {
  if (!(steelMm2 > 0)) return 0;
  const blockMm = steelMm2 * fyMpa / (0.85 * fcMpa * widthMm);
  if (blockMm >= 2 * depthMm) return 0;
  return PHI_CORBEL * steelMm2 * fyMpa * (depthMm - blockMm / 2);
}

function flexuralSteelLimit({ widthMm, depthMm, fcMpa, fyMpa }) {
  const cLimit = depthMm * 0.003 / (0.003 + 0.004);
  const blockMm = beta1(fcMpa) * cLimit;
  return 0.85 * fcMpa * widthMm * blockMm / fyMpa;
}

function mainBarCandidates({ requiredMm2, widthMm, coverMm, frontAnchorZoneMm }) {
  const candidates = [];
  for (const diameterMm of MAIN_DIAMETERS) {
    for (let count = 2; count <= 8; count += 1) {
      const providedMm2 = count * area(diameterMm);
      const clearWidth = widthMm - 2 * coverMm - count * diameterMm;
      const clearSpacingMm = count > 1 ? clearWidth / (count - 1) : clearWidth;
      const minClearMm = Math.max(25, diameterMm);
      const fitsWidth = clearSpacingMm >= minClearMm;
      const anchorCenterFromTipMm = coverMm + diameterMm / 2;
      const requiredNoseSetbackMm = anchorCenterFromTipMm + 5;
      const anchorZoneFits = frontAnchorZoneMm + 1e-9 >= requiredNoseSetbackMm;
      if (providedMm2 + 1e-9 >= requiredMm2 && fitsWidth && anchorZoneFits) {
        candidates.push({
          label: `${count}-DB${diameterMm}`,
          count,
          diameterMm,
          providedMm2,
          clearSpacingMm,
          anchorCenterFromTipMm,
          requiredNoseSetbackMm,
        });
      }
    }
  }
  return candidates.sort((left, right) =>
    left.providedMm2 - right.providedMm2 || left.diameterMm - right.diameterMm || left.count - right.count
  );
}

function tieCandidates(requiredMm2) {
  const candidates = [];
  for (const diameterMm of TIE_DIAMETERS) {
    for (let count = 3; count <= 8; count += 1) {
      const providedMm2 = count * 2 * area(diameterMm);
      if (providedMm2 + 1e-9 >= requiredMm2) {
        candidates.push({ label: `${count}-RB${diameterMm}`, count, diameterMm, providedMm2 });
      }
    }
  }
  return candidates.sort((left, right) =>
    left.providedMm2 - right.providedMm2 || left.diameterMm - right.diameterMm || left.count - right.count
  );
}

function makeCheck(id, label, demand, capacity, clause, pass, note = '') {
  return {
    id,
    label,
    demand: round(demand),
    capacity: round(capacity),
    utilization: round(ratio(demand, capacity)),
    clause,
    status: pass ? 'pass' : 'fail',
    note,
  };
}

function designCorbel(rawInput = {}) {
  const base = { ...DEFAULT_CORBEL_INPUT, ...rawInput };
  const errors = [];
  const warnings = [];
  const input = {
    memberId: String(base.memberId || DEFAULT_CORBEL_INPUT.memberId).trim().slice(0, 40) || DEFAULT_CORBEL_INPUT.memberId,
    vuKg: valueOr(base.vuKg, NaN),
    widthMm: valueOr(base.widthMm, NaN),
    heightMm: valueOr(base.heightMm, NaN),
    tipHeightMm: valueOr(base.tipHeightMm, NaN),
    lengthMm: valueOr(base.lengthMm, NaN),
    depthMm: valueOr(base.depthMm, NaN),
    wallThicknessMm: valueOr(base.wallThicknessMm, NaN),
    noseSetbackMm: valueOr(base.noseSetbackMm, NaN),
    coverMm: valueOr(base.coverMm, NaN),
    fcMpa: valueOr(base.fcMpa, NaN),
    fyMpa: valueOr(base.fyMpa, NaN),
    lambda: valueOr(base.lambda, 1),
    surface: base.surface,
  };

  if (!Object.hasOwn(SURFACE_MU, input.surface)) {
    errors.push({ field: 'surface', message: 'ประเภทผิวรอยต่อไม่ถูกต้อง กรุณาเลือกใหม่' });
  }

  const bounds = [
    ['vuKg', input.vuKg, 1, 2_000_000, 'น้ำหนักออกแบบต้องมากกว่า 0 และไม่เกิน 2,000,000 kgf'],
    ['widthMm', input.widthMm, 150, 2000, 'ความกว้างจริงของหูช้าง b ต้องอยู่ระหว่าง 150–2,000 mm'],
    ['heightMm', input.heightMm, 250, 2500, 'ความสูง h ต้องอยู่ระหว่าง 250–2,500 mm'],
    ['tipHeightMm', input.tipHeightMm, 100, input.heightMm, 'ความสูงปลาย h₂ ต้องอยู่ระหว่าง 100 mm และไม่เกิน h'],
    ['lengthMm', input.lengthMm, 150, 2000, 'ระยะยื่น L ต้องอยู่ระหว่าง 150–2,000 mm'],
    ['depthMm', input.depthMm, 150, input.heightMm - 20, 'ความลึก d ต้องน้อยกว่า h และไม่น้อยกว่า 150 mm'],
    ['wallThicknessMm', input.wallThicknessMm, 50, input.lengthMm, 'ความหนาผนังต้องอยู่ภายในช่วงยื่นของหูช้าง'],
    ['noseSetbackMm', input.noseSetbackMm, 0, input.lengthMm, 'โซนยึดเหล็กที่ปลายต้องไม่เกินระยะยื่นของหูช้าง'],
    ['coverMm', input.coverMm, 25, Math.min(input.widthMm, input.tipHeightMm) / 3, 'ระยะหุ้มต้องอยู่ในช่วงที่จัดเหล็กได้'],
    ['fcMpa', input.fcMpa, 18, 70, "f'c ต้องอยู่ระหว่าง 18–70 MPa สำหรับฐานโครงการ วสท."],
    ['fyMpa', input.fyMpa, 280, 550, 'fy ต้องอยู่ระหว่าง 280–550 MPa'],
    ['lambda', input.lambda, 0.75, 1, 'ค่า λ ต้องอยู่ระหว่าง 0.75–1.00'],
  ];
  for (const [field, value, min, max, message] of bounds) {
    if (!Number.isFinite(value) || value < min || value > max) errors.push({ field, message });
  }
  if (errors.length) {
    return { ok: false, verdict: 'fail', input, errors, warnings, checks: [], code: CORBEL_CODE_BASIS };
  }

  const vuN = input.vuKg * KGF_TO_N;
  const nucN = Math.max(vuN * 0.2, valueOr(base.nucKg, 0) * KGF_TO_N);
  const avMm = input.lengthMm - input.wallThicknessMm / 2;
  if (!(avMm > 0)) {
    errors.push({ field: 'wallThicknessMm', message: 'ผนังที่วางชิดปลายต้องมีกึ่งกลางอยู่นอกหน้าคานและอยู่บนหูช้าง' });
    return { ok: false, verdict: 'fail', input, errors, warnings, checks: [], code: CORBEL_CODE_BASIS };
  }

  const muNmm = vuN * avMm + nucN * (input.heightMm - input.depthMm);
  const avOverD = avMm / input.depthMm;
  const nucOverVu = nucN / vuN;
  const mu = SURFACE_MU[input.surface] * input.lambda;
  const fyShearMpa = Math.min(input.fyMpa, 420);
  if (input.fyMpa > 420) warnings.push('กำลังครากที่ใช้กับ shear-friction ถูกจำกัดไว้ที่ 420 MPa');

  const anReqMm2 = nucN / (PHI_CORBEL * input.fyMpa);
  const avfReqMm2 = vuN / (PHI_CORBEL * mu * fyShearMpa);
  const afReqMm2 = requiredFlexuralSteel({
    muNmm,
    widthMm: input.widthMm,
    depthMm: input.depthMm,
    fcMpa: input.fcMpa,
    fyMpa: input.fyMpa,
  });
  const afLimitMm2 = flexuralSteelLimit(input);
  const asMinMm2 = 0.04 * (input.fcMpa / input.fyMpa) * input.widthMm * input.depthMm;
  const asReqMm2 = Math.max(afReqMm2 + anReqMm2, 2 * avfReqMm2 / 3 + anReqMm2, asMinMm2);
  const ahReqMm2 = Math.max(0, 0.5 * (asReqMm2 - anReqMm2));

  const main = mainBarCandidates({
    requiredMm2: asReqMm2,
    widthMm: input.widthMm,
    coverMm: input.coverMm,
    frontAnchorZoneMm: input.noseSetbackMm,
  })[0] || null;
  const ties = tieCandidates(ahReqMm2)[0] || null;

  const vnMaxStressMpa = Math.min(0.2 * input.fcMpa, 3.3 + 0.08 * input.fcMpa, 11);
  const phiVnMaxN = PHI_CORBEL * vnMaxStressMpa * input.widthMm * input.depthMm;
  const bearingAreaMm2 = input.widthMm * input.wallThicknessMm;
  const phiBearingN = PHI_BEARING * 0.85 * input.fcMpa * bearingAreaMm2;
  const bearingStressMpa = vuN / bearingAreaMm2;

  const mainProvidedMm2 = main?.providedMm2 || 0;
  const flexSteelProvidedMm2 = Math.max(0, mainProvidedMm2 - anReqMm2);
  const phiMnNmm = flexuralCapacity({
    steelMm2: flexSteelProvidedMm2,
    widthMm: input.widthMm,
    depthMm: input.depthMm,
    fcMpa: input.fcMpa,
    fyMpa: input.fyMpa,
  });
  const avfEffectiveMm2 = Math.max(0, 1.5 * (mainProvidedMm2 - anReqMm2));
  const phiVnFrictionN = PHI_CORBEL * mu * avfEffectiveMm2 * fyShearMpa;
  const phiVnN = Math.min(phiVnFrictionN, phiVnMaxN);
  const requiredNoseSetbackMm = main?.requiredNoseSetbackMm || Infinity;
  const supportHookAvailableMm = input.heightMm - 2 * input.coverMm;
  const supportHookNeededMm = main
    ? Math.max(150, 8 * main.diameterMm, 0.24 * input.fyMpa * main.diameterMm / (input.lambda * Math.sqrt(input.fcMpa)))
    : Infinity;

  const checks = [
    makeCheck('scope-avd', 'ขอบเขต aᵥ/d', avOverD, 1, '16.5.1.1', avOverD <= 1),
    makeCheck('scope-nv', 'ขอบเขต Nᵤ/Vᵤ', nucOverVu, 1, '16.5.1.1', nucOverVu <= 1),
    makeCheck('tip-depth', 'ความสูงปลายไม่น้อยกว่า 0.5d', 0.5 * input.depthMm, input.tipHeightMm, '16.5.2.3', input.tipHeightMm + 1e-9 >= 0.5 * input.depthMm),
    makeCheck('shear-ceiling', 'เพดานกำลังเฉือนของหน้าตัด', vuN, phiVnMaxN, '16.5.2.4', vuN <= phiVnMaxN),
    makeCheck('shear-friction', 'กำลัง shear-friction จากเหล็กหลัก', vuN, phiVnN, '16.5.4.4 / 22.9', !!main && vuN <= phiVnN),
    makeCheck('flexure', 'กำลังดัดที่หน้าคาน', muNmm, phiMnNmm, '16.5.4.5 / 22.2', afReqMm2 <= afLimitMm2 && !!main && muNmm <= phiMnNmm),
    makeCheck('primary-steel', 'พื้นที่เหล็กหลัก Aₛ', asReqMm2, mainProvidedMm2, '16.5.5.1', !!main && mainProvidedMm2 >= asReqMm2),
    makeCheck('closed-ties', 'พื้นที่ปลอกปิดแนวนอน Aₕ', ahReqMm2, ties?.providedMm2 || 0, '16.5.5.2', !!ties && ties.providedMm2 >= ahReqMm2, '2 ขา/ชุดขนาน Aₛ · กระจายสม่ำเสมอภายใน 2d/3'),
    makeCheck('bearing', 'กำลังรับแรงกดบนคอนกรีตหูช้าง (สัมผัสเต็มตามนาม)', vuN, phiBearingN, 'ACI 22.8 CROSS-CHECK', vuN <= phiBearingN, `qᵤ = ${round(bearingStressMpa, 3)} MPa · สมมติ b × t_wall เต็มพื้นที่ · ไม่รวมก่ออิฐ/เยื้องศูนย์/tolerance`),
    makeCheck('nose-anchor', 'พื้นที่ว่างเชิงเรขาคณิตที่ปลายเหล็ก', requiredNoseSetbackMm, input.noseSetbackMm, 'SCHEMATIC GEOMETRY', !!main && input.noseSetbackMm + 1e-9 >= requiredNoseSetbackMm, 'ไม่ใช่การยืนยันกำลัง anchorage; ต้องมีวิธีและรายการตรวจจากวิศวกร'),
    makeCheck('support-anchor', 'พื้นที่ว่างเบื้องต้นสำหรับหางงอ', supportHookNeededMm, supportHookAvailableMm, 'PRELIMINARY ASSUMPTION', !!main && supportHookAvailableMm >= supportHookNeededMm, 'ใช้ h ของหูช้างเป็นเพียง screening; ต้องตรวจจากขนาดคานจริง cover confinement และวิธีพัฒนาเหล็ก'),
  ];

  const failed = checks.filter((check) => check.status === 'fail');
  if (!main) warnings.push('ไม่มีชุดเหล็กหลักมาตรฐานที่ให้พื้นที่เพียงพอ วางได้ในหน้ากว้าง และรักษาจุดยึดปลาย');
  if (!ties) warnings.push('ไม่มีชุดปลอกปิดแนวนอนมาตรฐานที่ให้พื้นที่เพียงพอ');
  warnings.push('การตรวจระยะพัฒนาใช้สมมติฐานเหล็กไม่เคลือบและ standard hook หากรายละเอียดจริงต่างออกไปต้องคำนวณใหม่');
  warnings.push('ผล local PASS เป็น ACI-family cross-check เบื้องต้น ไม่ใช่การรับรองตาม วสท. หรืออนุญาตก่อสร้าง');
  warnings.push('ต้องตรวจคานรองรับ เสถียรภาพผนัง load envelope bearing tolerance และ anchorage จากรายละเอียดจริง');

  const utilization = checks.reduce((max, check) => Number.isFinite(check.utilization) ? Math.max(max, check.utilization) : Infinity, 0);
  const verdict = failed.length ? 'fail' : 'pass';
  const recommendations = failed.map((check) => {
    if (check.id === 'scope-avd') return 'เพิ่มความลึก d หรือลดระยะยื่น/ระยะถึงแนวแรง แล้วคำนวณใหม่';
    if (check.id === 'tip-depth') return `เพิ่ม h₂ เป็นอย่างน้อย ${Math.ceil(0.5 * input.depthMm / 10) * 10} mm`;
    if (check.id === 'nose-anchor') return 'เพิ่มโซนยึดเหล็กภายในปลายหูช้างหรือใช้รายละเอียด anchor bar ที่วิศวกรตรวจรับ';
    if (check.id === 'support-anchor') return 'เพิ่มพื้นที่สำหรับหางงอหรือใช้รายละเอียดพัฒนาเหล็กทางเลือกที่ตรวจรับแล้ว';
    if (check.id === 'bearing') return 'เพิ่มความกว้างจริงของหูช้าง b หรือความยาวพื้นที่รองรับผนัง';
    return 'เพิ่มขนาดหน้าตัด/กำลังวัสดุ หรือแก้รายละเอียดเหล็กแล้วคำนวณใหม่';
  });

  return {
    ok: verdict === 'pass',
    verdict,
    input,
    errors,
    warnings,
    recommendations: [...new Set(recommendations)],
    code: CORBEL_CODE_BASIS,
    demand: {
      vuN: round(vuN),
      vuKg: round(input.vuKg),
      nucN: round(nucN),
      nucKg: round(nucN / KGF_TO_N),
      avMm: round(avMm),
      muNmm: round(muNmm),
      muKgm: round(muNmm / KGF_TO_N / 1000),
      avOverD: round(avOverD),
      nucOverVu: round(nucOverVu),
    },
    required: {
      anMm2: round(anReqMm2),
      avfMm2: round(avfReqMm2),
      afMm2: round(afReqMm2),
      afLimitMm2: round(afLimitMm2),
      asMinMm2: round(asMinMm2),
      asMm2: round(asReqMm2),
      ahMm2: round(ahReqMm2),
    },
    provided: {
      main,
      ties,
      phiVnN: round(phiVnN),
      phiVnMaxN: round(phiVnMaxN),
      phiMnNmm: round(phiMnNmm),
      phiBearingN: round(phiBearingN),
      bearingStressMpa: round(bearingStressMpa),
      mu: round(mu),
      fyShearMpa: round(fyShearMpa),
    },
    checks,
    utilization: round(utilization),
  };
}

function verdictLabel(verdict) {
  if (verdict === 'pass') return 'PASS';
  if (verdict === 'fail') return 'FAIL';
  return 'รอตรวจ';
}

global.CorbelDesign = Object.freeze({
  CORBEL_CODE_BASIS,
  DEFAULT_CORBEL_INPUT,
  WALL_LOAD_PRESETS,
  WALL_LOAD_CATALOG_VERSION,
  THAI_DEAD_LOAD_BASIS,
  DEFAULT_WALL_LOAD_INPUT,
  WALL_LAYOUT_LIMITS,
  calculateWallSupportLayout,
  calculateWallLoad,
  designCorbel,
  verdictLabel,
  KGF_TO_N,
});
})(globalThis);
