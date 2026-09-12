/* R34 input load provenance and unfactored transfer projection. No solver or verdict. */
(function(root){
  'use strict';
  const VERSION='r34.1', GRAVITY=9.80665/1000;
  const roofSource='https://www.lysaghtasean.com/th/wp-content/uploads/sites/4/2019/04/LAYOUT_TRIMDEK_16-09-2016.pdf';
  const ceilingSource='https://www.shera.com/stocks/download/d240x300/lt/ha/rf78lthawj2/09-_Board.pdf';
  const catalogue=Object.freeze([
    ...[[0.35,3.68],[0.42,4.36],[0.48,4.95]].map(([t,mass])=>Object.freeze({id:'trimdek-'+t,group:'roof',label:`เมทัลชีท TRIMDEK COLORBOND ${t} mm BMT`,mass,source:roofSource,basis:'LYSAGHT ประเทศไทย หน้า 2; น้ำหนักต่อพื้นที่มุง ไม่รวมอุปกรณ์'})),
    ...[[4,6.12],[6,9.32]].map(([t,mass])=>Object.freeze({id:'shera-'+t,group:'ceiling',label:`ฝ้าไฟเบอร์ซีเมนต์ SHERA ${t} mm`,mass,source:ceilingSource,basis:'SHERA Board หน้า 4 (แค็ตตาล็อกอินเดีย); ค่าอ้างอิงแผ่น ไม่รวมโครงฝ้า'}))
  ]);
  const fresh=()=>({mode:'manual',roof:'none',ceiling:'none',extraKPa:0,reference:'',catalogue:VERSION});
  const finite=x=>typeof x==='number'&&Number.isFinite(x);
  function selected(d){return catalogue.filter(row=>row.id===d.deadLoad.roof||row.id===d.deadLoad.ceiling);}
  function total(d){return d.deadLoad.mode==='manual'?d.loads.deadKPa:selected(d).reduce((sum,row)=>sum+row.mass*GRAVITY,0)+d.deadLoad.extraKPa;}
  function sync(d){if(d.deadLoad.mode==='materials')d.loads.deadKPa=finite(d.deadLoad.extraKPa)?total(d):'';}
  function validate(d){
    const m=d.deadLoad,e=[],add=(path,message)=>e.push({path,message});
    if(!m||!['manual','materials'].includes(m.mode))return [{path:'deadLoad.mode',message:'เลือกวิธีกำหนด DL'}];
    if(m.catalogue!==VERSION)add('deadLoad.catalogue','รุ่นข้อมูลวัสดุไม่ตรง กรุณาใช้ค่า DL แบบกรอกเองหรือเลือกรายการใหม่');
    for(const key of ['roof','ceiling'])if(m[key]!=='none'&&!catalogue.some(r=>r.group===key&&r.id===m[key]))add('deadLoad.'+key,'ไม่พบวัสดุที่เลือกในรายการอ้างอิง');
    if(m.mode==='materials'){
      if(!finite(m.extraKPa)||m.extraKPa<0||m.extraKPa>20)add('deadLoad.extraKPa','กรอก DL อื่นเพิ่มระหว่าง 0–20 kN/m²');
      if(!selected(d).length&&!(m.extraKPa>0))add('deadLoad.roof','เลือกวัสดุ DL หรือเปลี่ยนเป็นกรอกเอง');
      if(!finite(d.loads.deadKPa)||Math.abs(total(d)-d.loads.deadKPa)>1e-10)add('loads.deadKPa','ยอด DL ไม่ตรงกับรายการวัสดุที่เลือก');
    }
    return e;
  }
  function description(d){return d.deadLoad.mode==='manual'?'DL กรอกเอง'+(d.deadLoad.reference?' · '+d.deadLoad.reference:''):
    selected(d).map(r=>`${r.label} ${r.mass} kg/m²`).join(' + ')+` + อื่น ${d.deadLoad.extraKPa} kN/m²`+(d.deadLoad.reference?' · '+d.deadLoad.reference:'');}
  function project(d,{purlin=1,frame=1}={}){
    const A=root.NCYSC01MemberAnalysis,E=root.NCYEngine,P=root.NCYSC01Purlins;
    const errors=A.validate(d,{geometryOnly:true}).filter(e=>!e.path.startsWith('plate.')).concat(validate(d));
    for(const key of ['deadKPa','liveKPa'])if(!finite(d.loads[key])||d.loads[key]<0||d.loads[key]>20)errors.push({path:'loads.'+key,message:'กรอก DL / LL ระหว่าง 0–20 kN/m²'});
    if(errors.length)throw Error(errors[0].message);
    const {s,grid:g,purlinDL}=A.nativeState(d),pg=P.layout(s);
    const ownP=E.rhsProps({...s.member,H:d.purlin.H,B:d.purlin.B,tNom:d.purlin.t,designThicknessFactor:1}).weightKNm;
    const ownM=d.truss?.enabled?root.NCYSC01MemberTruss.geometry(d).totalWeightKN/d.geometry.projectionM:E.rhsProps({...s.member,designThicknessFactor:1}).weightKNm;
    const pi=Math.min(pg.count-1,Math.max(0,Math.round(purlin))),fi=Math.min(g.frames-1,Math.max(0,Math.round(frame)));
    const frames=Array.from({length:g.frames},(_,i)=>({id:'B'+String(i+1).padStart(2,'0'),index:i,xM:i*g.frameSpacingM,tributaryM:g.frameSpacingM*(i===0||i===g.frames-1?.5:1)}));
    const lines=pg.lines.map((p,index)=>({...p,index,D:d.loads.deadKPa*p.stripM+ownP,L:d.loads.liveKPa*p.stripM}));
    const f=frames[fi],line=lines[pi],reactions=lines.map(p=>({id:p.id,zM:p.zM,D:p.D*f.tributaryM,L:p.L*f.tributaryM}));
    return {grid:g,purlinGrid:pg,frames,lines,purlin:line,frame:f,reactions,externalD:d.loads.deadKPa,externalL:d.loads.liveKPa,
      purlinSelfWeightKNm:ownP,mainSelfWeightKNm:ownM,purlinDL,
      mainD:(d.loads.deadKPa+purlinDL)*f.tributaryM+ownM,mainL:d.loads.liveKPa*f.tributaryM,
      lengthM:d.geometry.projectionM,widthM:d.geometry.widthM,support:d.support.type,cable:d.cable.enabled?{heightM:d.cable.heightM}:null,
      constructionAuthorized:false,basis:'unfactored-inputs',solverModel:d.truss?.enabled?'pin-joint-truss-with-local-bending':'discrete-purlin-reactions'};
  }
  root.NCYSC01MemberLoads=Object.freeze({VERSION,GRAVITY,catalogue,fresh,selected,total,sync,validate,description,project});
})(typeof window==='undefined'?globalThis:window);
