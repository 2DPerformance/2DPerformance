import test from 'node:test';import assert from 'node:assert/strict';import {hatchSegments} from './hatchGeometry.js';import {hatch} from './cadPrimitives.js';
test('paper hatching spans both ends of a translated footing, including distant and negative origins',()=>{
 for(const [x,y]of [[20,50],[1000,2000],[-1000,-2000]]){
  const e=hatch([{x,y},{x:x+80,y},{x:x+80,y:y+10},{x,y:y+10}],'CONCRETE','RW-HATCH'),{segs}=hatchSegments(e,1);
  assert.ok(segs.length>17);const xs=segs.flatMap(p=>[p[0],p[2]]);assert.ok(Math.min(...xs)<x+1&&Math.max(...xs)>x+79,'complete physical polygon');
  for(const p of segs)for(const [xx,yy]of [[p[0],p[1]],[p[2],p[3]]])assert.ok(xx>=x-1e-8&&xx<=x+80+1e-8&&yy>=y-1e-8&&yy<=y+10+1e-8);
 }
});
