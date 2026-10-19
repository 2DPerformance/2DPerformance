/** NBV2 Phase A: read-only footing drawing geometry in metres, Y-up.
 * Ports drawing organisation from owned legacy RE:367-392/416-459/595-729.
 * Reinforcement and dimensions ALWAYS come from current NBV2 Card rows.
 * No development, lap, section selection, quantity or construction approval.
 */
import { rebarBendRadiusM, sampleRebarPath } from './new-building-v2-rebar-path3d.mjs';

export const FOOTING_DETAIL_PATH_API = 1;
export const FOOTING_DEVELOPMENT_HOLD = 'FOOTING_DOWEL_DEVELOPMENT_PATH_ADAPTER_REQUIRED';
const number = value => value === null || value === undefined || value === '' || typeof value === 'boolean'
  ? null : Number.isFinite(Number(value)) ? Number(value) : null;
const positive = value => number(value) > 0;
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const polygon = value => Array.isArray(value) && value.length >= 3 && value.every(p => number(p?.x) !== null && number(p?.y) !== null)
  ? value.map(p => ({ x: Number(p.x), y: Number(p.y) })) : null;
const rectangle = (a, b) => [{ x: -a / 2, y: -b / 2 }, { x: a / 2, y: -b / 2 }, { x: a / 2, y: b / 2 }, { x: -a / 2, y: b / 2 }];

/** Same validation/data contract as round-2a reportFootingDowelLayout.
 * Callers may pass that helper's result directly instead of resolving twice.
 */
export function footingDowelLayout(footing, column) {
  const evidence = footing?.dowelEvidence, card = column?.cardSnapshot;
  if (!evidence) return { ok: false, detail: 'เหล็กเดือย: ตามเหล็กเสา (ยังไม่มีผลตรวจ)' };
  const rebar = card?.reinforcement, positions = rebar?.positions;
  const count = number(rebar?.totalBars), diameterMm = number(rebar?.barDiaMm);
  const widthM = number(card?.input?.widthM), depthM = number(card?.input?.depthM);
  if (!evidence || !card?.ok || !Number.isInteger(count) || count <= 0 || !(diameterMm > 0)
    || !Array.isArray(positions) || positions.length !== count
    || positions.some(p => number(p.xMm) === null || number(p.yMm) === null)
    || !(widthM > 0 && depthM > 0) || number(evidence.checkedBarDiaMm) === null
    || evidence.checkedBarDiaMm < diameterMm - 1e-6
    || !(evidence.embedmentCm > 0 && evidence.compressionLengthCm > 0)
    || !['straight', 'hook90'].includes(evidence.mode)
    || (evidence.mode === 'hook90' && !(evidence.hookLengthCm > 0 && evidence.bendCm > 0
      && evidence.straightAvailableCm > 0 && evidence.hookTailCm > 0))) {
    return { ok: false, detail: 'เหล็กเดือย: ข้อมูล Card เสา / ระยะฝัง / ของอยังไม่ครบหรือตรวจคนละขนาดเหล็ก' };
  }
  return freeze(canonical({ ok: true, ...evidence, count, diameterMm, widthM, depthM,
    positions: positions.map(p => ({ xMm: Number(p.xMm), yMm: Number(p.yMm) })),
    columnMemberId: column.memberId, columnCardSnapshotId: column.cardSnapshotId,
    columnSource: 'ColumnCard.reinforcement.totalBars/barDiaMm/positions' }));
}

/** The renderer authenticates complete snapshot lineage. Bind these projected
 * fields as well so an edited Card projection cannot revive drawing geometry.
 */
