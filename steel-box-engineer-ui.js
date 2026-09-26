/* SC01 R30: native engineer inputs and read-only, component-based results. */
(function(root){
  'use strict';
  const finite=Number.isFinite, esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>finite(v)?String(Number(v.toFixed(3))):'—';
  const definitions=[
    ['member','เหล็กคาน / สมาชิก Truss','member trussMember trussMemberAdvanced trussSecondOrder'],
    ['purlin','แปหลังคา','purlinBending'],
    ['connection','เพลท / รอยเชื่อม / จุดต่อ','plate weld stiffener stiffenerDetail trussNode trussNodeAdvanced trussHSSLocal trussHSSJoint rootPlateNoPrying rootPlateComponent braceLowerConnection'],
    ['anchor','พุกและคอนกรีตรอบพุก','anchorSteel productInteraction breakoutT bond breakoutV pryout gapBending'],
    ['service','การโก่งตัวใช้งาน','deflection purlinDeflection'],
    ['stability','เสถียรภาพ / ค้ำยัน','trussLateralBracing trussOutOfPlane spaceTruss3D'],
    ['support','โครงสร้างรองรับเดิม','existing rcSupport rcSupportSystem'],
    ['geometry','ระยะและตำแหน่ง','geometry trussRootGeometry physicalGeometry'],
    ['aggregate','ผลตรวจรวมจุดต่อ Truss','trussRootConnection'],
  ];
  const family=new Map(definitions.flatMap(([id,,keys])=>keys.split(' ').map(key=>[key,id])));
  const rootConstituents=new Set('weld plate anchorSteel productInteraction breakoutT bond breakoutV pryout geometry'.split(' '));
  const strength=new Set(definitions.filter(([id])=>!['service','geometry','support'].includes(id)).flatMap(([,,keys])=>keys.split(' ')));
  function metric(key){
    if(key==='deflection'||key==='purlinDeflection')return 'δ / δ ที่ยอมให้';
    if(/geometry|slenderness/i.test(key))return 'ค่า / เกณฑ์';
    if(['solver','trussSystem','numericIntegrity','scope'].includes(key))return 'ค่าตรวจ';
    return strength.has(key)?'D/C':'ค่า / เกณฑ์';
  }
  function components(result,layout){
    const review=root.NCYSC01ResultsReview,view=review.project(result,layout);
    const rows=[...view.failed,...view.unknown,...view.within,...view.technical,...view.excluded];
    const groups=definitions.map(([id,title])=>({id,title,rows:[]})),other=[];
    for(const row of rows){
      const id=family.get(row.key)||(row.key.startsWith('purlin')?'purlin':null);
      const group=groups.find(g=>g.id===id);
      if(group)group.rows.push(row);else other.push(row);
    }
    for(const group of groups){
      const active=group.rows.filter(r=>r.kind!=='excluded');
      group.failed=active.filter(r=>r.kind==='failed');
      group.unknown=active.filter(r=>r.kind==='unknown'||['hold','incomplete','outside'].includes(r.state));
      group.status=group.failed.length?'failed':group.unknown.length?'unknown':!active.length?'excluded':active.some(r=>r.kind==='within')?'within':'technical';
      const numeric=active.filter(r=>finite(r.ratio)&&r.ratio>=0&&!['technical','unknown'].includes(r.kind));
      group.governing=numeric.reduce((best,row)=>!best||row.ratio>best.ratio?row:best,null);
      group.active=active.length>0;
    }
    // Keep non-mapped engineering failures conspicuous. Evidence and solver
    // diagnostics stay reachable, and never become a fabricated strength D/C.
    const unresolved=other.filter(r=>['failed','unknown'].includes(r.kind));
    if(unresolved.length)groups.push({id:'other',title:'รายการตรวจเพิ่มเติม',rows:unresolved,active:true,
      failed:unresolved.filter(r=>r.kind==='failed'),unknown:unresolved.filter(r=>r.kind==='unknown'),
      status:unresolved.some(r=>r.kind==='failed')?'failed':'unknown',governing:unresolved.filter(r=>r.kind==='failed'&&finite(r.ratio)&&r.ratio>=0).reduce((best,row)=>!best||row.ratio>best.ratio?row:best,null)});
    const evidence=other.filter(r=>!unresolved.includes(r));
    const aggregate=groups.find(g=>g.id==='aggregate');
    const physical=groups.flatMap(g=>g.rows).filter(r=>rootConstituents.has(r.key));
    const covered=aggregate?.rows.length&&aggregate.rows.every(r=>r.kind==='excluded'||physical.some(p=>
      p.kind===r.kind&&finite(p.ratio)&&finite(r.ratio)&&p.ratio===r.ratio));
    if(covered)evidence.push(...aggregate.rows);
    return {groups:groups.filter(g=>g.active&&!(covered&&g.id==='aggregate')),excluded:groups.filter(g=>!g.active&&!(covered&&g.id==='aggregate')).flatMap(g=>g.rows),evidence,
      caseCount:view.caseCount,constructionAuthorized:false};
  }
  const statusText={failed:'ไม่ผ่าน',unknown:'ข้อมูลไม่ครบ',within:'อยู่ในเกณฑ์ตัวเลข',technical:'ข้อมูลประกอบ',excluded:'ไม่ใช้กับระบบนี้'};
  const rawStatus={fail:'ไม่ผ่าน',ok:'ผ่านรายการนี้',warn:'มีเงื่อนไข',review:'ต้องทบทวน',incomplete:'ข้อมูลไม่ครบ',outside:'นอกขอบเขต',hold:'รอตรวจ',na:'ไม่ใช้กับระบบนี้'};
  function rowHTML(row){
    const kind=row.kind,label=row.label||row.key;
    const stateLabel=kind==='failed'?(finite(row.ratio)&&row.ratio>1?'ไม่ผ่าน':'ขนาด / เงื่อนไขไม่ผ่าน'):rawStatus[row.state]||'ยังไม่สรุป';
    return `<tr data-result-key="${esc(row.key)}"><td><button type="button" data-check="${esc(row.key)}">${esc(label)}</button><small>${esc(row.note||'')}</small></td><td>${finite(row.ratio)?`<b>${num(row.ratio)}</b><small>${esc(metric(row.key))}</small>`:'—'}</td><td>${esc(row.governingCase||'—')}</td><td class="sc01-result-state ${esc(kind)}">${esc(stateLabel)}${kind==='failed'?`<button type="button" data-fix="${esc(row.key)}">แก้ข้อมูล</button>`:''}</td></tr>`;
  }
  function summaryHTML(result,layout){
    const data=components(result,layout);
    return `<p class="sc01-r30-results-note">D/C = แรงที่ต้องรับ ÷ กำลังรับได้, ไม่เกิน 1 จึงอยู่ในเกณฑ์กำลัง · การโก่งตัวและระยะตรวจแยก</p>${data.groups.map(g=>{
      const r=g.governing,ratio=g.id==='geometry'||g.id==='support'&&!r?'—':r?`${metric(r.key)} ${num(r.ratio)}`:'—';
      const reason=g.failed.find(r=>!finite(r.ratio)||r.ratio<=1)||g.unknown[0];
      const dimensionalFailure=g.failed.some(row=>!finite(row.ratio)||row.ratio<=1);
      return `<details class="sc01-component-result" data-result-group="${g.id}" data-component-status="${g.status}"><summary><strong>${esc(g.title)}</strong><span class="sc01-component-ratio">${esc(ratio)}</span><span class="sc01-result-state ${g.status}">${esc(dimensionalFailure?'ขนาด / เงื่อนไขไม่ผ่าน':statusText[g.status])}${g.failed.length&&g.unknown.length?' · ข้อมูลไม่ครบด้วย':''}</span>${reason?`<small class="sc01-component-alert">${esc(reason.label)}${dimensionalFailure?' · เปิดดูขนาดที่ผิดเงื่อนไข':''}</small>`:''}</summary><p class="sc01-component-reason">${r?`ค่าควบคุม: ${esc(r.label)} · ${esc(r.governingCase||'ตรวจเงื่อนไขร่วม')}`:'เปิดดูข้อมูลและเงื่อนไขที่ต้องยืนยัน'}${reason?`<br>${esc(reason.label)}: ${esc(reason.note||statusText[g.status])}`:''}</p><div class="sc01-check-table-wrap"><table class="sc01-check-table"><thead><tr><th>รายการตรวจ / สมการ</th><th>อัตราส่วน</th><th>กรณีแรง</th><th>ผล</th></tr></thead><tbody>${g.rows.map(rowHTML).join('')}</tbody></table></div></details>`;
    }).join('')}<details class="sc01-result-evidence" data-result-group="evidence"><summary>ข้อมูลประกอบ / ขอบเขต / รายการที่ไม่ใช้ (${data.evidence.length+data.excluded.length})</summary><div class="sc01-check-table-wrap"><table class="sc01-check-table"><tbody>${[...data.evidence,...data.excluded].map(rowHTML).join('')}</tbody></table></div></details>`;
  }
  const api={VERSION:'r30',components,metric,summaryHTML};root.NCYSC01EngineerUI=api;
  const doc=root.document,app=root.NCYApp;if(!doc||!app?.ui59)return;
  const $=id=>doc.getElementById(id),text=(n,v)=>{if(n&&n.textContent!==v)n.textContent=v;};
  let frame=0,lastResult=null,lastHost=null,observedRun=null,observedDraft=null;
  const inputGroups=[['v61-geometry','ระบบ / ขนาด'],['loads','แรง'],['member','เหล็ก'],['plate','จุดต่อ'],['v64-stability','Truss'],['concrete','รองรับ'],['project','โครงการ']];
  const titles={'v61-geometry':'ระบบและขนาดโครงสร้าง',member:'หน้าตัดคาน / คอร์ด Truss','v62-root':'เพลทรากบน–ล่าง','v63-analysis':'แรงสมาชิก / คานรองรับ','v64-stability':'เสถียรภาพ / Gusset','v65-complete':'แบบจำลอง 3D / โครงรองรับ',project:'ข้อมูลโครงการ',loads:'น้ำหนักและแรงออกแบบ',plate:'เพลท / ค้ำยัน',anchors:'ผังพุกและระยะฝัง',weld:'รอยเชื่อม',concrete:'คอนกรีตและขอบเขตรองรับ',product:'ข้อมูลกำลังพุกรุ่นจริง',standards:'มาตรฐานและชุดแรง'};
  function showGroup(id){
    root.NCYUI670?.setStage('input',{activateModel:false});
    const group=$('group-'+id);if(!group)return;
    group.open=true;group.scrollIntoView({block:'start'});
    group.querySelector('summary')?.focus({preventScroll:true});
  }
  api.showGroup=showGroup;
  function syncInput(){
    const panel=$('inputPanel'),groups=$('inputGroups');if(!panel||!groups)return;
    text(panel.querySelector('.panel-head h2'),'ข้อมูลวิศวกรรม');
    text(panel.querySelector('.panel-head > div > span'),'แก้ค่า แล้วกดคำนวณ');
    let basis=$('sc01EngineerBasis');
    const units=$('unitProfileBar'),profiles=$('ncy659ProfileHost');
    if(!basis&&units){
      basis=doc.createElement('details');basis.id='sc01EngineerBasis';
      basis.appendChild(doc.createElement('summary'));units.before(basis);
    }
    if(basis){
      for(const node of [units,profiles])if(node&&node.parentElement!==basis)basis.appendChild(node);
      text(basis.querySelector(':scope>summary'),`หน่วย / มาตรฐาน · ${$('forceUnitSelect')?.value||'kN'} · ${$('stressUnitSelect')?.value||'MPa'}`);
    }
    let nav=$('sc01EngineerNav');
    if(!nav){nav=doc.createElement('nav');nav.id='sc01EngineerNav';nav.setAttribute('aria-label','หมวดข้อมูลวิศวกรรม');
      nav.innerHTML=inputGroups.map(([id,label])=>`<button type="button" data-engineer-group="${id}">${label}</button>`).join('');
      nav.onclick=e=>{const b=e.target.closest('[data-engineer-group]');if(b)showGroup(b.dataset.engineerGroup);};
      $('advancedInputLabel').after(nav);
    }
    for(const [id,title] of Object.entries(titles)){const group=$('group-'+id);if(group){text(group.querySelector('.group-title b'),title);group.querySelector('summary')?.setAttribute('title',group.querySelector('.group-title small')?.textContent||title);}}
    const picker=$('sc01-material-engineer');
    if(picker){text(picker.querySelector(':scope > summary'),'เลือกเหล็ก / เพลท / พุกจากรายการวัสดุ');picker.classList.add('sc01-engineer-materials');}
    // The original fields remain owned by native validation and units. The
    // original bracket-only visibility wrongly concealed Truss web dimensions.
    const truss=app.getState().v61?.systemType==='truss';
    for(const path of ['brace.H','brace.B','brace.tNom','brace.K']){
      const field=groups.querySelector(`[data-path="${path}"]`)?.closest('.field');
      if(field&&truss){field.hidden=false;field.style.display='';}
    }
  }
  function syncStatus(){
    const bar=$('ncy670StageBar');if(!bar)return;
    let status=$('sc01EngineerStatus');
    if(!status){status=doc.createElement('p');status.id='sc01EngineerStatus';status.setAttribute('role','status');bar.appendChild(status);}
    const invalid=Object.keys(app.ui59.getDraftErrors()).length,pending=root.NCYSC01MaterialSelection?.hasPending?.(),current=root.NCYSC01InputFlow?.hasCurrentResult();
    const running=$('sc01RunCalculation')?.getAttribute('aria-busy')==='true';
    const result=app.getResult(),message=running?'กำลังคำนวณ…':invalid?'ยังคำนวณไม่ได้ · แก้ช่องที่แจ้งสีแดง':pending?'เลือกวัสดุใหม่แล้ว · 3D เป็นภาพร่าง · กดคำนวณเพื่อใช้ทั้งชุด':!current?'ข้อมูลเปลี่ยนแล้ว · กดคำนวณเพื่ออัปเดตผล':`คำนวณแล้ว · ${result?.cases?.length||0} กรณีแรง · ผลตามค่าปัจจุบัน`;
    text(status,message);status.dataset.state=invalid?'invalid':current?'current':'pending';
    doc.body.dataset.sc01EngineerCurrent=String(!!current);
    if(!current&&$('sc01NumericResults'))$('sc01NumericResults').hidden=true;
  }
  api.renderResults=function(result,host){
    if(!doc.body.classList.contains('sc01-engineer-only'))return false;
    const current=root.NCYSC01InputFlow?.hasCurrentResult();
    if(!current){if($('sc01NumericResults'))$('sc01NumericResults').hidden=true;return true;}
    if(lastResult===result&&lastHost===host&&$('sc01NumericResults')){$('sc01NumericResults').hidden=false;return true;}
    const advisor=$('advisorEntry'),undo=advisor?.querySelector('[data-advice-undo]');
    if(advisor){advisor.replaceChildren();if(undo)advisor.appendChild(undo);}
    const metrics=$('forceMetrics');
    if(metrics&&!$('sc01ResultForces')){
      const details=doc.createElement('details');details.id='sc01ResultForces';
      const summary=doc.createElement('summary');summary.textContent='แรงและโมเมนต์ของกรณีบนแบบ';
      details.append(summary,metrics);host.insertAdjacentElement('afterend',details);
    }
    if($('legalStatusCard'))$('legalStatusCard').hidden=true;
    const gates=$('gates');
    if(gates){gates.hidden=true;if(gates.previousElementSibling?.classList.contains('section-label'))gates.previousElementSibling.hidden=true;}
    const open=new Set([...host.querySelectorAll('details[open]')].map(d=>d.dataset.resultGroup));
    const groups=components(result),bad=groups.groups.filter(g=>g.failed.length).length,unknown=groups.groups.filter(g=>g.unknown.length).length;
    const header=host.previousElementSibling;
    if(header?.classList.contains('section-label')){
      if(header.firstChild?.nodeType===3)header.firstChild.textContent='ผลตามส่วนประกอบ ';
      text($('checkCount'),`${groups.groups.length} หมวด`);
    }
    $('overallCard').innerHTML=`<div class="overall-card sc01-r30-overall"><h3>ผลคำนวณ ${groups.caseCount} กรณีแรง</h3><p>${bad?`ไม่ผ่าน ${bad} หมวด`: 'ไม่พบรายการเกินเกณฑ์ตัวเลข'}${unknown?` · ข้อมูลไม่ครบ ${unknown} หมวด`:''}</p><small>แต่ละแถวแสดงค่าควบคุมของหมวด เปิดแถวเพื่อดูทุกสมการและกรณีแรง</small></div>`;
    host.innerHTML=`<div id="sc01NumericResults">${summaryHTML(result)}</div>`;
    host.querySelectorAll('details').forEach(d=>{d.open=open.has(d.dataset.resultGroup);});
    doc.body.dataset.sc01ResultsReview='r30';lastResult=result;lastHost=host;return true;
  };
  function sync(){
    frame=0;if(root.NCYSC01MemberWorkflow?.active)return;syncInput();syncStatus();
    const run=$('sc01RunCalculation');
    if(run&&run!==observedRun){new MutationObserver(schedule).observe(run,{attributes:true,attributeFilter:['aria-busy','disabled']});observedRun=run;}
    // Native draft validation stops invalid input events at window capture.
    // Its changing message is the notification; do not observe its repeatedly
    // assigned hidden attribute, which would create a paint/observer loop.
    const draft=$('sc01NumericDraftNotice');
    if(draft&&draft!==observedDraft){new MutationObserver(schedule).observe(draft,{childList:true,subtree:true});observedDraft=draft;}
  }
  function schedule(){if(!frame)frame=root.requestAnimationFrame(sync);}
  doc.body.classList.add('sc01-engineer-only');
  const oldShow=app.ui59.showInput;
  app.ui59.showInput=function(...args){const out=oldShow.apply(this,args);schedule();return out;};
  // Presentation refreshes only. Never re-render native fields on keystrokes.
  new MutationObserver(schedule).observe($('inputGroups'),{childList:true});
  for(const event of ['input','change','click'])doc.addEventListener(event,schedule);
  for(const event of ['ncy:v5-updated','ncy:sc01-user-calculated','sc01:materials-pending','sc01:material-inputs-mounted'])root.addEventListener(event,schedule);
  root.NCYSC01ResultsReview?.sync();schedule();
})(typeof window==='undefined'?globalThis:window);
