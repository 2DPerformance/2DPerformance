// Explicit application project/export contract. Donor formulas and state
// normalization are retained; source PDF bytes are not available in this tool.
(async function () {
  const { mountConcreteProjectControls } = await import('./concrete-project-store.mjs');
  const { createScaffoldInputValidator, decodeScaffoldLegacyFile } = await import('./scaffold-input-schema.mjs?v=20260909-additional-dl');
  for (let attempts = 0; !window.V24_READY || !window.SVScaffoldRetainedProject || (window.NCYFramePlanGeometry && !window.NCY_FRAME_PLAN_READY); attempts++) {
    if (attempts > 200) throw new Error('Scaffold input runtime unavailable');
    await new Promise(resolve => setTimeout(resolve,50));
  }
  const retained = window.SVScaffoldRetainedProject, defaults = retained.getDefaults();
  const validate = createScaffoldInputValidator({...defaults,...retained.getState()},Object.keys(defaults),
    value => value === null || Boolean(window.NCYFramePlanGeometry?.recoverFramePlanDraft(value)));
  const images = new WeakMap();
  function capture() {
    let imageData = null;
    const sourceImage = retained.getImage();
    if (sourceImage) {
      imageData = images.get(sourceImage);
      if (!imageData) { imageData = retained.imageData(); if (!imageData) throw new Error('อ่านภาพแปลนไม่สำเร็จ'); images.set(sourceImage,imageData); }
    }
    return { version:1, state:retained.getState(), plan:{ ...retained.getPlan(), imageData }, framePlan:window.NCYFramePlanner?.exportProject?.()||null };
  }
  async function apply(input) {
    if (!validate(input)) throw new Error('รูปแบบโครงการนั่งร้านไม่ครบ');
    const before = JSON.stringify(capture()), plan = input.plan || { scalePxM:0,localOriginImg:null,fileName:'',imageData:null };
    let nextImage = null;
    if (plan.imageData) {
      nextImage = new Image(); nextImage.src = plan.imageData;
      await nextImage.decode();
      if (JSON.stringify(capture()) !== before) throw new Error('มีการแก้ไขระหว่างอ่านภาพ จึงยังไม่แทนที่งาน');
      images.set(nextImage,plan.imageData);
    }
    // Same normalization/import steps as openProjectFileV2, with image decode
    // completed before replacing live inputs. No saved result is installed.
    window.SCAFFOLD_UI_BRIDGE?.cancelBackgroundLoad?.();
    retained.apply(input,nextImage);
    window.NCYFramePlanner?.restoreProject?.(input.state.physicalFramePlan||input.framePlan||null);
    window.NCYUnifiedPlan?.clearHistory?.();
    window.dispatchEvent(new Event('scaffold:backgroundchange'));
    window.dispatchEvent(new Event('scaffold:projectrestored'));
  }
  async function openLegacy(file) {
    if (!file || file.size > 64*1024*1024) throw new Error('ไฟล์ใหญ่เกินขอบเขตนำเข้าของการ์ดนี้');
    const before=JSON.stringify(capture()), input=decodeScaffoldLegacyFile(JSON.parse(await file.text()),validate);
    if (JSON.stringify(capture()) !== before) throw new Error('มีการแก้ไขระหว่างอ่านไฟล์ จึงยังไม่แทนที่งาน');
    if (!window.confirm('เปิดไฟล์แทนข้อมูลนั่งร้านบนหน้าจอ? ดาวน์โหลด JSON ก่อนหากต้องการเก็บงานปัจจุบัน')) return false;
    await apply(input);
    window.SVScaffoldProjectStore?.schedule();
    return true;
  }
  window.SVScaffoldProjectInputs = Object.freeze({ capture, validate, apply, openLegacy });
  window.SVScaffoldProjectStore = mountConcreteProjectControls({ card:'scaffold', host:document.querySelector('header .header-actions') || document.querySelector('header'), capture, validate, apply, legacyKey:'scaffold-pro-v2-autosave', maxImportBytes:64*1024*1024, description:'เก็บข้อมูลตั้งต้นและภาพแปลนที่แสดง (ไม่ใช่ต้นฉบับ PDF); เปิดด้วย Engine เดิมในสถานะ HOLD', restoredMessage:'เปิดข้อมูลและภาพแปลนแล้ว คำนวณใหม่ด้วย Engine เดิม · ยังคง ENGINEERING HOLD' });
  // SH-01's wrapped header is taller than the shared control's 64px default.
  // Anchor the popover below its own summary, keeping that close target usable.
  const panel = window.SVScaffoldProjectStore.panel, summary = panel.querySelector('summary');
  function placePanel() {
    if (!panel.open) return;
    const body = panel.querySelector('.sv-concrete-project-body');
    const top = Math.max(8, summary.getBoundingClientRect().bottom + 6);
    body.style.top = `${top}px`;
    body.style.maxHeight = `${Math.max(100, window.innerHeight - top - 12)}px`;
    body.style.overflowY = 'auto';
  }
  panel.addEventListener('toggle', placePanel);
  window.addEventListener('resize', placePanel);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { panel.open = false; summary.focus(); } });
  window.SVScaffoldProjectStore.schedule();
})().catch(error => {
  const alert = document.createElement('p'); alert.setAttribute('role','alert'); alert.textContent = 'ระบบบันทึกร่างนั่งร้านยังไม่พร้อม: ' + error.message + ' คงแท็บนี้ไว้และใช้บันทึกไฟล์ .scaffold.json สำรอง'; document.body.prepend(alert);
});
