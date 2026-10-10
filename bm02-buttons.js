/* Decorative icons only. Existing button nodes, labels and handlers are retained. */
(function bm02ButtonIcons() {
  'use strict';
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    chart: '<path d="M3 3v18h18M6 14l5-6 5 9 5-12"/>',
    section: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M7 7h10M7 12h10M7 17h10"/>',
    box: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9"/>',
    file: '<path d="M14 2H5v20h14V7l-5-5ZM14 2v5h5M8 12h8M8 16h8"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>',
    print: '<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 14h12v7H6zM17 11h1"/>',
    calculate: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1M12 11h1M16 11h.01M8 15h1M12 15h1M16 15v4M8 19h5"/>',
    reset: '<path d="M3 10a9 9 0 1 1 2 9M3 4v6h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    left: '<path d="m14 5-7 7 7 7"/>',
    right: '<path d="m10 5 7 7-7 7"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    fit: '<path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/>',
    save: '<path d="M3 3h15l3 3v15H3zM7 3v6h10V3M7 21v-7h10v7"/>',
    folder: '<path d="M3 6h7l2 3h9v12H3zM3 9V4h7l2 2h8"/>',
  };
  const urls = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key,
    'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>') + '")']));
  const ids = { btnRun: 'calculate', btnReset: 'reset', btnGuide: 'help', btnPrint: 'print',
    btnAddPL: 'plus', btnGuideClose: 'close', btnGuidePrev: 'left', btnGuideNext: 'right',
    btnAssistantIntakeClose: 'close', btnAssistantReview: 'eye', btnAssistantConfirmRun: 'check' };
  const views = { summary: 'grid', dc: 'chart', draw: 'section', model: 'box', report: 'file' };
  function decorate(button) {
    if (button.id === 'btnBack') return;
    const label = button.textContent.trim();
    const iconOnly = /^[+−×]$/.test(label);
    const icon = ids[button.id] || views[button.dataset.view]
      || (button.dataset.layerStep ? (button.dataset.layerStep === '1' ? 'plus' : 'minus') : null)
      || (button.hasAttribute('data-del') ? 'close' : null)
      || (button.hasAttribute('data-section-span') ? 'section' : null)
      || (button.dataset.mobilePane ? (button.dataset.mobilePane === 'input' ? 'section' : 'chart') : null)
      || (button.hasAttribute('data-v3-fit') ? 'fit' : null)
      || (button.hasAttribute('data-v3-camera') || button.hasAttribute('data-v3-ortho') ? 'box' : null)
      || (button.hasAttribute('data-v3-layer') ? 'eye' : null)
      || (button.dataset.hero === 'three' || button.dataset.v3Mode === 'real' ? 'box' : null)
      || (button.dataset.hero === 'elev' ? 'section' : null)
      || (button.dataset.hero || button.dataset.v3Mode ? 'chart' : null)
      || (/บันทึก|Save|ดาวน์โหลด/.test(label) ? 'save' : /เปิด|Open/.test(label) ? 'folder' : 'file');
    button.dataset.ncyIcon = icon;
    button.style.setProperty('--bm02-button-icon', urls[icon]);
    if (iconOnly) button.setAttribute('data-ncy-icon-only', '');
    if (button.hasAttribute('data-del')) button.setAttribute('aria-label', 'ลบแรงจุด');
  }
  function scan(root) {
    if (root.matches?.('button')) decorate(root);
    root.querySelectorAll?.('button').forEach(decorate);
    root.querySelectorAll?.('.sv-concrete-project > summary').forEach(summary => {
      summary.style.setProperty('--bm02-button-icon', urls.folder);
    });
  }
  const app = document.querySelector('.app');
  if (!app) return;
  scan(app);
  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === 1) scan(node);
  }))).observe(app, { childList: true, subtree: true });
})();
