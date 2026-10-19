import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPassingExample} from './passingExamples.mjs';
import {designRetainingWall,checksFor,flexuralDesignTrace,asReqWSD} from './engine.mjs';
import {designRetainingWall as mirrorDesign} from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {createSystemSnapshot,validateSystemInput,SOLDIER_BEAM_KEYS} from './systemsSnapshot.mjs';
import {nativeEquationRows} from './essentialReport.mjs';
import {inputGeometry} from './inputGeometry.mjs';
import {inputDiagram} from './inputDiagram.mjs';
const example=()=>({...getPassingExample('soldier').values,frontBeamMode:'legacy'});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('manual steel formerly omitted from D/C now fails for each present RB',()=>{
 for(const profile of ['thai2566','aci318','wsd'])for(const p of ['rb1','rb2','rb3']){
  const s=createSystemSnapshot({...example(),[p+'Db']:12,[p+'Nt']:2,[p+'Nb']:2},profile);
  const c=s.checks.find(c=>c.key.startsWith(p.toUpperCase()+' · ดัด'));
  // h750 - cover50 - RB9 - DB12/2 = d685 mm; b500 mm, fy390 MPa.
  near(c.dc,(1.4/390*500*685)/226.2);assert.equal(c.ok,false);assert.equal(s.status,'FAIL');
  assert.match(c.fix,/7-DB16/);assert.equal(s.reportSoldier.capBeams.find(b=>b.name===p.toUpperCase()).nBot,2);
  const fixed=createSystemSnapshot({...example(),[p+'Db']:16,[p+'Nt']:7,[p+'Nb']:7},profile);
  assert.equal(fixed.status,'PASS','the recommended steel satisfies area and packing after real calculation');
 }
});

test('rejected concrete section is not rescued by its minimum bar schedule',()=>{
 for(const profile of ['thai2566','aci318','wsd']){
  const r=designRetainingWall({...example(),qD:0,qL:100,q:100,rb1Bh:10},{profile});
  const b=r.capD.beams[0],c=checksFor(r).find(c=>c.k.startsWith('RB1 · ดัด'));
  assert.equal(b.flexure.sectionOK,false);assert.ok(Number.isNaN(b.flexure.requiredArea));
  assert.equal(b.asBotOK,false);assert.equal(b.asTopOK,false);assert.equal(c.ok,false);assert.ok(c.u>1);
  assert.match(c.fix,/ความลึกคาน ≥ \d+ ซม/);assert.match(c.fix,/เพิ่มเหล็กอย่างเดียว/);
  // Keeping a finite preliminary BBS area is not a strength pass.
  assert.ok(Number.isFinite(b.AsBotReq));
 }
});

test('WSD section limit and tolerance use an independent elastic-section calculation',()=>{
 designRetainingWall(example(),{profile:'wsd'});
 const fc=24,fs=160,b=500,d=200,n=Math.max(200000/(4700*Math.sqrt(fc)),6),k=1/(1+fs/(n*.45*fc)),j=1-k/3;
 const limit=.5*.45*fc*k*j*b*d*d/1e6;
 const t=flexuralDesignTrace(10,.5,.2,fc,390);near(t.limitMoment,limit);near(t.j,j);near(t.requiredArea,10e6/(fs*j*d));
 assert.equal(t.sectionOK,true);assert.equal(flexuralDesignTrace(limit*1.00009,.5,.2,fc,390).sectionOK,true);
 assert.equal(flexuralDesignTrace(limit*1.00011,.5,.2,fc,390).sectionOK,false);
 assert.ok(Number.isNaN(asReqWSD(limit*1.01,.5,.2,fc,390)));assert.equal(asReqWSD(0,.5,.2,fc,390),0);
});

test('SDM negative radicand stays a section failure; valid original As is exact',()=>{
 designRetainingWall(example(),{profile:'aci318'});
 const b=500,d=200,fc=24,fy=390,phi=.90,limit=.5*.85*fc*phi*b*d*d/1e6,M=10;
 const Rn=M*1e6/(phi*b*d*d),area=.85*fc/fy*(1-Math.sqrt(1-2*Rn/(.85*fc)))*b*d;
 const t=flexuralDesignTrace(M,.5,.2,fc,fy);near(t.limitMoment,limit);near(t.requiredArea,area);
 assert.equal(flexuralDesignTrace(limit,.5,.2,fc,fy).sectionOK,true);
 assert.equal(flexuralDesignTrace(limit*1.001,.5,.2,fc,fy).sectionOK,false);
});

