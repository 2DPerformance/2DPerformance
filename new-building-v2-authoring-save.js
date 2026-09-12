// P1 input preservation is independent of Drawing Record acceptance.
export function mountP1AuthoringSave({ api, storage, identity, getSnapshot, restore, canRestore, toast, onChange, host = window }) {
  const saveFileButton = document.getElementById('p1-save-file');
  const downloadButton = document.getElementById('p1-download-draft');
  const status = document.getElementById('p1-authoring-save-status');
  let writer, project, ready = false, timer, dirty = false, busy = false, error = '', saved = false, conflict = false;
  let initialization;
  const key = api.newBuildingV2AuthoringDraftKey(identity.projectId, identity.profileFingerprint);
  function checkProject(store) {
    const current = JSON.parse(store.getItem(`sv_proj_${identity.projectId}`) || 'null');
    if (!current || current.id !== identity.projectId || current.p0ProfileFingerprint !== identity.profileFingerprint
      || Number(current.p0ProfileRevision) !== Number(identity.profileRevision)) throw new Error('P0 เปลี่ยนแล้ว · เก็บไฟล์ร่างก่อนเปิดโครงการใหม่');
    return current;
  }
  function render() {
    saveFileButton.disabled = !ready || busy;
    downloadButton.disabled = !ready || busy;
    saveFileButton.setAttribute('aria-busy', String(busy));
    status.textContent = !ready ? 'กำลังเปิดร่างที่บันทึกไว้…' : error ? `ยังไม่บันทึกร่าง · ${error} · กดบันทึกไฟล์… เพื่อสำรอง` : dirty ? 'กำลังบันทึกร่างในเครื่อง…' : saved ? '✓ บันทึกร่างในเครื่องแล้ว' : 'ร่างแปลน · ยังไม่มีการแก้ไขใหม่';
    status.dataset.state = error ? 'error' : dirty ? 'pending' : saved ? 'saved' : 'ready';
    const footer = document.getElementById('save-state');
    if (footer) footer.textContent = status.textContent;
    onChange?.();
  }
  function capture() {
    const current = checkProject(storage());
    return api.createNewBuildingV2AuthoringDraft(project, getSnapshot(), { basisDrawingFingerprint: current.p1DrawingFingerprint || '' });
  }
  function download(content, name) {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  async function flush() {
    clearTimeout(timer);
    if (!ready || !writer || conflict) return false;
    try {
      const draft = capture();
      const result = await writer.save(draft);
      dirty = !writer.current(api.authoringDraftInputs(getSnapshot()));
      render();
      return result;
    } catch (failure) { error = failure?.message || 'บันทึกไม่สำเร็จ'; render(); return false; }
  }
  function schedule() {
    if (!ready || conflict) return;
    dirty = true; saved = false; render();
    clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, 750);
  }
  function restoreDraft(draft, keepUndo = false) {
    restore(draft.inputs, { keepUndo });
    saved = true; dirty = false;
    toast('เปิดร่างที่บันทึกไว้แล้ว · รวมงานที่ยังวาดไม่ครบ · ตรวจแปลนก่อนส่งคำนวณ');
  }
  async function initialize() {
    if (initialization) return initialization;
    initialization = (async () => {
      const store = storage();
      project = checkProject(store);
      const raw = store.getItem(key);
      let inspected;
      if (raw !== null) {
        try { inspected = api.inspectNewBuildingV2AuthoringDraft(project, JSON.parse(raw)); }
        catch { inspected = { ok: false, reason: 'อ่านร่างเดิมไม่ได้' }; }
      }
      if (inspected && !inspected.ok) {
        conflict = true; error = inspected.reason; ready = true; render(); return false;
      }
      writer = api.createAuthoringDraftWriter({
        initialRaw: raw,
        read: () => storage().getItem(key),
        write: async (value, expected) => {
          const write = stage => {
            const current = checkProject(stage);
            if (stage.getItem(key) !== expected) throw new Error('ร่างถูกบันทึกจากอีกแท็บ · เก็บไฟล์นี้ก่อนเปิดร่างล่าสุด');
            if ((current.p1DrawingFingerprint || '') !== JSON.parse(value).basisDrawingFingerprint) throw new Error('แปลนเปลี่ยนจากอีกแท็บ · เก็บไฟล์นี้ก่อนเปิดร่างล่าสุด');
            stage.setItem(key, value);
          };
          const destination = storage();
          if (typeof destination.transact === 'function') await destination.transact(write);
          else write(destination);
        },
        onStatus: state => { error = state.error; saved = state.saved; if (state.pending) dirty = true; render(); },
      });
      let restored = false;
      if (inspected) {
        if (inspected.draft.basisDrawingFingerprint === (project.p1DrawingFingerprint || '') && canRestore()) {
          restoreDraft(inspected.draft); restored = true;
        } else {
          conflict = true;
          error = 'ร่างที่เก็บไว้ต่างจากแปลนปัจจุบัน · สำรองไฟล์นี้ก่อนเลือกเปิดร่างเดิม';
          const recover = document.createElement('button');
          recover.type = 'button'; recover.textContent = 'เปิดร่างเดิมที่เก็บไว้';
          recover.addEventListener('click', () => {
            restoreDraft(inspected.draft, true); conflict = false; error = ''; recover.remove(); schedule();
          });
          status.parentElement.append(recover);
        }
      }
      ready = true;
      if (restored) await flush();
      render(); return restored;
    })().catch(failure => { error = failure?.message || 'เปิดระบบบันทึกไม่ได้'; render(); throw failure; });
    return initialization;
  }
  // The picker is requested synchronously in this listener. Storage awaits must
  // never consume the browser's transient click activation before the chooser.
  async function saveFile(forceDownload = false) {
    if (!ready || busy) return;
    const filename = `${String(project.name || 'อาคาร-V2').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
    const destination = forceDownload ? Promise.resolve({ kind: 'download' }) : api.requestAuthoringSaveDestination(host, filename);
    busy = true; render();
    try {
      // Capture immediately; editing while the chooser is open cannot silently
      // replace the snapshot the owner requested.
      const draft = api.createNewBuildingV2AuthoringDraft(project, getSnapshot());
      const localSave = flush();
      const chosen = await destination;
      const durable = await localSave;
      if (chosen.kind === 'cancelled') {
        toast(durable ? 'ยกเลิกเลือกไฟล์ · ร่างบันทึกในเครื่องแล้ว · ใช้ ↓ JSON เพื่อดาวน์โหลดสำรองได้' : 'ยกเลิกเลือกไฟล์ · ร่างยังไม่บันทึก โปรดกด ↓ JSON เพื่อดาวน์โหลดสำรอง');
        return;
      }
      // A draft-only portable file does not depend on valid slab/beam geometry
      // or on an older P1 record. The normal project importer restores its inputs.
      const bundle = api.createNewBuildingV2DraftProjectFileData(project, draft);
      if (!bundle.ok) throw new Error(bundle.reason);
      const content = JSON.stringify(bundle.file, null, 2);
      const result = await api.writeAuthoringFile(chosen, content, value => download(value, filename));
      if (result.kind === 'failed') {
        download(content, filename);
        toast(`เขียนไฟล์ที่เลือกไม่สำเร็จ · ${result.error} · ส่งไฟล์สำรองไปที่รายการดาวน์โหลดแล้ว`);
      } else toast(result.kind === 'file' ? `บันทึกไฟล์ ${result.name} แล้ว · เปิดกลับได้จากรายการโครงการ → เปิดไฟล์`
        : 'ส่งไฟล์ไปที่รายการดาวน์โหลดแล้ว · ตรวจไฟล์ .json ในโฟลเดอร์ดาวน์โหลด');
    } catch (failure) { toast(`บันทึกไฟล์ไม่สำเร็จ · ${failure?.message || 'โปรดลองอีกครั้ง'}`); }
    finally { busy = false; render(); }
  }
  saveFileButton.addEventListener('click', () => { void saveFile(); });
  downloadButton.addEventListener('click', () => { void saveFile(true); });
  host.addEventListener('pagehide', () => { if (dirty) void flush(); });
  return { initialize, schedule, flush, get ready() { return ready; },
    current: () => ready && !conflict && writer?.current(api.authoringDraftInputs(getSnapshot())),
  };
}
