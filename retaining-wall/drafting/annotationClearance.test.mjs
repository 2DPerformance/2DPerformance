import test from 'node:test';
import assert from 'node:assert/strict';
import {drawing,dim,line,text,leader,levelMark,sectionMark} from './cadPrimitives.js';
import {withAnnotationClearance,annotationLabelBoxes} from './annotationClearance.mjs';
import {dimensionLinework,clearAnnotationSegments} from './dimensionLinework.mjs';
import {renderSvg} from './svgRenderer.js';
import {toDxf} from './dxfWriter.js';

const freeze=o=>{Object.freeze(o);for(const v of Object.values(o))if(v&&typeof v==='object'&&!Object.isFrozen(v))freeze(v);return o;};
for(const scale of [1,25,50,100,250])test('screen/A3 clearance at 1:'+scale+' preserves structure, dimensions and source',()=>{
  const e=dim({x:0,y:0},{x:6000,y:0},-800,'RW-DIM',{note:'B'});
  const physical=line({x:0,y:0},{x:6000,y:0},'OUTLINE','RW-CONCRETE');
  const input=freeze(drawing('TEST','Measured section',[physical,e,
    text({x:2500,y:-800},'⑧ DB16 @150',3.5,'RW-TEXT',{align:'MC'}),
    leader([{x:3000,y:0},{x:8000,y:-4000}],'คงหัวเส้นชี้เดิม',3.5,'RW-TEXT'),
    levelMark({x:0,y:0},0,'RW-DIM',{extendTo:-1000}),
    sectionMark({x:0,y:500},{x:6000,y:500},'A','RW-MARK')]));
  const before=JSON.stringify(input),clear=withAnnotationClearance(input,scale);
  assert.strictEqual(clear.entities[0],physical);
  assert.deepEqual(clear.entities[1].a,e.a);assert.deepEqual(clear.entities[1].b,e.b);
  assert.equal(clear.entities[1].off,e.off);
  assert.deepEqual(clear.entities[3].pts,input.entities[3].pts);
  const labels=annotationLabelBoxes(clear.entities,scale);
  const d=dimensionLinework(clear.entities[1],scale);
  assert.ok(d.segments.length>0);
  assert.deepEqual(clearAnnotationSegments(d.segments,labels),d.segments);
  const svg=renderSvg(input,{scale}),dxf=toDxf(input,{scale});
  assert.ok(svg.includes('⑧ DB16 @150'));assert.ok(dxf.includes('DIMENSION'));
  const dimension=dxf.slice(dxf.indexOf('\nDIMENSION\n')).split('\n0\n')[0];
  assert.ok(dimension.includes('\n13\n0.0000\n23\n0.0000\n'));
  assert.ok(dimension.includes('\n14\n6000.0000\n24\n0.0000\n'));
  assert.ok(dimension.includes('\n1\n6000 B\n'));
  assert.equal(JSON.stringify(input),before);
  assert.equal(renderSvg(input,{scale}),svg);assert.equal(toDxf(input,{scale}),dxf);
});

test('clearance is recomputed in paper coordinates after uniform placement',()=>{
  const raw=drawing('TEST','Label',[text({x:1000,y:2000},'1234',2.5,'RW-TEXT',{align:'MC'})]);
  const a=annotationLabelBoxes(raw.entities,100)[0];
  const b=annotationLabelBoxes([{...raw.entities[0],p:{x:10,y:20}}],1)[0];
  for(const side of ['min','max'])for(const axis of ['x','y'])assert.ok(Math.abs(a[side][axis]/100-b[side][axis])<1e-10);
});
