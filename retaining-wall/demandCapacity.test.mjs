import test from 'node:test';
import assert from 'node:assert/strict';
import * as shipped from './engine.mjs';
import * as mirror from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {getPassingExample} from './passingExamples.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {readFileSync} from 'node:fs';
import {WORKBENCH_REVISION} from './workflow.mjs';

const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<1e-10,`${a} != ${b}`);
const input=()=>({...getPassingExample('soldier').values});
const apd=checks=>checks.find(c=>c.k?.includes('APd')||c.key?.includes('APd'));
const embed=checks=>checks.find(c=>c.k==='EMBEDMENT D'||c.key==='EMBEDMENT D');
const spring=checks=>checks.find(c=>(c.k??c.key)==='พฤติกรรมเข็ม (point spring)');

test('normal iframe and cross-type routes load the same new HTML/cache graph',()=>{
  const shell=readFileSync(new URL('../../src/features/concrete/retainingWall/RetainingWallDesignWorkbench.jsx',import.meta.url),'utf8');
  const appRevision=shell.match(/const WORKBENCH_REVISION = '([^']+)'/)[1];
  assert.equal(appRevision,WORKBENCH_REVISION);assert.equal(appRevision,'20261003-final-acceptance-1');
  const html=readFileSync(new URL('../retaining-wall-workbench.html',import.meta.url),'utf8');
  assert.ok(html.includes('workbench.mjs?rwv='+appRevision));
  assert.ok(html.includes('workflow.mjs?rwv='+appRevision));
  const systems=readFileSync(new URL('./systems.html',import.meta.url),'utf8');
  assert.ok(systems.includes('systemsPage.mjs?rwv='+appRevision));
});

for(const [name,api] of [['shipped',shipped],['mirror',mirror]]) {
  test(name+': independent DB area golden, exact boundary and minimum-count guidance',()=>{
    // Independent area ledger: required 4 x 113.1 = 452.4 mm².
    // A single DB12 supplies113.1; four supply452.4; eight supply904.8.
    for(const [count,expected,ok] of [[1,4,false],[4,1,true],[8,.5,true]]) {
      const r=api.designRetainingWall({...input(),ancDowelDb:12,ancDowelN:count},{profile:'thai2566'});
      const c=apd(api.checksFor(r));near(c.u,expected);assert.equal(c.ok,ok);
      assert.equal(r.stay.anchorPile.dowel.spec,count+'-DB12');
      assert.match(c.fix,/4-DB12/);assert.match(c.fix,/คำนวณใหม่/);
      assert.match(c.req,/ยังไม่ตรวจระยะฝัง/);
    }
  });

  test(name+': quantitative embedment/long-pile goldens never use status markers',()=>{
    const original=api.designRetainingWall(input(),{profile:'thai2566'});
    for(const tie of [true,false])for(const [D,Dreq,betaD,ratio,ok] of [
      [8,6,tie?3:5,.5,true],[6,6,tie?1.5:2.5,1,true],
      [2,6,tie?.5:5/6,3,false],
    ]) {
      const r={...original,tie,D,Dreq,embedOK:ok,embed:{...original.embed,betaD,longPile:ok}};
      const checks=api.checksFor(r);
      near(embed(checks).u,Dreq/D);assert.equal(embed(checks).ok,ok);
      near(spring(checks).u,ratio);assert.equal(spring(checks).ok,ok);
    }
  });

  test(name+': PC-wire screening preserves actual force/resistance at severe FAIL and equality',()=>{
    const r=api.designRetainingWall({...input(),ancDowelMode:'pcwire'},{profile:'thai2566'});
    const a=r.stay.anchorPile,d=a.dowel;
    for(const [Tu,cap,expected]of [[25,100,.25],[100,100,1],[400,100,4]]){
      const x={...r,stay:{...r.stay,anchorPile:{...a,dowel:{...d,Tu,pc:{...d.pc,Tcap:cap},ok:Tu<=cap}}}};
      const c=apd(api.checksFor(x));near(c.u,expected);assert.equal(c.ok,Tu<=cap);
    }
    // The PC-wire mechanism remains unexposed in the product's DB-only inputs.
    assert.equal(createSystemSnapshot(input()).input.ancDowelMode,undefined);
  });

  test(name+': accepted tolerances remain visible without falsifying D/C',()=>{
    const r=api.designRetainingWall(input(),{profile:'thai2566'}),d=r.stay.anchorPile.dowel;
    const x={...r,D:5.99,Dreq:6,embedOK:true,stay:{...r.stay,anchorPile:{...r.stay.anchorPile,
      dowel:{...d,AsNeed:1000,AsProv:999.5,ok:true}}}};
    near(embed(api.checksFor(x)).u,6/5.99);assert.equal(embed(api.checksFor(x)).ok,true);
    near(apd(api.checksFor(x)).u,1000/999.5);assert.equal(apd(api.checksFor(x)).ok,true);
  });
}

