import { createScaffoldScene } from './scene.js';
import { createBayInspection } from './assembly-accessories.js';
import {
  captureControllerProjection,
  projectUnavailableVisualBoundary,
  projectControllerOverview,
} from './controller-projection.js';

const query = new URLSearchParams(window.location.search);
function hasSameOriginParent() {
  if (window.parent === window) return false;
  try { return window.parent.location.origin === window.location.origin; } catch (_) { return false; }
}
const controllerNonce = String(query.get('bridgeNonce') || '');
const controllerMode = query.get('embed') === 'controller-stage1'
  && /^[a-f0-9]{32}$/.test(controllerNonce)
  && hasSameOriginParent();
const BRIDGE = Object.freeze({
  channel: 'ncy:sh01:overview-stage1',
  version: 1,
  childDirection: 'overview-to-host',
  hostDirection: 'host-to-overview',
});
const PARENT_TABS = Object.freeze({
  overview: 'dashboard', plan: 'plan', model: 'model3d', formulas: 'calculations',
  profiles: 'profiles', boq: 'boq', reports: 'reports', reference: 'references', qa: 'qa',
});

const paths = {
  grid:'M4 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM15 3h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM4 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1zM15 14h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1z',
  plan:'M3 3h18v18H3zM3 10h8V3M11 10v5M11 21v-2M11 15h10M6 6h2M6 14v4M15 7h3M16 18h2',
  cube:'m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8',
  formula:'M18 5V3H6l7 9-7 9h12v-2',
  steel:'M5 3h14v4h-5v10h5v4H5v-4h5V7H5z',
  box:'m12 3 9 5v8l-9 5-9-5V8zM3 8l9 5 9-5M12 13v8M7.5 5.5l9 5V14',
  file:'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5',
  book:'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1zM12 5v15M6 8h3M15 8h3M6 12h3M15 12h3',
  shield:'m12 3-8 3v6c0 4.5 3.5 7 8 9 4.5-2 8-4.5 8-9V6zM12 8v5M12 16h.01',
  folder:'M3 7V6a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7zM3 10h18',
  external:'M14 3h7v7M21 3l-10 10M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5',
  reset:'M3 10a9 9 0 1 1 1.8 8M3 4v6h6',
  plus:'M12 5v14M5 12h14',
  minus:'M5 12h14',
  chevron:'m6 9 6 6 6-6',
  sliders:'M5 3v3M5 10v11M12 3v11M12 18v3M19 3v5M19 12v9M3 6h4v4H3zM10 14h4v4h-4zM17 8h4v4h-4z',
  frame:'M5 21V3h14v18M5 6h14M5 6l14 12M19 6 5 18M3 21h4M17 21h4',
  arrow:'M4 12h16M14 6l6 6-6 6',
  back:'M20 12H4M10 6l-6 6 6 6',
  calculator:'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01M16 17h.01',
  input:'M11 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-8M3 12h11M10 8l4 4-4 4M17 9v6',
  target:'M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14M12 2v5M12 17v5M2 12h5M17 12h5M12 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4',
  alert:'m12 3 10 18H2zM12 9v5M12 18h.01',
  cursor:'m4 3 6 17 3-7 7-3zM13 13l7 7',
  clock:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 7v6l4 2',
  info:'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18M12 11v6M12 7h.01',
  close:'m6 6 12 12M6 18 18 6',
};
document.querySelectorAll('[data-icon]').forEach((el) => {
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<svg viewBox="0 0 24 24"><path d="${paths[el.dataset.icon] || paths.info}"/></svg>`;
});

const $ = (id) => document.getElementById(id);
const baseline = Object.freeze({ width:8, length:6, height:3.5, joistSpacing:0.5, layers:1, projectName:'โครงการตัวอย่าง' });
let view = '3d';
let inspectionMode = 'assembly';
let latestLayout = null;
let dirty = false;
let scene;
let sceneWebglAvailable = false;
let controllerCapture = null;
let controllerView = null;
let controllerRequest = 0;
let controllerTimeout = 0;
const selectText = {
  joist:['ตงรองแผ่นแบบ','ไฮไลต์ชิ้นส่วนตัวอย่าง ไม่ใช่ตำแหน่งแรงวิกฤต'],
  bearer:['คานหลักรองตง','ชิ้นส่วนภาพประกอบ ไม่ใช่หน้าตัดที่ตรวจรับรองแล้ว'],
  support:['ฐานรองขานั่งร้าน','ตำแหน่งภาพประกอบ ต้องตรวจพื้นรองรับจากหลักฐานจริง'],
  frame:['ชุดเฟรมและหัวปรับ','เฟรม nominal 1.219 × 1.700 ม. · รายละเอียดข้อต่อ/ท่อ/แจ็คยัง HOLD'],
  form:['ชุดแบบหล่อพื้น','ชั้นวัสดุตัวอย่าง ไม่ใช่การตรวจความแข็งแรง'],
};
function selectMember(kind, metadata = {}) {
  let words=selectText[kind]||['เลือกชิ้นส่วนบนโมเดล','ดูตำแหน่งที่เกี่ยวข้อง โดยไม่ต้องสลับหน้า'];
  if(metadata.component==='sole-board') {
    words=['แผ่นไม้รองฐาน','ขนาดในภาพเป็นเพียงการสื่อชั้นประกอบ ต้องตรวจ bearing และสภาพพื้นจริง · HOLD'];
  } else if(metadata.component==='base-plate') {
    words=['เพลทฐานขาปรับ','ยังไม่ยืนยันขนาดเพลท กำลังรับแรง หรือระบบผู้ผลิต · HOLD'];
  } else if(metadata.component==='base-jack') {
    words=['ขาปรับฐาน (Base jack)','ระยะยืดและกำลังรับแรงต้องอ้างอิงรุ่นจริง ห้ามอ่านจากสัดส่วนภาพ · HOLD'];
  } else if(metadata.component==='u-head') {
    words=['หัวปรับ U-head','จุดรองคานในภาพศึกษา ต้องยืนยันระยะยืด หน้าสัมผัส และระบบผู้ผลิต · HOLD'];
  } else if(kind==='frame'&&metadata.component==='stack-connector') {
    const joint=Number.isInteger(metadata.joint)&&metadata.joint>0
      ? `${metadata.joint}–${metadata.joint+1}` : (metadata.layer || '—');
    words=[`ข้อต่อเฟรมระหว่างชั้น ${joint}`,
      'แสดงตำแหน่งต่อซ้อนเท่านั้น ยังไม่ยืนยัน insertion, lock หรือกำลังรอยต่อ · HOLD'];
  } else if(kind==='frame'&&metadata.component==='connector-lock') {
    words=[`ปลอกล็อกหมุดกากบาท · ชั้น ${metadata.layer || '—'}`,
      'ตำแหน่งอุปกรณ์ในภาพศึกษาเท่านั้น ต้องยืนยันรุ่น/การประกอบและกำลังจากผู้ผลิต · HOLD'];
  } else if(kind==='frame'&&metadata.component==='connector-pin') {
    words=[`หมุดยึดกากบาท · ชั้น ${metadata.layer || '—'}`,
      'ระยะยื่น 0.080 ม. เป็นค่าภาพศึกษา ไม่ใช่รายละเอียดผลิตหรือระยะติดตั้งที่อนุมัติ · HOLD'];
  } else if(kind==='frame'&&metadata.component==='crossbrace') {
    words=[`กากบาท nominal ${metadata.nominalLength.toFixed(3)} ม. · ชั้น ${metadata.layer}`,
      `Bay ${metadata.bay.toFixed(3)} ม. / ระยะหมุดแนวดิ่ง ${metadata.pinSeparation.toFixed(3)} ม. · ข้อต่อ/กำลังยัง HOLD`];
  } else if(kind==='frame'&&metadata.frameId) {
    words=[`เฟรม ${metadata.frameId} · ชั้น ${metadata.layer}`,
      `${metadata.nominalWidth.toFixed(3)} × ${metadata.nominalHeight.toFixed(3)} ม. nominal · รายละเอียดข้อต่อ/ท่อยัง HOLD`];
  }
  $('selectionTitle').textContent=words[0];
  $('selectionDetail').textContent=words[1];
}
function notice(text) {
  $('noticeText').textContent=text;
  $('inlineNotice').hidden=false;
}

function postToHost(action, detail = {}) {
  if (!controllerMode || window.parent === window) return false;
  const payload = {
    channel: BRIDGE.channel,
    version: BRIDGE.version,
    direction: BRIDGE.childDirection,
    bridgeNonce: controllerNonce,
    action,
    requestId: `overview-${Date.now()}-${controllerRequest += 1}`,
    ...detail,
  };
  window.parent.postMessage(payload, window.location.origin);
  return true;
}

function requestControllerSnapshot(reason = 'manual') {
  window.clearTimeout(controllerTimeout);
  renderControllerCapture({ phase: 'hold', reason: 'CONTROLLER_REFRESH_PENDING' });
  if (!postToHost('request-snapshot', { reason })) {
    renderControllerCapture({ phase: 'hold', reason: 'HOST_BRIDGE_UNAVAILABLE' });
    return;
  }
  controllerTimeout = window.setTimeout(() => {
    renderControllerCapture({ phase: 'hold', reason: 'CONTROLLER_RESPONSE_TIMEOUT' });
  }, 3500);
}

function projectionFromHost(raw) {
  if (!raw || raw.phase !== 'current') {
    return { capture: raw || { phase: 'hold', reason: 'CONTROLLER_CAPTURE_MISSING' }, view: projectControllerOverview(raw) };
  }
  const port = {
    marker: raw.marker,
    api: {
      version: raw.controllerVersion,
      unit: { kgfPerKN: raw.kgfPerKN },
      getState: () => raw.state,
      getResult: () => raw.result,
    },
    recovery: {
      getSupportRecord: () => raw.support,
      recoveryItems: () => raw.recovery,
    },
    status: { overviewStatus: () => raw.aggregate },
    evidence: { formulaCards: () => raw.formulaEvidence },
    unit: { mode: () => raw.displayUnit },
  };
  const capture = captureControllerProjection(port);
  return { capture, view: projectControllerOverview(capture) };
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value)
    ? value.toLocaleString('th-TH', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '—';
}

function dynamicIcon(name) {
  const icon = document.createElement('i');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg viewBox="0 0 24 24"><path d="${paths[name] || paths.info}"/></svg>`;
  return icon;
}

function renderControllerActions(view) {
  const list = $('actionList');
  list.replaceChildren();
  if (view.phase !== 'current') {
    const box = document.createElement('div');
    box.className = 'controller-empty';
    box.append(dynamicIcon(view.phase === 'stale' ? 'clock' : 'shield'));
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = view.phase === 'stale' ? 'ผลเดิมไม่ตรงกับข้อมูลปัจจุบัน' : 'ยังอ่านผลปัจจุบันไม่ได้';
    const reason = document.createElement('span');
    reason.textContent = `${view.reason || 'CONTROLLER_UNAVAILABLE'} · ซ่อนตัวเลขและคำแนะนำเดิมไว้`;
    copy.append(title, reason);
    box.append(copy);
    list.append(box);
    $('queueCount').textContent = 'HOLD';
    return;
  }

  if (view.inputDomainValid === false) {
    const details = document.createElement('details');
    details.className = 'action-item';
    details.dataset.issue = '__input_domain__';
    details.open = true;
    const summary = document.createElement('summary');
    const issueIcon = document.createElement('span');
    issueIcon.className = 'issue-icon issue-hold';
    issueIcon.append(dynamicIcon('alert'));
    const heading = document.createElement('span');
    const title = document.createElement('b');
    title.textContent = view.evidenceBoundary?.title || 'Geometry / Input domain ไม่ผ่าน';
    const metric = document.createElement('small');
    metric.textContent = 'INPUT DOMAIN · HOLD';
    heading.append(title, metric);
    summary.append(issueIcon, heading, dynamicIcon('chevron'));
    const body = document.createElement('div');
    body.className = 'action-body';
    const why = document.createElement('p');
    why.textContent = view.evidenceBoundary?.detail
      || 'แก้ขอบเขตแปลนและข้อมูลนำเข้าให้ผ่านก่อน ระบบจึงจะแสดงค่าคำนวณและคำแนะนำ';
    const button = document.createElement('button');
    button.className = 'fix-button';
    button.type = 'button';
    button.dataset.controllerTab = 'plan';
    button.append('เปิดแปลน 2D เพื่อแก้ไข', dynamicIcon('arrow'));
    body.append(why, button);
    details.append(summary, body);
    list.append(details);
    $('queueCount').textContent = 'HOLD';
    return;
  }

  const rows = [...view.recoveryItems];
  if (view.failureCount > 0) rows.unshift({
    id: '__engine__', level: 'fail', label: `Engine มี ${view.failureCount.toLocaleString('th-TH')} รายการที่ต้องตรวจ`,
    metric: 'ENGINE FAILURE · HOLD', why: 'เปิดหน้าสูตรและแทนค่าเพื่อดู demand, capacity และจุดควบคุมจากผลเดียวกัน',
    action: 'เปิดสูตรและแทนค่า',
  });
  if (!rows.length) rows.push({
    id: '__authority__', level: 'hold', label: 'ผล Engine ไม่มีรายการ Recovery ที่แสดง',
    metric: 'AUTHORITY HOLD / REVIEW', why: 'Controlled Beta และการตรวจรับโดยวิศวกรยังคงเป็นข้อจำกัด ไม่ใช่ผลอนุมัติก่อสร้าง',
  });
  rows.forEach((item, index) => {
    const details = document.createElement('details');
    details.className = 'action-item';
    details.dataset.issue = item.id;
    details.open = index === 0;
    const summary = document.createElement('summary');
    const issueIcon = document.createElement('span');
    issueIcon.className = `issue-icon issue-${item.level === 'fail' || item.level === 'fail-screen' ? 'fail' : 'hold'}`;
    issueIcon.append(dynamicIcon(item.level === 'fail' || item.level === 'fail-screen' ? 'alert' : 'file'));
    const heading = document.createElement('span');
    const title = document.createElement('b');
    title.textContent = item.label;
    const metric = document.createElement('small');
    metric.textContent = item.metric;
    heading.append(title, metric);
    summary.append(issueIcon, heading, dynamicIcon('chevron'));
    const body = document.createElement('div');
    body.className = 'action-body';
    const why = document.createElement('p');
    why.textContent = item.why;
    body.append(why);
    if (item.id === '__engine__') {
      const button = document.createElement('button');
      button.className = 'fix-button';
      button.type = 'button';
      button.dataset.controllerTab = 'calculations';
      button.append('เปิดสูตรและแทนค่า', dynamicIcon('arrow'));
      body.append(button);
    } else if (!item.id.startsWith('__')) {
      const button = document.createElement('button');
      button.className = 'fix-button';
      button.type = 'button';
      button.dataset.recoveryTarget = item.id;
      button.append(item.action || 'ไปที่จุดตรวจ', dynamicIcon('input'));
      body.append(button);
    }
    details.append(summary, body);
    details.addEventListener('toggle', () => {
      if (details.open) list.querySelectorAll('.action-item').forEach((other) => { if (other !== details) other.open = false; });
    });
    list.append(details);
  });
  $('queueCount').textContent = `${rows.length.toLocaleString('th-TH')} รายการ`;
}

function setControllerFields(view) {
  const pairs = {
    projectName: view.projectName,
    width: view.width,
    length: view.length,
    height: view.height,
    joistSpacing: view.joistSpacing,
  };
  for (const [id, value] of Object.entries(pairs)) $(id).value = String(value ?? '');
  $('slabThickness').textContent = formatNumber(view.slabThicknessCm, 0);
  $('scaffoldTypeLabel').textContent = view.scaffoldType;
  $('joistProfileLabel').textContent = view.joistProfile;
  $('bearerProfileLabel').textContent = view.bearerProfile;
  $('plywoodThicknessLabel').textContent = `${formatNumber(view.plywoodThicknessMm, 0)} มม.`;
  $('projectHeading').textContent = view.projectName;
  $('projectZone').textContent = view.zone;
  $('dimensionLabel').textContent = `${formatNumber(view.width)} × ${formatNumber(view.length)} ม. · เป้าหมาย ${formatNumber(view.height)} ม.`;
}

const EVIDENCE_TEXT_IDS = Object.freeze([
  'evidencePost', 'evidenceCoordinates', 'evidenceReaction', 'evidenceResult',
  'evidenceUtilization', 'evidenceEngineStatus', 'evidenceAuthorityStatus',
  'evidenceServiceTitle', 'evidenceServiceEquation', 'evidenceServiceSubstitution',
  'evidenceServiceResult', 'evidenceServiceNote', 'evidenceTributaryTitle',
  'evidenceTributaryEquation', 'evidenceTributarySubstitution',
  'evidenceTributaryResult', 'evidenceTributaryNote', 'evidencePostCheckTitle',
  'evidencePostCheckEquation', 'evidencePostCheckSubstitution',
  'evidencePostCheckResult', 'evidencePostCheckNote', 'evidenceCheckName',
  'evidenceCheckValue', 'evidenceCheckDescription', 'evidenceManufacturer',
  'evidenceSupport', 'evidenceRemovedPosts', 'evidenceSource',
  'evidenceStatusAnnouncement',
]);

function clearGoverningEvidence() {
  const panel = $('governingEvidence');
  panel.hidden = true;
  panel.open = false;
  panel.removeAttribute('data-engine-status');
  panel.removeAttribute('data-authority-level');
  for (const id of EVIDENCE_TEXT_IDS) $(id).textContent = id === 'evidenceStatusAnnouncement' ? '' : '—';
  $('evidenceBoundary').hidden = true;
  $('evidenceBoundaryTitle').textContent = '';
  $('evidenceBoundaryDetail').textContent = '';
}

function supportEvidenceText(assumptions) {
  if (assumptions.supportMode === 'outside') {
    return 'OUTSIDE SCOPE · NOT EVALUATED · HOLD';
  }
  if (assumptions.supportMode === 'verified' && assumptions.supportValid) {
    return `CURRENT · ${assumptions.supportReference || 'มีหลักฐาน current-session'}`;
  }
  return `HOLD · ${assumptions.supportMode || 'pending'}`;
}

function renderGoverningEvidence(view) {
  const evidence = view.governingEvidence;
  if (view.phase !== 'current' || !evidence) {
    clearGoverningEvidence();
    return;
  }
  const panel = $('governingEvidence');
  const { post, serviceLoad, tributaryLoad, postCheck, highestCheck, assumptions } = evidence;
  $('evidencePost').textContent = post.id;
  $('evidenceCoordinates').textContent = `X ${formatNumber(post.x, 3)} · Y ${formatNumber(post.y, 3)} ม.`;
  $('evidenceReaction').textContent = `P = ${formatNumber(post.areaLoad)} + ${formatNumber(post.beamLoad)} + ${formatNumber(post.zoneLoad)} + ${formatNumber(post.pointLoad)} kN`;
  const workingEquivalent = view.displayUnit === 'kgf'
    ? ` · ≈ ${formatNumber(post.totalDisplay)} ${post.totalDisplayUnit}` : '';
  $('evidenceResult').textContent = `${formatNumber(post.total)} kN${workingEquivalent}`;
  $('evidenceUtilization').textContent = `U = ${formatNumber(post.utilization, 4)} · Pallow ${formatNumber(post.capacity)} kN`;
  $('evidenceEngineStatus').textContent = `ENGINE ${evidence.engineStatus.toUpperCase()}`;
  $('evidenceAuthorityStatus').textContent = evidence.authorityText;
  $('evidenceAuthorityStatus').title = evidence.authorityText;

  for (const [prefix, card] of [
    ['Service', serviceLoad], ['Tributary', tributaryLoad], ['PostCheck', postCheck],
  ]) {
    $(`evidence${prefix}Title`).textContent = card.titleText;
    $(`evidence${prefix}Equation`).textContent = card.equationText;
    $(`evidence${prefix}Substitution`).textContent = card.substitutionText;
    $(`evidence${prefix}Result`).textContent = card.resultText;
    $(`evidence${prefix}Note`).textContent = card.noteText;
  }

  $('evidenceCheckName').textContent = highestCheck.name;
  $('evidenceCheckValue').textContent = `U = ${formatNumber(highestCheck.value, 4)}${highestCheck.recoveryMetric ? ` · ${highestCheck.recoveryMetric}` : ''}`;
  const ledgerDescription = highestCheck.description || 'ค่าจาก result.checks ปัจจุบัน';
  $('evidenceCheckDescription').textContent = assumptions.removedPostCount > 0
    ? `${ledgerDescription} · ค่านี้อยู่ใน Engine ledger เดิม; SPAN REGENERATION HOLD`
    : ledgerDescription;
  $('evidenceManufacturer').textContent = assumptions.manufacturerInputFlag
    ? 'ติ๊กยืนยัน input แล้ว · ยังต้องตรงรุ่นจริง' : 'ยังไม่ยืนยัน · HOLD';
  $('evidenceSupport').textContent = supportEvidenceText(assumptions);
  $('evidenceRemovedPosts').textContent = assumptions.removedPostCount > 0
    ? `${assumptions.removedPostCount.toLocaleString('th-TH')} จุด · SPAN HOLD` : 'ไม่มีใน state ปัจจุบัน';
  $('evidenceSource').textContent = `Controller ${evidence.source.controllerVersion || '—'} · change witness ${evidence.source.witness} · ไม่ใช่ลายเซ็น`;
  $('evidenceStatusAnnouncement').textContent = `หลักฐานจุดควบคุม ${post.id}; Engine ${evidence.engineStatus}; สถานะอำนาจ ${evidence.authorityText}`;
  panel.dataset.engineStatus = evidence.engineStatus;
  panel.dataset.authorityLevel = evidence.authorityLevel;
  panel.hidden = false;
}

function renderEvidenceBoundary(view) {
  const boundary = view.evidenceBoundary;
  if (view.phase !== 'current' || view.inputDomainValid !== false || !boundary) return;
  $('evidenceBoundaryTitle').textContent = boundary.title;
  $('evidenceBoundaryDetail').textContent = `${boundary.detail} · ${boundary.code}`;
  $('evidenceBoundary').hidden = false;
}

function syncZoomControls() {
  const unavailable = $('viewportShell').classList.contains('is-controller-noncurrent');
  const disabled = view !== '3d' || !sceneWebglAvailable || unavailable;
  $('zoomInCamera').disabled = disabled;
  $('zoomOutCamera').disabled = disabled;
}

function setControllerVisualAvailability(isCurrent) {
  const unavailable = !isCurrent;
  $('viewportShell').classList.toggle('is-controller-noncurrent', unavailable);
  $('controllerVisualHold').hidden = !unavailable;
  $('modelStage').setAttribute('aria-hidden', String(unavailable));
  $('modelStage').tabIndex = unavailable ? -1 : 0;
  document.querySelectorAll('#layers, [data-view], [data-inspection], [data-layer], #resetCamera, #zoomInCamera, #zoomOutCamera').forEach((button) => {
    button.disabled = unavailable || (button.hasAttribute('data-layer') && inspectionMode !== 'assembly');
  });
  syncZoomControls();
}

function renderUnavailableVisualBoundary(view) {
  const boundary = projectUnavailableVisualBoundary(view);
  $('layers').value = String(baseline.layers);
  scene?.setInspection('assembly');
  scene?.setLayer('all');
  scene?.setDimensions(baseline);
  inspectionMode = 'assembly';
  document.querySelectorAll('[data-inspection]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.inspection === 'assembly'));
  });
  document.querySelectorAll('[data-layer]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.layer === 'all'));
  });
  selectMember(null);
  for (const id of [
    'modelLegend', 'assemblyTitle', 'assemblyHeight', 'moduleSummary',
    'accessorySummary', 'edgeSummary', 'procurementSummary', 'modelModeStatus',
  ]) $(id).textContent = boundary[id];
  $('controllerVisualHoldTitle').textContent = boundary.overlayTitle;
  $('controllerVisualHoldDetail').textContent = boundary.overlayDetail;
  $('controllerVisualModelBtn').hidden = !controllerMode || view.reason !== 'NON_RECTANGULAR_RESULT_GEOMETRY';
  setControllerVisualAvailability(false);
}

