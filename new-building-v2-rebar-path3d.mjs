/**
 * DRAWING ONLY. Owner-authorized geometry port from BOQ Building V2:
 * engine/rebar-engine.js g/b/M (57-65), j/S/A/R/D (114-217),
 * ui/viewer3d.js tubeInto (4-35). No detailing generators or length/BOQ code.
 * Fixed drawing table: source TH / non-seismic (มยผ.1103-64), bendRule=code.
 * Inside bend diameter: tie <=16mm 4d; otherwise <=25 6d, <=36 8d, >36 10d.
 * Centreline radius = (inside diameter + d)/2. Main hooks 90/135:12d,
 * 180:max(4d,60mm); tie hooks 135/180 or d<=16:6d, other 90:12d.
 * This is the source's TH table, NOT its ACI/seismic minimum 75/65mm or BS
 * 4d/7d branch. It is not a choice of design standard or an anchorage result.
 * Units: metres, [x,y,z]. Returned paths never feed quantities or reports.
 */
export const REBAR_DRAWING_CAPTION = 'ขอ/รัศมีงอวาดตามตารางมาตรฐาน (ภาพประกอบ) · ไม่ใช่ค่าคำนวณ';
// Behaviour version for pages that load this file directly (the guided
// workbench): an older cached copy (< 2: nesting not limited to rounded ties)
// is never used — that page keeps today's straight cage instead.
export const REBAR_PATH3D_API = 2;

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
  return (role === 'tie' ? (angleDeg >= 135 || d <= 16 ? 6*d : 12*d)
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
export function sampleRebarPath(points, { radiusM = 0, hooks = {} } = {}) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(point)
    || !declared(radiusM) || Number(radiusM) < 0) return [];
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
    const steps = Math.max(2, Math.ceil(bend.angle / (15*Math.PI/180)));
    for (let j = 0; j <= steps; j++) result.push(add(bend.center, rotate(bend.radial, bend.axis, bend.angle*j/steps)));
  }
  result.push(vertices.at(-1));
  // Source viewer's dedupe, at metre precision appropriate to small bars.
  return result.filter((p, i) => !i || length(sub(p, result[i-1])) > EPS);
}

/** Total concrete section dimensions; clear cover is to the outside of the bar.
 * Tie lies in local y/z, with longitudinal x ramp of 1.05*d. Its station is
 * the ramp midpoint, never an additional station. corner cycles 0..3.
 */
export function closedTiePath({ widthM, depthM, coverM, diameterMm, hookAngleDeg = 135, corner = 0 } = {}) {
  if (!positive(widthM) || !positive(depthM) || !declared(coverM) || Number(coverM) < 0
    || !positive(diameterMm) || hookAngleDeg !== 135 || !Number.isInteger(corner)) return [];
  const d = Number(diameterMm)/1000, r = rebarBendRadiusM(diameterMm, 'tie');
  const w = Number(widthM)/2 - Number(coverM) - d/2;
  const h = Number(depthM)/2 - Number(coverM) - d/2;
  if (!(w > r && h > r)) return [];
  const corners = [[0,h,-w], [0,h,w], [0,-h,w], [0,-h,-w]];
  const k = ((corner%4)+4)%4;
  const body = Array.from({length:5}, (_, i) => corners[(k+i)%4]);
  const hook = { angleDeg:135, extensionM:rebarHookExtensionM(diameterMm, 135, 'tie'), toward:mul(body[0], -1) };
  const sampled = sampleRebarPath(body, { radiusM:r, hooks:{ start:hook, end:hook } });
  // Never clip a hook or reduce its standard radius to fit a small core.
  if (!sampled.length || sampled.some(p => Math.abs(p[1]) > h+EPS || Math.abs(p[2]) > w+EPS)) return [];
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
  const empty = { positions:new Float32Array(), normals:new Float32Array(), indices:new Uint32Array(), ranges:[] };
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
  const indices = new Uint32Array(indexCount), ranges = [];
  let vertexOffset = 0, indexOffset = 0;
  for (const row of rows) {
    const start = indexOffset, vertexStart = vertexOffset, pts = row.points;
    if (pts.length) {
      const tangents = pts.map((p, i) => norm(sub(pts[Math.min(pts.length-1, i+1)], pts[Math.max(0, i-1)]))
        || norm(sub(pts[Math.min(pts.length-1, i+1)], p)) || norm(sub(p, pts[Math.max(0, i-1)])));
      let normal = null;
      for (let i = 0; i < pts.length; i++) {
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
          positions.set(v, vertexOffset*3); normals.set(n, vertexOffset*3); vertexOffset++;
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
      vertexOffset += 2;
      for (let j = 0; j < radialSegments; j++) {
        const next = (j+1)%radialSegments;
        indices.set([startCap, vertexStart+next, vertexStart+j], indexOffset); indexOffset += 3;
        indices.set([endCap, lastRing+j, lastRing+next], indexOffset); indexOffset += 3;
      }
    }
    ranges.push({ pathIndex:row.pathIndex, start, count:indexOffset-start, metadata:row.metadata });
  }
  return { positions, normals, indices, ranges };
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
  const member = first.object.userData?.memberId;
  return (member && usable.find(hit => Array.isArray(hit.object.userData?.ranges)
    && hit.object.userData?.memberId === member)) || first;
}

/** Resolve merged mesh picking without losing station/bar metadata. */
export function rebarMetadataOfHit(hit) {
  const data = hit?.object?.userData || {};
  if (!Array.isArray(data.ranges)) return data;
  const offset = data.rebarLines === true ? hit?.index : Number.isInteger(hit?.faceIndex) ? hit.faceIndex*3 : null;
  if (!Number.isInteger(offset) || offset < 0) return data;
  const range = data.ranges.find(row => offset >= row.start && offset < row.start+row.count);
  return range ? { ...data, ...range.metadata } : data;
}
