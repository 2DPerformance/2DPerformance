/* SC01 R24: current-result presentation only. No design or candidate solver. */
(function (root) {
  'use strict';
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = x => Number.isFinite(x) ? x.toFixed(3).replace(/\.?0+$/, '') : '—';
  const family = key => /^purlin/.test(key) ? 'purlin' : /^(member|deflection|trussMember|trussSystem|spaceTruss|trussOut|trussHSS)/.test(key) ? 'member'
    : /^(weld|plate|stiffener|brace|rootPlate|trussRoot|trussNode|trussGusset)/.test(key) ? 'plate'
    : /^(anchor|productInteraction|breakout|bond|pullout|pryout|gapBending|geometry)/.test(key) ? 'anchor' : 'other';
  const titles = {purlin:'แปเหล็กกล่อง',member:'เหล็กกล่อง / โครง',plate:'เพลทและรอยเชื่อม',anchor:'พุกและคอนกรีตรอบพุก',other:'รายการจำเป็นอื่น'};
  function advice(row, r) {
    const key = row.key;
    if (key.startsWith('purlin')) return root.NCYSC01Purlins?.advice(r) || row.note;
    if (root.NCYSC01ResultsReview.category(key, row) === 'unknown') return 'ยังเลือกขนาดให้ผ่านไม่ได้: เติมค่ากำลังที่ขาดหรือใช้รุ่นที่มีข้อมูลรองรับ แล้วคำนวณใหม่';
    if (key === 'deflection') return 'เปลี่ยนเหล็กกล่องให้แข็งขึ้น หรือปรับระยะ/ระบบรองรับ แล้วตรวจการแอ่นและกำลังใหม่';
    if (key === 'weld') return 'ปรับขารอยเชื่อมและแนวเชื่อมให้ตรงความหนาเหล็กและช่วงขนาดที่แสดง หากช่วงขนาดไม่พอให้เปลี่ยนรายละเอียดจุดต่อ';
    if (key === 'plate') return `เปลี่ยนเพลทหรือรายละเอียดจุดต่อ: ผลดัดแถบต้องการ t_req ${num(r.controls?.plate?.plate?.tReq)} mm; ยังต้องตรวจรูเจาะ หน้าตัดสุทธิ และแรงสัมผัสด้วย`;
    if (['breakoutT','breakoutV','bond','pullout','pryout','geometry'].includes(key)) return 'ปรับชนิดพุก ระยะฝัง ระยะขอบ/ระยะห่าง หรือระบบยึด การเพิ่ม M อย่างเดียวอาจไม่แก้โหมดคอนกรีต';
    if (family(key) === 'anchor') return 'เปลี่ยนรุ่น/ขนาดหรือจำนวนพุกที่มีข้อมูลกำลัง แล้วตรวจแรงดึง แรงเฉือน ปฏิสัมพันธ์และคอนกรีตใหม่';
    if (family(key) === 'member') return 'เปลี่ยนหน้าตัด/ความหนาเหล็ก หรือปรับระบบรองรับ แล้วคำนวณทุกกรณีแรงใหม่';
    if (family(key) === 'plate') return 'ปรับเพลท รอยเชื่อม หรือชิ้นส่วนจุดต่อที่ระบุ แล้วคำนวณทุกโหมดใหม่';
    return 'แก้ข้อมูลต้นทางของรายการนี้ก่อนสรุปผลหรือเปลี่ยนวัสดุ';
  }
  function project(r, selected) {
    const view = root.NCYSC01ResultsReview.project(r), c = selected || r.controls?.member || r.governing;
    const rows = [...view.failed, ...view.unknown, ...view.within];
    const truss=r.state.v61?.systemType === 'truss', geometry=r.v63?.root?.g;
    return {view, c, rows, truss, geometry, direct:r.state.mode === 'direct', deflectionKnown:r.state.mode !== 'direct' || r.state.v5?.serviceDeflectionProvided === true,
      groups:Object.keys(titles).map(key => ({key,title:titles[key],rows:rows.filter(row => family(row.key) === key)})),
      recommendations:view.actions.map(row => ({...row, advice:advice(row,r)}))};
  }
  function summaryHTML(r) {
    const p = project(r), s = r.state, c = p.c, loads = r.loads?.components;
    const plateSize=p.truss?`${num(p.geometry?.plateW)}×${num(p.geometry?.plateH)}×${num(p.geometry?.plateT)}`:`${s.plate.width}×${s.plate.height}×${s.plate.thickness}`;
    const anchorCount=p.truss?`${num(p.geometry?.anchorsPerPlate)} ตัวต่อเพลทราก`:`${s.anchors.rows*s.anchors.cols} ตัว`;
    const deflection=p.deflectionKnown?`แอ่น ${num(r.deflection?.max)} / ${num(r.deflection?.allow)} mm`:'ยังไม่มีผลการแอ่นจากการวิเคราะห์ภายนอก';
    const status = keys => {
      const rows = p.rows.filter(row => keys.includes(family(row.key)));
      const failed = rows.filter(row => root.NCYSC01ResultsReview.category(row.key,row) === 'failed').length;
      const unknown = rows.filter(row => root.NCYSC01ResultsReview.category(row.key,row) === 'unknown').length;
      const values = rows.map(row => row.ratio).filter(Number.isFinite);
      return `${failed ? 'ต้องแก้ '+failed+' ข้อ · ' : ''}${unknown ? 'ยังไม่มีผลครบ '+unknown+' ข้อ · ' : ''}D/C สูงสุด ${num(values.length ? Math.max(...values) : NaN)}`;
    };
    return `<section id="sc01LoadPathSummary" aria-label="ลำดับการถ่ายแรง"><h3>น้ำหนัก → เหล็ก → เพลท → พุก</h3><ol><li><b>01 น้ำหนักวัสดุและแรงใช้งาน</b><span>${p.direct?'ใช้แรงจากโปรแกรมวิเคราะห์ภายนอก':`D ${num(loads?.D)} · L ${num(loads?.L)} · W ${num(loads?.W)} kN/m`}</span></li><li><b>02 ${p.truss?'โครง Truss':`เหล็กกล่อง ${s.member.H}×${s.member.B}×${s.member.tNom} mm`}</b><span>${status(['member'])}</span><span>${deflection}</span></li><li><b>03 ${p.truss?'เพลทรากบน/ล่าง':'เพลท'} ${plateSize} mm</b><span>${status(['plate'])}</span><span>${p.truss?'แรงเพลทบน/ล่างดูรายงาน':`Vy ${num(c?.action?.Vy)} kN · Mx ${num(c?.action?.Mx)} kN·m`}</span></li><li><b>04 พุก M${s.anchors.diameter} · ${anchorCount}</b><span>${p.truss?`D/C แกนพุกราก ${num(r.v63?.root?.anchor?.anchorRatio)} · คอนกรีตตรวจแยก`:status(['anchor'])}</span><span>ตรวจแรงดึง + เฉือน + คอนกรีต</span></li></ol><small>ผลแรง: ${esc(c?.caseDef?.name)} · D/C ควบคุมแยกรายการ</small><button type="button" data-page="general">ดู SFD / BMD และการแอ่น</button><button type="button" data-page="a4">เปิดรายการคำนวณ A4</button></section>`;
  }
  const table = (heads, rows, cls='') => `<table class="c4-table ${cls}"><thead><tr>${heads.map(x=>`<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(x=>`<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  const heading = text => `<h3 class="c4-section">${esc(text)}</h3>`;
  const note = text => `<p class="c4-note">${esc(text)}</p>`;
  const chunks = (items,n) => Array.from({length:Math.ceil(items.length/n)},(_,i)=>items.slice(i*n,(i+1)*n));
  function curveSVG(points, L) {
    if (!points.length || !Number.isFinite(L) || L <= 0 || points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.D))) return '';
    const max = Math.max(...points.map(p=>Math.abs(p.D))), scale = max || 1;
    const coords = points.map(p=>`${(38+p.x/L*484).toFixed(2)},${(37+p.D/scale*65).toFixed(2)}`).join(' ');
    return `<svg class="sc01-service-curve" viewBox="0 0 560 130" role="img" aria-label="กราฟการแอ่นตัวจาก Service load"><path d="M38 37 H522 M38 24 V107" fill="none" stroke="currentColor"/><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="1.8"/><g fill="currentColor" font-family="Sarabun,sans-serif" font-size="12"><text x="38" y="121">0</text><text x="522" y="121" text-anchor="end">${num(L)} m</text><text x="280" y="16" text-anchor="middle">|δ|max ${num(max)} mm · ขยายรูปการแอ่น ไม่ใช่มาตราส่วนจริง</text></g></svg>`;
  }
  function equation(row, index, reference) {
    return `<section class="sc01-worked-equation" data-report-check="${esc(row.reportTrace?.key)}"><h4>${index+1}. ${esc(row.title)}</h4><small>${esc(row.caseName||row.group)} · ${esc(reference)}</small><dl><dt>สมการ</dt><dd>${esc(row.formula)}</dd><dt>แทนค่า</dt><dd>${esc(row.sub)}</dd><dt>ผล</dt><dd><b>${esc(row.result)}</b></dd></dl></section>`;
  }
  function report(r,c,b,rows,h) {
    const p = project(r,c), s = r.state, P = h.paginator(r), blocks = [];
    try {
      const formulas = root.NCYSC01Report.formulaRows(r,rows);
      blocks.push(`<section class="c4-project"><div><h3>${esc(s.meta.projectName)}</h3><p>${esc(s.meta.location||'ยังไม่ระบุสถานที่')}</p></div></section>`,
        heading('01 น้ำหนัก → เหล็ก → เพลท → พุก'),table(['ชิ้นส่วน','ขนาดที่ตรวจ'],[
          [p.truss?'ระบบ Truss / ระยะยื่น':'เหล็กกล่อง / ระยะยื่น',p.truss?`${num(s.member.lengthM)} m · แรงสมาชิกจาก Matrix`:`${s.member.H}×${s.member.B}×${s.member.tNom} mm / ${num(s.member.lengthM)} m`],
          ...(p.truss?[['คอร์ดบน–ล่าง (หน้าตัดเดียวกัน)',`${s.member.H}×${s.member.B}×${s.member.tNom} mm`],['เหล็กเอวตั้ง / ทแยง',`${s.brace.H}×${s.brace.B}×${s.brace.tNom} mm`]]:[]),
          ...(s.takeoff?.includePurlins?[['แปเหล็กกล่อง / ช่วงจริง',`${num(s.takeoff.purlinH)}×${num(s.takeoff.purlinB)}×${num(s.takeoff.purlinT)} mm / ${num(r.purlins?.grid?.spanM)} m`]]:[]),
          [p.truss?'เพลทรากบน/ล่าง / ขารอยเชื่อม':'เพลท / ขารอยเชื่อม',`${p.truss?`${num(p.geometry?.plateW)}×${num(p.geometry?.plateH)}×${num(p.geometry?.plateT)}`:`${s.plate.width}×${s.plate.height}×${s.plate.thickness}`} mm / w ${num(s.weld.size)} mm`],
          ['พุก / จำนวน / ระยะฝัง',`M${s.anchors.diameter} / ${p.truss?`${num(p.geometry?.anchorsPerPlate)} ตัวต่อเพลทราก`:s.anchors.rows*s.anchors.cols+' ตัว'} / hef ${num(s.anchors.hef)} mm`]
        ]));
      const checkRows = p.groups.flatMap(group=>group.rows.map(row=>[esc(row.label||row.key),num(row.ratio),esc(root.NCYSC01ResultsReview.label(row)),esc(row.governingCase||'รูปทรง / SLS')]));
      chunks(checkRows,12).forEach(part=>blocks.push(table(['รายการตรวจ','D/C','ผลตามสมการ','กรณีควบคุม'],part,'c4-checks')));
      if (p.recommendations.length) {
        blocks.push(heading('สิ่งที่ต้องเปลี่ยน / แก้ไข'));
        p.recommendations.forEach(row=>blocks.push(`<section class="sc01-material-advice"><b>${esc(row.label)} · D/C ${num(row.ratio)}</b><p>${esc(row.advice)}</p></section>`));
      }
      blocks.push(note('D/C และเกณฑ์ขนาดเป็นผลตามสมการของโมเดลนี้ ไม่ใช่การอนุมัติก่อสร้าง รุ่นพุกและโครงสร้างรองรับเดิมต้องมีข้อมูลกำลังที่ใช้ได้จริง'));
      blocks.push(heading('02 น้ำหนักวัสดุและแรงที่ถ่ายสู่จุดต่อ'));
      const purlinSection=root.NCYSC01Report.purlinSectionBlock(r);
      if(purlinSection)blocks.push(purlinSection);
      blocks.push(...(root.NCYSC01Purlins?.blocks(r)||[]));
      if (!p.direct) blocks.push(table(['น้ำหนักพื้นที่ D / L / R (kN/m²)','ความกว้างรับแรง (m)','น้ำหนักเหล็กกล่อง (kN/m)'],[[`${num(s.loads.deadKPa)} / ${num(s.loads.liveKPa)} / ${num(s.loads.roofKPa)}`,num(s.loads.tributaryM),s.member.includeSelfWeight?num(r.properties.weightKNm):'ไม่รวม']]),
        table(['แรงต่อเมตรจาก Engine','D','L','R','W ยก','H ด้านข้าง'],[['kN/m',...['D','L','R','W','H'].map(key=>num(r.loads?.components?.[key]))]]));
      else blocks.push(note('Direct actions: รับแรงที่หน้าเพลทจากการวิเคราะห์ภายนอก ไม่สมมติแรงกระจายหรือสร้าง SFD/BMD จากแรงปลาย'));
      chunks(r.cases,12).forEach(part=>blocks.push(table(['กรณี','N kN','Vx kN','Vy kN','Mx kN·m','My kN·m','Tz kN·m'],part.map(x=>[esc(x.caseDef.name),...['N','Vx','Vy','Mx','My','Tz'].map(axis=>num(x.action[axis]))]),'c4-cases')));
      blocks.push(heading('03 เหล็กกล่อง: แรงภายในและการแอ่น'),note(`กรณีแสดงรูปแรง: ${c.caseDef.name}; ผล D/C ด้านบนควบคุมแยกรายการ ไม่ใช่ทุกโหมดควบคุมด้วยกรณีนี้`));
      if (!p.truss) {
        blocks.push(h.figure('รูปด้าน / แรงที่จุดต่อ',h.miniSide(r,c),'c4-side'));
        if (!p.direct) blocks.push(`<div class="c4-draw-pair c4-plots">${h.figure('SFD · แรงเฉือน kN',h.miniPlot(r,c,'sfd'))}${h.figure('BMD · โมเมนต์ kN·m',h.miniPlot(r,c,'bmd'))}</div>`);
        const service = !p.direct ? root.NCYV5.serviceCurve(r) : [];
        const curve = curveSVG(service,s.member.lengthM);
        if (curve) blocks.push(h.figure(`การแอ่น · ${r.deflection.caseName||r.deflection.case||'SLS'}`,curve));
      } else blocks.push(note('Truss ใช้ผลสมาชิกและการกระจัดจาก Matrix ไม่ใช้ SFD/BMD ของคานเดี่ยวแทน ดูสมการ Truss และแรงรากบน/ล่างในรายงานนี้'));
      blocks.push(table(['การแอ่นสูงสุด mm','ยอมให้ mm','D/C การแอ่น','กรณีใช้งาน'],[[p.deflectionKnown?num(r.deflection.max):'ยังไม่มีผลการแอ่น',num(r.deflection.allow),p.deflectionKnown?num(r.deflection.ratio):'—',esc(r.deflection.caseName||r.deflection.case||'ข้อมูลภายนอก')]]));
      blocks.push(heading('04 เพลทและพุก: แรงที่ถ่ายจริง'),note(`กรณีแสดง: ${c.caseDef.name}; แรงดึง T และแรงเฉือน V ต่อตัวไม่ใช่ค่าเดียวกับผลกำลังคอนกรีตแบบกลุ่ม`));
      if (p.truss) blocks.push(...root.NCYSC01Report.trussRootBlocks(r));
      else {
        blocks.push(`<div class="c4-draw-pair">${h.figure('ผังเพลท / พุก',h.miniFront(r,c))}${h.figure('แรงพุก / แรงอัดสัมผัส',h.miniMap(r,c))}</div>`,h.allActions(c));
        const cap = c.anchorSteel || {};
        chunks(c.group.forces,12).forEach(part=>blocks.push(table(['พุก','T kN','Vx kN','Vy kN','|V| kN','Ncap kN','Vcap kN','D/C แกนพุก'],part.map(a=>[esc(a.id),num(a.T),num(a.Vx),num(a.Vy),num(a.V),num(cap.Ncap),num(cap.Vcap),num(a.anchorSteel?.inter)]),'c4-anchors')));
        blocks.push(note(`โมเมนต์ทำให้พุกบางตัวรับแรงดึง จึงตรวจดึงและเฉือนร่วมกัน; แรงอัดสัมผัสสูงสุด ${num(c.normal.maxPressure)} MPa ไม่ใช่ความเค้น FE ของแผ่นเพลท`));
      }
      blocks.push(heading('05 สมการ → แทนค่า → ผลคำนวณ'));
      const refs = [...new Set(formulas.map(row=>row.source||row.ref||'ผลจาก Engine'))];
      for (let i=0;i<formulas.length;i+=2) {
        const pair = formulas.slice(i,i+2);
        blocks.push(`<div class="sc01-equation-columns">${pair.map((row,j)=>equation(row,i+j,'R'+String(refs.indexOf(row.source||row.ref||'ผลจาก Engine')+1).padStart(2,'0'))).join('')}</div>`);
      }
      blocks.push(...root.NCYSC01Report.evidenceBlocks(r,formulas),heading('06 ฐานคำนวณและข้อมูลกำลังที่ใช้'));
      if(!p.truss) blocks.push(h.inputSummary(s));
      chunks(refs.map((text,i)=>`R${String(i+1).padStart(2,'0')}: ${text}`),2).forEach(pair=>blocks.push(`<div class="sc01-equation-columns sc01-reference-columns">${pair.map(text=>note(text)).join('')}</div>`));
      blocks.push(note(`พุก ${s.product.name||'ยังไม่ระบุรุ่น'} · รายงาน ${s.product.report||'ยังไม่ระบุ'} · hef ${s.anchors.hef} mm · f′c ${s.concrete.fc} MPa · ${s.concrete.cracked?'คอนกรีตแตกร้าว':'คอนกรีตไม่แตกร้าว'}`),note('โหลด ลม สภาพโครงสร้างเดิม รุ่นพุก/เงื่อนไขติดตั้ง และรายละเอียดรอยเชื่อมเป็นขอบเขตจำเป็น ผลรวมนี้ไม่อนุมัติก่อสร้าง; BOQ และแบบ CAD เปิดแยกจากรายการคำนวณ'));
      if (s.meta.notes) chunks([...String(s.meta.notes)],350).forEach(chars=>blocks.push(note(chars.join(''))));
      blocks.push(`<div class="c4-signatures"><div>จัดทำ: ${esc(s.meta.designer||'________________')}<br>ลายมือชื่อ __________________</div><div>ตรวจ: ${esc(s.meta.checker||'________________')}<br>ลายมือชื่อ __________________</div></div>`);
      if(h.options?.includeInputs && h.appendixRows) {
        blocks.push(heading('ภาคผนวก · ข้อมูลนำเข้าทั้งหมด'));
        chunks(h.appendixRows(s),18).forEach(part=>blocks.push(`<table class="c4-table c4-input-appendix"><thead><tr><th>ตัวแปร</th><th>ค่า</th><th>หน่วย</th></tr></thead><tbody>${part.join('')}</tbody></table>`));
      }
      blocks.push(root.NCYSC01Report.selectedSteelBlock(r));
      P.add('รายการคำนวณ · น้ำหนัก → เหล็ก → เพลท → พุก',blocks);
      return P.done();
    } catch (error) { P.done(); throw error; }
  }
  root.NCYSC01LoadPath = Object.freeze({VERSION:'r24',family,advice,project,summaryHTML,curveSVG,report});
  if (root.document?.body) root.document.body.dataset.sc01LoadPath='r24';
})(typeof window === 'undefined' ? globalThis : window);
