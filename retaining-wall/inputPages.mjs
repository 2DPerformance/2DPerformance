// Page existing form nodes without cloning their values or event listeners.
export function mountInputPages({ inputs, heading, onPreview, onReveal }) {
  const nav = document.createElement('nav');
  nav.className = 'rw-entry-nav'; nav.setAttribute('aria-label', 'หมวดข้อมูลออกแบบ');
  heading.after(nav);
  const footer = document.createElement('div'); footer.className = 'rw-entry-footer';
  footer.innerHTML = '<button type="button" data-step="previous">← ก่อนหน้า</button><span></span><button type="button" data-step="next">ถัดไป →</button>';
  inputs.append(footer);
  let pages = [], current = '', formType = '', parts = [], partIndex = 0, frame = 0;
  const pageObserver=new ResizeObserver(scheduleLayout);
  function updateFooter() {
    const index=pages.findIndex(page=>page.dataset.inputGroup===current);
    footer.querySelector('span').textContent = `หมวด ${index + 1}/${pages.length}`+(parts.length>1?` · หน้า ${partIndex+1}/${parts.length}`:'');
    footer.querySelector('[data-step="previous"]').disabled = index <= 0 && partIndex === 0;
    footer.querySelector('[data-step="next"]').disabled = index >= pages.length - 1 && partIndex >= parts.length-1;
  }
  function showPart(index) {
    const page=pages.find(item=>item.dataset.inputGroup===current);
    partIndex=Math.max(0,Math.min(index,parts.length-1));
    parts.forEach((nodes,k)=>nodes.forEach(node=>node.classList.toggle('rw-part-hidden',k!==partIndex)));
    page?.querySelectorAll(':scope > .field-grid,:scope > .form-grid').forEach(grid=>{
      grid.classList.toggle('rw-part-hidden',[...grid.children].every(node=>node.classList.contains('rw-part-hidden')));
    });
    if(page)page.scrollTop=0;
    updateFooter();
  }
  // Measure real rows at the current palette size. Keep the original controls;
  // only paginate their visibility, so no value/listener/draft is duplicated.
  function paginate(target) {
    const page=pages.find(item=>item.dataset.inputGroup===current);
    if(!page||inputs.hidden||page.clientHeight<80)return;
    page.querySelectorAll('.rw-part-hidden').forEach(node=>node.classList.remove('rw-part-hidden'));
    const title=page.querySelector(':scope > h2'),rows=[];
    const budget=Math.max(72,page.clientHeight-(title?title.getBoundingClientRect().height+12:0)-12);
    for(const node of page.children){
      if(node===title)continue;
      if(node.matches('.field-grid,.form-grid')){
        const gap=parseFloat(getComputedStyle(node).rowGap)||12;
        let row=null;
        for(const field of node.children){
          const rect=field.getBoundingClientRect();if(!rect.height)continue;
          if(!row||Math.abs(row.top-rect.top)>2){row={top:rect.top,height:rect.height+gap,nodes:[]};rows.push(row);}
          row.height=Math.max(row.height,rect.height+gap);row.nodes.push(field);
        }
      }else{
        const rect=node.getBoundingClientRect();
        if(rect.height)rows.push({height:rect.height+16,nodes:[node]});
      }
    }
    parts=[];let used=0;
    for(const row of rows){
      if(!parts.length||used+row.height>budget){parts.push([]);used=0;}
      parts.at(-1).push(...row.nodes);used+=row.height;
    }
    const targetPart=target?parts.findIndex(nodes=>nodes.some(node=>node===target||node.contains(target))):-1;
    showPart(targetPart<0?partIndex:targetPart);
  }
  function select(key, preview = true, lastPart = false) {
    const index = Math.max(0, pages.findIndex(page => page.dataset.inputGroup === key));
    current = pages[index]?.dataset.inputGroup || '';
    pageObserver.disconnect();if(pages[index])pageObserver.observe(pages[index]);
    partIndex=lastPart?Number.MAX_SAFE_INTEGER:0;
    inputs.querySelectorAll('[data-input-group]').forEach(page => {
      page.hidden = page.dataset.inputGroup !== current;
      if (!page.hidden) page.scrollTop = 0;
    });
    nav.querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.group === current)));
    paginate();updateFooter();
    if (preview) onPreview?.();
  }
  function refresh(type) {
    if (type !== formType) current = '';
    formType = type;
    pages = [...inputs.querySelectorAll('[data-input-group]')].filter(page => !page.dataset.formTypes || page.dataset.formTypes.split(' ').includes(type));
    nav.replaceChildren(...pages.map((page, index) => {
      page.id ||= 'rw-input-' + page.dataset.inputGroup;
      page.classList.add('rw-entry-page');
      const button = document.createElement('button'); button.type = 'button';
      button.dataset.group = page.dataset.inputGroup;
      button.setAttribute('aria-controls', page.id);
      const number = document.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
      button.append(number, document.createTextNode(page.dataset.groupLabel || page.querySelector('h2')?.textContent || 'ข้อมูล'));
      button.addEventListener('click', () => select(page.dataset.inputGroup));
      return button;
    }));
    select(current, false);
  }
  footer.addEventListener('click', event => {
    const step = event.target.closest('[data-step]')?.dataset.step;
    if (!step) return;
    const index = pages.findIndex(page => page.dataset.inputGroup === current);
    if(step==='next'&&partIndex<parts.length-1){showPart(partIndex+1);onPreview?.();return;}
    if(step==='previous'&&partIndex>0){showPart(partIndex-1);onPreview?.();return;}
    const next = pages[index + (step === 'next' ? 1 : -1)];
    if (next) select(next.dataset.inputGroup,true,step==='previous');
  });
  nav.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const buttons = [...nav.querySelectorAll('button')], index = buttons.indexOf(event.target);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length;
    buttons[next].click(); buttons[next].focus();
  });
  function reveal(target, focus = true) {
    onReveal?.();
    const page = target?.closest('[data-input-group]');
    if (page) select(page.dataset.inputGroup);
    paginate(target);
    if (focus && !target?.disabled) target?.focus({ preventScroll: true });
  }
  function scheduleLayout(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>paginate(inputs.contains(document.activeElement)?document.activeElement:null));}
  new ResizeObserver(scheduleLayout).observe(inputs);
  inputs.addEventListener('toggle',scheduleLayout,true);
  inputs.addEventListener('invalid', event => reveal(event.target), true);
  return { refresh, reveal };
}

