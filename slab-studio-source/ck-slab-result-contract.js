/* Concrete Design — design-result/BBS contract for slab families.
 * Values are design paths, not fabrication-frozen cut lengths. Drawing, PDF,
 * DXF and reports consume the same marks while support widths, bends and laps
 * remain explicit pre-fabrication checks.
 */
(function (root) {
  'use strict';
  if (root.__ckSlabResultContractLoaded) return;
  root.__ckSlabResultContractLoaded = true;

  var VERSION = '2026.07-slabresult2';
  function n(v, d) { v = Number(v); return isFinite(v) ? v : (d == null ? NaN : d); }
  function round(v, p) { var q = Math.pow(10, p || 0); return Math.round(n(v, 0) * q) / q; }
  function qty(widthM, spacingM) { return Math.max(2, Math.floor(n(widthM) / n(spacingM)) + 1); }
  function mass(diaMm, count, lengthM) { return round(n(count) * n(lengthM) * n(diaMm) * n(diaMm) / 162, 2); }
  function row(mark, member, code, bar, dia, spacingM, count, lengthM, note) {
    return { mark: mark, member: member, code: code, bar: bar, size: round(dia), spacing: round(spacingM * 1000),
      n: Math.round(count), Lcut: round(lengthM, 3), totMass: mass(dia, count, lengthM), note: note };
  }
  function validSpacings(values) { return values.every(function (v) { return n(v) > 0; }); }

  function twoWay(I, R, spacings) {
    spacings = Array.prototype.slice.call(spacings || [], 0, 6).map(n);
    var issues = [];
    if (spacings.length !== 6 || !validSpacings(spacings)) issues.push('TW-SPACING');
    if (!(n(I.S) > 0 && n(I.L) > 0 && n(I.dia) > 0)) issues.push('TW-GEOMETRY');
    if (issues.length) return { version: VERSION, bbs: [], ok: false, issues: issues };
    var bar = (n(I.fy) < 3000 ? 'RB' : 'DB') + n(I.dia);
    var p = R.pos || {}, extS1 = I.S / (p.c1 === 'con' ? 3 : 4), extS3 = I.S / (p.c3 === 'con' ? 3 : 4);
    var extL4 = I.L / (p.c4 === 'con' ? 3 : 4), extL6 = I.L / (p.c6 === 'con' ? 3 : 4);
    var bbs = [
      row('SL-21', 'เหล็กบนด้านสั้น · ขอบ 1', 'CK-DP', bar, I.dia, spacings[0], qty(I.L, spacings[0]), extS1, 'Design path S/' + (p.c1 === 'con' ? 3 : 4) + '; confirm support width/development'),
      row('SL-22', 'เหล็กล่างด้านสั้น · กลางช่วง', 'CK-DP', bar, I.dia, spacings[1], qty(I.L, spacings[1]), I.S, 'Full short-span design path; confirm anchorage at supports'),
      row('SL-23', 'เหล็กบนด้านสั้น · ขอบ 3', 'CK-DP', bar, I.dia, spacings[2], qty(I.L, spacings[2]), extS3, 'Design path S/' + (p.c3 === 'con' ? 3 : 4) + '; confirm support width/development'),
      row('SL-24', 'เหล็กบนด้านยาว · ขอบ 4', 'CK-DP', bar, I.dia, spacings[3], qty(I.S, spacings[3]), extL4, 'Design path L/' + (p.c4 === 'con' ? 3 : 4) + '; confirm support width/development'),
      row('SL-25', 'เหล็กล่างด้านยาว · กลางช่วง', 'CK-DP', bar, I.dia, spacings[4], qty(I.S, spacings[4]), I.L, 'Full long-span design path; confirm anchorage at supports'),
      row('SL-26', 'เหล็กบนด้านยาว · ขอบ 6', 'CK-DP', bar, I.dia, spacings[5], qty(I.S, spacings[5]), extL6, 'Design path L/' + (p.c6 === 'con' ? 3 : 4) + '; confirm support width/development')
    ];
    var spacingOK = R.sections && R.sections.length === 6 && R.sections.every(function (s, i) { return spacings[i] <= n(s.Smax) + 1e-9; });
    return { version: VERSION, bbs: bbs, ok: !!(R.chkType && R.chkThick && R.chkDepth && R.chkShear && spacingOK), issues: [] };
  }

  function cantilever(I, R, mainSpacing, distributionSpacing) {
    mainSpacing = n(mainSpacing); distributionSpacing = n(distributionSpacing);
    var issues = [];
    if (!(n(I.L) > 0 && n(I.B) > 0 && n(I.mainDia) > 0 && n(I.tempDia) > 0)) issues.push('CL-GEOMETRY');
    if (!(mainSpacing > 0 && distributionSpacing > 0)) issues.push('CL-SPACING');
    if (issues.length) return { version: VERSION, bbs: [], ok: false, issues: issues };
    var mainBar = (n(I.fy1) < 3000 ? 'RB' : 'DB') + n(I.mainDia);
    var distBar = (n(I.fy2) < 3000 ? 'RB' : 'DB') + n(I.tempDia);
    var dbcm = I.mainDia / 10, c = I.mainDia >= 22 ? 5.4 : 6.7;
    var ld = Math.max(0.30, (I.fy1 * dbcm / (c * Math.sqrt(I.fc))) / 100);
    var mainLength = Math.max(0.10, I.L - I.cov / 100 + ld);
    var hook = 12 * I.tempDia / 1000;
    var distLength = Math.max(0.10, I.B - 2 * I.cov / 100 + 2 * hook);
    var bbs = [
      row('SL-31', 'เหล็กหลักผิวบนตามแนวยื่น', 'CK-L', mainBar, I.mainDia, mainSpacing, qty(I.B, mainSpacing), mainLength, 'L - cover + calculated ld; confirm support width and bend geometry'),
      row('SL-32', 'เหล็กแจกแรงขวางแนวยื่น', 'CK-U', distBar, I.tempDia, distributionSpacing, qty(I.L, distributionSpacing), distLength, 'B - 2cover + two 12db edge tails; confirm bend allowance')
    ];
    var thicknessOK = I.mode === 'tapered' ? !!(R.chkDefl && R.chkDeflLong) : !!R.chkThick;
    var spacingOK = mainSpacing <= n(R.SmaxMain) + 1e-9 && distributionSpacing <= n(R.SmaxTemp) + 1e-9;
    return { version: VERSION, bbs: bbs, ok: !!(thicknessOK && R.chkDepth && R.chkShear && spacingOK), issues: [] };
  }

  function slabOnGround(I, R) {
    var reinforcement = R.reinf || R.mesh || {}, spacingM = n(R.spUsed), dia = n(reinforcement.dia);
    var issues = [];
    if (!(n(I.B) > 0 && n(I.L) > 0 && n(I.cov) >= 0)) issues.push('SG-GEOMETRY');
    if (!(spacingM > 0 && dia > 0)) issues.push('SG-REINFORCEMENT');
    if (issues.length) return { version: VERSION, bbs: [], ok: false, issues: issues };
    var clearB = Math.max(0.10, n(I.B) - 2 * n(I.cov) / 100);
    var clearL = Math.max(0.10, n(I.L) - 2 * n(I.cov) / 100);
    var isMesh = String(I.steelType || '').toLowerCase() === 'wm';
    var bar = isMesh ? 'WWR' + dia : ((String(I.steelType || '').toLowerCase() === 'rb' ? 'RB' : 'DB') + dia);
    var code = isMesh ? 'WWR-DP' : 'CK-00';
    var sharedNote = isMesh
      ? 'WWR placement schedule; confirm commercial sheet module, support chairs and splice/lap with manufacturer and shop drawing'
      : 'Straight design path inside cover; confirm stock length, lap/coupler and construction-joint interruption in shop drawing';
    var bbs = [
      row('SL-41', 'เหล็กควบคุมรอยร้าวทิศ X', code, bar, dia, spacingM, qty(clearL, spacingM), clearB, sharedNote),
      row('SL-42', 'เหล็กควบคุมรอยร้าวทิศ Y', code, bar, dia, spacingM, qty(clearB, spacingM), clearL, sharedNote)
    ];
    var scopeOK = I.sogScope === 'soil';
    var checksOK = !!(R.reinfOk && R.spOk && R.jointOk && R.strategyOk);
    return { version: VERSION, bbs: bbs, ok: !!(scopeOK && checksOK), issues: [] };
  }

  root.CKSlabResultContract = { version: VERSION, twoWay: twoWay, cantilever: cantilever, slabOnGround: slabOnGround,
    _test: { qty: qty, mass: mass, row: row } };
})(window);
