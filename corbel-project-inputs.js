(function corbelProjectInputs() {
  'use strict';
  // Editable source controls from the production stale-input contract. Derived
  // width/av, support detail, result snapshots and authority are excluded.
  const fields = ['memberId','quickLoad','quickUnit','quickNu','quickNuUnit','analysisBasis','analysisCombination','analysisReference','wallMaterial','wallUnitWeight','finishUnitWeight','otherPermanentLoad','deadLoadFactor','wallRun','layoutMethod','supportCount','maxSpacing','distributionConfirmed','fc','fy','surface','wallWidth','height','tipHeight','length','depth','wallThickness','wallHeight','noseSetback','cover'];
  const legacyDetailFields = ['detailSupportWidth','detailSupportDepth','detailEmbed','detailMainBend','detailSupportTail','detailNoseTail','detailTieBend'];
  const detailFields = [...legacyDetailFields,'detailTieEmbed'];
  const v3Fields = [...fields, ...detailFields];
  const v4Fields = [...v3Fields, 'detailRebarPattern'];
  const verticalFields = [...window.CorbelRebarDetail.VERTICAL_FIELDS];
  const allFields = [...v4Fields, ...verticalFields];
  function capture() {
    return { version: 5, mode: document.querySelector('[data-load-mode][aria-pressed="true"]')?.dataset.loadMode || 'wall', fields: Object.fromEntries(allFields.map(id => { const el = document.getElementById(id); return [id, el.type === 'checkbox' ? el.checked : el.value]; })) };
  }
  function validate(input) {
    const expectedFields = input?.version === 1 ? fields : input?.version === 2 ? [...fields,...legacyDetailFields] : input?.version === 3 ? v3Fields : input?.version === 4 ? v4Fields : allFields;
    return [1,2,3,4,5].includes(input?.version) && ['wall','direct'].includes(input.mode) && Object.keys(input).every(key => ['version','mode','fields'].includes(key))
      && input.fields && Object.keys(input.fields).length === expectedFields.length && expectedFields.every(id => {
        const el = document.getElementById(id), value = input.fields[id];
        return id === 'detailRebarPattern' ? ['legacy-90','reference-return'].includes(value) : el.type === 'checkbox' ? typeof value === 'boolean' : typeof value === 'string' && value.length < 4096 && (el.tagName !== 'SELECT' || [...el.options].some(option => option.value === value));
      });
  }
  function apply(input) {
    if (!validate(input)) throw new Error('ข้อมูลหูช้างไม่ครบ');
    allFields.forEach(id => { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = input.fields[id] ?? false; else el.value = input.fields[id] ?? (id === 'detailRebarPattern' ? 'legacy-90' : ''); });
    window.syncCorbelPatternLabels?.();
    document.querySelector(`[data-load-mode="${input.mode}"]`).click();
    document.getElementById('memberId').dispatchEvent(new Event('input', { bubbles: true }));
    window.dispatchEvent(new Event('corbel-load-change'));
    window.setCorbelWorkbenchStep?.(1); window.setCorbelWorkView?.('3d');
  }
  window.SVCorbelProjectInputs = Object.freeze({ capture, validate, apply });
  import('/concrete-project-store.mjs').then(({ mountConcreteProjectControls }) => {
    window.SVCorbelProjectStore = mountConcreteProjectControls({ card: 'corbel', host: document.querySelector('.topbar'), capture, validate, apply });
  }).catch(() => { window.alert('เปิดระบบ Save หูช้างไม่ได้ กรุณาคงแท็บนี้ไว้'); });
})();
