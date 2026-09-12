/**
 * StructVault Spread Footing pure calculation engine.
 *
 * Engineering boundary:
 * - R1 supports a centered interior rectangular column on an isolated
 *   rectangular footing with full service contact.
 * - Canonical calculation units are m, mm, kN, kN.m, kPa, MPa, and mm2/m.
 * - Individual evaluated equations may be PASS/FAIL. The overall state is
 *   always ENGINEERING REVIEW REQUIRED.
 * - Drawing, Bar Cut, BBS, and construction authorization always remain HOLD.
 */

const KGF_TO_KN = 0.00980665;
const KSC_TO_MPA = 0.0980665;
const TONF_PER_M2_TO_KPA = 9.80665;
const EPSILON = 1e-9;
const GEOMETRY_TOLERANCE_M = 1e-6;
const OFFICIAL_ACI_URL = 'https://www.concrete.org/store/productdetail.aspx?ItemID=318U19&Language=English&Units=US_and_Metric';
const OFFICIAL_ACI_CODE_TITLE = 'ACI CODE-318-19(22), Building Code Requirements for Structural Concrete and Commentary';
const OFFICIAL_ACI_PREVIEW_URL = 'https://www.concrete.org/Portals/0/Files/PDF/Previews/318-19_preview.pdf';
const OFFICIAL_ACI_CHANGES_URL = 'https://www.concrete.org/Portals/0/Files/PDF/CI4108Moehle.pdf';
const OFFICIAL_ACI_FOOTING_EXAMPLE_URL = 'https://www.concrete.org/Portals/0/Files/PDF/318-Example-1_RF_R1.pdf';
const OFFICIAL_ACI_MNL17_PREVIEW_URL = 'https://www.concrete.org/Portals/0/Files/PDF/Previews/MNL-17%2821%29_V1_preview.pdf';
const OFFICIAL_ACI_SP353_FOOTING_PUNCHING_URL = 'https://www.concrete.org/publications/internationalconcreteabstractsportal.aspx?id=51737111&m=details';
const OFFICIAL_THAI_MR_URL = 'https://ratchakitcha.soc.go.th/documents/140A054N0000000000400.pdf';
const ACI_D_L_PROFILE_ID = 'SF-SDM-ACI31819-DL-R1';

export function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export const SPREAD_FOOTING_AUTO_DESIGN_POLICY = deepFreeze({
  policyId: 'SF-AUTO-UPSIZE-R1',
  mode: 'AUTO_UPSIZE',
  planIncrementM: 0.05,
  thicknessIncrementM: 0.05,
  maximumPlanGrowthM: 5,
  maximumThicknessGrowthM: 2,
  maximumSpacingMm: 450,
  minimumClearSpacingWithoutAggregateMm: 25,
  barDiametersMm: [12, 16, 20, 25, 28, 32],
  searchBoundary: 'Centered axial-load R1 only; entered plan and thickness are minimum starting dimensions and are never reduced.',
  optimizationBoundary: 'Deterministic first-adequate catalog selection; not a cost, carbon, fabrication, or construction optimization.',
});

export const SPREAD_FOOTING_LOAD_COMBINATIONS = deepFreeze({
  TH_MR_2566_C7_1_4D_1_7L: {
    id: 'TH_MR_2566_C7_1_4D_1_7L',
    gammaD: 1.4,
    gammaL: 1.7,
    equation: 'U = 1.4D + 1.7L',
    normativeEquation: 'นป. = 1.4นค. + 1.7นจ.',
    applicability: 'แทน U = นป., D = นค. และ L = นจ.; นจ. ต้องรวมแรงกระแทกตามนิยามกฎกระทรวงก่อนส่งเข้า Engine',
    standard: 'Thai Ministerial Regulation B.E. 2566',
    edition: 'B.E. 2566',
    clause: 'Article 7(1)',
    sourceUrl: OFFICIAL_THAI_MR_URL,
    sourceTitle: 'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคารและลักษณะและคุณสมบัติของวัสดุที่ใช้ในงานโครงสร้างอาคาร พ.ศ. 2566',
    memberStrengthBoundary: 'สูตรกำลังชิ้นส่วนอ้างอิง ACI 318-19 โปรไฟล์ผสมนี้ยังไม่ใช่คำรับรองมาตรฐานโครงการหรือการอนุมัติโดยวิศวกรผู้รับผิดชอบ',
  },
  ACI_318_19_1_2D_1_6L: {
    id: 'ACI_318_19_1_2D_1_6L',
    gammaD: 1.2,
    gammaL: 1.6,
    equation: 'U = 1.2D + 1.6L',
    normativeEquation: 'U = 1.2D + 1.6L + 0.5(Lr or S or R)',
    applicability: 'โปรไฟล์ R1 ใช้ได้เฉพาะเมื่อผู้รับผิดชอบยืนยันว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้; หากมี ต้องใช้โปรไฟล์ที่รองรับก่อนคำนวณ',
    standard: 'ACI 318',
    edition: '318-19',
    clause: 'Table 5.3.1(b)',
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: OFFICIAL_ACI_CODE_TITLE,
    memberStrengthBoundary: 'รองรับเฉพาะกรณีตรวจ D + L มาตรฐานชุดน้ำหนักหลักของโครงการยังต้องได้รับการยืนยันจากเจ้าของงานหรือวิศวกรผู้รับผิดชอบ',
  },
});

export const SPREAD_FOOTING_ENGINE_PROFILE = deepFreeze({
  profileId: 'SF-SDM-ACI19-R1',
  strategyId: 'SF-SDM-ACI19-R1',
  engineId: 'structvault.spread-footing',
  engineVersion: '1.1.2-review',
  snapshotSchema: 'spread-footing-snapshot-v2',
  member: 'isolated rectangular spread footing',
  support: 'centered interior rectangular column',
  concrete: 'normalweight, nonprestressed',
  shearReinforcement: 'none',
  contact: 'full rectangular contact only',
  phiFlexure: 0.9,
  phiShear: 0.75,
  epsilonCu: 0.003,
  steelModulusMPa: 200000,
  lambda: 1,
  lambdaS: 1,
  alphaSInterior: 40,
  minimumReinforcementRatio: 0.0018,
  minimumEffectiveDepthMm: 150,
  barDiametersMm: [12, 16, 20, 25, 28, 32],
  validatedRanges: {
    fcMPa: [17, 600 * KSC_TO_MPA],
    fyMPa: [2400 * KSC_TO_MPA, 6000 * KSC_TO_MPA],
    concreteUnitWeightKNPerM3: [2200 * KGF_TO_KN, 2600 * KGF_TO_KN],
    soilUnitWeightKNPerM3: [1000 * KGF_TO_KN, 2500 * KGF_TO_KN],
  },
  overallStatus: 'ENGINEERING REVIEW REQUIRED',
  constructionAuthorization: 'HOLD_OWNER_PE',
});

const DESIGN_STANDARD_PROFILE_MANIFEST_VERSION = 'SF-DESIGN-STANDARD-PROFILES-R4.5-20260801';
const DESIGN_STANDARD_DISABLED_STATE = 'ยังไม่เปิดใช้ · รอตรวจข้อกำหนดฉบับเต็ม';

function executableDesignStandardProfile({
  profileId,
  displayLabel,
  loadCombinationId,
  loadStandardLabel,
  edition,
  scope,
  sources,
}) {
  return {
    profileId,
    strategyId: SPREAD_FOOTING_ENGINE_PROFILE.strategyId,
    method: 'วิธีกำลัง · รุ่นตรวจการคำนวณ',
    displayLabel,
    memberStandard: {
      standard: 'ACI 318',
      edition: '318-19',
      displayLabel: 'ACI 318-19 · สูตรกำลังชิ้นส่วน',
    },
    loadStandard: {
      standard: SPREAD_FOOTING_LOAD_COMBINATIONS[loadCombinationId].standard,
      edition: SPREAD_FOOTING_LOAD_COMBINATIONS[loadCombinationId].edition,
      displayLabel: loadStandardLabel,
    },
    edition,
    scope,
    compatibleLoadCombinationIds: [loadCombinationId],
    allowedCombinationIds: [loadCombinationId],
    phiFlexure: SPREAD_FOOTING_ENGINE_PROFILE.phiFlexure,
    phiShear: SPREAD_FOOTING_ENGINE_PROFILE.phiShear,
    beta1Policy: {
      policyId: 'ACI31819-22.2.2.4.3-BETA1',
      standard: 'ACI 318-19',
      clause: 'Section 22.2.2.4.3',
      minimum: 0.65,
      maximum: 0.85,
    },
    minimumReinforcementPolicy: {
      policyId: 'ACI31819-13.3.3.1-8.6.1.1-ASMIN',
      standard: 'ACI 318-19',
      clauses: ['Section 13.3.3.1', 'Section 8.6.1.1'],
      ratio: SPREAD_FOOTING_ENGINE_PROFILE.minimumReinforcementRatio,
    },
    materialLimits: {
      ...SPREAD_FOOTING_ENGINE_PROFILE.validatedRanges,
      minimumEffectiveDepthMm: SPREAD_FOOTING_ENGINE_PROFILE.minimumEffectiveDepthMm,
      barDiametersMm: SPREAD_FOOTING_ENGINE_PROFILE.barDiametersMm,
    },
    sourceRegisterVersion: DESIGN_STANDARD_PROFILE_MANIFEST_VERSION,
    sources,
    verificationStatus: 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW',
    enabled: true,
    complianceClaim: false,
  };
}

function disabledDesignStandardCandidate({
  profileId,
  displayLabel,
  memberStandard,
  memberEdition,
  loadStandard,
  loadEdition,
  edition,
  scope,
  sources,
  researchStatus,
  activationRequirements,
}) {
  return {
    profileId,
    strategyId: null,
    method: null,
    displayLabel,
    memberStandard: {
      standard: memberStandard,
      edition: memberEdition,
      displayLabel: memberStandard,
    },
    loadStandard: {
      standard: loadStandard,
      edition: loadEdition,
      displayLabel: loadStandard,
    },
    edition,
    scope,
    compatibleLoadCombinationIds: [],
    allowedCombinationIds: [],
    phiFlexure: null,
    phiShear: null,
    beta1Policy: null,
    minimumReinforcementPolicy: null,
    materialLimits: null,
    sourceRegisterVersion: DESIGN_STANDARD_PROFILE_MANIFEST_VERSION,
    sources,
    researchStatus,
    activationRequirements,
    verificationStatus: 'DISABLED_PENDING_NORMATIVE_CLAUSE_MAP',
    enabled: false,
    disabledState: DESIGN_STANDARD_DISABLED_STATE,
    complianceClaim: false,
  };
}

export const SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY = deepFreeze({
  'SF-SDM-THMR2566-ACI31819-HYBRID-R1': executableDesignStandardProfile({
    profileId: 'SF-SDM-THMR2566-ACI31819-HYBRID-R1',
    displayLabel: 'กฎกระทรวง 2566 · 1.4D+1.7L · ACI 318-19',
    loadCombinationId: 'TH_MR_2566_C7_1_4D_1_7L',
    loadStandardLabel: 'กฎกระทรวง พ.ศ. 2566 · ข้อ 7(1) · U = 1.4D + 1.7L',
    edition: 'Thai Ministerial Regulation B.E. 2566 + ACI 318-19',
    scope: 'ใช้ชุดน้ำหนักเฉพาะ D+L ตามกฎกระทรวง พ.ศ. 2566 ข้อ 7(1) ร่วมกับสูตรกำลังชิ้นส่วน ACI 318-19 รุ่น R1 ยังไม่ใช่คำรับรองว่าครบข้อกำหนดไทยหรือ วสท. ทั้งฉบับ',
    sources: [
      {
        role: 'load-standard',
        standard: 'Thai Ministerial Regulation B.E. 2566',
        clause: 'Article 7(1)',
        sourceUrl: OFFICIAL_THAI_MR_URL,
        sourceTitle: SPREAD_FOOTING_LOAD_COMBINATIONS.TH_MR_2566_C7_1_4D_1_7L.sourceTitle,
      },
      {
        role: 'member-resistance',
        standard: 'ACI 318-19',
        clause: 'R1 footing resistance clauses recorded by each Snapshot equation',
        sourceUrl: OFFICIAL_ACI_URL,
        sourceTitle: OFFICIAL_ACI_CODE_TITLE,
      },
      {
        role: 'minimum-effective-depth',
        standard: 'ACI 318-19',
        clause: 'Section 13.3.1.2',
        sourceUrl: OFFICIAL_ACI_URL,
        sourceTitle: 'ACI CODE-318-19(22) · effective depth of bottom reinforcement in foundations',
      },
    ],
  }),
  'SF-SDM-ACI31819-DL-R1': executableDesignStandardProfile({
    profileId: 'SF-SDM-ACI31819-DL-R1',
    displayLabel: 'ACI 318-19 · 1.2D + 1.6L',
    loadCombinationId: 'ACI_318_19_1_2D_1_6L',
    loadStandardLabel: 'ACI 318-19 · Table 5.3.1(b) · U = 1.2D + 1.6L',
    edition: 'ACI 318-19',
    scope: 'ใช้ Table 5.3.1(b) เฉพาะ D+L เมื่อผู้รับผิดชอบยืนยันว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้ และใช้สูตรกำลังชิ้นส่วน ACI 318-19 รุ่น R1 ยังไม่ใช่คำรับรองว่าครบมาตรฐานของโครงการ',
    sources: [
      {
        role: 'load-standard',
        standard: 'ACI 318-19',
        clause: 'Table 5.3.1(b)',
        sourceUrl: OFFICIAL_ACI_URL,
        sourceTitle: SPREAD_FOOTING_LOAD_COMBINATIONS.ACI_318_19_1_2D_1_6L.sourceTitle,
      },
      {
        role: 'member-resistance',
        standard: 'ACI 318-19',
        clause: 'R1 footing resistance clauses recorded by each Snapshot equation',
        sourceUrl: OFFICIAL_ACI_URL,
        sourceTitle: OFFICIAL_ACI_CODE_TITLE,
      },
      {
        role: 'minimum-effective-depth',
        standard: 'ACI 318-19',
        clause: 'Section 13.3.1.2',
        sourceUrl: OFFICIAL_ACI_URL,
        sourceTitle: 'ACI CODE-318-19(22) · effective depth of bottom reinforcement in foundations',
      },
    ],
  }),
  'SF-CANDIDATE-EIT01100821-STRENGTH': disabledDesignStandardCandidate({
    profileId: 'SF-CANDIDATE-EIT01100821-STRENGTH',
    displayLabel: 'วสท. 011008-21 · วิธีกำลัง',
    memberStandard: 'วสท. 011008-21',
    memberEdition: '011008-21',
    loadStandard: 'รอตรวจข้อกำหนดฉบับเต็ม',
    loadEdition: 'PENDING',
    edition: '011008-21',
    scope: 'วสท. ระบุว่าใช้วิธีกำลังและยึดแนว ACI 318-11 เป็นหลัก พร้อมบทที่ 15 ฐาน แต่ Engine R1 ปัจจุบันใช้สมการ ACI 318-19 จึงห้ามใช้แทนกันจน map ข้อกำหนดฐานรากครบ',
    researchStatus: 'ตรวจหน้าเอกสารทางการและตัวอย่างสารบัญแล้ว · ยังไม่มีเนื้อหาข้อกำหนดฉบับเต็มในทะเบียน Engine',
    activationRequirements: [
      'ข้อกำหนดฉบับเต็ม: บท 9, 11, 12 และ 15',
      'ชุดน้ำหนักและแฟกเตอร์ลดกำลังที่ใช้กับฐานราก',
      'สมการดัด เฉือนทางเดียว เฉือนทะลุ และเหล็กขั้นต่ำ',
      'golden cases เทียบตัวอย่างที่ตรวจย้อนกลับได้',
    ],
    sources: [
      {
        role: 'official-catalog',
        standard: 'วสท. 011008-21',
        clause: 'ขอบเขตและข้อมูลฉบับ',
        sourceUrl: 'https://www.eit.or.th/order/book/view/173',
        sourceTitle: 'มาตรฐานสำหรับอาคารคอนกรีตเสริมเหล็ก โดยวิธีกำลัง พ.ศ. 2564',
      },
      {
        role: 'official-sample',
        standard: 'วสท. 011008-21',
        clause: 'สารบัญ · บทที่ 15 ฐาน',
        sourceUrl: 'https://www.eit.or.th/api/public/file/book/173',
        sourceTitle: 'ตัวอย่างเอกสารทางการจากวิศวกรรมสถานแห่งประเทศไทย',
      },
    ],
  }),
  'SF-CANDIDATE-EIT01100719-ASD': disabledDesignStandardCandidate({
    profileId: 'SF-CANDIDATE-EIT01100719-ASD',
    displayLabel: 'วสท. 011007-19 · วิธีหน่วยแรงใช้งาน',
    memberStandard: 'วสท. 011007-19',
    memberEdition: '011007-19',
    loadStandard: 'รอตรวจข้อกำหนดฉบับเต็ม',
    loadEdition: 'PENDING',
    edition: '011007-19',
    scope: 'หน้าแหล่งทางการยืนยันชื่อและฉบับวิธีหน่วยแรงใช้งาน แต่ยังไม่มีสมการฐานราก ค่าหน่วยแรงยอมให้ และชุดน้ำหนักฉบับเต็มในทะเบียน Engine จึงยังคำนวณไม่ได้',
    researchStatus: 'ยืนยันรหัสมาตรฐานและ ISBN จากบัญชีหนังสือ วสท. แล้ว · รอเอกสารข้อกำหนดฉบับเต็ม',
    activationRequirements: [
      'ข้อกำหนด WSD ฉบับเต็มสำหรับฐานราก',
      'หน่วยแรงยอมให้ของคอนกรีตและเหล็ก',
      'bearing, flexure, one-way shear และ punching แบบ WSD',
      'service-load combination และ golden cases',
    ],
    sources: [
      {
        role: 'official-catalog',
        standard: 'วสท. 011007-19',
        clause: 'บัญชีมาตรฐานหมวดวิศวกรรมโยธา',
        sourceUrl: 'https://eit.or.th/showcase/EIT/issue2_68/files/basic-html/page80.html',
        sourceTitle: 'บัญชีหนังสือ วสท. · ISBN 978-616-396-023-8',
      },
    ],
  }),
  'SF-CANDIDATE-ACI31825-ASCE722': disabledDesignStandardCandidate({
    profileId: 'SF-CANDIDATE-ACI31825-ASCE722',
    displayLabel: 'ACI 318-25 + ASCE 7-22',
    memberStandard: 'ACI 318-25',
    memberEdition: '318-25',
    loadStandard: 'ASCE 7-22',
    loadEdition: '7-22',
    edition: 'ACI 318-25 + ASCE 7-22',
    scope: 'เอกสารทางการยืนยันว่า ACI 318-25 และ ASCE 7-22 เป็นฉบับปัจจุบัน แต่มีการแก้ข้อกำหนดจาก ACI 318-19 และชุดโหลดครอบคลุมหลาย hazard จึงห้าม reuse Engine R1 เดิมโดยเปลี่ยนเพียงชื่อ',
    researchStatus: 'ตรวจ ACI 318 Building Code Portal และ ASCE 7-22 official portal แล้ว · รอ normative clauses และ golden verification',
    activationRequirements: [
      'ACI 318-25 footing/flexure/one-way/punching clause map',
      'ASCE 7-22 Chapter 2 combinations และขอบเขต D+L',
      'ค่าคงที่ วัสดุ φ และ minimum reinforcement ที่เปลี่ยน',
      'golden cases เทียบ ACI/ASCE ฉบับ 2025/2022',
    ],
    sources: [
      {
        role: 'member-resistance',
        standard: 'ACI CODE-318-25',
        clause: 'official code portal',
        sourceUrl: 'https://www.concrete.org/topicsinconcrete/318buildingcodeportal.aspx',
        sourceTitle: 'ACI 318 Building Code Portal · ACI CODE-318-25',
      },
      {
        role: 'load-standard',
        standard: 'ASCE/SEI 7-22',
        clause: 'Combination Loads',
        sourceUrl: 'https://www.asce.org/publications-and-news/codes-and-standards/asce-sei-7-22',
        sourceTitle: 'Minimum Design Loads and Associated Criteria for Buildings and Other Structures',
      },
    ],
  }),
});

export const SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST = deepFreeze(
  Object.values(SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY),
);

const PROFILE_ID_BY_COMBINATION_ID = deepFreeze({
  TH_MR_2566_C7_1_4D_1_7L: 'SF-SDM-THMR2566-ACI31819-HYBRID-R1',
  ACI_318_19_1_2D_1_6L: 'SF-SDM-ACI31819-DL-R1',
});

