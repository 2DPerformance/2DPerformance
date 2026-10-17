import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('./account-workspace.js', import.meta.url), 'utf8');

test('recovery adapter is work-only, exact-copy/no-overwrite, and refuses guest/frozen access', () => {
  const { runtime, local } = page();
  local.setItem('sv_proj_legacy', '\u0001LZ1;original');
  local.setItem('sv_auth_user', 'secret auth');
  local.setItem('sv_license_key', 'secret entitlement');
  runtime.install({ uid: 'admin' });
  const access = runtime.getLegacyRecoveryAccess('admin');
  assert.deepEqual(Array.from(access.inventoryLocal(), row => row.key), ['sv_proj_legacy']);
  assert.throws(() => access.readLocal('sv_auth_user'), /Unsupported/);
  assert.throws(() => access.openSourceDatabase('firebaseLocalStorageDb'), /Unsupported/);
  assert.throws(() => access.copyLocal('A', 'sv_proj_legacy', '\u0001LZ1;original'), /not_reserved/);
  access.reserveOwnership('A', [{ kind: 'local', name: 'sv_proj_legacy' }]);
  access.copyLocal('A', 'sv_proj_legacy', '\u0001LZ1;original');
  assert.equal(local.getItem('__sv_workspace_v1:user:A:work:sv_proj_legacy'), '\u0001LZ1;original');
  assert.equal(local.getItem('sv_proj_legacy'), '\u0001LZ1;original');
  assert.throws(() => access.copyLocal('A', 'sv_proj_legacy', '\u0001LZ1;original'), /target_exists/);
  assert.throws(() => access.reserveOwnership('B', [{ kind: 'local', name: 'sv_proj_legacy' }]), /already_assigned/);
  assert.throws(() => access.copyLocal('B', 'sv_proj_legacy', '\u0001LZ1;original'), /not_reserved/);
  assert.equal(access.inventoryLocal().length, 1, 'ownership metadata is never listed as recoverable work');
  runtime.freeze(); assert.throws(() => access.inventoryLocal(), { name: 'InvalidStateError' });
  const guest = page(); guest.runtime.install({ guestId: 'tab' });
  assert.throws(() => guest.runtime.getLegacyRecoveryAccess('tab'), { name: 'InvalidStateError' });
});

class Storage {
  constructor(map = new Map()) { this.map = map; }
  get length() { return this.map.size; }
  getItem(key) { return this.map.get(String(key)) ?? null; }
  setItem(key, value) { this.map.set(String(key), String(value)); }
  removeItem(key) { this.map.delete(String(key)); }
  key(index) { return [...this.map.keys()][index] ?? null; }
  clear() { this.map.clear(); }
}

function page({ local = new Storage(), session = new Storage(), parent, factory, BroadcastChannel } = {}) {
  const events = new EventTarget();
  const window = { localStorage: local, sessionStorage: session, indexedDB: factory,
    Storage, DOMException, Event, BroadcastChannel, frames: [],
    addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) };
  window.window = window;
  window.parent = parent || window;
  const executionContext = vm.createContext(window);
  vm.runInContext(source, executionContext);
  return { window, runtime: window.__svAccountWorkspaceRuntime, local, session,
    evaluate: expression => vm.runInContext(expression, executionContext) };
}

test('A and B cannot list/read/overwrite each other; legacy stays unclaimed; returning A restores A', () => {
  const local = new Storage();
  local.setItem('sv_projects', 'legacy');
  const a = page({ local }); a.runtime.install({ uid: 'A:with/slash' });
  assert.equal(a.window.localStorage.getItem('sv_projects'), null);
  a.window.localStorage.setItem('sv_projects', 'A');
  a.window.localStorage.draft = 'A draft';
  a.window.sessionStorage.setItem('session-work', 'A session');
  const b = page({ local, session: a.session }); b.runtime.install({ uid: 'B' });
  assert.equal(b.window.localStorage.getItem('sv_projects'), null);
  assert.equal(b.window.localStorage.draft, undefined);
  assert.equal(b.window.sessionStorage.getItem('session-work'), null);
  assert.deepEqual(Object.keys(b.window.localStorage), []);
  b.window.localStorage.setItem('sv_projects', 'B');
  assert.equal(a.window.localStorage.getItem('sv_projects'), 'A');
  const again = page({ local }); again.runtime.install({ uid: 'A:with/slash' });
  assert.equal(again.window.localStorage.getItem('sv_projects'), 'A');
  assert.equal(local.getItem('sv_projects'), 'legacy');
});

