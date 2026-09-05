import { mountConcreteProjectControls } from './concrete-project-store.mjs';
import { openWorkspaceStore } from './shared/workspace-store.mjs';

const app = window.NCYApp, model = window.NCYV5;
if (!app?.getState || !app?.setState || !model?.importState) throw new Error('SC01 input contract unavailable');
function withoutOutputCaches(value) {
  const input = structuredClone(value);
  if (input?.v5) {
    if (Object.hasOwn(input.v5,'autoDesign')) input.v5.autoDesign = {};
    if (input.v5.validation) { if (Object.hasOwn(input.v5.validation,'runs')) input.v5.validation.runs = []; delete input.v5.validation.expectedSnapshot; }
  }
  for (const key of ['v64','v65']) if (input?.[key] && Object.hasOwn(input[key],'lastAuto')) input[key].lastAuto = null;
  return input;
}
// This is the trusted, fully initialized retained serializer shape, not the
// imported candidate. Unknown/missing nested fields HOLD rather than being
// silently filled by the donor's permissive importState merge.
const inputShape = withoutOutputCaches(app.getState());
const optionalFields = { v57:{loadOrigin:'string'}, v5:{exportedAt:'string'} };
const expectedNumber = /^v5\.validation\.expected\.(Vy|Mx|deflection|Tmax)$/;
function matchesShape(value, sample, path = '', depth = 0, budget = { count:0 }) {
  if (depth > 64 || ++budget.count > 500000) return false;
  if (expectedNumber.test(path)) return value === null || typeof value === 'number' && Number.isFinite(value);
  if (sample === null) return value === null;
  if (Array.isArray(sample)) {
    if (!Array.isArray(value)) return false;
    // Empty retained arrays have no declared item schema (including the held
    // imported-Truss placeholder); do not guess a result/member contract.
    return sample.length ? value.every(item => matchesShape(item,sample[0],path+'[]',depth+1,budget)) : value.length === 0;
  }
  if (typeof sample !== 'object') return typeof value === typeof sample && (typeof value !== 'number' || Number.isFinite(value)) && (!path.endsWith('.schema') || value === sample);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const required = Object.keys(sample), optional = optionalFields[path] || {};
  if (!required.every(key => Object.hasOwn(value,key))) return false;
  return Object.keys(value).every(key => {
    if (['__proto__','constructor','prototype'].includes(key)) return false;
    if (Object.hasOwn(sample,key)) return matchesShape(value[key],sample[key],path ? path+'.'+key : key,depth+1,budget);
    return Object.hasOwn(optional,key) && typeof value[key] === optional[key];
  });
}
function capture() { return withoutOutputCaches(app.getState()); }
function validate(input) {
  if (!matchesShape(input,inputShape)) return false;
  try { model.importState(input); return true; } catch (_) { return false; }
}
function apply(input) {
  if (!validate(input)) throw new Error('รูปแบบข้อมูล SC01 ไม่ถูกต้อง');
  // Existing public import path resets guided state and recomputes; no saved
  // result, review verdict, cache or construction authority is installed.
  app.setState(input);
}
window.SVSteelBoxProjectInputs = Object.freeze({ capture, validate, apply });
async function legacyInputStore() {
  const db = await openWorkspaceStore();
  const inputsOnly = row => {
    if (row.value === null) return row;
    const raw = JSON.parse(row.value);
    if (raw?.schema !== undefined) return row; // Modern envelopes are validated as-is.
    const input = withoutOutputCaches(raw);
    if (!validate(input)) throw new Error('ร่าง SC01 เดิมมีโครงสร้างที่ยังไม่รองรับ เก็บต้นฉบับไว้โดยไม่เขียนทับ');
    return { ...row,value:JSON.stringify(input) };
  };
  // Decode copies only: the core retains exact legacy bytes and checks legacy
  // changes/CAS. No normalized copy is acknowledged as a database write.
  return { ...db, read:async key => inputsOnly(await db.read(key)), readOrMigrate:async (key,options) => inputsOnly(await db.readOrMigrate(key,options)) };
}
// The early sample guard isolates legacy storage in document memory. Do not
// attach the real IndexedDB controller to that document or let it migrate/read
// the customer's project. Native Demo draft controls remain memory-only.
if (window.__scSampleMode) {
  document.body.dataset.sc01InputStorage = 'sample-memory';
} else {
  const controller = mountConcreteProjectControls({ card:'sc01', host:document.querySelector('.top-actions'), capture, validate, apply, legacyKey:'ncy.connection.v5.draft', storeFactory:legacyInputStore, captureReady:() => Object.keys(app.ui59.getDraftErrors()).length === 0, description:'เก็บค่ากรอกครบชุด; ไม่เก็บผล Auto/ผลทดสอบเก่า การย้ายร่างเดิมตัดเฉพาะ cache ผลเหล่านี้และเก็บต้นฉบับไว้', restoredMessage:'เปิดข้อมูล SC01 และคำนวณใหม่ด้วย Engine เดิมแล้ว · REVIEW ONLY ไม่ใช่แบบก่อสร้าง' });
  window.SVSteelBoxProjectStore = controller;
  document.body.dataset.sc01InputStorage = 'project-indexeddb';
  // Replace only explicit draft UI handlers. Original disk .V5.json remains intact.
  for (const [id, action] of [['draftBtn','save'],['restoreBtn','open']]) {
    document.getElementById(id).onclick = async () => {
      document.getElementById('moreMenu').hidden = true;
      controller.panel.open = true;
      await controller[action]();
      document.getElementById('saveStatus').textContent = controller.panel.querySelector('[role="status"]').textContent;
    };
  }
}