function inferDesignStandardProfileId(combinationId) {
  return PROFILE_ID_BY_COMBINATION_ID[combinationId] || null;
}

function requestedDesignStandardProfile(source) {
  const canonical = normalizedString(firstDefined(
    source?.designStandardProfileId,
    source?.basis?.designStandardProfileId,
  ));
  const legacy = normalizedString(firstDefined(
    source?.basisProfile,
    source?.basis?.profileId,
  ));
  return { canonical, legacy, requested: canonical || legacy };
}

/**
 * Resolves only enabled executable profiles. A missing profile maps
 * deterministically from the load combination. Any explicitly supplied legacy,
 * disabled, unknown, or cross-profile pair returns null.
 */
export function resolveSpreadFootingDesignStandardProfile(profileOrDraft, combinationId) {
  let requested = '';
  let resolvedCombinationId = normalizedString(combinationId);
  if (profileOrDraft && typeof profileOrDraft === 'object') {
    const source = profileOrDraft?.input && !profileOrDraft.project && !profileOrDraft.materials && !profileOrDraft.loads
      ? profileOrDraft.input
      : profileOrDraft;
    requested = requestedDesignStandardProfile(source).requested;
    resolvedCombinationId = normalizedString(firstDefined(
      combinationId,
      source?.combination,
      source?.combinationId,
      source?.basis?.combinationId,
      source?.loads?.combinationId,
    ));
  } else {
    requested = normalizedString(profileOrDraft);
  }
  const resolvedProfileId = !requested
    ? inferDesignStandardProfileId(resolvedCombinationId)
    : requested;
  const profile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[resolvedProfileId];
  if (!profile?.enabled) return null;
  if (resolvedCombinationId && !profile.allowedCombinationIds.includes(resolvedCombinationId)) return null;
  return profile;
}

export const DEFAULT_SPREAD_FOOTING_DRAFT = deepFreeze({
  projectName: 'งานตัวอย่างฐานรากแผ่',
  projectOwner: 'ข้อมูลตัวอย่างจากเจ้าของ',
  projectLocation: 'ระบุสถานที่ก่อนออกเอกสารจริง',
  memberMark: 'F-01',
  calculationNumber: 'SF-CALC-001',
  drawingNumber: 'รอกำหนด · ตัวอย่าง',
  revision: 'R09',
  preparedBy: 'นายช่างใหญ่ Civil Apps',
  checkedBy: 'รอผู้ตรวจสอบ',
  approvedBy: 'รอเจ้าของ / PE',
  documentDate: '29 ก.ค. 2026',
  designMode: 'MANUAL_CHECK',
  supportType: 'interior',
  fc: 240,
  fy: 4000,
  concreteWeight: 2400,
  phiFlexure: 0.9,
  phiShear: 0.75,
  deadLoad: 10000,
  liveLoad: 5000,
  mx: 0,
  my: 0,
  designStandardProfileId: 'SF-SDM-THMR2566-ACI31819-HYBRID-R1',
  combination: 'TH_MR_2566_C7_1_4D_1_7L',
  loadApplicabilityConfirmed: false,
  soilWeight: 1800,
  sbc: 10,
  sbcBasis: 'gross',
  sbcSource: 'รอระบุรายงานสำรวจดิน / ผู้รับรองค่า SBC',
  foundationTop: 0.7,
  foundationDepth: 1,
  columnX: 25,
  columnY: 25,
  footingX: 1.5,
  footingY: 1.5,
  thickness: 30,
  cover: 5,
  barsA: 8,
  barDiaA: 'DB16',
  barsB: 8,
  barDiaB: 'DB16',
});

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function finiteNumber(value, fallback = Number.NaN) {
  const candidate = firstDefined(value, fallback);
  const number = Number(candidate);
  return Number.isFinite(number) ? (Object.is(number, -0) ? 0 : number) : Number.NaN;
}

function finiteCanonicalOrDisplay(canonicalValue, displayValue, conversion, fallbackDisplay) {
  if (canonicalValue !== undefined && canonicalValue !== null && canonicalValue !== '') {
    return finiteNumber(canonicalValue);
  }
  return finiteNumber(firstDefined(displayValue, fallbackDisplay)) * conversion;
}

function normalizedString(value, fallback = '') {
  return String(firstDefined(value, fallback) ?? '').trim();
}

function normalizedBoolean(value, fallback = false) {
  const candidate = firstDefined(value, fallback);
  if (typeof candidate === 'boolean') return candidate;
  if (typeof candidate === 'number') return candidate === 1;
  return ['1', 'true', 'on', 'yes'].includes(String(candidate ?? '').trim().toLowerCase());
}

function normalizeBarDiameter(value, fallback) {
  const raw = firstDefined(value, fallback);
  if (typeof raw === 'string') {
    const match = raw.trim().toUpperCase().match(/^DB\s*(\d+(?:\.\d+)?)$/);
    if (match) return finiteNumber(match[1]);
  }
  return finiteNumber(raw);
}

function beta1FromFcMPa(fcMPa) {
  if (!Number.isFinite(fcMPa)) return Number.NaN;
  if (fcMPa <= 28) return 0.85;
  if (fcMPa >= 55) return 0.65;
  return Math.max(0.65, 0.85 - 0.05 * ((fcMPa - 28) / 7));
}

function normalizeProject(draft) {
  const project = draft.project || draft.input?.project || {};
  return {
    projectName: normalizedString(firstDefined(draft.projectName, project.projectName, project.name), DEFAULT_SPREAD_FOOTING_DRAFT.projectName),
    projectOwner: normalizedString(firstDefined(draft.projectOwner, project.projectOwner, project.owner), DEFAULT_SPREAD_FOOTING_DRAFT.projectOwner),
    projectLocation: normalizedString(firstDefined(draft.projectLocation, project.projectLocation, project.location), DEFAULT_SPREAD_FOOTING_DRAFT.projectLocation),
    memberMark: normalizedString(firstDefined(draft.memberMark, project.memberMark, project.mark), DEFAULT_SPREAD_FOOTING_DRAFT.memberMark),
    calculationNumber: normalizedString(firstDefined(draft.calculationNumber, project.calculationNumber), DEFAULT_SPREAD_FOOTING_DRAFT.calculationNumber),
    drawingNumber: normalizedString(firstDefined(draft.drawingNumber, project.drawingNumber), DEFAULT_SPREAD_FOOTING_DRAFT.drawingNumber),
    revision: normalizedString(firstDefined(draft.revision, project.revision), DEFAULT_SPREAD_FOOTING_DRAFT.revision),
    preparedBy: normalizedString(firstDefined(draft.preparedBy, project.preparedBy), DEFAULT_SPREAD_FOOTING_DRAFT.preparedBy),
    checkedBy: normalizedString(firstDefined(draft.checkedBy, project.checkedBy), DEFAULT_SPREAD_FOOTING_DRAFT.checkedBy),
    approvedBy: normalizedString(firstDefined(draft.approvedBy, project.approvedBy), DEFAULT_SPREAD_FOOTING_DRAFT.approvedBy),
    documentDate: normalizedString(firstDefined(draft.documentDate, project.documentDate), DEFAULT_SPREAD_FOOTING_DRAFT.documentDate),
  };
}

function normalizeDesignIntent(source) {
  const designIntent = source.designIntent || {};
  const requested = designIntent.requested || {};
  const mode = normalizedString(
    firstDefined(source.designMode, designIntent.mode),
    DEFAULT_SPREAD_FOOTING_DRAFT.designMode,
  ).toUpperCase();
  const requestedFootingXM = finiteNumber(
    firstDefined(requested.footingXM, source.requestedFootingX),
    Number.NaN,
  );
  const requestedFootingYM = finiteNumber(
    firstDefined(requested.footingYM, source.requestedFootingY),
    Number.NaN,
  );
  const requestedThicknessM = finiteCanonicalOrDisplay(
    firstDefined(requested.thicknessM, source.requestedThicknessM),
    source.requestedThickness,
    0.01,
    Number.NaN,
  );
  const requestedFoundationBottomDepthM = finiteNumber(
    firstDefined(requested.foundationBottomDepthM, source.requestedFoundationDepth),
    Number.NaN,
  );
  return {
    mode: mode === SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode
      ? SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode
      : 'MANUAL_CHECK',
    policyId: mode === SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode
      ? normalizedString(
        firstDefined(designIntent.policyId, source.autoDesignPolicyId),
        SPREAD_FOOTING_AUTO_DESIGN_POLICY.policyId,
      )
      : 'MANUAL_CHECK',
    requested: {
      footingXM: Number.isFinite(requestedFootingXM) ? requestedFootingXM : null,
      footingYM: Number.isFinite(requestedFootingYM) ? requestedFootingYM : null,
      thicknessM: Number.isFinite(requestedThicknessM) ? requestedThicknessM : null,
      foundationBottomDepthM: Number.isFinite(requestedFoundationBottomDepthM)
        ? requestedFoundationBottomDepthM
        : null,
    },
  };
}

/**
 * Normalizes current FormData-compatible display fields and canonical nested
 * fields into one SI-only engine input. Profile-controlled constants never
 * take authority from hidden/readonly form fields.
 */
export function normalizeSpreadFootingDraft(draft = {}) {
  const source = draft?.input && !draft.project && !draft.materials && !draft.loads
    ? draft.input
    : (draft || {});
  const materials = source.materials || {};
  const loads = source.loads || {};
  const soil = source.soil || {};
  const geometry = source.geometry || {};
  const footing = geometry.footing || {};
  const column = geometry.column || {};
  const reinforcement = source.reinforcement || {};
  const rebarA = reinforcement.A || reinforcement.a || {};
  const rebarB = reinforcement.B || reinforcement.b || {};

  const combinationId = normalizedString(
    firstDefined(source.combination, source.combinationId, source.basis?.combinationId, loads.combinationId),
    DEFAULT_SPREAD_FOOTING_DRAFT.combination,
  );
  const profileRequest = requestedDesignStandardProfile(source);
  const inferredProfileId = inferDesignStandardProfileId(combinationId);
  const designStandardProfileId = !profileRequest.requested
    ? (inferredProfileId || profileRequest.requested)
    : profileRequest.requested;
  const resolvedProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[designStandardProfileId];
  const profileControlsAuthority = resolvedProfile?.enabled
    ? resolvedProfile
    : SPREAD_FOOTING_ENGINE_PROFILE;
  const unsupportedExplicitProfile = [profileRequest.canonical, profileRequest.legacy]
    .some((profileId) => profileId && !SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[profileId]);
  const profileAliasConflict = Boolean(
    profileRequest.canonical
    && profileRequest.legacy
    && profileRequest.legacy !== profileRequest.canonical,
  );

  const fcMPa = finiteCanonicalOrDisplay(
    firstDefined(materials.fcMPa, source.fcMPa),
    source.fc,
    KSC_TO_MPA,
    DEFAULT_SPREAD_FOOTING_DRAFT.fc,
  );
  const normalized = {
    project: normalizeProject(source),
    designIntent: normalizeDesignIntent(source),
    basis: {
      designStandardProfileId,
      supportType: normalizedString(firstDefined(source.supportType, source.basis?.supportType), DEFAULT_SPREAD_FOOTING_DRAFT.supportType).toLowerCase(),
      columnLocation: normalizedString(firstDefined(source.columnLocation, source.basis?.columnLocation), 'centered').toLowerCase(),
      sbcBasis: normalizedString(firstDefined(source.sbcBasis, soil.sbcBasis), DEFAULT_SPREAD_FOOTING_DRAFT.sbcBasis).toLowerCase(),
      combinationId,
      loadApplicabilityConfirmed: designStandardProfileId === ACI_D_L_PROFILE_ID
        && normalizedBoolean(firstDefined(
          source.loadApplicabilityConfirmed,
          source.basis?.loadApplicabilityConfirmed,
        )),
    },
    materials: {
      fcMPa,
      fyMPa: finiteCanonicalOrDisplay(
        firstDefined(materials.fyMPa, source.fyMPa),
        source.fy,
        KSC_TO_MPA,
        DEFAULT_SPREAD_FOOTING_DRAFT.fy,
      ),
      concreteUnitWeightKNPerM3: finiteCanonicalOrDisplay(
        firstDefined(materials.concreteUnitWeightKNPerM3, source.concreteUnitWeightKNPerM3),
        source.concreteWeight,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.concreteWeight,
      ),
      soilUnitWeightKNPerM3: finiteCanonicalOrDisplay(
        firstDefined(materials.soilUnitWeightKNPerM3, soil.unitWeightKNPerM3, source.soilUnitWeightKNPerM3),
        source.soilWeight,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.soilWeight,
      ),
      beta1: beta1FromFcMPa(fcMPa),
      phiFlexure: profileControlsAuthority.phiFlexure,
      phiShear: profileControlsAuthority.phiShear,
      epsilonCu: SPREAD_FOOTING_ENGINE_PROFILE.epsilonCu,
      steelModulusMPa: SPREAD_FOOTING_ENGINE_PROFILE.steelModulusMPa,
      lambda: SPREAD_FOOTING_ENGINE_PROFILE.lambda,
      lambdaS: SPREAD_FOOTING_ENGINE_PROFILE.lambdaS,
    },
    loads: {
      deadKN: finiteCanonicalOrDisplay(
        firstDefined(loads.deadKN, source.deadKN),
        source.deadLoad,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.deadLoad,
      ),
      liveKN: finiteCanonicalOrDisplay(
        firstDefined(loads.liveKN, source.liveKN),
        source.liveLoad,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.liveLoad,
      ),
      serviceMxKNm: finiteCanonicalOrDisplay(
        firstDefined(loads.serviceMxKNm, loads.mxKNm, source.serviceMxKNm),
        source.mx,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.mx,
      ),
      serviceMyKNm: finiteCanonicalOrDisplay(
        firstDefined(loads.serviceMyKNm, loads.myKNm, source.serviceMyKNm),
        source.my,
        KGF_TO_KN,
        DEFAULT_SPREAD_FOOTING_DRAFT.my,
      ),
    },
    soil: {
      sbcGrossKPa: finiteCanonicalOrDisplay(
        firstDefined(soil.sbcGrossKPa, source.sbcGrossKPa),
        source.sbc,
        TONF_PER_M2_TO_KPA,
        DEFAULT_SPREAD_FOOTING_DRAFT.sbc,
      ),
      sbcSource: normalizedString(firstDefined(source.sbcSource, soil.sbcSource), DEFAULT_SPREAD_FOOTING_DRAFT.sbcSource),
      overburdenDepthM: finiteNumber(firstDefined(source.foundationTop, soil.overburdenDepthM, soil.foundationTopM), DEFAULT_SPREAD_FOOTING_DRAFT.foundationTop),
      foundationBottomDepthM: finiteNumber(firstDefined(source.foundationDepth, soil.foundationBottomDepthM), DEFAULT_SPREAD_FOOTING_DRAFT.foundationDepth),
    },
    geometry: {
      footing: {
        xM: finiteNumber(firstDefined(source.footingX, footing.xM, geometry.footingXM), DEFAULT_SPREAD_FOOTING_DRAFT.footingX),
        yM: finiteNumber(firstDefined(source.footingY, footing.yM, geometry.footingYM), DEFAULT_SPREAD_FOOTING_DRAFT.footingY),
        thicknessM: finiteCanonicalOrDisplay(
          firstDefined(footing.thicknessM, geometry.thicknessM, source.thicknessM),
          source.thickness,
          0.01,
          DEFAULT_SPREAD_FOOTING_DRAFT.thickness,
        ),
        coverM: finiteCanonicalOrDisplay(
          firstDefined(footing.coverM, geometry.coverM, source.coverM),
          source.cover,
          0.01,
          DEFAULT_SPREAD_FOOTING_DRAFT.cover,
        ),
      },
      column: {
        xM: finiteCanonicalOrDisplay(
          firstDefined(column.xM, geometry.columnXM, source.columnXM),
          source.columnX,
          0.01,
          DEFAULT_SPREAD_FOOTING_DRAFT.columnX,
        ),
        yM: finiteCanonicalOrDisplay(
          firstDefined(column.yM, geometry.columnYM, source.columnYM),
          source.columnY,
          0.01,
          DEFAULT_SPREAD_FOOTING_DRAFT.columnY,
        ),
        offsetXM: finiteNumber(firstDefined(column.offsetXM, geometry.columnOffsetXM, source.columnOffsetXM), 0),
        offsetYM: finiteNumber(firstDefined(column.offsetYM, geometry.columnOffsetYM, source.columnOffsetYM), 0),
      },
    },
    reinforcement: {
      A: {
        count: finiteNumber(firstDefined(source.barsA, rebarA.count), DEFAULT_SPREAD_FOOTING_DRAFT.barsA),
        diameterMm: normalizeBarDiameter(firstDefined(source.barDiaA, rebarA.diameterMm), DEFAULT_SPREAD_FOOTING_DRAFT.barDiaA),
      },
      B: {
        count: finiteNumber(firstDefined(source.barsB, rebarB.count), DEFAULT_SPREAD_FOOTING_DRAFT.barsB),
        diameterMm: normalizeBarDiameter(firstDefined(source.barDiaB, rebarB.diameterMm), DEFAULT_SPREAD_FOOTING_DRAFT.barDiaB),
      },
    },
    profileControls: {
      requestedPhiFlexure: finiteNumber(firstDefined(source.phiFlexure, profileControlsAuthority.phiFlexure)),
      requestedPhiShear: finiteNumber(firstDefined(source.phiShear, profileControlsAuthority.phiShear)),
      unsupportedExplicitProfile,
      profileAliasConflict,
    },
  };
  return deepFreeze(normalized);
}

function addIssue(issues, errors, field, code, message) {
  if (!errors[field]) errors[field] = message;
  issues.push({ field, code, message, status: 'HOLD' });
}

function hasPath(source, path) {
  let value = source;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return false;
    value = value[key];
  }
  return value !== undefined && value !== null && value !== '';
}

function requireSourceField(source, issues, errors, field, paths) {
  if (paths.some((path) => hasPath(source, path))) return;
  addIssue(issues, errors, field, 'MISSING_REQUIRED_INPUT', `${field} เป็นข้อมูลบังคับและห้ามใช้ค่าเริ่มต้นแทนข้อมูลที่หายไป`);
}

function checkFiniteRange(issues, errors, input, field, label, minimum, maximum) {
  if (!Number.isFinite(input)) {
    addIssue(issues, errors, field, 'INVALID_NUMBER', `${label}ต้องเป็นตัวเลขที่ถูกต้อง`);
  } else if (input < minimum || input > maximum) {
    addIssue(issues, errors, field, 'OUTSIDE_PROFILE_RANGE', `${label}ต้องอยู่ระหว่าง ${minimum} ถึง ${maximum}`);
  }
}

