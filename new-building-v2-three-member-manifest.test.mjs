import assert from 'node:assert/strict';
import {
  NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD,
  NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD,
  assertNewBuildingV2ThreeMemberManifestParity,
  compileNewBuildingV2RebarPathManifest,
  compileNewBuildingV2ThreeMemberManifest,
  inspectNewBuildingV2ThreeMemberManifestParity,
} from './new-building-v2-three-member-manifest.mjs';
import { buildNewBuildingV2DemoGeometry } from '../src/features/projects/newBuildingV2DemoSeed.js';
import { buildNewBuildingV2FootingMemberCardEvidence } from '../src/features/projects/newBuildingV2FootingDesign.js';

const identity = Object.freeze({
  snapshotId: 'PAS-CURRENT',
  inputFingerprint: 'PAI-CURRENT',
  outputFingerprint: 'PAO-CURRENT',
  p1DrawingFingerprint: 'P1-CURRENT',
});

const analytical = Object.freeze({
  family: 'analytical-beam',
  id: 'B-01',
  mark: 'B1',
  levelId: 'L_F1',
  authority: 'ANALYSIS_SNAPSHOT_CURRENT',
  analysisInclusion: 'included',
  from: { x: 0, y: 0, z: 3.5 },
  to: { x: 4, y: 0, z: 3.5 },
  widthM: 0.15,
  depthM: 0.3,
});

const secondary = Object.freeze({
  family: 'secondary-beam',
  id: 'SB-01',
  mark: 'SB1',
  levelId: 'L_F1',
  sourceMemberId: 'B-01',
  authority: 'DRAWING_INPUT_ENGINE_0',
  analysisInclusion: 'excluded',
  from: { x: 0, y: 1.5, z: 3.5 },
  to: { x: 4, y: 1.5, z: 3.5 },
});

const roof = Object.freeze({
  family: 'roof-member',
  id: 'RF-01',
  mark: 'จันทัน',
  levelId: 'L_RF',
  role: 'rafter',
  authority: 'DRAWING_PREVIEW_ENGINE_0',
  analysisInclusion: 'excluded',
  from: { x: 0, y: 0, z: 7.2 },
  to: { x: 4, y: 3.5, z: 8.1 },
});

const input = (members = [roof, secondary, analytical], overrides = {}) => ({
  identity,
  visibleLevelIds: ['L_RF', 'L_F1'],
  members,
  ...overrides,
});

const p5 = compileNewBuildingV2ThreeMemberManifest(input());
const p7 = compileNewBuildingV2ThreeMemberManifest(input([analytical, roof, secondary], { visibleLevelIds: ['L_F1', 'L_RF'] }));
assert.equal(p5.ok, true);
assert.equal(p5.current, true);
assert.equal(p5.counts.analytical, 1);
assert.equal(p5.counts.secondary, 1);
assert.equal(p5.counts.roof, 1);
assert.deepEqual(p5.memberKeys, ['analytical-beam:B-01', 'roof-member:RF-01', 'secondary-beam:SB-01']);
assert.equal(p5.signature, p7.signature, 'input order must not alter the deterministic member signature');
assert.equal(assertNewBuildingV2ThreeMemberManifestParity(p5, p7).memberCount, 3);
assert.equal(Object.isFrozen(p5), true);
assert.equal(Object.isFrozen(p5.members), true);
assert.equal(Object.isFrozen(p5.members[0].from), true);
assert.equal(p5.members.find((member) => member.id === 'SB-01').forceProjectionAuthorized, false);
assert.equal(p5.members.find((member) => member.id === 'RF-01').rebarProjectionAuthorized, false);
assert.equal(p5.members.find((member) => member.id === 'SB-01').mark, 'SB1');
const renamedSecondary = compileNewBuildingV2ThreeMemberManifest(input([{ ...secondary, mark: 'SB9' }, analytical, roof]));
assert.notEqual(renamedSecondary.signature, p5.signature, 'changing a visible P1 mark must change the deterministic manifest signature');
const missingMark = compileNewBuildingV2ThreeMemberManifest(input([{ ...secondary, mark: '' }]));
assert.equal(missingMark.ok, false);
assert.equal(missingMark.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.MARK_MISSING);
assert.deepEqual(missingMark.members, [], 'missing visible mark must hold the complete manifest');

