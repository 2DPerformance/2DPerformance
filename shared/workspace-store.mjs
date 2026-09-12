// Explicit asynchronous storage. Never installs a Storage.prototype shim.
export const WORKSPACE_DATABASE = 'sv-durable-workspaces-v1';
const TABLE = 'records';
const SCHEMA = 1;

export class WorkspaceStorageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'WorkspaceStorageError';
    this.code = code;
    Object.assign(this, details);
  }
}

function failure(error, fallback = 'STORAGE_FAILED') {
  if (error instanceof WorkspaceStorageError) return error;
  const name = String(error?.name || '');
  const code = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
    ? 'QUOTA_EXCEEDED'
    : name === 'SecurityError' || name === 'NotAllowedError' ? 'STORAGE_UNAVAILABLE' : fallback;
  return new WorkspaceStorageError(code, error?.message || 'ไม่สามารถบันทึกข้อมูลในเครื่องได้', { cause: error });
}

function checkKey(key) {
  if (typeof key !== 'string' || !key || key.length > 512 || /[\u0000-\u001f]/u.test(key)) {
    throw new WorkspaceStorageError('INVALID_KEY', 'ชื่อข้อมูลจัดเก็บไม่ถูกต้อง');
  }
}

function inspectRecord(key, record) {
  if (record === undefined || record === null) return { key, value: null, revision: 0 };
  if (record.schema !== SCHEMA || record.key !== key || !Number.isSafeInteger(record.revision)
    || record.revision < 1 || !(record.value === null || typeof record.value === 'string')) {
    throw new WorkspaceStorageError('CORRUPT_RECORD', 'ข้อมูลที่บันทึกไว้ไม่สมบูรณ์ จึงยังไม่เขียนทับ', { key });
  }
  if (record.legacy && (typeof record.legacy.sourceKey !== 'string'
    || !(record.legacy.sourceValue === null || typeof record.legacy.sourceValue === 'string'))) {
    throw new WorkspaceStorageError('CORRUPT_RECORD', 'ข้อมูลการย้ายจากรุ่นเดิมไม่สมบูรณ์ จึงยังไม่เขียนทับ', { key });
  }
  return { ...record, ...(record.legacy ? { legacy: { ...record.legacy } } : {}) };
}

function validateChanges(changes) {
  if (!Array.isArray(changes) || !changes.length || changes.length > 10000) {
    throw new WorkspaceStorageError('INVALID_TRANSACTION', 'ไม่มีรายการบันทึกหรือมีรายการมากเกินไป');
  }
  const keys = new Set();
  return changes.map(change => {
    checkKey(change?.key);
    if (keys.has(change.key)) throw new WorkspaceStorageError('DUPLICATE_KEY', 'รายการบันทึกซ้ำ');
    keys.add(change.key);
    if (!(typeof change.value === 'string' || change.value === null)) {
      throw new WorkspaceStorageError('INVALID_VALUE', 'ข้อมูลต้องเป็นข้อความหรือรายการลบที่ระบุชัด');
    }
    if (!Number.isSafeInteger(change.expectedRevision) || change.expectedRevision < 0) {
      throw new WorkspaceStorageError('REVISION_REQUIRED', 'ต้องระบุรุ่นข้อมูลก่อนบันทึก');
    }
    return { ...change };
  });
}

/** Storage isolation only; this never grants Demo access or entitlement. */
export function resolveWorkspaceDatabaseName({ databaseName = WORKSPACE_DATABASE, indexedDB = globalThis.indexedDB,
  context = globalThis.window?.__svMarketplaceDemoContext, search = globalThis.window?.location?.search || '' } = {}) {
  const requestedDemo = new URLSearchParams(search).has('sv-demo') || new URLSearchParams(search).has('sv-demo-session');
  if (!context) {
    if (requestedDemo) throw new WorkspaceStorageError('DEMO_STORAGE_UNAVAILABLE', 'ยังยืนยันพื้นที่ทดลองไม่ได้ จึงไม่เปิดข้อมูลจริง');
    return databaseName;
  }
  if (typeof context.storagePrefix !== 'string' || !/^__sv_demo__[a-zA-Z0-9_-]{1,64}__[a-zA-Z0-9_-]{1,64}__$/.test(context.storagePrefix)) {
    throw new WorkspaceStorageError('DEMO_STORAGE_UNAVAILABLE', 'พื้นที่จัดเก็บของ Demo ไม่สมบูรณ์ จึงไม่เปิดข้อมูลจริง');
  }
  // React bootstrap already namespaces IDBFactory.open. Static standalone Demo
  // bootstrap namespaces only Storage; prefix explicitly there, never twice.
  return indexedDB?.__svDemoPatched ? databaseName : `${context.storagePrefix}${databaseName}`;
}

