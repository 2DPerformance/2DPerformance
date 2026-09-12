/* One native dimensioned entity set for screen CAD, report and DXF. Units mm. */
(function(root){
  'use strict';
  const A=root.NCYSC01MemberAnalysis,V=root.NCYSC01MemberViews,D=root.NCYDraft;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=x=>Number(x.toFixed(2)).toString();
  function build(d){
    const errors=A.validate(d,{geometryOnly:true});if(errors.length)throw Error(errors[0].message);
    const p=root.NCYSC01MemberLoads.project(d),s=V.nativeState(d),sheets=[];
    const layer=x=>({STEEL:'NCY_MEMBER',PLATE:'NCY_PLATE',PURLIN:'NCY_MEMBER',WELD:'NCY_WELD',SUPPORT:'NCY_CONCRETE',DIM:'NCY_DIM',HOLES:'NCY_ANCHOR'}[x]||x);
    const sheet=(id,title)=>{const section=id.includes('section'),sec=id==='purlin-section'?d.purlin:id==='web-section'?d.web:d.steel;
      const length=section?(id==='support-section'?d.support.beamHMM:Math.max(sec.H,sec.B)):id==='connection'?(d.truss.enabled?d.truss.depthMM+500:700):id==='main'?Math.max(d.geometry.projectionM*1000,d.truss.enabled?d.truss.depthMM:0,d.cable.enabled?d.cable.heightM*1000:0):Math.max(d.geometry.widthM,d.geometry.projectionM)*1000;
      const scale=[1,2,5,10,20,25,50,75,100].find(x=>length/x<=(section?35:id==='purlin'?110:180))||100;const out=new D.Scene(title,scale);Object.assign(out,{id,title});sheets.push(out);return out;};
    const line=(q,x1,y1,x2,y2,l='STEEL')=>q.line(x1,y1,x2,y2,layer(l));
    const rect=(q,x,y,w,h,l='STEEL')=>q.rect(x,y,w,h,layer(l));
    const text=(q,x,y,value)=>q.text(String(value),x,y,2.8*q.scale,'left');
    const dim=(q,x1,y1,x2,y2,label)=>{const axis=y1===y2?'x':'y',prefix=/^[A-Za-z]+ /.test(label)?label.split(' ')[0]+' = ':'';return q.dim([x1,y1],[x2,y2],axis,axis==='x'?y1:x1,{prefix,outward:(axis==='x'?y1:x1)<0?-1:1});};
    const W=d.geometry.widthM*1000,L=d.geometry.projectionM*1000,plan=sheet('plan','แปลนวางคานและแป · หน่วย mm');
    for(const f of p.frames){rect(plan,f.xM*1000-d.steel.B/2,0,d.steel.B,L);text(plan,f.xM*1000,L+4*plan.scale,f.id);}
    for(const q of p.lines){rect(plan,0,q.zM*1000-d.purlin.B/2,W,d.purlin.B,'PURLIN');text(plan,W+70,q.zM*1000,q.id+' @ '+n(q.zM*1000));}
    line(plan,0,0,W,0,'SUPPORT');plan.dim([0,0],[W,0],'x',-10*plan.scale,{outward:-1});plan.dim([0,0],[0,L],'y',-10*plan.scale,{outward:-1});
    for(let i=1;i<p.frames.length;i++)plan.dim([p.frames[i-1].xM*1000,L],[p.frames[i].xM*1000,L],'x',L+12*plan.scale);
    const main=sheet('main','คาน / โครงถัก · ด้านข้าง');
    if(d.truss.enabled){const g=root.NCYSC01MemberTruss.geometry(d);for(const m of g.members){const a=g.nodes[m.a],b=g.nodes[m.b];line(main,a.x,a.y,b.x,b.y);text(main,(a.x+b.x)/2,(a.y+b.y)/2+30,m.id,25);}}
    else rect(main,0,-d.steel.H/2,L,d.steel.H);
    for(const q of p.lines){rect(main,q.zM*1000-d.purlin.B/2,d.steel.H/2,d.purlin.B,d.purlin.H,'PURLIN');text(main,q.zM*1000,d.steel.H/2+d.purlin.H+45,q.id,28);}
    if(d.cable.enabled){line(main,0,d.cable.heightM*1000,L,0,'CABLE');text(main,L/2,d.cable.heightM*500+70,'CABLE d'+d.cable.diameterMM);}
    const low=d.truss.enabled?-d.truss.depthMM:-d.steel.H/2;main.dim([0,low],[L,low],'x',low-12*main.scale,{outward:-1});
    const section=(out,x,y,sec,title)=>{const {B,H,t}=sec,k=out.scale;
      rect(out,x,y,B,H);rect(out,x+t,y+t,B-2*t,H-2*t);
      out.hatchRect(x,y,B,t,3*k);out.hatchRect(x,y+H-t,B,t,3*k);out.hatchRect(x,y+t,t,H-2*t,3*k);out.hatchRect(x+B-t,y+t,t,H-2*t,3*k);
      line(out,x+B/2,y-4*k,x+B/2,y+H+4*k,'NCY_CENTER');line(out,x-4*k,y+H/2,x+B+4*k,y+H/2,'NCY_CENTER');
      out.dim([x,y],[x+B,y],'x',y-12*k,{prefix:'B = ',outward:-1});out.dim([x,y],[x,y+H],'y',x-12*k,{prefix:'H = ',outward:-1});
      out.leader(x+B-t/2,y+H*.7,x+B+10*k,y+H*.72,['t = '+n(t)+' mm',n(H)+' x '+n(B)+' x '+n(t)]);
      out.text(title,x+B/2,y+H+10*k,3.5*k,'center');
    };
    section(sheet('main-section','หน้าตัดคาน / คอร์ด · ขยาย'),0,0,d.steel,'MAIN SECTION');
    const pur=sheet('purlin','แป · ช่วงรองรับทั้งหมด');rect(pur,0,0,W,d.purlin.H);
    for(const f of p.frames){const x=f.xM*1000,k=pur.scale;line(pur,x-1.5*k,-2*k,x,0,'SUPPORT');line(pur,x,0,x+1.5*k,-2*k,'SUPPORT');line(pur,x-1.5*k,-2*k,x+1.5*k,-2*k,'SUPPORT');text(pur,x,-6*k,f.id);}
    pur.dim([0,0],[W,0],'x',-13*pur.scale,{outward:-1});section(sheet('purlin-section','หน้าตัดแป · ขยาย'),0,0,d.purlin,'PURLIN SECTION');
    if(d.truss.enabled){
      section(sheet('web-section','หน้าตัดเหล็กทแยง / ตั้ง · ขยาย'),0,0,d.web,'WEB SECTION');
      const joint=sheet('joints','จุดต่อ Truss · รายละเอียด Gusset ที่ใช้ตรวจ'),c=d.connection.node,b=Math.max(20,Math.min(d.web.H,d.web.B)),raw=b+2*c.lengthMM*Math.tan(Math.PI/6),ww=c.widthMM>0?Math.min(raw,c.widthMM):raw;
      rect(joint,0,-ww/2,c.lengthMM,ww,'PLATE');rect(joint,0,-d.web.B/2,c.lengthMM,d.web.B);
      for(const yy of [-b/2,b/2])line(joint,0,yy,c.lengthMM,yy,'WELD');
      dim(joint,0,-ww/2-70,c.lengthMM,-ww/2-70,'Lg '+n(c.lengthMM));text(joint,0,ww/2+80,c.type,22);text(joint,c.lengthMM+60,ww/2,'t '+n(c.thicknessMM)+' / w '+n(c.weldMM),22);
      text(joint,c.lengthMM+60,ww/2-45,'Whitmore '+n(ww)+' mm',22);text(joint,0,-ww/2-160,'ANALYTICAL EFFECTIVE WIDTH; JOINT DETAIL REVIEW REQUIRED',18);
    }
    const conn=sheet('connection','เพลท พุก และแนวเชื่อม · ด้านหน้า / Section');
    const g=root.NCYV62.rootGeometry(s),centers=d.truss.enabled?[{id:'TOP',y:0},{id:'BOTTOM',y:-d.truss.depthMM}]:[{id:'ROOT',y:0}];
    const pw=d.truss.enabled?g.plateW:s.plate.width,ph=d.truss.enabled?g.plateH:s.plate.height;
    for(const pos of centers){const cy=pos.y,k=conn.scale,B=d.steel.B,H=d.steel.H,t=d.steel.t;
      rect(conn,-pw/2,cy-ph/2,pw,ph,'PLATE');rect(conn,-B/2,cy-H/2,B,H);rect(conn,-B/2+t,cy-H/2+t,B-2*t,H-2*t);
      line(conn,-pw/2-3*k,cy,pw/2+3*k,cy,'NCY_CENTER');line(conn,0,cy-ph/2-3*k,0,cy+ph/2+3*k,'NCY_CENTER');
      const coords=d.truss.enabled?g.anchorXs.map((x,i)=>({x,y:0,id:'A'+(i+1)})):ECoords(s);
      if(d.support.type!=='hbeam')for(const a of coords){conn.circle(a.x,cy+a.y,s.plate.holeDiameterMM/2);conn.cross(a.x,cy+a.y,Math.max(3*k,s.plate.holeDiameterMM*.7));conn.anchorTag({...a,y:cy+a.y},s.plate.holeDiameterMM/2);}
      if(['all','horizontal'].includes(d.connection.weldPattern))for(const y of [-H/2,H/2])line(conn,-B/2,cy+y,B/2,cy+y,'WELD');
      if(['all','vertical'].includes(d.connection.weldPattern))for(const x of [-B/2,B/2])line(conn,x,cy-H/2,x,cy+H/2,'WELD');
      conn.dim([-pw/2,cy-ph/2],[pw/2,cy-ph/2],'x',cy-ph/2-12*k,{prefix:'B = ',outward:-1});conn.dim([-pw/2,cy-ph/2],[-pw/2,cy+ph/2],'y',-pw/2-12*k,{prefix:'H = ',outward:-1});
      conn.text('PL1 '+pos.id+' / '+n(pw)+' x '+n(ph)+' x '+n(s.plate.thickness),0,cy+ph/2+9*k,3.1*k,'center');
      const wall=d.support.type==='hbeam'?d.support.hbeam.webMM:d.connection.concreteThicknessMM,sx=pw/2+wall+30*k,stub=Math.max(70,H);
      rect(conn,sx-wall,cy-ph/2-5*k,wall,ph+10*k,'SUPPORT');conn.hatchRect(sx-wall,cy-ph/2-5*k,wall,ph+10*k,5*k);
      rect(conn,sx,cy-ph/2,s.plate.thickness,ph,'PLATE');conn.hatchRect(sx,cy-ph/2,s.plate.thickness,ph,3*k);
      rect(conn,sx+s.plate.thickness,cy-H/2,stub,H);line(conn,sx+s.plate.thickness,cy-H/2+t,sx+s.plate.thickness+stub,cy-H/2+t,'NCY_HIDDEN');line(conn,sx+s.plate.thickness,cy+H/2-t,sx+s.plate.thickness+stub,cy+H/2-t,'NCY_HIDDEN');
      if(d.support.type!=='hbeam')for(const yy of [...new Set(coords.map(a=>a.y))]){const dia=d.plate.anchorMM;rect(conn,sx-d.connection.anchorHefMM,cy+yy-dia/2,d.connection.anchorHefMM+s.plate.thickness+dia*1.5,dia,'NCY_ANCHOR');line(conn,sx-d.connection.anchorHefMM-4*k,cy+yy,sx+s.plate.thickness+dia*2,cy+yy,'NCY_CENTER');}
      text(conn,sx,cy+ph/2+9*k,'SECTION D-D / '+pos.id);
      conn.leader(sx+s.plate.thickness,cy+H/2,sx+stub+15*k,cy+ph/2-4*k,['w = '+d.connection.weldSizeMM+' / '+d.connection.weldPattern,'PL t = '+n(s.plate.thickness)]);
      if(d.support.type!=='hbeam')conn.dim([sx-d.connection.anchorHefMM,cy-ph/2],[sx,cy-ph/2],'x',cy-ph/2-12*k,{prefix:'hef = ',outward:-1});
    }
    const support=sheet('support','แนวฐานรองรับ · ด้านหน้า'),supportH=d.support.type==='concrete-wall'?Math.max(s.v61.supportWallHeightMM,ph+900):d.support.beamHMM,top=d.truss.enabled?g.supportTop:supportH/2,bottom=d.truss.enabled?g.supportBottom:-supportH/2;
    const foot=bottom-(d.support.type==='dual-columns'?d.support.columnHeightM*1000:0);
    if(d.support.type==='dual-columns')for(const x of [0,W-d.support.columnBMM])rect(support,x,foot,d.support.columnBMM,top-foot,'SUPPORT');
    rect(support,0,bottom,W,top-bottom,'SUPPORT');for(const f of p.frames){for(const pos of centers)rect(support,f.xM*1000-d.steel.B/2,pos.y-d.steel.H/2,d.steel.B,d.steel.H);text(support,f.xM*1000,top+80,f.id);}
    support.dim([0,top],[W,top],'x',top+12*support.scale);text(support,0,foot-180,'RIGID SUPPORT AT BASE / '+d.support.type);
    if(d.support.type==='hbeam'){
      const hs=sheet('support-section','หน้าตัด H-beam ที่ฐาน · ขยาย'),b=d.support.beamBMM,h=d.support.beamHMM,tw=d.support.hbeam.webMM,tf=d.support.hbeam.flangeMM;
      rect(hs,0,0,b,tf,'SUPPORT');rect(hs,0,h-tf,b,tf,'SUPPORT');rect(hs,(b-tw)/2,tf,tw,h-2*tf,'SUPPORT');
      const k=hs.scale;hs.hatchRect(0,0,b,tf,4*k);hs.hatchRect(0,h-tf,b,tf,4*k);hs.hatchRect((b-tw)/2,tf,tw,h-2*tf,4*k);
      line(hs,b/2,-5*k,b/2,h+5*k,'NCY_CENTER');line(hs,-5*k,h/2,b+5*k,h/2,'NCY_CENTER');
      hs.dim([0,0],[b,0],'x',-12*k,{prefix:'B = ',outward:-1});hs.dim([0,0],[0,h],'y',-12*k,{prefix:'H = ',outward:-1});
      hs.leader((b+tw)/2,h/2,b+10*k,h*.65,['tw = '+n(tw),'tf = '+n(tf)]);hs.text('SECTION E-E / H-BEAM',b/2,h+10*k,3.5*k,'center');
    }
    for(const scene of plateDetails(d).scenes)sheets.push(scene);
    return sheets;
  }
  const ECoords=s=>root.NCYEngine.anchorCoordinates(s).anchors;
  function plateDetails(d){
    const s=V.nativeState(d),hbeam=d.support.type==='hbeam',g=root.NCYV62.rootGeometry(s);
    if(d.truss.enabled){s.plate.width=g.plateW;s.plate.height=g.plateH;}
    const forces=hbeam?[]:d.truss.enabled?g.anchorXs.map((x,i)=>({id:'A'+(i+1),x,y:0})):ECoords(s);
    const c={group:{forces}},P=D.memberProjection,scenes=[];
    const add=(id,title,make,w,h)=>{const v=D.fitView(make,w,h);Object.assign(v,{id,title});scenes.push(v);return v;};
    const front=add('plate-front','PL1 · ผังเพลท / พิกัดรู / แนวเชื่อม',k=>{
      if(!hbeam)return P.frontScene(s,c,k);
      const v=new D.Scene('PL1 / WELDED PLATE FRONT',k),W=s.plate.width,H=s.plate.height,B=s.member.B,h=s.member.H,t=s.member.tNom;
      v.meta={view:'front',holes:[]};v.rect(-W/2,-H/2,W,H,'NCY_PLATE');v.rect(-B/2,-h/2,B,h,'NCY_MEMBER');v.rect(-B/2+t,-h/2+t,B-2*t,h-2*t,'NCY_MEMBER');
      v.line(0,-H/2-5*k,0,H/2+5*k,'NCY_CENTER');v.line(-W/2-5*k,0,W/2+5*k,0,'NCY_CENTER');
      v.dim([-W/2,-H/2],[W/2,-H/2],'x',-H/2-12*k,{prefix:'B = ',outward:-1});v.dim([-W/2,-H/2],[-W/2,H/2],'y',-W/2-12*k,{prefix:'H = ',outward:-1});
      if(s.weld.pattern!=='vertical')for(const y of [-h/2,h/2])v.line(-B/2,y,B/2,y,'NCY_WELD');
      if(s.weld.pattern!=='horizontal')for(const x of [-B/2,B/2])v.line(x,-h/2,x,h/2,'NCY_WELD');
      v.leader(B/2,h/4,W/2+18*k,H/2-5*k,['RHS '+h+' x '+B+' x '+t,'W1 '+s.weld.pattern+' / w '+s.weld.size]);
      v.leader(W/2,-H/2+5*k,W/2+18*k,-H/2+8*k,['PL1 '+n(W)+' x '+n(H),'t = '+n(s.plate.thickness)+' mm']);return v;
    },215,175);
    const edge=add('plate-thickness','PL1 · รูปตัดความหนาเพลท',k=>P.edgeScene(s,k),156,41);
    if(!hbeam){add('plate-section-aa','SECTION A–A · รูปตัดผ่านแนวพุก',k=>P.sectionScene(s,c,k,false),185,127);add('plate-section-bb','SECTION B–B · รูปตัดแนวนอน',k=>P.sectionScene(s,c,k,true),185,127);}
    const sh=new D.Sheet(1,'PLATE / DETAILS',{state:s});
    sh.panel(11,33,226,205,'1',hbeam?'PL1 / FRONT VIEW + WELDS':'PL1 / FRONT VIEW + HOLE CENTRES');sh.view(front,16,53,215,175);
    sh.panel(243,33,166,132,'2',hbeam?'PLATE / WELD SCHEDULE':'DRILLING SCHEDULE / mm');
    if(hbeam)sh.table(247,54,158,['ITEM','SIZE / mm'],[['PL1',`${n(s.plate.width)} x ${n(s.plate.height)} x ${n(s.plate.thickness)}`],['W1 / HSS',s.weld.pattern+' / w '+s.weld.size],['W2 / SUPPORT','ALL / w '+d.connection.supportWeldSizeMM],['SUPPORT','H-BEAM / RIGID']], [49,109],{rowHeight:8,textHeight:2.8});
    else{sh.text(247,49,'X,Y: from lower-left corner.  x,y: from centre.',2.6);sh.table(247,54,158,['ID','X','Y','x','y'],forces.slice(0,12).map(a=>[a.id,n(a.x+s.plate.width/2),n(a.y+s.plate.height/2),n(a.x),n(a.y)]),[18,35,35,35,35],{rowHeight:6,textHeight:2.7});}
    sh.panel(243,171,166,67,'3','PL1 / THICKNESS DETAIL');sh.view(edge,248,191,156,41);
    // Geometry preview uses the same native sheet entities. The legacy Sheet.svg
    // is a report builder tied to NCYApp's other result; it must stay guarded.
    // Member PDF/DXF entry points separately require the complete current result.
    const markup=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 30 405 211" role="img" aria-label="PL1 / เพลท พิกัดรู และรูปตัด"><g transform="translate(0 297)">${sh.paper.entities.map(e=>D.entitySVG(e,1,false)).join('')}</g>${sh.views.map(({scene,tx,ty})=>`<g data-cad-view="${esc(scene.meta.view)}" data-scale="${scene.scale}" transform="translate(${tx} ${ty}) scale(${1/scene.scale})">${scene.entities.map(e=>D.entitySVG(e,scene.scale,false)).join('')}</g>`).join('')}</svg>`;
    return {scenes,forces,state:s,markup:markup.replace('<svg ','<svg data-cad-sheet="plate-detail" ')};
  }
  function bounds(sheet){const b=sheet.bounds(),pad=5*sheet.scale;return {minX:b.x1-pad,minY:b.y1-pad,maxX:b.x2+pad,maxY:b.y2+pad};}
  function svg(sheet){const b=bounds(sheet);return `<svg data-cad-sheet="${sheet.id}" viewBox="${b.minX} ${-b.maxY} ${b.maxX-b.minX} ${b.maxY-b.minY}" role="img" aria-label="${esc(sheet.title)}"><title>${esc(sheet.title)}</title>${sheet.entities.map(e=>D.entitySVG(e,sheet.scale,false)).join('')}</svg>`;}
  function dxf(d,r){if(!root.NCYSC01MemberConnections.reportAllowed(r,d))throw Error('ยังส่งออกแบบไม่ได้: ผลตรวจทุกชิ้นส่วนต้องผ่านและตรงกับข้อมูลปัจจุบัน');return root.NCYDXF.exportMember(d,r);}
  root.NCYSC01MemberDrawings=Object.freeze({VERSION:'r38',build,svg,dxf,bounds,plateDetails});
})(typeof window==='undefined'?globalThis:window);