test('Storage property enumeration/removal/clear apply only to current workspace and preserve auth', () => {
  const { window, runtime, local } = page(); runtime.install({ uid: 'A' });
  window.localStorage.setItem('firebase:authUser:key', 'auth');
  window.localStorage.setItem('sv_machine_id', 'device');
  window.localStorage.foo = 42;
  Object.defineProperty(window.localStorage, 'bar', { value: 'bar', configurable: true });
  assert.equal(window.localStorage.foo, '42');
  assert.equal(window.localStorage.length, 4);
  assert.deepEqual(Object.keys(window.localStorage).sort(), ['bar', 'firebase:authUser:key', 'foo', 'sv_machine_id']);
  assert.equal('foo' in window.localStorage, true);
  delete window.localStorage.foo;
  assert.equal(window.localStorage.foo, undefined);
  window.localStorage.clear();
  assert.equal(window.localStorage.getItem('bar'), null);
  assert.equal(local.getItem('firebase:authUser:key'), 'auth');
  assert.equal(local.getItem('sv_machine_id'), 'device');
  assert.equal(window.localStorage instanceof Storage, true);
});

test('freeze hides old work and prevents queued saves while allowing Firebase logout', () => {
  const { window, runtime, local } = page(); const context = runtime.install({ uid: 'A' });
  const oldStorage = window.localStorage;
  oldStorage.setItem('draft', 'A original');
  runtime.freeze();
  assert.equal(oldStorage.getItem('draft'), null);
  assert.throws(() => oldStorage.setItem('draft', 'queued'), { name: 'InvalidStateError' });
  assert.throws(() => oldStorage.clear(), { name: 'InvalidStateError' });
  assert.throws(() => runtime.install({ uid: 'B' }), { name: 'InvalidStateError' });
  oldStorage.setItem('firebase:authUser:key', 'next auth');
  assert.equal(local.getItem(context.prefix + 'draft'), 'A original');
});

test('guest is separate; identity is required and child inherits immutable parent context', () => {
  const local = new Storage();
  const main = page({ local });
  assert.throws(() => main.runtime.install(), { name: 'SecurityError' });
  main.runtime.install({ guestId: 'tab-1' }); main.window.localStorage.setItem('draft', 'guest');
  const child = page({ local, parent: main.window }); child.runtime.install();
  assert.equal(child.window.localStorage.getItem('draft'), 'guest');
  const user = page({ local }); user.runtime.install({ uid: 'tab-1' });
  assert.equal(user.window.localStorage.getItem('draft'), null);
  assert.throws(() => child.runtime.install({ uid: 'other' }), { name: 'InvalidStateError' });
  main.window.frames.push(child.window); main.runtime.freeze();
  assert.equal(child.runtime.isFrozen(), true);
});

test('IndexedDB scopes open/delete/list, preserves Firebase DB and closes work connections at freeze', async () => {
  const calls = [];
  const requests = [];
  let closed = 0;
  let aborted = 0;
  const factory = {
    open(name, version) { calls.push(['open', name, version]); const request = new EventTarget(); requests.push(request); return request; },
    deleteDatabase(name) { calls.push(['delete', name]); return {}; },
    databases() { return Promise.resolve([{ name: 'legacy', version: 1 }, { name: '__sv_workspace_v1:user:A:work:work', version: 2 }, { name: '__sv_workspace_v1:user:B:work:work', version: 3 }]); },
  };
  const { window, runtime } = page({ factory }); const context = runtime.install({ uid: 'A' });
  window.indexedDB.open('work', 2);
  requests[0].result = Object.assign(new EventTarget(), { close() { closed++; }, transaction() {
    return Object.assign(new EventTarget(), { abort() { aborted++; } });
  } });
  requests[0].dispatchEvent(new Event('success'));
  requests[0].result.transaction('store', 'readwrite');
  window.indexedDB.open('firebaseLocalStorageDb');
  window.indexedDB.deleteDatabase('old');
  assert.deepEqual(calls, [['open', context.prefix + 'work', 2], ['open', 'firebaseLocalStorageDb', undefined], ['delete', context.prefix + 'old']]);
  assert.equal(JSON.stringify(await window.indexedDB.databases()), JSON.stringify([{ name: 'work', version: 2 }]));
  runtime.freeze();
  assert.equal(closed, 1);
  assert.equal(aborted, 1);
  assert.throws(() => requests[0].result.transaction('store'), { name: 'InvalidStateError' });
  assert.throws(() => window.indexedDB.open('work'), { name: 'InvalidStateError' });
});

test('BroadcastChannels cannot cross accounts and close at freeze', () => {
  const channels = [];
  class BroadcastChannel extends EventTarget {
    constructor(name) { super(); this.name = name; this.closed = false; channels.push(this); }
    close() { this.closed = true; }
  }
  const a = page({ BroadcastChannel }); const contextA = a.runtime.install({ uid: 'A' });
  const b = page({ BroadcastChannel }); b.runtime.install({ uid: 'B' });
  const channelA = new a.window.BroadcastChannel('projects');
  const channelB = new b.window.BroadcastChannel('projects');
  assert.equal(channelA.name, contextA.prefix + 'projects');
  assert.notEqual(channelA.name, channelB.name);
  a.runtime.freeze();
  assert.equal(channelA.closed, true);
  assert.equal(channelB.closed, false);
  assert.throws(() => new a.window.BroadcastChannel('projects'), { name: 'InvalidStateError' });
});