/** Native backend: revision checks and writes share ONE readwrite transaction. */
export async function createIndexedDBWorkspaceBackend({ indexedDB = globalThis.indexedDB,
  databaseName = WORKSPACE_DATABASE, openTimeoutMs = 10000 } = {}) {
  if (!indexedDB?.open) throw new WorkspaceStorageError('STORAGE_UNAVAILABLE', 'เบราว์เซอร์ไม่อนุญาตฐานข้อมูลในเครื่อง');
  databaseName = resolveWorkspaceDatabaseName({ databaseName, indexedDB });
  const database = await new Promise((resolve, reject) => {
    let request;
    let settled = false;
    const finish = (error, db) => {
      if (settled) { db?.close(); return; }
      settled = true;
      clearTimeout(timer);
      error ? reject(failure(error)) : resolve(db);
    };
    const timer = setTimeout(() => finish(new WorkspaceStorageError('OPEN_TIMEOUT', 'เปิดฐานข้อมูลไม่สำเร็จ กรุณาปิดแท็บรุ่นเก่าแล้วลองใหม่')), openTimeoutMs);
    try { request = indexedDB.open(databaseName, SCHEMA); }
    catch (error) { finish(error); return; }
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(TABLE)) request.result.createObjectStore(TABLE, { keyPath: 'key' });
    };
    request.onblocked = () => finish(new WorkspaceStorageError('DATABASE_BLOCKED', 'ฐานข้อมูลถูกแท็บอื่นใช้งาน กรุณาปิดแท็บรุ่นเก่าแล้วลองใหม่'));
    request.onerror = () => finish(request.error);
    request.onsuccess = () => finish(null, request.result);
  });
  database.onversionchange = () => database.close();

  function transaction(mode) {
    try {
      return mode === 'readwrite'
        ? database.transaction(TABLE, mode, { durability: 'strict' })
        : database.transaction(TABLE, mode);
    } catch (error) {
      if (error?.name === 'TypeError' && mode === 'readwrite') return database.transaction(TABLE, mode);
      throw failure(error);
    }
  }

  function readMany(keys) {
    return new Promise((resolve, reject) => {
      let tx;
      const rows = new Map();
      try {
        tx = transaction('readonly');
        const table = tx.objectStore(TABLE);
        for (const key of keys) {
          const request = table.get(key);
          request.onsuccess = () => rows.set(key, request.result);
        }
      } catch (error) { reject(failure(error)); return; }
      tx.oncomplete = () => resolve(rows);
      tx.onabort = () => reject(failure(tx.error, 'TRANSACTION_ABORTED'));
      tx.onerror = () => {}; // onabort is the terminal event.
    });
  }

  return {
    async read(key) { return (await readMany([key])).get(key); },
    async list() {
      return new Promise((resolve, reject) => {
        let tx;
        let rows = [];
        try {
          tx = transaction('readonly');
          const request = tx.objectStore(TABLE).getAll();
          request.onsuccess = () => { rows = request.result; };
        } catch (error) { reject(failure(error)); return; }
        tx.oncomplete = () => resolve(rows);
        tx.onabort = () => reject(failure(tx.error, 'TRANSACTION_ABORTED'));
        tx.onerror = () => {};
      });
    },
    async commit(changes) {
      const written = await new Promise((resolve, reject) => {
        let tx;
        let errorDetail;
        const before = new Map();
        let result = [];
        const abort = error => {
          errorDetail = failure(error);
          try { tx.abort(); } catch { reject(errorDetail); }
        };
        try {
          tx = transaction('readwrite');
          const table = tx.objectStore(TABLE);
          let remaining = changes.length;
          for (const change of changes) {
            const request = table.get(change.key);
            request.onsuccess = () => {
              try {
                const current = inspectRecord(change.key, request.result);
                if (current.revision !== change.expectedRevision) {
                  throw new WorkspaceStorageError('CONFLICT', 'ข้อมูลถูกแก้จากอีกแท็บแล้ว กรุณาเก็บสำเนางานนี้ก่อนโหลดข้อมูลใหม่', {
                    key: change.key, expectedRevision: change.expectedRevision, actualRevision: current.revision,
                  });
                }
                before.set(change.key, current);
                remaining -= 1;
                if (remaining) return;
                result = changes.map(item => {
                  const previous = before.get(item.key);
                  if (item.checkOnly === true) return previous;
                  if (previous.revision >= Number.MAX_SAFE_INTEGER) throw new WorkspaceStorageError('REVISION_OVERFLOW', 'รุ่นข้อมูลเกินขอบเขต');
                  const legacy = item.legacy || previous.legacy;
                  return { schema: SCHEMA, key: item.key, value: item.value,
                    revision: previous.revision + 1, updatedAt: new Date().toISOString(),
                    ...(legacy ? { legacy: { ...legacy } } : {}) };
                });
                for (let index = 0; index < result.length; index += 1) {
                  if (changes[index].checkOnly !== true) table.put(result[index]);
                }
              } catch (error) { abort(error); }
            };
          }
        } catch (error) { if (tx) abort(error); else reject(failure(error)); return; }
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(errorDetail || failure(tx.error, 'TRANSACTION_ABORTED'));
        tx.onerror = () => {};
      });
      // An IDB request succeeding is not a committed save. Reach here only after
      // transaction completion, then verify using a new readonly transaction.
      const after = await readMany(written.map(row => row.key));
      for (const row of written) {
        const actual = inspectRecord(row.key, after.get(row.key));
        if (actual.revision !== row.revision || actual.value !== row.value) {
          throw new WorkspaceStorageError('VERIFY_SUPERSEDED', 'ข้อมูลเปลี่ยนระหว่างตรวจการบันทึก กรุณาตรวจรุ่นล่าสุดก่อนทำต่อ', { key: row.key, committed: true });
        }
      }
      return written;
    },
    close() { database.close(); },
  };
}