export function validateSpreadFootingDraft(draft = {}) {
  const input = normalizeSpreadFootingDraft(draft);
  const errors = {};
  const issues = [];
  const source = draft?.input && !draft.project && !draft.materials && !draft.loads
    ? draft.input
    : (draft || {});
  const { materials, loads, soil, geometry, reinforcement, basis, project, profileControls } = input;
  const { footing, column } = geometry;
  const designStandardProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[basis.designStandardProfileId];
  const profileMaterialLimits = designStandardProfile?.enabled
    ? designStandardProfile.materialLimits
    : {
      ...SPREAD_FOOTING_ENGINE_PROFILE.validatedRanges,
      minimumEffectiveDepthMm: SPREAD_FOOTING_ENGINE_PROFILE.minimumEffectiveDepthMm,
      barDiametersMm: SPREAD_FOOTING_ENGINE_PROFILE.barDiametersMm,
    };
  const ranges = profileMaterialLimits;

  const requiredSourceFields = [
    ['projectName', ['projectName', 'project.projectName', 'project.name']],
    ['projectOwner', ['projectOwner', 'project.projectOwner', 'project.owner']],
    ['projectLocation', ['projectLocation', 'project.projectLocation', 'project.location']],
    ['memberMark', ['memberMark', 'project.memberMark', 'project.mark']],
    ['calculationNumber', ['calculationNumber', 'project.calculationNumber']],
    ['drawingNumber', ['drawingNumber', 'project.drawingNumber']],
    ['revision', ['revision', 'project.revision']],
    ['preparedBy', ['preparedBy', 'project.preparedBy']],
    ['checkedBy', ['checkedBy', 'project.checkedBy']],
    ['approvedBy', ['approvedBy', 'project.approvedBy']],
    ['documentDate', ['documentDate', 'project.documentDate']],
    ['supportType', ['supportType', 'basis.supportType']],
    ['combination', ['combination', 'combinationId', 'basis.combinationId', 'loads.combinationId']],
    ['fc', ['fc', 'fcMPa', 'materials.fcMPa']],
    ['fy', ['fy', 'fyMPa', 'materials.fyMPa']],
    ['concreteWeight', ['concreteWeight', 'concreteUnitWeightKNPerM3', 'materials.concreteUnitWeightKNPerM3']],
    ['soilWeight', ['soilWeight', 'soilUnitWeightKNPerM3', 'materials.soilUnitWeightKNPerM3', 'soil.unitWeightKNPerM3']],
    ['deadLoad', ['deadLoad', 'deadKN', 'loads.deadKN']],
    ['liveLoad', ['liveLoad', 'liveKN', 'loads.liveKN']],
    ['mx', ['mx', 'serviceMxKNm', 'loads.serviceMxKNm', 'loads.mxKNm']],
    ['my', ['my', 'serviceMyKNm', 'loads.serviceMyKNm', 'loads.myKNm']],
    ['sbc', ['sbc', 'sbcGrossKPa', 'soil.sbcGrossKPa']],
    ['sbcBasis', ['sbcBasis', 'basis.sbcBasis', 'soil.sbcBasis']],
    ['foundationTop', ['foundationTop', 'soil.overburdenDepthM', 'soil.foundationTopM']],
    ['foundationDepth', ['foundationDepth', 'soil.foundationBottomDepthM']],
    ['columnX', ['columnX', 'columnXM', 'geometry.columnXM', 'geometry.column.xM']],
    ['columnY', ['columnY', 'columnYM', 'geometry.columnYM', 'geometry.column.yM']],
    ['footingX', ['footingX', 'geometry.footingXM', 'geometry.footing.xM']],
    ['footingY', ['footingY', 'geometry.footingYM', 'geometry.footing.yM']],
    ['thickness', ['thickness', 'thicknessM', 'geometry.thicknessM', 'geometry.footing.thicknessM']],
    ['cover', ['cover', 'coverM', 'geometry.coverM', 'geometry.footing.coverM']],
    ['barsA', ['barsA', 'reinforcement.A.count', 'reinforcement.a.count']],
    ['barDiaA', ['barDiaA', 'reinforcement.A.diameterMm', 'reinforcement.a.diameterMm']],
    ['barsB', ['barsB', 'reinforcement.B.count', 'reinforcement.b.count']],
    ['barDiaB', ['barDiaB', 'reinforcement.B.diameterMm', 'reinforcement.b.diameterMm']],
  ];
  for (const [field, paths] of requiredSourceFields) {
    requireSourceField(source, issues, errors, field, paths);
  }

  for (const [key, value] of Object.entries(project)) {
    if (!value) addIssue(issues, errors, `project.${key}`, 'MISSING_PROJECT_METADATA', `${key} ต้องไม่ว่าง`);
    if (value.length > 160) addIssue(issues, errors, `project.${key}`, 'PROJECT_METADATA_TOO_LONG', `${key} ยาวเกิน 160 ตัวอักษร`);
  }
  if (basis.supportType !== 'interior') {
    addIssue(issues, errors, 'supportType', 'UNSUPPORTED_SUPPORT_R1', 'รุ่น R1 รองรับเฉพาะเสากลางแบบ interior');
  }
  if (basis.columnLocation !== 'centered'
    || Math.abs(column.offsetXM) > GEOMETRY_TOLERANCE_M
    || Math.abs(column.offsetYM) > GEOMETRY_TOLERANCE_M) {
    addIssue(issues, errors, 'columnLocation', 'UNSUPPORTED_ECCENTRIC_COLUMN_R1', 'รุ่น R1 รองรับเฉพาะเสาที่อยู่กึ่งกลางฐาน');
  }
  if (basis.sbcBasis !== 'gross') {
    addIssue(issues, errors, 'sbcBasis', 'UNSUPPORTED_NET_SBC_R1', 'รุ่น R1 รองรับเฉพาะ gross allowable bearing pressure');
  }
  if (profileControls.unsupportedExplicitProfile) {
    addIssue(
      issues,
      errors,
      'designStandardProfileId',
      'UNSUPPORTED_PROFILE',
      'รองรับเฉพาะ Design Standard profile ID แบบ canonical ที่เปิดใช้ใน Engine registry',
    );
  }
  if (profileControls.profileAliasConflict) {
    addIssue(
      issues,
      errors,
      'designStandardProfileId',
      'CONFLICTING_DESIGN_STANDARD_PROFILE',
      'designStandardProfileId และ basisProfile ต้องอ้างถึงโปรไฟล์เดียวกัน',
    );
  }
  if (!designStandardProfile && !profileControls.unsupportedExplicitProfile) {
    addIssue(
      issues,
      errors,
      'designStandardProfileId',
      'UNKNOWN_DESIGN_STANDARD_PROFILE',
      'ไม่พบ Design Standard profile ที่ Engine รุ่นนี้อนุญาต',
    );
  } else if (designStandardProfile && !designStandardProfile.enabled) {
    addIssue(
      issues,
      errors,
      'designStandardProfileId',
      'DISABLED_DESIGN_STANDARD_PROFILE',
      `${designStandardProfile.displayLabel}: ${designStandardProfile.disabledState}`,
    );
  }
  if (basis.designStandardProfileId === ACI_D_L_PROFILE_ID
    && basis.loadApplicabilityConfirmed !== true) {
    addIssue(
      issues,
      errors,
      'loadApplicabilityConfirmed',
      'ACI_LOAD_APPLICABILITY_UNCONFIRMED',
      'โปรไฟล์ ACI 318-19 D+L ต้องยืนยันว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้; หากมี ต้องเลือกโปรไฟล์ที่รองรับก่อนคำนวณ',
    );
  }
  if (!SPREAD_FOOTING_LOAD_COMBINATIONS[basis.combinationId]) {
    addIssue(issues, errors, 'combination', 'UNSUPPORTED_LOAD_COMBINATION', 'เลือกชุดรวมน้ำหนัก D + L ที่รุ่น R1 รองรับ');
  } else if (designStandardProfile?.enabled
    && !designStandardProfile.allowedCombinationIds.includes(basis.combinationId)) {
    addIssue(
      issues,
      errors,
      'combination',
      'PROFILE_LOAD_COMBINATION_INCOMPATIBLE',
      'Design Standard profile และ Load Combination ต้องเป็นคู่ที่ Engine registry อนุญาต',
    );
  }

  checkFiniteRange(issues, errors, materials.fcMPa, 'fc', "f'c (MPa) ตาม ACI 318-19 Table 19.2.1.1 ", ranges.fcMPa[0], ranges.fcMPa[1]);
  checkFiniteRange(issues, errors, materials.fyMPa, 'fy', 'fy (MPa) ', ranges.fyMPa[0], ranges.fyMPa[1]);
  checkFiniteRange(
    issues,
    errors,
    materials.concreteUnitWeightKNPerM3,
    'concreteWeight',
    'หน่วยน้ำหนักคอนกรีต (kN/m3) ',
    ranges.concreteUnitWeightKNPerM3[0],
    ranges.concreteUnitWeightKNPerM3[1],
  );
  checkFiniteRange(
    issues,
    errors,
    materials.soilUnitWeightKNPerM3,
    'soilWeight',
    'หน่วยน้ำหนักดิน (kN/m3) ',
    ranges.soilUnitWeightKNPerM3[0],
    ranges.soilUnitWeightKNPerM3[1],
  );
  if (!Number.isFinite(materials.beta1) || materials.beta1 < 0.65 - EPSILON || materials.beta1 > 0.85 + EPSILON) {
    addIssue(issues, errors, 'beta1', 'INVALID_PROFILE_BETA1', 'Engine ไม่สามารถคำนวณ beta1 ภายในช่วง 0.65–0.85 ได้');
  }
  if (!Number.isFinite(profileControls.requestedPhiFlexure)
    || Math.abs(profileControls.requestedPhiFlexure - (designStandardProfile?.phiFlexure ?? SPREAD_FOOTING_ENGINE_PROFILE.phiFlexure)) > EPSILON) {
    addIssue(issues, errors, 'phiFlexure', 'PROFILE_CONTROL_TAMPERED', 'รุ่น R1 ล็อก phi ดัดที่ 0.90 และใช้ได้เมื่อ tension-controlled เท่านั้น');
  }
  if (!Number.isFinite(profileControls.requestedPhiShear)
    || Math.abs(profileControls.requestedPhiShear - (designStandardProfile?.phiShear ?? SPREAD_FOOTING_ENGINE_PROFILE.phiShear)) > EPSILON) {
    addIssue(issues, errors, 'phiShear', 'PROFILE_CONTROL_TAMPERED', 'รุ่น R1 ล็อก phi เฉือนที่ 0.75');
  }

  checkFiniteRange(issues, errors, loads.deadKN, 'deadLoad', 'PD (kN) ', 0, 1000000000 * KGF_TO_KN);
  checkFiniteRange(issues, errors, loads.liveKN, 'liveLoad', 'PL (kN) ', 0, 1000000000 * KGF_TO_KN);
  checkFiniteRange(issues, errors, loads.serviceMxKNm, 'mx', 'Mx (kN.m) ', -1000000000 * KGF_TO_KN, 1000000000 * KGF_TO_KN);
  checkFiniteRange(issues, errors, loads.serviceMyKNm, 'my', 'My (kN.m) ', -1000000000 * KGF_TO_KN, 1000000000 * KGF_TO_KN);
  if (Number.isFinite(loads.deadKN) && Number.isFinite(loads.liveKN) && loads.deadKN + loads.liveKN <= 0) {
    addIssue(issues, errors, 'deadLoad', 'NO_COLUMN_REACTION', 'ผลรวม PD + PL ต้องมากกว่า 0');
  }

  checkFiniteRange(issues, errors, soil.sbcGrossKPa, 'sbc', 'Gross SBC (kPa) ', 0.1 * TONF_PER_M2_TO_KPA, 1000 * TONF_PER_M2_TO_KPA);
  checkFiniteRange(issues, errors, soil.overburdenDepthM, 'foundationTop', 'ระดับผิวบนฐาน (m) ', 0, 50);
  checkFiniteRange(issues, errors, soil.foundationBottomDepthM, 'foundationDepth', 'ความลึกท้องฐาน (m) ', 0.1, 50);

  checkFiniteRange(issues, errors, footing.xM, 'footingX', 'ขนาดฐาน X (m) ', 0.3, 50);
  checkFiniteRange(issues, errors, footing.yM, 'footingY', 'ขนาดฐาน Y (m) ', 0.3, 50);
  checkFiniteRange(issues, errors, footing.thicknessM, 'thickness', 'ความหนาฐาน (m) ', 0.1, 5);
  checkFiniteRange(issues, errors, footing.coverM, 'cover', 'ระยะหุ้ม (m) ', 0.02, 0.2);
  checkFiniteRange(issues, errors, column.xM, 'columnX', 'ขนาดเสา X (m) ', 0.1, 5);
  checkFiniteRange(issues, errors, column.yM, 'columnY', 'ขนาดเสา Y (m) ', 0.1, 5);

  if (Number.isFinite(column.xM) && Number.isFinite(footing.xM) && column.xM >= footing.xM) {
    addIssue(issues, errors, 'columnX', 'COLUMN_OUTSIDE_FOOTING', 'ขนาดเสา X ต้องเล็กกว่าฐาน X');
  }
  if (Number.isFinite(column.yM) && Number.isFinite(footing.yM) && column.yM >= footing.yM) {
    addIssue(issues, errors, 'columnY', 'COLUMN_OUTSIDE_FOOTING', 'ขนาดเสา Y ต้องเล็กกว่าฐาน Y');
  }
  if (Number.isFinite(soil.overburdenDepthM)
    && Number.isFinite(soil.foundationBottomDepthM)
    && Number.isFinite(footing.thicknessM)
    && Math.abs((soil.overburdenDepthM + footing.thicknessM) - soil.foundationBottomDepthM) > GEOMETRY_TOLERANCE_M) {
    addIssue(issues, errors, 'foundationDepth', 'DEPTH_INCONSISTENT', 'ความลึกท้องฐานต้องเท่ากับระดับผิวบนฐาน + ความหนาฐาน');
  }

  for (const direction of ['A', 'B']) {
    const rebar = reinforcement[direction];
    const countField = direction === 'A' ? 'barsA' : 'barsB';
    const diameterField = direction === 'A' ? 'barDiaA' : 'barDiaB';
    checkFiniteRange(issues, errors, rebar.count, countField, `จำนวนเหล็กทิศ ${direction} `, 2, 100);
    if (Number.isFinite(rebar.count) && !Number.isInteger(rebar.count)) {
      addIssue(issues, errors, countField, 'BAR_COUNT_NOT_INTEGER', `จำนวนเหล็กทิศ ${direction} ต้องเป็นจำนวนเต็ม`);
    }
    if (!Number.isFinite(rebar.diameterMm)
      || !profileMaterialLimits.barDiametersMm.includes(rebar.diameterMm)) {
      addIssue(issues, errors, diameterField, 'UNSUPPORTED_BAR_DIAMETER', `เหล็กทิศ ${direction} ต้องเป็น DB12, DB16, DB20, DB25, DB28 หรือ DB32`);
    }
  }

  if (Object.keys(errors).length === 0) {
    const hMm = footing.thicknessM * 1000;
    const coverMm = footing.coverM * 1000;
    const dbA = reinforcement.A.diameterMm;
    const dbB = reinforcement.B.diameterMm;
    const dA = hMm - coverMm - dbA / 2;
    const dB = hMm - coverMm - dbA - dbB / 2;
    const cantileverA = (footing.xM - column.xM) / 2;
    const cantileverB = (footing.yM - column.yM) / 2;
    const spacingWidthA = footing.yM * 1000 - 2 * coverMm - dbA;
    const spacingWidthB = footing.xM * 1000 - 2 * coverMm - dbB;
    const topCutEndElevation = hMm - coverMm;
    const rclA = 3.5 * dbA;
    const rclB = 3.5 * dbB;
    const verticalA = topCutEndElevation - (coverMm + dbA / 2) - rclA;
    const verticalB = topCutEndElevation - (coverMm + dbA + dbB / 2) - rclB;
    const horizontalA = footing.xM * 1000 - 2 * coverMm - dbA - 2 * rclA;
    const horizontalB = footing.yM * 1000 - 2 * coverMm - dbB - 2 * rclB;

    if (dA <= 0 || dB <= 0) {
      addIssue(issues, errors, 'cover', 'REBAR_LAYER_OUTSIDE_SECTION', 'ชั้นเหล็ก A/B ไม่เหลือ effective depth ภายในฐาน');
    } else if (dA < profileMaterialLimits.minimumEffectiveDepthMm - EPSILON
      || dB < profileMaterialLimits.minimumEffectiveDepthMm - EPSILON) {
      const minimumThicknessMm = profileMaterialLimits.minimumEffectiveDepthMm
        + coverMm
        + dbA
        + dbB / 2;
      addIssue(
        issues,
        errors,
        'thickness',
        'EFFECTIVE_DEPTH_BELOW_FOOTING_MINIMUM',
        `ได้ dA=${Number(dA.toFixed(1))} mm และ dB=${Number(dB.toFixed(1))} mm; ACI 318-19 §13.3.1.2 กำหนด effective depth ของเหล็กล่างไม่น้อยกว่า ${profileMaterialLimits.minimumEffectiveDepthMm} mm จึงต้องใช้ T ไม่น้อยกว่า ${Number((minimumThicknessMm / 10).toFixed(1))} cm สำหรับชั้นเหล็กชุดนี้`,
      );
    }
    if (spacingWidthA <= 0 || spacingWidthB <= 0) {
      addIssue(issues, errors, 'cover', 'REBAR_DISTRIBUTION_IMPOSSIBLE', 'พื้นที่กระจายเหล็ก A/B ไม่เพียงพอ');
    }
    if (verticalA < 0 || verticalB < 0 || horizontalA < 0 || horizontalB < 0) {
      addIssue(issues, errors, 'cover', 'UPTURN_GEOMETRY_IMPOSSIBLE', 'รูปทรงปลายงอขึ้นไม่พอดีภายในฐาน');
    }
    if (cantileverA <= dA / 1000 + GEOMETRY_TOLERANCE_M) {
      addIssue(issues, errors, 'footingX', 'ONE_WAY_SECTION_OUTSIDE_A', 'หน้าตัดวิกฤต one-way ทิศ A ที่ระยะ d ต้องอยู่ภายในฐาน');
    }
    if (cantileverB <= dB / 1000 + GEOMETRY_TOLERANCE_M) {
      addIssue(issues, errors, 'footingY', 'ONE_WAY_SECTION_OUTSIDE_B', 'หน้าตัดวิกฤต one-way ทิศ B ที่ระยะ d ต้องอยู่ภายในฐาน');
    }
    const punchingDepthM = Math.min(dA, dB) / 1000;
    if (column.xM + punchingDepthM >= footing.xM - GEOMETRY_TOLERANCE_M
      || column.yM + punchingDepthM >= footing.yM - GEOMETRY_TOLERANCE_M) {
      addIssue(issues, errors, 'thickness', 'PUNCHING_PERIMETER_OUTSIDE', 'แนววิกฤต punching ต้องอยู่ภายในขอบฐานทุกด้าน');
    }
  }

  return deepFreeze({
    ok: Object.keys(errors).length === 0,
    errors,
    issues,
    input,
  });
}

