/** Paper-only orthographic projection of accepted outer-fibre bending magnitudes. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dot=(a,b)=>a.reduce((v,x,k)=>v+x*b[k],0);
const sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const length=Math.hypot(...a);return a.map(x=>x/length);};
const eye=unit([.8,.28,-.65]),right=unit([-eye[2],0,eye[0]]),up=cross(right,eye);
const project=p=>[dot(p,right),-dot(p,up)];
const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
const coordinate=(p,v)=>{const index=['x','y','z'].indexOf(p.axis);return p.reverse?p.origin-v[index]:v[index]+p.origin;};
function vertices(p,a=0,b=1){
  const [x,y,z]=p.position,[w,h,d]=p.size;
  const ys=p.axis==='y'?[y-h/2+a*h,y-h/2+b*h]:[y-h/2,y+h/2];
  const zs=p.axis==='z'?[z-d/2+a*d,z-d/2+b*d]:[z-d/2,z+d/2];
  const xs=p.axis==='x'?[x-w/2+a*w,x-w/2+b*w]:[x-w/2,x+w/2];
  const at=(yy,zz)=>[p.topWidth==null?xs[1]:x+w/2+(p.topWidth-w)*(yy-y+h/2)/h,yy,zz];
  return [[xs[0],ys[0],zs[0]],at(ys[0],zs[0]),at(ys[1],zs[0]),[xs[0],ys[1],zs[0]],
    [xs[0],ys[0],zs[1]],at(ys[0],zs[1]),at(ys[1],zs[1]),[xs[0],ys[1],zs[1]]];
}
function outwardNormal(pts,centre){
  let n=cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]));
  const fc=pts[0].map((_,k)=>pts.reduce((v,p)=>v+p[k],0)/pts.length);
  if(dot(n,sub(fc,centre))<0)n=n.map(x=>-x);
  return unit(n);
}
export function contourSliceFractions(p,max=null){
  if(!p.field||p.field.kind==='critical')return [0,1];
  const dim=['x','y','z'].indexOf(p.axis),lo=p.position[dim]-p.size[dim]/2,size=p.size[dim];
  const f=q=>((p.reverse?p.origin-q:q-p.origin)-lo)/size;
  const values=[0,1,...p.field.stations.flatMap(s=>[f(s.x),...(s.to==null?[]:[f(s.to)])])].filter(x=>x>=0&&x<=1);
  // Both paper and WebGL retain every zero crossing/palette corner. Uniform
  // GPU subdivisions alone miss a sign change between accepted stations.
  if(p.field.kind==='stations'&&Number.isFinite(max))for(let j=1;j<p.field.stations.length;j++){
    const a=p.field.stations[j-1],b=p.field.stations[j],delta=b.sigma-a.sigma;
    if(Math.abs(delta)<1e-14||b.x===a.x)continue;
    for(let k=-4;k<=4;k++){const t=(max*k/4-a.sigma)/delta;if(t>0&&t<1){const value=f(a.x+(b.x-a.x)*t);if(value>0&&value<1)values.push(value);}}
  }
  if(p.field.kind!=='strips')for(let j=1;j<32;j++)values.push(j/32);
  return [...new Set(values)].sort((a,b)=>a-b);
}
export function plotSurfaces(parts,{max=null,visibleOnly=true}={}){
  const surfaces=[],outlines=[];
  for(const p of parts){
    const raw=p.vertices||vertices(p),centre=raw[0].map((_,k)=>raw.reduce((v,x)=>v+x[k],0)/raw.length),indexes=p.faces||faces;
    for(const face of indexes){
      const pts=face.map(k=>raw[k]),normal=outwardNormal(pts,centre);
      if(dot(normal,eye)>1e-7)outlines.push({key:p.key,pts,normal,depth:dot(pts[0].map((_,k)=>pts.reduce((v,x)=>v+x[k],0)/pts.length),eye)});
    }
    const splits=p.vertices?[0,1]:contourSliceFractions(p,max);
    for(let j=0;j<splits.length-1;j++){
      const vv=p.vertices||vertices(p,splits[j],splits[j+1]);
      const cc=vv[0].map((_,k)=>vv.reduce((v,x)=>v+x[k],0)/vv.length);
      for(const face of indexes){
        const pts=face.map(k=>vv[k]),normal=outwardNormal(pts,cc);
        if(!normal.every(Number.isFinite)||(visibleOnly&&dot(normal,eye)<=1e-7))continue;
        if(p.field){
          const dim=['x','y','z'].indexOf(p.axis),lo=p.position[dim]-p.size[dim]/2,hi=p.position[dim]+p.size[dim]/2;
          if(pts.every(v=>Math.abs(v[dim]-pts[0][dim])<1e-9)&&pts[0][dim]>lo+1e-8&&pts[0][dim]<hi-1e-8)continue;
        }
        const qs=p.field?pts.map(v=>coordinate(p,v)):[];
        surfaces.push({key:p.key,part:p,pts,normal,field:p.field,qMin:Math.min(...qs),qMax:Math.max(...qs),
          depth:dot(pts[0].map((_,k)=>pts.reduce((v,x)=>v+x[k],0)/pts.length),eye)});
      }
    }
  }
  return {surfaces:surfaces.sort((a,b)=>a.depth-b.depth),outlines};
}
export function plotPeak(c,parts){
  const field=c.fields.reduce((a,b)=>Math.abs(a.peak.sigma)>=Math.abs(b.peak.sigma)?a:b);
  const part=parts.find(p=>p.field===field);
  if(!part)return {field,point:null};
  const point=[...part.position],dim=['x','y','z'].indexOf(part.axis);
  // A critical-only region has no analysed spatial distribution. Mark its section centre.
  if(field.kind!=='critical')point[dim]=part.reverse?part.origin-field.peak.x:field.peak.x-part.origin;
  if(dim!==0)point[0]+=part.size[0]/2;
  if(dim!==2)point[2]-=part.size[2]/2;
  if(part.topWidth!=null&&dim!==0)point[0]+=(part.topWidth-part.size[0])*(point[1]-part.position[1]+part.size[1]/2)/part.size[1];
  return {field,point};
}
export function surfaceGradient(surface,paper){
  const mins=surface.pts.filter(v=>Math.abs(coordinate(surface.part,v)-surface.qMin)<1e-8);
  const max=surface.pts.find(v=>Math.abs(coordinate(surface.part,v)-surface.qMax)<1e-8);
  const a=paper(mins[0]),along=paper(mins[1]),opposite=paper(max);
  // Gradient is normal to the projected equal-station edge. A world-axis gradient
  // would incorrectly change colour along wall length and leave diagonal band seams.
  const tangent=sub(along,a),normal=unit([-tangent[1],tangent[0]]),length=dot(normal,sub(opposite,a));
  return {a,b:a.map((v,k)=>v+normal[k]*length)};
}
export function renderContourPlot(c,parts,{height=300,width=800,markPeak=true,sample,color}){
  if(!Number.isFinite(height)||height<100)throw new RangeError('Contour drawing needs a positive paper viewport');
  const {surfaces}=plotSurfaces(parts,{max:c.max}),points=surfaces.flatMap(p=>p.pts.map(project));
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  if(!Number.isFinite(width)||width<100)throw new RangeError('Contour needs a positive viewport width');
  const scale=Math.min((width-48)/(maxX-minX||1),(height-40)/(maxY-minY||1));
  const offset=[(width-(maxX-minX)*scale)/2-minX*scale,(height-(maxY-minY)*scale)/2-minY*scale];
  const paper=v=>project(v).map((n,k)=>n*scale+offset[k]);
  const xy=v=>paper(v).map(n=>n.toFixed(2)).join(',');
  const id='rwcp-'+String(c.identity).replace(/[^a-zA-Z0-9]/g,'').slice(-32)+'-'+height+'-'+width;
  const defs=[],shapes=[];
  for(const [j,s]of surfaces.entries()){
    let fill='#b9c5ce';
    if(s.field){
      const constant=s.field.kind!=='stations'||Math.abs(s.qMax-s.qMin)<1e-9;
      if(constant)fill=color(sample(s.field,(s.qMin+s.qMax)/2),c.max);
      else{
        const {a,b}=surfaceGradient(s,paper),name=id+'g'+j;
        const sigmaA=sample(s.field,s.qMin),sigmaB=sample(s.field,s.qMax),fractions=[0,1];
        if(Math.abs(sigmaB-sigmaA)>1e-14)for(let k=-4;k<=4;k++){const f=(c.max*k/4-sigmaA)/(sigmaB-sigmaA);if(f>0&&f<1)fractions.push(f);}
        const stops=fractions.sort((a,b)=>a-b).map(f=>'<stop offset="'+f+'" stop-color="'+color(sample(s.field,s.qMin+(s.qMax-s.qMin)*f),c.max)+'"/>').join('');
        defs.push('<linearGradient id="'+name+'" gradientUnits="userSpaceOnUse" x1="'+a[0].toFixed(3)+'" y1="'+a[1].toFixed(3)+'" x2="'+b[0].toFixed(3)+'" y2="'+b[1].toFixed(3)+'">'+stops+'</linearGradient>');
        fill='url(#'+name+')';
      }
    }else{
      const shade=Math.max(0,Math.min(1,dot(s.normal,unit([-.3,.85,-.4]))));
      fill=['#b1bec9','#becbd4','#d0dbe2'][Math.min(2,Math.floor(shade*3))];
    }
    shapes.push('<polygon data-contour-member="'+esc(s.key)+'" data-contour-known="'+!!s.field+'" points="'+s.pts.map(xy).join(' ')+'" fill="'+fill+'" stroke="'+fill+'" stroke-width=".6"/>');
    const dim=['x','y','z'].indexOf(s.part.axis),lo=s.part.position?.[dim]-s.part.size?.[dim]/2,hi=s.part.position?.[dim]+s.part.size?.[dim]/2;
    for(let k=0;k<s.pts.length;k++){
      const a=s.pts[k],b=s.pts[(k+1)%s.pts.length];
      const interiorCut=s.field&&Math.abs(a[dim]-b[dim])<1e-9&&a[dim]>lo+1e-8&&a[dim]<hi-1e-8;
      if(interiorCut)continue;
      const aa=paper(a),bb=paper(b);
      shapes.push('<path data-contour-outline="'+esc(s.key)+'" d="M'+aa.map(n=>n.toFixed(2)).join(' ')+' L'+bb.map(n=>n.toFixed(2)).join(' ')+'" fill="none" stroke="#536b7d" stroke-width=".65"/>');
    }
  }
  // Physical edge strokes share surface order; hidden members do not become X-ray outlines.
  const peak=plotPeak(c,parts),marker=markPeak&&peak.point?'<g data-contour-peak="'+esc(peak.field.key)+'" data-contour-peak-mpa="'+Math.abs(peak.field.peak.sigma)+'" transform="translate('+paper(peak.point).map(n=>n.toFixed(2)).join(' ')+')"><circle r="11" fill="#f7fafc" stroke="#142d44" stroke-width="2"/><text text-anchor="middle" y="5" font-family="Arial,sans-serif" font-weight="700" font-size="15" fill="#142d44">1</text></g>':'';
  return '<svg class="rw-contour-svg" role="img" aria-label="Stress Contour Plot · ความเค้นดัด |σb|" data-contour-render="orthographic-surfaces/2" data-contour-identity="'+esc(c.identity)+'" viewBox="0 0 '+width+' '+height+'" xmlns="http://www.w3.org/2000/svg"><defs>'+defs.join('')+'</defs>'+shapes.join('')+marker+'</svg>';
}
export const CONTOUR_CSS=`
.rw-contour-views{display:grid;grid-template-columns:1fr 2fr;gap:10px}.rw-contour-views figure{margin:0;min-width:0}.rw-contour-views figcaption{font:10px Sarabun,Arial,sans-serif;color:#506577;padding:2px 0}
.rw-contour-legend{font:11px Sarabun,Arial,sans-serif;color:#183950;padding:8px 10px;background:#f7fafc;border:1px solid #c3d1dd;font-variant-numeric:tabular-nums}
.rw-contour-scale-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:5px}.rw-contour-scale-head b{white-space:nowrap}.rw-contour-scale-head span{color:#506577;font-size:10px}
.rw-contour-ramp{display:block;height:9px;background:linear-gradient(90deg,#234d91,#1d92b8,#31b17e,#f0cc42,#cb3f30)}
.rw-contour-ticks{display:flex;justify-content:space-between;gap:4px;font-size:10px;line-height:1.6}.rw-contour-ticks span::before{content:'';display:block;width:1px;height:3px;background:#758b9c;margin-bottom:2px}.rw-contour-ticks span:last-child{text-align:right}.rw-contour-ticks span:last-child::before{margin-left:auto}
.rw-contour-peak-note{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;margin-top:6px}.rw-contour-peak-note b{font-weight:700}.rw-contour-peak-note span{color:#506577}
.rw-contour-legend small{display:block;margin-top:5px;line-height:1.4;color:#506577;font-size:10px}.rw-contour-marker-key{display:inline-flex;justify-content:center;align-items:center;border:1px solid #183950;border-radius:50%;width:15px;height:15px;font:bold 10px Arial,sans-serif}
`;
