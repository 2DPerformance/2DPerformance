// Material alternatives are measured by the same member solver as Calculate.
// This module neither changes project input nor grants connection/report PASS.
import {marketSections} from './steel-box-member-autosize.mjs?v=20260913-r42';

export const sectionKey=s=>`${s.H}x${s.B}x${s.t}`;
const validCheck=q=>q?.pass===true&&Number.isFinite(q.ratio)&&q.ratio>=0&&q.ratio<=1;
export function sectionMetrics(r,slot){
  const strength=r.checks?.find(q=>q.id===(slot==='purlin'?'purlin-strength':'member-strength'));
  const deflection=r.checks?.find(q=>q.id===(slot==='purlin'?'purlin-deflection':'member-deflection'));
  const bars=r.truss&&slot!=='purlin'?r.cases?.flatMap(c=>(c.members||[]).filter(m=>m.kind===(slot==='steel'?'chord':'web')).map(m=>({...m,caseName:c.name||c.id}))):[];
  const control=bars?.length?bars.reduce((a,b)=>a.ratio>=b.ratio?a:b):null;
  const dc=control?control.ratio:strength?.ratio;
  const deflectionMM=slot==='purlin'?Math.abs(r.purlins?.deflection?.delta):r.deflection?.maxMM;
  const allowMM=slot==='purlin'?r.purlins?.allowMM:r.memberLimit;
  const familyPass=bars?.length?bars.every(m=>Number.isFinite(m.ratio)&&m.ratio>=0&&m.ratio<=1&&['ok','warn'].includes(m.state)):validCheck(strength);
  return {dc,deflectionMM,allowMM,deflectionRatio:deflection?.ratio,memberId:control?.id||null,caseName:control?.caseName||strength?.caseName||null,
    pass:!r.errors?.length&&!r.issues?.length&&familyPass&&validCheck(deflection)&&Number.isFinite(dc)&&Number.isFinite(deflectionMM)&&deflectionMM>=0&&Number.isFinite(allowMM)&&allowMM>0&&deflectionMM<=allowMM,
    allMembersPass:r.ready===true};
}

export async function listSectionOptions(original,{A,records,slot,allMembers=true,active=()=>true,progress=()=>{},yieldTask=()=>new Promise(r=>setTimeout(r,0)),maxTrials=250,maxMilliseconds=30000}){
  if(!['steel','web','purlin'].includes(slot)||slot==='web'&&!original.truss.enabled)throw Error('ไม่พบกลุ่มเหล็กที่เลือก');
  const started=Date.now(),base=A.clone(original),fingerprint=A.stable(original),current=sectionKey(base[slot]);
  const available=marketSections(records,slot),stock=new Set(available.map(sectionKey));
  // Check the proposed/current section first. Even a bounded search retains an
  // independently verified current choice before scanning other stock sizes.
  const market=[{H:base[slot].H,B:base[slot].B,t:base[slot].t},...available.filter(s=>sectionKey(s)!==current)];
  const rows=[];let trials=0,status='complete';
  for(const section of market){
    if(!active()){status='cancelled';break;}
    if(trials>=maxTrials||Date.now()-started>=maxMilliseconds){status='limited';break;}
    const d=A.clone(base);Object.assign(d[slot],section);const r=A.calculate(d);trials++;
    const metrics=sectionMetrics(r,slot);
    if(metrics.pass&&(!allMembers||metrics.allMembersPass))rows.push({key:sectionKey(section),section,stock:stock.has(sectionKey(section)),current:sectionKey(section)===current,...metrics});
    progress({count:trials,total:market.length,found:rows.length,rows:[...rows]});await yieldTask();
  }
  // Discard a stale result rather than leaving an apparently selectable subset.
  if(!active())return {status:'cancelled',rows:[],trials,fingerprint,slot};
  return {status,rows,trials,fingerprint,slot};
}
