/** Drawing only: one authenticated Slab Card layout for 2D sections and 3D.
 * Legacy RE:1313-1374 supplied layer/scanline presentation ideas only. The
 * NBV2 final spacing, effective depths, continuous edges and 0.30Ln are read
 * from the existing round-2a Card evidence; no steel/design rule runs here.
 * Points use [planX, elevation, planY] in metres (Three Y-up).
 */
import { buildSlabOpeningTrimGeometry } from './new-building-v2-detail-geometry.mjs';
import { rebarBendRadiusM, rebarHookExtensionM, sampleRebarPath } from './new-building-v2-rebar-path3d.mjs';

export const SLAB_DETAIL_PATH_API = 1;
export const SLAB_REBAR_PLACEMENT_HOLD = 'SLAB_REBAR_PLACEMENT_ADAPTER_REQUIRED';
const EPS = 1e-9;
const numeric = value => value === null || value === undefined || value === '' || typeof value === 'boolean'
  ? NaN : Number(value);
const finitePoint = point => point && Number.isFinite(numeric(point.x)) && Number.isFinite(numeric(point.y));
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, canonical(value[key])])) : value;
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const parseLayout = value => {
  const match = String(value || '').match(/\b(RB|DB)(\d+)\s*@\s*([\d.]+)/);
  return match && numeric(match[2]) > 0 && numeric(match[3]) > 0
    ? { designation: `${match[1]}${match[2]}`, diameterMm: Number(match[2]), spacingM: Number(match[3]) / 100 } : null;
};
const spansOf = member => member?.spans || member?.design?.input;
const thicknessOf = member => numeric(spansOf(member)?.thicknessM);

/** Shared by the actual printed round-2a figure and the path adapter. Partial
 * section evidence remains printable: unknown clear spans produce no top line.
 */
export function readSlabSectionLayout(member) {
  const evidence = member?.reinforcementEvidence;
  const positions = evidence?.positions || [];
  const edges = member?.continuity?.edges || [];
  if (evidence?.kind !== 'two-way' || edges.length !== 4 || !['x', 'y'].includes(member?.continuity?.shortDirection)
    || !positions.some(row => row.id === 'pos') || !positions.some(row => row.id === 'posL')
    || edges.some(edge => !finitePoint(edge.A) || !finitePoint(edge.B) || !['x', 'y'].includes(edge.barDirection))) {
    return { current: false, code: 'SLAB_POSITION_EVIDENCE_MISSING', sections: [] };
  }
  if (!(evidence.finalSpacingCm > 0) || positions.some(row => !(row.sUseCm > 0)
    || evidence.finalSpacingCm > row.sUseCm + EPS)) {
    return { current: false, code: 'SLAB_FINAL_LAYOUT_EVIDENCE_MISMATCH', sections: [] };
  }
  const short = member.continuity.shortDirection;
  const sections = [
    { key: 'short', label: 'แนวสั้น', direction: short, clearM: evidence.clearShortSpanM, topId: 'neg', bottomId: 'pos', y: 66 },
    { key: 'long', label: 'แนวยาว', direction: short === 'x' ? 'y' : 'x', clearM: evidence.clearLongSpanM, topId: 'negL', bottomId: 'posL', y: 176 },
  ].map(section => {
    const negative = positions.find(row => row.id === section.topId);
    return { ...section, positivePosition: positions.find(row => row.id === section.bottomId), negative,
      extensionM: section.clearM > 0 && evidence.topExtensionFactor > 0 ? evidence.topExtensionFactor * section.clearM : null,
      extensionFactor: evidence.topExtensionFactor,
      supports: edges.filter(edge => edge.barDirection === section.direction)
        .sort((a, b) => a.A[section.direction] - b.A[section.direction])
        .map(edge => ({ ...edge, continuous: edge.state === 'full' && negative?.muKgm > 0 })),
    };
  });
  // Clone before freezing: a read-only drawing adapter must not freeze an
  // editable Card or any of its positions/support records as a side effect.
  return freeze(canonical({ current: true, code: 'CURRENT', sections, finalMainLabel: evidence.finalMainLabel,
    source: evidence.source, clearSpanSource: evidence.clearSpanSource }));
}

