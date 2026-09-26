import { mountConcreteProjectControls } from './concrete-project-store.mjs';

// Explicit fields from the retained F1 render input contract. No report/3D is
// serialized. The verified live renderer, not saved output, produces new results.
export function mountOnePileProjectInputs(win) {
  const doc = win.document;
  const fields = ['fc','fy','phib','phiv','b1','gsoil','pileType','pileSL','pileD','PD','PL','e_ecc','loadCombo','ldMode','a1','b1col','A','B','T','H','cov','dMain','nA','nB','nHoop','dTie','showPC'];
  const keys = (value, expected) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === expected.length && expected.every(key => Object.hasOwn(value,key));
  function capture() {
    return { version:1, fields:Object.fromEntries(fields.map(id => { const el = doc.getElementById(id); return [id, el.type === 'checkbox' ? el.checked : el.value]; })), pattern:doc.querySelector('input[name="pat"]:checked').value, hoopManual:doc.getElementById('nHoop').dataset.userset === '1' };
  }
  function validate(input) {
    return keys(input,['version','fields','pattern','hoopManual']) && input.version === 1 && ['A','C'].includes(input.pattern) && typeof input.hoopManual === 'boolean' && keys(input.fields,fields) && fields.every(id => {
      const el = doc.getElementById(id), value = input.fields[id];
      return el.type === 'checkbox' ? typeof value === 'boolean' : typeof value === 'string' && value.length < 4096 && (el.tagName !== 'SELECT' || [...el.options].some(option => option.value === value));
    });
  }
  const warning = doc.createElement('p'); warning.hidden = true; warning.setAttribute('role','alert');
  warning.textContent = 'ข้อมูลยังไม่ครบ: ซ่อนผลเดิมไว้ กรุณาแก้ข้อมูลก่อนใช้ผลคำนวณหรือรายงาน';
  doc.querySelector('.appbar').after(warning);
  const panels = [...doc.querySelectorAll('[id^="f1-engine-panel-"]')];
  warning.className = 'f1-input-save-hold';
  const style = doc.createElement('style');
  style.textContent = '[data-f1-input-hold="true"] [id^="f1-engine-panel-"],[data-f1-input-hold="true"] .ckpr-cover,[data-f1-input-hold="true"] .ckds-modal,[data-f1-input-hold="true"] .ckds-overlay,[data-f1-input-hold="true"] .ckcr-modal{display:none!important}@media print{body[data-f1-input-hold="true"]>*{display:none!important}body[data-f1-input-hold="true"]>.f1-input-save-hold{display:block!important}}'; doc.head.append(style);
  const signature = () => JSON.stringify(capture());
  const invalid = () => doc.getElementById('o_nodata').style.display !== 'none';
  let renderedInput = invalid() ? null : signature();
  function setHold(hold) {
    doc.body.dataset.f1InputHold = String(hold); warning.hidden = !hold;
    panels.forEach(panel => { panel.inert = hold; });
  }
  function guard() {
    // Reuse donor validation; a changed input is not fresh until donor render completes.
    let hold = true;
    try { hold = invalid() || renderedInput !== signature(); } catch (_) { /* Fail closed. */ }
    setHold(hold);
    return hold;
  }
  const originalRender = win.render;
  win.render = function (...args) {
    const previous = renderedInput;
    renderedInput = null; setHold(true);
    try {
      const result = originalRender.apply(this,args);
      if (!invalid()) renderedInput = signature();
      // A previously opened A4/drawing is an immutable old result, never refreshed by render.
      if (renderedInput !== previous) doc.querySelectorAll('.ckcr-modal,.ckds-modal,.ckds-overlay,.ckpr-cover').forEach(el => el.remove());
      return result;
    } finally { guard(); }
  };
  doc.addEventListener('click', event => {
    const target = event.target.closest?.('button.print,.ckds-calc,.ckds-open,[data-cr],[data-ds],[data-act],[data-exp],[data-setexp],.ckds-modal button,.ckds-modal a,a[download],[id^="f1-engine-panel-"] button,[id^="f1-engine-panel-"] a');
    if (!target || target.dataset.cr === 'close' || target.dataset.ds === 'close' || target.dataset.act === 'close') return;
    // Delayed donor PNG/DXF/SVG callbacks also pass through their final download click.
    if (target.hasAttribute('download') && !/\.(?:png|svg|dxf|pdf)$/i.test(target.download)) return;
    if (guard()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  const originalPrint = win.print;
  win.print = function (...args) { if (guard()) return false; return originalPrint.apply(this,args); };
  win.addEventListener('beforeprint', guard);
  if (win.CKDrawingSheet?.open) {
    const originalOpen = win.CKDrawingSheet.open;
    win.CKDrawingSheet.open = function (...args) { if (guard()) return false; return originalOpen.apply(this,args); };
  }
  if (typeof win.CK_ISO === 'function') {
    const originalIso = win.CK_ISO;
    win.CK_ISO = function (...args) { return guard() ? '' : originalIso.apply(this,args); };
  }
  new win.MutationObserver(guard).observe(doc.getElementById('o_nodata'), { attributes:true, childList:true });
  function apply(input) {
    if (!validate(input)) throw new Error('รูปแบบข้อมูล F1 ไม่ครบ');
    doc.body.dataset.f1InputHold = 'true'; panels.forEach(panel => { panel.inert = true; });
    fields.forEach(id => { const el = doc.getElementById(id); if (el.type === 'checkbox') el.checked = input.fields[id]; else el.value = input.fields[id]; });
    doc.querySelector('input[name="pat"][value="' + input.pattern + '"]').checked = true;
    doc.getElementById('nHoop').dataset.userset = input.hoopManual ? '1' : '';
    win.render(); guard();
  }
  win.SVOnePileProjectInputs = Object.freeze({ capture, validate, apply });
  win.SVOnePileProjectStore = mountConcreteProjectControls({ card:'one-pile', host:doc.querySelector('.appbar'), capture, validate, apply, restoredMessage:'เปิดข้อมูลนำเข้าแล้ว ระบบ F1 คำนวณใหม่ด้วยข้อมูลนี้; ข้อมูลไม่ครบจะซ่อนผลเดิม' });
  guard();
}
