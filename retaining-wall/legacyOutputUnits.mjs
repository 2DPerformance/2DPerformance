/** Accepted legacy Snapshot -> display only. No Engine call or design decision.
 * Exact kgf conversion: NIST SP811 B.8, standard gravity 9.80665 m/s².
 */
import {resultUnits, displayEngineText} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
import {buildRetainingWallPresentation} from './presentation.mjs?rwv=20260930-load-units-1';

const need = snapshot => {
  if (!snapshot?.ok || !snapshot.result || !snapshot.forceDesign || !snapshot.presentation)
    throw new TypeError('RW-01 display requires an accepted legacy Snapshot');
  return snapshot;
};

export function legacyDisplayedChecks(source, mode='si') {
  if (mode !== 'kgf') return source.checks;
  const u = resultUnits(mode), r = source.result;
  return source.checks.map(check => {
    let v = displayEngineText(check.v, mode), req = displayEngineText(check.req, mode);
    if (check.k === 'BEARING q,max') {
      v = u.quantity(r.qmaxEff, 'kPa') + (r.bcap ? ' (B′='+r.Bpeff.toFixed(2)+'m)' : '');
      req = r.bcap ? '≤ qa,ดิน='+u.quantity(r.bcap.qall, 'kPa')+' · FoS='+r.FoSbear.toFixed(2)+'≥3'
        : '≤ qa = '+u.quantity(r.i.qa, 'kPa')+' (FoS≥3.0)';
    }
    const part = {'SHEAR — STEM':'S', 'SHEAR — HEEL':'H', 'SHEAR — TOE':'T'}[check.k];
    if (part) {
      v = u.quantity(r['Vu'+part], 'kN');
      req = '≤ φVc = '+u.quantity(r['phiVc'+part], 'kN')+' (คอนกรีตล้วน)';
    }
    return {...check, v, req, fix:displayEngineText(check.fix, mode)};
  });
}

export function legacyPresentation(snapshot, mode='si') {
  const s = need(snapshot);
  if (!['si','kgf','mks'].includes(mode)) throw new TypeError('RW-01 unknown display mode');
  if (mode === 'mks') return s.presentation;
  const canonical = s.input.units === 'mks' ? buildRetainingWallPresentation({
    input:{...s.input, units:'si'}, result:s.result, checks:s.checks, verdict:s.verdict,
    warnings:s.warnings, snapshotId:s.id, profileShort:s.designBasis.profileShort,
    authority:s.authority, engineeringCoverage:s.engineeringCoverage,
    forceDesign:s.forceDesign, recovery:s.recovery,
  }) : s.presentation;
  if (mode === 'si') return canonical;
  const u = resultUnits(mode), c = {...canonical};
  for (const key of ['Pa','Pq','Pw','P','activePressure','Pp','PpUltimate','friction','V'])
    c[key] = u.value(canonical[key], 'kN/m');
  for (const key of ['Mr','Mo','muStem','muToe','muHeel'])
    c[key] = u.value(canonical[key], 'kN·m/m');
  for (const key of ['qToe','qHeel','qMax','qMin','qa','q']) c[key] = u.value(canonical[key], 'kPa');
  for (const key of ['gamma','gammaSat','gammaC']) c[key] = u.value(canonical[key], 'kN/m³');
  c.units = 'kgf';
  c.uL = {F:' kgf/m', M:' kgf·m/m', P:' kgf/m²', UW:'kgf/m³'};
  c.checks = legacyDisplayedChecks(s, mode);
  c.warnings = s.warnings.map(w => typeof w === 'string' ? displayEngineText(w, mode) : w);
  c.forceDesign = {...s.forceDesign,
    loads:Object.fromEntries(Object.entries(s.forceDesign.loads).map(([key,value]) =>
      [key,u.value(value, ['lateral','water'].includes(key)?'kN/m':'kPa')])),
    members:s.forceDesign.members.map(member => ({...member,
      moment:u.value(member.moment,'kN·m/m'), shear:u.value(member.shear,'kN/m'),
      shearCapacity:u.value(member.shearCapacity,'kN/m'),
      bmd:member.bmd.map(p => ({...p,y:u.value(p.y,'kN·m/m')})),
      bmdAlt:member.bmdAlt.map(p => ({...p,y:u.value(p.y,'kN·m/m')})),
      sfd:member.sfd.map(p => ({...p,y:u.value(p.y,'kN/m')})),
    })),
  };
  return c;
}

/** Recovery values remain SI in the accepted trial. Convert just for labels;
 * dimensions and selectable MPa material grades stay in their original units. */
export function legacyRecoveryQuantity(value, unit, mode='si') {
  return mode === 'kgf' && ['kPa','kN/m³','kN','kN/m','kN·m','kN·m/m'].includes(unit)
    ? {value:resultUnits(mode).value(value,unit),unit:resultUnits(mode).label(unit)}
    : {value,unit};
}
