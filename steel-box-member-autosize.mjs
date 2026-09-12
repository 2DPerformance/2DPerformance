// Search orchestration only. All forces, capacities and verdicts come from the
// existing engines; this module never supplies a replacement capacity or PASS.
import {preserveConcreteBounds,selectConcreteConnection} from './steel-box-member-connection-selection.mjs?v=20260912-r40';
export const area=s=>2*s.t*(s.H+s.B-2*s.t);
const same=(a,b)=>a.H===b.H&&a.B===b.B&&a.t===b.t;
const numeric=q=>q?.pass===true&&Number.isFinite(q.ratio)&&q.ratio<=1+1e-9;
const groupPass=(r,prefix)=>!r.errors?.length&&r.checks?.filter(q=>q.id.startsWith(prefix)).length>=2&&r.checks.filter(q=>q.id.startsWith(prefix)).every(numeric);
function metrics(r,slot){
  const id=slot==='purlin'?'purlin-strength':['steel','web'].includes(slot)?'member-strength':{'plate.thicknessMM':'plate','connection.weldSizeMM':'weld','connection.supportWeldSizeMM':'support-weld'}[slot];
  const q=r.checks?.find(c=>c.id===id),bars=r.truss&&['steel','web'].includes(slot)?r.cases.flatMap(c=>c.members.filter(m=>m.kind===(slot==='steel'?'chord':'web'))):[];
  return {dc:bars.length?Math.max(...bars.map(m=>m.ratio)):q?.ratio,pass:q?.pass===true,deflectionMM:slot==='purlin'?(r.purlins?.deflection?Math.abs(r.purlins.deflection.delta):null):['steel','web'].includes(slot)?r.deflection?.maxMM??null:null,allowMM:slot==='purlin'?r.purlins?.allowMM??null:['steel','web'].includes(slot)?r.memberLimit??null:null};
}
export function marketSections(records,slot){
  const rows=new Map();
  for(const row of records){const p=row.specs;if(row.slot!==(slot==='purlin'?'purlin':'member')||!['member_dimensions','purlin_dimensions'].includes(row.mode)||!p)continue;
    const s={H:p.depthMm,B:p.widthMm,t:p.thicknessMm};if(Object.values(s).every(x=>Number.isFinite(x)&&x>0)&&2*s.t<Math.min(s.H,s.B))rows.set(`${s.H}x${s.B}x${s.t}`,s);
  }
  return [...rows.values()].sort((a,b)=>area(a)-area(b)||a.H-b.H||a.B-b.B||a.t-b.t);
}
export async function selectMaterials(original,{A,C,records,weldGeometry,connectionLayout,initial,active=()=>true,progress=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0)),maxTrials=500,maxMilliseconds=60000}){
  const started=Date.now(),baseline=A.clone(original),d=A.clone(original);let count=0,r=initial||C.calculate(d),member=r;
  const note={status:'unchanged',trials:0,changes:[],remaining:[],input:baseline,result:r};
  if(r.errors?.length&&(!d.truss.enabled||A.validate(d).length||C.validate(d).length||A.validate(d,{geometryOnly:true}).length))return {...note,status:'invalid'};
  const stopped=()=>!active()?'cancelled':count>=maxTrials||Date.now()-started>=maxMilliseconds?'limited':null;
  async function tick(label){const status=stopped();if(status)throw Object.assign(new Error(status),{searchStatus:status});progress({label,count});await yieldTask();if(!active())throw Object.assign(new Error('cancelled'),{searchStatus:'cancelled'});}
  async function solve(next,label){await tick(label);count++;return A.calculate(next);}
  const put=(slot,s)=>Object.assign(d[slot],s);
  const candidates=slot=>marketSections(records,slot);
  const weldFeasible=()=>!weldGeometry||weldGeometry(d).intervalFeasible;
  const purlinPass=x=>groupPass(x,'purlin-')&&['ok','warn'].includes(x.purlins?.state);
  const familyPass=(x,slot)=>!x.errors?.length&&x.cases?.length>0&&x.cases.every(c=>{
    const ms=c.members?.filter(m=>m.kind===(slot==='steel'?'chord':'web'));
    return ms?.length>0&&ms.every(m=>Number.isFinite(m.ratio)&&m.ratio<=1+1e-9&&['ok','warn'].includes(m.state));
  });
  try{
    // Valid input can fail to solve because the entered members are unstable.
    // Search real pairs for a solvable state; never treat a solver error as PASS.
    if(member.errors?.length){
      const cs=candidates('steel'),ws=candidates('web');
      for(let i=0;i<Math.max(cs.length,ws.length);i++){if(cs.length)put('steel',cs[Math.min(i,cs.length-1)]);if(ws.length)put('web',ws[Math.min(i,ws.length-1)]);if(!weldFeasible())continue;member=await solve(d,'Truss · หาหน้าตัดที่วิเคราะห์เสถียรภาพได้');if(!member.errors.length)break;}
      if(member.errors.length)return {...note,status:'unavailable',trials:count,remaining:['ยังไม่พบหน้าตัดที่วิเคราะห์โครงได้ ตรวจช่วง ความลึก และรูปแบบโครง']};
    }
    if(!purlinPass(member)){
      let found=false;for(const s of candidates('purlin')){put('purlin',s);member=await solve(d,'แป · กำลังและการแอ่น');if(purlinPass(member)){found=true;break;}}
      if(!found)return {...note,status:'unavailable',trials:count,remaining:['ไม่พบแปที่ผ่านในรายการขนาดที่ตรวจ']};
    }
    if(!(member.memberReady??member.ready)||!weldFeasible()){
      if(!d.truss.enabled){
        for(const s of candidates('steel')){put('steel',s);if(!weldFeasible())continue;member=await solve(d,'คาน · กำลังและการแอ่น');if(member.ready)break;}
      }else{
        // Repair each family using its own envelopes first. Recheck both after
        // each change: chord/web stiffness and dead weight interact.
        for(let cycle=0;cycle<3&&(!member.ready||!weldFeasible());cycle++){
          for(const slot of ['steel','web']){if(familyPass(member,slot)&&(slot!=='steel'||weldFeasible()))continue;const before=A.clone(d[slot]);let found=false;
            for(const s of candidates(slot)){put(slot,s);if(slot==='steel'&&!weldFeasible())continue;const q=await solve(d,slot==='steel'?'Truss · คอร์ด':'Truss · ทแยง / ตั้ง');if(familyPass(q,slot)){member=q;found=true;break;}}
            if(!found){put(slot,before);member=await solve(d,'ตรวจโครงถักทั้งชุด');}
          }
        }
        // Strength may pass while system deflection does not. Try one-family
        // repairs, then paired increases. This bounded search is not a global
        // weight optimisation and does not assume response is monotonic.
        for(const slot of ['steel','web']){if(member.ready)break;const before=A.clone(d[slot]);let found=false;
          for(const s of candidates(slot)){put(slot,s);if(slot==='steel'&&!weldFeasible())continue;const q=await solve(d,'Truss · ตรวจทั้งชุดและการแอ่น');if(q.ready){member=q;found=true;break;}}
          if(!found)put(slot,before);
        }
        if(!member.ready){const cs=candidates('steel').filter(s=>area(s)>=area(d.steel)),ws=candidates('web').filter(s=>area(s)>=area(d.web));
          for(let i=0;i<Math.max(cs.length,ws.length);i++){if(cs.length)put('steel',cs[Math.min(i,cs.length-1)]);if(ws.length)put('web',ws[Math.min(i,ws.length-1)]);if(!weldFeasible())continue;member=await solve(d,'Truss · จับคู่คอร์ดและทแยง');if(member.ready)break;}
        }
      }
      if(!member.ready)return {...note,status:'unavailable',trials:count,remaining:['ยังไม่พบชุดเหล็กที่ผ่านกำลังและการแอ่นในขอบเขตการค้นนี้']};
    }
    if(connectionLayout)preserveConcreteBounds(baseline,d,connectionLayout);
    await tick('ตรวจเพลท รอยเชื่อม และพุกทุกกรณีแรง');r=C.calculate(d);count++;
    if(r.errors.length||!r.memberReady)return {...note,status:'unavailable',trials:count,remaining:['ผลตรวจทั้งชุดยังไม่ครบ จึงคงวัสดุเดิม']};
    // Existing plate stock thicknesses; retain custom thickness if already
    // suitable. Weld geometry limits remain enforced by the original engine.
    const ids=['plate','weld',...(d.support.type==='hbeam'?['support-weld']:[])];
    const connectionPass=x=>ids.every(id=>numeric(x.connections?.checks.find(q=>q.id===id)));
    if(d.support.type!=='hbeam'&&connectionLayout&&weldGeometry){
      const picked=await selectConcreteConnection(d,{reference:baseline,A,C,records,layout:connectionLayout,weldGeometry,evaluate:async(next,label)=>{await tick(label);count++;return C.calculate(next);}});
      d.plate=picked.input.plate;d.connection=picked.input.connection;r=picked.result;
    }else if(!connectionPass(r)){
      const saved={plate:A.clone(d.plate),connection:A.clone(d.connection)};
      const ts=[...new Set([d.plate.thicknessMM,...records.filter(x=>x.mode==='plate_dimensions').map(x=>x.specs?.thicknessMm)])].filter(t=>Number.isFinite(t)&&t>=3&&t<=40).sort((a,b)=>a-b);
      const sizes=[...new Set([d.connection.weldSizeMM,d.connection.supportWeldSizeMM,3,4,5,6,8,10,12,16])].sort((a,b)=>a-b);
      let accepted=false;
      for(const t of ts){if(accepted)break;d.plate.thicknessMM=t;
        const geometry=weldGeometry?.(d);if(geometry&&!geometry.intervalFeasible)continue;
        // Full calculation keeps the existing input-fingerprint gate intact.
        for(const w of sizes){if(geometry&&(w<geometry.minSize||w>geometry.maxSize))continue;d.connection.weldSizeMM=w;await tick('เพลท / ขารอยเชื่อม · ตรวจขนาดและ D/C');count++;
          const q=C.calculate(d).connections,own=q?.checks.find(x=>x.id==='weld'),pl=q?.checks.find(x=>x.id==='plate');
          if(!numeric(own)||!numeric(pl))continue;
          if(d.support.type==='hbeam'){
            for(const sw of [saved.connection.supportWeldSizeMM,...sizes.filter(x=>x!==saved.connection.supportWeldSizeMM)]){d.connection.supportWeldSizeMM=sw;await tick('รอยเชื่อมเพลท → H-beam');count++;if(connectionPass(C.calculate(d))){accepted=true;break;}}
          }else accepted=true;
          if(accepted)break;
        }
      }
      if(!accepted){d.plate=saved.plate;d.connection=saved.connection;}
    }
    await tick('คำนวณยืนยันวัสดุที่เลือกทั้งชุด');r=C.calculate(d);count++;
    if(r.errors.length||!r.memberReady)return {...note,status:'unavailable',trials:count,remaining:['วัสดุที่ลองยังไม่ผ่านผลยืนยันทั้งชุด จึงคงวัสดุเดิม']};
    const changes=[];for(const slot of ['purlin','steel',...(d.truss.enabled?['web']:[])])if(!same(d[slot],baseline[slot]))changes.push({slot,before:baseline[slot],after:A.clone(d[slot])});
    for(const [slot,a,b] of [['plate.thicknessMM',baseline.plate.thicknessMM,d.plate.thicknessMM],['connection.weldSizeMM',baseline.connection.weldSizeMM,d.connection.weldSizeMM],['connection.supportWeldSizeMM',baseline.connection.supportWeldSizeMM,d.connection.supportWeldSizeMM]])if(a!==b)changes.push({slot,before:a,after:b});
    for(const change of changes){change.beforeCheck=metrics(note.result,change.slot);change.afterCheck=metrics(r,change.slot);}
    if(connectionLayout&&d.support.type!=='hbeam'){
      const describe=x=>({...connectionLayout(x),rows:x.truss.enabled?1:x.connection.anchorRows,cols:x.connection.anchorCols,diameter:x.plate.anchorMM,edgeX:x.connection.anchorEdgeXMM,edgeY:x.connection.anchorEdgeYMM,concreteEdges:['edgeLeftMM','edgeRightMM','edgeTopMM','edgeBottomMM'].map(k=>x.connection[k])});
      const before=describe(baseline),after=describe(d);
      if(A.stable(before)!==A.stable(after))changes.push({slot:'connection.layout',before,after,beforeCheck:{dc:null,pass:false,deflectionMM:null},afterCheck:{dc:null,pass:r.connections.checks.filter(x=>['hardware-fit','geometry','support-fit'].includes(x.id)).every(numeric),deflectionMM:null}});
    }
    return {status:changes.length?'selected':'unchanged',trials:count,changes,input:d,result:r,remaining:r.connections.checks.filter(q=>!q.pass).map(q=>q.label+' · '+q.note)};
  }catch(error){if(error.searchStatus)return {...note,status:error.searchStatus,trials:count,remaining:error.searchStatus==='limited'?['ครบขอบเขตการค้นครั้งนี้ จึงคงวัสดุเดิม ลองปรับช่วงหรือรายละเอียดแล้วคำนวณใหม่']:[]};throw error;}
}
