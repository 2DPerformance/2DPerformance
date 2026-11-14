(() => {
  const root = document.getElementById('site-report-mobile');
  const screen = root.querySelector('.sr-screen');
  const toast = root.querySelector('.sr-toast');
  // Read the local calendar date at the moment an action happens. Keeping one
  // value from boot would create yesterday's report when this tab stays open
  // across midnight.
  const currentLocalDate = () => {
    const value = new Date();
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const catalog = globalThis.SiteReportCatalog?.tasks;
  const groups = globalThis.SiteReportCatalog?.groups;
  if (!Array.isArray(catalog) || !Array.isArray(groups)) {
    root.querySelector('.sr-save-status').textContent = 'โหลดรายการงานไม่ครบ กรุณาเปิดหน้าใหม่ ข้อมูลเดิมยังไม่ถูกแก้ไข';
    return;
  }
  const catalogIds = new Set(catalog.map(task => task.id));
  const state = {
    page: 'setup', entered: false,
    project: '', site: '', fullReport: null,
    date: currentLocalDate(), reporter: '', weather: '', workers: '', workerError: '', resources: '', tomorrow: '',
    tasks: {}, issues: '', issueTask: '', issueType: '', urgency: '', owner: '', due: '', issueNote: '',
    extraOpen: false, copied: false, copyFallback: false, error: '', nextPhoto: 1,
    viewing: null, photoReturn: 'entry', imports: {}, removedPhoto: null, removedMaterial: null, pendingMaterialRemoval: null,
    recipient: '', exportFormat: 'png', exportPage: 0, exportBusy: false, exportProgress: '', exportError: '', prepared: null, dataVersion: 0
  };
  const payloadKeys = ['project', 'site', 'date', 'reporter', 'weather', 'workers', 'resources', 'tomorrow', 'tasks', 'issues', 'issueTask', 'issueType', 'urgency', 'owner', 'due', 'issueNote', 'recipient', 'nextPhoto', 'fullReport'];
  const emptyPayload = structuredClone(Object.fromEntries(payloadKeys.map(key => [key, state[key]])));
  const local = { booting: true, draft: null, pendingSeriesId: '', dirty: false, saving: false, savePromise: null, change: 0, timer: null, error: '', code: '', viewed: null, drafts: [], revisions: [], projectMode: 'create', historySeriesId: '', busy: false, offlineReady: false, offlineMessage: 'กำลังเตรียมใช้งานออฟไลน์' };
  const bridge = { pending: false, approved: false, requestId: '', error: '' };
  const shell = { waiting: false, version: '' };
  const Store = globalThis.SiteReportStore;
  const Full = globalThis.SiteReportFullReport;
  const FullUI = globalThis.SiteReportFullReportUI;
  const PhotoInput = globalThis.SiteReportPhotoInput;
  const Backup = globalThis.SiteReportBackupStatus;
  const photoAccept = PhotoInput?.accept || 'image/jpeg,image/png,image/webp';
  const photoHelp = () => `<details class="sr-photo-help"><summary>ชนิดไฟล์ ขนาด และรูปจาก iPhone</summary><p>JPG / PNG / WebP และ HEIC เมื่อเบราว์เซอร์รองรับ · ไม่เกิน 10 MB ต่อรูป · ภาพใหญ่ย่อสำหรับรายงานไม่เกิน 1920 px โดยไม่ครอป กรุณาเก็บต้นฉบับในโทรศัพท์ไว้</p><p>${esc(PhotoInput?.help || 'กรุณาใช้รูป JPG / PNG / WebP ไม่เกิน 10 MB ต่อรูป')}</p></details>`;
  const backupState = { ...(Backup?.read() || { receipt: null, error: 'เปิดสถานะสำรองไม่ได้ รายงานยังบันทึกได้ตามปกติ' }), candidate: null, manifest: null, changed: false, generation: 0 };
  const fullData = () => state.fullReport || Full.defaults();
  const fullOpen = new Set();
  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('naichangyai-site-report-local-events-v1') : null;
  const design = { theme: 'auto', touchSize: 50, detailMode: 'simple' };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const icon = (name, cls = '') => `<i data-lucide="${name}" class="sr-icon ${cls}" aria-hidden="true"></i>`;
  const options = (list, current, prompt = 'เลือก') => `<option value="">${prompt}</option>${list.map(item => { const [value, label] = Array.isArray(item) ? item : [item, item]; return `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`; }).join('')}`;
  const taskDefs = () => catalog.filter(task => state.tasks[task.id]?.selected);
  const unsupportedTasks = () => Object.keys(state.tasks).filter(id => !catalogIds.has(id));
  const totalPhotos = () => taskDefs().reduce((sum, def) => sum + state.tasks[def.id].photos.length, 0);
  const zoneLabel = task => task.zone === 'other' ? task.customZone.trim() : task.zone;
  const statusLabel = value => ({ doing: 'กำลังทำ', done: 'เสร็จตามรายงาน', blocked: 'ติดขัด' }[value] || 'ยังไม่ระบุสถานะ');
  const urgencyLabel = () => ({ normal: 'ตามแผนงาน', today: 'ต้องการคำตอบวันนี้', urgent: 'เร่งด่วน / งานหยุดรอ' }[state.urgency] || 'ยังไม่ระบุความเร่งด่วน');
  const prettyDate = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ยังไม่ระบุ';
  const issueTaskLabel = () => state.issueTask === 'all' ? 'ภาพรวมโครงการ' : catalog.find(task => task.id === state.issueTask && state.tasks[task.id]?.selected)?.title || 'ยังไม่ระบุงาน';
  const mark = message => { toast.textContent = message; };
  const activePhoto = () => state.viewing && state.tasks[state.viewing.task]?.photos.find(photo => photo.id === state.viewing.id);
  const activeStep = () => state.page === 'photo' ? state.photoReturn : ['line', 'export', 'history'].includes(state.page) ? 'report' : state.page;
  const anyImport = () => Object.values(state.imports).some(Boolean);
  const currentPayload = () => structuredClone(Object.fromEntries(payloadKeys.filter(key => key !== 'fullReport' || state.fullReport !== null).map(key => [key, state[key]])));
  const dateTime = value => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : 'ยังไม่บันทึก';
  const reportDateTime = value => value ? new Date(value).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'medium' }) : 'ยังไม่บันทึก';
  const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  const reportTimeWithZone = value => `${reportDateTime(value)} (เวลาตามอุปกรณ์${deviceTimeZone ? ` · ${deviceTimeZone}` : ''})`;
  function backupStatus() {
    const receipt = backupState.receipt;
    const summary = receipt ? `ไฟล์สำรองล่าสุดที่ยืนยัน: ${dateTime(receipt.exportedAt)}` : 'ไฟล์สำรอง: ยังไม่มีประวัติยืนยัน';
    const reason = [backupState.error, Backup?.reason(receipt, backupState.manifest, local.dirty || local.saving || backupState.changed)].filter(Boolean).join(' · ') || 'เปิดสถานะสำรองไม่ได้';
    root.querySelector('[data-backup-summary]').textContent = summary;
    root.querySelector('[data-backup-reason]').textContent = reason;
    root.querySelector('[data-backup-status]').hidden = local.booting;
    root.querySelector('[data-backup-status] [data-action="backup-now"]').disabled = local.booting || local.busy || anyImport() || state.exportBusy;
    const candidate = backupState.candidate;
    const pending = root.querySelector('[data-backup-pending]');
    const markup = candidate ? `<p>เตรียมไฟล์ <strong>${esc(candidate.filename)}</strong> แล้ว ยังไม่ยืนยันว่าเก็บสำเร็จ</p><p>ตรวจไฟล์ในดาวน์โหลดก่อนกดยืนยัน การกดปุ่มดาวน์โหลดอย่างเดียวไม่ยืนยันว่าไฟล์อยู่ในเครื่อง</p><div><button type="button" class="sr-button" data-action="confirm-backup">ตรวจพบไฟล์นี้ในเครื่องแล้ว</button><button type="button" class="sr-button sr-quiet" data-action="cancel-backup">ยังไม่ยืนยัน</button></div>` : '';
    if (pending.innerHTML !== markup) pending.innerHTML = markup;
    pending.hidden = !candidate;
    pending.querySelectorAll('button').forEach(button => { button.disabled = local.booting || local.busy; });
    const detail = screen.querySelector('[data-backup-detail]');
    if (detail) detail.textContent = receipt ? `${summary} · ผู้ใช้ยืนยันเมื่อ ${dateTime(receipt.confirmedAt)} · ${receipt.filename} · ${reason}` : reason;
  }
  function backupChanged(broadcast = false) {
    backupState.generation++; backupState.manifest = null; backupState.changed = true;
    if (broadcast) channel?.postMessage({ type: 'records-changed' });
  }
  async function refreshBackupStatus() {
    if (!Backup || local.booting) return;
    const generation = ++backupState.generation;
    try {
      const [drafts, revisions] = await Promise.all([Store.listDrafts(), Store.listRevisions()]);
      if (generation !== backupState.generation) return;
      backupState.manifest = Backup.manifest({ drafts, revisions }); backupState.changed = false;
    } catch { if (generation === backupState.generation) backupState.manifest = null; }
    if (generation === backupState.generation) backupStatus();
  }
  function localStatus() {
    const node = root.querySelector('.sr-save-status');
    node.classList.toggle('is-error', Boolean(local.error || bridge.error));
    const status = bridge.approved ? 'บันทึกแล้ว กำลังกลับไปยังเว็บไซต์' : bridge.pending ? 'กำลังตรวจและบันทึกก่อนออก อย่าปิดหน้านี้' : local.booting ? 'กำลังเปิดข้อมูลในเครื่อง…' : local.error || bridge.error ? local.error || bridge.error : local.viewed ? `กำลังดูฉบับยืนยัน ${local.viewed.docId} (อ่านอย่างเดียว)` : anyImport() ? 'กำลังอ่านรูป อย่าเพิ่งปิดหน้านี้' : local.saving ? 'กำลังบันทึกในเครื่อง…' : local.dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : local.draft ? `บันทึกในเครื่องแล้ว ${dateTime(local.draft.updatedAt)}` : state.page === 'setup' && local.projectMode === 'list' ? `พร้อมใช้งาน ${projectFolders().length} แฟ้มโครงการ` : 'ยังไม่มีร่าง เริ่มกรอกได้เลย';
    node.textContent = `${status} · ${navigator.onLine ? '' : 'ไม่มีการเชื่อมต่อเครือข่าย · '}${local.offlineReady ? 'เปิดออฟไลน์ได้เฉพาะเครื่องมือนี้' : local.offlineMessage} · ยังไม่ซิงก์คลาวด์`;
    const actions = root.querySelector('.sr-storage-actions');
    const actionMarkup = local.error || bridge.error ? `<button type="button" class="sr-link-button" data-action="${local.code === 'CONFLICT' ? 'save-copy' : 'retry-save'}">${local.code === 'CONFLICT' ? 'เก็บการแก้ไขนี้เป็นร่างแยก' : 'ลองบันทึกอีกครั้ง'}</button><button type="button" class="sr-link-button" data-action="rescue-draft">สำรองการแก้ไขที่ยังไม่บันทึก</button>` : '';
    if (actions.innerHTML !== actionMarkup) actions.innerHTML = actionMarkup;
    root.querySelector('[data-action="save-now"]').disabled = local.booting || local.busy || Boolean(local.viewed) || local.saving;
    root.querySelector('.sr-pilot-tools [data-action="history"]').disabled = local.booting || local.busy;
    const update = root.querySelector('[data-shell-update]');
    if (update) {
      update.hidden = !shell.waiting;
      update.textContent = shell.waiting ? `มีเวอร์ชันใหม่พร้อมใช้ แต่แท็บนี้ยังใช้รุ่นเดิม (ตัวจัดหน้า v${globalThis.SiteReportDocuments?.version || 'ไม่ทราบรุ่น'}) บันทึกให้สำเร็จในทุกแท็บ แล้วกดกลับไปเครื่องมือทั้งหมดในทุกแท็บ Daily Report และปิดหน้าเครื่องมือที่เปิดแยก ก่อนเข้าใหม่และจัดหน้าอีกครั้ง ไม่ต้องล้างข้อมูลเว็บ` : '';
    }
    backupStatus();
  }
  function scheduleSave() {
    if (local.booting || local.viewed || bridge.pending || bridge.approved) return;
    bridge.error = '';
    local.change++; local.dirty = true;
    backupChanged();
    clearTimeout(local.timer);
    if (local.code !== 'CONFLICT') local.timer = setTimeout(() => { void flushSave(); }, 500);
    localStatus();
  }
  async function flushSave() {
    clearTimeout(local.timer);
    if (local.booting || local.viewed) return !local.booting;
    if (local.saving) { await local.savePromise; return local.error ? false : local.dirty ? flushSave() : true; }
    if (!local.dirty) return !local.error;
    if (local.code === 'CONFLICT') return false;
    const change = local.change;
    const payload = currentPayload();
    const draft = local.draft;
    local.saving = true; local.error = ''; local.code = ''; localStatus();
    local.savePromise = (async () => {
      try {
        const saved = await Store.saveDraft({ ...(draft ? { id: draft.id, expectedVersion: draft.version } : local.pendingSeriesId ? { seriesId: local.pendingSeriesId } : {}), payload });
        // Invalidate reads that may have observed the old record while this save was pending.
        backupChanged();
        local.draft = saved;
        local.pendingSeriesId = '';
        if (change === local.change) local.dirty = false;
        channel?.postMessage({ type: 'saved', id: saved.id, version: saved.version });
      } catch (error) {
        local.code = error.code || 'STORAGE_UNAVAILABLE';
        local.error = local.code === 'CONFLICT' ? 'ร่างนี้ถูกแก้ในอีกแท็บแล้ว ยังไม่เขียนทับข้อมูล เก็บเป็นร่างแยกได้' : `ยังบันทึกไม่ได้: ${error.message || 'ตรวจพื้นที่เก็บข้อมูลของเบราว์เซอร์'} อย่าปิดหน้านี้`;
      } finally { local.saving = false; localStatus(); }
    })();
    await local.savePromise;
    return local.error ? false : local.dirty ? flushSave() : true;
  }
  function releasePrepared() {
    for (const key of ['pdfUrl', 'zipUrl']) if (state.prepared?.[key]) URL.revokeObjectURL(state.prepared[key]);
  }
  function loadPayload(payload) {
    releasePrepared();
    fullOpen.clear();
    Object.assign(state, structuredClone(emptyPayload), structuredClone(payload));
    state.prepared = null; state.exportError = ''; state.exportPage = 0; state.dataVersion++;
    state.viewing = null; state.imports = {}; state.removedPhoto = null; state.removedMaterial = null; state.pendingMaterialRemoval = null; state.copied = false; state.copyFallback = false;
    state.workerError = state.workers !== '' && (!Number.isInteger(Number(state.workers)) || Number(state.workers) < 0 || Number(state.workers) > 9999) ? 'จำนวนคนต้องเป็นจำนวนเต็ม 0–9999' : '';
    state.entered = Boolean(state.project.trim() && state.site.trim());
  }
  const projectProfileFields = ['companyName', 'companyEnglish', 'companyService', 'formCode', 'formRevision', 'ownerName', 'contractorName'];
  function freshProjectPayload(source = {}) {
    const payload = structuredClone(emptyPayload);
    payload.date = currentLocalDate();
    payload.project = typeof source.project === 'string' ? source.project : '';
    payload.site = typeof source.site === 'string' ? source.site : '';
    const previous = Full.normalize(source.fullReport);
    const next = Full.defaults();
    for (const key of projectProfileFields) next[key] = previous[key];
    next.logo = previous.logo ? structuredClone(previous.logo) : null;
    payload.fullReport = next;
    return payload;
  }
  function projectFolders() {
    const folders = new Map();
    const add = (record, type, time) => {
      let folder = folders.get(record.seriesId);
      if (!folder) {
        folder = { seriesId: record.seriesId, drafts: [], revisions: [], latest: null, latestTime: '' };
        folders.set(record.seriesId, folder);
      }
      folder[type].push(record);
      if (!folder.latest || time > folder.latestTime) { folder.latest = record; folder.latestTime = time; }
    };
    for (const draft of local.drafts) add(draft, 'drafts', draft.updatedAt);
    for (const revision of local.revisions) add(revision, 'revisions', revision.confirmedAt);
    return Array.from(folders.values()).sort((a, b) => b.latestTime.localeCompare(a.latestTime) || a.seriesId.localeCompare(b.seriesId));
  }
  async function refreshRecords() {
    [local.drafts, local.revisions] = await Promise.all([Store.listDrafts(), Store.listRevisions()]);
  }
  function activateDraft(record, page = 'entry') {
    local.viewed = null; local.draft = record; local.pendingSeriesId = ''; local.dirty = false; local.error = ''; local.code = '';
    local.projectMode = 'edit'; local.historySeriesId = record.seriesId;
    loadPayload(record.payload); state.page = page;
  }
  async function projectsPage() {
    if (anyImport() || state.exportBusy || local.busy) { mark('รอให้การอ่านรูปหรือจัดหน้าเสร็จก่อน'); return; }
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      await refreshRecords();
      local.viewed = null; local.draft = null; local.pendingSeriesId = ''; local.dirty = false; local.error = ''; local.code = ''; local.historySeriesId = '';
      loadPayload({ ...emptyPayload, date: currentLocalDate() });
      local.projectMode = projectFolders().length ? 'list' : 'create'; state.page = 'setup';
      root.scrollIntoView({ block: 'start' });
    } finally { local.busy = false; render(); }
  }
  async function resumeProject(seriesId, edit = false) {
    if (anyImport() || state.exportBusy || local.busy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      await refreshRecords();
      const draft = local.drafts.find(record => record.seriesId === seriesId);
      if (!draft) { mark('แฟ้มนี้ยังไม่มีร่างที่ทำต่อได้ เริ่มบันทึกวันนี้แทน'); return; }
      activateDraft(draft, edit ? 'setup' : 'entry');
      local.projectMode = edit ? 'edit' : 'list';
      root.scrollIntoView({ block: 'start' });
    } finally { local.busy = false; render(); }
  }
  async function startProjectToday(seriesId) {
    if (anyImport() || state.exportBusy || local.busy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      await refreshRecords();
      const folder = projectFolders().find(item => item.seriesId === seriesId);
      if (!folder) throw new Error('ไม่พบแฟ้มโครงการนี้');
      const today = currentLocalDate();
      const previouslyExisting = folder.drafts.find(record => record.payload.date === today);
      const saved = await Store.getOrCreateDailyDraft({ seriesId, payload: freshProjectPayload(folder.latest?.payload) });
      if (previouslyExisting) {
        activateDraft(saved);
        mark(`เปิดบันทึกวันนี้ ${prettyDate(today)} แล้ว`);
      } else {
        backupChanged(true);
        activateDraft(saved);
        mark(`เริ่มบันทึกใหม่สำหรับวันนี้ ${prettyDate(today)} แล้ว`);
      }
      root.scrollIntoView({ block: 'start' });
    } finally { local.busy = false; render(); }
  }
  async function historyPage(seriesId = '') {
    if (anyImport() || state.exportBusy || local.busy) { mark('รอให้การอ่านรูปหรือจัดหน้าเสร็จก่อน'); return; }
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      await refreshRecords(); local.historySeriesId = seriesId;
      state.page = 'history'; root.scrollIntoView({ block: 'start' });
    } finally { local.busy = false; render(); }
  }
  async function useDraft(id) {
    if (anyImport() || state.exportBusy || local.busy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      const record = await Store.getDraft(id);
      if (!record) throw new Error('ไม่พบร่างนี้');
      activateDraft(record, record.payload.project?.trim() && record.payload.site?.trim() ? 'entry' : 'setup');
    } finally { local.busy = false; render(); }
  }
  async function viewRevision(id) {
    if (anyImport() || state.exportBusy || local.busy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      const record = await Store.getRevision(id);
      if (!record) throw new Error('ไม่พบฉบับรายงานนี้');
      if (local.draft?.seriesId !== record.seriesId) local.draft = null;
      local.historySeriesId = record.seriesId;
      local.viewed = record; loadPayload(record.payload); state.page = 'report';
    } finally { local.busy = false; render(); }
  }
  async function newDraft() {
    if (anyImport() || state.exportBusy || local.busy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      local.viewed = null; local.draft = null; local.pendingSeriesId = ''; local.dirty = false; local.error = ''; local.code = '';
      loadPayload({ ...emptyPayload, date: currentLocalDate() }); local.projectMode = 'create'; local.historySeriesId = ''; state.page = 'setup';
    } finally { local.busy = false; render(); }
  }
  async function cloneViewed() {
    if (!local.viewed || local.busy || anyImport() || state.exportBusy) return;
    const id = local.viewed.id; local.busy = true; render(true);
    try {
      const draft = await Store.cloneRevision(id);
      backupChanged(true);
      local.viewed = null; local.draft = draft; local.pendingSeriesId = ''; local.dirty = false; local.error = ''; local.code = '';
      local.projectMode = 'edit'; local.historySeriesId = draft.seriesId; loadPayload(draft.payload); state.page = 'entry';
    } finally { local.busy = false; render(); }
  }
  async function confirmReport() {
    if (local.busy || local.viewed || anyImport() || state.exportBusy) return;
    if (missing().length) { navigate('report'); mark('เติมข้อมูลที่ขาดให้ครบก่อนยืนยันฉบับ'); return; }
    local.busy = true; render(true);
    try {
      if (!(await flushSave()) || !local.draft) return;
      const record = await Store.confirmDraft(local.draft.id, local.draft.version);
      backupChanged(true);
      local.viewed = record; loadPayload(record.payload); state.page = 'report';
      mark(`ยืนยันและเก็บฉบับ ${record.docId} เมื่อ ${reportTimeWithZone(record.confirmedAt)} แล้ว · ยังไม่ได้ส่งหรือรับรองงาน`);
    } catch (error) { local.error = `ยืนยันฉบับไม่ได้: ${error.message}`; local.code = error.code || ''; }
    finally { local.busy = false; render(); }
  }
  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function backupAll() {
    if (local.busy || local.booting || anyImport() || state.exportBusy) return;
    local.busy = true; render(true);
    try {
      if (!local.viewed && !(await flushSave())) return;
      const generation = backupState.generation;
      const backup = await Store.exportBackup();
      const filename = `site-report-backup-${Date.now()}.json`;
      const candidate = Backup?.prepare(backup, filename);
      saveBlob(new Blob([JSON.stringify(backup)], { type: 'application/json' }), filename);
      backupState.candidate = candidate || null;
      // Capture precisely this exported snapshot. Later edits must not be cleared by confirmation.
      if (generation === backupState.generation) { backupState.generation++; backupState.manifest = candidate?.manifest || null; backupState.changed = false; }
      mark('เตรียมไฟล์สำรองแล้ว ตรวจว่าไฟล์อยู่ในเครื่องก่อนปิดงาน ไฟล์มีรูปและข้อมูลโครงการ');
    } finally { local.busy = false; render(); }
  }
  async function importBackupFile(file) {
    if (!file || local.busy || anyImport() || state.exportBusy) return;
    if (file.size > 140 * 1024 * 1024) throw new Error('ไฟล์สำรองใหญ่เกิน 140 MB');
    local.busy = true; render();
    try {
      if (!local.viewed && !(await flushSave())) return;
      const backup = JSON.parse(await file.text());
      const result = await Store.importBackup(backup);
      backupChanged(true);
      local.drafts = await Store.listDrafts(); local.revisions = await Store.listRevisions();
      local.historySeriesId = ''; state.page = 'history'; mark('อ่านไฟล์สำรองสำเร็จ เพิ่มเฉพาะรายการใหม่ ไม่เขียนทับข้อมูลเดิม');
      return result;
    } finally { local.busy = false; render(); }
  }
  function historyView() {
    const folder = local.historySeriesId ? projectFolders().find(item => item.seriesId === local.historySeriesId) : null;
    const drafts = folder ? folder.drafts : local.drafts;
    const revisions = folder ? folder.revisions : local.revisions;
    const heading = folder?.latest?.payload;
    return `<main class="sr-main"><div class="sr-heading"><p class="sr-eyebrow">${folder ? 'ประวัติในแฟ้มโครงการ' : 'เฉพาะเบราว์เซอร์และเครื่องนี้'}</p><h1>${esc(heading?.project || 'ร่างและประวัติรายงาน')}</h1><p class="sr-sub">${heading ? `${esc(heading.site || 'ยังไม่ระบุสถานที่')} · ` : ''}ฉบับยืนยันเก็บแยกจากร่างและแก้ทับไม่ได้</p></div>
      ${folder ? `<button type="button" class="sr-button sr-primary sr-full" data-project-today="${esc(folder.seriesId)}">${icon('calendar-plus')} ${folder.drafts.some(record => record.payload.date === currentLocalDate()) ? 'เปิดบันทึกวันนี้' : 'เริ่มบันทึกวันนี้'}</button>` : `<button type="button" class="sr-button sr-primary sr-full" data-action="new-draft">${icon('folder-plus')} สร้างแฟ้มโครงการใหม่</button>`}
      <section class="sr-section"><h2>ร่างที่ทำต่อได้ (${drafts.length})</h2>${drafts.length ? drafts.map(draft => `<article class="sr-history-item"><h3>${esc(draft.payload.project || 'ร่างยังไม่ระบุโครงการ')}</h3><p class="sr-sub">${esc(draft.payload.site || 'ยังไม่ระบุสถานที่')} · ${prettyDate(draft.payload.date)}</p><small>บันทึกล่าสุด ${dateTime(draft.updatedAt)}</small><button type="button" class="sr-button sr-full" data-use-draft="${esc(draft.id)}">เปิดร่างนี้</button></article>`).join('') : '<p class="sr-sub">ยังไม่มีร่างที่บันทึก</p>'}</section>
      <section class="sr-section"><h2>ฉบับยืนยันข้อมูล (${revisions.length})</h2>${revisions.length ? revisions.map(record => `<article class="sr-history-item"><h3>${esc(record.payload.project || 'ไม่ระบุโครงการ')}</h3><small>${esc(record.docId)} · ยืนยันและเก็บฉบับเมื่อ ${reportTimeWithZone(record.confirmedAt)}</small><p class="sr-sub">${esc(record.payload.reporter || 'ไม่ระบุผู้บันทึก')} · ไม่ใช่การตรวจรับงาน</p><button type="button" class="sr-button sr-full" data-view-revision="${esc(record.id)}">ดูรายงานและดาวน์โหลด</button></article>`).join('') : '<p class="sr-sub">เมื่อกรอกครบ กด “ยืนยันและเก็บฉบับ” ในหน้ารายงาน</p>'}</section>
      <section class="sr-history-backup"><h2>สำรองข้อมูลออกจากเครื่อง</h2><p class="sr-sub">รวมร่าง ฉบับยืนยัน และรูปทั้งหมด ไฟล์ไม่เข้ารหัส เก็บไว้ในที่ส่วนตัว</p><p class="sr-photo-hint" data-backup-detail></p><button type="button" class="sr-button sr-full" data-action="backup">${icon('download')} ดาวน์โหลดไฟล์สำรอง</button><button type="button" class="sr-button sr-full" data-action="import-backup">${icon('upload')} นำเข้าไฟล์สำรอง</button><input type="file" accept=".json,application/json" hidden data-backup-file><p class="sr-photo-hint">นำเข้าแบบเพิ่มรายการ ไม่ลบหรือเขียนทับรายการเดิม ถ้าข้อมูลชนกันจะหยุดทั้งชุด</p></section>
    </main><footer class="sr-footer"><button type="button" class="sr-button sr-quiet sr-full" data-action="projects">${icon('folders')} กลับแฟ้มโครงการ</button></footer>`;
  }
  function hydrate() {
    if (globalThis.lucide) globalThis.lucide.createIcons({ attrs: { width: 18, height: 18, 'stroke-width': 1.8 } });
  }
  function missing() {
    const list = [];
    if (unsupportedTasks().length) list.push('มีรายการงานที่รุ่นนี้ยังไม่รองรับ ห้ามใช้สรุปที่ไม่ครบ กรุณาสำรองข้อมูลและเปิดด้วยรุ่นที่รองรับ');
    if (anyImport()) list.push('กำลังอ่านรูป กรุณารอให้เสร็จ');
    if (!state.project.trim()) list.push('ชื่อโครงการ');
    if (!state.site.trim()) list.push('สถานที่');
    if (!taskDefs().length) list.push('เลือกงานวันนี้อย่างน้อย 1 รายการ');
    taskDefs().forEach(def => {
      const task = state.tasks[def.id];
      const fields = [];
      if (!zoneLabel(task)) fields.push('จุดทำงาน');
      if (!task.status) fields.push('สถานะ');
      if (!task.photos.length) fields.push('รูป');
      if (fields.length) list.push(`${def.title}: ${fields.join(' / ')}`);
    });
    if (!state.issues) list.push('ระบุว่ามีเรื่องต้องติดตามหรือไม่');
    if (taskDefs().some(def => state.tasks[def.id].status === 'blocked') && state.issues !== 'yes') list.push('มีงานติดขัด: เพิ่มเรื่องติดตาม');
    if (state.issues === 'yes') {
      if (!state.issueTask || (state.issueTask !== 'all' && !state.tasks[state.issueTask]?.selected)) list.push('งานที่ต้องติดตาม');
      if (!state.issueType) list.push('เรื่องที่ต้องติดตาม');
      if (!state.urgency) list.push('ความเร่งด่วนของเรื่องติดตาม');
      if (state.issueType === 'อื่น ๆ' && !state.issueNote.trim()) list.push('รายละเอียดเรื่องอื่น ๆ');
      if (!state.owner.trim()) list.push('ผู้ประสานงานเรื่อง');
      if (!validDate(state.due)) list.push('วันที่ต้องการคำตอบที่ถูกต้อง');
    }
    if (!state.reporter.trim()) list.push('ผู้บันทึก');
    if (!validDate(state.date)) list.push('วันที่รายงานที่ถูกต้อง');
    if (state.workerError) list.push(state.workerError);
    return list;
  }
  function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }
  function setup() {
    const folders = projectFolders();
    if (local.projectMode === 'list' && folders.length) {
      return `<main class="sr-main sr-project-home">
        <div class="sr-heading"><p class="sr-eyebrow">วันนี้ ${prettyDate(currentLocalDate())}</p><h1>แฟ้มโครงการ</h1><p class="sr-sub">เลือกแฟ้มเดิมเพื่อบันทึกงานต่อเนื่อง ข้อมูลแต่ละโครงการไม่ปะปนกัน</p></div>
        <div class="sr-project-folders">${folders.map(folder => {
          const payload = folder.latest?.payload || {};
          const draft = folder.drafts[0];
          const todayDraft = folder.drafts.find(record => record.payload.date === currentLocalDate());
          return `<article class="sr-project-folder" data-project-folder data-series-id="${esc(folder.seriesId)}"><div class="sr-folder-head"><span class="sr-folder-icon">${icon('folder-kanban')}</span><div><h2>${esc(payload.project || 'แฟ้มยังไม่ระบุชื่อโครงการ')}</h2><p>${icon('map-pin')} <span>${esc(payload.site || 'ยังไม่ระบุสถานที่')}</span></p></div><span class="sr-folder-count">${folder.revisions.length} ฉบับ</span></div><p class="sr-folder-meta">อัปเดตล่าสุด ${dateTime(folder.latestTime)} · ${folder.drafts.length} ร่าง</p><div class="sr-folder-actions"><button type="button" class="sr-button sr-primary" data-project-today="${esc(folder.seriesId)}">${icon(todayDraft ? 'calendar-check' : 'calendar-plus')} ${todayDraft ? 'เปิดบันทึกวันนี้' : 'เริ่มบันทึกวันนี้'}</button>${draft ? `<button type="button" class="sr-button" data-project-resume="${esc(folder.seriesId)}">${icon('file-pen-line')} ทำต่อร่าง ${prettyDate(draft.payload.date)}</button>` : ''}</div><div class="sr-folder-links">${draft ? `<button type="button" class="sr-link-button" data-project-edit="${esc(folder.seriesId)}">${icon('pencil')} แก้ข้อมูลแฟ้ม</button>` : ''}<button type="button" class="sr-link-button" data-project-history="${esc(folder.seriesId)}">${icon('history')} ดูประวัติในแฟ้ม</button></div></article>`;
        }).join('')}</div>
      </main><footer class="sr-footer"><button type="button" class="sr-button sr-full" data-action="new-draft">${icon('folder-plus')} สร้างแฟ้มโครงการใหม่</button><p class="sr-sub">แต่ละแฟ้มใช้รหัสภายในแยกกัน แม้ชื่อโครงการจะเหมือนกัน</p></footer>`;
    }
    const editing = local.projectMode === 'edit' && Boolean(local.draft);
    return `<main class="sr-main sr-project-form">
      <div class="sr-heading"><p class="sr-eyebrow">${editing ? 'ข้อมูลประจำแฟ้ม' : 'เริ่มต้นเพียง 2 ช่อง'}</p><h1>${editing ? 'แก้ข้อมูลโครงการ' : 'สร้างแฟ้มโครงการ'}</h1><p class="sr-sub">${editing ? 'แก้เฉพาะร่างและข้อมูลที่จะใช้สร้างรายงานครั้งถัดไป ฉบับยืนยันเดิมไม่เปลี่ยน' : 'ตั้งโครงการครั้งแรก แล้วใช้แฟ้มนี้ต่อในรายงานแต่ละวัน'}</p></div>
      <label class="sr-field">ชื่อโครงการ<input id="sr-project" data-field="project" maxlength="100" value="${esc(state.project)}" placeholder="เช่น บ้านพักคุณสมชาย" autocomplete="off" required></label>
      <label class="sr-field">สถานที่<input id="sr-site" data-field="site" maxlength="150" value="${esc(state.site)}" placeholder="เช่น ต.คลองหนึ่ง อ.คลองหลวง" autocomplete="off" required><small>พิมพ์ชื่อไซต์หรือที่อยู่ ไม่ต้องปักหมุดก่อนเริ่ม</small></label>
      <p class="sr-sub">บันทึกเป็นร่างในเบราว์เซอร์นี้ ออกจากหน้าแล้วกลับมาทำต่อได้เมื่อบันทึกสำเร็จ</p>
      <div class="sr-setup-note">
        <div class="sr-note-row">${icon('list-checks')}<span>ติ๊กงาน แล้วถ่ายรูป<small>รูปอยู่กับงานและจุดที่รายงาน</small></span></div>
        <div class="sr-note-row">${icon('file-text')}<span>รวมเป็นรายงานเดียวบนเว็บ<small>เลือกไฟล์ PNG หรือ A4 พร้อมข้อความ LINE สั้น ๆ</small></span></div>
      </div>
      ${state.error ? `<p class="sr-error" role="alert">${esc(state.error)}</p>` : ''}
    </main>
    <footer class="sr-footer"><button class="sr-button sr-primary sr-full" type="button" data-action="enter">${editing ? 'บันทึกข้อมูลแฟ้มและกลับหน้างาน' : 'สร้างแฟ้มและเริ่มรายงาน'} ${icon('arrow-right')}</button>${folders.length ? `<button type="button" class="sr-button sr-quiet sr-full" data-action="projects">${icon('arrow-left')} ยกเลิก · กลับแฟ้มโครงการ</button>` : ''}<p class="sr-sub">ไม่ต้องตั้งงวดงานหรือลงรายการ BOQ ก่อนเริ่ม</p></footer>`;
  }
  function photoSurface(photo, full = false) {
    if (photo.sample) return `<div class="${full ? 'sr-view-sample' : 'sr-photo-image'} sr-sample-image" role="img" aria-label="ภาพจำลองประกอบ ${esc(photo.taskTitle)} ไม่ใช่หลักฐานจริง">${icon('image')}<span>${esc(photo.taskTitle)}</span><span class="sr-sample-tag">ภาพจำลอง · ไม่ใช่ภาพถ่ายจริง</span></div>`;
    return `<img class="${full ? 'sr-view-photo' : 'sr-photo-image'}" src="${esc(photo.src)}" alt="${esc(photo.caption || 'ภาพแนบ ' + photo.taskTitle)} · ${esc(photo.zone || 'ยังไม่ระบุจุด')}" ${full ? '' : 'loading="lazy"'}>`;
  }
  function photos(task, editable) {
    if (!task.photos.length) return '';
    return `<div class="sr-gallery">${task.photos.map(photo => `<figure class="sr-photo">
      <button type="button" class="sr-photo-open" data-open-photo="${photo.id}" data-task="${task.id}" aria-label="ดูเต็มภาพ รูป ${photo.id} ${esc(photo.taskTitle)}">${photoSurface(photo)}<span class="sr-photo-expand">${icon('expand')}</span></button>
      <figcaption>${photo.phase ? `<span class="sr-photo-phase">${esc(photo.phase)}</span><br>` : ''}${esc(photo.zone || 'ยังไม่ระบุจุด')} · ${photo.sample ? 'ตัวอย่าง' : 'นำเข้า ' + esc(photo.importedAt)}${photo.caption ? `<span class="sr-photo-caption">${esc(photo.caption)}</span>` : ''}</figcaption>
      ${editable ? `<button class="sr-photo-remove" type="button" data-remove-photo="${photo.id}" data-task="${task.id}" aria-label="ลบรูป ${photo.id} จาก ${esc(photo.taskTitle)}">${icon('trash-2')} ลบรูป</button>` : ''}
    </figure>`).join('')}</div>`;
  }
  function workDetail(def) {
    const task = state.tasks[def.id];
    return `<div class="sr-work-detail">
      <label class="sr-field">จุดทำงาน<select data-task-field="zone" data-task="${def.id}" aria-label="จุดทำงาน ${def.title}">${options(['ชั้น 1', 'ชั้น 2', 'ภายนอก', ['other', 'ระบุจุดเอง']], task.zone, 'เลือกจุด / ชั้น')}</select></label>
      ${task.zone === 'other' ? `<label class="sr-field">ระบุจุด<input data-task-field="customZone" data-task="${def.id}" maxlength="100" value="${esc(task.customZone)}" placeholder="เช่น ห้องน้ำชั้น 1 ฝั่งทิศเหนือ"></label>` : ''}
      <label class="sr-field">สถานะวันนี้<select data-task-field="status" data-task="${def.id}" aria-label="สถานะ ${def.title}">${options([['doing', 'กำลังทำ'], ['done', 'เสร็จตามรายงาน'], ['blocked', 'ติดขัด']], task.status, 'เลือกสถานะที่พบหน้างาน')}</select></label>
      ${task.status === 'done' ? '<p class="sr-sub">บอกความคืบหน้าเท่านั้น ไม่ใช่การรับรองคุณภาพงาน</p>' : ''}
      <div class="sr-photo-add"><div class="sr-title-row"><h3>รูปหน้างาน</h3><span class="sr-count">${task.photos.length}/6 รูป</span></div>
      <div class="sr-capture-actions"><button type="button" class="sr-button sr-primary" data-camera="${def.id}" ${state.imports[def.id] || task.photos.length >= 6 ? 'disabled' : ''}>${icon('camera')} ถ่ายรูป</button><button type="button" class="sr-button" data-gallery="${def.id}" ${state.imports[def.id] || task.photos.length >= 6 ? 'disabled' : ''}>${icon('images')} เลือกรูป</button></div>
      <input hidden type="file" accept="${photoAccept}" capture="environment" data-files="${def.id}" data-input-source="camera" aria-label="ถ่ายภาพ ${def.title}">
      <input hidden type="file" accept="${photoAccept}" multiple data-files="${def.id}" data-input-source="gallery" aria-label="เลือกรูป ${def.title}">
      <p class="sr-photo-hint">${state.imports[def.id] ? 'กำลังอ่านรูป… ยังไม่อัปโหลด' : task.photos.length ? 'แตะภาพเพื่อดูเต็มรูป ใส่คำบรรยาย หรือเปลี่ยนรูป' : 'ถ่ายภาพรวมและรายละเอียดของจุดทำงานนี้'}</p>
      ${photoHelp()}
      <button type="button" class="sr-link-button" data-sample="${def.id}" ${state.imports[def.id] || task.photos.length >= 6 ? 'disabled' : ''}>ลองด้วยภาพจำลอง</button></div>
      ${photos(task, true)}
      <label class="sr-field">ปริมาณ / หมายเหตุ <small>ไม่บังคับ</small><input data-task-field="note" data-task="${def.id}" maxlength="200" value="${esc(task.note)}" placeholder="เช่น ก่อผนังวันนี้ 24 ตร.ม."></label>
      ${FullUI.task(fullData(), def.id)}
    </div>`;
  }
  function issueFields() {
    return `<div class="sr-issue-fields">
      <label class="sr-field">เกี่ยวกับงาน<select data-field="issueTask">${options([['all', 'ภาพรวมโครงการ'], ...taskDefs().map(def => [def.id, def.title])], state.issueTask, 'เลือกงานที่ต้องติดตาม')}</select></label>
      <label class="sr-field">เรื่องที่พบ<select data-field="issueType">${options(['วัสดุไม่พอ', 'รอคำตอบเรื่องแบบ', 'หน้างานไม่พร้อม', 'คุณภาพงาน', 'ความปลอดภัย', 'อื่น ๆ'], state.issueType, 'เลือกเรื่อง')}</select></label>
      <label class="sr-field">ความเร่งด่วน<select data-field="urgency">${options([['normal', 'ตามแผนงาน'], ['today', 'ต้องการคำตอบวันนี้'], ['urgent', 'เร่งด่วน / งานหยุดรอ']], state.urgency)}</select></label>
      <div class="sr-grid"><label class="sr-field">ผู้ประสานงานเรื่อง<input data-field="owner" maxlength="70" value="${esc(state.owner)}" placeholder="ชื่อ / ทีมงาน"></label><label class="sr-field">ต้องการคำตอบวันที่<input type="date" data-field="due" value="${esc(state.due)}"></label></div>
      <label class="sr-field">รายละเอียดเพิ่มเติม<textarea data-field="issueNote" maxlength="500" placeholder="พิมพ์เฉพาะสิ่งที่ต้องการให้ช่วย">${esc(state.issueNote)}</textarea></label>
      <p class="sr-sub">ใช้รูปที่แนบในงานนั้นเป็นหลักฐานประกอบ</p>
    </div>`;
  }
  function paperSection(key, number, title, body) {
    return `<section class="sr-sheet-section" data-sheet-section="${key}" data-full-section="${key}" aria-labelledby="sr-paper-${key}"><h2 id="sr-paper-${key}"><span>${number}</span>${title}</h2><div class="sr-sheet-body">${body}</div></section>`;
  }
  const hasValue = value => String(value ?? '').trim() !== '';
  const countValues = values => values.filter(hasValue).length;
  function compactDetails(key, title, hint, body, className = '') {
    return `<details class="sr-details sr-compact-details ${className}" data-full-section="${esc(key)}"><summary><span data-compact-title>${esc(title)}</span><small data-compact-summary>${esc(hint)}</small></summary><div class="sr-details-body">${body}</div></details>`;
  }
  function workCompactSummary(taskId, data = fullData()) {
    const task = state.tasks[taskId] || { zone:'', customZone:'', status:'', note:'', photos:[] };
    const progress = data.progress?.[taskId] || {};
    const facts = [zoneLabel(task) || 'ยังไม่ระบุจุด', statusLabel(task.status)];
    if (hasValue(progress.planned) || hasValue(progress.actual)) facts.push(`แผน ${hasValue(progress.planned) ? `${progress.planned}%` : '—'} / จริง ${hasValue(progress.actual) ? `${progress.actual}%` : '—'}`);
    if (hasValue(task.note)) facts.push('มีบันทึก');
    facts.push(`${task.photos?.length || 0} รูป`);
    return facts.join(' · ');
  }
  function compactSummaryFor(key) {
    const data = fullData();
    if (key === 'site-more') {
      const count = countValues([data.weatherMorning, data.weatherAfternoon, data.rain]);
      return { hint: count ? `กรอกแล้ว ${count}/3 ช่อง` : 'ไม่บังคับ' };
    }
    if (key === 'quality-more') {
      const count = countValues([data.quality, data.safetyIncident, data.nearMiss, data.ppe, data.toolboxTime, data.scheduleImpact, data.coordination]);
      return { hint: count ? `กรอกแล้ว ${count}/7 ช่อง` : 'ไม่บังคับ · ช่องว่างไม่ถือว่าผ่าน' };
    }
    if (key === 'signatures') {
      const count = countValues(Object.values(data.signatures || {}));
      return { hint: count ? `กรอกแล้ว ${count}/6 ช่อง · ยังไม่ใช่ลายเซ็น` : 'ไม่บังคับ · ช่องลงนามยังว่าง' };
    }
    if (key.startsWith('work-')) {
      const taskId = key.slice(5), def = catalog.find(item => item.id === taskId);
      return { title: `รายละเอียด${def ? ` ${def.title}` : 'งาน'}`, hint: workCompactSummary(taskId, data) };
    }
    if (key.startsWith('followup-')) {
      const rowId = key.slice(9), index = data.followups.findIndex(row => row.id === rowId), row = data.followups[index];
      if (!row) return null;
      const facts = countValues([row.responsible, row.due, row.priority, row.status]);
      return { title: row.title || `งานติดตาม ${index + 1}`, hint: facts ? `มีรายละเอียด ${facts} ช่อง` : 'ยังไม่ระบุรายละเอียด' };
    }
    if (key.startsWith('material-')) {
      const rowId = key.slice(9), index = data.materials.findIndex(row => row.id === rowId), row = data.materials[index];
      if (!row) return null;
      const amount = [row.quantity, row.unit].filter(hasValue).join(' ');
      const facts = [amount, row.usage, row.status].filter(hasValue);
      return { title: row.name || `วัสดุ / เครื่องจักร ${index + 1}`, hint: facts.length ? facts.join(' · ') : 'ยังไม่ระบุรายละเอียด' };
    }
    return null;
  }
  function refreshCompactSummary(details) {
    for (let node = details; node?.dataset?.fullSection && screen.contains(node); node = node.parentElement?.closest('details[data-full-section]')) {
      const summary = compactSummaryFor(node.dataset.fullSection);
      if (!summary) continue;
      const title = node.querySelector(':scope > summary > [data-compact-title]');
      const hint = node.querySelector(':scope > summary > [data-compact-summary]');
      if (title && summary.title) title.textContent = summary.title;
      if (hint) hint.textContent = summary.hint;
    }
  }
  function materialNotice() {
    const pending = fullData().materials.find(row => row.id === state.pendingMaterialRemoval);
    return `${pending ? `<div class="sr-material-notice" role="status"><p>นำ “${esc(pending.name || 'รายการนี้')}” ออกจากรายงาน? จำนวนและหมายเหตุจะถูกนำออกด้วย</p><button type="button" class="sr-button" data-action="confirm-material-remove">นำรายการนี้ออก</button><button type="button" class="sr-button sr-quiet" data-action="cancel-material-remove">เก็บรายการไว้</button></div>` : ''}${state.removedMaterial ? `<button type="button" class="sr-link-button" data-action="undo-material">${icon('undo-2')} คืนรายการ ${esc(state.removedMaterial.row.name || 'วัสดุ / เครื่องจักร')}</button>` : ''}`;
  }
  function materialPreset(id) {
    return FullUI.materialPresets.find(item => item.id === id) || null;
  }
  function materialHasDetails(row, preset) {
    if (!preset) return true;
    return String(row.quantity || '').trim() !== ''
      || String(row.status || '').trim() !== ''
      || String(row.name || '').trim() !== preset.name
      || String(row.unit || '').trim() !== preset.unit
      || !['', 'ใช้งานวันนี้'].includes(String(row.usage || '').trim());
  }
  function removeMaterial(rowId) {
    const data = fullData(), index = data.materials.findIndex(row => row.id === rowId);
    if (index < 0) return false;
    const [row] = data.materials.splice(index, 1);
    state.fullReport = data;
    state.pendingMaterialRemoval = null;
    state.removedMaterial = { row: structuredClone(row), index };
    invalidateExports();
    render(true);
    mark(`นำ ${row.name || 'วัสดุ / เครื่องจักร'} ออกจากรายงานแล้ว · กดคืนรายการได้`);
    return true;
  }
  function requestMaterialRemoval(rowId) {
    const row = fullData().materials.find(item => item.id === rowId);
    if (!row) return;
    const preset = row.id.startsWith('preset-') ? materialPreset(row.id.slice(7)) : null;
    if (materialHasDetails(row, preset)) {
      state.pendingMaterialRemoval = row.id;
      render(true);
      screen.querySelector('[data-action="confirm-material-remove"]')?.focus({ preventScroll: true });
      mark('ตรวจข้อมูลก่อนนำรายการออก');
      return;
    }
    removeMaterial(row.id);
  }
  function entry() {
    const data = fullData(), parts = FullUI.sheetParts(data, state.workers);
    const hasCompanyIdentity = Boolean(data.logo || data.companyName.trim() || data.companyEnglish.trim() || data.companyService.trim());
    const companyTitle = data.companyName.trim() || data.companyEnglish.trim();
    const companyDetail = data.companyName.trim() ? data.companyEnglish.trim() || data.companyService.trim() : data.companyService.trim();
    const metadata = [['โครงการ', state.project], ['สถานที่', state.site], ['เจ้าของโครงการ', data.ownerName], ['ผู้รับเหมา', data.contractorName]];
    const siteMoreSummary = compactSummaryFor('site-more').hint;
    const qualitySummary = compactSummaryFor('quality-more').hint;
    const signatureSummary = compactSummaryFor('signatures').hint;
    const works = groups.map(group => `<section class="sr-work-group" aria-labelledby="sr-group-${group.id}"><h3 id="sr-group-${group.id}" class="sr-group-title">${esc(group.title)}</h3><div class="sr-work-list">${catalog.filter(def => def.groupId === group.id).map(def => {
      const task = state.tasks[def.id], selected = Boolean(task?.selected);
      const summary = selected ? workCompactSummary(def.id, data) : '';
      return `<section class="sr-work ${selected ? 'is-selected' : ''}"><label class="sr-choice"><input type="checkbox" data-toggle-task="${def.id}" ${selected ? 'checked' : ''}><span><strong>${def.title}</strong><small>${def.note}</small></span>${icon(def.icon)}</label>${selected ? compactDetails(`work-${def.id}`, `รายละเอียด ${def.title}`, summary, workDetail(def), 'sr-work-editor') : ''}</section>`;
    }).join('')}</div></section>`).join('');
    return `<main class="sr-main sr-paper-workspace"><article class="sr-report-sheet" data-paper-form>
      <header class="sr-paper-head ${hasCompanyIdentity ? '' : 'is-unbranded'}">${hasCompanyIdentity ? `<div class="sr-paper-company">${data.logo ? `<img src="${esc(data.logo.src)}" alt="โลโก้บริษัทในรายงาน">` : ''}${companyTitle || companyDetail ? `<div>${companyTitle ? `<strong>${esc(companyTitle)}</strong>` : ''}${companyDetail ? `<small>${esc(companyDetail)}</small>` : ''}</div>` : ''}</div>` : ''}<div class="sr-paper-title"><p>DAILY SITE REPORT</p><h1>บันทึกหน้างานประจำวัน</h1></div><label class="sr-field">วันที่รายงาน<input type="date" data-field="date" value="${esc(state.date)}"></label></header>
      <div class="sr-paper-context" data-paper-context><dl>${metadata.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value || 'ยังไม่ระบุ')}</dd></div>`).join('')}</dl><button type="button" class="sr-link-button" data-action="edit-current-project">${icon('pencil')} แก้ข้อมูลโครงการ</button></div>
      <p class="sr-paper-instruction">ติ๊กสิ่งที่เกิดขึ้น เติมเฉพาะที่ใช้ · ช่องว่าง = ยังไม่ระบุ</p>
      ${paperSection('site','01','ข้อมูลประจำวัน',`<div class="sr-sheet-basic"><label class="sr-field">ผู้บันทึก<input data-field="reporter" value="${esc(state.reporter)}" maxlength="70" placeholder="ชื่อผู้บันทึกวันนี้"></label><label class="sr-field">สภาพอากาศรวม<select data-field="weather">${options(['แดดออก', 'มีเมฆ', 'ฝนตกบางช่วง', 'ฝนตก / กระทบงาน'], state.weather, 'ยังไม่ระบุ')}</select></label></div>${parts.siteCore}${compactDetails('site-more', 'อากาศรายช่วง', siteMoreSummary, parts.siteMore, 'sr-site-more')}`)}
      ${paperSection('work','02–03','งาน ผลงานจริง และภาพถ่าย',`<div class="sr-title-row"><p class="sr-sub">ติ๊กงานที่ทำวันนี้ รายละเอียดจะแสดงเฉพาะงานที่เลือก</p><span class="sr-count">${taskDefs().length} งาน · ${totalPhotos()} รูป</span></div>${works}`)}
      ${paperSection('labor','04','แรงงานประจำวัน',`${parts.labor}<details class="sr-details sr-legacy-fields" ${state.extraOpen || state.workers !== '' || design.detailMode === 'full' ? 'open' : ''} data-extra><summary>ระบุเฉพาะยอดรวม / ข้อมูลเดิม<small>ใช้เมื่อไม่ได้แยกประเภท ไม่บวกซ้ำกับตารางด้านบน</small></summary><div class="sr-details-body"><label class="sr-field">ทีมงานเข้าหน้างาน (คน)<input type="number" inputmode="numeric" min="0" max="9999" step="1" data-field="workers" value="${esc(state.workers)}" placeholder="ยังไม่ระบุ" ${state.workerError ? 'aria-invalid="true" aria-describedby="sr-worker-error"' : ''}></label><p id="sr-worker-error" class="sr-error" role="alert" ${state.workerError ? '' : 'hidden'}>${esc(state.workerError)}</p></div></details>`)}
      ${paperSection('followups','05','งานติดตามจากวันก่อน',parts.followups)}
      ${paperSection('materials','06','วัสดุและเครื่องจักร',`${parts.materials}${materialNotice()}<label class="sr-field sr-legacy-note">บันทึกวัสดุเพิ่มเติม / ข้อมูลเดิม<input data-field="resources" value="${esc(state.resources)}" maxlength="200" placeholder="ระบุเฉพาะเรื่องที่ไม่ได้อยู่ในรายการติ๊ก"></label>`)}
      ${paperSection('quality','07–08','คุณภาพ ความปลอดภัย ปัญหา และแผนถัดไป',`<div class="sr-radios"><label class="sr-radio"><input type="radio" name="sr-issues" data-field="issues" value="no" ${state.issues === 'no' ? 'checked' : ''}>ไม่มีเรื่องแจ้ง</label><label class="sr-radio"><input type="radio" name="sr-issues" data-field="issues" value="yes" ${state.issues === 'yes' ? 'checked' : ''}>มีเรื่องติดตาม</label></div>${state.issues === 'yes' ? issueFields() : ''}<label class="sr-field sr-tomorrow">งานพรุ่งนี้<input data-field="tomorrow" value="${esc(state.tomorrow)}" maxlength="200" placeholder="ระบุงานที่จะทำต่อ"></label>${compactDetails('quality-more', 'รายละเอียดคุณภาพและความปลอดภัย', qualitySummary, parts.quality, 'sr-quality-more')}`)}
      <details class="sr-details sr-paper-signatures" data-full-section="signatures"><summary><span class="sr-sheet-number">09</span> ช่องชื่อผู้เกี่ยวข้อง / วันที่ (ไม่บังคับ)<small data-compact-summary>${esc(signatureSummary)}</small></summary><div class="sr-details-body">${parts.signatures}</div></details>
      <p class="sr-report-note">ร่างบันทึกหน้างาน ไม่ใช่ใบตรวจรับ · รูปแสดงเวลานำเข้า เวลาถ่ายที่ระบุเองยังไม่ผ่านการยืนยัน</p>
    </article></main><footer class="sr-footer sr-paper-footer"><button type="button" class="sr-button sr-primary sr-full" data-action="preview">${icon('file-text')} ดูรายงาน ${icon('arrow-right')}</button><p class="sr-sub">ตรวจข้อมูลก่อนเตรียม PNG / A4 และข้อความ LINE</p></footer>`;
  }
  function report() {
    const gaps = missing();
    const sampleCount = taskDefs().reduce((sum, def) => sum + state.tasks[def.id].photos.filter(photo => photo.sample).length, 0);
    return `<main class="sr-main">
      <div class="sr-heading"><p class="sr-eyebrow">${local.viewed ? 'ฉบับยืนยันข้อมูล (อ่านอย่างเดียว)' : 'ร่างรายงานในเครื่อง'}</p><h1>รายงานประจำวัน</h1><p class="sr-sub">${prettyDate(state.date)} · ${local.viewed ? esc(local.viewed.docId) : gaps.length ? 'ร่าง: ยังมีข้อมูลขาด' : 'ข้อมูลครบ พร้อมยืนยันฉบับ'}</p></div>
      <h2>${esc(state.project || 'ยังไม่ระบุโครงการ')}</h2><p class="sr-sub sr-location">${icon('map-pin')} <span>${esc(state.site || 'ยังไม่ระบุสถานที่')}</span></p>
      <dl class="sr-report-meta">${local.viewed ? `<div class="sr-meta-row sr-confirmed-time"><dt>ยืนยันฉบับ</dt><dd>ยืนยันและเก็บฉบับเมื่อ ${esc(reportTimeWithZone(local.viewed.confirmedAt))}</dd></div>` : ''}<div class="sr-meta-row"><dt>ผู้บันทึก</dt><dd>${esc(state.reporter || 'ยังไม่ระบุ')}</dd></div><div class="sr-meta-row"><dt>สรุปวันนี้</dt><dd>${taskDefs().length} งาน · ${totalPhotos()} รูป${sampleCount ? ` (ภาพจำลอง ${sampleCount})` : ''}</dd></div><div class="sr-meta-row"><dt>ทีม / อากาศ</dt><dd>${state.workerError ? 'จำนวนคนไม่ถูกต้อง' : state.workers === '' ? 'ไม่ระบุจำนวนคน' : `${esc(state.workers)} คน`} · ${esc(state.weather || 'ไม่ระบุอากาศ')}</dd></div></dl>
      ${gaps.length ? `<div class="sr-alert"><strong>${icon('clipboard-list')} ยังขาด ${gaps.length} จุด</strong><ul>${gaps.map(gap => `<li>${esc(gap)}</li>`).join('')}</ul>${local.viewed ? '<p>ฉบับยืนยันแก้ทับไม่ได้ เลือก “แก้ไขเป็นฉบับใหม่” ด้านล่างหากต้องการปรับข้อมูล</p>' : '<button type="button" class="sr-link-button" data-go="entry">กลับไปเติมข้อมูล</button>'}</div>` : ''}
      <section class="sr-section"><div class="sr-title-row"><h2>บันทึกงาน</h2><span class="sr-count">${taskDefs().length} รายการ</span></div>
        ${taskDefs().length ? taskDefs().map((def, index) => { const task = state.tasks[def.id]; return `<article class="sr-report-work"><h3>${index + 1}. ${def.title}</h3><p class="sr-sub">${esc(zoneLabel(task) || 'ยังไม่ระบุจุดทำงาน')}</p><span class="sr-report-status ${task.status === 'blocked' ? 'is-blocked' : ''}">${icon(task.status === 'blocked' ? 'triangle-alert' : task.status === 'done' ? 'circle-check' : 'clock-3')}${statusLabel(task.status)}</span>${task.note ? `<p class="sr-sub">${esc(task.note)}</p>` : ''}${photos(task, false)}${!task.photos.length ? '<p class="sr-sub">ยังไม่มีรูปประกอบ</p>' : ''}</article>`; }).join('') : '<p class="sr-sub">ยังไม่ได้เลือกงานวันนี้</p>'}
      </section>
      <section class="sr-section"><h2>เรื่องติดตาม</h2>${state.issues === 'yes' ? `<div class="sr-alert"><strong>${esc(state.issueType || 'ยังไม่ระบุเรื่อง')} · ${urgencyLabel()}</strong><p>${esc(issueTaskLabel())}</p><p>ผู้ประสานงานเรื่อง: ${esc(state.owner || 'ยังไม่ระบุ')}</p><p>ต้องการคำตอบ: ${prettyDate(state.due)}</p>${state.issueNote ? `<p>${esc(state.issueNote)}</p>` : ''}</div>` : `<p class="sr-sub">${state.issues === 'no' ? 'ผู้บันทึกระบุ: ไม่มีเรื่องแจ้งในรายงานนี้' : 'ยังไม่ระบุว่ามีเรื่องต้องติดตามหรือไม่'}</p>`}</section>
      <section class="sr-section"><h2>รายละเอียดเพิ่มเติม</h2><dl class="sr-report-meta"><div class="sr-meta-row"><dt>บันทึกวัสดุเพิ่มเติม / ข้อมูลเดิม</dt><dd>${esc(state.resources || 'ยังไม่ระบุ')}</dd></div><div class="sr-meta-row"><dt>งานพรุ่งนี้</dt><dd>${esc(state.tomorrow || 'ยังไม่ระบุ')}</dd></div></dl></section>
      ${FullUI.summary(fullData(), state.workers)}
      <p class="sr-report-note">บันทึกความคืบหน้าตามที่ผู้รายงานระบุ ไม่ใช่ใบตรวจรับหรือการรับรองความปลอดภัย รูปและข้อมูลยังไม่ได้เผยแพร่บนเว็บ</p>
    </main>
    <footer class="sr-footer">${!local.viewed ? `<button type="button" class="sr-button sr-primary sr-full" data-action="confirm-report" ${local.busy || anyImport() ? 'disabled' : ''}>${icon('archive')} ยืนยันและเก็บฉบับ</button>` : `<button type="button" class="sr-button sr-full" data-action="clone-revision">${icon('copy-plus')} แก้ไขเป็นฉบับใหม่</button>`}<button type="button" class="sr-button ${local.viewed ? 'sr-primary' : ''} sr-full" data-action="export">${icon('send')} เลือกช่องทางส่ง ${icon('arrow-right')}</button><button type="button" class="sr-button sr-line-button sr-full" data-action="line">${icon('message-circle')} ข้อความสั้น <span class="sr-line-label">LINE</span></button>${!local.viewed ? `<button type="button" class="sr-button sr-quiet sr-full" data-go="entry">${icon('pencil')} แก้ไขบันทึก</button>` : ''}<p class="sr-sub">ยืนยันข้อมูลเพื่อเก็บประวัติ ไม่ใช่การตรวจรับงานหรือส่ง LINE</p></footer>`;
  }
  function lineText() {
    const gaps = missing();
    return [
      local.viewed ? `[รุ่นทดลอง · ${local.viewed.docId} · ยังไม่ได้ส่ง]` : '[รุ่นทดลอง · ฉบับร่าง · ยังไม่ได้ส่ง]',
      `รายงานหน้างาน ${prettyDate(state.date)}`,
      ...(local.viewed ? [`ยืนยันและเก็บฉบับเมื่อ: ${reportTimeWithZone(local.viewed.confirmedAt)}`] : []),
      state.project, `สถานที่: ${state.site}`,
      `ผู้บันทึก: ${state.reporter || 'ยังไม่ระบุ'}`,
      `วันนี้ ${taskDefs().length} งาน · ${totalPhotos()} รูป${taskDefs().some(def => state.tasks[def.id].photos.some(photo => photo.sample)) ? ' (มีภาพจำลอง)' : ''}`,
      state.issues === 'yes' ? `ติดตาม: ${state.issueType || 'ยังไม่ระบุเรื่อง'} · ${urgencyLabel()}` : state.issues === 'no' ? 'ติดตาม: ผู้บันทึกระบุว่าไม่มีเรื่องแจ้ง' : 'ติดตาม: ยังไม่ระบุ',
      gaps.length ? `ร่าง: ยังขาดข้อมูล ${gaps.length} จุด` : 'ข้อมูลครบ · ไม่ใช่ใบตรวจรับ',
      'รายละเอียดและรูปดูในไฟล์ PNG / PDF ที่แนบประกอบ'
    ].join('\n');
  }
  function invalidateExports() {
    state.dataVersion++;
    releasePrepared();
    const hadPrepared = Boolean(state.prepared);
    state.prepared = null; state.exportError = ''; state.copied = false; state.copyFallback = false;
    screen.querySelector('[data-prepared]')?.remove();
    if (hadPrepared) mark('ข้อมูลเปลี่ยนแล้ว เตรียมไฟล์ใหม่ก่อนใช้');
    scheduleSave();
  }
  function documentSnapshot() {
    if (unsupportedTasks().length) throw new Error('มีรายการงานที่รุ่นนี้ยังไม่รองรับ กรุณาสำรองข้อมูลและเปิดด้วยรุ่นที่รองรับก่อนส่งรายงาน');
    const generatedAt = new Date().toISOString();
    const confirmedAt = local.viewed?.confirmedAt || '';
    return {
      title: 'รายงานความก้าวหน้าหน้างาน', docId: local.viewed?.docId || `SR-${(state.date || 'UNDATED').replaceAll('-', '')}-${local.draft?.id.slice(-6) || 'NEW'}-DRAFT`,
      project: state.project.trim(), site: state.site.trim(), date: state.date, dateLabel: prettyDate(state.date),
      confirmedAt, generatedAt, reportTimestampLabel: confirmedAt ? 'ยืนยันและเก็บฉบับเมื่อ' : 'จัดทำไฟล์เมื่อ', reportTimestampValue: confirmedAt || generatedAt, reportTimestampText: reportTimeWithZone(confirmedAt || generatedAt), reportTimeZone: deviceTimeZone,
      reporter: state.reporter.trim(), recipient: state.recipient.trim(), weather: state.weather,
      workersLabel: state.workerError ? 'จำนวนคนไม่ถูกต้อง / ต้องแก้ไข' : state.workers === '' ? 'ยังไม่ระบุ' : `${state.workers} คน`,
      resources: state.resources, tomorrow: state.tomorrow, missing: missing(),
      fullReport: Full.normalize(state.fullReport),
      issue: { state: state.issues, taskLabel: issueTaskLabel(), type: state.issueType, urgencyLabel: urgencyLabel(), owner: state.owner, dueLabel: prettyDate(state.due), note: state.issueNote },
      tasks: taskDefs().map(def => { const task = state.tasks[def.id]; return { id: def.id, title: def.title, zone: zoneLabel(task), status: task.status, statusLabel: statusLabel(task.status), note: task.note, photos: task.photos.map(photo => ({ ...photo })) }; })
    };
  }
  function exportView() {
    const ready = state.prepared?.version === state.dataVersion ? state.prepared : null;
    const page = ready?.pages[state.exportPage];
    const filename = ready?.snapshot.docId || 'site-report-demo';
    return `<main class="sr-main">
      <div class="sr-heading"><p class="sr-eyebrow">${local.viewed ? esc(local.viewed.docId) : 'ร่างปัจจุบัน ยังไม่ยืนยันฉบับ'}</p><h1>ส่งรายงาน</h1><p class="sr-sub">เลือกไฟล์สำหรับทีมงานหรือลูกค้า แล้วแนบข้อความสั้นใน LINE</p></div>
      <p class="sr-photo-hint" data-renderer-version="${esc(globalThis.SiteReportDocuments?.version || '')}">ตัวจัดหน้า PNG / A4: v${esc(globalThis.SiteReportDocuments?.version || 'ไม่ทราบรุ่น')}${globalThis.SiteReportDocuments?.version === '1.5.0' ? ' · รายงานเต็มรูปแบบ / ตารางและรูป 2×2 · ข้อมูลยาวต่อหน้าอัตโนมัติ' : ' · ตรวจตัวอย่างทุกหน้าก่อนส่ง'}</p>
      <fieldset class="sr-format-group"><legend>เลือก 1 ใน 2 รูปแบบไฟล์</legend>
        <label class="sr-format-option"><input type="radio" name="sr-export-format" data-export-format value="png" ${state.exportFormat === 'png' ? 'checked' : ''}><span><strong>ภาพรายงาน PNG</strong><small>ดาวน์โหลดครบทุกหน้าเป็น ZIP หรือเลือกบันทึกทีละหน้า</small></span></label>
        <label class="sr-format-option"><input type="radio" name="sr-export-format" data-export-format value="pdf" ${state.exportFormat === 'pdf' ? 'checked' : ''}><span><strong>เอกสาร A4 (PDF)</strong><small>หัวเอกสารครบ · รวมทุกหน้าในไฟล์เดียว</small></span></label>
      </fieldset>
      <label class="sr-field">เรียน / ส่งถึง <small>ไม่บังคับ</small><input data-field="recipient" value="${esc(state.recipient)}" maxlength="80" placeholder="เช่น เจ้าของโครงการ / ผู้จัดการโครงการ"><small>ใช้เป็นชื่อบนเอกสาร ไม่ใช่การเลือกผู้รับ LINE</small></label>
      <p class="sr-sub">${taskDefs().length} งาน · ${totalPhotos()} รูป · ผู้บันทึก ${esc(state.reporter || 'ยังไม่ระบุ')}</p>
      ${missing().length ? `<div class="sr-alert">ยังขาดข้อมูล ${missing().length} จุด ไฟล์จะระบุเป็นร่างตัวอย่าง <button type="button" class="sr-link-button" data-go="report">ตรวจข้อมูลที่ขาด</button></div>` : ''}
      <button type="button" class="sr-button sr-primary sr-full sr-export-generate" data-action="generate" ${state.exportBusy || anyImport() ? 'disabled' : ''}>${icon('file-output')} ${state.exportBusy ? 'กำลังจัดหน้าและเตรียมรูป…' : anyImport() ? 'รออ่านรูปให้เสร็จ' : ready ? 'จัดหน้าใหม่จากข้อมูลปัจจุบัน' : `เตรียม${state.exportFormat === 'png' ? 'ภาพ PNG' : 'เอกสาร A4'}`}</button>
      <p class="sr-photo-hint" data-export-progress role="status" aria-live="polite" ${state.exportBusy ? '' : 'hidden'}>${esc(state.exportProgress)}</p>
      <p class="sr-photo-hint">รายงานรูปจำนวนมากจะจัดหน้าทีละหน้า หากไฟล์รวมใหญ่เกินขีดจำกัดจะแจ้งให้แบ่งรายงาน โดยไม่ตัดรูปหรือเปลี่ยนข้อมูลที่บันทึกไว้</p>
      ${state.exportError ? `<p class="sr-error" role="alert">${esc(state.exportError)}</p>` : ''}
      ${ready && page ? `<section class="sr-section" data-prepared><div class="sr-title-row"><h2>ตรวจไฟล์ก่อนใช้</h2><span class="sr-count">${ready.pages.length} หน้า</span></div>
        <div class="sr-export-paging"><button type="button" class="sr-button" data-export-direction="-1" aria-label="หน้าเอกสารก่อนหน้า" ${state.exportPage === 0 ? 'disabled' : ''}>${icon('chevron-left')}</button><span class="sr-count">หน้า ${state.exportPage + 1} / ${ready.pages.length}</span><button type="button" class="sr-button" data-export-direction="1" aria-label="หน้าเอกสารถัดไป" ${state.exportPage === ready.pages.length - 1 ? 'disabled' : ''}>${icon('chevron-right')}</button></div>
        <img class="sr-document-preview" src="${page.pngDataUrl}" alt="ตัวอย่างรายงาน A4 หน้า ${state.exportPage + 1} จาก ${ready.pages.length} หน้า โครงการ ${esc(ready.snapshot.project)}" data-document-preview>
        <div class="sr-download-actions">${state.exportFormat === 'png' && ready.pages.length > 1 && ready.zipUrl ? `<a class="sr-button sr-primary sr-full" data-download-all-png href="${ready.zipUrl}" download="${filename}-all-pages.zip">${icon('download')} PNG ครบ ${ready.pages.length} หน้า (.zip)</a>` : ''}
        <a class="sr-button ${state.exportFormat === 'png' && ready.zipUrl ? '' : 'sr-primary'} sr-full" data-download-document href="${state.exportFormat === 'png' ? page.pngDataUrl : ready.pdfUrl}" download="${filename}${state.exportFormat === 'png' ? '-p' + String(state.exportPage + 1).padStart(2, '0') + '.png' : '.pdf'}">${icon('download')} ${state.exportFormat === 'png' ? `บันทึกเฉพาะ PNG หน้า ${state.exportPage + 1}` : `บันทึก PDF ทั้ง ${ready.pages.length} หน้า`}</a></div>
        ${state.exportFormat === 'png' && ready.zipError ? `<p class="sr-error" role="alert">${esc(ready.zipError)} ยังบันทึก PNG ทีละหน้าหรือ PDF ครบทุกหน้าได้</p>` : ''}
        <p class="sr-photo-hint">${state.exportFormat === 'png' ? 'ZIP รวมภาพรายงานครบทุกหน้า: แตกไฟล์แล้วแนบภาพเรียงตามเลขหน้าใน LINE หากไม่สะดวกแตกไฟล์ให้เลือก PDF รวมทุกหน้า' : 'A4 แนวตั้ง 210 × 297 มม. · PDF แบบภาพ ข้อความยังค้นหาไม่ได้'}</p><p class="sr-photo-hint">ตรวจไฟล์ในโฟลเดอร์ดาวน์โหลดก่อนแนบส่ง รุ่นนี้ยังไม่ส่งไฟล์หรือข้อความให้ผู้รับอัตโนมัติ</p>
      </section>` : ''}
      <section class="sr-export-line"><h2>ข้อความประกอบใน LINE</h2><p class="sr-sub">เฉพาะข้อมูลเบื้องต้น รายละเอียดและรูปอยู่ในไฟล์</p><div class="sr-line-message">${esc(lineText())}</div><button type="button" class="sr-button sr-line-button sr-full sr-export-generate" data-action="line">${icon('message-circle')} เตรียมคัดลอกข้อความ LINE</button></section>
      <p class="sr-report-note">เอกสารทดลองเท่านั้น ไม่ใช่ใบตรวจรับหรือใบรับรองความปลอดภัย ไม่เผยแพร่ลิงก์และไม่ส่งข้อความจริง</p>
    </main><footer class="sr-footer"><button type="button" class="sr-button sr-quiet sr-full" data-go="report">${icon('arrow-left')} กลับไปตรวจรายงาน</button></footer>`;
  }
  async function generateDocuments() {
    if (state.exportBusy || anyImport() || local.busy) return;
    let version = state.dataVersion;
    state.exportBusy = true; state.exportProgress = 'กำลังบันทึกและตรวจข้อมูลรายงาน'; state.exportError = ''; render(true);
    try {
      if (!local.viewed && !(await flushSave())) { mark('บันทึกข้อมูลให้สำเร็จก่อนเตรียมไฟล์'); return; }
      version = state.dataVersion;
      const snapshot = documentSnapshot();
      if (!globalThis.SiteReportDocuments) throw new Error('ไม่พบตัวจัดหน้าเอกสาร');
      // Do not retain a second complete set of pages/ZIP/PDF during regeneration.
      releasePrepared(); state.prepared = null; render(true);
      const progress = message => {
        if (state.dataVersion !== version) return;
        state.exportProgress = message;
        const node = screen.querySelector('[data-export-progress]');
        if (node) { node.hidden = false; node.textContent = message; }
      };
      const result = await globalThis.SiteReportDocuments.render(snapshot, {
        shouldCancel: () => state.dataVersion !== version || anyImport(),
        onProgress: ({ phase, completed, total }) => progress(phase === 'photos' ? `กำลังจัดรูป ${completed} / ${total} รูป` : `กำลังเตรียมหน้า ${completed} / ${total} หน้า`)
      });
      if (state.dataVersion !== version || anyImport()) { mark('ข้อมูลเปลี่ยนระหว่างจัดหน้า กรุณาเตรียมไฟล์ใหม่'); return; }
      const pdfBlob = globalThis.SiteReportDocuments.pdf(result.pages);
      progress(`รวมไฟล์รายงาน ${result.pages.length} หน้า`);
      let zipBlob = null; let zipError = '';
      if (result.pages.length > 1) {
        try {
          if (!globalThis.SiteReportArchive) throw new Error('ไม่พบตัวรวมภาพ');
          zipBlob = await globalThis.SiteReportArchive.pngZip(result.pages, snapshot.docId);
        } catch (error) { zipError = `รวม ZIP ไม่สำเร็จ: ${error.message || 'กรุณาลองใหม่'}`; }
      }
      if (state.dataVersion !== version || anyImport()) { mark('ข้อมูลเปลี่ยนระหว่างเตรียมไฟล์ กรุณาเตรียมไฟล์ใหม่'); return; }
      releasePrepared();
      state.prepared = { ...result, snapshot, version, pdfBlob, pdfUrl: URL.createObjectURL(pdfBlob), zipBlob, zipUrl: zipBlob ? URL.createObjectURL(zipBlob) : '', zipError };
      state.exportPage = 0;
      mark(`เตรียมรายงานตัวอย่าง ${result.pages.length} หน้าแล้ว ตรวจทุกหน้าก่อนใช้ · ยังไม่ได้ส่ง`);
    } catch (error) {
      if (state.dataVersion === version) state.exportError = `ยังเตรียมไฟล์ไม่ได้: ${error.message || 'ตรวจรูปและลองอีกครั้ง'} ไม่มีการข้ามรูปที่อ่านไม่สำเร็จ`;
    } finally { state.exportBusy = false; state.exportProgress = ''; render(true); }
  }
  function line() {
    return `<main class="sr-main"><div class="sr-heading"><p class="sr-eyebrow">ตรวจข้อความก่อนแชร์</p><h1>สรุปให้ทีมใน LINE</h1><p class="sr-sub">ข้อความสั้นในแชต ส่วนรายละเอียดและรูปอยู่ในรายงาน</p></div>
      <div class="sr-line-message">${esc(lineText())}</div>
      <p class="sr-report-note">ต้นแบบยังไม่สร้างลิงก์สาธารณะ ไม่เลือกกลุ่ม LINE และไม่ส่งข้อความจริง</p>
      ${state.copyFallback ? `<label class="sr-field">เลือกข้อความเพื่อคัดลอก<textarea class="sr-message-select" readonly data-copy-source>${esc(lineText())}</textarea><small>เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกอัตโนมัติ กดค้างหรือ Ctrl+C เพื่อคัดลอก</small></label>` : ''}
    </main><footer class="sr-footer"><button type="button" class="sr-button sr-primary sr-full" data-action="copy">${icon('copy')} ${state.copied ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}</button><button type="button" class="sr-button sr-quiet sr-full" data-go="export">${icon('arrow-left')} กลับไปเลือกไฟล์รายงาน</button><p class="sr-sub">คัดลอกไม่เท่ากับส่ง ผู้ใช้เป็นผู้เลือกปลายทางเอง</p></footer>`;
  }
  function photoView() {
    const photo = activePhoto();
    if (!photo) return `<main class="sr-main"><h1>ไม่พบรูปนี้แล้ว</h1><p class="sr-sub">รูปอาจถูกนำออกจากรายงาน</p></main><footer class="sr-footer"><button type="button" class="sr-button sr-full" data-action="photo-back">กลับไปรายการ</button></footer>`;
    const task = state.tasks[state.viewing.task];
    const index = task.photos.findIndex(item => item.id === photo.id);
    return `<main class="sr-main">
      <div class="sr-view-top"><button type="button" class="sr-button sr-quiet" data-action="photo-back">${icon('arrow-left')} กลับ</button><div class="sr-view-paging"><button type="button" class="sr-button" data-photo-direction="-1" ${index === 0 ? 'disabled' : ''} aria-label="รูปก่อนหน้า">${icon('chevron-left')}</button><span class="sr-count">${index + 1} / ${task.photos.length}</span><button type="button" class="sr-button" data-photo-direction="1" ${index === task.photos.length - 1 ? 'disabled' : ''} aria-label="รูปถัดไป">${icon('chevron-right')}</button></div></div>
      <p class="sr-eyebrow">รูปประกอบงาน · ดูเต็มภาพ</p><h1>${esc(photo.taskTitle)}</h1><p class="sr-sub">${esc(photo.zone || 'ยังไม่ระบุจุดทำงาน')}</p>
      ${photoSurface(photo, true)}
      <p class="sr-photo-hint">${photo.sample ? 'ภาพจำลอง ไม่ใช่หลักฐานจริง' : `${photo.width || '?'} × ${photo.height || '?'} px · นำเข้า ${esc(photo.importedAt)}`} · ภาพสำหรับรายงาน ไม่ครอป เก็บไฟล์ต้นฉบับแยกไว้</p>
      <fieldset class="sr-phase-group"><legend>ภาพช่วงไหน? <span class="sr-count">ไม่บังคับ</span></legend><div class="sr-phase-options">${['ก่อนทำ', 'ระหว่างทำ', 'หลังทำ', 'ปัญหา'].map(phase => `<label class="sr-phase-option"><input type="radio" name="sr-photo-phase" data-photo-field="phase" value="${phase}" ${photo.phase === phase ? 'checked' : ''}>${phase}</label>`).join('')}</div>${photo.phase ? '<button type="button" class="sr-link-button" data-action="clear-photo-phase">ล้างป้ายช่วงงาน</button>' : ''}</fieldset>
      <label class="sr-field">คำบรรยายภาพ <small>ไม่บังคับ</small><textarea data-photo-field="caption" maxlength="300" placeholder="เช่น ผนังด้านหน้าชั้น 1 ก่อเสร็จช่วงเช้า">${esc(photo.caption || '')}</textarea></label>
      <p class="sr-photo-hint">ป้ายและคำบรรยายใช้ในรายงาน ไม่ใช่การตรวจรับงาน</p>
      ${FullUI.photo(fullData(), photo.id)}
      <section class="sr-section"><div class="sr-title-row"><h2>เปลี่ยนภาพนี้</h2>${state.imports[task.id] ? '<span class="sr-count">กำลังอ่านรูป…</span>' : ''}</div><div class="sr-capture-actions">
        <button type="button" class="sr-button" data-replace-photo="${photo.id}" data-task="${task.id}" data-source="camera" ${state.imports[task.id] ? 'disabled' : ''}>${icon('camera')} ถ่ายใหม่</button><button type="button" class="sr-button" data-replace-photo="${photo.id}" data-task="${task.id}" data-source="gallery" ${state.imports[task.id] ? 'disabled' : ''}>${icon('images')} เลือกใหม่</button>
      </div>
      <input hidden type="file" accept="${photoAccept}" capture="environment" data-files="${task.id}" data-input-source="camera" data-replace-id="${photo.id}" aria-label="ถ่ายรูปแทนภาพเดิม">
      <input hidden type="file" accept="${photoAccept}" data-files="${task.id}" data-input-source="gallery" data-replace-id="${photo.id}" aria-label="เลือกรูปแทนภาพเดิม">
      <p class="sr-photo-hint">ภาพใหม่อ่านได้สำเร็จจึงแทนภาพเดิม คำบรรยายและป้ายคงอยู่ แต่วันเวลาถ่าย ผู้ถ่าย และสภาพที่กรอกเองจะล้างให้ระบุใหม่สำหรับภาพใหม่</p>
      ${photoHelp()}
      <button class="sr-photo-remove" type="button" data-remove-photo="${photo.id}" data-task="${task.id}">${icon('trash-2')} ลบรูปนี้ออกจากรายงาน</button></section>
      <p class="sr-photo-storage">รูปเก็บพร้อมร่างในเบราว์เซอร์นี้เมื่อบันทึกสำเร็จ ยังไม่อัปโหลดคลาวด์ และไม่ยืนยัน GPS หรือเวลาถ่ายจริง</p>
    </main><footer class="sr-footer"><button type="button" class="sr-button sr-primary sr-full" data-action="photo-back">${icon('check')} ${local.viewed ? 'กลับ' : 'ใช้รูปนี้ · กลับ'}${state.photoReturn === 'report' ? 'รายงาน' : 'หน้างาน'}</button><p class="sr-sub">${local.viewed ? 'รูปจากฉบับยืนยัน แก้ทับไม่ได้' : 'รอแถบด้านบนแสดง “บันทึกในเครื่องแล้ว” ก่อนปิดหน้า'}</p></footer>`;
  }
  function openPhoto(taskId, photoId) {
    const photo = state.tasks[taskId]?.photos.find(item => item.id === photoId);
    if (!photo) return;
    if (state.page !== 'photo') state.photoReturn = state.page === 'report' ? 'report' : 'entry';
    state.viewing = { task: taskId, id: photoId }; state.page = 'photo';
    render(); screen.querySelector('[data-action="photo-back"]')?.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function closePhoto() {
    const viewed = state.viewing;
    state.page = state.photoReturn; state.viewing = null; render();
    const returnButton = viewed && screen.querySelector(`[data-open-photo="${viewed.id}"][data-task="${viewed.task}"]`);
    const fallback = viewed && screen.querySelector(`[data-camera="${viewed.task}"]`);
    (returnButton || fallback || root.querySelector(`.sr-nav [data-go="${activeStep()}"]`))?.focus({ preventScroll: true });
    (returnButton || fallback)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }
  function removePhoto(taskId, photoId) {
    const task = state.tasks[taskId];
    const index = task?.photos.findIndex(photo => photo.id === photoId) ?? -1;
    if (index < 0) return;
    invalidateExports();
    state.removedPhoto = { task: taskId, index, photo: task.photos[index], detail: state.fullReport?.photoDetails[photoId] };
    if (state.fullReport) delete state.fullReport.photoDetails[photoId];
    task.photos.splice(index, 1);
    if (state.page === 'photo') closePhoto(); else { render(); screen.querySelector(`[data-camera="${taskId}"]`)?.focus({ preventScroll: true }); }
    mark('นำรูปออกจากรายงานตัวอย่างแล้ว กดคืนรูปที่ลบได้');
  }
  function render(restoreFocus = false) {
    const current = document.activeElement;
    const focusInfo = restoreFocus && root.contains(current) ? {
      field: current.getAttribute('data-field'), taskField: current.getAttribute('data-task-field'),
      fullField: current.getAttribute('data-full-field'),
      task: current.getAttribute('data-task'), toggle: current.getAttribute('data-toggle-task'),
      value: current.value, action: current.getAttribute('data-action'), photoField: current.getAttribute('data-photo-field'), exportFormat: current.hasAttribute('data-export-format')
    } : null;
    screen.innerHTML = state.page === 'setup' ? setup() : state.page === 'entry' ? entry() : state.page === 'report' ? report() : state.page === 'photo' ? photoView() : state.page === 'export' ? exportView() : state.page === 'history' ? historyView() : line();
    screen.dataset.page = state.page;
    screen.querySelectorAll('details[data-full-section]').forEach(node => { node.open = fullOpen.has(node.dataset.fullSection); });
    if (state.page === 'setup' && local.projectMode !== 'list') {
      screen.querySelector('.sr-main')?.insertAdjacentHTML('beforeend', FullUI.company(fullData()));
      const company = screen.querySelector('[data-full-section="company"]');
      if (company) company.open = fullOpen.has('company');
    }
    if (unsupportedTasks().length) {
      screen.insertAdjacentHTML('afterbegin', '<div class="sr-alert" role="alert">ข้อมูลมีรายการงานที่รุ่นนี้ยังไม่รองรับ สรุปด้านล่างอาจไม่ครบ หยุดการส่งรายงานไว้ก่อน กรุณาสำรองข้อมูลจากประวัติและเปิดด้วยรุ่นที่รองรับ ข้อมูลเดิมยังไม่ได้ถูกตัดทิ้ง</div>');
      screen.querySelectorAll('[data-action="confirm-report"],[data-action="generate"],[data-action="copy"]').forEach(node => { node.disabled = true; });
    }
    if (local.viewed && state.page !== 'history') screen.insertAdjacentHTML('afterbegin', `<div class="sr-archive-bar">ยืนยันและเก็บฉบับเมื่อ ${esc(reportTimeWithZone(local.viewed.confirmedAt))} · ข้อมูลและรูปฉบับนี้แก้ทับไม่ได้</div>`);
    root.querySelector('.sr-undo-bar').innerHTML = state.removedPhoto ? '<button type="button" class="sr-link-button" data-action="undo-photo">คืนรูปที่ลบล่าสุด</button>' : '';
    root.querySelectorAll('[data-go]').forEach(button => {
      if (button.closest('.sr-nav')) {
        const active = button.dataset.go === activeStep();
        if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
        button.disabled = button.dataset.go !== 'setup' && !state.entered;
      }
    });
    hydrate();
    if (local.viewed) screen.querySelectorAll('[data-field],[data-full-field],[data-full-logo],[data-full-action],[data-material-preset],[data-task-field],[data-photo-field],[data-toggle-task],[data-camera],[data-gallery],[data-sample],[data-remove-photo],[data-replace-photo],[data-action="clear-photo-phase"],[data-action="confirm-material-remove"],[data-action="cancel-material-remove"],[data-action="undo-material"]').forEach(node => { node.disabled = true; });
    if (local.booting || local.busy) root.querySelectorAll('input,select,textarea,button').forEach(node => { node.disabled = true; });
    localStatus();
    root.inert = bridge.pending || bridge.approved;
    screen.querySelector('[data-field="workers"]')?.setCustomValidity(state.workerError);
    if (focusInfo) {
      const candidate = Array.from(screen.querySelectorAll('input,select,button,textarea')).find(element =>
        focusInfo.exportFormat ? element.hasAttribute('data-export-format') && element.value === focusInfo.value :
        focusInfo.fullField ? element.dataset.fullField === focusInfo.fullField :
        focusInfo.toggle ? element.dataset.toggleTask === focusInfo.toggle :
        focusInfo.photoField ? element.dataset.photoField === focusInfo.photoField && (element.type !== 'radio' || element.value === focusInfo.value) :
        focusInfo.taskField ? element.dataset.taskField === focusInfo.taskField && element.dataset.task === focusInfo.task :
        focusInfo.field ? element.dataset.field === focusInfo.field && (element.type !== 'radio' || element.value === focusInfo.value) :
        focusInfo.action ? element.dataset.action === focusInfo.action : false);
      candidate?.focus({ preventScroll: true });
    }
  }
  function navigate(page) {
    if (local.booting || local.busy) return;
    if (local.viewed && page === 'entry') {
      mark('ฉบับยืนยันแก้ทับไม่ได้ ใช้ปุ่ม “แก้ไขเป็นฉบับใหม่” หากต้องการปรับข้อมูล');
      return;
    }
    if (local.viewed && page === 'setup') {
      local.viewed = null; local.draft = null; local.pendingSeriesId = ''; local.dirty = false; local.error = ''; local.code = '';
      loadPayload({ ...emptyPayload, date: currentLocalDate() });
      local.projectMode = projectFolders().length ? 'list' : 'create';
    }
    if (page !== 'setup' && (!state.project.trim() || !state.site.trim())) {
      state.error = 'กรอกชื่อโครงการและสถานที่ก่อนเริ่มรายงาน'; state.page = 'setup'; render();
      screen.querySelector(!state.project.trim() ? '#sr-project' : '#sr-site')?.focus({ preventScroll: true });
      return;
    }
    if (page !== 'setup') state.entered = true;
    state.error = ''; state.page = page; state.copied = false; state.copyFallback = false; state.viewing = null;
    toast.textContent = ''; render();
    root.querySelector(`.sr-nav [data-go="${activeStep()}"]`)?.focus({ preventScroll: true });
    root.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  function syncPhotoZones(task) { task.photos.forEach(photo => { photo.zone = zoneLabel(task); }); }
  function updateFullField(target) {
    const parts = target.dataset.fullField.split('.');
    if (parts.some(key => ['__proto__', 'constructor', 'prototype'].includes(key))) return;
    const data = state.fullReport || Full.defaults();
    if (parts[0] === 'progress' && catalogIds.has(parts[1]) && !data.progress[parts[1]]) data.progress[parts[1]] = {planned:'', actual:''};
    if (parts[0] === 'photoDetails' && activePhoto()?.id === Number(parts[1]) && !data.photoDetails[parts[1]]) data.photoDetails[parts[1]] = {capturedAt:'', photographer:'', condition:''};
    let node = data;
    for (const key of parts.slice(0,-1)) { if (!Object.hasOwn(node,key)) return; node = node[key]; }
    const key = parts.at(-1); if (!Object.hasOwn(node,key) || typeof node[key] !== 'string') return;
    node[key] = target.value; state.fullReport = data;
    target.setCustomValidity('');
    if (target.dataset.fullNumber) {
      const kind=target.dataset.fullNumber, raw=target.value;
      const valid=raw==='' || ((kind==='count'?/^(0|[1-9]\d*)$/:/^(0|[1-9]\d*)(\.\d+)?$/).test(raw) && Number(raw)<=(kind==='count'?9999:kind==='percent'?100:1e9));
      target.setCustomValidity(valid?'':`กรอก${kind==='count'?'จำนวนเต็ม':'ตัวเลข'} 0–${kind==='count'?9999:kind==='percent'?100:'1,000,000,000'} หรือเว้นว่าง`);
      target.setAttribute('aria-invalid', String(!valid));
    }
    const total = screen.querySelector('[data-labor-total]'); if (total) total.textContent = FullUI.laborSummary(data,state.workers);
    refreshCompactSummary(target.closest('details[data-full-section]'));
    invalidateExports();
  }
  root.addEventListener('input', event => {
    const target = event.target;
    if (local.booting || local.viewed || local.busy) return;
    if (target.dataset.fullField) { updateFullField(target); return; }
    if (target.dataset.field || target.dataset.taskField || target.dataset.photoField) invalidateExports();
    if (target.dataset.photoField === 'caption') {
      const photo = activePhoto(); if (photo) photo.caption = target.value;
      return;
    }
    if (target.dataset.field && target.type !== 'radio' && target.tagName !== 'SELECT') {
      let value = target.value;
      if (target.dataset.field === 'workers') {
        const count = Number(value);
        state.workerError = (value !== '' && (!Number.isInteger(count) || count < 0 || count > 9999)) || target.validity.badInput ? 'จำนวนคนต้องเป็นจำนวนเต็ม 0–9999' : '';
        target.setCustomValidity(state.workerError); state.workers = value;
        target.setAttribute('aria-invalid', String(Boolean(state.workerError)));
        const errorNode = screen.querySelector('#sr-worker-error');
        if (errorNode) { errorNode.textContent = state.workerError; errorNode.hidden = !state.workerError; }
        return;
      }
      target.setCustomValidity(''); state[target.dataset.field] = value;
    }
    if (target.dataset.taskField && target.tagName !== 'SELECT') {
      const task = state.tasks[target.dataset.task];
      if (task) { task[target.dataset.taskField] = target.value; syncPhotoZones(task); refreshCompactSummary(target.closest('details[data-full-section]')); }
    }
  });
  root.addEventListener('change', event => {
    const target = event.target;
    if (local.booting || local.busy || bridge.pending || bridge.approved) { if (target.type === 'file') target.value = ''; return; }
    if (target.hasAttribute('data-export-format')) { state.exportFormat = target.value; render(true); return; }
    if (target.hasAttribute('data-backup-file')) { const file = target.files?.[0]; target.value = ''; void importBackupFile(file).catch(error => { mark(`นำเข้าไม่ได้: ${error.message} ไม่ได้เขียนทับข้อมูลเดิม`); }); return; }
    if (local.booting || local.viewed || local.busy) return;
    if (target.hasAttribute('data-full-logo')) { const file=target.files?.[0]; target.value=''; void importLogo(file); return; }
    if (target.dataset.materialPreset) {
      const preset = materialPreset(target.dataset.materialPreset);
      if (!preset) { render(true); return; }
      const data = fullData(), rowId = `preset-${preset.id}`;
      if (target.checked) {
        if (data.materials.some(row => row.id === rowId)) return;
        const duplicate = data.materials.some(row => row.id !== rowId && String(row.name || '').trim() === preset.name);
        if (duplicate || data.materials.length >= 12) {
          render(true);
          mark(duplicate ? `มี ${preset.name} อยู่ในรายการแล้ว แก้ข้อมูลที่รายการเดิมได้เลย` : 'ครบ 12 รายการแล้ว นำรายการที่ไม่ใช้ออกก่อนเพิ่ม');
          return;
        }
        data.materials.push({ id: rowId, name: preset.name, quantity: '', unit: preset.unit, usage: 'ใช้งานวันนี้', status: '' });
        state.fullReport = data;
        state.pendingMaterialRemoval = null;
        fullOpen.add(`material-${rowId}`);
        invalidateExports(); render(true);
        screen.querySelector(`[data-material-row="${CSS.escape(rowId)}"] [data-full-field$=".quantity"]`)?.focus({ preventScroll: true });
        mark(`เลือก ${preset.name} แล้ว · กรอกจำนวนตามจริงหรือเว้นไว้หากยังไม่ทราบ`);
      } else requestMaterialRemoval(rowId);
      return;
    }
    if (target.dataset.fullField) { updateFullField(target); return; }
    if (target.dataset.toggleTask || target.dataset.photoField === 'phase' || (target.dataset.taskField && target.tagName === 'SELECT') || (target.dataset.field && (target.type === 'radio' || target.tagName === 'SELECT'))) invalidateExports();
    if (target.dataset.photoField === 'phase') { const photo = activePhoto(); if (photo) { photo.phase = target.value; render(true); } return; }
    if (target.dataset.toggleTask) {
      const id = target.dataset.toggleTask;
      if (!state.tasks[id]) state.tasks[id] = { id, selected: true, zone: '', customZone: '', status: '', note: '', photos: [] };
      state.tasks[id].selected = target.checked;
      if (target.checked) fullOpen.add(`work-${id}`); else fullOpen.delete(`work-${id}`);
      render(true);
      mark(target.checked ? 'เลือกงานแล้ว เลือกจุดและสถานะ แล้วแนบรูป' : 'นำงานออกจากรายงาน ข้อมูลเดิมยังอยู่หากติ๊กกลับ');
    } else if (target.dataset.taskField && target.tagName === 'SELECT') {
      const task = state.tasks[target.dataset.task]; task[target.dataset.taskField] = target.value;
      syncPhotoZones(task); render(true);
      if (target.dataset.taskField === 'status' && target.value === 'blocked') mark('มีงานติดขัด ระบุเรื่องติดตามด้านล่างด้วย');
    } else if (target.dataset.field && (target.type === 'radio' || target.tagName === 'SELECT')) {
      state[target.dataset.field] = target.value; render(true);
    }
    if (target.dataset.files) void importPhotos(target);
  });
  root.addEventListener('toggle', event => { if (!local.busy && event.target.hasAttribute?.('data-extra')) state.extraOpen = event.target.open; }, true);
  root.addEventListener('toggle', event => { const node=event.target; if (node.dataset?.fullSection && screen.contains(node)) { if (node.open) fullOpen.add(node.dataset.fullSection); else fullOpen.delete(node.dataset.fullSection); refreshCompactSummary(node); } }, true);
  root.addEventListener('keydown', event => { if (!local.busy && event.key === 'Escape' && state.page === 'photo') { event.preventDefault(); closePhoto(); } });
  root.addEventListener('cancel', event => { if (event.target.dataset.files) mark('ยกเลิกการเลือกรูป รูปเดิมยังอยู่ครบ'); }, true);
  function readPhoto(file) {
    if (!PhotoInput) return Promise.reject(new Error('เปิดตัวอ่านรูปไม่ได้ กรุณาเปิดหน้าใหม่ รูปเดิมยังอยู่'));
    return PhotoInput.read(file);
  }
  async function importLogo(file) {
    if (!file || state.imports.logo || local.viewed || bridge.pending || bridge.approved) return;
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size>1024*1024) { mark('โลโก้ต้องเป็น JPG / PNG / WebP ไม่เกิน 1 MB โลโก้เดิมยังอยู่'); return; }
    state.imports.logo=true; localStatus();
    try {
      // Read the original logo without silently changing or cropping its content.
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onerror=()=>reject(new Error('อ่านไฟล์ไม่ได้'));reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);});
      const img=new Image();
      await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{img.onload=null;img.onerror=null;img.src='';reject(new Error('อ่านโลโก้นานเกินไป กรุณาลองใหม่'));},15000);
        img.onerror=()=>{clearTimeout(timer);reject(new Error('ไม่สามารถอ่านภาพโลโก้ได้'));};
        img.onload=()=>{clearTimeout(timer);resolve();};img.src=src;
      });
      const data=structuredClone(fullData()); data.logo={src,width:img.naturalWidth,height:img.naturalHeight}; Full.validate(data);
      state.fullReport=data; invalidateExports(); mark('แนบโลโก้ในร่างนี้แล้ว ยังไม่ได้อัปโหลด');
    } catch(error) { mark(`แนบโลโก้ไม่ได้: ${error.message} · โลโก้เดิมยังอยู่`); }
    finally { state.imports.logo=false; render(true); }
  }
  async function importPhotos(input) {
    if (local.booting || local.busy || bridge.pending || bridge.approved || local.viewed) { input.value = ''; return; }
    const id = input.dataset.files;
    const task = state.tasks[id];
    const def = catalog.find(item => item.id === id);
    const files = Array.from(input.files || []);
    const replaceId = Number(input.dataset.replaceId) || null;
    const inputSource = input.dataset.inputSource;
    input.value = '';
    if (!files.length || !task || state.imports[id]) return;
    invalidateExports();
    state.imports[id] = true;
    render(true); mark(`กำลังอ่าน ${files.length} รูปสำหรับ${def.title} · ยังไม่อัปโหลด`);
    let added = 0; let rejected = 0;
    const reasons = new Map();
    const rejectFile = message => { rejected++; reasons.set(message, (reasons.get(message) || 0) + 1); };
    for (const file of files) {
      if ((!replaceId && task.photos.length >= 6) || (replaceId && added > 0)) { rejectFile('งานหนึ่งแนบได้ไม่เกิน 6 รูป และเปลี่ยนได้ครั้งละ 1 รูป'); continue; }
      try {
        const decoded = await readPhoto(file);
        const values = { ...decoded, sample: false, taskTitle: def.title, zone: zoneLabel(task), importedAt: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }), importedOn: new Date().toISOString(), inputSource };
        if (replaceId) {
          const target = task.photos.find(photo => photo.id === replaceId);
          if (!target) { rejectFile('ไม่พบภาพเดิมที่ต้องการเปลี่ยน'); continue; }
          Object.assign(target, values);
          if (state.fullReport) delete state.fullReport.photoDetails[replaceId];
        } else {
          if (task.photos.length >= 6) { rejectFile('งานหนึ่งแนบได้ไม่เกิน 6 รูป'); continue; }
          task.photos.push({ id: state.nextPhoto++, caption: '', phase: '', ...values });
        }
        added++;
        invalidateExports();
      } catch (error) { rejectFile(error.message || 'อ่านภาพไม่ได้ กรุณาเลือกภาพใหม่'); }
    }
    state.imports[id] = false;
    render(true);
    if (!root.contains(document.activeElement)) (screen.querySelector('[data-action="photo-back"]') || screen.querySelector(`[data-camera="${id}"]:not(:disabled)`) || screen.querySelector(`[data-open-photo][data-task="${id}"]`) || root.querySelector(`.sr-nav [data-go="${activeStep()}"]`))?.focus({ preventScroll: true });
    mark(`${replaceId ? 'เปลี่ยน' : 'แนบ'} ${added} รูปในตัวอย่างนี้${rejected ? ` · ข้าม ${rejected} ไฟล์: ${[...reasons].map(([message, count]) => `${count} ไฟล์: ${message}`).join(' · ')}` : ' · ยังไม่อัปโหลดบนเว็บ'}${replaceId && !added ? ' · ไม่ได้เขียนทับภาพเดิม' : replaceId ? ' · ระบุวันเวลาถ่าย ผู้ถ่าย และสภาพของภาพใหม่อีกครั้ง' : ''}`);
  }
  root.addEventListener('click', async event => {
    const button = event.target.closest('button'); if (!button || !root.contains(button) || button.disabled) return;
    if (local.booting || local.busy) return;
    const action = button.dataset.action;
    if (button.dataset.fullAction) {
      if (local.viewed || anyImport() || state.exportBusy) return;
      const data=state.fullReport || Full.defaults(), list=button.dataset.fullList;
      if (button.dataset.fullAction==='remove-logo') data.logo=null;
      else if (['followups','materials'].includes(list)) {
        if (button.dataset.fullAction==='add-row' && data[list].length<12) {
          const row=list==='followups'?{id:crypto.randomUUID(),title:'',responsible:'',due:'',priority:'',status:''}:{id:crypto.randomUUID(),name:'',quantity:'',unit:'',usage:'',status:''};
          data[list].push(row); fullOpen.add(`${list==='followups'?'followup':'material'}-${row.id}`);
        } else if (button.dataset.fullAction==='remove-row' && list==='materials') { requestMaterialRemoval(button.dataset.rowId); return; }
        else if (button.dataset.fullAction==='remove-row') data[list]=data[list].filter(row=>row.id!==button.dataset.rowId);
      } else return;
      state.fullReport=data; invalidateExports(); render();
      const focusSection=list==='followups'?`followup-${data.followups.at(-1)?.id}`:list==='materials'?`material-${data.materials.at(-1)?.id}`:'company';
      screen.querySelector(`[data-full-section="${CSS.escape(focusSection)}"] input`)?.focus({preventScroll:true}); return;
    }
    try {
      if (action === 'confirm-material-remove') {
        if (!local.viewed && state.pendingMaterialRemoval) removeMaterial(state.pendingMaterialRemoval);
        return;
      }
      if (action === 'cancel-material-remove') {
        if (local.viewed) return;
        state.pendingMaterialRemoval = null; render(true);
        screen.querySelector('[data-sheet-section="materials"] input')?.focus({ preventScroll: true });
        mark('เก็บรายการและข้อมูลเดิมไว้แล้ว'); return;
      }
      if (action === 'undo-material') {
        if (local.viewed || !state.removedMaterial) return;
        const data = fullData(), removed = state.removedMaterial;
        if (data.materials.length >= 12 || data.materials.some(row => row.id === removed.row.id)) {
          render(true); mark('ยังคืนรายการไม่ได้ เพราะครบ 12 รายการหรือมีรายการเดิมอยู่ · รายการที่รอคืนยังเก็บไว้'); return;
        }
        data.materials.splice(Math.min(removed.index, data.materials.length), 0, structuredClone(removed.row));
        state.fullReport = data; state.removedMaterial = null; state.pendingMaterialRemoval = null; fullOpen.add(`material-${removed.row.id}`);
        invalidateExports(); render(true);
        screen.querySelector(`[data-material-row="${CSS.escape(removed.row.id)}"] input`)?.focus({ preventScroll: true });
        mark(`คืน ${removed.row.name || 'วัสดุ / เครื่องจักร'} แล้ว`); return;
      }
      if (button.dataset.projectToday) { await startProjectToday(button.dataset.projectToday); return; }
      if (button.dataset.projectResume) { await resumeProject(button.dataset.projectResume); return; }
      if (button.dataset.projectEdit) { await resumeProject(button.dataset.projectEdit, true); return; }
      if (button.dataset.projectHistory) { await historyPage(button.dataset.projectHistory); return; }
      if (action === 'projects') { await projectsPage(); return; }
      if (action === 'edit-current-project') {
        if (local.viewed) { mark('ฉบับยืนยันแก้ทับไม่ได้ กลับแฟ้มแล้วเริ่มฉบับใหม่ก่อนแก้ข้อมูล'); return; }
        if (!local.draft) { mark('ยังไม่มีร่างสำหรับแก้ข้อมูลแฟ้ม'); return; }
        local.projectMode = 'edit'; state.page = 'setup'; render(); root.scrollIntoView({ block: 'start' }); return;
      }
      if (action === 'history') { await historyPage(); return; }
      if (action === 'save-now' || action === 'retry-save') { if (local.code !== 'CONFLICT') { bridge.error = ''; local.code = ''; local.error = ''; await flushSave(); } return; }
      if (action === 'save-copy') {
        local.busy = true; render(true);
        try {
          local.pendingSeriesId = local.draft?.seriesId || local.pendingSeriesId;
          releasePrepared();
          state.prepared = null; state.exportError = ''; state.dataVersion++;
          local.draft = null; local.code = ''; local.error = ''; local.dirty = true;
          await flushSave();
        } finally { local.busy = false; render(); }
        return;
      }
      if (action === 'rescue-draft') {
        if (anyImport() || state.exportBusy) { mark('รออ่านรูปหรือจัดหน้าให้เสร็จก่อนสำรองข้อมูล'); return; }
        const payload = currentPayload();
        const now = new Date().toISOString(); const id = crypto.randomUUID();
        const seriesId = local.draft?.seriesId || local.pendingSeriesId || id;
        const backup = { format: 'naichangyai-site-report', version: 1, exportedAt: now, drafts: [{id,seriesId,version:1,createdAt:now,updatedAt:now,payload}], revisions: [] };
        saveBlob(new Blob([JSON.stringify(backup)], {type:'application/json'}), `site-report-rescue-${Date.now()}.json`); mark('เตรียมไฟล์กู้ร่างแล้ว ตรวจว่าดาวน์โหลดสำเร็จ ไฟล์มีรูปและข้อมูลส่วนตัว'); return;
      }
      if (button.dataset.useDraft) { await useDraft(button.dataset.useDraft); return; }
      if (button.dataset.viewRevision) { await viewRevision(button.dataset.viewRevision); return; }
      if (action === 'new-draft') { await newDraft(); return; }
      if (action === 'confirm-report') { await confirmReport(); return; }
      if (action === 'clone-revision' && local.viewed) { await cloneViewed(); return; }
      if (action === 'resume-draft') { if (local.draft) await useDraft(local.draft.id); else await newDraft(); return; }
      if (action === 'backup' || action === 'backup-now') { await backupAll(); return; }
      if (action === 'confirm-backup' && backupState.candidate && Backup) {
        const result = Backup.confirm(backupState.candidate);
        if (result.receipt) { backupState.receipt = result.receipt; backupState.candidate = null; }
        backupState.error = result.error;
        backupStatus();
        mark(result.error || result.notice || 'บันทึกการยืนยันไฟล์แล้ว เป็นการยืนยันของผู้ใช้ ระบบไม่ได้ตรวจไฟล์ในเครื่องอัตโนมัติ');
        root.querySelector('[data-backup-status] [data-action="backup-now"]').focus({ preventScroll: true }); return;
      }
      if (action === 'cancel-backup') { backupState.candidate = null; backupStatus(); mark('ยังไม่บันทึกวันที่ยืนยันไฟล์สำรอง'); root.querySelector('[data-backup-status] [data-action="backup-now"]').focus({ preventScroll: true }); return; }
      if (action === 'import-backup') { screen.querySelector('[data-backup-file]')?.click(); return; }
    } catch (error) { mark(`ทำรายการไม่ได้: ${error.message}`); return; }
    if (local.viewed && (button.dataset.sample || button.dataset.removePhoto || button.dataset.camera || button.dataset.gallery || button.dataset.replacePhoto || ['clear-photo-phase', 'undo-photo'].includes(action))) return;
    if (button.dataset.go === 'setup') { await projectsPage(); return; }
    if (button.dataset.go) { navigate(button.dataset.go); return; }
    if (button.dataset.exportDirection && state.prepared) {
      state.exportPage = Math.max(0, Math.min(state.prepared.pages.length - 1, state.exportPage + Number(button.dataset.exportDirection)));
      render(); (screen.querySelector(`[data-export-direction="${button.dataset.exportDirection}"]:not(:disabled)`) || screen.querySelector('[data-export-direction]:not(:disabled)'))?.focus({ preventScroll: true }); return;
    }
    if (button.dataset.openPhoto) { openPhoto(button.dataset.task, Number(button.dataset.openPhoto)); return; }
    if (button.dataset.photoDirection) {
      const task = state.tasks[state.viewing?.task];
      const index = task?.photos.findIndex(photo => photo.id === state.viewing.id) ?? -1;
      const next = task?.photos[index + Number(button.dataset.photoDirection)];
      if (next) openPhoto(task.id, next.id);
      return;
    }
    if (button.dataset.camera) { screen.querySelector(`[data-files="${button.dataset.camera}"][data-input-source="camera"]`)?.click(); return; }
    if (button.dataset.gallery) { screen.querySelector(`[data-files="${button.dataset.gallery}"][data-input-source="gallery"]`)?.click(); return; }
    if (button.dataset.replacePhoto) { screen.querySelector(`[data-files="${button.dataset.task}"][data-replace-id="${button.dataset.replacePhoto}"][data-input-source="${button.dataset.source}"]`)?.click(); return; }
    if (button.dataset.sample) {
      const def = catalog.find(item => item.id === button.dataset.sample); const task = state.tasks[def.id];
      if (task.photos.length >= 6) { mark('ครบ 6 รูปแล้ว ลบรูปเดิมเพื่อแนบใหม่'); return; }
      invalidateExports();
      task.photos.push({ id: state.nextPhoto++, sample: true, taskTitle: def.title, zone: zoneLabel(task), caption: '', phase: '' }); render(); (screen.querySelector(`[data-sample="${def.id}"]:not(:disabled)`) || screen.querySelector(`[data-open-photo][data-task="${def.id}"]`))?.focus({ preventScroll: true }); mark('เพิ่มภาพจำลองแล้ว ไม่ใช่ภาพถ่ายหรือหลักฐานหน้างานจริง'); return;
    }
    if (button.dataset.removePhoto) { removePhoto(button.dataset.task, Number(button.dataset.removePhoto)); return; }
    if (action === 'photo-back') { closePhoto(); return; }
    if (action === 'clear-photo-phase') { const photo = activePhoto(); if (photo) { invalidateExports(); photo.phase = ''; render(); screen.querySelector('[data-photo-field="phase"]')?.focus({ preventScroll: true }); } return; }
    if (action === 'undo-photo') {
      const removed = state.removedPhoto; const task = removed && state.tasks[removed.task];
      if (!task) return;
      if (task.photos.length >= 6) { mark('มี 6 รูปแล้ว นำรูปอื่นออกก่อนคืนรูปที่ลบ'); return; }
      invalidateExports();
      if (!task.photos.some(photo => photo.id === removed.photo.id)) { removed.photo.zone = zoneLabel(task); task.photos.splice(Math.min(removed.index, task.photos.length), 0, removed.photo); }
      if (removed.detail) { state.fullReport ||= Full.defaults(); state.fullReport.photoDetails[removed.photo.id]=removed.detail; }
      state.removedPhoto = null; render();
      (screen.querySelector(`[data-open-photo="${removed.photo.id}"]`) || root.querySelector(`.sr-nav [data-go="${activeStep()}"]`))?.focus({ preventScroll: true });
      mark('คืนรูปล่าสุดแล้ว พร้อมคำบรรยายและป้ายเดิม'); return;
    }
    if (action === 'enter') {
      if (local.projectMode === 'create') {
        const today = currentLocalDate();
        if (state.date !== today) { state.date = today; invalidateExports(); }
      }
      local.projectMode = 'edit'; navigate('entry');
    }
    if (action === 'preview') {
      const invalid = screen.querySelector('input:invalid,select:invalid,textarea:invalid');
      if (invalid) {
        for (let details=invalid.closest('details'); details && screen.contains(details); details=details.parentElement?.closest('details')) {
          details.open=true; if (details.dataset.fullSection) fullOpen.add(details.dataset.fullSection);
        }
        invalid.scrollIntoView({ block: 'center' }); invalid.reportValidity(); mark('ตรวจช่องที่กรอกไม่ถูกต้องก่อนดูรายงาน'); return;
      }
      navigate('report');
    }
    if (action === 'line') navigate('line');
    if (action === 'export') navigate('export');
    if (action === 'generate') await generateDocuments();
    if (action === 'copy') {
      try { if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable'); await navigator.clipboard.writeText(lineText()); state.copied = true; render(true); mark('คัดลอกข้อความตัวอย่างแล้ว ยังไม่ได้ส่ง LINE'); }
      catch { state.copyFallback = true; render(); const field = screen.querySelector('[data-copy-source]'); field?.focus({ preventScroll: true }); field?.select(); mark('เลือกข้อความไว้แล้ว กดค้างหรือ Ctrl+C เพื่อคัดลอก'); }
    }
  });
  function applyDesign() {
    root.style.colorScheme = design.theme === 'auto' ? '' : design.theme;
    root.style.setProperty('--sr-touch', `${design.touchSize}px`);
    state.extraOpen = design.detailMode === 'full';
    render();
  }
  async function handleParentLeave(event) {
    if (window.parent === window || event.origin !== location.origin || event.source !== window.parent) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || typeof data.requestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9:._-]{0,127}$/.test(data.requestId)) return;
    if (data.type === 'SITE_REPORT_RESUME') {
      // Only an explicit cancellation of an already acknowledged request can
      // unlock. No timer may resume edits while an unmount is still in flight.
      if (bridge.approved && !bridge.pending && data.requestId === bridge.requestId) {
        bridge.approved = false; bridge.requestId = ''; local.busy = false; bridge.error = ''; render();
      }
      return;
    }
    if (data.type !== 'SITE_REPORT_REQUEST_LEAVE') return;
    const reply = (ok, message = '') => window.parent.postMessage({ type: 'SITE_REPORT_LEAVE_RESULT', requestId: data.requestId, ok, ...(message ? { message } : {}) }, location.origin);
    if (bridge.approved) { reply(data.requestId === bridge.requestId, data.requestId === bridge.requestId ? '' : 'กำลังรอเว็บไซต์ปิดหน้ารายงาน'); return; }
    if (bridge.pending) return;
    if (local.booting || local.busy || anyImport() || state.exportBusy) {
      bridge.error = 'ยังออกไม่ได้ รอเปิดข้อมูล อ่านรูป หรือทำรายการให้เสร็จก่อน แล้วลองกลับอีกครั้ง'; localStatus(); reply(false, bridge.error); return;
    }
    if (local.error) { bridge.error = 'ยังออกไม่ได้ กรุณาบันทึกให้สำเร็จ หรือสำรองการแก้ไขไว้ก่อน'; localStatus(); reply(false, local.error); return; }
    bridge.pending = true; bridge.requestId = data.requestId; bridge.error = ''; local.busy = true;
    const change = local.change;
    clearTimeout(local.timer);
    render(true);
    try {
      if (!(await flushSave())) throw new Error(local.error || 'ยังบันทึกข้อมูลล่าสุดไม่ได้');
      // Explicit database completion, even when the draft was already clean.
      if (local.viewed) {
        const record = await Store.getRevision(local.viewed.id);
        if (!record || record.docId !== local.viewed.docId) throw new Error('ตรวจฉบับที่บันทึกไว้ไม่ได้');
      } else if (local.draft) {
        const record = await Store.getDraft(local.draft.id);
        if (!record || record.version !== local.draft.version) {
          local.code = 'CONFLICT'; throw new Error('ร่างถูกแก้จากอีกแท็บ กรุณาเก็บการแก้ไขนี้เป็นร่างแยก');
        }
      } else await Store.open();
      if (local.dirty || local.saving || local.error || local.booting || anyImport() || state.exportBusy || change !== local.change) throw new Error('ยังมีข้อมูลหรือรายการที่ไม่บันทึกครบ');
      bridge.pending = false; bridge.approved = true;
      render(); reply(true);
    } catch (error) {
      bridge.pending = false; bridge.approved = false; local.busy = false;
      bridge.error = `ยังออกไม่ได้: ${error.message || 'ตรวจการบันทึกไม่สำเร็จ'} ข้อมูลหน้านี้ยังอยู่ สำรองไฟล์ได้ด้านล่าง`;
      if (local.code === 'CONFLICT') local.error = bridge.error;
      render(); reply(false, bridge.error);
    }
  }
  window.addEventListener('message', event => { void handleParentLeave(event); });
  async function startPilot() {
    try {
      if (!Store) throw new Error('ไม่พบระบบเก็บข้อมูล');
      await Store.open();
      await refreshRecords();
      local.draft = null; local.pendingSeriesId = ''; local.viewed = null;
      loadPayload({ ...emptyPayload, date: currentLocalDate() });
      local.projectMode = projectFolders().length ? 'list' : 'create'; state.page = 'setup';
    } catch (error) { local.error = `เปิดข้อมูลในเครื่องไม่ได้: ${error.message} ยังไม่รับรองการบันทึก`; local.code = error.code || 'STORAGE_UNAVAILABLE'; }
    finally { local.booting = false; render(); void refreshBackupStatus(); if (window.parent !== window) window.parent.postMessage({ type: 'SITE_REPORT_READY' }, location.origin); }
    if ('serviceWorker' in navigator) {
      try {
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.source === navigator.serviceWorker.controller && event.data?.type === 'SITE_REPORT_OFFLINE_STATUS') { local.offlineReady = event.data.ready === true; local.offlineMessage = local.offlineReady ? '' : 'ยังเตรียมออฟไลน์ไม่ครบ'; shell.version = String(event.data.version || ''); root.dataset.shellVersion = shell.version; localStatus(); }
        });
        navigator.serviceWorker.addEventListener('controllerchange', () => navigator.serviceWorker.controller?.postMessage({ type: 'SITE_REPORT_OFFLINE_STATUS_REQUEST' }));
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
        const refreshUpdate = () => { shell.waiting = Boolean(registration.waiting); localStatus(); };
        const watchInstalling = () => { registration.installing?.addEventListener('statechange', refreshUpdate); refreshUpdate(); };
        registration.addEventListener('updatefound', watchInstalling);
        navigator.serviceWorker.addEventListener('controllerchange', refreshUpdate);
        watchInstalling();
        navigator.serviceWorker.controller?.postMessage({ type: 'SITE_REPORT_OFFLINE_STATUS_REQUEST' });
      } catch { local.offlineMessage = 'ยังเปิดออฟไลน์ไม่ได้ ตรวจเครือข่ายแล้วเปิดใหม่'; localStatus(); }
    } else { local.offlineMessage = 'เบราว์เซอร์นี้ไม่รองรับการเปิดออฟไลน์'; localStatus(); }
  }
  window.addEventListener('online', localStatus);
  window.addEventListener('offline', localStatus);
  window.addEventListener('beforeunload', event => { if (local.dirty || local.saving || anyImport() || local.busy && !bridge.approved || state.exportBusy) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void flushSave(); else { if (state.page === 'setup' && local.projectMode === 'list') render(true); void refreshBackupStatus(); } });
  window.addEventListener('focus', () => { if (state.page === 'setup' && local.projectMode === 'list') render(true); void refreshBackupStatus(); });
  window.addEventListener('storage', event => {
    if (Backup && (event.key === Backup.key || event.key === null)) { Object.assign(backupState, Backup.read()); backupStatus(); void refreshBackupStatus(); }
  });
  channel?.addEventListener('message', event => {
    if (['saved', 'records-changed'].includes(event.data?.type)) { backupChanged(); backupStatus(); void refreshBackupStatus(); }
    if (event.data?.type === 'saved' && event.data.id === local.draft?.id && event.data.version > local.draft.version && !local.viewed) {
      local.code = 'CONFLICT'; local.error = 'ร่างถูกแก้จากอีกแท็บ เก็บงานของแท็บนี้เป็นร่างแยกก่อนทำต่อ'; localStatus();
    }
  });
  render();
  void startPilot();
  if (globalThis.Tweak) {
    const tweak = new Tweak({ container: root, onChange: applyDesign });
    tweak.addSelect(design, 'theme', { label: 'การแสดงผล', options: [{ label: 'ตามเครื่อง', value: 'auto' }, { label: 'สว่างสำหรับกลางแจ้ง', value: 'light' }, { label: 'มืด', value: 'dark' }] });
    tweak.addSlider(design, 'touchSize', { label: 'ขนาดปุ่มแตะ', min: 48, max: 60, step: 2, unit: 'px' });
    tweak.addSelect(design, 'detailMode', { label: 'รายละเอียดประจำวัน', options: [{ label: 'ย่อไว้ กดเปิดเมื่อใช้', value: 'simple' }, { label: 'แสดงรายละเอียด', value: 'full' }] });
  }
})();