function renderControllerCapture(raw) {
  window.clearTimeout(controllerTimeout);
  const projected = projectionFromHost(raw);
  controllerCapture = projected.capture;
  controllerView = projected.view;
  const view = controllerView;
  $('draftStatus').dataset.phase = view.phase === 'current' ? view.aggregateLevel : view.phase;
  $('draftStatus').lastElementChild.textContent = view.phase === 'current'
    ? `${view.aggregateText} · ENGINE ${view.engineStatus.toUpperCase()}`
    : `${view.phase.toUpperCase()} · ${view.reason}`;
  $('engineKpis').hidden = view.phase !== 'current' || view.inputDomainValid !== true;
  clearGoverningEvidence();
  $('inputError').hidden = true;
  if (view.phase === 'current') {
    setControllerFields(view);
    if (view.inputDomainValid !== true) {
      renderEvidenceBoundary(view);
      $('inputError').hidden = false;
      $('inputError').textContent = 'Geometry / Input domain ไม่ผ่าน จึงซ่อน Reaction, utilization และโมเดลจาก fallback; เปิดแปลน 2D เพื่อแก้ขอบเขตงานก่อน';
      renderUnavailableVisualBoundary({ phase: 'visual-hold', reason: 'ENGINE_INPUT_DOMAIN_INVALID' });
    } else {
      $('engineArea').textContent = formatNumber(view.area);
      $('enginePosts').textContent = view.postCount.toLocaleString('th-TH');
      $('engineMaxPost').textContent = formatNumber(view.maxPost);
      $('engineMaxPostUnit').textContent = view.maxPostUnit;
      $('enginePressure').textContent = formatNumber(view.pressure);
      $('enginePressureUnit').textContent = view.pressureUnit;
      $('engineWitness').textContent = view.witness;
      renderGoverningEvidence(view);
      const dimensions = {
        width: view.width, length: view.length, height: view.height,
        joistSpacing: view.joistSpacing, layers: Number($('layers').value),
      };
      const visualReason = sceneWebglAvailable ? 'VISUAL_INPUT_OUTSIDE_ENVELOPE' : 'WEBGL_UNAVAILABLE';
      if (!view.nominalRectangleAvailable) {
        renderUnavailableVisualBoundary({ phase: 'visual-hold', reason: 'NON_RECTANGULAR_RESULT_GEOMETRY' });
      } else if (!sceneWebglAvailable || scene?.setDimensions(dimensions) !== true) {
        $('inputError').hidden = false;
        $('inputError').textContent = sceneWebglAvailable
          ? 'ค่าจริงอยู่นอกช่วงภาพศึกษา 2–12 × 2–12 ม. / สูง 1.5–6 ม. จึงพักโมเดล nominal และไม่ย่อค่าจริงให้ดูเหมือนพอดี'
          : 'อุปกรณ์นี้เปิด WebGL ไม่ได้ จึงพักภาพและจำนวนประกอบ nominal โดยยังคงแสดงผล Engine ปัจจุบันแยกไว้';
        renderUnavailableVisualBoundary({ phase: 'visual-hold', reason: visualReason });
      } else {
        setControllerVisualAvailability(true);
        renderInspectionPresentation(inspectionMode);
        if (inspectionMode === 'assembly') {
          $('modelLegend').textContent = `ภาพ nominal ไม่ใช่ Result geometry · จุดค้ำใน Engine ${view.postCount.toLocaleString('th-TH')} จุดไม่ใช้กำหนดจำนวนชิ้นในภาพ`;
        }
      }
    }
  } else {
    for (const id of ['projectName', 'width', 'length', 'height', 'joistSpacing']) $(id).value = '';
    $('slabThickness').textContent = '—';
    $('projectHeading').textContent = 'ข้อมูล Controller ยังไม่ current';
    $('projectZone').textContent = 'ซ่อนข้อมูลพื้นที่เดิม';
    $('dimensionLabel').textContent = 'ซ่อนมิติเดิมจนกว่าจะอ่านผล current ได้';
    $('scaffoldTypeLabel').textContent = 'รอข้อมูล Controller';
    $('joistProfileLabel').textContent = '—';
    $('bearerProfileLabel').textContent = '—';
    $('plywoodThicknessLabel').textContent = '—';
    renderUnavailableVisualBoundary(view);
  }
  renderControllerActions(view);
}

