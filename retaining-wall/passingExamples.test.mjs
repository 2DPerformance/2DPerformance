import test from 'node:test';
import assert from 'node:assert/strict';
import { PASSING_EXAMPLES, getPassingExample, initialDraftValues } from './passingExamples.mjs?rwv=20261003-main-equations-1';
import { computeForUi } from './workbench.mjs?rwv=20261003-main-equations-1';
import {
  flowOverview, flowChecks, flowAnalysis, flowSection,
  flowModel3d, flowReport, flowCalculationBook, flowDrawingPack,
} from './snapshot.mjs?rwv=20261003-main-equations-1';
import { SYSTEM_INPUT_KEYS, createSystemSnapshot } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import { duckChecks, duckDesignEquations } from './duckfootPresentation.mjs?rwv=20260930-load-units-1';

const legacy = ['cantilever', 'gravity', 'counterfort'];
const systems = ['pile', 'pilecf', 'soldier', 'duckfoot'];

test('seven Thai2566 examples are explicit copies, never a mutation of a user draft', () => {
  assert.deepEqual(Object.keys(PASSING_EXAMPLES), [...legacy, ...systems]);
  const userDraft = { H: 4.7, qa: 97, projectName: 'งานจริง' };
  const before = { ...userDraft };
  const first = getPassingExample('cantilever');
  first.values.H = 1;
  first.values.unitCanonicalSi.qa = 1;
  assert.equal(getPassingExample('cantilever').values.H, 3.5);
  assert.equal(getPassingExample('cantilever').values.unitCanonicalSi.qa, 150);
  assert.deepEqual(userDraft, before);
  assert.throws(() => getPassingExample('unknown'), RangeError);
  for (const type of [...legacy, ...systems]) {
    const row = getPassingExample(type);
    assert.equal(row.constructionAuthority, false);
    assert.equal(row.profile, 'thai2566');
    assert.ok(row.source && row.label.includes('ตัวอย่าง'));
    assert.notStrictEqual(row.values, PASSING_EXAMPLES[type].values);
  }
});

test('fresh per-system defaults use passing examples and preserve existing drafts in full', () => {
  for (const type of [...legacy, ...systems]) {
    assert.deepEqual(initialDraftValues(type), getPassingExample(type).values);
    const saved = { H: '', hp: 10, qa: 97, code: 'wsd', projectName: 'งานจริง', unitCanonicalSi: {qa:97} };
    const restored = initialDraftValues(type, saved);
    assert.deepEqual(restored, saved, type);
    restored.unitCanonicalSi.qa = 1;
    assert.equal(saved.unitCanonicalSi.qa, 97, type);
  }
});

test('legacy wall examples pass their registered Engine checks and all eight Flow selectors share one Snapshot', () => {
  for (const type of legacy) {
    const { values } = getPassingExample(type);
    assert.equal(values.B, values.toe + values.stemT + values.heel);
    assert.equal(values.qa, values.unitCanonicalSi.qa);
    assert.equal(values.waterEnabled, false);
    const { ok, snapshot, errors } = computeForUi({
      ...values, wtype: type, presentationUnitMode: 'si',
    }, 'thai2566');
    assert.equal(ok, true, `${type}: ${errors?.map(e => e.message).join(' · ')}`);
    assert.equal(snapshot?.ok, true, type);
    assert.equal(snapshot.verdict.pass, true, type);
    assert.equal(snapshot.verdict.failedCount, 0, type);
    assert.ok(snapshot.checks.length >= 9, type);
    assert.ok(snapshot.checks.every(check => check.ok && check.u <= 1 + 1e-9), type);

    assert.strictEqual(flowOverview(snapshot).verdict, snapshot.verdict, type + ' Flow 01');
    assert.strictEqual(flowChecks(snapshot), snapshot.checks, type + ' Flow 02');
    assert.equal(flowAnalysis(snapshot).Ph, snapshot.result.Ph, type + ' Flow 03');
    assert.strictEqual(flowSection(snapshot).section, snapshot.views[0].drawing, type + ' Flow 04');
    assert.equal(flowModel3d(snapshot).snapshotId, snapshot.id, type + ' Flow 05');
    assert.strictEqual(flowReport(snapshot), snapshot.report, type + ' Flow 06');
    assert.strictEqual(flowCalculationBook(snapshot).pages, snapshot.report, type + ' Flow 07');
    assert.deepEqual(flowCalculationBook(snapshot).mismatch, [], type + ' report parity');
    assert.strictEqual(flowDrawingPack(snapshot).sheets, snapshot.sheets, type + ' Flow 08');
    assert.ok(snapshot.report.length > 0 && snapshot.sheets, type);
    assert.ok(snapshot.report.every(page => page.meta.calculationAuthority === 'ENGINE_RESULT_PROJECTION_ONLY'
      && page.meta.rendererRecomputed === false && page.meta.mismatch.length === 0), type);
    assert.equal(snapshot.authority.constructionAuthority, false, type);
  }
});

test('pile, pile-counterfort, soldier stay, and duck-foot examples pass registered Snapshot checks', () => {
  for (const type of systems) {
    const { values, profile } = getPassingExample(type);
    for (const key of SYSTEM_INPUT_KEYS[type]) {
      assert.ok(Object.hasOwn(values, key), `${type}: missing ${key}`);
    }
    const snapshot = createSystemSnapshot(values, profile);
    assert.equal(snapshot.status, 'PASS', type);
    assert.ok(snapshot.checks.length >= 12, type);
    assert.ok(snapshot.checks.every(check => check.ok
      && (check.dc == null || (Number.isFinite(check.dc) && check.dc <= 1 + 1e-9))), type);
    assert.ok(snapshot.checks.filter(check => check.dc != null).length >= 5, type);
    assert.equal(snapshot.input.profile, profile, type);
    assert.equal(snapshot.authority.includes('NOT FOR CONSTRUCTION'), true, type);
    assert.equal(Object.isFrozen(snapshot), true, type);
    if (type === 'duckfoot') {
      assert.equal(snapshot.input.beamB, .20);
      assert.equal(snapshot.input.beamH, .40);
      assert.ok(snapshot.forces.column && snapshot.forces.beam && snapshot.forces.footing);
      assert.match(duckDesignEquations(snapshot), /ท้องคาน c = 0\.35 m/);
      assert.match(duckChecks(snapshot), /ผลตรวจเสา ฐาน และคาน · ผ่าน/);
      assert.doesNotMatch(duckDesignEquations(snapshot), /NaN|Infinity/);
    } else {
      assert.ok(snapshot.forces.pile.diagram.m.length > 20, type);
      assert.ok(snapshot.forces.pile.diagram.v.length > 20, type);
      assert.ok(snapshot.forces.pile.Mu > 0 && snapshot.forces.pile.Vu > 0, type);
    }
  }
});

test('the original defaults remain honest failures, rather than changing Engine criteria to fit examples', () => {
  const defaultPile = createSystemSnapshot({ ...getPassingExample('pile').values, hp: 5.4, qa: 250 });
  assert.equal(defaultPile.status, 'FAIL');
  assert.ok(defaultPile.checks.some(check => check.key.includes('เดือยหัวเข็ม') && !check.ok));
  const defaultSoldier = createSystemSnapshot({ ...getPassingExample('soldier').values, ipile: 35 });
  assert.equal(defaultSoldier.status, 'FAIL');
  assert.ok(defaultSoldier.checks.some(check => check.key.includes('PILE MOMENT') && !check.ok));
});
