/**
 * DRAWING ONLY. Owner-authorized geometry port from BOQ Building V2:
 * engine/rebar-engine.js g/b/M (57-65), j/S/A/R/D (114-217),
 * ui/viewer3d.js tubeInto (4-35). Phase B2 additionally projects the immutable
 * Phase B1 detailing: no bar selection, development formula or verdict here.
 * Fixed drawing table: source TH / non-seismic (มยผ.1103-64), bendRule=code.
 * Inside bend diameter: tie <=16mm 4d; otherwise <=25 6d, <=36 8d, >36 10d.
 * Centreline radius = (inside diameter + d)/2. Main hooks 90/135:12d,
 * 180:max(4d,60mm); tie hooks 135/180 or d<=16:max(6d,75mm), other 90:12d.
 * Owner Phase A adopts the 75 mm tie extension minimum promised by NBV2 CAD.
 * Units: metres, [x,y,z]. Exact developed centreline lengths accompany the
 * sampled paths used by 3D, drawings and the vendored BBS/BOQ adapter.
 */
export const REBAR_DRAWING_CAPTION = 'รูปเหล็กตามรายละเอียดการ์ด · ขอ ระยะฝัง และระยะทาบชุดเดียวกัน';
const VISIBILITY_EPS = 1e-10;
const visibilityDistance = (a, b) => Math.hypot(...a.map((value, i) => value - b[i]));
const visibilityAt = (a, b, t) => a.map((value, i) => value + t * (b[i] - value));

/** Explicit B28.3 drawing omissions only. A spacing advisory is not an omission. */
export function collectBeamJointOmissionBoxes({ geometry, designMembers = [] } = {}) {
  const members = Array.isArray(designMembers) ? designMembers : designMembers.members || [];
  const boxes = new Map();
  for (const member of members) for (const end of member.rebarDetailing?.beam?.ends || []) {
    const context = end.context, joint = context?.jointLayout;
    if (!joint?.note) continue;
    const node = geometry?.nodes?.[context.nodeId];
    const x = Number(context.centre?.xM ?? node?.x), y = Number(context.centre?.yM ?? node?.y);
    const z = Number(context.levelElevationM), width = Number(context.columnWidthM), depth = Number(context.columnDepthM);
    const beamDepth = Number(context.beamDepthMm) / 1000;
    if (![x, y, z, width, depth, beamDepth].every(Number.isFinite) || width <= 0 || depth <= 0 || beamDepth <= 0) continue;
    for (const [face, layout] of Object.entries(joint.faces || {})) {
      const indices = [...new Set(joint.unresolvedHookBarIndexes?.[face] || [])]
        .filter(index => Number.isInteger(index) && index >= 0);
      const allBars = layout.drawable === false;
      if (!allBars && !indices.length) continue;
      const memberId = end.memberId || member.memberId;
      const box = { jointId: joint.jointId, columnMark: joint.columnMark, memberId, face, allBars,
        barIndexes: indices.sort((a, b) => a - b), note: joint.note,
        lo: [x - width / 2, y - depth / 2, z - beamDepth],
        hi: [x + width / 2, y + depth / 2, z] };
      const key = JSON.stringify([box.jointId, memberId, face, box.lo, box.hi]);
      const previous = boxes.get(key);
      if (previous) {
        previous.allBars ||= allBars;
        previous.barIndexes = [...new Set([...previous.barIndexes, ...indices])].sort((a, b) => a - b);
      } else boxes.set(key, box);
    }
  }
  return [...boxes.values()];
}

function jointVisibilityMatches(path, box) {
  if (path.role !== 'main' || path.face !== box.face) return false;
  const metadata = path.metadata || {};
  const sourceIds = metadata.runSourceMemberIds || metadata.sourceMemberIds || [];
  if (!sourceIds.includes(box.memberId) && metadata.memberId !== box.memberId) return false;
  if (box.allBars) return true;
  const index = metadata.sourceBarIndicesByMemberId?.[box.memberId]
    ?? (metadata.memberId === box.memberId ? metadata.sourceBarIndex ?? metadata.barIndex : undefined);
  return box.barIndexes.includes(index);
}

function jointInsideInterval(a, b, box) {
  let from = 0, to = 1;
  for (let axis = 0; axis < 3; axis++) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < VISIBILITY_EPS) {
      if (a[axis] < box.lo[axis] || a[axis] > box.hi[axis]) return null;
      continue;
    }
    const first = (box.lo[axis] - a[axis]) / delta, last = (box.hi[axis] - a[axis]) / delta;
    from = Math.max(from, Math.min(first, last)); to = Math.min(to, Math.max(first, last));
    if (to - from <= VISIBILITY_EPS) return null;
  }
  return to - from > VISIBILITY_EPS ? [from, to] : null;
}

function jointVisibleFragments(points, boxes) {
  const fragments = [], omitted = new Set();
  let active = null;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (visibilityDistance(a, b) <= VISIBILITY_EPS) continue;
    let intervals = [[0, 1]];
    for (const box of boxes) {
      const inside = jointInsideInterval(a, b, box);
      if (!inside) continue;
      intervals = intervals.flatMap(([from, to]) => {
        const enter = Math.max(from, inside[0]), leave = Math.min(to, inside[1]);
        if (leave - enter <= VISIBILITY_EPS) return [[from, to]];
        omitted.add(box.jointId);
        return [...(enter - from > VISIBILITY_EPS ? [[from, enter]] : []), ...(to - leave > VISIBILITY_EPS ? [[leave, to]] : [])];
      });
    }
    for (const [from, to] of intervals) {
      const start = visibilityAt(a, b, from), finish = visibilityAt(a, b, to);
      if (active && visibilityDistance(active.at(-1), start) <= VISIBILITY_EPS) active.push(finish);
      else { active = [start, finish]; fragments.push(active); }
    }
    if (!intervals.length || intervals.at(-1)[1] < 1 - VISIBILITY_EPS) active = null;
  }
  return { fragments, omittedJointIds: [...omitted] };
}

/** Display-only projection. Full source paths stay available for every quantity
 * and source audit; visible fragments never replace their physical evidence. */
export function projectBeamJointVisiblePaths({ geometry, designMembers = [], paths = [] } = {}) {
  const omissionBoxes = collectBeamJointOmissionBoxes({ geometry, designMembers });
  const visible = [], omitted = new Set();
  for (const path of paths) {
    const boxes = omissionBoxes.filter(box => jointVisibilityMatches(path, box));
    if (!boxes.length || !Array.isArray(path.points) || path.points.length < 2) { visible.push(path); continue; }
    const result = jointVisibleFragments(path.points, boxes);
    if (!result.omittedJointIds.length) { visible.push(path); continue; }
    for (const jointId of result.omittedJointIds) omitted.add(jointId);
    const quantityPath = path.quantityPath || path.metadata?.quantityPath || path;
    for (const [fragmentIndex, points] of result.fragments.entries()) {
      const developedLengthM = points.slice(1).reduce((sum, point, i) => sum + visibilityDistance(point, points[i]), 0);
      visible.push({ ...path, points, developedLengthM, developedLengthMm: developedLengthM * 1000,
        quantityPath, omittedJointIds: result.omittedJointIds,
        metadata: { ...path.metadata, displayClip: true, visibilityFragmentIndex: fragmentIndex,
          sourceDevelopedLengthMm: path.developedLengthMm, visibleLengthMm: developedLengthM * 1000,
          quantityPath, omittedJointIds: result.omittedJointIds } });
    }
  }
  return { paths: visible, quantityPaths: paths, omissionBoxes, omittedJointIds: [...omitted] };
}
// Behaviour version for pages that load this file directly (the guided
// workbench): cached copies without the Phase B paths (< 5) are refused.
export const REBAR_PATH3D_API = 5;

export const PHASE_B_REBAR_PATH_SCHEMA = 'NBV2-REBAR-PATH-B2';

const EPS = 1e-10;
const declared = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const positive = value => declared(value) && Number(value) > 0;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const mul = (a, s) => a.map(v => v * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const length = a => Math.hypot(...a);
const norm = a => length(a) > EPS ? mul(a, 1 / length(a)) : null;
const point = a => Array.isArray(a) && a.length === 3 && a.every(declared);
const rotate = (v, axis, angle) => add(add(mul(v, Math.cos(angle)), mul(cross(axis, v), Math.sin(angle))), mul(axis, dot(axis, v) * (1 - Math.cos(angle))));

export function rebarBendRadiusM(diameterMm, role) {
  if (!positive(diameterMm) || !['tie', 'main'].includes(role)) return null;
  const d = Number(diameterMm);
  const inside = role === 'tie' && d <= 16 ? 4*d : d <= 25 ? 6*d : d <= 36 ? 8*d : 10*d;
  return (inside + d) / 2000;
}

export function rebarHookExtensionM(diameterMm, angleDeg, role) {
  if (!positive(diameterMm) || ![90, 135, 180].includes(angleDeg) || !['tie', 'main'].includes(role)) return null;
  const d = Number(diameterMm);
  return (role === 'tie' ? (angleDeg >= 135 || d <= 16 ? Math.max(6*d, 75) : 12*d)
    : angleDeg === 180 ? Math.max(4*d, 60) : 12*d) / 1000;
}

// Source hookGeometry/fullPath: virtual corners are subsequently filleted.
function hookVertices(end, adjacent, hook, radius) {
  const angle = hook?.angleDeg;
  const ext = hook?.extensionM;
  if (![90, 135, 180].includes(angle) || !positive(ext) || !positive(radius) || !point(hook?.toward)) return null;
  const outward = norm(sub(end, adjacent));
  if (!outward) return null;
  const toward = norm(sub(hook.toward, mul(outward, dot(hook.toward, outward))));
  if (!toward) return null; // No invented hook plane.
  if (angle === 180) {
    const across = add(end, mul(toward, 2*radius));
    return { points: [end, across, sub(across, mul(outward, radius + Number(ext)))], radii: [radius, radius, 0] };
  }
  const radians = angle * Math.PI / 180;
  const tangent = radius * Math.tan(radians / 2);
  const apex = add(end, mul(outward, tangent - radius));
  const exit = add(mul(outward, Math.cos(radians)), mul(toward, Math.sin(radians)));
  return { points: [apex, add(apex, mul(exit, tangent + Number(ext)))], radii: [radius, 0] };
}

/** Fillet EVERY non-collinear interior corner, without shrinking the radius.
 * hooks: {start/end: {angleDeg, extensionM, toward:[x,y,z]}}.
 * Invalid/too-small geometry returns [] so callers keep today's straight cage.
 */
export function sampleRebarPath(points, { radiusM = 0, hooks = {}, samplingAngleDeg = 15 } = {}) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(point)
    || !declared(radiusM) || Number(radiusM) < 0
    || !positive(samplingAngleDeg) || Number(samplingAngleDeg) > 90) return [];
  let vertices = points.map(p => p.map(Number));
  let radii = vertices.map((_, i) => i && i < vertices.length-1 ? Number(radiusM) : 0);
  for (const end of ['end', 'start']) {
    if (!hooks[end]) continue;
    const start = end === 'start', i = start ? 0 : vertices.length-1;
    const hook = hookVertices(vertices[i], vertices[start ? 1 : i-1], hooks[end], Number(radiusM));
    if (!hook) return [];
    if (start) {
      vertices = [...hook.points.reverse(), ...vertices.slice(1)];
      radii = [...hook.radii.reverse(), ...radii.slice(1)];
    } else {
      vertices = [...vertices.slice(0, -1), ...hook.points];
      radii = [...radii.slice(0, -1), ...hook.radii];
    }
  }
  const bends = vertices.map(() => null), trims = vertices.map(() => 0);
  for (let i = 1; i < vertices.length-1; i++) {
    const incoming = norm(sub(vertices[i], vertices[i-1]));
    const outgoing = norm(sub(vertices[i+1], vertices[i]));
    if (!incoming || !outgoing) return [];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(incoming, outgoing))));
    if (angle < 1e-6 || !radii[i]) continue;
    const axis = norm(cross(incoming, outgoing));
    if (!axis || Math.PI-angle < 1e-6) return [];
    const trim = radii[i] * Math.tan(angle/2);
    const enter = sub(vertices[i], mul(incoming, trim));
    const toward = norm(sub(outgoing, mul(incoming, dot(incoming, outgoing))));
    const center = add(enter, mul(toward, radii[i]));
    bends[i] = { angle, axis, center, radial: sub(enter, center) };
    trims[i] = trim;
  }
  for (let i = 0; i < vertices.length-1; i++) {
    if (length(sub(vertices[i+1], vertices[i])) + EPS < trims[i] + trims[i+1]) return [];
  }
  const result = [vertices[0]];
  for (let i = 1; i < vertices.length-1; i++) {
    const bend = bends[i];
    if (!bend) { result.push(vertices[i]); continue; }
    const steps = Math.max(2, Math.ceil(bend.angle / (Number(samplingAngleDeg)*Math.PI/180)));
    for (let j = 0; j <= steps; j++) result.push(add(bend.center, rotate(bend.radial, bend.axis, bend.angle*j/steps)));
  }
  result.push(vertices.at(-1));
  // Source viewer's dedupe, at metre precision appropriate to small bars.
  return result.filter((p, i) => !i || length(sub(p, result[i-1])) > EPS);
}

