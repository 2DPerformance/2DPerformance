import assert from 'node:assert/strict';
import test from 'node:test';
import { toeStripActions, designRetainingWall, checksFor } from './engine.mjs?rwv=20261003-main-equations-1';
import { RW_DEFAULT_INPUT } from './snapshot.mjs?rwv=20261003-main-equations-1';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('Toe: uniform pressure has the independent cantilever solution',()=>{
  const a=toeStripActions({B:3,toe:1,V:300,xbar:1.5,dead:20});
  near(a.at(1).V,80);near(a.bottomMoment,40);near(a.topMoment,0);
  near(a.at(.6).V,48);near(a.at(.6).M,14.4);
});
test('Toe: pressure increasing toward Heel is integrated, not replaced by q_toe',()=>{
  // q(x)=50+100x/3, qnet=30+100x/3. Integral over 0..1.
  const a=toeStripActions({B:3,toe:1,V:300,xbar:1.75,dead:20});
  near(a.at(1).V,30+50/3);near(a.bottomMoment,15+100/18);
});
test('Toe: partial contact clips the triangle at its actual boundary',()=>{
  // q=200(1-x/1.5) over 0..1.5. R=150 at x=.5.
  const a=toeStripActions({B:3,toe:2,V:150,xbar:.5,dead:10});
  near(a.at(2).V,130);near(a.at(2).M,150*(2-.5)-10*2*2/2);
  const reversed=toeStripActions({B:3,toe:1,V:150,xbar:2.5,dead:10});
  near(reversed.topMoment,5);near(reversed.at(.6).V,-6);
});
test('Toe: pile force enters only after its position, including jump in SFD',()=>{
  const a=toeStripActions({B:3,toe:1,V:0,xbar:0,dead:20,pile:{x:.7,R:100}});
  near(a.at(.6).V,-12);near(a.at(.8).V,84);
  near(a.at(1).M,20);near(a.topMoment,4.9);
  const jump=a.grid.filter(p=>p.x===.7);assert.equal(jump.length,2);
  near(jump[1].V-jump[0].V,100);
});
test('Toe: interior zero-shear point controls the moment envelope',()=>{
  // Net q=80-100x on 0..2: V=80x-50x², M maximum at x=1.6.
  const a=toeStripActions({B:2,toe:2,V:200,xbar:2/3,dead:120});
  near(a.bottomMoment,80*1.6**2/2-100*1.6**3/6);
});
test('Toe: no compressive equilibrium outside footprint is an input failure',()=>{
  assert.throws(()=>toeStripActions({B:3,toe:1,V:100,xbar:-.1,dead:10}),/สมดุล/);
});
test('Toe registered row preserves pass/boundary/fail and every design profile',()=>{
  for(const profile of ['thai2566','aci318','wsd']){
    const r=designRetainingWall({...RW_DEFAULT_INPUT},{profile,qaSource:'input'});
    const row=checksFor(r).find(c=>c.k==='SHEAR — TOE');
    assert.ok(row);near(row.u,r.VuT/r.phiVcT);assert.equal(row.ok,r.VuT<=r.phiVcT);
    for(const ratio of [.8,1,1.001]){
      const at=checksFor({...r,VuT:r.phiVcT*ratio}).find(c=>c.k==='SHEAR — TOE');
      near(at.u,ratio);assert.equal(at.ok,ratio<=1);
    }
    const missing=checksFor({...r,VuT:NaN}).find(c=>c.k==='SHEAR — TOE');
    assert.equal(missing.ok,false);
    assert.ok(r.barFT.prov>=r.AsTtop);
  }
});
