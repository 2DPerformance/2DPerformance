import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {getPassingExample} from './passingExamples.mjs';import {computeForUi} from './workbench.mjs';import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {inputCadView,renderInputCadView} from './inputCad.mjs';import {nativeScreenCad,renderNativeCadView} from './nativeCadScreen.mjs';
import {stressContourFor,contourParts,mountStressOverlay,contourColor} from './stressContour.mjs';import {contourSliceFractions} from './contourPlot.mjs';
import {drawnBoxOf} from './drafting/extentGeometry.js';
import {calculationCadView} from './calculationCadView.mjs';
const types=['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'];
const snapshot=(type,i)=>types.indexOf(type)<3?computeForUi({...i,wtype:type},'thai2566').snapshot:createSystemSnapshot(i,'thai2566');
for(const type of types)test(type+': draft and accepted CAD use real millimetres and uniform paper proportions',()=>{
 const i=getPassingExample(type).values,before=JSON.stringify(i),s=snapshot(type,i),source=JSON.stringify(s);
 for(const view of ['plan','section']){
  const draft=inputCadView(type,i,view,'hp')(100);assert.ok(draft.meta.noCalculatedResults);
  assert.equal(draft.entities.some(e=>e.layer==='RW-REBAR'),false);
  const svg=renderInputCadView(type,i,'hp',view);assert.match(svg,/data-cad-state="draft"/);assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
  const cad=nativeScreenCad(s,view),box=drawnBoxOf(cad.drawing.entities,1);
  assert.ok(box.min.x>=0&&box.max.x<=140&&box.min.y>=0&&box.max.y<=128);
  assert.match(renderNativeCadView(s,view),/data-cad-state="accepted"/);
  assert.ok(cad.drawing.meta.uniformScale);
 }
 assert.equal(JSON.stringify(i),before);assert.equal(JSON.stringify(s),source);
});
test('counterfort plan reserves legible paper space for the actual rib size and count',()=>{
 const s=snapshot('counterfort',getPassingExample('counterfort').values),before=JSON.stringify(s),raw=calculationCadView(s,'plan')(100);
 const rib=raw.entities.find(e=>e.t==='leader'&&e.label.startsWith('CF ·'));
 assert.equal(rib.label,`CF · ${Math.round(s.result.i.bs*1000)}×${Math.round(s.result.cfLr*1000)} · ${s.result.qty.nBut} ตัว`);
 assert.equal(rib.h,2.8);assert.equal(JSON.stringify(s),before);
 const cad=nativeScreenCad(s,'plan'),concrete=cad.drawing.entities.find(e=>e.t==='poly'&&e.layer==='RW-CONCRETE');
 const width=Math.max(...concrete.pts.map(p=>p.x))-Math.min(...concrete.pts.map(p=>p.x));
 assert.ok(width>65,'10 m plan must not shrink to an unreadable thumbnail');
});
test('GPU slices preserve an off-grid sign-zero and palette corners, including reversed station axes',()=>{
 const f={kind:'stations',stations:[{x:0,sigma:-3},{x:2,sigma:1}]};
 for(const reverse of [false,true]){const p={position:[0,1,0],size:[1,2,1],axis:'y',origin:reverse?2:0,reverse,field:f},splits=contourSliceFractions(p,3);
  assert.ok(splits.includes(reverse?.25:.75),'zero at station1.5');
  assert.ok(splits.some(x=>Math.abs(x-(reverse?.4375:.5625))<1e-12),'negative palette corner');
 }
 const p={position:[0,1,0],size:[1,2,1],axis:'y',origin:0,field:{kind:'strips',stations:[{x:0,to:.73,sigma:1},{x:.73,to:2,sigma:3}]}};
 assert.deepEqual(contourSliceFractions(p,3),[0,.365,1]);
});
for(const type of types)test(type+': real WebGL exterior geometry/colours agree with accepted gross-section stress',()=>{
 const s=snapshot(type,getPassingExample(type).values),before=JSON.stringify(s),c=stressContourFor(s),parts=contourParts(s),parent=new THREE.Group();
 const overlay=mountStressOverlay(THREE,parent,s);assert.equal(overlay.group.visible,false);
 assert.equal(overlay.group.children.length,parts.length);
 overlay.group.children.forEach((mesh,j)=>{
  const p=parts[j],pos=mesh.geometry.getAttribute('position'),colors=mesh.geometry.getAttribute('color');
  if(!p.field){const grey=new THREE.Color('#aebbc6');assert.equal(mesh.userData.contourKnown,false);assert.ok(pos.count>0);
   for(let k=0;k<colors.count;k++)assert.ok(Math.max(Math.abs(grey.r-colors.getX(k)),Math.abs(grey.g-colors.getY(k)),Math.abs(grey.b-colors.getZ(k)))<1e-6);return;
  }
  assert.ok(pos.count>0);assert.equal(pos.count,colors.count);const dim=['x','y','z'].indexOf(p.axis);
  for(let k=0;k<pos.count;k++){
   const xyz=[pos.getX(k)+mesh.position.x,pos.getY(k)+mesh.position.y,pos.getZ(k)+mesh.position.z];
   assert.ok(xyz.every(Number.isFinite));
   assert.ok(xyz[dim]>=p.position[dim]-p.size[dim]/2-1e-5&&xyz[dim]<=p.position[dim]+p.size[dim]/2+1e-5);
  }
  for(const v of p.field.stations){assert.ok(Math.abs(v.sigma-v.m*v.c/v.Ig/1000)<1e-12,'independent dimensional flexure equality');}
  if(p.field.kind==='critical'||p.field.kind==='strips'){
   const expected=p.field.stations.map(v=>new THREE.Color(contourColor(v.sigma,c.max)));
   for(let k=0;k<colors.count;k++)assert.ok(expected.some(rgb=>Math.max(Math.abs(rgb.r-colors.getX(k)),Math.abs(rgb.g-colors.getY(k)),Math.abs(rgb.b-colors.getZ(k)))<1e-6),'constant strip, never smoothed through a jump');
  }
 });
 overlay.setVisible(true);assert.equal(overlay.group.visible,true);overlay.dispose();assert.equal(parent.children.length,0);assert.equal(JSON.stringify(s),before);
});