/** Backend injection is for deterministic failure tests; production uses IDB. */
export async function openWorkspaceStore(options = {}) {
  const backend = options.backend || await createIndexedDBWorkspaceBackend(options);
  const legacyBindings = new Map();

  function inspectLegacy(key, record) {
    const binding = legacyBindings.get(key);
    if (!binding) return;
    let current;
    try { current = binding.storage.getItem(binding.legacyKey); }
    catch (error) { throw failure(error, 'LEGACY_READ_FAILED'); }
    // This module never removes the retained source. A changed OR deleted
    // source can only come from an old tab/external clear and must fail closed.
    const sourceValue = record.legacy ? record.legacy.sourceValue : binding.sourceValue;
    if (current !== sourceValue) {
      throw new WorkspaceStorageError('LEGACY_CHANGED', 'พบข้อมูลจากเว็บรุ่นเก่าที่เปลี่ยนไป กรุณาสำรองทั้งสองชุดก่อนดำเนินการ', { key, legacyKey: binding.legacyKey });
    }
  }

  const store = {
    /** Read-only rescue, deliberately bypassing schema/legacy HOLD for export.
     * Never feed this envelope into normal workspaces without validation. */
    async readRecovery(key) {
      checkKey(key);
      try { return { key, storedRecord: (await backend.read(key)) ?? null }; }
      catch (error) { throw failure(error); }
    },
    async listRecovery(prefix = '') {
      try {
        return (await backend.list()).filter(row => typeof row?.key === 'string' && row.key.startsWith(prefix))
          .map(row => ({ key: row.key, storedRecord: row }));
      } catch (error) { throw failure(error); }
    },
    async read(key) {
      checkKey(key);
      try {
        const record = inspectRecord(key, await backend.read(key));
        inspectLegacy(key, record);
        return record;
      } catch (error) { throw failure(error); }
    },
    async commit(input) {
      const changes = validateChanges(input);
      for (const change of changes) {
        const binding = legacyBindings.get(change.key);
        if (binding) {
          const previous = inspectRecord(change.key, await backend.read(change.key));
          inspectLegacy(change.key, previous);
          // Persist the originally absent source too: an old tab creating that
          // localStorage key later must HOLD, including after a fresh reload.
          if (!change.legacy && !previous.legacy) change.legacy = {
            sourceKey: binding.legacyKey, sourceValue: binding.sourceValue, copiedAt: new Date().toISOString(),
          };
        }
      }
      try { return await backend.commit(changes); }
      catch (error) { throw failure(error); }
    },
    async write(key, value, { expectedRevision } = {}) {
      return (await store.commit([{ key, value, expectedRevision }]))[0];
    },
    async readOrMigrate(key, { storage = globalThis.localStorage, legacyKey = key } = {}) {
      checkKey(key);
      checkKey(legacyKey);
      if (!storage?.getItem) throw new WorkspaceStorageError('LEGACY_READ_FAILED', 'อ่านข้อมูลเดิมไม่ได้ จึงยังไม่เริ่มโครงการว่าง');
      let boundSource;
      try { boundSource = storage.getItem(legacyKey); }
      catch (error) { throw failure(error, 'LEGACY_READ_FAILED'); }
      legacyBindings.set(key, { storage, legacyKey, sourceValue: boundSource });
      let record = await store.read(key);
      if (record.revision > 0) return record;
      let sourceValue;
      try { sourceValue = storage.getItem(legacyKey); }
      catch (error) { throw failure(error, 'LEGACY_READ_FAILED'); }
      if (sourceValue === null) return record;
      try {
        [record] = await store.commit([{ key, value: sourceValue, expectedRevision: 0,
          legacy: { sourceKey: legacyKey, sourceValue, copiedAt: new Date().toISOString() } }]);
      } catch (error) {
        if (error.code !== 'CONFLICT') throw error;
        record = await store.read(key);
      }
      if (storage.getItem(legacyKey) !== sourceValue) {
        throw new WorkspaceStorageError('LEGACY_CHANGED', 'ข้อมูลเดิมเปลี่ยนระหว่างย้าย จึงยังไม่เปิดให้แก้ต่อ', { key, legacyKey });
      }
      // No removeItem/clear: the original is retained for rollback and rescue.
      return record;
    },
    async list(prefix = '') {
      const rows = await backend.list();
      return rows.filter(row => typeof row?.key === 'string' && row.key.startsWith(prefix))
        .map(row => inspectRecord(row.key, row));
    },
    close() { backend.close?.(); },
  };
  return Object.freeze(store);
}

