/* Pending physical geometry only. Never installs a state or calculation result. */
(function(root){
  'use strict';
  const physical=new Set(['steel','purlin','roof-frame','concrete','plate','root-plate',
    'brace','stiffener','gutter','truss-chord','truss-web']);
  const palette={steel:[.4,.47,.53],purlin:[.34,.46,.57],plate:[.14,.38,.67]};
  function bounds(g){
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<g.p.length;i++){
      if(!Number.isFinite(g.p[i]))throw Error('พิกัดโมเดลไม่ถูกต้อง');
      min[i%3]=Math.min(min[i%3],g.p[i]);max[i%3]=Math.max(max[i%3],g.p[i]);
    }
    return {min,max};
  }
  function section(spec){
    const s={H:spec?.depthMm,B:spec?.widthMm,t:spec?.thicknessMm};
    if(!Object.values(s).every(v=>Number.isFinite(v)&&v>0)||2*s.t>=Math.min(s.H,s.B))throw Error('ขนาดหน้าตัดกลวงไม่ถูกต้อง');
    return s;
  }
  function trussGeometry(source,state,items,api){
    if(!api.rootGeometry||!api.plate)throw Error('ข้อมูลรูปทรง Truss ยังไม่พร้อม');
    const next=JSON.parse(JSON.stringify(state));
    for(const item of items){
      const sp=item.row.specs;
      if(item.slot==='member'||item.slot==='trussWeb'){
        const shape=section(sp);Object.assign(item.slot==='member'?next.member:next.brace,{H:shape.H,B:shape.B,tNom:shape.t});
      }else if(item.slot==='purlin'){
        const shape=section(sp);Object.assign(next.takeoff,{purlinH:shape.H,purlinB:shape.B,purlinT:shape.t,includePurlins:true});
      }else if(item.slot==='plate'){
        Object.assign(next.plate,{width:sp.widthMm,height:sp.heightMm,thickness:sp.thicknessMm,holeDiameterMM:sp.holeDiameterMm});
        Object.assign(next.v62,{rootPlateWidthMM:sp.widthMm,rootPlateHeightMM:sp.heightMm});
      }
    }
    const original=api.rootGeometry(JSON.parse(JSON.stringify(state))),target=api.rootGeometry(next);
    const plateItem=items.find(x=>x.slot==='plate');
    // Show the requested stock size even when native validation reports that it
    // cannot fit. This remains a draft; no silently resized product is accepted.
    if(plateItem){target.plateW=plateItem.row.specs.widthMm;target.plateH=plateItem.row.specs.heightMm;}
    const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>{const len=Math.hypot(...a);if(!(len>1e-8))throw Error('แนวสมาชิก Truss ไม่ถูกต้อง');return a.map(x=>x/len);};
    function axis(mesh){
      // Native HSS emits outer wall, inner wall, then its end cap. The end-cap
      // normal gives the exact longitudinal axis, including sloping webs.
      const d=unit(Array.from(mesh.g.n.slice(36,39))),u=[1,0,0],v=unit(cross(d,u));
      const limits=[u,v,d].map(dir=>{let lo=Infinity,hi=-Infinity;for(let i=0;i<mesh.g.p.length;i+=3){const q=dot(mesh.g.p.slice(i,i+3),dir);lo=Math.min(lo,q);hi=Math.max(hi,q);}return [lo,hi];});
      const a=u.map((x,i)=>x*(limits[0][0]+limits[0][1])/2+v[i]*(limits[1][0]+limits[1][1])/2+d[i]*limits[2][0]);
      return {a,b:a.map((x,i)=>x+d[i]*(limits[2][1]-limits[2][0]))};
    }
    const face=source.geo?.face??state.plate.thickness,faceNext=face+next.plate.thickness-state.plate.thickness;
    const oldLength=Math.max(...(source.meshes||[]).filter(m=>m.kind==='truss-chord').flatMap(m=>{const q=axis(m);return [q.a[2]-face,q.b[2]-face];}));
    if(!(oldLength>0))throw Error('ยังไม่มีสมาชิก Truss ในฉากนี้');
    const cropped=source.v6Scene==='connection'||source.range==='detail';
    const length=cropped?Math.min(next.member.lengthM*1000,Math.max(1100,target.plateW*5)):next.member.lengthM*1000;
    function point(p){
      const ratio=(p[2]-face)/oldLength;
      const depth=(g,s)=>s.v61.trussType==='tri_tapered'?g.effectiveDepthMM+(Math.max(20,Math.min(g.effectiveDepthMM,s.v61.trussTipDepthMM))-g.effectiveDepthMM)*ratio:g.effectiveDepthMM;
      return [p[0],Math.abs(p[1])<1e-7?0:p[1]*depth(target,next)/depth(original,state),faceNext+ratio*length];
    }
    const member={H:next.member.H,B:next.member.B,t:next.member.tNom},web={H:next.brace.H,B:next.brace.B,t:next.brace.tNom},purlin={H:next.takeoff.purlinH,B:next.takeoff.purlinB,t:next.takeoff.purlinT};
    const meshes=[];let mains=0,webs=0,purlins=0;
    for(const m of source.meshes||[]){
      if(!physical.has(m.kind)||!m.g?.p?.length)continue;
      let g,dimensions;
      if(m.kind==='truss-chord'||m.kind==='truss-web'){
        const old=axis(m),a=point(old.a),b=point(old.b),d=b.map((x,i)=>x-a[i]);
        dimensions=m.kind==='truss-chord'?member:web;
        g=api.hss(dimensions.B,dimensions.H,dimensions.t,Math.hypot(...d),a,unit(d));
        if(m.kind==='truss-chord')mains++;else webs++;
      }else if(m.kind==='root-plate'){
        const box=bounds(m.g),x=(box.min[0]+box.max[0])/2,cy=(box.min[1]+box.max[1])/2<-.001?target.bottom.cy:target.top.cy;
        g=api.plate(target.plateW,target.plateH,next.plate.thickness,0,target.anchorXs.map(x=>({x,y:0})),next.plate.holeDiameterMM);
        for(let i=0;i<g.p.length;i+=3){g.p[i]+=x;g.p[i+1]+=cy;}
        dimensions={B:target.plateW,H:target.plateH,t:next.plate.thickness};
      }else if(m.kind==='purlin'){
        if(!next.takeoff.includePurlins)continue;
        const box=bounds(m.g),y=(box.min[1]+box.max[1])/2+(member.H-state.member.H+purlin.H-state.takeoff.purlinH)/2,z=(box.min[2]+box.max[2])/2+faceNext-face;
        g=api.purlin(purlin.B,purlin.H,purlin.t,box.max[0]-box.min[0],[box.min[0],y,z]);dimensions=purlin;purlins++;
      }else{
        g={p:Array.from(m.g.p),n:Array.from(m.g.n)};
        if(m.kind==='concrete')for(let i=1;i<g.p.length;i+=3)g.p[i]+=target.supportTop-original.supportTop;
      }
      meshes.push({id:m.id,kind:m.kind,g,section:dimensions&&{...dimensions},color:palette[m.kind]||Array.from(m.color),alpha:m.alpha,metal:m.metal});
    }
    if(items.some(x=>x.slot==='purlin')&&!purlins){
      const roof=source.v6Roof;if(!roof)throw Error('ยังไม่มีรูปทรงหลังคาสำหรับวางแป');
      for(const line of api.layout(next).lines){
        if(line.zM*1000>roof.viewL+.001)continue;
        const oldZ=roof.beamStart+line.zM*1000,z=oldZ+faceNext-face;
        const y=roof.yRoot-(oldZ-roof.z0)*Math.tan(roof.slope)-roof.roofT-state.takeoff.purlinH/2+(member.H-state.member.H+purlin.H-state.takeoff.purlinH)/2;
        meshes.push({id:'draft-'+line.id,kind:'purlin',g:api.purlin(purlin.B,purlin.H,purlin.t,roof.width,[-roof.width/2,y,z]),section:{...purlin},color:palette.purlin,alpha:1,metal:.5});purlins++;
      }
    }
    const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const m of meshes){const b=bounds(m.g);for(let i=0;i<3;i++){box.min[i]=Math.min(box.min[i],b.min[i]);box.max[i]=Math.max(box.max[i],b.max[i]);}}
    return {meshes,bounds:box,member,web,purlin,mains,webs,purlins,truss:true};
  }
  function geometry(source,state,items,api){
    if(state.v61?.systemType==='truss')return trussGeometry(source,state,items,api);
    const memberItem=items.find(x=>x.slot==='member'),purlinItem=items.find(x=>x.slot==='purlin');
    const member=memberItem?section(memberItem.row.specs):{H:state.member.H,B:state.member.B,t:state.member.tNom};
    const purlin=purlinItem?section(purlinItem.row.specs):{H:state.takeoff.purlinH,B:state.takeoff.purlinB,t:state.takeoff.purlinT};
    const mainRise=(member.H-state.member.H)/2;
    const purlinRise=mainRise+(purlin.H-state.takeoff.purlinH)/2;
    const meshes=[];let mains=0,purlins=0;
    for(const m of source.meshes||[]){
      if(!physical.has(m.kind)||!m.g?.p?.length)continue;
      const b=bounds(m.g),center=b.min.map((v,i)=>(v+b.max[i])/2);
      const isMain=m.kind==='steel'&&(m.id==='member'||/\/M1$/.test(m.id))||m.kind==='roof-frame';
      let g,dimensions;
      if(isMain){
        mains++;
        g=api.hss(member.B,member.H,member.t,b.max[2]-b.min[2],[center[0],center[1],b.min[2]]);
        dimensions={...member};
      }else if(m.kind==='purlin'){
        purlins++;
        g=api.purlin(purlin.B,purlin.H,purlin.t,b.max[0]-b.min[0],[b.min[0],center[1]+purlinRise,center[2]]);
        dimensions={...purlin};
      }else{
        // Connection hardware/loads are not copied. Plates/support remain
        // context until native calculation accepts the full material batch.
        g={p:Array.from(m.g.p),n:Array.from(m.g.n)};
        if(m.kind==='gutter')for(let i=1;i<g.p.length;i+=3)g.p[i]+=mainRise+purlin.H-state.takeoff.purlinH;
      }
      meshes.push({id:m.id,kind:m.kind,g,section:dimensions,color:palette[m.kind]||Array.from(m.color),alpha:m.alpha,metal:m.metal});
    }
    // A selected purlin is visible even if the accepted layer was turned off.
    if(purlinItem&&!purlins){
      const roof=source.v6Roof;
      if(!roof)throw Error('ยังไม่มีรูปทรงหลังคาสำหรับวางแป กรุณาเปิดฉากหลังคาก่อนเลือก');
      for(const line of api.layout(state).lines){
        if(line.zM*1000>roof.viewL+.001)continue;
        const z=roof.beamStart+line.zM*1000;
        const y=roof.yRoot-(z-roof.z0)*Math.tan(roof.slope)-roof.roofT-state.takeoff.purlinH/2+purlinRise;
        meshes.push({id:'draft-'+line.id,kind:'purlin',g:api.purlin(purlin.B,purlin.H,purlin.t,roof.width,[-roof.width/2,y,z]),section:{...purlin},color:palette.purlin,alpha:1,metal:.5});
        purlins++;
      }
    }
    if(memberItem&&!mains)throw Error('ยังไม่มีคานหลักในฉากนี้สำหรับแสดงหน้าตัดที่เลือก');
    if(!meshes.length)throw Error('ยังไม่มีโมเดล 3D สำหรับแสดงวัสดุที่เลือก');
    const box={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const m of meshes){const b=bounds(m.g);for(let i=0;i<3;i++){box.min[i]=Math.min(box.min[i],b.min[i]);box.max[i]=Math.max(box.max[i],b.max[i]);}}
    return {meshes,bounds:box,member,purlin,mains,purlins};
  }
  const api={geometry,bounds};root.NCYSC01Draft3D=api;
  if(!root.document||!root.NCYApp||!root.NCYCAD?.Viewer)return;
  const doc=root.document,app=root.NCYApp,$=id=>doc.getElementById(id);
  let viewer=null,canvas=null,lastMeshes=null,lastKey='',lastBounds='',renderCount=0;
  function dispose(){
    if(!viewer)return;
    const context=viewer?.gl;
    viewer?.dispose();viewer=null;lastMeshes=null;lastKey='';lastBounds='';
    // Detach before releasing the context so native loss events stay local.
    if(canvas){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);canvas=fresh;}
    context?.getExtension('WEBGL_lose_context')?.loseContext();
  }
  function mount(host){
    if(host.querySelector('#sc01DraftCanvas'))return;
    host.innerHTML='<header><h2>3D ตามข้อมูลที่กำลังแก้ <span>รอคำนวณ</span></h2><p id="sc01DraftDimensions"></p></header>'+
      '<div class="sc01-draft-camera" role="group" aria-label="มุมมองโมเดลที่กำลังเลือก">'+
      [['iso','ISO'],['front','หน้า'],['side','ข้าง'],['top','บน'],['out','−'],['in','+'],['fit','พอดีจอ']].map(([key,text])=>'<button type="button" data-draft-camera="'+key+'" aria-label="'+({out:'ซูมออก',in:'ซูมเข้า'}[key]||text)+'">'+text+'</button>').join('')+'</div>'+
      '<div class="sc01-draft-canvas-wrap"><canvas id="sc01DraftCanvas" tabindex="0" aria-label="โมเดล 3D ตามข้อมูลที่กรอก รอคำนวณ"></canvas><p id="sc01Draft3DError" role="status" hidden></p><span class="sc01-draft-badge">ภาพรูปทรง · รอคำนวณ</span></div>'+
      '<p class="sc01-draft-note">หมุนและซูมดูขนาดได้ · แรงและรายละเอียดจุดต่ออัปเดตหลังกดคำนวณ</p>'+
      '<div class="sc01-draft-actions"><button type="button" data-sc01-calculate>คำนวณและดูผล</button><button type="button" data-sc01-return-input>กลับแก้ข้อมูล</button><button type="button" data-sc01-cancel-preview>ยกเลิกการเลือก</button></div>';
    host.addEventListener('click',event=>{
      const button=event.target.closest('[data-draft-camera]');if(button)camera(button.dataset.draftCamera);
    });
    host.addEventListener('keydown',event=>{
      if(event.target.id!=='sc01DraftCanvas'||!viewer||event.ctrlKey||event.metaKey||event.altKey)return;
      const choice={'+':'in','=':'in','-':'out',Home:'fit','1':'iso','2':'front','3':'side','4':'top'}[event.key];
      if(choice){event.preventDefault();camera(choice);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      if(event.key==='ArrowLeft')viewer.az-=.1;if(event.key==='ArrowRight')viewer.az+=.1;
      if(event.key==='ArrowUp')viewer.el=Math.min(1.45,viewer.el+.1);if(event.key==='ArrowDown')viewer.el=Math.max(-1.45,viewer.el-.1);
      viewer.draw();
    });
  }
  function camera(choice){
    if(!viewer)return;
    if(['iso','front','side','top'].includes(choice)){viewer.fit(choice);return;}
    if(choice==='fit'){viewer.fit('iso');return;}
    viewer.zoom=Math.max(.15,Math.min(10,viewer.zoom*(choice==='in'?1.2:1/1.2)));viewer.draw();
  }
  function frameGeometry(box){
    // A newly selected wall/column may extend beyond the accepted roof camera.
    // Fit current bounds while retaining the user's viewing direction.
    const center=box.min.map((x,i)=>(x+box.max[i])/2),az=viewer.az,el=viewer.el;
    const right=[Math.cos(az),0,-Math.sin(az)],up=[-Math.sin(az)*Math.sin(el),Math.cos(el),-Math.cos(az)*Math.sin(el)];
    const extent=[0,0];
    for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]]){
      const p=[x-center[0],y-center[1],z-center[2]];
      for(const [i,axis] of [right,up].entries())extent[i]=Math.max(extent[i],Math.abs(p.reduce((sum,v,j)=>sum+v*axis[j],0)));
    }
    const rect=canvas.getBoundingClientRect(),aspect=Math.max(.1,rect.width/Math.max(1,rect.height));
    viewer.target=center;viewer.pan=[0,0];viewer.zoom=1;
    viewer.span=2.4*Math.max(extent[0]/Math.max(aspect,1),extent[1]/Math.max(1,1/aspect));
  }
  function ensureFraming(box){
    if(!root.NCYSC01GeometryDraft)return;
    const rect=canvas.getBoundingClientRect();if(rect.width<=0||rect.height<=0)return;
    const key=JSON.stringify([box,rect.width,rect.height]);
    if(key!==lastBounds){frameGeometry(box);lastBounds=key;}
  }
  function render(host,items){
    mount(host);
    const source=app.getViewer(),state=app.getState(),error=$('sc01Draft3DError'),draftErrors=app.ui59.getDraftErrors();
    const key=JSON.stringify([items.map(x=>[x.slot,x.row.id,x.row.specs]),state,source?.v6Scene,source?.range,source?.roofScope,draftErrors]);
    if(viewer&&lastMeshes===source?.meshes&&lastKey===key){ensureFraming(viewer.bounds);viewer.draw();return;}
    lastKey=key;lastMeshes=source?.meshes;
    try{
      if(Object.keys(draftErrors).length)throw Error('กรอกช่องตัวเลขที่ค้างให้ครบเพื่ออัปเดต 3D');
      if(!source)throw Error('ยังไม่มีพื้นที่โมเดล 3D');
      const plan=root.NCYSC01GeometryDraft?root.NCYSC01GeometryDraft.build(source,state,items):
        geometry(source,source.data.state,items,{hss:root.NCYCAD.geometry.hss,plate:root.NCYCAD.geometry.plate,rootGeometry:root.NCYV62?.rootGeometry,purlin:root.NCYSC01Purlins.geometry,layout:root.NCYSC01Purlins.layout});
      if(!viewer){
        canvas=$('sc01DraftCanvas');viewer=new root.NCYCAD.Viewer(canvas,null,null);
        // Render meshes only. Native build/setData/pick/overlay would attach
        // analysis meaning; this canvas deliberately has none of those paths.
        viewer.renderOverlay=()=>{};viewer.pick=()=>null;
        for(const field of ['az','el','zoom','span'])if(Number.isFinite(source[field]))viewer[field]=source[field];
        for(const field of ['target','pan'])if(source[field])viewer[field]=Array.from(source[field]);
      }
      viewer.clear();viewer.bounds=plan.bounds;
      for(const m of plan.meshes){const added=viewer.add(m.g,m.id,m.kind,m.color,m.alpha,m.metal);if(m.section)added.section=m.section;}
      canvas.hidden=false;error.hidden=true;
      ensureFraming(plan.bounds);
      $('sc01DraftDimensions').textContent=`${plan.supportLabel?plan.supportLabel+' · ':''}${plan.truss?'คอร์ดบน–ล่าง':'คาน'} ${plan.member.H}×${plan.member.B}×${plan.member.t} mm${plan.truss?` · เอวตั้ง/ทแยง ${plan.web.H}×${plan.web.B}×${plan.web.t} mm`:''} · แป ${plan.purlin.H}×${plan.purlin.B}×${plan.purlin.t} mm`;
      viewer.draw();renderCount++;
    }catch(e){
      dispose();$('sc01DraftCanvas').hidden=true;error.hidden=false;error.textContent=e.message;
      $('sc01DraftDimensions').textContent=items.map(x=>x.row.name).join(' · ');
    }
  }
  api.render=render;api.dispose=dispose;
  api.inspect=()=>({active:!!viewer,renderCount,hasResult:!!viewer?.data,
    camera:viewer?{az:viewer.az,el:viewer.el,zoom:viewer.zoom}:null,
    supports:viewer?.meshes.filter(x=>x.kind==='concrete').map(x=>({id:x.id,bounds:bounds(x.g)}))||[],
    sections:viewer?.meshes.filter(x=>x.section).map(x=>({id:x.id,kind:x.kind,section:{...x.section},bounds:bounds(x.g)}))||[]});
})(typeof window==='undefined'?globalThis:window);
