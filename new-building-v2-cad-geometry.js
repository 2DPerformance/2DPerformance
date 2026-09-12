/** Pure, drawing-only authoring geometry. Coordinates and dimensions are metres.
 * No structural nodes, section guesses, storage, DOM, or design authority are created.
 */
const EPS = 1e-9;
const SNAP_ORDER = Object.freeze({ endpoint: 0, intersection: 1, midpoint: 2, perpendicular: 3, nearest: 4 });
const indexData = new WeakMap();
const finite = value => typeof value === 'number' && Number.isFinite(value);
const pointOk = point => !!point && finite(point.x) && finite(point.y);
const clonePoint = point => ({ x: point.x, y: point.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a, b) => a.x * b.y - a.y * b.x;
const dot = (a, b) => a.x * b.x + a.y * b.y;
const length = vector => Math.hypot(vector.x, vector.y);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fail = reason => ({ ok: false, reason });
const textId = value => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;

/** Edit one directed, finite drawing segment against one finite boundary.
 * The click identifies the side to remove (TR) or endpoint to advance (EX).
 * This computes geometry only; the host owns identity, permission and Undo. */
export function trimExtendSegment({ command, points, boundaryPoints, clickPoint } = {}) {
  if (!['TR', 'EX'].includes(command)) return fail('INVALID_COMMAND');
  if (!Array.isArray(points) || points.length !== 2 || !Array.isArray(boundaryPoints) || boundaryPoints.length !== 2
    || ![...points, ...boundaryPoints, clickPoint].every(pointOk)) return fail('INVALID_SEGMENT');
  const [a, b] = points, [c, d] = boundaryPoints;
  const r = sub(b, a), s = sub(d, c), size = length(r), boundarySize = length(s);
  if (![size, boundarySize].every(finite) || size <= EPS || boundarySize <= EPS) return fail('DEGENERATE_SEGMENT');
  const direction = { x: r.x / size, y: r.y / size }, boundaryDirection = { x: s.x / boundarySize, y: s.y / boundarySize };
  const denominator = cross(direction, boundaryDirection), q = sub(c, a);
  if (Math.abs(denominator) <= EPS) return fail(Math.abs(cross(q, direction)) <= EPS ? 'COLLINEAR_BOUNDARY' : 'PARALLEL_BOUNDARY');
  const along = cross(q, boundaryDirection) / denominator, across = cross(q, direction) / denominator;
  if (!finite(along) || !finite(across)) return fail('GEOMETRY_OVERFLOW');
  if (across < -EPS || across > boundarySize + EPS) return fail('NO_FINITE_BOUNDARY_HIT');
  const hit = { x: a.x + direction.x * along, y: a.y + direction.y * along };
  if (!pointOk(hit)) return fail('GEOMETRY_OVERFLOW');
  const clickedAlong = dot(sub(clickPoint, a), direction);
  if (!finite(clickedAlong)) return fail('GEOMETRY_OVERFLOW');
  let endpointIndex;
  if (command === 'TR') {
    if (along <= EPS || along >= size - EPS) return fail('NO_INTERIOR_CROSSING');
    if (Math.abs(clickedAlong - along) <= EPS) return fail('AMBIGUOUS_CLICK_SIDE');
    endpointIndex = clickedAlong < along ? 0 : 1;
  } else {
    if (Math.abs(clickedAlong - size / 2) <= EPS) return fail('AMBIGUOUS_ENDPOINT');
    endpointIndex = clickedAlong < size / 2 ? 0 : 1;
    if (Math.abs(along - (endpointIndex === 0 ? 0 : size)) <= EPS) return fail('NO_CHANGE');
    if (endpointIndex === 0 ? along >= -EPS : along <= size + EPS) return fail('WRONG_DIRECTION');
  }
  const output = points.map(clonePoint); output[endpointIndex] = hit;
  if (distance(output[0], output[1]) + EPS < 0.01) return fail('SEGMENT_TOO_SHORT');
  if (distance(output[endpointIndex], points[endpointIndex]) <= EPS) return fail('NO_CHANGE');
  return { ok: true, points: output, intersection: hit, endpointIndex, reason: null };
}

/** Quick edit: finite geometry only. TR removes the clicked interval, possibly
 * returning two survivors; EX advances the clicked end to its nearest crossing.
 * The host must re-resolve every boundary and commit the survivors atomically. */
export function quickTrimExtendSegments({ command, points, boundaries, clickPoint } = {}) {
  if (!['TR', 'EX'].includes(command)) return fail('INVALID_COMMAND');
  if (!Array.isArray(points) || points.length !== 2 || ![...points, clickPoint].every(pointOk)
    || !Array.isArray(boundaries)) return fail('INVALID_SEGMENT');
  const [a, b] = points, r = sub(b, a), size = length(r);
  if (!finite(size) || size <= EPS) return fail('DEGENERATE_SEGMENT');
  const unit = { x: r.x / size, y: r.y / size }, clicked = dot(sub(clickPoint, a), unit);
  if (!finite(clicked)) return fail('GEOMETRY_OVERFLOW');
  const endpointIndex = clicked < size / 2 ? 0 : 1;
  if (command === 'EX' && Math.abs(clicked - size / 2) <= EPS) return fail('AMBIGUOUS_ENDPOINT');
  const hits = [];
  for (const boundary of boundaries) {
    if (!boundary?.id || !Array.isArray(boundary.pointsM) || boundary.pointsM.length !== 2
      || !boundary.pointsM.every(pointOk)) continue;
    const [c, d] = boundary.pointsM, s = sub(d, c), boundarySize = length(s);
    if (!finite(boundarySize) || boundarySize <= EPS) continue;
    const direction = { x: s.x / boundarySize, y: s.y / boundarySize }, denominator = cross(unit, direction);
    if (Math.abs(denominator) <= EPS) continue;
    const q = sub(c, a), along = cross(q, direction) / denominator, across = cross(q, unit) / denominator;
    if (!finite(along) || !finite(across) || across < -EPS || across > boundarySize + EPS) continue;
    if (command === 'TR' ? along <= EPS || along >= size - EPS
      : endpointIndex === 0 ? along >= -EPS : along <= size + EPS) continue;
    const hit = { x: a.x + unit.x * along, y: a.y + unit.y * along };
    if (pointOk(hit)) hits.push({ along, point: hit, id: String(boundary.id) });
  }
  hits.sort((left, right) => left.along - right.along || compareText(left.id, right.id));
  if (!hits.length) return fail(command === 'TR' ? 'NO_INTERIOR_CROSSING' : 'NO_FINITE_BOUNDARY_HIT');
  const groups = [];
  for (const hit of hits) {
    const last = groups.at(-1);
    if (last && Math.abs(last.along - hit.along) <= EPS) last.ids.push(hit.id);
    else groups.push({ along: hit.along, point: hit.point, ids: [hit.id] });
  }
  let segments, selected, removedSegment;
  if (command === 'EX') {
    const hit = endpointIndex === 0 ? groups.at(-1) : groups[0];
    const output = points.map(clonePoint); output[endpointIndex] = clonePoint(hit.point);
    segments = [output]; selected = [hit];
  } else {
    if (groups.some(hit => Math.abs(clicked - hit.along) <= EPS)) return fail('AMBIGUOUS_CLICK_SIDE');
    const before = groups.filter(hit => hit.along < clicked).at(-1);
    const after = groups.find(hit => hit.along > clicked);
    selected = [before, after].filter(Boolean);
    // Transient hover evidence only: the interval under the raw pointer is
    // removed, whereas segments below remain the unchanged commit contract.
    removedSegment = [clonePoint(before?.point || a), clonePoint(after?.point || b)];
    segments = [];
    if (before) segments.push([clonePoint(a), clonePoint(before.point)]);
    if (after) segments.push([clonePoint(after.point), clonePoint(b)]);
  }
  if (!segments.length || segments.some(pair => distance(...pair) + EPS < .01)) return fail('SEGMENT_TOO_SHORT');
  return { ok: true, segments, points: segments[0], ...(command === 'TR' ? { removedSegment } : {}), endpointIndex: command === 'EX' ? endpointIndex : undefined,
    boundaryIds: [...new Set(selected.flatMap(hit => hit.ids))].sort(compareText),
    intersections: selected.map(hit => clonePoint(hit.point)), reason: null };
}

function boundsOfSegment(segment) {
  return { minX: Math.min(segment.a.x, segment.b.x), minY: Math.min(segment.a.y, segment.b.y), maxX: Math.max(segment.a.x, segment.b.x), maxY: Math.max(segment.a.y, segment.b.y) };
}

function overlaps(a, b, tolerance = EPS) {
  return a.minX <= b.maxX + tolerance && a.maxX + tolerance >= b.minX && a.minY <= b.maxY + tolerance && a.maxY + tolerance >= b.minY;
}

function project(point, segment, clamp = true) {
  const vector = sub(segment.b, segment.a);
  const size = length(vector);
  const unit = { x: vector.x / size, y: vector.y / size };
  let along = dot(sub(point, segment.a), unit);
  if (!clamp && (along < -EPS || along > size + EPS)) return null;
  along = Math.min(size, Math.max(0, along));
  const result = { x: segment.a.x + unit.x * along, y: segment.a.y + unit.y * along };
  return pointOk(result) ? result : null;
}

// Segment intersection is geometric only. Collinear overlaps have no unique snap.
function intersection(a, b) {
  const r = sub(a.b, a.a), s = sub(b.b, b.a);
  const rLength = length(r), sLength = length(s);
  const rn = { x: r.x / rLength, y: r.y / rLength };
  const sn = { x: s.x / sLength, y: s.y / sLength };
  const denominator = cross(rn, sn);
  if (Math.abs(denominator) <= EPS) return null;
  const q = sub(b.a, a.a);
  const t = cross(q, sn) / denominator;
  const u = cross(q, rn) / denominator;
  if (t < -EPS || t > rLength + EPS || u < -EPS || u > sLength + EPS) return null;
  const result = { x: a.a.x + rn.x * t, y: a.a.y + rn.y * t };
  return pointOk(result) ? result : null;
}

function segmentsTouch(a, b) {
  if (!overlaps(boundsOfSegment(a), boundsOfSegment(b))) return false;
  if (intersection(a, b)) return true;
  const on = (point, segment) => { const projected = project(point, segment); return projected && distance(point, projected) <= EPS; };
  return [a.a, a.b].some(point => on(point, b)) || [b.a, b.b].some(point => on(point, a));
}

function makeSpatialIndex(items, boundsFor, cellSize) {
  const cells = new Map(), broad = [];
  items.forEach((item, itemIndex) => {
    const box = boundsFor(item);
    const minX = Math.floor(box.minX / cellSize), maxX = Math.floor(box.maxX / cellSize);
    const minY = Math.floor(box.minY / cellSize), maxY = Math.floor(box.maxY / cellSize);
    // Long/diagonal segments stay in a small fallback list, never allocate millions of cells.
    if (![minX, maxX, minY, maxY].every(Number.isSafeInteger) || (maxX - minX + 1) * (maxY - minY + 1) > 256) {
      broad.push(itemIndex);
      return;
    }
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x}:${y}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push(itemIndex);
      }
    }
  });
  return { items, cells, broad, cellSize };
}

