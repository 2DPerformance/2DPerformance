// Read-only, metre-based drawing projections. xM is always measured from the
// member start node, never from the clear-span inset or the receiver face.
const numeric = value => value === null || value === undefined || value === ''
  || typeof value === 'boolean' ? NaN : Number(value);
const EPS = 1e-9;
export const DETAIL_MIN_STATION_GAP_M = 0.025;

/**
 * Resolve receiver faces from existing design Cards; never invent a width.
 * Detail rows are read exactly as the report reads them (P4 reportData first,
 * an explicit empty P4 array is kept rather than reviving P3 rows).
 */
export function readBeamStirrupStationInput({ spanM, coverM, stirrup, designMember, designMembers = [], insetM } = {}) {
  const members = new Map(designMembers.map(member => [String(member.memberId), member]));
  const detail = key => designMember?.reportData?.[key] ?? designMember?.[key] ?? [];
  return {
    spanM, insetM: insetM ?? numeric(coverM) + numeric(stirrup?.diameterMm) / 2000,
    spacingCm: stirrup?.spacingCm, bar: stirrup?.designation,
    diameterMm: stirrup?.diameterMm,
    endZones: detail('secondaryEndZoneStirrups').map(row => ({ ...row,
      faceOffsetM: numeric(members.get(String(row.receiverMemberId))?.cardSnapshot?.input?.widthM) / 2,
    })),
    // The child's web width (to keep hangers off it) comes from the child's
    // own Card; a row without either stays without one and fails closed.
    hangers: detail('secondaryHangers').map(row => ({ ...row,
      childWidthM: numeric(row.childWidthM) > 0 ? row.childWidthM
        : members.get(String(row.childMemberId))?.cardSnapshot?.input?.widthM,
    })),
  };
}

/**
 * Hoop stations along one beam, xM from the member start node.
 * - No stored detail rows: the uniform layout from the cover inset at the
 *   stored spacing (unchanged from the earlier drawings).
 * - End zone (SB end): hoops from the receiver face inward at the zone
 *   spacing through the zone length; none between the member end and the
 *   face (that part sits inside the receiving beam).
 * - Hanger cluster zone (receiver): the engine sized the hangers with
 *   centre spacing = zone length / (hangers + shear hoops in the zone), so the
 *   zone holds exactly that many hoops at that pitch; each child's hangers
 *   take the nearest slots on alternate sides of its own junction inside its
 *   own zone (both sides of the child, not under its web), the remaining
 *   slots are the shear hoops.
 * - Everywhere else shear hoops fill each run between those fixed hoops (or
 *   the cover inset) in equal intervals no wider than the stored spacing.
 * Unrepresentable/missing detail evidence returns no stations (no guess);
 * callers then show a stirrup HOLD and still draw the section and main bars.
 */
