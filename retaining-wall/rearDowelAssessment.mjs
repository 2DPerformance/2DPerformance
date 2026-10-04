/** Geometry/report projection only. Never supplies bond or connection capacity. */
export function assessRearDowel(result,caps) {
  const dw=result.stay?.anchorPile?.dowel;
  if(!dw)return null;
  const pc=dw.mode==='pcwire';
  const cover=Math.max(Number(result.i.cov??50)/1000,.05);
  if(!Number.isFinite(cover))throw new TypeError('Rear dowel: finite cover required');
  const envelopes=pc?[]:caps.map(cap=>{
    const head=result.stay.layout.anchors.find(a=>a.id===cap.anchorIndex).head;
    const top=cap.position[1]+cap.size[1]/2;
    const available=Math.max(0,top-head.y-cover);
    const assumed=dw.ldCap;
    const fits=available+1e-9>=assumed;
    return {anchorIndex:cap.anchorIndex,height:cap.size[1],headLevel:head.y,topLevel:top,
      cover,available,assumed,shortfall:fits?0:Math.max(0,assumed-available),
      fitsAssumedStraightEnvelope:fits,
      centeredEnvelopeHeight:2*(assumed+cover)};
  });
  return {schema:'rw01-rear-dowel-assessment/1',mode:dw.mode,
    steelScreenOK:pc?dw.pc.strOK:dw.dbOK,
    wire:pc?{count:dw.pc.nW,diameter:dw.pc.dia,area:dw.pc.Aps,
      stress:dw.pc.fpc,phi:dw.pc.phi,demand:dw.Tu,capacity:dw.pc.Tcap}:null,
    envelopeBasis:'หัวเข็มอยู่กึ่งกลางความหนาแคปตามโมเดล; ระยะด้านบนหัก cover เท่านั้น ไม่ใช่แบบรายละเอียดเหล็ก',
    envelopes,developmentVerified:false,connectionVerified:false,
    requiredEvidence:pc?['สมอปลายและกำลังรับแรงที่รับรอง','รายละเอียดถ่ายแรงจากลวดเข้าสู่แคป']
      :['วิธีติดตั้งและระดับรอยต่อจริง','ระยะพัฒนาและรายละเอียดเหล็กตามโปรไฟล์','ข้อมูลระบบยึดที่ผ่านการประเมินสำหรับเหล็กเจาะเสียบ']};
}
