(function corbelProjectInputs() {
  'use strict';
  // Editable source controls from the production stale-input contract. Derived
  // width/av, support detail, result snapshots and authority are excluded.
  const fields = ['memberId','quickLoad','quickUnit','quickNu','quickNuUnit','analysisBasis','analysisCombination','analysisReference','wallMaterial','wallUnitWeight','finishUnitWeight','otherPermanentLoad','deadLoadFactor','wallRun','layoutMethod','supportCount','maxSpacing','distributionConfirmed','fc','fy','surface','wallWidth','height','tipHeight','length','depth','wallThickness','wallHeight','noseSetback','cover'];
  function capture() {
    return { version: 1, mode: document.querySelector('[data-load-mode][aria-pressed="true"]')?.dataset.loadMode || 'wall', fields: Object.fromEntries(fields.map(id => { const el = document.getElementById(id); return [id, el.type === 'checkbox' ? el.checked : el.value]; })) };
  }
  function validate(input) {
    return input?.version === 1 && ['wall','direct'].includes(input.mode) && Object.keys(input).every(key => ['version','mode','fields'].includes(key))
      && input.fields && Object.keys(input.fields).length === fields.length && fields.every(id => {
        const el = document.getElementById(id), value = input.fields[id];
        return el.type === 'checkbox' ? typeof value === 'boolean' : typeof value === 'string' && value.length < 4096 && (el.tagName !== 'SELECT' || [...el.options].some(option => option.value === value));
      });
  }
  function apply(input) {
    if (!validate(input)) throw new Error('ข้อมูลหูช้างไม่ครบ');
    fields.forEach(id => { const el = document.getElementById(id); if (el.type === 'checkbox') el.checked = input.fields[id]; else el.value = input.fields[id]; });
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
