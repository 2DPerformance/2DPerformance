/* Scoped AISC 360-22 rectangular HSS: E3/E7, F7 and retained G4/H1 checks.
 * Source/units and independent fixtures: SC01_R35_TRUSS_LOAD_VIEWS_20260909.md. */
(function(root){
  'use strict';
  const E=200000,source='https://vpn2.modernsteel.com/globalassets/product-files-not-searched/publications/standards/a360-22w.pdf';
  function effectiveArea(p,Fy,Fn){
    const lr=1.4*Math.sqrt(E/Fy),c1=.20,c2=(1-Math.sqrt(1-4*c1))/(2*c1);
    const walls=[p.B-3*p.t,p.H-3*p.t].map(b=>{
      b=Math.max(p.t,b);const lambda=b/p.t,Fel=(c2*lr/lambda)**2*Fy;
      const z=Math.sqrt(Fel/Fn),be=lambda<=lr*Math.sqrt(Fy/Fn)?b:Math.max(0,Math.min(b,b*(1-c1*z)*z));
      return {b,be,lambda,Fel};
    });
    return {Ae:p.A-2*p.t*walls.reduce((sum,w)=>sum+w.b-w.be,0),walls,c1,c2,clause:'E7-1…5'};
  }
  function axial(s,p,profile){
    const native=root.NCYEngine.memberPrimitives.axialCapacity(s,p,profile);
    for(const key of ['compX','compY']){const c=native[key],area=effectiveArea(p,s.member.Fy,c.Fcr);Object.assign(c,area,{phiPn:profile.phiC*c.Fcr*area.Ae/1000});}
    return {...native,source};
  }
  function hss(s,p,profile){
    const native=root.NCYEngine.hssStrength(s,p,profile),Fy=s.member.Fy,rt=Math.sqrt(E/Fy),Lb=s.member.lengthM*1000;
    function axis(H,B,I,S,Z,ry){
      const b=Math.max(p.t,B-3*p.t),h=Math.max(p.t,H-3*p.t),lf=b/p.t,lw=h/p.t;
      const Mp=Fy*Z,My=Fy*S,lp=1.12*rt,lr=1.4*rt,lpw=2.42*rt,lrw=5.7*rt;
      let flange=Mp,Se=S,be=b;
      if(lf>lr){
        be=Math.max(0,Math.min(b,1.92*p.t*rt*(1-.38*rt/lf)));
        const loss=(b-be)*p.t,y=(H-p.t)/2,Ae=p.A-loss,centroid=-loss*y/Ae;
        const Ie=I-loss*(p.t*p.t/12+y*y)-Ae*centroid*centroid;
        Se=Ie/(H/2-centroid);flange=Fy*Se;
      }else if(lf>lp)flange=Mp-(Mp-My)*(lf-lp)/(lr-lp);
      let web=Mp,Rpg=1;
      if(lw>lrw){const aw=Math.min(10,2*h/b);Rpg=Math.max(0,Math.min(1,1-aw/(1200+300*aw)*(lw-lrw)));web=Rpg*My;}
      else if(lw>lpw)web=Mp-(Mp-My)*(lw-lpw)/(lrw-lpw);
      // Closed thin-wall Bredt torsional constant, using the same square-corner
      // section idealization as the retained A/I properties. Cb=1 is conservative.
      const J=2*p.t*(B-p.t)**2*(H-p.t)**2/(B+H-2*p.t),rootJA=Math.sqrt(J*p.A);
      const Lp=.13*E*ry*rootJA/Mp,Lr=2*E*ry*rootJA/(.7*My);
      let ltb=Mp;if(H>B&&Lb>Lp)ltb=Lb<=Lr?Mp-(Mp-.7*My)*(Lb-Lp)/(Lr-Lp):2*E*rootJA*ry/Lb;
      const Mn=Math.min(Mp,flange,web,ltb),outside=lw>lrw&&lf>lr;
      return {phiMn:profile.phiB*Mn/1e6,Mn:Mn/1e6,Mp:Mp/1e6,flange:{phiMn:profile.phiB*flange/1e6,outside:false},web:{phiMn:profile.phiB*web/1e6,outside},
        Se,be,Rpg,J,Lp,Lr,Lb,ltb:ltb/1e6,outside,clause:outside?'F7: slender flange and slender web not addressed':'F7-1…7,10…13'};
    }
    const x=axis(p.H,p.B,p.Ix,p.Sx,p.Zx,p.ry),y=axis(p.B,p.H,p.Iy,p.Sy,p.Zy,p.rx);
    return {...native,x,y,phiMnx:x.phiMn,phiMny:y.phiMn,outside:x.outside||y.outside,source};
  }
  root.NCYSC01SteelDesign=Object.freeze({VERSION:'r35.1',source,effectiveArea,axial,hss});
})(typeof window==='undefined'?globalThis:window);
