(() => {
  "use strict";

  const ENGINE_STYLESHEET = "/one-pile-mother-card-engine.css?v=20260808-01";
  const ENGINE_SHA256 = "fc43f782836098b67e863171056349558df3576f0b1487ef85eac2cd7a4e04ef";
  const REQUIRED_IDS = Object.freeze([
    "fc", "fy", "phib", "phiv", "b1", "pileType", "pileSL", "pileD", "gsoil",
    "PD", "PL", "loadCombo", "e_ecc", "a1", "b1col", "A", "B", "T", "H",
    "cov", "dMain", "nA", "nB", "ldMode", "pat_a", "pat_c", "dTie", "nHoop",
    "showPC", "o_summary", "o_util", "o_checks", "o_bom", "takeoff", "wsDash",
    "anaPlanDiag", "anaSecDiag", "repBody", "diagPlan", "diagSec", "cv3d"
  ]);
  const FLOW_CONFIG = Object.freeze([
    { key: "summary", number: "01", label: "ภาพรวม", panel: "summary" },
    { key: "dc", number: "02", label: "ตรวจ D/C", panel: "dc" },
    {
      key: "section",
      number: "03",
      label: "รูปตัดเหล็กฐานราก",
      panel: "drawing",
      detail: "ผัง · Mark เหล็ก",
      icon: "rebar",
      accessibleLabel: "03 รูปตัดเหล็กฐานราก: ผังและ Mark เหล็ก, แบบเบื้องต้น ไม่ใช่แบบก่อสร้าง"
    },
    { key: "three", number: "04", label: "3D", panel: "three" },
    { key: "report", number: "05", label: "รายงาน A4", panel: "calc", action: "report" }
  ]);
  const FLOW_ICON_SVG = Object.freeze({
    rebar: `<svg viewBox="0 0 28 28" focusable="false">
      <title>ผังเหล็กฐานราก</title>
      <rect class="f1-flow-icon__structure" x="3.5" y="3.5" width="21" height="21" rx="1.5"/>
      <path class="f1-flow-icon__grid" d="M9 5.5v17m5-17v17m5-17v17M5.5 9h17m-17 5h17m-17 5h17"/>
      <rect class="f1-flow-icon__core" x="10.5" y="10.5" width="7" height="7" rx="1"/>
    </svg>`
  });
  const PANEL_MARKERS = Object.freeze([
    { key: "summary", marker: "sec-sum", label: "ภาพรวมผลการออกแบบ" },
    { key: "dc", marker: "sec-chk", label: "ตารางตรวจสอบ D/C" },
    { key: "analysis", marker: "sec-ana", label: "ผลวิเคราะห์เดิมจาก Engine (ซ่อนใน Presentation)" },
    { key: "calc", marker: "sec-rep", label: "รายการคำนวณ" },
    { key: "drawing", marker: "sec-dwg", label: "รูปตัด เหล็ก และชุดแบบ" },
    { key: "three", marker: "sec-3d", label: "แบบจำลองสามมิติ" }
  ]);

  const frame = document.getElementById("f1EngineFrame");
  const loading = document.getElementById("engineLoading");
  const error = document.getElementById("engineError");
  let readyTimeout = 0;

  function showError(message) {
    window.clearTimeout(readyTimeout);
    document.body.dataset.engineState = "error";
    loading.hidden = true;
    error.hidden = false;
    const detail = error.querySelector("span");
    if (detail) detail.textContent = message;
  }

  function injectStylesheet(engineDocument) {
    const existing = engineDocument.getElementById("f1MotherCardEngineStyles");
    if (existing) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const link = engineDocument.createElement("link");
      const timeout = window.setTimeout(() => reject(new Error("presentation stylesheet timeout")), 5000);
      link.id = "f1MotherCardEngineStyles";
      link.rel = "stylesheet";
      link.href = ENGINE_STYLESHEET;
      link.addEventListener("load", () => {
        window.clearTimeout(timeout);
        resolve();
      }, { once: true });
      link.addEventListener("error", () => {
        window.clearTimeout(timeout);
        reject(new Error("presentation stylesheet unavailable"));
      }, { once: true });
      engineDocument.head.append(link);
    });
  }

  function waitForRuntime(engineDocument, engineWindow) {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const probe = () => {
        const hasFunctions = ["compute", "render", "v3resize", "v3render"]
          .every((name) => typeof engineWindow[name] === "function");
        const hasControls = Boolean(
          engineDocument.querySelector(".ckds-open") &&
          engineDocument.querySelector(".ckds-calc") &&
          engineDocument.querySelector(".ckpr-panel")
        );
        if (hasFunctions && hasControls) {
          resolve();
          return;
        }
        attempts += 1;
        if (attempts >= 80) {
          reject(new Error("F1 runtime controls did not finish initializing"));
          return;
        }
        window.setTimeout(probe, 50);
      };
      probe();
    });
  }

  function assertEngineContract(engineDocument) {
    const missingIds = REQUIRED_IDS.filter((id) => !engineDocument.getElementById(id));
    if (missingIds.length) {
      throw new Error(`F1 Engine ขาดข้อมูลเดิม: ${missingIds.join(", ")}`);
    }

    const panels = engineDocument.querySelectorAll(".wrap > .panel");
    if (panels.length !== 2 || !engineDocument.getElementById("secnav")) {
      throw new Error("โครงหน้า F1 Engine เดิมไม่ตรงกับ Presentation Adapter");
    }
  }

  function insertEngineContract(engineDocument) {
    if (engineDocument.getElementById("f1EngineContract")) return;

    const contract = engineDocument.createElement("section");
    contract.id = "f1EngineContract";
    contract.className = "f1-engine-contract";
    contract.setAttribute("aria-label", "ขอบเขต Engine และ Presentation");
    contract.innerHTML = [
      '<span class="f1-engine-contract__badge">ENGINE เดิม</span>',
      '<span class="f1-engine-contract__statement"><b>Input · Engine · สูตร · D/C · เหล็ก ชุดเดิมทั้งหมด</b><small>Plan/Section · A4 · 3D รอบนี้เป็น Presentation สำหรับ Owner review</small></span>',
      `<code title="SHA-256 ของ footing-1pile.html">SOURCE ${ENGINE_SHA256.slice(0, 12).toUpperCase()}</code>`,
      '<span class="f1-engine-contract__mode">PRESENTATION ONLY</span>'
    ].join("");

    const appbar = engineDocument.querySelector(".appbar");
    appbar.insertAdjacentElement("afterend", contract);
  }

  function numberInputGroups(engineDocument) {
    const inputPanel = engineDocument.querySelector(".wrap > .panel:first-child");
    inputPanel.id = "f1-engine-input-rail";
    inputPanel.classList.add("f1-engine-input-rail");
    inputPanel.querySelectorAll(".group").forEach((group, index) => {
      group.dataset.groupIndex = String(index + 1).padStart(2, "0");
    });
  }

  function buildMobileWorkspaceSwitch(engineDocument) {
    const wrap = engineDocument.querySelector(".wrap");
    const resultPanel = engineDocument.querySelector(".f1-engine-result-canvas");
    if (!wrap || !resultPanel) return () => {};

    resultPanel.id = "f1-engine-result-canvas";
    const switcher = engineDocument.createElement("nav");
    switcher.className = "f1-mobile-workspace-switch";
    switcher.setAttribute("aria-label", "สลับพื้นที่ทำงานบนมือถือ");

    const panes = [
      { key: "results", label: "ผลคำนวณ", controls: resultPanel.id },
      { key: "input", label: "ข้อมูลนำเข้า", controls: "f1-engine-input-rail" }
    ];
    const buttons = panes.map((pane) => {
      const button = engineDocument.createElement("button");
      button.type = "button";
      button.dataset.mobilePane = pane.key;
      button.setAttribute("aria-controls", pane.controls);
      button.setAttribute("aria-pressed", "false");
      button.textContent = pane.label;
      switcher.append(button);
      return button;
    });

    const activatePane = (key, options = {}) => {
      const pane = panes.some((item) => item.key === key) ? key : "results";
      engineDocument.body.dataset.f1MobilePane = pane;
      buttons.forEach((button) => {
        const selected = button.dataset.mobilePane === pane;
        button.classList.toggle("is-active", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
      if (options.focus) buttons.find((button) => button.dataset.mobilePane === pane)?.focus();
    };

    buttons.forEach((button) => {
      button.addEventListener("click", () => activatePane(button.dataset.mobilePane));
    });
    wrap.insertAdjacentElement("beforebegin", switcher);
    activatePane("results");
    return activatePane;
  }

  function buildFlowPanels(engineDocument) {
    const resultPanel = engineDocument.querySelector(".wrap > .panel:last-child");
    const panelBody = resultPanel.querySelector(":scope > .panel-body");
    const originalChildren = Array.from(panelBody.children);
    const sections = new Map();

    resultPanel.classList.add("f1-engine-result-canvas");

    PANEL_MARKERS.forEach((definition, index) => {
      const marker = engineDocument.getElementById(definition.marker);
      const start = originalChildren.indexOf(marker);
      const nextMarker = PANEL_MARKERS[index + 1]
        ? engineDocument.getElementById(PANEL_MARKERS[index + 1].marker)
        : null;
      const end = nextMarker ? originalChildren.indexOf(nextMarker) : originalChildren.length;
      if (start < 0 || end <= start) {
        throw new Error(`จัดกลุ่มผลเดิมไม่ได้: ${definition.marker}`);
      }

      const section = engineDocument.createElement("section");
      section.id = `f1-engine-panel-${definition.key}`;
      section.className = "f1-engine-flow-panel";
      section.dataset.enginePanel = definition.key;
      if (definition.key === "analysis") {
        section.dataset.presentationState = "source-only-hidden";
      }
      section.setAttribute("role", "tabpanel");
      section.setAttribute("aria-label", definition.label);
      originalChildren.slice(start, end).forEach((node) => section.append(node));
      sections.set(definition.key, section);
    });

    panelBody.replaceChildren(...sections.values());

    const planCell = engineDocument.getElementById("diagPlan").closest(".diag-cell");
    const sectionCell = engineDocument.getElementById("diagSec").closest(".diag-cell");
    planCell.classList.add("f1-plan-cell");
    sectionCell.classList.add("f1-section-cell");
    sectionCell.removeAttribute("style");

    return sections;
  }

  function buildFlowTabs(engineDocument, engineWindow, sections, activateMobilePane) {
    const nav = engineDocument.getElementById("secnav");
    const tabs = FLOW_CONFIG.map((flow) => {
      const button = engineDocument.createElement("button");
      button.type = "button";
      button.id = `f1-engine-tab-${flow.key}`;
      button.className = "f1-engine-flow-tab";
      button.dataset.flow = flow.key;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-controls", `f1-engine-panel-${flow.panel}`);
      button.setAttribute("aria-selected", "false");
      button.tabIndex = -1;
      if (flow.accessibleLabel) button.setAttribute("aria-label", flow.accessibleLabel);

      const index = engineDocument.createElement("span");
      index.className = "f1-engine-flow-index";
      index.textContent = flow.number;
      index.setAttribute("aria-hidden", "true");

      const label = engineDocument.createElement("span");
      label.className = "f1-engine-flow-label";
      label.textContent = flow.label;

      const copy = engineDocument.createElement("span");
      copy.className = "f1-engine-flow-copy";
      copy.append(label);

      if (flow.detail) {
        const detail = engineDocument.createElement("span");
        detail.className = "f1-engine-flow-detail";
        detail.textContent = flow.detail;
        copy.append(detail);
      }

      if (flow.icon && FLOW_ICON_SVG[flow.icon]) {
        button.classList.add("has-footing-context");
        const icon = engineDocument.createElement("span");
        icon.className = `f1-engine-flow-icon f1-engine-flow-icon--${flow.icon}`;
        icon.setAttribute("aria-hidden", "true");
        icon.innerHTML = FLOW_ICON_SVG[flow.icon];
        button.append(index, icon, copy);
      } else {
        button.append(index, copy);
      }
      return button;
    });

    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "ลำดับงานฐานราก 1 เสาเข็ม");
    nav.replaceChildren(...tabs);

    const activate = (key, options = {}) => {
      const flow = FLOW_CONFIG.find((item) => item.key === key) || FLOW_CONFIG[0];
      activateMobilePane("results");
      engineDocument.body.dataset.f1ActiveFlow = flow.key;

      sections.forEach((section, panelKey) => {
        const selected = panelKey === flow.panel;
        section.hidden = !selected;
        section.setAttribute("aria-hidden", String(!selected));
      });

      tabs.forEach((tab) => {
        const selected = tab.dataset.flow === flow.key;
        tab.classList.toggle("is-active", selected);
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
      });

      engineDocument.dispatchEvent(new engineWindow.CustomEvent("f1:flowchange", {
        detail: { key: flow.key, panel: flow.panel }
      }));

      if (options.focus) {
        engineDocument.getElementById(`f1-engine-tab-${flow.key}`).focus();
      }

      if (flow.panel === "three") {
        engineWindow.requestAnimationFrame(() => {
          engineWindow.requestAnimationFrame(() => {
            engineWindow.v3resize();
            engineWindow.v3render();
          });
        });
      }

      if (options.invokeAction && flow.action === "report") {
        engineWindow.requestAnimationFrame(() => {
          const actionButton = engineDocument.querySelector(".ckds-calc");
          if (actionButton) actionButton.click();
        });
      }
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () => activate(tab.dataset.flow, { invokeAction: true }));
      tab.addEventListener("keydown", (event) => {
        const currentIndex = tabs.indexOf(tab);
        let targetIndex = currentIndex;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") targetIndex = (currentIndex + 1) % tabs.length;
        else if (event.key === "ArrowLeft" || event.key === "ArrowUp") targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") targetIndex = 0;
        else if (event.key === "End") targetIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        activate(tabs[targetIndex].dataset.flow, { focus: true, invokeAction: false });
      });
    });

    activate("summary");
  }

  async function mountEnginePresentation() {
    const engineWindow = frame.contentWindow;
    const engineDocument = frame.contentDocument;
    if (!engineWindow || !engineDocument) {
      throw new Error("Mockup เข้าถึง F1 Engine เดิมไม่ได้");
    }
    if (engineDocument.body?.dataset.f1MotherCardMounted === "true") {
      document.body.dataset.engineState = "ready";
      loading.hidden = true;
      return;
    }

    await waitForRuntime(engineDocument, engineWindow);
    assertEngineContract(engineDocument);
    await injectStylesheet(engineDocument);

    engineDocument.documentElement.classList.add("f1-mother-card-engine-root");
    engineDocument.body.classList.add("f1-mother-card-engine");
    engineDocument.body.dataset.f1EngineSha256 = ENGINE_SHA256;
    engineDocument.body.dataset.f1MotherCardMounted = "true";
    engineDocument.title = "ฐานราก 1 เสาเข็ม · F1 Engine Mother-Card Responsive";

    insertEngineContract(engineDocument);
    numberInputGroups(engineDocument);
    const sections = buildFlowPanels(engineDocument);
    const activateMobilePane = buildMobileWorkspaceSwitch(engineDocument);
    if (!window.OnePileMotherCardRedesign?.mount) {
      throw new Error("โหลด Presentation renderer สำหรับ Plan/Section, A4 และ 3D ไม่สำเร็จ");
    }
    window.OnePileMotherCardRedesign.mount({ engineDocument, engineWindow, sections });
    buildFlowTabs(engineDocument, engineWindow, sections, activateMobilePane);
    const { mountOnePileProjectInputs } = await import('./one-pile-project-inputs.mjs');
    mountOnePileProjectInputs(engineWindow);

    engineWindow.dispatchEvent(new Event("resize"));
    window.clearTimeout(readyTimeout);
    document.body.dataset.engineState = "ready";
    frame.dataset.engineMounted = "true";
    loading.hidden = true;
    error.hidden = true;
  }

  frame.addEventListener("load", () => {
    if (frame.dataset.saveRuntimeReady !== "true") return;
    mountEnginePresentation().catch((mountError) => {
      showError(mountError instanceof Error ? mountError.message : "เกิดข้อผิดพลาดระหว่างจัดหน้าจอ");
    });
  });

  readyTimeout = window.setTimeout(() => {
    if (document.body.dataset.engineState !== "ready") {
      showError("โหลด F1 Engine เดิมนานเกินกำหนด กรุณาโหลดหน้านี้ใหม่");
    }
  }, 15000);
})();
