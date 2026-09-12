/* Input geometry and current-result views. Rendering never changes a verdict. */
(function(root){
  'use strict';
  const G=root.NCYCAD.geometry,V=root.NCYCAD.math.V;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(v,k=3)=>Number.isFinite(v)?Number(v.toFixed(k)).toLocaleString('en-US'):'—';
  const A=()=>root.NCYSC01MemberAnalysis;
  const displayUnits={label:(u,d)=>root.NCYUnits.label(u,{v55:d.design}),toDisplay:(v,u,d)=>root.NCYUnits.toDisplay(v,u,{v55:d.design})};
  function nativeState(d){
    const {s}=A().nativeState(d),a=d.plate.anchorMM,margin=d.plate.allowanceMM,c=d.connection;
    Object.assign(s.plate,{width:c.plateAuto?d.steel.B+margin:c.plateWidthMM,height:c.plateAuto?d.steel.H+margin:c.plateHeightMM,thickness:d.plate.thicknessMM,Fy:c.plateFy,Fu:c.plateFu,holeDiameterMM:a+2,standOffMM:0});
    Object.assign(s.weld,{size:c.weldSizeMM,pattern:c.weldPattern,Fexx:c.weldFexx,effectiveLengthFactor:c.weldLengthFactor});
    s.r37Support=A().clone(d.support.hbeam);
    Object.assign(s.anchors,{type:c.anchorType,diameter:a,Ase:c.anchorAseMM2,futa:c.anchorFuta,hef:c.anchorHefMM,cols:c.anchorCols,rows:c.anchorRows,plateEdgeX:c.anchorEdgeXMM,plateEdgeY:c.anchorEdgeYMM});
    s.product=A().clone(c.product);
    Object.assign(s.concrete,{fc:c.concreteFc,thickness:c.concreteThicknessMM,cracked:c.concreteCracked,edgeTop:c.edgeTopMM,edgeBottom:c.edgeBottomMM,edgeLeft:c.edgeLeftMM,edgeRight:c.edgeRightMM});
    Object.assign(s.v61,{supportType:d.support.type==='concrete-wall'?'wall':d.support.type==='dual-columns'?'dual_columns':'beam',supportLengthM:d.geometry.widthM,
      supportBeamBMM:d.support.beamBMM,supportBeamHMM:d.support.beamHMM,supportColumnBMM:d.support.columnBMM,supportColumnDMM:d.support.columnDMM,supportColumnHeightM:d.support.columnHeightM,
      systemType:d.truss.enabled?'truss':'member',trussType:d.truss.type,trussDepthMM:d.truss.depthMM,trussTipDepthMM:d.truss.tipDepthMM,trussPanels:d.truss.panels});
    Object.assign(s.brace,{H:d.web.H,B:d.web.B,tNom:d.web.t});
    const node=c.node;Object.assign(s.v63,{gussetThicknessMM:node.thicknessMM,gussetProjectionMM:node.lengthMM,nodeWeldSizeMM:node.weldMM});Object.assign(s.v64,{jointType:node.type,gussetConnectionLengthMM:node.lengthMM,gussetFyMPa:node.Fy,gussetFuMPa:node.Fu,gussetBucklingK:node.bucklingK,gussetMaxWidthMM:node.widthMM,jointEccentricityMM:node.eccentricityMM});
    // Native root plates put the anchors beside the chord. Preserve that
    // arrangement and enlarge the outline only where washer/chord clearance needs it.
    Object.assign(s.v62,{autoFitRootDepth:false,rootPlateWidthMM:c.plateAuto?Math.max(s.plate.width,d.steel.B+7*a+8):s.plate.width,
      rootPlateHeightMM:s.plate.height,anchorColsPerPlate:c.anchorCols,showRootForces:false});
    if(d.truss.enabled){
      const H=d.support.type==='concrete-wall'?s.v61.supportWallHeightMM:d.support.beamHMM,depth=d.truss.depthMM,plateW=s.v62.rootPlateWidthMM,plateH=s.v62.rootPlateHeightMM,edge=20;
      const supportTop=d.support.type==='hbeam'?H/2:d.support.type==='concrete-wall'?(H-depth)/2:edge+plateH/2,supportBottom=supportTop-H;
      const top={cy:0,y0:-plateH/2,y1:plateH/2},bottom={cy:-depth,y0:-depth-plateH/2,y1:-depth+plateH/2},anchorCols=c.anchorCols;
      const anchorXs=anchorCols===1?[0]:Array.from({length:anchorCols},(_,i)=>-plateW/2+c.anchorEdgeXMM+i*(plateW-2*c.anchorEdgeXMM)/(anchorCols-1));
      s.v62.r37Geometry={supportH:H,H,requestedDepthMM:depth,effectiveDepthMM:depth,maxDepthMM:H-2*edge-plateH,plateW,plateH,plateT:s.plate.thickness,gap:depth-plateH,edge,top,bottom,supportTop,supportBottom,
        fits:top.y1<=supportTop&&bottom.y0>=supportBottom&&depth>plateH,adjusted:false,anchorCols,anchorXs,anchorsPerPlate:anchorCols,totalAnchors:anchorCols*2};
    }
    return s;
  }
  function connectionFootprint(d){
    const s=nativeState(d),g=root.NCYV62.rootGeometry(s),points=d.truss.enabled?g.anchorXs.map(x=>({x,y:0})):root.NCYEngine.anchorCoordinates(s).anchors;
    return {width:d.truss.enabled?g.plateW:s.plate.width,height:d.truss.enabled?g.plateH:s.plate.height,
      xmin:Math.min(...points.map(p=>p.x)),xmax:Math.max(...points.map(p=>p.x)),ymin:Math.min(...points.map(p=>p.y)),ymax:Math.max(...points.map(p=>p.y))};
  }
  function rootActions(d,r,index=-1){
    if(!r||r.errors.length||r.fingerprint!==A().stable(d))return null;
    const c=index<0?r.member:r.cases[index]||r.member,s=nativeState(d),g=root.NCYV62.rootGeometry(s);
    const centers=d.truss.enabled?[{id:'TOP',y:0,N:-c.reaction.top.Fx,Vy:-c.reaction.top.Fy,M:0},{id:'BOTTOM',y:-d.truss.depthMM,N:-c.reaction.bottom.Fx,Vy:-c.reaction.bottom.Fy,M:0}]:[{id:'ROOT',y:0,N:-c.compressionKN,Vy:c.rootVertical,M:c.rootMoment}];
    const plates=centers.map(p=>{
      const coordinates=d.truss.enabled?g.anchorXs.map((x,i)=>({id:'A'+(i+1),x,y:0})):root.NCYEngine.anchorCoordinates(s).anchors;
      const sumY2=coordinates.reduce((v,q)=>v+q.y*q.y,0),count=coordinates.length;
      let anchors=coordinates.map(q=>{const normal=p.N/count+(sumY2?p.M*1000*q.y/sumY2:0);return {id:p.id+'-'+q.id,x:q.x,y:q.y+p.y,localY:q.y,T:Math.max(0,normal),C:Math.max(0,-normal),Vy:p.Vy/count,normal};});
      const calculated=r.connections?.all.find(q=>q.caseName===c.name&&q.plateId===p.id);if(calculated?.group)anchors=calculated.group.forces.map(q=>({...q,id:p.id+'-'+q.id,localY:q.y,y:q.y+p.y,C:0,normal:q.T}));
      return {...p,width:d.truss.enabled?g.plateW:s.plate.width,height:d.truss.enabled?g.plateH:s.plate.height,thickness:s.plate.thickness,anchors};
    });
    return {caseName:c.name,case:c,plates,hbeam:d.support.type==='hbeam',basis:r.connections?'แรงจากผลคำนวณจุดต่อปัจจุบัน · พุกรับแรงดึง / คอนกรีตรับแรงกด':'แรงถ่ายตามสมดุล · กลุ่มยึดสมมาตรแบบยืดหยุ่น',capacityChecked:!!r.connections};
  }
  // Only geometry is taken from the native connection result. The scoped
  // analysis supplies all displayed forces; native design verdicts stay separate.
  let geometryKey='',geometryResult=null;
  function nativeResult(d,r=null){
    const key=A().stable(d);
    if(key!==geometryKey){geometryResult=root.NCYEngine.calculate(nativeState(d));geometryKey=key;}
    const out=A().clone(geometryResult);out.scopedActions=true;out.scopedHbeam=d.support.type==='hbeam';
    if(!r||r.errors.length||r.fingerprint!==key)return out;
    const rootCases=[];
    out.cases=r.cases.map((c,i)=>{
      const data=rootActions(d,r,i),q=A().clone(out.governing),action={N:-c.compressionKN,Vx:0,Vy:c.rootVertical,Mx:c.rootMoment,My:0,Tz:0};
      q.caseDef={name:c.name,id:'SCOPED-'+i,action};q.action=action;
      q.normal={...q.normal,contact:[]};
      if(d.truss.enabled){const row={caseName:c.name};for(const side of ['top','bottom']){const p=data.plates.find(p=>p.id===side.toUpperCase());row[side]={name:side,action:{Nx:p.N,Vy:p.Vy},T:Math.max(0,p.N),C:Math.max(0,-p.N),V:Math.abs(p.Vy),Tper:Math.max(0,p.N)/p.anchors.length,Vper:Math.abs(p.Vy)/p.anchors.length};}rootCases.push(row);}
      else q.group={...q.group,forces:data.plates[0].anchors.map((a,j)=>({...a,id:'A'+(j+1),Vx:0,V:Math.abs(a.Vy)}))};
      return q;
    });
    if(d.truss.enabled){out.v63.root.g=root.NCYV62.rootGeometry(out.state);out.v63.root.cases=rootCases;}
    out.governing=out.cases[r.cases.indexOf(r.member)]||out.cases[0];
    return out;
  }
  function rootHTML(d,r,index=-1){
    const a=rootActions(d,r,index);if(!a)return '<p>คำนวณข้อมูลปัจจุบันเพื่อดูแรงคาน → เพลท → '+(d.support.type==='hbeam'?'แนวเชื่อม H-beam':'พุก')+'</p>';
    const units=displayUnits,force=units.label('kN',d),moment=units.label('kN·m',d),value=(x,u='kN')=>n(units.toDisplay(x,u,d));
    const rows=a.plates.map(p=>`<tr><th>${p.id}</th><td>${value(p.N)}</td><td>${value(p.Vy)}</td><td>${value(p.M,'kN·m')}</td></tr>`).join('');
    return `<h3>คาน → เพลท → ${a.hbeam?'แนวเชื่อม H-beam':'พุก'}</h3><p>${esc(a.caseName)}</p><table><thead><tr><th>เพลท</th><th>N (${force})</th><th>Vy (${force})</th><th>M (${moment})</th></tr></thead><tbody>${rows}</tbody></table>
      ${a.hbeam?'<p>แรงที่ต้องถ่ายผ่านแนวเชื่อมเพลทกับ H-beam; ไม่มีพุกคอนกรีตในจุดต่อนี้</p>':`<details class="sm-details" open><summary>แรงที่กลุ่มพุก / แรงกดรองรับ</summary><table><thead><tr><th>ตำแหน่ง</th><th>ดึง T (${force})</th><th>กด C (${force})</th><th>Vy (${force})</th></tr></thead><tbody>${a.plates.flatMap(p=>p.anchors).map(q=>`<tr><td>${q.id}</td><td>${value(q.T)}</td><td>${value(q.C)}</td><td>${value(q.Vy)}</td></tr>`).join('')}</tbody></table></details>`}
      <p class="sm-note">${esc(a.basis)} · ΣT − แรงกดสัมผัส = N; รวมโมเมนต์และแรงเฉือนต้องสมดุล</p><p class="sm-note">ดูคำตัดสินกำลังเพลท รอยเชื่อม และพุกในผลตรวจจุดต่อ</p>`;
  }
  function trussSVG(d,r=null,{deformed=false,caseIndex=-1,compact=false}={}){
    const g=r?.truss?.geo||root.NCYSC01MemberTruss.geometry(d),c=r?(deformed?r.deflection:caseIndex<0?r.member:r.cases[caseIndex]):null;
    const scale=deformed&&c?Math.min(100,Math.max(1,d.truss.depthMM/Math.max(c.maxMM,1e-6)*.2)):1;
    const maxY=d.cable.enabled?d.cable.heightM*1000:0,depth=d.truss.depthMM+maxY,width=720,geometryScale=Math.min(580/g.L,340/depth),left=(width-g.L*geometryScale)/2;
    const x=p=>left+p.x*geometryScale,y=p=>55+(maxY-p.y)*geometryScale;
    const point=(i,def=false)=>{const p=g.nodes[i];return {x:p.x+(def&&c?c.u[i*2]*scale:0),y:p.y+(def&&c?c.u[i*2+1]*scale:0)};};
    const members=g.members.map(m=>{const a=point(m.a),b=point(m.b),q=c?.members.find(q=>q.id===m.id),col=q?.N<0?'#b66a19':q?'#176995':'#466277';return `<path data-truss-member="${m.id}" d="M${x(a)} ${y(a)}L${x(b)} ${y(b)}" stroke="${col}" stroke-width="${m.kind==='chord'?5:3}"/>`;}).join('');
    const def=deformed&&c?g.members.map(m=>{const a=point(m.a,true),b=point(m.b,true),q=c.members.find(q=>q.id===m.id),line=q.points.map((p,i)=>{const t=p.x*1000/m.length,z={x:a.x*(1-t)+b.x*t-p.deflection*m.sn*scale,y:a.y*(1-t)+b.y*t+p.deflection*m.c*scale};return `${i?'L':'M'}${x(z)} ${y(z)}`;}).join('');return `<path d="${line}" stroke="#bf4036" stroke-width="2"/>`;}).join(''):'';
    const arrows=Array.from({length:13},(_,i)=>{const xx=x({x:g.L*i/12}),yy=y({y:0})-38;return `<path d="M${xx} ${yy}v30m-4 -6l4 6 4 -6" stroke="#167258"/>`;}).join('');
    const cable=d.cable.enabled?`<path d="M${x({x:0})} ${y({y:maxY})}L${x({x:g.L})} ${y({y:0})}" stroke="#a17922" stroke-width="2"/>`:'';
    const bottom=y(g.nodes[g.bottom[0]])+45;
    return `<svg viewBox="0 0 ${width} ${bottom+28}" role="img" aria-label="${esc(root.NCYSC01MemberTruss.types[d.truss.type])}" class="sm-truss-svg${compact?' sm-compact-truss':''}"><g fill="none" stroke-linecap="round">${members}${def}${arrows}${cable}</g><g fill="#183d55">${g.nodes.filter((_,i)=>i<4||i>=g.nodes.length-2).map(p=>`<circle cx="${x(p)}" cy="${y(p)}" r="4"/>`).join('')}</g></svg>
      <p class="sm-note">ยื่น ${n(d.geometry.projectionM)} m · ${g.n} ช่อง · ลึก ${d.truss.depthMM} mm${d.cable.enabled?' · จุดรั้งสูง '+n(d.cable.heightM)+' m':''}</p><p class="sm-note">${deformed&&c?'เส้นแดงขยาย '+n(scale,1)+' เท่า · การแอ่นจากผล SLS '+esc(c.name):'แรงดึงสีน้ำเงิน · แรงอัดสีส้ม · หน้าตัดและรูปทรงตามข้อมูลที่เลือก'}</p>`;
  }
  function rootSVG(d){
    const s=nativeState(d),g=root.NCYV62.rootGeometry(s),tr=d.truss.enabled,ys=tr?[0,-g.effectiveDepthMM]:[0],pw=tr?g.plateW:s.plate.width,ph=tr?g.plateH:s.plate.height;
    const height=(tr?g.effectiveDepthMM:0)+ph+120,scale=Math.min(330/height,480/(pw+120)),x=v=>360+v*scale,y=v=>50+(ph/2-v)*scale;
    const coords=tr?g.anchorXs.map(x=>({x,y:0})):root.NCYEngine.anchorCoordinates(s).anchors;
    const weld=cy=>{const paths=[];if(s.weld.pattern!=='vertical')for(const yy of [-d.steel.H/2,d.steel.H/2])paths.push(`M${x(-d.steel.B/2)} ${y(cy+yy)}H${x(d.steel.B/2)}`);if(s.weld.pattern!=='horizontal')for(const xx of [-d.steel.B/2,d.steel.B/2])paths.push(`M${x(xx)} ${y(cy-d.steel.H/2)}V${y(cy+d.steel.H/2)}`);return `<path data-weld-pattern="${s.weld.pattern}" d="${paths.join(' ')}" fill="none" stroke="#bd731e" stroke-width="4"/>`;};
    return `<svg viewBox="0 0 720 430" role="img" aria-label="เพลทและพุกตามขนาดที่เลือก">${ys.map((cy,i)=>`<rect x="${x(-pw/2)}" y="${y(cy+ph/2)}" width="${pw*scale}" height="${ph*scale}" fill="#dce8f2" stroke="#28608a"/><rect x="${x(-d.steel.B/2)}" y="${y(cy+d.steel.H/2)}" width="${d.steel.B*scale}" height="${d.steel.H*scale}" fill="white" stroke="#385565"/>${weld(cy)}${d.support.type==='hbeam'?'':coords.map(a=>`<circle cx="${x(a.x)}" cy="${y(cy+a.y)}" r="${d.plate.anchorMM/2*scale}" fill="#a87b36"/>`).join('')}<text x="${x(pw/2)+18}" y="${y(cy)}">${tr?(i?'BOTTOM':'TOP'):'ROOT'}</text>`).join('')}<text x="110" y="395">${n(pw)} × ${n(ph)} × ${n(s.plate.thickness)} mm · เชื่อม ${{all:'รอบ',horizontal:'X',vertical:'Y'}[s.weld.pattern]} w ${s.weld.size} mm</text></svg>`;
  }
  function tube(a,b,r){
    const mesh={p:[],n:[]},dir=V.unit(V.sub(b,a)),u=V.unit(V.cross(dir,Math.abs(dir[1])>.9?[1,0,0]:[0,1,0])),v=V.cross(dir,u);
    const radial=t=>V.mul(V.add(V.mul(u,Math.cos(t)),V.mul(v,Math.sin(t))),r);
    for(let i=0;i<10;i++){const ra=radial(i*Math.PI/5),rb=radial((i+1)*Math.PI/5),p=[V.add(a,ra),V.add(a,rb),V.add(b,rb),V.add(b,ra)],normal=V.unit(V.add(ra,rb));for(const k of [0,1,2,0,2,3]){mesh.p.push(...p[k]);mesh.n.push(...normal);}}return mesh;
  }
  function sceneGeometry(d,p,stage='purlin',actions=null){
    const error=A().validate(d,{geometryOnly:true})[0];if(error)throw Error(error.message);
    const data=nativeResult(d),v=Object.create(root.NCYCAD.Viewer.prototype);
    // Build one unchanged native assembly. Replicate it at the analysis grid,
    // rather than using the native roof's capped/context-only frame layout.
    Object.assign(v,{data,meshes:[],annotations:[],dims:[],range:stage==='root'?'detail':'full',v6Scene:stage==='root'?'connection':'loads',roofScope:'bay',
      showRoof:false,showPurlins:false,showLoads:false,showDims:false,showAccessories:false,showTributary:false,field:'material',loadMode:'components',software:true,
      clear(){this.meshes=[];this.annotations=[];this.dims=[];},draw(){},fit(){},
      add(g,id,kind,color,alpha=1,metal=.35){this.meshes.push({g,id,kind,color,alpha,metal});}});
    v.build();
    let meshes=v.meshes.filter(m=>!['load','field','purlin','roof','roof-sheet','roof-accessory','roof-skin'].includes(m.kind));
    const annotations=[],dims=[],supports=[],add=(g,id,kind,color,alpha=1)=>meshes.push({g,id,kind,color,alpha});
    const face=v.geo.face,L=d.geometry.projectionM*1000,W=d.geometry.widthM*1000,py=d.steel.H/2+d.purlin.H/2,green=[.08,.46,.33],gold=[.66,.49,.19];
    const frameX=f=>(f.xM-d.geometry.widthM/2)*1000;
    if(stage!=='root'){
      const assembly=meshes.filter(m=>!['concrete','edge'].includes(m.kind));
      meshes=meshes.filter(m=>['concrete','edge'].includes(m.kind));
      for(const f of p.frames){
        const dx=frameX(f),selected=f.index===p.frame.index;
        supports.push({id:f.id,xM:f.xM,p:[dx,0,face],selected});
        for(const m of assembly){const points=m.g.p.map((value,i)=>value+(i%3===0?dx:0));meshes.push({...m,id:f.id+'::'+m.id,frameId:f.id,g:{p:points,n:m.g.n},alpha:selected?m.alpha:Math.min(m.alpha,.7)});}
        if(p.frames.length<=9||selected||f.index===0||f.index===p.frames.length-1)annotations.push({p:[dx,-d.steel.H/2-70,face+L],text:f.id+(selected?' · ที่เลือก':''),kind:'support'});
      }
      annotations.push({p:[frameX(p.frame),-d.steel.H/2-70,face],text:`ฐานยึดแน่น ${p.frame.id}`,kind:'support'});
    }
    function arrow(at,dir,length,color,id){const end=V.add(at,V.mul(dir,length)),unit=V.unit(dir),side=V.unit(V.cross(unit,Math.abs(unit[1])>.9?[1,0,0]:[0,1,0]));add(tube(at,end,3),id,'load',color);for(const sign of [-1,1])add(tube(end,V.add(V.sub(end,V.mul(unit,18)),V.mul(side,sign*9)),3),id+'-head'+sign,'load',color);}
    // H-beam is a requested new support option; existing plate/weld meshes stay.
    if(d.support.type==='hbeam'){
      meshes=meshes.filter(m=>!['concrete','anchor','washer','root-anchor','root-washer','resin'].includes(m.kind));
      const h=d.support.beamHMM,top=h/2,bottom=-h/2,w=stage==='root'?900:W+300,web=d.support.hbeam.webMM,tf=d.support.hbeam.flangeMM;
      add(G.box(-w/2,w/2,top-tf,top,-web/2-d.support.beamBMM/2,-web/2+d.support.beamBMM/2),'support-H-top','steel',[.43,.52,.60]);
      add(G.box(-w/2,w/2,bottom,bottom+tf,-web/2-d.support.beamBMM/2,-web/2+d.support.beamBMM/2),'support-H-bottom','steel',[.43,.52,.60]);
      add(G.box(-w/2,w/2,bottom,top,-web,0),'support-H-web','steel',[.43,.52,.60]);
    }
    if(stage!=='root'){
      for(const line of p.lines){
        const z=face+line.zM*1000,selected=line.id===p.purlin.id;add(root.NCYSC01Purlins.geometry(d.purlin.B,d.purlin.H,d.purlin.t,W,[-W/2,py,z]),line.id,'purlin',selected?[.12,.48,.72]:[.43,.55,.64],selected?1:.75);
        for(let j=0;j<17;j++)arrow([-W/2+W*j/16,py+220,z],[0,-1,0],160,d.loads.liveKPa>0?green:[.55,.60,.65],'LL-'+line.id+'-'+j);
      }
      const units=displayUnits;
      annotations.push({p:[0,py+330,face+p.purlin.zM*1000],text:`LL ${n(units.toDisplay(d.loads.liveKPa,'kN/m²',d))} ${units.label('kN/m²',d)} · ตลอดแนวแป`,kind:'load'});
      const spanIndex=Math.min(p.frame.index,p.frames.length-2),dimY=-d.steel.H/2-100,dimZ=face+L+380;
      for(let i=0;i<p.frames.length-1;i++)if(p.grid.bays<=6||i===spanIndex)dims.push({a:[frameX(p.frames[i]),dimY,dimZ],b:[frameX(p.frames[i+1]),dimY,dimZ],text:`ช่วงแป ${n(p.frames[i+1].xM-p.frames[i].xM)} m`});
      dims.push({a:[-W/2,dimY,dimZ+450],b:[W/2,dimY,dimZ+450],text:`กว้างรวม ${n(d.geometry.widthM)} m · ${p.grid.bays} ช่วง`});
      const pi=Math.min(p.purlin.index,p.lines.length-2),a=p.lines[pi],b=p.lines[pi+1];
      dims.push({a:[W/2+260,py,face+a.zM*1000],b:[W/2+260,py,face+b.zM*1000],text:`@ แป ${n(b.zM-a.zM)} m`});
      dims.push({a:[-W/2-300,0,face],b:[-W/2-300,0,face+L],text:`คานยื่น ${n(d.geometry.projectionM)} m`});
      if(d.cable.enabled){for(const f of p.frames){const x=frameX(f);add(tube([x,d.cable.heightM*1000,face],[x,0,face+L],d.cable.diameterMM/2),'cable-'+f.id,'steel',gold,f.index===p.frame.index?1:.7);}annotations.push({p:[frameX(p.frame),d.cable.heightM*500,face+L/2],text:'สลิงหนึ่งเส้นต่อคาน',kind:'load'});}
    }
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const m of meshes.filter(m=>d.support.type==='dual-columns'&&stage!=='root'||m.kind!=='concrete'&&!String(m.id).startsWith('support-H-')))for(let i=0;i<m.g.p.length;i++){const a=i%3;bounds.min[a]=Math.min(bounds.min[a],m.g.p[i]);bounds.max[a]=Math.max(bounds.max[a],m.g.p[i]);}
    for(const point of [...dims.flatMap(q=>[q.a,q.b]),...annotations.map(q=>q.p)])for(let i=0;i<3;i++){bounds.min[i]=Math.min(bounds.min[i],point[i]);bounds.max[i]=Math.max(bounds.max[i],point[i]);}
    return {meshes,annotations,dims,supports,bounds,native:true,geo:v.geo};
  }
  class Scene{
    constructor(canvas,overlay){this.viewer=new root.NCYCAD.Viewer(canvas,overlay);Object.assign(this.viewer,{data:null,showDims:true,xray:false,selected:null});}
    update(d,p,stage,actions){
      const data=sceneGeometry(d,p,stage,actions),v=this.viewer,rect=v.canvas.getBoundingClientRect(),compact=rect.width<520;
      const key=JSON.stringify([stage,d.geometry,d.truss,d.support,d.steel,d.purlin,d.web,d.plate,d.connection,d.cable,Math.round(rect.width),Math.round(rect.height)]);
      v.clear();for(const m of data.meshes)v.add(m.g,m.id,m.kind,m.color,m.alpha,m.metal??.35);
      v.bounds=data.bounds;
      v.dims=compact?data.dims.filter(q=>!q.text.startsWith('กว้างรวม')).map(q=>({...q,text:q.text.replace('ช่วงแป ','').replace('คานยื่น ','ยื่น ')})):data.dims;
      v.annotations=compact?data.annotations.filter(q=>!q.text.startsWith('ฐานยึดแน่น')).map(q=>({...q,text:q.text.replace(' · ที่เลือก','').replace(' · ตลอดแนวแป','').replace('สลิงหนึ่งเส้นต่อคาน','สลิง')})):data.annotations;
      if(key!==this.key){v.fit('iso');this.key=key;}v.draw();this.data=data;return data;
    }
    fit(view='iso'){this.viewer.fit(view);this.viewer.draw();}
  }
  function decorateSupport(viewer,d){
    if(d.support.type!=='hbeam')return;
    const retained=viewer.meshes.filter(m=>!['concrete','anchor','washer','root-anchor','root-washer','resin'].includes(m.kind));
    const additions=sceneGeometry(d,root.NCYSC01MemberLoads.project(d),'root').meshes.filter(m=>String(m.id).startsWith('support-H-'));
    const notes=viewer.annotations;viewer.clear();for(const m of [...retained,...additions])viewer.add(m.g,m.id,m.kind,m.color,m.alpha,m.metal);viewer.annotations=notes;
  }
  function diagramSeries(d,r,{component='main',kind='M',caseIndex=-1,purlinId='P02',barId='TC1'}={}){
    if(!r||r.errors.length||r.fingerprint!==A().stable(d))throw Error('คำนวณข้อมูลปัจจุบันก่อนดูกราฟ');
    const service=kind==='deflection',unit=service?'mm':kind==='M'?'kN·m':'kN';let choices,points,title,section,selected;
    if(component==='purlin'){
      choices=(service?r.purlins.service:r.purlins.cases).filter(q=>q.id===purlinId);if(!choices.length)throw Error('ไม่พบแนวแปที่เลือก');
      const max=q=>Math.max(...q.points.map(p=>Math.abs(p[service?'D':kind])));selected=caseIndex<0?choices.reduce((a,b)=>max(b)>max(a)?b:a):choices[caseIndex]||choices[0];
      points=selected.points.map(p=>({...p,deflection:p.D}));title=selected.id+' · แป '+d.purlin.H+'×'+d.purlin.B+'×'+d.purlin.t;section=d.purlin;
    }else{
      choices=service?r.service:r.cases;const max=q=>component==='bar'?Math.max(...(q.members.find(m=>m.id===barId)||q.members[0]).points.map(p=>Math.abs(p[kind]))):Math.max(...q.points.map(p=>Math.abs(p[kind])));
      selected=caseIndex<0?choices.reduce((a,b)=>max(b)>max(a)?b:a):choices[caseIndex]||choices[0];
      if(component==='bar'&&r.truss){const m=selected.members.find(m=>m.id===barId)||selected.members[0];points=m.points;title=m.id+' · สมาชิกโครงถัก';section=m.section;}
      else{points=selected.points;title=r.truss?'รวมโครงถักตามแนวคาน':'คานยื่น';section=d.steel;}
    }
    return {component,kind,unit,points,section,title,caseName:selected.name||selected.caseName,choices:choices.map(q=>q.name||q.caseName),max:Math.max(...points.map(p=>Math.abs(p[kind]))),lengthM:points.at(-1).x};
  }
  class DiagramScene{
    constructor(canvas,overlay){this.viewer=new root.NCYCAD.Viewer(canvas,overlay);Object.assign(this.viewer,{data:null,showDims:true,xray:false});}
    update(series,d){
      const v=this.viewer,L=series.lengthM*1000,sec=series.section,H=sec.H||d.steel.H,B=sec.B||d.steel.B,t=sec.t||d.steel.t;
      const amplitude=Math.max(120,L*.16),scale=amplitude/Math.max(series.max,1e-12),base=H/2+amplitude+80;
      const color=series.kind==='deflection'?[.7,.21,.16]:[.12,.42,.66],xyz=p=>[p.x*1000,base+p[series.kind]*scale*(series.kind==='deflection'?-1:1),0];
      v.clear();v.add(root.NCYSC01Purlins.geometry(B,H,t,L,[0,0,0]),'diagram-member','steel',[.54,.61,.68],.5,.2);
      v.add(tube([0,base,0],[L,base,0],Math.max(1,L/1300)),'diagram-zero','steel',[.55,.58,.61],1,.1);
      const points=series.points.filter((p,i)=>i===0||p.x!==series.points[i-1].x||p[series.kind]!==series.points[i-1][series.kind]);
      for(let i=1;i<points.length;i++){const a=xyz(points[i-1]),b=xyz(points[i]);if(V.len(V.sub(a,b))>1e-7)v.add(tube(a,b,Math.max(2,L/1000)),'diagram-'+i,'steel',color,1,.1);}
      for(let i=0;i<points.length;i+=Math.max(1,Math.floor(points.length/16))){const a=xyz(points[i]),b=[a[0],base,0];if(V.len(V.sub(a,b))>1e-7)v.add(tube(a,b,Math.max(1,L/1600)),'diagram-ordinate-'+i,'steel',color,.45,.1);}
      const peak=points.reduce((a,b)=>Math.abs(b[series.kind])>Math.abs(a[series.kind])?b:a),u=root.NCYSC01MemberConnections.units;
      v.annotations=[{p:xyz(peak),text:n(u.toDisplay(peak[series.kind],series.unit,d))+' '+u.label(series.unit,d),kind:'load'}];
      v.dims=[{a:[0,-H-100,0],b:[L,-H-100,0],text:n(series.lengthM)+' m'}];
      const yy=points.map(p=>xyz(p)[1]);v.bounds={min:[-60,Math.min(-H-130,...yy)-50,-B],max:[L+60,Math.max(H/2,...yy)+80,B]};
      const key=JSON.stringify([series.component,L,H,B,series.kind,v.canvas.clientWidth,v.canvas.clientHeight]);if(key!==this.key){v.fit('iso');this.key=key;}v.draw();
      this.data={...series,scale,exaggeration:series.kind==='deflection'?scale:null,vertices:points.map(xyz)};return this.data;
    }
    fit(view='iso'){this.viewer.fit(view);this.viewer.draw();}
  }
  root.NCYSC01MemberViews=Object.freeze({VERSION:'r37',nativeState,connectionFootprint,nativeResult,rootActions,rootHTML,rootSVG,trussSVG,sceneGeometry,decorateSupport,Scene,diagramSeries,DiagramScene});
})(typeof window==='undefined'?globalThis:window);
