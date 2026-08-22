(() => {
  "use strict";

  const REVIEW_WATERMARK = "OWNER REVIEW · NOT FOR CONSTRUCTION";
  const OWNER_REFERENCE_UPRIGHT = "/PIC/f1-one-pile-plan-section-owner-reference-v1.png?v=77716d23";
  const OWNER_REFERENCE_INVERTED = "/PIC/f1-one-pile-inverted-basket-owner-reference-v2.png?v=b89a3e77";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (token) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;"
  })[token]);

  const finite = (value, fallback = 0) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const format = (value, digits = 2) => finite(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });

  const basketLabel = (pattern) => pattern === "C" ? "ตะกร้อคว่ำ" : "ตะกร้อหงาย";

  const customerPatternText = (value, pattern) => {
    const source = String(value || "");
    const label = basketLabel(pattern);
    if (!/แบบ\s*[กข]/u.test(source)) return source;
    if (/รายละเอียด\s*:/u.test(source)) {
      return source
        .replace(/รายละเอียด\s*:\s*[^|]*/u, `รายละเอียด: ${label} `)
        .replace(/\s{2,}/g, " ")
        .trim();
    }
    return source
      .replace(/แบบ\s*[กข](?:\s*\/\s*ค)?(?:\s*·\s*)?/gu, label)
      .replace(new RegExp(`${label}\\s*\\([^)]*\\)`, "gu"), label)
      .replace(/\s{2,}/g, " ")
      .trim();
  };

  const rewriteCustomerPatternTree = (root, pattern) => {
    if (!root) return;
    const walker = root.ownerDocument.createTreeWalker(root, 4);
    let node = walker.nextNode();
    while (node) {
      if (/แบบ\s*[กข]/u.test(node.nodeValue || "")) {
        node.nodeValue = customerPatternText(node.nodeValue, pattern);
      }
      node = walker.nextNode();
    }
  };

  const readControl = (doc, id, fallback = "") => {
    const control = doc.getElementById(id);
    return control ? control.value : fallback;
  };

  const readSnapshot = (doc) => {
    const selectedPattern = doc.querySelector('input[name="pat"]:checked');
    const pileType = doc.getElementById("pileType");
    const status = doc.querySelector(".ws-status");
    const checks = Array.from(doc.querySelectorAll("#o_checks .chk"));
    return Object.freeze({
      A: finite(readControl(doc, "A"), 1.2),
      B: finite(readControl(doc, "B"), 1.2),
      T: finite(readControl(doc, "T"), 45),
      H: finite(readControl(doc, "H"), 1.2),
      columnA: finite(readControl(doc, "a1"), 30),
      columnB: finite(readControl(doc, "b1col"), 30),
      pileD: finite(readControl(doc, "pileD"), 26),
      pileSafeLoad: finite(readControl(doc, "pileSL"), 26),
      cover: finite(readControl(doc, "cov"), 7.5),
      mainBar: finite(readControl(doc, "dMain"), 12),
      barsA: Math.max(0, Number.parseInt(readControl(doc, "nA"), 10) || 0),
      barsB: Math.max(0, Number.parseInt(readControl(doc, "nB"), 10) || 0),
      tieBar: finite(readControl(doc, "dTie"), 6),
      hoops: Math.max(0, Number.parseInt(readControl(doc, "nHoop"), 10) || 0),
      eccentricity: finite(readControl(doc, "e_ecc"), 0),
      deadLoad: finite(readControl(doc, "PD"), 0),
      liveLoad: finite(readControl(doc, "PL"), 0),
      loadCombo: doc.getElementById("loadCombo")?.selectedOptions?.[0]?.textContent?.trim()
        || readControl(doc, "loadCombo", "—"),
      pileTypeCode: pileType?.value || "—",
      pileType: pileType?.selectedOptions?.[0]?.textContent?.trim() || pileType?.value || "—",
      pattern: selectedPattern?.value || "A",
      status: status?.textContent?.trim() || "LIVE ENGINE",
      statusKind: status?.classList.contains("pass")
        ? "pass"
        : status?.classList.contains("fail") ? "fail" : "review",
      checksPassed: checks.filter((check) => check.classList.contains("ok")).length,
      checksTotal: checks.length,
      summaryText: doc.getElementById("o_summary")?.textContent?.replace(/\s+/g, " ").trim() || "—",
      bomText: doc.getElementById("o_bom")?.textContent?.replace(/\s+/g, " ").trim() || ""
    });
  };

  const compactDetailingGroup = (doc) => {
    const segment = doc.getElementById("patternSeg");
    const group = segment?.closest(".group");
    if (!group || group.dataset.f1DetailingCompact === "true") return;
    group.dataset.f1DetailingCompact = "true";
    group.classList.add("f1-detailing-compact");

    const title = group.querySelector(".group-title");
    if (title) title.textContent = "ชนิดตะกร้อ";

    const patternLabels = [
      ["pat_a", "ตะกร้อหงาย"],
      ["pat_c", "ตะกร้อคว่ำ"]
    ];
    patternLabels.forEach(([id, name]) => {
      const label = group.querySelector(`label[for="${id}"]`);
      if (!label) return;
      label.replaceChildren();
      const nameNode = doc.createElement("b");
      nameNode.textContent = name;
      label.append(nameNode);
    });

    const tieSizeLabel = group.querySelector('label[for="dTie"]');
    if (tieSizeLabel) tieSizeLabel.textContent = "เหล็กปลอก";
    const hoopLabel = group.querySelector('label[for="nHoop"]');
    if (hoopLabel) {
      hoopLabel.replaceChildren(doc.createTextNode("จำนวนปลอก "));
      const auto = doc.createElement("span");
      auto.className = "u";
      auto.textContent = "0 = อัตโนมัติ";
      hoopLabel.append(auto);
    }

    const pcWire = doc.getElementById("showPC");
    const pcWireLabel = pcWire?.closest("label");
    if (pcWireLabel) {
      pcWireLabel.classList.add("f1-pc-wire-control");
      Array.from(pcWireLabel.childNodes).forEach((node) => {
        if (node !== pcWire) node.remove();
      });
      pcWireLabel.append(doc.createTextNode("PC wire จากหัวเข็ม"));
      const pcMeta = doc.createElement("span");
      pcMeta.className = "u";
      pcMeta.textContent = "Ø4 · ~15 cm";
      pcWireLabel.append(pcMeta);
    }

    const notes = Array.from(group.querySelectorAll(":scope > .fnote"));
    if (notes.length) {
      const details = doc.createElement("details");
      details.className = "f1-detailing-details";
      const summary = doc.createElement("summary");
      summary.textContent = "รายละเอียดและข้อกำหนดการจัดเหล็ก";
      const content = doc.createElement("div");
      content.className = "f1-detailing-details__content";
      notes.forEach((note) => content.append(note));
      details.append(summary, content);
      group.append(details);
    }
  };

  const sheetFrame = ({ title, subtitle, code, body, status }) => `
    <svg class="f1-cad-sheet" viewBox="0 0 1180 820" role="img" aria-label="${escapeHtml(title)}" data-cad-sheet="${escapeHtml(code)}" data-cad-source="live-engine-dom">
      <rect width="1180" height="820" class="cad-paper"/>
      <rect x="18" y="18" width="1144" height="784" class="cad-border cad-border--outer"/>
      <rect x="32" y="32" width="1116" height="756" class="cad-border cad-border--inner"/>
      <g class="cad-zones" aria-hidden="true">
        <text x="125" y="28">1</text><text x="345" y="28">2</text><text x="565" y="28">3</text><text x="785" y="28">4</text><text x="1005" y="28">5</text>
        <text x="125" y="798">1</text><text x="345" y="798">2</text><text x="565" y="798">3</text><text x="785" y="798">4</text><text x="1005" y="798">5</text>
        <text x="24" y="158">A</text><text x="24" y="348">B</text><text x="24" y="538">C</text><text x="24" y="728">D</text>
        <text x="1156" y="158">A</text><text x="1156" y="348">B</text><text x="1156" y="538">C</text><text x="1156" y="728">D</text>
      </g>
      ${body}
      <g class="cad-titleblock">
        <rect x="646" y="700" width="502" height="88"/>
        <path d="M964 700V788M1052 700V788M646 744H1148M964 730H1148M1052 744V788"/>
        <text x="660" y="720" class="cad-title">${escapeHtml(title)}</text>
        <text x="660" y="738" class="cad-subtitle">${escapeHtml(subtitle)}</text>
        <text x="660" y="766" class="cad-label">SOURCE</text>
        <text x="706" y="766" class="cad-meta">LIVE INPUT · ${escapeHtml(status)}</text>
        <text x="976" y="713" class="cad-label">DWG</text><text x="976" y="726" class="cad-value">${escapeHtml(code)}</text>
        <text x="1064" y="713" class="cad-label">REV</text><text x="1102" y="726" class="cad-value">R1</text>
        <text x="976" y="760" class="cad-label">SCALE</text><text x="976" y="777" class="cad-value">NTS</text>
        <text x="1064" y="760" class="cad-label">SHEET</text><text x="1102" y="777" class="cad-value">1/1</text>
      </g>
      <g class="cad-watermark" aria-label="${REVIEW_WATERMARK}">
        <rect x="32" y="748" width="614" height="40"/>
        <text x="46" y="765">OWNER REVIEW</text>
        <text x="46" y="781" class="cad-watermark__sub">NOT FOR CONSTRUCTION · NOT RELEASED BBS</text>
      </g>
    </svg>`;

  const createProductHeader = (doc) => {
    const appbar = doc.querySelector(".appbar");
    const nav = doc.getElementById("secnav");
    if (!appbar || !nav || appbar.dataset.f1V3Header === "true") return;
    appbar.dataset.f1V3Header = "true";

    const back = appbar.querySelector(".back");
    const sheet = appbar.querySelector(".sheet");
    const title = appbar.querySelector(".ttl-wrap");
    const status = appbar.querySelector(".ws-status");
    const actions = Array.from(appbar.querySelectorAll("button.print"));

    const brand = doc.createElement("div");
    brand.className = "f1-v3-brand";
    brand.innerHTML = `<span class="f1-v3-brand__mark" aria-hidden="true"><i></i><b>F1</b></span>`;
    if (back) brand.append(back);
    const brandMeta = doc.createElement("small");
    brandMeta.textContent = "NCY CIVIL APPS";
    brand.append(brandMeta);

    const identity = doc.createElement("div");
    identity.className = "f1-v3-identity";
    if (sheet) identity.append(sheet);
    if (title) identity.append(title);

    const command = doc.createElement("div");
    command.className = "f1-v3-command";
    if (status) command.append(status);
    actions.forEach((action) => command.append(action));

    appbar.replaceChildren(brand, identity, nav, command);
  };

  const createOverviewDashboard = (doc, engineWindow, summarySection, threeSection) => {
    const viewerBox = threeSection.querySelector("#v3dBox");
    const summary = summarySection.querySelector("#o_summary");
    const util = summarySection.querySelector("#o_util");
    const checks = summarySection.querySelector("#o_checks");
    const bom = summarySection.querySelector("#o_bom");
    const method = summarySection.querySelector("#o_method");
    const takeoff = summarySection.querySelector("#takeoff");
    const noData = summarySection.querySelector("#o_nodata");
    const warnings = [
      summarySection.querySelector("#o_dregion"),
      summarySection.querySelector(".banner-info")
    ].filter(Boolean);
    if (!viewerBox || !summary || !util || !checks || !bom || !takeoff) return null;

    const homeSlot = doc.createElement("span");
    homeSlot.className = "f1-overview-3d-home";
    homeSlot.hidden = true;
    viewerBox.insertAdjacentElement("beforebegin", homeSlot);

    const dashboard = doc.createElement("div");
    dashboard.className = "f1-overview-dashboard";
    dashboard.innerHTML = `<header class="f1-overview-heading">
      <div><span>FLOW 01 · LIVE OVERVIEW</span><h2>ภาพรวมฐานราก 1 เสาเข็ม</h2><p>Input, รูปทรง, D/C, เหล็ก และสถานะจาก F1 Engine ชุดเดียว</p></div>
      <strong>ENGINE PRESERVED · PRESENTATION V3</strong>
    </header>
    <div class="f1-overview-main">
      <section class="f1-overview-hero" aria-labelledby="f1Overview3dTitle">
        <header><div><span>LIVE ENGINE 3D</span><h3 id="f1Overview3dTitle">ฐานราก · เสา · เสาเข็ม</h3></div><b data-overview-dimension>—</b></header>
        <div class="f1-overview-3d-host" data-overview-3d-host></div>
        <footer><span>ลากเพื่อหมุน · ล้อเพื่อซูม</span><span>รายละเอียด Layer ดู Flow 04</span></footer>
      </section>
      <aside class="f1-overview-result" aria-labelledby="f1OverviewResultTitle">
        <header data-overview-status="review"><div><span>ผลจาก Engine เดิม</span><h3 id="f1OverviewResultTitle" data-overview-status-text>LIVE ENGINE</h3></div><b data-overview-check-count>—</b></header>
        <div data-overview-summary-host></div>
        <section class="f1-overview-checks"><h4>รายการตรวจสอบ</h4><div data-overview-checks-host></div></section>
        <details class="f1-overview-alerts"><summary>ข้อจำกัดและคำเตือนจาก Engine</summary><div data-overview-alerts-host></div></details>
      </aside>
    </div>
    <section class="f1-overview-flow03" aria-labelledby="f1OverviewFlow03Title">
      <header>
        <div><span>FLOW 03 · SAME RENDERER</span><h3 id="f1OverviewFlow03Title">แปลนและรูปตัดฐานราก 1–1</h3></div>
        <b>LIVE INPUT · OWNER REVIEW</b>
      </header>
      <div class="f1-cad-surface__sheet f1-overview-flow03__sheet" data-overview-flow03-sheet></div>
      <div class="f1-overview-flow03__engine" data-overview-bom-host></div>
    </section>
    <div class="f1-overview-bottom">
      <section class="f1-overview-evidence f1-overview-evidence--util"><header><span>กำลัง / ความต้องการ</span><b>LIVE D/C</b></header><div data-overview-util-host></div></section>
      <section class="f1-overview-evidence f1-overview-evidence--schedule"><header><span>สรุปปริมาณวัสดุ</span><b>ENGINE TAKE-OFF</b></header><div data-overview-takeoff-host></div></section>
    </div>
    <details class="f1-overview-method"><summary>หลักฐานและหมายเหตุวิธีคำนวณเดิม</summary><div data-overview-method-host></div></details>`;

    const viewerHost = dashboard.querySelector("[data-overview-3d-host]");
    const summaryHost = dashboard.querySelector("[data-overview-summary-host]");
    const checksHost = dashboard.querySelector("[data-overview-checks-host]");
    const alertsHost = dashboard.querySelector("[data-overview-alerts-host]");
    const utilHost = dashboard.querySelector("[data-overview-util-host]");
    const bomHost = dashboard.querySelector("[data-overview-bom-host]");
    const takeoffHost = dashboard.querySelector("[data-overview-takeoff-host]");
    const methodHost = dashboard.querySelector("[data-overview-method-host]");
    const bomPresentation = doc.createElement("div");
    bomPresentation.className = "callout f1-basket-summary";
    bom.hidden = true;
    bom.dataset.f1SourceOnly = "true";

    summaryHost.append(summary);
    checksHost.append(checks);
    if (noData) alertsHost.append(noData);
    warnings.forEach((warning) => alertsHost.append(warning));
    utilHost.append(util);
    bomHost.append(bomPresentation, bom);
    takeoffHost.append(takeoff);
    if (method) methodHost.append(method);
    summarySection.replaceChildren(dashboard);

    let activeFlow = "summary";
    const placeViewer = (flowKey, remember = true) => {
      if (remember) activeFlow = flowKey;
      const target = flowKey === "three" ? homeSlot.parentElement : viewerHost;
      if (!target) return;
      if (flowKey === "three") homeSlot.insertAdjacentElement("afterend", viewerBox);
      else if (viewerBox.parentElement !== viewerHost) viewerHost.append(viewerBox);
      engineWindow.requestAnimationFrame(() => engineWindow.requestAnimationFrame(() => {
        if (typeof engineWindow.v3resize === "function") engineWindow.v3resize();
        if (typeof engineWindow.v3render === "function") engineWindow.v3render();
      }));
    };

    doc.addEventListener("f1:flowchange", (event) => placeViewer(event.detail?.key || "summary"));
    engineWindow.addEventListener("beforeprint", () => placeViewer("three", false));
    engineWindow.addEventListener("afterprint", () => placeViewer(activeFlow, false));

    return Object.freeze({
      update(snapshot) {
        dashboard.querySelector("[data-overview-flow03-sheet]").innerHTML = sectionCadSvg(snapshot);
        bomPresentation.textContent = customerPatternText(snapshot.bomText, snapshot.pattern);
        dashboard.querySelector("[data-overview-dimension]").textContent = `${format(snapshot.A)} × ${format(snapshot.B)} × ${format(snapshot.T / 100)} m`;
        const statusHeader = dashboard.querySelector("[data-overview-status]");
        statusHeader.dataset.overviewStatus = snapshot.statusKind;
        dashboard.querySelector("[data-overview-status-text]").textContent = snapshot.status;
        dashboard.querySelector("[data-overview-check-count]").textContent = snapshot.checksTotal
          ? `${snapshot.checksPassed} ผ่าน · ${snapshot.checksTotal - snapshot.checksPassed} ไม่ผ่าน`
          : "รอผลตรวจ";
      },
      setFlow: placeViewer
    });
  };

  const invertedBasketReferenceSvg = (snapshot, hoopLabel) => `
    <svg x="46" y="98" width="1088" height="479" viewBox="0 0 1558 686" role="img"
      data-cad-reference-pattern="inverted"
      aria-label="แปลนและรูปตัดตะกร้อคว่ำจากภาพอ้างอิง Owner พร้อมข้อความสดจาก Engine">
      <svg x="12" y="12" width="520" height="662" viewBox="0 70 430 650" preserveAspectRatio="xMidYMid meet" overflow="hidden">
        <image href="${OWNER_REFERENCE_INVERTED}" x="0" y="0" width="1477" height="915" class="cad-reference-base"/>
        <g class="cad-reference-mask" aria-hidden="true">
          <rect x="238" y="116" width="96" height="38"/>
          <rect x="199" y="178" width="96" height="38"/><rect x="296" y="178" width="96" height="38"/>
          <rect x="0" y="370" width="56" height="84"/>
          <rect x="62" y="306" width="48" height="62"/><rect x="62" y="417" width="48" height="64"/>
          <rect x="176" y="552" width="300" height="82"/>
        </g>
        <g class="cad-reference-labels" data-live-overlay="engine-inputs" data-cad-overlay="plan-dimensions">
          <text x="286" y="145" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A)}</text>
          <text x="247" y="207" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A / 2)}</text>
          <text x="344" y="207" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A / 2)}</text>
          <text x="29" y="412" text-anchor="middle" transform="rotate(-90 29 412)" class="cad-reference-dimension">${format(snapshot.B)}</text>
          <text x="87" y="338" text-anchor="middle" transform="rotate(-90 87 338)" class="cad-reference-dimension">${format(snapshot.B / 2)}</text>
          <text x="87" y="450" text-anchor="middle" transform="rotate(-90 87 450)" class="cad-reference-dimension">${format(snapshot.B / 2)}</text>
          <text x="298" y="590" text-anchor="middle" class="cad-reference-title">แปลนตะกร้อคว่ำ</text>
          <text x="298" y="624" text-anchor="middle" class="cad-reference-scale">มาตราส่วน NTS</text>
        </g>
      </svg>
      <svg x="530" y="2" width="1012" height="680" viewBox="560 38 870 860" preserveAspectRatio="xMidYMid meet" overflow="hidden">
        <image href="${OWNER_REFERENCE_INVERTED}" x="0" y="0" width="1477" height="915" class="cad-reference-base"/>
        <g class="cad-reference-mask" aria-hidden="true">
          <rect x="560" y="190" width="105" height="370"/>
          <rect x="560" y="540" width="175" height="112"/>
          <rect x="458" y="230" width="82" height="142"/>
          <rect x="640" y="416" width="210" height="48"/>
          <rect x="492" y="472" width="86" height="175"/>
          <rect x="780" y="510" width="86" height="140"/>
          <rect x="1065" y="296" width="382" height="204"/>
          <rect x="1068" y="564" width="382" height="62"/>
          <rect x="1080" y="724" width="360" height="94"/>
          <rect x="850" y="842" width="260" height="72"/>
        </g>
        <g class="cad-reference-labels" data-live-overlay="engine-inputs" data-cad-view="rebar-section" data-drawing-style="construction-section" data-cad-overlay="section-labels">
          <text x="585" y="303" text-anchor="middle" transform="rotate(-90 585 303)" class="cad-reference-note">H = ${format(snapshot.H)} m</text>
          <text x="750" y="450" text-anchor="middle" class="cad-reference-note">ระดับหัวฐาน · TOP FOOTING</text>
          <text x="585" y="548" text-anchor="middle" transform="rotate(-90 585 548)" class="cad-reference-dimension">${format(snapshot.T / 100)} m</text>
          <text x="1086" y="334" class="cad-reference-callout">เหล็กเสา · ดูรายละเอียดเสา</text>
          <text x="1086" y="384" class="cad-reference-callout">Dowel · ตาม Engine F1</text>
          <text x="1086" y="458" class="cad-reference-callout">DB${format(snapshot.mainBar, 0)} · A ${snapshot.barsA} / B ${snapshot.barsB}</text>
          <text x="1086" y="600" class="cad-reference-callout">RB${format(snapshot.tieBar, 0)} · ตะกร้อคว่ำ × ${hoopLabel}</text>
          <text x="1094" y="758" class="cad-reference-callout">เสาเข็ม · ${escapeHtml(snapshot.pileType)} · Ø ${format(snapshot.pileD, 0)} cm</text>
          <text x="1094" y="797" class="cad-reference-note">S.L. ${format(snapshot.pileSafeLoad, 0)} t/ต้น · ระยะหุ้ม ${format(snapshot.cover, 1)} cm</text>
          <text x="980" y="876" text-anchor="middle" class="cad-reference-title">รูปตัด 1–1 : F1</text>
          <text x="980" y="908" text-anchor="middle" class="cad-reference-scale">มาตราส่วน NTS</text>
        </g>
      </svg>
      <g class="cad-reference-mask" aria-hidden="true"><rect x="505" y="120" width="188" height="535"/></g>
    </svg>`;

  const sectionCadSvg = (snapshot) => {
    const hoopLabel = snapshot.hoops > 0 ? snapshot.hoops : "AUTO";
    const patternLabel = basketLabel(snapshot.pattern);
    const body = `
      <g class="cad-view-title"><text x="68" y="70">A · แปลน / รูปตัด${snapshot.pattern === "C" ? "ตะกร้อคว่ำ" : "ตะกร้อหงาย"} จากภาพอ้างอิง Owner</text><path d="M68 79H1118"/><text x="68" y="97" class="cad-view-meta">เส้นภาพต้นฉบับแบบ byte-exact · ข้อความและมิติจาก LIVE INPUT · NTS</text></g>
      <g data-cad-view="rebar-plan" data-drawing-style="construction-plan" data-drawing-source="owner-reference-raster" data-owner-reference-variant="${snapshot.pattern === "C" ? "inverted" : "upright"}">
        ${snapshot.pattern === "C" ? invertedBasketReferenceSvg(snapshot, hoopLabel) : `<svg x="46" y="98" width="1088" height="479" viewBox="0 0 1558 686" role="img" data-cad-reference-pattern="upright" aria-label="แปลนและรูปตัดตะกร้อหงายจากภาพอ้างอิง Owner พร้อมข้อความสดจาก Engine">
          <image href="${OWNER_REFERENCE_UPRIGHT}" x="0" y="0" width="1558" height="686" preserveAspectRatio="xMidYMid meet" class="cad-reference-base"/>
          <g class="cad-reference-mask" aria-hidden="true">
            <rect x="273" y="142" width="58" height="31"/>
            <rect x="226" y="183" width="62" height="31"/><rect x="318" y="183" width="62" height="31"/>
            <rect x="77" y="318" width="34" height="64"/>
            <rect x="118" y="257" width="34" height="63"/><rect x="118" y="363" width="34" height="63"/>
            <rect x="184" y="488" width="220" height="39"/><rect x="184" y="533" width="220" height="26"/>
            <circle cx="477" cy="353" r="8"/>
            <rect x="858" y="292" width="35" height="74"/><rect x="889" y="350" width="34" height="45"/>
            <rect x="1140" y="113" width="310" height="38"/>
            <rect x="1138" y="178" width="275" height="38"/>
            <rect x="1150" y="306" width="210" height="39"/>
            <rect x="1145" y="360" width="410" height="72"/>
            <rect x="1118" y="472" width="395" height="82"/>
            <rect x="900" y="568" width="305" height="43"/><rect x="900" y="616" width="305" height="29"/>
          </g>
          <g class="cad-reference-labels" data-live-overlay="engine-inputs">
            <g data-cad-overlay="plan-dimensions">
              <text x="302" y="163" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A)}</text>
              <text x="255" y="204" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A / 2)}</text>
              <text x="347" y="204" text-anchor="middle" class="cad-reference-dimension">${format(snapshot.A / 2)}</text>
              <text x="96" y="350" text-anchor="middle" transform="rotate(-90 96 350)" class="cad-reference-dimension">${format(snapshot.B)}</text>
              <text x="139" y="289" text-anchor="middle" transform="rotate(-90 139 289)" class="cad-reference-dimension">${format(snapshot.B / 2)}</text>
              <text x="139" y="395" text-anchor="middle" transform="rotate(-90 139 395)" class="cad-reference-dimension">${format(snapshot.B / 2)}</text>
              <text x="477" y="360" text-anchor="middle" class="cad-reference-cut-number">1</text>
              <text x="294" y="521" text-anchor="middle" class="cad-reference-title">แปลน F1</text>
              <text x="294" y="552" text-anchor="middle" class="cad-reference-scale">มาตราส่วน NTS</text>
            </g>
            <g data-cad-view="rebar-section" data-drawing-style="construction-section" data-cad-overlay="section-labels">
              <text x="881" y="331" text-anchor="middle" transform="rotate(-90 881 331)" class="cad-reference-dimension">${format(snapshot.T / 100)} m</text>
              <text x="912" y="373" text-anchor="middle" transform="rotate(-90 912 373)" class="cad-reference-dimension">0.05 m</text>
              <text x="1153" y="140" class="cad-reference-callout">เสา ${format(snapshot.columnA, 0)} × ${format(snapshot.columnB, 0)} cm</text>
              <text x="1153" y="203" class="cad-reference-callout">RB${format(snapshot.tieBar, 0)} · รัดรอบ × ${hoopLabel}</text>
              <text x="1163" y="331" class="cad-reference-callout">DB${format(snapshot.mainBar, 0)} · A ${snapshot.barsA} / B ${snapshot.barsB}</text>
              <text x="1153" y="383" class="cad-reference-callout">คอนกรีตหยาบ 1:3:5 หนา 0.05 m</text>
              <text x="1153" y="418" class="cad-reference-callout">ทรายอัดแน่น หนา 0.10 m</text>
              <text x="1128" y="497" class="cad-reference-callout">เสาเข็ม · ${escapeHtml(snapshot.pileType)} · Ø ${format(snapshot.pileD, 0)} cm</text>
              <text x="1128" y="528" class="cad-reference-note">S.L. ${format(snapshot.pileSafeLoad, 0)} t/ต้น · ระยะหุ้ม ${format(snapshot.cover, 1)} cm</text>
              <text x="1052" y="601" text-anchor="middle" class="cad-reference-title">รูปตัด 1–1 : F1</text>
              <text x="1052" y="636" text-anchor="middle" class="cad-reference-scale">มาตราส่วน NTS</text>
            </g>
          </g>
        </svg>`}
      </g>
      <g class="cad-bar-table">
        <rect x="48" y="592" width="568" height="132"/><path d="M48 618H616M48 653H616M48 688H616M102 592V724M270 592V724M450 592V724"/>
        <text x="64" y="610">MARK</text><text x="118" y="610">รายการ</text><text x="286" y="610">รายละเอียด</text><text x="470" y="610">จำนวน</text>
        <text x="70" y="642">#1</text><text x="118" y="642">ทิศ A</text><text x="286" y="642">DB${format(snapshot.mainBar, 0)} · ล่าง</text><text x="470" y="642">${snapshot.barsA}</text>
        <text x="70" y="677">#2</text><text x="118" y="677">ทิศ B</text><text x="286" y="677">DB${format(snapshot.mainBar, 0)} · เหนือ A</text><text x="470" y="677">${snapshot.barsB}</text>
        <text x="70" y="712">#3</text><text x="118" y="712">ปลอกรัด</text><text x="286" y="712">RB${format(snapshot.tieBar, 0)} · ${escapeHtml(patternLabel)}</text><text x="470" y="712">${snapshot.hoops}</text>
      </g>`;
    return sheetFrame({
      title: "F1 · OWNER REFERENCE PLAN / SECTION",
      subtitle: "เส้นแบบจากภาพ Owner แบบ byte-exact · ข้อความและมิติจาก Input ปัจจุบัน · NTS",
      code: "F1-R-03",
      body,
      status: snapshot.status
    });
  };

  const sectionEvidenceStrip = () => `
    <div class="f1-cad-source-note" aria-label="แหล่งข้อมูลแบบเหล็ก">
      <b>LIVE INPUT</b><span>มิติและ Mark อัปเดตจากค่าปัจจุบัน</span>
    </div>`;

  const createSectionSurface = (doc, section) => {
    const originalEvidence = doc.createElement("details");
    originalEvidence.className = "f1-original-engine-evidence";
    const summary = doc.createElement("summary");
    summary.textContent = "เปิดดูหลักฐานภาพเดิมจาก Engine";
    const content = doc.createElement("div");
    content.className = "f1-original-engine-evidence__content";
    Array.from(section.children).forEach((node) => content.append(node));
    originalEvidence.append(summary, content);

    const surface = doc.createElement("article");
    surface.className = "f1-cad-surface f1-cad-surface--section";
    surface.dataset.presentationSurface = "section";
    surface.innerHTML = `<header class="f1-cad-surface__header">
      <div><span>FLOW 03</span><h2>แบบเหล็กฐานราก</h2></div>
      <strong>OWNER REVIEW</strong>
    </header><div class="f1-cad-surface__sheet" data-cad-sheet-host></div><div data-cad-evidence-host></div>`;
    section.append(surface, originalEvidence);
    return surface;
  };

  const createEngine3DPresentation = (doc, engineWindow) => {
    const gridToggle = doc.querySelector('#v3dToggles button[data-layer="grid"]');
    gridToggle?.remove();

    const soilLegend = doc.querySelector('.v3d-legend [data-leg="soil"]')?.parentElement;
    if (soilLegend) {
      const swatch = soilLegend.querySelector("i");
      soilLegend.replaceChildren();
      if (swatch) soilLegend.append(swatch);
      soilLegend.append(doc.createTextNode("ผิวดิน Hatch"));
    }

    doc.body.dataset.f1ThreeSurface = "site-realistic";
    doc.body.dataset.f1ThreeReference = "scaffold-visual-study";
    let hatch = null;
    let presentation = null;
    let retryTimer = 0;
    let latestSnapshot = null;

    const createSurfaceTexture = (THREE, kind) => {
      const size = 192;
      const canvas = doc.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      let seed = kind === "soil" ? 3269 : kind === "sand" ? 8123 : 1947;
      const random = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return seed / 4294967296;
      };

      if (kind === "concrete") {
        context.fillStyle = "#e6e4df";
        context.fillRect(0, 0, size, size);
        for (let index = 0; index < 980; index += 1) {
          const shade = Math.round(82 + random() * 96);
          const alpha = 0.035 + random() * 0.11;
          const radius = 0.25 + random() * 1.3;
          context.fillStyle = `rgba(${shade},${shade},${shade - 4},${alpha})`;
          context.beginPath();
          context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = "rgba(92, 102, 110, 0.08)";
        context.lineWidth = 0.75;
        [[18, 52, 74, 43], [102, 21, 153, 31], [79, 146, 131, 135]].forEach(([x1, y1, x2, y2]) => {
          context.beginPath();
          context.moveTo(x1, y1);
          context.quadraticCurveTo((x1 + x2) / 2, y1 - 7, x2, y2);
          context.stroke();
        });
      } else {
        const soil = kind === "soil";
        context.fillStyle = soil ? "#9b7650" : "#c9ae7b";
        context.fillRect(0, 0, size, size);
        const count = soil ? 1450 : 900;
        for (let index = 0; index < count; index += 1) {
          const warm = soil ? 54 + Math.round(random() * 92) : 110 + Math.round(random() * 78);
          const alpha = 0.06 + random() * 0.2;
          const radius = 0.3 + random() * (soil ? 1.65 : 1.1);
          context.fillStyle = soil
            ? `rgba(${warm + 24},${warm + 5},${Math.max(28, warm - 23)},${alpha})`
            : `rgba(${warm + 18},${warm + 10},${Math.max(54, warm - 20)},${alpha})`;
          context.beginPath();
          context.arc(random() * size, random() * size, radius, 0, Math.PI * 2);
          context.fill();
        }
        if (soil) {
          context.strokeStyle = "rgba(242, 222, 190, 0.16)";
          context.lineWidth = 0.8;
          for (let offset = -size; offset <= size * 2; offset += 32) {
            context.beginPath();
            context.moveTo(offset, size);
            context.lineTo(offset + size, 0);
            context.stroke();
          }
        }
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      if (THREE.SRGBColorSpace && "colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.f1PresentationTexture = kind;
      return texture;
    };

    const createSkyTexture = (THREE) => {
      const canvas = doc.createElement("canvas");
      canvas.width = 32;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      const gradient = context.createLinearGradient(0, 0, 0, 256);
      gradient.addColorStop(0, "#cddce6");
      gradient.addColorStop(0.54, "#e4eaed");
      gradient.addColorStop(1, "#eee9df");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 256);
      const texture = new THREE.CanvasTexture(canvas);
      if (THREE.SRGBColorSpace && "colorSpace" in texture) texture.colorSpace = THREE.SRGBColorSpace;
      texture.userData.f1PresentationTexture = "site-sky";
      return texture;
    };

    const ensurePresentation = () => {
      const THREE = engineWindow.THREE;
      const V3 = engineWindow.V3;
      if (!THREE || !V3?.scene || !V3?.renderer || !V3?.mats) return false;

      V3.show.grid = false;
      if (V3.grid) V3.grid.visible = false;

      if (!presentation) {
        const concreteTexture = createSurfaceTexture(THREE, "concrete");
        const sandTexture = createSurfaceTexture(THREE, "sand");
        const hatchTexture = createSurfaceTexture(THREE, "soil");
        concreteTexture.repeat.set(1.8, 1.8);
        sandTexture.repeat.set(2.4, 2.4);
        const maxAnisotropy = Math.min(8, V3.renderer.capabilities?.getMaxAnisotropy?.() || 1);
        concreteTexture.anisotropy = maxAnisotropy;
        sandTexture.anisotropy = maxAnisotropy;
        hatchTexture.anisotropy = maxAnisotropy;

        V3.colors = {
          ...V3.colors,
          conc: "#c8cac8",
          col: "#b9c0c4",
          barA: "#a95d32",
          barB: "#0d628f",
          dowel: "#174f79",
          pile: "#a77d43",
          soil: "#9b7650",
          lean: "#b9b5ab",
          sand: "#c9ae7b"
        };

        const materials = {
          conc: new THREE.MeshStandardMaterial({
            color: V3.colors.conc,
            map: concreteTexture,
            roughness: 0.92,
            metalness: 0,
            transparent: true,
            opacity: 0.4,
            depthWrite: false
          }),
          col: new THREE.MeshStandardMaterial({
            color: V3.colors.col,
            map: concreteTexture,
            roughness: 0.88,
            metalness: 0,
            transparent: true,
            opacity: 0.54,
            depthWrite: false
          }),
          barA: new THREE.MeshStandardMaterial({color: V3.colors.barA, roughness: 0.34, metalness: 0.72}),
          barB: new THREE.MeshStandardMaterial({color: V3.colors.barB, roughness: 0.3, metalness: 0.76}),
          dowel: new THREE.MeshStandardMaterial({color: V3.colors.dowel, roughness: 0.28, metalness: 0.78}),
          tie: new THREE.MeshStandardMaterial({color: "#a63f35", roughness: 0.32, metalness: 0.7}),
          colBar: new THREE.MeshStandardMaterial({color: "#75818a", roughness: 0.26, metalness: 0.82}),
          pcwire: new THREE.MeshStandardMaterial({color: "#d6336c", roughness: 0.3, metalness: 0.68}),
          pile: new THREE.MeshStandardMaterial({
            color: V3.colors.pile,
            map: concreteTexture,
            roughness: 0.78,
            metalness: 0.04
          }),
          soil: new THREE.MeshStandardMaterial({
            color: V3.colors.soil,
            map: hatchTexture,
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
          }),
          lean: new THREE.MeshStandardMaterial({
            color: V3.colors.lean,
            map: concreteTexture,
            roughness: 0.96,
            metalness: 0,
            transparent: true,
            opacity: 0.9
          }),
          sand: new THREE.MeshStandardMaterial({
            color: V3.colors.sand,
            map: sandTexture,
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0.92
          })
        };
        Object.values(materials).forEach((material) => {
          material.userData.f1PresentationMaterial = "site-realistic";
        });

        const materialMap = new Map();
        Object.entries(materials).forEach(([key, material]) => {
          if (V3.mats[key]) materialMap.set(V3.mats[key], material);
          V3.mats[key] = material;
        });
        V3.scene.traverse((object) => {
          if (object.isMesh && materialMap.has(object.material)) {
            object.material = materialMap.get(object.material);
          }
        });

        V3.renderer.outputColorSpace = THREE.SRGBColorSpace || V3.renderer.outputColorSpace;
        V3.renderer.toneMapping = THREE.ACESFilmicToneMapping || V3.renderer.toneMapping;
        V3.renderer.toneMappingExposure = 1.04;
        V3.renderer.shadowMap.enabled = true;
        if (THREE.PCFSoftShadowMap) V3.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        V3.renderer.shadowMap.autoUpdate = true;

        V3.scene.traverse((object) => {
          if (object.isAmbientLight) object.intensity = 0.24;
          else if (object.isHemisphereLight) object.intensity = 0.34;
          else if (object.isDirectionalLight) object.intensity = Math.min(object.intensity, 0.26);
        });

        const keyLight = new THREE.DirectionalLight(0xfff4df, 1.22);
        keyLight.name = "F1_PRESENTATION_KEY_LIGHT";
        keyLight.position.set(-4.8, 8.2, 5.6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 0.1;
        keyLight.shadow.camera.far = 32;
        keyLight.shadow.bias = -0.00035;
        keyLight.shadow.normalBias = 0.018;
        keyLight.userData.f1PresentationLight = true;
        V3.scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xbcd8f0, 0.42);
        fillLight.name = "F1_PRESENTATION_FILL_LIGHT";
        fillLight.position.set(5.5, 4.2, -6.5);
        fillLight.userData.f1PresentationLight = true;
        V3.scene.add(fillLight);

        const skyTexture = createSkyTexture(THREE);
        presentation = {materials, concreteTexture, sandTexture, hatchTexture, skyTexture, keyLight};
        V3.__f1RealisticPresentation = Object.freeze({
          source: "local-visual-study",
          style: "site-realistic-v1",
          engineeringAuthority: false
        });
      }

      V3.scene.background = presentation.skyTexture;
      V3.scene.fog = new THREE.Fog(0xdce5e9, 14, 36);
      if (V3.__ws3d?.shadow) V3.__ws3d.shadow.visible = false;
      Object.values(V3.layers || {}).forEach((layer) => {
        layer?.traverse?.((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
      });
      return true;
    };

    const ensureHatch = () => {
      const THREE = engineWindow.THREE;
      const V3 = engineWindow.V3;
      if (!THREE || !V3?.scene || !ensurePresentation()) return false;

      if (!hatch) {
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: presentation.hatchTexture,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0.84,
          side: THREE.DoubleSide,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: 1
        });
        hatch = new THREE.Mesh(geometry, material);
        hatch.name = "F1_PRESENTATION_SOIL_HATCH";
        hatch.rotation.x = -Math.PI / 2;
        hatch.renderOrder = -6;
        hatch.receiveShadow = true;
        hatch.__ws3dShadow = true;
        hatch.userData.presentationOnly = true;
        hatch.userData.engineeringAuthority = false;
        V3.scene.add(hatch);
        V3.__f1SoilHatch = hatch;
      }

      const snapshot = latestSnapshot || readSnapshot(doc);
      const surfaceSize = Math.max(5.6, Math.max(snapshot.A, snapshot.B) * 5.2);
      hatch.scale.set(surfaceSize, surfaceSize, 1);
      presentation.hatchTexture.repeat.set(surfaceSize * 1.45, surfaceSize * 1.45);
      hatch.position.set(0, Number.isFinite(V3.gridY) ? V3.gridY - 0.004 : -(snapshot.T / 100) - 0.024, 0);
      hatch.visible = true;
      const shadowExtent = surfaceSize * 0.62;
      presentation.keyLight.shadow.camera.left = -shadowExtent;
      presentation.keyLight.shadow.camera.right = shadowExtent;
      presentation.keyLight.shadow.camera.top = shadowExtent;
      presentation.keyLight.shadow.camera.bottom = -shadowExtent;
      presentation.keyLight.shadow.camera.updateProjectionMatrix();
      V3.renderer.shadowMap.needsUpdate = true;
      return true;
    };

    const update = (snapshot) => {
      latestSnapshot = snapshot;
      engineWindow.clearTimeout(retryTimer);
      if (ensureHatch()) {
        engineWindow.v3render?.();
        return;
      }
      retryTimer = engineWindow.setTimeout(() => {
        if (ensureHatch()) engineWindow.v3render?.();
      }, 180);
    };

    return Object.freeze({ update });
  };

  const createSymbolicViewer = (doc, engineWindow, section) => {
    const originalViewer = section.querySelector("#v3dBox")?.parentElement || section;
    const switcher = doc.createElement("div");
    switcher.className = "f1-3d-modebar";
    switcher.innerHTML = `<div><span>ENGINEERING 3D</span><b>ตรวจรูปทรงจริง หรือดู Load path เชิงสัญลักษณ์</b></div>
      <div role="group" aria-label="เลือกรูปแบบสามมิติ">
        <button type="button" class="is-active" data-f1-3d-mode="engine" aria-pressed="true">โมเดลจริง</button>
        <button type="button" data-f1-3d-mode="symbolic" aria-pressed="false">ภาพเสียรูปเชิงสัญลักษณ์</button>
      </div>`;
    originalViewer.insertAdjacentElement("beforebegin", switcher);

    const stage = doc.createElement("div");
    stage.className = "f1-symbolic-3d";
    stage.hidden = true;
    stage.dataset.evaluation = "not-evaluated";
    stage.innerHTML = `<canvas class="f1-symbolic-3d__canvas" role="img" aria-label="ภาพสามมิติเสียรูปเชิงสัญลักษณ์ ไม่ใช่ผลการกระจัดหรือการทรุดตัว"></canvas>
      <div class="f1-symbolic-3d__guard"><b>NOT EVALUATED · NOT TO SCALE</b><span>ภาพขยายเพื่ออธิบาย Load path เท่านั้น · ไม่มีค่าการกระจัดหรือการทรุดตัว</span></div>
      <div class="f1-symbolic-3d__legend"><span><i class="is-load"></i>แรงจากเสา</span><span><i class="is-reaction"></i>ปฏิกิริยาเข็ม</span><span><i class="is-shape"></i>รูปเสียรูปขยาย</span></div>`;
    const originalBox = section.querySelector("#v3dBox");
    originalBox.insertAdjacentElement("afterend", stage);

    const createWebglFallback = () => {
      stage.hidden = true;
      stage.classList.add("is-fallback");
      doc.body.dataset.f1Webgl = "unavailable";
      switcher.querySelector("b").textContent = "อุปกรณ์นี้ไม่พร้อมแสดง WebGL · ส่วนคำนวณยังใช้งานได้";
      switcher.querySelectorAll("[data-f1-3d-mode]").forEach((button) => {
        button.disabled = true;
        button.setAttribute("aria-disabled", "true");
      });
      if (!originalViewer.querySelector(".f1-webgl-fallback")) {
        const notice = doc.createElement("div");
        notice.className = "f1-webgl-fallback";
        notice.setAttribute("role", "status");
        notice.innerHTML = `<span aria-hidden="true">3D</span><div><b>อุปกรณ์นี้ไม่พร้อมแสดงภาพสามมิติ</b><small>ข้อมูลนำเข้า ผลคำนวณ D/C แบบ และ A4 ยังใช้งานได้ตามปกติ</small></div>`;
        originalViewer.appendChild(notice);
      }
      const setMode = () => {
        originalBox.hidden = false;
        stage.hidden = true;
      };
      return { update() {}, resize() {}, setMode };
    };

    const THREE = engineWindow.THREE;
    const canvas = stage.querySelector("canvas");
    if (!THREE || !canvas || !engineWindow.V3?.renderer) return createWebglFallback();

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    } catch (error) {
      console.warn("[F1 presentation] WebGL unavailable; keeping calculation surfaces active.", error);
      return createWebglFallback();
    }
    doc.body.dataset.f1Webgl = "ready";
    renderer.setPixelRatio(Math.min(engineWindow.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xf3f7fa, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 100);
    camera.position.set(4.6, 3.4, 5.8);
    const target = new THREE.Vector3(0, -0.35, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x4a6072, 1.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
    keyLight.position.set(3, 6, 4);
    scene.add(keyLight);
    let model = null;
    let theta = 0.86;
    let phi = 0.56;
    let radius = 7.2;

    const render = () => {
      camera.position.set(
        target.x + radius * Math.cos(phi) * Math.cos(theta),
        target.y + radius * Math.sin(phi),
        target.z + radius * Math.cos(phi) * Math.sin(theta)
      );
      camera.lookAt(target);
      renderer.render(scene, camera);
    };

    const resize = () => {
      if (stage.hidden) return;
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      render();
    };

    const disposeObject = (object) => {
      object.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
        else child.material?.dispose?.();
      });
    };

    const update = (snapshot) => {
      if (model) {
        scene.remove(model);
        disposeObject(model);
      }
      model = new THREE.Group();
      const width = Math.max(0.8, snapshot.A);
      const depth = Math.max(0.8, snapshot.B);
      const thickness = Math.max(0.18, snapshot.T / 100);
      const columnW = Math.max(0.16, snapshot.columnA / 100);
      const columnD = Math.max(0.16, snapshot.columnB / 100);
      const pileD = Math.max(0.14, snapshot.pileD / 100);
      const sag = Math.min(0.18, thickness * 0.34);
      const topGeometry = new THREE.PlaneGeometry(width, depth, 22, 22);
      topGeometry.rotateX(-Math.PI / 2);
      const positions = topGeometry.attributes.position;
      const colors = [];
      const cool = new THREE.Color(0x315d86);
      const warm = new THREE.Color(0xd45a2a);
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        const normalized = Math.min(1, Math.sqrt((x / (width / 2)) ** 2 + (z / (depth / 2)) ** 2));
        const displacement = -sag * (1 - normalized ** 1.7);
        positions.setY(index, displacement);
        const color = cool.clone().lerp(warm, 1 - normalized);
        colors.push(color.r, color.g, color.b);
      }
      topGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      topGeometry.computeVertexNormals();
      const top = new THREE.Mesh(topGeometry, new THREE.MeshPhongMaterial({ vertexColors: true, side: THREE.DoubleSide, shininess: 25 }));
      top.position.y = thickness / 2;
      model.add(top);

      const undersideGeometry = topGeometry.clone();
      const underside = new THREE.Mesh(undersideGeometry, new THREE.MeshPhongMaterial({ color: 0x6f879a, side: THREE.DoubleSide, transparent: true, opacity: 0.88 }));
      underside.position.y = -thickness / 2;
      model.add(underside);
      const reference = new THREE.Mesh(
        new THREE.PlaneGeometry(width * 1.03, depth * 1.03),
        new THREE.MeshBasicMaterial({ color: 0x8093a3, wireframe: true, transparent: true, opacity: 0.18 })
      );
      reference.rotateX(-Math.PI / 2);
      reference.position.y = thickness / 2 + 0.015;
      model.add(reference);

      const column = new THREE.Mesh(
        new THREE.BoxGeometry(columnW, Math.max(0.8, thickness * 2.1), columnD),
        new THREE.MeshPhongMaterial({ color: 0xc6d0d8 })
      );
      column.position.y = thickness / 2 + 0.34;
      model.add(column);
      const pile = new THREE.Mesh(
        new THREE.CylinderGeometry(pileD / 2, pileD / 2, 2.4, 24),
        new THREE.MeshPhongMaterial({ color: 0x9b7046 })
      );
      pile.position.y = -thickness / 2 - 1.18;
      model.add(pile);

      const down = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 1.75, 0), 0.72, 0xb9471d, 0.18, 0.1);
      const up = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -2.75, 0), 0.72, 0x23639a, 0.18, 0.1);
      model.add(down, up);
      scene.add(model);
      target.set(0, -0.45, 0);
      radius = Math.max(5.6, Math.max(width, depth) * 3.7);
      render();
    };

    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    canvas.addEventListener("pointerdown", (event) => {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!dragging) return;
      theta -= (event.clientX - lastX) * 0.008;
      phi = Math.max(0.2, Math.min(1.25, phi + (event.clientY - lastY) * 0.006));
      lastX = event.clientX;
      lastY = event.clientY;
      render();
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      radius = Math.max(3.6, Math.min(16, radius * (event.deltaY > 0 ? 1.08 : 0.92)));
      render();
    }, { passive: false });

    const setMode = (mode) => {
      const symbolic = mode === "symbolic";
      originalBox.hidden = symbolic;
      stage.hidden = !symbolic;
      section.querySelectorAll("#v3dTone, #v3dColors, #v3dToggles").forEach((element) => { element.hidden = symbolic; });
      switcher.querySelectorAll("[data-f1-3d-mode]").forEach((button) => {
        const selected = button.getAttribute("data-f1-3d-mode") === mode;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (symbolic) engineWindow.requestAnimationFrame(resize);
      else engineWindow.requestAnimationFrame(() => {
        engineWindow.v3resize();
        engineWindow.v3render();
      });
    };
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest("[data-f1-3d-mode]");
      if (button) setMode(button.getAttribute("data-f1-3d-mode"));
    });
    engineWindow.addEventListener("resize", resize);
    return { update, resize, setMode };
  };

  const createReportIntro = (doc, section) => {
    const intro = doc.createElement("header");
    intro.className = "f1-a4-intro";
    intro.innerHTML = `<div><span>FLOW 05 · A4 CALCULATION REPORT</span><h2>รายงาน A4 · ผลคำนวณ เหล็ก และรูปตัด</h2><p>สถานะ เหล็กที่เลือก Plan/Section และสมการทั้งหมดอ่านจาก Engine F1 ชุดเดียวกัน</p></div>
      <strong>ENGINE RESULT · SINGLE SOURCE</strong>`;
    section.prepend(intro);
  };

  const normalizeReportText = (value) => String(value || "").replace(/\s+/g, " ").trim();

  const selectedPatternLabel = (snapshot) => basketLabel(snapshot.pattern);

  const namespaceSvgClone = (svg, suffix) => {
    const ids = new Map();
    svg.querySelectorAll("[id]").forEach((node) => {
      const sourceId = node.id;
      const targetId = `${sourceId}-${suffix}`;
      ids.set(sourceId, targetId);
      node.id = targetId;
    });
    svg.querySelectorAll("[aria-labelledby]").forEach((node) => {
      const namespaced = node.getAttribute("aria-labelledby").split(/\s+/)
        .map((id) => ids.get(id) || id).join(" ");
      node.setAttribute("aria-labelledby", namespaced);
    });
    return svg;
  };

  const createA4EngineeringEvidence = (doc, snapshot, sourceStepCount) => {
    const sourcePlan = doc.querySelector("#diagPlan svg");
    const sourceSection = doc.querySelector("#diagSec svg");
    const planClone = sourcePlan?.cloneNode(true) || null;
    const sectionClone = sourceSection?.cloneNode(true) || null;
    const planParity = Boolean(sourcePlan && planClone && sourcePlan.outerHTML === planClone.outerHTML);
    const sectionParity = Boolean(sourceSection && sectionClone && sourceSection.outerHTML === sectionClone.outerHTML);
    if (planClone) namespaceSvgClone(planClone, "a4-plan");
    if (sectionClone) namespaceSvgClone(sectionClone, "a4-section");
    rewriteCustomerPatternTree(planClone, snapshot.pattern);
    rewriteCustomerPatternTree(sectionClone, snapshot.pattern);

    const bomText = normalizeReportText(snapshot.bomText || doc.getElementById("o_bom")?.textContent);
    const customerBomText = customerPatternText(bomText, snapshot.pattern);
    const diagramText = normalizeReportText(`${sourcePlan?.textContent || ""} ${sourceSection?.textContent || ""}`);
    const mainBarToken = `DB${format(snapshot.mainBar, 0)}`;
    const expectedBomTokens = [
      `ทิศ A: ${snapshot.barsA}-${mainBarToken}`,
      `ทิศ B: ${snapshot.barsB}-${mainBarToken}`,
      snapshot.pattern === "C" ? "แบบ ข" : "แบบ ก",
      `ฐาน ${format(snapshot.A)}×${format(snapshot.B)}×${format(snapshot.T / 100)} m`,
      `เสาเข็ม ${snapshot.pileTypeCode}`,
      `S.L. ${format(snapshot.pileSafeLoad, 0)} t`
    ];
    const expectedDiagramTokens = [
      `#1 เหล็กล่าง ${snapshot.barsA}-${mainBarToken}`,
      `#2 เหล็กล่าง ${snapshot.barsB}-${mainBarToken}`,
      `RB${format(snapshot.tieBar, 0)}`,
      `ระยะหุ้ม ${format(snapshot.cover, 1)} cm`,
      `เสาเข็ม ${snapshot.pileTypeCode} Ø ${format(snapshot.pileD, 0)} cm`,
      snapshot.pattern === "C"
        ? `ตะกร้อ U คว่ำ (${snapshot.barsA}-${mainBarToken})`
        : `RB${format(snapshot.tieBar, 0)} × ${snapshot.hoops} เส้น`
    ];
    const rebarParity = Boolean(
      bomText
      && expectedBomTokens.every((token) => bomText.includes(token))
      && expectedDiagramTokens.every((token) => diagramText.includes(token))
    );
    const evidenceReady = planParity && sectionParity && rebarParity && sourceStepCount === 12;
    const patternLabel = selectedPatternLabel(snapshot);

    const root = doc.createElement("section");
    root.className = "f1-a4-engineering-evidence";
    root.dataset.planSourceParity = String(planParity);
    root.dataset.sectionSourceParity = String(sectionParity);
    root.dataset.rebarBomParity = String(rebarParity);
    root.dataset.evidenceReady = String(evidenceReady);
    root.innerHTML = `<div class="f1-a4-verdict" data-status-kind="${escapeHtml(snapshot.statusKind)}">
      <div><span>ผลจาก Engine F1 เดิม</span><b>${escapeHtml(snapshot.status)}</b><p>${escapeHtml(snapshot.summaryText)}</p></div>
      <dl><dt>ผ่านเกณฑ์</dt><dd>${snapshot.checksPassed} / ${snapshot.checksTotal}</dd><dt>รูปแบบเหล็ก</dt><dd>${escapeHtml(patternLabel)}</dd><dt>หลักฐาน</dt><dd>${evidenceReady ? "พร้อมพิมพ์" : "ไม่ครบ · ล็อกพิมพ์"}</dd></dl>
    </div>
    <div class="f1-a4-visual-grid" aria-label="Plan และ Section จาก Engine ปัจจุบัน">
      <figure data-a4-diagram="plan"><header><b>01 · แปลนเหล็ก · PLAN</b><span>${escapeHtml(patternLabel)}</span></header><div class="f1-a4-diagram-canvas"></div><figcaption>NTS · Current Engine Plan · OWNER REVIEW</figcaption></figure>
      <figure data-a4-diagram="section"><header><b>02 · รูปตัดเหล็ก · SECTION</b><span>${escapeHtml(patternLabel)}</span></header><div class="f1-a4-diagram-canvas"></div><figcaption>NTS · Current Engine Section · NOT FOR CONSTRUCTION</figcaption></figure>
    </div>
    <section class="f1-a4-rebar-summary">
      <header><b>03 · เหล็กที่เลือก · SELECTED REINFORCEMENT</b><span>ตรงกับ Input และ Engine BOM ปัจจุบัน</span></header>
      <table><thead><tr><th>MARK / รายการ</th><th>ขนาดและจำนวน</th><th>ตำแหน่ง / หมายเหตุ</th></tr></thead><tbody>
        <tr><th>#1 · ทิศ A</th><td>${snapshot.barsA}-${escapeHtml(mainBarToken)}</td><td>ชั้นล่างสุด · A = ${format(snapshot.A)} m</td></tr>
        <tr><th>#2 · ทิศ B</th><td>${snapshot.barsB}-${escapeHtml(mainBarToken)}</td><td>เหนือทิศ A · B = ${format(snapshot.B)} m</td></tr>
        <tr><th>#3 · รายละเอียด</th><td>${escapeHtml(patternLabel)}</td><td>RB${format(snapshot.tieBar, 0)} × ${snapshot.hoops} ปลอก · cover ${format(snapshot.cover, 1)} cm</td></tr>
        <tr><th>ฐาน / เข็ม</th><td>${format(snapshot.A)} × ${format(snapshot.B)} × ${format(snapshot.T / 100)} m</td><td>${escapeHtml(snapshot.pileType)} · Ø ${format(snapshot.pileD, 0)} cm · S.L. ${format(snapshot.pileSafeLoad, 0)} t</td></tr>
      </tbody></table>
      <p class="f1-a4-engine-bom"><b>ENGINE BOM</b><span>${escapeHtml(customerBomText || "ไม่พบหลักฐานเหล็กจาก Engine")}</span></p>
    </section>
    <p class="f1-a4-evidence-lock"${evidenceReady ? " hidden" : ""}><b>REPORT EVIDENCE LOCK</b><span>Plan, Section, เหล็กที่เลือก หรือรายการคำนวณไม่ตรงกับ Engine ปัจจุบัน จึงปิดการพิมพ์แบบ fail closed</span></p>`;

    if (planClone) root.querySelector('[data-a4-diagram="plan"] .f1-a4-diagram-canvas').append(planClone);
    if (sectionClone) root.querySelector('[data-a4-diagram="section"] .f1-a4-diagram-canvas').append(sectionClone);
    return Object.freeze({ root, evidenceReady, planParity, sectionParity, rebarParity });
  };

  const createA4PageHeader = (doc, snapshot, pageNumber, pageCount) => {
    const header = doc.createElement("header");
    header.className = "f1-a4-page__header";
    header.innerHTML = `<div class="f1-a4-page__title">
      <span>นายช่างใหญ่ Civil Apps · ฐานราก 1 เสาเข็ม</span>
      <h2>รายการคำนวณฐานราก 1 เสาเข็ม</h2>
      <p>FT-02 · CALCULATION REPORT</p>
    </div>
    <dl class="f1-a4-page__identity">
      <dt>เอกสาร</dt><dd>CALCULATION REVIEW</dd>
      <dt>หน้า</dt><dd>${String(pageNumber).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}</dd>
      <dt>สถานะ</dt><dd class="f1-a4-status" data-status-kind="${escapeHtml(snapshot.statusKind)}">${escapeHtml(snapshot.status)}</dd>
      <dt>ขอบเขต</dt><dd>OWNER REVIEW</dd>
    </dl>
    <strong class="f1-a4-page__hold">NOT FOR CONSTRUCTION</strong>`;
    return header;
  };

  const createA4PageFooter = (doc, snapshot, pageNumber, pageCount, sourceToken, sourceFooter) => {
    const footer = doc.createElement("footer");
    footer.className = "f1-a4-page__footer";
    footer.innerHTML = `<div><span>ENGINE SOURCE</span><code>${escapeHtml(sourceToken)}</code></div>
      <div><span>ENGINE STATUS</span><b>${escapeHtml(snapshot.status)}</b></div>
      <div><span>PAGE</span><b>${String(pageNumber).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}</b></div>
      <p>${escapeHtml(sourceFooter || "รายงานจาก Engine F1 เดิม")} · OWNER REVIEW · NOT FOR CONSTRUCTION</p>`;
    return footer;
  };

  const createA4Page = ({ doc, snapshot, pageNumber, pageCount, metadata, sourceToken, sourceFooter, label, variant }) => {
    const page = doc.createElement("article");
    page.className = "f1-a4-page report-bw";
    if (variant) page.classList.add(`f1-a4-page--${variant}`);
    page.dataset.reportPage = String(pageNumber);
    page.dataset.documentClass = "CALCULATION_REVIEW";
    page.dataset.engineSource = sourceToken;
    page.dataset.engineStatus = snapshot.status;
    page.setAttribute("aria-label", `รายงานฐานราก 1 เสาเข็ม หน้า ${pageNumber} จาก ${pageCount}`);
    page.append(createA4PageHeader(doc, snapshot, pageNumber, pageCount));

    if (metadata) {
      const context = metadata.cloneNode(true);
      context.classList.add("f1-a4-page__context");
      context.setAttribute("aria-label", "ข้อมูลโครงการและมาตรฐานรายงาน");
      page.append(context);
    }

    const sectionTitle = doc.createElement("div");
    sectionTitle.className = "f1-a4-page__section-title";
    sectionTitle.innerHTML = `<b>${escapeHtml(label)}</b><span>สูตร · แทนค่า · ผล · ตรวจสอบ จาก Engine เดิม</span>`;
    page.append(sectionTitle);

    const body = doc.createElement("div");
    body.className = "ckcr-steps f1-a4-page__steps";
    page.append(body);
    page.append(createA4PageFooter(doc, snapshot, pageNumber, pageCount, sourceToken, sourceFooter));
    return { page, body };
  };

  const standardizeA4Report = (doc, snapshot) => {
    const modal = doc.querySelector(".ckcr-modal");
    const report = modal?.querySelector(".ckcr-doc");
    const sourceSteps = report?.querySelector(":scope > .ckcr-steps");
    if (!modal || !report || !sourceSteps || report.dataset.f1A4Standard === "two-page") return;

    const metadata = report.querySelector(":scope > .ckcr-meta");
    const signoff = report.querySelector(":scope > .ckcr-sign");
    const sourceFooter = report.querySelector(":scope > .ckcr-rf")?.textContent?.trim() || "";
    const sourceToken = (doc.body.dataset.f1EngineSha256 || "ENGINE-DOM").slice(0, 12).toUpperCase();
    const sourceChildren = Array.from(sourceSteps.children);
    const sourceSegments = sourceChildren.map((node) => normalizeReportText(node.textContent));
    const sourceStepCount = sourceChildren.filter((node) => node.classList.contains("rep-step")).length;
    const pageCount = 2;

    const first = createA4Page({
      doc,
      snapshot,
      pageNumber: 1,
      pageCount,
      metadata,
      sourceToken,
      sourceFooter,
      label: "หลักฐาน 04 · สมการหลักและผลตรวจ 1–4",
      variant: "summary"
    });
    const second = createA4Page({
      doc,
      snapshot,
      pageNumber: 2,
      pageCount,
      metadata,
      sourceToken,
      sourceFooter,
      label: "หลักฐาน 05 · รายการคำนวณต่อเนื่อง 5–12",
      variant: "calculations"
    });

    const engineeringEvidence = createA4EngineeringEvidence(doc, snapshot, sourceStepCount);
    first.page.insertBefore(engineeringEvidence.root, first.page.querySelector(".f1-a4-page__section-title"));

    let visibleStep = 0;
    let targetBody = first.body;
    sourceChildren.forEach((node) => {
      if (node.classList.contains("rep-step") && visibleStep >= 4) targetBody = second.body;
      targetBody.append(node);
      if (node.classList.contains("rep-step")) visibleStep += 1;
    });
    if (signoff) {
      signoff.classList.add("f1-a4-page__signoff");
      second.page.insertBefore(signoff, second.page.querySelector(".f1-a4-page__footer"));
    }

    const projectedSegments = [...first.body.children, ...second.body.children]
      .map((node) => normalizeReportText(node.textContent));
    report.replaceChildren(first.page, second.page);
    report.classList.add("f1-a4-standard");
    report.dataset.f1A4Standard = "two-page";
    report.dataset.reportPageCount = String(pageCount);
    report.dataset.reportStepCount = String(sourceStepCount);
    report.dataset.reportStepSplit = "4+8";
    report.dataset.reportContentParity = String(JSON.stringify(projectedSegments) === JSON.stringify(sourceSegments));
    report.dataset.reportPlanParity = String(engineeringEvidence.planParity);
    report.dataset.reportSectionParity = String(engineeringEvidence.sectionParity);
    report.dataset.reportRebarParity = String(engineeringEvidence.rebarParity);
    report.dataset.reportEvidenceReady = String(engineeringEvidence.evidenceReady);
    modal.classList.add("f1-a4-modal");
    modal.dataset.reportContentParity = report.dataset.reportContentParity;
    modal.dataset.reportEvidenceReady = report.dataset.reportEvidenceReady;

    const toolbarTitle = modal.querySelector(".ckcr-toolbar .t-title");
    const toolbarSub = modal.querySelector(".ckcr-toolbar .t-sub");
    const printButton = modal.querySelector('[data-cr="plot"]');
    const hint = modal.querySelector(".ckcr-hint");
    if (toolbarTitle) toolbarTitle.textContent = "รายงาน A4 · ฐานราก 1 เสาเข็ม";
    if (toolbarSub) toolbarSub.textContent = "มาตรฐานนายช่างใหญ่ · A4 จริง 2 หน้า";
    if (printButton) {
      const icon = printButton.querySelector("svg");
      printButton.replaceChildren(...(icon ? [icon] : []), doc.createTextNode(" พิมพ์ / บันทึก PDF"));
      printButton.disabled = !engineeringEvidence.evidenceReady || report.dataset.reportContentParity !== "true";
      printButton.title = printButton.disabled
        ? "ล็อกพิมพ์: Plan/Section/เหล็ก/รายการคำนวณไม่ตรงกับ Engine ปัจจุบัน"
        : "พิมพ์รายงาน A4 มาตรฐานนายช่างใหญ่ 2 หน้า";
    }
    if (hint) hint.textContent = engineeringEvidence.evidenceReady
      ? "หน้า 1: ผลคำนวณ + เหล็กที่เลือก + Plan/Section · หน้า 2: รายการคำนวณต่อเนื่อง · OWNER REVIEW · NOT FOR CONSTRUCTION"
      : "REPORT EVIDENCE LOCK · Plan/Section/เหล็ก/รายการคำนวณยังไม่ตรงกับ Engine ปัจจุบัน";

    doc.getElementById("f1A4StandardPageRule")?.remove();
    const pageRule = doc.createElement("style");
    pageRule.id = "f1A4StandardPageRule";
    pageRule.textContent = "@page{size:A4 portrait;margin:0}";
    doc.head.append(pageRule);

    const cleanup = new doc.defaultView.MutationObserver(() => {
      if (modal.isConnected) return;
      pageRule.remove();
      cleanup.disconnect();
    });
    cleanup.observe(doc.body, { childList: true });
    modal.querySelector(".ckcr-stage")?.scrollTo({ top: 0, left: 0 });
  };

  const removeStandaloneCadAction = (doc) => {
    doc.querySelector(".ckds-open")?.remove();
    doc.body.dataset.f1StandaloneCad = "removed";
  };

  const relabelA4Action = (doc, getSnapshot) => {
    const button = doc.querySelector(".ckds-calc");
    if (!button) return;
    button.title = "รายงาน A4 · สรุปผลและรายการคำนวณ";
    const label = button.querySelector(".ckds-lbl");
    if (label) label.textContent = " รายงาน A4";
    button.addEventListener("click", () => {
      doc.defaultView.requestAnimationFrame(() => {
        standardizeA4Report(doc, getSnapshot());
      });
    });
  };

  const mount = ({ engineDocument, engineWindow, sections }) => {
    if (engineDocument.body.dataset.f1RedesignMounted === "true") return;
    engineDocument.body.dataset.f1RedesignMounted = "true";
    compactDetailingGroup(engineDocument);
    removeStandaloneCadAction(engineDocument);
    createProductHeader(engineDocument);
    const sectionSurface = createSectionSurface(engineDocument, sections.get("drawing"));
    const engine3DPresentation = createEngine3DPresentation(engineDocument, engineWindow);
    const symbolicViewer = createSymbolicViewer(engineDocument, engineWindow, sections.get("three"));
    createReportIntro(engineDocument, sections.get("calc"));
    const overview = createOverviewDashboard(
      engineDocument,
      engineWindow,
      sections.get("summary"),
      sections.get("three")
    );
    engineDocument.addEventListener("f1:flowchange", (event) => {
      if (event.detail?.key === "summary") symbolicViewer.setMode("engine");
    });

    let currentSnapshot = readSnapshot(engineDocument);
    let frame = 0;
    const render = () => {
      frame = 0;
      currentSnapshot = readSnapshot(engineDocument);
      sectionSurface.querySelector("[data-cad-sheet-host]").innerHTML = sectionCadSvg(currentSnapshot);
      sectionSurface.querySelector("[data-cad-evidence-host]").innerHTML = sectionEvidenceStrip();
      engine3DPresentation.update(currentSnapshot);
      symbolicViewer.update(currentSnapshot);
      overview?.update(currentSnapshot);
    };
    const scheduleRender = () => {
      if (frame) engineWindow.cancelAnimationFrame(frame);
      frame = engineWindow.requestAnimationFrame(render);
    };

    const observer = new engineWindow.MutationObserver(scheduleRender);
    ["o_summary", "anaPlanDiag", "anaSecDiag", "diagPlan", "diagSec", "repBody"].forEach((id) => {
      const target = engineDocument.getElementById(id);
      if (target) observer.observe(target, { childList: true, subtree: true, characterData: true });
    });
    engineDocument.addEventListener("input", scheduleRender);
    engineDocument.addEventListener("change", scheduleRender);
    relabelA4Action(engineDocument, () => readSnapshot(engineDocument));
    render();
    overview?.setFlow("summary");
  };

  window.OnePileMotherCardRedesign = Object.freeze({ mount });
})();
