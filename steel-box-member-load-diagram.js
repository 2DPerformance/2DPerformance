/* R34 SVG views use the same input load projection, without creating a 3D viewer. */
(function(root){
  'use strict';
  const n=(x,d=3)=>Number(x.toFixed(d)).toLocaleString('en-US',{maximumFractionDigits:d});
  const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(x,y,t,anchor='start',cls='')=>`<text x="${x}" y="${y}" text-anchor="${anchor}" class="${cls}">${esc(t)}</text>`;
  const arrow=(x,y1,y2,kind,extra='')=>`<path data-load="${kind}" ${extra} class="sm-load-${kind}" d="M${x} ${y1}V${y2}m-4 -7l4 7 4 -7"/>`;
  function udl(y,kind,label){return `<g class="sm-udl" data-distribution="full-length" data-kind="${kind}"><path class="sm-load-${kind}" d="M64 ${y}H656"/>${Array.from({length:17},(_,i)=>arrow(64+i*37,y,y+30,kind)).join('')}${text(360,y-12,label,'middle','sm-svg-'+kind)}</g>`;}
  const beam=y=>`<path class="sm-svg-member" d="M64 ${y}H656"/>`;
  const dimension=(y,label)=>`<path class="sm-svg-dim" d="M64 ${y-5}v10m0 -5h592m0 -5v10"/>${text(360,y+23,label,'middle')}`;
  const svg=(title,body,height,compact=false)=>`<svg class="${compact?'sm-compact-diagram':''}" viewBox="0 0 720 ${height}" role="img" aria-label="${esc(title)}"><title>${esc(title)}</title>${body}</svg>`;
  function purlin(p,compact){
    const selected=p.purlin,by=compact?194:162,labelY=compact?242:197;
    const supports=p.frames.map(f=>{const x=64+f.xM/p.widthM*592;return `<path data-support="${f.id}" data-position-m="${f.xM}" class="sm-svg-support" d="M${x} ${by+3}l-7 12h14z"/>`+(f.index===0||f.index===p.grid.frames-1||!compact&&f.index===p.frame.index?text(x,labelY,f.id,'middle'): '');}).join('');
    const x2=64+592/p.grid.bays;
    return `<h3>${esc(selected.id)} · ${selected.index===0||selected.index===p.lines.length-1?'แปริม':'แปกลาง'} · รับพื้นที่กว้าง ${n(selected.stripM)} m</h3>
      ${svg('DL และ LL กระจายตลอดความยาวแนวแป',udl(48,'L',compact?`LL = ${n(selected.L)} kN/m`:`LL = ${n(p.externalL)} × ${n(selected.stripM)} = ${n(selected.L)} kN/m`)+udl(compact?139:115,'D',`DL รวมแป = ${n(selected.D)} kN/m`)+beam(by)+supports+(compact?'':`<path class="sm-svg-dim" d="M64 213H${x2}"/>`+text(64,236,`ช่วงแป ${n(p.grid.frameSpacingM)} m ระหว่างคาน`))+dimension(compact?282:254,`กว้างรวมตามผนัง ${n(p.widthM)} m`),compact?340:293,compact)}
      <p class="sm-note">คานรองรับ ${p.frames.length} แนว · แป ${p.grid.bays} ช่วง × ${n(p.grid.frameSpacingM)} m · ระยะ @ แป ${n(p.grid.purlinSpacingM)} m</p>
      <p class="sm-note">LL ${n(p.externalL)} kN/m² × แถบรับแรง ${n(selected.stripM)} m = ${n(selected.L)} kN/m</p>
      <p class="sm-note">แต่ละช่องแปคิดรองรับสองปลาย · R ต่อปลาย = w × ${n(p.grid.frameSpacingM)} / 2</p>
      <div class="sm-load-equation">ที่ปลายแปหนึ่งช่วง: DL ${n(selected.D*p.grid.frameSpacingM/2)} kN · LL ${n(selected.L*p.grid.frameSpacingM/2)} kN</div>`;
  }
  function main(p,compact){
    const selected=p.frame,edge=selected.index===0||selected.index===p.frames.length-1,y=compact?{L:140,D:260,beam:330,dim:390,h:455}:{L:110,D:210,beam:275,dim:330,h:385};
    const arrows=kind=>p.reactions.map((r,i)=>{const x=64+r.zM/p.lengthM*592;return arrow(x,y[kind]-55,y[kind],kind,`data-purlin="${r.id}"`)+(p.reactions.length<7?text(x,y[kind]+(kind==='L'?30:24),`${r.id}: ${n(r[kind])}`, 'middle'):(i===0||i===p.reactions.length-1?text(x,y[kind]+28,r.id,'middle'):''));}).join('');
    const cable=p.cable?`<path class="sm-svg-cable" d="M64 45L656 ${y.beam}"/>${text(75,35,`สลิง h ${n(p.cable.heightM)} m`)}`:'';
    const fixed=`<path data-fixed-support="${selected.id}" class="sm-svg-fixed" d="M62 ${y.beam-22}v44${Array.from({length:5},(_,i)=>`M62 ${y.beam-22+i*11}l-11 9`).join('')}"/>`+text(64,y.beam+41,'ฐานยึดแน่น');
    return `<h3>${esc(selected.id)} · คาน${edge?'ริม':'กลาง'} · รับหน้ากว้าง ${n(selected.tributaryM)} m</h3>`+
      svg('ปฏิกิริยาแปที่ตำแหน่งจริงบนคาน',text(64,y.L-70,'LL จากแป (kN)')+arrows('L')+text(64,y.D-70,'DL จากแป (kN)')+arrows('D')+cable+beam(y.beam)+fixed+dimension(y.dim,`คานยื่นจากฐาน ${n(p.lengthM)} m`),y.h,compact)+
      `<p class="sm-note">${edge?'รับปฏิกิริยาจากแปฝั่งเดียว':'รับปฏิกิริยาจากแปสองฝั่ง'} · ใช้แรงจุด ณ ตำแหน่งแปจริง และน้ำหนักตัวเหล็ก ${n(p.mainSelfWeightKNm)} kN/m${p.solverModel==='pin-joint-truss-with-local-bending'?' (เฉลี่ยเพื่อแสดง; คำนวณแยกเหล็กทุกชิ้น)':''}</p><details class="sm-details"><summary>แรงถ่ายจากแปแต่ละแนว</summary><table><thead><tr><th>แป / ระยะจากฐาน</th><th>DL (kN)</th><th>LL (kN)</th></tr></thead><tbody>${p.reactions.map(r=>`<tr><td>${r.id} / ${n(r.zM)} m</td><td>${n(r.D)}</td><td>${n(r.L)}</td></tr>`).join('')}</tbody></table></details>`;
  }
  function render(p,stage='purlin',compact=false,input=null){
    const units=root.NCYSC01MemberConnections?.units;
    if(input&&units){const cv=(v,u='kN')=>units.toDisplay(v,u,input);p={...p,externalL:cv(p.externalL,'kN/m²'),mainSelfWeightKNm:cv(p.mainSelfWeightKNm,'kN/m'),purlin:{...p.purlin,D:cv(p.purlin.D,'kN/m'),L:cv(p.purlin.L,'kN/m')},reactions:p.reactions.map(q=>({...q,D:cv(q.D),L:cv(q.L)}))};}
    const html=`<p class="sm-load-basis">ภาพโหลด DL / LL จากข้อมูลปัจจุบัน ก่อนคูณตัวประกอบแรง</p>${stage==='main'?main(p,compact):purlin(p,compact)}`;
    return input&&units?html.replace(/kN/g,units.label('kN',input)):html;
  }
  root.NCYSC01MemberLoadDiagram=Object.freeze({render});
})(typeof window==='undefined'?globalThis:window);
