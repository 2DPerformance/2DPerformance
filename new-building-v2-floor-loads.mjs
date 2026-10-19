/** P2 floor input catalogue. LL minima are transcribed from the repository's
 * recoveredRuntimeFactory.mjs rules; SDL values are Owner-selected finish
 * allowances, not statutory LL values. All loads use kgf/m² (UI: กก./ม²).
 */
export const FLOOR_LOAD_CLAUSE = 'กฎกระทรวงกำหนดการออกแบบโครงสร้างอาคาร และลักษณะและคุณสมบัติของวัสดุที่ใช้ในงานโครงสร้างอาคาร พ.ศ. 2566 ข้อ 11';
export const FLOOR_LOAD_SOURCE_URL = 'https://download.asa.or.th/03media/04law/fubr/a10.3_bcmr70h-66.pdf';
export const FLOOR_RESIDENTIAL_MIN_LL = 200;
export const FLOOR_BELOW_RESIDENTIAL_MIN_MESSAGE = 'ต่ำกว่าค่าขั้นต่ำบ้านพักอาศัย 200 กก./ม² · ตรวจประเภทการใช้งาน';
const preset = (key, label, llKgm2, ruleIds, clause = FLOOR_LOAD_CLAUSE) => Object.freeze({ key, label, llKgm2, ruleIds: Object.freeze(ruleIds), clause });
export const FLOOR_LOAD_PRESETS = Object.freeze([
  preset('residential', 'บ้านพักอาศัย ห้องต่างๆ/ห้องน้ำ', 200, ['STR-LL-002']),
  preset('residential-balcony-stair', 'ระเบียง/บันไดบ้าน', 200, ['STR-LL-002', 'STR-STR-004']),
  preset('roof-deck', 'ดาดฟ้า', 200, ['STR-LL-017'], `${FLOOR_LOAD_CLAUSE} กลุ่มอื่นๆ (7) ดาดฟ้า`),
  preset('concrete-canopy', 'กันสาดคอนกรีต', 100, ['STR-CNT-002'], `${FLOOR_LOAD_CLAUSE} กลุ่มอื่นๆ (6) กันสาดคอนกรีต`),
  preset('car-park', 'ที่จอดรถยนต์นั่ง ≤7 ที่นั่ง/จักรยานยนต์', 300, ['STR-LL-009']),
  preset('shophouse-residential', 'ตึกแถวส่วนพักอาศัย', 200, ['STR-LL-014']),
  preset('shophouse-commercial', 'ตึกแถวส่วนพาณิชย์', 300, ['STR-LL-014']),
  preset('office', 'สำนักงาน', 250, ['STR-LL-004']),
  preset('office-shophouse-stair-walkway', 'บันได/ทางเดิน ตึกแถว/สำนักงาน', 300, ['STR-LL-004', 'STR-LL-014', 'STR-STR-004']),
  preset('retail', 'ร้านค้าปลีก', 400, ['STR-LL-014']),
  preset('storage', 'ห้องเก็บของ', 500, ['STR-LL-003', 'STR-LL-004', 'STR-LL-007', 'STR-LL-014']),
  preset('custom', 'ค่าที่ผู้ใช้กำหนด', null, [], null),
]);
const finish = (key, label, sdlKgm2) => Object.freeze({ key, label, sdlKgm2,
  basis: sdlKgm2 === null ? 'น้ำหนักวัสดุปูพื้นตามที่ผู้ใช้กำหนด' : `ค่าประมาณน้ำหนักวัสดุปูพื้น ${label} ${sdlKgm2} กก./ม² ตามชุดค่าที่ Owner เลือก 2026-10-16; ผู้ใช้ตรวจตามวัสดุจริง ไม่ใช่ค่าขั้นต่ำตามกฎหมาย` });
