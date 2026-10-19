import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {getPassingExample} from './passingExamples.mjs';
import {soldierBeamDetailing} from './soldierBeamDetailing.mjs';
import {createSystemSnapshot,normalizeRearAnchorInput} from './systemsSnapshot.mjs';
import {rbBeamSectionModel,rbBeamSectionCad,renderRbBeamSections} from './rbBeamSections.mjs';
import {nativeCadViews} from './nativeCadViews.mjs';
import {annotationLabelBoxes} from './drafting/annotationClearance.mjs';
import {drawnBoxOf} from './drafting/extentGeometry.js';
import {nativeEquationRows} from './essentialReport.mjs';
import {inputDiagram} from './inputDiagram.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const example=()=>({...getPassingExample('soldier').values,frontBeamMode:'legacy'});
const basic={width:500,depth:400,cover:50,aggregate:20,db:20,linkDb:9,nTop:6,nBot:4};

test('independent nominal single-row centroid, centers and exact inch-to-SI spacing',()=>{
 const d=soldierBeamDetailing(basic);
 near(d.inset,69);near(d.effectiveDepth,331);near(d.clearMin,80/3);
 near(d.requiredWidth,238+400/3);near(d.requiredDepth,158+80/3);
 near(d.clearTop,262/5);near(d.clearBot,302/3);near(d.clearVertical,242);
 assert.deepEqual(d.top[0],[69,331]);assert.deepEqual(d.top.at(-1),[431,331]);assert.deepEqual(d.bottom[0],[69,69]);
 near(d.link[0][0],54.5);assert.equal(d.spacingOK,true);assert.equal(d.fabricationAuthority,false);
 const inch=soldierBeamDetailing({...basic,db:12,aggregate:10});near(inch.clearMin,25.4);
 const bar=soldierBeamDetailing({...basic,db:32});near(bar.clearMin,32);
 const stone=soldierBeamDetailing({...basic,aggregate:40});near(stone.clearMin,160/3);
});

test('required width and depth are real thresholds; crowded counts are never clamped',()=>{
 const crowded=soldierBeamDetailing({...basic,nTop:20,nBot:20,db:32});
 near(crowded.requiredWidth,1366);near(crowded.dc,1366/500);assert.equal(crowded.spacingOK,false);
 assert.equal(crowded.top.length,20);assert.equal(crowded.bottom.length,20);
 assert.equal(soldierBeamDetailing({...basic,nTop:20,nBot:20,db:32,width:1366}).spacingOK,true);
 assert.equal(soldierBeamDetailing({...basic,nTop:20,nBot:20,db:32,width:1366-.001}).spacingOK,false);
 const shallow=soldierBeamDetailing({...basic,cover:100,db:32,linkDb:12,depth:200});
 assert.equal(shallow.physicalOK,false);assert.equal(shallow.spacingOK,false);assert.deepEqual(shallow.top,[]);
 const required=soldierBeamDetailing({...basic,cover:100,db:32,linkDb:12,depth:320,width:1000});
 near(required.requiredDepth,320);assert.equal(required.spacingOK,true);
 assert.equal(soldierBeamDetailing({...basic,cover:100,db:32,linkDb:12,depth:319.999,width:1000}).spacingOK,false);
});

test('old draft receives only absent cover/aggregate; malformed and explicit blank fail closed',()=>{
 const old=example();delete old.rbCover;delete old.rbAgg;
 const n=normalizeRearAnchorInput(old,'soldier');assert.equal(n.rbCover,50);assert.equal(n.rbAgg,20);assert(!Object.hasOwn(old,'rbCover'));
 for(const key of ['rbCover','rbAgg'])for(const value of ['',null,true,Infinity,-1,101])assert.throws(()=>createSystemSnapshot({...old,[key]:value}),RangeError);
 assert.throws(()=>createSystemSnapshot({...old,rbCover:24.9}),RangeError);assert.throws(()=>createSystemSnapshot({...old,rbAgg:40.01}),RangeError);
 assert.doesNotThrow(()=>createSystemSnapshot({...old,rbCover:100,rbAgg:40}));
 assert.equal(normalizeRearAnchorInput(old,'pile'),old,'no other-system migration');
});

test('actual centroid reaches existing flexure/shear; packing has independent honest D/C and actionable dimensions',()=>{
 for(const profile of ['thai2566','aci318','wsd']){
  const s=createSystemSnapshot({...example(),rb1Bw:50,rb1Bh:40,rb1Db:32,rb1Nt:20,rb1Nb:20},profile);
  const b=s.reportSoldier.capBeams[0],c=s.checks.find(c=>c.key==='RB1 · ระยะจัดเหล็กชั้นเดียว');
  near(b.dCap,.325);near(b.AsMin,1.4/390*500*325);near(c.dc,1366/500);assert.equal(c.ok,false);
  assert.match(c.fix,/กว้าง ≥ 140 ซม/);assert.equal(s.status,'FAIL');
  const fixed=createSystemSnapshot({...s.input,rb1Bw:140},profile);
  assert.equal(fixed.checks.find(row=>row.key===c.key).ok,true);assert.equal(fixed.status,'PASS');
  const stable=f=>JSON.parse(JSON.stringify(f,(key,value)=>key==='identity'?undefined:value));
  assert.deepEqual(stable(fixed.forces),stable(s.forces),'changing packing dimensions never changes analysed forces');
  const h=createSystemSnapshot({...example(),rb1Bw:50,rb1Bh:20,rb1Db:32,rb1Nt:2,rb1Nb:2,rbCover:100,rbAgg:24},profile);
  assert.equal(h.checks.find(c=>c.key==='RB1 · ระยะจัดเหล็กชั้นเดียว').ok,false);
  assert.equal(h.rebarLayout.groups.some(g=>g.mark==='RB1'),false,'no fictional cage in invalid envelope');
 }
});

