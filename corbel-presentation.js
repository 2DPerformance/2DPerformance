(function corbelPresentation() {
  'use strict';
  const paths={grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    chart:'<path d="M3 3v18h18M6 14l5-6 5 9 5-12"/>',section:'<rect x="4" y="3" width="16" height="18"/><path d="M7 7h10M7 12h10M7 17h10"/>',
    box:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9"/>',file:'<path d="M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8"/>',
    calculate:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M12 11h1M16 11h.01M8 15h1M12 15h1M16 15v4M8 19h5"/>',
    reset:'<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',left:'<path d="m14 5-7 7 7 7"/>',right:'<path d="m10 5 7 7-7 7"/>',
    eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    fit:'<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',folder:'<path d="M3 6h7l2 3h9v12H3zM3 9V4h7l2 2h8"/>',
    print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',check:'<path d="m4 12 5 5L20 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>'};
  const urls=Object.fromEntries(Object.entries(paths).map(([key,p])=>[key,'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>')+'")']));
  function decorate(root) {
    const controls=[...(root.matches?.('button,summary')?[root]:[]),...root.querySelectorAll?.('button,.sv-concrete-project > summary')||[]];
    for(const b of controls) {
      const label=b.textContent.trim();const flow={1:'grid',2:'chart',3:'section',4:'box',5:'file'};
      const icon=b.dataset.step?flow[b.dataset.step]:b.id==='autoDesignBtn'?'calculate':b.id==='workspaceBackBtn'?'left':b.id==='resetBtn'?'reset':b.id==='fitBtn'||b.id==='corbelCloseupBtn'?'fit':
        b.id==='printReportBtn'?'print':b.id==='closeReportBtn'?'close':b.dataset.view||b.dataset.workview==='3d'||/3D/.test(label)?'box':
        b.dataset.next?(b.classList.contains('back')?'left':'right'):/Section|รูปตัด/.test(label)?'section':/ผนัง|ผิว|เหล็ก|แสดง/.test(label)?'eye':/ยืนยัน/.test(label)?'check':/กลับ|ย้อน/.test(label)?'left':/Save|Open|บันทึก|เปิด/.test(label)?'folder':'file';
      b.dataset.ncyIcon=icon;b.style.setProperty('--corbel-button-icon',urls[icon]);
    }
  }
  function syncEvidence() {
    const evidence=window.getCorbelEvidence?.();const table=document.getElementById('corbelDcRows');
    if(!table)return;
    const tabs=[...document.querySelectorAll('.step')];
    tabs.forEach(tab=>{if(tab.dataset.step!=='1')tab.disabled=!evidence?.ready;});
    if(!evidence?.ready) {table.replaceChildren();document.getElementById('corbelDcSnapshot').textContent='ยังไม่มีผลคำนวณปัจจุบัน';return;}
    const snapshot=evidence.snapshot;document.getElementById('corbelDcSnapshot').textContent=snapshot.presentation.snapshotId;
    document.getElementById('corbelDcVerdict').textContent='LOCAL '+String(evidence.verdict).toUpperCase();
    document.getElementById('corbelDcVerdict').className='badge '+evidence.verdict;
    const number=value=>{if(value==null||value==='')return '—';const n=Number(value);return Number.isNaN(n)?'—':!Number.isFinite(n)?(n>0?'∞':'−∞'):n.toLocaleString('th-TH',{minimumFractionDigits:3,maximumFractionDigits:3});};
    const unit=id=>id==='flexure'?'N·mm':['primary-steel','closed-ties'].includes(id)?'mm²':['tip-depth','nose-anchor','support-anchor'].includes(id)?'mm':['scope-avd','scope-nv'].includes(id)?'ratio':'N';
    table.replaceChildren();
    for(const check of snapshot.checks) {
      const row=document.createElement('tr');row.dataset.checkId=check.id;
      const label=document.createElement('td');const title=document.createElement('strong');title.textContent=check.label;label.append(title);
      const note=document.createElement('small');note.textContent=check.clause+(check.note?' · '+check.note:'');label.append(note);row.append(label);
      for(const value of [number(check.demand)+' '+unit(check.id),number(check.capacity)+' '+unit(check.id),number(check.utilization)]){const td=document.createElement('td');td.className='numeric';td.textContent=value;row.append(td);}
      const state=document.createElement('td');state.className='corbel-check-state '+check.status;state.textContent=(check.status==='pass'?'✓ ':check.status==='fail'?'✕ ':'! ')+String(check.status).toUpperCase();row.append(state);table.append(row);
    }
    if(document.body.dataset.activeStep==='4'&&!document.getElementById('stage').dataset.studioVisited){document.getElementById('stage').dataset.studioVisited='true';window.focusCorbelDetail?.();}
  }
  decorate(document.body);syncEvidence();
  new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(syncEvidence).observe(document.body,{attributes:true,attributeFilter:['data-run-state','data-corbel-snapshot-id','data-active-step']});
})();
