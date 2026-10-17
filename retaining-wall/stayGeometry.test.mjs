import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {soldierStayGeometry,designRetainingWall,checksFor} from './engine.mjs?rwv=20261003-main-equations-1';
import {SYSTEM_DEFAULTS,createSystemSnapshot,validateSystemInput} from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import {inputDiagram,soldierDrawing} from './inputDiagram.mjs?rwv=20261003-main-equations-1';
import {stayBeamTransform} from './systems3d.mjs?rwv=20261003-main-equations-1';
import * as THREE from 'three';
import {inputGeometry} from './inputGeometry.mjs';
import {contourParts} from './stressContour.mjs';
import {mainEquationSections} from './essentialReport.mjs';
import {nativeCadViews} from './nativeCadViews.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const input={...SYSTEM_DEFAULTS,wtype:'soldier',hp:4,Lw:7.1,pileS:1.2,stayLvl:1,stayLb:4,capLvl:2.5,ancLe:6};

test('V coordinates end at the wall, pair rear supports and cover odd final pile',()=>{
  for(const length of [1,4.8,7.1,12]){
    const g=soldierStayGeometry({H:4,D:3,Lw:length,S:1.2,a:1,Lb:4,capLvl:2.5,ancLe:6});
    close(g.fronts[0].z,-length/2);close(g.fronts.at(-1).z,length/2);
    assert.equal(g.members.length,g.fronts.length);assert.equal(g.anchors.length,Math.ceil(g.fronts.length/2));
    for(let j=1;j<g.fronts.length;j++)assert.ok(g.fronts[j].z-g.fronts[j-1].z<=1.2+1e-8);
    for(const ap of g.anchors){close(ap.head.y,1.5);close(ap.tip.y,-4.5);
      const ms=g.members.filter(m=>m.anchorIndex===ap.id);close(ms.reduce((s,m)=>s+m.rear.z-m.front.z,0),0);}
  }
});
test('spatial stay force resolves to the original horizontal force and rear components',()=>{
  const g=soldierStayGeometry({H:4,D:3,Lw:4.8,S:1.2,a:1,Lb:4,capLvl:2.5,ancLe:6});
  // Independent right-triangle oracle: dx=4, dy=-1.5, dz=0.6; Rh=80 kN.
  const length=Math.sqrt(16+2.25+.36),N=80*length/4;
  close(g.members[0].length,length);close(N*g.members[0].direction[0],80);
  close(-N*g.members[0].direction[1],30);
  const r=designRetainingWall(input,{profile:'thai2566'}),st=r.stay;
  close(st.stayAxial,st.T*length/4);close(st.horizontalPerAnchor,2*st.T);
  close(st.upliftPerAnchor,2*st.T*1.5/4);close(st.anchorPile.Tdemand,st.upliftPerAnchor);
  assert.notEqual(st.anchorPile.Tdemand,st.horizontalPerAnchor);
});
test('symmetric V projection conserves axial strain energy',()=>{
  const dx=4,dy=-1.5,dz=.6,plane=Math.hypot(dx,dy),L=Math.hypot(dx,dy,dz),EA=3e6,ux=.004,uy=.002;
  const stretch3=(dx*ux+dy*uy)/L,energy3=2*.5*EA/L*stretch3**2;
  const stretch2=(dx*ux+dy*uy)/plane,EA2=2*EA*(plane/L)**3;
  close(energy3,.5*EA2/plane*stretch2**2);
});
test('3D rotated beam endpoints land on both real connection nodes',()=>{
  const g=soldierStayGeometry({H:4,D:3,Lw:7.1,S:1.2,a:1,Lb:4,capLvl:2.5,ancLe:6});
  for(const m of g.members){
    const {position,quaternion}=stayBeamTransform(THREE,m);
    for(const [sign,node] of [[-1,m.front],[1,m.rear]]){
      const end=new THREE.Vector3(sign*m.length/2,0,0).applyQuaternion(quaternion).add(position);
      close(end.x,node.x);close(end.y,node.y);close(end.z,node.z);
    }
    close(quaternion.length(),1);
  }
});
test('frame tie, rear pile, design geometry and BBS use identical dimensions',()=>{
  const r=designRetainingWall(input,{profile:'thai2566'}),f=r.frame,l=r.stay.layout;
  close(f.nodes[f.tieNode].y,3);close(f.nodes[f.capNode].y,1.5);
  close(f.nodes[f.bI.at(-1)].y,-4.5);
  assert.equal(f.pairCount,2);assert.ok(f.dMaxMM>0&&Number.isFinite(f.dMaxMM));
  const plane=Math.hypot(4,1.5),projection=plane/l.maxLength;
  close(f.upliftN,Math.max(f.stayN*2*projection*1.5/plane,0));
  close(f.horizontalN,f.stayN*2*projection*4/plane);
  assert.equal(r.nPile,l.fronts.length);assert.equal(r.qty.bbs.find(b=>b.mk==='AP').n,l.anchors.length);
  const compression=checksFor({...r,frame:{...f,stayN:-1}}).find(c=>c.k==='STAY · ทิศแรงดึง');
  assert.equal(compression.ok,false);
});
test('native input limits reject inverted stays and unsupported rear pile size',()=>{
  for(const capLvl of [.5,1,4])assert.throws(()=>validateSystemInput({...input,capLvl},'soldier'),/hcap/);
  assert.throws(()=>validateSystemInput({...input,ancPileSec:33},'soldier'),/I-pile/);
  const s=createSystemSnapshot(input);assert.equal(s.geometry.stayLayout.members.length,s.quantities.piles);
  assert.equal(s.geometry.capBeams.length,0,'new project does not invent three longitudinal beams');
  assert.equal(createSystemSnapshot({...input,frontBeamMode:'legacy'}).geometry.capBeams.length,3);
  assert.throws(()=>validateSystemInput({...input,hp:.5,stayLvl:.31,capLvl:.4},'soldier'),/ระดับจุดยึดรั้ง/);
  close(createSystemSnapshot({...input,hp:.5,stayLvl:.2,capLvl:.4}).geometry.hp,.5);
});
test('ground anchor follows its actual head and has no V or rear pile',()=>{
  const r=designRetainingWall({...input,soldierSys:'anchor',stayAng:20,gaFreeLength:6,gaBondLength:4,gaBondDia:150,gaBondStress:150,gaTendonCapacity:500,gaTendonSpec:'test',gaGroutSpec:'test',gaProtectionSpec:'test'},{profile:'thai2566'});
  assert.equal(r.stay.layout,null);assert.equal(r.frame.bI.length,0);
  const a=r.frame.nodes[r.frame.tieNode],b=r.frame.nodes[r.frame.bondNode];close((a.y-b.y)/(b.x-a.x),Math.tan(20*Math.PI/180));
});
test('guide updates values, highlights dimensions and never resolves Auto',()=>{
  const d=inputDiagram('soldier',{...input,stayLb:0,pileEmbS:0},'stayLvl');
  assert.match(d.svg,/data-dimension="stayLvl" data-active="true"/);assert.match(d.svg,/Lb Auto/);assert.match(d.svg,/D Auto/);
  assert.match(inputDiagram('soldier',{...input,stayLb:5},'stayLb').svg,/Lb 5 m/);
  const blank=inputDiagram('soldier',{...input,hp:NaN,stayLb:NaN},'hp').svg;
  assert.match(blank,/H — m/);assert.doesNotMatch(blank,/H Auto|Lb Auto/);
  assert.equal(inputDiagram('soldier',input,'pileS').view,'plan');
  const g=createSystemSnapshot(input).geometry;
  assert.doesNotMatch(soldierDrawing(g,'section'),/NaN|undefined|Auto/);
  for(const type of ['cantilever','counterfort','gravity','pile','pilecf','duckfoot']){
    const draft={...SYSTEM_DEFAULTS,hp:3.5,toe:.8,t:.3,heel:1.9,B:3,Lw:10,capL:1.2,postSpacing:2.5,nPosts:4};
    assert.match(inputDiagram(type,draft,'hp').svg,/H 3.5 m/);
    assert.match(inputDiagram(type,draft,'hp').svg,/data-dimension="hp" data-active="true"/);
    assert.doesNotMatch(inputDiagram(type,draft,'Lw').svg,/NaN|undefined/);
  }
});
test('public and application engines remain byte-identical',()=>{
  assert.equal(readFileSync(new URL('./engine.mjs?rwv=20261003-main-equations-1',import.meta.url),'utf8'),readFileSync(new URL('../../src/features/concrete/retainingWall/retainingWallEngine.js',import.meta.url),'utf8'));
});

