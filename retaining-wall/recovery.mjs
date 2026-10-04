/**
 * Engine-trial recovery projection for the retaining-wall workbench.
 *
 * This module owns no structural formula and never changes a limit state. It receives
 * a normalized canonical input plus an evaluator supplied by Snapshot, then searches
 * practical UI increments by re-running the existing Engine. A value is publishable
 * only when the target registered check passes and every check that passed at baseline
 * remains passing.
 *
 * Soil, water, load and resistance assumptions are intentionally outside the numeric
 * recovery allow-list. GLOBAL SLIP is non-monotonic and geotechnical in nature; it gets
 * a bounded diagnostic trial only, never an automatic pass recommendation.
 */

export const RW_RECOVERY_POLICY = Object.freeze({
  source: 'engine.trial',
  version: 'rw-recovery-2026.09.28b',
  acceptance: 'TARGET_PASS_AND_NO_BASELINE_REGRESSION',
  authority: 'ADVISORY_APPLY_THEN_RECALCULATE',
  maxCandidatesPerCheck: 1,
  /* รวม baseline restore หนึ่งครั้งแล้ว เพื่อไม่ให้ Calculate ค้างเมื่อไม่พบคำตอบ */
  maxEvaluations: 24,
});

const FIELD_RULES = Object.freeze({
  heel: Object.freeze({ label: 'Heel', uiId: 'heel', unit: 'ม.', direction: 'up', step: 0.05, limit: 8 }),
  toe: Object.freeze({ label: 'Toe', uiId: 'toe', unit: 'ม.', direction: 'up', step: 0.05, limit: 6 }),
  hz: Object.freeze({ label: 'ความหนาฐาน', uiId: 'baseT', unit: 'ม.', direction: 'up', step: 0.05, limit: 2 }),
  t: Object.freeze({ label: 'ความหนาพนัง', uiId: 'stemT', unit: 'ม.', direction: 'up', step: 0.05, limit: 2 }),
  fc: Object.freeze({ label: "คอนกรีต f′c", uiId: 'fc', unit: 'MPa', direction: 'up', values: [21, 24, 28, 32] }),
  bs: Object.freeze({ label: 'ความหนาครีบ', uiId: 'cfThick', unit: 'ม.', direction: 'up', step: 0.05, limit: 1 }),
  L: Object.freeze({ label: 'ช่วงว่างระหว่างครีบ', uiId: 'cfSpan', unit: 'ม.', direction: 'down', step: 0.1, limit: 0.5 }),
});

/* A check-key allow-list is deliberate. Stability domains that may be non-monotonic are
   never sent through a generic bisection just because their qualitative `to` list happens
   to name a geometry field. */
const CHECK_STRATEGIES = Object.freeze([
  Object.freeze({ match: /^F\.S\. OVERTURNING/i, fields: ['heel', 'toe', 'hz'], search: 'monotonic' }),
  Object.freeze({ match: /^F\.S\. SLIDING/i, fields: ['heel', 'toe'], search: 'monotonic' }),
  Object.freeze({ match: /^BEARING/i, fields: ['heel', 'toe', 'hz'], search: 'linear' }),
  Object.freeze({ match: /^ECCENTRICITY/i, fields: ['heel', 'toe', 'hz'], search: 'linear' }),
  Object.freeze({ match: /^SHEAR\s+—\s+STEM$/i, fields: ['t', 'fc'], search: 'monotonic' }),
  Object.freeze({ match: /^SHEAR\s+—\s+HEEL$/i, fields: ['hz', 'fc'], search: 'monotonic' }),
  Object.freeze({ match: /^SHEAR\s+—\s+TOE$/i, fields: ['hz', 'fc'], search: 'linear' }),
  Object.freeze({ match: /^SECTION SIZE/i, fields: ['t', 'hz', 'bs'], search: 'monotonic' }),
  Object.freeze({ match: /^REBAR FIT/i, fields: ['t', 'hz', 'bs', 'L'], search: 'monotonic' }),
  Object.freeze({ match: /^REBAR ⑧$/i, fields: ['hz', 'heel'], search: 'linear' }),
]);

const GLOBAL_SLIP = /^GLOBAL SLIP/i;
const round = (value, digits = 6) => Number(Number(value).toFixed(digits));
const same = (a, b) => Math.abs(a - b) <= 1e-9;

