const EPS = 1e-7;

/** A contact splice touches its partner, while every physical bar stays distinct. */
export function layoutBeamContactLapPair({ fixedPositionsMm, movingPositionsMm,
  fixedDbMm, movingDbMm, boundsMm, fixedDepthsMm = [], movingDepthsMm = [] } = {}) {
  const radius = (fixedDbMm + movingDbMm) / 2;
  const horizontal = (moving, fixed) => Math.sqrt(Math.max(0, radius ** 2
    - ((movingDepthsMm[moving] || 0) - (fixedDepthsMm[fixed] || 0)) ** 2));
  const lo = boundsMm?.[0] ?? Math.min(...movingPositionsMm);
  const hi = boundsMm?.[1] ?? Math.max(...movingPositionsMm);
  const choices = movingPositionsMm.map((position, index) => [...new Set([0,
    ...fixedPositionsMm.flatMap((fixed, j) => [fixed - horizontal(index, j) - position, fixed + horizontal(index, j) - position])])]
    .filter(offset => position + offset >= lo - EPS && position + offset <= hi + EPS
      && fixedPositionsMm.every((fixed, j) => Math.abs(position + offset - fixed) >= horizontal(index, j) - EPS))
    .sort((a, b) => Math.abs(a) - Math.abs(b) || Math.abs(position + a) - Math.abs(position + b)));
  let best = null, bestCost = Infinity, visited = 0;
  const search = (index, positions, offsets, cost) => {
    if (++visited > 10000 || cost > bestCost + EPS) return;
    if (index === movingPositionsMm.length) {
      best = { positionsMm: positions, offsetsMm: offsets }; bestCost = cost; return;
    }
    // A preceding translated bar can require an unmatched extra bar to move
    // too. Its touching neighbour is a valid slot even when it is not one of
    // the fixed splice partner's boundary slots.
    const neighbourOffset = index ? positions[index - 1] + movingDbMm - movingPositionsMm[index] : null;
    const available = [...new Set([...choices[index], ...(neighbourOffset !== null ? [neighbourOffset] : [])])]
      .filter(offset => movingPositionsMm[index] + offset >= lo - EPS
        && movingPositionsMm[index] + offset <= hi + EPS
        && fixedPositionsMm.every((fixed, j) => Math.abs(movingPositionsMm[index] + offset - fixed) >= horizontal(index, j) - EPS))
      .sort((a,b) => Math.abs(a)-Math.abs(b));
    for (const offset of available) {
      const position = movingPositionsMm[index] + offset;
      if (index && position - positions[index - 1] < movingDbMm - EPS) continue;
      search(index + 1, [...positions, position], [...offsets, offset], cost + Math.abs(offset));
    }
  };
  search(0, [], [], 0);
  return best ? { current: true, ...best } : { current: false, positionsMm: [], offsetsMm: [] };
}

const stockKey = stock => `${stock.runId}:${stock.face}:${stock.barSet}:${stock.memberIds.join(',')}`;

/** Source-owned lateral translations of unequal-count contact-spliced chunks.
 * Each entire physical bar is translated rigidly, so no stock/developed quantity
 * changes. Nominal 1:6 joggle profiles remain the source for their bend lengths. */
