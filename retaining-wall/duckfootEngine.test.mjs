import assert from 'node:assert/strict';
import test from 'node:test';
import {duckBeam,duckContact,duckColumnCurve,duckColumnActions,calculateDuckfoot,recommendDuckfoot} from './duckfootEngine.mjs?rwv=20261003-main-equations-1';
const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const base={hp:2.3,t:.3,colDepth:.3,B:1.2,capL:1.2,hz:.5,gc:24,
  postSpacing:2.5,nPosts:4,beamB:.3,beamH:.3,Npost:100,Hpost:10,Mpost:0,
  fc:24,fy:390,cov:40,qa:250,mu:.5,factorN:1.4,factorH:1.7,qBeam:0};
test('continuous beam hand cases: one span and two equal spans',()=>{
  const i={nPosts:2,postSpacing:4,capL:0,beamB:.25,beamH:1/3,gc:24};
  const a=duckBeam(i);near(a.totalLoad,8);near(a.reactions[0],4);near(a.reactions[1],4);near(a.moment,4);
  near(a.spans[0].leftMoment,0);near(a.spans[0].rightMoment,0);
  const b=duckBeam({...i,nPosts:3});near(b.reactions[0],3);near(b.reactions[1],10);near(b.reactions[2],3);
  near(b.spans[0].rightMoment,-4);near(b.spans[1].leftMoment,-4);
});
test('above-pad beam loading preserves total force and joint moments',()=>{
  const b=duckBeam({...base,qBeam:3});
  near(b.reactions.reduce((a,b)=>a+b,0),b.totalLoad);
  for(let j=1;j<b.spans.length;j++)near(b.spans[j-1].rightMoment,b.spans[j].leftMoment);
  assert.notEqual(b.reactions[0],b.reactions[1]);
});
test('pad contact: uniform / reversed triangle / absent equilibrium',()=>{
  const a=duckContact(120,72,1.2,1);near(a.qBoundary,100);near(a.qInside,100);
  const b=duckContact(120,120,1.2,1);near(b.contactWidth,.6);near(b.qInside,400);near(b.qBoundary,0);
  assert.equal(duckContact(120,-10,1.2,1).inside,false);
});
test('column resistance matches published ACI 318-14 example control points',()=>{
  // StructurePoint: 16 inch square, 8 #9 (1 in2 each), fc=5000 psi, fy=60000 psi;
  // reinforcement centres at 2.5 inch. Independent published Pmax=798 kip,
  // phiP=622 kip and phiM=170 kip-ft at c=13.5 inch.
  const db=Math.sqrt(4*645.16/Math.PI);
  const c=duckColumnCurve({b:.4064,h:.4064,fc:34.4737865,fy:413.685438,cover:.0635-.01-db/2000,db,n:8});
  near(c.Pmax,798*4.4482216,5);
  near(c.capacityAt(622*4.4482216),170*1.35581795,3);
  assert.equal(c.capacityAt(c.Pmax+1),0);
});
test('signed second-order column: exact zero-P limit, boundary conditions and opposing actions',()=>{
  const zero=duckColumnActions(base,0,10,-23);
  near(zero.baseM,0);near(zero.M,23);
  const r=duckColumnActions(base,100,10,-23);
  const k=Math.sqrt(100/r.EI),angle=k*base.hp;
  near(r.baseM,-23/Math.cos(angle)+10*Math.tan(angle)/k);
  near(r.grid.at(-1).m,-23);
  assert.ok(r.M>=23&&r.baseM!==0);
  const calc=calculateDuckfoot(base);
  for(const p of calc.pads)near(p.totalM,p.columnP*base.t/2+calc.equilibrium.wCap*base.B/2+p.serviceColumn.baseM);
  assert.ok(calc.checks.some(c=>c.key.includes('ขีดจำกัด second order')));
});
test('every duck pad is checked and no field invents a pile or remote strap',()=>{
  const r=calculateDuckfoot(base);
  assert.equal(r.pads.length,4);assert.equal(r.column.cases.length,8);
  assert.ok(r.checks.some(c=>c.key.includes('P–M')));
  assert.ok(r.checks.some(c=>c.key.includes('เจาะทะลุ')));
  assert.ok(r.bbs.length===4);
  assert.equal(r.status,r.checks.every(c=>c.ok)?'PASS':'FAIL');
  near(r.pads.reduce((s,p)=>s+p.totalV,0),4*(base.Npost+.3*.3*2.3*24+1.2*1.2*.5*24)+r.beam.totalLoad);
  assert.equal(JSON.stringify(r).includes('HOLD'),false);
});
test('thin column and resultants outside footing must fail, never select a passing verdict',()=>{
  const thin=calculateDuckfoot({...base,t:.15,colDepth:.15});
  assert.equal(thin.status,'FAIL');assert.ok(thin.checks.some(c=>c.key.startsWith('เสา')&&!c.ok));
  const outside=calculateDuckfoot({...base,Mpost:-100});
  assert.equal(outside.status,'FAIL');assert.ok(outside.pads.some(p=>!p.inside));
  assert.equal(outside.footing,null);
});
test('recommendation is an independently rerun complete geometry, with soil and forces unchanged',()=>{
  const input={...base,t:.15,colDepth:.15,B:1.5,capL:1.2,hz:.25,beamB:.25,beamH:.25,qa:150};
  const advice=recommendDuckfoot(input,calculateDuckfoot(input));
  assert.ok(advice.verified&&advice.trials<=96&&advice.changes.length>0);
  assert.equal(calculateDuckfoot(advice.input).status,'PASS');
  for(const k of ['Npost','Hpost','Mpost','fc','fy','qa','mu','factorN','factorH','qBeam'])assert.equal(advice.input[k],input[k]);
});
