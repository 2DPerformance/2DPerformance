/** Explicit lift reference geometry only: no manufacturer sizing, loads,
 * structural receivers, installation compliance or construction authority.
 * World coordinates are metres, Z is project elevation, FRONT is local -Y.
 * Cabin W/L/H are clear interior sizes; cabinFloorElevationM is floor TOP.
 */
import { pitGeometry } from './new-building-v2-cad-geometry.js';

export const LIFT_ASSEMBLY_SCHEMA = 'P1-LIFT-ASSEMBLY-GEOMETRY-INPUT-V1';
export const LIFT_ASSEMBLY_FIELDS = Object.freeze([
  'centerXM', 'centerYM', 'innerWidthM', 'innerLengthM', 'depthM',
  'wallThicknessM', 'baseThicknessM', 'rimElevationM', 'rotationDeg',
  'shaftTopElevationM', 'cabinWidthM', 'cabinLengthM', 'cabinHeightM',
  'cabinWallThicknessM', 'cabinFloorElevationM', 'doorWidthM', 'doorHeightM',
  'doorThicknessM', 'doorOffsetXM', 'railWidthM', 'railDepthM', 'railOffsetXM', 'railOffsetYM',
]);
const AUTHORITY = Object.freeze({
  authority: 'DRAWING_INPUT_ENGINE_0', engineeringStatus: 'not_evaluated',
  analysisInclusion: 'excluded', constructionAuthorized: false, engineRecords: 0,
});
const INPUT_FIELDS = new Set([...LIFT_ASSEMBLY_FIELDS, 'schema', 'levelId', 'servedLevels']);
const RECORD_FIELDS = new Set(['id', 'kind', 'level', 'mark', 'label', 'pointsM', 'upDirection', 'liftAssemblyGeometryInput', ...Object.keys(AUTHORITY)]);
const SIGNED_FIELDS = new Set(['centerXM', 'centerYM', 'rimElevationM', 'rotationDeg', 'shaftTopElevationM', 'cabinFloorElevationM', 'doorOffsetXM', 'railOffsetYM']);
// Numerical tolerance only, never a minimum equipment/installation clearance.
const EPS = 1e-9;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const idOk = value => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 256;
const fail = reason => ({ ok: false, reason });
const unknown = (value, fields) => !plain(value) || Object.keys(value).some(key => !fields.has(key));
const copyInput = input => ({ ...input, servedLevels: input.servedLevels.map(level => ({ ...level })) });

function validateInput(input) {
  if (unknown(input, INPUT_FIELDS)) return fail('LIFT_INPUT_UNKNOWN_FIELDS');
  if (Object.hasOwn(input, 'schema') && input.schema !== LIFT_ASSEMBLY_SCHEMA) return fail('LIFT_SCHEMA_INVALID');
  for (const field of LIFT_ASSEMBLY_FIELDS) {
    if (!finite(input[field]) || (!SIGNED_FIELDS.has(field) && input[field] <= 0)) return fail(`LIFT_INVALID_${field}`);
  }
  if (!idOk(input.levelId)) return fail('LIFT_AUTHORING_LEVEL_INVALID');
  if (!Array.isArray(input.servedLevels) || !input.servedLevels.length || input.servedLevels.length > 512) return fail('LIFT_SERVED_LEVELS_REQUIRED');
  const seen = new Set();
  for (const level of input.servedLevels) {
    if (unknown(level, new Set(['levelId', 'elevationM'])) || !idOk(level.levelId) || !finite(level.elevationM)) return fail('LIFT_SERVED_LEVEL_INVALID');
    if (seen.has(level.levelId)) return fail('LIFT_SERVED_LEVEL_DUPLICATE');
    seen.add(level.levelId);
  }
  if (!seen.has(input.levelId)) return fail('LIFT_AUTHORING_LEVEL_NOT_SERVED');
  return { ok: true };
}

/** All dimensions must be explicitly supplied numbers. Geometric fit is not
 * engineering compliance: accepted boxes are still ENGINE 0 references.
 */
