/* SC01 R20: read-only report projection. Never recalculates or approves a check. */
(function (root) {
  'use strict';
  const evidenceKeys = new Set(['productGate', 'existing', 'rebarScan', 'designBasis',
    'codeCoverage', 'legalCompliance', 'productSnapshot', 'designProfiles',
    'profileVerification', 'fabricationDraft', 'projectRelease']);
  const quantityKeys = new Set(['trussCutList']);
  const standaloneGroups = new Set(['03 · เหล็กกล่อง', '04 · รอยเชื่อม',
    '05 · เพลท', '06 · กลุ่มพุก', '07 · พุกและคอนกรีต']);
  const groupKeys = Object.freeze({
    '03 · เหล็กกล่อง': 'member', '04 · รอยเชื่อม': 'weld', '05 · เพลท': 'plate',
    'TRUSS ROOT': 'trussRootGeometry', '03 · TRUSS STABILITY': 'trussMemberAdvanced',
    '04 · TRUSS NODE': 'trussNodeAdvanced', '05 · ROOT PLATE': 'rootPlateNoPrying',
    '05 · ROOT PLATES': 'trussRootConnection', '09 · RC SUPPORT': 'rcSupport',
    '10 · SPACE TRUSS': 'spaceTruss3D', '11 · HSS JOINT': 'trussHSSJoint',
    '12 · ROOT COMPONENT': 'rootPlateComponent', '13 · EXISTING SUPPORT': 'rcSupportSystem'
  });
  const titleKeys = Object.freeze({
    'การโก่งตัวใช้งาน': 'deflection', 'สมดุลแรงและโมเมนต์': 'solver',
    'แกนพุกดึงและเฉือน': 'anchorSteel', 'Concrete breakout: แรงดึง': 'breakoutT',
    'Adhesive bond: กลุ่มพุก': 'bond', 'Concrete breakout: แรงเฉือน': 'breakoutV',
    'Concrete pryout': 'pryout', 'สมการสมดุลโครงข้อหมุน': 'trussSystem',
    'แรงแกนสมาชิกจากการกระจัด': 'trussMember', 'การโก่งตัวจาก Matrix': 'deflection'
  });
  const label = state => ({ok:'อยู่ในเกณฑ์', pass:'อยู่ในเกณฑ์', review:'รอตรวจวิธีคำนวณ',
    warn:'ต้องทบทวน', fail:'ไม่ผ่าน', incomplete:'ข้อมูลไม่ครบ', outside:'นอกขอบเขต',
    hold:'รอตรวจ', na:'ไม่เกี่ยวข้อง'}[state] || 'ยังไม่ยืนยันสถานะ');
  const esc = value => String(value ?? '').replace(/[&<>"']/g,
    char => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
  const fmt = value => Number.isFinite(value) ? Number(value).toFixed(3) : '—';
  const isQuantity = row => /^08\s*·\s*(BOQ|CUT LIST)\b/.test(String(row?.group || ''));
  const checkKey = row => row.purlinKey || titleKeys[row.title] || groupKeys[row.group] || '';
  const includeCheck = (key, check) => root.NCYSC01ResultsReview
    ? ['failed', 'unknown', 'within'].includes(root.NCYSC01ResultsReview.category(key, check))
    : check?.state !== 'na' && !evidenceKeys.has(key) && !quantityKeys.has(key);

  function splitChecks(result) {
    const calculations = [], evidence = [], excluded = [], quantities = [];
    for (const [key, check] of Object.entries(result?.checks || {})) {
      const item = {key, check};
      if (check.state === 'na') excluded.push(item);
      else if (quantityKeys.has(key)) quantities.push(item);
      else if (evidenceKeys.has(key) || root.NCYSC01ResultsReview?.category(key, check) === 'technical') evidence.push(item);
      else calculations.push(item); // New/unknown keys fail visible, not silently omitted.
    }
    return {calculations, evidence, excluded, quantities};
  }

  function formulaRows(result, rows) {
    const truss = result?.state?.v61?.systemType === 'truss';
    return Array.from(rows || []).filter(row => !isQuantity(row) && row.state !== 'na'
      && !(truss && standaloneGroups.has(row.group))
      && result?.checks?.[checkKey(row)]?.state !== 'na').map(row => {
      const key = checkKey(row), check = result?.checks?.[key];
      // Exact case only. SLS/geometry/unresolved names never fall back to ULS.
      const matches = /การโก่ง|GEOMETRY/.test(row.title + row.caseName) ? []
        : (result?.cases || []).filter(item => item.caseDef?.name === row.caseName);
      const loadCase = matches.length === 1 ? matches[0] : null;
      const actions = loadCase ? ['N','Vx','Vy','Mx','My','Tz'].map(axis =>
        `${axis}=${fmt(loadCase.action?.[axis])} ${['N','Vx','Vy'].includes(axis) ? 'kN' : 'kN·m'}`).join('; ') : '';
      const scope = truss ? 'แรงภายนอกรวมของกรณีนี้ (แรงโหนด/เพลทย่อยดูบรรทัดแทนค่า)' : 'แรงหน้าเพลทของกรณีนี้';
      return {...row, reportTrace:{key, checkLabel:check?.label || '', actions, scope,
        context:actions ? `${scope}: ${actions}` : row.caseName
          ? `ฐานสมการ: ${row.caseName} — ไม่ใช้แรง ULS ต่างกรณีมาแทน` : 'ข้อมูลรูปทรง / วัสดุที่ใช้คำนวณ'}};
    });
  }

  function traceHTML(row) {
    const trace = row.reportTrace;
    if (!trace) return '';
    return `<div class="sc01-report-trace" data-report-check="${esc(trace.key)}"><b>${esc(trace.actions ? trace.scope : 'ฐานข้อมูลของสมการ')}</b><span>${esc(trace.actions || trace.context)}</span>${trace.checkLabel ? `<small>รายการตรวจ: ${esc(trace.checkLabel)} · ผลบรรทัดนี้ไม่แทน D/C รวมทุกโหมด</small>` : ''}</div>`;
  }

  function equationCell(row, index, source) {
    const equivalent = root.NCYUnits?.equivalentResult(row.result);
    return `<td class="c4-equation-cell" data-formula-index="${index}" data-report-check="${esc(row.reportTrace?.key || '')}"><header><span class="c4-eq-num">${String(index+1).padStart(2,'0')}</span><div><b>${esc(row.title)}</b><small>${esc(row.caseName || row.group)} · ${esc(source)}</small></div></header>${traceHTML(row)}<table class="c4-eq-inner"><tbody><tr><th>สมการ</th><td class="c4-math">${esc(row.formula)}</td></tr><tr><th>แทนค่า<br>SI</th><td class="c4-sub">${esc(row.sub)}</td></tr><tr class="c4-eq-result"><th>ผล / เกณฑ์</th><td>${esc(row.result)}${equivalent ? `<small class="unit-equivalent">≈ ${esc(equivalent)}</small>` : ''}${['fail','outside','incomplete','warn'].includes(row.state) ? `<strong class="c4-eq-flag ${esc(row.state)}">${esc(label(row.state))}</strong>` : ''}</td></tr></tbody></table></td>`;
  }

  function formulaCards(rows) {
    return rows.map(row => {
      const equivalent = root.NCYUnits?.equivalentResult(row.result);
      return `<section class="formula-card" data-report-check="${esc(row.reportTrace?.key || '')}"><div class="formula-top"><span>${esc(row.group)}</span><small>${esc(row.caseName || 'INPUT / GEOMETRY')}</small></div><h3>${esc(row.title)}</h3>${traceHTML(row)}<div class="equation">${esc(row.formula)}</div><div class="substitution"><label>แทนค่า SI</label><span>${esc(row.sub)}</span></div><div class="formula-answer">${esc(row.result)}</div>${equivalent ? `<div class="unit-equivalent">≈ ${esc(equivalent)}</div>` : ''}<small class="formula-source">${esc(row.source || row.ref || '')}</small>${['fail','outside','incomplete','warn'].includes(row.state) ? `<p class="sc01-report-state">${esc(label(row.state))}</p>` : ''}</section>`;
    }).join('');
  }

  function missingTraces(result, projected) {
    const covered = new Set(projected.map(row => row.reportTrace?.key).filter(Boolean));
    return splitChecks(result).calculations.filter(({key, check}) => !covered.has(key)
      && (Number.isFinite(check.ratio) || !['ok','pass'].includes(check.state)));
  }

  function evidenceBlocks(result, projected) {
    const {evidence, excluded} = splitChecks(result);
    const missing = missingTraces(result, projected), blocks = [];
    if (root.NCYSC01ResultsReview) {
      // R23 diagnostic report: one scope statement, not repeated evidence tasks.
      if (missing.length) blocks.push('<p class="c4-note">ขอบเขตการแทนค่า: ยังไม่มีสมการผูกผลครบสำหรับ '+missing.map(({check})=>esc(check.label)).join(' · ')+'. ค่า D/C ของรายการเหล่านี้ยังอ่านจาก Engine เดิม ดูรายละเอียดในหน้าผลคำนวณ</p>');
      const supportPending = ['rcSupport', 'rcSupportSystem'].some(key => result.checks?.[key]?.state === 'incomplete');
      blocks.push('<p class="c4-note">เอกสารเพื่อทบทวนผลตามสมการ ไม่ใช่แบบอนุมัติก่อสร้าง การเปิดเอกสารไม่ใช่การรับรองวิธีคำนวณ ผลิตภัณฑ์ หรือสภาพหน้างาน'+(supportPending?' โครงสร้างรองรับเดิมยังไม่มีผลกำลังที่ยืนยัน': '')+'. รายละเอียดประกอบเปิดดูได้ในหน้าผลคำนวณ</p>');
      return blocks;
    }
    const table = (items, kind) => `<table class="c4-table sc01-report-${kind}"><thead><tr><th>รายการที่ยังต้องตรวจ</th><th>สถานะเดิม</th><th>กรณี / สิ่งที่ยังขาด</th></tr></thead><tbody>${items.map(({key,check}) => `<tr data-report-check="${esc(key)}"><td>${esc(check.label || key)}</td><td>${esc(label(check.state))}</td><td>${esc(kind === 'missing' ? 'ยังไม่มีสมการแทนค่าที่ผูกกับผลรายการนี้ครบ · ' + (check.governingCase || 'ข้อมูลโครงการ') : check.note || 'ดูหลักฐานในหน้าตรวจสอบโครงการ')}</td></tr>`).join('')}</tbody></table>`;
    if (missing.length) {
      blocks.push('<h3 class="c4-section">รายการจำเป็นที่ยังไม่มีสมการแทนค่าครบ</h3><p class="c4-note">ผล D/C ในตารางสรุปยังเป็นค่าจาก Engine เดิม แต่รายการด้านล่างยังไม่ใช่ calculation trace ที่ครบถ้วน การตัดสมการที่ไม่ตรงโมเดลออกไม่ได้ทำให้รายการเหล่านี้ผ่าน</p>');
      for (let i=0;i<missing.length;i+=8) blocks.push(table(missing.slice(i,i+8),'missing'));
    }
    if (evidence.length) {
      blocks.push('<h3 class="c4-section">หลักฐานและขอบเขต — แยกจาก D/C</h3><p class="c4-note">สถานะเอกสารไม่ใช่สมการกำลัง และยังคงมีผลต่อความพร้อมใช้งาน รายละเอียดดูหน้า Checklist ส่งวิศวกร / มาตรฐาน</p>');
      for (let i=0;i<evidence.length;i+=8) blocks.push(table(evidence.slice(i,i+8),'evidence'));
    }
    if (excluded.length) blocks.push(`<p class="c4-note">ไม่แสดง ${excluded.length} รายการที่ Engine ระบุ “ไม่เกี่ยวข้อง” กับโมเดลนี้เท่านั้น รายการไม่ผ่าน ข้อมูลไม่ครบ และนอกขอบเขตยังคงอยู่</p>`);
    return blocks;
  }

  function trussRootBlocks(result) {
    const governing = result?.v63?.root?.governing;
    const blocks = ['<p class="c4-note">Truss ใช้แรงปฏิกิริยาที่เพลทบนและเพลทล่างจาก Matrix ไม่ใช้ตารางพุกหรือรูปแรงของคานเพลทเดี่ยวมาแทน ค่าด้านล่างเป็นกรณีควบคุมจุดต่อรากที่ระบุ ไม่ใช่ซองครอบรายโหมดทุกตำแหน่ง</p>'];
    if (!governing) return [...blocks,'<p class="c4-note">ข้อมูลแรงปฏิกิริยาจุดต่อรากยังไม่ครบ — ยังสร้างตารางนี้ไม่ได้</p>'];
    for (const position of ['top','bottom']) {
      const plate = governing[position];
      if (!plate) { blocks.push('<p class="c4-note">ยังไม่มีผลเพลท '+esc(position)+'</p>'); continue; }
      const rows = [
        ['แรงแกนเพลท N',fmt(plate.action?.Nx),'kN'], ['แรงเฉือนเพลท V',fmt(plate.action?.Vy),'kN'],
        ['แรงดึงต่อพุก T',fmt(plate.Tper),'kN'], ['แรงเฉือนต่อพุก V',fmt(plate.Vper),'kN'],
        ['กำลังแกนพุก Ncap / Vcap',`${fmt(plate.Ncap)} / ${fmt(plate.Vcap)}`,'kN'],
        ['D/C แกนพุก / ผลิตภัณฑ์',`${fmt(plate.anchorRatio)} / ${fmt(plate.productRatio)}`,'—'],
        ['รอยเชื่อม: ความเค้น / กำลัง',`${fmt(plate.weld?.stress)} / ${fmt(plate.weld?.capacity)}`,'MPa'],
        ['D/C รอยเชื่อม / เพลท',`${fmt(plate.weld?.ratio)} / ${fmt(plate.plate?.ratio)}`,'—']
      ];
      blocks.push(`<h3 class="c4-section">เพลท${position==='top'?'บน':'ล่าง'} · ${esc(plate.caseName || governing.caseName)}</h3><table class="c4-table sc01-report-root" data-root-plate="${position}"><thead><tr><th>ค่าจากผลจุดต่อราก</th><th>ผลที่ใช้</th><th>หน่วย</th></tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      blocks.push(`<table class="c4-table"><thead><tr><th>โหมดคอนกรีต / พุก</th><th>แรง / กำลัง (kN)</th><th>D/C</th><th>สถานะเดิม</th></tr></thead><tbody>${['breakoutT','bond','breakoutV','pryout'].map(key=>{const check=plate[key];return `<tr><td>${esc(key)}</td><td>${fmt(check?.demand)} / ${fmt(check?.design)}</td><td>${fmt(check?.ratio)}</td><td>${esc(label(check?.state))}</td></tr>`;}).join('')}</tbody></table>`);
    }
    return blocks;
  }

  const dimension = value => Number.isFinite(value) ? String(Number(value.toFixed(3))) : '—';
  const sectionSize = section => [section?.H,section?.B,section?.tNom].map(dimension).join('×')+' mm';
  const validSection = section => [section?.H,section?.B,section?.tNom].every(value=>Number.isFinite(value)&&value>0)
    && 2*section.tNom<Math.min(section.H,section.B);
  function purlinSection(result) {
    return result?.purlins?.section || {H:result?.state?.takeoff?.purlinH,
      B:result?.state?.takeoff?.purlinB,tNom:result?.state?.takeoff?.purlinT};
  }
  function purlinSectionBlock(result) {
    if (!result?.state?.takeoff?.includePurlins) return '';
    const section=purlinSection(result), p=result.purlins;
    if (!validSection(section)) return '<p class="c4-note">หน้าตัดแป: ขนาด H/B/t ไม่ครบหรือไม่ถูกต้อง จึงยังแสดงรูปหน้าตัดไม่ได้</p>';
    const scale=Math.min(126/section.H,170/section.B), w=section.B*scale,h=section.H*scale,t=section.tNom*scale;
    const x=155-w/2,y=90-h/2;
    const svg=`<svg viewBox="0 0 330 210" role="img" aria-label="หน้าตัดแป ${esc(sectionSize(section))} H แนวดิ่ง">
      <path class="sc01-section-steel" fill-rule="evenodd" d="M${x} ${y}h${w}v${h}h${-w}Z M${x+t} ${y+t}h${w-2*t}v${h-2*t}h${2*t-w}Z"/>
      <g fill="none" stroke="currentColor" stroke-width="1"><path d="M${x-8} ${y}H${x-29} M${x-8} ${y+h}H${x-29} M${x-23} ${y}V${y+h} M${x-27} ${y+4}l8 -8 M${x-27} ${y+h+4}l8 -8"/>
      <path d="M${x} ${y+h+8}V${y+h+29} M${x+w} ${y+h+8}V${y+h+29} M${x} ${y+h+23}H${x+w} M${x-4} ${y+h+27}l8 -8 M${x+w-4} ${y+h+27}l8 -8"/>
      <path d="M${x+w-t/2} ${y+h*.3}L265 35H278"/></g>
      <g fill="currentColor" font-family="Sarabun,sans-serif" font-size="13"><text transform="translate(${x-34} ${y+h/2}) rotate(-90)" text-anchor="middle">H ${dimension(section.H)} mm</text>
      <text x="155" y="${y+h+43}" text-anchor="middle">B ${dimension(section.B)} mm</text><text x="260" y="25">t ${dimension(section.tNom)} mm</text></g></svg>`;
    const values=[['ขนาด H×B×t',sectionSize(section)],['t ที่ใช้คำนวณ',dimension(p?.properties?.t)+' mm'],
      ['Fy',dimension(p?.section?.Fy)+' MPa'],['Ix',dimension(p?.properties?.Ix)+' mm⁴'],
      ['ช่วงแปจริง',dimension(p?.grid?.spanM)+' m']];
    return `<section class="sc01-report-section" data-report-section="purlin"><h3 class="c4-section">หน้าตัดแปที่ใช้คำนวณ · H แนวดิ่ง</h3><div class="sc01-section-layout">${svg}<dl>${values.map(([key,value])=>`<dt>${esc(key)}</dt><dd>${esc(value)}</dd>`).join('')}</dl></div></section>`;
  }
  function sectionVerdict(result,keys,known) {
    const rows=keys.map(key=>({key,check:result?.checks?.[key],category:root.NCYSC01ResultsReview?.category(key,result?.checks?.[key])||'unknown'}));
    // Reuse the numerical review categories; do not invent a pass threshold or
    // promote missing/SLS/outside results to an accepted section.
    const state=rows.some(row=>row.category==='failed')?'fail':known&&rows.every(row=>row.category==='within')?'ok':'unknown';
    return {state,rows};
  }
  function selectedSections(result) {
    const s=result.state, truss=s.v61?.systemType==='truss', p=result.purlins;
    const mainKnown=!truss&&validSection(s.member)&&(s.mode!=='direct'||s.v5?.serviceDeflectionProvided===true);
    const sections=[{key:'member',title:truss?'โครง Truss':'คานหลัก',section:truss?null:s.member,
      ...sectionVerdict(result,['member','deflection'],mainKnown),
      note:truss?'ดูหน้าตัดและผลแยกรายสมาชิกในรายการคำนวณ Truss':!mainKnown?'ข้อมูลหน้าตัดหรือผลการแอ่นตัวยังไม่ครบ':''}];
    if(truss){
      sections.length=0;
      for(const kind of ['chord','web']){
        const cases=result.v64?.cases||[],all=cases.flatMap(c=>(c.advancedMembers||[]).filter(m=>m.kind===kind).map(m=>({...m,caseName:c.caseName})));
        const known=cases.length===result.cases.length&&cases.every(c=>!c.error&&c.advancedMembers?.some(m=>m.kind===kind))&&all.every(m=>['ok','warn'].includes(m.state)&&Number.isFinite(m.ratio));
        const failed=all.filter(m=>root.NCYSC01ResultsReview?.category('trussSection',m)==='failed'),candidates=failed.length?failed:all;
        const worst=candidates.reduce((a,b)=>!a||Number.isFinite(b.ratio)&&(!Number.isFinite(a.ratio)||b.ratio>a.ratio)?b:a,null),section=kind==='chord'?s.member:s.brace;
        const check=worst?{...worst,label:`${worst.id} · ${worst.caseName} · ${worst.axis}`} : null;
        const projected={...result,checks:{...result.checks,trussSection:check}};
        sections.push({key:kind,title:kind==='chord'?'คอร์ดบน–ล่าง Truss':'เหล็กเอวตั้ง / ทแยง Truss',section,
          ...sectionVerdict(projected,['trussSection','deflection','trussLateralBracing','trussSecondOrder'],known&&validSection(section)),
          note:'ตรวจสมาชิกทุกกรณีแรง รวมการแอ่นและเสถียรภาพของระบบ; คอร์ดบน–ล่างใช้หน้าตัดเดียวกัน'});
      }
    }
    if(s.takeoff?.includePurlins)sections.push({key:'purlin',title:'แปเหล็กกล่อง',section:purlinSection(result),
      ...sectionVerdict(result,['purlinBending','purlinDeflection'],validSection(purlinSection(result))&&!!p?.bending&&!!p?.deflection&&!['outside','incomplete','na'].includes(p?.state)),note:p?.reason||''});
    return sections;
  }
  function selectedSteelBlock(result) {
    const rows=selectedSections(result), status={ok:'✓ OK',fail:'✕ ไม่ผ่าน',unknown:'! ยังสรุปไม่ได้'};
    return `<section class="sc01-selected-steel" data-report-conclusion="steel"><h3 class="c4-section">สรุปหน้าตัดเหล็กที่เลือกใช้</h3>${rows.map(row=>`<div class="sc01-selected-steel-row" data-selected-steel="${row.key}" data-section-status="${row.state}"><h4>${esc(row.title)}</h4><p>${row.section?'เลือกใช้เหล็กขนาด '+esc(sectionSize(row.section)):'หน้าตัดแยกรายสมาชิก'} — <strong class="sc01-section-status ${row.state}">${status[row.state]}</strong></p><small>${row.rows.map(({key,check,category})=>esc((check?.label||key)+' · D/C '+dimension(check?.ratio)+' · '+({within:'อยู่ในเกณฑ์',failed:'ไม่ผ่าน'}[category]||'ยังสรุปไม่ได้'))).join('<br>')}${row.note?'<br>'+esc(row.note):''}</small></div>`).join('')}${!result.state.takeoff?.includePurlins?'<p class="c4-note">แป: ไม่ได้รวมแปในงาน</p>':''}<p class="c4-note">OK เป็นผลเฉพาะกำลังและการแอ่นของหน้าตัดตามสมการชุดนี้ จุดต่อ พุก และโครงสร้างรองรับตรวจแยกตามรายการข้างต้น เอกสารนี้ใช้เพื่อทบทวน</p></section>`;
  }

  root.NCYSC01Report = Object.freeze({VERSION:'r29', splitChecks, includeCheck,
    formulaRows, formulaCards, equationCell, evidenceBlocks, missingTraces, isQuantity, trussRootBlocks,
    purlinSectionBlock, selectedSections, selectedSteelBlock});
})(typeof window !== 'undefined' ? window : globalThis);