function canonicalize(value) {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical hash input contains a non-finite number');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`Unsupported canonical hash type: ${typeof value}`);
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('SHA-256 Web Crypto is unavailable; Snapshot creation is blocked');
  }
  const bytes = new TextEncoder().encode(canonicalize(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function calculationInputView(input) {
  return {
    basis: input.basis,
    materials: input.materials,
    loads: input.loads,
    soil: input.soil,
    geometry: input.geometry,
    reinforcement: input.reinforcement,
    profileControls: input.profileControls,
  };
}

export async function createSpreadFootingInputFingerprint(draft = {}) {
  const validation = validateSpreadFootingDraft(draft);
  if (!validation.ok) {
    throw new TypeError(`Cannot fingerprint invalid Spread Footing input: ${Object.keys(validation.errors).join(', ')}`);
  }
  return sha256(validation.input);
}

export async function createSpreadFootingPayloadHash(payload) {
  if (!payload || typeof payload !== 'object') throw new TypeError('Payload hash requires an object');
  const {
    id: _id,
    payloadHash: _payloadHash,
    ok: _ok,
    ...hashMaterial
  } = payload;
  return sha256(hashMaterial);
}

function toIsoTime(now) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now ?? Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sourceRecord({
  equationId,
  standard,
  edition,
  clause,
  formula,
  substitution,
  canonicalUnits,
  assumptions,
  sourceUrl,
  sourceTitle,
  verificationStatus = 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW',
}) {
  const record = {
    equationId,
    standard,
    edition,
    clause,
    formula,
    substitution,
    canonicalUnits,
    assumptions: Array.isArray(assumptions) ? assumptions : [String(assumptions)],
    sourceUrl,
    sourceTitle,
    verificationStatus,
  };
  for (const [key, value] of Object.entries(record)) {
    if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) {
      throw new Error(`Incomplete source record ${equationId}: ${key}`);
    }
  }
  return deepFreeze(record);
}

function quantity(value, unit) {
  return { value: Number.isFinite(value) ? value : null, unit };
}

function evaluatedCheck({
  id,
  label,
  category,
  status,
  demand,
  capacity,
  capacitySource,
  utilization,
  evidence,
  detail,
}) {
  if (!['PASS', 'FAIL'].includes(status)) throw new Error(`Evaluated check ${id} has invalid status`);
  if (!evidence?.equationId) throw new Error(`Evaluated check ${id} has no source evidence`);
  return {
    id,
    label,
    category,
    applicability: 'EVALUATED',
    status,
    demand,
    capacity,
    capacitySource,
    utilization: Number.isFinite(utilization) ? utilization : null,
    evidence,
    detail,
  };
}

function holdCheck({ id, label, category, capacitySource, evidence, detail }) {
  return {
    id,
    label,
    category,
    applicability: 'NOT_EVALUATED',
    status: 'HOLD',
    demand: null,
    capacity: null,
    capacitySource,
    utilization: null,
    evidence,
    detail,
  };
}

function statusFromUtilization(utilization) {
  return Number.isFinite(utilization) && utilization <= 1 + EPSILON ? 'PASS' : 'FAIL';
}

function barAreaMm2(diameterMm) {
  return Math.PI * diameterMm ** 2 / 4;
}

function classifyBarsByCenteredBand(planCenterlines, direction, bandWidthM) {
  const halfBandM = bandWidthM / 2;
  const zones = {
    center: [],
    outerNegative: [],
    outerPositive: [],
  };
  for (const bar of planCenterlines) {
    const coordinateM = direction === 'A' ? bar.start.yM : bar.start.xM;
    if (coordinateM < -halfBandM - GEOMETRY_TOLERANCE_M) {
      zones.outerNegative.push(bar);
    } else if (coordinateM > halfBandM + GEOMETRY_TOLERANCE_M) {
      zones.outerPositive.push(bar);
    } else {
      zones.center.push(bar);
    }
  }
  return zones;
}

function requiredProvidedUtilization(requiredAreaMm2, providedAreaMm2) {
  if (!Number.isFinite(requiredAreaMm2)) return null;
  if (requiredAreaMm2 <= EPSILON) return 0;
  return providedAreaMm2 > 0 ? requiredAreaMm2 / providedAreaMm2 : null;
}

function solveRequiredSteelMm2({ muKNmPerM, phi, fyMPa, fcMPa, widthMm, depthMm }) {
  const muNmm = muKNmPerM * 1e6;
  const coefficient = fyMPa / (1.7 * fcMPa * widthMm);
  const demandTerm = muNmm / (phi * fyMPa);
  const discriminant = depthMm ** 2 - 4 * coefficient * demandTerm;
  if (![muNmm, coefficient, demandTerm, discriminant].every(Number.isFinite) || discriminant < 0) {
    return { areaMm2: null, discriminant };
  }
  const root = Math.sqrt(Math.max(0, discriminant));
  const stableDenominator = depthMm + root;
  const areaMm2 = stableDenominator > 0 ? (2 * demandTerm) / stableDenominator : null;
  return {
    areaMm2: Number.isFinite(areaMm2) && areaMm2 >= 0 ? areaMm2 : null,
    discriminant,
  };
}

function makeUpturnPolyline({
  memberLengthMm,
  coverMm,
  diameterMm,
  bottomCenterElevationMm,
  topCutEndElevationMm,
  samplesPerArc = 6,
}) {
  const radiusCenterlineMm = 3.5 * diameterMm;
  const leftX = coverMm + diameterMm / 2;
  const rightX = memberLengthMm - coverMm - diameterMm / 2;
  const leftCenterX = leftX + radiusCenterlineMm;
  const rightCenterX = rightX - radiusCenterlineMm;
  const arcCenterZ = bottomCenterElevationMm + radiusCenterlineMm;
  const points = [{ xMm: leftX, zMm: topCutEndElevationMm }];
  points.push({ xMm: leftX, zMm: arcCenterZ });
  for (let index = 1; index <= samplesPerArc; index += 1) {
    const angle = Math.PI + (Math.PI / 2) * (index / samplesPerArc);
    points.push({
      xMm: leftCenterX + radiusCenterlineMm * Math.cos(angle),
      zMm: arcCenterZ + radiusCenterlineMm * Math.sin(angle),
    });
  }
  points.push({ xMm: rightCenterX, zMm: bottomCenterElevationMm });
  for (let index = 1; index <= samplesPerArc; index += 1) {
    const angle = 1.5 * Math.PI + (Math.PI / 2) * (index / samplesPerArc);
    points.push({
      xMm: rightCenterX + radiusCenterlineMm * Math.cos(angle),
      zMm: arcCenterZ + radiusCenterlineMm * Math.sin(angle),
    });
  }
  points.push({ xMm: rightX, zMm: topCutEndElevationMm });
  return points;
}

function makePressureSamples({ footing, q0KPa, mxKNm, myKNm, ixM4, iyM4 }) {
  const samples = [];
  for (const yFactor of [-0.5, 0, 0.5]) {
    for (const xFactor of [-0.5, 0, 0.5]) {
      const xM = footing.xM * xFactor;
      const yM = footing.yM * yFactor;
      samples.push({
        xM,
        yM,
        pressureKPa: q0KPa + mxKNm * yM / ixM4 + myKNm * xM / iyM4,
      });
    }
  }
  return samples;
}

function makePlanBarCenterlines({ direction, reinforcement, footing, coverM }) {
  const diameterM = reinforcement.diameterMm / 1000;
  const startOffsetM = coverM + diameterM / 2;
  const bars = [];
  if (direction === 'A') {
    for (let index = 0; index < reinforcement.count; index += 1) {
      const yM = -footing.yM / 2 + startOffsetM + (reinforcement.spacingMm / 1000) * index;
      bars.push({
        id: `${reinforcement.mark}-${String(index + 1).padStart(2, '0')}`,
        mark: reinforcement.mark,
        direction: 'A',
        start: { xM: -footing.xM / 2 + startOffsetM, yM, zM: reinforcement.centerElevationMm / 1000 },
        end: { xM: footing.xM / 2 - startOffsetM, yM, zM: reinforcement.centerElevationMm / 1000 },
      });
    }
  } else {
    for (let index = 0; index < reinforcement.count; index += 1) {
      const xM = -footing.xM / 2 + startOffsetM + (reinforcement.spacingMm / 1000) * index;
      bars.push({
        id: `${reinforcement.mark}-${String(index + 1).padStart(2, '0')}`,
        mark: reinforcement.mark,
        direction: 'B',
        start: { xM, yM: -footing.yM / 2 + startOffsetM, zM: reinforcement.centerElevationMm / 1000 },
        end: { xM, yM: footing.yM / 2 - startOffsetM, zM: reinforcement.centerElevationMm / 1000 },
      });
    }
  }
  return bars;
}

function makeDiagram(direction, cantileverM, quNetKPa, depthMm, status) {
  if (status !== 'EVALUATED') {
    return {
      direction,
      status: 'HOLD',
      cantileverM,
      criticalDistanceFromColumnFaceM: depthMm / 1000,
      stations: [],
      units: { distance: 'm', moment: 'kN.m/m', shear: 'kN/m' },
    };
  }
  const stations = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const distanceFromFreeEdgeM = cantileverM * ratio;
    return {
      ratio,
      distanceFromFreeEdgeM,
      distanceFromColumnFaceM: cantileverM - distanceFromFreeEdgeM,
      momentKNmPerM: quNetKPa * distanceFromFreeEdgeM ** 2 / 2,
      shearKNPerM: quNetKPa * distanceFromFreeEdgeM,
    };
  });
  return {
    direction,
    status: 'EVALUATED',
    cantileverM,
    criticalDistanceFromColumnFaceM: depthMm / 1000,
    stations,
    units: { distance: 'm', moment: 'kN.m/m', shear: 'kN/m' },
  };
}

function buildHoldEvidence(id, clause, title, sourceUrl = OFFICIAL_ACI_URL) {
  return sourceRecord({
    equationId: id,
    standard: 'ACI 318-19 / project-specific engineering evidence',
    edition: '318-19',
    clause,
    formula: 'NOT EVALUATED in SF-SDM-ACI19-R1',
    substitution: 'No zero demand, zero utilization, or PASS is assigned.',
    canonicalUnits: 'N/A',
    assumptions: ['The required project, geotechnical, detailing, or construction evidence is outside the R1 calculation boundary.'],
    sourceUrl,
    sourceTitle: title,
    verificationStatus: 'NOT_EVALUATED_HOLD_OWNER_PE',
  });
}

