import test from 'node:test';
import assert from 'node:assert/strict';
import { inputGeometry } from './inputGeometry.mjs?rwv=20261003-main-equations-1';
import { duckfootConcreteBoxes, duckfootGeometry } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { SYSTEM_DEFAULTS,createSystemSnapshot } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';

test('draft pile centres match Engine and 2D edge-to-centre dimensions',()=>{
  for(const type of ['pile','pilecf']){
    const draft=inputGeometry(type,{...SYSTEM_DEFAULTS,pileEdT:.55,pileEdH:.6,pileB:.35,B:4});
    const centres=new Set(draft.parts.filter(p=>p.kind==='pile').map(p=>p.line[0][0]));
    assert.deepEqual([...centres],[.55,3.4]);
  }
});
test('new duck-foot beam is 200 x 400 mm; draft uses the shared raised longitudinal geometry',()=>{
  assert.equal(SYSTEM_DEFAULTS.beamB,.2);assert.equal(SYSTEM_DEFAULTS.beamH,.4);
  const input={...SYSTEM_DEFAULTS,hp:2.3,t:.15,hz:.25,B:1.5};
  const draft=inputGeometry('duckfoot',input),canonical=duckfootConcreteBoxes(duckfootGeometry(input));
  assert.deepEqual(draft.parts.filter(p=>!['soil','ground','boundary'].includes(p.kind)),canonical);
  const beam=draft.parts.find(p=>p.kind==='strap');
  assert.deepEqual(beam.size,[.2,.4,7.5]);assert.equal(beam.position[1],input.beamClear+.2);
  assert.equal(draft.parts.some(p=>p.kind==='pile'),false);
  assert.equal('equilibrium' in draft,false);assert.equal('checks' in draft,false);
});
test('input-driven soil skin follows backfill slope, rear anchor reach and footing contact level',()=>{
  const wall=inputGeometry('cantilever',{hp:4,Lw:8,B:3.5,toe:.8,t:.3,heel:2.4,beta:10,fc:24});
  const skin=wall.parts.find(p=>p.kind==='ground'&&p.polygon);
  assert.equal(skin.depth,8);
  assert.equal(skin.polygon[0][0],1.1);
  assert.ok(Math.abs((skin.polygon[1][1]-skin.polygon[0][1])-2.4*Math.tan(10*Math.PI/180))<1e-10);
  assert.deepEqual(wall.parts,inputGeometry('cantilever',{hp:4,Lw:8,B:3.5,toe:.8,t:.3,heel:2.4,beta:10,fc:30}).parts);
  const soldier=inputGeometry('soldier',{hp:5.4,Lw:12,stayLb:6.1,soldierSys:'stay'});
  assert.ok(soldier.parts.find(p=>p.kind==='ground'&&p.polygon).polygon[1][0]>=soldier.g.stayLayout.anchors[0].head.x+1);
  const foot=inputGeometry('duckfoot',{hz:.25});
  const ground=foot.parts.find(p=>p.kind==='ground');
  assert.equal(ground.position[1]+ground.size[1]/2,-.25);
});
test('saved beam values remain exact rather than being overwritten by the new defaults',()=>{
  const draft=inputGeometry('duckfoot',{...SYSTEM_DEFAULTS,beamB:.25,beamH:.25,beamClear:0});
  const beam=draft.parts.find(p=>p.kind==='strap');assert.deepEqual(beam.size,[.25,.25,7.5]);assert.equal(beam.position[1],.125);
});
test('seven draft systems retain finite geometry, with stay members from the shared V layout',()=>{
  for(const type of ['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot']){
    const d=inputGeometry(type,SYSTEM_DEFAULTS);assert.ok(d.parts.length>0,type);
    for(const part of d.parts){for(const list of [part.position,part.size,...(part.line||[]),...(part.polygon||[])].filter(Boolean))assert.ok(list.every(Number.isFinite),type);}
    if(type==='soldier')assert.deepEqual(d.parts.filter(p=>p.member).map(p=>p.member),d.g.stayLayout.members);
  }
});

test('soldier chosen plank height persists; legacy absence keeps30cm, explicit invalid stays invalid',()=>{
  const raw={...SYSTEM_DEFAULTS,wtype:'soldier',ipile:40,lagW:35};
  const chosen=createSystemSnapshot(raw),old={...raw};delete old.lagW;
  assert.equal(chosen.input.lagW,35);assert.equal(chosen.geometry.lagW,.35);
  assert.equal(createSystemSnapshot(old).geometry.lagW,.3);
  for(const lagW of ['',null,NaN,19,41])assert.throws(()=>createSystemSnapshot({...raw,lagW}),/lagW/);
  const defaultHeight=createSystemSnapshot({...raw,lagW:30});
  assert.deepEqual(chosen.checks,defaultHeight.checks);
  assert.deepEqual(chosen.forces.pile,defaultHeight.forces.pile,'plank height does not alter pile action');
});

test('soldier planks stop at entered height and the shortened last bay rather than span the whole wall',()=>{
  const raw={...SYSTEM_DEFAULTS,wtype:'soldier',hp:2.3,Lw:3.1,pileS:1.2,ipile:40,lagW:35,tLag:6};
  const draft=inputGeometry('soldier',raw),planks=draft.parts.filter(p=>p.kind==='wall');
  assert.equal(planks.length,3*7);
  assert.ok(planks.every(p=>p.size[0]===.06&&p.size[2]<raw.pileS));
  assert.ok(Math.abs(Math.max(...planks.map(p=>p.position[1]+p.size[1]/2))-raw.hp)<1e-10);
  const last=planks.filter(p=>p.label.includes('ช่วง 3 /'));
  assert.ok(last.every(p=>p.position[2]+p.size[2]/2<raw.Lw/2));
  assert.ok(Math.abs(last.at(-1).size[1]-.2)<1e-10);
  const snap=createSystemSnapshot(raw);
  assert.equal(draft.g.lagW,snap.geometry.lagW);assert.equal(draft.g.lagT,snap.geometry.lagT);
});
