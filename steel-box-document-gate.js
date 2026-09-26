/* SC01 R32: Owner requires every applicable check to pass before documents. */
(function (root) {
  'use strict';
  const doc = root.document;
  const pages = Object.freeze(['a4', 'plateReport', 'cad', 'boq']);
  const inventory = Object.freeze(('member deflection weld plate stiffener anchorSteel productInteraction breakoutT bond breakoutV pryout gapBending geometry solver existing productGate scope rebarScan designBasis codeCoverage legalCompliance physicalGeometry numericIntegrity trussSystem trussRootGeometry trussRootConnection trussMember trussNode rcSupport trussMemberAdvanced trussLateralBracing trussNodeAdvanced rootPlateNoPrying trussCutList spaceTruss3D trussSecondOrder trussHSSJoint rootPlateComponent braceLowerConnection stiffenerDetail rcSupportSystem designProfiles profileVerification fabricationDraft projectRelease').split(' '));
  const nonRatioChecks = new Set(['trussCutList', 'trussOutOfPlane']);
  const qualitativeChecks = new Set(('existing productGate rebarScan designBasis codeCoverage legalCompliance productSnapshot designProfiles profileVerification fabricationDraft projectRelease').split(' '));
  const releaseKeys = Object.freeze(['numerical', 'product', 'support', 'scan', 'bracing', 'documents', 'independent']);
  const isDocumentPage = page => pages.includes(page);
  const validObject = value => value && typeof value === 'object' && !Array.isArray(value);
  const app = () => root.NCYApp;

  function assess(result, context = {}) {
    const reasons = [], excluded = [];
    const add = (key, label, kind, note, ratio) => reasons.push({ key, label, kind, note: note || '', ratio: Number.isFinite(ratio) ? ratio : null });
    if (context.current !== true || context.inputValid === false) {
      add('current', 'ต้องคำนวณจากข้อมูลปัจจุบัน', 'data', 'กรอกช่องที่ค้างให้ครบ แล้วกดคำนวณและดูผล');
    }
    if (!validObject(result) || !validObject(result.checks)) {
      add('result', 'ยังไม่มีผลคำนวณที่ตรวจได้', 'data', 'ไม่มีเอกสารจากผลเก่าหรือการคำนวณที่หยุดกลางทาง');
    } else {
      if (!validObject(result.state)) add('inputs', 'ผลคำนวณไม่มีข้อมูลนำเข้าที่ใช้ตรวจ', 'data', 'ต้องคำนวณจากข้อมูลโครงการปัจจุบัน');
      for (const key of inventory) if (!Object.hasOwn(result.checks, key)) {
        add(key, 'ผลตรวจขาดรายการ: ' + key, 'data', 'Engine ต้องส่งรายการตรวจที่จำเป็นครบ ไม่ใช้เฉพาะตารางที่กรองแล้ว');
      }
      for (const [key, check] of Object.entries(result.checks)) {
        if (!validObject(check)) { add(key, key, 'data', 'ข้อมูลผลตรวจไม่ถูกต้อง'); continue; }
        if (check.state === 'na') {
          if (check.sizeEligible === false || check.engineState === 'fail' || Number.isFinite(check.ratio) && check.ratio > 1) add(key, check.label || key, 'fail', 'สถานะไม่เกี่ยวข้องขัดกับผลตรวจที่ไม่ผ่าน', check.ratio);
          else excluded.push(key);
          continue;
        }
        // A low strength ratio never overrides failed sizing or an unfinished
        // check. This controls document access, not the retained engine verdict.
        if (!['ok', 'fail', 'outside', 'incomplete', 'hold', 'review', 'warn'].includes(check.state)) {
          add(key, check.label || key, 'data', 'รูปแบบผลตรวจไม่ถูกต้อง ต้องคำนวณใหม่');
        }
        if (check.ratio != null && (typeof check.ratio !== 'number' || check.ratio < 0
            || !Number.isFinite(check.ratio) && !nonRatioChecks.has(key) && !['incomplete', 'outside', 'hold', 'fail'].includes(check.state))) {
          add(key, check.label || key, 'data', 'ค่าผลตรวจไม่ถูกต้อง ต้องคำนวณใหม่');
        }
        if (check.ratio == null && check.state === 'ok' && !nonRatioChecks.has(key) && !qualitativeChecks.has(key)) {
          add(key, check.label || key, 'data', 'ระบุว่าผ่านแต่ไม่มีค่าผลตรวจ ไม่สามารถออกเอกสารได้');
        }
        const failed = check.sizeEligible === false || check.state === 'fail'
          || check.engineState === 'fail' || Number.isFinite(check.ratio) && check.ratio > 1;
        if (failed) {
          let note = check.note || 'ผลตรวจรายการนี้ยังไม่ผ่าน';
          const weld = key === 'weld' && result.controls?.weld?.weld;
          if (weld && Number.isFinite(weld.minSize) && Number.isFinite(weld.maxSize)) {
            const size = result.state?.weld?.size;
            const num = value => Number.isFinite(value) ? String(Number(value.toFixed(5))) : 'ยังไม่ระบุ';
            note = `ขารอยเชื่อม ${num(size)} mm · ต่ำสุด ${num(weld.minSize)} mm · สูงสุด ${num(weld.maxSize)} mm`
              + (weld.minSize > weld.maxSize ? ' · ไม่มีช่วงขนาดร่วมที่ใช้ได้' : ' · ขนาดต้องอยู่ในช่วงที่ตรวจ')
              + ' · D/C กำลังต่ำกว่า 1 ไม่ได้ทำให้เงื่อนไขขนาดผ่าน';
          }
          add(key, check.label || key, 'fail', note, check.ratio);
        } else if (['incomplete', 'outside', 'hold'].includes(check.state)
            || ['incomplete', 'outside', 'hold'].includes(check.engineState)) {
          add(key, check.label || key, 'data', check.note || 'ผลตรวจรายการนี้ยังไม่ครบหรืออยู่นอกขอบเขต', check.ratio);
        } else if (check.methodReview === true || ['review', 'warn'].includes(check.state)
            || ['review', 'warn'].includes(check.engineState)) {
          add(key, check.label || key, 'method', check.note || 'รายการนี้ยังมีเงื่อนไขที่ต้องตรวจรับ', check.ratio);
        }
      }
      if (result.state?.takeoff?.includePurlins) for (const key of ['purlinBending', 'purlinDeflection']) {
        if (!Object.hasOwn(result.checks, key) || result.checks[key]?.state === 'na') {
          add(key, 'ผลตรวจแปยังไม่ครบ: ' + key, 'data', 'งานที่รวมแปต้องมีผลกำลังและการแอ่นของแป');
        }
      }
      if (!Object.values(result.checks).some(check => validObject(check) && check.state !== 'na')) {
        add('inventory', 'ยังไม่มีรายการตรวจที่ใช้งาน', 'data', 'รายการไม่เกี่ยวข้องทั้งหมดไม่ใช่การคำนวณผ่าน');
      }
      if (!Array.isArray(result.cases) || !result.cases.length || result.cases.some(item =>
        !validObject(item.action) || !['N', 'Vx', 'Vy', 'Mx', 'My', 'Tz'].every(key => Number.isFinite(item.action[key])))) {
        add('cases', 'ผลแรงยังไม่ครบหรือไม่เป็นจำนวน', 'data', 'ต้องมีผลแรงของกรณีคำนวณจริง');
      }
    }
    const counts = { fail: 0, data: 0, method: 0 };
    const priority = row => ['current', 'result'].includes(row.key) ? -1 : { fail: 0, data: 1, method: 2 }[row.kind];
    reasons.sort((a, b) => priority(a) - priority(b));
    reasons.forEach(row => counts[row.kind]++);
    return { ready: reasons.length === 0, purpose: 'passed-checks-only', reasons, counts, excluded,
      engineeringReady: result?.releaseGate?.readyForEngineerIssue === true, constructionAuthorized: false };
  }

  function inspect(result = app()?.getResult?.()) {
    const current = Boolean(result && result === app()?.getResult?.()
      && root.NCYSC01InputFlow?.hasCurrentResult?.() === true
      && !doc?.body?.classList.contains('has-pending57')
      && !root.NCYSC01NumericDrafts?.hasPending?.());
    return assess(result, { current, inputValid: !Object.keys(app()?.ui59?.getDraftErrors?.() || {}).length });
  }
  function allow(kind, result = app()?.getResult?.(), announce = true) {
    const status = inspect(result);
    if (!status.ready && announce) showReasons(status);
    return status.ready;
  }
  function requireDocument(result) {
    if (!inspect(result).ready) throw new Error('SC01_DOCUMENT_NOT_READY: ต้องคำนวณข้อมูลปัจจุบันและผ่านทุกรายการที่ใช้ ก่อนเปิดรายงานหรือส่งออก');
  }

  let frame = 0, panelKey = '', showing = false, installed = false;
  const byId = id => doc?.getElementById(id);
  const blockedSelectors = [
    ...pages.map(page => '[data-page="' + page + '"]'),
    '[data-document-page]', '[data-sc01-output-page]', '[data-print]', '[data-cad-action]',
    '#printA4', '#printA3', '#plateReportBtn', '#plateReportShortcut', '#sc01BOQPrint',
    '#anchorCSV', '#checksCSV', '#exportBOQ', '#formulaText', '#dialogSVG', '#dialogPNG',
    '#v64CSV', '#png3D', '#exportView'
  ].join(',');
  function clearPaper() {
    byId('printRoot')?.replaceChildren();
    delete doc.body.dataset.printKind;
  }
  function create(tag, text, className) {
    const node = doc.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function renderStatus(status, expand = false) {
    if (status.ready) { byId('sc01DocumentReadiness')?.remove(); panelKey = ''; return null; }
    const parent = byId('overallCard')?.parentElement;
    if (!parent) return null;
    let panel = byId('sc01DocumentReadiness');
    if (!panel) {
      panel = create('section', '', 'sc01-document-readiness');
      panel.id = 'sc01DocumentReadiness';
      panel.tabIndex = -1;
      panel.setAttribute('aria-labelledby', 'sc01DocumentReadinessTitle');
      parent.insertBefore(panel, byId('overallCard'));
    }
    const signature = JSON.stringify(status);
    if (signature !== panelKey || !panel.firstElementChild) {
      const wasOpen = expand || panel.querySelector('details')?.open;
      panelKey = signature;
      panel.replaceChildren();
      panel.dataset.ready = String(status.ready);
      const title = create('h3', 'ยังออกเอกสารไม่ได้');
      title.id = 'sc01DocumentReadinessTitle';
      const summary = create('p', [status.counts.fail && `ไม่ผ่าน ${status.counts.fail} รายการ`,
        status.counts.data && `ข้อมูลหรือผลยังไม่ครบ ${status.counts.data} รายการ`,
        status.counts.method && `รอตรวจรับ ${status.counts.method} รายการ`].filter(Boolean).join(' · ')
        + ' ต้องแก้และผ่านทุกรายการที่ใช้ก่อนเปิดรายงานหรือส่งออก');
      panel.append(title, summary);
      if (!status.ready) {
        const details = create('details');
        details.open = Boolean(wasOpen);
        details.appendChild(create('summary', 'ดูรายการที่ต้องแก้ก่อนออกเอกสาร'));
        const list = create('ul');
        for (const row of status.reasons) {
          const item = create('li');
          item.append(create('strong', row.label), create('span',
            { fail: 'ไม่ผ่าน / นอกขอบเขต', data: 'ข้อมูลหรือผลยังไม่ครบ', method: 'วิธีตรวจยังไม่ผ่านการตรวจรับ' }[row.kind]));
          if (row.note) item.appendChild(create('p', row.note));
          if (app()?.getResult?.()?.checks?.[row.key]) {
            const detail = create('button', 'ดูผลและสาเหตุ');
            detail.type = 'button'; detail.dataset.check = row.key;
            item.appendChild(detail);
            if (row.kind === 'fail' || row.kind === 'data') {
              const fix = create('button', 'ไปแก้รายการนี้');
              fix.type = 'button'; fix.dataset.fix = row.key;
              item.appendChild(fix);
            }
          }
          list.appendChild(item);
        }
        details.appendChild(list);
        if (status.counts.method) {
          const methods = create('button', 'ดูขอบเขตวิธีคำนวณ');
          methods.type = 'button'; methods.addEventListener('click', () => app()?.showCoverage?.());
          details.appendChild(methods);
        }
        panel.appendChild(details);
      }
    }
    if (expand && panel.querySelector('details')) panel.querySelector('details').open = true;
    return panel;
  }
  function showReasons(status = inspect()) {
    if (!doc || showing) return;
    showing = true;
    try {
      for (const id of ['detailDialog', 'sc01DetachedExportHold']) if (byId(id)?.open) byId(id).close();
      for (const id of ['g59ExportMenu', 'moreMenu']) if (byId(id)) byId(id).hidden = true;
      byId('g59Files')?.setAttribute('aria-expanded', 'false');
      clearPaper();
      if (isDocumentPage(app()?.ui59?.getPage?.())) app().renderView('iso');
      root.NCYUI670?.setStage?.('review', { activateModel: false });
      doc.body.dataset.sc01OutputFlow = 'documents-blocked';
      renderStatus(status, true)?.focus({ preventScroll: true });
      app()?.ui59?.toast?.('ยังเปิดเอกสารไม่ได้ ดูรายการที่ต้องแก้ในผลคำนวณ');
    } finally { showing = false; }
  }
  function sync() {
    frame = 0;
    if (root.NCYSC01MemberWorkflow?.active) return; // Scoped workflow owns its document controls.
    const status = inspect();
    renderStatus(status);
    for (const button of doc.querySelectorAll(blockedSelectors)) {
      button.setAttribute('aria-disabled', String(!status.ready));
      if (!status.ready) button.setAttribute('data-sc01-document-locked', 'true');
      else button.removeAttribute('data-sc01-document-locked');
    }
    const mainButton = byId('sc01r12Report');
    if (mainButton) mainButton.setAttribute('aria-label', status.ready ? '4 เอกสาร ผลตรวจครบ' : '4 เอกสารถูกล็อก ต้องแก้ผลตรวจให้ผ่านก่อน');
    if (!status.ready) {
      clearPaper();
      if (isDocumentPage(app()?.ui59?.getPage?.())) showReasons(status);
    }
    doc.body.dataset.sc01DocumentsReady = String(status.ready);
  }
  function schedule() {
    if (!frame) frame = root.requestAnimationFrame(sync);
  }
  function guardBuilders() {
    const wrap = (owner, key, suppliedResult) => {
      if (typeof owner?.[key] !== 'function' || owner[key].__sc01DocumentGate) return;
      const original = owner[key];
      function guardedBuilder() {
        const result = suppliedResult ? suppliedResult.call(this, arguments) : app()?.getResult?.();
        requireDocument(result);
        return original.apply(this, arguments);
      }
      Object.assign(guardedBuilder, original, { __sc01DocumentGate: true });
      owner[key] = guardedBuilder;
    };
    for (const key of ['a4', 'a3', 'boqA4', 'plateLiveReport']) wrap(root.NCYReports, key, args => args[0]);
    for (const key of ['screen', 'sheets', 'exportDrawing']) wrap(root.NCYDetail, key, args => args[0]);
    wrap(root.NCYDraft?.Sheet?.prototype, 'svg', function () { return this.r; });
    wrap(root.NCYDXF, 'export', args => {
      const result = app()?.getResult?.(), drawing = args[0];
      if (!result || drawing?.state !== result.state
          || drawing.sheets?.some(sheet => sheet.r !== result)) {
        throw new Error('SC01_DOCUMENT_NOT_READY: แบบที่ส่งออกไม่ใช่ผลคำนวณปัจจุบัน');
      }
      return result;
    });
  }
  function install() {
    if (installed || !doc || !app()) return;
    installed = true;
    guardBuilders();
    // Window capture runs before the retained document-level output handlers.
    root.addEventListener('click', event => {
      if (root.NCYSC01MemberWorkflow?.active) { root.NCYSC01MemberWorkflow.handleShellEvent?.(event); return; }
      if (!event.target.closest?.(blockedSelectors)) { schedule(); return; }
      const status = inspect();
      if (status.ready) return;
      event.preventDefault(); event.stopImmediatePropagation(); showReasons(status); schedule();
    }, true);
    root.addEventListener('change', event => {
      if (root.NCYSC01MemberWorkflow?.active) return;
      if (event.target.id === 'g59ViewMore' && isDocumentPage(event.target.value) && !inspect().ready) {
        event.preventDefault(); event.stopImmediatePropagation(); event.target.value = ''; showReasons();
      }
      schedule();
    }, true);
    root.addEventListener('input', () => { clearPaper(); schedule(); }, true);
    root.addEventListener('ncy:v5-updated', schedule);
    root.addEventListener('sc01:materials-pending', schedule);
    root.addEventListener('sc01:workspace-ready', schedule);
    root.addEventListener('beforeprint', event => {
      if (root.NCYSC01MemberWorkflow?.active) {
        event.stopImmediatePropagation();
        root.NCYSC01MemberWorkflow.preparePrint();
        return;
      }
      if (inspect().ready) return;
      event.stopImmediatePropagation(); clearPaper();
      doc.body.classList.add('sc01-document-print-blocked');
      let notice = byId('sc01DocumentPrintNotice');
      if (!notice) {
        notice = create('p', 'ยังออกเอกสารไม่ได้: ผลตรวจยังไม่ผ่านหรือยังไม่ครบ กรุณาแก้ข้อมูลและคำนวณใหม่');
        notice.id = 'sc01DocumentPrintNotice'; notice.hidden = true; doc.body.appendChild(notice);
      }
    }, true);
    root.addEventListener('afterprint', () => doc.body.classList.remove('sc01-document-print-blocked'));
    schedule();
  }
  root.NCYSC01DocumentGate = Object.freeze({ VERSION:'r32', assess, inspect, allow, isDocumentPage, inventory, releaseKeys });
  if (doc) {
    install();
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', schedule, { once: true });
  }
})(typeof window === 'undefined' ? globalThis : window);
