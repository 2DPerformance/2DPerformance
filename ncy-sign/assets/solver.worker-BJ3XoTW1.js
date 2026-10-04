(function() {
  "use strict";
  const FrameEngine30 = /* @__PURE__ */ (() => {
    const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const norm = (a) => Math.hypot(...a);
    const add = (a, b) => a.map((v, i) => v + b[i]);
    const scale = (a, s) => a.map((v) => v * s);
    const zeros = (n) => Array.from({ length: n }, () => new Float64Array(n));
    const mv = (a, x) => a.map((r) => dot(Array.from(r), x));
    function finite(v, name) {
      if (!Number.isFinite(v)) throw Error(name + " ต้องเป็นตัวเลขจำกัด");
      return v;
    }
    function basis(pi, pj, yHint = [1, 0, 0]) {
      const delta = pj.map((v, i) => v - pi[i]), L = norm(delta);
      if (!(L > 1e-8)) throw Error("สมาชิกยาวเป็นศูนย์ / จุดปลายซ้อน");
      const x = scale(delta, 1 / L), proj = dot(x, yHint), yp = yHint.map((v, i) => v - proj * x[i]), yn = norm(yp);
      if (!(yn > 1e-8)) throw Error("แกนอ้างอิง local y ขนานกับสมาชิก");
      const y = scale(yp, 1 / yn), z = cross(x, y);
      return { L, R: [x, y, z] };
    }
    function localK(s, L) {
      for (const k2 of ["EA", "EIy", "EIz", "GJ"]) if (!(finite(s[k2], k2) > 0)) throw Error(k2 + " ต้องมากกว่า 0");
      const k = zeros(12), pair = (i, j, c) => {
        k[i][i] += c;
        k[j][j] += c;
        k[i][j] -= c;
        k[j][i] -= c;
      };
      pair(0, 6, s.EA / L);
      pair(3, 9, s.GJ / L);
      const bend = (ids, signs, EI) => {
        const c = EI / L ** 3, l2 = L * L;
        const a = [[12, 6 * L, -12, 6 * L], [6 * L, 4 * l2, -6 * L, 2 * l2], [-12, -6 * L, 12, -6 * L], [6 * L, 2 * l2, -6 * L, 4 * l2]];
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) k[ids[i]][ids[j]] += c * a[i][j] * signs[i] * signs[j];
      };
      bend([1, 5, 7, 11], [1, 1, 1, 1], s.EIz);
      bend([2, 4, 8, 10], [1, -1, 1, -1], s.EIy);
      return k;
    }
    function transform(R) {
      const t = zeros(12);
      for (let block = 0; block < 4; block++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) t[3 * block + a][3 * block + b] = R[a][b];
      return t;
    }
    function transposeMV(T, f) {
      return f.map((_, i) => f.reduce((sum, v, j) => sum + T[j][i] * v, 0));
    }
    function globalK(k, T) {
      const out = zeros(12);
      for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (k[a][b]) {
        for (let i = 0; i < 12; i++) if (T[a][i]) {
          for (let j = 0; j < 12; j++) if (T[b][j]) out[i][j] += T[a][i] * k[a][b] * T[b][j];
        }
      }
      return out;
    }
    function localLoad(q, L) {
      const [x, y, z, tx, my, mz] = q, f = new Array(12).fill(0);
      f[0] = f[6] = x * L / 2;
      f[1] = y * L / 2 - mz;
      f[7] = y * L / 2 + mz;
      f[2] = z * L / 2 + my;
      f[8] = z * L / 2 - my;
      f[3] = f[9] = tx * L / 2;
      f[5] = y * L * L / 12;
      f[11] = -f[5];
      f[4] = -z * L * L / 12;
      f[10] = -f[4];
      return f;
    }
    function spd(A, b) {
      const n = b.length, sc = A.map((r, i) => {
        if (!(r[i] > 0)) throw Error("โมเดลมี DOF ไร้ความแข็ง / ไม่มั่นคง");
        return Math.sqrt(r[i]);
      }), L = zeros(n);
      let pivot = 1;
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
        let s = A[i][j] / (sc[i] * sc[j]);
        for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
        if (i === j) {
          if (!(s > 1e-11)) throw Error("โมเดลเป็นกลไก หรือความแข็งต่างกันเกินขอบเขตตัวเลข");
          pivot = Math.min(pivot, s);
          L[i][j] = Math.sqrt(s);
        } else L[i][j] = s / L[j][j];
      }
      const y = new Float64Array(n), z = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let v = b[i] / sc[i];
        for (let j = 0; j < i; j++) v -= L[i][j] * y[j];
        y[i] = v / L[i][i];
      }
      for (let i = n - 1; i >= 0; i--) {
        let v = y[i];
        for (let j = i + 1; j < n; j++) v -= L[j][i] * z[j];
        z[i] = v / L[i][i];
      }
      return { u: Array.from(z, (v, i) => v / sc[i]), minScaledPivot: pivot };
    }
    function roots01(coeff) {
      const c = coeff.slice();
      while (c.length > 1 && Math.abs(c.at(-1)) < 1e-16) c.pop();
      if (c.length < 2) return [];
      if (c.length === 2) {
        const x = -c[0] / c[1];
        return x > 0 && x < 1 ? [x] : [];
      }
      const val = (x) => c.reduceRight((v, a) => v * x + a, 0), cuts = [0, ...roots01(c.slice(1).map((v, i) => v * (i + 1))), 1], out = [], tol = Math.max(1e-15, ...c.map((v) => Math.abs(v) * 1e-12));
      for (const x of cuts) if (x > 0 && x < 1 && Math.abs(val(x)) < tol) out.push(x);
      for (let i = 1; i < cuts.length; i++) {
        let lo = cuts[i - 1], hi = cuts[i], vl = val(lo), vh = val(hi);
        if (vl * vh >= 0) continue;
        for (let n = 0; n < 60; n++) {
          const mid = (lo + hi) / 2, vm = val(mid);
          if (vl * vm <= 0) {
            hi = mid;
            vh = vm;
          } else {
            lo = mid;
            vl = vm;
          }
        }
        out.push((lo + hi) / 2);
      }
      return out.sort((a, b) => a - b).filter((v, i, a) => !i || v - a[i - 1] > 1e-9);
    }
    function stationPositions(e) {
      const L = e.L, u = e.ul, q = e.q, ax = q[0] * L * L / (2 * e.section.EA), poly = [[u[0], u[6] - u[0] + ax, -ax, 0, 0]];
      for (const [v1, r1, v2, r2, qv, EI] of [[u[1], u[5], u[7], u[11], q[1], e.section.EIz], [u[2], -u[4], u[8], -u[10], q[2], e.section.EIy]]) {
        const b = qv * L ** 4 / (24 * EI);
        poly.push([v1, L * r1, -3 * v1 - 2 * L * r1 + 3 * v2 - L * r2 + b, 2 * v1 + L * r1 - 2 * v2 + L * r2 - 2 * b, b]);
      }
      const xs = Array.from({ length: 9 }, (_, i) => i * L / 8);
      for (let i = 0; i < 3; i++) {
        const c = Array.from({ length: 5 }, (_, k) => poly.reduce((v, p, j) => v + e.R[j][i] * p[k], 0));
        xs.push(...roots01(c.slice(1).map((v, k) => v * (k + 1))).map((t) => t * L));
      }
      for (const [a, b] of [[e.fl[1] - q[5], q[1]], [-e.fl[2] - q[4], -q[2]]]) if (Math.abs(b) > 1e-15) {
        const x = -a / b;
        if (x > 0 && x < L) xs.push(x);
      }
      const n = [-e.fl[0], -q[0] * L], my = [-e.fl[4], (-e.fl[2] - q[4]) * L, -q[2] * L * L / 2], mz = [-e.fl[5], (e.fl[1] - q[5]) * L, q[1] * L * L / 2];
      for (const p of [n, my, mz]) xs.push(...roots01(p).map((t) => t * L));
      if (e.section.Sy && e.section.Sz) {
        for (const ny of [-1, 1]) for (const nz of [-1, 1]) {
          const c = [0, 1, 2].map((k) => (n[k] || 0) * 1e3 / e.section.A + ny * (my[k] || 0) * 1e6 / e.section.Sy + nz * (mz[k] || 0) * 1e6 / e.section.Sz);
          xs.push(...roots01([c[1], 2 * c[2]]).map((t) => t * L));
        }
      }
      if (e.section.type === "CHS" && e.section.S) {
        const mul = (a, b2) => {
          const out = new Array(a.length + b2.length - 1).fill(0);
          a.forEach((x, i) => b2.forEach((y, j) => out[i + j] += x * y));
          return out;
        }, sum = (a, b2) => Array.from({ length: Math.max(a.length, b2.length) }, (_, i) => (a[i] || 0) + (b2[i] || 0));
        const b = my.map((v) => v * 1e6 / e.section.S), c = mz.map((v) => v * 1e6 / e.section.S), bp = b.slice(1).map((v, i) => v * (i + 1)), cp = c.slice(1).map((v, i) => v * (i + 1)), a1 = n[1] * 1e3 / e.section.A;
        const bend2 = sum(mul(b, b), mul(c, c)), der = sum(mul(b, bp), mul(c, cp)), d2 = mul(der, der), equation = sum(bend2.map((v) => a1 * a1 * v), d2.map((v) => -v));
        xs.push(...roots01(equation).map((t) => t * L));
      }
      return xs.sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1e-10);
    }
    function solve(model, loads = {}) {
      var _a;
      const { nodes, elements, ties = [], springs = [] } = model;
      if (!(nodes == null ? void 0 : nodes.length) || !(elements == null ? void 0 : elements.length) || nodes.length > 210) throw Error("ต้องมีโมเดลที่เชื่อมต่อ / จำกัด 210 nodes");
      if (model.order && model.order !== "first") throw Error("Frame30 รองรับ FIRST ORDER เท่านั้น; ไม่ละเลย P–Δ โดยไม่แจ้ง");
      const nd = nodes.length * 6, map = /* @__PURE__ */ new Map();
      nodes.forEach((n, i) => {
        var _a2;
        if (map.has(n.id)) throw Error("node ID ซ้ำ");
        map.set(n.id, i);
        if (((_a2 = n.p) == null ? void 0 : _a2.length) !== 3 || n.p.some((x) => !Number.isFinite(x))) throw Error("พิกัด node ผิด");
      });
      const index = (id) => {
        if (!map.has(id)) throw Error("ไม่พบ node " + id);
        return map.get(id);
      };
      const K = zeros(nd), F = new Float64Array(nd), records = [], ids = /* @__PURE__ */ new Set();
      for (const e of elements) {
        if (ids.has(e.id)) throw Error("element ID ซ้ำ");
        ids.add(e.id);
        const ii = index(e.i), jj = index(e.j), { L, R } = basis(nodes[ii].p, nodes[jj].p, e.yHint), T = transform(R), k = localK(e.section, L);
        const qg = ((_a = loads.element) == null ? void 0 : _a[e.id]) || [0, 0, 0, 0, 0, 0];
        if (qg.length !== 6 || qg.some((v) => !Number.isFinite(v))) throw Error("แรงกระจายไม่ถูกต้อง");
        const q = [...R.map((r) => dot(r, qg.slice(0, 3))), ...R.map((r) => dot(r, qg.slice(3, 6)))], fl = localLoad(q, L), fg = transposeMV(T, fl), kg = globalK(k, T), dofs = [...Array.from({ length: 6 }, (_, a) => 6 * ii + a), ...Array.from({ length: 6 }, (_, a) => 6 * jj + a)];
        for (let a = 0; a < 12; a++) {
          F[dofs[a]] += fg[a];
          for (let b = 0; b < 12; b++) K[dofs[a]][dofs[b]] += kg[a][b];
        }
        records.push({ ...e, ii, jj, L, R, T, k, q, fl, dofs });
      }
      for (const [id, q] of Object.entries(loads.node || {})) {
        const i = index(id);
        if (q.length !== 6 || q.some((x) => !Number.isFinite(x))) throw Error("แรงจุดไม่ถูกต้อง");
        for (let a = 0; a < 6; a++) F[6 * i + a] += q[a];
      }
      for (const s of springs) {
        if (!Number.isInteger(s.dof) || s.dof < 0 || s.dof > 5 || !(finite(s.k, "spring K") > 0)) throw Error("spring ต้องมี K>0");
        const a = 6 * index(s.i) + s.dof, b = 6 * index(s.j) + s.dof;
        K[a][a] += s.k;
        K[b][b] += s.k;
        K[a][b] -= s.k;
        K[b][a] -= s.k;
      }
      const parent = Array.from({ length: nd }, (_, i) => i), root = (a) => {
        while (parent[a] !== a) {
          parent[a] = parent[parent[a]];
          a = parent[a];
        }
        return a;
      };
      for (const t of ties) {
        const i = index(t.i), j = index(t.j);
        if (norm(nodes[i].p.map((v, k) => v - nodes[j].p[k])) > 1e-8) throw Error("equalDOF ต้องอยู่จุดเดียวกัน ไม่ใช่ rigid-offset โดยปริยาย");
        for (const d of t.dofs) {
          if (!Number.isInteger(d) || d < 0 || d > 5) throw Error("tie DOF ผิด");
          parent[root(6 * j + d)] = root(6 * i + d);
        }
      }
      const group = parent.map((_, i) => root(i)), fixed = /* @__PURE__ */ new Set();
      nodes.forEach((n, i) => (n.fix || []).forEach((v, d) => {
        if (v) fixed.add(group[6 * i + d]);
      }));
      const roots = [...new Set(group)], free = roots.filter((i) => !fixed.has(i)), freeMap = new Map(free.map((r, i) => [r, i]));
      if (!fixed.size) throw Error("ไม่มีฐานรองรับ");
      const Kr = zeros(free.length), Fr = new Float64Array(free.length), fi = group.map((r) => freeMap.has(r) ? freeMap.get(r) : -1);
      for (let a = 0; a < nd; a++) if (fi[a] >= 0) {
        Fr[fi[a]] += F[a];
        for (let b = 0; b < nd; b++) if (fi[b] >= 0) Kr[fi[a]][fi[b]] += K[a][b];
      }
      const solution = spd(Kr, Array.from(Fr)), u = fi.map((i) => i < 0 ? 0 : solution.u[i]), res = mv(K, u).map((v, i) => v - F[i]), groupRes = new Map(roots.map((r) => [r, 0]));
      res.forEach((v, i) => groupRes.set(group[i], groupRes.get(group[i]) + v));
      const freeResidual = Math.max(0, ...free.map((i) => Math.abs(groupRes.get(i))));
      const nodeResults = nodes.map((n, i) => ({ id: n.id, p: n.p, u: u.slice(6 * i, 6 * i + 6), reaction: (n.fix || []).map((v, d) => v ? res[6 * i + d] : 0) }));
      const er = records.map((e) => {
        const ug = e.dofs.map((i) => u[i]), ul = mv(e.T, ug), fl = mv(e.k, ul).map((v, i) => v - e.fl[i]), fg = transposeMV(e.T, fl);
        return { ...e, ul, fl, fg, stations: [] };
      });
      let applied = [0, 0, 0, 0, 0, 0], reaction = [0, 0, 0, 0, 0, 0];
      nodes.forEach((n, i) => {
        const f = Array.from(F.slice(6 * i, 6 * i + 6)), r = nodeResults[i].reaction.length ? nodeResults[i].reaction : [0, 0, 0, 0, 0, 0];
        const fa = [...f.slice(0, 3), ...add(f.slice(3), cross(n.p, f.slice(0, 3)))], ra = [...r.slice(0, 3), ...add(r.slice(3), cross(n.p, r.slice(0, 3)))];
        applied = add(applied, fa);
        reaction = add(reaction, ra);
      });
      for (const e of er) e.stations = stationPositions(e).map((x) => at(e, x));
      const result = { version: 30, order: "first", nodeResults, elements: er, applied, reaction, equilibrium: add(applied, reaction), freeResidual, minScaledPivot: solution.minScaledPivot, ndof: nd, freeDOF: free.length, springs: springs.map((s) => {
        const du = u[6 * index(s.j) + s.dof] - u[6 * index(s.i) + s.dof];
        return { ...s, relative: du, actionOnI: s.k * du };
      }) };
      if ([...applied, ...reaction, freeResidual].some((v) => !Number.isFinite(v))) throw Error("ผลไม่จำกัด / ไม่ส่งผลต่อ");
      const maxF = Math.max(1, ...applied.map(Math.abs));
      if (freeResidual > 1e-6 * maxF || result.equilibrium.some((v) => Math.abs(v) > 1e-6 * maxF)) throw Error("สมดุลเชิงตัวเลขไม่ผ่าน — ตรวจความแข็ง/มิติ");
      if (loads.capture34) result.system34 = { K: Kr, fi, records, free, group };
      return result;
    }
    function at(e, x) {
      const L = e.L, t = Math.max(0, Math.min(1, x / L)), s = t * L, u = e.ul, q = e.q, f = e.fl;
      const h = [1 - 3 * t * t + 2 * t ** 3, L * (t - 2 * t * t + t ** 3), 3 * t * t - 2 * t ** 3, L * (-t * t + t ** 3)], dh = [(-6 * t + 6 * t * t) / L, 1 - 4 * t + 3 * t * t, (6 * t - 6 * t * t) / L, -2 * t + 3 * t * t];
      const v = [u[1], u[5], u[7], u[11]], w = [u[2], -u[4], u[8], -u[10]], bubble = (qv) => qv * s * s * (L - s) ** 2 / 24, dbubble = (qv) => qv * s * (L - s) * (L - 2 * s) / 12;
      const dl = [(1 - t) * u[0] + t * u[6] + q[0] * s * (L - s) / (2 * e.section.EA), dot(h, v) + bubble(q[1]) / e.section.EIz, dot(h, w) + bubble(q[2]) / e.section.EIy];
      const rl = [(1 - t) * u[3] + t * u[9] + q[3] * s * (L - s) / (2 * e.section.GJ), -dot(dh, w) - dbubble(q[2]) / e.section.EIy, dot(dh, v) + dbubble(q[1]) / e.section.EIz];
      const toGlobal = (a) => [0, 1, 2].map((i) => a.reduce((z, v2, j) => z + e.R[j][i] * v2, 0));
      return { s, N: -(f[0] + q[0] * s), Vy: -(f[1] + q[1] * s), Vz: -(f[2] + q[2] * s), T: -(f[3] + q[3] * s), My: -f[4] - f[2] * s - q[2] * s * s / 2 - q[4] * s, Mz: -f[5] + f[1] * s + q[1] * s * s / 2 - q[5] * s, local: dl, global: toGlobal(dl), rotation: toGlobal(rl) };
    }
    return { version: 30, basis, localK, localLoad, solve, at, dot, cross, roots01, order: "first" };
  })();
  const Second35 = (() => {
    const zeros = (n) => Array.from({ length: n }, () => new Float64Array(n));
    const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0), mv = (A, x) => A.map((r) => dot(r, x));
    const norm = (x) => Math.hypot(...x), cross = FrameEngine30.cross, add = (a, b) => a.map((x, i) => x + b[i]);
    const trmv = (T, x) => Array.from({ length: T[0].length }, (_, i) => T.reduce((s, r, j) => s + r[i] * x[j], 0));
    const Gx = [-0.8611363115940526, -0.3399810435848563, 0.3399810435848563, 0.8611363115940526];
    const Gw = [0.3478548451374538, 0.6521451548625461, 0.6521451548625461, 0.3478548451374538];
    function factor(K) {
      const n = K.length, sc = K.map((r, i) => {
        if (!(r[i] > 0)) throw Error("P–Δ: ความแข็งสัมผัสไม่เป็นบวก / ไม่ส่งผลผ่าน");
        return Math.sqrt(r[i]);
      }), L = zeros(n);
      let pivot = 1;
      for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
        let v = K[i][j] / sc[i] / sc[j];
        for (let k = 0; k < j; k++) v -= L[i][k] * L[j][k];
        if (i === j) {
          if (!(v > 1e-11)) throw Error("P–Δ: ถึง/เกินขอบเขตเสถียรภาพเชิงเส้น หรือเมทริกซ์เสียสภาพ");
          pivot = Math.min(pivot, v);
          L[i][j] = Math.sqrt(v);
        } else L[i][j] = v / L[j][j];
      }
      const lower = (b) => {
        const x = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          let v = b[i];
          for (let j = 0; j < i; j++) v -= L[i][j] * x[j];
          x[i] = v / L[i][i];
        }
        return x;
      };
      const upper = (b) => {
        const x = new Float64Array(n);
        for (let i = n - 1; i >= 0; i--) {
          let v = b[i];
          for (let j = i + 1; j < n; j++) v -= L[j][i] * x[j];
          x[i] = v / L[i][i];
        }
        return x;
      };
      return { sc, L, pivot, lower, upper, solve: (b) => Array.from(upper(lower(b.map((v, i) => v / sc[i]))), (v, i) => v / sc[i]) };
    }
    function geom14(L, N0, qx) {
      if (!(L > 0) || ![N0, qx].every(Number.isFinite)) throw Error("Kg: ความยาว/แรงตามแกนไม่ถูกต้อง");
      const g = zeros(14);
      for (let a = 0; a < 4; a++) {
        const t = (Gx[a] + 1) / 2, w = Gw[a] * L / 2, N = N0 - qx * t * L;
        const d = [(-6 * t + 6 * t * t) / L, 1 - 4 * t + 3 * t * t, (6 * t - 6 * t * t) / L, -2 * t + 3 * t * t, (2 * t - 6 * t * t + 4 * t * t * t) / L];
        for (const [ids, sign] of [[[1, 5, 7, 11, 12], [1, 1, 1, 1, 1]], [[2, 4, 8, 10, 13], [1, -1, 1, -1, 1]]])
          for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) g[ids[i]][ids[j]] += w * N * d[i] * d[j] * sign[i] * sign[j];
      }
      return g;
    }
    function global12(k, T) {
      const o = zeros(12);
      for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (k[a][b]) {
        for (let i = 0; i < 12; i++) if (T[a][i]) {
          for (let j = 0; j < 12; j++) if (T[b][j]) o[i][j] += T[a][i] * k[a][b] * T[b][j];
        }
      }
      return o;
    }
    function polynomials(e) {
      const u = e.ul, L = e.L, a = e.q[0] * L * L / (2 * e.section.EA), out = [[u[0], u[6] - u[0] + a, -a, 0, 0]];
      for (const [v1, r1, v2, r2, b] of [[u[1], u[5], u[7], u[11], e.bubble35[0]], [u[2], -u[4], u[8], -u[10], e.bubble35[1]]]) out.push([v1, L * r1, -3 * v1 - 2 * L * r1 + 3 * v2 - L * r2 + b, 2 * v1 + L * r1 - 2 * v2 + L * r2 - 2 * b, b]);
      return out;
    }
    const pv = (c, t) => c.reduceRight((s, a) => s * t + a, 0), pd = (c) => c.slice(1).map((v, i) => v * (i + 1)), pi = (c) => [0, ...c.map((v, i) => v / (i + 1))];
    const ps = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0));
    const pm = (a, b) => {
      const o = new Array(a.length + b.length - 1).fill(0);
      a.forEach((v, i) => b.forEach((w, j) => o[i + j] += v * w));
      return o;
    };
    function forcePolys(e) {
      const { L, q, fl: f, N035: N } = e, [u, v, w] = e.poly35, ns = [N, -q[0] * L];
      const iv = pi(v).map((x) => q[0] * L * x), iw = pi(w).map((x) => q[0] * L * x);
      const my = ps([-f[4] + N * w[0], (-f[2] - q[4]) * L, -q[2] * L * L / 2], ps(pm(ns, w).map((x) => -x), iw.map((x) => -x)));
      const mz = ps([-f[5] - N * v[0], (f[1] - q[5]) * L, q[1] * L * L / 2], ps(pm(ns, v), iv));
      const vy = ps([-f[1], -q[1] * L], pm(ns, pd(v).map((x) => x / L)).map((x) => -x));
      const vz = ps([-f[2], -q[2] * L], pm(ns, pd(w).map((x) => x / L)).map((x) => -x));
      return { My: my, Mz: mz, Vy: vy, Vz: vz };
    }
    function at(e, x) {
      const L = e.L, t = Math.max(0, Math.min(1, x / L)), s = t * L, p = e.poly35, q = e.q, u = e.ul, f = e.fl;
      const dl = p.map((c) => pv(c, t)), dv = p.slice(1).map((c) => pv(pd(c), t) / L), rl = [(1 - t) * u[3] + t * u[9] + q[3] * s * (L - s) / (2 * e.section.GJ), -dv[1], dv[0]], glob = (a) => [0, 1, 2].map((i) => a.reduce((v, x2, j) => v + e.R[j][i] * x2, 0));
      const out = { s, N: -(f[0] + q[0] * s), Ninitial: e.N035 - q[0] * s, Vy: pv(e.forcePoly35.Vy, t), Vz: pv(e.forcePoly35.Vz, t), VyGlobal: -(f[1] + q[1] * s), VzGlobal: -(f[2] + q[2] * s), T: -(f[3] + q[3] * s), My: pv(e.forcePoly35.My, t), Mz: pv(e.forcePoly35.Mz, t), local: dl, global: glob(dl), rotation: glob(rl), second35: true };
      out.deltaH = 1e3 * Math.hypot(out.global[0], out.global[2]);
      return out;
    }
    function stations(e) {
      const polys = e.poly35, g = [0, 1, 2].map((i) => Array.from({ length: 5 }, (_, k) => polys.reduce((v, p, j) => v + e.R[j][i] * p[k], 0))), r = ps(pm(g[0], pd(g[0])), pm(g[2], pd(g[2]))), xs = Array.from({ length: 17 }, (_, i) => i / 16);
      for (const c of [...g.map(pd), r, ...Object.values(e.forcePoly35).map(pd)]) {
        const n = Math.max(...c.map(Math.abs));
        if (n > 1e-24) xs.push(...FrameEngine30.roots01(c.map((v) => v / n)));
      }
      return xs.sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1e-9).map((t) => at(e, t * e.L));
    }
    function assemble(model, loads = {}, first = null) {
      first = first || FrameEngine30.solve(model, { ...loads, capture34: true });
      if (!first.system34) first = FrameEngine30.solve(model, { ...loads, capture34: true });
      const sys = first.system34, fi = sys.fi, n = sys.K.length, nd = fi.length, K = sys.K.map((r) => Float64Array.from(r)), F = new Float64Array(n), Ffull = new Float64Array(nd), records = [], map = new Map(model.nodes.map((v, i) => [v.id, i]));
      const initial = new Map(first.elements.map((e) => [e.id, e]));
      for (const e0 of sys.records) {
        const e = { ...e0 }, old = initial.get(e.id), N0 = -old.fl[0], kg = geom14(e.L, N0, e.q[0]), bb = [0.8 * e.section.EIz / e.L ** 3, 0.8 * e.section.EIy / e.L ** 3], fb = [e.q[1] * e.L / 30, e.q[2] * e.L / 30], ktbb = bb.map((x, i) => x + kg[12 + i][12 + i]);
        if (ktbb.some((x) => !(x > 0))) throw Error("P–Δ: โหมดโก่งภายในสมาชิกเกินจุดวิกฤต (" + e.id + ")");
        const kc = zeros(12), fc = Array.from(e.fl);
        for (let a = 0; a < 12; a++) {
          for (let b = 0; b < 12; b++) kc[a][b] = kg[a][b] - kg[a][12] * kg[12][b] / ktbb[0] - kg[a][13] * kg[13][b] / ktbb[1];
          fc[a] -= kg[a][12] * fb[0] / ktbb[0] + kg[a][13] * fb[1] / ktbb[1];
        }
        const gkc = global12(kc, e.T), gfc = trmv(e.T, fc), gfa = trmv(e.T, e.fl);
        for (let a = 0; a < 12; a++) {
          const ia = fi[e.dofs[a]];
          Ffull[e.dofs[a]] += gfa[a];
          if (ia < 0) continue;
          F[ia] += gfc[a];
          for (let b = 0; b < 12; b++) {
            const ib = fi[e.dofs[b]];
            if (ib >= 0) K[ia][ib] += gkc[a][b];
          }
        }
        records.push({ ...e, N035: N0, kg35: kg, bareBubble35: bb, bubbleK35: ktbb, bubbleF35: fb });
      }
      for (const [id, q] of Object.entries(loads.node || {})) {
        const i = map.get(id);
        for (let a = 0; a < 6; a++) {
          const ix = 6 * i + a;
          Ffull[ix] += q[a];
          if (fi[ix] >= 0) F[fi[ix]] += q[a];
        }
      }
      return { first, sys, K, F: Array.from(F), Ffull: Array.from(Ffull), records, map };
    }
    function solve(model, loads = {}, options = {}) {
      const a = assemble(model, loads, options.first), { sys, records, map } = a, fac = factor(a.K), ur = fac.solve(a.F), u = sys.fi.map((i) => i < 0 ? 0 : ur[i]), nd = u.length, res = new Array(nd).fill(0), geomMoment = [0, 0, 0];
      const elements = records.map((e) => {
        const ul = mv(e.T, e.dofs.map((i) => u[i])), b = e.bubbleK35.map((k, j) => (e.bubbleF35[j] - dot(e.kg35[12 + j].slice(0, 12), ul)) / k), all = [...ul, ...b], fl = mv(e.k, ul).map((v, i) => v + dot(e.kg35[i], all) - e.fl[i]), fg = trmv(e.T, fl);
        for (let i = 0; i < 12; i++) res[e.dofs[i]] += fg[i];
        const er = { ...e, ul, fl, fg, bubble35: b, second35: true };
        er.poly35 = polynomials(er);
        er.forcePoly35 = forcePolys(er);
        er.stations = stations(er);
        const ng = e.N035 - e.q[0] * e.L, ints = er.poly35.slice(1).map((p) => ng * pv(p, 1) - e.N035 * p[0] + e.q[0] * e.L * pv(pi(p), 1)), mg = [0, -ints[1], ints[0]];
        for (let i = 0; i < 3; i++) geomMoment[i] += mg.reduce((v, x, j) => v + x * e.R[j][i], 0);
        return er;
      });
      const springs = (model.springs || []).map((s) => {
        const i = 6 * map.get(s.i) + s.dof, j = 6 * map.get(s.j) + s.dof, du = u[j] - u[i];
        res[i] -= s.k * du;
        res[j] += s.k * du;
        return { ...s, relative: du, actionOnI: s.k * du };
      });
      for (const [id, q] of Object.entries(loads.node || {})) {
        const i = map.get(id);
        for (let k = 0; k < 6; k++) res[6 * i + k] -= q[k];
      }
      const grouped = /* @__PURE__ */ new Map();
      res.forEach((v, i) => grouped.set(sys.group[i], (grouped.get(sys.group[i]) || 0) + v));
      const freeResidual = Math.max(0, ...sys.free.map((i) => Math.abs(grouped.get(i) || 0))), taken = /* @__PURE__ */ new Set();
      const nodeResults = model.nodes.map((v, i) => ({ id: v.id, p: v.p, u: u.slice(6 * i, 6 * i + 6), reaction: Array.from({ length: 6 }, (_, j) => {
        var _a;
        const root = sys.group[6 * i + j];
        if (!((_a = v.fix) == null ? void 0 : _a[j]) || taken.has(root)) return 0;
        taken.add(root);
        return grouped.get(root) || 0;
      }) }));
      let reaction = new Array(6).fill(0), deformed = new Array(6).fill(0);
      model.nodes.forEach((n, i) => {
        const r = nodeResults[i].reaction, force = a.Ffull.slice(6 * i, 6 * i + 6), pos = n.p.map((v, k) => v + u[6 * i + k]);
        reaction = add(reaction, [...r.slice(0, 3), ...add(r.slice(3), cross(n.p, r.slice(0, 3)))]);
        const net = add(r, force);
        deformed = add(deformed, [...net.slice(0, 3), ...add(net.slice(3), cross(pos, net.slice(0, 3)))]);
      });
      const original = add(a.first.applied, reaction), eq = original.map((v, i) => v - (i >= 3 ? geomMoment[i - 3] : 0)), scale = Math.max(1, ...a.first.applied.map(Math.abs));
      if (freeResidual > 2e-6 * scale || eq.some((x) => Math.abs(x) > 2e-6 * scale)) throw Error("P–Δ: residual เชิงสมการไม่ผ่าน; ไม่ส่งผลต่อ");
      const nchange = Math.max(0, ...elements.map((e) => Math.abs(-e.fl[0] - e.N035) / (1 + Math.abs(e.N035)))), maxrot = Math.max(...nodeResults.map((n) => Math.hypot(...n.u.slice(3)))), result = { version: 35, order: "initial-stress", nodeResults, elements, springs, applied: a.first.applied, reaction, equilibrium: eq, equilibriumOriginal35: original, geometricMoment35: geomMoment, deformedEquilibrium35: deformed, freeResidual, minScaledPivot: fac.pivot, ndof: nd, freeDOF: ur.length, axialFreezeChange35: nchange, maxRotation35: maxrot, first35: { nodeResults: a.first.nodeResults, reaction: a.first.reaction }, scope35: "Elastic enriched initial-stress; N0(s) frozen per first-order case; no large rotation, yielding, imperfections or flexural-torsional buckling" };
      if (options.capture) result.system35 = { K: a.K, F: a.F, K0: sys.K, fi: sys.fi, records: elements, Ffull: a.Ffull };
      return result;
    }
    function jacobi(A) {
      const n = A.length, a = A.map((r) => Array.from(r)), v = zeros(n);
      for (let i = 0; i < n; i++) v[i][i] = 1;
      for (let sw = 0; sw < 80; sw++) {
        let change = 0;
        const scale = Math.max(1e-30, ...a.map((r, i) => Math.abs(r[i])));
        for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
          const apq = a[p][q];
          if (Math.abs(apq) < 1e-13 * scale) continue;
          change = Math.max(change, Math.abs(apq));
          const tau = (a[q][q] - a[p][p]) / (2 * apq), t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau)), c = 1 / Math.sqrt(1 + t * t), s = t * c;
          a[p][p] -= t * apq;
          a[q][q] += t * apq;
          a[p][q] = a[q][p] = 0;
          for (let k = 0; k < n; k++) {
            if (k !== p && k !== q) {
              const kp = a[k][p], kq = a[k][q];
              a[k][p] = a[p][k] = c * kp - s * kq;
              a[k][q] = a[q][k] = s * kp + c * kq;
            }
            const vp = v[k][p], vq = v[k][q];
            v[k][p] = c * vp - s * vq;
            v[k][q] = s * vp + c * vq;
          }
        }
        if (change < 1e-12 * scale) break;
      }
      const j = a.reduce((best, r, i) => r[i] > a[best][best] ? i : best, 0);
      return { lambda: a[j][j], vector: v.map((r) => r[j]) };
    }
    function buckling(model, loads = {}, options = {}) {
      const first = FrameEngine30.solve(model, { ...loads, capture34: true }), sys = first.system34, byId = new Map(first.elements.map((e) => [e.id, e]));
      const a = { sys, records: sys.records.map((e) => {
        const N0 = -byId.get(e.id).fl[0];
        return { ...e, N035: N0, kg35: geom14(e.L, N0, e.q[0]), bareBubble35: [0.8 * e.section.EIz / e.L ** 3, 0.8 * e.section.EIy / e.L ** 3] };
      }) }, n = a.sys.K.length, nb = a.records.length * 2, N = n + nb, Kg = zeros(N), kb = [];
      for (let k = 0; k < a.records.length; k++) {
        const e = a.records[k], g = global12(e.kg35, e.T);
        for (let i = 0; i < 12; i++) {
          const x = a.sys.fi[e.dofs[i]];
          if (x < 0) continue;
          for (let j = 0; j < 12; j++) {
            const y = a.sys.fi[e.dofs[j]];
            if (y >= 0) Kg[x][y] += g[i][j];
          }
        }
        for (let b = 0; b < 2; b++) {
          const z = n + 2 * k + b;
          kb.push(e.bareBubble35[b]);
          Kg[z][z] += e.kg35[12 + b][12 + b];
          const gc = trmv(e.T, e.kg35.slice(0, 12).map((r) => r[12 + b]));
          for (let i = 0; i < 12; i++) {
            const x = a.sys.fi[e.dofs[i]];
            if (x >= 0) {
              Kg[x][z] += gc[i];
              Kg[z][x] += gc[i];
            }
          }
        }
      }
      if (a.records.every((e) => Math.min(e.N035, e.N035 - e.q[0] * e.L) >= -1e-10)) return { alpha: null, converged: true, reason: "ไม่มีแรงอัดตั้งต้นในกรณีนี้ / ไม่มี critical multiplier บวกจาก Kg ชุดนี้", residual: 0, iterations: 0, kind: "elastic-initial-stress", canIssue: false };
      const f = factor(a.sys.K), sc = [...f.sc, ...kb.map(Math.sqrt)], lower = (x) => [...f.lower(x.slice(0, n)), ...x.slice(n)], upper = (x) => [...f.upper(x.slice(0, n)), ...x.slice(n)];
      const op = (v) => {
        const u = upper(v).map((x, i) => x / sc[i]), z = mv(Kg, u).map((x, i) => -x / sc[i]);
        return lower(z);
      };
      const Q = [], diag = [], off = [];
      let q = Array.from({ length: N }, (_, i) => Math.sin((i + 1) * 1.273) + Math.cos((i + 1) * 0.319)), qn = norm(q);
      q = q.map((v) => v / qn);
      let beta = 0, ritz = null;
      for (let it = 0; it < Math.min(N, 90); it++) {
        Q.push(q);
        let z = op(q), aa = dot(q, z);
        diag.push(aa);
        z = z.map((x, i) => x - aa * q[i] - (it ? beta * Q[it - 1][i] : 0));
        for (let pass = 0; pass < 2; pass++) for (const old of Q) {
          const w = dot(old, z);
          z = z.map((x, i) => x - w * old[i]);
        }
        beta = norm(z);
        if (it >= 5 || beta < 1e-13) {
          const tri = zeros(diag.length);
          diag.forEach((x, i) => {
            tri[i][i] = x;
            if (i) {
              tri[i][i - 1] = tri[i - 1][i] = off[i - 1];
            }
          });
          ritz = jacobi(tri);
          const err = beta * Math.abs(ritz.vector.at(-1)), rel = err / Math.max(1e-30, Math.abs(ritz.lambda));
          if (rel < 1e-8 || beta < 1e-13) {
            const phi = Array.from({ length: N }, (_, i) => Q.reduce((s, v, j) => s + v[i] * ritz.vector[j], 0)), az = op(phi), res = norm(az.map((x, i) => x - ritz.lambda * phi[i])) / Math.max(1e-30, norm(az));
            if (res < 2e-7) {
              const out = { alpha: ritz.lambda > 1e-12 ? 1 / ritz.lambda : null, eigenvalue: ritz.lambda, residual: res, iterations: it + 1, converged: true, kind: "elastic-initial-stress", scope: "Scale all initial axial forces proportionally; not factor of safety or member resistance", canIssue: false };
              if (options.capture) out.matrices = { K0: a.sys.K, Kg, bubbleK: kb };
              return out;
            }
          }
        }
        off.push(beta);
        if (beta < 1e-15) break;
        q = z.map((v) => v / beta);
      }
      throw Error("Eigen-buckling ยังไม่ลู่เข้า — ไม่แสดงตัวคูณวิกฤตที่ไม่ตรวจ residual");
    }
    return { version: 35, geom14, assemble, solve, at, polynomials, forcePolys, stations, factor, buckling };
  })();
  function frameCenterStations30(analysis, g) {
    const out = [];
    for (const e of analysis.elements.filter((e2) => e2.group === "C1" || e2.group === "C2")) {
      const ni = analysis.nodeResults.find((n) => n.id === e.i);
      for (const p of e.stations) {
        const force = [p.N, p.Vy, p.Vz], moment = [p.T, p.My, p.Mz], glob = (a) => [0, 1, 2].map((i) => a.reduce((sum, v, j) => sum + e.R[j][i] * v, 0));
        out.push({ y: ni.p[1] + p.s, side: p.s === 0 ? "above" : "below", member: e.parent, element: e.id, N: -p.N, V: glob(force)[0], Vglobal: glob(force)[0], M: -glob(moment)[2], M1: -glob(moment)[2], M2: 0, delta: 1e3 * p.global[0], theta: -p.rotation[2] });
      }
    }
    return out.sort((a, b) => a.y - b.y || Number(a.side === "above") - Number(b.side === "above"));
  }
  function frameDemand30(analysis, g) {
    return g.frame.members.map((m) => {
      const els = analysis.elements.filter((e) => e.parent === m.id), section = m.section;
      const samples = els.flatMap((e) => e.stations.map((p) => {
        const bend = section.type === "CHS" ? Math.hypot(p.My, p.Mz) * 1e6 / section.S : Math.abs(p.My) * 1e6 / section.Sy + Math.abs(p.Mz) * 1e6 / section.Sz;
        return { ...p, s: e.s0 + p.s, element: e.id, sigma: Math.abs(p.N) * 1e3 / section.A + bend };
      }));
      const worst = samples.reduce((a, b) => a.sigma > b.sigma ? a : b), max = (k) => Math.max(...samples.map((s) => Math.abs(s[k])));
      return { id: m.id, group: m.group, L: m.L, section, worst, samples, N: max("N"), Vy: max("Vy"), Vz: max("Vz"), T: max("T"), My: max("My"), Mz: max("Mz"), deltaX: Math.max(...samples.map((s) => Math.abs(s.global[0] * 1e3))), designStatus: "REVIEW", dc: null };
    });
  }
  function windResultantStations31(analysis) {
    const mul = (a, b) => {
      const o = Array(a.length + b.length - 1).fill(0);
      a.forEach((v, i) => b.forEach((w, j) => o[i + j] += v * w));
      return o;
    };
    for (const e of analysis.elements) {
      const L = e.L, u = e.ul, q = e.q, a = q[0] * L * L / (2 * e.section.EA), polys = [[u[0], u[6] - u[0] + a, -a, 0, 0]];
      for (const [v1, r1, v2, r2, qv, EI] of [[u[1], u[5], u[7], u[11], q[1], e.section.EIz], [u[2], -u[4], u[8], -u[10], q[2], e.section.EIy]]) {
        const b = qv * L ** 4 / (24 * EI);
        polys.push([v1, L * r1, -3 * v1 - 2 * L * r1 + 3 * v2 - L * r2 + b, 2 * v1 + L * r1 - 2 * v2 + L * r2 - 2 * b, b]);
      }
      const gx = Array.from({ length: 5 }, (_, j) => polys.reduce((s, p, i) => s + p[j] * e.R[i][0], 0)), gz = Array.from({ length: 5 }, (_, j) => polys.reduce((s, p, i) => s + p[j] * e.R[i][2], 0));
      const x = mul(gx, gx.slice(1).map((v, i) => v * (i + 1))), z = mul(gz, gz.slice(1).map((v, i) => v * (i + 1))), poly = x.map((v, i) => v + z[i]), norm = Math.max(...poly.map(Math.abs));
      const roots = norm > 1e-30 ? FrameEngine30.roots01(poly.map((v) => v / norm)) : [];
      const xs = [...e.stations.map((s) => s.s), ...roots.map((t) => t * L)].sort((a2, b) => a2 - b).filter((v, i, a2) => !i || v - a2[i - 1] > 1e-9);
      e.stations = xs.map((x2) => ({ ...FrameEngine30.at(e, x2), deltaH: 1e3 * Math.hypot(...FrameEngine30.at(e, x2).global.filter((_, i) => i !== 1)) }));
    }
    return analysis;
  }
  function windResponse31(g, d, c) {
    const load = windLoads31(d, g, c), analysis = windResultantStations31(FrameEngine30.solve(g.frame.model, load.loads)), action = analysis.nodeResults.find((n) => n.id === "BASE").reaction.map((v) => -v);
    const j = analysis.elements.filter((e) => e.group === "C1").at(-1).fg.slice(6), members = frameDemand30(analysis, g), all = analysis.elements.flatMap((e) => e.stations.map((p) => ({ ...p, parent: e.parent, element: e.id, station: e.s0 + p.s })));
    const deltaWorst = all.reduce((a, b) => a.deltaH >= b.deltaH ? a : b), deltaX = Math.max(...all.map((s) => Math.abs(s.global[0] * 1e3))), deltaZ = Math.max(...all.map((s) => Math.abs(s.global[2] * 1e3))), thetaMax = Math.max(...all.map((s) => Math.hypot(...s.rotation)));
    const joint = { N: -j[1], Vglobal: j[0], V: j[0], M: -j[5], Fx: j[0], Fy: j[1], Fz: j[2], Mx: j[3], Ty: j[4], Mz: j[5], u: analysis.nodeResults.find((n) => n.id === g.frame.joint).u, spring: analysis.springs[0] || null, springs: analysis.springs };
    const stations = frameCenterStations30(analysis), response = { version: 32, frame: true, multiAxis: true, order: "first", L: g.total, V: action[0], N: -action[1], M: -action[5], M1: -action[5], Msecond: 0, Mx: action[3], Ty: action[4], Fz: action[2], deltaMax: deltaWorst.deltaH, deltaX, deltaZ, deltaWorst, thetaMax, stations, freeResidual: analysis.freeResidual, resV: analysis.equilibrium[0], resM: analysis.equilibrium[5], linearRangeWarning: deltaWorst.deltaH / (g.total * 1e3) > 0.05 || thetaMax > 0.1 };
    return { dir: load.caseId, ...load, analysis, action, response, joint, jointBelow: joint, memberDemand: members, pile: windPile31(action, d, g) };
  }
  const secondOn35 = (d) => d.headModel === "frame" && d.windMode31 === "multi" && d.analysis35 === "initial";
  const windResponseBase35 = windResponse31;
  windResponse31 = function(g, d, c) {
    if (!secondOn35(d)) return windResponseBase35(g, d, c);
    const load = windLoads31(d, g, c), f = FrameEngine30.solve(g.frame.model, { ...load.loads, capture34: true }), analysis = Second35.solve(g.frame.model, load.loads, { first: f }), first = windResultantStations31(f), action = analysis.nodeResults.find((n) => n.id === "BASE").reaction.map((v) => -v), action1 = first.nodeResults.find((n) => n.id === "BASE").reaction.map((v) => -v);
    const j = analysis.elements.filter((e) => e.group === "C1").at(-1).fg.slice(6), j1 = first.elements.filter((e) => e.group === "C1").at(-1).fg.slice(6), members = frameDemand30(analysis, g), all = analysis.elements.flatMap((e) => e.stations.map((p) => ({ ...p, parent: e.parent, element: e.id, station: e.s0 + p.s }))), all1 = first.elements.flatMap((e) => e.stations);
    const deltaWorst = all.reduce((a, b) => a.deltaH >= b.deltaH ? a : b), delta1 = Math.max(...all1.map((p) => p.deltaH)), deltaX = Math.max(...all.map((p) => Math.abs(p.global[0] * 1e3))), deltaZ = Math.max(...all.map((p) => Math.abs(p.global[2] * 1e3))), thetaMax = Math.max(...all.map((p) => Math.hypot(...p.rotation)));
    const joint = { N: -j[1], Vglobal: j[0], V: j[0], M: -j[5], Fx: j[0], Fy: j[1], Fz: j[2], Mx: j[3], Ty: j[4], Mz: j[5], u: analysis.nodeResults.find((n) => n.id === g.frame.joint).u, spring: analysis.springs[0] || null, springs: analysis.springs };
    const byId = new Map(first.elements.map((e) => [e.id, e])), stations = [];
    for (const e of analysis.elements.filter((e2) => e2.group === "C1" || e2.group === "C2")) {
      const ni = analysis.nodeResults.find((n) => n.id === e.i), glob = (a) => [0, 1, 2].map((i) => a.reduce((v, x, j2) => v + e.R[j2][i] * x, 0));
      for (const p of e.stations) {
        const a1 = FrameEngine30.at(byId.get(e.id), p.s), m = -glob([p.T, p.My, p.Mz])[2], m1 = -glob([a1.T, a1.My, a1.Mz])[2];
        stations.push({ y: ni.p[1] + p.s, side: p.s === 0 ? "above" : "below", member: e.parent, element: e.id, N: -p.N, V: glob([p.N, p.Vy, p.Vz])[0], Vglobal: glob([p.N, p.VyGlobal, p.VzGlobal])[0], M: m, M1: m1, M2: m - m1, delta: p.global[0] * 1e3, theta: -p.rotation[2] });
      }
    }
    stations.sort((a, b) => a.y - b.y || Number(a.side === "above") - Number(b.side === "above"));
    const comparison = { order: "initial-stress", deltaFirst: delta1, deltaInitial: deltaWorst.deltaH, amplification: delta1 > 1e-8 ? deltaWorst.deltaH / delta1 : null, actionFirst: action1, actionInitial: action, jointFirst: j1, jointInitial: j, freeResidual: analysis.freeResidual, weakEquilibrium: analysis.equilibrium, geometricMoment: analysis.geometricMoment35, originalEquilibrium: analysis.equilibriumOriginal35, axialFreezeChange: analysis.axialFreezeChange35, maxRotation: thetaMax };
    const response = { version: 35, frame: true, multiAxis: true, order: "initial-stress", L: g.total, V: action[0], N: -action[1], M: -action[5], M1: -action1[5], Msecond: action1[5] - action[5], Mx: action[3], Ty: action[4], Fz: action[2], deltaMax: deltaWorst.deltaH, deltaX, deltaZ, deltaWorst, thetaMax, stations, freeResidual: analysis.freeResidual, resV: analysis.equilibrium[0], resM: analysis.equilibrium[5], linearRangeWarning: deltaWorst.deltaH / (g.total * 1e3) > 0.05 || thetaMax > 0.1, comparison35: comparison };
    return { dir: load.caseId, ...load, analysis, action, response, joint, jointBelow: joint, memberDemand: members, pile: windPile31(action, d, g), comparison35: comparison };
  };
  let job47, inputs47, geometry47, pileAction47, loadCalls47, pileCalls47;
  function restricted47(value) {
    return new Proxy(value, { get(target, key) {
      if (typeof key === "string" && !Object.hasOwn(target, key)) throw Error("Unplanned worker input: " + key);
      return target[key];
    } });
  }
  function windLoads31(d, g, c) {
    if (d !== inputs47 || g !== geometry47 || c !== job47.caseInput || ++loadCalls47 !== 1) throw Error("Worker load contract changed");
    return job47.load;
  }
  function windPile31(action, d, g) {
    if (d !== inputs47 || g !== geometry47 || ++pileCalls47 !== 1) throw Error("Worker pile contract changed");
    pileAction47 = action;
    return null;
  }
  function computeResponse47(job) {
    job47 = job;
    inputs47 = restricted47(job.inputs);
    geometry47 = restricted47(job.geometry);
    loadCalls47 = 0;
    pileCalls47 = 0;
    try {
      const result = windResponse31(geometry47, inputs47, job.caseInput);
      if (loadCalls47 !== 1 || pileCalls47 !== 1 || result.action !== pileAction47 || result.pile !== null) throw Error("Worker response contract changed");
      if (!result.action.every(Number.isFinite) || !Number.isFinite(result.response.deltaMax)) throw Error("Non-finite worker response");
      return result;
    } finally {
      job47 = null;
      inputs47 = null;
      geometry47 = null;
      pileAction47 = null;
    }
  }
  const LEAN_PATHS = Object.freeze([["analysis", "elements"], ["response", "stations"]]);
  function stripLean(result) {
    for (const [a, b] of LEAN_PATHS) if ((result == null ? void 0 : result[a]) && typeof result[a] === "object") delete result[a][b];
    return result;
  }
  self.onmessage = ({ data }) => {
    const { id, job } = data;
    try {
      self.postMessage({ id, result: job.jobs.map((j) => job.lean ? stripLean(computeResponse47(j)) : computeResponse47(j)) });
    } catch (error) {
      self.postMessage({ id, error: error.message });
    }
  };
})();
