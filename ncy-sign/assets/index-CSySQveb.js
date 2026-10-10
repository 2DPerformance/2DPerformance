var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var _a;
import "./modulepreload-polyfill-DaKOjhqt.js";
const exactJobKey = (job) => JSON.stringify(job, (_, v2) => typeof v2 === "number" && !Number.isFinite(v2) ? { nonfinite: String(v2) } : v2);
function createWorkerClient(createWorker, { maxEntries = 28, poolSize = 1 } = {}) {
  const size = Math.max(1, Math.floor(poolSize) || 1);
  let workers = [], sequence = 0, pending = null;
  const cache = /* @__PURE__ */ new Map(), metrics = { solves: 0, hits: 0, aborts: 0 };
  function reject(error) {
    const p2 = pending;
    pending = null;
    p2 == null ? void 0 : p2.reject(error);
  }
  function cancel() {
    sequence++;
    metrics.aborts++;
    for (const w2 of workers) w2 == null ? void 0 : w2.terminate();
    workers = [];
    reject(Object.assign(Error("หยุดค้นแล้ว"), { name: "AbortError" }));
  }
  function connect(slot) {
    if (workers[slot]) return workers[slot];
    const worker = createWorker();
    workers[slot] = worker;
    worker.onmessage = ({ data }) => {
      const part = pending == null ? void 0 : pending.parts.get(data.id);
      if (part == null) return;
      if (data.error) {
        reject(Error(data.error));
        return;
      }
      const p2 = pending;
      p2.results[part] = data.result;
      p2.parts.delete(data.id);
      if (p2.parts.size) return;
      pending = null;
      const result = p2.split ? p2.results.flat() : p2.results[0];
      cache.set(p2.key, result);
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
      p2.resolve(result);
    };
    worker.onerror = (e) => {
      if (workers[slot] !== worker) return;
      worker.terminate();
      workers[slot] = null;
      reject(Error(e.message || "Worker คำนวณไม่สำเร็จ"));
    };
    return worker;
  }
  async function response(job) {
    const key = exactJobKey(job);
    if (cache.has(key)) {
      metrics.hits++;
      const result2 = cache.get(key);
      cache.delete(key);
      cache.set(key, result2);
      return structuredClone(result2);
    }
    if (pending) throw Error("มีงานคำนวณเบื้องหลังที่ยังไม่จบ");
    const list = Array.isArray(job == null ? void 0 : job.jobs) ? job.jobs : null, count2 = list ? Math.min(size, list.length) : 1, split = count2 > 1, step = split ? Math.ceil(list.length / count2) : 0;
    const messages = split ? Array.from({ length: count2 }, (_, i) => ({ ...job, jobs: list.slice(i * step, (i + 1) * step) })).filter((m2) => m2.jobs.length) : [job];
    metrics.solves++;
    const result = await new Promise((resolve, reject2) => {
      pending = { key, split, parts: /* @__PURE__ */ new Map(), results: [], resolve, reject: reject2 };
      try {
        messages.forEach((m2, i) => {
          const w2 = connect(i), id2 = ++sequence;
          pending.parts.set(id2, i);
          w2.postMessage({ id: id2, job: m2 });
        });
      } catch (e) {
        pending = null;
        reject2(e);
      }
    });
    return structuredClone(result);
  }
  return { response, cancel, clear: () => {
    cancel();
    cache.clear();
  }, inspect: () => ({ ...metrics, entries: cache.size, busy: !!pending, workers: workers.filter(Boolean).length, poolSize: size }) };
}
const LEAN_PATHS = Object.freeze([["analysis", "elements"], ["response", "stations"]]);
function guardLean(result, onRead) {
  for (const [a, b] of LEAN_PATHS) {
    const holder = result == null ? void 0 : result[a];
    if (!holder || typeof holder !== "object" || Object.prototype.hasOwnProperty.call(holder, b)) continue;
    Object.defineProperty(holder, b, { configurable: true, enumerable: true, get() {
      onRead(a + "." + b);
      throw Object.assign(Error("LEAN_FIELD_READ " + a + "." + b), { name: "LeanFieldRead" });
    } });
  }
  return result;
}
const client = createWorkerClient(() => new Worker(new URL(
  /* @vite-ignore */
  "" + new URL("solver.worker-BJ3XoTW1.js", import.meta.url).href,
  import.meta.url
), { type: "module" }), { maxEntries: 3, poolSize: Math.min(4, Math.max(1, (((_a = globalThis.navigator) == null ? void 0 : _a.hardwareConcurrency) || 2) - 1)) });
let epoch = 0, active = false, timing = {}, leanOn = false;
const leanStats = { runs: 0, fallbacks: 0, reads: {} };
const abort = () => Object.assign(Error("หยุดค้นหรือข้อมูลเปลี่ยนแล้ว"), { name: "AbortError" });
function responseJob(g, d, c) {
  const load = windLoads31(d, g, c);
  return { geometry: { total: g.total, frame: g.frame }, inputs: { headModel: d.headModel, windMode31: d.windMode31, analysis35: d.analysis35, _deadFactor34: d._deadFactor34 }, load, caseInput: load.caseInput };
}
async function analyze(d, g, { valid = () => true } = {}) {
  if (active) throw Error("มีงานวิเคราะห์เบื้องหลังที่ยังไม่จบ");
  if (!g.frame || !windIs31(d)) return r7AnalyzeModel29(d, g);
  active = true;
  const started = performance.now(), generation = epoch, local = /* @__PURE__ */ new Map(), useLean = leanOn;
  const current = () => generation === epoch && valid();
  try {
    let cases;
    if (sourceIs34(d)) {
      const plan = sourceAnalysisPlan34(d, g);
      cases = [[plan.common, null], ...windReadCases31(plan.common.windCases31, true).filter((c) => c.enabled).map((c) => [plan.common, c]), ...plan.cs.map((c) => [{ ...d, _deadFactor34: c.d }, c])];
    } else cases = [[d, null], ...windReadCases31(d.windCases31, true).filter((c) => c.enabled).map((c) => [d, c])];
    const jobs = /* @__PURE__ */ new Map(), remaining = /* @__PURE__ */ new Map();
    let consumed = 0;
    for (const [inputs, c] of cases) {
      if (!current()) throw abort();
      const job = responseJob(g, inputs, c), key = exactJobKey(job);
      if (!jobs.has(key)) jobs.set(key, job);
      remaining.set(key, (remaining.get(key) || 0) + 1);
    }
    const planned = performance.now(), responses = await client.response(useLean ? { jobs: [...jobs.values()], lean: true } : { jobs: [...jobs.values()] }), received = performance.now();
    if (!Array.isArray(responses) || responses.length !== jobs.size) throw Error("ผลกรณีแรงจากตัวคำนวณไม่ครบ");
    [...jobs.keys()].forEach((key, i) => local.set(key, responses[i]));
    if (!current()) throw abort();
    const native = windResponse31;
    windResponse31 = function(geometry, inputs, c) {
      const key = exactJobKey(responseJob(geometry, inputs, c));
      const count2 = remaining.get(key) || 0;
      if (!local.has(key) || count2 < 1) throw Error("รายการแรง " + ((c == null ? void 0 : c.id) || "gravity") + " ไม่ตรงงานที่เตรียมไว้ ไม่รับผลค้นชุดนี้");
      const result = count2 > 1 ? structuredClone(local.get(key)) : local.get(key);
      if (useLean) guardLean(result, (path) => {
        leanStats.reads[path] = (leanStats.reads[path] || 0) + 1;
      });
      remaining.set(key, count2 - 1);
      consumed++;
      result.pile = windPile31(result.action, inputs, geometry);
      return result;
    };
    try {
      const result = r7AnalyzeModel29(d, g);
      if (consumed !== cases.length) throw Error("จำนวนกรณีแรงที่ใช้ไม่ตรงแผนวิเคราะห์");
      return result;
    } finally {
      timing = { generation, planMs: planned - started, responseMs: received - planned, nativeMs: performance.now() - received };
      windResponse31 = native;
    }
  } finally {
    active = false;
  }
}
async function lean(fn) {
  const readsBefore = () => Object.values(leanStats.reads).reduce((a, b) => a + b, 0), before = readsBefore();
  leanStats.runs++;
  let out, error = null;
  leanOn = true;
  try {
    out = await fn();
  } catch (e) {
    error = e;
  } finally {
    leanOn = false;
  }
  if (readsBefore() === before) {
    if (error) throw error;
    return out;
  }
  leanStats.fallbacks++;
  return fn();
}
window.NCYAsyncAnalysis = { analyze, lean, cancel() {
  epoch++;
  client.cancel();
}, clear() {
  epoch++;
  client.clear();
}, inspect: () => ({ ...client.inspect(), active, epoch, timing, lean: JSON.parse(JSON.stringify(leanStats)) }) };
const finite$1 = (x2) => typeof x2 === "number" && Number.isFinite(x2);
const pos = (x2) => finite$1(x2) && x2 > 0;
const ratio = (demand, capacity) => capacity > 0 ? demand / capacity : Infinity;
const fyThicknessFactor = (t2) => t2 <= 16 ? 1 : t2 <= 40 ? 235 / 245 : 215 / 245;
function plateTensionSide({ T: T2, s, D: D2, B: B2, t: t2, FyNominal }) {
  if (![s, D2, B2, t2, FyNominal].every(pos) || !finite$1(T2)) return null;
  const ell = s / Math.SQRT2 - D2 / 2, Fy = FyNominal * fyThicknessFactor(t2), phiMn = 0.9 * Fy * t2 * t2 / 4;
  if (T2 <= 0 || ell <= 0) return { ell, beff: null, mt: 0, Fy, phiMn, dc: 0 };
  const beff = Math.min(2 * ell, Math.SQRT2 * B2 - D2);
  if (!(beff > 0)) return null;
  const mt = T2 * 1e3 * ell / beff;
  return { ell, beff, mt, Fy, phiMn, dc: ratio(mt, phiMn) };
}
function anchorTensionShear({ T: T2, V: V2, da: da2, Fu }) {
  if (![da2, Fu].every(pos) || !finite$1(T2) || !finite$1(V2)) return null;
  const Ab2 = Math.PI * da2 * da2 / 4, Fnt = 0.75 * Fu, Fnv = 0.45 * Fu, phi = 0.75;
  const frv = Math.abs(V2) * 1e3 / Ab2, Tn = Math.max(0, T2) * 1e3;
  const FntPrime = Math.min(1.3 * Fnt - Fnt / (phi * Fnv) * frv, Fnt);
  const dcV = frv / (phi * Fnv), dcT = Tn === 0 ? 0 : FntPrime > 0 ? Tn / (phi * FntPrime * Ab2) : Infinity;
  return { Ab: Ab2, Fnt, Fnv, phi, frv, FntPrime, dcV, dcT, dc: Math.max(dcV, dcT) };
}
function hookPullout({ T: T2, fc: fc2, da: da2, hook }) {
  if (![fc2, da2, hook].every(pos) || !finite$1(T2)) return null;
  const eh2 = Math.min(hook, 4.5 * da2), ok2 = eh2 >= 3 * da2 - 1e-9, phi = 0.7;
  const Np = 0.9 * fc2 * eh2 * da2 / 1e3, phiNp = phi * Np;
  return { eh: eh2, capped: hook > 4.5 * da2, ok: ok2, Np, phiNp, dc: ok2 ? ratio(Math.max(0, T2), phiNp) : Infinity };
}
const minFillet = (tThin) => tThin <= 6 ? 3 : tThin <= 13 ? 5 : tThin <= 19 ? 6 : 8;
function filletWeld({ q: q2, a, Fexx, tThin }) {
  if (![a, Fexx].every(pos) || !finite$1(q2)) return null;
  const phiRn = 0.75 * 0.6 * Fexx * 0.707 * a, aMin = pos(tThin) ? minFillet(tThin) : null;
  return { phiRn, aMin, minOK: aMin === null || a >= aMin - 1e-9, dc: ratio(Math.abs(q2), phiRn) };
}
function chsTransversePlate({ P: P2, Bp, D: D2, t: t2, Fy, U: U2 = 0 }) {
  if (![Bp, D2, t2, Fy].every(pos) || !finite$1(P2) || Bp >= D2 / 0.81) return null;
  const Qf2 = U2 > 0 ? Math.max(0, 1 - 0.3 * U2 * (1 + U2)) : 1, Rn = Fy * t2 * t2 * (5.5 / (1 - 0.81 * Bp / D2)) * Qf2 / 1e3;
  return { Qf: Qf2, Rn, phiRn: 0.9 * Rn, dc: ratio(Math.abs(P2), 0.9 * Rn) };
}
function rowStatus(dc2, { missing = [], unsupported = null } = {}) {
  if (unsupported) return "fail";
  if (missing.length) return "missing";
  if (dc2 === null || dc2 === void 0 || Number.isNaN(dc2)) return "missing";
  return dc2 <= 1 + 1e-9 ? "pass" : "fail";
}
function shearBreakout({ V: V2, ca1, ca2, rowWidth, pedB, ha: ha2, hef, da: da2, fc: fc2, lambda = 1 }) {
  if (![ca1, ca2, pedB, ha2, hef, da2, fc2].every(pos) || !finite$1(V2) || !(rowWidth >= 0)) return null;
  const le2 = Math.min(hef, 8 * da2), base = lambda * Math.sqrt(fc2) * ca1 ** 1.5;
  const Vb2 = Math.min(0.6 * (le2 / da2) ** 0.2 * Math.sqrt(da2) * base, 3.7 * base) / 1e3;
  const width = Math.min(pedB, rowWidth + Math.min(1.5 * ca1, ca2) * 2), height = Math.min(1.5 * ca1, ha2);
  const Avc = width * height, Avco = 4.5 * ca1 * ca1, psiEd = ca2 >= 1.5 * ca1 ? 1 : 0.7 + 0.3 * ca2 / (1.5 * ca1);
  const psiH = ha2 >= 1.5 * ca1 ? 1 : Math.sqrt(1.5 * ca1 / ha2), Vcbg = Avc / Avco * psiEd * psiH * Vb2, phi = 0.7;
  return { le: le2, Vb: Vb2, Avc, Avco, psiEd, psiH, Vcbg, phiVcbg: phi * Vcbg, dc: ratio(Math.abs(V2), phi * Vcbg) };
}
function pryout({ V: V2, Ncbg, hef }) {
  if (!pos(Ncbg) || !pos(hef) || !finite$1(V2)) return null;
  const kcp = hef >= 65 ? 2 : 1, phiVcpg = 0.7 * kcp * Ncbg;
  return { kcp, phiVcpg, dc: ratio(Math.abs(V2), phiVcpg) };
}
function tensionShearInteraction({ N: N2, phiNn, V: V2, phiVn }) {
  if (!pos(phiNn) || !pos(phiVn) || !finite$1(N2) || !finite$1(V2)) return null;
  const n2 = Math.max(0, N2) / phiNn, v2 = Math.abs(V2) / phiVn;
  if (v2 <= 0.2) return { n: n2, v: v2, rule: "17.6.1", dc: n2 };
  if (n2 <= 0.2) return { n: n2, v: v2, rule: "17.6.2", dc: v2 };
  return { n: n2, v: v2, rule: "17.6.3", dc: (n2 + v2) / 1.2 };
}
function developmentLength({ db: db2, fy, fc: fc2, hooked = false, lambda = 1 }) {
  if (![db2, fy, fc2].every(pos)) return null;
  if (hooked) return Math.max(0.24 * fy / (lambda * Math.sqrt(fc2)) * db2, 8 * db2, 150);
  return Math.max((db2 <= 19 ? fy / (2.1 * lambda * Math.sqrt(fc2)) : fy / (1.7 * lambda * Math.sqrt(fc2))) * db2, 300);
}
function anchorReinforcement({ anchors, bars, hef, cTop, fy, fc: fc2, hooked = false, belowCrack }) {
  if (!Array.isArray(anchors) || !Array.isArray(bars) || ![hef, cTop, fy, fc2].every(pos)) return null;
  const tension = anchors.filter((a) => a.T > 0), sumT = tension.reduce((s, a) => s + a.T, 0);
  if (!tension.length) return { sumT: 0, bars: [], As: 0, phiNs: Infinity, dc: 0 };
  const used = /* @__PURE__ */ new Map();
  for (const a of tension) for (const b of bars) {
    const dist = Math.hypot(a.x - b.x, a.z - b.z);
    if (dist > 0.5 * hef + 1e-9) continue;
    const above = hef - dist / 1.5 - cTop, ld2 = developmentLength({ db: b.db, fy, fc: fc2, hooked });
    if (!(above >= ld2 - 1e-9) || !(belowCrack >= developmentLength({ db: b.db, fy, fc: fc2 }) - 1e-9)) continue;
    const prev = used.get(b.id);
    if (!prev || above > prev.above) used.set(b.id, { ...b, dist, above, ld: ld2 });
  }
  const list = [...used.values()], As = list.reduce((s, b) => s + Math.PI * b.db * b.db / 4, 0), phiNs = 0.75 * fy * As / 1e3;
  return { sumT, bars: list, As, phiNs, dc: ratio(sumT, phiNs) };
}
function rectangularWeldLine({ N: N2, Vv, Vh: Vh2, Mv, Mh: Mh2, T: T2, d, b }) {
  if (![d, b].every(pos) || ![N2, Vv, Vh2, Mv, Mh2, T2].every(finite$1)) return null;
  const A2 = 2 * (b + d), Sv = b * d + d * d / 3, Sh2 = d * b + b * b / 3, J2 = (b + d) ** 3 / 6;
  const fn = Math.abs(N2) * 1e3 / A2 + Math.abs(Mv) * 1e6 / Sv + Math.abs(Mh2) * 1e6 / Sh2;
  const ft = Math.abs(T2) * 1e6 * Math.hypot(b, d) / 2 / J2, fv = Math.hypot(Math.abs(Vv) * 1e3 / A2, Math.abs(Vh2) * 1e3 / A2) + ft;
  return { A: A2, Sv, Sh: Sh2, J: J2, fn, fv, q: Math.hypot(fn, fv) };
}
function weldBaseMetal({ qn, qv, t: t2, Fy, Fu }) {
  if (![t2, Fy, Fu].every(pos) || !finite$1(qn) || !finite$1(qv)) return null;
  const phiTn = Math.min(0.9 * Fy * t2, 0.75 * Fu * t2), phiVn = Math.min(0.6 * Fy * t2, 0.75 * 0.6 * Fu * t2);
  return { phiTn, phiVn, dc: Math.max(Math.abs(qn) / phiTn, Math.abs(qv) / phiVn) };
}
function chsLongitudinalPlate({ P: P2, lb: lb2, D: D2, t: t2, Fy, U: U2 = 0 }) {
  if (![lb2, D2, t2, Fy].every(pos) || !finite$1(P2)) return null;
  const Qf2 = Math.max(0, 1 - 0.3 * U2 * (1 + U2)), Rn = 5.5 * Fy * t2 * t2 * (1 + 0.25 * lb2 / D2) * Qf2 / 1e3;
  return { Qf: Qf2, Rn, phiRn: 0.9 * Rn, dc: ratio(Math.abs(P2), 0.9 * Rn) };
}
function k2Limits({ D: D2, t: t2, Bp, Fy, Fu }) {
  const out = [];
  if (!(D2 / t2 <= 50)) out.push(`D/t = ${(D2 / t2).toFixed(1)} > 50`);
  if (!(Bp / D2 > 0.2 && Bp / D2 <= 1)) out.push(`B/D = ${(Bp / D2).toFixed(2)} นอกช่วง 0.2–1.0`);
  if (!(Fy <= 360)) out.push(`Fy = ${Fy.toFixed(0)} > 360 MPa`);
  if (!(Fy / Fu <= 0.8)) out.push(`Fy/Fu = ${(Fy / Fu).toFixed(2)} > 0.8`);
  return out;
}
const HEAVY_HEX_AF = Object.freeze({ 16: 27, 20: 34, 24: 41, 30: 50, 36: 60 });
function plateWasherR69(da2) {
  const F2 = HEAVY_HEX_AF[da2];
  if (!F2) return null;
  const OD = Math.ceil(1.6 * F2 / 5) * 5, need = (OD - F2) / 2, t2 = [12, 16, 20, 25].find((x2) => x2 >= need - 1e-9) ?? Math.ceil(need);
  return { F: F2, OD, t: t2, projection: need, Abrg: Math.PI / 4 * (OD * OD - da2 * da2) };
}
function headedPullout({ T: T2, fc: fc2, da: da2, washer = null }) {
  const F2 = HEAVY_HEX_AF[da2];
  if (!F2 || !pos(fc2) || !finite$1(T2)) return null;
  const Ahead = Math.sqrt(3) / 2 * F2 * F2, Abrg = (washer == null ? void 0 : washer.Abrg) > 0 ? washer.Abrg : Ahead - Math.PI * da2 * da2 / 4, Np = 8 * Abrg * fc2 / 1e3, phiNp = 0.7 * Np;
  return { F: F2, Ahead, Abrg, washer, Np, phiNp, dc: ratio(Math.max(0, T2), phiNp) };
}
function requiredFilletLeg({ q: q2, Fexx, tThin }) {
  if (!pos(Fexx) || !finite$1(q2)) return null;
  const need = Math.abs(q2) / (0.75 * 0.6 * Fexx * 0.707), aMin = pos(tThin) ? minFillet(tThin) : 3;
  return Math.max(aMin, Math.ceil(need - 1e-9));
}
function pileKind(text2) {
  const s = String(text2 || "");
  if (/ไอ|(^|[^A-Za-z])I(-?\s?\d|-?pile|$|[^A-Za-z])/.test(s)) return "I";
  if (/กลวง|สปัน|spun|hollow/i.test(s)) return "hollow";
  if (/สี่เหลี่ยม|ตัน|square|solid/i.test(s)) return "square";
  return "unknown";
}
function pileHeadAnchorage({ T: T2, kind, enteredTon, source, dowel }) {
  if (!finite$1(T2)) return null;
  if (T2 <= 1e-9) return { n: 0, dc: 0, note: "ไม่มีแรงดึงที่หัวเข็ม" };
  if (pos(enteredTon)) {
    const R2 = enteredTon * 9.80665;
    return {
      entered: true,
      R: R2,
      enteredTon,
      source: source || "",
      dc: T2 / R2,
      note: `กำลังยึดหัวเข็มจากผู้ผลิต ${enteredTon} ตัน/ต้น (${R2.toFixed(1)} kN)${source ? " · " + source : ""}`,
      missing: source ? [] : [{ key: "pileHeadRef69", label: "ที่มาของกำลังยึดหัวเข็ม (ผู้ผลิต/เอกสาร)" }]
    };
  }
  if (kind === "square" && dowel) return dowel;
  return { info: true, excluded: true, dc: 0, note: `แรงดึงหัวเข็ม ULS = ${T2.toFixed(1)} kN/ต้น · การยึดหัวเข็มใช้รายละเอียดมาตรฐานหัวเข็ม (ข้อยกเว้น — วิศวกรผู้ลงนามพิจารณา)` };
}
function pileHeadDowels({ T: T2, fy, fc: fc2, pileSize, capDepth, tauCr = 1.4, tauUncr = 4.5 }) {
  if (!finite$1(T2) || ![fy, fc2, pileSize].every(pos)) return null;
  if (T2 <= 1e-9) return { n: 0, dc: 0, note: "ไม่มีแรงดึงที่หัวเข็ม" };
  for (const db2 of [12, 16, 20]) {
    const ca2 = pileSize / 2;
    if (ca2 < 6 * db2 - 1e-9) continue;
    const As = Math.PI * db2 * db2 / 4, cNa = 10 * db2 * Math.sqrt(tauUncr / 7.6), ld2 = Math.ceil(developmentLength({ db: db2, fy, fc: fc2 }) / 10) * 10;
    if (pos(capDepth) && capDepth < ld2 - 1e-9) continue;
    for (let hef = 10 * db2; hef <= 20 * db2 + 1e-9; hef += 10) {
      const ANao = (2 * cNa) ** 2, ANa = Math.min(ANao, pileSize * pileSize), psiEd = Math.min(1, 0.7 + 0.3 * ca2 / cNa);
      const Nba = tauCr * Math.PI * db2 * hef / 1e3, phiNa = 0.65 * ANa / ANao * psiEd * Nba, phiNs = 0.75 * As * fy / 1e3, phiN = Math.min(phiNa, phiNs);
      if (T2 <= phiN + 1e-9) return { n: 1, db: db2, hef, ca: ca2, cNa, ANa, ANao, psiEd, Nba, phiNa, phiNs, phiN, ld: ld2, capDepth, dc: T2 / phiN };
    }
  }
  return null;
}
function shearTies({ pedB, pitch, cover, db: db2 = 12 }) {
  if (![pedB, pitch, cover, db2].every(pos)) return null;
  const ca1 = pedB / 2 - pitch / 2, limit = Math.min(0.5 * ca1, 0.3 * ca1), layers = [];
  for (let i = 0; ; i++) {
    const depth = cover + db2 / 2 + i * (db2 + 25);
    if (depth > limit + 1e-9 || i > 20) break;
    layers.push({ depth });
  }
  return { ca1, limit, db: db2, layers, count: layers.length };
}
function shearTieReinforcement({ V: V2, pedB, pitch, cover, fy, db: db2 = 12 }) {
  const st = shearTies({ pedB, pitch, cover, db: db2 });
  if (!st || !pos(fy) || !finite$1(V2)) return null;
  const Ab2 = Math.PI * db2 * db2 / 4, phiVs = 0.75 * st.count * 2 * Ab2 * fy / 1e3;
  return { ...st, Ab: Ab2, phiVs, dc: st.count ? ratio(Math.abs(V2), phiVs) : Infinity };
}
function sideFaceBlowout({ T: T2, ca1, ca2 = ca1, Abrg, fc: fc2, hef, lambda = 1 }) {
  if (![ca1, Abrg, fc2, hef].every(pos) || !finite$1(T2)) return null;
  if (hef <= 2.5 * ca1 + 1e-9) return { applicable: false, dc: 0 };
  const r2 = Math.min(3, Math.max(1, ca2 / ca1)), corner = ca2 < 3 * ca1 ? (1 + r2) / 4 : 1;
  const Nsb = 13 * ca1 * Math.sqrt(Abrg) * lambda * Math.sqrt(fc2) / 1e3 * corner, phiNsb = 0.7 * Nsb;
  return { applicable: true, corner, Nsb, phiNsb, dc: ratio(Math.max(0, T2), phiNsb) };
}
const COARSE_PITCH = Object.freeze({ 16: 2, 20: 2.5, 24: 3, 30: 3.5, 36: 4 });
function anchorSteelACI({ da: da2, futa, fya = null, grout = true }) {
  if (![da2, futa].every(pos)) return null;
  const p2 = COARSE_PITCH[da2] || 0.125 * da2, Ase = Math.PI / 4 * (da2 - 0.9382 * p2) ** 2, fu = Math.min(futa, 860, pos(fya) ? 1.9 * fya : Infinity);
  return { p: p2, Ase, phiNsa: 0.75 * Ase * fu / 1e3, phiVsa: 0.65 * 0.6 * Ase * fu * (grout ? 0.8 : 1) / 1e3 };
}
const checks = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  COARSE_PITCH,
  HEAVY_HEX_AF,
  anchorReinforcement,
  anchorSteelACI,
  anchorTensionShear,
  chsLongitudinalPlate,
  chsTransversePlate,
  developmentLength,
  filletWeld,
  fyThicknessFactor,
  headedPullout,
  hookPullout,
  k2Limits,
  minFillet,
  pileHeadAnchorage,
  pileHeadDowels,
  pileKind,
  plateTensionSide,
  plateWasherR69,
  pryout,
  rectangularWeldLine,
  requiredFilletLeg,
  rowStatus,
  shearBreakout,
  shearTieReinforcement,
  shearTies,
  sideFaceBlowout,
  tensionShearInteraction,
  weldBaseMetal
}, Symbol.toStringTag, { value: "Module" }));
const finite = (x2) => typeof x2 === "number" && Number.isFinite(x2);
const maxBy = (list, f2) => list.reduce((best, x2) => {
  const v2 = f2(x2);
  return finite(v2) && (!best || v2 > best.v) ? { x: x2, v: v2 } : best;
}, null);
const nf$1 = (x2, d = 1) => finite(x2) ? x2.toFixed(d) : "—";
const STATUS_TEXT = Object.freeze({ pass: "ผ่าน", fail: "ไม่ผ่าน", missing: "ขาดข้อมูล" });
const BADGE_PASS = "ผ่านรายการตรวจระดับยื่นขออนุญาต · ต้องให้วิศวกรผู้มีใบอนุญาตตรวจและลงนาม";
function row(id2, title, ref, dc2, extra = {}) {
  const status = rowStatus(dc2, extra);
  return { id: id2, title, ref, dc: finite(dc2) || dc2 === Infinity ? dc2 : null, status, statusText: STATUS_TEXT[status], ...extra };
}
const worst = (id2, title, ref, parts, extra = {}) => {
  var _a2;
  const list = parts.filter(Boolean), missing = list.flatMap((p2) => p2.missing || []), unsupported = ((_a2 = list.find((p2) => p2.unsupported)) == null ? void 0 : _a2.unsupported) || extra.unsupported || null;
  const gov = maxBy(list.filter((p2) => p2.dc !== null && p2.dc !== void 0), (p2) => p2.dc === Infinity ? 1e9 : p2.dc);
  return row(
    id2,
    title,
    ref,
    list.length && list.every((p2) => p2.dc !== null && p2.dc !== void 0) ? (gov == null ? void 0 : gov.x.dc) ?? null : null,
    { ...extra, missing, unsupported, caseId: (gov == null ? void 0 : gov.x.caseId) ?? null, parts: list }
  );
};
function sideFaceDesign48(sf2, Tmax) {
  var _a2;
  if (!sf2 || sf2.applicable === false || sf2.status === "N/A" || !(((_a2 = sf2.gov) == null ? void 0 : _a2.dc) > 0) || !(Tmax > 0)) return Infinity;
  return Tmax / sf2.gov.dc;
}
function pileShape69(w2) {
  var _a2, _b, _c, _d;
  try {
    const s = (_d = (_c = (_b = (_a2 = w2.NCYCP005) == null ? void 0 : _a2.configuration) == null ? void 0 : _b.call(_a2)) == null ? void 0 : _c.capacity) == null ? void 0 : _d.pileShape;
    return s === "I" ? "I" : s === "square" ? "square" : null;
  } catch {
    return null;
  }
}
function buildChecklist(ctx) {
  var _a2, _b, _c, _d, _e, _f, _g;
  if (!ctx) return null;
  const g = ctx.geom, m2 = ctx.mat, rows = [];
  rows.push(row("P1", "แรงลมออกแบบ", "มยผ.1311-50: p = Iw·q·Ce·Cg·Cp", ((_a2 = ctx.wind) == null ? void 0 : _a2.p) > 0 ? 0 : null, { calc: ctx.wind, info: true }));
  const member = (list) => worst(null, null, null, list.map((x2) => ({ dc: x2.dc, caseId: x2.caseId, label: x2.id, unsupported: x2.unsupported })));
  const pole = member(ctx.members.filter((x2) => x2.pole)), frame = member(ctx.members.filter((x2) => !x2.pole));
  rows.push(row("P2", "เสา C1 รับแรงรวม", "AISC 360-16 H1/H3, E3/E7, F8, G5", pole.dc, { caseId: pole.caseId, unsupported: pole.unsupported, parts: pole.parts }));
  rows.push(row("P3", "โครงป้าย", "AISC 360-16 H1/H3, E3/E7, F7/F8, G4/G5", frame.dc, { caseId: frame.caseId, unsupported: frame.unsupported, parts: frame.parts }));
  rows.push(worst("P4", "การแอ่นตัว (L/180)", "เกณฑ์โครงการ L/180 (กรณีใช้งาน)", ctx.deflection.map((x2) => ({ ...x2 }))));
  rows.push(row("P5a", "คอนกรีตรับแรงกดใต้เพลท", "φ0.65·0.85f′c", ((_b = ctx.bearing) == null ? void 0 : _b.dc) ?? null, { caseId: (_c = ctx.bearing) == null ? void 0 : _c.caseId }));
  rows.push(row("P5b", "เพลทดัดด้านกด", "DG1: m = (B − 0.8D)/2, φ0.9Fy t²/4", ((_d = ctx.plateComp) == null ? void 0 : _d.dc) ?? null, { caseId: (_e = ctx.plateComp) == null ? void 0 : _e.caseId, calc: ctx.plateComp }));
  const p5 = [];
  for (const r3 of ctx.anchorRows) for (const T2 of r3.T) {
    const res = plateTensionSide({ T: T2, s: g.s, D: g.D, B: g.B, t: g.tp, FyNominal: m2.plateFy });
    if (res) p5.push({ ...res, caseId: r3.caseId, T: T2 });
  }
  const p5g = maxBy(p5, (x2) => x2.dc), geomBad = g.s / Math.SQRT2 - g.D / 2 <= 0;
  rows.push(row(
    "P5c",
    "เพลทดัดด้านดึง (สลัก)",
    "DG1 แถบยื่น: ℓ = s/√2 − D/2, b = min(2ℓ, √2B − D), φ0.9Fy t²/4",
    (p5g == null ? void 0 : p5g.v) ?? null,
    { caseId: p5g == null ? void 0 : p5g.x.caseId, calc: p5g == null ? void 0 : p5g.x, unsupported: geomBad ? "สลักอยู่ในเงาเสา (เรขาคณิตไม่รองรับ)" : null }
  ));
  rows.push(row("P6a", "สลักรับแรงดึง", "AISC 360-16 J3: φ0.75·0.75Fu·Ab", ((_f = ctx.anchorSteel) == null ? void 0 : _f.dc) ?? null, { caseId: (_g = ctx.anchorSteel) == null ? void 0 : _g.caseId }));
  const share = ctx.welderWashers ? 4 : 2, r2 = g.s / Math.SQRT2, p6 = [];
  for (const a of ctx.anchorRows) {
    const V2 = a.Fh / share + Math.abs(a.Ty) * 1e3 / (share * r2), T2 = Math.max(0, ...a.T);
    const res = anchorTensionShear({ T: T2, V: V2, da: g.da, Fu: m2.anchorFu });
    if (res) p6.push({ ...res, caseId: a.caseId, T: T2, V: V2 });
  }
  const p6g = maxBy(p6, (x2) => x2.dc);
  rows.push(row("P6b", "สลักรับแรงเฉือน + แรงดึงร่วม", `AISC 360-16 J3.7 (สลักรับแรงเฉือน ${share} ต้น)`, (p6g == null ? void 0 : p6g.v) ?? null, { caseId: p6g == null ? void 0 : p6g.x.caseId, calc: p6g == null ? void 0 : p6g.x }));
  rows.push(ctx.p7 ? p7Row(ctx) : worst("P7", "ระยะฝังสลัก / คอนกรีตรับแรงยึด", "ACI 318M-14 17.4–17.6", ctx.p7parts || [{ dc: null }]));
  rows.push(weldRow(ctx));
  rows.push(ctx.p8b ? worst("P8b", "จุดยึดโครงป้าย–เสา", "AISC 360-16 H1, J2.4, §K2", ctx.p8b) : row("P8b", "จุดยึดโครงป้าย–เสา", "AISC 360-16", null));
  if (ctx.p8c) rows.push(worst("P8c", "แผ่นปิดหัวเสา CP1 + ครีบ", "DG1 แถบยื่น + §K2", ctx.p8c));
  rows.push(...pileRows(ctx));
  rows.push(worst(
    "P10",
    "ฐานราก RC และตอม่อ",
    "ACI 318M-14 (ดัด, เฉือน, เจาะทะลุ, ตอม่อ P–M–V, ยึดเหนี่ยว, เดือย)",
    ctx.foundation.rows,
    { unsupported: ctx.foundation.spread ? "ฐานแผ่ (ไม่มีเข็ม) ยังไม่รองรับ — ใช้ฐานเข็ม" : ctx.foundation.unsupported || null }
  ));
  const matMissing = Object.entries(ctx.materialSet || {}).filter(([, v2]) => !(v2 > 0)).map(([k]) => ({ key: k, label: k }));
  rows.push(row("P11", "วัสดุ + เสถียรภาพฐาน", "วัสดุครบ · พลิกคว่ำ/ยกตัวผ่านเข็ม (P9)", 0, { missing: matMissing, calc: ctx.materialSet }));
  const appendixNG = (ctx.appendix || []).filter((x2) => x2.status === "fail");
  const counts = { pass: 0, fail: 0, missing: 0, excluded: 0 };
  for (const x2 of rows) counts[x2.excluded ? "excluded" : x2.status]++;
  const verdict = counts.fail || appendixNG.length ? "fail" : counts.missing ? "missing" : "pass";
  return {
    type: ctx.type,
    rows,
    appendix: ctx.appendix || [],
    appendixNG,
    counts,
    verdict,
    badge: verdict === "pass" ? BADGE_PASS : null,
    exclusions: EXCLUSIONS,
    source: ctx.source
  };
}
const EXCLUSIONS = Object.freeze([
  "แรงด้านข้างของเข็มและการทรุดตัว: ไม่ได้คำนวณ — ใช้ข้อมูลผู้ผลิตเข็ม/ดินรอบฐาน (D7)",
  "แรงลมป้ายสองแผ่นใช้แรงดันเต็มทั้งสองหน้าโดยไม่ลดจากการบัง (อนุรักษ์นิยม) + ลมเยื้อง 0.2b (D1)",
  "ไม่รวม: STM, joint shear, prying เชิงลึก, พลศาสตร์/การสั่นจากลม, ความล้า, น็อต/แหวน, ครีบเพลทฐาน (ไม่นับกำลัง)",
  "หน้าตัด RHS ผนังบาง (ไม่ compact) และท่อ D/t ≥ 0.45E/Fy: ไม่รองรับ = ไม่ผ่าน",
  "การยึดหัวเข็มรับแรงดึง (P9c): แสดงค่าแรงดึงหัวเข็ม ULS ต่อต้นเป็นข้อมูล — ใช้รายละเอียดมาตรฐานหัวเข็ม (สกัดหัวเข็มให้เหล็กยื่นเข้าฐาน/ตามผู้ผลิต) ให้วิศวกรผู้ลงนามพิจารณา · เข็มสี่เหลี่ยมตันที่ระบบออกแบบเหล็กเดือยกลางเข็ม หรือกรอกกำลังยึดจากผู้ผลิต จะตรวจเป็นรายการ",
  'ผลรวม "ผ่าน" ไม่ใช่การรับรอง — วิศวกรผู้มีใบอนุญาตต้องตรวจและลงนาม'
]);
function p7Row(ctx) {
  var _a2, _b, _c;
  const p2 = ctx.p7, parts = [];
  parts.push({ label: "pullout หัวน็อต (17.4.3.4)", ...p2.pullout });
  parts.push(p2.breakout && p2.breakout.dc <= 1 ? { label: "breakout กลุ่ม", ...p2.breakout } : p2.reinforcement ? { label: "เหล็กเสริมรับแรงยึด (17.4.2.9)", ...p2.reinforcement, caseId: (_a2 = p2.breakout) == null ? void 0 : _a2.caseId } : { label: "breakout กลุ่ม", ...p2.breakout || { dc: null } });
  if (p2.sideFace) parts.push({ label: "side-face blowout (17.4.4)", ...p2.sideFace });
  if (p2.ties) parts.push({ label: `ปลอกเสริมรับแรงเฉือนหัวตอม่อ ${p2.ties.count}-DB${p2.ties.db} (17.5.2.9)`, ...p2.ties });
  else if (p2.shear) parts.push({ label: "คอนกรีตรับแรงเฉือน (17.5.2)", ...p2.shear });
  if (p2.pryout) parts.push({ label: "pry-out (17.5.3)", ...p2.pryout });
  if (p2.interaction) parts.push({ label: "แรงร่วม (17.6)", ...p2.interaction });
  return worst("P7", "ระยะฝังสลัก / คอนกรีตรับแรงยึด", "ACI 318M-14 17.4.2, 17.4.3.5, 17.4.2.9, 17.5.2, 17.5.3, 17.6", parts, { calc: { hef: p2.hef, Abrg: (_b = p2.pullout) == null ? void 0 : _b.Abrg, washer: (_c = p2.pullout) == null ? void 0 : _c.washer } });
}
function weldRow(ctx) {
  const w2 = ctx.weldBase;
  if (!w2) return row("P8a", "รอยเชื่อมเสา–เพลทฐาน (WB)", "AISC 360-16 J2.4", null);
  const missing = w2.a > 0 ? [] : [{ key: w2.legKey, label: "ขาเชื่อมฐานเสา (mm)" }];
  if (!(w2.Fexx > 0)) missing.push({ key: "Fexx", label: "กำลังลวดเชื่อม Fexx" });
  const g = maxBy(w2.rows, (x2) => x2.q), q2 = (g == null ? void 0 : g.v) ?? null;
  const weld = q2 === null || missing.length ? null : filletWeld({ q: q2, a: w2.a, Fexx: w2.Fexx, tThin: w2.tThin });
  const gn = maxBy(w2.rows, (x2) => {
    var _a2;
    return (_a2 = weldBaseMetal({ qn: x2.qn, qv: x2.qv, t: w2.tWall, Fy: w2.FyWall, Fu: w2.FuWall })) == null ? void 0 : _a2.dc;
  }), base = gn ? weldBaseMetal({ qn: gn.x.qn, qv: gn.x.qv, t: w2.tWall, Fy: w2.FyWall, Fu: w2.FuWall }) : null;
  const parts = [
    { label: "รอยเชื่อม", dc: (weld == null ? void 0 : weld.dc) ?? null, caseId: g == null ? void 0 : g.x.caseId, missing, unsupported: weld && !weld.minOK ? `ขาเชื่อม ${w2.a} mm < ขั้นต่ำ ${weld.aMin} mm (J2.4)` : null },
    { label: "เนื้อเหล็กผนังเสา (J4)", dc: (base == null ? void 0 : base.dc) ?? null, caseId: gn == null ? void 0 : gn.x.caseId }
  ];
  const aReq = q2 === null ? null : requiredFilletLeg({ q: q2, Fexx: w2.Fexx, tThin: w2.tThin });
  return worst("P8a", "รอยเชื่อมเสา–เพลทฐาน (WB)", "AISC 360-16 J2.4 / J4: φ0.75·0.6Fexx·0.707a", parts, { calc: { q: q2, ...w2, rows: void 0, weld, base, aReq } });
}
function pileRows(ctx) {
  const pg2 = ctx.piles;
  if (!pg2) return [row("P9a", "เข็มรับแรงอัด (ASD)", "Safe load ผู้ผลิต", null), row("P9b", "เข็มรับแรงถอน (ASD)", "กำลังถอนผู้ผลิต", null), row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", "แรงดึงหัวเข็ม", null)];
  const comp = row(
    "P9a",
    "เข็มรับแรงอัด (ASD)",
    "R_max(D+W, 0.6D+W) ≤ Safe load",
    finite(pg2.compDC) ? pg2.compDC : null,
    { missing: pg2.capOk ? [] : [{ key: "pileSafeLoad", label: "Safe load เข็ม" }] }
  );
  const uplift = pg2.maxUpliftASD > 1e-6;
  const ten = row(
    "P9b",
    "เข็มรับแรงถอน (ASD)",
    "|R_min(0.6D+W)| ≤ กำลังถอนผู้ผลิต",
    uplift ? finite(pg2.tenDC) ? pg2.tenDC : null : 0,
    { missing: uplift && !finite(pg2.tenDC) ? [{ key: "n67PileTension", label: "กำลังรับแรงถอนเข็ม (ตัน/ต้น) + ที่มา" }] : [], calc: { maxUpliftASD: pg2.maxUpliftASD } }
  );
  const T2 = pg2.ulsTension || 0, head = ctx.pileHead;
  const dowelText = (h) => `เหล็กเดือยหัวเข็ม ${h.n}-DB${h.db} กลางเข็ม ฝังเข็ม ${h.hef} mm (epoxy, ACI 17.4.5 τcr 1.4 MPa, ระยะขอบ ${h.ca} ≥ 6da) + ld ${Math.round(h.ld)} mm ในฐาน`;
  const headRow = T2 <= 1e-6 ? row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", "ไม่มีแรงดึงที่หัวเข็ม", 0, { calc: { T: T2 } }) : (head == null ? void 0 : head.info) ? row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", head.note, 0, { info: true, excluded: true, statusText: "ข้อยกเว้น (แสดงค่า)", calc: { T: T2, ...head } }) : (head == null ? void 0 : head.dc) !== void 0 && (head == null ? void 0 : head.dc) !== null ? row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", head.n ? dowelText(head) : head.note || "เหล็กเดือยหัวเข็ม", head.dc, { calc: { T: T2, ...head }, missing: head.missing || [] }) : (head == null ? void 0 : head.missing) ? row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", "T_ULS ≤ กำลังยึดหัวเข็ม", null, { missing: head.missing, calc: { T: T2 } }) : row("P9c", "การยึดหัวเข็มรับแรงดึง (ULS)", "T_ULS ≤ กำลังยึดหัวเข็ม", null, { missing: [{ key: "pileHead", label: "รายละเอียดยึดหัวเข็มรับแรงดึงจากผู้ผลิตเข็ม (เดือย 1 เส้นกลางเข็มไม่พอ)" }], calc: { T: T2 } });
  return [comp, ten, headRow];
}
const rhsProps = (H2, B2, t2) => {
  const A2 = 2 * t2 * (H2 + B2 - 2 * t2), Iv = (B2 * H2 ** 3 - (B2 - 2 * t2) * (H2 - 2 * t2) ** 3) / 12, Ih2 = (H2 * B2 ** 3 - (H2 - 2 * t2) * (B2 - 2 * t2) ** 3) / 12;
  return { type: "RHS", H: H2, B: B2, t: t2, A: A2, Iy: Ih2, Iz: Iv, Sy: Ih2 / (B2 / 2), Sz: Iv / (H2 / 2) };
};
function collectType1(w2) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D;
  const view = (_b = (_a2 = w2.NCYSignPositions) == null ? void 0 : _a2.analysisView) == null ? void 0 : _b.call(_a2), r2 = view == null ? void 0 : view.result, p2 = r2 == null ? void 0 : r2.permitR4, a = p2 == null ? void 0 : p2.downstreamR5;
  if (!p2 || !a) return null;
  const doc = w2.document, num = (id2) => {
    var _a3;
    return Number((_a3 = doc.getElementById(id2)) == null ? void 0 : _a3.value);
  }, stress = (id2) => typeof w2.stressIn === "function" ? w2.stressIn(id2) : num(id2);
  const mat = a.materials || {}, D2 = num("D"), tPole = num("t"), B2 = num("plateB"), tp = num("plateT"), edge = num("edgeDist"), da2 = num("boltD");
  const g = { D: D2, tPole, B: B2, tp, edge, s: B2 - 2 * edge, da: da2, embed: num("embed"), jRadius: num("jRadius"), pedB: num("ped") * 1e3, pedH: num("pedH") * 1e3 };
  const m2 = { plateFy: mat.plateFy, anchorFu: mat.anchorFu, fc: mat.fc, fy: stress("rebarFy"), Fy: mat.Fy, Fu: mat.poleFu, frameFy: mat.frameFy, frameFu: mat.frameFu, Fexx: stress("weldFexx"), E: mat.E };
  const members = p2.members.map((x2) => {
    var _a3, _b2, _c2, _d2, _e2;
    return {
      id: x2.id,
      pole: x2.group === "C1",
      dc: ((_a3 = x2.gov) == null ? void 0 : _a3.dc) ?? null,
      caseId: (_b2 = x2.gov) == null ? void 0 : _b2.caseId,
      unsupported: x2.status === "HOLD" || ((_d2 = (_c2 = x2.cap) == null ? void 0 : _c2.slender) == null ? void 0 : _d2.unsupported) ? `${x2.section}: หน้าตัดไม่รองรับ (${(((_e2 = x2.cap) == null ? void 0 : _e2.issues) || []).join(" / ") || "HOLD"})` : null
    };
  });
  const deflection = [{ id: "เสา", dc: ((_c = p2.deflection) == null ? void 0 : _c.dc) ?? null, caseId: (_d = p2.deflection) == null ? void 0 : _d.caseId }, ...(p2.frameDeflections || []).map((x2) => ({ id: x2.id, dc: x2.dc ?? null, caseId: x2.caseId }))];
  const anchorRows = (((_e = a.anchor) == null ? void 0 : _e.rows) || []).map((x2) => ({ caseId: x2.caseId, T: x2.T, Fh: x2.Fh || 0, Ty: x2.Ty || 0 }));
  const nf2 = (_i = (_f = w2.NCYAutoR13) == null ? void 0 : _f.type1Foundation) == null ? void 0 : _i.call(_f, (_h = (_g = w2.NCYAnchorR10) == null ? void 0 : _g.snapshot) == null ? void 0 : _h.call(_g));
  const ctx = {
    type: "TYPE1",
    source: { modelId: view.modelId || ((_j = r2.permitR4) == null ? void 0 : _j.projectKey) || null },
    wind: ((_k = r2.wind) == null ? void 0 : _k.strength) ? { V: r2.wind.strength.V, q: r2.wind.strength.q, p: r2.wind.strength.p, province: (_l = r2.wind.location) == null ? void 0 : _l.province } : null,
    geom: g,
    mat: m2,
    members,
    deflection,
    bearing: ((_m = a.contact) == null ? void 0 : _m.bearingGov) ? { dc: a.contact.bearingGov.dcBearing, caseId: a.contact.bearingGov.caseId } : null,
    plateComp: ((_n = a.contact) == null ? void 0 : _n.plateGov) ? { dc: a.contact.plateGov.dcPlate, caseId: a.contact.plateGov.caseId, m: a.contact.plateGov.m, mu: a.contact.plateGov.mu, phiMn: a.contact.plateGov.phiMn } : null,
    anchorRows,
    anchorSteel: a.anchor ? { dc: a.anchor.maxDC, caseId: (_o = a.anchor.worst) == null ? void 0 : _o.caseId } : null,
    welderWashers: !!((_p = doc.getElementById("r69WeldedWasher")) == null ? void 0 : _p.checked),
    weldBase: {
      legKey: "weldA",
      a: num("weldA"),
      Fexx: m2.Fexx,
      tThin: Math.min(tPole, tp),
      tWall: tPole,
      FyWall: m2.Fy,
      FuWall: m2.Fu,
      rows: (a.weld || []).map((x2) => {
        var _a3, _b2, _c2, _d2, _e2, _f2;
        return { caseId: x2.caseId, q: x2.upperBound_N_per_mm, qn: Math.abs(((_b2 = (_a3 = x2.peak) == null ? void 0 : _a3.q_N_per_mm) == null ? void 0 : _b2[1]) ?? x2.upperBound_N_per_mm), qv: Math.hypot(((_d2 = (_c2 = x2.peak) == null ? void 0 : _c2.q_N_per_mm) == null ? void 0 : _d2[0]) ?? 0, ((_f2 = (_e2 = x2.peak) == null ? void 0 : _e2.q_N_per_mm) == null ? void 0 : _f2[2]) ?? 0) };
      })
    },
    materialSet: { ["f′c"]: m2.fc, ["fy เหล็กเสริม"]: m2.fy, ["Fy เสา"]: m2.Fy, ["Fu เสา"]: m2.Fu, ["Fy เพลท"]: m2.plateFy, ["Fu สลัก"]: m2.anchorFu, ["Fexx"]: m2.Fexx },
    foundation: {
      spread: ((_q = doc.getElementById("foundationMode")) == null ? void 0 : _q.value) === "footing",
      rows: ((nf2 == null ? void 0 : nf2.rows) || []).map((x2) => ({ label: x2.label, dc: x2.dc, caseId: x2.caseId, unsupported: x2.status === "NG" && x2.dc === null ? x2.label : null })),
      unsupported: nf2 && !nf2.geometryPass ? "เรขาคณิตฐานไม่ผ่าน" : null
    },
    appendix: []
  };
  if (!ctx.foundation.rows.length) ctx.foundation.rows = [{ label: "ฐาน RC", dc: null }];
  const hef = g.embed, anchors = ((_r = a.geometry) == null ? void 0 : _r.anchors) || [];
  const ped = (_u = (_t = (_s = nf2 == null ? void 0 : nf2.context) == null ? void 0 : _s.r) == null ? void 0 : _t.pedestal47) == null ? void 0 : _u.chosen, gNat = { pedB: g.pedB, anchors };
  const bo = typeof w2.tensionBreakoutCase41 === "function" && hef > 0 ? maxBy(((_v = a.anchor) == null ? void 0 : _v.rows) || [], (x2) => {
    var _a3;
    return (_a3 = w2.tensionBreakoutCase41(x2, gNat, { anchorHef41: hef, baseFc40: m2.fc, anchorLambda41: 1 })) == null ? void 0 : _a3.dc;
  }) : null;
  const breakout = bo ? w2.tensionBreakoutCase41(bo.x, gNat, { anchorHef41: hef, baseFc40: m2.fc, anchorLambda41: 1 }) : null;
  const pullG = maxBy(anchorRows, (x2) => Math.max(...x2.T)), pullout = headedPullout({
    T: pullG ? Math.max(...pullG.x.T) : 0,
    fc: m2.fc,
    da: da2,
    washer: plateWasherR69(da2)
    /* owner 2026-10-07: plate washer above the bottom nut, bearing on the concrete */
  });
  let reinforcement = null;
  if (breakout && breakout.dc > 1 && (ped == null ? void 0 : ped.pos) && bo) {
    const tension = anchors.map((an, i) => ({ x: an.x, z: an.z, T: Math.max(0, bo.x.T[i]) }));
    reinforcement = anchorReinforcement({
      anchors: tension,
      bars: ped.pos.map((b, i) => ({ id: "V" + (i + 1), x: b.x, z: b.z, db: ped.db })),
      hef,
      cTop: (ped.cover || num("pedCover")) + 3 * ped.db,
      fy: m2.fy,
      fc: m2.fc,
      hooked: ((_w = w2.NCYPermitR69Options) == null ? void 0 : _w.pedestalTopHook) !== false,
      belowCrack: g.pedH - hef + num("footT") * 1e3 - 75
    });
    if (reinforcement) reinforcement.caseId = bo.x.caseId;
  }
  const all4 = typeof w2.tensionBreakoutCase41 === "function" && hef > 0 ? w2.tensionBreakoutCase41({ caseId: "ALL", T: anchors.map(() => 1) }, gNat, { anchorHef41: hef, baseFc40: m2.fc, anchorLambda41: 1 }) : null;
  const shG = maxBy(anchorRows, (x2) => x2.Fh + Math.abs(x2.Ty) * 1e3 / g.s), Vrow = shG ? shG.v : 0, ca1 = g.pedB / 2 - g.s / 2;
  const shear = shearBreakout({ V: Vrow, ca1, ca2: ca1, rowWidth: g.s, pedB: g.pedB, ha: g.pedH, hef, da: da2, fc: m2.fc });
  const pry = (all4 == null ? void 0 : all4.Ncbg) ? pryout({ V: Vrow, Ncbg: all4.Ncbg, hef }) : null;
  const tiesAll = shearTieReinforcement({ V: Vrow, pedB: g.pedB, pitch: g.s, cover: (ped == null ? void 0 : ped.cover) || num("pedCover"), fy: m2.fy });
  const ties = tiesAll && tiesAll.count && (!shear || tiesAll.phiVs > shear.phiVcbg) ? tiesAll : null;
  const Tmax = pullG ? Math.max(...pullG.x.T) : 0, sideFace = pullout ? sideFaceBlowout({ T: Tmax, ca1, ca2: ca1, Abrg: pullout.Abrg, fc: m2.fc, hef }) : null;
  const st = anchorSteelACI({ da: da2, futa: m2.anchorFu }), share = ctx.welderWashers ? 4 : 2;
  const sumT = bo ? bo.x.T.reduce((s, x2) => s + Math.max(0, x2), 0) : 0, TmaxBo = bo ? Math.max(...bo.x.T) : 0;
  const concreteN = reinforcement && reinforcement.dc <= 1 ? Math.max(reinforcement.phiNs, (breakout == null ? void 0 : breakout.design) ?? 0) : breakout == null ? void 0 : breakout.design;
  const phiNn = Math.min((st == null ? void 0 : st.phiNsa) ?? Infinity, (pullout == null ? void 0 : pullout.phiNp) ?? Infinity, (sideFace == null ? void 0 : sideFace.applicable) ? sideFace.phiNsb : Infinity, concreteN && sumT > 0 ? concreteN * TmaxBo / sumT : Infinity);
  const phiVn = Math.min((st == null ? void 0 : st.phiVsa) ?? Infinity, (ties ? ties.phiVs : (shear == null ? void 0 : shear.phiVcbg) ?? Infinity) / share, ((pry == null ? void 0 : pry.phiVcpg) ?? Infinity) / share);
  const interaction = tensionShearInteraction({ N: TmaxBo, phiNn, V: Vrow / share, phiVn });
  const fx = (x2, d = 1) => finite(x2) ? x2.toFixed(d) : "—";
  if (pullout) pullout.note = `Np = 8·Abrg·f′c = 8·${fx(pullout.Abrg, 0)}·${fx(m2.fc)} = ${fx(pullout.Np)} kN, φ0.70 → ${fx(pullout.phiNp)} kN ≥ T ${fx(Math.max(...(pullG == null ? void 0 : pullG.x.T) || [0]))} kN`;
  if (reinforcement) reinforcement.note = `ΣT ${fx(reinforcement.sumT)} kN ≤ φ0.75·fy·ΣAs = 0.75·${fx(m2.fy, 0)}·${fx(reinforcement.As, 0)} = ${fx(reinforcement.phiNs)} kN (${reinforcement.bars.length} เส้นภายใน 0.5hef, ขอบน ldh)`;
  if (shear) shear.note = `ca1 = ${fx(ca1, 0)} mm, Vb = ${fx(shear.Vb)} kN, Avc/Avco = ${fx(shear.Avc / shear.Avco, 2)}, ψed = ${fx(shear.psiEd, 3)} → φVcbg = ${fx(shear.phiVcbg)} kN vs V ${fx(Vrow)} kN`;
  if (pry) pry.note = `φVcpg = 0.70·${pry.kcp}·Ncbg(${fx(all4 == null ? void 0 : all4.Ncbg)}) = ${fx(pry.phiVcpg)} kN`;
  if (sideFace == null ? void 0 : sideFace.applicable) sideFace.note = `Nsb = 13·ca1·√Abrg·√f′c·(1+ca2/ca1)/4 = ${fx(sideFace.Nsb)} kN, φ0.70 → ${fx(sideFace.phiNsb)} kN vs T ${fx(Tmax)} kN`;
  if (interaction) interaction.note = `${interaction.rule}: N/φNn = ${fx(interaction.n, 3)}, V/φVn = ${fx(interaction.v, 3)} (สลักที่รับแรงมากสุด, φNn ${fx(phiNn)} kN, φVn ${fx(phiVn)} kN)`;
  if (ties) ties.note = `ปลอกเสริม ${ties.count} ชั้น DB${ties.db} ภายใน min(0.5ca1, 0.3ca2) = ${fx(ties.limit, 0)} mm: φVs = 0.75·${ties.count}·2·Ab·fy = ${fx(ties.phiVs)} kN`;
  ctx.p7 = {
    hef,
    pullout: pullout ? { ...pullout, caseId: pullG == null ? void 0 : pullG.x.caseId } : { dc: null, missing: [{ key: "boltD", label: "ขนาดสลักที่มีน็อตหกเหลี่ยมหนาในตาราง (M16–M36)" }] },
    breakout: breakout && { ...breakout, dc: breakout.ok ? breakout.dc : null, caseId: bo == null ? void 0 : bo.x.caseId },
    reinforcement: reinforcement && reinforcement.dc <= 1 ? reinforcement : reinforcement && { ...reinforcement },
    shear: shear && { ...shear, caseId: shG == null ? void 0 : shG.x.caseId },
    ties: ties && { ...ties, caseId: shG == null ? void 0 : shG.x.caseId },
    sideFace: sideFace && sideFace.applicable ? { ...sideFace, caseId: pullG == null ? void 0 : pullG.x.caseId } : null,
    pryout: pry && { ...pry, caseId: shG == null ? void 0 : shG.x.caseId },
    interaction: interaction && { ...interaction, caseId: shG == null ? void 0 : shG.x.caseId }
  };
  ctx.p8b = bracketParts(w2, p2, g, m2, num);
  if ((nf2 == null ? void 0 : nf2.pileSummary) && ((_x = w2.NCYFoundationR9) == null ? void 0 : _x.pileGate)) {
    const gate = w2.NCYFoundationR9.pileGate(nf2.pileSummary);
    ctx.piles = { compDC: gate.compDC, tenDC: gate.tenDC, capOk: gate.capsOk !== false && finite(gate.compDC), maxUpliftASD: ((_y = nf2.pileSummary.maxUplift) == null ? void 0 : _y.ASD) || 0, ulsTension: gate.ulsTension };
  }
  {
    const T2 = ((_z = ctx.piles) == null ? void 0 : _z.ulsTension) ?? 0, dowel = pileHeadDowels({ T: T2, fy: m2.fy, fc: m2.fc, pileSize: num("pileSize"), capDepth: num("footT") * 1e3 - num("pileEmbed") - 75 });
    ctx.pileHead = pileHeadAnchorage({ T: T2, kind: pileShape69(w2) || pileKind((_A = doc.getElementById("pileType")) == null ? void 0 : _A.value), enteredTon: num("pileHeadT69"), source: (_C = (_B = doc.getElementById("pileHeadRef69")) == null ? void 0 : _B.value) == null ? void 0 : _C.trim(), dowel });
  }
  {
    const avail = g.s / Math.SQRT2 - g.D / 2, need = num("washerOD") / 2 + (num("weldA") || 0) + 20;
    if (finite(avail) && finite(need)) ctx.appendix.push({ id: "CLR", label: "ระยะแหวนบน–ผิวเสา ≥ แหวน/2 + ขาเชื่อม + 20 mm", dc: avail > 0 ? need / avail : Infinity, status: avail >= need - 1e-9 ? "pass" : "fail", value: avail });
  }
  const clear = typeof ((_D = w2.NCYAutoR13) == null ? void 0 : _D.pedClear67) === "function" ? w2.NCYAutoR13.pedClear67() : null;
  if (finite(clear)) ctx.appendix.push({ id: "R63", label: "ระยะหัวสลัก (น็อต/แหวนล่าง)–เหล็กตอม่อ ≥ 25 mm", dc: 25 / Math.max(clear, 1e-9), status: clear >= 25 - 1e-9 ? "pass" : "fail", value: clear });
  return ctx;
}
function bracketParts(w2, p2, g, m2, num) {
  var _a2, _b;
  const H2 = num("mountH"), Bm = num("mountB"), t2 = num("mountT"), L2 = num("headStandOff") / 1e3, a = num("weldA"), Fexx = m2.Fexx;
  if (![H2, Bm, t2, L2].every((x2) => x2 > 0)) return [{ label: "ขาแขวน", dc: null, missing: [{ key: "mount", label: "ขนาดขาแขวน (mountH/B/T, headStandOff)" }] }];
  const sec = rhsProps(H2, Bm, t2), dCap = { E: m2.E || 2e5, FyRHS38: m2.frameFy, FuRHS38: m2.frameFu, Krhs38: 2 };
  const cap = typeof w2.cap38 === "function" ? w2.cap38(sec, L2, "BRACKET", dCap) : null;
  const D2 = g.D, tw = g.tPole, Apole = Math.PI / 4 * (D2 ** 2 - (D2 - 2 * tw) ** 2), Spole = Math.PI / 32 * (D2 ** 4 - (D2 - 2 * tw) ** 4) / D2;
  let U2 = 0;
  for (const c of p2.cases || []) {
    const s = c.reaction || c.applied;
    if (Array.isArray(s)) U2 = Math.max(U2, Math.abs(s[1]) * 1e3 / (m2.Fy * Apole) + Math.hypot(s[3], s[5]) * 1e6 / (m2.Fy * Spole));
  }
  const limits = k2Limits({ D: D2, t: tw, Bp: Bm, Fy: m2.Fy, Fu: m2.Fu });
  const arm = [], weld = [], wall = [];
  for (const c of p2.cases || []) for (const cn of c.connections || []) {
    const [Fx, Fy, Fz, Mx, My, Mz] = cn.actionFromPole || [];
    if (![Fx, Fy, Fz, Mx, My, Mz].every(finite)) continue;
    const Mv = Math.abs(Mz) + Math.abs(Fy) * L2, Mh2 = Math.abs(My) + Math.abs(Fz) * L2;
    if ((cap == null ? void 0 : cap.complete) && typeof w2.interaction38 === "function") {
      const it = w2.interaction38({ N: -Math.abs(Fx), My: Mh2, Mz: Mv, Vy: Fy, Vz: Fz, T: Mx }, cap, sec);
      arm.push({
        dc: it.dc,
        caseId: c.id,
        at: cn.slave,
        note: `RHS ${H2}×${Bm}×${t2} ยื่น L = ${nf$1(L2, 3)} m: N = ${nf$1(Math.abs(Fx), 2)} kN · Mv = |Mz| + |Vy|·L = ${nf$1(Mv, 2)} kN·m · Mh = |My| + |Vz|·L = ${nf$1(Mh2, 2)} kN·m · Vy = ${nf$1(Fy, 2)}, Vz = ${nf$1(Fz, 2)} kN · T = ${nf$1(Mx, 2)} kN·m → H1-1 (โมเดลรวมแรงชุดเดียวกับเล่มรายละเอียด)`
      });
    }
    const wl = rectangularWeldLine({ N: Fx, Vv: Fy, Vh: Fz, Mv, Mh: Mh2, T: Mx, d: H2, b: Bm });
    const fw = wl && a > 0 && Fexx > 0 ? filletWeld({ q: wl.q, a, Fexx, tThin: Math.min(t2, tw) }) : null;
    weld.push({
      dc: (fw == null ? void 0 : fw.dc) ?? null,
      caseId: c.id,
      at: cn.slave,
      minOK: fw == null ? void 0 : fw.minOK,
      aMin: fw == null ? void 0 : fw.aMin,
      aReq: wl ? requiredFilletLeg({ q: wl.q, Fexx, tThin: Math.min(t2, tw) }) : null,
      note: wl && fw ? `เส้นเชื่อมรอบ ${H2}×${Bm} mm (ยืดหยุ่น): f_n = ${nf$1(wl.fn, 0)}, f_v = ${nf$1(wl.fv, 0)} N/mm → q = √(f_n² + f_v²) = ${nf$1(wl.q, 0)} N/mm · φR = 0.75·0.6·${nf$1(Fexx, 0)}·0.707·${a} = ${nf$1(fw.phiRn, 0)} N/mm` : ""
    });
    const Pf2 = Mv / ((H2 - t2) / 1e3) + Math.abs(Fx) / 2, Pw = Mh2 / ((Bm - t2) / 1e3) + Math.abs(Fx) / 2;
    const tr = chsTransversePlate({ P: Pf2, Bp: Bm, D: D2, t: tw, Fy: m2.Fy, U: U2 }), lo = chsLongitudinalPlate({ P: Pw, lb: H2, D: D2, t: tw, Fy: m2.Fy, U: U2 });
    wall.push({
      dc: Math.max((tr == null ? void 0 : tr.dc) ?? Infinity, (lo == null ? void 0 : lo.dc) ?? 0),
      caseId: c.id,
      at: cn.slave,
      note: `ขวาง: P = Mv/(H − t) + |N|/2 = ${nf$1(Pf2, 2)} kN, φRn = 0.9·Fy·t²·5.5/(1 − 0.81·B/D)·Qf = ${nf$1(tr == null ? void 0 : tr.phiRn, 2)} kN · ตามยาว: P = Mh/(B − t) + |N|/2 = ${nf$1(Pw, 2)} kN, φRn = 0.9·5.5·Fy·t²·(1 + 0.25·H/D)·Qf = ${nf$1(lo == null ? void 0 : lo.phiRn, 2)} kN (U = ${nf$1(U2, 2)}, Qf = ${nf$1(tr == null ? void 0 : tr.Qf, 2)})`
    });
  }
  const gw = maxBy(weld, (x2) => x2.dc);
  return [
    { label: "ขาแขวน RHS (H1)", ...((_a2 = maxBy(arm, (x2) => x2.dc)) == null ? void 0 : _a2.x) || { dc: null }, missing: (cap == null ? void 0 : cap.complete) ? [] : [{ key: "frameFy", label: "Fy/Fu เหล็กขาแขวน" }] },
    {
      label: "รอยเชื่อมรอบขาแขวน",
      ...(gw == null ? void 0 : gw.x) || { dc: null },
      aReq: Math.max(0, ...weld.map((x2) => x2.aReq || 0)) || null,
      missing: a > 0 ? [] : [{ key: "weldA", label: "ขาเชื่อม (mm)" }],
      unsupported: (gw == null ? void 0 : gw.x) && gw.x.minOK === false ? `ขาเชื่อม ${a} mm < ขั้นต่ำ ${gw.x.aMin} mm` : null
    },
    { label: "ผนังท่อเสา (§K2)", ...((_b = maxBy(wall, (x2) => x2.dc)) == null ? void 0 : _b.x) || { dc: null }, unsupported: limits.length ? "นอกขอบเขต K2: " + limits.join(", ") : null }
  ];
}
function collectType2(w2, R72 = w2.R7, kernel = w2.CP005Kernel) {
  var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _A, _B, _C, _D, _E, _F, _G, _H, _I, _J, _K, _L, _M, _N, _O, _P, _Q, _R;
  const R2 = R72 == null ? void 0 : R72.result, g = R72 == null ? void 0 : R72.geometry, d = (R72 == null ? void 0 : R72.inputs) || {};
  if (!(R72 == null ? void 0 : R72.active) || !(R2 == null ? void 0 : R2.strength38) || !g) return null;
  const n2 = (v2) => v2 === "" || v2 === null || v2 === void 0 ? NaN : Number(v2);
  const m2 = {
    plateFy: n2(d.basePlateFy40),
    anchorFu: n2(d.anchorFu39),
    fc: n2(d.baseFc40) || n2(d.rcFc46),
    fy: n2(d.rcFy46),
    Fy: n2(d.FyCHS38),
    Fu: n2(d.FuCHS38),
    frameFy: n2(d.FyRHS38),
    frameFu: n2(d.FuRHS38),
    Fexx: n2(d.Fexx38) > 0 ? n2(d.Fexx38) : 430,
    E: n2(d.E) || 2e5
  };
  const geom = { D: g.D, tPole: g.t, B: g.bpB, tp: g.bpT, s: g.boltSpacing, da: g.boltD, pedB: g.pedB, pedH: g.pedH };
  const members = R2.strength38.members.map((x2) => {
    var _a3, _b2, _c2, _d2;
    return {
      id: x2.id,
      pole: x2.group === "C1",
      dc: ((_a3 = x2.gov) == null ? void 0 : _a3.dc) ?? null,
      caseId: (_b2 = x2.gov) == null ? void 0 : _b2.caseId,
      unsupported: ((_c2 = x2.gov) == null ? void 0 : _c2.dc) == null ? (x2.label || x2.id) + ": หน้าตัดไม่รองรับ (" + ((((_d2 = x2.cap) == null ? void 0 : _d2.issues) || []).join(" / ") || x2.status) + ")" : null
    };
  });
  const de2 = ((_b = (_a2 = R2.serviceEnvelope34) == null ? void 0 : _a2.response) == null ? void 0 : _b.deltaMax) ?? ((_d = (_c = R2.serviceEnvelope34) == null ? void 0 : _c.deflection) == null ? void 0 : _d.value) ?? ((_f = (_e = R2.envelope) == null ? void 0 : _e.deflection) == null ? void 0 : _f.value), lim = g.total * 1e3 / n2(d.limit);
  const anchorRows = (((_g = R2.anchor39) == null ? void 0 : _g.rows) || []).map((x2) => ({ caseId: x2.caseId, T: x2.T, Fh: x2.Fh || 0, Ty: x2.Ty || 0, Ndown: x2.Ndown, Mx: x2.Mx, Mz: x2.Mz }));
  const ac2 = R2.anchorConcrete41, st = R2.shearTransfer42;
  const s = geom.s, hefT2 = n2((ac2 == null ? void 0 : ac2.hef) ?? d.anchorHef41), shG = maxBy(anchorRows, (x2) => x2.Fh + Math.abs(x2.Ty) * 1e3 / s), Vrow = shG ? shG.v : 0, ca1 = geom.pedB / 2 - s / 2;
  const shear = shearBreakout({ V: Vrow, ca1, ca2: ca1, rowWidth: s, pedB: geom.pedB, ha: geom.pedH, hef: hefT2, da: geom.da, fc: m2.fc });
  const tiesAll = shearTieReinforcement({ V: Vrow, pedB: geom.pedB, pitch: s, cover: ((_i = (_h = R2.pedestal47) == null ? void 0 : _h.chosen) == null ? void 0 : _i.cover) || n2(d.pedCover47) || 40, fy: m2.fy });
  const ties = tiesAll && tiesAll.count && (!shear || tiesAll.phiVs > shear.phiVcbg) ? tiesAll : null;
  const Ab2 = Math.PI * geom.da ** 2 / 4;
  0.75 * 0.75 * m2.anchorFu * Ab2 / 1e3;
  0.75 * 0.45 * m2.anchorFu * Ab2 / 1e3;
  const worstT = maxBy(anchorRows, (x2) => x2.T.reduce((a, b) => a + Math.max(0, b), 0)), NuaG = worstT ? worstT.v : 0;
  worstT ? worstT.x.T.filter((x2) => x2 > 0).length || 2 : 2;
  const breakoutDesign = ((_j = ac2 == null ? void 0 : ac2.gov) == null ? void 0 : _j.design) ?? (((_k = ac2 == null ? void 0 : ac2.gov) == null ? void 0 : _k.dc) > 0 ? ac2.gov.demand / ac2.gov.dc : null), pc2 = (_l = R2.pedestal47) == null ? void 0 : _l.chosen;
  const reinf = (pc2 == null ? void 0 : pc2.pos) && worstT && Array.isArray(g.anchors) ? anchorReinforcement({ anchors: g.anchors.map((a, i) => ({ x: a.x, z: a.z, T: Math.max(0, worstT.x.T[i] || 0) })), bars: pc2.pos.map((b, i) => ({ id: "V" + (i + 1), x: b.x, z: b.z, db: pc2.db })), hef: hefT2, cTop: (pc2.cover || 40) + 3 * pc2.db, fy: m2.fy, fc: m2.fc, hooked: true, belowCrack: geom.pedH - hefT2 + Number(g.footT) - 75 }) : null;
  const concreteN = reinf && reinf.dc <= 1 ? Math.max(reinf.phiNs, breakoutDesign ?? 0) : breakoutDesign;
  const sAci = anchorSteelACI({ da: geom.da, futa: m2.anchorFu }), share2 = ((_m = w2.document.getElementById("r69WeldedWasher")) == null ? void 0 : _m.checked) ? 4 : 2, Tmax2 = worstT ? Math.max(...worstT.x.T) : 0;
  const sf2 = ac2 == null ? void 0 : ac2.sideFace48, sfDesign = sideFaceDesign48(sf2, Tmax2);
  const phiNn = Math.min((sAci == null ? void 0 : sAci.phiNsa) ?? Infinity, ((_n = ac2 == null ? void 0 : ac2.pullout) == null ? void 0 : _n.design) ?? Infinity, sfDesign, concreteN && NuaG > 0 ? concreteN * Tmax2 / NuaG : Infinity);
  const phiVn = Math.min((sAci == null ? void 0 : sAci.phiVsa) ?? Infinity, (ties ? ties.phiVs : (shear == null ? void 0 : shear.phiVcbg) ?? Infinity) / share2, ((st == null ? void 0 : st.phiVcpg) ?? Infinity) / share2);
  const inter = tensionShearInteraction({ N: Tmax2, phiNn, V: Vrow / share2, phiVn });
  const conc = [
    ((_o = ac2 == null ? void 0 : ac2.gov) == null ? void 0 : _o.dc) > 1 && reinf && reinf.dc <= 1 ? { label: "เหล็กเสริมรับแรงยึด (17.4.2.9)", dc: reinf.dc, caseId: worstT == null ? void 0 : worstT.x.caseId } : { label: "breakout (17.4.2)", dc: ((_p = ac2 == null ? void 0 : ac2.gov) == null ? void 0 : _p.dc) ?? null, caseId: (_q = ac2 == null ? void 0 : ac2.gov) == null ? void 0 : _q.caseId },
    { label: "pullout (17.4.3)", dc: ((_r = ac2 == null ? void 0 : ac2.pullout) == null ? void 0 : _r.dc) ?? null, caseId: (_t = (_s = ac2 == null ? void 0 : ac2.pullout) == null ? void 0 : _s.gov) == null ? void 0 : _t.caseId },
    (ac2 == null ? void 0 : ac2.sideFace48) && ac2.sideFace48.applicable !== false && ac2.sideFace48.status !== "N/A" ? { label: "side-face (17.4.4)", dc: ac2.sideFace48.maxDC ?? ((_u = ac2.sideFace48.gov) == null ? void 0 : _u.dc) ?? null } : null,
    ties ? { label: `ปลอกเสริมรับแรงเฉือนหัวตอม่อ ${ties.count}-DB${ties.db} (17.5.2.9)`, dc: ties.dc, caseId: shG == null ? void 0 : shG.x.caseId } : { label: "คอนกรีตรับแรงเฉือน (17.5.2)", dc: (shear == null ? void 0 : shear.dc) ?? null, caseId: shG == null ? void 0 : shG.x.caseId },
    { label: "pry-out (17.5.3)", dc: ((_v = st == null ? void 0 : st.govP) == null ? void 0 : _v.dcP) ?? null, caseId: (_w = st == null ? void 0 : st.govP) == null ? void 0 : _w.caseId },
    { label: "แรงร่วม (17.6)", dc: (inter == null ? void 0 : inter.dc) ?? null, caseId: shG == null ? void 0 : shG.x.caseId }
  ].filter(Boolean);
  const weldRows = [], kern = kernel;
  for (const x2 of anchorRows) {
    const action = [x2.Fh, -x2.Ndown, 0, x2.Mx, x2.Ty, x2.Mz];
    if ((kern == null ? void 0 : kern.circleWeld) && action.every(Number.isFinite)) {
      const r2 = kern.circleWeld(action, g.D / 2);
      const x22 = r2;
      weldRows.push({ caseId: x2.caseId, q: r2.upperBound_N_per_mm, qn: Math.abs(((_y = (_x = x22.peak) == null ? void 0 : _x.q_N_per_mm) == null ? void 0 : _y[1]) ?? r2.upperBound_N_per_mm), qv: Math.hypot(((_A = (_z = x22.peak) == null ? void 0 : _z.q_N_per_mm) == null ? void 0 : _A[0]) ?? 0, ((_C = (_B = x22.peak) == null ? void 0 : _B.q_N_per_mm) == null ? void 0 : _C[2]) ?? 0) });
    }
  }
  const W2 = ((_D = R2.weld38) == null ? void 0 : _D.rows) || [], w1 = W2.find((x2) => x2.id === "W1");
  const head = [{ label: "W1 ท่อ–CP1", dc: ((_E = w1 == null ? void 0 : w1.gov) == null ? void 0 : _E.dc) ?? null, caseId: (_F = w1 == null ? void 0 : w1.gov) == null ? void 0 : _F.caseId, unsupported: w1 && w1.minOK === false ? "ขาเชื่อม W1 ต่ำกว่าขั้นต่ำ" : null }];
  const j = g.joint32, wg2 = w2.weldGroup38;
  if (j && typeof wg2 === "function") {
    let gov = null;
    for (const c of Object.values(R2.cases || {}).filter((c2) => c2.class34 === "ULS")) {
      const q2 = wg2(j.welds.filter((x2) => x2.id === "W2"), c.joint, n2(d.weldRhs32), m2.Fexx, g.lower * 1e3);
      if ((q2 == null ? void 0 : q2.complete) && (!gov || q2.dc > gov.dc)) gov = { ...q2, caseId: c.caseId };
    }
    head.push({ label: "W2 RHS–CP1 (ไม่นับครีบ)", dc: (gov == null ? void 0 : gov.dc) ?? null, caseId: gov == null ? void 0 : gov.caseId, missing: n2(d.weldRhs32) > 0 ? [] : [{ key: "weldRhs32", label: "ขาเชื่อม W2" }] });
  }
  const p8c = [];
  if (j && g.rhsB > 0 && j.capT > 0) {
    const ell = g.D / 2 - g.t - g.rhsB / 2, Fyc = m2.plateFy * fyThicknessFactor(j.capT), phiMn = 0.9 * Fyc * j.capT ** 2 / 4;
    let plate = null, wall = null;
    for (const c of Object.values(R2.cases || {}).filter((c2) => c2.class34 === "ULS")) {
      const a = c.joint || {}, M2 = Math.hypot(a.Mx || 0, a.Mz || 0), N2 = Math.abs(a.Fy || 0), V2 = Math.hypot(a.Fx || 0, a.Fz || 0);
      const F2 = M2 * 1e3 / (g.rhsH - g.rhsT) + N2 / 4, mt = F2 * 1e3 * ell / g.rhsB, dc2 = ell > 0 ? mt / phiMn : 0;
      if (!plate || dc2 > plate.dc) plate = { dc: dc2, caseId: c.caseId, F: F2, ell, mt, phiMn, M: M2, N: N2 };
      const qn = N2 * 1e3 / (Math.PI * g.D) + M2 * 1e6 / (Math.PI * g.D * g.D / 4), qv = V2 * 1e3 / (Math.PI * g.D / 2), wb2 = weldBaseMetal({ qn, qv, t: g.t, Fy: m2.Fy, Fu: m2.Fu });
      if (wb2 && (!wall || wb2.dc > wall.dc)) wall = {
        dc: wb2.dc,
        caseId: c.caseId,
        note: `q_n = N/(πD) + M/(πD²/4) = ${nf$1(qn, 0)} N/mm · q_v = V/(πD/2) = ${nf$1(qv, 0)} N/mm · φT_n = min(0.9Fy·t, 0.75Fu·t) = ${nf$1(wb2.phiTn, 0)} · φV_n = min(0.6Fy·t, 0.75·0.6Fu·t) = ${nf$1(wb2.phiVn, 0)} N/mm`
      };
    }
    const rib = (j.ribs || [])[0], legRib = n2(d.weldRib32);
    if ((j.ribs || []).length >= 4 && (rib == null ? void 0 : rib.thickness) > 0 && (rib == null ? void 0 : rib.height) > 0 && (rib == null ? void 0 : rib.width) > 0) {
      const F2 = plate ? plate.F : 0, h = rib.height, wR = rib.width, tr = rib.thickness, e = (g.D - g.t) / 2 - g.rhsB / 2, Fyr = m2.plateFy * fyThicknessFactor(tr);
      const notch = Number(d.ribNotch32) || 0, hw = h - notch, ww = wR - notch, reach = e + g.t / 2;
      const lam = wR * h / (tr * tr), My = Fyr * tr * h * h / 6, Mp = Math.min(Fyr * tr * h * h / 4, 1.6 * My), MnF11 = lam <= 0.08 * m2.E / Fyr ? Mp : Math.min(Mp, (1.52 - 0.274 * lam * Fyr / m2.E) * My);
      const ribGeomBad = wR < reach - 1e-9 ? `ครีบกว้าง ${wR} mm ไม่ถึงผนังท่อ (ต้อง ≥ ${Math.ceil(reach)} mm)` : h / wR > 2 + 1e-9 || h / wR < 0.5 - 1e-9 ? `สัดส่วนครีบ h/w = ${(h / wR).toFixed(2)} นอกช่วง 0.5–2` : lam > 1.9 * m2.E / Fyr ? "ครีบชะลูดเกิน F11 (Lb·d/t² > 1.9E/Fy)" : null;
      const qa2 = F2 * 1e3 / (2 * hw) * Math.sqrt(1 + (6 * Math.max(0, e) / hw) ** 2), wa2 = legRib > 0 ? filletWeld({ q: qa2, a: legRib, Fexx: m2.Fexx, tThin: Math.min(tr, g.rhsT) }) : null;
      const vR = F2 / (1 * 0.6 * Fyr * tr * h / 1e3), mR = F2 * Math.max(0, e) / (0.9 * MnF11 / 1e3), btLim = 0.56 * Math.sqrt(m2.E / Fyr);
      const qc2 = F2 * 1e3 / (2 * ww), wc2 = legRib > 0 ? filletWeld({ q: qc2, a: legRib, Fexx: m2.Fexx, tThin: Math.min(tr, j.capT) }) : null;
      const RnWall = m2.Fy * g.t * (5 * j.capT + tr) / 1e3, wallK1 = F2 / RnWall;
      const legMiss = legRib > 0 ? [] : [{ key: "weldRib32", label: "ขาเชื่อมครีบ" }];
      const Fnote = plate ? `F = M/(H − t) + N/4 = ${nf$1(plate.M, 2)}/${nf$1((g.rhsH - g.rhsT) / 1e3, 3)} + ${nf$1(plate.N, 2)}/4 = ${nf$1(F2, 2)} kN ต่อด้าน RHS · ` : "";
      p8c.push(
        {
          label: `รอยเชื่อมครีบ–RHS 2×${h} mm เยื้อง e = ${e.toFixed(0)} mm (ขา ${legRib || "—"})`,
          dc: (wa2 == null ? void 0 : wa2.dc) ?? null,
          caseId: plate == null ? void 0 : plate.caseId,
          missing: legMiss,
          aReq: requiredFilletLeg({ q: qa2, Fexx: m2.Fexx, tThin: Math.min(tr, g.rhsT) }),
          note: `${Fnote}q = F/(2(h − notch))·√(1 + (6e/(h − notch))²) = ${nf$1(qa2, 0)} N/mm · φR = 0.75·0.6·${nf$1(m2.Fexx, 0)}·0.707·${legRib || "—"} = ${nf$1(wa2 == null ? void 0 : wa2.phiRn, 0)} N/mm`,
          unsupported: wa2 && !wa2.minOK ? `ขาเชื่อมครีบ < ขั้นต่ำ ${wa2.aMin} mm` : null
        },
        {
          label: `ครีบ ST ${tr}×${wR}×${h} mm (เฉือน/ดัด, b/t ≤ ${btLim.toFixed(1)})`,
          dc: Math.max(vR, mR),
          caseId: plate == null ? void 0 : plate.caseId,
          note: `Fy ครีบ = ${nf$1(Fyr, 0)} MPa · V/φVn = F/(1.0·0.6·Fy·t·h) = ${nf$1(vR, 3)} · M/φMn = F·e/(0.9·Mn), Mn = F11 (Lb = w: Lb·d/t² = ${nf$1(lam, 0)}) = ${nf$1(MnF11 / 1e6, 2)} kN·m → ${nf$1(mR, 3)}`,
          unsupported: ribGeomBad || (wR / tr > btLim ? `ครีบ b/t = ${(wR / tr).toFixed(1)} > ${btLim.toFixed(1)}` : null)
        },
        {
          label: `รอยเชื่อมครีบ–CP1 2×${wR} mm`,
          dc: (wc2 == null ? void 0 : wc2.dc) ?? null,
          caseId: plate == null ? void 0 : plate.caseId,
          missing: legMiss,
          aReq: requiredFilletLeg({ q: qc2, Fexx: m2.Fexx, tThin: Math.min(tr, j.capT) }),
          note: `q = F/(2(w − notch)) = ${nf$1(qc2, 0)} N/mm · φR = ${nf$1(wc2 == null ? void 0 : wc2.phiRn, 0)} N/mm`
        },
        {
          label: `ผนังท่อใต้ CP1 หนา ${j.capT} mm (AISC K1: Fy·t·(5tp + lb))`,
          dc: wallK1,
          caseId: plate == null ? void 0 : plate.caseId,
          note: `R_n = Fy·t·(5t_p + l_b) = ${nf$1(m2.Fy, 0)}·${g.t}·(5·${j.capT} + ${tr})/1000 = ${nf$1(RnWall, 1)} kN, φ = 1.0 · F/R_n = ${nf$1(wallK1, 3)}`
        },
        { label: "ผนังท่อใต้ CP1 รอบวง (J4)", ...wall || { dc: null } }
      );
    } else p8c.push({
      label: `CP1 หนา ${j.capT} mm (แถบยื่น ℓ = ${ell.toFixed(0)} mm, ไม่มีครีบ)`,
      ...plate || { dc: null },
      note: plate ? `F = M/(H − t) + N/4 = ${nf$1(plate.F, 2)} kN · m_t = F·ℓ/b = ${nf$1(plate.mt, 0)} N·mm/mm · φm_n = 0.9·${nf$1(Fyc, 0)}·t²/4 = ${nf$1(phiMn, 0)} N·mm/mm` : ""
    }, { label: "ผนังท่อใต้ CP1 (J4)", ...wall || { dc: null } });
  } else p8c.push({ label: "CP1", dc: null, missing: [{ key: "joint32", label: "เรขาคณิตหัวเสา CP1/RHS" }] });
  const ctx = {
    type: "TYPE2",
    source: { modelId: R2.modelId },
    wind: ((_G = R2.source34) == null ? void 0 : _G.strength) ? { V: R2.source34.strength.V, q: R2.source34.strength.q, p: R2.source34.strength.p, province: (_H = R2.source34.region) == null ? void 0 : _H.province } : null,
    geom,
    mat: m2,
    members,
    deflection: [{ id: "ยอดป้าย", dc: Number.isFinite(de2) && lim > 0 ? de2 / lim : null, caseId: (_J = (_I = R2.serviceEnvelope34) == null ? void 0 : _I.deflection) == null ? void 0 : _J.caseId }],
    bearing: ((_K = R2.baseContact40) == null ? void 0 : _K.bearingGov) ? { dc: R2.baseContact40.bearingGov.dcBearing, caseId: R2.baseContact40.bearingGov.caseId } : null,
    plateComp: ((_L = R2.baseContact40) == null ? void 0 : _L.plateGov) ? { dc: R2.baseContact40.plateGov.dcPlate, caseId: R2.baseContact40.plateGov.caseId } : null,
    anchorRows,
    anchorSteel: R2.anchor39 ? { dc: R2.anchor39.maxDC, caseId: (_M = R2.anchor39.worst) == null ? void 0 : _M.caseId } : null,
    welderWashers: !!((_N = w2.document.getElementById("r69WeldedWasher")) == null ? void 0 : _N.checked),
    concrete: null,
    p7: null,
    p7parts: conc,
    weldBase: { legKey: "weldBase69", a: n2(d.weldBase69) > 0 ? n2(d.weldBase69) : requiredFilletLeg({ q: Math.max(0, ...weldRows.map((x2) => x2.q)), Fexx: m2.Fexx, tThin: Math.min(g.t, g.bpT) }), auto: !(n2(d.weldBase69) > 0), Fexx: m2.Fexx, tThin: Math.min(g.t, g.bpT), tWall: g.t, FyWall: m2.Fy, FuWall: m2.Fu, rows: weldRows },
    p8b: head,
    p8c,
    materialSet: { ["f′c"]: m2.fc, ["fy เหล็กเสริม"]: m2.fy, ["Fy เสา"]: m2.Fy, ["Fu เสา"]: m2.Fu, ["Fy RHS"]: m2.frameFy, ["Fy เพลท"]: m2.plateFy, ["Fu สลัก"]: m2.anchorFu, ["Fexx"]: m2.Fexx },
    foundation: { spread: false, rows: [], unsupported: null },
    appendix: []
  };
  try {
    const mm = w2.NCYFoundationR9.metrics(R2, g, d);
    ctx.foundation.rows = (mm.rows || []).map((x2) => ({ label: x2.id, dc: x2.dc ?? null, caseId: x2.caseId }));
    const gate = mm.pileGate;
    if (gate) ctx.piles = { compDC: gate.compDC, tenDC: gate.tenDC, capOk: gate.capsOk !== false && Number.isFinite(gate.compDC), maxUpliftASD: ((_O = gate.maxUplift) == null ? void 0 : _O.ASD) ?? (gate.state === "NO_UPLIFT" ? 0 : 1), ulsTension: gate.ulsTension };
  } catch {
  }
  {
    const pc22 = (_P = R2.pedestal47) == null ? void 0 : _P.chosen, ac22 = typeof ((_Q = w2.NCYPedestal47) == null ? void 0 : _Q.anchorClear) === "function" && pc22 ? w2.NCYPedestal47.anchorClear(g, pc22) : null, AF = HEAVY_HEX_AF[g.boltD] || 1.7 * g.boltD;
    if (finite(ac22)) {
      const plate48 = Number(d.anchorHeadPlate48) > 0 ? Number(d.anchorHeadPlate48) / Math.SQRT2 : 0, clear2 = ac22 - Math.max(0, Math.max(AF / Math.sqrt(3), plate48) - g.boltD / 2);
      ctx.appendix.push({ id: "R63", label: Number(d.anchorHeadPlate48) > 0 ? "ระยะหัวสลัก (แผ่นรองปลายสลัก)–เหล็กตอม่อ ≥ 25 mm" : "ระยะหัวสลัก (น็อตล่าง)–เหล็กตอม่อ ≥ 25 mm", dc: 25 / Math.max(clear2, 1e-9), status: clear2 >= 25 - 1e-9 ? "pass" : "fail", value: clear2 });
    }
  }
  if (!ctx.foundation.rows.length) ctx.foundation.rows = [{ label: "ฐาน RC", dc: null }];
  {
    const T2 = ((_R = ctx.piles) == null ? void 0 : _R.ulsTension) ?? 0, dowel = pileHeadDowels({ T: T2, fy: m2.fy, fc: m2.fc, pileSize: Number(g.pileSize), capDepth: Number(g.footT) - Number(g.pileEmbed) - 75 });
    ctx.pileHead = pileHeadAnchorage({ T: T2, kind: pileShape69(w2) || "unknown", enteredTon: n2(d.pileHeadT69), source: String(d.pileHeadRef69 || "").trim(), dowel });
  }
  return ctx;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const f = (x2, d = 3) => x2 === Infinity ? "∞" : typeof x2 === "number" && Number.isFinite(x2) ? x2.toFixed(d) : "—";
const n0 = (x2) => f(x2, 0), n1 = (x2) => f(x2, 1);
function equation(row2) {
  var _a2;
  const c = row2.calc || {};
  switch (row2.id) {
    case "P1":
      return c.p ? `V = ${n1(c.V)} m/s · q = ${f(c.q)} kPa · p = Iw·q·Ce·Cg·Cp = ${f(c.p)} kPa${c.province ? ` (${esc(c.province)})` : ""}` : "";
    case "P5b":
      return c.m ? `m = (B − 0.8D)/2 = ${n1(c.m)} mm · m_u = q·m²/2 = ${n0(c.mu)} N·mm/mm · φm_n = 0.9Fy·t²/4 = ${n0(c.phiMn)} N·mm/mm` : "";
    case "P5c":
      return c.ell ? `ℓ = s/√2 − D/2 = ${n1(c.ell)} mm · b = min(2ℓ, √2B − D) = ${n1(c.beff)} mm · m_t = T·ℓ/b = ${n0(c.mt)} N·mm/mm (T = ${n1(c.T)} kN) · φm_n = 0.9·${n1(c.Fy)}·t²/4 = ${n0(c.phiMn)} N·mm/mm` : "";
    case "P6b":
      return c.Ab ? `T = ${n1(c.T)} kN, V = ${n1(c.V)} kN, A_b = ${n0(c.Ab)} mm² · f_rv = ${n1(c.frv)} MPa · F′nt = 1.3Fnt − Fnt·f_rv/(φFnv) ≤ Fnt = ${n1(c.FntPrime)} MPa · D/C = max(T/(φF′nt·A_b), f_rv/(φFnv)) = max(${f(c.dcT)}, ${f(c.dcV)})` : "";
    case "P7":
      return c.hef ? `h_ef = ${n0(c.hef)} mm${c.Abrg ? ` · A_brg = ${n0(c.Abrg)} mm² (${c.washer ? `แหวนแผ่นหนา Ø${c.washer.OD}×${c.washer.t} mm เหนือน็อตล่าง (ระหว่างน็อตกับคอนกรีต): π/4·(OD² − d²)` : "น็อตหกเหลี่ยมหนา"})` : ""}` : "";
    case "P8a":
      return c.q != null ? `q = ${n0(c.q)} N/mm (วงรอบเสา, ทุกกรณี ULS) · ขาเชื่อม a = ${n0(c.a)} mm${c.auto ? " (ระบบเลือก)" : ""} (ต้องการ ≥ ${n0(c.aReq)} mm) · φR = 0.75·0.6·Fexx·0.707a = ${n0((_a2 = c.weld) == null ? void 0 : _a2.phiRn)} N/mm, Fexx = ${n0(c.Fexx)} MPa` : "";
    case "P9b":
      return c.maxUpliftASD > 1e-6 ? `แรงถอนสูงสุด (0.6D+W) = ${n1(c.maxUpliftASD)} kN/ต้น` : "ไม่มีแรงถอนใต้แรงใช้งาน (D+W, 0.6D+W)";
    case "P9c":
      return c.T > 1e-6 ? `T_ULS = ${n1(c.T)} kN/ต้น${c.n ? ` · φN = min(φNa bond, φ0.75·As·fy) = ${n1(c.phiN)} kN` : ""}` : "ไม่มีแรงดึง ULS ที่หัวเข็ม";
    case "P11":
      return Object.entries(c).map(([k, v2]) => `${esc(k)} = ${typeof v2 === "number" ? n1(v2) : esc(v2)}`).join(" · ");
    default:
      return "";
  }
}
const statusClass = (s) => s === "pass" ? "ok" : s === "fail" ? "ng" : "md";
function rowHtml(row2) {
  const parts = (row2.parts || []).filter((p2) => p2 && (p2.label || p2.dc !== void 0));
  const eq = equation(row2), miss = (row2.missing || []).map((m2) => m2.label).join(", ");
  return `<section class="row ${row2.excluded ? "ex" : statusClass(row2.status)}"><header><b>${esc(row2.id)}</b> ${esc(row2.title)}<span class="st">${esc(row2.statusText)}${row2.info ? "" : ` · D/C ${f(row2.dc)}`}</span></header>
<p class="ref">${esc(row2.ref)}${row2.caseId ? ` · กรณีวิกฤต ${esc(row2.caseId)}` : ""}</p>${eq ? `<p class="eq">${eq}</p>` : ""}
${parts.length ? `<table><tbody>${parts.map((p2) => `<tr><td>${esc(p2.label || "")}${p2.note ? `<br><small>${esc(p2.note)}</small>` : ""}</td><td class="n">${f(p2.dc)}</td><td>${esc(p2.caseId || "")}</td><td>${esc(p2.unsupported || (p2.missing || []).map((m2) => m2.label).join(", "))}</td></tr>`).join("")}</tbody></table>` : ""}
${row2.unsupported ? `<p class="warn">ไม่รองรับ: ${esc(row2.unsupported)}</p>` : ""}${miss ? `<p class="warn">ขาดข้อมูล: ${esc(miss)}</p>` : ""}</section>`;
}
function buildPermitReport(check, meta = {}) {
  var _a2, _b, _c, _d, _e;
  if (!((_a2 = check == null ? void 0 : check.rows) == null ? void 0 : _a2.length)) throw new Error("ยังไม่มีรายการตรวจจากผลคำนวณปัจจุบัน");
  const pass = check.verdict === "pass", date = meta.date || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const typeText = check.type === "TYPE2" ? "ป้ายเสาเดี่ยวหัว RHS (แบบที่ 2)" : "ป้ายสองหน้าบนเสาท่อกลม (แบบที่ 1)";
  const head = pass ? `<div class="badge ok">${esc(BADGE_PASS)}</div>` : `<div class="badge draft">ร่าง — ยังมีรายการไม่ผ่าน ${check.counts.fail} / ขาดข้อมูล ${check.counts.missing}${((_b = check.appendixNG) == null ? void 0 : _b.length) ? ` / ภาคผนวกไม่ผ่าน ${check.appendixNG.length}` : ""} · ยังใช้ยื่นขออนุญาตไม่ได้</div>`;
  const summary = `<table class="sum"><thead><tr><th>#</th><th>รายการ</th><th>D/C</th><th>สถานะ</th></tr></thead><tbody>${check.rows.map((r2) => `<tr class="${r2.excluded ? "ex" : statusClass(r2.status)}"><td>${esc(r2.id)}</td><td>${esc(r2.title)}</td><td class="n">${r2.info ? "—" : f(r2.dc)}</td><td>${esc(r2.statusText)}</td></tr>`).join("")}</tbody></table>`;
  const pages = [
    `<div class="page${pass ? "" : " wm"}"><h1>รายการคำนวณประกอบการขออนุญาตก่อสร้างป้าย</h1><p class="sub">${esc(typeText)} · NCY SIGN BB-01</p>${head}
<table class="meta"><tbody><tr><td>โครงการ</td><td>${esc(meta.project)}</td></tr><tr><td>สถานที่</td><td>${esc(meta.site)}</td></tr><tr><td>เจ้าของ</td><td>${esc(meta.owner)}</td></tr><tr><td>วันที่คำนวณ</td><td>${esc(date)}</td></tr><tr><td>ชุดผลคำนวณ</td><td>${esc(((_c = check.source) == null ? void 0 : _c.modelId) || "")}</td></tr></tbody></table>
<h2>สรุปรายการตรวจ</h2>${summary}
<h2>มาตรฐานที่ใช้</h2><p>มยผ.1311-50 (แรงลม) · AISC 360-16 (เหล็ก) · AISC Design Guide 1 (เพลทฐาน) · ACI 318M-14 (คอนกรีต สลักยึด บทที่ 17) · กรณีแรง ULS / ASD / SLS ตามเล่มรายละเอียด</p></div>`,
    `<div class="page${pass ? "" : " wm"}"><h2>ผลตรวจรายข้อ</h2>${check.rows.map(rowHtml).join("")}</div>`,
    `<div class="page${pass ? "" : " wm"}"><h2>ขอบเขตและข้อยกเว้น</h2><ul>${check.exclusions.map((x2) => `<li>${esc(x2)}</li>`).join("")}</ul>
${((_d = check.appendix) == null ? void 0 : _d.length) ? `<h2>ภาคผนวก — รายการประกอบที่กันผลรวม</h2><table><tbody>${check.appendix.map((a) => `<tr class="${statusClass(a.status)}"><td>${esc(a.label)}</td><td class="n">${f(a.value ?? a.dc, 1)}</td><td>${esc(STATUS_TEXT[a.status] || a.status)}</td></tr>`).join("")}</tbody></table>` : ""}
<p>รายละเอียดการวิเคราะห์ แรงทุกกรณี สมการแทนค่า และแบบประกอบ อยู่ในเล่มรายละเอียด (ภาคผนวก ก) ซึ่งพิมพ์จากชุดผลคำนวณเดียวกัน (${esc(((_e = check.source) == null ? void 0 : _e.modelId) || "")})</p>
<h2>ผู้คำนวณ / ผู้ตรวจและลงนาม</h2><table class="sign"><tbody><tr><td>ชื่อ–สกุล</td><td></td></tr><tr><td>ระดับ / สาขาใบอนุญาต</td><td></td></tr><tr><td>เลขทะเบียน (กว.)</td><td></td></tr><tr><td>ลายมือชื่อ</td><td class="tall"></td></tr><tr><td>วันที่</td><td></td></tr></tbody></table>
<p class="note">เอกสารนี้สร้างจากโปรแกรมเพื่อประกอบการพิจารณา ไม่ใช่การรับรอง วิศวกรผู้มีใบอนุญาตต้องตรวจสอบและลงนาม</p></div>`
  ];
  const css = `@page{size:A4;margin:14mm}body{font-family:"Sarabun","Leelawadee UI","Tahoma",sans-serif;font-size:10.5pt;color:#111;margin:0}
.page{page-break-after:always;position:relative;padding:4mm 2mm}.page:last-child{page-break-after:auto}h1{font-size:16pt;margin:0 0 2mm}h2{font-size:12pt;margin:5mm 0 2mm;border-bottom:1px solid #999}
.sub{margin:0 0 3mm;color:#333}.badge{padding:2.5mm 3mm;border:1.5px solid;font-weight:600;margin:2mm 0}.badge.ok{border-color:#1b6e3a;color:#1b6e3a}.badge.draft{border-color:#a33;color:#a33}
table{border-collapse:collapse;width:100%;margin:1mm 0}td,th{border:1px solid #bbb;padding:1mm 1.5mm;vertical-align:top}th{background:#f1f3f5;text-align:left}.n{text-align:right;font-variant-numeric:tabular-nums}
tr.ng td,section.ng header .st{color:#a11}tr.md td,section.md header .st{color:#8a5a00}section.row{break-inside:avoid;border:1px solid #ccc;margin:2mm 0;padding:1.5mm 2mm}section.row header{font-size:11pt}
.st{float:right}.ref{margin:.5mm 0;color:#444;font-size:9.5pt}.eq{margin:.5mm 0;font-size:9.5pt}.warn{color:#a11;margin:.5mm 0}.sign td.tall{height:18mm}.note{font-size:9pt;color:#444}
.wm::before{content:"ร่าง";position:absolute;top:35%;left:20%;font-size:120pt;color:rgba(170,30,30,.08);transform:rotate(-25deg);pointer-events:none}`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายการคำนวณประกอบการขออนุญาต · ${esc(meta.project || "NCY SIGN")}</title><style>${css}</style></head><body>${pages.join("")}</body></html>`;
}
if (typeof window !== "undefined" && !window.NCYPermitR69) {
  const R7ref = () => typeof R7 !== "undefined" ? R7 : window.R7;
  const kernel = () => typeof CP005Kernel !== "undefined" ? CP005Kernel : window.CP005Kernel;
  const collect = () => {
    var _a2;
    return ((_a2 = R7ref()) == null ? void 0 : _a2.active) ? collectType2(window, R7ref(), kernel()) : collectType1(window);
  };
  window.NCYPermitR69 = Object.freeze({
    version: "R69",
    checks,
    STATUS_TEXT,
    BADGE_PASS,
    EXCLUSIONS,
    collect,
    checklist() {
      try {
        return buildChecklist(collect());
      } catch (error) {
        return { error: String((error == null ? void 0 : error.message) || error), rows: [], verdict: "missing" };
      }
    },
    /* R69: details the drawings must show (the checklist counts them) — pile-head dowel and the base-weld leg */
    details() {
      var _a2, _b, _c;
      const c = this.checklist(), row2 = (id2) => {
        var _a3;
        return (_a3 = c == null ? void 0 : c.rows) == null ? void 0 : _a3.find((r2) => r2.id === id2);
      };
      const p9 = (_a2 = row2("P9c")) == null ? void 0 : _a2.calc, wb2 = (_b = row2("P8a")) == null ? void 0 : _b.calc;
      return {
        type: (c == null ? void 0 : c.type) || null,
        pileDowel: p9 && p9.n > 0 ? { n: p9.n, db: p9.db, hef: p9.hef, ld: Math.ceil(p9.ld / 10) * 10, position: "pile axis", bond: "epoxy ACI 17.4.5" } : null,
        baseWeld: wb2 && wb2.a > 0 ? { a: wb2.a, Fexx: wb2.Fexx, auto: !!wb2.auto } : null,
        /* R69b: no dowel but pile-head tension → the drawings note the pile-head detail the checklist excludes or takes from the manufacturer */
        pileHead: p9 && p9.T > 1e-6 && !(p9.n > 0) && (p9.excluded || p9.entered) ? { T: p9.T, excluded: !!p9.excluded, entered: !!p9.entered, enteredTon: p9.enteredTon ?? null, source: p9.source || "", status: ((_c = row2("P9c")) == null ? void 0 : _c.status) || null } : null,
        pileTension: Number.isFinite(p9 == null ? void 0 : p9.T) ? p9.T : null
      };
    },
    meta() {
      const v2 = (id2) => {
        var _a2, _b;
        return ((_b = (_a2 = document.getElementById(id2)) == null ? void 0 : _a2.value) == null ? void 0 : _b.trim()) || "";
      };
      return { project: v2("cp025_r_project") || v2("projectName"), site: v2("cp025_r_site") || v2("projectLocation"), owner: v2("cp025_r_owner") || v2("ownerName") };
    },
    report(meta) {
      return buildPermitReport(this.checklist(), meta || this.meta());
    },
    print(meta) {
      const html = this.report(meta), w2 = window.open("", "_blank");
      if (!w2) throw new Error("เบราว์เซอร์บล็อกหน้าต่างพิมพ์");
      w2.document.open();
      w2.document.write(html);
      w2.document.close();
      w2.focus();
      setTimeout(() => w2.print(), 400);
      return true;
    }
  });
  const syncSchedule69 = () => {
    try {
      if (typeof R7 !== "undefined" && R7.active) return;
      const g = typeof APP !== "undefined" ? APP.geometry : null, PD = window.NCYPermitDrawR69;
      if (!(g == null ? void 0 : g.schedule) || !PD) return;
      g.schedule = g.schedule.filter((r2) => !["PD1", "PH1"].includes(r2.code));
      const dw = PD.pileDowel(), ph2 = dw ? null : PD.pileHead(), n2 = (g.piles || []).length;
      if (dw) {
        const sc2 = PD.dowelSchedule(dw, g.piles || []);
        g.schedule.push({ code: "PD1", name: "เหล็กเดือยหัวเข็ม", qty: sc2.count, length: sc2.length, detail: PD.dowelNote(dw), status: "ระบบออกแบบ (รายการตรวจ P9c)" });
      } else if (ph2) g.schedule.push({ code: "PH1", name: "รายละเอียดหัวเข็ม", qty: n2, length: null, detail: PD.pileHeadNote(ph2), status: ph2.entered ? { pass: "ตามผู้ผลิต · P9c ผ่าน", missing: "ตามผู้ผลิต · P9c ขาดข้อมูล (ที่มา)", fail: "ตามผู้ผลิต · P9c ไม่ผ่าน" }[ph2.status] || "ตามผู้ผลิต (P9c)" : "ข้อยกเว้น — วิศวกรผู้ลงนามพิจารณา" });
      const el2 = document.getElementById("schedule"), e = (v2) => String(v2 ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      if (el2) el2.innerHTML = g.schedule.map((r2) => "<tr><td><b>" + e(r2.code) + "</b></td><td>" + e(r2.name) + "</td><td>" + e(r2.qty) + "</td><td>" + (r2.length !== null && r2.length !== void 0 ? Number(r2.length).toFixed(0) + " mm / เส้น<br>" : "") + e(r2.detail) + '</td><td class="small">' + e(r2.status) + "</td></tr>").join("");
    } catch {
    }
  };
  window.addEventListener("ncy:permit-refresh", syncSchedule69);
}
function getDefaultExportFromCjs(x2) {
  return x2 && x2.__esModule && Object.prototype.hasOwnProperty.call(x2, "default") ? x2["default"] : x2;
}
var react = { exports: {} };
var react_production_min = {};
/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var l = Symbol.for("react.element"), n = Symbol.for("react.portal"), p$1 = Symbol.for("react.fragment"), q = Symbol.for("react.strict_mode"), r = Symbol.for("react.profiler"), t = Symbol.for("react.provider"), u = Symbol.for("react.context"), v$1 = Symbol.for("react.forward_ref"), w = Symbol.for("react.suspense"), x = Symbol.for("react.memo"), y = Symbol.for("react.lazy"), z$1 = Symbol.iterator;
function A$1(a) {
  if (null === a || "object" !== typeof a) return null;
  a = z$1 && a[z$1] || a["@@iterator"];
  return "function" === typeof a ? a : null;
}
var B$1 = { isMounted: function() {
  return false;
}, enqueueForceUpdate: function() {
}, enqueueReplaceState: function() {
}, enqueueSetState: function() {
} }, C$1 = Object.assign, D$1 = {};
function E$1(a, b, e) {
  this.props = a;
  this.context = b;
  this.refs = D$1;
  this.updater = e || B$1;
}
E$1.prototype.isReactComponent = {};
E$1.prototype.setState = function(a, b) {
  if ("object" !== typeof a && "function" !== typeof a && null != a) throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");
  this.updater.enqueueSetState(this, a, b, "setState");
};
E$1.prototype.forceUpdate = function(a) {
  this.updater.enqueueForceUpdate(this, a, "forceUpdate");
};
function F() {
}
F.prototype = E$1.prototype;
function G$1(a, b, e) {
  this.props = a;
  this.context = b;
  this.refs = D$1;
  this.updater = e || B$1;
}
var H$1 = G$1.prototype = new F();
H$1.constructor = G$1;
C$1(H$1, E$1.prototype);
H$1.isPureReactComponent = true;
var I$1 = Array.isArray, J = Object.prototype.hasOwnProperty, K$1 = { current: null }, L$1 = { key: true, ref: true, __self: true, __source: true };
function M$1(a, b, e) {
  var d, c = {}, k = null, h = null;
  if (null != b) for (d in void 0 !== b.ref && (h = b.ref), void 0 !== b.key && (k = "" + b.key), b) J.call(b, d) && !L$1.hasOwnProperty(d) && (c[d] = b[d]);
  var g = arguments.length - 2;
  if (1 === g) c.children = e;
  else if (1 < g) {
    for (var f2 = Array(g), m2 = 0; m2 < g; m2++) f2[m2] = arguments[m2 + 2];
    c.children = f2;
  }
  if (a && a.defaultProps) for (d in g = a.defaultProps, g) void 0 === c[d] && (c[d] = g[d]);
  return { $$typeof: l, type: a, key: k, ref: h, props: c, _owner: K$1.current };
}
function N$1(a, b) {
  return { $$typeof: l, type: a.type, key: b, ref: a.ref, props: a.props, _owner: a._owner };
}
function O$1(a) {
  return "object" === typeof a && null !== a && a.$$typeof === l;
}
function escape(a) {
  var b = { "=": "=0", ":": "=2" };
  return "$" + a.replace(/[=:]/g, function(a2) {
    return b[a2];
  });
}
var P$1 = /\/+/g;
function Q$1(a, b) {
  return "object" === typeof a && null !== a && null != a.key ? escape("" + a.key) : b.toString(36);
}
function R$1(a, b, e, d, c) {
  var k = typeof a;
  if ("undefined" === k || "boolean" === k) a = null;
  var h = false;
  if (null === a) h = true;
  else switch (k) {
    case "string":
    case "number":
      h = true;
      break;
    case "object":
      switch (a.$$typeof) {
        case l:
        case n:
          h = true;
      }
  }
  if (h) return h = a, c = c(h), a = "" === d ? "." + Q$1(h, 0) : d, I$1(c) ? (e = "", null != a && (e = a.replace(P$1, "$&/") + "/"), R$1(c, b, e, "", function(a2) {
    return a2;
  })) : null != c && (O$1(c) && (c = N$1(c, e + (!c.key || h && h.key === c.key ? "" : ("" + c.key).replace(P$1, "$&/") + "/") + a)), b.push(c)), 1;
  h = 0;
  d = "" === d ? "." : d + ":";
  if (I$1(a)) for (var g = 0; g < a.length; g++) {
    k = a[g];
    var f2 = d + Q$1(k, g);
    h += R$1(k, b, e, f2, c);
  }
  else if (f2 = A$1(a), "function" === typeof f2) for (a = f2.call(a), g = 0; !(k = a.next()).done; ) k = k.value, f2 = d + Q$1(k, g++), h += R$1(k, b, e, f2, c);
  else if ("object" === k) throw b = String(a), Error("Objects are not valid as a React child (found: " + ("[object Object]" === b ? "object with keys {" + Object.keys(a).join(", ") + "}" : b) + "). If you meant to render a collection of children, use an array instead.");
  return h;
}
function S$1(a, b, e) {
  if (null == a) return a;
  var d = [], c = 0;
  R$1(a, d, "", "", function(a2) {
    return b.call(e, a2, c++);
  });
  return d;
}
function T$1(a) {
  if (-1 === a._status) {
    var b = a._result;
    b = b();
    b.then(function(b2) {
      if (0 === a._status || -1 === a._status) a._status = 1, a._result = b2;
    }, function(b2) {
      if (0 === a._status || -1 === a._status) a._status = 2, a._result = b2;
    });
    -1 === a._status && (a._status = 0, a._result = b);
  }
  if (1 === a._status) return a._result.default;
  throw a._result;
}
var U$1 = { current: null }, V$1 = { transition: null }, W$1 = { ReactCurrentDispatcher: U$1, ReactCurrentBatchConfig: V$1, ReactCurrentOwner: K$1 };
function X$1() {
  throw Error("act(...) is not supported in production builds of React.");
}
react_production_min.Children = { map: S$1, forEach: function(a, b, e) {
  S$1(a, function() {
    b.apply(this, arguments);
  }, e);
}, count: function(a) {
  var b = 0;
  S$1(a, function() {
    b++;
  });
  return b;
}, toArray: function(a) {
  return S$1(a, function(a2) {
    return a2;
  }) || [];
}, only: function(a) {
  if (!O$1(a)) throw Error("React.Children.only expected to receive a single React element child.");
  return a;
} };
react_production_min.Component = E$1;
react_production_min.Fragment = p$1;
react_production_min.Profiler = r;
react_production_min.PureComponent = G$1;
react_production_min.StrictMode = q;
react_production_min.Suspense = w;
react_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = W$1;
react_production_min.act = X$1;
react_production_min.cloneElement = function(a, b, e) {
  if (null === a || void 0 === a) throw Error("React.cloneElement(...): The argument must be a React element, but you passed " + a + ".");
  var d = C$1({}, a.props), c = a.key, k = a.ref, h = a._owner;
  if (null != b) {
    void 0 !== b.ref && (k = b.ref, h = K$1.current);
    void 0 !== b.key && (c = "" + b.key);
    if (a.type && a.type.defaultProps) var g = a.type.defaultProps;
    for (f2 in b) J.call(b, f2) && !L$1.hasOwnProperty(f2) && (d[f2] = void 0 === b[f2] && void 0 !== g ? g[f2] : b[f2]);
  }
  var f2 = arguments.length - 2;
  if (1 === f2) d.children = e;
  else if (1 < f2) {
    g = Array(f2);
    for (var m2 = 0; m2 < f2; m2++) g[m2] = arguments[m2 + 2];
    d.children = g;
  }
  return { $$typeof: l, type: a.type, key: c, ref: k, props: d, _owner: h };
};
react_production_min.createContext = function(a) {
  a = { $$typeof: u, _currentValue: a, _currentValue2: a, _threadCount: 0, Provider: null, Consumer: null, _defaultValue: null, _globalName: null };
  a.Provider = { $$typeof: t, _context: a };
  return a.Consumer = a;
};
react_production_min.createElement = M$1;
react_production_min.createFactory = function(a) {
  var b = M$1.bind(null, a);
  b.type = a;
  return b;
};
react_production_min.createRef = function() {
  return { current: null };
};
react_production_min.forwardRef = function(a) {
  return { $$typeof: v$1, render: a };
};
react_production_min.isValidElement = O$1;
react_production_min.lazy = function(a) {
  return { $$typeof: y, _payload: { _status: -1, _result: a }, _init: T$1 };
};
react_production_min.memo = function(a, b) {
  return { $$typeof: x, type: a, compare: void 0 === b ? null : b };
};
react_production_min.startTransition = function(a) {
  var b = V$1.transition;
  V$1.transition = {};
  try {
    a();
  } finally {
    V$1.transition = b;
  }
};
react_production_min.unstable_act = X$1;
react_production_min.useCallback = function(a, b) {
  return U$1.current.useCallback(a, b);
};
react_production_min.useContext = function(a) {
  return U$1.current.useContext(a);
};
react_production_min.useDebugValue = function() {
};
react_production_min.useDeferredValue = function(a) {
  return U$1.current.useDeferredValue(a);
};
react_production_min.useEffect = function(a, b) {
  return U$1.current.useEffect(a, b);
};
react_production_min.useId = function() {
  return U$1.current.useId();
};
react_production_min.useImperativeHandle = function(a, b, e) {
  return U$1.current.useImperativeHandle(a, b, e);
};
react_production_min.useInsertionEffect = function(a, b) {
  return U$1.current.useInsertionEffect(a, b);
};
react_production_min.useLayoutEffect = function(a, b) {
  return U$1.current.useLayoutEffect(a, b);
};
react_production_min.useMemo = function(a, b) {
  return U$1.current.useMemo(a, b);
};
react_production_min.useReducer = function(a, b, e) {
  return U$1.current.useReducer(a, b, e);
};
react_production_min.useRef = function(a) {
  return U$1.current.useRef(a);
};
react_production_min.useState = function(a) {
  return U$1.current.useState(a);
};
react_production_min.useSyncExternalStore = function(a, b, e) {
  return U$1.current.useSyncExternalStore(a, b, e);
};
react_production_min.useTransition = function() {
  return U$1.current.useTransition();
};
react_production_min.version = "18.3.1";
{
  react.exports = react_production_min;
}
var reactExports = react.exports;
const React = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);
var reactDom = { exports: {} };
var reactDom_production_min = {};
var scheduler = { exports: {} };
var scheduler_production_min = {};
/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
(function(exports) {
  function f2(a, b) {
    var c = a.length;
    a.push(b);
    a: for (; 0 < c; ) {
      var d = c - 1 >>> 1, e = a[d];
      if (0 < g(e, b)) a[d] = b, a[c] = e, c = d;
      else break a;
    }
  }
  function h(a) {
    return 0 === a.length ? null : a[0];
  }
  function k(a) {
    if (0 === a.length) return null;
    var b = a[0], c = a.pop();
    if (c !== b) {
      a[0] = c;
      a: for (var d = 0, e = a.length, w2 = e >>> 1; d < w2; ) {
        var m2 = 2 * (d + 1) - 1, C2 = a[m2], n2 = m2 + 1, x2 = a[n2];
        if (0 > g(C2, c)) n2 < e && 0 > g(x2, C2) ? (a[d] = x2, a[n2] = c, d = n2) : (a[d] = C2, a[m2] = c, d = m2);
        else if (n2 < e && 0 > g(x2, c)) a[d] = x2, a[n2] = c, d = n2;
        else break a;
      }
    }
    return b;
  }
  function g(a, b) {
    var c = a.sortIndex - b.sortIndex;
    return 0 !== c ? c : a.id - b.id;
  }
  if ("object" === typeof performance && "function" === typeof performance.now) {
    var l2 = performance;
    exports.unstable_now = function() {
      return l2.now();
    };
  } else {
    var p2 = Date, q2 = p2.now();
    exports.unstable_now = function() {
      return p2.now() - q2;
    };
  }
  var r2 = [], t2 = [], u2 = 1, v2 = null, y2 = 3, z2 = false, A2 = false, B2 = false, D2 = "function" === typeof setTimeout ? setTimeout : null, E2 = "function" === typeof clearTimeout ? clearTimeout : null, F2 = "undefined" !== typeof setImmediate ? setImmediate : null;
  "undefined" !== typeof navigator && void 0 !== navigator.scheduling && void 0 !== navigator.scheduling.isInputPending && navigator.scheduling.isInputPending.bind(navigator.scheduling);
  function G2(a) {
    for (var b = h(t2); null !== b; ) {
      if (null === b.callback) k(t2);
      else if (b.startTime <= a) k(t2), b.sortIndex = b.expirationTime, f2(r2, b);
      else break;
      b = h(t2);
    }
  }
  function H2(a) {
    B2 = false;
    G2(a);
    if (!A2) if (null !== h(r2)) A2 = true, I2(J2);
    else {
      var b = h(t2);
      null !== b && K2(H2, b.startTime - a);
    }
  }
  function J2(a, b) {
    A2 = false;
    B2 && (B2 = false, E2(L2), L2 = -1);
    z2 = true;
    var c = y2;
    try {
      G2(b);
      for (v2 = h(r2); null !== v2 && (!(v2.expirationTime > b) || a && !M2()); ) {
        var d = v2.callback;
        if ("function" === typeof d) {
          v2.callback = null;
          y2 = v2.priorityLevel;
          var e = d(v2.expirationTime <= b);
          b = exports.unstable_now();
          "function" === typeof e ? v2.callback = e : v2 === h(r2) && k(r2);
          G2(b);
        } else k(r2);
        v2 = h(r2);
      }
      if (null !== v2) var w2 = true;
      else {
        var m2 = h(t2);
        null !== m2 && K2(H2, m2.startTime - b);
        w2 = false;
      }
      return w2;
    } finally {
      v2 = null, y2 = c, z2 = false;
    }
  }
  var N2 = false, O2 = null, L2 = -1, P2 = 5, Q2 = -1;
  function M2() {
    return exports.unstable_now() - Q2 < P2 ? false : true;
  }
  function R2() {
    if (null !== O2) {
      var a = exports.unstable_now();
      Q2 = a;
      var b = true;
      try {
        b = O2(true, a);
      } finally {
        b ? S2() : (N2 = false, O2 = null);
      }
    } else N2 = false;
  }
  var S2;
  if ("function" === typeof F2) S2 = function() {
    F2(R2);
  };
  else if ("undefined" !== typeof MessageChannel) {
    var T2 = new MessageChannel(), U2 = T2.port2;
    T2.port1.onmessage = R2;
    S2 = function() {
      U2.postMessage(null);
    };
  } else S2 = function() {
    D2(R2, 0);
  };
  function I2(a) {
    O2 = a;
    N2 || (N2 = true, S2());
  }
  function K2(a, b) {
    L2 = D2(function() {
      a(exports.unstable_now());
    }, b);
  }
  exports.unstable_IdlePriority = 5;
  exports.unstable_ImmediatePriority = 1;
  exports.unstable_LowPriority = 4;
  exports.unstable_NormalPriority = 3;
  exports.unstable_Profiling = null;
  exports.unstable_UserBlockingPriority = 2;
  exports.unstable_cancelCallback = function(a) {
    a.callback = null;
  };
  exports.unstable_continueExecution = function() {
    A2 || z2 || (A2 = true, I2(J2));
  };
  exports.unstable_forceFrameRate = function(a) {
    0 > a || 125 < a ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : P2 = 0 < a ? Math.floor(1e3 / a) : 5;
  };
  exports.unstable_getCurrentPriorityLevel = function() {
    return y2;
  };
  exports.unstable_getFirstCallbackNode = function() {
    return h(r2);
  };
  exports.unstable_next = function(a) {
    switch (y2) {
      case 1:
      case 2:
      case 3:
        var b = 3;
        break;
      default:
        b = y2;
    }
    var c = y2;
    y2 = b;
    try {
      return a();
    } finally {
      y2 = c;
    }
  };
  exports.unstable_pauseExecution = function() {
  };
  exports.unstable_requestPaint = function() {
  };
  exports.unstable_runWithPriority = function(a, b) {
    switch (a) {
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        break;
      default:
        a = 3;
    }
    var c = y2;
    y2 = a;
    try {
      return b();
    } finally {
      y2 = c;
    }
  };
  exports.unstable_scheduleCallback = function(a, b, c) {
    var d = exports.unstable_now();
    "object" === typeof c && null !== c ? (c = c.delay, c = "number" === typeof c && 0 < c ? d + c : d) : c = d;
    switch (a) {
      case 1:
        var e = -1;
        break;
      case 2:
        e = 250;
        break;
      case 5:
        e = 1073741823;
        break;
      case 4:
        e = 1e4;
        break;
      default:
        e = 5e3;
    }
    e = c + e;
    a = { id: u2++, callback: b, priorityLevel: a, startTime: c, expirationTime: e, sortIndex: -1 };
    c > d ? (a.sortIndex = c, f2(t2, a), null === h(r2) && a === h(t2) && (B2 ? (E2(L2), L2 = -1) : B2 = true, K2(H2, c - d))) : (a.sortIndex = e, f2(r2, a), A2 || z2 || (A2 = true, I2(J2)));
    return a;
  };
  exports.unstable_shouldYield = M2;
  exports.unstable_wrapCallback = function(a) {
    var b = y2;
    return function() {
      var c = y2;
      y2 = b;
      try {
        return a.apply(this, arguments);
      } finally {
        y2 = c;
      }
    };
  };
})(scheduler_production_min);
{
  scheduler.exports = scheduler_production_min;
}
var schedulerExports = scheduler.exports;
/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var aa = reactExports, ca = schedulerExports;
function p(a) {
  for (var b = "https://reactjs.org/docs/error-decoder.html?invariant=" + a, c = 1; c < arguments.length; c++) b += "&args[]=" + encodeURIComponent(arguments[c]);
  return "Minified React error #" + a + "; visit " + b + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
}
var da = /* @__PURE__ */ new Set(), ea = {};
function fa(a, b) {
  ha(a, b);
  ha(a + "Capture", b);
}
function ha(a, b) {
  ea[a] = b;
  for (a = 0; a < b.length; a++) da.add(b[a]);
}
var ia = !("undefined" === typeof window || "undefined" === typeof window.document || "undefined" === typeof window.document.createElement), ja = Object.prototype.hasOwnProperty, ka = /^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/, la = {}, ma = {};
function oa(a) {
  if (ja.call(ma, a)) return true;
  if (ja.call(la, a)) return false;
  if (ka.test(a)) return ma[a] = true;
  la[a] = true;
  return false;
}
function pa(a, b, c, d) {
  if (null !== c && 0 === c.type) return false;
  switch (typeof b) {
    case "function":
    case "symbol":
      return true;
    case "boolean":
      if (d) return false;
      if (null !== c) return !c.acceptsBooleans;
      a = a.toLowerCase().slice(0, 5);
      return "data-" !== a && "aria-" !== a;
    default:
      return false;
  }
}
function qa(a, b, c, d) {
  if (null === b || "undefined" === typeof b || pa(a, b, c, d)) return true;
  if (d) return false;
  if (null !== c) switch (c.type) {
    case 3:
      return !b;
    case 4:
      return false === b;
    case 5:
      return isNaN(b);
    case 6:
      return isNaN(b) || 1 > b;
  }
  return false;
}
function v(a, b, c, d, e, f2, g) {
  this.acceptsBooleans = 2 === b || 3 === b || 4 === b;
  this.attributeName = d;
  this.attributeNamespace = e;
  this.mustUseProperty = c;
  this.propertyName = a;
  this.type = b;
  this.sanitizeURL = f2;
  this.removeEmptyString = g;
}
var z = {};
"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(a) {
  z[a] = new v(a, 0, false, a, null, false, false);
});
[["acceptCharset", "accept-charset"], ["className", "class"], ["htmlFor", "for"], ["httpEquiv", "http-equiv"]].forEach(function(a) {
  var b = a[0];
  z[b] = new v(b, 1, false, a[1], null, false, false);
});
["contentEditable", "draggable", "spellCheck", "value"].forEach(function(a) {
  z[a] = new v(a, 2, false, a.toLowerCase(), null, false, false);
});
["autoReverse", "externalResourcesRequired", "focusable", "preserveAlpha"].forEach(function(a) {
  z[a] = new v(a, 2, false, a, null, false, false);
});
"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(a) {
  z[a] = new v(a, 3, false, a.toLowerCase(), null, false, false);
});
["checked", "multiple", "muted", "selected"].forEach(function(a) {
  z[a] = new v(a, 3, true, a, null, false, false);
});
["capture", "download"].forEach(function(a) {
  z[a] = new v(a, 4, false, a, null, false, false);
});
["cols", "rows", "size", "span"].forEach(function(a) {
  z[a] = new v(a, 6, false, a, null, false, false);
});
["rowSpan", "start"].forEach(function(a) {
  z[a] = new v(a, 5, false, a.toLowerCase(), null, false, false);
});
var ra = /[\-:]([a-z])/g;
function sa(a) {
  return a[1].toUpperCase();
}
"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(a) {
  var b = a.replace(
    ra,
    sa
  );
  z[b] = new v(b, 1, false, a, null, false, false);
});
"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(a) {
  var b = a.replace(ra, sa);
  z[b] = new v(b, 1, false, a, "http://www.w3.org/1999/xlink", false, false);
});
["xml:base", "xml:lang", "xml:space"].forEach(function(a) {
  var b = a.replace(ra, sa);
  z[b] = new v(b, 1, false, a, "http://www.w3.org/XML/1998/namespace", false, false);
});
["tabIndex", "crossOrigin"].forEach(function(a) {
  z[a] = new v(a, 1, false, a.toLowerCase(), null, false, false);
});
z.xlinkHref = new v("xlinkHref", 1, false, "xlink:href", "http://www.w3.org/1999/xlink", true, false);
["src", "href", "action", "formAction"].forEach(function(a) {
  z[a] = new v(a, 1, false, a.toLowerCase(), null, true, true);
});
function ta(a, b, c, d) {
  var e = z.hasOwnProperty(b) ? z[b] : null;
  if (null !== e ? 0 !== e.type : d || !(2 < b.length) || "o" !== b[0] && "O" !== b[0] || "n" !== b[1] && "N" !== b[1]) qa(b, c, e, d) && (c = null), d || null === e ? oa(b) && (null === c ? a.removeAttribute(b) : a.setAttribute(b, "" + c)) : e.mustUseProperty ? a[e.propertyName] = null === c ? 3 === e.type ? false : "" : c : (b = e.attributeName, d = e.attributeNamespace, null === c ? a.removeAttribute(b) : (e = e.type, c = 3 === e || 4 === e && true === c ? "" : "" + c, d ? a.setAttributeNS(d, b, c) : a.setAttribute(b, c)));
}
var ua = aa.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED, va = Symbol.for("react.element"), wa = Symbol.for("react.portal"), ya = Symbol.for("react.fragment"), za = Symbol.for("react.strict_mode"), Aa = Symbol.for("react.profiler"), Ba = Symbol.for("react.provider"), Ca = Symbol.for("react.context"), Da = Symbol.for("react.forward_ref"), Ea = Symbol.for("react.suspense"), Fa = Symbol.for("react.suspense_list"), Ga = Symbol.for("react.memo"), Ha = Symbol.for("react.lazy");
var Ia = Symbol.for("react.offscreen");
var Ja = Symbol.iterator;
function Ka(a) {
  if (null === a || "object" !== typeof a) return null;
  a = Ja && a[Ja] || a["@@iterator"];
  return "function" === typeof a ? a : null;
}
var A = Object.assign, La;
function Ma(a) {
  if (void 0 === La) try {
    throw Error();
  } catch (c) {
    var b = c.stack.trim().match(/\n( *(at )?)/);
    La = b && b[1] || "";
  }
  return "\n" + La + a;
}
var Na = false;
function Oa(a, b) {
  if (!a || Na) return "";
  Na = true;
  var c = Error.prepareStackTrace;
  Error.prepareStackTrace = void 0;
  try {
    if (b) if (b = function() {
      throw Error();
    }, Object.defineProperty(b.prototype, "props", { set: function() {
      throw Error();
    } }), "object" === typeof Reflect && Reflect.construct) {
      try {
        Reflect.construct(b, []);
      } catch (l2) {
        var d = l2;
      }
      Reflect.construct(a, [], b);
    } else {
      try {
        b.call();
      } catch (l2) {
        d = l2;
      }
      a.call(b.prototype);
    }
    else {
      try {
        throw Error();
      } catch (l2) {
        d = l2;
      }
      a();
    }
  } catch (l2) {
    if (l2 && d && "string" === typeof l2.stack) {
      for (var e = l2.stack.split("\n"), f2 = d.stack.split("\n"), g = e.length - 1, h = f2.length - 1; 1 <= g && 0 <= h && e[g] !== f2[h]; ) h--;
      for (; 1 <= g && 0 <= h; g--, h--) if (e[g] !== f2[h]) {
        if (1 !== g || 1 !== h) {
          do
            if (g--, h--, 0 > h || e[g] !== f2[h]) {
              var k = "\n" + e[g].replace(" at new ", " at ");
              a.displayName && k.includes("<anonymous>") && (k = k.replace("<anonymous>", a.displayName));
              return k;
            }
          while (1 <= g && 0 <= h);
        }
        break;
      }
    }
  } finally {
    Na = false, Error.prepareStackTrace = c;
  }
  return (a = a ? a.displayName || a.name : "") ? Ma(a) : "";
}
function Pa(a) {
  switch (a.tag) {
    case 5:
      return Ma(a.type);
    case 16:
      return Ma("Lazy");
    case 13:
      return Ma("Suspense");
    case 19:
      return Ma("SuspenseList");
    case 0:
    case 2:
    case 15:
      return a = Oa(a.type, false), a;
    case 11:
      return a = Oa(a.type.render, false), a;
    case 1:
      return a = Oa(a.type, true), a;
    default:
      return "";
  }
}
function Qa(a) {
  if (null == a) return null;
  if ("function" === typeof a) return a.displayName || a.name || null;
  if ("string" === typeof a) return a;
  switch (a) {
    case ya:
      return "Fragment";
    case wa:
      return "Portal";
    case Aa:
      return "Profiler";
    case za:
      return "StrictMode";
    case Ea:
      return "Suspense";
    case Fa:
      return "SuspenseList";
  }
  if ("object" === typeof a) switch (a.$$typeof) {
    case Ca:
      return (a.displayName || "Context") + ".Consumer";
    case Ba:
      return (a._context.displayName || "Context") + ".Provider";
    case Da:
      var b = a.render;
      a = a.displayName;
      a || (a = b.displayName || b.name || "", a = "" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
      return a;
    case Ga:
      return b = a.displayName || null, null !== b ? b : Qa(a.type) || "Memo";
    case Ha:
      b = a._payload;
      a = a._init;
      try {
        return Qa(a(b));
      } catch (c) {
      }
  }
  return null;
}
function Ra(a) {
  var b = a.type;
  switch (a.tag) {
    case 24:
      return "Cache";
    case 9:
      return (b.displayName || "Context") + ".Consumer";
    case 10:
      return (b._context.displayName || "Context") + ".Provider";
    case 18:
      return "DehydratedFragment";
    case 11:
      return a = b.render, a = a.displayName || a.name || "", b.displayName || ("" !== a ? "ForwardRef(" + a + ")" : "ForwardRef");
    case 7:
      return "Fragment";
    case 5:
      return b;
    case 4:
      return "Portal";
    case 3:
      return "Root";
    case 6:
      return "Text";
    case 16:
      return Qa(b);
    case 8:
      return b === za ? "StrictMode" : "Mode";
    case 22:
      return "Offscreen";
    case 12:
      return "Profiler";
    case 21:
      return "Scope";
    case 13:
      return "Suspense";
    case 19:
      return "SuspenseList";
    case 25:
      return "TracingMarker";
    case 1:
    case 0:
    case 17:
    case 2:
    case 14:
    case 15:
      if ("function" === typeof b) return b.displayName || b.name || null;
      if ("string" === typeof b) return b;
  }
  return null;
}
function Sa(a) {
  switch (typeof a) {
    case "boolean":
    case "number":
    case "string":
    case "undefined":
      return a;
    case "object":
      return a;
    default:
      return "";
  }
}
function Ta(a) {
  var b = a.type;
  return (a = a.nodeName) && "input" === a.toLowerCase() && ("checkbox" === b || "radio" === b);
}
function Ua(a) {
  var b = Ta(a) ? "checked" : "value", c = Object.getOwnPropertyDescriptor(a.constructor.prototype, b), d = "" + a[b];
  if (!a.hasOwnProperty(b) && "undefined" !== typeof c && "function" === typeof c.get && "function" === typeof c.set) {
    var e = c.get, f2 = c.set;
    Object.defineProperty(a, b, { configurable: true, get: function() {
      return e.call(this);
    }, set: function(a2) {
      d = "" + a2;
      f2.call(this, a2);
    } });
    Object.defineProperty(a, b, { enumerable: c.enumerable });
    return { getValue: function() {
      return d;
    }, setValue: function(a2) {
      d = "" + a2;
    }, stopTracking: function() {
      a._valueTracker = null;
      delete a[b];
    } };
  }
}
function Va(a) {
  a._valueTracker || (a._valueTracker = Ua(a));
}
function Wa(a) {
  if (!a) return false;
  var b = a._valueTracker;
  if (!b) return true;
  var c = b.getValue();
  var d = "";
  a && (d = Ta(a) ? a.checked ? "true" : "false" : a.value);
  a = d;
  return a !== c ? (b.setValue(a), true) : false;
}
function Xa(a) {
  a = a || ("undefined" !== typeof document ? document : void 0);
  if ("undefined" === typeof a) return null;
  try {
    return a.activeElement || a.body;
  } catch (b) {
    return a.body;
  }
}
function Ya(a, b) {
  var c = b.checked;
  return A({}, b, { defaultChecked: void 0, defaultValue: void 0, value: void 0, checked: null != c ? c : a._wrapperState.initialChecked });
}
function Za(a, b) {
  var c = null == b.defaultValue ? "" : b.defaultValue, d = null != b.checked ? b.checked : b.defaultChecked;
  c = Sa(null != b.value ? b.value : c);
  a._wrapperState = { initialChecked: d, initialValue: c, controlled: "checkbox" === b.type || "radio" === b.type ? null != b.checked : null != b.value };
}
function ab(a, b) {
  b = b.checked;
  null != b && ta(a, "checked", b, false);
}
function bb(a, b) {
  ab(a, b);
  var c = Sa(b.value), d = b.type;
  if (null != c) if ("number" === d) {
    if (0 === c && "" === a.value || a.value != c) a.value = "" + c;
  } else a.value !== "" + c && (a.value = "" + c);
  else if ("submit" === d || "reset" === d) {
    a.removeAttribute("value");
    return;
  }
  b.hasOwnProperty("value") ? cb(a, b.type, c) : b.hasOwnProperty("defaultValue") && cb(a, b.type, Sa(b.defaultValue));
  null == b.checked && null != b.defaultChecked && (a.defaultChecked = !!b.defaultChecked);
}
function db(a, b, c) {
  if (b.hasOwnProperty("value") || b.hasOwnProperty("defaultValue")) {
    var d = b.type;
    if (!("submit" !== d && "reset" !== d || void 0 !== b.value && null !== b.value)) return;
    b = "" + a._wrapperState.initialValue;
    c || b === a.value || (a.value = b);
    a.defaultValue = b;
  }
  c = a.name;
  "" !== c && (a.name = "");
  a.defaultChecked = !!a._wrapperState.initialChecked;
  "" !== c && (a.name = c);
}
function cb(a, b, c) {
  if ("number" !== b || Xa(a.ownerDocument) !== a) null == c ? a.defaultValue = "" + a._wrapperState.initialValue : a.defaultValue !== "" + c && (a.defaultValue = "" + c);
}
var eb = Array.isArray;
function fb(a, b, c, d) {
  a = a.options;
  if (b) {
    b = {};
    for (var e = 0; e < c.length; e++) b["$" + c[e]] = true;
    for (c = 0; c < a.length; c++) e = b.hasOwnProperty("$" + a[c].value), a[c].selected !== e && (a[c].selected = e), e && d && (a[c].defaultSelected = true);
  } else {
    c = "" + Sa(c);
    b = null;
    for (e = 0; e < a.length; e++) {
      if (a[e].value === c) {
        a[e].selected = true;
        d && (a[e].defaultSelected = true);
        return;
      }
      null !== b || a[e].disabled || (b = a[e]);
    }
    null !== b && (b.selected = true);
  }
}
function gb(a, b) {
  if (null != b.dangerouslySetInnerHTML) throw Error(p(91));
  return A({}, b, { value: void 0, defaultValue: void 0, children: "" + a._wrapperState.initialValue });
}
function hb(a, b) {
  var c = b.value;
  if (null == c) {
    c = b.children;
    b = b.defaultValue;
    if (null != c) {
      if (null != b) throw Error(p(92));
      if (eb(c)) {
        if (1 < c.length) throw Error(p(93));
        c = c[0];
      }
      b = c;
    }
    null == b && (b = "");
    c = b;
  }
  a._wrapperState = { initialValue: Sa(c) };
}
function ib(a, b) {
  var c = Sa(b.value), d = Sa(b.defaultValue);
  null != c && (c = "" + c, c !== a.value && (a.value = c), null == b.defaultValue && a.defaultValue !== c && (a.defaultValue = c));
  null != d && (a.defaultValue = "" + d);
}
function jb(a) {
  var b = a.textContent;
  b === a._wrapperState.initialValue && "" !== b && null !== b && (a.value = b);
}
function kb(a) {
  switch (a) {
    case "svg":
      return "http://www.w3.org/2000/svg";
    case "math":
      return "http://www.w3.org/1998/Math/MathML";
    default:
      return "http://www.w3.org/1999/xhtml";
  }
}
function lb(a, b) {
  return null == a || "http://www.w3.org/1999/xhtml" === a ? kb(b) : "http://www.w3.org/2000/svg" === a && "foreignObject" === b ? "http://www.w3.org/1999/xhtml" : a;
}
var mb, nb = function(a) {
  return "undefined" !== typeof MSApp && MSApp.execUnsafeLocalFunction ? function(b, c, d, e) {
    MSApp.execUnsafeLocalFunction(function() {
      return a(b, c, d, e);
    });
  } : a;
}(function(a, b) {
  if ("http://www.w3.org/2000/svg" !== a.namespaceURI || "innerHTML" in a) a.innerHTML = b;
  else {
    mb = mb || document.createElement("div");
    mb.innerHTML = "<svg>" + b.valueOf().toString() + "</svg>";
    for (b = mb.firstChild; a.firstChild; ) a.removeChild(a.firstChild);
    for (; b.firstChild; ) a.appendChild(b.firstChild);
  }
});
function ob(a, b) {
  if (b) {
    var c = a.firstChild;
    if (c && c === a.lastChild && 3 === c.nodeType) {
      c.nodeValue = b;
      return;
    }
  }
  a.textContent = b;
}
var pb = {
  animationIterationCount: true,
  aspectRatio: true,
  borderImageOutset: true,
  borderImageSlice: true,
  borderImageWidth: true,
  boxFlex: true,
  boxFlexGroup: true,
  boxOrdinalGroup: true,
  columnCount: true,
  columns: true,
  flex: true,
  flexGrow: true,
  flexPositive: true,
  flexShrink: true,
  flexNegative: true,
  flexOrder: true,
  gridArea: true,
  gridRow: true,
  gridRowEnd: true,
  gridRowSpan: true,
  gridRowStart: true,
  gridColumn: true,
  gridColumnEnd: true,
  gridColumnSpan: true,
  gridColumnStart: true,
  fontWeight: true,
  lineClamp: true,
  lineHeight: true,
  opacity: true,
  order: true,
  orphans: true,
  tabSize: true,
  widows: true,
  zIndex: true,
  zoom: true,
  fillOpacity: true,
  floodOpacity: true,
  stopOpacity: true,
  strokeDasharray: true,
  strokeDashoffset: true,
  strokeMiterlimit: true,
  strokeOpacity: true,
  strokeWidth: true
}, qb = ["Webkit", "ms", "Moz", "O"];
Object.keys(pb).forEach(function(a) {
  qb.forEach(function(b) {
    b = b + a.charAt(0).toUpperCase() + a.substring(1);
    pb[b] = pb[a];
  });
});
function rb(a, b, c) {
  return null == b || "boolean" === typeof b || "" === b ? "" : c || "number" !== typeof b || 0 === b || pb.hasOwnProperty(a) && pb[a] ? ("" + b).trim() : b + "px";
}
function sb(a, b) {
  a = a.style;
  for (var c in b) if (b.hasOwnProperty(c)) {
    var d = 0 === c.indexOf("--"), e = rb(c, b[c], d);
    "float" === c && (c = "cssFloat");
    d ? a.setProperty(c, e) : a[c] = e;
  }
}
var tb = A({ menuitem: true }, { area: true, base: true, br: true, col: true, embed: true, hr: true, img: true, input: true, keygen: true, link: true, meta: true, param: true, source: true, track: true, wbr: true });
function ub(a, b) {
  if (b) {
    if (tb[a] && (null != b.children || null != b.dangerouslySetInnerHTML)) throw Error(p(137, a));
    if (null != b.dangerouslySetInnerHTML) {
      if (null != b.children) throw Error(p(60));
      if ("object" !== typeof b.dangerouslySetInnerHTML || !("__html" in b.dangerouslySetInnerHTML)) throw Error(p(61));
    }
    if (null != b.style && "object" !== typeof b.style) throw Error(p(62));
  }
}
function vb(a, b) {
  if (-1 === a.indexOf("-")) return "string" === typeof b.is;
  switch (a) {
    case "annotation-xml":
    case "color-profile":
    case "font-face":
    case "font-face-src":
    case "font-face-uri":
    case "font-face-format":
    case "font-face-name":
    case "missing-glyph":
      return false;
    default:
      return true;
  }
}
var wb = null;
function xb(a) {
  a = a.target || a.srcElement || window;
  a.correspondingUseElement && (a = a.correspondingUseElement);
  return 3 === a.nodeType ? a.parentNode : a;
}
var yb = null, zb = null, Ab = null;
function Bb(a) {
  if (a = Cb(a)) {
    if ("function" !== typeof yb) throw Error(p(280));
    var b = a.stateNode;
    b && (b = Db(b), yb(a.stateNode, a.type, b));
  }
}
function Eb(a) {
  zb ? Ab ? Ab.push(a) : Ab = [a] : zb = a;
}
function Fb() {
  if (zb) {
    var a = zb, b = Ab;
    Ab = zb = null;
    Bb(a);
    if (b) for (a = 0; a < b.length; a++) Bb(b[a]);
  }
}
function Gb(a, b) {
  return a(b);
}
function Hb() {
}
var Ib = false;
function Jb(a, b, c) {
  if (Ib) return a(b, c);
  Ib = true;
  try {
    return Gb(a, b, c);
  } finally {
    if (Ib = false, null !== zb || null !== Ab) Hb(), Fb();
  }
}
function Kb(a, b) {
  var c = a.stateNode;
  if (null === c) return null;
  var d = Db(c);
  if (null === d) return null;
  c = d[b];
  a: switch (b) {
    case "onClick":
    case "onClickCapture":
    case "onDoubleClick":
    case "onDoubleClickCapture":
    case "onMouseDown":
    case "onMouseDownCapture":
    case "onMouseMove":
    case "onMouseMoveCapture":
    case "onMouseUp":
    case "onMouseUpCapture":
    case "onMouseEnter":
      (d = !d.disabled) || (a = a.type, d = !("button" === a || "input" === a || "select" === a || "textarea" === a));
      a = !d;
      break a;
    default:
      a = false;
  }
  if (a) return null;
  if (c && "function" !== typeof c) throw Error(p(231, b, typeof c));
  return c;
}
var Lb = false;
if (ia) try {
  var Mb = {};
  Object.defineProperty(Mb, "passive", { get: function() {
    Lb = true;
  } });
  window.addEventListener("test", Mb, Mb);
  window.removeEventListener("test", Mb, Mb);
} catch (a) {
  Lb = false;
}
function Nb(a, b, c, d, e, f2, g, h, k) {
  var l2 = Array.prototype.slice.call(arguments, 3);
  try {
    b.apply(c, l2);
  } catch (m2) {
    this.onError(m2);
  }
}
var Ob = false, Pb = null, Qb = false, Rb = null, Sb = { onError: function(a) {
  Ob = true;
  Pb = a;
} };
function Tb(a, b, c, d, e, f2, g, h, k) {
  Ob = false;
  Pb = null;
  Nb.apply(Sb, arguments);
}
function Ub(a, b, c, d, e, f2, g, h, k) {
  Tb.apply(this, arguments);
  if (Ob) {
    if (Ob) {
      var l2 = Pb;
      Ob = false;
      Pb = null;
    } else throw Error(p(198));
    Qb || (Qb = true, Rb = l2);
  }
}
function Vb(a) {
  var b = a, c = a;
  if (a.alternate) for (; b.return; ) b = b.return;
  else {
    a = b;
    do
      b = a, 0 !== (b.flags & 4098) && (c = b.return), a = b.return;
    while (a);
  }
  return 3 === b.tag ? c : null;
}
function Wb(a) {
  if (13 === a.tag) {
    var b = a.memoizedState;
    null === b && (a = a.alternate, null !== a && (b = a.memoizedState));
    if (null !== b) return b.dehydrated;
  }
  return null;
}
function Xb(a) {
  if (Vb(a) !== a) throw Error(p(188));
}
function Yb(a) {
  var b = a.alternate;
  if (!b) {
    b = Vb(a);
    if (null === b) throw Error(p(188));
    return b !== a ? null : a;
  }
  for (var c = a, d = b; ; ) {
    var e = c.return;
    if (null === e) break;
    var f2 = e.alternate;
    if (null === f2) {
      d = e.return;
      if (null !== d) {
        c = d;
        continue;
      }
      break;
    }
    if (e.child === f2.child) {
      for (f2 = e.child; f2; ) {
        if (f2 === c) return Xb(e), a;
        if (f2 === d) return Xb(e), b;
        f2 = f2.sibling;
      }
      throw Error(p(188));
    }
    if (c.return !== d.return) c = e, d = f2;
    else {
      for (var g = false, h = e.child; h; ) {
        if (h === c) {
          g = true;
          c = e;
          d = f2;
          break;
        }
        if (h === d) {
          g = true;
          d = e;
          c = f2;
          break;
        }
        h = h.sibling;
      }
      if (!g) {
        for (h = f2.child; h; ) {
          if (h === c) {
            g = true;
            c = f2;
            d = e;
            break;
          }
          if (h === d) {
            g = true;
            d = f2;
            c = e;
            break;
          }
          h = h.sibling;
        }
        if (!g) throw Error(p(189));
      }
    }
    if (c.alternate !== d) throw Error(p(190));
  }
  if (3 !== c.tag) throw Error(p(188));
  return c.stateNode.current === c ? a : b;
}
function Zb(a) {
  a = Yb(a);
  return null !== a ? $b(a) : null;
}
function $b(a) {
  if (5 === a.tag || 6 === a.tag) return a;
  for (a = a.child; null !== a; ) {
    var b = $b(a);
    if (null !== b) return b;
    a = a.sibling;
  }
  return null;
}
var ac = ca.unstable_scheduleCallback, bc = ca.unstable_cancelCallback, cc = ca.unstable_shouldYield, dc = ca.unstable_requestPaint, B = ca.unstable_now, ec = ca.unstable_getCurrentPriorityLevel, fc = ca.unstable_ImmediatePriority, gc = ca.unstable_UserBlockingPriority, hc = ca.unstable_NormalPriority, ic = ca.unstable_LowPriority, jc = ca.unstable_IdlePriority, kc = null, lc = null;
function mc(a) {
  if (lc && "function" === typeof lc.onCommitFiberRoot) try {
    lc.onCommitFiberRoot(kc, a, void 0, 128 === (a.current.flags & 128));
  } catch (b) {
  }
}
var oc = Math.clz32 ? Math.clz32 : nc, pc = Math.log, qc = Math.LN2;
function nc(a) {
  a >>>= 0;
  return 0 === a ? 32 : 31 - (pc(a) / qc | 0) | 0;
}
var rc = 64, sc = 4194304;
function tc(a) {
  switch (a & -a) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 4:
      return 4;
    case 8:
      return 8;
    case 16:
      return 16;
    case 32:
      return 32;
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return a & 4194240;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return a & 130023424;
    case 134217728:
      return 134217728;
    case 268435456:
      return 268435456;
    case 536870912:
      return 536870912;
    case 1073741824:
      return 1073741824;
    default:
      return a;
  }
}
function uc(a, b) {
  var c = a.pendingLanes;
  if (0 === c) return 0;
  var d = 0, e = a.suspendedLanes, f2 = a.pingedLanes, g = c & 268435455;
  if (0 !== g) {
    var h = g & ~e;
    0 !== h ? d = tc(h) : (f2 &= g, 0 !== f2 && (d = tc(f2)));
  } else g = c & ~e, 0 !== g ? d = tc(g) : 0 !== f2 && (d = tc(f2));
  if (0 === d) return 0;
  if (0 !== b && b !== d && 0 === (b & e) && (e = d & -d, f2 = b & -b, e >= f2 || 16 === e && 0 !== (f2 & 4194240))) return b;
  0 !== (d & 4) && (d |= c & 16);
  b = a.entangledLanes;
  if (0 !== b) for (a = a.entanglements, b &= d; 0 < b; ) c = 31 - oc(b), e = 1 << c, d |= a[c], b &= ~e;
  return d;
}
function vc(a, b) {
  switch (a) {
    case 1:
    case 2:
    case 4:
      return b + 250;
    case 8:
    case 16:
    case 32:
    case 64:
    case 128:
    case 256:
    case 512:
    case 1024:
    case 2048:
    case 4096:
    case 8192:
    case 16384:
    case 32768:
    case 65536:
    case 131072:
    case 262144:
    case 524288:
    case 1048576:
    case 2097152:
      return b + 5e3;
    case 4194304:
    case 8388608:
    case 16777216:
    case 33554432:
    case 67108864:
      return -1;
    case 134217728:
    case 268435456:
    case 536870912:
    case 1073741824:
      return -1;
    default:
      return -1;
  }
}
function wc(a, b) {
  for (var c = a.suspendedLanes, d = a.pingedLanes, e = a.expirationTimes, f2 = a.pendingLanes; 0 < f2; ) {
    var g = 31 - oc(f2), h = 1 << g, k = e[g];
    if (-1 === k) {
      if (0 === (h & c) || 0 !== (h & d)) e[g] = vc(h, b);
    } else k <= b && (a.expiredLanes |= h);
    f2 &= ~h;
  }
}
function xc(a) {
  a = a.pendingLanes & -1073741825;
  return 0 !== a ? a : a & 1073741824 ? 1073741824 : 0;
}
function yc() {
  var a = rc;
  rc <<= 1;
  0 === (rc & 4194240) && (rc = 64);
  return a;
}
function zc(a) {
  for (var b = [], c = 0; 31 > c; c++) b.push(a);
  return b;
}
function Ac(a, b, c) {
  a.pendingLanes |= b;
  536870912 !== b && (a.suspendedLanes = 0, a.pingedLanes = 0);
  a = a.eventTimes;
  b = 31 - oc(b);
  a[b] = c;
}
function Bc(a, b) {
  var c = a.pendingLanes & ~b;
  a.pendingLanes = b;
  a.suspendedLanes = 0;
  a.pingedLanes = 0;
  a.expiredLanes &= b;
  a.mutableReadLanes &= b;
  a.entangledLanes &= b;
  b = a.entanglements;
  var d = a.eventTimes;
  for (a = a.expirationTimes; 0 < c; ) {
    var e = 31 - oc(c), f2 = 1 << e;
    b[e] = 0;
    d[e] = -1;
    a[e] = -1;
    c &= ~f2;
  }
}
function Cc(a, b) {
  var c = a.entangledLanes |= b;
  for (a = a.entanglements; c; ) {
    var d = 31 - oc(c), e = 1 << d;
    e & b | a[d] & b && (a[d] |= b);
    c &= ~e;
  }
}
var C = 0;
function Dc(a) {
  a &= -a;
  return 1 < a ? 4 < a ? 0 !== (a & 268435455) ? 16 : 536870912 : 4 : 1;
}
var Ec, Fc, Gc, Hc, Ic, Jc = false, Kc = [], Lc = null, Mc = null, Nc = null, Oc = /* @__PURE__ */ new Map(), Pc = /* @__PURE__ */ new Map(), Qc = [], Rc = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");
function Sc(a, b) {
  switch (a) {
    case "focusin":
    case "focusout":
      Lc = null;
      break;
    case "dragenter":
    case "dragleave":
      Mc = null;
      break;
    case "mouseover":
    case "mouseout":
      Nc = null;
      break;
    case "pointerover":
    case "pointerout":
      Oc.delete(b.pointerId);
      break;
    case "gotpointercapture":
    case "lostpointercapture":
      Pc.delete(b.pointerId);
  }
}
function Tc(a, b, c, d, e, f2) {
  if (null === a || a.nativeEvent !== f2) return a = { blockedOn: b, domEventName: c, eventSystemFlags: d, nativeEvent: f2, targetContainers: [e] }, null !== b && (b = Cb(b), null !== b && Fc(b)), a;
  a.eventSystemFlags |= d;
  b = a.targetContainers;
  null !== e && -1 === b.indexOf(e) && b.push(e);
  return a;
}
function Uc(a, b, c, d, e) {
  switch (b) {
    case "focusin":
      return Lc = Tc(Lc, a, b, c, d, e), true;
    case "dragenter":
      return Mc = Tc(Mc, a, b, c, d, e), true;
    case "mouseover":
      return Nc = Tc(Nc, a, b, c, d, e), true;
    case "pointerover":
      var f2 = e.pointerId;
      Oc.set(f2, Tc(Oc.get(f2) || null, a, b, c, d, e));
      return true;
    case "gotpointercapture":
      return f2 = e.pointerId, Pc.set(f2, Tc(Pc.get(f2) || null, a, b, c, d, e)), true;
  }
  return false;
}
function Vc(a) {
  var b = Wc(a.target);
  if (null !== b) {
    var c = Vb(b);
    if (null !== c) {
      if (b = c.tag, 13 === b) {
        if (b = Wb(c), null !== b) {
          a.blockedOn = b;
          Ic(a.priority, function() {
            Gc(c);
          });
          return;
        }
      } else if (3 === b && c.stateNode.current.memoizedState.isDehydrated) {
        a.blockedOn = 3 === c.tag ? c.stateNode.containerInfo : null;
        return;
      }
    }
  }
  a.blockedOn = null;
}
function Xc(a) {
  if (null !== a.blockedOn) return false;
  for (var b = a.targetContainers; 0 < b.length; ) {
    var c = Yc(a.domEventName, a.eventSystemFlags, b[0], a.nativeEvent);
    if (null === c) {
      c = a.nativeEvent;
      var d = new c.constructor(c.type, c);
      wb = d;
      c.target.dispatchEvent(d);
      wb = null;
    } else return b = Cb(c), null !== b && Fc(b), a.blockedOn = c, false;
    b.shift();
  }
  return true;
}
function Zc(a, b, c) {
  Xc(a) && c.delete(b);
}
function $c() {
  Jc = false;
  null !== Lc && Xc(Lc) && (Lc = null);
  null !== Mc && Xc(Mc) && (Mc = null);
  null !== Nc && Xc(Nc) && (Nc = null);
  Oc.forEach(Zc);
  Pc.forEach(Zc);
}
function ad(a, b) {
  a.blockedOn === b && (a.blockedOn = null, Jc || (Jc = true, ca.unstable_scheduleCallback(ca.unstable_NormalPriority, $c)));
}
function bd(a) {
  function b(b2) {
    return ad(b2, a);
  }
  if (0 < Kc.length) {
    ad(Kc[0], a);
    for (var c = 1; c < Kc.length; c++) {
      var d = Kc[c];
      d.blockedOn === a && (d.blockedOn = null);
    }
  }
  null !== Lc && ad(Lc, a);
  null !== Mc && ad(Mc, a);
  null !== Nc && ad(Nc, a);
  Oc.forEach(b);
  Pc.forEach(b);
  for (c = 0; c < Qc.length; c++) d = Qc[c], d.blockedOn === a && (d.blockedOn = null);
  for (; 0 < Qc.length && (c = Qc[0], null === c.blockedOn); ) Vc(c), null === c.blockedOn && Qc.shift();
}
var cd = ua.ReactCurrentBatchConfig, dd = true;
function ed(a, b, c, d) {
  var e = C, f2 = cd.transition;
  cd.transition = null;
  try {
    C = 1, fd(a, b, c, d);
  } finally {
    C = e, cd.transition = f2;
  }
}
function gd(a, b, c, d) {
  var e = C, f2 = cd.transition;
  cd.transition = null;
  try {
    C = 4, fd(a, b, c, d);
  } finally {
    C = e, cd.transition = f2;
  }
}
function fd(a, b, c, d) {
  if (dd) {
    var e = Yc(a, b, c, d);
    if (null === e) hd(a, b, d, id, c), Sc(a, d);
    else if (Uc(e, a, b, c, d)) d.stopPropagation();
    else if (Sc(a, d), b & 4 && -1 < Rc.indexOf(a)) {
      for (; null !== e; ) {
        var f2 = Cb(e);
        null !== f2 && Ec(f2);
        f2 = Yc(a, b, c, d);
        null === f2 && hd(a, b, d, id, c);
        if (f2 === e) break;
        e = f2;
      }
      null !== e && d.stopPropagation();
    } else hd(a, b, d, null, c);
  }
}
var id = null;
function Yc(a, b, c, d) {
  id = null;
  a = xb(d);
  a = Wc(a);
  if (null !== a) if (b = Vb(a), null === b) a = null;
  else if (c = b.tag, 13 === c) {
    a = Wb(b);
    if (null !== a) return a;
    a = null;
  } else if (3 === c) {
    if (b.stateNode.current.memoizedState.isDehydrated) return 3 === b.tag ? b.stateNode.containerInfo : null;
    a = null;
  } else b !== a && (a = null);
  id = a;
  return null;
}
function jd(a) {
  switch (a) {
    case "cancel":
    case "click":
    case "close":
    case "contextmenu":
    case "copy":
    case "cut":
    case "auxclick":
    case "dblclick":
    case "dragend":
    case "dragstart":
    case "drop":
    case "focusin":
    case "focusout":
    case "input":
    case "invalid":
    case "keydown":
    case "keypress":
    case "keyup":
    case "mousedown":
    case "mouseup":
    case "paste":
    case "pause":
    case "play":
    case "pointercancel":
    case "pointerdown":
    case "pointerup":
    case "ratechange":
    case "reset":
    case "resize":
    case "seeked":
    case "submit":
    case "touchcancel":
    case "touchend":
    case "touchstart":
    case "volumechange":
    case "change":
    case "selectionchange":
    case "textInput":
    case "compositionstart":
    case "compositionend":
    case "compositionupdate":
    case "beforeblur":
    case "afterblur":
    case "beforeinput":
    case "blur":
    case "fullscreenchange":
    case "focus":
    case "hashchange":
    case "popstate":
    case "select":
    case "selectstart":
      return 1;
    case "drag":
    case "dragenter":
    case "dragexit":
    case "dragleave":
    case "dragover":
    case "mousemove":
    case "mouseout":
    case "mouseover":
    case "pointermove":
    case "pointerout":
    case "pointerover":
    case "scroll":
    case "toggle":
    case "touchmove":
    case "wheel":
    case "mouseenter":
    case "mouseleave":
    case "pointerenter":
    case "pointerleave":
      return 4;
    case "message":
      switch (ec()) {
        case fc:
          return 1;
        case gc:
          return 4;
        case hc:
        case ic:
          return 16;
        case jc:
          return 536870912;
        default:
          return 16;
      }
    default:
      return 16;
  }
}
var kd = null, ld = null, md = null;
function nd() {
  if (md) return md;
  var a, b = ld, c = b.length, d, e = "value" in kd ? kd.value : kd.textContent, f2 = e.length;
  for (a = 0; a < c && b[a] === e[a]; a++) ;
  var g = c - a;
  for (d = 1; d <= g && b[c - d] === e[f2 - d]; d++) ;
  return md = e.slice(a, 1 < d ? 1 - d : void 0);
}
function od(a) {
  var b = a.keyCode;
  "charCode" in a ? (a = a.charCode, 0 === a && 13 === b && (a = 13)) : a = b;
  10 === a && (a = 13);
  return 32 <= a || 13 === a ? a : 0;
}
function pd() {
  return true;
}
function qd() {
  return false;
}
function rd(a) {
  function b(b2, d, e, f2, g) {
    this._reactName = b2;
    this._targetInst = e;
    this.type = d;
    this.nativeEvent = f2;
    this.target = g;
    this.currentTarget = null;
    for (var c in a) a.hasOwnProperty(c) && (b2 = a[c], this[c] = b2 ? b2(f2) : f2[c]);
    this.isDefaultPrevented = (null != f2.defaultPrevented ? f2.defaultPrevented : false === f2.returnValue) ? pd : qd;
    this.isPropagationStopped = qd;
    return this;
  }
  A(b.prototype, { preventDefault: function() {
    this.defaultPrevented = true;
    var a2 = this.nativeEvent;
    a2 && (a2.preventDefault ? a2.preventDefault() : "unknown" !== typeof a2.returnValue && (a2.returnValue = false), this.isDefaultPrevented = pd);
  }, stopPropagation: function() {
    var a2 = this.nativeEvent;
    a2 && (a2.stopPropagation ? a2.stopPropagation() : "unknown" !== typeof a2.cancelBubble && (a2.cancelBubble = true), this.isPropagationStopped = pd);
  }, persist: function() {
  }, isPersistent: pd });
  return b;
}
var sd = { eventPhase: 0, bubbles: 0, cancelable: 0, timeStamp: function(a) {
  return a.timeStamp || Date.now();
}, defaultPrevented: 0, isTrusted: 0 }, td = rd(sd), ud = A({}, sd, { view: 0, detail: 0 }), vd = rd(ud), wd, xd, yd, Ad = A({}, ud, { screenX: 0, screenY: 0, clientX: 0, clientY: 0, pageX: 0, pageY: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, getModifierState: zd, button: 0, buttons: 0, relatedTarget: function(a) {
  return void 0 === a.relatedTarget ? a.fromElement === a.srcElement ? a.toElement : a.fromElement : a.relatedTarget;
}, movementX: function(a) {
  if ("movementX" in a) return a.movementX;
  a !== yd && (yd && "mousemove" === a.type ? (wd = a.screenX - yd.screenX, xd = a.screenY - yd.screenY) : xd = wd = 0, yd = a);
  return wd;
}, movementY: function(a) {
  return "movementY" in a ? a.movementY : xd;
} }), Bd = rd(Ad), Cd = A({}, Ad, { dataTransfer: 0 }), Dd = rd(Cd), Ed = A({}, ud, { relatedTarget: 0 }), Fd = rd(Ed), Gd = A({}, sd, { animationName: 0, elapsedTime: 0, pseudoElement: 0 }), Hd = rd(Gd), Id = A({}, sd, { clipboardData: function(a) {
  return "clipboardData" in a ? a.clipboardData : window.clipboardData;
} }), Jd = rd(Id), Kd = A({}, sd, { data: 0 }), Ld = rd(Kd), Md = {
  Esc: "Escape",
  Spacebar: " ",
  Left: "ArrowLeft",
  Up: "ArrowUp",
  Right: "ArrowRight",
  Down: "ArrowDown",
  Del: "Delete",
  Win: "OS",
  Menu: "ContextMenu",
  Apps: "ContextMenu",
  Scroll: "ScrollLock",
  MozPrintableKey: "Unidentified"
}, Nd = {
  8: "Backspace",
  9: "Tab",
  12: "Clear",
  13: "Enter",
  16: "Shift",
  17: "Control",
  18: "Alt",
  19: "Pause",
  20: "CapsLock",
  27: "Escape",
  32: " ",
  33: "PageUp",
  34: "PageDown",
  35: "End",
  36: "Home",
  37: "ArrowLeft",
  38: "ArrowUp",
  39: "ArrowRight",
  40: "ArrowDown",
  45: "Insert",
  46: "Delete",
  112: "F1",
  113: "F2",
  114: "F3",
  115: "F4",
  116: "F5",
  117: "F6",
  118: "F7",
  119: "F8",
  120: "F9",
  121: "F10",
  122: "F11",
  123: "F12",
  144: "NumLock",
  145: "ScrollLock",
  224: "Meta"
}, Od = { Alt: "altKey", Control: "ctrlKey", Meta: "metaKey", Shift: "shiftKey" };
function Pd(a) {
  var b = this.nativeEvent;
  return b.getModifierState ? b.getModifierState(a) : (a = Od[a]) ? !!b[a] : false;
}
function zd() {
  return Pd;
}
var Qd = A({}, ud, { key: function(a) {
  if (a.key) {
    var b = Md[a.key] || a.key;
    if ("Unidentified" !== b) return b;
  }
  return "keypress" === a.type ? (a = od(a), 13 === a ? "Enter" : String.fromCharCode(a)) : "keydown" === a.type || "keyup" === a.type ? Nd[a.keyCode] || "Unidentified" : "";
}, code: 0, location: 0, ctrlKey: 0, shiftKey: 0, altKey: 0, metaKey: 0, repeat: 0, locale: 0, getModifierState: zd, charCode: function(a) {
  return "keypress" === a.type ? od(a) : 0;
}, keyCode: function(a) {
  return "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
}, which: function(a) {
  return "keypress" === a.type ? od(a) : "keydown" === a.type || "keyup" === a.type ? a.keyCode : 0;
} }), Rd = rd(Qd), Sd = A({}, Ad, { pointerId: 0, width: 0, height: 0, pressure: 0, tangentialPressure: 0, tiltX: 0, tiltY: 0, twist: 0, pointerType: 0, isPrimary: 0 }), Td = rd(Sd), Ud = A({}, ud, { touches: 0, targetTouches: 0, changedTouches: 0, altKey: 0, metaKey: 0, ctrlKey: 0, shiftKey: 0, getModifierState: zd }), Vd = rd(Ud), Wd = A({}, sd, { propertyName: 0, elapsedTime: 0, pseudoElement: 0 }), Xd = rd(Wd), Yd = A({}, Ad, {
  deltaX: function(a) {
    return "deltaX" in a ? a.deltaX : "wheelDeltaX" in a ? -a.wheelDeltaX : 0;
  },
  deltaY: function(a) {
    return "deltaY" in a ? a.deltaY : "wheelDeltaY" in a ? -a.wheelDeltaY : "wheelDelta" in a ? -a.wheelDelta : 0;
  },
  deltaZ: 0,
  deltaMode: 0
}), Zd = rd(Yd), $d = [9, 13, 27, 32], ae = ia && "CompositionEvent" in window, be = null;
ia && "documentMode" in document && (be = document.documentMode);
var ce = ia && "TextEvent" in window && !be, de = ia && (!ae || be && 8 < be && 11 >= be), ee = String.fromCharCode(32), fe = false;
function ge(a, b) {
  switch (a) {
    case "keyup":
      return -1 !== $d.indexOf(b.keyCode);
    case "keydown":
      return 229 !== b.keyCode;
    case "keypress":
    case "mousedown":
    case "focusout":
      return true;
    default:
      return false;
  }
}
function he(a) {
  a = a.detail;
  return "object" === typeof a && "data" in a ? a.data : null;
}
var ie = false;
function je(a, b) {
  switch (a) {
    case "compositionend":
      return he(b);
    case "keypress":
      if (32 !== b.which) return null;
      fe = true;
      return ee;
    case "textInput":
      return a = b.data, a === ee && fe ? null : a;
    default:
      return null;
  }
}
function ke(a, b) {
  if (ie) return "compositionend" === a || !ae && ge(a, b) ? (a = nd(), md = ld = kd = null, ie = false, a) : null;
  switch (a) {
    case "paste":
      return null;
    case "keypress":
      if (!(b.ctrlKey || b.altKey || b.metaKey) || b.ctrlKey && b.altKey) {
        if (b.char && 1 < b.char.length) return b.char;
        if (b.which) return String.fromCharCode(b.which);
      }
      return null;
    case "compositionend":
      return de && "ko" !== b.locale ? null : b.data;
    default:
      return null;
  }
}
var le = { color: true, date: true, datetime: true, "datetime-local": true, email: true, month: true, number: true, password: true, range: true, search: true, tel: true, text: true, time: true, url: true, week: true };
function me(a) {
  var b = a && a.nodeName && a.nodeName.toLowerCase();
  return "input" === b ? !!le[a.type] : "textarea" === b ? true : false;
}
function ne(a, b, c, d) {
  Eb(d);
  b = oe(b, "onChange");
  0 < b.length && (c = new td("onChange", "change", null, c, d), a.push({ event: c, listeners: b }));
}
var pe = null, qe = null;
function re(a) {
  se(a, 0);
}
function te(a) {
  var b = ue(a);
  if (Wa(b)) return a;
}
function ve(a, b) {
  if ("change" === a) return b;
}
var we = false;
if (ia) {
  var xe;
  if (ia) {
    var ye = "oninput" in document;
    if (!ye) {
      var ze = document.createElement("div");
      ze.setAttribute("oninput", "return;");
      ye = "function" === typeof ze.oninput;
    }
    xe = ye;
  } else xe = false;
  we = xe && (!document.documentMode || 9 < document.documentMode);
}
function Ae() {
  pe && (pe.detachEvent("onpropertychange", Be), qe = pe = null);
}
function Be(a) {
  if ("value" === a.propertyName && te(qe)) {
    var b = [];
    ne(b, qe, a, xb(a));
    Jb(re, b);
  }
}
function Ce(a, b, c) {
  "focusin" === a ? (Ae(), pe = b, qe = c, pe.attachEvent("onpropertychange", Be)) : "focusout" === a && Ae();
}
function De(a) {
  if ("selectionchange" === a || "keyup" === a || "keydown" === a) return te(qe);
}
function Ee(a, b) {
  if ("click" === a) return te(b);
}
function Fe(a, b) {
  if ("input" === a || "change" === a) return te(b);
}
function Ge(a, b) {
  return a === b && (0 !== a || 1 / a === 1 / b) || a !== a && b !== b;
}
var He = "function" === typeof Object.is ? Object.is : Ge;
function Ie(a, b) {
  if (He(a, b)) return true;
  if ("object" !== typeof a || null === a || "object" !== typeof b || null === b) return false;
  var c = Object.keys(a), d = Object.keys(b);
  if (c.length !== d.length) return false;
  for (d = 0; d < c.length; d++) {
    var e = c[d];
    if (!ja.call(b, e) || !He(a[e], b[e])) return false;
  }
  return true;
}
function Je(a) {
  for (; a && a.firstChild; ) a = a.firstChild;
  return a;
}
function Ke(a, b) {
  var c = Je(a);
  a = 0;
  for (var d; c; ) {
    if (3 === c.nodeType) {
      d = a + c.textContent.length;
      if (a <= b && d >= b) return { node: c, offset: b - a };
      a = d;
    }
    a: {
      for (; c; ) {
        if (c.nextSibling) {
          c = c.nextSibling;
          break a;
        }
        c = c.parentNode;
      }
      c = void 0;
    }
    c = Je(c);
  }
}
function Le(a, b) {
  return a && b ? a === b ? true : a && 3 === a.nodeType ? false : b && 3 === b.nodeType ? Le(a, b.parentNode) : "contains" in a ? a.contains(b) : a.compareDocumentPosition ? !!(a.compareDocumentPosition(b) & 16) : false : false;
}
function Me() {
  for (var a = window, b = Xa(); b instanceof a.HTMLIFrameElement; ) {
    try {
      var c = "string" === typeof b.contentWindow.location.href;
    } catch (d) {
      c = false;
    }
    if (c) a = b.contentWindow;
    else break;
    b = Xa(a.document);
  }
  return b;
}
function Ne(a) {
  var b = a && a.nodeName && a.nodeName.toLowerCase();
  return b && ("input" === b && ("text" === a.type || "search" === a.type || "tel" === a.type || "url" === a.type || "password" === a.type) || "textarea" === b || "true" === a.contentEditable);
}
function Oe(a) {
  var b = Me(), c = a.focusedElem, d = a.selectionRange;
  if (b !== c && c && c.ownerDocument && Le(c.ownerDocument.documentElement, c)) {
    if (null !== d && Ne(c)) {
      if (b = d.start, a = d.end, void 0 === a && (a = b), "selectionStart" in c) c.selectionStart = b, c.selectionEnd = Math.min(a, c.value.length);
      else if (a = (b = c.ownerDocument || document) && b.defaultView || window, a.getSelection) {
        a = a.getSelection();
        var e = c.textContent.length, f2 = Math.min(d.start, e);
        d = void 0 === d.end ? f2 : Math.min(d.end, e);
        !a.extend && f2 > d && (e = d, d = f2, f2 = e);
        e = Ke(c, f2);
        var g = Ke(
          c,
          d
        );
        e && g && (1 !== a.rangeCount || a.anchorNode !== e.node || a.anchorOffset !== e.offset || a.focusNode !== g.node || a.focusOffset !== g.offset) && (b = b.createRange(), b.setStart(e.node, e.offset), a.removeAllRanges(), f2 > d ? (a.addRange(b), a.extend(g.node, g.offset)) : (b.setEnd(g.node, g.offset), a.addRange(b)));
      }
    }
    b = [];
    for (a = c; a = a.parentNode; ) 1 === a.nodeType && b.push({ element: a, left: a.scrollLeft, top: a.scrollTop });
    "function" === typeof c.focus && c.focus();
    for (c = 0; c < b.length; c++) a = b[c], a.element.scrollLeft = a.left, a.element.scrollTop = a.top;
  }
}
var Pe = ia && "documentMode" in document && 11 >= document.documentMode, Qe = null, Re = null, Se = null, Te = false;
function Ue(a, b, c) {
  var d = c.window === c ? c.document : 9 === c.nodeType ? c : c.ownerDocument;
  Te || null == Qe || Qe !== Xa(d) || (d = Qe, "selectionStart" in d && Ne(d) ? d = { start: d.selectionStart, end: d.selectionEnd } : (d = (d.ownerDocument && d.ownerDocument.defaultView || window).getSelection(), d = { anchorNode: d.anchorNode, anchorOffset: d.anchorOffset, focusNode: d.focusNode, focusOffset: d.focusOffset }), Se && Ie(Se, d) || (Se = d, d = oe(Re, "onSelect"), 0 < d.length && (b = new td("onSelect", "select", null, b, c), a.push({ event: b, listeners: d }), b.target = Qe)));
}
function Ve(a, b) {
  var c = {};
  c[a.toLowerCase()] = b.toLowerCase();
  c["Webkit" + a] = "webkit" + b;
  c["Moz" + a] = "moz" + b;
  return c;
}
var We = { animationend: Ve("Animation", "AnimationEnd"), animationiteration: Ve("Animation", "AnimationIteration"), animationstart: Ve("Animation", "AnimationStart"), transitionend: Ve("Transition", "TransitionEnd") }, Xe = {}, Ye = {};
ia && (Ye = document.createElement("div").style, "AnimationEvent" in window || (delete We.animationend.animation, delete We.animationiteration.animation, delete We.animationstart.animation), "TransitionEvent" in window || delete We.transitionend.transition);
function Ze(a) {
  if (Xe[a]) return Xe[a];
  if (!We[a]) return a;
  var b = We[a], c;
  for (c in b) if (b.hasOwnProperty(c) && c in Ye) return Xe[a] = b[c];
  return a;
}
var $e = Ze("animationend"), af = Ze("animationiteration"), bf = Ze("animationstart"), cf = Ze("transitionend"), df = /* @__PURE__ */ new Map(), ef = "abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
function ff(a, b) {
  df.set(a, b);
  fa(b, [a]);
}
for (var gf = 0; gf < ef.length; gf++) {
  var hf = ef[gf], jf = hf.toLowerCase(), kf = hf[0].toUpperCase() + hf.slice(1);
  ff(jf, "on" + kf);
}
ff($e, "onAnimationEnd");
ff(af, "onAnimationIteration");
ff(bf, "onAnimationStart");
ff("dblclick", "onDoubleClick");
ff("focusin", "onFocus");
ff("focusout", "onBlur");
ff(cf, "onTransitionEnd");
ha("onMouseEnter", ["mouseout", "mouseover"]);
ha("onMouseLeave", ["mouseout", "mouseover"]);
ha("onPointerEnter", ["pointerout", "pointerover"]);
ha("onPointerLeave", ["pointerout", "pointerover"]);
fa("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" "));
fa("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));
fa("onBeforeInput", ["compositionend", "keypress", "textInput", "paste"]);
fa("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" "));
fa("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" "));
fa("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
var lf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), mf = new Set("cancel close invalid load scroll toggle".split(" ").concat(lf));
function nf(a, b, c) {
  var d = a.type || "unknown-event";
  a.currentTarget = c;
  Ub(d, b, void 0, a);
  a.currentTarget = null;
}
function se(a, b) {
  b = 0 !== (b & 4);
  for (var c = 0; c < a.length; c++) {
    var d = a[c], e = d.event;
    d = d.listeners;
    a: {
      var f2 = void 0;
      if (b) for (var g = d.length - 1; 0 <= g; g--) {
        var h = d[g], k = h.instance, l2 = h.currentTarget;
        h = h.listener;
        if (k !== f2 && e.isPropagationStopped()) break a;
        nf(e, h, l2);
        f2 = k;
      }
      else for (g = 0; g < d.length; g++) {
        h = d[g];
        k = h.instance;
        l2 = h.currentTarget;
        h = h.listener;
        if (k !== f2 && e.isPropagationStopped()) break a;
        nf(e, h, l2);
        f2 = k;
      }
    }
  }
  if (Qb) throw a = Rb, Qb = false, Rb = null, a;
}
function D(a, b) {
  var c = b[of];
  void 0 === c && (c = b[of] = /* @__PURE__ */ new Set());
  var d = a + "__bubble";
  c.has(d) || (pf(b, a, 2, false), c.add(d));
}
function qf(a, b, c) {
  var d = 0;
  b && (d |= 4);
  pf(c, a, d, b);
}
var rf = "_reactListening" + Math.random().toString(36).slice(2);
function sf(a) {
  if (!a[rf]) {
    a[rf] = true;
    da.forEach(function(b2) {
      "selectionchange" !== b2 && (mf.has(b2) || qf(b2, false, a), qf(b2, true, a));
    });
    var b = 9 === a.nodeType ? a : a.ownerDocument;
    null === b || b[rf] || (b[rf] = true, qf("selectionchange", false, b));
  }
}
function pf(a, b, c, d) {
  switch (jd(b)) {
    case 1:
      var e = ed;
      break;
    case 4:
      e = gd;
      break;
    default:
      e = fd;
  }
  c = e.bind(null, b, c, a);
  e = void 0;
  !Lb || "touchstart" !== b && "touchmove" !== b && "wheel" !== b || (e = true);
  d ? void 0 !== e ? a.addEventListener(b, c, { capture: true, passive: e }) : a.addEventListener(b, c, true) : void 0 !== e ? a.addEventListener(b, c, { passive: e }) : a.addEventListener(b, c, false);
}
function hd(a, b, c, d, e) {
  var f2 = d;
  if (0 === (b & 1) && 0 === (b & 2) && null !== d) a: for (; ; ) {
    if (null === d) return;
    var g = d.tag;
    if (3 === g || 4 === g) {
      var h = d.stateNode.containerInfo;
      if (h === e || 8 === h.nodeType && h.parentNode === e) break;
      if (4 === g) for (g = d.return; null !== g; ) {
        var k = g.tag;
        if (3 === k || 4 === k) {
          if (k = g.stateNode.containerInfo, k === e || 8 === k.nodeType && k.parentNode === e) return;
        }
        g = g.return;
      }
      for (; null !== h; ) {
        g = Wc(h);
        if (null === g) return;
        k = g.tag;
        if (5 === k || 6 === k) {
          d = f2 = g;
          continue a;
        }
        h = h.parentNode;
      }
    }
    d = d.return;
  }
  Jb(function() {
    var d2 = f2, e2 = xb(c), g2 = [];
    a: {
      var h2 = df.get(a);
      if (void 0 !== h2) {
        var k2 = td, n2 = a;
        switch (a) {
          case "keypress":
            if (0 === od(c)) break a;
          case "keydown":
          case "keyup":
            k2 = Rd;
            break;
          case "focusin":
            n2 = "focus";
            k2 = Fd;
            break;
          case "focusout":
            n2 = "blur";
            k2 = Fd;
            break;
          case "beforeblur":
          case "afterblur":
            k2 = Fd;
            break;
          case "click":
            if (2 === c.button) break a;
          case "auxclick":
          case "dblclick":
          case "mousedown":
          case "mousemove":
          case "mouseup":
          case "mouseout":
          case "mouseover":
          case "contextmenu":
            k2 = Bd;
            break;
          case "drag":
          case "dragend":
          case "dragenter":
          case "dragexit":
          case "dragleave":
          case "dragover":
          case "dragstart":
          case "drop":
            k2 = Dd;
            break;
          case "touchcancel":
          case "touchend":
          case "touchmove":
          case "touchstart":
            k2 = Vd;
            break;
          case $e:
          case af:
          case bf:
            k2 = Hd;
            break;
          case cf:
            k2 = Xd;
            break;
          case "scroll":
            k2 = vd;
            break;
          case "wheel":
            k2 = Zd;
            break;
          case "copy":
          case "cut":
          case "paste":
            k2 = Jd;
            break;
          case "gotpointercapture":
          case "lostpointercapture":
          case "pointercancel":
          case "pointerdown":
          case "pointermove":
          case "pointerout":
          case "pointerover":
          case "pointerup":
            k2 = Td;
        }
        var t2 = 0 !== (b & 4), J2 = !t2 && "scroll" === a, x2 = t2 ? null !== h2 ? h2 + "Capture" : null : h2;
        t2 = [];
        for (var w2 = d2, u2; null !== w2; ) {
          u2 = w2;
          var F2 = u2.stateNode;
          5 === u2.tag && null !== F2 && (u2 = F2, null !== x2 && (F2 = Kb(w2, x2), null != F2 && t2.push(tf(w2, F2, u2))));
          if (J2) break;
          w2 = w2.return;
        }
        0 < t2.length && (h2 = new k2(h2, n2, null, c, e2), g2.push({ event: h2, listeners: t2 }));
      }
    }
    if (0 === (b & 7)) {
      a: {
        h2 = "mouseover" === a || "pointerover" === a;
        k2 = "mouseout" === a || "pointerout" === a;
        if (h2 && c !== wb && (n2 = c.relatedTarget || c.fromElement) && (Wc(n2) || n2[uf])) break a;
        if (k2 || h2) {
          h2 = e2.window === e2 ? e2 : (h2 = e2.ownerDocument) ? h2.defaultView || h2.parentWindow : window;
          if (k2) {
            if (n2 = c.relatedTarget || c.toElement, k2 = d2, n2 = n2 ? Wc(n2) : null, null !== n2 && (J2 = Vb(n2), n2 !== J2 || 5 !== n2.tag && 6 !== n2.tag)) n2 = null;
          } else k2 = null, n2 = d2;
          if (k2 !== n2) {
            t2 = Bd;
            F2 = "onMouseLeave";
            x2 = "onMouseEnter";
            w2 = "mouse";
            if ("pointerout" === a || "pointerover" === a) t2 = Td, F2 = "onPointerLeave", x2 = "onPointerEnter", w2 = "pointer";
            J2 = null == k2 ? h2 : ue(k2);
            u2 = null == n2 ? h2 : ue(n2);
            h2 = new t2(F2, w2 + "leave", k2, c, e2);
            h2.target = J2;
            h2.relatedTarget = u2;
            F2 = null;
            Wc(e2) === d2 && (t2 = new t2(x2, w2 + "enter", n2, c, e2), t2.target = u2, t2.relatedTarget = J2, F2 = t2);
            J2 = F2;
            if (k2 && n2) b: {
              t2 = k2;
              x2 = n2;
              w2 = 0;
              for (u2 = t2; u2; u2 = vf(u2)) w2++;
              u2 = 0;
              for (F2 = x2; F2; F2 = vf(F2)) u2++;
              for (; 0 < w2 - u2; ) t2 = vf(t2), w2--;
              for (; 0 < u2 - w2; ) x2 = vf(x2), u2--;
              for (; w2--; ) {
                if (t2 === x2 || null !== x2 && t2 === x2.alternate) break b;
                t2 = vf(t2);
                x2 = vf(x2);
              }
              t2 = null;
            }
            else t2 = null;
            null !== k2 && wf(g2, h2, k2, t2, false);
            null !== n2 && null !== J2 && wf(g2, J2, n2, t2, true);
          }
        }
      }
      a: {
        h2 = d2 ? ue(d2) : window;
        k2 = h2.nodeName && h2.nodeName.toLowerCase();
        if ("select" === k2 || "input" === k2 && "file" === h2.type) var na = ve;
        else if (me(h2)) if (we) na = Fe;
        else {
          na = De;
          var xa = Ce;
        }
        else (k2 = h2.nodeName) && "input" === k2.toLowerCase() && ("checkbox" === h2.type || "radio" === h2.type) && (na = Ee);
        if (na && (na = na(a, d2))) {
          ne(g2, na, c, e2);
          break a;
        }
        xa && xa(a, h2, d2);
        "focusout" === a && (xa = h2._wrapperState) && xa.controlled && "number" === h2.type && cb(h2, "number", h2.value);
      }
      xa = d2 ? ue(d2) : window;
      switch (a) {
        case "focusin":
          if (me(xa) || "true" === xa.contentEditable) Qe = xa, Re = d2, Se = null;
          break;
        case "focusout":
          Se = Re = Qe = null;
          break;
        case "mousedown":
          Te = true;
          break;
        case "contextmenu":
        case "mouseup":
        case "dragend":
          Te = false;
          Ue(g2, c, e2);
          break;
        case "selectionchange":
          if (Pe) break;
        case "keydown":
        case "keyup":
          Ue(g2, c, e2);
      }
      var $a;
      if (ae) b: {
        switch (a) {
          case "compositionstart":
            var ba = "onCompositionStart";
            break b;
          case "compositionend":
            ba = "onCompositionEnd";
            break b;
          case "compositionupdate":
            ba = "onCompositionUpdate";
            break b;
        }
        ba = void 0;
      }
      else ie ? ge(a, c) && (ba = "onCompositionEnd") : "keydown" === a && 229 === c.keyCode && (ba = "onCompositionStart");
      ba && (de && "ko" !== c.locale && (ie || "onCompositionStart" !== ba ? "onCompositionEnd" === ba && ie && ($a = nd()) : (kd = e2, ld = "value" in kd ? kd.value : kd.textContent, ie = true)), xa = oe(d2, ba), 0 < xa.length && (ba = new Ld(ba, a, null, c, e2), g2.push({ event: ba, listeners: xa }), $a ? ba.data = $a : ($a = he(c), null !== $a && (ba.data = $a))));
      if ($a = ce ? je(a, c) : ke(a, c)) d2 = oe(d2, "onBeforeInput"), 0 < d2.length && (e2 = new Ld("onBeforeInput", "beforeinput", null, c, e2), g2.push({ event: e2, listeners: d2 }), e2.data = $a);
    }
    se(g2, b);
  });
}
function tf(a, b, c) {
  return { instance: a, listener: b, currentTarget: c };
}
function oe(a, b) {
  for (var c = b + "Capture", d = []; null !== a; ) {
    var e = a, f2 = e.stateNode;
    5 === e.tag && null !== f2 && (e = f2, f2 = Kb(a, c), null != f2 && d.unshift(tf(a, f2, e)), f2 = Kb(a, b), null != f2 && d.push(tf(a, f2, e)));
    a = a.return;
  }
  return d;
}
function vf(a) {
  if (null === a) return null;
  do
    a = a.return;
  while (a && 5 !== a.tag);
  return a ? a : null;
}
function wf(a, b, c, d, e) {
  for (var f2 = b._reactName, g = []; null !== c && c !== d; ) {
    var h = c, k = h.alternate, l2 = h.stateNode;
    if (null !== k && k === d) break;
    5 === h.tag && null !== l2 && (h = l2, e ? (k = Kb(c, f2), null != k && g.unshift(tf(c, k, h))) : e || (k = Kb(c, f2), null != k && g.push(tf(c, k, h))));
    c = c.return;
  }
  0 !== g.length && a.push({ event: b, listeners: g });
}
var xf = /\r\n?/g, yf = /\u0000|\uFFFD/g;
function zf(a) {
  return ("string" === typeof a ? a : "" + a).replace(xf, "\n").replace(yf, "");
}
function Af(a, b, c) {
  b = zf(b);
  if (zf(a) !== b && c) throw Error(p(425));
}
function Bf() {
}
var Cf = null, Df = null;
function Ef(a, b) {
  return "textarea" === a || "noscript" === a || "string" === typeof b.children || "number" === typeof b.children || "object" === typeof b.dangerouslySetInnerHTML && null !== b.dangerouslySetInnerHTML && null != b.dangerouslySetInnerHTML.__html;
}
var Ff = "function" === typeof setTimeout ? setTimeout : void 0, Gf = "function" === typeof clearTimeout ? clearTimeout : void 0, Hf = "function" === typeof Promise ? Promise : void 0, Jf = "function" === typeof queueMicrotask ? queueMicrotask : "undefined" !== typeof Hf ? function(a) {
  return Hf.resolve(null).then(a).catch(If);
} : Ff;
function If(a) {
  setTimeout(function() {
    throw a;
  });
}
function Kf(a, b) {
  var c = b, d = 0;
  do {
    var e = c.nextSibling;
    a.removeChild(c);
    if (e && 8 === e.nodeType) if (c = e.data, "/$" === c) {
      if (0 === d) {
        a.removeChild(e);
        bd(b);
        return;
      }
      d--;
    } else "$" !== c && "$?" !== c && "$!" !== c || d++;
    c = e;
  } while (c);
  bd(b);
}
function Lf(a) {
  for (; null != a; a = a.nextSibling) {
    var b = a.nodeType;
    if (1 === b || 3 === b) break;
    if (8 === b) {
      b = a.data;
      if ("$" === b || "$!" === b || "$?" === b) break;
      if ("/$" === b) return null;
    }
  }
  return a;
}
function Mf(a) {
  a = a.previousSibling;
  for (var b = 0; a; ) {
    if (8 === a.nodeType) {
      var c = a.data;
      if ("$" === c || "$!" === c || "$?" === c) {
        if (0 === b) return a;
        b--;
      } else "/$" === c && b++;
    }
    a = a.previousSibling;
  }
  return null;
}
var Nf = Math.random().toString(36).slice(2), Of = "__reactFiber$" + Nf, Pf = "__reactProps$" + Nf, uf = "__reactContainer$" + Nf, of = "__reactEvents$" + Nf, Qf = "__reactListeners$" + Nf, Rf = "__reactHandles$" + Nf;
function Wc(a) {
  var b = a[Of];
  if (b) return b;
  for (var c = a.parentNode; c; ) {
    if (b = c[uf] || c[Of]) {
      c = b.alternate;
      if (null !== b.child || null !== c && null !== c.child) for (a = Mf(a); null !== a; ) {
        if (c = a[Of]) return c;
        a = Mf(a);
      }
      return b;
    }
    a = c;
    c = a.parentNode;
  }
  return null;
}
function Cb(a) {
  a = a[Of] || a[uf];
  return !a || 5 !== a.tag && 6 !== a.tag && 13 !== a.tag && 3 !== a.tag ? null : a;
}
function ue(a) {
  if (5 === a.tag || 6 === a.tag) return a.stateNode;
  throw Error(p(33));
}
function Db(a) {
  return a[Pf] || null;
}
var Sf = [], Tf = -1;
function Uf(a) {
  return { current: a };
}
function E(a) {
  0 > Tf || (a.current = Sf[Tf], Sf[Tf] = null, Tf--);
}
function G(a, b) {
  Tf++;
  Sf[Tf] = a.current;
  a.current = b;
}
var Vf = {}, H = Uf(Vf), Wf = Uf(false), Xf = Vf;
function Yf(a, b) {
  var c = a.type.contextTypes;
  if (!c) return Vf;
  var d = a.stateNode;
  if (d && d.__reactInternalMemoizedUnmaskedChildContext === b) return d.__reactInternalMemoizedMaskedChildContext;
  var e = {}, f2;
  for (f2 in c) e[f2] = b[f2];
  d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = b, a.__reactInternalMemoizedMaskedChildContext = e);
  return e;
}
function Zf(a) {
  a = a.childContextTypes;
  return null !== a && void 0 !== a;
}
function $f() {
  E(Wf);
  E(H);
}
function ag(a, b, c) {
  if (H.current !== Vf) throw Error(p(168));
  G(H, b);
  G(Wf, c);
}
function bg(a, b, c) {
  var d = a.stateNode;
  b = b.childContextTypes;
  if ("function" !== typeof d.getChildContext) return c;
  d = d.getChildContext();
  for (var e in d) if (!(e in b)) throw Error(p(108, Ra(a) || "Unknown", e));
  return A({}, c, d);
}
function cg(a) {
  a = (a = a.stateNode) && a.__reactInternalMemoizedMergedChildContext || Vf;
  Xf = H.current;
  G(H, a);
  G(Wf, Wf.current);
  return true;
}
function dg(a, b, c) {
  var d = a.stateNode;
  if (!d) throw Error(p(169));
  c ? (a = bg(a, b, Xf), d.__reactInternalMemoizedMergedChildContext = a, E(Wf), E(H), G(H, a)) : E(Wf);
  G(Wf, c);
}
var eg = null, fg = false, gg = false;
function hg(a) {
  null === eg ? eg = [a] : eg.push(a);
}
function ig(a) {
  fg = true;
  hg(a);
}
function jg() {
  if (!gg && null !== eg) {
    gg = true;
    var a = 0, b = C;
    try {
      var c = eg;
      for (C = 1; a < c.length; a++) {
        var d = c[a];
        do
          d = d(true);
        while (null !== d);
      }
      eg = null;
      fg = false;
    } catch (e) {
      throw null !== eg && (eg = eg.slice(a + 1)), ac(fc, jg), e;
    } finally {
      C = b, gg = false;
    }
  }
  return null;
}
var kg = [], lg = 0, mg = null, ng = 0, og = [], pg = 0, qg = null, rg = 1, sg = "";
function tg(a, b) {
  kg[lg++] = ng;
  kg[lg++] = mg;
  mg = a;
  ng = b;
}
function ug(a, b, c) {
  og[pg++] = rg;
  og[pg++] = sg;
  og[pg++] = qg;
  qg = a;
  var d = rg;
  a = sg;
  var e = 32 - oc(d) - 1;
  d &= ~(1 << e);
  c += 1;
  var f2 = 32 - oc(b) + e;
  if (30 < f2) {
    var g = e - e % 5;
    f2 = (d & (1 << g) - 1).toString(32);
    d >>= g;
    e -= g;
    rg = 1 << 32 - oc(b) + e | c << e | d;
    sg = f2 + a;
  } else rg = 1 << f2 | c << e | d, sg = a;
}
function vg(a) {
  null !== a.return && (tg(a, 1), ug(a, 1, 0));
}
function wg(a) {
  for (; a === mg; ) mg = kg[--lg], kg[lg] = null, ng = kg[--lg], kg[lg] = null;
  for (; a === qg; ) qg = og[--pg], og[pg] = null, sg = og[--pg], og[pg] = null, rg = og[--pg], og[pg] = null;
}
var xg = null, yg = null, I = false, zg = null;
function Ag(a, b) {
  var c = Bg(5, null, null, 0);
  c.elementType = "DELETED";
  c.stateNode = b;
  c.return = a;
  b = a.deletions;
  null === b ? (a.deletions = [c], a.flags |= 16) : b.push(c);
}
function Cg(a, b) {
  switch (a.tag) {
    case 5:
      var c = a.type;
      b = 1 !== b.nodeType || c.toLowerCase() !== b.nodeName.toLowerCase() ? null : b;
      return null !== b ? (a.stateNode = b, xg = a, yg = Lf(b.firstChild), true) : false;
    case 6:
      return b = "" === a.pendingProps || 3 !== b.nodeType ? null : b, null !== b ? (a.stateNode = b, xg = a, yg = null, true) : false;
    case 13:
      return b = 8 !== b.nodeType ? null : b, null !== b ? (c = null !== qg ? { id: rg, overflow: sg } : null, a.memoizedState = { dehydrated: b, treeContext: c, retryLane: 1073741824 }, c = Bg(18, null, null, 0), c.stateNode = b, c.return = a, a.child = c, xg = a, yg = null, true) : false;
    default:
      return false;
  }
}
function Dg(a) {
  return 0 !== (a.mode & 1) && 0 === (a.flags & 128);
}
function Eg(a) {
  if (I) {
    var b = yg;
    if (b) {
      var c = b;
      if (!Cg(a, b)) {
        if (Dg(a)) throw Error(p(418));
        b = Lf(c.nextSibling);
        var d = xg;
        b && Cg(a, b) ? Ag(d, c) : (a.flags = a.flags & -4097 | 2, I = false, xg = a);
      }
    } else {
      if (Dg(a)) throw Error(p(418));
      a.flags = a.flags & -4097 | 2;
      I = false;
      xg = a;
    }
  }
}
function Fg(a) {
  for (a = a.return; null !== a && 5 !== a.tag && 3 !== a.tag && 13 !== a.tag; ) a = a.return;
  xg = a;
}
function Gg(a) {
  if (a !== xg) return false;
  if (!I) return Fg(a), I = true, false;
  var b;
  (b = 3 !== a.tag) && !(b = 5 !== a.tag) && (b = a.type, b = "head" !== b && "body" !== b && !Ef(a.type, a.memoizedProps));
  if (b && (b = yg)) {
    if (Dg(a)) throw Hg(), Error(p(418));
    for (; b; ) Ag(a, b), b = Lf(b.nextSibling);
  }
  Fg(a);
  if (13 === a.tag) {
    a = a.memoizedState;
    a = null !== a ? a.dehydrated : null;
    if (!a) throw Error(p(317));
    a: {
      a = a.nextSibling;
      for (b = 0; a; ) {
        if (8 === a.nodeType) {
          var c = a.data;
          if ("/$" === c) {
            if (0 === b) {
              yg = Lf(a.nextSibling);
              break a;
            }
            b--;
          } else "$" !== c && "$!" !== c && "$?" !== c || b++;
        }
        a = a.nextSibling;
      }
      yg = null;
    }
  } else yg = xg ? Lf(a.stateNode.nextSibling) : null;
  return true;
}
function Hg() {
  for (var a = yg; a; ) a = Lf(a.nextSibling);
}
function Ig() {
  yg = xg = null;
  I = false;
}
function Jg(a) {
  null === zg ? zg = [a] : zg.push(a);
}
var Kg = ua.ReactCurrentBatchConfig;
function Lg(a, b, c) {
  a = c.ref;
  if (null !== a && "function" !== typeof a && "object" !== typeof a) {
    if (c._owner) {
      c = c._owner;
      if (c) {
        if (1 !== c.tag) throw Error(p(309));
        var d = c.stateNode;
      }
      if (!d) throw Error(p(147, a));
      var e = d, f2 = "" + a;
      if (null !== b && null !== b.ref && "function" === typeof b.ref && b.ref._stringRef === f2) return b.ref;
      b = function(a2) {
        var b2 = e.refs;
        null === a2 ? delete b2[f2] : b2[f2] = a2;
      };
      b._stringRef = f2;
      return b;
    }
    if ("string" !== typeof a) throw Error(p(284));
    if (!c._owner) throw Error(p(290, a));
  }
  return a;
}
function Mg(a, b) {
  a = Object.prototype.toString.call(b);
  throw Error(p(31, "[object Object]" === a ? "object with keys {" + Object.keys(b).join(", ") + "}" : a));
}
function Ng(a) {
  var b = a._init;
  return b(a._payload);
}
function Og(a) {
  function b(b2, c2) {
    if (a) {
      var d2 = b2.deletions;
      null === d2 ? (b2.deletions = [c2], b2.flags |= 16) : d2.push(c2);
    }
  }
  function c(c2, d2) {
    if (!a) return null;
    for (; null !== d2; ) b(c2, d2), d2 = d2.sibling;
    return null;
  }
  function d(a2, b2) {
    for (a2 = /* @__PURE__ */ new Map(); null !== b2; ) null !== b2.key ? a2.set(b2.key, b2) : a2.set(b2.index, b2), b2 = b2.sibling;
    return a2;
  }
  function e(a2, b2) {
    a2 = Pg(a2, b2);
    a2.index = 0;
    a2.sibling = null;
    return a2;
  }
  function f2(b2, c2, d2) {
    b2.index = d2;
    if (!a) return b2.flags |= 1048576, c2;
    d2 = b2.alternate;
    if (null !== d2) return d2 = d2.index, d2 < c2 ? (b2.flags |= 2, c2) : d2;
    b2.flags |= 2;
    return c2;
  }
  function g(b2) {
    a && null === b2.alternate && (b2.flags |= 2);
    return b2;
  }
  function h(a2, b2, c2, d2) {
    if (null === b2 || 6 !== b2.tag) return b2 = Qg(c2, a2.mode, d2), b2.return = a2, b2;
    b2 = e(b2, c2);
    b2.return = a2;
    return b2;
  }
  function k(a2, b2, c2, d2) {
    var f3 = c2.type;
    if (f3 === ya) return m2(a2, b2, c2.props.children, d2, c2.key);
    if (null !== b2 && (b2.elementType === f3 || "object" === typeof f3 && null !== f3 && f3.$$typeof === Ha && Ng(f3) === b2.type)) return d2 = e(b2, c2.props), d2.ref = Lg(a2, b2, c2), d2.return = a2, d2;
    d2 = Rg(c2.type, c2.key, c2.props, null, a2.mode, d2);
    d2.ref = Lg(a2, b2, c2);
    d2.return = a2;
    return d2;
  }
  function l2(a2, b2, c2, d2) {
    if (null === b2 || 4 !== b2.tag || b2.stateNode.containerInfo !== c2.containerInfo || b2.stateNode.implementation !== c2.implementation) return b2 = Sg(c2, a2.mode, d2), b2.return = a2, b2;
    b2 = e(b2, c2.children || []);
    b2.return = a2;
    return b2;
  }
  function m2(a2, b2, c2, d2, f3) {
    if (null === b2 || 7 !== b2.tag) return b2 = Tg(c2, a2.mode, d2, f3), b2.return = a2, b2;
    b2 = e(b2, c2);
    b2.return = a2;
    return b2;
  }
  function q2(a2, b2, c2) {
    if ("string" === typeof b2 && "" !== b2 || "number" === typeof b2) return b2 = Qg("" + b2, a2.mode, c2), b2.return = a2, b2;
    if ("object" === typeof b2 && null !== b2) {
      switch (b2.$$typeof) {
        case va:
          return c2 = Rg(b2.type, b2.key, b2.props, null, a2.mode, c2), c2.ref = Lg(a2, null, b2), c2.return = a2, c2;
        case wa:
          return b2 = Sg(b2, a2.mode, c2), b2.return = a2, b2;
        case Ha:
          var d2 = b2._init;
          return q2(a2, d2(b2._payload), c2);
      }
      if (eb(b2) || Ka(b2)) return b2 = Tg(b2, a2.mode, c2, null), b2.return = a2, b2;
      Mg(a2, b2);
    }
    return null;
  }
  function r2(a2, b2, c2, d2) {
    var e2 = null !== b2 ? b2.key : null;
    if ("string" === typeof c2 && "" !== c2 || "number" === typeof c2) return null !== e2 ? null : h(a2, b2, "" + c2, d2);
    if ("object" === typeof c2 && null !== c2) {
      switch (c2.$$typeof) {
        case va:
          return c2.key === e2 ? k(a2, b2, c2, d2) : null;
        case wa:
          return c2.key === e2 ? l2(a2, b2, c2, d2) : null;
        case Ha:
          return e2 = c2._init, r2(
            a2,
            b2,
            e2(c2._payload),
            d2
          );
      }
      if (eb(c2) || Ka(c2)) return null !== e2 ? null : m2(a2, b2, c2, d2, null);
      Mg(a2, c2);
    }
    return null;
  }
  function y2(a2, b2, c2, d2, e2) {
    if ("string" === typeof d2 && "" !== d2 || "number" === typeof d2) return a2 = a2.get(c2) || null, h(b2, a2, "" + d2, e2);
    if ("object" === typeof d2 && null !== d2) {
      switch (d2.$$typeof) {
        case va:
          return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, k(b2, a2, d2, e2);
        case wa:
          return a2 = a2.get(null === d2.key ? c2 : d2.key) || null, l2(b2, a2, d2, e2);
        case Ha:
          var f3 = d2._init;
          return y2(a2, b2, c2, f3(d2._payload), e2);
      }
      if (eb(d2) || Ka(d2)) return a2 = a2.get(c2) || null, m2(b2, a2, d2, e2, null);
      Mg(b2, d2);
    }
    return null;
  }
  function n2(e2, g2, h2, k2) {
    for (var l3 = null, m3 = null, u2 = g2, w2 = g2 = 0, x2 = null; null !== u2 && w2 < h2.length; w2++) {
      u2.index > w2 ? (x2 = u2, u2 = null) : x2 = u2.sibling;
      var n3 = r2(e2, u2, h2[w2], k2);
      if (null === n3) {
        null === u2 && (u2 = x2);
        break;
      }
      a && u2 && null === n3.alternate && b(e2, u2);
      g2 = f2(n3, g2, w2);
      null === m3 ? l3 = n3 : m3.sibling = n3;
      m3 = n3;
      u2 = x2;
    }
    if (w2 === h2.length) return c(e2, u2), I && tg(e2, w2), l3;
    if (null === u2) {
      for (; w2 < h2.length; w2++) u2 = q2(e2, h2[w2], k2), null !== u2 && (g2 = f2(u2, g2, w2), null === m3 ? l3 = u2 : m3.sibling = u2, m3 = u2);
      I && tg(e2, w2);
      return l3;
    }
    for (u2 = d(e2, u2); w2 < h2.length; w2++) x2 = y2(u2, e2, w2, h2[w2], k2), null !== x2 && (a && null !== x2.alternate && u2.delete(null === x2.key ? w2 : x2.key), g2 = f2(x2, g2, w2), null === m3 ? l3 = x2 : m3.sibling = x2, m3 = x2);
    a && u2.forEach(function(a2) {
      return b(e2, a2);
    });
    I && tg(e2, w2);
    return l3;
  }
  function t2(e2, g2, h2, k2) {
    var l3 = Ka(h2);
    if ("function" !== typeof l3) throw Error(p(150));
    h2 = l3.call(h2);
    if (null == h2) throw Error(p(151));
    for (var u2 = l3 = null, m3 = g2, w2 = g2 = 0, x2 = null, n3 = h2.next(); null !== m3 && !n3.done; w2++, n3 = h2.next()) {
      m3.index > w2 ? (x2 = m3, m3 = null) : x2 = m3.sibling;
      var t3 = r2(e2, m3, n3.value, k2);
      if (null === t3) {
        null === m3 && (m3 = x2);
        break;
      }
      a && m3 && null === t3.alternate && b(e2, m3);
      g2 = f2(t3, g2, w2);
      null === u2 ? l3 = t3 : u2.sibling = t3;
      u2 = t3;
      m3 = x2;
    }
    if (n3.done) return c(
      e2,
      m3
    ), I && tg(e2, w2), l3;
    if (null === m3) {
      for (; !n3.done; w2++, n3 = h2.next()) n3 = q2(e2, n3.value, k2), null !== n3 && (g2 = f2(n3, g2, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
      I && tg(e2, w2);
      return l3;
    }
    for (m3 = d(e2, m3); !n3.done; w2++, n3 = h2.next()) n3 = y2(m3, e2, w2, n3.value, k2), null !== n3 && (a && null !== n3.alternate && m3.delete(null === n3.key ? w2 : n3.key), g2 = f2(n3, g2, w2), null === u2 ? l3 = n3 : u2.sibling = n3, u2 = n3);
    a && m3.forEach(function(a2) {
      return b(e2, a2);
    });
    I && tg(e2, w2);
    return l3;
  }
  function J2(a2, d2, f3, h2) {
    "object" === typeof f3 && null !== f3 && f3.type === ya && null === f3.key && (f3 = f3.props.children);
    if ("object" === typeof f3 && null !== f3) {
      switch (f3.$$typeof) {
        case va:
          a: {
            for (var k2 = f3.key, l3 = d2; null !== l3; ) {
              if (l3.key === k2) {
                k2 = f3.type;
                if (k2 === ya) {
                  if (7 === l3.tag) {
                    c(a2, l3.sibling);
                    d2 = e(l3, f3.props.children);
                    d2.return = a2;
                    a2 = d2;
                    break a;
                  }
                } else if (l3.elementType === k2 || "object" === typeof k2 && null !== k2 && k2.$$typeof === Ha && Ng(k2) === l3.type) {
                  c(a2, l3.sibling);
                  d2 = e(l3, f3.props);
                  d2.ref = Lg(a2, l3, f3);
                  d2.return = a2;
                  a2 = d2;
                  break a;
                }
                c(a2, l3);
                break;
              } else b(a2, l3);
              l3 = l3.sibling;
            }
            f3.type === ya ? (d2 = Tg(f3.props.children, a2.mode, h2, f3.key), d2.return = a2, a2 = d2) : (h2 = Rg(f3.type, f3.key, f3.props, null, a2.mode, h2), h2.ref = Lg(a2, d2, f3), h2.return = a2, a2 = h2);
          }
          return g(a2);
        case wa:
          a: {
            for (l3 = f3.key; null !== d2; ) {
              if (d2.key === l3) if (4 === d2.tag && d2.stateNode.containerInfo === f3.containerInfo && d2.stateNode.implementation === f3.implementation) {
                c(a2, d2.sibling);
                d2 = e(d2, f3.children || []);
                d2.return = a2;
                a2 = d2;
                break a;
              } else {
                c(a2, d2);
                break;
              }
              else b(a2, d2);
              d2 = d2.sibling;
            }
            d2 = Sg(f3, a2.mode, h2);
            d2.return = a2;
            a2 = d2;
          }
          return g(a2);
        case Ha:
          return l3 = f3._init, J2(a2, d2, l3(f3._payload), h2);
      }
      if (eb(f3)) return n2(a2, d2, f3, h2);
      if (Ka(f3)) return t2(a2, d2, f3, h2);
      Mg(a2, f3);
    }
    return "string" === typeof f3 && "" !== f3 || "number" === typeof f3 ? (f3 = "" + f3, null !== d2 && 6 === d2.tag ? (c(a2, d2.sibling), d2 = e(d2, f3), d2.return = a2, a2 = d2) : (c(a2, d2), d2 = Qg(f3, a2.mode, h2), d2.return = a2, a2 = d2), g(a2)) : c(a2, d2);
  }
  return J2;
}
var Ug = Og(true), Vg = Og(false), Wg = Uf(null), Xg = null, Yg = null, Zg = null;
function $g() {
  Zg = Yg = Xg = null;
}
function ah(a) {
  var b = Wg.current;
  E(Wg);
  a._currentValue = b;
}
function bh(a, b, c) {
  for (; null !== a; ) {
    var d = a.alternate;
    (a.childLanes & b) !== b ? (a.childLanes |= b, null !== d && (d.childLanes |= b)) : null !== d && (d.childLanes & b) !== b && (d.childLanes |= b);
    if (a === c) break;
    a = a.return;
  }
}
function ch(a, b) {
  Xg = a;
  Zg = Yg = null;
  a = a.dependencies;
  null !== a && null !== a.firstContext && (0 !== (a.lanes & b) && (dh = true), a.firstContext = null);
}
function eh(a) {
  var b = a._currentValue;
  if (Zg !== a) if (a = { context: a, memoizedValue: b, next: null }, null === Yg) {
    if (null === Xg) throw Error(p(308));
    Yg = a;
    Xg.dependencies = { lanes: 0, firstContext: a };
  } else Yg = Yg.next = a;
  return b;
}
var fh = null;
function gh(a) {
  null === fh ? fh = [a] : fh.push(a);
}
function hh(a, b, c, d) {
  var e = b.interleaved;
  null === e ? (c.next = c, gh(b)) : (c.next = e.next, e.next = c);
  b.interleaved = c;
  return ih(a, d);
}
function ih(a, b) {
  a.lanes |= b;
  var c = a.alternate;
  null !== c && (c.lanes |= b);
  c = a;
  for (a = a.return; null !== a; ) a.childLanes |= b, c = a.alternate, null !== c && (c.childLanes |= b), c = a, a = a.return;
  return 3 === c.tag ? c.stateNode : null;
}
var jh = false;
function kh(a) {
  a.updateQueue = { baseState: a.memoizedState, firstBaseUpdate: null, lastBaseUpdate: null, shared: { pending: null, interleaved: null, lanes: 0 }, effects: null };
}
function lh(a, b) {
  a = a.updateQueue;
  b.updateQueue === a && (b.updateQueue = { baseState: a.baseState, firstBaseUpdate: a.firstBaseUpdate, lastBaseUpdate: a.lastBaseUpdate, shared: a.shared, effects: a.effects });
}
function mh(a, b) {
  return { eventTime: a, lane: b, tag: 0, payload: null, callback: null, next: null };
}
function nh(a, b, c) {
  var d = a.updateQueue;
  if (null === d) return null;
  d = d.shared;
  if (0 !== (K & 2)) {
    var e = d.pending;
    null === e ? b.next = b : (b.next = e.next, e.next = b);
    d.pending = b;
    return ih(a, c);
  }
  e = d.interleaved;
  null === e ? (b.next = b, gh(d)) : (b.next = e.next, e.next = b);
  d.interleaved = b;
  return ih(a, c);
}
function oh(a, b, c) {
  b = b.updateQueue;
  if (null !== b && (b = b.shared, 0 !== (c & 4194240))) {
    var d = b.lanes;
    d &= a.pendingLanes;
    c |= d;
    b.lanes = c;
    Cc(a, c);
  }
}
function ph(a, b) {
  var c = a.updateQueue, d = a.alternate;
  if (null !== d && (d = d.updateQueue, c === d)) {
    var e = null, f2 = null;
    c = c.firstBaseUpdate;
    if (null !== c) {
      do {
        var g = { eventTime: c.eventTime, lane: c.lane, tag: c.tag, payload: c.payload, callback: c.callback, next: null };
        null === f2 ? e = f2 = g : f2 = f2.next = g;
        c = c.next;
      } while (null !== c);
      null === f2 ? e = f2 = b : f2 = f2.next = b;
    } else e = f2 = b;
    c = { baseState: d.baseState, firstBaseUpdate: e, lastBaseUpdate: f2, shared: d.shared, effects: d.effects };
    a.updateQueue = c;
    return;
  }
  a = c.lastBaseUpdate;
  null === a ? c.firstBaseUpdate = b : a.next = b;
  c.lastBaseUpdate = b;
}
function qh(a, b, c, d) {
  var e = a.updateQueue;
  jh = false;
  var f2 = e.firstBaseUpdate, g = e.lastBaseUpdate, h = e.shared.pending;
  if (null !== h) {
    e.shared.pending = null;
    var k = h, l2 = k.next;
    k.next = null;
    null === g ? f2 = l2 : g.next = l2;
    g = k;
    var m2 = a.alternate;
    null !== m2 && (m2 = m2.updateQueue, h = m2.lastBaseUpdate, h !== g && (null === h ? m2.firstBaseUpdate = l2 : h.next = l2, m2.lastBaseUpdate = k));
  }
  if (null !== f2) {
    var q2 = e.baseState;
    g = 0;
    m2 = l2 = k = null;
    h = f2;
    do {
      var r2 = h.lane, y2 = h.eventTime;
      if ((d & r2) === r2) {
        null !== m2 && (m2 = m2.next = {
          eventTime: y2,
          lane: 0,
          tag: h.tag,
          payload: h.payload,
          callback: h.callback,
          next: null
        });
        a: {
          var n2 = a, t2 = h;
          r2 = b;
          y2 = c;
          switch (t2.tag) {
            case 1:
              n2 = t2.payload;
              if ("function" === typeof n2) {
                q2 = n2.call(y2, q2, r2);
                break a;
              }
              q2 = n2;
              break a;
            case 3:
              n2.flags = n2.flags & -65537 | 128;
            case 0:
              n2 = t2.payload;
              r2 = "function" === typeof n2 ? n2.call(y2, q2, r2) : n2;
              if (null === r2 || void 0 === r2) break a;
              q2 = A({}, q2, r2);
              break a;
            case 2:
              jh = true;
          }
        }
        null !== h.callback && 0 !== h.lane && (a.flags |= 64, r2 = e.effects, null === r2 ? e.effects = [h] : r2.push(h));
      } else y2 = { eventTime: y2, lane: r2, tag: h.tag, payload: h.payload, callback: h.callback, next: null }, null === m2 ? (l2 = m2 = y2, k = q2) : m2 = m2.next = y2, g |= r2;
      h = h.next;
      if (null === h) if (h = e.shared.pending, null === h) break;
      else r2 = h, h = r2.next, r2.next = null, e.lastBaseUpdate = r2, e.shared.pending = null;
    } while (1);
    null === m2 && (k = q2);
    e.baseState = k;
    e.firstBaseUpdate = l2;
    e.lastBaseUpdate = m2;
    b = e.shared.interleaved;
    if (null !== b) {
      e = b;
      do
        g |= e.lane, e = e.next;
      while (e !== b);
    } else null === f2 && (e.shared.lanes = 0);
    rh |= g;
    a.lanes = g;
    a.memoizedState = q2;
  }
}
function sh(a, b, c) {
  a = b.effects;
  b.effects = null;
  if (null !== a) for (b = 0; b < a.length; b++) {
    var d = a[b], e = d.callback;
    if (null !== e) {
      d.callback = null;
      d = c;
      if ("function" !== typeof e) throw Error(p(191, e));
      e.call(d);
    }
  }
}
var th = {}, uh = Uf(th), vh = Uf(th), wh = Uf(th);
function xh(a) {
  if (a === th) throw Error(p(174));
  return a;
}
function yh(a, b) {
  G(wh, b);
  G(vh, a);
  G(uh, th);
  a = b.nodeType;
  switch (a) {
    case 9:
    case 11:
      b = (b = b.documentElement) ? b.namespaceURI : lb(null, "");
      break;
    default:
      a = 8 === a ? b.parentNode : b, b = a.namespaceURI || null, a = a.tagName, b = lb(b, a);
  }
  E(uh);
  G(uh, b);
}
function zh() {
  E(uh);
  E(vh);
  E(wh);
}
function Ah(a) {
  xh(wh.current);
  var b = xh(uh.current);
  var c = lb(b, a.type);
  b !== c && (G(vh, a), G(uh, c));
}
function Bh(a) {
  vh.current === a && (E(uh), E(vh));
}
var L = Uf(0);
function Ch(a) {
  for (var b = a; null !== b; ) {
    if (13 === b.tag) {
      var c = b.memoizedState;
      if (null !== c && (c = c.dehydrated, null === c || "$?" === c.data || "$!" === c.data)) return b;
    } else if (19 === b.tag && void 0 !== b.memoizedProps.revealOrder) {
      if (0 !== (b.flags & 128)) return b;
    } else if (null !== b.child) {
      b.child.return = b;
      b = b.child;
      continue;
    }
    if (b === a) break;
    for (; null === b.sibling; ) {
      if (null === b.return || b.return === a) return null;
      b = b.return;
    }
    b.sibling.return = b.return;
    b = b.sibling;
  }
  return null;
}
var Dh = [];
function Eh() {
  for (var a = 0; a < Dh.length; a++) Dh[a]._workInProgressVersionPrimary = null;
  Dh.length = 0;
}
var Fh = ua.ReactCurrentDispatcher, Gh = ua.ReactCurrentBatchConfig, Hh = 0, M = null, N = null, O = null, Ih = false, Jh = false, Kh = 0, Lh = 0;
function P() {
  throw Error(p(321));
}
function Mh(a, b) {
  if (null === b) return false;
  for (var c = 0; c < b.length && c < a.length; c++) if (!He(a[c], b[c])) return false;
  return true;
}
function Nh(a, b, c, d, e, f2) {
  Hh = f2;
  M = b;
  b.memoizedState = null;
  b.updateQueue = null;
  b.lanes = 0;
  Fh.current = null === a || null === a.memoizedState ? Oh : Ph;
  a = c(d, e);
  if (Jh) {
    f2 = 0;
    do {
      Jh = false;
      Kh = 0;
      if (25 <= f2) throw Error(p(301));
      f2 += 1;
      O = N = null;
      b.updateQueue = null;
      Fh.current = Qh;
      a = c(d, e);
    } while (Jh);
  }
  Fh.current = Rh;
  b = null !== N && null !== N.next;
  Hh = 0;
  O = N = M = null;
  Ih = false;
  if (b) throw Error(p(300));
  return a;
}
function Sh() {
  var a = 0 !== Kh;
  Kh = 0;
  return a;
}
function Th() {
  var a = { memoizedState: null, baseState: null, baseQueue: null, queue: null, next: null };
  null === O ? M.memoizedState = O = a : O = O.next = a;
  return O;
}
function Uh() {
  if (null === N) {
    var a = M.alternate;
    a = null !== a ? a.memoizedState : null;
  } else a = N.next;
  var b = null === O ? M.memoizedState : O.next;
  if (null !== b) O = b, N = a;
  else {
    if (null === a) throw Error(p(310));
    N = a;
    a = { memoizedState: N.memoizedState, baseState: N.baseState, baseQueue: N.baseQueue, queue: N.queue, next: null };
    null === O ? M.memoizedState = O = a : O = O.next = a;
  }
  return O;
}
function Vh(a, b) {
  return "function" === typeof b ? b(a) : b;
}
function Wh(a) {
  var b = Uh(), c = b.queue;
  if (null === c) throw Error(p(311));
  c.lastRenderedReducer = a;
  var d = N, e = d.baseQueue, f2 = c.pending;
  if (null !== f2) {
    if (null !== e) {
      var g = e.next;
      e.next = f2.next;
      f2.next = g;
    }
    d.baseQueue = e = f2;
    c.pending = null;
  }
  if (null !== e) {
    f2 = e.next;
    d = d.baseState;
    var h = g = null, k = null, l2 = f2;
    do {
      var m2 = l2.lane;
      if ((Hh & m2) === m2) null !== k && (k = k.next = { lane: 0, action: l2.action, hasEagerState: l2.hasEagerState, eagerState: l2.eagerState, next: null }), d = l2.hasEagerState ? l2.eagerState : a(d, l2.action);
      else {
        var q2 = {
          lane: m2,
          action: l2.action,
          hasEagerState: l2.hasEagerState,
          eagerState: l2.eagerState,
          next: null
        };
        null === k ? (h = k = q2, g = d) : k = k.next = q2;
        M.lanes |= m2;
        rh |= m2;
      }
      l2 = l2.next;
    } while (null !== l2 && l2 !== f2);
    null === k ? g = d : k.next = h;
    He(d, b.memoizedState) || (dh = true);
    b.memoizedState = d;
    b.baseState = g;
    b.baseQueue = k;
    c.lastRenderedState = d;
  }
  a = c.interleaved;
  if (null !== a) {
    e = a;
    do
      f2 = e.lane, M.lanes |= f2, rh |= f2, e = e.next;
    while (e !== a);
  } else null === e && (c.lanes = 0);
  return [b.memoizedState, c.dispatch];
}
function Xh(a) {
  var b = Uh(), c = b.queue;
  if (null === c) throw Error(p(311));
  c.lastRenderedReducer = a;
  var d = c.dispatch, e = c.pending, f2 = b.memoizedState;
  if (null !== e) {
    c.pending = null;
    var g = e = e.next;
    do
      f2 = a(f2, g.action), g = g.next;
    while (g !== e);
    He(f2, b.memoizedState) || (dh = true);
    b.memoizedState = f2;
    null === b.baseQueue && (b.baseState = f2);
    c.lastRenderedState = f2;
  }
  return [f2, d];
}
function Yh() {
}
function Zh(a, b) {
  var c = M, d = Uh(), e = b(), f2 = !He(d.memoizedState, e);
  f2 && (d.memoizedState = e, dh = true);
  d = d.queue;
  $h(ai.bind(null, c, d, a), [a]);
  if (d.getSnapshot !== b || f2 || null !== O && O.memoizedState.tag & 1) {
    c.flags |= 2048;
    bi(9, ci.bind(null, c, d, e, b), void 0, null);
    if (null === Q) throw Error(p(349));
    0 !== (Hh & 30) || di(c, b, e);
  }
  return e;
}
function di(a, b, c) {
  a.flags |= 16384;
  a = { getSnapshot: b, value: c };
  b = M.updateQueue;
  null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.stores = [a]) : (c = b.stores, null === c ? b.stores = [a] : c.push(a));
}
function ci(a, b, c, d) {
  b.value = c;
  b.getSnapshot = d;
  ei(b) && fi(a);
}
function ai(a, b, c) {
  return c(function() {
    ei(b) && fi(a);
  });
}
function ei(a) {
  var b = a.getSnapshot;
  a = a.value;
  try {
    var c = b();
    return !He(a, c);
  } catch (d) {
    return true;
  }
}
function fi(a) {
  var b = ih(a, 1);
  null !== b && gi(b, a, 1, -1);
}
function hi(a) {
  var b = Th();
  "function" === typeof a && (a = a());
  b.memoizedState = b.baseState = a;
  a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: Vh, lastRenderedState: a };
  b.queue = a;
  a = a.dispatch = ii.bind(null, M, a);
  return [b.memoizedState, a];
}
function bi(a, b, c, d) {
  a = { tag: a, create: b, destroy: c, deps: d, next: null };
  b = M.updateQueue;
  null === b ? (b = { lastEffect: null, stores: null }, M.updateQueue = b, b.lastEffect = a.next = a) : (c = b.lastEffect, null === c ? b.lastEffect = a.next = a : (d = c.next, c.next = a, a.next = d, b.lastEffect = a));
  return a;
}
function ji() {
  return Uh().memoizedState;
}
function ki(a, b, c, d) {
  var e = Th();
  M.flags |= a;
  e.memoizedState = bi(1 | b, c, void 0, void 0 === d ? null : d);
}
function li(a, b, c, d) {
  var e = Uh();
  d = void 0 === d ? null : d;
  var f2 = void 0;
  if (null !== N) {
    var g = N.memoizedState;
    f2 = g.destroy;
    if (null !== d && Mh(d, g.deps)) {
      e.memoizedState = bi(b, c, f2, d);
      return;
    }
  }
  M.flags |= a;
  e.memoizedState = bi(1 | b, c, f2, d);
}
function mi(a, b) {
  return ki(8390656, 8, a, b);
}
function $h(a, b) {
  return li(2048, 8, a, b);
}
function ni(a, b) {
  return li(4, 2, a, b);
}
function oi(a, b) {
  return li(4, 4, a, b);
}
function pi(a, b) {
  if ("function" === typeof b) return a = a(), b(a), function() {
    b(null);
  };
  if (null !== b && void 0 !== b) return a = a(), b.current = a, function() {
    b.current = null;
  };
}
function qi(a, b, c) {
  c = null !== c && void 0 !== c ? c.concat([a]) : null;
  return li(4, 4, pi.bind(null, b, a), c);
}
function ri() {
}
function si(a, b) {
  var c = Uh();
  b = void 0 === b ? null : b;
  var d = c.memoizedState;
  if (null !== d && null !== b && Mh(b, d[1])) return d[0];
  c.memoizedState = [a, b];
  return a;
}
function ti(a, b) {
  var c = Uh();
  b = void 0 === b ? null : b;
  var d = c.memoizedState;
  if (null !== d && null !== b && Mh(b, d[1])) return d[0];
  a = a();
  c.memoizedState = [a, b];
  return a;
}
function ui(a, b, c) {
  if (0 === (Hh & 21)) return a.baseState && (a.baseState = false, dh = true), a.memoizedState = c;
  He(c, b) || (c = yc(), M.lanes |= c, rh |= c, a.baseState = true);
  return b;
}
function vi(a, b) {
  var c = C;
  C = 0 !== c && 4 > c ? c : 4;
  a(true);
  var d = Gh.transition;
  Gh.transition = {};
  try {
    a(false), b();
  } finally {
    C = c, Gh.transition = d;
  }
}
function wi() {
  return Uh().memoizedState;
}
function xi(a, b, c) {
  var d = yi(a);
  c = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
  if (zi(a)) Ai(b, c);
  else if (c = hh(a, b, c, d), null !== c) {
    var e = R();
    gi(c, a, d, e);
    Bi(c, b, d);
  }
}
function ii(a, b, c) {
  var d = yi(a), e = { lane: d, action: c, hasEagerState: false, eagerState: null, next: null };
  if (zi(a)) Ai(b, e);
  else {
    var f2 = a.alternate;
    if (0 === a.lanes && (null === f2 || 0 === f2.lanes) && (f2 = b.lastRenderedReducer, null !== f2)) try {
      var g = b.lastRenderedState, h = f2(g, c);
      e.hasEagerState = true;
      e.eagerState = h;
      if (He(h, g)) {
        var k = b.interleaved;
        null === k ? (e.next = e, gh(b)) : (e.next = k.next, k.next = e);
        b.interleaved = e;
        return;
      }
    } catch (l2) {
    } finally {
    }
    c = hh(a, b, e, d);
    null !== c && (e = R(), gi(c, a, d, e), Bi(c, b, d));
  }
}
function zi(a) {
  var b = a.alternate;
  return a === M || null !== b && b === M;
}
function Ai(a, b) {
  Jh = Ih = true;
  var c = a.pending;
  null === c ? b.next = b : (b.next = c.next, c.next = b);
  a.pending = b;
}
function Bi(a, b, c) {
  if (0 !== (c & 4194240)) {
    var d = b.lanes;
    d &= a.pendingLanes;
    c |= d;
    b.lanes = c;
    Cc(a, c);
  }
}
var Rh = { readContext: eh, useCallback: P, useContext: P, useEffect: P, useImperativeHandle: P, useInsertionEffect: P, useLayoutEffect: P, useMemo: P, useReducer: P, useRef: P, useState: P, useDebugValue: P, useDeferredValue: P, useTransition: P, useMutableSource: P, useSyncExternalStore: P, useId: P, unstable_isNewReconciler: false }, Oh = { readContext: eh, useCallback: function(a, b) {
  Th().memoizedState = [a, void 0 === b ? null : b];
  return a;
}, useContext: eh, useEffect: mi, useImperativeHandle: function(a, b, c) {
  c = null !== c && void 0 !== c ? c.concat([a]) : null;
  return ki(
    4194308,
    4,
    pi.bind(null, b, a),
    c
  );
}, useLayoutEffect: function(a, b) {
  return ki(4194308, 4, a, b);
}, useInsertionEffect: function(a, b) {
  return ki(4, 2, a, b);
}, useMemo: function(a, b) {
  var c = Th();
  b = void 0 === b ? null : b;
  a = a();
  c.memoizedState = [a, b];
  return a;
}, useReducer: function(a, b, c) {
  var d = Th();
  b = void 0 !== c ? c(b) : b;
  d.memoizedState = d.baseState = b;
  a = { pending: null, interleaved: null, lanes: 0, dispatch: null, lastRenderedReducer: a, lastRenderedState: b };
  d.queue = a;
  a = a.dispatch = xi.bind(null, M, a);
  return [d.memoizedState, a];
}, useRef: function(a) {
  var b = Th();
  a = { current: a };
  return b.memoizedState = a;
}, useState: hi, useDebugValue: ri, useDeferredValue: function(a) {
  return Th().memoizedState = a;
}, useTransition: function() {
  var a = hi(false), b = a[0];
  a = vi.bind(null, a[1]);
  Th().memoizedState = a;
  return [b, a];
}, useMutableSource: function() {
}, useSyncExternalStore: function(a, b, c) {
  var d = M, e = Th();
  if (I) {
    if (void 0 === c) throw Error(p(407));
    c = c();
  } else {
    c = b();
    if (null === Q) throw Error(p(349));
    0 !== (Hh & 30) || di(d, b, c);
  }
  e.memoizedState = c;
  var f2 = { value: c, getSnapshot: b };
  e.queue = f2;
  mi(ai.bind(
    null,
    d,
    f2,
    a
  ), [a]);
  d.flags |= 2048;
  bi(9, ci.bind(null, d, f2, c, b), void 0, null);
  return c;
}, useId: function() {
  var a = Th(), b = Q.identifierPrefix;
  if (I) {
    var c = sg;
    var d = rg;
    c = (d & ~(1 << 32 - oc(d) - 1)).toString(32) + c;
    b = ":" + b + "R" + c;
    c = Kh++;
    0 < c && (b += "H" + c.toString(32));
    b += ":";
  } else c = Lh++, b = ":" + b + "r" + c.toString(32) + ":";
  return a.memoizedState = b;
}, unstable_isNewReconciler: false }, Ph = {
  readContext: eh,
  useCallback: si,
  useContext: eh,
  useEffect: $h,
  useImperativeHandle: qi,
  useInsertionEffect: ni,
  useLayoutEffect: oi,
  useMemo: ti,
  useReducer: Wh,
  useRef: ji,
  useState: function() {
    return Wh(Vh);
  },
  useDebugValue: ri,
  useDeferredValue: function(a) {
    var b = Uh();
    return ui(b, N.memoizedState, a);
  },
  useTransition: function() {
    var a = Wh(Vh)[0], b = Uh().memoizedState;
    return [a, b];
  },
  useMutableSource: Yh,
  useSyncExternalStore: Zh,
  useId: wi,
  unstable_isNewReconciler: false
}, Qh = { readContext: eh, useCallback: si, useContext: eh, useEffect: $h, useImperativeHandle: qi, useInsertionEffect: ni, useLayoutEffect: oi, useMemo: ti, useReducer: Xh, useRef: ji, useState: function() {
  return Xh(Vh);
}, useDebugValue: ri, useDeferredValue: function(a) {
  var b = Uh();
  return null === N ? b.memoizedState = a : ui(b, N.memoizedState, a);
}, useTransition: function() {
  var a = Xh(Vh)[0], b = Uh().memoizedState;
  return [a, b];
}, useMutableSource: Yh, useSyncExternalStore: Zh, useId: wi, unstable_isNewReconciler: false };
function Ci(a, b) {
  if (a && a.defaultProps) {
    b = A({}, b);
    a = a.defaultProps;
    for (var c in a) void 0 === b[c] && (b[c] = a[c]);
    return b;
  }
  return b;
}
function Di(a, b, c, d) {
  b = a.memoizedState;
  c = c(d, b);
  c = null === c || void 0 === c ? b : A({}, b, c);
  a.memoizedState = c;
  0 === a.lanes && (a.updateQueue.baseState = c);
}
var Ei = { isMounted: function(a) {
  return (a = a._reactInternals) ? Vb(a) === a : false;
}, enqueueSetState: function(a, b, c) {
  a = a._reactInternals;
  var d = R(), e = yi(a), f2 = mh(d, e);
  f2.payload = b;
  void 0 !== c && null !== c && (f2.callback = c);
  b = nh(a, f2, e);
  null !== b && (gi(b, a, e, d), oh(b, a, e));
}, enqueueReplaceState: function(a, b, c) {
  a = a._reactInternals;
  var d = R(), e = yi(a), f2 = mh(d, e);
  f2.tag = 1;
  f2.payload = b;
  void 0 !== c && null !== c && (f2.callback = c);
  b = nh(a, f2, e);
  null !== b && (gi(b, a, e, d), oh(b, a, e));
}, enqueueForceUpdate: function(a, b) {
  a = a._reactInternals;
  var c = R(), d = yi(a), e = mh(c, d);
  e.tag = 2;
  void 0 !== b && null !== b && (e.callback = b);
  b = nh(a, e, d);
  null !== b && (gi(b, a, d, c), oh(b, a, d));
} };
function Fi(a, b, c, d, e, f2, g) {
  a = a.stateNode;
  return "function" === typeof a.shouldComponentUpdate ? a.shouldComponentUpdate(d, f2, g) : b.prototype && b.prototype.isPureReactComponent ? !Ie(c, d) || !Ie(e, f2) : true;
}
function Gi(a, b, c) {
  var d = false, e = Vf;
  var f2 = b.contextType;
  "object" === typeof f2 && null !== f2 ? f2 = eh(f2) : (e = Zf(b) ? Xf : H.current, d = b.contextTypes, f2 = (d = null !== d && void 0 !== d) ? Yf(a, e) : Vf);
  b = new b(c, f2);
  a.memoizedState = null !== b.state && void 0 !== b.state ? b.state : null;
  b.updater = Ei;
  a.stateNode = b;
  b._reactInternals = a;
  d && (a = a.stateNode, a.__reactInternalMemoizedUnmaskedChildContext = e, a.__reactInternalMemoizedMaskedChildContext = f2);
  return b;
}
function Hi(a, b, c, d) {
  a = b.state;
  "function" === typeof b.componentWillReceiveProps && b.componentWillReceiveProps(c, d);
  "function" === typeof b.UNSAFE_componentWillReceiveProps && b.UNSAFE_componentWillReceiveProps(c, d);
  b.state !== a && Ei.enqueueReplaceState(b, b.state, null);
}
function Ii(a, b, c, d) {
  var e = a.stateNode;
  e.props = c;
  e.state = a.memoizedState;
  e.refs = {};
  kh(a);
  var f2 = b.contextType;
  "object" === typeof f2 && null !== f2 ? e.context = eh(f2) : (f2 = Zf(b) ? Xf : H.current, e.context = Yf(a, f2));
  e.state = a.memoizedState;
  f2 = b.getDerivedStateFromProps;
  "function" === typeof f2 && (Di(a, b, f2, c), e.state = a.memoizedState);
  "function" === typeof b.getDerivedStateFromProps || "function" === typeof e.getSnapshotBeforeUpdate || "function" !== typeof e.UNSAFE_componentWillMount && "function" !== typeof e.componentWillMount || (b = e.state, "function" === typeof e.componentWillMount && e.componentWillMount(), "function" === typeof e.UNSAFE_componentWillMount && e.UNSAFE_componentWillMount(), b !== e.state && Ei.enqueueReplaceState(e, e.state, null), qh(a, c, e, d), e.state = a.memoizedState);
  "function" === typeof e.componentDidMount && (a.flags |= 4194308);
}
function Ji(a, b) {
  try {
    var c = "", d = b;
    do
      c += Pa(d), d = d.return;
    while (d);
    var e = c;
  } catch (f2) {
    e = "\nError generating stack: " + f2.message + "\n" + f2.stack;
  }
  return { value: a, source: b, stack: e, digest: null };
}
function Ki(a, b, c) {
  return { value: a, source: null, stack: null != c ? c : null, digest: null != b ? b : null };
}
function Li(a, b) {
  try {
    console.error(b.value);
  } catch (c) {
    setTimeout(function() {
      throw c;
    });
  }
}
var Mi = "function" === typeof WeakMap ? WeakMap : Map;
function Ni(a, b, c) {
  c = mh(-1, c);
  c.tag = 3;
  c.payload = { element: null };
  var d = b.value;
  c.callback = function() {
    Oi || (Oi = true, Pi = d);
    Li(a, b);
  };
  return c;
}
function Qi(a, b, c) {
  c = mh(-1, c);
  c.tag = 3;
  var d = a.type.getDerivedStateFromError;
  if ("function" === typeof d) {
    var e = b.value;
    c.payload = function() {
      return d(e);
    };
    c.callback = function() {
      Li(a, b);
    };
  }
  var f2 = a.stateNode;
  null !== f2 && "function" === typeof f2.componentDidCatch && (c.callback = function() {
    Li(a, b);
    "function" !== typeof d && (null === Ri ? Ri = /* @__PURE__ */ new Set([this]) : Ri.add(this));
    var c2 = b.stack;
    this.componentDidCatch(b.value, { componentStack: null !== c2 ? c2 : "" });
  });
  return c;
}
function Si(a, b, c) {
  var d = a.pingCache;
  if (null === d) {
    d = a.pingCache = new Mi();
    var e = /* @__PURE__ */ new Set();
    d.set(b, e);
  } else e = d.get(b), void 0 === e && (e = /* @__PURE__ */ new Set(), d.set(b, e));
  e.has(c) || (e.add(c), a = Ti.bind(null, a, b, c), b.then(a, a));
}
function Ui(a) {
  do {
    var b;
    if (b = 13 === a.tag) b = a.memoizedState, b = null !== b ? null !== b.dehydrated ? true : false : true;
    if (b) return a;
    a = a.return;
  } while (null !== a);
  return null;
}
function Vi(a, b, c, d, e) {
  if (0 === (a.mode & 1)) return a === b ? a.flags |= 65536 : (a.flags |= 128, c.flags |= 131072, c.flags &= -52805, 1 === c.tag && (null === c.alternate ? c.tag = 17 : (b = mh(-1, 1), b.tag = 2, nh(c, b, 1))), c.lanes |= 1), a;
  a.flags |= 65536;
  a.lanes = e;
  return a;
}
var Wi = ua.ReactCurrentOwner, dh = false;
function Xi(a, b, c, d) {
  b.child = null === a ? Vg(b, null, c, d) : Ug(b, a.child, c, d);
}
function Yi(a, b, c, d, e) {
  c = c.render;
  var f2 = b.ref;
  ch(b, e);
  d = Nh(a, b, c, d, f2, e);
  c = Sh();
  if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
  I && c && vg(b);
  b.flags |= 1;
  Xi(a, b, d, e);
  return b.child;
}
function $i(a, b, c, d, e) {
  if (null === a) {
    var f2 = c.type;
    if ("function" === typeof f2 && !aj(f2) && void 0 === f2.defaultProps && null === c.compare && void 0 === c.defaultProps) return b.tag = 15, b.type = f2, bj(a, b, f2, d, e);
    a = Rg(c.type, null, d, b, b.mode, e);
    a.ref = b.ref;
    a.return = b;
    return b.child = a;
  }
  f2 = a.child;
  if (0 === (a.lanes & e)) {
    var g = f2.memoizedProps;
    c = c.compare;
    c = null !== c ? c : Ie;
    if (c(g, d) && a.ref === b.ref) return Zi(a, b, e);
  }
  b.flags |= 1;
  a = Pg(f2, d);
  a.ref = b.ref;
  a.return = b;
  return b.child = a;
}
function bj(a, b, c, d, e) {
  if (null !== a) {
    var f2 = a.memoizedProps;
    if (Ie(f2, d) && a.ref === b.ref) if (dh = false, b.pendingProps = d = f2, 0 !== (a.lanes & e)) 0 !== (a.flags & 131072) && (dh = true);
    else return b.lanes = a.lanes, Zi(a, b, e);
  }
  return cj(a, b, c, d, e);
}
function dj(a, b, c) {
  var d = b.pendingProps, e = d.children, f2 = null !== a ? a.memoizedState : null;
  if ("hidden" === d.mode) if (0 === (b.mode & 1)) b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null }, G(ej, fj), fj |= c;
  else {
    if (0 === (c & 1073741824)) return a = null !== f2 ? f2.baseLanes | c : c, b.lanes = b.childLanes = 1073741824, b.memoizedState = { baseLanes: a, cachePool: null, transitions: null }, b.updateQueue = null, G(ej, fj), fj |= a, null;
    b.memoizedState = { baseLanes: 0, cachePool: null, transitions: null };
    d = null !== f2 ? f2.baseLanes : c;
    G(ej, fj);
    fj |= d;
  }
  else null !== f2 ? (d = f2.baseLanes | c, b.memoizedState = null) : d = c, G(ej, fj), fj |= d;
  Xi(a, b, e, c);
  return b.child;
}
function gj(a, b) {
  var c = b.ref;
  if (null === a && null !== c || null !== a && a.ref !== c) b.flags |= 512, b.flags |= 2097152;
}
function cj(a, b, c, d, e) {
  var f2 = Zf(c) ? Xf : H.current;
  f2 = Yf(b, f2);
  ch(b, e);
  c = Nh(a, b, c, d, f2, e);
  d = Sh();
  if (null !== a && !dh) return b.updateQueue = a.updateQueue, b.flags &= -2053, a.lanes &= ~e, Zi(a, b, e);
  I && d && vg(b);
  b.flags |= 1;
  Xi(a, b, c, e);
  return b.child;
}
function hj(a, b, c, d, e) {
  if (Zf(c)) {
    var f2 = true;
    cg(b);
  } else f2 = false;
  ch(b, e);
  if (null === b.stateNode) ij(a, b), Gi(b, c, d), Ii(b, c, d, e), d = true;
  else if (null === a) {
    var g = b.stateNode, h = b.memoizedProps;
    g.props = h;
    var k = g.context, l2 = c.contextType;
    "object" === typeof l2 && null !== l2 ? l2 = eh(l2) : (l2 = Zf(c) ? Xf : H.current, l2 = Yf(b, l2));
    var m2 = c.getDerivedStateFromProps, q2 = "function" === typeof m2 || "function" === typeof g.getSnapshotBeforeUpdate;
    q2 || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== d || k !== l2) && Hi(b, g, d, l2);
    jh = false;
    var r2 = b.memoizedState;
    g.state = r2;
    qh(b, d, g, e);
    k = b.memoizedState;
    h !== d || r2 !== k || Wf.current || jh ? ("function" === typeof m2 && (Di(b, c, m2, d), k = b.memoizedState), (h = jh || Fi(b, c, h, d, r2, k, l2)) ? (q2 || "function" !== typeof g.UNSAFE_componentWillMount && "function" !== typeof g.componentWillMount || ("function" === typeof g.componentWillMount && g.componentWillMount(), "function" === typeof g.UNSAFE_componentWillMount && g.UNSAFE_componentWillMount()), "function" === typeof g.componentDidMount && (b.flags |= 4194308)) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), b.memoizedProps = d, b.memoizedState = k), g.props = d, g.state = k, g.context = l2, d = h) : ("function" === typeof g.componentDidMount && (b.flags |= 4194308), d = false);
  } else {
    g = b.stateNode;
    lh(a, b);
    h = b.memoizedProps;
    l2 = b.type === b.elementType ? h : Ci(b.type, h);
    g.props = l2;
    q2 = b.pendingProps;
    r2 = g.context;
    k = c.contextType;
    "object" === typeof k && null !== k ? k = eh(k) : (k = Zf(c) ? Xf : H.current, k = Yf(b, k));
    var y2 = c.getDerivedStateFromProps;
    (m2 = "function" === typeof y2 || "function" === typeof g.getSnapshotBeforeUpdate) || "function" !== typeof g.UNSAFE_componentWillReceiveProps && "function" !== typeof g.componentWillReceiveProps || (h !== q2 || r2 !== k) && Hi(b, g, d, k);
    jh = false;
    r2 = b.memoizedState;
    g.state = r2;
    qh(b, d, g, e);
    var n2 = b.memoizedState;
    h !== q2 || r2 !== n2 || Wf.current || jh ? ("function" === typeof y2 && (Di(b, c, y2, d), n2 = b.memoizedState), (l2 = jh || Fi(b, c, l2, d, r2, n2, k) || false) ? (m2 || "function" !== typeof g.UNSAFE_componentWillUpdate && "function" !== typeof g.componentWillUpdate || ("function" === typeof g.componentWillUpdate && g.componentWillUpdate(d, n2, k), "function" === typeof g.UNSAFE_componentWillUpdate && g.UNSAFE_componentWillUpdate(d, n2, k)), "function" === typeof g.componentDidUpdate && (b.flags |= 4), "function" === typeof g.getSnapshotBeforeUpdate && (b.flags |= 1024)) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 1024), b.memoizedProps = d, b.memoizedState = n2), g.props = d, g.state = n2, g.context = k, d = l2) : ("function" !== typeof g.componentDidUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 4), "function" !== typeof g.getSnapshotBeforeUpdate || h === a.memoizedProps && r2 === a.memoizedState || (b.flags |= 1024), d = false);
  }
  return jj(a, b, c, d, f2, e);
}
function jj(a, b, c, d, e, f2) {
  gj(a, b);
  var g = 0 !== (b.flags & 128);
  if (!d && !g) return e && dg(b, c, false), Zi(a, b, f2);
  d = b.stateNode;
  Wi.current = b;
  var h = g && "function" !== typeof c.getDerivedStateFromError ? null : d.render();
  b.flags |= 1;
  null !== a && g ? (b.child = Ug(b, a.child, null, f2), b.child = Ug(b, null, h, f2)) : Xi(a, b, h, f2);
  b.memoizedState = d.state;
  e && dg(b, c, true);
  return b.child;
}
function kj(a) {
  var b = a.stateNode;
  b.pendingContext ? ag(a, b.pendingContext, b.pendingContext !== b.context) : b.context && ag(a, b.context, false);
  yh(a, b.containerInfo);
}
function lj(a, b, c, d, e) {
  Ig();
  Jg(e);
  b.flags |= 256;
  Xi(a, b, c, d);
  return b.child;
}
var mj = { dehydrated: null, treeContext: null, retryLane: 0 };
function nj(a) {
  return { baseLanes: a, cachePool: null, transitions: null };
}
function oj(a, b, c) {
  var d = b.pendingProps, e = L.current, f2 = false, g = 0 !== (b.flags & 128), h;
  (h = g) || (h = null !== a && null === a.memoizedState ? false : 0 !== (e & 2));
  if (h) f2 = true, b.flags &= -129;
  else if (null === a || null !== a.memoizedState) e |= 1;
  G(L, e & 1);
  if (null === a) {
    Eg(b);
    a = b.memoizedState;
    if (null !== a && (a = a.dehydrated, null !== a)) return 0 === (b.mode & 1) ? b.lanes = 1 : "$!" === a.data ? b.lanes = 8 : b.lanes = 1073741824, null;
    g = d.children;
    a = d.fallback;
    return f2 ? (d = b.mode, f2 = b.child, g = { mode: "hidden", children: g }, 0 === (d & 1) && null !== f2 ? (f2.childLanes = 0, f2.pendingProps = g) : f2 = pj(g, d, 0, null), a = Tg(a, d, c, null), f2.return = b, a.return = b, f2.sibling = a, b.child = f2, b.child.memoizedState = nj(c), b.memoizedState = mj, a) : qj(b, g);
  }
  e = a.memoizedState;
  if (null !== e && (h = e.dehydrated, null !== h)) return rj(a, b, g, d, h, e, c);
  if (f2) {
    f2 = d.fallback;
    g = b.mode;
    e = a.child;
    h = e.sibling;
    var k = { mode: "hidden", children: d.children };
    0 === (g & 1) && b.child !== e ? (d = b.child, d.childLanes = 0, d.pendingProps = k, b.deletions = null) : (d = Pg(e, k), d.subtreeFlags = e.subtreeFlags & 14680064);
    null !== h ? f2 = Pg(h, f2) : (f2 = Tg(f2, g, c, null), f2.flags |= 2);
    f2.return = b;
    d.return = b;
    d.sibling = f2;
    b.child = d;
    d = f2;
    f2 = b.child;
    g = a.child.memoizedState;
    g = null === g ? nj(c) : { baseLanes: g.baseLanes | c, cachePool: null, transitions: g.transitions };
    f2.memoizedState = g;
    f2.childLanes = a.childLanes & ~c;
    b.memoizedState = mj;
    return d;
  }
  f2 = a.child;
  a = f2.sibling;
  d = Pg(f2, { mode: "visible", children: d.children });
  0 === (b.mode & 1) && (d.lanes = c);
  d.return = b;
  d.sibling = null;
  null !== a && (c = b.deletions, null === c ? (b.deletions = [a], b.flags |= 16) : c.push(a));
  b.child = d;
  b.memoizedState = null;
  return d;
}
function qj(a, b) {
  b = pj({ mode: "visible", children: b }, a.mode, 0, null);
  b.return = a;
  return a.child = b;
}
function sj(a, b, c, d) {
  null !== d && Jg(d);
  Ug(b, a.child, null, c);
  a = qj(b, b.pendingProps.children);
  a.flags |= 2;
  b.memoizedState = null;
  return a;
}
function rj(a, b, c, d, e, f2, g) {
  if (c) {
    if (b.flags & 256) return b.flags &= -257, d = Ki(Error(p(422))), sj(a, b, g, d);
    if (null !== b.memoizedState) return b.child = a.child, b.flags |= 128, null;
    f2 = d.fallback;
    e = b.mode;
    d = pj({ mode: "visible", children: d.children }, e, 0, null);
    f2 = Tg(f2, e, g, null);
    f2.flags |= 2;
    d.return = b;
    f2.return = b;
    d.sibling = f2;
    b.child = d;
    0 !== (b.mode & 1) && Ug(b, a.child, null, g);
    b.child.memoizedState = nj(g);
    b.memoizedState = mj;
    return f2;
  }
  if (0 === (b.mode & 1)) return sj(a, b, g, null);
  if ("$!" === e.data) {
    d = e.nextSibling && e.nextSibling.dataset;
    if (d) var h = d.dgst;
    d = h;
    f2 = Error(p(419));
    d = Ki(f2, d, void 0);
    return sj(a, b, g, d);
  }
  h = 0 !== (g & a.childLanes);
  if (dh || h) {
    d = Q;
    if (null !== d) {
      switch (g & -g) {
        case 4:
          e = 2;
          break;
        case 16:
          e = 8;
          break;
        case 64:
        case 128:
        case 256:
        case 512:
        case 1024:
        case 2048:
        case 4096:
        case 8192:
        case 16384:
        case 32768:
        case 65536:
        case 131072:
        case 262144:
        case 524288:
        case 1048576:
        case 2097152:
        case 4194304:
        case 8388608:
        case 16777216:
        case 33554432:
        case 67108864:
          e = 32;
          break;
        case 536870912:
          e = 268435456;
          break;
        default:
          e = 0;
      }
      e = 0 !== (e & (d.suspendedLanes | g)) ? 0 : e;
      0 !== e && e !== f2.retryLane && (f2.retryLane = e, ih(a, e), gi(d, a, e, -1));
    }
    tj();
    d = Ki(Error(p(421)));
    return sj(a, b, g, d);
  }
  if ("$?" === e.data) return b.flags |= 128, b.child = a.child, b = uj.bind(null, a), e._reactRetry = b, null;
  a = f2.treeContext;
  yg = Lf(e.nextSibling);
  xg = b;
  I = true;
  zg = null;
  null !== a && (og[pg++] = rg, og[pg++] = sg, og[pg++] = qg, rg = a.id, sg = a.overflow, qg = b);
  b = qj(b, d.children);
  b.flags |= 4096;
  return b;
}
function vj(a, b, c) {
  a.lanes |= b;
  var d = a.alternate;
  null !== d && (d.lanes |= b);
  bh(a.return, b, c);
}
function wj(a, b, c, d, e) {
  var f2 = a.memoizedState;
  null === f2 ? a.memoizedState = { isBackwards: b, rendering: null, renderingStartTime: 0, last: d, tail: c, tailMode: e } : (f2.isBackwards = b, f2.rendering = null, f2.renderingStartTime = 0, f2.last = d, f2.tail = c, f2.tailMode = e);
}
function xj(a, b, c) {
  var d = b.pendingProps, e = d.revealOrder, f2 = d.tail;
  Xi(a, b, d.children, c);
  d = L.current;
  if (0 !== (d & 2)) d = d & 1 | 2, b.flags |= 128;
  else {
    if (null !== a && 0 !== (a.flags & 128)) a: for (a = b.child; null !== a; ) {
      if (13 === a.tag) null !== a.memoizedState && vj(a, c, b);
      else if (19 === a.tag) vj(a, c, b);
      else if (null !== a.child) {
        a.child.return = a;
        a = a.child;
        continue;
      }
      if (a === b) break a;
      for (; null === a.sibling; ) {
        if (null === a.return || a.return === b) break a;
        a = a.return;
      }
      a.sibling.return = a.return;
      a = a.sibling;
    }
    d &= 1;
  }
  G(L, d);
  if (0 === (b.mode & 1)) b.memoizedState = null;
  else switch (e) {
    case "forwards":
      c = b.child;
      for (e = null; null !== c; ) a = c.alternate, null !== a && null === Ch(a) && (e = c), c = c.sibling;
      c = e;
      null === c ? (e = b.child, b.child = null) : (e = c.sibling, c.sibling = null);
      wj(b, false, e, c, f2);
      break;
    case "backwards":
      c = null;
      e = b.child;
      for (b.child = null; null !== e; ) {
        a = e.alternate;
        if (null !== a && null === Ch(a)) {
          b.child = e;
          break;
        }
        a = e.sibling;
        e.sibling = c;
        c = e;
        e = a;
      }
      wj(b, true, c, null, f2);
      break;
    case "together":
      wj(b, false, null, null, void 0);
      break;
    default:
      b.memoizedState = null;
  }
  return b.child;
}
function ij(a, b) {
  0 === (b.mode & 1) && null !== a && (a.alternate = null, b.alternate = null, b.flags |= 2);
}
function Zi(a, b, c) {
  null !== a && (b.dependencies = a.dependencies);
  rh |= b.lanes;
  if (0 === (c & b.childLanes)) return null;
  if (null !== a && b.child !== a.child) throw Error(p(153));
  if (null !== b.child) {
    a = b.child;
    c = Pg(a, a.pendingProps);
    b.child = c;
    for (c.return = b; null !== a.sibling; ) a = a.sibling, c = c.sibling = Pg(a, a.pendingProps), c.return = b;
    c.sibling = null;
  }
  return b.child;
}
function yj(a, b, c) {
  switch (b.tag) {
    case 3:
      kj(b);
      Ig();
      break;
    case 5:
      Ah(b);
      break;
    case 1:
      Zf(b.type) && cg(b);
      break;
    case 4:
      yh(b, b.stateNode.containerInfo);
      break;
    case 10:
      var d = b.type._context, e = b.memoizedProps.value;
      G(Wg, d._currentValue);
      d._currentValue = e;
      break;
    case 13:
      d = b.memoizedState;
      if (null !== d) {
        if (null !== d.dehydrated) return G(L, L.current & 1), b.flags |= 128, null;
        if (0 !== (c & b.child.childLanes)) return oj(a, b, c);
        G(L, L.current & 1);
        a = Zi(a, b, c);
        return null !== a ? a.sibling : null;
      }
      G(L, L.current & 1);
      break;
    case 19:
      d = 0 !== (c & b.childLanes);
      if (0 !== (a.flags & 128)) {
        if (d) return xj(a, b, c);
        b.flags |= 128;
      }
      e = b.memoizedState;
      null !== e && (e.rendering = null, e.tail = null, e.lastEffect = null);
      G(L, L.current);
      if (d) break;
      else return null;
    case 22:
    case 23:
      return b.lanes = 0, dj(a, b, c);
  }
  return Zi(a, b, c);
}
var zj, Aj, Bj, Cj;
zj = function(a, b) {
  for (var c = b.child; null !== c; ) {
    if (5 === c.tag || 6 === c.tag) a.appendChild(c.stateNode);
    else if (4 !== c.tag && null !== c.child) {
      c.child.return = c;
      c = c.child;
      continue;
    }
    if (c === b) break;
    for (; null === c.sibling; ) {
      if (null === c.return || c.return === b) return;
      c = c.return;
    }
    c.sibling.return = c.return;
    c = c.sibling;
  }
};
Aj = function() {
};
Bj = function(a, b, c, d) {
  var e = a.memoizedProps;
  if (e !== d) {
    a = b.stateNode;
    xh(uh.current);
    var f2 = null;
    switch (c) {
      case "input":
        e = Ya(a, e);
        d = Ya(a, d);
        f2 = [];
        break;
      case "select":
        e = A({}, e, { value: void 0 });
        d = A({}, d, { value: void 0 });
        f2 = [];
        break;
      case "textarea":
        e = gb(a, e);
        d = gb(a, d);
        f2 = [];
        break;
      default:
        "function" !== typeof e.onClick && "function" === typeof d.onClick && (a.onclick = Bf);
    }
    ub(c, d);
    var g;
    c = null;
    for (l2 in e) if (!d.hasOwnProperty(l2) && e.hasOwnProperty(l2) && null != e[l2]) if ("style" === l2) {
      var h = e[l2];
      for (g in h) h.hasOwnProperty(g) && (c || (c = {}), c[g] = "");
    } else "dangerouslySetInnerHTML" !== l2 && "children" !== l2 && "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && "autoFocus" !== l2 && (ea.hasOwnProperty(l2) ? f2 || (f2 = []) : (f2 = f2 || []).push(l2, null));
    for (l2 in d) {
      var k = d[l2];
      h = null != e ? e[l2] : void 0;
      if (d.hasOwnProperty(l2) && k !== h && (null != k || null != h)) if ("style" === l2) if (h) {
        for (g in h) !h.hasOwnProperty(g) || k && k.hasOwnProperty(g) || (c || (c = {}), c[g] = "");
        for (g in k) k.hasOwnProperty(g) && h[g] !== k[g] && (c || (c = {}), c[g] = k[g]);
      } else c || (f2 || (f2 = []), f2.push(
        l2,
        c
      )), c = k;
      else "dangerouslySetInnerHTML" === l2 ? (k = k ? k.__html : void 0, h = h ? h.__html : void 0, null != k && h !== k && (f2 = f2 || []).push(l2, k)) : "children" === l2 ? "string" !== typeof k && "number" !== typeof k || (f2 = f2 || []).push(l2, "" + k) : "suppressContentEditableWarning" !== l2 && "suppressHydrationWarning" !== l2 && (ea.hasOwnProperty(l2) ? (null != k && "onScroll" === l2 && D("scroll", a), f2 || h === k || (f2 = [])) : (f2 = f2 || []).push(l2, k));
    }
    c && (f2 = f2 || []).push("style", c);
    var l2 = f2;
    if (b.updateQueue = l2) b.flags |= 4;
  }
};
Cj = function(a, b, c, d) {
  c !== d && (b.flags |= 4);
};
function Dj(a, b) {
  if (!I) switch (a.tailMode) {
    case "hidden":
      b = a.tail;
      for (var c = null; null !== b; ) null !== b.alternate && (c = b), b = b.sibling;
      null === c ? a.tail = null : c.sibling = null;
      break;
    case "collapsed":
      c = a.tail;
      for (var d = null; null !== c; ) null !== c.alternate && (d = c), c = c.sibling;
      null === d ? b || null === a.tail ? a.tail = null : a.tail.sibling = null : d.sibling = null;
  }
}
function S(a) {
  var b = null !== a.alternate && a.alternate.child === a.child, c = 0, d = 0;
  if (b) for (var e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags & 14680064, d |= e.flags & 14680064, e.return = a, e = e.sibling;
  else for (e = a.child; null !== e; ) c |= e.lanes | e.childLanes, d |= e.subtreeFlags, d |= e.flags, e.return = a, e = e.sibling;
  a.subtreeFlags |= d;
  a.childLanes = c;
  return b;
}
function Ej(a, b, c) {
  var d = b.pendingProps;
  wg(b);
  switch (b.tag) {
    case 2:
    case 16:
    case 15:
    case 0:
    case 11:
    case 7:
    case 8:
    case 12:
    case 9:
    case 14:
      return S(b), null;
    case 1:
      return Zf(b.type) && $f(), S(b), null;
    case 3:
      d = b.stateNode;
      zh();
      E(Wf);
      E(H);
      Eh();
      d.pendingContext && (d.context = d.pendingContext, d.pendingContext = null);
      if (null === a || null === a.child) Gg(b) ? b.flags |= 4 : null === a || a.memoizedState.isDehydrated && 0 === (b.flags & 256) || (b.flags |= 1024, null !== zg && (Fj(zg), zg = null));
      Aj(a, b);
      S(b);
      return null;
    case 5:
      Bh(b);
      var e = xh(wh.current);
      c = b.type;
      if (null !== a && null != b.stateNode) Bj(a, b, c, d, e), a.ref !== b.ref && (b.flags |= 512, b.flags |= 2097152);
      else {
        if (!d) {
          if (null === b.stateNode) throw Error(p(166));
          S(b);
          return null;
        }
        a = xh(uh.current);
        if (Gg(b)) {
          d = b.stateNode;
          c = b.type;
          var f2 = b.memoizedProps;
          d[Of] = b;
          d[Pf] = f2;
          a = 0 !== (b.mode & 1);
          switch (c) {
            case "dialog":
              D("cancel", d);
              D("close", d);
              break;
            case "iframe":
            case "object":
            case "embed":
              D("load", d);
              break;
            case "video":
            case "audio":
              for (e = 0; e < lf.length; e++) D(lf[e], d);
              break;
            case "source":
              D("error", d);
              break;
            case "img":
            case "image":
            case "link":
              D(
                "error",
                d
              );
              D("load", d);
              break;
            case "details":
              D("toggle", d);
              break;
            case "input":
              Za(d, f2);
              D("invalid", d);
              break;
            case "select":
              d._wrapperState = { wasMultiple: !!f2.multiple };
              D("invalid", d);
              break;
            case "textarea":
              hb(d, f2), D("invalid", d);
          }
          ub(c, f2);
          e = null;
          for (var g in f2) if (f2.hasOwnProperty(g)) {
            var h = f2[g];
            "children" === g ? "string" === typeof h ? d.textContent !== h && (true !== f2.suppressHydrationWarning && Af(d.textContent, h, a), e = ["children", h]) : "number" === typeof h && d.textContent !== "" + h && (true !== f2.suppressHydrationWarning && Af(
              d.textContent,
              h,
              a
            ), e = ["children", "" + h]) : ea.hasOwnProperty(g) && null != h && "onScroll" === g && D("scroll", d);
          }
          switch (c) {
            case "input":
              Va(d);
              db(d, f2, true);
              break;
            case "textarea":
              Va(d);
              jb(d);
              break;
            case "select":
            case "option":
              break;
            default:
              "function" === typeof f2.onClick && (d.onclick = Bf);
          }
          d = e;
          b.updateQueue = d;
          null !== d && (b.flags |= 4);
        } else {
          g = 9 === e.nodeType ? e : e.ownerDocument;
          "http://www.w3.org/1999/xhtml" === a && (a = kb(c));
          "http://www.w3.org/1999/xhtml" === a ? "script" === c ? (a = g.createElement("div"), a.innerHTML = "<script><\/script>", a = a.removeChild(a.firstChild)) : "string" === typeof d.is ? a = g.createElement(c, { is: d.is }) : (a = g.createElement(c), "select" === c && (g = a, d.multiple ? g.multiple = true : d.size && (g.size = d.size))) : a = g.createElementNS(a, c);
          a[Of] = b;
          a[Pf] = d;
          zj(a, b, false, false);
          b.stateNode = a;
          a: {
            g = vb(c, d);
            switch (c) {
              case "dialog":
                D("cancel", a);
                D("close", a);
                e = d;
                break;
              case "iframe":
              case "object":
              case "embed":
                D("load", a);
                e = d;
                break;
              case "video":
              case "audio":
                for (e = 0; e < lf.length; e++) D(lf[e], a);
                e = d;
                break;
              case "source":
                D("error", a);
                e = d;
                break;
              case "img":
              case "image":
              case "link":
                D(
                  "error",
                  a
                );
                D("load", a);
                e = d;
                break;
              case "details":
                D("toggle", a);
                e = d;
                break;
              case "input":
                Za(a, d);
                e = Ya(a, d);
                D("invalid", a);
                break;
              case "option":
                e = d;
                break;
              case "select":
                a._wrapperState = { wasMultiple: !!d.multiple };
                e = A({}, d, { value: void 0 });
                D("invalid", a);
                break;
              case "textarea":
                hb(a, d);
                e = gb(a, d);
                D("invalid", a);
                break;
              default:
                e = d;
            }
            ub(c, e);
            h = e;
            for (f2 in h) if (h.hasOwnProperty(f2)) {
              var k = h[f2];
              "style" === f2 ? sb(a, k) : "dangerouslySetInnerHTML" === f2 ? (k = k ? k.__html : void 0, null != k && nb(a, k)) : "children" === f2 ? "string" === typeof k ? ("textarea" !== c || "" !== k) && ob(a, k) : "number" === typeof k && ob(a, "" + k) : "suppressContentEditableWarning" !== f2 && "suppressHydrationWarning" !== f2 && "autoFocus" !== f2 && (ea.hasOwnProperty(f2) ? null != k && "onScroll" === f2 && D("scroll", a) : null != k && ta(a, f2, k, g));
            }
            switch (c) {
              case "input":
                Va(a);
                db(a, d, false);
                break;
              case "textarea":
                Va(a);
                jb(a);
                break;
              case "option":
                null != d.value && a.setAttribute("value", "" + Sa(d.value));
                break;
              case "select":
                a.multiple = !!d.multiple;
                f2 = d.value;
                null != f2 ? fb(a, !!d.multiple, f2, false) : null != d.defaultValue && fb(
                  a,
                  !!d.multiple,
                  d.defaultValue,
                  true
                );
                break;
              default:
                "function" === typeof e.onClick && (a.onclick = Bf);
            }
            switch (c) {
              case "button":
              case "input":
              case "select":
              case "textarea":
                d = !!d.autoFocus;
                break a;
              case "img":
                d = true;
                break a;
              default:
                d = false;
            }
          }
          d && (b.flags |= 4);
        }
        null !== b.ref && (b.flags |= 512, b.flags |= 2097152);
      }
      S(b);
      return null;
    case 6:
      if (a && null != b.stateNode) Cj(a, b, a.memoizedProps, d);
      else {
        if ("string" !== typeof d && null === b.stateNode) throw Error(p(166));
        c = xh(wh.current);
        xh(uh.current);
        if (Gg(b)) {
          d = b.stateNode;
          c = b.memoizedProps;
          d[Of] = b;
          if (f2 = d.nodeValue !== c) {
            if (a = xg, null !== a) switch (a.tag) {
              case 3:
                Af(d.nodeValue, c, 0 !== (a.mode & 1));
                break;
              case 5:
                true !== a.memoizedProps.suppressHydrationWarning && Af(d.nodeValue, c, 0 !== (a.mode & 1));
            }
          }
          f2 && (b.flags |= 4);
        } else d = (9 === c.nodeType ? c : c.ownerDocument).createTextNode(d), d[Of] = b, b.stateNode = d;
      }
      S(b);
      return null;
    case 13:
      E(L);
      d = b.memoizedState;
      if (null === a || null !== a.memoizedState && null !== a.memoizedState.dehydrated) {
        if (I && null !== yg && 0 !== (b.mode & 1) && 0 === (b.flags & 128)) Hg(), Ig(), b.flags |= 98560, f2 = false;
        else if (f2 = Gg(b), null !== d && null !== d.dehydrated) {
          if (null === a) {
            if (!f2) throw Error(p(318));
            f2 = b.memoizedState;
            f2 = null !== f2 ? f2.dehydrated : null;
            if (!f2) throw Error(p(317));
            f2[Of] = b;
          } else Ig(), 0 === (b.flags & 128) && (b.memoizedState = null), b.flags |= 4;
          S(b);
          f2 = false;
        } else null !== zg && (Fj(zg), zg = null), f2 = true;
        if (!f2) return b.flags & 65536 ? b : null;
      }
      if (0 !== (b.flags & 128)) return b.lanes = c, b;
      d = null !== d;
      d !== (null !== a && null !== a.memoizedState) && d && (b.child.flags |= 8192, 0 !== (b.mode & 1) && (null === a || 0 !== (L.current & 1) ? 0 === T && (T = 3) : tj()));
      null !== b.updateQueue && (b.flags |= 4);
      S(b);
      return null;
    case 4:
      return zh(), Aj(a, b), null === a && sf(b.stateNode.containerInfo), S(b), null;
    case 10:
      return ah(b.type._context), S(b), null;
    case 17:
      return Zf(b.type) && $f(), S(b), null;
    case 19:
      E(L);
      f2 = b.memoizedState;
      if (null === f2) return S(b), null;
      d = 0 !== (b.flags & 128);
      g = f2.rendering;
      if (null === g) if (d) Dj(f2, false);
      else {
        if (0 !== T || null !== a && 0 !== (a.flags & 128)) for (a = b.child; null !== a; ) {
          g = Ch(a);
          if (null !== g) {
            b.flags |= 128;
            Dj(f2, false);
            d = g.updateQueue;
            null !== d && (b.updateQueue = d, b.flags |= 4);
            b.subtreeFlags = 0;
            d = c;
            for (c = b.child; null !== c; ) f2 = c, a = d, f2.flags &= 14680066, g = f2.alternate, null === g ? (f2.childLanes = 0, f2.lanes = a, f2.child = null, f2.subtreeFlags = 0, f2.memoizedProps = null, f2.memoizedState = null, f2.updateQueue = null, f2.dependencies = null, f2.stateNode = null) : (f2.childLanes = g.childLanes, f2.lanes = g.lanes, f2.child = g.child, f2.subtreeFlags = 0, f2.deletions = null, f2.memoizedProps = g.memoizedProps, f2.memoizedState = g.memoizedState, f2.updateQueue = g.updateQueue, f2.type = g.type, a = g.dependencies, f2.dependencies = null === a ? null : { lanes: a.lanes, firstContext: a.firstContext }), c = c.sibling;
            G(L, L.current & 1 | 2);
            return b.child;
          }
          a = a.sibling;
        }
        null !== f2.tail && B() > Gj && (b.flags |= 128, d = true, Dj(f2, false), b.lanes = 4194304);
      }
      else {
        if (!d) if (a = Ch(g), null !== a) {
          if (b.flags |= 128, d = true, c = a.updateQueue, null !== c && (b.updateQueue = c, b.flags |= 4), Dj(f2, true), null === f2.tail && "hidden" === f2.tailMode && !g.alternate && !I) return S(b), null;
        } else 2 * B() - f2.renderingStartTime > Gj && 1073741824 !== c && (b.flags |= 128, d = true, Dj(f2, false), b.lanes = 4194304);
        f2.isBackwards ? (g.sibling = b.child, b.child = g) : (c = f2.last, null !== c ? c.sibling = g : b.child = g, f2.last = g);
      }
      if (null !== f2.tail) return b = f2.tail, f2.rendering = b, f2.tail = b.sibling, f2.renderingStartTime = B(), b.sibling = null, c = L.current, G(L, d ? c & 1 | 2 : c & 1), b;
      S(b);
      return null;
    case 22:
    case 23:
      return Hj(), d = null !== b.memoizedState, null !== a && null !== a.memoizedState !== d && (b.flags |= 8192), d && 0 !== (b.mode & 1) ? 0 !== (fj & 1073741824) && (S(b), b.subtreeFlags & 6 && (b.flags |= 8192)) : S(b), null;
    case 24:
      return null;
    case 25:
      return null;
  }
  throw Error(p(156, b.tag));
}
function Ij(a, b) {
  wg(b);
  switch (b.tag) {
    case 1:
      return Zf(b.type) && $f(), a = b.flags, a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
    case 3:
      return zh(), E(Wf), E(H), Eh(), a = b.flags, 0 !== (a & 65536) && 0 === (a & 128) ? (b.flags = a & -65537 | 128, b) : null;
    case 5:
      return Bh(b), null;
    case 13:
      E(L);
      a = b.memoizedState;
      if (null !== a && null !== a.dehydrated) {
        if (null === b.alternate) throw Error(p(340));
        Ig();
      }
      a = b.flags;
      return a & 65536 ? (b.flags = a & -65537 | 128, b) : null;
    case 19:
      return E(L), null;
    case 4:
      return zh(), null;
    case 10:
      return ah(b.type._context), null;
    case 22:
    case 23:
      return Hj(), null;
    case 24:
      return null;
    default:
      return null;
  }
}
var Jj = false, U = false, Kj = "function" === typeof WeakSet ? WeakSet : Set, V = null;
function Lj(a, b) {
  var c = a.ref;
  if (null !== c) if ("function" === typeof c) try {
    c(null);
  } catch (d) {
    W(a, b, d);
  }
  else c.current = null;
}
function Mj(a, b, c) {
  try {
    c();
  } catch (d) {
    W(a, b, d);
  }
}
var Nj = false;
function Oj(a, b) {
  Cf = dd;
  a = Me();
  if (Ne(a)) {
    if ("selectionStart" in a) var c = { start: a.selectionStart, end: a.selectionEnd };
    else a: {
      c = (c = a.ownerDocument) && c.defaultView || window;
      var d = c.getSelection && c.getSelection();
      if (d && 0 !== d.rangeCount) {
        c = d.anchorNode;
        var e = d.anchorOffset, f2 = d.focusNode;
        d = d.focusOffset;
        try {
          c.nodeType, f2.nodeType;
        } catch (F2) {
          c = null;
          break a;
        }
        var g = 0, h = -1, k = -1, l2 = 0, m2 = 0, q2 = a, r2 = null;
        b: for (; ; ) {
          for (var y2; ; ) {
            q2 !== c || 0 !== e && 3 !== q2.nodeType || (h = g + e);
            q2 !== f2 || 0 !== d && 3 !== q2.nodeType || (k = g + d);
            3 === q2.nodeType && (g += q2.nodeValue.length);
            if (null === (y2 = q2.firstChild)) break;
            r2 = q2;
            q2 = y2;
          }
          for (; ; ) {
            if (q2 === a) break b;
            r2 === c && ++l2 === e && (h = g);
            r2 === f2 && ++m2 === d && (k = g);
            if (null !== (y2 = q2.nextSibling)) break;
            q2 = r2;
            r2 = q2.parentNode;
          }
          q2 = y2;
        }
        c = -1 === h || -1 === k ? null : { start: h, end: k };
      } else c = null;
    }
    c = c || { start: 0, end: 0 };
  } else c = null;
  Df = { focusedElem: a, selectionRange: c };
  dd = false;
  for (V = b; null !== V; ) if (b = V, a = b.child, 0 !== (b.subtreeFlags & 1028) && null !== a) a.return = b, V = a;
  else for (; null !== V; ) {
    b = V;
    try {
      var n2 = b.alternate;
      if (0 !== (b.flags & 1024)) switch (b.tag) {
        case 0:
        case 11:
        case 15:
          break;
        case 1:
          if (null !== n2) {
            var t2 = n2.memoizedProps, J2 = n2.memoizedState, x2 = b.stateNode, w2 = x2.getSnapshotBeforeUpdate(b.elementType === b.type ? t2 : Ci(b.type, t2), J2);
            x2.__reactInternalSnapshotBeforeUpdate = w2;
          }
          break;
        case 3:
          var u2 = b.stateNode.containerInfo;
          1 === u2.nodeType ? u2.textContent = "" : 9 === u2.nodeType && u2.documentElement && u2.removeChild(u2.documentElement);
          break;
        case 5:
        case 6:
        case 4:
        case 17:
          break;
        default:
          throw Error(p(163));
      }
    } catch (F2) {
      W(b, b.return, F2);
    }
    a = b.sibling;
    if (null !== a) {
      a.return = b.return;
      V = a;
      break;
    }
    V = b.return;
  }
  n2 = Nj;
  Nj = false;
  return n2;
}
function Pj(a, b, c) {
  var d = b.updateQueue;
  d = null !== d ? d.lastEffect : null;
  if (null !== d) {
    var e = d = d.next;
    do {
      if ((e.tag & a) === a) {
        var f2 = e.destroy;
        e.destroy = void 0;
        void 0 !== f2 && Mj(b, c, f2);
      }
      e = e.next;
    } while (e !== d);
  }
}
function Qj(a, b) {
  b = b.updateQueue;
  b = null !== b ? b.lastEffect : null;
  if (null !== b) {
    var c = b = b.next;
    do {
      if ((c.tag & a) === a) {
        var d = c.create;
        c.destroy = d();
      }
      c = c.next;
    } while (c !== b);
  }
}
function Rj(a) {
  var b = a.ref;
  if (null !== b) {
    var c = a.stateNode;
    switch (a.tag) {
      case 5:
        a = c;
        break;
      default:
        a = c;
    }
    "function" === typeof b ? b(a) : b.current = a;
  }
}
function Sj(a) {
  var b = a.alternate;
  null !== b && (a.alternate = null, Sj(b));
  a.child = null;
  a.deletions = null;
  a.sibling = null;
  5 === a.tag && (b = a.stateNode, null !== b && (delete b[Of], delete b[Pf], delete b[of], delete b[Qf], delete b[Rf]));
  a.stateNode = null;
  a.return = null;
  a.dependencies = null;
  a.memoizedProps = null;
  a.memoizedState = null;
  a.pendingProps = null;
  a.stateNode = null;
  a.updateQueue = null;
}
function Tj(a) {
  return 5 === a.tag || 3 === a.tag || 4 === a.tag;
}
function Uj(a) {
  a: for (; ; ) {
    for (; null === a.sibling; ) {
      if (null === a.return || Tj(a.return)) return null;
      a = a.return;
    }
    a.sibling.return = a.return;
    for (a = a.sibling; 5 !== a.tag && 6 !== a.tag && 18 !== a.tag; ) {
      if (a.flags & 2) continue a;
      if (null === a.child || 4 === a.tag) continue a;
      else a.child.return = a, a = a.child;
    }
    if (!(a.flags & 2)) return a.stateNode;
  }
}
function Vj(a, b, c) {
  var d = a.tag;
  if (5 === d || 6 === d) a = a.stateNode, b ? 8 === c.nodeType ? c.parentNode.insertBefore(a, b) : c.insertBefore(a, b) : (8 === c.nodeType ? (b = c.parentNode, b.insertBefore(a, c)) : (b = c, b.appendChild(a)), c = c._reactRootContainer, null !== c && void 0 !== c || null !== b.onclick || (b.onclick = Bf));
  else if (4 !== d && (a = a.child, null !== a)) for (Vj(a, b, c), a = a.sibling; null !== a; ) Vj(a, b, c), a = a.sibling;
}
function Wj(a, b, c) {
  var d = a.tag;
  if (5 === d || 6 === d) a = a.stateNode, b ? c.insertBefore(a, b) : c.appendChild(a);
  else if (4 !== d && (a = a.child, null !== a)) for (Wj(a, b, c), a = a.sibling; null !== a; ) Wj(a, b, c), a = a.sibling;
}
var X = null, Xj = false;
function Yj(a, b, c) {
  for (c = c.child; null !== c; ) Zj(a, b, c), c = c.sibling;
}
function Zj(a, b, c) {
  if (lc && "function" === typeof lc.onCommitFiberUnmount) try {
    lc.onCommitFiberUnmount(kc, c);
  } catch (h) {
  }
  switch (c.tag) {
    case 5:
      U || Lj(c, b);
    case 6:
      var d = X, e = Xj;
      X = null;
      Yj(a, b, c);
      X = d;
      Xj = e;
      null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? a.parentNode.removeChild(c) : a.removeChild(c)) : X.removeChild(c.stateNode));
      break;
    case 18:
      null !== X && (Xj ? (a = X, c = c.stateNode, 8 === a.nodeType ? Kf(a.parentNode, c) : 1 === a.nodeType && Kf(a, c), bd(a)) : Kf(X, c.stateNode));
      break;
    case 4:
      d = X;
      e = Xj;
      X = c.stateNode.containerInfo;
      Xj = true;
      Yj(a, b, c);
      X = d;
      Xj = e;
      break;
    case 0:
    case 11:
    case 14:
    case 15:
      if (!U && (d = c.updateQueue, null !== d && (d = d.lastEffect, null !== d))) {
        e = d = d.next;
        do {
          var f2 = e, g = f2.destroy;
          f2 = f2.tag;
          void 0 !== g && (0 !== (f2 & 2) ? Mj(c, b, g) : 0 !== (f2 & 4) && Mj(c, b, g));
          e = e.next;
        } while (e !== d);
      }
      Yj(a, b, c);
      break;
    case 1:
      if (!U && (Lj(c, b), d = c.stateNode, "function" === typeof d.componentWillUnmount)) try {
        d.props = c.memoizedProps, d.state = c.memoizedState, d.componentWillUnmount();
      } catch (h) {
        W(c, b, h);
      }
      Yj(a, b, c);
      break;
    case 21:
      Yj(a, b, c);
      break;
    case 22:
      c.mode & 1 ? (U = (d = U) || null !== c.memoizedState, Yj(a, b, c), U = d) : Yj(a, b, c);
      break;
    default:
      Yj(a, b, c);
  }
}
function ak(a) {
  var b = a.updateQueue;
  if (null !== b) {
    a.updateQueue = null;
    var c = a.stateNode;
    null === c && (c = a.stateNode = new Kj());
    b.forEach(function(b2) {
      var d = bk.bind(null, a, b2);
      c.has(b2) || (c.add(b2), b2.then(d, d));
    });
  }
}
function ck(a, b) {
  var c = b.deletions;
  if (null !== c) for (var d = 0; d < c.length; d++) {
    var e = c[d];
    try {
      var f2 = a, g = b, h = g;
      a: for (; null !== h; ) {
        switch (h.tag) {
          case 5:
            X = h.stateNode;
            Xj = false;
            break a;
          case 3:
            X = h.stateNode.containerInfo;
            Xj = true;
            break a;
          case 4:
            X = h.stateNode.containerInfo;
            Xj = true;
            break a;
        }
        h = h.return;
      }
      if (null === X) throw Error(p(160));
      Zj(f2, g, e);
      X = null;
      Xj = false;
      var k = e.alternate;
      null !== k && (k.return = null);
      e.return = null;
    } catch (l2) {
      W(e, b, l2);
    }
  }
  if (b.subtreeFlags & 12854) for (b = b.child; null !== b; ) dk(b, a), b = b.sibling;
}
function dk(a, b) {
  var c = a.alternate, d = a.flags;
  switch (a.tag) {
    case 0:
    case 11:
    case 14:
    case 15:
      ck(b, a);
      ek(a);
      if (d & 4) {
        try {
          Pj(3, a, a.return), Qj(3, a);
        } catch (t2) {
          W(a, a.return, t2);
        }
        try {
          Pj(5, a, a.return);
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 1:
      ck(b, a);
      ek(a);
      d & 512 && null !== c && Lj(c, c.return);
      break;
    case 5:
      ck(b, a);
      ek(a);
      d & 512 && null !== c && Lj(c, c.return);
      if (a.flags & 32) {
        var e = a.stateNode;
        try {
          ob(e, "");
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      if (d & 4 && (e = a.stateNode, null != e)) {
        var f2 = a.memoizedProps, g = null !== c ? c.memoizedProps : f2, h = a.type, k = a.updateQueue;
        a.updateQueue = null;
        if (null !== k) try {
          "input" === h && "radio" === f2.type && null != f2.name && ab(e, f2);
          vb(h, g);
          var l2 = vb(h, f2);
          for (g = 0; g < k.length; g += 2) {
            var m2 = k[g], q2 = k[g + 1];
            "style" === m2 ? sb(e, q2) : "dangerouslySetInnerHTML" === m2 ? nb(e, q2) : "children" === m2 ? ob(e, q2) : ta(e, m2, q2, l2);
          }
          switch (h) {
            case "input":
              bb(e, f2);
              break;
            case "textarea":
              ib(e, f2);
              break;
            case "select":
              var r2 = e._wrapperState.wasMultiple;
              e._wrapperState.wasMultiple = !!f2.multiple;
              var y2 = f2.value;
              null != y2 ? fb(e, !!f2.multiple, y2, false) : r2 !== !!f2.multiple && (null != f2.defaultValue ? fb(
                e,
                !!f2.multiple,
                f2.defaultValue,
                true
              ) : fb(e, !!f2.multiple, f2.multiple ? [] : "", false));
          }
          e[Pf] = f2;
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 6:
      ck(b, a);
      ek(a);
      if (d & 4) {
        if (null === a.stateNode) throw Error(p(162));
        e = a.stateNode;
        f2 = a.memoizedProps;
        try {
          e.nodeValue = f2;
        } catch (t2) {
          W(a, a.return, t2);
        }
      }
      break;
    case 3:
      ck(b, a);
      ek(a);
      if (d & 4 && null !== c && c.memoizedState.isDehydrated) try {
        bd(b.containerInfo);
      } catch (t2) {
        W(a, a.return, t2);
      }
      break;
    case 4:
      ck(b, a);
      ek(a);
      break;
    case 13:
      ck(b, a);
      ek(a);
      e = a.child;
      e.flags & 8192 && (f2 = null !== e.memoizedState, e.stateNode.isHidden = f2, !f2 || null !== e.alternate && null !== e.alternate.memoizedState || (fk = B()));
      d & 4 && ak(a);
      break;
    case 22:
      m2 = null !== c && null !== c.memoizedState;
      a.mode & 1 ? (U = (l2 = U) || m2, ck(b, a), U = l2) : ck(b, a);
      ek(a);
      if (d & 8192) {
        l2 = null !== a.memoizedState;
        if ((a.stateNode.isHidden = l2) && !m2 && 0 !== (a.mode & 1)) for (V = a, m2 = a.child; null !== m2; ) {
          for (q2 = V = m2; null !== V; ) {
            r2 = V;
            y2 = r2.child;
            switch (r2.tag) {
              case 0:
              case 11:
              case 14:
              case 15:
                Pj(4, r2, r2.return);
                break;
              case 1:
                Lj(r2, r2.return);
                var n2 = r2.stateNode;
                if ("function" === typeof n2.componentWillUnmount) {
                  d = r2;
                  c = r2.return;
                  try {
                    b = d, n2.props = b.memoizedProps, n2.state = b.memoizedState, n2.componentWillUnmount();
                  } catch (t2) {
                    W(d, c, t2);
                  }
                }
                break;
              case 5:
                Lj(r2, r2.return);
                break;
              case 22:
                if (null !== r2.memoizedState) {
                  gk(q2);
                  continue;
                }
            }
            null !== y2 ? (y2.return = r2, V = y2) : gk(q2);
          }
          m2 = m2.sibling;
        }
        a: for (m2 = null, q2 = a; ; ) {
          if (5 === q2.tag) {
            if (null === m2) {
              m2 = q2;
              try {
                e = q2.stateNode, l2 ? (f2 = e.style, "function" === typeof f2.setProperty ? f2.setProperty("display", "none", "important") : f2.display = "none") : (h = q2.stateNode, k = q2.memoizedProps.style, g = void 0 !== k && null !== k && k.hasOwnProperty("display") ? k.display : null, h.style.display = rb("display", g));
              } catch (t2) {
                W(a, a.return, t2);
              }
            }
          } else if (6 === q2.tag) {
            if (null === m2) try {
              q2.stateNode.nodeValue = l2 ? "" : q2.memoizedProps;
            } catch (t2) {
              W(a, a.return, t2);
            }
          } else if ((22 !== q2.tag && 23 !== q2.tag || null === q2.memoizedState || q2 === a) && null !== q2.child) {
            q2.child.return = q2;
            q2 = q2.child;
            continue;
          }
          if (q2 === a) break a;
          for (; null === q2.sibling; ) {
            if (null === q2.return || q2.return === a) break a;
            m2 === q2 && (m2 = null);
            q2 = q2.return;
          }
          m2 === q2 && (m2 = null);
          q2.sibling.return = q2.return;
          q2 = q2.sibling;
        }
      }
      break;
    case 19:
      ck(b, a);
      ek(a);
      d & 4 && ak(a);
      break;
    case 21:
      break;
    default:
      ck(
        b,
        a
      ), ek(a);
  }
}
function ek(a) {
  var b = a.flags;
  if (b & 2) {
    try {
      a: {
        for (var c = a.return; null !== c; ) {
          if (Tj(c)) {
            var d = c;
            break a;
          }
          c = c.return;
        }
        throw Error(p(160));
      }
      switch (d.tag) {
        case 5:
          var e = d.stateNode;
          d.flags & 32 && (ob(e, ""), d.flags &= -33);
          var f2 = Uj(a);
          Wj(a, f2, e);
          break;
        case 3:
        case 4:
          var g = d.stateNode.containerInfo, h = Uj(a);
          Vj(a, h, g);
          break;
        default:
          throw Error(p(161));
      }
    } catch (k) {
      W(a, a.return, k);
    }
    a.flags &= -3;
  }
  b & 4096 && (a.flags &= -4097);
}
function hk(a, b, c) {
  V = a;
  ik(a);
}
function ik(a, b, c) {
  for (var d = 0 !== (a.mode & 1); null !== V; ) {
    var e = V, f2 = e.child;
    if (22 === e.tag && d) {
      var g = null !== e.memoizedState || Jj;
      if (!g) {
        var h = e.alternate, k = null !== h && null !== h.memoizedState || U;
        h = Jj;
        var l2 = U;
        Jj = g;
        if ((U = k) && !l2) for (V = e; null !== V; ) g = V, k = g.child, 22 === g.tag && null !== g.memoizedState ? jk(e) : null !== k ? (k.return = g, V = k) : jk(e);
        for (; null !== f2; ) V = f2, ik(f2), f2 = f2.sibling;
        V = e;
        Jj = h;
        U = l2;
      }
      kk(a);
    } else 0 !== (e.subtreeFlags & 8772) && null !== f2 ? (f2.return = e, V = f2) : kk(a);
  }
}
function kk(a) {
  for (; null !== V; ) {
    var b = V;
    if (0 !== (b.flags & 8772)) {
      var c = b.alternate;
      try {
        if (0 !== (b.flags & 8772)) switch (b.tag) {
          case 0:
          case 11:
          case 15:
            U || Qj(5, b);
            break;
          case 1:
            var d = b.stateNode;
            if (b.flags & 4 && !U) if (null === c) d.componentDidMount();
            else {
              var e = b.elementType === b.type ? c.memoizedProps : Ci(b.type, c.memoizedProps);
              d.componentDidUpdate(e, c.memoizedState, d.__reactInternalSnapshotBeforeUpdate);
            }
            var f2 = b.updateQueue;
            null !== f2 && sh(b, f2, d);
            break;
          case 3:
            var g = b.updateQueue;
            if (null !== g) {
              c = null;
              if (null !== b.child) switch (b.child.tag) {
                case 5:
                  c = b.child.stateNode;
                  break;
                case 1:
                  c = b.child.stateNode;
              }
              sh(b, g, c);
            }
            break;
          case 5:
            var h = b.stateNode;
            if (null === c && b.flags & 4) {
              c = h;
              var k = b.memoizedProps;
              switch (b.type) {
                case "button":
                case "input":
                case "select":
                case "textarea":
                  k.autoFocus && c.focus();
                  break;
                case "img":
                  k.src && (c.src = k.src);
              }
            }
            break;
          case 6:
            break;
          case 4:
            break;
          case 12:
            break;
          case 13:
            if (null === b.memoizedState) {
              var l2 = b.alternate;
              if (null !== l2) {
                var m2 = l2.memoizedState;
                if (null !== m2) {
                  var q2 = m2.dehydrated;
                  null !== q2 && bd(q2);
                }
              }
            }
            break;
          case 19:
          case 17:
          case 21:
          case 22:
          case 23:
          case 25:
            break;
          default:
            throw Error(p(163));
        }
        U || b.flags & 512 && Rj(b);
      } catch (r2) {
        W(b, b.return, r2);
      }
    }
    if (b === a) {
      V = null;
      break;
    }
    c = b.sibling;
    if (null !== c) {
      c.return = b.return;
      V = c;
      break;
    }
    V = b.return;
  }
}
function gk(a) {
  for (; null !== V; ) {
    var b = V;
    if (b === a) {
      V = null;
      break;
    }
    var c = b.sibling;
    if (null !== c) {
      c.return = b.return;
      V = c;
      break;
    }
    V = b.return;
  }
}
function jk(a) {
  for (; null !== V; ) {
    var b = V;
    try {
      switch (b.tag) {
        case 0:
        case 11:
        case 15:
          var c = b.return;
          try {
            Qj(4, b);
          } catch (k) {
            W(b, c, k);
          }
          break;
        case 1:
          var d = b.stateNode;
          if ("function" === typeof d.componentDidMount) {
            var e = b.return;
            try {
              d.componentDidMount();
            } catch (k) {
              W(b, e, k);
            }
          }
          var f2 = b.return;
          try {
            Rj(b);
          } catch (k) {
            W(b, f2, k);
          }
          break;
        case 5:
          var g = b.return;
          try {
            Rj(b);
          } catch (k) {
            W(b, g, k);
          }
      }
    } catch (k) {
      W(b, b.return, k);
    }
    if (b === a) {
      V = null;
      break;
    }
    var h = b.sibling;
    if (null !== h) {
      h.return = b.return;
      V = h;
      break;
    }
    V = b.return;
  }
}
var lk = Math.ceil, mk = ua.ReactCurrentDispatcher, nk = ua.ReactCurrentOwner, ok = ua.ReactCurrentBatchConfig, K = 0, Q = null, Y = null, Z = 0, fj = 0, ej = Uf(0), T = 0, pk = null, rh = 0, qk = 0, rk = 0, sk = null, tk = null, fk = 0, Gj = Infinity, uk = null, Oi = false, Pi = null, Ri = null, vk = false, wk = null, xk = 0, yk = 0, zk = null, Ak = -1, Bk = 0;
function R() {
  return 0 !== (K & 6) ? B() : -1 !== Ak ? Ak : Ak = B();
}
function yi(a) {
  if (0 === (a.mode & 1)) return 1;
  if (0 !== (K & 2) && 0 !== Z) return Z & -Z;
  if (null !== Kg.transition) return 0 === Bk && (Bk = yc()), Bk;
  a = C;
  if (0 !== a) return a;
  a = window.event;
  a = void 0 === a ? 16 : jd(a.type);
  return a;
}
function gi(a, b, c, d) {
  if (50 < yk) throw yk = 0, zk = null, Error(p(185));
  Ac(a, c, d);
  if (0 === (K & 2) || a !== Q) a === Q && (0 === (K & 2) && (qk |= c), 4 === T && Ck(a, Z)), Dk(a, d), 1 === c && 0 === K && 0 === (b.mode & 1) && (Gj = B() + 500, fg && jg());
}
function Dk(a, b) {
  var c = a.callbackNode;
  wc(a, b);
  var d = uc(a, a === Q ? Z : 0);
  if (0 === d) null !== c && bc(c), a.callbackNode = null, a.callbackPriority = 0;
  else if (b = d & -d, a.callbackPriority !== b) {
    null != c && bc(c);
    if (1 === b) 0 === a.tag ? ig(Ek.bind(null, a)) : hg(Ek.bind(null, a)), Jf(function() {
      0 === (K & 6) && jg();
    }), c = null;
    else {
      switch (Dc(d)) {
        case 1:
          c = fc;
          break;
        case 4:
          c = gc;
          break;
        case 16:
          c = hc;
          break;
        case 536870912:
          c = jc;
          break;
        default:
          c = hc;
      }
      c = Fk(c, Gk.bind(null, a));
    }
    a.callbackPriority = b;
    a.callbackNode = c;
  }
}
function Gk(a, b) {
  Ak = -1;
  Bk = 0;
  if (0 !== (K & 6)) throw Error(p(327));
  var c = a.callbackNode;
  if (Hk() && a.callbackNode !== c) return null;
  var d = uc(a, a === Q ? Z : 0);
  if (0 === d) return null;
  if (0 !== (d & 30) || 0 !== (d & a.expiredLanes) || b) b = Ik(a, d);
  else {
    b = d;
    var e = K;
    K |= 2;
    var f2 = Jk();
    if (Q !== a || Z !== b) uk = null, Gj = B() + 500, Kk(a, b);
    do
      try {
        Lk();
        break;
      } catch (h) {
        Mk(a, h);
      }
    while (1);
    $g();
    mk.current = f2;
    K = e;
    null !== Y ? b = 0 : (Q = null, Z = 0, b = T);
  }
  if (0 !== b) {
    2 === b && (e = xc(a), 0 !== e && (d = e, b = Nk(a, e)));
    if (1 === b) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
    if (6 === b) Ck(a, d);
    else {
      e = a.current.alternate;
      if (0 === (d & 30) && !Ok(e) && (b = Ik(a, d), 2 === b && (f2 = xc(a), 0 !== f2 && (d = f2, b = Nk(a, f2))), 1 === b)) throw c = pk, Kk(a, 0), Ck(a, d), Dk(a, B()), c;
      a.finishedWork = e;
      a.finishedLanes = d;
      switch (b) {
        case 0:
        case 1:
          throw Error(p(345));
        case 2:
          Pk(a, tk, uk);
          break;
        case 3:
          Ck(a, d);
          if ((d & 130023424) === d && (b = fk + 500 - B(), 10 < b)) {
            if (0 !== uc(a, 0)) break;
            e = a.suspendedLanes;
            if ((e & d) !== d) {
              R();
              a.pingedLanes |= a.suspendedLanes & e;
              break;
            }
            a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), b);
            break;
          }
          Pk(a, tk, uk);
          break;
        case 4:
          Ck(a, d);
          if ((d & 4194240) === d) break;
          b = a.eventTimes;
          for (e = -1; 0 < d; ) {
            var g = 31 - oc(d);
            f2 = 1 << g;
            g = b[g];
            g > e && (e = g);
            d &= ~f2;
          }
          d = e;
          d = B() - d;
          d = (120 > d ? 120 : 480 > d ? 480 : 1080 > d ? 1080 : 1920 > d ? 1920 : 3e3 > d ? 3e3 : 4320 > d ? 4320 : 1960 * lk(d / 1960)) - d;
          if (10 < d) {
            a.timeoutHandle = Ff(Pk.bind(null, a, tk, uk), d);
            break;
          }
          Pk(a, tk, uk);
          break;
        case 5:
          Pk(a, tk, uk);
          break;
        default:
          throw Error(p(329));
      }
    }
  }
  Dk(a, B());
  return a.callbackNode === c ? Gk.bind(null, a) : null;
}
function Nk(a, b) {
  var c = sk;
  a.current.memoizedState.isDehydrated && (Kk(a, b).flags |= 256);
  a = Ik(a, b);
  2 !== a && (b = tk, tk = c, null !== b && Fj(b));
  return a;
}
function Fj(a) {
  null === tk ? tk = a : tk.push.apply(tk, a);
}
function Ok(a) {
  for (var b = a; ; ) {
    if (b.flags & 16384) {
      var c = b.updateQueue;
      if (null !== c && (c = c.stores, null !== c)) for (var d = 0; d < c.length; d++) {
        var e = c[d], f2 = e.getSnapshot;
        e = e.value;
        try {
          if (!He(f2(), e)) return false;
        } catch (g) {
          return false;
        }
      }
    }
    c = b.child;
    if (b.subtreeFlags & 16384 && null !== c) c.return = b, b = c;
    else {
      if (b === a) break;
      for (; null === b.sibling; ) {
        if (null === b.return || b.return === a) return true;
        b = b.return;
      }
      b.sibling.return = b.return;
      b = b.sibling;
    }
  }
  return true;
}
function Ck(a, b) {
  b &= ~rk;
  b &= ~qk;
  a.suspendedLanes |= b;
  a.pingedLanes &= ~b;
  for (a = a.expirationTimes; 0 < b; ) {
    var c = 31 - oc(b), d = 1 << c;
    a[c] = -1;
    b &= ~d;
  }
}
function Ek(a) {
  if (0 !== (K & 6)) throw Error(p(327));
  Hk();
  var b = uc(a, 0);
  if (0 === (b & 1)) return Dk(a, B()), null;
  var c = Ik(a, b);
  if (0 !== a.tag && 2 === c) {
    var d = xc(a);
    0 !== d && (b = d, c = Nk(a, d));
  }
  if (1 === c) throw c = pk, Kk(a, 0), Ck(a, b), Dk(a, B()), c;
  if (6 === c) throw Error(p(345));
  a.finishedWork = a.current.alternate;
  a.finishedLanes = b;
  Pk(a, tk, uk);
  Dk(a, B());
  return null;
}
function Qk(a, b) {
  var c = K;
  K |= 1;
  try {
    return a(b);
  } finally {
    K = c, 0 === K && (Gj = B() + 500, fg && jg());
  }
}
function Rk(a) {
  null !== wk && 0 === wk.tag && 0 === (K & 6) && Hk();
  var b = K;
  K |= 1;
  var c = ok.transition, d = C;
  try {
    if (ok.transition = null, C = 1, a) return a();
  } finally {
    C = d, ok.transition = c, K = b, 0 === (K & 6) && jg();
  }
}
function Hj() {
  fj = ej.current;
  E(ej);
}
function Kk(a, b) {
  a.finishedWork = null;
  a.finishedLanes = 0;
  var c = a.timeoutHandle;
  -1 !== c && (a.timeoutHandle = -1, Gf(c));
  if (null !== Y) for (c = Y.return; null !== c; ) {
    var d = c;
    wg(d);
    switch (d.tag) {
      case 1:
        d = d.type.childContextTypes;
        null !== d && void 0 !== d && $f();
        break;
      case 3:
        zh();
        E(Wf);
        E(H);
        Eh();
        break;
      case 5:
        Bh(d);
        break;
      case 4:
        zh();
        break;
      case 13:
        E(L);
        break;
      case 19:
        E(L);
        break;
      case 10:
        ah(d.type._context);
        break;
      case 22:
      case 23:
        Hj();
    }
    c = c.return;
  }
  Q = a;
  Y = a = Pg(a.current, null);
  Z = fj = b;
  T = 0;
  pk = null;
  rk = qk = rh = 0;
  tk = sk = null;
  if (null !== fh) {
    for (b = 0; b < fh.length; b++) if (c = fh[b], d = c.interleaved, null !== d) {
      c.interleaved = null;
      var e = d.next, f2 = c.pending;
      if (null !== f2) {
        var g = f2.next;
        f2.next = e;
        d.next = g;
      }
      c.pending = d;
    }
    fh = null;
  }
  return a;
}
function Mk(a, b) {
  do {
    var c = Y;
    try {
      $g();
      Fh.current = Rh;
      if (Ih) {
        for (var d = M.memoizedState; null !== d; ) {
          var e = d.queue;
          null !== e && (e.pending = null);
          d = d.next;
        }
        Ih = false;
      }
      Hh = 0;
      O = N = M = null;
      Jh = false;
      Kh = 0;
      nk.current = null;
      if (null === c || null === c.return) {
        T = 1;
        pk = b;
        Y = null;
        break;
      }
      a: {
        var f2 = a, g = c.return, h = c, k = b;
        b = Z;
        h.flags |= 32768;
        if (null !== k && "object" === typeof k && "function" === typeof k.then) {
          var l2 = k, m2 = h, q2 = m2.tag;
          if (0 === (m2.mode & 1) && (0 === q2 || 11 === q2 || 15 === q2)) {
            var r2 = m2.alternate;
            r2 ? (m2.updateQueue = r2.updateQueue, m2.memoizedState = r2.memoizedState, m2.lanes = r2.lanes) : (m2.updateQueue = null, m2.memoizedState = null);
          }
          var y2 = Ui(g);
          if (null !== y2) {
            y2.flags &= -257;
            Vi(y2, g, h, f2, b);
            y2.mode & 1 && Si(f2, l2, b);
            b = y2;
            k = l2;
            var n2 = b.updateQueue;
            if (null === n2) {
              var t2 = /* @__PURE__ */ new Set();
              t2.add(k);
              b.updateQueue = t2;
            } else n2.add(k);
            break a;
          } else {
            if (0 === (b & 1)) {
              Si(f2, l2, b);
              tj();
              break a;
            }
            k = Error(p(426));
          }
        } else if (I && h.mode & 1) {
          var J2 = Ui(g);
          if (null !== J2) {
            0 === (J2.flags & 65536) && (J2.flags |= 256);
            Vi(J2, g, h, f2, b);
            Jg(Ji(k, h));
            break a;
          }
        }
        f2 = k = Ji(k, h);
        4 !== T && (T = 2);
        null === sk ? sk = [f2] : sk.push(f2);
        f2 = g;
        do {
          switch (f2.tag) {
            case 3:
              f2.flags |= 65536;
              b &= -b;
              f2.lanes |= b;
              var x2 = Ni(f2, k, b);
              ph(f2, x2);
              break a;
            case 1:
              h = k;
              var w2 = f2.type, u2 = f2.stateNode;
              if (0 === (f2.flags & 128) && ("function" === typeof w2.getDerivedStateFromError || null !== u2 && "function" === typeof u2.componentDidCatch && (null === Ri || !Ri.has(u2)))) {
                f2.flags |= 65536;
                b &= -b;
                f2.lanes |= b;
                var F2 = Qi(f2, h, b);
                ph(f2, F2);
                break a;
              }
          }
          f2 = f2.return;
        } while (null !== f2);
      }
      Sk(c);
    } catch (na) {
      b = na;
      Y === c && null !== c && (Y = c = c.return);
      continue;
    }
    break;
  } while (1);
}
function Jk() {
  var a = mk.current;
  mk.current = Rh;
  return null === a ? Rh : a;
}
function tj() {
  if (0 === T || 3 === T || 2 === T) T = 4;
  null === Q || 0 === (rh & 268435455) && 0 === (qk & 268435455) || Ck(Q, Z);
}
function Ik(a, b) {
  var c = K;
  K |= 2;
  var d = Jk();
  if (Q !== a || Z !== b) uk = null, Kk(a, b);
  do
    try {
      Tk();
      break;
    } catch (e) {
      Mk(a, e);
    }
  while (1);
  $g();
  K = c;
  mk.current = d;
  if (null !== Y) throw Error(p(261));
  Q = null;
  Z = 0;
  return T;
}
function Tk() {
  for (; null !== Y; ) Uk(Y);
}
function Lk() {
  for (; null !== Y && !cc(); ) Uk(Y);
}
function Uk(a) {
  var b = Vk(a.alternate, a, fj);
  a.memoizedProps = a.pendingProps;
  null === b ? Sk(a) : Y = b;
  nk.current = null;
}
function Sk(a) {
  var b = a;
  do {
    var c = b.alternate;
    a = b.return;
    if (0 === (b.flags & 32768)) {
      if (c = Ej(c, b, fj), null !== c) {
        Y = c;
        return;
      }
    } else {
      c = Ij(c, b);
      if (null !== c) {
        c.flags &= 32767;
        Y = c;
        return;
      }
      if (null !== a) a.flags |= 32768, a.subtreeFlags = 0, a.deletions = null;
      else {
        T = 6;
        Y = null;
        return;
      }
    }
    b = b.sibling;
    if (null !== b) {
      Y = b;
      return;
    }
    Y = b = a;
  } while (null !== b);
  0 === T && (T = 5);
}
function Pk(a, b, c) {
  var d = C, e = ok.transition;
  try {
    ok.transition = null, C = 1, Wk(a, b, c, d);
  } finally {
    ok.transition = e, C = d;
  }
  return null;
}
function Wk(a, b, c, d) {
  do
    Hk();
  while (null !== wk);
  if (0 !== (K & 6)) throw Error(p(327));
  c = a.finishedWork;
  var e = a.finishedLanes;
  if (null === c) return null;
  a.finishedWork = null;
  a.finishedLanes = 0;
  if (c === a.current) throw Error(p(177));
  a.callbackNode = null;
  a.callbackPriority = 0;
  var f2 = c.lanes | c.childLanes;
  Bc(a, f2);
  a === Q && (Y = Q = null, Z = 0);
  0 === (c.subtreeFlags & 2064) && 0 === (c.flags & 2064) || vk || (vk = true, Fk(hc, function() {
    Hk();
    return null;
  }));
  f2 = 0 !== (c.flags & 15990);
  if (0 !== (c.subtreeFlags & 15990) || f2) {
    f2 = ok.transition;
    ok.transition = null;
    var g = C;
    C = 1;
    var h = K;
    K |= 4;
    nk.current = null;
    Oj(a, c);
    dk(c, a);
    Oe(Df);
    dd = !!Cf;
    Df = Cf = null;
    a.current = c;
    hk(c);
    dc();
    K = h;
    C = g;
    ok.transition = f2;
  } else a.current = c;
  vk && (vk = false, wk = a, xk = e);
  f2 = a.pendingLanes;
  0 === f2 && (Ri = null);
  mc(c.stateNode);
  Dk(a, B());
  if (null !== b) for (d = a.onRecoverableError, c = 0; c < b.length; c++) e = b[c], d(e.value, { componentStack: e.stack, digest: e.digest });
  if (Oi) throw Oi = false, a = Pi, Pi = null, a;
  0 !== (xk & 1) && 0 !== a.tag && Hk();
  f2 = a.pendingLanes;
  0 !== (f2 & 1) ? a === zk ? yk++ : (yk = 0, zk = a) : yk = 0;
  jg();
  return null;
}
function Hk() {
  if (null !== wk) {
    var a = Dc(xk), b = ok.transition, c = C;
    try {
      ok.transition = null;
      C = 16 > a ? 16 : a;
      if (null === wk) var d = false;
      else {
        a = wk;
        wk = null;
        xk = 0;
        if (0 !== (K & 6)) throw Error(p(331));
        var e = K;
        K |= 4;
        for (V = a.current; null !== V; ) {
          var f2 = V, g = f2.child;
          if (0 !== (V.flags & 16)) {
            var h = f2.deletions;
            if (null !== h) {
              for (var k = 0; k < h.length; k++) {
                var l2 = h[k];
                for (V = l2; null !== V; ) {
                  var m2 = V;
                  switch (m2.tag) {
                    case 0:
                    case 11:
                    case 15:
                      Pj(8, m2, f2);
                  }
                  var q2 = m2.child;
                  if (null !== q2) q2.return = m2, V = q2;
                  else for (; null !== V; ) {
                    m2 = V;
                    var r2 = m2.sibling, y2 = m2.return;
                    Sj(m2);
                    if (m2 === l2) {
                      V = null;
                      break;
                    }
                    if (null !== r2) {
                      r2.return = y2;
                      V = r2;
                      break;
                    }
                    V = y2;
                  }
                }
              }
              var n2 = f2.alternate;
              if (null !== n2) {
                var t2 = n2.child;
                if (null !== t2) {
                  n2.child = null;
                  do {
                    var J2 = t2.sibling;
                    t2.sibling = null;
                    t2 = J2;
                  } while (null !== t2);
                }
              }
              V = f2;
            }
          }
          if (0 !== (f2.subtreeFlags & 2064) && null !== g) g.return = f2, V = g;
          else b: for (; null !== V; ) {
            f2 = V;
            if (0 !== (f2.flags & 2048)) switch (f2.tag) {
              case 0:
              case 11:
              case 15:
                Pj(9, f2, f2.return);
            }
            var x2 = f2.sibling;
            if (null !== x2) {
              x2.return = f2.return;
              V = x2;
              break b;
            }
            V = f2.return;
          }
        }
        var w2 = a.current;
        for (V = w2; null !== V; ) {
          g = V;
          var u2 = g.child;
          if (0 !== (g.subtreeFlags & 2064) && null !== u2) u2.return = g, V = u2;
          else b: for (g = w2; null !== V; ) {
            h = V;
            if (0 !== (h.flags & 2048)) try {
              switch (h.tag) {
                case 0:
                case 11:
                case 15:
                  Qj(9, h);
              }
            } catch (na) {
              W(h, h.return, na);
            }
            if (h === g) {
              V = null;
              break b;
            }
            var F2 = h.sibling;
            if (null !== F2) {
              F2.return = h.return;
              V = F2;
              break b;
            }
            V = h.return;
          }
        }
        K = e;
        jg();
        if (lc && "function" === typeof lc.onPostCommitFiberRoot) try {
          lc.onPostCommitFiberRoot(kc, a);
        } catch (na) {
        }
        d = true;
      }
      return d;
    } finally {
      C = c, ok.transition = b;
    }
  }
  return false;
}
function Xk(a, b, c) {
  b = Ji(c, b);
  b = Ni(a, b, 1);
  a = nh(a, b, 1);
  b = R();
  null !== a && (Ac(a, 1, b), Dk(a, b));
}
function W(a, b, c) {
  if (3 === a.tag) Xk(a, a, c);
  else for (; null !== b; ) {
    if (3 === b.tag) {
      Xk(b, a, c);
      break;
    } else if (1 === b.tag) {
      var d = b.stateNode;
      if ("function" === typeof b.type.getDerivedStateFromError || "function" === typeof d.componentDidCatch && (null === Ri || !Ri.has(d))) {
        a = Ji(c, a);
        a = Qi(b, a, 1);
        b = nh(b, a, 1);
        a = R();
        null !== b && (Ac(b, 1, a), Dk(b, a));
        break;
      }
    }
    b = b.return;
  }
}
function Ti(a, b, c) {
  var d = a.pingCache;
  null !== d && d.delete(b);
  b = R();
  a.pingedLanes |= a.suspendedLanes & c;
  Q === a && (Z & c) === c && (4 === T || 3 === T && (Z & 130023424) === Z && 500 > B() - fk ? Kk(a, 0) : rk |= c);
  Dk(a, b);
}
function Yk(a, b) {
  0 === b && (0 === (a.mode & 1) ? b = 1 : (b = sc, sc <<= 1, 0 === (sc & 130023424) && (sc = 4194304)));
  var c = R();
  a = ih(a, b);
  null !== a && (Ac(a, b, c), Dk(a, c));
}
function uj(a) {
  var b = a.memoizedState, c = 0;
  null !== b && (c = b.retryLane);
  Yk(a, c);
}
function bk(a, b) {
  var c = 0;
  switch (a.tag) {
    case 13:
      var d = a.stateNode;
      var e = a.memoizedState;
      null !== e && (c = e.retryLane);
      break;
    case 19:
      d = a.stateNode;
      break;
    default:
      throw Error(p(314));
  }
  null !== d && d.delete(b);
  Yk(a, c);
}
var Vk;
Vk = function(a, b, c) {
  if (null !== a) if (a.memoizedProps !== b.pendingProps || Wf.current) dh = true;
  else {
    if (0 === (a.lanes & c) && 0 === (b.flags & 128)) return dh = false, yj(a, b, c);
    dh = 0 !== (a.flags & 131072) ? true : false;
  }
  else dh = false, I && 0 !== (b.flags & 1048576) && ug(b, ng, b.index);
  b.lanes = 0;
  switch (b.tag) {
    case 2:
      var d = b.type;
      ij(a, b);
      a = b.pendingProps;
      var e = Yf(b, H.current);
      ch(b, c);
      e = Nh(null, b, d, a, e, c);
      var f2 = Sh();
      b.flags |= 1;
      "object" === typeof e && null !== e && "function" === typeof e.render && void 0 === e.$$typeof ? (b.tag = 1, b.memoizedState = null, b.updateQueue = null, Zf(d) ? (f2 = true, cg(b)) : f2 = false, b.memoizedState = null !== e.state && void 0 !== e.state ? e.state : null, kh(b), e.updater = Ei, b.stateNode = e, e._reactInternals = b, Ii(b, d, a, c), b = jj(null, b, d, true, f2, c)) : (b.tag = 0, I && f2 && vg(b), Xi(null, b, e, c), b = b.child);
      return b;
    case 16:
      d = b.elementType;
      a: {
        ij(a, b);
        a = b.pendingProps;
        e = d._init;
        d = e(d._payload);
        b.type = d;
        e = b.tag = Zk(d);
        a = Ci(d, a);
        switch (e) {
          case 0:
            b = cj(null, b, d, a, c);
            break a;
          case 1:
            b = hj(null, b, d, a, c);
            break a;
          case 11:
            b = Yi(null, b, d, a, c);
            break a;
          case 14:
            b = $i(null, b, d, Ci(d.type, a), c);
            break a;
        }
        throw Error(p(
          306,
          d,
          ""
        ));
      }
      return b;
    case 0:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), cj(a, b, d, e, c);
    case 1:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), hj(a, b, d, e, c);
    case 3:
      a: {
        kj(b);
        if (null === a) throw Error(p(387));
        d = b.pendingProps;
        f2 = b.memoizedState;
        e = f2.element;
        lh(a, b);
        qh(b, d, null, c);
        var g = b.memoizedState;
        d = g.element;
        if (f2.isDehydrated) if (f2 = { element: d, isDehydrated: false, cache: g.cache, pendingSuspenseBoundaries: g.pendingSuspenseBoundaries, transitions: g.transitions }, b.updateQueue.baseState = f2, b.memoizedState = f2, b.flags & 256) {
          e = Ji(Error(p(423)), b);
          b = lj(a, b, d, c, e);
          break a;
        } else if (d !== e) {
          e = Ji(Error(p(424)), b);
          b = lj(a, b, d, c, e);
          break a;
        } else for (yg = Lf(b.stateNode.containerInfo.firstChild), xg = b, I = true, zg = null, c = Vg(b, null, d, c), b.child = c; c; ) c.flags = c.flags & -3 | 4096, c = c.sibling;
        else {
          Ig();
          if (d === e) {
            b = Zi(a, b, c);
            break a;
          }
          Xi(a, b, d, c);
        }
        b = b.child;
      }
      return b;
    case 5:
      return Ah(b), null === a && Eg(b), d = b.type, e = b.pendingProps, f2 = null !== a ? a.memoizedProps : null, g = e.children, Ef(d, e) ? g = null : null !== f2 && Ef(d, f2) && (b.flags |= 32), gj(a, b), Xi(a, b, g, c), b.child;
    case 6:
      return null === a && Eg(b), null;
    case 13:
      return oj(a, b, c);
    case 4:
      return yh(b, b.stateNode.containerInfo), d = b.pendingProps, null === a ? b.child = Ug(b, null, d, c) : Xi(a, b, d, c), b.child;
    case 11:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), Yi(a, b, d, e, c);
    case 7:
      return Xi(a, b, b.pendingProps, c), b.child;
    case 8:
      return Xi(a, b, b.pendingProps.children, c), b.child;
    case 12:
      return Xi(a, b, b.pendingProps.children, c), b.child;
    case 10:
      a: {
        d = b.type._context;
        e = b.pendingProps;
        f2 = b.memoizedProps;
        g = e.value;
        G(Wg, d._currentValue);
        d._currentValue = g;
        if (null !== f2) if (He(f2.value, g)) {
          if (f2.children === e.children && !Wf.current) {
            b = Zi(a, b, c);
            break a;
          }
        } else for (f2 = b.child, null !== f2 && (f2.return = b); null !== f2; ) {
          var h = f2.dependencies;
          if (null !== h) {
            g = f2.child;
            for (var k = h.firstContext; null !== k; ) {
              if (k.context === d) {
                if (1 === f2.tag) {
                  k = mh(-1, c & -c);
                  k.tag = 2;
                  var l2 = f2.updateQueue;
                  if (null !== l2) {
                    l2 = l2.shared;
                    var m2 = l2.pending;
                    null === m2 ? k.next = k : (k.next = m2.next, m2.next = k);
                    l2.pending = k;
                  }
                }
                f2.lanes |= c;
                k = f2.alternate;
                null !== k && (k.lanes |= c);
                bh(
                  f2.return,
                  c,
                  b
                );
                h.lanes |= c;
                break;
              }
              k = k.next;
            }
          } else if (10 === f2.tag) g = f2.type === b.type ? null : f2.child;
          else if (18 === f2.tag) {
            g = f2.return;
            if (null === g) throw Error(p(341));
            g.lanes |= c;
            h = g.alternate;
            null !== h && (h.lanes |= c);
            bh(g, c, b);
            g = f2.sibling;
          } else g = f2.child;
          if (null !== g) g.return = f2;
          else for (g = f2; null !== g; ) {
            if (g === b) {
              g = null;
              break;
            }
            f2 = g.sibling;
            if (null !== f2) {
              f2.return = g.return;
              g = f2;
              break;
            }
            g = g.return;
          }
          f2 = g;
        }
        Xi(a, b, e.children, c);
        b = b.child;
      }
      return b;
    case 9:
      return e = b.type, d = b.pendingProps.children, ch(b, c), e = eh(e), d = d(e), b.flags |= 1, Xi(a, b, d, c), b.child;
    case 14:
      return d = b.type, e = Ci(d, b.pendingProps), e = Ci(d.type, e), $i(a, b, d, e, c);
    case 15:
      return bj(a, b, b.type, b.pendingProps, c);
    case 17:
      return d = b.type, e = b.pendingProps, e = b.elementType === d ? e : Ci(d, e), ij(a, b), b.tag = 1, Zf(d) ? (a = true, cg(b)) : a = false, ch(b, c), Gi(b, d, e), Ii(b, d, e, c), jj(null, b, d, true, a, c);
    case 19:
      return xj(a, b, c);
    case 22:
      return dj(a, b, c);
  }
  throw Error(p(156, b.tag));
};
function Fk(a, b) {
  return ac(a, b);
}
function $k(a, b, c, d) {
  this.tag = a;
  this.key = c;
  this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null;
  this.index = 0;
  this.ref = null;
  this.pendingProps = b;
  this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null;
  this.mode = d;
  this.subtreeFlags = this.flags = 0;
  this.deletions = null;
  this.childLanes = this.lanes = 0;
  this.alternate = null;
}
function Bg(a, b, c, d) {
  return new $k(a, b, c, d);
}
function aj(a) {
  a = a.prototype;
  return !(!a || !a.isReactComponent);
}
function Zk(a) {
  if ("function" === typeof a) return aj(a) ? 1 : 0;
  if (void 0 !== a && null !== a) {
    a = a.$$typeof;
    if (a === Da) return 11;
    if (a === Ga) return 14;
  }
  return 2;
}
function Pg(a, b) {
  var c = a.alternate;
  null === c ? (c = Bg(a.tag, b, a.key, a.mode), c.elementType = a.elementType, c.type = a.type, c.stateNode = a.stateNode, c.alternate = a, a.alternate = c) : (c.pendingProps = b, c.type = a.type, c.flags = 0, c.subtreeFlags = 0, c.deletions = null);
  c.flags = a.flags & 14680064;
  c.childLanes = a.childLanes;
  c.lanes = a.lanes;
  c.child = a.child;
  c.memoizedProps = a.memoizedProps;
  c.memoizedState = a.memoizedState;
  c.updateQueue = a.updateQueue;
  b = a.dependencies;
  c.dependencies = null === b ? null : { lanes: b.lanes, firstContext: b.firstContext };
  c.sibling = a.sibling;
  c.index = a.index;
  c.ref = a.ref;
  return c;
}
function Rg(a, b, c, d, e, f2) {
  var g = 2;
  d = a;
  if ("function" === typeof a) aj(a) && (g = 1);
  else if ("string" === typeof a) g = 5;
  else a: switch (a) {
    case ya:
      return Tg(c.children, e, f2, b);
    case za:
      g = 8;
      e |= 8;
      break;
    case Aa:
      return a = Bg(12, c, b, e | 2), a.elementType = Aa, a.lanes = f2, a;
    case Ea:
      return a = Bg(13, c, b, e), a.elementType = Ea, a.lanes = f2, a;
    case Fa:
      return a = Bg(19, c, b, e), a.elementType = Fa, a.lanes = f2, a;
    case Ia:
      return pj(c, e, f2, b);
    default:
      if ("object" === typeof a && null !== a) switch (a.$$typeof) {
        case Ba:
          g = 10;
          break a;
        case Ca:
          g = 9;
          break a;
        case Da:
          g = 11;
          break a;
        case Ga:
          g = 14;
          break a;
        case Ha:
          g = 16;
          d = null;
          break a;
      }
      throw Error(p(130, null == a ? a : typeof a, ""));
  }
  b = Bg(g, c, b, e);
  b.elementType = a;
  b.type = d;
  b.lanes = f2;
  return b;
}
function Tg(a, b, c, d) {
  a = Bg(7, a, d, b);
  a.lanes = c;
  return a;
}
function pj(a, b, c, d) {
  a = Bg(22, a, d, b);
  a.elementType = Ia;
  a.lanes = c;
  a.stateNode = { isHidden: false };
  return a;
}
function Qg(a, b, c) {
  a = Bg(6, a, null, b);
  a.lanes = c;
  return a;
}
function Sg(a, b, c) {
  b = Bg(4, null !== a.children ? a.children : [], a.key, b);
  b.lanes = c;
  b.stateNode = { containerInfo: a.containerInfo, pendingChildren: null, implementation: a.implementation };
  return b;
}
function al(a, b, c, d, e) {
  this.tag = b;
  this.containerInfo = a;
  this.finishedWork = this.pingCache = this.current = this.pendingChildren = null;
  this.timeoutHandle = -1;
  this.callbackNode = this.pendingContext = this.context = null;
  this.callbackPriority = 0;
  this.eventTimes = zc(0);
  this.expirationTimes = zc(-1);
  this.entangledLanes = this.finishedLanes = this.mutableReadLanes = this.expiredLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0;
  this.entanglements = zc(0);
  this.identifierPrefix = d;
  this.onRecoverableError = e;
  this.mutableSourceEagerHydrationData = null;
}
function bl(a, b, c, d, e, f2, g, h, k) {
  a = new al(a, b, c, h, k);
  1 === b ? (b = 1, true === f2 && (b |= 8)) : b = 0;
  f2 = Bg(3, null, null, b);
  a.current = f2;
  f2.stateNode = a;
  f2.memoizedState = { element: d, isDehydrated: c, cache: null, transitions: null, pendingSuspenseBoundaries: null };
  kh(f2);
  return a;
}
function cl(a, b, c) {
  var d = 3 < arguments.length && void 0 !== arguments[3] ? arguments[3] : null;
  return { $$typeof: wa, key: null == d ? null : "" + d, children: a, containerInfo: b, implementation: c };
}
function dl(a) {
  if (!a) return Vf;
  a = a._reactInternals;
  a: {
    if (Vb(a) !== a || 1 !== a.tag) throw Error(p(170));
    var b = a;
    do {
      switch (b.tag) {
        case 3:
          b = b.stateNode.context;
          break a;
        case 1:
          if (Zf(b.type)) {
            b = b.stateNode.__reactInternalMemoizedMergedChildContext;
            break a;
          }
      }
      b = b.return;
    } while (null !== b);
    throw Error(p(171));
  }
  if (1 === a.tag) {
    var c = a.type;
    if (Zf(c)) return bg(a, c, b);
  }
  return b;
}
function el(a, b, c, d, e, f2, g, h, k) {
  a = bl(c, d, true, a, e, f2, g, h, k);
  a.context = dl(null);
  c = a.current;
  d = R();
  e = yi(c);
  f2 = mh(d, e);
  f2.callback = void 0 !== b && null !== b ? b : null;
  nh(c, f2, e);
  a.current.lanes = e;
  Ac(a, e, d);
  Dk(a, d);
  return a;
}
function fl(a, b, c, d) {
  var e = b.current, f2 = R(), g = yi(e);
  c = dl(c);
  null === b.context ? b.context = c : b.pendingContext = c;
  b = mh(f2, g);
  b.payload = { element: a };
  d = void 0 === d ? null : d;
  null !== d && (b.callback = d);
  a = nh(e, b, g);
  null !== a && (gi(a, e, g, f2), oh(a, e, g));
  return g;
}
function gl(a) {
  a = a.current;
  if (!a.child) return null;
  switch (a.child.tag) {
    case 5:
      return a.child.stateNode;
    default:
      return a.child.stateNode;
  }
}
function hl(a, b) {
  a = a.memoizedState;
  if (null !== a && null !== a.dehydrated) {
    var c = a.retryLane;
    a.retryLane = 0 !== c && c < b ? c : b;
  }
}
function il(a, b) {
  hl(a, b);
  (a = a.alternate) && hl(a, b);
}
function jl() {
  return null;
}
var kl = "function" === typeof reportError ? reportError : function(a) {
  console.error(a);
};
function ll(a) {
  this._internalRoot = a;
}
ml.prototype.render = ll.prototype.render = function(a) {
  var b = this._internalRoot;
  if (null === b) throw Error(p(409));
  fl(a, b, null, null);
};
ml.prototype.unmount = ll.prototype.unmount = function() {
  var a = this._internalRoot;
  if (null !== a) {
    this._internalRoot = null;
    var b = a.containerInfo;
    Rk(function() {
      fl(null, a, null, null);
    });
    b[uf] = null;
  }
};
function ml(a) {
  this._internalRoot = a;
}
ml.prototype.unstable_scheduleHydration = function(a) {
  if (a) {
    var b = Hc();
    a = { blockedOn: null, target: a, priority: b };
    for (var c = 0; c < Qc.length && 0 !== b && b < Qc[c].priority; c++) ;
    Qc.splice(c, 0, a);
    0 === c && Vc(a);
  }
};
function nl(a) {
  return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType);
}
function ol(a) {
  return !(!a || 1 !== a.nodeType && 9 !== a.nodeType && 11 !== a.nodeType && (8 !== a.nodeType || " react-mount-point-unstable " !== a.nodeValue));
}
function pl() {
}
function ql(a, b, c, d, e) {
  if (e) {
    if ("function" === typeof d) {
      var f2 = d;
      d = function() {
        var a2 = gl(g);
        f2.call(a2);
      };
    }
    var g = el(b, d, a, 0, null, false, false, "", pl);
    a._reactRootContainer = g;
    a[uf] = g.current;
    sf(8 === a.nodeType ? a.parentNode : a);
    Rk();
    return g;
  }
  for (; e = a.lastChild; ) a.removeChild(e);
  if ("function" === typeof d) {
    var h = d;
    d = function() {
      var a2 = gl(k);
      h.call(a2);
    };
  }
  var k = bl(a, 0, false, null, null, false, false, "", pl);
  a._reactRootContainer = k;
  a[uf] = k.current;
  sf(8 === a.nodeType ? a.parentNode : a);
  Rk(function() {
    fl(b, k, c, d);
  });
  return k;
}
function rl(a, b, c, d, e) {
  var f2 = c._reactRootContainer;
  if (f2) {
    var g = f2;
    if ("function" === typeof e) {
      var h = e;
      e = function() {
        var a2 = gl(g);
        h.call(a2);
      };
    }
    fl(b, g, a, e);
  } else g = ql(c, b, a, e, d);
  return gl(g);
}
Ec = function(a) {
  switch (a.tag) {
    case 3:
      var b = a.stateNode;
      if (b.current.memoizedState.isDehydrated) {
        var c = tc(b.pendingLanes);
        0 !== c && (Cc(b, c | 1), Dk(b, B()), 0 === (K & 6) && (Gj = B() + 500, jg()));
      }
      break;
    case 13:
      Rk(function() {
        var b2 = ih(a, 1);
        if (null !== b2) {
          var c2 = R();
          gi(b2, a, 1, c2);
        }
      }), il(a, 1);
  }
};
Fc = function(a) {
  if (13 === a.tag) {
    var b = ih(a, 134217728);
    if (null !== b) {
      var c = R();
      gi(b, a, 134217728, c);
    }
    il(a, 134217728);
  }
};
Gc = function(a) {
  if (13 === a.tag) {
    var b = yi(a), c = ih(a, b);
    if (null !== c) {
      var d = R();
      gi(c, a, b, d);
    }
    il(a, b);
  }
};
Hc = function() {
  return C;
};
Ic = function(a, b) {
  var c = C;
  try {
    return C = a, b();
  } finally {
    C = c;
  }
};
yb = function(a, b, c) {
  switch (b) {
    case "input":
      bb(a, c);
      b = c.name;
      if ("radio" === c.type && null != b) {
        for (c = a; c.parentNode; ) c = c.parentNode;
        c = c.querySelectorAll("input[name=" + JSON.stringify("" + b) + '][type="radio"]');
        for (b = 0; b < c.length; b++) {
          var d = c[b];
          if (d !== a && d.form === a.form) {
            var e = Db(d);
            if (!e) throw Error(p(90));
            Wa(d);
            bb(d, e);
          }
        }
      }
      break;
    case "textarea":
      ib(a, c);
      break;
    case "select":
      b = c.value, null != b && fb(a, !!c.multiple, b, false);
  }
};
Gb = Qk;
Hb = Rk;
var sl = { usingClientEntryPoint: false, Events: [Cb, ue, Db, Eb, Fb, Qk] }, tl = { findFiberByHostInstance: Wc, bundleType: 0, version: "18.3.1", rendererPackageName: "react-dom" };
var ul = { bundleType: tl.bundleType, version: tl.version, rendererPackageName: tl.rendererPackageName, rendererConfig: tl.rendererConfig, overrideHookState: null, overrideHookStateDeletePath: null, overrideHookStateRenamePath: null, overrideProps: null, overridePropsDeletePath: null, overridePropsRenamePath: null, setErrorHandler: null, setSuspenseHandler: null, scheduleUpdate: null, currentDispatcherRef: ua.ReactCurrentDispatcher, findHostInstanceByFiber: function(a) {
  a = Zb(a);
  return null === a ? null : a.stateNode;
}, findFiberByHostInstance: tl.findFiberByHostInstance || jl, findHostInstancesForRefresh: null, scheduleRefresh: null, scheduleRoot: null, setRefreshHandler: null, getCurrentFiber: null, reconcilerVersion: "18.3.1-next-f1338f8080-20240426" };
if ("undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__) {
  var vl = __REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!vl.isDisabled && vl.supportsFiber) try {
    kc = vl.inject(ul), lc = vl;
  } catch (a) {
  }
}
reactDom_production_min.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = sl;
reactDom_production_min.createPortal = function(a, b) {
  var c = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : null;
  if (!nl(b)) throw Error(p(200));
  return cl(a, b, null, c);
};
reactDom_production_min.createRoot = function(a, b) {
  if (!nl(a)) throw Error(p(299));
  var c = false, d = "", e = kl;
  null !== b && void 0 !== b && (true === b.unstable_strictMode && (c = true), void 0 !== b.identifierPrefix && (d = b.identifierPrefix), void 0 !== b.onRecoverableError && (e = b.onRecoverableError));
  b = bl(a, 1, false, null, null, c, false, d, e);
  a[uf] = b.current;
  sf(8 === a.nodeType ? a.parentNode : a);
  return new ll(b);
};
reactDom_production_min.findDOMNode = function(a) {
  if (null == a) return null;
  if (1 === a.nodeType) return a;
  var b = a._reactInternals;
  if (void 0 === b) {
    if ("function" === typeof a.render) throw Error(p(188));
    a = Object.keys(a).join(",");
    throw Error(p(268, a));
  }
  a = Zb(b);
  a = null === a ? null : a.stateNode;
  return a;
};
reactDom_production_min.flushSync = function(a) {
  return Rk(a);
};
reactDom_production_min.hydrate = function(a, b, c) {
  if (!ol(b)) throw Error(p(200));
  return rl(null, a, b, true, c);
};
reactDom_production_min.hydrateRoot = function(a, b, c) {
  if (!nl(a)) throw Error(p(405));
  var d = null != c && c.hydratedSources || null, e = false, f2 = "", g = kl;
  null !== c && void 0 !== c && (true === c.unstable_strictMode && (e = true), void 0 !== c.identifierPrefix && (f2 = c.identifierPrefix), void 0 !== c.onRecoverableError && (g = c.onRecoverableError));
  b = el(b, null, a, 1, null != c ? c : null, e, false, f2, g);
  a[uf] = b.current;
  sf(a);
  if (d) for (a = 0; a < d.length; a++) c = d[a], e = c._getVersion, e = e(c._source), null == b.mutableSourceEagerHydrationData ? b.mutableSourceEagerHydrationData = [c, e] : b.mutableSourceEagerHydrationData.push(
    c,
    e
  );
  return new ml(b);
};
reactDom_production_min.render = function(a, b, c) {
  if (!ol(b)) throw Error(p(200));
  return rl(null, a, b, false, c);
};
reactDom_production_min.unmountComponentAtNode = function(a) {
  if (!ol(a)) throw Error(p(40));
  return a._reactRootContainer ? (Rk(function() {
    rl(null, null, a, false, function() {
      a._reactRootContainer = null;
      a[uf] = null;
    });
  }), true) : false;
};
reactDom_production_min.unstable_batchedUpdates = Qk;
reactDom_production_min.unstable_renderSubtreeIntoContainer = function(a, b, c, d) {
  if (!ol(c)) throw Error(p(200));
  if (null == a || void 0 === a._reactInternals) throw Error(p(38));
  return rl(a, b, c, false, d);
};
reactDom_production_min.version = "18.3.1-next-f1338f8080-20240426";
function checkDCE() {
  if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ === "undefined" || typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE !== "function") {
    return;
  }
  try {
    __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(checkDCE);
  } catch (err) {
    console.error(err);
  }
}
{
  checkDCE();
  reactDom.exports = reactDom_production_min;
}
var reactDomExports = reactDom.exports;
var createRoot;
var m = reactDomExports;
{
  createRoot = m.createRoot;
  m.hydrateRoot;
}
function freeze$3(value, seen = /* @__PURE__ */ new WeakMap()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const array = Array.from(value);
    seen.set(value, array);
    return Object.freeze(array);
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw Error("Unsupported result snapshot value");
  seen.set(value, value);
  for (const key of Object.keys(value)) value[key] = freeze$3(value[key], seen);
  return Object.freeze(value);
}
function captureCurrentResult({ busy, allowed, gate, snapshot }) {
  if (busy() || !allowed()) throw Error("คำนวณและยืนยันชุดปัจจุบันก่อนอ่านผล");
  gate();
  const result = snapshot();
  if (!(result == null ? void 0 : result.modelId) || !result.g || !result.r) throw Error("ยังไม่มีผลคำนวณปัจจุบัน");
  const copy = structuredClone(result);
  gate();
  if (busy() || !allowed()) throw Error("ข้อมูลเปลี่ยนระหว่างอ่านผล");
  return freeze$3(copy);
}
function freeze$2(value, seen = /* @__PURE__ */ new WeakMap()) {
  if (!value || typeof value !== "object") return value;
  if (seen.has(value)) return seen.get(value);
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    const array = Array.from(value);
    seen.set(value, array);
    return Object.freeze(array);
  }
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) throw Error("Unsupported result snapshot value");
  seen.set(value, value);
  for (const key of Object.keys(value)) value[key] = freeze$2(value[key], seen);
  return Object.freeze(value);
}
function identityValue(value, seen = /* @__PURE__ */ new WeakSet()) {
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "number:NaN";
    if (Object.is(value, -0)) return "number:-0";
    if (!Number.isFinite(value)) return "number:" + String(value);
    return "number:" + value;
  }
  if (value === null || typeof value !== "object") return typeof value + ":" + JSON.stringify(value);
  if (seen.has(value)) throw Error("Cyclic result snapshot");
  seen.add(value);
  const body = Array.isArray(value) ? "[" + value.map((item) => identityValue(item, seen)).join(",") + "]" : "{" + Object.keys(value).map((key) => JSON.stringify(key) + ":" + identityValue(value[key], seen)).join(",") + "}";
  seen.delete(value);
  return body;
}
function shortToken(identity) {
  let hash = 2166136261;
  for (let i = 0; i < identity.length; i++) {
    hash ^= identity.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, "0");
}
const message = Object.freeze({
  unavailable: "คำนวณและยืนยันชุดปัจจุบันก่อนอ่านผล",
  ready: "ผล native พร้อมให้ยืนยันตัวตนก่อนเปิดผล",
  current: "3D ผลตรวจ รายงาน และ CAD ใช้ผลชุดเดียวกัน",
  busy: "กำลังทำงานกับข้อมูลปัจจุบัน",
  stale: "ข้อมูลเปลี่ยนแล้ว ต้องคำนวณและยืนยันชุดใหม่"
});
function state(phase, cache = null) {
  return Object.freeze({
    phase,
    modelId: phase === "current" ? (cache == null ? void 0 : cache.result.modelId) || "" : "",
    type: phase === "current" ? (cache == null ? void 0 : cache.result.type) || "" : "",
    token: phase === "current" ? (cache == null ? void 0 : cache.token) || "" : "",
    message: message[phase],
    canIssue: false
  });
}
function createConfirmedResultLifecycle({ capture, isBusy, isAllowed, version = () => null }) {
  let cache = null, value = state("unavailable"), needsValidation = true, stale = false, disposed = false;
  const set = (next) => {
    value = next;
    return value;
  };
  const currentVersion = () => {
    const next = version();
    return next == null ? null : identityValue(next);
  };
  function sync() {
    if (disposed) return value;
    if (isBusy()) {
      needsValidation = true;
      return set(state("busy"));
    }
    if (!isAllowed()) {
      stale = stale || !!cache || value.phase === "current";
      cache = null;
      needsValidation = true;
      return set(state(stale ? "stale" : "unavailable"));
    }
    stale = false;
    if (!cache || needsValidation) return set(state("ready"));
    return set(state("current", cache));
  }
  function requireCurrent() {
    if (disposed) throw Error("ปิดวงจรผลยืนยันแล้ว");
    if (isBusy() || !isAllowed()) {
      sync();
      throw Error(message[isBusy() ? "busy" : "unavailable"]);
    }
    const beforeVersion = currentVersion();
    if (cache && !needsValidation && beforeVersion !== null && cache.version === beforeVersion) {
      set(state("current", cache));
      return cache.result;
    }
    const raw = capture(), captured = Object.isFrozen(raw) ? raw : freeze$2(structuredClone(raw));
    if (!(captured == null ? void 0 : captured.modelId) || !captured.g || !captured.r) {
      cache = null;
      needsValidation = true;
      sync();
      throw Error("ยังไม่มีผลคำนวณปัจจุบัน");
    }
    const afterVersion = currentVersion();
    if (beforeVersion !== afterVersion) {
      cache = null;
      needsValidation = true;
      sync();
      throw Error("ข้อมูลเปลี่ยนระหว่างอ่านผล");
    }
    const identity = identityValue(captured), token = shortToken(identity);
    if (!cache || cache.identity !== identity) cache = { identity, token, result: captured, version: afterVersion };
    needsValidation = false;
    stale = false;
    if (isBusy() || !isAllowed()) {
      sync();
      throw Error("ข้อมูลเปลี่ยนระหว่างอ่านผล");
    }
    set(state("current", cache));
    return cache.result;
  }
  function guard(action) {
    requireCurrent();
    const before = cache.identity, beforeVersion = cache.version;
    const finish = (result2) => {
      if (isBusy() || !isAllowed()) {
        sync();
        throw Error("ข้อมูลเปลี่ยนระหว่างเปิดผล");
      }
      if (beforeVersion !== null && currentVersion() === beforeVersion) {
        set(state("current", cache));
        return result2;
      }
      requireCurrent();
      if (!cache || cache.identity !== before) {
        cache = null;
        needsValidation = true;
        sync();
        throw Error("ผลคำนวณเปลี่ยนระหว่างเปิดผล");
      }
      return result2;
    };
    const result = action(cache.result);
    return result && typeof result.then === "function" ? result.then(finish) : finish(result);
  }
  return Object.freeze({
    getSnapshot: () => value,
    sync,
    requireCurrent,
    guard,
    invalidate() {
      stale = stale || !!cache;
      cache = null;
      needsValidation = true;
      return sync();
    },
    dispose() {
      disposed = true;
      cache = null;
      needsValidation = true;
      stale = false;
      set(state("unavailable"));
    }
  });
}
const freezeList = (values) => Object.freeze(values.map((value) => Object.freeze(value)));
function readPath(root, path) {
  return path.split(".").reduce((value, key) => value == null ? void 0 : value[key], root);
}
function normalizeRequirement(requirement, kind) {
  if (!(requirement == null ? void 0 : requirement.id)) throw new TypeError(kind + " dependency requires an id");
  const normalized = { ...requirement };
  if (kind === "global" && !normalized.path && typeof normalized.resolve !== "function") {
    throw new TypeError("Global dependency " + normalized.id + " requires a path or resolver");
  }
  if (kind === "dom" && !normalized.selector && typeof normalized.resolve !== "function") {
    throw new TypeError("DOM dependency " + normalized.id + " requires a selector or resolver");
  }
  normalized.description || (normalized.description = normalized.path || normalized.selector || normalized.id);
  return Object.freeze(normalized);
}
function createNativeContract({ globals = [], dom = [] } = {}) {
  const normalizedGlobals = globals.map((requirement) => normalizeRequirement(requirement, "global"));
  const normalizedDom = dom.map((requirement) => normalizeRequirement(requirement, "dom"));
  const ids = [...normalizedGlobals, ...normalizedDom].map((requirement) => requirement.id);
  if (new Set(ids).size !== ids.length) throw new TypeError("Native dependency IDs must be unique");
  return Object.freeze({
    globals: Object.freeze(normalizedGlobals),
    dom: Object.freeze(normalizedDom)
  });
}
function resolveRequirement(requirement, root) {
  try {
    const value = typeof requirement.resolve === "function" ? requirement.resolve(root) : readPath(root, requirement.path);
    const valid = typeof requirement.validate === "function" ? requirement.validate(value) : value !== null && value !== void 0 && value !== false;
    return { value, valid, reason: "" };
  } catch (error) {
    return { value: void 0, valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
function resolveDomRequirement(requirement, doc) {
  try {
    const value = typeof requirement.resolve === "function" ? requirement.resolve(doc) : doc.querySelector(requirement.selector);
    const valid = typeof requirement.validate === "function" ? requirement.validate(value) : !!value;
    return { value, valid, reason: "" };
  } catch (error) {
    return { value: void 0, valid: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
function inspectNativeContract(contract, doc, win) {
  const globals = {};
  const dom = {};
  const missing = [];
  for (const requirement of contract.globals) {
    const { value, valid, reason } = resolveRequirement(requirement, win);
    if (valid) globals[requirement.id] = value;
    else missing.push(Object.freeze({ kind: "global", id: requirement.id, description: requirement.description, reason }));
  }
  for (const requirement of contract.dom) {
    const { value, valid, reason } = resolveDomRequirement(requirement, doc);
    if (valid) dom[requirement.id] = value;
    else missing.push(Object.freeze({ kind: "dom", id: requirement.id, description: requirement.description, reason }));
  }
  return Object.freeze({
    ready: missing.length === 0,
    globals: Object.freeze(globals),
    dom: Object.freeze(dom),
    missing: freezeList(missing)
  });
}
class NativeDependencyTimeoutError extends Error {
  constructor(snapshot, timeoutMs) {
    const labels = snapshot.missing.map((item) => item.id).join(", ") || "unknown";
    super(`Native initialization contract timed out after ${timeoutMs} ms: ${labels}`);
    this.name = "NativeDependencyTimeoutError";
    this.code = "SIGN_NATIVE_DEPENDENCY_TIMEOUT";
    this.timeoutMs = timeoutMs;
    this.missing = snapshot.missing;
    this.details = Object.freeze({
      ready: false,
      timeoutMs,
      missing: snapshot.missing
    });
  }
}
function waitForNativeContract(contract, doc, win, { timeoutMs = 8e3, retryMs = 100 } = {}) {
  const initial = inspectNativeContract(contract, doc, win);
  if (initial.ready) return Promise.resolve(initial);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) throw new TypeError("timeoutMs must be a finite non-negative number");
  if (!Number.isFinite(retryMs) || retryMs <= 0) throw new TypeError("retryMs must be a finite positive number");
  return new Promise((resolve, reject) => {
    var _a2;
    let settled = false;
    let deadlineTimer = 0;
    let retryTimer = 0;
    const events = ["DOMContentLoaded", "readystatechange", "ncy:native-ready"];
    const cleanup = () => {
      var _a3;
      observer.disconnect();
      for (const name of events) doc.removeEventListener(name, check);
      (_a3 = win.removeEventListener) == null ? void 0 : _a3.call(win, "load", check);
      if (deadlineTimer) win.clearTimeout(deadlineTimer);
      if (retryTimer) win.clearTimeout(retryTimer);
    };
    const finish = (callback) => (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback(value);
    };
    const succeed = finish(resolve);
    const fail = finish(reject);
    const check = () => {
      if (settled) return;
      const snapshot = inspectNativeContract(contract, doc, win);
      if (snapshot.ready) succeed(snapshot);
    };
    const retry = () => {
      if (settled) return;
      check();
      if (!settled) retryTimer = win.setTimeout(retry, retryMs);
    };
    const observer = new win.MutationObserver(check);
    observer.observe(doc.documentElement, { attributes: true, childList: true, subtree: true });
    for (const name of events) doc.addEventListener(name, check);
    (_a2 = win.addEventListener) == null ? void 0 : _a2.call(win, "load", check);
    deadlineTimer = win.setTimeout(() => {
      const snapshot = inspectNativeContract(contract, doc, win);
      if (snapshot.ready) succeed(snapshot);
      else fail(new NativeDependencyTimeoutError(snapshot, timeoutMs));
    }, timeoutMs);
    retryTimer = win.setTimeout(retry, retryMs);
    check();
  });
}
const freeze$1 = (value) => Object.freeze(value);
const text = (value) => typeof value === "string" ? value.trim() : "";
const count = (value) => Number.isFinite(value) && value >= 0 ? value : 0;
const emptySummary = freeze$1({ faces: 0, rebarFaces: 0 });
function waiting(result) {
  const phase = (result == null ? void 0 : result.phase) === "current" ? "hold" : (result == null ? void 0 : result.phase) === "busy" ? "busy" : (result == null ? void 0 : result.phase) === "stale" ? "stale" : (result == null ? void 0 : result.phase) === "ready" ? "ready" : "draft";
  const messages = {
    draft: "ภาพมิติสำหรับกรอกข้อมูล ยังไม่ใช่ geometry ของผลยืนยัน",
    ready: "ผลพร้อมแล้ว · ยืนยันชุดในขั้น 02 แล้ว 3D จะใช้ geometry ของผลนั้น",
    busy: "กำลังคำนวณหรืออัปเดตโมเดล ไม่ใช้ภาพรอบเก่าแทน",
    stale: "ข้อมูลเปลี่ยนแล้ว 3D ชุดเดิมถูกยกเลิก ต้องคำนวณและยืนยันใหม่",
    hold: "3D HOLD · ผลปัจจุบันไม่มีรหัส model ID ที่ใช้ตรวจสอบได้"
  };
  return freeze$1({
    phase,
    current: false,
    resultId: "",
    geometryId: "",
    renderId: "",
    source: "",
    method: "",
    message: messages[phase],
    summary: emptySummary,
    canIssue: false,
    authority: "REVIEW / NOT FOR CONSTRUCTION"
  });
}
function inspectSceneContract(result, scene) {
  var _a2, _b;
  if ((result == null ? void 0 : result.phase) !== "current" || !text(result.modelId)) return waiting(result);
  const resultId = text(result.modelId), type = text(result.type), basis = (scene == null ? void 0 : scene.basis) || null;
  const summary = freeze$1({ faces: count((_a2 = scene == null ? void 0 : scene.summary) == null ? void 0 : _a2.faces), rebarFaces: count((_b = scene == null ? void 0 : scene.summary) == null ? void 0 : _b.rebarFaces) });
  const source = text(scene == null ? void 0 : scene.source), method = text(scene == null ? void 0 : scene.method);
  let matches = false, geometryId = "", renderId = "", reason = "";
  if ((scene == null ? void 0 : scene.readError) === true) {
    reason = "อ่านสถานะ native model ไม่สำเร็จ";
  } else if (!scene || scene.current !== true) {
    reason = "ยังไม่มี scene ปัจจุบันจาก native model";
  } else if (type === "TYPE2") {
    geometryId = text(basis == null ? void 0 : basis.geometryId);
    matches = text(basis == null ? void 0 : basis.engineeringModelId) === resultId && !!geometryId;
    if (!matches) reason = "รหัสผลหรือ geometry ของ Type 2 ไม่ตรงกับชุดที่ยืนยัน";
  } else if (type === "TYPE1") {
    const proof = scene.resultGeometryR12;
    renderId = source;
    matches = (proof == null ? void 0 : proof.verified) === true && text(proof.snapshotId) === resultId && !!source;
    if (!matches) reason = "ยังไม่มีหลักฐานเทียบ mesh ฐาน เพลท และสลักกับผล Type 1 ชุดนี้";
  } else {
    reason = "ชนิดผลยืนยันไม่อยู่ในขอบเขต 3D Type 1/2";
  }
  return freeze$1({
    phase: matches ? "current" : "hold",
    current: matches,
    resultId,
    geometryId: matches ? geometryId : "",
    renderId: matches ? renderId : "",
    source: matches ? source : "",
    method: matches ? method : "",
    summary: matches ? summary : emptySummary,
    canIssue: false,
    authority: "REVIEW / NOT FOR CONSTRUCTION",
    message: matches ? `พิกัด 3D ตรงกับผลยืนยัน ${resultId} · การปรับกล้องไม่เปลี่ยนข้อมูลวิศวกรรม` : `3D HOLD · ${reason}`
  });
}
const TABLES = Object.freeze({
  reference: "#n51Rows table",
  steel: "#n37Table",
  foundation: "#n22FoundationChoice .n22-table-scroll > table",
  connection: "#n45Table > table"
});
const ACTIONS$1 = Object.freeze({
  steel: '#n38MaterialIndex [data-n38-target="n37Picker"]',
  connection: '#n38MaterialIndex [data-n38-target="n32ConnectionChoices"]',
  foundation: '#n38MaterialIndex [data-n38-target="n15Input3"]',
  results: '#n38MaterialIndex [data-n15-view="results"]',
  continue: "#n38Continue"
});
const TAGS$1 = /* @__PURE__ */ new Set(["B", "STRONG", "SMALL", "SPAN", "P", "BR", "DETAILS", "SUMMARY", "DL", "DT", "DD", "EM"]);
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
function activateNativeControl(node) {
  var _a2, _b;
  if ((node == null ? void 0 : node.tagName) === "INPUT" && ["radio", "checkbox"].includes(node.type)) {
    const EventType = (_b = (_a2 = node.ownerDocument) == null ? void 0 : _a2.defaultView) == null ? void 0 : _b.Event;
    if (EventType && node.dispatchEvent) {
      node.checked = node.type === "radio" ? true : !node.checked;
      node.dispatchEvent(new EventType("input", { bubbles: true }));
      node.dispatchEvent(new EventType("change", { bubbles: true }));
      return true;
    }
  }
  node.click();
  return true;
}
function forwardSelection(node, { busy = false, identityValid = true } = {}) {
  if (!identityValid || busy || !(node == null ? void 0 : node.isConnected) || node.disabled || node.closest("[inert],fieldset[disabled]")) return false;
  return activateNativeControl(node);
}
function cellContent(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1 || node.tagName === "INPUT") return null;
  const children = [...node.childNodes].map(cellContent).filter((v2) => v2 !== null);
  return { tag: TAGS$1.has(node.tagName) ? node.tagName.toLowerCase() : "span", children };
}
function createNativeSelection(doc, win, workbench) {
  const tokens = /* @__PURE__ */ new WeakMap(), listeners = /* @__PURE__ */ new Set();
  let serial = 0, bindings = /* @__PURE__ */ new Map(), disposed = false, frame = 0;
  const token = (node) => {
    if (!tokens.has(node)) tokens.set(node, String(++serial));
    return tokens.get(node);
  };
  const q2 = (selector) => doc.querySelector(selector);
  const blocked = (node) => !node || !node.isConnected || !!node.disabled || !!node.closest("[inert],fieldset[disabled]") || workbench.getSnapshot().busy;
  function read() {
    var _a2, _b, _c, _d, _e;
    const nextBindings = /* @__PURE__ */ new Map();
    let memberSearch = null;
    try {
      const raw = (_b = (_a2 = q2("#materials32")) == null ? void 0 : _a2.dataset) == null ? void 0 : _b.r38MemberSearch;
      if (raw) memberSearch = JSON.parse(raw);
    } catch (_) {
    }
    const tables = Object.fromEntries(Object.entries(TABLES).map(([name, selector]) => {
      var _a3;
      const table = q2(selector);
      if (!table) return [name, null];
      const caption = ((_a3 = table.caption) == null ? void 0 : _a3.textContent) || "", headers = [...table.querySelectorAll("thead th")].map((e) => e.textContent);
      const nativeRows = [...table.querySelectorAll("tbody > tr")];
      return [name, {
        caption,
        headers,
        rows: nativeRows.map((row2) => {
          return {
            selected: row2.dataset.selected === "true",
            cells: [...row2.cells].map((cell) => {
              const radio = cell.querySelector('input[type="radio"]');
              let choice = null;
              if (radio) {
                const id2 = token(radio);
                nextBindings.set(id2, { node: radio, table: name, value: radio.value });
                choice = { token: id2, value: radio.value, label: radio.getAttribute("aria-label") || radio.value, checked: radio.checked, disabled: blocked(radio) };
              }
              return { content: [...cell.childNodes].map(cellContent).filter((v2) => v2 !== null), choice };
            })
          };
        })
      }];
    }));
    bindings = nextBindings;
    return freeze({
      tables,
      stage: doc.documentElement.dataset.signN38Stage,
      group: doc.documentElement.dataset.signN42Group || "steel",
      controls: Object.fromEntries(Object.entries(ACTIONS$1).map(([name, selector]) => {
        const node = q2(selector);
        return [name, { text: (node == null ? void 0 : node.textContent) || "", disabled: blocked(node), hidden: !node || node.hidden }];
      })),
      summary: ((_c = q2("#n38SelectionSummary")) == null ? void 0 : _c.textContent) || "",
      reason: ((_d = q2("#n38SelectionReason")) == null ? void 0 : _d.textContent) || "",
      scope: ((_e = q2("#n38SelectionFooter .n38-limit")) == null ? void 0 : _e.textContent) || "",
      memberSearch
    });
  }
  let state2 = read(), key = JSON.stringify(state2);
  function refresh() {
    if (disposed) return;
    const next = read(), nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    key = nextKey;
    state2 = next;
    listeners.forEach((fn) => fn());
  }
  function schedule() {
    if (!disposed && !frame) frame = win.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  const observer = new win.MutationObserver((records) => {
    if (records.some((r2) => {
      var _a2, _b;
      return !((_b = (_a2 = r2.target.nodeType === 1 ? r2.target : r2.target.parentElement) == null ? void 0 : _a2.closest) == null ? void 0 : _b.call(_a2, "[data-r29-island],[data-r28-island],[data-r27-island],[data-r26-island]"));
    })) schedule();
  });
  for (const selector of ["#cp025Panel", "#n38MaterialIndex", "#materials32"]) if (q2(selector)) observer.observe(q2(selector), {
    attributes: true,
    subtree: true,
    childList: true,
    characterData: true,
    attributeFilter: ["hidden", "disabled", "inert", "checked", "aria-pressed", "data-selected", "data-r38-member-search"]
  });
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-sign-n38-stage", "data-sign-n42-group"] });
  const unsubscribe = workbench.subscribe(schedule);
  for (const event of ["input", "change", "click"]) doc.addEventListener(event, schedule, true);
  function captureAfterContinue() {
    const start2 = Date.now();
    const step = () => {
      var _a2;
      if (disposed) return;
      if (doc.documentElement.dataset.signN38Stage === "outputs") {
        try {
          if ((_a2 = workbench.captureResult) == null ? void 0 : _a2.call(workbench)) return;
        } catch (_) {
        }
      }
      if (Date.now() - start2 < 1e3) win.requestAnimationFrame(step);
    };
    win.requestAnimationFrame(step);
  }
  return Object.freeze({
    getSnapshot: () => state2,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh,
    choose(table, id2, expected = null) {
      if (disposed) return false;
      workbench.refresh();
      refresh();
      let binding = bindings.get(id2);
      const hasExpected = expected && typeof expected.value === "string";
      if (hasExpected) {
        const matches = [...bindings.values()].filter((current) => current.table === table && current.value === expected.value);
        binding = matches.length === 1 ? matches[0] : null;
      }
      const ok2 = forwardSelection(binding == null ? void 0 : binding.node, {
        busy: workbench.getSnapshot().busy,
        identityValid: (binding == null ? void 0 : binding.table) === table && (binding == null ? void 0 : binding.node.closest("table")) === q2(TABLES[table]) && (!hasExpected || binding.value === expected.value)
      });
      refresh();
      schedule();
      return ok2;
    },
    // R49: after Confirm, capture the confirmed result as soon as the outputs stage opens (at most 1 s),
    // through the same guarded path a view:* click takes. Any failure is swallowed: 03 then fails closed.
    command(name) {
      if (disposed || !Object.hasOwn(ACTIONS$1, name)) return false;
      workbench.refresh();
      const node = q2(ACTIONS$1[name]), ok2 = !(node == null ? void 0 : node.hidden) && forwardSelection(node, { busy: workbench.getSnapshot().busy });
      if (ok2 && name === "continue") captureAfterContinue();
      refresh();
      schedule();
      return !!ok2;
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      unsubscribe();
      if (frame) win.cancelAnimationFrame(frame);
      for (const event of ["input", "change", "click"]) doc.removeEventListener(event, schedule, true);
      listeners.clear();
      bindings.clear();
    }
  });
}
const STAGES = Object.freeze([
  ["input", "01", "ข้อมูลและคำนวณ", "กรอกข้อมูล · คำนวณ"],
  ["select", "02", "เลือกและยืนยันชุด", "เลือกชิ้นส่วน · ตรวจครบ · ยืนยัน"],
  ["outputs", "03", "ตรวจผลและส่งออก", "ตรวจผล · 3D · เอกสาร · ส่งออก"]
]);
const VIEWS = Object.freeze([
  ["results", "01", "ผลตรวจ"],
  ["members", "02", "โครง / จุดต่อ"],
  ["foundation", "03", "ฐานราก"],
  ["diagrams", "04", "แรงและการแอ่น"],
  ["model", "05", "โมเดล 3D"],
  ["book", "06", "รายการคำนวณ A4"],
  ["drawing", "07", "ชุดแบบ"],
  ["export", "08", "ส่งออก"]
]);
const VIEW_GROUPS = Object.freeze([
  Object.freeze(["review", "03.1", "ตรวจผล", "ผลรวม · สมาชิก · ฐาน · แรงและการแอ่น", Object.freeze(["results", "members", "foundation", "diagrams"])]),
  Object.freeze(["model", "03.2", "โมเดล 3D", "ตรวจรูปทรงและตำแหน่งจากผลชุดปัจจุบัน", Object.freeze(["model"])]),
  Object.freeze(["documents", "03.3", "เอกสาร", "รายการคำนวณ A4 · ชุดแบบ", Object.freeze(["book", "drawing"])]),
  Object.freeze(["deliver", "03.4", "ส่งออก", "ไฟล์และ CAD ของผลชุดเดียวกัน", Object.freeze(["export"])])
]);
function resolveOutputNavigation(controls = {}) {
  var _a2;
  const activeViewId = ((_a2 = VIEWS.find(([id2]) => {
    var _a3;
    return (_a3 = controls["view:" + id2]) == null ? void 0 : _a3.active;
  })) == null ? void 0 : _a2[0]) || VIEW_GROUPS[0][4][0];
  const activeGroup = VIEW_GROUPS.find(([, , , , ids]) => ids.includes(activeViewId)) || VIEW_GROUPS[0];
  return Object.freeze({ activeViewId, activeGroup, subtabIds: activeGroup[4].slice(1) });
}
function keyboardNavigationIndex(key, at, length) {
  if (at < 0 || length < 1 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(key)) return -1;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  return (at + (key === "ArrowLeft" ? -1 : 1) + length) % length;
}
const CAMERAS = Object.freeze([
  ["iso", "สามมิติ"],
  ["front", "ด้านหน้า"],
  ["back", "ด้านหลัง"],
  ["side", "ด้านข้าง"],
  ["top", "ด้านบน"],
  ["reset", "จัดพอดี"]
]);
const FOCUS = Object.freeze([
  ["whole", "ทั้งโครง"],
  ["head", "หัวป้าย"],
  ["pole", "เสา"],
  ["connection", "เพลท / สลัก"],
  ["base", "ฐานเสา"]
]);
createNativeContract({
  globals: [
    { id: "runtime:workbench", path: "NCYR22Workbench" },
    { id: "runtime:project-io", path: "NCYSignProjectIO" },
    { id: "runtime:flow-ready", path: "NCYR16Flow.ready", validate: (value) => value === true }
  ],
  dom: [
    { id: "viewer:tools", selector: "#r22ViewerTools" },
    { id: "result:navigation", selector: "#r22ResultNav" }
  ]
});
function createNativeWorkbench(doc, win) {
  const root = doc.documentElement, q2 = (selector) => doc.querySelector(selector);
  const selectors = {
    new: "#nR15New",
    clear: "#nR15Clear",
    open: '.app-header button[onclick*="importInput"]',
    save: '.app-header button[onclick="saveProject()"]',
    zoomIn: "#r22ZoomIn",
    zoomOut: "#r22ZoomOut",
    expand: "#r22Expand",
    orbit: '#r22ViewerTools [data-r22-drag="orbit"]',
    pan: '#r22ViewerTools [data-r22-drag="pan"]',
    calculate: "#cp025Calculate",
    "method:original": '[data-cp28-method="original"]',
    "method:new": '[data-cp28-method="new"]',
    "pile:I": 'input[name="n53PileType"][value="I"]',
    "pile:square": 'input[name="n53PileType"][value="square"]',
    pileConfirm: "#n53PileConfirm",
    pileCancel: "#n53PileCancel",
    pileUndo: "#n53PileUndo"
  };
  for (const [id2] of STAGES) selectors["stage:" + id2] = `#n15Nav [data-n38-stage="${id2}"]`;
  for (const [id2] of VIEWS) selectors["view:" + id2] = `#r22ResultNav [data-n15-view="${id2}"]`;
  for (const [id2] of CAMERAS) selectors["camera:" + id2] = `.n15-camera-tools [data-n15-camera="${id2}"]`;
  for (const [id2] of FOCUS) selectors["focus:" + id2] = `.n15-camera-tools [data-n32-focus="${id2}"]`;
  const busy = () => {
    var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k;
    return root.dataset.signN15Busy === "true" || !!(((_a2 = win.NCYSignProjectIO) == null ? void 0 : _a2.busy) || ((_b = win.NCYSignProjectIO) == null ? void 0 : _b.restoring) || ((_d = (_c = win.NCYCP025) == null ? void 0 : _c.state) == null ? void 0 : _d.r2Calculating) || ((_f = (_e = win.NCYCP029) == null ? void 0 : _e.state) == null ? void 0 : _f.searching) || ((_h = (_g = win.NCYCP029) == null ? void 0 : _g.state) == null ? void 0 : _h.applying) || ((_i = win.NCYSignFoundation) == null ? void 0 : _i.busy) || ((_j = win.NCYSignBaseConnection) == null ? void 0 : _j.busy) || ((_k = q2("#nR13Auto")) == null ? void 0 : _k.dataset.busy) === "true");
  };
  const viewerCommand = (name) => /^(camera:|focus:|zoomIn$|zoomOut$|orbit$|pan$|expand$)/.test(name);
  const disabled = (node, name = "") => !node || node.disabled || !(root.dataset.signN47Search === "true" && viewerCommand(name)) && (!!node.closest("[inert]") || busy());
  const control = (selector, name) => {
    const node = q2(selector);
    return Object.freeze({
      disabled: disabled(node, name),
      active: !!node && (["page", "step", "true"].includes(node.getAttribute("aria-current")) || node.getAttribute("aria-pressed") === "true")
    });
  };
  const resultAllowed = () => !disabled(q2('#n15Nav [data-n38-stage="outputs"]')) && !disabled(q2('#r22ResultNav [data-n15-view="book"]'));
  const captureNativeResult = () => captureCurrentResult({
    busy,
    allowed: resultAllowed,
    gate: () => {
      if (typeof win.NCYR14ParityGate !== "function") throw Error("ยังไม่พร้อมตรวจผลปัจจุบัน");
      win.NCYR14ParityGate("อ่านผลปัจจุบัน");
    },
    snapshot: () => win.NCYAnchorR10.snapshot()
  });
  const resultVersion = () => {
    var _a2, _b, _c, _d, _e, _f, _g;
    const run = (_b = (_a2 = win.NCYCP010) == null ? void 0 : _a2.state) == null ? void 0 : _b.lastRun;
    return [
      (run == null ? void 0 : run.at) || "",
      (run == null ? void 0 : run.method) || "",
      ((_c = q2("#cp025_method")) == null ? void 0 : _c.value) || "",
      ((_e = (_d = win.R7) == null ? void 0 : _d.result) == null ? void 0 : _e.modelId) || ((_g = (_f = win.APP) == null ? void 0 : _f.selected) == null ? void 0 : _g.modelId) || ""
    ];
  };
  const confirmedResult = createConfirmedResultLifecycle({
    capture: captureNativeResult,
    isBusy: busy,
    isAllowed: resultAllowed,
    version: resultVersion
  });
  let sceneReadoutFailed = false, sceneReadout = null, sceneDirty = true;
  const sceneIdentity = () => {
    const draft = q2("#n15Draft"), canvas = q2("#n15DraftCanvas");
    return JSON.stringify([
      (draft == null ? void 0 : draft.getAttribute("data-model-state")) || "",
      (draft == null ? void 0 : draft.hidden) ? "hidden" : "visible",
      (canvas == null ? void 0 : canvas.getAttribute("data-source")) || "",
      (canvas == null ? void 0 : canvas.getAttribute("data-method")) || "",
      (canvas == null ? void 0 : canvas.getAttribute("data-r32-realism")) || ""
    ]);
  };
  const readScene = () => {
    var _a2, _b, _c, _d;
    if (!sceneDirty) return sceneReadout;
    sceneDirty = false;
    try {
      sceneReadout = ((_b = (_a2 = win.NCYSignModelSync) == null ? void 0 : _a2.inspect) == null ? void 0 : _b.call(_a2)) || null;
      sceneReadoutFailed = false;
    } catch (error) {
      if (!sceneReadoutFailed) (_d = (_c = win.console) == null ? void 0 : _c.warn) == null ? void 0 : _d.call(_c, "SIGN 3D scene readout unavailable; holding scene identity", error);
      sceneReadoutFailed = true;
      sceneReadout = Object.freeze({ current: false, readError: true });
    }
    return sceneReadout;
  };
  const read = () => {
    var _a2, _b, _c, _d, _e;
    const result = confirmedResult.sync();
    return Object.freeze({
      stage: root.dataset.signN38Stage || "input",
      method: ((_a2 = q2("#cp025_method")) == null ? void 0 : _a2.value) === "new" ? "แบบที่ 2 · เสากลมต่อแกน RHS" : "แบบที่ 1 · เสาท่อกลม",
      busy: busy(),
      search: ((_c = (_b = win.NCYSearch47) == null ? void 0 : _b.inspect) == null ? void 0 : _c.call(_b)) || { active: false },
      controls: Object.freeze(Object.fromEntries(Object.entries(selectors).map(([key2, value2]) => [key2, control(value2, key2)]))),
      expanded: ((_d = q2("#r22Expand")) == null ? void 0 : _d.getAttribute("aria-expanded")) === "true",
      zoom: ((_e = q2("#r22Zoom")) == null ? void 0 : _e.value) || "100%",
      result,
      scene: inspectSceneContract(result, readScene())
    });
  };
  let value = read(), key = JSON.stringify(value), frame = 0, disposed = false;
  const listeners = /* @__PURE__ */ new Set();
  function refresh() {
    if (disposed) return;
    const next = read(), nextKey = JSON.stringify(next);
    if (key === nextKey) return;
    key = nextKey;
    value = next;
    for (const listener of listeners) listener();
  }
  function schedule() {
    if (disposed || frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  const observer = new win.MutationObserver(schedule);
  observer.observe(root, { attributes: true, attributeFilter: ["data-sign-n15-busy", "data-sign-n38-stage", "data-sign-n15-view", "data-sign-n47-search"] });
  const progressTimer = win.setInterval(() => {
    if (root.dataset.signN47Search === "true" || value.busy !== busy()) schedule();
  }, 300);
  for (const selector of [".app-header", "#n15Nav", "#r22ResultNav", ".n15-camera-tools", "#r22ViewerTools", "#cp28MethodCards", "#n53PileEditor", "#cp025Calculate"]) {
    for (const node of doc.querySelectorAll(selector)) observer.observe(node, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
      attributeFilter: ["disabled", "inert", "aria-current", "aria-pressed", "aria-expanded"]
    });
  }
  let sceneIdentityKey = sceneIdentity();
  const sceneObserver = new win.MutationObserver(() => {
    const nextIdentity = sceneIdentity();
    if (nextIdentity === sceneIdentityKey) return;
    sceneIdentityKey = nextIdentity;
    sceneDirty = true;
    schedule();
  });
  for (const node of doc.querySelectorAll("#n15Draft")) sceneObserver.observe(node, {
    attributes: true,
    attributeFilter: ["data-model-state", "hidden"]
  });
  for (const node of doc.querySelectorAll("#n15DraftCanvas")) sceneObserver.observe(node, {
    attributes: true,
    attributeFilter: ["data-source", "data-method", "data-r32-realism"]
  });
  for (const name of ["input", "change", "click"]) doc.addEventListener(name, schedule, true);
  return Object.freeze({
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(name) {
      if (disposed || !Object.hasOwn(selectors, name)) return false;
      const node = q2(selectors[name]);
      if (disabled(node, name)) {
        refresh();
        return false;
      }
      try {
        const output = name === "stage:outputs" || name.startsWith("view:");
        if (output) confirmedResult.guard(() => node.click());
        else activateNativeControl(node);
      } catch (_) {
        refresh();
        schedule();
        return false;
      }
      refresh();
      schedule();
      return true;
    },
    captureResult() {
      try {
        return confirmedResult.requireCurrent();
      } finally {
        refresh();
        schedule();
      }
    },
    inspectResult: () => confirmedResult.getSnapshot(),
    stopSearch(edit = false) {
      var _a2;
      (_a2 = win.NCYSearch47) == null ? void 0 : _a2.stop(edit);
      refresh();
      schedule();
    },
    refresh,
    dispose() {
      disposed = true;
      win.clearInterval(progressTimer);
      confirmedResult.dispose();
      observer.disconnect();
      sceneObserver.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      for (const name of ["input", "change", "click"]) doc.removeEventListener(name, schedule, true);
      listeners.clear();
    }
  });
}
function keyboardNavigate(event) {
  var _a2;
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll("button:not(:disabled)")];
  const at = buttons.indexOf(event.target);
  const to = keyboardNavigationIndex(event.key, at, buttons.length);
  if (to < 0) return;
  event.preventDefault();
  (_a2 = buttons[to]) == null ? void 0 : _a2.focus();
}
function Command({ adapter, state: state2, name, children, ...props }) {
  const control = state2.controls[name];
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-r26-command": name,
      disabled: !control || control.disabled,
      onClick: () => adapter.command(name),
      ...props
    },
    children
  );
}
function BrandLockup() {
  return /* @__PURE__ */ React.createElement("span", { className: "ncy-brand-lockup" }, /* @__PURE__ */ React.createElement("span", { className: "ncy-brand-tile" }, /* @__PURE__ */ React.createElement("svg", { className: "ncy-brand-mark", viewBox: "0 0 176 54", role: "img", "aria-label": "นายช่างใหญ่" }, /* @__PURE__ */ React.createElement("g", { fill: "#073476" }, /* @__PURE__ */ React.createElement("path", { d: "M6 9h12v36H6zM18 9h11l22 26V9h12v36H52L30 19v26H18z" }), /* @__PURE__ */ React.createElement("path", { d: "M104 9H82C69 9 61 16 61 27s8 18 21 18h22V33H83c-6 0-9-2-9-6s3-6 9-6h21z" })), /* @__PURE__ */ React.createElement("path", { fill: "#ff4b0b", d: "M105 9h15l12 14 12-14h15l-21 26v10h-12V35z" }), /* @__PURE__ */ React.createElement("g", { fill: "#f4f7fb" }, /* @__PURE__ */ React.createElement("path", { d: "M77 35h3v7h-3zM84 38h3v4h-3zM91 33h3v9h-3zM98 37h3v5h-3z" })))), /* @__PURE__ */ React.createElement("span", { className: "ncy-brand-copy" }, /* @__PURE__ */ React.createElement("strong", null, "นายช่าง", /* @__PURE__ */ React.createElement("span", { className: "ncy-brand-accent" }, "ใหญ่")), /* @__PURE__ */ React.createElement("small", null, "CIVIL APPS")));
}
const COMPONENT_TITLES = Object.freeze({ head: "โครงหัวป้าย", pole: "เสาป้าย", connection: "เพลท · แนวเชื่อม · สลัก", foundation: "ตอม่อ · ฐานราก · เสาเข็ม" });
const dcOf = (row2) => row2.dc === "Infinity" ? Infinity : typeof row2.dc === "number" && Number.isFinite(row2.dc) ? row2.dc : null;
function summarizeChecks(rows) {
  var _a2;
  if (!Array.isArray(rows)) return null;
  const counts = { fail: 0, pass: 0, pending: 0, muted: 0 };
  const byComponent = Object.fromEntries(Object.keys(COMPONENT_TITLES).map((id2) => [id2, { id: id2, title: COMPONENT_TITLES[id2], max: null, fail: 0, pending: 0, count: 0 }]));
  const scored = [];
  for (const row2 of rows) {
    const tone = ((_a2 = row2.state) == null ? void 0 : _a2.tone) || "pending", dc2 = dcOf(row2), comp = byComponent[row2.component] || byComponent.foundation;
    counts[tone] = (counts[tone] || 0) + 1;
    comp.count++;
    if (tone === "fail") comp.fail++;
    if (tone === "pending") comp.pending++;
    if (dc2 !== null) {
      if (comp.max === null || dc2 > comp.max.dc) comp.max = { dc: dc2, name: row2.name, combo: row2.combo || "" };
      scored.push({ dc: dc2, tone, name: row2.name, combo: row2.combo || "", component: comp.id });
    }
  }
  scored.sort((a, b) => b.dc - a.dc);
  return Object.freeze({
    counts,
    governing: scored[0] || null,
    top: scored.slice(0, 6),
    pending: rows.filter((r2) => {
      var _a3;
      return (((_a3 = r2.state) == null ? void 0 : _a3.tone) || "pending") === "pending";
    }).map((r2) => r2.name).slice(0, 4),
    components: Object.values(byComponent),
    verdict: counts.fail ? "fail" : counts.pending ? "pending" : rows.length ? "pass" : "none"
  });
}
const formatDc = (dc2) => dc2 === Infinity ? "∞" : dc2 === null || dc2 === void 0 ? "—" : dc2.toFixed(3);
function StatusBar({ state: state2 }) {
  var _a2, _b, _c, _d, _e, _f;
  const s = ((_a2 = state2.result) == null ? void 0 : _a2.phase) === "current" ? summarizeChecks(((_c = (_b = window.NCYSignCheckRows) == null ? void 0 : _b.inspect) == null ? void 0 : _c.call(_b)) ?? null) : null;
  const stage = { input: "01 กรอกข้อมูล", select: "02 เลือกและยืนยันชุด", outputs: "03 ตรวจผลและส่งออก" }[state2.stage] || "";
  const verdict = !s ? ((_d = state2.result) == null ? void 0 : _d.phase) === "stale" ? "ผลเดิมถูกยกเลิก · ต้องคำนวณใหม่" : ((_e = state2.result) == null ? void 0 : _e.phase) === "current" ? "ผลอ้างอิงชุดปัจจุบัน · ดูรายการในแท็บผล" : "ยังไม่มีผลยืนยัน" : s.verdict === "fail" ? `ไม่ผ่าน ${s.counts.fail} รายการ` : s.verdict === "pending" ? `ยังตรวจไม่ครบ ${s.counts.pending} รายการ` : "ผ่านรายการที่ตรวจได้";
  return /* @__PURE__ */ React.createElement("footer", { className: "r50-statusbar", "aria-label": "สถานะผลปัจจุบัน" }, /* @__PURE__ */ React.createElement("div", null, "ขั้น ", /* @__PURE__ */ React.createElement("b", null, stage)), /* @__PURE__ */ React.createElement("div", null, "D/C สูงสุด ", /* @__PURE__ */ React.createElement("b", null, (s == null ? void 0 : s.governing) ? `${formatDc(s.governing.dc)} · ${s.governing.name}` : "—")), /* @__PURE__ */ React.createElement("div", null, "ผล ", /* @__PURE__ */ React.createElement("b", null, verdict)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "REVIEW / NOT FOR CONSTRUCTION"), ((_f = state2.result) == null ? void 0 : _f.modelId) ? ` · ${state2.result.modelId}` : ""));
}
const field = (id2) => {
  var _a2;
  const e = document.getElementById(id2);
  return !e ? "" : e.tagName === "SELECT" ? (((_a2 = e.selectedOptions[0]) == null ? void 0 : _a2.textContent) || "").trim() : String(e.value || "").trim();
};
function ProjectStrip({ state: state2 }) {
  var _a2;
  const [, bump] = reactExports.useReducer((x2) => x2 + 1, 0);
  reactExports.useEffect(() => {
    const on = () => bump();
    document.addEventListener("input", on, true);
    document.addEventListener("change", on, true);
    return () => {
      document.removeEventListener("input", on, true);
      document.removeEventListener("change", on, true);
    };
  }, []);
  const name = field("cp025_r_project"), W2 = field("cp025_signW"), H2 = field("cp025_signH"), top = field("cp025_topH");
  const province = field("cp025_wind_province"), piles = String(((_a2 = document.getElementById("cp025_pileN")) == null ? void 0 : _a2.value) || "").trim(), mode = field("foundationMode");
  return /* @__PURE__ */ React.createElement("div", { className: "r50-strip", "aria-label": "ข้อมูลโครงการ" }, /* @__PURE__ */ React.createElement("span", null, "โครงการ ", /* @__PURE__ */ React.createElement("strong", null, name || "ยังไม่ตั้งชื่อ")), /* @__PURE__ */ React.createElement("span", null, "แบบ ", /* @__PURE__ */ React.createElement("strong", null, state2.method)), W2 && H2 && /* @__PURE__ */ React.createElement("span", null, "ป้าย ", /* @__PURE__ */ React.createElement("strong", null, W2, " × ", H2, " m"), top ? /* @__PURE__ */ React.createElement(React.Fragment, null, " · ยอด ", /* @__PURE__ */ React.createElement("strong", null, top, " m")) : null), province && /* @__PURE__ */ React.createElement("span", null, "ลม ", /* @__PURE__ */ React.createElement("strong", null, province), " · มยผ.1311-50"), mode && /* @__PURE__ */ React.createElement("span", null, "ฐาน ", /* @__PURE__ */ React.createElement("strong", null, /pile/.test(mode) || /เข็ม/.test(mode) ? `เข็ม ${piles || "—"} ต้น` : "ฐานแผ่")), /* @__PURE__ */ React.createElement("span", { className: "r50-strip-pill" }, "REVIEW / NOT FOR CONSTRUCTION"));
}
function ProjectToolbar({ adapter, state: state2, release }) {
  var _a2;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("header", { className: "r26-header" }, /* @__PURE__ */ React.createElement("div", { className: "r27-identity" }, /* @__PURE__ */ React.createElement(BrandLockup, null), /* @__PURE__ */ React.createElement("span", { className: "ncy-brand-divider", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("div", { className: "ncy-product" }, /* @__PURE__ */ React.createElement("strong", null, "ออกแบบโครงสร้างป้ายโฆษณา ", /* @__PURE__ */ React.createElement("b", { className: "ncy-product-code" }, "BB-01")), /* @__PURE__ */ React.createElement("span", null, state2.method, " · โต๊ะทำงานวิศวกรรม"))), /* @__PURE__ */ React.createElement("div", { className: "r26-project-actions", role: "group", "aria-label": "ไฟล์โครงการ" }, /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "new" }, "โครงการใหม่"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "open" }, "เปิดโครงการ"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "save" }, "บันทึกโครงการ"), /* @__PURE__ */ React.createElement(
    Command,
    {
      adapter,
      state: state2,
      name: "view:book",
      className: "r50-shortcut",
      title: "รายการคำนวณ A4 ของชุดที่ยืนยันแล้ว",
      disabled: !!((_a2 = state2.controls["view:book"]) == null ? void 0 : _a2.disabled) || state2.stage !== "outputs"
    },
    "รายการคำนวณ A4"
  ), /* @__PURE__ */ React.createElement("details", { className: "r26-more" }, /* @__PURE__ */ React.createElement("summary", null, "เพิ่มเติม"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "clear" }, "ล้างข้อมูล")), /* @__PURE__ */ React.createElement("small", null, release))), /* @__PURE__ */ React.createElement(ProjectStrip, { state: state2 }), /* @__PURE__ */ React.createElement(StatusBar, { state: state2 }));
}
const idle = (snapshot) => {
  var _a2;
  return !(snapshot == null ? void 0 : snapshot.busy) && !((_a2 = snapshot == null ? void 0 : snapshot.search) == null ? void 0 : _a2.active);
};
function createDeferredSave({ adapter, setTimeout: later = globalThis.setTimeout, clearTimeout: cancelLater = globalThis.clearTimeout, now = () => Date.now(), settleMs = 300 }) {
  let status = "idle", firstIdleAt = null, timer = 0;
  const listeners = /* @__PURE__ */ new Set();
  const set = (next) => {
    if (next === status) return;
    status = next;
    for (const listener of listeners) listener();
  };
  const clearTimer = () => {
    if (timer) cancelLater(timer);
    timer = 0;
  };
  const fire = () => {
    clearTimer();
    firstIdleAt = null;
    let ok2 = false;
    try {
      ok2 = adapter.command("save") === true;
    } catch (_) {
      ok2 = false;
    }
    set(ok2 ? "saved" : "failed");
    return ok2;
  };
  function check() {
    var _a2;
    if (status !== "pending") return;
    (_a2 = adapter.refresh) == null ? void 0 : _a2.call(adapter);
    if (!idle(adapter.getSnapshot())) {
      firstIdleAt = null;
      clearTimer();
      return;
    }
    const t2 = now();
    if (firstIdleAt === null) {
      firstIdleAt = t2;
      clearTimer();
      timer = later(check, settleMs);
      return;
    }
    if (t2 - firstIdleAt >= settleMs) fire();
    else {
      clearTimer();
      timer = later(check, settleMs - (t2 - firstIdleAt));
    }
  }
  const unsubscribe = adapter.subscribe(check);
  return Object.freeze({
    request() {
      if (status === "pending") return "pending";
      if (idle(adapter.getSnapshot())) return fire() ? "saved" : "failed";
      firstIdleAt = null;
      set("pending");
      return "pending";
    },
    cancel() {
      if (status !== "pending") return false;
      clearTimer();
      firstIdleAt = null;
      set("idle");
      return true;
    },
    dismiss() {
      if (status === "saved" || status === "failed") set("idle");
    },
    check,
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      clearTimer();
      unsubscribe == null ? void 0 : unsubscribe();
      listeners.clear();
    }
  });
}
function createEtaTracker({ now = () => Date.now(), window: size = 8 } = {}) {
  let phaseKey = "", samples = [];
  return Object.freeze({
    sample(search) {
      if (!(search == null ? void 0 : search.active)) {
        phaseKey = "";
        samples = [];
        return null;
      }
      const key = search.message + "|" + search.total, t2 = now();
      if (key !== phaseKey) {
        phaseKey = key;
        samples = [];
      }
      const last = samples[samples.length - 1];
      if (!last || last.done !== search.done) samples.push({ t: t2, done: search.done });
      if (samples.length > size) samples.shift();
      if (samples.length < 3 || !(search.total > 0)) return null;
      const first = samples[0], end = samples[samples.length - 1];
      const rate = (end.done - first.done) / Math.max(1, end.t - first.t);
      if (!(rate > 0)) return null;
      return Math.max(0, Math.round((search.total - search.done) / rate / 1e3));
    }
  });
}
const formatEta = (seconds) => seconds === null || !Number.isFinite(seconds) ? "กำลังประเมินเวลา" : seconds < 60 ? `เหลือราว ${Math.max(1, seconds)} วินาที` : `เหลือราว ${Math.round(seconds / 60)} นาที`;
const TABS = Object.freeze([
  ["results", "01", "สรุป", "view:results"],
  ["select", "02", "เลือกชุด", "stage:select"],
  ["members", "03", "โครง / จุดต่อ", "view:members"],
  ["foundation", "04", "ฐานราก", "view:foundation"],
  ["diagrams", "05", "แรงและการแอ่น", "view:diagrams"],
  ["model", "06", "3D", "view:model"],
  ["book", "07", "รายการคำนวณ A4", "view:book"],
  ["drawing", "08", "แบบ / ส่งออก", "view:drawing"]
]);
function SearchProgress({ adapter, search, deferredSave }) {
  const eta = reactExports.useMemo(() => createEtaTracker(), []);
  const saveStatus = reactExports.useSyncExternalStore(deferredSave.subscribe, deferredSave.getStatus);
  const spoken = reactExports.useRef({ text: "", at: 0 });
  const seconds = eta.sample(search);
  const count2 = (search == null ? void 0 : search.total) > 0 ? `${search.done}/${search.total} ชุด` : "";
  const text2 = (search == null ? void 0 : search.active) ? `${search.message}${count2 ? " " + count2 : ""} · ${formatEta(seconds)}` : "";
  const t2 = Date.now();
  if (text2 && (t2 - spoken.current.at >= 1e3 || !spoken.current.text)) spoken.current = { text: text2, at: t2 };
  const saveNote = { pending: "จะบันทึกโครงการเมื่อค้นเสร็จ", saved: "บันทึกโครงการแล้ว", failed: "บันทึกไม่สำเร็จ · กดบันทึกอีกครั้ง" }[saveStatus];
  if (!(search == null ? void 0 : search.active)) return saveNote && saveStatus !== "pending" ? /* @__PURE__ */ React.createElement("div", { className: "r47-search-progress r49-save-note", "data-save": saveStatus }, /* @__PURE__ */ React.createElement("span", { role: "status" }, saveNote), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => deferredSave.dismiss() }, "ปิด"))) : null;
  const percent = search.total > 0 ? Math.min(100, Math.round(search.done / search.total * 100)) : null;
  return /* @__PURE__ */ React.createElement("div", { className: "r47-search-progress r52-searching", "data-save": saveStatus }, /* @__PURE__ */ React.createElement("span", { className: "r52-spinner", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("div", { className: "r49-search-copy" }, /* @__PURE__ */ React.createElement("strong", null, "ผลชุดปัจจุบันใช้ได้ · การค้นเพิ่มเป็นทางเลือก"), /* @__PURE__ */ React.createElement("small", { role: "status" }, spoken.current.text, saveNote ? " · " + saveNote : ""), /* @__PURE__ */ React.createElement("div", { className: "r52-meter", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("div", { className: "r52-bar", "data-indeterminate": percent == null ? "" : void 0 }, /* @__PURE__ */ React.createElement("span", { style: percent == null ? void 0 : { width: Math.max(percent, 2) + "%" } })), percent != null && /* @__PURE__ */ React.createElement("span", { className: "r52-percent" }, percent, "%")), search.total > 0 && /* @__PURE__ */ React.createElement("progress", { className: "r52-native-progress", max: search.total, value: search.done }, count2)), /* @__PURE__ */ React.createElement("div", { className: "r49-search-actions" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: "r49-search-primary", disabled: search.stopping, onClick: () => adapter.stopSearch() }, "หยุดค้นและใช้ชุดนี้"), /* @__PURE__ */ React.createElement("button", { type: "button", disabled: search.stopping, onClick: () => adapter.stopSearch(true) }, "หยุดและกลับแก้ข้อมูล"), saveStatus === "pending" ? /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => deferredSave.cancel() }, "ยกเลิกบันทึกอัตโนมัติ") : /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => deferredSave.request() }, "บันทึกเมื่อค้นเสร็จ")));
}
function WorkflowNav({ adapter, state: state2 }) {
  var _a2, _b;
  const deferredSave = reactExports.useMemo(() => createDeferredSave({ adapter }), [adapter]);
  reactExports.useEffect(() => () => deferredSave.dispose(), [deferredSave]);
  const { activeViewId } = resolveOutputNavigation(state2.controls);
  const activeTab = state2.stage === "select" ? "select" : state2.stage === "outputs" ? activeViewId === "export" ? "drawing" : activeViewId : null;
  const hasResult = !((_a2 = state2.controls["stage:select"]) == null ? void 0 : _a2.disabled);
  reactExports.useEffect(() => {
    const root = document.documentElement;
    if (state2.stage === "outputs") root.dataset.r50View = activeViewId;
    else delete root.dataset.r50View;
  }, [state2.stage, activeViewId]);
  reactExports.useEffect(() => () => {
    delete document.documentElement.dataset.r50View;
  }, []);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("nav", { className: "r26-workflow r50-tabs", "aria-label": "ผลของชุดปัจจุบัน", onKeyDown: keyboardNavigate }, /* @__PURE__ */ React.createElement("ol", { role: "tablist" }, state2.stage !== "input" && /* @__PURE__ */ React.createElement("li", { className: "r50-edit" }, /* @__PURE__ */ React.createElement(
    Command,
    {
      adapter,
      state: state2,
      name: "stage:input",
      title: "กลับไปแก้ข้อมูลแล้วคำนวณใหม่"
    },
    "✎ แก้ข้อมูล"
  )), TABS.map(([id2, number, label, command]) => {
    var _a3, _b2;
    const locked = !!((_a3 = state2.controls[command]) == null ? void 0 : _a3.disabled) || command.startsWith("view:") && state2.stage !== "outputs" && ((_b2 = state2.result) == null ? void 0 : _b2.phase) !== "current";
    return /* @__PURE__ */ React.createElement("li", { key: id2, "data-state": activeTab === id2 ? "current" : locked ? "locked" : "ready" }, /* @__PURE__ */ React.createElement(
      Command,
      {
        adapter,
        state: state2,
        name: command,
        role: "tab",
        "aria-selected": activeTab === id2,
        disabled: locked,
        "aria-current": command.startsWith("stage:") && state2.stage === "select" ? "step" : void 0,
        title: locked ? hasResult ? "ยืนยันชุดในแท็บ 02 ก่อน" : "คำนวณก่อน" : label
      },
      /* @__PURE__ */ React.createElement("span", { className: "r26-step-number" }, number),
      /* @__PURE__ */ React.createElement("span", { className: "r31-step-copy" }, /* @__PURE__ */ React.createElement("strong", null, label)),
      locked && /* @__PURE__ */ React.createElement("em", { className: "r50-lock", "aria-hidden": "true" }, "ล็อก")
    ));
  }), state2.stage === "select" && /* @__PURE__ */ React.createElement("li", { className: "r49-view3d" }, /* @__PURE__ */ React.createElement(
    Command,
    {
      adapter,
      state: state2,
      name: "expand",
      "aria-controls": "n15Draft",
      "aria-expanded": state2.expanded,
      title: "เปิดโมเดล 3D ของชุดปัจจุบันแบบเต็มจอ · กด Esc เพื่อกลับ"
    },
    "ดู 3D"
  ))), activeTab === "drawing" && /* @__PURE__ */ React.createElement("div", { className: "r50-subtabs", role: "group", "aria-label": "แบบและไฟล์ส่งออก" }, /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "view:drawing", "aria-pressed": activeViewId === "drawing" }, "ชุดแบบ"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "view:export", "aria-pressed": activeViewId === "export" }, "ส่งออก PDF / DXF")), state2.stage === "input" && /* @__PURE__ */ React.createElement("p", { className: "r50-hint" }, hasResult ? "แก้ข้อมูลแล้วกด “คำนวณและเลือกชุดโครงสร้าง” เพื่อสร้างผลชุดใหม่" : "กรอกข้อมูลในแผงข้อมูลแล้วกด “คำนวณและเลือกชุดโครงสร้าง” · แท็บผลจะเปิดหลังคำนวณ")), ((_b = state2.search) == null ? void 0 : _b.active) && /* @__PURE__ */ React.createElement("div", { className: "r52-toploader", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement(SearchProgress, { adapter, search: state2.search, deferredSave }));
}
const MISSING_SCENE = Object.freeze({
  phase: "hold",
  current: false,
  resultId: "",
  geometryId: "",
  renderId: "",
  source: "",
  summary: Object.freeze({ faces: 0, rebarFaces: 0 }),
  authority: "REVIEW / NOT FOR CONSTRUCTION",
  message: "3D HOLD · อ่านสถานะ scene ไม่สำเร็จ"
});
const VIEWER_HELP = "ลากเพื่อหมุน · Shift+ลากเพื่อเลื่อน · Ctrl + ล้อเมาส์ หรือสองนิ้วเพื่อซูม · Esc ออกจากพื้นที่ขยาย";
function ViewerToolbar({ adapter, state: state2 }) {
  var _a2;
  reactExports.useEffect(() => {
    const help = document.querySelector("#n15Draft .n15-viewer-help");
    if (help && help.textContent !== VIEWER_HELP) help.textContent = VIEWER_HELP;
  });
  const scene = state2.scene || MISSING_SCENE;
  const geometryFallback = { hold: "HOLD", busy: "กำลังอัปเดต", stale: "ยกเลิกแล้ว", ready: "รอยืนยัน 3D" }[scene.phase] || "DRAFT";
  const sceneIdentity = scene.geometryId || scene.renderId;
  const sceneIdentityLabel = scene.renderId ? "รอบเรนเดอร์" : "Geometry";
  return /* @__PURE__ */ React.createElement("div", { className: "r26-viewer-controls" }, ((_a2 = state2.search) == null ? void 0 : _a2.active) ? /* @__PURE__ */ React.createElement("p", { className: "r47-viewer-note" }, "โมเดลชุดใช้งานปัจจุบัน · กำลังค้นทางเลือกเพิ่ม · หมุนและซูมได้") : /* @__PURE__ */ React.createElement("section", { className: "r37-scene-state", "data-phase": scene.phase, "aria-labelledby": "r37-scene-heading" }, /* @__PURE__ */ React.createElement("div", { className: "r37-scene-heading" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h3", { id: "r37-scene-heading" }, "3D ชุดปัจจุบัน"), /* @__PURE__ */ React.createElement("span", { role: "status", "aria-live": "polite" }, scene.message)), /* @__PURE__ */ React.createElement("strong", { className: "r37-authority" }, scene.authority)), /* @__PURE__ */ React.createElement("dl", null, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "ผล"), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("code", null, scene.resultId || "รอผลยืนยัน"))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, sceneIdentityLabel), /* @__PURE__ */ React.createElement("dd", null, sceneIdentity ? /* @__PURE__ */ React.createElement("code", null, sceneIdentity) : /* @__PURE__ */ React.createElement("span", { className: "r37-scene-empty" }, geometryFallback))), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "ผิวโมเดล"), /* @__PURE__ */ React.createElement("dd", null, scene.summary.faces || "—", scene.summary.rebarFaces ? ` · เหล็ก ${scene.summary.rebarFaces}` : "")))), /* @__PURE__ */ React.createElement("div", { className: "r26-camera", role: "group", "aria-label": "มุมมองสามมิติ", onKeyDown: keyboardNavigate }, CAMERAS.map(([id2, label]) => /* @__PURE__ */ React.createElement(
    Command,
    {
      key: id2,
      adapter,
      state: state2,
      name: "camera:" + id2,
      "aria-pressed": id2 === "reset" ? void 0 : state2.controls["camera:" + id2].active
    },
    label
  ))), /* @__PURE__ */ React.createElement("div", { className: "r26-camera", role: "group", "aria-label": "ควบคุมภาพสามมิติ" }, /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "orbit", "aria-pressed": state2.controls.orbit.active }, "หมุน"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "pan", "aria-pressed": state2.controls.pan.active }, "เลื่อน"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "zoomOut", "aria-label": "ย่อภาพสามมิติ" }, "−"), /* @__PURE__ */ React.createElement("output", { "aria-label": "ระดับซูม" }, state2.zoom), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "zoomIn", "aria-label": "ขยายภาพสามมิติ" }, "+"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "expand", "aria-expanded": state2.expanded, "aria-controls": "n15Draft" }, state2.expanded ? "กลับพื้นที่ทำงาน" : "ขยายพื้นที่ 3D")), /* @__PURE__ */ React.createElement("div", { className: "r26-camera", role: "group", "aria-label": "ส่วนของโมเดล", onKeyDown: keyboardNavigate }, FOCUS.map(([id2, label]) => /* @__PURE__ */ React.createElement(
    Command,
    {
      key: id2,
      adapter,
      state: state2,
      name: "focus:" + id2,
      "aria-pressed": state2.controls["focus:" + id2].active
    },
    label
  ))));
}
const TONE = { fail: "ไม่ผ่าน", pass: "ผ่าน", pending: "ยังตรวจไม่ครบ", none: "ยังไม่มีผล" };
const COMPONENT_LABEL = { head: "หัวป้าย", pole: "เสา", connection: "จุดต่อ", foundation: "ฐานราก" };
function MiniModel({ sceneKey }) {
  const svg = reactExports.useMemo(() => {
    const node = document.querySelector("#n15DraftCanvas svg");
    return node && sceneKey ? node.outerHTML : "";
  }, [sceneKey]);
  return svg ? /* @__PURE__ */ React.createElement("div", { className: "r50-mini3d-art", "aria-label": "ภาพ 3D ของชุดปัจจุบัน", dangerouslySetInnerHTML: { __html: svg } }) : /* @__PURE__ */ React.createElement("p", { className: "r50-mini3d-empty" }, "ภาพ 3D จะแสดงเมื่อโมเดลของชุดนี้พร้อม");
}
function Summary({ adapter, state: state2 }) {
  var _a2, _b, _c;
  const rows = ((_b = (_a2 = window.NCYSignCheckRows) == null ? void 0 : _a2.inspect) == null ? void 0 : _b.call(_a2)) ?? null;
  const s = summarizeChecks(rows);
  const sceneKey = ((_c = state2.scene) == null ? void 0 : _c.resultId) ? `${state2.scene.resultId}|${state2.scene.renderId || ""}` : "";
  if (!s) return null;
  const gov = s.governing;
  return /* @__PURE__ */ React.createElement("section", { className: "r50-summary", "aria-label": "สรุปผลชุดปัจจุบัน" }, /* @__PURE__ */ React.createElement("div", { className: "r50-metrics" }, /* @__PURE__ */ React.createElement("div", { className: "r50-metric" + (s.verdict === "fail" ? " is-fail" : "") }, /* @__PURE__ */ React.createElement("small", null, "D/C สูงสุดทั้งระบบ"), /* @__PURE__ */ React.createElement("b", null, formatDc(gov == null ? void 0 : gov.dc)), /* @__PURE__ */ React.createElement("span", null, gov ? `${gov.name}${gov.combo ? " · " + gov.combo : ""}` : "ยังไม่มีรายการที่มีค่า D/C")), /* @__PURE__ */ React.createElement("div", { className: "r50-metric" }, /* @__PURE__ */ React.createElement("small", null, "สถานะรายการตรวจ"), /* @__PURE__ */ React.createElement("b", null, TONE[s.verdict]), /* @__PURE__ */ React.createElement("span", null, "ไม่ผ่าน ", s.counts.fail, " · ผ่าน ", s.counts.pass, " · ยังตรวจไม่ครบ ", s.counts.pending)), s.components.filter((c) => {
    var _a3;
    return c.id !== ((_a3 = s.governing) == null ? void 0 : _a3.component);
  }).sort((a, b) => {
    var _a3, _b2;
    return b.fail - a.fail || (((_a3 = b.max) == null ? void 0 : _a3.dc) ?? -1) - (((_b2 = a.max) == null ? void 0 : _b2.dc) ?? -1);
  }).slice(0, 2).map((c) => {
    var _a3;
    return /* @__PURE__ */ React.createElement("div", { key: c.id, className: "r50-metric" + (c.fail ? " is-fail" : "") }, /* @__PURE__ */ React.createElement("small", null, c.title), /* @__PURE__ */ React.createElement("b", null, formatDc(((_a3 = c.max) == null ? void 0 : _a3.dc) ?? null)), /* @__PURE__ */ React.createElement("span", null, c.max ? c.max.name : c.pending ? `ยังตรวจไม่ครบ ${c.pending} รายการ` : "ไม่มีรายการ"));
  })), /* @__PURE__ */ React.createElement("div", { className: "r50-summary-body" }, /* @__PURE__ */ React.createElement("figure", { className: "r50-mini3d" }, /* @__PURE__ */ React.createElement("span", { className: "r50-mini3d-wm" }, "REVIEW · NOT FOR CONSTRUCTION"), /* @__PURE__ */ React.createElement(Command, { adapter, state: state2, name: "view:model" }, "เปิด 3D เต็ม"), /* @__PURE__ */ React.createElement(MiniModel, { sceneKey })), /* @__PURE__ */ React.createElement("div", { className: "r50-gov" }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h4", null, "รายการคุมการออกแบบ")), /* @__PURE__ */ React.createElement("ol", null, s.top.map((r2, i) => /* @__PURE__ */ React.createElement("li", { key: i, "data-tone": r2.tone }, /* @__PURE__ */ React.createElement("b", null, r2.name), /* @__PURE__ */ React.createElement("span", { className: "dc" }, formatDc(r2.dc)), /* @__PURE__ */ React.createElement("small", null, COMPONENT_LABEL[r2.component], r2.combo ? " · " + r2.combo : "", " · ", r2.tone === "fail" ? "ไม่ผ่าน" : "ผ่านรายการนี้"), /* @__PURE__ */ React.createElement("span", { className: "bar" }, /* @__PURE__ */ React.createElement("i", { style: { width: Math.min(100, (r2.dc === Infinity ? 1 : r2.dc) * 100) + "%" } })))), s.pending.length > 0 && /* @__PURE__ */ React.createElement("li", { "data-tone": "pending" }, /* @__PURE__ */ React.createElement("b", null, "ยังตรวจไม่ครบ ", s.counts.pending, " รายการ"), /* @__PURE__ */ React.createElement("span", { className: "dc" }, "—"), /* @__PURE__ */ React.createElement("small", null, s.pending.join(" · "), s.counts.pending > s.pending.length ? " …" : ""))), /* @__PURE__ */ React.createElement("p", { className: "r50-scope" }, "ตัวเลขมาจากผลชุดเดียวกับรายการด้านล่าง รายงาน A4 และ DXF · REVIEW / NOT FOR CONSTRUCTION"))));
}
function SummaryPanel({ adapter, state: state2 }) {
  var _a2, _b, _c;
  const [host, setHost] = reactExports.useState(null);
  const { activeViewId } = resolveOutputNavigation(state2.controls);
  const show = state2.stage === "outputs" && activeViewId === "results" && ((_a2 = state2.result) == null ? void 0 : _a2.phase) === "current";
  reactExports.useLayoutEffect(() => {
    const node = document.createElement("div");
    node.id = "r50-summary-host";
    setHost(node);
    return () => node.remove();
  }, []);
  reactExports.useLayoutEffect(() => {
    if (!host) return;
    const anchor = document.getElementById("n32Results");
    if (anchor && host.nextElementSibling !== anchor) anchor.before(host);
  });
  const hasRows = show && Array.isArray((_c = (_b = window.NCYSignCheckRows) == null ? void 0 : _b.inspect) == null ? void 0 : _c.call(_b));
  reactExports.useLayoutEffect(() => {
    const root = document.documentElement;
    if (hasRows) root.dataset.r50Summary = "";
    else delete root.dataset.r50Summary;
  }, [hasRows]);
  if (!host) return null;
  host.hidden = !hasRows;
  return hasRows ? reactDomExports.createPortal(/* @__PURE__ */ React.createElement(Summary, { adapter, state: state2 }), host) : null;
}
const fmt = (dc2) => dc2 === Infinity ? "∞" : typeof dc2 === "number" && Number.isFinite(dc2) ? dc2.toFixed(3) : "—";
function Checklist({ check }) {
  const [error, setError] = reactExports.useState("");
  if (check.error) return /* @__PURE__ */ React.createElement("p", { className: "r69-error" }, "รายการตรวจยังไม่พร้อม: ", check.error);
  const missing = check.rows.flatMap((r2) => (r2.missing || []).map((m2) => `${r2.id} ${m2.label}`));
  return /* @__PURE__ */ React.createElement("section", { className: "r69-permit", "aria-label": "รายการตรวจระดับยื่นขออนุญาต" }, /* @__PURE__ */ React.createElement("header", null, /* @__PURE__ */ React.createElement("h4", null, "รายการตรวจระดับยื่นขออนุญาต (P1–P11)"), check.verdict === "pass" ? /* @__PURE__ */ React.createElement("p", { className: "r69-badge ok" }, check.badge) : /* @__PURE__ */ React.createElement("p", { className: "r69-badge draft" }, "ยังไม่ครบ · ไม่ผ่าน ", check.counts.fail, " · ขาดข้อมูล ", check.counts.missing, check.appendixNG.length ? ` · ภาคผนวกไม่ผ่าน ${check.appendixNG.length}` : ""), /* @__PURE__ */ React.createElement("button", { type: "button", onClick: () => {
    try {
      setError("");
      window.NCYPermitR69.print();
    } catch (e) {
      setError(String(e.message || e));
    }
  } }, "พิมพ์รายการคำนวณยื่นขออนุญาต", check.verdict === "pass" ? "" : " (ร่าง)")), error && /* @__PURE__ */ React.createElement("p", { className: "r69-error" }, error), /* @__PURE__ */ React.createElement("table", null, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "#"), /* @__PURE__ */ React.createElement("th", null, "รายการ"), /* @__PURE__ */ React.createElement("th", null, "D/C"), /* @__PURE__ */ React.createElement("th", null, "สถานะ"), /* @__PURE__ */ React.createElement("th", null, "กรณี / หมายเหตุ"))), /* @__PURE__ */ React.createElement("tbody", null, check.rows.map((r2) => /* @__PURE__ */ React.createElement("tr", { key: r2.id, "data-status": r2.excluded ? "excluded" : r2.status }, /* @__PURE__ */ React.createElement("td", null, r2.id), /* @__PURE__ */ React.createElement("td", null, r2.title, /* @__PURE__ */ React.createElement("small", null, r2.ref)), /* @__PURE__ */ React.createElement("td", { className: "n" }, r2.info ? "—" : fmt(r2.dc)), /* @__PURE__ */ React.createElement("td", null, r2.statusText), /* @__PURE__ */ React.createElement("td", null, r2.unsupported ? `ไม่รองรับ: ${r2.unsupported}` : (r2.missing || []).length ? `ขาด: ${r2.missing.map((m2) => m2.label).join(", ")}` : r2.caseId || ""))))), missing.length > 0 && /* @__PURE__ */ React.createElement("p", { className: "r69-missing" }, "ต้องกรอก: ", missing.join(" · ")), /* @__PURE__ */ React.createElement("p", { className: "r69-scope" }, 'ผลรวม "ผ่าน" ไม่ใช่การรับรอง — วิศวกรผู้มีใบอนุญาตต้องตรวจและลงนาม · หน้าจอส่วนอื่นยังแสดงสถานะ REVIEW เดิม'));
}
function PermitPanel({ state: state2 }) {
  var _a2;
  const [host, setHost] = reactExports.useState(null), [tick, setTick] = reactExports.useState(0);
  const { activeViewId } = resolveOutputNavigation(state2.controls);
  const show = state2.stage === "outputs" && activeViewId === "results" && ((_a2 = state2.result) == null ? void 0 : _a2.phase) === "current" && !!window.NCYPermitR69;
  reactExports.useLayoutEffect(() => {
    const node = document.createElement("div");
    node.id = "r69-permit-host";
    setHost(node);
    return () => node.remove();
  }, []);
  reactExports.useLayoutEffect(() => {
    if (!host) return;
    const anchor = document.getElementById("n32Results");
    if (anchor && host.nextElementSibling !== anchor) anchor.before(host);
  });
  reactExports.useEffect(() => {
    const on = () => setTick((x2) => x2 + 1);
    window.addEventListener("ncy:permit-refresh", on);
    return () => window.removeEventListener("ncy:permit-refresh", on);
  }, []);
  if (!host) return null;
  host.hidden = !show;
  if (!show) return null;
  const check = window.NCYPermitR69.checklist();
  return reactDomExports.createPortal(/* @__PURE__ */ React.createElement(Checklist, { key: tick, check }), host);
}
const RELEASE_LABEL = "NCY SIGN · R47";
function ResultTabs({ adapter, state: state2 }) {
  const labels = { unavailable: "ยังไม่มีผลยืนยัน", ready: "พร้อมอ่านผลปัจจุบัน", current: "ผลชุดปัจจุบัน", busy: "กำลังอัปเดตผล", stale: "ผลเดิมถูกยกเลิก" };
  const viewMap = new Map(VIEWS.map((view) => [view[0], view]));
  const { activeViewId, activeGroup, subtabIds } = resolveOutputNavigation(state2.controls);
  const [activeGroupId, activeNumber, activeLabel, activeDetail, activeIds] = activeGroup;
  const [, activeViewNumber, activeViewLabel] = viewMap.get(activeViewId);
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(SummaryPanel, { adapter, state: state2 }), /* @__PURE__ */ React.createElement(PermitPanel, { state: state2 }), /* @__PURE__ */ React.createElement("section", { className: "r41-output-workspace", hidden: state2.stage !== "outputs" }, /* @__PURE__ */ React.createElement("section", { className: "r30-result-state", "data-phase": state2.result.phase, "aria-live": "polite" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, labels[state2.result.phase]), state2.result.modelId && /* @__PURE__ */ React.createElement("code", null, state2.result.modelId)), /* @__PURE__ */ React.createElement("small", null, state2.result.message, " · REVIEW / NG / HOLD คงตามผลเดิม")), /* @__PURE__ */ React.createElement("nav", { className: "r41-output-groups", "aria-label": "กลุ่มผลและเอกสารของชุดปัจจุบัน", onKeyDown: keyboardNavigate }, VIEW_GROUPS.map(([group, number, label, detail, ids]) => {
    const primaryId = ids[0];
    return /* @__PURE__ */ React.createElement(
      Command,
      {
        key: group,
        adapter,
        state: state2,
        name: "view:" + primaryId,
        "aria-current": group === activeGroupId ? "page" : void 0,
        title: detail
      },
      /* @__PURE__ */ React.createElement("small", null, number),
      /* @__PURE__ */ React.createElement("span", null, label)
    );
  })), /* @__PURE__ */ React.createElement("div", { className: "r41-output-context" }, /* @__PURE__ */ React.createElement("div", { className: "r41-output-current" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, activeNumber, " ", activeLabel), /* @__PURE__ */ React.createElement("small", null, activeDetail)), /* @__PURE__ */ React.createElement("em", null, activeViewNumber, " · ", activeViewLabel)), activeIds.length > 1 && /* @__PURE__ */ React.createElement("nav", { className: "r41-output-subtabs", "aria-label": "รายการใน " + activeLabel, onKeyDown: keyboardNavigate }, subtabIds.map((id2) => {
    var _a2;
    const [, viewNumber, viewLabel] = viewMap.get(id2);
    return /* @__PURE__ */ React.createElement(
      Command,
      {
        key: id2,
        adapter,
        state: state2,
        name: "view:" + id2,
        "aria-current": ((_a2 = state2.controls["view:" + id2]) == null ? void 0 : _a2.active) ? "page" : void 0
      },
      /* @__PURE__ */ React.createElement("small", null, viewNumber),
      /* @__PURE__ */ React.createElement("span", null, viewLabel)
    );
  })))));
}
function Workbench({ adapter, slots }) {
  const state2 = reactExports.useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  const components = [ProjectToolbar, WorkflowNav, ResultTabs, ViewerToolbar];
  return components.map((Component, i) => reactDomExports.createPortal(/* @__PURE__ */ React.createElement(Component, { adapter, state: state2, release: RELEASE_LABEL }), slots[i], String(i)));
}
const PROJECT_FIELDS = [
  ["cp025_r_project", "ชื่อโครงการ"],
  ["cp025_r_authority", "หน่วยงานรับยื่น"],
  ["cp025_r_site", "สถานที่โครงการ"],
  ["cp025_r_engineer", "วิศวกรผู้รับผิดชอบ"],
  ["cp025_r_license", "เลขใบอนุญาต"],
  ["cp025_r_drawing", "เลขที่แบบ"],
  ["cp025_r_revision", "แก้ไขครั้งที่"],
  ["cp025_r_documentRef", "เลขที่ชุดเอกสาร"]
];
const GEOMETRY_FIELDS = [
  ["cp025_signW", "ความกว้างป้าย B", "m"],
  ["cp025_signH", "ความสูงป้าย H", "m"],
  ["cp025_topH", "ยอดป้ายเหนือฐานเสา", "m"],
  ["cp025_wind_groundDatum", "ฐานเสาเหนือดิน", "m"]
];
const SITE_FIELDS = [
  ["cp025_wind_province", "จังหวัด"],
  ["n15DistrictName", "อำเภอ / พื้นที่ย่อย"],
  ["cp025_wind_terrain", "สภาพพื้นที่เหนือลม"],
  ["cp025_wind_topography", "สภาพภูมิประเทศ"],
  ["cp025_wind_fetch", "พื้นที่ชานเมืองต่อเนื่องเหนือลม", "m"],
  ["cp025_wind_importance", "ประเภทความสำคัญ"]
];
const PILE_FIELDS = [
  ["n53PileLoad", "กำลังรับน้ำหนักของเข็ม 1 ต้น (Safe load)"],
  ["nR8PileCustom", "กำลังตามเอกสารผู้ผลิต", "ตัน"],
  ["n53PileRef", "ผู้ผลิต · รุ่น / ขนาด · เอกสาร / หน้า"],
  ["cp025_pileN", "จำนวนเข็ม (ขั้นต่ำ 3 ต้น)"]
];
const OPTION_LABELS = Object.freeze({ n53PileLoad: (label) => label.replace(/^\s*([\d.]+)\s*ตัน\/ต้น\s*$/, "$1 ตัน ต่อเข็ม 1 ต้น") });
const CALCULATION_FIELDS = [
  ["cp025_wind_ack", "ข้อมูลมิติและพื้นที่ข้างต้นตรงกับงานที่ต้องการคำนวณ"]
];
const FORM_FIELDS = [
  ...PROJECT_FIELDS,
  ...GEOMETRY_FIELDS,
  ...SITE_FIELDS,
  ...PILE_FIELDS,
  ...CALCULATION_FIELDS,
  ["n42Mode", "การเลือกสเปกตั้งต้น"]
];
function writeNativeField(node, value, { busy = false, commit = false, win } = {}) {
  if (!node || busy || node.disabled || node.readOnly || node.closest("[inert],fieldset[disabled]")) return false;
  if (node.tagName === "SELECT" && ![...node.options].some((o) => {
    var _a2;
    return o.value === value && !o.disabled && !((_a2 = o.parentElement) == null ? void 0 : _a2.disabled);
  })) return false;
  if (node.type === "checkbox") {
    if (typeof value !== "boolean") return false;
    node.checked = value;
  } else node.value = String(value);
  node.dispatchEvent(new win.Event("input", { bubbles: true }));
  if (commit) node.dispatchEvent(new win.Event("change", { bubbles: true }));
  return true;
}
function createNativeForm(doc, win, workbench, { fields = FORM_FIELDS, roots = ["n42FormBody", "n42CalcDock"], idPrefix = "r27-", eventHosts = {} } = {}) {
  const q2 = (id2) => doc.getElementById(id2), ids = new Set(fields.map((f2) => f2[0]));
  const readField = (id2) => {
    var _a2, _b;
    const e = q2(id2);
    if (!e) return null;
    return Object.freeze({
      value: e.value,
      checked: !!e.checked,
      type: e.type,
      tag: e.tagName,
      disabled: !!(e.disabled || e.closest("[inert],fieldset[disabled]") || workbench.getSnapshot().busy),
      readOnly: !!e.readOnly,
      min: e.min,
      max: e.max,
      step: e.step,
      maxLength: e.maxLength,
      placeholder: e.placeholder,
      invalid: e.getAttribute("aria-invalid") === "true",
      title: e.title,
      error: ((_b = (_a2 = e.parentElement) == null ? void 0 : _a2.querySelector("[data-r5-error]")) == null ? void 0 : _b.textContent) || "",
      options: e.tagName === "SELECT" ? Object.freeze([...e.options].map((o) => {
        var _a3, _b2;
        return Object.freeze({ value: o.value, label: ((_a3 = OPTION_LABELS[id2]) == null ? void 0 : _a3.call(OPTION_LABELS, o.textContent)) ?? o.textContent, disabled: o.disabled || !!((_b2 = o.parentElement) == null ? void 0 : _b2.disabled) });
      })) : null
    });
  };
  const text2 = (id2) => {
    var _a2;
    return ((_a2 = q2(id2)) == null ? void 0 : _a2.textContent) || "";
  };
  function read() {
    var _a2, _b, _c, _d;
    return Object.freeze({
      fields: Object.freeze(Object.fromEntries([...ids].map((id2) => [id2, readField(id2)]))),
      method: (_a2 = q2("cp025_method")) == null ? void 0 : _a2.value,
      district: !!q2("n15DistrictLabel") && !q2("n15DistrictLabel").hidden,
      fetch: ((_b = q2("cp025_wind_terrain")) == null ? void 0 : _b.value) === "B",
      customPile: ((_c = q2("n53PileLoad")) == null ? void 0 : _c.value) === "@custom",
      pileType: ((_d = doc.querySelector('input[name="n53PileType"]:checked')) == null ? void 0 : _d.value) || "",
      pileCurrent: text2("n53PileCurrent"),
      pileMessage: text2("n53PileMessage"),
      progress: text2("n42Progress"),
      progressSub: text2("n42ProgressSub"),
      error: text2("n42ActionError")
    });
  }
  let state2 = read(), key = JSON.stringify(state2), frame = 0, disposed = false;
  const listeners = /* @__PURE__ */ new Set();
  function refresh() {
    if (disposed) return;
    const next = read(), nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    key = nextKey;
    state2 = next;
    for (const listener of listeners) listener();
  }
  function schedule() {
    if (!disposed && !frame) frame = win.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  const observer = new win.MutationObserver((records) => {
    if (records.some((r2) => {
      var _a2, _b;
      return !((_b = (_a2 = r2.target.nodeType === 1 ? r2.target : r2.target.parentElement) == null ? void 0 : _a2.closest) == null ? void 0 : _b.call(_a2, "[data-r27-island],[data-r28-island],[data-r29-island]"));
    })) schedule();
  });
  for (const id2 of roots) if (q2(id2)) observer.observe(q2(id2), {
    attributes: true,
    subtree: true,
    childList: true,
    characterData: true,
    attributeFilter: ["hidden", "disabled", "inert", "readonly", "aria-invalid", "data-r5-invalid", "value", "checked", "selected"]
  });
  const eventNames = ["input", "change", "ncy:calculated", "ncy:method-changed", "ncy:calculation-ended"];
  for (const name of eventNames) doc.addEventListener(name, schedule, true);
  const unsubscribe = workbench.subscribe(schedule);
  function relay(id2, events) {
    const host = eventHosts[id2] && doc.querySelector(eventHosts[id2]);
    if (host && !host.contains(q2(id2))) for (const name of events) host.dispatchEvent(new win.Event(name, { bubbles: true }));
  }
  return Object.freeze({
    getSnapshot: () => state2,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh,
    edit(id2, value, commit = false) {
      if (disposed || !ids.has(id2)) return false;
      workbench.refresh();
      const ok2 = writeNativeField(q2(id2), value, { win, commit, busy: workbench.getSnapshot().busy });
      if (ok2) relay(id2, commit ? ["input", "change"] : ["input"]);
      refresh();
      schedule();
      return ok2;
    },
    commit(id2) {
      const node = q2(id2);
      workbench.refresh();
      if (disposed || !ids.has(id2) || !node || node.readOnly || node.disabled || node.closest("[inert],fieldset[disabled]") || workbench.getSnapshot().busy) return false;
      node.dispatchEvent(new win.Event("change", { bubbles: true }));
      relay(id2, ["change"]);
      refresh();
      schedule();
      return true;
    },
    focusInvalid() {
      win.requestAnimationFrame(() => {
        refresh();
        const id2 = [...ids].find((id3) => {
          var _a2;
          return (_a2 = state2.fields[id3]) == null ? void 0 : _a2.invalid;
        });
        const target = id2 && q2(idPrefix + id2);
        if (!target) return;
        for (let p2 = target.parentElement; p2; p2 = p2.parentElement) if (p2.tagName === "DETAILS") p2.open = true;
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: "center" });
      });
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      unsubscribe();
      if (frame) win.cancelAnimationFrame(frame);
      for (const name of eventNames) doc.removeEventListener(name, schedule, true);
      listeners.clear();
    }
  });
}
function arrangeInputLayout(doc, workbench) {
  const q2 = (id2) => doc.getElementById(id2);
  const moves = [], created = [];
  const move = (node, parent) => {
    moves.push([node, node.parentElement, node.nextSibling]);
    parent.append(node);
  };
  const settings = doc.createElement("details");
  settings.id = "r45-analysis-settings";
  settings.className = "cp25-details";
  const summary = doc.createElement("summary");
  summary.textContent = "ค่าการวิเคราะห์ขั้นสูง";
  settings.append(summary);
  q2("n30Startup").before(settings);
  created.push(settings);
  move(q2("n30Startup"), settings);
  const datum = doc.createElement("div");
  datum.id = "r45-datum";
  q2("r27-inputs").after(datum);
  created.push(datum);
  const refresh = () => {
    var _a2;
    const field2 = (_a2 = q2("n30_r4_rhs_datum")) == null ? void 0 : _a2.closest("label");
    if (field2 && field2.parentElement !== datum) move(field2, datum);
    datum.hidden = q2("cp025_method").value !== "new" || !field2;
  };
  const unsubscribe = workbench.subscribe(refresh);
  refresh();
  return { dispose() {
    unsubscribe();
    for (const [node, parent, next] of moves.reverse()) parent.insertBefore(node, (next == null ? void 0 : next.parentNode) === parent ? next : null);
    for (const node of created) node.remove();
  } };
}
function Field({ definition, form, state: state2, wide = false, prefix = "r27-" }) {
  const [id2, label, unit] = definition, field2 = state2.fields[id2];
  if (!field2) return null;
  const checkbox = field2.type === "checkbox";
  const common = {
    id: prefix + id2,
    ...checkbox ? { checked: field2.checked } : { value: field2.value },
    disabled: field2.disabled,
    readOnly: field2.readOnly,
    "data-r27-field": id2,
    "aria-invalid": field2.invalid || void 0,
    "aria-describedby": [
      unit && "r27-unit-" + id2,
      field2.error && "r27-error-" + id2,
      field2.readOnly && field2.title && "r27-help-" + id2
    ].filter(Boolean).join(" ") || void 0,
    onChange: (e) => {
      e.stopPropagation();
      form.edit(id2, checkbox ? e.target.checked : e.target.value, checkbox || field2.tag === "SELECT");
    },
    onBlur: (e) => {
      e.stopPropagation();
      if (!checkbox && field2.tag !== "SELECT") form.commit(id2);
    },
    onInput: (e) => e.stopPropagation()
  };
  if (checkbox) return /* @__PURE__ */ React.createElement("div", { className: "r27-field r29-check" }, /* @__PURE__ */ React.createElement("label", { htmlFor: common.id }, /* @__PURE__ */ React.createElement("input", { ...common, type: "checkbox" }), /* @__PURE__ */ React.createElement("span", null, label)), field2.error && /* @__PURE__ */ React.createElement("small", { className: "r27-error", id: "r27-error-" + id2 }, field2.error));
  return /* @__PURE__ */ React.createElement("div", { className: "r27-field" + (wide ? " r27-field-wide" : "") }, /* @__PURE__ */ React.createElement("label", { htmlFor: common.id }, label), /* @__PURE__ */ React.createElement("span", { className: "r27-input-unit" + (unit ? " has-unit" : "") }, field2.tag === "SELECT" ? /* @__PURE__ */ React.createElement("select", { ...common }, field2.options.map((o) => /* @__PURE__ */ React.createElement("option", { key: o.value, value: o.value, disabled: o.disabled }, o.label))) : field2.tag === "TEXTAREA" ? /* @__PURE__ */ React.createElement("textarea", { ...common, rows: 3, maxLength: field2.maxLength >= 0 ? field2.maxLength : void 0 }) : /* @__PURE__ */ React.createElement(
    "input",
    {
      ...common,
      type: field2.type,
      min: field2.min || void 0,
      max: field2.max || void 0,
      step: field2.step || "any",
      maxLength: field2.maxLength >= 0 ? field2.maxLength : void 0,
      placeholder: field2.placeholder || void 0,
      inputMode: field2.type === "number" ? "decimal" : void 0
    }
  ), unit && /* @__PURE__ */ React.createElement("b", { id: "r27-unit-" + id2 }, unit)), field2.readOnly && field2.title && /* @__PURE__ */ React.createElement("small", { id: "r27-help-" + id2 }, field2.title), field2.error && /* @__PURE__ */ React.createElement("small", { className: "r27-error", id: "r27-error-" + id2 }, field2.error));
}
function Group({ number, title, children }) {
  return /* @__PURE__ */ React.createElement("fieldset", { className: "r27-group" }, /* @__PURE__ */ React.createElement("legend", null, /* @__PURE__ */ React.createElement("span", null, number), title), children);
}
function CollapsibleGroup({ number, title, summary, children }) {
  return /* @__PURE__ */ React.createElement("details", { className: "r27-group r38-collapsible-group" }, /* @__PURE__ */ React.createElement("summary", null, /* @__PURE__ */ React.createElement("span", null, number), /* @__PURE__ */ React.createElement("b", null, title), /* @__PURE__ */ React.createElement("small", null, summary)), /* @__PURE__ */ React.createElement("div", { className: "r38-collapsible-body" }, children));
}
function Action$1({ adapter, controls, name, children, ...props }) {
  var _a2;
  return /* @__PURE__ */ React.createElement("button", { type: "button", disabled: ((_a2 = controls[name]) == null ? void 0 : _a2.disabled) ?? true, onClick: () => adapter.command(name), ...props }, children);
}
function ProjectInformation({ form }) {
  const state2 = reactExports.useSyncExternalStore(form.subscribe, form.getSnapshot);
  const missing = PROJECT_FIELDS.filter(([id2]) => {
    var _a2, _b;
    return !((_b = (_a2 = state2.fields[id2]) == null ? void 0 : _a2.value) == null ? void 0 : _b.trim());
  }).length;
  return /* @__PURE__ */ React.createElement("details", { className: "r27-project" }, /* @__PURE__ */ React.createElement("summary", null, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "ข้อมูลโครงการสำหรับพิมพ์"), /* @__PURE__ */ React.createElement("small", null, "หัวรายงาน ผู้รับผิดชอบ และเลขที่เอกสาร")), /* @__PURE__ */ React.createElement("span", { className: "r27-project-status", "data-state": missing ? "attention" : "filled" }, /* @__PURE__ */ React.createElement("i", { "aria-hidden": "true" }), missing ? `ยังไม่กรอก ${missing} รายการ` : "กรอกข้อมูลครบ 8 รายการ")), /* @__PURE__ */ React.createElement("div", { className: "r27-project-body" }, /* @__PURE__ */ React.createElement("p", null, "กรอกก่อนพิมพ์หรือบันทึก PDF · สถานที่อ่านจากพื้นที่ติดตั้งที่เลือกไว้"), /* @__PURE__ */ React.createElement("div", { className: "r27-project-grid" }, PROJECT_FIELDS.map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2 })))));
}
function QuickInput({ form, detailForm, adapter }) {
  var _a2, _b;
  const state2 = reactExports.useSyncExternalStore(form.subscribe, form.getSnapshot);
  const detailState = reactExports.useSyncExternalStore(detailForm.subscribe, detailForm.getSnapshot);
  const work = reactExports.useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  return /* @__PURE__ */ React.createElement("section", { className: "r27-input", "aria-label": "ข้อมูลออกแบบป้าย" }, /* @__PURE__ */ React.createElement("header", { className: "r27-rail-heading" }, /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, "▤"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", null, "QUICK INPUT"), /* @__PURE__ */ React.createElement("h2", null, "ข้อมูลออกแบบป้าย"), /* @__PURE__ */ React.createElement("small", null, "กรอกโจทย์ → คำนวณ → เลือกชุดโครงสร้าง"))), /* @__PURE__ */ React.createElement("div", { className: "r27-form-body" }, /* @__PURE__ */ React.createElement("details", { className: "r38-starting-spec" }, /* @__PURE__ */ React.createElement("summary", null, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "สเปกตั้งต้น"), /* @__PURE__ */ React.createElement("small", null, "CHS Ø", ((_a2 = detailState.fields.cp025_D) == null ? void 0 : _a2.value) || "—", " × ", ((_b = detailState.fields.cp025_t) == null ? void 0 : _b.value) || "—", " mm")), /* @__PURE__ */ React.createElement("em", null, "ปรับ")), /* @__PURE__ */ React.createElement("div", { className: "r38-starting-body" }, /* @__PURE__ */ React.createElement("div", { className: "r27-design-mode" }, /* @__PURE__ */ React.createElement("b", null, "วิธีเตรียมชุดโครงสร้าง"), /* @__PURE__ */ React.createElement(Field, { definition: ["n42Mode", "การเลือกสเปกตั้งต้น"], form, state: state2 }), /* @__PURE__ */ React.createElement("small", null, "ชุดตั้งต้นใช้เริ่มวิเคราะห์ ผลกำลังและขนาดที่เลือกอยู่ในขั้นถัดไป")), /* @__PURE__ */ React.createElement("div", { className: "r27-design-mode r33-chs-input" }, /* @__PURE__ */ React.createElement("b", null, "เสากลม CHS ตั้งต้น"), /* @__PURE__ */ React.createElement(Field, { definition: ["pipeSeries", "ชุด CHS จากแค็ตตาล็อก PAP"], form: detailForm, state: detailState, prefix: "r33-start-", wide: true }), /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, /* @__PURE__ */ React.createElement(Field, { definition: ["cp025_D", "เสาท่อ D", "mm"], form: detailForm, state: detailState, prefix: "r33-start-" }), /* @__PURE__ */ React.createElement(Field, { definition: ["cp025_t", "เสาท่อ t", "mm"], form: detailForm, state: detailState, prefix: "r33-start-" })), /* @__PURE__ */ React.createElement("small", null, "ขนาดนี้ใช้เริ่มวิเคราะห์ ขั้น 02 จะแสดงว่าขนาดใดคำนวณได้และเหตุผลที่ขนาดเล็กกว่าถูกตัดออก")))), /* @__PURE__ */ React.createElement(Group, { number: "01", title: "รูปแบบและขนาดป้าย" }, /* @__PURE__ */ React.createElement("div", { className: "r27-methods", role: "group", "aria-label": "รูปแบบโครงสร้างป้าย" }, [["original", "เสาท่อกลมต่อเนื่อง", "ป้ายหน้า–หลังบนเสาร่วม"], ["new", "เสากลมต่อแกน RHS", "ต่อผ่านเพลทหัวเสา"]].map(([id2, label, description]) => /* @__PURE__ */ React.createElement(Action$1, { key: id2, adapter, controls: work.controls, name: "method:" + id2, "aria-pressed": state2.method === id2 }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 38 42", "aria-hidden": "true" }, /* @__PURE__ */ React.createElement("path", { d: "M6 4h26v17H6zM17 21v17m4-17v17M10 38h18" }), id2 === "new" && /* @__PURE__ */ React.createElement("path", { d: "M14 24h10M19 6v15" })), /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, label), /* @__PURE__ */ React.createElement("small", null, description))))), /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, GEOMETRY_FIELDS.map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2 })))), /* @__PURE__ */ React.createElement(Group, { number: "02", title: "พื้นที่ติดตั้งและแรงลม" }, /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, SITE_FIELDS.filter(([id2]) => (id2 !== "n15DistrictName" || state2.district) && (id2 !== "cp025_wind_fetch" || state2.fetch)).map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2, wide: f2[0] === "cp025_wind_importance" }))), /* @__PURE__ */ React.createElement("p", { className: "r27-note" }, "ใช้พื้นที่และสภาพแวดล้อมจริงของงาน")), /* @__PURE__ */ React.createElement(CollapsibleGroup, { number: "03", title: "เสาเข็มและกำลังผู้ผลิต", summary: [state2.pileCurrent, state2.pileMessage].filter(Boolean).join(" · ") || "เปิดเพื่อกำหนดกำลังต่อต้น" }, /* @__PURE__ */ React.createElement("div", { className: "r27-choice-row", role: "group", "aria-label": "ชนิดเสาเข็ม" }, [["I", "เข็ม I"], ["square", "เข็มสี่เหลี่ยม"]].map(([id2, label]) => /* @__PURE__ */ React.createElement(Action$1, { key: id2, adapter, controls: work.controls, name: "pile:" + id2, "aria-pressed": state2.pileType === id2 }, label))), /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, PILE_FIELDS.filter(([id2]) => id2 !== "nR8PileCustom" || state2.customPile).map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2, wide: f2[0] === "n53PileRef" }))), /* @__PURE__ */ React.createElement("p", { className: "r27-note" }, "กำลังรับอัดใช้งานจากรุ่นและเอกสารผู้ผลิต · ตัน/ต้น"), /* @__PURE__ */ React.createElement("div", { className: "r27-choice-row r27-pile-actions" }, [["pileConfirm", "ยืนยันข้อมูลเข็ม"], ["pileCancel", "ยกเลิกที่แก้"], ["pileUndo", "ย้อนข้อมูลเข็ม"]].map(([name, label]) => /* @__PURE__ */ React.createElement(Action$1, { key: name, adapter, controls: work.controls, name }, label))), /* @__PURE__ */ React.createElement("p", { className: "r27-pile-current" }, state2.pileCurrent), /* @__PURE__ */ React.createElement("p", { className: "r27-note", role: "status" }, state2.pileMessage)), /* @__PURE__ */ React.createElement("p", { className: "r27-detail-heading" }, "รายละเอียดการติดตั้งและสเปกเพิ่มเติม ↓")));
}
function CalculateBar({ form, adapter }) {
  var _a2;
  const state2 = reactExports.useSyncExternalStore(form.subscribe, form.getSnapshot);
  const work = reactExports.useSyncExternalStore(adapter.subscribe, adapter.getSnapshot);
  return /* @__PURE__ */ React.createElement("div", { className: "r27-calculate" }, CALCULATION_FIELDS.map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2 })), /* @__PURE__ */ React.createElement("div", { role: "status" }, /* @__PURE__ */ React.createElement("b", null, state2.progress), /* @__PURE__ */ React.createElement("small", null, state2.progressSub)), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-r27-calculate": true,
      disabled: ((_a2 = work.controls.calculate) == null ? void 0 : _a2.disabled) ?? true,
      onClick: () => {
        adapter.command("calculate");
        form.focusInvalid();
      }
    },
    "คำนวณและเลือกชุดโครงสร้าง →"
  ));
}
const DETAIL_GROUPS = [
  { id: "steel", selector: "#r6CurrentSteel > .cp25-grid", title: "หน้าตัดและจุดต่อปัจจุบัน", fields: [
    ["pipeSeries", "ชุด CHS จากแค็ตตาล็อก PAP"],
    ["cp025_D", "เสาท่อ D", "mm"],
    ["cp025_t", "เสาท่อ t", "mm"],
    ["cp025_plateB", "เพลทฐาน B", "mm"],
    ["cp025_plateT", "ความหนาเพลท", "mm"],
    ["cp025_boltD", "สลักหัวน็อต Ø", "mm"],
    ["cp025_boltN", "จำนวนสลักหัวน็อต"],
    ["cp025_railPreset", "FR1 คานหัวป้าย"],
    ["cp025_studPreset", "FR2 คร่าวตั้ง"]
  ] },
  { id: "geometry", selector: "#r6CurrentFoundation > .cp25-grid", title: "ขนาดฐาน ตอม่อ และผังเข็ม", fields: [
    ["cp025_footB", "ฐาน B", "m"],
    ["cp025_footL", "ฐาน L", "m"],
    ["cp025_footT", "ความหนาฐาน", "m"],
    ["cp025_ped", "ตอม่อ B", "m"],
    ["cp025_pedH", "ความสูงตอม่อ", "m"],
    ["cp025_pileSpacing", "ระยะห่างเข็ม", "m"]
  ] },
  { id: "rebar", selector: "#cp025_cover", fieldParent: true, title: "เหล็กฐานและตอม่อปัจจุบัน", fields: [
    ["cp025_cover", "Cover ฐาน", "mm"],
    ["cp025_rebarD", "เหล็กล่าง DB", "mm"],
    ["cp025_rebarSp", "ระยะเหล็กสูงสุด", "mm"],
    ["cp025_pedBarN", "จำนวนเหล็กยืนตอม่อ"],
    ["cp025_pedBarD", "เหล็กยืน DB", "mm"],
    ["cp025_tieD", "เหล็กปลอก DB", "mm"],
    ["cp025_tieSp", "ระยะปลอก", "mm"],
    ["cp025_pedCover", "Cover ตอม่อ", "mm"]
  ] },
  { id: "levels", selector: "#n31Foundation > .cp25-grid", title: "ระดับ grout และหัวเข็ม", fields: [
    ["n31Grout", "Grout ใต้เพลท", "mm"],
    ["n31Embed", "หัวเข็มฝังในฐาน", "mm"]
  ] },
  { id: "rc", selector: "#rcSettings46 .fields451", title: "คอนกรีต เหล็ก และระยะหุ้ม", fields: [
    ["rcFc46", "f′c ฐาน", "MPa"],
    ["rcFy46", "fy เหล็กข้ออ้อย", "MPa"],
    ["rcCoverSide46", "ระยะหุ้มด้านข้าง", "mm"],
    ["rcCoverBottom46", "ระยะหุ้มใต้ฐาน", "mm"],
    ["rcCoverTop46", "ระยะหุ้มด้านบน", "mm"],
    ["rcAbovePile46", "ช่องเหนือหัวเข็มถึงเหล็กล่าง", "mm"],
    ["rcAggregate46", "มวลรวมหยาบสูงสุด", "mm"],
    ["rcSpacing46", "ระยะเหล็กสูงสุดที่ต้องการ", "mm"],
    ["rcBarMode46", "วิธีเลือกขนาดเหล็ก"],
    ["rcDb46", "ขนาดเหล็กที่กำหนด"]
  ] }
];
const DETAIL_FIELDS = DETAIL_GROUPS.flatMap((g) => g.fields);
function DetailFields({ group, form }) {
  const state2 = reactExports.useSyncExternalStore(form.subscribe, form.getSnapshot);
  return /* @__PURE__ */ React.createElement("section", { className: "r28-detail-fields", "aria-label": group.title }, /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, group.fields.map((f2) => /* @__PURE__ */ React.createElement(Field, { key: f2[0], definition: f2, form, state: state2, prefix: "r28-" }))), /* @__PURE__ */ React.createElement("p", { className: "r28-edit-note" }, "แก้สเปกแล้วคำนวณใหม่ก่อนใช้ผลและเอกสาร"));
}
function Action({ selection, state: state2, name, children, ...props }) {
  const s = state2.controls[name];
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-r28-command": name,
      hidden: s.hidden,
      disabled: s.disabled,
      onClick: () => selection.command(name),
      ...props
    },
    children || s.text
  );
}
function MaterialNavigation({ selection }) {
  var _a2;
  const state2 = reactExports.useSyncExternalStore(selection.subscribe, selection.getSnapshot);
  const steps = [
    ["steel", "02.1", "โครงป้ายและเสา", "เลือกหน้าตัดจากผลคำนวณ"],
    ["connection", "02.2", "เพลทและจุดต่อ", "ตรวจรอยต่อและหลักฐานวัสดุ"],
    ["foundation", "02.3", "ฐานรากและเหล็ก", "ตรวจฐานและแรงลงเข็ม"],
    ["results", "02.4", "ตรวจผลรวม", "ทบทวนทุกส่วนก่อนยืนยัน"]
  ];
  return /* @__PURE__ */ React.createElement("section", { className: "r31-selection-flow", hidden: state2.stage !== "select", "aria-label": "ลำดับเลือกชุดโครงสร้าง" }, /* @__PURE__ */ React.createElement("nav", { className: "r28-materials", "aria-label": "กลุ่มชุดโครงสร้าง" }, steps.map(([name, n2, title, detail]) => /* @__PURE__ */ React.createElement(Action, { key: name, selection, state: state2, name, "aria-pressed": state2.group === name }, /* @__PURE__ */ React.createElement("span", null, n2), /* @__PURE__ */ React.createElement("strong", null, title), /* @__PURE__ */ React.createElement("small", null, detail)))), state2.group === "steel" && ((_a2 = state2.memberSearch) == null ? void 0 : _a2.total) > 0 && /* @__PURE__ */ React.createElement("details", { className: "r38-member-reason" }, /* @__PURE__ */ React.createElement("summary", null, /* @__PURE__ */ React.createElement("span", null, "เหตุผลการคัดขนาด"), /* @__PURE__ */ React.createElement("strong", null, state2.memberSearch.analyzed, "/", state2.memberSearch.total, " ชุดวิเคราะห์ได้")), /* @__PURE__ */ React.createElement("div", { className: "r40-member-reason-body", "aria-label": "เหตุผลที่บางชุดไม่เข้าสู่การวิเคราะห์" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("b", null, "ชุดปัจจุบัน"), /* @__PURE__ */ React.createElement("strong", null, state2.memberSearch.current)), /* @__PURE__ */ React.createElement("p", null, "อีก ", /* @__PURE__ */ React.createElement("b", null, state2.memberSearch.domainRejected), " ชุดถูกหยุดก่อนตรวจกำลัง: ", (state2.memberSearch.reasons || []).join(" / ") || "มิติอยู่นอกช่วงวิธีที่รองรับ"), /* @__PURE__ */ React.createElement("small", null, "ค่า D√(qCe)=0.167 ใช้เลือกสาขา Cf และไม่ใช่เส้นผ่านศูนย์กลางขั้นต่ำ; ชุดที่เข้าได้ยังต้องตรวจการแอ่นและกำลังแยกกัน", state2.memberSearch.stale ? " · ตารางเป็นผลก่อนเลือกชุดปัจจุบัน" : ""))));
}
function SelectionFooter({ selection }) {
  const state2 = reactExports.useSyncExternalStore(selection.subscribe, selection.getSnapshot);
  return /* @__PURE__ */ React.createElement("section", { className: "r28-confirmation", hidden: state2.stage !== "select", "aria-label": "ยืนยันชุดปัจจุบัน" }, /* @__PURE__ */ React.createElement("span", { className: "r31-confirm-number" }, "02.5"), /* @__PURE__ */ React.createElement("div", { className: "r40-confirm-copy" }, /* @__PURE__ */ React.createElement("h3", null, "ยืนยันชุดเพื่อดูผลขั้น 03"), /* @__PURE__ */ React.createElement("p", null, state2.summary)), /* @__PURE__ */ React.createElement(Action, { selection, state: state2, name: "continue" }), /* @__PURE__ */ React.createElement("details", { className: "r40-confirm-notes" }, /* @__PURE__ */ React.createElement("summary", null, "ข้อจำกัดของชุดนี้"), /* @__PURE__ */ React.createElement("p", { role: "status" }, state2.reason), /* @__PURE__ */ React.createElement("p", { className: "r28-scope" }, state2.scope)));
}
function Content$1({ nodes }) {
  return nodes.map((n2, i) => typeof n2 === "string" ? n2 : React.createElement(n2.tag, { key: i }, n2.tag === "br" ? void 0 : /* @__PURE__ */ React.createElement(Content$1, { nodes: n2.children })));
}
function CandidateTable({ name, selection }) {
  const state2 = reactExports.useSyncExternalStore(selection.subscribe, selection.getSnapshot), table = state2.tables[name];
  if (!table) return null;
  return /* @__PURE__ */ React.createElement("div", { className: "r28-table-scroll", role: "region", "aria-label": table.caption || "ตารางเลือกชุดโครงสร้าง", tabIndex: 0 }, /* @__PURE__ */ React.createElement("table", { className: "r28-candidates", "data-r28-table": name }, table.caption && /* @__PURE__ */ React.createElement("caption", null, table.caption), /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, table.headers.map((text2, i) => /* @__PURE__ */ React.createElement("th", { key: i, scope: "col" }, text2)))), /* @__PURE__ */ React.createElement("tbody", null, table.rows.map((row2, i) => {
    var _a2;
    return /* @__PURE__ */ React.createElement(
      "tr",
      {
        key: ((_a2 = row2.cells.find((c) => c.choice)) == null ? void 0 : _a2.choice.value) || i,
        "data-selected": row2.selected,
        onClick: (e) => {
          var _a3, _b;
          const choice = (_a3 = row2.cells.find((c) => c.choice)) == null ? void 0 : _a3.choice;
          if (!choice || choice.disabled || e.target.closest("input,label,button,details,a")) return;
          (_b = e.currentTarget.querySelector("input")) == null ? void 0 : _b.focus();
          selection.choose(name, choice.token, { value: choice.value });
        }
      },
      row2.cells.map((cell, j) => /* @__PURE__ */ React.createElement("td", { key: j }, /* @__PURE__ */ React.createElement(Content$1, { nodes: cell.content }), cell.choice && /* @__PURE__ */ React.createElement("label", { className: "r28-radio" }, /* @__PURE__ */ React.createElement(
        "input",
        {
          type: "radio",
          name: "r28-" + name,
          value: cell.choice.value,
          "aria-label": cell.choice.label,
          checked: cell.choice.checked,
          disabled: cell.choice.disabled,
          onChange: (e) => {
            e.stopPropagation();
            selection.choose(name, cell.choice.token, { value: cell.choice.value });
          }
        }
      ))))
    );
  }))));
}
const CONNECTION_ANCHORS = Object.freeze([
  "n48ClearFront",
  "r4_rhs_jointModel",
  "r4_rhs_headJoint32",
  "r4_rhs_strengthMethod38",
  "r4_rhs_anchorMethod39",
  "r4_rhs_baseContactMethod40",
  "r4_rhs_anchorConcMethod41",
  "r4_rhs_shearTransfer39"
]);
function connectionDefinition(field2) {
  var _a2;
  const label = field2.closest("label") || field2.parentElement;
  const copy = label.cloneNode(true);
  copy.querySelectorAll("input,select,textarea").forEach((n2) => n2.remove());
  const unit = ((_a2 = copy.querySelector("small")) == null ? void 0 : _a2.textContent.trim()) || "";
  copy.querySelectorAll("small").forEach((n2) => n2.remove());
  return [field2.id, copy.textContent.trim(), unit];
}
function connectionGroups(doc) {
  var _a2, _b;
  const sources = /* @__PURE__ */ new Set();
  const groups = CONNECTION_ANCHORS.map((id2) => {
    var _a3, _b2, _c;
    const source = (_a3 = doc.getElementById(id2)) == null ? void 0 : _a3.closest(".cp25-grid,.n48-edit-grid");
    if (!source) throw Error("Missing native connection group: " + id2);
    if (sources.has(source)) return null;
    sources.add(source);
    return {
      id: id2,
      source,
      title: ((_c = (_b2 = source.closest("details")) == null ? void 0 : _b2.querySelector("summary")) == null ? void 0 : _c.textContent) || "รายละเอียดจุดต่อ",
      fields: [...source.querySelectorAll("input,select,textarea")].map(connectionDefinition)
    };
  }).filter(Boolean);
  const material = (_a2 = doc.getElementById("cp10_anchorGrade")) == null ? void 0 : _a2.closest(".cp10-conn-meta");
  const hardware = doc.getElementById("cp015ConnectionInputs");
  for (const [id2, source] of [["materials", material], ["hardware", hardware]]) {
    if (!source) throw Error("Missing connection evidence: " + id2);
    groups.push({
      id: id2,
      source,
      evidence: true,
      title: source.querySelector("h4").textContent,
      note: ((_b = source.querySelector(".cp10-meta-note,.cp15-note")) == null ? void 0 : _b.textContent) || "",
      fields: [...source.querySelectorAll("input,select,textarea")].map(connectionDefinition)
    });
  }
  return Object.freeze(groups.map((group) => Object.freeze({
    ...group,
    fields: Object.freeze(group.fields.map((field2) => Object.freeze(field2)))
  })));
}
const ROOTS = [
  "n32ComponentRows",
  "n31Results",
  "n49Response",
  "nR4Type1Members",
  "n51OutputIntro",
  "rcOutput46",
  "pedOutput47"
];
const TAGS = /* @__PURE__ */ new Set([
  "TABLE",
  "CAPTION",
  "THEAD",
  "TBODY",
  "TFOOT",
  "TR",
  "TH",
  "TD",
  "B",
  "STRONG",
  "SPAN",
  "SMALL",
  "BR",
  "P",
  "EM",
  "SUB",
  "SUP",
  "DETAILS",
  "SUMMARY",
  "UL",
  "OL",
  "LI",
  "DL",
  "DT",
  "DD"
]);
const ATTRS = { colspan: "colSpan", rowspan: "rowSpan", scope: "scope", abbr: "abbr", title: "title", "data-tone": "data-tone" };
function resultContent(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1 || ["SCRIPT", "STYLE"].includes(node.tagName)) return null;
  const props = {};
  for (const [attr, name] of Object.entries(ATTRS)) if (node.hasAttribute(attr)) props[name] = node.getAttribute(attr);
  const classes = [...node.classList].filter((c) => /^(n32-dc|good|bad|warn|ok|fail|pass|hold|n51-pending)$/.test(c));
  if (classes.length) props.className = classes.join(" ");
  return Object.freeze({
    tag: TAGS.has(node.tagName) ? node.tagName.toLowerCase() : "span",
    props: Object.freeze(props),
    children: Object.freeze([...node.childNodes].map(resultContent).filter((x2) => x2 !== null))
  });
}
function canProjectTable(table) {
  return !!(table == null ? void 0 : table.isConnected) && !table.closest("[data-r29-island],.report-page,.n53-reference-preview") && !table.querySelector("input,select,textarea,button,a,svg,canvas,table,[onclick],[contenteditable]");
}
function createNativeResults(doc, win, workbench) {
  const entries = /* @__PURE__ */ new Map(), listeners = /* @__PURE__ */ new Set();
  let serial = 0, frame = 0, disposed = false, state2 = Object.freeze([]), key = "[]";
  function remove(table, item) {
    table.removeAttribute("data-r29-result-source");
    item.slot.remove();
    entries.delete(table);
  }
  function refresh() {
    if (disposed) return;
    const work = workbench.getSnapshot();
    const available = work.stage === "outputs" && !work.busy && !work.controls["stage:outputs"].disabled;
    const tables = available ? ROOTS.flatMap((id2) => {
      var _a2;
      return [...((_a2 = doc.getElementById(id2)) == null ? void 0 : _a2.querySelectorAll("table")) || []];
    }).filter(canProjectTable) : [];
    const current = new Set(tables);
    for (const [table, item] of entries) if (!current.has(table) || !item.slot.isConnected) remove(table, item);
    const next = tables.map((table) => {
      var _a2, _b, _c;
      let item = entries.get(table);
      if (!item) {
        const slot = doc.createElement("div");
        slot.dataset.r29Island = "";
        slot.className = "r29-result-slot";
        item = { id: String(++serial), slot };
        entries.set(table, item);
        table.before(slot);
        table.setAttribute("data-r29-result-source", "");
      }
      return Object.freeze({ ...item, content: resultContent(table), label: ((_a2 = table.caption) == null ? void 0 : _a2.textContent) || ((_c = (_b = table.closest("details")) == null ? void 0 : _b.querySelector("summary")) == null ? void 0 : _c.textContent) || "รายละเอียดผลตรวจ" });
    });
    const nextKey = JSON.stringify(next.map(({ id: id2, content, label }) => ({ id: id2, content, label })));
    if (key === nextKey) return;
    key = nextKey;
    state2 = Object.freeze(next);
    listeners.forEach((fn) => fn());
  }
  function schedule() {
    if (!disposed && !frame) frame = win.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  const observer = new win.MutationObserver((records) => {
    if (records.some((r2) => {
      var _a2, _b;
      return !((_b = (_a2 = r2.target.nodeType === 1 ? r2.target : r2.target.parentElement) == null ? void 0 : _a2.closest) == null ? void 0 : _b.call(_a2, "[data-r29-island]"));
    })) schedule();
  });
  for (const id2 of ROOTS) {
    const root = doc.getElementById(id2);
    if (root) observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["data-tone", "class", "title", "colspan", "rowspan"]
    });
  }
  const unsubscribe = workbench.subscribe(schedule);
  refresh();
  return Object.freeze({
    getSnapshot: () => state2,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    refresh,
    dispose() {
      disposed = true;
      observer.disconnect();
      unsubscribe();
      if (frame) win.cancelAnimationFrame(frame);
      for (const [table, item] of entries) remove(table, item);
      listeners.clear();
      state2 = Object.freeze([]);
    }
  });
}
function ConnectionFields({ group, form }) {
  const state2 = reactExports.useSyncExternalStore(form.subscribe, form.getSnapshot);
  return /* @__PURE__ */ React.createElement("section", { className: "r29-connection-fields", "aria-label": group.title }, /* @__PURE__ */ React.createElement("div", { className: "r27-field-grid" }, group.fields.map((f2) => {
    var _a2;
    return /* @__PURE__ */ React.createElement(
      Field,
      {
        key: f2[0],
        definition: f2,
        form,
        state: state2,
        prefix: "r29-",
        wide: ((_a2 = state2.fields[f2[0]]) == null ? void 0 : _a2.type) === "text" || f2[1].length > 35
      }
    );
  })), group.note && /* @__PURE__ */ React.createElement("p", { className: "r29-note" }, group.note));
}
function ConnectionEvidence({ groups, form }) {
  return /* @__PURE__ */ React.createElement("details", { className: "r29-evidence" }, /* @__PURE__ */ React.createElement("summary", null, "วัสดุและหลักฐานรอยต่อ · น็อต / แหวน / งานเชื่อม"), groups.map((group, i) => /* @__PURE__ */ React.createElement("fieldset", { className: "r27-group", key: group.id }, /* @__PURE__ */ React.createElement("legend", null, /* @__PURE__ */ React.createElement("span", null, String(i + 1).padStart(2, "0")), group.title), /* @__PURE__ */ React.createElement(ConnectionFields, { group, form }))));
}
function Content({ node }) {
  if (typeof node === "string") return node;
  const props = { ...node.props };
  if (node.tag === "table") props.className = "r29-result-table";
  return React.createElement(node.tag, props, node.tag === "br" ? void 0 : node.children.map((child, i) => /* @__PURE__ */ React.createElement(Content, { key: i, node: child })));
}
function ResultTables({ results }) {
  const tables = reactExports.useSyncExternalStore(results.subscribe, results.getSnapshot);
  return tables.map((item) => reactDomExports.createPortal(/* @__PURE__ */ React.createElement("div", { className: "r29-result-scroll", role: "region", "aria-label": item.label, tabIndex: 0 }, /* @__PURE__ */ React.createElement(Content, { node: item.content })), item.slot, item.id));
}
const ACTIONS = Object.freeze({
  contour: "#n32AnalysisView",
  site: "#n28SiteOpen",
  physical: '#n49Response [data-n49-view="physical"]',
  wire: '#n49Response [data-n49-view="wire"]',
  deformed: '#n49Response [data-n49-view="deformed"]'
});
const frozenControl = (node) => {
  var _a2, _b, _c, _d;
  return Object.freeze({
    available: !!node,
    disabled: !node || node.disabled || !!((_a2 = node.closest) == null ? void 0 : _a2.call(node, "[inert]")),
    active: !!node && (((_b = node.getAttribute) == null ? void 0 : _b.call(node, "aria-pressed")) === "true" || ((_c = node.getAttribute) == null ? void 0 : _c.call(node, "aria-current")) === "page" || ((_d = node.classList) == null ? void 0 : _d.contains("active")))
  });
};
function createNativePanels(doc, win, workbench) {
  const q2 = (selector) => doc.querySelector(selector);
  const listeners = /* @__PURE__ */ new Set();
  let frame = 0, disposed = false;
  const read = () => {
    var _a2, _b;
    const work = workbench.getSnapshot();
    const select = q2("#n49Case");
    const options = select ? [...select.options].map((option) => Object.freeze({
      value: option.value,
      label: option.textContent || option.label || option.value
    })) : [];
    return Object.freeze({
      visible: work.stage === "outputs",
      currentView: ((_a2 = work.controls["view:diagrams"]) == null ? void 0 : _a2.active) ? "diagrams" : "",
      caseValue: (select == null ? void 0 : select.value) || "",
      caseOptions: Object.freeze(options),
      caseDisabled: !select || select.disabled || !!((_b = select.closest) == null ? void 0 : _b.call(select, "[inert]")) || work.busy,
      controls: Object.freeze(Object.fromEntries(Object.entries(ACTIONS).map(([name, selector]) => [name, frozenControl(q2(selector))])))
    });
  };
  let value = read(), key = JSON.stringify(value);
  function refresh() {
    if (disposed) return;
    const next = read(), nextKey = JSON.stringify(next);
    if (nextKey === key) return;
    key = nextKey;
    value = next;
    listeners.forEach((listener) => listener());
  }
  function schedule() {
    if (disposed || frame) return;
    frame = win.requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }
  function guard(action) {
    const before = workbench.captureResult();
    action();
    const after = workbench.captureResult();
    if (before !== after) throw Error("ผลปัจจุบันเปลี่ยนระหว่างใช้เครื่องมือตรวจ");
  }
  const observer = new win.MutationObserver(schedule);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-sign-n38-stage"] });
  for (const node of [q2("#r22ResultNav"), q2("#n15OutputNav"), q2("#n49Response")].filter(Boolean)) {
    observer.observe(node, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
      attributeFilter: ["disabled", "inert", "aria-current", "aria-pressed", "class"]
    });
  }
  for (const name of ["change", "click"]) doc.addEventListener(name, schedule, true);
  return Object.freeze({
    getSnapshot: () => value,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    command(name, nextValue) {
      var _a2;
      if (disposed) return false;
      try {
        if (name === "case") {
          const select = q2("#n49Case");
          if (!select || select.disabled || ![...select.options].some((option) => option.value === String(nextValue))) return false;
          guard(() => {
            select.value = String(nextValue);
            select.dispatchEvent(new win.Event("change", { bubbles: true }));
          });
        } else {
          if (!Object.hasOwn(ACTIONS, name)) return false;
          const node = q2(ACTIONS[name]);
          if (!node || node.disabled || ((_a2 = node.closest) == null ? void 0 : _a2.call(node, "[inert]"))) return false;
          guard(() => node.click());
        }
      } catch (_) {
        refresh();
        schedule();
        return false;
      }
      refresh();
      schedule();
      return true;
    },
    refresh,
    dispose() {
      disposed = true;
      observer.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
      for (const name of ["change", "click"]) doc.removeEventListener(name, schedule, true);
      listeners.clear();
    }
  });
}
function PanelCommand({ panels, state: state2, name, children }) {
  const control = state2.controls[name];
  if (!(control == null ? void 0 : control.available)) return null;
  const unavailable = control.disabled ? `${children} · รอผลยืนยันชุดปัจจุบัน` : void 0;
  return /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      disabled: control.disabled,
      "aria-pressed": control.active,
      "aria-label": unavailable,
      title: unavailable,
      onClick: () => panels.command(name)
    },
    children
  );
}
function OutputActions({ panels }) {
  const state2 = reactExports.useSyncExternalStore(panels.subscribe, panels.getSnapshot);
  if (!state2.visible) return null;
  const hasDiagram = state2.caseOptions.length > 0;
  return /* @__PURE__ */ React.createElement("section", { className: "r35-output-actions", "aria-label": "เครื่องมือตรวจผลชุดปัจจุบัน" }, /* @__PURE__ */ React.createElement("div", { className: "r41-output-tools" }, /* @__PURE__ */ React.createElement("span", null, /* @__PURE__ */ React.createElement("b", null, "เครื่องมือตรวจเพิ่มเติม"), /* @__PURE__ */ React.createElement("small", null, "ใช้ผลยืนยันชุดเดียวกัน")), /* @__PURE__ */ React.createElement("div", { className: "r35-output-action-row", role: "group", "aria-label": "มุมมองผลขั้นสูง" }, /* @__PURE__ */ React.createElement(PanelCommand, { panels, state: state2, name: "contour" }, "แรงลม 3D / Contour"), /* @__PURE__ */ React.createElement(PanelCommand, { panels, state: state2, name: "site" }, "พื้นที่ติดตั้ง"))), hasDiagram && /* @__PURE__ */ React.createElement("div", { className: "r35-diagram-toolbar", hidden: state2.currentView !== "diagrams" }, /* @__PURE__ */ React.createElement("label", null, /* @__PURE__ */ React.createElement("span", null, "กรณีที่แสดง"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: state2.caseValue,
      disabled: state2.caseDisabled,
      onChange: (event) => panels.command("case", event.target.value)
    },
    state2.caseOptions.map((option) => /* @__PURE__ */ React.createElement("option", { key: option.value, value: option.value }, option.label))
  )), /* @__PURE__ */ React.createElement("div", { role: "group", "aria-label": "รูปแบบภาพแรงและการแอ่น" }, /* @__PURE__ */ React.createElement(PanelCommand, { panels, state: state2, name: "physical" }, "3D ชิ้นส่วน"), /* @__PURE__ */ React.createElement(PanelCommand, { panels, state: state2, name: "wire" }, "โครงคำนวณ"), /* @__PURE__ */ React.createElement(PanelCommand, { panels, state: state2, name: "deformed" }, "แอ่น ×20"))));
}
const SVG_NS = "http://www.w3.org/2000/svg";
const CHS_POLE_FILL = "#527785";
const RHS_POLE_FILL = "#547e9e";
const clamp = (value) => Math.max(0, Math.min(1, value));
const hex = (value) => String(value || "").trim().toLowerCase();
function mix(a, b, amount) {
  const t2 = clamp(amount);
  return a.map((value, index) => Math.round(value + (b[index] - value) * t2));
}
function rgb(value) {
  return `rgb(${value.join(" ")})`;
}
function parsePolygonPoints(value) {
  if (typeof value !== "string" || value.trim() === "") return [];
  const points = value.trim().split(/\s+/).map((pair) => pair.split(",").map(Number));
  return points.every((point) => point.length === 2 && point.every(Number.isFinite)) ? points : [];
}
function polygonBounds(points) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  if (![...xs, ...ys].every(Number.isFinite)) return null;
  return Object.freeze({
    left: Math.min(...xs),
    top: Math.min(...ys),
    right: Math.max(...xs),
    bottom: Math.max(...ys)
  });
}
function poleSurfaceRole(method, kind, fill) {
  const color = hex(fill);
  if (method === "CHS" && kind === "solid" && color === CHS_POLE_FILL) return "pole-chs";
  if (method === "RHS" && kind === "steel" && color === RHS_POLE_FILL) return "pole-rhs";
  if (kind === "concrete") return "concrete";
  if (kind === "anchor" || kind === "shank") return "fastener";
  if (kind === "pile") return "pile";
  if (["#b17b50", "#c5793e", "#cb8244", "#d49a3a", "#ddb047"].includes(color) && ["steel", "solid", "faceClip20"].includes(kind)) return "warm-steel";
  if (["steel", "solid", "cap32", "stiffener32", "faceRail20"].includes(kind)) return "steel";
  return null;
}
function poleSteelTone(position, method = "CHS", warm = false) {
  const t2 = clamp(position);
  const highlight = Math.exp(-Math.pow((t2 - 0.38) / 0.22, 2));
  const reflected = 0.15 * Math.exp(-Math.pow((t2 - 0.78) / 0.18, 2));
  const light = clamp(0.12 + 0.8 * highlight + reflected);
  const dark = warm ? [91, 63, 31] : method === "RHS" ? [45, 71, 86] : [42, 67, 79];
  const bright = warm ? [224, 190, 112] : method === "RHS" ? [167, 192, 202] : [174, 197, 205];
  return rgb(mix(dark, bright, light));
}
function poleGroupRole({ method, kind, fill, bounds, count: count2 = 0, viewHeight = 560 }) {
  var _a2;
  if ((_a2 = poleSurfaceRole(method, kind, fill)) == null ? void 0 : _a2.startsWith("pole-")) return true;
  if (!["solid", "steel"].includes(kind) || !bounds) return false;
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return count2 >= 12 && height >= viewHeight * 0.35 && height > Math.max(1, width) * 5 && bounds.bottom >= viewHeight * 0.55;
}
function svgNode(doc, name, attributes = {}) {
  const node = doc.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}
function stop(doc, offset, color, opacity = 1) {
  return svgNode(doc, "stop", { "offset": offset, "stop-color": color, "stop-opacity": opacity });
}
function gradient(doc, id2, stops, attributes = {}) {
  const node = svgNode(doc, "linearGradient", { id: id2, x1: "0", y1: "0", x2: "1", y2: "1", ...attributes });
  for (const entry of stops) node.append(stop(doc, ...entry));
  return node;
}
function installDefinitions(svg) {
  const doc = svg.ownerDocument;
  const defs = svgNode(doc, "defs", { "data-r32-role": "material-definitions" });
  defs.append(
    gradient(doc, "r32-steel-cool", [
      ["0%", "#334d5e"],
      ["38%", "#7897a6"],
      ["55%", "#d6e2e7"],
      ["70%", "#728d9a"],
      ["100%", "#2d4352"]
    ]),
    gradient(doc, "r32-steel-warm", [
      ["0%", "#704527"],
      ["42%", "#bd865a"],
      ["58%", "#ead0b8"],
      ["100%", "#795036"]
    ]),
    gradient(doc, "r32-fastener", [
      ["0%", "#3e4c55"],
      ["42%", "#8798a1"],
      ["58%", "#d4dde1"],
      ["100%", "#4a5961"]
    ]),
    gradient(doc, "r32-concrete", [
      ["0%", "#9daeb7"],
      ["48%", "#d9e0e3"],
      ["100%", "#aebcc3"]
    ]),
    gradient(doc, "r32-pile", [
      ["0%", "#65889b"],
      ["48%", "#a9c1cb"],
      ["100%", "#6f91a2"]
    ])
  );
  svg.prepend(defs);
}
function styleStaticMaterial(polygon, role) {
  const fills = {
    concrete: "url(#r32-concrete)",
    fastener: "url(#r32-fastener)",
    pile: "url(#r32-pile)",
    steel: "url(#r32-steel-cool)",
    "warm-steel": "url(#r32-steel-warm)"
  };
  polygon.classList.add(`r32-${role}-surface`);
  polygon.setAttribute("fill", fills[role]);
  if (role === "concrete") {
    polygon.setAttribute("stroke", "#6f838e");
    polygon.setAttribute("stroke-opacity", polygon.getAttribute("fill-opacity") === ".06" ? ".34" : ".27");
    return;
  }
  polygon.setAttribute("stroke", "#294555");
  polygon.setAttribute("stroke-opacity", role === "fastener" ? ".55" : ".38");
}
function stylePole(polygons, method) {
  const records = polygons.map((polygon) => {
    const bounds = polygonBounds(parsePolygonPoints(polygon.getAttribute("points")));
    return bounds ? { polygon, bounds, center: (bounds.left + bounds.right) / 2 } : null;
  }).filter(Boolean);
  if (!records.length) return;
  const left = Math.min(...records.map((record) => record.bounds.left));
  const right = Math.max(...records.map((record) => record.bounds.right));
  const width = Math.max(1e-3, right - left);
  const warm = records.some(({ polygon }) => ["#ddb047", "#d49a3a"].includes(hex(polygon.dataset.r32SourceFill)));
  for (const { polygon, center } of records) {
    polygon.classList.add("r32-pole-surface");
    polygon.setAttribute("fill", poleSteelTone((center - left) / width, method, warm));
    polygon.setAttribute("stroke", "#183746");
    polygon.setAttribute("stroke-opacity", ".62");
    polygon.setAttribute("stroke-width", ".62");
    polygon.setAttribute("stroke-linejoin", "round");
  }
}
function enhancePoleModel(canvas) {
  var _a2, _b, _c;
  const svg = (_a2 = canvas == null ? void 0 : canvas.querySelector) == null ? void 0 : _a2.call(canvas, ":scope > svg");
  if (!svg || svg.dataset.r32Realism === "steel-lighting-v1") return false;
  const method = canvas.dataset.method === "RHS" ? "RHS" : "CHS";
  installDefinitions(svg);
  const records = [];
  for (const polygon of svg.querySelectorAll("polygon[data-mesh-kind]")) {
    const fill = polygon.getAttribute("fill");
    polygon.dataset.r32SourceFill = fill || "";
    records.push({
      polygon,
      fill,
      kind: polygon.dataset.meshKind,
      bounds: polygonBounds(parsePolygonPoints(polygon.getAttribute("points")))
    });
  }
  const grouped = /* @__PURE__ */ new Map();
  for (const record of records) {
    const key = `${record.kind}|${hex(record.fill)}`;
    const group = grouped.get(key) || {
      method,
      kind: record.kind,
      fill: record.fill,
      count: 0,
      bounds: { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
    };
    group.count += 1;
    if (record.bounds) group.bounds = {
      left: Math.min(group.bounds.left, record.bounds.left),
      top: Math.min(group.bounds.top, record.bounds.top),
      right: Math.max(group.bounds.right, record.bounds.right),
      bottom: Math.max(group.bounds.bottom, record.bounds.bottom)
    };
    grouped.set(key, group);
  }
  const viewHeight = ((_c = (_b = svg.viewBox) == null ? void 0 : _b.baseVal) == null ? void 0 : _c.height) || 560;
  const poleGroups = new Set([...grouped].filter(([, group]) => poleGroupRole({ ...group, viewHeight })).map(([key]) => key));
  const pole = [];
  for (const record of records) {
    const key = `${record.kind}|${hex(record.fill)}`;
    const role = poleSurfaceRole(method, record.kind, record.fill);
    if (poleGroups.has(key)) pole.push(record.polygon);
    else if (role) styleStaticMaterial(record.polygon, role);
  }
  stylePole(pole, method);
  svg.dataset.r32Realism = "steel-lighting-v1";
  svg.dataset.r32PoleFacets = String(pole.length);
  canvas.dataset.r32Realism = "steel-lighting-v1";
  return true;
}
function installPoleRealism(doc, win) {
  const canvas = doc.getElementById("n15DraftCanvas");
  if (!canvas) return Object.freeze({ dispose() {
  } });
  let frame = 0;
  const refresh = () => {
    frame = 0;
    enhancePoleModel(canvas);
  };
  const schedule = () => {
    if (!frame) frame = win.requestAnimationFrame(refresh);
  };
  const observer = new win.MutationObserver(schedule);
  observer.observe(canvas, { childList: true });
  refresh();
  return Object.freeze({
    refresh,
    dispose() {
      observer.disconnect();
      if (frame) win.cancelAnimationFrame(frame);
    }
  });
}
const connected = (node) => !!(node == null ? void 0 : node.isConnected);
const requiredId = (id2, label = "#" + id2) => Object.freeze({
  id: "node:" + id2,
  description: label,
  resolve: (doc) => doc.getElementById(id2),
  validate: connected
});
const requiredSelector = (id2, selector) => Object.freeze({
  id: id2,
  selector,
  description: selector,
  validate: connected
});
const baseDomRequirements = [
  Object.freeze({
    id: "document:body",
    description: "connected document.body",
    resolve: (doc) => doc.body,
    validate: connected
  }),
  requiredSelector("shell:header", ".app-header"),
  requiredId("n15Nav"),
  requiredId("r22ResultNav"),
  requiredId("r22ViewerTools"),
  requiredSelector("viewer:camera-tools", ".n15-camera-tools"),
  Object.freeze({
    id: "node:cp025Panel",
    description: "#cp025Panel with connected layout parent",
    resolve: (doc) => doc.getElementById("cp025Panel"),
    validate: (node) => connected(node) && connected(node.parentElement)
  }),
  requiredId("n42FormBody"),
  requiredId("n42CalcDock"),
  requiredId("cp025Calculate"),
  requiredId("n38MaterialIndex"),
  requiredId("n38SelectionFooter"),
  requiredId("n51Rows"),
  requiredSelector("table:steel", "#n37Picker .n37-table-wrap"),
  requiredSelector("table:foundation", "#n22FoundationChoice .n22-table-scroll"),
  requiredId("n45Table"),
  requiredId("n42Advanced"),
  requiredId("n15Book"),
  requiredId("n30Startup"),
  Object.freeze({
    id: "output:navigation",
    description: "#n15OutputNav with contour and site actions",
    resolve: (doc) => {
      const node = doc.getElementById("n15OutputNav");
      return (node == null ? void 0 : node.querySelector("#n32AnalysisView")) && node.querySelector("#n28SiteOpen") ? node : null;
    },
    validate: connected
  }),
  Object.freeze({
    id: "connection:evidence-materials",
    description: "#cp10_anchorGrade within .cp10-conn-meta",
    resolve: (doc) => {
      var _a2;
      return (_a2 = doc.getElementById("cp10_anchorGrade")) == null ? void 0 : _a2.closest(".cp10-conn-meta");
    },
    validate: connected
  }),
  Object.freeze({
    id: "connection:evidence-hardware",
    description: "#cp015ConnectionInputs",
    resolve: (doc) => doc.getElementById("cp015ConnectionInputs"),
    validate: connected
  })
];
const fieldRequirements = [...new Set([...FORM_FIELDS, ...DETAIL_FIELDS].map(([id2]) => id2))].map((id2) => requiredId(id2, "native field #" + id2));
const detailRequirements = DETAIL_GROUPS.map((group) => Object.freeze({
  id: "detail:" + group.id,
  description: group.selector + (group.fieldParent ? " within .cp25-grid" : ""),
  resolve: (doc) => {
    const source = doc.querySelector(group.selector);
    return group.fieldParent ? source == null ? void 0 : source.closest(".cp25-grid") : source;
  },
  validate: connected
}));
const connectionRequirement = Object.freeze({
  id: "connection:groups",
  description: CONNECTION_ANCHORS.map((id2) => "#" + id2).join(", ") + " and connection evidence",
  resolve: (doc) => connectionGroups(doc),
  validate: (groups) => groups.length > 0 && groups.every((group) => connected(group.source) && group.fields.length > 0 && group.fields.every(([id2]) => !!id2))
});
const REACT_NATIVE_CONTRACT = createNativeContract({
  globals: [
    { id: "runtime:workbench", path: "NCYR22Workbench" },
    { id: "runtime:project-io", path: "NCYSignProjectIO" },
    { id: "runtime:flow-ready", path: "NCYR16Flow.ready", validate: (value) => value === true },
    { id: "runtime:result-snapshot", path: "NCYAnchorR10.snapshot", validate: (value) => typeof value === "function" },
    { id: "runtime:parity-gate", path: "NCYR14ParityGate", validate: (value) => typeof value === "function" }
  ],
  dom: [...baseDomRequirements, ...fieldRequirements, ...detailRequirements, connectionRequirement]
});
class NativeFallback extends React.Component {
  constructor() {
    super(...arguments);
    __publicField(this, "state", { failed: false });
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    var _a2;
    this.props.onFailure();
    document.documentElement.removeAttribute("data-sign-react");
    document.documentElement.removeAttribute("data-sign-forms");
    document.documentElement.removeAttribute("data-sign-selection");
    document.documentElement.removeAttribute("data-sign-details");
    document.documentElement.removeAttribute("data-sign-panels");
    (_a2 = window.NCYSignStartup) == null ? void 0 : _a2.fallback();
    console.error("SIGN React screen unavailable; native controls restored", error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
async function start() {
  var _a2;
  const dependencies = await waitForNativeContract(REACT_NATIVE_CONTRACT, document, window, { timeoutMs: 6e4, retryMs: 100 });
  const groups = dependencies.dom["connection:groups"];
  const nativeOutputNav = dependencies.dom["output:navigation"];
  const slots = [], formSlots = [], extraSlots = [], sourceMarkers = [];
  const disposables = [];
  let root = null, host = null, layout = null, layoutOriginalId = "";
  let nativeOutputMarked = false, calculateHandler = null;
  try {
    let before = function(source, name, replace = true) {
      if (!(source == null ? void 0 : source.isConnected)) throw Error("Disconnected native presentation anchor: " + name);
      const node = document.createElement("div");
      node.id = "r28-" + name;
      node.dataset.r28Island = "";
      source.before(node);
      if (replace) {
        source.dataset.r28Source = "";
        sourceMarkers.push([source, "r28Source"]);
      }
      extraSlots.push(node);
      return node;
    };
    const poleRealism = installPoleRealism(document, window);
    disposables.push(poleRealism);
    const adapter = createNativeWorkbench(document, window);
    disposables.push(adapter);
    const confirmedResultApi = Object.freeze({
      revision: "R47",
      canIssue: false,
      inspect: () => structuredClone(adapter.inspectResult()),
      requireCurrent: adapter.captureResult
    });
    window.NCYConfirmedResultR47 = confirmedResultApi;
    window.NCYConfirmedResultR43 = confirmedResultApi;
    window.NCYConfirmedResultR42 = confirmedResultApi;
    window.NCYConfirmedResultR41 = confirmedResultApi;
    window.NCYConfirmedResultR37 = confirmedResultApi;
    window.NCYConfirmedResultR36 = confirmedResultApi;
    window.NCYConfirmedResultR35 = confirmedResultApi;
    window.NCYConfirmedResultR34 = confirmedResultApi;
    window.NCYConfirmedResultR33 = confirmedResultApi;
    window.NCYConfirmedResultR32 = confirmedResultApi;
    window.NCYConfirmedResultR31 = confirmedResultApi;
    window.NCYConfirmedResultR30 = confirmedResultApi;
    const form = createNativeForm(document, window, adapter);
    disposables.push(form);
    const details = createNativeForm(document, window, adapter, { fields: DETAIL_FIELDS, roots: ["cp025Panel"], idPrefix: "r28-" });
    disposables.push(details);
    const selection = createNativeSelection(document, window, adapter);
    disposables.push(selection);
    const connectionFields = groups.flatMap((group) => group.fields);
    const eventHosts = Object.fromEntries(groups.filter((group) => group.id === "hardware").flatMap((group) => group.fields).map(([id2]) => [id2, '#inputPanel .cp10-pane[data-pane="materials"]']));
    const connections = createNativeForm(document, window, adapter, {
      fields: connectionFields,
      roots: ["cp025Panel", "inputPanel", "cp025EvidenceBackend"],
      idPrefix: "r29-",
      eventHosts
    });
    disposables.push(connections);
    const results = createNativeResults(document, window, adapter);
    disposables.push(results);
    const panels = createNativePanels(document, window, adapter);
    disposables.push(panels);
    const anchors = [
      dependencies.dom["shell:header"],
      dependencies.dom["node:n15Nav"],
      dependencies.dom["node:r22ResultNav"],
      dependencies.dom["viewer:camera-tools"]
    ];
    anchors.forEach((anchor, index) => {
      const node = document.createElement("div");
      node.id = ["r26-project", "r26-workflow", "r26-results", "r26-viewer"][index];
      node.dataset.r26Island = "";
      anchor.before(node);
      slots.push(node);
    });
    host = document.createElement("div");
    for (const name of ["project", "inputs", "calculate"]) {
      const node = document.createElement("div");
      node.id = "r27-" + name;
      node.dataset.r27Island = "";
      formSlots.push(node);
    }
    layout = dependencies.dom["node:cp025Panel"].parentElement;
    layoutOriginalId = layout.id;
    layout.id = "r27-layout";
    dependencies.dom["node:n15Book"].prepend(formSlots[0]);
    dependencies.dom["node:n42FormBody"].prepend(formSlots[1]);
    dependencies.dom["node:n42CalcDock"].prepend(formSlots[2]);
    const detailSlots = DETAIL_GROUPS.map((group) => ({
      group,
      slot: before(dependencies.dom["detail:" + group.id], "fields-" + group.id)
    }));
    const selectionSlots = {
      nav: before(dependencies.dom["node:n38MaterialIndex"], "materials"),
      footer: before(dependencies.dom["node:n38SelectionFooter"], "footer")
    };
    const tableSources = [
      ["reference", dependencies.dom["node:n51Rows"]],
      ["steel", dependencies.dom["table:steel"]],
      ["foundation", dependencies.dom["table:foundation"]],
      ["connection", dependencies.dom["node:n45Table"]]
    ];
    const tableSlots = tableSources.map(([name, source]) => ({
      name,
      slot: before(source, "table-" + name, !["foundation", "connection"].includes(name))
    }));
    const connectionSlots = groups.filter((group) => !group.evidence).map((group) => {
      var _a3;
      const slot = document.createElement("div");
      slot.dataset.r29Island = "";
      slot.id = "r29-fields-" + group.id;
      if (!((_a3 = group.source) == null ? void 0 : _a3.isConnected)) throw Error("Disconnected native connection group: " + group.id);
      group.source.before(slot);
      group.source.dataset.r29Source = "";
      sourceMarkers.push([group.source, "r29Source"]);
      extraSlots.push(slot);
      return { group, slot };
    });
    const evidenceSlot = document.createElement("div");
    evidenceSlot.dataset.r29Island = "";
    evidenceSlot.id = "r29-evidence";
    dependencies.dom["node:n42Advanced"].before(evidenceSlot);
    extraSlots.push(evidenceSlot);
    const panelSlot = document.createElement("div");
    panelSlot.dataset.r35Island = "";
    panelSlot.id = "r35-output-actions";
    nativeOutputNav.before(panelSlot);
    extraSlots.push(panelSlot);
    host.id = "r26-react-root";
    host.hidden = true;
    dependencies.dom["document:body"].append(host);
    root = createRoot(host);
    let failed = false;
    reactDomExports.flushSync(() => root.render(/* @__PURE__ */ React.createElement(NativeFallback, { onFailure: () => {
      failed = true;
    } }, /* @__PURE__ */ React.createElement(Workbench, { adapter, slots }), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(ProjectInformation, { form }), formSlots[0]), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(QuickInput, { form, detailForm: details, adapter }), formSlots[1]), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(CalculateBar, { form, adapter }), formSlots[2]), detailSlots.map(({ group, slot }) => reactDomExports.createPortal(/* @__PURE__ */ React.createElement(DetailFields, { group, form: details }), slot, group.id)), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(MaterialNavigation, { selection }), selectionSlots.nav), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(SelectionFooter, { selection }), selectionSlots.footer), tableSlots.map(({ name, slot }) => reactDomExports.createPortal(/* @__PURE__ */ React.createElement(CandidateTable, { name, selection }), slot, name)), connectionSlots.map(({ group, slot }) => reactDomExports.createPortal(/* @__PURE__ */ React.createElement(ConnectionFields, { group, form: connections }), slot, group.id)), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(ConnectionEvidence, { groups: groups.filter((group) => group.evidence), form: connections }), evidenceSlot), reactDomExports.createPortal(/* @__PURE__ */ React.createElement(OutputActions, { panels }), panelSlot), /* @__PURE__ */ React.createElement(ResultTables, { results }))));
    if (failed) throw Error("React mount failed; retaining native controls");
    disposables.push(arrangeInputLayout(document, adapter));
    document.documentElement.dataset.signContract = "r36";
    document.documentElement.dataset.signScene = "r37";
    document.documentElement.dataset.signReact = "r26";
    document.documentElement.dataset.signForms = "r27";
    document.documentElement.dataset.signSelection = "r28";
    document.documentElement.dataset.signDetails = "r29";
    document.documentElement.dataset.signPanels = "r35";
    nativeOutputNav.dataset.r35Source = "";
    nativeOutputMarked = true;
    calculateHandler = () => {
      details.focusInvalid();
      connections.focusInvalid();
    };
    dependencies.dom["node:cp025Calculate"].addEventListener("click", calculateHandler);
    window.NCYReactWorkbench = Object.freeze({
      revision: "R47",
      inspect: () => structuredClone(adapter.getSnapshot()),
      captureResult: adapter.captureResult,
      command: adapter.command
    });
  } catch (error) {
    if (calculateHandler) dependencies.dom["node:cp025Calculate"].removeEventListener("click", calculateHandler);
    try {
      root == null ? void 0 : root.unmount();
    } catch (_) {
    }
    for (const disposable of [...disposables].reverse()) {
      try {
        (_a2 = disposable == null ? void 0 : disposable.dispose) == null ? void 0 : _a2.call(disposable);
      } catch (_) {
      }
    }
    for (const node of [...slots, ...formSlots, ...extraSlots]) node.remove();
    host == null ? void 0 : host.remove();
    for (const [source, key] of sourceMarkers) delete source.dataset[key];
    if (nativeOutputMarked) delete nativeOutputNav.dataset.r35Source;
    if (layout) {
      if (layoutOriginalId) layout.id = layoutOriginalId;
      else layout.removeAttribute("id");
    }
    for (const name of [
      "data-sign-contract",
      "data-sign-react",
      "data-sign-forms",
      "data-sign-selection",
      "data-sign-details",
      "data-sign-panels",
      "data-sign-scene"
    ]) {
      document.documentElement.removeAttribute(name);
    }
    delete window.NCYReactWorkbench;
    for (const revision of ["R47", "R43", "R42", "R41", "R40", "R39", "R38", "R37", "R36", "R35", "R34", "R33", "R32", "R31", "R30"]) {
      delete window["NCYConfirmedResult" + revision];
    }
    throw error;
  }
}
start().catch((error) => {
  var _a2;
  (_a2 = window.NCYSignStartup) == null ? void 0 : _a2.fallback();
  console.error("SIGN native screen remains available", error);
});
