/* SC01 R44: ACI 318-19 Ch.17, ESR-3814. Units N/mm/MPa internally;
 * result forces kN. See SC01_R44_CONCRETE_METHODS_20260913.md.
 * The caller supplies actual anchor forces and fixed concrete boundaries.
 * This module cannot qualify a product or a plate load-distribution method. */
(function(root){
  'use strict';
  const VERSION='r44',sum=(a,f=x=>x)=>a.reduce((v,x)=>v+f(x),0),finite=Number.isFinite;
  const state=r=>!finite(r)?'incomplete':r>1+1e-9?'fail':r>.8?'warn':'ok';
  const result=(demand,design,extra={})=>{const ratio=design>0?demand/design:demand===0?0:NaN;return {demand,design,ratio,state:state(ratio),methodReview:false,...extra};};
  const empty=()=>result(0,0,{nominal:0,note:'ไม่มีแรงที่ต้องตรวจในกรณีนี้'});
  function bounds(s,anchors){return {xmin:Math.min(...anchors.map(a=>a.x))-s.concrete.edgeLeft,xmax:Math.max(...anchors.map(a=>a.x))+s.concrete.edgeRight,
    ymin:Math.min(...anchors.map(a=>a.y))-s.concrete.edgeBottom,ymax:Math.max(...anchors.map(a=>a.y))+s.concrete.edgeTop};}
  function edgeDistances(anchors,b){return [Math.min(...anchors.map(a=>a.x))-b.xmin,b.xmax-Math.max(...anchors.map(a=>a.x)),
    Math.min(...anchors.map(a=>a.y))-b.ymin,b.ymax-Math.max(...anchors.map(a=>a.y))];}
  function unionArea(rects){
    const xs=[...new Set(rects.flatMap(r=>[r[0],r[1]]))].sort((a,b)=>a-b);let area=0;
    for(let i=1;i<xs.length;i++){
      const x=(xs[i]+xs[i-1])/2,ys=rects.filter(r=>r[0]<x&&r[1]>x).map(r=>[r[2],r[3]]).sort((a,b)=>a[0]-b[0]);
      let end=-Infinity,height=0;for(const [a,b]of ys){height+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}area+=(xs[i]-xs[i-1])*height;
    }return area;
  }
  function projection(anchors,r,b){return unionArea(anchors.map(a=>[Math.max(b.xmin,a.x-r),Math.min(b.xmax,a.x+r),Math.max(b.ymin,a.y-r),Math.min(b.ymax,a.y+r)]).filter(q=>q[1]>q[0]&&q[3]>q[2]));}
  function eccentricity(anchors){
    const demand=sum(anchors,a=>a.T),cx=sum(anchors,a=>a.x)/anchors.length,cy=sum(anchors,a=>a.y)/anchors.length;
    return {ex:Math.abs(sum(anchors,a=>a.T*a.x)/demand-cx),ey:Math.abs(sum(anchors,a=>a.T*a.y)/demand-cy)};
  }
  // Rectangular subsets cover the program's rectangular arrays, including
  // isolated anchors, each row/column, overlapping clusters and the full group.
  // Zero-force anchors are omitted, but no percentage-of-maximum cutoff exists.
  function subsets(anchors){
    const xs=[...new Set(anchors.map(a=>a.x))].sort((a,b)=>a-b),ys=[...new Set(anchors.map(a=>a.y))].sort((a,b)=>a-b),out=[],seen=new Set();
    for(let i=0;i<xs.length;i++)for(let j=i;j<xs.length;j++)for(let k=0;k<ys.length;k++)for(let l=k;l<ys.length;l++){
      const q=anchors.filter(a=>a.x>=xs[i]&&a.x<=xs[j]&&a.y>=ys[k]&&a.y<=ys[l]),key=q.map(a=>a.id).join('|');
      if(q.length&&!seen.has(key)){seen.add(key);out.push(q);}
    }return out;
  }
  function splitGroups(anchors,reach){
    const remaining=new Set(anchors),out=[];
    while(remaining.size){const group=[remaining.values().next().value];remaining.delete(group[0]);
      for(let i=0;i<group.length;i++)for(const a of remaining)if(Math.abs(a.x-group[i].x)<2*reach&&Math.abs(a.y-group[i].y)<2*reach){remaining.delete(a);group.push(a);}
      out.push(group);
    }return out;
  }
  const governing=checks=>checks.reduce((a,b)=>!a||!finite(b.ratio)||b.ratio>a.ratio?b:a,null)||empty();
  function tensionOne(s,p,anchors,b){
    const edges=edgeDistances(anchors,b),influencing=edges.filter(c=>c<1.5*s.anchors.hef),span=Math.max(...anchors.flatMap(a=>anchors.map(c=>Math.hypot(a.x-c.x,a.y-c.y))));
    const hef=influencing.length>=3?Math.min(s.anchors.hef,Math.max(Math.max(...influencing)/1.5,span/3)):s.anchors.hef;
    const r=1.5*hef,ANco=9*hef**2,ANc=Math.min(projection(anchors,r,b),anchors.length*ANco),cmin=Math.min(...edges),{ex,ey}=eccentricity(anchors);
    const psiEd=Math.min(1,.7+.3*cmin/r),psiEc=1/(1+ex/r)/(1+ey/r),cac=s.product.cac;
    const psiCp=s.concrete.cracked||!(cac>0)?1:Math.min(1,Math.max(cmin,r)/cac);
    const kc=s.concrete.cracked?s.product.kcCr:s.product.kcUncr,Nb=kc*s.concrete.lambda*Math.sqrt(s.concrete.fc)*hef**1.5/1000;
    const nominal=ANc/ANco*psiEd*psiEc*psiCp*Nb;
    return result(sum(anchors,a=>a.T),p.phiConcreteT*nominal,{nominal,Ncb:nominal,Nb,ANc,ANco,hef,cmin,ex,ey,psiEd,psiEc,psiCp,loaded:anchors,
      methodSource:'ACI 318-19 17.6.2; ESR-3814 4.1.3',note:`φNcb ${ (p.phiConcreteT*nominal).toFixed(3)} kN; ANc/ANco ${(ANc/ANco).toFixed(3)}; hef,calc ${hef.toFixed(1)} mm; ψec ${psiEc.toFixed(3)}`});
  }
  function bondOne(s,anchors,b){
    const tau=s.concrete.cracked?s.product.tauCr:s.product.tauUncr,cNa=10*s.anchors.diameter*Math.sqrt(s.product.tauUncr/7.6),ANa0=4*cNa*cNa;
    const ANa=Math.min(projection(anchors,cNa,b),anchors.length*ANa0),cmin=Math.min(...edgeDistances(anchors,b)),{ex,ey}=eccentricity(anchors),cac=s.product.cac;
    const psiEd=Math.min(1,.7+.3*cmin/cNa),psiEc=1/(1+ex/cNa)/(1+ey/cNa),psiCp=s.concrete.cracked||!(cac>0)?1:Math.min(1,Math.max(cmin,cNa)/cac);
    const Nba=tau*Math.PI*s.anchors.diameter*s.anchors.hef/1000,nominal=ANa/ANa0*psiEd*psiEc*psiCp*Nba;
    return result(sum(anchors,a=>a.T),s.product.phiBond*nominal,{nominal,Nag:nominal,Nba,cNa,ANa,ANa0,tau,cmin,ex,ey,psiEd,psiEc,psiCp,loaded:anchors,
      methodSource:'ACI 318-19 17.6.5; ESR-3814 4.1.4',note:`φNag ${(s.product.phiBond*nominal).toFixed(3)} kN; cNa ${cNa.toFixed(1)} mm; τ ${tau.toFixed(2)} MPa; ψec ${psiEc.toFixed(3)}`});
  }
  function tension(s,p,group){
    const loaded=group.forces.filter(a=>a.T>0),b=bounds(s,group.forces);
    const checks=splitGroups(loaded,1.5*s.anchors.hef).flatMap(g=>subsets(g).map(q=>tensionOne(s,p,q,b)));
    return {...governing(checks),alternatives:checks};
  }
  function bond(s,group){
    const loaded=group.forces.filter(a=>a.T>0),b=bounds(s,group.forces),r=10*s.anchors.diameter*Math.sqrt(s.product.tauUncr/7.6);
    const checks=splitGroups(loaded,r).flatMap(g=>subsets(g).map(q=>bondOne(s,q,b)));
    return {...governing(checks),alternatives:checks};
  }
  function shearFace(s,p,anchors,b,dir){
    const vertical=dir==='bottom'||dir==='top',axis=vertical?'x':'y',normal=vertical?'Vy':'Vx',parallel=vertical?'Vx':'Vy',sign=dir==='bottom'||dir==='left'?-1:1;
    const perpendicular=sum(anchors,a=>Math.max(0,sign*a[normal])),along=sum(anchors,a=>Math.abs(a[parallel]));
    if(perpendicular===0&&along===0)return {...empty(),direction:dir};
    const distances=anchors.map(a=>dir==='bottom'?a.y-b.ymin:dir==='top'?b.ymax-a.y:dir==='left'?a.x-b.xmin:b.xmax-a.x);
    const actualC1=Math.min(...distances),lo=vertical?b.xmin:b.ymin,hi=vertical?b.xmax:b.ymax;
    const positions=anchors.map(a=>a[axis]),c2a=Math.min(...positions)-lo,c2b=hi-Math.max(...positions),h=s.concrete.thickness,span=Math.max(...positions)-Math.min(...positions);
    const c1=c2a<1.5*actualC1&&c2b<1.5*actualC1&&h<1.5*actualC1?Math.min(actualC1,Math.max(c2a/1.5,c2b/1.5,h/1.5,span/3)):actualC1;
    const reach=1.5*c1,AVco=4.5*c1*c1,depth=Math.min(h,reach),AVc=unionArea(positions.map(t=>[Math.max(lo,t-reach),Math.min(hi,t+reach),0,depth]));
    // Conservatively assign every active row's shear to the front critical
    // row. Rear rows do not enlarge the side-face projection or its capacity.
    const le=Math.min(s.anchors.hef,8*s.anchors.diameter),Vb=Math.min(.6*(le/s.anchors.diameter)**.2*Math.sqrt(s.anchors.diameter),3.7)*s.concrete.lambda*Math.sqrt(s.concrete.fc)*c1**1.5/1000;
    const centroid=sum(positions)/positions.length;
    const e=perpendicular?Math.abs(sum(anchors,a=>a[axis]*Math.max(0,sign*a[normal]))/perpendicular-centroid):0;
    const parallelE=along?Math.abs(sum(anchors,a=>a[axis]*Math.abs(a[parallel]))/along-centroid):0;
    const psiEc=1/(1+e/reach),parallelPsiEc=1/(1+parallelE/reach),psiEd=Math.min(1,.7+.3*Math.min(c2a,c2b)/reach),psiC=s.concrete.cracked?1:1.4,psiH=Math.max(1,Math.sqrt(reach/h));
    const nominal=AVc/AVco*psiEc*psiEd*psiC*psiH*Vb,parallelNominal=2*AVc/AVco*parallelPsiEc*psiC*psiH*Vb,design=p.phiConcreteV*nominal;
    // Linear combination of directional utilizations is a conservative bound
    // on the oblique resultant; §17.7.2.1(c) permits 2x, psiEd=1 parallel.
    const ratio=perpendicular/design+along/(p.phiConcreteV*parallelNominal);
    return result(perpendicular+along,design,{ratio,state:state(ratio),nominal,Vcb:nominal,Vb,AVc,AVco,depth,c1,actualC1,le,psiEc,psiEd,psiC,psiH,perpendicular,parallel:along,parallelDesign:p.phiConcreteV*parallelNominal,direction:dir,loaded:anchors,
      methodSource:'ACI 318-19 17.7.2; conservative front-row assignment',note:`${dir}; AVc ${AVc.toFixed(0)} mm² บนหน้าขอบคอนกรีต; ลึก ${depth.toFixed(1)} mm; φVcb ${design.toFixed(3)} kN; D/C ${ratio.toFixed(3)}`});
  }
  function shear(s,p,group){
    const loaded=group.forces.filter(a=>a.V>0),b=bounds(s,group.forces),checks=[];
    for(const a of subsets(loaded))for(const dir of ['bottom','top','left','right'])checks.push(shearFace(s,p,a,b,dir));
    return {...governing(checks),all:checks};
  }
  function pryout(s,p,group){
    const loaded=group.forces.filter(a=>a.V>0).map(a=>({...a,T:a.V})),b=bounds(s,group.forces),checks=[];
    for(const a of subsets(loaded)){
      const nb=tensionOne(s,p,a,b),na=bondOne(s,a,b),nominal=s.product.kcp*Math.min(nb.nominal,na.nominal);
      checks.push(result(sum(a,x=>x.V),p.phiConcreteV*nominal,{nominal,Ncb:nb.nominal,Nag:na.nominal,kcp:s.product.kcp,loaded:a,
        methodSource:'ACI 318-19 17.7.3.1.1–2',note:`φVcp = φ × ${s.product.kcp} × min(Ncb ${nb.nominal.toFixed(3)}, Nag ${na.nominal.toFixed(3)}) = ${(p.phiConcreteV*nominal).toFixed(3)} kN`}));
    }return {...governing(checks),alternatives:checks};
  }
  function interaction(nr,vr){return Math.max(nr,vr,nr>.2&&vr>.2?(nr+vr)/1.2:0);}
  function calculate(s,p,group){
    const breakoutT=tension(s,p,group),adhesive=bond(s,group),breakoutV=shear(s,p,group),pry=pryout(s,p,group);
    const steelN=Math.max(0,...group.forces.map(a=>a.T/s.product.NsaDesign)),steelV=Math.max(0,...group.forces.map(a=>a.V/s.product.VsaDesign));
    const nr=Math.max(breakoutT.ratio,adhesive.ratio,steelN),vr=Math.max(breakoutV.ratio,pry.ratio,steelV),ratio=interaction(nr,vr);
    return {breakoutT,bond:adhesive,breakoutV,pryout:pry,concreteInteraction:{ratio,state:state(ratio),nr,vr,methodReview:false,
      methodSource:'ACI 318-19 17.8.1–3; governing steel/concrete/bond capacities',note:`N/φNn ${nr.toFixed(3)}; V/φVn ${vr.toFixed(3)}; ปฏิสัมพันธ์ ${ratio.toFixed(3)} (ตรวจแยกแต่ละกรณีแรง)`}};
  }
  root.NCYSC01ConcreteMethods=Object.freeze({VERSION,bounds,unionArea,projection,eccentricity,subsets,tensionOne,bondOne,tension,bond,shearFace,shear,pryout,interaction,calculate});
})(typeof window==='undefined'?globalThis:window);
