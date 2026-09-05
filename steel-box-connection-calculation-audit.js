/* SC01 R18: retained-engine what-if and complete check inventory.
 * No formula, load, evidence, design profile or approval is replaced here. */
(function (root) {
  'use strict';
  const finite = Number.isFinite;
  const copy = x => JSON.parse(JSON.stringify(x));
  const C = root.NCYSC01AssistantCore;
  const states = {fail:'ไม่เข้าเกณฑ์', outside:'นอกขอบเขต', incomplete:'ข้อมูล / ขอบเขตยังไม่ครบ',
    review:'รอตรวจวิธี', warn:'ใกล้เกณฑ์', hold:'รอหลักฐาน / วิธีตรวจ', ok:'อยู่ในเกณฑ์ตัวเลข', na:'ไม่ใช้กับระบบนี้'};
  function status(c) {
    if (c?.key === 'weld' && c.sizeEligible === false) return 'ขนาดรอยเชื่อมไม่เข้าเกณฑ์';
    return states[c?.state] || c?.state || 'ยังไม่มีผล';
  }
  function coverage(result) {
    const groups = {failed:[], pending:[], calculated:[], notApplicable:[]};
    for (const [key, value] of Object.entries(result?.checks || {})) {
      const c = {...copy(value), key};
      const group = c.state === 'na' ? 'notApplicable' : ['fail','outside'].includes(c.state) ? 'failed' :
        ['incomplete','hold'].includes(c.state) ? 'pending' : 'calculated';
      groups[group].push(c);
    }
    return groups;
  }
  function weldTrial(state, before) {
    if (!before?.state || C.stable(state) !== C.stable(before.state)) throw Error('ข้อมูลเปลี่ยนแล้ว ต้องคำนวณใหม่ก่อนหาค่าทดลอง');
    if (state.v61?.systemType === 'truss') throw Error('Truss ต้องตรวจรอยเชื่อมเพลทราก / Node แยก ไม่ใช้ผลรอยเชื่อมคานเดี่ยวแทน');
    if (state.mode === 'direct') throw Error('Direct actions ต้องตรวจข้อมูลภายนอกและกรณีแรงก่อน ไม่เสนอค่าคานตัวอย่างแทน');
    const original = C.numericEvidence('weld', before);
    if (!original.known) throw Error('ช่วงขนาดหรือผลรอยเชื่อมยังไม่ครบ ตรวจมิติและกรณีแรงก่อน');
    const limits = before.cases.map(c => c.weld);
    const min = Math.max(...limits.map(w => w.minSize)), max = Math.min(...limits.map(w => w.maxSize));
    if (![min,max].every(finite) || min <= 0 || max < min || max - min > 100) throw Error('ไม่มีช่วงขนาดรอยเชื่อมที่ใช้ทดลองได้');
    // Whole-millimetre trial sizes only, bounded by every retained load case.
    // These are candidate dimensions, not a WPS or a new normative minimum.
    const sizes = Array.from({length:Math.max(0, Math.floor(max) - Math.ceil(min) + 1)}, (_,i) => Math.ceil(min) + i);
    const tried = [];
    for (const size of sizes) {
      if (size === state.weld.size) continue;
      const patch = {'weld.size':size}, next = C.applyPatch(state, patch);
      const strict = C.strictAuto(state, next);
      if (C.stable(strict) !== C.stable(patch)) throw Error('ค่าทดลองเปลี่ยนนอกขารอยเชื่อม');
      const errors = root.NCYV5.validate(next);
      if (errors.length) continue;
      const result = root.NCYEngine.calculate(next), proof = C.numericEvidence('weld', result);
      // The mounted application adds this geometry gate after calculate(). A
      // weld-only trial cannot resolve it: retain it exactly in the preview.
      if (state.connectionType === 'bracket' && before.checks.braceGeometry?.state === 'outside') {
        result.checks.braceGeometry = copy(before.checks.braceGeometry);
      }
      const crossed = Object.keys(result.checks).filter(k => finite(before.checks[k]?.ratio) && before.checks[k].ratio <= 1 &&
        finite(result.checks[k]?.ratio) && result.checks[k].ratio > 1);
      const newlyPending = Object.keys(result.checks).filter(k => ['incomplete','hold'].includes(result.checks[k].state) &&
        !['incomplete','hold'].includes(before.checks[k]?.state));
      const failureKeys = [...new Set([...C.newFailures(before,result), ...crossed, ...newlyPending])];
      const canOffer = proof.known && proof.within && !failureKeys.length;
      tried.push({size, ratio:result.checks.weld.ratio, canOffer, failureKeys,known:proof.known,within:proof.within});
      if (canOffer) return {patch,next,result,proof,failureKeys,canOffer,tried,scope:'weld-only'};
    }
    const failureKeys=[...new Set(tried.flatMap(t=>t.failureKeys))];
    const details=tried.map(t=>`${t.size} mm: D/C ${t.ratio.toFixed(3)} · ${t.within?'ขนาดและกำลังอยู่ในช่วง':'ขนาดหรือกำลังยังไม่ครบเกณฑ์'}${t.failureKeys.length?' · ต้องตรวจเพิ่ม '+t.failureKeys.map(k=>before.checks[k]?.label||k).join(', '):''}`).join(' / ');
    return {patch:{},next:copy(state),result:before,proof:original,failureKeys,canOffer:false,tried,scope:'weld-only',
      reason:`ยังใช้ค่าทดลองไม่ได้: ${details||'ไม่มีขนาดเต็มมิลลิเมตรในช่วงที่เอนจิ้นตรวจได้'} · คงหน้าตัด โหลด พุก และระบบเดิม ต้องตรวจหน้าตัด แนวเชื่อม หรือเส้นทางถ่ายแรงต่อ`};
  }
  root.NCYSC01CalculationAudit = Object.freeze({VERSION:'r18', status, coverage, weldTrial});
  const doc = root.document;
  if (!doc) return;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, pendingFrame = 0;
  function showCoverage() {
    if (!root.NCYSC01InputFlow?.ensureCurrentResult()) return;
    if (!dialog) {
      dialog = doc.createElement('dialog'); dialog.id = 'sc01CalculationCoverage'; dialog.className = 'sc01-audit-dialog';
      dialog.setAttribute('aria-labelledby','sc01CoverageTitle'); doc.body.append(dialog);
      dialog.addEventListener('click', event => {
        if (event.target.closest('[data-audit-close]')) dialog.close();
        const fix = event.target.closest('[data-audit-fix]');
        if (fix) { dialog.close(); root.NCYSC01AssistantUI?.open?.(fix.dataset.auditFix); }
      });
    }
    const r = root.NCYApp.getResult(), groups = coverage(r);
    const renderRows = rows => rows.map(c => `<tr><th>${esc(c.label)}<small>${esc(c.key)}</small></th><td>${esc(status(c))}${c.methodReview?'<small>ยังรอตรวจวิธี / หลักฐาน</small>':''}</td><td>${finite(c.ratio)?c.ratio.toFixed(3):'—'}<small>${esc(c.governingCase || '')}</small></td><td>${esc(c.note || 'ดูรายละเอียดวิธีตรวจ')}<button type="button" data-audit-fix="${esc(c.key)}">ดูเหตุผล / วิธีแก้</button></td></tr>`).join('');
    const table = rows => `<div class="sc01-audit-table"><table><thead><tr><th>รายการ</th><th>สถานะ</th><th>D/C กำลัง</th><th>เหตุผล / ขั้นต่อไป</th></tr></thead><tbody>${renderRows(rows)}</tbody></table></div>`;
    dialog.innerHTML = `<header><div><small>รายการจริงจากเอนจิ้นชุดปัจจุบัน</small><h2 id="sc01CoverageTitle">ตรวจอะไรแล้ว · ยังขาดอะไร</h2></div><button type="button" data-audit-close>ปิด</button></header><div class="sc01-audit-body"><p>${r.cases.length} กรณีแรง · ${Object.keys(r.checks).length} รายการตรวจ · ไม่เข้าเกณฑ์ ${groups.failed.length} · ข้อมูล / ขอบเขตไม่ครบ ${groups.pending.length}</p><p class="sc01-audit-note">D/C ต่ำกว่า 1 ไม่ได้แปลว่าผ่านเรื่องขนาดหรือวิธีตรวจทุกข้อ ช่อง “ไม่ใช้กับระบบนี้” ไม่ใช่รายการคำนวณที่หาย และไม่ถูกนับเป็นผ่าน</p>${[['failed','ต้องแก้ก่อน'],['pending','ต้องเติมข้อมูล / ตรวจขอบเขต'],['calculated','คำนวณแล้ว — ดูสถานะวิธีตรวจด้วย'],['notApplicable','ไม่ใช้กับรูปแบบโครงที่เลือก']].map(([key,title])=>`<details ${['failed','pending'].includes(key)?'open':''}><summary>${title} · ${groups[key].length}</summary>${table(groups[key])}</details>`).join('')}<p class="sc01-audit-note">รายการนี้ไม่แทนการตรวจอิสระ การตรวจหน้างาน WPS รายงานพุกรุ่นจริง หรือการอนุมัติก่อสร้าง ภาพรั้งบน R17 ยังเป็นภาพศึกษารูปทรง ไม่อยู่ในเอนจิ้น</p></div>`;
    dialog.showModal();
  }
  function sync() {
    pendingFrame = 0;
    const parent = doc.querySelector('.ncy670-workflow') || doc.getElementById('sc01r12Options')?.parentElement;
    if (parent && !doc.getElementById('sc01CoverageOpen')) {
      const b = doc.createElement('button'); b.id='sc01CoverageOpen'; b.type='button'; b.className='button secondary sc01-r12-tool';
      b.textContent='รายการตรวจ / สิ่งที่ขาด'; b.onclick=showCoverage; parent.append(b);
    }
    // Correct misleading presentation only. The retained verdict and ratios stay intact.
    const r = root.NCYApp?.getResult(), bad = Object.values(r?.checks || {}).filter(c=>c.state==='fail');
    if (bad.length && bad.every(c=>c.sizeEligible === false && finite(c.ratio) && c.ratio <= 1)) {
      for (const n of doc.querySelectorAll('#overallCard .overall-card > p')) {
        if (n.textContent.includes('ตัวเลขเกินเกณฑ์คัดกรอง')) n.textContent='ขนาดรอยเชื่อมอยู่นอกช่วง — ดูค่าทดลองในผู้ช่วย';
      }
    }
  }
  function schedule() { if (!pendingFrame) pendingFrame=root.requestAnimationFrame(sync); }
  function mount() {
    sync(); root.addEventListener('ncy:v5-updated', schedule);
    doc.addEventListener('click', schedule); doc.addEventListener('change', schedule);
    function ready(attempt=0) {sync();if(!doc.getElementById('sc01CoverageOpen')&&attempt<20)root.setTimeout(()=>ready(attempt+1),200);}
    ready();
  }
  if (doc.readyState==='loading') doc.addEventListener('DOMContentLoaded',mount,{once:true}); else mount();
})(typeof window !== 'undefined' ? window : globalThis);
