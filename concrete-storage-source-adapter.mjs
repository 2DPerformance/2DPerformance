// Storage-only transforms for hash-verified donors. No source donor is edited.
export function adaptGroundStorageSafety(source) {
  const replacements = [
    ["try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {}", "return window.SVConcreteSaveSafety.writeJSON(STORE,d,'หัวรายงานพื้นเดิม');"],
    ["function saveState() { try { localStorage.setItem('ckds_state', JSON.stringify(DS)); } catch (e) {} }", "function saveState() { return window.SVConcreteSaveSafety.writeJSON('ckds_state',DS,'ค่าจัดหน้ากระดาษ'); }"],
    ["function saveTB() { try { localStorage.setItem('ckds_tb', JSON.stringify(TB)); } catch (e) {} }", "function saveTB() { return window.SVConcreteSaveSafety.writeJSON('ckds_tb',TB,'กรอบชื่อแบบ'); }"],
    ["function saveRev(a) { try { localStorage.setItem('ckds_rev', JSON.stringify(a)); } catch (e) {} }", "function saveRev(a) { return window.SVConcreteSaveSafety.writeJSON('ckds_rev',a,'ประวัติแก้ไขแบบ'); }"],
    ["function loadSet() { try { return JSON.parse(localStorage.getItem('ckds_set') || '[]'); } catch (e) { return []; } }", "function loadSet() { var pending=window.SVConcreteSaveSafety.pendingJSON('ckds_set');if(pending!==undefined)return pending;try { return JSON.parse(localStorage.getItem('ckds_set') || '[]'); } catch (e) { return []; } }"],
    ["function saveSet(a) { try { localStorage.setItem('ckds_set', JSON.stringify(a)); } catch (e) {} try { window.dispatchEvent(new CustomEvent('ck-drawing-set-change',{detail:{count:a.length}})); } catch(e){} }", "function saveSet(a) { if(!window.SVConcreteSaveSafety.writeJSON('ckds_set',a,'ชุดแบบพื้น'))return false;try { window.dispatchEvent(new CustomEvent('ck-drawing-set-change',{detail:{count:a.length}})); } catch(e){} return true; }"],
    ["saveSet(arr); updateSetBadge(); toast((replaced>=0?'อัปเดตแผ่นในชุดแล้ว':'เพิ่มเข้าชุดแบบแล้ว')+' · รวม ' + arr.length + ' แผ่น');", "if(saveSet(arr)){updateSetBadge();toast((replaced>=0?'อัปเดตแผ่นในชุดแล้ว':'เพิ่มเข้าชุดแบบแล้ว')+' · รวม ' + arr.length + ' แผ่น');}"],
    ["else if (a === 'clearset') { saveSet([]); updateSetBadge(); buildSetMenu(); toast('ล้างชุดแบบแล้ว'); }", "else if (a === 'clearset') { if(saveSet([])){updateSetBadge();buildSetMenu();toast('ล้างชุดแบบแล้ว');} }"],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('ground_storage_adapter_source_drift');
    source = source.replace(before, after);
  }
  return source;
}