export function attachBeamContactLapLayouts({ geometry, beamMembers } = {}) {
  const byId = new Map((beamMembers || []).map(member => [member.memberId, member]));
  const lines = new Map((geometry?.lineMembers || []).map(line => [line.id, line]));
  const stocks = [...new Map((beamMembers || []).flatMap(member => member.rebarDetailing?.beam?.stock || [])
    .map(stock => [stockKey(stock), stock])).values()];
  const transitions = [...new Map((beamMembers || []).flatMap(member => member.rebarDetailing?.beam?.transitions || [])
    .filter(row => row.kind !== 'BOTTOM_LEVEL_STEP')
    .map(row => [`${row.runId}:${row.face}:${row.nodeId}`, row])).values()];
  const runDirections = new Map();
  for (const runId of new Set(stocks.map(stock => stock.runId))) {
    const ids = new Set(stocks.filter(stock => stock.runId === runId).flatMap(stock => stock.memberIds));
    const degrees = new Map();
    for (const id of ids) for (const node of [lines.get(id)?.fromNode, lines.get(id)?.toNode])
      if (node) degrees.set(node, (degrees.get(node) || 0) + 1);
    const ends = [...degrees].filter(([, degree]) => degree === 1).map(([node]) => node).sort();
    if (ends.length !== 2) continue;
    const a = geometry.nodes[ends[0]], b = geometry.nodes[ends[1]], length = Math.hypot(b.x - a.x, b.y - a.y);
    runDirections.set(runId, [(b.x - a.x) / length, (b.y - a.y) / length]);
  }
  const offsets = new Map(stocks.map(stock => [stockKey(stock), new Array(Number(stock.barSet.split('-')[0])).fill(0)]));
  const rowsFor = (stock, memberId, nodeId) => {
    const member = byId.get(memberId), line = lines.get(memberId), direction = runDirections.get(stock.runId);
    if (!member || !line || !direction) return [];
    const a = geometry.nodes[line.fromNode], b = geometry.nodes[line.toNode];
    const sign = (b.x - a.x) * direction[0] + (b.y - a.y) * direction[1] >= 0 ? 1 : -1;
    const selection = member.cardSnapshot.results.rebarSelection, bars = selection[stock.face], input = member.cardSnapshot.input;
    const edge = input.widthM * 500 - input.coverM * 1000 - selection.stirrup.diameterMm - bars.diameterMm / 2;
    const face = member.rebarDetailing.beam.ends.find(end => end.context?.nodeId === nodeId)?.context?.jointLayout?.faces?.[stock.face];
    return Array.from({ length: bars.count }, (_, localIndex) => {
      const original = bars.count === 1 ? 0 : -edge + 2 * edge * localIndex / (bars.count - 1);
      const axisDepthMm = input.coverM * 1000 + selection.stirrup.diameterMm + bars.diameterMm / 2
        + Number(input.layerOffsetMm?.[stock.face] || 0);
      return { localIndex, sign, originalMm: sign * original,
        depthMm: stock.face === 'top' ? axisDepthMm : input.depthM * 1000 - axisDepthMm,
        positionMm: sign * (face?.positionsMm?.[localIndex] ?? original) };
    }).sort((a, b) => a.originalMm - b.originalMm);
  };
  const unresolved = [], translated = [];
  const partnerKeys = new Set();
  for (const transition of transitions) {
    const evidence = transition.jointGeometryEvidence || {};
    const left = stocks.find(stock => stock.runId === transition.runId && stock.face === transition.face
      && stock.memberIds.includes(evidence.leftMemberId));
    const right = stocks.find(stock => stock.runId === transition.runId && stock.face === transition.face
      && stock.memberIds.includes(evidence.rightMemberId));
    if (!left || !right || left === right) continue;
    partnerKeys.add(stockKey(left)); partnerKeys.add(stockKey(right));
    const count = stock => Number(stock.barSet.split('-')[0]);
    const diameter = stock => Number(stock.barSet.split('DB')[1]);
    const moving = count(left) >= count(right) ? left : right, fixed = moving === left ? right : left;
    const movingMember = moving === left ? evidence.leftMemberId : evidence.rightMemberId;
    const fixedMember = fixed === left ? evidence.leftMemberId : evidence.rightMemberId;
    const movingRows = rowsFor(moving, movingMember, transition.nodeId), fixedRows = rowsFor(fixed, fixedMember, transition.nodeId);
    const movingOffsets = offsets.get(stockKey(moving)), fixedOffsets = offsets.get(stockKey(fixed));
    const movingPositions = movingRows.map((row, i) => row.positionMm + movingOffsets[i]);
    const fixedPositions = fixedRows.map((row, i) => row.positionMm + fixedOffsets[i]);
    const planned = layoutBeamContactLapPair({ fixedPositionsMm: fixedPositions, movingPositionsMm: movingPositions,
      fixedDbMm: diameter(fixed), movingDbMm: diameter(moving),
      fixedDepthsMm: fixedRows.map(row => row.depthMm), movingDepthsMm: movingRows.map(row => row.depthMm),
      boundsMm: [Math.min(...movingRows.map(row => row.positionMm)), Math.max(...movingRows.map(row => row.positionMm))] });
    if (!planned.current) { unresolved.push({ runId: transition.runId, face: transition.face, nodeId: transition.nodeId }); continue; }
    offsets.set(stockKey(moving), movingOffsets.map((offset, i) => offset + planned.offsetsMm[i]));
    if (planned.offsetsMm.some(offset => Math.abs(offset) > EPS)) translated.push({ runId: transition.runId,
      face: transition.face, nodeId: transition.nodeId, movingStockKey: stockKey(moving), offsetsMm: planned.offsetsMm });
  }
  for (const stock of stocks) for (const memberId of stock.memberIds) {
    const member = byId.get(memberId), detail = member?.rebarDetailing?.beam;
    if (!detail) continue;
    const rows = rowsFor(stock, memberId), globalOffsets = offsets.get(stockKey(stock));
    const localOffsets = new Array(rows.length).fill(0);
    rows.forEach((row, i) => { localOffsets[row.localIndex] = row.sign * globalOffsets[i]; });
    detail.contactLapTranslationsMm ||= {};
    detail.contactLapTranslationsMm[stock.face] = localOffsets;
    for (const end of detail.ends || []) {
      const face = end.context?.jointLayout?.faces?.[stock.face];
      if (!face) continue;
      face.contactLapPartner = partnerKeys.has(stockKey(stock));
      face.contactLapOffsetsMm = localOffsets;
      face.drawnPositionsMm = face.positionsMm.map((position, i) => position + localOffsets[i]);
      const minimum = face.drawnPositionsMm.length > 1 ? Math.min(...face.drawnPositionsMm.slice(1)
        .map((position, i) => position - face.drawnPositionsMm[i] - face.dbMm)) : null;
      face.minimumClearMm = minimum;
      face.narrow ||= !face.drawnPositionsMm.length || (minimum !== null && minimum < face.requiredClearMm - EPS);
      if (face.narrow) {
        const joint = end.context.jointLayout;
        joint.note = `หัวเสา ${joint.columnMark} แคบสำหรับเหล็กคาน ${joint.barCount} เส้น · แนะนำเสา 25 ซม. หรือใช้เหล็กเส้นใหญ่ขึ้นจำนวนน้อยลง`;
      }
    }
  }
  return { current: unresolved.length === 0, translated, unresolved };
}
