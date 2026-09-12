(function(root){
  'use strict';
  const P=root.NCYSC01Purlins,app=root.NCYApp,doc=root.document;
  if(!P||!app||!doc)return;
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $=id=>doc.getElementById(id),num=x=>Number.isFinite(x)?Number(x.toFixed(3)):'ไม่มีค่า';
  function show(fix){
    const r=app.getResult();if(!r||!root.NCYSC01InputFlow?.ensureCurrentResult())return;
    const p=r.purlins,dialog=$('detailDialog');
    $('dialogTitle').textContent='แป: ขนาด แรง และผลตามสมการ';
    $('dialogContent').innerHTML=`<section class="sc01-purlin-detail">${P.blocks(r).join('')}<p><b>${esc(P.advice(r))}</b></p>${P.formulas(r).map(row=>`<article><h4>${esc(row.title)}</h4><p>${esc(row.caseName)}</p><p>${esc(row.formula)}</p><p>${esc(row.sub)}</p><p><b>${esc(row.result)}</b></p></article>`).join('')}<button type="button" class="button primary" data-purlin-input>เลือกขนาด / แก้ระยะแป</button><p>ผลแปไม่แทนกำลังรอยยึดหรือการตรวจคานและพุก ต้องคำนวณใหม่หลังเปลี่ยนขนาด</p></section>`;
    $('dialogSVG').hidden=$('dialogPNG').hidden=true;$('dialogDone').textContent='กลับสู่แบบ';
    if(!dialog.open)dialog.showModal();
    if(fix)$('dialogContent').querySelector('[data-purlin-input]')?.focus();
  }
  doc.addEventListener('click',event=>{
    const b=event.target.closest('button');if(!b)return;
    if((b.dataset.check||b.dataset.fix||'').startsWith('purlin')||b.hasAttribute('data-purlin-results')){
      event.preventDefault();event.stopImmediatePropagation();show(!!b.dataset.fix);
    }
    if(b.hasAttribute('data-purlin-input')){
      event.preventDefault();event.stopImmediatePropagation();$('detailDialog')?.close();
      if(root.NCYSC01EngineerUI){
        root.NCYSC01EngineerUI.showGroup('member');
        const picker=$('sc01-material-engineer');if(picker)picker.open=true;
        $('sc01-material-engineer-purlin')?.focus();return;
      }
      root.NCYUI670?.setStage?.('input',{activateModel:false});
      app.ui59.showInput('takeoff');app.ui59.setInputMode('easy');root.NCYGuided?.go(2);
      requestAnimationFrame(()=>requestAnimationFrame(()=>$('sc01-material-ceiling-purlin')?.focus({preventScroll:false})));
    }
  },true);
  function sync(){
    const r=app.getResult(),host=$('sc01LoadPathSummary');
    if(host&&!host.querySelector('[data-purlin-results]')&&r?.purlins?.state!=='na'){
      const b=doc.createElement('button');b.type='button';b.dataset.purlinResults='';
      const p=r.purlins;b.textContent=`แป ${r.state.takeoff.purlinH}×${r.state.takeoff.purlinB}×${r.state.takeoff.purlinT} mm · ดูแรง / D/C ${num(Math.max(...Object.values(p?.checks||{}).map(c=>c.ratio)))}`;host.appendChild(b);
    }
    const hostInput=root.NCYSC01EngineerUI?$('sc01-material-engineer'):$('sc01-material-ceiling')||$('sc01-material-engineer');
    const spacing=doc.querySelector('[data-purlin-spacing]');
    if(hostInput&&spacing&&!hostInput.contains(spacing)){
      const field=hostInput.querySelector('[data-material-slot="purlin"]')?.closest('.sc01-material-field');
      (field||hostInput).appendChild(spacing);
    }
    if(hostInput&&!hostInput.querySelector('[data-purlin-spacing]')){
      const group=doc.createElement('div');group.className='sc01-purlin-inputs';group.dataset.purlinSpacing='';
      group.innerHTML='<label>ระยะแปเป้าหมาย (m)<input type="number" min="0.05" step="0.05" data-path="takeoff.purlinSpacingM" data-si-unit="m" data-purlin-field="takeoff.purlinSpacingM"></label><label>ระยะคานเป้าหมาย (m)<input type="number" min="0.1" step="0.1" data-path="takeoff.frameSpacingM" data-si-unit="m" data-purlin-field="takeoff.frameSpacingM"></label><p>ระยะจริงปรับหารเท่าตลอดงาน; แปใช้ Fy/Fu และเกณฑ์แอ่นเดียวกับคาน ระยะจัดผังนี้ไม่เปลี่ยนความกว้างรับน้ำหนัก C01 ในขั้นขนาดงาน</p>';
      const field=hostInput.querySelector('[data-material-slot="purlin"]')?.closest('.sc01-material-field');(field||hostInput).appendChild(group);
      // Native data-path input events own validation/draft/stale state.
    }
    for(const el of doc.querySelectorAll('[data-purlin-field]'))if(doc.activeElement!==el&&!el.classList.contains('invalid'))el.value=root.NCYV5.get(app.getState(),el.dataset.purlinField);
    const boqLabel=doc.querySelector('#boqConfigPanel [data-path="takeoff.includePurlins"]')?.closest('label');
    if(boqLabel)for(const node of boqLabel.childNodes)if(node.nodeType===3&&node.textContent.includes('รวมแป (ยังไม่ตรวจขนาด)'))node.textContent=node.textContent.replace('รวมแป (ยังไม่ตรวจขนาด)','รวมแป — ดูผลดัด/เฉือน/แอ่นในรายการคำนวณ');
    const area=$('viewerArea');
    if(area&&r){
      let label=$('sc01SectionLegend');if(!label){label=doc.createElement('p');label.id='sc01SectionLegend';label.className='sc01-section-legend';area.appendChild(label);}
      const s=r.state,p=r.purlins;
      label.textContent=`${s.v61?.systemType==='truss'?'Truss: ขนาดสมาชิกตามโมเดล':`คาน H×B×t ${s.member.H}×${s.member.B}×${s.member.tNom} mm`} · ${s.takeoff.includePurlins?`แป ${s.takeoff.purlinH}×${s.takeoff.purlinB}×${s.takeoff.purlinT} mm · ${p?.grid?.count||'—'} แนว @ ${num(p?.grid?.spacingM)} m`:'ไม่รวมแป'}`;
    }
  }
  // Replace the display-only solid strips with real hollow H/B/t, using the
  // same physical stations as the purlin calculation (also in a cropped view).
  const proto=root.NCYCAD.Viewer.prototype,oldBuild=proto.build;
  proto.build=function(){
    const cover=this.showRoof,showPurlins=this.showPurlins;
    // Native addRoof coupled purlins to the covering checkbox. Build the same
    // support context once, then hide only the roof skin; do not change inputs.
    if(cover===false&&showPurlins)this.showRoof=true;
    try{oldBuild.call(this);}finally{this.showRoof=cover;}
    if(cover===false&&showPurlins){
      for(const m of this.meshes.filter(m=>m.kind.startsWith('roof-')&&m.kind!=='roof-frame')){this.gl?.deleteBuffer(m.pb);this.gl?.deleteBuffer(m.nb);}
      this.meshes=this.meshes.filter(m=>!m.kind.startsWith('roof-')||m.kind==='roof-frame');
    }
    const s=this.data?.state,roof=this.v6Roof;
    if(!s||!roof||!this.showPurlins)return;
    const old=this.meshes.filter(m=>m.kind==='purlin');if(!old.length)return;
    let grid;try{grid=P.layout(s);}catch(_){return;}
    const t=s.takeoff,H=t.purlinH,B=t.purlinB,T=t.purlinT;
    if(![H,B,T].every(x=>Number.isFinite(x)&&x>0)||2*T>=Math.min(H,B))return;
    const bounds=m=>{const p=m.g.p,a=[Infinity,Infinity,Infinity],b=[-Infinity,-Infinity,-Infinity];for(let i=0;i<p.length;i++) {const k=i%3;a[k]=Math.min(a[k],p[i]);b[k]=Math.max(b[k],p[i]);}return {a,b,y:(a[1]+b[1])/2,z:(a[2]+b[2])/2};};
    const all=old.map(bounds).sort((a,b)=>a.z-b.z),first=all[0],last=all.at(-1),x0=Math.min(...all.map(a=>a.a[0])),x1=Math.max(...all.map(a=>a.b[0]));
    for(const m of old){this.gl?.deleteBuffer(m.pb);this.gl?.deleteBuffer(m.nb);}
    this.meshes=this.meshes.filter(m=>m.kind!=='purlin');
    this.purlinSections=[];
    if(t.includePurlins)for(const line of grid.lines){
      if(line.zM*1000>roof.viewL+.001)continue;
      const z=roof.beamStart+line.zM*1000,y=first.y+(last.y-first.y)*(z-first.z)/(last.z-first.z||1);
      const mesh=this.add(P.geometry(B,H,T,x1-x0,[x0,y,z]),'purlin-'+Number(line.id.slice(1)),'purlin',old[0].color,old[0].alpha,old[0].metal);
      mesh.section={H,B,t:T};mesh.purlinId=line.id;this.purlinSections.push({id:line.id,H,B,t:T,zM:line.zM});
    }
    this.draw();
  };
  root.addEventListener('ncy:v5-updated',()=>requestAnimationFrame(sync));
  root.addEventListener('sc01:material-inputs-mounted',()=>requestAnimationFrame(sync));
  doc.addEventListener('click',()=>requestAnimationFrame(sync));
  doc.addEventListener('change',()=>requestAnimationFrame(sync));
  // Tail modules load before the page becomes interactive. Re-run once without
  // changing inputs so even the initial result includes the new engine checks.
  app.ui59.recalculate();requestAnimationFrame(sync);
})(window);
