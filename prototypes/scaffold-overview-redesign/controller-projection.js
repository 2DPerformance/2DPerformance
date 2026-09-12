export const CONTROLLER_PROJECTION_VERSION = 'sh01-overview-controller-projection-v3';
export const EXPECTED_CONTROLLER_MARKER = 'sh01-controlled-beta';
export const NATIVE_FORMULA_SOURCE = 'native-formula-grid-v2';

const RESULT_STATUSES = new Set(['pass', 'warn', 'fail']);
const DISPLAY_UNITS = new Set(['si', 'kgf']);
const SUPPORT_MODES = new Set(['pending', 'verified', 'outside']);
const RECOVERY_LEVELS = new Set(['fail', 'fail-screen', 'hold', 'warn']);
const AGGREGATE_LEVELS = new Set(['fail', 'hold']);
const PRESENTATION_STATE_KEYS = new Set(['unitMode']);
const FLOOR_CHECK_IDS = new Set(['floorPoint', 'floorUDL']);
const FORMULA_TEXT_KEYS = Object.freeze(['titleText', 'equationText', 'substitutionText', 'resultText', 'noteText']);
const FORMULA_ORDINALS = Object.freeze({
  withoutTube: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16]),
  withTube: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]),
});

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item, seen);
  return value;
}

