/* Rich native drawing vocabulary projected from accepted component results only. */
(function(root){
  'use strict';
  const D=root.NCYDraw,Q=root.NCYUnits,{C,esc,f,svg}=D;
  const {line,text,rect,circle,path,arrow,dimH,dimV,hexagon}=D.primitives;
  const n=(v,k=3)=>Number.isFinite(v)?Number(v.toFixed(k)).toLocaleString('en-US'):'—';
  const panel=(title,body,caption='')=>`<figure class="sm-native-panel"><figcaption><b>${esc(title)}</b>${caption?`<small>${esc(caption)}</small>`:''}</figcaption>${body}</figure>`;
  const pair=(a,b)=>`<div class="sm-native-grid">${a}${b}</div>`;
  // Same filled plot, axes, critical ordinate and sample markers as NCYDraw.plot.
  // The caller supplies solved points (already in display units), never a new load solve.
  function plot(points,key,label,unit,{leftLabel='จุดยึด x = 0',rightLabel='ปลายอิสระ x = L'}={}){
    if(!points?.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p[key])))throw Error('ข้อมูลกราฟไม่ครบ');
    const L=points.at(-1).x;if(!(L>0))throw Error('ช่วงกราฟไม่ถูกต้อง');
    const color=key==='V'?C.blue:key==='M'?C.orange:C.violet,left=86,right=653,top=48,bottom=278,W=720,H=402;
    const vals=points.map(z=>z[key]),max=Math.max(...vals,0),min=Math.min(...vals,0),range=(max-min)||1,hi=max+range*.2,lo=min-range*.2;
    const xx=x=>left+x/L*(right-left),yy=v=>top+(hi-v)/(hi-lo)*(bottom-top),base=yy(0),crit=points.reduce((a,b)=>Math.abs(a[key])>=Math.abs(b[key])?a:b),symbol=key==='deflection'?'δ':key;
    let out='';for(let i=0;i<=4;i++){let v=lo+(hi-lo)*i/4,y=yy(v);out+=line(left,y,right,y,'#e8eef5',1)+text(left-10,y+6,n(v,2),18,C.muted,'end');}
    for(let i=0;i<=4;i++){let x=L*i/4,X=xx(x);out+=line(X,top,X,bottom,'#edf1f6',1)+text(X,bottom+27,n(x,2),18,C.muted,'middle');}
    out+=path(`M${xx(points[0].x)},${base}L`+points.map(z=>`${xx(z.x)},${yy(z[key])}`).join('L')+`L${xx(points.at(-1).x)},${base}Z`,color+'16','none',0);
    out+=line(left,base,right,base,'#92a4bc',1.3)+path('M'+points.map(z=>`${xx(z.x)},${yy(z[key])}`).join('L'),'none',color,2.3);
    for(const i of [0,Math.floor((points.length-1)*.25),Math.floor((points.length-1)*.5),Math.floor((points.length-1)*.75),points.length-1]){const p=points[i],X=xx(p.x),Y=yy(p[key]);out+=circle(X,Y,3.3,'white',color,1.4)+text(X,Y+(p[key]>=0?-12:24),n(p[key],2),19,color,'middle',600);}
    out+=text(left,28,`${symbol} (${unit})`,21,color,'start',600)+text((left+right)/2,330,'x (m) →',18,C.muted,'middle');
    out+=text(left,354,leftLabel,16,C.muted)+text(right,354,rightLabel,16,C.muted,'end');
    out+=rect(80,368,580,30,'#f8fafd','#d7e2ef',1,5)+text(370,389,`|${symbol}|max = ${n(Math.abs(crit[key]))} ${unit}  @ x = ${n(crit.x)} m`,19,color,'middle',600);
    return panel(label,svg(out,W,H));
  }
  function member(d,r,q,{purlin=false}={}){
    const s=root.NCYSC01MemberViews.nativeState(d);Q.use(s);
    const sec=purlin?d.purlin:d.steel,L=purlin?r.purlins.grid.spanM:d.geometry.projectionM,x0=133,x1=654,y=212,bh=28;
    const def=purlin?r.purlins.deflection:r.deflection,pts=purlin?def.points.map(p=>({...p,deflection:p.D})):def.points,max=purlin?Math.abs(def.delta):def.maxMM;
    return svg(id=>{
      let a='';
      if(purlin){for(const x of [x0,x1])a+=path(`M${x},${y+bh}l-15,23h30Z`,'#e6ecf2','#6b8298',1.5)+line(x-22,y+bh+29,x+22,y+bh+29,'#8394a5',1.4);}
      else{
        a+=rect(50,112,70,212,`url(#${id}-${d.support.type==='hbeam'?'metal':'concrete'})`,C.muted,1.2);
        a+=rect(x0-13,166,13,118,`url(#${id}-plate)`,C.blue,1.6);
        if(d.support.type!=='hbeam')for(const Y of [179,270])a+=line(76,Y,x0-2,Y,'#8797a6',5)+rect(x0-5,Y-6,7,12,'#c7a767','#6d511c',1);
        a+=text(84,348,d.support.type==='hbeam'?'H-BEAM':'CONCRETE',16,C.muted,'middle',600);
      }
      a+=rect(x0,y,x1-x0,bh,`url(#${id}-metal)`,C.ink,1.8,3)+rect(x0+3,y+3,x1-x0-6,bh-6,'none','#a5b5c5',.8,2);
      a+=text((x0+x1)/2,y+20,`RHS ${sec.H} × ${sec.B} × ${sec.t}`,19,C.ink,'middle',600)+dimH(x0,x1,64,105,`L = ${n(L)} m`);
      if(purlin){
        for(let i=0;i<=8;i++){const X=x0+12+i*(x1-x0-24)/8;a+=arrow(X,q.w>=0?123:y-6,X,q.w>=0?y-6:123,C.orange,2);}
        a+=text((x0+x1)/2,104,`wᵤ = ${Q.format(q.w,'kN/m',3)}`,20,C.orange,'middle',600);
        a+=text(x0,300,'A · คานรองรับ',18,C.muted)+text(x1,300,'B · คานรองรับ',18,C.muted,'end');
      }else{
        const loads=q.pointLoads||[],stride=Math.max(1,Math.ceil(loads.length/6));
        for(const [i,p] of loads.entries()){
          const X=x0+p.a/(L*1000)*(x1-x0);a+=arrow(X,p.P>=0?132:y-7,X,p.P>=0?y-7:132,C.orange,2);
          if(i%stride===0||i===loads.length-1)a+=text(X,i%2?103:125,'P'+String(i+1).padStart(2,'0'),17,C.orange,'middle',600);
        }
        a+=text((x0+x1)/2,86,'แรงปฏิกิริยาแป ณ ตำแหน่งจริง',18,C.orange,'middle');
        a+=text(x1,318,`wเหล็ก = ${Q.format(q.selfW??r.mainSelfWeightKNm,'kN/m',3)}`,18,C.muted,'end');
        a+=text(x0,286,`Mx = ${Q.format(q.rootMoment,'kN·m',3)}`,18,C.red);
        if(d.cable.enabled){a+=line(x0,95,x1,y,'#856c4c',2.5)+circle(x1,y,4,'white','#856c4c',1);a+=text(x1,347,`T = ${Q.format(q.TKN,'kN',3)} · สลิงรับแรงดึง`,17,'#856c4c','end');}
      }
      if(pts?.length){const peak=Math.max(max,1e-12);a+=path('M'+pts.map(p=>`${x0+p.x/L*(x1-x0)},${y+bh+6+p.deflection/peak*22}`).join('L'),'none',C.violet,1.5,'5 4');}
      a+=text(393,383,`δSLS = ${n(max)} mm · เส้นแอ่นขยายเพื่ออ่าน`,18,C.violet,'middle');return a;
    },720,402);
  }
  function connection(d,r,which){
    const q=which||r.connections.all.find(x=>x.caseName===r.member.name)||r.connections.all[0],s=root.NCYSC01MemberViews.nativeState(d);
    s.plate={...s.plate,...q.plate};
    const hbeam=d.support.type==='hbeam',forces=hbeam?[]:q.group.forces;
    if(d.truss.enabled&&!hbeam){s.anchors.rows=1;s.anchors.cols=forces.length;s.anchors.plateEdgeX=s.plate.width/2+Math.min(...forces.map(x=>x.x));s.anchors.plateEdgeY=s.plate.height/2;}
    const c={caseDef:{name:q.caseName},action:q.action,group:hbeam?{forces:[],maxT:0}:q.group,normal:q.normal};
    const nr={state:s,scopedHbeam:hbeam};
    return {front:front(nr,c,{tall:true}),section:section(nr,c),forceMap:hbeam?'':D.forceMap(nr,c),forces,caseName:q.caseName,plateId:q.plateId,c,state:s};
  }

  // Retained NCYDraw material front/section, adapted only for selected welds and support.