test('three registered ratios and actual DB-count guidance reach one immutable Snapshot in SI/kgf',()=>{
  for(const profile of Object.keys(shipped.DESIGN_PROFILES))for(const count of [1,4,8]){
    const i={...input(),ancDowelDb:12,ancDowelN:count},r=shipped.designRetainingWall(i,{profile});
    const si=createSystemSnapshot(i,profile),kg=createSystemSnapshot({...i,unitMode:'kgf'},profile);
    const check=apd(si.checks),expected=apd(shipped.checksFor(r));
    near(check.dc,expected.u);near(embed(si.checks).dc,embed(shipped.checksFor(r)).u);
    near(spring(si.checks).dc,spring(shipped.checksFor(r)).u);
    assert.deepEqual(kg.checks,si.checks);assert.equal(kg.status,si.status);
    assert(Object.isFrozen(si.checks));assert(Object.isFrozen(check));
    assert.equal(si.forces.rearAnchor.dowel.count,count);
    assert.equal(check.ok,count>=4);assert.match(check.fix,/4-DB12/);
    assert.equal(si.constructionApproved,undefined);assert.equal(si.forces.rearAnchor.constructionApproved,false);
  }
});

test('all support/profile combinations keep numeric ratios and no inappropriate APd check',()=>{
  for(const api of [shipped,mirror])for(const profile of Object.keys(api.DESIGN_PROFILES))for(const support of ['cant','stay','anchor']){
    const r=api.designRetainingWall({...input(),soldierSys:support},{profile});
    const checks=api.checksFor(r);
    near(embed(checks).u,r.Dreq/r.D);
    near(spring(checks).u,(support==='cant'?2.5:1.5)/r.embed.betaD);
    if(support==='stay'){
      const d=r.stay.anchorPile.dowel;near(apd(checks).u,d.AsNeed/d.AsProv);
    }else assert.equal(apd(checks),undefined);
  }
});

test('recommended count at each selected DB size is rechecked, never a fabricated all-check PASS',()=>{
  for(const profile of Object.keys(shipped.DESIGN_PROFILES))for(const db of [12,16,20,25,32])for(const hp of [2.3,5.4,8]){
    const i={...input(),hp,ancDowelDb:db,ancDowelN:1};
    const first=shipped.designRetainingWall(i,{profile}),d=first.stay.anchorPile.dowel;
    assert.match(apd(shipped.checksFor(first)).fix,new RegExp(d.nAuto+'-DB'+db+'/สมอ'));
    const second=shipped.designRetainingWall({...i,ancDowelN:d.nAuto},{profile});
    assert.equal(apd(shipped.checksFor(second)).ok,true);
    assert.ok(apd(shipped.checksFor(second)).u<=1);
    assert.equal(second.stay.anchorPile.dowel.spec,d.nAuto+'-DB'+db);
    assert.match(apd(shipped.checksFor(second)).req,/ยังไม่ตรวจระยะฝัง/);
    if(hp===8)assert.ok(shipped.checksFor(second).some(c=>!c.ok),'Other real failures must remain');
  }
});
