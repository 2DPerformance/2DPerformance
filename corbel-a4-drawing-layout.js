/* CB-01 A4 layout only: clone native vector views; never write engineering data. */
(function install(root) {
  'use strict';
  const titles = {side:'A–A · รูปด้าน (ฉายเหล็กทุก z)',plan:'แปลนเหล็กเสริม',front:'B–B · โคนหูช้าง', 'corbel-vertical':'C–C · ปลอกแนวตั้งหูช้าง', 'support-vertical':'D–D · คานรองรับ', 'section-map':'แผนผังแนวตัดและตำแหน่งปลอก'};
  const cutViews = new Set(['front','corbel-vertical','support-vertical']);
  function node(tag, className, text) {
    const n=document.createElement(tag); n.className=className;
    if(text!==undefined)n.textContent=text; return n;
  }
  function locatorData(n) {
    return {letter:n.querySelector('text')?.textContent.match(/([A-Z])[-–][A-Z]/)?.[1],axis:n.dataset.locatorAxis,position:n.dataset.locatorPositionMm};
  }
  function joinedNotes(notes) {
    const groups=[];let previous;
    for(const n of notes){
      // Only these native sentences are deliberately wrapped; separate values stay separate.
      const continuation=previous&&((previous.value==='ยังไม่มีข้อมูล'&&n.value==='เหล็กตามยาวคาน')||(previous.value==='จุดบนและจุดล่าง Aₛ'&&/^เป็น [0-9]+ เส้นเดียวกัน$/.test(n.value))||(previous.value==='หูช้างต่อออกไป →'&&n.value==='(นอกกรอบตัด)'));
      const wrapped=continuation&&n.x===previous.x&&n.anchor===previous.anchor;
      const separator=previous&&/[ก-๙]$/.test(previous.value)&&/^[ก-๙]/.test(n.value)?'':' ';
      if(wrapped)groups[groups.length-1]+=separator+n.value;else groups.push(n.value);
      previous=n;
    }
    return groups.join(' · ');
  }
  function bounds(n,svg) {
    const b=n.getBBox(),m=svg.getCTM().inverse().multiply(n.getCTM()),p=svg.createSVGPoint();
    const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>{p.x=x;p.y=y;return p.matrixTransform(m);});
    return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
  }
  function spaceDimensionLabels(svg) {
    const outlines=[...svg.querySelectorAll('[data-cad-line="outline"]')].map(n=>bounds(n,svg));if(!outlines.length)return;
    const centerX=(Math.min(...outlines.map(b=>b.left))+Math.max(...outlines.map(b=>b.right)))/2,centerY=(Math.min(...outlines.map(b=>b.top))+Math.max(...outlines.map(b=>b.bottom)))/2;
    for(const group of svg.querySelectorAll('[data-dimension-extensions]')){
      const t=group.querySelector('text'),line=group.querySelectorAll('path')[2];if(!t||!line)throw new Error('Unknown dimension layout');
      if(t.dataset.paperBaseTransform===undefined)t.dataset.paperBaseTransform=t.getAttribute('transform')||'';
      t.setAttribute('transform',t.dataset.paperBaseTransform);
      const b=bounds(t,svg),d=bounds(line,svg),gap=5;let dx=0,dy=0;
      if(d.bottom-d.top<.1)dy=d.top>centerY?Math.max(0,d.top+gap-b.top):Math.min(0,d.top-gap-b.bottom);
      else dx=d.left>centerX?Math.max(0,d.left+gap-b.left):Math.min(0,d.left-gap-b.right);
      t.setAttribute('transform',`translate(${dx} ${dy}) ${t.dataset.paperBaseTransform}`.trim());
    }
  }
  function figure(source,allLocators) {
    const view=source.dataset.cadView,cut=cutViews.has(view),out=node('figure','ncy-a4-cad-figure');
    out.dataset.compactView=view;
    const caption=node('figcaption','ncy-a4-cad-caption');
    caption.append(node('b','',titles[view]||source.getAttribute('aria-label')),node('span','','mm · NTS'));
    const svg=source.cloneNode(true),ink=[...svg.children].find(n=>n.tagName.toLowerCase()==='g');
    if(!ink)throw new Error('Missing native drawing content: '+view);
    // Only the standalone white frame/title is replaced by the figure caption.
    const frame=[...ink.children].slice(0,4);
    if(frame[0]?.tagName.toLowerCase()!=='rect'||frame[1]?.tagName.toLowerCase()!=='rect'||frame[2]?.tagName.toLowerCase()!=='text')throw new Error('Unknown native drawing frame: '+view);
    frame.forEach(n=>n.remove());
    const notes=[],locators=[];
    const note=t=>notes.push({value:t.textContent,x:t.getAttribute('x'),y:Number(t.getAttribute('y')),anchor:t.getAttribute('text-anchor')||'start',size:Number(t.getAttribute('font-size'))||18});
    svg.querySelectorAll('[data-section-locator]').forEach(n=>{
      locators.push(locatorData(n));n.remove();
    });
    const legend=node('div','ncy-a4-cad-key');
    {
      svg.querySelectorAll('[data-view-key]').forEach(key=>{
        const texts=[...key.querySelectorAll('text')].map(n=>n.textContent),entry=node('div','ncy-a4-cad-key-entry');
        entry.dataset.viewKey=key.dataset.viewKey;entry.append(node('b','',texts.shift()),node('span','',texts.join(' · ')));legend.append(entry);key.remove();
      });
      if(cut)svg.querySelectorAll('[data-direct-callout]').forEach(mark=>{
        const leader=mark.querySelector('[data-leader-route]'),bubble=[...mark.querySelectorAll('circle')].find(c=>!c.hasAttribute('data-leader-endpoint'));
        const number=[...mark.querySelectorAll('text')].find(t=>t.getAttribute('text-anchor')==='middle');
        if(!leader||!bubble||!number)throw new Error('Unknown direct leader: '+view);
        mark.dataset.sourceCallout=[...mark.querySelectorAll('text')].map(t=>t.textContent).join(' · ');
        if(!/^M245 /.test(leader.getAttribute('d')))throw new Error('Unknown native leader start: '+view);
        leader.dataset.nativeLeaderPath=leader.getAttribute('d');
        leader.setAttribute('d',leader.getAttribute('d').replace(/^M245 /,'M238 '));
        bubble.setAttribute('cx','222');bubble.setAttribute('r','16');bubble.dataset.compactNumber='true';
        number.setAttribute('x','222');number.setAttribute('y',String(Number(bubble.getAttribute('cy'))+8));number.dataset.compactNumber='true';
        [...mark.querySelectorAll('text')].filter(t=>t!==number).forEach(t=>t.remove());
      });
    }
    const noteY=view==='side'?580:view==='plan'?570:650;
    [...ink.children].filter(n=>n.tagName.toLowerCase()==='text').forEach(t=>{
      if(Number(t.getAttribute('y'))>=noteY||((cut||view==='side')&&Number(t.getAttribute('x'))>=700)||(view==='section-map'&&Number(t.getAttribute('y'))===92)){
        t.textContent=t.textContent.replace('ดูตำแหน่ง B–B ในภาพเล็กด้านขวา','ดู B–B ในแผนผังแนวตัดร่วม');
        const overviewLocators=allLocators.filter(l=>['A','B'].includes(l.letter));
        if(overviewLocators.length)t.textContent=t.textContent.replace('ตำแหน่งตัดดูภาพเล็กในรูปด้านและรูปตัด',overviewLocators.map(l=>`${l.letter}–${l.letter}: ${l.axis} = ${l.position} mm`).join(' · '));
        note(t);t.remove();
      }
    });
    if(view==='section-map'){
      svg.querySelectorAll('[data-manual-projection-strip]').forEach(g=>{g.setAttribute('transform','translate(0 -50)');g.dataset.paperShiftY='-50';});
      const dLocator=svg.querySelector('[data-cut-locator="D"]'),end=dLocator?.querySelector('text:last-child');
      if(dLocator&&!end)throw new Error('Unknown D locator label');
      if(end){if(end.getAttribute('text-anchor')!=='end')throw new Error('Unknown D locator label placement');end.dataset.paperLocatorEnd='true';}
    }
    if(cut){
      // D's continuation is still drawn; its two text lines belong in the caption.
      svg.querySelectorAll('[data-section-context] text').forEach(t=>{note(t);t.remove();});
      svg.querySelectorAll('text').forEach(t=>t.setAttribute('font-size',String(Math.max(24,Number(t.getAttribute('font-size'))||18))));
    }
    const footer=node('div','ncy-a4-cad-notes');
    if(locators.length)caption.querySelector('span').append(' · '+locators.map(l=>`${l.axis} = ${l.position} mm`).join(' · '));
    // All native notes remain searchable; reflow replaces long standalone SVG lines.
    if(notes.length)footer.append(node('p','',joinedNotes(notes)));
    out.append(caption,svg);if(legend.children.length)out.append(legend);if(footer.children.length)out.append(footer);
    return out;
  }
  function blocks(drawing) {
    const views=[...drawing.querySelectorAll('svg[data-cad-view]')],byName=new Map(views.map(s=>[s.dataset.cadView,s])),result=[];
    const allLocators=[...drawing.querySelectorAll('[data-section-locator]')].map(locatorData);
    const overview=node('div','ncy-a4-overview-row');overview.dataset.drawingSheet='overview';
    for(const name of ['side','plan'])if(byName.has(name))overview.append(figure(byName.get(name),allLocators));
    if(overview.children.length)result.push(overview);
    const cuts=['front','corbel-vertical','support-vertical'].filter(name=>byName.has(name));
    if(cuts.length){
      const sheet=node('section','ncy-a4-sections-sheet');sheet.dataset.newPage='true';sheet.dataset.drawingSheet='sections';
      const row=node('div','ncy-a4-cut-row');row.style.setProperty('--cut-columns',String(cuts.length));
      // Keep the same readable cut scale when one or two manual views are off.
      row.style.width=(cuts.length/3*100)+'%';row.style.marginInline='auto';
      const sharedNotes=node('div','ncy-a4-cut-notes');
      sharedNotes.append(node('p','ncy-a4-cut-scale','รูปตัด NTS · แต่ละรูปต่างมาตราส่วน ให้ใช้ค่ามิติที่ระบุ'));
      cuts.forEach(name=>{
        const fig=figure(byName.get(name),allLocators),notes=fig.querySelector('.ncy-a4-cad-notes');
        if(notes){const note=node('p','');note.dataset.noteView=name;note.append(node('b','',(titles[name]||name)+' — '),document.createTextNode(notes.textContent));sharedNotes.append(note);notes.remove();}
        row.append(fig);
      });sheet.append(row,sharedNotes);
      if(byName.has('section-map'))sheet.append(figure(byName.get('section-map'),allLocators));
      result.push(sheet);
    }
    return result;
  }
  function prepare(stage,meta,blocks,makePage) {
    const measure=makePage(meta);stage.append(measure);measure.querySelector('.ncy-a4-content').append(...blocks);
    try {
      for(const svg of measure.querySelectorAll('.ncy-a4-cad-figure svg')){
        const ink=[...svg.children].find(n=>n.tagName.toLowerCase()==='g'),width=svg.getBoundingClientRect().width;
        if(!(width>0))throw new Error('Cannot measure drawing width');
        let smallest=0;
        for(let pass=0;pass<8;pass++){
          spaceDimensionLabels(svg);
          const b=ink.getBBox(),pad=9,box=[b.x-pad,b.y-pad,b.width+2*pad,b.height+2*pad];
          if(!box.every(Number.isFinite)||!(b.width>0&&b.height>0))throw new Error('Invalid native vector bounds');
          svg.setAttribute('viewBox',box.map(v=>v.toFixed(3)).join(' '));
          const scale=width/box[2]*.75;smallest=Infinity;
          for(const t of svg.querySelectorAll('text')){
            const size=parseFloat(svg.ownerDocument.defaultView.getComputedStyle(t).fontSize);smallest=Math.min(smallest,size*scale);
            if(size*scale<8){t.setAttribute('font-size',String(Math.ceil(8/scale*10)/10));}
          }
          if(smallest>=7.99)break;
        }
        if(smallest<7.9)throw new Error('Drawing text cannot retain 8 pt at this column width');
        svg.closest('figure').dataset.paperWidthPx=String(svg.closest('figure').getBoundingClientRect().width);
        svg.dataset.paperMinTextPt=smallest.toFixed(2);svg.dataset.paperLayout='compact';
      }
    } finally {measure.remove();}
  }
  root.CorbelA4DrawingLayout=Object.freeze({blocks,prepare});
})(typeof window==='object'?window:globalThis);
