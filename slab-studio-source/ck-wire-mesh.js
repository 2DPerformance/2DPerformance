/* ================================================================
   ck-wire-mesh.js — shared welded-wire reinforcement (WWR) adapter
   Concrete Design slab family · TIS 737-2549 / ACI 318-19
   ================================================================ */
(function (root) {
  'use strict';
  if (root.CKWireMesh) return;

  var VERSION = '2026.07-wiremesh4';
  var PATH = String(location.pathname || '').toLowerCase();
  var SUPPORTED = /(?:one-way-slab|two-way-slab|cantilever-slab|slab-on-ground|stair|ramp|mat-raft)\.html?$|\/(?:one-way-slab|two-way-slab|cantilever-slab|slab-on-ground|stair|ramp|mat-raft)\/?$/.test(PATH);
  if (!SUPPORTED) return;

  var state = { mode:'bar', pick:'auto', sheet:'S2X5', product:null, appliedId:'', I:null, R:null, zones:[], busy:false, originals:{} };
  var SHEETS = [
    {id:'S2X5',w:2,l:5,label:'แผง 2.00 × 5.00 m (ตลาดทั่วไป)'},
    {id:'S2X6',w:2,l:6,label:'แผง 2.00 × 6.00 m (ยืนยันผู้ผลิต)'},
    {id:'S3X6',w:3,l:6,label:'แผง 3.00 × 6.00 m (สั่งผลิต/ยืนยันผู้ผลิต)'}
  ];
  var COMMON = [];
  [4,5,6,7,8,9].forEach(function (d) {
    [100,150,200].forEach(function (s) { COMMON.push(product('CDD',d,s,'ขนาดตลาดทั่วไป')); });
  });
  [10,12,16].forEach(function (d) {
    [100,150,200].forEach(function (s) { COMMON.push(product('DB',d,s,'แผงสั่งผลิต/ยืนยันผู้ผลิต')); });
  });
  COMMON.sort(function (a,b) { return a.mass-b.mass || a.dia-b.dia || a.spacing-b.spacing; });

  function product(type,dia,spacing,availability) {
    var aw = Math.PI*dia*dia/4;                         // mm2/wire
    var as = aw*(1000/spacing)/100;                    // cm2/m/direction
    var mass = 2*(dia*dia/162)*(1000/spacing);         // kg/m2, square mesh
    return { id:type+dia+'-'+spacing, type:type, dia:dia, spacing:spacing, aw:aw, As:as, mass:mass,
      fy:5000, availability:availability, label:type+dia+' @ '+spacing+' × '+spacing+' mm' };
  }
  function n(id, fallback) { var e=document.getElementById(id), v=e?parseFloat(e.value):NaN; return isFinite(v)?v:fallback; }
  function esc(s) { return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c];}); }
  function f(x,d) { return isFinite(x)?Number(x).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—'; }
  function sheetById(id) { return SHEETS.filter(function(x){return x.id===id;})[0]||SHEETS[0]; }
  function isActive() {
    if (usesNativeController()) return document.getElementById('steelType').value==='wm';
    return state.mode==='mesh';
  }
  function planningLap(p) { return Math.max(0.30,2*((p&&p.spacing)||150)/1000); }
  function layoutCandidate(width,length,sw,sl,lap,rotated) {
    var pw=rotated?sl:sw,pl=rotated?sw:sl,stepW=Math.max(.10,pw-lap),stepL=Math.max(.10,pl-lap);
    var nx=Math.max(1,Math.ceil(Math.max(0,width-pw)/stepW)+1),nz=Math.max(1,Math.ceil(Math.max(0,length-pl)/stepL)+1);
    var panels=[],seams=[],ties=[],idx=0;
    for(var iz=0;iz<nz;iz++) {
      var z0=Math.min(iz*stepL,Math.max(0,length-pl)),offset=(iz%2&&nx>1)?-stepW/2:0,col=0;
      for(var px=offset;px<width;px+=stepW) {
        var x0=Math.max(0,px),x1=Math.min(width,px+pw);
        if(x1-x0<.05)continue;
        panels.push({id:'WM-'+String(++idx).padStart(2,'0'),x0:x0,x1:x1,z0:z0,z1:Math.min(length,z0+pl),row:iz,col:col,stack:(col+iz)%2});
        if(col>0){var sx=x0;seams.push({axis:'z',at:sx,from:z0,to:Math.min(length,z0+pl),lap:lap,intent:'WWR_LAP'});for(var tz=z0+.25;tz<Math.min(length,z0+pl);tz+=.50)ties.push({x:sx+lap/2,z:tz,intent:'TIE_WIRE'});}
        col++;
      }
    }
    for(var z=1;z<nz;z++){var sz=Math.min(z*stepL,Math.max(0,length-pl));seams.push({axis:'x',at:sz,from:0,to:width,lap:lap,intent:'WWR_LAP'});for(var tx=.25;tx<width;tx+=.50)ties.push({x:tx,z:sz+lap/2,intent:'TIE_WIRE'});}
    return {width:width,length:length,panelW:pw,panelL:pl,lap:lap,nx:nx,nz:nz,panels:panels,seams:seams,ties:ties,count:panels.length,waste:panels.reduce(function(a,p){return a+(p.x1-p.x0)*(p.z1-p.z0);},0)-width*length,rotated:rotated,staggered:true,maxStack:(nx>1&&nz>1)?3:((nx>1||nz>1)?2:1)};
  }
  function sheetLayout(width,length,p,sheetId) {
    width=Math.max(.10,+width||.10);length=Math.max(.10,+length||.10);
    var stock=sheetById(sheetId||state.sheet),lap=planningLap(p||state.product);
    var a=layoutCandidate(width,length,stock.w,stock.l,lap,false),b=layoutCandidate(width,length,stock.w,stock.l,lap,true);
    var best=(b.count<a.count||(b.count===a.count&&b.waste<a.waste))?b:a;
    best.stock=stock;best.status=best.maxStack>=4?'HOLD':(best.maxStack===3?'REVIEW':'READY');best.issues=[];
    if(best.maxStack>=4)best.issues.push('ห้ามซ้อนรอยต่อ 4 ชั้น ณ จุดเดียว — เลื่อนแนวทาบแบบสลับ');
    if(best.maxStack===3)best.issues.push('แนวทาบสลับเกิด T-junction สูงสุด 3 ชั้น — ตรวจ cover, chair และระยะประสิทธิผล');
    best.notes=['จุดตัดลวดภายในแผง = INTENTIONAL_WELD','แผงต่างแผงทาบกันเฉพาะเขต WWR_LAP และผูกลวด','ห้ามดัดแผงผ่านแนวเชื่อมเป็นขอ 90°','ระยะทาบต้องยืนยันมาตรฐานโครงการและข้อมูลผู้ผลิต'];
    return best;
  }
  function addThreePanels(THREE,layer,material,layout,opt) {
    if(!THREE||!layer||!layout)return {objects:0};opt=opt||{};
    var dia=Math.max(.003,+opt.dia||.006),spacing=Math.max(.05,+opt.spacing||.15),ox=(+opt.centerX||0)-layout.width/2,oz=(+opt.centerZ||0)-layout.length/2,baseY=+opt.y||0,count=0;
    var tieMat=opt.tieMaterial||new THREE.MeshStandardMaterial({color:0x3b2f2f,roughness:.7,metalness:.25});
    function wire(len,axis,x,y,z,panelId){if(!(len>0))return;var m=new THREE.Mesh(new THREE.CylinderGeometry(dia/2,dia/2,len,8),material);if(axis==='x')m.rotation.z=Math.PI/2;else m.rotation.x=Math.PI/2;m.position.set(x,y,z);m.renderOrder=3;m.userData={ckKind:'WWR_WIRE',panelId:panelId,intent:'INTENTIONAL_WELD'};layer.add(m);count++;}
    layout.panels.forEach(function(p){var y=baseY+p.stack*dia*2.2,cx=ox+(p.x0+p.x1)/2,cz=oz+(p.z0+p.z1)/2,nx=Math.max(2,Math.floor((p.x1-p.x0)/spacing)+1),nz=Math.max(2,Math.floor((p.z1-p.z0)/spacing)+1);for(var i=0;i<nx;i++)wire(p.z1-p.z0,'z',ox+p.x0+(p.x1-p.x0)*i/(nx-1),y,cz,p.id);for(var j=0;j<nz;j++)wire(p.x1-p.x0,'x',cx,y-dia*1.05,oz+p.z0+(p.z1-p.z0)*j/(nz-1),p.id);});
    layout.ties.forEach(function(t){var ring=new THREE.Mesh(new THREE.TorusGeometry(dia*1.8,dia*.35,5,10),tieMat);ring.rotation.x=Math.PI/2;ring.position.set(ox+t.x,baseY+dia*3,oz+t.z);ring.renderOrder=4;ring.userData={ckKind:'TIE_WIRE',intent:'WWR_LAP'};layer.add(ring);count++;});
    layer.userData={ckKind:'WWR_INSTALLATION',layout:layout,status:layout.status};return {objects:count,layout:layout};
  }
  function appKey() {
    var m=PATH.match(/(one-way-slab|two-way-slab|cantilever-slab|slab-on-ground|stair|ramp|mat-raft)/);
    return m?m[1]:'';
  }
  function usesNativeController() {
    return appKey()==='slab-on-ground' &&
      !!document.getElementById('steelType') &&
      !!document.getElementById('meshPick') &&
      typeof root.compute==='function';
  }
  function zone(label,face,dir,asReq,sMax,extra) {
    var z={label:label,face:face,dir:dir,AsReq:+asReq||0,sMax:+sMax||45};
    if(extra) Object.keys(extra).forEach(function(k){z[k]=extra[k];});
    return z;
  }
  function zonesFor(I,R) {
    if(!R) return [];
    var k=appKey(), z=[];
    if(k==='one-way-slab') {
      (R.sections||[]).forEach(function(s,i){z.push(zone(s.label,i===1?'ล่าง':'บน','แนวช่วงสั้น',s.As,(s.Smax||.45)*100));});
      z.push(zone('เหล็กแจกจ่าย/อุณหภูมิ','ล่าง','แนวตั้งฉากช่วง',R.ast,(R.tempS||.45)*100));
    } else if(k==='two-way-slab') {
      (R.sections||[]).forEach(function(s,i){z.push(zone(s.label,(i===1||i===4)?'ล่าง':'บน',i<3?'ด้านสั้น':'ด้านยาว',s.As,(s.Smax||.45)*100));});
    } else if(k==='cantilever-slab') {
      z.push(zone('เหล็กหลักพื้นยื่น','บน','แนวยื่น',R.AsMain,(R.SmaxMain||.45)*100,{critical:true}));
      z.push(zone('เหล็กแจกแรง','บน','ตั้งฉากแนวยื่น',R.Ast2,(R.SmaxTemp||.45)*100));
    } else if(k==='slab-on-ground') {
      z.push(zone('เหล็กควบคุมรอยร้าว X','กลางความหนา','X',R.AsDesign,(R.Smax||.45)*100));
      z.push(zone('เหล็กควบคุมรอยร้าว Y','กลางความหนา','Y',R.AsDesign,(R.Smax||.45)*100));
    } else if(k==='stair') {
      z.push(zone('ST1 ช่วงบันได/ชานพัก','ล่าง','ตามแนวลาด',R.As,Math.min(3*(I.t||15),45),{critical:true}));
      z.push(zone('ST2 แถบหัวรองรับ','บน','ตามแนวลาด',R.AsTop,Math.min(3*(I.t||15),45),{critical:true}));
      z.push(zone('ST3 เหล็กแจกจ่าย','ล่าง','ขวางแนวลาด',R.AsDist,Math.min(5*(I.t||15),45)));
      if(R.landing) z.push(zone('ชานพัก','ล่าง','ช่วงชานพัก',R.landing.As,Math.min(3*(I.tL||I.t||15),45)));
    } else if(k==='ramp') {
      z.push(zone('RP1 ทางลาด/ชานพัก','ล่าง','ตามแนวลาด',R.As,Math.min(3*(I.t||15),45),{critical:true}));
      z.push(zone('RP2 แถบหัวรองรับ','บน','ตามแนวลาด',R.AsTop,Math.min(3*(I.t||15),45),{critical:true}));
      z.push(zone('RP3 เหล็กแจกจ่าย','ล่าง','ขวางแนวลาด',R.AsMin,Math.min(5*(I.t||15),45)));
    } else if(k==='mat-raft') {
      ['ล่าง X','ล่าง Y','บน X','บน Y'].forEach(function(l){z.push(zone('ฐานแพ '+l,l.split(' ')[0],l.split(' ')[1],R.AsReqPerM,Math.min(2*(I.h||50),45),{critical:true}));});
    }
    return z.filter(function(x){return isFinite(x.AsReq)&&x.AsReq>0;});
  }
  function selectProduct(zones) {
    var list=COMMON.filter(function(p){return zones.every(function(z){return p.As+1e-9>=z.AsReq && p.spacing/10<=z.sMax+1e-9;});});
    if(state.pick!=='auto') {
      var fixed=COMMON.filter(function(p){return p.id===state.pick;})[0];
      return fixed || null;
    }
    return list.length?list[0]:COMMON[COMMON.length-1];
  }
  function setSelectValue(id,value,label) {
    var e=document.getElementById(id); if(!e) return;
    if(state.originals[id]===undefined) state.originals[id]=e.value;
    var v=String(value), opt=Array.prototype.slice.call(e.options||[]).filter(function(o){return o.value===v;})[0];
    if(!opt && e.tagName==='SELECT') { opt=document.createElement('option'); opt.value=v; opt.textContent=label||v; opt.dataset.ckwm='1'; e.appendChild(opt); }
    e.value=v;
  }
  function applyMaterial(p) {
    if(!p) return;
    ['fy','fy1','fy2'].forEach(function(id){var e=document.getElementById(id);if(e){if(state.originals[id]===undefined)state.originals[id]=e.value;e.value=String(p.fy);}});
    setSelectValue('mainDia',p.dia,'CDD '+p.dia+' mm (Wire Mesh)');
    setSelectValue('tempDia',p.dia,'CDD '+p.dia+' mm (Wire Mesh)');
    setSelectValue('dia',p.dia,'CDD '+p.dia+' mm (Wire Mesh)');
    setSelectValue('db','CDD'+p.dia,'CDD'+p.dia+' (Wire Mesh)');
  }
  function restoreMaterial() {
    Object.keys(state.originals).forEach(function(id){var e=document.getElementById(id);if(e)e.value=state.originals[id];});
    state.originals={};
  }
  function capture(fnName) {
    var orig=root[fnName]; if(typeof orig!=='function'||orig.__ckwm) return;
    function wrapped(I){var R=orig.apply(this,arguments);try{state.I=I||state.I;state.R=R||state.R;setTimeout(update,0);}catch(e){}return R;}
    wrapped.__ckwm=true; wrapped.__original=orig; root[fnName]=wrapped;
  }
  function triggerCalc() {
    if(state.busy) return;
    state.busy=true;
    try {
      if(typeof root.doCalc==='function') root.doCalc();
      else if(typeof root.calc==='function') root.calc();
      else if(typeof root.render==='function') root.render();
    } catch(e) {}
    state.busy=false;
    setTimeout(update,0);
  }
  function reportEquation(lhs,rhs,ref) {
    return '<div class="rep-f"><div class="ef">'+lhs+'</div><div class="ex">'+rhs+'</div>'+(ref?'<div class="eref">'+ref+'</div>':'')+'</div>';
  }
  function reportHTML(p,zones) {
    if(!p||!zones.length) return '';
    var fc=n('fc',240), cover=n('cov',n('cover',2)), h=n('tdef',n('t',n('h',15)));
    if(appKey()==='cantilever-slab') h=n('h_root',h);
    var fy=p.fy, rho=Math.max(.0018*4283/fy,.0014), ld=NaN, ldt=NaN;
    try { if(root.CKF){ld=root.CKF.ldTension(fy,fc,p.dia/10,1,1,1);ldt=root.CKF.ldTension(fy,fc,p.dia/10,1.3,1,1);} } catch(e) {}
    var layout=sheetLayout(Math.max(1,n('L',n('B',5))),Math.max(1,n('S',n('W',3))),p,state.sheet);
    var lap=layout.lap*100;
    var all=zones.every(function(z){return p.As>=z.AsReq-1e-9&&p.spacing/10<=z.sMax+1e-9;}),anchorageHold=appKey()==='cantilever-slab';
    var rows=zones.map(function(z){var util=z.AsReq/p.As,ok=util<=1.000001&&p.spacing/10<=z.sMax+1e-9;return '<tr><td>'+esc(z.label)+'</td><td>'+esc(z.face)+'</td><td>'+esc(z.dir)+'</td><td>'+f(z.AsReq,3)+'</td><td>'+f(p.As,3)+'</td><td>'+f(util,3)+'</td><td>'+(ok?'ผ่าน':'ไม่ผ่าน')+'</td></tr>';}).join('');
    var grid='<svg viewBox="0 0 620 180" xmlns="http://www.w3.org/2000/svg"><rect width="620" height="180" fill="#fff"/><g stroke="#b91c1c" stroke-width="2">';
    for(var x=45;x<=575;x+=53)grid+='<line x1="'+x+'" y1="25" x2="'+x+'" y2="145"/>';
    for(var y=25;y<=145;y+=30)grid+='<line x1="45" y1="'+y+'" x2="575" y2="'+y+'"/>';
    grid+='</g><g font-family="Arial,sans-serif" fill="#172033"><text x="310" y="16" text-anchor="middle" font-size="13" font-weight="700">WELDED WIRE REINFORCEMENT — '+esc(p.label)+'</text><text x="310" y="169" text-anchor="middle" font-size="12">วางบน chair ให้ได้ cover · ทาบ ≥ '+f(lap,0)+' cm · ทาบสลับตำแหน่ง · เพิ่มเหล็กขอบช่องเปิด/หัวรองรับ</text></g></svg>';
    return '<div class="rep-step ckwm-report" id="ckwmReport"><div class="rh"><span class="rn">WM</span><span class="rt">การออกแบบเหล็กตะแกรงเชื่อม · Welded Wire Reinforcement</span><span class="rep-vd '+(all&&!anchorageHold?'ok':'bad')+'">'+(anchorageHold?'HOLD ระยะยึด':(all?'ผ่าน':'ไม่ผ่าน'))+'</span></div>'+
      '<div class="rep-note"><b>วัสดุ:</b> '+esc(p.label)+' · fy = '+f(fy,0)+' ksc · มอก. 737-2549 · ใช้ลวดข้ออ้อย/เหล็กข้ออ้อยเชื่อม ไม่อาศัยกำลังรอยเชื่อมในการคำนวณระยะพัฒนา</div>'+
      reportEquation('A<sub>w</sub> = πd<sub>w</sub><sup>2</sup> / 4','= π × '+p.dia+'<sup>2</sup> / 4 = <b>'+f(p.aw,3)+' mm²/เส้น</b>','พื้นที่หน้าตัดลวด 1 เส้น')+
      reportEquation('A<sub>s,prov</sub> = A<sub>w</sub> × (1000 / s) / 100','= '+f(p.aw,3)+' × (1000 / '+p.spacing+') / 100 = <b>'+f(p.As,3)+' cm²/m/ทิศ</b>','คำนวณแยกแต่ละทิศ; ไม่รวมผล two-way interaction')+
      reportEquation('ρ<sub>min</sub> = max(0.0018 × 4283 / f<sub>y</sub>, 0.0014)','= max(0.0018 × 4283 / '+fy+', 0.0014) = <b>'+f(rho,5)+'</b>','high-fy floor; ห้ามลดเหล็กต่ำกว่า 0.0014')+
      reportEquation('A<sub>s,min</sub> = ρ<sub>min</sub> × b × h','= '+f(rho,5)+' × 100 × '+f(h,1)+' = <b>'+f(rho*100*h,3)+' cm²/m</b>','ตรวจร่วมกับ A<sub>s</sub> จากแรงดัด/แรงหดตัวของแต่ละแอป')+
      reportEquation('w<sub>mesh</sub> = 2 × (d<sub>w</sub><sup>2</sup> / 162) × (1000 / s)','= 2 × ('+p.dia+'<sup>2</sup> / 162) × (1000 / '+p.spacing+') = <b>'+f(p.mass,3)+' kg/m²</b>','ตะแกรงจัตุรัส 2 ทิศ ไม่รวมทาบ/เศษ')+
      (isFinite(ld)?reportEquation('ℓ<sub>d</sub> = ψ<sub>t</sub>ψ<sub>e</sub>ψ<sub>s</sub>·f<sub>y</sub>d<sub>b</sub> / (1.1λ√f′<sub>c</sub>)','ℓ<sub>d,bottom</sub> = <b>'+f(ld,1)+' cm</b>; ℓ<sub>d,top</sub> = <b>'+f(ldt,1)+' cm</b>','ACI 318-19 §25.4; คิดแบบ deformed wire โดยไม่ใช้ประโยชน์จาก cross-wire weld'):'')+
      reportEquation('ℓ<sub>lap,plan</sub> = max(300 mm, 2s)','= max(30.0, '+f(2*p.spacing/10,1)+') = <b>'+f(lap,1)+' cm</b>','ค่าจัดแผงเบื้องต้น; ระยะทาบใช้งานต้องยืนยันข้อกำหนดโครงการ ชนิดลวด และข้อมูลผู้ผลิต')+
      '<div class="rep-note"><b>แผนติดตั้ง:</b> '+esc(layout.stock.label)+' · '+layout.count+' แผง · ทาบ '+f(lap,0)+' cm · '+(layout.status==='HOLD'?'HOLD — ต้องเลื่อนแนวทาบ ห้ามซ้อน 4 ชั้น':(layout.status==='REVIEW'?'ทาบสลับ · ตรวจ T-junction 3 ชั้น/cover/chair':'แนวทาบไม่เกิน 2 ชั้น'))+'</div>'+
      '<table class="mesh-tbl ckwm-table"><thead><tr><th>ตำแหน่ง</th><th>ผิว</th><th>ทิศ</th><th>A<sub>s,req</sub></th><th>A<sub>s,prov</sub></th><th>D/C</th><th>ผล</th></tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div class="ckwm-figure">'+grid+'<div class="cap">รายละเอียดหลักการวางตะแกรง — แบบก่อสร้างต้องระบุตำแหน่งแผ่น ทิศลวด ระยะทาบ chair และเหล็กเสริมเฉพาะจุด</div></div>'+
      '<div class="rep-note ckwm-risk"><b>ผลของ fy สูง/จุดอ่อนที่ต้องคุม:</b> ปริมาณเหล็กลดลงได้แต่ระยะรอยร้าวและความเหนียวอาจเป็นตัวคุม · แผงวางเกยและผูกลวด ห้ามดัดแผงผ่านแนวเชื่อมเป็นขอ 90° · ต้องยึดแผ่นบน chair ไม่ให้จมระหว่างเท · เหล็กบนหัวรองรับ ขอบ ช่องเปิด มุมเว้า และระยะยึดไม่พอ ให้ใช้เหล็กเส้นเสริมเฉพาะจุด · ตรวจ Mill Certificate และกำลังรอยเชื่อมของผู้ผลิตทุก lot</div></div>';
  }
  function ensureReport(p,zones) {
    var rep=document.getElementById('repBody');
    if(!rep){rep=document.getElementById('ckwmHiddenReport');if(!rep){rep=document.createElement('div');rep.id='ckwmHiddenReport';rep.style.display='none';document.body.appendChild(rep);}}
    var old=rep.querySelector('#ckwmReport'); if(old)old.remove();
    var tmp=document.createElement('div');tmp.innerHTML=reportHTML(p,zones);if(tmp.firstElementChild)rep.appendChild(tmp.firstElementChild);
  }
  function ensureNativeInstallation() {
    if(!usesNativeController())return;
    var rep=document.getElementById('repBody');if(!rep)return;
    var old=rep.querySelector('#ckwmNativeReport');if(old)old.remove();
    var er=root.CK_ENGINEERING_RESULT,R=state.R||(er&&er.result),reinf=R&&R.reinf;
    if(!reinf||document.getElementById('steelType').value!=='wm')return;
    var p=product('CDD',+reinf.dia,+reinf.sp*10,'ขนาดที่เลือกในแอป'),B=n('B',4),L=n('L',6),cov=n('cov',4)/100;
    var lay=sheetLayout(Math.max(.1,B-2*cov),Math.max(.1,L-2*cov),p,state.sheet);
    var sec=document.createElement('div');sec.id='ckwmNativeReport';sec.className='rep-step ckwm-report';
    sec.innerHTML='<div class="rh"><span class="rn">WM</span><span class="rt">แผนติดตั้ง Wire Mesh จริง · PHYSICAL SHEET LAYOUT</span><span class="rep-vd '+(lay.status==='HOLD'?'bad':'ok')+'">'+(lay.status==='HOLD'?'HOLD':'ตรวจแล้ว')+'</span></div>'+
      '<div class="rep-note"><b>'+esc(lay.stock.label)+'</b> · '+lay.count+' แผง · ทาบเบื้องต้น '+f(lay.lap*100,0)+' cm · ผูกลวดตามแนวทาบ · แนวทาบสลับ · จุด T-junction สูงสุด '+lay.maxStack+' ชั้น</div>'+
      '<div class="rep-note ckwm-risk"><b>Installation truth:</b> จุดตัดภายในแผงเป็นรอยเชื่อมจากโรงงาน · แผงต่างแผงวางเกยและผูกลวด · ห้ามดัดแผงผ่านแนวเชื่อมเป็นขอ 90° · รองด้วย chair/spacer ก่อนเท · ตรวจ cover และระดับตะแกรงหลังคนงานเดิน/เทคอนกรีต</div>';
    rep.appendChild(sec);
  }
  function renderPanel(p,zones) {
    var panel=document.getElementById('ckwmPanel'); if(!panel)return;
    var res=panel.querySelector('.ckwm-result'), all=p&&zones.length&&zones.every(function(z){return p.As>=z.AsReq-1e-9&&p.spacing/10<=z.sMax+1e-9;});
    panel.classList.toggle('active',state.mode==='mesh');
    if(state.mode!=='mesh'){res.innerHTML='<b>โหมดเหล็กเส้น</b> — เลือก “Wire Mesh” เพื่อให้ระบบคำนวณใหม่ด้วย fy ของลวดและออกตารางวางแผ่น';return;}
    var layout=p?sheetLayout(Math.max(1,n('L',n('B',5))),Math.max(1,n('S',n('W',3))),p,state.sheet):null,anchorageHold=appKey()==='cantilever-slab';
    res.innerHTML=p?'<div><b>'+esc(p.label)+'</b> · A<sub>s</sub> '+f(p.As,3)+' cm²/m/ทิศ · '+f(p.mass,2)+' kg/m²</div><div><b>'+esc(layout.stock.label)+'</b> · '+layout.count+' แผง · ทาบเบื้องต้น '+f(layout.lap*100,0)+' cm · ผูกลวดตามแนวทาบ · '+(layout.status==='REVIEW'?'ตรวจ T-junction 3 ชั้น':'แนวทาบไม่เกิน 2 ชั้น')+'</div><span class="'+(all&&layout.status!=='HOLD'&&!anchorageHold?'ok':'bad')+'">'+(anchorageHold?'HOLD — พื้นยื่นต้องพิสูจน์ระยะฝังตรงหรือเพิ่มเหล็กเส้นเฉพาะจุด; ห้ามดัดแผง 90°':(all&&layout.status!=='HOLD'?'✓ ผ่านกำลังและจัดแผงแบบทาบสลับ — ไม่มีขอ 90° ในแผง':'✗ ตรวจเหล็กเฉพาะจุด/เลื่อนแนวทาบก่อนออกแบบ'))+'</span>':'ยังไม่มีผลคำนวณ';
  }
  function update() {
    if(state.busy)return;
    state.zones=zonesFor(state.I,state.R);
    if(state.mode==='mesh') {
      var p=selectProduct(state.zones); state.product=p;
      if(p && state.appliedId!==p.id) { state.appliedId=p.id; applyMaterial(p); triggerCalc(); return; }
      ensureReport(p,state.zones);
    }
    renderPanel(state.product,state.zones);
  }
  function style() {
    var s=document.createElement('style');s.id='ckwmStyle';s.textContent='\
      #ckwmPanel{margin:0 0 17px;max-width:none;background:#f8fbff;border:2px solid #9fb3c9;border-left:7px solid #1b4f8c;border-radius:11px;padding:12px;box-shadow:0 4px 0 #d6e0eb,0 9px 18px rgba(15,35,60,.11);font-family:Sarabun,-apple-system,"Segoe UI",sans-serif;color:#172033}\
      #ckwmPanel.active{border-left-color:#f58220}.ckwm-head{display:grid;gap:10px}.ckwm-title{font-weight:900;color:#103d73;min-width:0;line-height:1.35}.ckwm-controls{display:grid;grid-template-columns:1fr;gap:10px}.ckwm-controls label{font-size:11px;font-weight:800;color:#53677d;min-width:0}.ckwm-controls select{display:block;width:100%;margin-top:4px;min-height:43px;border:2px solid #748da8;border-radius:8px;background:linear-gradient(#fff,#edf3f9);box-shadow:inset 0 1px 0 #fff,0 3px 0 #aebdcb;padding:7px 32px 7px 10px;font:700 12px Sarabun,sans-serif;color:#10243c;cursor:pointer}.ckwm-result{margin-top:10px;padding:9px 10px;background:#fff;border:1px solid #c8d6e5;border-radius:8px;font-size:11.5px;display:grid;gap:6px;line-height:1.45}.ckwm-result .ok{color:#08783c;font-weight:900}.ckwm-result .bad{color:#b42318;font-weight:900}.ckwm-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}.ckwm-table th,.ckwm-table td{border:1px solid #b8c6d4;padding:5px 6px;text-align:center}.ckwm-table th{background:#eaf1f8}.ckwm-figure{text-align:center;margin:8px 0}.ckwm-figure svg{max-width:100%;height:auto}.ckwm-risk{border-left:4px solid #e47b00;background:#fff7e8;padding:8px 10px!important}\
      #ckwmPanel[data-host-kind="details"],#ckwmPanel[data-host-kind="section"]{margin-top:10px}\
      @media(max-width:720px){#ckwmPanel{margin:0 0 14px;padding:11px}.ckwm-controls{grid-template-columns:1fr}.ckwm-controls label{width:100%}.ckwm-controls select{width:100%}}';document.head.appendChild(s);
  }
  function inputHost() {
    var unified=document.querySelector('.design-input,.input-panel,[data-ck-input-panel]');
    if(unified) return {node:unified,kind:'left-panel',after:null};
    var classic=document.querySelector('.wrap > section.panel .panel-body,.wrap > .panel .panel-body');
    if(classic) return {node:classic,kind:'left-panel',after:null};

    var blocks=Array.prototype.slice.call(document.querySelectorAll('.wrap > details.sec,.wrap > section.sec,main.wrap > section.sec'));
    var scored=blocks.map(function(block){
      var text=String(block.textContent||'').toLowerCase();
      var score=0;
      if(/วัสดุ|material/.test(text))score+=5;
      if(/เหล็ก|rebar|steel/.test(text))score+=3;
      if(/น้ำหนัก|load|แรง/.test(text))score+=1;
      return {block:block,score:score};
    }).sort(function(a,b){return b.score-a.score;});
    var target=scored.length?scored[0].block:null;
    if(target) {
      var body=target.querySelector('.sbody')||target;
      return {node:body,kind:target.tagName==='DETAILS'?'details':'section',after:body===target?target.querySelector('h2'):null};
    }
    return null;
  }
  function panel() {
    var p=document.createElement('section');p.id='ckwmPanel';p.innerHTML='<div class="ckwm-head"><div class="ckwm-title">▦ ระบบเหล็กเสริมพื้น · Rebar / Wire Mesh</div><div class="ckwm-controls"><label>ระบบเหล็กเสริม<select id="ckwmMode"><option value="bar">เหล็กเส้นตามแบบเดิม</option><option value="mesh">Wire Mesh · มอก. 737-2549</option></select></label><label>ขนาดตะแกรงตลาด<select id="ckwmPick"><option value="auto">Auto — เบาสุดที่ผ่านทุกตำแหน่ง</option>'+COMMON.map(function(x){return '<option value="'+x.id+'">'+esc(x.label)+' · As '+f(x.As,3)+'</option>';}).join('')+'</select></label><label>ขนาดแผงติดตั้ง<select id="ckwmSheet">'+SHEETS.map(function(x){return '<option value="'+x.id+'">'+esc(x.label)+'</option>';}).join('')+'</select></label></div></div><div class="ckwm-result"></div>';
    var host=inputHost();
    if(host&&host.node) {
      p.dataset.hostKind=host.kind;
      p.dataset.designInput='true';
      if(host.after&&host.after.parentNode===host.node)host.node.insertBefore(p,host.after.nextSibling);
      else host.node.insertBefore(p,host.node.firstChild);
    } else {
      p.dataset.hostKind='fallback';
      var anchor=document.querySelector('.appbar,header');
      if(anchor&&anchor.parentNode)anchor.parentNode.insertBefore(p,anchor.nextSibling);
      else document.body.insertBefore(p,document.body.firstChild);
    }
    p.querySelector('#ckwmMode').addEventListener('change',function(){state.mode=this.value;localStorage.setItem('ckwmMode',state.mode);state.appliedId='';if(state.mode==='bar')restoreMaterial();else applyMaterial(state.product||COMMON[0]);triggerCalc();});
    p.querySelector('#ckwmPick').addEventListener('change',function(){state.pick=this.value;localStorage.setItem('ckwmPick',state.pick);state.product=selectProduct(state.zones);state.appliedId='';applyMaterial(state.product);triggerCalc();});
    p.querySelector('#ckwmSheet').addEventListener('change',function(){state.sheet=this.value;localStorage.setItem('ckwmSheet',state.sheet);triggerCalc();});
    state.mode=localStorage.getItem('ckwmMode')||'bar';state.pick=localStorage.getItem('ckwmPick')||'auto';state.sheet=localStorage.getItem('ckwmSheet')||'S2X5';p.querySelector('#ckwmMode').value=state.mode;p.querySelector('#ckwmPick').value=COMMON.some(function(x){return x.id===state.pick;})?state.pick:'auto';p.querySelector('#ckwmSheet').value=sheetById(state.sheet).id;
  }
  function init() {
    if(usesNativeController()) {
      root.CKWireMesh.nativeController=true;
      state.mode=document.getElementById('steelType').value==='wm'?'mesh':'bar';
      state.sheet=localStorage.getItem('ckwmSheet')||'S2X5';
      if(typeof root.compute==='function'&&!root.compute.__ckwmNative){
        var nativeCompute=root.compute;
        root.compute=function(I){var R=nativeCompute.apply(this,arguments);state.I=I||state.I;state.R=R||state.R;setTimeout(ensureNativeInstallation,0);return R;};
        root.compute.__ckwmNative=true;root.compute.__original=nativeCompute;
      }
      var host=document.getElementById('wireMeshFields');
      if(host&&!document.getElementById('ckwmSheet')){
        var field=document.createElement('div');field.className='field full';
        field.innerHTML='<label>ขนาดแผงติดตั้งจริง</label><div class="ctrl sel"><select id="ckwmSheet">'+SHEETS.map(function(x){return '<option value="'+x.id+'">'+esc(x.label)+'</option>';}).join('')+'</select></div>';
        host.appendChild(field);field.querySelector('select').value=sheetById(state.sheet).id;
        field.querySelector('select').addEventListener('change',function(){state.sheet=this.value;localStorage.setItem('ckwmSheet',state.sheet);triggerCalc();setTimeout(ensureNativeInstallation,0);});
      }
      document.addEventListener('input',function(){setTimeout(ensureNativeInstallation,0);});
      document.addEventListener('change',function(){setTimeout(ensureNativeInstallation,0);});
      setTimeout(function(){triggerCalc();ensureNativeInstallation();},0);
      return;
    }
    style();panel();capture('compute');capture('design');
    if(state.mode==='mesh') applyMaterial(COMMON[0]);
    triggerCalc();
  }
  root.CKWireMesh={VERSION:VERSION,CATALOG:COMMON,SHEETS:SHEETS,state:state,product:product,zonesFor:zonesFor,selectProduct:selectProduct,refresh:update,inputHost:inputHost,isActive:isActive,planningLap:planningLap,sheetLayout:sheetLayout,addThreePanels:addThreePanels,nativeController:false};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(window);