export function workspaceStorageMessage(error) {
  switch (error?.code) {
    case 'CONFLICT': case 'VERIFY_SUPERSEDED': return 'ข้อมูลถูกแก้จากอีกแท็บ งานนี้ยังไม่ถูกเขียนทับ กรุณาดาวน์โหลดสำเนาก่อนโหลดข้อมูลล่าสุด';
    case 'LEGACY_CHANGED': return 'พบข้อมูลจากเว็บรุ่นเก่าที่เปลี่ยนไป กรุณาปิดแท็บรุ่นเก่าและเก็บสำเนาทั้งสองชุด';
    case 'QUOTA_EXCEEDED': return 'พื้นที่เก็บในเครื่องไม่พอ งานล่าสุดยังอยู่ในหน้านี้ กรุณาดาวน์โหลดสำรองก่อนปิด';
    case 'CORRUPT_RECORD': return 'ข้อมูลเดิมไม่สมบูรณ์ ระบบยังไม่เขียนทับ กรุณาเก็บไฟล์สำรองเพื่อตรวจสอบ';
    default: return error?.message || 'บันทึกลงเครื่องไม่สำเร็จ งานล่าสุดยังอยู่ในหน้านี้ กรุณาดาวน์โหลดสำรองก่อนปิด';
  }
}
