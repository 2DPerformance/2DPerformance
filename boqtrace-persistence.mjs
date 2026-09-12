import { openWorkspaceStore } from './shared/workspace-store.mjs';

const PROJECT_KEY = 'boqtrace:projects';
const ACTIVE_KEY = 'boqtrace:active';
const validateProjects = (raw) => {
  const projects = JSON.parse(raw);
  if (!Array.isArray(projects)) throw new Error('BOQTRACE_PROJECT_LIST_INVALID');
  return projects;
};
export async function openBoqTracePersistence({ store, storage = globalThis.localStorage } = {}) {
  store ||= await openWorkspaceStore();
  let record = await store.readOrMigrate(PROJECT_KEY, { storage, legacyKey: 'sv_boqtrace_projects' });
  let active = await store.readOrMigrate(ACTIVE_KEY, { storage, legacyKey: 'sv_boqtrace_active' });
  if (record.value !== null) validateProjects(record.value);
  let tail = Promise.resolve();
  let failure = null;
  return {
    initialRaw: record.value,
    activeId: active.value,
    save(raw, activeId, { retry = false } = {}) {
      validateProjects(raw);
      const task = tail.then(async () => {
        if (failure && !retry) throw failure;
        const committed = await store.commit([
          { key: PROJECT_KEY, value: raw, expectedRevision: record.revision },
          { key: ACTIVE_KEY, value: activeId || null, expectedRevision: active.revision },
        ]);
        [record, active] = committed;
        failure = null;
        return { raw: record.value, revision: record.revision };
      });
      tail = task.catch((error) => { failure = error; });
      return task;
    },
  };
}