export function buildBeamStirrupStations({ spanM, insetM, spacingCm, bar, diameterMm, endZones = [], hangers = [] } = {}) {
  const span = numeric(spanM), inset = numeric(insetM), spacing = numeric(spacingCm) / 100;
  const diameter = numeric(diameterMm);
  if (![span, inset, spacing, diameter].every(Number.isFinite) || span <= 0 || inset < 0
    || span < 2 * inset || spacing < DETAIL_MIN_STATION_GAP_M || diameter <= 0) return [];
  const first = inset, last = span - inset;
  const shearRow = xM => ({ xM, kind: 'shear', bar, diameterMm: diameter, spacingCm });
  if (!endZones.length && !hangers.length) {
    const shearCount = Math.floor((last - first + EPS) / spacing) + 1;
    if (shearCount > 5000) return [];
    return Array.from({ length: shearCount }, (_, i) => shearRow(first + i * spacing));
  }
  const fixed = [];
  const regions = [];
  const zones = [];
  for (const row of endZones) {
    const face = numeric(row.faceOffsetM), length = numeric(row.zoneM), step = numeric(row.spacingCm) / 100;
    const zoneDiameter = numeric(String(row.bar || '').match(/\d+(?:\.\d+)?$/)?.[0]);
    if (!['A', 'B'].includes(row.end) || zones.some(zone => zone.row.end === row.end)
      || ![face, length, step, zoneDiameter].every(Number.isFinite)
      || face < 0 || length <= 0 || step < DETAIL_MIN_STATION_GAP_M || zoneDiameter <= 0) return [];
    // A face inside the cover inset starts at the inset; stored values unchanged.
    zones.push({ row, step, diameterMm: zoneDiameter,
      faceX: row.end === 'A' ? Math.max(first, face) : Math.min(last, span - face) });
  }
  // Hoops stay between the two receiver faces (or the cover inset at an end
  // without a zone), never inside the opposite receiver.
  const zoneA = zones.find(zone => zone.row.end === 'A'), zoneB = zones.find(zone => zone.row.end === 'B');
  const faceA = zoneA ? zoneA.faceX : first, faceB = zoneB ? zoneB.faceX : last;
  if (faceB - faceA < -EPS) return [];
  const endZoneRow = (zone, xM, fromM, toM) => ({ xM, kind: 'end-zone', bar: zone.row.bar, diameterMm: zone.diameterMm,
    spacingCm: zone.row.spacingCm, end: zone.row.end, receiverMemberId: zone.row.receiverMemberId,
    fromM, toM, note: zone.row.note });
  const reachA = zoneA ? Math.min(faceB, faceA + numeric(zoneA.row.zoneM)) : null;
  const reachB = zoneB ? Math.max(faceA, faceB - numeric(zoneB.row.zoneM)) : null;
  if (zoneA && zoneB && reachA >= reachB - DETAIL_MIN_STATION_GAP_M) {
    // The two zones meet (very short SB): the whole face-to-face run is end
    // zone, equal intervals no wider than the tighter zone spacing, both face
    // hoops kept; each hoop is tagged with the nearer end.
    const step = Math.min(zoneA.step, zoneB.step);
    const intervals = Math.max(1, Math.ceil((faceB - faceA) / step - 1e-9));
    if (intervals > 5000) return [];
    const lastIndex = faceB - faceA < DETAIL_MIN_STATION_GAP_M ? 0 : intervals;
    for (let i = 0; i <= lastIndex; i += 1) {
      const xM = faceA + i * (faceB - faceA) / intervals;
      fixed.push(endZoneRow(xM - faceA <= faceB - xM ? zoneA : zoneB, xM, faceA, faceB));
    }
    regions.push({ kind: 'end-zone', fromM: 0, toM: span });
  } else {
    for (const zone of [zoneA, zoneB].filter(Boolean)) {
      const fromM = zone === zoneA ? faceA : reachB, toM = zone === zoneA ? reachA : faceB;
      regions.push({ kind: 'end-zone', fromM: zone === zoneA ? 0 : fromM, toM: zone === zoneA ? toM : span });
      const count = Math.floor((toM - fromM + EPS) / zone.step) + 1;
      if (count > 5000) return [];
      for (let i = 0; i < count; i += 1) {
        fixed.push(endZoneRow(zone, zone === zoneA ? fromM + i * zone.step : toM - i * zone.step, fromM, toM));
      }
    }
  }
  const clusters = new Map();
  for (const row of hangers) {
    const cluster = row.cluster;
    const key = cluster ? `${cluster.index}:${cluster.zoneM?.fromM}:${cluster.zoneM?.toM}` : row;
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key).push(row);
  }
  for (const rows of clusters.values()) {
    const zone = rows[0].cluster?.zoneM ?? rows[0].zoneM;
    const fromM = numeric(zone?.fromM), toM = numeric(zone?.toM);
    const step = numeric(rows[0].centreSpacingM);
    const hangerCount = rows.reduce((sum, row) => sum + numeric(row.count), 0);
    const shearIn = numeric(rows[0].cluster?.shearStirrupsInZone ?? rows[0].shearStirrupsInZone ?? 0);
    const slotsCount = hangerCount + shearIn;
    if (![fromM, toM, step].every(Number.isFinite) || fromM < 0 || toM > span + EPS || toM <= fromM
      || step < DETAIL_MIN_STATION_GAP_M || !Number.isInteger(hangerCount) || hangerCount < 1
      || !Number.isInteger(shearIn) || shearIn < 0 || slotsCount > 5000
      || (rows[0].cluster && hangerCount !== numeric(rows[0].cluster.hangerCount))
      || Math.abs((toM - fromM) / slotsCount - step) > 5e-4
      || regions.some(region => region.fromM < toM - EPS && region.toM > fromM + EPS)) return [];
    const pitch = (toM - fromM) / slotsCount;
    const slots = Array.from({ length: slotsCount }, (_, i) => ({ xM: fromM + (i + 0.5) * pitch, row: null }));
    const sorted = [...rows].sort((a, b) => numeric(a.stationM) - numeric(b.stationM)
      || String(a.childMemberId).localeCompare(String(b.childMemberId)));
    // "ปลอกปิด 2 ขา แบ่งสองข้างคาน <child>": each child's hangers alternate
    // left/right of its junction, nearest first, outside its web (b_child/2).
    // A slot is committed only if every child can still be completed
    // (bipartite matching over the free slots), where a child with 2+ hangers
    // and room on both sides keeps one unit that must go left and one right.
    // Fallbacks, in order: drop the both-sides demand, then allow under-web slots.
    const info = [];
    for (const row of sorted) {
      const rowFromM = numeric(row.zoneM?.fromM), rowToM = numeric(row.zoneM?.toM);
      const stationM = numeric(row.stationM), n = numeric(row.count);
      if (!Number.isInteger(n) || n < 1 || row.placeable === false
        || ![rowFromM, rowToM, stationM, numeric(row.stirrupBarMm)].every(Number.isFinite)
        || stationM < rowFromM - EPS || stationM > rowToM + EPS
        || numeric(row.stirrupBarMm) <= 0 || numeric(row.centreSpacingM) !== step
        || !(numeric(row.childWidthM) > 0)) return [];
      const webHalfM = numeric(row.childWidthM) / 2;
      const inZone = slots.map((slot, index) => index).filter(index => slots[index].xM >= rowFromM - EPS && slots[index].xM <= rowToM + EPS);
      const distance = index => Math.abs(slots[index].xM - stationM);
      const byDistance = (a, b) => distance(a) - distance(b) || slots[a].xM - slots[b].xM;
      const left = inZone.filter(index => slots[index].xM < stationM - webHalfM + EPS).sort(byDistance);
      const right = inZone.filter(index => slots[index].xM > stationM + webHalfM - EPS).sort(byDistance);
      const under = inZone.filter(index => !left.includes(index) && !right.includes(index)).sort(byDistance);
      info.push({ row, n, left, right, under,
        firstSide: !left.length ? 'R' : !right.length ? 'L' : distance(right[0]) < distance(left[0]) - EPS ? 'R' : 'L' });
    }
    const allocate = (sidedRows, allowWeb, checkOnly = false) => {
      const owner = slots.map(() => -1);
      const need = info.map((item, index) => {
        const sided = sidedRows.has(index) && item.n >= 2 && item.left.length && item.right.length;
        return { L: sided ? 1 : 0, R: sided ? 1 : 0, G: item.n - (sided ? 2 : 0) };
      });
      const general = item => allowWeb ? [...item.left, ...item.right, ...item.under] : [...item.left, ...item.right];
      const canFinish = () => {
        const units = need.flatMap((count, index) => [
          ...Array.from({ length: count.L }, () => info[index].left),
          ...Array.from({ length: count.R }, () => info[index].right),
          ...Array.from({ length: count.G }, () => general(info[index])),
        ]);
        const match = slots.map(() => -1);
        const augment = (unit, seen) => {
          for (const s of units[unit]) {
            if (owner[s] >= 0 || seen[s]) continue;
            seen[s] = true;
            if (match[s] < 0 || augment(match[s], seen)) { match[s] = unit; return true; }
          }
          return false;
        };
        return units.every((_, unit) => augment(unit, []));
      };
      const commit = (index, s, side) => {
        const count = need[index];
        const key = side === 'L' && count.L ? 'L' : side === 'R' && count.R ? 'R' : count.G ? 'G' : null;
        if (!key || owner[s] >= 0) return false;
        owner[s] = index; count[key] -= 1;
        if (canFinish()) return true;
        owner[s] = -1; count[key] += 1;
        return false;
      };
      if (!canFinish()) return null;
      if (checkOnly) return true;
      info.forEach((item, index) => {
        let wanted = item.firstSide;
        for (let placed = 0; placed < item.n; placed += 1) {
          const other = wanted === 'L' ? 'R' : 'L';
          const tries = [[wanted, wanted === 'L' ? item.left : item.right], [other, other === 'L' ? item.left : item.right],
            ...(allowWeb ? [['U', item.under]] : [])];
          let done = null;
          for (const [side, list] of tries) {
            if (list.some(s => commit(index, s, side))) { done = side; break; }
          }
          if (!done) return;
          if (done !== 'U') wanted = done === 'L' ? 'R' : 'L';
        }
      });
      return need.every(count => !count.L && !count.R && !count.G) ? owner : null;
    };
    // Keep the both-sides demand for as many children as the slots allow —
    // exactly. Feasibility is monotone (dropping a demand only relaxes the
    // matching), so an include-first branch and bound finds a maximum set,
    // lower stations preferred on ties. Under-web slots are allowed only when
    // no layout exists without them, and then the same exact search runs
    // (under-web slots stay last in each child's preference). A cluster too
    // large for the work budget holds the hoops rather than drawing a guess.
    const eligible = [...info.keys()].filter(index => info[index].n >= 2 && info[index].left.length && info[index].right.length);
    const allowWeb = !allocate(new Set(), false, true);
    let best = null, budget = 20000;
    const chosen = [];
    const search = k => {
      if ((budget -= 1) < 0) return;
      if (best && chosen.length + eligible.length - k <= best.length) return;
      if (k === eligible.length) { best = [...chosen]; return; }
      chosen.push(eligible[k]);
      if (allocate(new Set(chosen), allowWeb, true)) search(k + 1);
      chosen.pop();
      search(k + 1);
    };
    if (allowWeb && !allocate(new Set(), true, true)) return [];
    search(0);
    if (budget < 0) return [];
    const owner = allocate(new Set(best || []), allowWeb);
    if (!owner) return [];
    owner.forEach((index, s) => { if (index >= 0) slots[s].row = info[index].row; });
    for (const slot of slots) {
      const row = slot.row;
      fixed.push(row ? { xM: slot.xM, kind: 'hanger', bar: row.stirrupBar, diameterMm: row.stirrupBarMm,
        childMemberId: row.childMemberId, receiverMemberId: row.receiverMemberId,
        centreSpacingM: row.centreSpacingM, stationM: numeric(row.stationM),
        fromM: numeric(row.zoneM.fromM), toM: numeric(row.zoneM.toM), note: row.note }
        : { ...shearRow(slot.xM), hangerZone: true, centreSpacingM: rows[0].centreSpacingM });
    }
    regions.push({ kind: 'hanger', fromM, toM });
  }
  const inRegion = xM => regions.some(region => xM >= region.fromM - EPS && xM <= region.toM + EPS);
  const anchors = fixed.map(station => station.xM);
  const fill = [];
  if (!inRegion(first) && !fixed.some(station => station.xM < first + DETAIL_MIN_STATION_GAP_M)) { fill.push(first); anchors.push(first); }
  if (!inRegion(last) && !fixed.some(station => station.xM > last - DETAIL_MIN_STATION_GAP_M)) { fill.push(last); anchors.push(last); }
  anchors.sort((a, b) => a - b);
  const hangerRegions = regions.filter(region => region.kind === 'hanger');
  const hangerAt = xM => hangerRegions.find(region => xM >= region.fromM - EPS && xM <= region.toM + EPS);
  const between = (a, b) => {
    const intervals = Math.ceil((b - a) / spacing - 1e-9);
    return intervals > 5000 ? null : Array.from({ length: Math.max(0, intervals - 1) }, (_, k) => a + (k + 1) * (b - a) / intervals);
  };
  for (let i = 1; i < anchors.length; i += 1) {
    const a = anchors[i - 1], b = anchors[i];
    // A run lying wholly inside one detailed region is already detailed; a
    // run crossing a region boundary is filled to <= the stored spacing.
    if (b - a <= spacing + EPS || regions.some(region => a >= region.fromM - EPS && b <= region.toM + EPS)) continue;
    let points = between(a, b);
    if (!points) return [];
    // A hanger zone keeps exactly its engine count: if a fill hoop would land
    // inside one, the run is split at that zone's edge (a hoop on the edge).
    if (points.some(xM => hangerRegions.some(region => xM > region.fromM + EPS && xM < region.toM - EPS))) {
      const lo = hangerAt(a) ? hangerAt(a).toM : a, hi = hangerAt(b) ? hangerAt(b).fromM : b;
      const inner = hi - lo > EPS ? between(lo, hi) : [];
      if (!inner) return [];
      points = [...(lo > a + EPS ? [lo] : []), ...inner, ...(hi < b - EPS && hi > lo + EPS ? [hi] : [])];
    }
    fill.push(...points);
  }
  // A fill hoop inside an end zone belongs to that zone (replace, never a
  // second shear system there); elsewhere it is a shear hoop.
  const endZoneRows = fixed.filter(station => station.kind === 'end-zone');
  const fillRow = xM => {
    const zone = endZoneRows.find(station => xM >= station.fromM - EPS && xM <= station.toM + EPS);
    return zone ? { ...zone, xM, fill: true } : shearRow(xM);
  };
  return [...fixed, ...fill.map(fillRow)].sort((a, b) => a.xM - b.xM || a.kind.localeCompare(b.kind));
}