/** Exact centreline measure of the same vertices and circular bends.  This is
 * separate from chord sampling: quantity consumers keep the true arc length. */
export function developedRebarPathLengthM(points, { radiusM = 0, hooks = {} } = {}) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(point)) return null;
  let vertices = points.map(p => p.map(Number));
  let radii = vertices.map((_, i) => i && i < vertices.length - 1 ? Number(radiusM) : 0);
  for (const end of ['end', 'start']) {
    if (!hooks[end]) continue;
    const start = end === 'start', i = start ? 0 : vertices.length - 1;
    const hook = hookVertices(vertices[i], vertices[start ? 1 : i - 1], hooks[end], Number(radiusM));
    if (!hook) return null;
    if (start) { vertices = [...hook.points.reverse(), ...vertices.slice(1)]; radii = [...hook.radii.reverse(), ...radii.slice(1)]; }
    else { vertices = [...vertices.slice(0, -1), ...hook.points]; radii = [...radii.slice(0, -1), ...hook.radii]; }
  }
  let total = vertices.slice(1).reduce((sum, p, i) => sum + length(sub(p, vertices[i])), 0);
  for (let i = 1; i < vertices.length - 1; i++) {
    const a = norm(sub(vertices[i], vertices[i - 1])), b = norm(sub(vertices[i + 1], vertices[i]));
    if (!a || !b) return null;
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (angle > 1e-6 && radii[i]) total += radii[i] * (angle - 2 * Math.tan(angle / 2));
  }
  return total;
}

function phaseBPath(vertices, diameterMm, metadata, hooks = {}, radiusM = rebarBendRadiusM(diameterMm, 'main')) {
  const options = { radiusM, hooks, samplingAngleDeg: 3 };
  const points = sampleRebarPath(vertices, options);
  const developedLengthM = developedRebarPathLengthM(vertices, options);
  if (!points.length || !(developedLengthM > 0)) return null;
  const role = metadata.role || 'main';
  return { points, radiusM: diameterMm / 2000, diameterMm,
    face: metadata.face, role, kind: metadata.type, designation: metadata.designation,
    zoneId: metadata.zoneId, zoneBarIndex: metadata.zoneBarIndex,
    developedLengthM, developedLengthMm: developedLengthM * 1000,
    metadata: { ...metadata, schema: PHASE_B_REBAR_PATH_SCHEMA, developedLengthM,
      developedLengthMm: developedLengthM * 1000, diameterMm,
      detailing: { status: 'current', developedMm: developedLengthM * 1000,
        lapLengthMm: metadata.lapLengthMm || 0, stockLengthMm: 12000 },
      sourceVertices: vertices, sourceHooks: hooks, sourceRadiusM: radiusM,
      constructionAuthorized: false } };
}

function withPhysicalLaps(path, intervals, axis, physicalPieceIndex = 0, physicalPieceCount = 1) {
  const stationAt = value => {
    let station = 0;
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i], distance = length(sub(b, a));
      if (Math.abs(b[axis] - a[axis]) > EPS && value >= Math.min(a[axis], b[axis]) - EPS
        && value <= Math.max(a[axis], b[axis]) + EPS) {
        return station + Math.max(0, Math.min(1, (value - a[axis]) / (b[axis] - a[axis]))) * distance;
      }
      station += distance;
    }
    return null;
  };
  const physicalLapZones = intervals.flatMap(zone => {
    const fromM = stationAt(zone.from), toM = stationAt(zone.to);
    return fromM === null || toM === null || !(toM > fromM) ? []
      : [{ fromM, toM, lengthMm: (toM - fromM) * 1000, sourceLengthMm: zone.lengthMm,
        fromAxisM: zone.from, toAxisM: zone.to, codeRef: zone.codeRef }];
  });
  path.metadata.physicalPieceIndex = physicalPieceIndex;
  path.metadata.physicalPieceCount = physicalPieceCount;
  path.metadata.detailing.physicalLapZones = physicalLapZones;
  path.metadata.physicalLapZones = physicalLapZones;
  return path;
}

/** B28 source-owned transverse positions. The two circular bends and their
 * diagonal tangent lie wholly outside the column face; the tangent is 1:6.
 * Stations are measured from the member's start node, transverse left-positive.
 * This is a geometry projection only: callers supply the approved cage slot. */
export function beamJointJoggleProfile({ spanM, end, columnDepthMm, originalTransverseMm,
  targetTransverseMm, diameterMm } = {}) {
  if (!positive(spanM) || !['start', 'end'].includes(end) || !positive(columnDepthMm)
    || ![originalTransverseMm, targetTransverseMm].every(declared) || !positive(diameterMm)) return null;
  const originalM = Number(originalTransverseMm) / 1000, requestedTargetM = Number(targetTransverseMm) / 1000;
  let targetM = requestedTargetM;
  const faceM = Number(columnDepthMm) / 2000;
  const trimM = rebarBendRadiusM(diameterMm, 'main') * Math.tan(Math.atan(1 / 6) / 2);
  // The two tangent trims must fit between the virtual corners. An inward
  // shift smaller than this cannot be bent at the existing main-bar radius;
  // use the nearest inward slot that admits both bends (not a sharper radius).
  const minimumOffsetM = 2 * trimM / Math.hypot(6, 1) + 1e-6;
  const requestedOffsetM = Math.abs(targetM-originalM);
  if(requestedOffsetM>EPS && requestedOffsetM<minimumOffsetM && Math.abs(targetM)<Math.abs(originalM))
    targetM=originalM+Math.sign(targetM-originalM)*minimumOffsetM;
  const offsetM = Math.abs(targetM - originalM);
  const runM = 6 * offsetM;
  const points = end === 'start'
    ? [{ stationM: faceM + trimM, transverseM: targetM },
      { stationM: faceM + trimM + runM, transverseM: originalM }]
    : [{ stationM: Number(spanM) - faceM - trimM - runM, transverseM: originalM },
      { stationM: Number(spanM) - faceM - trimM, transverseM: targetM }];
  return { end, originalM, targetM, requestedTargetM, targetAdjustedForBend:targetM!==requestedTargetM,
    offsetM, runM, trimM, faceM, points,
    bendFromM: end === 'start' ? faceM : points[0].stationM - trimM,
    bendToM: end === 'start' ? points[1].stationM + trimM : Number(spanM) - faceM };
}

function jointProfilesForBar(detail, face, barIndex, originalM, spanM, diameterMm, physicalShiftM = 0, physicalTargetShiftM = 0) {
  return (detail.ends || []).flatMap(evidence => {
    const layout = evidence.context?.jointLayout?.faces?.[face];
    if (!layout || !Array.isArray(layout.positionsMm)) return [];
    const originals = layout.originalPositionsMm || [];
    const index = declared(originals[barIndex]) && Math.abs(Number(originals[barIndex]) / 1000 - originalM) < 1e-6 ? barIndex
      : originals.length ? originals.reduce((best, value, i) =>
        Math.abs(Number(value) / 1000 - originalM) < Math.abs(Number(originals[best]) / 1000 - originalM) ? i : best, 0) : barIndex;
    const target = layout.positionsMm[index];
    if (!declared(target)) return [];
    const profile = beamJointJoggleProfile({ spanM, end: evidence.end, columnDepthMm: evidence.context.columnDepthMm,
      originalTransverseMm: (originalM + physicalShiftM) * 1000,
      targetTransverseMm: target + 1000 * (typeof physicalTargetShiftM === 'function' ? physicalTargetShiftM(evidence) : physicalTargetShiftM), diameterMm });
    if (!profile) return [];
    const jointNodeStationM = evidence.end === 'start' ? 0 : spanM;
    const pairedTransition = (detail.transitions || []).some(row => row.face === face
      && row.kind !== 'BOTTOM_LEVEL_STEP' && row.nodeId === evidence.context?.nodeId);
    const base = { ...profile, evidence, layout, sourceBarIndex: index, sourceEnd: evidence.end,
      jointNodeStationM, pairedTransition };
    if (!pairedTransition) return [base];
    // Both overlapping bars follow the same inward/outward cage excursion on
    // both sides of the support, rather than diverging inside their splice.
    const mirror = { ...base, end: base.end === 'start' ? 'end' : 'start',
      points: base.points.map(point => ({ ...point, stationM: 2 * jointNodeStationM - point.stationM }))
        .sort((a, b) => a.stationM - b.stationM),
      bendFromM: 2 * jointNodeStationM - base.bendToM,
      bendToM: 2 * jointNodeStationM - base.bendFromM };
    for (const row of [base, mirror]) {
      row.minimumM = row.end === 'start' ? jointNodeStationM : -Infinity;
      row.maximumM = row.end === 'end' ? jointNodeStationM : Infinity;
    }
    return [base, mirror];
  });
}

