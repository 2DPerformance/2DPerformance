/* SC01 R13: presentation and native-control routing only. No calculation state. */
(function (root) {
  'use strict';
  const doc = root.document;
  let frame = 0;
  let initialized = false;
  let helpReturn = '';
  const byId = id => doc.getElementById(id);
  const query = selector => doc.querySelector(selector);
  function text(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }
  function button(id, label, parent) {
    let node = byId(id);
    if (!node && parent) {
      node = doc.createElement('button');
      node.type = 'button';
      node.id = id;
      node.className = 'button secondary sc01-r12-tool';
      node.textContent = label;
      parent.appendChild(node);
    }
    return node;
  }
  function nativeStage(stage) {
    // Preserve the original early click gates, including stale-result validation.
    query('[data-ncy670-stage="' + stage + '"]')?.click();
  }
  const documentPages = Object.freeze([
    {
      key: 'a4',
      number: '01',
      title: 'รายการคำนวณ',
      detail: 'ผลตรวจ แรง สมการแทนค่า และหลักฐานคำนวณ A4',
      action: 'เปิดรายการคำนวณ',
    },
    {
      key: 'cad',
      number: '02',
      title: 'แบบและรายละเอียด',
      detail: 'แผ่นแบบ A3, CAD, DXF และมิติจากโมเดลปัจจุบัน',
      action: 'เปิดแบบงาน',
    },
    {
      key: 'boq',
      number: '03',
      title: 'BOQ / รายการจัดหา',
      detail: 'ปริมาณ ราคา และวิธีถอด แยกจากผลตรวจทางวิศวกรรม',
      action: 'เปิด BOQ',
    },
  ]);
  function documentCard(item) {
    const card = doc.createElement('button');
    card.type = 'button';
    card.className = 'sc01-document-card';
    card.dataset.page = item.key;
    card.dataset.documentPage = item.key;
    card.setAttribute('aria-label', item.action + ' — ' + item.detail);
    const number = doc.createElement('span');
    number.className = 'sc01-document-card__number';
    number.textContent = item.number;
    const copy = doc.createElement('span');
    copy.className = 'sc01-document-card__copy';
    const title = doc.createElement('strong');
    title.textContent = item.title;
    const detail = doc.createElement('small');
    detail.textContent = item.detail;
    copy.appendChild(title);
    copy.appendChild(detail);
    const action = doc.createElement('span');
    action.className = 'sc01-document-card__action';
    action.textContent = item.action + ' →';
    card.appendChild(number);
    card.appendChild(copy);
    card.appendChild(action);
    return card;
  }
  function arrangeDocuments(page) {
    const main = byId('mainContent');
    if (!main || !documentPages.some(item => item.key === page)) return;
    let center = byId('sc01DocumentCenter');
    if (!center || center.parentElement !== main) {
      center = doc.createElement('section');
      center.id = 'sc01DocumentCenter';
      center.className = 'sc01-document-center';
      center.setAttribute('aria-labelledby', 'sc01DocumentCenterTitle');
      const heading = doc.createElement('header');
      const copy = doc.createElement('div');
      const eyebrow = doc.createElement('span');
      eyebrow.className = 'sc01-document-center__eyebrow';
      eyebrow.textContent = 'DOCUMENT CENTER / CURRENT RESULT';
      const title = doc.createElement('h2');
      title.id = 'sc01DocumentCenterTitle';
      title.textContent = 'เอกสารคนละหน้าที่ ไม่ปนกัน';
      const description = doc.createElement('p');
      description.textContent = 'เลือกดูผลคำนวณ แบบงาน หรือ BOQ จากข้อมูลชุดปัจจุบัน';
      copy.appendChild(eyebrow);
      copy.appendChild(title);
      copy.appendChild(description);
      const authority = doc.createElement('span');
      authority.className = 'sc01-document-center__authority';
      authority.textContent = 'REVIEW ONLY · NO IMMUTABLE SNAPSHOT';
      heading.appendChild(copy);
      heading.appendChild(authority);
      const nav = doc.createElement('nav');
      nav.setAttribute('aria-label', 'เลือกประเภทเอกสาร');
      documentPages.forEach(item => nav.appendChild(documentCard(item)));
      center.appendChild(heading);
      center.appendChild(nav);
      main.insertBefore(center, main.firstElementChild || null);
    }
    center.querySelectorAll('[data-document-page]').forEach(card => {
      const active = card.dataset.documentPage === page;
      card.classList.toggle('active', active);
      if (active) card.setAttribute('aria-current', 'page');
      else card.removeAttribute('aria-current');
    });
    text(byId('workspaceTitle'), page === 'a4' ? 'รายการคำนวณ A4'
      : page === 'cad' ? 'แบบและรายละเอียด A3 / CAD' : 'BOQ / รายการจัดหา');
    if (page === 'boq') {
      const actions = query('#mainContent .boq-footer-actions');
      const print = button('sc01BOQPrint', 'พิมพ์ BOQ A4', actions);
      if (print) {
        print.className = 'button small primary sc01-document-print';
        print.dataset.print = 'BOQ';
        print.setAttribute('aria-label', 'พิมพ์หรือบันทึก BOQ A4');
      }
    }
  }
  function arrangeWorkflow() {
    text(query('.ncy670-version'), 'UI R13 · LOCAL REVIEW');
    const controls = query('.ncy670-stage-controls');
    const run = byId('sc01RunCalculation');
    const review = query('[data-ncy670-stage="review"]');
    if (!controls || !run || !review) return;
    if (run.parentElement !== controls) controls.insertBefore(run, review);
    const report = button('sc01r12Report', 'เอกสาร', controls);
    report.dataset.page = 'a4';
    report.setAttribute('aria-label', '4 ศูนย์เอกสาร');
    run.setAttribute('aria-label', '2 คำนวณและดูผล');
    const authority = query('.ncy670-authority');
    const heading = query('.project-heading');
    if (authority && heading && authority.parentElement !== heading) heading.appendChild(authority);
    // Keep the export menu and all its original document-level handlers intact.
    const exportButton = byId('g59Files');
    if (exportButton) {
      exportButton.title = 'รูปแบบรายงาน CAD และดาวน์โหลด';
      exportButton.setAttribute('aria-label', 'ส่งออก รายงานและ CAD');
      text(exportButton, 'ส่งออก ▾');
    }
    text(byId('printA4')?.querySelector('span'), 'PDF รายการคำนวณ');
    text(byId('printA3')?.querySelector('span'), 'แบบ A3');
    text(query('#g59ExportMenu [data-page="boq"]'), 'BOQ / รายการจัดหา');
    byId('loadBtn')?.setAttribute('aria-label', 'เปิดงาน');
    byId('saveBtn')?.setAttribute('aria-label', 'บันทึกงาน');
  }
  function arrangeHelp() {
    const actions = query('.top-actions');
    if (!actions) return;
    let help = byId('sc01r12Help');
    if (!help) {
      help = doc.createElement('details');
      help.id = 'sc01r12Help';
      const summary = doc.createElement('summary');
      summary.textContent = 'ช่วยใช้งาน';
      help.appendChild(summary);
      const menu = doc.createElement('div');
      menu.id = 'sc01r12HelpMenu';
      help.appendChild(menu);
      actions.appendChild(help);
    }
    const menu = byId('sc01r12HelpMenu');
    ['sc01FlowHelp', 'sc01DemoOpen', 'sc01DemoExamples'].forEach(id => {
      const node = byId(id);
      if (node && node.parentElement !== menu) menu.appendChild(node);
    });
  }
  function arrangeViewport() {
    const tabs = byId('pageTabs');
    const roofTab = query('#pageTabs [data-page="iso"]');
    text(roofTab, '3D หลังคา');
    roofTab?.setAttribute('aria-label', '3D หลังคาและโหลด');
    const expand = button('sc01r12Expand', 'ขยายแปลน', tabs);
    const options = button('sc01r12Options', 'ตั้งค่ามุมมอง', tabs);
    if (expand && !expand.dataset.bound) {
      expand.dataset.bound = 'true';
      expand.onclick = () => nativeStage(root.NCYUI670?.getStage?.() === 'model' ? 'input' : 'model');
    }
    if (options && !options.dataset.bound) {
      options.dataset.bound = 'true';
      options.setAttribute('aria-controls', 'sc01r12CaseSettings sc01r12LayerSettings');
      options.onclick = () => {
        const open = doc.body.classList.toggle('sc01-r12-options-open');
        options.setAttribute('aria-expanded', String(open));
        requestSync();
      };
    }
    const caseToolbar = query('.case-toolbar');
    const layers = query('#viewerArea .viewer-options');
    if (caseToolbar) caseToolbar.id = 'sc01r12CaseSettings';
    if (layers) layers.id = 'sc01r12LayerSettings';
    const toolbar = query('#viewerArea .viewer-toolbar');
    const sceneButtons = byId('sceneButtons');
    if (toolbar && sceneButtons && !byId('sc01r12Scene')) {
      const scene = doc.createElement('select');
      scene.id = 'sc01r12Scene';
      scene.setAttribute('aria-label', 'ฉากสามมิติ');
      for (const source of sceneButtons.querySelectorAll('[data-v6-scene]')) {
        const option = doc.createElement('option');
        option.value = source.dataset.v6Scene;
        option.textContent = source.textContent.trim();
        scene.appendChild(option);
      }
      scene.onchange = () => {
        // Original scene click owns geometry and trace labels; never setScene directly.
        const source = [...sceneButtons.querySelectorAll('[data-v6-scene]')]
          .find(item => item.dataset.v6Scene === scene.value);
        source?.click();
        requestSync();
      };
      toolbar.insertBefore(scene, sceneButtons);
      const caseText = doc.createElement('span');
      caseText.id = 'sc01r12CaseText';
      toolbar.appendChild(caseText);
    }
  }
  function syncStatus() {
    const status = byId('projectLayoutStatus');
    if (!status) return;
    const description = status.querySelector('small');
    const hold = (description?.textContent || status.getAttribute('aria-label') || '').match(/HOLD\s+\d+/i);
    let limit = byId('sc01r12LayoutLimit');
    if (!limit) {
      limit = doc.createElement('span');
      limit.id = 'sc01r12LayoutLimit';
      status.appendChild(limit);
    }
    text(limit, hold ? hold[0] : 'ตรวจทานก่อนใช้');
    const toggle = button('sc01r12StatusToggle', 'ดูข้อจำกัด', status);
    const open = doc.body.classList.contains('sc01-r12-status-open');
    toggle.setAttribute('aria-expanded', String(open));
    if (description) {
      description.id = 'sc01r12LayoutReasons';
      toggle.setAttribute('aria-controls', description.id);
    }
    text(toggle, open ? 'ย่อข้อจำกัด' : 'ดูข้อจำกัด');
    if (!toggle.dataset.bound) {
      toggle.dataset.bound = 'true';
      toggle.onclick = () => {
        doc.body.classList.toggle('sc01-r12-status-open');
        requestSync();
      };
    }
  }
  function sync() {
    frame = 0;
    if (!initialized) return;
    arrangeWorkflow();
    arrangeHelp();
    arrangeViewport();
    syncStatus();
    const stage = root.NCYUI670?.getStage?.() || 'input';
    const page = root.NCYApp?.ui59?.getPage?.();
    const showingReport = stage === 'model' && ['a4', 'cad', 'plateReport', 'formulas', 'boq'].includes(page);
    byId('sc01r12Report')?.setAttribute('aria-pressed', String(showingReport));
    arrangeDocuments(page);
    if (helpReturn === 'tour' && !doc.body.classList.contains('sc01-tour-active')) {
      helpReturn = '';
      byId('sc01r12Help')?.querySelector('summary')?.focus({ preventScroll: true });
    }
    const expand = byId('sc01r12Expand');
    text(expand, stage === 'model' ? 'กลับกรอกข้อมูล' : 'ขยายแปลน');
    expand?.setAttribute('aria-pressed', String(stage === 'model'));
    const optionsOpen = doc.body.classList.contains('sc01-r12-options-open');
    byId('sc01r12Options')?.setAttribute('aria-expanded', String(optionsOpen));
    const activeScene = query('#sceneButtons [data-v6-scene].active');
    const scene = byId('sc01r12Scene');
    if (scene && activeScene && doc.activeElement !== scene) scene.value = activeScene.dataset.v6Scene;
    const select = byId('caseSelect');
    const current = root.NCYSC01InputFlow?.hasCurrentResult?.() === true;
    const selectedCase = select?.selectedOptions?.[0]?.textContent || 'ยังไม่มีกรณีแรง';
    const caseLabel = current ? selectedCase : 'รอคำนวณใหม่ · ' + selectedCase;
    text(byId('sc01r12CaseText'), caseLabel);
    if (byId('sc01r12CaseText')) byId('sc01r12CaseText').title = caseLabel;
    const picked = byId('pickedPart');
    if (picked) {
      const empty = /ยังไม่ได้เลือกชิ้นส่วน|เลือกชิ้นส่วนเพื่อ/.test(picked.textContent);
      picked.dataset.sc01r12Empty = String(empty);
    }
    const subtitle = query('#inputPanel .panel-head > div > span');
    text(subtitle, 'เลือกหมวด กรอกค่า แล้วคำนวณ');
  }
  function requestSync() {
    if (!frame) frame = root.requestAnimationFrame(sync);
  }
  function init() {
    if (initialized || !root.NCYApp?.ui59 || !byId('sc01RunCalculation')) return false;
    initialized = true;
    doc.body.classList.add('sc01-r12');
    doc.body.dataset.sc01Redesign = 'r13-local-review';
    sync();
    // Observe only chrome/status roots, never inputs or drawing/canvas frames.
    const observer = new MutationObserver(requestSync);
    for (const node of [byId('projectLayoutStatus'), byId('pickedPart'), query('.top-actions')]) {
      if (node) observer.observe(node, { childList: true, subtree: true });
    }
    const stageObserver = new MutationObserver(requestSync);
    stageObserver.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
    root.addEventListener('ncy:v5-updated', requestSync);
    // Retained preview only scrolls the workspace, which is hidden in mobile input
    // stage. Route this explicit view intent through the native model-stage button.
    doc.addEventListener('click', event => {
      if (!event.target.closest('[data-g59-preview]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      nativeStage('model');
      requestSync();
    }, true);
    byId('sc01DemoDialog')?.addEventListener('close', () => {
      if (helpReturn !== 'demo') return;
      helpReturn = '';
      root.requestAnimationFrame(() => byId('sc01r12Help')?.querySelector('summary')?.focus({ preventScroll: true }));
    });
    doc.addEventListener('click', event => {
      requestSync();
      const help = byId('sc01r12Help');
      if (help?.open && !help.contains(event.target)) help.open = false;
      const launch = event.target.closest('#sc01DemoOpen,#sc01DemoExamples');
      if (launch && help) {
        helpReturn = launch.id === 'sc01DemoOpen' ? 'tour' : 'demo';
        help.open = false;
      }
      if (help && event.target.closest('[data-sc01-start-input],[data-sc01-close-help]')) {
        help.open = false;
        if (event.target.closest('[data-sc01-close-help]')) help.querySelector('summary')?.focus({ preventScroll: true });
      }
    });
    doc.addEventListener('change', requestSync);
    doc.addEventListener('input', requestSync);
    doc.addEventListener('keydown', event => {
      const help = byId('sc01r12Help');
      if (event.key === 'Escape' && help?.open) {
        help.open = false;
        help.querySelector('summary')?.focus({ preventScroll: true });
      }
    });
    return true;
  }
  root.NCYSC01Redesign = Object.freeze({ init, refresh: requestSync });
  function boot(attempt = 0) {
    if (!init() && !initialized && attempt < 20) root.setTimeout(() => boot(attempt + 1), 200);
  }
  // R15: initialize as soon as the native controls exist; no intermediate UI wait.
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  else boot();
})(window);
