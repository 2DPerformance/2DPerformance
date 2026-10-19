import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as shipped from './engine.mjs?rwv=20261003-main-equations-1';
import * as mirror from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {RW_DEFAULT_INPUT} from './snapshot.mjs?rwv=20261003-main-equations-1';
import {computeForUi,reportForUi} from './workbench.mjs?rwv=20261003-main-equations-1';
import {createSystemSnapshot} from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import {getPassingExample} from './passingExamples.mjs?rwv=20261003-main-equations-1';
import {duckBeam,duckContact} from './duckfootEngine.mjs?rwv=20261003-main-equations-1';
import {buildEquationLedger,renderEquationLedger,LEDGER_SOURCES} from './equationLedger.mjs?rwv=20261003-main-equations-1';
const near=(a,b,tol=1e-8)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tol,a+' != '+b);

// Independently evaluated SI hand examples. No expected answers read from Engine.
for(const [name,api] of [['shipped',shipped],['mirror',mirror]]) {
  for(const [profile,gD,gL,gH,v] of [['thai2566',1.4,1.7,1.7,361.25],['aci318',1.2,1.6,1.6,318.75],['wsd',1,1,1,225]]) {
    test(name+' '+profile+': independent soil/water integration and RC section capacities',()=>{
      const i={...RW_DEFAULT_INPUT,hp:5.5,hz:.5,gs:18,gsat:20,gw:9.81,phi:30,
        q:0,qD:0,qL:0,c:0,beta:0,wallDelta:0,zw:3};
      const r=api.designRetainingWall(i,{profile});
      // Ka=1/3. Soil:96.285kN/m, 204.285kNm/m; water:44.145,44.145.
      near(r.Ka,1/3);near(r.Ph,140.43,1e-7);near(r.Mo,248.43,.002);
      near(api.phiVc(1,.5,25),v);
      if(profile==='wsd')near(api.asReq(100,1,.5,24,390),1425.6429115452412);
      else near(api.asReq(100,1,.5,25,400),561.4900703624377);
      near(r.surcharge.lateralFactor,gH);
      assert.deepEqual([api.DESIGN_PROFILES[profile].gD,api.DESIGN_PROFILES[profile].gL],[gD,gL]);
    });
  }
}

test('two equal UDL spans: exact three-moment reactions and SFD/BMD extrema',()=>{
  const r=duckBeam({nPosts:3,postSpacing:4,colDepth:0,t:0,beamB:.2,beamH:.4,gc:0,qBeam:10});
  near(r.totalLoad,80);[15,50,15].forEach((v,j)=>near(r.reactions[j],v));
  near(r.spans[0].leftMoment,0);near(r.spans[0].rightMoment,-20);
  near(r.spans[1].leftMoment,-20);near(r.spans[1].rightMoment,0);
  for(const s of r.spans)near(Math.max(...s.grid.map(p=>p.M)),11.25);
  near(r.spans[0].grid.find(p=>Math.abs(p.x-1.5)<1e-8).V,0);
});

test('pad contact has consistent boundary/inside sign and compression-only equilibrium',()=>{
  const centre=duckContact(300,450,3,2);near(centre.qBoundary,50);near(centre.qInside,50);
  const left=duckContact(300,180,3,2),right=duckContact(300,720,3,2);
  near(left.contactWidth,1.8);near(left.eccentricity,-.9);near(left.qBoundary,500/3);near(left.qInside,0);
  near(right.contactWidth,1.8);near(right.eccentricity,.9);near(right.qBoundary,0);near(right.qInside,500/3);
  near(left.qBoundary*left.contactWidth*2/2,300);
  near(right.qInside*right.contactWidth*2/2,300);
  assert.equal(duckContact(300,-1,3,2).inside,false);
  assert.equal(duckContact(300,901,3,2).qMax,null);
});

