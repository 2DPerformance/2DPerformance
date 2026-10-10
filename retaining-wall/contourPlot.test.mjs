import test from 'node:test';
import assert from 'node:assert/strict';
import {plotSurfaces,plotPeak,renderContourPlot,surfaceGradient} from './contourPlot.mjs';
import {stressContourFor,contourParts,contourSvg,contourLegend} from './stressContour.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {computeForUi} from './workbench.mjs';
const part={key:'test',position:[0,1,0],size:[1,2,3],axis:'y',origin:0,reverse:false,field:null};
test('orthographic box draws exactly the three facing exterior surfaces, never hidden/internal caps',()=>{
 const a=plotSurfaces([part]);assert.equal(a.surfaces.length,3);
 assert.ok(a.surfaces.every(s=>s.normal.every(Number.isFinite)));
 assert.deepEqual(a.surfaces.map(s=>s.normal).sort(),[[0,0,-1],[0,1,0],[1,0,0]].sort());
 const field={kind:'stations',stations:[{x:0,sigma:0},{x:2,sigma:2}]};
 const b=plotSurfaces([{...part,field}]);
 assert.equal(b.surfaces.length,65,'32 subdivisions only on two visible side surfaces plus one exterior top');
 const horizontal=b.surfaces.filter(s=>Math.abs(s.normal[1])>.99);assert.equal(horizontal.length,1);assert.ok(horizontal[0].pts.every(p=>p[1]===2));
});
test('accepted strip boundaries remain discrete rather than displaying a fabricated stress gradient',()=>{
 const field={key:'test',kind:'strips',stations:[{x:0,to:1,sigma:1},{x:1,to:2,sigma:3}],peak:{x:1,sigma:3}};
 const c={identity:'test',fields:[field],max:3},p={...part,field};
 const html=renderContourPlot(c,[p],{height:300,sample:(f,x)=>x<1?1:3,color:v=>v===1?'#111111':'#333333'});
 assert.equal(plotSurfaces([p]).surfaces.length,5);assert.doesNotMatch(html,/linearGradient/);
 assert.match(html,/#111111/);assert.match(html,/#333333/);
});
test('scalar zero crossings include the exact colour stop; camera/paper never changes the accepted fields',()=>{
 const field={key:'test',kind:'stations',stations:[{x:0,sigma:-2},{x:2,sigma:2}],peak:{x:0,sigma:-2}};
 const c={identity:'signed-test',fields:[field],max:2},before=JSON.stringify(c);
 const html=renderContourPlot(c,[{...part,field}],{height:420,sample:(f,x)=>2*x-2,color:v=>Math.abs(v)<1e-12?'#123456':'#abcdef'});
 assert.match(html,/<stop[^>]+stop-color="#123456"/);assert.match(html,/data-contour-peak-mpa="2"/);assert.equal(JSON.stringify(c),before);
});
test('oblique wall colour is constant along each equal-station edge, not screen vertical',()=>{
 const s={part:{axis:'y',origin:0,reverse:false},qMin:0,qMax:2,pts:[[0,0,0],[0,0,3],[0,2,3],[0,2,0]]};
 const paper=v=>[v[2]*2,-v[1]+v[2]*.4],{a,b}=surfaceGradient(s,paper),g=b.map((v,k)=>v-a[k]);
 const offset=v=>paper(v).reduce((n,x,k)=>n+(x-a[k])*g[k],0)/g.reduce((n,x)=>n+x*x,0);
 assert.ok(Math.abs(offset(s.pts[0]))<1e-12);assert.ok(Math.abs(offset(s.pts[1]))<1e-12);
 assert.ok(Math.abs(offset(s.pts[2])-1)<1e-12);assert.ok(Math.abs(offset(s.pts[3])-1)<1e-12);
});
for(const type of ['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'])test(type+': exact peak, five labelled unit graduations and consistent title in both units',()=>{
 const s=['cantilever','counterfort','gravity'].includes(type)?computeForUi({...getPassingExample(type).values,wtype:type},'thai2566').snapshot:createSystemSnapshot(getPassingExample(type).values,'thai2566');
 const before=JSON.stringify(s),c=stressContourFor(s),parts=contourParts(s),peak=plotPeak(c,parts);
 assert.equal(Math.abs(peak.field.peak.sigma),c.max);assert.ok(peak.point.every(Number.isFinite));
 for(const mode of ['si','kgf']){
  const svg=contourSvg(s,mode);assert.match(svg,/Stress Contour Plot/);assert.match(svg,/orthographic-surfaces\/2/);
  assert.match(svg,new RegExp('data-contour-peak-mpa="'+c.max+'"'));
  assert.equal((svg.match(/data-contour-tick=/g)||[]).length,5);assert.match(svg,mode==='si'?/MPa/:/kgf\/cm²/);
  assert.doesNotMatch(svg,/NaN|Infinity|undefined/);assert.equal((svg.match(/data-contour-peak=/g)||[]).length,1);
  assert.ok(svg.includes('data-contour-known="false"'));assert.doesNotMatch(contourLegend(s,mode),/rw-contour-marker-key/,'interactive legend must not imply an absent marker');
 }
 assert.equal(JSON.stringify(s),before);
});