function transverseAt(stationM, originalM, profiles) {
  for (const profile of profiles) {
    if (stationM < (profile.minimumM ?? -Infinity) - EPS || stationM > (profile.maximumM ?? Infinity) + EPS) continue;
    const [a, b] = profile.points;
    if (profile.end === 'start' && stationM <= b.stationM + EPS
      || profile.end === 'end' && stationM >= a.stationM - EPS) {
      if (stationM <= a.stationM) return a.transverseM;
      if (stationM >= b.stationM) return b.transverseM;
      if (b.stationM - a.stationM < EPS) return b.transverseM;
      return a.transverseM + (b.transverseM - a.transverseM) * (stationM - a.stationM) / (b.stationM - a.stationM);
    }
  }
  return originalM;
}

/** Beam coordinates are local Three axes: x along the member about midspan,
 * y vertical, z transverse. All hook shape and end placement come from B1. */
export function buildPhaseBBeamRebarPaths({ projection, detailing } = {}) {
  const detail = detailing?.beam || detailing;
  const hold = code => ({ current: false, code, paths: [] });
  if (!projection?.current || !projection.sectionLayout?.renderable || !detail
    || (detailing?.status && detailing.status !== 'current')) return hold('BEAM_PHASE_B_DETAIL_MISSING');
  const span = Number(projection.spanM), cover = Number(projection.coverM);
  if (!(span > 0) || !(cover >= 0)) return hold('BEAM_PHASE_B_GEOMETRY_MISSING');
  const paths = [];
  for (const face of ['bottom', 'top']) {
    const bars = projection.sectionLayout[`${face}Bars`] || [];
    for (const [barIndex, bar] of bars.entries()) {
      const diameterMm = bar.radiusM * 2000, hooks = {};
      const jointProfiles = jointProfilesForBar(detail, face, barIndex, bar.zM, span, diameterMm);
      let start = -span / 2, end = span / 2;
      for (const side of ['start', 'end']) {
        const evidence = (detail.ends || []).find(row => row.end === side);
        const context = evidence?.context || {};
        const hookFace = evidence?.faces?.find(row => row.face === face);
        const shape = hookFace?.hookGeometry || evidence?.[`${face}HookGeometry`];
        const sign = side === 'start' ? -1 : 1;
        if (shape) {
          const jointProfile = jointProfiles.find(row => row.end === side);
          const slotEndpoint = jointProfile?.layout?.hookEndpointMmByBar?.[jointProfile.sourceBarIndex];
          const offset = declared(slotEndpoint) ? Number(slotEndpoint) : positive(hookFace?.pathGeometry?.endpointMm) ? hookFace.pathGeometry.endpointMm : positive(context.columnDepthMm)
            ? Number(context.columnDepthMm) / 2 - Number(context.columnCoverMm)
              - Number(context.columnTieDiameterMm) - diameterMm / 2 : -cover * 1000;
          if (!Number.isFinite(offset)) return hold('BEAM_PHASE_B_END_PLACEMENT_MISSING');
          if (side === 'start') start = -span / 2 - offset / 1000;
          else end = span / 2 + offset / 1000;
          hooks[side] = { angleDeg: Number(shape.angleDeg || shape.hookDegrees || 90),
            extensionM: Number(shape.tailMm) / 1000,
            toward: [0, (jointProfile?.layout?.hookTailDirectionByBar?.[jointProfile.sourceBarIndex]
              || hookFace?.tailDirection || evidence.tailDirection) === 'up' ? 1 : -1, 0] };
        } else if (evidence?.role === 'GIRDER_ZERO_MOMENT' && face === 'bottom') {
          if (side === 'start') start -= Number(evidence.bottomInsertionMm) / 1000;
          else end += Number(evidence.bottomInsertionMm) / 1000;
        }
      }
      // A changed set extends beyond the far face exactly once (B13).
      for (const transition of detail.transitions || []) {
        if (transition.face !== face) continue;
        const joint = transition.jointGeometryEvidence;
        const endpoint = (detail.ends || []).find(row => row.nodeId === transition.nodeId)?.end;
        if (joint?.leftMemberId !== projection.memberId && joint?.rightMemberId !== projection.memberId) continue;
        if (transition.kind === 'BOTTOM_LEVEL_STEP') {
          const side = transition.sideDetails?.[projection.memberId];
          if (!side || !['a', 'b', 'c'].includes(transition.case)) return hold('BEAM_PHASE_B_STEP_EVIDENCE_MISSING');
          if (transition.case === 'a') continue; // The global path owns the in-joint crank.
          if (side.pass === false) return hold('BEAM_PHASE_B_STEP_HOOK_DEVELOPMENT_INSUFFICIENT');
          if (endpoint === 'start') start -= Number(side.extensionMm) / 1000;
          if (endpoint === 'end') end += Number(side.extensionMm) / 1000;
          if (side.hook) hooks[endpoint] = { angleDeg: Number(side.hookGeometry?.angleDeg || 90),
            extensionM: Number(side.hookGeometry?.tailMm) / 1000, toward: [0, 1, 0] };
          continue;
        }
        if (endpoint === 'start') start -= Number(transition.totalExtensionMm) / 1000;
        if (endpoint === 'end') end += Number(transition.totalExtensionMm) / 1000;
      }
      const radius = hooks.start || hooks.end
        ? Number((detail.ends || []).flatMap(row => row.faces || []).find(row => row.face === face)?.pathGeometry?.centreLineRadiusMm || rebarBendRadiusM(diameterMm, 'main') * 1000) / 1000
        : jointProfiles.some(row => row.offsetM > EPS) ? rebarBendRadiusM(diameterMm, 'main') : 0;
      const lapLengthMm = detail.stock?.find(row => row.face === face)?.lapLengthMm || 0;
      const lapZones = (detail.laps || []).filter(row => row.face === face)
        .sort((a, b) => a.localCentreM - b.localCentreM);
      const stepLaps = (detail.transitions || []).filter(row => row.face === face && row.kind === 'BOTTOM_LEVEL_STEP')
        .flatMap(row => row.sideDetails?.[projection.memberId]?.lapZone ? [row.sideDetails[projection.memberId].lapZone] : []);
      const fragments = [];
      let fragmentStart = start;
      for (const zone of lapZones) {
        if (![zone.fromM, zone.toM].every(declared)) return hold('BEAM_PHASE_B_LAP_PLACEMENT_MISSING');
        const lapFrom = Number(zone.fromM) - span / 2, lapTo = Number(zone.toM) - span / 2;
        if (!(lapTo > lapFrom) || Math.abs((lapTo - lapFrom) * 1000 - zone.lengthMm) > 1) return hold('BEAM_PHASE_B_LAP_LENGTH_INVALID');
        fragments.push({ from: fragmentStart, to: lapTo });
        fragmentStart = lapFrom;
      }
      fragments.push({ from: fragmentStart, to: Math.max(end, ...lapZones.map(zone => Number(zone.toM) - span / 2)) });
      for (const [pieceIndex, fragment] of fragments.entries()) {
        const fragmentHooks = { ...(pieceIndex === 0 && hooks.start ? { start: hooks.start } : {}),
          ...(pieceIndex === fragments.length - 1 && hooks.end ? { end: hooks.end } : {}) };
        // Contact-lapped bars remain physically distinct by one bar diameter.
        const contactLapShiftM = Number(detail.contactLapTranslationsMm?.[face]?.[barIndex] || 0) / 1000;
        const oddLapShiftM = pieceIndex % 2 ? (bar.zM > 0 ? -1 : 1) * diameterMm / 1000 : 0;
        const pieceProfiles = jointProfilesForBar(detail, face, barIndex, bar.zM, span, diameterMm, oddLapShiftM,
          evidence => lapZones.some(zone => {
            const stationM = evidence.end === 'start' ? 0 : span;
            return stationM >= zone.fromM - EPS && stationM <= zone.toM + EPS;
          }) ? oddLapShiftM : 0);
        const stations = [fragment.from + span / 2,
          ...pieceProfiles.filter(row => row.offsetM > EPS).flatMap(row => row.points.map(p => p.stationM))
            .filter(station => station > fragment.from + span / 2 + EPS && station < fragment.to + span / 2 - EPS),
          fragment.to + span / 2].sort((a, b) => a - b).filter((value, i, rows) => !i || value - rows[i - 1] > EPS);
        const vertices = stations.map(station => [station - span / 2, bar.yM,
          transverseAt(station, bar.zM + oddLapShiftM, pieceProfiles) + contactLapShiftM]);
        const path = phaseBPath(vertices, diameterMm,
          { memberId: projection.memberId, type: 'beam-main-rebar', role: 'main', face, barIndex, pieceIndex,
            designation: projection[face].designation, lapLengthMm: Math.max(lapLengthMm, ...stepLaps.map(zone => zone.lengthMm)),
            lapZones: [...lapZones, ...stepLaps],
            contactLapTranslationMm: contactLapShiftM * 1000,
            jointJoggles: pieceProfiles.filter(row => row.offsetM > EPS).map(row => ({ end: row.end,
              jointId: row.evidence.context.jointLayout.jointId, offsetMm: row.offsetM * 1000, runMm: row.runM * 1000,
              bendFromM: row.bendFromM, bendToM: row.bendToM })),
            lapSourceMemberId: projection.memberId, authority: 'PHASE_B_CARD_DETAILING' }, fragmentHooks,
          radius || (pieceProfiles.some(row => row.offsetM > EPS) ? rebarBendRadiusM(diameterMm, 'main') : 0));
        if (!path) return hold('BEAM_PHASE_B_HOOK_GEOMETRY_INVALID');
        paths.push(withPhysicalLaps(path, [...lapZones, ...stepLaps].map(zone => ({ from: Number(zone.fromM) - span / 2,
          to: Number(zone.toM) - span / 2, lengthMm: zone.lengthMm, codeRef: zone.codeRef })),
          0, pieceIndex, fragments.length));
      }
    }
  }
  const tieLayerOffsetMm = Object.fromEntries(['top', 'bottom'].map(face => [face,
    projection[face]?.layerOffsetMm ?? projection.layerOffsetMm?.[face]
      ?? (detail.ends || []).find(end => end.context?.layerOffsetMm)?.context.layerOffsetMm?.[face] ?? 0]));
  const stirrupStations = [...(projection.stirrupStations || [])];
  for (const context of (detail.ends || []).map(row => row.context)) for (const value of context?.jointLayout?.extraStirrupStationsM || []) {
    const xM = Number(value?.xM ?? value);
    if (!Number.isFinite(xM) || xM < 0 || xM > span) return hold('BEAM_PHASE_B_JOGGLE_TIE_STATION_INVALID');
    if (stirrupStations.some(row => Math.abs(row.xM - xM) < .001)) continue;
    const diameterMm = Number(value?.diameterMm ?? projection.stirrup?.diameterMm);
    if (!(diameterMm > 0)) return hold('BEAM_PHASE_B_JOGGLE_TIE_BAR_MISSING');
    stirrupStations.push({ xM, diameterMm, bar: value?.bar || `RB${diameterMm}`,
      reason: 'B28_JOGGLE_SUPPORT', jointId: context.jointLayout.jointId });
  }
  stirrupStations.sort((a, b) => a.xM - b.xM);
  for (const [stationIndex, station] of stirrupStations.entries()) {
    const diameterMm = Number(station.diameterMm), corner = stationIndex % 2;
    const local = closedTiePath({ widthM: projection.widthM, depthM: projection.depthM,
      coverM: stationTieCoverM(cover, projection.stirrup?.diameterMm, diameterMm),
      layerOffsetMm: tieLayerOffsetMm,
      diameterMm, hookAngleDeg: 135, corner, samplingAngleDeg: 3 });
    if (!local.length) return hold('BEAM_PHASE_B_TIE_GEOMETRY_INVALID');
    const points = local.map(p => [p[0] + station.xM - span / 2, p[1], p[2]]);
    const developedLengthM = points.slice(1).reduce((sum, p, i) => sum + length(sub(p, points[i])), 0);
    paths.push({ points, radiusM: diameterMm / 2000, diameterMm, role: 'tie', kind: 'beam-stirrup', designation: station.bar,
      developedLengthM, developedLengthMm: developedLengthM * 1000,
      metadata: { ...station, memberId: projection.memberId, type: 'beam-stirrup', role: 'tie', tieIndex: stationIndex,
        rounded: true,
        designation: station.bar, hookAngleDeg: 135, hookTailMm: rebarHookExtensionM(diameterMm, 135, 'tie') * 1000,
        ...(tieLayerOffsetMm.top || tieLayerOffsetMm.bottom ? { layerOffsetMm: tieLayerOffsetMm } : {}),
        hookCorner: corner, schema: PHASE_B_REBAR_PATH_SCHEMA, developedLengthM,
        detailing: { status: 'current', developedMm: developedLengthM * 1000, lapLengthMm: 0, stockLengthMm: 12000 } } });
  }
  for (const [extraIndex, extra] of (detail.extraTopBars || []).entries()) {
    if (!Array.isArray(extra.points) || !positive(extra.diameterMm) || !positive(extra.count)) return hold('BEAM_PHASE_B_CUTOFF_EVIDENCE_MISSING');
    for (let barIndex = 0; barIndex < extra.count; barIndex++) {
      const vertices = extra.barPaths?.[barIndex] || extra.points;
      const path = phaseBPath(vertices, extra.diameterMm, { memberId: projection.memberId,
        type: 'beam-extra-top', role: 'main', face: 'top', barIndex, extraIndex,
        designation: extra.designation, lapLengthMm: extra.lapLengthMm || 0,
        cutoffFromM: extra.fromM, cutoffToM: extra.toM, authority: 'PHASE_B_CARD_DETAILING' }, extra.hooks || {});
      if (!path) return hold('BEAM_PHASE_B_CUTOFF_PATH_INVALID');
      paths.push(path);
    }
  }
  return { current: true, code: 'BEAM_PHASE_B_PATHS_CURRENT', paths };
}

