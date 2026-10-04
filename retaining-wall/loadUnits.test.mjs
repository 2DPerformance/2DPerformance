import assert from 'node:assert/strict';
import {test} from 'node:test';
import {designRetainingWall as publicEngine} from './engine.mjs?rwv=20261003-main-equations-1';
import {designRetainingWall as mirrorEngine} from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {RW_DEFAULT_INPUT,normalizeInput} from './snapshot.mjs?rwv=20261003-main-equations-1';
import {normalizeSurchargeInput,normalizeDuckLoadInput} from './loadInput.mjs?rwv=20260930-load-units-1';
import {calculateDuckfoot} from './duckfootEngine.mjs?rwv=20261003-main-equations-1';
import {inputToDisplay,inputFromDisplay,inputUnit,validateInputUnitMode} from './inputUnits.mjs?rwv=20260930-load-units-1';
import {createSystemSnapshot} from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import {getPassingExample} from './passingExamples.mjs?rwv=20261003-main-equations-1';
const near=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<=tol,actual+' != '+expected);

test('native frozen surface ledger carries accepted split and actual profile factors into report',()=>{
  for(const q of [true,false,' '])assert.throws(()=>normalizeSurchargeInput({q,qD:Number(q),qL:0}),RangeError);
  for(const type of ['pile','pilecf','soldier'])for(const profile of ['thai2566','aci318','wsd']) {
    const i={...getPassingExample(type).values,q:10,qD:3.125,qL:6.875};
    const s=createSystemSnapshot(i,profile),q=s.forces.load.surcharge;
    assert.ok(Object.isFrozen(q));near(q.dead,3.125);near(q.live,6.875);near(q.total,10);
    if(type==='soldier')assert.equal(q.verticalFactored,null);
    else {const [gd,gl]=profile==='thai2566'?[1.4,1.7]:profile==='aci318'?[1.2,1.6]:[1,1];near(q.verticalFactored,gd*3.125+gl*6.875);}
  }
});

test('duck DL/LL: independent one-span reactions, column force and second-order moment',()=>{
  const i={...getPassingExample('duckfoot').values,nPosts:2,postSpacing:4,t:.35,colDepth:.35,
    hp:2.3,gc:24,beamB:.2,beamH:.4,Npost:100,NpostD:70,NpostL:30,qBeam:5,qBeamD:2,qBeamL:3,factorN:1.4,factorL:1.7};
  const r=calculateDuckfoot(i);
  near(r.beamDead.totalLoad,15.008);near(r.beamLive.totalLoad,12);
  near(r.factoredBeam.totalLoad,41.4112);
  // Symmetric one-span reactions and closed-form integration at midspan.
  const mu=20.7056*2-7.9*2**2/2-2.688*(2-.175)**2/2;
  near(r.beamDesign.M,mu);near(r.beamDesign.V,20.7056);
  for(const p of r.pads) {
    near(p.columnPD,84.266);near(p.columnPL,36);near(p.columnP,120.266);
    near(p.beamCoupleD,-.5628);near(p.beamCoupleL,-.45);
    const high=r.column.cases.find(c=>c.index===p.index&&c.combination==='แรงอัดสูง');
    const low=r.column.cases.find(c=>c.index===p.index&&c.combination==='แรงอัดต่ำ');
    near(high.P,179.1724);near(low.P,75.8394);near(high.nodeMoment,-1.55292);
    const EI=.2*4700*Math.sqrt(i.fc)*1000*i.colDepth*i.t**3/12,k=Math.sqrt(179.1724/EI);
    const expected=(i.factorH*i.Mpost+i.factorH*i.Hpost*Math.sin(k*i.hp)/k
      -1.55292*Math.cos(k*(i.hp-(i.beamClear+i.beamH/2))))/Math.cos(k*i.hp);
    near(high.baseM,expected);
    const foot=r.footing?.cases.find(c=>c.index===p.index&&c.name==='แรงอัดสูง');
    assert.ok(foot);near(foot.columnP,179.1724);
    near(foot.contact.totalV,179.1724+1.4*i.B*i.capL*i.hz*24);
  }
});

test('duck legacy direct loads retain exact forces/checks; invalid partial pairs rejected',()=>{
  const old={...getPassingExample('duckfoot').values,qBeam:2.125};
  for(const key of ['NpostD','NpostL','qBeamD','qBeamL','factorL'])delete old[key];
  const migrated=normalizeDuckLoadInput(old),r=calculateDuckfoot(old),explicit=calculateDuckfoot(migrated);
  assert.deepEqual(r,explicit);assert.equal(migrated.NpostD,old.Npost);assert.equal(migrated.NpostL,0);
  assert.equal(migrated.qBeamD,2.125);
  for(const bad of [{NpostD:10},{NpostD:100,NpostL:1},{qBeamD:2,qBeamL:''},{factorL:null}])
    assert.throws(()=>createSystemSnapshot({...old,...bad},'duckfoot'),RangeError);
});

