import { mountInputPages } from './inputPages.mjs?rwv=20260930-load-units-1';
import { inputGuideNote,inputGuideView } from './inputDiagram.mjs?rwv=20261003-cad-contour-1&stay=20261004-alternate-1';
import { renderNativeCadView } from './nativeCadScreen.mjs?rwv=20261003-cad-contour-1&stay=20261004-alternate-1';
import { renderInputCadView } from './inputCad.mjs?rwv=20261003-cad-contour-1&panel=20261004-pile-panel-1&stay=20261004-alternate-1';
import { mountInputScene } from './inputScene.mjs?rwv=20261003-system-switch-1&material=20261004-realism-1&panel=20261004-pile-panel-1&stay=20261004-alternate-1';
import { createCalculationRun } from './calculationRun.mjs?rwv=20261003-support-symbols-1';

export const FOOTING_FLOWS = Object.freeze([
  ['summary','ภาพรวม','plan'],['dc','ตรวจ D/C','checks'],['analysis','วิเคราะห์','forces'],
  ['section','รูปตัดและเหล็ก','plan'],['three','3D','model'],['report','รายงาน A4','report'],
  ['drawing','ชุดแบบ','plan'],
]);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// One drawing vocabulary across the seven selectable structural arrangements.
// The glyphs identify geometry only; they do not indicate an Engine verdict.
const icons={
  cantilever:'<path class="concrete" d="M10 5h7v31h27v7H4v-7h6z"/>',
  counterfort:'<path class="rib" d="M17 13 37 36H17z"/><path class="concrete" d="M10 5h7v31h27v7H4v-7h6z"/>',
  gravity:'<path class="concrete" d="M8 5h21v31h15v7H4v-7h4z"/><path class="hatch" d="m11 32 16-16M14 38l13-13M10 16l9-9"/>',
  pile:'<path class="pile" d="M9 36h6v10H9zm27 0h6v10h-6z"/><path class="concrete" d="M10 4h7v28h27v6H4v-6h6z"/>',
  pilecf:'<path class="pile" d="M9 36h6v10H9zm27 0h6v10h-6z"/><path class="rib" d="M17 12 36 32H17z"/><path class="concrete" d="M10 4h7v28h27v6H4v-6h6z"/>',
  soldier:'<path class="steel" d="M6 3h7v42H6zm30 27h7v15h-7z"/><path class="lagging" d="M13 9h17v5H13zm0 9h17v5H13zm0 9h17v5H13z"/><path class="cap" d="M33 27h13v5H33z"/><path class="brace" d="m13 12 26 17"/>',
  duckfoot:'<path class="boundary" d="M3 3v42"/><path class="concrete" d="M8 5h7v31h29v8H8z"/><path class="beam" d="M15 29h26v6H15z"/>',
};
function systemIcon(type){return '<svg class="rw-system-glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">'+icons[type]+'</svg>';}

