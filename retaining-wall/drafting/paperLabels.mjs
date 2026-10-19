/** Paper-only label lanes. Measured endpoints and physical geometry remain fixed. */
import {annotationLabelBoxes} from './annotationClearance.mjs?rwv=20261001-leader-layout-1';
import {drawnBoxOf} from './extentGeometry.js?rwv=20261001-leader-layout-1';
export function separatePaperLabels(source,viewport={x:3,y:12,w:134,h:104}) {
  const entities=[...source];
  const overlaps=(a,b)=>Math.min(a.max.x,b.max.x)>Math.max(a.min.x,b.min.x)
    &&Math.min(a.max.y,b.max.y)>Math.max(a.min.y,b.min.y);
  const fits=e=>{
    const b=drawnBoxOf([e],1);
    return b.min.x>=viewport.x&&b.max.x<=viewport.x+viewport.w&&b.min.y>=viewport.y&&b.max.y<=viewport.y+viewport.h;
  };
  for(let pass=0;pass<4;pass++){
    let changed=false;
    for(const kind of ['text','dim'])for(let j=0;j<entities.length;j++){
      const e=entities[j];if(e.t!==kind)continue;
      const rest=entities.filter((_,k)=>k!==j);
      // A datum includes its triangle and short extension as well as its text.
      // Keeping the full symbol clear prevents it crossing a long vertical label.
      const others=[...annotationLabelBoxes(rest,1),...rest.filter(c=>c.t==='level').map(c=>{
        const b=drawnBoxOf([c],1);
        return {min:{x:b.min.x-.7,y:b.min.y-.7},max:{x:b.max.x+.7,y:b.max.y+.7}};
      })];
      const clear=c=>annotationLabelBoxes([c],1).every(a=>others.every(b=>!overlaps(a,b)));
      if(clear(e))continue;
      const candidates=e.t==='dim'?[4,8,12,16,-4,-8].map(d=>({...e,off:e.off+d*(Math.sign(e.off)||1)}))
        :[[0,-4],[0,4],[0,-8],[0,8],[4,0],[-4,0],[8,0],[-8,0]].map(([x,y])=>({...e,p:{x:e.p.x+x,y:e.p.y+y}}));
      const candidate=candidates.find(c=>fits(c)&&clear(c));
      if(candidate){entities[j]=candidate;changed=true;}
    }
    if(!changed)break;
  }
  return entities;
}
