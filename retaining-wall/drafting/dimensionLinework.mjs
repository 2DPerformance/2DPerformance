/** Paper annotation only: preserve measured endpoints and complete label values.
 * SVG and DXF share the same visible strokes around dimension text. */
import {DIM_STYLE,paperToModel} from './draftingStandard.js?rwv=20260930-load-units-1';
import {dimLength} from './cadPrimitives.js?rwv=20260930-load-units-1';
import {textWidthEm} from './textMetrics.js?rwv=20260930-load-units-1';

/** Segment/rectangle interval; no raster pixels or DPI assumptions. */
function insideInterval(a,b,box) {
  const dx=b.x-a.x,dy=b.y-a.y;
  let lo=0,hi=1;
  for(const [p,q] of [[-dx,a.x-box.min.x],[dx,box.max.x-a.x],
    [-dy,a.y-box.min.y],[dy,box.max.y-a.y]]) {
    if(Math.abs(p)<1e-12){if(q<0)return null;}
    else if(p<0)lo=Math.max(lo,q/p);
    else hi=Math.min(hi,q/p);
    if(lo>hi)return null;
  }
  return [lo,hi];
}
export function clearSegment(a,b,box) {
  const interval=insideInterval(a,b,box);
  if(!interval)return [{a:{...a},b:{...b}}];
  const at=t=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const [lo,hi]=interval,parts=[];
  if(lo>1e-9)parts.push({a:{...a},b:at(lo)});
  if(hi<1-1e-9)parts.push({a:at(hi),b:{...b}});
  return parts;
}
export function clearAnnotationSegments(segments,boxes=[]) {
  return boxes.reduce((parts,box)=>parts.flatMap(s=>
    clearSegment(s.a,s.b,box).map(part=>({...s,...part}))),segments);
}

export function dimensionLinework(e,scale) {
  const P=v=>paperToModel(v,scale),h=P(DIM_STYLE.textHeight),label=dimLength(e).toFixed(DIM_STYLE.decimals)+(e.note?' '+e.note:'');
  const gap=P(DIM_STYLE.extGap),beyond=P(DIM_STYLE.extBeyond),tick=P(DIM_STYLE.tickLength)/2;
  const sign=Math.sign(e.off)||1;
  // Include the complete note, not only a short generic numeric placeholder.
  // Otherwise the gap would swallow ticks of a 12 mm "1200 Toe" span.
  const span=Math.abs(e.vertical?e.b.y-e.a.y:e.b.x-e.a.x)/scale;
  const tight=span<textWidthEm(label)*DIM_STYLE.textHeight+2*DIM_STYLE.textGap;
  const strokes=[];
  const add=(a,b,kind)=>strokes.push({a,b,kind});
  let p,align,rot;
  if(e.vertical) {
    const x=e.a.x+e.off,ya=Math.min(e.a.y,e.b.y),yb=Math.max(e.a.y,e.b.y);
    for(const q of [e.a,e.b])add({x:q.x+sign*gap,y:q.y},{x:x+sign*beyond,y:q.y},'extension');
    add({x,y:ya},{x,y:yb},'dimension');
    for(const y of [ya,yb])add({x:x-tick,y:y-tick},{x:x+tick,y:y+tick},'tick');
    p={x,y:tight?yb+P(DIM_STYLE.textHeight*1.1):(ya+yb)/2};align=tight?'ML':'MC';rot=90;
  }else{
    const y=e.a.y+e.off,xa=Math.min(e.a.x,e.b.x),xb=Math.max(e.a.x,e.b.x);
    for(const q of [e.a,e.b])add({x:q.x,y:q.y+sign*gap},{x:q.x,y:y+sign*beyond},'extension');
    add({x:xa,y},{x:xb,y},'dimension');
    for(const x of [xa,xb])add({x:x-tick,y:y-tick},{x:x+tick,y:y+tick},'tick');
    p={x:tight?xb+P(DIM_STYLE.textHeight*.6):(xa+xb)/2,y:y+sign*P(DIM_STYLE.textGap)};
    align=tight?'L':'C';rot=0;
  }
  const w=textWidthEm(label)*h,centred=align.startsWith('M'),back=align==='MC'||align==='C'?w/2:0;
  const up=h*(centred?.7:1),down=h*(centred?.7:.4),c=P(.7);
  const textBox=rot===90
    ?{min:{x:p.x-up-c,y:p.y-back-c},max:{x:p.x+down+c,y:p.y-back+w+c}}
    :{min:{x:p.x-back-c,y:p.y-down-c},max:{x:p.x-back+w+c,y:p.y+up+c}};
  return {label,textAt:p,align,rot,textHeight:DIM_STYLE.textHeight,textBox,
    segments:clearAnnotationSegments(strokes,[textBox,...(e.annotationClearance||[])])};
}
