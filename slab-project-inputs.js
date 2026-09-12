(function slabProjectInputs() {
  'use strict';
  const fieldsByType = {
    ground: ['mockB','mockL','mockT','mockFc','mockFy','mockF','mockLj','mockCov','mockLean','mockSand','mockMesh','mockScope','mockSteelType','mockBarDia','mockBarSpacing','svUnitSetGround'],
    oneway: ['owFc','owFy1','owFy2','owS','owL','owT','owCov','owSDL','owLL','owMainDia','owTempDia','svUnitSet','svCodeSet'],
    cantilever: ['caMode','caFc','caFy1','caFy2','caL','caB','caT','caRoot','caTip','caCov','caSDL','caLL','caFinw','caMainDia','caTempDia','svUnitSet','svCodeSet'],
    twoway: ['twFc','twFy','twS','twL','twT','twCov','twCase','twSDL','twLL','twDia','svUnitSet','svCodeSet'],
  };
  function capture() {
    const fields = Object.fromEntries(fieldsByType[selectedSlabType].map(id => { const el = byId(id); return [id, { value: el.value, engineValue: el.dataset.engineValue ?? null }]; }));
    return { version: 1, type: selectedSlabType, mode: designMode, fields, unit: svUnitChoice, code: svCodeChoice, support: selectedSlabType === 'oneway' ? document.querySelector('input[name="originalSupport"]:checked')?.value : null, project: { ...projectData } };
  }
  const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
  function validField(id, field, input) {
    if (!exactKeys(field,['value','engineValue']) || typeof field.value !== 'string' || field.value.length >= 100) return false;
    if (['svUnitSet','svUnitSetGround'].includes(id) && field.value !== input.unit) return false;
    if (id === 'svCodeSet' && field.value !== input.code) return false;
    const quantity = SV_UNIT_FIELDS[id];
    if (!quantity) return field.engineValue === null;
    if (field.engineValue === null) return true; // No hidden value: existing reader derives from displayed input.
    if (typeof field.engineValue !== 'string' || !field.engineValue.trim() || !field.value.trim()) return false;
    const shown = Number(field.value), engine = Number(field.engineValue);
    if (!Number.isFinite(shown) || !Number.isFinite(engine)) return false;
    const factor = SV_UNIT_SETS[input.unit][quantity].k;
    // Reuse the retained conversion helper for newly typed values. A toggled
    // field instead uses exactly the retained display renderer's toFixed(3).
    // Never trust a canonical value merely because it parses as a number.
    const typed = svCanonicalIn({ dataset:{} }, id, shown, factor);
    return engine === typed || shown === Number((engine / factor).toFixed(3));
  }
  function validate(input) {
    const ids = fieldsByType[input?.type];
    return input?.version === 1 && ids && exactKeys(input,['version','type','mode','fields','unit','code','support','project'])
      && ['auto','check'].includes(input.mode) && ['kgf','si'].includes(input.unit) && Object.hasOwn(SV_CODE, input.code)
      && exactKeys(input.fields,ids) && ids.every(id => validField(id,input.fields[id],input))
      && (input.type === 'oneway' ? ['0','1','2'].includes(input.support) : input.support === null)
      && exactKeys(input.project,PROJECT_FIELDS) && PROJECT_FIELDS.every(key => typeof input.project[key] === 'string');
  }
  function apply(input) {
    if (!validate(input)) throw new Error('ข้อมูลพื้นไม่ครบ');
    setFailure(['เปิดข้อมูลใหม่ ต้องคำนวณใหม่']);
    svUnitChoice = input.unit; svCodeChoice = input.code; projectData = { ...input.project }; projectUserSet = true;
    setSlabType(input.type); designMode = input.mode;
    fieldsByType[input.type].forEach(id => { const el = byId(id), data = input.fields[id]; el.value = data.value; if (data.engineValue === null) delete el.dataset.engineValue; else el.dataset.engineValue = data.engineValue; });
    if (input.type === 'oneway') { const radio = document.querySelector(`input[name="originalSupport"][value="${input.support}"]`); if (radio) radio.checked = true; }
    document.querySelectorAll('.choice').forEach(el => el.classList.toggle('active', el.dataset.mode === designMode));
    syncProjectInputs(); syncProjectDocumentIdentity();
    setFailure(['เปิดข้อมูลนำเข้าแล้ว กรุณาคำนวณใหม่']);
    requestOriginalPreview(input.type, { immediate: true });
  }
  window.SVSlabProjectInputs = Object.freeze({ capture, validate, apply });
  import('/concrete-project-store.mjs').then(({ mountConcreteProjectControls }) => {
    window.SVSlabProjectStore = mountConcreteProjectControls({ card: 'slab', host: document.querySelector('.app-actions'), capture, validate, apply });
  }).catch(() => { byId('reportProjectState').textContent = 'เปิดระบบ Save โครงการไม่ได้ กรุณาคงแท็บนี้ไว้'; });
})();
