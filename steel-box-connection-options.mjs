// A connection proposal is not a completed design. Every candidate is solved
// using C.calculate; source data and all physical site constraints stay explicit.
import {preserveConcreteBounds} from './steel-box-member-connection-selection.mjs?v=20260913-r47';
const finite=Number.isFinite,states=['ok','warn','review'];
const scalarOK=q=>finite(q?.ratio)&&q.ratio>=0&&q.ratio<=1+1e-9&&states.includes(q.state);
const strengthIds=['plate','weld','support-weld','anchorSteel','productInteraction','breakoutT','bond','breakoutV','pryout','bond-sustained','concreteInteraction'];
const requiredConcrete=['plate','weld','anchorSteel','productInteraction','breakoutT','bond','breakoutV','pryout','geometry','solver','productGate','hardware-fit','concreteInteraction'];
// Supplier's sheet/plate thickness table, retrieved 2026-09-13. Cut dimensions
// are proposed separately. This does not certify the entered Fy/Fu or stock.
export const plateStock=Object.freeze({source:'https://www.tekhengsteel.com/hot-rolled-steel-plate-and-sheet',date:'2026-09-13',thicknesses:Object.freeze([3,4,4.5,5,6,8,9,10,12,15,16,18,19,20,22,25,28,30,32,38])});
export const packageKey=(d,A)=>A.stable({plate:d.plate,connection:d.connection});
export function packageMetrics(r,d,{C}){
  const all=r.connections?.all||[],checks=r.connections?.checks||[],required=d.support.type==='hbeam'?['plate','weld','support-weld']:requiredConcrete;
  const every=all.flatMap(x=>x.checks||[]),bad=[...checks,...every].filter(q=>!scalarOK(q));
  const completeRows=all.length===r.cases?.length*(d.truss.enabled?2:1)&&all.length>0&&all.every(x=>required.every(id=>x.checks?.some(q=>q.id===id)))&&(!d.truss.enabled||['support-fit','truss-joints'].every(id=>checks.some(q=>q.id===id)));
  const numeric=!!r.memberReady&&!r.errors?.length&&!r.issues?.length&&completeRows&&required.every(id=>checks.some(q=>q.id===id))&&bad.length===0
    &&(d.support.type==='hbeam'||checks.some(q=>q.id==='bond-sustained'));
  const governing=checks.filter(q=>strengthIds.includes(q.id)&&finite(q.ratio)).sort((a,b)=>b.ratio-a.ratio)[0];
  const group=ids=>checks.filter(q=>ids.includes(q.id)).sort((a,b)=>(b.ratio||0)-(a.ratio||0))[0]||null;
  return {numeric,complete:numeric&&C.reportAllowed(r,d),dc:governing?.ratio??null,governing,
    plate:group(['plate']),weld:group(['weld','support-weld']),anchors:group(strengthIds.filter(id=>!['plate','weld','support-weld'].includes(id))),
    reviews:checks.filter(q=>q.state==='review'),bad,checks};
}
export function chemicalVariants(original,{A,P,connectionLayout}){
  if(original.support.type==='hbeam'||original.design.profile!=='aisc360-22_aci318-19')return [];
  const seed=A.clone(original),selected=seed.connection.productSelection;
  seed.connection.anchorLayout='outside-hss';
  // The existing settings describe the planned installation. Never search for
  // a cooler/drier/uncracked site or discard product-version mismatch as a fix.
  if(selected.id===P.ID&&selected.version!==P.VERSION)return [];
  selected.id=P.ID;selected.version=P.VERSION;
  const variants=[];
  for(const diameter of P.sizes)for(const grade of ['5.8','8.8']){
    const d=A.clone(seed);d.plate.anchorMM=diameter;d.connection.productSelection.grade=grade;
    const data=P.row(d);if(!data)continue;
    const p=data.product,clear=p.minMemberThickness-d.connection.anchorHefMM;
    const max=Math.min(p.hefMax,d.connection.concreteThicknessMM-clear),min=p.hefMin;
    const depths=[...new Set([min,Math.ceil(min/20)*20+20,Math.ceil(min/20)*20+60,Math.ceil(min/20)*20+100,Math.floor(max/10)*10,original.connection.anchorHefMM])].filter(h=>finite(h)&&h>=min&&h<=max).sort((a,b)=>a-b);
    for(let i=0;i<depths.length;i++){
      const next=A.clone(d);next.connection.anchorHefMM=depths[i];P.sync(next);
      preserveConcreteBounds(original,next,connectionLayout);
      if(!P.issues(next).length)variants.push({input:next,depthIndex:i,diameter,grade});
    }
  }
  return variants.sort((a,b)=>a.depthIndex-b.depthIndex||a.diameter-b.diameter||a.grade.localeCompare(b.grade));
}
export async function listConnectionOptions(original,{A,C,P,records,connectionLayout,weldGeometry,active=()=>true,progress=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0)),maxTrials=500,maxMilliseconds=35000,maxRows=16}={}){
  const started=Date.now(),fingerprint=A.stable(original),rows=[],seen=new Set(),reasons=new Map();let trials=0;
  const response=status=>({status,rows:status==='cancelled'?[]:rows,trials,fingerprint,reasons:[...reasons.values()].slice(0,8)});
  const stop=()=>!active()?'cancelled':trials>=maxTrials||Date.now()-started>=maxMilliseconds?'limited':null;
  const reject=r=>{for(const q of [...(r.errors||[]),...(r.connections?.checks||[]).filter(q=>!scalarOK(q))]){const id=q.id||q.path||q.message;if(!reasons.has(id))reasons.set(id,q.message||q.label+' · '+q.note);}};
  async function solve(d){
    const status=stop();if(status)throw Object.assign(Error(status),{searchStatus:status});
    await yieldTask();if(!active())throw Object.assign(Error('cancelled'),{searchStatus:'cancelled'});
    const r=C.calculate(d);trials++;progress({count:trials,rows:[...rows],found:rows.length});return r;
  }
  function offer(d,r,current=false){
    if(d.support.type!=='hbeam'&&d.connection.anchorLayout!=='outside-hss')return false;
    if(d.support.type!=='hbeam'&&(d.connection.anchorRows!==2||d.connection.anchorCols!==2))return false;
    const key=packageKey(d,A),m=packageMetrics(r,d,{C});if(!m.numeric||seen.has(key))return false;
    // Automatically proposed concrete products must have exact source values.
    if(d.support.type!=='hbeam'&&(d.connection.productSelection.id!==P.ID||P.issues(d).length))return false;
    seen.add(key);const g=connectionLayout(d),c=d.connection;
    rows.push({key,input:A.clone(d),current,...m,width:g.width,height:g.height,thicknessMM:d.plate.thicknessMM,
      weldMM:c.weldSizeMM,supportWeldMM:c.supportWeldSizeMM,pattern:c.weldPattern,
      anchor:d.support.type==='hbeam'?null:{name:c.product.name,diameterMM:d.plate.anchorMM,grade:c.productSelection.grade,hefMM:c.anchorHefMM,rows:c.anchorRows,cols:c.anchorCols,count:c.anchorRows*c.anchorCols,source:P.SOURCE,revision:c.product.revision},
      rootCount:d.truss.enabled?2:1,caseCount:r.cases.length});
    progress({count:trials,rows:[...rows],found:rows.length});return true;
  }
  const ts=[...new Set([...plateStock.thicknesses,original.plate.thicknessMM,...records.filter(x=>x.mode==='plate_dimensions').map(x=>x.specs?.thicknessMm)])].filter(t=>finite(t)&&t>=3&&t<=40).sort((a,b)=>a-b);
  const welds=[3,4,5,6,8,10,12,16,20,25];
  async function fitPlate(d){
    let minimumThickness=0;
    for(const t of ts){
      // DG1 elastic bending demand is independent of plate thickness. Skip
      // only thicknesses already proved too small, then solve the next stock
      // size including holes, shear, welds and every other check again.
      if(t+1e-9<minimumThickness)continue;
      d.plate.thicknessMM=t;const g=weldGeometry(d);if(!g.intervalFeasible)continue;
      const sizes=welds.filter(w=>w>=g.minSize&&w<=g.maxSize);if(!sizes.length)continue;
      d.connection.weldSizeMM=sizes[0];if(d.support.type==='hbeam')d.connection.supportWeldSizeMM=welds[0];
      for(let step=0;step<sizes.length+welds.length;step++){
        const r=await solve(d);if(r.errors?.length||!r.memberReady){reject(r);return false;}
        if(offer(d,r))return true;
        const qs=r.connections.checks,other=qs.filter(q=>!['plate','weld','support-weld'].includes(q.id));
        // Plate thickness and leg sizes do not enter the retained rigid anchor
        // distribution/anchor capacity methods. Changing these cannot repair
        // an anchor/site failure; try another real anchor/layout instead.
        if(other.some(q=>!scalarOK(q))){reject(r);return false;}
        const plate=qs.find(q=>q.id==='plate'),weld=qs.find(q=>q.id==='weld'),support=qs.find(q=>q.id==='support-weld');
        if(!scalarOK(plate)){if(Number.isFinite(plate?.detail?.tReq))minimumThickness=Math.max(minimumThickness,plate.detail.tReq);reject(r);break;}
        if(!scalarOK(weld)){
          const next=sizes.find(w=>w>d.connection.weldSizeMM);if(!next){reject(r);break;}d.connection.weldSizeMM=next;continue;
        }
        if(support&&!scalarOK(support)){
          const next=welds.find(w=>w>d.connection.supportWeldSizeMM);if(!next){reject(r);break;}d.connection.supportWeldSizeMM=next;continue;
        }
        reject(r);break;
      }
    }
    return false;
  }
  try{
    if(A.validate(original).length||A.validate(original,{geometryOnly:true}).length)return {...response('invalid'),reasons:A.validate(original).map(q=>q.message)};
    const initial=await solve(original);offer(original,initial,true);
    if(!A.calculate(original).ready)return {...response('unavailable'),reasons:['ยืนยันเหล็กที่ผ่านกำลังและการแอ่นก่อนเลือกจุดต่อ']};
    if(!ts.length)return {...response('unavailable'),reasons:['ไม่มีข้อมูลความหนาเพลทในรายการวัสดุ']};
    if(original.support.type==='hbeam'){
      // Keep the chosen support and weld pattern. Cut plate dimensions are
      // proposed within its actual available face, then checked by the engine.
      const g=connectionLayout(original),min=A.plateMinimum(original),dims=[[g.width,g.height],...[0,25.4,50.8,76.2].map(m=>[min+m,min+m])];
      for(const [w,h] of dims){const d=A.clone(original);Object.assign(d.connection,{plateAuto:false,plateWidthMM:w,plateHeightMM:h});await fitPlate(d);if(rows.length>=maxRows)break;}
    }else{
      const variants=chemicalVariants(original,{A,P,connectionLayout});
      const arrangements=[[2,2,0],[2,2,25.4],[2,2,50.8]];
      if(!variants.length)return {...response('unavailable'),reasons:['ไม่มีชุดพุกจากแหล่งข้อมูลที่ตรงกับโปรไฟล์ สภาพติดตั้ง และความหนาคอนกรีตนี้']};
      for(const v of variants){const offeredCounts=new Set();
        for(const [nr,nc,extra] of arrangements){
          if(offeredCounts.has(nr*nc))continue;
          const d=A.clone(v.input),c=d.connection;
          Object.assign(c,{anchorRows:nr,anchorCols:nc,anchorPreference:'4'});
          const pitch=(nc-1)*c.product.minSpacing;
          let g=A.detailLayout(d,{rows:nr,cols:nc,weld:Math.max(8,c.weldSizeMM),extra});
          if(c.anchorLayout==='legacy-face'&&c.plateSizing==='legacy-rectangle'){
            const diameter=d.plate.anchorMM,radius=Math.max(18,1.25*diameter),edge=Math.ceil(Math.max(1.5*diameter,radius)/5)*5,base=connectionLayout(original);
            const width=d.truss.enabled?Math.ceil(Math.max(d.steel.B+2*(radius+16)+2*edge,2*edge+pitch)/5)*5+extra:Math.ceil(Math.max(d.steel.B+50.8,2*edge+pitch)/5)*5;
            const height=d.truss.enabled?Math.max(base.height,d.steel.H+50.8):Math.ceil(Math.max(d.steel.H+2*(radius+8)+2*edge,2*edge+(nr-1)*c.product.minSpacing)/5)*5+extra;
            g={width,height,edgeX:d.truss.enabled?edge:(width-pitch)/2,edgeY:d.truss.enabled?height/2:edge};
          }
          Object.assign(c,{plateAuto:false,plateWidthMM:g.width,plateHeightMM:g.height,anchorEdgeXMM:g.edgeX,anchorEdgeYMM:g.edgeY});
          preserveConcreteBounds(original,d,connectionLayout);P.sync(d);
          if(C.validate(d).length){reject({errors:C.validate(d)});continue;}
          if(await fitPlate(d))offeredCounts.add(nr*nc);
          if(rows.length>=maxRows)break;
        }
        if(rows.length>=maxRows)break;
      }
    }
    return response(!active()?'cancelled':rows.length?'complete':'unavailable');
  }catch(e){if(e.searchStatus)return response(e.searchStatus);throw e;}
}