function buildCalculationResults(input) {
  const equations = [];
  const checks = [];
  const addEquation = (record) => {
    equations.push(record);
    return record;
  };
  const {
    materials, loads, soil, geometry: inputGeometry, reinforcement: inputRebar, basis, project,
  } = input;
  const designStandardProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[basis.designStandardProfileId];
  if (!designStandardProfile?.enabled
    || !designStandardProfile.allowedCombinationIds.includes(basis.combinationId)) {
    throw new Error('Design Standard profile and load combination are not executable');
  }
  const { footing, column } = inputGeometry;
  const combination = SPREAD_FOOTING_LOAD_COMBINATIONS[basis.combinationId];
  const areaM2 = footing.xM * footing.yM;
  const columnAreaM2 = column.xM * column.yM;
  const footingVolumeM3 = areaM2 * footing.thicknessM;
  const soilOverburdenVolumeM3 = (areaM2 - columnAreaM2) * soil.overburdenDepthM;
  const footingWeightKN = materials.concreteUnitWeightKNPerM3 * footingVolumeM3;
  const soilWeightKN = materials.soilUnitWeightKNPerM3 * soilOverburdenVolumeM3;
  const distributedDeadWeightKN = footingWeightKN + soilWeightKN;
  const serviceColumnReactionKN = loads.deadKN + loads.liveKN;
  const serviceGrossReactionKN = serviceColumnReactionKN + distributedDeadWeightKN;
  const q0KPa = serviceGrossReactionKN / areaM2;
  const ixM4 = footing.xM * footing.yM ** 3 / 12;
  const iyM4 = footing.yM * footing.xM ** 3 / 12;
  const sxM3 = footing.xM * footing.yM ** 2 / 6;
  const syM3 = footing.yM * footing.xM ** 2 / 6;
  const pressureCorners = [
    { id: 'x-neg-y-neg', xM: -footing.xM / 2, yM: -footing.yM / 2 },
    { id: 'x-pos-y-neg', xM: footing.xM / 2, yM: -footing.yM / 2 },
    { id: 'x-pos-y-pos', xM: footing.xM / 2, yM: footing.yM / 2 },
    { id: 'x-neg-y-pos', xM: -footing.xM / 2, yM: footing.yM / 2 },
  ].map((corner) => ({
    ...corner,
    pressureKPa: q0KPa
      + loads.serviceMxKNm * corner.yM / ixM4
      + loads.serviceMyKNm * corner.xM / iyM4,
  }));
  const qMinKPa = Math.min(...pressureCorners.map((corner) => corner.pressureKPa));
  const qMaxKPa = Math.max(...pressureCorners.map((corner) => corner.pressureKPa));
  const eccentricityXM = Math.abs(loads.serviceMyKNm) / serviceGrossReactionKN;
  const eccentricityYM = Math.abs(loads.serviceMxKNm) / serviceGrossReactionKN;
  const combinedKernRatio = 6 * eccentricityXM / footing.xM + 6 * eccentricityYM / footing.yM;
  const bearingUtilization = qMaxKPa / soil.sbcGrossKPa;
  const serviceFullContact = qMinKPa >= -EPSILON && combinedKernRatio <= 1 + EPSILON;

  const serviceWeightEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-SERVICE-GROSS-WEIGHTS',
    standard: 'Engineering statics; gross allowable bearing workflow',
    edition: 'SF-SDM-ACI19-R1',
    clause: 'SPEC_SPREAD_FOOTING_ENGINE §5',
    formula: 'Pservice,gross = PD + PL + gamma_c(BLh) + gamma_s[(BL - bc lc)z]',
    substitution: `${serviceGrossReactionKN} = ${loads.deadKN} + ${loads.liveKN} + ${footingWeightKN} + ${soilWeightKN} kN`,
    canonicalUnits: 'kN, m, kN/m3',
    assumptions: [
      'SBC is gross allowable.',
      'Soil above the footing excludes the centered column footprint.',
      'Column PD and PL are service reactions.',
      'R1 accepts only the project safety band 2200–2600 kg/m3 for normalweight concrete and hard-locks lambda=1; concrete outside this band requires a separate reviewed profile.',
    ],
    sourceUrl: OFFICIAL_ACI_FOOTING_EXAMPLE_URL,
    sourceTitle: 'ACI Footings Example 1 (ACI 318-14 workflow benchmark; not the R1 resistance source) and Owner-authorized R1 gross-weight contract',
  }));
  const servicePressureEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-SERVICE-BIAXIAL-PRESSURE',
    standard: 'Classical rigid-footing engineering statics',
    edition: 'SF-SDM-ACI19-R1 controlled method',
    clause: 'SPEC_SPREAD_FOOTING_ENGINE §6.1',
    formula: 'q = P/A + Mx y/Ix + My x/Iy; Sx = B L^2/6; Sy = L B^2/6',
    substitution: `q0=${q0KPa} kPa; Mx/Sx=${loads.serviceMxKNm / sxM3} kPa; My/Sy=${loads.serviceMyKNm / syM3} kPa`,
    canonicalUnits: 'kPa, kN, kN.m, m2, m3, m4',
    assumptions: ['Rigid rectangular footing.', 'Linear elastic full-contact pressure field is valid only while qmin >= 0.', 'This statics method is separate from ACI concrete resistance equations.'],
    sourceUrl: OFFICIAL_ACI_FOOTING_EXAMPLE_URL,
    sourceTitle: 'ACI Footings Example 1 (ACI 318-14 workflow benchmark; not the R1 resistance source) and Owner-authorized R1 statics contract',
  }));
  const eccentricityEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-SERVICE-COMBINED-KERN',
    standard: 'Classical rigid-footing engineering statics',
    edition: 'SF-SDM-ACI19-R1 controlled method',
    clause: 'SPEC_SPREAD_FOOTING_ENGINE §6.1',
    formula: 'ex = |My|/P; ey = |Mx|/P; 6ex/B + 6ey/L <= 1',
    substitution: `ex=${eccentricityXM} m; ey=${eccentricityYM} m; ratio=${combinedKernRatio}`,
    canonicalUnits: 'm, dimensionless',
    assumptions: ['Positive gross compression reaction.', 'Biaxial middle-third condition is combined, not checked independently by axis.'],
    sourceUrl: OFFICIAL_ACI_FOOTING_EXAMPLE_URL,
    sourceTitle: 'ACI Footings Example 1 (official footing workflow benchmark) and Owner-authorized R1 contact contract',
  }));

  if (serviceFullContact) {
    checks.push(evaluatedCheck({
      id: 'bearing-capacity',
      label: 'Gross service bearing qmax / SBC',
      category: 'bearing',
      status: statusFromUtilization(bearingUtilization),
      demand: quantity(qMaxKPa, 'kPa'),
      capacity: quantity(soil.sbcGrossKPa, 'kPa'),
      utilization: bearingUtilization,
      evidence: servicePressureEvidence,
      capacitySource: soil.sbcSource,
      detail: `qmax=${qMaxKPa} kPa; gross SBC=${soil.sbcGrossKPa} kPa; SBC source=${soil.sbcSource}`,
    }));
  } else {
    checks.push(holdCheck({
      id: 'bearing-capacity',
      label: 'Gross service bearing qmax / SBC',
      category: 'bearing',
      evidence: servicePressureEvidence,
      capacitySource: soil.sbcSource,
      detail: `Elastic trial qmax=${qMaxKPa} kPa is retained for trace, but qmax/SBC is HOLD because partial-contact redistribution is outside R1.`,
    }));
  }
  checks.push(evaluatedCheck({
    id: 'full-contact-qmin',
    label: 'Full service contact qmin >= 0',
    category: 'bearing',
    status: qMinKPa >= -EPSILON ? 'PASS' : 'FAIL',
    demand: quantity(qMinKPa, 'kPa'),
    capacity: quantity(0, 'kPa minimum'),
    utilization: null,
    evidence: servicePressureEvidence,
    detail: qMinKPa >= -EPSILON ? 'All four elastic corner pressures are nonnegative.' : 'Partial contact/uplift redistribution is outside R1.',
  }));
  checks.push(evaluatedCheck({
    id: 'combined-kern',
    label: 'Combined biaxial middle-third condition',
    category: 'bearing',
    status: statusFromUtilization(combinedKernRatio),
    demand: quantity(combinedKernRatio, 'ratio'),
    capacity: quantity(1, 'ratio'),
    utilization: combinedKernRatio,
    evidence: eccentricityEvidence,
    detail: `6|ex|/B + 6|ey|/L = ${combinedKernRatio}`,
  }));

  const puColumnKN = combination.gammaD * loads.deadKN + combination.gammaL * loads.liveKN;
  const puGrossKN = puColumnKN + combination.gammaD * distributedDeadWeightKN;
  const quGrossKPa = puGrossKN / areaM2;
  const factoredDistributedDeadKPa = combination.gammaD * distributedDeadWeightKN / areaM2;
  const quNetKPa = quGrossKPa - factoredDistributedDeadKPa;
  const quNetCancellationKPa = puColumnKN / areaM2;
  const loadCombinationEvidence = addEquation(sourceRecord({
    equationId: `SF-EQ-${combination.id}`,
    standard: combination.standard,
    edition: combination.edition,
    clause: combination.clause,
    formula: combination.equation,
    substitution: `Pu,column = ${combination.gammaD}(${loads.deadKN}) + ${combination.gammaL}(${loads.liveKN}) = ${puColumnKN} kN`,
    canonicalUnits: 'kN',
    assumptions: [
      combination.applicability,
      `สมการมาตรฐาน: ${combination.normativeEquation}`,
      combination.memberStrengthBoundary,
    ],
    sourceUrl: combination.sourceUrl,
    sourceTitle: combination.sourceTitle,
  }));
  const factoredEquilibriumEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM',
    standard: `${combination.standard}; engineering equilibrium`,
    edition: combination.edition,
    clause: `${combination.clause}; SPEC_SPREAD_FOOTING_ENGINE §6.2`,
    formula: 'qu,gross = [Pu,column + gammaD(Wf + Ws)]/(BL); qu,net = qu,gross - gammaD(Wf + Ws)/(BL) = Pu,column/(BL)',
    substitution: `qu,gross=${quGrossKPa}; distributed dead=${factoredDistributedDeadKPa}; qu,net=${quNetKPa}; cancellation=${quNetCancellationKPa} kPa`,
    canonicalUnits: 'kN, kPa, m2',
    assumptions: ['Footing and overburden dead loads are uniform over the same footing plan area.', 'Member-strip actions use the net upward reaction after explicit cancellation.'],
    sourceUrl: combination.sourceUrl,
    sourceTitle: `${combination.sourceTitle}; R1 gross/net equilibrium contract`,
  }));

  const hMm = footing.thicknessM * 1000;
  const coverMm = footing.coverM * 1000;
  const dbA = inputRebar.A.diameterMm;
  const dbB = inputRebar.B.diameterMm;
  const dAMm = hMm - coverMm - dbA / 2;
  const dBMm = hMm - coverMm - dbA - dbB / 2;
  const punchingDepthMm = Math.min(dAMm, dBMm);
  const cantileverAM = (footing.xM - column.xM) / 2;
  const cantileverBM = (footing.yM - column.yM) / 2;
  const depthEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-EFFECTIVE-DEPTH-A-B',
    standard: 'ACI 318-19; R1 layer-order contract',
    edition: '318-19',
    clause: 'Sections 2.3 and 13.3.1.2; SPEC_SPREAD_FOOTING_ENGINE §6.3',
    formula: 'dA = h - cover - dbA/2; dB = h - cover - dbA - dbB/2; dA,dB >= 150 mm',
    substitution: `dA=${hMm}-${coverMm}-${dbA}/2=${dAMm} mm; dB=${hMm}-${coverMm}-${dbA}-${dbB}/2=${dBMm} mm; minimum=${designStandardProfile.materialLimits.minimumEffectiveDepthMm} mm`,
    canonicalUnits: 'mm',
    assumptions: [
      'A bars are the lowest layer.',
      'B bars are immediately above A bars.',
      'Cover is measured to the outside surface of the lowest bar.',
      'The metric R1 profile applies the ACI 318-19 Section 13.3.1.2 minimum effective depth to each orthogonal bottom-reinforcement direction.',
    ],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22), Building Code Requirements for Structural Concrete and Commentary',
  }));
  const beta1Evidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-BETA1-CONCRETE-STRESS-BLOCK',
    standard: 'ACI 318-19',
    edition: '318-19',
    clause: 'Section 22.2.2.4.3',
    formula: "beta1=0.85 for f'c<=28 MPa; beta1=max[0.85-0.05(f'c-28)/7, 0.65] for f'c>28 MPa, with the profile boundary beta1=0.65 at f'c>=55 MPa",
    substitution: `f'c=${materials.fcMPa} MPa; beta1=${materials.beta1}`,
    canonicalUnits: 'MPa, dimensionless',
    assumptions: ['Normalweight nonprestressed concrete.', 'The R1 profile uses the ACI metric piecewise boundary at 28 MPa and 55 MPa.'],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22), Section 22.2.2.4.3 equivalent rectangular concrete stress distribution',
  }));
  const minimumConcreteStrengthEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-MATERIAL-FC-MINIMUM',
    standard: 'ACI 318-19',
    edition: '318-19',
    clause: 'Table 19.2.1.1; ACI MNL-17(21) Section 1.5',
    formula: "f'c >= 17 MPa (2500 psi) for the R1 general-use member-strength profile",
    substitution: `f'c=${materials.fcMPa} MPa >= ${designStandardProfile.materialLimits.fcMPa[0]} MPa`,
    canonicalUnits: 'MPa',
    assumptions: ['R1 uses the general-use ACI member-strength boundary and does not establish a separate low-strength concrete profile.', 'Project durability and exposure requirements may require a higher strength and remain Owner/PE review items.'],
    sourceUrl: OFFICIAL_ACI_MNL17_PREVIEW_URL,
    sourceTitle: 'ACI Reinforced Concrete Design Handbook MNL-17(21), companion to ACI 318-19, minimum concrete strength guidance',
  }));

  const spacingEvidenceA = addEquation(sourceRecord({
    equationId: 'SF-EQ-PROVIDED-REBAR-A',
    standard: 'Geometric bar distribution; ACI 318-19 reinforcement area definition',
    edition: '318-19',
    clause: 'Chapter 20; SPEC_SPREAD_FOOTING_ENGINE §6.7',
    formula: 'spacing = (distribution width - 2cover - db)/(count - 1); As,provided = (pi db^2/4)(1000/spacing)',
    substitution: `sA=(${footing.yM * 1000}-2(${coverMm})-${dbA})/(${inputRebar.A.count}-1) mm`,
    canonicalUnits: 'mm, mm2/m',
    assumptions: ['First and last bar centerlines are cover + db/2 from opposite side faces.', 'Bars are uniformly distributed center-to-center.'],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22) reinforcement provisions and Owner-authorized R1 distribution geometry',
  }));
  const spacingEvidenceB = addEquation(sourceRecord({
    equationId: 'SF-EQ-PROVIDED-REBAR-B',
    standard: 'Geometric bar distribution; ACI 318-19 reinforcement area definition',
    edition: '318-19',
    clause: 'Chapter 20; SPEC_SPREAD_FOOTING_ENGINE §6.7',
    formula: 'spacing = (distribution width - 2cover - db)/(count - 1); As,provided = (pi db^2/4)(1000/spacing)',
    substitution: `sB=(${footing.xM * 1000}-2(${coverMm})-${dbB})/(${inputRebar.B.count}-1) mm`,
    canonicalUnits: 'mm, mm2/m',
    assumptions: ['First and last bar centerlines are cover + db/2 from opposite side faces.', 'Bars are uniformly distributed center-to-center.'],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22) reinforcement provisions and Owner-authorized R1 distribution geometry',
  }));

  const spacingAMm = (footing.yM * 1000 - 2 * coverMm - dbA) / (inputRebar.A.count - 1);
  const spacingBMm = (footing.xM * 1000 - 2 * coverMm - dbB) / (inputRebar.B.count - 1);
  const areaBarA = barAreaMm2(dbA);
  const areaBarB = barAreaMm2(dbB);
  const rebarMarkPrefix = normalizedString(project.memberMark, 'F-01')
    .toUpperCase()
    .replace(/[^A-Z0-9ก-๙]/g, '') || 'F01';
  const providedAsA = areaBarA * 1000 / spacingAMm;
  const providedAsB = areaBarB * 1000 / spacingBMm;
  const reinforcementA = {
    direction: 'A',
    axis: 'X',
    mark: `${rebarMarkPrefix}-A`,
    layer: 'LOWEST',
    count: inputRebar.A.count,
    diameterMm: dbA,
    spacingMm: spacingAMm,
    barAreaMm2: areaBarA,
    providedAreaMm2PerM: providedAsA,
    centerElevationMm: coverMm + dbA / 2,
    effectiveDepthMm: dAMm,
    runLengthM: footing.xM,
    distributionWidthM: footing.yM,
    evidence: spacingEvidenceA,
  };
  const reinforcementB = {
    direction: 'B',
    axis: 'Y',
    mark: `${rebarMarkPrefix}-B`,
    layer: 'ABOVE_A',
    count: inputRebar.B.count,
    diameterMm: dbB,
    spacingMm: spacingBMm,
    barAreaMm2: areaBarB,
    providedAreaMm2PerM: providedAsB,
    centerElevationMm: coverMm + dbA + dbB / 2,
    effectiveDepthMm: dBMm,
    runLengthM: footing.yM,
    distributionWidthM: footing.xM,
    evidence: spacingEvidenceB,
  };
  reinforcementA.planCenterlines = makePlanBarCenterlines({
    direction: 'A',
    reinforcement: reinforcementA,
    footing,
    coverM: footing.coverM,
  });
  reinforcementB.planCenterlines = makePlanBarCenterlines({
    direction: 'B',
    reinforcement: reinforcementB,
    footing,
    coverM: footing.coverM,
  });

  const topCutEndElevationMm = hMm - coverMm;
  const makeBarCut = (direction, memberLengthM, rebar, bottomCenterElevationMm) => {
    const innerRadiusMm = 3 * rebar.diameterMm;
    const radiusCenterlineMm = innerRadiusMm + rebar.diameterMm / 2;
    const horizontalTangentMm = memberLengthM * 1000
      - 2 * coverMm
      - rebar.diameterMm
      - 2 * radiusCenterlineMm;
    const verticalTangentMm = topCutEndElevationMm
      - bottomCenterElevationMm
      - radiusCenterlineMm;
    const centerlineLengthMm = horizontalTangentMm
      + 2 * verticalTangentMm
      + Math.PI * radiusCenterlineMm;
    const evidence = addEquation(sourceRecord({
      equationId: `SF-EQ-GEOMETRIC-BAR-CUT-${direction}`,
      standard: 'R1 geometric centerline reference; ACI 318-19 detailing applicability HOLD',
      edition: '318-19 / SF-SDM-ACI19-R1',
      clause: 'ACI 318-19 Chapter 25; SPEC_SPREAD_FOOTING_ENGINE §6.7',
      formula: 'Ri=3db; Rcl=Ri+db/2; Ltangent,h=L-2cover-db-2Rcl; Ltangent,v=ztop-zbar-Rcl; Lcl=Ltangent,h+2Ltangent,v+pi Rcl',
      substitution: `Ri=${innerRadiusMm}; Rcl=${radiusCenterlineMm}; Lh=${horizontalTangentMm}; Lv=${verticalTangentMm}; Lcl=${centerlineLengthMm} mm`,
      canonicalUnits: 'mm',
      assumptions: ['This is geometric centerline length only.', 'It is not a standard hook, development length, fabrication shape code, or released BBS.', 'Bend suitability, corner staggering, springback, and tolerances remain HOLD.'],
      sourceUrl: OFFICIAL_ACI_URL,
      sourceTitle: 'ACI CODE-318-19(22) Chapter 25 applicability boundary and Owner-authorized R1 geometric Bar Cut contract',
      verificationStatus: 'GEOMETRIC_REFERENCE_ONLY_HOLD_OWNER_PE',
    }));
    return {
      direction,
      mark: rebar.mark,
      count: rebar.count,
      diameterMm: rebar.diameterMm,
      innerRadiusMm,
      centerlineRadiusMm: radiusCenterlineMm,
      horizontalTangentMm,
      verticalTangentMm,
      bottomCenterElevationMm,
      topCutEndElevationMm,
      centerlineLengthMm,
      centerlineLengthM: centerlineLengthMm / 1000,
      totalCenterlineLengthM: centerlineLengthMm * rebar.count / 1000,
      geometryStatus: 'CALCULATED',
      detailingStatus: 'HOLD',
      authorization: 'NOT RELEASED BBS',
      polylineMm: makeUpturnPolyline({
        memberLengthMm: memberLengthM * 1000,
        coverMm,
        diameterMm: rebar.diameterMm,
        bottomCenterElevationMm,
        topCutEndElevationMm,
      }),
      evidence,
    };
  };
  const barCutA = makeBarCut('A', footing.xM, reinforcementA, reinforcementA.centerElevationMm);
  const barCutB = makeBarCut('B', footing.yM, reinforcementB, reinforcementB.centerElevationMm);

  const hasUnsupportedStrengthMoments = Math.abs(loads.serviceMxKNm) > EPSILON
    || Math.abs(loads.serviceMyKNm) > EPSILON;
  const fullContact = serviceFullContact;
  const strengthEligible = !hasUnsupportedStrengthMoments && fullContact;
  const strengthBasisEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-R1-STRENGTH-APPLICABILITY',
    standard: 'SF-SDM-ACI19-R1 support boundary',
    edition: SPREAD_FOOTING_ENGINE_PROFILE.engineVersion,
    clause: 'SPEC_SPREAD_FOOTING_ENGINE §4',
    formula: 'strength applicable only when Mx=My=0 and full service contact is verified',
    substitution: `Mx=${loads.serviceMxKNm} kN.m; My=${loads.serviceMyKNm} kN.m; qmin=${qMinKPa} kPa; combined kern=${combinedKernRatio}`,
    canonicalUnits: 'kN.m, kPa, dimensionless',
    assumptions: ['The current form does not separate dead- and live-load moment components.', 'No eccentric-footing strength method or partial-contact redistribution is implemented.'],
    sourceUrl: OFFICIAL_ACI_PREVIEW_URL,
    sourceTitle: 'ACI 318-19 official preview plus Owner-authorized SF-SDM-ACI19-R1 support boundary',
    verificationStatus: strengthEligible ? 'R1_APPLICABILITY_EVALUATED' : 'NOT_EVALUATED_HOLD',
  }));
  if (strengthEligible) {
    checks.push(evaluatedCheck({
      id: 'strength-applicability',
      label: 'R1 centered full-contact strength applicability',
      category: 'strength-basis',
      status: 'PASS',
      demand: quantity(0, 'service moment components'),
      capacity: quantity(0, 'required for R1'),
      utilization: null,
      evidence: strengthBasisEvidence,
      detail: 'Mx=My=0 and full service contact is verified.',
    }));
  } else {
    checks.push(holdCheck({
      id: 'strength-applicability',
      label: 'R1 centered full-contact strength applicability',
      category: 'strength-basis',
      evidence: strengthBasisEvidence,
      detail: hasUnsupportedStrengthMoments
        ? 'Service bearing is evaluated, but factored moment components and an eccentric-footing strength method are missing.'
        : 'Partial contact/uplift redistribution is outside R1; flexure and shear strength are held.',
    }));
  }

  const flexure = {};
  const oneWayShear = {};
  const minimumSteelEvidence = {};
  const flexureEvidence = {};
  const tensionEvidence = {};
  const oneWayEvidence = {};
  for (const direction of ['A', 'B']) {
    const rebar = direction === 'A' ? reinforcementA : reinforcementB;
    const depthMm = direction === 'A' ? dAMm : dBMm;
    const cantileverM = direction === 'A' ? cantileverAM : cantileverBM;
    const providedAs = rebar.providedAreaMm2PerM;
    const muKNmPerM = strengthEligible ? quNetKPa * cantileverM ** 2 / 2 : null;
    const asMinimumMm2PerM = designStandardProfile.minimumReinforcementPolicy.ratio * 1000 * hMm;
    const solved = strengthEligible
      ? solveRequiredSteelMm2({
        muKNmPerM,
        phi: materials.phiFlexure,
        fyMPa: materials.fyMPa,
        fcMPa: materials.fcMPa,
        widthMm: 1000,
        depthMm,
      })
      : { areaMm2: null, discriminant: null };
    const requiredAs = solved.areaMm2 === null ? null : Math.max(solved.areaMm2, asMinimumMm2PerM);
    const compressionBlockMm = providedAs * materials.fyMPa / (0.85 * materials.fcMPa * 1000);
    const neutralAxisMm = compressionBlockMm / materials.beta1;
    const tensileStrain = materials.epsilonCu * (depthMm - neutralAxisMm) / neutralAxisMm;
    const yieldStrain = materials.fyMPa / materials.steelModulusMPa;
    const tensionControlledThreshold = yieldStrain + 0.003;
    const tensionControlled = Number.isFinite(tensileStrain)
      && tensileStrain >= tensionControlledThreshold - EPSILON;
    const nominalMnKNmPerM = providedAs * materials.fyMPa * (depthMm - compressionBlockMm / 2) / 1e6;
    const trialPhiMnKNmPerM = materials.phiFlexure * nominalMnKNmPerM;
    const flexureUtilization = strengthEligible && tensionControlled && trialPhiMnKNmPerM > 0
      ? muKNmPerM / trialPhiMnKNmPerM
      : null;

    minimumSteelEvidence[direction] = addEquation(sourceRecord({
      equationId: `SF-EQ-MINIMUM-STEEL-${direction}`,
      standard: 'ACI 318-19',
      edition: '318-19',
      clause: 'Sections 13.3.3.1 and 8.6.1.1',
      formula: 'As,min = 0.0018 b h',
      substitution: `As,min=0.0018(1000)(${hMm})=${asMinimumMm2PerM} mm2/m`,
      canonicalUnits: 'mm2/m',
      assumptions: ['One-metre footing strip.', 'Nonprestressed footing flexural reinforcement follows the two-way slab minimum referenced by Section 13.3.3.1.', 'Orthogonal bottom reinforcement is checked independently in each direction.'],
      sourceUrl: OFFICIAL_ACI_URL,
      sourceTitle: 'ACI CODE-318-19(22), Sections 13.3.3.1 and 8.6.1.1 footing/slab minimum reinforcement provisions',
    }));
    flexureEvidence[direction] = addEquation(sourceRecord({
      equationId: `SF-EQ-FLEXURE-${direction}`,
      standard: 'ACI 318-19',
      edition: '318-19',
      clause: 'Sections 13.2.7, 21.2, and 22.2; SPEC_SPREAD_FOOTING_ENGINE §6.4',
      formula: 'Mu=qu l^2/2; a=As fy/(0.85 f_c b); phiMn=phi As fy(d-a/2); solve exact quadratic for smaller physical As root',
      substitution: strengthEligible
        ? `Mu=${muKNmPerM} kN.m/m; d=${depthMm} mm; As,strength=${solved.areaMm2}; As,min=${asMinimumMm2PerM}; As,provided=${providedAs}; trial phiMn=${trialPhiMnKNmPerM}`
        : 'Strength demand not formed because R1 applicability is HOLD.',
      canonicalUnits: 'kN.m/m, MPa, mm, mm2/m',
      assumptions: ['One-metre strip at the column face.', 'Uniform qu,net from centered axial factored reaction.', 'phi=0.90 is usable only after the separate tension-controlled strain check passes.'],
      sourceUrl: OFFICIAL_ACI_URL,
      sourceTitle: 'ACI CODE-318-19(22), flexural strength and shallow-foundation provisions',
      verificationStatus: strengthEligible ? 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW' : 'NOT_EVALUATED_HOLD',
    }));
    tensionEvidence[direction] = addEquation(sourceRecord({
      equationId: `SF-EQ-TENSION-CONTROL-${direction}`,
      standard: 'ACI 318-19',
      edition: '318-19',
      clause: 'Sections 21.2.2 and 22.2.2.4.3; Table 21.2.1',
      formula: 'c=a/beta1; epsilon_t=0.003(d-c)/c; tension-controlled when epsilon_t >= epsilon_ty + 0.003; epsilon_ty=fy/Es',
      substitution: `a=${compressionBlockMm} mm; beta1=${materials.beta1}; c=${compressionBlockMm}/${materials.beta1}=${neutralAxisMm} mm; epsilon_t=${tensileStrain}; epsilon_ty+0.003=${tensionControlledThreshold}`,
      canonicalUnits: 'mm, strain (dimensionless)',
      assumptions: ['Es=200000 MPa.', 'Extreme concrete compression strain is 0.003.', 'Provided reinforcement controls the phi applicability check.'],
      sourceUrl: OFFICIAL_ACI_CHANGES_URL,
      sourceTitle: 'ACI official summary of key changes in the 2019 edition, including tension-controlled strain provisions',
      verificationStatus: strengthEligible ? 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW' : 'NOT_EVALUATED_HOLD',
    }));

    flexure[direction] = {
      direction,
      status: !strengthEligible
        ? 'HOLD'
        : solved.areaMm2 === null || !tensionControlled || statusFromUtilization(flexureUtilization) === 'FAIL'
          ? 'FAIL'
          : 'PASS',
      cantileverM,
      muKNmPerM,
      widthMm: 1000,
      depthMm,
      asStrengthMm2PerM: solved.areaMm2,
      quadraticDiscriminantMm2: solved.discriminant,
      asMinimumMm2PerM,
      asRequiredMm2PerM: requiredAs,
      asProvidedMm2PerM: providedAs,
      compressionBlockMm,
      neutralAxisMm,
      nominalMnKNmPerM,
      phiMnKNmPerM: tensionControlled ? trialPhiMnKNmPerM : null,
      trialPhiMnKNmPerM,
      utilization: flexureUtilization,
      tensionControl: {
        status: strengthEligible ? (tensionControlled ? 'PASS' : 'FAIL') : 'HOLD',
        tensileStrain,
        yieldStrain,
        threshold: tensionControlledThreshold,
        phi: materials.phiFlexure,
        phiApplicable: strengthEligible && tensionControlled,
        beta1Evidence,
        evidence: tensionEvidence[direction],
      },
      minimumSteelEvidence: minimumSteelEvidence[direction],
      minimumConcreteStrengthEvidence,
      evidence: flexureEvidence[direction],
    };

    if (strengthEligible) {
      const providedSteelUtilization = requiredAs !== null && providedAs > 0 ? requiredAs / providedAs : null;
      checks.push(evaluatedCheck({
        id: `provided-steel-${direction.toLowerCase()}`,
        label: `Provided reinforcement ${direction}`,
        category: 'reinforcement',
        status: statusFromUtilization(providedSteelUtilization),
        demand: quantity(requiredAs, 'mm2/m'),
        capacity: quantity(providedAs, 'mm2/m'),
        utilization: providedSteelUtilization,
        evidence: minimumSteelEvidence[direction],
        detail: `As,required=max(As,strength, As,min)=${requiredAs}; As,provided=${providedAs} mm2/m`,
      }));
      checks.push(evaluatedCheck({
        id: `tension-controlled-${direction.toLowerCase()}`,
        label: `Tension-controlled phi applicability ${direction}`,
        category: 'flexure',
        status: tensionControlled ? 'PASS' : 'FAIL',
        demand: quantity(tensionControlledThreshold, 'strain minimum'),
        capacity: quantity(tensileStrain, 'strain provided'),
        utilization: tensileStrain > 0 ? tensionControlledThreshold / tensileStrain : null,
        evidence: tensionEvidence[direction],
        detail: tensionControlled ? 'phi=0.90 is applicable to the provided section.' : 'phi=0.90 is not applicable; flexural capacity is held fail-closed.',
      }));
      if (tensionControlled) {
        checks.push(evaluatedCheck({
          id: `flexure-capacity-${direction.toLowerCase()}`,
          label: `Flexural capacity ${direction}`,
          category: 'flexure',
          status: statusFromUtilization(flexureUtilization),
          demand: quantity(muKNmPerM, 'kN.m/m'),
          capacity: quantity(trialPhiMnKNmPerM, 'kN.m/m'),
          utilization: flexureUtilization,
          evidence: flexureEvidence[direction],
          detail: `Renderer must use Mu/phiMn=${flexureUtilization}; As ratios are not a capacity substitute.`,
        }));
      } else {
        checks.push(holdCheck({
          id: `flexure-capacity-${direction.toLowerCase()}`,
          label: `Flexural capacity ${direction}`,
          category: 'flexure',
          evidence: flexureEvidence[direction],
          detail: 'Provided section is not tension-controlled; R1 does not interpolate phi.',
        }));
      }
    } else {
      for (const [suffix, label, evidence] of [
        [`provided-steel-${direction.toLowerCase()}`, `Provided reinforcement ${direction}`, minimumSteelEvidence[direction]],
        [`tension-controlled-${direction.toLowerCase()}`, `Tension-controlled phi applicability ${direction}`, tensionEvidence[direction]],
        [`flexure-capacity-${direction.toLowerCase()}`, `Flexural capacity ${direction}`, flexureEvidence[direction]],
      ]) {
        checks.push(holdCheck({
          id: suffix,
          label,
          category: suffix.startsWith('provided') ? 'reinforcement' : 'flexure',
          evidence,
          detail: 'Strength calculation is outside the current R1 applicability boundary.',
        }));
      }
    }

    const rhoW = providedAs / (1000 * depthMm);
    const vuKNPerM = strengthEligible ? quNetKPa * Math.max(cantileverM - depthMm / 1000, 0) : null;
    const vcRhoN = 0.66
      * materials.lambdaS
      * materials.lambda
      * Math.cbrt(rhoW)
      * Math.sqrt(materials.fcMPa)
      * 1000
      * depthMm;
    const vcCapN = 0.42
      * materials.lambda
      * Math.sqrt(materials.fcMPa)
      * 1000
      * depthMm;
    const vcKN = Math.min(vcRhoN, vcCapN) / 1000;
    const phiVcKN = materials.phiShear * vcKN;
    const shearUtilization = strengthEligible && phiVcKN > 0 ? vuKNPerM / phiVcKN : null;
    oneWayEvidence[direction] = addEquation(sourceRecord({
      equationId: `SF-EQ-ONE-WAY-SHEAR-${direction}`,
      standard: 'ACI 318-19',
      edition: '318-19',
      clause: 'Table 22.5.5.1(c), 22.5.5.1.1, and 13.2.6.2',
      formula: 'Vu=qu max(l-d,0); rho_w=As/(bd); Vc=min[0.66 lambda_s lambda rho_w^(1/3)sqrt(f_c)bd, 0.42 lambda sqrt(f_c)bd]; phiVc=0.75Vc',
      substitution: strengthEligible
        ? `Vu=${vuKNPerM} kN/m; rho=${rhoW}; Vc,rho=${vcRhoN / 1000} kN; Vc,cap=${vcCapN / 1000} kN; phiVc=${phiVcKN} kN`
        : 'Strength demand not formed because R1 applicability is HOLD.',
      canonicalUnits: 'kN/m, MPa, mm, mm2/m',
      assumptions: ['No shear reinforcement.', 'Normalweight concrete lambda=1.', 'Footing exception lambda_s=1 is used; the longitudinal reinforcement ratio term is retained.', 'One-metre strip.'],
      sourceUrl: OFFICIAL_ACI_URL,
      sourceTitle: 'ACI CODE-318-19(22), one-way shear and shallow-foundation size-effect provisions',
      verificationStatus: strengthEligible ? 'CLAUSE_IDENTITY_RELEASE_GATE' : 'NOT_EVALUATED_HOLD',
    }));
    oneWayShear[direction] = {
      direction,
      status: strengthEligible ? statusFromUtilization(shearUtilization) : 'HOLD',
      cantileverM,
      criticalDistanceFromColumnFaceM: depthMm / 1000,
      depthMm,
      vuKNPerM,
      rhoW,
      vcRhoKNPerM: vcRhoN / 1000,
      vcCapKNPerM: vcCapN / 1000,
      governingVcKNPerM: vcKN,
      phiVcKNPerM: phiVcKN,
      utilization: shearUtilization,
      lambdaS: materials.lambdaS,
      evidence: oneWayEvidence[direction],
    };
    if (strengthEligible) {
      checks.push(evaluatedCheck({
        id: `one-way-shear-${direction.toLowerCase()}`,
        label: `One-way shear ${direction}`,
        category: 'one-way-shear',
        status: statusFromUtilization(shearUtilization),
        demand: quantity(vuKNPerM, 'kN/m'),
        capacity: quantity(phiVcKN, 'kN/m'),
        utilization: shearUtilization,
        evidence: oneWayEvidence[direction],
        detail: `Table 22.5.5.1(c) rho term retained; lambda_s=1 footing exception; 0.42 cap applied.`,
      }));
    } else {
      checks.push(holdCheck({
        id: `one-way-shear-${direction.toLowerCase()}`,
        label: `One-way shear ${direction}`,
        category: 'one-way-shear',
        evidence: oneWayEvidence[direction],
        detail: 'Strength calculation is outside the current R1 applicability boundary.',
      }));
    }
  }

  const footingLongAxis = footing.xM >= footing.yM ? 'X' : 'Y';
  const footingLongDimensionM = Math.max(footing.xM, footing.yM);
  const footingShortDimensionM = Math.min(footing.xM, footing.yM);
  const footingAspectRatio = footingLongDimensionM / footingShortDimensionM;
  const shortDirection = footingLongAxis === 'X' ? 'B' : 'A';
  const shortDirectionRebar = shortDirection === 'A' ? reinforcementA : reinforcementB;
  const shortDirectionZones = classifyBarsByCenteredBand(
    shortDirectionRebar.planCenterlines,
    shortDirection,
    footingShortDimensionM,
  );
  const shortDirectionTotalRequiredMm2 = strengthEligible
    ? flexure[shortDirection].asRequiredMm2PerM * footingLongDimensionM
    : null;
  const centerBandFraction = 2 / (footingAspectRatio + 1);
  const centerBandRequiredMm2 = strengthEligible
    ? centerBandFraction * shortDirectionTotalRequiredMm2
    : null;
  const eachOuterZoneRequiredMm2 = strengthEligible
    ? (shortDirectionTotalRequiredMm2 - centerBandRequiredMm2) / 2
    : null;
  const makeDistributionZone = (id, widthM, bars, requiredAreaMm2) => {
    const providedAreaMm2 = bars.length * shortDirectionRebar.barAreaMm2;
    const utilization = strengthEligible
      ? requiredProvidedUtilization(requiredAreaMm2, providedAreaMm2)
      : null;
    return {
      id,
      widthM,
      barCount: bars.length,
      barIds: bars.map((bar) => bar.id),
      requiredAreaMm2,
      providedAreaMm2,
      utilization,
      status: strengthEligible ? statusFromUtilization(utilization) : 'HOLD',
    };
  };
  const shortDirectionDistributionZones = {
    center: makeDistributionZone(
      'center',
      footingShortDimensionM,
      shortDirectionZones.center,
      centerBandRequiredMm2,
    ),
    outerNegative: makeDistributionZone(
      'outer-negative',
      (footingLongDimensionM - footingShortDimensionM) / 2,
      shortDirectionZones.outerNegative,
      eachOuterZoneRequiredMm2,
    ),
    outerPositive: makeDistributionZone(
      'outer-positive',
      (footingLongDimensionM - footingShortDimensionM) / 2,
      shortDirectionZones.outerPositive,
      eachOuterZoneRequiredMm2,
    ),
  };
  const distributionGoverningZone = strengthEligible
    ? Object.values(shortDirectionDistributionZones).reduce((governing, zone) => (
      !governing
        || (zone.status === 'FAIL' && governing.status !== 'FAIL')
        || (
          zone.status === governing.status
          && Number.isFinite(zone.utilization)
          && (!Number.isFinite(governing.utilization) || zone.utilization > governing.utilization)
        )
        ? zone
        : governing
    ), null)
    : null;
  const shortDirectionDistributionEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-SHORT-DIRECTION-BAND-DISTRIBUTION',
    standard: 'ACI 318-19',
    edition: '318-19',
    clause: 'Section 13.3.3.3',
    formula: 'beta_f=Llong/Lshort; gamma_center=2/(beta_f+1); As,center=gamma_center As,total; As,each outer=(As,total-As,center)/2',
    substitution: strengthEligible
      ? `axis,long=${footingLongAxis}; short-direction=${shortDirection}; beta_f=${footingAspectRatio}; As,total=${shortDirectionTotalRequiredMm2} mm2; center fraction=${centerBandFraction}; As,center req/prov=${centerBandRequiredMm2}/${shortDirectionDistributionZones.center.providedAreaMm2}; As,outer(-) req/prov=${eachOuterZoneRequiredMm2}/${shortDirectionDistributionZones.outerNegative.providedAreaMm2}; As,outer(+) req/prov=${eachOuterZoneRequiredMm2}/${shortDirectionDistributionZones.outerPositive.providedAreaMm2}`
      : 'Strength demand and required band reinforcement are not formed because R1 applicability is HOLD.',
    canonicalUnits: 'm, mm2, dimensionless',
    assumptions: [
      'The short-direction bars run parallel to the short footing dimension and are distributed across the long footing dimension.',
      'The centered band width equals the short footing dimension.',
      'Actual provided area is counted from bar centerlines inside the center band and each outside zone; a per-metre average is not substituted.',
      'The remaining required short-direction reinforcement is divided equally between the two outside zones.',
    ],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22), Section 13.3.3.3 rectangular-footing short-direction reinforcement distribution',
    verificationStatus: strengthEligible ? 'INDEPENDENT_STRUCTURAL_REVIEW_REQUIRED' : 'NOT_EVALUATED_HOLD',
  }));
  const shortDirectionDistribution = {
    status: strengthEligible ? distributionGoverningZone.status : 'HOLD',
    longAxis: footingLongAxis,
    shortAxis: footingLongAxis === 'X' ? 'Y' : 'X',
    shortDirection,
    longDimensionM: footingLongDimensionM,
    shortDimensionM: footingShortDimensionM,
    aspectRatio: footingAspectRatio,
    centerBandWidthM: footingShortDimensionM,
    centerBandFraction,
    totalRequiredAreaMm2: shortDirectionTotalRequiredMm2,
    barAreaMm2: shortDirectionRebar.barAreaMm2,
    totalProvidedAreaMm2: shortDirectionRebar.count * shortDirectionRebar.barAreaMm2,
    zones: shortDirectionDistributionZones,
    governingZoneId: distributionGoverningZone?.id || null,
    utilization: distributionGoverningZone?.utilization ?? null,
    evidence: shortDirectionDistributionEvidence,
  };
  if (strengthEligible) {
    checks.push(evaluatedCheck({
      id: 'short-direction-band-distribution',
      label: `Short-direction ${shortDirection} reinforcement band distribution`,
      category: 'reinforcement',
      status: distributionGoverningZone.status,
      demand: quantity(distributionGoverningZone.requiredAreaMm2, 'mm2 in governing band'),
      capacity: quantity(distributionGoverningZone.providedAreaMm2, 'mm2 actually counted'),
      utilization: distributionGoverningZone.utilization,
      evidence: shortDirectionDistributionEvidence,
      detail: `Center bars=${shortDirectionDistributionZones.center.barCount}; outer bars=${shortDirectionDistributionZones.outerNegative.barCount}+${shortDirectionDistributionZones.outerPositive.barCount}; governing zone=${distributionGoverningZone.id}.`,
    }));
  } else {
    checks.push(holdCheck({
      id: 'short-direction-band-distribution',
      label: `Short-direction ${shortDirection} reinforcement band distribution`,
      category: 'reinforcement',
      evidence: shortDirectionDistributionEvidence,
      detail: 'Strength calculation is outside the current R1 applicability boundary.',
    }));
  }

  const punchingCriticalXM = column.xM + punchingDepthMm / 1000;
  const punchingCriticalYM = column.yM + punchingDepthMm / 1000;
  const punchingInsideAreaM2 = punchingCriticalXM * punchingCriticalYM;
  const punchingPerimeterM = 2 * (punchingCriticalXM + punchingCriticalYM);
  const punchingPerimeterMm = punchingPerimeterM * 1000;
  const punchingVuKN = strengthEligible ? puColumnKN - quNetKPa * punchingInsideAreaM2 : null;
  const beta = Math.max(column.xM, column.yM) / Math.min(column.xM, column.yM);
  const sqrtFc = Math.sqrt(materials.fcMPa);
  const vc1MPa = 0.33 * materials.lambdaS * materials.lambda * sqrtFc;
  const vc2MPa = 0.17 * (1 + 2 / beta) * materials.lambdaS * materials.lambda * sqrtFc;
  const vc3MPa = 0.083
    * (2 + SPREAD_FOOTING_ENGINE_PROFILE.alphaSInterior * punchingDepthMm / punchingPerimeterMm)
    * materials.lambdaS
    * materials.lambda
    * sqrtFc;
  const punchingVcStressMPa = Math.min(vc1MPa, vc2MPa, vc3MPa);
  const punchingVcKN = punchingVcStressMPa * punchingPerimeterMm * punchingDepthMm / 1000;
  const punchingPhiVcKN = materials.phiShear * punchingVcKN;
  const punchingUtilization = strengthEligible && punchingPhiVcKN > 0
    ? punchingVuKN / punchingPhiVcKN
    : null;
  const punchingDemandStressMPa = strengthEligible
    ? punchingVuKN * 1000 / (punchingPerimeterMm * punchingDepthMm)
    : null;
  const punchingMinimumTriggerStressMPa = materials.phiShear
    * 0.17
    * materials.lambdaS
    * materials.lambda
    * sqrtFc;
  const punchingMinimumTriggered = strengthEligible
    ? punchingDemandStressMPa > punchingMinimumTriggerStressMPa + EPSILON
    : null;
  const punchingMinimumByDirection = {};
  for (const direction of ['A', 'B']) {
    const rebar = direction === 'A' ? reinforcementA : reinforcementB;
    const slabBandWidthM = direction === 'A'
      ? Math.min(footing.yM, column.yM + 3 * footing.thicknessM)
      : Math.min(footing.xM, column.xM + 3 * footing.thicknessM);
    const bandBars = classifyBarsByCenteredBand(
      rebar.planCenterlines,
      direction,
      slabBandWidthM,
    ).center;
    const providedBandAreaMm2 = bandBars.length * rebar.barAreaMm2;
    const requiredBandAreaMm2 = !strengthEligible
      ? null
      : punchingMinimumTriggered
        ? 5
          * punchingDemandStressMPa
          * (slabBandWidthM * 1000)
          * punchingPerimeterMm
          / (
            materials.phiShear
            * SPREAD_FOOTING_ENGINE_PROFILE.alphaSInterior
            * materials.fyMPa
          )
        : 0;
    const utilization = strengthEligible
      ? requiredProvidedUtilization(requiredBandAreaMm2, providedBandAreaMm2)
      : null;
    const evidence = addEquation(sourceRecord({
      equationId: `SF-EQ-PUNCHING-MINIMUM-FLEXURAL-STEEL-${direction}`,
      standard: 'SF-SDM-ACI19-R1 conservative extension',
      edition: 'R1 review basis / ACI 318-19',
      clause: 'R1 conservative extension of ACI 318-19 Section 8.6.1.2; ACI SP-353 (2022)',
      formula: 'vuv=Vu/(bo d); trigger when vuv>phi(0.17 lambda_s lambda sqrt(f_c)); bslab,A=min(Ly,cy+3h); bslab,B=min(Lx,cx+3h); As,total=5 vuv bslab bo/(phi alpha_s fy)',
      substitution: strengthEligible
        ? `direction=${direction}; vuv=${punchingDemandStressMPa} MPa; trigger=${punchingMinimumTriggerStressMPa} MPa; triggered=${punchingMinimumTriggered}; bslab=${slabBandWidthM * 1000} mm; bo=${punchingPerimeterMm} mm; As,required=${requiredBandAreaMm2} mm2; bars counted=${bandBars.length}; As,provided=${providedBandAreaMm2} mm2`
        : 'Punching demand and flexure-driven minimum reinforcement are not formed because R1 applicability is HOLD.',
      canonicalUnits: 'MPa, mm, mm2',
      assumptions: [
        'Centered interior support with alpha_s=40.',
        'Normalweight concrete lambda=1 and footing exception lambda_s=1.',
        'The band is centered on the column and is not wider than the footing.',
        'Actual provided area is the sum of discrete bar areas whose centerlines lie inside the band.',
        'ACI 318-19 is silent on whether the Chapter 8 punching-triggered minimum applies to spread footings.',
        'R1 applies Section 8.6.1.2 as an explicit conservative extension for engineering review; it is not represented as a direct footing mandate.',
        'Section 8.6.1.1 remains checked separately as the footing base minimum.',
      ],
      sourceUrl: OFFICIAL_ACI_SP353_FOOTING_PUNCHING_URL,
      sourceTitle: 'ACI SP-353: Effect of Flexural Reinforcement Ratio, Effective Depth and Slenderness Ratio on Punching Strength of Spread Footings',
      verificationStatus: strengthEligible ? 'R1_CONSERVATIVE_EXTENSION_OWNER_PE_REVIEW_REQUIRED' : 'NOT_EVALUATED_HOLD',
    }));
    punchingMinimumByDirection[direction] = {
      direction,
      status: strengthEligible ? statusFromUtilization(utilization) : 'HOLD',
      triggered: punchingMinimumTriggered,
      bandWidthM: slabBandWidthM,
      barCountWithinBand: bandBars.length,
      barIdsWithinBand: bandBars.map((bar) => bar.id),
      requiredAreaMm2: requiredBandAreaMm2,
      providedAreaMm2: providedBandAreaMm2,
      utilization,
      evidence,
    };
  }
  const punchingMinimumReinforcement = {
    status: !strengthEligible
      ? 'HOLD'
      : Object.values(punchingMinimumByDirection).some((entry) => entry.status === 'FAIL')
        ? 'FAIL'
        : 'PASS',
    triggered: punchingMinimumTriggered,
    demandStressMPa: punchingDemandStressMPa,
    triggerStressMPa: punchingMinimumTriggerStressMPa,
    alphaS: SPREAD_FOOTING_ENGINE_PROFILE.alphaSInterior,
    perimeterMm: punchingPerimeterMm,
    directions: punchingMinimumByDirection,
  };
  const punchingEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-INTERIOR-PUNCHING-SHEAR',
    standard: 'ACI 318-19',
    edition: '318-19',
    clause: 'Sections 22.6.4, 22.6.5, and 13.2.6.2',
    formula: 'bo=2[(cx+d)+(cy+d)]; Vu=Pu-qu(cx+d)(cy+d); vc=min[0.33, 0.17(1+2/beta), 0.083(2+alpha_s d/bo)]lambda_s lambda sqrt(f_c); phiVc=0.75 vc bo d',
    substitution: strengthEligible
      ? `d=${punchingDepthMm} mm; bo=${punchingPerimeterMm} mm; Vu=${punchingVuKN} kN; vc=[${vc1MPa},${vc2MPa},${vc3MPa}] MPa; phiVc=${punchingPhiVcKN} kN`
      : 'Strength demand not formed because R1 applicability is HOLD.',
    canonicalUnits: 'kN, MPa, mm',
    assumptions: ['Centered interior rectangular column.', 'Smaller of dA and dB is used conservatively.', 'alpha_s=40.', 'Normalweight concrete lambda=1 and footing exception lambda_s=1.', 'No unbalanced moment transfer or perimeter clipping.'],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22), two-way shear and shallow-foundation size-effect provisions',
    verificationStatus: strengthEligible ? 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW' : 'NOT_EVALUATED_HOLD',
  }));
  const punching = {
    status: strengthEligible ? statusFromUtilization(punchingUtilization) : 'HOLD',
    depthMm: punchingDepthMm,
    criticalDimensionsM: { xM: punchingCriticalXM, yM: punchingCriticalYM },
    insideAreaM2: punchingInsideAreaM2,
    perimeterM: punchingPerimeterM,
    perimeterMm: punchingPerimeterMm,
    beta,
    alphaS: SPREAD_FOOTING_ENGINE_PROFILE.alphaSInterior,
    vuKN: punchingVuKN,
    vcCandidatesMPa: { vc1: vc1MPa, vc2: vc2MPa, vc3: vc3MPa },
    governingVcStressMPa: punchingVcStressMPa,
    vcKN: punchingVcKN,
    phiVcKN: punchingPhiVcKN,
    utilization: punchingUtilization,
    lambdaS: materials.lambdaS,
    demandStressMPa: punchingDemandStressMPa,
    minimumFlexuralReinforcement: punchingMinimumReinforcement,
    evidence: punchingEvidence,
  };
  if (strengthEligible) {
    checks.push(evaluatedCheck({
      id: 'punching-shear',
      label: 'Interior two-way punching shear',
      category: 'punching-shear',
      status: statusFromUtilization(punchingUtilization),
      demand: quantity(punchingVuKN, 'kN'),
      capacity: quantity(punchingPhiVcKN, 'kN'),
      utilization: punchingUtilization,
      evidence: punchingEvidence,
      detail: 'Minimum of the three specified interior punching stress limits using smaller d.',
    }));
  } else {
    checks.push(holdCheck({
      id: 'punching-shear',
      label: 'Interior two-way punching shear',
      category: 'punching-shear',
      evidence: punchingEvidence,
      detail: 'Strength calculation is outside the current R1 applicability boundary.',
    }));
  }
  for (const direction of ['A', 'B']) {
    const minimum = punchingMinimumByDirection[direction];
    if (strengthEligible) {
      checks.push(evaluatedCheck({
        id: `punching-minimum-steel-${direction.toLowerCase()}`,
        label: `Punching-triggered minimum flexural reinforcement ${direction}`,
        category: 'reinforcement',
        status: minimum.status,
        demand: quantity(minimum.requiredAreaMm2, 'mm2 within bslab'),
        capacity: quantity(minimum.providedAreaMm2, 'mm2 actually counted'),
        utilization: minimum.utilization,
        evidence: minimum.evidence,
        detail: minimum.triggered
          ? `R1 conservative extension of Section 8.6.1.2 is triggered; ${minimum.barCountWithinBand} discrete bars lie within bslab=${minimum.bandWidthM} m. ACI 318-19 is silent on direct spread-footing applicability.`
          : `R1 conservative Section 8.6.1.2 threshold is not exceeded; base Section 8.6.1.1 minimum remains in provided-steel-${direction.toLowerCase()}.`,
      }));
    } else {
      checks.push(holdCheck({
        id: `punching-minimum-steel-${direction.toLowerCase()}`,
        label: `Punching-triggered minimum flexural reinforcement ${direction}`,
        category: 'reinforcement',
        evidence: minimum.evidence,
        detail: 'Strength calculation is outside the current R1 applicability boundary.',
      }));
    }
  }

  const requiredHolds = [
    ['settlement', 'Settlement', 'geotechnical', 'ACI 318-19 Chapter 13 scope boundary; project geotechnical report required', 'Settlement analysis and allowable movement evidence are not supplied.', OFFICIAL_ACI_FOOTING_EXAMPLE_URL],
    ['sliding-overturning', 'Sliding and overturning', 'stability', 'ACI 318-19 Chapter 13 scope boundary; project load/stability basis required', 'Lateral actions, friction, passive resistance, and overturning combinations are not supplied.', OFFICIAL_ACI_FOOTING_EXAMPLE_URL],
    ['partial-contact-redistribution', 'Partial contact / uplift redistribution', 'bearing', 'SF-SDM-ACI19-R1 full-contact boundary', 'R1 does not redistribute pressure after qmin becomes negative.', OFFICIAL_ACI_FOOTING_EXAMPLE_URL],
    ['durability-cover', 'Durability exposure and code-minimum cover', 'detailing', 'ACI 318-19 Sections 19.3 and 20.5', 'Exposure, concrete placement against earth, and project cover authorization are not supplied.', OFFICIAL_ACI_URL],
    ['minimum-clear-spacing', 'Minimum clear spacing with aggregate evidence', 'detailing', 'ACI 318-19 Section 25.2', 'Nominal maximum aggregate size and placement method are not supplied.', OFFICIAL_ACI_URL],
    ['development-anchorage', 'Development, anchorage, and standard-hook compliance', 'detailing', 'ACI 318-19 Chapter 25', 'ld, ldh, standard hook extension, bend suitability, and corner staggering are not evaluated.', OFFICIAL_ACI_URL],
    ['column-footing-transfer', 'Column-footing bearing and force transfer', 'interface', 'ACI 318-19 Sections 16.3 and 22.8', 'Interface bearing, shear-friction, and transferred moment evidence are not supplied.', OFFICIAL_ACI_URL],
    ['dowels', 'Dowel quantity, grade, embedment, splice, and ties', 'detailing', 'ACI 318-19 Chapters 16 and 25', 'Column dowel detailing inputs and force-transfer design are not supplied.', OFFICIAL_ACI_URL],
    ['construction-tolerances', 'Construction tolerances', 'construction', 'ACI 318-19 construction-document scope; project specification required', 'Fabrication, placement, cover, level, and dimensional tolerances are not approved.', OFFICIAL_ACI_URL],
    ['released-bbs', 'Released BBS / fabrication authorization', 'construction', 'ACI 318-19 Chapter 26; Owner/PE release gate', 'Geometric Bar Cut is not a fabrication schedule or construction authorization.', OFFICIAL_ACI_URL],
  ];
  const limitations = requiredHolds.map(([id, label, category, clause, detail, sourceUrl]) => {
    const evidence = addEquation(buildHoldEvidence(
      `SF-HOLD-${id.toUpperCase()}`,
      clause,
      'Official ACI source and SF-SDM-ACI19-R1 non-evaluated boundary',
      sourceUrl,
    ));
    checks.push(holdCheck({ id, label, category, evidence, detail }));
    return { id, label, status: 'HOLD', detail, evidence };
  });

  const loadsResult = {
    combination,
    service: {
      columnReactionKN: serviceColumnReactionKN,
      footingWeightKN,
      soilOverburdenWeightKN: soilWeightKN,
      distributedDeadWeightKN,
      grossReactionKN: serviceGrossReactionKN,
      evidence: servicePressureEvidence,
      weightEvidence: serviceWeightEvidence,
    },
    factored: {
      columnReactionKN: puColumnKN,
      grossReactionKN: puGrossKN,
      grossPressureKPa: quGrossKPa,
      distributedDeadPressureKPa: factoredDistributedDeadKPa,
      netPressureKPa: quNetKPa,
      cancellationPressureKPa: quNetCancellationKPa,
      equilibriumDifferenceKPa: quNetKPa - quNetCancellationKPa,
      loadCombinationEvidence,
      evidence: factoredEquilibriumEvidence,
    },
  };
  const bearing = {
    status: qMinKPa >= -EPSILON && combinedKernRatio <= 1 + EPSILON
      ? statusFromUtilization(bearingUtilization)
      : 'FAIL',
    areaM2,
    columnAreaM2,
    q0KPa,
    qMinKPa,
    qMaxKPa,
    sbcGrossKPa: soil.sbcGrossKPa,
    sbcSource: soil.sbcSource,
    utilization: bearingUtilization,
    sectionModulusM3: { sx: sxM3, sy: syM3 },
    inertiaM4: { ix: ixM4, iy: iyM4 },
    eccentricityM: { x: eccentricityXM, y: eccentricityYM },
    combinedKernRatio,
    fullContact: qMinKPa >= -EPSILON,
    corners: pressureCorners,
    pressureSamples: makePressureSamples({
      footing,
      q0KPa,
      mxKNm: loads.serviceMxKNm,
      myKNm: loads.serviceMyKNm,
      ixM4,
      iyM4,
    }),
    serviceWeightEvidence,
    pressureEvidence: servicePressureEvidence,
    eccentricityEvidence,
  };
  const geometry = {
    areaM2,
    columnAreaM2,
    footingVolumeM3,
    soilOverburdenVolumeM3,
    footing,
    column,
    cantileversM: { A: cantileverAM, B: cantileverBM },
    effectiveDepthMm: { A: dAMm, B: dBMm, punching: punchingDepthMm },
    criticalSections: {
      oneWayA: {
        direction: 'A',
        distanceFromColumnFaceM: dAMm / 1000,
        coordinateFromCenterM: column.xM / 2 + dAMm / 1000,
      },
      oneWayB: {
        direction: 'B',
        distanceFromColumnFaceM: dBMm / 1000,
        coordinateFromCenterM: column.yM / 2 + dBMm / 1000,
      },
      punching: {
        xM: punchingCriticalXM,
        yM: punchingCriticalYM,
        perimeterM: punchingPerimeterM,
      },
    },
    renderModel: {
      units: 'm',
      planBounds: {
        minX: -footing.xM / 2,
        maxX: footing.xM / 2,
        minY: -footing.yM / 2,
        maxY: footing.yM / 2,
      },
      footingRect: {
        x: -footing.xM / 2,
        y: -footing.yM / 2,
        width: footing.xM,
        height: footing.yM,
      },
      columnRect: {
        x: -column.xM / 2,
        y: -column.yM / 2,
        width: column.xM,
        height: column.yM,
      },
      punchingRect: {
        x: -punchingCriticalXM / 2,
        y: -punchingCriticalYM / 2,
        width: punchingCriticalXM,
        height: punchingCriticalYM,
      },
      oneWayLines: {
        A: [
          { x1: -(column.xM / 2 + dAMm / 1000), y1: -footing.yM / 2, x2: -(column.xM / 2 + dAMm / 1000), y2: footing.yM / 2 },
          { x1: column.xM / 2 + dAMm / 1000, y1: -footing.yM / 2, x2: column.xM / 2 + dAMm / 1000, y2: footing.yM / 2 },
        ],
        B: [
          { x1: -footing.xM / 2, y1: -(column.yM / 2 + dBMm / 1000), x2: footing.xM / 2, y2: -(column.yM / 2 + dBMm / 1000) },
          { x1: -footing.xM / 2, y1: column.yM / 2 + dBMm / 1000, x2: footing.xM / 2, y2: column.yM / 2 + dBMm / 1000 },
        ],
      },
      sectionBoundsMm: { widthX: footing.xM * 1000, widthY: footing.yM * 1000, height: hMm },
      barsA: reinforcementA.planCenterlines,
      barsB: reinforcementB.planCenterlines,
      barCutA: barCutA.polylineMm,
      barCutB: barCutB.polylineMm,
    },
    evidence: depthEvidence,
  };

  const diagrams = {
    status: strengthEligible ? 'EVALUATED' : 'HOLD',
    A: makeDiagram('A', cantileverAM, quNetKPa, dAMm, strengthEligible ? 'EVALUATED' : 'HOLD'),
    B: makeDiagram('B', cantileverBM, quNetKPa, dBMm, strengthEligible ? 'EVALUATED' : 'HOLD'),
    bearingPressure: {
      status: 'EVALUATED',
      corners: pressureCorners,
      samples: bearing.pressureSamples,
      units: 'kPa',
    },
    deflection: {
      status: 'HOLD',
      displacement: null,
      settlement: null,
      detail: 'Any visible deflection shape is symbolic only and is not engine evidence.',
    },
  };
  const takeoffEvidence = addEquation(sourceRecord({
    equationId: 'SF-EQ-GEOMETRIC-TAKEOFF',
    standard: 'R1 geometric centerline reference; fabrication authorization HOLD',
    edition: 'SF-SDM-ACI19-R1',
    clause: 'SPEC_SPREAD_FOOTING_ENGINE §§6.7 and 8',
    formula: 'Total centerline length by mark = count x geometric centerline length',
    substitution: `${reinforcementA.mark}=${reinforcementA.count}(${barCutA.centerlineLengthM})=${barCutA.totalCenterlineLengthM} m; ${reinforcementB.mark}=${reinforcementB.count}(${barCutB.centerlineLengthM})=${barCutB.totalCenterlineLengthM} m`,
    canonicalUnits: 'count, m',
    assumptions: ['No mass, waste, lap, development, splice, chair, dowel, or fabrication allowance is inferred.', 'Quantities are geometric review values only.'],
    sourceUrl: OFFICIAL_ACI_URL,
    sourceTitle: 'ACI CODE-318-19(22) detailing applicability boundary and R1 geometric take-off contract',
    verificationStatus: 'GEOMETRIC_REFERENCE_ONLY_HOLD_OWNER_PE',
  }));
  const takeoff = {
    status: 'HOLD',
    authorization: 'NOT RELEASED BBS',
    items: [
      {
        mark: reinforcementA.mark,
        direction: 'A',
        count: reinforcementA.count,
        diameterMm: reinforcementA.diameterMm,
        eachCenterlineLengthM: barCutA.centerlineLengthM,
        totalCenterlineLengthM: barCutA.totalCenterlineLengthM,
      },
      {
        mark: reinforcementB.mark,
        direction: 'B',
        count: reinforcementB.count,
        diameterMm: reinforcementB.diameterMm,
        eachCenterlineLengthM: barCutB.centerlineLengthM,
        totalCenterlineLengthM: barCutB.totalCenterlineLengthM,
      },
    ],
    totalCenterlineLengthM: barCutA.totalCenterlineLengthM + barCutB.totalCenterlineLengthM,
    massKg: null,
    evidence: takeoffEvidence,
  };

  const evaluatedChecks = checks.filter((check) => check.applicability === 'EVALUATED');
  const failedEvaluatedChecks = evaluatedChecks.filter((check) => check.status === 'FAIL');
  const strengthCheckIds = new Set([
    'provided-steel-a', 'provided-steel-b',
    'short-direction-band-distribution',
    'tension-controlled-a', 'tension-controlled-b',
    'flexure-capacity-a', 'flexure-capacity-b',
    'one-way-shear-a', 'one-way-shear-b', 'punching-shear',
    'punching-minimum-steel-a', 'punching-minimum-steel-b',
  ]);
  const evaluatedStrengthChecks = checks.filter((check) => strengthCheckIds.has(check.id) && check.applicability === 'EVALUATED');
  const failedStrengthChecks = evaluatedStrengthChecks.filter((check) => check.status === 'FAIL');
  const numericChecks = evaluatedChecks.filter((check) => Number.isFinite(check.utilization));
  const failedNumericChecks = failedEvaluatedChecks.filter((check) => Number.isFinite(check.utilization));
  const governingCheck = failedNumericChecks.reduce((governing, check) => (
    !governing || check.utilization > governing.utilization ? check : governing
  ), null)
    || failedEvaluatedChecks[0]
    || numericChecks.reduce((governing, check) => (
      !governing || check.utilization > governing.utilization ? check : governing
    ), null)
    || checks[0];
  const overall = {
    status: SPREAD_FOOTING_ENGINE_PROFILE.overallStatus,
    bearingStatus: checks.some((check) => ['bearing-capacity', 'full-contact-qmin', 'combined-kern'].includes(check.id) && check.status === 'FAIL')
      ? 'FAIL'
      : 'PASS',
    strengthStatus: !strengthEligible
      ? 'HOLD'
      : failedStrengthChecks.length > 0
        ? 'FAIL'
        : 'PASS',
    evaluatedEquationStatus: failedEvaluatedChecks.length > 0 ? 'FAIL' : 'PASS',
    governingCheckId: governingCheck?.id || null,
    governingUtilization: Number.isFinite(governingCheck?.utilization) ? governingCheck.utilization : null,
    reason: 'Individual equations are calculation evidence only. Complete project design basis, non-evaluated checks, detailing, and construction release require Owner/PE review.',
    constructionAuthorization: 'HOLD_OWNER_PE',
  };

  return {
    overall,
    loads: loadsResult,
    bearing,
    geometry,
    reinforcement: { A: reinforcementA, B: reinforcementB, distribution: shortDirectionDistribution },
    flexure,
    oneWayShear,
    punching,
    checks,
    equations,
    diagrams,
    barCut: { A: barCutA, B: barCutB },
    takeoff,
    limitations,
  };
}

