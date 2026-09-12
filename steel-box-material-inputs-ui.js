(function (root) {
  'use strict';
  const C = root.NCYSC01MaterialInputs, app = root.NCYApp, model = root.NCYV5;
  if (!C || !app || !model) return;
  const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const groups = new Map();
  // A single draft survives step/mode remounts. It is not calculation input
  // until an explicit Calculate/Apply successfully commits the whole batch.
  const choices = Object.create(null);
  const capacityFields = new WeakMap();
  let scheduled = false, lastApplied = null, applying = false, transactionError = '';
  const retainedSetState = app.setState;
  app.setState = function (value, ...args) {
    // Normal live edits/Auto may alter a named section or replace a product.
    // Remove stale labels before the retained import; file validation remains
    // strict in the project input adapter and never installs result authority.
    const named = value?.v6 && C.metadataKeys.some(key => Object.hasOwn(value.v6,key));
    return retainedSetState.call(this,named ? C.cleanMetadata(value) : value,...args);
  };
  const input = () => root.SVSteelBoxProjectInputs?.captureCommitted?.() || C.cleanMetadata(app.getState());
  const hasPending = () => Object.values(choices).some(Boolean);
  const fingerprint = state => {
    const copy = C.clone(state);
    // Camera/layer choices do not invalidate a material transaction. All
    // engineering inputs and project metadata still participate in the guard.
    for (const name of ['scenePreset','loadDisplay','showRoof','showPurlins','showTributary','showAccessories','roofScope']) delete copy.v6?.[name];
    return C.stable(copy);
  };
  function describe(slot, s) {
    if (slot === 'member') return `${s.member.H} × ${s.member.B} × ${s.member.tNom} มม.`;
    if (slot === 'trussWeb') return `${s.brace.H} × ${s.brace.B} × ${s.brace.tNom} มม.`;
    if (slot === 'purlin') return `${s.takeoff.purlinH} × ${s.takeoff.purlinB} × ${s.takeoff.purlinT} มม. · ระยะเป้าหมาย ${s.takeoff.purlinSpacingM} m`;
    if (slot === 'plate') { const g=C.isTruss(s)?root.NCYV62.rootGeometry(C.clone(s)):null;return `${g?.plateW??s.plate.width} × ${g?.plateH??s.plate.height} × ${s.plate.thickness} มม. · รู Ø${s.plate.holeDiameterMM}${g?' · 2 เพลทต่อ Truss':''}`; }
    if (slot === 'anchor') return `${C.isTruss(s)?root.NCYV62.rootGeometry(C.clone(s)).totalAnchors:s.anchors.rows * s.anchors.cols} ตัว M${s.anchors.diameter} · ฝัง ${s.anchors.hef} มม.`;
    return `DL ${s.loads.deadKPa.toFixed(3)} kN/m² · ${s.quick.hasCeiling || s.quick.roofType === 'metal_ceiling' ? 'รวมฝ้า' : 'ไม่มีฝ้า'}`;
  }
  function proofText(proof) {
    if (!proof) return 'ยังไม่มีผลแรงที่ใช้แสดงได้';
    if(proof.truss)return `${proof.cases} กรณีแรง Truss · แรงดึง/เฉือนสูงสุดต่อพุกเพลทรากบน–ล่าง ${proof.anchorTensionKN.toFixed(2)} / ${proof.anchorShearKN.toFixed(2)} kN (อาจคนละกรณี)`;
    return `${proof.cases} กรณีแรง · แรงเฉือน Vy สูงสุด ${proof.shearKN.toFixed(2)} kN · โมเมนต์ Mx สูงสุด ${proof.momentKNm.toFixed(2)} kN·m · แรงดึง/เฉือนสูงสุดต่อพุก ${proof.anchorTensionKN.toFixed(2)} / ${proof.anchorShearKN.toFixed(2)} kN (อาจคนละกรณี)`;
  }
  function source(row) {
    if (!row.url) return '';
    return `<a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">${esc(row.retailer)} · รหัส ${esc(row.sku)}</a>`;
  }
  function drafts() { return Object.keys(app.ui59.getDraftErrors()).length > 0; }
  function captureContext() {
    const panel = $('inputPanel');
    // The retained hidden wizard can have a different step in engineer mode.
    // Capture only this explicit material transaction, not general navigation.
    if (!panel || panel.classList.contains('easy-mode') || root.NCYUI670?.getStage() !== 'input') return root.NCYSC01InputFlow?.captureInputContext();
    return { materialAdvanced: true, easy: false,
      scroll: ['inputPanel','inputGroups'].map(id => ({ id, top: $(id)?.scrollTop || 0 })),
      details: [...panel.querySelectorAll('details[id]')].map(el => ({ id: el.id, open: el.open })) };
  }
  function prepare() {
    const before = input();
    if (drafts()) throw Error('กรอกช่องตัวเลขที่ค้างให้ครบก่อน ค่าที่กำลังพิมพ์จะไม่ถูกเขียนทับ');
    let next = before;
    const items = [];
    for (const slot of C.slots) {
      const id = choices[slot];
      if (!id) continue;
      const proposal = C.propose(next, slot, id);
      next = proposal.next;
      items.push({ ...proposal, slot });
    }
    const errors = model.validate(next);
    return { before, next, items, errors, fingerprint: fingerprint(before) };
  }
  function updatePreview(pane) {
    const target = pane.node.querySelector('[data-material-preview]');
    let html = '';
    if (hasPending()) {
      try {
        const p = prepare();
        pane.preview = p;
        html = `<div class="sc01-material-preview"><strong>วัสดุที่เลือกไว้สำหรับคำนวณครั้งถัดไป</strong><p>กดปุ่ม “คำนวณและดูผล” ได้เลย ระบบจะใช้รายการด้านล่างทั้งหมด</p><dl>${p.items.map(i => `<dt>${esc(C.labelFor(i.slot,p.next))}</dt><dd>${esc(describe(i.slot, p.before))}<span aria-hidden="true"> → </span><b>${esc(describe(i.slot, p.next))}</b></dd>`).join('')}</dl><details><summary>ฐานข้อมูลและเงื่อนไขของวัสดุที่เลือก</summary>${p.items.map(i => `<p><b>${esc(i.row.name)}</b><br>${i.notices.map(esc).join('<br>')}<br>${source(i.row)}</p>`).join('')}</details>${p.items.some(i => i.slot === 'member' || i.slot === 'plate') ? '<p>ใช้ขนาดจากร้าน แต่ค่ากำลังเหล็กและระยะรูยังใช้ตามงาน ต้องตรวจใบรับรองและรูจริงก่อนซื้อ</p>' : ''}${p.items.some(i => i.slot === 'anchor') ? '<p class="sc01-material-note">พุก: คำนวณแรงที่ต้องรับ ยังไม่ยืนยันกำลังรับได้ และล้างค่ากำลังพุกรุ่นก่อนทั้งหมด</p>' : ''}${p.items.some(i => i.slot === 'ceiling') ? (p.next.v6?.roofLoadMode === 'manual' ? '<p class="sc01-material-note">คง DL ที่กรอกเองไว้ ผูกชื่อฝ้าเท่านั้น ตรวจว่า DL นี้รวมฝ้าและโครงคร่าวแล้ว รุ่นฝ้าภายในไม่ยืนยันว่าใช้ภายนอกได้</p>' : '<p class="sc01-material-note">ใช้ DL ชุดฝ้า + โครงคร่าวเดิม ไม่ใช่น้ำหนักแผ่นเพียงอย่างเดียว รุ่นฝ้าภายในไม่ยืนยันว่าใช้ภายนอกได้</p>') : ''}${p.errors.length ? `<p class="sc01-material-error" role="alert">ยังใช้ชุดนี้ไม่ได้: ${p.errors.map(esc).join(' · ')}</p><p>ปรับชุดวัสดุที่เลือก หรือแก้ขนาดหน้างานในช่องเดิม แล้วตรวจอีกครั้ง</p>` : ''}<button type="button" class="sc01-material-apply" data-material-apply ${p.errors.length ? 'disabled' : ''}>ใช้วัสดุที่เลือกและคำนวณ</button></div>`;
      } catch (error) {
        pane.preview = null;
        html = `<p class="sc01-material-error" role="alert">${esc(error.message)}</p>`;
      }
    } else pane.preview = null;
    if (transactionError && hasPending()) html += `<p class="sc01-material-error" role="alert">${esc(transactionError)}</p>`;
    // Do not replace focused selects, details or buttons on unrelated render events.
    if (target.dataset.content !== html) { target.innerHTML = html; target.dataset.content = html; }
  }
  function refresh(pane) {
    const state = input();
    for (const slot of pane.slots) {
      const current = C.selected(state, slot);
      const select = pane.node.querySelector(`[data-material-slot="${slot}"]`);
      const value = choices[slot] || current?.id || '';
      if (select.value !== value) select.value = value;
      const text = `ใช้ในงาน: ${current?.name || 'ค่ากำหนดเอง / ชุดเดิม'} · ${describe(slot, state)}`;
      const node = pane.node.querySelector(`[data-material-current="${slot}"]`);
      if (node.textContent !== text) node.textContent = text;
    }
    updatePreview(pane);
    const status = pane.node.querySelector('[data-material-status]');
    const unchanged = !hasPending() && lastApplied && fingerprint(state) === lastApplied.after;
    const html = unchanged ? `<strong tabindex="-1">คำนวณใหม่จากค่าที่เลือกแล้ว</strong><p>${esc(proofText(lastApplied.proof))}</p><p>ตัวเลขนี้เป็นแรงที่ต้องรับ ไม่ใช่กำลังรับได้หรือการอนุมัติแบบ</p><button type="button" data-material-undo>ย้อนคืนก่อนเลือกวัสดุ</button>` : '';
    if (status.dataset.content !== html) { status.innerHTML = html; status.dataset.content = html; }
  }
  function mount(host, id, slots, options = {}) {
    const old = groups.get(id);
    if (old?.node.isConnected && old.slots.join()===slots.join()) { refresh(old); return; }
    // The engineer picker may itself be the requested insertion point. Capture
    // its following sibling before changing the member/Truss slot list.
    const before=old?.node&&options.before===old.node?old.node.nextSibling:options.before;
    if(old?.node.isConnected)old.node.remove();
    const node = document.createElement(options.folded ? 'details' : 'section');
    node.className = 'sc01-material-picker'; node.id = id;
    node.setAttribute('aria-label', 'เลือกชื่อวัสดุที่มีขาย');
    node.innerHTML = `${options.folded ? '<summary>เลือกชื่อวัสดุที่มีขาย</summary>' : '<h4>เลือกชื่อวัสดุที่มีขาย</h4>'}<p>เลือกวัสดุ แล้วกด “คำนวณและดูผล” ครั้งเดียว</p>${slots.map(slot => `<div class="sc01-material-field"><label for="${id}-${slot}">${esc(C.labelFor(slot,input()))}</label><select id="${id}-${slot}" data-material-slot="${slot}" aria-describedby="${id}-${slot}-current"><option value="">คงค่าของงาน / เลือกวัสดุ…</option>${C.records.filter(row => row.slot === C.catalogSlot(slot) && row.mode !== 'unavailable').map(row => `<option value="${esc(row.id)}">${esc(row.name)}</option>`).join('')}</select><p id="${id}-${slot}-current" data-material-current="${slot}"></p></div>`).join('')}<div data-material-preview></div><div data-material-status role="status" aria-live="polite"></div><details class="sc01-material-catalog-note"><summary>รายการที่ยังใช้คำนวณไม่ได้</summary><p>ไม่ใช่สินค้าที่ไม่มีขาย แต่ข้อมูลหรือชนิดหน้าตัดยังไม่ตรงกับเอนจิ้นนี้</p>${C.records.filter(row => row.mode === 'unavailable' && (slots.includes(row.slot) || slots.includes('member') && row.slot === 'reference')).map(row => `<p><b>${esc(row.name)}</b><br>${esc(row.reason)}<br>${source(row)}</p>`).join('')}</details>`;
    if (before?.parentNode===host) host.insertBefore(node,before); else host.appendChild(node);
    const pane = { node, slots, preview: null };
    groups.set(id, pane);
    node.addEventListener('change', event => {
      if (!event.target.matches('select[data-material-slot]')) return;
      const slot = event.target.dataset.materialSlot, id = event.target.value;
      if (!id || id === C.selected(input(), slot)?.id) delete choices[slot];
      else choices[slot] = id;
      transactionError = '';
      changedPending();
    });
    node.addEventListener('click', event => {
      if (event.target.closest('[data-material-apply]')) apply(pane);
      if (event.target.closest('[data-material-undo]')) undo(pane);
    });
    refresh(pane);
  }
  function restore(context, paneId) {
    requestAnimationFrame(() => {
      if (context && !context.materialAdvanced && root.NCYGuided?.getStep() !== context.step) root.NCYGuided.go(context.step);
      requestAnimationFrame(() => {
        sync();
        if (context?.materialAdvanced && !$('inputPanel')?.classList.contains('easy-mode') && root.NCYUI670?.getStage() === 'input') {
          for (const item of context.details) if ($(item.id)?.tagName === 'DETAILS') $(item.id).open = item.open;
          for (const item of context.scroll) if ($(item.id)) $(item.id).scrollTop = item.top;
        } else root.NCYSC01InputFlow?.restoreInputContext(context);
        const pane = $(paneId), target = pane?.querySelector('[data-material-status] strong') || pane?.querySelector('select');
        if (target?.getClientRects().length && (!document.activeElement?.isConnected || document.activeElement === document.body || document.activeElement?.matches('#g59StepBody h3'))) target.focus({ preventScroll: true });
        root.NCYSC01Redesign?.refresh();
      });
    });
  }
  function setAndCheck(state) {
    const result = app.setState(state);
    // setState runs the retained calculator synchronously. Do not call public
    // currentness here: the pending draft must stay blocked until proof passes.
    if (result === false || !app.getResult() || document.body.classList.contains('has-pending57') || drafts()) throw Error('ยังคำนวณจากค่าที่เลือกไม่สำเร็จ');
    if (!C.validMetadata(app.getState())) throw Error('ชื่อวัสดุไม่ตรงกับค่าที่เอนจิ้นใช้');
    const current = app.getState(), resultState = app.getResult()?.state;
    for (const key of ['member','brace','v61','v62','v63','v64','v65','takeoff','plate','anchors','product','loads','quick','concrete','mode','connectionType']) {
      if (C.stable(current[key]) !== C.stable(resultState?.[key])) throw Error('ผลคำนวณยังไม่ตรงกับค่ากรอกปัจจุบัน');
    }
    const proof = C.loadProof(app.getResult());
    if (!proof) throw Error('ไม่พบผลแรงปัจจุบัน');
    return proof;
  }
  function apply(pane) {
    return applyPending({ pane, restore: true });
  }
  function applyPending(options = {}) {
    if (!hasPending()) return true;
    if (applying) return false;
    const context = options.restore ? captureContext() : null;
    let p, changed = false;
    applying = true;
    try {
      p = prepare();
      if (!p.items.length || p.errors.length) throw Error(p.errors[0] || 'เลือกวัสดุก่อน');
      if (root.NCYSC01DocumentGate?.isDocumentPage(app.ui59.getPage?.())) app.renderView('iso');
      changed = true;
      const proof = setAndCheck(p.next);
      lastApplied = { before: p.before, after: fingerprint(input()), proof };
      for (const slot of C.slots) delete choices[slot];
      transactionError = '';
      app.ui59.toast('ใช้ชื่อวัสดุและคำนวณใหม่แล้ว ตรวจแรงและรายการที่ยังไม่ผ่านต่อ');
      return true;
    } catch (error) {
      if (changed && p) {
        try { setAndCheck(p.before); } catch (_) { app.ui59.toast('คืนค่าไม่สำเร็จ กรุณาเปิดงานที่บันทึกไว้ก่อนใช้ผล'); }
      }
      transactionError = error.message;
      explainPending('ยังใช้วัสดุที่เลือกไม่ได้: ' + error.message);
      return false;
    } finally {
      applying = false;
      changedPending();
      if (options.restore) restore(context, options.pane?.node.id);
    }
  }
  function undo(pane) {
    const context = captureContext();
    try {
      if (hasPending() || drafts() || !lastApplied || fingerprint(input()) !== lastApplied.after) throw Error('งานถูกแก้ต่อแล้ว ไม่ย้อนทับค่าล่าสุด');
      setAndCheck(lastApplied.before); lastApplied = null;
      app.ui59.toast('ย้อนคืนค่าก่อนเลือกวัสดุและคำนวณใหม่แล้ว');
    } catch (error) { app.ui59.toast(error.message); refresh(pane); }
    finally { restore(context, pane.node.id); }
  }
  function explainPending(message = 'มีวัสดุที่เลือกไว้: กดคำนวณและดูผล หรือยกเลิกการเลือก ก่อนใช้ผลหรือบันทึกงาน') {
    root.NCYUI670?.setStage?.('input', { activateModel: false });
    const feedback = $('sc01FlowFeedback');
    if (feedback) { feedback.hidden = false; feedback.textContent = message; }
    app.ui59.toast(message);
  }
  function cancelPending() {
    for (const slot of C.slots) delete choices[slot];
    transactionError = '';
    if ($('sc01FlowFeedback')) $('sc01FlowFeedback').hidden = true;
    changedPending();
  }
  function changedPending() {
    for (const pane of groups.values()) if (pane.node.isConnected) refresh(pane);
    syncPendingNotice();
    root.dispatchEvent(new CustomEvent('sc01:materials-pending'));
  }
  function syncPendingNotice() {
    const pending = hasPending();
    document.body.classList.toggle('sc01-material-pending', pending);
    let notice = $('sc01MaterialPendingNotice');
    if (!notice && $('ncy670StageBar')) {
      notice = document.createElement('div'); notice.id = 'sc01MaterialPendingNotice';
      notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
      $('ncy670StageBar').appendChild(notice);
      notice.addEventListener('click', event => {
        if (event.target.closest('[data-material-cancel]')) cancelPending();
      });
    }
    if (notice) {
      notice.hidden = !pending;
      const count = Object.values(choices).filter(Boolean).length;
      const html = `<strong>เลือกวัสดุใหม่ ${count} รายการ</strong><span>กด “คำนวณและดูผล” เพื่อใช้ทั้งชุด ผลเดิมยังไม่ใช่ของวัสดุที่เลือก</span><button type="button" data-material-cancel>ยกเลิกการเลือก</button>`;
      if (notice.dataset.content !== html) { notice.innerHTML = html; notice.dataset.content = html; }
    }
    if (pending) $('printRoot')?.replaceChildren();
  }
  function syncCapacityNotice(demandOnly) {
    const host = $('overallCard');
    let note = $('sc01-material-capacity-notice');
    if (!demandOnly) { note?.remove(); return; }
    if (!host || note) return;
    note = document.createElement('aside'); note.id = 'sc01-material-capacity-notice';
    note.className = 'sc01-material-unknown-note'; note.setAttribute('role','note');
    note.innerHTML = '<strong>คำนวณแรงที่ต้องรับแล้ว · ยังขาดกำลังพุกรุ่นจริง</strong><p>ดูแรงดึงและแรงเฉือนที่พุกต้องรับได้ด้านล่าง รายการกำลังที่ยังไม่มีข้อมูลจะแสดง “ข้อมูลไม่ครบ” และไม่มี D/C ไม่ใช้ค่า 0 แทนกำลังสินค้า</p><p>ขั้นต่อไป: เลือกชุดพุกพร้อมสตัดที่มีรายงานกำลังและเงื่อนไขตรงกับงาน แล้วตรวจแรงดึง แรงเฉือน การยึดเหนี่ยวและคอนกรีตร่วมกัน ชื่อสินค้าหรือขนาด M อย่างเดียวยังรับรองกำลังไม่ได้</p>';
    host.before(note);
  }
  const trussFields={
    brace:[['brace.H','เหล็กเอว H (mm)'],['brace.B','เหล็กเอว B (mm)'],['brace.tNom','เหล็กเอว t (mm)']],
    'v62-root':[['v62.rootPlateWidthMM','เพลทรากกว้าง (mm; 0 = อัตโนมัติ)',0],['v62.rootPlateHeightMM','เพลทรากสูง (mm; 0 = อัตโนมัติ)',0],['v62.anchorColsPerPlate','จำนวนพุกต่อเพลท',1,4,1],['v62.rootEdgeMM','ระยะขอบคอนกรีต (mm)'],['v62.rootPlateGapMM','ระหว่างเพลท (mm)']],
    'v63-analysis':[['v63.gussetThicknessMM','Gusset หนา (mm)'],['v63.nodeWeldSizeMM','รอยเชื่อมสมาชิกกับ Gusset (mm)']],
    'v65-complete':[['v65.purlinHMM','แป Space H (mm)'],['v65.purlinBMM','แป Space B (mm)'],['v65.purlinTMM','แป Space t (mm)'],['v65.lateralBraceHMM','ค้ำขวาง H (mm)'],['v65.lateralBraceBMM','ค้ำขวาง B (mm)'],['v65.lateralBraceTMM','ค้ำขวาง t (mm)']]
  };
  let trussDialog=null;
  function editTruss(group,title){
    if(hasPending()){explainPending();return;}
    const fields=trussFields[group];if(!fields||!C.isTruss(input()))return;
    const before=input(),stamp=fingerprint(before);
    if(!trussDialog){trussDialog=document.createElement('dialog');trussDialog.id='sc01TrussInputs';trussDialog.className='sc01-audit-dialog';document.body.appendChild(trussDialog);}
    trussDialog.innerHTML=`<form><header><h2 id="sc01TrussInputTitle">${esc(title)}</h2><button type="button" data-truss-close>ปิด</button></header><div class="sc01-audit-body">${fields.map(([path,label,min=.1,max='',step='any'],i)=>`<label for="sc01TrussField${i}">${esc(label)}<input id="sc01TrussField${i}" data-truss-path="${path}" type="number" min="${min}" ${max?`max="${max}"`:''} step="${step}" value="${model.get(before,path)}" required></label>`).join('')}<p role="alert" data-truss-error></p><p>${group==='v65-complete'?'แปและค้ำขวางนี้ใช้กับแบบจำลอง Space; แปหลังคาที่ตรวจดัดและถอดปริมาณเลือกในขั้นหลังคาและแรง':group==='v62-root'?'0 ใช้ขนาดอัตโนมัติของเอนจิ้น ขนาดจริงจำกัดตามคอร์ดและคอนกรีตรองรับ ดูขนาดที่ใช้หลังคำนวณ':'ใช้ค่ากับสมาชิก Truss กลุ่มนี้ทุกชิ้น'}</p><button type="submit" class="button primary">ใช้ค่าและคำนวณ</button></div></form>`;
    trussDialog.setAttribute('aria-labelledby','sc01TrussInputTitle');
    trussDialog.querySelector('[data-truss-close]').onclick=()=>trussDialog.close();
    trussDialog.querySelector('form').onsubmit=event=>{
      event.preventDefault();const error=trussDialog.querySelector('[data-truss-error]');
      try{
        if(hasPending()||drafts()||fingerprint(input())!==stamp)throw Error('ข้อมูลเปลี่ยนแล้ว ปิดหน้าต่างและเปิดแก้จากค่าปัจจุบันอีกครั้ง');
        let next=C.clone(before);
        for(const el of trussDialog.querySelectorAll('[data-truss-path]')){
          const value=el.value.trim()===''?NaN:Number(el.value);if(!Number.isFinite(value)||!el.checkValidity())throw Error('กรอกตัวเลขให้ครบและอยู่ในช่วงที่ระบุ');
          model.put(next,el.dataset.trussPath,value);
        }
        next=C.cleanMetadata(next);const errors=model.validate(next);if(errors.length)throw Error(errors.join(' · '));
        try{setAndCheck(next);}catch(e){app.setState(before);throw e;}
        trussDialog.close();root.NCYGuided.go(3);schedule();
      }catch(e){error.textContent=e.message;}
    };
    trussDialog.showModal();trussDialog.querySelector('input')?.focus();
  }
  function sync() {
    scheduled = false;
    const sizes = $('g59Sizes'), roof = document.querySelector('#g59StepBody .v6-roof-card'), advanced = $('inputGroups');
    const truss=C.isTruss(input()),activeSlots=C.slots.filter(slot=>slot!=='trussWeb'||truss);
    if(sizes&&truss){
      const s=input(),g=root.NCYV62.rootGeometry(C.clone(s));
      const row=(title,value,group,button='แก้')=>`<div class="g59-component" data-truss-size="${group}"><div><small>${esc(title)}</small><b>${esc(value)}</b></div><button ${trussFields[group]?'data-truss-edit':'data-open-group'}="${group}" aria-label="แก้ ${esc(title)}">${button}</button></div>`;
      const html=row('คอร์ดบน–ล่าง Truss',describe('member',s),'member')+
        row('เหล็กเอวตั้ง / ทแยง Truss',describe('trussWeb',s),'brace')+
        row('เพลทรากบน–ล่าง',`${g.plateW} × ${g.plateH} × ${g.plateT} mm · ${g.anchorCols} พุกต่อเพลท`,'v62-root')+
        row('รูเพลท / ความหนา',`Ø${s.plate.holeDiameterMM} / t ${s.plate.thickness} mm`,'plate')+
        row('พุกเพลทราก / ระยะฝัง',describe('anchor',s),'anchors')+
        row('รอยเชื่อมคอร์ดกับเพลทราก',`${s.weld.size} mm`,'weld')+
        row('Gusset / รอยเชื่อมสมาชิก Truss',`t ${s.v63.gussetThicknessMM} / w ${s.v63.nodeWeldSizeMM} mm`,'v63-analysis')+
        row('แป / ค้ำขวางในแบบจำลอง Space',`${s.v65.purlinHMM}×${s.v65.purlinBMM}×${s.v65.purlinTMM} / ${s.v65.lateralBraceHMM}×${s.v65.lateralBraceBMM}×${s.v65.lateralBraceTMM} mm`,'v65-complete')+
        '<p class="g59-small">แบบจำลอง Space ใช้แปและค้ำขวางชุดข้างต้น ส่วนแปหลังคาที่ถอดปริมาณและตรวจดัดเลือกในขั้น “หลังคาและแรง”</p>';
      if(sizes.dataset.trussContents!==html||!sizes.querySelector('[data-truss-size]')){sizes.innerHTML=html;sizes.dataset.trussContents=html;}
    }
    if (sizes) mount(sizes.parentElement, 'sc01-material-structure', truss?['member','trussWeb','plate','anchor']:['member', 'plate', 'anchor'], { before: sizes });
    if (roof) mount(roof, 'sc01-material-ceiling', ['purlin','ceiling']);
    if (advanced) mount(advanced, 'sc01-material-engineer', activeSlots, { before: advanced.firstElementChild, folded: true });
    const demandOnly = C.forceOnlyAnchor(app.getState());
    syncCapacityNotice(demandOnly);
    // An explicitly unknown capacity is not a malformed numeric draft. Keep the
    // retained zero/unknown input and dependency-incomplete result. A transport zero
    // is valid only in this branch; restore the original min for real profiles.
    document.querySelectorAll('#inputPanel input[type="number"]').forEach(el => {
      const path = el.dataset.path || '';
      if (path !== 'anchors.futa' && !path.startsWith('product.')) return;
      if (demandOnly) {
        if (!capacityFields.has(el)) capacityFields.set(el,{readOnly:el.readOnly,title:el.title,min:el.min});
        el.readOnly = true; el.min = '0'; el.title = '0 = ยังไม่มีข้อมูลกำลังรุ่นจริง · คำนวณแรงเท่านั้น';
      } else if (capacityFields.has(el)) {
        Object.assign(el,capacityFields.get(el)); capacityFields.delete(el);
      }
    });
    for (const id of ['group-anchors','group-product']) {
      const host = $(id), existing = host?.querySelector('.sc01-material-unknown-note');
      if (demandOnly && host && !existing) {
        const note = document.createElement('p'); note.className = 'sc01-material-unknown-note';
        note.textContent = 'คำนวณแรงเท่านั้น: ช่องกำลัง/การติดตั้งที่เป็น 0 หมายถึงยังไม่มีข้อมูลและถูกล็อกไว้ ไม่ใช่ค่ารับแรงของสินค้านี้ ต้องมีข้อมูลรุ่นจริงก่อนตรวจรับกำลัง';
        host.insertBefore(note,host.querySelector('summary')?.nextSibling || null);
      } else if (!demandOnly && existing) existing.remove();
    }
    for (const [id, pane] of groups) if (!pane.node.isConnected) groups.delete(id);
    syncPendingNotice();
    root.dispatchEvent(new CustomEvent('sc01:material-inputs-mounted'));
  }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(sync); } }
  // Dimensional draft data only. No calculation or mutation of accepted inputs.
  const pendingItems = () => C.slots.filter(slot => choices[slot]).map(slot => {
    const row = C.records.find(item => item.id === choices[slot] && item.slot === C.catalogSlot(slot));
    return row ? { slot, row: C.clone(row) } : null;
  }).filter(Boolean);
  root.NCYSC01MaterialSelection = Object.freeze({ hasPending, pendingItems, applyPending, cancelPending, explainPending });
  // Save/Open and Auto cannot silently work on the old accepted material set.
  root.addEventListener('click', event => {
    const edit=event.target.closest?.('[data-truss-edit]');
    if(edit){event.preventDefault();event.stopImmediatePropagation();editTruss(edit.dataset.trussEdit,edit.getAttribute('aria-label'));return;}
    if (!hasPending() || !event.target.closest?.('#saveBtn, #loadBtn, #draftBtn, #restoreBtn, .sv-concrete-project button, #easyAutoDesign, #autoDesignBtn, [data-v65-auto], [data-v64-auto]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); explainPending();
  }, true);
  root.addEventListener('beforeunload', event => {
    if (hasPending()) { event.preventDefault(); event.returnValue = ''; }
  });
  document.addEventListener('ncy:v5-updated', schedule);
  root.addEventListener('ncy:v5-updated', schedule);
  const panel = $('inputPanel');
  if (panel) new MutationObserver(schedule).observe(panel, { childList: true, subtree: true });
  sync();
}(window));