function valuesFor(field, current) {
  const rule = FIELD_RULES[field];
  if (!rule || !Number.isFinite(current)) return [];
  if (Array.isArray(rule.values)) {
    return rule.values.filter((value) => rule.direction === 'down' ? value < current : value > current);
  }
  const values = [];
  if (rule.direction === 'down') {
    let value = Math.floor((current - 1e-9) / rule.step) * rule.step;
    for (; value >= rule.limit - 1e-9; value -= rule.step) values.push(round(value));
  } else {
    let value = Math.ceil((current + 1e-9) / rule.step) * rule.step;
    for (; value <= rule.limit + 1e-9; value += rule.step) values.push(round(value));
  }
  return values;
}
function candidateInput(input, field, value) {
  const next = { ...input };
  if (input.presentationInput && typeof input.presentationInput === 'object') {
    next.presentationInput = { ...input.presentationInput };
  }
  next[field] = value;
  if (field === 't') next.ttop = value;
  if (field === 'heel' || field === 'toe' || field === 't') {
    next.B = round(next.toe + next.t + next.heel);
  }
  return next;
}

function evaluateCandidate(input, field, value, evaluate, cache, budget) {
  const cacheKey = field + ':' + value;
  if (cache.has(cacheKey)) {
    return { evaluated: cache.get(cacheKey), exhausted: false };
  }
  if (budget.used >= budget.trialLimit) {
    budget.truncated = true;
    return { evaluated: null, exhausted: true };
  }
  budget.used += 1;
  let evaluated = null;
  try { evaluated = evaluate(candidateInput(input, field, value)); } catch { evaluated = null; }
  cache.set(cacheKey, evaluated);
  return { evaluated, exhausted: false };
}

function checkMap(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (!row || typeof row.k !== 'string' || map.has(row.k)) return null;
    map.set(row.k, row);
  }
  return map;
}

function summarizeTrial(baselineRows, targetKey, evaluated) {
  if (!evaluated || evaluated.ok === false || !Array.isArray(evaluated.checks)) return null;
  const baseline = checkMap(baselineRows);
  const candidate = checkMap(evaluated.checks);
  if (!baseline || !candidate || baseline.size !== candidate.size) return null;
  const target = candidate.get(targetKey);
  if (!target || typeof target.ok !== 'boolean') return null;
  const newlyFailing = [];
  const newlyPassing = [];
  const remainingFailures = [];
  for (const [key, before] of baseline) {
    const after = candidate.get(key);
    if (!after || typeof after.ok !== 'boolean') return null;
    if (before.ok && !after.ok) newlyFailing.push(key);
    if (!before.ok && after.ok) newlyPassing.push(key);
    if (!after.ok) remainingFailures.push(key);
  }
  return {
    target: { k: target.k, ok: target.ok, u: target.u, v: target.v, req: target.req },
    targetCheckPass: target.ok,
    allRegisteredPass: remainingFailures.length === 0,
    newlyFailing,
    newlyPassing,
    remainingFailures,
  };
}

function changesFor(input, next, field) {
  const keys = [field];
  if (field === 't') keys.push('ttop');
  if (['heel', 'toe', 't'].includes(field)) keys.push('B');
  return keys.filter((key) => !same(Number(input[key]), Number(next[key]))).map((key) => ({
    key,
    from: input[key],
    to: next[key],
    unit: key === 'fc' ? 'MPa' : 'ม.',
  }));
}

function freezeCandidate(checkKey, input, field, value, trial) {
  const rule = FIELD_RULES[field];
  const next = candidateInput(input, field, value);
  return Object.freeze({
    id: checkKey + '::' + field + '::' + value,
    checkKey,
    field,
    uiId: rule.uiId,
    label: rule.label,
    unit: rule.unit,
    direction: rule.direction,
    from: input[field],
    to: value,
    changes: Object.freeze(changesFor(input, next, field).map((item) => Object.freeze(item))),
    targetCheckPass: true,
    allRegisteredPass: trial.allRegisteredPass,
    targetResult: Object.freeze({ ...trial.target }),
    newlyFailing: Object.freeze([...trial.newlyFailing]),
    newlyPassing: Object.freeze([...trial.newlyPassing]),
    remainingFailures: Object.freeze([...trial.remainingFailures]),
    applyPolicy: RW_RECOVERY_POLICY.authority,
  });
}

