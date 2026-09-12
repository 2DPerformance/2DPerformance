(function (root) {
  'use strict';
  const G = root.NCYSC01WeldGeometry;
  if (!G) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '—';
  const names = {all:'รอบหน้าตัด 4 ด้าน',vertical:'แนวดิ่ง 2 ด้านตรงข้าม',horizontal:'แนวนอน 2 ด้านตรงข้าม'};
  function explain(s) {
    const g = G.describe(s);
    const interval = g.intervalFeasible
      ? `ช่วงขารอยเชื่อมตามแบบจำลอง ${fmt(g.minSize)}–${fmt(g.maxSize)} มม.`
      : `ไม่มีช่วงฟิลเลตที่ใช้ได้ในแบบจำลองนี้: ขั้นต่ำ ${fmt(g.minSize)} > สูงสุด ${fmt(g.maxSize)} มม.`;
    const oversize = Number.isFinite(g.leg) && g.leg > g.maxSize;
    return {g,interval,oversize,section:`${fmt(g.H)} × ${fmt(g.B)} × ${fmt(g.wallNominal)} มม.`,
      message: !g.valid ? 'ตรวจรูปแบบแนวเชื่อมและตัวคูณความยาวที่มากกว่า 0 ไม่เกิน 1'
        : !g.intervalFeasible ? 'เพิ่มขารอยเชื่อมเป็น 5 หรือ 6 ไม่แก้ปัญหาผนังบาง ต้องตรวจหน้าตัดหรือรายละเอียดรอยต่อ/WPS ที่เหมาะสมก่อน'
        : oversize ? `ขา ${fmt(g.leg)} มม. เกินขอบวัสดุที่แบบจำลองยอมรับ อย่าเปลี่ยนหน่วยเป็นซม.หรือเพิ่มขาเพื่อบังคับให้ D/C ลด`
        : 'อยู่ในช่วงขนาดไม่ได้แปลว่ารับแรงผ่าน ต้องคำนวณความเค้นรอยเชื่อมและเนื้อเหล็กทุกกรณีแรงอีกครั้ง'};
  }
  function html(s, id) {
    const x=explain(s),g=x.g;
    const vertical=g.pattern==='all'||g.pattern==='vertical',horizontal=g.pattern==='all'||g.pattern==='horizontal';
    return `<header><strong>ขาเชื่อม ≠ ความยาวแนวเชื่อม</strong><span>หน่วย มม. (mm)</span></header>
      <p id="${esc(id)}-units">ค่าที่กรอก <b>w = ${fmt(g.leg)} มม. = ${fmt(g.leg/10)} ซม.</b> คือขาสามเหลี่ยมรอยเชื่อม ไม่ใช่ความยาวที่ลากเชื่อม</p>
      <p>เหล็ก <b>${esc(x.section)}</b> · ผนังออกแบบ ${fmt(g.wallDesign)} มม. · เพลท ${fmt(g.plateThickness)} มม.</p>
      <p class="sc01-weld-range" data-feasible="${g.intervalFeasible}">${esc(x.interval)}</p>
      <p>${esc(x.message)}</p>
      <details><summary>ดูภาพขา w / คอ a / ความยาว Lw</summary>
      <div class="sc01-weld-meaning"><svg viewBox="0 0 300 148" role="img" aria-label="ขา w และคอ a เป็นหน้าตัดรอยเชื่อม ส่วนเส้นสีส้มบนกรอบเหล็กคือความยาวแนวเชื่อม">
        <path d="M25 18V113H128V128H10V18Z" fill="#cddbea" stroke="#657b91"/>
        <path d="M25 113H83L25 55Z" fill="#ffb66a" stroke="#9b531a" stroke-width="2"/>
        <path d="M25 113L54 84" stroke="#184f7a" stroke-width="2" stroke-dasharray="4 3"/>
        <text x="48" y="139">w</text><text x="5" y="82">w</text><text x="48" y="91">a</text>
        <rect x="192" y="27" width="78" height="78" fill="#e5edf5" stroke="#8295a6"/>
        <rect x="202" y="37" width="58" height="58" fill="white" stroke="#8295a6"/>
        ${vertical?'<path d="M185 27V105M277 27V105" stroke="#cf721a" stroke-width="4"/>':''}
        ${horizontal?'<path d="M192 20H270M192 112H270" stroke="#cf721a" stroke-width="4"/>':''}
        <text x="190" y="137">Lw · แนวเชื่อม</text>
      </svg><small>ภาพอธิบาย ไม่ใช่มาตราส่วนหรือรายละเอียดผลิต</small></div>
      <dl><dt>เหล็ก H × B × t</dt><dd>${esc(x.section)}</dd>
        <dt>ผนังหนาระบุ / ออกแบบ</dt><dd>${fmt(g.wallNominal)} / ${fmt(g.wallDesign)} มม.</dd>
        <dt>เพลทหนา</dt><dd>${fmt(g.plateThickness)} มม.</dd>
        <dt>คอเชื่อม a = 0.707w</dt><dd>${fmt(g.throat)} มม.</dd>
        <dt>${esc(names[g.pattern]||'ยังไม่เลือกแนว')}</dt><dd>Lw = ${fmt(g.pathLength)} มม.</dd>
        <dt>ความยาวใช้งาน Lw × ตัวคูณ</dt><dd>${fmt(g.pathLength)} × ${fmt(g.effectiveFactor)} = ${fmt(g.effectiveLength)} มม.</dd></dl>
      <small>แบบจำลองฟิลเลตปกติ: ไม่ถือว่าเป็นรอยเชื่อมร่องหรือรายละเอียดเต็มคอที่ตรวจรับแล้ว</small></details>`;
  }
  root.NCYSC01WeldExplanation=Object.freeze({explain,html});
  if (!root.document || !root.NCYApp) return;
  let frame=0;
  const rendered=new WeakMap();
  function mount(host,id,before,s) {
    if (!host) return;
    let node=document.getElementById(id);
    if (!node || node.parentElement!==host) { node?.remove();node=document.createElement('section');node.id=id;node.className='sc01-weld-explanation';host.insertBefore(node,before||null); }
    const content=html(s,id);
    if(rendered.get(node)!==content){rendered.set(node,content);node.innerHTML=content;}
  }
  function sync() {
    frame=0;
    observeDialogs();
    const s=root.NCYApp.getState(), group=document.getElementById('group-weld');
    if(!s?.member||!s?.weld)return;
    mount(group,'sc01WeldGeometry',null,s);
    const field=document.querySelector('[data-path="weld.size"]');
    if(field) {
      field.setAttribute('aria-describedby','sc01WeldGeometry-units');field.setAttribute('aria-label','ขารอยเชื่อม w หน่วยมิลลิเมตร ไม่ใช่ความยาวแนวเชื่อม');
      const label=field.closest('.field')?.querySelector('label');
      if(label?.firstChild?.nodeType===3&&label.firstChild.nodeValue!=='ขารอยเชื่อม w (มม.)')label.firstChild.nodeValue='ขารอยเชื่อม w (มม.)';
      let hint=field.closest('.field')?.querySelector('.sc01-weld-unit-hint');
      if(!hint){hint=document.createElement('small');hint.className='sc01-weld-unit-hint';field.closest('.field')?.appendChild(hint);}
      const value=`ขนาดขา ไม่ใช่ความยาวแนว · ${fmt(s.weld.size)} มม. = ${fmt(s.weld.size/10)} ซม.`;
      if(hint.textContent!==value)hint.textContent=value;
    }
    const current=document.querySelector('#sc01AssistantDialog .sc01-assist-current');
    if(current?.querySelector('h3')?.textContent.includes('รอยเชื่อม HSS'))mount(current,'sc01WeldAssistantGeometry',null,s);
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(sync);}
  for(const name of ['ncy:v5-updated','sc01:workspace-ready'])root.addEventListener(name,schedule);
  document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
  const observed=new WeakSet();
  function observeDialogs(){
    for(const id of ['inputPanel','sc01AssistantDialog']){const el=document.getElementById(id);if(el&&!observed.has(el)){observed.add(el);new MutationObserver(schedule).observe(el,{childList:true,subtree:true});}}
  }
  // The assistant is created lazily. Its launch click does not exist at boot.
  document.addEventListener('click',()=>{observeDialogs();schedule();},true);
  observeDialogs();
  sync();
})(typeof window==='undefined'?globalThis:window);
