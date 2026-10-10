import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutLeaders} from './leaderLayout.mjs';
import {drawing,leader,line} from './cadPrimitives.js';
import {nativeCadViews} from '../nativeCadViews.mjs';
import {nativeScreenCad} from '../nativeCadScreen.mjs';
import {createSystemSnapshot} from '../systemsSnapshot.mjs';
import {computeForUi} from '../workbench.mjs';
import {PASSING_EXAMPLES} from '../passingExamples.mjs';
import {withAnnotationClearance} from './annotationClearance.mjs';
import {clearAnnotationSegments} from './dimensionLinework.mjs';

// Independent segment intersection oracle, including collinear overlaps.
function meets(a,b,c,d){
  const cross=(u,v)=>u.x*v.y-u.y*v.x,sub=(u,v)=>({x:u.x-v.x,y:u.y-v.y});
  const r=sub(b,a),s=sub(d,c),den=cross(r,s),q=sub(c,a),eps=1e-7;
  if(Math.hypot(r.x,r.y)<eps||Math.hypot(s.x,s.y)<eps)return false;
  if(Math.abs(den)<eps){
    if(Math.abs(cross(q,r))>eps)return false;
    const axis=Math.abs(r.x)>Math.abs(r.y)?'x':'y';
    return Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))
      -Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]))>eps;
  }
  const t=cross(q,s)/den,u=cross(q,r)/den;
  return t>eps&&t<1-eps&&u>eps&&u<1-eps;
}
function assertClear(dwg,scale){
  const clear=withAnnotationClearance(dwg,scale),leaders=clear.entities.filter(e=>e.t==='leader');
  const segments=e=>clearAnnotationSegments(e.pts.slice(1).map((b,k)=>({a:e.pts[k],b})),e.annotationClearance);
  for(let i=0;i<leaders.length;i++)for(let j=i+1;j<leaders.length;j++)
    for(const a of segments(leaders[i]))for(const b of segments(leaders[j]))
      assert.ok(!meets(a.a,a.b,b.a,b.b),`${dwg.id}: ${leaders[i].label} crosses ${leaders[j].label}`);
}
test('dense crossed/tied leaders keep targets and use ordered lanes at every scale',()=>{
  for(const scale of [1,25,50,100,250])for(const side of [-1,1]){
    const P=(x,y)=>({x:x*scale,y:y*scale});
    const geometry=line(P(0,0),P(6,60),'OUTLINE','RW-CONCRETE');
    const heads=[[0,10],[6,10],[2,10],[5,9.99],[0,9],[6,8],[3,6],[0,0]];
    const input=drawing('DENSE','Dense callouts',[geometry,...heads.map(([x,y],j)=>
      leader([P(side*x,y),P(side*25,40-j*4)],'R'+j,2.8,'RW-TEXT'))]);
    const before=JSON.stringify(input),routed=layoutLeaders(input,scale);
    assert.strictEqual(routed.entities[0],geometry);
    routed.entities.slice(1).forEach((e,j)=>{
      assert.deepEqual(e.pts[0],input.entities[j+1].pts[0]);assert.equal(e.label,'R'+j);assert.equal(e.h,2.8);
      assert.ok(e.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
    });
    assertClear(routed,scale);assert.equal(JSON.stringify(input),before);
    assert.deepEqual(layoutLeaders(input,scale),routed);assert.strictEqual(layoutLeaders(routed,scale),routed);
  }
});
test('single callouts and drawings without leaders retain their existing layout',()=>{
  const input=drawing('ONE','One',[leader([{x:0,y:0},{x:100,y:50}],'mark',3.5,'RW-TEXT')]);
  assert.deepEqual(layoutLeaders(input,50).entities[0].pts,input.entities[0].pts);
  const none=drawing('NONE','None',[line({x:0,y:0},{x:10,y:5},'OUTLINE','RW-CONCRETE')]);
  assert.strictEqual(layoutLeaders(none),none);
});
test('native profiles and short/tall screen views have no leader intersections; geometry and accepted result unchanged',()=>{
  for(const type of ['pile','pilecf','soldier','duckfoot'])for(const profile of ['thai2566','aci318','wsd'])
    for(const hp of (type==='duckfoot'?[1,4,8]:[.5,1,4,8])){
      const s=createSystemSnapshot({...PASSING_EXAMPLES[type].values,hp},profile),before=JSON.stringify(s);
      for(const [view,fn]of Object.entries(nativeCadViews(s))){
        const raw=fn(50),routed=layoutLeaders(raw,50);
        raw.entities.forEach((e,j)=>{
          if(e.t==='leader'){assert.deepEqual(routed.entities[j].pts[0],e.pts[0]);assert.equal(routed.entities[j].label,e.label);}
          else assert.strictEqual(routed.entities[j],e);
        });
        assertClear(routed,50);assertClear(nativeScreenCad(s,view).drawing,1);
      }
      assert.equal(JSON.stringify(s),before);
    }
});
test('all legacy raw details and composed A4/A3 views avoid leader crossing',()=>{
  for(const type of ['cantilever','counterfort','gravity']){
    const {snapshot:s,errors}=computeForUi({...PASSING_EXAMPLES[type].values,wtype:type},'thai2566');
    assert.equal(s?.ok,true,JSON.stringify(errors));const before=JSON.stringify(s);
    for(const v of s.views)assertClear(v.drawing,v.scale);
    for(const sheet of [...s.sheets,...s.report])assertClear(sheet,1);
    assert.equal(JSON.stringify(s),before);
  }
});