export function footingDetailCardMatches(footing) {
  const identity = footing?.cardEvidence?.identity;
  const pile = footing?.pile ? Object.fromEntries(['id', 'label', 'swlDesignTon', 'dimCm', 'shape', 'source', 'basisFingerprint']
    .map(key => [key, footing.pile[key] ?? null])) : null;
  if (pile) { pile.verified = footing.pile.verified === true; pile.teachingSample = footing.pile.teachingSample === true; }
  return Boolean(identity && identity.memberId === String(footing?.id || footing?.memberId || '')
    && ['pass', 'review'].includes(footing.verdict)
    && ['node', 'level', 'mark', 'status', 'verdict', 'config', 'dowelEvidence', 'pileCount']
      .every(key => same(identity[key] ?? null, footing[key] ?? null))
    && same(identity.footingType ?? null, footing.footingType ?? null)
    && same(identity.pile, pile));
}

const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const ratio = square > 1e-12 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / square)) : 0;
  return Math.hypot(p.x - a.x - ratio * dx, p.y - a.y - ratio * dy);
};
const insideCover = (p, poly, inset) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if (distanceToSegment(p, a, b) < inset - 1e-9) return false;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

// Convex polygon offset: dimensions of the original Card polygon are retained;
// this operation places bar axes inside their explicitly stored clear cover.
function offsetPolygon(poly, distance) {
  const signedArea = poly.reduce((sum, p, i) => { const q = poly[(i + 1) % poly.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
  const sign = Math.sign(signedArea);
  if (!sign) return null;
  const edges = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length], length = Math.hypot(q.x - p.x, q.y - p.y);
    if (!(length > 1e-9)) return null;
    const dx = (q.x - p.x) / length, dy = (q.y - p.y) / length;
    return { x: p.x - sign * dy * distance, y: p.y + sign * dx * distance, dx, dy };
  });
  if (edges.some(e => !e)) return null;
  const result = edges.map((edge, i) => {
    const previous = edges[(i + edges.length - 1) % edges.length];
    const cross = previous.dx * edge.dy - previous.dy * edge.dx;
    if (Math.abs(cross) < 1e-9) return { x: edge.x, y: edge.y };
    const t = ((edge.x - previous.x) * edge.dy - (edge.y - previous.y) * edge.dx) / cross;
    return { x: previous.x + t * previous.dx, y: previous.y + t * previous.dy };
  });
  return result.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)) ? result : null;
}

function chord(poly, axis, station) {
  const other = axis === 'x' ? 'y' : 'x', values = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if (Math.abs(p[other] - q[other]) < 1e-9) {
      if (Math.abs(station - p[other]) < 1e-9) values.push(p[axis], q[axis]);
    } else if (station >= Math.min(p[other], q[other]) - 1e-9 && station <= Math.max(p[other], q[other]) + 1e-9) {
      const t = (station - p[other]) / (q[other] - p[other]); values.push(p[axis] + t * (q[axis] - p[axis]));
    }
  }
  if (values.length < 2) return null;
  const lo = Math.min(...values), hi = Math.max(...values);
  return hi - lo > 1e-9 ? [lo, hi] : null;
}

/** origin is the cap/pad centre at its TOP, never a fabricated datum.
 * planYSign=-1 matches the native viewer's z=-planY convention.
 * Stored pileCapLayout is consumed as DATA; the sizing engine is not called.
 * drawingBasis is the matching P1 footing record, not a source of defaults.
 */
