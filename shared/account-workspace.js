/* Per-document account storage boundary. This separates normal app workspaces;
 * it is not encryption or a boundary against hostile same-origin JavaScript. */
(function accountWorkspaceRuntime(root) {
  'use strict';
  if (root.__svAccountWorkspaceRuntime) return;
  var VERSION = 1;
  var NAMESPACE = '__sv_workspace_v1:';
  var context = null;
  var frozen = false;
  var connections = new Set();
  var transactions = new Set();
  var guardedConnections = new WeakSet();
  var channels = new Set();
  var sharedKeys = new Set(['__sv_account_guest_session_v1', 'sv_machine_id']);
  var nativeAreas = {};
  var scopedAreas = {};
  var translatedEvents = new WeakSet();
  var storageCodec = null;
  var rawAccessors = new WeakMap();
  var recoveryLocal = null;
  var recoveryIDB = null;
  var RECOVERY_ASSIGNMENTS_KEY = '__sv_legacy_recovery_assignments_v1';
  // Work records only. Never extend this to auth, entitlement or payment data.
  var legacyKeys = new Set(['sv_projects', 'sv_active_proj', 'structvault_plan', 'sv_plan_auto',
    'sv_plan_asbuilt_auto', 'sv_plan_extension_auto', 'sv_plan_electrical_auto', 'sv_plan_plumbing_auto',
    'sv_plan_v2_auto', 'sv_plan_electrical_backups', 'sv_footing_v1', 'sv_stair', 'sv_seismic',
    'sv_foundation_auto', 'structvault_foundation', 'sv_column', 'sv_builtin_boq_projects_v1',
    'sv_builtin_boq_active_v1', 'sv_builtin_boq_recovery_v1', 'sv_drawing_takeoff_project_v1',
    'sv_drawing_takeoff_recovery_v1', 'sv_df_index', 'sv_df_brand', 'sv_ep_index', 'sv_ep_backups']);
  var legacyDatabases = new Set(['sv-durable-workspaces-v1', 'sv_builtin_boq_files',
    'sv_drawing_takeoff_sources_v1', 'sv-nbv2-pdf-underlay-v1', 'sv_defect', 'naichangyai-site-report-pilot-v1']);
  function legacyWorkKey(key) {
    return typeof key === 'string' && (legacyKeys.has(key)
      || /^(?:sv_proj_|sv_new_building_v2_|sv_ep_proj_|sv_df_proj_)[^\u0000-\u001f]+$/.test(key));
  }

  function invalidState() {
    return new root.DOMException('Workspace changed. Reload before opening or saving work.', 'InvalidStateError');
  }
  function syncParentState() {
    try { if (root.parent && root.parent !== root && root.parent.__svAccountWorkspaceRuntime && root.parent.__svAccountWorkspaceRuntime.isFrozen()) freeze(); } catch (_) {}
  }
  function assertActive() { syncParentState(); if (frozen) throw invalidState(); }
  function shared(key) { return key.indexOf('firebase:') === 0 || sharedKeys.has(key); }
  function physicalKey(key) { return shared(key) ? key : context.prefix + key; }
  function visibleKey(key) {
    syncParentState();
    if (key.indexOf(NAMESPACE) === 0) return !frozen && key.indexOf(context.prefix) === 0 ? key.slice(context.prefix.length) : null;
    return shared(key) ? key : null;
  }
  function makeStorage(area) {
    // Retain native bound accessors. Older compression/demo installers patch
    // Storage.prototype; looking up native methods later would recurse.
    var nativeGet = area.getItem.bind(area);
    var nativeSet = area.setItem.bind(area);
    var nativeRemove = area.removeItem.bind(area);
    var nativeKey = area.key.bind(area);
    var lengthDescriptor = root.Storage && Object.getOwnPropertyDescriptor(root.Storage.prototype, 'length');
    var nativeLength = lengthDescriptor && lengthDescriptor.get ? lengthDescriptor.get.bind(area) : function () { return area.length; };
    if (area === nativeAreas.localStorage) recoveryLocal = { get: nativeGet, set: nativeSet, key: nativeKey, length: nativeLength };
    function keys() {
      var list = [];
      for (var i = 0; i < nativeLength(); i++) {
        var physical = nativeKey(i);
        if (physical === null) continue;
        var key = visibleKey(physical);
        if (key !== null) list.push(key);
      }
      return list;
    }
    function rawGet(key) {
      syncParentState();
      key = String(key);
      if (frozen && !shared(key)) return null;
      return nativeGet(physicalKey(key));
    }
    function rawSet(key, value) {
      key = String(key);
      if (!shared(key)) assertActive();
      nativeSet(physicalKey(key), String(value));
    }
    var methods = {
      getItem: function (key) {
        key = String(key);
        var value = rawGet(key);
        return storageCodec && !shared(key) ? storageCodec.decode(value) : value;
      },
      setItem: function (key, value) {
        key = String(key);
        value = String(value);
        rawSet(key, storageCodec && !shared(key) ? storageCodec.encode(key, value) : value);
      },
      removeItem: function (key) {
        key = String(key);
        if (!shared(key)) assertActive();
        nativeRemove(physicalKey(key));
      },
      clear: function () {
        assertActive();
        // Auth/device records are intentionally excluded from app clear().
        keys().forEach(function (key) { if (!shared(key)) nativeRemove(physicalKey(key)); });
      },
      key: function (index) { return keys()[Number(index) >>> 0] ?? null; },
    };
    var prototype = root.Storage ? root.Storage.prototype : Object.prototype;
    var proxy = new Proxy(Object.create(prototype), {
      get: function (_target, key) {
        if (key === 'length') return keys().length;
        if (key === Symbol.toStringTag) return 'Storage';
        if (Object.prototype.hasOwnProperty.call(methods, key)) return methods[key];
        if (typeof key === 'symbol') return Reflect.get(prototype, key);
        var value = methods.getItem(key);
        return value === null ? Reflect.get(prototype, key) : value;
      },
      set: function (_target, key, value) {
        if (typeof key === 'symbol') return false;
        methods.setItem(key, value); return true;
      },
      deleteProperty: function (_target, key) {
        if (typeof key === 'string') methods.removeItem(key);
        return true;
      },
      ownKeys: function () { return keys(); },
      has: function (_target, key) { return typeof key === 'string' && methods.getItem(key) !== null || key in prototype; },
      getOwnPropertyDescriptor: function (_target, key) {
        if (typeof key !== 'string') return undefined;
        var value = methods.getItem(key);
        return value === null ? undefined : { configurable: true, enumerable: true, writable: true, value: value };
      },
      defineProperty: function (_target, key, descriptor) {
        if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(descriptor, 'value') || descriptor.configurable === false) return false;
        methods.setItem(key, descriptor.value); return true;
      },
      preventExtensions: function () { return false; },
    });
    rawAccessors.set(proxy, Object.freeze({ rawGet: rawGet, rawSet: rawSet,
      rawKey: methods.key, rawLength: function () { return keys().length; } }));
    return proxy;
  }

  function authDatabase(name) { return name === 'firebaseLocalStorageDb' || name === 'firebase-heartbeat-database' || name === 'firebase-installations-database'; }
  function trackTransaction(transaction) {
    if (!transaction) return;
    transactions.add(transaction);
    ['complete', 'abort', 'error'].forEach(function (type) {
      transaction.addEventListener(type, function () { transactions.delete(transaction); }, { once: true });
    });
  }
  function guardConnection(db) {
    if (guardedConnections.has(db)) return;
    guardedConnections.add(db);
    connections.add(db);
    if (typeof db.transaction === 'function') {
      var nativeTransaction = db.transaction.bind(db);
      Object.defineProperty(db, 'transaction', { configurable: false, value: function () {
        assertActive();
        var transaction = nativeTransaction.apply(null, arguments);
        trackTransaction(transaction);
        return transaction;
      } });
    }
    db.addEventListener('close', function () { connections.delete(db); });
  }
  function installIndexedDB() {
    var factory = root.indexedDB;
    if (!factory) return;
    var nativeOpen = factory.open.bind(factory);
    var nativeDelete = factory.deleteDatabase.bind(factory);
    var nativeDatabases = typeof factory.databases === 'function' ? factory.databases.bind(factory) : null;
    recoveryIDB = { open: nativeOpen, databases: nativeDatabases };
    var methods = {
      open: function (name, version) {
        name = String(name);
        var auth = authDatabase(name);
        if (!auth) assertActive();
        var physical = auth ? name : context.prefix + name;
        var request = version === undefined ? nativeOpen(physical) : nativeOpen(physical, version);
        if (!auth) {
          request.addEventListener('upgradeneeded', function () {
            guardConnection(request.result);
            trackTransaction(request.transaction);
            syncParentState();
            if (frozen && request.transaction) request.transaction.abort();
          });
          request.addEventListener('success', function () {
            var db = request.result;
            syncParentState();
            if (frozen) { db.close(); return; }
            guardConnection(db);
          });
        }
        return request;
      },
      deleteDatabase: function (name) {
        name = String(name);
        if (!authDatabase(name)) assertActive();
        return nativeDelete(authDatabase(name) ? name : context.prefix + name);
      },
    };
    if (nativeDatabases) methods.databases = function () {
      assertActive();
      return nativeDatabases().then(function (databases) {
        if (frozen) return [];
        return databases.filter(function (database) { return database.name && database.name.indexOf(context.prefix) === 0; })
          .map(function (database) { return Object.assign({}, database, { name: database.name.slice(context.prefix.length) }); });
      });
    };
    var proxy = new Proxy(factory, { get: function (target, key) {
      if (Object.prototype.hasOwnProperty.call(methods, key)) return methods[key];
      var value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    Object.defineProperty(root, 'indexedDB', { configurable: false, enumerable: true, get: function () { return proxy; } });
  }

  function installBroadcastChannel() {
    var NativeBroadcastChannel = root.BroadcastChannel;
    if (typeof NativeBroadcastChannel !== 'function') return;
    function AccountBroadcastChannel(name) {
      if (!new.target) throw new TypeError('BroadcastChannel must be constructed with new');
      assertActive();
      var channel = new NativeBroadcastChannel(context.prefix + String(name));
      channels.add(channel);
      channel.addEventListener('message', function (event) {
        syncParentState();
        if (frozen) event.stopImmediatePropagation();
      });
      return channel;
    }
    AccountBroadcastChannel.prototype = NativeBroadcastChannel.prototype;
    Object.defineProperty(root, 'BroadcastChannel', { configurable: false, enumerable: true, value: AccountBroadcastChannel });
  }

  function installStorageEvents() {
    if (!root.addEventListener) return;
    root.addEventListener('storage', function (event) {
      if (translatedEvents.has(event)) return;
      var areaName = event.storageArea === nativeAreas.localStorage ? 'localStorage'
        : event.storageArea === nativeAreas.sessionStorage ? 'sessionStorage' : null;
      if (!areaName) return;
      event.stopImmediatePropagation();
      if (event.key === null) return;
      var key = visibleKey(event.key);
      if (key === null) return;
      // StorageEvent's constructor rejects a Proxy as storageArea. Keep the
      // native event type and expose the logical area through own properties.
      var translated = new root.Event('storage');
      Object.defineProperties(translated, {
        key: { value: key }, oldValue: { value: event.oldValue }, newValue: { value: event.newValue },
        url: { value: event.url }, storageArea: { value: scopedAreas[areaName] },
      });
      translatedEvents.add(translated);
      root.dispatchEvent(translated);
    }, true);
  }

  function parentContext() {
    try {
      if (root.parent && root.parent !== root && root.parent.__svAccountWorkspaceRuntime) {
        if (root.parent.__svAccountWorkspaceRuntime.isFrozen()) { frozen = true; return null; }
        return root.parent.__svAccountWorkspaceRuntime.getContext();
      }
    } catch (_) { /* Cross-origin parent grants no workspace identity. */ }
    return null;
  }

  function install(options) {
    options = options || {};
    var inherited = parentContext();
    if (frozen) throw invalidState();
    var uid = typeof options.uid === 'string' && options.uid.trim() ? options.uid : null;
    var guestId = typeof options.guestId === 'string' && options.guestId.trim() ? options.guestId : null;
    var kind = uid ? 'user' : guestId ? 'guest' : null;
    var ownerId = uid || guestId;
    var partition = typeof options.partition === 'string' ? options.partition : '';
    if (inherited) {
      if (kind && (inherited.kind !== kind || inherited.ownerId !== ownerId)) throw invalidState();
      kind = inherited.kind; ownerId = inherited.ownerId;
      partition = typeof options.partition === 'string' ? options.partition : (inherited.partition || '');
      if (inherited.partition && partition !== inherited.partition) throw invalidState();
      (inherited.sharedKeys || []).forEach(function (key) { sharedKeys.add(key); });
      storageCodec = root.parent.__svAccountWorkspaceRuntime.getStorageCodec();
    }
    if (!kind) throw new root.DOMException('An account or tab guest identity is required before opening work.', 'SecurityError');
    if (context) {
      if (context.kind !== kind || context.ownerId !== ownerId || context.partition !== partition || frozen) throw invalidState();
      return context;
    }
    (options.sharedKeys || []).forEach(function (key) {
      if (typeof key === 'string' && key.indexOf(NAMESPACE) !== 0) sharedKeys.add(key);
    });
    context = Object.freeze({ version: VERSION, kind: kind, ownerId: ownerId, partition: partition,
      prefix: NAMESPACE + kind + ':' + encodeURIComponent(ownerId) + ':' + (partition ? 'partition:' + encodeURIComponent(partition) + ':' : 'work:'),
      sharedKeys: Object.freeze(Array.from(sharedKeys)) });
    try {
      ['localStorage', 'sessionStorage'].forEach(function (name) {
        nativeAreas[name] = root[name];
        scopedAreas[name] = makeStorage(nativeAreas[name]);
        // SC01 teaching samples deliberately replace these with document-only
        // memory stores; permit that established nonpersistent adapter.
        Object.defineProperty(root, name, { configurable: true, enumerable: true, get: function () { return scopedAreas[name]; } });
      });
      installIndexedDB();
      installBroadcastChannel();
      installStorageEvents();
    } catch (error) {
      frozen = true;
      throw error;
    }
    return context;
  }

  function freeze() {
    frozen = true;
    transactions.forEach(function (transaction) { try { transaction.abort(); } catch (_) {} });
    transactions.clear();
    connections.forEach(function (db) { try { db.close(); } catch (_) {} });
    connections.clear();
    channels.forEach(function (channel) { try { channel.close(); } catch (_) {} });
    channels.clear();
    try {
      for (var i = 0; i < root.frames.length; i++) {
        try { var runtime = root.frames[i].__svAccountWorkspaceRuntime; if (runtime) runtime.freeze(); } catch (_) {}
      }
    } catch (_) {}
  }
  function installFrame(target) {
    assertActive();
    if (!context || !target || target.parent !== root) throw new root.DOMException('Only a direct same-origin child can inherit this workspace.', 'SecurityError');
    // Accessing document rejects cross-origin child windows before installation.
    if (!target.document) throw new root.DOMException('A same-origin frame document is required.', 'SecurityError');
    accountWorkspaceRuntime(target);
    return target.__svAccountWorkspaceRuntime.install();
  }
  // This capability is for the server-verified admin recovery service only.
  // It does not make browser storage a security boundary against DevTools/XSS.
  function getLegacyRecoveryAccess(expectedUid) {
    function check() {
      assertActive();
      if (!context || context.kind !== 'user' || context.ownerId !== expectedUid || context.partition
        || (root.parent && root.parent !== root)) throw invalidState();
    }
    function targetPrefix(uid) {
      check();
      if (typeof uid !== 'string' || !uid.trim() || uid.length > 128 || /[\u0000-\u001f]/.test(uid)) throw new TypeError('Invalid recovery target UID');
      return NAMESPACE + 'user:' + encodeURIComponent(uid) + ':work:';
    }
    function sourceId(source) {
      if (!source || (source.kind === 'local' ? !legacyWorkKey(source.name)
        : source.kind === 'database' ? !legacyDatabases.has(source.name) : true)) throw new TypeError('Unsupported recovery source');
      return source.kind + ':' + source.name;
    }
    function ownership() {
      check();
      var raw = recoveryLocal.get(RECOVERY_ASSIGNMENTS_KEY);
      if (raw === null) return { raw: null, rows: [] };
      var value;
      try { value = JSON.parse(raw); } catch (_) { throw new Error('recovery_ownership_ledger_corrupt'); }
      if (value.schema !== 1 || !Array.isArray(value.assignments)) throw new Error('recovery_ownership_ledger_corrupt');
      var ids = new Set();
      value.assignments.forEach(function (row) {
        var id = sourceId(row);
        if (ids.has(id) || typeof row.uid !== 'string' || !row.uid.trim()) throw new Error('recovery_ownership_ledger_corrupt');
        ids.add(id);
      });
      return { raw: raw, rows: value.assignments };
    }
    function requireOwner(uid, kind, name) {
      var id = sourceId({ kind: kind, name: name });
      var row = ownership().rows.find(function (item) { return sourceId(item) === id; });
      if (!row || row.uid !== uid) throw new Error('recovery_source_not_reserved_for_target');
    }
    check();
    return Object.freeze({
      assertActive: check,
      reserveOwnership: function (uid, sources) {
        targetPrefix(uid); // Identity and recipient validation before global metadata access.
        var before = ownership();
        var rows = before.rows.slice();
        sources.forEach(function (source) {
          var id = sourceId(source);
          var existing = rows.find(function (row) { return sourceId(row) === id; });
          if (existing && existing.uid !== uid) throw new Error('recovery_source_already_assigned');
          if (!existing) rows.push({ kind: source.kind, name: source.name, uid: uid });
        });
        if (rows.length === before.rows.length) return;
        var next = JSON.stringify({ schema: 1, assignments: rows });
        if (recoveryLocal.get(RECOVERY_ASSIGNMENTS_KEY) !== before.raw) throw new Error('recovery_ownership_ledger_changed');
        recoveryLocal.set(RECOVERY_ASSIGNMENTS_KEY, next);
        if (recoveryLocal.get(RECOVERY_ASSIGNMENTS_KEY) !== next) throw new Error('recovery_ownership_ledger_readback_failed');
      },
      inventoryLocal: function () {
        check(); var entries = [];
        for (var i = 0; i < recoveryLocal.length(); i++) {
          var key = recoveryLocal.key(i);
          if (legacyWorkKey(key)) entries.push({ key: key, chars: (recoveryLocal.get(key) || '').length });
        }
        return entries;
      },
      readLocal: function (key) { check(); if (!legacyWorkKey(key)) throw new TypeError('Unsupported legacy work key'); return recoveryLocal.get(key); },
      hasTargetLocal: function (uid, key) {
        if (!legacyWorkKey(key)) throw new TypeError('Unsupported legacy work key');
        return recoveryLocal.get(targetPrefix(uid) + key) !== null;
      },
      copyLocal: function (uid, key, expectedValue) {
        check(); if (!legacyWorkKey(key)) throw new TypeError('Unsupported legacy work key');
        requireOwner(uid, 'local', key);
        var target = targetPrefix(uid) + key;
        if (recoveryLocal.get(key) !== expectedValue || expectedValue === null) throw new Error('legacy_source_changed');
        if (recoveryLocal.get(target) !== null) throw new Error('recovery_target_exists');
        recoveryLocal.set(target, expectedValue); // Exact persisted bytes, including compression.
        if (recoveryLocal.get(target) !== expectedValue) throw new Error('recovery_readback_failed');
      },
      listDatabases: async function () {
        check();
        if (!recoveryIDB || !recoveryIDB.databases) throw new Error('recovery_database_inventory_unavailable');
        var list = await recoveryIDB.databases(); check(); return list;
      },
      supportsDatabase: function (name) { return legacyDatabases.has(name); },
      openSourceDatabase: function (name) {
        check(); if (!legacyDatabases.has(name)) throw new TypeError('Unsupported legacy work database');
        return recoveryIDB.open(name);
      },
      targetDatabaseName: function (uid, name) {
        if (!legacyDatabases.has(name)) throw new TypeError('Unsupported legacy work database');
        return targetPrefix(uid) + name;
      },
      openTargetDatabase: function (uid, name, version) {
        check(); if (!legacyDatabases.has(name)) throw new TypeError('Unsupported legacy work database');
        requireOwner(uid, 'database', name);
        return recoveryIDB.open(targetPrefix(uid) + name, version);
      },
      trackDatabase: function (db) { check(); guardConnection(db); },
      trackTransaction: function (transaction) { check(); trackTransaction(transaction); },
    });
  }
  Object.defineProperty(root, '__svAccountWorkspaceRuntime', { value: Object.freeze({
    install: install, installFrame: installFrame, freeze: freeze, getContext: function () { return context; },
    isFrozen: function () { return frozen; },
    getRawAccessors: function (storage) { return rawAccessors.get(storage) || null; },
    getLegacyRecoveryAccess: getLegacyRecoveryAccess,
    getStorageCodec: function () { return storageCodec; },
    setStorageCodec: function (codec) {
      assertActive();
      if (!codec || typeof codec.encode !== 'function' || typeof codec.decode !== 'function') throw new TypeError('Storage codec requires encode and decode functions');
      storageCodec = Object.freeze({ encode: codec.encode, decode: codec.decode });
    },
  }), configurable: false, writable: false });
})(typeof window !== 'undefined' ? window : globalThis);
