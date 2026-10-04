(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = value => Number.isFinite(value) ? Number(value.toFixed(2)).toString() : 'ยังไม่มีค่า';
  const api = {};
  root.NCYSC01ViewFeedback = api;
  const doc = root.document, app = root.NCYApp;
  if (!doc || !app?.ui59 || !root.NCYCAD?.Viewer) return;
  const $ = id => doc.getElementById(id);
  const selection = () => root.NCYSC01MaterialSelection;
  const current = () => root.NCYSC01InputFlow?.hasCurrentResult?.() === true;
  const steelKey = s => JSON.stringify([s?.member?.H,s?.member?.B,s?.member?.tNom,
    s?.takeoff?.purlinH,s?.takeoff?.purlinB,s?.takeoff?.purlinT]);
  let frame = 0, pendingBefore = null, revealRequest = 0;
  const nativeScene = root.NCYCAD.Viewer.prototype.setScene;
  root.NCYCAD.Viewer.prototype.setScene = function (...args) {
    const returned = nativeScene.apply(this,args);
    // Print/export and other specimen Viewers must never update the live project.
    if (this === app.getViewer?.()) {
      app.ui59.syncViewerScene?.();
      root.NCYSC01Redesign?.refresh();
      schedule();
    }
    return returned;
  };
  const nativeSetState = app.setState;
  app.setState = function (input, ...args) {
    const returned = nativeSetState.call(this,input,...args);
    if (returned === false) return returned;
    const display = app.getState()?.v6, viewer = app.getViewer?.();
    if (viewer && ['roof','loads','project','support','connection'].includes(display?.scenePreset)) {
      viewer.setScene(display.scenePreset);
      // Imported layer choices override the scene defaults, just as on first load.
      for (const key of ['showRoof','showPurlins','showTributary','showAccessories','showLoads']) {
        if (typeof display[key] === 'boolean' && viewer[key] !== display[key]) viewer.setOption(key,display[key]);
      }
      if (['components','case','plate'].includes(display.loadDisplay) && viewer.loadMode !== display.loadDisplay) viewer.setOption('loadMode',display.loadDisplay);
      app.ui59.syncViewerScene?.();
    }
    return returned;
  };
  const nativeRecalculate = app.ui59.recalculate;
  app.ui59.recalculate = function (...args) {
    // Numeric draft validation stops the input event before later listeners.
    // Its native invalidation still must hide this read-only result summary.
    try { return nativeRecalculate.apply(this,args); }
    finally { schedule(); }
  };
  function updateHTML(node, html) {
    if (node.dataset.content !== html) { node.innerHTML = html; node.dataset.content = html; }
  }
  function revealSteel() {
    const checkbox = $('roof3D');
    if (checkbox?.checked) checkbox.click();
  }
  function revealAcceptedSteel(key) {
    const request=++revealRequest;
    root.requestAnimationFrame(()=>root.requestAnimationFrame(()=>{
      if(request===revealRequest && !selection()?.hasPending?.() && current() && steelKey(app.getState())===key) revealSteel();
    }));
  }
  function mount() {
    const area = $('viewerArea');
    if (!area) return null;
    let preview = $('sc01DraftSections');
    if (!preview) {
      preview = doc.createElement('section'); preview.id = 'sc01DraftSections';
      preview.setAttribute('aria-label','3D ตามข้อมูลที่กำลังแก้ รอคำนวณ'); preview.hidden = true;
      area.before(preview);
      preview.addEventListener('click',event => {
        if (event.target.closest('[data-sc01-cancel-preview]')) selection()?.cancelPending();
        if (event.target.closest('[data-sc01-return-input]')) root.NCYUI670?.setStage('input');
      });
    }
    let feedback = $('sc01CurrentFeedback');
    if (!feedback) {
      feedback = doc.createElement('section'); feedback.id = 'sc01CurrentFeedback';
      feedback.setAttribute('aria-label','สถานะผลคำนวณปัจจุบัน');
      area.insertBefore(feedback,area.querySelector('.viewer-canvas-wrap'));
    }
    const toolbar = area.querySelector('.viewer-toolbar');
    if (toolbar && !$('sc01RevealSteel')) {
      const toggle = doc.createElement('button'); toggle.id = 'sc01RevealSteel';
      toggle.type = 'button'; toggle.className = 'button small secondary';
      toggle.onclick = () => { $('roof3D')?.click(); schedule(); };
      toolbar.appendChild(toggle);
    }
    const head=$('inputPanel')?.querySelector('.panel-head');
    let open=$('sc01PreviewInputs');
    if(head&&!open){
      open=doc.createElement('button');open.id='sc01PreviewInputs';open.type='button';
      open.className='button small secondary';open.textContent='ดู 3D ที่แก้';
      open.onclick=()=>{root.NCYUI670?.setStage('model',{activateModel:false});schedule();preview.scrollIntoView({block:'nearest'});};
      head.appendChild(open);
    }
    return {preview,feedback,open};
  }
  function feedbackHTML(result) {
    const view = root.NCYSC01ResultsReview?.project(result);
    if (!view) return '';
    const s=result.state, member=result.checks?.member, d=result.deflection;
    const rows = view.actions.map(row => `<li><b>${esc(row.label || row.key)}</b><p>${esc(row.note || 'เปิดรายละเอียดเพื่อตรวจค่าต้นทาง')}</p><button type="button" data-fix="${esc(row.key)}">ดูรายละเอียด / แก้ข้อมูล</button></li>`).join('');
    const truss = s.v61?.systemType==='truss';
    return `<div class="sc01-current-head"><strong>คำนวณแล้ว · ${view.caseCount} กรณีแรง</strong><span>${view.failed.length ? `ต้องแก้ ${view.failed.length} รายการ` : 'ไม่พบรายการเกินเกณฑ์ตัวเลข'}${view.unknown.length ? ` · ยังตรวจได้ไม่ครบ ${view.unknown.length} รายการ` : ''}</span></div>
      <p>${truss?'Truss: ดูผลแรงและหน้าตัดแยกรายสมาชิก':`คาน ${s.member.H}×${s.member.B}×${s.member.tNom} mm · D/C ${number(member?.ratio)}`} · โก่งตัว ${number(d?.max)} / เกณฑ์ ${number(d?.allow)} mm</p>
      <details><summary>${view.actions.length?'ดูสาเหตุและแก้ข้อมูล':'ดูขอบเขตผลคำนวณ'}</summary><p>ผลตัวเลขนี้ใช้โปรไฟล์ที่เอนจิ้นรองรับ ส่วนโปรไฟล์ที่ระบุและหลักฐานโครงการยังต้องตรวจยืนยันตามสถานะ HOLD</p><ul>${rows}</ul><p>ใช้เพื่อทบทวน ยังไม่ใช่แบบอนุมัติก่อสร้าง</p></details>`;
  }
  function sync() {
    frame = 0;
    const nodes = mount(); if (!nodes) return;
    const pending = selection()?.hasPending?.() === true, state = app.getState();
    const numericDraft=!!root.NCYSC01GeometryDraft&&!current()&&!!app.getViewer?.();
    const previewActive=pending||numericDraft;
    doc.body?.classList?.toggle('sc01-geometry-pending',numericDraft);
    nodes.preview.hidden = !previewActive;
    if(nodes.open)nodes.open.hidden=!previewActive;
    if (previewActive) {
      if (pending && pendingBefore === null) pendingBefore = steelKey(state);
      root.NCYSC01Draft3D?.render(nodes.preview,selection()?.pendingItems?.() || []);
      const cancel=nodes.preview.querySelector('[data-sc01-cancel-preview]');if(cancel)cancel.hidden=!pending;
      const notice = $('sc01MaterialPendingNotice');
      if (pending && notice && !notice.querySelector('[data-sc01-preview-sections]')) {
        const button = doc.createElement('button'); button.type='button';
        button.dataset.sc01PreviewSections=''; button.textContent='ดู 3D ที่เลือก';
        button.onclick=()=>{root.NCYUI670?.setStage('model',{activateModel:false});nodes.preview.scrollIntoView({block:'nearest'});};
        notice.appendChild(button);
      }
    } else {
      root.NCYSC01Draft3D?.dispose();
      if (pendingBefore !== null) {
      const changed = pendingBefore !== steelKey(state); pendingBefore = null;
      if (changed && current()) revealAcceptedSteel(steelKey(state));
      }
    }
    const valid = !pending && current(), result = app.getResult();
    nodes.feedback.hidden = !valid;
    if (valid && result) updateHTML(nodes.feedback,feedbackHTML(result));
    const toggle = $('sc01RevealSteel');
    if (toggle) {
      toggle.disabled = !valid;
      const exposed = app.getViewer?.()?.showRoof === false;
      toggle.textContent = exposed ? 'แสดงผิวหลังคา' : 'เปิดดูโครงเหล็ก';
      toggle.setAttribute('aria-pressed',String(exposed));
    }
  }
  function schedule() { if (!frame) frame = root.requestAnimationFrame(sync); }
  api.sync = sync;
  for (const event of ['ncy:v5-updated','sc01:materials-pending','ncy:sc01-user-calculated','sc01:workspace-ready']) root.addEventListener(event,schedule);
  doc.addEventListener('click',schedule);
  doc.addEventListener('input',schedule);
  doc.addEventListener('change',schedule);
  root.addEventListener('resize',schedule);
  app.ui59.syncViewerScene?.();
  schedule();
})(typeof window === 'undefined' ? globalThis : window);