const tampered = compileNewBuildingV2ThreeMemberManifest(input([
  analytical,
  secondary,
  { ...roof, to: { ...roof.to, z: roof.to.z + 0.01 } },
]));
assert.notEqual(tampered.signature, p5.signature);
assert.equal(
  inspectNewBuildingV2ThreeMemberManifestParity(p5, tampered).code,
  NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.PARITY_SIGNATURE_MISMATCH,
);
assert.throws(
  () => assertNewBuildingV2ThreeMemberManifestParity(p5, tampered),
  (error) => error.code === NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.PARITY_SIGNATURE_MISMATCH,
);

const duplicate = compileNewBuildingV2ThreeMemberManifest(input([analytical, analytical]));
assert.equal(duplicate.ok, false);
assert.equal(duplicate.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.MEMBER_DUPLICATE);
assert.deepEqual(duplicate.members, [], 'a bad member must hold the complete manifest rather than emit a partial scene');

const wrongAuthority = compileNewBuildingV2ThreeMemberManifest(input([{ ...secondary, authority: 'ANALYSIS_SNAPSHOT_CURRENT' }]));
assert.equal(wrongAuthority.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.AUTHORITY_MISMATCH);

const wrongInclusion = compileNewBuildingV2ThreeMemberManifest(input([{ ...secondary, analysisInclusion: 'included' }]));
assert.equal(wrongInclusion.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ANALYSIS_INCLUSION_MISMATCH);

const missingSecondarySource = compileNewBuildingV2ThreeMemberManifest(input([{ ...secondary, sourceMemberId: '' }]));
assert.equal(missingSecondarySource.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECONDARY_SOURCE_MISSING);

const drawingSourceSecondary = {
  ...secondary,
  sourceMemberId: undefined,
  sourceDrawingOnlyElementId: 'DOE-MB-01',
};
const drawingSourceManifest = compileNewBuildingV2ThreeMemberManifest(input([drawingSourceSecondary]));
assert.equal(drawingSourceManifest.ok, true);
assert.equal(drawingSourceManifest.members[0].sourceDrawingOnlyElementId, 'DOE-MB-01');
assert.equal(drawingSourceManifest.members[0].sourceMemberId, null);
assert.equal(drawingSourceManifest.members[0].forceProjectionAuthorized, false);
assert.equal(drawingSourceManifest.members[0].rebarProjectionAuthorized, false);
assert.equal(drawingSourceManifest.members[0].section.state, 'LINE_ONLY');

const ambiguousSecondarySource = compileNewBuildingV2ThreeMemberManifest(input([{
  ...secondary,
  sourceDrawingOnlyElementId: 'DOE-MB-01',
}]));
assert.equal(ambiguousSecondarySource.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECONDARY_SOURCE_AMBIGUOUS);
assert.deepEqual(ambiguousSecondarySource.members, []);

const alternateDrawingSourceManifest = compileNewBuildingV2ThreeMemberManifest(input([{
  ...drawingSourceSecondary,
  sourceDrawingOnlyElementId: 'DOE-MB-02',
}]));
assert.notEqual(alternateDrawingSourceManifest.signature, drawingSourceManifest.signature,
  'DOE source identity must participate in the deterministic manifest signature');
assert.notEqual(drawingSourceManifest.signature, compileNewBuildingV2ThreeMemberManifest(input([secondary])).signature,
  'analytical and DOE source namespaces must never alias in the manifest signature');

const missingRoofRole = compileNewBuildingV2ThreeMemberManifest(input([{ ...roof, role: '' }]));
assert.equal(missingRoofRole.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ROOF_ROLE_MISSING);

const invalidEndpoint = compileNewBuildingV2ThreeMemberManifest(input([{ ...analytical, to: { x: Number.NaN, y: 0, z: 0 } }]));
assert.equal(invalidEndpoint.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ENDPOINT_INVALID);

