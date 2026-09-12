// Candidate orchestration, not a design equation or an approval authority.
const finite=Number.isFinite;
const strengthOK=q=>finite(q?.ratio)&&q.ratio<=1+1e-9&&['ok','warn','review'].includes(q.state);
const required=['plate','weld','hardware-fit','geometry','solver'];
const edges=[['edgeLeftMM','xmin',1],['edgeRightMM','xmax',-1],['edgeBottomMM','ymin',1],['edgeTopMM','ymax',-1]];

export function preserveConcreteBounds(reference,d,layout){
  if(d.support.type==='hbeam')return;
  const a=layout(reference),b=layout(d);
  for(const [key,axis,sign] of edges)d.connection[key]=reference.connection[key]+sign*(b[axis]-a[axis]);
}
export function concreteCandidateOK(r,baseline){
  if(r.errors?.length||!r.memberReady)return false;
  const rows=r.connections?.checks||[],before=baseline.connections?.checks||[];
  if(!required.every(id=>rows.some(q=>q.id===id&&strengthOK(q))))return false;
  // Every available check must remain within limits. A pre-existing missing
  // product input may remain missing; a newly missing result is never accepted.
  if(rows.some(q=>!strengthOK(q)&&!(q.state==='incomplete'&&before.some(p=>p.id===q.id&&p.state==='incomplete'))&&q.id!=='truss-joints'))return false;
  const joint=rows.find(q=>q.id==='truss-joints'),oldJoint=before.find(q=>q.id==='truss-joints');
  if(joint&&!strengthOK(joint)&&(!oldJoint||joint.state!==oldJoint.state||!finite(joint.ratio)||joint.ratio>oldJoint.ratio+1e-9))return false;
  return before.every(q=>rows.some(p=>p.id===q.id&&(!strengthOK(q)||strengthOK(p))));
}
export async function selectConcreteConnection(d,{reference,A,C,records,layout,weldGeometry,evaluate}){
  const saved=A.clone(d),initial=C.calculate(d);
  if(concreteCandidateOK(initial,initial))return {input:d,result:initial};
  const c=saved.connection,fp=layout(saved),diameter=saved.plate.anchorMM;
  const thicknesses=[saved.plate.thicknessMM,...[...new Set(records.filter(x=>x.mode==='plate_dimensions').map(x=>x.specs?.thicknessMm))].filter(t=>finite(t)&&t>=3&&t<=40&&t!==saved.plate.thicknessMM).sort((a,b)=>a-b)];
  const sizes=[c.weldSizeMM,...[3,4,5,6,8,10,12,16].filter(w=>w!==c.weldSizeMM)];
  const counts=[[c.anchorRows,c.anchorCols]];
  // Same entered product, diameter and embedment. No product capacity is scaled
  // by count here: the original group engine checks every new arrangement.
  if(saved.truss.enabled){for(const cols of [2,4,6,8])if(cols>c.anchorCols)counts.push([c.anchorRows,cols]);}
  else for(const pair of [[2,2],[2,4],[4,2],[2,6],[6,2]])if(pair[0]*pair[1]>c.anchorRows*c.anchorCols)counts.push(pair);
  const geometries=[null],radius=Math.max(18,1.25*diameter),edge=Math.ceil(Math.max(c.anchorEdgeXMM,c.anchorEdgeYMM,1.5*diameter,radius)/5)*5;
  const pitch=finite(c.product.minSpacing)&&c.product.minSpacing>0?c.product.minSpacing:0;
  for(const [rows,cols] of counts){
    const w=Math.max(fp.width,saved.steel.B+2*(radius+16)+2*edge,2*edge+(cols-1)*pitch);
    const h=saved.truss.enabled?fp.height:Math.max(fp.height,saved.steel.H+2*(radius+16)+2*edge,2*edge+(rows-1)*pitch);
    for(const extra of [0,25,50,100])geometries.push({rows,cols,width:Math.ceil((w+extra)/5)*5,height:Math.ceil((h+(saved.truss.enabled?0:extra))/5)*5,edge});
  }
  for(const geometry of geometries){
    const candidate=A.clone(saved),cc=candidate.connection;
    if(geometry)Object.assign(cc,{plateAuto:false,plateWidthMM:geometry.width,plateHeightMM:geometry.height,anchorRows:geometry.rows,anchorCols:geometry.cols,anchorEdgeXMM:geometry.edge,anchorEdgeYMM:saved.truss.enabled?c.anchorEdgeYMM:geometry.edge});
    preserveConcreteBounds(reference,candidate,layout);
    if(C.validate(candidate).length)continue;
    for(const t of thicknesses){candidate.plate.thicknessMM=t;const weld=weldGeometry(candidate);if(!weld.intervalFeasible)continue;
      for(const w of sizes){if(w<weld.minSize||w>weld.maxSize)continue;cc.weldSizeMM=w;
        const result=await evaluate(candidate,'เพลท / รอยเชื่อม / พุก · ตรวจขนาด ระยะ และแรงกลุ่มพุก');
        if(concreteCandidateOK(result,initial))return {input:candidate,result};
      }
    }
  }
  return {input:saved,result:initial};
}

export function componentSummary(checks){
  const bad=checks.filter(q=>!q.pass),failed=bad.filter(q=>q.state==='fail'||q.state==='outside'),missing=bad.filter(q=>q.state==='incomplete'),review=bad.filter(q=>q.state==='review');
  const q=failed[0]||missing[0]||review[0]||bad[0];
  const labels=[failed.length?'× ไม่ผ่าน '+failed.length+' รายการ':'',missing.length?'ข้อมูลไม่ครบ '+missing.length+' รายการ':'',review.length?'รอตรวจวิธี '+review.length+' รายการ':''].filter(Boolean);
  const paths={'hardware-fit':'connection.plateWidthMM','support-fit':'support.beamHMM',plate:'plate.thicknessMM',weld:'connection.weldSizeMM','support-weld':'connection.supportWeldSizeMM',geometry:'connection.anchorEdgeXMM','truss-joints':'connection.node.type','design-basis':'design.profile'};
  const missingReasons={productInteraction:'ยังไม่มีค่ากำลังดึงและเฉือนจากเอกสารพุกรุ่นที่ใช้',bond:'ยังไม่มีค่ากำลังยึดเหนี่ยวหรือกำลังถอนจากเอกสารพุกรุ่นที่ใช้',productGate:'ข้อมูลรุ่น เอกสารกำลัง หรือเงื่อนไขติดตั้งพุกยังไม่ครบ'};
  const reason=q?.state==='review'?`${q.label}: ${finite(q.ratio)?'D/C '+q.ratio.toFixed(3)+' อยู่ในเกณฑ์ตัวเลข แต่':'ผลยังไม่ครบและ'}ยังรอตรวจวิธีและรายละเอียดจุดต่อ`:q?`${q.label}: ${q.state==='incomplete'&&missingReasons[q.id]||q.note||'เปิดรายละเอียดเพื่อตรวจรายการนี้'}`:'';
  return {pass:!bad.length,label:labels.join(' · ')||(!bad.length?'✓ ผ่าน':'ยังสรุปไม่ได้'),tone:failed.length?'sm-fail':bad.length?'sm-pending':'sm-ok',reason,path:q?(paths[q.id]||'connection.product.name'):null};
}