function constructionAuthorization() {
  return {
    status: 'HOLD_OWNER_PE',
    overallDesign: 'ENGINEERING REVIEW REQUIRED',
    drawingPack: 'NOT FOR CONSTRUCTION',
    barCut: 'GEOMETRIC REFERENCE ONLY',
    bbs: 'NOT RELEASED BBS',
    printAllowed: false,
    exportAllowed: false,
    reasons: [
      'Owner/PE project design-basis approval is not recorded.',
      'Settlement, stability, durability, anchorage, force transfer, dowels, tolerances, and fabrication release remain HOLD.',
      'A calculated individual PASS is not construction authorization.',
    ],
  };
}

function designBasis(input) {
  const combination = SPREAD_FOOTING_LOAD_COMBINATIONS[input.basis.combinationId];
  const designStandardProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[
    input.basis.designStandardProfileId
  ];
  return {
    profileId: designStandardProfile.profileId,
    designStandardProfileId: designStandardProfile.profileId,
    strategyId: designStandardProfile.strategyId,
    displayLabel: designStandardProfile.displayLabel,
    engineId: SPREAD_FOOTING_ENGINE_PROFILE.engineId,
    engineVersion: SPREAD_FOOTING_ENGINE_PROFILE.engineVersion,
    snapshotSchema: SPREAD_FOOTING_ENGINE_PROFILE.snapshotSchema,
    method: designStandardProfile.method,
    memberStrengthStandard: designStandardProfile.memberStandard.displayLabel,
    memberStandard: designStandardProfile.memberStandard,
    loadStandard: designStandardProfile.loadStandard,
    loadCombination: combination,
    loadApplicabilityConfirmation: {
      required: designStandardProfile.profileId === ACI_D_L_PROFILE_ID,
      confirmed: input.basis.loadApplicabilityConfirmed,
      statement: combination.applicability,
    },
    resolvedProfile: designStandardProfile,
    projectGoverningStandardApproval: 'OWNER_PE_PROJECT_REVIEW',
    complianceClaim: designStandardProfile.complianceClaim,
    overallStatus: SPREAD_FOOTING_ENGINE_PROFILE.overallStatus,
    supportBoundary: {
      member: SPREAD_FOOTING_ENGINE_PROFILE.member,
      support: SPREAD_FOOTING_ENGINE_PROFILE.support,
      concrete: SPREAD_FOOTING_ENGINE_PROFILE.concrete,
      shearReinforcement: SPREAD_FOOTING_ENGINE_PROFILE.shearReinforcement,
      contact: SPREAD_FOOTING_ENGINE_PROFILE.contact,
    },
  };
}

