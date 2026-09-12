/* Owner report identity. Optional input metadata, never calculation authority. */
(function(root){
  'use strict';
  const extraFields=Object.freeze({company:120,licenseNo:60,contact:120});
  const fields=[['company','บริษัท / สำนักงาน',120],['projectName','ชื่อโครงการ',160],
    ['projectNo','เลขที่โครงการ',60],['location','สถานที่',160],['designer','จัดทำโดย',100],
    ['licenseNo','เลขใบอนุญาตผู้จัดทำ',60],['checker','ตรวจสอบโดย',100],
    ['contact','ข้อมูลติดต่อ',120],['revision','Revision',30],['date','วันที่',10]];
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function validMetadata(input){
    return !!input?.meta&&Object.entries(extraFields).every(([key,max])=>
      !Object.hasOwn(input.meta,key)||typeof input.meta[key]==='string'&&input.meta[key].length<=max);
  }
  function restoreMetadata(state,input){
    if(!validMetadata(input))throw Error('ข้อมูลโปรไฟล์รายงานไม่ถูกต้องหรือยาวเกินกำหนด');
    for(const key of Object.keys(extraFields)){
      delete state.meta[key];
      if(Object.hasOwn(input.meta,key))state.meta[key]=input.meta[key];
    }
    return state;
  }
  function header(meta,title){
    const line=(label,value)=>value?`<span>${label}${esc(value)}</span>`:'';
    return `<header class="c4-header sc01-profile-header"><h2>${esc(title)}</h2><div class="sc01-report-identity"><div>${line('',meta.company)}${line('จัดทำ: ',meta.designer)}${line('ใบอนุญาต: ',meta.licenseNo)}${line('',meta.contact)}</div><div>${line('โครงการ: ',meta.projectNo)}${line('ตรวจ: ',meta.checker)}${line('REV ',meta.revision)}${line('',meta.date)}</div></div></header>`;
  }
  root.NCYSC01ReportProfile=Object.freeze({extraFields,validMetadata,restoreMetadata,header,open});
  const doc=root.document;if(!doc)return;
  let dialog,stamp;
  function open(){
    if(root.NCYSC01MaterialSelection?.hasPending()||Object.keys(root.NCYApp.ui59.getDraftErrors()).length){
      root.NCYSC01InputFlow.ensureCurrentResult();return;
    }
    const app=root.NCYApp,input=app.getState();stamp=root.NCYSC01AssistantCore.stable(input);
    if(!dialog){dialog=doc.createElement('dialog');dialog.id='sc01ProfileDialog';dialog.className='sc01-audit-dialog sc01-profile-dialog';dialog.setAttribute('aria-labelledby','sc01ProfileTitle');doc.body.append(dialog);}
    dialog.innerHTML='<header><h2 id="sc01ProfileTitle">โปรไฟล์รายงาน</h2><button type="button" data-profile-close>ปิด</button></header><form><p>ข้อมูลนี้ใช้บนหัวรายการคำนวณ และบันทึกไปกับงาน</p><div class="sc01-profile-fields">'+fields.map(([key,label,max])=>`<label>${label}<input name="${key}" maxlength="${max}" type="${key==='date'?'date':'text'}" value="${esc(input.meta[key]||'')}"></label>`).join('')+'</div><p id="sc01ProfileError" role="status"></p><footer><button type="button" data-profile-close>ยกเลิก</button><button type="submit">ใช้ข้อมูลในรายงาน</button></footer></form>';
    dialog.onclick=e=>{if(e.target.closest('[data-profile-close]'))dialog.close();};
    dialog.querySelector('form').onsubmit=e=>{
      e.preventDefault();const error=doc.getElementById('sc01ProfileError');
      try{
        if(stamp!==root.NCYSC01AssistantCore.stable(app.getState()))throw Error('ข้อมูลงานเปลี่ยนแล้ว ปิดแล้วเปิดโปรไฟล์อีกครั้ง');
        const next=JSON.parse(JSON.stringify(app.getState()));
        for(const [key,,max] of fields){const value=dialog.querySelector(`[name="${key}"]`).value.trim();if(value.length>max)throw Error('ข้อความยาวเกินกำหนด');next.meta[key]=value;}
        app.setState(next);
        if(!fields.every(([key])=>app.getState().meta[key]===next.meta[key]))throw Error('ยังใช้ข้อมูลไม่ได้ ตรวจช่องกรอกงานที่ค้าง');
        dialog.close();app.renderView('a4');
      }catch(ex){error.textContent=ex.message;}
    };
    dialog.showModal();
  }
  function mount(){
    const host=doc.querySelector('#sc01DocumentCenter')||doc.querySelector('.top-actions');
    if(!host||doc.querySelector('[data-report-profile-open]'))return;
    const button=doc.createElement('button');button.type='button';button.className='button secondary sc01-profile-open';button.dataset.reportProfileOpen='';button.textContent='โปรไฟล์รายงาน';button.onclick=open;host.append(button);
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
  root.addEventListener('ncy:v5-updated',mount);
  doc.addEventListener('click',()=>root.requestAnimationFrame(mount));
})(typeof window==='undefined'?globalThis:window);
