(() => {
  const EMBED_SRC = "./roof-purlin-calculator.html?embed=1";
  const EMBED_ATTR = "data-roof-purlin-calculator";
  const STYLE_ID = "roof-purlin-calculator-style";

  function normalize(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      [${EMBED_ATTR}] {
        margin-top: 22px;
        border: 1px solid #dbe4ee;
        border-radius: 14px;
        background: #f8fafc;
        overflow: hidden;
      }
      [${EMBED_ATTR}] iframe {
        display: block;
        width: 100%;
        min-height: 1120px;
        border: 0;
        background: transparent;
      }
      @media (max-width: 768px) {
        [${EMBED_ATTR}] {
          margin-top: 14px;
          border-radius: 10px;
        }
        [${EMBED_ATTR}] iframe {
          min-height: 1900px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function findRoofHeader() {
    return Array.from(document.querySelectorAll("h1")).find((heading) => (
      normalize(heading.textContent) === "คำนวณโครงสร้างหลังคา"
    ));
  }

  function resizeFrame(frame) {
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      const height = Math.max(
        900,
        doc.documentElement.scrollHeight,
        doc.body ? doc.body.scrollHeight : 0
      );
      frame.style.height = `${height + 8}px`;
    } catch {
      // Same-origin iframe is expected. If access is blocked, keep CSS min-height.
    }
  }

  function mountCalculator() {
    const heading = findRoofHeader();
    if (!heading) return;

    const header = heading.closest("header") || heading.parentElement;
    const content = header && header.parentElement;
    if (!content) return;

    ensureStyle();

    let embed = content.querySelector(`[${EMBED_ATTR}]`);
    if (!embed) {
      embed = document.createElement("section");
      embed.setAttribute(EMBED_ATTR, "true");
      embed.innerHTML = `<iframe title="Purlin and rafter calculator" src="${EMBED_SRC}" loading="eager"></iframe>`;
      header.insertAdjacentElement("afterend", embed);
      const frame = embed.querySelector("iframe");
      frame.addEventListener("load", () => {
        resizeFrame(frame);
        setInterval(() => resizeFrame(frame), 800);
      });
    }

    Array.from(content.children).forEach((child) => {
      if (child === header || child === embed) return;
      child.style.display = "none";
      child.setAttribute("data-roof-purlin-hidden-original", "true");
    });
  }

  let scheduled = false;
  function scheduleMount() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      mountCalculator();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scheduleMount);
  } else {
    scheduleMount();
  }

  new MutationObserver(scheduleMount).observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