export function liftAssemblyGeometry(input) {
  const validation = validateInput(input);
  if (!validation.ok) return validation;
  const p = input;
  const { innerWidthM: w, innerLengthM: l, wallThicknessM: t, rimElevationM: rim,
    shaftTopElevationM: top, cabinWidthM: cw, cabinLengthM: cl, cabinHeightM: ch,
    cabinWallThicknessM: ct, cabinFloorElevationM: cf, doorWidthM: dw,
    doorHeightM: dh, doorThicknessM: dt, doorOffsetXM: dx } = p;
  const floor = rim - p.depthM;
  const outerW = w + 2 * t, cabinOuterW = cw + 2 * ct, cabinOuterL = cl + 2 * ct;
  const height = top - rim, railHeight = top - floor;
  if (![floor, outerW, cabinOuterW, cabinOuterL, height, railHeight, cf + ch + ct].every(finite)) return fail('LIFT_GEOMETRY_OVERFLOW');
  if (height <= EPS) return fail('LIFT_SHAFT_VERTICAL_ORDER');
  if (cabinOuterW > w || cabinOuterL > l || cf - ct < floor || cf + ch + ct > top) return fail('LIFT_CABIN_OUTSIDE_SHAFT');
  if (Math.abs(dx) + dw / 2 > w / 2 || Math.abs(dx) + dw / 2 > cw / 2 || dh > ch || dt > t || dt > ct) return fail('LIFT_DOOR_DOES_NOT_FIT');
  if (p.railOffsetXM - p.railWidthM / 2 < cabinOuterW / 2
    || p.railOffsetXM + p.railWidthM / 2 > w / 2
    || Math.abs(p.railOffsetYM) + p.railDepthM / 2 > l / 2) return fail('LIFT_RAILS_DO_NOT_FIT');
  const levels = p.servedLevels.toSorted((a, b) => a.elevationM - b.elevationM || a.levelId.localeCompare(b.levelId));
  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i], doorTop = level.elevationM + dh;
    if (!finite(doorTop) || level.elevationM < rim || doorTop > top) return fail('LIFT_LANDING_OUTSIDE_SHAFT');
    if (i && level.elevationM < levels[i - 1].elevationM + dh) return fail('LIFT_LANDING_OPENINGS_OVERLAP');
  }
  const pit = pitGeometry({ center: { x: p.centerXM, y: p.centerYM }, innerWidthM: w, innerLengthM: l,
    depthM: p.depthM, wallThicknessM: t, baseThicknessM: p.baseThicknessM, rimElevationM: rim, rotationDeg: p.rotationDeg });
  if (!pit.ok) return fail(`LIFT_${pit.reason}`);
  const radians = (p.rotationDeg % 360) * Math.PI / 180, cosine = Math.cos(radians), sine = Math.sin(radians);
  const world = (x, y) => ({ x: p.centerXM + x * cosine - y * sine, y: p.centerYM + x * sine + y * cosine });
  const rectangle = (x, y, width, length) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => world(x + sx * width / 2, y + sy * length / 2));
  const components = [];
  const box = (kind, x, y, z, width, length, boxHeight, metadata = {}) => {
    if (width === 0 || length === 0 || boxHeight === 0) return;
    components.push({ kind, center: { ...world(x, y), z }, localCenter: { x, y, z },
      bottomElevationM: z - boxHeight / 2, topElevationM: z + boxHeight / 2,
      size: { x: width, y: length, z: boxHeight }, rotationDeg: p.rotationDeg,
      polygon: rectangle(x, y, width, length), ...metadata });
  };
  box('pit-base', 0, 0, floor - p.baseThicknessM / 2, outerW, l + 2 * t, p.baseThicknessM);
  box('pit-wall-front', 0, -(l + t) / 2, rim - p.depthM / 2, outerW, t, p.depthM);
  box('pit-wall-back', 0, (l + t) / 2, rim - p.depthM / 2, outerW, t, p.depthM);
  box('pit-wall-left', -(w + t) / 2, 0, rim - p.depthM / 2, t, l, p.depthM);
  box('pit-wall-right', (w + t) / 2, 0, rim - p.depthM / 2, t, l, p.depthM);
  box('shaft-wall-back', 0, (l + t) / 2, rim + height / 2, outerW, t, height);
  box('shaft-wall-left', -(w + t) / 2, 0, rim + height / 2, t, l, height);
  box('shaft-wall-right', (w + t) / 2, 0, rim + height / 2, t, l, height);
  // Two full-height jambs, then spandrels only between selected door voids.
  const doorLeft = dx - dw / 2, doorRight = dx + dw / 2, frontY = -(l + t) / 2;
  box('shaft-front-jamb-left', (-outerW / 2 + doorLeft) / 2, frontY, rim + height / 2, outerW / 2 + doorLeft, t, height);
  box('shaft-front-jamb-right', (outerW / 2 + doorRight) / 2, frontY, rim + height / 2, outerW / 2 - doorRight, t, height);
  let cursor = rim;
  const landingOpenings = [];
  for (const level of levels) {
    box('shaft-front-spandrel', dx, frontY, (cursor + level.elevationM) / 2, dw, t, level.elevationM - cursor);
    landingOpenings.push({ levelId: level.levelId, elevationM: level.elevationM, topElevationM: level.elevationM + dh,
      side: 'LOCAL_NEGATIVE_Y', polygon: rectangle(dx, frontY, dw, t) });
    for (const sign of [-1, 1]) box('landing-door-panel', dx + sign * dw / 4, frontY, level.elevationM + dh / 2, dw / 2, dt, dh, { levelId: level.levelId });
    cursor = level.elevationM + dh;
  }
  box('shaft-front-spandrel', dx, frontY, (cursor + top) / 2, dw, t, top - cursor);
  // Hollow cabin, not a solid equipment block. No machinery/load is implied.
  box('cabin-floor', 0, 0, cf - ct / 2, cabinOuterW, cabinOuterL, ct);
  box('cabin-roof', 0, 0, cf + ch + ct / 2, cabinOuterW, cabinOuterL, ct);
  box('cabin-wall-back', 0, (cl + ct) / 2, cf + ch / 2, cabinOuterW, ct, ch);
  box('cabin-wall-left', -(cw + ct) / 2, 0, cf + ch / 2, ct, cl, ch);
  box('cabin-wall-right', (cw + ct) / 2, 0, cf + ch / 2, ct, cl, ch);
  const cabinFrontY = -(cl + ct) / 2;
  box('cabin-front-jamb-left', (-cabinOuterW / 2 + doorLeft) / 2, cabinFrontY, cf + ch / 2, cabinOuterW / 2 + doorLeft, ct, ch);
  box('cabin-front-jamb-right', (cabinOuterW / 2 + doorRight) / 2, cabinFrontY, cf + ch / 2, cabinOuterW / 2 - doorRight, ct, ch);
  box('cabin-front-header', dx, cabinFrontY, cf + (dh + ch) / 2, dw, ct, ch - dh);
  for (const sign of [-1, 1]) {
    box('cabin-door-panel', dx + sign * dw / 4, cabinFrontY, cf + dh / 2, dw / 2, dt, dh);
    box('guide-rail', sign * p.railOffsetXM, p.railOffsetYM, floor + railHeight / 2, p.railWidthM, p.railDepthM, railHeight);
  }
  if (components.some(part => !Object.values(part.center).every(finite)
    || !finite(part.bottomElevationM) || !finite(part.topElevationM)
    || !Object.values(part.size).every(value => finite(value) && value > 0)
    || !finite(part.size.x * part.size.y * part.size.z)
    || !part.polygon.every(point => finite(point.x) && finite(point.y)))) return fail('LIFT_GEOMETRY_OVERFLOW');
  if (components.some(part => part.center.z - part.size.z / 2 === part.center.z + part.size.z / 2
    || part.polygon.some((point, i) => Math.hypot(point.x - part.polygon[(i + 1) % 4].x, point.y - part.polygon[(i + 1) % 4].y) <= EPS))) return fail('LIFT_GEOMETRY_PRECISION_LOSS');
  return { ok: true, reason: null, input: copyInput(input), outerPolygon: pit.outerPolygon,
    innerPolygon: pit.innerPolygon, footprint: pit.outerPolygon,
    cabinPolygon: rectangle(0, 0, cabinOuterW, cabinOuterL), landingOpenings, components,
    frontSide: 'LOCAL_NEGATIVE_Y', authority: AUTHORITY.authority, engineeringStatus: AUTHORITY.engineeringStatus,
    analysisInclusion: AUTHORITY.analysisInclusion, constructionAuthorized: false, engineRecords: 0 };
}

