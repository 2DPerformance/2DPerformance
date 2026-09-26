(function bm02ProjectInputs() {
  'use strict';
  const fields = ['ifc','ify','ifyv','ib','ih','icov','idia','istirDia','irebarMode','iposLayer1','iposLayer2','inegLayer1','inegLayer2','istirSpacing'];
  function capture() {
    return { version: 1, fields: Object.fromEntries(fields.map(id => [id, document.getElementById(id).value])), spanCount: activeSpanCount(), spans: structuredClone(SPANS), supports: SUPPORT_TYPES.slice(), points: structuredClone(POINTS), profile: DESIGN_PROFILE.id, unit: DISPLAY_FORCE_UNIT, report: { ...REPORT_PROJECT } };
  }
  function validate(input) {
    return input?.version === 1 && Object.keys(input).every(key => ['version','fields','spanCount','spans','supports','points','profile','unit','report'].includes(key))
      && fields.every(id => typeof input.fields?.[id] === 'string' && input.fields[id].length < 100) && Object.keys(input.fields).length === fields.length
      && Number.isInteger(input.spanCount) && input.spanCount >= 1 && input.spanCount <= 4
      && Array.isArray(input.spans) && input.spans.length === 4 && input.spans.every(span => Object.keys(span).length === 3 && ['L','DL','LL'].every(key => Number.isFinite(span[key])))
      && Array.isArray(input.supports) && input.supports.length >= 2 && input.supports.length <= 5 && input.supports.every(value => ['pin','roller','fix','free'].includes(value))
      && Array.isArray(input.points) && input.points.length <= 100 && input.points.every(point => Object.keys(point).length === 3 && ['span','a','P'].every(key => Number.isFinite(point[key])))
      && Object.hasOwn(DESIGN_PROFILES, input.profile) && ['kgf','kN'].includes(input.unit)
      && input.report && REPORT_PROJECT_FIELDS.every(key => typeof input.report[key] === 'string') && Object.keys(input.report).length === REPORT_PROJECT_FIELDS.length;
  }
  function apply(input) {
    if (!validate(input)) throw new Error('ข้อมูลคานต่อเนื่องไม่ครบ');
    markDraft();
    fields.forEach(id => { document.getElementById(id).value = input.fields[id]; });
    SPANS = structuredClone(input.spans); SUPPORT_TYPES = input.supports.slice(); POINTS = structuredClone(input.points);
    document.querySelector(`input[name="nspans"][value="${input.spanCount}"]`).checked = true;
    document.querySelectorAll('#segSpans label').forEach(label => label.classList.toggle('on', label.querySelector('input').checked));
    DESIGN_PROFILE = DESIGN_PROFILES[input.profile]; document.getElementById('iprofile').value = input.profile;
    DISPLAY_FORCE_UNIT = input.unit; document.getElementById('iunit').value = input.unit;
    REPORT_PROJECT = sanitizeReportProject(input.report); syncReportProjectInputs(); syncReportProjectChrome(REPORT_PROJECT);
    syncRebarChoiceUI(); buildSpanList(); buildSupportList(); buildPLList(); markDraft();
  }
  window.SVBM02ProjectInputs = Object.freeze({ capture, validate, apply });
  import('/concrete-project-store.mjs').then(({ mountConcreteProjectControls }) => {
    window.SVBM02ProjectStore = mountConcreteProjectControls({ card: 'bm02', host: document.querySelector('.app-actions'), capture, validate, apply });
  }).catch(() => { document.getElementById('reportProjectState').textContent = 'เปิดระบบ Save โครงการไม่ได้ กรุณาคงแท็บนี้ไว้'; });
})();
