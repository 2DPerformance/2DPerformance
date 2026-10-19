/** Static resolution of accepted Engine forces. No capacity or solver here. */
import {rearPileCaps} from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import {assessRearDowel} from './rearDowelAssessment.mjs?rwv=20261003-dowel-assessment-1';

export function buildRearAnchorActions(result,lateralFactor,identity) {
  if(result.SS!=='stay'||!result.stay?.layout)return null;
  const {stay}=result,layout=stay.layout;
  if(!Number.isFinite(lateralFactor)||lateralFactor<=0||!Number.isFinite(stay.T)||!(layout.Lb>0))
    throw new TypeError('Rear anchor: finite accepted force, factor and geometry required');
  const members=layout.members.map(m=>{
    const axial=stay.T*m.length/layout.Lb;
    const rearLoad=m.direction.map(d=>-axial*d);
    return {frontIndex:m.frontIndex,anchorIndex:m.anchorIndex,length:m.length,axial,
      front:{...m.front},rear:{...m.rear},direction:[...m.direction],rearLoad,
      frontLoad:rearLoad.map(v=>-v),factoredAxial:axial*lateralFactor};
  });
  const caps=rearPileCaps(layout,result.i);
  const anchors=layout.anchors.map(a=>{
    const connected=members.filter(m=>m.anchorIndex===a.id);
    const load=[0,1,2].map(k=>connected.reduce((sum,m)=>sum+m.rearLoad[k],0));
    return {index:a.id,mark:'AP'+(a.id+1),stayCount:connected.length,
      head:{...a.head},tip:{...a.tip},size:[...caps[a.id].size],
      frontIndices:connected.map(m=>m.frontIndex),load,reaction:load.map(v=>-v),
      factoredLoad:load.map(v=>v*lateralFactor)};
  });
  const dw=stay.anchorPile?.dowel;
  const ap=stay.anchorPile;
  return {schema:'rw01-rear-anchor-actions/1',identity:String(identity),lateralFactor,
    axes:['+X เข้าดินถม','+Y ขึ้น','+Z ตามแนวกำแพง'],
    basis:'SERVICE · สมดุลยึดรั้งเดิม · แรงราบ Tpile ต่อเข็มใช้ช่วง S เต็ม รวมปลายแนว',
    assumption:'สเตย์รับแรงแกนและบรรจบที่หัวสมอเดียว; แรงบนแคปกับปฏิกิริยาเข็มมีทิศตรงข้าม ไม่ใช่ผลดัด/เฉือนของแคป',
    horizontalPerFront:stay.T,span:layout.Lb,drop:layout.drop,members,anchors,
    pileResistance:ap?{su:ap.shaftSuKPa,alpha:ap.shaftAlpha,stress:ap.shaftStressKPa,
      perimeter:ap.perim,length:ap.ancLe,shaft:ap.TskinT*9.80665,section:ap.TsecT*9.80665,
      capacity:ap.TcapKN,demand:ap.Tdemand,dc:ap.dcT,ok:ap.ok,
      projectOverride:Number(result.i.pileTen)>0,source:ap.govern,
      basis:Number(result.i.pileTen)>0?'PROJECT ALLOWABLE · กำลังถอนทั้งระบบตามกรอก':'PRELIMINARY ESTIMATE · α-method และกำลังดึง catalogue โดยประมาณ'}:null,
    dowel:dw?{spec:dw.spec,mode:dw.mode,db:dw.db,count:dw.nBar,autoCount:dw.nAuto,
      manualCount:dw.nMan,Tu:dw.Tu,AsRequired:dw.AsReq,AsMinimum:dw.AsMin,
      method:dw.method,basis:dw.basis,serviceT:dw.serviceT,designT:dw.designT,stressLimitMPa:dw.stressLimitMPa,
      grossAreaMM2:dw.grossAreaMM2,barAreaMM2:dw.barAreaMM2,minimumBarAreaMM2:dw.minimumBarAreaMM2,
      AsNeeded:dw.AsNeed,AsProvided:dw.AsProv,steelOK:dw.ok,
      capLengthAssumption:dw.ldCap,pileLengthAssumption:dw.ldPile,
      assessment:assessRearDowel(result,caps)}:null,
    missingCapacity:['ดัด/เฉือน/strut-and-tie ของแคป','แรงยึดเหนี่ยว/ระยะฝัง/สมอปลาย APd','แรงราบ/ดัด/ปฏิสัมพันธ์ของเข็มสมอ'],
    capacityVerified:false,constructionApproved:false};
}
