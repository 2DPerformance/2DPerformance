/* Sample orchestration only. Calculation formulas and engineering statuses stay in the donor. */
(function(root) {
  'use strict';
  let activeId=null,dialog,body,returnFocus,started=false;
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:6}):'ยังไม่มีผล';
  const action=(key,label)=>`<button type="button" class="button" data-sc01-demo="${key}">${label}</button>`;
  const app=()=>root.NCYApp;
  const core=()=>root.NCYSC01Demos;
  function sampleURL(id) {
    if(!core().CATALOG.some(item=>item.id===id))throw Error('unknown sample');
    const url=root.__scMemberRouteAuthorized
      ?new URL('/steel-box-cantilever-connection',root.location.origin)
      :new URL(root.location.href);
    url.search='';
    if(!root.__scMemberRouteAuthorized)url.searchParams.set('qa','1');
    url.searchParams.set('sc01-sample',id);
    return url.href;
  }
  function show(title,html) {
    returnFocus=document.activeElement;
    $('sc01DemoTitle').textContent=title;body.innerHTML=html;
    if(!dialog.open)dialog.showModal();
    $('sc01DemoTitle').focus({preventScroll:true});
  }
  function close() {dialog.close();if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function chooser() {
    show('ตัวอย่างคำนวณ 4 แบบ',
      '<p>เลือกตัวอย่างที่มีค่ากรอกครบสำหรับทดลองคำนวณ ดูสมการ แทนค่า และผลจริงของแต่ละรูปแบบ</p>'+
      '<p class="sc01-demo-notice">'+(activeId?'อยู่ในพื้นที่ตัวอย่างแยก เปลี่ยนรูปแบบจะเริ่มค่าตัวอย่างใหม่':'เปิดในแท็บใหม่ งานและร่างในเครื่องของคุณไม่ถูกเปลี่ยน')+' · ผลคัดกรองไม่ใช่การรับรองแบบก่อสร้าง</p>'+
      '<ol class="sc01-demo-list">'+core().CATALOG.map((item,index)=>'<li><div><strong>'+String(index+1)+'. '+esc(item.label)+'</strong><small>'+esc(item.description)+'</small><small>'+esc(item.scope)+'</small></div>'+
        (activeId?`<button type="button" class="button primary" data-sc01-demo="select" data-sample-id="${item.id}">ใช้ตัวอย่างนี้</button>`:
          `<a class="button primary" href="${esc(sampleURL(item.id))}" target="_blank" rel="noopener">เปิดตัวอย่าง ↗</a>`)+ '</li>').join('')+'</ol>');
  }
  function installBanner() {
    const panel=$('inputPanel');if(!panel||!activeId)return;
    let banner=$('sc01DemoBanner');
    if(!banner){banner=document.createElement('section');banner.id='sc01DemoBanner';panel.querySelector('.panel-head').after(banner);}
    const item=core().CATALOG.find(item=>item.id===activeId);
    banner.innerHTML='<strong>ตัวอย่างคำนวณ · '+esc(item.label)+'</strong>ร่างแยกในแท็บนี้ · ส่งออก JSON ได้'+
      '<div>'+action('open','เริ่มสอนใช้งาน')+action('evidence','สมการ + ผลตรวจ')+action('reset','คืนค่าตัวอย่าง')+action('choose','เปลี่ยนแบบ')+'</div>';
    const button=$('sc01DemoOpen');if(button)button.textContent='Demo สอนใช้งาน';
    document.body.dataset.sc01Demo=activeId;
  }
  function load(id) {
    if(!root.__scSampleMode)throw Error('เปิดพื้นที่ Demo แยกก่อน');
    if(!core().CATALOG.some(item=>item.id===id))throw Error('ไม่พบตัวอย่าง');
    // Only the isolated document can replace its sample state; never the original tab.
    const state=core().create(id);
    app().setState(state);activeId=id;root.__scSampleMode=id;
    const url=new URL(root.location.href);url.searchParams.set('sc01-sample',id);root.history.replaceState(null,'',url.href);
    root.NCYUI670.setStage('input',{activateModel:false});
    root.NCYSC01InputFlow.presentProjectScene?.();
    installBanner();
    if(dialog.open)dialog.close();
  }
  function evidence() {
    if(!activeId){chooser();return;}
    if(!root.NCYSC01InputFlow.ensureCurrentResult())return;
    const state=app().getState(),result=app().getResult(),v=core().verify(state,result);
    const rowHTML=row=>'<tr><td><strong>'+esc(row.label)+'</strong><br><small>'+esc(row.caseName||'')+'</small><br><code>'+esc(row.equation)+'</code><br><code>'+esc(row.substitution)+'</code></td><td>'+number(row.expected)+' '+esc(row.unit)+'</td><td>'+number(row.actual)+' '+esc(row.unit)+'<br>'+(row.ok?'✓ ตรงตามสมการ':'✕ ไม่ตรง / หลักฐานไม่ครบ')+'<br><small>'+esc(row.sourcePath)+'</small></td></tr>';
    const table=rows=>'<div class="sc01-demo-evidence sc01-demo-equations"><table><thead><tr><th>สมการและการแทนค่า</th><th>คำนวณอ้างอิง</th><th>ผลจากเอนจิ้น</th></tr></thead><tbody>'+rows.map(rowHTML).join('')+'</tbody></table></div>';
    const initial=v.rows.filter(row=>row.caseName===v.rows[0]?.caseName||row.key==='cantilever-deflection');
    const remaining=v.rows.filter(row=>!initial.includes(row));
    const checks=Object.entries(result.checks||{}).filter(([,c])=>c.state!=='na');
    const statuses={ok:'อยู่ในเกณฑ์ตัวเลข',warn:'ทบทวน',review:'รอตรวจวิธี',fail:'ไม่ผ่าน',outside:'นอกขอบเขต',incomplete:'ข้อมูลไม่ครบ',hold:'HOLD'};
    show('สมการและผลตรวจ · '+v.label,
      '<p><strong>'+(v.fixtureUnmodified?'ค่าตัวอย่างต้นฉบับ':'แก้ไขตัวอย่างแล้ว ใช้ผลคำนวณปัจจุบัน')+'</strong><br>'+esc(v.scope)+'</p>'+
      '<p class="sc01-demo-notice">'+(v.scopedEvidencePass?'✓ สมการที่แสดงให้ผลตรงกับเอนจิ้น':'✕ ยังยืนยันสมการที่แสดงไม่ได้')+
      ' · '+v.rows.filter(row=>row.ok).length+'/'+v.rows.length+' รายการ<br>นี่คือการตรวจสมการเฉพาะขอบเขต ไม่ใช่ตรวจรับรองสูตรกำลังทั้งหมด</p>'+
      '<h3>ผลคัดกรองของตัวอย่าง</h3><p>รายการตัวเลขที่เอนจิ้นประเมิน: '+v.numericWithin+'/'+v.numericCount+' ไม่เกินเกณฑ์ · '+v.numericFailed+' เกินเกณฑ์<br>ยังรอตรวจข้อมูล/วิธี/ขอบเขต '+v.unresolved.length+' รายการในตารางด้านล่าง</p>'+
      table(initial)+(remaining.length?'<details><summary>สมการกรณีแรงอื่นอีก '+remaining.length+' รายการ</summary>'+table(remaining)+'</details>':'')+
      '<details><summary>ดูผลตรวจทั้งหมด '+checks.length+' รายการ</summary><div class="sc01-demo-evidence"><table><thead><tr><th>รายการ</th><th>D/C</th><th>สถานะจริง</th></tr></thead><tbody>'+checks.map(([key,c])=>'<tr><td>'+esc(c.label||key)+'</td><td>'+number(c.ratio)+'</td><td>'+esc(statuses[c.state]||c.state)+(c.methodReview?' · ยังรอตรวจวิธี':'')+'</td></tr>').join('')+'</tbody></table></div></details>'+
      '<h3>ขอบเขตที่ยังไม่รับรอง</h3><ul>'+v.limitations.map(text=>'<li>'+esc(text)+'</li>').join('')+'</ul>'+
      '<p><small>อ้างอิงหลักการ: <a href="https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/resources/mit2_080jf13_lecture5/" target="_blank" rel="noopener">MIT: Beam deflections</a> · <a href="https://ocw.mit.edu/courses/2-080j-structural-mechanics-fall-2013/resources/mit2_080jf13_lecture8/" target="_blank" rel="noopener">MIT: Energy methods</a> เป็นแหล่งทฤษฎี ไม่ใช่การรับรองซอฟต์แวร์นี้</small></p>'+
      '<p><small>รหัสข้อมูล: '+esc(v.inputFingerprint)+' · '+esc(v.version)+' · NOT FOR CONSTRUCTION</small></p>');
  }
  function init() {
    if(started||!root.__scCustomerEntryAuthorized||root.__scWorkbenchBootFailed)return;
    if(!app()?.getResult?.()||!root.NCYUI670?.setStage||!core()||!$('inputPanel'))return;
    started=true;
    dialog=document.createElement('dialog');dialog.id='sc01DemoDialog';dialog.setAttribute('aria-labelledby','sc01DemoTitle');
    dialog.innerHTML='<header><h2 id="sc01DemoTitle" tabindex="-1"></h2><button type="button" class="button" data-sc01-demo="close" aria-label="ปิด Demo">ปิด ✕</button></header><div id="sc01DemoBody"></div>';
    document.body.appendChild(dialog);body=$('sc01DemoBody');
    const button=document.createElement('button');button.id='sc01DemoOpen';button.type='button';button.className='button';button.dataset.sc01Demo='open';button.textContent='Demo สอนใช้งาน';
    document.querySelector('.top-actions').appendChild(button);
    const examples=document.createElement('button');examples.id='sc01DemoExamples';examples.type='button';examples.className='button';examples.dataset.sc01Demo='choose';examples.textContent='ตัวอย่างคำนวณ 4 แบบ';
    document.querySelector('.top-actions').appendChild(examples);
    document.addEventListener('click',event=>{
      // The BODY also carries a sample marker. Only actual action buttons may
      // cancel a click; otherwise native disclosures, inputs and forms break.
      const target=event.target.closest('button[data-sc01-demo]');if(!target)return;
      event.preventDefault();
      try {
        switch(target.dataset.sc01Demo){
          case 'close':close();break;
          case 'open':if(!root.NCYSC01Tour?.start())throw Error('ยังเปิดการสอนไม่ได้ กรุณารอโปรแกรมพร้อมแล้วลองใหม่');break;
          case 'choose':chooser();break;
          case 'evidence':evidence();break;
          case 'select':load(target.dataset.sampleId);break;
          case 'reset':load(activeId);break;
        }
      }catch(error){show('ยังเปิดหลักฐานไม่ได้','<p role="alert">'+esc(error.message)+'</p>');}
    });
    if(root.__scSampleMode)load(root.__scSampleMode);
  }
  function start(){setTimeout(init,180);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})(window);