test('RB shear uses its actual selected stirrup and insufficient spacing remains FAIL',()=>{
 const s=createSystemSnapshot({...example(),rb1Bh:20,rb1Ldb:6,rb1Lsp:30});
 const b=s.reportSoldier.capBeams[0],c=s.checks.find(c=>c.key.startsWith('RB1 · เฉือน'));
 // d = 200 - 50 - 6 - 16/2 = 136 mm.
 near(b.phiVn,b.pVc+.85*(2*28.3)*390*136/300/1000);
 near(c.dc,b.VuCap/b.phiVn);assert.equal(c.ok,false);assert.match(c.fix,/ระยะ ≤ \d+ มม/);
 assert.match(s.bbs.find(b=>b.mark==='RB1s').detail,/@300/);
});

test('old inputs get only missing Auto fields; malformed/manual/catalogue fields fail closed',()=>{
 const original=example(),before=JSON.stringify(original),s=createSystemSnapshot(original);
 assert.equal(JSON.stringify(original),before);for(const key of SOLDIER_BEAM_KEYS)assert.equal(s.input[key],0);
 for(const key of SOLDIER_BEAM_KEYS)for(const value of ['',null,true,Infinity,-1])assert.throws(()=>createSystemSnapshot({...original,[key]:value}),RangeError,key);
 for(const patch of [{rb1Nt:1},{rb1Nb:2.2},{rb1Db:14},{rb1Ldb:8},{rb1Lsp:4},{rb1Bw:49},{rb1Bh:19}])assert.throws(()=>validateSystemInput({...original,...patch},'soldier'),RangeError);
});

test('absent RB2 has no geometry/BBS/registered check; both remaining beams are checked',()=>{
 for(const profile of ['thai2566','aci318','wsd']){
  const s=createSystemSnapshot({...example(),soldierSys:'cant'},profile);
  assert.deepEqual(s.geometry.capBeams.map(b=>b.mark),['RB1','RB3']);
  assert.equal(s.bbs.some(b=>b.mark==='RB2'),false);assert.equal(s.checks.some(c=>c.key.startsWith('RB2')),false);
  assert.equal(s.checks.filter(c=>/^RB[13] ·/.test(c.key)).length,6);
  const inactive={...example(),soldierSys:'cant',rb2Bh:''};
  assert.doesNotThrow(()=>createSystemSnapshot(inactive,profile));
  assert.throws(()=>createSystemSnapshot({...inactive,soldierSys:'stay'},profile),RangeError,'restoring RB2 revalidates its own retained input');
 }
});

test('entered beam geometry and selected bars share draft/accepted CAD inputs and A4',()=>{
 const i={...example(),rb1Bw:60,rb1Bh:80,rb1Db:20,rb1Nt:6,rb1Nb:6,rb1Ldb:9,rb1Lsp:15};
 for(const profile of ['thai2566','aci318','wsd']){
  const s=createSystemSnapshot(i,profile),before=JSON.stringify(s),b=s.reportSoldier.capBeams[0],g=inputGeometry('soldier',i);
  near(g.g.capBeams[0].width,s.geometry.capBeams[0].width);near(g.g.capBeams[0].depth,.8);
  assert.match(inputDiagram('soldier',i,'rb1Bh').svg,/RB1.*รูปตัดคานรัด/s);
  for(const mode of ['si','kgf']){
   const rows=nativeEquationRows(s,mode),selected=rows.find(r=>r[0]==='RB1 · เหล็กบน/ล่าง');
   assert.match(selected[2],/b 600.0 · d 731.0/);assert.match(selected[3],/บน 6-DB20.*ล่าง 6-DB20/);
   assert.ok(rows.some(r=>r[0]==='RB1 · ขีดจำกัดหน้าตัด'));assert(!/NaN|undefined|Infinity/.test(JSON.stringify(rows)));
   if(profile==='wsd')assert.match(rows.find(r=>r[0]==='RB1 · ขีดจำกัดหน้าตัด')[2],/fs 160.000 MPa.*j/);
  }
  assert.equal(JSON.stringify(s),before);assert.equal(b.linkBar,'RB9@150');
 }
});

test('public/source mirror and independent existing forces stay identical for all profiles',()=>{
 for(const profile of ['thai2566','aci318','wsd']){
  const i={...example(),rb1Nt:2,rb1Nb:2,rb1Db:12};
  assert.deepEqual(JSON.parse(JSON.stringify(designRetainingWall(i,{profile}))),JSON.parse(JSON.stringify(mirrorDesign(i,{profile}))));
  const original=designRetainingWall(example(),{profile}),edited=designRetainingWall(i,{profile});
  for(const key of ['Tpile','Mcap','Vpile','D','Marr','Varr','frame'])assert.deepEqual(edited[key],original[key],key);
  const {capBeam:oldCap,...oldStay}=original.stay,{capBeam:newCap,...newStay}=edited.stay;
  assert.deepEqual(newStay,oldStay,'all actual stay forces/geometry/steel remain exact');
  assert.notEqual(oldCap.nBot,newCap.nBot,'edited RB bars are the intentional dependency');
 }
});
