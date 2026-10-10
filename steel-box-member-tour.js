/* View-only teaching for the current SC01 form. Never applies or calculates. */
(function (root) {
  'use strict';
  const doc = root.document, KEY = 'ncy.sc01.member-tour.seen.v1';
  const $ = id => doc.getElementById(id);
  const workflow = () => root.NCYSC01MemberWorkflow;
  const enabled = () => workflow()?.active && root.__scCustomerEntryAuthorized && !root.__scWorkbenchBootFailed;
  const visible = el => Boolean(el?.isConnected && el.getClientRects().length);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const STEPS = Object.freeze([
    {id:'support',title:'มาตรฐาน หน่วย และจุดรองรับ',group:0,target:'[data-sm-path="support.type"]',
      text:'เริ่มจากมาตรฐานและหน่วย SI / kgf แล้วเลือกฐานจริง: ผนัง คานคอนกรีต เสาซ้าย–ขวาพร้อมคาน หรือเชื่อมเพลทกับ H-beam ฐานในโมเดลถือว่าแข็ง กำลังฐานเดิมตรวจแยก'},
    {id:'sections',title:'เลือกเหล็กคานและแป',group:1,target:'#sm-steel-catalog',
      text:'เลือกหน้าตัด H × B × t จากรายการตลาด โดย H ของแปตั้งแนวดิ่ง ถ้าใช้โครงถัก ให้เลือกแบบและเหล็กทแยง/ตั้งด้วย หลังคำนวณยังเปลี่ยนไปเลือกขนาดที่รับแรงได้'},
    {id:'connection',title:'เพลท รอยเชื่อม และพุก',group:1,target:'#sm-connection-inputs > summary',open:'#sm-connection-inputs',
      text:'เพลทเริ่มจากด้านใหญ่สุดของเหล็ก + 2 นิ้ว แล้วปรับตามระยะรูและแรง พุกใหม่อยู่ 4 มุมพ้นหน้าตัด เลือกแนวเชื่อมและสภาพติดตั้งให้ตรงงาน หรือเลือกชุดที่คำนวณให้หลังเลือกเหล็ก'},
    {id:'geometry',title:'กรอกระยะให้ตรงกับแบบ',group:2,target:'[data-sm-path="geometry.widthM"]',
      text:'ความกว้างรวมคือแนวตามผนัง คานยื่นคือระยะจากฐานถึงปลาย ช่วงแปคือระหว่างคานรองรับ ส่วน @ แปคือระยะซอยตามคาน ดูจำนวนและช่วงเศษที่โปรแกรมจัดจริงใต้ช่องกรอก'},
    {id:'loads',title:'กำหนด DL และ LL',group:3,target:'.sm-mode[aria-label="วิธีกำหนด DL"]',
      text:'DL เลือกจากวัสดุหรือกรอกเองได้ โปรแกรมบวกน้ำหนักคานและแปแยกหนึ่งครั้ง LL กระจายตลอดแนวแป อ่านหน่วยข้างช่องทุกครั้ง เพิ่มแรงลมหรือสลิงเฉพาะงานที่ใช้จริง'},
    {id:'calculate',title:'คำนวณ แล้วเลือกชุดวัสดุ',target:'#sc01RunCalculation',
      text:'กด “คำนวณและดูผล” เมื่อเปิดตัวเลือกวัสดุ ให้เลือกเหล็กที่ D/C ≤ 1 และแอ่นไม่เกินเกณฑ์ จากนั้นเลือกชุดเพลท/จุดยึด แล้วกด “ใช้ชุดนี้และคำนวณทั้งงาน” การเลือกแถวอย่างเดียวยังไม่เปลี่ยนงาน'},
    {id:'results',title:'ตรวจผลให้ครบทุกชิ้นส่วน',target:'#sm-results',stage:'review',
      text:'อ่านกำลังคาน แป การแอ่น เพลท รอยเชื่อม และพุก เปิดรายการที่ไม่ผ่านหรือข้อมูลไม่ครบเพื่อดูเหตุผล D/C ในเกณฑ์เพียงบางรายการยังไม่ทำให้ทั้งงานผ่าน'},
    {id:'diagrams',title:'ดูแรง แบบ และการแอ่น',target:'#pageTabs',stage:'model',
      text:'ใช้แท็บเดิมดูการถ่ายแรง 2D/3D เพลทสีน้ำเงิน และ CAD/DXF ใน SFD/BMD ให้เลือกคานหรือแป กรณีแรง และชนิดกราฟ: V แรงเฉือน, M โมเมนต์, δ การแอ่น'},
    {id:'documents',title:'รายงานและบันทึกงาน',target:'#sm-report',stage:'review',
      text:'เมื่อทุกส่วนผ่านและผลยังตรงข้อมูล กด “รายการคำนวณ / PDF” เพื่อดูแปลน หน้าตัด กราฟ และจุดยึดเป็นกลุ่ม บันทึกร่างหรือดาวน์โหลด JSON จาก Save / Open เมื่อเปิดงานอีกครั้งต้องคำนวณใหม่'}
  ]);
  let panel, target, returnFocus, observer, raf = 0, index = 0, minimized = false, invitation = false, notice = '';
  const removers = [];
  function listen(host, name, fn, options) { host.addEventListener(name, fn, options); removers.push(() => host.removeEventListener(name, fn, options)); }
  function seen() { try { return root.localStorage.getItem(KEY) === '1'; } catch { return true; } }
  function remember() { try { root.localStorage.setItem(KEY, '1'); } catch { /* Help remains available without preference storage. */ } }
  function status() {
    if (notice) return notice;
    const id = STEPS[index].id;
    if (['calculate','results','documents'].includes(id)) {
      if (workflow()?.isSelecting()) return 'กำลังค้นหาตัวเลือก · รอรายการ หรือเลือกแถวที่แสดงแล้วได้';
      const choices = $('sm-trials');
      if (choices && !choices.hidden && choices.querySelector('[data-sm-choice-slot]')) return 'ยังเป็นชุดที่กำลังเลือก · ต้องยืนยันและคำนวณทั้งงานก่อนเปิดรายงาน';
      if (!$('sm-report')?.disabled) return 'ผลปัจจุบันเปิดรายงานได้ · ตรวจรายละเอียดในผลการตรวจสอบ';
      const heading = $('sm-results')?.querySelector('h2')?.textContent;
      if (heading === 'ยังคำนวณไม่ได้') return 'ข้อมูลกรอกยังไม่ครบ · กลับไปแก้ช่องที่ระบุ แล้วคำนวณใหม่';
      if (!heading || heading === 'ผลตรวจ') return 'ยังไม่มีผลปัจจุบัน · กดคำนวณหลังกรอกหรือแก้ข้อมูล';
      return $('sm-report-status')?.textContent || 'ตรวจรายการที่ยังไม่ผ่านก่อนเปิดรายงาน';
    }
    return 'กด “พาไปจุดนี้” เพื่อดูช่องจริง หรืออ่านขั้นถัดไปได้ทันที';
  }
  function position() {
    if (!panel) return;
    const rect = target?.getBoundingClientRect();
    panel.dataset.side = rect && rect.left > root.innerWidth / 2 ? 'left' : 'right';
    panel.dataset.dock = rect && rect.top + rect.height / 2 > root.innerHeight / 2 ? 'top' : 'bottom';
  }
  function refresh() {
    if (!panel) return;
    const modal = doc.querySelector('dialog[open]');
    panel.hidden = Boolean(modal);
    const next = invitation || modal ? null : [...doc.querySelectorAll(STEPS[index].target)].find(visible);
    if (next !== target) { target?.classList.remove('sc01-tour-target'); target = next; target?.classList.add('sc01-tour-target'); }
    const el = $('sc01MemberTourStatus'), text = status();
    if (el && el.textContent !== text) el.textContent = text;
    position();
  }
  function schedule() { if (!panel || raf) return; raf = root.requestAnimationFrame(() => { raf = 0; refresh(); }); }
  function render() {
    if (!panel) return;
    panel.classList.toggle('is-minimized', minimized);
    const title = invitation ? 'เริ่มใช้งาน SC-01' : minimized ? `สอนใช้งาน ${index + 1} / ${STEPS.length}` : STEPS[index].title;
    panel.innerHTML = `<header class="sc01-tour-head"><div><span>${invitation ? 'คำแนะนำบนหน้าจอจริง' : `ขั้น ${index + 1} / ${STEPS.length}`}</span><h2 id="sc01MemberTourTitle">${esc(title)}</h2></div><div class="sc01-tour-tools">${invitation?'':`<button type="button" data-sm-tour="minimize" aria-label="${minimized?'ขยายคำแนะนำ':'ย่อคำแนะนำ'}" aria-expanded="${!minimized}">${minimized?'ขยาย':'ย่อ'}</button>`}<button type="button" data-sm-tour="close" aria-label="ปิดการสอนใช้งาน">✕</button></div></header>
      <div class="sc01-tour-body" ${minimized?'hidden':''}>${invitation?'<p>กรอก 4 กลุ่มตามลำดับ แล้วเลือกวัสดุจากผลคำนวณ คำแนะนำจะพาไปยังช่องและปุ่มที่ใช้งานจริง</p><p class="sc01-tour-status">จุดรองรับ → เหล็กและจุดต่อ → ระยะ → โหลด → ผลและรายงาน</p><div class="sc01-tour-navigation"><button type="button" data-sm-tour="close">ไว้ภายหลัง</button><button type="button" class="sc01-tour-next" data-sm-tour="begin">เริ่มสอนใช้งาน</button></div><p class="sc01-tour-reopen">เปิดได้อีกจาก ช่วยใช้งาน → สอนใช้งานทีละขั้น</p>':`
        <p>${esc(STEPS[index].text)}</p><p id="sc01MemberTourStatus" class="sc01-tour-status" role="status" aria-live="polite"></p><button type="button" class="sc01-tour-locate" data-sm-tour="locate">พาไปจุดนี้ ↗</button>
        <div class="sc01-tour-navigation"><button type="button" data-sm-tour="previous" ${index===0?'disabled':''}>ย้อนกลับ</button><button type="button" class="sc01-tour-next" data-sm-tour="next">${index===STEPS.length-1?'จบการสอน':'ขั้นถัดไป →'}</button></div><footer><button type="button" data-sm-tour="restart">เริ่มสอนใหม่</button><span>อ่านคำแนะนำได้ทุกขั้น<br>ผลผ่านดูที่ผลการตรวจสอบ</span></footer>`}</div>`;
    refresh();
  }
  function navigate(selector) {
    const button = [...doc.querySelectorAll(selector)].find(visible);
    if (!button || button.disabled) return false;
    button.click(); return true;
  }
  function locate(focus = true) {
    if (!panel || invitation) return false;
    if (doc.querySelector('dialog[open]')) return false;
    notice = ''; const step = STEPS[index];
    // Only existing view controls are invoked. Never invoke Calculate, Apply,
    // Save, a selector, or an input event from a teaching action.
    if (step.group !== undefined) {
      navigate('[data-ncy670-stage="input"]');
      const group = doc.querySelectorAll('#sm-form > .sm-group')[step.group];
      if (group) group.open = true;
      if (step.open && doc.querySelector(step.open)) doc.querySelector(step.open).open = true;
    } else if (step.stage) navigate(`[data-ncy670-stage="${step.stage}"]`);
    refresh();
    if (!target) { notice = 'จุดนี้ยังไม่เปิดในหน้าปัจจุบัน ใช้แท็บกรอกข้อมูลหรือผลคำนวณก่อน แล้วลองอีกครั้ง'; refresh(); return false; }
    target.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    if (focus && target.matches('button,input,select,summary,textarea,[tabindex]')) target.focus({preventScroll:true});
    if (focus && root.innerWidth <= 680) { minimized = true; render(); }
    position(); return true;
  }
  function stepTo(nextIndex) {
    index = nextIndex; invitation = false; minimized = false; notice = ''; remember(); render(); locate(false);
    panel?.querySelector('[data-sm-tour="next"]')?.focus({preventScroll:true});
  }
  function close() {
    if (!panel) return;
    remember(); observer?.disconnect(); observer = null;
    if (raf) root.cancelAnimationFrame(raf); raf = 0;
    while (removers.length) removers.pop()();
    target?.classList.remove('sc01-tour-target'); target = null;
    panel.remove(); panel = null;
    const fallback = $('sc01r12Help')?.querySelector('summary');
    if (visible(returnFocus)) returnFocus.focus({preventScroll:true});
    else if (visible(fallback)) fallback.focus({preventScroll:true});
  }
  function minimize(value) { if (panel) { minimized = typeof value === 'boolean' ? value : !minimized; render(); panel.querySelector('[data-sm-tour="minimize"]')?.focus({preventScroll:true}); } }
  function next() { if (!panel) return false; if (index === STEPS.length-1) close(); else stepTo(index+1); return true; }
  function previous() { if (!panel || index === 0) return false; stepTo(index-1); return true; }
  function start(options = {}) {
    if (!enabled()) return false;
    if (panel) { if (options.invitation) return true; stepTo(0); return true; }
    invitation = options.invitation === true; index = 0; minimized = false; notice = ''; returnFocus = doc.activeElement;
    panel = doc.createElement('aside'); panel.id = 'sc01MemberTour'; panel.className = 'sc01-tour sc01-member-tour';
    panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','false'); panel.setAttribute('aria-labelledby','sc01MemberTourTitle'); doc.body.append(panel);
    listen(panel,'click',e => { const a = e.target.closest('[data-sm-tour]')?.dataset.smTour; if(!a)return; e.preventDefault(); ({close,minimize,locate,next,previous,begin:()=>stepTo(0),restart:()=>stepTo(0)})[a]?.(); });
    listen(root,'keydown',e => { if (e.key === 'Escape' && !doc.querySelector('dialog[open]')) { e.preventDefault(); close(); } });
    listen(doc,'input',schedule,true); listen(doc,'change',schedule,true); listen(doc,'click',schedule,true);
    listen(doc,'scroll',schedule,{capture:true,passive:true}); listen(root,'resize',schedule,{passive:true});
    observer = new root.MutationObserver(records => { if (records.some(r=>!panel?.contains(r.target))) schedule(); });
    observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','disabled','hidden']});
    render();
    if (!invitation) { remember(); locate(false); panel.querySelector('[data-sm-tour="next"]')?.focus({preventScroll:true}); }
    return true;
  }
  root.NCYSC01MemberTour = Object.freeze({VERSION:'20260914-r48',STEPS,start,close,minimize,next,previous,locate,restart:()=>panel?stepTo(0):start(),getState:()=>({active:Boolean(panel),invitation,index,step:STEPS[index].id,minimized})});
  // Deferred scripts and the current workflow module finish before load. The
  // startup observer is bounded, disconnected on success/timeout, and read-only.
  function offer() {
    let watcher, timeout;
    const ready = () => {
      if (!enabled() || doc.documentElement.dataset.sc01Startup !== 'ready') return;
      watcher?.disconnect(); root.clearTimeout(timeout);
      const launcher = $('sc01DemoOpen'); if (launcher) launcher.textContent = 'สอนใช้งานทีละขั้น';
      if (!seen() && !doc.querySelector('dialog[open]')) start({invitation:true});
    };
    watcher = new root.MutationObserver(ready); watcher.observe(doc.documentElement,{attributes:true,attributeFilter:['data-sc01-startup']});
    timeout = root.setTimeout(()=>watcher.disconnect(),15000); ready();
  }
  if (doc.readyState === 'complete') offer(); else root.addEventListener('load',offer,{once:true});
})(window);
