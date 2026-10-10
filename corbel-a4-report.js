/* Native-result paper projection only. No solver, rebar selection or verdict writes. */
(function (global) {
  'use strict';
  const VERSION = '20261008-03';
  const pending = new WeakMap();
  const esc = value => String(value ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (value, digits = 3) => {
    if(value===null || value===undefined || value==='')return '—';
    const numeric=Number(value);
    if(numeric===Infinity)return '∞';if(numeric===-Infinity)return '−∞';
    return Number.isFinite(numeric)?numeric.toLocaleString('en-US',{maximumFractionDigits:digits}):'—';
  };
  function element(tag, className, html) {
    const node = document.createElement(tag); node.className = className || '';
    if (html !== undefined) node.innerHTML = html;
    return node;
  }
  function block(title, htmlOrNode) {
    const numbered = /^(\d+)[. ·]+(.+)$/.exec(title);
    const heading = numbered ? '<i>'+esc(numbered[1])+'</i>'+esc(numbered[2]) : esc(title);
    const node = element('section', 'ncy-a4-block', '<h3 class="ncy-a4-block-title">'+heading+'</h3>');
    if (typeof htmlOrNode === 'string') node.insertAdjacentHTML('beforeend', htmlOrNode);
    else if (htmlOrNode) node.append(htmlOrNode);
    return node;
  }
  function row(nodes) { const node = element('div', 'ncy-a4-row'); node.append(...nodes); return node; }
  function clone(node) { return node?.cloneNode(true) || element('div'); }
  function project(meta) {
    const fields = [ ['ชื่อโครงการ',meta.project],['เจ้าของงาน',meta.owner],['ผู้คำนวณ',meta.prepared],['ผู้ตรวจสอบ',meta.checked],['เลขที่แบบ',meta.drawing],['วันที่',meta.date],['มาตรฐานอ้างอิง',meta.standard],['ตำแหน่ง / Mark',meta.mark] ];
    return element('section','ncy-a4-project',fields.map(([label,value])=>'<div><span>'+esc(label)+'</span><b>'+esc(String(value || '').trim() || '—')+'</b></div>').join(''));
  }
  function summary(values) { return element('section','ncy-a4-summary',values.map(([label,value,state])=>'<div><span>'+esc(label)+'</span><b'+(state?' class="state-'+esc(state)+'"':'')+'>'+esc(value)+'</b></div>').join('')); }
  function page(meta) {
    const node = element('article','ncy-a4-page');
    node.dataset.snapshotId = meta.snapshot; node.dataset.reportVersion = VERSION;
    node.innerHTML = '<header class="ncy-a4-head"><div><div class="ncy-a4-brand">นายช่างใหญ่ Civil Apps</div><h2 class="ncy-a4-title">'+esc(meta.title)+'</h2><div class="ncy-a4-sub">'+esc(meta.code)+' · '+esc(meta.english)+'</div></div>'
      +'<div class="ncy-a4-head-right"><b>'+esc(meta.document)+'</b><span data-paper-page></span><br><span class="ncy-a4-status"><span class="state-'+esc(meta.verdict)+'">'+esc(meta.status)+'</span> · REVIEW</span><br>'+esc(meta.scope)+'</div></header>'
      +'<div class="ncy-a4-content"></div><footer class="ncy-a4-foot"><span>'+esc(meta.snapshot)+' · '+esc(meta.date)+' · PDF '+VERSION+'</span><span data-paper-page></span><span class="ncy-a4-authority">'+esc(meta.authority)+'</span></footer>';
    return node;
  }
  /* Measure physical paper outside hidden Flow panels. Never shrink to fit.
     A generation token AND native currentness prevent delayed fonts reviving stale output. */
  function publish(mount, meta, blocks, current) {
    const token = {}; pending.set(mount, token);
    mount.dataset.paperReady = 'loading';
    const loading=block('กำลังจัดหน้ารายงาน A4','รอฟอนต์และการแบ่งหน้า ก่อนพิมพ์ / Save PDF');
    mount.replaceChildren(loading);
    const printButton=document.getElementById('printReportBtn');if(printButton)printButton.disabled=true;
    // Preview and print use the SAME isolated paper document. App CSS and mobile
    // media queries cannot change equation sizes or pagination in only one view.
    const holder=element('div');holder.style.cssText='position:fixed;left:-10000px;top:0;width:210mm;visibility:hidden;pointer-events:none;';
    const frame=document.createElement('iframe');frame.title='รายงาน A4 หูช้างจาก Snapshot ปัจจุบัน';
    frame.style.cssText='width:210mm;min-width:210mm;height:1200px;border:0;display:block;';
    frame.src='/corbel-a4-print.html?v='+VERSION;
    const outputFrame=document.createElement('iframe');outputFrame.title=frame.title;outputFrame.style.cssText=frame.style.cssText;outputFrame.src=frame.src;
    const outputLoaded=new Promise(resolve=>outputFrame.addEventListener('load',resolve,{once:true}));
    mount.append(outputFrame);
    const build = async () => {
      if (pending.get(mount) !== token || !current()) {holder.remove();return;}
      const paperDoc=frame.contentDocument,stage=paperDoc.getElementById('paper');
      if(!stage){holder.remove();mount.dataset.paperReady='error';return;}
      await Promise.all([400,600,700].map(weight=>paperDoc.fonts.load(weight+' 9pt NCYReportSarabun','ภาษาไทย V M')));
      await paperDoc.fonts.ready;
      if(pending.get(mount)!==token || !current()){holder.remove();return;}
      let paper = page(meta); stage.append(paper);
      let content = paper.querySelector('.ncy-a4-content');
      const next = () => { paper = page(meta); stage.append(paper); content = paper.querySelector('.ncy-a4-content'); };
      const fits = () => content.scrollHeight <= content.clientHeight + 1;
      try {
        global.CorbelA4DrawingLayout.prepare(stage,meta,blocks,page);
        const place = item => {
          if (item.dataset.newPage === 'true' && content.children.length) next();
          content.append(item);
          if (!fits() && content.children.length > 1) { item.remove(); next(); content.append(item); }
          if (!fits()) {
            const parts = split(item);
            if (parts.length > 1 || (parts.length === 1 && parts[0] !== item)) {
              item.remove(); parts.forEach(place);
            } else throw new Error('A4 evidence exceeds a page: '+item.textContent.slice(0,80));
          }
        };
        blocks.forEach(place);
        const pages = [...stage.children];
        pages.forEach((p,index)=>{p.dataset.reportPage=String(index+1);p.querySelectorAll('[data-paper-page]').forEach(n=>{n.textContent='หน้า '+(index+1)+' / '+pages.length;});});
        if (!current() || pending.get(mount) !== token) return;
        const paperHeight=paperDoc.documentElement.scrollHeight;
        await outputLoaded;
        if(!current() || pending.get(mount)!==token)return;
        const outputDoc=outputFrame.contentDocument;
        outputDoc.getElementById('paper').innerHTML=stage.innerHTML;
        await Promise.all([400,600,700].map(weight=>outputDoc.fonts.load(weight+' 9pt NCYReportSarabun','ภาษาไทย V M')));
        await outputDoc.fonts.ready;
        if(!current() || pending.get(mount)!==token)return;
        outputFrame.style.height=paperHeight+'px';loading.remove();
        mount.classList.add('ncy-a4-book');
        mount.dataset.snapshotId = meta.snapshot; mount.dataset.paperReady = 'ready';
        mount.dataset.pageCount = String(pages.length);
        if(printButton)printButton.disabled=false;
        mount.dispatchEvent(new CustomEvent('ncy-a4-ready', {bubbles:true,detail:{snapshotId:meta.snapshot,pages:pages.length}}));
      } catch (error) {
        mount.dataset.paperReady = 'error';
        mount.replaceChildren(block('รายงานยังจัดหน้าไม่สำเร็จ', '<p>กรุณาคำนวณใหม่ก่อนพิมพ์ · '+esc(error.message)+'</p>'));
        console.error(error);
      } finally { holder.remove(); }
    };
    frame.addEventListener('load',()=>build().catch(error=>{holder.remove();mount.dataset.paperReady='error';console.error(error);}),{once:true});
    holder.append(frame);document.body.append(holder);
  }
  function split(item) {
    if(item.classList.contains('ncy-a4-sections-sheet'))return [...item.children];
    if(item.matches('.ncy-a4-overview-row,.ncy-a4-cut-row'))return [...item.children].map(fig=>{
      // Retain the already measured paper width and text size when a row splits.
      fig.style.width=fig.dataset.paperWidthPx+'px';fig.style.maxWidth='100%';fig.style.alignSelf='center';return fig;
    });
    if(item.classList.contains('ncy-a4-cad-figure')){
      const caption=item.querySelector('figcaption'),svg=item.querySelector('svg');
      const notes=[...item.querySelectorAll('.ncy-a4-cad-key-entry,.ncy-a4-cad-notes p')];
      if(svg&&notes.length)return [svg,...notes].map(part=>{
        const shell=item.cloneNode(false);shell.append(clone(caption),part);return shell;
      });
    }
    if(item.classList.contains('ncy-a4-cut-notes'))return [...item.children];
    const table = item.querySelector('table');
    if (table && table.tBodies[0]?.rows.length > 1) {
      return [...table.tBodies[0].rows].map(tr=>{
        const shell = clone(item); const target=shell.querySelector('tbody'); target.replaceChildren(clone(tr)); return shell;
      });
    }
    return [item];
  }
  function tableBlocks(title, source, size=5) {
    const rows=[...source.tBodies[0].rows], result=[];
    for(let i=0;i<rows.length;i+=size) {
      const table=clone(source); table.tBodies[0].replaceChildren(...rows.slice(i,i+size).map(clone));
      if(source.querySelector('#reportCheckRows'))table.classList.add('ncy-check-ledger');
      result.push(block(title+(i?' · ต่อ':''),table));
    }
    return result;
  }
  function corbelCheckUnit(id) {
    return id==='flexure'?'N·mm':['primary-steel','closed-ties'].includes(id)?'mm²':['tip-depth','nose-anchor','support-anchor'].includes(id)?'mm':['scope-avd','scope-nv'].includes(id)?'ratio':'N';
  }
  function checkCriterion(check,result) {
    const extra=check.id==='flexure'?' · มีชุดเหล็กที่ Engine ตรวจได้ และ Af,req '+number(result.required.afMm2)+' ≤ Af,limit '+number(result.required.afLimitMm2)+' mm²':
      ['shear-friction','primary-steel','nose-anchor','support-anchor'].includes(check.id)?' · ต้องมีชุดเหล็กหลักที่ Engine ตรวจได้':
      check.id==='closed-ties'?' · ต้องมีชุดปลอกที่ Engine ตรวจได้':'';
    return 'Demand ≤ Capacity'+extra;
  }
  /* These are unchanged native engine equations, printed with snapshot operands.
     The projection never uses their evaluation to select steel or set a status. */
  function corbelEquations(s,result) {
    const q=result.required,p=result.provided,i=result.input,c=result.code, n=number;
    const phi=c.phiCorbel, phib=c.phiBearing;
    return [
      ['Aₙ · แรงแนวนอน','Aₙ = Nᵤ / (φ fᵧ)', n(s.nucKg)+' × 9.80665 / ('+phi+' × '+n(i.fyMpa)+')',n(q.anMm2)+' mm²','16.5.4'],
      ['Aᵥf · shear-friction','Aᵥf = Vᵤ / (φ μ min(fᵧ,420))',n(s.vuKg)+' × 9.80665 / ('+phi+' × '+n(p.mu)+' × '+n(p.fyShearMpa)+')',n(q.avfMm2)+' mm²','16.5.4.4 / 22.9'],
      ['Aₛ · เหล็กหลัก','Aₛ,req = max(Af + Aₙ, 2Aᵥf/3 + Aₙ, 0.04 f′c b d / fᵧ)', 'max('+n(q.afMm2)+' + '+n(q.anMm2)+', 2 × '+n(q.avfMm2)+'/3 + '+n(q.anMm2)+', '+n(q.asMinMm2)+')',n(q.asMm2)+' mm²','16.5.5.1'],
      ['Aₕ · ปลอกปิดแนวนอน','Aₕ,req = max(0, 0.5(Aₛ,req − Aₙ))','max(0, 0.5 × ('+n(q.asMm2)+' − '+n(q.anMm2)+'))',n(q.ahMm2)+' mm²','16.5.5.2'],
      ['เพดานกำลังเฉือน','φVₙ,max = φ min(0.2f′c, 3.3+0.08f′c, 11) b d',phi+' × min(0.2 × '+n(i.fcMpa)+', 3.3 + 0.08 × '+n(i.fcMpa)+', 11) × '+n(i.widthMm)+' × '+n(i.depthMm),n(p.phiVnMaxN)+' N','16.5.2.4'],
      ['กำลัง shear-friction','φVₙ = min(φ μ · max(0,1.5(Aₛ,prov−Aₙ)) fᵧ,shear, φVₙ,max)',phi+' × '+n(p.mu)+' × max(0, 1.5 × ('+(p.main?n(p.main.providedMm2):'ไม่มีชุดเหล็ก')+' − '+n(q.anMm2)+')) × '+n(p.fyShearMpa)+'; limit '+n(p.phiVnMaxN)+' N',n(p.phiVnN)+' N','16.5.4.4 / 22.9'],
      ['กำลังดัดที่หน้าคาน','A = max(0,Aₛ,prov−Aₙ); a = A fᵧ/(0.85f′c b); φMₙ = φ A fᵧ(d−a/2)', 'Aₛ,prov '+(p.main?n(p.main.providedMm2):'ไม่มีชุดเหล็ก')+'; Aₙ '+n(q.anMm2)+' mm²; φ '+phi+'; fᵧ '+n(i.fyMpa)+'; f′c '+n(i.fcMpa)+' MPa; b '+n(i.widthMm)+'; d '+n(i.depthMm)+' mm',n(p.phiMnNmm)+' N·mm','16.5.4.5 / 22.2'],
      ['กำลังรับแรงกด','φBₙ = φbearing · 0.85 f′c b t_wall',phib+' × 0.85 × '+n(i.fcMpa)+' × '+n(i.widthMm)+' × '+n(i.wallThicknessMm),n(p.phiBearingN)+' N · qᵤ '+n(p.bearingStressMpa)+' MPa','ACI 22.8 CROSS-CHECK']
    ];
  }
  function corbel(source,mount,s,result,current) {
    source.classList.add('ncy-report-source');source.style.display='none';
    const meta={title:'รายงานการคำนวณหูช้าง',english:'RC CORBEL · LOCAL CROSS-CHECK',code:'CB-01',document:s.snapshotId,snapshot:s.snapshotId,
      date:new Date(s.createdAt).toLocaleString('th-TH',{dateStyle:'medium',timeStyle:'short'}),project:'',owner:'',prepared:'',checked:'',drawing:'',standard:result.code.code+' · '+result.code.projectBasis,mark:s.memberId,
      verdict:s.verdict,status:'LOCAL '+s.verdict.toUpperCase(),scope:'เฉพาะหูช้าง / ไม่รับรองจุดต่อ',authority:'BETA · NOT FOR CONSTRUCTION · ผลเบื้องต้น ต้องให้วิศวกรตรวจรับก่อนก่อสร้าง'};
    const blocks=[project(meta),summary([['ผลตรวจเฉพาะหูช้าง',meta.status,s.verdict],['Vᵤ',number(s.vuKg)+' kgf'],['Nᵤ',number(s.nucKg)+' kgf'],['Mᵤ',number(s.muKgm)+' kgf·m']]),clone(source.querySelector('#reportVerdictBanner'))];
    const drawing=source.querySelector('#reportSectionDrawing');
    if(!global.CorbelA4DrawingLayout)throw new Error('ไม่พบรูปแบบ Section A4');
    blocks.push(...global.CorbelA4DrawingLayout.blocks(drawing));
    const ledger=drawing.querySelector('[data-cad-ledger]');
    if(ledger)blocks.push(block('01.'+(drawing.querySelectorAll('svg[data-cad-view]').length+1)+' · ตารางมิติเหล็กและชั้นปลอก',clone(ledger)));
    blocks.push(...tableBlocks('02 · ข้อมูลและที่มาน้ำหนัก / geometry / material',source.querySelector('#reportInputRows').closest('table'),4));
    blocks.push(block('03 · น้ำหนักและแรงที่หน้าคาน · สมการ / แทนค่า / ผล',clone(source.querySelector('#reportFormula'))));
    blocks.push(block('SFD / BMD','<b>ไม่มีผลวิเคราะห์ SFD/BMD</b><p>Engine นี้ให้แรงที่หน้าคานและตรวจหูช้างเฉพาะที่ ไม่ได้ส่งผลแรงตามตำแหน่งองค์อาคาร จึงไม่มีกราฟและตารางจุดวิกฤตจากการวิเคราะห์คาน</p>'));
    blocks.push(...tableBlocks('04 · เหล็กที่เลือก / ผลตรวจเฉพาะหูช้าง',source.querySelector('#reportResultRows').closest('table'),5));
    const equations=corbelEquations(s,result);
    for(let k=0;k<equations.length;k+=2)blocks.push(row(equations.slice(k,k+2).map(([title,equation,substitution,answer,clause],j)=>block((k+j+1)+'. '+title,'<div class="ncy-a4-equation">สูตร: '+esc(equation)+'</div><div class="ncy-a4-equation">แทนค่า: '+esc(substitution)+'</div><div class="ncy-a4-equation"><b>ผลจาก Engine: '+esc(answer)+'</b></div><small>อ้างอิง '+esc(clause)+' · ผลเฉพาะที่ / preliminary</small>'))));
    const checks=result.checks.map((check,index)=>block((index+1)+'. '+check.label,
      '<div class="ncy-a4-equation">เกณฑ์ Engine: '+esc(checkCriterion(check,result))+'</div><div class="ncy-a4-equation">Demand '+number(check.demand)+' / Capacity '+number(check.capacity)+' '+corbelCheckUnit(check.id)+'</div><div class="ncy-a4-equation"><b>D/C '+number(check.utilization)+' · <span class="state-'+esc(check.status)+'">'+esc(check.status.toUpperCase())+'</span></b></div><small>'+esc(check.clause)+(check.note?' · '+esc(check.note):'')+'</small>'));
    blocks.push(block('05 · ตรวจสอบกำลังและขอบเขต','สถานะและ Demand / Capacity / D/C จาก result.checks ชุดเดิม รวมเกณฑ์ที่ Engine ตรวจเพิ่มเติม'));
    for(let k=0;k<checks.length;k+=2)blocks.push(row(checks.slice(k,k+2)));
    blocks.push(...tableBlocks('Local cross-check ledger · หลักฐานเดิมครบทุกข้อ',source.querySelector('#reportCheckRows').closest('table'),6));
    const last=block('สรุปผล / ข้อจำกัด / แหล่งอ้างอิง','<p><b>'+esc(meta.status)+' · Utilization สูงสุด '+number(result.utilization)+'</b> · สถานะเอกสาร REVIEW / NOT FOR CONSTRUCTION</p><p>'+esc(result.code.code)+' · '+esc(result.code.projectBasis)+' · ต้องตรวจยืนยัน clause และ envelope โดยวิศวกรผู้รับผิดชอบ</p>'+(result.warnings || []).map(w=>'<p>• '+esc(w)+'</p>').join('')+'<p>รูปด้าน/แปลน/รูปตัดเป็น NTS และใช้เหล็ก nominal ชุดเดียวกับ 3D; ปลอกแนวตั้ง/ปลอกคานเป็นรายละเอียดตัวอย่างแยกจาก Aₛ/Aₕ ไม่เพิ่มกำลังใน Engine; กำลังยึดปลาย มาตรฐานดัด/หางงอ จุดปิดปลอก และ confinement ยังรอตรวจรับ</p><div class="rep-signatures"><div><b>ผู้คำนวณ / PREPARED BY</b>—<br>ลงนาม __________________</div><div><b>ผู้ตรวจสอบ / CHECKED BY</b>—<br>ลงนาม __________________</div></div>');
    blocks.push(last);publish(mount,meta,blocks,current);
  }
  function clear(mount) {
    if(mount){pending.delete(mount);mount.replaceChildren();delete mount.dataset.paperReady;delete mount.dataset.snapshotId;delete mount.dataset.pageCount;}
    const printButton=document.getElementById('printReportBtn');if(printButton)printButton.disabled=true;
  }
  function print(mount,current) {
    if(!current() || mount?.dataset.paperReady!=='ready') return false;
    const paperSource=mount.querySelector('iframe')?.contentDocument?.getElementById('paper');
    if(!paperSource)return false;
    const html=paperSource.innerHTML, snapshot=mount.dataset.snapshotId;
    const win=global.open('/corbel-a4-print.html?v='+VERSION,'_blank');
    if(!win) { global.alert('กรุณาอนุญาตหน้าต่างรายงานเพื่อพิมพ์ / Save PDF');return false; }
    win.addEventListener('load',()=>{
      if(!current()) {win.close();return;}
      const paper=win.document.getElementById('paper');
      paper.innerHTML=html;paper.dataset.snapshotId=snapshot;paper.dataset.paperReady='ready';
      win.document.title='นายช่างใหญ่ Civil Apps · '+snapshot+' · A4';
      Promise.all([400,600,700].map(weight=>win.document.fonts.load(weight+' 9pt NCYReportSarabun','ภาษาไทย'))).then(async()=>{
        await win.document.fonts.ready;
        if(current())win.print();else win.close();
      });
    },{once:true});
    return true;
  }
  const api=Object.freeze({version:VERSION,corbel,clear,print,corbelEquations,corbelCheckUnit,checkCriterion,number});
  if(typeof module==='object' && module.exports) module.exports=api;
  global.NCYCivilA4=api;
})(typeof window==='object'?window:globalThis);
