import test from 'node:test';
import assert from 'node:assert/strict';
import {SYSTEM_DEFAULTS,createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {designRetainingWall,DESIGN_PROFILES} from './engine.mjs';
import {designRetainingWall as mirror} from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {inputToDisplay,inputFromDisplay,inputUnit} from './inputUnits.mjs';
import {nativeEquationRows,mainEquationSections} from './essentialReport.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const input=()=>({...SYSTEM_DEFAULTS,...getPassingExample('soldier').values,ancPileSec:35,ancLe:6,ancSu:20,ancAlpha:.4,pileTen:0});

test('independent I35 golden: 20 kPa × alpha .4 × perimeter 1.76 m × length 6 m = 84.48 kN',()=>{
  for(const profile of Object.keys(DESIGN_PROFILES))for(const engine of [designRetainingWall,mirror]){
    const r=engine(input(),{profile}),a=r.stay.anchorPile;
    close(a.perim,1.76);close(a.ancLe,6);close(a.shaftStressKPa,8);
    close(a.TskinT*9.80665,84.48);close(a.TcapKN,84.48);
    close(a.TsecT,14.25);close(a.dcT,a.Tdemand/84.48);
  }
});

test('zero and weak rear soil retain real zero/small resistance and fail, with unchanged applied forces',()=>{
  const baseline=createSystemSnapshot(input());
  for(const [ancSu,ancAlpha,expected] of [[0,.4,0],[20,0,0],[.01,.4,.04224]]){
    const s=createSystemSnapshot({...input(),ancSu,ancAlpha}),a=s.forces.rearAnchor.pileResistance;
    close(a.shaft,expected);close(a.capacity,expected);assert.equal(a.ok,false);assert.equal(s.status,'FAIL');
    assert.deepEqual(s.forces.rearAnchor.members,baseline.forces.rearAnchor.members);
    assert.deepEqual(s.forces.rearAnchor.anchors,baseline.forces.rearAnchor.anchors);
    assert.ok(s.checks.some(c=>!c.ok));assert.equal(s.forces.rearAnchor.constructionApproved,false);
  }
});

test('project uplift capacity is an explicit whole-system allowance, not an automatic PASS',()=>{
  for(const tf of [.001,3]){
    const s=createSystemSnapshot({...input(),ancSu:0,pileTen:tf}),a=s.forces.rearAnchor.pileResistance;
    close(a.capacity,tf*9.80665);close(a.shaft,0);close(a.dc,a.demand/(tf*9.80665));
    assert.equal(a.projectOverride,true);assert.match(a.basis,/PROJECT ALLOWABLE/);
    assert.equal(a.ok,a.dc<=1.0001);assert.equal(s.forces.rearAnchor.capacityVerified,false);
    const row=nativeEquationRows(s).find(r=>r[0]==='เข็มสมอ · แรงถอน');
    assert.match(row[1],/Rallow/);assert.match(row[2],/ค่าโครงการ/);
  }
});

test('old project migration defaults only absent rear soil and preserves old explicit zero',()=>{
  const old=input();delete old.ancSu;delete old.ancAlpha;
  const s=createSystemSnapshot(old);close(s.input.ancSu,19.6133);close(s.input.ancAlpha,.5);
  close(s.forces.rearAnchor.pileResistance.stress,9.80665);
  const zero=createSystemSnapshot({...old,su:0});close(zero.input.ancSu,0);close(zero.forces.rearAnchor.pileResistance.capacity,0);
  const weak=createSystemSnapshot({...old,su:1});close(weak.input.ancSu,9.80665);close(weak.forces.rearAnchor.pileResistance.stress,4.903325);
  for(const su of ['',null,false,NaN])assert.throws(()=>createSystemSnapshot({...old,su}),RangeError);
});

test('explicit invalid active soil/alpha/project capacity reject; inactive rear inputs do not affect cantilever',()=>{
  for(const [key,values] of Object.entries({ancSu:['',null,false,NaN,Infinity,-1,5001],ancAlpha:['',null,false,NaN,-.1,1.01],pileTen:['',null,false,NaN,-1,501]}))
    for(const value of values)assert.throws(()=>createSystemSnapshot({...input(),[key]:value}),RangeError,key+' '+value);
  for(const engine of [designRetainingWall,mirror])for(const key of ['ancSu','ancAlpha'])
    for(const value of ['',null,false,NaN,-1])assert.throws(()=>engine({...input(),[key]:value}),RangeError);
  const cant=createSystemSnapshot({...input(),soldierSys:'cant'});
  const stale=createSystemSnapshot({...input(),soldierSys:'cant',ancSu:-1,ancAlpha:2,pileTen:-1});
  assert.deepEqual(stale.checks,cant.checks);assert.deepEqual(stale.forces,cant.forces);
});

test('new rear inputs round-trip SI/kgf; report and inspector project the same frozen accepted numbers',()=>{
  close(inputToDisplay('ancSu',20,'kgf'),2039.4324259558565);
  close(inputFromDisplay('ancSu',2039.4324259558565,'kgf'),20);
  close(inputToDisplay('pileTen',3,'kgf'),3000);close(inputFromDisplay('pileTen',3000,'kgf'),3);
  assert.equal(inputUnit('ancSu','si'),'kPa');assert.equal(inputUnit('ancSu','kgf'),'kgf/m²');
  const s=createSystemSnapshot(input()),a=s.forces.rearAnchor.pileResistance;
  assert.ok(Object.isFrozen(a));close(a.capacity,84.48);
  const row=nativeEquationRows(s).find(r=>r[0]==='เข็มสมอ · แรงถอน');
  assert.match(row[2],/0\.40 × 20\.000 kPa × 1\.760 m × 6\.000 m = 84\.480 kN/);
  assert.ok(mainEquationSections(s).some(g=>g.key==='rear-uplift'));
  assert.ok(s.equationLedger.sourceKeys.includes('drivenPile'));
});
