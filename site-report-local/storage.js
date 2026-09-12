/* Local-only Site Report pilot. No network, cloud sync, or automatic deletion. */
(function (global) {
  'use strict';
  const DATABASE = 'naichangyai-site-report-pilot-v1';
  const SCHEMA_VERSION = 1;
  const FORMAT = 'naichangyai-site-report';
  const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
  const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
  // Keep complete minified UTF-8 backups below the UI's 140 MiB file-import cap.
  // The separate photo limit does not account for base64 expansion or Thai text.
  const MAX_BACKUP_BYTES = 139 * 1024 * 1024;
  const MAX_RECORDS = 200;
  const catalog = global.SiteReportCatalog;
  const catalogReady = catalog?.version === 1 && Object.isFrozen(catalog)
    && Array.isArray(catalog.tasks) && Object.isFrozen(catalog.tasks)
    && catalog.tasks.length > 0 && catalog.tasks.length <= 50
    && catalog.tasks.every(task => task && typeof task === 'object' && Object.isFrozen(task) && typeof task.id === 'string' && /^[a-z][a-z0-9-]{0,49}$/.test(task.id))
    && new Set(catalog.tasks.map(task => task.id)).size === catalog.tasks.length;
  const TASK_IDS = Object.freeze(catalogReady ? catalog.tasks.map(task => task.id) : []);
  const PAYLOAD_KEYS = ['project', 'site', 'date', 'reporter', 'weather', 'workers', 'resources', 'tomorrow', 'tasks', 'issues', 'issueTask', 'issueType', 'urgency', 'owner', 'due', 'issueNote', 'recipient', 'nextPhoto'];
  const LONG_FIELDS = new Set(['resources', 'tomorrow', 'issueNote', 'note', 'caption']);
  let databasePromise;
  const validatedImages = new Map();

  class StoreError extends Error {
    constructor(code, message, cause) { super(message); this.name = 'StoreError'; this.code = code; if (cause) this.cause = cause; }
  }
  function fail(message, code = 'VALIDATION') { throw new StoreError(code, message); }
  function requireCatalog() {
    if (!catalogReady) fail('เปิดรายการงานไม่ได้ กรุณาโหลดหน้าใหม่ ยังไม่อ่านหรือเขียนทับข้อมูลในเครื่อง', 'STORAGE_UNAVAILABLE');
  }
  function normalize(error) {
    if (error instanceof StoreError) return error;
    if (error && error.name === 'QuotaExceededError') return new StoreError('QUOTA_EXCEEDED', 'พื้นที่เก็บข้อมูลในเครื่องไม่เพียงพอ ยังไม่ได้บันทึก กรุณาสำรองข้อมูลก่อนจัดการพื้นที่', error);
    if (error && error.name === 'ConstraintError') return new StoreError('CONFLICT', 'ข้อมูลเปลี่ยนจากอีกหน้าต่าง กรุณาเปิดร่างล่าสุดหรือสร้างสำเนา', error);
    return new StoreError('STORAGE_UNAVAILABLE', 'ไม่สามารถยืนยันการบันทึกในเครื่องได้ ข้อมูลเดิมไม่ได้ถูกลบ กรุณาสำรองข้อมูลแล้วลองใหม่', error);
  }
  function plain(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(name + ' ต้องเป็นข้อมูลแบบ object');
  }
  function safeTree(value, depth = 0, seen = new Set()) {
    if (depth > 12) fail('ข้อมูลซ้อนลึกเกินกำหนด');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (!value || typeof value !== 'object' || seen.has(value)) fail('ข้อมูลต้องเป็น JSON ที่ไม่มีวงรอบ');
    seen.add(value);
    if (Array.isArray(value)) { if (value.length > MAX_RECORDS) fail('จำนวนรายการเกินกำหนด'); }
    else plain(value, 'ข้อมูล');
    for (const key of Reflect.ownKeys(value)) {
      if (Array.isArray(value) && key === 'length') continue;
      if (typeof key !== 'string' || (Array.isArray(value) && !/^(0|[1-9]\d*)$/.test(key))) fail('ข้อมูลต้องไม่มี symbol หรือฟิลด์พิเศษบน array');
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('พบชื่อฟิลด์ที่ไม่อนุญาต');
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('ข้อมูลต้องไม่มี accessor หรือฟิลด์ที่ซ่อนไว้');
      safeTree(descriptor.value, depth + 1, seen);
    }
    seen.delete(value);
  }
  function keys(value, allowed, required, name) {
    plain(value, name);
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(name + ': ไม่รองรับฟิลด์ ' + key);
    for (const key of required || allowed) if (!Object.hasOwn(value, key)) fail(name + ': ขาดฟิลด์ ' + key);
  }
  function string(value, name, max = LONG_FIELDS.has(name) ? 10000 : 500) {
    if (typeof value !== 'string' || value.length > max) fail(name + ' ต้องเป็นข้อความไม่เกิน ' + max + ' ตัวอักษร');
  }
  function choice(value, choices, name) { string(value, name); if (!choices.includes(value)) fail(name + ' มีค่าที่ไม่รองรับ'); }
  function integer(value, name, minimum = 1, maximum = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(value) || value < minimum || value > maximum) fail(name + ' ต้องเป็นจำนวนเต็มในช่วงที่รองรับ'); }
  function identifier(value, name) { if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value)) fail(name + ' ไม่ถูกต้อง'); }
  function timestamp(value, name) { if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail(name + ' ไม่ใช่วันเวลาที่ถูกต้อง'); }
  function photoBytes(photo) {
    if (photo.sample) return 0;
    if (typeof photo.src !== 'string') fail('รูปถ่ายไม่มีข้อมูลไฟล์');
    const matched = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(photo.src);
    if (!matched || matched[2].length % 4 !== 0) fail('รูปต้องเป็น JPEG, PNG หรือ WebP แบบ data URL ที่ถูกต้อง');
    const encoded = matched[2];
    const bytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
    if (bytes > MAX_PHOTO_BYTES || bytes < 12) fail('รูปต้องมีขนาดไม่เกิน 10 MiB และไม่ใช่ไฟล์ว่าง');
    let prefix;
    try { prefix = global.atob(encoded.slice(0, 32)); } catch (_) { fail('ข้อมูล base64 ของรูปไม่ถูกต้อง'); }
    const correct = matched[1] === 'png' ? prefix.startsWith('\x89PNG\r\n\x1a\n') : matched[1] === 'jpeg' ? prefix.startsWith('\xff\xd8\xff') : prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
    if (!correct) fail('ชนิดไฟล์รูปไม่ตรงกับข้อมูลจริง');
    return bytes;
  }
  function validateOptionalFullReport(payload) {
    if (!Object.hasOwn(payload, 'fullReport')) return;
    const fullReport = global.SiteReportFullReport;
    if (!fullReport || fullReport.version !== '1.0.0' || !Object.isFrozen(fullReport) || typeof fullReport.validate !== 'function') fail('เปิดตัวตรวจรายงานเต็มรูปแบบไม่ได้ ยังไม่เขียนทับข้อมูล กรุณาโหลดหน้าใหม่', 'STORAGE_UNAVAILABLE');
    try { fullReport.validate(payload.fullReport); }
    catch (error) { fail(error.message || 'ข้อมูลรายงานเต็มรูปแบบไม่ถูกต้อง'); }
  }
  function validatePayload(payload, budget = { bytes: 0 }) {
    requireCatalog();
    safeTree(payload);
    keys(payload, [...PAYLOAD_KEYS, 'fullReport'], PAYLOAD_KEYS, 'ร่างรายงาน');
    for (const key of PAYLOAD_KEYS) if (!['tasks', 'nextPhoto'].includes(key)) string(payload[key], key);
    integer(payload.nextPhoto, 'nextPhoto');
    choice(payload.issues, ['', 'yes', 'no'], 'issues');
    choice(payload.issueTask, ['', 'all', ...TASK_IDS], 'issueTask');
    choice(payload.urgency, ['', 'normal', 'today', 'urgent'], 'urgency');
    keys(payload.tasks, TASK_IDS, [], 'รายการงาน');
    const ids = new Set();
    for (const [taskId, task] of Object.entries(payload.tasks)) {
      keys(task, ['id', 'selected', 'zone', 'customZone', 'status', 'note', 'photos'], undefined, 'งาน');
      if (task.id !== taskId || typeof task.selected !== 'boolean') fail('ข้อมูลระบุงานไม่ตรงกัน');
      for (const key of ['zone', 'customZone', 'note']) string(task[key], key);
      choice(task.status, ['', 'doing', 'done', 'blocked'], 'status');
      if (!Array.isArray(task.photos) || task.photos.length > 6) fail('แต่ละงานเก็บได้ไม่เกิน 6 รูป');
      for (const photo of task.photos) {
        keys(photo, ['id', 'sample', 'src', 'width', 'height', 'taskTitle', 'zone', 'caption', 'phase', 'importedAt', 'importedOn', 'inputSource'], ['id', 'sample', 'taskTitle', 'zone', 'caption', 'phase'], 'รูปถ่าย');
        integer(photo.id, 'รหัสรูป');
        if (ids.has(photo.id) || photo.id >= payload.nextPhoto) fail('รหัสรูปซ้ำหรือ nextPhoto ไม่ถูกต้อง');
        ids.add(photo.id);
        if (typeof photo.sample !== 'boolean') fail('ต้องระบุชนิดภาพตัวอย่าง');
        for (const key of ['taskTitle', 'zone', 'caption']) string(photo[key], key);
        choice(photo.phase, ['', 'ก่อนทำ', 'ระหว่างทำ', 'หลังทำ', 'ปัญหา'], 'phase');
        if (Object.hasOwn(photo, 'inputSource')) choice(photo.inputSource, ['camera', 'gallery'], 'inputSource');
        if (Object.hasOwn(photo, 'importedAt')) string(photo.importedAt, 'importedAt', 100);
        if (Object.hasOwn(photo, 'importedOn')) timestamp(photo.importedOn, 'importedOn');
        if (photo.sample) { if (photo.src) fail('ภาพตัวอย่างต้องไม่มีไฟล์ภาพถ่าย'); }
        else {
          integer(photo.width, 'ความกว้างรูป', 1, 100000);
          integer(photo.height, 'ความสูงรูป', 1, 100000);
          if (photo.width * photo.height > 100000000) fail('ความละเอียดรูปเกินกำหนด');
        }
        budget.bytes += photoBytes(photo);
        if (budget.bytes > MAX_TOTAL_BYTES) fail('ข้อมูลรูปทั้งหมดเกิน 100 MiB');
      }
    }
    // Additive payload only: legacy records stay absent, including immutable
    // revisions and backups. Never synthesize defaults during persistence.
    if (Object.hasOwn(payload, 'fullReport')) {
      validateOptionalFullReport(payload);
      for (const id of Object.keys(payload.fullReport.photoDetails)) if (!ids.has(Number(id))) fail('ข้อมูลประกอบภาพอ้างอิงรูปที่ไม่มีในรายงาน');
      if (payload.fullReport.logo) budget.bytes += photoBytes(payload.fullReport.logo);
      if (budget.bytes > MAX_TOTAL_BYTES) fail('ข้อมูลรูปและโลโก้ทั้งหมดเกิน 100 MiB');
    }
    return payload;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function canonical(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  }
  function validateDraft(record, budget) {
    keys(record, ['id', 'seriesId', 'version', 'payload', 'createdAt', 'updatedAt'], undefined, 'บันทึกร่าง');
    identifier(record.id, 'id'); identifier(record.seriesId, 'seriesId'); integer(record.version, 'version');
    timestamp(record.createdAt, 'createdAt'); timestamp(record.updatedAt, 'updatedAt');
    if (record.updatedAt < record.createdAt) fail('วันแก้ไขร่างก่อนวันสร้าง');
    validatePayload(record.payload, budget);
  }
  function validateRevision(record, budget) {
    keys(record, ['id', 'seriesId', 'revision', 'docId', 'confirmedAt', 'payload', 'sourceDraftId', 'sourceDraftVersion'], undefined, 'ฉบับยืนยัน');
    for (const key of ['id', 'seriesId', 'sourceDraftId']) identifier(record[key], key);
    integer(record.revision, 'revision'); integer(record.sourceDraftVersion, 'sourceDraftVersion'); timestamp(record.confirmedAt, 'confirmedAt');
    validatePayload(record.payload, budget);
    const reportDate = validCalendarDate(record.payload.date);
    const accepted = new Set([documentId(record.seriesId, record.revision, record.confirmedAt)]);
    if (reportDate) accepted.add(documentId(record.seriesId, record.revision, reportDate));
    else for (let offset = -14; offset <= 14; offset++) accepted.add(documentId(record.seriesId, record.revision, offsetDate(record.confirmedAt, offset)));
    if (!accepted.has(record.docId)) fail('เลขรายงานไม่ตรงกับฉบับยืนยัน');
  }
  function uid(prefix) {
    if (!global.crypto || typeof global.crypto.randomUUID !== 'function') fail('ต้องเปิดผ่าน localhost หรือ HTTPS เพื่อเก็บข้อมูลอย่างปลอดภัย', 'STORAGE_UNAVAILABLE');
    return prefix + '-' + global.crypto.randomUUID();
  }
  function validCalendarDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(value)) return '';
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : '';
  }
  function documentId(seriesId, revision, date) { return 'SR-' + date.slice(0, 10).replaceAll('-', '') + '-' + seriesId.replace(/[^a-z0-9]/gi, '').slice(-10).toUpperCase() + '-R' + revision; }
  function localDate(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
  function offsetDate(instant, offsetHours) { return new Date(Date.parse(instant) + offsetHours * 60 * 60 * 1000).toISOString().slice(0, 10); }
  function reportDocumentDate(payload, instant) { return validCalendarDate(payload.date) || localDate(instant); }
  function checkTotalStorage(records) {
    const budget = { bytes: 0 };
    for (const record of records) validatePayload(record.payload, budget);
    // Placing all records in one array adds at most one comma versus split arrays,
    // so this envelope conservatively bounds the real drafts/revisions export.
    checkBackupBytes({ format: FORMAT, version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), drafts: records, revisions: [] });
  }
  function checkBackupBytes(backup) {
    if (new global.Blob([JSON.stringify(backup)]).size > MAX_BACKUP_BYTES) fail('ข้อมูลพร้อมรูปและข้อความเกินขนาดสำรองที่รองรับ (139 MiB) ยังไม่ได้เขียนข้อมูลใหม่และไม่ได้ลบข้อมูลเดิม');
  }

  async function open() {
    requireCatalog();
    if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
      let request, blocked = false;
      try { if (!global.indexedDB) throw new Error('IndexedDB unavailable'); request = global.indexedDB.open(DATABASE, SCHEMA_VERSION); }
      catch (error) { reject(normalize(error)); return; }
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('drafts', { keyPath: 'id' });
        const revisions = db.createObjectStore('revisions', { keyPath: 'id' });
        revisions.createIndex('seriesRevision', ['seriesId', 'revision'], { unique: true });
        revisions.createIndex('draftVersion', ['sourceDraftId', 'sourceDraftVersion'], { unique: true });
      };
      request.onerror = () => reject(normalize(request.error));
      request.onblocked = () => { blocked = true; reject(new StoreError('STORAGE_UNAVAILABLE', 'อีกหน้าต่างกำลังใช้ฐานข้อมูลรุ่นเดิม กรุณาปิดหน้าต่างนั้นแล้วลองใหม่')); };
      request.onsuccess = () => {
        const db = request.result;
        if (blocked) { db.close(); return; }
        db.onversionchange = () => { db.close(); databasePromise = undefined; };
        db.onclose = () => { databasePromise = undefined; };
        resolve(db);
      };
    }).catch(error => { databasePromise = undefined; throw normalize(error); });
    await databasePromise;
    return { version: SCHEMA_VERSION, storage: 'indexeddb', scope: 'this-browser-only' };
  }
  async function transact(stores, mode, work) {
    await open(); const db = await databasePromise;
    return new Promise((resolve, reject) => {
      let transaction, result, failure;
      try { transaction = db.transaction(stores, mode, mode === 'readwrite' ? { durability: 'strict' } : undefined); }
      catch (error) { reject(normalize(error)); return; }
      const context = {
        store: name => transaction.objectStore(name),
        result: value => { result = value; },
        abort: error => { failure = normalize(error); try { transaction.abort(); } catch (_) { reject(failure); } },
        request: (request, success) => {
          request.onerror = () => { if (!failure) failure = normalize(request.error); };
          request.onsuccess = () => { try { success(request.result); } catch (error) { context.abort(error); } };
        }
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure || normalize(transaction.error));
      transaction.onerror = () => { if (!failure) failure = normalize(transaction.error); };
      try { work(context); } catch (error) { context.abort(error); }
    });
  }
  // Reads preserve unsupported future work IDs so the app can hold export and
  // offer a raw backup. Only the additive extension is validated at this stage;
  // complete task/payload validation still gates every write and import.
  function readAll(store) { return transact([store], 'readonly', tx => tx.request(tx.store(store).getAll(), values => { for (const value of values) validateOptionalFullReport(value.payload); tx.result(values); })); }
  async function listDrafts() { return (await readAll('drafts')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); }
  async function listRevisions() { return (await readAll('revisions')).sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt) || b.revision - a.revision); }
  async function getRecord(store, id) { identifier(id, 'id'); return transact([store], 'readonly', tx => tx.request(tx.store(store).get(id), record => { if (record) validateOptionalFullReport(record.payload); tx.result(record || null); })); }
  function getDraft(id) { return getRecord('drafts', id); }
  function getRevision(id) { return getRecord('revisions', id); }
  async function saveDraft(input) {
    safeTree(input); keys(input, ['id', 'payload', 'expectedVersion', 'seriesId'], ['payload'], 'คำขอบันทึก');
    const payload = clone(validatePayload(input.payload));
    if (input.id !== undefined) identifier(input.id, 'id');
    if (input.seriesId !== undefined) identifier(input.seriesId, 'seriesId');
    if (input.expectedVersion !== undefined) integer(input.expectedVersion, 'expectedVersion');
    if (input.id && input.expectedVersion === undefined) fail('บันทึกร่างเดิมต้องระบุ expectedVersion', 'CONFLICT');
    if (!input.id && input.expectedVersion !== undefined) fail('ร่างใหม่ต้องไม่มี expectedVersion');
    await validateImportedImages([{ payload }]);
    return transact(['drafts', 'revisions'], 'readwrite', tx => {
      const store = tx.store('drafts');
      const save = existing => {
        if (input.id && (!existing || existing.version !== input.expectedVersion)) fail('ร่างถูกแก้ไขจากอีกหน้าต่าง กรุณาโหลดฉบับล่าสุดหรือสร้างสำเนา', 'CONFLICT');
        if (existing && input.seriesId && input.seriesId !== existing.seriesId) fail('เปลี่ยนชุดรายงานของร่างเดิมไม่ได้', 'CONFLICT');
        const now = new Date().toISOString();
        const record = { id: existing ? existing.id : uid('draft'), seriesId: existing ? existing.seriesId : input.seriesId || uid('series'), version: existing ? existing.version + 1 : 1, payload, createdAt: existing ? existing.createdAt : now, updatedAt: now };
        tx.request(store.getAll(), drafts => {
          if (!existing && drafts.length >= MAX_RECORDS) fail('ร่างในเครื่องครบ 200 รายการ กรุณาสำรองข้อมูลและติดต่อผู้ดูแล');
          tx.request(tx.store('revisions').getAll(), revisions => {
            checkTotalStorage([...drafts.filter(item => item.id !== record.id), ...revisions, record]);
            tx.request(existing ? store.put(record) : store.add(record), () => tx.result(record));
          });
        });
      };
      if (input.id) tx.request(store.get(input.id), save); else save(null);
    });
  }
  async function getOrCreateDailyDraft(input) {
    safeTree(input); keys(input, ['seriesId', 'payload'], undefined, 'คำขอเริ่มบันทึกประจำวัน');
    identifier(input.seriesId, 'seriesId');
    const payload = clone(validatePayload(input.payload));
    await validateImportedImages([{ payload }]);
    return transact(['drafts', 'revisions'], 'readwrite', tx => {
      const draftsStore = tx.store('drafts');
      tx.request(draftsStore.getAll(), drafts => {
        const existing = drafts
          .filter(record => record.seriesId === input.seriesId && record.payload.date === payload.date)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))[0];
        if (existing) { validateOptionalFullReport(existing.payload); tx.result(existing); return; }
        if (drafts.length >= MAX_RECORDS) fail('ร่างในเครื่องครบ 200 รายการ กรุณาสำรองข้อมูลและติดต่อผู้ดูแล');
        tx.request(tx.store('revisions').getAll(), revisions => {
          const now = new Date().toISOString();
          const record = { id: uid('draft'), seriesId: input.seriesId, version: 1, payload, createdAt: now, updatedAt: now };
          checkTotalStorage([...drafts, ...revisions, record]);
          tx.request(draftsStore.add(record), () => tx.result(record));
        });
      });
    });
  }
  async function confirmDraft(id, expectedVersion) {
    identifier(id, 'id'); integer(expectedVersion, 'expectedVersion');
    return transact(['drafts', 'revisions'], 'readwrite', tx => {
      tx.request(tx.store('drafts').get(id), draft => {
        if (!draft) fail('ไม่พบร่างรายงาน', 'NOT_FOUND');
        if (draft.version !== expectedVersion) fail('ร่างเปลี่ยนไปก่อนยืนยัน กรุณาตรวจฉบับล่าสุด', 'CONFLICT');
        validateDraft(draft);
        const revisions = tx.store('revisions');
        tx.request(revisions.index('draftVersion').get([id, expectedVersion]), existing => {
          if (existing) { tx.result(existing); return; }
          tx.request(revisions.getAll(), all => {
            if (all.length >= MAX_RECORDS) fail('ฉบับยืนยันในเครื่องครบ 200 รายการ กรุณาสำรองข้อมูลและติดต่อผู้ดูแล');
            const revision = all.filter(item => item.seriesId === draft.seriesId).reduce((max, item) => Math.max(max, item.revision), 0) + 1;
            const instant = new Date();
            const now = instant.toISOString();
            const record = { id: uid('revision'), seriesId: draft.seriesId, revision, docId: documentId(draft.seriesId, revision, reportDocumentDate(draft.payload, instant)), confirmedAt: now, payload: clone(draft.payload), sourceDraftId: id, sourceDraftVersion: expectedVersion };
            checkRevisionIdentity([...all, record]);
            tx.request(tx.store('drafts').getAll(), drafts => {
              checkTotalStorage([...drafts, ...all, record]);
              tx.request(revisions.add(record), () => tx.result(record));
            });
          });
        });
      });
    });
  }
  async function cloneRevision(id) {
    identifier(id, 'id');
    const revision = await getRevision(id);
    if (!revision) fail('ไม่พบฉบับยืนยัน', 'NOT_FOUND');
    validateRevision(revision);
    return saveDraft({ payload: revision.payload, seriesId: revision.seriesId });
  }
  function exportBackup() {
    return transact(['drafts', 'revisions'], 'readonly', tx => {
      const backup = { format: FORMAT, version: SCHEMA_VERSION, exportedAt: new Date().toISOString(), drafts: [], revisions: [] };
      let pending = 2;
      for (const type of ['drafts', 'revisions']) tx.request(tx.store(type).getAll(), records => {
        backup[type] = records;
        if (--pending === 0) {
          for (const record of [...backup.drafts, ...backup.revisions]) validateOptionalFullReport(record.payload);
          checkBackupBytes(backup); tx.result(backup);
        }
      });
    });
  }
  function checkRevisionIdentity(records) {
    const seriesKeys = new Map(), draftKeys = new Map(), documentKeys = new Map();
    for (const record of records) {
      const seriesKey = record.seriesId + ':' + record.revision;
      const draftKey = record.sourceDraftId + ':' + record.sourceDraftVersion;
      if ((seriesKeys.has(seriesKey) && seriesKeys.get(seriesKey) !== record.id) || (draftKeys.has(draftKey) && draftKeys.get(draftKey) !== record.id)) fail('เลขฉบับหรือร่างต้นทางขัดแย้งกับรายงานที่มีอยู่', 'CONFLICT');
      if (documentKeys.has(record.docId) && documentKeys.get(record.docId) !== record.id) fail('เลขรายงานซ้ำกับรายงานที่มีอยู่', 'CONFLICT');
      seriesKeys.set(seriesKey, record.id); draftKeys.set(draftKey, record.id);
      documentKeys.set(record.docId, record.id);
    }
  }
  async function validateImportedImages(records) {
    function* recordImages(record) {
      if (record.payload.fullReport?.logo) yield record.payload.fullReport.logo;
      for (const task of Object.values(record.payload.tasks)) yield* task.photos;
    }
    for (const record of records) for (const photo of recordImages(record)) {
      if (photo.sample) continue;
      const cached = validatedImages.get(photo.src);
      if (cached) {
        if (cached.width !== photo.width || cached.height !== photo.height) fail('ขนาดรูปในข้อมูลไม่ตรงกับภาพจริง');
        continue;
      }
      await new Promise((resolve, reject) => {
        const image = new global.Image();
        const timer = global.setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(new StoreError('VALIDATION', 'ตรวจไฟล์รูปไม่สำเร็จภายในเวลาที่กำหนด ยังไม่นำเข้าข้อมูล')); }, 15000);
        image.onload = () => {
          global.clearTimeout(timer);
          if (image.naturalWidth !== photo.width || image.naturalHeight !== photo.height) reject(new StoreError('VALIDATION', 'ขนาดรูปในข้อมูลไม่ตรงกับภาพจริง'));
          else {
            validatedImages.set(photo.src, { width: image.naturalWidth, height: image.naturalHeight });
            if (validatedImages.size > 36) validatedImages.delete(validatedImages.keys().next().value);
            resolve();
          }
        };
        image.onerror = () => { global.clearTimeout(timer); reject(new StoreError('VALIDATION', 'ไฟล์สำรองมีรูปที่เปิดไม่ได้ ยังไม่นำเข้าข้อมูล')); };
        image.src = photo.src;
      });
    }
  }
  async function importBackup(input) {
    safeTree(input); keys(input, ['format', 'version', 'exportedAt', 'drafts', 'revisions'], undefined, 'ไฟล์สำรอง');
    if (input.format !== FORMAT || input.version !== SCHEMA_VERSION) fail('ไฟล์สำรองคนละรูปแบบหรือรุ่น');
    timestamp(input.exportedAt, 'exportedAt');
    if (!Array.isArray(input.drafts) || !Array.isArray(input.revisions) || input.drafts.length > MAX_RECORDS || input.revisions.length > MAX_RECORDS) fail('จำนวนรายการสำรองเกินกำหนด');
    const budget = { bytes: 0 };
    for (const [type, validator] of [['drafts', validateDraft], ['revisions', validateRevision]]) {
      const ids = new Set();
      for (const record of input[type]) { validator(record, budget); if (ids.has(record.id)) fail('ไฟล์สำรองมีรหัสซ้ำ'); ids.add(record.id); }
    }
    checkRevisionIdentity(input.revisions);
    checkBackupBytes(input);
    const backup = clone(input);
    await validateImportedImages([...backup.drafts, ...backup.revisions]);
    return transact(['drafts', 'revisions'], 'readwrite', tx => {
      const current = {};
      const merge = () => {
        if (!current.drafts || !current.revisions) return;
        const counts = { draftsAdded: 0, revisionsAdded: 0, skipped: 0 };
        const additions = { drafts: [], revisions: [] };
        for (const type of ['drafts', 'revisions']) {
          const byId = new Map(current[type].map(record => [record.id, record]));
          for (const record of backup[type]) {
            const existing = byId.get(record.id);
            if (existing) { if (canonical(existing) !== canonical(record)) fail('รหัส ' + record.id + ' มีข้อมูลต่างจากในเครื่อง จะไม่นำเข้าและไม่เขียนทับ', 'CONFLICT'); counts.skipped++; }
            else additions[type].push(record);
          }
          if (current[type].length + additions[type].length > MAX_RECORDS) fail('จำนวนรายการหลังนำเข้าเกิน 200 รายการต่อประเภท');
        }
        checkRevisionIdentity([...current.revisions, ...additions.revisions]);
        const mergedDrafts = [...current.drafts, ...additions.drafts];
        const mergedRevisions = [...current.revisions, ...additions.revisions];
        checkTotalStorage([...mergedDrafts, ...mergedRevisions]);
        const draftById = new Map(mergedDrafts.map(record => [record.id, record]));
        for (const revision of mergedRevisions) {
          const source = draftById.get(revision.sourceDraftId);
          if (!source || source.seriesId !== revision.seriesId || source.version < revision.sourceDraftVersion || (source.version === revision.sourceDraftVersion && canonical(source.payload) !== canonical(revision.payload))) fail('ฉบับยืนยันไม่ตรงกับร่างต้นทางในไฟล์สำรอง', 'CONFLICT');
        }
        for (const type of ['drafts', 'revisions']) for (const record of additions[type]) {
          tx.request(tx.store(type).add(record), () => {});
          counts[type === 'drafts' ? 'draftsAdded' : 'revisionsAdded']++;
        }
        tx.result(counts);
      };
      for (const type of ['drafts', 'revisions']) tx.request(tx.store(type).getAll(), records => { current[type] = records; merge(); });
    });
  }
  global.SiteReportStore = Object.freeze({ version: SCHEMA_VERSION, databaseName: DATABASE, StoreError, open, listDrafts, getDraft, saveDraft, getOrCreateDailyDraft, confirmDraft, listRevisions, getRevision, cloneRevision, exportBackup, importBackup });
})(globalThis);
