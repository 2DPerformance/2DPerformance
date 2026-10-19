/** Presentation only. Paths and Phase B evidence are inputs; this module does
 * not generate reinforcement, resolve a detailing HOLD, or feed BBS/results.
 * Stock splitting follows the vendored BOQ-V2 splitForStock/cuttingPlan rules.
 * Lap lengths ONLY come from NBV2 Phase B, never the BOQ-V2 lap calculator. */
import { createRebarBatchMeshes } from './new-building-v2-rebar-rendering.mjs';
import { splitForStock, cuttingPlan } from './new-building-v2-vendor-stock.mjs';

export const BAR_RUN_API = 1;
export const BAR_RUN_DURATION_MS = 8000;
export const BAR_RUN_COLOURS = Object.freeze([0x287bde, 0xe79a28, 0x8c58ce, 0x219d81, 0xd75e68]);
const EPS = 1e-9;
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const point = value => Array.isArray(value) && value.length === 3 && value.every(finite);
const distance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));
const cleanPoints = value => Array.isArray(value) && value.every(point)
  ? value.map(row => row.map(Number)).filter((row, index, rows) => !index || distance(row, rows[index - 1]) > EPS) : [];

export function polylineLengthM(points) {
  const rows = cleanPoints(points);
  return rows.slice(1).reduce((sum, row, index) => sum + distance(rows[index], row), 0);
}

/** Preserve source corners and interpolate only the two arc-length endpoints. */
export function slicePolyline(points, fromM = 0, toM = Infinity) {
  const rows = cleanPoints(points), total = polylineLengthM(rows);
  const from = Math.max(0, Math.min(total, Number(fromM))), to = Math.max(from, Math.min(total, Number(toM)));
  if (rows.length < 2 || !(to > from)) return [];
  const result = [];
  let station = 0;
  const push = row => { if (!result.length || distance(result.at(-1), row) > EPS) result.push(row); };
  for (let index = 1; index < rows.length; index++) {
    const a = rows[index - 1], b = rows[index], length = distance(a, b), end = station + length;
    if (end >= from && station <= to) {
      const lerp = at => a.map((value, axis) => value + (b[axis] - value) * (at - station) / length);
      push(lerp(Math.max(from, station)));
      push(lerp(Math.min(to, end)));
    }
    station = end;
    if (station >= to) break;
  }
  return result;
}

/** Same units and result fields as vendor splitForStock: millimetres. */
export function splitBarForStock(lengthMm, lapMm, stockMm) {
  if (![lengthMm, lapMm, stockMm].every(finite) || !(lengthMm > 0) || lapMm < 0 || !(stockMm > lapMm)) {
    throw new RangeError('BAR_RUN_STOCK_INPUT_HOLD');
  }
  return splitForStock(lengthMm, lapMm, stockMm);
}

/** Direct vendored cutting plan, in millimetres. */
export function barRunCuttingPlan(rows, stocks = [10000, 12000], kerf = 0, minReuse = 1000) {
  return cuttingPlan(rows, stocks, kerf, minReuse);
}

export function barRunLabel(pieceIndex, pieceCount, lengthM, lapM = 0) {
  if (![pieceIndex, pieceCount, lengthM, lapM].every(finite)) return 'HOLD · ข้อมูลท่อนเหล็กไม่ครบ';
  return `ท่อน ${pieceIndex + 1}/${pieceCount} · ${Number(lengthM).toFixed(2)} ม. · ทาบ ${Number(lapM).toFixed(2)} ม.`;
}

export function placingOrder(path) {
  const data = path?.metadata || path || {}, role = `${data.type || ''} ${data.role || ''} ${data.kind || ''}`;
  if (/stirrup|tie|hanger|hoop/i.test(role)) return 2;
  return data.face === 'top' || data.layer === 'top' ? 1 : 0;
}

export function barRunProgress(elapsedMs, durationMs = BAR_RUN_DURATION_MS) {
  return Math.max(0, Math.min(1, Number(elapsedMs) / durationMs || 0));
}

