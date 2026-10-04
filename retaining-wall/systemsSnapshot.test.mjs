import assert from 'node:assert/strict';
import { SYSTEM_DEFAULTS, SYSTEM_INPUT_KEYS, createSystemSnapshot } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import { checksFor, designRetainingWall } from './engine.mjs?rwv=20261003-main-equations-1';

for (const type of ['pile', 'pilecf', 'soldier']) {
  for (const profile of ['thai2566', 'aci318', 'wsd']) {
    const input = { ...SYSTEM_DEFAULTS, wtype: type };
    const snapshot = createSystemSnapshot(input, profile);
    const engine = designRetainingWall(input, { profile });
    const checks = checksFor(engine);
    assert.equal(snapshot.type, type);
    assert.equal(snapshot.checks.length, checks.length);
    assert.deepEqual(snapshot.checks.map((c) => [c.key, c.ok]), checks.map((c) => [c.k, c.ok === true]));
    assert.ok(snapshot.forces.pile.diagram.m.length > 20);
    assert.ok(snapshot.forces.pile.diagram.v.length > 20);
    const trace = snapshot.forces.pile.designTrace;
    assert.ok(Math.abs(trace.serviceM * trace.lateralFactor
      - snapshot.forces.pile.Mu) < 1e-7);
    assert.ok(Math.abs(trace.serviceV * trace.lateralFactor
      - snapshot.forces.pile.Vu) < 1e-7);
    assert.equal(snapshot.bbs.length, engine.qty.bbs.length);
    assert.equal(snapshot.forces.load.Ka, engine.Ka);
    if (type === 'soldier') {
      assert.equal(trace.governing, 'FE');
      assert.equal(trace.springM, engine.disp.mMax);
      assert.equal(trace.serviceV, engine.disp.vMax);
      assert.equal(snapshot.forces.load.Kp, engine.Kp);
      assert.equal(snapshot.forces.load.paAtExc, engine.pa(engine.H));
      assert.ok(Math.abs(snapshot.forces.load.activeDry
        - engine.Ka * (input.gs * engine.H ** 2 / 2 + input.q * engine.H)) < 1e-9);
      assert.equal('Ph' in snapshot.forces.load, false);
    } else {
      assert.equal(trace.springM, engine.pile.disp.mMax);
      assert.equal(trace.frameM, engine.pile.frame?.Mpile ?? null);
      assert.equal(trace.serviceM,
        Math.max(engine.pile.disp.mMax, engine.pile.frame?.Mpile || 0));
      assert.equal(snapshot.forces.load.Hq, engine.Hq);
      assert.equal(snapshot.forces.load.Phs, engine.Phs);
      assert.equal(snapshot.forces.load.Pw, engine.Pw);
      assert.equal(snapshot.forces.load.Ph, engine.Ph);
      assert.equal(snapshot.forces.load.Mo, engine.Mo);
      assert.equal(snapshot.forces.pile.Mcg, engine.pile.Mcg);
      assert.equal(snapshot.forces.pile.axT, engine.pile.axT);
      assert.equal(snapshot.forces.pile.axH, engine.pile.axH);
    }
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.forces.pile.diagram.m), true);
    assert.equal(snapshot.authority.includes('NOT FOR CONSTRUCTION'), true);
    assert.equal(snapshot.status, checks.some((c) => !c.ok) ? 'FAIL' : 'PASS');
  }
}
const soldierThai = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', ipile: 35,
}, 'thai2566');
const soldierWet = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', ipile: 35, zw: 0, weepN: 0,
}, 'thai2566');
const soldierHalf = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', ipile: 35, zw: 0, weepN: '1',
}, 'thai2566');
const soldierDrained = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', ipile: 35, zw: 0, weepN: 2,
}, 'thai2566');
assert.equal(soldierWet.forces.load.activeDry, soldierThai.forces.load.activeDry);
assert.ok(soldierWet.forces.pile.Mu > soldierThai.forces.pile.Mu);
assert.ok(soldierWet.forces.pile.Vu > soldierThai.forces.pile.Vu);
assert.equal(soldierHalf.input.weepN, 1);
assert.ok(soldierWet.forces.pile.Mu > soldierHalf.forces.pile.Mu);
assert.ok(soldierHalf.forces.pile.Mu > soldierDrained.forces.pile.Mu);
assert.match(soldierThai.recommendations[0]?.value || '', /I-40/);
for (const soldierSys of ['cant', 'stay', 'anchor']) {
  const anchorData={stayAng:20,gaFreeLength:8,gaBondLength:8,gaBondDia:150,gaBondStress:150,
    gaTendonCapacity:500,gaTendonSpec:'QA rated assembly 500 kN',gaGroutSpec:'QA grout',gaProtectionSpec:'QA double protection'};
  const variant = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'soldier', soldierSys,...anchorData });
  assert.ok(variant.checks.length > 0);
  assert.equal(variant.authority.includes('NOT FOR CONSTRUCTION'), true);
  if (soldierSys === 'anchor') {
    assert.ok(variant.checks.some((c) => c.key.includes('GROUND ANCHOR') && c.ok));
    const weak=createSystemSnapshot({...variant.input,gaTendonCapacity:1});
    assert.ok(weak.checks.some(c=>c.key.includes('GROUND ANCHOR')&&!c.ok));
    for(const key of Object.keys(anchorData))assert.throws(()=>createSystemSnapshot({...variant.input,[key]:''}),RangeError);
  }
}
const pileBase = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'pile' });
const pileHeavy = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'pile', gc: 25 });
assert.equal(pileHeavy.input.gc, 25);
assert.notEqual(pileHeavy.forces.pile.axT, pileBase.forces.pile.axT);
const pileWet = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'pile', zw: 0 });
assert.ok(pileWet.forces.load.Pw > pileBase.forces.load.Pw);
assert.ok(pileWet.forces.load.Ph > pileBase.forces.load.Ph);
assert.equal(pileWet.input.zw, 0);
assert.equal(SYSTEM_INPUT_KEYS.pilecf.includes('L'), true);
assert.equal(SYSTEM_INPUT_KEYS.pilecf.includes('bs'), true);
assert.equal(SYSTEM_INPUT_KEYS.soldier.includes('soldierSys'), true);
const hiddenOverride = createSystemSnapshot({ ...SYSTEM_DEFAULTS, wtype: 'pile',
  usePp: true, kh: 0.6 });