test('alternate layout braces real even-index piles and preserves short last bays',()=>{
  for(const Lw of [1,4.8,7.1,12]){
    const g=soldierStayGeometry({H:4,D:3,Lw,S:1.2,a:1,Lb:4,bw:.4,bh:.6,stayPattern:'alternate'});
    assert.deepEqual(g.members.map(m=>m.frontIndex),g.fronts.map((_,k)=>k).filter(k=>k%2===0));
    assert.equal(g.anchors.length,Math.ceil(g.members.length/2));
    for(const m of g.members){assert.equal(m.front,g.fronts[m.frontIndex]);close(m.width,.4);close(m.depth,.6);}
    close(g.fronts.at(-1).z,Lw/2);
  }
});

test('alternate Auto D and skipped-pile checks use the existing unbraced solver',()=>{
  const i={...input,stayPattern:'alternate'},r=designRetainingWall(i),u=r.alternate.unbraced;
  const cant=designRetainingWall({...i,soldierSys:'cant',frontBeamMode:'none',pileEmbS:r.D});
  close(r.D,Math.max(r.Dreq,u.Dreq));close(r.D,u.D);
  assert.equal(r.embedAuto,true);assert.equal(u.embedAuto,true);
  assert.deepEqual(u.disp.Mprof,cant.disp.Mprof);assert.deepEqual(u.disp.Vprof,cant.disp.Vprof);
  close(u.Mpile,cant.Mpile);close(u.Vpile,cant.Vpile);
  const unbraced=checksFor(r).filter(c=>c.k.startsWith('เข็มเว้นสเตย์'));
  assert.equal(unbraced.length,6);
  assert.equal(unbraced.find(c=>c.k.endsWith('PILE MOMENT')).ok,cant.checks.Mok);
  assert.equal(r.qty.bbs.find(b=>b.mk==='AP').n,r.stay.layout.anchors.length);
  assert.equal(r.qty.bbs.find(b=>b.mk==='B1').n,r.stay.nBr*r.stay.layout.members.length);
});