/** B1 stock rows describe continuous same-set chunks, not member-sized cuts.
 * Quantity paths are unique world-plan bars. Member paths are display clips
 * and retain the complete purchased piece for stock labels and highlighting. */
export function buildPhaseBBeamRunPaths({ geometry, projections = [], designMembers = [] } = {}) {
  const members = Array.isArray(designMembers) ? designMembers : designMembers.members || [];
  const byMember = new Map(members.filter(row => row.kind === 'beam').map(row => [row.memberId, row]));
  const byProjection = new Map((Array.isArray(projections) ? projections : projections.members || []).map(row => [row.memberId, row]));
  const lines = new Map((geometry?.lineMembers || []).map(row => [row.id, row]));
  const nodes = geometry?.nodes || {}, levels = new Map((geometry?.levels || []).map(row => [row.id, Number(row.elevM ?? row.elevationM ?? row.z)]));
  const holds = [], paths = [], records = new Map(), memberPathsByMemberId = {}, memberTiesByMemberId = {};
  const hold = (code, detail) => holds.push({ code, ...detail });
  for (const member of byMember.values()) for (const stock of member.rebarDetailing?.beam?.stock || []) {
    const key = JSON.stringify([stock.runId, stock.face, stock.barSet, stock.memberIds]);
    if (!records.has(key)) records.set(key, stock);
  }
  const toWorld = (local, projection, line) => {
    const a = nodes[line.fromNode], b = nodes[line.toNode], dx = b.x - a.x, dy = b.y - a.y;
    const span = Math.hypot(dx, dy), ux = dx / span, uy = dy / span;
    return [(a.x + b.x) / 2 + ux * local[0] - uy * local[2],
      (a.y + b.y) / 2 + uy * local[0] + ux * local[2], levels.get(line.level) - projection.depthM / 2 + local[1]];
  };
  for (const member of byMember.values()) {
    const projection = byProjection.get(member.memberId), line = lines.get(member.memberId);
    if (!projection || !line || member.rebarDetailing?.status !== 'current') {
      hold('BEAM_RUN_MEMBER_EVIDENCE_MISSING', { memberId: member.memberId }); continue;
    }
    const local = buildPhaseBBeamRebarPaths({ projection, detailing: member.rebarDetailing });
    if (!local.current) { hold(local.code, { memberId: member.memberId }); continue; }
    const ties = local.paths.filter(path => path.role === 'tie').map(path => ({ ...path,
      points: path.points.map(point => toWorld(point, projection, line)) }));
    memberTiesByMemberId[member.memberId] = ties;
    memberPathsByMemberId[member.memberId] = [...ties];
  }
  const runIds = [...new Set([...records.values()].map(row => row.runId))];
  const allLaps = [...byMember.values()].flatMap(row => row.rebarDetailing?.beam?.laps || []);
  for (const runId of runIds) {
    const runRecords = [...records.values()].filter(row => row.runId === runId);
    const ids = [...new Set(runRecords.flatMap(row => row.memberIds))];
    const links = new Map();
    for (const id of ids) {
      const line = lines.get(id);
      if (!line) { hold('BEAM_RUN_LINE_MISSING', { runId, memberId: id }); continue; }
      for (const node of [line.fromNode, line.toNode]) {
        if (!links.has(node)) links.set(node, []);
        links.get(node).push(id);
      }
    }
    const ends = [...links].filter(([, list]) => list.length === 1).map(([id]) => id).sort();
    if (ends.length !== 2 || [...links.values()].some(list => list.length > 2)) {
      hold('BEAM_RUN_TOPOLOGY_INVALID', { runId }); continue;
    }
    const originNode = nodes[ends[0]], targetNode = nodes[ends[1]];
    const runLength = Math.hypot(targetNode.x - originNode.x, targetNode.y - originNode.y);
    const unit = [(targetNode.x - originNode.x) / runLength, (targetNode.y - originNode.y) / runLength, 0];
    const transverse = [-unit[1], unit[0], 0], origin = [originNode.x, originNode.y, 0];
    let nodeId = ends[0], station = 0;
    const used = new Set(), spans = [];
    while (spans.length < ids.length) {
      const id = (links.get(nodeId) || []).find(value => !used.has(value));
      if (!id) break;
      const line = lines.get(id), far = line.fromNode === nodeId ? line.toNode : line.fromNode;
      const span = Math.hypot(nodes[far].x - nodes[nodeId].x, nodes[far].y - nodes[nodeId].y);
      const axial = (nodes[far].x - nodes[nodeId].x) * unit[0] + (nodes[far].y - nodes[nodeId].y) * unit[1];
      if (Math.abs(axial - span) > .001) hold('BEAM_RUN_NOT_STRAIGHT', { runId, memberId: id });
      spans.push({ id, line, fromNode: nodeId, toNode: far, fromM: station, toM: station + span });
      station += span; used.add(id); nodeId = far;
    }
    if (used.size !== ids.length) { hold('BEAM_RUN_CHAIN_INCOMPLETE', { runId }); continue; }
    for (const stock of runRecords) {
      const chunkSpans = stock.memberIds.map(id => spans.find(span => span.id === id));
      if (chunkSpans.some((span, i) => !span || (i && Math.abs(chunkSpans[i - 1].toM - span.fromM) > .001))) {
        hold('BEAM_RUN_STOCK_ORDER_INVALID', { runId, memberIds: stock.memberIds }); continue;
      }
      if (chunkSpans.some(span => !memberPathsByMemberId[span.id])) continue;
      const first = chunkSpans[0], last = chunkSpans.at(-1), face = stock.face;
      const setMatch = /^(\d+)-DB(\d+(?:\.\d+)?)$/.exec(stock.barSet || '');
      if (!setMatch) { hold('BEAM_RUN_BAR_SET_INVALID', { runId, barSet: stock.barSet }); continue; }
      const count = Number(setMatch[1]), diameterMm = Number(setMatch[2]);
      const chunkId = `${runId}:${face}:${stock.barSet}:${stock.memberIds.join(',')}`;
      const stepTransitions = [...new Map(chunkSpans.flatMap(span => byMember.get(span.id)?.rebarDetailing?.beam?.transitions || [])
        .filter(row => row.kind === 'BOTTOM_LEVEL_STEP' && row.face === face)
        .map(row => [row.nodeId, row])).values()];
      const sectionRows = chunkSpans.map(span => {
        const projection = byProjection.get(span.id), bars = projection?.sectionLayout?.[`${face}Bars`] || [];
        return bars.map((bar, barIndex) => {
          const world = toWorld([0, bar.yM, bar.zM], projection, span.line);
          return { barIndex, zM: world[2], transverseM: (world[0] - origin[0]) * transverse[0] + (world[1] - origin[1]) * transverse[1] };
        }).sort((a, b) => b.zM - a.zM || a.transverseM - b.transverseM);
      });
      const unprovedAxisChange = sectionRows.some((rows, rowIndex) => rowIndex && rows.some((bar, i) => {
        const previous = sectionRows[rowIndex - 1]?.[i];
        if (!previous || Math.abs(bar.transverseM - previous.transverseM) > .001) return true;
        if (Math.abs(bar.zM - previous.zM) <= .001) return false;
        return !stepTransitions.some(row => row.case === 'a' && row.continuity === true && row.crank
          && row.nodeId === chunkSpans[rowIndex].fromNode);
      }));
      if (sectionRows.some(rows => rows.length !== count) || unprovedAxisChange) {
        hold('BEAM_RUN_SECTION_AXIS_DISCONTINUITY', { runId, face, memberIds: stock.memberIds,
          barSet: stock.barSet,
          sectionAxes: chunkSpans.map((span, i) => ({ memberId: span.id, bars: sectionRows[i] })) }); continue;
      }
      const evidenceAt = (span, atStart) => {
        const side = span.line.fromNode === (atStart ? span.fromNode : span.toNode) ? 'start' : 'end';
        return byMember.get(span.id)?.rebarDetailing?.beam?.ends?.find(end => end.end === side);
      };
      let fromM = first.fromM, toM = last.toM;
      const hooks = {}, endSteps = {}, firstEnd = evidenceAt(first, true), lastEnd = evidenceAt(last, false);
      for (const [side, span, evidence, isOuter] of [['start', first, firstEnd, first.fromM < EPS],
        ['end', last, lastEnd, Math.abs(last.toM - station) < EPS]]) {
        const faceEvidence = evidence?.faces?.find(row => row.face === face);
        const shape = faceEvidence?.hookGeometry || evidence?.[`${face}HookGeometry`];
        if (isOuter && shape) {
          const ctx = evidence.context || {};
          const offset = faceEvidence?.pathGeometry?.endpointMm ?? (positive(ctx.columnDepthMm)
            ? ctx.columnDepthMm / 2 - ctx.columnCoverMm - ctx.columnTieDiameterMm - diameterMm / 2 : -byProjection.get(span.id).coverM * 1000);
          if (side === 'start') fromM -= offset / 1000; else toM += offset / 1000;
          hooks[side] = { angleDeg: faceEvidence?.pathGeometry?.hookDegrees || 90,
            extensionM: shape.tailMm / 1000, toward: [0, 0, (faceEvidence?.tailDirection || evidence.tailDirection) === 'up' ? 1 : -1] };
        } else if (isOuter && face === 'bottom' && evidence?.role === 'GIRDER_ZERO_MOMENT') {
          if (side === 'start') fromM -= evidence.bottomInsertionMm / 1000; else toM += evidence.bottomInsertionMm / 1000;
        } else if (!isOuter) {
          const transition = byMember.get(span.id)?.rebarDetailing?.beam?.transitions?.find(row =>
            row.face === face && row.nodeId === (side === 'start' ? span.fromNode : span.toNode));
          if (!transition) { hold('BEAM_RUN_TRANSITION_EVIDENCE_MISSING', { runId, face, memberId: span.id, side }); continue; }
          if (transition.kind === 'BOTTOM_LEVEL_STEP') {
            const piece = transition.sideDetails?.[span.id];
            if (!piece || piece.pass === false || transition.case === 'a') {
              hold('BEAM_RUN_STEP_END_EVIDENCE_INVALID', { runId, face, memberId: span.id, side }); continue;
            }
            if (side === 'start') fromM -= Number(piece.extensionMm) / 1000;
            else toM += Number(piece.extensionMm) / 1000;
            if (piece.hook) hooks[side] = { angleDeg: Number(piece.hookGeometry?.angleDeg || 90),
              extensionM: Number(piece.hookGeometry?.tailMm) / 1000,
              toward: [0, 0, piece.tailDirection === 'down' ? -1 : 1] };
            endSteps[side] = { ...transition, sideDetail: piece, pathEnd: side };
            continue;
          }
          if (side === 'start') fromM -= transition.totalExtensionMm / 1000; else toM += transition.totalExtensionMm / 1000;
        }
      }
      const zonesByKey = new Map();
      for (const zone of allLaps.filter(zone => zone.runId === runId && zone.face === face && zone.barSet === stock.barSet
        && stock.memberIds.includes(zone.memberId))) zonesByKey.set(`${zone.centreStationM}:${zone.lengthMm}`, zone);
      const zones = [...zonesByKey.values()].sort((a, b) => a.centreStationM - b.centreStationM);
      if (zones.length !== stock.lapCount) { hold('BEAM_RUN_LAP_COUNT_MISMATCH', { runId, face, expected: stock.lapCount, actual: zones.length }); continue; }
      const intervals = [], physicalLaps = zones.map(zone => ({ from: zone.centreStationM - zone.lengthMm / 2000,
        to: zone.centreStationM + zone.lengthMm / 2000, lengthMm: zone.lengthMm, codeRef: zone.codeRef }));
      let nextFrom = fromM;
      for (const zone of physicalLaps) { intervals.push({ from: nextFrom, to: zone.to }); nextFrom = zone.from; }
      intervals.push({ from: nextFrom, to: toM });
      for (let barIndex = 0; barIndex < count; barIndex++) for (const [pieceIndex, sourceInterval] of intervals.entries()) {
        const source = sectionRows[0][barIndex];
        const oddLapShiftM = pieceIndex % 2 ? (source.transverseM > 0 ? -1 : 1) * diameterMm / 1000 : 0;
        const jointProfiles = chunkSpans.flatMap((span, spanIndex) => {
          const projection = byProjection.get(span.id), detail = byMember.get(span.id)?.rebarDetailing?.beam;
          const originalBarIndex = sectionRows[spanIndex][barIndex].barIndex;
          const originalBar = projection.sectionLayout[`${face}Bars`][originalBarIndex];
          const direction = span.line.fromNode === span.fromNode ? 1 : -1;
          const memberStartM = direction === 1 ? span.fromM : span.toM;
          const constantM = sectionRows[spanIndex][barIndex].transverseM - direction * originalBar.zM;
          return jointProfilesForBar(detail, face, originalBarIndex, originalBar.zM,
            span.toM - span.fromM, diameterMm, direction * oddLapShiftM, evidence => {
              const nodeM = memberStartM + direction * (evidence.end === 'start' ? 0 : span.toM - span.fromM);
              return physicalLaps.some(zone => nodeM >= zone.from - EPS && nodeM <= zone.to + EPS)
                ? direction * oddLapShiftM : 0;
            }).map(profile => {
            const end = direction === 1 ? profile.end : profile.end === 'start' ? 'end' : 'start';
            const nodeM = memberStartM + direction * profile.jointNodeStationM;
            return { ...profile, end, sourceEnd: profile.sourceEnd, memberId: span.id, nodeM,
              originalM: constantM + direction * profile.originalM, targetM: constantM + direction * profile.targetM,
              minimumM: end === 'start' && (profile.pairedTransition || nodeM > first.fromM + EPS) ? nodeM : -Infinity,
              maximumM: end === 'end' && (profile.pairedTransition || nodeM < last.toM - EPS) ? nodeM : Infinity,
              points: profile.points.map(p => ({ stationM: memberStartM + direction * p.stationM,
                transverseM: constantM + direction * p.transverseM })).sort((a, b) => a.stationM - b.stationM),
              bendFromM: memberStartM + direction * profile.bendFromM,
              bendToM: memberStartM + direction * profile.bendToM };
          });
        });
        const firstSourceBarIndex = sectionRows[0][barIndex].barIndex;
        const contactLapShiftM = Number(byMember.get(first.id)?.rebarDetailing?.beam?.contactLapTranslationsMm?.[face]?.[firstSourceBarIndex] || 0)
          / 1000 * (first.line.fromNode === first.fromNode ? 1 : -1);
        const lapShiftM = oddLapShiftM + contactLapShiftM;
        const interval = { ...sourceInterval }, pieceHooks = { ...(pieceIndex === 0 && hooks.start ? { start: { ...hooks.start } } : {}),
          ...(pieceIndex === intervals.length - 1 && hooks.end ? { end: { ...hooks.end } } : {}) };
        for (const side of ['start', 'end']) {
          if (!pieceHooks[side]) continue;
          const profile = jointProfiles.find(row => row.end === side && Math.abs(row.nodeM - (side === 'start' ? first.fromM : last.toM)) < EPS);
          const slot = profile?.layout?.hookEndpointMmByBar?.[profile.sourceBarIndex];
          if (declared(slot)) interval[side === 'start' ? 'from' : 'to'] = profile.nodeM + (side === 'start' ? -1 : 1) * Number(slot) / 1000;
          const tail = profile?.layout?.hookTailDirectionByBar?.[profile.sourceBarIndex];
          if (tail) pieceHooks[side].toward = [0, 0, tail === 'up' ? 1 : -1];
        }
        const worldAt = (stationM, elevationM = source.zM) => {
          const offset = transverseAt(stationM, source.transverseM + oddLapShiftM, jointProfiles) + contactLapShiftM;
          return add(add(origin, mul(unit, stationM)), [transverse[0] * offset, transverse[1] * offset, elevationM]);
        };
        const crankVertices = [];
        let elevationM = source.zM;
        for (let i = 1; i < chunkSpans.length; i++) {
          const transition = stepTransitions.find(row => row.case === 'a' && row.nodeId === chunkSpans[i].fromNode);
          if (!transition) continue;
          const crank = transition.crank, left = sectionRows[i - 1][barIndex].zM, right = sectionRows[i][barIndex].zM;
          // These are virtual bend corners. The shared sampler trims both
          // adjoining directions; the diagonal tangent retains source 1:6.
          const begin = Number(crank.fromStationM);
          const finish = Number(crank.toStationM);
          if (interval.from >= finish) elevationM = right;
          if (begin >= interval.from && finish <= interval.to) crankVertices.push(worldAt(begin, left), worldAt(finish, right));
        }
        const endElevationM = crankVertices.length ? crankVertices.at(-1)[2] : elevationM;
        const sourceMemberIds = chunkSpans.filter(span => interval.to >= span.fromM - EPS && interval.from <= span.toM + EPS).map(span => span.id);
        const ownerMemberId = sourceMemberIds[0] || first.id;
        const runBarId = `${chunkId}:BAR:${barIndex}`, physicalPieceId = `${runBarId}:PIECE:${pieceIndex}`;
        const baseVertices = [worldAt(interval.from, elevationM), ...crankVertices, worldAt(interval.to, endElevationM)];
        const baseStationAt = point => (point[0] - origin[0]) * unit[0] + (point[1] - origin[1]) * unit[1];
        const elevationAt = stationM => {
          for (let i = 1; i < baseVertices.length; i++) {
            const a = baseVertices[i - 1], b = baseVertices[i], sa = baseStationAt(a), sb = baseStationAt(b);
            if (stationM >= sa - EPS && stationM <= sb + EPS) return a[2] + (b[2] - a[2]) * (stationM - sa) / (sb - sa);
          }
          return stationM < interval.from ? elevationM : endElevationM;
        };
        const vertexStations = [...baseVertices.map(baseStationAt), ...jointProfiles.filter(row => row.offsetM > EPS)
          .flatMap(row => row.points.map(p => p.stationM)).filter(value => value > interval.from + EPS && value < interval.to - EPS)]
          .sort((a, b) => a - b).filter((value, i, values) => !i || value - values[i - 1] > EPS);
        const vertices = vertexStations.map(value => worldAt(value, elevationAt(value)));
        const path = phaseBPath(vertices, diameterMm, {
          memberId: ownerMemberId, ownerMemberId, sourceMemberIds, runSourceMemberIds: stock.memberIds,
          sourceBarIndicesByMemberId: Object.fromEntries(chunkSpans.map((span, i) => [span.id, sectionRows[i][barIndex].barIndex])),
          runId, runBarId, physicalPieceId, face, barIndex, pieceIndex, type: 'beam-main-rebar', role: 'main',
          designation: stock.barSet, lapLengthMm: stock.lapLengthMm, stockLengthMm: stock.stockLengthMm,
          fromStationM: interval.from, toStationM: interval.to, bottomLevelSteps: Object.values(endSteps),
          contactLapTranslationMm: contactLapShiftM * 1000,
          jointJoggles: jointProfiles.filter(row => row.offsetM > EPS).map(row => ({ end: row.sourceEnd, memberId: row.memberId,
            jointId: row.evidence.context.jointLayout.jointId, offsetMm: row.offsetM * 1000, runMm: row.runM * 1000,
            bendFromM: row.bendFromM, bendToM: row.bendToM,
            bendFromPoint: worldAt(row.bendFromM, elevationAt(row.bendFromM)),
            bendToPoint: worldAt(row.bendToM, elevationAt(row.bendToM)) })),
          authority: 'PHASE_B_CARD_DETAILING_RUN' }, pieceHooks);
        if (!path) { hold('BEAM_RUN_PHYSICAL_PATH_INVALID', { runId, physicalPieceId }); continue; }
        if (path.developedLengthMm > stock.stockLengthMm + 1) hold('BEAM_RUN_SOURCE_PIECE_EXCEEDS_STOCK', {
          runId, physicalPieceId, memberIds: sourceMemberIds, developedMm: path.developedLengthMm, stockMm: stock.stockLengthMm });
        const axis = Math.abs(unit[0]) > .9 ? 0 : 1;
        const stepLapZones = Object.values(endSteps).flatMap(step => step.sideDetail.lapZone ? [{
          from: step.sideDetail.lapZone.fromStationM, to: step.sideDetail.lapZone.toStationM,
          lengthMm: step.sideDetail.lapZone.lengthMm, codeRef: step.codeRef }] : []);
        withPhysicalLaps(path, [...physicalLaps, ...stepLapZones].map(zone => ({ ...zone,
          from: origin[axis] + unit[axis] * zone.from, to: origin[axis] + unit[axis] * zone.to })), axis, pieceIndex, intervals.length);
        const unhookedMm = developedRebarPathLengthM(vertices, { radiusM: rebarBendRadiusM(diameterMm, 'main') }) * 1000;
        const withoutJoggle = baseVertices.map(point => {
          const stationM = baseStationAt(point), offset = source.transverseM + lapShiftM;
          return add(add(origin, mul(unit, stationM)), [transverse[0] * offset, transverse[1] * offset, point[2]]);
        });
        const withoutJoggleMm = developedRebarPathLengthM(withoutJoggle, { radiusM: rebarBendRadiusM(diameterMm, 'main') }) * 1000;
        path.metadata.detailingComponentsMm = { hook: path.developedLengthMm - unhookedMm,
          crank: withoutJoggleMm - Math.abs(interval.to - interval.from) * 1000,
          joggle: unhookedMm - withoutJoggleMm,
          lap: physicalLaps.reduce((sum, zone) => sum + Math.max(0, Math.min(interval.to, zone.to) - Math.max(interval.from, zone.from)) * 1000, 0)
            + stepLapZones.reduce((sum, zone) => sum + Math.max(0, Math.min(interval.to, zone.to) - Math.max(interval.from, zone.from)) * 1000, 0) };
        path.ownerMemberId = ownerMemberId; path.sourceMemberIds = sourceMemberIds;
        path.runBarId = runBarId; path.physicalPieceId = physicalPieceId;
        path.metadata.detailing.stockLengthMm = stock.stockLengthMm;
        path.metadata.globalDevelopedLengthMm = path.developedLengthMm;
        path.metadata.sourceStockDevelopedMm = stock.developedMm;
        path.metadata.sourceStockPieceCount = stock.pieceCount;
        paths.push(path);
        const stationOf = point => (point[0] - origin[0]) * unit[0] + (point[1] - origin[1]) * unit[1];
        for (const span of chunkSpans) {
          const minimum = span.id === first.id ? Math.min(span.fromM, fromM) : span.fromM;
          const maximum = span.id === last.id ? Math.max(span.toM, toM) : span.toM;
          if (interval.to < minimum - EPS || interval.from > maximum + EPS) continue;
          const clipped = [];
          for (let i = 1; i < path.points.length; i++) {
            const a = path.points[i - 1], b = path.points[i], sa = stationOf(a), sb = stationOf(b), ds = sb - sa;
            if (Math.abs(ds) < EPS) { if (sa >= minimum - EPS && sa <= maximum + EPS) clipped.push(a, b); continue; }
            const enter = Math.max(0, (minimum - sa) / ds), leave = Math.min(1, (maximum - sa) / ds);
            if (leave >= enter - EPS && leave >= 0 && enter <= 1) clipped.push(add(a, mul(sub(b, a), enter)), add(a, mul(sub(b, a), leave)));
          }
          const points = clipped.filter((point, i) => !i || length(sub(point, clipped[i - 1])) > EPS);
          if (points.length < 2) continue;
          const developedLengthM = points.slice(1).reduce((sum, point, i) => sum + length(sub(point, points[i])), 0);
          const quantityPath = { ...path, metadata: { ...path.metadata } };
          memberPathsByMemberId[span.id].push({ ...path, points, developedLengthM,
            developedLengthMm: developedLengthM * 1000, quantityPath,
            metadata: { ...path.metadata, memberId: span.id, sourceBarIndex: sectionRows[chunkSpans.indexOf(span)][barIndex].barIndex,
              quantityPath, displayClip: true, globalDevelopedLengthMm: path.developedLengthMm } });
        }
      }
    }
  }
  const stockRecords = [...records.values()];
  const memberHoldsByMemberId = {};
  for (const entry of holds) for (const id of entry.memberIds || (entry.memberId ? [entry.memberId] : [])) {
    if (!memberHoldsByMemberId[id]) memberHoldsByMemberId[id] = [];
    memberHoldsByMemberId[id].push(entry);
  }
  const visible=projectBeamJointVisiblePaths({geometry,designMembers:members,paths});
  const visibleMemberPaths=Object.fromEntries(Object.entries(memberPathsByMemberId).map(([id,rows])=>[id,
    projectBeamJointVisiblePaths({geometry,designMembers:members,paths:rows}).paths]));
  return { current: holds.length === 0, holds, paths:visible.paths, quantityPaths:paths,
    omittedJointIds:visible.omittedJointIds, jointOmissionBoxes:visible.omissionBoxes,
    memberPathsByMemberId:visibleMemberPaths, memberTiesByMemberId, memberHoldsByMemberId,
    stockRecords, sourcePurchasedBarCount: stockRecords.reduce((sum, row) => sum + Number(row.barSet.split('-')[0]) * row.pieceCount, 0) };
}

