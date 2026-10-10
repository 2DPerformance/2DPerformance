import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeScreenCad,renderNativeCadView} from './nativeCadScreen.mjs';
import {nativeCadViews} from './nativeCadViews.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {PASSING_EXAMPLES} from './passingExamples.mjs';
import {dimLength,assertDrawingSound} from './drafting/cadPrimitives.js';
import {drawnBoxOf} from './drafting/extentGeometry.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
test('screen CAD preserves every accepted A4 source coordinate and dimension across native systems/profiles',()=>{
  for(const type of ['pile','pilecf','soldier','duckfoot'])for(const profile of ['thai2566','aci318','wsd']){
    const s=createSystemSnapshot(PASSING_EXAMPLES[type].values,profile),before=JSON.stringify(s);
    for(const view of ['plan','section']){
      const cad=nativeScreenCad(s,view),raw=nativeCadViews(s)[view](cad.scale);
      assertDrawingSound(cad.drawing);
      assert.equal(cad.model.entities.length,raw.entities.length);
      raw.entities.forEach((entity,j)=>{
        const {clearText,leaderLayout,...source}=cad.model.entities[j];
        if(entity.t==='leader'){
          assert.deepEqual(source.pts[0],entity.pts[0],'fixed leader target');
          const {pts,...actual}=source,{pts:originalPoints,...expected}=entity;
          assert.deepEqual(actual,expected,'same mark/height/layer');
        }else assert.deepEqual(source,entity);
      });
      const dims=cad.drawing.entities.filter(e=>e.t==='dim');
      assert.deepEqual(dims.map(dimLength),raw.entities.filter(e=>e.t==='dim').map(dimLength));
      const physical=e=>['poly','line','circle','hatch'].includes(e.t)&&!['RW-DIM','RW-MARK'].includes(e.layer);
      const model=raw.entities.filter(physical),placed=cad.drawing.entities.slice(0,raw.entities.length).filter(physical);
      assert.equal(model.length,placed.length);
      for(let j=0;j<model.length;j++){
        const a=model[j],b=placed[j];
        if(a.pts)for(let k=1;k<a.pts.length;k++){
          near((b.pts[k].x-b.pts[0].x)*cad.scale,a.pts[k].x-a.pts[0].x);
          near((b.pts[k].y-b.pts[0].y)*cad.scale,a.pts[k].y-a.pts[0].y);
        }
      }
      const bounds=drawnBoxOf(cad.drawing.entities,1);
      assert.ok(bounds.min.x>=0&&bounds.max.x<=140&&bounds.min.y>=0&&bounds.max.y<=128);
      const svg=renderNativeCadView(s,view);assert.match(svg,/preserveAspectRatio="xMidYMid meet"/);
      assert.doesNotMatch(svg,/NaN|Infinity|undefined/);
    }
    assert.equal(JSON.stringify(s),before);
  }
});

test('piled Section retains true independent batter, width and vertical embedment',()=>{
  for(const [pileBatT,pileBatH]of [[0,0],[10,7],[12,5]]){
    const s=createSystemSnapshot({...PASSING_EXAMPLES.pile.values,pileBatT,pileBatH});
    const cad=nativeScreenCad(s),g=s.geometry;
    const piles=cad.model.entities.filter(e=>e.t==='poly'&&e.layer==='RW-CONCRETE'&&e.pc==='OUTLINE'&&e.pts.length===4);
    assert.equal(piles.length,2);
    for(const [j,angle]of [pileBatT,pileBatH].entries()){
      const pts=piles[j].pts,head={x:(pts[0].x+pts[3].x)/2,y:(pts[0].y+pts[3].y)/2},
        tip={x:(pts[1].x+pts[2].x)/2,y:(pts[1].y+pts[2].y)/2};
      near(head.y,-g.hz*1000);near(tip.y,(-g.hz-g.pileEmb)*1000);
      near(tip.x-head.x,-g.pileEmb*1000*Math.tan(angle*Math.PI/180));
      near(Math.hypot(pts[0].x-pts[3].x,pts[0].y-pts[3].y),g.pileB*1000);
    }
  }
  assert.throws(()=>createSystemSnapshot({...PASSING_EXAMPLES.pile.values,pileBatH:-7}),/0–30/);
});

test('screen CAD rejects missing/currentless result and does not fabricate duckfoot piles',()=>{
  assert.throws(()=>renderNativeCadView({type:'pile'}),/Snapshot/);
  const s=createSystemSnapshot(PASSING_EXAMPLES.duckfoot.values),c=nativeScreenCad(s);
  assert.equal(c.model.meta.noPiles,true);
  assert.equal(c.model.meta.beamBottom,s.geometry.beamBottom);
  assert.equal(c.model.meta.beamTop,s.geometry.beamTop);
});

test('paper dimension lanes fit short and tall accepted native geometry without changing dimensions',()=>{
  for(const type of ['pile','pilecf','soldier','duckfoot'])for(const hp of [1,4,8]){
    const s=createSystemSnapshot({...PASSING_EXAMPLES[type].values,hp}),before=JSON.stringify(s);
    for(const view of ['plan','section']){
      const cad=nativeScreenCad(s,view),bounds=drawnBoxOf(cad.drawing.entities,1);
      assert.ok(bounds.min.x>=0&&bounds.max.x<=140&&bounds.min.y>=0&&bounds.max.y<=128,
        `${type} H${hp} ${view}: ${JSON.stringify(bounds)}`);
      assert.deepEqual(cad.drawing.entities.filter(e=>e.t==='dim').map(dimLength),
        cad.model.entities.filter(e=>e.t==='dim').map(dimLength));
    }
    assert.equal(JSON.stringify(s),before);
  }
});
