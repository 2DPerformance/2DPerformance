/** Piece layout only: the Engine BBS uses rounded bays (engine.mjs nPT/nPH).
 * Its force nT/nH values are densities per metre, not piece counts. Stations
 * divide the wall length uniformly, matching the existing calculated Plan. */
export function pileDrawingRows(g,expectedTotal=null,maxDisplayCount=1000){
  const keys=['Lw','pileSt','pileSh','pileToeX','pileHeelX'];
  if(!g||keys.some(key=>typeof g[key]!=='number'||!Number.isFinite(g[key]))
    ||g.Lw<=0||g.pileSt<=0||g.pileSh<=0||!Number.isInteger(maxDisplayCount)||maxDisplayCount<2)
    throw new TypeError('Pile drawing: complete metre geometry required');
  const rows=[['toe',g.pileToeX,g.pileSt],['heel',g.pileHeelX,g.pileSh]].map(([id,x,spacing])=>{
    const pieces=Math.max(1,Math.round(g.Lw/Math.max(spacing,.6)))+1;
    const count=Math.min(pieces,maxDisplayCount);
    return {id,x,designSpacing:spacing,pieces,count,spacing:g.Lw/(count-1),
      stations:Array.from({length:count},(_,j)=>j*g.Lw/(count-1))};
  });
  if(expectedTotal!==null&&(!Number.isInteger(expectedTotal)
    ||rows.some(r=>r.count!==r.pieces)||rows.reduce((n,row)=>n+row.pieces,0)!==expectedTotal))
    throw new TypeError('Pile drawing: geometry differs from accepted quantity ledger');
  return rows;
}
