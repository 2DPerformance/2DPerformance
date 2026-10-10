import test from 'node:test';
import assert from 'node:assert/strict';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {DESIGN_PROFILES,designRetainingWall} from './engine.mjs';
import {buildRearAnchorActions} from './rearAnchorActions.mjs';
import {renderRearAnchorActions} from './rearAnchorPresentation.mjs';
import {nativeEquationRows,mainEquationSections} from './essentialReport.mjs';
import {displayedChecks} from './resultUnits.mjs';
const input=()=>({...getPassingExample('soldier').values,ancDowelDb:16});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('independent centered-envelope golden: head at center leaves only half cap above joint',()=>{
  const s=createSystemSnapshot({...input(),ancCapH:.5,cov:50});
  const e=s.forces.rearAnchor.dowel.assessment.envelopes[0];
  near(e.available,.2);near(e.assumed,.64);near(e.shortfall,.44);
  near(e.centeredEnvelopeHeight,1.38);assert.equal(e.fitsAssumedStraightEnvelope,false);
  near(e.topLevel-e.headLevel,.25);
  const boundary=createSystemSnapshot({...input(),ancCapH:1.38,cov:50}).forces.rearAnchor.dowel.assessment.envelopes[0];
  assert.equal(boundary.fitsAssumedStraightEnvelope,true);near(boundary.shortfall,0);
});

test('larger envelope, entered cover and fallback geometry never verify bond or change verdict',()=>{
  for(const profile of Object.keys(DESIGN_PROFILES)){
    const small=createSystemSnapshot({...input(),ancCapH:.5},profile);
    const large=createSystemSnapshot({...input(),ancCapH:1.5},profile);
    // Native soldier has no independent cap-cover input. Test the Engine's
    // explicit cover through its public API, not a silently discarded UI key.
    const cover=buildRearAnchorActions(designRetainingWall({...input(),ancCapH:1.5,cov:100},{profile}),DESIGN_PROFILES[profile].gH,'cover');
    const fallback=createSystemSnapshot({...input(),ancCapH:0},profile);
    const a=large.forces.rearAnchor.dowel.assessment;
    near(a.envelopes[0].available,.70);near(cover.dowel.assessment.envelopes[0].available,.65);
    assert.equal(a.envelopes[0].fitsAssumedStraightEnvelope,true);
    assert.equal(a.connectionVerified,false);assert.equal(a.developmentVerified,false);
    assert.deepEqual(large.checks,small.checks);assert.equal(large.status,small.status);
    assert.deepEqual(large.forces.pile,small.forces.pile);assert.deepEqual(large.bbs,small.bbs);
    assert.deepEqual(fallback.forces.rearAnchor.dowel.assessment.envelopes,small.forces.rearAnchor.dowel.assessment.envelopes);
    assert.equal(large.forces.rearAnchor.missingCapacity.length,3);
    assert(Object.isFrozen(a.envelopes[0]));
  }
});

test('PC-wire projection uses real wire count/area; never prints inactive DB area or generic embedment',()=>{
  const s=createSystemSnapshot(input());
  const result=designRetainingWall({...input(),ancDowelMode:'pcwire'});
  const a=buildRearAnchorActions(result,DESIGN_PROFILES[s.profile].gH,s.stamp);
  const w=a.dowel.assessment.wire;
  near(w.area,w.count*Math.PI*w.diameter**2/4);near(w.capacity,.75*w.area*400/1000);
  assert.equal(a.dowel.assessment.envelopes.length,0);
  assert.equal(a.dowel.assessment.connectionVerified,false);
  for(const mode of ['si','kgf']){
    const html=renderRearAnchorActions(a,{mode});assert.match(html,/ลวด PC ที่ตรวจจริง/);
    assert(!html.includes('Asจัด')&&!html.includes('40db')&&!html.includes('15db'));
    assert.match(html,/รอยต่อยังไม่ตรวจสมอปลาย/);
    const fixture={...s,forces:{...s.forces,rearAnchor:a}};
    const rows=nativeEquationRows(fixture,mode);
    assert(rows.some(r=>r[0]==='APd · ลวด PC'));assert(!rows.some(r=>r[0]==='APd · พื้นที่เหล็ก'));
    assert.equal(mainEquationSections(fixture,mode).find(g=>g.key==='dowel').rows.length,1);
  }
});

test('cast-together screen and A4 retain steel/identity without assumed envelope recommendation',()=>{
  const s=createSystemSnapshot(input()),before=JSON.stringify(s);
  for(const mode of ['si','kgf']){
    const html=renderRearAnchorActions(s.forces.rearAnchor,{mode});
    const rows=nativeEquationRows(s,mode),group=mainEquationSections(s,mode).find(g=>g.key==='dowel');
    const check=displayedChecks(s,mode).find(c=>c.key.includes('APd'));
    assert.equal(check.key,'รอยต่อสมอ↔PILE CAP — APd');
    assert.match(check.label,/พื้นที่เหล็กเดือยหล่อพร้อมกัน/);
    assert(html.includes(s.stamp));assert.match(html,/เหล็กเดือยหล่อพร้อมกัน/);
    assert(!/40db|15db|data-rear-dowel-envelope|อีพ็อกซี/.test(html));
    assert(!rows.some(row=>row[0]==='APd · พื้นที่ฝังในโมเดล'));
    assert.equal(group.rows.length,2);assert.match(group.title,/หล่อพร้อมกัน/);
    assert(!/NaN|Infinity|undefined/.test(html+rows.flat().join(' ')));
    assert.equal(s.forces.rearAnchor.dowel.assessment.connectionVerified,false);
  }
  assert.equal(JSON.stringify(s),before);
});