/** Validate persisted shape and authority before deriving either projection.
 * Current project level identity/elevation is additionally checked by P1 record
 * validation and by the active authoring adapter before a transaction.
 */
export function liftAssemblyFromDrawingElement(element) {
  if (unknown(element, RECORD_FIELDS) || element.kind !== 'lift-assembly'
    || !idOk(element.id) || !element.id.startsWith('DOE-LIFT-') || element.id.length <= 9
    || !idOk(element.level) || typeof element.mark !== 'string' || typeof element.label !== 'string'
    || (Object.hasOwn(element, 'upDirection') && element.upDirection !== '')
    || Object.entries(AUTHORITY).some(([key, value]) => element[key] !== value)) return fail('LIFT_RECORD_CONTRACT_INVALID');
  const nested = element.liftAssemblyGeometryInput;
  const nestedFields = new Set([...LIFT_ASSEMBLY_FIELDS, 'schema', 'servedLevels']);
  if (unknown(nested, nestedFields) || nested.schema !== LIFT_ASSEMBLY_SCHEMA) return fail('LIFT_RECORD_INPUT_INVALID');
  const geometry = liftAssemblyGeometry({ ...nested, levelId: element.level });
  if (!geometry.ok) return geometry;
  if (!Array.isArray(element.pointsM) || element.pointsM.length !== 4
    || element.pointsM.some((point, index) => unknown(point, new Set(['x', 'y'])) || !finite(point.x) || !finite(point.y)
      || Math.hypot(point.x - geometry.outerPolygon[index].x, point.y - geometry.outerPolygon[index].y) > EPS)) return fail('LIFT_FOOTPRINT_PARAMETER_MISMATCH');
  return geometry;
}