export function adaptScaffoldStorageSafety(source) {
  const replacements = [
    ["try{localStorage.setItem('scaffold-pro-v2-autosave',JSON.stringify({version:V2,state}))}catch(e){}", "window.SVScaffoldProjectStore?.schedule();"],
    ["function persist(){try{localStorage.setItem('scaffold-pro-v2-autosave',JSON.stringify({version:VER,state}));}catch(_){}}", "function persist(){window.SVScaffoldProjectStore?.schedule();}"],
    ["try{const auto=JSON.parse(localStorage.getItem('scaffold-pro-v2-autosave')||'null');if(auto?.state)state=v2merge(state,auto.state)}catch(e){}", "/* Legacy draft is migrated non-destructively by the explicit IndexedDB Open control. */"],
    ["function planImageDataV2(){if(!planState.img)return null;try{const max=1800,sc=Math.min(1,max/Math.max(planState.img.width,planState.img.height)),c=document.createElement('canvas');c.width=Math.round(planState.img.width*sc);c.height=Math.round(planState.img.height*sc);c.getContext('2d').drawImage(planState.img,0,0,c.width,c.height);return c.toDataURL('image/jpeg',.82)}catch(e){return null}}", "function planImageDataV2(){if(!planState.img)return null;try{const c=document.createElement('canvas');c.width=planState.img.naturalWidth||planState.img.width;c.height=planState.img.naturalHeight||planState.img.height;c.getContext('2d').drawImage(planState.img,0,0);return c.toDataURL('image/png')}catch(e){return null}}"],
    ["async function openProjectFileV2(file){if(!file)return;try{const data=JSON.parse(await file.text());state=v2merge(defaults,data.state||data);migrateV2State();for(const cp of state.customProfiles||[])if(!pDB.some(p=>p.name===cp.name))pDB.push(profileProps({...cp,custom:true}));planState.scalePxM=v2num(data.plan?.scalePxM);planState.localOriginImg=data.plan?.localOriginImg||null;planState.fileName=data.plan?.fileName||'';planState.img=null;if(data.plan?.imageData){await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{planState.img=img;resolve()};img.onerror=reject;img.src=data.plan.imageData})}refreshProfileOptionsV2();syncInputsV2();calculateV2();toast(`เปิดโครงการ Scaffold Pro ${data.version||''} แล้ว`,'success')}catch(e){console.error(e);toast('เปิดไฟล์ไม่ได้: '+e.message,'error')}}", "async function openProjectFileV2(file){if(!file)return false;try{if(!window.SVScaffoldProjectInputs)throw new Error('ระบบเปิดไฟล์ยังไม่พร้อม กรุณาคงไฟล์ไว้');const opened=await window.SVScaffoldProjectInputs.openLegacy(file);if(opened)toast('เปิดข้อมูลและภาพแปลนแล้ว ยังต้องตรวจสถานะบันทึกในเครื่อง','success');return opened}catch(e){console.error(e);toast('เปิดไฟล์ไม่ได้: '+e.message,'error');return false}}"],
    ["function saveProjectV2(){const data=", "function saveProjectV2(){if(planState.img&&!planImageDataV2()){toast('ยังส่งออกไม่ได้: อ่านภาพแปลนไม่สำเร็จ กรุณาคงแท็บนี้ไว้','error');return;}const data="],
    ["toast('บันทึกโครงการ v2 แล้ว','success')", "toast('ส่งคำขอดาวน์โหลดแล้ว ตรวจไฟล์ .scaffold.json ใน Downloads; ภาพแปลนเป็นภาพที่แสดง ไม่ใช่ต้นฉบับ PDF','success')"],
    ["function csvTextV2(rows){", `window.SVScaffoldRetainedProject = Object.freeze({
      getState:()=>v2deep(state), getDefaults:()=>v2deep(defaults), getImage:()=>planState.img,
      getPlan:()=>({scalePxM:planState.scalePxM,localOriginImg:planState.localOriginImg||null,fileName:planState.fileName}),
      imageData:planImageDataV2,
      apply:(input,nextImage)=>{
        if(!window.SVScaffoldProjectInputs?.validate(input))throw new Error('ข้อมูลนั่งร้านไม่ครบ ไม่เปลี่ยนงานปัจจุบัน');
        const previous=state,previousResult=result,previousProfiles=pDB.slice(),previousPlan={...planState};
        const previousInputs=[...document.querySelectorAll('input,select,textarea')].map(el=>({el,value:el.value,checked:el.checked}));
        const reportRoot=$('#reportRoot'),previousReport=reportRoot?.innerHTML;
        const published=Object.fromEntries(['APP_READY','APP_VERSION','APP_ERROR','REPORT_READY','REPORT_MODE'].map(key=>[key,window[key]]));
        try{
          const preparedProfiles=(input.state.customProfiles||[]).filter(cp=>!pDB.some(p=>p.name===cp.name)).map(cp=>profileProps({...cp,custom:true}));
          state=v2merge(defaults,input.state);migrateV2State();pDB.push(...preparedProfiles);
          const plan=input.plan||{scalePxM:0,localOriginImg:null,fileName:''};
          Object.assign(planState,{scalePxM:plan.scalePxM,localOriginImg:plan.localOriginImg,fileName:plan.fileName,img:nextImage,history:[],draft:[],calPoints:[],selectedXY:null,mode:'view'});
          refreshProfileOptionsV2();syncInputsV2();calculateV2();
        }catch(error){
          state=previous;result=previousResult;pDB.splice(0,pDB.length,...previousProfiles);Object.assign(planState,previousPlan);
          let displayError='';
          try{refreshProfileOptionsV2();syncInputsV2();calculateV2();}catch(rollbackError){displayError='คืนข้อมูลเดิมแล้ว แต่การแสดงผลยังไม่พร้อม: '+rollbackError.message;}
          state=previous;result=previousResult;Object.assign(planState,previousPlan);
          previousInputs.forEach(({el,value,checked})=>{el.value=value;if(typeof checked==='boolean')el.checked=checked;});
          if(reportRoot)reportRoot.innerHTML=previousReport;
          for(const [key,value] of Object.entries(published)){if(value===undefined)delete window[key];else window[key]=value;}
          if(displayError){window.APP_ERROR=displayError;window.REPORT_READY=false;}
          throw error;
        }
      }
    });
    function csvTextV2(rows){`],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('scaffold_storage_adapter_source_drift');
    source = source.replace(before, after);
  }
  return source;
}

