/* R18: inspect one retained case of one typical connection.
 * Read-only copy, never C01 forces applied to repeated frames or Truss roots.
 * RGB is force magnitude, NOT a stress contour or capacity / PASS percentage. */
(function(root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const finite = Number.isFinite;
  function forceData(result, index) {
    if (result?.state?.v61?.systemType === 'truss') return {ok:false,reason:'Truss ใช้เพลทรากบน–ล่างและแรงปฏิกิริยา Matrix แยกกัน มุมตรวจพุกเดี่ยวนี้ยังไม่รองรับ ห้ามใช้ C01 แทนผลเพลทราก'};
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
  root.NCYSC01ForceInspector = Object.freeze({forceData,rgb,open:openInspector});
  const doc=root.document;
  if (!doc) return;
  const esc = x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, viewer, timer=0, source, initial, inputStamp, parity, index=0, layer='shear';
  const fmt = n=>finite(n)?n.toFixed(2):'—';
  const byId=id=>doc.getElementById(id);
  const colorCSS=c=>`rgb(${c.map(v=>Math.round(255*v)).join(',')})`;
  function stop() { root.clearTimeout(timer);timer=0;const b=byId('sc01ForcePlay');if(b){b.textContent='▶ เล่นทีละกรณี';b.setAttribute('aria-pressed','false');} }
  function isCurrent() { return inputStamp===root.NCYSC01AssistantCore.stable(root.NCYApp.getState()) && root.NCYSC01InputFlow.hasCurrentResult(); }
  function removeMeshes(v,test) {
    v.meshes=v.meshes.filter(m=>{if(!test(m))return true;v.gl?.deleteBuffer(m.pb);v.gl?.deleteBuffer(m.nb);return false;});
  }
  function render() {
    if (!isCurrent()) { stop(); byId('sc01ForceMessage').textContent='ข้อมูลโครงการเปลี่ยนแล้ว — ปิดแล้วคำนวณใหม่ก่อนเปิดภาพแรง';viewer?.clear();viewer?.draw();return; }
    const data=forceData(source,index), message=byId('sc01ForceMessage');
    if (!data.ok) {stop();message.textContent=data.reason;viewer?.clear();viewer?.draw();return;}
    message.textContent=`C01 จุดต่อตัวแทน 1 ชุด · ${data.caseName} · แรงในภาพเป็นผลคัดกรอง ไม่ใช่ผลแยกทุกแนว / อนุมัติก่อสร้าง`;
    byId('sc01ForceCase').value=String(index);
    const cv=byId('sc01ForceCanvas'); cv.dataset.caseName=data.caseName; cv.dataset.layer=layer;
    cv.dataset.maxT=String(data.caseMax.tension);cv.dataset.maxV=String(data.caseMax.shear);
    const result=copy(source); result.governing=result.cases[index];
    const pose=viewer.hasFit?{az:viewer.az,el:viewer.el,zoom:viewer.zoom,pan:[...viewer.pan]}:null;
    viewer.v6Scene='connection';viewer.roofScope='bay';viewer.range='detail';viewer.showRoof=false;
    viewer.showPurlins=false;viewer.showTributary=false;viewer.showAccessories=false;
    viewer.showLoads=layer==='moments'||layer==='all';viewer.showDims=false;
    viewer.field=layer==='contact'?'contact':'material';viewer.loadMode='plate';
    viewer.setData(result,{state:copy(source.state.quick),recommended:null});
    const span=Math.max(source.state.plate.width,source.state.plate.height),face=viewer.geo.face;
    const ends=face+Math.max(35,source.state.anchors.diameter*2.1)+12;
    const key=layer==='tension'?'tension':'shear',max=data.scales[key];
    if (layer==='shear'||layer==='tension'||layer==='all') {
      removeMeshes(viewer,m=>m.kind==='load' && (layer!=='all'||!String(m.id).startsWith('plate-')));
      viewer.annotations=viewer.annotations.filter(a=>!['force','load'].includes(a.kind));
      for (const f of data.anchors) {
        const value=key==='tension'?f.T:f.V, color=rgb(value,max);
        for (const m of viewer.meshes.filter(m=>m.id===f.id&&['anchor','washer'].includes(m.kind))) m.color=color;
        const vec=key==='tension'?[0,0,1]:[f.Vx,f.Vy,0];
        if (value>1e-9) viewer.add(arrow([f.x,f.y,ends],vec,span*(.07+.15*value/(max||1)),3),`r18-${f.id}`,'load',color,1,0);
        viewer.annotations.push({p:[f.x,f.y,ends+15],text:`${f.id} ${key==='tension'?'T':'V'} ${fmt(value)} kN`,kind:'force'});
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
    if (pose) Object.assign(viewer,pose);
    viewer.draw();cv.dataset.zoom=String(viewer.zoom);
    const scale=layer==='contact'?data.scales.contact:max;
    byId('sc01ForceLegend').hidden=layer==='moments';
    byId('sc01ForceLegend').innerHTML=`<span class="sc01-force-gradient"></span><span>RGB 0 → ${fmt(scale)} ${layer==='contact'?'MPa':'kN'} · ${layer==='contact'?'แรงกดสัมผัส':key==='tension'?'แรงดึงพุก T':'แรงเฉือนพุก V'}</span><small>${scale===0?'ไม่มีแรงในช่องนี้ · แสดงสีเทา': 'สเกลเดียวกันทุกกรณี · สีแสดงขนาดแรง ไม่ใช่เปอร์เซ็นต์กำลังหรือความเค้น FEM'}</small>`;
    byId('sc01ForceNumbers').innerHTML=`<h3>แรงที่หน้าเพลท</h3><dl>${['N','Vx','Vy','Mx','My','Tz'].map(k=>`<div><dt>${k}</dt><dd>${fmt(data.action[k])} ${['Mx','My','Tz'].includes(k)?'kN·m':'kN'}</dd></div>`).join('')}</dl><details open><summary>แรงรายพุก · ${data.anchors.length} ตัว</summary><div class="sc01-force-table"><table><thead><tr><th>พุก</th><th>T</th><th>Vx</th><th>Vy</th><th>|V|</th></tr></thead><tbody>${data.anchors.map(f=>`<tr><th>${esc(f.id)}</th>${['T','Vx','Vy','V'].map(k=>`<td>${fmt(f[k])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><small>ทุกค่าในตารางเป็น kN · เครื่องหมายตามแกนของเอนจิ้น<br>มองหน้าเพลท: x แนวนอน · y แนวตั้ง · N ตามแกนยื่น z</small></details>`;
    byId('sc01ForceCanvas').dataset.anchorCount=String(data.anchors.length);
  }
  function tick() {
    if (!dialog?.open||doc.hidden) {stop();return;}
    index=(index+1)%source.cases.length;render();
    if(dialog.open&&isCurrent())timer=root.setTimeout(tick,1800);
  }
  function openInspector() {
    if (!root.NCYSC01InputFlow?.ensureCurrentResult()) return;
    const app=root.NCYApp;source=copy(app.getResult());initial=app.getCase();
    index=source.cases.findIndex(c=>c.caseDef.name===initial?.caseDef?.name);if(index<0)index=0;
    inputStamp=root.NCYSC01AssistantCore.stable(app.getState());
    parity={result:JSON.stringify(app.getResult()),boq:JSON.stringify(app.getBOQ()),formulas:JSON.stringify(app.getFormulaSteps()),revision:app.getRevision()};
    if (!dialog) {
      dialog=doc.createElement('dialog');dialog.id='sc01ForceDialog';dialog.className='sc01-audit-dialog sc01-force-dialog';
      dialog.setAttribute('aria-labelledby','sc01ForceTitle');doc.body.append(dialog);
      dialog.addEventListener('close',()=>{
        stop();viewer?.dispose();viewer=null;
        // Retained Viewer status chrome is shared. Restore the original main view.
        app.getViewer()?.build();
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
    const overlay=byId('sc01ForceOverlay');
    if(overlay){const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id=overlay.id;svg.classList.add('cad-overlay');overlay.replaceWith(svg);}
    dialog.onclick=event=>{
      if(event.target.closest('[data-force-close]'))dialog.close();
      if(event.target.closest('[data-force-root]')){dialog.close();app.renderView('iso');doc.querySelector('[data-v6-scene="connection"]')?.click();}
      const zoom=event.target.closest('[data-force-zoom]');
      if(zoom&&viewer){viewer.zoom=Math.max(.15,Math.min(10,viewer.zoom*(zoom.dataset.forceZoom==='in'?1.2:1/1.2)));viewer.draw();byId('sc01ForceCanvas').dataset.zoom=String(viewer.zoom);}
      if(event.target.closest('[data-force-fit]')){viewer?.fit('iso');if(viewer)byId('sc01ForceCanvas').dataset.zoom=String(viewer.zoom);}
      if(event.target.closest('#sc01ForcePlay')) {
        if(timer){stop();return;}
        byId('sc01ForcePlay').textContent='Ⅱ หยุดเล่น';byId('sc01ForcePlay').setAttribute('aria-pressed','true');timer=root.setTimeout(tick,1800);
      }
    };
    dialog.showModal();if(!available.ok)return;
    layer='shear';viewer=new root.NCYCAD.Viewer(byId('sc01ForceCanvas'),byId('sc01ForceOverlay'),()=>{});
    // The inspector's Viewer receives cloned data only and never exports a report.
    viewer.snapshot=()=>{throw Error('มุมตรวจแรงนี้ไม่ใช่ภาพอนุมัติแบบ');};
    byId('sc01ForceCase').onchange=event=>{stop();index=Number(event.target.value);render();};
    byId('sc01ForceLayer').onchange=event=>{stop();layer=event.target.value;render();};
    render();
  }
  function mount() {
    const tools=doc.getElementById('sc01r12Options')?.parentElement;
    if(tools&&!byId('sc01ForceOpen')) {const b=doc.createElement('button');b.id='sc01ForceOpen';b.type='button';b.className='button secondary sc01-r12-tool';b.textContent='จุดต่อ + แรง / RGB';b.onclick=openInspector;tools.prepend(b);}
  }
  function boot(attempt=0) {mount();if(!byId('sc01ForceOpen')&&attempt<20)root.setTimeout(()=>boot(attempt+1),200);}
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',()=>boot(),{once:true});else boot();
  root.addEventListener('ncy:v5-updated',mount);
  doc.addEventListener('click',mount);
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop();});
})(typeof window!=='undefined'?window:globalThis);
