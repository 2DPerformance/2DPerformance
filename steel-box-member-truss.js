/* Pin-jointed roof trusses, actual purlin reactions, local loaded-bar bending.
 * N/mm/MPa internally. Corotational equilibrium includes global geometric stiffness.
 * Rigid roots; no roof-sheet lateral restraint is assumed. See R35 model contract. */
(function(root){
  'use strict';
  const E=200000,types=Object.freeze({tri_tapered:'Truss 3 เหลี่ยมตีบ',tri_parallel:'Truss 3 เหลี่ยมลึก / คอร์ดขนาน',box_rect:'Truss สี่เหลี่ยมยื่น',warren:'Warren Truss',pratt:'Pratt Truss',howe:'Howe Truss'});
  const maxBy=(xs,fn)=>xs.reduce((a,b)=>!a||fn(b)>fn(a)?b:a,null),zeros=n=>Array.from({length:n},()=>Array(n).fill(0));
  function geometry(d){
    const t=d.truss,L=d.geometry.projectionM*1000,n=t.panels,nodes=[],top=[],bottom=[],members=[];
    const props=s=>root.NCYEngine.rhsProps({H:s.H,B:s.B,tNom:s.t,designThicknessFactor:d.steel.thicknessFactor});
    for(let i=0;i<=n;i++){
      const x=L*i/n,depth=t.type==='tri_tapered'?t.depthMM+(t.tipDepthMM-t.depthMM)*i/n:t.depthMM;
      top.push(nodes.length);nodes.push({id:'T'+i,x,y:0});bottom.push(nodes.length);nodes.push({id:'B'+i,x,y:-depth});
    }
    const add=(a,b,kind,id)=>{const s=kind==='chord'?d.steel:d.web,p=props(s),na=nodes[a],nb=nodes[b],length=Math.hypot(nb.x-na.x,nb.y-na.y);
      const nominal=root.NCYEngine.rhsProps({H:s.H,B:s.B,tNom:s.t,designThicknessFactor:1});
      members.push({id,a,b,kind,section:{...s},props:p,A:p.A,EA:E*p.A,length,c:(nb.x-na.x)/length,sn:(nb.y-na.y)/length,weightKNm:nominal.weightKNm});};
    for(let i=0;i<n;i++){add(top[i],top[i+1],'chord','TC'+(i+1));add(bottom[i],bottom[i+1],'chord','BC'+(i+1));}
    for(let i=0;i<=n;i++)add(top[i],bottom[i],'web','V'+i);
    for(let i=0;i<n;i++){
      // Retain the native V6.3 template connectivity and stable member IDs.
      const forward=t.type==='pratt'?i<=(n-1)/2:t.type==='howe'?i>(n-1)/2:i%2===0;
      add(forward?top[i]:bottom[i],forward?bottom[i+1]:top[i+1],'web','D'+(i+1));
    }
    return {L,n,nodes,top,bottom,members,totalWeightKN:members.reduce((v,m)=>v+m.weightKNm*m.length/1000,0),type:t.type,depthMM:t.depthMM};
  }
  // Cholesky also checks positive tangent stiffness; a pivoted algebraic solution
  // to a non-positive matrix must not be accepted as stable elastic equilibrium.
  function solveSPD(K,F){
    const n=F.length,L=zeros(n),scale=Math.max(1,...K.map((r,i)=>Math.abs(r[i])));
    for(let i=0;i<n;i++)for(let j=0;j<=i;j++){
      let q=K[i][j];for(let k=0;k<j;k++)q-=L[i][k]*L[j][k];
      if(i===j){if(!(q>scale*1e-12))throw Error('โครงสูญเสียเสถียรภาพ: เพิ่มหน้าตัด/ความลึก หรือตรวจรูปแบบค้ำ');L[i][j]=Math.sqrt(q);}else L[i][j]=q/L[j][j];
    }
    const y=Array(n).fill(0),x=Array(n).fill(0);
    for(let i=0;i<n;i++){y[i]=F[i];for(let j=0;j<i;j++)y[i]-=L[i][j]*y[j];y[i]/=L[i][i];}
    for(let i=n-1;i>=0;i--){x[i]=y[i];for(let j=i+1;j<n;j++)x[i]-=L[j][i]*x[j];x[i]/=L[i][i];}return x;
  }
  function assemble(geo,u,cable=null,linear=false){
    const nd=geo.nodes.length*2,K=zeros(nd),internal=Array(nd).fill(0),bars=[];
    function add(m,ia,ib){
      const ux=u[ib]-(ia<0?0:u[ia]),uy=u[ib+1]-(ia<0?0:u[ia+1]);
      const dx=m.length*m.c+ux,dy=m.length*m.sn+uy,l=Math.hypot(dx,dy),c=dx/l,s=dy/l;
      // Rationalized length change avoids subtracting two metre-scale lengths
      // to obtain a micrometre extension in a stiff, lightly loaded truss.
      let N=linear?m.EA/m.length*(ux*m.c+uy*m.sn):m.EA*(2*m.length*(m.c*ux+m.sn*uy)+ux*ux+uy*uy)/(m.length*(l+m.length));
      const active=!m.tensionOnly||N>=0;if(!active)N=0;
      const cx=linear?m.c:c,sy=linear?m.sn:s,k=active?m.EA/m.length:0,g=linear?0:N/l;
      const ke=[[k*cx*cx+g*sy*sy,(k-g)*cx*sy],[(k-g)*cx*sy,k*sy*sy+g*cx*cx]],ix=[ia,ia+1,ib,ib+1];
      for(let i=0;i<4;i++)if(ix[i]>=0){internal[ix[i]]+=(i<2?-1:1)*N*(i%2?sy:cx);
        for(let j=0;j<4;j++)if(ix[j]>=0)K[ix[i]][ix[j]]+=(i<2===(j<2)?1:-1)*ke[i%2][j%2];}
      bars.push({...m,N:N/1000,c:cx,sn:sy,deformedLength:l});
    }
    for(const m of geo.members)add(m,m.a*2,m.b*2);
    if(cable){const i=geo.top.at(-1),p=geo.nodes[i],len=Math.hypot(p.x,p.y-cable.heightMM);add({id:'CABLE',EA:cable.EA,length:len,c:p.x/len,sn:(p.y-cable.heightMM)/len,tensionOnly:true},-2,i*2);}
    return {K,internal,bars};
  }
  function solve(geo,F,{cable=null,linear=false}={}){
    const fixed=[0,1,2,3],free=F.map((_,i)=>i).filter(i=>!fixed.includes(i)),u=F.map(()=>0),norm=Math.max(1,...F.map(Math.abs));
    let state,iterations=0,residual=Infinity;
    for(let step=1;step<=4;step++){
      let done=false;
      for(let it=0;it<35;it++){
        state=assemble(geo,u,cable,linear);const b=free.map(i=>F[i]*step/4-state.internal[i]);residual=Math.max(0,...b.map(Math.abs))/norm;
        if(residual<1e-9){done=true;break;}
        const du=solveSPD(free.map(i=>free.map(j=>state.K[i][j])),b);free.forEach((i,j)=>{u[i]+=du[j];});iterations++;
        if(Math.max(...u.map(Math.abs))>geo.L*.25)throw Error('โครงเคลื่อนตัวมากเกินขอบเขต: เพิ่มหน้าตัด/ความลึก หรือลดช่วงยื่น');
      }
      if(!done)throw Error('สมดุลโครงยังไม่ลู่เข้า: ตรวจหน้าตัด ความลึก และน้ำหนัก');
    }
    const R=state.internal.map((v,i)=>v-F[i]),reaction={top:{Fx:R[0]/1000,Fy:R[1]/1000},bottom:{Fx:R[2]/1000,Fy:R[3]/1000}};
    return {u,F,R,reaction,members:state.bars.filter(m=>m.id!=='CABLE'),cable:state.bars.find(m=>m.id==='CABLE')||null,residual,iterations};
  }
  function appliedLoads(d,geo,factors,tributaryM){
    const A=root.NCYSC01MemberAnalysis,P=root.NCYSC01Purlins,E0=root.NCYEngine,{s}=A.nativeState(d),pg=P.layout(s);
    const own=E0.rhsProps({...s.member,H:d.purlin.H,B:d.purlin.B,tNom:d.purlin.t,designThicknessFactor:1}).weightKNm;
    const F=Array(geo.nodes.length*2).fill(0),local={};
    for(const m of geo.members){const w=m.weightKNm*factors.D,total=w*m.length;F[m.a*2+1]-=total/2;F[m.b*2+1]-=total/2;local[m.id]={w:-w*m.c,axialW:-w*m.sn,points:[]};}
    const purlins=pg.lines.map(p=>({id:p.id,x:p.zM*1000,P:((d.loads.deadKPa*p.stripM+own)*factors.D+d.loads.liveKPa*p.stripM*factors.L+(d.loads.windEnabled?d.loads.windKPa*p.stripM*factors.W:0))*tributaryM*1000}));
    for(const p of purlins){const i=Math.min(geo.n-1,Math.floor(p.x/(geo.L/geo.n))),a=i*geo.L/geo.n,ratio=(p.x-a)/(geo.L/geo.n);
      F[geo.top[i]*2+1]-=p.P*(1-ratio);F[geo.top[i+1]*2+1]-=p.P*ratio;
      if(ratio>1e-9&&ratio<1-1e-9)local['TC'+(i+1)].points.push({a:p.x-a,P:-p.P,axial:0});
    }
    return {F,local,purlins,tributaryM};
  }
  // Pin-ended loaded member. Exact first-order beam functions and Fourier
  // beam-column solution for compression/tension. Local load is NOT discarded
  // merely because the global model transfers its reactions to panel joints.
  function localBeam(m,load,divisions=48){
    const L=m.length,EI=E*m.props.Ix,N=m.N*1000,Pcr=Math.PI**2*EI/(L*L),ratio=-N/Pcr;
    if(ratio>=.98)throw Error('สมาชิก '+m.id+' ถึงขีดเสถียรภาพในระนาบ: เพิ่มหน้าตัดหรือเพิ่มช่องโครง');
    const w=load.w,loads=load.points||[],reaction=-w*L/2-loads.reduce((v,p)=>v+p.P*(L-p.a)/L,0);
    const modes=Array.from({length:80},(_,j)=>{const k=(j+1)*Math.PI/L,f=2/L*loads.reduce((v,p)=>v+p.P*Math.sin(k*p.a),0)+2*w/(L*k)*(1-Math.cos(k*L));return {k,a:f/(EI*k**4+N*k*k)};});
    const xs=[...new Set([...Array.from({length:divisions+1},(_,i)=>L*i/divisions),...loads.flatMap(p=>[Math.max(0,p.a-1e-7),p.a,Math.min(L,p.a+1e-7)])])].sort((a,b)=>a-b);
    const points=xs.map(x=>{
      let y=w*x*(L**3-2*L*x*x+x**3)/(24*EI),slope=w*(L**3-6*L*x*x+4*x**3)/(24*EI);
      for(const p of loads){const a=p.a,b=L-a;if(x<=a){y+=p.P*b*x*(L*L-b*b-x*x)/(6*L*EI);slope+=p.P*b*(L*L-b*b-3*x*x)/(6*L*EI);}else{const z=L-x;y+=p.P*a*z*(L*L-a*a-z*z)/(6*L*EI);slope-=p.P*a*(L*L-a*a-3*z*z)/(6*L*EI);}}
      const firstM=reaction*x+w*x*x/2+loads.reduce((v,p)=>v+p.P*Math.max(0,x-p.a),0),firstV=reaction+w*x+loads.reduce((v,p)=>v+(x>=p.a?p.P:0),0);
      let M=firstM,V=firstV;
      if(Math.abs(N)>1e-7){let dy=0,ds=0,dm=0,dv=0;for(const q of modes){const first=q.a*(1+N/(EI*q.k*q.k)),delta=q.a-first;
        dy+=delta*Math.sin(q.k*x);ds+=delta*q.k*Math.cos(q.k*x);dm-=EI*delta*q.k*q.k*Math.sin(q.k*x);dv-=EI*delta*q.k**3*Math.cos(q.k*x);}
        y+=dy;slope+=ds;M+=dm;V+=dv;}
      const axial=N+load.axialW*(L/2-x)+loads.reduce((v,p)=>v+(p.axial||0)*(1-p.a/L-(x>=p.a?1:0)),0);
      return {x:x/1000,deflection:y,slope,M:M/1e6,V:V/1000,N:axial/1000};
    });
    return {points,maxM:Math.max(...points.map(p=>Math.abs(p.M))),maxV:Math.max(...points.map(p=>Math.abs(p.V))),maxMM:Math.max(...points.map(p=>Math.abs(p.deflection))),PcrKN:Pcr/1000};
  }
  function capacity(d,m,local,profile,geo){
    const E0=root.NCYEngine,S=root.NCYSC01SteelDesign,mat=m.kind==='chord'?d.steel:d.web;
    const chordLength=m.id.startsWith('BC')?Math.hypot(geo.L,d.truss.type==='tri_tapered'?d.truss.depthMM-d.truss.tipDepthMM:0):geo.L;
    const Lout=m.kind==='chord'?2*chordLength:m.length;
    const s={member:{H:mat.H,B:mat.B,tNom:mat.t,designThicknessFactor:d.steel.thicknessFactor,Fy:d.steel.Fy,Fu:d.steel.Fu,lengthM:m.length/1000,Kx:1,Ky:Lout/m.length},mode:'direct',direct:{memberDiagramConfirmed:true,serviceTipDeflectionMM:0},connectionType:'plain'};
    const hss=S.hss({...s,member:{...s.member,lengthM:Lout/1000}},m.props,profile),axial=S.axial(s,m.props,profile);
    const checks=local.points.map(p=>E0.memberPrimitives.memberDemand(s,m.props,{...hss,outside:hss.x.outside},axial,{name:m.id,action:{N:p.N,Vy:p.V,Vx:0,Mx:p.M,My:0,Tz:0},loadList:[]}));
    const controlling=maxBy(checks,c=>c.ratio),Nmax=maxBy(local.points,p=>Math.abs(p.N)).N;
    return {...m,...local,ratio:controlling.ratio,state:controlling.state,pm:controlling.pm,vr:controlling.vr,Nmax,capacity:Nmax<0?Math.min(axial.compX.phiPn,axial.compY.phiPn):axial.phiT,hss,axial,Lout};
  }
  function runCase(d,geo,definition,tributaryM,profile){
    const loads=appliedLoads(d,geo,definition.f,tributaryM),cable=d.cable.enabled?{heightMM:d.cable.heightM*1000,EA:d.cable.EAkN*1000}:null;
    const solved=solve(geo,loads.F,{cable}),members=solved.members.map(m=>capacity(d,m,localBeam(m,loads.local[m.id]),profile,geo));
    const maxMember=maxBy(members,m=>m.ratio),top=members.filter(m=>m.id.startsWith('TC')),TKN=solved.cable?.N||0;
    const external=geo.nodes.map((p,i)=>({x:p.x+solved.u[i*2],y:p.y+solved.u[i*2+1],fx:loads.F[i*2],fy:loads.F[i*2+1]}));
    if(solved.cable){const p=external[geo.top.at(-1)];p.fx-=TKN*1000*solved.cable.c;p.fy-=TKN*1000*solved.cable.sn;}
    const physical=loads.purlins.map(p=>{const i=Math.min(geo.n-1,Math.floor(p.x/(geo.L/geo.n))),t=p.x/(geo.L/geo.n)-i,a=external[geo.top[i]],b=external[geo.top[i+1]];return {x:a.x*(1-t)+b.x*t,y:a.y*(1-t)+b.y*t,fy:-p.P,fx:0};});
    if(solved.cable){const p=external[geo.top.at(-1)];physical.push({...p,fx:-TKN*1000*solved.cable.c,fy:-TKN*1000*solved.cable.sn});}
    const xs=[...new Set([...Array.from({length:161},(_,i)=>geo.L*i/160),...loads.purlins.flatMap(p=>[Math.max(0,p.x-1e-5),p.x,Math.min(geo.L,p.x+1e-5)])])].sort((a,b)=>a-b);
    const points=xs.map(x=>{
      const index=Math.min(geo.n-1,Math.floor(x/(geo.L/geo.n))),m=top[index],a=geo.nodes[m.a],b=geo.nodes[m.b],t=(x-a.x)/(b.x-a.x);
      const localX=t*m.length/1000,k=Math.max(0,Math.min(m.points.length-2,m.points.findIndex(p=>p.x>=localX)-1)),u=(localX-m.points[k].x)/(m.points[k+1].x-m.points[k].x),delta=m.points[k].deflection*(1-u)+m.points[k+1].deflection*u;
      const deflection=-(solved.u[m.a*2+1]*(1-t)+solved.u[m.b*2+1]*t+delta);
      const cut=external[m.a].x*(1-t)+external[m.b].x*t,right=physical.filter(p=>p.x>cut+1e-7);
      for(const bar of geo.members){let a=external[bar.a],b=external[bar.b];if(a.x>b.x)[a,b]=[b,a];if(b.x<=cut+1e-7)continue;
        const fraction=a.x>cut?1:(b.x-cut)/(b.x-a.x),fy=-bar.weightKNm*definition.f.D*bar.length*fraction;
        right.push({x:(Math.max(cut,a.x)+b.x)/2,y:0,fx:0,fy});}
      const M=right.reduce((v,p)=>v-p.fy*(p.x-cut)+p.fx*p.y,0)/1e6,V=right.reduce((v,p)=>v+p.fy,0)/1000;
      return {x:x/1000,deflection,M,V};
    });
    const maxD=maxBy(points,p=>Math.abs(p.deflection)),sumFy=external.reduce((v,p)=>v+p.fy,0)/1000+solved.reaction.top.Fy+solved.reaction.bottom.Fy;
    const sumFx=external.reduce((v,p)=>v+p.fx,0)/1000+solved.reaction.top.Fx+solved.reaction.bottom.Fx;
    const moment=external.reduce((v,p)=>v+p.x*p.fy-p.y*p.fx,0)/1e6+geo.depthMM*solved.reaction.bottom.Fx/1000;
    return {name:definition.name+(tributaryM===root.NCYSC01MemberAnalysis.layout(d).edgeTributaryM?' · แนวริม':' · แนวกลาง'),factors:definition.f,w:-loads.F.reduce((v,q,i)=>v+(i%2?q:0),0)/geo.L,
      ...solved,members,maxMember,ratio:maxMember.ratio,pm:maxMember.pm,vr:maxMember.vr,points,maxM:Math.max(...points.map(p=>Math.abs(p.M))),maxV:Math.max(...points.map(p=>Math.abs(p.V))),maxMM:Math.abs(maxD.deflection),tipMM:points.at(-1).deflection,
      rootMoment:geo.depthMM*solved.reaction.bottom.Fx/1000,rootVertical:-(solved.reaction.top.Fy+solved.reaction.bottom.Fy),TKN,compressionKN:TKN*(solved.cable?.c||0),verticalKN:-TKN*(solved.cable?.sn||0),lengthM:Math.hypot(geo.L,d.cable.heightM*1000)/1000,
      slack:d.cable.enabled&&TKN<1e-9,issue:'',loads,geo,closure:{Fx:sumFx,Fy:sumFy,M:moment},tributaryM};
  }
  function definitions(d){
    const def=(name,D,L,W=0)=>({name,f:{D,L,W}}),ul=[def('U1 1.4D',1.4,0),def('U2 1.2D+1.6L',1.2,1.6)],sl=[def('S1 D+L',1,1)];
    if(d.loads.windEnabled)for(const w of [1,-1]){ul.push(def(`U4 1.2D+L${w>0?'+':'−'}W`,1.2,1,w),def(`U5 0.9D${w>0?'+':'−'}W`,.9,0,w));sl.push(def(`SLS D${w>0?'+':'−'}W`,1,0,w),def(`SLS D+L${w>0?'+':'−'}W`,1,1,w));}
    return {ul,sl};
  }
  function analyze(d,profile){
    const geo=geometry(d),g=root.NCYSC01MemberAnalysis.layout(d),tribs=[...new Set([g.tributaryM,g.edgeTributaryM])],{ul,sl}=definitions(d);
    const cases=tribs.flatMap(t=>ul.map(c=>runCase(d,geo,c,t,profile))),service=tribs.flatMap(t=>sl.map(c=>runCase(d,geo,c,t,profile)));
    const member=maxBy(cases,c=>c.ratio),deflection=maxBy(service,c=>c.maxMM),cableSLS=maxBy(service,c=>c.TKN),cableULS=maxBy(cases,c=>c.TKN),issues=[];
    for(const c of [...cases,...service]){
      if(c.members.some(m=>m.state==='outside'))issues.push('หน้าตัดมี flange และ web ชะลูดพร้อมกัน ซึ่ง AISC F7 ไม่ครอบคลุม: เพิ่มความหนาหรือใช้หน้าตัดตลาด');
      if(c.maxMM>geo.L/50)issues.push('การแอ่นเกิน L/50: เพิ่มความลึก/หน้าตัด หรือลดช่วงยื่นก่อนใช้แบบจำลองนี้');
      if(Math.max(...Object.values(c.closure).map(Math.abs))>1e-5)issues.push('สมดุลแรง/โมเมนต์ของโครงไม่ผ่านค่าคลาดเคลื่อน');
    }
    if(d.cable.enabled){const free={...d,cable:{...d.cable,enabled:false}};cableSLS.freeTipMM=runCase(free,geo,{name:cableSLS.name,f:cableSLS.factors},cableSLS.tributaryM,profile).tipMM;}
    return {geo,cases,service,member,deflection,cableSLS,cableULS,issues:[...new Set(issues)]};
  }
  root.NCYSC01MemberTruss=Object.freeze({VERSION:'r35.1',types,geometry,solveSPD,assemble,solve,appliedLoads,localBeam,capacity,runCase,definitions,analyze});
})(typeof window==='undefined'?globalThis:window);
