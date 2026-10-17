// Shared presentation only. Each workbench retains its own input and Snapshot authority.
import { mountFootingWorkflow } from './footingWorkflow.mjs?rwv=20261003-final-acceptance-1&fix=20261004-validation-1&toolbar=20261004-actions-1&material=20261004-realism-1&panel=20261004-pile-panel-1&stay=20261004-alternate-1';
import { migrateStartupDraft, STARTUP_REVISION } from './startupDraft.mjs?rwv=20261003-all-sheets-1&stay=20261004-alternate-1';
export const WORKBENCH_REVISION = '20261003-final-acceptance-1';
export const WALL_FORMS = Object.freeze([
  ['cantilever', 'กำแพงยื่น · ฐานแผ่'], ['counterfort', 'กำแพงมีครีบ · ฐานแผ่'],
  ['gravity', 'กำแพงมวล'], ['pile', 'กำแพงยื่น · เสาเข็ม'],
  ['pilecf', 'กำแพงมีครีบ · เสาเข็ม'], ['soldier', 'เสาเข็มพืด'],
  ['duckfoot', 'ฐานตีนเป็ด · เสาชิดเขต'],
]);
export const RESULT_VIEWS = Object.freeze([
  ['plan', 'Plan / Section'], ['model', '3D'], ['forces', 'SFD / BMD'],
  ['checks', 'ผลตรวจ D/C'], ['bars', 'เหล็กเสริม'], ['report', 'รายงาน A4'],
]);
const SESSION_KEY = 'ncy-rw01-workflow-drafts/v1';
export function readSessionDraft(type) {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}')[type] || null; }
  catch { return null; }
}
export function keepSessionDraft(type, draft) {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || '{}'); }
  catch { saved = {}; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  saved[type] = { ...draft, startupRevision: STARTUP_REVISION,
    ...(saved[type]?.startupBackup ? { startupBackup: saved[type].startupBackup } : {}) };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(saved));
}
export function restoreSessionDraft(type, fallback = null) {
  const saved = readSessionDraft(type) || fallback;
  const migrated = migrateStartupDraft(type, saved);
  if (migrated !== saved) {
    // Never replace old inputs unless their full backup was stored successfully.
    try { keepSessionDraft(type, migrated); } catch { return saved; }
  }
  return migrated;
}
export function readPreviousDraft(type) {
  return readSessionDraft(type)?.startupBackup?.draft || null;
}
export function formUrl(type) {
  if (!WALL_FORMS.some(([key]) => key === type)) throw new Error('ไม่รู้จักรูปแบบที่เลือก');
  const url = new URL(['cantilever', 'counterfort', 'gravity'].includes(type)
    ? '/retaining-wall-workbench.html' : '/retaining-wall/systems.html', location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('rwv', WORKBENCH_REVISION);
  if (['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
      && new URLSearchParams(location.search).get('qa') === '1') url.searchParams.set('qa', '1');
  return url.href;
}
export function downloadDraft(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function syncFormLocation(type) {
  if (!WALL_FORMS.some(([key]) => key === type)) return;
  const url = new URL(location.href);
  if (url.searchParams.get('type') === type) return;
  url.searchParams.set('type', type);
  url.searchParams.set('rwv', WORKBENCH_REVISION);
  history.replaceState(null, '', url);
}

// Reuse complete rendered sections; this never creates or recalculates results.
export function pageResultSections(pane, sections) {
  if(sections.length<2)return;
  const nav=document.createElement('nav');nav.className='rw-result-sections';nav.setAttribute('aria-label','หัวข้อผลคำนวณ');
  const pages=sections.map(([label,nodes],index)=>{
    const page=document.createElement('section');page.className='rw-result-page';page.hidden=index!==0;
    page.id=pane.id+'-part-'+index;page.append(...nodes);pane.append(page);
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.setAttribute('aria-controls',page.id);button.setAttribute('aria-pressed',String(index===0));nav.append(button);
    button.addEventListener('click',()=>{pages.forEach((item,k)=>{item.hidden=k!==index;});nav.querySelectorAll('button').forEach((b,k)=>b.setAttribute('aria-pressed',String(k===index)));pane.scrollTop=0;});
    return page;
  });
  pane.prepend(nav);pane.classList.add('rw-paged-result');
}

export function pageForceSections(pane) {
  pane.classList.remove('rw-paged-result');
  const sections=[];
  for(const node of [...pane.children]){
    if(!sections.length||node.tagName==='H3'||node.classList.contains('print-keep'))sections.push([node.querySelector('h3')?.textContent|| (node.tagName==='H3'?node.textContent:'เสาเข็ม'),[]]);
    sections.at(-1)[1].push(node);
  }
  // Introductory copy belongs with the first actual diagram, not an empty page.
  if(sections.length>1&&!sections[0][1].some(n=>n.matches('.diagram-grid')||n.querySelector('.diagram-grid'))){
    sections[1][1].unshift(...sections.shift()[1]);
  }
  pageResultSections(pane,sections);
}

export function mountWorkflow(options) { return mountFootingWorkflow({ ...options, forms: WALL_FORMS }); }