export function adaptOnePileStorageSafety(source, kind) {
  const replacements = kind === 'report' ? [
    ["try { localStorage.setItem(STORE, JSON.stringify(d)); } catch (e) {}", "return window.SVConcreteSaveSafety.writeJSON(STORE,d,'หัวรายงานฐานราก');"],
  ] : [
    ["function saveState() { try { localStorage.setItem('ckds_state', JSON.stringify(DS)); } catch (e) {} }", "function saveState() { return window.SVConcreteSaveSafety.writeJSON('ckds_state',DS,'ค่าจัดหน้ากระดาษ'); }"],
    ["function saveTB() { try { localStorage.setItem('ckds_tb', JSON.stringify(TB)); } catch (e) {} }", "function saveTB() { return window.SVConcreteSaveSafety.writeJSON('ckds_tb',TB,'กรอบชื่อแบบ'); }"],
    ["function saveRev(a) { try { localStorage.setItem('ckds_rev', JSON.stringify(a)); } catch (e) {} }", "function saveRev(a) { return window.SVConcreteSaveSafety.writeJSON('ckds_rev',a,'ประวัติแก้ไขแบบ'); }"],
    ["function loadSet() { try { return JSON.parse(localStorage.getItem('ckds_set') || '[]'); } catch (e) { return []; } }", "function loadSet() { var pending=window.SVConcreteSaveSafety.pendingJSON('ckds_set');if(pending!==undefined)return pending;try { return JSON.parse(localStorage.getItem('ckds_set') || '[]'); } catch (e) { return []; } }"],
    ["function saveSet(a) { try { localStorage.setItem('ckds_set', JSON.stringify(a)); } catch (e) {} }", "function saveSet(a) { return window.SVConcreteSaveSafety.writeJSON('ckds_set',a,'ชุดแบบฐานราก'); }"],
    ["saveSet(arr); updateSetBadge(); toast('เพิ่มเข้าชุดแบบแล้ว · รวม ' + arr.length + ' แผ่น');", "if(saveSet(arr)){updateSetBadge();toast('เพิ่มเข้าชุดแบบแล้ว · รวม ' + arr.length + ' แผ่น');}"],
    ["else if (a === 'clearset') { saveSet([]); updateSetBadge(); buildSetMenu(); toast('ล้างชุดแบบแล้ว'); }", "else if (a === 'clearset') { if(saveSet([])){updateSetBadge();buildSetMenu();toast('ล้างชุดแบบแล้ว');} }"],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2) throw new Error('one_pile_storage_adapter_source_drift');
    source = source.replace(before, after);
  }
  return source;
}