/** Drawable engine-added zones. The zone owns concrete dimensions, plane,
 * stations, diameter and hook tails; this port only samples that evidence. */
export function buildPhaseBZoneRebarPaths(zones, ownerMemberId) {
  const paths = [], selected = new Map();
  for (const zone of zones || []) {
    const id = zone.id || zone.zoneId, previous = selected.get(id);
    const count = (zone.stationsZM || zone.stationsM || []).length;
    const previousCount = (previous?.stationsZM || previous?.stationsM || []).length;
    if (!previous || count > previousCount) selected.set(id, zone);
  }
  for (const zone of selected.values()) {
    const diameterMm = Number(zone.diameterMm), centre = zone.centre || zone.center || {};
    const stations = zone.stationsZM || zone.stationsM || [];
    for (const [zoneBarIndex, station] of stations.entries()) {
      const tie = closedTiePath({ widthM: Number(zone.widthM), depthM: Number(zone.depthM),
        coverM: Number(zone.coverMm) / 1000, diameterMm, hookAngleDeg: 135,
        corner: zoneBarIndex % 4, samplingAngleDeg: 3 });
      if (!tie.length) return { current: false, code: 'PHASE_B_ZONE_GEOMETRY_INVALID', paths: [], zoneId: zone.id || zone.zoneId };
      const cx = Number(centre.xM), cy = Number(centre.yM), cz = Number(zone.centreZM ?? centre.zM);
      const points = tie.map(([ramp, depth, width]) => zone.plane === 'x'
        ? [station + ramp, cy + width, cz + depth]
        : zone.plane === 'y' ? [cx + width, station + ramp, cz + depth]
          : [cx + width, cy + depth, station + ramp]);
      if (!points.every(point)) return { current: false, code: 'PHASE_B_ZONE_STATIONS_INVALID', paths: [] };
      const developedLengthM = points.slice(1).reduce((sum, p, i) => sum + length(sub(p, points[i])), 0);
      const zoneId = zone.id || zone.zoneId;
      const metadata = { memberId: ownerMemberId, zoneOwnerMemberId: zone.ownerMemberId || ownerMemberId,
        type: 'column-tie', role: 'tie', designation: zone.bar || `RB${diameterMm}`, diameterMm,
        zoneId, zoneBarIndex, stationM: station, reason: zone.reason, codeRef: zone.codeRef,
        zoneKind: zone.kind, zoneCount: zone.count || stations.length, zoneSpacingMm: zone.spacingMm,
        zoneFromZM: zone.fromZM, zoneToZM: zone.toZM,
        hookAngleDeg: 135, hookTailMm: zone.hookTailMm,
        schema: PHASE_B_REBAR_PATH_SCHEMA, developedLengthM,
        detailing: { status: 'current', developedMm: developedLengthM * 1000, lapLengthMm: 0, stockLengthMm: 12000 } };
      paths.push({ points, radiusM: diameterMm / 2000, diameterMm, role: 'tie', kind: 'column-tie',
        designation: metadata.designation, zoneId, zoneBarIndex, developedLengthM,
        developedLengthMm: developedLengthM * 1000, metadata });
    }
  }
  return { current: true, paths };
}

