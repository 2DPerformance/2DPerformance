/* CB-01 drafting only. Every coordinate and bar comes from CorbelRebarDetail. */
(function install(root){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const f=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:1}):'—';
  const pt=v=>Number(v).toFixed(3);
  const text=(x,y,value,attrs='')=>`<text x="${pt(x)}" y="${pt(y)}" ${attrs}>${esc(value)}</text>`;
  const atX=(bar,x,y)=>{for(let i=1;i<bar.points.length;i++){const a=bar.points[i-1],b=bar.points[i],dx=b[0]-a[0];if(Math.abs(dx)>1e-9&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])&&Math.abs(a[1]-y)<1e-6&&Math.abs(b[1]-y)<1e-6){const t=(x-a[0])/dx;return a.map((v,k)=>v+t*(b[k]-v));}}return bar.points[0];};
  const path=(points,x,y)=>points.map((p,i)=>`${i?'L':'M'}${pt(x(p))},${pt(y(p))}`).join(' ');
  function render(s,g,suffix='cad'){
    const d=g.dimensions,{b,h,h2,L,c}=d,detail=g.details,ledger=g.ledger||{},reference=g.pattern==='reference-return',anchor=g.anchors?.[0];
    if(![b,h,h2,L].every(v=>Number.isFinite(v)&&v>0))return '<p role="alert">ไม่มีมิติรูปตัดปัจจุบัน</p>';
    const id=String(suffix).replace(/[^a-zA-Z0-9-]/g,''),known=detail.detailSupportWidth>0&&detail.detailSupportDepth>0;
    const left=known?-detail.detailSupportWidth:Math.min(0,...g.main.map(bar=>bar.points[0][0]),...g.ties.map(t=>t.backXMm));
    const right=L,deep=known?Math.max(h,detail.detailSupportDepth):h;
    const svg=(view,height,title,content)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${height}" role="img" data-cad-view="${view}" data-rebar-pattern="${esc(g.pattern)}" data-corbel-detail="${g.version}" data-snapshot-id="${esc(g.snapshotId)}" data-installation="${g.installation}" data-support-anchor-verified="false" data-support-screen-mm="${g.supportScreenMm??''}" data-detail-status="${g.status}" aria-label="${esc(title)}">
      <defs><pattern id="hatch-${id}-${view}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V14" stroke="#aab0b6" stroke-width=".7"/></pattern><marker id="arrow-${id}-${view}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0 0L8 4L0 8Z" fill="#20252b"/></marker></defs>
      <g font-family="Sarabun,Arial,sans-serif" font-size="18" fill="#20252b"><rect width="1000" height="${height}" fill="#fff"/><rect x="16" y="16" width="968" height="${height-32}" fill="none" stroke="#626971" stroke-width="1"/>${text(36,47,title,'font-size="24" font-weight="700"')}${text(964,46,'หน่วย mm · NTS','text-anchor="end" font-size="17"')}${content}</g></svg>`;
    const line=(x0,y0,x1,y1,cls='dimension',extra='')=>`<path data-cad-line="${cls}" d="M${pt(x0)} ${pt(y0)}L${pt(x1)} ${pt(y1)}" fill="none" stroke="#454c54" stroke-width="${cls==='outline'?2.3:1}" ${extra}/>`;
    const hd=(x0,x1,objectY,at,label,tag='')=>`<g ${tag} data-dimension-extensions="true">${line(x0,objectY+5,x0,at+9)}${line(x1,objectY+5,x1,at+9)}${line(x0,at,x1,at,'dimension')}${line(x0-5,at-5,x0+5,at+5)}${line(x1-5,at-5,x1+5,at+5)}${text((x0+x1)/2,at-10,label,'text-anchor="middle" stroke="#fff" stroke-width="5" paint-order="stroke"')}</g>`;
    const vd=(y0,y1,objectX,at,label,upperObjectX=objectX)=>`<g data-dimension-extensions="true"${upperObjectX!==objectX?' data-upper-extension-start-x="'+pt(upperObjectX+5)+'"':''}>${line(upperObjectX+5,y0,at+9,y0)}${line(objectX+5,y1,at+9,y1)}${line(at,y0,at,y1)}${line(at-5,y0-5,at+5,y0+5)}${line(at-5,y1-5,at+5,y1+5)}${text(at-9,(y0+y1)/2,label,`text-anchor="middle" transform="rotate(-90 ${pt(at-9)} ${pt((y0+y1)/2)})" stroke="#fff" stroke-width="5" paint-order="stroke"`)}</g>`;
    // Numbered short leaders end on the actual bar; a separate key identifies it.
    const mark=(p,bx,by,number,family,barId,x,y,attrs='')=>{const tx=x(p),ty=y(p),len=Math.hypot(tx-bx,ty-by),r=12,ax=len?r*(tx-bx)/len:0,ay=len?r*(ty-by)/len:0;return `<g data-steel-mark="${number}" data-steel-family="${family}" data-target-bar="${esc(barId)}" data-target-mm="${p.join(',')}" ${attrs}><path d="M${pt(bx+ax)} ${pt(by+ay)}L${pt(tx)} ${pt(ty)}" fill="none" stroke="#20252b" stroke-width="1.2"/><circle cx="${pt(tx)}" cy="${pt(ty)}" r="2.3" fill="#20252b"/><circle cx="${pt(bx)}" cy="${pt(by)}" r="12" fill="#fff" stroke="#20252b" stroke-width="1.3"/>${text(bx,by+5,number,'text-anchor="middle" font-size="14" font-weight="700"')}</g>`;};
    const key=(y=155,visible=['01','02','03','04','05'],supportOnly=false)=>{
      const entries=[
        ...(g.main.length?[['01','01  '+ledger.mainLabel+' Aₛ',reference?'ขาบนและขากลับ เป็นเหล็กเส้นเดียวกัน':'เหล็กหลักตามรูปงอเดิม']]:[]),
        ...(g.ties.length?[['02','02  '+ledger.tieLabel+' Aₕ',supportOnly?['เห็น 1 จุด/ชั้น ที่ขาในคาน','ขาในหูช้างอยู่นอกกรอบ']:['ปลอกแนวนอน 2 ขาต่อชั้น']]]:[]),
        ...(anchor?[['03','03  1-DB'+f(anchor.diameterMm)+' Anchor','เหล็กขวางปลายหูช้าง · รอยต่อรอตรวจ']]:[]),
        ...(g.verticalTies.length?[['04','04  RB'+f(g.verticalTies[0].diameterMm)+' @'+f(g.verticalTies[0].spacingMm),'ปลอกแนวตั้งหูช้าง '+g.verticalTies.length+' วง · ตัวอย่าง']]:[]),
        ...(g.supportTies.length?[['05','05  RB'+f(g.supportTies[0].diameterMm)+' @'+f(g.supportTies[0].spacingMm),'ปลอกคานรองรับ '+g.supportTies.length+' วง · ตัวอย่าง']]:[])
      ];return entries.filter(([code])=>visible.includes(code)).map(([code,a,b],i)=>{const rowY=y+i*(supportOnly?78:64);return '<g data-view-key="'+code+'">'+text(708,rowY,a,'font-weight="700" font-size="19"')+(Array.isArray(b)?b:[b]).map((label,j)=>text(708,rowY+24+j*21,label,'font-size="15"')).join('')+'</g>';}).join('');
    };
    // Direct names in a reserved annotation lane; the target remains on the
    // actual sampled bar, never an invented diagram point.
    const named=(p,by,number,family,barId,x,y,labels,attrs='',route='elbow')=>{
      const tx=x(p),ty=y(p),bx=54,endRun=Math.min(38,Math.max(1,tx-246));
      return '<g data-steel-mark="'+number+'" data-steel-family="'+family+'" data-target-bar="'+esc(barId)+'" data-target-mm="'+p.join(',')+'" data-direct-callout="true" '+attrs+'>'+
        '<path data-leader-route="'+route+'" d="M245 '+pt(by)+(route==='side-leg'?'L'+pt(tx-endRun)+' '+pt(ty-endRun)+'L':'L265 '+pt(ty)+'L')+pt(tx)+' '+pt(ty)+'" fill="none" stroke="#20252b" stroke-width="1.3"/><circle data-leader-endpoint="true" cx="'+pt(tx)+'" cy="'+pt(ty)+'" r="'+(route==='side-leg'?'2.6':'2.3')+'" fill="#20252b"'+(route==='side-leg'?' stroke="#fff" stroke-width="1.2"':'')+'/>'+
        '<circle cx="54" cy="'+pt(by)+'" r="12" fill="#fff" stroke="#20252b" stroke-width="1.3"/>'+text(bx,by+5,number,'text-anchor="middle" font-size="14" font-weight="700"')+
        labels.map((label,i)=>text(76,by-7+i*23,label,i?'font-size="16"':'font-size="19" font-weight="700"')).join('')+'</g>';
    };
    // Pick a real straight side segment, clear of cut-bar dots in paper space.
    // This changes annotation only; sampled reinforcement geometry is immutable.
    const sideLegTarget=(tie,hits,x,y,scale)=>{
      const axis=tie.orientation==='xy'?0:2,edge=Math.min(...tie.points.map(p=>p[axis]));
      const segments=tie.points.slice(1).map((b,i)=>[tie.points[i],b]).filter(([a,b])=>Math.abs(a[axis]-edge)<1e-6&&Math.abs(b[axis]-edge)<1e-6&&Math.abs(b[1]-a[1])>1e-6).sort(([a,b],[c,d])=>Math.abs(d[1]-c[1])-Math.abs(b[1]-a[1]));
      if(!segments.length)return {point:tie.points.reduce((best,p)=>p[axis]<best[axis]?p:best,tie.points[0]),straight:false};
      const [a,b]=segments[0],candidates=[.5,.4,.6,.3,.7,.2,.8].map(t=>a.map((v,k)=>v+t*(b[k]-v)));
      const clearance=p=>Math.min(Infinity,...hits.map(hit=>Math.hypot(x(p)-x(hit.p),y(p)-y(hit.p))-hit.bar.radiusMm*scale));
      return {point:candidates.reduce((best,p)=>clearance(p)>clearance(best)?p:best,candidates[0]),straight:true};
    };
    const locator=(view,letter,axis,at,y=88)=>{
      const x=710,w=255,H=208,q=185/(right-left),lx=v=>744+(v-left)*q;
      let body='';
      if(axis==='x'){
        const scale=Math.min(q,88/deep),xx=v=>744+(v-left)*q,yy=v=>y+76+v*scale;
        body=(known?line(xx(left),yy(0),xx(0),yy(0),'locator')+line(xx(left),yy(0),xx(left),yy(deep),'locator')+line(xx(left),yy(deep),xx(0),yy(deep),'locator'):'')+
          '<path d="M'+pt(xx(0))+' '+pt(yy(0))+'H'+pt(xx(L))+'V'+pt(yy(h2))+'L'+pt(xx(0))+' '+pt(yy(h))+'Z" fill="none" stroke="#818892" stroke-width="1.2"/>'+
          line(xx(at),yy(0)-14,xx(at),yy(h-(h-h2)*at/L)+13,'locator-cut','stroke-dasharray="9 3 2 3"')+
          '<path d="M'+pt(xx(at)-18)+' '+pt(yy(0)-10)+'H'+pt(xx(at)+17)+'" fill="none" stroke="#20252b" marker-end="url(#arrow-'+id+'-'+view+')"/>'+text(xx(at)+22,yy(0)-5,letter,'font-size="16" font-weight="700"')+text(742,y+188,'มองตามแกน +x','font-size="15"');
      }else{
        const qz=Math.min(q,75/b),zz=v=>y+111+v*qz;
        body='<path d="M'+pt(lx(known?left:0))+' '+pt(zz(-b/2))+'H'+pt(lx(L))+'V'+pt(zz(b/2))+'H'+pt(lx(known?left:0))+'Z" fill="none" stroke="#818892" stroke-width="1.2"/>'+line(lx(0),zz(-b/2),lx(0),zz(b/2),'locator')+
          line(lx(left)-10,zz(at),lx(axis==='z-support'?0:L)+10,zz(at),'locator-cut','stroke-dasharray="9 3 2 3"')+
          '<path d="M'+pt(lx(left)-10)+' '+pt(zz(at)-16)+'V'+pt(zz(at)+18)+'" fill="none" stroke="#20252b" marker-end="url(#arrow-'+id+'-'+view+')"/>'+text(lx(left)-25,zz(at)-19,letter,'font-size="16" font-weight="700"')+text(742,y+188,'มองตามแกน +z','font-size="15"');
      }
      return '<g data-section-locator="'+view+'" data-locator-axis="'+(axis==='x'?'x':'z')+'" data-locator-position-mm="'+at+'" data-locator-steel="false"><rect x="'+x+'" y="'+y+'" width="'+w+'" height="'+H+'" fill="none" stroke="#b7bdc4"/>'+text(725,y+27,'ตำแหน่งตัด '+letter+'-'+letter,'font-size="18" font-weight="700"')+text(725,y+52,(axis==='x'?'x':'z')+' = '+f(at)+' mm','font-size="16"')+body+'</g>';
    };
    const cuts=(bars,axis,at)=>bars.flatMap(bar=>{const hits=[];for(let i=1;i<bar.points.length;i++){const a=bar.points[i-1],b=bar.points[i],dx=b[axis]-a[axis];if(Math.abs(dx)>1e-9&&at>=Math.min(a[axis],b[axis])-1e-7&&at<=Math.max(a[axis],b[axis])+1e-7){const t=(at-a[axis])/dx,p=a.map((v,k)=>v+t*(b[k]-v));if(!hits.some(q=>Math.hypot(...q.map((v,k)=>v-p[k]))<1e-6))hits.push(p);}}return hits.map(p=>({bar,p}));});
    const outline=(view,body,attrs='')=>`<path ${attrs} data-cad-line="outline" d="${body}" fill="url(#hatch-${id}-${view})" stroke="#20252b" stroke-width="2.3"/>`;
    const ss=Math.min(454/(right-left),340/deep),sx=x=>160+(x-left)*ss,sy=y=>170+y*ss;
    const as=g.main[0],ah=g.ties.at(-1),vc=g.verticalTies[0],vs=g.supportTies[0],wallT=Number(s.wallThicknessMm??s.input?.wallThicknessMm),wallH=Number(s.wallHeightM??s.presentation?.wallHeightM);
    const sideTarget=tie=>{const x=tie.orientation==='xy'?tie.backXMm:tie.centerXMm;return sideLegTarget(tie,cuts([...g.main,...g.ties],0,x),p=>sx(p[0]),p=>sy(p[1]),ss);};
    const vcTarget=vc?sideTarget(vc):null,vsTarget=vs?sideTarget(vs):null;
    const support=known?outline('side',`M${pt(sx(left))} ${pt(sy(0))}H${pt(sx(0))}V${pt(sy(detail.detailSupportDepth))}H${pt(sx(left))}Z`,'data-section-member="support-beam" data-top-mm="0"'):'';
    const asPath=as?`<path data-main-bar="As" data-detail-bar="${as.id}" data-main-count="${g.main.length}" d="${path(as.points,p=>sx(p[0]),p=>sy(p[1]))}" fill="none" stroke="#20252b" data-plot-weight="primary" stroke-width="3.6" stroke-linejoin="round" stroke-linecap="round"/>`:'';
    const ahPaths=g.ties.map(t=>`<path data-ah-layer="${t.id}" data-detail-tie="${t.id}" d="M${pt(sx(t.backXMm))} ${pt(sy(t.centerYMm))}H${pt(sx(t.frontXMm))}" stroke="#3b4a5a" data-plot-weight="secondary" stroke-width="2.6"/>`).join('');
    const sideManual=[...g.verticalTies,...g.supportTies].map(t=>`<path data-side-manual="${t.id}" data-manual-credit="false" d="${path(t.points,p=>sx(p[0]),p=>sy(p[1]))}" fill="none" stroke="#6b737c" data-plot-weight="example" stroke-width="1.9"/>`).join('');
    const av=Number(s.avMm??s.input?.avMm)||L-wallT/2,noseZone=Number(s.noseSetbackMm??s.input?.noseSetbackMm);
    const side=svg('side',860,'01 · SIDE A–A / รูปด้าน (ฉายเหล็กทุก z)',`
      ${support}${outline('side',`M${pt(sx(0))} ${pt(sy(0))}H${pt(sx(L))}V${pt(sy(h2))}L${pt(sx(0))} ${pt(sy(h))}Z`,'data-section-member="corbel" data-top-mm="0" data-tip-mm="'+L+'"')}
      <rect data-section-member="masonry" data-base-mm="0" data-outer-mm="${L}" x="${pt(sx(L-wallT))}" y="${pt(sy(0)-42)}" width="${pt(wallT*ss)}" height="42" fill="none" stroke="#20252b" stroke-width="2"/>
      ${line(sx(L-wallT)-5,sy(0)-34,sx(L-wallT)+wallT*ss+5,sy(0)-34,'break','stroke-dasharray="6 3"')}
      ${line(sx(0),sy(0)-16,sx(0),sy(deep)+18,'datum','stroke-dasharray="12 4 2 4"')}${sideManual}${asPath}${ahPaths}
      ${anchor?`<circle data-side-anchor="${anchor.id}" cx="${pt(sx(anchor.points[0][0]))}" cy="${pt(sy(anchor.points[0][1]))}" r="${pt(anchor.radiusMm*ss)}" fill="#20252b"/>${mark(anchor.points[0],sx(anchor.points[0][0])-112,sy(anchor.points[0][1])-5,'03','Anchor',anchor.id,p=>sx(p[0]),p=>sy(p[1]),'data-rebar-label="Anchor"')}`:''}
      ${as?mark(atX(as,Math.max(0,Math.min(L*.35,as.points[0][0]+80)),ledger.mainCenterFromTopMm),sx(-100),145,'01','As',as.id,p=>sx(p[0]),p=>sy(p[1]),'data-rebar-leader="As" data-target="main-bar" data-rebar-label="As"'):''}
      ${ah?mark(atX(ah,Math.min(170,ah.frontXMm-ah.bendCenterRadiusMm),ah.centerYMm),sx(170),sy(ah.centerYMm)+26,'02','Ah',ah.id,p=>sx(p[0]),p=>sy(p[1]),'data-rebar-leader="Ah" data-target="lowest-horizontal-loop" data-rebar-label="Ah"'):''}
      ${vc?mark(vcTarget.point,sx(vc.centerXMm)-28,sy(vcTarget.point[1]),'04','CorbelVertical',vc.id,p=>sx(p[0]),p=>sy(p[1]),'data-leader-target="'+(vcTarget.straight?'straight-side-leg':'actual-bar-point')+'"'):''}
      ${vs?mark(vsTarget.point,sx(left)-32,sy(vsTarget.point[1]),'05','SupportVertical',vs.id,p=>sx(p[0]),p=>sy(p[1]),'data-leader-target="'+(vsTarget.straight?'straight-side-leg':'actual-bar-point')+'"'):''}
      ${key(163)}
      ${hd(sx(0),sx(L),sy(deep),560,'L = '+f(L))}${known?hd(sx(left),sx(0),sy(detail.detailSupportDepth),560,f(detail.detailSupportWidth)):''}
      ${vd(sy(0),sy(h2),sx(L),sx(L)+36,'h₂ = '+f(h2))}${vd(sy(0),sy(h),sx(L),sx(L)+76,'h = '+f(h))}
      ${known?vd(sy(0),sy(detail.detailSupportDepth),sx(left),100,f(detail.detailSupportDepth)):''}
      ${hd(sx(0),sx(av),sy(0)-58,96,'aᵥ = '+f(av))}
      <path data-load-line="Vu-center" d="M${pt(sx(av))} 116V${pt(sy(0)-4)}" fill="none" stroke="#20252b" stroke-width="2" marker-end="url(#arrow-${id}-side)"/>
      ${text(780,91,'Vᵤ '+f(s.vuKg)+' kgf','font-weight="700"')}${text(780,118,'Nᵤ '+f(s.nucKg)+' kgf','font-weight="700"')}
      <path data-load="Nu" data-origin="wall-tip" d="M${pt(sx(L)-30)} ${pt(sy(0)-20)}H${pt(sx(L)+35)}" stroke="#20252b" stroke-width="2" marker-end="url(#arrow-${id}-side)"/>
      <g data-dimension="c-anchor-zone">${line(sx(L-noseZone),sy(0)-10,sx(L-noseZone),sy(0)-25)}${line(sx(L),sy(0)-10,sx(L),sy(0)-25)}${line(sx(L-noseZone),sy(0)-21,sx(L),sy(0)-21)}</g>
      ${text(735,478,reference?'Aₛ กลับตามท้องลาด':'งอ Aₛ 90°','font-size="17" font-weight="700"')}${text(735,502,'D ใน '+f(detail.detailMainBend)+' · หางกลับ '+f(detail.detailSupportTail),'font-size="16"')}${text(735,525,'ขาลงจริง '+f(ledger.referenceReturn?.noseStraightMm),'font-size="16"')}${text(735,548,'ขาลงขั้นต่ำ '+f(detail.detailNoseTail),'font-size="16"')}
      ${locator('side','A','z',0,628)}${text(36,606,'ผนัง t = '+f(wallT)+' mm, H = '+f(wallH)+' m (ย่อเฉพาะสูง)  |  c_anchor = '+f(noseZone)+' mm','font-size="17"')}`);
    const mainY=Number.isFinite(ledger.mainCenterFromTopMm)?ledger.mainCenterFromTopMm:h-d.d;
    const fs=Math.min(300/b,380/h),fx=z=>420+z*fs,fy=y=>150+y*fs;
    const frontMain=cuts(g.main,0,0),frontAh=cuts(g.ties,0,0).sort((a,b)=>a.p[2]-b.p[2]||a.p[1]-b.p[1]),upper=frontMain.filter(hit=>Math.abs(hit.p[1]-ledger.mainCenterFromTopMm)<1e-6),returns=frontMain.filter(hit=>hit.p[1]>ledger.mainCenterFromTopMm+1e-6);
    const cutDot=(hit,x,y,attrs='')=>'<circle '+attrs+' data-actual-cut-bar="'+hit.bar.id+'" data-cut-point-mm="'+hit.p.join(',')+'" cx="'+pt(x(hit.p))+'" cy="'+pt(y(hit.p))+'" r="'+pt(hit.bar.radiusMm*fs)+'" fill="#20252b"/>';
    const front=svg('front',780,'02 · FRONT B–B / รูปตัดโคนหูช้าง x = 0',
      outline('front','M'+pt(fx(-b/2))+' '+pt(fy(0))+'H'+pt(fx(b/2))+'V'+pt(fy(h))+'H'+pt(fx(-b/2))+'Z')+
      upper.map(hit=>cutDot(hit,p=>fx(p[2]),p=>fy(p[1]),'data-front-main="'+hit.bar.id+'" data-as-leg="top"')).join('')+
      frontAh.map(hit=>cutDot(hit,p=>fx(p[2]),p=>fy(p[1]),'data-front-tie="'+hit.bar.id+'"')).join('')+
      returns.map(hit=>cutDot(hit,p=>fx(p[2]),p=>fy(p[1]),'data-front-return="'+hit.bar.id+'" data-as-leg="return"')).join('')+
      (upper[0]?named(upper[0].p,210,'01','As',upper[0].bar.id,p=>fx(p[2]),p=>fy(p[1]),[ledger.mainLabel+' Aₛ','ขาบน'],'data-rebar-label="As"'):'')+
      (frontAh[0]?named(frontAh[0].p,310,'02','Ah',frontAh[0].bar.id,p=>fx(p[2]),p=>fy(p[1]),[ledger.tieLabel+' Aₕ','ตัดผ่าน 2 ขาต่อชั้น'],'data-rebar-label="Ah"'):'')+
      (returns[0]?named(returns[0].p,490,'01','As',returns[0].bar.id,p=>fx(p[2]),p=>fy(p[1]),[ledger.mainLabel+' Aₛ','ขากลับของเส้นเดิม'],'data-rebar-label="As-return"'):'')+
      hd(fx(-b/2),fx(b/2),fy(h),595,'b = '+f(b))+vd(fy(0),fy(h),fx(b/2),fx(b/2)+76,'h = '+f(h))+(Number.isFinite(mainY)?vd(fy(mainY),fy(h),fx(b/2),fx(b/2)+36,'d = '+f(d.d)):'')+
      locator('front','B','x',0)+key(355,['01','02'])+
      text(36,675,reference?'ขากลับ Aₛ เส้นเดิม: จุดบนและจุดล่างรวมเป็น '+g.main.length+' เส้น ไม่ใช่ '+(g.main.length*2)+' เส้น':'เหล็กหลัก '+ledger.mainLabel+' ตามรูปงอเดิม','font-size="19" font-weight="700" data-as-identity-note="true"')+
      text(36,710,'จุดทึบ = เหล็กที่ถูกตัดผ่าน   /   ระยะหุ้มปลอก '+f(c)+' mm','font-size="18"')+
      text(36,742,'รูปตัดที่หน้าคานรองรับ ดูตำแหน่ง B–B ในภาพเล็กด้านขวา','font-size="17"'));
    const one=g.ties[0],ps=Math.min(420/(right-left),240/b),px=x=>160+(x-left)*ps,pz=z=>310+z*ps;
    const plan=svg('plan',650,'03 · PLAN Ah / แปลนเหล็กแนวนอน',
      (known?outline('plan','M'+pt(px(left))+' '+pt(pz(-b/2))+'H'+pt(px(0))+'V'+pt(pz(b/2))+'H'+pt(px(left))+'Z'):'')+
      outline('plan','M'+pt(px(0))+' '+pt(pz(-b/2))+'H'+pt(px(L))+'V'+pt(pz(b/2))+'H'+pt(px(0))+'Z')+
      (one?'<path data-ah-plan="'+(one.closed?'closed-horizontal-loop':'support-continuation-unresolved')+'" data-plan-tie="'+one.id+'" data-closed="'+one.closed+'" d="'+path(one.points,p=>px(p[0]),p=>pz(p[2]))+'" fill="none" stroke="#20252b" stroke-width="'+pt(one.diameterMm*ps)+'" stroke-linejoin="round"/>':'')+
      g.main.map(bar=>'<path data-plan-main="'+bar.id+'" data-plan-projection="top-run-only" d="'+path(bar.points.filter(p=>Math.abs(p[1]-ledger.mainCenterFromTopMm)<1e-6),p=>px(p[0]),p=>pz(p[2]))+'" fill="none" stroke="#626971" stroke-width="1.5" stroke-dasharray="10 5"/>').join('')+
      (anchor?'<path data-plan-anchor="'+anchor.id+'" d="'+path(anchor.points,p=>px(p[0]),p=>pz(p[2]))+'" fill="none" stroke="#20252b" stroke-width="'+pt(anchor.diameterMm*ps)+'"/>'+mark([anchor.points[0][0],anchor.points[0][1],20],px(anchor.points[0][0])+34,pz(20)+26,'03','Anchor',anchor.id,p=>px(p[0]),p=>pz(p[2]),'data-rebar-label="Anchor"'):'')+
      (one?mark([one.backXMm,one.centerYMm,0],px(one.backXMm)-35,pz(0)-35,'02','Ah',one.id,p=>px(p[0]),p=>pz(p[2]),'data-rebar-label="Ah"'):'')+
      (as?mark(atX(as,Math.min(130,L*.3),ledger.mainCenterFromTopMm),px(Math.min(130,L*.3)),pz(as.points[0][2])-40,'01','As',as.id,p=>px(p[0]),p=>pz(p[2])):'')+
      hd(px(0),px(L),pz(b/2),510,'L = '+f(L))+(known?hd(px(left),px(0),pz(b/2),510,f(detail.detailSupportWidth)):'')+vd(pz(-b/2),pz(b/2),px(L),px(L)+60,'b = '+f(b))+key(150,['01','02','03'])+
      text(36,580,'เส้นทึบ 02 = Aₕ ชั้นบนหนึ่งวง   /   เส้นประ 01 = ขาบน Aₛ '+g.main.length+' เส้น','font-size="19"')+
      text(36,615,g.verticalTies.length+g.supportTies.length?'แผนผังแนวตัดและตำแหน่งปลอกแนวตั้งแสดงแยกในหน้าถัดไป':'ตำแหน่งตัดดูภาพเล็กในรูปด้านและรูปตัด','font-size="18"'));
    const supportSlice=g.supportTies[Math.floor(g.supportTies.length/2)];
    const mapOutline=(view,x0,y0,scale)=>{
      const xx=v=>x0+(v-left)*scale,zz=v=>y0+v*scale;
      return '<g data-map-concrete="true"><path d="M'+pt(xx(known?left:0))+' '+pt(zz(-b/2))+'H'+pt(xx(L))+'V'+pt(zz(b/2))+'H'+pt(xx(known?left:0))+'Z" fill="none" stroke="#747c85" stroke-width="1.5"/>'+line(xx(0),zz(-b/2),xx(0),zz(b/2),'datum','stroke-dasharray="7 4" opacity=".65"')+'</g>';
    };
    const hasManual=g.verticalTies.length+g.supportTies.length>0;
    const mapScale=Math.min(550/(right-left),150/b),mapX=v=>170+(v-left)*mapScale,mapZ=v=>220+v*mapScale;
    const cutLine=(letter,axis,at)=>{const a=axis==='x'?[mapX(at),mapZ(-b/2)-18]:[mapX(left)-18,mapZ(at)],z=axis==='x'?[mapX(at),mapZ(b/2)+18]:[mapX(letter==='D'?0:L)+18,mapZ(at)];return '<g data-cut-locator="'+letter+'" data-cut-axis="'+axis+'" data-cut-position-mm="'+at+'">'+line(...a,...z,'section-cut','stroke-dasharray="14 5 3 5"')+text(a[0]-16,a[1]-14,letter,'font-size="19" font-weight="700"')+text(z[0]+(letter==='D'?-28:6),z[1]+20,letter,'font-size="19" font-weight="700"'+(letter==='D'?' text-anchor="end"':''))+'</g>';};
    const strip=(bars,x0,y0,title,number)=>{if(!bars.length)return '';const scale=Math.min(360/(right-left),105/b),xx=v=>x0+(v-left)*scale,zz=v=>y0+v*scale;return '<g data-manual-projection-strip="'+number+'">'+text(x0,y0-80,title,'font-size="20" font-weight="700"')+mapOutline('section-map',x0,y0,scale)+bars.map(t=>'<path data-plan-manual="'+t.id+'" data-manual-credit="false" data-projection-only="true" d="'+path(t.points,p=>xx(p[0]),p=>zz(p[2]))+'" fill="none" stroke="#20252b" stroke-width="'+pt(t.diameterMm*scale)+'"/>').join('')+text(x0,y0+90,bars.length+' วง · '+(number==='04'?'x':'z')+' = '+bars.map(t=>f(number==='04'?t.centerXMm:t.centerZMm)).join(', ')+' mm','font-size="17"')+text(x0,y0+116,'RB'+f(bars[0].diameterMm)+' @'+f(bars[0].spacingMm)+' · ตัวอย่าง','font-size="18"')+'</g>';};
    const sectionMap=hasManual?svg('section-map',740,'04 · แผนผังตำแหน่งตัดและปลอกแนวตั้ง',
      text(36,92,'ตำแหน่งตัดบนแปลนคอนกรีต (ไม่แสดงเหล็ก)','font-size="20" font-weight="700"')+mapOutline('section-map',170,220,mapScale)+cutLine('A','z',0)+cutLine('B','x',0)+(vc?cutLine('C','x',vc.centerXMm):'')+(supportSlice?cutLine('D','z',supportSlice.centerZMm):'')+
      text(750,154,'A–A : รูปด้าน','font-size="18"')+text(750,190,'B–B : โคนหูช้าง','font-size="18"')+(vc?text(750,226,'C–C : x = '+f(vc.centerXMm),'font-size="18"'):'')+(supportSlice?text(750,262,'D–D : z = '+f(supportSlice.centerZMm),'font-size="18"'):'')+
      strip(g.verticalTies,55,480,'04  ปลอกแนวตั้งหูช้าง','04')+strip(g.supportTies,550,480,'05  ปลอกคานรองรับ','05')+
      text(36,675,'เส้นประ = หน้าคาน · ภาพล่างแสดงตำแหน่งปลอก รูปทรงเต็มดู C–C และ D–D','font-size="18"')+
      text(36,708,'ทั้งสองกลุ่มเป็นรายละเอียดตัวอย่าง ไม่เพิ่มพื้นที่ Aₛ/Aₕ หรือเครดิตกำลัง','font-size="18"')):'';
    const manualSection=(tie,view,title,number)=>{if(!tie)return '';const isSupport=tie.orientation==='xy',axis=isSupport?2:0,at=isSupport?tie.centerZMm:tie.centerXMm,H=isSupport?detail.detailSupportDepth:h-(h-h2)/L*at,W=isSupport?detail.detailSupportWidth:b,scale=Math.min(300/W,380/H),origin=isSupport?-W/2:0,mx=p=>420+(p[isSupport?0:2]-origin)*scale,my=p=>150+p[1]*scale;
      const keep=hit=>!isSupport||hit.p[0]<=0&&hit.p[0]>=-W,mainCuts=cuts(g.main,axis,at).filter(keep),ahCuts=cuts(g.ties,axis,at).filter(keep).sort((a,b)=>a.p[isSupport?0:2]-b.p[isSupport?0:2]||a.p[1]-b.p[1]),top=mainCuts.filter(hit=>Math.abs(hit.p[1]-ledger.mainCenterFromTopMm)<1e-6),back=mainCuts.filter(hit=>hit.p[1]>ledger.mainCenterFromTopMm+1e-6),targetInfo=sideLegTarget(tie,[...mainCuts,...ahCuts],mx,my,scale),target=targetInfo.point;
      const faceX=mx([0,0,at]),stub=Math.max(0,Math.min(32,690-faceX-8)),topY=my([0,0,at]),bottomY=my([0,h,at]),endY=my([0,h-(h-h2)*Math.min(L,stub/scale)/L,at]);
      const context=isSupport&&stub>=14?'<g data-section-context="corbel-beyond" data-context-steel="false" data-context-break-x="'+pt(faceX+stub)+'"><path d="M'+pt(faceX)+' '+pt(topY)+'h'+pt(stub)+'M'+pt(faceX)+' '+pt(bottomY)+'L'+pt(faceX+stub)+' '+pt(endY)+'" fill="none" stroke="#6b737c" stroke-width="1"/><path data-cad-line="break" d="M'+pt(faceX+stub)+' '+pt(topY-6)+'V'+pt((topY+endY)/2-8)+'l6 4l-12 8l6 4V'+pt(endY+6)+'" fill="none" stroke="#6b737c" stroke-width="1"/>'+text(faceX+8,119,'หูช้างต่อออกไป →','font-size="15"')+text(faceX+8,138,'(นอกกรอบตัด)','font-size="15"')+'</g>':'';
      const visible=[...(mainCuts.length?['01']:[]),...(ahCuts.length?['02']:[]),number];
      // Read down the same order as the actual cut points. Keep names apart
      // instead of sending a top-of-page leader through every other callout.
      const callouts=[
        {p:target,number,family:tie.role,id:tie.id,labels:['RB'+f(tie.diameterMm)+' @'+f(tie.spacingMm),isSupport?'ปลอกคาน (ตัวอย่าง)':'ปลอกแนวตั้ง (ตัวอย่าง)'],manual:true},
        ...(top[0]?[{p:top[0].p,number:'01',family:'As',id:top[0].bar.id,labels:[ledger.mainLabel+' Aₛ','ขาบน']}]:[]),
        ...(ahCuts[0]?[{p:ahCuts[0].p,number:'02',family:'Ah',id:ahCuts[0].bar.id,labels:[ledger.tieLabel+' Aₕ',isSupport?'เหล็กหูช้างที่ตัดผ่าน':'ตัดผ่าน 2 ขาต่อชั้น']}]:[]),
        ...(back[0]?[{p:back[0].p,number:'01',family:'As',id:back[0].bar.id,labels:[ledger.mainLabel+' Aₛ','ขากลับของเส้นเดิม']}]:[])
      ].sort((a,b)=>my(a.p)-my(b.p));
      let lastY=90;for(const item of callouts){item.y=Math.max(lastY+54,my(item.p)-(item.manual?Math.min(38,Math.max(1,mx(item.p)-246)):0));lastY=item.y;}
      const shift=Math.max(0,lastY-570),labels=callouts.map(item=>named(item.p,item.y-shift,item.number,item.family,item.id,mx,my,item.labels,item.manual?'data-leader-target="'+(targetInfo.straight?'straight-side-leg':'actual-bar-point')+'"':item.family==='Ah'?'data-rebar-label="Ah"':'',item.manual?'side-leg':'elbow')).join('');
      return svg(view,820,title+' · '+(isSupport?'z':'x')+' = '+f(at),
        outline(view,'M'+pt(420-W/2*scale)+' 150H'+pt(420+W/2*scale)+'V'+pt(150+H*scale)+'H'+pt(420-W/2*scale)+'Z')+
        '<path data-manual-section="'+tie.id+'" data-cut-axis="'+(isSupport?'z':'x')+'" data-cut-position-mm="'+at+'" data-manual-credit="false" d="'+path(tie.points,mx,my)+'" fill="none" stroke="#6b737c" data-plot-weight="example" stroke-width="1.9"/>'+context+
        [...mainCuts,...ahCuts].map(({bar,p})=>'<circle data-actual-cut-bar="'+bar.id+'" data-cut-point-mm="'+p.join(',')+'" data-as-leg="'+(bar.role==='As'?(p[1]===ledger.mainCenterFromTopMm?'top':'return'):'not-As')+'" cx="'+pt(mx(p))+'" cy="'+pt(my(p))+'" r="'+pt(bar.radiusMm*scale)+'" fill="#20252b"'+(bar.role==='Ah'?' stroke="#fff" stroke-width="1" paint-order="stroke"':'')+'/>').join('')+
        labels+
        hd(420-W/2*scale,420+W/2*scale,150+H*scale,610,(isSupport?'ความกว้างคาน':'b')+' = '+f(W))+vd(150,150+H*scale,420+W/2*scale,isSupport?faceX+stub+40:420+W/2*scale+70,'h รูปตัด = '+f(H),isSupport?faceX+stub+2:420+W/2*scale)+
        locator(view,isSupport?'D':'C',isSupport?'z-support':'x',at)+key(356,visible,isSupport)+
        (isSupport?text(708,550,'ยังไม่มีข้อมูล','font-size="18" font-weight="700"')+text(708,574,'เหล็กตามยาวคาน','font-size="18" font-weight="700"'):text(708,598,'จุดบนและจุดล่าง Aₛ','font-size="17"')+text(708,622,'เป็น '+g.main.length+' เส้นเดียวกัน','font-size="17"'))+
        text(36,692,'D ดัดด้านใน '+f(tie.bendCenterRadiusMm*2-tie.diameterMm)+' mm   /   cover ขั้นต่ำ '+f(tie.coverMm)+' mm'+(isSupport?'':' · cover ข้างจริง '+f(ledger.vertical.corbel.actualSideCoverMm)+' mm'),'font-size="18"')+
        text(36,728,isSupport?'จุด 02 คือ Aₕ ของหูช้างที่ผ่านรูปตัด ไม่ใช่เหล็กตามยาวคาน':'01 ขาบน + ขากลับ = เหล็กหลัก '+g.main.length+' เส้นเดียวกัน','font-size="19" font-weight="700"')+
        text(36,764,isSupport?'โซนคานยาว b = '+f(b)+' mm · ไม่มีข้อมูลเหล็กตามยาวคาน':'รูปตัดจากแนวเหล็กจริงที่ x = '+f(at)+' mm · Aₛ จาก h−d = '+f(ledger.mainCenterFromTopMm)+' mm ตาม Engine','font-size="18"')+
        text(36,792,'ปลอก '+number+' เป็นรายละเอียดตัวอย่าง · จุดปิดปลอก/มาตรฐาน/ออกแบบยังรอตรวจ','font-size="17"'));
    };
    const corbelCut=manualSection(vc,'corbel-vertical','05 · SECTION C–C / รูปตัดหูช้าง','04'),supportCut=manualSection(g.supportTies[Math.floor(g.supportTies.length/2)],'support-vertical','06 · SECTION D–D / รูปตัดปลอกคานรองรับ','05');
    const rows=[['เหล็กหลัก Aₛ',ledger.mainLabel],['ปลอกแนวนอน Aₕ',ledger.tieLabel+' (2 ขา/ชั้น)'],['Aₛ แกนจากบน h−d',f(ledger.mainCenterFromTopMm)],['Aₛ C/C จริง / ช่องใสจริง',f(ledger.mainPitchMm)+' / '+f(ledger.mainClearSpacingMm)],['ช่องใสที่ Engine ใช้คัดชุด (ก่อนวางปลอก)',f(ledger.engineAvailableClearMm)],['cover Aₕ / Aₛ ด้านบน',f(c)+' / '+f(ledger.mainTopClearMm)],['Aₛ เข้าเนื้อคาน / Aₕ แกนหลัง',f(detail.detailEmbed)+' / '+f(-one?.backXMm)],['งอ Aₛ D ใน / หางคาน / หางปลาย',f(detail.detailMainBend)+' / '+f(detail.detailSupportTail)+' / '+f(detail.detailNoseTail)],['งอ Aₕ D ใน / ชั้น C/C',f(detail.detailTieBend)+' / '+f(ledger.tiePitchMm)]];
    if(reference){rows[7]=['Aₛ D ใน / หางกลับจริง / ขาลงขั้นต่ำ',f(detail.detailMainBend)+' / '+f(detail.detailSupportTail)+' / '+f(detail.detailNoseTail)];rows.push(['รูปแบบ Aₛ','แนวบน + ขากลับตามท้องลาด (เส้นเดิม)'],['ขาลงช่วงตรงจริง',f(ledger.referenceReturn?.noseStraightMm)],['Anchor ขวางที่ปลาย',ledger.anchorLabel],['Anchor x / y จากหน้าคาน / ผิวบน',anchor?f(anchor.points[0][0])+' / '+f(anchor.points[0][1]):'ยังไม่ทราบ'],['Anchor เป็นรายละเอียดแยก','ไม่เพิ่มพื้นที่ Aₛ/Aₕ · ยังไม่ตรวจรอยต่อ/กำลังยึดปลาย']);}
    for(const [name,v] of Object.entries(ledger.vertical||{})){rows.push([name==='corbel'?'04 ปลอกแนวตั้งหูช้าง (ตัวอย่าง)':'05 ปลอกคานรองรับ (ตัวอย่าง)',v.label],['D ใน / cover ขั้นต่ำ / เริ่ม',f(v.bendInsideMm)+' / '+f(v.coverMm)+' / '+f(v.startMm)],['แกน '+v.distributionAxis+' (mm) · โซน '+f(v.zoneLengthMm),v.centersMm.map(f).join(', ')],['เครดิตกำลัง / จุดต่อ','ไม่เพิ่ม As/Ah · ยังไม่ตรวจออกแบบ/จุดต่อ']);}
    const issue=g.errors[0]||g.issues.find(i=>i.code.includes('CLASH'))||g.issues.find(i=>i.code.includes('UNKNOWN'));
    return `<div class="corbel-cad-drawing" data-cad-sheet="CB-01" data-snapshot-id="${esc(g.snapshotId)}"><div class="corbel-cad-title"><strong>${esc(s.memberId||s.input?.memberId||'CB-01')} รายละเอียดหูช้าง ค.ส.ล.</strong><span>ผลคำนวณ ${esc(g.snapshotId||'PREVIEW')} · หน่วย mm · NTS</span></div>${side}${front}${plan}${sectionMap}${corbelCut}${supportCut}<div class="corbel-cad-ledger" data-cad-ledger="true"><h4>มิติเหล็กจากผลคำนวณ</h4><table><tbody>${rows.map(([key,value])=>`<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`).join('')}</tbody></table><h4>ตำแหน่งปลอก Aₕ ทุกชั้น</h4><table><thead><tr><th>ชั้น</th><th>แกนจากบน (mm)</th><th>แกนหน้า (mm)</th></tr></thead><tbody>${g.ties.map((t,i)=>`<tr><td>${i+1}</td><td>${f(t.centerYMm)}</td><td>${f(t.frontXMm)}</td></tr>`).join('')}</tbody></table><p><strong>${esc(g.status)}</strong>${issue?' · '+esc(issue.text):' · รูปทรงตามมิติกรอก'}</p><p>คงจำนวนและขนาดเหล็กจาก Engine ปลอกแนวตั้ง/ปลอกคานเป็นรายละเอียดตัวอย่างแยกจาก As/Ah ไม่มีข้อมูลเหล็กยืนคาน ห้ามวัดระยะจากภาพ</p><p><strong>REVIEW / NOT FOR CONSTRUCTION</strong> · ระยะพัฒนา กำลังยึดปลาย มาตรฐานดัด จุดต่อปลอก และ confinement ยังต้องตรวจรับ</p></div></div>`;
  }
  root.CorbelCadDrawing=Object.freeze({render});
})(typeof window==='undefined'?globalThis:window);