export function buildFootingDetailPath({ footing, column = null, dowelLayout = null, current = false,
  origin = null, planYSign = 1, drawingBasis = {}, projectDefaults = {}, arcStepDeg = 15 } = {}) {
  const memberId = String(footing?.id || footing?.memberId || ''), config = footing?.config || {};
  const holds = [], paths = [], solids = [];
  const hold = code => { if (!holds.some(row => row.code === code)) holds.push({ family: code === FOOTING_DEVELOPMENT_HOLD ? 'footing-development' : 'footing-geometry', code, memberId }); };
  const source = { footingCardFingerprint: footing?.cardEvidence?.cardFingerprint || null,
    footingCardSnapshotId: footing?.cardEvidence?.cardSnapshotId || null,
    columnCardSnapshotId: column?.cardSnapshotId || dowelLayout?.columnCardSnapshotId || null,
    constructionAuthorized: false };
  if (current !== true || !footingDetailCardMatches(footing) || !Array.isArray(origin) || origin.length !== 3 || origin.some(v => number(v) === null)
    || ![1, -1].includes(planYSign) || !(positive(config.A_m) && positive(config.B_m) && positive(config.T_cm))) {
    hold(FOOTING_DEVELOPMENT_HOLD);
    return freeze({ current: false, dowelCurrent: false, paths, solids, holds, provenance: source });
  }
  const alongX = config.alongX !== false, thicknessM = Number(config.T_cm) / 100;
  const lengthX = Number(alongX ? config.A_m : config.B_m), lengthY = Number(alongX ? config.B_m : config.A_m);
  const transform = ([x, y, z]) => [Number(origin[0]) + x, Number(origin[1]) + y, Number(origin[2]) + planYSign * z];
  const planTransform = p => ({ x: Number(origin[0]) + p.x, y: Number(origin[2]) + planYSign * p.y });
  const layout = config.pileCapLayout || drawingBasis.pileCapLayout;
  const storedOutline = polygon(layout?.capPoly), isSpread = footing?.footingType === 'spread';
  const outline = storedOutline || (!isSpread && Number(footing.pileCount) > 2 ? null : rectangle(lengthX, lengthY));
  if (!isSpread && Number(footing.pileCount) > 2 && !storedOutline) hold('PILE_CAP_OUTLINE_NOT_AVAILABLE');
  if (outline) solids.push({ id: `${memberId}:CAP`, role: 'concrete', kind: 'prism', outline: outline.map(planTransform),
    bottomM: Number(origin[1]) - thicknessM, topM: Number(origin[1]),
    source: storedOutline ? 'FootingCard/p1.pileCapLayout.capPoly' : 'FootingCard.config.A_m/B_m/T_cm/alongX', ...source });

  const storedLean = number(drawingBasis.leanConcreteThicknessM ?? drawingBasis.leanThicknessM ?? config.leanConcreteThicknessM
    ?? (number(drawingBasis.leanConcreteThicknessCm ?? config.leanConcreteThicknessCm) === null ? null : Number(drawingBasis.leanConcreteThicknessCm ?? config.leanConcreteThicknessCm) / 100));
  const defaultLean = number(projectDefaults.leanConcreteThicknessM
    ?? (number(projectDefaults.leanConcreteThicknessCm) === null ? null : Number(projectDefaults.leanConcreteThicknessCm) / 100));
  const leanM = storedLean !== null ? storedLean : defaultLean;
  if (leanM > 0 && outline) {
    const leanOutline = offsetPolygon(outline, -0.1);
    if (leanOutline) solids.push({ id: `${memberId}:LEAN`, role: 'lean', kind: 'prism', outline: leanOutline.map(planTransform),
      bottomM: Number(origin[1]) - thicknessM - leanM, topM: Number(origin[1]) - thicknessM,
      thicknessM: leanM, sideExtensionM: 0.1,
      label: storedLean === null && Math.abs(leanM - 0.05) < 1e-9 ? 'ตามมาตรฐาน 5 ซม.' : null,
      source: storedLean !== null ? 'P1/basis.leanConcreteThickness' : 'projectDefaults.leanConcreteThickness', ...source });
  }
  const pedestal = drawingBasis.pedestal || drawingBasis.stub;
  if (positive(pedestal?.widthM) && positive(pedestal?.depthM) && positive(pedestal?.heightM)) {
    const dx = number(pedestal.offsetXM) ?? 0, dy = number(pedestal.offsetYM) ?? 0;
    solids.push({ id: `${memberId}:PEDESTAL`, role: 'pedestal', kind: 'prism',
      outline: rectangle(Number(pedestal.widthM), Number(pedestal.depthM)).map(p => planTransform({ x: p.x + dx, y: p.y + dy })),
      bottomM: Number(origin[1]), topM: Number(origin[1]) + Number(pedestal.heightM), source: 'P1.pedestal/stub', ...source });
  }

  let pilePositions = Array.isArray(layout?.piles) && layout.piles.length === Number(footing.pileCount)
    && layout.piles.length > 0 && layout.piles.every(p => number(p?.x) !== null && number(p?.y) !== null)
    ? layout.piles.map(p => ({ x: Number(p.x), y: Number(p.y) })) : null;
  if (!isSpread && !pilePositions) {
    if (Number(footing.pileCount) === 1) pilePositions = [{ x: 0, y: 0 }];
    if (Number(footing.pileCount) === 2 && positive(config.spacingM)) pilePositions = [-0.5, 0.5].map(k =>
      ({ x: alongX ? k * Number(config.spacingM) : 0, y: alongX ? 0 : k * Number(config.spacingM) }));
  }
  // Native Card fields authenticate the pile kind/size. Geometry extras are
  // read only from the caller's matching snapshot/P1 basis, never unbound
  // member.pile extras (the Card does not fingerprint those fields).
  const pile = footing?.pile, pileGeometry = drawingBasis.pile || {};
  if (!isSpread && pilePositions) {
    const nativeShape = String(pile?.shape || '').toLowerCase();
    const spun = nativeShape === 'spun' || String(pile?.id || '').startsWith('SPUN-');
    const shape = spun ? 'spun' : nativeShape, dimensionM = number(pile?.dimCm) === null ? null : Number(pile.dimCm) / 100;
    const geometryDimensionM = number(pileGeometry.dimensionM) ?? (number(pileGeometry.dimCm) === null ? null : Number(pileGeometry.dimCm) / 100);
    const geometryMatches = (!pileGeometry.id || pileGeometry.id === pile?.id)
      && (!pileGeometry.shape || [nativeShape, shape].includes(String(pileGeometry.shape).toLowerCase()))
      && (geometryDimensionM === null || Math.abs(geometryDimensionM - dimensionM) < 1e-9);
    const section = polygon(pileGeometry.sectionOutlineM || pileGeometry.section?.outlineM);
    const fullLengthM = number(pileGeometry.lengthM ?? drawingBasis.pileLengthM);
    const headLengthM = fullLengthM > 0 ? fullLengthM : 0.6;
    const explicitEmbedM = number(pileGeometry.capEmbedmentM) ?? 0;
    pilePositions.forEach((position, index) => {
      const topM = Number(origin[1]) - thicknessM + explicitEmbedM;
      const common = { id: `${memberId}:PILE:${index}`, role: 'pile-head', topM, bottomM: topM - headLengthM,
        pileShape: shape, fullLengthStored: fullLengthM > 0, lengthM: headLengthM,
        source: fullLengthM > 0 ? 'pile basis.lengthM' : 'Owner Phase A 600 mm schematic head',
        sectionSource: 'FootingCard.pile / P1 pile basis', ...source };
      const wallM = number(pileGeometry.wallThicknessM) ?? (number(pileGeometry.wallThicknessCm) === null ? null : Number(pileGeometry.wallThicknessCm) / 100);
      if (!geometryMatches || !(explicitEmbedM >= 0 && explicitEmbedM <= thicknessM)
        || (spun && !(wallM > 0 && wallM < dimensionM / 2))) { hold('PILE_SECTION_GEOMETRY_NOT_AVAILABLE'); return; }
      if ((!spun && section) || (shape === 'square' && dimensionM > 0)) solids.push({ ...common, kind: 'prism',
        outline: (section || rectangle(dimensionM, dimensionM)).map(p => planTransform({ x: p.x + position.x, y: p.y + position.y })) });
      else if (['round', 'circular', 'bored', 'spun', 'micro'].includes(shape) && dimensionM > 0) {
        if (shape === 'spun' && !(wallM > 0 && wallM < dimensionM / 2)) { hold('PILE_SECTION_GEOMETRY_NOT_AVAILABLE'); return; }
        solids.push({ ...common, kind: 'cylinder', centre: planTransform(position), radiusM: dimensionM / 2,
          innerRadiusM: shape === 'spun' ? dimensionM / 2 - wallM : 0 });
      } else hold('PILE_SECTION_GEOMETRY_NOT_AVAILABLE');
    });
  } else if (!isSpread) hold('PILE_HEAD_POSITION_NOT_AVAILABLE');

  const dia = number(config.dMainMm), coverM = number(config.coverCm) === null ? null : Number(config.coverCm) / 100;
  if (outline && dia > 0 && coverM !== null && coverM >= 0 && Number.isInteger(Number(config.nA)) && Number(config.nA) > 0
    && Number.isInteger(Number(config.nB)) && Number(config.nB) > 0) {
    const barRadiusM = dia / 2000, inset = offsetPolygon(outline, coverM + barRadiusM);
    if (inset) ['A', 'B'].forEach((direction, layer) => {
      const axis = (direction === 'A') === alongX ? 'x' : 'y', other = axis === 'x' ? 'y' : 'x';
      const count = Number(direction === 'A' ? config.nA : config.nB);
      const low = Math.min(...inset.map(p => p[other])), high = Math.max(...inset.map(p => p[other]));
      const elevation = -thicknessM + coverM + barRadiusM + layer * dia / 1000;
      const detail = config.bottomMat?.[direction] || config.bottomMat || {};
      if (count > 9000 || elevation - barRadiusM < -thicknessM + coverM - 1e-9
        || elevation + barRadiusM > -coverM + 1e-9) { hold('FOOTING_MAT_GEOMETRY_NOT_AVAILABLE'); return; }
      for (let i = 0; i < count; i++) {
        const station = count === 1 ? (low + high) / 2 : low + (high - low) * i / (count - 1), ends = chord(inset, axis, station);
        if (!ends) { hold('FOOTING_MAT_GEOMETRY_NOT_AVAILABLE'); continue; }
        const point = value => axis === 'x' ? [value, elevation, station] : [station, elevation, value];
        let points = ends.map(point);
        const tailM = number(detail.hookExtensionM) ?? (number(detail.hookTailCm) === null ? null : Number(detail.hookTailCm) / 100);
        if (detail.endHook === '90up' && tailM > 0) {
          const hook = { angleDeg: 90, extensionM: tailM, toward: [0, 1, 0] };
          const sampled = sampleRebarPath(points, { radiusM: rebarBendRadiusM(dia, 'main'), hooks: { start: hook, end: hook }, samplingAngleDeg: arcStepDeg });
          if (sampled.length && sampled.every(p => p[1] + barRadiusM <= -coverM + 1e-9
            && insideCover({ x: p[0], y: p[2] }, outline, coverM + barRadiusM))) points = sampled;
          else { hold('FOOTING_MAT_HOOK_GEOMETRY_NOT_AVAILABLE'); continue; }
        }
        paths.push({ id: `${memberId}:MAT:${direction}:${i}`, role: 'bottom-mat', direction, layer, diameterMm: dia,
          points: points.map(transform), source: 'FootingCard.config.nA/nB/dMainMm/coverCm/A_m/B_m', ...source });
      }
    });
  }
  const computedDowels = footingDowelLayout(footing, column);
  const dowels = dowelLayout == null || same(dowelLayout, computedDowels) ? computedDowels : { ok: false };
  const foundationLap = column?.rebarDetailing?.status === 'current'
    ? column.rebarDetailing.column?.foundationDowelLap : null;
  const foundationLapCurrent = foundationLap && positive(foundationLap.lsMm)
    && foundationLap.count === dowels.count && foundationLap.diameterMm === dowels.diameterMm
    && foundationLap.lapStartsAt === 'FOOTING_TOP';
  let dowelCurrent = false;
  if (outline && coverM !== null && coverM >= 0 && dowels.ok && Number.isInteger(dowels.count) && dowels.count === dowels.positions?.length
    && positive(dowels.diameterMm) && positive(dowels.embedmentCm) && foundationLapCurrent) {
    const radiusM = dowels.diameterMm / 2000;
    const steps = Math.max(3, Math.ceil(90 / Math.max(1, Math.min(30, number(arcStepDeg) || 15))));
    const candidates = dowels.positions.map((p, index) => {
      const x = p.xMm / 1000 - dowels.widthM / 2, z = p.yMm / 1000 - dowels.depthM / 2;
      const coordinate = alongX ? x : z, sign = coordinate <= 0 ? -1 : 1;
      const points = [[x, foundationLap.lsMm / 1000, z], [x, 0, z]];
      if (dowels.mode === 'hook90') {
        const depth = dowels.embedmentCm / 100 - radiusM, bend = dowels.bendCm / 100 - radiusM;
        const straight = dowels.straightAvailableCm / 100;
        if (!(bend > 0) || Math.abs(depth - straight - bend) > 1e-6) return null;
        points.push([x, -straight, z]);
        for (let j = 1; j <= steps; j++) {
          const angle = Math.PI / 2 * j / steps, offset = sign * bend * (1 - Math.cos(angle));
          points.push([x + (alongX ? offset : 0), -straight - bend * Math.sin(angle), z + (alongX ? 0 : offset)]);
        }
        const tail = dowels.hookTailCm / 100;
        const end = points.at(-1); points.push([end[0] + (alongX ? sign * tail : 0), end[1], end[2] + (alongX ? 0 : sign * tail)]);
      } else points.push([x, -dowels.embedmentCm / 100, z]);
      // Do not fit/reduce the Card foot: insufficient geometry remains HOLD.
      // Straight vertical RP tubes have flat end caps: their radius is radial
      // in X/Z and does not extend below the stored endpoint. The horizontal
      // hook foot has a vertical radius and its outer face measures embedment.
      const bottomRadialM = dowels.mode === 'hook90' ? radiusM : 0;
      if (points.some(point => !insideCover({ x: point[0], y: point[2] }, outline, coverM + radiusM)
        || point[1] - bottomRadialM < -thicknessM + coverM - 1e-9)) return null;
      return { id: `${memberId}:DOWEL:${index}`, role: 'dowel', mode: dowels.mode, diameterMm: dowels.diameterMm,
        points: points.map(transform), embedmentCm: dowels.embedmentCm, hookTailCm: dowels.hookTailCm ?? null,
        lapLengthMm: foundationLap.lsMm, lapStartsAt: 'FOOTING_TOP',
        lapZone: { from: transform([x, 0, z]), to: transform([x, foundationLap.lsMm / 1000, z]),
          lengthMm: foundationLap.lsMm, codeRef: foundationLap.codeRef },
        foundationDowelLap: foundationLap, detailingComponentsMm: { dowel: foundationLap.lsMm },
        source: { positions: dowels.columnSource, rows: canonical(dowels.sourceRows) }, ...source };
    });
    if (candidates.every(Boolean)) { paths.push(...candidates); dowelCurrent = true; }
  }
  if (!dowelCurrent) hold(FOOTING_DEVELOPMENT_HOLD);
  return freeze({ current: true, dowelCurrent, paths, solids, holds,
    provenance: { ...source, engineeringValuesChanged: false, aboveCapDowelLength: foundationLapCurrent ? 'COLUMN_CARD_CLASS_B_TENSION_LAP_FROM_FOOTING_TOP' : 'SOURCE_EVIDENCE_REQUIRED',
      bottomMatLayerAuthority: 'EXISTING_DRAWING_ONLY', defaultPileHeadLengthM: 0.6 } });
}
