import assert from 'node:assert/strict';
import test from 'node:test';
import { WORKBENCH_REVISION, WALL_FORMS, keepSessionDraft, readSessionDraft, restoreSessionDraft, readPreviousDraft, formUrl, syncFormLocation } from './workflow.mjs?rwv=20261003-main-equations-1';
import { getPassingExample } from './passingExamples.mjs?rwv=20261003-main-equations-1';
import { STARTUP_REVISION } from './startupDraft.mjs?rwv=20261003-main-equations-1';

// Pure storage/routing contracts. These are not browser or PDF evidence.
test('seven independent input drafts survive a round trip without cross-type overwrites', () => {
  const data = new Map();
  globalThis.sessionStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  try {
    WALL_FORMS.forEach(([type], i) => keepSessionDraft(type, { type, draft: { project: 'โครงการ ' + type, H: i + 1 } }));
    keepSessionDraft('duckfoot', { type: 'duckfoot', draft: { Npost: 120, Hpost: -12, Mpost: 5 } });
    assert.equal(data.size, 1);
    for (const [type] of WALL_FORMS.filter(([type]) => type !== 'duckfoot')) {
      assert.equal(readSessionDraft(type).draft.project, 'โครงการ ' + type);
    }
    assert.equal(readSessionDraft('duckfoot').draft.Hpost, -12);
    const detached = readSessionDraft('duckfoot'); detached.draft.Npost = 999;
    assert.equal(readSessionDraft('duckfoot').draft.Npost, 120);
  } finally { delete globalThis.sessionStorage; }
});

test('corrupt storage recovers a draft and quota errors are not silently counted as saved', () => {
  let raw = '{broken';
  globalThis.sessionStorage = { getItem: () => raw, setItem: (_, value) => { raw = value; } };
  try {
    assert.equal(readSessionDraft('pile'), null);
    for (const bad of ['{broken', 'null', '[]', 'false']) {
      raw = bad; keepSessionDraft('pile', { draft: { hp: 4 } });
      assert.equal(readSessionDraft('pile').draft.hp, 4);
    }
    globalThis.sessionStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => keepSessionDraft('pile', {}), /quota/);
  } finally { delete globalThis.sessionStorage; }
});

test('all form routes use the native family and QA is restricted to loopback', () => {
  try {
    for (const origin of ['http://127.0.0.1:5175', 'http://localhost:5175', 'https://naichangyai.com']) {
      globalThis.location = new URL(origin + '/retaining-wall-workbench.html?qa=1');
      for (const [type] of WALL_FORMS) {
        const url = new URL(formUrl(type));
        assert.equal(url.origin, origin);
        assert.equal(url.pathname, ['cantilever', 'counterfort', 'gravity'].includes(type)
          ? '/retaining-wall-workbench.html' : '/retaining-wall/systems.html');
        assert.equal(url.searchParams.get('type'), type);
        assert.equal(url.searchParams.get('rwv'), WORKBENCH_REVISION);
        assert.equal(url.searchParams.get('qa'), origin.startsWith('https') ? null : '1');
      }
    }
    assert.throws(() => formUrl('unsupported'));
  } finally { delete globalThis.location; }
});

test('old unnamed autosaves migrate once with exact recoverable inputs; subsequent edits survive', () => {
  const data = new Map();
  globalThis.sessionStorage = { getItem: key => data.get(key) ?? null, setItem: (key,value) => data.set(key,value) };
  try {
    for (const [type] of WALL_FORMS) {
      const legacy = ['cantilever','counterfort','gravity'].includes(type);
      const draft = { ...getPassingExample(type).values, ...(legacy ? {baseT:.35, H:8} : {hp:8}) };
      const old = {schema:legacy?'rw01-workbench-draft/1':'rw01-systems-draft/2',type,draft};
      const migrated = restoreSessionDraft(type, old);
      assert.deepEqual(migrated.draft, getPassingExample(type).values);
      assert.deepEqual(readPreviousDraft(type), draft);
      const edited = { ...migrated.draft, ...(legacy ? {H:''} : {hp:null}) };
      keepSessionDraft(type, {schema:old.schema,type,draft:edited});
      assert.deepEqual(restoreSessionDraft(type).draft, edited);
      assert.deepEqual(readPreviousDraft(type), draft);
      assert.equal(readSessionDraft(type).startupRevision, STARTUP_REVISION);
    }
  } finally { delete globalThis.sessionStorage; }
});

test('named old projects and current imported inputs retain values; quota cannot discard old inputs', () => {
  let raw='{}';
  globalThis.sessionStorage={getItem:()=>raw,setItem:(_,value)=>{raw=value;}};
  try {
    const old={schema:'rw01-workbench-draft/1',type:'cantilever',draft:{v:3,projectName:'งานของผู้ใช้',baseT:.35}};
    assert.deepEqual(restoreSessionDraft('cantilever',old),old);
    const imported={...old,draft:{...old.draft,projectName:''},startupRevision:STARTUP_REVISION};
    assert.deepEqual(restoreSessionDraft('cantilever',imported),imported);
    globalThis.sessionStorage.setItem=()=>{throw new Error('quota');};
    const unnamed={...old,draft:{...old.draft,projectName:''}};
    assert.deepEqual(restoreSessionDraft('cantilever',unnamed),unnamed);
    assert.equal(readPreviousDraft('cantilever'),null);
  } finally { delete globalThis.sessionStorage; }
});

test('pre-ledger unnamed autosave is archived without interpreting its ambiguous units', () => {
  let raw='{}';
  globalThis.sessionStorage={getItem:()=>raw,setItem:(_,value)=>{raw=value;}};
  try {
    const old={schema:'rw01-workbench-draft/1',type:'cantilever',draft:{v:2,projectName:'',unitMode:'mks',qa:25}};
    assert.deepEqual(restoreSessionDraft('cantilever',old).draft,getPassingExample('cantilever').values);
    assert.deepEqual(readPreviousDraft('cantilever'),old.draft);
  } finally { delete globalThis.sessionStorage; }
});

test('refresh keeps the selected type while preserving the existing URL context', () => {
  const updates = [];
  globalThis.location = new URL('http://127.0.0.1:5175/retaining-wall/systems.html?type=pile&qa=1#inputs');
  globalThis.history = { replaceState: (_, __, url) => { updates.push(url.href); globalThis.location = new URL(url); } };
  try {
    syncFormLocation('duckfoot');
    assert.equal(globalThis.location.searchParams.get('type'), 'duckfoot');
    assert.equal(globalThis.location.searchParams.get('qa'), '1');
    assert.equal(globalThis.location.hash, '#inputs');
    syncFormLocation('duckfoot'); syncFormLocation('unsupported');
    assert.equal(updates.length, 1);
  } finally { delete globalThis.location; delete globalThis.history; }
});
