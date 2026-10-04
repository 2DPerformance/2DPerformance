import test from 'node:test';
import assert from 'node:assert/strict';
import {clearSegment,clearAnnotationSegments,dimensionLinework} from './dimensionLinework.mjs';
import {dim,drawing,dimLength} from './cadPrimitives.js';
import {renderSvg} from './svgRenderer.js';
import {toDxf} from './dxfWriter.js';

test('paper rectangle clipping: independently known horizontal, vertical and diagonal gaps',()=>{
  const box={min:{x:-2,y:-2},max:{x:2,y:2}};
  assert.deepEqual(clearSegment({x:-10,y:0},{x:10,y:0},box),[
    {a:{x:-10,y:0},b:{x:-2,y:0}},{a:{x:2,y:0},b:{x:10,y:0}}]);
  assert.deepEqual(clearSegment({x:0,y:10},{x:0,y:-10},box),[
    {a:{x:0,y:10},b:{x:0,y:2}},{a:{x:0,y:-2},b:{x:0,y:-10}}]);
  assert.deepEqual(clearSegment({x:-10,y:-10},{x:10,y:10},box),[
    {a:{x:-10,y:-10},b:{x:-2,y:-2}},{a:{x:2,y:2},b:{x:10,y:10}}]);
  assert.deepEqual(clearSegment({x:0,y:0},{x:1,y:1},box),[]);
  assert.deepEqual(clearSegment({x:0,y:5},{x:5,y:5},box),[{a:{x:0,y:5},b:{x:5,y:5}}]);
});

for(const scale of [1,25,40,100,250])for(const vertical of [false,true])for(const sign of [-1,1]){
  test(`measured ${vertical?'vertical':'horizontal'} dimension ${sign} at 1:${scale}: strokes clear actual label`,()=>{
    const e={...dim({x:0,y:0},vertical?{x:0,y:1200}:{x:1200,y:0},sign*10*scale,'RW-DIM',
      {vertical,note:vertical?'H':'Toe'}),clearText:true};
    const before=JSON.stringify(e),work=dimensionLinework(e,scale);
    assert.equal(JSON.stringify(e),before);
    assert.equal(dimLength(e),1200);
    assert.equal(work.label,vertical?'1200 H':'1200 Toe');
    assert.ok(work.segments.length>=4);
    for(const segment of work.segments){
      const mid={x:(segment.a.x+segment.b.x)/2,y:(segment.a.y+segment.b.y)/2};
      assert.ok(mid.x<=work.textBox.min.x||mid.x>=work.textBox.max.x||
        mid.y<=work.textBox.min.y||mid.y>=work.textBox.max.y,'retained segment must lie outside text box');
    }
    const sheet=drawing('DIM-TEST','DIM-TEST',[e]);
    const svg=renderSvg(sheet,{scale}),dxf=toDxf(sheet,{scale});
    assert.ok(svg.includes('>'+work.label+'</text>'));
    // The DXF retains a genuine dimension with actual measurement endpoints;
    // anonymous block strokes must have the same number as the SVG strokes.
    const pairs=dxf.trimEnd().split(/\r?\n/),entities=[];
    for(let k=0;k<pairs.length;k+=2)if(pairs[k]==='0')entities.push(pairs[k+1]);
    assert.equal(entities.filter(x=>x==='DIMENSION').length,1);
    assert.equal(entities.filter(x=>x==='LINE').length,work.segments.length);
    assert.equal((svg.match(/<path /g)||[]).length,work.segments.length);
    assert.ok(dxf.includes('\n'+work.label+'\n'));
  });
}

test('raw screen dimensions use the same clear label strokes as A4 without mutating endpoints',()=>{
  const e=dim({x:0,y:0},{x:0,y:2300},-1200,'RW-DIM',{vertical:true,note:'H'});
  const plain=renderSvg(drawing('DIM-TEST','DIM-TEST',[e]),{scale:100});
  assert.doesNotMatch(plain,/M -1200\.000 2300\.000 L -1200\.000 0\.000/);
  const clear=renderSvg(drawing('DIM-TEST','DIM-TEST',[{...e,clearText:true}]),{scale:100});
  assert.equal(clear,plain);
  assert.deepEqual(e.a,{x:0,y:0});assert.deepEqual(e.b,{x:0,y:2300});assert.equal(e.clearText,undefined);
  assert.equal((clear.match(/>2300 H</g)||[]).length,1);
});

test('foreign dimension boxes break crossing leaders and extensions, preserving visible end pieces',()=>{
  const segments=[{a:{x:0,y:0},b:{x:100,y:0},kind:'leader'}];
  const boxes=[{min:{x:20,y:-2},max:{x:30,y:2}},{min:{x:60,y:-2},max:{x:70,y:2}}];
  assert.deepEqual(clearAnnotationSegments(segments,boxes),[
    {a:{x:0,y:0},b:{x:20,y:0},kind:'leader'},
    {a:{x:30,y:0},b:{x:60,y:0},kind:'leader'},
    {a:{x:70,y:0},b:{x:100,y:0},kind:'leader'}]);
  assert.deepEqual(segments,[{a:{x:0,y:0},b:{x:100,y:0},kind:'leader'}]);
});
