// P4 orchestrator. All mutations go through the existing account/project bridge.
import { userStatusText } from './new-building-v2-user-status.mjs';
import { getNewBuildingV2SdmSwitchMessage, NEW_BUILDING_V2_SDM_ONLY_PARTS } from './new-building-v2-method-policy.mjs';
export function newBuildingV2P4AutoProblems(brain) {
  const problems = [];
  const reasonText = (row, fallback) => ['COLUMN_CARD_REQUIRES_SDM', 'SPREAD_FOOTING_SDM_REQUIRED'].includes(row?.code)
    ? getNewBuildingV2SdmSwitchMessage(brain?.codeStandard)
    : userStatusText(row?.detail || row?.message || row?.code || fallback);
  if ([...(brain?.design?.holds || []), ...(brain?.footings?.holds || [])].some(row => ['COLUMN_CARD_REQUIRES_SDM', 'SPREAD_FOOTING_SDM_REQUIRED'].includes(row.code))) {
    problems.push(`${getNewBuildingV2SdmSwitchMessage(brain?.codeStandard)} · ${NEW_BUILDING_V2_SDM_ONLY_PARTS}`);
  }
  if (!brain?.current) problems.push(brain?.gate?.message || 'ผลวิเคราะห์ยังไม่พร้อม · กลับ P3 ตรวจแปลนและโหลด');
  for (const [key, label, where] of [['design', 'คาน/เสา', 'P4 คาน/เสา'], ['slabs', 'พื้น', 'P4 พื้น'], ['footings', 'ฐานราก', 'P4 ข้อมูลฐานราก']]) {
    const set = brain?.[key];
    if (!set) { problems.push(`${label} · ยังไม่มีผลตรวจชุดปัจจุบัน · แก้ที่ ${where}`); continue; }
    if (set?.ok === false) problems.push(`${label} · ${reasonText(set, `ข้อมูล${label}หรือผลออกแบบยังไม่ครบ`)} · แก้ที่ ${where}`);
    for (const row of set?.holds || []) problems.push(`${row.mark || row.memberId || row.node || label} · ${reasonText(row, `ตรวจข้อมูล${label}`)} · แก้ที่ ${where}`);
    for (const row of set?.members || []) {
      const status = String(row.verdict || row.status).toLowerCase();
      if (status === 'fail') problems.push(row.verdictDetail?.anchorage || row.verdictDetail?.jointTieZone
        ? userStatusText(row.verdictDetail.detail)
        : `${row.mark || row.memberId || row.node || label} · ขนาดหรือเหล็กยังรับแรงไม่พอ · แก้ที่ ${where}`);
      else if (['hold', 'blocked', 'missing', 'stale', 'pending'].includes(status) || (key !== 'design' && status !== 'pass')) problems.push(`${row.mark || row.memberId || row.node || label} · ${reasonText(row, `ข้อมูล${label}หรือผลตรวจยังไม่ครบ`)} · แก้ที่ ${where}`);
    }
  }
  if (brain?.design && !brain.design.designCurrent && !problems.length) problems.push('ผลคาน/เสายังไม่ครบ · ตรวจรายการที่ P4 คาน/เสา');
  return [...new Set(problems)];
}

export function newBuildingV2P4AutoSelections(brain) {
  const selections = [], columns = new Map();
  for (const row of brain?.sectionCandidates?.proposals || []) {
    if (!['beam', 'column'].includes(row.kind) || !(Number(row.to?.widthM) > 0 && Number(row.to?.depthM) > 0)) continue;
    if (row.kind === 'beam') selections.push({ cardId: row.kind, drawingSetId: row.groupId, memberIds: row.memberIds,
      candidate: { section: `${row.to.widthM} × ${row.to.depthM} ม.` } });
    else for (const memberId of row.memberIds || []) {
      // One authored continuous column may have several native floor segments.
      // Mutate its actual P1 ID, retaining the governing screened section.
      const id = brain.columnSectionMemberIds?.[memberId] || memberId;
      const prior = columns.get(id);
      columns.set(id, { widthM: Math.max(Number(row.to.widthM), prior?.widthM || 0),
        depthM: Math.max(Number(row.to.depthM), prior?.depthM || 0), groupId: row.groupId });
    }
  }
  for (const [id, section] of columns) selections.push({ cardId: 'column', drawingSetId: section.groupId, memberIds: [id],
    candidate: { section: `${section.widthM} × ${section.depthM} ม.` } });
  return selections.concat(brain?.slabAutoSelections || []);
}

function anchorageProblems(brain) {
  return (brain?.design?.members || []).filter(row => row.verdict === 'fail'
    && (row.verdictDetail?.anchorage || row.verdictDetail?.jointTieZone
      || /^(BEAM_HOOK|BEAM_JOINT_TIES)/.test(row.verdictDetail?.code || '')))
    .map(row => userStatusText(row.verdictDetail.detail || row.verdictDetail.code));
}

