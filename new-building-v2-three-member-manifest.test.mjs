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

const identity = Object.freeze({
  snapshotId: 'PAS-CURRENT',
  inputFingerprint: 'PAI-CURRENT',
  outputFingerprint: 'PAO-CURRENT',
  p1DrawingFingerprint: 'P1-CURRENT',
});

const analytical = Object.freeze({
  family: 'analytical-beam',
  id: 'B-01',
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

// Current Demo fixture: P5 and P7 must receive the same 62 analytical beams plus
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
assert.deepEqual(demoP5Manifest.counts, { analytical: 62, secondary: 5, roof: 0, total: 67 });
assert.equal(demoP5Manifest.signature, demoP7Manifest.signature);
assert.equal(assertNewBuildingV2ThreeMemberManifestParity(demoP5Manifest, demoP7Manifest).memberCount, 67);
assert.equal(demoP5Manifest.members.filter((member) => member.family === 'secondary-beam' && member.forceProjectionAuthorized).length, 0);
assert.equal(demoP5Manifest.members.filter((member) => member.family === 'secondary-beam' && member.rebarProjectionAuthorized).length, 0);

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
const beamRebar = {
  memberId: 'B-01', groupId: 'B-01',
  basis: {
    widthM: 0.15, depthM: 0.3, coverM: 0.025,
    top: { count: 4, diameterMm: 16 },
    bottom: { count: 6, diameterMm: 16 },
    stirrup: { diameterMm: 9, spacingCm: 12.5 },
  },
  topLayers: [2, 2], bottomLayers: [2, 2, 2],
};
const columnRebar = {
  memberId: 'C-01', groupId: 'C-01',
  basis: {
    widthM: 0.2, depthM: 0.2, coverM: 0.025,
    mainBarCount: 4, mainBarDiameterMm: 16,
    tieDiameterMm: 9, tieSpacingCm: 15,
  },
  positions: [
    { xMm: 34, yMm: 34 }, { xMm: 166, yMm: 34 },
    { xMm: 166, yMm: 166 }, { xMm: 34, yMm: 166 },
  ],
};
const footingRebar = {
  memberId: 'F-01', mark: 'F1',
  config: { A_m: 1.5, B_m: 1.5, T_cm: 35, coverCm: 7.5, dMainMm: 12, nA: 8, nB: 8 },
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
  beams: [beamRebar, beamRebar],
}).code, NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_DUPLICATE);

console.log('New Building V2 Three member manifest tests passed.');