test('NIST unit goldens: force, pressure, density, moment, stress and ton capacity',()=>{
  near(inputToDisplay('Npost',9.80665,'kgf'),1000);
  near(inputToDisplay('Mpost',9.80665,'kgf'),1000);
  near(inputToDisplay('qD',9.80665,'kgf'),1000);
  near(inputToDisplay('gc',9.80665,'kgf'),1000);
  near(inputToDisplay('fc',0.0980665,'kgf'),1);
  near(inputToDisplay('Ppile',2.875,'kgf'),2875);
  assert.equal(inputUnit('fy','kgf'),'kgf/cm²');
  for(const key of ['Npost','NpostD','NpostL','Hpost','Mpost','qD','qL','qa','gs','gc','fc','fy','Ppile','qBeam','qBeamD','qBeamL']) {
    const v=13.7548913579;
    for(let j=0;j<40;j++)near(inputFromDisplay(key,inputToDisplay(key,v,'kgf'),'kgf'),v,1e-12);
  }
  for(const mode of ['mks','kg',null,false,12])assert.throws(()=>validateInputUnitMode(mode),RangeError);
  assert.ok(Number.isNaN(inputFromDisplay('qD','','kgf')));
});

test('surcharge import invalid/inconsistent/half split rejects, q-only is entirely live',()=>{
  assert.deepEqual(normalizeSurchargeInput({q:12.345}),{q:12.345,qD:0,qL:12.345});
  for(const bad of ['',null,NaN,Infinity,-1,true,' '])
    assert.throws(()=>normalizeSurchargeInput({qD:bad,qL:4}),RangeError);
  assert.throws(()=>normalizeSurchargeInput({qD:3}),RangeError);
  assert.throws(()=>normalizeSurchargeInput({q:10,qD:3,qL:4}),RangeError);
  assert.equal(normalizeInput({...RW_DEFAULT_INPUT,q:10,qD:3,qL:4},'thai2566').value,null);
});

// Independent dry, level, vertical-wall hand case. W=64.80+51.84+204.12=320.76 kN/m.
// Earth resultant=108+20=128 kN/m, Mo=108*2+20*3=276 kN m/m.
for(const [profile,gD,gL,gH] of [['thai2566',1.4,1.7,1.7],['aci318',1.2,1.6,1.6],['wsd',1,1,1]]) {
  for(const [name,run] of [['public',publicEngine],['mirror',mirrorEngine]]) {
    test(name+' '+profile+': independent DL/LL vertical load/equilibrium and unchanged lateral/stability',()=>{
      const input={...RW_DEFAULT_INPUT,q:10,qD:3.125,qL:6.875,wallDelta:0};
      const r=run(input,{profile}),old=run({...RW_DEFAULT_INPUT,q:10,wallDelta:0},{profile});
      near(r.Ph,128,1e-6);near(r.Mo,276,.001);near(r.SVb,341.76,1e-6);
      near(r.surcharge.verticalFactored,gD*3.125+gL*6.875);
      near(r.VuB,gD*(320.76+3.125*2.1)+gL*6.875*2.1);
      near(r.wuH,gD*(111.6+3.125)+gL*6.875);
      const Vu=gD*(320.76+3.125*2.1)+gL*6.875*2.1;
      // Midpoint quadrature of the quadratic soil-moment integrand: exact error γKaH³/(12n²).
      const Mo400=276+18/3*6**3/(12*400**2);
      const xU=(gD*(694.818+3.125*2.1*2.55)+gL*6.875*2.1*2.55-gH*Mo400)/Vu;
      near(r.xbarU,xU,1e-7);
      if(xU<1.2){near(r.q1u,2*Vu/(3*xU),1e-5);near(r.q2u,0,0);}
      else {near(r.q1u-r.q2u,12*Vu*(1.8-xU)/(3.6*3.6),1e-6);}
      near(r.FSot,old.FSot);near(r.FSsl,old.FSsl);
      near(r.surcharge.lateralFactor,gH);
      const explicit=run({...RW_DEFAULT_INPUT,q:10,qD:0,qL:10,wallDelta:0},{profile});
      for(const key of ['Ph','Mo','SVb','VuB','xbarU','q1u','q2u','wuH','MH_','MT','VuH','VuT'])
        near(explicit[key],old[key],0);
      assert.equal(input.qD,3.125);assert.ok(!Object.hasOwn(RW_DEFAULT_INPUT,'qD'));
    });
  }
}

test('native snapshots preserve physical default verdict/forces when only input unit changes',()=>{
  for(const type of ['pile','pilecf','soldier','duckfoot']) {
    const i=getPassingExample(type).values;
    const si=createSystemSnapshot({...i,unitMode:'si'}),kg=createSystemSnapshot({...i,unitMode:'kgf'});
    assert.equal(si.status,'PASS');assert.equal(kg.status,'PASS');
    assert.deepEqual(si.checks,kg.checks);
    const physicalForces=s=>({...s.forces,...(s.forces.rearAnchor?{rearAnchor:{...s.forces.rearAnchor,identity:'RUN'}}:{})});
    assert.deepEqual(physicalForces(si),physicalForces(kg));
    if(type==='soldier'){assert.equal(si.forces.rearAnchor.identity,si.stamp);assert.equal(kg.forces.rearAnchor.identity,kg.stamp);}
    assert.deepEqual(si.bbs,kg.bbs);assert.deepEqual(si.geometry,kg.geometry);
    assert.ok(Object.isFrozen(kg.input));
  }
});
