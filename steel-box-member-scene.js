/* Input-only physical scene. This module never consumes a PASS/FAIL result. */
(function(root){
  'use strict';
  const G=root.NCYCAD.geometry,V=root.NCYCAD.math.V,A=root.NCYSC01MemberAnalysis;
  function tube(a,b,r){
    const g={p:[],n:[]},d=V.unit(V.sub(b,a)),u=V.unit(V.cross(d,Math.abs(d[1])<0.9?[0,1,0]:[1,0,0])),v=V.cross(d,u);
    const offset=t=>V.mul(V.add(V.mul(u,Math.cos(t)),V.mul(v,Math.sin(t))),r);
    for(let i=0;i<12;i++){
      const ra=offset(i*Math.PI/6),rb=offset((i+1)*Math.PI/6),p=[V.add(a,ra),V.add(a,rb),V.add(b,rb),V.add(b,ra)],n=V.unit(V.add(ra,rb));
      for(const j of [0,1,2,0,2,3]){g.p.push(...p[j]);g.n.push(...n);}
    }
    return g;
  }
  function geometry(d,{roof=true}={}){
    const errors=A.validate(d,{geometryOnly:true});if(errors.length)throw Error(errors[0].message);
    const grid=A.layout(d),W=d.geometry.widthM*1000,L=d.geometry.projectionM*1000,s=d.steel,p=d.purlin;
    const meshes=[],add=(g,id,kind,color,alpha=1)=>meshes.push({g,id,kind,color,alpha,metal:0.35});
    const pw=s.B+d.plate.allowanceMM,ph=s.H+d.plate.allowanceMM,face=d.plate.thicknessMM;
    const anchorFits=d.plate.allowanceMM/4>=d.plate.anchorMM/2+2;
    if(d.support.type==='hbeam'){
      const top=-s.H/2+Math.max(300,ph+60)/2,bottom=-s.H/2-Math.max(300,ph+60)/2;
      add(G.box(-W/2-120,W/2+120,bottom-20,bottom,-110,90),'support-flange-bottom','support',[0.44,0.48,0.51]);
      add(G.box(-W/2-120,W/2+120,top,top+20,-110,90),'support-flange-top','support',[0.44,0.48,0.51]);
      add(G.box(-W/2-120,W/2+120,bottom,top,-12,0),'support-web','support',[0.44,0.48,0.51]);
    }else{
      add(G.box(-W/2-150,W/2+150,d.support.type==='concrete-wall'?-650:-250,d.support.type==='concrete-wall'&&d.cable.enabled?d.cable.heightM*1000-s.H/2+100:150,-220,0),'support','concrete',[0.71,0.73,0.75],0.6);
    }
    for(let i=0;i<grid.frames;i++){
      const x=-W/2+i*grid.frameSpacingM*1000;
      add(G.hss(s.B,s.H,s.t,L,[x,-s.H/2,face]),'main-'+i,'steel',[0.3,0.39,0.45]);
      add(G.box(x-pw/2,x+pw/2,-s.H/2-ph/2,-s.H/2+ph/2,0,face),'plate-'+i,'plate',[0.2,0.42,0.62]);
      if(d.support.type!=='hbeam'&&anchorFits)for(const signX of [-1,1])for(const signY of [-1,1]){
        const ax=x+signX*(s.B/2+d.plate.allowanceMM/4),ay=-s.H/2+signY*(s.H/2+d.plate.allowanceMM/4);
        add(tube([ax,ay,-70],[ax,ay,face+8],d.plate.anchorMM/2),'anchor-'+i+'-'+signX+'-'+signY,'anchor',[0.66,0.56,0.39]);
      }
      if(d.cable.enabled){
        const upper=d.cable.heightM*1000-s.H/2;
        add(tube([x,upper,face],[x,-s.H/2,L+face],d.cable.diameterMM/2),'cable-'+i,'cable',[0.64,0.45,0.16]);
        add(G.box(x-25,x+25,upper-25,upper+25,face-10,face),'cable-point-'+i,'support',[0.44,0.48,0.51]);
      }
    }
    if(d.cable.enabled&&d.support.type!=='concrete-wall')add(G.box(-W/2-80,W/2+80,d.cable.heightM*1000-s.H/2-18,d.cable.heightM*1000-s.H/2+18,-40,0),'upper-fixed-support','support',[0.59,0.63,0.66],0.6);
    for(let i=0;i<grid.purlins;i++)add(root.NCYSC01Purlins.geometry(p.B,p.H,p.t,W,[-W/2,p.H/2,face+i*grid.purlinSpacingM*1000]),'purlin-'+i,'purlin',[0.38,0.5,0.6]);
    if(roof)add(G.box(-W/2,W/2,p.H+2,p.H+5,face,face+L),'roof','roof',[0.64,0.77,0.82],0.46);
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const m of meshes)for(let i=0;i<m.g.p.length;i++){const a=i%3;bounds.min[a]=Math.min(bounds.min[a],m.g.p[i]);bounds.max[a]=Math.max(bounds.max[a],m.g.p[i]);}
    return {meshes,bounds,grid,plate:{widthMM:pw,heightMM:ph,thicknessMM:face,anchorFits},dims:[
      {a:[-W/2,-s.H-60,L+100],b:[W/2,-s.H-60,L+100],text:`Span ${d.geometry.widthM} m`},
      {a:[W/2+100,0,face],b:[W/2+100,0,L+face],text:`ยื่น ${d.geometry.projectionM} m`} ]};
  }
  class Scene {
    constructor(canvas,overlay){
      this.viewer=new root.NCYCAD.Viewer(canvas,overlay);Object.assign(this.viewer,{data:null,showDims:true,xray:false,selected:null});
      this.resize=new ResizeObserver(()=>{
        const rect=canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);
        if(this.aspect&&Math.abs(aspect/this.aspect-1)>0.1&&this.viewer.bounds)this.fitCurrent();
        this.aspect=aspect;
      });this.resize.observe(canvas.parentElement);
    }
    update(d,options){const data=geometry(d,options),v=this.viewer,key=A.stable([d.geometry.widthM,d.geometry.projectionM,d.support.type,d.cable.enabled,d.cable.heightM]);v.clear();for(const m of data.meshes)v.add(m.g,m.id,m.kind,m.color,m.alpha,m.metal);v.bounds=data.bounds;v.dims=data.dims;if(this.frameKey!==key){v.fit();this.frameKey=key;}v.draw();this.data=data;return data;}
    fit(view='iso'){this.viewer.fit(view);this.viewer.draw();}
    fitCurrent(){
      const v=this.viewer,b=v.bounds;v.target=V.mul(V.add(b.min,b.max),0.5);v.zoom=1;v.pan=[0,0];
      const dir=[Math.sin(v.az)*Math.cos(v.el),Math.sin(v.el),Math.cos(v.az)*Math.cos(v.el)],right=V.unit(V.cross([0,1,0],dir)),up=V.cross(dir,right),extent=[0,0];
      for(const x of [b.min[0],b.max[0]])for(const y of [b.min[1],b.max[1]])for(const z of [b.min[2],b.max[2]]){
        const p=V.sub([x,y,z],v.target);extent[0]=Math.max(extent[0],Math.abs(V.dot(p,right)));extent[1]=Math.max(extent[1],Math.abs(V.dot(p,up)));
      }
      const rect=v.canvas.getBoundingClientRect(),aspect=rect.width/Math.max(1,rect.height);v.span=2.4*Math.max(extent[0]/aspect,extent[1],1);v.draw();
    }
    zoom(by){this.viewer.zoom=Math.max(0.2,Math.min(6,this.viewer.zoom*by));this.viewer.draw();}
  }
  root.NCYSC01MemberScene=Object.freeze({geometry,Scene});
})(typeof window==='undefined'?globalThis:window);