export const FLOOR_FINISH_PRESETS = Object.freeze([
  Object.freeze({ ...finish('tile-screed', 'กระเบื้อง+ปูนทราย', 120), basis: 'น้ำหนักวัสดุปูพื้น ปูนทรายหนา 5 ซม. ≈ 105 + กระเบื้อง ≈ 15 = 120 กก./ม² · ไม่รวมฝ้า/งานระบบ · ผู้ใช้ตรวจตามวัสดุจริง ไม่ใช่ค่าขั้นต่ำตามกฎหมาย' }),
  finish('laminate-wood', 'ลามิเนต/ไม้', 50),
  finish('bare', 'ไม่มีผิว', 0),
  finish('custom', 'กำหนดเอง', null),
]);
export const FLOOR_WITHOUT_PANELS_MESSAGE = 'ชั้นนี้ยังไม่มีแผ่นพื้นในแปลน · ถ้าพื้นวางบนคาน ให้วาดพื้นที่ P1 · ถ้าพื้นวางบนดิน น้ำหนักพื้นลงดินโดยตรง ไม่ส่งเข้าคาน';

const text = value => String(value ?? '').trim();
const number = value => value === null || value === undefined || text(value) === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export const getFloorLoadPreset = key => FLOOR_LOAD_PRESETS.find(item => item.key === text(key)) || null;
export const getFloorFinishPreset = key => FLOOR_FINISH_PRESETS.find(item => item.key === text(key)) || null;
export function getFloorLoadSourceLabel(presetKey, source = 'panel-assignment') {
  if (source === 'level-default') return 'ค่าเริ่มต้นของชั้น (P2)';
  if (source === 'p1-override') return 'ค่าเฉพาะผืนจาก P1';
  const selected = getFloorLoadPreset(presetKey);
  return selected?.clause ? `${selected.clause} (${selected.ruleIds.join(', ')})` : 'ค่าที่ผู้ใช้กำหนด';
}
export function validateFloorLiveLoad(value, { minimumLlKgm2 = null, belowMinimumConfirmed = false } = {}) {
  const llKgm2 = number(value);
  const requiresBelowMinimumConfirmation = minimumLlKgm2 === null && llKgm2 > 0 && llKgm2 < FLOOR_RESIDENTIAL_MIN_LL;
  const warning = requiresBelowMinimumConfirmation ? FLOOR_BELOW_RESIDENTIAL_MIN_MESSAGE : '';
  const error = llKgm2 === null || llKgm2 <= 0 ? 'ใส่ LL เป็นตัวเลขมากกว่า 0 กก./ม²'
    : minimumLlKgm2 !== null && llKgm2 < minimumLlKgm2 ? `ต่ำกว่าค่ากฎหมาย ${minimumLlKgm2} กก./ม²`
      : requiresBelowMinimumConfirmation && belowMinimumConfirmed !== true ? warning : '';
  return { valid: !error, llKgm2, error, errors: error ? [error] : [], warning, requiresBelowMinimumConfirmation };
}
export function getFloorFinishSourceNote(key, actualSdlKgm2) {
  const selected = getFloorFinishPreset(key);
  const actual = number(actualSdlKgm2);
  const basis = selected?.basis || 'SDL ตามวัสดุจริงที่ผู้ใช้กำหนด';
  if (actual === null) return basis;
  const adjustment = selected?.sdlKgm2 != null && actual !== selected.sdlKgm2
    ? ` · ผู้ใช้ปรับจากค่าผิวสำเร็จ ${selected.sdlKgm2} กก./ม²`
    : '';
  return `${basis} · SDL ที่กำหนดจริง ${actual} กก./ม²${adjustment}`;
}

/** Keep invalid numeric input as null so confirmation can reject it. */
export function normalizeFloorLoadAssignments(rows) {
  const byId = new Map();
  for (const row of (Array.isArray(rows) ? rows : [])) {
    const slabId = text(row?.slabId);
    if (!slabId) continue;
    byId.set(slabId, { slabId, presetKey: text(row.presetKey) || 'custom', llKgm2: number(row.llKgm2), sdlKgm2: number(row.sdlKgm2),
      ...(Object.hasOwn(row, 'sdlPresetKey') ? { sdlPresetKey: text(row.sdlPresetKey) } : {}),
      ...(row.belowMinimumConfirmed === true ? { belowMinimumConfirmed: true } : {}),
      ...(Object.hasOwn(row, 'sourceNote') ? { sourceNote: text(row.sourceNote) } : {}) });
  }
  return [...byId.values()].sort((a, b) => a.slabId.localeCompare(b.slabId));
}

