import { getPassingExample } from './passingExamples.mjs?rwv=20261003-main-equations-1&stay=20261004-alternate-1';

export const STARTUP_REVISION = 'rw01-passing-startup/2';

// Older releases autosaved unnamed default inputs without provenance. Keep
// that complete envelope as a recoverable backup before adopting the new demo.
// Named projects, current edits and explicit file imports retain their inputs.
export function migrateStartupDraft(type, saved) {
  const legacy = ['cantilever', 'counterfort', 'gravity'].includes(type);
  const schema = legacy ? 'rw01-workbench-draft/1' : 'rw01-systems-draft/2';
  if (saved?.schema !== schema || saved.type !== type || !saved.draft
      || Array.isArray(saved.draft) || typeof saved.draft !== 'object') return saved;
  const name = legacy ? saved.draft.projectName : saved.draft.project;
  if (saved.startupRevision === STARTUP_REVISION || String(name ?? '').trim()) return saved;
  return { ...saved, startupRevision: STARTUP_REVISION,
    startupBackup: saved, draft: getPassingExample(type).values };
}