function phaseBForPath(member, path) {
  const explicit = path?.metadata?.detailing;
  if (explicit) return explicit.status === 'current' ? explicit : null;
  const detail = member.rebarDetailing || member.designMember?.rebarDetailing;
  if (detail?.status !== 'current') return null;
  const face = path?.metadata?.face;
  const stock = detail.beam?.stock || [];
  const matches = stock.filter(row => row.face === face && (!row.memberIds || row.memberIds.includes(member.memberId)));
  return matches.length === 1 ? { ...matches[0], status: 'current' } : null;
}

/** The existing straight-tie fallback stores one bar as four contiguous
 * segment paths. Join only identical source-station IDs and equal endpoints;
 * retain each original index and never bridge a gap or join distinct bars. */
function completeSourcePaths(paths) {
  const rows = [], stations = new Map();
  paths.forEach((path, sourceIndex) => {
    const data = path.metadata || {}, points = cleanPoints(path.points);
    const stationKnown = /stirrup|tie|hoop/i.test(data.type || '') && data.memberId && finite(data.xM);
    const key = stationKnown ? JSON.stringify([data.memberId, data.type, data.kind, data.xM, data.hookCorner, path.radiusM]) : null;
    const previous = key && stations.get(key);
    if (previous && points.length > 1 && previous.points.length > 1
      && previous.points.at(-1).every((value, axis) => value === points[0][axis])) {
      previous.points.push(...points.slice(1)); previous.sourceIndices.push(sourceIndex);
      return;
    }
    const row = { ...path, points, sourceIndex, sourceIndices: [sourceIndex] };
    rows.push(row);
    if (key) stations.set(key, row);
  });
  return rows;
}

/** Every valid input path is retained, including held bars. A failed length
 * or lap match produces NO purchased-piece geometry or invented lap zone. */