export function validateFloorLoadAssignment(input = {}, { slabKind } = {}) {
  const assignment = { slabId: text(input.slabId), presetKey: text(input.presetKey) || 'custom', llKgm2: number(input.llKgm2), sdlKgm2: number(input.sdlKgm2) };
  if (input.belowMinimumConfirmed === true) assignment.belowMinimumConfirmed = true;
  const selected = getFloorLoadPreset(assignment.presetKey);
  const errors = [];
  const fieldErrors = {};
  if (!selected) fieldErrors.presetKey = 'เลือกประเภทการใช้งานพื้น';
  const liveCheck = validateFloorLiveLoad(assignment.llKgm2, { minimumLlKgm2: selected?.llKgm2 ?? null, belowMinimumConfirmed: input.belowMinimumConfirmed });
  if (!liveCheck.valid) fieldErrors.llKgm2 = liveCheck.error;
  if (selected?.key === 'concrete-canopy' && slabKind !== undefined && !['CS', 'cantilever', 'cantilever-slab'].includes(slabKind)) fieldErrors.presetKey = 'กันสาดคอนกรีตใช้ได้เฉพาะพื้นยื่น';
  if (assignment.sdlKgm2 === null || assignment.sdlKgm2 < 0) fieldErrors.sdlKgm2 = 'ใส่ SDL เป็นตัวเลขตั้งแต่ 0 กก./ม²';
  errors.push(...Object.values(fieldErrors));
  return { valid: errors.length === 0, errors, fieldErrors, warning: liveCheck.warning, requiresBelowMinimumConfirmation: liveCheck.requiresBelowMinimumConfirmation, minLlKgm2: selected?.llKgm2 ?? null, assignment, preset: selected };
}

