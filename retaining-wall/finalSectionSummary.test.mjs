import assert from 'node:assert/strict';
import { createSystemSnapshot } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import { PASSING_EXAMPLES } from './passingExamples.mjs?rwv=20261003-main-equations-1';
import { DESIGN_PROFILES } from './engine.mjs?rwv=20261003-main-equations-1';
import { finalSectionSummary } from './finalSectionSummary.mjs?rwv=20261001-leader-layout-1';

let cases = 0;
for (const type of ['pile', 'pilecf', 'soldier', 'duckfoot']) {
  for (const profile of ['thai2566', 'aci318', 'wsd']) {
    for (const failed of [false, true]) {
      const source = { ...PASSING_EXAMPLES[type].values, project: '<ผลตรวจ & โครงการ>', ...(failed ? { hp: 8 } : {}) };
      const snap = createSystemSnapshot(source, profile);
      const before = JSON.stringify(snap);
      const output = finalSectionSummary(snap, {
        title: type, profileLabel: DESIGN_PROFILES[profile].short,
        support: 'Engine support <current>',
      });
      assert.ok(output.endsWith('</section>'));
      assert.ok(output.includes(`data-report-final-section="${type}"`));
      assert.ok(output.includes(`data-report-profile="${profile}"`));
      assert.ok(output.includes(snap.stamp));
      assert.ok(output.includes('data-a4-cad-sheet="SECTION"'));
      assert.ok(output.includes('data-a4-cad-sheet="PLAN"'));
      assert.equal((output.match(/data-report-final-section=/g)||[]).length,1);
      assert.equal((output.match(/SECTION SUMMARY/g)||[]).length,1);
      assert.ok(output.indexOf('PLAN / MATERIAL')<output.indexOf('SECTION SUMMARY'));
      assert.ok(output.includes('NOT FOR CONSTRUCTION'));
      assert.ok(output.includes(snap.status));
      if(['pile','pilecf'].includes(type))assert.ok(output.includes('ระยะหุ้มเหล็กพนัง/ครีบ '+snap.input.cov+' มม. · ฐาน 75 มม.'));
      assert.ok(output.includes('&lt;ผลตรวจ &amp; โครงการ&gt;'));
      assert.equal(JSON.stringify(snap), before, 'Renderer must not mutate frozen result');
      for (const row of snap.bbs) {
        assert.ok(output.includes(row.mark), `${type}/${profile}: missing selected mark ${row.mark}`);
        assert.ok(output.includes(String(row.size).replaceAll('&', '&amp;')), `${type}/${profile}: missing actual size`);
      }
      if (type === 'soldier') assert.ok(output.includes('แคปหัวเข็มสมอหลังเป็นรูปประกอบ'));
      if (type === 'duckfoot') {
        assert.ok(output.includes('ตัวคูณแบบจำลอง: DL ' + snap.input.factorN + ' · LL ' + snap.input.factorL));
        assert.ok(output.includes('โปรไฟล์ที่เลือก: ACI 318-14 · กำลังหน้าตัด / ตัวคูณแรงโครงการ'));
      }
      if (failed) assert.equal(snap.status, 'FAIL', 'Deliberate FAIL must remain FAIL');
      assert.throws(() => finalSectionSummary({ ...snap, status: snap.status === 'PASS' ? 'FAIL' : 'PASS' }, {
        title: type, profileLabel: profile, support: '',
      }), /verdict\/checks mismatch/);
      assert.throws(() => finalSectionSummary({ ...snap, checks: [] }, {
        title: type, profileLabel: profile, support: '',
      }), /current complete/, 'A result without registered checks cannot issue a summary');
      cases++;
    }
  }
}
assert.throws(() => finalSectionSummary(null, {}), /current complete/);
console.log(`RW-01 final A4 Section: ${cases} native profile/PASS-FAIL projection cases passed`);