test('manual short embedment remains a real FAIL in the skipped group',()=>{
  const s=createSystemSnapshot({...input,stayPattern:'alternate',pileEmbS:1});
  assert.equal(s.status,'FAIL');
  assert.equal(s.checks.find(c=>c.key==='เข็มเว้นสเตย์ · EMBEDMENT D').ok,false);
  close(s.geometry.embed,1);assert.equal(s.input.pileEmbS,1);
  assert.ok(s.forces.unbracedPile.Mu>s.forces.pile.Mu);
});

test('old files default all; explicit invalid patterns are rejected',()=>{
  const old={...input};delete old.stayPattern;
  const a=createSystemSnapshot(old),b=createSystemSnapshot({...input,stayPattern:'all'});
  assert.equal(a.input.stayPattern,'all');assert.deepEqual(a.forces.pile,b.forces.pile);assert.deepEqual(a.forces.lagging,b.forces.lagging);
  for(const stayPattern of ['',null,NaN,'every3',true])assert.throws(()=>validateSystemInput({...input,stayPattern},'soldier'),/รูปแบบสเตย์/);
  for(const frontBeamMode of ['waler','legacy']){
    const i={...input,stayPattern:'alternate',frontBeamMode};
    assert.throws(()=>createSystemSnapshot(i),/การถ่ายแรงระหว่างเข็ม/);
    assert.throws(()=>designRetainingWall(i),/การถ่ายแรงระหว่างเข็ม/);
  }
});

test('both support cases share 3D/CAD/stress fields and equation traces in every profile',()=>{
  for(const profile of ['thai2566','aci318','wsd']){
    const i={...input,stayPattern:'alternate',stayBw:40,stayBh:60},s=createSystemSnapshot(i,profile),g=s.geometry;
    const draft=inputGeometry('soldier',s.input);
    assert.deepEqual(draft.g.stayLayout.members.map(m=>m.frontIndex),g.stayLayout.members.map(m=>m.frontIndex));
    const fields=new Map(s.stressContour.fields.map(f=>[f.key,f]));
    assert.equal(fields.get('unbraced-pile').stations.length,s.forces.unbracedPile.diagram.m.length);
    const parts=contourParts(s),skipped=s.forces.unbracedPile.indices;
    assert.equal(parts.filter(p=>p.key==='unbraced-pile').length,skipped.length*3);
    assert.ok(parts.filter(p=>p.key==='unbraced-pile').every(p=>p.field===fields.get('unbraced-pile')));
    const plan=nativeCadViews(s).plan(100);
    assert.equal(plan.meta.frontCount,g.stayLayout.fronts.length);assert.equal(plan.meta.anchorCount,g.stayLayout.anchors.length);
    assert.match(JSON.stringify(plan),/เสาเว้นเสา/);
    assert.equal(mainEquationSections(s).find(x=>x.key==='alternate-pile').rows.length,4);
    close(g.stayB,.4);close(g.stayH,.6);
  }
});