assert.equal(hiddenOverride.input.usePp, SYSTEM_DEFAULTS.usePp);
assert.equal(hiddenOverride.input.kh, SYSTEM_DEFAULTS.kh);
assert.deepEqual(hiddenOverride.checks, pileBase.checks);
assert.match(pileBase.recommendations.find((r) => r.title.includes('กำลังอัด'))?.value || '', /42 ตัน/);
assert.match(pileBase.recommendations.find((r) => r.title.includes('ต้านราบ'))?.value || '', /6\.0 ตัน/);
const pileTargeted = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', Ppile: 42, pileLat: 6,
});
assert.equal(pileTargeted.checks.find((c) => c.key.includes('แรงราบ'))?.ok, true);
assert.equal(pileTargeted.checks.find((c) => c.key.includes('แกน toe'))?.ok, true);
const duck = createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'duckfoot', hp: 2.3, t: .15, hz: .25,
  colDepth: .15, B: 1.5, capL: 1.2, postSpacing: 2.5,
  nPosts: 4, beamB: .25, beamH: .25,
  Npost: 100, Hpost: 10, Mpost: 0,
});
assert.equal(duck.status, 'FAIL');
assert.ok(duck.checks.length >= 30);
assert.ok(duck.forces.column && duck.forces.beam);
assert.equal(duck.forces.footing, null, 'unstable column cannot supply a valid foundation moment');
assert.equal(duck.bbs.length, 2);
assert.equal(duck.authority.includes('HOLD'), false);
assert.equal(duck.geometry.nPosts, 4);
assert.equal(duck.geometry.t, .15);
assert.equal(duck.geometry.colDepth, .15);
assert.equal('pileB' in duck.input, false);
assert.equal(SYSTEM_INPUT_KEYS.duckfoot.includes('profile'), false);
assert.equal(createSystemSnapshot({ ...duck.input, profile: 'aci318' }).profile, 'thai2566');
assert.equal('strapSpan' in duck.geometry, false);
assert.ok(duck.equilibrium.columnDiagram.length >= 41);
assert.equal(duck.equilibrium.columnDiagram[0].m, null);
assert.equal(duck.equilibrium.columnDiagram[40].m, null);
assert.ok(Math.abs(duck.equilibrium.wCol - .15 * .15 * 2.3 * 24) < 1e-9);
assert.ok(Math.abs(duck.pads.reduce((a,p)=>a+p.beamReaction,0) - 3*(2.5*.25*.25-.15*.15*.25)*24)<1e-9);
assert.ok(duck.pads[0].beamReaction < duck.pads[1].beamReaction);
assert.equal(duck.equilibrium.fullContact, false);
assert.equal(duck.equilibrium.qBoundary, null);
assert.equal(duck.equilibrium.qInside, null);
assert.ok(Math.abs(duck.equilibrium.columnP-101.242-duck.equilibrium.beamReaction)<1e-9);
const duckFull = createSystemSnapshot({ ...duck.input, t:.4,colDepth:.4,hz:.6,Mpost:45 });
assert.equal(duckFull.equilibrium.fullContact, true);
assert.ok(duckFull.equilibrium.qBoundary > 0);
assert.ok(duckFull.equilibrium.qInside > 0);
const duckOutside = createSystemSnapshot({ ...duck.input, Mpost: -100 });
assert.equal(duckOutside.equilibrium.qBoundary, null);
assert.equal(duckOutside.equilibrium.qInside, null);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', pileEdT: .4,
}), /ระยะขอบ/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', B: 4,
}), /Toe/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', toe: .6, B: 3.2,
}), /แถวเข็ม Toe\/Heel/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', heel: .6, B: 2.1,
}), /แถวเข็ม Toe\/Heel/);
for (const [key, value] of [['L', 0], ['L', -1], ['L', 9],
  ['bs', 0], ['bs', -0.1], ['bs', 1.1]]) {
  assert.throws(() => createSystemSnapshot({
    ...SYSTEM_DEFAULTS, wtype: 'pilecf', [key]: value,
  }), new RegExp(key));
}
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pilecf', L: 7.8, bs: .3, Lw: 8,
}), /ครีบ/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', beta: 30, phi: 30,
}), /β/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', zw: 0, gsat: 17,
}), /γsat/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', weepN: 1.5,
}), /จำนวนระดับ/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'soldier', stayLvl: 5.3,
}), /จุดยึดรั้ง/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', zw: 100,
}), /zw/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', c: null,
}), /c/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', q: '',
}), /q/);
assert.throws(() => createSystemSnapshot({
  ...SYSTEM_DEFAULTS, wtype: 'pile', project: 'x'.repeat(101),
}), /ชื่อโครงการ/);
assert.throws(() => createSystemSnapshot({
  ...duck.input, capL: 3,
}), /ฐานแต่ละต้น/);
assert.equal(createSystemSnapshot({...duck.input,beamH:.4}).geometry.beamH,.4,'beam depth is independent of pad depth');
assert.throws(() => createSystemSnapshot({
  ...duck.input, beamClear: 2.1,
}), /beamClear/);
assert.throws(() => createSystemSnapshot({
  ...duck.input, nPosts: 2.5,
}), /จำนวนเสา/);
let checkedBounds = 0;
for (const type of ['pile', 'pilecf', 'soldier', 'duckfoot']) {
  for (const key of SYSTEM_INPUT_KEYS[type].filter((field) =>
    !['wtype', 'project', 'profile', 'soldierSys','stayAng','frontBeamMode'].includes(field)&&!field.startsWith('ga'))) {
    for (const invalid of [-1e6, 1e6]) {
      assert.throws(() => createSystemSnapshot({
        ...SYSTEM_DEFAULTS, wtype: type, frontBeamMode:'legacy', [key]: invalid,
      }), RangeError, `${type}/${key} accepted ${invalid}`);
      checkedBounds += 1;
    }
  }
}
assert.equal(checkedBounds,310); // prior304 + rear Su/alpha/project uplift × both numeric boundaries