function findFirstPassing({ input, baselineRows, targetKey, field, search, evaluate, cache, budget }) {
  const values = valuesFor(field, input[field]);
  if (!values.length) return { candidate: null, bound: null, truncated: false };

  const run = (index) => {
    const value = values[index];
    const result = evaluateCandidate(input, field, value, evaluate, cache, budget);
    const trial = result.exhausted ? null : summarizeTrial(baselineRows, targetKey, result.evaluated);
    return { index, value, trial, exhausted: result.exhausted };
  };

  let startIndex = 0;
  if (search === 'monotonic') {
    const atBound = run(values.length - 1);
    if (atBound.exhausted) return { candidate: null, bound: null, truncated: true };
    if (!atBound.trial || !atBound.trial.targetCheckPass) {
      return {
        candidate: null,
        bound: atBound.trial ? Object.freeze({
          field, label: FIELD_RULES[field].label, value: atBound.value, unit: FIELD_RULES[field].unit,
          targetResult: Object.freeze({ ...atBound.trial.target }),
          newlyFailing: Object.freeze([...atBound.trial.newlyFailing]),
        }) : null,
        truncated: false,
      };
    }
    let low = 0;
    let high = values.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const trial = run(mid);
      if (trial.exhausted) return { candidate: null, bound: null, truncated: true };
      if (trial.trial && trial.trial.targetCheckPass) high = mid;
      else low = mid + 1;
    }
    startIndex = low;
  }

  /* Bearing/eccentricity use every actual UI increment because their response can
     change direction. Monotonic strategies start at the first passing increment, then
     continue only when a formerly passing registered check has regressed. */
  let firstTargetPass = null;
  let lastTrial = null;
  for (let index = startIndex; index < values.length; index++) {
    const trial = run(index);
    if (trial.exhausted) break;
    if (trial.trial) lastTrial = trial;
    if (!trial.trial || !trial.trial.targetCheckPass) continue;
    if (!firstTargetPass) firstTargetPass = trial;
    if (trial.trial.newlyFailing.length === 0) {
      return {
        candidate: freezeCandidate(targetKey, input, field, trial.value, trial.trial),
        bound: null,
        truncated: false,
      };
    }
  }

  const trace = firstTargetPass || lastTrial;
  return {
    candidate: null,
    bound: trace && trace.trial ? Object.freeze({
      field, label: FIELD_RULES[field].label, value: trace.value, unit: FIELD_RULES[field].unit,
      targetResult: Object.freeze({ ...trace.trial.target }),
      newlyFailing: Object.freeze([...trace.trial.newlyFailing]),
    }) : null,
    truncated: budget.truncated,
  };
}

function globalSlipDiagnostic(input, rows, check, evaluate, cache, budget) {
  const values = valuesFor('heel', input.heel);
  if (!values.length) return { testedBounds: [], truncated: false };
  const value = values[values.length - 1];
  const result = evaluateCandidate(input, 'heel', value, evaluate, cache, budget);
  if (result.exhausted) return { testedBounds: [], truncated: true };
  const trial = summarizeTrial(rows, check.k, result.evaluated);
  return { testedBounds: trial ? [Object.freeze({
    field: 'heel', label: FIELD_RULES.heel.label, value, unit: FIELD_RULES.heel.unit,
    targetResult: Object.freeze({ ...trial.target }),
  })] : [], truncated: false };
}

/**
 * @param {{input: object, checks: Array<object>, evaluate: (candidate: object) => object}} source
 */
