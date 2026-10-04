import test from 'node:test';
import assert from 'node:assert/strict';
import {createSystemSnapshot} from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import {PASSING_EXAMPLES} from './passingExamples.mjs?rwv=20261003-main-equations-1';
import {DESIGN_PROFILES} from './engine.mjs?rwv=20261003-main-equations-1';
import {buildA4CadSheets,fitCadView,renderA4CadSheet} from './a4DrawingSheet.mjs?rwv=20261001-leader-layout-1';
import {nativeCadViews} from './nativeCadViews.mjs?rwv=20261003-main-equations-1';
import {dimLength,assertDrawingSound} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {inputGeometry} from './inputGeometry.mjs?rwv=20261003-main-equations-1';
import {pileDrawingRows} from './pileDrawingLayout.mjs?rwv=20261001-a4-cad-1';

const build=s=>buildA4CadSheets({info:{type:s.type,title:s.type,project:s.input.project,
  profile:DESIGN_PROFILES[s.profile].short,stamp:s.stamp,status:s.status,authority:s.authority,
  notes:['ภาพตำแหน่งออกแบบ ไม่ใช่รายการตัดดัด']},...nativeCadViews(s),rows:s.bbs});
for(const type of ['pile','pilecf','soldier','duckfoot'])for(const profile of ['thai2566','aci318','wsd']){
  test(`A4 ${type}/${profile}: every selected material and measured geometry, unchanged result`,()=>{
    const s=createSystemSnapshot(PASSING_EXAMPLES[type].values,profile),before=JSON.stringify(s);
    const sheets=build(s);
    assert.equal(JSON.stringify(s),before);
    assert.equal(sheets.filter(x=>x.meta.finalSectionSummary).length,1);
    assert.equal(sheets.at(-1).meta.viewKind,'SECTION');
    assert.deepEqual(sheets.flatMap(x=>x.meta.rows||[]),s.bbs.map(row=>({...row})), 'complete ordered BBS across sheets');
    const views=nativeCadViews(s);
    for(const source of [views.plan,views.section]){
      const placed=fitCadView(source,{x:24,y:120,w:167,h:125});
      const raw=placed.model.entities.filter(e=>e.t==='dim'),dims=placed.entities.filter(e=>e.t==='dim');
      assert.deepEqual(dims.map(dimLength),raw.map(dimLength),'scaled dimensions remain model mm');
      for(let j=0;j<dims.length;j++){
        const d=dims[j],r=raw[j];
        assert.ok(Math.abs((d.b.x-d.a.x)*placed.scale-(r.b.x-r.a.x))<1e-6);
        assert.ok(Math.abs((d.b.y-d.a.y)*placed.scale-(r.b.y-r.a.y))<1e-6);
      }
    }
    for(const sheet of sheets){
      assertDrawingSound(sheet);
      assert.ok(sheet.entities.filter(e=>e.t==='text').every(e=>e.h>=2.8));
      const svg=renderA4CadSheet(sheet);
      assert.match(svg,/width="176mm" height="266mm"/);
      assert.match(svg,/viewBox="19.5 15.5 176 266"/);
      assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
    }
    if(type==='duckfoot'){
      const section=views.section(50);
      assert.equal(section.meta.noPiles,true);
      assert.equal(section.meta.beamBottom,s.geometry.beamBottom);
      assert.equal(section.meta.beamTop,s.geometry.beamTop);
      assert.equal(views.plan(50).meta.columns,s.geometry.nPosts);
    }
    if(type==='pile'||type==='pilecf')assert.equal(views.plan(50).meta.pileCounts.reduce((a,b)=>a+b),s.quantities.piles);
  });
}

test('A4: long project text retains literal characters; long material rows remain complete',()=>{
  const s=createSystemSnapshot({...PASSING_EXAMPLES.pile.values,project:'โครงการ <ขอบเขต> & ทดสอบอาคาร นายช่างใหญ่ '.repeat(3).slice(0,100)});
  const sheets=build(s),text=sheets[0].entities.filter(e=>e.t==='text').map(e=>e.s).join(' ');
  assert.ok(text.includes('<ขอบเขต> &'));
  assert.ok(renderA4CadSheet(sheets[0]).includes('&lt;ขอบเขต&gt; &amp;'));
});
test('A4: spacing changes use accepted quantity count, never force density as pieces',()=>{
  const s=createSystemSnapshot({...PASSING_EXAMPLES.pile.values,pileSt:3.5,pileSh:2.7});
  const plan=nativeCadViews(s).plan(50);
  assert.deepEqual(plan.meta.pileCounts,[4,5]);
  assert.equal(plan.meta.pileCounts.reduce((a,b)=>a+b),s.quantities.piles);
  const draft=inputGeometry('pile',s.input);
  assert.equal(draft.parts.filter(part=>part.kind==='pile').length,s.quantities.piles,
    'entered model must show the accepted BBS quantity for non-divisible spacing');
  const sceneRows=pileDrawingRows(s.geometry,s.quantities.piles);
  assert.equal(sceneRows.flatMap(row=>row.stations).length,s.quantities.piles);
  assert.deepEqual(sceneRows.map(row=>[row.stations[0],row.stations.at(-1)]),[[0,s.geometry.Lw],[0,s.geometry.Lw]],
    'calculated model and Plan occupy the same full wall length');
  assert.throws(()=>pileDrawingRows(s.geometry,s.quantities.piles+1),/quantity ledger/,
    'a stale or mismatched accepted count must not silently create a different drawing');
});
for(const values of [{hp:.5,ipile:40},{hp:1,ipile:40},{hp:8,ipile:40},{soldierSys:'cant',hp:3,ipile:40}]){
  test('A4 soldier geometry boundary '+JSON.stringify(values),()=>{
    const s=createSystemSnapshot({...PASSING_EXAMPLES.soldier.values,...values});
    const before=JSON.stringify(s);const sheets=build(s);
    assert.equal(JSON.stringify(s),before);assert.ok(sheets.length>=2);
    assert.equal(sheets.at(-1).meta.finalSectionSummary,true);
  });
}
