import assert from 'node:assert/strict';

import {
  DEFAULT_SPREAD_FOOTING_DRAFT,
  SPREAD_FOOTING_AUTO_DESIGN_POLICY,
  SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST,
  SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY,
  SPREAD_FOOTING_ENGINE_PROFILE,
  SPREAD_FOOTING_LOAD_COMBINATIONS,
  createSpreadFootingInputFingerprint,
  createSpreadFootingAutoDesignSnapshot,
  createSpreadFootingPayloadHash,
  createSpreadFootingSnapshot,
  normalizeSpreadFootingDraft,
  resolveSpreadFootingDesignStandardProfile,
  selectSpreadFootingAutoDesignDraft,
  selectSpreadFooting3DData,
  selectSpreadFootingCalculationBookData,
  selectSpreadFootingChecksData,
  selectSpreadFootingDiagramData,
  selectSpreadFootingDrawingData,
  selectSpreadFootingReportData,
  selectSpreadFootingSectionData,
  selectSpreadFootingSummaryData,
  selectSpreadFootingTakeoffData,
  validateSpreadFootingDraft,
} from './spread-footing-engine.mjs';

const FIXED_TIME = new Date('2026-07-29T00:00:00.000Z');
const HYBRID_PROFILE_ID = 'SF-SDM-THMR2566-ACI31819-HYBRID-R1';
const ACI_PROFILE_ID = 'SF-SDM-ACI31819-DL-R1';
const THAI_COMBINATION_ID = 'TH_MR_2566_C7_1_4D_1_7L';
const ACI_COMBINATION_ID = 'ACI_318_19_1_2D_1_6L';
const confirmedAciDraft = (...sources) => ({
  ...DEFAULT_SPREAD_FOOTING_DRAFT,
  ...Object.assign({}, ...sources),
  designStandardProfileId: ACI_PROFILE_ID,
  combination: ACI_COMBINATION_ID,
  loadApplicabilityConfirmed: true,
});
const SOURCE_FIELDS = [
  'equationId',
  'standard',
  'edition',
  'clause',
  'formula',
  'substitution',
  'canonicalUnits',
  'assumptions',
  'sourceUrl',
  'sourceTitle',
  'verificationStatus',
];

let passed = 0;
let failed = 0;

