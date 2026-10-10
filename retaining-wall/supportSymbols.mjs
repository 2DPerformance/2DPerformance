/** Analytical support symbols. Presentation only; never changes restraints or results. */
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function supportSymbolSvg(kind,x,y,{rotation=0,scale=1,id=kind}={}){
  const shapes={
    fixed:'<path d="M0-14V14m0-12l-8 7m8-1l-8 7m8-1l-8 7m8-1l-8 7"/>',
    pin:'<path d="M0 0L-10 16H10Z M-15 21H15m-24 0l-5 5m13-5l-5 5m13-5l-5 5"/><circle cx="0" cy="0" r="2.5" fill="white"/>',
    hinge:'<circle cx="0" cy="0" r="5" fill="white"/>',
    roller:'<path d="M0 0L-10 13H10Z M-15 25H15"/><circle cx="-6" cy="18" r="3"/><circle cx="6" cy="18" r="3"/>',
    spring:'<path d="M0 0H6l3-5 6 10 6-10 6 10 3-5h6m0-12v24m0-18l6-6m-6 14l6-6m-6 14l6-6"/>',
    'rotation-spring':'<path d="M0 0a6 6 0 1 1 5-9a10 10 0 1 1 6 15m-1-1h10m0-12v24m0-18l6-6m-6 14l6-6m-6 14l6-6"/>',
    contact:'<path d="M-18 5H18m-30 0l-6 7m14-7l-6 7m14-7l-6 7m14-7l-6 7"/>',
  };
  if(!shapes[kind])throw new TypeError('Unknown support symbol: '+kind);
  return '<g data-support="'+esc(id)+'" data-support-symbol="'+kind+'" transform="translate('+x+' '+y+') rotate('+rotation+') scale('+scale+')" fill="none" stroke="#344f65" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><title>'+esc(kind)+'</title>'+shapes[kind]+'</g>';
}
const text=(x,y,s,more='')=>'<text x="'+x+'" y="'+y+'" font-family="Sarabun,Arial,sans-serif" font-size="13" fill="#243c50" '+more+'>'+esc(s)+'</text>';
const line=(x1,y1,x2,y2)=>'<path d="M'+x1+' '+y1+'L'+x2+' '+y2+'" fill="none" stroke="#426782" stroke-width="4"/>';
const couple=(x,y)=>'<g data-support-action="end-moment" transform="translate('+x+' '+y+')"><path d="M-9 7a12 12 0 1 1 19 0" fill="none" stroke="#a34d21" stroke-width="1.7"/><path d="M7 3l4 6 3-7z" fill="#a34d21"/></g>';
export function supportModelFor(s){
  const raw=s.type||s.input?.wtype,type=({cant:'cantilever',but:'counterfort'})[raw]||raw;
  if(!['cantilever','counterfort','gravity','pile','pilecf','soldier','duckfoot'].includes(type))throw new TypeError('Accepted RW system required');
  if(type==='gravity')return {type,kind:'contact',title:'ทั้งระบบ · ฐานบนดิน',note:'แรงกดกระจาย + แรงเสียดทาน · ไม่มีจุด Fixed ที่พื้นดิน'};
  if(type==='soldier')return {type,kind:'spring',tie:s.geometry.staySystem,title:'เข็ม · สปริงดินตามช่วงฝัง',note:s.geometry.staySystem==='cant'?'ยอดและปลายไม่เป็น Fixed · ดินรับแรงตามความลึก':'สปริงดิน + ระบบยึดรั้ง · หมุนได้ที่ข้อต่อแรงแกน'};
  if(type==='duckfoot')return {type,kind:'fixed',title:'แยกเสา · Fixed อ้างอิงผิวบนฐาน',note:'คานต่อเนื่อง: รองรับแนวดิ่ง หมุนได้ · ฐานจริงรับแรงกดจากดิน'};
  if(type==='counterfort'||type==='pilecf')return {type,kind:'continuous',both:true,title:'แยกแถบพนัง / Heel · รองรับต่อเนื่องที่ครีบ',note:'Engine: M− = wL²/12 · ไม่มี release ที่ครีบ · รูปแถบแยกจากแกนความลึก'};
  return {type,kind:'fixed',title:'แยกพนัง / Toe / Heel · Fixed ที่หน้าเชื่อม',note:type==='pile'?'หัวเข็มต่อกับแคป · เข็มวิเคราะห์บนสปริงดินและสปริงหมุน':'อ้างอิงฐานเป็นจุดยึดของสมาชิก · ฐานจริงสัมผัสดิน'};
}
/** Small, separate member idealisation so ground contact is never drawn as a clamp. */
export function supportModelSvg(s,{compact=false}={}){
  const m=supportModelFor(s);
  if(compact){
    const words=m.title.split(' · '),titles=words.map((t,i)=>text(12,18+i*24,t,'font-weight="700"')).join('');
    let shape='';
    if(m.kind==='fixed'){
      shape=line(35,65,280,65)+supportSymbolSvg('fixed',35,65);
      if(m.both)shape+=supportSymbolSvg('fixed',280,65,{rotation:180});
      else shape+=text(280,56,'ปลายอิสระ','text-anchor="end"');
      if(m.type==='duckfoot'){shape+=text(12,101,'Roller · คานต่อเนื่อง v = 0, θ หมุนได้')+line(35,115,280,115);for(const x of[35,158,280])shape+=supportSymbolSvg('roller',x,115,{scale:.7});}
      else if(m.type==='pile'||m.type==='pilecf')shape+=supportSymbolSvg('rotation-spring',40,107,{scale:.75})+text(90,109,'Winkler: Kθ = 5EI/Lt');
    }else if(m.kind==='continuous'){
      shape=line(20,65,300,65)+supportSymbolSvg('roller',35,65,{scale:.7})+supportSymbolSvg('roller',280,65,{scale:.7})+couple(35,107)+couple(280,107)+text(158,110,'M− = wL²/12','text-anchor="middle"');
    }else if(m.kind==='spring'){
      shape=line(45,52,45,114);for(const y of[70,92,114])shape+=supportSymbolSvg('spring',45,y,{scale:.7});
      shape+=text(120,84,'สปริงดิน kₕ(z)');
      if(m.tie!=='cant')shape+=line(45,52,250,52)+supportSymbolSvg(m.tie==='anchor'?'pin':'hinge',250,52,{scale:.7})+text(175,115,(m.tie==='anchor'?'Pin':'Hinge')+' · แรงแกน');
    }else{shape=line(35,65,280,65);for(const x of[55,120,185,250])shape+=supportSymbolSvg('contact',x,71);}
    const notes=m.type==='duckfoot'?['เสาอ้างอิงผิวบนฐาน; คานไม่ค้ำด้านข้าง','ฐานบนดิน: รับเฉพาะแรงกด']:m.kind==='spring'?['สปริงดินตามช่วงฝัง','ยอด / ปลายเข็มไม่เป็น Fixed']:m.both?['โมเมนต์รองรับทั้งสองด้าน','รูปแถบแยกจากแกนความลึก']:['อ้างอิงฐานเป็นจุดยึดของสมาชิก','การรองรับทั้งระบบอ่านจากรูปด้านซ้าย'];
    return '<svg class="rw-support-model" data-support-model="'+m.type+'" role="img" aria-label="เงื่อนไขรองรับ · '+esc(m.title)+'" viewBox="0 0 375 185">'+titles+shape+notes.map((t,i)=>text(12,150+i*24,t)).join('')+'</svg>';
  }
  let shape='';
  if(m.kind==='fixed'){
    shape=line(46,62,215,62)+supportSymbolSvg('fixed',46,62);
    if(m.both)shape+=supportSymbolSvg('fixed',215,62,{rotation:180});
    else shape+=text(215,46,'ปลายอิสระ','text-anchor="end"');
    if(m.type==='duckfoot'){
      shape+=line(290,62,650,62);
      for(const x of [300,470,640])shape+=supportSymbolSvg('roller',x,62,{scale:.8});
      shape+=text(470,44,'Roller · คานต่อเนื่อง v = 0, θ หมุนได้','text-anchor="middle"');
    }else if(m.type==='pile'||m.type==='pilecf'){
      shape+=supportSymbolSvg('rotation-spring',285,62,{scale:.8,id:'pile-head-rotation-spring'});
      shape+=text(350,62,'Winkler หัวเข็ม: Kθ = 5EI/Lt (สปริงหมุน)');
    }
  }else if(m.kind==='continuous'){
    shape=line(20,62,250,62)+supportSymbolSvg('roller',46,62,{scale:.8})+supportSymbolSvg('roller',215,62,{scale:.8})+couple(46,43)+couple(215,43)+text(280,64,'V = wL/2 · M− = wL²/12');
  }else if(m.kind==='contact'){
    shape=line(50,50,235,50);
    for(const x of [65,115,165,215])shape+=supportSymbolSvg('contact',x,57);
    shape+=text(270,58,'q(x) รับเฉพาะแรงกด · ฐานเลื่อน / พลิกตรวจด้วยสมดุล');
  }else{
    shape=line(70,36,70,95);
    for(const y of [61,78,95])shape+=supportSymbolSvg('spring',70,y,{scale:.7});
    if(m.tie!=='cant'){
      shape+=line(70,42,210,42)+supportSymbolSvg(m.tie==='anchor'?'pin':'hinge',210,42,{scale:.7});
      shape+=text(260,59,(m.tie==='anchor'?'Pin ที่ bond สมอดิน':'Hinge ต่อแคปสมอ')+' · ไม่ถ่ายโมเมนต์จากสเตย์');
    }else shape+=text(150,60,'kₕ(z) · ดินรับแรงกระจายตามความลึก');
  }
  return '<svg class="rw-support-model" data-support-model="'+m.type+'" role="img" aria-label="เงื่อนไขรองรับ · '+esc(m.title)+'" viewBox="0 0 720 124">'+text(18,19,m.title,'font-weight="700"')+shape+text(18,119,m.note)+'</svg>';
}