export function buildRetainingWallRecoveryProjection(source) {
  const { input, checks, evaluate } = source || {};
  if (!input || typeof input !== 'object' || !Array.isArray(checks) || typeof evaluate !== 'function') {
    throw new TypeError('recovery: ต้องมี normalized input, registered checks และ Engine evaluator');
  }
  if (!checkMap(checks)) throw new TypeError('recovery: registered check key ต้องครบและไม่ซ้ำ');

  const failed = checks.filter((row) => row && row.ok === false);
  const cache = new Map();
  const budget = {
    used: 0,
    trialLimit: Math.max(0, RW_RECOVERY_POLICY.maxEvaluations - 1),
    truncated: false,
  };
  /* เก็บหนึ่ง bounded geotechnical diagnostic ก่อน search อื่น เพื่อไม่ให้รายการก่อนหน้า
     ใช้งบหมดแล้วทำให้หลักฐาน Global Slip หายไปตามลำดับของตาราง */
  const globalDiagnostics = new Map();
  failed.filter((check) => GLOBAL_SLIP.test(check.k)).forEach((check) => {
    globalDiagnostics.set(check.k,
      globalSlipDiagnostic(input, checks, check, evaluate, cache, budget));
  });
  const items = [];
  for (const check of failed) {
    if (GLOBAL_SLIP.test(check.k)) {
      const diagnostic = globalDiagnostics.get(check.k) || { testedBounds: [], truncated: true };
      items.push(Object.freeze({
        checkKey: check.k,
        status: 'GEOTECH_REVIEW',
        candidates: Object.freeze([]),
        testedBounds: Object.freeze(diagnostic.testedBounds),
        searchTruncated: diagnostic.truncated,
        reason: 'เสถียรภาพรวมเป็นปัญหาดินและผิววิบัติที่ไม่เป็นเชิงเดี่ยว ระบบจึงไม่แก้ค่าดินหรือรับรองค่าผ่านอัตโนมัติ',
      }));
      continue;
    }

    const strategy = CHECK_STRATEGIES.find((item) => item.match.test(check.k));
    if (!strategy) {
      items.push(Object.freeze({
        checkKey: check.k,
        status: 'GUIDANCE_ONLY',
        candidates: Object.freeze([]),
        testedBounds: Object.freeze([]),
        searchTruncated: false,
        reason: 'รายการนี้ไม่มีเส้นทางปรับตัวแปรเดียวที่อนุมัติให้ค้นหาอัตโนมัติ',
      }));
      continue;
    }

    const candidates = [];
    const testedBounds = [];
    let searchTruncated = false;
    for (const field of strategy.fields) {
      if (candidates.length >= RW_RECOVERY_POLICY.maxCandidatesPerCheck) break;
      if (budget.used >= budget.trialLimit) { searchTruncated = true; budget.truncated = true; break; }
      if (input.wtype !== 'but' && (field === 'bs' || field === 'L')) continue;
      const found = findFirstPassing({
        input, baselineRows: checks, targetKey: check.k, field, search: strategy.search,
        evaluate, cache, budget,
      });
      if (found.candidate) candidates.push(found.candidate);
      else if (found.bound) testedBounds.push(found.bound);
      if (found.truncated) { searchTruncated = true; break; }
    }

    items.push(Object.freeze({
      checkKey: check.k,
      status: candidates.length ? 'FOUND'
        : (searchTruncated ? 'SEARCH_LIMIT_REACHED' : 'NO_SAFE_SINGLE_EDIT'),
      candidates: Object.freeze(candidates),
      testedBounds: Object.freeze(testedBounds),
      searchTruncated,
      reason: candidates.length
        ? 'ค่าที่เสนอผ่านการรัน Engine ซ้ำ และไม่ทำให้รายการที่เดิมผ่านกลับมาตก'
        : (searchTruncated
          ? 'ยังไม่พบค่าปรับเดี่ยวก่อนถึงเพดานการทดลองอัตโนมัติ โปรดตรวจมิติและสมมติฐานโดยวิศวกร'
          : 'ไม่พบการแก้มิติหรือกำลังคอนกรีตเพียงค่าเดียวภายในช่วงฟอร์มที่ทำให้ผ่านโดยไม่สร้างรายการตกใหม่'),
    }));
  }

  /* Restore the Engine's memo/global result to the baseline input before downstream
     drawing/report projections continue. The return value is intentionally ignored. */
  if (budget.used > 0) {
    budget.used += 1;
    try { evaluate({ ...input, presentationInput: input.presentationInput && { ...input.presentationInput } }); } catch { /* projection stays advisory */ }
  }

  return Object.freeze({
    ...RW_RECOVERY_POLICY,
    baselineFailureCount: failed.length,
    evaluationsUsed: budget.used,
    evaluationLimit: RW_RECOVERY_POLICY.maxEvaluations,
    searchTruncated: items.some((item) => item.searchTruncated),
    items: Object.freeze(items),
  });
}
