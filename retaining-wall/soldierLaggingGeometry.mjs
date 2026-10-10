// Presentation of separate lagging planks between the existing I-pile webs.
// Cutting length, bearing and manufacturer capacity are not inferred here.
export function soldierLaggingParts({hp,Lw,pileS,pileB,lagT,lagW}) {
  const parts=[],bays=Math.ceil(Lw/pileS-1e-9),rows=Math.ceil(hp/lagW-1e-9);
  for(let bay=0;bay<bays;bay++) {
    const left=Math.min(bay*pileS,Lw),right=Math.min((bay+1)*pileS,Lw);
    // Same web envelope as both existing I-pile viewers (web = 0.23 B).
    const length=right-left-pileB*.23;
    if(length<=0)continue;
    for(let row=0;row<rows;row++) {
      const h=Math.min(lagW,hp-row*lagW);
      parts.push({kind:'wall',position:[.03,row*lagW+h/2,-Lw/2+(left+right)/2],size:[lagT,h,length],
        label:'แผ่นกันดิน · ช่วง '+(bay+1)+' / แถว '+(row+1)});
    }
  }
  return parts;
}
