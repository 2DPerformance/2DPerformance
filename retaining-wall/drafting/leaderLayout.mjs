/** RW-01 paper annotations only. Fixed targets, separate outboard lanes.
 * A descending comb routes each upper leader beyond the next lower lane;
 * therefore its vertical segment cannot cut the lower leader's landing.
 * Route a view before fitting/placing it, never regroup a composed sheet. */
import {bboxOf,text} from './cadPrimitives.js?rwv=20260930-load-units-1';
import {drawnBoxOf} from './extentGeometry.js?rwv=20261001-leader-layout-1';
import {dimensionLinework} from './dimensionLinework.mjs?rwv=20261001-leader-layout-1';

const overlaps=(a,b)=>Math.min(a.max.x,b.max.x)>Math.max(a.min.x,b.min.x)
  &&Math.min(a.max.y,b.max.y)>Math.max(a.min.y,b.min.y);

export function layoutLeaders(dwg,scale=1){
  if(!Number.isFinite(scale)||scale<=0)throw new RangeError('Leader layout: positive scale required');
  const leaders=dwg.entities.map((e,index)=>({e,index})).filter(({e})=>e.t==='leader'&&!e.leaderLayout);
  if(!leaders.length)return dwg;
  const entities=[...dwg.entities],P=mm=>mm*scale;
  // Text, dimension numerals, level symbols and cut bubbles are reservations.
  const blockers=dwg.entities.filter(e=>['text','dim','level','sectionMark'].includes(e.t)).map(e=>{
    // Reserve the numeral, not its full measured span/extension strokes.
    if(e.t==='dim')return dimensionLinework(e,scale).textBox;
    const b=drawnBoxOf([e],scale),gap=P(.7);
    return {min:{x:b.min.x-gap,y:b.min.y-gap},max:{x:b.max.x+gap,y:b.max.y+gap}};
  }).filter(Boolean);
  for(const side of [-1,1]){
    const ordered=leaders.filter(({e})=>{
      const tail=e.pts.at(-1),prev=e.pts.at(-2);
      return (tail.x>=prev.x?1:-1)===side;
    }).sort((a,b)=>b.e.pts[0].y-a.e.pts[0].y
      ||side*(b.e.pts[0].x-a.e.pts[0].x)||a.index-b.index);
    // Near-coincident bar targets must also separate visually. A cluster exits
    // nearest-first, before going into its outboard lanes. Only the leader
    // leaves the target; the steel/member coordinate itself stays unchanged.
    const clusters=[];
    for(const item of ordered){
      const last=clusters.at(-1);
      if(last&&last[0].e.pts[0].y-item.e.pts[0].y<P(.9))last.push(item);
      else clusters.push([item]);
    }
    const exits=new Map(),group=[];
    for(let k=0;k<clusters.length;k++){
      const cluster=clusters[k].sort((a,b)=>side*(b.e.pts[0].x-a.e.pts[0].x)
        ||b.e.pts[0].y-a.e.pts[0].y||a.index-b.index);
      const base=Math.min(...cluster.map(v=>v.e.pts[0].y));
      const below=clusters[k+1]?.[0].e.pts[0].y;
      const step=Math.min(P(.65),(base-(below??base-P(5)))/(cluster.length+1));
      cluster.forEach((v,j)=>{
        exits.set(v.index,{y:base-j*step,fan:cluster.some(w=>w!==v&&Math.abs(w.e.pts[0].x-v.e.pts[0].x)<1e-8)});
        group.push(v);
      });
    }
    if(!group.length)continue;
    if(group.length===1){const {e,index}=group[0];entities[index]={...e,leaderLayout:true};continue;}
    const edge=Math.max(...group.map(({e})=>side*e.pts[0].x)),lanePitch=P(.9),shoulder=P(2.5);
    const column=side*Math.max(...group.map(({e})=>side*e.pts.at(-1).x),
      edge+P(4)+shoulder+(group.length-1)*lanePitch);
    const exitX=side*(edge+P(1.5));
    let previousY=Infinity;
    for(let j=0;j<group.length;j++){
      const {e,index}=group[j],head=e.pts[0];
      const exit=exits.get(index),exitY=exit.y;
      const pitch=P(Math.max(6,e.h*1.4+1.1));
      let y=Math.min(exitY,previousY-pitch);
      const labelBox=at=>{
        const b=drawnBoxOf([text({x:column+side*P(1.2),y:at},e.label,e.h,e.layer,{align:side>0?'ML':'MR'})],scale);
        return {min:{x:b.min.x-P(.7),y:b.min.y-P(.7)},max:{x:b.max.x+P(.7),y:b.max.y+P(.7)}};
      };
      for(let k=0;k<100&&blockers.some(b=>overlaps(labelBox(y),b));k++)y-=pitch;
      const portalX=column-side*(shoulder+j*lanePitch);
      const pts=[head];
      if(Math.abs(head.y-exitY)>1e-8)pts.push({x:exit.fan?exitX:head.x,y:exitY});
      pts.push({x:portalX,y:exitY});
      if(Math.abs(exitY-y)>1e-8)pts.push({x:portalX,y});
      pts.push({x:column,y});
      entities[index]={...e,pts,leaderLayout:true};
      blockers.push(labelBox(y));previousY=y;
    }
  }
  return {...dwg,entities,bbox:bboxOf(entities)};
}
