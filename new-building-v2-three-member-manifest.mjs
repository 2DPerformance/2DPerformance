export const NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_SCHEMA = 'NEW-BUILDING-V2-THREE-MEMBER-MANIFEST-V1';
export const NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_AUTHORITY = 'SNAPSHOT_BOUND_PRESENTATION_GEOMETRY_ONLY';

export const NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD = Object.freeze({
  IDENTITY_MISSING: 'THREE_MANIFEST_IDENTITY_MISSING',
  LEVEL_SELECTION_MISSING: 'THREE_MANIFEST_LEVEL_SELECTION_MISSING',
  UPSTREAM_HOLD: 'THREE_MANIFEST_UPSTREAM_HOLD',
  EMPTY: 'THREE_MANIFEST_EMPTY',
  FAMILY_UNSUPPORTED: 'THREE_MANIFEST_FAMILY_UNSUPPORTED',
  MEMBER_ID_MISSING: 'THREE_MANIFEST_MEMBER_ID_MISSING',
  MARK_MISSING: 'THREE_MANIFEST_MARK_MISSING',
  MEMBER_DUPLICATE: 'THREE_MANIFEST_MEMBER_DUPLICATE',
  LEVEL_MISSING: 'THREE_MANIFEST_LEVEL_MISSING',
  ENDPOINT_INVALID: 'THREE_MANIFEST_ENDPOINT_INVALID',
  ENDPOINT_COINCIDENT: 'THREE_MANIFEST_ENDPOINT_COINCIDENT',
  SECTION_INCOMPLETE: 'THREE_MANIFEST_SECTION_INCOMPLETE',
  SECTION_INVALID: 'THREE_MANIFEST_SECTION_INVALID',
  AUTHORITY_MISMATCH: 'THREE_MANIFEST_AUTHORITY_MISMATCH',
  ANALYSIS_INCLUSION_MISMATCH: 'THREE_MANIFEST_ANALYSIS_INCLUSION_MISMATCH',
  SECONDARY_SOURCE_MISSING: 'THREE_MANIFEST_SECONDARY_SOURCE_MISSING',
  SECONDARY_SOURCE_AMBIGUOUS: 'THREE_MANIFEST_SECONDARY_SOURCE_AMBIGUOUS',
  ROOF_ROLE_MISSING: 'THREE_MANIFEST_ROOF_ROLE_MISSING',
  PARITY_HOLD: 'THREE_MANIFEST_PARITY_HOLD',
  PARITY_IDENTITY_MISMATCH: 'THREE_MANIFEST_PARITY_IDENTITY_MISMATCH',
  PARITY_SIGNATURE_MISMATCH: 'THREE_MANIFEST_PARITY_SIGNATURE_MISMATCH',
});

