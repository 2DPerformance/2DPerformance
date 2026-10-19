import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { installFemWorkspaceBoundary } from '../../src/features/admin/femWorkspaceBoundary.mjs';

const bootstrap = fs.readFileSync(new URL('./account-frame-bootstrap.js', import.meta.url), 'utf8');
const entries = {
  "bm02-continuous-beam-mockup.html": "/continuous-beam",
  "spread-footing-workbench-mockup.html": "/spread-footing",
  "corbel-design-mockup.html": "/concrete-corbel",
  "stair-design-workbench.html": "/stair-design",
  "steel-box-cantilever-connection-workbench.html": "/steel-box-cantilever-connection",
  "floor-pour-scaffolding-workbench.html": "/floor-pour-scaffolding",
  "sl04-redesign-mockup-v1.html": "/concrete-slab-on-ground",
  "retaining-wall/index.html": "/retaining-wall",
  "retaining-wall/systems.html": "/retaining-wall",
  "retaining-wall-workbench.html": "/retaining-wall",
  "footing-f2-f8-workbench.html": "/footing-f2-f8",
  "ncy-sign/index.html": "/billboard-design",
  "ncy-sign/overhang.html": "/billboard-design",
  "boq-traceability-mockup.html": "/boq-traceability",
  "site-report-local/index.html": "/daily-report",
  "site-report-local/account.html": "/daily-report",
  "extension-3d-first.html": "/extension",
  "guided-plan-workbench-mockup.html": "/new-building-v2",
  "one-pile-mother-card-mockup.html": "/footing-1pile",
  "slab-on-ground/index.html": "/concrete-slab-on-ground",
  "procurement-workbench-mockup.html": "/procurement"
};
function frame({ hasParent = true, parentFrozen = false, parentReady = true, ownReady = true, installThrows = false, wrongContext = false, route = '/daily-report', foreign = false, search = '', parentPartition = '' } = {}) {
  const context = { kind: 'user', ownerId: 'account-a', prefix: 'account-a:', partition: parentPartition };
  let installs = 0, stopped = false, redirect = '';
  const root = {
    document: { currentScript: { getAttribute: () => route }, documentElement: { hidden: false } },
    location: { origin: 'https://example.test', search, replace: value => { redirect = value; } },
    stop() { stopped = true; },
  };
  root.parent = hasParent ? {
    location: { origin: foreign ? 'https://other.test' : root.location.origin },
    __svAccountWorkspaceRuntime: parentReady ? { isFrozen: () => parentFrozen, getContext: () => context } : undefined,
  } : root;
  root.__svAccountWorkspaceRuntime = ownReady ? {
    install(options) { installs++; if (installThrows) throw new Error('blocked'); return { ...context, ownerId: wrongContext ? 'account-b' : context.ownerId, partition: options?.partition || parentPartition }; },
    isFrozen: () => false,
  } : undefined;
  vm.runInNewContext(bootstrap, { window: root, URLSearchParams });
  return { installs, stopped, redirect, hidden: root.document.documentElement.hidden };
}
test('every active static workbench installs isolation before its first work script', () => {
  for (const [path, route] of Object.entries(entries)) {
    const html = fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
    const scripts = [...html.matchAll(/<script\b([^>]*)>/gi)].slice(0, 2).map(match => match[1]);
    assert.match(scripts[0], /src="\/shared\/account-workspace\.js"/, path);
    assert.match(scripts[1], /src="\/shared\/account-frame-bootstrap\.js"/, path);
    assert.ok(scripts[1].includes('data-account-route="' + route + '"'), path);
  }
  const takeoff = fs.readFileSync(new URL('../../drawing-takeoff-workbench.html', import.meta.url), 'utf8');
  const first = [...takeoff.matchAll(/<script\b([^>]*)>/gi)].slice(0, 2).map(match => match[1]);
  assert.match(first[0], /src="\/shared\/account-workspace\.js"/);
  assert.match(first[1], /src="\/shared\/account-frame-bootstrap\.js"/);
  assert.ok(first[1].includes('data-account-route="/drawing-takeoff"'));
});
test('same-origin workbench inherits only the active parent workspace', () => {
  assert.deepEqual(frame(), { installs: 1, stopped: false, redirect: '', hidden: false });
});
test('static demos request a separate partition and normal nested frames inherit it', () => {
  assert.equal(frame({ search: '?sv-demo=slab&sv-demo-session=session_123456' }).stopped, false);
  assert.equal(frame({ parentPartition: '__sv_demo__slab__session_123456__' }).stopped, false);
});
test('legacy demo installer keeps account proxy and refuses mismatched partitions', () => {
  const source = fs.readFileSync(new URL('../marketplace-demo-storage.js', import.meta.url), 'utf8');
  for (const matched of [true, false]) {
    let frozen = false, stopped = false;
    function Storage() {}
    const original = function () {};
    Storage.prototype.getItem = original;
    const root = {
      location: { search: '?sv-demo=slab&sv-demo-session=session_123456' },
      document: { documentElement: { hidden: false } },
      stop() { stopped = true; },
      __svAccountWorkspaceRuntime: {
        getContext: () => ({ partition: matched ? '__sv_demo__slab__session_123456__' : '' }),
        isFrozen: () => frozen,
        freeze() { frozen = true; },
      },
    };
    vm.runInNewContext(source, { window: root, document: root.document, Storage, URLSearchParams, console: { error() {} } });
    assert.equal(Storage.prototype.getItem, original);
    assert.equal(stopped, !matched);
    assert.equal(frozen, !matched);
    assert.equal(Boolean(root.__svMarketplaceDemoContext), matched);
  }
});
test('SC01 sample still replaces scoped work storage with document-only memory', () => {
  class Storage {
    constructor() { this.values = new Map(); }
    get length() { return this.values.size; }
    key(index) { return [...this.values.keys()][index] ?? null; }
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
    clear() { this.values.clear(); }
  }
  const native = new Storage();
  const root = {
    Storage, DOMException, localStorage: native, sessionStorage: new Storage(),
    location: { origin: 'https://example.test', hostname: 'example.test', search: '?sc01-sample=plain' },
    addEventListener() {}, frames: [],
  };
  root.parent = root;
  const realm = { window: root, URLSearchParams, console };
  vm.runInNewContext(fs.readFileSync(new URL('./account-workspace.js', import.meta.url), 'utf8'), realm);
  root.__svAccountWorkspaceRuntime.install({ uid: 'account-a' });
  const scoped = root.localStorage;
  scoped.setItem('ncy.connection.v5.draft', 'private real project');
  root.parent = { location: { origin: root.location.origin, pathname: '/steel-box-cantilever-connection' } };
  const html = fs.readFileSync(new URL('../steel-box-cantilever-connection-workbench.html', import.meta.url), 'utf8');
  const guard = html.match(/<script id="ncy-sc01-customer-entry-guard">([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(guard, realm);
  assert.equal(root.__scSampleMode, 'plain');
  assert.equal(root.__scWorkbenchBootFailed, false);
  assert.equal(root.localStorage.getItem('ncy.connection.v5.draft'), null);
  root.localStorage.setItem('ncy.connection.v5.draft', 'sample only');
  assert.equal(root.localStorage.getItem('ncy.connection.v5.draft'), 'sample only');
  assert.equal(scoped.getItem('ncy.connection.v5.draft'), 'private real project');
  assert.equal(native.length, 1);
});
test('direct link, foreign frame, missing/frozen/mismatched parent fail closed', () => {
  for (const options of [
    { hasParent: false }, { foreign: true }, { parentReady: false },
    { parentFrozen: true }, { ownReady: false }, { installThrows: true }, { wrongContext: true },
  ]) {
    const actual = frame(options);
    assert.equal(actual.stopped, true);
    assert.equal(actual.hidden, true);
    assert.equal(actual.redirect, '/daily-report');
  }
});
test('redirect route cannot become a foreign or script URL', () => {
  for (const route of ['//evil.test/', 'https://evil.test/', 'javascript:alert(1)', '/path?next=evil']) {
    assert.equal(frame({ hasParent: false, route }).redirect, '/');
  }
});
test('FEM adapter installs synchronously before native scripts and preserves native document', () => {
  const source = '<!doctype html><html><head><meta charset="utf-8"><script>localStorage.getItem("model")</script></head><body>FEM</body></html>';
  const patched = installFemWorkspaceBoundary(source);
  const boundary = patched.match(/<script data-account-workspace-boundary="fem">[\s\S]*?<\/script>/)[0];
  assert.match(boundary, /installFrame\(window\)/);
  assert.ok(patched.indexOf(boundary) < patched.indexOf('localStorage.getItem'));
  assert.equal(patched.replace(boundary, ''), source);
  assert.throws(() => installFemWorkspaceBoundary('<body>bad</body>'), /invalid_preview/);
});
test('slab runtime uses parent frame installer after original source verification, without adding external scripts', () => {
  const source = fs.readFileSync(new URL('../slab-original-runtime.js', import.meta.url), 'utf8');
  const bridge = source.match(/storageBridge\.textContent = ([^\n]+)/)[1];
  assert.match(bridge, /installFrame\(window\)/);
  assert.ok(bridge.indexOf('installFrame') < bridge.indexOf('window.SVConcreteSaveSafety='));
  assert.ok(source.indexOf("if(doc.querySelector('script[src]'))") < source.indexOf('storageBridge.textContent'));
  assert.match(source, /doc\.head\.prepend\(storageBridge\)/);
});
test('Daily Report rejects missing or frozen account context before opening its browser database', async () => {
  const source = fs.readFileSync(new URL('../site-report-local/storage.js', import.meta.url), 'utf8');
  for (const frozen of [false, true]) {
    let opened = 0;
    const root = { document: {}, indexedDB: { open() { opened++; throw new Error('unexpected native database'); } } };
    if (frozen) root.__svAccountWorkspaceRuntime = { getContext: () => ({ kind: 'user', ownerId: 'account-a' }), isFrozen: () => true };
    const realm = vm.createContext(root);
    vm.runInContext('document.defaultView = globalThis;', realm);
    vm.runInContext(source, realm);
    await assert.rejects(root.SiteReportStore.open(), error => error.code === 'WORKSPACE_UNAVAILABLE');
    assert.equal(opened, 0);
  }
});
test('Daily Report offline shell includes guarded account entry and waits for old clients to close', async () => {
  const source = fs.readFileSync(new URL('../site-report-local/sw.js', import.meta.url), 'utf8');
  const handlers = new Map(), saved = new Map();
  let installed = [], activated = 0, work;
  const cache = {
    async match(url) { return saved.get(url); },
    async addAll(requests) { installed = requests.map(request => request.url); for (const url of installed) saved.set(url, { ok: true }); },
  };
  const self = {
    registration: { scope: 'https://example.test/site-report-local/' },
    location: { origin: 'https://example.test' },
    addEventListener: (type, handler) => handlers.set(type, handler),
    async skipWaiting() { activated++; },
  };
  vm.runInNewContext(source, { self, URL, Request, Response, caches: { async open() { return cache; }, async delete() {} } });
  handlers.get('install')({ waitUntil(promise) { work = promise; } });
  await work;
  assert.ok(installed.includes('https://example.test/shared/account-workspace.js'));
  assert.ok(installed.includes('https://example.test/shared/account-frame-bootstrap.js'));
  assert.ok(installed.includes('https://example.test/site-report-local/account.html'));
  assert.equal(activated, 0);
  assert.doesNotMatch(source, /\.\s*skipWaiting\s*\(/);
  assert.match(source, /const VERSION = 'user-isolation-20261013'/);
});
test('Daily Report cold account entry misses the known old shell cache even after query normalization', () => {
  // 20261002-member-18 cached these exact paths. Its fetch handler discarded
  // query strings before shellSet.has(), so ?version=... on index.html was unsafe.
  const oldPaths = [
    '../group-member-entry.js', './index.html', './app.js', './styles.css', './documents.js', './storage.js',
    './catalog.js', './archive.js', './full-report.js', './full-report-ui.js', './backup-status.js', './photo-input.js',
    './manifest.webmanifest', './assets/fonts.css', './assets/lucide.js', './assets/icon-512.png',
    './assets/sarabun-400-thai.woff2', './assets/sarabun-400-latin.woff2',
    './assets/sarabun-700-thai.woff2', './assets/sarabun-700-latin.woff2',
  ];
  const scope = 'https://example.test/site-report-local/';
  const oldShellSet = new Set(oldPaths.map(path => new URL(path, scope).href));
  const oldLookup = path => { const url = new URL(path, scope); url.search = ''; url.hash = ''; return oldShellSet.has(url.href); };
  assert.equal(oldLookup('./index.html?version=user-isolation'), true);
  assert.equal(oldLookup('./account.html?version=user-isolation'), false);
  const currentIndex = fs.readFileSync(new URL('../site-report-local/index.html', import.meta.url), 'utf8');
  const account = fs.readFileSync(new URL('../site-report-local/account.html', import.meta.url), 'utf8');
  assert.equal(account, currentIndex);
  assert.match(account, /งานใหม่แยกตามบัญชีผู้ใช้/);
  assert.match(account, /งานเก่าที่ยังไม่ทราบเจ้าของยังเก็บไว้/);
  assert.doesNotMatch(account, /ไม่ผูกบัญชี|แม้เปลี่ยนบัญชีเว็บ/);
});
