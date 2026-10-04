import {text} from './cadPrimitives.js?rwv=20260930-load-units-1';
import {TEXT_HEIGHT,paperToModel} from './draftingStandard.js?rwv=20260930-load-units-1';
import {drawnBoxOf} from './extentGeometry.js?rwv=20261001-leader-layout-1';
import {dimensionLinework} from './dimensionLinework.mjs?rwv=20261001-leader-layout-1';
import {layoutLeaders} from './leaderLayout.mjs?rwv=20261001-leader-layout-1';

// Keep measured geometry immutable. Fit complete dimension labels before
// placing views; calculate clearance again in their final coordinate space.
export function clearDimensionText(dwg){
  return {...dwg,entities:dwg.entities.map(e=>e.t==='dim'?{...e,clearText:true}:e)};
}

export function prepareCadAnnotations(dwg,scale=1){
  return clearDimensionText(layoutLeaders(dwg,scale));
}

export function annotationLabelBoxes(entities,scale=1){
  const P=mm=>paperToModel(mm,scale);
  const expanded=e=>{
    const b=drawnBoxOf([e],scale),c=P(.7);
    return {min:{x:b.min.x-c,y:b.min.y-c},max:{x:b.max.x+c,y:b.max.y+c}};
  };
  return entities.flatMap(e=>{
    if(e.t==='dim')return [dimensionLinework(e,scale).textBox];
    if(e.t==='text')return [expanded(e)];
    if(e.t==='leader'){
      const tail=e.pts.at(-1),right=tail.x>=e.pts.at(-2).x;
      return [expanded(text({x:tail.x+(right?P(1.2):-P(1.2)),y:tail.y},e.label,e.h,e.layer,{align:right?'ML':'MR'}))];
    }
    if(e.t==='level'){
      const h=e.textHeight??TEXT_HEIGHT.SMALL,px=e.extendTo??e.p.x,dir=e.side==='left'?-1:1;
      const label=(e.value>=0?'+':'−')+Math.abs(e.value/1000).toFixed(3);
      return [expanded(text({x:px+dir*P(h)*.6*2,y:e.p.y+P(1.2)},label,h,e.layer,{align:dir<0?'R':'L'}))];
    }
    if(e.t==='sectionMark')return [e.a,e.b].map(p=>({min:{x:p.x-P(4.2),y:p.y-P(4.2)},max:{x:p.x+P(4.2),y:p.y+P(4.2)}}));
    return [];
  });
}

export function withAnnotationClearance(dwg,scale=1){
  const clear=prepareCadAnnotations(dwg,scale),boxes=annotationLabelBoxes(clear.entities,scale);
  return {...clear,entities:clear.entities.map(e=>e.t==='dim'||e.t==='leader'?{...e,annotationClearance:boxes}:e)};
}