function approx(actual, expected, tolerance = 1e-9, message = '') {
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message || 'values differ'}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`,
  );
}

function checkById(snapshot, id) {
  const check = snapshot.results.checks.find((candidate) => candidate.id === id);
  assert.ok(check, `missing check ${id}`);
  return check;
}

function assertSourceComplete(source, context) {
  assert.ok(source && typeof source === 'object', `${context}: source object missing`);
  for (const field of SOURCE_FIELDS) {
    assert.ok(Object.hasOwn(source, field), `${context}: source.${field} missing`);
    const value = source[field];
    assert.notEqual(value, null, `${context}: source.${field} null`);
    assert.notEqual(value, undefined, `${context}: source.${field} undefined`);
    if (typeof value === 'string') assert.ok(value.trim(), `${context}: source.${field} empty`);
  }
  assert.ok(Array.isArray(source.assumptions) && source.assumptions.length > 0, `${context}: assumptions incomplete`);
  assert.match(source.sourceUrl, /^https:\/\/(?:www\.)?(?:concrete\.org|ratchakitcha\.soc\.go\.th)\//, `${context}: source URL must be official`);
}

function assertDeepFrozen(value, context = 'value') {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true, `${context} must be frozen`);
  for (const [key, child] of Object.entries(value)) {
    assertDeepFrozen(child, `${context}.${key}`);
  }
}

async function test(name, callback) {
  try {
    await callback();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

await test('normalization is canonical SI and does not mutate the raw draft', () => {
  const raw = { ...DEFAULT_SPREAD_FOOTING_DRAFT };
  const before = structuredClone(raw);
  const input = normalizeSpreadFootingDraft(raw);

  assert.deepEqual(raw, before);
  approx(input.materials.fcMPa, 23.53596, 1e-12);
  approx(input.materials.fyMPa, 392.266, 1e-12);
  approx(input.materials.concreteUnitWeightKNPerM3, 23.53596, 1e-12);
  approx(input.materials.soilUnitWeightKNPerM3, 17.65197, 1e-12);
  approx(input.loads.deadKN, 98.0665, 1e-12);
  approx(input.loads.liveKN, 49.03325, 1e-12);
  approx(input.soil.sbcGrossKPa, 98.0665, 1e-12);
  approx(input.geometry.column.xM, 0.25, 1e-12);
  approx(input.geometry.footing.thicknessM, 0.3, 1e-12);
  assert.equal(input.reinforcement.A.diameterMm, 16);
  assert.equal(input.reinforcement.B.diameterMm, 16);
  assert.equal(input.materials.beta1, 0.85);
  assert.equal(input.basis.designStandardProfileId, HYBRID_PROFILE_ID);
  assert.ok(Object.isFrozen(input));
  assert.ok(Object.isFrozen(input.geometry.footing));

  const highStrengthInput = normalizeSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    fc: 55 / 0.0980665,
  });
  assert.equal(highStrengthInput.materials.fcMPa, 55);
  assert.equal(highStrengthInput.materials.beta1, 0.65);

  const boundary28 = normalizeSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    fc: 28 / 0.0980665,
  });
  const boundary35 = normalizeSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    fc: 35 / 0.0980665,
  });
  assert.equal(boundary28.materials.fcMPa, 28);
  assert.equal(boundary28.materials.beta1, 0.85);
  assert.equal(boundary35.materials.fcMPa, 35);
  approx(boundary35.materials.beta1, 0.8, 1e-15);
});

await test('authoritative profile registry is unique, deeply frozen, and exposes only two executable strategies', () => {
  assertDeepFrozen(SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY, 'profile registry');
  assertDeepFrozen(SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST, 'profile manifest');
  assert.equal(SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST.length, 5);
  assert.equal(
    new Set(SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST.map((profile) => profile.profileId)).size,
    SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST.length,
  );

  const enabled = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST.filter((profile) => profile.enabled);
  const disabled = SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_MANIFEST.filter((profile) => !profile.enabled);
  assert.deepEqual(enabled.map((profile) => profile.profileId), [HYBRID_PROFILE_ID, ACI_PROFILE_ID]);
  assert.deepEqual(
    disabled.map((profile) => profile.displayLabel),
    [
      'วสท. 011008-21 · วิธีกำลัง',
      'วสท. 011007-19 · วิธีหน่วยแรงใช้งาน',
      'ACI 318-25 + ASCE 7-22',
    ],
  );
  for (const profile of enabled) {
    assert.equal(profile.strategyId, SPREAD_FOOTING_ENGINE_PROFILE.strategyId);
    assert.equal(profile.method, 'วิธีกำลัง · รุ่นตรวจการคำนวณ');
    assert.equal(profile.verificationStatus, 'OWNER_AUTHORIZED_SPEC_PENDING_INDEPENDENT_REVIEW');
    assert.equal(profile.complianceClaim, false);
    assert.equal(profile.phiFlexure, 0.9);
    assert.equal(profile.phiShear, 0.75);
    assert.equal(profile.minimumReinforcementPolicy.ratio, 0.0018);
    assert.deepEqual(profile.allowedCombinationIds, profile.compatibleLoadCombinationIds);
    assert.equal(profile.allowedCombinationIds.length, 1);
    assert.ok(SPREAD_FOOTING_LOAD_COMBINATIONS[profile.allowedCombinationIds[0]]);
    assert.equal(profile.memberStandard.standard, 'ACI 318');
    assert.equal(profile.memberStandard.edition, '318-19');
    assert.ok(profile.loadStandard.standard);
    assert.ok(profile.loadStandard.edition);
    assert.match(profile.sourceRegisterVersion, /^SF-DESIGN-STANDARD-PROFILES-R4\.5-/);
    assert.ok(profile.sources.length >= 2);
  }
  for (const profile of disabled) {
    assert.equal(profile.enabled, false);
    assert.equal(profile.disabledState, 'ยังไม่เปิดใช้ · รอตรวจข้อกำหนดฉบับเต็ม');
    assert.equal(profile.verificationStatus, 'DISABLED_PENDING_NORMATIVE_CLAUSE_MAP');
    assert.ok(profile.sources.length >= 1);
    assert.ok(profile.activationRequirements.length >= 4);
    assert.ok(profile.researchStatus);
    assert.deepEqual(profile.allowedCombinationIds, []);
    assert.equal(profile.strategyId, null);
    assert.equal(profile.complianceClaim, false);
  }
});

await test('profile resolution infers only absent profiles and rejects explicit legacy, disabled, unknown, and cross-pairs', () => {
  assert.equal(resolveSpreadFootingDesignStandardProfile(HYBRID_PROFILE_ID)?.profileId, HYBRID_PROFILE_ID);
  assert.equal(resolveSpreadFootingDesignStandardProfile(ACI_PROFILE_ID)?.profileId, ACI_PROFILE_ID);
  assert.equal(
    resolveSpreadFootingDesignStandardProfile('', THAI_COMBINATION_ID)?.profileId,
    HYBRID_PROFILE_ID,
  );
  assert.equal(
    resolveSpreadFootingDesignStandardProfile('SF-SDM-ACI19-R1', ACI_COMBINATION_ID),
    null,
  );
  assert.equal(
    resolveSpreadFootingDesignStandardProfile({ combination: THAI_COMBINATION_ID })?.profileId,
    HYBRID_PROFILE_ID,
  );
  assert.equal(
    resolveSpreadFootingDesignStandardProfile({
      basisProfile: ACI_PROFILE_ID,
      combination: ACI_COMBINATION_ID,
    })?.profileId,
    ACI_PROFILE_ID,
  );
  assert.equal(
    resolveSpreadFootingDesignStandardProfile(HYBRID_PROFILE_ID, ACI_COMBINATION_ID),
    null,
  );
  assert.equal(
    resolveSpreadFootingDesignStandardProfile('SF-CANDIDATE-EIT01100821-STRENGTH'),
    null,
  );
  assert.equal(resolveSpreadFootingDesignStandardProfile('SF-SDM-UNKNOWN-R1'), null);

  const noProfileThai = { ...DEFAULT_SPREAD_FOOTING_DRAFT };
  delete noProfileThai.designStandardProfileId;
  assert.equal(normalizeSpreadFootingDraft(noProfileThai).basis.designStandardProfileId, HYBRID_PROFILE_ID);

  const noProfileAci = {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    combination: ACI_COMBINATION_ID,
  };
  delete noProfileAci.designStandardProfileId;
  assert.equal(normalizeSpreadFootingDraft(noProfileAci).basis.designStandardProfileId, ACI_PROFILE_ID);

  const legacyAci = {
    ...noProfileAci,
    basisProfile: 'SF-SDM-ACI19-R1',
  };
  assert.equal(
    normalizeSpreadFootingDraft(legacyAci).basis.designStandardProfileId,
    'SF-SDM-ACI19-R1',
  );
});

await test('validation accepts the default fixture and rejects profile-control tampering', () => {
  const valid = validateSpreadFootingDraft(DEFAULT_SPREAD_FOOTING_DRAFT);
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.errors, {});

  const tamperedFlexure = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    phiFlexure: 0.75,
  });
  assert.equal(tamperedFlexure.ok, false);
  assert.equal(tamperedFlexure.issues.find((issue) => issue.field === 'phiFlexure')?.code, 'PROFILE_CONTROL_TAMPERED');

  const tamperedShear = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    phiShear: 0.9,
  });
  assert.equal(tamperedShear.ok, false);
  assert.equal(tamperedShear.issues.find((issue) => issue.field === 'phiShear')?.code, 'PROFILE_CONTROL_TAMPERED');

  for (const concreteWeight of [2200, 2600]) {
    const boundary = validateSpreadFootingDraft({
      ...DEFAULT_SPREAD_FOOTING_DRAFT,
      concreteWeight,
    });
    assert.equal(boundary.ok, true, `${concreteWeight} kg/m3 must remain inside the R1 normalweight band`);
  }

  for (const concreteWeight of [1800, 1840, 1850, 2199.99, 2600.01]) {
    const outsideNormalweightBand = validateSpreadFootingDraft({
      ...DEFAULT_SPREAD_FOOTING_DRAFT,
      concreteWeight,
    });
    assert.equal(outsideNormalweightBand.ok, false, `${concreteWeight} kg/m3 must fail closed outside the R1 band`);
    assert.equal(
      outsideNormalweightBand.issues.find((issue) => issue.field === 'concreteWeight')?.code,
      'OUTSIDE_PROFILE_RANGE',
    );
  }

  const exactMinimumConcreteStrength = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    fc: 17 / 0.0980665,
  });
  assert.equal(exactMinimumConcreteStrength.ok, true);
  approx(exactMinimumConcreteStrength.input.materials.fcMPa, 17, 1e-12);

  const belowMinimumConcreteStrength = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    fc: 16.99 / 0.0980665,
  });
  assert.equal(belowMinimumConcreteStrength.ok, false);
  assert.equal(
    belowMinimumConcreteStrength.issues.find((issue) => issue.field === 'fc')?.code,
    'OUTSIDE_PROFILE_RANGE',
  );

  const exactMinimumDepth = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    thickness: 22.4,
    foundationDepth: 0.924,
  });
  assert.equal(exactMinimumDepth.ok, true);
  approx(
    exactMinimumDepth.input.geometry.footing.thicknessM * 1000
      - exactMinimumDepth.input.geometry.footing.coverM * 1000
      - exactMinimumDepth.input.reinforcement.A.diameterMm
      - exactMinimumDepth.input.reinforcement.B.diameterMm / 2,
    SPREAD_FOOTING_ENGINE_PROFILE.minimumEffectiveDepthMm,
    1e-12,
  );

  const belowMinimumDepth = validateSpreadFootingDraft({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    thickness: 22.3999,
    foundationDepth: 0.923999,
  });
  assert.equal(belowMinimumDepth.ok, false);
  assert.equal(
    belowMinimumDepth.issues.find((issue) => issue.field === 'thickness')?.code,
    'EFFECTIVE_DEPTH_BELOW_FOOTING_MINIMUM',
  );
  assert.match(
    belowMinimumDepth.issues.find((issue) => issue.field === 'thickness')?.message || '',
    /ACI 318-19 §13\.3\.1\.2/,
  );
  assert.match(
    belowMinimumDepth.issues.find((issue) => issue.field === 'thickness')?.message || '',
    /T ไม่น้อยกว่า 22\.4 cm/,
  );
});

await test('ACI D+L profile fails closed until its Lr/S/R applicability is explicitly confirmed', async () => {
  const unconfirmed = {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    designStandardProfileId: ACI_PROFILE_ID,
    combination: ACI_COMBINATION_ID,
  };
  const validation = validateSpreadFootingDraft(unconfirmed);
  assert.equal(validation.ok, false);
  assert.equal(validation.input.basis.loadApplicabilityConfirmed, false);
  assert.equal(
    validation.issues.find((issue) => issue.field === 'loadApplicabilityConfirmed')?.code,
    'ACI_LOAD_APPLICABILITY_UNCONFIRMED',
  );

  const blockedSnapshot = await createSpreadFootingSnapshot(unconfirmed, FIXED_TIME);
  assert.equal(blockedSnapshot.ok, false);
  assert.equal(blockedSnapshot.status, 'HOLD');
  assert.equal(blockedSnapshot.results, undefined);

  const confirmedSnapshot = await createSpreadFootingSnapshot(confirmedAciDraft(), FIXED_TIME);
  assert.equal(confirmedSnapshot.ok, true);
  assert.equal(confirmedSnapshot.input.basis.loadApplicabilityConfirmed, true);
  assert.deepEqual(confirmedSnapshot.designBasis.loadApplicabilityConfirmation, {
    required: true,
    confirmed: true,
    statement: SPREAD_FOOTING_LOAD_COMBINATIONS[ACI_COMBINATION_ID].applicability,
  });
  assertDeepFrozen(
    confirmedSnapshot.designBasis.loadApplicabilityConfirmation,
    'ACI applicability confirmation',
  );
});

await test('Auto Design upsizes the Owner example and selects one deterministic passing catalog set', async () => {
  const ownerExample = {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    columnX: 20,
    columnY: 20,
    footingX: 1,
    footingY: 1,
    thickness: 20,
    foundationTop: 0.8,
    foundationDepth: 1,
    cover: 5,
    barsA: 8,
    barsB: 8,
    barDiaA: 'DB16',
    barDiaB: 'DB16',
  };
  const manual = validateSpreadFootingDraft(ownerExample);
  assert.equal(manual.ok, false);
  assert.equal(
    manual.issues.find((issue) => issue.field === 'thickness')?.code,
    'EFFECTIVE_DEPTH_BELOW_FOOTING_MINIMUM',
  );

  const selection = selectSpreadFootingAutoDesignDraft(ownerExample);
  assert.equal(selection.ok, true);
  assert.deepEqual(
    selectSpreadFootingAutoDesignDraft(ownerExample),
    selection,
    'the same requested input must always produce the same first-adequate selection',
  );
  assert.equal(selection.policy, SPREAD_FOOTING_AUTO_DESIGN_POLICY);
  assert.ok(selection.selected.footingXM >= 1);
  assert.ok(selection.selected.footingYM >= 1);
  assert.ok(selection.selected.thicknessM >= 0.2);
  assert.equal(selection.selected.footingXM, 1.4);
  assert.equal(selection.selected.footingYM, 1.4);
  assert.equal(selection.selected.thicknessM, 0.25);
  assert.equal(selection.selected.diameterMm, 12);
  assert.equal(selection.selected.barsA, 7);
  assert.equal(selection.selected.barsB, 7);
  assert.ok(selection.selected.effectiveDepthAMm >= 150);
  assert.ok(selection.selected.effectiveDepthBMm >= 150);
  assert.deepEqual(selection.resultStatus, {
    bearing: 'PASS',
    strength: 'PASS',
    evaluatedEquations: 'PASS',
  });

  const snapshot = await createSpreadFootingAutoDesignSnapshot(ownerExample, FIXED_TIME);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.engineVersion, '1.1.2-review');
  assert.equal(snapshot.schemaVersion, 'spread-footing-snapshot-v2');
  assert.equal(snapshot.designSelection.mode, 'AUTO_UPSIZE');
  assert.equal(snapshot.designSelection.policyId, 'SF-AUTO-UPSIZE-R1');
  assert.equal(snapshot.designSelection.planWasUpsized, true);
  assert.equal(snapshot.designSelection.thicknessWasUpsized, true);
  assert.equal(snapshot.input.geometry.footing.xM, 1.4);
  assert.equal(snapshot.input.geometry.footing.yM, 1.4);
  assert.equal(snapshot.input.geometry.footing.thicknessM, 0.25);
  assert.equal(snapshot.input.soil.overburdenDepthM, 0.8, 'Auto Design preserves the requested footing-top elevation');
  assert.equal(snapshot.input.soil.foundationBottomDepthM, 1.05);
  assert.equal(snapshot.results.overall.bearingStatus, 'PASS');
  assert.equal(snapshot.results.overall.strengthStatus, 'PASS');
  assertDeepFrozen(snapshot.designSelection, 'auto design selection');

  const aciExample = confirmedAciDraft(ownerExample);
  const aciSelection = selectSpreadFootingAutoDesignDraft(aciExample);
  assert.equal(aciSelection.ok, true);
  assert.deepEqual(aciSelection.selected, selection.selected);
  const aciSnapshot = await createSpreadFootingAutoDesignSnapshot(aciExample, FIXED_TIME);
  assert.equal(aciSnapshot.ok, true);
  assert.equal(aciSnapshot.designStandardProfileId, ACI_PROFILE_ID);
  assert.equal(aciSnapshot.combinationId, ACI_COMBINATION_ID);
  assert.equal(aciSnapshot.results.overall.bearingStatus, 'PASS');
  assert.equal(aciSnapshot.results.overall.strengthStatus, 'PASS');
});

await test('Auto Design treats entered dimensions as minimums and never shrinks an already adequate footing', async () => {
  const requested = {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    designMode: 'AUTO_UPSIZE',
  };
  const selection = selectSpreadFootingAutoDesignDraft(requested);
  assert.equal(selection.ok, true);
  assert.equal(selection.selected.footingXM, 1.5);
  assert.equal(selection.selected.footingYM, 1.5);
  assert.equal(selection.selected.thicknessM, 0.3);
  assert.equal(selection.selected.foundationBottomDepthM, 1);
  assert.ok(selection.selected.footingXM >= selection.requested.footingXM);
  assert.ok(selection.selected.footingYM >= selection.requested.footingYM);
  assert.ok(selection.selected.thicknessM >= selection.requested.thicknessM);

  const snapshot = await createSpreadFootingAutoDesignSnapshot(requested, FIXED_TIME);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.designSelection.planWasUpsized, false);
  assert.equal(snapshot.designSelection.thicknessWasUpsized, false);
  assert.equal(snapshot.results.overall.bearingStatus, 'PASS');
  assert.equal(snapshot.results.overall.strengthStatus, 'PASS');
});

await test('Auto Design fails closed for unsupported moments and never converts them into a strength result', async () => {
  const eccentric = {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    designMode: 'AUTO_UPSIZE',
    mx: 1000,
  };
  const selection = selectSpreadFootingAutoDesignDraft(eccentric);
  assert.equal(selection.ok, false);
  assert.equal(selection.issues[0].code, 'AUTO_DESIGN_REQUIRES_CENTERED_AXIAL_LOAD');
  const snapshot = await createSpreadFootingAutoDesignSnapshot(eccentric, FIXED_TIME);
  assert.equal(snapshot.ok, false);
  assert.equal(snapshot.results, undefined);
  assert.equal(
    snapshot.issues.find((issue) => issue.code === 'AUTO_DESIGN_REQUIRES_CENTERED_AXIAL_LOAD')?.status,
    'HOLD',
  );
});

await test('unknown, disabled, conflicting aliases, and cross-profile combinations fail closed with no results', async () => {
  const explicitLegacyBasisProfile = { ...DEFAULT_SPREAD_FOOTING_DRAFT };
  delete explicitLegacyBasisProfile.designStandardProfileId;
  explicitLegacyBasisProfile.basisProfile = 'SF-SDM-ACI19-R1';
  const cases = [
    {
      label: 'legacy designStandardProfileId',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        designStandardProfileId: 'SF-SDM-ACI19-R1',
      },
      field: 'designStandardProfileId',
      code: 'UNSUPPORTED_PROFILE',
    },
    {
      label: 'legacy basisProfile',
      draft: explicitLegacyBasisProfile,
      field: 'designStandardProfileId',
      code: 'UNSUPPORTED_PROFILE',
    },
    {
      label: 'legacy basisProfile alongside canonical profile',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        basisProfile: 'SF-SDM-ACI19-R1',
      },
      field: 'designStandardProfileId',
      code: 'UNSUPPORTED_PROFILE',
    },
    {
      label: 'unknown',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        designStandardProfileId: 'SF-SDM-UNKNOWN-R1',
      },
      field: 'designStandardProfileId',
      code: 'UNSUPPORTED_PROFILE',
    },
    {
      label: 'disabled',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        designStandardProfileId: 'SF-CANDIDATE-EIT01100821-STRENGTH',
      },
      field: 'designStandardProfileId',
      code: 'DISABLED_DESIGN_STANDARD_PROFILE',
    },
    {
      label: 'cross-pair',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        designStandardProfileId: HYBRID_PROFILE_ID,
        combination: ACI_COMBINATION_ID,
      },
      field: 'combination',
      code: 'PROFILE_LOAD_COMBINATION_INCOMPATIBLE',
    },
    {
      label: 'conflicting canonical and legacy aliases',
      draft: {
        ...DEFAULT_SPREAD_FOOTING_DRAFT,
        designStandardProfileId: HYBRID_PROFILE_ID,
        basisProfile: ACI_PROFILE_ID,
      },
      field: 'designStandardProfileId',
      code: 'CONFLICTING_DESIGN_STANDARD_PROFILE',
    },
  ];

  for (const fixture of cases) {
    const validation = validateSpreadFootingDraft(fixture.draft);
    assert.equal(validation.ok, false, fixture.label);
    assert.equal(
      validation.issues.find((issue) => issue.field === fixture.field)?.code,
      fixture.code,
      fixture.label,
    );
    const snapshot = await createSpreadFootingSnapshot(fixture.draft, FIXED_TIME);
    assert.equal(snapshot.ok, false, fixture.label);
    assert.equal(snapshot.status, 'HOLD', fixture.label);
    assert.equal(Object.hasOwn(snapshot, 'results'), false, fixture.label);
    await assert.rejects(
      createSpreadFootingInputFingerprint(fixture.draft),
      /Cannot fingerprint invalid Spread Footing input/,
      fixture.label,
    );
  }
});

const defaultSnapshot = await createSpreadFootingSnapshot(DEFAULT_SPREAD_FOOTING_DRAFT, FIXED_TIME);

await test('default centered fixture matches independent service bearing and factored equilibrium values', () => {
  assert.equal(defaultSnapshot.ok, true);
  const { loads, bearing, geometry } = defaultSnapshot.results;
  assert.equal(bearing.sbcSource, DEFAULT_SPREAD_FOOTING_DRAFT.sbcSource);
  assert.equal(
    defaultSnapshot.results.checks.find((check) => check.id === 'bearing-capacity')?.capacitySource,
    DEFAULT_SPREAD_FOOTING_DRAFT.sbcSource,
  );

  // Hand calculation from the raw default fixture:
  // Wf = 23.53596(1.5)(1.5)(0.3)
  // Ws = 17.65197[(1.5)(1.5) - (0.25)(0.25)](0.7)
  approx(loads.service.footingWeightKN, 15.886773, 1e-9, 'footing self-weight');
  approx(loads.service.soilOverburdenWeightKN, 27.0295790625, 1e-9, 'soil overburden');
  approx(loads.service.grossReactionKN, 190.0161020625, 1e-9, 'gross service reaction');
  approx(bearing.areaM2, 2.25, 1e-12);
  approx(bearing.q0KPa, 84.45160091666667, 1e-9, 'uniform gross service bearing');
  approx(bearing.qMinKPa, 84.45160091666667, 1e-9);
  approx(bearing.qMaxKPa, 84.45160091666667, 1e-9);
  approx(bearing.utilization, 0.8611666666666667, 1e-12);
  assert.equal(bearing.fullContact, true);
  assert.equal(checkById(defaultSnapshot, 'bearing-capacity').status, 'PASS');
  assert.equal(checkById(defaultSnapshot, 'combined-kern').status, 'PASS');

  // Pu,column = 1.4(98.0665) + 1.7(49.03325)
  approx(loads.factored.columnReactionKN, 220.649625, 1e-9);
  approx(loads.factored.grossPressureKPa, 124.77000795, 1e-9);
  approx(loads.factored.distributedDeadPressureKPa, 26.70350795, 1e-9);
  approx(loads.factored.netPressureKPa, 98.0665, 1e-9);
  approx(loads.factored.cancellationPressureKPa, 98.0665, 1e-9);
  approx(loads.factored.equilibriumDifferenceKPa, 0, 1e-10);
  approx(geometry.cantileversM.A, 0.625, 1e-12);
  approx(geometry.cantileversM.B, 0.625, 1e-12);
});

await test('default fixture matches independent dA/dB, provided steel, flexure, one-way shear, and punching values', () => {
  const {
    geometry, reinforcement, flexure, oneWayShear, punching, barCut,
  } = defaultSnapshot.results;

  approx(geometry.effectiveDepthMm.A, 242, 1e-12);
  approx(geometry.effectiveDepthMm.B, 226, 1e-12);
  approx(reinforcement.A.spacingMm, 197.71428571428572, 1e-9);
  approx(reinforcement.B.spacingMm, 197.71428571428572, 1e-9);
  approx(reinforcement.A.providedAreaMm2PerM, 1016.9317260175052, 1e-9);
  approx(reinforcement.B.providedAreaMm2PerM, 1016.9317260175052, 1e-9);

  // Mu = 98.0665(0.625^2)/2 per metre strip.
  approx(flexure.A.muKNmPerM, 19.15361328125, 1e-9);
  approx(flexure.B.muKNmPerM, 19.15361328125, 1e-9);
  approx(flexure.A.asStrengthMm2PerM, 226.2618948190642, 1e-9);
  approx(flexure.B.asStrengthMm2PerM, 242.61301588333663, 1e-9);
  approx(flexure.A.asMinimumMm2PerM, 540, 1e-12);
  approx(flexure.B.asMinimumMm2PerM, 540, 1e-12);
  approx(flexure.A.phiMnKNmPerM, 83.30273583499257, 1e-9);
  approx(flexure.B.phiMnKNmPerM, 77.55846437268563, 1e-9);
  assert.equal(flexure.A.tensionControl.status, 'PASS');
  assert.equal(flexure.B.tensionControl.status, 'PASS');
  assert.equal(checkById(defaultSnapshot, 'flexure-capacity-a').status, 'PASS');
  assert.equal(checkById(defaultSnapshot, 'flexure-capacity-b').status, 'PASS');

  // Table 22.5.5.1(c) rho term is governing, not the 0.42 cap.
  approx(oneWayShear.A.vuKNPerM, 37.5594695, 1e-9);
  approx(oneWayShear.A.rhoW, 0.0042021972149483685, 1e-15);
  approx(oneWayShear.A.vcRhoKNPerM, 125.04051019240562, 1e-9);
  approx(oneWayShear.A.phiVcKNPerM, 93.78038264430421, 1e-9);
  approx(oneWayShear.A.utilization, 0.40050454520384915, 1e-12);
  approx(oneWayShear.B.vuKNPerM, 39.1285335, 1e-9);
  approx(oneWayShear.B.phiVcKNPerM, 89.59987061615841, 1e-9);
  approx(oneWayShear.B.utilization, 0.4367030134186777, 1e-12);
  assert.equal(oneWayShear.A.lambdaS, 1);
  assert.equal(oneWayShear.B.lambdaS, 1);

  approx(punching.depthMm, 226, 1e-12);
  approx(punching.criticalDimensionsM.xM, 0.476, 1e-12);
  approx(punching.criticalDimensionsM.yM, 0.476, 1e-12);
  approx(punching.perimeterMm, 1904, 1e-9);
  approx(punching.vuKN, 198.430109696, 1e-9);
  approx(punching.vcCandidatesMPa.vc1, 1.600957852037336, 1e-12);
  approx(punching.phiVcKN, 516.6739256723054, 1e-9);
  approx(punching.utilization, 0.38405288100768625, 1e-12);
  assert.equal(punching.governingVcStressMPa, punching.vcCandidatesMPa.vc1);

  approx(barCut.A.centerlineLengthMm, 1719.9291886010285, 1e-9);
  approx(barCut.B.centerlineLengthMm, 1687.9291886010285, 1e-9);
  assert.equal(barCut.A.detailingStatus, 'HOLD');
  assert.equal(barCut.B.authorization, 'NOT RELEASED BBS');

  assert.match(flexure.A.minimumSteelEvidence.clause, /8\.6\.1\.1/);
  assert.equal(punching.minimumFlexuralReinforcement.triggered, false);
  assert.equal(punching.minimumFlexuralReinforcement.directions.A.requiredAreaMm2, 0);
  assert.equal(punching.minimumFlexuralReinforcement.directions.B.requiredAreaMm2, 0);
  assert.equal(checkById(defaultSnapshot, 'punching-minimum-steel-a').status, 'PASS');
  assert.equal(checkById(defaultSnapshot, 'punching-minimum-steel-b').status, 'PASS');

  const beta1Evidence = defaultSnapshot.results.equations.find(
    (equation) => equation.equationId === 'SF-EQ-BETA1-CONCRETE-STRESS-BLOCK',
  );
  assert.ok(beta1Evidence);
  assert.match(beta1Evidence.clause, /22\.2\.2\.4\.3/);
  assert.match(beta1Evidence.substitution, /beta1=0\.85/);
  assert.equal(flexure.A.tensionControl.beta1Evidence.equationId, beta1Evidence.equationId);
  assert.match(flexure.A.tensionControl.evidence.clause, /22\.2\.2\.4\.3/);
  assert.match(flexure.A.tensionControl.evidence.substitution, /beta1=0\.85/);

  const minimumConcreteStrengthEvidence = defaultSnapshot.results.equations.find(
    (equation) => equation.equationId === 'SF-EQ-MATERIAL-FC-MINIMUM',
  );
  assert.ok(minimumConcreteStrengthEvidence);
  assert.match(minimumConcreteStrengthEvidence.clause, /19\.2\.1\.1/);
  assert.match(minimumConcreteStrengthEvidence.formula, />= 17 MPa/);
  assert.match(minimumConcreteStrengthEvidence.substitution, />= 17 MPa/);
  assert.match(minimumConcreteStrengthEvidence.sourceUrl, /MNL-17%2821%29_V1_preview\.pdf/);
  assert.equal(
    flexure.A.minimumConcreteStrengthEvidence.equationId,
    minimumConcreteStrengthEvidence.equationId,
  );
});

await test('rectangular footing counts actual short-direction bars in the ACI center band and both outer zones', async () => {
  const rectangular = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    footingX: 2,
    footingY: 1.5,
    barsB: 11,
    barDiaB: 'DB12',
  }, FIXED_TIME);
  assert.equal(rectangular.ok, true);

  const distribution = rectangular.results.reinforcement.distribution;
  assert.equal(distribution.longAxis, 'X');
  assert.equal(distribution.shortAxis, 'Y');
  assert.equal(distribution.shortDirection, 'B');
  approx(distribution.aspectRatio, 4 / 3, 1e-15);
  approx(distribution.centerBandFraction, 6 / 7, 1e-15);
  approx(distribution.totalRequiredAreaMm2, 1080, 1e-12);
  assert.equal(distribution.zones.center.barCount, 7);
  assert.equal(distribution.zones.outerNegative.barCount, 2);
  assert.equal(distribution.zones.outerPositive.barCount, 2);
  approx(distribution.zones.center.requiredAreaMm2, 925.7142857142858, 1e-12);
  approx(distribution.zones.center.providedAreaMm2, 791.6813487046279, 1e-12);
  approx(distribution.zones.center.utilization, 1.1693016227159658, 1e-15);
  approx(distribution.zones.outerNegative.requiredAreaMm2, 77.14285714285711, 1e-12);
  approx(distribution.zones.outerNegative.providedAreaMm2, 226.1946710584651, 1e-12);
  assert.equal(distribution.zones.center.status, 'FAIL');
  assert.equal(distribution.zones.outerNegative.status, 'PASS');
  assert.equal(distribution.zones.outerPositive.status, 'PASS');
  assert.equal(distribution.governingZoneId, 'center');

  const check = checkById(rectangular, 'short-direction-band-distribution');
  assert.equal(check.status, 'FAIL');
  approx(check.utilization, 1.1693016227159658, 1e-15);
  assert.match(check.evidence.clause, /13\.3\.3\.3/);
  assert.match(check.evidence.formula, /2\/\(beta_f\+1\)/);
  assert.equal(rectangular.results.overall.strengthStatus, 'FAIL');
  assert.equal(rectangular.results.overall.governingCheckId, 'short-direction-band-distribution');
});

await test('R1 conservative Section 8.6.1.2 extension counts actual steel within bslab and fails the heavy vector', async () => {
  const heavy = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    deadLoad: 87400,
    liveLoad: 0,
    sbc: 100,
    columnX: 80,
    columnY: 80,
  }, FIXED_TIME);
  assert.equal(heavy.ok, true);

  approx(heavy.results.loads.factored.columnReactionKN, 1199.941694, 1e-9);
  approx(heavy.results.loads.factored.netPressureKPa, 533.3074195556, 1e-10);
  const { punching } = heavy.results;
  approx(punching.depthMm, 226, 1e-12);
  approx(punching.perimeterMm, 4104, 1e-12);
  approx(punching.vuKN, 638.541772812, 1e-9);
  approx(punching.demandStressMPa, 0.688451772512, 1e-12);

  const minimum = punching.minimumFlexuralReinforcement;
  assert.equal(minimum.triggered, true);
  assert.equal(minimum.status, 'FAIL');
  approx(minimum.triggerStressMPa, 0.618551897378, 1e-12);
  for (const direction of ['A', 'B']) {
    const result = minimum.directions[direction];
    assert.equal(result.barCountWithinBand, 8);
    approx(result.bandWidthM, 1.5, 1e-12);
    approx(result.requiredAreaMm2, 1800.695238938, 1e-9);
    approx(result.providedAreaMm2, 1608.495438638, 1e-9);
    approx(result.utilization, 1.1194904229649716, 1e-15);
    assert.equal(result.status, 'FAIL');
    assert.match(result.evidence.clause, /8\.6\.1\.2/);
    assert.match(result.evidence.formula, /As,total=5 vuv bslab bo/);
    assert.equal(result.evidence.standard, 'SF-SDM-ACI19-R1 conservative extension');
    assert.equal(result.evidence.verificationStatus, 'R1_CONSERVATIVE_EXTENSION_OWNER_PE_REVIEW_REQUIRED');
    assert.match(result.evidence.sourceUrl, /id=51737111/);
    assert.ok(result.evidence.assumptions.some((assumption) => /silent/i.test(assumption)));
    assert.ok(result.evidence.assumptions.some((assumption) => /not represented as a direct footing mandate/i.test(assumption)));

    const check = checkById(heavy, `punching-minimum-steel-${direction.toLowerCase()}`);
    assert.equal(check.status, 'FAIL');
    approx(check.utilization, 1.1194904229649716, 1e-15);
  }
  assert.equal(heavy.results.overall.strengthStatus, 'FAIL');
  assert.equal(heavy.results.overall.governingCheckId, 'punching-minimum-steel-a');
  approx(heavy.results.overall.governingUtilization, 1.1194904229649716, 1e-15);
});

await test('both selectable D+L combinations are frozen and produce their specified Pu', async () => {
  const thai = defaultSnapshot;
  const aci = await createSpreadFootingSnapshot(confirmedAciDraft(), FIXED_TIME);

  assert.equal(aci.ok, true);
  assert.equal(thai.designBasis.loadCombination.id, 'TH_MR_2566_C7_1_4D_1_7L');
  assert.equal(aci.designBasis.loadCombination.id, 'ACI_318_19_1_2D_1_6L');
  approx(thai.results.loads.factored.columnReactionKN, 1.4 * 98.0665 + 1.7 * 49.03325, 1e-9);
  approx(aci.results.loads.factored.columnReactionKN, 1.2 * 98.0665 + 1.6 * 49.03325, 1e-9);
  approx(aci.results.loads.factored.netPressureKPa, aci.results.loads.factored.columnReactionKN / 2.25, 1e-9);
  assert.match(thai.results.loads.factored.loadCombinationEvidence.sourceUrl, /ratchakitcha/);
  assert.equal(
    aci.results.loads.factored.loadCombinationEvidence.sourceUrl,
    'https://www.concrete.org/store/productdetail.aspx?ItemID=318U19&Language=English&Units=US_and_Metric',
  );
  assert.equal(thai.designBasis.loadCombination.clause, 'Article 7(1)');
  assert.equal(thai.designBasis.loadCombination.normativeEquation, 'นป. = 1.4นค. + 1.7นจ.');
  assert.match(thai.designBasis.loadCombination.applicability, /นจ\. ต้องรวมแรงกระแทก/);
  assert.equal(aci.designBasis.loadCombination.clause, 'Table 5.3.1(b)');
  assert.equal(
    aci.designBasis.loadCombination.normativeEquation,
    'U = 1.2D + 1.6L + 0.5(Lr or S or R)',
  );
  assert.match(aci.designBasis.loadCombination.applicability, /ผู้รับผิดชอบยืนยันว่า Lr, S และ R ไม่ใช้/);
  assert.ok(
    aci.results.loads.factored.loadCombinationEvidence.assumptions.some(
      (assumption) => assumption === 'สมการมาตรฐาน: U = 1.2D + 1.6L + 0.5(Lr or S or R)',
    ),
  );

  const legacyThaiDraft = { ...DEFAULT_SPREAD_FOOTING_DRAFT };
  delete legacyThaiDraft.designStandardProfileId;
  const inferredAciDraft = confirmedAciDraft();
  delete inferredAciDraft.designStandardProfileId;
  const legacyThai = await createSpreadFootingSnapshot(legacyThaiDraft, FIXED_TIME);
  const inferredAci = await createSpreadFootingSnapshot(inferredAciDraft, FIXED_TIME);
  assert.equal(legacyThai.ok, true);
  assert.equal(inferredAci.ok, true);
  assert.deepEqual(legacyThai.results, thai.results);
  assert.deepEqual(inferredAci.results, aci.results);
  assert.equal(legacyThai.profileId, HYBRID_PROFILE_ID);
  assert.equal(inferredAci.profileId, ACI_PROFILE_ID);
  assert.equal(
    legacyThai.designBasis.displayLabel,
    'กฎกระทรวง 2566 · 1.4D+1.7L · ACI 318-19',
  );
  assert.equal(inferredAci.designBasis.displayLabel, 'ACI 318-19 · 1.2D + 1.6L');
  assert.equal(
    inferredAci.designBasis.resolvedProfile.loadStandard.displayLabel,
    'ACI 318-19 · Table 5.3.1(b) · U = 1.2D + 1.6L',
  );
  assert.equal(legacyThai.designBasis.complianceClaim, false);
  assert.equal(inferredAci.designBasis.complianceClaim, false);
});

await test('official ACI 318-14 footing example is a numeric workflow benchmark with explicit R1 edition differences', async () => {
  const evidence = defaultSnapshot.results.loads.service.evidence;
  assert.equal(
    evidence.sourceUrl,
    'https://www.concrete.org/Portals/0/Files/PDF/318-Example-1_RF_R1.pdf',
  );
  assert.match(evidence.sourceTitle, /ACI Footings Example 1/);
  assert.match(evidence.sourceTitle, /ACI 318-14/);
  assert.match(evidence.sourceTitle, /not the R1 resistance source/);
  assert.doesNotMatch(evidence.standard, /^ACI 318-19$/);

  const kipToKN = 4.4482216152605;
  const psiToMPa = 0.006894757293168;
  const pcfToKNPerM3 = 0.157087463846246;
  const ksfToKPa = 47.88025898;
  const kNmToKipFt = 0.737562149277;
  const benchmark = await createSpreadFootingSnapshot(confirmedAciDraft({
    foundationTop: 0,
    foundationDepth: 30 * 0.0254,
    barsA: 13,
    barDiaA: 'DB25',
    barsB: 13,
    barDiaB: 'DB25',
    footingX: 12 * 0.3048,
    footingY: 12 * 0.3048,
    basis: {
      supportType: 'interior',
      columnLocation: 'centered',
      sbcBasis: 'gross',
      combinationId: ACI_COMBINATION_ID,
    },
    materials: {
      fcMPa: 4000 * psiToMPa,
      fyMPa: 60000 * psiToMPa,
      concreteUnitWeightKNPerM3: 150 * pcfToKNPerM3,
      soilUnitWeightKNPerM3: 120 * pcfToKNPerM3,
    },
    loads: {
      deadKN: 541 * kipToKN,
      liveKN: 194 * kipToKN,
      serviceMxKNm: 0,
      serviceMyKNm: 0,
    },
    soil: {
      sbcGrossKPa: 5600 * 0.04788025898,
      sbcBasis: 'gross',
      overburdenDepthM: 0,
      foundationBottomDepthM: 30 * 0.0254,
    },
    geometry: {
      footing: {
        xM: 12 * 0.3048,
        yM: 12 * 0.3048,
        thicknessM: 30 * 0.0254,
        coverM: 3 * 0.0254,
      },
      column: {
        xM: 24 * 0.0254,
        yM: 24 * 0.0254,
        offsetXM: 0,
        offsetYM: 0,
      },
    },
    reinforcement: {
      A: { count: 13, diameterMm: 25 },
      B: { count: 13, diameterMm: 25 },
    },
  }), FIXED_TIME);
  assert.equal(benchmark.ok, true);
  assert.equal(benchmark.input.basis.combinationId, 'ACI_318_19_1_2D_1_6L');

  const footingWidthM = benchmark.input.geometry.footing.yM;
  const puKip = benchmark.results.loads.factored.columnReactionKN / kipToKN;
  const quKsf = benchmark.results.loads.factored.netPressureKPa / ksfToKPa;
  const dUpperIn = benchmark.results.geometry.effectiveDepthMm.B / 25.4;
  const muTotalKipFt = benchmark.results.flexure.B.muKNmPerM * footingWidthM * kNmToKipFt;
  const oneWayVuKip = benchmark.results.oneWayShear.B.vuKNPerM * footingWidthM / kipToKN;
  const punchingVuKip = benchmark.results.punching.vuKN / kipToKN;
  const punchingPhiVcKip = benchmark.results.punching.phiVcKN / kipToKN;
  const asRequiredIn2 = benchmark.results.flexure.B.asRequiredMm2PerM
    * footingWidthM
    / (25.4 ** 2);

  // The publication rounds Pu to 960 kip and qu to 6.7 ksf. The engine keeps
  // exact 1.2D+1.6L operands, so compare both exact recovery and published
  // rounded workflow values.
  approx(puKip, 959.6, 1e-9);
  approx(quKsf, 6.663888888888889, 1e-9);
  assert.ok(Math.abs(quKsf - 6.7) / 6.7 < 0.01);
  assert.ok(Math.abs(dUpperIn - 25.5) / 25.5 < 0.001);
  assert.ok(Math.abs(muTotalKipFt - 1005) / 1005 < 0.01);
  assert.ok(Math.abs(oneWayVuKip - 231) / 231 < 0.01);
  assert.ok(Math.abs(punchingVuKip - 851) / 851 < 0.01);
  assert.ok(Math.abs(punchingPhiVcKip - 958) / 958 < 0.01);
  assert.ok(Math.abs(asRequiredIn2 - 8.91) / 8.91 < 0.01);

  // ACI 318-19 one-way shear retains rho_w and can govern differently from
  // the publication's ACI 318-14 348-kip capacity. The benchmark proves the
  // common statics while preserving this edition difference instead of
  // asserting false resistance parity.
  const oneWayPhiVcKip = benchmark.results.oneWayShear.B.phiVcKNPerM
    * footingWidthM
    / kipToKN;
  assert.ok(oneWayPhiVcKip < 0.7 * 348);
  assert.match(benchmark.results.oneWayShear.B.evidence.clause, /22\.5\.5\.1\(c\)/);
  assert.match(benchmark.results.oneWayShear.B.evidence.formula, /rho_w/);
  assert.equal(benchmark.results.overall.strengthStatus, 'FAIL');
});

await test('exact quadratic flexure solution satisfies the strength equation before minimum steel governs', () => {
  for (const direction of ['A', 'B']) {
    const flexure = defaultSnapshot.results.flexure[direction];
    const { fcMPa, fyMPa, phiFlexure } = defaultSnapshot.input.materials;
    const as = flexure.asStrengthMm2PerM;
    const a = as * fyMPa / (0.85 * fcMPa * 1000);
    const recoveredMu = phiFlexure * as * fyMPa * (flexure.depthMm - a / 2) / 1e6;
    approx(recoveredMu, flexure.muKNmPerM, 1e-9, `quadratic recovery ${direction}`);
    assert.ok(flexure.asMinimumMm2PerM > flexure.asStrengthMm2PerM);
    assert.equal(flexure.asRequiredMm2PerM, flexure.asMinimumMm2PerM);
  }
});

await test('low SBC, insufficient steel, flexure, one-way shear, and punching failures remain explicit', async () => {
  const lowSbc = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    sbc: 5,
  }, FIXED_TIME);
  assert.equal(lowSbc.ok, true);
  assert.equal(checkById(lowSbc, 'bearing-capacity').status, 'FAIL');
  assert.ok(checkById(lowSbc, 'bearing-capacity').utilization > 1);

  const overloaded = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    deadLoad: 100000,
    liveLoad: 0,
    barsA: 2,
    barDiaA: 'DB12',
    barsB: 2,
    barDiaB: 'DB12',
  }, FIXED_TIME);
  assert.equal(overloaded.ok, true);
  assert.equal(checkById(overloaded, 'provided-steel-a').status, 'FAIL');
  assert.equal(checkById(overloaded, 'provided-steel-b').status, 'FAIL');
  assert.equal(checkById(overloaded, 'flexure-capacity-a').status, 'FAIL');
  assert.equal(checkById(overloaded, 'flexure-capacity-b').status, 'FAIL');
  assert.equal(checkById(overloaded, 'one-way-shear-a').status, 'FAIL');
  assert.equal(checkById(overloaded, 'one-way-shear-b').status, 'FAIL');
  assert.equal(checkById(overloaded, 'punching-shear').status, 'FAIL');
  assert.equal(checkById(overloaded, 'punching-minimum-steel-a').status, 'FAIL');
  assert.equal(checkById(overloaded, 'punching-minimum-steel-a').capacity.value, 0);
  assert.equal(checkById(overloaded, 'punching-minimum-steel-a').utilization, null);
  assert.equal(overloaded.results.overall.strengthStatus, 'FAIL');
  assert.equal(overloaded.results.overall.status, 'ENGINEERING REVIEW REQUIRED');
  assert.equal(overloaded.results.overall.governingCheckId, 'provided-steel-b');
  const failedWithUtilization = overloaded.results.checks.filter(
    (check) => check.status === 'FAIL' && Number.isFinite(check.utilization),
  );
  assert.equal(
    overloaded.results.overall.governingUtilization,
    Math.max(...failedWithUtilization.map((check) => check.utilization)),
  );
});

await test('one-way shear retains the rho term and applies the 0.42 cap at high reinforcement ratio', async () => {
  const highRho = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    footingX: 1,
    footingY: 1,
    thickness: 30,
    cover: 5,
    foundationDepth: 1,
    barsA: 100,
    barDiaA: 'DB32',
    barsB: 100,
    barDiaB: 'DB32',
  }, FIXED_TIME);
  assert.equal(highRho.ok, true);
  for (const direction of ['A', 'B']) {
    const shear = highRho.results.oneWayShear[direction];
    assert.ok(shear.vcRhoKNPerM >= shear.vcCapKNPerM);
    approx(shear.governingVcKNPerM, shear.vcCapKNPerM, 1e-9);
    assert.match(shear.evidence.formula, /rho_w\^\(1\/3\)/);
    assert.match(shear.evidence.formula, /0\.42/);
    assert.equal(shear.lambdaS, 1);
  }
});

await test('over-reinforced section fails the separate tension-controlled phi check and holds phiMn capacity', async () => {
  const overReinforced = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    barsA: 100,
    barDiaA: 'DB32',
    barsB: 100,
    barDiaB: 'DB32',
  }, FIXED_TIME);
  assert.equal(overReinforced.ok, true);
  assert.equal(checkById(overReinforced, 'tension-controlled-a').status, 'FAIL');
  assert.equal(checkById(overReinforced, 'tension-controlled-b').status, 'FAIL');
  assert.equal(checkById(overReinforced, 'flexure-capacity-a').status, 'HOLD');
  assert.equal(checkById(overReinforced, 'flexure-capacity-a').applicability, 'NOT_EVALUATED');
  assert.equal(overReinforced.results.flexure.A.phiMnKNmPerM, null);
  assert.equal(overReinforced.results.flexure.B.phiMnKNmPerM, null);
});

await test('nonzero service moments evaluate bearing only and hold every strength equation', async () => {
  const moment = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    mx: 1000,
    my: -500,
  }, FIXED_TIME);
  assert.equal(moment.ok, true);
  assert.equal(moment.results.bearing.fullContact, true);
  assert.ok(moment.results.bearing.qMaxKPa > moment.results.bearing.q0KPa);
  assert.ok(moment.results.bearing.qMinKPa < moment.results.bearing.q0KPa);
  assert.equal(checkById(moment, 'bearing-capacity').applicability, 'EVALUATED');
  assert.equal(checkById(moment, 'strength-applicability').status, 'HOLD');
  assert.equal(moment.results.overall.strengthStatus, 'HOLD');
  for (const id of [
    'provided-steel-a', 'provided-steel-b',
    'short-direction-band-distribution',
    'tension-controlled-a', 'tension-controlled-b',
    'flexure-capacity-a', 'flexure-capacity-b',
    'one-way-shear-a', 'one-way-shear-b', 'punching-shear',
    'punching-minimum-steel-a', 'punching-minimum-steel-b',
  ]) {
    const check = checkById(moment, id);
    assert.equal(check.status, 'HOLD', id);
    assert.equal(check.applicability, 'NOT_EVALUATED', id);
    assert.equal(check.utilization, null, id);
  }
  assert.equal(moment.results.flexure.A.muKNmPerM, null);
  assert.equal(moment.results.oneWayShear.A.vuKNPerM, null);
  assert.equal(moment.results.punching.vuKN, null);
});

await test('combined biaxial kern check fails when each independent axis would appear inside its own middle third', async () => {
  const biaxial = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    mx: 3000,
    my: 3000,
  }, FIXED_TIME);
  assert.equal(biaxial.ok, true);
  const { x, y } = biaxial.results.bearing.eccentricityM;
  const individualX = 6 * x / biaxial.input.geometry.footing.xM;
  const individualY = 6 * y / biaxial.input.geometry.footing.yM;
  assert.ok(individualX < 1);
  assert.ok(individualY < 1);
  assert.ok(biaxial.results.bearing.combinedKernRatio > 1);
  assert.equal(checkById(biaxial, 'bearing-capacity').status, 'HOLD');
  assert.equal(checkById(biaxial, 'bearing-capacity').utilization, null);
  assert.equal(checkById(biaxial, 'combined-kern').status, 'FAIL');
  assert.equal(checkById(biaxial, 'full-contact-qmin').status, 'FAIL');
  assert.equal(biaxial.results.overall.strengthStatus, 'HOLD');
});

await test('invalid, NaN, unsupported, and impossible geometry inputs fail closed without results', async () => {
  const cases = [
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, sbc: 0 }, 'sbc'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, sbc: Number.NaN }, 'sbc'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, deadLoad: 'not-a-number' }, 'deadLoad'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, supportType: 'edge' }, 'supportType'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, supportType: 'corner' }, 'supportType'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, sbcBasis: 'net' }, 'sbcBasis'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, foundationDepth: 1.1 }, 'foundationDepth'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, thickness: 10, cover: 20, foundationDepth: 0.8 }, 'cover'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, thickness: 22, foundationDepth: 0.92 }, 'thickness'],
    [{ ...DEFAULT_SPREAD_FOOTING_DRAFT, footingX: 0.5 }, 'footingX'],
  ];
  for (const [draft, expectedError] of cases) {
    const snapshot = await createSpreadFootingSnapshot(draft, FIXED_TIME);
    assert.equal(snapshot.ok, false, expectedError);
    assert.equal(snapshot.status, 'HOLD', expectedError);
    assert.ok(snapshot.errors[expectedError], `${expectedError}: expected error missing`);
    assert.equal(Object.hasOwn(snapshot, 'results'), false, `${expectedError}: stale/partial results leaked`);
    assert.equal(snapshot.constructionAuthorization.exportAllowed, false);
    assert.ok(Object.isFrozen(snapshot));
  }
});

await test('partial contact explicitly fails qmin and holds redistribution/strength without fake zero utilization', async () => {
  const uplift = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    mx: 10000,
  }, FIXED_TIME);
  assert.equal(uplift.ok, true);
  assert.ok(uplift.results.bearing.qMinKPa < 0);
  assert.equal(checkById(uplift, 'bearing-capacity').status, 'HOLD');
  assert.equal(checkById(uplift, 'bearing-capacity').utilization, null);
  assert.equal(checkById(uplift, 'full-contact-qmin').status, 'FAIL');
  assert.equal(checkById(uplift, 'partial-contact-redistribution').status, 'HOLD');
  assert.equal(checkById(uplift, 'partial-contact-redistribution').utilization, null);
  assert.equal(uplift.results.overall.strengthStatus, 'HOLD');
});

await test('SHA-256 fingerprints and payload hashes are deterministic, separated, and sensitive to the right inputs', async () => {
  const again = await createSpreadFootingSnapshot({ ...DEFAULT_SPREAD_FOOTING_DRAFT }, FIXED_TIME);
  assert.equal(again.ok, true);
  assert.match(defaultSnapshot.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.match(defaultSnapshot.calculationFingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.match(defaultSnapshot.payloadHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(again.fingerprint, defaultSnapshot.fingerprint);
  assert.equal(again.calculationFingerprint, defaultSnapshot.calculationFingerprint);
  assert.equal(again.payloadHash, defaultSnapshot.payloadHash);
  assert.equal(again.id, defaultSnapshot.id);
  assert.equal(await createSpreadFootingPayloadHash(defaultSnapshot), defaultSnapshot.payloadHash);
  assert.equal(
    await createSpreadFootingInputFingerprint(DEFAULT_SPREAD_FOOTING_DRAFT),
    defaultSnapshot.fingerprint,
  );

  const profileAbsentDraft = { ...DEFAULT_SPREAD_FOOTING_DRAFT };
  delete profileAbsentDraft.designStandardProfileId;
  const profileAbsent = await createSpreadFootingSnapshot(profileAbsentDraft, FIXED_TIME);
  assert.equal(profileAbsent.ok, true);
  assert.equal(profileAbsent.fingerprint, defaultSnapshot.fingerprint);
  assert.equal(profileAbsent.calculationFingerprint, defaultSnapshot.calculationFingerprint);
  assert.equal(profileAbsent.payloadHash, defaultSnapshot.payloadHash);

  const metadataChange = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    revision: 'R10',
  }, FIXED_TIME);
  assert.notEqual(metadataChange.fingerprint, defaultSnapshot.fingerprint);
  assert.equal(metadataChange.calculationFingerprint, defaultSnapshot.calculationFingerprint);
  assert.notEqual(metadataChange.payloadHash, defaultSnapshot.payloadHash);

  const calculationChange = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    liveLoad: 5100,
  }, FIXED_TIME);
  assert.notEqual(calculationChange.fingerprint, defaultSnapshot.fingerprint);
  assert.notEqual(calculationChange.calculationFingerprint, defaultSnapshot.calculationFingerprint);
  assert.notEqual(calculationChange.payloadHash, defaultSnapshot.payloadHash);

  const irrelevantThaiConfirmation = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    loadApplicabilityConfirmed: true,
  }, FIXED_TIME);
  assert.equal(irrelevantThaiConfirmation.ok, true);
  assert.equal(irrelevantThaiConfirmation.input.basis.loadApplicabilityConfirmed, false);
  assert.equal(irrelevantThaiConfirmation.fingerprint, defaultSnapshot.fingerprint);
  assert.equal(
    irrelevantThaiConfirmation.calculationFingerprint,
    defaultSnapshot.calculationFingerprint,
  );
  assert.equal(irrelevantThaiConfirmation.payloadHash, defaultSnapshot.payloadHash);
  assert.equal(irrelevantThaiConfirmation.id, defaultSnapshot.id);

  const profileAndCombinationChange = await createSpreadFootingSnapshot(
    confirmedAciDraft(),
    FIXED_TIME,
  );
  assert.equal(profileAndCombinationChange.ok, true);
  assert.notEqual(profileAndCombinationChange.fingerprint, defaultSnapshot.fingerprint);
  assert.notEqual(profileAndCombinationChange.calculationFingerprint, defaultSnapshot.calculationFingerprint);
  assert.notEqual(profileAndCombinationChange.payloadHash, defaultSnapshot.payloadHash);
  assert.notEqual(profileAndCombinationChange.id, defaultSnapshot.id);
  assert.equal(profileAndCombinationChange.profileId, ACI_PROFILE_ID);
  assert.equal(profileAndCombinationChange.combinationId, ACI_COMBINATION_ID);
});

await test('Snapshot and nested calculation/output data are deeply immutable', () => {
  assert.ok(Object.isFrozen(defaultSnapshot));
  assert.ok(Object.isFrozen(defaultSnapshot.input));
  assert.ok(Object.isFrozen(defaultSnapshot.results));
  assert.ok(Object.isFrozen(defaultSnapshot.results.checks));
  assert.ok(Object.isFrozen(defaultSnapshot.results.checks[0]));
  assert.ok(Object.isFrozen(defaultSnapshot.results.geometry.renderModel.barsA[0].start));
  assert.throws(() => {
    defaultSnapshot.results.bearing.qMaxKPa = 0;
  }, TypeError);
  assert.throws(() => {
    defaultSnapshot.results.checks.push({ id: 'forged-pass', status: 'PASS' });
  }, TypeError);
  assert.throws(() => {
    defaultSnapshot.input.project.revision = 'FORGED';
  }, TypeError);
});

await test('every equation and every evaluated/HOLD check carries complete official source metadata', () => {
  assert.ok(defaultSnapshot.results.equations.length >= 20);
  for (const equation of defaultSnapshot.results.equations) {
    assertSourceComplete(equation, equation.equationId);
  }
  for (const check of defaultSnapshot.results.checks) {
    assertSourceComplete(check.evidence, `check ${check.id}`);
    if (check.applicability === 'EVALUATED') {
      assert.ok(['PASS', 'FAIL'].includes(check.status), check.id);
    } else {
      assert.equal(check.status, 'HOLD', check.id);
      assert.equal(check.utilization, null, check.id);
    }
  }
  assert.match(
    defaultSnapshot.results.loads.factored.loadCombinationEvidence.assumptions.join(' '),
    /สูตรกำลังชิ้นส่วนอ้างอิง ACI 318-19/,
  );
  assert.match(
    defaultSnapshot.results.bearing.pressureEvidence.standard,
    /statics/i,
  );
  assert.doesNotMatch(
    defaultSnapshot.results.bearing.pressureEvidence.standard,
    /^ACI 318-19$/,
  );
});

await test('all required non-evaluated rows and construction locks remain explicit even when equations pass', () => {
  const required = [
    'settlement',
    'sliding-overturning',
    'partial-contact-redistribution',
    'durability-cover',
    'minimum-clear-spacing',
    'development-anchorage',
    'column-footing-transfer',
    'dowels',
    'construction-tolerances',
    'released-bbs',
  ];
  for (const id of required) {
    const check = checkById(defaultSnapshot, id);
    assert.equal(check.status, 'HOLD');
    assert.equal(check.applicability, 'NOT_EVALUATED');
  }
  assert.equal(defaultSnapshot.results.overall.status, 'ENGINEERING REVIEW REQUIRED');
  assert.equal(defaultSnapshot.constructionAuthorization.status, 'HOLD_OWNER_PE');
  assert.equal(defaultSnapshot.constructionAuthorization.drawingPack, 'NOT FOR CONSTRUCTION');
  assert.equal(defaultSnapshot.constructionAuthorization.bbs, 'NOT RELEASED BBS');
  assert.equal(defaultSnapshot.constructionAuthorization.printAllowed, false);
  assert.equal(defaultSnapshot.constructionAuthorization.exportAllowed, false);
  assert.equal(defaultSnapshot.results.takeoff.massKg, null);
});

await test('all frozen selector surfaces carry one Snapshot ID/hash and share exact geometry/rebar/takeoff evidence', () => {
  const selectors = [
    selectSpreadFootingSummaryData,
    selectSpreadFootingChecksData,
    selectSpreadFootingDiagramData,
    selectSpreadFootingSectionData,
    selectSpreadFooting3DData,
    selectSpreadFootingReportData,
    selectSpreadFootingCalculationBookData,
    selectSpreadFootingDrawingData,
    selectSpreadFootingTakeoffData,
  ];
  const surfaces = selectors.map((selector) => selector(defaultSnapshot));
  assert.equal(surfaces.length, 9);
  for (const surface of surfaces) {
    assert.equal(surface.snapshotId, defaultSnapshot.id);
    assert.equal(surface.payloadHash, defaultSnapshot.payloadHash);
    assert.equal(surface.fingerprint, defaultSnapshot.fingerprint);
    assert.equal(surface.calculationFingerprint, defaultSnapshot.calculationFingerprint);
    assert.equal(surface.profileId, HYBRID_PROFILE_ID);
    assert.equal(surface.designStandardProfileId, HYBRID_PROFILE_ID);
    assert.equal(surface.strategyId, SPREAD_FOOTING_ENGINE_PROFILE.strategyId);
    assert.equal(surface.combinationId, THAI_COMBINATION_ID);
    assert.equal(surface.designBasis.profileId, HYBRID_PROFILE_ID);
    assert.equal(surface.designBasis.loadCombination.id, THAI_COMBINATION_ID);
    assert.equal(surface.overallStatus, 'ENGINEERING REVIEW REQUIRED');
    assert.equal(surface.constructionAuthorization.exportAllowed, false);
    assert.ok(Object.isFrozen(surface));
    assert.ok(Object.isFrozen(surface.data));
  }
  assert.equal(new Set(surfaces.map((surface) => surface.surface)).size, 9);

  const section = selectSpreadFootingSectionData(defaultSnapshot);
  const threeD = selectSpreadFooting3DData(defaultSnapshot);
  const report = selectSpreadFootingReportData(defaultSnapshot);
  const drawing = selectSpreadFootingDrawingData(defaultSnapshot);
  const takeoff = selectSpreadFootingTakeoffData(defaultSnapshot);
  assert.deepEqual(section.data.geometry, threeD.data.geometry);
  assert.deepEqual(section.data.geometry, drawing.data.geometry);
  assert.deepEqual(section.data.reinforcement, threeD.data.reinforcement);
  assert.deepEqual(section.data.barCut, report.data.section.barCut);
  assert.deepEqual(report.data.inputs.materials, defaultSnapshot.input.materials);
  assert.deepEqual(report.data.inputs.loads, defaultSnapshot.input.loads);
  assert.deepEqual(report.data.inputs.soil, defaultSnapshot.input.soil);
  assert.deepEqual(report.data.flexure, defaultSnapshot.results.flexure);
  assert.deepEqual(report.data.oneWayShear, defaultSnapshot.results.oneWayShear);
  assert.deepEqual(report.data.punching, defaultSnapshot.results.punching);
  assert.deepEqual(drawing.data.barCut, takeoff.data.barCut);
  assert.deepEqual(drawing.data.takeoff, takeoff.data.takeoff);
  assert.equal(section.data.geometry.renderModel.barsA.length, defaultSnapshot.input.reinforcement.A.count);
  assert.equal(section.data.geometry.renderModel.barsB.length, defaultSnapshot.input.reinforcement.B.count);
  assert.equal(threeD.data.bearing.pressureSamples.length, 9);
  assert.equal(selectSpreadFootingSummaryData({ ok: false }), null);
});

await test('alternate profile evidence propagates dynamically through every selector envelope', async () => {
  const alternate = await createSpreadFootingSnapshot(confirmedAciDraft(), FIXED_TIME);
  assert.equal(alternate.ok, true);
  assert.equal(alternate.input.basis.designStandardProfileId, ACI_PROFILE_ID);
  assert.equal(alternate.profileId, ACI_PROFILE_ID);
  assert.equal(alternate.designBasis.profileId, ACI_PROFILE_ID);
  assert.equal(alternate.designBasis.resolvedProfile, SPREAD_FOOTING_DESIGN_STANDARD_PROFILE_REGISTRY[ACI_PROFILE_ID]);
  assert.equal(alternate.designBasis.loadCombination.id, ACI_COMBINATION_ID);

  for (const selector of [
    selectSpreadFootingSummaryData,
    selectSpreadFootingChecksData,
    selectSpreadFootingDiagramData,
    selectSpreadFootingSectionData,
    selectSpreadFooting3DData,
    selectSpreadFootingReportData,
    selectSpreadFootingCalculationBookData,
    selectSpreadFootingDrawingData,
    selectSpreadFootingTakeoffData,
  ]) {
    const surface = selector(alternate);
    assert.equal(surface.profileId, ACI_PROFILE_ID);
    assert.equal(surface.designStandardProfileId, ACI_PROFILE_ID);
    assert.equal(surface.combinationId, ACI_COMBINATION_ID);
    assert.equal(surface.designBasis.profileId, ACI_PROFILE_ID);
    assert.equal(surface.designBasis.loadCombination.id, ACI_COMBINATION_ID);
    assert.equal(surface.payloadHash, alternate.payloadHash);
    assert.equal(surface.calculationFingerprint, alternate.calculationFingerprint);
  }
});

await test('dynamic member marks propagate into immutable takeoff evidence and every selector model', async () => {
  const dynamic = await createSpreadFootingSnapshot({
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    memberMark: 'F-02',
    barsA: 10,
    barDiaA: 'DB20',
    barsB: 9,
    barDiaB: 'DB12',
  }, FIXED_TIME);
  assert.equal(dynamic.ok, true);
  const evidence = dynamic.results.equations.find(
    (equation) => equation.equationId === 'SF-EQ-GEOMETRIC-TAKEOFF',
  );
  assert.ok(evidence);
  assert.match(evidence.substitution, /^F02-A=10\(/);
  assert.match(evidence.substitution, /; F02-B=9\(/);
  assert.doesNotMatch(evidence.substitution, /F01-[AB]/);
  for (const selector of [
    selectSpreadFootingSummaryData,
    selectSpreadFootingSectionData,
    selectSpreadFooting3DData,
    selectSpreadFootingReportData,
    selectSpreadFootingCalculationBookData,
    selectSpreadFootingDrawingData,
    selectSpreadFootingTakeoffData,
  ]) {
    const model = selector(dynamic);
    const serialized = JSON.stringify(model.data);
    assert.match(serialized, /F02-A/);
    assert.match(serialized, /F02-B/);
    assert.doesNotMatch(serialized, /F01-[AB]/);
  }
});

await test('profile and outputs never claim construction or PE approval', () => {
  assert.equal(SPREAD_FOOTING_ENGINE_PROFILE.overallStatus, 'ENGINEERING REVIEW REQUIRED');
  assert.equal(SPREAD_FOOTING_ENGINE_PROFILE.constructionAuthorization, 'HOLD_OWNER_PE');
  const serialized = JSON.stringify(defaultSnapshot);
  assert.doesNotMatch(serialized, /CONSTRUCTION APPROVED|PE APPROVED|"bbs":"RELEASED BBS"/i);
  assert.match(serialized, /NOT FOR CONSTRUCTION/);
  assert.match(serialized, /NOT RELEASED BBS/);
});

console.log(`\nSpread Footing engine tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exitCode = 1;