function assertJsonSafe(value, label, seen = new WeakSet(), path = label) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${label}_NON_FINITE:${path}`);
    return;
  }
  if (typeof value !== 'object') throw new Error(`${label}_NOT_JSON:${path}`);
  if (seen.has(value)) throw new Error(`${label}_CIRCULAR:${path}`);
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, label, seen, `${path}[${index}]`));
  } else {
    for (const [key, item] of Object.entries(value)) {
      assertJsonSafe(item, label, seen, `${path}.${key}`);
    }
  }
  seen.delete(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function cloneJson(value, label, kind) {
  if (kind === 'array' ? !Array.isArray(value) : (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`${label}_${kind === 'array' ? 'NOT_ARRAY' : 'NOT_OBJECT'}`);
  }
  assertJsonSafe(value, label);
  const clone = JSON.parse(JSON.stringify(value));
  return { value: clone, json: JSON.stringify(canonicalize(clone)) };
}

const cloneJsonObject = (value, label) => cloneJson(value, label, 'object');
const cloneJsonArray = (value, label) => cloneJson(value, label, 'array');

function fnv1a(text) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
}

function strictFinite(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function close(left, right, relativeTolerance = 1e-9) {
  if (!strictFinite(left) || !strictFinite(right)) return false;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return Math.abs(left - right) <= Math.max(1e-6, scale * relativeTolerance);
}

function nativeFormulaNumber(value, digits = 2) {
  return Number(value || 0).toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function engineeringState(value) {
  const copy = { ...value };
  for (const key of PRESENTATION_STATE_KEYS) delete copy[key];
  return canonicalize(copy);
}

function validateResultStateMirror(state, result) {
  if (!result.s || typeof result.s !== 'object' || Array.isArray(result.s)) {
    throw new Error('RESULT_SOURCE_STATE_MISSING');
  }
  if (JSON.stringify(engineeringState(state)) !== JSON.stringify(engineeringState(result.s))) {
    throw new Error('RESULT_STATE_MISMATCH');
  }
}

function validateStateShape(state) {
  const numericKeys = [
    'width', 'length', 'height', 'slabT', 'joistSpacing', 'plywoodT',
    'gammaConcrete', 'rebarLoad', 'formLoad', 'liveLoad', 'impact',
    ...(Object.hasOwn(state,'additionalDeadLoad')?['additionalDeadLoad']:[]),
  ];
  const stringKeys = ['projectName', 'zone', 'scaffoldType', 'joistProfile', 'bearerProfile'];
  const additiveLoadKeys = ['rebarLoad', 'formLoad', 'liveLoad', ...(Object.hasOwn(state,'additionalDeadLoad')?['additionalDeadLoad']:[])];
  if (!numericKeys.every((key) => strictFinite(state[key]))
    || !stringKeys.every((key) => typeof state[key] === 'string')
    || typeof state.manufacturerVerified !== 'boolean'
    || typeof state.floorCapacityVerified !== 'boolean'
    || typeof state.useTubeCheck !== 'boolean'
    || !Array.isArray(state.removedPosts)) {
    throw new Error('STATE_PRESENTATION_FIELDS_INVALID');
  }
  if (additiveLoadKeys.some((key) => state[key] < 0)) {
    throw new Error('STATE_FORMULA_OPERAND_INVALID');
  }
}

function validateResultShape(result) {
  if (!RESULT_STATUSES.has(result.status)) throw new Error('RESULT_STATUS_UNKNOWN');
  if (!result.inputDomain || typeof result.inputDomain !== 'object'
    || typeof result.inputDomain.valid !== 'boolean') throw new Error('RESULT_INPUT_DOMAIN_INVALID');
  if (!Array.isArray(result.checks)) throw new Error('RESULT_CHECKS_MISSING');
  const checkIds = new Set();
  for (const check of result.checks) {
    if (!check || typeof check !== 'object' || typeof check.id !== 'string'
      || typeof check.name !== 'string' || !strictFinite(check.value) || checkIds.has(check.id)) {
      throw new Error('RESULT_CHECK_INVALID');
    }
    checkIds.add(check.id);
  }
  if (!result.checks.some((check) => !FLOOR_CHECK_IDS.has(check.id))) {
    throw new Error('RESULT_GOVERNING_CHECK_MISSING');
  }
  if (!strictFinite(result.area)) throw new Error('RESULT_AREA_INVALID');
  if (!Array.isArray(result.posts)) throw new Error('RESULT_POSTS_INVALID');
  const postKeys = ['x', 'y', 'tribArea', 'Parea', 'Pbeam', 'Pzone', 'Ppoint', 'P'];
  if (typeof result.maxPost?.id !== 'string' || result.maxPost.id.length === 0
    || !postKeys.every((key) => strictFinite(result.maxPost?.[key]))) throw new Error('RESULT_PMAX_INVALID');
  const matchingPosts = result.posts.filter((post) => post?.id === result.maxPost.id
    && postKeys.every((key) => close(post?.[key], result.maxPost[key])));
  if (matchingPosts.length !== 1) throw new Error('RESULT_PMAX_ROW_MISMATCH');
  if (!strictFinite(result.q)) throw new Error('RESULT_PRESSURE_INVALID');
  if (![result.qConc, result.factor, result.postCapacity, result.postUtil].every(strictFinite)
    || result.postCapacity <= 0) throw new Error('RESULT_EVIDENCE_FIELDS_INVALID');
  const postParts = result.maxPost.Parea + result.maxPost.Pbeam
    + result.maxPost.Pzone + result.maxPost.Ppoint;
  if (!close(result.maxPost.P, postParts)) throw new Error('RESULT_POST_DECOMPOSITION_MISMATCH');
  if (!close(result.postUtil, result.maxPost.P / result.postCapacity)) {
    throw new Error('RESULT_POST_UTILIZATION_MISMATCH');
  }
  const postChecks = result.checks.filter((check) => check.id === 'post');
  if (postChecks.length !== 1 || !close(postChecks[0].value, result.postUtil)) {
    throw new Error('RESULT_POST_CHECK_MISMATCH');
  }
  const concreteLoad = Math.max(0, stateLoad(result.s, 'gammaConcrete'))
    * Math.max(0, stateLoad(result.s, 'slabT'));
  if (!close(result.qConc, concreteLoad)) throw new Error('RESULT_CONCRETE_LOAD_MISMATCH');
  const loadFactor = Math.max(1, 1 + stateLoad(result.s, 'impact') / 100);
  if (!close(result.factor, loadFactor)) throw new Error('RESULT_LOAD_FACTOR_MISMATCH');
  const serviceLoad = (result.qConc + Math.max(0, stateLoad(result.s, 'rebarLoad'))
    + Math.max(0, stateLoad(result.s, 'formLoad'))
    + (Object.hasOwn(result.s,'additionalDeadLoad')?stateLoad(result.s,'additionalDeadLoad'):0)
    + Math.max(0, stateLoad(result.s, 'liveLoad'))) * result.factor;
  if (!close(result.q, serviceLoad)) throw new Error('RESULT_SERVICE_LOAD_MISMATCH');
}

function stateLoad(state, key) {
  const value = state?.[key];
  if (!strictFinite(value)) throw new Error('RESULT_EVIDENCE_FIELDS_INVALID');
  return value;
}

function validateFormulaEvidence(evidence, state, result) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)
    || evidence.source !== NATIVE_FORMULA_SOURCE || !Array.isArray(evidence.cards)) {
    throw new Error('FORMULA_EVIDENCE_INVALID');
  }
  const expected = state.useTubeCheck ? FORMULA_ORDINALS.withTube : FORMULA_ORDINALS.withoutTube;
  if (evidence.cards.length !== expected.length) throw new Error('FORMULA_CARDINALITY_INVALID');
  const ordinals = [];
  for (const card of evidence.cards) {
    if (!card || typeof card !== 'object' || Array.isArray(card)
      || !Number.isInteger(card.ordinal)
      || !FORMULA_TEXT_KEYS.every((key) => typeof card[key] === 'string'
        && card[key].trim().length > 0 && card[key].length <= 1200)) {
      throw new Error('FORMULA_CARD_INVALID');
    }
    ordinals.push(card.ordinal);
  }
  if (new Set(ordinals).size !== ordinals.length) throw new Error('FORMULA_CARD_DUPLICATE');
  if (ordinals.some((ordinal, index) => ordinal !== expected[index])) {
    throw new Error('FORMULA_CARD_INVALID');
  }

  const card = (ordinal) => evidence.cards.find((item) => item.ordinal === ordinal);
  const service = card(3);
  const tributary = card(5);
  const post = card(11);
  const expectedText = [
    [service.substitutionText, `= (${nativeFormulaNumber(result.qConc)} + ${nativeFormulaNumber(state.rebarLoad)} + ${nativeFormulaNumber(state.formLoad)}${Object.hasOwn(state,'additionalDeadLoad')?' + '+nativeFormulaNumber(state.additionalDeadLoad):''} + ${nativeFormulaNumber(state.liveLoad)}) × ${nativeFormulaNumber(result.factor, 3)}`],
    [service.resultText, `= ${nativeFormulaNumber(result.q)} kPa`],
    [tributary.substitutionText, `${result.maxPost.id} = ${nativeFormulaNumber(result.q)} × ${nativeFormulaNumber(result.maxPost.tribArea, 4)}`],
    [tributary.resultText, `= ${nativeFormulaNumber(result.maxPost.Parea)} kN`],
    [post.substitutionText, `= ${nativeFormulaNumber(result.maxPost.P)} / ${nativeFormulaNumber(result.postCapacity)}`],
    [post.resultText, `= ${nativeFormulaNumber(result.postUtil)}`],
  ];
  if (expectedText.some(([actual, expectedValue]) => actual !== expectedValue)) {
    throw new Error('FORMULA_RESULT_MISMATCH');
  }
}

function validateSupportRecord(record) {
  if (!SUPPORT_MODES.has(record.mode)
    || typeof record.valid !== 'boolean'
    || typeof record.attested !== 'boolean'
    || typeof record.reference !== 'string'
    || typeof record.fingerprint !== 'string'
    || typeof record.reason !== 'string') throw new Error('SUPPORT_RECORD_INVALID');
}

function validateRecoveryItems(items) {
  for (const item of items) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || item.id.length === 0
      || !RECOVERY_LEVELS.has(item.level) || typeof item.label !== 'string'
      || typeof item.metric !== 'string' || typeof item.why !== 'string'
      || (item.action !== undefined && typeof item.action !== 'string')) {
      throw new Error('RECOVERY_ITEM_INVALID');
    }
  }
}

function validateAggregateStatus(status) {
  if (!status || typeof status !== 'object' || !AGGREGATE_LEVELS.has(status.level)
    || typeof status.text !== 'string' || !Number.isInteger(status.failureCount)
    || status.failureCount < 0 || !Number.isInteger(status.holdCount) || status.holdCount < 0) {
    throw new Error('AGGREGATE_STATUS_INVALID');
  }
}

function unavailable(phase, reason) {
  return deepFreeze({
    version: CONTROLLER_PROJECTION_VERSION,
    phase,
    reason: String(reason || (phase === 'stale' ? 'CONTROLLER_CHANGED_DURING_CAPTURE' : 'CONTROLLER_UNAVAILABLE')),
    authority: 'REVIEW ONLY · NOT FOR CONSTRUCTION',
  });
}

const hold = (reason) => unavailable('hold', reason);
const stale = (reason) => unavailable('stale', reason);

function readCapture(port) {
  return {
    state: cloneJsonObject(port.api.getState(), 'STATE'),
    result: cloneJsonObject(port.api.getResult(), 'RESULT'),
    support: cloneJsonObject(port.recovery.getSupportRecord(), 'SUPPORT'),
    recovery: cloneJsonArray(port.recovery.recoveryItems(), 'RECOVERY'),
    aggregate: cloneJsonObject(port.status.overviewStatus(), 'AGGREGATE'),
    formula: cloneJsonObject(port.evidence.formulaCards(), 'FORMULA'),
  };
}

function captureBytes(reading) {
  return [reading.state.json, reading.result.json, reading.support.json,
    reading.recovery.json, reading.aggregate.json, reading.formula.json].join('\n');
}

export function captureControllerProjection(port) {
  try {
    if (!port || port.marker !== EXPECTED_CONTROLLER_MARKER) return hold('CONTROLLER_MARKER_MISMATCH');
    if (typeof port.api?.getState !== 'function' || typeof port.api?.getResult !== 'function') {
      return hold('CONTROLLER_READ_API_MISSING');
    }
    if (typeof port.recovery?.getSupportRecord !== 'function'
      || typeof port.recovery?.recoveryItems !== 'function') return hold('RECOVERY_READ_API_MISSING');
    if (typeof port.status?.overviewStatus !== 'function') return hold('AGGREGATE_READ_API_MISSING');
    if (typeof port.evidence?.formulaCards !== 'function') return hold('FORMULA_READ_API_MISSING');
    if (typeof port.unit?.mode !== 'function') return hold('UNIT_READ_API_MISSING');
    const kgfPerKN = port.api?.unit?.kgfPerKN;
    if (!strictFinite(kgfPerKN) || kgfPerKN <= 0) return hold('UNIT_FACTOR_INVALID');

    const before = readCapture(port);
    const after = readCapture(port);
    if (captureBytes(before) !== captureBytes(after)) return stale('CONTROLLER_CHANGED_DURING_CAPTURE');

    const displayUnit = String(port.unit.mode());
    if (!DISPLAY_UNITS.has(displayUnit)) return hold('DISPLAY_UNIT_UNKNOWN');
    validateStateShape(before.state.value);
    validateResultStateMirror(before.state.value, before.result.value);
    validateResultShape(before.result.value);
    validateSupportRecord(before.support.value);
    validateRecoveryItems(before.recovery.value);
    validateAggregateStatus(before.aggregate.value);
    validateFormulaEvidence(before.formula.value, before.state.value, before.result.value);

    const sourceBytes = captureBytes(before);
    return deepFreeze({
      version: CONTROLLER_PROJECTION_VERSION,
      phase: 'current',
      reason: '',
      marker: port.marker,
      controllerVersion: String(port.api.version || ''),
      authority: 'REVIEW ONLY · NOT FOR CONSTRUCTION',
      displayUnit,
      kgfPerKN,
      witness: fnv1a(sourceBytes),
      state: before.state.value,
      result: before.result.value,
      support: before.support.value,
      recoveryItems: before.recovery.value,
      aggregate: before.aggregate.value,
      formulaEvidence: before.formula.value,
      sourceJson: deepFreeze({
        state: before.state.json,
        result: before.result.json,
        support: before.support.json,
        recovery: before.recovery.json,
        aggregate: before.aggregate.json,
        formula: before.formula.json,
      }),
    });
  } catch (error) {
    const reason = String(error?.message || error || 'CONTROLLER_CAPTURE_FAILED');
    if (reason === 'RESULT_STATE_MISMATCH' || reason === 'FORMULA_RESULT_MISMATCH') return stale(reason);
    return hold(reason);
  }
}

export function sameEngineeringProjection(left, right) {
  return Boolean(left?.phase === 'current' && right?.phase === 'current'
    && left.witness === right.witness);
}

export function projectControllerOverview(capture) {
  if (!capture || capture.phase !== 'current') {
    return deepFreeze({
      phase: capture?.phase === 'stale' ? 'stale' : 'hold',
      reason: capture?.reason || 'CONTROLLER_UNAVAILABLE',
      authority: 'REVIEW ONLY · NOT FOR CONSTRUCTION',
      engineStatus: 'unknown',
      aggregateLevel: 'hold',
      aggregateText: 'CONTROLLER UNAVAILABLE · HOLD / REVIEW',
      recoveryItems: [],
    });
  }
  const { state, result, displayUnit, kgfPerKN } = capture;
  const factor = displayUnit === 'kgf' ? kgfPerKN : 1;
  const floorEvidenceCurrent = state.floorCapacityVerified === true
    && capture.support.mode === 'verified' && capture.support.valid === true
    && capture.support.attested === true && capture.support.reference.length > 0;
  const governingCandidates = result.checks.filter((check) => (
    !FLOOR_CHECK_IDS.has(check.id) || floorEvidenceCurrent
  ));
  const highestCheck = governingCandidates.reduce((current, check) => (
    !current || check.value > current.value ? check : current
  ), null);
  const recovery = capture.recoveryItems.find((item) => item.id === highestCheck?.id) || null;
  const nativeCard = (ordinal) => capture.formulaEvidence.cards.find((card) => card.ordinal === ordinal);
  const post = result.maxPost;
  const overview = {
    phase: 'current',
    reason: '',
    authority: capture.authority,
    engineStatus: result.status,
    aggregateLevel: capture.aggregate.level,
    aggregateText: capture.aggregate.text,
    displayUnit,
    witness: capture.witness,
    controllerVersion: capture.controllerVersion,
    projectName: String(state.projectName || 'ยังไม่ได้ตั้งชื่อโครงการ'),
    zone: String(state.zone || 'ยังไม่ได้ระบุพื้นที่ / Zone'),
    width: state.width,
    length: state.length,
    height: state.height,
    slabThicknessCm: state.slabT * 100,
    joistSpacing: state.joistSpacing,
    scaffoldType: String(state.scaffoldType || 'รอข้อมูล'),
    joistProfile: String(state.joistProfile || 'รอข้อมูล'),
    bearerProfile: String(state.bearerProfile || 'รอข้อมูล'),
    plywoodThicknessMm: state.plywoodT,
    recoveryItems: [],
    manufacturerInputFlag: state.manufacturerVerified === true,
    inputDomainValid: result.inputDomain.valid,
    // The scene in this Overview is a nominal rectangle, not result geometry.
    nominalRectangleAvailable: state.geometrySource === 'rectangle'
      && Array.isArray(state.holes) && state.holes.length === 0,
    supportEvidence: deepFreeze({
      mode: capture.support.mode,
      valid: capture.support.valid,
      reference: capture.support.reference,
    }),
  };
  if (!result.inputDomain.valid) {
    overview.evidenceBoundary = deepFreeze({
      code: 'GEOMETRY_INPUT_DOMAIN_HOLD',
      title: 'Geometry / Input domain ไม่ผ่าน',
      detail: 'ซ่อน Reaction, utilization และค่าจาก fallback จนกว่าแปลนและขอบเขต input จะผ่านการตรวจ',
    });
    return deepFreeze(overview);
  }

  Object.assign(overview, {
    failureCount: capture.aggregate.failureCount,
    holdCount: capture.aggregate.holdCount,
    recoveryItems: capture.recoveryItems,
    area: result.area,
    postCount: result.posts.length,
    maxPost: result.maxPost.P * factor,
    maxPostUnit: displayUnit === 'kgf' ? 'kgf/ขา' : 'kN/ขา',
    pressure: result.q * factor,
    pressureUnit: displayUnit === 'kgf' ? 'kgf/ม²' : 'kPa',
  });
  overview.governingEvidence = deepFreeze({
      post: deepFreeze({
        id: post.id,
        x: post.x,
        y: post.y,
        tribArea: post.tribArea,
        areaLoad: post.Parea,
        beamLoad: post.Pbeam,
        zoneLoad: post.Pzone,
        pointLoad: post.Ppoint,
        total: post.P,
        totalDisplay: post.P * factor,
        totalDisplayUnit: displayUnit === 'kgf' ? 'kgf' : 'kN',
        capacity: result.postCapacity,
        utilization: result.postUtil,
      }),
      serviceLoad: nativeCard(3),
      tributaryLoad: nativeCard(5),
      postCheck: nativeCard(11),
      highestCheck: deepFreeze({
        id: highestCheck.id,
        name: highestCheck.name,
        description: String(highestCheck.desc || ''),
        value: highestCheck.value,
        recoveryLevel: recovery?.level || '',
        recoveryMetric: recovery?.metric || '',
      }),
      engineStatus: result.status,
      authorityLevel: capture.aggregate.level,
      authorityText: capture.aggregate.text,
      source: deepFreeze({
        controllerVersion: capture.controllerVersion,
        witness: capture.witness,
        formulaSource: capture.formulaEvidence.source,
      }),
      assumptions: deepFreeze({
        manufacturerInputFlag: state.manufacturerVerified === true,
        supportMode: capture.support.mode,
        supportValid: capture.support.valid,
        supportReference: capture.support.reference,
        removedPostCount: state.removedPosts.length,
      }),
  });
  return deepFreeze(overview);
}

export function projectUnavailableVisualBoundary(capture) {
  const visualOnly = capture?.phase === 'visual-hold';
  if (visualOnly && capture?.reason === 'NON_RECTANGULAR_RESULT_GEOMETRY') {
    return deepFreeze({
      phase: 'HOLD',
      modelLegend: 'ภาพศึกษาแบบสี่เหลี่ยมไม่ตรงกับขอบเขตงานปัจจุบัน',
      assemblyTitle: 'ดูผังรูปตัว L / Polygon ในโมเดลตามแปลน',
      assemblyHeight: 'ผลคำนวณยังเป็นข้อมูลจริงจาก Engine เดิม',
      moduleSummary: 'พักภาพ nominal สี่เหลี่ยม ไม่ใช้แทนผัง Polygon หรือช่องเปิด',
      accessorySummary: 'ไม่แสดงจำนวนประกอบจากภาพที่ไม่ตรงขอบเขต',
      edgeSummary: 'เปิดแปลน 2D หรือโมเดล 3D ตามแปลนด้วยปุ่มด้านบน',
      procurementSummary: 'BOQ ใช้ข้อมูลจาก Engine เดิม ไม่ใช่จำนวนชิ้นจากภาพ nominal',
      modelModeStatus: 'พักภาพ nominal · เปิดโมเดลตามแปลนเพื่อดูขอบเขตจริง',
      overlayTitle: 'พื้นที่นี้ไม่ใช่สี่เหลี่ยมเต็มกรอบ',
      overlayDetail: 'Engine คำนวณตามขอบเขตจริงแล้ว เปิดโมเดล 3D ตามแปลนเพื่อดูรูปตัว L และตำแหน่งขาค้ำ ส่วนภาพเฟรม nominal ในหน้านี้ยังไม่รองรับผัง Polygon',
    });
  }
  const webglUnavailable = capture?.reason === 'WEBGL_UNAVAILABLE';
  const inputDomainInvalid = capture?.reason === 'ENGINE_INPUT_DOMAIN_INVALID';
  const phase = capture?.phase === 'stale' ? 'STALE' : 'HOLD';
  if (visualOnly) {
    return deepFreeze({
      phase,
      modelLegend: inputDomainInvalid
        ? 'INPUT-DOMAIN HOLD · ซ่อนภาพและจำนวนจาก fallback'
        : webglUnavailable
        ? 'VISUAL HOLD · อุปกรณ์นี้เปิด WebGL ไม่ได้ จึงไม่แสดงภาพหรือจำนวน nominal'
        : 'VISUAL HOLD · ขนาดปัจจุบันอยู่นอกช่วงภาพศึกษา จึงไม่แสดงภาพ nominal รอบก่อน',
      assemblyTitle: inputDomainInvalid ? 'HOLD · Geometry / Input domain ไม่ผ่าน' : 'HOLD · พักเฉพาะภาพศึกษา 3D',
      assemblyHeight: inputDomainInvalid
        ? 'ไม่ใช้รูปทรง Reaction หรือจำนวนขาจาก fallback เป็นผลปัจจุบัน'
        : webglUnavailable
        ? 'ผล Engine ยัง current แต่ภาพ 3D ไม่พร้อมบนอุปกรณ์นี้'
        : 'ผล Engine ยัง current แต่ไม่มีการย่อหรือแทนค่าขนาดเพื่อให้ภาพดูพอดี',
      moduleSummary: 'ไม่แสดงรูปทรงและจำนวนประกอบจากข้อมูลรอบก่อน',
      accessorySummary: 'ไม่แสดงจำนวนเฟรม ขา กากบาท ฐาน หัวปรับ และข้อต่อเดิม',
      edgeSummary: inputDomainInvalid
        ? 'กลับไปตรวจขอบเขตแปลนและ input domain ก่อนอ่านผลใหม่'
        : webglUnavailable
        ? 'ใช้เบราว์เซอร์หรืออุปกรณ์ที่รองรับ WebGL แล้วอ่านผลใหม่'
        : 'ปรับข้อมูลใน Workbench หรือขยายขอบเขต visual โดยผ่านการตรวจแยก',
      procurementSummary: 'จัดซื้อ / BOQ: ไม่อ้างจำนวนจากภาพที่ถูกพัก',
      modelModeStatus: inputDomainInvalid
        ? 'พักภาพ เพราะ Geometry / Input domain ไม่ผ่าน'
        : webglUnavailable
        ? 'พักภาพ nominal เพราะ WebGL ไม่พร้อม'
        : 'พักภาพ nominal เพราะขนาดปัจจุบันอยู่นอกช่วงภาพศึกษา',
      overlayTitle: inputDomainInvalid ? 'Input-domain HOLD · ซ่อนโมเดล fallback' : 'Visual HOLD · ยังไม่แสดงโมเดล',
      overlayDetail: inputDomainInvalid
        ? 'แก้ Geometry / Input domain ในแปลน 2D แล้วคำนวณใหม่ก่อนแสดง Reaction และภาพ'
        : webglUnavailable
        ? 'ผล Engine ยัง current; พักเฉพาะภาพ nominal เพราะอุปกรณ์นี้เปิด WebGL ไม่ได้'
        : 'ผล Engine ยัง current; พักเฉพาะภาพ nominal เพื่อไม่ให้ภาพ baseline หรือรอบก่อนถูกเข้าใจว่าเป็นผลปัจจุบัน',
    });
  }
  return deepFreeze({
    phase,
    modelLegend: `${phase} · ซ่อนภาพและจำนวนที่อ้างอิง Controller เดิมจนกว่าจะได้ผล current`,
    assemblyTitle: `${phase} · ข้อมูล Controller ไม่ current`,
    assemblyHeight: 'ซ่อนระดับเป้าหมายและระดับชุดภาพเดิม',
    moduleSummary: 'พักโมเดล 3D เพื่อไม่ให้แสดงรูปทรงจากข้อมูลรอบก่อน',
    accessorySummary: 'ซ่อนจำนวนเฟรม ขา กากบาท ฐาน หัวปรับ และข้อต่อเดิม',
    edgeSummary: 'รออ่าน state และ result ชุดเดียวกันจาก Controller อีกครั้ง',
    procurementSummary: 'จัดซื้อ / BOQ: ไม่แสดงข้อมูลเดิมขณะผลไม่ current',
    modelModeStatus: 'พักภาพโมเดล เพราะข้อมูล Controller ไม่ current',
    overlayTitle: 'พักภาพจากผลรอบก่อน',
    overlayDetail: 'อ่าน Controller ใหม่ให้ได้สถานะ current ก่อน จึงจะแสดงภาพ nominal และจำนวนประกอบอีกครั้ง',
  });
}