/** Column output is world plan [X,Y,Z] in metres, as used by DAE and BOQ. */
export function buildPhaseBColumnRebarPaths({ column, member } = {}) {
  const detailing = member?.rebarDetailing, detail = detailing?.column;
  const card = member?.cardSnapshot || member?.reportData;
  const rebar = card?.reinforcement, cover = Number(card?.input?.coverM);
  const hold = code => ({ current: false, code, paths: [] });
  if (detailing?.status !== 'current' || !detail || !Array.isArray(rebar?.positions)) return hold('COLUMN_PHASE_B_DETAIL_MISSING');
  const diameterMm = Number(rebar.barDiaMm), tieDiameterMm = Number(rebar.tieDiaMm), spacing = Number(rebar.tieSpacingCm) / 100;
  // B19 is a construction interface, not a concrete end face: the main
  // column bars start at the footing top so the entire source ls overlaps.
  const foundationLap = detail.foundationDowelLap;
  const foundationLapFromZM = foundationLap?.status === 'current' && foundationLap.lapStartsAt === 'FOOTING_TOP'
    ? Number(column.from.z) : null;
  const startZ = detail.baseLap?.fromZM ?? foundationLapFromZM ?? Number(column.from.z) + cover + diameterMm / 2000;
  const endZ = Number(column.to.z) - cover - diameterMm / 2000;
  if (!(endZ > startZ) || !(spacing > 0)) return hold('COLUMN_PHASE_B_GEOMETRY_INVALID');
  const paths = [];
  for (const [barIndex, position] of rebar.positions.entries()) {
    const x = column.from.x - column.widthM / 2 + position.xMm / 1000;
    const y = column.from.y + column.depthM / 2 - position.yMm / 1000;
    let vertices = [[x, y, startZ], [x, y, endZ]], hooks = {};
    const lap = detail.laps?.[0], crank = detail.crank;
    if (lap && crank) {
      const offset = crank.barOffsets?.[barIndex];
      const tx = offset ? column.from.x + offset.toXMm / 1000
        : x - Math.sign(x - column.from.x || 1) * diameterMm / 1000;
      const ty = offset ? column.from.y - offset.toYMm / 1000 : y;
      const tangentTrimM = Number(crank.bendTangentTrimMm || 0) / 1000;
      vertices = [[x, y, startZ], [x, y, crank.fromZM + tangentTrimM],
        [tx, ty, crank.toZM - tangentTrimM], [tx, ty, lap.toZM]];
    } else if (lap && !detail.dowels) {
      vertices[1][2] = lap.toZM;
    } else if (detail.topEnd?.hook) {
      const top = detail.topEnd;
      vertices[1][2] = Number(top.topElevM) - Number(top.coverMm) / 1000 - Number(top.beamTieMm) / 1000 - diameterMm / 2000;
      hooks.end = { angleDeg: Number(top.hookGeometry?.angleDeg || 90),
        extensionM: Number(top.hookGeometry?.tailMm) / 1000,
        toward: [Math.sign(column.from.x - x || 1), 0, 0] };
    } else if (positive(detail.topEnd?.endZM)) vertices[1][2] = detail.topEnd.endZM;
    const path = phaseBPath(vertices, diameterMm, { memberId: column.id || member.memberId,
      type: 'column-longitudinal', role: 'main', barIndex, designation: `DB${diameterMm}`,
      lapLengthMm: Math.max(lap?.lengthMm || 0, foundationLap?.lsMm || 0), lapZones: detail.laps || [], crank,
      authority: 'PHASE_B_CARD_DETAILING' }, hooks,
      positive(crank?.bendRadiusMm) ? crank.bendRadiusMm / 1000 : rebarBendRadiusM(diameterMm, 'main'));
    if (!path) return hold('COLUMN_PHASE_B_MAIN_PATH_INVALID');
    const foundationLapZone = foundationLapFromZM === null ? [] : [{ fromZM: foundationLapFromZM,
      toZM: foundationLapFromZM + foundationLap.lsMm / 1000, lengthMm: foundationLap.lsMm, codeRef: foundationLap.codeRef }];
    paths.push(withPhysicalLaps(path, [...foundationLapZone, ...(detail.baseLap ? [detail.baseLap] : []), ...(detail.laps || [])]
      .map(zone => ({ from: zone.fromZM, to: zone.toZM, lengthMm: zone.lengthMm, codeRef: zone.codeRef })), 2));
  }
  if (detail.dowels) {
    const dowels = detail.dowels;
    for (let barIndex = 0; barIndex < dowels.count; barIndex++) {
      const offset = dowels.barOffsets?.[barIndex];
      if (!offset) return hold('COLUMN_PHASE_B_DOWEL_POSITION_MISSING');
      const x = column.from.x + offset.toXMm / 1000, y = column.from.y - offset.toYMm / 1000;
      const path = phaseBPath([[x, y, dowels.fromZM], [x, y, dowels.toZM]], dowels.diameterMm,
        { memberId: column.id || member.memberId, type: 'column-dowel', role: 'main', barIndex,
          designation: `DB${dowels.diameterMm}`, lapLengthMm: dowels.lapLengthMm,
          lapZones: [{ fromZM: dowels.lapFromZM, toZM: dowels.lapToZM, lengthMm: dowels.lapLengthMm }],
          anchorageLengthMm: dowels.anchorageLengthMm, authority: 'PHASE_B_CARD_DETAILING' }, {}, 0);
      if (!path) return hold('COLUMN_PHASE_B_DOWEL_GEOMETRY_INVALID');
      paths.push(withPhysicalLaps(path, [{ from: dowels.lapFromZM, to: dowels.lapToZM,
        lengthMm: dowels.lapLengthMm, codeRef: dowels.codeRef }], 2));
    }
  }
  const first = column.from.z + cover + tieDiameterMm / 2000;
  const last = column.to.z - cover - tieDiameterMm / 2000;
  const count = Math.floor((last - first + EPS) / spacing) + 1;
  const zone = { id: `${column.id}:CARD-TIES`, ownerMemberId: column.id, plane: 'horizontal',
    centre: { xM: column.from.x, yM: column.from.y }, widthM: column.widthM, depthM: column.depthM,
    coverMm: cover * 1000, diameterMm: tieDiameterMm, bar: `RB${tieDiameterMm}`,
    hookTailMm: rebarHookExtensionM(tieDiameterMm, 135, 'tie') * 1000,
    stationsZM: Array.from({ length: count }, (_, i) => first + i * spacing)
      .filter(station => !(detail.jointTies || []).some(joint => joint.reason !== 'COLUMN_CRANK_SUPPORT'
        && station >= joint.fromZM - EPS && station <= joint.toZM + EPS)) };
  const zones = [zone, ...(detail.jointTies || []).flatMap(row => row.drawableZones || [])];
  const zonePaths = buildPhaseBZoneRebarPaths(zones, column.id || member.memberId);
  if (!zonePaths.current) return hold(zonePaths.code);
  paths.push(...zonePaths.paths);
  // Zone-local station indexes repeat. Picking/export identity is member-wide
  // so every stored hoop resolves to its own source path after zone batching.
  zonePaths.paths.forEach((path, tieIndex) => {
    path.metadata.tieIndex = tieIndex;
    path.metadata.hookCorner = path.zoneBarIndex % 4;
  });
  return { current: true, code: 'COLUMN_PHASE_B_PATHS_CURRENT', paths };
}