const slabId = slab => text(slab?.id ?? slab?.slabId);
const slabLevel = slab => text(slab?.level ?? slab?.levelId);
function ringOf(slab, nodes) {
  const points = slab?.pointsM || slab?.points || slab?.polygon || (slab?.nodeIds || []).map(id => nodes?.[id]);
  return Array.isArray(points) && points.length >= 3 && points.every(p => p && Number.isFinite(p.x) && Number.isFinite(p.y)) ? points : [];
}
const areaOf = ring => Math.abs(ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - q.x * p.y; }, 0)) / 2;
function inside(point, ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j]; const b = ring[i];
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (Math.abs(cross) <= 1e-8 && point.x >= Math.min(a.x, b.x) - 1e-8 && point.x <= Math.max(a.x, b.x) + 1e-8 && point.y >= Math.min(a.y, b.y) - 1e-8 && point.y <= Math.max(a.y, b.y) + 1e-8) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}
function crosses(a, b, c, d) {
  const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return orient(a, b, c) * orient(a, b, d) < -1e-12 && orient(c, d, a) * orient(c, d, b) < -1e-12;
}
function contained(child, parent) {
  return child.length >= 3 && child.every((p, i) => {
    const q = child[(i + 1) % child.length];
    return inside(p, parent) && inside({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, parent)
      && !parent.some((a, j) => crosses(p, q, a, parent[(j + 1) % parent.length]));
  });
}
function interiorsOverlap(a, b) {
  // A strict interior sample includes edge midpoints: split siblings may share
  // edges/vertices, but overlapping replacement panels must never inherit.
  const strict = (p, ring) => inside(p, ring) && !ring.some((v, i) => {
    const w = ring[(i + 1) % ring.length];
    return Math.abs((p.x - v.x) * (w.y - v.y) - (p.y - v.y) * (w.x - v.x)) <= 1e-8
      && p.x >= Math.min(v.x, w.x) - 1e-8 && p.x <= Math.max(v.x, w.x) + 1e-8
      && p.y >= Math.min(v.y, w.y) - 1e-8 && p.y <= Math.max(v.y, w.y) + 1e-8;
  });
  const inwardSamples = ring => {
    const signedArea = ring.reduce((sum, p, i) => { const q = ring[(i + 1) % ring.length]; return sum + p.x * q.y - q.x * p.y; }, 0);
    return ring.map((p, i) => {
      const q = ring[(i + 1) % ring.length]; const direction = Math.sign(signedArea) * 1e-5;
      return { x: (p.x + q.x) / 2 - (q.y - p.y) * direction, y: (p.y + q.y) / 2 + (q.x - p.x) * direction };
    }).filter(p => strict(p, ring));
  };
  return inwardSamples(a).some(p => strict(p, b)) || inwardSamples(b).some(p => strict(p, a)) || a.some((p, i) => {
    const q = a[(i + 1) % a.length];
    return strict(p, b) || strict({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, b)
      || b.some((r, j) => crosses(p, q, r, b[(j + 1) % b.length]));
  }) || b.some((p, i) => strict(p, a) || strict({ x: (p.x + b[(i + 1) % b.length].x) / 2, y: (p.y + b[(i + 1) % b.length].y) / 2 }, a));
}

/** Reconcile only a supplied level's slabs. Missing arrays remain empty; this
 * helper never inserts fields into old P2 records. Explicit split lineage is
 * preferred; geometric inheritance requires a complete non-overlapping split.
 */
export function reconcileFloorLoadAssignments(rows, slabs = [], previousSlabs = [], { nodes = {}, previousNodes = nodes } = {}) {
  const normalized = normalizeFloorLoadAssignments(rows);
  const current = (Array.isArray(slabs) ? slabs : []).filter(slab => slabId(slab));
  const currentById = new Map(current.map(slab => [slabId(slab), slab]));
  const oldById = new Map((Array.isArray(previousSlabs) ? previousSlabs : []).map(slab => [slabId(slab), slab]));
  const result = new Map(normalized.filter(row => currentById.has(row.slabId)).map(row => [row.slabId, row]));
  const droppedSlabIds = []; const inheritedSlabIds = [];
  for (const row of normalized) {
    if (currentById.has(row.slabId)) continue;
    const old = oldById.get(row.slabId);
    const sameLevel = current.filter(slab => !old || slabLevel(slab) === slabLevel(old));
    const eligible = sameLevel.filter(slab => !result.has(slabId(slab)));
    let children = eligible.filter(slab => text(slab.parentSlabId ?? slab.splitFromSlabId ?? slab.slabSplit?.originalId) === row.slabId);
    if (!children.length && old) {
      const parentRing = ringOf(old, previousNodes); const parentArea = areaOf(parentRing);
      const candidates = sameLevel.map(slab => ({ slab, ring: ringOf(slab, nodes) })).filter(item => contained(item.ring, parentRing));
      if (parentArea > 1e-8 && candidates.length >= 2
        && Math.abs(candidates.reduce((sum, item) => sum + areaOf(item.ring), 0) - parentArea) <= Math.max(1e-8, parentArea * 1e-8)
        && !candidates.some((item, i) => candidates.slice(i + 1).some(other => interiorsOverlap(item.ring, other.ring)))) children = candidates.map(item => item.slab);
    }
    if (!children.length) droppedSlabIds.push(row.slabId);
    for (const child of children) {
      const id = slabId(child);
      if (!result.has(id)) { result.set(id, { ...row, slabId: id }); inheritedSlabIds.push(id); }
    }
  }
  const message = droppedSlabIds.length ? `ล้างค่าน้ำหนักพื้น ${droppedSlabIds.length} รายการ เนื่องจากแผ่นพื้นเดิมไม่มีในแปลนแล้ว` : '';
  return { assignments: [...result.values()].sort((a, b) => a.slabId.localeCompare(b.slabId)), droppedSlabIds, inheritedSlabIds, message };
}