export function buildMemberBarRuns(member = {}) {
  const paths = member.rebarPaths || member.paths || [], holds = [], pieces = [], lapZones = [];
  const bars = completeSourcePaths(paths).map(path => {
    const sourceIndex = path.sourceIndex;
    const points = cleanPoints(path.points), lengthM = polylineLengthM(points), metadata = path.metadata || {};
    const bar = { ...path, points, sourceIndex, order: placingOrder(path), metadata, pieces: [], lapZones: [], status: 'HOLD' };
    const hold = (code, detail) => { const entry = { code, memberId: member.memberId, sourceIndex, detail };
      holds.push(entry); bar.hold = entry; bar.label = `HOLD · ${detail}`; return bar; };
    if (member.runGeometryHolds?.length) return hold('BAR_RUN_CONTINUOUS_GEOMETRY_MISSING',
      'ต้องการรายละเอียดแนวเหล็กเมื่อความลึกคานเปลี่ยน');
    if (points.length < 2 || !(path.radiusM > 0)) return hold('BAR_RUN_PATH_INVALID', 'แนวเหล็กต้นทางไม่ครบ');
    const evidence = phaseBForPath(member, path);
    if (!evidence) return hold('BAR_RUN_PHASE_B_MISSING', 'รอความยาว/ทาบจาก Phase B');
    const developedMm = evidence.developedMm ?? evidence.lengthMm;
    const lapMm = evidence.lapLengthMm ?? evidence.lapMm;
    const stockMm = evidence.stockLengthMm;
    if (![developedMm, lapMm, stockMm].every(finite) || developedMm <= 0 || lapMm < 0 || ![10000, 12000].includes(stockMm)) {
      return hold('BAR_RUN_PHASE_B_LENGTH_MISSING', 'ข้อมูลความยาว/ทาบ/เหล็กซื้อ Phase B ไม่ครบ');
    }
    if (Math.abs(lengthM * 1000 - developedMm) > 1) {
      return hold('BAR_RUN_DETAIL_PATH_LENGTH_MISMATCH', 'แนว 3D ไม่ตรงความยาว Phase B');
    }
    if (!(stockMm > lapMm)) return hold('BAR_RUN_STOCK_TOO_SHORT', 'ความยาวซื้อไม่พอระยะทาบ Phase B');
    const split = splitBarForStock(developedMm, lapMm, stockMm);
    if (split.couplers) return hold('BAR_RUN_COUPLER_EVIDENCE_REQUIRED', 'รอแนวข้อต่อทางกลจาก Phase B');
    if (finite(evidence.pieceCount) && evidence.pieceCount !== split.pieces.length) {
      return hold('BAR_RUN_PIECE_COUNT_MISMATCH', 'จำนวนท่อน Phase B ไม่ตรงกฎตัดซื้อ');
    }
    // A purchased split is not approval to move NBV2's support/middle-third
    // splice. A full-path adapter must provide source-bound arc stations.
    if (split.nLaps) {
      const declaredZones = evidence.lapZones;
      let nextStartM = 0;
      const splitZones = split.pieces.slice(0, -1).map(lengthMm => {
        nextStartM += (lengthMm - lapMm) / 1000;
        return { fromM: nextStartM, toM: nextStartM + lapMm / 1000 };
      });
      if (!Array.isArray(declaredZones) || declaredZones.length !== splitZones.length
        || splitZones.some((zone, index) => !declaredZones[index]?.codeRef
          || ![declaredZones[index]?.fromM, declaredZones[index]?.toM].every(finite)
          || Math.abs(zone.fromM - declaredZones[index].fromM) > .001
          || Math.abs(zone.toM - declaredZones[index].toM) > .001)) {
        return hold('BAR_RUN_LAP_LOCATION_MISMATCH', 'ตำแหน่งทาบซื้อยังไม่ตรงเขตทาบ Phase B');
      }
    }
    let fromM = 0;
    const physicalLapZones = Array.isArray(evidence.physicalLapZones) ? evidence.physicalLapZones : [];
    const physicalLapMm = Math.max(0, ...physicalLapZones.map(zone => Number(zone.sourceLengthMm || zone.lengthMm) || 0));
    split.pieces.forEach((lengthMm, pieceIndex) => {
      const toM = fromM + lengthMm / 1000;
      const piece = { sourceIndex, pieceIndex, pieceCount: split.pieces.length, lengthMm, lengthM: lengthMm / 1000,
        lapMm: split.nLaps ? lapMm : physicalLapMm, lapM: (split.nLaps ? lapMm : physicalLapMm) / 1000, stockLengthM: stockMm / 1000,
        points: slicePolyline(points, fromM, toM), radiusM: path.radiusM, fromM, toM,
        colour: BAR_RUN_COLOURS[(pieceIndex + (metadata.physicalPieceIndex || 0)) % BAR_RUN_COLOURS.length], metadata,
        label: barRunLabel(pieceIndex, split.pieces.length, lengthMm / 1000, (split.nLaps ? lapMm : physicalLapMm) / 1000) };
      bar.pieces.push(piece); pieces.push(piece);
      if (pieceIndex > 0 && lapMm > 0) {
        const lap = { sourceIndex, pieceIndex, lengthMm: lapMm, fromM, toM: fromM + lapMm / 1000,
          points: slicePolyline(points, fromM, fromM + lapMm / 1000), radiusM: path.radiusM * 1.35, metadata };
        bar.lapZones.push(lap); lapZones.push(lap);
      }
      fromM = toM - lapMm / 1000;
    });
    for (const zone of physicalLapZones) {
      if (!zone.codeRef || ![zone.fromM, zone.toM, zone.lengthMm].every(finite)
        || zone.fromM < -0.001 || zone.toM > lengthM + 0.001
        || Math.abs((zone.toM - zone.fromM) * 1000 - zone.lengthMm) > 1) {
        return hold('BAR_RUN_PHYSICAL_LAP_MISMATCH', 'ตำแหน่งทาบไม่ตรงแนวเหล็กจากการ์ด');
      }
      const lap = { sourceIndex, lengthMm: zone.lengthMm, sourceLengthMm: zone.sourceLengthMm,
        fromM: zone.fromM, toM: zone.toM, codeRef: zone.codeRef,
        points: slicePolyline(points, zone.fromM, zone.toM), radiusM: path.radiusM * 1.35, metadata };
      bar.lapZones.push(lap); lapZones.push(lap);
    }
    bar.status = 'CURRENT'; bar.label = bar.pieces.map(piece => piece.label).join(' / ');
    return bar;
  });
  bars.sort((a, b) => a.order - b.order || a.sourceIndex - b.sourceIndex);
  const sourceGroups = new Map();
  for (const bar of bars) {
    if (!(bar.metadata.physicalPieceCount > 1) || bar.status !== 'CURRENT') continue;
    const key = bar.metadata.runBarId || JSON.stringify([member.memberId, bar.metadata.type, bar.metadata.face, bar.metadata.barIndex]);
    if (!sourceGroups.has(key)) sourceGroups.set(key, []);
    sourceGroups.get(key).push(bar);
  }
  for (const group of sourceGroups.values()) {
    group.sort((a, b) => a.metadata.physicalPieceIndex - b.metadata.physicalPieceIndex);
    const sourcePieces = group.flatMap(bar => bar.pieces);
    sourcePieces.forEach((piece, index) => { piece.label = barRunLabel(index, sourcePieces.length, piece.lengthM, piece.lapM); });
    group.forEach(bar => { bar.label = bar.pieces.map(piece => piece.label).join(' / '); });
  }
  if (!bars.length) holds.push({ code: 'BAR_RUN_PATHS_MISSING', memberId: member.memberId, detail: 'ยังไม่มีแนวเหล็กจากการ์ด' });
  return { status: holds.length ? 'HOLD' : 'CURRENT', holds, bars, pieces, lapZones,
    cuttingPlan: barRunCuttingPlan(pieces.map(piece => ({ L: piece.lengthMm, n: 1, mark: `${member.memberId}:${piece.sourceIndex}:${piece.pieceIndex}` }))),
    labels: bars.map(bar => bar.label), durationMs: BAR_RUN_DURATION_MS, presentationOnly: true, constructionAuthorized: false };
}