/** Total concrete section dimensions; clear cover is to the outside of the bar.
 * Tie lies in local y/z, with longitudinal x ramp of 1.05*d. Its station is
 * the ramp midpoint, never an additional station. corner cycles 0..3.
 */
export function closedTiePath({ widthM, depthM, coverM, diameterMm, layerOffsetMm,
  hookAngleDeg = 135, corner = 0, samplingAngleDeg = 15 } = {}) {
  if (!positive(widthM) || !positive(depthM) || !declared(coverM) || Number(coverM) < 0
    || !positive(diameterMm) || hookAngleDeg !== 135 || !Number.isInteger(corner)) return [];
  const d = Number(diameterMm)/1000, r = rebarBendRadiusM(diameterMm, 'tie');
  const w = Number(widthM)/2 - Number(coverM) - d/2;
  const h = Number(depthM)/2 - Number(coverM) - d/2;
  const topOffset = Number(layerOffsetMm?.top ?? 0) / 1000;
  const bottomOffset = Number(layerOffsetMm?.bottom ?? 0) / 1000;
  const top = h - topOffset, bottom = -h + bottomOffset;
  if (!(w > r && h > r && topOffset >= 0 && bottomOffset >= 0 && top - bottom > 2*r)) return [];
  // ACI 318-19 §25.7.1.3: the closed stirrup follows the shifted inner bars,
  // retaining its 135° hook, bend radius and tail instead of leaving a loose cage.
  const corners = [[0,top,-w], [0,top,w], [0,bottom,w], [0,bottom,-w]];
  const k = ((corner%4)+4)%4;
  const body = Array.from({length:5}, (_, i) => corners[(k+i)%4]);
  const hook = { angleDeg:135, extensionM:rebarHookExtensionM(diameterMm, 135, 'tie'), toward:mul(body[0], -1) };
  const sampled = sampleRebarPath(body, { radiusM:r, hooks:{ start:hook, end:hook }, samplingAngleDeg });
  // Never clip a hook or reduce its standard radius to fit a small core.
  if (!sampled.length || sampled.some(p => p[1] > top+EPS || p[1] < bottom-EPS || Math.abs(p[2]) > w+EPS)) return [];
  // Ramp by real arc length, so the two overlapping hook ends really sit
  // 1.05·d apart along the beam (index-based ramp left them ~0.7·d apart).
  const along = [0];
  for (let i = 1; i < sampled.length; i++) along.push(along[i-1] + length(sub(sampled[i], sampled[i-1])));
  const total = along.at(-1);
  if (!(total > 0)) return [];
  return sampled.map((p, i) => [1.05*d*(along[i]/total-0.5), p[1], p[2]]);
}

/** The two corner bars of one face: outermost layer (largest |y|), extreme |z|.
 * bars: [{yM, zM}] in section coordinates; returns their indexes. */