const coincident = compileNewBuildingV2ThreeMemberManifest(input([{ ...analytical, to: analytical.from }]));
assert.equal(coincident.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ENDPOINT_COINCIDENT);

const partialSection = compileNewBuildingV2ThreeMemberManifest(input([{ ...analytical, depthM: null }]));
assert.equal(partialSection.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECTION_INCOMPLETE);

const invalidSection = compileNewBuildingV2ThreeMemberManifest(input([{ ...analytical, widthM: -0.15 }]));
assert.equal(invalidSection.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECTION_INVALID);

const missingIdentity = compileNewBuildingV2ThreeMemberManifest(input([analytical], { identity: { ...identity, outputFingerprint: '' } }));
assert.equal(missingIdentity.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.IDENTITY_MISSING);

const missingLevels = compileNewBuildingV2ThreeMemberManifest(input([analytical], { visibleLevelIds: [] }));
assert.equal(missingLevels.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.LEVEL_SELECTION_MISSING);

const upstreamHold = compileNewBuildingV2ThreeMemberManifest(input([analytical], {
  upstreamHolds: [{ family: 'secondary-beam', id: 'P1-DRAWING', code: 'P1_DRAWING_OVERLAY_HOLD' }],
}));
assert.equal(upstreamHold.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.UPSTREAM_HOLD);
assert.equal(upstreamHold.diagnostics[0].code, 'P1_DRAWING_OVERLAY_HOLD');

const empty = compileNewBuildingV2ThreeMemberManifest(input([]));
assert.equal(empty.code, NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.EMPTY);

// Current Demo fixture: P5 and P7 must receive the same 64 analytical beams plus
// the same five P1 secondary-beam drawing overlays. The overlays remain ENGINE 0
// and never become force/rebar/design members merely because they are visible.
const demoGeometry = buildNewBuildingV2DemoGeometry();
const demoLevelElevations = new Map(demoGeometry.levels.map((level) => [level.id, Number(level.elev)]));
const demoAnalyticalById = new Map(demoGeometry.lineMembers.map((member) => [member.id, member]));
const demoPoint = (nodeId, levelId) => ({
  x: Number(demoGeometry.nodes[nodeId].x),
  y: Number(demoGeometry.nodes[nodeId].y),
  z: demoLevelElevations.get(levelId),
});
const demoAnalyticalMembers = demoGeometry.lineMembers.map((member) => ({
  family: 'analytical-beam',
  id: member.id,
  mark: member.mark,
  levelId: member.level,
  authority: 'ANALYSIS_SNAPSHOT_CURRENT',
  analysisInclusion: 'included',
  from: demoPoint(member.from, member.level),
  to: demoPoint(member.to, member.level),
  widthM: Number(member.b),
  depthM: Number(member.h),
}));
const demoSecondaryMembers = demoGeometry.drawingOnlyLineMembers.map((member) => {
  const source = demoAnalyticalById.get(member.sourceMemberId);
  assert.ok(source, `${member.id} must reference an existing Demo analytical beam`);
  const sourceFrom = demoPoint(source.from, source.level);
  const sourceTo = demoPoint(source.to, source.level);
  return {
    family: 'secondary-beam',
    id: member.id,
    mark: member.mark,
    levelId: member.level,
    sourceMemberId: member.sourceMemberId,
    authority: member.authority,
    analysisInclusion: member.analysisInclusion,
    from: member.axis === 'X'
      ? { x: sourceFrom.x, y: Number(member.positionM), z: sourceFrom.z }
      : { x: Number(member.positionM), y: sourceFrom.y, z: sourceFrom.z },
    to: member.axis === 'X'
      ? { x: sourceTo.x, y: Number(member.positionM), z: sourceTo.z }
      : { x: Number(member.positionM), y: sourceTo.y, z: sourceTo.z },
    widthM: null,
    depthM: null,
  };
});
const demoManifestInput = {
  identity: {
    snapshotId: 'PAS-DEMO-CURRENT',
    inputFingerprint: 'PAI-DEMO-CURRENT',
    outputFingerprint: 'PAO-DEMO-CURRENT',
    p1DrawingFingerprint: 'P1-DEMO-CURRENT',
  },
  visibleLevelIds: ['L_F1', 'L_F2'],
  members: [...demoAnalyticalMembers, ...demoSecondaryMembers],
};
const demoP5Manifest = compileNewBuildingV2ThreeMemberManifest(demoManifestInput);
const demoP7Manifest = compileNewBuildingV2ThreeMemberManifest({
  ...demoManifestInput,
  members: [...demoSecondaryMembers].reverse().concat([...demoAnalyticalMembers].reverse()),
});
assert.equal(demoP5Manifest.ok, true);
assert.deepEqual(demoP5Manifest.counts, { analytical: 64, secondary: 5, roof: 0, total: 69 });
assert.equal(demoP5Manifest.signature, demoP7Manifest.signature);
assert.equal(assertNewBuildingV2ThreeMemberManifestParity(demoP5Manifest, demoP7Manifest).memberCount, 69);
assert.equal(demoP5Manifest.members.filter((member) => member.family === 'secondary-beam' && member.forceProjectionAuthorized).length, 0);
assert.equal(demoP5Manifest.members.filter((member) => member.family === 'secondary-beam' && member.rebarProjectionAuthorized).length, 0);
assert.deepEqual(
  demoP5Manifest.members.filter((member) => member.family === 'secondary-beam').map((member) => member.mark).sort(),
  demoGeometry.drawingOnlyLineMembers.map((member) => member.mark).sort(),
  'P5/P7 manifest must preserve the P1 drawing mark while levelId remains available for an unambiguous whole-building label',
);