/** Optional lightweight selected-member overlay. Caller owns animation timing
 * and original visibility; setProgress(1) skips directly to the finished view. */
export function createBarRunOverlay({ THREE, root, member, material, invalidate = () => {} }) {
  const plan = buildMemberBarRuns(member), group = new THREE.Group(), rows = [], materials = new Set();
  group.name = `NBV2_BAR_RUN:${member.memberId || ''}`;
  group.userData = { memberId: member.memberId, presentationOnly: true, authority: 'CARD_PATHS_PHASE_B_STOCK_OR_HOLD', status: plan.status };
  const fallback = material || new THREE.MeshStandardMaterial({ color: 0x49769c, metalness: .62, roughness: .38 });
  if (!material) materials.add(fallback);
  for (const bar of plan.bars) {
    const objects = [];
    const add = (path, colour, lap = false) => {
      if (path.points.length < 2 || !(path.radiusM > 0)) return;
      const source = bar.material || fallback, clone = source.clone();
      if (colour !== undefined) clone.color.setHex(colour);
      if (lap) { clone.emissive?.setHex(0x744c00); clone.emissiveIntensity = .35; }
      materials.add(clone);
      const metadata = { ...group.userData, ...path.metadata, barRun: true, lapZone: lap, sourceIndex: bar.sourceIndex,
        pieceIndex: path.pieceIndex, label: path.label || bar.label };
      createRebarBatchMeshes(THREE, [{ ...path, metadata }], clone,
        { realistic: true, instancing: false, radialSegments: 8, ...metadata }).forEach(mesh => { group.add(mesh); objects.push(mesh); });
    };
    if (bar.pieces.length) bar.pieces.forEach(piece => add(piece, piece.colour));
    else add(bar); // Held bars keep the exact existing path, without stock claims.
    bar.lapZones.forEach(lap => add(lap, 0xffc241, true));
    rows.push(objects);
  }
  root.add(group);
  return { plan, group, setProgress(fraction = 1) {
    const progress = Math.max(0, Math.min(1, Number(fraction) || 0));
    const count = progress >= 1 ? rows.length : Math.floor(progress * rows.length);
    rows.forEach((objects, index) => objects.forEach(mesh => { mesh.visible = index < count; }));
    invalidate();
  }, dispose() {
    group.removeFromParent();
    group.traverse(object => { object.geometry?.dispose();
      const resources = object.userData?.rebarResources;
      resources?.materials?.forEach(value => materials.add(value));
      resources?.textures?.forEach(texture => texture.dispose());
    });
    materials.forEach(value => value.dispose()); group.clear();
  } };
}