const FAMILY_CONTRACT = Object.freeze({
  'analytical-beam': Object.freeze({
    authority: 'ANALYSIS_SNAPSHOT_CURRENT',
    analysisInclusion: 'included',
  }),
  'secondary-beam': Object.freeze({
    authority: 'DRAWING_INPUT_ENGINE_0',
    analysisInclusion: 'excluded',
  }),
  'roof-member': Object.freeze({
    authority: 'DRAWING_PREVIEW_ENGINE_0',
    analysisInclusion: 'excluded',
  }),
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function text(value) {
  return String(value ?? '').trim();
}

function stableEvidence(value) {
  if (Array.isArray(value)) return `[${value.map(stableEvidence).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableEvidence(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function evidenceFingerprint(prefix, value) {
  const source = stableEvidence(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${prefix}-${(hash >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}

function evidenceValueValid(value, seen = new WeakSet()) {
  if (value === undefined || typeof value === 'function' || typeof value === 'symbol') return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object') return true;
  if (seen.has(value)) return false;
  seen.add(value);
  const valid = (Array.isArray(value) ? value : Object.values(value))
    .every((item) => evidenceValueValid(item, seen));
  seen.delete(value);
  return valid;
}

function numberToken(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'nan';
  return (Object.is(numeric, -0) ? 0 : numeric).toFixed(9);
}

function normalizePoint(point) {
  if (!point || typeof point !== 'object' || Array.isArray(point)) return null;
  const x = Number(point.x);
  const y = Number(point.y);
  const z = Number(point.z);
  if (![x, y, z].every(Number.isFinite)) return null;
  return Object.freeze({
    x: Object.is(x, -0) ? 0 : x,
    y: Object.is(y, -0) ? 0 : y,
    z: Object.is(z, -0) ? 0 : z,
  });
}

function normalizeIdentity(identity) {
  const snapshotId = text(identity?.snapshotId);
  const inputFingerprint = text(identity?.inputFingerprint);
  const outputFingerprint = text(identity?.outputFingerprint);
  const p1DrawingFingerprint = text(identity?.p1DrawingFingerprint);
  if (!snapshotId || !inputFingerprint || !outputFingerprint || !p1DrawingFingerprint) return null;
  return Object.freeze({ snapshotId, inputFingerprint, outputFingerprint, p1DrawingFingerprint });
}

function diagnostic(code, member, detail = null) {
  return Object.freeze({
    code,
    family: text(member?.family) || null,
    memberId: text(member?.id) || null,
    detail: detail ? text(detail) : null,
  });
}

function manifestHold(code, diagnostics, identity = null, visibleLevelIds = []) {
  return deepFreeze({
    ok: false,
    current: false,
    schema: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_SCHEMA,
    authority: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_AUTHORITY,
    code,
    identity,
    identityKey: identity
      ? [identity.snapshotId, identity.inputFingerprint, identity.outputFingerprint, identity.p1DrawingFingerprint].join('|')
      : null,
    visibleLevelIds,
    signature: null,
    members: [],
    memberKeys: [],
    counts: { total: 0, analytical: 0, secondary: 0, roof: 0 },
    bounds: null,
    diagnostics,
    constructionAuthorized: false,
    analysisMutationAuthorized: false,
  });
}

function normalizeSection(member, diagnostics) {
  const widthDeclared = member?.widthM !== null && member?.widthM !== undefined && member?.widthM !== '';
  const depthDeclared = member?.depthM !== null && member?.depthM !== undefined && member?.depthM !== '';
  if (widthDeclared !== depthDeclared) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECTION_INCOMPLETE, member));
    return null;
  }
  if (!widthDeclared) return Object.freeze({ widthM: null, depthM: null, state: 'LINE_ONLY' });
  const widthM = Number(member.widthM);
  const depthM = Number(member.depthM);
  if (!Number.isFinite(widthM) || !Number.isFinite(depthM) || widthM <= 0 || depthM <= 0) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECTION_INVALID, member));
    return null;
  }
  return Object.freeze({ widthM, depthM, state: 'SECTION_DECLARED' });
}

function normalizeMember(member, diagnostics) {
  const family = text(member?.family);
  const contract = FAMILY_CONTRACT[family];
  if (!contract) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.FAMILY_UNSUPPORTED, member));
    return null;
  }
  const id = text(member?.id);
  if (!id) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.MEMBER_ID_MISSING, member));
    return null;
  }
  const mark = text(member?.mark);
  if (!mark) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.MARK_MISSING, member));
    return null;
  }
  const levelId = text(member?.levelId);
  if (!levelId) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.LEVEL_MISSING, member));
    return null;
  }
  const from = normalizePoint(member?.from);
  const to = normalizePoint(member?.to);
  if (!from || !to) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ENDPOINT_INVALID, member));
    return null;
  }
  const lengthM = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  if (!(lengthM > 1e-6)) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ENDPOINT_COINCIDENT, member));
    return null;
  }
  const authority = text(member?.authority);
  if (authority !== contract.authority) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.AUTHORITY_MISMATCH, member, `${authority || 'missing'} != ${contract.authority}`));
    return null;
  }
  const analysisInclusion = text(member?.analysisInclusion);
  if (analysisInclusion !== contract.analysisInclusion) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ANALYSIS_INCLUSION_MISMATCH, member, `${analysisInclusion || 'missing'} != ${contract.analysisInclusion}`));
    return null;
  }
  const sourceMemberId = text(member?.sourceMemberId) || null;
  const sourceDrawingOnlyElementId = text(member?.sourceDrawingOnlyElementId) || null;
  if (family === 'secondary-beam') {
    const sourceReferenceCount = Number(Boolean(sourceMemberId)) + Number(Boolean(sourceDrawingOnlyElementId));
    if (sourceReferenceCount === 0) {
      diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECONDARY_SOURCE_MISSING, member));
      return null;
    }
    if (sourceReferenceCount !== 1) {
      diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.SECONDARY_SOURCE_AMBIGUOUS, member));
      return null;
    }
  }
  const role = text(member?.role) || null;
  if (family === 'roof-member' && !role) {
    diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.ROOF_ROLE_MISSING, member));
    return null;
  }
  const section = normalizeSection(member, diagnostics);
  if (!section) return null;
  return Object.freeze({
    key: `${family}:${id}`,
    id,
    mark,
    family,
    levelId,
    role,
    sourceMemberId,
    sourceDrawingOnlyElementId,
    authority,
    analysisInclusion,
    from,
    to,
    lengthM,
    section,
    forceProjectionAuthorized: family === 'analytical-beam',
    rebarProjectionAuthorized: family === 'analytical-beam',
    constructionAuthorized: false,
  });
}

function memberSignature(member) {
  const sourceReference = member.sourceDrawingOnlyElementId
    ? `DOE:${member.sourceDrawingOnlyElementId}`
    : member.sourceMemberId ? `AN:${member.sourceMemberId}` : '';
  return [
    member.key,
    member.mark,
    member.levelId,
    member.role || '',
    sourceReference,
    member.authority,
    member.analysisInclusion,
    numberToken(member.from.x), numberToken(member.from.y), numberToken(member.from.z),
    numberToken(member.to.x), numberToken(member.to.y), numberToken(member.to.z),
    numberToken(member.section.widthM), numberToken(member.section.depthM), member.section.state,
  ].join('|');
}

function fnv1a(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function manifestBounds(members) {
  const coordinates = members.flatMap((member) => [member.from, member.to]);
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  coordinates.forEach((point) => {
    min.x = Math.min(min.x, point.x); min.y = Math.min(min.y, point.y); min.z = Math.min(min.z, point.z);
    max.x = Math.max(max.x, point.x); max.y = Math.max(max.y, point.y); max.z = Math.max(max.z, point.z);
  });
  return Object.freeze({ min: Object.freeze(min), max: Object.freeze(max) });
}

export function compileNewBuildingV2ThreeMemberManifest(input = {}) {
  const identity = normalizeIdentity(input.identity);
  if (!identity) return manifestHold(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.IDENTITY_MISSING, [diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.IDENTITY_MISSING, null)]);
  const visibleLevelIds = [...new Set((Array.isArray(input.visibleLevelIds) ? input.visibleLevelIds : []).map(text).filter(Boolean))].sort();
  if (!visibleLevelIds.length) return manifestHold(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.LEVEL_SELECTION_MISSING, [diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.LEVEL_SELECTION_MISSING, null)], identity);
  const upstreamHolds = (Array.isArray(input.upstreamHolds) ? input.upstreamHolds : []).map((hold) => diagnostic(
    text(hold?.code) || NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.UPSTREAM_HOLD,
    { family: hold?.family, id: hold?.memberId || hold?.id },
    hold?.detail || null,
  ));
  if (upstreamHolds.length) return manifestHold(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.UPSTREAM_HOLD, upstreamHolds, identity, visibleLevelIds);
  const sourceMembers = Array.isArray(input.members) ? input.members : [];
  if (!sourceMembers.length) return manifestHold(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.EMPTY, [diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.EMPTY, null)], identity, visibleLevelIds);

  const diagnostics = [];
  const normalized = sourceMembers.map((member) => normalizeMember(member, diagnostics)).filter(Boolean);
  const seen = new Set();
  normalized.forEach((member) => {
    if (seen.has(member.key)) diagnostics.push(diagnostic(NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.MEMBER_DUPLICATE, member));
    seen.add(member.key);
  });
  if (diagnostics.length) return manifestHold(diagnostics[0].code, diagnostics, identity, visibleLevelIds);

  const members = normalized.sort((left, right) => left.key.localeCompare(right.key));
  const identityKey = [identity.snapshotId, identity.inputFingerprint, identity.outputFingerprint, identity.p1DrawingFingerprint].join('|');
  const canonical = [
    NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_SCHEMA,
    identityKey,
    visibleLevelIds.join(','),
    ...members.map(memberSignature),
  ].join('\n');
  const counts = Object.freeze({
    total: members.length,
    analytical: members.filter((member) => member.family === 'analytical-beam').length,
    secondary: members.filter((member) => member.family === 'secondary-beam').length,
    roof: members.filter((member) => member.family === 'roof-member').length,
  });
  return deepFreeze({
    ok: true,
    current: true,
    schema: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_SCHEMA,
    authority: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_AUTHORITY,
    code: 'THREE_MEMBER_MANIFEST_CURRENT',
    identity,
    identityKey,
    visibleLevelIds,
    signature: `NBV2-3D-${fnv1a(canonical)}`,
    members,
    memberKeys: members.map((member) => member.key),
    counts,
    bounds: manifestBounds(members),
    diagnostics: [],
    constructionAuthorized: false,
    analysisMutationAuthorized: false,
  });
}

export function inspectNewBuildingV2ThreeMemberManifestParity(left, right) {
  if (!left?.ok || !right?.ok) {
    return deepFreeze({ ok: false, code: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.PARITY_HOLD });
  }
  if (left.identityKey !== right.identityKey || left.visibleLevelIds.join('|') !== right.visibleLevelIds.join('|')) {
    return deepFreeze({ ok: false, code: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.PARITY_IDENTITY_MISMATCH });
  }
  if (left.signature !== right.signature
    || left.memberKeys.length !== right.memberKeys.length
    || left.memberKeys.some((key, index) => key !== right.memberKeys[index])) {
    return deepFreeze({ ok: false, code: NEW_BUILDING_V2_THREE_MEMBER_MANIFEST_HOLD.PARITY_SIGNATURE_MISMATCH });
  }
  return deepFreeze({
    ok: true,
    code: 'THREE_MEMBER_MANIFEST_PARITY_CURRENT',
    identityKey: left.identityKey,
    signature: left.signature,
    memberCount: left.members.length,
  });
}

export function assertNewBuildingV2ThreeMemberManifestParity(left, right) {
  const inspection = inspectNewBuildingV2ThreeMemberManifestParity(left, right);
  if (!inspection.ok) {
    const error = new Error(inspection.code);
    error.code = inspection.code;
    throw error;
  }
  return inspection;
}

// ---------------------------------------------------------------------------
// Card-evidence rebar presentation paths
// ---------------------------------------------------------------------------

export const NEW_BUILDING_V2_REBAR_PATH_MANIFEST_SCHEMA = 'NEW-BUILDING-V2-REBAR-PATH-MANIFEST-V1';
export const NEW_BUILDING_V2_REBAR_PATH_MANIFEST_AUTHORITY = 'CARD_EVIDENCE_PRESENTATION_PATHS_ONLY';

export const NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD = Object.freeze({
  IDENTITY_MISSING: 'REBAR_PATH_IDENTITY_MISSING',
  DESIGN_IDENTITY_MISSING: 'REBAR_PATH_DESIGN_IDENTITY_MISSING',
  DESIGN_IDENTITY_MISMATCH: 'REBAR_PATH_DESIGN_IDENTITY_MISMATCH',
  EMPTY: 'REBAR_PATH_EMPTY',
  ENTRY_INVALID: 'REBAR_PATH_ENTRY_INVALID',
  ENTRY_DUPLICATE: 'REBAR_PATH_ENTRY_DUPLICATE',
});

function positive(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function positiveInteger(value, minimum = 1) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= minimum ? numeric : null;
}

function rebarManifestHold(code, diagnostics = [], identity = null) {
  return deepFreeze({
    ok: false,
    current: false,
    schema: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_SCHEMA,
    authority: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_AUTHORITY,
    code,
    identity,
    signature: null,
    entries: [],
    entryKeys: [],
    holds: [],
    counts: { total: 0, beam: 0, column: 0, footing: 0, holds: 0 },
    diagnostics,
    constructionAuthorized: false,
    analysisMutationAuthorized: false,
    anchorageAuthorized: false,
    lapSpliceAuthorized: false,
  });
}

function normalizeRebarIdentity(input) {
  const identity = normalizeIdentity(input?.identity);
  if (!identity) return null;
  const designSnapshotId = text(input?.designIdentity?.snapshotId);
  const designInputFingerprint = text(input?.designIdentity?.inputFingerprint);
  const designOutputFingerprint = text(input?.designIdentity?.outputFingerprint);
  if (!designSnapshotId || !designInputFingerprint || !designOutputFingerprint) return undefined;
  if (designSnapshotId !== identity.snapshotId
    || designInputFingerprint !== identity.inputFingerprint
    || designOutputFingerprint !== identity.outputFingerprint) return false;
  return Object.freeze({
    ...identity,
    designSnapshotId,
    designInputFingerprint,
    designOutputFingerprint,
  });
}

function normalizeBeamRebarEntry(raw) {
  const memberId = text(raw?.memberId);
  const memberKind = text(raw?.memberKind);
  const groupId = text(raw?.groupId);
  const basis = raw?.basis;
  const basisSignature = text(raw?.basisSignature);
  const evidenceAuthority = text(raw?.evidenceAuthority);
  const cardSnapshotId = text(raw?.cardSnapshotId);
  const cardFingerprint = text(raw?.cardFingerprint);
  const sectionSelectionCardSnapshotId = text(raw?.sectionSelectionCardSnapshotId);
  const sectionSelectionCardFingerprint = text(raw?.sectionSelectionCardFingerprint);
  const sectionSelectionAuthority = text(raw?.sectionSelectionAuthority);
  const analysisIntegrationAuthority = text(raw?.analysisIntegrationAuthority);
  const secondary = memberKind === 'secondary-beam';
  const expectedEvidenceAuthority = secondary
    ? 'P3_SECONDARY_AND_P4_CARD_CURRENT'
    : 'P4_CARD_RESULT_CURRENT';
  const topLayers = Array.isArray(raw?.topLayers)
    ? raw.topLayers.map(value => positiveInteger(value, 2)) : [];
  const bottomLayers = Array.isArray(raw?.bottomLayers)
    ? raw.bottomLayers.map(value => positiveInteger(value, 2)) : [];
  const values = {
    widthM: positive(basis?.widthM), depthM: positive(basis?.depthM), coverM: positive(basis?.coverM),
    topCount: positiveInteger(basis?.top?.count, 2), topDiameterMm: positive(basis?.top?.diameterMm),
    bottomCount: positiveInteger(basis?.bottom?.count, 2), bottomDiameterMm: positive(basis?.bottom?.diameterMm),
    stirrupDiameterMm: positive(basis?.stirrup?.diameterMm), stirrupSpacingCm: positive(basis?.stirrup?.spacingCm),
  };
  const commonIdentityCurrent = Boolean(
    memberId && ['analytical-beam', 'secondary-beam'].includes(memberKind)
    && groupId && basisSignature && basisSignature === stableEvidence(basis)
    && evidenceAuthority === expectedEvidenceAuthority && cardSnapshotId && cardFingerprint
    && raw?.constructionAuthorized === false
    && raw?.ownerPeReviewRequired === true
  );
  const sectionIdentityCurrent = secondary
    ? Boolean(sectionSelectionCardSnapshotId && sectionSelectionCardFingerprint
      && sectionSelectionAuthority === 'BEAM_CARD_SNAPSHOT_CURRENT'
      && analysisIntegrationAuthority === 'OWNER_APPROVED_ANALYSIS_PE_REVIEW_REQUIRED')
    : sectionSelectionCardSnapshotId === 'NOT_APPLICABLE'
      && sectionSelectionCardFingerprint === 'NOT_APPLICABLE'
      && sectionSelectionAuthority === 'NOT_APPLICABLE'
      && analysisIntegrationAuthority === 'NOT_APPLICABLE';
  if (!commonIdentityCurrent || !sectionIdentityCurrent
    || topLayers.length === 0 || bottomLayers.length === 0
    || topLayers.some(value => value === null) || bottomLayers.some(value => value === null)
    || Object.values(values).some(value => value === null)
    || topLayers.reduce((sum, value) => sum + value, 0) !== values.topCount
    || bottomLayers.reduce((sum, value) => sum + value, 0) !== values.bottomCount) return null;
  return Object.freeze({
    key: `beam:${memberId}`,
    family: 'beam', memberId, memberKind, groupId,
    renderPathKind: 'FULL_LENGTH_CARD_EVIDENCE',
    basisSignature,
    evidenceAuthority,
    cardSnapshotId,
    cardFingerprint,
    sectionSelectionCardSnapshotId,
    sectionSelectionCardFingerprint,
    sectionSelectionAuthority,
    analysisIntegrationAuthority,
    constructionAuthorized: false,
    ownerPeReviewRequired: true,
    topLayers: Object.freeze(topLayers),
    bottomLayers: Object.freeze(bottomLayers),
    ...values,
    anchorageStatus: 'HOLD',
    lapSpliceStatus: 'HOLD',
  });
}

function normalizeColumnRebarEntry(raw, identity) {
  const memberId = text(raw?.memberId);
  const groupId = text(raw?.groupId);
  const basis = raw?.basis;
  const basisSignature = text(raw?.basisSignature);
  const evidenceAuthority = text(raw?.evidenceAuthority);
  const cardSnapshotId = text(raw?.cardSnapshotId);
  const cardFingerprint = text(raw?.cardFingerprint);
  const snapshotId = text(raw?.snapshotId);
  const sourceFingerprint = text(raw?.sourceFingerprint);
  const analysisWidthM = positive(raw?.analysisWidthM);
  const analysisDepthM = positive(raw?.analysisDepthM);
  const geometryWidthM = positive(raw?.geometryWidthM);
  const geometryDepthM = positive(raw?.geometryDepthM);
  const positions = Array.isArray(raw?.positions) ? raw.positions.map((position) => {
    const xMm = Number(position?.xMm);
    const yMm = Number(position?.yMm);
    return Number.isFinite(xMm) && Number.isFinite(yMm) ? Object.freeze({ xMm, yMm }) : null;
  }) : [];
  const values = {
    widthM: positive(basis?.widthM), depthM: positive(basis?.depthM), coverM: positive(basis?.coverM),
    mainBarCount: positiveInteger(basis?.mainBarCount, 4), mainBarDiameterMm: positive(basis?.mainBarDiameterMm),
    tieDiameterMm: positive(basis?.tieDiameterMm), tieSpacingCm: positive(basis?.tieSpacingCm),
  };
  const barCenterInsetMm = (values.coverM * 1000) + (values.mainBarDiameterMm / 2);
  const positionsInsideCover = positions.every(position => (
    position.xMm >= barCenterInsetMm && position.xMm <= (values.widthM * 1000) - barCenterInsetMm
    && position.yMm >= barCenterInsetMm && position.yMm <= (values.depthM * 1000) - barCenterInsetMm
  ));
  if (!memberId || !groupId || !identity
    || snapshotId !== identity.snapshotId || sourceFingerprint !== identity.outputFingerprint
    || !basisSignature || basisSignature !== stableEvidence(basis)
    || evidenceAuthority !== 'P4_COLUMN_CARD_RESULT_CURRENT'
    || !cardSnapshotId || !cardFingerprint
    || analysisWidthM === null || analysisDepthM === null
    || geometryWidthM === null || geometryDepthM === null
    || Math.abs(analysisWidthM - geometryWidthM) > 1e-9
    || Math.abs(analysisDepthM - geometryDepthM) > 1e-9
    || Math.abs(analysisWidthM - values.widthM) > 1e-9
    || Math.abs(analysisDepthM - values.depthM) > 1e-9
    || raw?.constructionAuthorized !== false || raw?.ownerPeReviewRequired !== true
    || Object.values(values).some(value => value === null)
    || positions.length !== values.mainBarCount || positions.some(position => position === null)
    || !positionsInsideCover) return null;
  return Object.freeze({
    key: `column:${memberId}`,
    family: 'column', memberId, groupId,
    renderPathKind: 'VERTICAL_CARD_EVIDENCE',
    snapshotId,
    sourceFingerprint,
    basisSignature,
    evidenceAuthority,
    cardSnapshotId,
    cardFingerprint,
    analysisWidthM,
    analysisDepthM,
    geometryWidthM,
    geometryDepthM,
    constructionAuthorized: false,
    ownerPeReviewRequired: true,
    positions: Object.freeze(positions),
    ...values,
    developmentStatus: 'HOLD',
  });
}

function normalizeFootingRebarEntry(raw, identity) {
  const memberId = text(raw?.memberId);
  const mark = text(raw?.mark);
  const config = raw?.config;
  const snapshotId = text(raw?.snapshotId);
  const sourceFingerprint = text(raw?.sourceFingerprint);
  const sheetSourceFingerprint = text(raw?.sheetSourceFingerprint);
  const basisSignature = text(raw?.basisSignature);
  const cardEvidence = raw?.cardEvidence;
  const cardIdentity = cardEvidence?.identity;
  const evidenceAuthority = text(raw?.evidenceAuthority);
  const values = {
    lengthAM: positive(config?.A_m), lengthBM: positive(config?.B_m), thicknessCm: positive(config?.T_cm),
    coverCm: positive(config?.coverCm), diameterMm: positive(config?.dMainMm),
    countA: positiveInteger(config?.nA, 2), countB: positiveInteger(config?.nB, 2),
  };
  const cardSchema = 'NEW-BUILDING-V2-FOOTING-MEMBER-CARD-V1';
  const cardSnapshotId = text(cardEvidence?.cardSnapshotId);
  const cardFingerprint = text(cardEvidence?.cardFingerprint);
  const configFingerprint = text(cardEvidence?.configFingerprint);
  const equationSheetFingerprint = text(cardEvidence?.equationSheetFingerprint);
  const resultFingerprint = text(cardEvidence?.resultFingerprint);
  const cardIdentityCurrent = Boolean(
    evidenceValueValid(cardIdentity)
    && cardEvidence?.schema === cardSchema
    && cardIdentity?.schema === cardSchema
    && text(cardEvidence?.memberId) === memberId
    && text(cardIdentity?.memberId) === memberId
    && text(cardEvidence?.snapshotId) === snapshotId
    && text(cardIdentity?.snapshotId) === snapshotId
    && text(cardEvidence?.sourceFingerprint) === sourceFingerprint
    && text(cardIdentity?.sourceFingerprint) === sourceFingerprint
    && text(cardIdentity?.mark) === mark
    && stableEvidence(cardIdentity?.config) === stableEvidence(config)
    && cardSnapshotId === evidenceFingerprint('NBV2-FOOTING-CARD-SNAPSHOT', { memberId, snapshotId, sourceFingerprint })
    && configFingerprint === evidenceFingerprint('NBV2-FOOTING-CONFIG', config)
    && equationSheetFingerprint === evidenceFingerprint('NBV2-FOOTING-SHEET', cardIdentity?.equationSheet ?? null)
    && resultFingerprint === evidenceFingerprint('NBV2-FOOTING-RESULT', cardIdentity?.result ?? null)
    && cardFingerprint === evidenceFingerprint('NBV2-FOOTING-CARD', cardIdentity)
    && ['pass', 'review'].includes(text(cardIdentity?.verdict).toLowerCase())
    && cardIdentity?.pile?.verified === true
    && cardEvidence?.constructionAuthorized === false
    && cardEvidence?.ownerPeReviewRequired === true
  );
  if (!memberId || !mark || !identity
    || snapshotId !== identity.snapshotId || sourceFingerprint !== identity.outputFingerprint
    || sheetSourceFingerprint !== sourceFingerprint
    || !basisSignature || basisSignature !== stableEvidence(config)
    || !cardIdentityCurrent
    || evidenceAuthority !== 'FOOTING_CARD_RESULT_CURRENT'
    || raw?.constructionAuthorized !== false || raw?.ownerPeReviewRequired !== true
    || Object.values(values).some(value => value === null)) return null;
  return Object.freeze({
    key: `footing:${memberId}`,
    family: 'footing', memberId, groupId: mark, mark,
    renderPathKind: 'ORTHOGONAL_CARD_EVIDENCE_GRID',
    snapshotId,
    sourceFingerprint,
    sheetSourceFingerprint,
    basisSignature,
    cardSnapshotId,
    cardFingerprint,
    configFingerprint,
    equationSheetFingerprint,
    resultFingerprint,
    evidenceAuthority,
    constructionAuthorized: false,
    ownerPeReviewRequired: true,
    ...values,
    dowelStatus: 'HOLD',
    developmentStatus: 'HOLD',
  });
}

function rebarEntrySignature(entry) {
  const values = Object.keys(entry).sort().map(key => {
    const value = entry[key];
    if (Array.isArray(value)) return `${key}=${value.map(item => (
      item && typeof item === 'object'
        ? Object.keys(item).sort().map(itemKey => `${itemKey}:${numberToken(item[itemKey])}`).join(',')
        : numberToken(item)
    )).join(';')}`;
    return `${key}=${typeof value === 'number' ? numberToken(value) : text(value)}`;
  });
  return values.join('|');
}

function normalizeRebarHolds(rawHolds, beamCount, columnCount, footingCount) {
  const holds = (Array.isArray(rawHolds) ? rawHolds : []).map((raw) => Object.freeze({
    family: text(raw?.family) || 'unknown',
    code: text(raw?.code) || 'REBAR_EVIDENCE_HOLD',
    count: raw?.count === null ? null : Math.max(0, Number(raw?.count) || 0),
    ids: Object.freeze([...new Set((Array.isArray(raw?.ids) ? raw.ids : []).map(text).filter(Boolean))].sort()),
  }));
  if (beamCount > 0) {
    holds.push(Object.freeze({ family: 'beam-anchorage', code: 'BEAM_ANCHORAGE_PATH_ADAPTER_REQUIRED', count: beamCount, ids: Object.freeze([]) }));
    holds.push(Object.freeze({ family: 'beam-lap', code: 'BEAM_LAP_SPLICE_PATH_ADAPTER_REQUIRED', count: beamCount, ids: Object.freeze([]) }));
  }
  if (columnCount > 0) {
    holds.push(Object.freeze({ family: 'column-development', code: 'COLUMN_DEVELOPMENT_PATH_ADAPTER_REQUIRED', count: columnCount, ids: Object.freeze([]) }));
  }
  if (footingCount > 0) {
    holds.push(Object.freeze({ family: 'footing-development', code: 'FOOTING_DOWEL_DEVELOPMENT_PATH_ADAPTER_REQUIRED', count: footingCount, ids: Object.freeze([]) }));
  }
  const unique = new Map();
  holds.forEach((hold) => unique.set(`${hold.family}:${hold.code}:${hold.ids.join(',')}`, hold));
  return [...unique.values()].sort((left, right) => (
    left.family.localeCompare(right.family) || left.code.localeCompare(right.code)
  ));
}

export function compileNewBuildingV2RebarPathManifest(input = {}) {
  const identity = normalizeRebarIdentity(input);
  if (identity === null) return rebarManifestHold(NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.IDENTITY_MISSING);
  if (identity === undefined) return rebarManifestHold(NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.DESIGN_IDENTITY_MISSING);
  if (identity === false) return rebarManifestHold(NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.DESIGN_IDENTITY_MISMATCH);
  const source = [
    ...(Array.isArray(input.beams) ? input.beams.map(row => ['beam', row]) : []),
    ...(Array.isArray(input.columns) ? input.columns.map(row => ['column', row]) : []),
    ...(Array.isArray(input.footings) ? input.footings.map(row => ['footing', row]) : []),
  ];
  if (!source.length) return rebarManifestHold(NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.EMPTY, [], identity);
  const diagnostics = [];
  const entries = source.map(([family, raw], index) => {
    const entry = family === 'beam' ? normalizeBeamRebarEntry(raw)
      : family === 'column' ? normalizeColumnRebarEntry(raw, identity)
        : normalizeFootingRebarEntry(raw, identity);
    if (!entry) diagnostics.push(Object.freeze({ code: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_INVALID, family, index }));
    return entry;
  }).filter(Boolean);
  const seen = new Set();
  entries.forEach((entry) => {
    if (seen.has(entry.key)) diagnostics.push(Object.freeze({ code: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_HOLD.ENTRY_DUPLICATE, family: entry.family, memberId: entry.memberId }));
    seen.add(entry.key);
  });
  if (diagnostics.length) return rebarManifestHold(diagnostics[0].code, diagnostics, identity);
  entries.sort((left, right) => left.key.localeCompare(right.key));
  const beamCount = entries.filter(entry => entry.family === 'beam').length;
  const columnCount = entries.filter(entry => entry.family === 'column').length;
  const footingCount = entries.filter(entry => entry.family === 'footing').length;
  const holds = normalizeRebarHolds(input.holds, beamCount, columnCount, footingCount);
  const canonical = [
    NEW_BUILDING_V2_REBAR_PATH_MANIFEST_SCHEMA,
    identity.snapshotId,
    identity.inputFingerprint,
    identity.outputFingerprint,
    identity.p1DrawingFingerprint,
    ...entries.map(rebarEntrySignature),
    ...holds.map(hold => `${hold.family}|${hold.code}|${hold.count ?? 'null'}|${hold.ids.join(',')}`),
  ].join('\n');
  return deepFreeze({
    ok: true,
    current: true,
    schema: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_SCHEMA,
    authority: NEW_BUILDING_V2_REBAR_PATH_MANIFEST_AUTHORITY,
    code: 'REBAR_PATH_MANIFEST_CURRENT_WITH_EXPLICIT_HOLDS',
    identity,
    signature: `NBV2-RBAR-${fnv1a(canonical)}`,
    entries,
    entryKeys: entries.map(entry => entry.key),
    holds,
    counts: {
      total: entries.length,
      beam: beamCount,
      column: columnCount,
      footing: footingCount,
      holds: holds.length,
    },
    sourceProvenance: Object.freeze({
      pattern: 'DETERMINISTIC_REBAR_RENDER_PATH_MANIFEST',
      recoveredProbimxModule: 'mod-132107.js',
      recoveredProbimxSha256: '850E2AA9EA6596F99880A8AB23658A40D08FBF8A0E7D61CC9FB57DD05B28D46F',
      importedRuntimeCode: false,
    }),
    constructionAuthorized: false,
    analysisMutationAuthorized: false,
    anchorageAuthorized: false,
    lapSpliceAuthorized: false,
  });
}
