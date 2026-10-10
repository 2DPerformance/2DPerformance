/* CB-01 only. Millimetre geometry projection; never selects steel or changes capacity. */
(function install(root) {
  'use strict';
  const VERSION='20261006-06';
  const PATTERNS=Object.freeze(['legacy-90','reference-return']);
  const FIELD_IDS=['detailSupportWidth','detailSupportDepth','detailEmbed','detailMainBend','detailSupportTail','detailNoseTail','detailTieBend','detailTieEmbed'];
  const FIELD_LABELS=['ความกว้างคาน','ความลึกคาน','ระยะเข้าเนื้อคาน','มิติดัด As','หางงอในคาน','หางงอที่ปลาย','มิติดัด Ah','ระยะเข้าเนื้อคานของ Ah'];
  const TRIAL_DETAILS=Object.freeze({detailSupportWidth:400,detailSupportDepth:700,detailEmbed:250,detailMainBend:72,detailSupportTail:144,detailNoseTail:144,detailTieBend:36,detailTieEmbed:300});
  const VERTICAL_FIELDS=Object.freeze(['verticalCorbelEnabled','verticalCorbelDiameter','verticalCorbelPitch','verticalCorbelBend','verticalCorbelCover','verticalCorbelStart','verticalSupportEnabled','verticalSupportDiameter','verticalSupportPitch','verticalSupportBend','verticalSupportCover','verticalSupportStart']);
  const VERTICAL_TRIAL=Object.freeze({verticalCorbelEnabled:true,verticalCorbelDiameter:9,verticalCorbelPitch:150,verticalCorbelBend:36,verticalCorbelCover:40,verticalCorbelStart:50,verticalSupportEnabled:true,verticalSupportDiameter:9,verticalSupportPitch:150,verticalSupportBend:36,verticalSupportCover:40,verticalSupportStart:55});
  const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=(v)=>v===null||v===undefined||v===''?null:Number(v);
  const fmt=v=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:1}):'—';
  const point=(x,y,z)=>[x,y,z];
  // Minimum distance of two finite centreline segments (capsule collision).
  function segmentDistance(a,b,c,d) {
    const sub=(p,q)=>p.map((v,i)=>v-q[i]),dot=(p,q)=>p.reduce((v,x,i)=>v+x*q[i],0),clamp=v=>Math.max(0,Math.min(1,v));
    const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w);
    if(aa<1e-12&&cc<1e-12)return Math.hypot(...w);
    let t=aa<1e-12?0:clamp((bb*ee-cc*dd)/(aa*cc-bb*bb||Infinity)),s=cc<1e-12?0:clamp((bb*t+ee)/cc);
    t=aa<1e-12?0:clamp((bb*s-dd)/aa);s=cc<1e-12?0:clamp((bb*t+ee)/cc);
    return Math.hypot(...w.map((x,i)=>x+t*u[i]-s*v[i]));
  }
  function clash(a,b,tolerance=.05) {
    const limit=a.radiusMm+b.radiusMm;
    const bounds=bar=>[0,1,2].map(i=>[Math.min(...bar.points.map(p=>p[i]))-bar.radiusMm,Math.max(...bar.points.map(p=>p[i]))+bar.radiusMm]);
    const x=bounds(a),y=bounds(b);if(x.some((v,i)=>v[1]<=y[i][0]||y[i][1]<=v[0]))return false;
    for(let i=1;i<a.points.length;i++)for(let j=1;j<b.points.length;j++)if(segmentDistance(a.points[i-1],a.points[i],b.points[j-1],b.points[j])<limit-tolerance)return true;
    return false;
  }
  function arc(cx,cy,r,a,b,z,axis='xy') {
    const count=Math.max(1,Math.ceil(Math.abs(b-a)/(Math.PI/72)));
    return Array.from({length:count+1},(_,i)=>{const t=a+(b-a)*i/count;return axis==='xy'?point(cx+r*Math.cos(t),cy+r*Math.sin(t),z):point(cx+r*Math.cos(t),z,cy+r*Math.sin(t));});
  }
  function roundedLoop(x0,x1,z0,z1,y,r,closed) {
    if(!r)return [point(x0,y,z1),point(x1,y,z1),point(x1,y,z0),point(x0,y,z0),...(closed?[point(x0,y,z1)]:[])];
    if(!closed)return [point(x0,y,z1),...arc(x1-r,z1-r,r,Math.PI/2,0,y,'xz'),...arc(x1-r,z0+r,r,0,-Math.PI/2,y,'xz'),point(x0,y,z0)];
    const ps=[...arc(x0+r,z1-r,r,Math.PI,Math.PI/2,y,'xz'),...arc(x1-r,z1-r,r,Math.PI/2,0,y,'xz'),...arc(x1-r,z0+r,r,0,-Math.PI/2,y,'xz'),...arc(x0+r,z0+r,r,-Math.PI/2,-Math.PI,y,'xz')];
    return [...ps,ps[0].slice()];
  }
  // Circular fillets of a physical centreline, with no Catmull-Rom overshoot.
  function fillet(points,r) {
    const corners=points.map((b,i)=>{
      if(!i||i===points.length-1)return {run:0};
      const a=points[i-1],c=points[i+1],la=Math.hypot(b[0]-a[0],b[1]-a[1]),lb=Math.hypot(c[0]-b[0],c[1]-b[1]);
      if(!la||!lb)throw Error('ช่วงเหล็กยาวเป็นศูนย์');
      const u=[(b[0]-a[0])/la,(b[1]-a[1])/la],v=[(c[0]-b[0])/lb,(c[1]-b[1])/lb],turn=Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]),run=r*Math.tan(Math.abs(turn)/2);
      const start=point(b[0]-u[0]*run,b[1]-u[1]*run,b[2]),sign=Math.sign(turn),cx=start[0]-sign*u[1]*r,cy=start[1]+sign*u[0]*r;
      return {run,turn,cx,cy,angle:Math.atan2(start[1]-cy,start[0]-cx)};
    });
    for(let i=1;i<points.length;i++)if(Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1])+1e-7<corners[i-1].run+corners[i].run)throw Error('ช่วงตรงไม่พอสำหรับรัศมีดัดจริง');
    const result=[points[0]];
    for(let i=1;i<points.length-1;i++){const q=corners[i];result.push(...(Math.abs(q.turn)<1e-8?[points[i]]:arc(q.cx,q.cy,r,q.angle,q.angle+q.turn,points[i][2])));}
    result.push(points.at(-1));return result;
  }
  function build(snapshot,state={}) {
    const input=snapshot?.input||snapshot||{}, main=snapshot?.provided?.main,tie=snapshot?.provided?.ties;
    const dimensions={b:n(input.widthMm),h:n(input.heightMm),h2:n(input.tipHeightMm),L:n(input.lengthMm),d:n(input.depthMm),c:n(input.coverMm)};
    const details={};FIELD_IDS.forEach(id=>{details[id]=n(snapshot?.presentation?.detailGeometry?.[id]);});
    const issues=[],errors=[];const fail=(code,text)=>errors.push({code,text});const pending=(code,text)=>issues.push({code,text});
    const validDimensions=Object.values(dimensions).every(v=>Number.isFinite(v)&&v>0)&&dimensions.h2<=dimensions.h&&dimensions.d<dimensions.h;
    const rejected=snapshot?.verdict==='fail',screen=snapshot?.checks?.find(check=>check.id==='support-anchor');
    const pattern=snapshot?.presentation?.detailRebarPattern||'legacy-90',reference=pattern==='reference-return';
    const base={version:VERSION,pattern,snapshotId:snapshot?.presentation?.snapshotId||null,dimensions,details,main:[],ties:[],anchors:[],verticalTies:[],supportTies:[],issues,errors,constructionAuthorized:false,anchorageVerified:false,supportScreenMm:n(screen?.demand),installation:input.surface==='monolithic'?'cast-in-monolithic':'joint-detail-unverified'};
    if(state.dirty||state.runState&&state.runState!=='ready'||snapshot?.verdict!=='pass'&&!(state.allowRejected&&rejected))return freeze({...base,renderable:false,status:'LOCKED'});
    for(const [id,value] of Object.entries(details))if(value!==null&&(!Number.isFinite(value)||value<=0||value>10000))fail('DETAIL_VALUE',`${FIELD_LABELS[FIELD_IDS.indexOf(id)]}: มิติจริงต้องอยู่ในช่วง 1–10,000 mm`);
    if(!PATTERNS.includes(pattern))fail('PATTERN','ไม่รู้จักรูปแบบเหล็ก ห้ามแทนด้วยรูปแบบอื่น');
    const validBars=bar=>bar&&Number.isInteger(bar.count)&&bar.count>=1&&bar.count<=64&&Number.isFinite(bar.diameterMm)&&bar.diameterMm>=1&&bar.diameterMm<=80;
    if(!validDimensions||!validBars(main)||!validBars(tie)){fail('SOURCE','ไม่มีมิติ/ชุดเหล็กปัจจุบันที่ครบ');return freeze({...base,renderable:false,status:'DETAIL HOLD'});}
    const {b,h,h2,L,d,c}=dimensions,rm=main.diameterMm/2,rt=tie.diameterMm/2,yMain=h-d,k=(h-h2)/L,normal=Math.hypot(1,k);
    const tieR=details.detailTieBend>0?(details.detailTieBend+tie.diameterMm)/2:null;
    const nested=details.detailTieEmbed>0&&tieR!==null;
    // The original 90-degree anchors must lie inside the rounded Ah perimeter.
    // At its two front corners the nominal capsules touch on the inner tangent.
    // This is a geometric offset, never a new code minimum or Engine spacing.
    const nestInset=nested?Math.max(rm+rt,tieR-(tieR-rm-rt)/Math.SQRT2):null;
    const verticalInput=snapshot?.presentation?.verticalDetail||{};
    for(const key of ['verticalCorbelEnabled','verticalSupportEnabled'])if(verticalInput[key]!==undefined&&typeof verticalInput[key]!=='boolean')fail('VERTICAL_ENABLE','สถานะเปิดปลอกต้องเป็น true/false เท่านั้น');
    // A continuous As bar has one lateral distribution. Explicit vertical
    // details add a nested layer inside Ah; do not move its Engine h-d axis.
    const verticalInset=verticalInput.verticalCorbelEnabled===true&&n(verticalInput.verticalCorbelDiameter)>0?n(verticalInput.verticalCorbelDiameter)+Math.max(0,(n(verticalInput.verticalCorbelCover)||c)-c):0;
    const extent=(nested?b/2-c-rt-nestInset:b/2-c-rm)-verticalInset,pitch=main.count>1?2*extent/(main.count-1):0,clear=main.count>1?pitch-2*rm:null;
    const noseX=nested?L-c-rt-nestInset:L-c-rm,embed=details.detailEmbed,back=Number.isFinite(embed)&&embed>0?-embed:0;
    if(extent<0||yMain-rm<c-1e-8||L<=2*(c+rm)||main.count>1&&clear<Math.max(25,main.diameterMm)-1e-8)fail('MAIN_COVER','แนว Aₛ จาก h−d ไม่พอสำหรับ cover/ระยะวางจริง');
    const mainR=details.detailMainBend!==null?(details.detailMainBend+main.diameterMm)/2:null;
    const mainBendValid=details.detailMainBend>0&&mainR>rm&&2*mainR<noseX-back;
    const supportKnown=details.detailSupportWidth>0&&details.detailSupportDepth>0;
    const supportHookKnown=embed>0&&supportKnown&&mainBendValid&&details.detailSupportTail>0;
    const noseHookKnown=mainBendValid&&details.detailNoseTail>0;
    const supportFits=supportHookKnown&&embed+rm+c<=details.detailSupportWidth&&yMain+mainR+details.detailSupportTail+rm+c<=details.detailSupportDepth;
    const noseFits=noseHookKnown&&(h-k*noseX-(yMain+mainR+details.detailNoseTail))/normal>=c+rm-1e-8;
    if(!reference){
      if(!supportHookKnown)pending('SUPPORT_UNKNOWN','งอ 90° เข้าคาน: กรอกขนาดคาน ระยะเข้าเนื้อคาน มิติดัด และหางงอจริง');
      else if(!supportFits)pending('SUPPORT_HOOK_CLASH','DETAIL HOLD · งอ 90° เข้าคานไม่พอสำหรับ cover/หางงอ');
      if(!noseHookKnown)pending('NOSE_UNKNOWN','งอ 90° ที่ปลาย: กรอกมิติดัดและหางงอจริง');
      else if(!noseFits)pending('NOSE_HOOK_CLASH','DETAIL HOLD · หางงอปลายชนแนวลาด/cover ต้องแก้มิติจริง');
    }
    pending('ANCHORAGE','ยังไม่ตรวจมาตรฐานดัด/หางงอ ระยะพัฒนา กำลังยึดปลาย และ confinement; ไม่ใช่ BBS ก่อสร้าง');
    let mainBars=Array.from({length:main.count},(_,i)=>{
      const z=main.count===1?0:-extent+pitch*i;
      let points=[point(back,yMain,z),point(noseX,yMain,z)];
      if(supportFits)points=[point(back,yMain+mainR+details.detailSupportTail,z),...arc(back+mainR,yMain+mainR,mainR,Math.PI,Math.PI*1.5,z),point(noseX,yMain,z)];
      if(noseFits){points.pop();points.push(...arc(noseX-mainR,yMain+mainR,mainR,-Math.PI/2,0,z),point(noseX,yMain+mainR+details.detailNoseTail,z));}
      return {id:`AS-${i+1}`,role:'As',diameterMm:main.diameterMm,radiusMm:rm,points,closed:false,supportHook:supportFits,noseHook:noseFits,terminationsVerified:false};
    });
    const zEdge=b/2-c-rt,tieBand=2*d/3,tiePitch=tieBand/(tie.count+1);
    const tieBack=details.detailTieEmbed>0?-details.detailTieEmbed:back;
    if(!tieR)pending('TIE_BEND_UNKNOWN','ปลอก Aₕ: ยังไม่ระบุเส้นผ่านศูนย์กลางดัดด้านในจริง');
    if(!(embed>0))pending('TIE_BACK_UNKNOWN','ปลอก Aₕ แสดงสองขาขนาน Aₛ; จุดปิดในคานยังไม่มีระยะจริง');
    const ties=Array.from({length:tie.count},(_,i)=>{
      const y=yMain+(i+1)*tiePitch,front=Math.min(L-c-rt,k>0?(h-y-(c+rt)*normal)/k:L-c-rt);
      const available=front-tieBack,closed=tieBack<0&&tieR!==null;
      if(zEdge<=0||front<=c+rt||tieR!==null&&(2*tieR>=available||2*tieR>=2*zEdge))fail('TIE_FIT',`Aₕ ชั้น${i+1}: พื้นที่ไม่พอสำหรับ cover/รัศมีดัดที่กำหนด`);
      if(supportKnown&&-tieBack+rt+c>details.detailSupportWidth)fail('TIE_SUPPORT','Aₕ เข้าเนื้อคานเกินพื้นที่ cover ที่กำหนด');
      return {id:`AH-${i+1}`,role:'Ah',diameterMm:tie.diameterMm,radiusMm:rt,points:roundedLoop(tieBack,front,-zEdge,zEdge,y,tieR,closed),closed,centerYMm:y,frontXMm:front,backXMm:tieBack,bendCenterRadiusMm:tieR,closureVerified:false};
    });
    const anchors=[];let referenceReturn=null;
    if(reference){
      mainBars=mainBars.map(bar=>({...bar,points:[point(back,yMain,bar.points[0][2]),point(noseX,yMain,bar.points[0][2])],supportHook:false,noseHook:false,supportReturn:false}));
      if(!supportHookKnown||!noseHookKnown||!nested)pending('REFERENCE_UNKNOWN','รูปขากลับต้องมีมิติคาน ระยะเข้าเนื้อคาน มิติดัด หางกลับ และแกนปลอกหลังครบ');
      else {
        const slopeAngle=Math.atan(k),lowerOffset=(c+rt+nestInset)*normal,returnY=x=>h-k*x-lowerOffset;
        const junctionX=back+details.detailSupportTail+mainR*Math.tan(slopeAngle/2),junctionY=returnY(junctionX);
        const noseStraight=returnY(noseX)-mainR*Math.tan((Math.PI/2-slopeAngle)/2)-(yMain+mainR);
        referenceReturn={noseXMm:noseX,normalCoverCenterMm:c+rt+nestInset,lowerLineInterceptMm:h-lowerOffset,lowerSlope:k,junctionXMm:junctionX,lowerTailYMm:junctionY,noseStraightMm:noseStraight,returnTailMm:details.detailSupportTail,bendCenterRadiusMm:mainR};
        if(junctionX>=0)fail('REFERENCE_RETURN','หางกลับ/รัศมีดัดไม่พออยู่ภายในคานรองรับ');
        if(noseStraight<details.detailNoseTail-1e-7)fail('REFERENCE_STRAIGHT','ขาลงที่ปลายสั้นกว่าช่วงตรงขั้นต่ำที่กรอก');
        try{mainBars=mainBars.map(bar=>({...bar,supportReturn:true,noseHook:true,points:fillet([point(back,yMain,bar.points[0][2]),point(noseX,yMain,bar.points[0][2]),point(noseX,returnY(noseX),bar.points[0][2]),point(junctionX,junctionY,bar.points[0][2]),point(back,junctionY,bar.points[0][2])],mainR)}));}
        catch(error){fail('REFERENCE_BEND',error.message);}
        // One transverse detailing candidate from Owner's picture. Its diameter
        // follows As; it is never a new selected As/Ah area or anchorage credit.
        const ra=rm,anchorX=noseX-rm-ra,anchorY=yMain+mainR+rm+ra,anchorZ=extent+rm;
        if(anchorY>=returnY(noseX)-mainR*Math.tan((Math.PI/2-slopeAngle)/2))fail('ANCHOR_FIT','ตำแหน่ง Anchor ไม่อยู่ในช่วงตรงขาลง');
        anchors.push({id:'ANCHOR-1',role:'Anchor',diameterMm:main.diameterMm,radiusMm:ra,points:[point(anchorX,anchorY,-anchorZ),point(anchorX,anchorY,anchorZ)],closed:false,diameterSource:'As-selected',countSource:'owner-reference-single-transverse',includedInAsAh:false,connectionVerified:false});
        pending('ANCHOR_CONNECTION','Anchor bar อ้างขนาด Aₛ · รูปแบบอ้างอิงหนึ่งเส้น · รอยต่อ/รอยเชื่อมและกำลังยึดปลายยังไม่ตรวจ');
        for(const bar of [...mainBars,...anchors])for(const [x,y,z] of bar.points){const r=bar.radiusMm;if(Math.abs(z)+r>b/2-c+1e-7||x-r<-details.detailSupportWidth+c-1e-7||x+r>L-c+1e-7||y-r<c-1e-7||(x>=0?(h-k*x-y)/normal<c+r-1e-7:y+r>details.detailSupportDepth-c+1e-7))fail('REFERENCE_COVER',`${bar.id}: เหล็ก/โค้งออกนอกระยะหุ้มจริง`);}
      }
    }
    // Independently entered display details. These groups never select steel or
    // contribute to the Engine's As/Ah/checks, including at the support joint.
    const verticalLedger={};
    const inside=(p,loop)=>{let hit=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a[2]>p[2])!==(b[2]>p[2])&&p[1]<(b[1]-a[1])*(p[2]-a[2])/(b[2]-a[2])+a[1])hit=!hit;}return hit;};
    function verticalGroup(group){
      const prefix=group==='corbel'?'verticalCorbel':'verticalSupport',enabled=verticalInput[prefix+'Enabled']===true,isSupport=group==='support';
      if(!enabled)return [];
      const diameter=n(verticalInput[prefix+'Diameter']),spacing=n(verticalInput[prefix+'Pitch']),bend=n(verticalInput[prefix+'Bend']),cover=n(verticalInput[prefix+'Cover']),start=n(verticalInput[prefix+'Start']);
      const code=isSupport?'SUPPORT_VT':'CORBEL_VT',label=isSupport?'ปลอกคานรองรับ':'ปลอกแนวตั้งหูช้าง';
      pending(code+'_REVIEW',label+' · รายละเอียดตัวอย่างแยกจาก As/Ah · ยังไม่ตรวจออกแบบ/ขา/จุดต่อ/มาตรฐานดัด');
      if([diameter,spacing,bend,cover,start].some(v=>v===null)||isSupport&&!supportKnown){pending(code+'_UNKNOWN',label+': ต้องระบุขนาด ระยะ มิติดัด ระยะหุ้ม ตำแหน่งเริ่ม และมิติคานให้ครบ');return [];}
      if(![diameter,spacing,bend,cover,start].every(v=>Number.isFinite(v)&&v>0&&v<=10000)||diameter>40||spacing<diameter){fail(code+'_VALUE',label+': มิติไม่ถูกต้องหรือปลอกซ้อนกัน');return [];}
      // Support hoops cover only the displayed b-wide node zone, not the whole beam.
      const radius=diameter/2,R=(bend+diameter)/2,span=isSupport?b:L;
      const minX=isSupport?-span/2+start:start,maxX=isSupport?span/2-cover-radius:L-cover-radius;
      const z=b/2-Math.max(cover,c+tie.diameterMm)-radius,yTop=cover+radius;
      if(start<cover+radius||maxX<minX||z<=R){fail(code+'_FIT',label+': พื้นที่ไม่พอสำหรับ cover/รัศมีดัด/ตำแหน่งเริ่ม');return [];}
      const count=Math.floor((maxX-minX)/spacing)+1;
      if(count>64){fail(code+'_COUNT',label+': เกิน64วง กรุณาตรวจช่วงและระยะจริง');return [];}
      const first=minX;
      const loops=Array.from({length:count},(_,i)=>{
        const position=first+i*spacing,x=isSupport?null:position,yBottom=isSupport?details.detailSupportDepth-cover-radius:h-k*x-(cover+radius)*normal;
        if(yBottom-yTop<=2*R)fail(code+'_BEND',label+': ช่วงตรงไม่พอสำหรับรัศมีดัด');
        const xBack=isSupport?-details.detailSupportWidth+cover+radius:null,xFront=isSupport?-cover-radius:null;
        if(isSupport&&xFront-xBack<=2*R)fail(code+'_BEND',label+': ความกว้างคานไม่พอสำหรับรัศมีดัด');
        const points=isSupport?roundedLoop(xBack,xFront,yTop,yBottom,position,R,true).map(p=>[p[0],p[2],p[1]]):roundedLoop(yTop,yBottom,-z,z,0,R,true).map(p=>[x,p[0],p[2]]);
        const bar={id:(isSupport?'VTS-':'VTC-')+(i+1),role:isSupport?'SupportVertical':'CorbelVertical',diameterMm:diameter,radiusMm:radius,points,closed:true,orientation:isSupport?'xy':'yz',centerXMm:x,centerZMm:isSupport?position:null,backXMm:xBack,frontXMm:xFront,topYMm:yTop,bottomYMm:yBottom,sideZMm:isSupport?null:z,bendCenterRadiusMm:R,spacingMm:spacing,coverMm:cover,diameterSource:'manual-demo',countSource:'explicit-pitch-and-envelope',includedInAsAh:false,creditedInDesign:false,closureVerified:false,standardVerified:false};
        for(const p of points)if(Math.abs(p[2])+radius>b/2-cover+1e-7||p[1]-radius<cover-1e-7||(isSupport?p[1]+radius>details.detailSupportDepth-cover+1e-7||p[0]-radius<-details.detailSupportWidth+cover-1e-7||p[0]+radius>-cover+1e-7:(h-k*p[0]-p[1])/normal<cover+radius-1e-7))fail(code+'_COVER',bar.id+': ออกนอกระยะหุ้มจริง');
        if(!isSupport)for(const native of mainBars)for(let j=1;j<native.points.length;j++){const a=native.points[j-1],b=native.points[j],dx=b[0]-a[0];if(Math.abs(dx)>1e-9&&x>=Math.min(a[0],b[0])&&x<=Math.max(a[0],b[0])){const t=(x-a[0])/dx,p=a.map((v,k)=>v+t*(b[k]-v));if(!inside(p,points))fail(code+'_ENCLOSURE',bar.id+': วงปลอกไม่รัดรอบเหล็กหลักที่ผ่านรูปตัด');}}
        return bar;
      });
      verticalLedger[group]={enabled:true,count,diameterMm:diameter,spacingMm:spacing,bendInsideMm:bend,coverMm:cover,startMm:start,orientation:isSupport?'xy':'yz',distributionAxis:isSupport?'z':'x',zoneLengthMm:span,actualSideCoverMm:isSupport?cover:b/2-z-radius,centersMm:loops.map(t=>isSupport?t.centerZMm:t.centerXMm),label:'RB'+diameter+' @'+spacing+' · '+count+' วง · ตัวอย่างรอตรวจ',creditedInDesign:false};
      return loops;
    }
    const verticalTies=verticalGroup('corbel'),supportTies=verticalGroup('support'),manual=[...verticalTies,...supportTies];
    for(let i=0;i<manual.length;i++)for(const other of [...mainBars,...ties,...anchors,...manual.slice(i+1)])if(clash(manual[i],other,1e-7))fail('VERTICAL_CLASH',manual[i].id+' ชน '+other.id+': ต้องแก้มิติปลอกแนวตั้งจริง');
    for(const bar of mainBars)for(const loop of ties)if(clash(bar,loop))fail('BAR_CLASH',`${bar.id} ชน ${loop.id}: ต้องตรวจตำแหน่งงอ/ชั้นปลอกจริง`);
    for(const anchor of anchors)for(const bar of [...mainBars,...ties])if(clash(anchor,bar))fail('ANCHOR_CLASH',`${anchor.id} ชน ${bar.id}: ต้องตรวจมิติ Anchor จริง`);
    if(tiePitch<tie.diameterMm)fail('TIE_LAYER_CLASH','ชั้น Aₕ ซ้อนกันตามมิติจริง');
    const ledger={mainLabel:main.label,tieLabel:tie.label,mainCount:main.count,tieCount:tie.count,mainAreaMm2:main.providedMm2,tieAreaMm2:tie.providedMm2,
      mainCenterFromTopMm:yMain,mainPitchMm:main.count>1?pitch:null,mainClearSpacingMm:clear,mainTopClearMm:yMain-rm,sideClearMm:c,tiePitchMm:tiePitch,tieBandMm:tieBand,
      tieLayersMm:ties.map(t=>t.centerYMm),mainSideClearMm:b/2-extent-rm,mainNoseClearMm:L-noseX-rm,mainTangentInsetMm:nestInset,mainAdditionalVerticalInsetMm:verticalInset,layout:verticalInset?'nested-inside-ah-and-vertical':nested?'nested-inside-ah':'legacy-seven-field',engineAvailableClearMm:main.clearSpacingMm,
      supportHook:reference?false:supportFits,noseHook:reference?!!referenceReturn:noseFits,supportReturn:!!referenceReturn,referenceReturn,anchorCount:anchors.length,anchorDiameterMm:anchors[0]?.diameterMm??null,anchorLabel:anchors.length?`1-DB${main.diameterMm} Anchor (อ้าง Aₛ · ยังไม่ตรวจรอยต่อ)`:'ยังไม่ระบุ',tieShapesClosed:ties.every(t=>t.closed),vertical:verticalLedger};
    return freeze({...base,main:errors.length?[]:mainBars,ties:errors.length?[]:ties,anchors:errors.length?[]:anchors,verticalTies:errors.length?[]:verticalTies,supportTies:errors.length?[]:supportTies,ledger,renderable:errors.length===0,status:errors.length||issues.some(i=>i.code.includes('CLASH'))?'DETAIL HOLD':rejected?'CHECKED / REJECTED':issues.some(i=>i.code.includes('UNKNOWN'))?'DETAIL INCOMPLETE':'GEOMETRY CANDIDATE'});
  }
  function section(s,suffix) {
    const model=build(s,{allowRejected:true});
    return root.CorbelCadDrawing?.render(s,model,suffix)||'<p role="alert">กำลังโหลดชุดเขียนแบบ กรุณาคำนวณใหม่เมื่อโหลดครบ</p>';
  }
  root.CorbelRebarDetail=Object.freeze({VERSION,PATTERNS,FIELD_IDS:Object.freeze(FIELD_IDS),TRIAL_DETAILS,VERTICAL_FIELDS,VERTICAL_TRIAL,build,section});
})(typeof window==='undefined'?globalThis:window);
