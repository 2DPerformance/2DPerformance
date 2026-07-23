/* ============================================================
   ck-print-report.js — รายงานการคำนวณวิชาการ (Academic Calc Report)
   ------------------------------------------------------------
   ใส่ก่อน </body> ของหน้าแอปย่อยใน /Concrete-design/* (หลัง ck-print-paywall.js):

     <script src="/ck-print-report.js" defer></script>

   หน้าที่:
   • เพิ่มกล่อง "ข้อมูลโครงการ" ใต้ appbar (collapsible) — ผู้ใช้กรอกเลขที่แบบ, โครงการ, เจ้าของ, สถานที่, วิศวกร, เลขใบประกอบฯ
   • เก็บใน localStorage → คงค่าไว้ทุกหน้า/ทุกครั้ง
   • เมื่อสั่งพิมพ์ → เรนเดอร์ส่วนหัวรายงาน + ลายเซ็นต์ + ลูกเก็บมุมหน้า
   • ใช้ CSS แบบ academic (A4, 15mm margin, header/footer ทุกหน้า)
   ============================================================ */
(function () {
  if (window.__ckPrintReportLoaded) return;
  window.__ckPrintReportLoaded = true;

  var STORE = "ckPrintReportV1";
  var APP_TITLE = (function () {
    var n = document.querySelector(".appbar .appname");
    return n ? n.textContent.trim() : "Foundation Lab";
  })();

  // ---------- โหลด/บันทึก ข้อมูลโครงการ ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function save(d) {
    try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {}
  }
  var data = load();
  // default มาตรฐานการออกแบบ = มยผ. 1101-64 + กฎกระทรวง พ.ศ. 2566 (ฉบับล่าสุดที่บังคับในไทย)
  // แอดมิน/วิศวกรเปลี่ยนเป็น ACI 318 อย่างเดียวได้สำหรับรายงานต่างประเทศ
  if (!data.aci || /^ACI 318-19 \(USD, 1\.2D/.test(data.aci)) {
    data.aci = "มยผ. 1101-64 (วิธีกำลัง · กรมโยธาฯ 2564) · กฎกระทรวง พ.ศ. 2566";
    save(data);
  }

  function todayThai() {
    var d = new Date();
    var months = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
    return d.getDate() + " " + months[d.getMonth()] + " " + (d.getFullYear() + 543);
  }

  // ---------- CSS ฝังในตัว ----------
  var style = document.createElement("style");
  style.textContent = [
    /* ============ Project Info Panel (in-app view) ============ */
    ".ckpr-panel{background:#fff;border:1px solid #E2E8F0;border-radius:14px;",
    "  box-shadow:0 4px 14px rgba(15,30,51,.05);max-width:1180px;margin:14px auto 0;",
    "  font-family:'Sarabun',-apple-system,'Segoe UI',sans-serif}",
    ".ckpr-head{display:flex;align-items:center;gap:9px;padding:11px 16px;cursor:pointer;",
    "  border-bottom:1px solid transparent;transition:border-color .15s}",
    ".ckpr-panel.open .ckpr-head{border-bottom-color:#E2E8F0}",
    ".ckpr-head .ico{width:24px;height:24px;border-radius:6px;background:linear-gradient(135deg,#1B4F8C,#3A7BD5);",
    "  color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800}",
    ".ckpr-head .ttl{flex:1;font-size:14px;font-weight:800;color:#1f2937}",
    ".ckpr-head .ttl small{font-weight:500;color:#64748b;font-size:11.5px;margin-left:6px}",
    ".ckpr-head .arr{color:#64748b;font-size:14px;transition:transform .15s}",
    ".ckpr-panel.open .ckpr-head .arr{transform:rotate(180deg)}",
    ".ckpr-body{display:none;padding:14px 16px 16px;background:#fafbfd}",
    ".ckpr-panel.open .ckpr-body{display:block}",
    ".ckpr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}",
    "@media(max-width:780px){.ckpr-grid{grid-template-columns:1fr 1fr}}",
    "@media(max-width:520px){.ckpr-grid{grid-template-columns:1fr}}",
    ".ckpr-f{display:flex;flex-direction:column;gap:3px}",
    ".ckpr-f label{font-size:11.5px;font-weight:600;color:#475569}",
    ".ckpr-f input{font-family:inherit;font-size:13.5px;font-weight:600;color:#1f2937;",
    "  border:1px solid #E2E8F0;border-radius:8px;padding:7px 10px;background:#fff;outline:none;",
    "  transition:border-color .12s, box-shadow .12s}",
    ".ckpr-f input:focus{border-color:#F58220;box-shadow:0 0 0 3px rgba(245,130,32,.13)}",
    ".ckpr-tip{font-size:11px;color:#64748b;margin-top:9px;padding-top:9px;border-top:1px dashed #E2E8F0;line-height:1.55}",
    ".ckpr-tip b{color:#1B4F8C}",
    /* ============ Print-only academic report cover ============ */
    ".ckpr-cover{display:none}",
    ".ckpr-runheader{display:none}",
    ".ckpr-runfooter{display:none}",
    "@media print{",
    "  /* A4 with academic margins (Chrome adds URL/page automatically in header/footer if enabled) */",
    "  @page{size:A4 portrait;margin:14mm 14mm 14mm 16mm}",
    "  html,body{background:#fff!important}",
    "  body{font-family:'Sarabun',-apple-system,'Segoe UI',sans-serif;color:#000;",
    "    font-size:10.5pt;line-height:1.45;orphans:3;widows:3}",
    "  /* Headings ตามทั่วไป — กันค้างท้ายหน้า */",
    "  h1,h2,h3,h4{page-break-after:avoid!important;break-after:avoid!important;",
    "    page-break-inside:avoid!important;break-inside:avoid!important}",
    "  /* Cover page: title + project info table + signature blocks */",
    "  .ckpr-cover{display:block;page-break-after:always;padding-top:4mm;position:relative}",
    "  .ckpr-cover .cv-brand{text-align:center;font-size:10pt;color:#1B4F8C;font-weight:700;letter-spacing:.5px;margin-bottom:6mm}",
    "  .ckpr-cover .cv-ttl{text-align:center;font-size:20pt;font-weight:800;color:#0f1e33;margin-bottom:3mm;line-height:1.2}",
    "  .ckpr-cover .cv-sub{text-align:center;font-size:12pt;font-weight:600;color:#475569;margin-bottom:10mm}",
    "  .ckpr-cover table.cv-info{width:100%;border-collapse:collapse;margin:0 auto;font-size:11pt}",
    "  .ckpr-cover table.cv-info td{padding:6px 9px;border:1px solid #94a3b8;vertical-align:top}",
    "  .ckpr-cover table.cv-info td.k{background:#f1f5f9;font-weight:700;color:#1B4F8C;width:32%}",
    "  .ckpr-cover table.cv-info td.v{font-weight:600;color:#1f2937;min-height:16px}",
    "  .ckpr-cover .cv-sig{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:14mm}",
    "  .ckpr-cover .cv-sig .sig{text-align:center}",
    "  .ckpr-cover .cv-sig .sig .line{border-top:1px solid #000;margin:0 6mm 3mm;padding-top:2mm;font-size:10pt;color:#475569}",
    "  .ckpr-cover .cv-sig .sig .role{font-weight:700;color:#1f2937;font-size:11pt;margin-bottom:20mm}",
    "  .ckpr-cover .cv-sig .sig .name{font-weight:700;color:#000;font-size:11pt}",
    "  .ckpr-cover .cv-sig .sig .lic{font-size:9.5pt;color:#475569}",
    "  /* Disclaimer block ในหน้าปก */",
    "  .ckpr-cover .cv-disclaimer{margin-top:10mm;border:1.2px solid #cbd5e1;border-radius:3pt;",
    "    padding:4mm 5mm;background:#FBFBFD}",
    "  .ckpr-cover .cv-disclaimer-ttl{font-size:9pt;font-weight:800;color:#9A4D0F;",
    "    text-transform:uppercase;letter-spacing:.5pt;margin-bottom:2mm;border-bottom:1px dashed #cbd5e1;",
    "    padding-bottom:1.5mm}",
    "  .ckpr-cover .cv-disclaimer-body{font-size:8.5pt;color:#1f2937;line-height:1.5;text-align:justify}",
    "  /* QR + verify block */",
    "  .ckpr-cover .cv-qr-block{margin-top:6mm;display:flex;gap:6mm;align-items:center;",
    "    border:1px dashed #cbd5e1;border-radius:3pt;padding:3.5mm 5mm;background:#F8FAFD}",
    "  .ckpr-cover .cv-qr-img{width:25mm;height:25mm;flex:0 0 auto}",
    "  .ckpr-cover .cv-qr-info{flex:1;font-size:8.5pt;color:#1f2937;line-height:1.55}",
    "  .ckpr-cover .cv-qr-url{font-family:'Courier New',monospace;font-size:8pt;color:#1B4F8C;",
    "    word-break:break-all;margin:1mm 0}",
    "  .ckpr-cover .cv-qr-note{font-size:8pt;color:#64748b}",
    "  /* Footnote เฉพาะหน้าปก — อยู่ inline ตำแหน่งปกติ (ไม่ fixed) */",
    "  .ckpr-cover .cv-footnote{margin-top:8mm;text-align:center;",
    "    font-size:9pt;color:#64748b;border-top:1px solid #cbd5e1;padding-top:3mm;line-height:1.5}",
    "  /* Watermark ทุกหน้าพิมพ์ — มุมล่างขวา */",
    "  body::before{content:'นายช่างใหญ่ Civil Apps · นายช่างใหญ่.com';position:fixed;",
    "    bottom:5mm;right:8mm;font-size:7.5pt;color:rgba(27,79,140,.55);",
    "    font-weight:600;letter-spacing:.4pt;z-index:9999;pointer-events:none}",
    "  /* Hide all interactive UI in print */",
    "  .appbar,footer,.callout,.note,.ckpr-panel,#ckpPreviewBadge,.ckpr-runheader,.ckpr-runfooter{display:none!important}",
    "  .v3d-hint,#v3dTone,#v3dColors,#v3dSize,#v3dToggles{display:none!important}",
    "  /* Keep 3D viewer but smaller */",
    "  .viewer3d{height:230px!important;page-break-inside:avoid;break-inside:avoid}",
    "  /* Layout — allow panels to break across pages */",
    "  .wrap{display:block!important;max-width:none!important;padding:0!important;margin:0!important;gap:0!important}",
    "  .panel{box-shadow:none!important;border:1px solid #cbd5e1!important;border-radius:5px!important;",
    "    margin-bottom:4mm!important;page-break-inside:auto!important;break-inside:auto!important}",
    "  .panel-head{padding:6px 12px!important;background:#f1f5f9!important;border-bottom:1px solid #cbd5e1!important;",
    "    page-break-after:avoid!important;break-after:avoid!important}",
    "  .panel-head .pico{display:none!important}",
    "  .panel-head h2{font-size:11.5pt!important;color:#0f1e33!important}",
    "  .panel-head .hint{font-size:9.5pt!important;color:#475569!important}",
    "  .panel-body{padding:8px 12px!important}",
    "  /* Section titles (sec-title) */",
    "  .sec-title{font-size:10.5pt!important;color:#1B4F8C!important;margin:10px 0 6px!important;",
    "    page-break-after:avoid!important;break-after:avoid!important}",
    "  /* Stat cards */",
    "  .summary{margin-bottom:8px!important}",
    "  .stat{background:#fff!important;border:1px solid #cbd5e1!important;page-break-inside:avoid;break-inside:avoid;padding:6px 9px!important}",
    "  .stat .v{font-size:12pt!important}",
    "  /* Check chips — keep colors for visual ok/not status */",
    "  .checks{margin-bottom:8px!important;gap:4px!important}",
    "  .chk{font-size:9.5pt!important;padding:3px 8px!important;border:1px solid currentColor}",
    "  .chk.ok{background:#fff!important;color:#0a5d3a!important}",
    "  .chk.bad{background:#fff!important;color:#992012!important}",
    "  /* Report steps — ปล่อยตัดข้ามหน้าได้ (auto) เพื่อไม่ทิ้งพื้นที่ว่าง */",
    "  /* แต่ป้องกันการตัดที่ระดับสมการ/ผลตรวจย่อย เพื่อรักษาความอ่านได้ */",
    "  .rep-step{border:1px solid #cbd5e1!important;border-radius:4px!important;padding:7px 10px!important;",
    "    margin-bottom:5px!important;background:#fff!important;page-break-inside:auto!important;break-inside:auto!important}",
    "  .rep-step .rh{margin-bottom:4px!important;page-break-after:avoid!important;break-after:avoid!important}",
    "  .rep-step .rn{background:#1B4F8C!important;color:#fff!important;font-size:9.5pt!important;width:17px!important;height:17px!important}",
    "  .rep-step .rt{font-size:10.5pt!important;font-weight:800!important;color:#0f1e33!important}",
    "  .rep-step .rep-f{break-inside:auto!important;page-break-inside:auto!important}",
    "  .rep-step .rep-f .ef{font-size:10pt!important;color:#1f2937!important;padding:1.5px 0!important;line-height:1.5!important;",
    "    break-inside:avoid!important;page-break-inside:avoid!important}",
    "  .rep-step .rep-f .ef b{color:#000!important;background:#fff8e6!important;padding:0 3px!important;border-radius:2px!important}",
    "  .rep-step .eref{font-size:9pt!important;color:#64748b!important;font-style:italic!important;margin-top:2px!important;",
    "    break-inside:avoid!important}",
    "  .rep-step .rep-chk{font-size:9.5pt!important;margin-top:3px!important;break-inside:avoid!important;page-break-inside:avoid!important}",
    "  .rep-step .rep-vd.inl{display:inline-block;padding:1px 6px;border-radius:3px;font-weight:800;font-size:9.5pt}",
    "  .rep-step .rep-vd.inl.ok{background:#e7f6ec!important;color:#0a5d3a!important;border:1px solid #0a5d3a}",
    "  .rep-step .rep-vd.inl.bad{background:#fdecea!important;color:#992012!important;border:1px solid #992012}",
    "  .rep-step .rep-dd{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;break-inside:avoid!important;page-break-inside:avoid!important}",
    "  .rep-step .rep-dd>div{font-size:9.5pt;border:1px solid #e2e8f0;padding:3px 6px;border-radius:3px;background:#fafbfd}",
    "  .rep-step .rep-sechd, .rep-sechd{page-break-after:avoid!important;break-after:avoid!important}",
    "  .rep-step .rep-note,.rep-note{break-inside:avoid!important;page-break-inside:avoid!important}",
    "  .rep-final{font-size:12pt!important;padding:10px 14px!important;border-width:2px!important;",
    "    page-break-before:avoid!important;page-break-inside:avoid!important;break-inside:avoid!important;margin-top:4px!important}",
    "  /* Diagrams — keep crisp, avoid splitting */",
    "  .diagram{page-break-inside:avoid;break-inside:avoid;background:#fff!important;border:1px solid #cbd5e1!important;",
    "    padding:8px 6px 4px!important;margin-top:4px!important}",
    "  .diagram .cap{font-size:9pt!important;margin-top:2px!important}",
    "  .diag-row{page-break-inside:avoid;break-inside:avoid;gap:6px!important}",
    "  /* Group block (input groups) — drop input-only blocks in print since report shows everything */",
    "  .group{margin-bottom:8px!important}",
    "  .group-title{font-size:10pt!important;margin-bottom:5px!important}",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  // ---------- ฟิลด์ข้อมูลโครงการ ----------
  // มาตรฐานที่บังคับใช้ในไทยตามลำดับ:
  //   1) กฎกระทรวง พ.ศ. 2566 — กำหนดการออกแบบโครงสร้างอาคารและคุณสมบัติวัสดุ
  //   2) มยผ. 1101-64 — มาตรฐานการออกแบบคอนกรีตเสริมเหล็กโดยวิธีกำลัง (กรมโยธาฯ)
  //   3) ACI 318 — มาตรฐานสากลอ้างอิง (มยผ. 1101 อิงเป็นต้นแบบ)
  var STANDARD_OPTIONS = [
    "มยผ. 1101-64 (วิธีกำลัง · กรมโยธาฯ 2564) · กฎกระทรวง พ.ศ. 2566",
    "มยผ. 1101-64 + ACI 318-19 (อ้างอิงสากล)",
    "มยผ. 1101-50 + ACI 318-11 (รุ่นก่อน · 1.4D+1.7L)",
    "ACI 318-19 (USD, 1.2D+1.6L) — ใช้ในกรณีรายงานต่างประเทศ",
    "ACI 318-99 (USD, 1.4D+1.7L) — รุ่นเก่า",
  ];
  var FIELDS = [
    { k:"project",   l:"ชื่อโครงการ (Project)",        ph:"เช่น อาคารพาณิชย์ 4 ชั้น เลขที่ 99/9" },
    { k:"owner",     l:"เจ้าของโครงการ (Owner)",       ph:"ชื่อ-นามสกุล / บริษัท" },
    { k:"location",  l:"สถานที่ก่อสร้าง (Location)",   ph:"ที่อยู่ / พิกัด" },
    { k:"drawNo",    l:"เลขที่แบบ (Drawing No.)",      ph:"เช่น S-01" },
    { k:"sheetNo",   l:"เลขหน้า (Sheet No.)",          ph:"เช่น 1/12" },
    { k:"docNo",     l:"เลขที่เอกสารคำนวณ (Calc No.)", ph:"เช่น C-001" },
    { k:"engineer",  l:"วิศวกรผู้คำนวณ (Engineer)",     ph:"ชื่อ-นามสกุล" },
    { k:"license",   l:"เลขใบประกอบวิชาชีพ (License)",  ph:"เช่น ภย.12345" },
    { k:"checker",   l:"ผู้ตรวจสอบ (Checker)",          ph:"ชื่อ-นามสกุล (ถ้ามี)" },
    { k:"checkerLic",l:"เลขใบประกอบฯ ผู้ตรวจ",          ph:"(ถ้ามี)" },
    { k:"company",   l:"หน่วยงาน / บริษัท (Company)",    ph:"เช่น บริษัทผู้ออกแบบ" },
    { k:"date",      l:"วันที่คำนวณ (Date)",            ph:todayThai() },
    { k:"aci",       l:"มาตรฐานการออกแบบ (Design Standard)", ph:"เลือกมาตรฐาน", select:STANDARD_OPTIONS },
  ];

  // ---------- สร้างกล่องข้อมูลโครงการ ----------
  function buildPanel() {
    var p = document.createElement("section");
    p.className = "ckpr-panel" + (data.__open ? " open" : "");
    var headHtml = '<div class="ckpr-head">'
      + '<span class="ico">i</span>'
      + '<span class="ttl">ข้อมูลโครงการ · Project Information'
      + '<small>(สำหรับใส่ใน PDF รายงานการคำนวณ — ใช้ยื่นขออนุญาตก่อสร้าง)</small></span>'
      + '<span class="arr">▾</span>'
      + '</div>';
    var grid = '<div class="ckpr-grid">' + FIELDS.map(function (f) {
      var v = data[f.k] || "";
      // ถ้าเป็น select field → render dropdown
      if (f.select && f.select.length) {
        var opts = f.select.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>';
        }).join("");
        if (!v) opts = '<option value="" disabled selected>' + esc(f.ph) + '</option>' + opts;
        return '<div class="ckpr-f"><label>' + esc(f.l) + '</label>'
          + '<select data-k="' + esc(f.k) + '">' + opts + '</select></div>';
      }
      return '<div class="ckpr-f">'
        + '<label>' + esc(f.l) + '</label>'
        + '<input data-k="' + esc(f.k) + '" type="text" value="' + esc(v) + '" placeholder="' + esc(f.ph) + '">'
        + '</div>';
    }).join("") + '</div>';
    var tip = '<div class="ckpr-tip">'
      + '<b>เคล็ดลับ:</b> ข้อมูลโครงการจะถูกบันทึกในเครื่องของคุณอัตโนมัติ (localStorage) '
      + 'และใช้กับทุกแอปย่อยใน Foundation Lab · '
      + 'เมื่อสั่ง<b>พิมพ์ / PDF</b> ระบบจะแทรกหน้าปกรายงานวิชาการ + ลายเซ็นต์ผู้คำนวณ/ผู้ตรวจให้อัตโนมัติ'
      + '</div>';
    p.innerHTML = headHtml + '<div class="ckpr-body">' + grid + tip + '</div>';

    // ใส่ถัดจาก appbar
    var bar = document.querySelector(".appbar");
    if (bar && bar.parentNode) {
      bar.parentNode.insertBefore(p, bar.nextSibling);
    } else {
      document.body.insertBefore(p, document.body.firstChild);
    }

    // เปิด-ปิด
    p.querySelector(".ckpr-head").onclick = function () {
      p.classList.toggle("open");
      data.__open = p.classList.contains("open");
      save(data);
    };
    // บันทึกอัตโนมัติ (input + select)
    p.querySelectorAll("input[data-k], select[data-k]").forEach(function (inp) {
      var ev = inp.tagName === "SELECT" ? "change" : "input";
      inp.addEventListener(ev, function () {
        data[inp.getAttribute("data-k")] = inp.value;
        save(data);
        renderCover(); // อัปเดต cover ทันที (จะอ่านเข้า DOM)
      });
    });
    return p;
  }

  // ---------- คำนวณ hash จาก inputs ทั้งหมด (FNV-1a 32-bit — sync, deterministic) ----------
  // ใช้เพื่อ: (1) ตรวจสอบว่า 2 PDF มาจากชุดข้อมูลเดียวกัน (2) นับ unique calculation
  // ไม่ใช่ cryptographic hash — แค่ระบุชุดข้อมูล (collision rate ต่ำมากสำหรับเคสจริง)
  // FUZZY: ปัดค่าตัวเลขเป็นเลขนัยสำคัญ 3 หลักก่อน hash → L=7.60 กับ 7.601 ได้ hash เดียวกัน
  //        (กันการนับ unique ซ้ำเมื่อผู้ใช้ขยับค่าเล็กน้อย) แต่ยังแยก ρ=0.0018 vs 0.0025 ได้
  var _NUMRE = /^[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?$/;
  function _sig3(x) {
    if (!isFinite(x)) return null;
    if (x === 0) return "0";
    var d = Math.ceil(Math.log10(Math.abs(x)));
    var p = 3 - d, f = Math.pow(10, p);
    var r = Math.round(x * f) / f;
    // ตัด -0 และทำให้รูปแบบคงที่ (สูงสุด 12 ตำแหน่งทศนิยม กัน floating error)
    if (r === 0) r = 0;
    return String(parseFloat(r.toFixed(12)));
  }
  function _fuzz(raw) {
    var t = (raw == null ? "" : String(raw)).trim();
    if (t !== "" && _NUMRE.test(t)) {
      var s3 = _sig3(parseFloat(t));
      if (s3 !== null) return s3;
    }
    return raw;
  }
  function computeInputsHash() {
    var parts = [];
    var inputs = document.querySelectorAll("input, select, textarea");
    inputs.forEach(function (el) {
      // ข้าม UI ของ paywall, project info panel, viewer3d
      if (el.closest && (
        el.closest("#ckrpWrap") ||
        el.closest(".ckrm-overlay") ||
        el.closest(".ckpr-panel") ||
        el.closest(".viewer3d")
      )) return;
      if (el.id && el.id.indexOf("v3d") === 0) return;
      if (el.classList && el.classList.contains("v3color")) return;
      var type = (el.type || "").toLowerCase();
      if (type === "file" || type === "button" || type === "submit") return;
      var key = el.id || el.name || el.getAttribute("data-k") || "";
      var val = (type === "checkbox" || type === "radio") ? (el.checked ? "1" : "0") : _fuzz(el.value || "");
      parts.push(key + "=" + val);
    });
    var s = parts.join("|");
    // FNV-1a 32-bit
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h.toString(16).toUpperCase().padStart(8, "0");
  }
  // expose ให้ paywall ใช้ตรวจ unique calculation
  window.__ckGetInputsHash = computeInputsHash;

  // ---------- สร้าง cover page (เฉพาะตอนพิมพ์) ----------
  function renderCover() {
    var cv = document.getElementById("ckprCover");
    if (!cv) {
      cv = document.createElement("section");
      cv.id = "ckprCover";
      cv.className = "ckpr-cover";
      document.body.insertBefore(cv, document.body.firstChild);
    }
    var d = data;
    var nowISO = new Date().toISOString().slice(0, 19).replace("T", " ");
    var hash = computeInputsHash();
    var verifyUrl = "LOCAL-CALC-HASH:" + hash;
    // QR เปลี่ยนเป็น local calculation hash — render เป็น <img>, ทำงานใน print เลย ไม่ต้อง JS
    var qrSrc = "data:image/svg+xml;charset=utf-8," + encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"120\" height=\"120\" viewBox=\"0 0 120 120\"><rect width=\"120\" height=\"120\" fill=\"white\"/><rect x=\"6\" y=\"6\" width=\"108\" height=\"108\" fill=\"none\" stroke=\"%231b4f8c\" stroke-width=\"4\"/><text x=\"60\" y=\"53\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"13\" font-weight=\"700\" fill=\"%231b4f8c\">LOCAL</text><text x=\"60\" y=\"72\" text-anchor=\"middle\" font-family=\"monospace\" font-size=\"10\" fill=\"%231b4f8c\">" + hash + "</text></svg>");
    var rows = [
      ["ชื่อโครงการ · Project",            d.project   || ""],
      ["เจ้าของโครงการ · Owner",           d.owner     || ""],
      ["สถานที่ก่อสร้าง · Location",        d.location  || ""],
      ["เลขที่แบบ · Drawing No.",          d.drawNo    || ""],
      ["เลขหน้า · Sheet No.",              d.sheetNo   || ""],
      ["เลขที่เอกสารคำนวณ · Calc No.",      d.docNo     || ""],
      ["หน่วยงาน / บริษัท · Company",       d.company   || ""],
      ["วันที่คำนวณ · Date",                d.date      || todayThai()],
      ["รหัสตรวจสอบ · Calc Hash",          hash + " (สร้างจาก inputs ทั้งหมด — ใช้ตรวจว่ารายงาน 2 ฉบับมาจากชุดข้อมูลเดียวกัน)"],
      ["ลายเวลา · Timestamp (UTC)",         nowISO],
    ];
    // มาตรฐานการออกแบบ — default = มยผ. 1101-64 (ไทย) · ACI 318 เป็นทางเลือกสำรอง
    var stdEd = d.aci || "มยผ. 1101-64 (วิธีกำลัง · กรมโยธาฯ 2564) · กฎกระทรวง พ.ศ. 2566";
    var html =
      '<div class="cv-brand">รายงานการคำนวณวิศวกรรมโครงสร้าง · STRUCTURAL ENGINEERING CALCULATION REPORT</div>' +
      '<div class="cv-ttl">' + esc(APP_TITLE) + '</div>' +
      '<div class="cv-sub">มาตรฐานการออกแบบ: <b>' + esc(stdEd) + '</b> · วิธีกำลัง (Strength Design Method, USD)</div>' +
      '<table class="cv-info"><tbody>' +
      rows.map(function (r) {
        return '<tr><td class="k">' + esc(r[0]) + '</td><td class="v">' + esc(r[1]) + '</td></tr>';
      }).join("") +
      '</tbody></table>' +
      '<div class="cv-sig">' +
        '<div class="sig">' +
          '<div class="role">ผู้คำนวณ · Designed by</div>' +
          '<div class="line">ลงนาม / Signature</div>' +
          '<div class="name">' + esc(d.engineer || "...........................") + '</div>' +
          '<div class="lic">' + (d.license ? "ใบประกอบวิชาชีพ " + esc(d.license) : "ใบประกอบวิชาชีพ ...........................") + '</div>' +
        '</div>' +
        '<div class="sig">' +
          '<div class="role">ผู้ตรวจสอบ · Checked by</div>' +
          '<div class="line">ลงนาม / Signature</div>' +
          '<div class="name">' + esc(d.checker || "...........................") + '</div>' +
          '<div class="lic">' + (d.checkerLic ? "ใบประกอบวิชาชีพ " + esc(d.checkerLic) : "ใบประกอบวิชาชีพ ...........................") + '</div>' +
        '</div>' +
      '</div>' +
      // Disclaimer block — ระบุความรับผิดชอบของวิศวกรผู้ลงนาม
      '<div class="cv-disclaimer">' +
        '<div class="cv-disclaimer-ttl">ข้อสงวนความรับผิดชอบ · DISCLAIMER</div>' +
        '<div class="cv-disclaimer-body">' +
          'เครื่องมือ <b>นายช่างใหญ่ Civil Apps · Foundation Lab</b> เป็นเครื่องมือคำนวณช่วยการออกแบบ (Design Aid) — ' +
          '<b>ผู้ใช้ต้องตรวจสอบผลคำนวณและสมมติฐานทุกค่าด้วยความรู้ทางวิศวกรรมก่อนนำไปใช้</b> · ' +
          'แพลตฟอร์มผู้พัฒนาไม่รับผิดชอบความเสียหายใดๆ จากการใช้งาน — ' +
          'วิศวกรผู้ลงนามรับรองและรับผิดชอบความถูกต้องตามใบประกอบวิชาชีพของตน · ' +
          '<b>ลำดับมาตรฐานที่ใช้ในประเทศไทย:</b> ' +
          '(1) <b>กฎกระทรวง พ.ศ. 2566</b> (ฉบับล่าสุด) — กำหนดการออกแบบโครงสร้างอาคารและคุณสมบัติวัสดุ · ' +
          '(2) <b>มยผ. 1101-64</b> — มาตรฐานการออกแบบคอนกรีตเสริมเหล็กโดยวิธีกำลัง (กรมโยธาธิการและผังเมือง) · ' +
          '(3) <b>มยผ. 1311-50</b> — แรงลม · <b>มยผ. 1303-57</b> — แผ่นดินไหว · ' +
          '(4) <b>ACI 318-19</b> — มาตรฐานสากลอ้างอิง (มยผ. 1101 อิงเป็นต้นแบบ) · ' +
          '<b>รายงานนี้ไม่ครอบคลุม:</b> punching shear (เสา-ฐาน), torsion, แรงแผ่นดินไหว (มยผ.1303), ' +
          'การเสื่อมสภาพระยะยาว (creep/shrinkage), การทนไฟ, และเงื่อนไข exposure class — ' +
          '<b>ผู้ออกแบบต้องตรวจเพิ่มเองตามมยผ.และกฎกระทรวงที่ใช้บังคับในพื้นที่</b>' +
        '</div>' +
      '</div>' +
      // QR code + verify info
      '<div class="cv-qr-block">' +
        '<img src="' + esc(qrSrc) + '" alt="QR" class="cv-qr-img"/>' +
        '<div class="cv-qr-info">' +
          '<div><b>รหัสตรวจสอบในเครื่อง · Local verification</b></div>' +
          '<div class="cv-qr-url">' + esc(verifyUrl) + '</div>' +
          '<div class="cv-qr-note">รหัส <b>Calc Hash</b> ด้านบนใช้เปรียบเทียบว่า ' +
          'ชุด inputs ที่สร้าง hash นี้คือชุดเดียวกันกับที่ระบุในรายงานหรือไม่</div>' +
        '</div>' +
      '</div>' +
      '<div class="cv-footnote">เอกสารนี้สร้างจากเครื่องมือ <b>นายช่างใหญ่ Civil Apps · Foundation Lab</b> · ' +
        'นายช่างใหญ่.com — สำหรับใช้ประกอบการยื่นขออนุญาตก่อสร้าง / ใช้ภายในโครงการ · ' +
        'วิศวกรผู้ลงนามมีหน้าที่ตรวจสอบและรับผิดชอบการคำนวณ</div>';
    cv.innerHTML = html;
  }

  // ---------- running header/footer ถูกปิดใน CSS แล้ว ----------
  // Chrome จะใส่ URL ด้านล่าง + ชื่อเรื่อง/หน้า ด้านบนให้เองถ้าผู้ใช้เปิด "ส่วนหัวและส่วนท้ายกระดาษ"
  // เลยไม่ต้อง inject ของซ้อนเข้าไปอีก (เคยทำให้ซ้อนกับเนื้อหา)

  // ---------- hook ก่อนพิมพ์ ----------
  function onBeforePrint() {
    renderCover();
  }
  window.addEventListener("beforeprint", onBeforePrint);
  // กัน Chrome บางเวอร์ชันที่ไม่ trigger beforeprint — wrap window.print ด้วย
  var nativePrint2 = window.print ? window.print.bind(window) : function () {};
  // ระวัง: ck-print-paywall.js อาจ override window.print ไว้แล้ว
  // เราต้อง wrap ทับอีกชั้นแต่ให้เรียก override ของ paywall ปกติ
  var currentPrint = window.print;
  window.print = function () {
    try { onBeforePrint(); } catch (e) {}
    return currentPrint.apply(this, arguments);
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // ---------- boot ----------
  function boot() {
    buildPanel();
    renderCover();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