/** The caller authenticates snapshot lineage. Also bind each drawn field to
 * the stored Card identity so a stale/edited projection never revives steel.
 */
export function slabDetailCardMatches(member) {
  const identity = member?.cardEvidence?.identity;
  const spans = spansOf(member);
  if (!identity || identity.memberId !== String(member?.id || member?.memberId || '')
    || member?.verdict === 'hold' || member?.status === 'HOLD' || !spans) return false;
  const projectedSpans = Object.fromEntries(['shortSpanM', 'longSpanM', 'projectionM', 'thicknessM', 'wFactoredKgm2', 'wServiceKgm2']
    .map(key => [key, spans[key] ?? null]));
  const checks = member.checks !== undefined ? member.checks : member.design ? {
    thicknessOk: member.design.thickness.ok, tMinCm: member.design.thickness.tMinCm,
    shearRatio: member.design.shear.ratio, flexureRatio: member.design.governing?.ratio ?? null,
  } : null;
  // Persisted Cards without the Phase A opening binding are deliberately HOLD.
  return Array.isArray(identity.openings) && same(identity.openings, member.openings || [])
    && same(identity.checks, checks) && same(identity.spans, projectedSpans)
    && ['parentAreaId', 'level', 'kind', 'slabKind', 'slabType', 'status', 'verdict', 'bars', 'continuity', 'reinforcementEvidence', 'summary', 'topBarExtension', 'outline']
      .every(key => same(identity[key] ?? null, member[key] ?? null));
}

const boundsOf = points => ({ minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
  minY: Math.min(...points.map(p => p.y)), maxY: Math.max(...points.map(p => p.y)) });
const sameOutline = (a, b) => Array.isArray(b) && a.length === b.length && a.some((_, start) =>
  [1, -1].some(sign => a.every((p, i) => {
    const q = b[(start + sign * i + b.length) % b.length];
    return finitePoint(q) && Math.abs(p.x - numeric(q.x)) < EPS && Math.abs(p.y - numeric(q.y)) < EPS;
  })));
const validOpening = opening => {
  const box = opening?.boxM;
  return String(opening?.id || '').trim() && box
    && ['minX', 'maxX', 'minY', 'maxY'].every(key => Number.isFinite(numeric(box[key])))
    && numeric(box.maxX) > numeric(box.minX) && numeric(box.maxY) > numeric(box.minY);
};
const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y, square = dx * dx + dy * dy;
  const ratio = square > EPS ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / square)) : 0;
  return Math.hypot(p.x - a.x - ratio * dx, p.y - a.y - ratio * dy);
};
const insideCover = (p, polygon, inset) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (distanceToSegment(p, a, b) < inset - EPS) return false;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};

/** Cardinal scanline chords, then subtract every existing void. End insets are
 * the Card cover + bar radius; no synthetic bar can bridge an opening.
 */
export function clipSlabBarLine(from, to, outlineM, openings = [], insetM = 0) {
  const direction = Math.abs(to.x - from.x) > Math.abs(to.y - from.y) ? 'x' : 'y';
  const other = direction === 'x' ? 'y' : 'x';
  const station = from[other], intersections = [];
  for (let i = 0; i < outlineM.length; i++) {
    const a = outlineM[i], b = outlineM[(i + 1) % outlineM.length];
    if ((a[other] > station) !== (b[other] > station)) intersections.push(a[direction]
      + (station - a[other]) * (b[direction] - a[direction]) / (b[other] - a[other]));
  }
  intersections.sort((a, b) => a - b);
  let ranges = [];
  const low = Math.min(from[direction], to[direction]), high = Math.max(from[direction], to[direction]);
  for (let i = 0; i + 1 < intersections.length; i += 2) {
    const a = Math.max(low, intersections[i] + insetM), b = Math.min(high, intersections[i + 1] - insetM);
    if (b > a + EPS) ranges.push([a, b]);
  }
  for (const opening of openings) {
    const box = opening?.boxM;
    if (!box || station <= box[other === 'x' ? 'minX' : 'minY'] - insetM
      || station >= box[other === 'x' ? 'maxX' : 'maxY'] + insetM) continue;
    const a = box[direction === 'x' ? 'minX' : 'minY'] - insetM;
    const b = box[direction === 'x' ? 'maxX' : 'maxY'] + insetM;
    ranges = ranges.flatMap(([l, h]) => b <= l || a >= h ? [[l, h]]
      : [[l, Math.min(h, a)], [Math.max(l, b), h]].filter(([l2, h2]) => h2 > l2 + EPS));
  }
  return ranges.map(([a, b]) => [{ [direction]: a, [other]: station }, { [direction]: b, [other]: station }]);
}

