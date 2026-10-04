// Entered geometry only. Zero/absent dimensions retain the former preliminary
// envelope; neither an entered size nor the fallback establishes cap strength.
export function rearPileCaps(stayLayout,input={}){
  const dimension=(key,fallback)=>Number.isFinite(Number(input[key]))&&Number(input[key])>0?Number(input[key]):fallback;
  return (stayLayout?.anchors||[]).map(anchor=>{
    const width=Math.max(.55,anchor.width+.20);
    return {anchorIndex:anchor.id,position:[anchor.head.x,anchor.head.y,anchor.head.z],
      size:[dimension('ancCapB',width),dimension('ancCapH',.50),dimension('ancCapL',width)]};
  });
}
