/* SC01 R23: read-only numerical presentation, never an engineering verdict. */
(function (root) {
  'use strict';
  const evidence = new Set(('existing productGate rebarScan designBasis codeCoverage legalCompliance designProfiles profileVerification fabricationDraft projectRelease productSnapshot trussCutList').split(' '));
  const support = new Set(['rcSupport', 'rcSupportSystem']);
  const diagnostics = new Set(['solver', 'scope', 'physicalGeometry', 'numericIntegrity']);
  const layoutErrors = new Set(['LAYOUT_TRIBUTARY_MISMATCH', 'PLATE_LAYOUT_OVERLAP', 'RC_SUPPORT_POSITION_BASIS_MISMATCH', 'SYSTEM_CONNECTION_TYPE_MISMATCH', 'LAYOUT_UNAVAILABLE']);
  const finite = Number.isFinite;
  const formatValue = value => finite(value) ? String(Number(value.toFixed(3))) : 'ไม่มีค่า';
  function criterion(row) {
    if (finite(row.min) && finite(row.max)) return `${formatValue(row.min)} ถึง ${formatValue(row.max)} ${row.unit || ''}`;
    if (finite(row.min)) return `ไม่น้อยกว่า ${formatValue(row.min)} ${row.unit || ''}`;
    if (finite(row.max)) return `ไม่เกิน ${formatValue(row.max)} ${row.unit || ''}`;
    return 'ยังไม่มีขอบเขตตัวเลข';
  }
  function category(key, check) {
    if (!check || typeof check !== 'object') return 'unknown';
    if (check.state === 'na') return finite(check.ratio) && check.ratio > 1 ? 'unknown' : 'excluded';
    if (evidence.has(key)) return 'technical';
    if (finite(check.ratio) && check.ratio > 1) return 'failed';
    if (check.sizeEligible === false || check.state === 'fail' || check.engineState === 'fail') return 'failed';
    if (support.has(key) && !finite(check.ratio)) return 'technical';
    if (key === 'trussOutOfPlane' && check.state === 'ok' && !finite(check.ratio)) return 'technical';
    if (check.state === 'outside' || check.engineState === 'outside') return 'unknown';
    if (diagnostics.has(key) && check.state === 'ok' && finite(check.ratio) && check.ratio >= 0) return 'technical';
    if (!finite(check.ratio) || check.ratio < 0 || ['incomplete', 'hold'].includes(check.state)
        || !['ok', 'review', 'warn'].includes(check.state)) return 'unknown';
    return 'within';
  }
  function project(result, layout) {
    const groups = { failed: [], unknown: [], within: [], technical: [], excluded: [] };
    for (const [key, check] of Object.entries(result?.checks || {})) {
      const kind = category(key, check);
      groups[kind].push({ ...check, key, kind });
    }
    for (const warning of layout?.warnings || []) {
      const kind = layoutErrors.has(warning.code) ? 'unknown' : 'technical';
      groups[kind].push({ key: 'layout:' + warning.code, label: warning.message || warning.code,
        note: warning.message, state: 'hold', kind });
    }
    const numeric = [...groups.failed, ...groups.within].filter(c => finite(c.ratio) && c.ratio >= 0);
    return { ...groups, actions: [...groups.failed, ...groups.unknown],
      maximum: numeric.length ? Math.max(...numeric.map(c => c.ratio)) : null,
      caseCount: result?.cases?.length || 0, constructionAuthorized: false };
  }
  function label(row) {
    const kind = row.kind || category(row.key, row);
    if (kind === 'failed') return finite(row.ratio) && row.ratio > 1 ? 'D/C เกิน 1' : 'ขนาด / เงื่อนไขไม่เข้าเกณฑ์';
    return { within: 'D/C อยู่ในเกณฑ์', unknown: 'ยังสรุป D/C ไม่ได้', technical: 'ข้อมูลประกอบ', excluded: 'ไม่ใช้กับระบบนี้' }[kind];
  }
  function summary(result) {
    const view = project(result);
    return { code: view.failed.length ? 'fail' : 'review',
      title: view.failed.length ? `ต้องแก้ ${view.failed.length} รายการ` : view.unknown.length ? 'ยังคำนวณได้ไม่ครบ' : 'ไม่พบข้อเกินเกณฑ์ตัวเลข',
      sub: `ผลเปรียบเทียบตามสมการ ${view.caseCount} กรณีแรง เพื่อทบทวน ไม่ใช่อนุมัติก่อสร้าง` };
  }
  const api = { VERSION: 'r23', project, category, label, summary, criterion, formatValue, queue: (result, layout) => project(result, layout).actions };
  root.NCYSC01ResultsReview = api;
  const doc = root.document;
  if (!doc) return;
  const byId = id => doc.getElementById(id), app = () => root.NCYApp;
  const esc = value => String(value ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = value => finite(value) ? value.toFixed(3) : 'ไม่มีค่า';
  const button = (key, text, fix = false) => `<button type="button" class="button ${fix ? 'primary' : 'secondary'}" data-${fix ? 'fix' : 'check'}="${esc(key)}">${esc(text)}</button>`;
  function failureHTML(row, result) {
    const proof = root.NCYSC01AssistantCore?.numericEvidence?.(row.key, result);
    const limits = proof?.rows?.filter(r => r.within === false) || [];
    const detail = limits.length ? limits.map(r => `<p><b>${esc(r.label)} ${esc(formatValue(r.value))} ${esc(r.unit)}</b><br>เกณฑ์ ${esc(criterion(r))}</p>`).join('')
      : `<p>${esc(row.note?.split('รอตรวจ')[0] || 'เปิดรายละเอียดเพื่อดูแรง กำลัง และเกณฑ์ที่ใช้')}</p>`;
    return `<article class="sc01-result-failure" data-result-key="${esc(row.key)}"><header><h3>${esc(row.label || row.key)}</h3><span>✕ ${esc(label(row))}</span></header><div class="sc01-result-value">D/C <b>${number(row.ratio)}</b><small>${esc(row.governingCase || 'ตรวจเงื่อนไขร่วม')}</small></div>${detail}<div class="sc01-result-actions">${button(row.key, 'ดูค่าที่แนะนำ / วิธีแก้', true)}${button(row.key, 'สมการและผล')}</div></article>`;
  }
  function quietRows(rows) {
    return rows.map(row => `<li><button type="button" data-check="${esc(row.key)}"><span>${esc(row.label || row.key)}</span><b>${number(row.ratio)}</b><small>${esc(row.governingCase || '')}</small></button></li>`).join('');
  }
  function syncCounts(view = project(app()?.getResult())) {
    const components = root.NCYSC01EngineerUI?.components(app()?.getResult());
    const values = { fail: components ? components.groups.filter(g=>g.failed.length).length : view.failed.length,
      incomplete: components ? components.groups.filter(g=>g.unknown.length).length : view.unknown.length, warn: 0 };
    for (const [key, value] of Object.entries(values)) {
      const target = doc.querySelector(`[data-ncy670-count="${key}"]`), pill = target?.closest('.ncy670-count');
      if (!target || !pill) continue;
      const caption = components ? (key === 'fail' ? 'หมวดไม่ผ่าน' : 'หมวดข้อมูลไม่ครบ') : key === 'fail' ? 'ต้องแก้' : 'ยังไม่มีผลครบ';
      const text = String(value);
      if (target.textContent !== text) target.textContent = text;
      // Keep the native badge target and keyboard listener, only project its text.
      if (target.nextSibling?.nodeType === 3 && target.nextSibling.textContent !== ' ' + caption) target.nextSibling.textContent = ' ' + caption;
      pill.hidden = value === 0;
      pill.setAttribute('aria-label', `${value} ${caption}`);
    }
  }
  api.syncCounts = syncCounts;
  let frame = 0, lastResult = null;
  function sync() {
    frame = 0;
    const result = app()?.getResult(), host = byId('checks');
    if (!host || !result) return;
    const view = project(result);
    syncCounts(view);
    if (root.NCYSC01EngineerUI?.renderResults?.(result,host)) return;
    if (lastResult === result && byId('sc01NumericResults')) return;
    const expanded = new Set(Array.from(host.querySelectorAll('details[open]'), el => el.dataset.resultGroup));
    lastResult = result;
    const actionable = view.failed.length + view.unknown.length;
    const title = view.failed.length ? `ต้องแก้ ${view.failed.length} รายการ`
      : view.unknown.length ? 'ยังคำนวณได้ไม่ครบ' : 'ไม่พบข้อเกินเกณฑ์ตัวเลข';
    byId('overallCard').innerHTML = `<section class="sc01-result-overview" data-has-failure="${!!view.failed.length}"><h3>${title}</h3><p>${view.caseCount} กรณีแรง · อยู่ในเกณฑ์ ${view.within.length} รายการ${view.unknown.length ? ' · ยังไม่มีผลครบ ' + view.unknown.length + ' รายการ' : ''}</p><div>D/C สูงสุดที่คำนวณได้ <b>${number(view.maximum)}</b></div><small>ผลเปรียบเทียบตามสมการ ไม่ใช่การอนุมัติก่อสร้าง</small></section>`;
    const undo = byId('advisorEntry')?.querySelector('[data-advice-undo]');
    byId('advisorEntry').replaceChildren();
    if (undo) byId('advisorEntry').appendChild(undo);
    const metrics = byId('forceMetrics');
    if (metrics && !byId('sc01ResultForces')) {
      const details = doc.createElement('details'); details.id = 'sc01ResultForces';
      details.className = 'sc01-result-disclosure';
      const summary = doc.createElement('summary'); summary.textContent = 'แรงและโมเมนต์ของกรณีบนแบบ';
      details.append(summary, metrics); host.insertAdjacentElement('afterend', details);
    }
    byId('legalStatusCard').hidden = true;
    const gates = byId('gates');
    if (gates) { gates.hidden = true; if (gates.previousElementSibling?.classList.contains('section-label')) gates.previousElementSibling.hidden = true; }
    const count = byId('checkCount');
    if (count) { count.textContent = `${view.failed.length + view.unknown.length + view.within.length} รายการ`; count.parentElement.firstChild.textContent = 'ผลตามสมการ '; }
    const unknown = view.unknown.length ? `<details class="sc01-result-disclosure sc01-result-unknown" data-result-group="unknown" ${expanded.has('unknown') ? 'open' : ''}><summary>ยังไม่มีผล D/C ครบ ${view.unknown.length} รายการ</summary><p>ขาดค่าที่ใช้คำนวณหรืออยู่นอกขอบเขต ไม่ได้นับเป็นผ่าน</p>${view.unknown.map(row => `<article><h4>${esc(row.label || row.key)}</h4><p>${esc(row.note || 'ตรวจข้อมูลต้นทางของรายการนี้')}</p>${button(row.key, 'ไปดูค่าที่ขาด', true)}</article>`).join('')}</details>` : '';
    const quiet = view.within.length ? `<details class="sc01-result-disclosure" data-result-group="within" ${expanded.has('within') ? 'open' : ''}><summary>ดู D/C ที่อยู่ในเกณฑ์ ${view.within.length} รายการ</summary><ul class="sc01-result-table">${quietRows(view.within)}</ul></details>` : '';
    const technical = `<details class="sc01-result-disclosure" data-result-group="technical" ${expanded.has('technical') ? 'open' : ''}><summary>ขอบเขตและข้อมูลประกอบ</summary><p>ใช้ผลเพื่อทบทวนการคำนวณ ยังไม่ใช่แบบอนุมัติก่อสร้าง ข้อมูลผลิตภัณฑ์ สภาพโครงสร้างเดิม และการตรวจรับวิธียังคงแยกจาก D/C</p><ul class="sc01-result-reference">${view.technical.filter(row => !row.key.startsWith('layout:')).map(row => `<li>${button(row.key, row.label || row.key)}</li>`).join('')}</ul><button type="button" data-review57="registry">ดูขอบเขตวิธีคำนวณ</button><p>ไม่แสดง ${view.excluded.length} รายการที่ไม่ใช้กับระบบนี้ และไม่นับเป็นผ่าน</p></details>`;
    const loadPath = root.NCYSC01LoadPath;
    const replacementAdvice = loadPath ? view.failed.map(row => `<p class="sc01-result-material-advice"><b>${esc(row.label)}</b><br>${esc(loadPath.advice(row,result))}</p>`).join('') : '';
    host.innerHTML = `<div id="sc01NumericResults">${view.failed.map(row => failureHTML(row, result)).join('')}${replacementAdvice}${!actionable ? '<p class="sc01-result-clear">✓ ค่าที่คำนวณได้อยู่ในเกณฑ์ ไม่มีรายการที่ต้องแนะนำให้แก้</p>' : ''}${loadPath?.summaryHTML(result)||''}${unknown}${quiet}${technical}</div>`;
    doc.body.dataset.sc01ResultsReview = 'r23';
  }
  function schedule() { if (!frame) frame = root.requestAnimationFrame(sync); }
  api.sync = sync;
  root.addEventListener('ncy:v5-updated', schedule);
  root.addEventListener('sc01:workspace-ready', schedule);
  doc.addEventListener('click', schedule);
  doc.addEventListener('change', schedule);
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', schedule, { once: true });
  schedule();
})(typeof window === 'undefined' ? globalThis : window);