export function createLiftAssemblyDrawingElement(input, { id, mark = '' } = {}) {
  const geometry = liftAssemblyGeometry(input);
  if (!geometry.ok) return geometry;
  if (!idOk(id) || !id.startsWith('DOE-LIFT-') || id.length <= 9 || typeof mark !== 'string') return fail('LIFT_ID_OR_MARK_INVALID');
  const { levelId, ...nested } = copyInput(input);
  const element = { id, kind: 'lift-assembly', level: levelId, mark,
    label: 'Lift reference · FRONT local -Y · ENGINE 0 · NOT INSTALLATION DESIGN · NOT FOR CONSTRUCTION',
    pointsM: geometry.outerPolygon.map(point => ({ ...point })),
    liftAssemblyGeometryInput: { ...nested, schema: LIFT_ASSEMBLY_SCHEMA }, ...AUTHORITY };
  return { ok: true, reason: null, element, geometry };
}

export function moveLiftAssemblyDrawingElement(element, delta, { copy = false, id } = {}) {
  const current = liftAssemblyFromDrawingElement(element);
  if (!current.ok) return current;
  if (unknown(delta, new Set(['x', 'y'])) || !finite(delta.x) || !finite(delta.y)) return fail('LIFT_MOVE_INVALID');
  if (typeof copy !== 'boolean' || (copy && (!idOk(id) || !id.startsWith('DOE-LIFT-') || id === element.id))) return fail('LIFT_COPY_ID_INVALID');
  if (!copy && id !== undefined && id !== element.id) return fail('LIFT_MOVE_ID_CHANGE_FORBIDDEN');
  const result = createLiftAssemblyDrawingElement({ ...current.input,
    centerXM: current.input.centerXM + delta.x, centerYM: current.input.centerYM + delta.y }, { id: copy ? id : element.id, mark: element.mark });
  if (!result.ok) return result;
  result.element = { ...element, ...result.element, label: element.label,
    ...(Object.hasOwn(element, 'upDirection') ? { upDirection: element.upDirection } : {}) };
  return result;
}