function ceilToIncrement(value, increment) {
  return Math.ceil((value - EPSILON) / increment) * increment;
}

function autoCandidateInput(baseInput, {
  footingXM,
  footingYM,
  thicknessM,
  diameterMm,
  countA,
  countB,
}) {
  const preservedFoundationTopM = baseInput.soil.overburdenDepthM;
  return {
    ...baseInput,
    soil: {
      ...baseInput.soil,
      overburdenDepthM: preservedFoundationTopM,
      foundationBottomDepthM: preservedFoundationTopM + thicknessM,
    },
    geometry: {
      ...baseInput.geometry,
      footing: {
        ...baseInput.geometry.footing,
        xM: footingXM,
        yM: footingYM,
        thicknessM,
      },
    },
    reinforcement: {
      A: { count: countA, diameterMm },
      B: { count: countB, diameterMm },
    },
  };
}

function autoRequiredCount({
  requiredAreaMm2PerM,
  distributionWidthMm,
  coverMm,
  diameterMm,
  thicknessMm,
}) {
  const usableWidthMm = distributionWidthMm - 2 * coverMm - diameterMm;
  if (!Number.isFinite(requiredAreaMm2PerM) || requiredAreaMm2PerM < 0 || usableWidthMm <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const barArea = barAreaMm2(diameterMm);
  const strengthCount = Math.ceil(
    1 + requiredAreaMm2PerM * usableWidthMm / (barArea * 1000) - EPSILON,
  );
  const maximumSpacingMm = Math.min(
    SPREAD_FOOTING_AUTO_DESIGN_POLICY.maximumSpacingMm,
    3 * thicknessMm,
  );
  const spacingCount = Math.ceil(1 + usableWidthMm / maximumSpacingMm - EPSILON);
  return Math.max(2, strengthCount, spacingCount);
}

function autoCandidateSpacingIsPreliminarilyPlaceable(results) {
  const minimumClearSpacingMm = SPREAD_FOOTING_AUTO_DESIGN_POLICY
    .minimumClearSpacingWithoutAggregateMm;
  return ['A', 'B'].every((direction) => {
    const rebar = results.reinforcement[direction];
    const clearSpacingMm = rebar.spacingMm - rebar.diameterMm;
    return clearSpacingMm + EPSILON >= Math.max(minimumClearSpacingMm, rebar.diameterMm);
  });
}

function autoStrengthDirectionForCheck(check, results) {
  const id = check?.id || '';
  if (id.endsWith('-a')) return 'A';
  if (id.endsWith('-b')) return 'B';
  if (id === 'short-direction-band-distribution') {
    return results.reinforcement.distribution.shortDirection;
  }
  return null;
}

function evaluateAutoRebarCandidate(baseInput, geometry, diameterMm) {
  const trialInput = autoCandidateInput(baseInput, {
    ...geometry,
    diameterMm,
    countA: 2,
    countB: 2,
  });
  const trialValidation = validateSpreadFootingDraft({ input: trialInput });
  if (!trialValidation.ok) {
    return { ok: false, validation: trialValidation, results: null };
  }
  const trialResults = buildCalculationResults(trialValidation.input);
  if (trialResults.overall.bearingStatus !== 'PASS') {
    return { ok: false, validation: trialValidation, results: trialResults };
  }
  if (trialResults.flexure.A.asRequiredMm2PerM === null
    || trialResults.flexure.B.asRequiredMm2PerM === null) {
    return { ok: false, validation: trialValidation, results: trialResults };
  }

  const coverMm = baseInput.geometry.footing.coverM * 1000;
  const thicknessMm = geometry.thicknessM * 1000;
  let countA = autoRequiredCount({
    requiredAreaMm2PerM: trialResults.flexure.A.asRequiredMm2PerM,
    distributionWidthMm: geometry.footingYM * 1000,
    coverMm,
    diameterMm,
    thicknessMm,
  });
  let countB = autoRequiredCount({
    requiredAreaMm2PerM: trialResults.flexure.B.asRequiredMm2PerM,
    distributionWidthMm: geometry.footingXM * 1000,
    coverMm,
    diameterMm,
    thicknessMm,
  });
  if (!Number.isFinite(countA) || !Number.isFinite(countB) || countA > 100 || countB > 100) {
    return { ok: false, validation: trialValidation, results: trialResults };
  }

  for (let iteration = 0; iteration < 198; iteration += 1) {
    const candidateInput = autoCandidateInput(baseInput, {
      ...geometry,
      diameterMm,
      countA,
      countB,
    });
    const validation = validateSpreadFootingDraft({ input: candidateInput });
    if (!validation.ok) return { ok: false, validation, results: null };
    const results = buildCalculationResults(validation.input);
    const failedEvaluated = results.checks.filter(
      (check) => check.applicability === 'EVALUATED' && check.status === 'FAIL',
    );
    if (failedEvaluated.length === 0
      && results.overall.bearingStatus === 'PASS'
      && results.overall.strengthStatus === 'PASS'
      && autoCandidateSpacingIsPreliminarilyPlaceable(results)) {
      return { ok: true, validation, results };
    }

    if (failedEvaluated.some((check) => (
      check.id === 'punching-shear'
      || check.id === 'bearing-capacity'
      || check.id === 'full-contact-qmin'
      || check.id === 'combined-kern'
      || check.id.startsWith('tension-controlled-')
    ))) {
      return { ok: false, validation, results };
    }

    let increaseA = false;
    let increaseB = false;
    for (const check of failedEvaluated) {
      const direction = autoStrengthDirectionForCheck(check, results);
      if (direction === 'A') increaseA = true;
      if (direction === 'B') increaseB = true;
    }
    if (!increaseA && !increaseB) return { ok: false, validation, results };
    if (increaseA) countA += 1;
    if (increaseB) countB += 1;
    if (countA > 100 || countB > 100) return { ok: false, validation, results };
  }
  return { ok: false, validation: trialValidation, results: trialResults };
}

const AUTO_RESOLVABLE_VALIDATION_CODES = new Set([
  'COLUMN_OUTSIDE_FOOTING',
  'DEPTH_INCONSISTENT',
  'BAR_COUNT_NOT_INTEGER',
  'UNSUPPORTED_BAR_DIAMETER',
  'REBAR_LAYER_OUTSIDE_SECTION',
  'EFFECTIVE_DEPTH_BELOW_FOOTING_MINIMUM',
  'REBAR_DISTRIBUTION_IMPOSSIBLE',
  'UPTURN_GEOMETRY_IMPOSSIBLE',
  'ONE_WAY_SECTION_OUTSIDE_A',
  'ONE_WAY_SECTION_OUTSIDE_B',
  'PUNCHING_PERIMETER_OUTSIDE',
]);

export function selectSpreadFootingAutoDesignDraft(draft = {}) {
  const baseInput = normalizeSpreadFootingDraft(draft);
  const originalValidation = validateSpreadFootingDraft(draft);
  const unresolvedIssues = originalValidation.issues.filter(
    (issue) => !AUTO_RESOLVABLE_VALIDATION_CODES.has(issue.code),
  );
  if (unresolvedIssues.length > 0) {
    return deepFreeze({
      ok: false,
      policy: SPREAD_FOOTING_AUTO_DESIGN_POLICY,
      errors: Object.fromEntries(unresolvedIssues.map((issue) => [issue.field, issue.message])),
      issues: unresolvedIssues,
      recommendation: 'แก้ข้อมูลวัสดุ น้ำหนัก ดิน หรือช่วงค่าที่ไม่ถูกต้องก่อนให้ Auto Design ค้นหาขนาด',
    });
  }
  if (Math.abs(baseInput.loads.serviceMxKNm) > EPSILON
    || Math.abs(baseInput.loads.serviceMyKNm) > EPSILON) {
    const issue = {
      field: 'mx',
      code: 'AUTO_DESIGN_REQUIRES_CENTERED_AXIAL_LOAD',
      message: 'Auto Design รุ่นนี้รองรับการเลือกขนาดและเหล็กเฉพาะ Mx = My = 0; กรณีมีโมเมนต์ให้ใช้โหมดตรวจค่าที่กำหนดและตรวจวิธี eccentric footing แยก',
      status: 'HOLD',
    };
    return deepFreeze({
      ok: false,
      policy: SPREAD_FOOTING_AUTO_DESIGN_POLICY,
      errors: { mx: issue.message },
      issues: [issue],
      recommendation: issue.message,
    });
  }

  const designStandardProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[
    baseInput.basis.designStandardProfileId
  ];
  const minimumEffectiveDepthMm = designStandardProfile
    .materialLimits.minimumEffectiveDepthMm;
  const requested = {
    footingXM: baseInput.geometry.footing.xM,
    footingYM: baseInput.geometry.footing.yM,
    thicknessM: baseInput.geometry.footing.thicknessM,
    foundationBottomDepthM: baseInput.soil.foundationBottomDepthM,
  };
  const planIncrementM = SPREAD_FOOTING_AUTO_DESIGN_POLICY.planIncrementM;
  const thicknessIncrementM = SPREAD_FOOTING_AUTO_DESIGN_POLICY.thicknessIncrementM;
  const startFootingXM = ceilToIncrement(requested.footingXM, planIncrementM);
  const startFootingYM = ceilToIncrement(requested.footingYM, planIncrementM);
  const startThicknessM = ceilToIncrement(requested.thicknessM, thicknessIncrementM);
  const planSteps = Math.floor(
    SPREAD_FOOTING_AUTO_DESIGN_POLICY.maximumPlanGrowthM / planIncrementM,
  );
  const thicknessSteps = Math.floor(
    SPREAD_FOOTING_AUTO_DESIGN_POLICY.maximumThicknessGrowthM / thicknessIncrementM,
  );
  let evaluatedCandidates = 0;
  let lastEvaluation = null;

  for (let planStep = 0; planStep <= planSteps; planStep += 1) {
    const footingXM = Number((startFootingXM + planStep * planIncrementM).toFixed(6));
    const footingYM = Number((startFootingYM + planStep * planIncrementM).toFixed(6));
    if (footingXM > 50 || footingYM > 50) break;

    const precheckDiameterMm = SPREAD_FOOTING_AUTO_DESIGN_POLICY.barDiametersMm[0];
    const precheckMinimumThicknessM = (
      baseInput.geometry.footing.coverM * 1000
      + precheckDiameterMm
      + precheckDiameterMm / 2
      + minimumEffectiveDepthMm
    ) / 1000;
    const precheckThicknessM = Math.max(
      startThicknessM,
      ceilToIncrement(precheckMinimumThicknessM, thicknessIncrementM),
    );
    const precheckValidation = validateSpreadFootingDraft({
      input: autoCandidateInput(baseInput, {
        footingXM,
        footingYM,
        thicknessM: precheckThicknessM,
        diameterMm: precheckDiameterMm,
        countA: 2,
        countB: 2,
      }),
    });
    if (!precheckValidation.ok) continue;
    const precheckResults = buildCalculationResults(precheckValidation.input);
    if (precheckResults.overall.bearingStatus !== 'PASS') {
      lastEvaluation = { ok: false, validation: precheckValidation, results: precheckResults };
      continue;
    }

    for (let thicknessStep = 0; thicknessStep <= thicknessSteps; thicknessStep += 1) {
      const thicknessM = Number(
        (startThicknessM + thicknessStep * thicknessIncrementM).toFixed(6),
      );
      if (thicknessM > 5) break;

      for (const diameterMm of SPREAD_FOOTING_AUTO_DESIGN_POLICY.barDiametersMm) {
        const minimumThicknessM = (
          baseInput.geometry.footing.coverM * 1000
          + diameterMm
          + diameterMm / 2
          + minimumEffectiveDepthMm
        ) / 1000;
        if (thicknessM < minimumThicknessM - EPSILON) continue;

        evaluatedCandidates += 1;
        const evaluation = evaluateAutoRebarCandidate(baseInput, {
          footingXM,
          footingYM,
          thicknessM,
        }, diameterMm);
        lastEvaluation = evaluation;
        if (!evaluation.ok) continue;

        const selectedInput = {
          ...evaluation.validation.input,
          designIntent: {
            mode: SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode,
            policyId: SPREAD_FOOTING_AUTO_DESIGN_POLICY.policyId,
            requested,
          },
        };
        const selected = {
          footingXM,
          footingYM,
          thicknessM,
          foundationBottomDepthM: selectedInput.soil.foundationBottomDepthM,
          diameterMm,
          barsA: selectedInput.reinforcement.A.count,
          barsB: selectedInput.reinforcement.B.count,
          effectiveDepthAMm: evaluation.results.geometry.effectiveDepthMm.A,
          effectiveDepthBMm: evaluation.results.geometry.effectiveDepthMm.B,
        };
        const adjustments = [];
        if (footingXM > requested.footingXM + EPSILON
          || footingYM > requested.footingYM + EPSILON) adjustments.push('เพิ่มขนาดแปลนฐาน');
        if (thicknessM > requested.thicknessM + EPSILON) adjustments.push('เพิ่มความหนาฐาน');
        adjustments.push(`เลือก ${selected.barsA}-DB${diameterMm} ทิศ A และ ${selected.barsB}-DB${diameterMm} ทิศ B`);

        return deepFreeze({
          ok: true,
          policy: SPREAD_FOOTING_AUTO_DESIGN_POLICY,
          draft: { input: selectedInput },
          requested,
          selected,
          adjustments,
          evaluatedCandidates,
          resultStatus: {
            bearing: evaluation.results.overall.bearingStatus,
            strength: evaluation.results.overall.strengthStatus,
            evaluatedEquations: evaluation.results.overall.evaluatedEquationStatus,
          },
        });
      }
    }
  }

  const smallestDiameterMm = SPREAD_FOOTING_AUTO_DESIGN_POLICY.barDiametersMm[0];
  const minimumThicknessM = ceilToIncrement(
    (
      baseInput.geometry.footing.coverM * 1000
      + smallestDiameterMm
      + smallestDiameterMm / 2
      + minimumEffectiveDepthMm
    ) / 1000,
    thicknessIncrementM,
  );
  const issue = {
    field: 'autoDesign',
    code: 'AUTO_DESIGN_NO_ADEQUATE_CANDIDATE',
    message: `Auto Design ไม่พบชุดที่ผ่านภายในขอบเขตค้นหา; ความหนาเริ่มต้นตามเกณฑ์ d สำหรับ DB${smallestDiameterMm} คือ ${Number((minimumThicknessM * 100).toFixed(1))} cm แต่ยังต้องผ่าน bearing, ดัด, one-way shear และ punching ด้วย`,
    status: 'HOLD',
  };
  return deepFreeze({
    ok: false,
    policy: SPREAD_FOOTING_AUTO_DESIGN_POLICY,
    errors: { autoDesign: issue.message },
    issues: [issue],
    recommendation: issue.message,
    evaluatedCandidates,
    lastFailure: lastEvaluation?.results?.overall || null,
  });
}

function spreadFootingAutoDesignSelection(input) {
  if (input.designIntent?.mode !== SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode) return null;
  const requested = input.designIntent.requested;
  const selected = {
    footingXM: input.geometry.footing.xM,
    footingYM: input.geometry.footing.yM,
    thicknessM: input.geometry.footing.thicknessM,
    foundationBottomDepthM: input.soil.foundationBottomDepthM,
    diameterAMm: input.reinforcement.A.diameterMm,
    diameterBMm: input.reinforcement.B.diameterMm,
    barsA: input.reinforcement.A.count,
    barsB: input.reinforcement.B.count,
  };
  return deepFreeze({
    mode: SPREAD_FOOTING_AUTO_DESIGN_POLICY.mode,
    policyId: SPREAD_FOOTING_AUTO_DESIGN_POLICY.policyId,
    requested,
    selected,
    planWasUpsized: selected.footingXM > requested.footingXM + EPSILON
      || selected.footingYM > requested.footingYM + EPSILON,
    thicknessWasUpsized: selected.thicknessM > requested.thicknessM + EPSILON,
    authorization: SPREAD_FOOTING_AUTO_DESIGN_POLICY.optimizationBoundary,
  });
}

function failureSnapshot(errors, issues = [], designStandardProfileId = null, combinationId = null) {
  return deepFreeze({
    ok: false,
    schemaVersion: SPREAD_FOOTING_ENGINE_PROFILE.snapshotSchema,
    engineId: SPREAD_FOOTING_ENGINE_PROFILE.engineId,
    engineVersion: SPREAD_FOOTING_ENGINE_PROFILE.engineVersion,
    profileId: designStandardProfileId,
    designStandardProfileId,
    combinationId,
    strategyId: null,
    status: 'HOLD',
    errors,
    issues,
    constructionAuthorization: constructionAuthorization(),
  });
}

export async function createSpreadFootingSnapshot(draft = {}, now = new Date()) {
  const validation = validateSpreadFootingDraft(draft);
  if (!validation.ok) {
    return failureSnapshot(
      validation.errors,
      validation.issues,
      validation.input.basis.designStandardProfileId,
      validation.input.basis.combinationId,
    );
  }
  const resolvedProfile = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[
    validation.input.basis.designStandardProfileId
  ];
  const createdAt = toIsoTime(now);
  if (!createdAt) {
    return failureSnapshot(
      { now: 'เวลาสร้าง Calculation Snapshot ไม่ถูกต้อง' },
      [{ field: 'now', code: 'INVALID_SNAPSHOT_TIME', message: 'เวลาสร้าง Calculation Snapshot ไม่ถูกต้อง', status: 'HOLD' }],
      resolvedProfile.profileId,
      validation.input.basis.combinationId,
    );
  }

  try {
    const input = validation.input;
    const fingerprint = await sha256(input);
    const calculationFingerprint = await sha256(calculationInputView(input));
    const results = buildCalculationResults(input);
    const authorization = constructionAuthorization();
    const core = {
      schemaVersion: SPREAD_FOOTING_ENGINE_PROFILE.snapshotSchema,
      engineId: SPREAD_FOOTING_ENGINE_PROFILE.engineId,
      engineVersion: SPREAD_FOOTING_ENGINE_PROFILE.engineVersion,
      profileId: resolvedProfile.profileId,
      designStandardProfileId: resolvedProfile.profileId,
      strategyId: resolvedProfile.strategyId,
      combinationId: input.basis.combinationId,
      createdAt,
      fingerprint,
      calculationFingerprint,
      input,
      designSelection: spreadFootingAutoDesignSelection(input),
      designBasis: designBasis(input),
      sources: results.equations,
      results,
      limitations: results.limitations,
      constructionAuthorization: authorization,
    };
    const payloadHash = await createSpreadFootingPayloadHash(core);
    const datePart = createdAt.slice(0, 10).replaceAll('-', '');
    const hashPart = payloadHash.replace('sha256:', '').slice(0, 10).toUpperCase();
    return deepFreeze({
      ok: true,
      ...core,
      id: `SF-${datePart}-${hashPart}`,
      payloadHash,
    });
  } catch (error) {
    return failureSnapshot(
      { engine: error instanceof Error ? error.message : 'Spread Footing engine result is invalid' },
      [{
        field: 'engine',
        code: 'ENGINE_FAIL_CLOSED',
        message: error instanceof Error ? error.message : 'Spread Footing engine result is invalid',
        status: 'HOLD',
      }],
      resolvedProfile.profileId,
      validation.input.basis.combinationId,
    );
  }
}

export async function createSpreadFootingAutoDesignSnapshot(draft = {}, now = new Date()) {
  const selection = selectSpreadFootingAutoDesignDraft(draft);
  if (!selection.ok) {
    const baseInput = normalizeSpreadFootingDraft(draft);
    return failureSnapshot(
      selection.errors,
      selection.issues,
      baseInput.basis.designStandardProfileId,
      baseInput.basis.combinationId,
    );
  }
  return createSpreadFootingSnapshot(selection.draft, now);
}

function selectorEnvelope(snapshot, surface, data) {
  if (!snapshot?.ok || !snapshot.id || !snapshot.payloadHash) return null;
  return deepFreeze({
    ok: true,
    surface,
    snapshotId: snapshot.id,
    payloadHash: snapshot.payloadHash,
    fingerprint: snapshot.fingerprint,
    calculationFingerprint: snapshot.calculationFingerprint,
    profileId: snapshot.profileId,
    designStandardProfileId: snapshot.designStandardProfileId,
    strategyId: snapshot.strategyId,
    combinationId: snapshot.combinationId,
    designBasis: snapshot.designBasis,
    createdAt: snapshot.createdAt,
    overallStatus: snapshot.results.overall.status,
    designSelection: snapshot.designSelection || null,
    constructionAuthorization: snapshot.constructionAuthorization,
    data,
  });
}

export function selectSpreadFootingSummaryData(snapshot) {
  if (!snapshot?.ok) return null;
  const governingCheck = snapshot.results.checks.find((check) => check.id === snapshot.results.overall.governingCheckId) || null;
  return selectorEnvelope(snapshot, 'summary', {
    project: snapshot.input.project,
    designSelection: snapshot.designSelection || null,
    designBasis: snapshot.designBasis,
    overall: snapshot.results.overall,
    loads: snapshot.results.loads,
    bearing: snapshot.results.bearing,
    geometry: snapshot.results.geometry,
    reinforcement: snapshot.results.reinforcement,
    governingCheck,
  });
}

export function selectSpreadFootingChecksData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'checks', {
    overall: snapshot.results.overall,
    checks: snapshot.results.checks,
  });
}

