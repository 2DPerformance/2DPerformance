import test from 'node:test';
import assert from 'node:assert/strict';
import {flexureStressMPa,contourColor,stressContourFor,contourParts,contourSvg,sampleContour} from './stressContour.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {computeForUi} from './workbench.mjs';
import {compactReportPages,compactGraph} from './compactReport.mjs';
import {resultUnits} from './resultUnits.mjs';
const types=['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'];
const snapshot=(type,profile='thai2566')=>['cantilever','counterfort','gravity'].includes(type)
 ?computeForUi({...getPassingExample(type).values,wtype:type},profile).snapshot:createSystemSnapshot(getPassingExample(type).values,profile);
test('independent rectangular flexure: 10kNm, b=1m,h=.2m => ±1.5MPa',()=>{
 const Ig=1*.2**3/12;assert.ok(Math.abs(flexureStressMPa(10,.1,Ig)-1.5)<1e-12);
 assert.ok(Math.abs(flexureStressMPa(-10,.1,Ig)+1.5)<1e-12);
 assert.equal(flexureStressMPa(0,.1,Ig),0);
 assert.ok(Math.abs(flexureStressMPa(10,.2,1*.4**3/12)-.375)<1e-12);
});
test('bad/absent physical properties are rejected; neutral is not zero stress',()=>{
 for(const args of [[NaN,1,1],[1,0,1],[1,1,0],[1,1,-1],[1,Infinity,1]])assert.throws(()=>flexureStressMPa(...args));
 assert.equal(contourColor(null,2),'#aebbc6');assert.notEqual(contourColor(0,2),'#aebbc6');
 assert.equal(contourColor(-2,2),contourColor(2,2));assert.equal(contourColor(0,0),'#234d91');
});
test('kgf/cm² conversion independent standard gravity',()=>{
 assert.ok(Math.abs(resultUnits('kgf').value(1.5,'MPa')-15.295743194668925)<1e-10);
});
for(const type of types)test(type+': immutable accepted forces, identity, station maxima and printed substitution',()=>{
 const s=snapshot(type),before=JSON.stringify(s),c=stressContourFor(s);
 assert.equal(c.type,type);assert.equal(c.identity,s.id||s.stamp);assert.equal(Object.isFrozen(c),true);
 assert.ok(c.max>0);assert.ok(c.fields.length>0);
 for(const f of c.fields)for(const p of f.stations){assert.ok(Math.abs(p.sigma-p.m*p.c/p.Ig/1000)<1e-11);assert.equal(Object.isFrozen(p),true);}
 assert.equal(c.max,Math.max(...c.fields.flatMap(f=>f.stations.map(p=>Math.abs(p.sigma)))));
 assert.equal(stressContourFor(s),c);
 assert.match(contourSvg(s),/ไม่ใช่ shell FEM/);assert.match(contourSvg(s,'kgf'),/kgf\/cm²/);
 for(const p of contourParts(s))if(!p.field)assert.ok(p.key.startsWith('unknown'));
 const pages=compactReportPages(s,'si',{fbdHTML:'<svg data-support="real">Freebody Diagram</svg>'});
 assert.ok(pages.length>=4&&pages.length<=6);assert.match(pages.at(-1),/SECTION SUMMARY/);
 assert.ok(pages.join('').includes(Math.abs(c.fields[0].peak.sigma).toFixed(3)));
 for(const check of s.checks.filter(c=>!c.ok))assert.ok(pages.join('').includes(check.key||check.k));
 assert.equal(JSON.stringify(s),before,'no accepted result mutated by 3D/report');
});
test('strips stay piecewise; station interpolation changes display only',()=>{
 const f={kind:'strips',stations:[{x:0,to:1,sigma:2},{x:1,to:2,sigma:6}]};assert.equal(sampleContour(f,.9),2);assert.equal(sampleContour(f,1.1),6);
 assert.equal(sampleContour({kind:'stations',stations:[{x:0,sigma:-2},{x:2,sigma:6}]},1),2);
});
test('soldier uses accepted effective model Ig; does not imply prestress or cap/rear joint checks',()=>{
 const s=snapshot('soldier'),f=stressContourFor(s).fields.find(f=>f.key==='front-pile');
 assert.ok(f.stations.every(p=>Math.abs(p.Ig-.6*.4**4/12)<1e-14));assert.match(f.label,/เทียบเท่า/);
 assert.ok(contourParts(s).some(p=>p.key==='unknown-anchor'&&!p.field));
 assert.equal(s.geometry.capBeams.length,0);
});
test('signed graph preserves critical sign and nonzero coordinate origin',()=>{
 const ordinates=[{x:2,y:4},{x:3,y:-10},{x:5,y:7}],html=compactGraph(ordinates,'BMD','kN·m');
 assert.match(html,/data-graph-peak="-10"/);assert.match(html,/data-graph-station="3"/);
 assert.match(html,/จุดคุม -10\.00 kN·m @ 3\.00 m/);assert.match(html,/min -10\.00/);assert.match(html,/max 7\.00/);
 assert.match(html,/data-critical-point="true"/);assert.doesNotMatch(html,/data-support/,'extrema are not invented supports');
 assert.match(compactGraph(ordinates,'BMD','kN·m','kgf'),/จุดคุม -1019\.72 kgf·m/);
 assert.throws(()=>compactGraph([{x:0,y:NaN}],'SFD','kN'));assert.throws(()=>compactGraph([],'SFD','kN'));
});
test('all selected steel details survive report formatting; overview does not carry rebar',()=>{
 for(const type of types){const s=snapshot(type),pages=compactReportPages(s,'si',{fbdHTML:'<svg data-support="real">Freebody Diagram</svg>'}),html=pages.join(''),rows=s.bbs||s.result.qty.bbs;
  for(const b of rows)assert.ok(html.includes(String(b.detail).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')),type+': complete '+(b.mark||b.mk)+' detail');
  assert.match(pages[0],/data-cad-overview="true"/);assert.match(pages.at(-1),/ผู้ออกแบบ/);assert.match(pages.at(-1),/SECTION SUMMARY/);
 }
});
test('paper viewport framing cannot alter contour extrema or source snapshot',()=>{
 const s=snapshot('pilecf'),before=JSON.stringify(s),c=stressContourFor(s);
 assert.match(contourSvg(s,'si',{height:420}),/viewBox="0 0 800 420"/);
 assert.match(contourSvg(s,'si',{height:420}),new RegExp('data-contour-max-mpa="'+c.max+'"'));
 assert.equal(JSON.stringify(s),before);assert.throws(()=>contourSvg(s,'si',{height:NaN}));
});
