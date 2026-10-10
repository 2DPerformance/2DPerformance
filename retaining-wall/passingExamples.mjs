import { SYSTEM_DEFAULTS,SOLDIER_BEAM_KEYS } from './systemsSnapshot.mjs?rwv=20261003-all-sheets-1&stay=20261004-alternate-1';
import {RB_DETAIL_DEFAULTS} from './soldierBeamDetailing.mjs?rwv=20261003-main-equations-1';

// Reproducible demonstrations seed a new, empty per-system draft. Existing
// project inputs are preserved; replacement requires the explicit reset action.
// Passing registered checks does not grant construction approval.
const legacyBase = Object.freeze({
  v: 3, projectName: '', unitMode: 'si', code: 'thai2566',
  H: 3.5, B: 4.45, baseT: .70, toe: .80, stemT: .30, heel: 3.35,
  wallLength: 10, cfSpan: 3, cfThick: .30, cfDepth: 0, cfHeight: 0,
  phi: 30, gamma: 18, gammaSat: 20, delta: 28, wallDelta: 15,
  qa: 150, frontDepth: 0, passiveFactor: 0,
  waterEnabled: false, waterH: 1, includeSurchargeWeight: false,
  surcharge: 10, surchargeD:0, lineLoad: 0, lineLoadHeight: 2.60,
  gammaC: 24, gammaW: 9.81, fc: '24', fy: '390', cover: 50,
});

const withUnitLedger = (type, overrides = {}) => {
  const values = { ...legacyBase, ...overrides, wallType: type };
  values.unitCanonicalSi = {
    gamma: values.gamma, gammaSat: values.gammaSat,
    surcharge: values.surcharge, surchargeD:values.surchargeD, qa: values.qa,
    gammaC: values.gammaC, gammaW: values.gammaW,
  };
  Object.freeze(values.unitCanonicalSi);
  return Object.freeze(values);
};

const systemExample = (type, overrides) => Object.freeze({
  ...SYSTEM_DEFAULTS, ...overrides, wtype: type, project: '', profile: 'thai2566',
  ...(type==='soldier'?{...RB_DETAIL_DEFAULTS,...Object.fromEntries(SOLDIER_BEAM_KEYS.map(key=>[key,0]))}:{}),
  unitMode:'si', ...(type==='duckfoot'?{NpostD:overrides?.Npost ?? SYSTEM_DEFAULTS.Npost,NpostL:0,
    qBeamD:overrides?.qBeam ?? SYSTEM_DEFAULTS.qBeam,qBeamL:0,factorL:1.7}:{qD:0,qL:overrides?.q ?? SYSTEM_DEFAULTS.q}),
});

const example = (type, family, source, values) => Object.freeze({
  type, family, source, profile: 'thai2566',
  label: 'ตัวอย่างคำนวณผ่านเฉพาะรายการที่ Engine ลงทะเบียน',
  constructionAuthority: false,
  values,
});

export const PASSING_EXAMPLES = Object.freeze({
  cantilever: example('cantilever', 'legacy',
    'retaining-wall-workbench.html defaults + adapter.test.mjs UI; Thai2566, dry, q=10 kPa',
    withUnitLedger('cantilever')),
  gravity: example('gravity', 'legacy',
    'retaining-wall-workbench.html defaults + adapter.test.mjs UI; Thai2566, dry, q=10 kPa',
    withUnitLedger('gravity', { wallDelta: 12 })),
  counterfort: example('counterfort', 'legacy',
    'retaining-wall-workbench.html defaults + adapter.test.mjs UI; Thai2566, dry, q=10 kPa',
    withUnitLedger('counterfort', {
      H: 2.3, B: 3, baseT: .45, toe: .8, heel: 1.9,
      phi: 32, cfSpan: 2, cfThick: .4,
    })),
  pile: example('pile', 'systems', 'systemsSnapshot.mjs SYSTEM_DEFAULTS; Thai2566',
    systemExample('pile', { hp: 2.3, qa: 150 })),
  pilecf: example('pilecf', 'systems', 'systemsSnapshot.mjs SYSTEM_DEFAULTS; Thai2566',
    systemExample('pilecf', { hp: 2.3, qa: 150 })),
  soldier: example('soldier', 'systems', 'systemsSnapshot.mjs SYSTEM_DEFAULTS; Thai2566, stay',
    systemExample('soldier', { ipile: 40 })),
  duckfoot: example('duckfoot', 'systems',
    'systemsSnapshot.mjs SYSTEM_DEFAULTS + systemsPage.mjs duckDefaults; Thai2566',
    systemExample('duckfoot', {
      hp: 2.3, t: .35, colDepth: .35, hz: .45, B: 1.5, capL: 1.4,
      beamB: .20, beamH: .40, beamClear: .35,
      cov: 40, qa: 150,
    })),
});

/** Return a fresh input object for initial seeding or explicit example reset. */
export function getPassingExample(type) {
  const fixture = PASSING_EXAMPLES[type];
  if (!fixture) throw new RangeError('ไม่รู้จักระบบตัวอย่างกำแพงกันดิน');
  return {
    ...fixture,
    values: {
      ...fixture.values,
      ...(fixture.values.unitCanonicalSi
        ? { unitCanonicalSi: { ...fixture.values.unitCanonicalSi } } : {}),
    },
  };
}

/** Existing drafts win in full, including failed and incomplete user inputs. */
export function initialDraftValues(type, saved = null) {
  if (saved == null) return getPassingExample(type).values;
  return { ...saved, ...(saved.unitCanonicalSi
    ? { unitCanonicalSi: { ...saved.unitCanonicalSi } } : {}) };
}
