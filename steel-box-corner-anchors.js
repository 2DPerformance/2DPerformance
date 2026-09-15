/* SC01 R47: static symmetric HSS-to-concrete plates.
 * STI (Manor, Sep 2024), Figure 4: straight and corner bending planes.
 * DG1 4.3.2: 45-degree effective widths and a consistent local weld path.
 * Elastic yield is retained; no plastic, hole-width or membrane enhancement. */
(function(root){
  'use strict';
  const SOURCE='https://steeltubeinstitute.org/resources/hss-base-plate-design-for-axial-compression-and-bending-moment/';
  const finite=Number.isFinite,state=r=>!finite(r)?'incomplete':r>1+1e-9?'fail':r>.8?'warn':'ok';
  function clippedWidth(q,tangent,lever,box){
    let lo=-lever,hi=lever;
    for(const [axis,min,max] of [['x',box.xmin,box.xmax],['y',box.ymin,box.ymax]]){
      const v=tangent[axis];if(Math.abs(v)<1e-12){if(q[axis]<min-1e-9||q[axis]>max+1e-9)return 0;continue;}
      const a=(min-q[axis])/v,b=(max-q[axis])/v;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
    }
    return Math.max(0,hi-lo);
  }
  function cornerPlane(a,g){
    const sx=Math.sign(a.u),sy=Math.sign(a.v),normal={x:sx/Math.SQRT2,y:sy/Math.SQRT2};
    const corner={x:sx*.95*g.B/2,y:sy*.95*g.D/2};
    const lever=(a.u-corner.x)*normal.x+(a.v-corner.y)*normal.y;
    const projection={x:a.u-lever*normal.x,y:a.v-lever*normal.y},tangent={x:-normal.y,y:normal.x};
    const box={xmin:sx>0?0:-g.W/2,xmax:sx>0?g.W/2:0,ymin:sy>0?0:-g.H/2,ymax:sy>0?g.H/2:0};
    const be=lever>0?clippedWidth(projection,tangent,lever,box):0;
    return {mode:'corner-45',lever,be,corner,projection,normal};
  }
  function tension(s,n){
    const g=n.layout,strips=[];
    for(const a of n.group.forces){
      const modes=[];
      for(const [axis,along,across,span,face,stations]of [['x',a.u,a.v,g.H,g.B,g.vs],['y',a.v,a.u,g.W,g.D,g.us]]){
        const lever=Math.abs(along)-.95*face/2;if(lever<=0)continue;
        const index=stations.indexOf(across),lo=index===0?-span/2:(across+stations[index-1])/2,hi=index===stations.length-1?span/2:(across+stations[index+1])/2;
        const be=Math.max(0,Math.min(hi,across+lever)-Math.max(lo,across-lever));modes.push({mode:'straight-'+axis,lever,be});
      }
      if(g.corner)modes.push(cornerPlane(a,g));
      for(const m of modes)m.moment=m.be>0?a.T*1000*m.lever/m.be:Infinity;
      const governing=modes.reduce((x,y)=>!x||y.moment>x.moment?y:x,null);
      strips.push({id:a.id,T:a.T,...(governing||{mode:'outside',lever:NaN,be:0,moment:Infinity}),modes});
    }
    return {strips,tensionMoment:Math.max(...strips.map(q=>q.moment)),source:SOURCE};
  }
  function weld(s,p,action,n){
    const g=n.layout,t=g.t,throat=.707*s.weld.size,cap=p.phiWeld*.6*s.weld.Fexx;
    const flatB=g.B-2*t,flatD=g.D-2*t,run=Math.max(g.B,g.D)/s.weld.size,beta=run<=100?1:run<=300?1.2-.002*run:180/run;
    const factor=s.weld.effectiveLengthFactor*beta;
    // Bound each corner's entire force by one adjacent half-face. These
    // effective segments cannot overlap; rounded-corner weld length adds no
    // capacity. New layouts contain exactly four corner anchors.
    const local=n.group.forces.map(a=>{
      const strip=n.plate.strips.find(q=>q.id===a.id),width=Math.min(strip.be/Math.SQRT2,flatB/2,flatD/2);
      const length=width*factor,qn=length>0?a.T*1000/length:Infinity,qv=length>0?a.V*1000/length:Infinity;
      const stress=Math.hypot(qn,qv)/throat,baseNormal=Math.min(p.phiPlateY*s.member.Fy,p.phiPlateR*s.member.Fu)*t,baseShear=Math.min(p.phiPlateY*.6*s.member.Fy,p.phiPlateR*.6*s.member.Fu)*t;
      return {id:a.id,length,qn,qv,stress,baseRatio:qn/baseNormal+qv/baseShear,ratio:Math.max(stress/cap,qn/baseNormal+qv/baseShear)};
    });
    const developmentRatio=s.member.Fy*t/(throat*cap*factor),ratio=Math.max(developmentRatio,...local.map(q=>q.ratio));
    return {method:'outside-hss',source:SOURCE,ratio,state:state(ratio),local,developmentRatio,wallYieldPerMM:s.member.Fy*t,weldCapacityPerMM:throat*cap*factor,
      length:Math.min(...local.map(q=>q.length)),stress:Math.max(...local.map(q=>q.stress)),cap,
      faceForces:[Math.abs(action.N*1000/2+action.Mx*1e6/(g.D-t)),Math.abs(action.N*1000/2-action.Mx*1e6/(g.D-t))],
      methodSource:'DG1 4.3.2/4.4 consistent local weld path; AISC J2/J4; weld develops HSS wall',
      note:`เชื่อมรอบรวมมุม; Leff เฉพาะที่ ${Math.min(...local.map(q=>q.length)).toFixed(1)} mm/พุก; ตรวจพัฒนาแรงครากผนัง HSS ${developmentRatio.toFixed(3)}; D/C ${ratio.toFixed(3)}`};
  }
  root.NCYSC01CornerAnchors=Object.freeze({VERSION:'r47',SOURCE,clippedWidth,cornerPlane,tension,weld});
})(typeof window==='undefined'?globalThis:window);