function front(r,c,opt={}){Q.use(r.state);const s=r.state,hbeam=!!r.scopedHbeam,W=opt.tall?470:720,H=opt.tall?645:460,cx=opt.tall?238:350,cy=opt.tall?310:223,scale=Math.min((W-190)/s.plate.width,(H-205)/s.plate.height),pw=s.plate.width*scale,ph=s.plate.height*scale,x=cx-pw/2,y=cy-ph/2,margin=Math.max(16,Math.min(28,24*scale));return svg(id=>{let a='';a+=rect(x-margin,y-margin,pw+margin*2,ph+margin*2,`url(#${id}-${hbeam?'metal':'concrete'})`,'#8998a8',1.1,3);a+=`<g filter="url(#${id}-shadow)">`;a+=rect(x,y,pw,ph,`url(#${id}-plate)`,'#173f72',1.8,2);a+=rect(x+3,y+3,pw-6,ph-6,'none','#7ca1ca',.7,1);a+=line(cx,y-17,cx,y+ph+20,'#a8bfd8',.8,'10 4 2 4')+line(x-15,cy,x+pw+15,cy,'#a8bfd8',.8,'10 4 2 4');const mx=cx-s.member.B*scale/2,my=cy-s.member.H*scale/2,mw=s.member.B*scale,mh=s.member.H*scale;a+=rect(mx,my,mw,mh,`url(#${id}-beam)`,'#1c252e',1.8,1);let t=Math.max(2,s.member.tNom*scale);a+=rect(mx+t,my+t,Math.max(1,mw-2*t),Math.max(1,mh-2*t),'#202a33','#93a0ac',.9);if(s.weld.pattern!=='vertical'){a+=line(mx-1,my-1,mx+mw+1,my-1,`url(#${id}-weld)`,Math.max(2,2.2*scale));a+=line(mx-1,my+mh+1,mx+mw+1,my+mh+1,`url(#${id}-weld)`,Math.max(2,2.2*scale));}if(s.weld.pattern!=='horizontal')for(const wx of [mx-1,mx+mw+1])a+=line(wx,my-1,wx,my+mh+1,`url(#${id}-weld)`,Math.max(2,2.2*scale));for(const q of c.group.forces){let xx=cx+q.x*scale,yy=cy-q.y*scale,rr=Math.max(5,s.anchors.diameter*scale*.48);a+=circle(xx+1.5,yy+2,rr*1.8,'#10284022','none',0);a+=circle(xx,yy,rr*1.65,'#d7dde2','#526579',1);a+=circle(xx,yy,rr*1.30,`url(#${id}-anchor)`,'#6e531c',1.1);a+=hexagon(xx,yy,rr*.92,`url(#${id}-anchor)`,'#6d511c',1);a+=circle(xx,yy,Math.max(1.5,rr*.27),'#3a3425','#72581f',.6);a+=text(xx,yy-rr*1.75-7,q.id,11,q.T>.01?C.red:C.blue,'middle',700);}a+='</g>';a+=dimH(x,x+pw,y-31,y,`${f(s.plate.width,1)} mm`);a+=dimV(y,y+ph,x-35,x,`${f(s.plate.height,1)} mm`);if(!hbeam){const fs=c.group.forces,minx=Math.min(...fs.map(z=>z.x)),maxx=Math.max(...fs.map(z=>z.x));a+=dimH(x,cx+minx*scale,y+ph+30,y+ph,`${f(s.anchors.plateEdgeX,0)}`);a+=dimH(cx+minx*scale,cx+maxx*scale,y+ph+30,y+ph,`${f(maxx-minx,0)}`);a+=dimH(cx+maxx*scale,x+pw,y+ph+30,y+ph,`${f(s.anchors.plateEdgeX,0)}`);a+=text(cx,H-40,`${s.anchors.rows} แถว × ${s.anchors.cols} หลัก  M${s.anchors.diameter} • รูเพลท Ø${s.plate.holeDiameterMM} mm`,11,C.ink,'middle',700);a+=text(cx,H-19,`Origin: กึ่งกลางเพลท • +x ขวา / +y ขึ้น • hₑf ${s.anchors.hef} mm`,10,C.muted,'middle');}else{a+=text(cx,H-54,'HSS → PLATE → H-BEAM',16,C.blue,'middle',700);a+=text(cx,H-29,'W1 '+s.weld.pattern+' / w '+s.weld.size+' mm',16,C.muted,'middle');}return a;},W,H);}
function section(r,c){Q.use(r.state);const s=r.state,hbeam=!!r.scopedHbeam,W=720,H=440,cx=322,cy=217,ph=Math.min(256,Math.max(210,s.plate.height*.6)),py=cy-ph/2,depth=150,embed=s.anchors.hef/s.concrete.thickness*depth,plateT=Math.max(8,s.plate.thickness*.6),groutT=Math.max(5,Math.min(10,plateT*.55));return svg(id=>{let a='';if(hbeam){for(const yy of [py-45,py+ph+22])a+=rect(cx-depth,yy,depth,23,`url(#${id}-metal)`,'#566b7d',1.3);a+=rect(cx-15,py-22,15,ph+44,`url(#${id}-metal)`,'#566b7d',1.3);}else{a+=rect(cx-depth,py-22,depth,ph+44,`url(#${id}-concrete)`,'#8998a8',1.3,2);a+=rect(cx-groutT,py,groutT,ph,`url(#${id}-grout)`,'#b8b4a8',.8);}a+=`<g filter="url(#${id}-shadow)">`;a+=rect(cx,py,plateT,ph,`url(#${id}-plate)`,'#173f72',1.7);let bh=Math.max(40,s.member.H/s.plate.height*ph);a+=rect(cx+plateT,cy-bh/2,223,bh,`url(#${id}-beam)`,'#202a33',1.8,2);a+=rect(cx+plateT+4,cy-bh/2+4,218,bh-8,'#1f2932','#7e8b97',.8);a+=line(cx+plateT+1,cy-bh/2+2,cx+plateT+25,cy-bh/2+2,`url(#${id}-weld)`,4);a+=line(cx+plateT+1,cy+bh/2-2,cx+plateT+25,cy+bh/2-2,`url(#${id}-weld)`,4);for(const yy of [...new Set(c.group.forces.map(z=>z.y))]){const Y=cy-yy/s.plate.height*ph,X=cx-embed;a+=rect(X,Y-2.7,embed+plateT+15,5.4,`url(#${id}-metal)`,'#5c6c7b',.7);for(let xx=X+4;xx<cx-3;xx+=6)a+=line(xx,Y-2.4,xx-2.5,Y+2.4,'#4d5d6d',.65);a+=rect(cx+plateT+1,Y-8,5,16,'#d9dfe4','#596c7e',.9);a+=circle(cx+plateT+10,Y,8.2,'#d6dce1','#56697c',1);a+=hexagon(cx+plateT+11,Y,6.4,`url(#${id}-anchor)`,'#6d511c',1);a+=circle(cx+plateT+11,Y,1.8,'#3b3321','#6d511c',.5);a+=line(X,Y-6,X,Y+6,'#8694a1',1);if(s.anchors.type==='adhesive')a+=rect(X-2,Y-6,embed+2,12,'none','#65a49c',.8);}a+='</g>';if(!hbeam)a+=dimH(cx-embed,cx,py+ph+52,py+ph,`hₑf = ${f(s.anchors.hef,0)} mm`);if(!hbeam)a+=dimH(cx-depth,cx,62,py-22,`h = ${f(s.concrete.thickness,0)} mm`);a+=path(`M${cx+plateT},${py+14}L${cx+plateT+43},${py-18}L620,${py-18}`,'none',C.blue,1);a+=text(620,py-26,`PL ${s.plate.width} × ${s.plate.height} × ${s.plate.thickness}`,12,C.blue,'end',700);a+=text(606,cy+bh/2+31,`RHS ${s.member.H} × ${s.member.B} × ${s.member.tNom}`,12,C.ink,'end',700);if(hbeam){a+=text(cx-depth/2-20,cy-12,'H-BEAM',18,C.muted,'middle',700);a+=text(608,380,'เชื่อมรอบเพลทกับหน้ารองรับแข็ง',17,C.muted,'end');a+=text(608,408,'ไม่มีพุกคอนกรีตในจุดต่อนี้',17,C.muted,'end');}else{a+=text(cx-depth/2,cy-8,'CONCRETE',11,C.muted,'middle',700)+text(cx-depth/2,cy+12,`f′c ${Q.format(s.concrete.fc,'MPa',0)}`,11,C.muted,'middle');a+=text(cx-groutT-5,py-11,'NON-SHRINK GROUT',9,'#8b846f','end',600);a+=text(608,380,`รูเจาะ Ø${s.product.holeDiameter} • เจาะลึก ${s.product.drillDepth} mm`,11,C.muted,'end');a+=text(608,405,s.plate.standOffMM>0?`ช่องว่าง ${s.plate.standOffMM} mm — นอกขอบเขตโมเดลเดิม`:'เพลทสัมผัส grout/คอนกรีต • รายละเอียดพุกอ้างรายงานรุ่นจริง',10,s.plate.standOffMM>0?C.red:C.muted,'end');}return a;},W,H);}
  root.NCYSC01MemberReportFigures=Object.freeze({panel,pair,plot,member,connection});
})(typeof window==='undefined'?globalThis:window);
