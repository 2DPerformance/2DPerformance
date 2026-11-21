/* ============================================================
   ck-report.js — ช่างคิด Academic Calculation Report engine (CKR)
   เล่มรายการคำนวณสไตล์การบ้านวิศวกรรม: ขาวสะอาด สี minimal,
   แสดงสูตร → แทนค่า → ผลลัพธ์ ทุกขั้นตอน + อ้างอิงมาตรฐาน,
   รูป 2D/FBD จากหน้าจอ, ตารางตรวจสอบ, ข้อสมมติฐาน/ความเสี่ยง.
   Export: พิมพ์/PDF (print isolation) + Word (.doc, SVG→PNG).
   API:
     CKR.show(model)
     model = {
       meta:{app,code,std,sheetNo},
       sections:[{title, items:[item...]}],
       checks:[{t,ref,ok,d,util}],          // optional summary table
       assumptions:[string...],              // ข้อสมมติฐาน + ความเสี่ยง
       figures:'auto' | [{svg,caption}]      // 'auto' = harvest #dwgArea svg
     }
     item types:
       {type:'given',  label, value}                                   ข้อมูลออกแบบ
       {type:'step',   no, title, formula, sub, result, unit, ref, ok} ขั้นตอน (formula/sub = HTML)
       {type:'note',   text}
       {type:'table',  head:[...], rows:[[...]]}
       {type:'fig',    svg, caption}
   ============================================================ */