test('storage events hide other accounts and translate current account key/storageArea', () => {
  const { window, runtime, local } = page(); const context = runtime.install({ uid: 'A' });
  const received = [];
  window.addEventListener('storage', event => received.push([event.key, event.newValue, event.storageArea === window.localStorage]));
  function emit(key) {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: key }, oldValue: { value: null }, newValue: { value: 'value' }, storageArea: { value: local }, url: { value: 'https://example.test/' } });
    window.dispatchEvent(event);
  }
  emit('__sv_workspace_v1:user:B:work:draft'); emit('legacy'); emit(context.prefix + 'draft');
  assert.deepEqual(received, [['draft', 'value', true]]);
});

test('codec keeps logical JSON and raw scoped accessors without touching another account', () => {
  const local = new Storage();
  const a = page({ local }); const context = a.runtime.install({ uid: 'A' });
  a.runtime.setStorageCodec({ encode: (key, value) => key.startsWith('sv_proj_') ? 'packed:' + value : value,
    decode: value => typeof value === 'string' && value.startsWith('packed:') ? value.slice(7) : value });
  a.window.localStorage.setItem('sv_proj_1', '{"plan":1}');
  assert.equal(a.window.localStorage.getItem('sv_proj_1'), '{"plan":1}');
  assert.equal(local.getItem(context.prefix + 'sv_proj_1'), 'packed:{"plan":1}');
  const raw = a.runtime.getRawAccessors(a.window.localStorage);
  assert.equal(raw.rawGet.call(a.window.localStorage, 'sv_proj_1'), 'packed:{"plan":1}');
  raw.rawSet.call(a.window.localStorage, 'sv_proj_2', 'packed:second');
  assert.equal(a.window.localStorage.getItem('sv_proj_2'), 'second');
  const b = page({ local }); b.runtime.install({ uid: 'B' });
  assert.equal(b.window.localStorage.getItem('sv_proj_1'), null);
});

test('a demo child inherits account and isolates its partition from real work and other demos', () => {
  const local = new Storage();
  const a = page({ local }); a.runtime.install({ uid: 'A' }); a.window.localStorage.setItem('project', 'real');
  const demo = page({ local, parent: a.window }); demo.runtime.install({ partition: 'demo:beam:' });
  assert.equal(demo.runtime.getContext().ownerId, 'A');
  assert.equal(demo.runtime.getContext().partition, 'demo:beam:');
  assert.equal(demo.window.localStorage.getItem('project'), null);
  demo.window.localStorage.setItem('project', 'demo');
  const nested = page({ local, parent: demo.window }); nested.runtime.install();
  assert.equal(nested.window.localStorage.getItem('project'), 'demo');
  assert.throws(() => nested.runtime.install({ partition: '' }), { name: 'InvalidStateError' });
  assert.equal(a.window.localStorage.getItem('project'), 'real');
  assert.deepEqual(Object.keys(a.window.localStorage), ['project']);
  assert.deepEqual(Object.keys(demo.window.localStorage), ['project']);
});

test('native method snapshots survive a later legacy prototype patch', () => {
  const { window, runtime, local } = page(); runtime.install({ uid: 'A' });
  const original = Storage.prototype.getItem;
  try {
    Storage.prototype.getItem = function () { throw new Error('legacy incompatible patch'); };
    window.localStorage.setItem('draft', 'data');
    assert.equal(window.localStorage.getItem('draft'), 'data');
    assert.equal(local.map.size, 1);
  } finally { Storage.prototype.getItem = original; }
});

test('installFrame bootstraps a direct same-origin srcdoc child and rejects foreign target', () => {
  const main = page(); main.runtime.install({ uid: 'A' });
  main.window.rawLocalForTest = main.local;
  const child = main.evaluate(`(() => {
    const frame = { parent: window, document: {}, localStorage: rawLocalForTest, sessionStorage: new Storage(), Storage, DOMException, Event, frames: [] };
    window.__svAccountWorkspaceRuntime.installFrame(frame);
    return frame;
  })()`);
  assert.equal(child.__svAccountWorkspaceRuntime.getContext().ownerId, 'A');
  child.localStorage.setItem('draft', 'child');
  assert.equal(main.window.localStorage.getItem('draft'), 'child');
  assert.throws(() => main.runtime.installFrame({ parent: {} }), { name: 'SecurityError' });
});

test('teaching sample can replace Storage with document memory without changing persistent account data', () => {
  const { window, runtime, local, session } = page();
  const context = runtime.install({ uid: 'A' });
  const scopedStorage = window.localStorage;
  scopedStorage.setItem('project', 'account work');
  const memoryLocal = new Storage();
  const memorySession = new Storage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryLocal });
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: memorySession });
  window.localStorage.setItem('project', 'teaching sample');
  window.sessionStorage.setItem('project', 'teaching sample');
  assert.equal(local.getItem(context.prefix + 'project'), 'account work');
  assert.equal(session.length, 0);
  assert.equal(window.localStorage.getItem('project'), 'teaching sample');
  runtime.freeze();
  assert.throws(() => scopedStorage.setItem('project', 'late write'), { name: 'InvalidStateError' });
  assert.equal(runtime.getContext(), context);
});