// Recovered ProbimX pattern is used only as a deterministic presentation-path
// manifest. Card evidence remains the sole source; anchorage/lap/stair/slab stay HOLD.
const rebarIdentity = {
  identity,
  designIdentity: {
    snapshotId: identity.snapshotId,
    inputFingerprint: identity.inputFingerprint,
    outputFingerprint: identity.outputFingerprint,
  },
};
const stableEvidence = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableEvidence).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableEvidence(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};
const beamBasis = {
  widthM: 0.15, depthM: 0.3, coverM: 0.025,
  top: { count: 4, diameterMm: 16 },
  bottom: { count: 6, diameterMm: 16 },
  stirrup: { diameterMm: 9, spacingCm: 12.5 },
};
const beamRebar = {
  memberId: 'B-01', memberKind: 'analytical-beam', groupId: 'B-01',
  basis: beamBasis,
  basisSignature: stableEvidence(beamBasis),
  evidenceAuthority: 'P4_CARD_RESULT_CURRENT',
  cardSnapshotId: 'beam-snapshot-B01',
  cardFingerprint: 'beam-card-B01',
  sectionSelectionCardSnapshotId: 'NOT_APPLICABLE',
  sectionSelectionCardFingerprint: 'NOT_APPLICABLE',
  sectionSelectionAuthority: 'NOT_APPLICABLE',
  analysisIntegrationAuthority: 'NOT_APPLICABLE',
  constructionAuthorized: false,
  ownerPeReviewRequired: true,
  topLayers: [2, 2], bottomLayers: [2, 2, 2],
};
const columnBasis = {
  widthM: 0.2, depthM: 0.2, coverM: 0.025,
  mainBarCount: 4, mainBarDiameterMm: 16,
  tieDiameterMm: 9, tieSpacingCm: 15,
};
const columnRebar = {
  memberId: 'C-01', groupId: 'C-01',
  basis: columnBasis,
  basisSignature: stableEvidence(columnBasis),
  evidenceAuthority: 'P4_COLUMN_CARD_RESULT_CURRENT',
  cardSnapshotId: 'column-snapshot-C01',
  cardFingerprint: 'column-card-C01',
  snapshotId: identity.snapshotId,
  sourceFingerprint: identity.outputFingerprint,
  analysisWidthM: columnBasis.widthM,
  analysisDepthM: columnBasis.depthM,
  geometryWidthM: columnBasis.widthM,
  geometryDepthM: columnBasis.depthM,
  constructionAuthorized: false,
  ownerPeReviewRequired: true,
  positions: [
    { xMm: 34, yMm: 34 }, { xMm: 166, yMm: 34 },
    { xMm: 166, yMm: 166 }, { xMm: 34, yMm: 166 },
  ],
};
const footingConfig = { A_m: 1.5, B_m: 1.5, T_cm: 35, coverCm: 7.5, dMainMm: 12, nA: 8, nB: 8 };
const footingEquationSheet = {
  ok: true,
  reason: null,
  rowCount: 1,
  topic: 'footing',
  memberId: 'F-01',
  sourceFingerprint: identity.outputFingerprint,
  sections: [{ section: 'check', rows: [{ id: 'pile', kind: 'check', label: 'pile', ok: true, status: 'pass' }] }],
};
const footingMember = {
  id: 'F-01', node: 'GX-1/GY-1', mark: 'F1', status: 'PASS', verdict: 'pass', code: null,
  loads: { pdKg: 10000, plKg: 5000, puKg: 22500, muxKgm: 0, muyKgm: 0 },
  pileCount: 1,
  pile: { id: 'I-26', label: 'I 0.26 m', swlDesignTon: 30, dimCm: 26, shape: 'I', verified: true, source: 'verified-test' },
  config: footingConfig,
  checks: { pileUtilization: 0.5, shearUtilization: 0.4, punchUtilization: 0.3, steelUtilization: 0.6, dowelUtilization: 0.2, stmUtilization: null, allCoreOK: true, verdictLabel: 'PASS' },
  summary: { sizeLabel: '1.50 × 1.50 m', utilization: 0.6 },
  equationSheet: footingEquationSheet,
};
const footingCardEvidence = buildNewBuildingV2FootingMemberCardEvidence({
  member: footingMember,
  snapshotId: identity.snapshotId,
  sourceFingerprint: identity.outputFingerprint,
  equationSheet: footingEquationSheet,
});
const footingRebar = {
  memberId: 'F-01', mark: 'F1',
  config: footingConfig,
  snapshotId: identity.snapshotId,
  sourceFingerprint: identity.outputFingerprint,
  sheetSourceFingerprint: identity.outputFingerprint,
  basisSignature: stableEvidence(footingConfig),
  cardEvidence: footingCardEvidence,
  evidenceAuthority: 'FOOTING_CARD_RESULT_CURRENT',
  constructionAuthorized: false,
  ownerPeReviewRequired: true,
};
const rebarInput = {
  ...rebarIdentity,
  beams: [beamRebar], columns: [columnRebar], footings: [footingRebar],
  holds: [
    { family: 'slab', code: 'SLAB_REBAR_PLACEMENT_ADAPTER_REQUIRED', count: 2, ids: ['S2', 'S1'] },
    { family: 'stair', code: 'STAIR_REBAR_ADAPTER_REQUIRED', count: null, ids: [] },
  ],
};
const rebarManifest = compileNewBuildingV2RebarPathManifest(rebarInput);
const reorderedRebarManifest = compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  holds: [...rebarInput.holds].reverse(),
});
assert.equal(rebarManifest.ok, true);
assert.deepEqual(rebarManifest.entryKeys, ['beam:B-01', 'column:C-01', 'footing:F-01']);
assert.deepEqual(rebarManifest.counts, { total: 3, beam: 1, column: 1, footing: 1, holds: 6 });
assert.equal(rebarManifest.signature, reorderedRebarManifest.signature,
  'hold/input order must not alter the rebar path signature');