(function (root) {
  'use strict';
  var MODEL = null;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ---------- mathify: ทำสูตร/แทนค่า ให้อ่านง่ายเชิงคณิตศาสตร์ (ราก √ มีขีดคลุม, สัญลักษณ์) ---------- */
  // typeset สูตร: เศษส่วนซ้อน (a/b → ตัวเศษ/ขีด/ตัวส่วน) + ราก √ เชื่อมกัน — ข้าม tag HTML + หน่วย (kg/m² ฯลฯ)
  function mathify(s) {
    if (s == null) return '';
    s = String(s).replace(/sqrt\s*\(/gi, '√(').replace(/&nbsp;|&ensp;|&emsp;/g, ' ');
    function mClose(str, i) { var o = str[i], c = o === '(' ? ')' : ']', d = 0; for (var k = i; k < str.length; k++) { var ch = str[k]; if (ch === o) d++; else if (ch === c) { d--; if (!d) return k; } } return -1; }
    function mOpen(str, i) { var c = str[i], o = c === ')' ? '(' : '[', d = 0; for (var k = i; k >= 0; k--) { var ch = str[k]; if (ch === c) d++; else if (ch === o) { d--; if (!d) return k; } } return -1; }
    var UNIT = /^\s*(m|cm|mm|km|kg|t|ton|kN|N|ksc|MPa|Pa|s|min|hr|°|ม|ซม|มม|กก|ตัน)(²|³|<sup>[^<]*<\/sup>)?\b/;
    var TC = "A-Za-z0-9.'′’²³⁰-⁹₀-₉";
    var TOKL = new RegExp("(?:[" + TC + "]|<su[bp]>[^<]*<\\/su[bp]>)+$");
    var TOKR = new RegExp("^(?:[" + TC + "]|<su[bp]>[^<]*<\\/su[bp]>)+");
    function fLeft(str, end) { var i = end; while (i > 0 && /\s/.test(str[i - 1])) i--; if (i <= 0) return null; var c = str[i - 1]; if (c === ')' || c === ']') { var k = mOpen(str, i - 1); return k < 0 ? null : { s: k, e: i, g: true }; } var m = str.slice(0, i).match(TOKL); return m ? { s: i - m[0].length, e: i, g: false } : null; }
    function fRight(str, st) { var i = st; while (i < str.length && /\s/.test(str[i])) i++; if (i >= str.length) return null; var c = str[i]; if (c === '(' || c === '[') { var cl = mClose(str, i); return cl < 0 ? null : { s: i, e: cl + 1, g: true }; } var m = str.slice(i).match(TOKR); return m ? { s: i, e: i + m[0].length, g: false } : null; }
    function frac(n, d) { return '<span class="ckr-frac" style="display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;margin:0 .2em;line-height:1.18"><span style="border-bottom:1.6px solid #111;padding:0 .4em .08em">' + n + '</span><span style="padding:.08em .4em 0">' + d + '</span></span>'; }
    var THAI = /[฀-๿]/;   // มีอักษรไทย = เป็นข้อความ (เช่น อ้างอิง "รับแรงอัด / Sec.") ไม่ใช่สูตร → ไม่ทำเศษส่วน
    function doFrac(str) { var i = 0, inT = false; while (i < str.length) { var c = str[i]; if (c === '<') inT = true; else if (c === '>') inT = false; else if (c === '/' && !inT && !UNIT.test(str.slice(i + 1))) { var L = fLeft(str, i), R = fRight(str, i + 1); if (L && R) { var n = str.slice(L.s, L.e), d = str.slice(R.s, R.e); if (L.g) n = n.slice(1, -1); if (R.g) d = d.slice(1, -1); if (!THAI.test(n) && !THAI.test(d)) { var f = frac(doFrac(n.trim()), doFrac(d.trim())); str = str.slice(0, L.s) + f + str.slice(R.e); i = L.s + f.length; inT = false; continue; } } } i++; } return str; }
    function rad(inner) { return '<span class="ckr-rad" style="display:inline-block;position:relative;white-space:nowrap;line-height:1.25;border-top:1.6px solid #111;margin:0 1px 0 .72em;padding:.18em .26em 0 .1em"><span aria-hidden="true" style="position:absolute;left:-.56em;top:-.05em;font-size:1.6em;line-height:1;font-weight:400">&#8730;</span>' + inner + '</span>'; }
    function doSqrt(str) { var out = '', i = 0; while (i < str.length) { if (str[i] === '√') { var j = i + 1; while (j < str.length && /\s/.test(str[j])) j++; var inner = null, after; if (str[j] === '(') { var cl = mClose(str, j); if (cl > 0) { inner = str.slice(j + 1, cl); after = cl + 1; } } if (inner == null) { var m = str.slice(j).match(/^([0-9]*\.?[0-9]+|[A-Za-zµσΦφρπ][A-Za-z0-9'′’.]*(?:<su[bp]>[^<]*<\/su[bp]>)?)/); if (m) { inner = m[1]; after = j + m[0].length; } } if (inner != null) { out += rad(doSqrt(inner)); i = after; continue; } } out += str[i]; i++; } return out; }
    s = doSqrt(doFrac(s));
    // symbol cleanup must NOT touch HTML tags: protect known tags so '</sub>=' is not mangled into '</sub≥' by the >=→≥ rule
    var _tg = [];
    s = s.replace(/<\/?(?:sub|sup|span|b|i|br|tspan|strong|em|small)\b[^>]*>/gi, function (t) { _tg.push(t); return '' + (_tg.length - 1) + ''; });
    s = s.replace(/<=/g, '≤').replace(/>=/g, '≥').replace(/(?:\+\/-|\+-)/g, '±').replace(/(^|[^<\w])\*($|[^\w>])/g, '$1×$2');
    return s.replace(/(\d+)/g, function (_m, i) { return _tg[+i]; });
  }

  /* ---------- viz helpers (utilization bar · chart · heatmap) — dataviz: status palette + numeric labels, thin marks, one axis ---------- */
  function num(n, d) { if (!isFinite(n)) return '—'; return (Math.abs(n) >= 100) ? String(Math.round(n)) : String(+(n).toFixed(d == null ? 2 : d)); }
  // สถานะอัตราส่วนใช้งาน (reserved status colors + label — ไม่ใช้สีอย่างเดียว)
  function statusBand(u) {
    if (!isFinite(u)) return { c: '#64748b', bg: '#e2e8f0', lab: '—' };
    if (u <= 0.75) return { c: '#15803d', bg: '#dcfce7', lab: 'ปลอดภัย' };
    if (u <= 0.90) return { c: '#a16207', bg: '#fef9c3', lab: 'พอใช้' };
    if (u <= 1.00) return { c: '#c2410c', bg: '#ffedd5', lab: 'ใกล้เต็ม' };
    return { c: '#b91c1c', bg: '#fee2e2', lab: 'เกินกำลัง' };
  }
  // self-contained (inline styles) → ใช้ได้ทุกแอปแม้ไม่ได้เปิด CKR overlay (inline report ก็เรียกได้)
  function utilBar(u) {
    var b = statusBand(u), pct = isFinite(u) ? Math.round(u * 100) : null;
    var w = isFinite(u) ? Math.max(2, Math.min(u, 1) * 100) : 0;
    return '<span class="ckr-ubar" style="display:inline-flex;align-items:center;gap:7px;min-width:104px;width:100%;vertical-align:middle">' +
      '<span style="flex:1;height:9px;min-width:50px;background:#eef1f5;box-shadow:inset 0 0 0 1px #dfe4ea;border-radius:5px;overflow:hidden">' +
      '<span style="display:block;height:100%;width:' + w.toFixed(0) + '%;background:' + b.c + ';border-radius:5px 0 0 5px"></span></span>' +
      '<b style="font-variant-numeric:tabular-nums;font-size:11px;min-width:34px;text-align:right;color:' + b.c + '">' + (pct != null ? pct + '%' : '—') + '</b></span>';
  }
  // สีไล่ระดับ (sequential blue / diverging / utilization green→amber→red)
  function _lerp(a, b, t) { function h(x, i) { return parseInt(x.substr(i, 2), 16); } function px(n) { return ('0' + Math.round(n).toString(16)).slice(-2); }
    return '#' + px(h(a,1)+(h(b,1)-h(a,1))*t) + px(h(a,3)+(h(b,3)-h(a,3))*t) + px(h(a,5)+(h(b,5)-h(a,5))*t); }
  function rampColor(t, mode) { t = Math.max(0, Math.min(1, t));
    if (mode === 'seq') return _lerp('#eff5ff', '#1e3a8a', t);
    if (mode === 'div') return t < 0.5 ? _lerp('#1d4ed8', '#eef2f7', t * 2) : _lerp('#eef2f7', '#b91c1c', (t - 0.5) * 2);
    return t < 0.5 ? _lerp('#15803d', '#eab308', t * 2) : _lerp('#eab308', '#b91c1c', (t - 0.5) * 2); }
  // ไดอะแกรมโครงสร้าง (BMD/SFD/แอ่นตัว/แรงดันดิน) — เส้น/พื้นที่ + เส้นศูนย์ + ป้ายค่าสุดขั้ว
  function chartSVG(spec) {
    var series = spec.series || []; if (!series.length) return '';
    var W = 640, H = spec.h || 240, m = { l: 54, r: 16, t: 22, b: 34 };
    var ax = [], ay = []; series.forEach(function (s) { (s.points || []).forEach(function (p) { ax.push(p[0]); ay.push(p[1]); }); });
    (spec.markPoints || []).forEach(function (p) { ax.push(p.x); ay.push(p.y); });   // จุดเดี่ยว เช่น จุดแรงกระทำบนเส้น interaction P-M
    if (!ax.length) return '';
    var x0 = Math.min.apply(0, ax), x1 = Math.max.apply(0, ax), y0 = Math.min.apply(0, ay), y1 = Math.max.apply(0, ay);
    if (spec.baseline0 !== false) { y0 = Math.min(y0, 0); y1 = Math.max(y1, 0); }
    if (y0 === y1) y1 = y0 + 1; if (x0 === x1) x1 = x0 + 1;
    var pw = W - m.l - m.r, ph = H - m.t - m.b;
    function X(x) { return m.l + (x - x0) / (x1 - x0) * pw; } function Y(y) { return m.t + (y1 - y) / (y1 - y0) * ph; }
    var yz = Y(0), s = '<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="Sarabun,sans-serif"><rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    s += '<line x1="' + m.l + '" y1="' + m.t + '" x2="' + m.l + '" y2="' + (m.t + ph) + '" stroke="#94a3b8" stroke-width="1"/>';
    s += '<line x1="' + m.l + '" y1="' + yz.toFixed(1) + '" x2="' + (m.l + pw) + '" y2="' + yz.toFixed(1) + '" stroke="#334155" stroke-width="1.2"/>';
    series.forEach(function (se) {
      var col = se.color || '#1f57a0', pts = se.points.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ');
      if (spec.kind === 'area' || se.area) s += '<polygon points="' + X(se.points[0][0]).toFixed(1) + ',' + yz.toFixed(1) + ' ' + pts + ' ' + X(se.points[se.points.length - 1][0]).toFixed(1) + ',' + yz.toFixed(1) + '" fill="' + col + '" fill-opacity="0.14"/>';
      s += '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>';
      if (spec.markExtremes !== false) { var mx = se.points.reduce(function (a, b) { return Math.abs(b[1]) > Math.abs(a[1]) ? b : a; });
        s += '<circle cx="' + X(mx[0]).toFixed(1) + '" cy="' + Y(mx[1]).toFixed(1) + '" r="2.6" fill="' + col + '"/><text x="' + X(mx[0]).toFixed(1) + '" y="' + (Y(mx[1]) + (mx[1] >= 0 ? -6 : 12)).toFixed(1) + '" font-size="10.5" font-weight="700" fill="' + col + '" text-anchor="middle">' + num(mx[1]) + (spec.yunit ? ' ' + spec.yunit : '') + '</text>'; }
    });
    (spec.markPoints || []).forEach(function (mp) { var col = mp.color || '#b91c1c';
      s += '<circle cx="' + X(mp.x).toFixed(1) + '" cy="' + Y(mp.y).toFixed(1) + '" r="3.6" fill="' + col + '" stroke="#fff" stroke-width="1.2"/>';
      if (mp.label) s += '<text x="' + (X(mp.x) + 6).toFixed(1) + '" y="' + (Y(mp.y) - 5).toFixed(1) + '" font-size="10" font-weight="700" fill="' + col + '">' + esc(mp.label) + '</text>'; });
    s += '<text x="' + (m.l + pw / 2) + '" y="' + (H - 7) + '" font-size="11" fill="#555" text-anchor="middle">' + esc(spec.xlabel || '') + '</text>';
    s += '<text x="13" y="' + (m.t + ph / 2) + '" font-size="11" fill="#555" text-anchor="middle" transform="rotate(-90 13 ' + (m.t + ph / 2) + ')">' + esc(spec.ylabel || '') + '</text>';
    s += '<text x="' + (m.l - 5) + '" y="' + (m.t + 4) + '" font-size="9.5" fill="#777" text-anchor="end">' + num(y1) + '</text><text x="' + (m.l - 5) + '" y="' + (m.t + ph) + '" font-size="9.5" fill="#777" text-anchor="end">' + num(y0) + '</text><text x="' + (m.l - 5) + '" y="' + (yz + 3).toFixed(1) + '" font-size="9.5" fill="#777" text-anchor="end">0</text>';
    s += '<text x="' + m.l + '" y="' + (m.t + ph + 13) + '" font-size="9.5" fill="#777" text-anchor="middle">' + num(x0) + '</text><text x="' + (m.l + pw) + '" y="' + (m.t + ph + 13) + '" font-size="9.5" fill="#777" text-anchor="middle">' + num(x1) + '</text>';
    return s + '</svg>';
  }
  var _hmid = 0;
  // heat map (สนามค่า เช่น โมเมนต์สองทาง/แรงดันดิน/อัตราส่วนใช้งาน) — เซลล์สี + ตัวเลข + legend
  function heatmapSVG(spec) {
    var g = spec.grid || [], nr = g.length; if (!nr) return ''; var nc = g[0].length, mode = spec.mode || 'util';
    var mn = spec.min, mx = spec.max;
    if (mn == null || mx == null) { var fl = []; g.forEach(function (r) { r.forEach(function (v) { if (isFinite(v)) fl.push(v); }); }); if (mn == null) mn = Math.min.apply(0, fl); if (mx == null) mx = Math.max.apply(0, fl); }
    if (mx === mn) mx = mn + 1;
    var dec = (Math.abs(mx) < 3 && Math.abs(mn) < 3) ? 2 : 1;   // util 0..~1.2 → 2 ตำแหน่ง · ค่าใหญ่ (แรงดัน) → 1
    var cell = Math.min(62, Math.max(26, Math.round(520 / nc))), lx = spec.rowLabels ? 74 : 8, ty = spec.colLabels ? 24 : 8;
    var W = lx + nc * cell + 14, H = ty + nr * cell + 42;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" font-family="Sarabun,sans-serif"><rect width="' + W + '" height="' + H + '" fill="#fff"/>';
    for (var i = 0; i < nr; i++) for (var j = 0; j < nc; j++) { var v = g[i][j], t = (v - mn) / (mx - mn), col = isFinite(v) ? rampColor(t, mode) : '#f1f5f9', x = lx + j * cell, y = ty + i * cell;
      s += '<rect x="' + x + '" y="' + y + '" width="' + (cell - 1.5) + '" height="' + (cell - 1.5) + '" rx="2" fill="' + col + '"/>';
      if (isFinite(v)) { var dark = (mode === 'seq' ? t > 0.5 : t > 0.55); s += '<text x="' + (x + cell / 2) + '" y="' + (y + cell / 2 + 3.5) + '" font-size="' + (cell > 40 ? 10.5 : 9) + '" font-weight="700" fill="' + (dark ? '#fff' : '#111') + '" text-anchor="middle">' + num(v, dec) + '</text>'; }
    }
    if (spec.colLabels) spec.colLabels.forEach(function (c, j) { s += '<text x="' + (lx + j * cell + cell / 2) + '" y="' + (ty - 7) + '" font-size="10" fill="#555" text-anchor="middle">' + esc(c) + '</text>'; });
    if (spec.rowLabels) spec.rowLabels.forEach(function (c, i) { s += '<text x="' + (lx - 6) + '" y="' + (ty + i * cell + cell / 2 + 3) + '" font-size="10" fill="#555" text-anchor="end">' + esc(c) + '</text>'; });
    var gy = ty + nr * cell + 14, gw = Math.min(200, nc * cell), gid = 'ckrg' + (++_hmid);
    s += '<defs><linearGradient id="' + gid + '">'; for (var k = 0; k <= 10; k++) s += '<stop offset="' + (k * 10) + '%" stop-color="' + rampColor(k / 10, mode) + '"/>'; s += '</linearGradient></defs>';
    s += '<rect x="' + lx + '" y="' + gy + '" width="' + gw + '" height="9" rx="2" fill="url(#' + gid + ')" stroke="#cbd5e1" stroke-width="0.5"/>';
    s += '<text x="' + lx + '" y="' + (gy + 21) + '" font-size="9.5" fill="#777">' + num(mn, dec) + (spec.unit ? ' ' + spec.unit : '') + '</text><text x="' + (lx + gw) + '" y="' + (gy + 21) + '" font-size="9.5" fill="#777" text-anchor="end">' + num(mx, dec) + (spec.unit ? ' ' + spec.unit : '') + '</text>';
    return s + '</svg>';
  }

  /* ---------- styles (screen + print) ---------- */
  var CSS = [
    '#ckrOvl{position:fixed;inset:0;z-index:9999;background:#e8ebf0;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none}',
    'body.ckr-open{overflow:hidden}',
    'body.ckr-open #ckrOvl{display:block}',
    '#ckrBar{position:sticky;top:0;z-index:5;background:#0f1e33;color:#fff;display:flex;align-items:center;gap:8px;padding:10px 14px;flex-wrap:wrap}',
    '#ckrBar .t{font:800 14px Sarabun,sans-serif;margin-right:auto}',
    '#ckrBar button{font:700 12.5px Sarabun,sans-serif;border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.08);color:#fff;border-radius:8px;padding:8px 14px;cursor:pointer}',
    '#ckrBar button:hover{background:rgba(255,255,255,.18)}',
    '#ckrBar button.pri{background:#F58220;border-color:#F58220}',
    '.ckr-sheet{background:#fff;max-width:205mm;margin:16px auto 60px;padding:15mm 16mm;box-shadow:0 2px 14px rgba(0,0,0,.15);color:#111;font:400 15.5px/1.72 Sarabun,sans-serif}',
    /* ราก √ มีขีดคลุม radicand (แก้ "ถอดรูทแหว่ง") */
    '.ckr-rad{border-top:2px solid #111;padding:2px 3px 0 2px;margin-left:-1px;white-space:nowrap}',
    /* header block */
    '.ckr-hd{border:1.5px solid #111;margin-bottom:14px}',
    '.ckr-hd .r1{display:flex;border-bottom:1px solid #111}',
    '.ckr-hd .brand{flex:0 0 auto;padding:8px 14px;border-right:1px solid #111;font-weight:800;font-size:15px}',
    '.ckr-hd .brand small{display:block;font-weight:600;font-size:10px;color:#555}',
    '.ckr-hd .title{flex:1;padding:8px 14px;text-align:center;font-weight:800;font-size:15px}',
    '.ckr-hd .title small{display:block;font-weight:600;font-size:10.5px;color:#555}',
    '.ckr-hd .grid{display:grid;grid-template-columns:1fr 1fr 1fr}',
    '.ckr-hd .cell{padding:5px 10px;border-right:1px solid #999;font-size:11.5px}',
    '.ckr-hd .cell:last-child{border-right:0}',
    '.ckr-hd .cell b{color:#444;font-weight:700;margin-right:6px}',
    '.ckr-hd .cell span[contenteditable]{outline:none;border-bottom:1px dotted #aaa;min-width:60px;display:inline-block}',
    /* sections */
    '.ckr-sec{margin:16px 0 6px;break-inside:avoid-page}',
    '.ckr-sec>h2{font-size:15px;font-weight:800;border-bottom:1.5px solid #111;padding-bottom:3px;margin-bottom:9px}',
    /* given */
    '.ckr-given{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0 26px}',
    '.ckr-gv{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-bottom:1px dotted #ccc;font-size:14px}',
    '.ckr-gv>span{flex:0 0 42%;min-width:0;line-height:1.42}',
    '.ckr-gv b{flex:1;min-width:0;font-weight:700;font-variant-numeric:tabular-nums;white-space:normal;text-align:right;overflow-wrap:break-word;line-height:1.42}',
    /* step */
    '.ckr-st{margin:0 0 12px;break-inside:avoid}',
    '.ckr-st .h{display:flex;gap:8px;align-items:baseline}',
    '.ckr-st .no{font-weight:800;min-width:34px}',
    '.ckr-st .ti{font-weight:700;flex:1}',
    '.ckr-st .ref{font-size:10.5px;color:#666;white-space:nowrap}',
    '.ckr-st .fx{padding:3px 0 1px 44px;font-style:italic;font-size:15.5px;letter-spacing:.2px}',
    '.ckr-st .sb{padding:1px 0 1px 44px;font-size:15px;color:#1a1a1a;font-variant-numeric:tabular-nums}',
    '.ckr-st .sb::before{content:"แทนค่า:  ";font-size:12px;color:#c2410c;font-style:normal;font-weight:700}',
    '.ckr-st .rs{padding:3px 0 0 44px;font-weight:800;font-size:15.5px;font-variant-numeric:tabular-nums}',
    '.ckr-st .rs .val{border-bottom:3px double #111;padding:0 4px}',
    '.ckr-st .rs .ok{font-weight:800;margin-left:10px}',
    '.ckr-st .rs .ok.fail{text-decoration:underline}',
    'sub,sup{font-size:.72em}',
    /* note/table/fig */
    '.ckr-note{font-size:12px;color:#333;padding:2px 0 2px 42px}',
    '.ckr-tbl{width:100%;border-collapse:collapse;margin:7px 0 11px;font-size:13px}',
    '.ckr-tbl th,.ckr-tbl td{border:1px solid #444;padding:4px 7px;text-align:right;font-variant-numeric:tabular-nums}',
    '.ckr-tbl th{background:#f2f2f2;font-weight:700;text-align:center}',
    '.ckr-tbl th:first-child,.ckr-tbl td:first-child{text-align:left}',
    '.ckr-fig{text-align:center;margin:10px 0;break-inside:avoid}',
    '.ckr-fig svg{max-width:100%;height:auto;border:1px solid #ddd}',
    '.ckr-fig .cap{font-size:11px;color:#555;margin-top:3px}',
    /* checks summary */
    '.ckr-chk td.st{text-align:center;font-weight:800}',
    /* utilization bar (status palette + length + number = never colour-alone) */
    '.ckr-ubar{display:flex;align-items:center;gap:8px}',
    '.ckr-ubar .tk{flex:1;height:9px;background:#eef1f5;box-shadow:inset 0 0 0 1px #dfe4ea;border-radius:5px;overflow:hidden;min-width:56px}',
    '.ckr-ubar .tk i{display:block;height:100%;border-radius:5px 0 0 5px}',
    '.ckr-ubar span{font-weight:800;font-variant-numeric:tabular-nums;min-width:34px;text-align:right;font-size:11px}',
    /* governing headline (hero number) */
    '.ckr-gov{display:flex;align-items:center;gap:14px;border:1px solid #e2e8f0;border-left-width:5px;border-radius:8px;padding:9px 14px;margin:2px 0 10px}',
    '.ckr-gov .big{font-size:23px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}',
    '.ckr-gov .lab{font-size:11px;color:#555;line-height:1.5}',
    '.ckr-gov .lab b{font-size:12.5px;color:#222}',
    /* report chart / heatmap */
    '.ckr-chart,.ckr-hm{text-align:center;margin:8px 0;break-inside:avoid}',
    '.ckr-chart svg,.ckr-hm svg{max-width:100%;height:auto}',
    '.ckr-chart .cap,.ckr-hm .cap{font-size:11px;color:#555;margin-top:2px}',
    /* assumptions */
    '.ckr-as{font-size:12px;color:#222;margin:0;padding-left:58px}',
    '.ckr-as li{margin:2px 0}',
    '.ckr-sign{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:26px;break-inside:avoid}',
    '.ckr-sign .bx{border-top:1px solid #111;padding-top:4px;text-align:center;font-size:11.5px;color:#444;margin-top:34px}',
    /* print isolation */
    '@media print{',
    ' body.ckr-open>*:not(#ckrOvl){display:none!important}',
    ' #ckrOvl{position:static;background:#fff;overflow:visible}',
    ' #ckrBar{display:none!important}',
    ' .ckr-sheet{box-shadow:none;margin:0 auto;padding:4mm 2mm;max-width:100%}',
    '}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById('ckrStyle')) return;
    var st = document.createElement('style'); st.id = 'ckrStyle'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------- renderers ---------- */
  function itemHTML(it) {
    if (it.type === 'given') return '<div class="ckr-gv"><span>' + it.label + '</span><b>' + it.value + '</b></div>';
    if (it.type === 'note') return '<div class="ckr-note">— ' + it.text + '</div>';
    if (it.type === 'table') {
      var h = '<table class="ckr-tbl"><thead><tr>' + it.head.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
      it.rows.forEach(function (r) { h += '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; });
      return h + '</tbody></table>';
    }
    if (it.type === 'fig') return '<div class="ckr-fig">' + it.svg + '<div class="cap">' + esc(it.caption || '') + '</div></div>';
    if (it.type === 'chart') return '<div class="ckr-chart">' + chartSVG(it) + (it.caption ? '<div class="cap">' + esc(it.caption) + '</div>' : '') + '</div>';
    if (it.type === 'heatmap') return '<div class="ckr-hm">' + heatmapSVG(it) + (it.caption ? '<div class="cap">' + esc(it.caption) + '</div>' : '') + '</div>';
    /* step */
    var s = '<div class="ckr-st"><div class="h"><span class="no">' + esc(it.no || '') + '</span><span class="ti">' + (it.title || '') + '</span>' + (it.ref ? '<span class="ref">[' + esc(it.ref) + ']</span>' : '') + '</div>';
    if (it.formula) s += '<div class="fx">' + mathify(it.formula) + '</div>';
    if (it.sub) s += '<div class="sb">' + mathify(it.sub) + '</div>';
    if (it.result != null) {
      s += '<div class="rs">∴ <span class="val">' + mathify(it.result) + (it.unit ? ' ' + mathify(it.unit) : '') + '</span>';
      if (it.ok === true) s += '<span class="ok">→ ผ่าน ✓</span>';
      else if (it.ok === false) s += '<span class="ok fail">→ ไม่ผ่าน ✗</span>';
      s += '</div>';
    }
    return s + '</div>';
  }

  function sheetHTML(m) {
    var d = new Date(), dstr = d.getDate() + '/' + (d.getMonth() + 1) + '/' + (d.getFullYear() + 543);
    var h = '<div class="ckr-sheet" id="ckrSheet">';
    h += '<div class="ckr-hd"><div class="r1">' +
      '<div class="brand">ช่างคิด<small>CONCRETE DESIGN · ' + esc(m.meta.code || '') + '</small></div>' +
      '<div class="title">รายการคำนวณ ' + esc(m.meta.app || '') + '<small>' + esc(m.meta.std || 'ACI 318-19 (Strength Design)') + '</small></div></div>' +
      '<div class="grid">' +
      '<div class="cell"><b>โครงการ</b><span contenteditable="true">……………………</span></div>' +
      '<div class="cell"><b>ผู้คำนวณ</b><span contenteditable="true">……………………</span></div>' +
      '<div class="cell"><b>วันที่</b><span contenteditable="true">' + dstr + '</span></div>' +
      '</div></div>';
    (m.sections || []).forEach(function (sec) {
      h += '<div class="ckr-sec">' + (sec.title ? '<h2>' + esc(sec.title) + '</h2>' : '');
      var givens = (sec.items || []).filter(function (x) { return x.type === 'given'; });
      if (givens.length) { h += '<div class="ckr-given">' + givens.map(itemHTML).join('') + '</div>'; }
      (sec.items || []).forEach(function (it) { if (it.type !== 'given') h += itemHTML(it); });
      h += '</div>';
    });
    /* figures */
    var figs = m.figures;
    if (figs === 'auto') {
      figs = [];
      document.querySelectorAll('#dwgArea svg').forEach(function (sv, i) {
        figs.push({ svg: sv.outerHTML, caption: 'รูปที่ ' + (i + 1) + ' — ' + (sv.querySelector('title') ? sv.querySelector('title').textContent : '') });
      });
    }
    if (figs && figs.length) {
      h += '<div class="ckr-sec"><h2>แบบประกอบการคำนวณ (Drawings)</h2>';
      figs.forEach(function (f) { h += itemHTML({ type: 'fig', svg: f.svg, caption: f.caption }); });
      h += '</div>';
    }
    /* checks summary */
    if (m.checks && m.checks.length) {
      var gov = m.checks.filter(function (c) { return isFinite(c.util); }).reduce(function (a, c) { return (a && a.util >= c.util) ? a : c; }, null);
      var anyFail = m.checks.some(function (c) { return c.ok === false; });
      h += '<div class="ckr-sec"><h2>สรุปผลการตรวจสอบ (Design Checks Summary)</h2>';
      if (gov) { var gb = statusBand(gov.util);
        h += '<div class="ckr-gov" style="border-left-color:' + gb.c + ';background:' + gb.bg + '66"><div class="big" style="color:' + gb.c + '">' + Math.round(gov.util * 100) + '%</div>' +
          '<div class="lab">อัตราส่วนใช้งานสูงสุด (Governing)<br>รายการ: <b>' + esc(gov.t) + '</b> · สถานะ: <b style="color:' + gb.c + '">' + gb.lab + '</b>' + (anyFail ? ' · <b style="color:#b91c1c">มีรายการไม่ผ่าน ✗</b>' : ' · <b style="color:#15803d">ผ่านทุกรายการ ✓</b>') + '</div></div>'; }
      h += '<table class="ckr-tbl ckr-chk"><thead><tr><th>รายการตรวจสอบ</th><th>อ้างอิง</th><th style="width:150px">อัตราส่วนใช้งาน</th><th>ผล</th></tr></thead><tbody>';
      m.checks.forEach(function (c) {
        h += '<tr><td>' + c.t + '</td><td style="text-align:left;font-size:10.5px">' + esc(c.ref || '') + '</td><td>' + (isFinite(c.util) ? utilBar(c.util) : '—') + '</td><td class="st" style="color:' + (c.ok ? '#15803d' : '#b91c1c') + '">' + (c.ok ? '✓' : '✗') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    /* construction summary — สรุปรายละเอียดแบบก่อสร้างจริง (ปิดท้ายทุกเล่ม) */
    if (m.construction && m.construction.length) {
      h += '<div class="ckr-sec"><h2>สรุปรายละเอียดแบบก่อสร้างจริง (Construction Detail Summary)</h2>' +
        '<table class="ckr-tbl"><thead><tr><th style="width:38%">รายการ</th><th style="text-align:left">รายละเอียดที่ใช้ก่อสร้าง</th></tr></thead><tbody>';
      m.construction.forEach(function (c) {
        h += '<tr><td>' + c.label + '</td><td style="text-align:left;font-weight:700">' + c.value + '</td></tr>';
      });
      h += '</tbody></table><div style="font-size:10.5px;color:#555">ใช้ประกอบการเขียนแบบก่อสร้าง — ระยะทาบ/งอ/ระยะหุ้ม ต้องเป็นไปตามมาตรฐานงานก่อสร้างและ spec โครงการ และผ่านการอนุมัติจากวิศวกรผู้ออกแบบ</div></div>';
    }
    /* assumptions & risks */
    if (m.assumptions && m.assumptions.length) {
      h += '<div class="ckr-sec"><h2>ข้อสมมติฐานและปัจจัยที่ต้องตรวจสอบเพิ่มเติม (Assumptions &amp; Risks)</h2><ol class="ckr-as">';
      m.assumptions.forEach(function (a) { h += '<li>' + a + '</li>'; });
      h += '</ol></div>';
    }
    h += '<div class="ckr-sign"><div class="bx">ผู้คำนวณ / Designed by</div><div class="bx">ผู้ตรวจสอบ (วิศวกรผู้มีใบอนุญาต) / Approved by</div></div>';
    h += '<div style="margin-top:14px;font-size:10px;color:#777;border-top:1px solid #ccc;padding-top:4px">เอกสารนี้จัดทำโดยเครื่องมือช่วยออกแบบ "ช่างคิด" — ผลการคำนวณต้องผ่านการตรวจสอบและลงนามรับรองโดยวิศวกรผู้ได้รับใบอนุญาตก่อนใช้ก่อสร้างจริง</div>';
    return h + '</div>';
  }

  /* ---------- overlay ---------- */
  function show(model) {
    MODEL = model; ensureStyle();
    root.CKR.lastModel = model;
    var ovl = document.getElementById('ckrOvl');
    if (!ovl) {
      ovl = document.createElement('div'); ovl.id = 'ckrOvl';
      ovl.innerHTML = '<div id="ckrBar"><span class="t">รายการคำนวณ (Calculation Report)</span>' +
        '<button class="pri" id="ckrPrint">พิมพ์ / PDF</button>' +
        '<button id="ckrWord">Word (.doc)</button>' +
        '<button id="ckrClose">ปิด ×</button></div><div id="ckrBody"></div>';
      document.body.appendChild(ovl);
      document.getElementById('ckrClose').addEventListener('click', close);
      document.getElementById('ckrPrint').addEventListener('click', function () { window.print(); });
      document.getElementById('ckrWord').addEventListener('click', word);
    }
    document.getElementById('ckrBody').innerHTML = sheetHTML(model);
    document.body.classList.add('ckr-open');
    ovl.scrollTop = 0;
  }
  function close() { document.body.classList.remove('ckr-open'); }

  /* ---------- Word (.doc) export — SVG → PNG then Word-HTML blob ---------- */
  function svgToPng(svgEl) {
    return new Promise(function (res) {
      try {
        var xml = new XMLSerializer().serializeToString(svgEl);
        var vb = svgEl.viewBox && svgEl.viewBox.baseVal;
        var w = (vb && vb.width) || 640, h = (vb && vb.height) || 420;
        var scale = Math.min(2, 1300 / w);
        var img = new Image();
        img.onload = function () {
          var cv = document.createElement('canvas'); cv.width = Math.round(w * scale); cv.height = Math.round(h * scale);
          var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
          cx.drawImage(img, 0, 0, cv.width, cv.height);
          try { res(cv.toDataURL('image/png')); } catch (e) { res(null); }
        };
        img.onerror = function () { res(null); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
      } catch (e) { res(null); }
    });
  }
  function word() {
    var sheet = document.getElementById('ckrSheet'); if (!sheet) return;
    var clone = sheet.cloneNode(true);
    var svgs = Array.prototype.slice.call(clone.querySelectorAll('svg'));
    var jobs = svgs.map(function (sv) {
      return svgToPng(sv).then(function (png) {
        if (png) { var im = document.createElement('img'); im.src = png; im.style.width = '15cm'; sv.parentNode.replaceChild(im, sv); }
        else sv.parentNode.removeChild(sv);
      });
    });
    Promise.all(jobs).then(function () {
      var wcss = 'body{font-family:"TH SarabunPSK","Sarabun","Leelawadee UI",sans-serif;font-size:14pt;color:#111}' +
        'table{border-collapse:collapse;width:100%}th,td{border:1pt solid #444;padding:3pt 6pt;font-size:11pt}' +
        'h2{font-size:14pt;border-bottom:1.5pt solid #111}.ckr-st{margin-bottom:8pt}.fx{font-style:italic}.rs{font-weight:bold}' +
        '.ckr-hd{border:1.5pt solid #111}.no{font-weight:bold}.ref{color:#666;font-size:9pt}.cap{color:#555;font-size:9pt;text-align:center}';
      var html = '﻿<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>รายการคำนวณ</title>' +
        '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->' +
        '<style>' + wcss + '</style></head><body>' + clone.innerHTML + '</body></html>';
      var blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'calc-report-' + ((MODEL && MODEL.meta && MODEL.meta.code) || 'ck').toLowerCase().replace(/[^a-z0-9-]/g, '') + '.doc';
      a.click();
    });
  }

  root.CKR = { show: show, close: close, renderModel: sheetHTML, renderItem: itemHTML, lastModel: MODEL, chartSVG: chartSVG, heatmapSVG: heatmapSVG, utilBar: utilBar, statusBand: statusBand, mathify: mathify };

  /* deferred-load safety: รายงานที่ถูกสร้างก่อน ck-report.js โหลดเสร็จ (defer) จะยังไม่ผ่าน mathify (สูตรดิบ)
     → เรียก render()/design() ซ้ำ 1 ครั้งเมื่อ engine พร้อม เพื่อให้สมการจัดหน้า (เศษส่วน/ราก) ครบทุกแท็บ */
  function _reflow() { try { var fn = root.render || root.design || root.recalc || root.calc || root.doCalc; if (typeof fn === 'function') fn(); } catch (e) {} }
  if (typeof document !== 'undefined') {
    setTimeout(_reflow, 0);
    if (typeof root.addEventListener === 'function') root.addEventListener('load', function () { setTimeout(_reflow, 0); });
  }
})(window);
