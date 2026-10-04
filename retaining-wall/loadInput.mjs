/** Service surcharge ledger. Older q-only projects are entirely live load. */
export function normalizeSurchargeInput(input) {
  if (!Object.hasOwn(input, 'qD') && !Object.hasOwn(input, 'qL')) {
    return { ...input, qD: 0, qL: input.q };
  }
  const numeric = key => {
    const raw = input[key];
    if (raw === '' || raw == null || typeof raw === 'string'&&!raw.trim() || typeof raw === 'boolean'
      || !Number.isFinite(Number(raw)) || Number(raw) < 0) {
      throw new RangeError(key + ' ต้องเป็นโหลดใช้งานไม่ติดลบ');
    }
    return Number(raw);
  };
  const qD = numeric('qD'), qL = numeric('qL'), q = qD + qL;
  if (Object.hasOwn(input, 'q') && (input.q === '' || input.q == null
    || typeof input.q==='boolean' || typeof input.q==='string'&&!input.q.trim()
    || !Number.isFinite(Number(input.q))
    || Math.abs(Number(input.q) - q) > Math.max(1e-9, Math.abs(q) * 1e-12))) {
    throw new RangeError('q ต้องเท่ากับ DL + LL ที่ผิวดิน');
  }
  return { ...input, q, qD, qL };
}

/** Old direct column/beam loads were permanent loads under factorN. */
export function normalizeDuckLoadInput(input) {
  const out={...input,factorL:Object.hasOwn(input,'factorL')?input.factorL:1.7};
  for(const [total,dead,live] of [['Npost','NpostD','NpostL'],['qBeam','qBeamD','qBeamL']]) {
    if(!Object.hasOwn(input,dead)&&!Object.hasOwn(input,live)) {
      out[dead]=input[total]; out[live]=0; continue;
    }
    const valid=v=>v!==''&&v!=null&&typeof v!=='boolean'
      &&!(typeof v==='string'&&!v.trim())&&Number.isFinite(Number(v))&&Number(v)>=0;
    if(!valid(input[dead])||!valid(input[live]))throw new RangeError(dead+'/'+live+' ต้องเป็นโหลดใช้งานไม่ติดลบ');
    const sum=Number(input[dead])+Number(input[live]);
    if(Object.hasOwn(input,total)&&(!valid(input[total])||Math.abs(Number(input[total])-sum)>Math.max(1e-9,sum*1e-12)))
      throw new RangeError(total+' ต้องเท่ากับ DL + LL');
    out[dead]=Number(input[dead]);out[live]=Number(input[live]);out[total]=sum;
  }
  return out;
}
