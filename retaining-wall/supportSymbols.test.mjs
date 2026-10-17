import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPassingExample} from './passingExamples.mjs';
import {computeForUi} from './workbench.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {supportModelFor,supportModelSvg,supportSymbolSvg} from './supportSymbols.mjs';
import {compactReportPages} from './compactReport.mjs';
const systems=['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'];
for(const type of systems)test(type+' supports follow the accepted analytical model without mutation',()=>{
  const e=getPassingExample(type),s=e.family==='legacy'?computeForUi({...e.values,wtype:type},'thai2566').snapshot:createSystemSnapshot(e.values,'thai2566');
  const before=JSON.stringify(s),m=supportModelFor(s),svg=supportModelSvg(s);
  assert.equal(m.type,type);assert.equal(JSON.stringify(s),before);assert.match(svg,new RegExp('data-support-model="'+type+'"'));
  if(type==='gravity'){assert.equal(m.kind,'contact');assert.doesNotMatch(svg,/data-support-symbol="fixed"/);}
  if(type==='duckfoot'){assert.equal((svg.match(/data-support-symbol="roller"/g)||[]).length,3);assert.match(svg,/v = 0, θ/);assert.doesNotMatch(svg,/data-support-symbol="pin"/);}
  if(['counterfort','pilecf'].includes(type)){assert.equal((svg.match(/data-support-symbol="roller"/g)||[]).length,2);assert.equal((svg.match(/data-support-action="end-moment"/g)||[]).length,2);assert.doesNotMatch(svg,/data-support-symbol="fixed"/);assert.match(svg,/รูปแถบแยก/);}
  if(['cantilever','pile'].includes(type))assert.equal((svg.match(/data-support-symbol="fixed"/g)||[]).length,1);
  if(e.family==='legacy')assert.match(compactReportPages(s)[0],/data-support-model/);
});
for(const tie of ['cant','stay','anchor'])test('soldier '+tie+' never invents a fixed pile tip',()=>{
  const s={type:'soldier',geometry:{staySystem:tie}},svg=supportModelSvg(s);
  assert.doesNotMatch(svg,/data-support-symbol="fixed"/);assert.equal((svg.match(/data-support-symbol="spring"/g)||[]).length,3);
  assert.equal((svg.match(/data-support-symbol="pin"/g)||[]).length,tie==='anchor'?1:0);
  assert.equal((svg.match(/data-support-symbol="hinge"/g)||[]).length,tie==='stay'?1:0);
});
test('unknown constraints are rejected rather than guessed',()=>{
  assert.throws(()=>supportModelFor({type:'unknown'}));assert.throws(()=>supportSymbolSvg('unknown',0,0));
  assert.match(supportSymbolSvg('pin',0,0,{id:'<bad>'}),/&lt;bad&gt;/);
});
