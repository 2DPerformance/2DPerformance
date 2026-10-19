(function installCorbelWorkbenchModel(root) {
  'use strict';

  const SCHEMA_VERSION = 'corbel-result-v2';
  const READY_STATE = 'ready';

  function deepClone(value) {
    if (Array.isArray(value)) return value.map(deepClone);
    if (value instanceof Date) return new Date(value.getTime());
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, deepClone(entry)]),
    );
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value instanceof Date) return { $date: value.toISOString() };
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return { $number: Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity' };
    }
    if (typeof value === 'number' && Object.is(value, -0)) return { $number: '-0' };
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])]),
    );
  }

  function fnv1a(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
  }

  function normalizedFingerprintPayload(payload = {}) {
    return {
      input: payload.input || null,
      loadCase: payload.loadCase || payload.presentation?.loadCase || null,
      wallHeightM: payload.wallHeightM ?? payload.presentation?.wallHeightM ?? null,
    };
  }

  function createCorbelInputFingerprint(payload = {}) {
    return `corbel-${fnv1a(JSON.stringify(stableValue(normalizedFingerprintPayload(payload))))}`;
  }

  function toIsoTime(value) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('invalid_snapshot_time');
    return date.toISOString();
  }

  function createCorbelResultSnapshot(result, presentation = {}) {
    if (!result || typeof result !== 'object') throw new Error('missing_corbel_result');
    if (!result.input || !result.demand || !Array.isArray(result.checks)) {
      throw new Error('incomplete_corbel_result');
    }

    const clone = deepClone(result);
    const mergedPresentation = {
      ...(clone.presentation || {}),
      ...deepClone(presentation || {}),
    };
    mergedPresentation.createdAt = toIsoTime(
      mergedPresentation.createdAt || new Date().toISOString(),
    );
    mergedPresentation.inputFingerprint = createCorbelInputFingerprint({
      input: clone.input,
      loadCase: mergedPresentation.loadCase,
      wallHeightM: mergedPresentation.wallHeightM,
    });
    delete mergedPresentation.snapshotId;

    clone.schemaVersion = SCHEMA_VERSION;
    clone.presentation = mergedPresentation;
    mergedPresentation.snapshotId = `CRB-${fnv1a(JSON.stringify(stableValue(clone)))}`;
    return deepFreeze(clone);
  }

  function lockedEvidence(reason) {
    return deepFreeze({
      ready: false,
      reason,
      snapshot: null,
      snapshotId: null,
      verdict: 'locked',
      section: false,
      checkedRebar: false,
      engineering3d: false,
      constructionReadyCage: false,
      trace: false,
      a4: false,
      checks: [],
      revisionPlan: { show: false, category: null, selector: null, label: '', finding: null },
    });
  }

  const RECOVERY_BY_CHECK = Object.freeze({
    'scope-avd': { category: 'geometry', selector: '#length', label: 'ตรวจระยะยื่น L และระยะแรง aᵥ' },
    'scope-nv': { category: 'load', selector: '#quickNu', label: 'ตรวจแรงแนวนอน Nᵤ จาก Analysis' },
    'tip-depth': { category: 'geometry', selector: '#tipHeight', label: 'ตรวจความสูงที่ปลาย h₂' },
    bearing: { category: 'geometry', selector: '#wallWidth', wallSelector: '#wallRun', label: 'ตรวจความกว้างจริง b / Btrib และ bearing' },
    'nose-anchor': { category: 'anchor', selector: '#noseSetback', label: 'ตรวจโซนยึดเหล็กที่ปลาย c_anchor' },
    'support-anchor': { category: 'anchor', selector: '#height', label: 'ตรวจพื้นที่พัฒนาเหล็กเข้าคานรองรับ' },
    shear: { category: 'load', selector: '#quickLoad', wallSelector: '#wallUnitWeight', label: 'ตรวจ governing load และรูปทรงรับแรงเฉือน' },
    flexure: { category: 'load', selector: '#quickLoad', wallSelector: '#wallUnitWeight', label: 'ตรวจ governing load และระยะแรงดัด' },
    'shear-friction': { category: 'material', selector: '#surface', label: 'ตรวจผิวรอยต่อ วัสดุ และ governing load' },
    'primary-steel': { category: 'geometry', selector: '#depth', label: 'ตรวจหน้าตัด วัสดุ และ governing load ของ Aₛ' },
    'closed-ties': { category: 'geometry', selector: '#wallWidth', wallSelector: '#wallRun', label: 'ตรวจหน้าตัดและ governing load ของ Aₕ' },
  });

  function failureRank(check) {
    const utilization = Number(check?.utilization);
    return Number.isFinite(utilization) ? utilization : Number.POSITIVE_INFINITY;
  }

  function createCorbelRevisionPlan(snapshot = null) {
    const failures = Array.isArray(snapshot?.checks)
      ? snapshot.checks.filter((check) => check?.status === 'fail')
      : [];
    failures.sort((left, right) => failureRank(right) - failureRank(left));
    const finding = failures[0] || null;
    if (!finding) {
      return deepFreeze({ show: false, category: null, selector: null, label: '', finding: null });
    }
    const recovery = RECOVERY_BY_CHECK[finding.id] || {
      category: 'load', selector: '#quickLoad', wallSelector: '#wallUnitWeight', label: 'ตรวจ governing input แล้วคำนวณใหม่',
    };
    const wallMode = snapshot?.presentation?.loadCase?.mode === 'wall';
    return deepFreeze({
      show: true,
      category: recovery.category,
      selector: wallMode && recovery.wallSelector ? recovery.wallSelector : recovery.selector,
      label: recovery.label,
      finding: deepClone(finding),
    });
  }

  function selectCorbelEvidence(snapshot, state = {}) {
    if (!snapshot) return lockedEvidence('no-snapshot');
    if (state.runState && state.runState !== READY_STATE) return lockedEvidence(state.runState);
    if (state.dirty) return lockedEvidence('stale');
    if (snapshot.schemaVersion !== SCHEMA_VERSION) return lockedEvidence('schema-mismatch');
    if (state.inputFingerprint
      && state.inputFingerprint !== snapshot.presentation?.inputFingerprint) {
      return lockedEvidence('stale');
    }

    const checkedRebar = Boolean(snapshot.provided?.main && snapshot.provided?.ties);
    const verdict = snapshot.verdict === 'pass' ? 'pass' : 'fail';
    return deepFreeze({
      ready: true,
      reason: null,
      snapshot,
      snapshotId: snapshot.presentation.snapshotId,
      verdict,
      section: true,
      checkedRebar,
      engineering3d: true,
      constructionReadyCage: verdict === 'pass' && checkedRebar,
      trace: true,
      a4: true,
      checks: deepClone(snapshot.checks),
      revisionPlan: createCorbelRevisionPlan(snapshot),
    });
  }

  function selectCorbelViewModel(snapshot, state = {}) {
    const evidence = selectCorbelEvidence(snapshot, state);
    if (!evidence.ready) return evidence;
    const result = evidence.snapshot;
    return deepFreeze({
      ...result,
      ...evidence,
      memberId: result.input.memberId,
      vuKg: result.demand.vuKg,
      nucKg: result.demand.nucKg,
      muKgm: result.demand.muKgm,
      ratio: result.demand.avOverD,
      avMm: result.demand.avMm,
      depthMm: result.input.depthMm,
      widthMm: result.input.widthMm,
      heightMm: result.input.heightMm,
      tipHeightMm: result.input.tipHeightMm,
      lengthMm: result.input.lengthMm,
      wallThicknessMm: result.input.wallThicknessMm,
      wallHeightM: result.presentation.wallHeightM,
      noseSetbackMm: result.input.noseSetbackMm,
      coverMm: result.input.coverMm,
      fcMpa: result.input.fcMpa,
      fyMpa: result.input.fyMpa,
      loadCase: result.presentation.loadCase,
      mainBar: result.provided?.main?.label || 'ไม่มีชุดเหล็กที่ตรวจได้',
      hangerBar: result.provided?.ties?.label || 'ไม่มีชุดเหล็กที่ตรวจได้',
      createdAt: result.presentation.createdAt,
    });
  }

  root.CorbelWorkbenchModel = Object.freeze({
    SCHEMA_VERSION,
    createCorbelInputFingerprint,
    createCorbelResultSnapshot,
    createCorbelRevisionPlan,
    selectCorbelEvidence,
    selectCorbelViewModel,
  });
})(typeof window === 'undefined' ? globalThis : window);