function initializeControllerMode() {
  document.body.dataset.controllerMode = 'stage1';
  $('prototypeBannerText').innerHTML = '<b>LOCAL STAGE 1</b> อ่านผลจาก Controller เดิม · REVIEW ONLY · NOT FOR CONSTRUCTION';
  $('resetLabel').textContent = 'อ่านผลใหม่';
  $('existingLink').hidden = true;
  $('closeEmbed').hidden = false;
  $('projectFieldHelp').textContent = 'อ่านอย่างเดียวจาก Workbench เดิม แก้ไขในหน้าหลัก';
  $('dimensionFieldHelp').textContent = 'ค่าจริงอ่านจาก Controller; โมเดลกลางเป็นภาพศึกษา nominal แยกจาก Result geometry';
  $('advancedFieldHelp').textContent = 'อ่านจาก input ปัจจุบัน ไม่ใช่หลักฐานผู้ผลิตหรือการรับรองกำลัง';
  $('calculateLabel').textContent = 'กลับหน้าหลักเพื่อกดคำนวณ';
  $('calculateHelp').textContent = 'การแก้ค่าและ Run ใช้ปุ่มเดิมใน Workbench เท่านั้น';
  $('actionSubtitle').textContent = 'Recovery ปัจจุบันจากระบบเดิม';
  $('queueLabel').textContent = 'รายการที่ current';
  $('footerState').textContent = 'Projection จาก Controller เดิม';
  $('footerBoundary').textContent = 'ไม่มี Engine ซ้ำ · ไม่มีการบันทึกหรือคำนวณในหน้านี้';
  for (const id of ['projectName', 'width', 'length', 'height', 'joistSpacing']) {
    const input = $(id);
    input.readOnly = true;
    input.required = false;
    input.removeAttribute('min');
    input.removeAttribute('max');
    input.setAttribute('aria-readonly', 'true');
  }
  postToHost('ready');
  requestControllerSnapshot('overview-mounted');
}