const stations = (low, high, spacing) => {
  if (!(high >= low && spacing > 0)) return [];
  const count = Math.floor((high - low) / spacing + EPS) + 1;
  return count <= 9000 ? Array.from({ length: count }, (_, i) => low + i * spacing) : null;
};

export function buildSlabDetailPaths(member, { outlineM = member?.outline, openings = member?.openings || [], elevationM,
  cardCurrent = false, cantileverRoot = null, samplingAngleDeg = 15 } = {}) {
  const base = { memberId: member?.id || null, current: false, sourceCurrent: false, code: SLAB_REBAR_PLACEMENT_HOLD,
    bars: [], planks: [], holds: [], coordinateSpace: 'THREE_Y_UP_METRES', planAxis: 'X_Z_POSITIVE_PLAN_Y',
    constructionAuthorized: false, ownerPeReviewRequired: true };
  const hold = detail => freeze({ ...base, holds: [{ code: SLAB_REBAR_PLACEMENT_HOLD, memberId: base.memberId, detail }] });
  if (cardCurrent !== true || !slabDetailCardMatches(member)) return hold('Current Slab Card lineage/layout is required');
  const t = thicknessOf(member), top = numeric(elevationM);
  if (!(t > 0) || !Number.isFinite(top) || !Array.isArray(outlineM) || outlineM.length < 3 || !outlineM.every(finitePoint)) {
    return hold('Card thickness, frozen outline and elevation are required');
  }
  const polygon = outlineM.map(p => ({ x: Number(p.x), y: Number(p.y) })), box = boundsOf(polygon);
  if (!sameOutline(polygon, member.outline) || !Array.isArray(openings)
    || !same(openings, member.openings || []) || !openings.every(validOpening)
    || new Set(openings.map(row => row.id)).size !== openings.length) {
    return hold('Frozen outline/opening Card rows are missing or different');
  }
  base.sourceCurrent = true;
  if (member.slabKind === 'PS') {
    const checks = member.checks || {}, widthM = numeric(checks.widthCm) / 100;
    const plankThicknessM = numeric(checks.plankThickCm) / 100, toppingM = numeric(checks.toppingThickM), direction = checks.direction;
    const spanX = box.maxX - box.minX, spanY = box.maxY - box.minY, spans = spansOf(member);
    if (checks.plankVerified !== true || !['x', 'y'].includes(direction) || !(widthM > 0 && plankThicknessM > 0)
      || !(toppingM >= 0) || Math.abs(plankThicknessM + toppingM - t) > EPS
      || polygon.length !== 4 || openings.length
      || new Set(polygon.map(p => p.x)).size !== 2 || new Set(polygon.map(p => p.y)).size !== 2
      || polygon.some((p, i) => { const q = polygon[(i + 1) % polygon.length]; return (p.x === q.x) === (p.y === q.y); })
      || Math.abs(Math.min(spanX, spanY) - numeric(spans.shortSpanM)) > EPS
      || Math.abs(Math.max(spanX, spanY) - numeric(spans.longSpanM)) > EPS
      || Math.abs((direction === 'x' ? spanX : spanY) - numeric(checks.actualSpanM)) > EPS) return hold('PS Card panel/width/thickness is incomplete');
    const axis = direction === 'x' ? 'y' : 'x', low = axis === 'x' ? box.minX : box.minY, high = axis === 'x' ? box.maxX : box.maxY;
    const count = Math.ceil((high - low) / widthM - EPS);
    if (!(count > 0 && count <= 5000)) return hold('PS strip presentation limit');
    base.planks = Array.from({ length: count }, (_, index) => {
      const fromM = low + index * widthM, toM = Math.min(high, fromM + widthM);
      const outline = axis === 'x' ? [{x:fromM,y:box.minY},{x:toM,y:box.minY},{x:toM,y:box.maxY},{x:fromM,y:box.maxY}]
        : [{x:box.minX,y:fromM},{x:box.maxX,y:fromM},{x:box.maxX,y:toM},{x:box.minX,y:toM}];
      return { index, direction, fromM, toM, widthM: toM - fromM, basisWidthM: widthM, outlineM: outline,
        elevationM: top - toppingM, plankThicknessM, toppingM, source: 'PS_CARD_VERIFIED_WIDTH_AND_THICKNESS', basisFingerprint: checks.basisFingerprint };
    });
    return freeze({ ...base, current: true, code: 'CURRENT', source: 'SLAB_CARD_PS_PLANK_STRIPS_ONLY' });
  }
  const evidence = member.reinforcementEvidence, main = parseLayout(member.summary?.mainLabel);
  if (!evidence || !main || evidence.finalSpacingCm / 100 !== main.spacingM
    || !same(evidence.finalMainLabel, member.summary?.mainLabel)) return hold('Final printed Slab Card layout is incomplete');
  const coverM = numeric(member.cardEvidence.identity.context?.materials?.coverM);
  if (!(coverM >= 0)) return hold('Slab Card cover is missing');
  const bars = [], activeLayers = [], holds = [];
  const addHold = detail => holds.push({ code: SLAB_REBAR_PLACEMENT_HOLD, memberId: base.memberId, detail });
  const addSet = ({ direction, z, role, layout = main, sourcePositionId, range, edgeIndex, extensionM }) => {
    const other = direction === 'x' ? 'y' : 'x';
    const inset = coverM + layout.diameterMm / 2000;
    const low = other === 'x' ? box.minX : box.minY, high = other === 'x' ? box.maxX : box.maxY;
    if (!(z >= top - t + inset - EPS && z <= top - inset + EPS)) { addHold('Card layer cannot fit its stored cover'); return; }
    const rows = stations(low + inset, high - inset, layout.spacingM);
    if (!rows) { addHold('SLAB_STATION_PRESENTATION_LIMIT: more than 9000 stored-spacing stations'); return; }
    const cutOpeningIds = new Set();
    for (const station of rows) {
      const begin = range?.[0] ?? (direction === 'x' ? box.minX : box.minY), end = range?.[1] ?? (direction === 'x' ? box.maxX : box.maxY);
      const from = { [direction]: begin, [other]: station }, to = { [direction]: end, [other]: station };
      const original = clipSlabBarLine(from, to, polygon, [], inset);
      for (const opening of openings) {
        const ob = opening.boxM, axisLow = ob[direction === 'x' ? 'minX' : 'minY'], axisHigh = ob[direction === 'x' ? 'maxX' : 'maxY'];
        if (station < ob[other === 'x' ? 'minX' : 'minY'] - EPS || station > ob[other === 'x' ? 'maxX' : 'maxY'] + EPS) continue;
        if (original.some(([a, b]) => b[direction] > axisLow + EPS && a[direction] < axisHigh - EPS)) cutOpeningIds.add(opening.id);
      }
      for (const [a, b] of clipSlabBarLine(from, to, polygon, openings, inset)) bars.push({ role, direction,
        diameterMm: layout.diameterMm, designation: layout.designation, spacingM: layout.spacingM, sourcePositionId,
        ...(edgeIndex !== undefined ? { edgeIndex } : {}), points: [[a.x, z, a.y], [b.x, z, b.y]],
        ...(range ? { supportFaceM: range[0], extensionM } : {}),
        source: 'SLAB_CARD_FINAL_SUMMARY_AND_STEEL_POSITIONS' });
    }
    activeLayers.push({ direction, z, diameterMm: layout.diameterMm, role, cutOpeningIds: [...cutOpeningIds] });
  };
  let sectionLayout = null;
  if (member.slabType === '2-way') {
    sectionLayout = readSlabSectionLayout(member);
    if (!sectionLayout.current) return hold(sectionLayout.code);
    for (const section of sectionLayout.sections) {
      if (!(section.positivePosition?.dCm > 0 && section.positivePosition.dCm < t * 100)) return hold('Card effective depth is missing');
      addSet({ direction: section.direction, z: top - section.positivePosition.dCm / 100,
        role: `bottom-${section.key}`, sourcePositionId: section.bottomId });
      for (const edge of section.supports.filter(row => row.continuous)) {
        if (!(section.extensionM > 0 && edge.supportWidthM > 0 && section.negative?.dCm > 0)) {
          holds.push({ code: SLAB_REBAR_PLACEMENT_HOLD, memberId: base.memberId, edgeIndex: edge.index, detail: 'Continuous edge clear span/support face is missing' }); continue;
        }
        const direction = section.direction;
        const mid = (box[direction === 'x' ? 'minX' : 'minY'] + box[direction === 'x' ? 'maxX' : 'maxY']) / 2;
        const sign = edge.A[direction] < mid ? 1 : -1, face = edge.A[direction] + sign * edge.supportWidthM / 2;
        addSet({ direction, z: top - t + section.negative.dCm / 100, role: `top-${section.key}`,
          sourcePositionId: section.topId, edgeIndex: edge.index, extensionM: section.extensionM,
          range: [face, face + sign * section.extensionM] });
      }
    }
  } else {
    const cantilever = member.kind === 'cantilever-slab';
    const position = evidence.positions.find(row => row.id === (cantilever ? 'neg' : 'pos')) || evidence.positions[0];
    const direction = cantilever ? Math.abs(numeric(cantileverRoot?.outwardNormal?.x)) > .5 ? 'x'
      : Math.abs(numeric(cantileverRoot?.outwardNormal?.y)) > .5 ? 'y' : null : member.continuity?.spanDir;
    const temperature = parseLayout(member.summary?.tempLabel);
    if (!['x', 'y'].includes(direction) || !(position?.dCm > 0) || !temperature) return hold('Card main/temperature direction or effective depth is missing');
    const mainZ = cantilever ? top - t + position.dCm / 100 : top - position.dCm / 100;
    if (cantilever) {
      const A = cantileverRoot?.A, B = cantileverRoot?.B, normal = cantileverRoot?.outwardNormal;
      const extensionM = numeric(member.topBarExtension?.lengthM), projectionM = numeric(spansOf(member)?.projectionM);
      if (!finitePoint(A) || !finitePoint(B) || !(extensionM > 0 && projectionM > 0)) return hold('Cantilever root and existing back-slab extension are missing');
      const other = direction === 'x' ? 'y' : 'x', sign = Number(normal[direction]);
      if (Math.abs(Math.abs(sign) - 1) > EPS) return hold('Cantilever root normal is not cardinal');
      const inset = coverM + main.diameterMm / 2000, root = A[direction];
      if (openings.length) return hold('Cantilever back-slab opening placement evidence is unavailable');
      if (!(mainZ >= top - t + inset - EPS && mainZ <= top - inset + EPS)) return hold('Cantilever Card layer cannot fit its stored cover');
      const rows = stations(Math.min(A[other], B[other]) + inset, Math.max(A[other], B[other]) - inset, main.spacingM);
      if (!rows) return hold('SLAB_STATION_PRESENTATION_LIMIT: more than 9000 stored-spacing stations');
      for (const station of rows) {
        const start = { [direction]: root - sign * extensionM, [other]: station };
        const end = { [direction]: root + sign * (projectionM - inset), [other]: station };
        bars.push({ role: 'cantilever-top', direction, diameterMm: main.diameterMm, designation: main.designation,
          spacingM: main.spacingM, sourcePositionId: position.id, extensionM, points: [[start.x, mainZ, start.y], [end.x, mainZ, end.y]],
          source: 'SLAB_CARD_CANTILEVER_TOP_BAR_EXTENSION' });
      }
    } else addSet({ direction, z: mainZ, role: 'bottom-main', sourcePositionId: position.id });
    addSet({ direction: direction === 'x' ? 'y' : 'x', z: mainZ + (cantilever ? -1 : 1) * (main.diameterMm + temperature.diameterMm) / 2000,
      role: cantilever ? 'cantilever-temperature' : 'bottom-temperature', layout: temperature, sourcePositionId: 'temperature' });
  }
  // Existing report trim geometry. Its perpendicular 40 mm offsets are NTS
  // presentation only; bar count, diameter, axial length and ld are Card rows.
  for (const opening of openings) {
    const diameter = numeric(String(opening.bar || '').match(/(?:RB|DB)(\d+)/)?.[1]);
    const trim = buildSlabOpeningTrimGeometry(opening);
    if (!(diameter > 0) || !trim.lines.length) { holds.push({ code: SLAB_REBAR_PLACEMENT_HOLD, memberId: base.memberId, openingId: opening.id, detail: 'Opening trim Card rows are missing' }); continue; }
    const cutLayers = activeLayers.filter(layer => layer.cutOpeningIds.includes(opening.id));
    const uniqueLayers = cutLayers.filter((row, index, all) => all.findIndex(other => Math.abs(row.z - other.z) < EPS) === index);
    for (const layer of uniqueLayers) {
      const directions = cutLayers.filter(row => Math.abs(row.z - layer.z) < EPS).map(row => row.direction);
      const relevant = trim.lines.filter(line => line.kind === 'diagonal' || directions.some(direction => line.kind === `trim-${direction.toUpperCase()}`));
      for (const line of relevant) {
        const endpoints = [[line.from.x, layer.z, line.from.y], [line.to.x, layer.z, line.to.y]];
        const plainHook = /^RB/.test(opening.bar) && line.kind !== 'diagonal';
        const radiusM = rebarBendRadiusM(diameter, 'main');
        // Hook plane is the slab plane. The existing NTS offsets determine
        // which side is away from the void; no hook lifts outside slab cover.
        const toward = line.kind === 'trim-X' ? [0, 0, line.side === 'below' ? -1 : 1]
          : [line.side === 'left' ? -1 : 1, 0, 0];
        const hook = { angleDeg: 180, extensionM: rebarHookExtensionM(diameter, 180, 'main'), toward };
        const pathOptions = plainHook ? { radiusM, hooks: { start: hook, end: hook } } : { radiusM: 0 };
        const points = plainHook ? sampleRebarPath(endpoints, { ...pathOptions, samplingAngleDeg }) : endpoints;
        const inset = coverM + diameter / 2000;
        if (!points.length || points.some(p => p[1] < top - t + inset - EPS || p[1] > top - inset + EPS
          || !insideCover({ x: p[0], y: p[2] }, polygon, inset))) {
          holds.push({ code: SLAB_REBAR_PLACEMENT_HOLD, memberId: base.memberId, openingId: opening.id,
            detail: 'Opening trim/hook cannot fit the stored slab cover without reducing its Card geometry' }); continue;
        }
        bars.push({ role: `opening-${line.kind}`, diameterMm: diameter, designation: opening.bar,
          openingId: opening.id, points, path: { points: endpoints, ...pathOptions }, direction: layer.direction,
          source: 'SLAB_CARD_OPENING_TRIM_ROWS_AND_2D_GEOMETRY', placementAuthority: 'NTS_PERPENDICULAR_OFFSET' });
      }
    }
  }
  return freeze({ ...base, bars, holds, sectionLayout, current: holds.length === 0,
    code: holds.length ? SLAB_REBAR_PLACEMENT_HOLD : 'CURRENT', source: 'SLAB_CARD_FINAL_LAYOUT_DRAWING_ONLY' });
}