function querySpatial(index, point, tolerance) {
  const minX = Math.floor((point.x - tolerance) / index.cellSize), maxX = Math.floor((point.x + tolerance) / index.cellSize);
  const minY = Math.floor((point.y - tolerance) / index.cellSize), maxY = Math.floor((point.y + tolerance) / index.cellSize);
  if (![minX, maxX, minY, maxY].every(Number.isSafeInteger) || (maxX - minX + 1) * (maxY - minY + 1) > 1024) return index.items;
  const selected = new Set(index.broad);
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (const itemIndex of index.cells.get(`${x}:${y}`) || []) selected.add(itemIndex);
    }
  }
  return Array.from(selected, itemIndex => index.items[itemIndex]);
}

/** Build once per geometry revision, not on each pointer move. Widths must be
 * supplied by the caller as real beam-edge segments; this module invents none.
 */
export function buildSnapIndex({ points = [], segments = [] } = {}) {
  const copiedSegments = (Array.isArray(segments) ? segments : []).filter(segment => pointOk(segment?.a) && pointOk(segment?.b) && finite(distance(segment.a, segment.b)) && distance(segment.a, segment.b) > EPS)
    .map(segment => ({ a: clonePoint(segment.a), b: clonePoint(segment.b), id: textId(segment.id), label: textId(segment.label), kind: textId(segment.kind) }))
    .sort((a, b) => compareText(a.id, b.id) || a.a.x - b.a.x || a.a.y - b.a.y || a.b.x - b.b.x || a.b.y - b.b.y);
  const candidates = (Array.isArray(points) ? points : []).filter(pointOk).map(point => ({ ...clonePoint(point), kind: 'endpoint', sourceId: textId(point.id), label: textId(point.label) || textId(point.id) }));
  for (const segment of copiedSegments) {
    for (const point of [segment.a, segment.b]) candidates.push({ ...point, kind: 'endpoint', sourceId: segment.id, label: segment.label || segment.id });
    candidates.push({ x: segment.a.x / 2 + segment.b.x / 2, y: segment.a.y / 2 + segment.b.y / 2, kind: 'midpoint', sourceId: segment.id, label: segment.label || segment.id });
  }
  // Sweep on X excludes disjoint segments before exact tests; intersections are
  // computed here only, and cannot become analytical/model connection nodes.
  const ordered = copiedSegments.map(segment => ({ segment, box: boundsOfSegment(segment) })).sort((a, b) => a.box.minX - b.box.minX);
  let active = [], intersectionCount = 0;
  for (const current of ordered) {
    active = active.filter(other => other.box.maxX + EPS >= current.box.minX);
    for (const other of active) {
      if (!overlaps(current.box, other.box)) continue;
      const point = intersection(current.segment, other.segment);
      if (!point) continue;
      const pair = [current.segment, other.segment].sort((a, b) => compareText(a.id, b.id));
      candidates.push({ ...point, kind: 'intersection', sourceId: pair.map(segment => segment.id).join('|'), label: pair.map(segment => segment.label || segment.id).join(' ∩ ') });
      intersectionCount += 1;
    }
    active.push(current);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const candidate of candidates) {
    minX = Math.min(minX, candidate.x); minY = Math.min(minY, candidate.y);
    maxX = Math.max(maxX, candidate.x); maxY = Math.max(maxY, candidate.y);
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  const cellSize = finite(extent) && extent > EPS ? Math.max(EPS, extent / Math.max(1, Math.sqrt(candidates.length))) : 1;
  const result = Object.freeze({ pointCount: candidates.length, segmentCount: copiedSegments.length, intersectionCount, cellSize });
  indexData.set(result, {
    points: makeSpatialIndex(candidates, point => ({ minX: point.x, maxX: point.x, minY: point.y, maxY: point.y }), cellSize),
    segments: makeSpatialIndex(copiedSegments, boundsOfSegment, cellSize),
  });
  return result;
}

/** Tolerance is world metres (caller converts the same screen-pixel radius at
 * each zoom). Compare nearest geometry first. Type priority breaks only near
 * ties within 10% of that radius (0.9 px for the controller's 9 px hit radius),
 * so a distant Grid endpoint cannot steal a precise beam-face target.
 */
export function findSnap(index, point, { tolerance, enabled = {}, anchor } = {}) {
  const data = indexData.get(index);
  if (!data || !pointOk(point) || !finite(tolerance) || tolerance < 0) return null;
  const candidates = [];
  const admit = candidate => {
    if (enabled[candidate.kind] === false) return;
    const separation = distance(candidate, point);
    if (separation <= tolerance) candidates.push({ ...candidate, distance: separation });
  };
  for (const candidate of querySpatial(data.points, point, tolerance)) admit(candidate);
  for (const segment of querySpatial(data.segments, point, tolerance)) {
    if (enabled.nearest !== false) {
      const nearest = project(point, segment);
      if (nearest) admit({ ...nearest, kind: 'nearest', sourceId: segment.id, label: segment.label || segment.id });
    }
    if (enabled.perpendicular !== false && pointOk(anchor)) {
      const foot = project(anchor, segment, false);
      if (foot) admit({ ...foot, kind: 'perpendicular', sourceId: segment.id, label: segment.label || segment.id });
    }
  }
  if (!candidates.length) return null;
  const nearestDistance = candidates.reduce((minimum, candidate) => Math.min(minimum, candidate.distance), Infinity);
  const nearTieDistance = Math.max(EPS, tolerance * 0.1);
  // Filter relative to the single global minimum; a pairwise fuzzy comparator
  // is non-transitive and can move the result farther through a chain of ties.
  const nearest = candidates.filter(candidate => candidate.distance <= nearestDistance + nearTieDistance);
  nearest.sort((a, b) => SNAP_ORDER[a.kind] - SNAP_ORDER[b.kind] || a.distance - b.distance || compareText(a.sourceId, b.sourceId) || a.x - b.x || a.y - b.y || compareText(a.label, b.label));
  return nearest[0];
}

function signedArea(points) {
  // Translation avoids cancellation for a small shape far from the origin.
  const origin = points[0];
  let twiceArea = 0;
  for (let i = 1; i + 1 < points.length; i += 1) twiceArea += cross(sub(points[i], origin), sub(points[i + 1], origin));
  return twiceArea / 2;
}

export function validatePolyline(points, { closed = false } = {}) {
  if (!Array.isArray(points) || !points.every(pointOk)) return fail('NON_FINITE_POINT');
  const result = points.map(clonePoint);
  if (closed && result.length > 1 && distance(result[0], result.at(-1)) <= EPS) result.pop();
  if (result.length < (closed ? 3 : 2)) return fail('TOO_FEW_POINTS');
  const segments = result.slice(0, closed ? result.length : result.length - 1).map((point, i) => ({ a: point, b: result[(i + 1) % result.length] }));
  if (segments.some(segment => !finite(distance(segment.a, segment.b)) || distance(segment.a, segment.b) <= EPS)) return fail('ZERO_LENGTH_SEGMENT');
  for (let i = 0; i < segments.length; i += 1) {
    const next = segments[(i + 1) % segments.length];
    if (closed || i + 1 < segments.length) {
      const a = sub(segments[i].b, segments[i].a), b = sub(next.b, next.a);
      if (Math.abs(cross(a, b)) <= EPS * length(a) * length(b) && dot(a, b) < 0) return fail('BACKTRACKING_SEGMENT');
    }
    for (let j = i + 1; j < segments.length; j += 1) {
      if (j === i + 1 || (closed && i === 0 && j === segments.length - 1)) continue;
      if (segmentsTouch(segments[i], segments[j])) return fail('SELF_INTERSECTION');
    }
  }
  if (closed && (!finite(signedArea(result)) || Math.abs(signedArea(result)) <= EPS * EPS)) return fail('ZERO_AREA');
  return { ok: true, points: result, reason: null };
}

/** Positive distance is LEFT of the directed polyline. No trimming, beveling or
 * topology repair is guessed: self-crossing, collapsed or reversed offsets fail.
 */
export function offsetPolyline(points, distanceM, { closed = false } = {}) {
  const validation = validatePolyline(points, { closed });
  if (!validation.ok) return validation;
  if (!finite(distanceM)) return fail('INVALID_OFFSET');
  const input = validation.points;
  if (distanceM === 0) return validation;
  const segments = input.slice(0, closed ? input.length : input.length - 1).map((a, i) => {
    const b = input[(i + 1) % input.length], delta = sub(b, a), size = length(delta);
    const direction = { x: delta.x / size, y: delta.y / size };
    return { a, b, direction, normal: { x: -direction.y, y: direction.x } };
  });
  const shifted = (point, segment) => ({ x: point.x + segment.normal.x * distanceM, y: point.y + segment.normal.y * distanceM });
  const output = [];
  for (let i = 0; i < input.length; i += 1) {
    if (!closed && i === 0) { output.push(shifted(input[i], segments[0])); continue; }
    if (!closed && i === input.length - 1) { output.push(shifted(input[i], segments.at(-1))); continue; }
    const before = segments[(i - 1 + segments.length) % segments.length], after = segments[i];
    const a = shifted(input[i], before), b = shifted(input[i], after);
    const denominator = cross(before.direction, after.direction);
    if (Math.abs(denominator) <= EPS) { output.push(a); continue; }
    const along = cross(sub(b, a), after.direction) / denominator;
    output.push({ x: a.x + along * before.direction.x, y: a.y + along * before.direction.y });
  }
  const checked = validatePolyline(output, { closed });
  if (!checked.ok) return fail(`OFFSET_${checked.reason}`);
  if (segments.some((segment, i) => dot(sub(output[(i + 1) % output.length], output[i]), segment.direction) <= EPS)) return fail('OFFSET_COLLAPSE');
  if (closed && signedArea(input) * signedArea(output) <= 0) return fail('OFFSET_COLLAPSE');
  return checked;
}

function rotate(point, rotationDeg) {
  const radians = (rotationDeg % 360) * Math.PI / 180;
  const cosine = Math.cos(radians), sine = Math.sin(radians);
  return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
}

function pitValidation(pit) {
  if (!pit || !pointOk(pit.center)) return fail('INVALID_CENTER');
  for (const field of ['innerWidthM', 'innerLengthM', 'depthM', 'wallThicknessM', 'baseThicknessM']) {
    if (!finite(pit[field]) || pit[field] <= 0) return fail(`INVALID_${field}`);
  }
  if (!finite(pit.rimElevationM) || !finite(pit.rotationDeg)) return fail('INVALID_LEVEL_OR_ROTATION');
  return { ok: true };
}

/** One clear cavity, four non-overlapping wall prisms and a base BELOW the
 * cavity. Depth terminates at the TOP of the base, not its underside.
 */
export function pitGeometry(pit) {
  const validation = pitValidation(pit);
  if (!validation.ok) return validation;
  const { innerWidthM: width, innerLengthM: depth, wallThicknessM: wall, depthM: height, baseThicknessM: base, rimElevationM: rim, rotationDeg } = pit;
  const outerWidth = width + 2 * wall, outerLength = depth + 2 * wall;
  const worldPoint = point => {
    const rotated = rotate(point, rotationDeg);
    return { x: pit.center.x + rotated.x, y: pit.center.y + rotated.y };
  };
  const rectangle = (w, d) => [{ x: -w / 2, y: -d / 2 }, { x: w / 2, y: -d / 2 }, { x: w / 2, y: d / 2 }, { x: -w / 2, y: d / 2 }].map(worldPoint);
  const component = (kind, x, y, z, size) => ({ kind, center: { ...worldPoint({ x, y }), z }, size, rotationDeg });
  const components = [
    component('wall', 0, -(depth + wall) / 2, rim - height / 2, { x: outerWidth, y: wall, z: height }),
    component('wall', 0, (depth + wall) / 2, rim - height / 2, { x: outerWidth, y: wall, z: height }),
    component('wall', -(width + wall) / 2, 0, rim - height / 2, { x: wall, y: depth, z: height }),
    component('wall', (width + wall) / 2, 0, rim - height / 2, { x: wall, y: depth, z: height }),
    component('base', 0, 0, rim - height - base / 2, { x: outerWidth, y: outerLength, z: base }),
  ];
  const innerPolygon = rectangle(width, depth), outerPolygon = rectangle(outerWidth, outerLength);
  if (!innerPolygon.every(pointOk) || !outerPolygon.every(pointOk) || components.some(item => !pointOk(item.center) || !finite(item.center.z) || !Object.values(item.size).every(finite))) return fail('GEOMETRY_OVERFLOW');
  if (!validatePolyline(innerPolygon, { closed: true }).ok || !validatePolyline(outerPolygon, { closed: true }).ok) return fail('GEOMETRY_PRECISION_LOSS');
  return { ok: true, innerPolygon, outerPolygon, components, reason: null };
}

/** Anchors min/max refer to LOCAL rectangle corners before rotation. Invalid
 * input returns null rather than moving to a guessed center or guessing sizes.
 */
export function placePitAtAnchor(pit, target, { anchor = 'center' } = {}) {
  if (!pitValidation(pit).ok || !pointOk(target) || !['center', 'inner-min', 'outer-min', 'inner-max', 'outer-max'].includes(anchor)) return null;
  let local = { x: 0, y: 0 };
  if (anchor !== 'center') {
    const extra = anchor.startsWith('outer') ? 2 * pit.wallThicknessM : 0;
    const sign = anchor.endsWith('min') ? -1 : 1;
    local = { x: sign * (pit.innerWidthM + extra) / 2, y: sign * (pit.innerLengthM + extra) / 2 };
  }
  const delta = rotate(local, pit.rotationDeg);
  const result = { ...pit, center: { x: target.x - delta.x, y: target.y - delta.y } };
  return pitGeometry(result).ok ? result : null;
}

/** EXPLICIT fit preview only; caller must seek acceptance before applying it.
 * Bounds use minX/minY/maxX/maxY. Rotations not aligned to world axes fail.
 */
export function fitPitToBounds(pit, bounds, { basis } = {}) {
  const validation = pitValidation(pit);
  if (!validation.ok) return validation;
  if (!bounds || !['minX', 'minY', 'maxX', 'maxY'].every(key => finite(bounds[key])) || bounds.maxX <= bounds.minX || bounds.maxY <= bounds.minY) return fail('INVALID_BOUNDS');
  if (!['inner', 'outer'].includes(basis)) return fail('INVALID_FIT_BASIS');
  const quarterTurns = (pit.rotationDeg % 360) / 90;
  if (Math.abs(quarterTurns - Math.round(quarterTurns)) > EPS) return fail('FIT_REQUIRES_AXIS_ALIGNED_ROTATION');
  const swapped = Math.abs(Math.round(quarterTurns) % 2) === 1;
  const worldWidth = bounds.maxX - bounds.minX, worldLength = bounds.maxY - bounds.minY;
  const deduct = basis === 'outer' ? 2 * pit.wallThicknessM : 0;
  const result = {
    ...pit,
    center: { x: bounds.minX / 2 + bounds.maxX / 2, y: bounds.minY / 2 + bounds.maxY / 2 },
    innerWidthM: (swapped ? worldLength : worldWidth) - deduct,
    innerLengthM: (swapped ? worldWidth : worldLength) - deduct,
  };
  if (result.innerWidthM <= 0 || result.innerLengthM <= 0) return fail('WALLS_EXCEED_CLEAR_BOUNDS');
  const geometry = pitGeometry(result);
  return geometry.ok ? { ok: true, pit: result, reason: null } : geometry;
}
