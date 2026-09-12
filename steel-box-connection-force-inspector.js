/* R18: inspect one retained case of one typical connection.
 * Read-only copy; Truss roots use their own exact matrix reactions.
 * RGB is force magnitude, NOT a stress contour or capacity / PASS percentage. */
(function(root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const finite = Number.isFinite;
  function trussForceData(result,index){
    const fail=reason=>({ok:false,reason});
    if(!Number.isInteger(index)||!result?.cases?.[index])return fail('ยังไม่มีกรณีแรงที่เลือก');
    const g=result.v63?.root?.g,rows=result.v63?.root?.cases;
    if(!g||!Array.isArray(rows)||!g.anchorXs?.length||g.anchorXs.some(x=>!finite(x))||!finite(g.top?.cy)||!finite(g.bottom?.cy))return fail('ยังไม่มีรูปทรงและแรงปฏิกิริยาเพลทราก Truss');
    const cases=[];
    for(const c of result.cases){
      const found=rows.filter(x=>x.caseName===c.caseDef?.name);
      if(found.length!==1||!c.action||!['N','Vx','Vy','Mx','My','Tz'].every(k=>finite(c.action[k])))return fail('ผลเพลทรากไม่ตรงกับกรณีแรงปัจจุบัน');
      const roots=[],anchors=[];
      for(const side of ['top','bottom']){
        const r=found[0][side],cy=g[side].cy,n=g.anchorXs.length;
        if(!r||r.name!==side||!finite(r.action?.Nx)||!finite(r.action?.Vy)||!['T','C','V','Tper','Vper'].every(k=>finite(r[k])&&r[k]>=0)||Math.abs(r.Tper*n-r.T)>1e-6||Math.abs(r.Vper*n-r.V)>1e-6)return fail('แรงรายพุกของเพลทราก '+side+' ไม่ครบหรือไม่สมดุล');
        roots.push({side,cy,N:r.action.Nx,Vy:r.action.Vy,T:r.T,C:r.C,V:r.V});
        g.anchorXs.forEach((x,i)=>anchors.push({id:side.toUpperCase()+'-A'+(i+1),side,number:i+1,x,y:cy,T:r.Tper,Vx:0,Vy:r.action.Vy/n,V:r.Vper}));
      }
      cases.push({roots,anchors});
    }
    const all=cases.flatMap(c=>c.anchors),selected=cases[index];
    return {ok:true,truss:true,index,caseName:result.cases[index].caseDef.name,action:null,...selected,
      scales:{tension:Math.max(...all.map(a=>a.T)),shear:Math.max(...all.map(a=>a.V)),contact:null},
      caseMax:{tension:Math.max(...selected.anchors.map(a=>a.T)),shear:Math.max(...selected.anchors.map(a=>a.V)),contact:null}};
  }
  function nativeForceData(result, index) {
    if (result?.state?.v61?.systemType === 'truss') return trussForceData(result,index);
    if (!Number.isInteger(index) || !result?.cases?.[index]) return {ok:false,reason:'ยังไม่มีกรณีแรงที่เลือก'};
    const c = result.cases[index], fs = c.group?.forces;
    if (!fs?.length || !c.action || !['N','Vx','Vy','Mx','My','Tz'].every(k=>finite(c.action[k])) ||
      fs.some(f=>!['x','y','T','Vx','Vy','V'].every(k=>finite(f[k])) || f.T < 0 || f.V < 0) ||
      new Set(fs.map(f=>f.id)).size !== fs.length) return {ok:false,reason:'ข้อมูลแรงของพุก / เพลทไม่ครบ ไม่แสดงค่าเป็นศูนย์แทน'};
    const cellValues = c.normal?.contact || [];
    if (cellValues.some(p=>!finite(p.pressure))) return {ok:false,reason:'ข้อมูลแรงกดสัมผัสไม่ครบ'};
    const all = result.cases.flatMap(x=>x.group?.forces || []);
    if (result.cases.some(x=>!x.group?.forces?.length) || all.some(f=>!finite(f.T)||!finite(f.V)||f.T<0||f.V<0) ||
      result.cases.some(x=>(x.normal?.contact||[]).some(p=>!finite(p.pressure)||p.pressure<0))) return {ok:false,reason:'กรณีแรงอื่นมีข้อมูลไม่ครบ จึงยังเทียบสเกล RGB ไม่ได้'};
    return {ok:true,index,caseName:c.caseDef.name,action:copy(c.action),anchors:copy(fs),
      scales:{tension:Math.max(0,...all.map(f=>f.T)),shear:Math.max(0,...all.map(f=>f.V)),
        contact:Math.max(0,...result.cases.flatMap(x=>(x.normal?.contact||[]).map(p=>p.pressure)))},
      caseMax:{tension:Math.max(0,...fs.map(f=>f.T)),shear:Math.max(0,...fs.map(f=>f.V)),contact:Math.max(0,...cellValues.map(p=>p.pressure))}};
  }
  function forceData(result,index){const d=nativeForceData(result,index);return d.ok&&result.scopedHbeam?{...d,anchors:[]}:d;}
  function rgb(value,max) {
    if (!finite(value)||!finite(max)||value<0||max<0) return null;
    if (max===0) return [.55,.62,.69];
    const t=Math.max(0,Math.min(1,value/max));
    return t<=.5 ? [.10,.28+1.12*t,.90-1.34*t] : [.10+1.62*(t-.5),.84-1.20*(t-.5),.23-.22*(t-.5)];
  }
  function arrow(start, vector, length, radius) {
    const V=root.NCYCAD.math.V, direction=V.unit(vector),
      u=V.unit(V.cross(direction,Math.abs(direction[1])<.9?[0,1,0]:[1,0,0])), v=V.cross(direction,u),
      tip=V.add(start,V.mul(direction,length)), neck=V.add(start,V.mul(direction,Math.max(1,length-4*radius))), g={p:[],n:[]};
    const point=(center,r,a)=>V.add(center,V.add(V.mul(u,r*Math.cos(a)),V.mul(v,r*Math.sin(a))));
    function tri(a,b,c) {const n=V.unit(V.cross(V.sub(b,a),V.sub(c,a)));g.p.push(...a,...b,...c);g.n.push(...n,...n,...n);}
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6,b=(i+1)*Math.PI/6,p=point(start,radius*.55,a),q=point(start,radius*.55,b),
        r=point(neck,radius*.55,a),s=point(neck,radius*.55,b);
      tri(p,q,s);tri(p,s,r);tri(point(neck,2*radius,a),point(neck,2*radius,b),tip);
    }
    return g;
  }
  const partNames={concrete:'คอนกรีต',plate:'เพลท',steel:'เหล็ก / ค้ำ / แผ่นเสริม',weld:'รอยเชื่อม',anchor:'พุก / นอต / แหวน',resin:'น้ำยา / ช่องว่าง'};
  function partOf(mesh){
    if(mesh.kind==='concrete'||mesh.id==='concrete-outline'||String(mesh.id).startsWith('support-H-'))return 'concrete';
    if(['anchor','washer','root-anchor','root-washer'].includes(mesh.kind))return 'anchor';
    if(['steel','brace','stiffener','truss-chord','truss-web'].includes(mesh.kind))return 'steel';
    if(mesh.kind==='root-plate')return 'plate';
    if(mesh.kind==='load')return String(mesh.id).startsWith('r18-')?'anchor':'plate';
    if(mesh.kind==='field')return 'plate';
    return mesh.kind;
  }
  function separate(meshes,annotations,{exploded=false,visible={},distance=200}={}){
    const shift=part=>!exploded?[0,0,0]:({concrete:[0,0,-distance],plate:[0,0,0],steel:[0,0,distance*1.5],weld:[0,0,distance*.65],anchor:[-distance*1.1,0,distance*.65],resin:[distance*1.1,0,-distance*.35]}[part]||[0,0,0]);
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    const output=meshes.filter(m=>visible[partOf(m)]!==false).map(m=>{
      const offset=shift(partOf(m)),g={p:Array.from(m.g.p,(v,i)=>v+offset[i%3]),n:Array.from(m.g.n)};
      for(let i=0;i<g.p.length;i++){bounds.min[i%3]=Math.min(bounds.min[i%3],g.p[i]);bounds.max[i%3]=Math.max(bounds.max[i%3],g.p[i]);}
      return {...m,g};
    });
    const notes=annotations.flatMap(a=>{
      const part=a.kind==='force'?'anchor':a.kind==='member'?'steel':a.kind==='load'?'plate':null;
      if(part&&visible[part]===false)return [];
      const offset=shift(part);return [{...a,p:a.p.map((v,i)=>v+offset[i])}];
    });
    return {meshes:output,annotations:notes,bounds:output.length?bounds:null};
  }
  function playback({advance,allowed,setTimer,clearTimer,changed,interval=1800}){
    let timer=0,playing=false;
    const stop=()=>{playing=false;clearTimer(timer);timer=0;changed(false);};
    function tick(){timer=0;if(!playing||!allowed()){stop();return;}if(advance()===false){stop();return;}if(playing)timer=setTimer(tick,interval);}
    return {stop,start(){if(playing)return;playing=true;changed(true);tick();},get playing(){return playing;}};
  }
  root.NCYSC01ForceInspector = Object.freeze({forceData,rgb,separate,playback,paint,reportFigure,close:()=>dialog?.close(),open:openInspector,inspect:()=>({playing:!!player?.playing,index,exploded,visible:{...visible},parts:viewer?.meshes.map(m=>({id:m.id,kind:m.kind,part:partOf(m),bounds:separate([m],[]).bounds}))||[]})});
  const doc=root.document;
  if (!doc) return;
  const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let provider=null, dialog, viewer, player, source, initial, inputStamp, parity, index=0, layer='shear',exploded=false,visible={};
  const fmt = n=>finite(n)?n.toFixed(2):'—';
  const byId=id=>doc.getElementById(id);
  function stop() { player?.stop(); }
  function isCurrent() { if(provider)return provider.isCurrent();return inputStamp===root.NCYSC01AssistantCore.stable(root.NCYApp.getState()) && root.NCYSC01InputFlow.hasCurrentResult(); }
  function removeMeshes(v,test) {
    v.meshes=v.meshes.filter(m=>{if(!test(m))return true;v.gl?.deleteBuffer(m.pb);v.gl?.deleteBuffer(m.nb);return false;});
  }
  // Shared physical rendering for the original inspector and accepted report figure.
  function paint(viewer,source,index,{layer='shear',exploded=false,visible={},fit=false,scoped=false,decorate,formatValue=fmt}={}) {
    const data=forceData(source,index);if(!data.ok)throw Error(data.reason);
    const result=copy(source); result.governing=result.cases[index];
    const pose=viewer.hasFit?{az:viewer.az,el:viewer.el,zoom:viewer.zoom,pan:[...viewer.pan],target:[...viewer.target],span:viewer.span}:null;
    viewer.exploded=false;
    viewer.v6Scene='connection';viewer.roofScope='bay';viewer.range='detail';viewer.showRoof=false;
    viewer.showPurlins=false;viewer.showTributary=false;viewer.showAccessories=false;
    viewer.showLoads=layer==='moments'||layer==='all';viewer.showDims=false;
    viewer.field=layer==='contact'?'contact':'material';viewer.loadMode='plate';
    viewer.setData(result,{state:copy(source.state.quick),recommended:null});decorate?.(viewer);
    const span=data.truss?Math.max(source.v63.root.g.plateW,source.v63.root.g.effectiveDepthMM+source.v63.root.g.plateH):Math.max(source.state.plate.width,source.state.plate.height),face=viewer.geo.face;
    const ends=face+Math.max(35,source.state.anchors.diameter*2.1)+12;
    const key=layer==='tension'?'tension':'shear',max=data.scales[key];
    if(data.truss){
      // Older arrows summarize a controlling case. Use this exact pair of
      // matrix root reactions instead of a single-plate force distribution.
      removeMeshes(viewer,m=>['load','field'].includes(m.kind));
      viewer.annotations=[];
    }
    if (layer==='shear'||layer==='tension'||layer==='all') {
      removeMeshes(viewer,m=>m.kind==='load' && (layer!=='all'||!String(m.id).startsWith('plate-')));
      viewer.annotations=viewer.annotations.filter(a=>!['force','load'].includes(a.kind));
      for (const f of data.anchors) {
        const value=key==='tension'?f.T:f.V, color=rgb(value,max);
        for (const m of viewer.meshes.filter(m=>data.truss?['root-anchor','root-washer'].includes(m.kind)&&(String(m.id).startsWith(`v62-${f.side}-A${f.number}-`)||String(m.id).endsWith('/'+f.id)):m.id===f.id&&['anchor','washer'].includes(m.kind))) m.color=color;
        const vec=key==='tension'?[0,0,1]:[f.Vx,f.Vy,0];
        if (value>1e-9) viewer.add(arrow([f.x,f.y,ends],vec,span*(.07+.15*value/(max||1)),3),`r18-${f.id}`,'load',color,1,0);
        viewer.annotations.push({p:[f.x,f.y,ends+15],text:`${f.id} ${key==='tension'?'T':'V'} ${formatValue(value)} kN`,kind:'force'});
      }
      if(data.truss&&layer==='all')for(const r of data.roots){
        const maxN=Math.max(1,...data.roots.map(x=>Math.abs(x.N))),x=source.v63.root.g.plateW*.65;
        if(Math.abs(r.N)>1e-9)viewer.add(arrow([x,r.cy,ends],[0,0,Math.sign(r.N)],span*(.08+.12*Math.abs(r.N)/maxN),3),`root-action-${r.side}`,'load',[.1,.4,.75],1,0);
        viewer.annotations.push({p:[x,r.cy,ends+20],text:`${r.side.toUpperCase()} N ${formatValue(r.N)} · Vy ${formatValue(r.Vy)} kN`,kind:'load'});
      }
    } else if (layer==='moments') {
      removeMeshes(viewer,m=>m.kind==='load' && !/^plate-(Mx|My|Tz)$/.test(String(m.id)));
      viewer.annotations=viewer.annotations.filter(a=>a.kind!=='force'&&(a.kind!=='load'||/^(Mx|My|Tz) /.test(a.text)));
    } else if (layer==='contact') {
      const cells=result.governing.normal.contact||[];let cursor=0;
      for (const cell of cells) if(cell.pressure>.001) {
        const mesh=viewer.meshes.filter(m=>m.kind==='field')[cursor++];if(mesh)mesh.color=rgb(cell.pressure,data.scales.contact);
      }
    }
    if(scoped&&layer==='all'&&!data.truss){
      viewer.annotations=viewer.annotations.filter(a=>a.kind==='force');
      for(const k of ['N','Vx','Vy','Mx','My','Tz']){const value=data.action[k];if(Math.abs(value)<1e-9)continue;const mesh=viewer.meshes.find(m=>m.id==='plate-'+k);
        viewer.annotations.push({p:mesh?viewer.centroid(mesh):[0,0,ends],text:`${k} ${formatValue(value)} ${['Mx','My','Tz'].includes(k)?'kN·m':'kN'}`,kind:'load'});
      }
    }
    const plan=separate(viewer.meshes,viewer.annotations,{exploded,visible,distance:span*.65});
    viewer.clear();
    for(const m of plan.meshes)viewer.add(m.g,m.id,m.kind,m.color,m.alpha,m.metal);
    viewer.annotations=plan.annotations;viewer.bounds=plan.bounds;
    if(scoped){const detail=separate(plan.meshes.filter(m=>m.kind!=='concrete'&&!String(m.id).startsWith('support-H-')),[]);if(detail.bounds)viewer.bounds=detail.bounds;}
    if (pose) Object.assign(viewer,pose);
    if(fit||!pose)viewer.fit('iso');
    viewer.draw();
    return {data,key,max};
  }
  function reportFigure(input,result) {
    if(!root.NCYSC01MemberConnections?.reportAllowed(result,input))throw Error('ผลตรวจยังไม่ครบหรือไม่ใช่ข้อมูลปัจจุบัน');
    const source=root.NCYSC01MemberViews.nativeResult(input,result),index=Math.max(0,source.cases.findIndex(c=>c.caseDef.name===result.member.name));
    const host=doc.createElement('div');host.style.cssText='position:fixed;left:-5000px;top:0;width:1200px;height:680px;visibility:hidden';
    const canvas=doc.createElement('canvas');canvas.style.cssText='width:1200px;height:680px';
    const overlay=doc.createElementNS('http://www.w3.org/2000/svg','svg');host.append(canvas,overlay);doc.body.append(host);
    let view;
    try{view=new root.NCYCAD.Viewer(canvas,overlay,()=>{});view.renderOverlay=renderCurrentOverlay;view.annotationSize=30;
      paint(view,source,index,{layer:'all',fit:true,scoped:true,formatValue:n=>n.toFixed(12),decorate:v=>root.NCYSC01MemberViews.decorateSupport(v,input)});
      const image=canvas.toDataURL('image/png');if(!image.startsWith('data:image/png;base64,'))throw Error('สร้างภาพจุดต่อไม่สำเร็จ');
      return {image,overlay:overlay.outerHTML,caseName:source.cases[index].caseDef.name,fingerprint:result.fingerprint,anchorCount:forceData(source,index).anchors.length};
    }finally{view?.dispose();host.remove();}
  }
  function renderCurrentOverlay(w,h){
    if(!this.overlay)return;this.overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const font=this.annotationSize||13,rows=this.annotations.filter(a=>a.kind!=='member'||this.showDims).map(a=>({...a,xy:this.pos(a.p)})).filter(a=>a.xy[0]>=0&&a.xy[0]<=w&&a.xy[1]>=0&&a.xy[1]<=h).sort((a,b)=>a.xy[1]-b.xy[1]),last=[font,font];
    this.overlay.innerHTML=rows.map((a,i)=>{const [x,y]=a.xy,left=i%2===0,side=left?0:1,tx=left?w*.27:w*.73,ty=Math.max(last[side]+font*1.6,Math.min(h-font,y+(left?-font:font)));last[side]=ty;
      return `<g><path d="M${x} ${y}L${tx} ${ty}" stroke="#8b9dac" fill="none"/><text class="cad-label force" x="${tx}" y="${ty-4}" text-anchor="${left?'end':'start'}">${esc(a.text)}</text></g>`;}).join('');
  }
  function render(fit=false) {
    if (!isCurrent()) { stop(); byId('sc01ForceMessage').textContent='ข้อมูลโครงการเปลี่ยนแล้ว — ปิดแล้วคำนวณใหม่ก่อนเปิดภาพแรง';viewer?.clear();viewer?.draw();byId('sc01ForceNumbers').textContent='รอผลคำนวณใหม่';return false; }
    const data=forceData(source,index), message=byId('sc01ForceMessage');
    if (!data.ok) {stop();message.textContent=data.reason;viewer?.clear();viewer?.draw();byId('sc01ForceNumbers').textContent='ข้อมูลแรงไม่ครบ';return false;}
    message.textContent=`${data.truss?'Truss · เพลทรากบน–ล่างจากแรงปฏิกิริยา Matrix':'C01 จุดต่อตัวแทน 1 ชุด'} · ${data.caseName} · แรงในภาพเป็นผลคัดกรอง ไม่ใช่ผลแยกทุกแนว / อนุมัติก่อสร้าง`;
    if(provider)message.textContent=`${data.caseName} · แรงถ่ายสำหรับออกแบบจุดต่อ ยังไม่ใช่ผลตรวจกำลังเพลท / รอยเชื่อม / พุก`;
    byId('sc01ForceCase').value=String(index);
    byId('sc01ForceStep').textContent=`กรณี ${index+1} / ${source.cases.length} · ${data.caseName}`;
    const cv=byId('sc01ForceCanvas'); cv.dataset.caseName=data.caseName; cv.dataset.layer=layer;
    cv.dataset.maxT=String(data.caseMax.tension);cv.dataset.maxV=String(data.caseMax.shear);
    const {key,max}=paint(viewer,source,index,{layer,exploded,visible,fit,scoped:!!provider,decorate:provider?.decorateViewer});
    cv.dataset.zoom=String(viewer.zoom);
    cv.dataset.exploded=String(exploded);
    byId('sc01ForceAssembly').textContent=exploded?'แยกชิ้นส่วนเพื่อดูวัสดุ · ตำแหน่งประกอบดูด้วยปุ่ม “ประกอบกลับ”':'ตำแหน่งประกอบ';
    const scale=layer==='contact'?data.scales.contact:max;
    byId('sc01ForceLegend').hidden=layer==='moments';
    byId('sc01ForceLegend').innerHTML=`<span class="sc01-force-gradient"></span><span>RGB 0 → ${fmt(scale)} ${layer==='contact'?'MPa':'kN'} · ${layer==='contact'?'แรงกดสัมผัส':key==='tension'?'แรงดึงพุก T':'แรงเฉือนพุก V'}</span><small>${scale===0?'ไม่มีแรงในช่องนี้ · แสดงสีเทา': 'สเกลเดียวกันทุกกรณี · สีแสดงขนาดแรง ไม่ใช่เปอร์เซ็นต์กำลังหรือความเค้น FEM'}</small>`;
    byId('sc01ForceNumbers').innerHTML=`<h3>${data.truss?'แรงที่เพลทราก Truss':'แรงที่หน้าเพลท'}</h3>${data.truss?'':'<dl>'+['N','Vx','Vy','Mx','My','Tz'].map(k=>`<div><dt>${k}</dt><dd>${fmt(data.action[k])} ${['Mx','My','Tz'].includes(k)?'kN·m':'kN'}</dd></div>`).join('')+'</dl>'}${data.truss?'<h3>แรงที่แต่ละเพลทราก</h3>'+data.roots.map(r=>`<p><b>${r.side==='top'?'เพลทบน':'เพลทล่าง'}</b> · N ${fmt(r.N)} · Vy ${fmt(r.Vy)} kN<br>ดึง ${fmt(r.T)} · อัด ${fmt(r.C)} kN</p>`).join(''):''}<details open><summary>แรงรายพุก · ${data.anchors.length} ตัว</summary><div class="sc01-force-table"><table><thead><tr><th>พุก</th><th>T</th><th>Vx</th><th>Vy</th><th>|V|</th></tr></thead><tbody>${data.anchors.map(f=>`<tr><th>${esc(f.id)}</th>${['T','Vx','Vy','V'].map(k=>`<td>${fmt(f[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>ทุกค่าในตารางเป็น kN · เครื่องหมายตามแกนของเอนจิ้น<br>มองหน้าเพลท: x แนวนอน · y แนวตั้ง · N ตามแกนยื่น z</small></details>`;
    if(source.scopedHbeam){byId('sc01ForceNumbers').querySelector('details')?.remove();byId('sc01ForceNumbers').insertAdjacentHTML('beforeend','<p>แรงที่ต้องถ่ายผ่านแนวเชื่อมเพลทกับ H-beam</p>');byId('sc01ForceLegend').hidden=true;}
    byId('sc01ForceCanvas').dataset.anchorCount=String(data.anchors.length);
  }
  function step(delta){index=(index+delta+source.cases.length)%source.cases.length;return render();}
  function openInspector(adapter,{host=null}={}) {
    stop();viewer?.dispose();viewer=null;if(dialog?.open)dialog.close();provider=adapter?.getResult?adapter:null;
    if (provider?!provider.isCurrent():!root.NCYSC01InputFlow?.ensureCurrentResult()) return;
    const app=provider||root.NCYApp;source=copy(app.getResult());initial=app.getCase();
    index=source.cases.findIndex(c=>c.caseDef.name===initial?.caseDef?.name);if(index<0)index=0;
    inputStamp=root.NCYSC01AssistantCore.stable(app.getState());
    parity={result:JSON.stringify(app.getResult()),boq:JSON.stringify(app.getBOQ()),formulas:JSON.stringify(app.getFormulaSteps()),revision:app.getRevision()};
    if (!dialog) {
      dialog=doc.createElement('dialog');dialog.id='sc01ForceDialog';dialog.className='sc01-audit-dialog sc01-force-dialog';
      dialog.setAttribute('aria-labelledby','sc01ForceTitle');doc.body.append(dialog);
      dialog.addEventListener('close',()=>{
        if(dialog.open)return;stop();viewer?.dispose();viewer=null;
        // Retained Viewer status chrome is shared. Restore the original main view.
        const app=provider||root.NCYApp;app.getViewer()?.build();
        const launch=doc.getElementById('sc01ForceOpen');
        if(launch){
          launch.dataset.inputUnchanged=String(inputStamp===root.NCYSC01AssistantCore.stable(app.getState()));
          launch.dataset.resultUnchanged=String(parity.result===JSON.stringify(app.getResult()));
          launch.dataset.boqUnchanged=String(parity.boq===JSON.stringify(app.getBOQ()));
          launch.dataset.formulasUnchanged=String(parity.formulas===JSON.stringify(app.getFormulaSteps()));
          launch.dataset.revisionUnchanged=String(parity.revision===app.getRevision());
          launch.focus({preventScroll:true});
        }
      });
    }
    const available=forceData(source,index);
    const head='<header><div><small>ผลคัดกรอง · จุดต่อตัวแทนชุดเดียวกับผลคำนวณ</small><h2 id="sc01ForceTitle">จุดต่อระยะใกล้ · แรงเพลทและพุก</h2></div><button type="button" data-force-close>ปิด</button></header>';
    dialog.innerHTML=head+(!available.ok?`<div class="sc01-audit-body"><p class="sc01-audit-note">${esc(available.reason)}</p><button type="button" data-force-root>เปิดมุมจุดต่อเดิม / เพลทราก</button></div>`:`<p id="sc01ForceMessage" class="sc01-force-message"></p><div class="sc01-force-tools"><label>กรณีแรง<select id="sc01ForceCase">${source.cases.map((c,i)=>`<option value="${i}">${esc(c.caseDef.name)}</option>`).join('')}</select></label><label>แสดงแรง<select id="sc01ForceLayer"><option value="shear">แรงเฉือนพุก V · RGB</option><option value="tension">แรงดึงพุก T · RGB</option><option value="moments">โมเมนต์ Mx / My / Tz</option><option value="all">แรงเพลท N / V / M + พุก</option><option value="contact">แรงกดสัมผัส · RGB</option></select></label><button type="button" id="sc01ForcePlay" aria-pressed="false">▶ เล่นทีละกรณี</button><button type="button" data-force-zoom="out" aria-label="ย่อจุดต่อ">−</button><button type="button" data-force-zoom="in" aria-label="ขยายจุดต่อ">+</button><button type="button" data-force-fit>พอดีจอ</button></div><div class="sc01-force-body"><div class="sc01-force-stage"><div class="sc01-force-canvas"><canvas id="sc01ForceCanvas" tabindex="0" aria-label="3D จุดต่อพร้อมแรง หมุนด้วยการลาก ซูมด้วยลูกกลิ้งหรือปุ่มบวกลบ"></canvas><div id="sc01ForceOverlay"></div></div><div id="sc01ForceLegend" class="sc01-force-legend"></div><small>ลากเพื่อหมุน · ลูกกลิ้ง / สองนิ้วเพื่อซูม · Shift + ลากเพื่อเลื่อน · “เล่น” สลับผลแต่ละกรณี ไม่ใช่แรงเคลื่อนไหวตามเวลา</small></div><aside id="sc01ForceNumbers"></aside></div>`);
    if(available.ok){
      if(provider){byId('sc01ForceLayer').querySelector('[value="contact"]')?.remove();if(source.scopedHbeam){for(const option of [...byId('sc01ForceLayer').options])if(option.value!=='all')option.remove();byId('sc01ForceLayer').options[0].textContent='แรงที่แนวเชื่อมเพลทกับ H-beam';}}
      if(available.truss){
        const mode=byId('sc01ForceLayer');
        mode.querySelector('[value="moments"]')?.remove();mode.querySelector('[value="contact"]')?.remove();
        mode.querySelector('[value="all"]').textContent='แรงเพลทรากบน–ล่าง + พุก';
      }
      const tools=dialog.querySelector('.sc01-force-tools');
      tools.insertAdjacentHTML('beforeend','<button type="button" data-force-step="-1" aria-label="กรณีก่อนหน้า">◀</button><button type="button" data-force-step="1" aria-label="กรณีถัดไป">▶</button><output id="sc01ForceStep" aria-live="polite"></output>');
      tools.insertAdjacentHTML('afterend','<div class="sc01-force-parts"><button type="button" id="sc01ForceExplode" aria-pressed="false">แยกชิ้นส่วน</button>'+Object.entries(partNames).map(([key,name])=>`<label><input type="checkbox" data-force-part="${key}" checked>${name}</label>`).join('')+'<span id="sc01ForceAssembly"></span></div>');
      if(source.scopedHbeam){for(const key of ['anchor','resin'])dialog.querySelector(`[data-force-part="${key}"]`).closest('label').hidden=true;const label=dialog.querySelector('[data-force-part="concrete"]').closest('label');label.lastChild.textContent=' H-beam รองรับ';}
    }
    const overlay=byId('sc01ForceOverlay');
    if(overlay){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id=overlay.id;svg.classList.add('cad-overlay');overlay.replaceWith(svg);}
    dialog.onclick=event=>{
      if(event.target.closest('[data-force-close]'))dialog.close();
      if(event.target.closest('[data-force-root]')){dialog.close();app.renderView('iso');doc.querySelector('[data-v6-scene="connection"]')?.click();}
      const zoom=event.target.closest('[data-force-zoom]');
      if(zoom&&viewer){viewer.zoom=Math.max(.15,Math.min(10,viewer.zoom*(zoom.dataset.forceZoom==='in'?1.2:1/1.2)));viewer.draw();byId('sc01ForceCanvas').dataset.zoom=String(viewer.zoom);}
      if(event.target.closest('[data-force-fit]')){viewer?.fit('iso');if(viewer)byId('sc01ForceCanvas').dataset.zoom=String(viewer.zoom);}
      if(event.target.closest('#sc01ForcePlay')) {
        if(player.playing)stop();else player.start();
      }
      const next=event.target.closest('[data-force-step]');if(next){stop();step(Number(next.dataset.forceStep));}
      if(event.target.closest('#sc01ForceExplode')){exploded=!exploded;const b=byId('sc01ForceExplode');b.textContent=exploded?'ประกอบกลับ':'แยกชิ้นส่วน';b.setAttribute('aria-pressed',String(exploded));render(true);}
    };
    dialog.classList.toggle('sc01-force-inline',!!host);(host||doc.body).append(dialog);
    if(host)dialog.show();else dialog.showModal();if(!available.ok)return;
    layer=source.scopedHbeam?'all':'shear';byId('sc01ForceLayer').value=layer;exploded=false;visible={};viewer=new root.NCYCAD.Viewer(byId('sc01ForceCanvas'),byId('sc01ForceOverlay'),()=>{});
    if(available.truss||provider)viewer.renderOverlay=renderCurrentOverlay;
    // The inspector's Viewer receives cloned data only and never exports a report.
    viewer.snapshot=()=>{throw Error('มุมตรวจแรงนี้ไม่ใช่ภาพอนุมัติแบบ');};
    byId('sc01ForceCase').onchange=event=>{stop();index=Number(event.target.value);render();};
    byId('sc01ForceLayer').onchange=event=>{stop();layer=event.target.value;render();};
    dialog.querySelectorAll('[data-force-part]').forEach(input=>{input.onchange=()=>{visible[input.dataset.forcePart]=input.checked;render();};});
    player=playback({advance:()=>step(1),allowed:()=>{if(dialog?.open&&!isCurrent()){render();return false;}return !!dialog?.open&&!doc.hidden;},setTimer:(fn,ms)=>root.setTimeout(fn,ms),clearTimer:id=>root.clearTimeout(id),changed:playing=>{const b=byId('sc01ForcePlay');if(b){b.textContent=playing?'Ⅱ หยุดเล่น':'▶ เล่นทีละกรณี';b.setAttribute('aria-pressed',String(playing));}}});
    render();
  }
  function mount() {
    const tools=doc.getElementById('sc01r12Options')?.parentElement;
    if(tools&&!byId('sc01ForceOpen')) {const b=doc.createElement('button');b.id='sc01ForceOpen';b.type='button';b.className='button secondary sc01-r12-tool';b.textContent='จุดต่อ + แรง / RGB';b.onclick=openInspector;tools.prepend(b);}
  }
  function boot(attempt=0) {mount();if(!byId('sc01ForceOpen')&&attempt<20)root.setTimeout(()=>boot(attempt+1),200);}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
  root.addEventListener('ncy:v5-updated',()=>{mount();if(dialog?.open&&viewer&&!isCurrent())render();});
  root.addEventListener('sc01:member-input-changed',()=>{if(provider&&dialog?.open&&viewer)render();});
  doc.addEventListener('click',mount);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop();});
})(typeof window!=='undefined'?window:globalThis);