export async function runNewBuildingV2P4Auto({ read, commitSections, runAnalysis, applySoilDefaults,
  onProgress = () => {}, isCancelled = () => false }) {
  const seen = new Set();
  const cancelled = iteration => ({ ok: false, cancelled: true, problems: ['ยกเลิกการออกแบบอัตโนมัติแล้ว'], iterations: iteration + 1 });
  for (let iteration = 0; iteration < 8; iteration += 1) {
    const progress = stage => onProgress(`รอบที่ ${iteration + 1}/8 · ${stage}`);
    if (isCancelled()) return cancelled(iteration);
    let brain = await read();
    if (isCancelled()) return cancelled(iteration);
    if (!brain?.current) {
      if (brain?.initialAutoSelections?.length) await commitSections(brain.initialAutoSelections);
      if (isCancelled()) return cancelled(iteration);
      progress('กำลังวิเคราะห์คานและเสา');
      if (!await runAnalysis()) return { ok: false, problems: newBuildingV2P4AutoProblems(await read()), iterations: iteration + 1 };
      if (isCancelled()) return cancelled(iteration);
      brain = await read();
    }
    const methodIssues = [...new Set([...(brain?.design?.holds || []), ...(brain?.footings?.holds || [])].map(row => row.code)
      .filter(code => ['COLUMN_CARD_REQUIRES_SDM', 'SPREAD_FOOTING_SDM_REQUIRED', 'SERVICE_BASIS_UNPROVABLE'].includes(code)))];
    if (methodIssues.length) return { ok: false, requiresSdmSwitch: methodIssues.some(code => code !== 'SERVICE_BASIS_UNPROVABLE'),
      problems: methodIssues.some(code => code !== 'SERVICE_BASIS_UNPROVABLE')
        ? [`${getNewBuildingV2SdmSwitchMessage(brain?.codeStandard)} · ${NEW_BUILDING_V2_SDM_ONLY_PARTS}`]
        : methodIssues.map(code => userStatusText(code)), iterations: iteration + 1 };
    const jointProblems = anchorageProblems(brain);
    if (jointProblems.length) return { ok: false, problems: jointProblems, iterations: iteration + 1 };
    if (brain?.soilDefaults?.foundationSelectionRequired === true) {
      return { ok: false, requiresFoundationType: true, iterations: iteration + 1,
        problems: ['โครงการมีชนิดฐานรากต่างกัน · เลือกเป็นรายต้นที่ P4 ฐานราก'] };
    }
    if (brain?.soilDefaults?.autoSoilAllowed === true && brain.soilDefaults.foundationDeclarationRequired !== true
      && !brain.soilDefaults.spreadFootingNodeIds?.length && !brain.soilDefaults.candidateSpreadFootingNodeIds?.length
      && !brain?.footings?.soilBearingBasisRecord && !brain?.footings?.pileBasisRecord) {
      return { ok: false, requiresFoundationType: true, iterations: iteration + 1,
        problems: ['ยังไม่ได้ระบุชนิดฐานราก · เลือกฐานรากแผ่ใน P0/P1 ก่อนยืนยันข้อมูลดิน'] };
    }
    if (brain?.soilDefaults?.autoSoilAllowed === true && !brain?.footings?.pileBasisRecord
      && (brain.soilDefaults.foundationDeclarationRequired === true
        || brain.autoSoilReattestationRequired === true
        || brain?.footings?.holds?.some(row => /^SOIL_BEARING_BASIS_(NOT_VERIFIED|FOUNDING_STALE)/.test(row.code || ''))
        || ((brain?.soilDefaults?.spreadFootingNodeIds?.length || brain?.soilDefaults?.candidateSpreadFootingNodeIds?.length)
          && !brain?.footings?.soilBearingBasisRecord))) {
      if (isCancelled()) return cancelled(iteration);
      progress('กำลังออกแบบฐานรากด้วยค่าดินที่ยืนยัน');
      const soil = await applySoilDefaults();
      if (soil?.ok === false) return { ok: false, requiresOwnerConfirmation: soil.requiresOwnerConfirmation === true,
        problems: soil.issues || ['ข้อมูลดินยังไม่ครบ · แก้ที่ P4 ฐานราก'], iterations: iteration + 1 };
      if (isCancelled()) return cancelled(iteration);
      brain = await read();
    }
    const selections = newBuildingV2P4AutoSelections(brain);
    if (!selections.length) {
      const problems = newBuildingV2P4AutoProblems(brain);
      return { ok: brain?.current === true && brain?.design?.designCurrent === true && problems.length === 0, problems, iterations: iteration + 1 };
    }
    const signature = JSON.stringify(selections);
    if (seen.has(signature)) return { ok: false, problems: [...newBuildingV2P4AutoProblems(brain), 'ไม่มีหน้าตัดที่ใหญ่ขึ้นแล้ว · ตรวจรายการที่ P4'], iterations: iteration + 1 };
    seen.add(signature);
    if (isCancelled()) return cancelled(iteration);
    progress('กำลังเลือกหน้าตัดและจัดกลุ่มคาน');
    await commitSections(selections);
    if (isCancelled()) return cancelled(iteration);
    if (!await runAnalysis()) return { ok: false, problems: newBuildingV2P4AutoProblems(await read()), iterations: iteration + 1 };
    if (isCancelled()) return cancelled(iteration);
  }
  return { ok: false, problems: ['ออกแบบยังไม่ลงตัว · ตรวจหน้าตัดและข้อมูลที่ P4'], iterations: 8 };
}
