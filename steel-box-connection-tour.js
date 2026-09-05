/* Opt-in click teaching. This module owns only ephemeral lesson/view state. */
(function (root) {
  'use strict';
  const doc = root.document;
  const STEPS = Object.freeze([
    { id: 'size', title: '1. เลือกรูปแบบและดูขนาดงาน', input: 1,
      text: 'กดช่องระยะยื่นหรือความกว้างเพื่อดูค่า และเลือกโครงที่ตรงกับงาน คุณไม่จำเป็นต้องเปลี่ยนค่าเพื่อเรียนขั้นนี้',
      target: '#g59StepBody input, #g59StepBody select', action: '#g59StepBody input, #g59StepBody select, [data-g59-type]',
      waiting: 'ลองกดช่องขนาดหรือปุ่มรูปแบบโครง', done: 'ได้เปิดดูช่องข้อมูลหลักแล้ว' },
    { id: 'loads', title: '2. เลือกวัสดุหลังคาและดูแรง', input: 2,
      text: 'กดตัวเลือกวัสดุหรือช่องแรง แล้วอ่านหน่วย D / L / R / W ใช้ค่าที่ตรงกับงานจริง การสอนนี้ไม่ใส่โหลดให้แทนคุณ',
      target: '#g59StepBody select[data-v6-roof="roofType"], #g59StepBody input:not([type="checkbox"])', action: '#g59StepBody input, #g59StepBody select',
      waiting: 'ลองกดตัวเลือกวัสดุหรือช่องแรง', done: 'ได้เปิดดูวัสดุหรือแรงแล้ว' },
    { id: 'section', title: '3. ดูหน้าตัด เพลท พุก และรอยเชื่อม', input: 3,
      text: 'กด “แก้” ข้างขนาดที่ต้องการดู ระบบจะพาไปช่องจริง อ่านขนาดและหน่วยก่อนแก้ การเลือกพุกรุ่นจริงยังต้องใช้ข้อมูลจากรายงานผู้ผลิต',
      target: '#g59Sizes button', action: '#inputGroups input, #inputGroups select',
      waiting: 'ลองกด “แก้” หรือเปิดช่องขนาดจริง', done: 'ได้เปิดดูหน้าตัดหรือจุดต่อแล้ว' },
    { id: 'calculate', title: '4. กดคำนวณด้วยตัวเอง',
      text: 'กดปุ่ม “คำนวณและดูผล” ของโปรแกรม รอผลปัจจุบัน หากมีช่องไม่ครบ ให้แก้ช่องนั้นก่อน ผลตัวเลขในเกณฑ์ไม่ใช่การอนุมัติแบบก่อสร้าง',
      target: '#sc01RunCalculation', waiting: 'รอคุณกดคำนวณและได้ผลปัจจุบัน', done: 'คำนวณแล้ว และผลตรงกับข้อมูลปัจจุบัน' },
    { id: 'zoom', title: '5. ลองซูมแบบ 3D',
      text: 'วางเมาส์บนแบบแล้วหมุนล้อ หรือใช้ปุ่ม + / − เพื่อซูม ลากเพื่อหมุนมุมมอง กด “พอดีจอ” เมื่อต้องการกลับมองภาพรวม',
      target: '#viewerArea canvas', waiting: 'ลองซูมจนเห็นขนาดภาพเปลี่ยน', done: 'ตรวจพบว่าระยะซูมเปลี่ยนแล้ว' },
    { id: 'results', title: '6. อ่านผลและเปิดผู้ช่วย',
      text: 'กดรายการผลเพื่อตรวจรายละเอียด หรือเปิดผู้ช่วยเพื่อดูว่าต้องแก้ค่าใด ข้อมูลผู้ผลิต หน้างาน และการรับรอง ต้องมีหลักฐานจริง ไม่ใช่กดให้ครบเพื่อให้ผ่าน',
      target: '#resultsPanel', action: '[data-check], [data-fix], [data-advisor-all], #sc01AssistantOpen, [data-sc01-assist="open"]',
      waiting: 'ลองเปิดรายละเอียดผลหรือผู้ช่วย', done: 'ได้เปิดรายละเอียดผลหรือผู้ช่วยแล้ว' },
    { id: 'outputs', title: '7. ตรวจรายงาน A4 และแบบ CAD',
      text: 'เลือก “รายงาน A4” ในเมนู “เพิ่มเติม…” เหนือแบบ แล้วกดแท็บ “แบบ CAD” เพื่อดูอย่างละหน้า ตรวจขนาด กรณีแรง และสถานะเดียวกับผลคำนวณ ขั้นนี้เป็นการดูบนจอ ไม่ต้องกดพิมพ์หรือส่งออกไฟล์',
      target: '#g59ViewMore', waiting: 'เปิดดู A4 จาก “เพิ่มเติม…” และกดแท็บแบบ CAD', done: 'ได้เปิดดู A4 และ CAD ครบแล้ว' },
  ]);
  let active = false, index = 0, minimized = false, panel = null, target = null, returnFocus = null;
  let completed = new Set(), outputVisits = new Set(), notice = '', observer = null, frame = 0;
  let zoomBefore = null, zoomPointer = false, navigating = false, resultActionPending = false, outputActionPending = '', targetOverride = '';
  let locateEpoch = 0, locateFrame = 0, locateSettleFrame = 0;
  const removers = [];
  const $ = id => doc.getElementById(id);
  const app = () => root.NCYApp;
  const current = () => root.NCYSC01InputFlow?.hasCurrentResult?.() === true;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const visible = element => Boolean(element?.isConnected && element.getClientRects().length);
  function listen(host, event, handler, options) {
    host.addEventListener(event, handler, options);
    removers.push(() => host.removeEventListener(event, handler, options));
  }
  function state() {
    return { active, index, step: STEPS[index].id, minimized, completed: [...completed], outputVisits: [...outputVisits] };
  }
  function statusText() {
    const step = STEPS[index];
    if (notice) return notice;
    if (completed.has(step.id)) return step.done;
    if (step.id === 'outputs' && outputVisits.size) return 'เปิดแล้ว: ' + (outputVisits.has('a4') ? 'A4' : 'CAD') + ' · ยังต้องดูอีกหน้า';
    if (!target) return 'จุดนี้ยังไม่อยู่ในหน้าที่เปิด กด “พาไปจุดนี้”';
    return step.waiting;
  }
  function updateStatus() {
    if (!panel) return;
    const status = $('sc01TourStatus');
    const text = statusText();
    if (status && status.textContent !== text) status.textContent = text;
    const next = panel.querySelector('[data-sc01-tour="next"]');
    if (next) next.disabled = !completed.has(STEPS[index].id);
    const count = $('sc01TourCount');
    if (count) count.textContent = `ขั้น ${index + 1} / ${STEPS.length}`;
  }
  function render() {
    if (!panel) return;
    const step = STEPS[index];
    panel.classList.toggle('is-minimized', minimized);
    panel.innerHTML = `<header class="sc01-tour-head"><div><span id="sc01TourCount"></span><h2 id="sc01TourTitle">${esc(minimized ? 'สอนใช้งาน: ' + (index + 1) + ' / ' + STEPS.length : step.title)}</h2></div><div class="sc01-tour-tools"><button type="button" data-sc01-tour="minimize" aria-label="${minimized ? 'ขยายคำแนะนำ' : 'ย่อคำแนะนำ'}" aria-expanded="${!minimized}">${minimized ? 'ขยาย' : 'ย่อ'}</button><button type="button" data-sc01-tour="close" aria-label="ปิดการสอนใช้งาน">✕</button></div></header>
      <div class="sc01-tour-body" ${minimized ? 'hidden' : ''}><p>${esc(step.text)}</p><p class="sc01-tour-status" id="sc01TourStatus" role="status" aria-live="polite"></p><button type="button" class="sc01-tour-locate" data-sc01-tour="locate">พาไปจุดนี้ ↗</button><div class="sc01-tour-navigation"><button type="button" data-sc01-tour="previous" ${index === 0 ? 'disabled' : ''}>ย้อนกลับ</button><button type="button" class="sc01-tour-next" data-sc01-tour="next" disabled>${index === STEPS.length - 1 ? 'จบการสอน' : 'ขั้นถัดไป →'}</button></div><footer><button type="button" data-sc01-tour="restart">เริ่มสอนใหม่</button><span>สอนการกด ไม่แก้ค่าและไม่รับรองแบบ</span></footer></div>`;
    updateStatus();
    position();
  }
  function position() {
    if (!panel) return;
    const rect = target?.getBoundingClientRect();
    // Keep the floating lesson on the opposite vertical side of its target.
    panel.dataset.dock = rect && rect.top + rect.height / 2 > root.innerHeight / 2 ? 'top' : 'bottom';
    panel.dataset.side = rect && rect.left > root.innerWidth / 2 ? 'left' : 'right';
  }
  function resolveTarget() {
    const step = STEPS[index];
    const candidates = [...doc.querySelectorAll(targetOverride || step.target)];
    const next = candidates.find(visible) || null;
    if (next !== target) {
      target?.classList.remove('sc01-tour-target');
      target = next;
      target?.classList.add('sc01-tour-target');
    }
    updateStatus();
    position();
  }
  function schedule() {
    if (!active || frame) return;
    frame = root.requestAnimationFrame(() => { frame = 0; if (active) { checkObservedState(); resolveTarget(); } });
  }
  function cancelLocateSettle() {
    locateEpoch++;
    if (locateFrame) root.cancelAnimationFrame(locateFrame);
    if (locateSettleFrame) root.cancelAnimationFrame(locateSettleFrame);
    locateFrame = 0; locateSettleFrame = 0;
  }
  function settleTarget() {
    const epoch = locateEpoch, intendedStep = index;
    locateFrame = root.requestAnimationFrame(() => {
      locateFrame = 0;
      if (!active || epoch !== locateEpoch || intendedStep !== index) return;
      locateSettleFrame = root.requestAnimationFrame(() => {
        locateSettleFrame = 0;
        if (!active || epoch !== locateEpoch || intendedStep !== index) return;
        // Retained form rendering/restoration and mobile header layout settle
        // first. This is one bounded correction, never a scroll/focus loop.
        navigating = true;
        try {
          resolveTarget();
          if (!target) return;
          target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          if (target.matches('button, input, select, textarea, [tabindex]')) target.focus({ preventScroll: true });
        } finally { navigating = false; }
      });
    });
  }
  function mark(id) {
    if (completed.has(id)) return;
    completed.add(id); notice = ''; updateStatus();
  }
  function checkObservedState() {
    if (!active) return;
    const step = STEPS[index].id;
    if (step === 'zoom' && zoomBefore !== null) {
      const zoom = app()?.getViewer?.()?.zoom;
      if (Number.isFinite(zoom) && Math.abs(zoom - zoomBefore) > 0.00001) { mark('zoom'); zoomBefore = null; }
      else if (!zoomPointer) zoomBefore = null;
    }
    if (!current()) {
      ['calculate', 'results', 'outputs'].forEach(id => completed.delete(id));
      outputVisits.clear(); outputActionPending = ''; resultActionPending = false;
    }
    if (step === 'results' && resultActionPending && doc.querySelector('#detailDialog[open], #sc01AssistantDialog[open]')) {
      resultActionPending = false; mark('results');
    }
    if (step === 'outputs' && current() && outputActionPending) {
      const page = app()?.ui59?.getPage?.();
      if (page === outputActionPending) { outputVisits.add(page); outputActionPending = ''; }
      if (outputVisits.size === 2) mark('outputs');
    }
    updateStatus();
  }
  function observeAction(event) {
    if (!active || navigating || panel?.contains(event.target)) return;
    const step = STEPS[index];
    if (step.input && step.action && event.target.closest?.(step.action)) {
      const intendedStep = Number(root.NCYGuided?.getStep?.()) === step.input;
      if (intendedStep || step.id === 'section' && event.target.closest('#inputGroups')) mark(step.id);
    }
    if (step.id === 'results' && ['pointerdown', 'click', 'keydown'].includes(event.type)) {
      resultActionPending = Boolean(event.target.closest?.(step.action)) &&
        (event.type !== 'keydown' || ['Enter', ' '].includes(event.key));
    }
    if (step.id === 'outputs') {
      const button = event.target.closest?.('button[data-page="a4"], button[data-page="cad"]');
      if (button && ['pointerdown', 'click', 'keydown'].includes(event.type) &&
        (event.type !== 'keydown' || ['Enter', ' '].includes(event.key))) outputActionPending = button.dataset.page;
      // Native select input precedes change. The retained output guard stops
      // later window change listeners, so observe input intent and still wait
      // for the actual current A4/CAD page before counting a visit.
      if (['input', 'change'].includes(event.type) && event.target.id === 'g59ViewMore' && ['a4', 'cad'].includes(event.target.value)) outputActionPending = event.target.value;
    }
    schedule();
  }
  function observeZoom(event) {
    if (!active || STEPS[index].id !== 'zoom' || !event.target.closest?.('#viewerArea, #sc01ZoomIn, #sc01ZoomOut')) return;
    if (event.type === 'pointerdown') { zoomPointer = true; zoomBefore = app()?.getViewer?.()?.zoom ?? null; return; }
    if (event.type === 'pointerup') zoomPointer = false;
    else { zoomPointer = false; zoomBefore = app()?.getViewer?.()?.zoom ?? null; }
    schedule();
  }
  function install() {
    listen(panel, 'click', event => {
      const action = event.target.closest('button[data-sc01-tour]');
      if (!action) return;
      event.preventDefault();
      switch (action.dataset.sc01Tour) {
        case 'close': close(); break;
        case 'minimize': minimize(); break;
        case 'locate': locate(); break;
        case 'next': next(); break;
        case 'previous': previous(); break;
        case 'restart': restart(); break;
      }
    });
    listen(root, 'keydown', event => { if (event.key === 'Escape' && !doc.querySelector('dialog[open]')) close(); }, true);
    listen(root, 'pointerdown', cancelLocateSettle, true);
    listen(root, 'wheel', cancelLocateSettle, { capture: true, passive: true });
    listen(root, 'keydown', cancelLocateSettle, true);
    listen(root, 'focusin', observeAction, true);
    listen(root, 'click', observeAction, true);
    listen(root, 'change', observeAction, true);
    listen(root, 'input', observeAction, true);
    listen(root, 'pointerdown', observeAction, true);
    listen(root, 'keydown', observeAction, true);
    listen(root, 'pointerdown', observeZoom, true);
    listen(root, 'pointerup', observeZoom, true);
    listen(root, 'click', observeZoom, true);
    listen(root, 'wheel', observeZoom, { capture: true, passive: true });
    listen(root, 'keydown', observeZoom, true);
    listen(root, 'ncy:sc01-user-calculated', () => { if (STEPS[index].id === 'calculate' && current()) mark('calculate'); schedule(); });
    listen(root, 'ncy:v5-updated', schedule);
    listen(root, 'resize', schedule, { passive: true });
    listen(doc, 'scroll', schedule, { capture: true, passive: true });
    observer = new root.MutationObserver(records => {
      if (records.some(record => !panel.contains(record.target))) schedule();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }
  function start() {
    if (!root.__scCustomerEntryAuthorized || root.__scWorkbenchBootFailed || !app() || !root.NCYUI670 || !root.NCYGuided) return false;
    if (active) { minimized = false; render(); resolveTarget(); return true; }
    active = true; returnFocus = doc.activeElement;
    doc.body.classList.add('sc01-tour-active');
    panel = doc.createElement('aside'); panel.id = 'sc01Tour'; panel.className = 'sc01-tour';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'sc01TourTitle');
    doc.body.appendChild(panel); install(); render(); resolveTarget();
    panel.querySelector('[data-sc01-tour="locate"]')?.focus({ preventScroll: true });
    return true;
  }
  function close() {
    if (!active) return;
    active = false;
    cancelLocateSettle(); doc.body.classList.remove('sc01-tour-active');
    observer?.disconnect(); observer = null;
    if (frame) root.cancelAnimationFrame(frame); frame = 0;
    while (removers.length) removers.pop()();
    target?.classList.remove('sc01-tour-target'); target = null;
    panel?.remove(); panel = null; zoomBefore = null; zoomPointer = false; resultActionPending = false; outputActionPending = '';
    if (visible(returnFocus)) returnFocus.focus({ preventScroll: true });
  }
  function minimize(value) {
    if (!active) return;
    minimized = typeof value === 'boolean' ? value : !minimized;
    render(); panel.querySelector('[data-sc01-tour="minimize"]')?.focus({ preventScroll: true });
  }
  function next() {
    if (!active) return false;
    if (['calculate', 'zoom', 'results', 'outputs'].includes(STEPS[index].id) && !current()) {
      checkObservedState();
      notice = 'ข้อมูลเปลี่ยนหรือยังไม่ครบ ให้กดคำนวณของโปรแกรมก่อน แล้วตรวจผลและหน้ารายงานใหม่';
      updateStatus(); return false;
    }
    if (!completed.has(STEPS[index].id)) return false;
    cancelLocateSettle();
    if (index === STEPS.length - 1) { close(); return true; }
    index++; notice = ''; zoomBefore = null; zoomPointer = false; resultActionPending = false; outputActionPending = ''; targetOverride = ''; render(); resolveTarget(); return true;
  }
  function previous() {
    if (!active || index === 0) return false;
    cancelLocateSettle();
    index--; notice = ''; zoomBefore = null; zoomPointer = false; resultActionPending = false; outputActionPending = ''; targetOverride = ''; render(); resolveTarget(); return true;
  }
  function restart() {
    cancelLocateSettle();
    index = 0; completed = new Set(); outputVisits = new Set(); notice = ''; minimized = false; targetOverride = '';
    if (!active) return start();
    render(); resolveTarget(); return true;
  }
  function locate() {
    if (!active) return false;
    cancelLocateSettle();
    const step = STEPS[index]; notice = ''; targetOverride = ''; navigating = true;
    try {
      if (step.input) {
        root.NCYUI670.setStage('input', { activateModel: false });
        if (app().getState()?.v5?.inputMode !== 'easy') {
          // Input mode participates in the retained authority fingerprint. The
          // lesson may point to its real control, but must not change it itself.
          targetOverride = '#easyModeBtn';
          notice = 'คุณอยู่โหมดวิศวกร ให้กดปุ่ม “ใช้งานง่าย” ที่เน้นไว้ด้วยตัวเอง แล้วกด “พาไปจุดนี้” อีกครั้ง';
          resolveTarget();
          target?.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
          target?.focus({ preventScroll: true });
          settleTarget();
          return false;
        }
        if (Number(root.NCYGuided.getStep()) !== step.input && root.NCYGuided.go(step.input) === false) {
          notice = 'แก้ช่องที่ยังกรอกไม่ครบก่อน แล้วกดพาไปจุดนี้อีกครั้ง'; return false;
        }
      } else if (step.id === 'zoom' || step.id === 'results' || step.id === 'outputs') {
        if (!current()) { notice = 'ข้อมูลเปลี่ยนหรือยังไม่ครบ ให้กดคำนวณของโปรแกรมก่อน การสอนจะไม่คำนวณแทนคุณ'; return false; }
        root.NCYUI670.setStage(step.id === 'results' ? 'review' : 'model', { activateModel: false });
        if (step.id === 'zoom') app().renderView('iso');
      }
      resolveTarget();
      if (!target) { notice = 'ยังไม่พบปุ่มหรือช่องนี้ในหน้าปัจจุบัน ลองปิดหน้ารายละเอียดแล้วกดพาไปจุดนี้อีกครั้ง'; return false; }
      target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      if (target.matches('button, input, select, textarea, [tabindex]')) target.focus({ preventScroll: true });
      if (root.innerWidth <= 680) minimize(true);
      settleTarget();
      return true;
    } catch (_error) {
      notice = 'ยังเปิดจุดนี้ไม่ได้ ใช้ปุ่มเดิมของโปรแกรมได้ตามปกติ แล้วลองคำแนะนำอีกครั้ง'; return false;
    } finally { navigating = false; resolveTarget(); }
  }
  root.NCYSC01Tour = Object.freeze({ VERSION: '20260904-r9', STEPS, start, close, restart, next, previous, minimize, locate, getState: state });
})(window);
