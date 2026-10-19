/** Display-only units. Native project numbers retain their original engine units. */
export const STANDARD_GRAVITY = 9.80665;
export const KGF_PER_KN = 1000 / STANDARD_GRAVITY;
export const KSC_PER_MPA = 1 / 0.0980665;
export const INPUT_UNIT_MODES = Object.freeze(['si', 'kgf']);
const quantities = Object.freeze({
  q:'pressure',qD:'pressure',qL:'pressure',qa:'pressure',c:'pressure',gaBondStress:'pressure',ancSu:'pressure',
  gs:'density',gsat:'density',gc:'density',fc:'stress',fy:'stress',
  Npost:'force',NpostD:'force',NpostL:'force',Hpost:'force',Mpost:'moment',
  qBeam:'line',qBeamD:'line',qBeamL:'line',gaTendonCapacity:'force',
  Ppile:'ton',pileTen:'ton',pileLat:'ton',
});
const units = Object.freeze({
  pressure:['kPa','kgf/m²'],density:['kN/m³','kgf/m³'],stress:['MPa','kgf/cm²'],
  force:['kN','kgf'],moment:['kN·m','kgf·m'],line:['kN/m','kgf/m'],ton:['tf/ต้น','kgf/ต้น'],
});
export function validateInputUnitMode(mode = 'si') {
  if (!INPUT_UNIT_MODES.includes(mode)) throw new RangeError('หน่วยกรอกต้องเป็น SI หรือ kgf');
  return mode;
}
export function inputUnit(key, mode = 'si', fallback = '') {
  validateInputUnitMode(mode);
  return units[quantities[key]]?.[mode === 'kgf' ? 1 : 0] || fallback;
}
function multiplier(key, mode) {
  validateInputUnitMode(mode);
  if (mode !== 'kgf' || !quantities[key]) return 1;
  return quantities[key] === 'stress' ? KSC_PER_MPA
    : quantities[key] === 'ton' ? 1000 : KGF_PER_KN;
}
export function inputToDisplay(key, value, mode = 'si') {
  return Number(value) * multiplier(key, mode);
}
export function inputFromDisplay(key, value, mode = 'si') {
  return value === '' || value == null ? NaN : Number(value) / multiplier(key, mode);
}
export function inputDisplayString(key, value, mode = 'si') {
  return Number.isFinite(Number(value)) ? String(Number(inputToDisplay(key,value,mode).toPrecision(12))) : '';
}