export function cornerBarIndexes(bars) {
  const rows = (Array.isArray(bars) ? bars : []).map((bar, index) => ({ index, y: Number(bar?.yM), z: Number(bar?.zM) }))
    .filter(row => Number.isFinite(row.y) && Number.isFinite(row.z));
  if (!rows.length) return [];
  const outer = Math.max(...rows.map(row => Math.abs(row.y)));
  const layer = rows.filter(row => Math.abs(Math.abs(row.y) - outer) < 1e-6);
  const edge = Math.max(...layer.map(row => Math.abs(row.z)));
  return layer.filter(row => edge > 1e-6 && Math.abs(Math.abs(row.z) - edge) < 1e-6).map(row => row.index);
}

/** True when any part of a drawn tie path (hook legs included) cuts into a
 * main bar. Bars run along x, so the test is 2D in the section (y, z): the
 * distance from each bar axis to every path segment must be at least the
 * two radii (0.5 mm drawing tolerance for the tube's chord sag).
 * bars: [{yM, zM, radiusM}] as drawn. */
export function tieClashesBars(path, diameterMm, bars, toleranceM = 0.0005) {
  if (!Array.isArray(path) || path.length < 2 || !Array.isArray(bars) || !bars.length) return false;
  const r = Number(diameterMm) / 2000;
  for (const bar of bars) {
    const y = Number(bar?.yM), z = Number(bar?.zM), rb = Number(bar?.radiusM);
    if (![y, z, rb].every(Number.isFinite)) continue;
    const need = r + rb - toleranceM;
    for (let i = 1; i < path.length; i++) {
      const [ay, az] = [path[i-1][1], path[i-1][2]], [by, bz] = [path[i][1], path[i][2]];
      const dy = by - ay, dz = bz - az, len2 = dy*dy + dz*dz;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((y-ay)*dy + (z-az)*dz) / len2)) : 0;
      if (Math.hypot(ay + t*dy - y, az + t*dz - z) < need) return true;
    }
  }
  return false;
}

/** Corner main bars sit in the tie's bend (touching its inner face) instead of
 * the square corner the straight tie implied. Returns the inward shift (m) of
 * a corner bar along each section axis; 0 when no rounded tie can be built for
 * this section or the bar is larger than the bend (callers also skip it when
 * no tie is drawn). Drawing only — the Card bar layout is unchanged.
 */
export function nestedCornerBarShiftM({ widthM, depthM, coverM, tieDiameterMm, barDiameterMm, tieDiametersMm } = {}) {
  if (!positive(barDiameterMm) || !positive(tieDiameterMm)) return 0;
  const db = Number(barDiameterMm)/1000;
  // Every drawn tie shares the Card tie's inner face (see stationTieCoverM), so
  // the largest bend governs: the bar clears every tie drawn around it.
  let shift = 0;
  // Given a list, only those (the ties actually drawn rounded) count; an
  // empty list means no rounded tie, so no nesting. Without one, the Card tie.
  const dias = Array.isArray(tieDiametersMm) ? tieDiametersMm.map(Number).filter(positive) : [Number(tieDiameterMm)];
  for (const dia of new Set(dias)) {
    const cover = stationTieCoverM(coverM, tieDiameterMm, dia);
    if (!closedTiePath({ widthM, depthM, coverM: cover, diameterMm: dia }).length) continue;
    const inner = rebarBendRadiusM(dia, 'tie') - dia/2000;
    if (inner > db/2) shift = Math.max(shift, (inner - db/2) * (1 - Math.SQRT1_2));
  }
  return shift;
}

/** A station tie thicker than the Card tie (e.g. a hanger stepped up to DB12)
 * is drawn around the same bar cage: same inner face as the Card tie, so its
 * drawn outer face sits the extra diameter closer to the concrete face.
 * Drawing only — the stored cover and bar layout are unchanged. */
export function stationTieCoverM(coverM, cardTieDiameterMm, stationTieDiameterMm) {
  const extra = (Number(stationTieDiameterMm) - Number(cardTieDiameterMm)) / 1000;
  return Number.isFinite(extra) && extra > 0 ? Number(coverM) - extra : Number(coverM);
}

/** Parallel-transport tube accumulator, no THREE dependency. Each path may be
 * an array, or {points, radiusM, metadata} for mixed STORED diameters in one
 * material. ranges.start/count address INDEX entries; faceIndex*3 picks them.
 * Even an omitted invalid path has a zero-count range with its original index.
 */
export function tubeGeometryData(paths, radiusM, radialSegments = 8) {
  const empty = { positions:new Float32Array(), normals:new Float32Array(), uvs:new Float32Array(), indices:new Uint32Array(), ranges:[] };
  if (!Array.isArray(paths) || !Number.isInteger(radialSegments) || radialSegments < 3 || radialSegments > 64) return empty;
  const rows = paths.map((path, pathIndex) => {
    const input = Array.isArray(path) ? path : path?.points;
    const radius = path?.radiusM ?? radiusM;
    const clean = Array.isArray(input) && input.every(point) && positive(radius)
      ? input.map(p => p.map(Number)).filter((p, i, all) => !i || length(sub(p, all[i-1])) > EPS) : [];
    return { points:clean.length >= 2 ? clean : [], radius:Number(radius), metadata:path?.metadata, pathIndex };
  });
  // Each tube: rings + two cap centres; side quads + two end fans (closed ends).
  const vertexCount = rows.reduce((s, row) => s + (row.points.length ? row.points.length*radialSegments + 2 : 0), 0);
  const indexCount = rows.reduce((s, row) => s + (row.points.length ? (row.points.length-1)*radialSegments*6 + 2*radialSegments*3 : 0), 0);
  const positions = new Float32Array(vertexCount*3), normals = new Float32Array(vertexCount*3);
  const uvs = new Float32Array(vertexCount*2);
  const indices = new Uint32Array(indexCount), ranges = [];
  let vertexOffset = 0, indexOffset = 0;
  for (const row of rows) {
    const start = indexOffset, vertexStart = vertexOffset, pts = row.points;
    if (pts.length) {
      const tangents = pts.map((p, i) => norm(sub(pts[Math.min(pts.length-1, i+1)], pts[Math.max(0, i-1)]))
        || norm(sub(pts[Math.min(pts.length-1, i+1)], p)) || norm(sub(p, pts[Math.max(0, i-1)])));
      let normal = null, cumulativeLength = 0;
      const pitchM = .65*(row.radius*2);
      for (let i = 0; i < pts.length; i++) {
        if (i) cumulativeLength += length(sub(pts[i], pts[i-1]));
        const tangent = tangents[i];
        if (normal) normal = norm(sub(normal, mul(tangent, dot(normal, tangent))));
        if (!normal) {
          const reference = Math.abs(tangent[2]) < .9 ? [0,0,1] : [1,0,0];
          normal = norm(sub(reference, mul(tangent, dot(reference, tangent))));
        }
        const binormal = cross(tangent, normal);
        for (let j = 0; j < radialSegments; j++) {
          const a = 2*Math.PI*j/radialSegments;
          const n = add(mul(normal, Math.cos(a)), mul(binormal, Math.sin(a)));
          const v = add(pts[i], mul(n, row.radius));
          positions.set(v, vertexOffset*3); normals.set(n, vertexOffset*3);
          uvs.set([cumulativeLength/pitchM, j/radialSegments], vertexOffset*2); vertexOffset++;
        }
      }
      for (let i = 0; i < pts.length-1; i++) for (let j = 0; j < radialSegments; j++) {
        const a = vertexStart+i*radialSegments+j, b = vertexStart+i*radialSegments+(j+1)%radialSegments;
        // ES-module viewer uses front-side materials: outward triangle winding.
        indices.set([a,b,a+radialSegments,b,b+radialSegments,a+radialSegments], indexOffset); indexOffset += 6;
      }
      const lastRing = vertexStart + (pts.length-1)*radialSegments;
      const startCap = vertexOffset, endCap = vertexOffset + 1;
      positions.set(pts[0], startCap*3); normals.set(mul(tangents[0], -1), startCap*3);
      positions.set(pts.at(-1), endCap*3); normals.set(tangents.at(-1), endCap*3);
      uvs.set([0, .5], startCap*2); uvs.set([cumulativeLength/pitchM, .5], endCap*2);
      vertexOffset += 2;
      for (let j = 0; j < radialSegments; j++) {
        const next = (j+1)%radialSegments;
        indices.set([startCap, vertexStart+next, vertexStart+j], indexOffset); indexOffset += 3;
        indices.set([endCap, lastRing+j, lastRing+next], indexOffset); indexOffset += 3;
      }
    }
    ranges.push({ pathIndex:row.pathIndex, start, count:indexOffset-start, metadata:row.metadata });
  }
  return { positions, normals, uvs, indices, ranges };
}

/** Pick among raycast hits: hidden objects (any invisible ancestor) never
 * count, and a merged rebar batch (userData.ranges) wins over the concrete in
 * front of it, so inspection clicks reach the bar/station metadata. */
export function pickRebarFirstHit(hits, accept = () => true) {
  const shown = object => { for (let o = object; o; o = o.parent) if (o.visible === false) return false; return true; };
  const usable = (Array.isArray(hits) ? hits : []).filter(hit => hit?.object && shown(hit.object) && accept(hit));
  const first = usable[0];
  if (!first) return null;
  // Only the SAME member's bars may win over its concrete: another beam in
  // front (or a roof trace) is what the click meant.
  const member = rebarMetadataOfHit(first).memberId;
  return (member && usable.find(hit => (Array.isArray(hit.object.userData?.ranges)
    || Array.isArray(hit.object.userData?.instanceMetadata))
    && rebarMetadataOfHit(hit).memberId === member)) || first;
}

/** Resolve merged mesh picking without losing station/bar metadata. */
export function rebarMetadataOfHit(hit) {
  const data = hit?.object?.userData || {};
  if (Array.isArray(data.instanceMetadata)) {
    return Number.isInteger(hit?.instanceId) && hit.instanceId >= 0 && hit.instanceId < data.instanceMetadata.length
      ? { ...data, ...data.instanceMetadata[hit.instanceId] } : data;
  }
  if (!Array.isArray(data.ranges)) return data;
  const offset = data.rebarLines === true ? hit?.index : Number.isInteger(hit?.faceIndex) ? hit.faceIndex*3 : null;
  if (!Number.isInteger(offset) || offset < 0) return data;
  const range = data.ranges.find(row => offset >= row.start && offset < row.start+row.count);
  return range ? { ...data, ...(Number.isInteger(range.pathIndex) ? { pathIndex: range.pathIndex } : {}), ...range.metadata } : data;
}