test('frozen accepted centers and exact chosen counts share CAD, 3D axes, BBS and essential worked rows',()=>{
 const s=createSystemSnapshot({...example(),rb1Bw:60,rb1Bh:80,rb1Db:20,rb1Nt:6,rb1Nb:4,rb1Ldb:9,rb1Lsp:15,rbCover:60,rbAgg:25});
 const before=JSON.stringify(s),b=s.reportSoldier.capBeams[0],d=b.detailing,groups=s.rebarLayout.groups.filter(g=>g.mark==='RB1');
 assert.equal(Object.isFrozen(d.top[0]),true);assert.equal(Object.isFrozen(s.rebarLayout.groups),true);
 assert.equal(groups[0].paths.length,6);assert.equal(groups[1].paths.length,4);assert.equal(s.bbs.find(r=>r.mark==='RB1').count,10);
 for(const [j,face]of ['top','bottom'].entries())for(let k=0;k<d[face].length;k++){
  const p=groups[j].paths[k][0];near(p[0],d[face][k][0]/1000-.3);near(p[1],s.geometry.hp-.4+d[face][k][1]/1000);
 }
 const ties=s.rebarLayout.groups.find(g=>g.mark==='RB1-ties');assert.equal(ties.paths.length,s.bbs.find(r=>r.mark==='RB1s').count);
 assert.ok(ties.spacing<=b.linkSp);assert.equal(ties.schematicHooks,true);
 const model=rbBeamSectionModel(s,'RB1');assert.equal(model.entities.filter(e=>e.t==='circle').length,10);
 near(model.entities.find(e=>e.t==='dim'&&e.note==='d').b.y-model.entities.find(e=>e.t==='dim'&&e.note==='d').a.y,721);
 const overall=nativeCadViews(s).section(50);assert.equal(overall.entities.filter(e=>e.t==='circle'&&e.layer==='RW-REBAR').length,s.reportSoldier.capBeams.reduce((n,b)=>n+b.nTop+b.nBot,0));
 for(const mode of ['si','kgf']){
  const rows=nativeEquationRows(s,mode),worked=rows.find(r=>r[0]==='RB1 · ความลึกประสิทธิผล');
  assert.equal(worked[2],'800.0 − 60.0 − 9.0 − 20.0/2 mm');assert.equal(worked[3],'721.0 mm');
  assert.ok(rows.find(r=>r[0]==='RB1 · ระยะจัดเหล็ก'));assert.match(renderRbBeamSections(s,{report:true}),/บน 6 \/ ล่าง 4-DB20/);
 }
 assert.equal(JSON.stringify(s),before);
});

test('CAD paper has separate label lanes, finite uniform geometry and no clipping across actual member sizes',()=>{
 for(const width of [50,100,200])for(const depth of [20,75,150]){
  const s=createSystemSnapshot({...example(),rb1Bw:width,rb1Bh:depth,rb1Db:16,rb1Nt:6,rb1Nb:6});
  const c=rbBeamSectionCad(s,'RB1'),box=drawnBoxOf(c.drawing.entities,1),labels=annotationLabelBoxes(c.drawing.entities,1);
  assert.ok(box.min.x>=0&&box.max.x<=140&&box.min.y>=0&&box.max.y<=90,'paper bounds');
  for(let j=0;j<labels.length;j++)for(let k=j+1;k<labels.length;k++){
   const a=labels[j],b=labels[k];assert.ok(Math.min(a.max.x,b.max.x)<=Math.max(a.min.x,b.min.x)||Math.min(a.max.y,b.max.y)<=Math.max(a.min.y,b.min.y),'independent CAD labels overlap');
  }
  assert(!/NaN|Infinity|undefined/.test(JSON.stringify(c)));
 }
});

test('input guide previews only entered bar counts; Auto/blank values never pretend to be a solved cage',()=>{
 const i={...example(),rb1Nt:6,rb1Nb:4,rb1Db:20,rbCover:60,rbAgg:25};
 const guide=inputDiagram('soldier',i,'rb1Nt').svg;assert.equal((guide.match(/data-input-rb-bar="Nt"/g)||[]).length,6);assert.equal((guide.match(/data-input-rb-bar="Nb"/g)||[]).length,4);
 assert.match(guide,/c 60 · dagg 25 mm/);
 assert.equal((inputDiagram('soldier',{...i,rb1Nt:0,rb1Nb:0},'rbCover').svg.match(/data-input-rb-bar/g)||[]).length,0);
 assert.match(inputDiagram('soldier',{...i,rbCover:''},'rbCover').svg,/c —/);
});

test('RB2 absence is exact in packing checks, cages and dedicated sections; helper and Engine mirrors are byte identical',()=>{
 const s=createSystemSnapshot({...example(),soldierSys:'cant',rb2Nt:''});
 assert.equal(s.checks.some(c=>c.key.startsWith('RB2')),false);assert.equal(s.rebarLayout.groups.some(g=>g.mark.startsWith('RB2')),false);
 assert(!renderRbBeamSections(s).includes('RB2'));
 for(const [pub,src]of [['soldierBeamDetailing.mjs','soldierBeamDetailing.mjs'],['engine.mjs','retainingWallEngine.js']])
  assert.equal(readFileSync(new URL(pub,import.meta.url),'utf8'),readFileSync(new URL('../../src/features/concrete/retainingWall/'+src,import.meta.url),'utf8'));
});
