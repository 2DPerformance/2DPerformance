import { adaptOnePileStorageSafety } from './concrete-storage-source-adapter.mjs';

// The approved donor and dependencies remain untouched. Verify before applying
// the storage-only adapter to copies in the same-origin presentation frame.
const assets = [
  ['footing-1pile.html', 'fc43f782836098b67e863171056349558df3576f0b1487ef85eac2cd7a4e04ef'],
  ['ck-print-report.js', '4810651ba0bbc94ab303dcb73b12b391eab8a340cb69f71d6bd4dc676acf954f'],
  ['ck-drawing-sheet.js', '7851128251a0f1ad46248989fb836ef797f56cf0d468f1f02a88051974a33bbb'],
];
async function verifiedText([file, expected]) {
  const response = await fetch('/Concrete-design/' + file, { cache: 'no-store' });
  if (!response.ok) throw new Error('โหลดต้นฉบับไม่สำเร็จ: ' + file);
  const text = (await response.text()).replace(/\r\n/g, '\n');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
  if (hash !== expected) throw new Error('ต้นฉบับไม่ตรงแฮชที่อนุมัติ: ' + file);
  return text;
}
async function mount() {
  if (!window.SVConcreteSaveSafety) throw new Error('ระบบแจ้งสถานะบันทึกยังไม่พร้อม');
  const [html, report, drawing] = await Promise.all(assets.map(verifiedText));
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = doc.createElement('base'); base.href = new URL('/Concrete-design/', location.href).href; doc.head.prepend(base);
  const bridge = doc.createElement('script'); bridge.textContent = 'window.SVConcreteSaveSafety=window.parent.SVConcreteSaveSafety;'; doc.head.prepend(bridge);
  for (const [file, text, kind] of [['ck-print-report.js', report, 'report'], ['ck-drawing-sheet.js', drawing, 'drawing']]) {
    const script = doc.querySelector(`script[src="${file}"]`);
    if (!script) throw new Error('ไม่พบจุดโหลดที่อนุมัติ: ' + file);
    const replacement = doc.createElement('script');
    replacement.textContent = adaptOnePileStorageSafety(text, kind).replace(/<\/script/gi, '<\\/script');
    script.replaceWith(replacement);
  }
  // srcdoc inherits the parent security origin, while location.origin itself
  // may be "null". Preserve the same-origin parent guard against the pinned base.
  const guard = [...doc.querySelectorAll('script:not([src])')].find(script => script.textContent.includes('SV-20260807-02'));
  const originCheck = 'window.parent.location.origin === window.location.origin';
  if (!guard || guard.textContent.split(originCheck).length !== 2) throw new Error('รูปแบบด่านเข้าไม่ตรงต้นฉบับ');
  guard.textContent = guard.textContent.replace(originCheck, 'window.parent.location.origin === new URL(document.baseURI).origin');
  const frame = document.getElementById('f1EngineFrame');
  frame.dataset.saveRuntimeReady = 'true';
  frame.srcdoc = '<!doctype html>\n' + doc.documentElement.outerHTML;
}
mount().catch(error => {
  document.body.dataset.engineState = 'error';
  document.getElementById('engineLoading').hidden = true;
  const panel = document.getElementById('engineError'); panel.hidden = false;
  panel.querySelector('span').textContent = error.message + ' กรุณาคงไฟล์งานเดิมไว้';
});
