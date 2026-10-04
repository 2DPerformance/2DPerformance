import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLegacyFailure, summarizeSystemFailure } from './failureSummary.mjs?rwv=20260930-load-units-1';
import { getPassingExample } from './passingExamples.mjs?rwv=20261003-main-equations-1';
import { computeForUi } from './workbench.mjs?rwv=20261003-main-equations-1';
import { SYSTEM_DEFAULTS, createSystemSnapshot } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';

const uiDefault = Object.freeze({
  H: 3.5, B: 3, baseT: .35, toe: .8, stemT: .3, heel: 1.9,
  wallLength: 10, cfSpan: 3, cfThick: .3, cfDepth: 0, cfHeight: 0,
  phi: 30, gamma: 18, gammaSat: 20, delta: 28, wallDelta: 15,
  qa: 250, frontDepth: 0, passiveFactor: 0,
  waterEnabled: false, waterH: 1, includeSurchargeWeight: false,
  surcharge: 10, lineLoad: 0, lineLoadHeight: 2.6,
  gammaC: 24, gammaW: 9.81, fc: '24', fy: '390', cover: 50,
  unitMode: 'si', presentationUnitMode: 'si',
});

test('all seven current default result families retain FAIL and receive an honest summary', () => {
  for (const type of ['cantilever', 'gravity', 'counterfort']) {
    const result = computeForUi({ ...uiDefault, wtype: type }, 'thai2566');
    assert.equal(result.ok, true, type);
    assert.equal(result.snapshot.verdict.pass, false, type);
    const summary = summarizeLegacyFailure(result.c);
    assert.ok(summary && summary.count >= 1, type);
    assert.equal(summary.count, result.c.checks.filter((check) => !check.ok).length, type);
    assert.ok(summary.first.key && summary.first.value && summary.first.criterion, type);
    assert.equal(summary.adviceKind, 'none', type + ' must not promote one-check recovery to whole-result PASS');
    assert.match(summary.caveat, /REVIEW \/ NOT FOR CONSTRUCTION/);
  }
  for (const type of ['pile', 'pilecf', 'soldier']) {
    const snapshot = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: type });
    assert.equal(snapshot.status, 'FAIL', type);
    const summary = summarizeSystemFailure(snapshot);
    assert.ok(summary && summary.count >= 1, type);
    assert.equal(summary.count, snapshot.checks.filter((check) => !check.ok).length, type);
    assert.ok(summary.first.key && summary.first.value && summary.first.criterion, type);
    assert.match(summary.caveat, /REVIEW \/ NOT FOR CONSTRUCTION/);
  }
  // Match the actual duck-foot form defaults rather than the shared pile defaults.
  const input = { ...getPassingExample('duckfoot').values,
    t: .15, colDepth: .15, hz: .25, capL: 1.2 };
  const snapshot = createSystemSnapshot(input);
  assert.equal(snapshot.status, 'FAIL');
  const summary = summarizeSystemFailure(snapshot);
  assert.equal(summary.adviceKind, 'verified');
  assert.equal(summary.count, snapshot.checks.filter((check) => !check.ok).length);
  for (const required of ['เสากว้าง 0.15 → 0.30 ม.', 'เสาลึก 0.15 → 0.30 ม.',
    'ฐานยาว 1.20 → 1.40 ม.', 'ฐานหนา 0.25 → 0.40 ม.']) {
    assert.ok(summary.adviceText.includes(required), required);
  }
  assert.match(summary.caveat, /ห้ามเลือกปรับเพียงบางค่า/);
});

test('soldier exact I-40 is shown only from its all-check Engine rerun', () => {
  const snapshot = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'soldier', ipile: 35 });
  const summary = summarizeSystemFailure(snapshot);
  assert.equal(summary.count, 1);
  assert.equal(summary.first.key, 'PILE MOMENT');
  assert.equal(summary.adviceKind, 'verified');
  assert.match(summary.adviceText, /I-40/);
  assert.match(summary.caveat, /แค็ตตาล็อกผู้ผลิต/);
  const noVerifiedSize = { ...snapshot, recommendations: [{
    title: 'ขนาดเข็มตัวไอในทะเบียนยังไม่ผ่านครบ', value: 'ไม่พบใน I-18 ถึง I-45',
    basis: 'ต้องแก้ระบบยึดรั้ง',
  }] };
  assert.equal(summarizeSystemFailure(noVerifiedSize).adviceKind, 'none');
});

