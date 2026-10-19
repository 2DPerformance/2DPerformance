// Presentation only: never changes member records or engineering evidence.
export function normalizeMemberLabelMode(value) {
  if (value === 'hidden' || value === 'none' || value === 'off') return 'hidden';
  if (value === 'full' || value === 'all') return 'full';
  return 'marks';
}

export function memberLabelStatus(text) {
  const value = String(text || '');
  if (/HOLD|รออนุมัติ|รอข้อมูล|ไม่ครบ/i.test(value)) return 'HOLD';
  if (/REVIEW|REFERENCE|NON_STRUCTURAL/i.test(value)) return 'REVIEW';
  return '';
}

export function memberPresentationMark(row, fallback = '') {
  return [row?.presentationMark, row?.scheduleMark, row?.mark, row?.segmentMark, fallback]
    .map(value => String(value || '').trim()).find(value => value && !/[:…]/.test(value)) || '';
}

export function roofMemberPresentationMark(row, index) {
  return memberPresentationMark(row, `RF${index + 1}`);
}

export function compactMemberLabelMark(mark) {
  const value = String(mark || '').trim();
  // Historical roof IDs end in the same one-based member number.
  return /[:…]/.test(value) ? `RF${value.match(/(\d+)$/)?.[1] || ''}` : value;
}

export function displayMemberLabelMark(mark, mode) {
  return compactMemberLabelMark(mark);
}

export function clusterHoldMemberLabels(candidates, { distance = 24 } = {}) {
  const rows = candidates.map(row => ({ ...row }));
  const eligible = row => row.roof && row.status === 'HOLD' && !row.selected && !row.hovered && /^(.*?)(\d+)$/.test(row.mark);
  const visited = new Set();
  for (const first of rows) {
    if (visited.has(first) || !eligible(first)) continue;
    const prefix = first.mark.match(/^(.*?)(\d+)$/)[1];
    const group = [first]; visited.add(first);
    for (let index = 0; index < group.length; index++) {
      const near = group[index];
      for (const row of rows) {
        if (visited.has(row) || !eligible(row) || (row.holdCode || '') !== (first.holdCode || '')
          || row.mark.match(/^(.*?)(\d+)$/)[1] !== prefix) continue;
        if (Math.hypot(row.x - near.x, row.y - near.y) <= distance) { group.push(row); visited.add(row); }
      }
    }
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => Number(a.mark.match(/(\d+)$/)[1]) - Number(b.mark.match(/(\d+)$/)[1]));
    const ranges = [];
    for (let index = 0; index < sorted.length;) {
      const start = sorted[index]; let end = start; index++;
      while (index < sorted.length && Number(sorted[index].mark.match(/(\d+)$/)[1]) === Number(end.mark.match(/(\d+)$/)[1]) + 1) end = sorted[index++];
      ranges.push(start === end ? start.mark : `${start.mark}–${end.mark}`);
    }
    first.clusterMark = ranges.join(', ');
    first.clusterIds = sorted.map(row => row.memberId || row.id);
    first.clusterMarks = sorted.map(row => row.mark);
    const bounds = group.map(row => row.geometryBounds).filter(Boolean);
    if (bounds.length) {
      const x = Math.min(...bounds.map(box => box.x)), y = Math.min(...bounds.map(box => box.y));
      first.geometryBounds = { x, y,
        width: Math.max(...bounds.map(box => box.x + box.width)) - x,
        height: Math.max(...bounds.map(box => box.y + box.height)) - y };
    }
    group.slice(1).forEach(row => { row.clustered = true; });
  }
  return rows;
}

export function visibleMemberLabelCount(mode, total, compactCount) {
  const normalized = normalizeMemberLabelMode(mode);
  return normalized === 'hidden' ? 0 : normalized === 'full' ? total : Math.min(total, compactCount);
}

const overlaps = (a, b, gap = 0) => a.x < b.x + b.width + gap
  && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap
  && a.y + a.height + gap > b.y;

export function placeMemberLabelPills(candidates, { width, height, gap = 4 } = {}) {
  const placed = [];
  const ordered = [...candidates].sort((a, b) => Number(Boolean(b.selected)) - Number(Boolean(a.selected))
    || Number(Boolean(b.hovered)) - Number(Boolean(a.hovered))
    || (a.depth ?? 0) - (b.depth ?? 0) || String(a.id).localeCompare(String(b.id)));
  return ordered.map(item => {
    const geometry = item.geometryBounds;
    const w = item.width; const h = item.height;
    const anchors = geometry ? [
      [geometry.x + geometry.width + gap + 2, item.y - h / 2],
      [geometry.x - w - gap - 2, item.y - h / 2],
      [item.x - w / 2, geometry.y - h - gap - 2],
      [item.x - w / 2, geometry.y + geometry.height + gap + 2],
    ] : [[item.x + 10, item.y - h - 10], [item.x - w - 10, item.y - h - 10]];
    // A selected card can use a clear viewport edge when its member spans the view.
    if (item.selected || item.hovered || item.clusterIds?.length > 1) anchors.push([8, 8], [width - w - 8, 8], [8, height - h - 8]);
    for (const [x, y] of anchors) {
      const box = { x, y, width: w, height: h };
      if (x < 4 || y < 4 || x + w > width - 4 || y + h > height - 4) continue;
      if (geometry && overlaps(box, geometry, 2)) continue;
      if (placed.some(previous => overlaps(box, previous, gap))) continue;
      placed.push(box);
      return { ...item, ...box, visible: true };
    }
    return { ...item, visible: false };
  });
}