window.addEventListener('message', (event) => {
  if (!controllerMode || event.source !== window.parent || event.origin !== window.location.origin) return;
  const message = event.data;
  if (!message || message.channel !== BRIDGE.channel || message.version !== BRIDGE.version
    || message.direction !== BRIDGE.hostDirection || message.bridgeNonce !== controllerNonce) return;
  if (message.type === 'host-ready') requestControllerSnapshot('host-ready');
  if (message.type === 'snapshot') {
    renderControllerCapture(message.detail?.capture);
    postToHost('snapshot-applied', { snapshotId: message.detail?.snapshotId });
  }
});
function showAssembly(layout) {
  latestLayout = layout;
  const gap = layout.residualGap;
  const sign = gap >= 0 ? '+' : '−';
  $('assemblyTitle').textContent = Math.abs(gap) < 0.0005
    ? 'HOLD · ระดับ nominal ตรงกัน แต่ยังไม่รับรองการประกอบ'
    : gap > 0 ? `HOLD · ชุดตัวอย่างยังต่ำกว่าเป้าหมาย ${gap.toFixed(2)} ม.`
      : `HOLD · ชุดตัวอย่างสูงเกินเป้าหมาย ${Math.abs(gap).toFixed(2)} ม.`;
  $('assemblyHeight').textContent = `ระดับพื้นเป้าหมาย ${layout.requestedSlabTop.toFixed(2)} ม. / ชุดภาพประมาณ ${layout.nominalSlabTop.toFixed(2)} ม. · Δ ${sign}${Math.abs(gap).toFixed(2)} ม. ไม่ใช่ระยะปรับแจ็ค`;
  if(inspectionMode==='bay') {
    const bayCounts=createBayInspection(layout).displayCounts;
    $('moduleSummary').textContent=`โมเดล 1 ช่วง: ${bayCounts.endFrames} เฟรม · ${bayCounts.bottomSupports} แนวขา · ${bayCounts.endFrames*2} ท่อนขาตามชั้น`;
    $('accessorySummary').textContent=`กากบาท ${bayCounts.braceAssemblies} ชุด / ${bayCounts.diagonalTubes} ท่อ · หมุดกากบาทในภาพ ${bayCounts.connectorPins} + ปลอกล็อก ${bayCounts.schematicLocks} จุด · ไม้รองฐาน ${bayCounts.bottomSupports} + เพลทฐาน ${bayCounts.bottomSupports} + ขาปรับฐาน ${bayCounts.bottomSupports} + U-head ${bayCounts.topHeads} จุด · ข้อต่อชั้น ${bayCounts.stackConnectors}`;
    $('edgeSummary').textContent='ยังไม่แสดง horizontal frame/cover, bracing แนวนอน และ ties ที่ยืนยันระบบเดียวกัน · HOLD';
  } else if(inspectionMode==='frame') {
    $('moduleSummary').textContent='โมเดลประกอบ: 1 เฟรม · 2 ขาหลัก';
    $('accessorySummary').textContent='ตำแหน่งหมุดกากบาท 4 + ปลอกล็อก 4 จุด · ยังไม่ใช่นั่งร้านครบชุด';
    $('edgeSummary').textContent='รูปทรงเดียวกับโมเดลทั้งผัง · รายละเอียดผลิตและกำลังยัง HOLD';
  } else {
    const braceCount=layout.counts.lanes*layout.counts.bays*layout.layers*2;
    const stackConnectorCount=layout.frames.filter((frame)=>frame.layer>0).length*2;
    $('moduleSummary').textContent=`โมเดลประกอบ: ${layout.layers} ชั้น × 1.700 ม. · ${layout.counts.lanes} แนว × ${layout.counts.bays} Bay · ${layout.counts.frames} เฟรม`;
    $('accessorySummary').textContent=`กากบาทในภาพ ${braceCount} ชุด · หมุดกากบาท ${layout.counts.frames*4} + ปลอกล็อก ${layout.counts.frames*4} จุด · ไม้รองฐาน ${layout.footPositions.length} + เพลทฐาน ${layout.footPositions.length} + ขาปรับฐาน ${layout.footPositions.length} + U-head ${layout.footPositions.length} จุด · ข้อต่อชั้น ${stackConnectorCount}`;
    $('edgeSummary').textContent=`ขอบว่างถึงแกนขาต่อด้าน X ${layout.edgeGapX.toFixed(3)} / Y ${layout.edgeGapY.toFixed(3)} ม. · ไม่ใช่ระยะยื่นที่อนุมัติ`;
  }
  $('procurementSummary').textContent='จัดซื้อ / BOQ: ยังไม่คำนวณ · ไม่ใช่จำนวนชุดขายจากผู้ผลิต';
}
function setView(next) {
  if(!['2d','3d'].includes(next))return false;
  if(next===view)return true;
  if(next==='2d'&&inspectionMode!=='assembly'&&!setInspectionMode('assembly'))return false;
  view=next;
  scene?.setView(next);
  selectMember(null);
  document.querySelectorAll('[data-view]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.view===next)));
  $('visualTitle').textContent=next==='3d'?'โมเดลพื้นที่ทำงาน':'แปลนพื้นที่ทำงาน';
  $('viewHint').textContent=next==='3d'?'ลากเพื่อหมุน · ล้อ/บีบ หรือ +/− เพื่อซูม':'มุมมองบน · ภาพประกอบ NTS';
  $('modelLegend').textContent=next==='3d'?'เส้นสีเหลือง = ระดับพื้นเป้าหมาย · ไม่ใช่แบบก่อสร้าง':'มุมมองบนของโมดูล · ซ่อนเส้นระดับเป้าหมาย · ไม่ใช่แบบก่อสร้าง';
  document.querySelector('.orientation').hidden=next==='3d';
  syncZoomControls();
  return true;
}
function renderInspectionPresentation(next=inspectionMode) {
  if(next==='bay') {
    $('visualTitle').textContent='ตรวจชุด 1 ช่วง · HOLD';
    $('modelLegend').textContent='รายการที่แสดง: เฟรมหัวท้าย · 4 แนวขา · กากบาทสองด้าน · ฐาน 4 + หัวปรับ 4 จุด';
    $('viewHint').textContent='ลากเพื่อหมุน · ล้อ/บีบ หรือ +/− เพื่อซูม · เลือกดูอุปกรณ์';
    $('modelStage').setAttribute('aria-label','ภาพประกอบชุดนั่งร้านหนึ่งช่วง มีสี่แนวขาและอุปกรณ์บางส่วน ใช้ล้อเมาส์ บีบนิ้ว หรือปุ่มบวกและลบเพื่อซูม กด 2 หรือ 3 เพื่อเปลี่ยนมุมมอง และ Home เพื่อคืนมุมมอง เป็นภาพประมาณและยัง HOLD');
    $('modelModeStatus').textContent='กำลังแสดงชุดหนึ่งช่วง สี่แนวขาและอุปกรณ์บางส่วน สถานะ HOLD';
  } else if(next==='frame') {
    $('visualTitle').textContent='ตรวจเฟรม 1 ตัว';
    $('modelLegend').textContent='เฟรม 1 ตัวมี 2 ขา · ยังไม่ใช่นั่งร้านครบชุด · ภาพประมาณ / HOLD';
    $('viewHint').textContent='ลากเพื่อหมุน · ล้อ/บีบ หรือ +/− เพื่อซูม · เลือกดูชิ้นส่วน';
    $('modelStage').setAttribute('aria-label','ภาพประกอบเฟรมนั่งร้านหนึ่งตัว มีสองขา ใช้ล้อเมาส์ บีบนิ้ว หรือปุ่มบวกและลบเพื่อซูม กด 2 หรือ 3 เพื่อเปลี่ยนมุมมอง และ Home เพื่อคืนมุมมอง ยังไม่ใช่นั่งร้านครบชุด');
    $('modelModeStatus').textContent='กำลังแสดงเฟรมนั่งร้านหนึ่งตัว มีสองขา';
  } else {
    $('visualTitle').textContent=view==='3d'?'โมเดลพื้นที่ทำงาน':'แปลนพื้นที่ทำงาน';
    $('modelLegend').textContent=view==='3d'?'เส้นสีเหลือง = ระดับพื้นเป้าหมาย · ไม่ใช่แบบก่อสร้าง':'มุมมองบนของโมดูล · ซ่อนเส้นระดับเป้าหมาย · ไม่ใช่แบบก่อสร้าง';
    $('viewHint').textContent=view==='3d'?'ลากเพื่อหมุน · ล้อ/บีบ หรือ +/− เพื่อซูม':'มุมมองบน · ภาพประกอบ NTS';
    $('modelStage').setAttribute('aria-label','ภาพประกอบผังนั่งร้านตัวอย่างทั้งพื้นที่ ใช้ล้อเมาส์ บีบนิ้ว หรือปุ่มบวกและลบเพื่อซูม กด 2 หรือ 3 เพื่อเปลี่ยนมุมมอง และ Home เพื่อคืนมุมมอง ไม่ใช่แบบจัดวางที่ตรวจแล้ว');
    $('modelModeStatus').textContent='กำลังแสดงผังนั่งร้านตัวอย่างทั้งพื้นที่';
  }
  selectMember(null);
}
function setInspectionMode(next) {
  if(!['assembly','bay','frame'].includes(next))return false;
  const previousView=view;
  if(next!=='assembly'&&view!=='3d'&&!setView('3d'))return false;
  if(scene?.setInspection(next)!==true){if(view!==previousView)setView(previousView);return false;}
  inspectionMode=next;
  if(latestLayout)showAssembly(latestLayout);
  document.querySelectorAll('button[data-inspection]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.inspection===next)));
  document.querySelectorAll('[data-layer]').forEach((button)=>{button.disabled=next!=='assembly';});
  renderInspectionPresentation(next);
  return true;
}
document.querySelectorAll('button[data-inspection]').forEach((button)=>button.addEventListener('click',()=>setInspectionMode(button.dataset.inspection)));
const tabCopy={
  formulas:['สูตรและแทนค่า','รายการคำนวณยังอยู่ในแท็บเดิม แยกจากคำแนะนำสั้น ๆ ใน Overview เพื่อให้ตรวจหลักฐานได้ครบโดยไม่บังพื้นที่ทำงาน'],
  profiles:['เหล็กในท้องตลาด','เลือกหน้าตัดและอ่านรายละเอียดในระบบเดิม ส่วน Overview แสดงเฉพาะหน้าตัดที่เลือก ไม่เพิ่มฟอร์มเลือกซ้ำ'],
  boq:['วัสดุที่ต้องสั่งซื้อ','รายการวัสดุและ BOQ ยังมีพื้นที่ของตัวเอง ไม่วางตารางยาวต่อท้าย Overview และไม่ปะปนกับรายการคำนวณ'],
  reports:['รายงาน / แบบ','เก็บการตรวจความพร้อม รายการคำนวณ แบบ และ BOQ ไว้ในขั้นตอนเอกสารเดิม Mockup นี้ไม่สร้างหรือดาวน์โหลดเอกสาร'],
  reference:['เกณฑ์อ้างอิง','รายละเอียดมาตรฐานและขอบเขตตรวจยังเข้าถึงได้จากแท็บเดิม ไม่ซ่อนข้อจำกัดเพื่อทำให้หน้าจอดูผ่าน'],
  qa:['QA / Self-Test','หน้าทดสอบระบบเดิมยังอยู่ครบ สำหรับ Mockup นี้ลองหมุนโมเดล สลับชั้น กดไปยังช่องแก้ไข และตรวจว่าคำแนะนำถูกซ่อนเมื่อข้อมูลเปลี่ยนได้'],
};
function activateTab(name) {
  if (controllerMode && name !== 'overview') {
    const tab = PARENT_TABS[name];
    if (tab) postToHost('navigate-tab', { tab });
    return;
  }
  const tab=$(`tab-${name}`);
  if(!tab)return;
  document.querySelectorAll('[data-tab]').forEach((button)=>{
    const active=button===tab;
    button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
  });
  $('workarea').setAttribute('aria-labelledby',tab.id);
  const content=tabCopy[name];
  $('auxiliaryPanel').hidden=!content;
  $('viewportShell').inert=!!content;
  document.querySelector('.visual-heading').inert=!!content;
  if(content){$('auxiliaryTitle').textContent=content[0];$('auxiliaryDescription').textContent=content[1];}
  if(name==='plan')setView('2d');
  if(name==='model'){
    if(inspectionMode!=='assembly')setInspectionMode('assembly');
    setView('3d');
  }
}
document.querySelectorAll('[data-tab]').forEach((button)=>button.addEventListener('click',()=>activateTab(button.dataset.tab)));
document.querySelector('.main-tabs').addEventListener('keydown',(event)=>{
  const tabs=[...document.querySelectorAll('[data-tab]')];const current=tabs.indexOf(document.activeElement);
  if(current<0)return;let index=current;
  if(event.key==='ArrowRight')index=(current+1)%tabs.length;
  else if(event.key==='ArrowLeft')index=(current+tabs.length-1)%tabs.length;
  else if(event.key==='Home')index=0;else if(event.key==='End')index=tabs.length-1;else return;
  event.preventDefault();activateTab(tabs[index].dataset.tab);tabs[index].focus();
});
document.querySelectorAll('[data-open-tab]').forEach((button)=>button.addEventListener('click',()=>{activateTab(button.dataset.openTab);$('auxiliaryPanel').focus();}));
$('backOverview').addEventListener('click',()=>{activateTab('overview');$('tab-overview').focus();});
document.querySelectorAll('[data-view]').forEach((button)=>button.addEventListener('click',()=>setView(button.dataset.view)));
document.querySelectorAll('[data-layer]').forEach((button)=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-layer]').forEach((entry)=>entry.setAttribute('aria-pressed',String(entry===button)));
  scene?.setLayer(button.dataset.layer);selectMember(null);
}));
$('resetCamera').addEventListener('click',()=>{scene?.resetCamera();selectMember(null);});
$('zoomInCamera').addEventListener('click',()=>scene?.zoomByStep('in'));
$('zoomOutCamera').addEventListener('click',()=>scene?.zoomByStep('out'));
document.querySelectorAll('.action-item').forEach((item)=>item.addEventListener('toggle',()=>{
  if(item.open)document.querySelectorAll('.action-item').forEach((other)=>{if(other!==item)other.open=false;});
}));
function focusModel(kind) {
  if(inspectionMode!=='assembly')setInspectionMode('assembly');
  activateTab('overview');scene?.setLayer('all');scene?.focus(kind);selectMember(kind);
  document.querySelectorAll('[data-layer]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.layer==='all')));
}
$('focusSpacing').addEventListener('click',()=>{
  if(dirty)return;
  focusModel('joist');
  const field=$('joistSpacing');
  field.closest('.field').classList.add('attention');
  field.scrollIntoView({block:'nearest',behavior:'instant'});field.focus({preventScroll:true});field.select();
});
document.querySelectorAll('[data-focus-model]').forEach((button)=>button.addEventListener('click',()=>focusModel(button.dataset.focusModel)));
function readDraft() {
  const draft={};let valid=true;
  for(const key of ['width','length','height','joistSpacing','layers']){
    const input=$(key);const n=Number(input.value);
    const okay=input.value.trim()!==''&&Number.isFinite(n)&&input.validity.valid&&(key!=='layers'||(Number.isInteger(n)&&n>=1&&n<=3));
    input.setAttribute('aria-invalid',String(!okay));valid=valid&&okay;draft[key]=n;
  }
  return {draft,valid};
}
function updateDraft() {
  dirty=true;
  $('sampleAdvice').hidden=true;$('staleAdvice').hidden=false;
  $('draftStatus').dataset.dirty='true';
  $('draftStatus').lastElementChild.textContent='ข้อมูลเปลี่ยน · ยังไม่คำนวณ';
  $('joistSpacing').closest('.field').classList.remove('attention');
  $('projectHeading').textContent=$('projectName').value.trim()||'ยังไม่ได้ตั้งชื่อ';
  const {draft,valid}=readDraft();
  $('inputError').hidden=valid;
  $('inputError').textContent=valid?'':'กรอกขนาดในช่วงที่กำหนดก่อน ภาพยังคงค่าที่ใช้ได้ล่าสุด';
  if(!valid)return;
  $('dimensionLabel').textContent=`${draft.width.toFixed(2)} × ${draft.length.toFixed(2)} ม. · เป้าหมาย ${draft.height.toFixed(2)} ม.`;
  scene?.setDimensions(draft);
  selectMember(null);
}
$('sampleForm').addEventListener('input',(event)=>{
  if (!controllerMode) {
    updateDraft();
    return;
  }
  if (event.target === $('layers') && controllerView?.phase === 'current' && controllerView.nominalRectangleAvailable && sceneWebglAvailable
    && !$('viewportShell').classList.contains('is-controller-noncurrent')) {
    const dimensions = {
      width: controllerView.width, length: controllerView.length, height: controllerView.height,
      joistSpacing: controllerView.joistSpacing, layers: Number($('layers').value),
    };
    scene?.setDimensions(dimensions);
    selectMember(null);
  }
});
$('sampleForm').addEventListener('submit',(event)=>event.preventDefault());
$('calculateBtn').addEventListener('click',()=>{
  if (controllerMode) {
    postToHost('navigate-tab', { tab: 'dashboard' });
    return;
  }
  const {valid}=readDraft();
  if(!valid){$('sampleForm').reportValidity();notice('ขนาดตัวอย่างยังไม่ครบ ไม่สร้างผลคำนวณ');return;}
  notice('นี่คือตำแหน่งปุ่มตรวจแบบในแนวคิดใหม่ Mockup นี้ยังไม่รัน Engine หรือสร้างผลผ่าน/ไม่ผ่าน ให้ใช้รุ่นปัจจุบันเมื่อต้องการคำนวณจริง');
});
$('resetSample').addEventListener('click',()=>{
  if (controllerMode) {
    requestControllerSnapshot('manual-refresh');
    scene?.resetCamera();
    selectMember(null);
    return;
  }
  if(inspectionMode!=='assembly')setInspectionMode('assembly');
  for(const [key,value]of Object.entries(baseline))$(key).value=String(value);
  dirty=false;$('sampleAdvice').hidden=false;$('staleAdvice').hidden=true;$('inputError').hidden=true;
  $('draftStatus').dataset.dirty='false';$('draftStatus').lastElementChild.textContent='ตัวอย่างหน้าจอ ยังไม่รัน Engine';
  $('projectHeading').textContent=baseline.projectName;$('dimensionLabel').textContent='8.00 × 6.00 ม. · เป้าหมาย 3.50 ม.';
  document.querySelectorAll('#sampleForm [aria-invalid]').forEach((input)=>input.setAttribute('aria-invalid','false'));
  $('joistSpacing').closest('.field').classList.remove('attention');
  document.querySelector('[data-issue=joist]').open=true;
  scene?.setDimensions(baseline);scene?.setLayer('all');scene?.resetCamera();setView('3d');selectMember(null);activateTab('overview');
  document.querySelectorAll('[data-layer]').forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.layer==='all')));
  $('inlineNotice').hidden=true;
});
$('closeEmbed').addEventListener('click',()=>postToHost('close'));
$('actionList').addEventListener('click',(event)=>{
  if (!controllerMode) return;
  const recoveryButton = event.target.closest('[data-recovery-target]');
  if (recoveryButton) postToHost('focus-recovery', { checkId: recoveryButton.dataset.recoveryTarget });
  const tabButton = event.target.closest('[data-controller-tab]');
  if (tabButton) postToHost('navigate-tab', { tab: tabButton.dataset.controllerTab });
});
$('governingEvidence').addEventListener('click',(event)=>{
  if (!controllerMode) return;
  const tabButton = event.target.closest('[data-controller-tab]');
  if (tabButton) postToHost('navigate-tab', { tab: tabButton.dataset.controllerTab });
});
$('evidenceBoundary').addEventListener('click',(event)=>{
  if (!controllerMode) return;
  const tabButton = event.target.closest('[data-controller-tab]');
  if (tabButton) postToHost('navigate-tab', { tab: tabButton.dataset.controllerTab });
});
$('closeNotice').addEventListener('click',()=>$('inlineNotice').hidden=true);
$('controllerVisualModelBtn').addEventListener('click',()=>{
  if (controllerMode && controllerView?.phase === 'current' && controllerView.inputDomainValid === true) {
    postToHost('navigate-tab', { tab: 'model3d' });
  }
});
document.addEventListener('keydown',(event)=>{if(event.key==='Escape'){$('inlineNotice').hidden=true;if(controllerMode){postToHost('close');return;}if(!$('auxiliaryPanel').hidden){activateTab('overview');$('tab-overview').focus();}}});
function handleModelStageKeydown(event){
  if(event.ctrlKey||event.metaKey)return;
  if(event.key==='Home'){event.preventDefault();scene?.resetCamera();selectMember(null);}
  if(event.key==='2'){event.preventDefault();setView('2d');}
  if(event.key==='3'){event.preventDefault();setView('3d');}
  if(['+','=','Add'].includes(event.key)||event.code==='NumpadAdd'){if(scene?.zoomByStep('in'))event.preventDefault();}
  if(['-','_','Subtract'].includes(event.key)||event.code==='NumpadSubtract'){if(scene?.zoomByStep('out'))event.preventDefault();}
  if(event.key==='Escape'&&inspectionMode!=='assembly'){event.preventDefault();setInspectionMode('assembly');}
}
$('modelStage').addEventListener('keydown',handleModelStageKeydown);
try {
  scene=createScaffoldScene($('modelStage'),{onSelect:selectMember,onLayout:showAssembly,onReady:({webgl})=>{
    sceneWebglAvailable = webgl === true;
    syncZoomControls();
    $('modelStage').querySelector('.scene-loading')?.remove();
    if(!webgl){
      document.querySelectorAll('button[data-inspection]').forEach((button)=>{button.disabled=button.dataset.inspection!=='assembly';});
      $('modelModeStatus').textContent='อุปกรณ์นี้ไม่รองรับมุมตรวจสามมิติ';
    }
  }});
  scene.setDimensions(baseline);setView(view);
  if (controllerMode) initializeControllerMode();
} catch(error) {
  $('modelStage').textContent='อุปกรณ์นี้แสดง WebGL ไม่ได้ ยังทดลองฟอร์มและรายการแนะนำได้';
  console.warn('Illustrative model unavailable:',error);
  if (controllerMode) initializeControllerMode();
}
window.addEventListener('pagehide',()=>scene?.dispose(),{once:true});
