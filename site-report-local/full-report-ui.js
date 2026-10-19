/* Optional form sections. Values are entered by the reporter, not approvals. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const laborLabels = {engineer:'วิศวกร / ผู้ควบคุมงาน',foreman:'โฟร์แมน',formwork:'ช่างไม้แบบ',rebar:'ช่างเหล็ก',mason:'ช่างก่อ',systems:'ช่างระบบ',general:'คนงานทั่วไป',other:'ผู้รับเหมาช่วงอื่น'};
  const materialPresets = Object.freeze([
    {id:'ready-concrete',name:'คอนกรีตผสมเสร็จ',unit:'ม³',group:'material'},
    {id:'rebar',name:'เหล็กเสริม',unit:'กก.',group:'material'},
    {id:'cement',name:'ปูนซีเมนต์',unit:'ถุง',group:'material'},
    {id:'sand',name:'ทราย',unit:'ม³',group:'material'},
    {id:'aggregate',name:'หิน',unit:'ม³',group:'material'},
    {id:'blocks',name:'อิฐ / บล็อก',unit:'ก้อน',group:'material'},
    {id:'formwork',name:'ไม้แบบ',unit:'ม²',group:'material'},
    {id:'piping',name:'ท่อ / อุปกรณ์ระบบ',unit:'ชุด',group:'material'},
    {id:'excavator',name:'รถขุด',unit:'คัน',group:'equipment'},
    {id:'crane',name:'รถเครน',unit:'คัน',group:'equipment'},
    {id:'mixer-truck',name:'รถโม่คอนกรีต',unit:'คัน',group:'equipment'},
    {id:'concrete-pump',name:'รถปั๊มคอนกรีต',unit:'คัน',group:'equipment'},
    {id:'vibrator',name:'เครื่องสั่นคอนกรีต',unit:'เครื่อง',group:'equipment'},
    {id:'rebar-machine',name:'เครื่องตัด / ดัดเหล็ก',unit:'เครื่อง',group:'equipment'},
  ].map(preset => Object.freeze(preset)));
  const valueAt = (data, path) => path.split('.').reduce((v,k) => v?.[k], data) ?? '';
  function field(data, path, label, type = 'text', choices = null) {
    const value = valueAt(data,path), attr = `data-full-field="${esc(path)}"`;
    const input = choices ? `<select ${attr}><option value="">ยังไม่ระบุ</option>${choices.map(([v,l])=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(l)}</option>`).join('')}</select>` : type === 'textarea' ? `<textarea ${attr} maxlength="10000" rows="2">${esc(value)}</textarea>` : `<input ${attr} type="${type==='percent'||type==='count'||type==='quantity'?'text':type}" ${['percent','count','quantity'].includes(type)?`inputmode="${type==='count'?'numeric':'decimal'}" data-full-number="${type}" maxlength="32"`: 'maxlength="500"'} value="${esc(value)}" placeholder="${['time','date','datetime-local'].includes(type)?'':'ยังไม่ระบุ'}">`;
    return `<label class="sr-field">${esc(label)}${input}</label>`;
  }
  const grid = (body,extraClass='') => `<div class="sr-full-grid${extraClass?' '+extraClass:''}">${body}</div>`;
  const section = (key,title,hint,body) => `<details class="sr-details sr-full-section" data-full-section="${key}"><summary>${title}<small>${hint}</small></summary><div class="sr-details-body">${body}</div></details>`;
  const sheetSection = (key,title,body) => `<section class="sr-sheet-section" data-full-section="${key}"><h2>${title}</h2>${body}</section>`;
  function company(data) {
    return section('company','ผู้เกี่ยวข้อง / หัวรายงาน','กรอกครั้งเดียวในขั้นตั้งค่า · ไม่บังคับ',grid(field(data,'ownerName','เจ้าของโครงการ')+field(data,'contractorName','ผู้รับเหมา')+field(data,'companyName','ชื่อบริษัท / หน่วยงาน')+field(data,'companyEnglish','ชื่อภาษาอังกฤษ')+field(data,'companyService','คำอธิบายบริษัท')+field(data,'formCode','รหัสแบบฟอร์ม')+field(data,'formRevision','Revision ของแบบฟอร์ม')+field(data,'reportNumber','เลขที่รายงานของผู้ใช้'))+`<div class="sr-logo-row">${data.logo?`<img class="sr-company-logo" src="${esc(data.logo.src)}" alt="โลโก้ที่แนบในร่างนี้"><button type="button" class="sr-button" data-full-action="remove-logo">นำโลโก้ออก</button>`:''}<label class="sr-field">${data.logo?'เปลี่ยน':'แนบ'}โลโก้<input type="file" data-full-logo accept="image/jpeg,image/png,image/webp"><small>JPG / PNG / WebP ≤1 MB และด้านละไม่เกิน 1920 px · เก็บกับร่างนี้ ไม่ใช้ข้ามโครงการอัตโนมัติ</small></label></div>`);
  }
  function laborSummary(data, legacy) {
    let result;
    try { result = globalThis.SiteReportFullReport.workforce(data.labor); } catch { return 'ตรวจจำนวนแรงงาน: จำนวนเต็ม 0–9999 หรือเว้นว่าง'; }
    return `${result.total===null?'ยังไม่ระบุแรงงานแยกประเภท':`${result.complete?'รวมแรงงานทั้งหมด':'รวมที่ระบุ'} ${result.total} คน${result.complete?'':` · ยังไม่ระบุ ${8-result.filled} ประเภท`}`}${legacy!==''?` · ยอดรวมที่กรอกแยกไว้เดิม: ${legacy} คน`:''}`;
  }
  function followupRows(data) {
    const rows=data.followups.map((row,index)=>{
      const p=`followups.${index}.`;
      const facts=[row.responsible,row.due,row.priority,row.status].filter(value=>String(value||'').trim()).length;
      return `<details class="sr-details sr-compact-details sr-row-disclosure" data-full-section="followup-${esc(row.id)}"><summary><span data-compact-title>${esc(row.title||`งานติดตาม ${index+1}`)}</span><small data-compact-summary>${facts?`มีรายละเอียด ${facts} ช่อง`:'ยังไม่ระบุรายละเอียด'}</small></summary><div class="sr-details-body"><fieldset class="sr-full-row sr-followup-row"><legend>งานติดตาม ${index+1}</legend>${grid(field(data,p+'title','ประเด็น / งานค้าง','textarea')+field(data,p+'responsible','ผู้รับผิดชอบ')+field(data,p+'due','กำหนดเสร็จ','date')+field(data,p+'priority','ความสำคัญ','text',[['low','ต่ำ'],['normal','กลาง'],['high','สูง']])+field(data,p+'status','สถานะ','text',[['open','รอดำเนินการ'],['doing','กำลังแก้ไข'],['done','เสร็จตามรายงาน']]),'sr-followup-row-grid')}<button type="button" class="sr-link-button" data-full-action="remove-row" data-full-list="followups" data-row-id="${esc(row.id)}">ลบงานติดตาม ${index+1}</button></fieldset></div></details>`;
    }).join('');
    return `${rows||'<p class="sr-sub">ยังไม่ระบุงานติดตาม</p>'}<button type="button" class="sr-button" data-full-action="add-row" data-full-list="followups" ${data.followups.length>=12?'disabled':''}>+ เพิ่มงานติดตาม (${data.followups.length}/12)</button>`;
  }
  function materialRows(data) {
    const rows=data.materials.map((row,index)=>{
      const p=`materials.${index}.`;
      const amount=[row.quantity,row.unit].filter(value=>String(value||'').trim()).join(' ');
      const details=[amount,row.usage,row.status].filter(value=>String(value||'').trim());
      return `<details class="sr-details sr-compact-details sr-row-disclosure sr-material-row" data-material-row="${esc(row.id)}" data-full-section="material-${esc(row.id)}"><summary><span data-compact-title>${esc(row.name||`วัสดุ / เครื่องจักร ${index+1}`)}</span><small data-compact-summary>${details.length?esc(details.join(' · ')):'ยังไม่ระบุรายละเอียด'}</small></summary><div class="sr-details-body"><fieldset class="sr-full-row sr-material-row-fields"><legend>วัสดุ / เครื่องจักร ${index+1}</legend>${grid(field(data,p+'name','รายการ')+field(data,p+'quantity','จำนวน','quantity')+field(data,p+'unit','หน่วย')+field(data,p+'usage','การใช้งาน / รับเข้า','textarea')+field(data,p+'status','สถานะ / หมายเหตุ','textarea'),'sr-material-row-grid')}<button type="button" class="sr-link-button" data-full-action="remove-row" data-full-list="materials" data-row-id="${esc(row.id)}">ลบวัสดุ / เครื่องจักร ${index+1}</button></fieldset></div></details>`;
    }).join('');
    return `<div class="sr-material-rows">${rows||'<p class="sr-sub">ยังไม่เลือกวัสดุหรือเครื่องจักร</p>'}</div><button type="button" class="sr-button" data-full-action="add-row" data-full-list="materials" ${data.materials.length>=12?'disabled':''}>+ เพิ่มรายการอื่น (${data.materials.length}/12)</button>`;
  }
  function materialChoices(data) {
    return `<p class="sr-sub">ติ๊กรายการที่ใช้งานวันนี้ แล้วกรอกจำนวนและรายละเอียดตามจริง · รวมไม่เกิน 12 รายการ</p><div class="sr-material-preset-groups">${[['material','วัสดุ'],['equipment','เครื่องจักร']].map(([group,title])=>`<fieldset class="sr-material-presets"><legend>${title}</legend><div class="sr-material-choice-grid">${materialPresets.filter(preset=>preset.group===group).map(preset=>{
      const presetId=`preset-${preset.id}`;
      const checked=data.materials.some(row=>row.id===presetId);
      const existingIndex=data.materials.findIndex(row=>row.id!==presetId && String(row.name).trim()===preset.name);
      const duplicate=!checked && existingIndex>=0;
      const disabled=!checked && (duplicate || data.materials.length>=12);
      const hint=duplicate?`มีรายการเดิมแล้ว: แก้ไขวัสดุ / เครื่องจักร ${existingIndex+1} ด้านล่าง`:disabled?'ครบ 12 รายการแล้ว นำรายการที่ไม่ใช้ออกก่อนเพิ่ม':'';
      return `<label class="sr-material-choice${checked?' is-checked':''}${disabled?' is-unavailable':''}"${hint?` title="${esc(hint)}"`:''}><input type="checkbox" data-material-preset="${preset.id}" ${checked?'checked':''} ${disabled?'disabled':''}><span>${esc(preset.name)}<small>${duplicate?'มีรายการเดิมแล้ว':esc(preset.unit)}</small></span></label>`;
    }).join('')}</div></fieldset>`).join('')}</div>`;
  }
  // Bodies only: the entry screen owns sheet order, headings and disclosure state.
  function sheetParts(data,legacy='') {
    const siteCore=grid(field(data,'workStart','เริ่มปฏิบัติงาน','time')+field(data,'workEnd','สิ้นสุดปฏิบัติงาน','time')+field(data,'plannedOverall','แผนสะสมรวม (%)','percent')+field(data,'actualOverall','ผลงานจริงสะสมรวม (%)','percent'),'sr-site-core-grid')+'<p class="sr-sub">แผนและผลจริงเป็นค่าสะสมรวมของโครงการ · ผลต่าง = ผลจริง − แผน</p>';
    const siteMore=grid(field(data,'weatherMorning','สภาพอากาศช่วงเช้า')+field(data,'weatherAfternoon','สภาพอากาศช่วงบ่าย')+field(data,'rain','ฝน / ผลกระทบ'),'sr-site-more-grid');
    const quality='<p class="sr-sub">บันทึกตามที่พบ ไม่ใช่ใบตรวจรับหรือการรับรอง ช่องว่างไม่ถือว่าผ่านตรวจ</p>'+grid(field(data,'quality','การตรวจคุณภาพ / ผลที่รายงาน','textarea')+field(data,'safetyIncident','อุบัติเหตุ / รายละเอียด','textarea')+field(data,'nearMiss','Near miss / เหตุเกือบเกิดอุบัติเหตุ','textarea')+field(data,'ppe','PPE / อุปกรณ์ป้องกัน','textarea')+field(data,'toolboxTime','เวลา Toolbox meeting','time')+field(data,'scheduleImpact','ผลกระทบต่อแผน','textarea')+field(data,'coordination','หมายเหตุ / การประสานงาน','textarea'),'sr-quality-grid');
    return {
      site: siteCore+siteMore,
      siteCore,
      siteMore,
      labor: grid(Object.entries(laborLabels).map(([k,l])=>field(data,'labor.'+k,l+' (คน)','count')).join(''),'sr-labor-grid')+`<p class="sr-full-total" data-labor-total>${esc(laborSummary(data,legacy))}</p>`,
      followups: followupRows(data),
      materials: materialChoices(data)+materialRows(data),
      quality,
      signatures: grid(field(data,'signatures.preparer','ชื่อผู้จัดทำรายงาน')+field(data,'signatures.preparerDate','วันที่ผู้จัดทำระบุ','date')+field(data,'signatures.supervisor','ชื่อผู้ควบคุมงาน')+field(data,'signatures.supervisorDate','วันที่ผู้ควบคุมงานระบุ','date')+field(data,'signatures.ownerRepresentative','ชื่อผู้แทนเจ้าของงาน')+field(data,'signatures.ownerRepresentativeDate','วันที่ผู้แทนเจ้าของงานระบุ','date'))+'<p class="sr-report-note">ชื่อและวันที่ที่พิมพ์ไม่ใช่ลายเซ็นอิเล็กทรอนิกส์ และไม่ใช่การอนุมัติหรือรับรองงาน</p>',
    };
  }
  function details(data,legacy='') {
    const parts=sheetParts(data,legacy);
    return `<section class="sr-full-form"><h2>รายละเอียดรายงานเต็มรูปแบบ</h2><p class="sr-sub">เติมเฉพาะหัวข้อที่ใช้ · ระบบไม่ถือว่าช่องว่างเป็นศูนย์หรือผ่านตรวจ</p>${sheetSection('site','ข้อมูลหน้างานและแผนรวม',parts.site)}${sheetSection('labor','แรงงานประจำวัน',parts.labor)}${sheetSection('followups','งานติดตามจากวันก่อน',parts.followups)}${sheetSection('materials','วัสดุและเครื่องจักร',parts.materials)}${sheetSection('quality','คุณภาพ ความปลอดภัย และการประสานงาน',parts.quality)}${section('signatures','ผู้เกี่ยวข้องกับรายงาน','พิมพ์ชื่อและวันที่ได้ · ช่องลงนามยังเป็นช่องว่าง',parts.signatures)}</section>`;
  }
  function task(data,id) {
    return section('progress-'+id,'แผนเทียบผลจริงของงานนี้','เปอร์เซ็นต์สะสม · ไม่บังคับ',grid(field(data,`progress.${id}.planned`,'แผนสะสม (%)','percent')+field(data,`progress.${id}.actual`,'ผลงานจริงสะสม (%)','percent')));
  }
  function photo(data,id) {
    return section('photo-'+id,'ข้อมูลภาพเพิ่มเติม','ผู้ถ่าย · เวลาที่ระบุเอง · สภาพที่รายงาน',grid(field(data,`photoDetails.${id}.capturedAt`,'วันเวลาถ่ายที่ผู้บันทึกระบุเอง','datetime-local')+field(data,`photoDetails.${id}.photographer`,'ผู้ถ่ายที่ระบุ')+field(data,`photoDetails.${id}.condition`,'สภาพที่รายงาน','text',[['normal','ปกติ'],['watch','เฝ้าระวัง'],['issue','มีประเด็น']]))+'<p class="sr-sub">วันเวลานี้กรอกเอง ไม่ได้ตรวจ EXIF / GPS และไม่แทนเวลานำเข้าภาพ</p>');
  }
  function summary(data,legacy) {
    let delta=null; try {delta=globalThis.SiteReportFullReport.progress(data.plannedOverall,data.actualOverall);} catch { /* validation surfaces on save */ }
    return `<section class="sr-section"><h2>รายละเอียดเต็มรูปแบบใน PNG / A4</h2><dl class="sr-report-meta"><div class="sr-meta-row"><dt>บริษัท</dt><dd>${esc(data.companyName||'ยังไม่ระบุ')}</dd></div><div class="sr-meta-row"><dt>แผน / ผลจริง</dt><dd>${esc(data.plannedOverall||'ยังไม่ระบุ')} / ${esc(data.actualOverall||'ยังไม่ระบุ')} %${delta===null?'':` · ${delta>0?'+':''}${delta} จุดเปอร์เซ็นต์`}</dd></div><div class="sr-meta-row"><dt>แรงงาน</dt><dd>${esc(laborSummary(data,legacy))}</dd></div><div class="sr-meta-row"><dt>รายการเพิ่มเติม</dt><dd>งานติดตาม ${data.followups.length} · วัสดุ / เครื่องจักร ${data.materials.length}</dd></div></dl><p class="sr-sub">ตรวจตารางและข้อมูลทุกหน้าในตัวอย่างไฟล์ก่อนส่ง ช่องลงนามยังไม่ลงนาม</p></section>`;
  }
  globalThis.SiteReportFullReportUI=Object.freeze({company,details,task,photo,summary,laborSummary,sheetParts,materialPresets,materialRows});
})();