assert.ok(rebarManifest.holds.some(hold => hold.family === 'beam-anchorage'));
assert.ok(rebarManifest.holds.some(hold => hold.family === 'beam-lap'));
assert.ok(rebarManifest.holds.some(hold => hold.family === 'column-development'));
assert.ok(rebarManifest.holds.some(hold => hold.family === 'footing-development'));
assert.equal(rebarManifest.anchorageAuthorized, false);
assert.equal(rebarManifest.lapSpliceAuthorized, false);
assert.equal(rebarManifest.sourceProvenance.importedRuntimeCode, false);
assert.equal(Object.isFrozen(rebarManifest.entries[0]), true);
const alternateCardIdentityManifest = compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [{ ...beamRebar, cardFingerprint: 'beam-card-B01-alternate' }],
});
assert.equal(alternateCardIdentityManifest.ok, true);
assert.notEqual(alternateCardIdentityManifest.signature, rebarManifest.signature,
  'P4 Card fingerprint must participate in the deterministic rebar path signature');

const secondaryBeamRebar = {
  ...beamRebar,
  memberId: 'SB-01',
  memberKind: 'secondary-beam',
  groupId: 'B-SB-01',
  evidenceAuthority: 'P3_SECONDARY_AND_P4_CARD_CURRENT',
  cardSnapshotId: 'p4-beam-snapshot-SB01',
  cardFingerprint: 'p4-beam-card-SB01',
  sectionSelectionCardSnapshotId: 'p3-beam-snapshot-SB01',
  sectionSelectionCardFingerprint: 'p3-beam-card-SB01',
  sectionSelectionAuthority: 'BEAM_CARD_SNAPSHOT_CURRENT',
  analysisIntegrationAuthority: 'OWNER_APPROVED_ANALYSIS_PE_REVIEW_REQUIRED',
};
const secondaryManifest = compileNewBuildingV2RebarPathManifest({
  ...rebarIdentity,
  beams: [secondaryBeamRebar],
});
assert.equal(secondaryManifest.ok, true);
const alternateSecondaryCardManifest = compileNewBuildingV2RebarPathManifest({
  ...rebarIdentity,
  beams: [{ ...secondaryBeamRebar, sectionSelectionCardFingerprint: 'p3-beam-card-SB01-alternate' }],
});
assert.notEqual(alternateSecondaryCardManifest.signature, secondaryManifest.signature,
  'P3 secondary Card fingerprint must remain independent and participate in the manifest signature');

assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  designIdentity: {},
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.DESIGN_IDENTITY_MISSING);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  designIdentity: { ...rebarInput.designIdentity, outputFingerprint: 'PAO-OTHER' },
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.DESIGN_IDENTITY_MISMATCH);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [{ ...beamRebar, topLayers: [2] }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [{ ...beamRebar, basisSignature: 'FORGED-BASIS' }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [{ ...beamRebar, cardSnapshotId: '' }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarIdentity,
  beams: [{ ...secondaryBeamRebar, sectionSelectionCardFingerprint: '' }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [{ ...beamRebar, constructionAuthorized: true }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  beams: [beamRebar, beamRebar],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_DUPLICATE);
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  columns: [{ ...columnRebar, cardFingerprint: '' }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'column cage without immutable Card identity must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  columns: [{ ...columnRebar, positions: [{ xMm: 10, yMm: 10 }, ...columnRebar.positions.slice(1)] }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'column bars outside the cover envelope must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  columns: [{ ...columnRebar, analysisWidthM: 0.25 }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'column analysis b×h that differs from the Card basis must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  columns: [{ ...columnRebar, geometryDepthM: 0.25 }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'column geometry b×h that differs from the immutable result must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  footings: [{ ...footingRebar, cardEvidence: { ...footingCardEvidence, cardFingerprint: '' } }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'footing grid without exact design identity must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  footings: [{ ...footingRebar, config: { ...footingConfig, A_m: 1.6 } }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'footing config changed after member Card evidence must HOLD');
assert.equal(compileNewBuildingV2RebarPathManifest({
  ...rebarInput,
  footings: [{
    ...footingRebar,
    cardEvidence: {
      ...footingCardEvidence,
      identity: { ...footingCardEvidence.identity, pile: { ...footingCardEvidence.identity.pile, verified: false } },
    },
  }],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID,
'footing pile verification changed after Card evidence must HOLD');

console.log('New Building V2 Three member manifest tests passed.');