const legacy=['cantilever','counterfort','gravity'];
for(const type of [...legacy,'pile','pilecf','soldier','duckfoot'])test(type+': current projection preserves selected profile, identity, checks and scope',()=>{
  for(const profile of type==='duckfoot'?['thai2566']:['thai2566','aci318','wsd']) {
    const i={...getPassingExample(type).values,wtype:type};
    const s=legacy.includes(type)?computeForUi(i,profile).snapshot:createSystemSnapshot(i,profile);
    assert.ok(s.ok??true,s.errors?.map(e=>e.message).join());
    const l=s.equationLedger;assert.ok(Object.isFrozen(l));assert.ok(Object.isFrozen(l.factors));
    assert.equal(l.identity,s.id??s.stamp);assert.equal(l.type,type);assert.equal(l.constructionApproved,false);
    const checks=l.components.flatMap(c=>c.checks).sort((a,b)=>a.index-b.index);
    assert.deepEqual(checks.map(c=>c.key),s.checks.map(c=>c.key??c.k));
    assert.deepEqual(checks.map(c=>c.ok),s.checks.map(c=>c.ok));
    assert.equal(l.failed,s.checks.filter(c=>!c.ok).length);
    if(type==='duckfoot'){assert.equal(l.profile,'project-strength-aci318-14');assert.equal(l.factors.gD,i.factorN);assert.equal(l.factors.gDr,.9);}
    else assert.equal(l.profile,profile);
    const html=renderEquationLedger(l,{compact:true});assert.ok(html.startsWith('<details'));
    assert.ok(!html.includes('undefined'));assert.ok(html.includes('data-equation-ledger="'+type+'"'));
    if(type==='soldier'){assert.ok(html.includes('คสล.อัดแรง'));assert.ok(html.includes('แคป/เข็มสมอหลัง'));}
    if(legacy.includes(type)) {
      const report=reportForUi(s);assert.ok(report.at(-1).meta.finalSectionSummary);
      assert.ok(report.every(p=>!p.meta.overflow));
      const texts=report.flatMap(p=>p.entities.filter(e=>e.t==='text').map(e=>e.s)).join(' ');
      assert.ok(texts.includes('ขอบเขตผลคำนวณ'));
      assert.ok(texts.includes('แทนค่า'));
      assert.equal(report[0].meta.reportLayout,'rw01-essential-report/2');
      const kgf=reportForUi(s,'kgf');assert.ok(kgf.at(-1).meta.finalSectionSummary);
      assert.ok(kgf.every(p=>!p.meta.overflow));
      assert.ok(kgf.flatMap(p=>p.entities).some(e=>e.t==='text'&&e.s==='ขอบเขตผลคำนวณ'));
      assert.strictEqual(s.equationLedger,l);
    }
  }
});

test('invalid/incomplete ledger refuses projection and genuine FAIL stays visible',()=>{
  const i={...getPassingExample('pile').values,hp:8},s=createSystemSnapshot(i);
  assert.equal(s.status,'FAIL');assert.equal(s.equationLedger.failed,s.checks.filter(c=>!c.ok).length);
  const args={type:'pile',profile:'thai2566',input:i,checks:s.checks,identity:s.stamp};
  for(const bad of [{type:'unknown'},{profile:'unknown'},{checks:[]},{checks:[{key:'X'}]},{identity:''}])
    assert.throws(()=>buildEquationLedger({...args,...bad}),TypeError);
  assert.throws(()=>renderEquationLedger({...s.equationLedger,constructionApproved:true}),TypeError);
  assert.equal(LEDGER_SOURCES.aci.verified,'clause-locator-only');
  assert.ok(shipped.DESIGN_PROFILES.thai2566.ev.phiClause.includes('ควบคุมคุณภาพ'));
  assert.ok(!shipped.DESIGN_PROFILES.thai2566.ev.memberClause.includes('ข้อ 10.2'));
  assert.ok(shipped.DESIGN_PROFILES.wsd.ev.eq[0].includes('j·d'));
});