export function groupLegacyInputs(inputs) {
  const specs = [
    ['dimensions', 'ขนาด', 'ขนาดกำแพงและฐาน', ['H','B','baseT','toe','stemT','heel','wallLength']],
    ['ribs', 'ครีบ', 'ขนาดและระยะครีบ', ['cfSpan','cfThick','cfDepth','cfHeight'], 'counterfort'],
    ['soil', 'ดิน', 'ข้อมูลดินและฐานรองรับ', ['phi','gamma','gammaSat','delta','wallDelta','qa','frontDepth']],
    ['water', 'น้ำ', 'ระดับน้ำและแรงต้านหน้าฐาน', ['waterEnabled','waterH','gammaW','passiveFactor','includeSurchargeWeight']],
    ['loads', 'แรงกระทำ', 'น้ำหนักบรรทุกและแรงกระทำ', ['surchargeD','surcharge','surchargeTotal','lineLoad','lineLoadHeight','gammaC']],
    ['materials', 'วัสดุ', 'วัสดุและมาตรฐานคำนวณ', ['fc','fy','cover','code']],
    ['project', 'โครงการ', 'โครงการ หน่วย และค่าคงที่', ['projectName','unitMode']],
  ];
  const sources = [...inputs.querySelectorAll(':scope > .card')];
  for (const [key,label,title,ids,types] of specs) {
    const page = document.createElement('section'); page.dataset.inputGroup = key; page.dataset.groupLabel = label;
    if (types) page.dataset.formTypes = types;
    const h = document.createElement('h2'); h.textContent = title;
    const grid = document.createElement('div'); grid.className = 'form-grid'; page.append(h, grid);
    for (const id of ids) {
      const input = inputs.querySelector('#' + id);
      const field = input?.type === 'checkbox' ? input.closest('.toggle-row') : input?.closest('.field');
      if(input?.type==='checkbox'){
        input.setAttribute('aria-label',id==='waterEnabled'?'พิจารณาแรงดันน้ำใต้ดิน':'รวม q บน Heel เป็นน้ำหนักต้านทาน');
        input.closest('.switch')?.classList.add('rw-native-check');
        const slider=field?.querySelector('.slider');if(slider)slider.hidden=true;
      }
      if (field) grid.append(field);
    }
    if (key === 'project') for (const selector of ['.profile-detail','#wallModeNote','.calc-basis']) {
      const node = inputs.querySelector(selector); if (node) page.append(node);
    }
    inputs.append(page);
  }
  sources.forEach(source => { source.hidden = true; });
}
