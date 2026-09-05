import { buildSnapIndex, findSnap, validatePolyline, offsetPolyline, pitGeometry, placePitAtAnchor, fitPitToBounds, quickTrimExtendSegments } from './new-building-v2-cad-geometry.js?v=20260905-cumulative-v1';
import { LIFT_ASSEMBLY_FIELDS, liftAssemblyGeometry, liftAssemblyFromDrawingElement, createLiftAssemblyDrawingElement, moveLiftAssemblyDrawingElement } from './new-building-v2-lift-assembly.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const TOOL_KINDS = new Set(['cad', 'lift-pit', 'shaft-outline', 'lift-assembly']);
const ELEMENT_KINDS = new Set(['cad-draft', 'lift-pit', 'shaft-outline', 'lift-assembly']);
const MARK_PREFIXES = Object.freeze({ 'cad-draft': 'CAD', 'lift-pit': 'PIT', 'shaft-outline': 'SHAFT', 'lift-assembly': 'LIFT' });
const PIT_FIELDS = ['innerWidthM', 'innerLengthM', 'depthM', 'wallThicknessM', 'baseThicknessM', 'rimElevationM', 'rotationDeg'];
const AUTHORITY = Object.freeze({ authority: 'DRAWING_INPUT_ENGINE_0', engineeringStatus: 'not_evaluated', analysisInclusion: 'excluded', constructionAuthorized: false, engineRecords: 0 });
const PIT_WARNING_NOTE = 'ยังไม่ประเมินโครงสร้างหรือรับรองว่าปลอดภัย · ไม่ตัดพื้นหรือลบคานอัตโนมัติ';
const SNAP_SYMBOLS = Object.freeze({
  endpoint: { label: 'ปลายเส้น', path: 'M-5,-5 H5 V5 H-5 Z' },
  midpoint: { label: 'กึ่งกลาง', path: 'M0,-6 L6,5 H-6 Z' },
  intersection: { label: 'จุดตัด', path: 'M-5,-5 L5,5 M-5,5 L5,-5' },
  perpendicular: { label: 'ตั้งฉาก', path: 'M-6,-6 V6 H6 M-6,1 H-1 V6' },
  nearest: { label: 'บนแนว', path: 'M-5,-5 H5 L-5,5 H5 Z' },
  grid: { label: 'บนแนว Grid', path: 'M-3,-6 V6 M3,-6 V6 M-6,-3 H6 M-6,3 H6' },
  node: { label: 'จุดอ้างอิง', path: 'M-6,0 H6 M0,-6 V6 M4,0 A4,4 0 1,0 -4,0 A4,4 0 1,0 4,0' },
  free: { label: 'ตำแหน่งอิสระ', path: 'M-5,0 H5 M0,-5 V5' }
});
const copyPoint = point => ({ x: point.x, y: point.y });
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const newId = prefix => `${prefix}${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
const fail = reason => ({ ok: false, reason });

export function nextCadDrawingMark(elements, kind, levelId) {
  const prefix = MARK_PREFIXES[kind];
  if (!prefix) return '';
  const used = new Set((Array.isArray(elements) ? elements : [])
    // Full-height assemblies appear on several levels, so their marks share a
    // project-wide registry. Existing single-level drawing kinds stay unchanged.
    .filter(element => element?.kind === kind && (kind === 'lift-assembly' || element.level === levelId))
    .map(element => String(element.mark || '').trim().toUpperCase()));
  let sequence = 1;
  while (used.has(`${prefix}${sequence}`)) sequence += 1;
  return `${prefix}${sequence}`;
}

export function parseCadCommand(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (!text) return { kind: 'finish' };
  if (['L', 'PL', 'PE', 'M', 'CO', 'O', 'E', 'TR', 'EX', 'B', 'BEAM', 'COL', 'COLUMN', 'LIFT'].includes(text)) return { kind: 'command', command: ({ BEAM: 'B', COLUMN: 'COL' })[text] || text };
  const match = text.match(/^@?([+]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*<\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)))?$/);
  if (!match) return { kind: 'invalid' };
  const distanceM = Number(match[1]), angleDeg = match[2] === undefined ? null : Number(match[2]);
  return Number.isFinite(distanceM) && distanceM > 0 && (angleDeg === null || Number.isFinite(angleDeg)) ? { kind: 'distance', distanceM, angleDeg } : { kind: 'invalid' };
}

export function createCadDrawingElement({ id, levelId, points, closed = false, shaft = false, mark, elevationM }) {
  const checked = validatePolyline(points, { closed: shaft || closed });
  if (!checked.ok) return checked;
  if (!String(levelId || '').trim() || !Number.isFinite(elevationM)) return fail('LEVEL_REQUIRED');
  const prefix = shaft ? 'DOE-SHAFT-' : 'DOE-CAD-';
  const stableId = id || newId(prefix);
  return { ok: true, element: { ...AUTHORITY, id: stableId, kind: shaft ? 'shaft-outline' : 'cad-draft', level: levelId, mark: mark || (shaft ? 'SHAFT' : 'CAD'), label: shaft ? 'แนวช่องปล่อง · ENGINE 0' : 'เส้นร่าง CAD · ENGINE 0', pointsM: checked.points, cadGeometryInput: { schema: 'P1-CAD-GEOMETRY-INPUT-V1', geometryType: checked.points.length === 2 && !closed && !shaft ? 'LINE' : 'POLYLINE', closed: shaft || closed, elevationM } } };
}

export function pitFromDrawingElement(element) {
  const input = element?.liftPitGeometryInput;
  if (!input) return null;
  return { id: element.id, levelId: element.level, center: { x: input.centerXM, y: input.centerYM }, ...Object.fromEntries(PIT_FIELDS.map(key => [key, input[key]])) };
}

export function createPitDrawingElement(pit, { id, mark } = {}) {
  const geometry = pitGeometry(pit);
  if (!geometry.ok) return geometry;
  if (!String(pit.levelId || '').trim()) return fail('LEVEL_REQUIRED');
  const stableId = id || pit.id || newId('DOE-PIT-');
  return { ok: true, element: { ...AUTHORITY, id: stableId, kind: 'lift-pit', level: pit.levelId, mark: mark || 'PIT', label: 'หลุมลิฟท์ · ENGINE 0', pointsM: geometry.outerPolygon, liftPitGeometryInput: { schema: 'P1-LIFT-PIT-GEOMETRY-INPUT-V1', centerXM: pit.center.x, centerYM: pit.center.y, ...Object.fromEntries(PIT_FIELDS.map(key => [key, pit[key]])) } } };
}

export function moveCadDrawingElement(element, delta, { copy = false, id } = {}) {
  if (!ELEMENT_KINDS.has(element?.kind) || !finitePoint(delta)) return fail('INVALID_MOVE');
  if (element.kind === 'lift-assembly') return moveLiftAssemblyDrawingElement(element, delta, { copy, id: copy ? id || newId('DOE-LIFT-') : id });
  if (element.kind === 'lift-pit') {
    const pit = pitFromDrawingElement(element);
    if (!pit || !finitePoint(pit.center)) return fail('INVALID_PIT');
    pit.center = { x: pit.center.x + delta.x, y: pit.center.y + delta.y };
    if (copy) pit.id = id || newId('DOE-PIT-');
    return createPitDrawingElement(pit, { mark: element.mark });
  }
  if (!Array.isArray(element.pointsM)) return fail('INVALID_POINTS');
  return createCadDrawingElement({ id: copy ? id || newId(element.kind === 'shaft-outline' ? 'DOE-SHAFT-' : 'DOE-CAD-') : element.id, levelId: element.level, points: element.pointsM.map(point => ({ x: point.x + delta.x, y: point.y + delta.y })), closed: element.cadGeometryInput?.closed === true, shaft: element.kind === 'shaft-outline', mark: element.mark, elevationM: element.cadGeometryInput?.elevationM });
}

/** Model writes occur only through typed committing callbacks.
 * Pointer previews never invoke a committing callback. */
export function mountCadWorkbench(options) {
  const { svg, inspectorBody, getModel, getLevelId, getLevelElevation, getActiveTool, pointFromEvent, pointToSvg, getSnapSources, getClosedBoundaries, commitElements, convertDraft, toast } = options;
  const backgroundEditing = options.backgroundEditing === true;
  const getPitWarnings = typeof options.getPitWarnings === 'function' ? options.getPitWarnings : () => [];
  if (!svg || !inspectorBody) throw new Error('CAD workbench requires existing SVG and inspector');
  const doc = svg.ownerDocument;
  const view = doc.defaultView;
  if (!svg.hasAttribute?.('tabindex')) svg.setAttribute('tabindex', '0');
  const requestFrame = view.requestAnimationFrame.bind(view);
  let destroyed = false;
  let passiveSnapLayer = null, passiveSnapKey = '';
  const state = { tool: '', mode: 'select', selectedId: '', vertices: [], basePoint: null, vertexIndex: null, ghostPoint: null, ghostSnap: null, pendingPit: null, fitPreview: null, gestureModel: null, gestureLevel: null, snapModel: null, snapLevel: null, snapSelection: '', snapIndex: null, lastModel: null, lastLevel: null, panel: null, layer: null, objectsLayer: null, ghostLayer: null, raf: 0, pointerEvent: null, status: 'เลือกคำสั่ง แล้วคลิกตำแหน่งในแปลน', form: { command: '', length: '', angle: '', offset: '', side: 'left', closed: false, ortho: false, widthM: '', depthM: '', thicknessM: '', elevationM: '', convertKind: 'beam', boundaryId: '', fitBasis: 'outer', anchor: 'outer-min', mark: '' }, pitForm: Object.fromEntries(PIT_FIELDS.map(key => [key, key === 'rotationDeg' ? '0' : ''])), enabled: { endpoint: true, midpoint: true, intersection: true, nearest: true, perpendicular: true } };
  let pitWarningCache = null;
  let pitWarningOutput = null;
  Object.assign(state, { commandBuffer: '', snapEnabled: true, lastPlanPointer: null, memberPointer: null, memberFormSnapshot: null, pointerEpoch: 0, commandLayer: null });
  Object.assign(state, { liftForm: Object.fromEntries(LIFT_ASSEMBLY_FIELDS.map(key => [key, ''])), liftLevels: [], pendingLift: null, liftFit: null, openingPreview: null, openingLevels: [], gestureLevels: null, snapLevels: null, selectedLiftRecordKey: null });
  Object.assign(state, { editBoundary: null, editPreview: null, erasePreview: null, lastEditCommand: '' });
  const memberForms = {
    beam: { widthM: '', depthM: '', baseElevationM: '', topElevationM: '' },
    column: { widthM: '', depthM: '', baseElevationM: '', topElevationM: '' }
  };
  const memberKind = () => ({ B: 'beam', COL: 'column' })[state.mode] || null;
  const keyboardAllowed = () => typeof options.canUseKeyboard === 'function' ? options.canUseKeyboard() === true : active();
  const allElements = () => Array.isArray(getModel()?.drawingOnlyElements) ? getModel().drawingOnlyElements : [];
  const getLevels = () => typeof options.getLevels === 'function' ? options.getLevels() || [] : [];
  const levelsKey = () => JSON.stringify(getLevels());
  const liftRecordKey = element => {
    if (element?.kind !== 'lift-assembly') return null;
    const input = element.liftAssemblyGeometryInput;
    return JSON.stringify([element.id, element.level, ...LIFT_ASSEMBLY_FIELDS.map(key => input?.[key]),
      Array.isArray(input?.servedLevels) ? input.servedLevels.map(level => [level.levelId, level.elevationM]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))) : null]);
  };
  function currentLiftGeometry(element) {
    const geometry = liftAssemblyFromDrawingElement(element);
    if (!geometry.ok) return geometry;
    const levels = getLevels();
    for (const saved of geometry.input.servedLevels) {
      const matches = levels.filter(level => level.id === saved.levelId);
      if (matches.length !== 1 || !Number.isFinite(matches[0].elevationM) || matches[0].elevationM !== saved.elevationM) return fail(`LIFT_SERVED_LEVEL_STALE:${saved.levelId}`);
    }
    return geometry;
  }
  const visibleElements = () => allElements().filter(element => {
    if (!ELEMENT_KINDS.has(element.kind)) return false;
    if (element.kind !== 'lift-assembly') return element.level === getLevelId();
    const input = element.liftAssemblyGeometryInput, elevation = getLevelElevation();
    return element.level === getLevelId() || input?.servedLevels?.some(level => level.levelId === getLevelId()) || (Number.isFinite(elevation) && input && elevation >= input.rimElevationM - input.depthM - input.baseThicknessM && elevation <= input.shaftTopElevationM);
  });
  const editableMembers = () => {
    if ((getActiveTool() !== 'cad' && !(backgroundEditing && getActiveTool() === 'select')) || typeof options.getEditableMembers !== 'function') return [];
    const items = options.getEditableMembers({ lineEdit: editMode() });
    return Array.isArray(items) ? items.filter(item => item && !ELEMENT_KINDS.has(item.kind) && typeof item.id === 'string' && Array.isArray(item.pointsM) && item.pointsM.length && item.pointsM.every(finitePoint)).map(item => ({ ...item, __cadEditableMember: true })) : [];
  };
  const selectableElements = () => [...visibleElements(), ...editableMembers()];
  // Selection is read afresh at every command/commit boundary. An empty
  // selection (the usual pointer-preview path) needs no native member catalog.
  const selected = () => {
    const ids = backgroundEditing && getActiveTool() === 'select' ? options.getNativeSelectionIds?.() : null;
    const id = Array.isArray(ids) ? ids.length === 1 ? ids[0] : '' : state.selectedId;
    return !id ? null : visibleElements().find(element => element.id === id) || editableMembers().find(element => element.id === id) || null;
  };
  let snapSourceKinds = new Map();
  const editMode = () => ['E', 'TR', 'EX'].includes(state.mode);
  const backgroundNativeContext = () => backgroundEditing && !TOOL_KINDS.has(getActiveTool());
  const active = () => TOOL_KINDS.has(getActiveTool()) || (backgroundEditing && getActiveTool() === 'select' && editMode());
  const snapControlsHost = options.snapControlsHost;
  let snapSwitch = null, snapSwitchState = null;
  if (snapControlsHost && !backgroundEditing) {
    // Native HTML, outside SVG's capture handlers and zoomed coordinate system.
    // Keep this node stable so Space/Enter activation and keyboard focus survive.
    snapSwitch = doc.createElement('button');
    snapSwitch.setAttribute('type', 'button');
    snapSwitch.setAttribute('role', 'switch');
    snapSwitch.setAttribute('aria-label', 'CAD Snap');
    snapSwitch.setAttribute('data-cad-snap-switch', '');
    snapSwitch.setAttribute('title', 'เปิด/ปิด CAD Snap · F3 เมื่อโฟกัสแปลน · กด Alt ค้างเพื่อข้าม Snap ชั่วคราว');
    const label = doc.createElement('span'); label.textContent = 'CAD Snap';
    const track = doc.createElement('span'); track.className = 'cad-snap-track'; track.setAttribute('aria-hidden', 'true');
    const thumb = doc.createElement('span'); thumb.className = 'cad-snap-thumb'; track.append(thumb);
    snapSwitchState = doc.createElement('span'); snapSwitchState.className = 'cad-snap-state'; snapSwitchState.setAttribute('aria-hidden', 'true');
    const shortcut = doc.createElement('kbd'); shortcut.textContent = 'F3'; shortcut.setAttribute('aria-hidden', 'true');
    snapSwitch.append(label, track, snapSwitchState, shortcut);
    snapSwitch.addEventListener('click', event => {
      if (active() && keyboardAllowed()) setSnapEnabled(!state.snapEnabled, event);
    });
    snapControlsHost.append(snapSwitch);
  }
  function renderSnapControls() {
    if (snapControlsHost) snapControlsHost.hidden = backgroundEditing || !active();
    if (snapSwitch) {
      snapSwitch.disabled = !keyboardAllowed();
      snapSwitch.setAttribute('aria-checked', String(state.snapEnabled));
      snapSwitchState.textContent = state.snapEnabled ? 'ON' : 'OFF';
    }
    const checkbox = state.panel?.querySelector('[data-cad-snap-toggle]');
    if (checkbox) checkbox.checked = state.snapEnabled;
    const summary = state.panel?.querySelector('[data-cad-snap-summary]');
    if (summary) summary.textContent = `Object Snap · F3 ${state.snapEnabled ? 'ON' : 'OFF'}`;
  }
  function setSnapEnabled(enabled, event) {
    // No hidden OFF state when the owner has removed the Snap controls.
    // Native placement can still bypass a reference temporarily with Alt.
    const next = backgroundEditing || enabled === true;
    if (next === state.snapEnabled) return;
    state.snapEnabled = next;
    // Consume a pending preview first, or reuse the last accepted plan pointer.
    // The control click has no plan coordinates and must never move the ghost.
    const pointer = state.pointerEvent || state.lastPlanPointer;
    state.pointerEvent = null;
    if (active() && pointer && currentGesture()) state.ghostPoint = pickPoint(pointer, false, event?.altKey === true);
    else state.ghostSnap = null;
    renderSnapControls(); renderGhost();
  }
  const setStatus = message => {
    state.status = message;
    const output = state.panel?.querySelector('[data-cad-status]');
    if (output) output.textContent = message;
  };
  const notify = message => { setStatus(message); toast?.(message); };
  const svgNode = (tag, attrs = {}) => {
    const element = doc.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
    return element;
  };
  const screenScale = () => {
    const matrix = svg.getScreenCTM?.();
    return matrix ? Math.max(1e-6, Math.hypot(matrix.a, matrix.b)) : 1;
  };
  const metresPerPixel = () => {
    const a = pointToSvg({ x: 0, y: 0 }), b = pointToSvg({ x: 1, y: 0 });
    const matrix = svg.getScreenCTM?.();
    if (!finitePoint(a) || !finitePoint(b)) return null;
    const dx = b.x - a.x, dy = b.y - a.y;
    const scale = matrix ? Math.hypot(matrix.a * dx + matrix.c * dy, matrix.b * dx + matrix.d * dy) : Math.hypot(dx, dy);
    return scale > 0 ? 1 / scale : null;
  };
  const pathData = (points, closed) => points.map((point, index) => { const mapped = pointToSvg(point); return `${index ? 'L' : 'M'}${mapped.x},${mapped.y}`; }).join(' ') + (closed ? ' Z' : '');
  const releaseMemberPointer = () => {
    const pointer = state.memberPointer; state.memberPointer = null;
    if (pointer && svg.hasPointerCapture?.(pointer.id)) svg.releasePointerCapture?.(pointer.id);
  };
  const resetGesture = () => {
    releaseMemberPointer(); state.memberFormSnapshot = null; state.pointerEpoch += 1; state.pointerEvent = null; state.lastPlanPointer = null;
    state.vertices = []; state.basePoint = null; state.vertexIndex = null; state.ghostPoint = null; state.ghostSnap = null; state.pendingPit = null; state.fitPreview = null; state.pendingLift = null; state.liftFit = null; state.openingPreview = null; state.gestureModel = null; state.gestureLevel = null; state.gestureLevels = null;
    state.editBoundary = null; state.editPreview = null; state.erasePreview = null;
  };
  const startGesture = () => { state.gestureModel = getModel(); state.gestureLevel = getLevelId(); state.gestureLevels = levelsKey(); };
  const currentGesture = () => {
    if (state.gestureModel && (state.gestureModel !== getModel() || state.gestureLevel !== getLevelId() || state.gestureLevels !== levelsKey() || (state.memberFormSnapshot && state.memberFormSnapshot !== JSON.stringify(memberForms[memberKind()])))) {
      resetGesture(); state.mode = 'select'; notify('ข้อมูลแปลนเปลี่ยนแล้ว ยกเลิกภาพร่างก่อนหน้า กรุณาเริ่มใหม่'); renderPanel(); renderGhost(); return false;
    }
    return true;
  };
  const clearMode = () => { displaySnapMarker(null); state.commandBuffer = ''; resetGesture(); state.mode = 'select'; setStatus('เลือกวัตถุหรือคำสั่งใหม่'); renderPanel(); renderObjects(); renderGhost(); };
  const invalidateSnap = () => { state.snapModel = null; state.snapIndex = null; };
  function ensureSnap(force = false) {
    const excludedId = ['M', 'PE', 'pit-place', 'lift-place'].includes(state.mode) ? state.selectedId : '';
    const currentLevels = levelsKey();
    if (force || state.snapModel !== getModel() || state.snapLevel !== getLevelId() || state.snapLevels !== currentLevels || state.snapSelection !== excludedId || !state.snapIndex) {
      const sources = getSnapSources?.() || {};
      const points = [...(sources.points || [])], segments = [...(sources.segments || [])];
      for (const element of visibleElements()) {
        let outlines = [{ name: 'แนว', points: element.pointsM, closed: element.cadGeometryInput?.closed === true }];
        if (element.kind === 'lift-pit') {
          const geometry = pitGeometry(pitFromDrawingElement(element));
          if (!geometry.ok) continue;
          outlines = [{ name: 'ผิวนอกหลุม', points: geometry.outerPolygon, closed: true }, { name: 'ขอบช่องในหลุม', points: geometry.innerPolygon, closed: true }];
        }
        if (element.kind === 'lift-assembly') {
          const geometry = currentLiftGeometry(element);
          if (!geometry.ok) continue;
          outlines = [{ name: 'ผิวนอกปล่อง', points: geometry.outerPolygon, closed: true }, { name: 'ช่องในปล่อง', points: geometry.innerPolygon, closed: true }];
        }
        for (const [outlineIndex, outline] of outlines.entries()) {
          if (!Array.isArray(outline.points) || !outline.points.every(finitePoint)) continue;
          for (const [pointIndex, point] of outline.points.entries()) points.push({ ...point, id: `${element.id}:${outlineIndex}:p${pointIndex}`, label: `${element.mark || element.id} · ${outline.name}` });
          for (let i = 0; i < outline.points.length - (outline.closed ? 0 : 1); i += 1) segments.push({ id: `${element.id}:${outlineIndex}:e${i}`, label: `${element.mark || element.id} · ${outline.name}`, kind: 'line', a: outline.points[i], b: outline.points[(i + 1) % outline.points.length] });
        }
      }
      const keep = item => !excludedId || !(String(item.id) === excludedId || String(item.id).startsWith(`${excludedId}:`));
      // Display metadata only; the existing five OSNAP algorithms and priorities
      // are unchanged. Standalone reference points have a distinct node glyph.
      snapSourceKinds = new Map([...segments.map(item => [String(item.id), item.kind]), ...(sources.points || []).map(item => [String(item.id), 'node'])]);
      state.snapIndex = buildSnapIndex({ points: points.filter(keep), segments: segments.filter(keep) });
      state.snapModel = getModel(); state.snapLevel = getLevelId(); state.snapLevels = currentLevels; state.snapSelection = excludedId;
    }
    return state.snapIndex;
  }
  function pickPoint(event, force = false, altKey = event.altKey) {
    const point = pointFromEvent(event);
    const scale = metresPerPixel();
    if (!finitePoint(point) || !scale) return null;
    state.lastPlanPointer = event;
    let candidate = point;
    const anchor = state.vertices.at(-1) || state.basePoint;
    if (state.form.ortho && anchor) candidate = Math.abs(point.x - anchor.x) >= Math.abs(point.y - anchor.y) ? { x: point.x, y: anchor.y } : { x: anchor.x, y: point.y };
    const snap = altKey || !state.snapEnabled ? null : findSnap(ensureSnap(force), candidate, { tolerance: 9 * scale, enabled: state.enabled, anchor });
    state.ghostSnap = snap;
    return snap ? { x: snap.x, y: snap.y } : candidate;
  }
  function resolveSnapPoint(point, { altKey = false, anchor, toleranceM } = {}) {
    if (destroyed || !finitePoint(point)) return { point: null, snap: null };
    const tolerance = Number.isFinite(toleranceM) && toleranceM >= 0 ? toleranceM : 9 * (metresPerPixel() || 0);
    const snap = altKey || !state.snapEnabled ? null : findSnap(ensureSnap(), point, { tolerance, enabled: state.enabled, anchor });
    return { point: snap ? copyPoint(snap) : copyPoint(point), snap };
  }
  // The host supplies the exact point accepted by its native tool, not a
  // second independently resolved candidate. This layer never reads a member
  // catalog, owns a pointer, changes selection, or writes to the model.
  function displaySnapMarker(snap) {
    const sourceKind = snap?.sourceKind;
    const symbol = snap?.kind === 'endpoint' && sourceKind === 'node' ? 'node'
      : snap?.kind === 'nearest' && sourceKind === 'grid' ? 'grid' : snap?.kind;
    const glyph = SNAP_SYMBOLS[symbol];
    if (destroyed || (state.mode === 'TR' && active()) || !finitePoint(snap) || !glyph || symbol === 'free') {
      passiveSnapLayer?.remove(); passiveSnapLayer = null; passiveSnapKey = ''; return;
    }
    const mapped = pointToSvg(snap), scale = screenScale();
    if (!finitePoint(mapped)) { displaySnapMarker(null); return; }
    const description = `${glyph.label}${snap.label ? ` · ${snap.label}` : ''}`;
    const key = JSON.stringify([mapped.x, mapped.y, scale, symbol, description]);
    if (key === passiveSnapKey && passiveSnapLayer?.parentNode === svg) return;
    passiveSnapLayer?.remove();
    passiveSnapLayer = svgNode('g', { 'data-cad-native-snap-marker': '', 'data-cad-snap-symbol': symbol, 'data-cad-snap-kind': snap.kind, role: 'img', 'aria-label': description, transform: `translate(${mapped.x},${mapped.y}) scale(${1 / scale})`, 'pointer-events': 'none' });
    const title = svgNode('title'); title.textContent = description; passiveSnapLayer.append(title);
    passiveSnapLayer.append(svgNode('path', { d: glyph.path, fill: 'none', stroke: 'oklch(99.4% 0.004 250)', 'stroke-width': 4, 'stroke-linecap': 'square' }));
    passiveSnapLayer.append(svgNode('path', { d: glyph.path, fill: 'none', stroke: 'oklch(34% 0.125 258)', 'stroke-width': 1.6, 'stroke-linecap': 'square' }));
    svg.append(passiveSnapLayer); passiveSnapKey = key;
  }
  function ensureLayer() {
    if (state.layer?.parentNode === svg) return;
    state.layer = svgNode('g', { 'data-cad-authoring-layer': '', 'aria-label': 'เส้นร่างและหลุมลิฟท์ ENGINE 0' });
    state.objectsLayer = svgNode('g'); state.ghostLayer = svgNode('g', { 'pointer-events': 'none' });
    state.commandLayer = svgNode('g', { 'pointer-events': 'none', 'data-cad-command-readout': '', role: 'status', 'aria-live': 'polite' });
    state.layer.append(state.objectsLayer, state.ghostLayer, state.commandLayer); svg.append(state.layer);
  }
  function renderCommandReadout() {
    ensureLayer(); state.commandLayer.replaceChildren();
    if (!active() && !(backgroundEditing && state.commandBuffer)) return;
    if (backgroundEditing && state.mode === 'select' && !state.commandBuffer) return;
    const box = svg.viewBox?.baseVal, scale = screenScale();
    const x = (box?.x || 0) + 12 / scale, y = (box?.y || 0) + 24 / scale;
    const label = svgNode('text', { x, y, fill: 'oklch(26% 0.055 257)', 'font-size': 12 / scale, 'font-family': 'monospace', 'paint-order': 'stroke', stroke: 'oklch(99.4% 0.004 250)', 'stroke-width': 5 / scale });
    label.textContent = backgroundEditing && (editMode() || state.commandBuffer)
      ? state.commandBuffer ? `> ${state.commandBuffer} ▌` : state.status
      : `${state.commandBuffer ? `> ${state.commandBuffer} ▌` : `CAD · ${state.mode === 'select' ? 'พิมพ์คำสั่ง' : state.mode}`} · F3 SNAP ${state.snapEnabled ? 'ON' : 'OFF'} · F8 ORTHO ${state.form.ortho ? 'ON' : 'OFF'}`;
    state.commandLayer.append(label);
  }
  function drawElement(element, parent, ghost = false) {
    if (!Array.isArray(element.pointsM) || !element.pointsM.every(finitePoint)) return;
    const selectedNow = !ghost && state.selectedId === element.id && active();
    const liftGeometry = element.kind === 'lift-assembly' ? currentLiftGeometry(element) : null;
    if (liftGeometry && !liftGeometry.ok) {
      // Preserve a selectable historical footprint for repair, not normal parts
      // or Snap authority when the saved served-level snapshot is no longer current.
      if (ghost || !element.pointsM.length) return;
      const color = 'oklch(52% 0.115 75)', d = pathData(element.pointsM, true);
      parent.append(svgNode('path', { d, fill: 'none', stroke: color, 'stroke-width': selectedNow ? 2.5 : 1.6, 'stroke-dasharray': '3 5', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-cad-lift-hold': element.id }));
      if (active()) parent.append(svgNode('path', { d, fill: 'none', stroke: 'transparent', 'stroke-width': 13, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke', 'data-cad-element': element.id }));
      const point = pointToSvg(element.pointsM[0]);
      const label = svgNode('text', { x: point.x, y: point.y - 7 / screenScale(), fill: color, 'font-size': 11 / screenScale(), 'pointer-events': 'none' });
      label.textContent = `${element.mark || 'LIFT'} · HOLD · ${liftGeometry.reason}`;
      parent.append(label); return;
    }
    const color = ghost || selectedNow ? '#315ca8' : element.kind === 'shaft-outline' ? '#986021' : element.kind === 'lift-pit' ? '#326778' : '#725393';
    const closed = element.kind === 'lift-pit' || element.kind === 'lift-assembly' || element.cadGeometryInput?.closed;
    let data = pathData(element.pointsM, closed);
    if (element.kind === 'lift-assembly') {
      const geometry = liftGeometry;
      // Draw a true horizontal slice of the same solids used by 3D. No UI-only wall cuts.
      const elevation = getLevelElevation();
      const components = geometry.components.filter(component => component.polygon?.every(finitePoint) && elevation >= component.bottomElevationM && elevation < component.topElevationM);
      for (const component of components) parent.append(svgNode('path', { d: pathData(component.polygon, true), fill: color, 'fill-opacity': component.kind?.includes('cabin') ? '.08' : '.17', stroke: color, 'stroke-width': 1.3, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-cad-lift-component': component.id || component.kind }));
      data = pathData(geometry.outerPolygon, true);
    }
    if (element.kind === 'lift-pit') {
      const geometry = pitGeometry(pitFromDrawingElement(element));
      if (!geometry.ok) return;
      data = `${pathData(geometry.outerPolygon, true)} ${pathData(geometry.innerPolygon, true)}`;
    }
    const shape = svgNode('path', { d: data, fill: element.kind === 'lift-pit' ? color : 'none', 'fill-opacity': '.13', 'fill-rule': 'evenodd', stroke: color, 'stroke-width': selectedNow ? 2.5 : 1.6, 'stroke-dasharray': element.kind === 'lift-pit' ? '' : '7 4', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none' });
    parent.append(shape);
    if (!ghost && active()) parent.append(svgNode('path', { d: data, fill: 'none', stroke: 'transparent', 'stroke-width': 13, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'stroke', 'data-cad-element': element.id }));
    if (!ghost) {
      const labelPoint = pointToSvg(element.pointsM[0]);
      const label = svgNode('text', { x: labelPoint.x, y: labelPoint.y - 7 / screenScale(), fill: color, 'font-size': 11 / screenScale(), 'pointer-events': 'none' });
      label.textContent = `${element.mark || (element.kind === 'lift-pit' ? 'PIT' : 'CAD')} · ${element.kind === 'lift-assembly' ? 'DRAWING REFERENCE' : 'ENGINE 0'}`;
      parent.append(label);
    }
    if (selectedNow && state.mode === 'PE' && ['cad-draft', 'shaft-outline'].includes(element.kind)) element.pointsM.forEach((point, index) => {
      const mapped = pointToSvg(point);
      parent.append(svgNode('circle', { cx: mapped.x, cy: mapped.y, r: 5 / screenScale(), fill: '#f5f7fb', stroke: color, 'stroke-width': 1.5, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'all', 'data-cad-vertex': index, 'data-cad-element': element.id }));
    });
  }
  function drawMemberOverlay(element, parent, ghost = false) {
    if (!Array.isArray(element.pointsM) || !element.pointsM.length || !element.pointsM.every(finitePoint)) return;
    const highlighted = ghost || state.selectedId === element.id;
    const attrs = { fill: 'none', stroke: highlighted ? 'oklch(34% 0.125 258)' : 'transparent', 'stroke-width': highlighted ? 2.5 : 13, 'vector-effect': 'non-scaling-stroke', 'pointer-events': ghost ? 'none' : 'stroke', ...(ghost ? { 'data-cad-member-edit-preview': element.id } : { 'data-cad-element': element.id, 'data-cad-member-overlay': '' }) };
    if (element.pointsM.length === 1) {
      const point = pointToSvg(element.pointsM[0]);
      parent.append(svgNode('circle', { ...attrs, cx: point.x, cy: point.y, r: 7 / screenScale(), 'pointer-events': ghost ? 'none' : 'all' }));
    } else {
      const d = pathData(element.pointsM, element.closed === true);
      parent.append(svgNode('path', { ...attrs, d, 'stroke-dasharray': ghost ? '5 4' : '' }));
      if (!ghost && highlighted) parent.append(svgNode('path', { ...attrs, d, stroke: 'transparent', 'stroke-width': 13 }));
    }
    // Original member renderer owns its normal label and physical section.
  }
  function drawTrimRemovalPreview(preview) {
    const points = preview?.removedSegment;
    if (!Array.isArray(points) || points.length !== 2 || !points.every(finitePoint)) return;
    const label = 'TR · ช่วงที่จะตัดออก';
    const group = svgNode('g', { 'data-cad-trim-removal-preview': preview.id, role: 'img', 'aria-label': label, 'pointer-events': 'none' });
    const title = svgNode('title'); title.textContent = `${label} · ภาพร่างเรขาคณิต ตรวจข้อมูลอีกครั้งเมื่อคลิก`; group.append(title);
    const d = pathData(points, false);
    const paper = 'oklch(98% 0.006 258)', cutColor = 'oklch(57% 0.16 52)';
    group.append(svgNode('path', { d, fill: 'none', stroke: paper, 'stroke-width': 5.5, 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'aria-hidden': 'true' }));
    group.append(svgNode('path', { d, fill: 'none', stroke: cutColor, 'stroke-width': 3.5, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke', 'pointer-events': 'none', 'data-cad-member-edit-preview': preview.id, 'data-cad-trim-removal-segment': '' }));
    const middle = pointToSvg({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 });
    const glyph = svgNode('g', { 'data-cad-trim-cut-glyph': '', transform: `translate(${middle.x},${middle.y}) scale(${1 / screenScale()})`, 'pointer-events': 'none', 'aria-hidden': 'true' });
    glyph.append(svgNode('circle', { r: 7, fill: paper, stroke: cutColor, 'stroke-width': 1.25 }));
    glyph.append(svgNode('path', { d: 'M-3,-3 L3,3 M-3,3 L3,-3', fill: 'none', stroke: cutColor, 'stroke-width': 1.8, 'stroke-linecap': 'round' }));
    group.append(glyph); state.ghostLayer.append(group);
  }
  function renderObjects() {
    ensureLayer(); state.objectsLayer.replaceChildren();
    for (const element of visibleElements()) drawElement(element, state.objectsLayer);
    if (!backgroundEditing || active()) for (const element of editableMembers()) drawMemberOverlay(element, state.objectsLayer);
  }
  function currentPitPreview() {
    if (state.fitPreview) return state.fitPreview.pit;
    return state.pendingPit && state.ghostPoint ? placePitAtAnchor(state.pendingPit, state.ghostPoint, { anchor: state.form.anchor }) : null;
  }
  function pitWarnings(pit) {
    const model = getModel(), level = getLevelId();
    const key = JSON.stringify([pit.id, pit.levelId, pit.center?.x, pit.center?.y, ...PIT_FIELDS.map(field => pit[field])]);
    if (pitWarningCache?.model === model && pitWarningCache.level === level && pitWarningCache.key === key) return pitWarningCache.warnings;
    let warnings;
    try {
      // The bridge inspects geometry only. Never hand it a mutable saved record.
      const rows = getPitWarnings(Object.freeze({ ...pit, center: Object.freeze(copyPoint(pit.center)) }));
      if (!Array.isArray(rows) || rows.some(row => typeof row !== 'string')) throw new Error('Invalid pit warning response');
      warnings = [...new Set(rows.map(row => row.trim()).filter(Boolean))];
    } catch {
      warnings = ['ตรวจข้อมูลการชนไม่สำเร็จ ต้องตรวจตำแหน่งในแปลนก่อนใช้งาน'];
    }
    pitWarningCache = { model, level, key, warnings };
    return warnings;
  }
  const pitWarningText = pit => {
    const warnings = pitWarnings(pit);
    return [...(warnings.length ? warnings.map(warning => `⚠ ${warning}`) : ['⚠ ไม่มีรายการเตือนเพิ่มเติมจากข้อมูลที่ตรวจได้']), PIT_WARNING_NOTE].join('\n');
  };
  function renderPitWarnings(current = selected()) {
    if (!pitWarningOutput) return;
    let pit = currentPitPreview();
    let preview = Boolean(pit);
    if (!pit && current?.kind === 'lift-pit') {
      pit = pitFromDrawingElement(current);
      if (['M', 'CO'].includes(state.mode) && state.basePoint && state.ghostPoint) {
        pit = { ...pit, id: state.mode === 'CO' ? '' : pit.id, center: {
          x: pit.center.x + state.ghostPoint.x - state.basePoint.x,
          y: pit.center.y + state.ghostPoint.y - state.basePoint.y
        } };
        preview = true;
      }
    }
    const message = active() && pit ? `${preview ? 'ภาพร่างตำแหน่งหลุม' : 'หลุมที่เลือก'}\n${pitWarningText(pit)}` : '';
    pitWarningOutput.hidden = !message;
    if (pitWarningOutput.textContent !== message) pitWarningOutput.textContent = message;
  }
  function renderGhost() {
    ensureLayer(); state.ghostLayer.replaceChildren();
    renderCommandReadout();
    if (!active()) return;
    if (editMode()) {
      if (state.mode === 'TR') {
        if (state.editPreview?.ok) drawTrimRemovalPreview(state.editPreview);
      } else {
        if (state.editBoundary) drawMemberOverlay({ ...state.editBoundary, id: `boundary:${state.editBoundary.id}` }, state.ghostLayer, true);
        if (state.editPreview?.ok) for (const [index, pointsM] of state.editPreview.segments.entries()) {
          drawMemberOverlay({ id: `${state.editPreview.id}:${index}`, pointsM }, state.ghostLayer, true);
        }
      }
      if (state.erasePreview) drawMemberOverlay(state.erasePreview, state.ghostLayer, true);
    }
    renderMemberGhost();
    const current = selected();
    if (['L', 'PL'].includes(state.mode) && state.vertices.length) {
      const points = [...state.vertices, ...(state.ghostPoint ? [state.ghostPoint] : [])];
      if (points.length > 1) state.ghostLayer.append(svgNode('path', { d: pathData(points, false), fill: 'none', stroke: '#315ca8', 'stroke-width': 1.7, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }));
    }
    if (['M', 'CO'].includes(state.mode) && current && state.basePoint && state.ghostPoint) {
      const delta = { x: state.ghostPoint.x - state.basePoint.x, y: state.ghostPoint.y - state.basePoint.y };
      if (current.__cadEditableMember) drawMemberOverlay({ ...current, pointsM: current.pointsM.map(point => ({ x: point.x + delta.x, y: point.y + delta.y })) }, state.ghostLayer, true);
      else {
        const moved = moveCadDrawingElement(current, delta);
        if (moved.ok) drawElement(moved.element, state.ghostLayer, true);
      }
    }
    if (state.mode === 'PE' && current && state.vertexIndex !== null && state.ghostPoint) {
      const points = current.pointsM.map((point, index) => index === state.vertexIndex ? state.ghostPoint : point);
      drawElement({ ...current, pointsM: points }, state.ghostLayer, true);
    }
    const pit = currentPitPreview();
    if (pit) { const element = createPitDrawingElement(pit); if (element.ok) drawElement(element.element, state.ghostLayer, true); }
    const lift = currentLiftPreview();
    if (lift) { const result = createLiftAssemblyDrawingElement(lift, { id: state.liftFit?.id || state.pendingLift?.id }); if (result.ok) drawElement(result.element, state.ghostLayer, true); }
    if (state.ghostPoint && state.mode !== 'TR') {
      const mapped = pointToSvg(state.ghostPoint), scale = screenScale();
      const snap = state.ghostSnap;
      const sourceKind = snapSourceKinds.get(String(snap?.sourceId));
      const symbol = snap?.kind === 'endpoint' && sourceKind === 'node' ? 'node'
        : snap?.kind === 'nearest' && sourceKind === 'grid' ? 'grid' : snap?.kind || 'free';
      const glyph = SNAP_SYMBOLS[symbol];
      const description = snap ? `${glyph.label} · ${snap.label}` : `${glyph.label} · ${state.ghostPoint.x.toFixed(3)}, ${state.ghostPoint.y.toFixed(3)} ม.`;
      const marker = svgNode('g', { 'data-cad-snap-symbol': symbol, 'data-cad-snap-kind': snap?.kind || 'free', role: 'img', 'aria-label': description, transform: `translate(${mapped.x},${mapped.y}) scale(${1 / scale})`, 'pointer-events': 'none' });
      const title = svgNode('title'); title.textContent = description; marker.append(title);
      marker.append(svgNode('path', { d: glyph.path, fill: 'none', stroke: 'oklch(99.4% 0.004 250)', 'stroke-width': 4, 'stroke-linecap': 'square' }));
      marker.append(svgNode('path', { d: glyph.path, fill: 'none', stroke: 'oklch(34% 0.125 258)', 'stroke-width': 1.6, 'stroke-linecap': 'square' }));
      state.ghostLayer.append(marker);
    }
    // Reuse this render's lookup only. Never retain member DTOs across frames,
    // model/level changes, Undo/Redo or committing commands.
    renderPitWarnings(current);
  }
  const numberField = (name, label, value, group = 'form') => `<label class="cad-field">${label}<input data-cad-${group}="${name}" type="number" step="any" value="${escapeHtml(value)}" aria-label="${label}"></label>`;
  const snapIcon = kind => `<svg aria-hidden="true" width="16" height="16" viewBox="-8 -8 16 16"><path d="${SNAP_SYMBOLS[kind].path}" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>`;
  const selectField = (name, label, values) => `<label class="cad-field">${label}<select data-cad-form="${name}" aria-label="${label}">${values.map(([value, text]) => `<option value="${escapeHtml(value)}"${state.form[name] === value ? ' selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></label>`;
  function memberPanel() {
    const kind = memberKind();
    if (!kind) return '';
    const form = memberForms[kind];
    return `<div data-cad-member-panel><h3>${kind === 'beam' ? 'B · วางคานซ้ำ' : 'COL · วางเสาซ้ำ'}</h3><div class="cad-grid">${numberField('widthM', 'หน้าตัด b กว้าง (ม.)', form.widthM, 'member')}${numberField('depthM', kind === 'beam' ? 'หน้าตัด h ลึก (ม.)' : 'หน้าตัด h ยาว (ม.)', form.depthM, 'member')}${kind === 'column' ? numberField('baseElevationM', 'ระดับฐาน Base EL (ม.)', form.baseElevationM, 'member') : ''}${numberField('topElevationM', 'ระดับบน Top EL (ม.)', form.topElevationM, 'member')}</div><button data-cad-action="member-ready">ใช้ขนาดนี้ แล้ววางในแปลน</button><p class="cad-note">${kind === 'beam' ? 'คลิก 2 จุด หรือลากแล้วปล่อยเพื่อวางคานหนึ่งตัว' : 'คลิกเพื่อวางเสาที่กึ่งกลางหน้าตัด'} · วางซ้ำได้ · Esc ยกเลิก<br>ต้องกรอกขนาดจริง ไม่มีหน้าตัดเริ่มต้น · ENGINE 0<br>พิกัด/ขนาดบันทึกละเอียด 1 มม.</p></div>`;
  }
  function loadSelectedPit() {
    const pit = pitFromDrawingElement(selected());
    if (!pit) return;
    for (const key of PIT_FIELDS) state.pitForm[key] = String(pit[key]);
    state.form.mark = selected().mark || '';
  }
  function loadSelectedLift() {
    const current = selected();
    state.selectedLiftRecordKey = liftRecordKey(current);
    if (current?.kind !== 'lift-assembly') return;
    const geometry = liftAssemblyFromDrawingElement(current);
    if (!geometry.ok) { notify(`HOLD: ${geometry.reason}`); return; }
    for (const key of LIFT_ASSEMBLY_FIELDS) state.liftForm[key] = String(geometry.input[key]);
    state.liftLevels = geometry.input.servedLevels.map(level => ({ ...level }));
    state.openingLevels = geometry.input.servedLevels.map(level => level.levelId);
    const checked = currentLiftGeometry(current);
    if (!checked.ok) setStatus(`HOLD: ${checked.reason} · เลือกชั้นและอัปเดตขนาดใหม่ก่อนใช้รูปทรง`);
  }
  function liftPanel() {
    const current = selected(), existing = current?.kind === 'lift-assembly';
    const field = (key, label) => numberField(key, label, state.liftForm[key], 'lift');
    const group = (title, fields, note = '') => `<details open><summary>${title}</summary><div class="cad-grid">${fields.map(([key, label]) => field(key, label)).join('')}</div>${note ? `<p class="cad-note">${note}</p>` : ''}</details>`;
    const levels = getLevels(), missing = state.liftLevels.filter(saved => !levels.some(level => level.id === saved.levelId && level.elevationM === saved.elevationM));
    return `<div data-cad-lift-panel><p class="cad-note">DRAWING REFERENCE / NOT INSTALLATION DESIGN<br>ช่องในปล่อง ห้องโดยสาร ประตู และรางใช้ขนาดที่กรอก ไม่ใช่มาตรฐานติดตั้งหรือแบบผนังรับแรง</p>
      ${group('1 · หลุมและปล่อง', [['innerWidthM', 'ช่องในปล่อง กว้าง (ม.)'], ['innerLengthM', 'ช่องในปล่อง ยาว (ม.)'], ['depthM', 'หลุม ลึกถึงผิวบนก้น (ม.)'], ['rimElevationM', 'ปากหลุม EL (ม.)'], ['wallThicknessM', 'ผนังปล่อง หนา (ม.)'], ['baseThicknessM', 'ก้นหลุม หนา (ม.)'], ['shaftTopElevationM', 'ยอดปล่อง EL (ม.)'], ['rotationDeg', 'หมุนจากแกน X (°)']])}
      <details open><summary>2 · ชั้นที่ให้บริการ</summary><div class="cad-checks">${levels.map(level => `<label><input type="checkbox" data-cad-lift-level="${escapeHtml(level.id)}"${state.liftLevels.some(item => item.levelId === level.id && item.elevationM === level.elevationM) ? ' checked' : ''}>${escapeHtml(level.label || level.id)} · EL ${escapeHtml(level.elevationM)} ม.</label>`).join('')}</div>${!levels.length ? '<p class="cad-note">HOLD: ไม่มีข้อมูลระดับชั้นปัจจุบัน</p>' : ''}${missing.length ? '<p class="cad-note">HOLD: ชั้นหรือระดับที่เคยเลือกเปลี่ยนแล้ว กรุณาเลือกชั้นใหม่</p>' : ''}<p class="cad-note">ต้องเลือกชั้นเจ้าของวัตถุด้วย · ประตูอยู่ด้านหน้า local −Y ของทุกชั้นที่เลือก</p></details>
      ${group('3 · ห้องโดยสาร', [['cabinWidthM', 'ช่องในห้อง กว้าง (ม.)'], ['cabinLengthM', 'ช่องในห้อง ยาว (ม.)'], ['cabinHeightM', 'ช่องในห้อง สูง (ม.)'], ['cabinWallThicknessM', 'ห้อง ผนัง/พื้น/หลังคาหนา (ม.)'], ['cabinFloorElevationM', 'ผิวบนพื้นห้อง EL (ม.)']], 'ขนาดห้องเป็นช่องใน ห้องต้องอยู่ภายในปล่องตามข้อมูลที่กรอก')}
      ${group('4 · ประตูและรางอ้างอิง', [['doorWidthM', 'ช่องประตู กว้าง (ม.)'], ['doorHeightM', 'ช่องประตู สูง (ม.)'], ['doorThicknessM', 'บานประตู หนา (ม.)'], ['doorOffsetXM', 'ประตู เยื้อง local X (ม.)'], ['railWidthM', 'ราง กว้าง X (ม.)'], ['railDepthM', 'ราง ลึก Y (ม.)'], ['railOffsetXM', 'รางคู่ ระยะ ±X (ม.)'], ['railOffsetYM', 'ราง ตำแหน่ง Y (ม.)']], 'กรอกศูนย์เมื่อไม่เยื้อง ไม่มีค่า clearance จากผู้ผลิตหรือแรงลิฟต์ที่ระบบสมมติ')}
      <div class="cad-row"><button data-cad-action="lift-new">ดูตัวอย่างและวางใหม่</button><button data-cad-action="lift-move"${existing ? '' : ' disabled'}>ย้ายตาม Snap</button><button data-cad-action="lift-update"${existing ? '' : ' disabled'}>อัปเดตขนาด</button></div>
      ${existing ? '<div class="cad-row"><button data-cad-command="M">M ย้าย</button><button data-cad-command="CO">CO สำเนา</button></div>' : ''}
      <p class="cad-note">วางที่กึ่งกลางปล่อง · รูปตัวอย่างยังไม่บันทึก · ยกเลิกด้วย Esc<br>การวาง/สำเนาไม่เจาะพื้น ไม่ลบคาน ไม่ทำสำเนาช่องเปิด</p>
      <details><summary>Fit กรอบปิดที่ตรวจได้</summary>${selectField('boundaryId', 'ขอบเขตอ้างอิง', [['', 'เลือกกรอบปิด'], ...(getClosedBoundaries?.() || []).map(boundary => [boundary.id, boundary.label])])}${selectField('fitBasis', 'ขอบที่จะตรงกับกรอบ', [['outer', 'ผิวนอกปล่อง'], ['inner', 'ช่องในปล่อง']])}<div class="cad-row"><button data-cad-action="lift-fit">ดูตัวอย่าง Fit</button><button data-cad-action="lift-fit-accept"${state.liftFit ? '' : ' disabled'}>ยอมรับ Fit และวางใหม่</button></div><p class="cad-note">ปรับเฉพาะช่องในและตำแหน่ง จากนั้นตรวจห้อง ประตู และรางทั้งชุดใหม่</p></details>
      <details${state.openingPreview ? ' open' : ''}><summary>ช่องเปิดพื้น แยกยืนยันก่อนเจาะ</summary><p class="cad-note">เลือกชั้นที่จะเจาะแยกจากชั้นให้บริการ ชั้นที่ไม่เลือกจะไม่ถูกเจาะ</p><div class="cad-checks">${existing ? (current.liftAssemblyGeometryInput?.servedLevels || []).map(level => `<label><input type="checkbox" data-cad-opening-level="${escapeHtml(level.levelId)}"${state.openingLevels.includes(level.levelId) ? ' checked' : ''}>${escapeHtml(level.levelId)} · EL ${escapeHtml(level.elevationM)} ม.</label>`).join('') : ''}</div><button data-cad-action="lift-openings-preview"${existing ? '' : ' disabled'}>ตรวจชุดชั้นที่เลือกอีกครั้ง</button>${openingPanel()}<p class="cad-note">ยืนยันได้เมื่อทุกแถว valid เท่านั้น · HOLD แม้หนึ่งแถวจะไม่บันทึกทั้งชุด · ไม่เจาะ PS/GS หรือลบคาน</p></details></div>`;
  }
  function openingPanel() {
    const preview = state.openingPreview;
    if (!preview) return '';
    const rows = preview.rows;
    return `<div class="cad-opening-list" role="list">${rows.map(row => `<div role="listitem" class="cad-opening-row"><strong>${row.ok === true ? '✓ valid' : '⚠ HOLD'} · ${escapeHtml(row.label || row.hostId || 'ไม่พบ host')}</strong><br>${escapeHtml(row.levelId || '')}${typeof row.dimensions === 'string' ? ` · ${escapeHtml(row.dimensions)}` : Number.isFinite(row.widthM) && Number.isFinite(row.lengthM) ? ` · ${row.widthM.toFixed(3)} × ${row.lengthM.toFixed(3)} ม.` : ''}<br>${escapeHtml(row.reason || (row.ok ? 'พร้อมตรวจซ้ำก่อนยืนยัน' : 'ตรวจช่องเปิดไม่ได้'))}</div>`).join('')}</div><div class="cad-row"><button data-cad-action="lift-openings-commit"${preview.ok === true && rows.length && rows.every(row => row.ok === true) && preview.token != null ? '' : ' disabled'}>ยืนยันเจาะทั้งชุด ${rows.length} แถว</button><button data-cad-action="lift-openings-cancel">ยกเลิกชุดนี้</button></div>`;
  }
  function renderPanel() {
    if (!active() || (backgroundEditing && ['select', 'cad'].includes(getActiveTool()))) { if (state.panel?.isConnected) state.panel.remove(); state.panel = null; return; }
    if (!state.panel || state.panel.parentNode !== inspectorBody) {
      state.panel = doc.createElement('section'); state.panel.className = 'cad-authoring-panel';
      state.panel.setAttribute('aria-label', 'เครื่องมือ CAD และหลุมลิฟท์'); inspectorBody.replaceChildren(state.panel);
      state.panel.addEventListener('click', onPanelClick); state.panel.addEventListener('input', onPanelInput); state.panel.addEventListener('change', onPanelInput); state.panel.addEventListener('keydown', onPanelKey);
    }
    const list = selectableElements();
    const current = list.find(element => element.id === state.selectedId) || null;
    const pitTool = getActiveTool() === 'lift-pit' || (['cad', 'lift-assembly'].includes(getActiveTool()) && current?.kind === 'lift-pit');
    const liftTool = getActiveTool() === 'lift-assembly' || (getActiveTool() === 'cad' && current?.kind === 'lift-assembly');
    const boundaries = getClosedBoundaries?.() || [];
    state.panel.innerHTML = `<style>
      .cad-authoring-panel{font-family:inherit;font-size:13px;line-height:1.45;color:var(--instrument-ink,#25374e);min-width:0;padding:12px}.cad-authoring-panel h3{font-size:15px;margin:0 0 8px}.cad-authoring-panel p{margin:7px 0}.cad-authoring-panel button,.cad-authoring-panel input,.cad-authoring-panel select{font:inherit;min-width:0;border:1px solid #b8c7d8;border-radius:4px;background:#f9fbfd;color:#25374e;padding:7px}.cad-authoring-panel button{cursor:pointer;min-height:36px}.cad-authoring-panel button:hover{background:#e6edf6}.cad-authoring-panel button:focus-visible,.cad-authoring-panel input:focus-visible,.cad-authoring-panel select:focus-visible{outline:2px solid #315ca8;outline-offset:2px}.cad-authoring-panel button:disabled{opacity:.48;cursor:not-allowed}.cad-authoring-panel button[data-active="true"]{background:#263f63;color:#f5f7fb}.cad-authoring-panel .cad-row{display:flex;gap:5px;flex-wrap:wrap;margin:8px 0}.cad-authoring-panel .cad-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.cad-authoring-panel .cad-field{display:flex;flex-direction:column;gap:4px;min-width:0}.cad-authoring-panel .cad-wide{width:100%;box-sizing:border-box}.cad-authoring-panel .cad-note{font-size:11px;color:#596b80;overflow-wrap:anywhere}.cad-authoring-panel .cad-status{padding:8px;background:#eaf0f8;border:1px solid #bccbdd;border-radius:4px;overflow-wrap:anywhere}.cad-authoring-panel .cad-checks{display:flex;flex-wrap:wrap;gap:6px 10px;font-size:12px}.cad-authoring-panel .cad-checks label{display:flex;align-items:center;gap:4px}.cad-authoring-panel details{border-top:1px solid #cbd5e1;margin-top:10px;padding-top:8px}.cad-authoring-panel summary{cursor:pointer}.cad-authoring-panel .cad-danger{color:#9b2831}.cad-authoring-panel option{color:#25374e}@media(pointer:coarse){.cad-authoring-panel button,.cad-authoring-panel input,.cad-authoring-panel select{min-height:44px}}
      .cad-authoring-panel .cad-opening-list{margin:8px 0}.cad-authoring-panel .cad-opening-row{padding:7px 0;border-bottom:1px solid oklch(86% 0.025 252);overflow-wrap:anywhere}.cad-authoring-panel [data-cad-lift-panel] .cad-note{font-size:12px}.cad-authoring-panel [data-cad-lift-panel] .cad-grid{margin-top:8px}
      </style><h3>${pitTool || liftTool ? 'ลิฟท์' : getActiveTool() === 'shaft-outline' ? 'แนวช่องปล่องโล่ง' : 'เขียนแปลน CAD'}</h3>
      <p class="cad-note">DRAWING INPUT · ENGINE 0<br>Snap เป็นตำแหน่งอ้างอิง ไม่ใช่จุดรองรับหรือการอนุมัติโครงสร้าง</p>
      <div class="cad-status" data-cad-status role="status" aria-live="polite">${escapeHtml(state.status)}</div>
      <label class="cad-field">วัตถุในชั้นนี้<select data-cad-select aria-label="เลือกวัตถุ CAD หรือสมาชิก"><option value="">เลือกวัตถุในแปลน</option>${list.map(element => `<option value="${escapeHtml(element.id)}"${element.id === state.selectedId ? ' selected' : ''}>${escapeHtml(element.mark || element.id)} · ${escapeHtml(element.kind)}</option>`).join('')}</select></label>
      ${pitTool ? `<div data-cad-legacy-lift><p class="cad-note">ข้อมูลเดิมมีเฉพาะหลุม ยังไม่มีขนาดปล่อง ห้องโดยสาร ประตู หรือราง · แก้ข้อมูลเดิมได้โดยไม่แปลงชนิด</p><button data-cad-command="LIFT">เริ่มลิฟท์ใหม่ครบชุด</button></div><div class="cad-grid">${numberField('innerWidthM', 'ช่องใน กว้าง (ม.)', state.pitForm.innerWidthM, 'pit')}${numberField('innerLengthM', 'ช่องใน ยาว (ม.)', state.pitForm.innerLengthM, 'pit')}${numberField('depthM', 'ลึกถึงผิวบนก้นหลุม (ม.)', state.pitForm.depthM, 'pit')}${numberField('rimElevationM', 'ระดับปากหลุม EL (ม.)', state.pitForm.rimElevationM, 'pit')}${numberField('wallThicknessM', 'หนาผนัง (ม.)', state.pitForm.wallThicknessM, 'pit')}${numberField('baseThicknessM', 'หนาพื้นก้นหลุม (ม.)', state.pitForm.baseThicknessM, 'pit')}${numberField('rotationDeg', 'หมุน (องศา)', state.pitForm.rotationDeg, 'pit')}${selectField('anchor', 'จุดจับก่อนหมุน', [['outer-min', 'มุมนอกเริ่มต้น'], ['inner-min', 'มุมในเริ่มต้น'], ['center', 'กึ่งกลาง'], ['outer-max', 'มุมนอกตรงข้าม'], ['inner-max', 'มุมในตรงข้าม']])}</div>
        <div class="cad-row"><button data-cad-action="pit-new"${current?.kind === 'lift-pit' ? '' : ' disabled'}>สำเนาข้อมูลเดิม</button><button data-cad-action="pit-move"${current?.kind === 'lift-pit' ? '' : ' disabled'}>ย้ายหลุม</button><button data-cad-action="pit-update"${current?.kind === 'lift-pit' ? '' : ' disabled'}>อัปเดตขนาด</button></div>
        <details><summary>วางตามกรอบช่องโล่ง</summary>${selectField('boundaryId', 'ขอบเขตอ้างอิง', [['', 'เลือกกรอบปิด'], ...boundaries.map(boundary => [boundary.id, boundary.label])])}${selectField('fitBasis', 'ขอบที่จะตรงกับกรอบ', [['outer', 'ผิวนอกผนังหลุม'], ['inner', 'ช่องว่างภายใน']])}<div class="cad-row"><button data-cad-action="pit-fit">ดูขนาดตามกรอบ</button><button data-cad-action="pit-fit-accept"${state.fitPreview ? '' : ' disabled'}>ยอมรับกรอบและวาง</button></div><p class="cad-note">ปรับขนาดเฉพาะเมื่อกดยอมรับ ไม่ตัดพื้นหรือลบคานเดิม</p></details>` : liftTool ? liftPanel() : `
        <div class="cad-row">${['L', 'PL', 'PE', 'M', 'CO', 'O', 'E', ...(getActiveTool() === 'cad' ? ['B', 'COL', 'LIFT'] : [])].map(command => `<button data-cad-command="${command}" data-active="${state.mode === command}"${getActiveTool() === 'shaft-outline' && command === 'L' ? ' disabled' : ''}>${command}</button>`).join('')}</div>
        ${memberPanel()}
        <label class="cad-field">คำสั่ง / ระยะ เช่น PL หรือ 3&lt;90<input class="cad-wide" data-cad-form="command" aria-label="คำสั่ง CAD" value="${escapeHtml(state.form.command)}" placeholder="PL แล้ว Enter"></label>
        <div class="cad-grid">${numberField('length', 'ระยะจากจุดล่าสุด (ม.)', state.form.length)}${numberField('angle', 'มุมจากแกน X (°)', state.form.angle)}</div><div class="cad-row"><button data-cad-action="typed-point">เพิ่มจุดตามระยะ</button><button data-cad-action="finish">จบเส้น Enter</button></div>
        <div class="cad-checks"><label><input type="checkbox" data-cad-form="closed"${state.form.closed || getActiveTool() === 'shaft-outline' ? ' checked' : ''}${getActiveTool() === 'shaft-outline' ? ' disabled' : ''}>ปิดรูป</label><label><input type="checkbox" data-cad-form="ortho"${state.form.ortho ? ' checked' : ''}>แนวฉาก</label></div>
        <details${state.mode === 'O' ? ' open' : ''}><summary>Offset จากเส้นที่เลือก</summary><div class="cad-grid">${numberField('offset', 'ระยะ Offset (ม.)', state.form.offset)}${selectField('side', 'ด้านตามทิศเส้น', [['left', 'ซ้าย'], ['right', 'ขวา']])}</div><button data-cad-action="offset">สร้างเส้น Offset</button></details>
        <details><summary>กำหนดเส้นเป็นสมาชิก</summary>${selectField('convertKind', 'ชนิดสมาชิก Drawing', [['beam', 'คาน'], ['slab', 'พื้น S']])}<div class="cad-grid">${numberField('widthM', 'คาน กว้าง (ม.)', state.form.widthM)}${numberField('depthM', 'คาน ลึก (ม.)', state.form.depthM)}${numberField('thicknessM', 'พื้น หนา (ม.)', state.form.thicknessM)}${numberField('elevationM', 'ระดับ EL (ม.)', state.form.elevationM)}</div><button data-cad-action="convert"${current?.kind === 'cad-draft' ? '' : ' disabled'}>ตรวจและกำหนดชนิด</button><p class="cad-note">รับเฉพาะรูปทรงที่ระบบเดิมรองรับ ไม่ส่งเส้นร่างเข้าสูตรคำนวณ</p></details>`}
      <details${backgroundEditing ? ' hidden' : ''}><summary data-cad-snap-summary>Object Snap · F3 ${state.snapEnabled ? 'ON' : 'OFF'}</summary><div class="cad-checks"><label><input type="checkbox" data-cad-snap-toggle${state.snapEnabled ? ' checked' : ''}>ใช้ Snap</label>${Object.entries({ endpoint: 'ปลาย/จุดอ้างอิง', midpoint: 'กึ่งกลาง', intersection: 'จุดตัด', nearest: 'บนแนว', perpendicular: 'ตั้งฉาก' }).map(([key, label]) => `<label title="${label}"><input type="checkbox" data-cad-snap="${key}"${state.enabled[key] ? ' checked' : ''}>${snapIcon(key)}${label}</label>`).join('')}</div><div class="cad-checks cad-note"><span title="จุดอ้างอิงที่มีอยู่ ใช้การตั้งค่า ปลาย/จุดอ้างอิง">${snapIcon('node')}จุดอ้างอิง</span><span title="บนเส้น Grid ใช้การตั้งค่า บนแนว">${snapIcon('grid')}แนว Grid</span></div><p class="cad-note">กด Alt ค้างเพื่อข้าม Snap ชั่วคราว · F8 แนวฉาก · ผิวคานใช้ได้เมื่อมีขนาดจริง</p></details>
      <div class="cad-row"><button data-cad-action="cancel">ยกเลิก Esc</button><button class="cad-danger" data-cad-action="erase"${current ? '' : ' disabled'}>ลบวัตถุที่เลือก</button></div><p class="cad-note">L เส้น · PL ต่อเนื่อง · PE ย้ายจุด · M ย้าย · CO สำเนา · O Offset · E ลบ · LIFT ชุดลิฟต์<br>M/CO/E ใช้กับสมาชิกที่รองรับผ่านตัวตรวจเฉพาะชนิด · การเชื่อมโยงหรือ Grid ที่ไม่รองรับจะแสดง HOLD<br>PE/Offset ใช้กับเส้นร่างและแนวปล่องเท่านั้น · ขนาดสมาชิกแก้ด้วย Free Hand เดิม<br>ใช้ Undo ของแปลนย้อนคืนรายการที่วางแล้ว</p>`;
    if (!pitWarningOutput) {
      pitWarningOutput = doc.createElement('div');
      pitWarningOutput.setAttribute('data-cad-pit-warnings', '');
      pitWarningOutput.setAttribute('role', 'status');
      pitWarningOutput.setAttribute('aria-live', 'polite');
      pitWarningOutput.setAttribute('style', 'white-space:pre-line;overflow-wrap:anywhere;margin:8px 0;padding:8px;border:1px solid #b97924;border-radius:4px;background:#fff8e8;color:#684512');
    }
    const statusOutput = state.panel.querySelector('[data-cad-status]');
    if (statusOutput) statusOutput.after(pitWarningOutput);
    else state.panel.append(pitWarningOutput);
    renderPitWarnings(current);
  }
  function replaceOrAppend(element, replaceId, message) {
    if (!currentGesture()) return false;
    const elements = allElements();
    if (replaceId && !elements.some(item => item.id === replaceId)) { notify('วัตถุต้นทางไม่อยู่แล้ว กรุณาเลือกใหม่'); return false; }
    // Allocate only when appending, against the kind's current mark registry.
    // Count + 1 collides after deletion; M/PE/size edits must keep their mark.
    if (!replaceId) element = { ...element, mark: nextCadDrawingMark(elements, element.kind, element.level) };
    const next = replaceId ? elements.map(item => item.id === replaceId ? element : item) : [...elements, element];
    if (!replaceId && elements.some(item => item.id === element.id)) { notify('รหัสซ้ำ กรุณาเริ่มวางใหม่'); return false; }
    const result = commitElements(next, message);
    if (result === false) return false;
    state.selectedId = element.id;
    if (element.kind === 'lift-pit') loadSelectedPit();
    if (element.kind === 'lift-assembly') loadSelectedLift();
    clearMode(); invalidateSnap();
    setStatus(element.kind === 'lift-pit' ? `${message}\n${pitWarningText(pitFromDrawingElement(element))}` : message);
    renderPanel(); return true;
  }
  function finishLine() {
    if (!['L', 'PL'].includes(state.mode) || !currentGesture()) return;
    const shaft = getActiveTool() === 'shaft-outline';
    const result = createCadDrawingElement({ levelId: getLevelId(), points: state.vertices, closed: shaft || state.form.closed, shaft, elevationM: getLevelElevation() });
    if (!result.ok) { notify(`ยังจบเส้นไม่ได้: ${result.reason}`); return; }
    replaceOrAppend(result.element, null, shaft ? 'วางแนวปล่องแล้ว เป็นเส้นอ้างอิง ไม่เจาะพื้นอัตโนมัติ' : 'วางเส้นร่าง CAD แล้ว · ENGINE 0');
  }
  function eraseSelected() {
    if (backgroundNativeContext()) {
      if (!keyboardAllowed() || typeof options.eraseNativeSelection !== 'function') return;
      state.lastEditCommand = 'E';
      const ids = options.getNativeSelectionIds?.();
      if (Array.isArray(ids) && ids.length) {
        const result = options.eraseNativeSelection(); clearMode(); invalidateSnap();
        if (result === false || result?.ok === false) notify('ลบรายการที่เลือกไม่ได้ · ตรวจรายการที่ถูกป้องกัน');
      } else {
        resetGesture(); startGesture(); state.mode = 'E';
        setStatus('E · คลิกวัตถุที่จะลบ · Esc จบ'); renderPanel(); renderObjects(); renderGhost(); svg.focus?.();
      }
      return;
    }
    const current = selected();
    if (!current) { notify('เลือกวัตถุหรือสมาชิกก่อน'); return; }
    if (!currentGesture()) return;
    if (current.__cadEditableMember) { if (!state.gestureModel) startGesture(); editSelectedMember('E', null); return; }
    if (commitElements(allElements().filter(item => item.id !== current.id), 'ลบวัตถุ Drawing แล้ว ใช้ Undo ย้อนคืนได้') !== false) { state.selectedId = ''; clearMode(); invalidateSnap(); }
  }
  function editSelectedMember(command, delta) {
    if (!currentGesture()) return false;
    const current = selected();
    if (!current?.__cadEditableMember || typeof options.editMember !== 'function') { notify('HOLD: ตัวเชื่อมแก้ไขสมาชิกชนิดนี้ยังไม่พร้อม'); return false; }
    let result;
    const request = { command, id: current.id, delta, sourceModel: state.gestureModel || getModel(), levelId: state.gestureLevel || getLevelId() };
    try { result = options.editMember(request); } catch { result = fail('MEMBER_TRANSACTION_FAILED'); }
    resetGesture(); state.mode = 'select'; invalidateSnap();
    if (result?.ok !== true) { notify(`HOLD: ${result?.reason || 'MEMBER_TRANSACTION_FAILED'}`); renderPanel(); renderGhost(); return false; }
    state.selectedId = command === 'E' ? '' : typeof result.id === 'string' ? result.id : '';
    state.lastModel = getModel(); state.lastLevel = getLevelId();
    setStatus(`${command} สำเร็จ · ${result.id || current.mark || current.id} · ENGINE 0 · Undo ย้อนคืนได้`);
    renderPanel(); renderObjects(); renderGhost(); return true;
  }
  function memberValues(points) {
    const kind = memberKind(), form = memberForms[kind];
    if (!form) return null;
    const millimetres = value => Math.round(value * 1000) / 1000;
    return { kind, levelId: getLevelId(), pointsM: points.map(point => ({ x: millimetres(point.x), y: millimetres(point.y) })), widthM: millimetres(numberValue(form.widthM)), depthM: millimetres(numberValue(form.depthM)), baseElevationM: kind === 'column' ? millimetres(numberValue(form.baseElevationM)) : null, topElevationM: millimetres(numberValue(form.topElevationM)) };
  }
  function checkMember(values, geometry = true) {
    if (!values || getActiveTool() !== 'cad' || !keyboardAllowed()) return { valid: false, reason: 'เครื่องมือวางสมาชิกไม่พร้อมในแปลนนี้' };
    if (![values.widthM, values.depthM].every(value => Number.isFinite(value) && value > 0) || !Number.isFinite(values.topElevationM)) return { valid: false, reason: 'กรอก b, h และ Top EL ให้ครบ ขนาดต้องมากกว่า 0' };
    if (values.kind === 'column' && (!Number.isFinite(values.baseElevationM) || values.topElevationM <= values.baseElevationM)) return { valid: false, reason: 'กรอก Base EL และ Top EL ของเสา โดย Top ต้องสูงกว่า Base' };
    if (geometry && (values.pointsM.length !== (values.kind === 'beam' ? 2 : 1) || !values.pointsM.every(finitePoint))) return { valid: false, reason: 'ตำแหน่งสมาชิกไม่ครบ' };
    if (geometry && values.kind === 'beam' && Math.hypot(Math.round(values.pointsM[1].x * 1000) - Math.round(values.pointsM[0].x * 1000), Math.round(values.pointsM[1].y * 1000) - Math.round(values.pointsM[0].y * 1000)) < 10) return { valid: false, reason: 'คานต้องยาวอย่างน้อย 0.01 ม. หลังปัดพิกัด' };
    try { return typeof options.validateMember === 'function' ? options.validateMember(values) || { valid: false, reason: 'ตรวจข้อมูลสมาชิกไม่สำเร็จ' } : { valid: true }; }
    catch { return { valid: false, reason: 'ตรวจข้อมูลสมาชิกไม่สำเร็จ' }; }
  }
  function memberReady() {
    const checked = checkMember(memberValues([]), false);
    if (!checked.valid) { notify(checked.reason); return; }
    resetGesture(); startGesture(); state.memberFormSnapshot = JSON.stringify(memberForms[memberKind()]);
    setStatus(state.mode === 'B' ? 'B · คลิกจุดเริ่มแล้วจุดปลาย หรือลากแล้วปล่อย · วางซ้ำได้' : 'COL · คลิกวางเสาที่กึ่งกลางหน้าตัด · วางซ้ำได้');
    renderGhost(); svg.focus?.();
  }
  function commitMember(points) {
    if (!currentGesture()) return false;
    const values = memberValues(points), checked = checkMember(values);
    if (!checked.valid) { notify(checked.reason); return false; }
    if (typeof options.createMember !== 'function') { notify('ตัวเชื่อมสร้างสมาชิกยังไม่พร้อม'); return false; }
    const mode = state.mode, formKey = JSON.stringify(memberForms[values.kind]);
    let result;
    try { result = options.createMember(values); } catch { result = false; }
    resetGesture(); invalidateSnap();
    if (result?.ok !== true) { notify('วางสมาชิกไม่สำเร็จ ข้อมูลเดิมคงอยู่ กรุณาเริ่มตำแหน่งใหม่'); renderGhost(); return false; }
    // The bridge may synchronously refresh after its one atomic transaction.
    if (getActiveTool() === 'cad' && getLevelId() === values.levelId && formKey === JSON.stringify(memberForms[values.kind])) {
      state.mode = mode; state.lastModel = getModel(); state.lastLevel = getLevelId();
      startGesture(); state.memberFormSnapshot = formKey;
    }
    setStatus(`วาง ${result.element?.mark || (values.kind === 'beam' ? 'คาน' : 'เสา')} แล้ว · ENGINE 0 · พร้อมวางตัวถัดไป`);
    renderPanel(); renderObjects(); renderGhost(); return true;
  }
  function renderMemberGhost() {
    const kind = memberKind();
    if (!kind || !state.ghostPoint) return;
    const points = kind === 'beam' ? [state.vertices[0], state.ghostPoint] : [state.ghostPoint];
    if (!points.every(finitePoint)) return;
    const values = memberValues(points), checked = checkMember(values);
    if (!checked.valid) return;
    let polygon;
    const a = values.pointsM[0], half = values.widthM / 2;
    if (kind === 'column') polygon = [{ x: a.x - half, y: a.y - values.depthM / 2 }, { x: a.x + half, y: a.y - values.depthM / 2 }, { x: a.x + half, y: a.y + values.depthM / 2 }, { x: a.x - half, y: a.y + values.depthM / 2 }];
    else {
      const b = values.pointsM[1], length = Math.hypot(b.x - a.x, b.y - a.y), dx = -(b.y - a.y) / length * half, dy = (b.x - a.x) / length * half;
      polygon = [{ x: a.x + dx, y: a.y + dy }, { x: b.x + dx, y: b.y + dy }, { x: b.x - dx, y: b.y - dy }, { x: a.x - dx, y: a.y - dy }];
    }
    state.ghostLayer.append(svgNode('path', { 'data-cad-member-ghost': kind, d: pathData(polygon, true), fill: 'oklch(34% 0.125 258)', 'fill-opacity': '.12', stroke: 'oklch(34% 0.125 258)', 'stroke-width': 1.7, 'stroke-dasharray': '5 4', 'vector-effect': 'non-scaling-stroke' }));
  }
  function command(value) {
    state.commandBuffer = '';
    if (backgroundNativeContext() && ['E', 'TR', 'EX'].includes(value)) {
      if (!keyboardAllowed() || typeof options.activateTool !== 'function') return;
      // The native tool already owns this selection. Changing tools first can
      // clear it and incorrectly turn selected-first E into click-Erase.
      const nativeIds = value === 'E' ? options.getNativeSelectionIds?.() : null;
      if (Array.isArray(nativeIds) && nativeIds.length) { eraseSelected(); return; }
      if (getActiveTool() !== 'select') options.activateTool('select');
      if (getActiveTool() !== 'select' || !keyboardAllowed()) { notify('ยังเริ่มแก้ไขไม่ได้ · จบหรือยกเลิกคำสั่งเดิมก่อน'); return; }
    }
    if (backgroundNativeContext() && ['B', 'COL'].includes(value)) {
      clearMode(); options.activateTool?.(value === 'B' ? 'main-beam' : 'column'); return;
    }
    if (['TR', 'EX'].includes(value)) {
      if (!keyboardAllowed() || typeof options.editMember !== 'function') { notify('เครื่องมือแก้ปลายคานยังไม่พร้อม'); return; }
      if (backgroundEditing && getActiveTool() !== 'select') options.activateTool?.('select');
      resetGesture(); startGesture(); state.mode = value; state.lastEditCommand = value;
      if (value === 'TR') displaySnapMarker(null);
      setStatus(`${value} · ${value === 'TR' ? 'คลิกช่วงคานที่ไฮไลต์สีส้มเพื่อตัดออก' : 'คลิกด้านปลายคานให้ยืดถึงคานถัดไป'} · Esc จบ`);
      renderPanel(); renderObjects(); renderGhost(); svg.focus?.(); return;
    }
    if (value === 'LIFT') {
      if (typeof options.activateTool !== 'function') { notify('HOLD: เครื่องมือชุดลิฟต์ยังไม่พร้อม'); return; }
      if (selected()?.kind === 'lift-pit') {
        state.selectedId = ''; state.selectedLiftRecordKey = null;
        state.liftForm = Object.fromEntries(LIFT_ASSEMBLY_FIELDS.map(key => [key, '']));
        state.liftLevels = []; state.openingLevels = [];
      }
      resetGesture(); state.mode = 'select'; options.activateTool('lift-assembly');
      if (getActiveTool() !== 'lift-assembly') { notify('HOLD: ไม่สามารถเปิดเครื่องมือชุดลิฟต์'); return; }
      loadSelectedLift(); options.showMemberSettings?.(); setStatus('กรอกขนาดทุกส่วนและเลือกชั้น จากนั้นดูตัวอย่างแล้วคลิกวางกึ่งกลางปล่อง');
      renderPanel(); renderObjects(); renderGhost(); svg.focus?.(); return;
    }
    if (['B', 'COL'].includes(value) && getActiveTool() !== 'cad') { notify('B/COL ใช้ในเครื่องมือ CAD เท่านั้น'); return; }
    if (value === 'E') { eraseSelected(); return; }
    if (['PE', 'M', 'CO', 'O'].includes(value) && !selected()) { notify('เลือกวัตถุในแปลนหรือรายการก่อน'); return; }
    if (['PE', 'O'].includes(value) && !['cad-draft', 'shaft-outline'].includes(selected()?.kind)) { notify('HOLD: PE/Offset ใช้กับเส้นร่างและแนวปล่องเท่านั้น สมาชิกใช้ตัวแก้ไขเฉพาะชนิด'); return; }
    if (getActiveTool() === 'shaft-outline' && value === 'L') { notify('แนวปล่องต้องใช้ PL ปิดรูป'); return; }
    resetGesture(); startGesture(); state.mode = value;
    if (memberKind() && typeof options.showMemberSettings === 'function') options.showMemberSettings();
    setStatus({ L: 'คลิกจุดเริ่มและปลาย แล้ว Enter เพื่อรับเส้น', PL: 'คลิกจุดต่อเนื่อง หรือพิมพ์ระยะ แล้ว Enter เพื่อจบ', PE: 'คลิกจุดวงกลมที่ต้องการแก้ แล้วคลิกตำแหน่งใหม่', M: 'คลิกจุดจับต้นทาง แล้วคลิกตำแหน่งปลายทาง', CO: 'คลิกจุดจับต้นทาง แล้วคลิกตำแหน่งสำเนา', O: 'กรอกระยะและด้าน แล้วกดสร้างเส้น Offset', B: 'กรอกหน้าตัด b, h และ Top EL แล้วคลิก 2 จุด หรือลากเพื่อวางคาน', COL: 'กรอกหน้าตัด b, h, Base EL และ Top EL แล้วคลิกวางเสาซ้ำ' }[value]);
    renderPanel(); renderObjects(); renderGhost(); svg.focus?.();
  }
  function typedPoint(distanceM, angleDeg) {
    if (!['L', 'PL', 'B'].includes(state.mode) || !state.vertices.length) { notify('เริ่ม L/PL/B และคลิกจุดแรกก่อน'); return; }
    if (!Number.isFinite(distanceM) || distanceM <= 0 || (angleDeg !== null && !Number.isFinite(angleDeg))) { notify('กรอกระยะบวกและมุมที่เป็นตัวเลข'); return; }
    if (!currentGesture()) return;
    const last = state.vertices.at(-1);
    if (state.mode === 'L' && state.vertices.length >= 2) { notify('L มีสองจุดแล้ว กด Enter เพื่อรับเส้น'); return; }
    let radians;
    if (angleDeg !== null) radians = angleDeg * Math.PI / 180;
    else if (state.ghostPoint && Math.hypot(state.ghostPoint.x - last.x, state.ghostPoint.y - last.y) > 1e-9) radians = Math.atan2(state.ghostPoint.y - last.y, state.ghostPoint.x - last.x);
    else { notify('ระบุมุม หรือเลื่อนเมาส์กำหนดทิศทางก่อน'); return; }
    const point = { x: last.x + distanceM * Math.cos(radians), y: last.y + distanceM * Math.sin(radians) };
    if (!finitePoint(point)) { notify('ระยะเกินขอบเขตตัวเลข'); return; }
    if (state.mode === 'B') { commitMember([last, point]); return; }
    state.vertices.push(point); setStatus(`เพิ่มจุดตามระยะ ${distanceM} ม. แล้ว กด Enter เพื่อจบ`); renderGhost();
  }
  const numberValue = value => typeof value === 'string' && !value.trim() ? NaN : Number(value);
  function readPit() {
    const current = selected(), existing = current?.kind === 'lift-pit' ? pitFromDrawingElement(current) : null;
    const pit = { id: existing?.id || newId('DOE-PIT-'), levelId: getLevelId(), center: existing?.center || { x: 0, y: 0 }, ...Object.fromEntries(PIT_FIELDS.map(key => [key, numberValue(state.pitForm[key])])) };
    const result = pitGeometry(pit);
    if (!result.ok) { notify(`กรอกขนาดหลุมให้ครบและเป็นค่าบวก: ${result.reason}`); return null; }
    return pit;
  }
  function readLift({ asNew = false } = {}) {
    const current = selected(), existing = current?.kind === 'lift-assembly' ? liftAssemblyFromDrawingElement(current) : null;
    const input = { ...Object.fromEntries(LIFT_ASSEMBLY_FIELDS.map(key => [key, numberValue(state.liftForm[key])])),
      centerXM: existing?.ok ? existing.input.centerXM : 0, centerYM: existing?.ok ? existing.input.centerYM : 0,
      levelId: !asNew && existing?.ok ? existing.input.levelId : getLevelId(), servedLevels: state.liftLevels.map(level => ({ ...level })) };
    if (input.servedLevels.some(saved => !getLevels().some(level => level.id === saved.levelId && level.elevationM === saved.elevationM))) { notify('HOLD: ชั้นหรือระดับอ้างอิงเปลี่ยนแล้ว กรุณาเลือกชั้นใหม่'); return null; }
    const result = liftAssemblyGeometry(input);
    if (!result.ok) { notify(`HOLD: กรอกขนาดลิฟต์ทุกส่วนและตรวจการวางภายในปล่อง · ${result.reason}`); return null; }
    return input;
  }
  function currentLiftPreview() {
    if (state.liftFit) return state.liftFit.input;
    return state.pendingLift && state.ghostPoint ? { ...state.pendingLift.input, centerXM: state.ghostPoint.x, centerYM: state.ghostPoint.y } : null;
  }
  function placeLift(copy) {
    const current = selected(), input = readLift({ asNew: copy }); if (!input) return;
    if (!copy && current?.kind !== 'lift-assembly') return;
    const id = copy ? newId('DOE-LIFT-') : current.id;
    resetGesture(); startGesture(); state.pendingLift = { input, id, replaceId: copy ? null : current.id, mark: copy ? '' : current.mark, origin: copy ? null : current }; state.mode = 'lift-place';
    if (copy) state.selectedId = '';
    setStatus('ภาพร่างชุดลิฟต์ · คลิกวางกึ่งกลางปล่องตาม Snap · ไม่เจาะพื้น'); renderPanel(); renderObjects(); renderGhost(); svg.focus?.();
  }
  function fitLiftPreview() {
    const input = readLift({ asNew: true }); if (!input) return;
    const boundary = (getClosedBoundaries?.() || []).find(item => item.id === state.form.boundaryId);
    if (!boundary) { notify('เลือกกรอบช่องโล่งที่ปิดครบก่อน'); return; }
    const pit = { ...Object.fromEntries(PIT_FIELDS.map(key => [key, input[key]])), center: { x: input.centerXM, y: input.centerYM } };
    const fitted = fitPitToBounds(pit, boundary.bounds, { basis: state.form.fitBasis });
    if (!fitted.ok) { notify(`HOLD: ใช้กรอบนี้ไม่ได้ · ${fitted.reason}`); return; }
    const next = { ...input, centerXM: fitted.pit.center.x, centerYM: fitted.pit.center.y, innerWidthM: fitted.pit.innerWidthM, innerLengthM: fitted.pit.innerLengthM };
    const checked = liftAssemblyGeometry(next);
    if (!checked.ok) { notify(`HOLD: Fit แล้วส่วนประกอบไม่อยู่ภายในปล่อง · ${checked.reason}`); return; }
    resetGesture(); startGesture(); state.mode = 'lift-fit';
    state.liftFit = { input: next, id: newId('DOE-LIFT-'), boundaryId: boundary.id, boundsKey: JSON.stringify(boundary.bounds) };
    setStatus(`ภาพร่าง Fit ช่องใน ${next.innerWidthM.toFixed(3)} × ${next.innerLengthM.toFixed(3)} ม. · ยืนยันเพื่อวางใหม่ ไม่เจาะพื้น`); renderPanel(); renderGhost();
    const details = state.panel.querySelector('[data-cad-action="lift-fit"]')?.closest('details'); if (details) details.open = true;
  }
  function previewLiftOpenings() {
    const current = selected();
    if (current?.kind !== 'lift-assembly' || typeof options.previewLiftOpenings !== 'function') { notify('HOLD: ตัวตรวจช่องเปิดลิฟต์ยังไม่พร้อม'); return; }
    const input = readLift(); if (!input) return;
    const saved = liftAssemblyFromDrawingElement(current);
    if (!saved.ok || LIFT_ASSEMBLY_FIELDS.some(key => input[key] !== saved.input[key]) || JSON.stringify(input.servedLevels) !== JSON.stringify(saved.input.servedLevels)) { notify('HOLD: อัปเดตขนาดและชั้นของลิฟต์ก่อนตรวจช่องเปิด'); return; }
    const levelIds = [...state.openingLevels];
    resetGesture(); startGesture(); state.mode = 'select';
    if (!levelIds.length) { notify('HOLD: เลือกอย่างน้อยหนึ่งชั้นที่จะเจาะ'); renderPanel(); return; }
    let result;
    try { result = options.previewLiftOpenings(current.id, levelIds); } catch { result = fail('OPENING_PREVIEW_FAILED'); }
    if (!currentGesture()) return;
    if (!Array.isArray(result?.rows)) { notify(`HOLD: ${result?.reason || 'OPENING_PREVIEW_FAILED'}`); return; }
    const rows = result.rows.filter(row => row && typeof row === 'object');
    const completeCoverage = levelIds.every(levelId => rows.some(row => row.levelId === levelId)) && rows.every(row => levelIds.includes(row.levelId));
    state.openingPreview = { ...result, rows, ok: result.ok === true && rows.length === result.rows.length && completeCoverage, selectedId: current.id, levelIds };
    setStatus(result.ok === true ? 'ตรวจรายการแล้ว ยังไม่เจาะพื้น · ตรวจทุกแถวก่อนยืนยัน' : `HOLD: ${result.reason || 'ยังมี host ที่ไม่พร้อม ทั้งชุดยังไม่ถูกเจาะ'}`); renderPanel(); renderGhost();
  }
  function commitLiftOpenings() {
    const preview = state.openingPreview;
    if (!preview || !currentGesture()) return;
    if (preview.selectedId !== state.selectedId || preview.ok !== true || !preview.rows.length || preview.rows.some(row => row.ok !== true) || preview.token == null || JSON.stringify(preview.levelIds) !== JSON.stringify(state.openingLevels)) { notify('HOLD: ตรวจชุดช่องเปิดใหม่ก่อนยืนยัน'); return; }
    if (typeof options.commitLiftOpenings !== 'function') { notify('HOLD: ตัวบันทึกช่องเปิดยังไม่พร้อม'); return; }
    let result;
    try { result = options.commitLiftOpenings(preview.token); } catch { result = fail('OPENING_COMMIT_FAILED'); }
    resetGesture(); state.mode = 'select'; invalidateSnap();
    setStatus(result?.ok === true ? 'บันทึกช่องเปิดทั้งชุดแล้ว · Undo ย้อนคืนได้ · ENGINE 0' : `HOLD: ${result?.reason || 'OPENING_COMMIT_FAILED'} · กรุณาตรวจชุดใหม่`);
    renderPanel(); renderObjects(); renderGhost();
  }
  function placePit(copy) {
    const pit = readPit(); if (!pit) return;
    if (copy) { pit.id = newId('DOE-PIT-'); state.selectedId = ''; }
    resetGesture(); startGesture(); state.pendingPit = pit; state.mode = 'pit-place';
    setStatus('ลากภาพหลุมไป Snap แล้วคลิกวาง ขนาดคงเดิม ไม่มีการตัดพื้นหรือลบคาน'); renderPanel(); renderObjects(); renderGhost();
  }
  function fitPreview() {
    const pit = readPit(); if (!pit) return;
    const boundary = (getClosedBoundaries?.() || []).find(item => item.id === state.form.boundaryId);
    if (!boundary) { notify('เลือกกรอบช่องโล่งที่ปิดครบก่อน'); return; }
    const fitted = fitPitToBounds(pit, boundary.bounds, { basis: state.form.fitBasis });
    if (!fitted.ok) { notify(`ใช้กรอบนี้ไม่ได้: ${fitted.reason}`); return; }
    resetGesture(); startGesture(); state.mode = 'pit-fit';
    state.fitPreview = { pit: { ...fitted.pit, id: newId('DOE-PIT-') }, boundaryId: boundary.id, boundsKey: JSON.stringify(boundary.bounds) };
    setStatus(`ตัวอย่างช่องใน ${fitted.pit.innerWidthM.toFixed(3)} × ${fitted.pit.innerLengthM.toFixed(3)} ม. กดยอมรับเพื่อวาง ไม่เจาะพื้น`); renderPanel(); renderGhost();
    const details = state.panel.querySelector('[data-cad-action="pit-fit"]')?.closest('details'); if (details) details.open = true;
  }
  function onPanelClick(event) {
    const button = event.target.closest('button'); if (!button || button.disabled) return;
    const requested = button.dataset.cadCommand;
    if (requested) { command(requested); return; }
    const action = button.dataset.cadAction;
    if (action === 'member-ready') memberReady();
    if (action === 'cancel') clearMode();
    if (action === 'finish') finishLine();
    if (action === 'erase') eraseSelected();
    if (action === 'typed-point') typedPoint(numberValue(state.form.length), state.form.angle.trim() ? numberValue(state.form.angle) : null);
    if (action === 'lift-new') placeLift(true);
    if (action === 'lift-move') placeLift(false);
    if (action === 'lift-update') {
      const current = selected(), input = readLift();
      if (current?.kind === 'lift-assembly' && input) {
        resetGesture(); startGesture();
        const result = createLiftAssemblyDrawingElement(input, { id: current.id, mark: current.mark });
        if (result.ok) replaceOrAppend({ ...current, ...result.element, label: current.label }, current.id, 'อัปเดตชุดลิฟต์อ้างอิงแล้ว ไม่แก้ช่องเปิดพื้นเดิม');
      }
    }
    if (action === 'lift-fit') fitLiftPreview();
    if (action === 'lift-fit-accept') {
      if (!state.liftFit || !currentGesture()) return;
      const boundary = (getClosedBoundaries?.() || []).find(item => item.id === state.liftFit.boundaryId);
      if (!boundary || JSON.stringify(boundary.bounds) !== state.liftFit.boundsKey) { clearMode(); notify('HOLD: กรอบอ้างอิงเปลี่ยนแล้ว กรุณาดูตัวอย่างใหม่'); return; }
      const result = createLiftAssemblyDrawingElement(state.liftFit.input, { id: state.liftFit.id });
      if (result.ok) replaceOrAppend(result.element, null, 'วางชุดลิฟต์ตามกรอบแล้ว ไม่เจาะพื้นหรือลบคาน');
    }
    if (action === 'lift-openings-preview') previewLiftOpenings();
    if (action === 'lift-openings-commit') commitLiftOpenings();
    if (action === 'lift-openings-cancel') clearMode();
    if (action === 'pit-new') placePit(true);
    if (action === 'pit-move') placePit(false);
    if (action === 'pit-update') {
      const current = selected(), pit = readPit();
      if (current?.kind === 'lift-pit' && pit) { resetGesture(); startGesture(); const result = createPitDrawingElement(pit, { mark: current.mark }); if (result.ok) replaceOrAppend(result.element, current.id, 'อัปเดตหลุมลิฟท์แล้ว ตรวจการชนพื้น/คานก่อนใช้งาน'); }
    }
    if (action === 'pit-fit') fitPreview();
    if (action === 'pit-fit-accept') {
      if (!state.fitPreview || !currentGesture()) return;
      const boundary = (getClosedBoundaries?.() || []).find(item => item.id === state.fitPreview.boundaryId);
      if (!boundary || JSON.stringify(boundary.bounds) !== state.fitPreview.boundsKey) { clearMode(); notify('กรอบอ้างอิงเปลี่ยนแล้ว กรุณาดูตัวอย่างใหม่'); return; }
      const result = createPitDrawingElement(state.fitPreview.pit);
      if (result.ok) replaceOrAppend(result.element, null, 'วางหลุมตามกรอบแล้ว ไม่ตัดพื้นหรือลบคานเดิม');
    }
    if (action === 'offset') {
      const current = selected(), amount = numberValue(state.form.offset);
      if (!current || !['cad-draft', 'shaft-outline'].includes(current.kind) || !Number.isFinite(amount) || amount <= 0) { notify('เลือกเส้นร่างหรือแนวปล่อง และกรอกระยะ Offset มากกว่า 0'); return; }
      if (!currentGesture()) return;
      const offset = offsetPolyline(current.pointsM, amount * (state.form.side === 'right' ? -1 : 1), { closed: current.cadGeometryInput?.closed });
      if (!offset.ok) { notify(`Offset ไม่ได้: ${offset.reason}`); return; }
      const result = createCadDrawingElement({ levelId: current.level, points: offset.points, closed: current.cadGeometryInput?.closed, shaft: current.kind === 'shaft-outline', elevationM: current.cadGeometryInput?.elevationM });
      if (result.ok) replaceOrAppend(result.element, null, 'สร้างเส้น Offset แล้ว เส้นต้นทางคงอยู่');
    }
    if (action === 'convert') {
      const current = selected();
      if (current?.kind !== 'cad-draft') return;
      if (typeof convertDraft !== 'function') { notify('ตัวเชื่อมแปลงสมาชิกยังไม่พร้อม'); return; }
      const values = { kind: state.form.convertKind, widthM: numberValue(state.form.widthM), depthM: numberValue(state.form.depthM), thicknessM: numberValue(state.form.thicknessM), elevationM: numberValue(state.form.elevationM) };
      const required = values.kind === 'beam' ? ['widthM', 'depthM'] : ['thicknessM'];
      if (!Number.isFinite(values.elevationM) || required.some(key => !Number.isFinite(values[key]) || values[key] <= 0)) { notify('กรอกขนาดสมาชิกและระดับ EL ให้ครบ'); return; }
      if (convertDraft(current.id, values) !== false) { state.selectedId = ''; clearMode(); invalidateSnap(); }
    }
  }
  function onPanelInput(event) {
    const target = event.target;
    if (target.dataset.cadMember && memberKind()) {
      memberForms[memberKind()][target.dataset.cadMember] = target.value;
      resetGesture(); setStatus('ขนาดสมาชิกเปลี่ยนแล้ว เริ่มตำแหน่งใหม่ด้วยขนาดที่กรอก'); renderGhost(); return;
    }
    if (target.dataset.cadSnapToggle !== undefined) { setSnapEnabled(target.checked, event); return; }
    if (target.matches('[data-cad-select]')) {
      resetGesture(); state.mode = 'select'; state.selectedId = target.value; loadSelectedPit(); loadSelectedLift(); invalidateSnap(); renderPanel(); renderObjects(); renderGhost(); return;
    }
    if (target.dataset.cadLift || target.dataset.cadLiftLevel) {
      if (target.dataset.cadLift) state.liftForm[target.dataset.cadLift] = target.value;
      if (target.dataset.cadLiftLevel) {
        const level = getLevels().find(item => item.id === target.dataset.cadLiftLevel);
        state.liftLevels = state.liftLevels.filter(item => item.levelId !== target.dataset.cadLiftLevel);
        if (target.checked && level && Number.isFinite(level.elevationM)) state.liftLevels.push({ levelId: level.id, elevationM: level.elevationM });
      }
      resetGesture(); state.mode = 'select'; setStatus('ข้อมูลลิฟต์เปลี่ยนแล้ว · ดูตัวอย่างหรืออัปเดตใหม่ก่อน · ยังไม่เจาะพื้น'); renderGhost();
      for (const action of ['lift-fit-accept', 'lift-openings-commit']) { const button = state.panel.querySelector(`[data-cad-action="${action}"]`); if (button) button.disabled = true; }
      return;
    }
    if (target.dataset.cadOpeningLevel) {
      state.openingLevels = state.openingLevels.filter(id => id !== target.dataset.cadOpeningLevel);
      if (target.checked) state.openingLevels.push(target.dataset.cadOpeningLevel);
      resetGesture(); state.mode = 'select'; setStatus('ชั้นที่จะเจาะเปลี่ยนแล้ว · ต้องตรวจชุดชั้นที่เลือกอีกครั้ง');
      const button = state.panel.querySelector('[data-cad-action="lift-openings-commit"]'); if (button) button.disabled = true;
      renderGhost(); return;
    }
    if (target.dataset.cadForm) {
      state.form[target.dataset.cadForm] = target.type === 'checkbox' ? target.checked : target.value;
      if (state.fitPreview && ['boundaryId', 'fitBasis'].includes(target.dataset.cadForm)) {
        resetGesture(); state.mode = 'select'; setStatus('กรอบหรือขอบอ้างอิงเปลี่ยนแล้ว กดดูขนาดตามกรอบใหม่'); renderGhost();
        const accept = state.panel.querySelector('[data-cad-action="pit-fit-accept"]'); if (accept) accept.disabled = true;
      }
      if (state.liftFit && ['boundaryId', 'fitBasis'].includes(target.dataset.cadForm)) {
        resetGesture(); state.mode = 'select'; setStatus('กรอบหรือขอบอ้างอิงเปลี่ยนแล้ว กดดูตัวอย่าง Fit ใหม่'); renderGhost();
        const accept = state.panel.querySelector('[data-cad-action="lift-fit-accept"]'); if (accept) accept.disabled = true;
      }
    }
    if (target.dataset.cadPit) {
      state.pitForm[target.dataset.cadPit] = target.value;
      if (state.pendingPit || state.fitPreview) { resetGesture(); state.mode = 'select'; setStatus('ขนาดเปลี่ยนแล้ว กดวางหรือดูกรอบใหม่ก่อน'); renderGhost(); const accept = state.panel.querySelector('[data-cad-action="pit-fit-accept"]'); if (accept) accept.disabled = true; }
    }
    if (target.dataset.cadSnap) state.enabled[target.dataset.cadSnap] = target.checked;
  }
  function onPanelKey(event) {
    if (event.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); clearMode(); return; }
    if (event.key !== 'Enter') return;
    if (event.target.dataset.cadForm === 'command') {
      event.preventDefault(); event.stopImmediatePropagation(); const text = state.form.command; state.form.command = ''; event.target.value = ''; executeText(text);
    } else if (['length', 'angle'].includes(event.target.dataset.cadForm)) { event.preventDefault(); event.stopImmediatePropagation(); typedPoint(numberValue(state.form.length), state.form.angle.trim() ? numberValue(state.form.angle) : null); }
  }
  function onPointerMove(event) {
    if (!active() || (state.memberPointer && event.pointerId !== state.memberPointer.id)) return;
    if (editMode() && !keyboardAllowed()) { clearMode(); return; }
    state.pointerEvent = event;
    if (state.raf) return;
    const epoch = state.pointerEpoch;
    state.raf = requestFrame(() => {
      state.raf = 0;
      if (destroyed || !active() || epoch !== state.pointerEpoch || !state.pointerEvent || !currentGesture()) return;
      if (state.mode === 'TR' && !keyboardAllowed()) { clearMode(); return; }
      if (state.mode === 'TR') {
        const point = pointFromEvent(state.pointerEvent);
        state.ghostPoint = finitePoint(point) ? copyPoint(point) : null; state.ghostSnap = null;
        displaySnapMarker(null);
      } else state.ghostPoint = pickPoint(state.pointerEvent);
      if (state.mode === 'E') state.erasePreview = memberAtEvent(state.pointerEvent);
      else if (editMode()) previewTrimExtend(state.pointerEvent);
      renderGhost();
    });
  }
  function onPointerLeave() {
    if (state.mode !== 'TR' || state.memberPointer || (state.editPointer && !state.editPointer.released)) return;
    state.pointerEpoch += 1; state.pointerEvent = null; state.lastPlanPointer = null;
    state.editPreview = null; state.ghostPoint = null; state.ghostSnap = null;
    if (state.raf) view.cancelAnimationFrame?.(state.raf);
    state.raf = 0; displaySnapMarker(null); renderGhost();
  }
  function memberAtEvent(event) {
    const members = editableMembers();
    const id = event.target?.closest?.('[data-cad-element]')?.dataset.cadElement;
    const direct = members.filter(item => item.id === id);
    // Wide transparent pick strokes overlap at joints. Paint order must not
    // steal an endpoint click from a geometrically closer crossing beam.
    // Closed objects still need their explicit hit target for erase.
    if (direct.length === 1 && (direct[0].closed === true || direct[0].pointsM.length !== 2)) return direct[0];
    const point = pointFromEvent(event), tolerance = 9 * (metresPerPixel() || 0);
    if (!finitePoint(point)) return null;
    const candidates = members.filter(item => item.closed !== true && item.pointsM.length === 2).map(item => {
      const [a, b] = item.pointsM, dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
      const t = length2 > 0 ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length2)) : 0;
      return { item, distance: Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) };
    }).filter(item => item.distance <= tolerance).sort((a, b) => a.distance - b.distance || a.item.id.localeCompare(b.item.id));
    if (candidates.length > 1 && Math.abs(candidates[0].distance - candidates[1].distance) <= 1e-9) return null;
    return candidates[0]?.item || null;
  }
  function trimExtendResult(event, target = memberAtEvent(event)) {
    if (!target || target.closed === true || target.pointsM.length !== 2) return fail('เลือกคานเส้นตรงหนึ่งเส้น');
    if (target.protected) return fail('คานนี้ถูกป้องกัน · ไม่มีการแก้ไข');
    if (target.lineEditCurrent !== true) return fail('ข้อมูลคานไม่เป็นปัจจุบัน · ไม่มีการแก้ไข');
    if (String(target.kind).startsWith('native-') && target.kind !== 'native-secondary') {
      return fail('คานชนิดนี้ยังใช้ TR/EX ไม่ได้ · ใช้เครื่องมือคานเดิม');
    }
    const boundaries = editableMembers().filter(item => item.id !== target.id && item.lineEditCurrent === true && !item.closed && item.pointsM.length === 2);
    const result = quickTrimExtendSegments({ command: state.mode, points: target.pointsM, boundaries, clickPoint: pointFromEvent(event) });
    if (result.ok && result.segments.length === 2 && target.kind !== 'native-secondary') return fail('แยกช่วงกลางชนิดนี้ไม่ได้ · ไม่มีการเปลี่ยนคาน');
    return { ...result, id: target.id };
  }
  function previewTrimExtend(event) {
    state.editPreview = trimExtendResult(event);
  }
  function clickErase(event) {
    if (!keyboardAllowed() || !currentGesture()) return;
    const target = memberAtEvent(event);
    if (!target) { notify('E · คลิกวัตถุที่จะลบ · Esc จบ'); renderGhost(); return; }
    if (target.protected === true) { notify('วัตถุนี้ถูกป้องกัน · ไม่มีการลบ'); renderGhost(); return; }
    let result;
    try { result = options.editMember?.({ command: 'E', id: target.id, sourceModel: state.gestureModel, levelId: state.gestureLevel }); }
    catch { result = fail('MEMBER_TRANSACTION_FAILED'); }
    resetGesture(); invalidateSnap();
    if (result?.ok !== true) { state.mode = 'select'; notify(`ลบไม่ได้: ${result?.reason || 'MEMBER_TRANSACTION_FAILED'}`); }
    else if (getActiveTool() === 'select' && keyboardAllowed()) {
      state.mode = 'E'; state.lastModel = getModel(); state.lastLevel = getLevelId(); startGesture();
      setStatus('E · ลบแล้ว · คลิกวัตถุถัดไป หรือ Esc จบ');
    } else state.mode = 'select';
    renderPanel(); renderObjects(); renderGhost();
  }
  function clickTrimExtend(event) {
    if (!keyboardAllowed() || !currentGesture()) return;
    const target = memberAtEvent(event);
    const checked = trimExtendResult(event, target);
    if (!checked.ok) { notify(`แก้ปลายคานไม่ได้: ${checked.reason}`); state.editPreview = null; renderGhost(); return; }
    const commandName = state.mode, clickPoint = pointFromEvent(event);
    let result;
    try { result = options.editMember({ command: commandName, id: target.id, quick: true, boundaryIds: checked.boundaryIds, clickPoint: copyPoint(clickPoint), sourceModel: state.gestureModel, levelId: state.gestureLevel }); }
    catch { result = fail('MEMBER_TRANSACTION_FAILED'); }
    resetGesture(); invalidateSnap();
    if (result?.ok !== true) { state.mode = 'select'; notify(`แก้ปลายคานไม่ได้: ${result?.reason || 'MEMBER_TRANSACTION_FAILED'}`); }
    else {
      state.mode = commandName; state.lastModel = getModel(); state.lastLevel = getLevelId(); startGesture();
      setStatus(`${commandName} สำเร็จ · คลิก${commandName === 'TR' ? 'ช่วงที่ต้องการตัด' : 'ด้านปลายคาน'}ถัดไป${commandName === 'TR' ? ' · สีส้มคือช่วงที่จะตัดออก' : ''} · Ctrl+Z ย้อนคืน · Esc จบ`);
    }
    renderPanel(); renderObjects(); renderGhost();
  }
  function onPointerDown(event) {
    // A second touch or mouse button must not replace the primary edit that
    // still owns its release. Synthetic events without a pointer id cannot
    // establish a cross-event pointer identity.
    if (state.editPointer && !state.editPointer.released && state.editPointer.id !== undefined && event.pointerId !== undefined) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    if (event.button !== 0 || event.isPrimary === false) return;
    state.editPointer = null;
    if (!active()) return;
    if (editMode() && !keyboardAllowed()) { clearMode(); return; }
    event.preventDefault(); event.stopImmediatePropagation(); svg.focus?.();
    if (!currentGesture()) return;
    if (editMode()) {
      // A commit may rerender the inspector or change modes before mouseup.
      // Own the whole physical click, not just its pointerdown, so it cannot
      // select a different native beam underneath the newly fitted plan.
      state.editPointer = { id: event.pointerId, released: false };
      if (event.pointerId !== undefined) { try { svg.setPointerCapture?.(event.pointerId); } catch { /* Canceled pointer. */ } }
      if (state.mode === 'E') clickErase(event); else clickTrimExtend(event);
      return;
    }
    const targetElement = event.target.closest?.('[data-cad-element]');
    if (state.mode === 'select') {
      resetGesture(); state.selectedId = targetElement?.dataset.cadElement || ''; loadSelectedPit(); loadSelectedLift(); invalidateSnap(); renderPanel(); renderObjects(); renderGhost(); return;
    }
    const point = pickPoint(event, true); if (!point) return;
    state.ghostPoint = point;
    if (memberKind()) {
      if (state.memberPointer || event.isPrimary === false) return;
      const checked = checkMember(memberValues([]), false);
      if (!checked.valid) { notify(checked.reason); return; }
      if (!state.gestureModel) startGesture();
      state.memberFormSnapshot = JSON.stringify(memberForms[memberKind()]);
      const second = state.mode === 'B' && state.vertices.length === 1;
      if (state.mode === 'B' && !second) state.vertices = [point];
      state.memberPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, second };
      if (event.pointerId !== undefined) { try { svg.setPointerCapture?.(event.pointerId); } catch { /* Synthetic or already canceled pointer. */ } }
      renderGhost(); return;
    }
    if (['L', 'PL'].includes(state.mode)) {
      if (state.mode === 'L' && state.vertices.length >= 2) { notify('L มีสองจุดแล้ว กด Enter เพื่อรับเส้น'); return; }
      if (state.vertices.length && Math.hypot(point.x - state.vertices.at(-1).x, point.y - state.vertices.at(-1).y) <= 1e-9) return;
      state.vertices.push(point); setStatus(`วางแล้ว ${state.vertices.length} จุด · Enter จบ / Esc ยกเลิก`); renderGhost(); return;
    }
    const current = selected();
    if (state.mode === 'PE' && current) {
      if (state.vertexIndex === null) {
        const vertex = event.target.closest?.('[data-cad-vertex]');
        if (!vertex || vertex.dataset.cadElement !== current.id) { notify('คลิกจุดวงกลมบนเส้นที่เลือก'); return; }
        state.vertexIndex = Number(vertex.dataset.cadVertex); setStatus('คลิกตำแหน่งใหม่ของจุดนี้'); return;
      }
      const points = current.pointsM.map((item, index) => index === state.vertexIndex ? point : item);
      const result = createCadDrawingElement({ id: current.id, levelId: current.level, points, closed: current.cadGeometryInput?.closed, shaft: current.kind === 'shaft-outline', mark: current.mark, elevationM: current.cadGeometryInput?.elevationM });
      if (!result.ok) { notify(`ย้ายจุดไม่ได้: ${result.reason}`); return; }
      replaceOrAppend(result.element, current.id, 'ย้ายจุดบนเส้นแล้ว'); return;
    }
    if (['M', 'CO'].includes(state.mode) && current) {
      if (!state.basePoint) { state.basePoint = point; setStatus('คลิกตำแหน่งปลายทาง'); return; }
      const copy = state.mode === 'CO';
      const delta = { x: point.x - state.basePoint.x, y: point.y - state.basePoint.y };
      if (current.__cadEditableMember) { editSelectedMember(state.mode, delta); return; }
      const result = moveCadDrawingElement(current, delta, { copy });
      if (result.ok) replaceOrAppend(result.element, copy ? null : current.id, copy ? 'สร้างสำเนา Drawing แล้ว' : 'ย้าย Drawing แล้ว');
      else notify(`ย้ายไม่ได้: ${result.reason}`);
      return;
    }
    if (state.mode === 'pit-place' && state.pendingPit) {
      const pit = currentPitPreview(); if (!pit) return;
      const existing = allElements().find(item => item.id === pit.id);
      const result = createPitDrawingElement(pit, { mark: existing?.mark });
      if (result.ok) replaceOrAppend(result.element, existing?.id, 'วางหลุมลิฟท์แล้ว ตรวจการชนพื้น/คาน ไม่มีการตัดหรือลบอัตโนมัติ');
    }
    if (state.mode === 'lift-place' && state.pendingLift) {
      const input = currentLiftPreview(); if (!input) return;
      const { id, mark, replaceId, origin } = state.pendingLift;
      const result = createLiftAssemblyDrawingElement(input, { id, mark });
      if (result.ok) replaceOrAppend(origin ? { ...origin, ...result.element, label: origin.label } : result.element, replaceId, 'วางชุดลิฟต์อ้างอิงแล้ว · NOT INSTALLATION DESIGN · ไม่เจาะพื้น');
      else notify(`HOLD: ${result.reason}`);
    }
  }
  function onPointerUp(event) {
    if (state.editPointer && event.button === 0 && event.pointerId === state.editPointer.id) {
      state.editPointer.released = true;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.pointerId !== undefined) { try { svg.releasePointerCapture?.(event.pointerId); } catch { /* Already released. */ } }
      svg.focus?.();
      return;
    }
    if (!active() || event.button !== 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const pointer = state.memberPointer;
    if (!pointer || event.pointerId !== pointer.id || !currentGesture()) return;
    const point = pickPoint(event, true);
    const drag = Number.isFinite(pointer.x) && Number.isFinite(event.clientX) && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 4;
    releaseMemberPointer();
    if (!point) { clearMode(); return; }
    state.ghostPoint = point;
    if (state.mode === 'COL') commitMember([point]);
    else if (state.mode === 'B' && (drag || pointer.second)) commitMember([state.vertices[0], point]);
    else { setStatus('B · คลิกจุดปลายเพื่อวางคาน หรือ Esc ยกเลิก'); renderGhost(); }
  }
  function onPointerCancel(event) {
    if (state.editPointer && event.pointerId === state.editPointer.id && !state.editPointer.released) state.editPointer = null;
    if (!state.memberPointer || event.pointerId !== state.memberPointer.id) return;
    event.stopImmediatePropagation?.(); clearMode();
  }
  function executeText(text) {
    const parsed = parseCadCommand(text);
    if (backgroundNativeContext()) {
      if (parsed.kind === 'command' && ['TR', 'EX', 'E', 'B', 'COL'].includes(parsed.command)) command(parsed.command);
      else if (parsed.kind === 'finish' && state.lastEditCommand) command(state.lastEditCommand);
      else notify('ใช้ TR ตัด / EX ยืด / E ลบ / B คาน / COL เสา');
      renderCommandReadout();
      return;
    }
    if (parsed.kind === 'command') command(parsed.command);
    else if (parsed.kind === 'distance') typedPoint(parsed.distanceM, parsed.angleDeg);
    else if (parsed.kind === 'finish') finishLine();
    else notify('คำสั่งไม่ครบ: ใช้ L/PL/PE/M/CO/O/E/B/COL/LIFT หรือระยะ เช่น 3<90');
    renderCommandReadout();
  }
  function onKey(event) {
    if (destroyed || event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey) return;
    if (event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),a,[role="dialog"],[aria-modal="true"],[role="textbox"],[role="slider"]')) return;
    const onPlan = event.target === svg || svg.contains?.(event.target);
    const toolButton = event.target.closest?.('button,[role="button"]');
    const inToolControls = options.toolRail?.contains?.(event.target) || inspectorBody.contains?.(event.target) || options.keyboardCommandScope?.contains?.(event.target);
    // Thai layout still has the physical E/T/R/X keys. Use that fallback only
    // for a single non-ASCII character; never reinterpret ASCII, IME or inputs.
    const commandKey = backgroundNativeContext() && /^[^\x00-\x7f]$/.test(event.key) && /^Key[A-Z]$/.test(event.code || '') ? event.code.slice(3) : event.key;
    const commandPrefix = /^[a-z]$/i.test(commandKey) && (state.commandBuffer || /^[tebc]$/i.test(commandKey));
    // Keep Undo/Redo reachable on a Thai keyboard after a native erase. ASCII
    // shortcuts retain their letter meaning; inputs and IME returned above.
    const historyKey = /^[^\x00-\x7f]$/.test(event.key) && /^Key[ZY]$/.test(event.code || '') ? event.code.slice(3).toLowerCase() : event.key.toLowerCase();
    const nativeHistoryShortcut = (event.ctrlKey || event.metaKey) && /^[zy]$/.test(historyKey) && !state.commandBuffer;
    // Tool clicks leave focus on their native button. A literal command prefix
    // may transfer it to the plan; Space/Enter still activate that button.
    // A removed selection/inspector can also leave focus on body after erase.
    const prefixFromControls = backgroundNativeContext() && (commandPrefix || event.key === 'F3' || nativeHistoryShortcut) && (inToolControls || event.target === doc.body);
    const prefixFromPlanButton = backgroundNativeContext() && onPlan && (commandPrefix || event.key === 'F3' || nativeHistoryShortcut);
    if (toolButton && !prefixFromControls && !prefixFromPlanButton) return;
    if (!onPlan && !prefixFromControls) return;
    if (!keyboardAllowed()) {
      if (backgroundNativeContext() && commandPrefix && !event.ctrlKey && !event.metaKey && !event.repeat) {
        const reason = options.keyboardBlockedReason?.();
        if (typeof reason === 'string' && reason.trim()) toast?.(reason);
      }
      return;
    }
    const own = () => { event.preventDefault(); event.stopImmediatePropagation(); };
    if (backgroundEditing && event.key === 'F3' && !event.ctrlKey && !event.metaKey) {
      own(); if (!event.repeat) { setSnapEnabled(true, event); toast?.('Snap เปิดอยู่เสมอ · กด Alt ค้างเพื่อข้ามชั่วคราว'); } return;
    }
    if (backgroundNativeContext()) {
      // Native idle retains selection, Delete, marquee and Undo ownership.
      if (event.ctrlKey || event.metaKey) {
        // The host handles Select history, but its original tool shortcuts do
        // not. Selected-first erase intentionally stays in that native tool.
        if (getActiveTool() === 'select' || state.commandBuffer) return;
        const key = historyKey;
        const action = key === 'y' || (key === 'z' && event.shiftKey) ? options.redo : key === 'z' ? options.undo : null;
        if (typeof action === 'function') { own(); if (!event.repeat) { clearMode(); action(); } }
        return;
      }
      if (event.key === 'Escape') {
        if (state.commandBuffer || editMode()) { own(); clearMode(); options.activateTool?.('select'); }
        return;
      }
      if (event.key === 'Backspace') {
        if (state.commandBuffer) { own(); state.commandBuffer = state.commandBuffer.slice(0, -1); renderCommandReadout(); }
        return;
      }
      if (event.key === 'Delete') return;
      if (event.key === 'Enter' || event.key === ' ') {
        if (!state.commandBuffer && !editMode() && event.target !== svg) return;
        if (!state.commandBuffer && !state.lastEditCommand) return;
        own(); if (event.repeat) return;
        const text = state.commandBuffer; state.commandBuffer = ''; executeText(text); return;
      }
      if (commandPrefix) {
        own(); if (!event.repeat && state.commandBuffer.length < 16) state.commandBuffer += commandKey.toUpperCase();
        svg.focus?.(); renderCommandReadout();
      }
      return;
    }
    if (event.ctrlKey || event.metaKey) {
      if (!active()) return;
      const key = historyKey;
      const action = key === 'y' || (key === 'z' && event.shiftKey) ? options.redo : key === 'z' ? options.undo : null;
      if (typeof action === 'function') { own(); clearMode(); action(); }
      return;
    }
    if (!active()) {
      if (backgroundEditing) return;
      if (!/^[lpmcoeb]$/i.test(event.key) || typeof options.activateTool !== 'function') return;
      options.activateTool('cad');
      if (!active() || !keyboardAllowed()) return;
    }
    if (event.key === 'Escape') {
      own();
      if (state.commandBuffer) { state.commandBuffer = ''; renderCommandReadout(); }
      else clearMode();
      return;
    }
    if (event.key === 'F8' || event.key === 'F3') {
      own(); if (event.repeat) return;
      if (event.key === 'F3') { setSnapEnabled(!state.snapEnabled, event); return; }
      state.form.ortho = !state.form.ortho;
      renderPanel(); renderGhost(); return;
    }
    if (event.key === 'Backspace') { own(); state.commandBuffer = state.commandBuffer.slice(0, -1); renderCommandReadout(); return; }
    if (event.key === 'Delete') { own(); if (!event.repeat && state.mode === 'select' && !state.commandBuffer) eraseSelected(); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      own(); if (event.repeat) return;
      const text = state.commandBuffer; state.commandBuffer = ''; executeText(text); return;
    }
    if (/^[a-z0-9@.<>+\-]$/i.test(event.key)) { own(); if (state.commandBuffer.length < 64) state.commandBuffer += event.key.toUpperCase(); renderCommandReadout(); }
  }
  // Capture active drawing gestures so older plan tools never receive the same action.
  svg.addEventListener('pointerdown', onPointerDown, true);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerleave', onPointerLeave);
  svg.addEventListener('pointerup', onPointerUp, true);
  svg.addEventListener('pointercancel', onPointerCancel, true);
  svg.addEventListener('lostpointercapture', onPointerCancel, true);
  const onNativeClick = event => {
    const ownedEdit = state.editPointer && (event.pointerId === undefined || event.pointerId === state.editPointer.id);
    if (!destroyed && (active() || ownedEdit) && event.button === 0) {
      event.preventDefault(); event.stopImmediatePropagation();
      if (ownedEdit) { state.editPointer = null; svg.focus?.(); }
    }
  };
  for (const eventName of ['click', 'dblclick']) svg.addEventListener(eventName, onNativeClick, true);
  doc.addEventListener('keydown', onKey, true);
  const onBlur = () => { displaySnapMarker(null); if (active() || state.commandBuffer) clearMode(); };
  view.addEventListener?.('blur', onBlur);
  function refresh() {
    if (destroyed) return;
    displaySnapMarker(null);
    const nextTool = getActiveTool(), nextModel = getModel(), nextLevel = getLevelId();
    if (nextTool !== state.tool || (state.lastModel && (state.lastModel !== nextModel || state.lastLevel !== nextLevel))) {
      const wasDrawing = state.gestureModel !== null;
      state.commandBuffer = ''; resetGesture(); state.mode = 'select';
      if (nextTool !== state.tool) setStatus(nextTool === 'lift-pit' ? 'กรอกขนาดหลุม แล้วกดวางหลุมใหม่' : nextTool === 'lift-assembly' ? 'กรอกขนาดลิฟต์ทุกส่วนและเลือกชั้น แล้วดูตัวอย่างก่อนวาง' : 'เลือก L / PL เพื่อเริ่ม หรือเลือกวัตถุเพื่อแก้ไข');
      else if (wasDrawing) setStatus('ข้อมูลแปลนเปลี่ยนแล้ว ยกเลิกภาพร่างเดิม กรุณาเริ่มใหม่');
    }
    state.tool = nextTool; state.lastModel = nextModel; state.lastLevel = nextLevel;
    if (state.mode === 'TR' && !keyboardAllowed()) clearMode();
    const current = selected();
    if (!current) state.selectedId = '';
    // Undo/Redo or an external edit may replace the selected saved geometry.
    // Reload only on a parameter/identity change, not on an unrelated model
    // refresh, so unfinished form input for the same record remains intact.
    if (liftRecordKey(current) !== state.selectedLiftRecordKey) loadSelectedLift();
    if (!state.pitForm.rimElevationM && Number.isFinite(getLevelElevation())) state.pitForm.rimElevationM = String(getLevelElevation());
    if (!state.form.elevationM && Number.isFinite(getLevelElevation())) state.form.elevationM = String(getLevelElevation());
    renderObjects(); renderGhost(); renderPanel(); renderSnapControls();
  }
  function destroy() {
    if (destroyed) return;
    destroyed = true; displaySnapMarker(null); resetGesture();
    const editPointer = state.editPointer; state.editPointer = null;
    if (editPointer && svg.hasPointerCapture?.(editPointer.id)) {
      try { svg.releasePointerCapture?.(editPointer.id); } catch { /* Already released. */ }
    }
    if (state.raf) view.cancelAnimationFrame?.(state.raf);
    state.raf = 0;
    for (const [name, handler, capture] of [['pointerdown', onPointerDown, true], ['pointermove', onPointerMove, false], ['pointerleave', onPointerLeave, false], ['pointerup', onPointerUp, true], ['pointercancel', onPointerCancel, true], ['lostpointercapture', onPointerCancel, true], ['click', onNativeClick, true], ['dblclick', onNativeClick, true]]) svg.removeEventListener?.(name, handler, capture);
    doc.removeEventListener?.('keydown', onKey, true); view.removeEventListener?.('blur', onBlur);
    state.layer?.remove(); state.panel?.remove(); snapSwitch?.remove();
  }
  refresh();
  return { refresh, cancel: clearMode, destroy, resolveSnapPoint, displaySnapMarker, getSnapEnabled: () => state.snapEnabled };
}
