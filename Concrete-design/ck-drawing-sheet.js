/* ============================================================================
 * ck-drawing-sheet.js — นายช่างใหญ่ Civil Apps · Foundation Lab
 * Construction-drawing PLOT engine (Revit/AutoCAD-grade A3 sheet → vector PDF)
 *
 * - Injects a "แบบก่อสร้าง" button into the workstation appbar (no per-tool HTML).
 * - Builds an ISO-style A3 landscape sheet: border + title block + harvested
 *   rebar views (plan/section) + general notes + bar schedule (from #takeoff).
 * - Plots to vector PDF via print-to-PDF (@page A3 landscape). Self-contained,
 *   zero dependency. DISPLAY-ONLY — never touches any calculation engine.
 *
 * Optional per-tool overrides via window.CKDS_CONFIG = {
 *   title, subtitle, sheetCode, project, extraNotes:[...], viewSelector
 * }
 * ==========================================================================*/
(function () {
  'use strict';
  if (window.__ckdsLoaded) return; window.__ckdsLoaded = true;

  var MM = 96 / 25.4;                 // px per mm @96dpi
  var SHEET_W = 420, SHEET_H = 297;   // A3 landscape reference (mm)
  var CFG = function () { return window.CKDS_CONFIG || {}; };

  // ---- flexible plot state (paper / orientation / scale / mono), persisted ----
  var PAPERS = { A4: [297, 210], A3: [420, 297], A2: [594, 420], A1: [841, 594] };
  var REF_VIEWS_W = 309, REF_VIEWS_H = 240;   // A3-landscape drawing-area reference
  var DS = { paper: 'A3', orient: 'land', scale: 'auto', mono: false, north: false, grid: false };
  var CK_PW = 1, CK_PH = 1, CK_FORCE = 0, CK_NORTH = false, CK_GRID = false, CK_GX = '1', CK_GY = 'A';
  var CK_FILL = 1;   // auto-fill multiplier (grows the height budget so views fill the sheet)
  try { var sv = JSON.parse(localStorage.getItem('ckds_state') || '{}'); for (var k in sv) if (k in DS) DS[k] = sv[k]; } catch (e) {}
  function saveState() { try { localStorage.setItem('ckds_state', JSON.stringify(DS)); } catch (e) {} }
  function paperWH() {
    var p = PAPERS[DS.paper] || PAPERS.A3, lo = Math.min(p[0], p[1]), hi = Math.max(p[0], p[1]);
    return DS.orient === 'port' ? { W: lo, H: hi } : { W: hi, H: lo };
  }
  function paperGeom() {
    var d = paperWH(), inW = d.W - 16, inH = d.H - 16;
    var sideW = Math.max(56, 92 * inW / 404);
    var tbH = Math.min(40, Math.max(26, inH * 0.135));
    var oneCol = (DS.orient === 'port');
    var viewsW = inW - sideW - 3, viewsH = inH - tbH - 3;
    return { W: d.W, H: d.H, inW: inW, inH: inH, sideW: sideW, tbH: tbH, viewsW: viewsW, viewsH: viewsH, oneCol: oneCol };
  }
  // ---- persistent title-block fields (carry across all tools) ----
  var TB = { project: '', client: '', drawn: '', checked: '', approved: '', pe: '', dwgNo: '', rev: '0', gridX: '', gridY: '' };
  try { var tv = JSON.parse(localStorage.getItem('ckds_tb') || '{}'); for (var tk in tv) if (tk in TB) TB[tk] = tv[tk]; } catch (e) {}
  function saveTB() { try { localStorage.setItem('ckds_tb', JSON.stringify(TB)); } catch (e) {} }
  // company logo — SESSION-ONLY (in-memory, NO localStorage):
  // 3 states: 'brand' = นายช่างใหญ่ Civil Apps (default) → 'user' = uploaded logo → 'none' = blank
  var LOGO = { mode: 'brand', data: '' };
  function loadLogo() { return (LOGO.mode === 'user' && LOGO.data) ? LOGO.data : ''; }
  function saveLogo(d) { if (d) { LOGO.data = d; LOGO.mode = 'user'; } else { LOGO.data = ''; LOGO.mode = 'brand'; } }
  function loadRev() { try { return JSON.parse(localStorage.getItem('ckds_rev') || '[]'); } catch (e) { return []; } }
  function saveRev(a) { try { localStorage.setItem('ckds_rev', JSON.stringify(a)); } catch (e) {} }

  /* ---------- small helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function txt(sel) { var e = $(sel); return e ? (e.textContent || '').trim() : ''; }
  function val(ids) {
    for (var i = 0; i < ids.length; i++) {
      var e = document.getElementById(ids[i]);
      if (e && e.value !== undefined && e.value !== '' && isFinite(parseFloat(e.value))) return parseFloat(e.value);
    }
    return null;
  }
  function fmt(x, n) {
    if (x === null || !isFinite(x)) return '–';
    return Number(x).toLocaleString('en-US', { minimumFractionDigits: n || 0, maximumFractionDigits: n || 0 });
  }
  function thaiDate() {
    try {
      var d = new Date();
      var be = d.getFullYear() + 543;
      return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + be;
    } catch (e) { return '__ / __ / ____'; }
  }

  /* ---------- one-time CSS ---------- */
  function injectCSS() {
    if (document.getElementById('ckds-style')) return;
    var s = document.createElement('style');
    s.id = 'ckds-style';
    s.textContent = [
      '.ckds-modal{position:fixed;inset:0;z-index:2147483600;background:#11161d;display:flex;flex-direction:column;font-family:"Sarabun",-apple-system,"Segoe UI",sans-serif}',
      '.ckds-toolbar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:9px 14px;background:#0b0f14;border-bottom:1px solid #222e3c;color:#cdd9e8}',
      '.ckds-toolbar .t-title{font-weight:800;font-size:13px;letter-spacing:.3px;color:#eaf1fa}',
      '.ckds-toolbar .t-sub{font-size:11px;color:#7f93ab}',
      '.ckds-toolbar .sp{flex:1 1 auto}',
      '.ckds-toolbar button{display:inline-flex;align-items:center;gap:6px;border:1px solid #2c3a4c;background:#16202c;color:#dce7f3;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:8px;cursor:pointer;font-family:inherit}',
      '.ckds-toolbar button:hover{background:#1d2a39;border-color:#3a4d63}',
      '.ckds-toolbar button.primary{background:linear-gradient(135deg,#f58220,#ff9d4d);border-color:#f58220;color:#231300}',
      '.ckds-toolbar button.primary:hover{filter:brightness(1.05)}',
      '.ckds-toolbar select{background:#16202c;color:#dce7f3;border:1px solid #2c3a4c;border-radius:7px;padding:6px 8px;font-family:inherit;font-size:12px;font-weight:700}',
      '.ckds-stage{flex:1 1 auto;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:24px}',
      '.ckds-sheetwrap{transform-origin:top center}',
      '.ckds-sheet{width:' + SHEET_W + 'mm;height:' + SHEET_H + 'mm;background:#fff;color:#111;box-shadow:0 10px 50px rgba(0,0,0,.6);position:relative;box-sizing:border-box;padding:6mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.ckds-sheet *{-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      '.ckds-frame{position:absolute;inset:6mm;border:0.6mm solid #111;box-sizing:border-box}',
      '.ckds-inner{position:absolute;inset:8mm;display:flex;flex-direction:column;box-sizing:border-box}',
      '.ckds-cols{flex:1 1 auto;display:flex;min-height:0;gap:3mm}',
      '.ckds-views{flex:1 1 auto;min-width:0;display:grid;grid-auto-rows:min-content;gap:3mm;align-content:start;overflow:hidden;padding-right:1mm}',
      '.ckds-side{flex:0 0 92mm;display:flex;flex-direction:column;gap:3mm;border-left:0.4mm solid #111;padding-left:3mm;box-sizing:border-box;overflow:hidden}',
      '.ckds-view{border:0.2mm solid #444;padding:2mm 2mm 1mm;display:flex;flex-direction:column;background:#fff}',
      '.ckds-view .vh{display:flex;justify-content:space-between;align-items:baseline;gap:2mm;font-size:8.5pt;font-weight:800;color:#111;text-transform:uppercase;letter-spacing:.4px;border-bottom:0.25mm solid #444;padding-bottom:1mm;margin-bottom:1.5mm}',
      '.ckds-view svg{width:100%;height:auto;max-height:78mm;display:block}',
      '.ckds-view svg.ckds-scaled{width:auto!important;height:auto!important;max-width:100%;max-height:none!important;margin:0 auto}',
      '.ckds-view.scaled{align-items:center}',
      '.ckds-view.full{grid-column:1/-1}',
      '.ckds-view .vscale{font-size:7pt;font-weight:700;color:#111;white-space:nowrap;flex:0 0 auto}',
      '.ckds-view .vh .vt{flex:1 1 auto;min-width:0}',
      '.ckds-block{border:0.3mm solid #111}',
      '.ckds-block .bh{font-size:8.5pt;font-weight:800;background:#fff;color:#111;padding:1.4mm 2mm;text-transform:uppercase;letter-spacing:.5px;border-bottom:0.35mm solid #111}',
      '.ckds-notes{font-size:7.6pt;line-height:1.5;color:#1a2330;padding:1.8mm 2mm}',
      '.ckds-notes ol{margin:0;padding-left:4.2mm}',
      '.ckds-notes li{margin-bottom:.6mm}',
      '.ckds-notes b{color:#111}',
      '.ckds-bs{flex:1 1 auto;overflow:hidden}',
      '.ckds-bs .bs-scroll{padding:0}',
      // force the bar schedule to FIT the side panel — no horizontal scroll (print-static)
      '.ckds-bs .bs-scroll>div{overflow:visible!important;border-radius:0!important}',
      '.ckds-bs table{width:100%!important;min-width:0!important;border-collapse:collapse;table-layout:fixed;font-size:7pt}',
      '.ckds-bs table th{background:#f2f2f2!important;color:#111!important;border:0.25mm solid #555!important;padding:.9mm .8mm!important;font-size:6.2pt!important;font-weight:800!important;text-align:center!important;letter-spacing:0!important;text-transform:none!important;white-space:normal!important;word-break:break-word}',
      '.ckds-bs table td{border:0.25mm solid #777!important;padding:.8mm .8mm!important;font-size:6.6pt!important;color:#111!important;font-variant-numeric:tabular-nums;white-space:normal!important;word-break:break-word;overflow:hidden}',
      '.ckds-bs table td:first-child,.ckds-bs table th:first-child{text-align:left!important;width:30%}',
      '.ckds-bs table tfoot td{border-top:0.5mm solid #111!important;font-weight:800!important;background:#fff!important;color:#111!important}',
      '.ckds-bs .chips{display:none}',
      '.ckds-titleblock{flex:0 0 auto;border:0.5mm solid #111;border-top-width:0.6mm;display:flex;margin-top:3mm;font-size:7.4pt;color:#111}',
      '.ckds-tb-brand{flex:0 0 46mm;border-right:0.4mm solid #111;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:2mm;text-align:center}',
      '.ckds-tb-brand .bn{font-size:13pt;font-weight:800;color:#15304f;letter-spacing:.5px}',
      '.ckds-tb-brand .bs{font-size:6.8pt;color:#46566a;letter-spacing:1.5px;text-transform:uppercase;margin-top:.5mm}',
      '.ckds-tb-mid{flex:1 1 auto;display:flex;flex-direction:column}',
      '.ckds-tb-title{flex:1 1 auto;display:flex;flex-direction:column;justify-content:center;padding:1.4mm 3mm;border-bottom:0.4mm solid #111}',
      '.ckds-tb-title .lbl{font-size:6pt;color:#6a7888;text-transform:uppercase;letter-spacing:.6px}',
      '.ckds-tb-title .v1{font-size:12pt;font-weight:800;color:#10243c;line-height:1.15}',
      '.ckds-tb-title .v2{font-size:8pt;font-weight:700;color:#37485c;margin-top:.4mm}',
      '.ckds-tb-proj{padding:1.2mm 3mm}',
      '.ckds-tb-proj .lbl{font-size:6pt;color:#6a7888;text-transform:uppercase;letter-spacing:.6px}',
      '.ckds-tb-proj .pv{font-size:9pt;font-weight:700;color:#10243c;outline:none;min-height:11pt}',
      '.ckds-tb-proj .pv:focus{background:#fff7ec;box-shadow:0 0 0 1px #f0b46a}',
      '.ckds-tb-meta{flex:0 0 64mm;border-left:0.4mm solid #111;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr}',
      '.ckds-tb-meta .cell{border-right:0.3mm solid #8a96a4;border-bottom:0.3mm solid #8a96a4;padding:1mm 1.6mm;display:flex;flex-direction:column;justify-content:center}',
      '.ckds-tb-meta .cell:nth-child(2n){border-right:0}',
      '.ckds-tb-meta .lbl{font-size:5.6pt;color:#6a7888;text-transform:uppercase;letter-spacing:.4px}',
      '.ckds-tb-meta .v{font-size:8.6pt;font-weight:800;color:#10243c}',
      '.ckds-tb-meta .sign{min-height:7mm}',
      '.ckds-tb-meta .sign .v{font-size:7pt;font-weight:600;color:#9aa6b3}',
      '.ckds-hint{font-size:6.6pt;color:#7f93ab;text-align:center;margin-top:3px}',
      // editable title-block fields
      '.ckds-sheet .ed{outline:none;border-bottom:0.2mm dotted #b9c4d2;cursor:text;min-width:8mm;display:inline-block}',
      '.ckds-sheet .ed:focus{background:#fff7ec;border-bottom-color:#f0b46a}',
      '.ckds-sheet .ed.ph{color:#b0bac6;font-style:italic}',
      '.ckds-tb-brand .ckds-logo{max-width:42mm;max-height:13mm;object-fit:contain;display:block;margin:0 auto 1mm}',   // 13mm ≈ 48px
      // on-sheet logo controls (hidden when printing via .noprint)
      '.ckds-logoctl{display:flex;gap:1.5mm;margin-top:1.2mm;justify-content:center;flex-wrap:wrap}',
      '.ckds-logoctl button{font-family:inherit;font-size:6.4pt;font-weight:700;color:#33425c;background:#f4f7fb;border:0.2mm solid #b9c4d2;border-radius:1mm;padding:0.8mm 1.8mm;cursor:pointer;line-height:1.3}',
      '.ckds-logoctl button:hover{background:#fff7ec;border-color:#f0b46a}',
      '.ckds-tb-brand .bn.blank{min-height:9mm}',
      // revision table
      '.ckds-revtable{border:0.4mm solid #111;border-bottom:0;font-size:6.8pt;color:#111}',
      '.ckds-revtable .rt-title{font-size:6.6pt;font-weight:800;background:#fff;color:#111;padding:1mm 2mm;text-transform:uppercase;letter-spacing:.4px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.3mm solid #111}',
      '.ckds-revtable .rt-add{color:#b4540a;cursor:pointer;font-size:6.4pt}',
      '.ckds-revtable .rt-row{display:flex;border-top:0.25mm solid #999;align-items:stretch}',
      '.ckds-revtable .rt-head{font-weight:800;color:#333;background:#f2f2f2}',
      '.ckds-revtable .rt-row .c0{flex:0 0 9mm;padding:0.8mm 1.6mm;border-right:0.25mm solid #bbb;text-align:center}',
      '.ckds-revtable .rt-row .c1{flex:0 0 26mm;padding:0.8mm 1.6mm;border-right:0.25mm solid #bbb}',
      '.ckds-revtable .rt-row .c2{flex:1 1 auto;padding:0.8mm 1.6mm}',
      '.ckds-revtable .rt-row .c3{flex:0 0 7mm;display:flex;align-items:center;justify-content:center}',
      '.ckds-revtable .rt-row .c3 a{color:#d05a5a;cursor:pointer;font-weight:800}',
      '.ckds-revtable .rt-empty{color:#9aa6b3;padding:1mm 2mm;font-style:italic}',
      '.ckds-revtable .edr{outline:none;display:inline-block;min-width:6mm;min-height:8pt;cursor:text}',
      '.ckds-revtable .edr:focus{background:#fff7ec}',
      // vertical (portrait) layout: notes/schedule below the views
      '.ckds-cols.stack{flex-direction:column}',
      '.ckds-cols.stack .ckds-side{flex-basis:auto!important;border-left:0;border-top:0.4mm solid #111;padding-left:0;padding-top:2mm;flex-direction:row;gap:3mm}',
      '.ckds-cols.stack .ckds-side .ckds-block{flex:1 1 0}',
      // monochrome (black & white) plot
      '.ckds-mono svg *{stroke:#111!important}',
      '.ckds-mono svg circle{fill:#111!important}',
      '.ckds-mono svg text{fill:#111!important}',
      '.ckds-mono .bh{background:#fff!important;color:#111!important}',
      '.ckds-mono .ckds-bs table th{background:#e8e8e8!important;color:#111!important}',
      // toolbar selects/labels
      '.ckds-toolbar label{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:#aebfd2;cursor:pointer}',
      '.ckds-toolbar .grp{display:inline-flex;align-items:center;gap:6px;padding:0 8px;border-right:1px solid #222e3c}',
      '.ckds-menu{position:relative}',
      '.ckds-menu .pop{position:absolute;top:110%;right:0;background:#0e151d;border:1px solid #2c3a4c;border-radius:9px;padding:8px 10px;min-width:170px;box-shadow:0 10px 30px rgba(0,0,0,.5);z-index:5;display:none}',
      '.ckds-menu.open .pop{display:block}',
      '.ckds-menu .pop label{display:flex;gap:7px;padding:4px 2px;font-size:12px;color:#cdd9e8;white-space:nowrap}',
      '.ckds-menu .pop a{display:block;padding:7px 9px;font-size:12.5px;color:#dce7f3;white-space:nowrap;border-radius:6px;cursor:pointer;font-weight:600}',
      '.ckds-menu .pop a:hover{background:#1d2a39;color:#fff}',
      '.ckds-menu .pop .setrow{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11.5px;color:#cdd9e8;padding:3px 2px}',
      '.ckds-menu .pop .setrow a{color:#e87a7a;padding:1px 5px;cursor:pointer;flex:0 0 auto}',
      '.ckds-menu .pop .setactions{display:flex;gap:6px;border-top:1px solid #243140;margin-top:5px;padding-top:6px}',
      '.ckds-menu .pop .setactions button{flex:1;font-size:11px;padding:6px 4px;border:1px solid #2c3a4c;background:#16202c;color:#dce7f3;border-radius:6px;cursor:pointer}',
      '.ckds-menu .pop .setactions button:disabled{opacity:.4;cursor:default}',
      '.ckds-toolbar #ckdsSetCount{color:#ffd28a}',
      '.ckds-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(12px);z-index:2147483646;background:#10243c;color:#eaf1fa;border:1px solid #2c5a8c;padding:9px 16px;border-radius:10px;font-size:13px;font-weight:700;opacity:0;transition:opacity .25s,transform .25s;box-shadow:0 8px 24px rgba(0,0,0,.4)}',
      '.ckds-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}',
      '.ckds-setprint{display:none}',
      // --- mobile / tablet (≤640px): wrap the toolbar so every control is reachable ---
      '@media(max-width:640px){',
      '  .ckds-toolbar{flex-wrap:wrap;gap:6px 7px;padding:7px 9px}',
      '  .ckds-toolbar .t-title{display:none}',
      '  .ckds-toolbar .sp{display:none;flex-basis:0}',
      '  .ckds-toolbar .grp{border-right:0;padding:0 1px;gap:5px}',
      '  .ckds-toolbar button{padding:6px 9px;font-size:11.5px}',
      '  .ckds-toolbar select,.ckds-toolbar label{font-size:11px}',
      '  .ckds-toolbar button.primary{order:10}',
      '  .ckds-menu .pop{right:auto;left:0;max-width:88vw}',
      '  .ckds-stage{padding:10px}',
      '  .ckds-toast{bottom:16px;font-size:12px;padding:8px 13px}',
      '}',
      /* ---- print ---- */
      '@media print{',
      '  html.ckds-plot,html.ckds-plot body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}',
      '  html.ckds-plot body>*:not(.ckds-modal){display:none!important}',
      '  html.ckds-plot .ckds-modal{position:static!important;inset:auto!important;background:#fff!important;display:block!important}',
      '  html.ckds-plot .ckds-toolbar,html.ckds-plot .ckds-hint{display:none!important}',
      '  html.ckds-plot .ckds-stage{overflow:visible!important;padding:0!important;display:block!important}',
      '  html.ckds-plot .ckds-sheetwrap{transform:none!important;width:auto!important;height:auto!important}',
      '  html.ckds-plot .ckds-sheet{box-shadow:none!important}',   // size comes from inline style (paper-aware) + #ckds-page @page',
      '  html.ckds-setplot body>*:not(.ckds-setprint){display:none!important}',
      '  html.ckds-setplot .ckds-setprint{display:block!important}',
      '  html.ckds-setplot .ckds-setprint .setpage{page-break-after:always;break-after:page}',
      '  html.ckds-setplot .ckds-setprint .setpage:last-child{page-break-after:auto;break-after:auto}',
      '  html.ckds-setplot .ckds-setprint .ckds-sheet{box-shadow:none!important;margin:0 auto}',
      '  .ckds-sheet .noprint{display:none!important}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ---------- harvest rebar views from DOM ---------- */
  var ANALYSIS_RE = /(หน่วยแรง|stress|bmd|sfd|โมเมนต์|แรงเฉือน|heat|deformed|แอ่น|p-?m|interaction|elastic|subgrade|drag|graph|กราฟ)/i;
  function harvestViews() {
    var sel = CFG().viewSelector || '.diagram';
    var dwg = document.getElementById('sec-dwg');
    var d3 = document.getElementById('sec-3d');
    var nodes = Array.prototype.slice.call(document.querySelectorAll(sel));
    var out = [];
    nodes.forEach(function (el) {
      var svg = el.querySelector ? el.querySelector('svg') : null;
      if (!svg) return;
      if (el.offsetParent === null) return;   // skip hidden / toggled-off views
      // prefer items inside the construction-drawing section (between sec-dwg and sec-3d)
      var inDwg = true;
      if (dwg) inDwg = !!(dwg.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (d3 && inDwg) inDwg = !!(d3.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING);
      var cap = caption(el);
      if (!dwg) { // fallback: skip analysis diagrams by caption
        if (ANALYSIS_RE.test(cap)) return;
      } else if (!inDwg) {
        return;
      }
      out.push({ svg: svg, cap: cap });
    });
    return out;
  }
  function caption(el) {
    var cell = el.closest ? el.closest('.diag-cell') : null;
    var h = cell ? cell.querySelector('.diag-h') : null;
    if (!h) {
      var p = el.previousElementSibling;
      if (p && /diag-h|sec-title/.test(p.className || '')) h = p;
    }
    return h ? (h.textContent || '').trim() : '';
  }

  /* ---------- general notes from inputs ---------- */
  function gradeLbl(fy) { return (fy && fy >= 3000) ? 'SD' : 'SR'; }
  function buildNotes() {
    var fc = val(['fc']);
    var fyMain = val(['fy', 'fy1', 'fyMain']);
    var fys = val(['fys', 'fy2', 'fyt']);
    var cov = val(['cov', 'covS']);
    var li = [];
    li.push('ออกแบบตามมาตรฐาน <b>ACI 318-19</b> (วิธีกำลัง · Strength Design) ร่วมกับกฎกระทรวงฯ พ.ศ. 2566');
    if (fc !== null) li.push('กำลังอัดประลัยคอนกรีต <b>f′c = ' + fmt(fc, 0) + ' ksc</b> (ทรงกระบอก)');
    if (fyMain !== null) li.push('เหล็กเสริมหลัก <b>fy = ' + fmt(fyMain, 0) + ' ksc</b> (' + gradeLbl(fyMain) + ' · ' + (fyMain >= 3000 ? 'ข้ออ้อย DB' : 'กลม RB') + ')');
    if (fys !== null) li.push('เหล็กปลอก/แจกแรง <b>fy = ' + fmt(fys, 0) + ' ksc</b>');
    if (cov !== null) li.push('ระยะหุ้มคอนกรีต (covering) <b>= ' + fmt(cov, 1) + ' cm</b>');
    li.push('ระยะฝังยึด (l<sub>d</sub>) · ระยะทาบ (lap) · ความยาวหางงอ (hook) เป็นไปตาม ACI 318-19 บทที่ 25');
    li.push('หน่วยความยาวเป็นเมตร · เหล็กเสริมระบุเป็น <b>จำนวน-ขนาด</b> (เช่น 12-DB16)');
    var extra = CFG().extraNotes;
    if (extra && extra.length) extra.forEach(function (t) { li.push(t); });
    li.push('ผู้รับเหมาต้องตรวจสอบขนาด · ระยะ · จำนวนเหล็ก กับแบบวิศวกรรมโครงสร้างก่อนดำเนินการ และให้วิศวกรผู้ออกแบบรับรองแบบ');
    return '<ol><li>' + li.join('</li><li>') + '</li></ol>';
  }

  /* ========================================================================
   * TRUE-SCALE drawing engine — geometry in real mm, plotted to paper mm.
   * SVG carries width="Wmm" + viewBox in mm so 1 unit = 1 mm on the A3 sheet,
   * giving an exact 1:N plot. Standard arch dimension ticks + bar tags.
   * ======================================================================*/
  var SCALE_LADDER = [5, 7.5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75, 100, 125, 150, 200, 250, 300];
  function pickDenom(realW, realH, availW, availH) {
    if (CK_FORCE > 0) return CK_FORCE;                        // manual scale override
    // width capped to the column; HEIGHT budget grown by CK_FILL so drawings fill the sheet
    var uw = (availW - 28) * CK_PW, uh = (availH - 24) * CK_PH * CK_FILL;
    for (var i = 0; i < SCALE_LADDER.length; i++) {
      var d = SCALE_LADDER[i];
      if (realW / d <= uw && realH / d <= uh) return d;
    }
    return SCALE_LADDER[SCALE_LADDER.length - 1];
  }
  /* line-weight hierarchy ตาม DRAFTING-SPEC.md §1 (ISO 128 / AutoCAD CTB):
   * bar 0.60 > cut 0.50 > obj 0.35 > dash 0.25 > dim/center 0.18 > thin 0.13
   * ⚠ ห้ามเปลี่ยน hex ของ dim/thin/dash/center — dxfColor() ใช้สีจับคู่ DXF layer */
  function ST() {
    return {
      cut: 'stroke="#111" stroke-width="0.5" fill="none"',
      obj: 'stroke="#111" stroke-width="0.35" fill="none"',
      objfill: 'stroke="#111" stroke-width="0.35" fill="#fff"',
      barA: 'stroke="#c0202a" stroke-width="0.6" fill="none" stroke-linecap="round"',
      barB: 'stroke="#1656a6" stroke-width="0.6" fill="none" stroke-linecap="round"',
      dim: 'stroke="#1a1a1a" stroke-width="0.18" fill="none"',
      thin: 'stroke="#8a8a8a" stroke-width="0.13" fill="none"',
      dash: 'stroke="#555" stroke-width="0.25" fill="none" stroke-dasharray="2 1.4"',
      center: 'stroke="#555" stroke-width="0.18" fill="none" stroke-dasharray="6 1.5 1 1.5"'
    };
  }
  function mkDraw(denom) {
    var P = [], bb = [1e9, 1e9, -1e9, -1e9], S = ST();
    function ext(x, y) { if (x < bb[0]) bb[0] = x; if (y < bb[1]) bb[1] = y; if (x > bb[2]) bb[2] = x; if (y > bb[3]) bb[3] = y; }
    var d = { denom: denom, st: S };
    d.s = function (mm) { return mm / denom; };               // real mm -> paper mm
    d.line = function (x1, y1, x2, y2, st) { P.push('<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2) + '" ' + (st || S.obj) + '/>'); ext(x1, y1); ext(x2, y2); };
    d.rect = function (x, y, w, h, st) { P.push('<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(w) + '" height="' + r(h) + '" ' + (st || S.obj) + '/>'); ext(x, y); ext(x + w, y + h); };
    d.dot = function (x, y, rad, fill) { P.push('<circle cx="' + r(x) + '" cy="' + r(y) + '" r="' + r(rad) + '" fill="' + (fill || '#c0202a') + '"/>'); ext(x - rad, y - rad); ext(x + rad, y + rad); };
    d.circ = function (x, y, rad, st) { P.push('<circle cx="' + r(x) + '" cy="' + r(y) + '" r="' + r(rad) + '" ' + (st || S.obj) + '/>'); ext(x - rad, y - rad); ext(x + rad, y + rad); };
    d.text = function (x, y, s, o) {
      o = o || {}; var rot = o.rot ? (' transform="rotate(' + o.rot + ' ' + r(x) + ' ' + r(y) + ')"') : '';
      P.push('<text x="' + r(x) + '" y="' + r(y) + '" font-size="' + (o.size || 2.4) + '" fill="' + (o.color || '#111') + '" font-weight="' + (o.weight || 600) + '" text-anchor="' + (o.anchor || 'middle') + '" font-family="Sarabun,sans-serif"' + rot + '>' + s + '</text>');
      var wApprox = String(s).length * (o.size || 2.4) * 0.34;
      var ax = o.anchor === 'end' ? x - wApprox : o.anchor === 'middle' ? x : x + 0;
      ext(ax, y - (o.size || 2.4)); ext(ax + (o.anchor === 'middle' ? wApprox / 2 : wApprox), y + 1);
      if (o.anchor === 'middle') ext(x - wApprox / 2, y);
    };
    /* dimension style กลาง (DRAFTING-SPEC.md §4): tick 45° ~2 mm ·
     * extension line เว้น gap 1.0 mm จากวัตถุ + overshoot 1.2 mm พ้นเส้นบอกมิติ ·
     * ตัวเลขเหนือเส้น 0.8 mm กึ่งกลางช่วง */
    var DIM_GAP = 1.0, DIM_OS = 1.2, TICK = 1.0;
    function tick(x, y) { P.push('<line x1="' + r(x - TICK) + '" y1="' + r(y + TICK) + '" x2="' + r(x + TICK) + '" y2="' + r(y - TICK) + '" ' + S.dim + '/>'); }
    d.dimH = function (xa, xb, y, label, o) {
      o = o || {}; var ox = o.from;       // optional: draw extension lines from object edge
      if (ox != null) {
        var sg = (y >= ox) ? 1 : -1;      // ทิศจากวัตถุ → เส้นบอกมิติ
        d.line(xa, ox + sg * DIM_GAP, xa, y + sg * DIM_OS, S.dim);
        d.line(xb, ox + sg * DIM_GAP, xb, y + sg * DIM_OS, S.dim);
      }
      d.line(xa, y, xb, y, S.dim); tick(xa, y); tick(xb, y);
      d.text((xa + xb) / 2, y - 0.8, label, { size: o.size || 2.4, weight: 700 });
      ext(xa, y - 3.5); ext(xb, y + DIM_OS);
    };
    d.dimV = function (ya, yb, x, label, o) {
      o = o || {}; var oy = o.from;
      if (oy != null) {
        var sg = (x >= oy) ? 1 : -1;
        d.line(oy + sg * DIM_GAP, ya, x + sg * DIM_OS, ya, S.dim);
        d.line(oy + sg * DIM_GAP, yb, x + sg * DIM_OS, yb, S.dim);
      }
      d.line(x, ya, x, yb, S.dim); tick(x, ya); tick(x, yb);
      d.text(x - 1.1, (ya + yb) / 2, label, { size: o.size || 2.4, weight: 700, anchor: 'middle', rot: -90 });
      ext(x - 3.5, ya); ext(x + DIM_OS, yb);
    };
    d.tag = function (px, py, tx, ty, label, o) {
      o = o || {};
      d.line(px, py, tx, ty, S.thin);
      P.push('<circle cx="' + r(px) + '" cy="' + r(py) + '" r="0.5" fill="#111"/>');
      d.text(tx, ty + (o.below ? 2.6 : -0.8), label, { size: o.size || 2.3, weight: 700, anchor: o.anchor || 'middle', color: o.color || '#111' });
    };
    d.hatchConc = function (x, y, w, h) {
      // คอนกรีตถูกระนาบตัดผ่า — ANSI31 เส้นเฉียงเดี่ยว 45° ระยะห่างคงที่บนกระดาษ ~0.9 mm
      // น้ำหนัก 0.13 เทา (DRAFTING-SPEC.md §7) · เรียกก่อนวาดเหล็ก — เส้นเหล็ก 0.60 ทับ hatch ได้ชัด
      var sp = 0.9;
      for (var t = sp; t < w + h; t += sp) {
        var hx1 = x + Math.max(0, t - h), hy1 = y + Math.min(t, h);
        var hx2 = x + Math.min(t, w), hy2 = y + Math.max(0, t - w);
        P.push('<line x1="' + r(hx1) + '" y1="' + r(hy1) + '" x2="' + r(hx2) + '" y2="' + r(hy2) + '" ' + S.thin + '/>');
      }
      ext(x, y); ext(x + w, y + h);
    };
    d.hatchSoil = function (x, y, w, h) {
      P.push('<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(w) + '" height="' + r(h) + '" fill="#f4efe4" stroke="none"/>');
      for (var gx = x; gx < x + w; gx += 2.4 * denom) P.push('<line x1="' + r(gx) + '" y1="' + r(y + h) + '" x2="' + r(gx + 1.6 * denom) + '" y2="' + r(y + h - 1.6 * denom) + '" stroke="#bcae93" stroke-width="0.12"/>');
      ext(x, y); ext(x + w, y + h);
    };
    d.gridRef = function (cx, cy, x0, y0, x1, y1, labV, labH) {
      // structural grid: vertical line @cx (bubble labV at top) + horizontal @cy (bubble labH at left)
      var en = 6, br = 2.6, gst = S.center;   // เส้นกริด = chain line (SPEC §1)
      d.line(cx, y0 - en - br, cx, y1 + en, gst);
      d.line(x0 - en - br, cy, x1 + en, cy, gst);
      P.push('<circle cx="' + r(cx) + '" cy="' + r(y0 - en - br) + '" r="' + br + '" fill="#fff" stroke="#111" stroke-width="0.25"/>');
      d.text(cx, y0 - en - br + 0.9, labV, { size: 2.6, weight: 800 });
      P.push('<circle cx="' + r(x0 - en - br) + '" cy="' + r(cy) + '" r="' + br + '" fill="#fff" stroke="#111" stroke-width="0.25"/>');
      d.text(x0 - en - br, cy + 0.9, labH, { size: 2.6, weight: 800 });
      ext(cx, y0 - en - 2 * br); ext(x0 - en - 2 * br, cy); ext(x1 + en, cy); ext(cx, y1 + en);
    };
    d.northArrow = function (x, y) {      // x = centre, y = arrow tip (paper mm); points up
      P.push('<line x1="' + r(x) + '" y1="' + r(y + 8) + '" x2="' + r(x) + '" y2="' + r(y + 1.5) + '" ' + S.obj + '/>');
      P.push('<path d="M' + r(x) + ',' + r(y) + ' L' + r(x - 1.5) + ',' + r(y + 3) + ' L' + r(x + 1.5) + ',' + r(y + 3) + ' Z" fill="#111"/>');
      P.push('<circle cx="' + r(x) + '" cy="' + r(y + 8) + '" r="0.6" fill="none" stroke="#111" stroke-width="0.2"/>');
      d.text(x, y - 1.2, 'N', { size: 2.8, weight: 800 });
      ext(x - 3, y - 3.5); ext(x + 3, y + 9);
    };
    d.scaleBar = function (x, y) {        // graphic scale (SPEC §8): เลือกช่วงอัตโนมัติให้ช่องกว้าง 5–15 mm บนกระดาษ
      var STEPS = [100, 250, 500, 1000, 2000, 5000], segMm = STEPS[STEPS.length - 1];
      for (var si = 0; si < STEPS.length; si++) { if (d.s(STEPS[si]) >= 5) { segMm = STEPS[si]; break; } }
      var seg = d.s(segMm), n = 4;
      function mLbl(mm) { var m = mm / 1000; return m >= 1 ? String(Math.round(m * 100) / 100) : m.toFixed(2).replace(/0$/, ''); }
      for (var i = 0; i < n; i++) P.push('<rect x="' + r(x + i * seg) + '" y="' + r(y) + '" width="' + r(seg) + '" height="1.2" fill="' + (i % 2 ? '#fff' : '#111') + '" stroke="#111" stroke-width="0.13"/>');
      d.text(x, y + 4, '0', { size: 2, anchor: 'middle' });
      d.text(x + 2 * seg, y + 4, mLbl(2 * segMm), { size: 2, anchor: 'middle' });
      d.text(x + n * seg, y + 4, mLbl(4 * segMm) + ' m', { size: 2, anchor: 'start' });
      d.text(x, y - 1, 'SCALE 1:' + denom, { size: 1.8, anchor: 'start', color: '#555' });
      ext(x, y - 3.5); ext(x + n * seg, y + 5);
    };
    d.finish = function () {
      var pad = 3;
      var x0 = bb[0] - pad, y0 = bb[1] - pad, w = (bb[2] - bb[0]) + 2 * pad, h = (bb[3] - bb[1]) + 2 * pad;
      if (!isFinite(w) || w <= 0) { x0 = 0; y0 = 0; w = 10; h = 10; }
      return {
        svg: '<svg class="ckds-scaled" data-denom="' + denom + '" xmlns="http://www.w3.org/2000/svg" width="' + w.toFixed(1) + 'mm" height="' + h.toFixed(1) + 'mm" viewBox="' + x0.toFixed(2) + ' ' + y0.toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2) + '">' + P.join('') + '</svg>',
        denom: denom, w: w, h: h
      };
    };
    function r(v) { return (Math.round(v * 100) / 100); }
    return d;
  }
  function fmtM(mm) { return (mm / 1000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* ---------- per-tool scaled adapters (keyed by sheet code) ---------- */
  var SCALED_ADAPTERS = {
    'FT-01': footingMat,   // soil-bearing footing
    'FT-02': footingPile,  // 1-pile cap
    'FT-03': footingPile,  // 2-pile cap
    'CL-01': columnDetail,
    'SL-01': slabOneWay,
    'SL-02': slabTwoWay,
    'SL-03': slabCantilever,
    'BM-01': beamSections,
    'BM-02': femSections,
    'SL-04': slabOnGround
  };
  function intId(id) { var e = document.getElementById(id); return e ? (parseInt(e.value, 10) || 0) : 0; }
  function parseNum(sel) { var t = txt(sel); var m = t.match(/-?[\d.]+/); return m ? parseFloat(m[0]) : null; }
  function scaledViewsFor(code) {
    var fn = SCALED_ADAPTERS[code]; if (!fn) return null;
    try { var a = fn(); return (a && a.length) ? a : null; } catch (e) { return null; }
  }

  // Bearing / pile-cap mat footing: PLAN (two-way bottom mat) + SECTION
  function footingMat() {
    var A = val(['A']), B = val(['B']);
    if (!(A > 0 && B > 0)) return null;
    var Amm = A * 1000, Bmm = B * 1000;
    var T = (val(['T']) || 30) * 10, cov = (val(['cov']) || 7.5) * 10;
    var H = (val(['H']) || 0) * 1000;
    var dM = val(['dMain']) || 16, nA = Math.max(2, val(['nA']) || 0), nB = Math.max(2, val(['nB']) || 0);
    var fy = val(['fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    var sA = (Bmm - 2 * cov) / (nA - 1), sB = (Amm - 2 * cov) / (nB - 1);  // bar pitch (mm)
    var out = [];
    var secH = T + 800;                                  // section vertical extent (stub above + lean + soil)
    // shared scale so plan & section plot at the SAME 1:N
    var DN = Math.max(pickDenom(Amm, Bmm, 150, 96), pickDenom(Amm, secH, 150, 92));

    /* ---- PLAN ---- */
    (function () {
      var dn = DN;
      var d = mkDraw(dn), W = d.s(Amm), Hh = d.s(Bmm), c = d.s(cov);
      d.rect(0, 0, W, Hh, d.st.objfill);
      // A-direction bars (parallel to long side A → horizontal), nA across B
      for (var i = 0; i < nA; i++) { var y = c + i * (Hh - 2 * c) / (nA - 1); d.line(c, y, W - c, y, d.st.barA); }
      // B-direction bars (parallel to B → vertical), nB across A
      for (var j = 0; j < nB; j++) { var x = c + j * (W - 2 * c) / (nB - 1); d.line(x, c, x, Hh - c, d.st.barB); }
      d.dimH(0, W, Hh + 7, fmtM(Amm) + ' (A)', { from: Hh });
      d.dimV(0, Hh, -7, fmtM(Bmm) + ' (B)', { from: 0 });
      d.tag(W * 0.30, c, W * 0.30, -3.5, nA + '–' + bl + dM + ' ทิศ A @' + fmtM(sA), { anchor: 'middle' });
      d.tag(c, Hh * 0.70, -4, Hh * 0.70, nB + '–' + bl + dM, { anchor: 'end' });
      d.text(W / 2, -11, 'แปลนเหล็กล่าง · BOTTOM MAT PLAN', { size: 2.7, weight: 800, color: '#111' });
      if (CK_GRID) d.gridRef(W / 2, Hh / 2, 0, 0, W, Hh, CK_GX, CK_GY);
      if (CK_NORTH) d.northArrow(W + 4, -3);
      d.scaleBar(0, Hh + 12);
      out.push({ cap: 'แปลนเหล็กล่าง · Bottom Mat Plan', svg: d.finish().svg, denom: dn });
    })();

    /* ---- SECTION (cut along A) ---- */
    (function () {
      var dn = DN;
      var d = mkDraw(dn), W = d.s(Amm), th = d.s(T), c = d.s(cov);
      var soilTop = -d.s(Math.min(Math.max(0, H - T) || 250, 450) + 250); // ground/stub above footing top
      var yTop = 0, yBot = th;
      // lean concrete (nominal 5cm)
      var lean = d.s(50);
      d.rect(-d.s(80), yBot, W + d.s(160), lean, 'stroke="#999" stroke-width="0.25" fill="#eef0f2"');
      // soil hatch left/right + above (simplified band above footing)
      d.hatchSoil(-d.s(120), soilTop, d.s(120), (yBot + lean) - soilTop);
      d.hatchSoil(W, soilTop, d.s(120), (yBot + lean) - soilTop);
      // footing body — คอนกรีตถูกตัด → hatch ANSI31 45° เต็มหน้าตัด (DRAFTING-SPEC §7)
      d.rect(0, yTop, W, th, d.st.objfill);
      d.hatchConc(0, yTop, W, th);
      // nominal column stub (centered) dashed
      var cw = d.s(Math.min(Amm, Bmm) * 0.28);
      d.rect(W / 2 - cw / 2, soilTop, cw, -yTop - soilTop, d.st.dash);
      d.text(W / 2, soilTop - 1.5, 'เสา (ดูแบบเสา)', { size: 2.1, color: '#555' });
      // bottom bars: A-direction = dots row near bottom (cut), B-direction = long line above the dots
      var ybar = yBot - c;
      d.line(c, ybar, W - c, ybar, d.st.barB);                 // B-bar (longitudinal, drawn continuous)
      var rdot = Math.max(0.5, d.s(dM) / 2 + 0.2);
      for (var i = 0; i < nA; i++) { var x = c + i * (W - 2 * c) / (nA - 1); d.dot(x, ybar - rdot - 0.3, rdot, '#c0202a'); }
      // ground line
      d.line(-d.s(120), soilTop, W + d.s(120), soilTop, 'stroke="#7a6f57" stroke-width="0.3" fill="none"');
      d.text(W + d.s(120), soilTop - 1, 'ระดับดิน', { size: 2, anchor: 'end', color: '#7a6f57' });
      // dims
      d.dimV(yTop, yBot, -6, 'T=' + (T / 10).toFixed(0) + ' cm', { from: 0 });
      d.dimH(0, W, yBot + lean + 7, fmtM(Amm), { from: yBot + lean });
      d.tag(W / 2, ybar - rdot - 0.3, W * 0.5, yBot + 4, 'เหล็กล่าง ' + nA + '–' + bl + dM + ' (ทิศ A)', { anchor: 'middle', below: true });
      d.text(c + 1, yBot - c + rdot + 2.6, 'หุ้ม ' + (cov / 10).toFixed(1) + ' cm', { size: 1.9, anchor: 'start', color: '#444' });
      d.text(W / 2, soilTop - 5, 'รูปตัด · SECTION (ตัดตามทิศ A)', { size: 2.7, weight: 800, color: '#111' });
      d.scaleBar(0, yBot + lean + 12);
      out.push({ cap: 'รูปตัด · Section', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }

  // Pile cap (1 or 2 piles, auto-detected): PLAN + SECTION
  function footingPile() {
    var A = val(['A']), B = val(['B']); if (!(A > 0 && B > 0)) return null;
    var Amm = A * 1000, Bmm = B * 1000;
    var T = (val(['T']) || 70) * 10, cov = (val(['cov']) || 7.5) * 10;
    var dM = val(['dMain']) || 16, nA = Math.max(2, val(['nA']) || 0), nB = Math.max(2, val(['nB']) || 0);
    var pileD = (val(['pileD']) || 26) * 10;
    var _pt = document.getElementById('pileType'); var isRnd = !!(_pt && _pt.value && _pt.value.indexOf('O-') === 0);
    var pLbl = (isRnd ? '⌀' : 'I-');   // ป้ายชนิดเข็ม: กลม ⌀ · ตัวไอ I-
    var col = (val(['a1']) || 25) * 10, colB = (val(['b1col']) || (col / 10)) * 10;
    var pEl = document.getElementById('pileSp');
    var pileSp = (pEl && parseFloat(pEl.value) > 0) ? parseFloat(pEl.value) * 1000 : 0;
    var piles = pileSp > 0 ? [Amm / 2 - pileSp / 2, Amm / 2 + pileSp / 2] : [Amm / 2];
    var fy = val(['fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    // 1-pile (FT-02) draws a full cage matching footing-1pile.html 3D; 2-pile (FT-03) draws the STM cage matching footing-2pile.html
    var is1Pile = (piles.length === 1);
    var pat = (document.querySelector('input[name="pat"]:checked') || {}).value || 'A';   // 'A'=แบบ ก tall-U · 'C'=แบบ ข ⊓ cage
    var dTie = intId('dTie') || 6, nHoopIn = intId('nHoop') || 0;
    var nStirIn = intId('nStir') || 0;   // FT-03 vertical stirrup count (0 = auto from geometry)
    var nStir2 = nStirIn > 0 ? nStirIn : Math.max(3, Math.round((Amm - 2 * cov) / Math.min((T - cov) / 5, 300)) + 1);
    var sA = (Bmm - 2 * cov) / (nA - 1), out = [];
    var secH = T + 1100;
    var DN = Math.max(pickDenom(Amm, Bmm, 150, 96), pickDenom(Amm, secH, 150, 92));

    (function () {  // PLAN
      var d = mkDraw(DN), W = d.s(Amm), H = d.s(Bmm), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill);
      for (var i = 0; i < nA; i++) { var y = c + i * (H - 2 * c) / (nA - 1); d.line(c, y, W - c, y, d.st.barA); }
      for (var j = 0; j < nB; j++) { var x = c + j * (W - 2 * c) / (nB - 1); d.line(x, c, x, H - c, d.st.barB); }
      // piles (below → dashed square)
      var pd = d.s(pileD);
      var IP = window.IPILE || {};
      piles.forEach(function (px) {
        var x = d.s(px), cyp = H / 2;
        if (isRnd) { d.circ(x, cyp, pd / 2, d.st.dash); }
        else {   // หน้าตัดตัวไอ (I-pile มอก.396) ตรงกับโมเดล 3D — เส้นบัง dash (เข็มอยู่ใต้ฐาน)
          var sp = IP[Math.round(pileD / 10)] || {}, K = (sp.K != null ? sp.K : 0.33 * pileD), N = (sp.N != null ? sp.N : 0.42 * pileD), U = (sp.U != null ? sp.U : 0.40 * pileD);
          var hb = pileD / 2, hu = U / 2, xK = hb - K, xN = hb - N;
          var P0 = [[-hb, -hb], [-hb, hb], [-xK, hb], [-xN, hu], [xN, hu], [xK, hb], [hb, hb], [hb, -hb], [xK, -hb], [xN, -hu], [-xN, -hu], [-xK, -hb], [-hb, -hb]];
          for (var kk = 0; kk < P0.length - 1; kk++) d.line(x + d.s(P0[kk][0]), cyp + d.s(P0[kk][1]), x + d.s(P0[kk + 1][0]), cyp + d.s(P0[kk + 1][1]), d.st.dash);
        }
      });
      // column (on top → solid thin)
      var cw = d.s(col), cb = d.s(colB);
      d.rect(W / 2 - cw / 2, H / 2 - cb / 2, cw, cb, 'stroke="#111" stroke-width="0.35" fill="none"');
      // 1-pile: closed-hoop rectangle + ⊓-vertical dots + column-dowel dots (match 3D cage)
      if (is1Pile) {
        var rdm = Math.max(0.5, d.s(dM) / 2 + 0.2), hi = c + d.s(dM);
        d.rect(hi, hi, W - 2 * hi, H - 2 * hi, d.st.barB);              // ปลอกรัดรอบ (closed hoop)
        if (pat === 'C') {                                             // ⊓ wall-bar verticals → 8 perimeter dots
          var mx = W / 2, my = H / 2;
          [[hi, hi], [W - hi, hi], [W - hi, H - hi], [hi, H - hi], [mx, hi], [mx, H - hi], [hi, my], [W - hi, my]]
            .forEach(function (p) { d.dot(p[0], p[1], rdm, '#1656a6'); });
        }
        var dwIn = d.s(Math.min(30, col * 0.15));                      // 4 column-dowel dots near column corners
        [[W / 2 - cw / 2 + dwIn, H / 2 - cb / 2 + dwIn], [W / 2 + cw / 2 - dwIn, H / 2 - cb / 2 + dwIn], [W / 2 - cw / 2 + dwIn, H / 2 + cb / 2 - dwIn], [W / 2 + cw / 2 - dwIn, H / 2 + cb / 2 - dwIn]]
          .forEach(function (p) { d.dot(p[0], p[1], rdm, '#1656a6'); });
        d.tag(W - hi, H * 0.28, W + 5, H * 0.28, 'ปลอก RB' + dTie, { anchor: 'start', color: '#1656a6' });
      } else {
        // 2-pile (FT-03): transverse stirrup marks (B-dir) at stirrup x-stations + column-dowel dots
        var rdm2 = Math.max(0.5, d.s(dM) / 2 + 0.2);
        var stIn2 = Math.min(d.s(dM), (W - 2 * c) / 4), xs0p = c + stIn2, xs1p = W - c - stIn2;
        var markLen = Math.min(d.s(250), (H - 2 * c) * 0.22);
        for (var sp = 0; sp < nStir2; sp++) {
          var xsp = nStir2 > 1 ? xs0p + (xs1p - xs0p) * sp / (nStir2 - 1) : (xs0p + xs1p) / 2;
          d.line(xsp, c, xsp, c + markLen, d.st.barB);            // short blue stirrup mark near top edge
        }
        var dwIn2 = d.s(Math.min(30, col * 0.15));                // 4 column-dowel dots near column corners
        [[W / 2 - cw / 2 + dwIn2, H / 2 - cb / 2 + dwIn2], [W / 2 + cw / 2 - dwIn2, H / 2 - cb / 2 + dwIn2], [W / 2 - cw / 2 + dwIn2, H / 2 + cb / 2 - dwIn2], [W / 2 + cw / 2 - dwIn2, H / 2 + cb / 2 - dwIn2]]
          .forEach(function (p) { d.dot(p[0], p[1], rdm2, '#1656a6'); });
        d.tag(W - c, H * 0.28, W + 5, H * 0.28, 'ปลอกตั้ง RB' + dTie, { anchor: 'start', color: '#1656a6' });
      }
      d.dimH(0, W, H + 7, fmtM(Amm) + ' (A)', { from: H });
      d.dimV(0, H, -7, fmtM(Bmm) + ' (B)', { from: 0 });
      if (pileSp > 0) d.dimH(d.s(piles[0]), d.s(piles[1]), -5, fmtM(pileSp) + ' (ระยะเข็ม)');
      d.tag(W * 0.3, c, W * 0.3, -3.5, nA + '–' + bl + dM + ' ทิศ A @' + fmtM(sA), { anchor: 'middle' });
      d.tag(d.s(piles[0]), H / 2, d.s(piles[0]), H + 11, 'เสาเข็ม ' + pLbl + (pileD / 10).toFixed(0) + ' ('+ piles.length +' ต้น)', { anchor: 'middle', below: true, color: '#555' });
      d.text(W / 2, -11, 'แปลนฐาน · PILE CAP PLAN', { size: 2.6, weight: 800, color: '#111' });
      if (CK_GRID) d.gridRef(W / 2, H / 2, 0, 0, W, H, CK_GX, CK_GY);
      if (CK_NORTH) d.northArrow(W + 4, -3);
      d.scaleBar(0, H + 14);
      out.push({ cap: 'แปลนฐานเสาเข็ม · Pile Cap Plan', svg: d.finish().svg, denom: DN });
    })();

    (function () {  // SECTION along A
      var d = mkDraw(DN), W = d.s(Amm), th = d.s(T), c = d.s(cov);
      var colH = d.s(350), pileShow = d.s(650), embed = (is1Pile && pat === 'C') ? d.s(250) : d.s(100);
      // soil around cap
      d.hatchSoil(-d.s(140), -colH, d.s(140), (th + colH));
      d.hatchSoil(W, -colH, d.s(140), (th + colH));
      // cap — คอนกรีตถูกตัด → hatch ANSI31 45° เต็มหน้าตัด (DRAFTING-SPEC §7)
      d.rect(0, 0, W, th, d.st.objfill);
      d.hatchConc(0, 0, W, th);
      // column stub
      var cw = d.s(col);
      d.rect(W / 2 - cw / 2, -colH, cw, colH, d.st.objfill);
      d.hatchConc(W / 2 - cw / 2, -colH, cw, colH);
      d.text(W / 2, -colH - 1.5, 'เสา ' + (col / 10).toFixed(0) + 'x' + (colB / 10).toFixed(0), { size: 2, color: '#555' });
      // piles entering cap
      var pd = d.s(pileD);
      piles.forEach(function (px) {
        var x = d.s(px);
        d.rect(x - pd / 2, th - embed, pd, pileShow + embed, 'stroke="#111" stroke-width="0.3" fill="#e9edf2"');
        d.line(x - pd / 2 + 0.6, th + pileShow * 0.5, x + pd / 2 - 0.6, th + pileShow * 0.5, d.st.thin);
      });
      // rebar — 1-pile detailed cage (matches footing-1pile.html drawSection) vs 2-pile strut-and-tie cage (matches footing-2pile.html drawSection)
      var ybar = th - c, rdot = Math.max(0.5, d.s(dM) / 2 + 0.2);
      if (is1Pile) {
        var gL = c, gR = W - c, yTopC = c, yBotC = th - c, dbp = d.s(dM);
        var mIn = d.s(Math.min(30, col * 0.12)), bxL = W / 2 - cw / 2 + mIn, bxR = W / 2 + cw / 2 - mIn, yPH = th - embed;
        var nHoopUse = nHoopIn > 0 ? nHoopIn : Math.max(3, Math.round((T - 2 * cov) / (pat === 'C' ? 100 : 200)) + 1);
        if (pat === 'C') {
          // ⊓ inverted-U cage: top mat + legs down + inward 10·db hooks at bottom (แดง = main)
          var legHk = Math.min(d.s(10 * dM), (gR - gL) / 2 - 1);
          d.line(gL + legHk, yBotC, gL, yBotC, d.st.barA); d.line(gL, yBotC, gL, yTopC, d.st.barA);
          d.line(gL, yTopC, gR, yTopC, d.st.barA);
          d.line(gR, yTopC, gR, yBotC, d.st.barA); d.line(gR, yBotC, gR - legHk, yBotC, d.st.barA);
          for (var g1 = 0; g1 < nB; g1++) { var xg1 = gL + (gR - gL) * g1 / Math.max(1, nB - 1); d.dot(xg1, yTopC + rdot + 0.3, rdot, '#c0202a'); }
          // bottom mat ∪ resting on pile head (embed 25 cm) + short 90° up-hooks
          var uHk = Math.min(d.s(70), (yBotC - yPH) * 0.4);
          d.line(gL, yPH - uHk, gL, yPH, d.st.barA); d.line(gL, yPH, gR, yPH, d.st.barA); d.line(gR, yPH, gR, yPH - uHk, d.st.barA);
          for (var g2 = 0; g2 < nB; g2++) { var xg2 = gL + (gR - gL) * g2 / Math.max(1, nB - 1); d.dot(xg2, yPH - rdot - 0.3, rdot, '#c0202a'); }
        } else {
          // tall-U mat: bottom run + legs up to top−cover + short inward hooks at top (แดง = main)
          var aHk = Math.min(d.s(8 * dM), (gR - gL) / 2 - 1);
          d.line(gL + aHk, yTopC, gL, yTopC, d.st.barA); d.line(gL, yTopC, gL, yBotC, d.st.barA);
          d.line(gL, yBotC, gR, yBotC, d.st.barA);
          d.line(gR, yBotC, gR, yTopC, d.st.barA); d.line(gR, yTopC, gR - aHk, yTopC, d.st.barA);
          for (var jb = 0; jb < nB; jb++) { var xb = gL + (gR - gL) * jb / Math.max(1, nB - 1); d.dot(xb, yBotC - rdot - 0.3, rdot, '#c0202a'); }
        }
        // closed hoops (น้ำเงิน) — nHoopUse levels; top hoop carries a 135° hook tick
        var hoopTopY = yTopC + dbp * 1.5, hoopBotY = yBotC - dbp;
        for (var hh = 0; hh < nHoopUse; hh++) {
          var yhh = nHoopUse > 1 ? hoopTopY + (hoopBotY - hoopTopY) * hh / (nHoopUse - 1) : (hoopTopY + hoopBotY) / 2;
          d.line(gL, yhh, gR, yhh, d.st.barB);
          if (hh === 0) d.line(gR, yhh, gR - d.s(40), yhh + d.s(40), d.st.barB);
        }
        // column dowels (น้ำเงิน) — down into cap + short 90° foot inward
        var dwFoot = (pat === 'C') ? (yPH - dbp * 3) : (yBotC - dbp * 2), hookDw = Math.min(d.s(12 * dM), (bxR - bxL) / 2 - 1);
        d.line(bxL, -colH + d.s(50), bxL, dwFoot, d.st.barB); d.line(bxL, dwFoot, bxL + hookDw, dwFoot, d.st.barB);
        d.line(bxR, -colH + d.s(50), bxR, dwFoot, d.st.barB); d.line(bxR, dwFoot, bxR - hookDw, dwFoot, d.st.barB);
      } else {
        // 2-pile (FT-03) strut-and-tie cage: bottom tension tie (dir A) + nominal top mat + vertical closed stirrups + column dowels
        var gL = c, gR = W - c, yBot = th - c, yTop = c, dbp = d.s(dM);
        // bottom tension tie (dir A, main) — full width with short 90° up-hooks that develop past the pile centers to the cap ends
        var upHk = Math.min(d.s(90), (yBot - yTop) * 0.4);
        d.line(gL, yBot, gR, yBot, d.st.barA);
        d.line(gL, yBot, gL, yBot - upHk, d.st.barA);
        d.line(gR, yBot, gR, yBot - upHk, d.st.barA);
        for (var i = 0; i < nB; i++) { var xtb = nB > 1 ? gL + (gR - gL) * i / (nB - 1) : (gL + gR) / 2; d.dot(xtb, yBot - rdot - 0.3, rdot, '#c0202a'); }
        // nominal top mat (dir A) + a couple of dots
        d.line(gL, yTop, gR, yTop, d.st.barA);
        var nTopB = Math.max(2, Math.round(nB / 2));
        for (var it = 0; it < nTopB; it++) { var xtt = nTopB > 1 ? gL + (gR - gL) * it / (nTopB - 1) : (gL + gR) / 2; d.dot(xtt, yTop + rdot + 0.3, rdot, '#c0202a'); }
        // vertical closed stirrups (ปลอกตั้ง) — nStir2 legs across [gL,gR] standing just inside the tie, end leg carries 135° hook tick
        var stIn = Math.min(d.s(dM), (gR - gL) / 4), xs0 = gL + stIn, xs1 = gR - stIn;
        for (var s2 = 0; s2 < nStir2; s2++) {
          var xs = nStir2 > 1 ? xs0 + (xs1 - xs0) * s2 / (nStir2 - 1) : (xs0 + xs1) / 2;
          d.line(xs, yBot, xs, yTop, d.st.barB);
          if (s2 === nStir2 - 1) d.line(xs, yTop, xs - d.s(35), yTop + d.s(35), d.st.barB);   // 135° hook tick at top
        }
        // column dowels — 2 blue verticals from column down into cap + short 90° foot inward (mirror 1-pile)
        var mIn = d.s(Math.min(30, col * 0.12)), bxL = W / 2 - cw / 2 + mIn, bxR = W / 2 + cw / 2 - mIn;
        var dwFoot = yBot - dbp * 2, hookDw = Math.min(d.s(12 * dM), Math.max(1, (bxR - bxL) / 2 - 1));
        d.line(bxL, -colH + d.s(50), bxL, dwFoot, d.st.barB); d.line(bxL, dwFoot, bxL + hookDw, dwFoot, d.st.barB);
        d.line(bxR, -colH + d.s(50), bxR, dwFoot, d.st.barB); d.line(bxR, dwFoot, bxR - hookDw, dwFoot, d.st.barB);
      }
      d.dimV(0, th, -6, 'T=' + (T / 10).toFixed(0) + ' cm', { from: 0 });
      d.dimH(0, W, th + pileShow + 6, fmtM(Amm), { from: th });
      if (pileSp > 0) d.dimH(d.s(piles[0]), d.s(piles[1]), th + pileShow + 11, fmtM(pileSp));
      if (is1Pile) {
        var _cageLbl = (pat === 'C') ? ('กรงตัว U ⊓ ' + nB + '–' + bl + dM) : ('ตะแกรง tall-U ' + nB + '–' + bl + dM);
        var _anchY = (pat === 'C') ? (th - embed - rdot - 0.3) : (th - c - rdot - 0.3);
        d.tag(W / 2, _anchY, W * 0.5, th + 3.5, _cageLbl, { anchor: 'middle', below: true });
        d.tag(c, th * 0.5, W * 0.18, -colH * 0.45, 'ปลอก RB' + dTie + ' × ' + nHoopUse + ' เส้น', { anchor: 'middle', color: '#1656a6' });
      } else {
        d.tag(W / 2, ybar - rdot - 0.3, W * 0.5, th + 3.5, 'เหล็กล่าง(tie) ' + nA + '–' + bl + dM + ' ทิศ A', { anchor: 'middle', below: true });
        d.tag(c, th * 0.5, W * 0.18, -colH * 0.45, 'ปลอกตั้ง RB' + dTie + ' × ' + nStir2 + ' เส้น', { anchor: 'middle', color: '#1656a6' });
        d.tag(W * 0.62, c + rdot + 0.3, W * 0.72, -6, 'เหล็กบน (nominal)', { anchor: 'middle', color: '#c0202a' });
      }
      d.tag(d.s(piles[0]), th + pileShow * 0.5, d.s(piles[0]) - 4, th + pileShow * 0.5, 'เสาเข็ม ' + pLbl + (pileD / 10).toFixed(0), { anchor: 'end', color: '#555' });
      d.text(W / 2, -colH - 5, 'รูปตัด · SECTION', { size: 2.6, weight: 800, color: '#111' });
      out.push({ cap: 'รูปตัด · Section', svg: d.finish().svg, denom: DN });
    })();

    return out;
  }

  function rectPerim(x, y, w, h, n) {
    var per = 2 * (w + h), pts = [];
    for (var i = 0; i < n; i++) {
      var t = per * i / n, p;
      if (t < w) p = { x: x + t, y: y };
      else if (t < w + h) p = { x: x + w, y: y + (t - w) };
      else if (t < 2 * w + h) p = { x: x + w - (t - w - h), y: y + h };
      else p = { x: x, y: y + h - (t - 2 * w - h) };
      pts.push(p);
    }
    return pts;
  }

  // Column: true-scale CROSS-SECTION + ELEVATION (tied or spiral)
  function columnDetail() {
    var type = ($('input[name=ctype]:checked') || {}).value || 'tied';
    var Lu = (val(['Lu']) || 3) * 1000;
    var dM = val(['dMain']) || 20, nM = Math.max(4, val(['nMain']) || 4);
    var dSt = val(['dSt']) || 9, sSt = (val(['sSt']) || 0.15) * 1000;
    var fy = val(['fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    var fys = val(['fys']); var sbl = (fys && fys >= 3000) ? 'DB' : 'RB';
    var out = [];
    var spiral = (type === 'spiral');
    var cov = (val(spiral ? ['covS', 'cov'] : ['cov', 'covS']) || 3.5) * 10;
    var b, h, D;
    if (spiral) { D = (val(['D']) || 40) * 10; b = D; h = D; } else { b = (val(['b']) || 30) * 10; h = (val(['h']) || 30) * 10; }

    /* ---- CROSS SECTION ---- */
    (function () {
      var dn = pickDenom(b, h, 150, 92);
      var d = mkDraw(dn);
      var rdot = Math.max(0.6, d.s(dM) / 2 + 0.15);
      if (spiral) {
        var R = d.s(D) / 2, cx = R, cy = R;
        d.circ(cx, cy, R, d.st.objfill);
        d.circ(cx, cy, R - d.s(cov), d.st.barB);                 // spiral
        var br = R - d.s(cov + dSt + dM / 2);
        for (var i = 0; i < nM; i++) { var a = 2 * Math.PI * i / nM - Math.PI / 2; d.dot(cx + br * Math.cos(a), cy + br * Math.sin(a), rdot, '#c0202a'); }
        d.dimH(0, 2 * R, 2 * R + 6, '⌀ ' + (D / 10).toFixed(0) + ' cm', { from: 2 * R });
        d.tag(cx + br * Math.cos(-Math.PI / 2), cy - br, cx, -4, nM + '–' + bl + dM, { anchor: 'middle' });
        d.tag(cx + (R - d.s(cov)), cy, 2 * R + 3, cy, 'เกลียว ' + sbl + dSt + ' @' + (sSt / 1000).toFixed(2), { anchor: 'start' });
      } else {
        var W = d.s(b), H = d.s(h), ci = d.s(cov);
        d.rect(0, 0, W, H, d.st.objfill);
        d.hatchConc(0, 0, W, H);                                  // คอนกรีตถูกตัด → hatch ANSI31 45° (DRAFTING-SPEC §7)
        d.rect(ci, ci, W - 2 * ci, H - 2 * ci, d.st.barB);        // tie
        var bi = d.s(cov + dSt + dM / 2);
        var pts = rectPerim(bi, bi, W - 2 * bi, H - 2 * bi, nM);
        pts.forEach(function (p) { d.dot(p.x, p.y, rdot, '#c0202a'); });
        d.dimH(0, W, H + 6, (b / 10).toFixed(0) + ' cm', { from: H });
        d.dimV(0, H, -6, (h / 10).toFixed(0) + ' cm', { from: 0 });
        d.tag(pts[0].x, pts[0].y, -3, -4, nM + '–' + bl + dM, { anchor: 'start' });
        d.tag(ci, H * 0.5, W + 3, H * 0.5, 'ปลอก ' + sbl + dSt + ' @' + (sSt / 1000).toFixed(2), { anchor: 'start' });
        d.text(ci + 1.4, H - ci - 1, 'หุ้ม ' + (cov / 10).toFixed(1), { size: 1.8, anchor: 'start', color: '#555' });
      }
      d.text((spiral ? d.s(D) : d.s(b)) / 2, -9, 'หน้าตัดเสา · COLUMN SECTION', { size: 2.6, weight: 800, color: '#111' });
      out.push({ cap: 'หน้าตัดเสา · Column Section', svg: d.finish().svg, denom: dn });
    })();

    /* ---- ELEVATION (broken if tall, so width stays readable) ---- */
    (function () {
      var wRef = spiral ? D : b;
      // scale so column width ≈ 20 mm on paper (readable), snapped to ladder
      var dn = nearestLadder(wRef / 20);
      var W = wRef / dn, ci = cov / dn, lap = 4;                    // short continuation stub above (paper mm)
      var availH = 86, brk = 7, segP = (availH - brk) / 2;          // paper mm per segment
      var segReal = segP * dn;
      var d = mkDraw(dn);
      var broken = (2 * segReal < Lu * 0.92);
      function ties(y0, y1) { for (var y = y1 - ci; y > y0 + 0.5; y -= sSt / dn) d.line(ci, y, W - ci, y, d.st.barB); }
      if (!broken) {                                                // short column → full elevation
        var Hh = Lu / dn, baseY = Hh;
        d.rect(0, 0, W, Hh, d.st.objfill);
        d.line(ci, -lap, ci, baseY, d.st.barA); d.line(W - ci, -lap, W - ci, baseY, d.st.barA);
        ties(0, baseY);
        footBase(d, W, baseY);
        d.dimV(0, baseY, -6, 'L=' + (Lu / 1000).toFixed(2) + ' m', { from: 0 });
        d.dimV(baseY - ci - sSt / dn, baseY - ci, W + 6, '@' + (sSt / 1000).toFixed(2), { from: W });
        d.tag(W - ci, baseY * 0.45, W + 4, baseY * 0.45 - 2, (spiral ? 'เกลียว ' : 'ปลอก ') + sbl + dSt + ' @' + (sSt / 1000).toFixed(2), { anchor: 'start' });
        d.tag(ci, baseY * 0.2, -4, baseY * 0.2, 'เหล็กยืน ' + nM + '–' + bl + dM, { anchor: 'end' });
        d.text(W / 2, -lap - 4, 'รูปด้าน · ELEVATION', { size: 2.6, weight: 800, color: '#111' });
      } else {                                                     // broken elevation: top seg | break | bottom seg
        var topY0 = 0, topY1 = segP, botY0 = segP + brk, botY1 = 2 * segP + brk, baseY = botY1;
        // column outlines (two segments)
        d.line(0, topY0, 0, topY1, d.st.obj); d.line(W, topY0, W, topY1, d.st.obj);
        d.line(0, botY0, 0, botY1, d.st.obj); d.line(W, botY0, W, botY1, d.st.obj);
        d.line(0, topY0, W, topY0, d.st.obj);                       // top cap
        // bars
        d.line(ci, topY0 - lap, ci, topY1, d.st.barA); d.line(W - ci, topY0 - lap, W - ci, topY1, d.st.barA);
        d.line(ci, botY0, ci, botY1, d.st.barA); d.line(W - ci, botY0, W - ci, botY1, d.st.barA);
        ties(topY0, topY1); ties(botY0, botY1);
        // break zigzag
        var my = segP + brk / 2;
        d.line(-1.5, segP, W * 0.4, my, d.st.obj); d.line(W * 0.4, my, W * 0.6, segP, d.st.obj);
        d.line(W * 0.6, segP, W + 1.5, my, d.st.obj);
        d.line(-1.5, my, W * 0.4, botY0, d.st.obj); d.line(W * 0.4, botY0, W * 0.6, my, d.st.obj);
        d.line(W * 0.6, my, W + 1.5, botY0, d.st.obj);
        footBase(d, W, baseY);
        // dims
        d.dimV(botY0, baseY, W + 6, '@' + (sSt / 1000).toFixed(2), { from: W });
        d.tag(W - ci, (botY0 + baseY) / 2, W + 12, (botY0 + baseY) / 2, (spiral ? 'เกลียว ' : 'ปลอก ') + sbl + dSt, { anchor: 'start' });
        d.tag(ci, (topY0 + topY1) / 2, -4, (topY0 + topY1) / 2, 'เหล็กยืน ' + nM + '–' + bl + dM, { anchor: 'end' });
        d.text(W / 2, -lap - 4, 'รูปด้าน · ELEVATION', { size: 2.6, weight: 800, color: '#111' });
        d.text(W + 1, my + 1, 'L=' + (Lu / 1000).toFixed(2) + ' m', { size: 2, anchor: 'start', color: '#777' });
      }
      out.push({ cap: 'รูปด้านเสา · Column Elevation', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }
  function footBase(d, W, baseY) {
    d.line(-d.s(120), baseY, W + d.s(120), baseY, 'stroke="#111" stroke-width="0.5" fill="none"');
    d.hatchSoil(-d.s(120), baseY, W + d.s(240), d.s(160));
    d.text(W + d.s(120), baseY + d.s(160) + 2, 'ฐานราก', { size: 2, anchor: 'end', color: '#7a6f57' });
  }
  function nearestLadder(x) {
    var best = SCALE_LADDER[0];
    for (var i = 0; i < SCALE_LADDER.length; i++) { if (Math.abs(SCALE_LADDER[i] - x) < Math.abs(best - x)) best = SCALE_LADDER[i]; }
    return best;
  }

  // One-way slab: PLAN (main + temp bars) + TYPICAL SECTION across the span
  function slabOneWay() {
    var S = val(['S']), L = val(['L']); if (!(S > 0 && L > 0)) return null;
    var Smm = S * 1000, Lmm = L * 1000;
    var T = (parseNum('#o_t') || val(['tdef']) || 10) * 10, cov = (val(['cov']) || 2) * 10;
    var dM = parseFloat((document.getElementById('mainDia') || {}).value) || 9;
    var dT = parseFloat((document.getElementById('tempDia') || {}).value) || 9;
    var spc = document.querySelectorAll('#spacingRows .spc');
    var sPos = (spc[1] ? parseFloat(spc[1].value) : 0.2) * 1000;
    var sTmp = (document.getElementById('spcTemp') ? parseFloat(document.getElementById('spcTemp').value) : 0.25) * 1000;
    var fy = val(['fy1', 'fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    var tl = (val(['fy2']) && val(['fy2']) >= 3000) ? 'DB' : bl;
    // ขอ 90° = หาง 12db (ACI 25.3.1) แต่ไม่ทะลุผิวพื้น — จำกัดด้วยความหนาสุทธิ t − 2·cov
    var out = [], hookM = Math.min(12 * dM, Math.max(T - 2 * cov, 40));

    /* ---- PLAN ---- */
    (function () {
      var dn = pickDenom(Smm, Lmm, 150, 96);
      var d = mkDraw(dn), W = d.s(Smm), H = d.s(Lmm), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill);
      var nMain = Math.min(60, Math.floor(Lmm / sPos) + 1);
      for (var i = 0; i < nMain; i++) { var y = c + i * (H - 2 * c) / (nMain - 1); d.line(c, y, W - c, y, d.st.barA); }   // main spans S (horizontal)
      var nT = Math.min(40, Math.floor(Smm / sTmp) + 1);
      for (var j = 0; j < nT; j++) { var x = c + j * (W - 2 * c) / (nT - 1); d.line(x, c, x, H - c, d.st.barB); }          // temp spans L (vertical)
      d.dimH(0, W, H + 7, fmtM(Smm) + ' (S)', { from: H });
      d.dimV(0, H, -7, fmtM(Lmm) + ' (L)', { from: 0 });
      d.tag(W * 0.5, c, W * 0.5, -3.5, 'เหล็กหลัก ' + bl + dM + ' @' + (sPos / 1000).toFixed(2), { anchor: 'middle' });
      d.tag(c, H * 0.62, -4, H * 0.62, 'กันร้าว ' + tl + dT + ' @' + (sTmp / 1000).toFixed(2), { anchor: 'end' });
      d.text(W / 2, -11, 'แปลนพื้น · SLAB PLAN', { size: 2.7, weight: 800, color: '#111' });
      if (CK_NORTH) d.northArrow(W + 4, -3);
      d.scaleBar(0, H + 12);
      out.push({ cap: 'แปลนพื้น · Slab Plan', svg: d.finish().svg, denom: dn });
    })();

    /* ---- TYPICAL SECTION (cut across span S) — พื้นหล่อเป็นเนื้อเดียวกับคาน ----
     * ผิวบนพื้น = ผิวบนคาน (flush) · พื้นหนา T ฝังช่วงบนคาน · คานลึกต่อใต้ท้องพื้น 260 mm (เชิงสัญลักษณ์)
     * คานถูกระนาบตัดผ่า → hatch ANSI31 เต็มหน้าตัด · เหล็กล้วงเข้าเนื้อคาน + ของอภายในคาน */
    (function () {
      var dn = pickDenom(Smm + 400, T + 520, 150, 64);
      var d = mkDraw(dn), W = d.s(Smm), th = d.s(T), c = d.s(cov), hk = d.s(hookM);
      var bw = d.s(200), supB = th + d.s(260);              // คานกว้าง 200 · ท้องคานลึกใต้ท้องพื้น 260
      // hatch คอนกรีตถูกตัด: คานเต็มหน้าตัด (ผิวบน→ท้องคาน) + แผ่นพื้น — ก่อนวาดเหล็ก
      d.hatchConc(-bw, 0, bw, supB); d.hatchConc(W, 0, bw, supB); d.hatchConc(0, 0, W, th);
      // เส้นตัด (cut outline): ผิวบนต่อเนื่องเส้นเดียว · คานยื่นใต้ท้องพื้น
      d.line(-bw, 0, W + bw, 0, d.st.cut);
      d.line(-bw, 0, -bw, supB, d.st.cut); d.line(-bw, supB, 0, supB, d.st.cut); d.line(0, supB, 0, th, d.st.cut);
      d.line(W + bw, 0, W + bw, supB, d.st.cut); d.line(W + bw, supB, W, supB, d.st.cut); d.line(W, supB, W, th, d.st.cut);
      d.line(0, th, W, th, d.st.cut);
      // bottom main bar — ล้วงเข้าเนื้อคานทั้งสองข้าง + ของอ 90° ขึ้นภายในคาน
      var yb = th - c, rdot = Math.max(0.55, d.s(dM) / 2 + 0.1);
      d.line(-bw + c, yb, W + bw - c, yb, d.st.barA);
      d.line(-bw + c, yb, -bw + c, yb - hk, d.st.barA); d.line(W + bw - c, yb, W + bw - c, yb - hk, d.st.barA);
      // top support bars — เริ่มในเนื้อคาน (หางงอลง 12db ฝังในคาน) ยื่นเข้าช่วง ~0.3S
      var ext = Math.min(W - 2 * c, d.s(0.30 * Smm));
      var hkT = d.s(Math.min(12 * dM, T + 260 - 2 * cov));
      d.line(-bw + c, c, ext, c, d.st.barA); d.line(-bw + c, c, -bw + c, c + hkT, d.st.barA);
      d.line(W + bw - c, c, W - ext, c, d.st.barA); d.line(W + bw - c, c, W + bw - c, c + hkT, d.st.barA);
      // distribution (temp) bars = dots just above bottom main
      var nd = Math.min(9, Math.max(3, Math.round(W / d.s(400))));
      for (var i = 0; i < nd; i++) { var x = c + (i + 0.5) * (W - 2 * c) / nd; d.dot(x, yb - rdot - 0.4, rdot, '#1656a6'); }
      // dims — T วัดผิวบน→ท้องพื้น · S วัดหน้าใน–หน้าในคาน
      d.dimV(0, th, -bw - 6, 'T=' + (T / 10).toFixed(0) + ' cm', { from: -bw });
      d.dimH(0, W, supB + 6, fmtM(Smm) + ' (S)', { from: supB });
      d.tag(W * 0.5, yb, W * 0.5, th + 3.5, 'เหล็กล่าง ' + bl + dM + ' @' + (sPos / 1000).toFixed(2) + ' ล้วงเข้าคาน + ของอ 90°', { anchor: 'middle', below: true });
      d.tag(ext, c, ext + 4, c - 4.2, 'เหล็กบน(ที่ฐาน) ' + bl + dM + ' ของอลงในคาน', { anchor: 'start' });
      d.tag(c + (W - 2 * c) * 0.72, yb - rdot - 0.4, W + bw + 2, yb - 3, 'กันร้าว ' + tl + dT, { anchor: 'start', color: '#1656a6' });
      d.text(W / 2, -9, 'รูปตัดทั่วไป · TYPICAL SECTION', { size: 2.7, weight: 800, color: '#111' });
      out.push({ cap: 'รูปตัดทั่วไป · Typical Section (monolithic)', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }

  // Two-way slab: PLAN (2-direction bottom mat) + TYPICAL SECTION across short span
  function slabTwoWay() {
    var S = val(['S']), L = val(['L']); if (!(S > 0 && L > 0)) return null;
    var Smm = S * 1000, Lmm = L * 1000;
    var T = (parseNum('#o_t') || val(['tdef']) || 10) * 10, cov = (val(['cov']) || 2) * 10;
    var dia = parseFloat((document.getElementById('dia') || {}).value) || 9;
    var spc = document.querySelectorAll('#spacingRows .spc');
    var sShort = (spc[1] ? parseFloat(spc[1].value) : 0.2) * 1000;
    var sLong = (spc[4] ? parseFloat(spc[4].value) : 0.2) * 1000;
    var fy = val(['fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    // ขอ 90° = หาง 12db (ACI 25.3.1) แต่ไม่ทะลุผิวพื้น — จำกัดด้วยความหนาสุทธิ T − 2·cov
    var out = [], hookM = Math.min(12 * dia, Math.max(T - 2 * cov, 40));

    (function () {  // PLAN
      var dn = pickDenom(Smm, Lmm, 150, 96);
      var d = mkDraw(dn), W = d.s(Smm), H = d.s(Lmm), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill);
      var nS = Math.min(60, Math.floor(Lmm / sShort) + 1);
      for (var i = 0; i < nS; i++) { var y = c + i * (H - 2 * c) / (nS - 1); d.line(c, y, W - c, y, d.st.barA); }   // short-dir spans S (horizontal)
      var nL = Math.min(60, Math.floor(Smm / sLong) + 1);
      for (var j = 0; j < nL; j++) { var x = c + j * (W - 2 * c) / (nL - 1); d.line(x, c, x, H - c, d.st.barB); }   // long-dir spans L (vertical)
      d.dimH(0, W, H + 7, fmtM(Smm) + ' (S)', { from: H });
      d.dimV(0, H, -7, fmtM(Lmm) + ' (L)', { from: 0 });
      d.tag(W * 0.5, c, W * 0.5, -3.5, 'ด้านสั้น ' + bl + dia + ' @' + (sShort / 1000).toFixed(2), { anchor: 'middle' });
      d.tag(c, H * 0.62, -4, H * 0.62, 'ด้านยาว ' + bl + dia + ' @' + (sLong / 1000).toFixed(2), { anchor: 'end' });
      d.text(W / 2, -11, 'แปลนเหล็กล่าง · BOTTOM MAT PLAN', { size: 2.6, weight: 800, color: '#111' });
      if (CK_NORTH) d.northArrow(W + 4, -3);
      d.scaleBar(0, H + 12);
      out.push({ cap: 'แปลนเหล็กล่าง 2 ทิศ · Bottom Mat Plan', svg: d.finish().svg, denom: dn });
    })();

    (function () {  // SECTION across short span — พื้นหล่อเป็นเนื้อเดียวกับคาน (monolithic)
      var dn = pickDenom(Smm + 400, T + 520, 150, 64);
      var d = mkDraw(dn), W = d.s(Smm), th = d.s(T), c = d.s(cov), hk = d.s(hookM);
      var bw = d.s(200), supB = th + d.s(260);              // ผิวบนคานเสมอผิวบนพื้น · คานลึกต่อใต้ท้องพื้น
      d.hatchConc(-bw, 0, bw, supB); d.hatchConc(W, 0, bw, supB); d.hatchConc(0, 0, W, th);
      d.line(-bw, 0, W + bw, 0, d.st.cut);
      d.line(-bw, 0, -bw, supB, d.st.cut); d.line(-bw, supB, 0, supB, d.st.cut); d.line(0, supB, 0, th, d.st.cut);
      d.line(W + bw, 0, W + bw, supB, d.st.cut); d.line(W + bw, supB, W, supB, d.st.cut); d.line(W, supB, W, th, d.st.cut);
      d.line(0, th, W, th, d.st.cut);
      // เหล็กล่าง — ล้วงเข้าเนื้อคานทั้งสองข้าง + ของอ 90° ขึ้นภายในคาน
      var yb = th - c, rdot = Math.max(0.55, d.s(dia) / 2 + 0.1);
      d.line(-bw + c, yb, W + bw - c, yb, d.st.barA);
      d.line(-bw + c, yb, -bw + c, yb - hk, d.st.barA); d.line(W + bw - c, yb, W + bw - c, yb - hk, d.st.barA);
      // เหล็กบนที่ขอบ — เริ่มในเนื้อคาน (หางงอลง 12db ฝังในคาน) ยื่นเข้าช่วง ~0.3S
      var ext = Math.min(W - 2 * c, d.s(0.30 * Smm));
      var hkT = d.s(Math.min(12 * dia, T + 260 - 2 * cov));
      d.line(-bw + c, c, ext, c, d.st.barA); d.line(-bw + c, c, -bw + c, c + hkT, d.st.barA);
      d.line(W + bw - c, c, W - ext, c, d.st.barA); d.line(W + bw - c, c, W + bw - c, c + hkT, d.st.barA);
      var nd = Math.min(9, Math.max(3, Math.round(W / d.s(400))));
      for (var i = 0; i < nd; i++) { var x = c + (i + 0.5) * (W - 2 * c) / nd; d.dot(x, yb - rdot - 0.4, rdot, '#1656a6'); }
      d.dimV(0, th, -bw - 6, 'T=' + (T / 10).toFixed(0) + ' cm', { from: -bw });
      d.dimH(0, W, supB + 6, fmtM(Smm) + ' (S)', { from: supB });
      d.tag(W * 0.5, yb, W * 0.5, th + 3.5, 'ล่างด้านสั้น ' + bl + dia + ' @' + (sShort / 1000).toFixed(2) + ' ล้วงเข้าคาน + ของอ 90°', { anchor: 'middle', below: true });
      d.tag(ext, c, ext + 3, c - 3, 'บนที่ขอบ ' + bl + dia + ' ของอลงในคาน', { anchor: 'start' });
      d.tag(c + (W - 2 * c) * 0.5, yb - rdot - 0.4, W * 0.72, c + 2, 'ล่างด้านยาว ' + bl + dia, { anchor: 'start', color: '#1656a6' });
      d.text(W / 2, -5, 'รูปตัดทั่วไป · TYPICAL SECTION', { size: 2.6, weight: 800, color: '#111' });
      out.push({ cap: 'รูปตัดทั่วไป · Typical Section (monolithic)', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }

  // Cantilever slab: SECTION (primary — top tension steel + ld into support) + PLAN
  function slabCantilever() {
    var L = val(['L']), B = val(['B']); if (!(L > 0 && B > 0)) return null;
    var Lmm = L * 1000, Bmm = B * 1000;
    var ot = txt('#o_t'), tapered = /\//.test(ot);
    var hRoot, hTip;
    if (tapered) { var mm = ot.match(/-?[\d.]+/g) || []; hRoot = (parseFloat(mm[0]) || 30) * 10; hTip = (parseFloat(mm[1]) || 12) * 10; }
    else { hRoot = hTip = (parseNum('#o_t') || val(['tdef']) || 20) * 10; }
    var cov = (val(['cov']) || 2) * 10;
    var dM = parseFloat((document.getElementById('mainDia') || {}).value) || 16;
    var dT = parseFloat((document.getElementById('tempDia') || {}).value) || 9;
    var sm = document.querySelector('#spacingRows .spc');
    var sMain = (sm ? parseFloat(sm.value) : 0.2) * 1000;
    var sTmp = (document.getElementById('spcTemp') ? parseFloat(document.getElementById('spcTemp').value) : 0.2) * 1000;
    var fy = val(['fy1', 'fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    var fc = val(['fc']) || 240;
    var dbcm = dM / 10, ld = Math.max(300, (fy * dbcm / ((dM >= 22 ? 5.4 : 6.7) * Math.sqrt(fc))) * 10); // mm
    var out = [], hookM = 12 * dM;

    (function () {  // SECTION (primary) — พื้นยื่นหล่อเป็นเนื้อเดียวกับคาน/ผนังรองรับ (monolithic)
      var dn = pickDenom(Lmm + ld + 200, Math.max(hRoot, hTip) + 600, 150, 72);
      var d = mkDraw(dn), c = d.s(cov), hk = d.s(hookM);
      var x0 = 0, xTip = d.s(Lmm), thR = d.s(hRoot), thT = d.s(hTip);
      // ที่รองรับด้านซ้าย: ผิวบนเสมอผิวบนพื้น (y=0) · ลึกต่อใต้ท้องพื้น 250 mm (เชิงสัญลักษณ์)
      var wallW = d.s(Math.max(ld, 300) + 60), supB = thR + d.s(250);
      d.hatchConc(x0 - wallW, 0, wallW, supB);          // คอนกรีตถูกตัด — hatch เต็มหน้าตัด
      d.line(x0 - wallW, 0, x0 - wallW, supB, d.st.cut);
      d.line(x0 - wallW, supB, x0, supB, d.st.cut);
      d.line(x0, supB, x0, thR, d.st.cut);              // หน้าในคานใต้ท้องพื้น (ไม่มีรอยต่อในเนื้อพื้น)
      // slab body (tapered): top edge flat at y=0, bottom edge from thR(root) to thT(tip)
      d.line(x0 - wallW, 0, xTip, 0, d.st.cut);         // ผิวบนต่อเนื่องเส้นเดียว: หลังคาน→ปลายพื้น (เสมอกัน)
      d.line(x0, thR, xTip, thT, d.st.obj);             // bottom (sloped if tapered)
      d.line(xTip, 0, xTip, thT, d.st.obj);             // tip face
      // TOP main steel: from tip (cover) to support, anchored ld into wall + down hook
      var yt = c;
      d.line(xTip - c, yt, x0 - d.s(ld), yt, d.st.barA);            // along top into support by ld
      d.line(xTip - c, yt, xTip - c, yt + hk, d.st.barA);          // tip down-hook
      d.line(x0 - d.s(ld), yt, x0 - d.s(ld), yt + hk * 1.4, d.st.barA); // hook down into support
      // distribution (temp) dots near top
      var nd = Math.min(8, Math.max(3, Math.round((xTip - x0) / d.s(300))));
      for (var i = 0; i < nd; i++) { var x = x0 + (i + 0.6) * (xTip - x0) / (nd + 0.2); d.dot(x, yt + d.s(dM) / 2 + 0.7, Math.max(0.55, d.s(dT) / 2 + 0.1), '#1656a6'); }
      // dims
      d.dimH(x0, xTip, thR + 7, fmtM(Lmm) + ' (ยื่น L)', { from: thR });
      d.dimV(0, thR, x0 - wallW - 4, (tapered ? 'h₀=' : 'T=') + (hRoot / 10).toFixed(0) + ' cm', { from: x0 - wallW });
      if (tapered) d.dimV(0, thT, xTip + 5, 'h_L=' + (hTip / 10).toFixed(0), { from: xTip });
      d.tag((xTip - c + x0) / 2, yt, (xTip + x0) / 2, yt - 4, 'เหล็กบน(รับแรงดึง) ' + bl + dM + ' @' + (sMain / 1000).toFixed(2), { anchor: 'middle' });
      d.tag(x0 - d.s(ld), yt + hk * 1.4, x0 - d.s(ld) - 3, yt + hk * 1.4 + 3, 'ฝังยึด l_d≈' + (ld / 1000).toFixed(2) + ' m (ของอลงในคาน)', { anchor: 'end', color: '#555' });
      d.text((x0 + xTip) / 2, -8, 'รูปตัดตามแนวยื่น · SECTION', { size: 2.6, weight: 800, color: '#111' });
      out.push({ cap: 'รูปตัดตามแนวยื่น · Cantilever Section (monolithic)', svg: d.finish().svg, denom: dn });
    })();

    (function () {  // PLAN
      var dn = pickDenom(Lmm, Bmm, 150, 90);
      var d = mkDraw(dn), W = d.s(Lmm), H = d.s(Bmm), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill);
      var nM = Math.min(60, Math.floor(Bmm / sMain) + 1);
      for (var i = 0; i < nM; i++) { var y = c + i * (H - 2 * c) / (nM - 1); d.line(0, y, W - c, y, d.st.barA); }   // main along L (horizontal), to support edge x=0
      var nT = Math.min(40, Math.floor(Lmm / sTmp) + 1);
      for (var j = 0; j < nT; j++) { var x = c + j * (W - 2 * c) / (nT - 1); d.line(x, c, x, H - c, d.st.barB); }
      // support edge mark
      d.line(0, -1, 0, H + 1, 'stroke="#111" stroke-width="0.5" fill="none"');
      d.text(-1, H / 2, 'ขอบฐานรองรับ', { size: 2, anchor: 'middle', rot: -90, color: '#555' });
      d.dimH(0, W, H + 7, fmtM(Lmm) + ' (ยื่น)', { from: H });
      d.dimV(0, H, W + 6, fmtM(Bmm) + ' (B)', { from: W });
      d.tag(W * 0.55, c, W * 0.55, -3.5, 'เหล็กหลัก(บน) ' + bl + dM + ' @' + (sMain / 1000).toFixed(2), { anchor: 'middle' });
      d.tag(W * 0.5, H - c, W * 0.5, H + 3.5, 'แจกแรง @' + (sTmp / 1000).toFixed(2), { anchor: 'middle', below: true, color: '#1656a6' });
      d.text(W / 2, -11, 'แปลน · PLAN', { size: 2.6, weight: 800, color: '#111' });
      if (CK_NORTH) d.northArrow(W + 8, -3);
      out.push({ cap: 'แปลน · Plan', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }

  // Beam: TRUE-SCALE cross-sections (midspan + support)
  function beamSections() {
    var b = (val(['b']) || 25) * 10, h = (val(['h']) || 50) * 10, cov = (val(['cov']) || 3) * 10;
    if (!(b > 0 && h > 0)) return null;
    var stDia = parseFloat((document.getElementById('stDia') || {}).value) || 9;
    var stLegs = intId('stLegs') || 2;
    var nTopMid = intId('nTopMid'), dTopMid = intId('dTopMid') || 12;
    var nBotSup = intId('nBotSup'), dBotSup = intId('dBotSup') || 12;
    var nBotExtra = intId('nBotExtra'), dBot = intId('dBot') || dBotSup;
    var nTopExtra = intId('nTopExtra'), dTop = intId('dTop') || dTopMid;
    var spcMid = (val(['spc_mid']) || 0.2) * 1000, spcSup = (val(['spc_sup']) || 0.1) * 1000;
    var fy = val(['fy']); var bl = (fy && fy >= 3000) ? 'DB' : 'RB';
    var fys = val(['fys']); var sbl = (fys && fys >= 3000) ? 'DB' : 'RB';

    function lbl2(n1, d1, n2, d2) {
      if (!n2) return n1 + '–' + bl + d1;
      if (d1 === d2) return (n1 + n2) + '–' + bl + d1;
      return n1 + '–' + bl + d1 + ' + ' + n2 + '–' + bl + d2;
    }
    function section(title, topN, topD, botN, botD, topLbl, botLbl, sSpace) {
      var dn = pickDenom(b, h, 150, 92);
      var d = mkDraw(dn), W = d.s(b), H = d.s(h), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill);
      d.rect(c, c, W - 2 * c, H - 2 * c, d.st.barB);                    // stirrup
      var inX0 = c + d.s(stDia), inX1 = W - c - d.s(stDia);
      function row(n, dia, y, col) {
        var rdot = Math.max(0.8, d.s(dia) / 2);
        if (n <= 1) { d.dot((inX0 + inX1) / 2, y, rdot, col); return; }
        for (var i = 0; i < n; i++) d.dot(inX0 + rdot + i * (inX1 - inX0 - 2 * rdot) / (n - 1), y, rdot, col);
      }
      var rt = Math.max(0.8, d.s(topD) / 2), rb = Math.max(0.8, d.s(botD) / 2);
      row(topN, topD, c + d.s(stDia) + rt, '#c0202a');
      row(botN, botD, H - c - d.s(stDia) - rb, '#c0202a');
      d.dimH(0, W, H + 6, (b / 10).toFixed(0) + ' cm', { from: H });
      d.dimV(0, H, -6, (h / 10).toFixed(0) + ' cm', { from: 0 });
      d.tag((inX0 + inX1) / 2, c + d.s(stDia) + rt, W + 3, c + 1, 'บน ' + topLbl, { anchor: 'start' });
      d.tag((inX0 + inX1) / 2, H - c - d.s(stDia) - rb, W + 3, H - 1, 'ล่าง ' + botLbl, { anchor: 'start' });
      d.tag(c, H * 0.5, -3, H * 0.5, 'ปลอก ' + stLegs + '–' + sbl + stDia + ' @' + (sSpace / 1000).toFixed(2), { anchor: 'end' });
      d.text(W / 2, -5, title, { size: 2.5, weight: 800, color: '#111' });
      return { cap: title, svg: d.finish().svg, denom: dn };
    }

    var out = [];
    out.push(section('หน้าตัดกลางช่วง · SECTION (MID)',
      nTopMid, dTopMid, nBotSup + nBotExtra, (dBotSup === dBot ? dBotSup : dBot),
      lbl2(nTopMid, dTopMid, 0, 0), lbl2(nBotSup, dBotSup, nBotExtra, dBot), spcMid));
    out.push(section('หน้าตัดที่ฐานรองรับ · SECTION (SUPPORT)',
      nTopMid + nTopExtra, (dTopMid === dTop ? dTopMid : dTop), nBotSup, dBotSup,
      lbl2(nTopMid, dTopMid, nTopExtra, dTop), lbl2(nBotSup, dBotSup, 0, 0), spcSup));

    // ELEVATION (single-span only) — full width
    var mode = ($('input[name=mode]:checked') || {}).value || 'single';
    var L = (val(['sL']) || 0) * 1000;
    if (mode === 'single' && L > 0) {
      var dn = pickDenom(L, h + 560, 286, 48);
      var d = mkDraw(dn), W = d.s(L), H = d.s(h), c = d.s(cov), o = d.s(35);
      var bp = d.s(160);
      d.rect(-bp, H, bp, d.s(150), 'stroke="#111" stroke-width="0.3" fill="#eef0f2"');     // bearings
      d.rect(W, H, bp, d.s(150), 'stroke="#111" stroke-width="0.3" fill="#eef0f2"');
      d.rect(0, 0, W, H, d.st.objfill);
      // longitudinal bars
      d.line(c, c, W - c, c, d.st.barA);                                                    // top continuous
      var te = Math.min(W / 2 - c, d.s(0.27 * L));
      d.line(c, c + o, c + te, c + o, d.st.barA); d.line(W - c, c + o, W - c - te, c + o, d.st.barA);  // top extra @ supports
      d.line(c, H - c, W - c, H - c, d.st.barA);                                            // bottom continuous
      var be = d.s(0.72 * L);
      d.line(W / 2 - be / 2, H - c - o, W / 2 + be / 2, H - c - o, d.st.barA);              // bottom extra @ mid
      // stirrups — critical zone @spcSup near each end, @spcMid in middle
      var crit = d.s(0.25 * L), ss = d.s(spcSup), sm = d.s(spcMid), x;
      for (x = c; x <= crit; x += ss) d.line(x, c, x, H - c, d.st.barB);
      for (x = W - c; x >= W - crit; x -= ss) d.line(x, c, x, H - c, d.st.barB);
      for (x = crit + sm; x < W - crit; x += sm) d.line(x, c, x, H - c, d.st.barB);
      d.dimH(0, W, H + d.s(150) + 6, fmtM(L) + ' m (ช่วง)', { from: H + d.s(150) });
      d.tag(W * 0.5, c, W * 0.5, -3, 'เหล็กบน ' + lbl2(nTopMid, dTopMid, 0, 0) + ' (ต่อเนื่อง) · +' + nTopExtra + '–' + bl + dTop + ' ที่ฐาน', { anchor: 'middle' });
      d.tag(W * 0.5, H - c, W * 0.62, H + d.s(150) - 1, 'เหล็กล่าง ' + lbl2(nBotSup, dBotSup, nBotExtra, dBot), { anchor: 'start', below: true });
      d.tag(crit, H * 0.5, crit + 3, -3, 'ปลอก @' + (spcSup / 1000).toFixed(2) + ' (ใกล้ฐาน) / @' + (spcMid / 1000).toFixed(2) + ' (กลาง)', { anchor: 'start', color: '#1656a6' });
      d.text(W / 2, -5, 'รูปด้านคาน · BEAM ELEVATION', { size: 2.4, weight: 800, color: '#111' });
      out.push({ cap: 'รูปด้านคาน · Beam Elevation', svg: d.finish().svg, denom: dn, full: true });
    }
    return out;
  }

  // FEM continuous beam: true-scale MID + SUPPORT sections (counts from window.__ckFemBars)
  function femSections() {
    var fb = window.__ckFemBars; if (!fb || !(fb.b > 0) || !(fb.h > 0)) return null;
    var b = fb.b * 10, h = fb.h * 10, cov = fb.cov * 10, dia = fb.dia || 16;
    var nPos = Math.max(2, fb.nPos || 2), nNeg = Math.max(2, fb.nNeg || 2), stD = fb.stDia || 9;
    var bl = (fb.fy && fb.fy >= 3000) ? 'DB' : 'RB';
    function sec(title, nTop, nBot, topLbl, botLbl) {
      var dn = pickDenom(b, h, 150, 92), d = mkDraw(dn), W = d.s(b), H = d.s(h), c = d.s(cov);
      d.rect(0, 0, W, H, d.st.objfill); d.rect(c, c, W - 2 * c, H - 2 * c, d.st.barB);
      var inX0 = c + d.s(stD), inX1 = W - c - d.s(stD), rdot = Math.max(0.8, d.s(dia) / 2);
      function rowDots(n, y) { if (n <= 1) { d.dot((inX0 + inX1) / 2, y, rdot, '#c0202a'); return; } for (var i = 0; i < n; i++) d.dot(inX0 + rdot + i * (inX1 - inX0 - 2 * rdot) / (n - 1), y, rdot, '#c0202a'); }
      rowDots(nTop, c + d.s(stD) + rdot); rowDots(nBot, H - c - d.s(stD) - rdot);
      d.dimH(0, W, H + 6, (b / 10).toFixed(0) + ' cm', { from: H }); d.dimV(0, H, -6, (h / 10).toFixed(0) + ' cm', { from: 0 });
      d.tag((inX0 + inX1) / 2, c + d.s(stD) + rdot, W + 3, c + 1, 'บน ' + topLbl, { anchor: 'start' });
      d.tag((inX0 + inX1) / 2, H - c - d.s(stD) - rdot, W + 3, H - 1, 'ล่าง ' + botLbl, { anchor: 'start' });
      d.tag(c, H * 0.5, -3, H * 0.5, 'ปลอก RB' + stD + ' (สมมติ)', { anchor: 'end' });
      d.text(W / 2, -5, title, { size: 2.5, weight: 800, color: '#111' });
      return { cap: title, svg: d.finish().svg, denom: dn };
    }
    return [
      sec('หน้าตัดกลางช่วง · SECTION (MID)', 2, nPos, '2–' + bl + dia + ' (ยืน)', nPos + '–' + bl + dia),
      sec('หน้าตัดที่ฐาน · SECTION (SUPPORT)', nNeg, 2, nNeg + '–' + bl + dia, '2–' + bl + dia + ' (ยืน)')
    ];
  }

  // Slab-on-ground: SECTION (construction layers) + PLAN (mesh + control joints)
  function slabOnGround() {
    var B = val(['B']), L = val(['L']); if (!(B > 0 && L > 0)) return null;
    var Bmm = B * 1000, Lmm = L * 1000;
    var t = (val(['t']) || 12) * 10, lean = (val(['lean']) || 0) * 10, sand = (val(['sand']) || 0) * 10;
    var Lj = (val(['Lj']) || 3) * 1000;
    var mt = txt('#o_mesh'), md = (mt.match(/-?[\d.]+/g) || []);
    var meshDia = parseFloat(md[0]) || 4, meshSp = (parseFloat(md[2] || md[1]) || 30) * 10;
    var out = [];

    (function () {  // SECTION — construction layers
      var Wsec = Math.min(Bmm, 2200);
      var tot = t + lean + sand;
      var dn = pickDenom(Wsec, tot + 480, 150, 70);
      var d = mkDraw(dn), W = d.s(Wsec);
      var y0 = 0, y1 = d.s(t), y2 = y1 + d.s(lean), y3 = y2 + d.s(sand);
      // soil
      d.hatchSoil(0, y3, W, d.s(220));
      // sand
      if (sand > 0) { d.rect(0, y2, W, d.s(sand), 'stroke="#aa9" stroke-width="0.2" fill="#f3ecd8"'); for (var gx = 0; gx < W; gx += 2.2) d.dot(gx + 1, (y2 + y3) / 2, 0.18, '#c9bd97'); }
      // lean
      if (lean > 0) d.rect(0, y1, W, d.s(lean), 'stroke="#999" stroke-width="0.2" fill="#e7e9ec"');
      // slab
      d.rect(0, y0, W, d.s(t), d.st.objfill);
      // wire mesh — line near upper third with periodic cross dots
      var ym = y0 + d.s(t) * 0.4;
      d.line(d.s(40), ym, W - d.s(40), ym, d.st.barB);
      for (var x = d.s(80); x < W - d.s(40); x += d.s(meshSp)) d.dot(x, ym, Math.max(0.45, d.s(meshDia) / 2 + 0.1), '#1656a6');
      // layer dims (left)
      d.dimV(y0, y1, -6, (t / 10).toFixed(0), { from: 0 });
      if (lean > 0) d.dimV(y1, y2, -6, (lean / 10).toFixed(0));
      if (sand > 0) d.dimV(y2, y3, -6, (sand / 10).toFixed(0));
      // labels (right)
      d.tag(W * 0.7, ym, W + 3, ym, 'ตะแกรง ' + mt, { anchor: 'start', color: '#1656a6' });
      d.tag(W - 2, d.s(t) * 0.7, W + 3, d.s(t) * 0.7 + 3, 'พื้น ค.ส.ล. ' + (t / 10).toFixed(0) + ' cm', { anchor: 'start' });
      if (lean > 0) d.text(W + 3, (y1 + y2) / 2 + 0.6, 'คอนกรีตหยาบ ' + (lean / 10).toFixed(0), { size: 1.9, anchor: 'start', color: '#555' });
      if (sand > 0) d.text(W + 3, (y2 + y3) / 2 + 0.6, 'ทรายบดอัด ' + (sand / 10).toFixed(0), { size: 1.9, anchor: 'start', color: '#555' });
      d.dimH(0, W, y3 + d.s(220) + 6, 'ช่วงตัวอย่าง ' + fmtM(Wsec) + ' m', { from: y3 + d.s(220) });
      d.text(W / 2, -5, 'รูปตัดชั้นการก่อสร้าง · SECTION', { size: 2.5, weight: 800, color: '#111' });
      out.push({ cap: 'รูปตัดชั้นการก่อสร้าง · Section', svg: d.finish().svg, denom: dn });
    })();

    (function () {  // PLAN — mesh grid + control joints
      var dn = pickDenom(Bmm, Lmm, 150, 96);
      var d = mkDraw(dn), W = d.s(Bmm), H = d.s(Lmm);
      d.rect(0, 0, W, H, d.st.objfill);
      // wire mesh grid (thin)
      var sp = d.s(meshSp);
      for (var x = sp; x < W; x += sp) d.line(x, 0, x, H, 'stroke="#9fb6d6" stroke-width="0.12" fill="none"');
      for (var y = sp; y < H; y += sp) d.line(0, y, W, y, 'stroke="#9fb6d6" stroke-width="0.12" fill="none"');
      // control joints (dashed, every Lj)
      var lj = d.s(Lj);
      for (var jx = lj; jx < W - 0.5; jx += lj) d.line(jx, 0, jx, H, d.st.dash);
      for (var jy = lj; jy < H - 0.5; jy += lj) d.line(0, jy, W, jy, d.st.dash);
      d.dimH(0, W, H + 7, fmtM(Bmm) + ' (B)', { from: H });
      d.dimV(0, H, -7, fmtM(Lmm) + ' (L)', { from: 0 });
      if (lj < W) d.dimH(0, lj, -5, fmtM(Lj) + ' (รอยต่อ)');
      d.tag(W * 0.5, H * 0.35, W * 0.5, H * 0.35, 'ตะแกรง ' + mt, { anchor: 'middle', color: '#1656a6' });
      d.text(W / 2, -11, 'แปลน · PLAN (ตะแกรง + รอยต่อหดตัว)', { size: 2.4, weight: 800, color: '#111' });
      if (CK_NORTH) d.northArrow(W + 4, -3);
      d.scaleBar(0, H + 12);
      out.push({ cap: 'แปลน · Plan (Mesh + Joints)', svg: d.finish().svg, denom: dn });
    })();

    return out;
  }

  /* ---------- assemble sheet ---------- */
  var _hidden = {};          // caption -> true (per-tool view toggles, runtime)
  var _lastViewCaps = [];    // captions of the most recent build (for the toggle menu)
  function buildSheet() {
    var c = CFG();
    var brand = c.brandName || txt('.appbar .brand') || 'นายช่างใหญ่ Civil Apps';
    var name = c.title || txt('.appbar .appname') || 'แบบเสริมเหล็ก';
    var sub = c.subtitle || txt('.appbar .appsub') || 'ACI 318 · STRENGTH DESIGN';
    var sheetCode = c.sheetCode || txt('.appbar .sheet') || '—';

    // paper-driven drawing area → drives pickDenom for ALL adapters (true scale preserved)
    var geom = paperGeom();
    CK_PW = geom.viewsW / REF_VIEWS_W;
    CK_PH = geom.viewsH / REF_VIEWS_H;
    CK_FORCE = (DS.scale && DS.scale !== 'auto') ? parseFloat(DS.scale) : 0;
    CK_NORTH = !!DS.north;
    CK_GRID = !!DS.grid; CK_GX = TB.gridX || '1'; CK_GY = TB.gridY || 'A';

    var notes = buildNotes();

    // Prefer TRUE-SCALE adapter views; fall back to harvested schematic SVGs.
    var scaled = scaledViewsFor(sheetCode);
    var views, scaleText;
    if (scaled && scaled.length) {
      views = scaled.map(function (v) { return { cap: v.cap, html: v.svg, denom: v.denom, scaled: true, full: !!v.full }; });
    } else {
      views = harvestViews().map(function (v) { return { cap: v.cap, html: v.svg.outerHTML, scaled: false }; });
    }
    // optional 3D line-art isometric supplied by the tool (window.CK_ISO → SVG string) — placed after plan/section
    if (typeof window.CK_ISO === 'function') {
      try {
        var isoSvg = window.CK_ISO();
        if (isoSvg && typeof isoSvg === 'string' && isoSvg.indexOf('<svg') !== -1) {
          views.push({ cap: 'ภาพไอโซเมตริก · ISOMETRIC VIEW', html: isoSvg, scaled: false, iso: true });
        }
      } catch (e) {}
    }
    _lastViewCaps = views.map(function (v) { return v.cap; });
    views = views.filter(function (v) { return !_hidden[v.cap]; });
    if (scaled && scaled.length) {
      var dns = views.filter(function (v) { return v.scaled && v.denom; }).map(function (v) { return v.denom; });
      var allSame = dns.length && dns.every(function (x) { return x === dns[0]; });
      scaleText = !dns.length ? '—' : allSame ? ('1:' + trimNum(dns[0])) : 'ตามที่ระบุ';
    } else { scaleText = 'AS SHOWN'; }

    var wh = paperWH();
    var sheet = document.createElement('div');
    sheet.className = 'ckds-sheet' + (DS.mono ? ' ckds-mono' : '');
    sheet.style.width = wh.W + 'mm';
    sheet.style.height = wh.H + 'mm';

    var viewsHTML = views.length
      ? views.map(function (v) {
          var sl = (v.scaled && v.denom) ? '<span class="vscale">SCALE 1:' + trimNum(v.denom) + '</span>' : (v.iso ? '<span class="vscale">NOT TO SCALE</span>' : '');
          return '<div class="ckds-view' + (v.scaled ? ' scaled' : '') + (v.full ? ' full' : '') + '">' +
            '<div class="vh"><span class="vt">' + escapeHtml(v.cap || 'รายละเอียดการเสริมเหล็ก') + '</span>' + sl + '</div>' +
            '<div class="vbody">' + v.html + '</div></div>';
        }).join('')
      : '<div class="ckds-view"><div class="vh">รายละเอียดการเสริมเหล็ก</div><div style="padding:8mm;text-align:center;color:#8a96a4;font-size:8pt">— ยังไม่มีรูปแบบเสริมเหล็ก กรุณากรอกข้อมูลให้ครบ —</div></div>';

    var gridCol = (geom.oneCol || views.length <= 1) ? '1fr' : '1fr 1fr';

    // SHOP-DRAWING bar schedule = the bar-list TABLE only — strip the take-off's
    // estimation chips (concrete vol / steel ratio) + the preliminary-estimate disclaimer.
    var takeoff = document.getElementById('takeoff');
    var bsHTML;
    if (takeoff) {
      var tk = takeoff.cloneNode(true);
      Array.prototype.slice.call(tk.children).forEach(function (ch) {
        if (!(ch.querySelector && ch.querySelector('table'))) { if (ch.parentNode) ch.parentNode.removeChild(ch); }
      });
      // drop material-quantity / estimate rows (concrete, lean, sand, lap-allowance) — keep rebar only
      var DROP_ROW = /(คอนกรีต|ทราย|lean|หยาบ|รองพื้น|m³|ปริมาตร|รวมทาบ|เผื่อ)/i;
      Array.prototype.slice.call(tk.querySelectorAll('tbody tr')).forEach(function (tr) {
        if (DROP_ROW.test(tr.textContent)) tr.parentNode.removeChild(tr);
      });
      bsHTML = '<div class="bs-scroll">' + tk.innerHTML + '</div>';
    } else {
      bsHTML = '<div style="padding:2mm;font-size:7.4pt;color:#8a96a4">— ไม่มีตารางเหล็กเสริม —</div>';
    }

    sheet.innerHTML =
      '<div class="ckds-frame"></div>' +
      '<div class="ckds-inner">' +
        '<div class="ckds-cols' + (geom.oneCol ? ' stack' : '') + '">' +
          '<div class="ckds-views" style="grid-template-columns:' + gridCol + '">' + viewsHTML + '</div>' +
          '<div class="ckds-side" style="flex-basis:' + geom.sideW.toFixed(1) + 'mm">' +
            '<div class="ckds-block"><div class="bh">หมายเหตุทั่วไป · General Notes</div><div class="ckds-notes">' + notes + '</div></div>' +
            '<div class="ckds-block ckds-bs"><div class="bh">ตารางเหล็กเสริม · Bar Schedule</div>' + bsHTML + '</div>' +
          '</div>' +
        '</div>' +
        revTable() +
        titleBlock(brand, name, sub, sheetCode, scaleText) +
      '</div>';

    bindTitleBlock(sheet);
    return sheet;
  }

  function trimNum(x) { return (Math.round(x * 10) / 10).toString().replace(/\.0$/, ''); }

  function ed(field, val, ph) {
    return '<span class="ed" contenteditable="true" spellcheck="false" data-tb="' + field + '" data-ph="' + ph + '">' + escapeHtml(val || '') + '</span>';
  }
  function titleBlock(brand, name, sub, sheetCode, scaleText) {
    // brand block — 3 states (session-only): นายช่างใหญ่ Civil Apps → user logo → blank
    var brandTop, nextLbl;
    if (LOGO.mode === 'user' && LOGO.data) {
      brandTop = '<img class="ckds-logo" src="' + LOGO.data + '" alt="logo">';
      nextLbl = 'ไม่ใส่โลโก้';
    } else if (LOGO.mode === 'none') {
      brandTop = '<div class="bn blank"></div>';
      nextLbl = 'ใช้โลโก้ นายช่างใหญ่ Civil Apps';
    } else {
      brandTop = '<div class="bn">' + escapeHtml(brand) + '</div>';
      nextLbl = LOGO.data ? 'ใช้โลโก้บริษัท' : 'ไม่ใส่โลโก้';
    }
    var logoCtl =
      '<div class="ckds-logoctl noprint">' +
        '<button type="button" data-lgact="up" title="อัปโหลดโลโก้บริษัท (เก็บเฉพาะหน้านี้ ไม่บันทึกลงเครื่อง)">🏢 โลโก้บริษัท</button>' +
        '<button type="button" data-lgact="cycle" title="สลับ: นายช่างใหญ่ Civil Apps → โลโก้บริษัท → ว่าง">' + nextLbl + '</button>' +
        '<input type="file" accept="image/*" data-lgfile style="display:none">' +
      '</div>';
    return '' +
      '<div class="ckds-titleblock">' +
        '<div class="ckds-tb-brand">' + brandTop + '<div class="bs">นายช่างใหญ่ Civil Apps · ' + ed('client', TB.client, 'เจ้าของโครงการ') + '</div>' + logoCtl + '</div>' +
        '<div class="ckds-tb-mid">' +
          '<div class="ckds-tb-title"><span class="lbl">ชื่อแบบ · Drawing Title</span>' +
            '<span class="v1">' + escapeHtml(name) + '</span>' +
            '<span class="v2">แบบขยายการเสริมเหล็ก · Reinforcement Detail (' + escapeHtml(sub) + ')</span></div>' +
          '<div class="ckds-tb-proj"><span class="lbl">โครงการ · Project &nbsp;|&nbsp; ผู้ออกแบบ · Engineer &nbsp;|&nbsp; กริด · Grid</span>' +
            '<div class="pv">' + ed('project', TB.project, 'ชื่อโครงการ') + ' &nbsp;|&nbsp; ' + ed('pe', TB.pe, 'วิศวกร · ใบอนุญาต') + ' &nbsp;|&nbsp; ' + ed('gridY', TB.gridY, 'A') + '/' + ed('gridX', TB.gridX, '1') + '</div></div>' +
        '</div>' +
        '<div class="ckds-tb-meta">' +
          cell('สเกล · Scale', scaleText || 'AS SHOWN') +
          cell('วันที่ · Date', thaiDate()) +
          cellEd('แผ่นที่ · Dwg No', 'dwgNo', TB.dwgNo || sheetCode, sheetCode) +
          cellEd('แก้ไข · Rev', 'rev', TB.rev, '0') +
          cellEd('เขียนแบบ · Drawn', 'drawn', TB.drawn, '—') +
          cellEd('ตรวจสอบ · Checked', 'checked', TB.checked, '—') +
        '</div>' +
      '</div>';
  }
  function revTable() {
    var r = loadRev();
    var head = '<div class="rt-row rt-head"><span class="c0">Rev</span><span class="c1">วันที่ · Date</span><span class="c2">รายละเอียดการแก้ไข · Description</span><span class="c3 noprint"></span></div>';
    var rows = r.map(function (it, i) {
      return '<div class="rt-row">' +
        '<span class="c0"><span class="edr" contenteditable="true" data-revi="' + i + '" data-revf="rev">' + escapeHtml(it.rev || '') + '</span></span>' +
        '<span class="c1"><span class="edr" contenteditable="true" data-revi="' + i + '" data-revf="date">' + escapeHtml(it.date || '') + '</span></span>' +
        '<span class="c2"><span class="edr" contenteditable="true" data-revi="' + i + '" data-revf="desc">' + escapeHtml(it.desc || '') + '</span></span>' +
        '<span class="c3 noprint"><a data-revdel="' + i + '" title="ลบแถว">✕</a></span></div>';
    }).join('');
    return '<div class="ckds-revtable">' +
      '<div class="rt-title">ประวัติการแก้ไขแบบ · REVISIONS <a class="rt-add noprint" data-revadd="1">+ เพิ่มแถว</a></div>' +
      head + (rows || '<div class="rt-row rt-empty">— ยังไม่มีการแก้ไข · กด “+ เพิ่มแถว” —</div>') +
      '</div>';
  }
  function cell(lbl, v) { return '<div class="cell"><span class="lbl">' + lbl + '</span><span class="v">' + escapeHtml(v) + '</span></div>'; }
  function cellEd(lbl, field, v, ph) { return '<div class="cell"><span class="lbl">' + lbl + '</span><span class="v">' + ed(field, v, ph) + '</span></div>'; }
  function bindTitleBlock(root) {
    root.querySelectorAll('.ed').forEach(function (el) {
      var f = el.dataset.tb;
      if (!el.textContent.trim() && el.dataset.ph) el.classList.add('ph'), el.textContent = el.dataset.ph;
      el.addEventListener('focus', function () { if (el.classList.contains('ph')) { el.textContent = ''; el.classList.remove('ph'); } });
      el.addEventListener('blur', function () {
        var t = el.textContent.trim();
        TB[f] = t; saveTB();
        if (!t && el.dataset.ph) { el.classList.add('ph'); el.textContent = el.dataset.ph; }
      });
    });
    // revision-row editables
    root.querySelectorAll('.edr').forEach(function (el) {
      el.addEventListener('blur', function () {
        var arr = loadRev(), i = +el.dataset.revi; if (!arr[i]) return;
        arr[i][el.dataset.revf] = el.textContent.trim(); saveRev(arr);
      });
    });
    root.querySelectorAll('a[data-revdel]').forEach(function (a) {
      a.addEventListener('click', function () { var arr = loadRev(); arr.splice(+a.dataset.revdel, 1); saveRev(arr); rebuild(); });
    });
    var add = root.querySelector('a[data-revadd]');
    if (add) add.addEventListener('click', function () { var arr = loadRev(); arr.push({ rev: String(arr.length + 1), date: thaiDate(), desc: '' }); saveRev(arr); rebuild(); });
    // on-sheet company-logo controls (session-only, hidden in print)
    var lgFile = root.querySelector('input[data-lgfile]');
    var lgUp = root.querySelector('button[data-lgact="up"]');
    var lgCy = root.querySelector('button[data-lgact="cycle"]');
    if (lgUp && lgFile) {
      lgUp.addEventListener('click', function () { lgFile.click(); });
      lgFile.addEventListener('change', function () {
        var f = lgFile.files && lgFile.files[0]; if (!f) return;
        if (f.size > 1.5e6) { toast('ไฟล์ใหญ่เกิน 1.5MB'); return; }
        var rd = new FileReader();
        rd.onload = function () { LOGO.data = rd.result; LOGO.mode = 'user'; rebuild(); toast('ตั้งโลโก้บริษัทแล้ว (เฉพาะหน้านี้)'); };
        rd.readAsDataURL(f);
      });
    }
    if (lgCy) lgCy.addEventListener('click', function () {
      if (LOGO.mode === 'brand') LOGO.mode = LOGO.data ? 'user' : 'none';
      else if (LOGO.mode === 'user') LOGO.mode = 'none';
      else LOGO.mode = 'brand';
      rebuild();
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m];
    });
  }

  /* ---------- modal + flexible toolbar ---------- */
  var _modal = null, _wrap = null;
  function opt(v, cur, label) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; }
  function controlsHTML() {
    var printer = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    var dl = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>';
    var scales = ['10', '15', '20', '25', '30', '40', '50', '75', '100', '150'];
    return '<span class="t-title">แบบก่อสร้าง</span>' +
      '<span class="grp"><label>กระดาษ <select data-ds="paper">' + opt('A4', DS.paper, 'A4') + opt('A3', DS.paper, 'A3') + opt('A2', DS.paper, 'A2') + opt('A1', DS.paper, 'A1') + '</select></label>' +
      '<label><select data-ds="orient">' + opt('land', DS.orient, 'แนวนอน') + opt('port', DS.orient, 'แนวตั้ง') + '</select></label></span>' +
      '<span class="grp"><label>สเกล <select data-ds="scale">' + opt('auto', DS.scale, 'อัตโนมัติ') + scales.map(function (s) { return opt(s, DS.scale, '1:' + s); }).join('') + '</select></label></span>' +
      '<span class="grp"><label><input type="checkbox" data-ds="mono"' + (DS.mono ? ' checked' : '') + '> ขาว-ดำ</label>' +
        '<label><input type="checkbox" data-ds="north"' + (DS.north ? ' checked' : '') + '> เข็มทิศ</label>' +
        '<label><input type="checkbox" data-ds="grid"' + (DS.grid ? ' checked' : '') + '> กริด</label></span>' +
      '<span class="ckds-menu grp" id="ckdsViewsMenu"><button data-act="viewsmenu">รูป ▾</button><div class="pop" id="ckdsViewsPop"></div></span>' +
      '<span class="ckds-menu grp" id="ckdsLogoMenu"><button data-act="logomenu" title="โลโก้บริษัทในกรอบแบบ">โลโก้ ▾</button>' +
        '<div class="pop"><a data-logo="up">อัปโหลดโลโก้…</a><a data-logo="rm">ลบโลโก้</a></div>' +
        '<input type="file" id="ckdsLogoInput" accept="image/*" style="display:none"></span>' +
      '<span class="grp"><button data-act="addset" title="เพิ่มแผ่นนี้เข้าชุดแบบ">+ ชุด</button>' +
        '<span class="ckds-menu" id="ckdsSetMenu"><button data-act="setmenu">ชุดแบบ (<b id="ckdsSetCount">' + setCount() + '</b>) ▾</button><div class="pop" id="ckdsSetPop"></div></span></span>' +
      '<span class="sp"></span>' +
      '<span class="ckds-menu" id="ckdsExpMenu"><button data-act="expmenu" title="ส่งออกไฟล์">' + dl + ' Export ▾</button>' +
        '<div class="pop">' +
          '<a data-exp="dxf">DXF — เปิดใน AutoCAD/CAD</a>' +
          '<a data-exp="svg">SVG — เวกเตอร์</a>' +
          '<a data-exp="png">PNG — รูปภาพ</a>' +
          '<div style="border-top:1px solid #243140;margin:4px 0 2px;padding:5px 9px 0;font-size:10.5px;color:#7f93ab;line-height:1.5">DWG: ส่งออก DXF แล้วเปิดใน AutoCAD → Save As .dwg</div>' +
        '</div></span>' +
      '<button class="primary" data-act="plot" title="พิมพ์เป็น PDF">' + printer + ' Plot PDF</button>' +
      '<button data-act="close">ปิด</button>';
  }
  function openModal() {
    injectCSS();
    closeModal();
    var modal = document.createElement('div');
    modal.className = 'ckds-modal';
    var bar = document.createElement('div');
    bar.className = 'ckds-toolbar';
    bar.innerHTML = controlsHTML();
    var stage = document.createElement('div');
    stage.className = 'ckds-stage';
    var wrap = document.createElement('div');
    wrap.className = 'ckds-sheetwrap';
    var hint = document.createElement('div');
    hint.className = 'ckds-hint';
    hint.textContent = 'แตะช่องในกรอบ (โครงการ/เลขแผ่น/ผู้เขียน-ตรวจ) เพื่อแก้ไข — ระบบจำค่าให้ข้ามเครื่องมือ · เลือกกระดาษ/สเกล/ขาว-ดำ แล้วกด Plot PDF (Save as PDF) หรือ DXF เปิดใน AutoCAD';
    stage.appendChild(wrap);
    stage.appendChild(hint);
    modal.appendChild(bar);
    modal.appendChild(stage);
    document.body.appendChild(modal);
    _modal = modal; _wrap = wrap;
    wireControls(bar);
    renderSheet();      // build + auto-fill the page (sheet is in the DOM → measurable)
    document.addEventListener('keydown', escClose);
    window.addEventListener('resize', fit);
    fit();
  }
  function renderSheet() {
    if (!_wrap) return;
    CK_FILL = 1;
    _wrap.innerHTML = '';
    _wrap.appendChild(buildSheet());
    autoFill();
  }
  // grow drawings (height budget) until the views fill the sheet — print-static, no empty page.
  // Discrete scale ladder can overshoot → after each grow, revert if it overflowed.
  function autoFill() {
    if (CK_FORCE > 0 || !_wrap) return;     // manual scale → respect it exactly
    var sheet = _wrap.querySelector('.ckds-sheet');
    if (!sheet || !sheet.querySelector('svg.ckds-scaled')) return;
    function measure() {
      var views = sheet.querySelector('.ckds-views'); if (!views) return null;
      var ct = views.getBoundingClientRect(); if (!(ct.height > 4)) return null;
      var mb = 0;
      views.querySelectorAll('.ckds-view').forEach(function (v) { var b = v.getBoundingClientRect().bottom - ct.top; if (b > mb) mb = b; });
      return mb > 4 ? { avail: ct.height, used: mb } : null;
    }
    function rebuildAt(f) { CK_FILL = f; _wrap.innerHTML = ''; _wrap.appendChild(buildSheet()); sheet = _wrap.querySelector('.ckds-sheet'); }
    for (var pass = 0; pass < 6; pass++) {
      var m = measure(); if (!m) return;
      var slack = m.avail / m.used;
      if (slack <= 1.04 || slack > 8) return;          // filled / degenerate
      var prev = CK_FILL;
      var next = Math.min(CK_FILL * Math.min(slack * 0.96, 1.6), 6);
      if (next <= prev + 1e-3) return;                  // width-bound → can't grow
      rebuildAt(next);
      var m2 = measure();
      if (m2 && m2.used > m2.avail + 1) { rebuildAt(prev); return; }   // overshot a ladder step → revert & stop
    }
  }
  function wireControls(bar) {
    bar.addEventListener('change', function (e) {
      var t = e.target, key = t.dataset && t.dataset.ds; if (!key) return;
      DS[key] = (t.type === 'checkbox') ? t.checked : t.value;
      saveState(); rebuild();
    });
    bar.addEventListener('click', function (e) {
      var exp = e.target.closest('a[data-exp]');
      if (exp) { var f = exp.dataset.exp; document.getElementById('ckdsExpMenu').classList.remove('open'); if (f === 'dxf') exportDXF(); else if (f === 'svg') exportSVG(); else if (f === 'png') exportPNG(); return; }
      var b = e.target.closest('button'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'plot') plot();
      else if (a === 'close') closeModal();
      else if (a === 'expmenu') document.getElementById('ckdsExpMenu').classList.toggle('open');
      else if (a === 'viewsmenu') { var m = document.getElementById('ckdsViewsMenu'); m.classList.toggle('open'); if (m.classList.contains('open')) buildViewsMenu(); }
      else if (a === 'addset') addToSet();
      else if (a === 'setmenu') { var sm = document.getElementById('ckdsSetMenu'); sm.classList.toggle('open'); if (sm.classList.contains('open')) buildSetMenu(); }
      else if (a === 'plotset') plotSet();
      else if (a === 'clearset') { saveSet([]); updateSetBadge(); buildSetMenu(); toast('ล้างชุดแบบแล้ว'); }
      else if (a === 'batchdxf') batchDXF();
      else if (a === 'batchsvg') batchSVG();
      else if (a === 'batchpng') batchPNG();
      else if (a === 'logomenu') document.getElementById('ckdsLogoMenu').classList.toggle('open');
    });
    bar.addEventListener('click', function (e) {
      var lg = e.target.closest('a[data-logo]'); if (!lg) return;
      document.getElementById('ckdsLogoMenu').classList.remove('open');
      if (lg.dataset.logo === 'rm') { saveLogo(''); rebuild(); toast('ลบโลโก้แล้ว'); }
      else document.getElementById('ckdsLogoInput').click();
    });
    var li = bar.querySelector('#ckdsLogoInput');
    if (li) li.addEventListener('change', function () {
      var f = li.files && li.files[0]; if (!f) return;
      if (f.size > 1.5e6) { toast('ไฟล์ใหญ่เกิน 1.5MB'); return; }
      var rd = new FileReader();
      rd.onload = function () { saveLogo(rd.result); rebuild(); toast('ตั้งโลโก้แล้ว'); };
      rd.readAsDataURL(f);
    });
  }
  function buildViewsMenu() {
    var pop = document.getElementById('ckdsViewsPop'); if (!pop) return;
    pop.innerHTML = _lastViewCaps.length ? _lastViewCaps.map(function (cap) {
      return '<label><input type="checkbox" data-vcap="' + escapeHtml(cap) + '"' + (_hidden[cap] ? '' : ' checked') + '> ' + escapeHtml(cap) + '</label>';
    }).join('') : '<div style="color:#7f93ab;font-size:11px">— ไม่มีรูป —</div>';
    pop.querySelectorAll('input[data-vcap]').forEach(function (cb) {
      cb.addEventListener('change', function () { var cap = cb.dataset.vcap; if (cb.checked) delete _hidden[cap]; else _hidden[cap] = true; rebuild(); });
    });
  }
  function rebuild() { if (!_wrap) return; renderSheet(); fit(); }
  function escClose(e) { if (e.key === 'Escape') closeModal(); }
  function closeModal() {
    if (_modal && _modal.parentNode) _modal.parentNode.removeChild(_modal);
    _modal = null; _wrap = null;
    document.removeEventListener('keydown', escClose);
    window.removeEventListener('resize', fit);
  }
  function fit() {
    if (!_wrap) return;
    var wh = paperWH(), stage = _wrap.parentNode;
    var mobile = window.innerWidth <= 640;
    var availW = stage.clientWidth - (mobile ? 16 : 48), availH = stage.clientHeight - 40;
    var sw = wh.W * MM, sh = wh.H * MM;
    // on phones: fit to WIDTH (readable) and scroll vertically; on desktop: fit fully
    var k = mobile ? (availW / sw) : Math.min(availW / sw, availH / sh, 1.6);
    if (!(k > 0)) k = 1;
    _wrap.style.transform = 'scale(' + k + ')';
    _wrap.style.height = (sh * k) + 'px';
    _wrap.style.width = sw + 'px';
  }

  /* ---------- plot (print to PDF, paper-aware) ---------- */
  function plot() {
    var wh = paperWH();
    var ps = document.getElementById('ckds-page') || document.createElement('style');
    ps.id = 'ckds-page';
    ps.textContent = '@media print{@page{size:' + wh.W + 'mm ' + wh.H + 'mm;margin:0}}';
    document.head.appendChild(ps);
    var html = document.documentElement;
    html.classList.add('ckds-plot');
    var done = function () { html.classList.remove('ckds-plot'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 80);
    setTimeout(function () { html.classList.remove('ckds-plot'); }, 60000);
  }

  /* ---------- DXF export (R12 ASCII — opens in AutoCAD / LibreCAD / any CAD) ---------- */
  function downloadBlob(blob, name) {
    try {
      var url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = name; document.body.appendChild(a); a.click();
      setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
    } catch (e) { alert('ดาวน์โหลดไม่สำเร็จ: ' + e.message); }
  }
  function downloadFile(text, name, mime) { downloadBlob(new Blob([text], { type: mime || 'text/plain' }), name); }
  function sheetCodeStr() { return (txt('.appbar .sheet') || 'drawing').replace(/[^\w-]/g, ''); }
  function dxfColor(hex) {
    hex = (hex || '').toLowerCase();
    if (hex.indexOf('c0202a') >= 0) return { l: 'REBAR', c: 1 };
    if (hex.indexOf('1656a6') >= 0) return { l: 'STIRRUP', c: 5 };
    if (hex.indexOf('1a1a1a') >= 0 || hex.indexOf('8a8a8a') >= 0) return { l: 'DIM', c: 8 };
    if (hex.indexOf('555') >= 0 || hex.indexOf('777') >= 0 || hex.indexOf('7a6f57') >= 0) return { l: 'NOTE', c: 8 };
    return { l: 'OUTLINE', c: 7 };
  }
  function dxfL(x1, y1, x2, y2, col) { return '0\nLINE\n8\n' + col.l + '\n62\n' + col.c + '\n10\n' + f3(x1) + '\n20\n' + f3(y1) + '\n11\n' + f3(x2) + '\n21\n' + f3(y2) + '\n'; }
  function dxfC(cx, cy, r, col) { return '0\nCIRCLE\n8\n' + col.l + '\n62\n' + col.c + '\n10\n' + f3(cx) + '\n20\n' + f3(cy) + '\n40\n' + f3(r) + '\n'; }
  function dxfT(x, y, hh, s, ang, col) { return '0\nTEXT\n8\nTEXT\n62\n' + col.c + '\n10\n' + f3(x) + '\n20\n' + f3(y) + '\n40\n' + f3(hh) + '\n50\n' + f3(ang || 0) + '\n1\n' + String(s).replace(/[\n\r]/g, ' ') + '\n'; }
  function f3(v) { return (Math.round(v * 1000) / 1000); }
  function rotOf(el) { var t = el.getAttribute('transform') || ''; var m = t.match(/rotate\(\s*(-?[\d.]+)/); return m ? -parseFloat(m[1]) : 0; }
  function svgToDxf(svg, denom, ox, oy) {
    // real mm = svg-unit × denom ; Y flipped (DXF up). ox/oy = offsets (real mm)
    var ent = ''; oy = oy || 0;
    function X(v) { return ox + v * denom; }
    function Y(v) { return oy - (v * denom); }
    svg.querySelectorAll('line').forEach(function (e) {
      var col = dxfColor(e.getAttribute('stroke'));
      ent += dxfL(X(+e.getAttribute('x1')), Y(+e.getAttribute('y1')), X(+e.getAttribute('x2')), Y(+e.getAttribute('y2')), col);
    });
    svg.querySelectorAll('rect').forEach(function (e) {
      var col = dxfColor(e.getAttribute('stroke') || '#111');
      var x = +e.getAttribute('x'), y = +e.getAttribute('y'), w = +e.getAttribute('width'), h = +e.getAttribute('height');
      ent += dxfL(X(x), Y(y), X(x + w), Y(y), col) + dxfL(X(x + w), Y(y), X(x + w), Y(y + h), col) +
             dxfL(X(x + w), Y(y + h), X(x), Y(y + h), col) + dxfL(X(x), Y(y + h), X(x), Y(y), col);
    });
    svg.querySelectorAll('circle').forEach(function (e) {
      var col = dxfColor(e.getAttribute('fill') || e.getAttribute('stroke') || '#111');
      ent += dxfC(X(+e.getAttribute('cx')), Y(+e.getAttribute('cy')), Math.max(0.1, (+e.getAttribute('r')) * denom), col);
    });
    svg.querySelectorAll('text').forEach(function (e) {
      var anchor = e.getAttribute('text-anchor') || 'start';
      var fs = (parseFloat(e.getAttribute('font-size')) || 2.4) * denom;
      var x = +e.getAttribute('x'), y = +e.getAttribute('y');
      var col = dxfColor(e.getAttribute('fill') || '#111');
      var s = e.textContent || '';
      var xx = X(x); if (anchor === 'middle') xx -= s.length * fs * 0.28; else if (anchor === 'end') xx -= s.length * fs * 0.55;
      ent += dxfT(xx, Y(y) - fs * 0.2, fs, s, rotOf(e), col);
    });
    return ent;
  }
  function dxfLayerTable() {
    // [name, ACI colour, lineweight (1/100 mm)]
    var L = [['OUTLINE', 7, 35], ['REBAR', 1, 50], ['STIRRUP', 5, 35], ['DIM', 8, 13], ['NOTE', 8, 13], ['TEXT', 7, 18]];
    var s = '0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n' + L.length + '\n';
    L.forEach(function (x) { s += '0\nLAYER\n2\n' + x[0] + '\n70\n0\n62\n' + x[1] + '\n6\nCONTINUOUS\n370\n' + x[2] + '\n'; });
    return s + '0\nENDTAB\n0\nENDSEC\n';
  }
  function exportDXF() {
    var sheet = $('.ckds-sheet'); if (!sheet) return;
    var svgs = sheet.querySelectorAll('svg.ckds-scaled');
    if (!svgs.length) { alert('แบบนี้ยังไม่มีรูปตามมาตราส่วนจริง — DXF รองรับเฉพาะรูป true-scale (กดเลือกเครื่องมือที่มีสเกล 1:N)'); return; }
    var ent = '', ox = 0, gap = 300;   // 300 mm gap between views in model space
    svgs.forEach(function (svg) {
      var denom = parseFloat(svg.getAttribute('data-denom')) || 1;
      var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
      ent += svgToDxf(svg, denom, ox - vb[0] * denom);
      ox += vb[2] * denom + gap;
    });
    var dxf = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n' + dxfLayerTable() +
      '0\nSECTION\n2\nENTITIES\n' + ent + '0\nENDSEC\n0\nEOF\n';   // $INSUNITS=4 → millimetres
    downloadFile(dxf, 'CKD_' + sheetCodeStr() + '.dxf', 'application/dxf');
  }

  /* ---------- PNG / SVG export of the true-scale views ---------- */
  function combinedSVG(pxPerMm) {
    var sheet = $('.ckds-sheet'); if (!sheet) return null;
    var svgs = sheet.querySelectorAll('svg.ckds-scaled'); if (!svgs.length) return null;
    var pad = 8, gap = 12, y = pad, maxW = 0, parts = [];
    svgs.forEach(function (svg) {
      var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
      var w = vb[2], h = vb[3];
      var cell = svg.closest('.ckds-view'); var title = (cell && cell.querySelector('.vh')) ? cell.querySelector('.vh').textContent : '';
      parts.push('<text x="' + pad + '" y="' + (y + 4) + '" font-size="3.6" font-weight="800" fill="#10243c" font-family="Sarabun,sans-serif">' + escapeHtml(title) + '</text>');
      parts.push('<g transform="translate(' + (pad - vb[0]) + ',' + (y + 7 - vb[1]) + ')">' + svg.innerHTML + '</g>');
      y += h + 7 + gap; maxW = Math.max(maxW, w + 2 * pad);
    });
    var H = y, W = maxW;
    var dim = pxPerMm ? ('width="' + (W * pxPerMm) + '" height="' + (H * pxPerMm) + '"') : ('width="' + W.toFixed(1) + 'mm" height="' + H.toFixed(1) + 'mm"');
    return '<svg xmlns="http://www.w3.org/2000/svg" ' + dim + ' viewBox="0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '">' +
      '<rect width="' + W.toFixed(2) + '" height="' + H.toFixed(2) + '" fill="#ffffff"/>' + parts.join('') + '</svg>';
  }
  function exportSVG() {
    var svg = combinedSVG(0); if (!svg) { alert('แบบนี้ยังไม่มีรูปตามมาตราส่วนจริงสำหรับส่งออก SVG'); return; }
    downloadFile(svg, 'CKD_' + sheetCodeStr() + '.svg', 'image/svg+xml');
  }
  function exportPNG() {
    var svg = combinedSVG(8); if (!svg) { alert('แบบนี้ยังไม่มีรูปตามมาตราส่วนจริงสำหรับส่งออก PNG'); return; }   // ~203 dpi
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas');
      cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0);
      try { cv.toBlob(function (b) { if (b) downloadBlob(b, 'CKD_' + sheetCodeStr() + '.png'); else alert('สร้าง PNG ไม่สำเร็จ'); }, 'image/png'); }
      catch (e) { alert('สร้าง PNG ไม่สำเร็จ: ' + e.message); }
    };
    img.onerror = function () { alert('สร้าง PNG ไม่สำเร็จ (อาจมีฟอนต์ที่ raster ไม่ได้)'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------- BATCH export of the whole drawing set ---------- */
  function setScaledSvgs() {
    // parse stored set-sheet HTML and return [{svg, code}] for every true-scale view
    var arr = setIncluded(), list = [];
    arr.forEach(function (it) {
      var tmp = document.createElement('div'); tmp.innerHTML = it.html;
      tmp.querySelectorAll('svg.ckds-scaled').forEach(function (s) { list.push({ svg: s, code: it.code }); });
    });
    return list;
  }
  function batchDXF() {
    var arr = setIncluded(); if (!arr.length) { toast('ยังไม่ได้เลือกแผ่น'); return; }
    var ent = '', oy = 0, any = false;
    arr.forEach(function (it) {
      var tmp = document.createElement('div'); tmp.innerHTML = it.html;
      var svgs = tmp.querySelectorAll('svg.ckds-scaled'); if (!svgs.length) return;
      var ox = 0, rowH = 0;
      svgs.forEach(function (svg) {
        any = true;
        var denom = parseFloat(svg.getAttribute('data-denom')) || 1;
        var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
        ent += svgToDxf(svg, denom, ox - vb[0] * denom, oy);
        ox += vb[2] * denom + 300; rowH = Math.max(rowH, vb[3] * denom);
      });
      oy -= rowH + 900;   // next sheet's views stacked below in model space
    });
    if (!any) { toast('ชุดแบบไม่มีรูปตามมาตราส่วน'); return; }
    var dxf = '0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n' + dxfLayerTable() +
      '0\nSECTION\n2\nENTITIES\n' + ent + '0\nENDSEC\n0\nEOF\n';
    downloadFile(dxf, 'CKD_SET.dxf', 'application/dxf');
  }
  function combinedSetSVG(pxPerMm) {
    var list = setScaledSvgs(); if (!list.length) return null;
    var pad = 8, gap = 12, y = pad, maxW = 0, parts = [];
    list.forEach(function (o) {
      var svg = o.svg, vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/\s+/).map(Number);
      var w = vb[2], h = vb[3];
      parts.push('<text x="' + pad + '" y="' + (y + 4) + '" font-size="3.4" font-weight="800" fill="#10243c" font-family="Sarabun,sans-serif">' + escapeHtml(o.code) + '</text>');
      parts.push('<g transform="translate(' + (pad - vb[0]) + ',' + (y + 7 - vb[1]) + ')">' + svg.innerHTML + '</g>');
      y += h + 7 + gap; maxW = Math.max(maxW, w + 2 * pad);
    });
    var W = maxW, H = y;
    var dim = pxPerMm ? ('width="' + (W * pxPerMm) + '" height="' + (H * pxPerMm) + '"') : ('width="' + W.toFixed(1) + 'mm" height="' + H.toFixed(1) + 'mm"');
    return '<svg xmlns="http://www.w3.org/2000/svg" ' + dim + ' viewBox="0 0 ' + W.toFixed(2) + ' ' + H.toFixed(2) + '"><rect width="' + W.toFixed(2) + '" height="' + H.toFixed(2) + '" fill="#fff"/>' + parts.join('') + '</svg>';
  }
  function batchSVG() { var s = combinedSetSVG(0); if (!s) { toast('ชุดแบบไม่มีรูปตามมาตราส่วน'); return; } downloadFile(s, 'CKD_SET.svg', 'image/svg+xml'); }
  function batchPNG() {
    var s = combinedSetSVG(6); if (!s) { toast('ชุดแบบไม่มีรูปตามมาตราส่วน'); return; }
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = img.naturalWidth || img.width; cv.height = img.naturalHeight || img.height;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0);
      try { cv.toBlob(function (b) { if (b) downloadBlob(b, 'CKD_SET.png'); }, 'image/png'); } catch (e) { alert('สร้าง PNG ไม่สำเร็จ'); }
    };
    img.onerror = function () { alert('สร้าง PNG ไม่สำเร็จ'); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
  }

  /* ---------- multi-sheet drawing SET (persists across tools) ---------- */
  function loadSet() { try { return JSON.parse(localStorage.getItem('ckds_set') || '[]'); } catch (e) { return []; } }
  function saveSet(a) { try { localStorage.setItem('ckds_set', JSON.stringify(a)); } catch (e) {} }
  function setCount() { return loadSet().length; }
  function updateSetBadge() { var b = document.getElementById('ckdsSetCount'); if (b) b.textContent = setCount(); }
  function addToSet() {
    var sheet = $('.ckds-sheet'); if (!sheet) return;
    var arr = loadSet();
    arr.push({ code: txt('.appbar .sheet') || '—', name: txt('.appbar .appname') || 'แบบ', html: sheet.outerHTML });
    if (arr.length > 40) arr = arr.slice(-40);
    saveSet(arr); updateSetBadge(); toast('เพิ่มเข้าชุดแบบแล้ว · รวม ' + arr.length + ' แผ่น');
  }
  function setIncluded() { return loadSet().filter(function (x) { return x.on !== false; }); }
  function buildSetMenu() {
    var pop = document.getElementById('ckdsSetPop'); if (!pop) return;
    var arr = loadSet(); var nOn = setIncluded().length;
    var rows = arr.length ? arr.map(function (it, i) {
      return '<div class="setrow"><label style="flex:1;display:flex;gap:6px;align-items:center;cursor:pointer">' +
        '<input type="checkbox" data-seton="' + i + '"' + (it.on !== false ? ' checked' : '') + '>' +
        '<span>' + (i + 1) + '. ' + escapeHtml(it.code) + ' · ' + escapeHtml(it.name) + '</span></label>' +
        '<a data-setdel="' + i + '" title="ลบแผ่นนี้">✕</a></div>';
    }).join('') : '<div style="color:#7f93ab;font-size:11px;padding:5px 2px">— ชุดแบบว่าง · กด “+ ชุด” เพื่อเพิ่มแผ่นปัจจุบัน —</div>';
    pop.innerHTML = rows + '<div class="setactions">' +
      '<button data-act="plotset"' + (nOn ? '' : ' disabled') + '>Plot ที่เลือก (' + nOn + ')</button>' +
      '<button data-act="clearset"' + (arr.length ? '' : ' disabled') + '>ล้างชุด</button></div>' +
      '<div class="setactions"><button data-act="batchdxf"' + (nOn ? '' : ' disabled') + '>DXF</button>' +
      '<button data-act="batchsvg"' + (nOn ? '' : ' disabled') + '>SVG</button>' +
      '<button data-act="batchpng"' + (nOn ? '' : ' disabled') + '>PNG</button></div>';
    pop.querySelectorAll('a[data-setdel]').forEach(function (a) {
      a.addEventListener('click', function () { var x = loadSet(); x.splice(+a.dataset.setdel, 1); saveSet(x); updateSetBadge(); buildSetMenu(); });
    });
    pop.querySelectorAll('input[data-seton]').forEach(function (cb) {
      cb.addEventListener('change', function () { var x = loadSet(), i = +cb.dataset.seton; if (x[i]) { x[i].on = cb.checked; saveSet(x); buildSetMenu(); } });
    });
  }
  function plotSet() {
    var arr = setIncluded(); if (!arr.length) { toast('ยังไม่ได้เลือกแผ่น'); return; }
    var wh = paperWH();
    var ps = document.getElementById('ckds-page') || document.createElement('style'); ps.id = 'ckds-page';
    ps.textContent = '@media print{@page{size:' + wh.W + 'mm ' + wh.H + 'mm;margin:0}}'; document.head.appendChild(ps);
    var cont = document.createElement('div'); cont.className = 'ckds-setprint';
    cont.innerHTML = arr.map(function (it) { return '<div class="setpage">' + it.html + '</div>'; }).join('');
    document.body.appendChild(cont);
    var html = document.documentElement; html.classList.add('ckds-setplot');
    var done = function () { html.classList.remove('ckds-setplot'); if (cont.parentNode) cont.parentNode.removeChild(cont); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 120);
    setTimeout(function () { if (document.querySelector('.ckds-setprint')) done(); }, 60000);
  }
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'ckds-toast'; t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 300); }, 2300);
  }

  /* ---------- inject button into appbar ---------- */
  /* ====================================================================
   * CALCULATION REPORT — clean A4-portrait academic/homework-style PDF
   * (harvests the tool's #repBody step-by-step working: formula→substitute→
   * answer→reference→check). Parallel to the construction-drawing plot.
   * ==================================================================*/
  function calcStandard() {
    try { var d = JSON.parse(localStorage.getItem('ckPrintReportV1') || '{}'); if (d.aci) return d.aci; } catch (e) {}
    return 'ACI 318-19 (วิธีกำลัง · Strength Design) · กฎกระทรวงฯ พ.ศ. 2566';
  }
  function injectCalcCSS() {
    if (document.getElementById('ckcr-style')) return;
    var s = document.createElement('style'); s.id = 'ckcr-style';
    s.textContent = [
      '.ckcr-modal{position:fixed;inset:0;z-index:2147483600;background:#11161d;display:flex;flex-direction:column;font-family:"Sarabun",-apple-system,"Segoe UI",sans-serif}',
      '.ckcr-toolbar{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:9px 14px;background:#0b0f14;border-bottom:1px solid #222e3c;color:#cdd9e8;flex-wrap:wrap}',
      '.ckcr-toolbar .t-title{font-weight:800;font-size:13px;color:#eaf1fa}',
      '.ckcr-toolbar .t-sub{font-size:11px;color:#7f93ab}',
      '.ckcr-toolbar .sp{flex:1 1 auto}',
      '.ckcr-toolbar button{display:inline-flex;align-items:center;gap:6px;border:1px solid #2c3a4c;background:#16202c;color:#dce7f3;font-weight:700;font-size:12.5px;padding:7px 13px;border-radius:8px;cursor:pointer;font-family:inherit}',
      '.ckcr-toolbar button.primary{background:linear-gradient(135deg,#1B4F8C,#3A7BD5);border-color:#1B4F8C;color:#fff}',
      '.ckcr-stage{flex:1 1 auto;overflow:auto;display:flex;justify-content:center;padding:22px}',
      '.ckcr-doc{width:210mm;min-height:297mm;background:#fff;color:#1a2330;box-shadow:0 10px 50px rgba(0,0,0,.6);box-sizing:border-box;padding:15mm 16mm;height:max-content}',
      '.ckcr-hdr{border-bottom:1.5pt solid #1B4F8C;padding-bottom:3mm;margin-bottom:4mm;display:flex;align-items:flex-end;gap:4mm}',
      '.ckcr-hdr .bz{flex:0 0 auto}',
      '.ckcr-hdr .bn{font-size:17pt;font-weight:800;color:#1B4F8C;line-height:1}',
      '.ckcr-hdr .bs{font-size:7.5pt;color:#64748b;letter-spacing:1.5px;text-transform:uppercase}',
      '.ckcr-hdr .rt{margin-left:auto;text-align:right}',
      '.ckcr-hdr .rt .v1{font-size:13pt;font-weight:800;color:#0E1A2E}',
      '.ckcr-hdr .rt .v2{font-size:9pt;color:#475569;font-weight:600}',
      '.ckcr-hdr img.ckcr-logo{max-height:14mm;max-width:46mm;object-fit:contain}',
      '.ckcr-meta{display:grid;grid-template-columns:1fr 1fr;gap:1mm 6mm;font-size:9pt;color:#1a2330;border:0.4mm solid #cbd5e1;border-radius:1.5mm;padding:2.5mm 3.5mm;margin-bottom:4mm}',
      '.ckcr-meta div{display:flex;gap:4px;border-bottom:0.3mm dotted #e2e8f0;padding:0.6mm 0}',
      '.ckcr-meta div span{color:#64748b;min-width:26mm}',
      '.ckcr-meta div b{color:#0E1A2E}',
      '.ckcr-steps{font-size:9.5pt}',
      '.ckcr-steps .rep-step{page-break-inside:avoid;break-inside:avoid}',
      '.ckcr-sign{margin-top:8mm;display:flex;gap:14mm;page-break-inside:avoid}',
      '.ckcr-sign .sg{flex:1;text-align:center;font-size:9pt;color:#334155}',
      '.ckcr-sign .sg .ln{border-top:0.5mm solid #1a2330;margin:14mm 0 1.5mm}',
      '.ckcr-rf{display:none}',
      '.ckcr-hint{font-size:7pt;color:#7f93ab;text-align:center;margin:6px 0 0}',
      '@media(max-width:760px){.ckcr-doc{width:100%;min-width:0;padding:9mm}.ckcr-toolbar .t-title{display:none}}',
      '@media print{',
      '  html.ckcr-print,html.ckcr-print body{background:#fff!important;margin:0!important;padding:0!important;height:auto!important;overflow:visible!important}',
      '  html.ckcr-print body>*:not(.ckcr-modal){display:none!important}',
      '  html.ckcr-print .ckcr-modal{position:static!important;background:#fff!important;display:block!important}',
      '  html.ckcr-print .ckcr-toolbar,html.ckcr-print .ckcr-hint{display:none!important}',
      '  html.ckcr-print .ckcr-stage{overflow:visible!important;padding:0!important;display:block!important}',
      '  html.ckcr-print .ckcr-doc{box-shadow:none!important;width:auto!important;min-height:0!important;padding:0!important;margin:0!important}',
      '  html.ckcr-print .ckcr-rf{display:block;position:fixed;bottom:0;left:0;right:0;font-size:7pt;color:#64748b;border-top:0.3mm solid #cbd5e1;padding:1.5mm 2mm;text-align:center;background:#fff}',
      '  html.ckcr-print .ckcr-doc>.ckcr-steps{padding-bottom:8mm}',
      '  @page{size:A4 portrait;margin:14mm 14mm 16mm 16mm}',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function calcMetaRow(lbl, val) { return '<div><span>' + lbl + '</span><b>' + escapeHtml(val || '—') + '</b></div>'; }
  function buildCalcDoc() {
    var brand = txt('.appbar .brand') || 'นายช่างใหญ่ Civil Apps';
    var name = txt('.appbar .appname') || 'รายการคำนวณ';
    var sheetCode = txt('.appbar .sheet') || '—';
    var status = txt('.appbar .ws-status') || '';
    var rep = document.getElementById('repBody');
    // respect the report paywall: if the on-page report is locked (blurred), do NOT reveal it here
    var wrap = document.getElementById('ckrpWrap');
    var locked = wrap && wrap.classList.contains('locked');
    var steps;
    if (locked) {
      steps = '<div style="padding:16mm 8mm;text-align:center;color:#8a5018;font-size:10.5pt;line-height:1.7">' +
        '<div style="font-size:22pt;margin-bottom:3mm">🔒</div>' +
        '<b>วิธีคำนวณทีละขั้นตอนถูกล็อกอยู่</b><br>กรุณากดปุ่ม “📖 แสดงวิธีคำนวณ” ที่หน้าหลักเพื่อปลดล็อกก่อน<br>แล้วเปิด “รายการคำนวณ” อีกครั้ง</div>';
    } else {
      steps = (rep && rep.innerHTML.trim()) ? rep.innerHTML
        : '<div style="padding:12mm;text-align:center;color:#94a3b8;font-size:10pt">— ยังไม่มีรายการคำนวณ · กรุณากรอกข้อมูลให้ครบก่อน —</div>';
    }
    var logo = loadLogo();
    var doc = document.createElement('div'); doc.className = 'ckcr-doc';
    doc.innerHTML =
      '<div class="ckcr-hdr">' +
        '<div class="bz">' + (logo ? '<img class="ckcr-logo" src="' + logo + '">' : '<div class="bn">' + escapeHtml(brand) + '</div><div class="bs">นายช่างใหญ่ Civil Apps</div>') + '</div>' +
        '<div class="rt"><div class="v1">รายการคำนวณ · CALCULATION REPORT</div>' +
          '<div class="v2">' + escapeHtml(name) + ' &nbsp;·&nbsp; ' + escapeHtml(sheetCode) + (status ? ' &nbsp;·&nbsp; ' + escapeHtml(status) : '') + '</div></div>' +
      '</div>' +
      '<div class="ckcr-meta">' +
        calcMetaRow('โครงการ · Project', TB.project) +
        calcMetaRow('เจ้าของงาน · Owner', TB.client) +
        calcMetaRow('ผู้คำนวณ · Engineer', TB.pe || TB.drawn) +
        calcMetaRow('ผู้ตรวจสอบ · Checked', TB.checked) +
        calcMetaRow('เลขที่แบบ · Dwg No', TB.dwgNo || sheetCode) +
        calcMetaRow('วันที่ · Date', thaiDate()) +
        '<div style="grid-column:1/-1"><span>มาตรฐาน · Code</span><b>' + escapeHtml(calcStandard()) + '</b></div>' +
      '</div>' +
      '<div class="ckcr-steps">' + steps + '</div>' +
      '<div class="ckcr-sign">' +
        '<div class="sg"><div class="ln"></div>ผู้คำนวณ · Calculated by' + (TB.pe || TB.drawn ? '<div style="margin-top:1mm;font-weight:700">' + escapeHtml(TB.pe || TB.drawn) + '</div>' : '') + '</div>' +
        '<div class="sg"><div class="ln"></div>ผู้ตรวจสอบ/รับรอง · Checked &amp; Approved' + (TB.checked ? '<div style="margin-top:1mm;font-weight:700">' + escapeHtml(TB.checked) + '</div>' : '') + '</div>' +
      '</div>' +
      '<div class="ckcr-rf">' + escapeHtml(brand) + ' · รายการคำนวณ ' + escapeHtml(name) + ' (' + escapeHtml(sheetCode) + ') · ' + escapeHtml(calcStandard()) + ' · เอกสารต้องได้รับการรับรองจากวิศวกรผู้ออกแบบก่อนใช้ก่อสร้าง</div>';
    return doc;
  }
  var _crModal = null;
  function openCalcReport() {
    injectCalcCSS();
    if (_crModal && _crModal.parentNode) _crModal.parentNode.removeChild(_crModal);
    var modal = document.createElement('div'); modal.className = 'ckcr-modal';
    var bar = document.createElement('div'); bar.className = 'ckcr-toolbar';
    var printer = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>';
    bar.innerHTML = '<span class="t-title">รายการคำนวณ · Calculation Report</span><span class="t-sub">A4 · วิชาการ/ตำราเรียน</span>' +
      '<span class="sp"></span><button class="primary" data-cr="plot">' + printer + ' Plot PDF (A4)</button><button data-cr="close">ปิด</button>';
    var stage = document.createElement('div'); stage.className = 'ckcr-stage';
    stage.appendChild(buildCalcDoc());
    var hint = document.createElement('div'); hint.className = 'ckcr-hint';
    hint.textContent = 'รายการคำนวณวิชาการ (สูตร → แทนค่า → ผลลัพธ์ → ที่มา → ตรวจสอบ) · กรอกชื่อโครงการ/ผู้คำนวณได้ที่ปุ่ม “แบบก่อสร้าง” (จำค่าร่วมกัน) · กด Plot PDF → Save as PDF ขนาด A4';
    modal.appendChild(bar); stage.appendChild(hint); modal.appendChild(stage);
    document.body.appendChild(modal); _crModal = modal;
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.cr === 'plot') plotCalc();
      else if (b.dataset.cr === 'close') closeCalcReport();
    });
    document.addEventListener('keydown', escCalc);
  }
  function escCalc(e) { if (e.key === 'Escape') closeCalcReport(); }
  function closeCalcReport() {
    if (_crModal && _crModal.parentNode) _crModal.parentNode.removeChild(_crModal);
    _crModal = null; document.removeEventListener('keydown', escCalc);
  }
  function plotCalc() {
    var html = document.documentElement; html.classList.add('ckcr-print');
    var done = function () { html.classList.remove('ckcr-print'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    setTimeout(function () { try { window.print(); } catch (e) { done(); } }, 80);
    setTimeout(function () { html.classList.remove('ckcr-print'); }, 60000);
  }

  function injectButton() {
    var bar = $('.appbar'); if (!bar) return false;
    if ($('.ckds-open', bar)) return true;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'print ckds-open';
    btn.title = 'สร้างแบบก่อสร้าง A3 (PDF)';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M3 3h18v18H3z"/><path d="M3 8h18M8 8v13M3 16h5"/><path d="M14 12l3 3-3 3"/></svg>' +
      '<span class="ckds-lbl"> แบบก่อสร้าง</span>';
    btn.addEventListener('click', openModal);
    var ref = $('.print', bar) || $('.brand', bar);
    if (ref) bar.insertBefore(btn, ref); else bar.appendChild(btn);
    // second button: clean homework-style calculation report (A4)
    var cbtn = document.createElement('button');
    cbtn.type = 'button';
    cbtn.className = 'print ckds-calc';
    cbtn.title = 'รายการคำนวณวิชาการ (A4 · PDF)';
    cbtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>' +
      '<span class="ckds-lbl"> รายการคำนวณ</span>';
    cbtn.addEventListener('click', openCalcReport);
    if (ref) bar.insertBefore(cbtn, ref); else bar.appendChild(cbtn);
    return true;
  }

  function init() {
    if (!injectButton()) {
      // appbar may render late — retry briefly
      var n = 0, t = setInterval(function () { if (injectButton() || ++n > 40) clearInterval(t); }, 150);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CKDrawingSheet = { open: openModal, close: closeModal };
})();