test('pile advice is a minimum capacity, never a verified pile or dowel size', () => {
  for (const type of ['pile', 'pilecf']) {
    const snapshot = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: type });
    const summary = summarizeSystemFailure(snapshot);
    assert.equal(summary.adviceKind, 'minimum', type);
    assert.match(summary.adviceText, /Pa ≥/);
    assert.match(summary.adviceText, /Hlat ≥/);
    assert.match(summary.adviceText, /Mต้าน ≥/);
    assert.match(summary.caveat, /ไม่ใช่ขนาดเสาเข็มหรือเดือยที่ตรวจผ่านครบ/);
  }
});

test('legacy advice requires an Engine candidate with all registered checks passing', () => {
  const { unitCanonicalSi, ...values } = getPassingExample('cantilever').values;
  const result = computeForUi({ ...values, wtype: 'cantilever', baseT: .35,
    unitCanonicalSi: { ...unitCanonicalSi } }, 'thai2566');
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.verdict.pass, false);
  const summary = summarizeLegacyFailure(result.c);
  assert.equal(summary.adviceKind, 'verified');
  assert.match(summary.adviceText, /ฐานหนา 0.35 → 0.60 ม./);
  assert.match(summary.caveat, /รายการที่ลงทะเบียนทั้งหมด/);

  const targetOnly = { ...result.c, recovery: {
    ...result.c.recovery,
    items: result.c.recovery.items.map((item) => ({ ...item,
      candidates: item.candidates.map((candidate) => ({ ...candidate, allRegisteredPass: false })),
    })),
  } };
  assert.equal(summarizeLegacyFailure(targetOnly).adviceKind, 'none');
});

test('counterfort Engine change labels are legible and unknown fields fail closed', () => {
  const candidate = { targetCheckPass: true, allRegisteredPass: true, changes: [
    { key: 'bs', from: .30, to: .35, unit: 'ม.' },
    { key: 'L', from: 3, to: 2.5, unit: 'ม.' },
  ] };
  const result = { verdict: { pass: false },
    checks: [{ k: 'SECTION SIZE', v: 'D/C 1.08', req: '≤ 1.00', ok: false }],
    recovery: { source: 'engine.trial', authority: 'ADVISORY_APPLY_THEN_RECALCULATE',
      items: [{ candidates: [candidate] }] } };
  const summary = summarizeLegacyFailure(result);
  assert.equal(summary.adviceKind, 'verified');
  assert.match(summary.adviceText, /ความหนาครีบ 0.30 → 0.35 ม./);
  assert.match(summary.adviceText, /ช่วงว่างระหว่างครีบ 3.00 → 2.50 ม./);
  const unknown = { ...result, recovery: { ...result.recovery,
    items: [{ candidates: [{ ...candidate,
      changes: [{ key: 'futureField', from: 1, to: 2, unit: 'ม.' }] }] }] } };
  assert.equal(summarizeLegacyFailure(unknown).adviceKind, 'none');
});

test('PASS, absent, error and stale results never create a failure summary', () => {
  assert.equal(summarizeSystemFailure(null), null);
  assert.equal(summarizeLegacyFailure(null), null);
  assert.equal(summarizeSystemFailure({ status: 'STALE', checks: [{ ok: false }] }), null);
  assert.equal(summarizeSystemFailure({ status: 'FAIL', stale: true,
    checks: [{ key: 'x', ok: false }] }), null);
  assert.equal(summarizeLegacyFailure({ state: 'STALE', verdict: { pass: false },
    checks: [{ k: 'x', ok: false }] }), null);
  assert.equal(summarizeLegacyFailure({ ok: false, verdict: { pass: false },
    checks: [{ k: 'x', ok: false }] }), null);
  for (const type of ['pile', 'pilecf', 'soldier', 'duckfoot']) {
    const snapshot = createSystemSnapshot(getPassingExample(type).values);
    assert.equal(snapshot.status, 'PASS', type);
    assert.equal(summarizeSystemFailure(snapshot), null, type);
  }
  for (const type of ['cantilever', 'gravity', 'counterfort']) {
    const result = computeForUi(getPassingExample(type).values, 'thai2566');
    assert.equal(result.snapshot.verdict.pass, true, type);
    assert.equal(summarizeLegacyFailure(result.c), null, type);
  }
});
