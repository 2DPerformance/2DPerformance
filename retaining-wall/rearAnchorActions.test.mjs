import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRearAnchorActions} from './rearAnchorActions.mjs';
import {renderRearAnchorActions} from './rearAnchorPresentation.mjs';
import {displayedBbsRow} from './resultUnits.mjs';
import {compactReportHtml} from './compactReport.mjs';
import {rearPileCaps} from './rearPileCapGeometry.mjs';
import {inputDiagram} from './inputDiagram.mjs';
import {inputGeometry} from './inputGeometry.mjs';
import {nativeCadViews} from './nativeCadViews.mjs';
import {SYSTEM_DEFAULTS,createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {DESIGN_PROFILES,designRetainingWall} from './engine.mjs';
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const input=()=>({...SYSTEM_DEFAULTS,...getPassingExample('soldier').values});

test('independent 3D vector golden: pair cancellation and odd single anchor',()=>{
  const fronts=[{x:0,y:4,z:-1.5},{x:0,y:4,z:1.5},{x:0,y:4,z:5}];
  const anchors=[{id:0,head:{x:4,y:1,z:0},tip:{x:4,y:-4,z:0},width:.35},
    {id:1,head:{x:4,y:1,z:5},tip:{x:4,y:-4,z:5},width:.35}];
  const members=fronts.map((front,k)=>{const rear=anchors[k<2?0:1].head;
    const d=[rear.x-front.x,rear.y-front.y,rear.z-front.z],length=Math.hypot(...d);
    return {frontIndex:k,anchorIndex:k<2?0:1,front,rear,length,direction:d.map(v=>v/length)};});
  const r={SS:'stay',i:{},stay:{T:100,layout:{members,anchors,Lb:4,drop:3}}};
  const a=buildRearAnchorActions(r,1.7,'golden');
  assert.deepEqual(a.anchors.map(c=>c.stayCount),[2,1]);
  a.anchors[0].load.forEach((v,k)=>close(v,[-200,150,0][k]));
  a.anchors[1].load.forEach((v,k)=>close(v,[-100,75,0][k]));
  close(a.members[0].axial,100*Math.sqrt(27.25)/4);
  close(a.members[2].axial,125);close(a.anchors[0].factoredLoad[1],255);
  for(const c of a.anchors)c.load.forEach((v,k)=>close(v+c.reaction[k],0));
  for(const m of a.members)m.rearLoad.forEach((v,k)=>close(v+m.frontLoad[k],0));
  assert.equal(a.capacityVerified,false);assert.equal(a.constructionApproved,false);
  assert.deepEqual(buildRearAnchorActions({...r,SS:'anchor'},1.7,'x'),null);
});

test('actual accepted actions retain per-profile gH and odd last-bay geometry',()=>{
  for(const profile of Object.keys(DESIGN_PROFILES)){
    const s=createSystemSnapshot({...input(),Lw:12,pileS:1.2},profile),a=s.forces.rearAnchor;
    assert.equal(a.identity,s.stamp);assert.equal(a.lateralFactor,DESIGN_PROFILES[profile].gH);
    assert.equal(a.anchors.length,6);assert.equal(a.anchors.at(-1).stayCount,1);
    close(a.anchors[0].load[0],-2*a.horizontalPerFront);
    close(a.anchors.at(-1).load[0],-a.horizontalPerFront);
    close(a.anchors[0].load[1],2*a.horizontalPerFront*a.drop/a.span);
    for(const c of a.anchors)c.factoredLoad.forEach((v,k)=>close(v,c.load[k]*a.lateralFactor));
    assert(Object.isFrozen(a));assert(Object.isFrozen(a.anchors[0].load));
    close(Math.max(...a.members.map(m=>m.axial)),s.forces.pile.stay.axial);
  }
});

test('entered non-square cap reaches draft, accepted geometry, CAD and force ledger',()=>{
  const i={...input(),ancCapB:.8,ancCapL:1,ancCapH:.7};
  const draft=inputGeometry('soldier',i),s=createSystemSnapshot(i),a=s.forces.rearAnchor;
  for(const cap of [...draft.g.rearCaps,...s.geometry.rearCaps])assert.deepEqual(cap.size,[.8,.7,1]);
  assert.deepEqual(draft.parts.filter(p=>p.kind==='cap').map(c=>c.size),s.geometry.rearCaps.map(c=>c.size));
  for(const c of a.anchors)assert.deepEqual(c.size,[.8,.7,1]);
  assert.match(inputDiagram('soldier',i,'ancCapB').svg,/Bc 0.8 m/);
  assert.match(inputDiagram('soldier',i,'ancCapH').svg,/hc 0.7 m/);
  assert.equal(inputDiagram('soldier',i,'ancCapL').view,'plan');
  assert.match(inputDiagram('soldier',i,'ancCapL').svg,/Lc 1 m/);
  const views=nativeCadViews(s),c=s.geometry.rearCaps[0];
  for(const [name,expected]of [['section',[800,700]],['plan',[1000,800]]]){
    const model=views[name](50);assert(model.entities.some(e=>e.t==='poly'&&e.pc==='OUTLINE'&&e.layer==='RW-CONCRETE'
      &&Math.abs(Math.max(...e.pts.map(p=>p.x))-Math.min(...e.pts.map(p=>p.x))-expected[0])<1e-8
      &&Math.abs(Math.max(...e.pts.map(p=>p.y))-Math.min(...e.pts.map(p=>p.y))-expected[1])<1e-8));
  }
  const plain=rearPileCaps(s.geometry.stayLayout);
  assert(plain.every(c=>c.size[1]===.5));
});

test('old project defaults migrate only absent fields; explicit invalid entries reject',()=>{
  const old=input();for(const k of ['ancCapB','ancCapL','ancCapH','ancDowelDb','ancDowelN'])delete old[k];
  const s=createSystemSnapshot(old);assert.equal(s.input.ancDowelDb,16);assert.equal(s.input.ancDowelN,0);
  for(const [key,values]of Object.entries({ancCapB:['',NaN,Infinity,-1,.2],ancCapL:['',NaN,5],
    ancCapH:['',NaN,.1],ancDowelDb:['',NaN,13,40],ancDowelN:['',NaN,-1,1.5,101]}))
    for(const value of values)assert.throws(()=>createSystemSnapshot({...input(),[key]:value}),RangeError,key+' '+value);
});

test('manual DB dowel checks actual selected area; insufficient steel remains FAIL',()=>{
  const failed=createSystemSnapshot({...input(),ancDowelDb:12,ancDowelN:1});
  assert.equal(failed.forces.rearAnchor.dowel.spec,'1-DB12');
  assert.equal(failed.forces.rearAnchor.dowel.steelOK,false);
  assert.equal(failed.checks.find(c=>c.key.includes('APd')).ok,false);assert.equal(failed.status,'FAIL');
  const passed=createSystemSnapshot({...input(),ancDowelDb:20,ancDowelN:8});
  assert.equal(passed.forces.rearAnchor.dowel.spec,'8-DB20');
  assert.equal(passed.forces.rearAnchor.dowel.steelOK,true);
  assert.match(passed.bbs.find(b=>b.mark==='APd').detail,/8-DB20/);
  assert.match(passed.checks.find(c=>c.key.includes('APd')).criterion,/ยังไม่ตรวจ/);
  assert.equal('ancDowelMode' in passed.input,false);
});

test('cap size is a geometry input, never a strength or verdict override',()=>{
  for(const profile of Object.keys(DESIGN_PROFILES)){
    const first=createSystemSnapshot(input(),profile),other=createSystemSnapshot({...input(),ancCapB:1,ancCapL:1,ancCapH:1},profile);
    assert.deepEqual(other.checks,first.checks);assert.equal(other.status,first.status);
    assert.deepEqual(other.forces.pile,first.forces.pile);assert.deepEqual(other.bbs,first.bbs);
    const direct=designRetainingWall(other.input,{profile});
    close(other.forces.rearAnchor.dowel.AsProvided,direct.stay.anchorPile.dowel.AsProv);
  }
});

test('SI/kgf report preserves identity and numerical force basis without unsupported joint PASS',()=>{
  const s=createSystemSnapshot(input()),a=s.forces.rearAnchor;
  const si=renderRearAnchorActions(a),kg=renderRearAnchorActions(a,{mode:'kgf'});
  for(const html of [si,kg]){
    assert(html.includes(s.stamp));assert.match(html,/FBD/);assert.match(html,/ยังไม่มีผลกำลัง/);
    assert.match(html,/พื้นที่เหล็กผ่าน/);assert.match(html,/เหล็กเดือยหล่อพร้อมกัน/);
    assert(!/40db|15db|data-rear-dowel-envelope|อีพ็อกซี/.test(html));
    assert(!/NaN|Infinity|undefined|joint PASS/.test(html));
  }
  assert.match(si,/kN/);assert.match(kg,/kgf/);
  assert.equal(renderRearAnchorActions(null),'');
  assert.throws(()=>renderRearAnchorActions({...a,capacityVerified:true}),TypeError);
});

test('cast-together BBS wording matches screen and A4 without rewriting accepted quantities',()=>{
  const s=createSystemSnapshot(input()),before=JSON.stringify(s),raw=s.bbs.find(row=>row.mark==='APd');
  const row=displayedBbsRow(s,raw);
  assert.match(row.detail,/4-DB16\/ต้น.*หล่อพร้อมกัน/);
  assert(!/อีพ็อกซี|ระยะสมมติ|40db|15db/.test(row.detail));
  for(const key of Object.keys(raw).filter(key=>!['position','detail'].includes(key)))assert.deepEqual(row[key],raw[key]);
  assert.equal(displayedBbsRow(s,s.bbs[0]),s.bbs[0]);
  const pc={...s,forces:{...s.forces,rearAnchor:{...s.forces.rearAnchor,dowel:{mode:'pcwire'}}}};
  assert.equal(displayedBbsRow(pc,raw),raw);
  for(const mode of ['si','kgf'])assert(!compactReportHtml(s,mode,{fbdHTML:'<svg>Freebody Diagram test fixture</svg>'}).includes('อีพ็อกซี'));
  assert.equal(JSON.stringify(s),before);
});