for (const wtype of ['pile', 'pilecf']) for (const profile of ['thai2566','aci318','wsd']) {
  const input={...SYSTEM_DEFAULTS,wtype,t:.5,ttop:.5,B:SYSTEM_DEFAULTS.toe+.5+SYSTEM_DEFAULTS.heel};
  const oldFile={...input};delete oldFile.cov;
  const original=createSystemSnapshot(input,profile), migrated=createSystemSnapshot(oldFile,profile);
  assert.equal(migrated.input.cov,50,'old files retain the former cover');
  assert.deepEqual(migrated.checks,original.checks);
  assert.deepEqual(migrated.rebarLayout,original.rebarLayout);
  assert.deepEqual(migrated.bbs,original.bbs);
  for (const cov of ['',null,NaN,Infinity,19,101])
    assert.throws(()=>createSystemSnapshot({...input,cov},profile),/cov/);
  assert.throws(()=>createSystemSnapshot({...input,cov:100,ttop:.2},profile),/cov/);
  if(wtype==='pilecf')assert.throws(()=>createSystemSnapshot({...input,cov:100,bs:.15},profile),/cov/);
  const changed=createSystemSnapshot({...input,cov:70},profile);
  assert.equal(changed.input.cov,70);
  const engine=designRetainingWall({...input,cov:70},{profile});
  if(wtype==='pile') {
    const main=engine.stemTab.at(-1);
    assert.ok(Math.abs(main.d-(.5-.070-main.bar.db/2000))<1e-9,'independent effective-depth equation');
  }
  const wall=changed.rebarLayout.groups.find(g=>g.face==='back');
  assert.ok(wall?.paths.length,'accepted cover reaches selected wall rebar');
  const p=wall.paths[0][0];
  assert.ok(Math.abs(p[0]-(input.toe+input.t-.070-wall.db/2000))<1e-9,'clear cover locates bar centre');
  assert.deepEqual(changed.rebarLayout.groups.filter(g=>g.face.startsWith('base-')),
    original.rebarLayout.groups.filter(g=>g.face.startsWith('base-')),'base cover remains 75 mm');
}
console.log('RW-01 native systems snapshot PASS: three engine types x three profiles, spread duck-foot, validation');
