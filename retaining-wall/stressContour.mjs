/** Read-only flexure display. This is NOT an FE shell stress solver or a capacity check. */
import {resultUnits} from './resultUnits.mjs?rwv=20261003-main-equations-1';
import {pileDrawingRows} from './pileDrawingLayout.mjs?rwv=20261001-a4-cad-1';
import {renderContourPlot,plotPeak,plotSurfaces} from './contourPlot.mjs?rwv=20261003-cad-contour-1';
export {CONTOUR_CSS} from './contourPlot.mjs?rwv=20261003-cad-contour-1';
export const CONTOUR_LABEL='Stress Contour Plot · ความเค้นดัด';
export const CONTOUR_VERSION='rw01-flexure-contour/1';
export const CONTOUR_SOURCE='https://web.mit.edu/course/3/3.11/www/Lectures/Lecture13.pdf';
export const CONTOUR_NOTE='|σb| = |M|c/Ig · ความเค้นดัดหน้าตัดรวมเชิงยืดหยุ่น ไม่รวมแรงอัด/อัดล่วงหน้าและการแตกร้าว · ไม่ใช่ shell FEM หรือผลตรวจ D/C';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const freeze=v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const finite=Number.isFinite;
export function flexureStressMPa(momentKNm,cMetres,inertiaM4){
  if(![momentKNm,cMetres,inertiaM4].every(finite)||cMetres<=0||inertiaM4<=0)throw new RangeError('Contour needs finite accepted M, c > 0 and Ig > 0');
  return momentKNm*cMetres/inertiaM4/1000;
}
export function contourColor(value,max){
  if(!finite(value)||!finite(max)||max<0)return '#aebbc6';
  const stops=[[35,77,145],[29,146,184],[49,177,126],[240,204,66],[203,63,48]],t=max>0?Math.max(0,Math.min(1,Math.abs(value)/max))*4:0;
  const j=Math.min(3,Math.floor(t)),f=t-j;
  return '#'+stops[j].map((v,k)=>Math.round(v+(stops[j+1][k]-v)*f).toString(16).padStart(2,'0')).join('');
}
function field(key,label,points,b,h,basis='DESIGN',kind='stations',inertia=null){
  const stations=points.filter(p=>finite(p.x)&&finite(p.m)&&finite(p.h??h)).map(p=>{
    const depth=p.h??h,Ig=inertia??b*depth**3/12,c=depth/2;
    return {x:p.x,m:p.m,h:depth,b,Ig,c,sigma:flexureStressMPa(p.m,c,Ig),...(p.to==null?{}:{to:p.to})};
  });
  if(!stations.length)throw new RangeError('No accepted ordinates for '+key);
  const peak=stations.reduce((a,p)=>Math.abs(p.sigma)>Math.abs(a.sigma)?p:a);
  return {key,label,basis,kind,stations,peak};
}
/** Call once during native Snapshot construction. Legacy uses its frozen result. */
export function projectEngineContour(r,type,identity){
  const i=r.i,fields=[];
  if(type==='soldier'){
    // Same effective gross Ig assumed by the accepted beam FE (engine.mjs IgP),
    // not a manufacturer I-pile stress or a prestress-adjusted stress.
    const Ig=.6*r.Bp**4/12;
    fields.push(field('front-pile','เข็มหน้า · Ig เทียบเท่าของแบบจำลอง',r.disp.Mprof.map((m,k)=>({x:k*r.disp.h,m})),r.Bp,r.Bp,'SERVICE · ต่อเข็ม','stations',Ig));
    for(const b of r.capD?.beams||[])if(b.present)fields.push(field(b.name,b.name,[{x:0,m:b.McapU}],b.bw,b.bh,'DESIGN · จุดคุม','critical'));
  }else{
    if(r.mode==='but')fields.push(field('stem','พนัง · แถบที่ครีบ',r.strips.map(p=>({x:p.z1,to:p.z2,m:p.Mn_,h:p.th})),1,i.t,'DESIGN · ต่อเมตร','strips'));
    else fields.push(field('stem','พนัง',r.stemTab.grid.map(p=>({x:p.z,m:p.M,h:r.tAt?r.tAt(p.z):i.t})),1,i.t,'DESIGN · ต่อเมตร'));
    for(const [key,label,m]of [['heel','Heel',Math.max(Math.abs(r.MH_),Math.abs(r.MH$))],['toe','Toe',Math.max(Math.abs(r.MT),Math.abs(r.MTtop))]])
      fields.push(field(key,label,[{x:0,m}],1,i.hz,'DESIGN · จุดคุม/เมตร','critical'));
  }
  return finish(type,identity,fields);
}
function finish(type,identity,fields){
  const max=Math.max(0,...fields.map(f=>Math.abs(f.peak.sigma)));
  return freeze({version:CONTOUR_VERSION,type,identity,unit:'MPa',quantity:'abs-bending-stress',max,fields,
    note:CONTOUR_NOTE+(type==='soldier'?' · เข็มหน้าใช้ Ig เทียบเท่า 0.6B⁴/12 ตาม beam FE ของ Engine ไม่ใช่ I จากผู้ผลิต':''),source:CONTOUR_SOURCE,interpolation:'สีระหว่างจุดเป็นการประมาณเพื่อแสดงภาพ; แถบครีบ/ฐาน/RB ใช้ค่าจุดคุม ไม่ใช่ความเค้นกระจายจาก FEM'});
}
const cache=new WeakMap();
export function stressContourFor(s){
  if(s.stressContour)return s.stressContour;
  if(cache.has(s))return cache.get(s);
  let result;
  if(s.result)result=projectEngineContour(s.result,s.result.mode==='but'?'counterfort':s.result.i.wtype==='gravity'?'gravity':'cantilever',s.id);
  else if(s.type==='duckfoot'){
    const i=s.input,fs=s.factoredBeam,fields=[];
    fields.push(field('beam','คาน GB1',fs.spans.flatMap(span=>span.grid.map(p=>({x:span.index*span.L+p.x,m:p.M}))),i.beamB,i.beamH,'DESIGN · คานต่อเนื่อง'));
    fields.push(field('column','เสาต้นที่คุม P–M',s.column.grid.map(p=>({x:p.z,m:p.m})),i.colDepth,i.t,'DESIGN · bending component'));
    if(s.footing)fields.push(field('footing','ฐาน F1/F2',[{x:0,m:Math.max(s.footing.Mx,s.footing.My)}],1,i.hz,'DESIGN · จุดคุม/เมตร','critical'));
    result=finish(s.type,s.stamp,fields);
  }else throw new TypeError('Contour requires an accepted Snapshot');
  cache.set(s,result);return result;
}
export function sampleContour(f,x){
  const ps=f.stations;
  if(f.kind==='critical')return ps[0].sigma;
  if(f.kind==='strips')return (ps.find(p=>x>=p.x&&x<=p.to)||ps.at(-1)).sigma;
  if(x<=ps[0].x)return ps[0].sigma;
  for(let k=1;k<ps.length;k++)if(x<=ps[k].x){const a=ps[k-1],b=ps[k];return a.x===b.x?b.sigma:a.sigma+(b.sigma-a.sigma)*(x-a.x)/(b.x-a.x);}
  return ps.at(-1).sigma;
}
/** Physical member envelopes for the vector report and WebGL overlay, y=footing top. */
export function contourParts(s){
  const c=stressContourFor(s),type=c.type,fs=new Map(c.fields.map(f=>[f.key,f])),parts=[];
  const box=(key,x,y,z,w,h,d,axis='y',origin=0,reverse=false)=>parts.push({key,position:[x,y,z],size:[w,h,d],field:fs.get(key)||null,axis,origin,reverse});
  const prism=(key,a,b,width,depth)=>{
    const v=b.map((x,k)=>x-a[k]),len=Math.hypot(...v),axis=v.map(x=>x/len),cross=[-axis[2],0,axis[0]],cl=Math.hypot(...cross),side=cl>1e-8?cross.map(x=>x/cl):[1,0,0],up=[side[1]*axis[2]-side[2]*axis[1],side[2]*axis[0]-side[0]*axis[2],side[0]*axis[1]-side[1]*axis[0]];
    const vertices=[a,b].flatMap(point=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sv])=>point.map((x,k)=>x+side[k]*width/2*su+up[k]*depth/2*sv)));
    parts.push({key,field:null,vertices,faces:[[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]]});
  };
  if(type==='duckfoot'){
    const g=s.geometry;
    for(let j=0;j<g.nPosts;j++){
      const z=-g.beamSpan/2+j*g.postSpacing;
      box('footing',g.B/2,-g.hz/2,z,g.B,g.hz,g.capL);
      // Only the actual governing column's accepted combination is coloured.
      box(j===s.column.index?'column':'unknown-column',g.t/2,g.hp/2,z,g.t,g.hp,g.colDepth);
    }
    box('beam',g.beamB/2,g.beamAxis,0,g.beamB,g.beamH,g.beamSpan,'z',g.beamSpan/2);
  }else if(type==='soldier'){
    const g=s.geometry,n=Math.ceil(g.Lw/g.pileS-1e-9)+1;
    for(let j=0;j<n;j++){
      const z=-g.Lw/2+Math.min(j*g.pileS,g.Lw),w=g.pileB;
      for(const [dz,ww,dd]of [[-w*.32,w,w*.17],[w*.32,w,w*.17],[0,w*.23,w*.64]])
        box('front-pile',0,(g.hp-g.embed)/2,z+dz,ww,g.hp+g.embed,dd,'y',g.hp,true);
    }
    for(const b of g.capBeams)box(b.mark,0,b.y,0,b.width,b.depth,g.Lw);
    for(let j=0;j<n-1;j++)box('unknown-lag',0,g.hp/2,-g.Lw/2+(Math.min(j*g.pileS,g.Lw)+Math.min((j+1)*g.pileS,g.Lw))/2,g.lagT,g.hp,Math.min(g.pileS,g.Lw-j*g.pileS)-g.pileB*.3);
    for(const a of g.stayLayout?.anchors||[])box('unknown-anchor',a.head.x,(a.head.y+a.tip.y)/2,a.head.z,a.width,a.head.y-a.tip.y,a.width);
    for(const m of g.stayLayout?.members||[])prism('unknown-stay',['x','y','z'].map(k=>m.front[k]),['x','y','z'].map(k=>m.rear[k]),m.width,m.depth);
    for(const cap of g.rearCaps||[]){if(cap.position&&cap.size)box('unknown-rear-cap',...cap.position,...cap.size);}
  }else{
    const g=s.geometry||{...s.result.i,ttop:s.result.tTop},B=g.B,Lw=g.Lw,t=g.t,H=g.hp,hz=g.hz,toe=g.toe;
    box('stem',toe+t/2,H/2,0,t,H,Lw,'y',H,true);parts.at(-1).topWidth=g.ttop||t;
    box('toe',toe/2,-hz/2,0,Math.max(toe,.001),hz,Lw);
    box('heel',toe+t+g.heel/2,-hz/2,0,g.heel,hz,Lw);
    box('unknown-root',toe+t/2,-hz/2,0,t,hz,Lw);
    const legacy=!!s.result,r=s.result,cf=['counterfort','pilecf'].includes(type);
    if(cf){
      const count=legacy?r.qty.nBut:g.ribCount,spacing=legacy?r.Lt:g.ribCentreSpacing,width=legacy?r.i.bs:g.ribThickness,ribH=legacy?r.cfHr:g.ribHeight,ribL=legacy?r.cfLr:g.ribLength;
      for(let j=0;j<count;j++){
        const z=-Lw/2+Math.min(j*spacing,Lw-width),x=toe+t,vertices=[[x,0,z],[x,ribH,z],[x+ribL,0,z],[x,0,z+width],[x,ribH,z+width],[x+ribL,0,z+width]];
        parts.push({key:'unknown-rib',field:null,vertices,faces:[[0,1,2],[3,5,4],[0,3,4,1],[1,4,5,2],[2,5,3,0]]});
      }
    }
    if(!legacy)for(const row of pileDrawingRows(g,s.quantities.piles))for(const station of row.stations){
      const angle=row.id==='toe'?s.input.pileBatT:s.input.pileBatH,z=station-Lw/2,dx=Math.tan(angle*Math.PI/180)*g.pileEmb;
      prism('unknown-foundation-pile',[row.x,-hz,z],[row.x-dx,-hz-g.pileEmb,z],g.pileB,g.pileB);
    }
  }
  return parts;
}
export function contourLegend(s,mode='si',{marker=false}={}){
  const c=stressContourFor(s),u=resultUnits(mode);
  const {field}=plotPeak(c,contourParts(s));
  const note=marker?'หน้าตัดรวมเชิงยืดหยุ่น · ไม่รวมแรงอัด/อัดล่วงหน้าและการแตกร้าว · ไม่ใช่ shell FEM หรือผลตรวจ D/C · สีเทา: ไม่มีผลความเค้นที่ฉายได้':c.note+' · สีเทา: ไม่มีผลความเค้นที่ฉายได้';
  return '<div class="rw-contour-legend" data-contour-identity="'+esc(c.identity)+'" data-contour-max-mpa="'+c.max+'"><div class="rw-contour-scale-head"><b>|σb| · '+u.label('MPa')+'</b><span>ความเค้นดัดที่ผิวนอกหน้าตัด</span></div><span class="rw-contour-ramp"></span><div class="rw-contour-ticks">'+Array.from({length:5},(_,j)=>'<span data-contour-tick="'+j+'">'+u.format(c.max*j/4,'MPa',3)+'</span>').join('')+'</div><div class="rw-contour-peak-note">'+(marker?'<b class="rw-contour-marker-key">1</b>':'')+'<b>สูงสุด '+u.quantity(c.max,'MPa',3)+'</b><span>'+esc(field.label)+' · '+esc(field.basis)+(field.kind==='critical'?' · จุดคุมหน้าตัด':' · ระยะ '+field.peak.x.toFixed(2)+' m')+'</span></div><small>'+esc(note)+'</small></div>';
}
/** Additive overlay. Does not change/copy capacity checks or mutate source materials. */
export function mountStressOverlay(THREE,parent,s,{xShift=0,yShift=0}={}){
  const group=new THREE.Group();group.name='accepted-bending-contour';group.visible=false;parent.add(group);
  const c=stressContourFor(s),mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  const parts=contourParts(s),surfaces=plotSurfaces(parts,{max:c.max,visibleOnly:false}).surfaces;
  for(const p of parts){
    const origin=p.position||[0,0,0],positions=[],colors=[],dim=['x','y','z'].indexOf(p.axis);
    // Use the same exact station/strip surfaces as paper, including back faces
    // needed for orbit. No internal subdivision caps or distorted member sizes.
    for(const face of surfaces.filter(f=>f.part===p)){
      const constant=p.field?.kind!=='stations',mid=(face.qMin+face.qMax)/2;
      for(let k=1;k<face.pts.length-1;k++)for(const v of [face.pts[0],face.pts[k],face.pts[k+1]]){
        const x=constant?mid:p.reverse?p.origin-v[dim]:v[dim]+p.origin;
        const rgb=new THREE.Color(p.field?contourColor(sampleContour(p.field,x),c.max):'#aebbc6');
        positions.push(v[0]-origin[0],v[1]-origin[1],v[2]-origin[2]);colors.push(rgb.r,rgb.g,rgb.b);
      }
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(origin[0]+xShift,origin[1]+yShift,origin[2]);mesh.userData.contourKey=p.key;mesh.userData.contourKnown=!!p.field;
    mesh.raycast=()=>{}; // Display overlay must not intercept native component selection.
    group.add(mesh);
  }
  return {setVisible:v=>group.visible=!!v,setRebar(v){mat.transparent=!!v;mat.opacity=v?.28:1;mat.depthWrite=!v;mat.needsUpdate=true;},group,projection:c,dispose(){group.children.forEach(m=>m.geometry.dispose());mat.dispose();parent.remove(group);}};
}
export function contourSvg(s,mode='si',{height=300,detail=false}={}){
  const c=stressContourFor(s);
  if(detail&&['pile','pilecf'].includes(c.type)){
    const parts=contourParts(s),plot=(ps,width,markPeak,name)=>renderContourPlot(c,ps,{height,width,markPeak,sample:sampleContour,color:contourColor}).replace('<svg ','<svg data-contour-view="'+name+'" ');
    return '<div class="rw-contour-views"><figure>'+plot(parts,240,false,'overall')+'<figcaption>โมเดลรวม · รูปทรงและระยะเข็ม</figcaption></figure><figure>'+plot(parts.filter(p=>p.key!=='unknown-foundation-pile'),480,true,'detail')+'<figcaption>พนังและฐาน · ขยาย · ใช้สเกลสีเดียวกัน</figcaption></figure></div>'+contourLegend(s,mode,{marker:true});
  }
  return renderContourPlot(c,contourParts(s),{height,sample:sampleContour,color:contourColor})+contourLegend(s,mode,{marker:true});
}
