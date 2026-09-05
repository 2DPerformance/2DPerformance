import { openWorkspaceStore, workspaceStorageMessage } from './shared/workspace-store.mjs';

// Each caller supplies an explicit input serializer and its existing restore /
// invalidation path. This controller never captures results, DOM output or PASS.
export function mountConcreteProjectControls({ card, host, capture, validate, apply, legacyKey, existingSaveButton, restoredMessage, captureReady = () => true, description, maxImportBytes = 16 * 1024 * 1024, storeFactory = openWorkspaceStore }) {
  if (!host) throw new Error('project_controls_host_missing');
  const doc = host.ownerDocument, win = doc.defaultView;
  const key = 'concrete-' + card + ':inputs';
  let revision = 0, initialized = false, busy = false, opened = false, automaticPending = false, automaticTimer;
  const serialize = () => JSON.stringify({ schema: 'sv.concrete.inputs.v1', card, input: capture() });
  const validateSize = value => { if (new TextEncoder().encode(value).byteLength > maxImportBytes) throw new Error('ข้อมูลเกินขนาดไฟล์ที่การ์ดนี้นำกลับได้ (' + Math.round(maxImportBytes / 1024 / 1024) + ' MiB)'); return value; };
  let acknowledged = serialize();
  const panel = doc.createElement('details'); panel.className = 'sv-concrete-project';
  const summary = doc.createElement('summary'); summary.textContent = 'Save / Open'; panel.append(summary);
  const body = doc.createElement('div'); body.className = 'sv-concrete-project-body'; panel.append(body);
  if (description) { const note = doc.createElement('p'); note.textContent = description; body.append(note); }
  const status = doc.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'ข้อมูลนำเข้าเท่านั้น ผลคำนวณต้องสร้างใหม่หลังเปิด'; body.append(status);
  const buttons = [];
  function action(text, fn) { const button = doc.createElement('button'); button.type = 'button'; button.textContent = text; button.addEventListener('click', fn); body.append(button); buttons.push(button); return button; }
  function message(text) { status.textContent = text; summary.textContent = /ยัง|ไม่ได้|ไม่พร้อม|เปลี่ยนระหว่าง/.test(text) ? 'Save / Open · ยังไม่บันทึก' : 'Save / Open'; }
  function setBusy(value) { busy = value; buttons.forEach(button => { button.disabled = value; }); if (existingSaveButton) existingSaveButton.disabled = value; }
  function decode(raw) {
    const data = JSON.parse(raw);
    const input = data?.schema === 'sv.concrete.inputs.v1' && data.card === card && Object.keys(data).length === 3 ? data.input : legacyKey && data?.schema === undefined ? data : null;
    if (!input || validate(input) !== true) throw new Error('รูปแบบข้อมูลไม่ตรงการ์ดนี้หรือไม่ครบ ไม่เปลี่ยนงานปัจจุบัน');
    return input;
  }
  let storePromise;
  const store = () => storePromise || (storePromise = storeFactory().catch(error => { storePromise = null; throw error; }));
  async function initialize() {
    if (initialized) return;
    const db = await store();
    const row = legacyKey ? await db.readOrMigrate(key, { storage: win.localStorage, legacyKey }) : await db.read(key);
    if (row.value !== null) decode(row.value); // Malformed existing data blocks overwrite.
    revision = row.revision; initialized = true;
  }
  async function save(options = {}) {
    const automatic = options.automatic === true;
    if (busy) { if (automatic) automaticPending = true; return false; }
    let value;
    try { if (!captureReady()) throw new Error('มีช่องข้อมูลที่ยังไม่สมบูรณ์'); value = validateSize(serialize()); }
    catch (error) { message('ยังบันทึกไม่ได้: ' + error.message + ' คงแท็บนี้ไว้'); return false; }
    if (validate(JSON.parse(value).input) !== true) { message('ยังบันทึกไม่ได้: ข้อมูลนำเข้าไม่ครบตามรูปแบบของการ์ด'); return false; }
    setBusy(true); message('กำลังบันทึกในเครื่อง…');
    try {
      await initialize();
      if (revision > 0 && !opened && (automatic || !win.confirm('มีร่างเดิมของการ์ดนี้อยู่ ต้องการแทนที่ด้วยข้อมูลบนหน้าจอนี้หรือไม่?'))) { message('ยังไม่แทนที่ร่างเดิม กดเปิดเพื่อดูร่างเดิม หรือกดบันทึกเพื่อยืนยันแทนที่'); return false; }
      const row = await (await store()).write(key, value, { expectedRevision: revision });
      revision = row.revision; opened = true; acknowledged = value;
      message(serialize() === value ? 'บันทึกข้อมูลนำเข้าในเครื่องแล้ว (IndexedDB)' : 'บันทึกชุดก่อนหน้าแล้ว ยังมีการแก้ไขใหม่ที่ไม่ได้บันทึก');
      return true;
    } catch (error) { message('ยังบันทึกไม่ได้: ' + workspaceStorageMessage(error) + ' คงแท็บนี้ไว้ แล้วลองบันทึกหรือดาวน์โหลด JSON'); return false; }
    finally { setBusy(false); if (automaticPending) { automaticPending = false; schedule(); } }
  }
  function schedule() { win.clearTimeout(automaticTimer); automaticTimer = win.setTimeout(() => { void save({ automatic:true }); }, 500); }
  async function open() {
    if (busy || (serialize() !== acknowledged && !win.confirm('เปิดร่างที่บันทึกไว้แทนข้อมูลบนหน้าจอ? ดาวน์โหลด JSON ก่อนหากต้องการเก็บงานปัจจุบัน'))) return false;
    const beforeRead = serialize();
    setBusy(true);
    try {
      await initialize(); const row = await (await store()).read(key);
      if (row.value === null) { message('ยังไม่มีร่างที่บันทึกไว้ในการ์ดนี้'); return false; }
      const input = decode(row.value);
      if (serialize() !== beforeRead) { message('ข้อมูลบนหน้าจอเปลี่ยนระหว่างเปิดร่าง จึงยังไม่แทนที่ กรุณากดเปิดใหม่'); return false; }
      await apply(input);
      revision = row.revision; opened = true; acknowledged = serialize();
      message(restoredMessage || 'เปิดข้อมูลนำเข้าแล้ว กรุณาคำนวณใหม่ก่อนใช้ผลหรือรายงาน'); return true;
    } catch (error) { message('เปิดร่างไม่ได้: ' + workspaceStorageMessage(error)); return false; }
    finally { setBusy(false); }
  }
  function download() {
    try {
      if (!captureReady()) throw new Error('มีข้อมูลที่ยังไม่สมบูรณ์');
      const value = validateSize(serialize());
      if (validate(JSON.parse(value).input) !== true) throw new Error('รูปแบบข้อมูลยังไม่รองรับ จึงไม่ส่งออกเป็นไฟล์ค่ากรอก');
      const url = win.URL.createObjectURL(new Blob([value], { type: 'application/json' }));
      const anchor = doc.createElement('a'); anchor.href = url; anchor.download = card + '.inputs.json'; doc.body.append(anchor); anchor.click(); anchor.remove();
      win.setTimeout(() => win.URL.revokeObjectURL(url), 1000);
      message('ส่งคำขอดาวน์โหลด JSON แล้ว ตรวจไฟล์ใน Downloads; ยังไม่ถือว่าบันทึกในเบราว์เซอร์'); return true;
    } catch (error) { message('ดาวน์โหลดไม่ได้: ' + error.message + ' กรุณาคงแท็บนี้ไว้'); return false; }
  }
  const picker = doc.createElement('input'); picker.type = 'file'; picker.accept = '.json,application/json'; picker.hidden = true; body.append(picker);
  picker.addEventListener('change', async () => {
    const file = picker.files?.[0]; picker.value = ''; if (!file || busy) return;
    setBusy(true);
    try {
      if (file.size > maxImportBytes) throw new Error('ไฟล์ใหญ่เกินขอบเขตนำเข้าของการ์ดนี้');
      const raw = await file.text(), input = decode(raw);
      if (serialize() !== acknowledged && !win.confirm('นำเข้าไฟล์แทนข้อมูลบนหน้าจอ?')) return;
      await apply(input); opened = true;
      message('นำเข้าข้อมูลแล้ว ยังไม่บันทึกในเครื่อง กรุณาคำนวณใหม่และกดบันทึก');
    } catch (error) { message('นำเข้าไม่ได้: ' + error.message); }
    finally { setBusy(false); }
  });
  if (!existingSaveButton) action('บันทึกร่างล่าสุด', save);
  else existingSaveButton.addEventListener('click', save);
  action('เปิดร่างล่าสุด', open); action('ดาวน์โหลด JSON', download); action('นำเข้า JSON', () => picker.click());
  host.append(panel);
  if (!doc.getElementById('sv-concrete-project-style')) {
    const style = doc.createElement('style'); style.id = 'sv-concrete-project-style';
    style.textContent = '.sv-concrete-project{position:relative;font:13px/1.5 Sarabun,system-ui,sans-serif}.sv-concrete-project>summary{cursor:pointer;min-height:44px;padding:10px;box-sizing:border-box}.sv-concrete-project-body{position:fixed;top:64px;right:12px;width:min(360px,calc(100vw - 24px));padding:12px;background:oklch(97.8% .009 250);color:oklch(26% .055 257);border:1px solid currentColor;border-radius:6px;z-index:2147483500;box-sizing:border-box}.sv-concrete-project-body button{min-height:44px;margin:4px;padding:6px 10px;font:inherit}.sv-concrete-project-body p{white-space:normal;margin:0 0 8px}@media print{.sv-concrete-project{display:none!important}}'; doc.head.append(style);
  }
  win.addEventListener('beforeunload', event => {
    let dirty = true; try { dirty = serialize() !== acknowledged; } catch (_) { /* Unreadable input/asset is not saved. */ }
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
  });
  return Object.freeze({ save, open, download, schedule, panel });
}