export function selectSpreadFootingDiagramData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'diagrams', {
    loads: snapshot.results.loads,
    geometry: snapshot.results.geometry,
    diagrams: snapshot.results.diagrams,
    oneWayShear: snapshot.results.oneWayShear,
    punching: snapshot.results.punching,
  });
}

export function selectSpreadFootingSectionData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'section', {
    geometry: snapshot.results.geometry,
    reinforcement: snapshot.results.reinforcement,
    barCut: snapshot.results.barCut,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}

export function selectSpreadFooting3DData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'threeD', {
    geometry: snapshot.results.geometry,
    bearing: snapshot.results.bearing,
    reinforcement: snapshot.results.reinforcement,
    punching: snapshot.results.punching,
    barCut: snapshot.results.barCut,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}

export function selectSpreadFootingReportData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'report', {
    project: snapshot.input.project,
    inputs: {
      materials: snapshot.input.materials,
      loads: snapshot.input.loads,
      soil: snapshot.input.soil,
    },
    designBasis: snapshot.designBasis,
    summary: {
      overall: snapshot.results.overall,
      loads: snapshot.results.loads,
      bearing: snapshot.results.bearing,
      geometry: snapshot.results.geometry,
      reinforcement: snapshot.results.reinforcement,
    },
    flexure: snapshot.results.flexure,
    oneWayShear: snapshot.results.oneWayShear,
    punching: snapshot.results.punching,
    checks: snapshot.results.checks,
    equations: snapshot.results.equations,
    diagrams: snapshot.results.diagrams,
    section: {
      geometry: snapshot.results.geometry,
      reinforcement: snapshot.results.reinforcement,
      barCut: snapshot.results.barCut,
    },
    limitations: snapshot.limitations,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}

export function selectSpreadFootingCalculationBookData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'calculationBook', {
    project: snapshot.input.project,
    designBasis: snapshot.designBasis,
    loads: snapshot.results.loads,
    bearing: snapshot.results.bearing,
    geometry: snapshot.results.geometry,
    reinforcement: snapshot.results.reinforcement,
    flexure: snapshot.results.flexure,
    oneWayShear: snapshot.results.oneWayShear,
    punching: snapshot.results.punching,
    equations: snapshot.results.equations,
    checks: snapshot.results.checks,
    limitations: snapshot.limitations,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}

export function selectSpreadFootingDrawingData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'drawing', {
    project: snapshot.input.project,
    designBasis: snapshot.designBasis,
    geometry: snapshot.results.geometry,
    reinforcement: snapshot.results.reinforcement,
    barCut: snapshot.results.barCut,
    takeoff: snapshot.results.takeoff,
    checks: snapshot.results.checks,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}

export function selectSpreadFootingTakeoffData(snapshot) {
  if (!snapshot?.ok) return null;
  return selectorEnvelope(snapshot, 'takeoff', {
    project: snapshot.input.project,
    reinforcement: snapshot.results.reinforcement,
    barCut: snapshot.results.barCut,
    takeoff: snapshot.results.takeoff,
    constructionAuthorization: snapshot.constructionAuthorization,
  });
}
