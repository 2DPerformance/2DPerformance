// y=0 is the top of the footing, never an assumed ground level.
export const DUCK_BEAM_CLEAR_DEFAULT = .35;

export function duckfootGeometry(i) {
  const keys = ['hp','t','colDepth','hz','B','capL','postSpacing','nPosts','beamB','beamH'];
  const g = Object.fromEntries(keys.map(k => [k, Number(i[k])]));
  g.beamClear = Number(i.beamClear ?? DUCK_BEAM_CLEAR_DEFAULT);
  g.beamBottom = g.beamClear;
  g.beamTop = g.beamClear + g.beamH;
  g.beamAxis = g.beamClear + g.beamH / 2;
  g.beamSpan = (g.nPosts - 1) * g.postSpacing;
  return g;
}

export function duckfootConcreteBoxes(g) {
  const members=[];
  for(let j=0;j<g.nPosts;j++){
    const z=-g.beamSpan/2+j*g.postSpacing;
    members.push({kind:'base',position:[g.B/2,-g.hz/2,z],size:[g.B,g.hz,g.capL]});
    members.push({kind:'wall',position:[g.t/2,g.hp/2,z],size:[g.t,g.hp,g.colDepth]});
  }
  members.push({kind:'strap',position:[g.beamB/2,g.beamAxis,0],size:[g.beamB,g.beamH,g.beamSpan]});
  return members;
}
