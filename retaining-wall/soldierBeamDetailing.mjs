/** FRONT RB beams: nominal, single-row design geometry, millimetres.
 * Horizontal screen: ACI318-14 US §25.2.1 (1 inch = 25.4 mm), not 318M.
 * Opposite-row clearance uses the same conservative project screen.
 * No rib envelope, hooks, laps, development or interior link-leg authority. */
export const RB_DETAIL_DEFAULTS=Object.freeze({rbCover:50,rbAgg:20});
export const RB_SPACING_SOURCE='ACI318-14 US §25.2.1 · 1 in = 25.4 mm · nominal single row';

export function soldierBarInset(cover,linkDb,db){return cover+linkDb+db/2;}

export function soldierBeamDetailing({width,depth,cover,aggregate,db,linkDb,nTop,nBot}){
  const values=[width,depth,cover,aggregate,db,linkDb,nTop,nBot];
  if(values.some(v=>!Number.isFinite(v)||v<=0)||![nTop,nBot].every(v=>Number.isInteger(v)&&v>=2))
    throw new RangeError('RB detailing requires positive millimetres and at least two bars per face');
  const inset=soldierBarInset(cover,linkDb,db),clearMin=Math.max(25.4,db,4*aggregate/3);
  const n=Math.max(nTop,nBot),requiredWidth=2*(cover+linkDb)+n*db+(n-1)*clearMin;
  const requiredDepth=2*(cover+linkDb+db)+clearMin;
  const clearTop=(width-2*(cover+linkDb)-nTop*db)/(nTop-1);
  const clearBot=(width-2*(cover+linkDb)-nBot*db)/(nBot-1);
  const clearVertical=depth-2*inset-db;
  const row=(count,y)=>Array.from({length:count},(_,k)=>[inset+k*(width-2*inset)/(count-1),y]);
  const physicalOK=width>2*inset&&depth>2*inset;
  const spacingOK=physicalOK&&Math.min(clearTop,clearBot,clearVertical)>=clearMin-1e-8;
  const linkInset=cover+linkDb/2;
  return {schema:'rw01-rb-detailing/1',source:'engine',spacingSource:RB_SPACING_SOURCE,
    fabricationAuthority:false,width,depth,cover,aggregate,db,linkDb,nTop,nBot,inset,
    effectiveDepth:depth-inset,clearMin,clearTop,clearBot,clearVertical,requiredWidth,requiredDepth,
    physicalOK,spacingOK,dc:Math.max(requiredWidth/width,requiredDepth/depth),
    // Invalid envelopes retain their original inputs/checks; no fictional fitted cage.
    top:physicalOK?row(nTop,depth-inset):[],bottom:physicalOK?row(nBot,inset):[],
    link:physicalOK?[[linkInset,linkInset],[width-linkInset,linkInset],
      [width-linkInset,depth-linkInset],[linkInset,depth-linkInset],[linkInset,linkInset]]:[],
  };
}
