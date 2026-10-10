// Presentation only: move the original result nodes, never copy inputs or results.
export function mountResultDialog({ views, nodes, onSelect, onClose, onPrint }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'rwResultDialog';
  dialog.className = 'rw-result-dialog';
  dialog.setAttribute('aria-labelledby', 'rwResultTitle');
  dialog.innerHTML = '<header class="rw-popup-heading"><div><small>RW-01 <span data-popup-type></span></small>'
    + '<h2 id="rwResultTitle"></h2></div><div class="rw-popup-actions">'
    + '<button type="button" data-popup-print>พิมพ์ A4 / PDF</button>'
    + '<button type="button" data-popup-close autofocus><span aria-hidden="true">×</span> ปิด</button></div></header>'
    + '<nav class="rw-popup-nav" aria-label="เลือกผลในหน้าต่าง">'
    + views.map(([key, label]) => '<button type="button" data-popup-view="' + key + '">' + label + '</button>').join('')
    + '</nav><div class="rw-popup-status" role="status"><b></b><span></span></div>'
    + '<div class="rw-flow-work rw-popup-body"></div>';
  document.body.append(dialog);
  const body = dialog.querySelector('.rw-popup-body');
  const buttons = [...dialog.querySelectorAll('[data-popup-view]')];
  const homes = new Map();
  for (const node of new Set(Object.values(nodes).flat())) {
    const marker = document.createComment('rw-result-home');
    node.before(marker);
    homes.set(node, marker);
  }
  let active = null, returnFocus = null;
  function restore() {
    for (const node of [...body.children]) homes.get(node)?.after(node);
  }
  function finish() {
    if (active === null) return;
    restore(); active = null;
    onClose();
    if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }
  function close() {
    if (dialog.open) dialog.close();
    finish();
  }
  dialog.querySelector('[data-popup-close]').addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { if (!dialog.open) finish(); });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(node => node.tabIndex >= 0 && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  // A click in the dialog's own padding is not a backdrop dismissal.
  let backdropStart = false;
  const outside = event => {
    const r = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < r.left || event.clientX > r.right
      || event.clientY < r.top || event.clientY > r.bottom);
  };
  dialog.addEventListener('pointerdown', event => { backdropStart = outside(event); });
  dialog.addEventListener('click', event => { if (backdropStart && outside(event)) close(); backdropStart = false; });
  buttons.forEach(button => button.addEventListener('click', () => onSelect(button.dataset.popupView)));
  dialog.querySelector('[data-popup-print]').addEventListener('click', onPrint);
  // Native print styles expect the report in its original document location.
  window.addEventListener('beforeprint', close);
  return {
    get open() { return dialog.open; },
    close,
    show(view) {
      if (!nodes[view]) return;
      if (!dialog.open) returnFocus = document.activeElement;
      if (active !== view) { restore(); body.append(...nodes[view]); }
      active = view; body.dataset.view = view;
      dialog.querySelector('h2').textContent = views.find(([key]) => key === view)[1];
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.popupView === view)));
      dialog.querySelector('[data-popup-print]').hidden = view !== 'report';
      if (!dialog.open) dialog.showModal();
    },
    setLayout({ draft, sheet }) { body.dataset.draft = draft; body.dataset.sheet = sheet; },
    setState({ type, state, title, detail, ready }) {
      dialog.querySelector('[data-popup-type]').textContent = '· ' + type;
      const status = dialog.querySelector('.rw-popup-status'); status.dataset.state = state;
      status.querySelector('b').textContent = title;
      status.querySelector('span').textContent = detail || '';
      buttons.forEach(button => { button.disabled = !ready && button.dataset.popupView !== 'plan'; });
      dialog.querySelector('[data-popup-print]').disabled = !ready;
    },
  };
}