export function mountFootingWorkflow({type,inputs,work,panes,forms,onType,onCalculate,onExample,onRestorePrevious,hasPreviousDraft,onView,readInputGuide,onSave,onOpen,onPrint,onBack,drawingView='plan'}){
  document.body.classList.add('rw-unified','rw-ft03');
  document.documentElement.classList.add('rw-workspace-root');
  let style=document.querySelector('link[data-rw-ft-style]');
  if(!style){style=document.createElement('link');style.rel='stylesheet';style.href=new URL('./footingWorkflow.css?rwv=20261003-support-symbols-1',import.meta.url).href;style.dataset.rwFtStyle='';document.head.append(style);}
  let ready=false,running=false,activeFlow='summary',currentView='plan',sheet='section',field='',sectionMode='plan',scene=null;
  let guideQueued=false,groupsQueued=false,lastLayout='';
  const header=document.createElement('header');header.className='rw-flow-header rw-ft-header';
  header.innerHTML='<div class="rw-ft-identity"><button type="button" data-action="back" aria-label="กลับไปหน้ารวมเครื่องมือ">←</button><b class="rw-tool-code">RW-01</b><div><small>โต๊ะทำงานคอนกรีต · กำแพงกันดิน</small><h1>กำแพงกันดิน <span>โต๊ะทำงานวิศวกรรม</span></h1></div></div>'
    +'<div class="rw-ft-actions"><button type="button" data-action="help">วิธีใช้งาน</button><button type="button" data-document="report" disabled>รายงาน A4</button><details class="rw-file-menu"><summary>Save / Open</summary><div><button type="button" data-action="save">บันทึกไฟล์</button><button type="button" data-action="open">เปิดไฟล์</button></div></details></div>';
  const systems=document.createElement('section');systems.className='rw-system-picker';systems.setAttribute('aria-label','เลือกระบบกำแพงและฐานราก');
  systems.innerHTML='<div class="rw-system-label"><b>เลือกระบบ</b><small>กำแพง / ฐานราก</small></div><div role="radiogroup" aria-label="รูปแบบกำแพงและฐานราก">'
    +forms.map(([key,label])=>'<button type="button" role="radio" data-system="'+key+'" aria-checked="'+(key===type)+'">'+systemIcon(key)+'<span>'+label.replace(' · ','<small>')+(label.includes(' · ')?'</small>':'')+'</span></button>').join('')+'</div>'
    +'<select hidden id="rwFormType" aria-label="รูปแบบกำแพงและฐานราก">'+forms.map(([key,label])=>'<option value="'+key+'">'+label+'</option>').join('')+'</select>';
  document.body.prepend(header,systems);
  const selector=systems.querySelector('select');selector.value=type;
  const footer=document.createElement('footer');footer.className='rw-ft-statusbar';footer.innerHTML='<span>RW-01 · ผลคำนวณชุดเดียวกันทุก Flow</span><strong>พร้อมกรอกข้อมูล</strong><span>นายช่างใหญ่ Civil Apps</span>';document.body.append(footer);
  function invoke(callback,...args){try{Promise.resolve(callback?.(...args)).catch(error=>notice(error.message));}catch(error){notice(error.message);}}
  // Only the authorised same-origin shell can select a retained host's system.
  window.addEventListener('message',async event=>{
    if(parent===window||event.source!==parent||event.origin!==location.origin)return;
    if(event.data?.type==='rw:workbench-focus-system'){
      measure();systems.querySelector('[data-system="'+type+'"]')?.focus({preventScroll:true});return;
    }
    if(event.data?.type!=='rw:workbench-select-system'||!Number.isSafeInteger(event.data.request)
      ||!forms.some(([key])=>key===event.data.system))return;
    try{
      if(event.data.system!==type)await onType?.(event.data.system);
      if(type===event.data.system)parent.postMessage({type:'rw:workbench-system-selected',system:type,request:event.data.request},location.origin);
    }catch(error){notice(error.message);}
  });
  for(const [key,callback]of Object.entries({back:onBack,save:onSave,open:onOpen}))header.querySelector('[data-action="'+key+'"]').addEventListener('click',()=>{header.querySelector('details').open=false;invoke(callback);});
  systems.querySelectorAll('[data-system]').forEach(button=>{button.tabIndex=button.dataset.system===type?0:-1;button.addEventListener('click',()=>{if(!running&&button.dataset.system!==type)invoke(onType,button.dataset.system);});});
  systems.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key)||running)return;const buttons=[...systems.querySelectorAll('[data-system]')],n=buttons.indexOf(e.target);if(n<0)return;e.preventDefault();const k=e.key==='Home'?0:e.key==='End'?buttons.length-1:(n+(e.key==='ArrowRight'?1:buttons.length-1))%buttons.length;buttons[k].click();buttons[k].focus();});
  const help=document.createElement('dialog');help.className='rw-help-dialog';help.innerHTML='<h2>วิธีใช้งาน RW-01</h2><ol><li>เลือกไอคอนระบบกำแพงหรือฐานราก</li><li>กรอกแต่ละหมวด ดูตำแหน่งระยะใน Plan / Section และหมุนรูป 3D</li><li>กดคำนวณครั้งเดียว แล้วตรวจ Flow 01–07</li><li>เมื่อแก้ข้อมูล กดคำนวณใหม่ก่อนเปิดผลหรือรายงาน</li></ol><button type="button">ปิด</button>';document.body.append(help);
  header.querySelector('[data-action=help]').addEventListener('click',()=>help.showModal());help.querySelector('button').addEventListener('click',()=>help.close());
  inputs.classList.add('rw-flow-inputs');work.classList.add('rw-flow-work');inputs.id||='rwInputPanel';
  const inputHeading=document.createElement('div');inputHeading.className='rw-flow-input-heading';inputHeading.innerHTML='<span class="rw-quick-icon" aria-hidden="true">✎</span><div><small>QUICK INPUT</small><b>ข้อมูลออกแบบ</b><span>ค่าตั้งต้นเป็นตัวอย่าง · ร่างเดิมใช้ค่าของคุณ</span></div>';inputs.prepend(inputHeading);
  const mobile=document.createElement('nav');mobile.className='rw-mobile-switch';mobile.setAttribute('aria-label','พื้นที่ทำงาน');mobile.innerHTML='<button type="button" data-area="inputs" aria-pressed="true">ข้อมูลออกแบบ</button><button type="button" data-area="work" aria-pressed="false">Flow / รูปประกอบ</button>';inputs.parentElement.before(mobile);
  function setArea(area){document.body.dataset.rwArea=area;mobile.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.area===area)));}
  mobile.addEventListener('click',e=>{const area=e.target.closest('[data-area]')?.dataset.area;if(area)setArea(area);});setArea('inputs');
  const rail=document.createElement('div');rail.className='rw-rail-action';rail.innerHTML='<div class="rw-rail-head"><p role="status">กรอกข้อมูลให้ครบ แล้วกดคำนวณ</p><button type="button" data-action="example" title="แทนค่าร่างปัจจุบันด้วยชุดตัวอย่างที่ผ่านรายการตรวจที่ Engine รองรับ">โหลดตัวอย่างที่ผ่าน</button></div><button type="button" data-action="calculate">คำนวณกำแพงกันดิน</button><small>ตัวอย่างสมมติ · ตรวจข้อมูลโครงการก่อนใช้จริง · ผลชุดเดียวใน Flow 01–07</small>';
  const controls=document.createElement('div');controls.className='rw-flow-controls';controls.innerHTML='<nav class="rw-footing-tabs" role="tablist" aria-label="Flow 01–07">'+FOOTING_FLOWS.map(([key,label],k)=>'<button role="tab" type="button" id="rw-flow-'+key+'" data-flow="'+key+'" aria-selected="'+(k===0)+'"><b>'+String(k+1).padStart(2,'0')+'</b><span>'+label+'</span></button>').join('')+'</nav><div class="rw-flow-status" role="status" aria-live="polite"><i aria-hidden="true">!</i><div class="rw-flow-status-copy"><b></b><span></span><div class="rw-flow-failure" hidden><p data-fail-first></p><p data-fail-advice></p><p data-fail-caveat></p></div></div><button type="button" data-fail-details hidden>ดูรายการ D/C →</button></div>';
  const tools=document.createElement('div');tools.className='rw-flow-toolbar';tools.innerHTML='<div class="rw-sheet-tabs"><div><button type="button" data-sheet="plan">Plan</button><button type="button" data-sheet="section">Section</button><button type="button" data-sheet="both">รูปคู่</button><button type="button" data-sheet="freebody">Freebody</button><button type="button" data-section-bars>เหล็กเสริม</button></div></div><button type="button" data-print>พิมพ์ A4 / PDF</button>';
  const overview=document.createElement('section');overview.className='rw-overview';overview.innerHTML='<div class="rw-live-model"><header><div><b>แบบจำลองจากขนาดที่กรอก</b><small>ลากหมุน · คลิกขวาลากเลื่อน · สองนิ้วซูม</small></div><div><button type="button" data-camera="iso" disabled>3D</button><button type="button" data-camera="plan" disabled>Plan</button><button type="button" data-camera="section" disabled>Section</button><button type="button" data-spin aria-pressed="false" disabled>▶ หมุน</button></div></header><div class="rw-input-model-stage"><canvas tabindex="0" aria-label="โมเดลสามมิติประกอบการกรอก" aria-description="ลูกศรเลื่อนภาพ; Shift และลูกศรหมุน; บวกและลบซูม; F หรือ Home พอดีจอ; 0 คืนมุม ISO"></canvas><p class="rw-model-note">กำลังเตรียมโมเดล…</p></div><footer>รูปทรงประกอบการกรอก · ยังไม่แสดงเหล็กหรือแรงคำนวณ · +/− ซูม · F พอดีจอ · 0 คืน ISO</footer></div>';
  const cameraTools=document.createElement('div');cameraTools.className='rw-camera-tools';cameraTools.setAttribute('role','group');cameraTools.setAttribute('aria-label','ควบคุมกล้องโมเดลกรอกข้อมูล');
  cameraTools.innerHTML=[['in','+','ซูมเข้า'],['out','−','ซูมออก'],['fit','⤢','พอดีจอ · คงมุมเดิม'],['reset','↺','คืนมุม ISO']].map(([action,icon,label])=>'<button type="button" data-camera-action="'+action+'" aria-label="'+label+'" title="'+label+'" disabled>'+icon+'</button>').join('');
  overview.querySelector('.rw-input-model-stage').append(cameraTools);
  const guide=document.createElement('section');guide.className='rw-input-guide';guide.innerHTML='<div class="rw-guide-title"><b>Plan / Section</b><div><button type="button" data-guide-sheet="plan">Plan</button><button type="button" data-guide-sheet="section" aria-pressed="true">Section</button></div></div><div class="rw-guide-drawing"><figure data-draft-sheet="plan"><figcaption>PLAN <span>ผังตำแหน่ง · มองจากด้านบน</span></figcaption><div></div></figure><figure data-draft-sheet="section"><figcaption>SECTION A-A <span>รูปตัดขวาง</span></figcaption><div></div></figure></div><p class="rw-guide-selection"></p>';
  overview.id='rw-summary-pane';overview.setAttribute('role','tabpanel');overview.setAttribute('aria-labelledby','rw-flow-summary');
  overview.append(guide);work.prepend(controls,tools,overview);
  const status=controls.querySelector('.rw-flow-status'),tabs=[...controls.querySelectorAll('[data-flow]')];
  const inputErrors=document.createElement('ul');inputErrors.className='rw-validation-errors';inputErrors.hidden=true;
  status.querySelector('.rw-flow-status-copy').append(inputErrors);
  const markedInputs=new Map();
  function clearInputErrors(){
    for(const [control,previous]of markedInputs){
      for(const [name,value]of Object.entries(previous))value===null?control.removeAttribute(name):control.setAttribute(name,value);
      control.closest('.field')?.classList.remove('rw-input-invalid');
    }
    markedInputs.clear();inputErrors.replaceChildren();inputErrors.hidden=true;
  }
  function showInputErrors(errors){
    clearInputErrors();
    for(const item of errors){
      const control=[...inputs.querySelectorAll('input,select,textarea')].find(el=>el.id===item.field||el.dataset.key===item.field);
      if(!control||control.readOnly||markedInputs.has(control))continue;
      const li=document.createElement('li'),button=document.createElement('button'),text=document.createElement('span');
      text.id='rw-validation-'+markedInputs.size;text.textContent=item.message;
      button.type='button';button.textContent='แก้ช่องนี้';button.setAttribute('aria-label','แก้ช่อง: '+item.message);
      button.addEventListener('click',()=>{setArea('inputs');preview();inputPages.reveal(control);});
      li.append(text,button);inputErrors.append(li);
      markedInputs.set(control,{'aria-invalid':control.getAttribute('aria-invalid'),'aria-describedby':control.getAttribute('aria-describedby')});
      control.setAttribute('aria-invalid','true');control.setAttribute('aria-describedby',[control.getAttribute('aria-describedby'),text.id].filter(Boolean).join(' '));
      control.closest('.field')?.classList.add('rw-input-invalid');
    }
    inputErrors.hidden=!inputErrors.children.length;
  }
  status.querySelector('[data-fail-details]').addEventListener('click',()=>selectFlow('dc'));
  const print=tools.querySelector('[data-print]'),calculate=rail.querySelector('[data-action="calculate"]'),example=rail.querySelector('[data-action="example"]');
  const feedback=rail.querySelector('small'),defaultFeedback=feedback.textContent,lockedInputs=new Map();
  feedback.classList.add('rw-calculation-feedback');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');feedback.setAttribute('aria-atomic','true');
  function calculationFeedback(phase,text=defaultFeedback){rail.dataset.calculationPhase=phase;feedback.textContent=text;}
  function lockInputs(){for(const control of inputs.querySelectorAll('input,select,textarea')){if(!lockedInputs.has(control))lockedInputs.set(control,control.disabled);control.disabled=true;}}
  function unlockInputs(){for(const [control,disabled]of lockedInputs)if(control.isConnected)control.disabled=disabled;lockedInputs.clear();}
  const calculationRun=createCalculationRun({
    calculate:()=>onCalculate?.(),
    onStart(){
      notice('');
      lockInputs();
      calculationFeedback('running','กำลังคำนวณ… รอผลจากข้อมูลที่กรอก');
      setState({state:'RUNNING',title:'กำลังคำนวณ…',detail:'กำลังสร้างผลตรวจ แรง และรายงานจากข้อมูลชุดนี้',running:true});
    },
    onFinish(outcome){
      unlockInputs();calculationFeedback(outcome,outcome==='complete'?'คำนวณเสร็จแล้ว · ดูผลตรวจ D/C':'คำนวณไม่สำเร็จ · ตรวจข้อมูลที่กรอก');
      if(outcome==='error'&&inputErrors.children.length)setArea('work');
      if(outcome==='complete'){
        const title=status.querySelector('b'),text=title.textContent;
        title.textContent=text.startsWith('คำนวณแล้ว')?text.replace('คำนวณแล้ว','คำนวณเสร็จแล้ว'):'คำนวณเสร็จแล้ว · '+text;
        footer.querySelector('strong').textContent=title.textContent;
      }
    },
    onError(error){setState({state:'ERROR',title:'คำนวณไม่สำเร็จ',detail:String(error?.message||error)});notice(String(error?.message||error));},
  });
  // Both hosts refresh state after switching type so recovery follows that type.
  const restorePrevious=document.createElement('button');restorePrevious.type='button';restorePrevious.dataset.action='restore-previous';restorePrevious.textContent='คืนร่างก่อนอัปเดต';restorePrevious.title='คืนค่าร่างที่เก็บไว้ก่อนเปลี่ยนเป็นตัวอย่างใหม่ ผลเดิมจะถูกล้างและต้องกดคำนวณอีกครั้ง';restorePrevious.hidden=!hasPreviousDraft?.(type);rail.querySelector('.rw-rail-head').append(restorePrevious);
  restorePrevious.addEventListener('click',()=>{if(!running)invoke(onRestorePrevious,type);});
  function refreshInputGuide(){
    if(guideQueued||!readInputGuide)return;
    guideQueued=true;
    // Both adapters update the form, status and view in one event. Draw the final
    // input state once before paint instead of rebuilding both SVGs at each step.
    queueMicrotask(()=>{
      guideQueued=false;if(!guide.isConnected)return;
      const source=readInputGuide();
      for(const v of ['plan','section']){
        const accepted=ready&&source.snapshot;
        guide.querySelector('[data-draft-sheet="'+v+'"]>div').innerHTML=accepted
          ?renderNativeCadView(source.snapshot,v):renderInputCadView(source.type,source.input,field,v);
        guide.querySelector('.rw-guide-selection').textContent=accepted
          ?'แบบ CAD จากผลคำนวณชุดปัจจุบัน · มิติ มม. / ระดับ ม.':inputGuideNote(field);
      }
      scene?.update(source.type,source.input);
    });
  }
  function sync(){
    const summary=activeFlow==='summary',draft=summary||!ready;
    const layout=[activeFlow,currentView,sheet,ready].join('|');
    if(layout===lastLayout)return;
    lastLayout=layout;
    overview.hidden=!summary;tools.hidden=summary;
    guide.dataset.sheet=sheet==='both'?'section':sheet;
    guide.querySelectorAll('figure').forEach(figure=>{figure.hidden=figure.dataset.draftSheet!==guide.dataset.sheet;});
    guide.querySelectorAll('[data-guide-sheet]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.guideSheet===guide.dataset.sheet)));
    for(const [key,pane]of Object.entries(panes)){pane.hidden=summary||key!==currentView;pane.classList.toggle('active',!pane.hidden);pane.setAttribute('role','tabpanel');if(!pane.hidden)pane.setAttribute('aria-labelledby','rw-flow-'+activeFlow);}
    work.dataset.view=currentView;work.dataset.flow=activeFlow;work.dataset.sheet=sheet;work.dataset.draft=String(draft);
    work.dataset.documentMode='a4';
    tabs.forEach(b=>{const selected=b.dataset.flow===activeFlow;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;const v=b.dataset.flow==='drawing'?drawingView:FOOTING_FLOWS.find(([key])=>key===b.dataset.flow)[2];b.setAttribute('aria-controls',b.dataset.flow==='summary'?overview.id:panes[selected?currentView:v].id);});
    tools.querySelector('.rw-sheet-tabs').hidden=!['section','drawing'].includes(activeFlow)||currentView==='report';
    tools.querySelectorAll('[data-sheet]').forEach(b=>{b.setAttribute('aria-pressed',String(currentView==='plan'&&b.dataset.sheet===sheet));b.hidden=b.dataset.sheet==='freebody'&&!panes.plan.querySelector('.fbd');});
    tools.querySelector('[data-section-bars]').hidden=activeFlow!=='section';tools.querySelector('[data-section-bars]').setAttribute('aria-pressed',String(currentView==='bars'));
    print.hidden=activeFlow!=='report';print.disabled=!ready;
    scene?.setVisible(summary);
  }
  function selectFlow(flow){
    // Keep older callers working without exposing a second copy of this report.
    if(flow==='calc')flow='report';
    if(!FOOTING_FLOWS.some(([key])=>key===flow)||(!ready&&flow!=='summary'))return;
    activeFlow=flow;currentView=FOOTING_FLOWS.find(([key])=>key===flow)[2];
    if(flow==='section'){currentView=sectionMode;sheet='section';}
    if(flow==='drawing'){currentView=drawingView;sheet='both';}
    sync();setArea('work');invoke(onView,currentView,activeFlow);
  }
  function show(view){
    if(view===currentView&&work.dataset.flow===activeFlow)return;
    currentView=view;
    // Native adapters may call show again after loading a model/document.
    if(!(activeFlow==='drawing'&&view===drawingView)&&!(activeFlow==='section'&&['plan','bars'].includes(view))&&!(view==='report'&&activeFlow==='report')){
      activeFlow=({plan:'summary',checks:'dc',forces:'analysis',bars:'section',model:'three',report:'report'})[view]||'summary';
    }
    sync();
  }
  function select(view){if(view==='bars')sectionMode='bars';selectFlow(({plan:'summary',checks:'dc',forces:'analysis',bars:'section',model:'three',report:'report'})[view]||view);}
  function preview(){activeFlow='summary';currentView='plan';if(!['plan','section'].includes(sheet))sheet='section';sync();refreshInputGuide();}
  const inputPages=mountInputPages({inputs,heading:inputHeading,onPreview:preview,onReveal:()=>setArea('inputs')});
  inputs.append(rail);
  tabs.forEach(b=>b.addEventListener('click',()=>selectFlow(b.dataset.flow)));
  controls.querySelector('nav').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const enabled=tabs.filter(b=>!b.disabled),n=enabled.indexOf(e.target);if(n<0)return;e.preventDefault();const k=e.key==='Home'?0:e.key==='End'?enabled.length-1:(n+(e.key==='ArrowRight'?1:enabled.length-1))%enabled.length;enabled[k].click();enabled[k].focus();});
  header.querySelectorAll('[data-document]').forEach(b=>b.addEventListener('click',()=>selectFlow(b.dataset.document)));
  tools.addEventListener('click',e=>{const mode=e.target.closest('button[data-sheet]')?.dataset.sheet;if(mode){sheet=mode;sectionMode='plan';currentView='plan';sync();invoke(onView,'plan',activeFlow);}});
  tools.querySelector('[data-section-bars]').addEventListener('click',()=>{sectionMode='bars';currentView='bars';sync();invoke(onView,'bars',activeFlow);});
  guide.addEventListener('click',e=>{const mode=e.target.closest('[data-guide-sheet]')?.dataset.guideSheet;if(mode){sheet=mode;sync();}});
  calculate.addEventListener('click',()=>{if(!running)calculationRun.start();});example.addEventListener('click',()=>{if(!running)invoke(onExample,type);});print.addEventListener('click',()=>{if(ready)invoke(onPrint);});
  inputs.addEventListener('focusin',e=>{if(e.target.matches('input,select')){field=e.target.dataset.key||e.target.id;if(readInputGuide)sheet=inputGuideView(field);preview();}});
  for(const event of ['input','change'])inputs.addEventListener(event,e=>{if(e.target.matches('input,select')){clearInputErrors();if(!calculationRun.active)calculationFeedback('idle');field=e.target.dataset.key||e.target.id;preview();}});
  const message=document.createElement('p');message.className='rw-flow-message';message.setAttribute('role','alert');message.hidden=true;inputHeading.after(message);
  function notice(text){message.hidden=!text;message.textContent=text||'';if(text)setArea('inputs');}
  function refreshInputGroups(){
    if(groupsQueued)return;
    groupsQueued=true;
    // Type changes replace the native fields after setType. Re-page only the
    // completed form, so the old and new category bars never alternate.
    queueMicrotask(()=>{groupsQueued=false;if(inputs.isConnected)inputPages.refresh(type);});
  }
  function measure(){
    // Hidden retained iframes report zero-size boxes. Keep the last real layout
    // until activation, rather than moving the picker underneath the header.
    if(window.frameElement?.hidden)return;
    const h=header.getBoundingClientRect().height,s=systems.getBoundingClientRect().height;
    if(h>0)document.body.style.setProperty('--rw-header-height',h+'px');
    if(s>0)document.body.style.setProperty('--rw-systems-height',s+'px');
  }
  new ResizeObserver(measure).observe(header);new ResizeObserver(measure).observe(systems);style.addEventListener('load',measure);
  scene=mountInputScene(overview.querySelector('.rw-input-model-stage'),overview.querySelector('.rw-live-model'));
  if(!inputs.querySelector('#systemFields')||inputs.querySelector('#systemFields [data-input-group]'))refreshInputGroups();
  refreshInputGuide();sync();measure();document.body.classList.add('rw-ft-ready');
  function setState({state,title,detail,failure=null,validationErrors=[],ready:nextReady=false,running:busy=false}){
      if(state==='ERROR')showInputErrors(validationErrors);else clearInputErrors();
      ready=nextReady;running=busy;status.dataset.state=state;status.querySelector('b').textContent=title;
      const detailText=state==='ERROR'&&validationErrors.length&&validationErrors.every(item=>item.field)
        ?'แก้ข้อมูลที่ระบุ แล้วกดคำนวณอีกครั้ง':detail||'';
      status.querySelector('span').textContent=detailText+(!ready&&hasPreviousDraft?.(type)?' · ร่างก่อนอัปเดตเก็บไว้ที่ปุ่มคืนร่างก่อนอัปเดต':'');
      if(running&&calculationRun.active)lockInputs();
      const showFailure=state==='FAIL'&&ready&&!running&&failure&&failure.count>0;
      const failureBox=status.querySelector('.rw-flow-failure'),failureButton=status.querySelector('[data-fail-details]');
      failureBox.hidden=!showFailure;failureButton.hidden=!showFailure;
      if(showFailure){
        const first=failure.first||{};
        failureBox.querySelector('[data-fail-first]').textContent='รายการแรก: '+(first.key||'—')
          +' · '+(first.value||'—')+' · เกณฑ์ '+(first.criterion||'—');
        failureBox.querySelector('[data-fail-advice]').textContent=failure.adviceText||'ยังไม่มีค่าปรับที่ตรวจซ้ำผ่านครบ';
        failureBox.querySelector('[data-fail-caveat]').textContent=failure.caveat||'';
      }else{
        failureBox.querySelector('[data-fail-first]').textContent='';
        failureBox.querySelector('[data-fail-advice]').textContent='';
        failureBox.querySelector('[data-fail-caveat]').textContent='';
      }
      rail.querySelector('p').textContent=title;footer.querySelector('strong').textContent=title;
      calculate.disabled=running;calculate.setAttribute('aria-busy',String(running));example.disabled=running;restorePrevious.disabled=running;restorePrevious.hidden=!hasPreviousDraft?.(type);calculate.textContent=running?'กำลังคำนวณ…':type==='duckfoot'?'คำนวณฐานตีนเป็ด':'คำนวณกำแพงกันดิน';
      tabs.forEach(b=>{b.disabled=running||(!ready&&b.dataset.flow!=='summary');b.title=b.disabled?'กรอกข้อมูลแล้วกดคำนวณก่อนเปิดผล':'';});
      systems.querySelectorAll('[data-system]').forEach(b=>{b.disabled=running;});
      header.querySelectorAll('[data-document]').forEach(b=>{b.disabled=!ready;});
      for(const key of ['save','open'])header.querySelector('[data-action="'+key+'"]').disabled=running;
      work.dataset.current=String(ready);if(!ready){activeFlow='summary';currentView='plan';}sync();refreshInputGuide();
      calculationRun.observe({state,ready,running});
      if(!calculationRun.active&&!ready&&!running&&state!=='ERROR')calculationFeedback('idle');
  }
  return {show,select,notice,refreshInputGuide,refreshInputGroups,setState,isViewing:view=>currentView===view,
    navigateType(next,url){
      if(parent!==window){try{if(parent.document.querySelector('.rw-shell[data-system-host="retained"]')){
        parent.postMessage({type:'rw:workbench-system',system:next},location.origin);return;
      }}catch{/* A standalone host retains its ordinary navigation path. */}}
      location.assign(url);
    },
    revealInput(target){setArea('inputs');preview();inputPages.reveal(target);},
    setType(next){if(type===next)return;calculationFeedback('idle');setArea('inputs');type=next;selector.value=next;systems.querySelectorAll('[data-system]').forEach(b=>{b.setAttribute('aria-checked',String(b.dataset.system===next));b.tabIndex=b.dataset.system===next?0:-1;});field='';activeFlow='summary';currentView='plan';const url=new URL(location.href);url.searchParams.set('type',type);history.replaceState(null,'',url);refreshInputGroups();refreshInputGuide();sync();},
  };
}