/** Schematic perpendicular offsets only; axial extents/diagonal lengths exact. */
export function buildSlabOpeningTrimGeometry(opening, { schematicGapM = 0.04 } = {}) {
  const box = opening?.boxM;
  if (!box) return { lines: [], labels: [] };
  const [minX, maxX, minY, maxY] = ['minX', 'maxX', 'minY', 'maxY'].map(key => numeric(box[key]));
  if (![minX, maxX, minY, maxY].every(Number.isFinite) || maxX <= minX || maxY <= minY) return { lines: [], labels: [] };
  const diagonal = numeric(opening.diagonalM), ld = numeric(opening.ldM);
  const nx = numeric(opening.perSideX), ny = numeric(opening.perSideY);
  const complete = Number.isInteger(nx) && nx >= 0 && Number.isInteger(ny) && ny >= 0 && ld > 0;
  const lines = [];
  const add = (kind, from, to, side) => lines.push({ kind, from, to, side, bar: opening.bar });
  const gap = numeric(schematicGapM) > 0 ? numeric(schematicGapM) : 0.04;
  if (complete) {
    for (let i = 1; i <= nx; i += 1) {
      add('trim-X', { x: minX - ld, y: minY - i * gap }, { x: maxX + ld, y: minY - i * gap }, 'below');
      add('trim-X', { x: minX - ld, y: maxY + i * gap }, { x: maxX + ld, y: maxY + i * gap }, 'above');
    }
    for (let i = 1; i <= ny; i += 1) {
      add('trim-Y', { x: minX - i * gap, y: minY - ld }, { x: minX - i * gap, y: maxY + ld }, 'left');
      add('trim-Y', { x: maxX + i * gap, y: minY - ld }, { x: maxX + i * gap, y: maxY + ld }, 'right');
    }
  }
  // The report prints bars, ℓd and the diagonal length only when the slab
  // spacing is known; otherwise it says "see note", so nothing is drawn.
  if (complete && diagonal > 0) {
    const half = diagonal / (2 * Math.SQRT2);
    for (const [x, y, slope, corner] of [[minX, minY, -1, 'bottom-left'], [minX, maxY, 1, 'top-left'],
      [maxX, minY, 1, 'bottom-right'], [maxX, maxY, -1, 'top-right']]) {
      add('diagonal', { x: x - half, y: y - slope * half }, { x: x + half, y: y + slope * half }, corner);
    }
  }
  const bar = String(opening.bar || 'ดูหมายเหตุ');
  const sideLabel = complete ? (nx === ny ? `${nx}-${bar} ข้างละ (X/Y)` : `X ${nx}-${bar} ข้างละ · Y ${ny}-${bar} ข้างละ`)
    + ` ทุกชั้นที่ถูกตัด · ยาวเลยขอบช่องข้างละ ℓd ${ld.toFixed(2)} ม.` : 'เสริมเหล็กรอบช่องเปิด: ดูหมายเหตุช่องเปิด';
  return { lines, labels: [sideLabel, complete && diagonal > 0 ? `ทแยง 1-${bar} ยาว ${diagonal.toFixed(2)} ม. ทุกมุม` : 'ทแยง: ดูหมายเหตุช่องเปิด'] };
}
