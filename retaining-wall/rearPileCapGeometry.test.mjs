import test from 'node:test';
import assert from 'node:assert/strict';
import { inputGeometry } from './inputGeometry.mjs?rwv=20261003-main-equations-1';
import { soldierDrawing } from './inputDiagram.mjs?rwv=20261003-main-equations-1';
import { rearPileCaps } from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import { createSystemSnapshot, SYSTEM_DEFAULTS } from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';

test('each rear V-stay pile head receives one schematic cap, including an odd last bay',()=>{
  const input={...SYSTEM_DEFAULTS,wtype:'soldier',soldierSys:'stay',hp:5.4,Lw:12,pileS:1.2,stayLb:6.1,ancPileSec:40};
  const draft=inputGeometry('soldier',input),caps=rearPileCaps(draft.g.stayLayout);
  assert.equal(draft.g.stayLayout.fronts.length,11);
  assert.equal(caps.length,6);
  assert.equal(draft.g.stayLayout.anchors.at(-1).count,1);
  assert.deepEqual(caps.map(c=>c.position),draft.g.stayLayout.anchors.map(a=>[a.head.x,a.head.y,a.head.z]));
  assert.ok(caps.every(c=>Math.abs(c.size[0]-.60)<1e-10&&c.size[1]===.50&&Math.abs(c.size[2]-.60)<1e-10));
  assert.deepEqual(draft.parts.filter(p=>p.kind==='cap').map(({position,size})=>({position,size})),caps.map(({position,size})=>({position,size})));
  const calculated=createSystemSnapshot(input,'thai2566');
  assert.deepEqual(rearPileCaps(calculated.geometry.stayLayout).map(c=>c.position),caps.map(c=>c.position));
  assert.match(soldierDrawing(draft.g,'plan'),/แคปหัวเข็มหลัง/);
  assert.match(soldierDrawing(draft.g,'section'),/ฐานหัวเข็มสมอ/);
});

test('cantilever soldier and ground anchor do not inherit rear pile caps',()=>{
  for(const soldierSys of ['cant','anchor']){
    const draft=inputGeometry('soldier',{...SYSTEM_DEFAULTS,soldierSys});
    assert.equal(draft.parts.some(part=>part.kind==='cap'),false,soldierSys);
  }
});
