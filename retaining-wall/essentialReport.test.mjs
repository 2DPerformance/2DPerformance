import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPassingExample} from './passingExamples.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {computeForUi,reportForUi} from './workbench.mjs';
import {nativeEquationRows,reportLoadTable,reportScope,workedReportTable,projectReportShear,mainEquationSections,nativeEquationTables,essentialCheckRows,governingReportMembers} from './essentialReport.mjs';
import {duckForceFigures} from './duckfootPresentation.mjs';
import {inputGeometry} from './inputGeometry.mjs';
import {nativeCadViews} from './nativeCadViews.mjs';
import {renderRbBeamSections} from './rbBeamSections.mjs';
import {normalizeRearAnchorInput} from './systemsSnapshot.mjs';
const legacy=['cantilever','counterfort','gravity'];
const texts=pages=>pages.flatMap(p=>p.entities.filter(e=>e.t==='text').map(e=>e.s)).join(' ');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

for(const type of [...legacy,'pile','pilecf','soldier','duckfoot'])test(type+': essential report uses the accepted profile, DL/LL, checks and steel in both units',()=>{
 for(const profile of type==='duckfoot'?['thai2566']:['thai2566','aci318','wsd']){
  const i=getPassingExample(type).values;
  if(legacy.includes(type))Object.assign(i,{surchargeD:4,surcharge:6,
   unitCanonicalSi:{...i.unitCanonicalSi,surchargeD:4,surcharge:6}});
  else if(type==='duckfoot')Object.assign(i,{NpostD:4,NpostL:6,Npost:10,qBeamD:1,qBeamL:2,qBeam:3});
  else Object.assign(i,{qD:4,qL:6,q:10});
  const s=legacy.includes(type)?computeForUi(i,profile).snapshot:createSystemSnapshot(i,profile);
  const before=JSON.stringify(s);
  for(const mode of ['si','kgf']){
   if(legacy.includes(type)){
    const pages=reportForUi(s,mode),all=texts(pages);
    const order=['1 · DL / LL','2 · Freebody Diagram','3 · แรงดันดินและเสถียรภาพ','4 · ออกแบบ','5 · สรุปผลตรวจสอบ'];
    let index=-1;for(const token of order){const found=all.indexOf(token);assert.ok(found>index,token);index=found;}
    for(const token of ['รายการ','สูตร','แทนค่า','ผลลัพธ์','SFD','BMD'])assert.ok(all.includes(token),token);
    assert.ok(!all.includes('ปริมาณวัสดุและตารางเหล็ก')&&!all.includes('โปรไฟล์ สมการ และขอบเขตชิ้นส่วน'));
    for(const c of s.checks)assert.ok(all.includes(c.k??c.key),c.k??c.key);
    assert.ok(pages.every(p=>!p.meta.overflow));assert.ok(pages.at(-1).meta.finalSectionSummary);
    near(s.result.surcharge.dead,4);near(s.result.surcharge.live,6);
    const shear=projectReportShear(s.result);near(shear[2].d,s.result.toeAnalysis.d);
   }else{
    const rows=nativeEquationRows(s,mode),load=reportLoadTable(s,mode),scope=reportScope(s,mode);
    assert.equal(rows.some(r=>r.some(v=>/undefined|NaN|Infinity|ไม่มีผลที่ใช้ได้/.test(v))),false);
    assert.ok(load.indexOf('DL')<load.indexOf('LL'));assert.ok(scope.includes('NOT FOR CONSTRUCTION'));
    const table=workedReportTable(rows);assert.ok(table.includes('<th>สูตร</th><th>แทนค่า</th><th>ผลลัพธ์</th>'));
    if(type==='duckfoot'){
     near(s.equilibrium.wCol,i.t*i.colDepth*i.hp*i.gc);
     const p=s.footing.punch;
     near(p.stress,Math.abs(p.V)/(1000*p.b0*p.d)+Math.abs(p.M)*Math.max(p.xbar,p.a-p.xbar)/(1000*p.J));
     assert.ok(rows.find(r=>r[0]==='เจาะทะลุ')[1].includes('1000'));
     assert.ok(rows.some(r=>r[0].startsWith('P–M')&&r[2]===s.column.cases[0].M.toFixed(3)+' / '+s.column.cases[0].capacityM.toFixed(3)));
    }else{
     near(s.forces.pile.Mu,s.forces.pile.designTrace.serviceM*s.forces.pile.designTrace.lateralFactor);
     const row=rows.find(r=>r[0]==='M ตรวจ');
     const factor=mode==='kgf'?1000/9.80665:1;
     assert.equal(row[3],(s.forces.pile.Mu*factor).toFixed(3)+' '+(mode==='kgf'?'kgf·m':'kN·m'));
     if(type==='soldier')assert.ok(scope.includes('แคป'));
    }
   }
   assert.equal(JSON.stringify(s),before,'report must not mutate accepted results');
  }
 }
});

test('real failure and unsupported capacity remain in essential output',()=>{
 const s=createSystemSnapshot({...getPassingExample('pile').values,hp:8});
 assert.equal(s.status,'FAIL');
 for(const c of s.checks.filter(c=>!c.ok&&c.fix))assert.ok(reportScope(s).includes(c.key));
 const soldier=createSystemSnapshot(getPassingExample('soldier').values);
 assert.ok(reportScope(soldier).includes('NOT FOR CONSTRUCTION'));
 assert.ok(soldier.equationLedger.components.some(c=>c.note));
});

test('essential duckfoot span selection preserves the actual governing curves',()=>{
 const s=createSystemSnapshot({...getPassingExample('duckfoot').values,NpostD:4,NpostL:6,Npost:10,qBeamD:1,qBeamL:2,qBeam:3});
 const calls=[];
 const html=duckForceFigures(s,(values,label)=>{calls.push({values,label});return '<svg aria-label="'+label+'"></svg>';},'si',{essential:true});
 const spans=s.beam.spans;
 const best=k=>spans.reduce((a,b)=>Math.max(...b.grid.map(p=>Math.abs(p[k])))>Math.max(...a.grid.map(p=>Math.abs(p[k])))?b:a).index+1;
 assert.ok(html.includes('SFD')&&html.includes('BMD'));
 assert.ok(html.includes('ช่วง '+best('M')));assert.ok(html.includes('ช่วง '+best('V')));
 for(const index of new Set([best('M'),best('V')])){
  assert.deepEqual(calls.find(c=>c.label.startsWith('SFD คานช่วง '+index)).values,spans[index-1].grid.map(p=>p.V));
  assert.deepEqual(calls.find(c=>c.label.startsWith('BMD คานช่วง '+index)).values,spans[index-1].grid.map(p=>p.M));
 }
});

test('public A4 explains main forces and steel rather than internal packing/node diagnostics',()=>{
 for(const type of ['pile','pilecf','soldier','duckfoot'])for(const profile of type==='duckfoot'?['thai2566']:['thai2566','aci318','wsd']){
  const s=createSystemSnapshot(getPassingExample(type).values,profile),before=JSON.stringify(s);
  for(const unit of ['si','kgf']){
   const sections=mainEquationSections(s,unit),paper=nativeEquationTables(s,unit);
   assert.equal(sections[0].key,'actions');
   assert.doesNotMatch(paper,/radicand|smin|max\(25\.4|Δy|D\/C เข็ม|AP[1-9] · ปฏิกิริยา|P–M · แรงอัด/);
   assert.ok(sections.every(g=>g.rows.length>0&&g.rows.every(r=>r.length===4)));
   if(type==='soldier'){
    for(const beam of s.reportSoldier.capBeams){
     const group=sections.find(g=>g.key.split('-').includes(beam.name));
     assert.equal(group.rows.length,2,'only flexure and shear worked rows per RB');
     assert.ok(group.rows[0][3].includes(beam.nTop+' / ล่าง '+beam.nBot+'-DB'+beam.db));
     assert.ok(group.rows[0][2].includes((beam.dCap*1000).toFixed(1)));
     near(beam.AsMin,1.4/s.input.fy*beam.bw*beam.dCap*1e6);
     assert.ok(group.rows[0][3].startsWith(beam.AsBotReq.toFixed(1)));
    }
   }
   if(type==='duckfoot')assert.equal(sections.find(g=>g.key==='column').rows.length,1,'one governing P–M case');
  }
  assert.equal(JSON.stringify(s),before);
 }
});

test('equal RB worked rows merge only when every design operand and selected bar is equal',()=>{
 const i={...getPassingExample('soldier').values,frontBeamMode:'legacy'},s=createSystemSnapshot(i);
 assert.equal(mainEquationSections(s).filter(g=>g.key.startsWith('RB')).length,1);
 assert.ok(mainEquationSections(s).find(g=>g.key.startsWith('RB')).title.includes('RB1 / RB2 / RB3'));
 const entered=createSystemSnapshot({...i,rb2Bw:60,rb2Bh:80,rb2Db:20,rb2Nt:6,rb2Nb:6});
 assert.equal(mainEquationSections(entered).filter(g=>g.key.startsWith('RB')).length,2);
 assert.ok(mainEquationSections(entered).some(g=>g.key==='RB2'));
});

test('soldier has no invented front beams; optional restraint-level beam and old saved geometry are explicit',()=>{
 const i=getPassingExample('soldier').values;
 assert.equal(i.frontBeamMode,'none');
 for(const profile of ['thai2566','aci318','wsd']){
  const none=createSystemSnapshot(i,profile),old=createSystemSnapshot({...i,frontBeamMode:'legacy'},profile),one=createSystemSnapshot({...i,frontBeamMode:'waler'},profile);
  assert.deepEqual(none.geometry.capBeams,[]);assert.deepEqual(none.reportSoldier.capBeams,[]);assert.deepEqual(none.rebarLayout.groups,[]);
  assert.equal(none.checks.some(c=>/^RB[123]/.test(c.key)),false);assert.equal(none.bbs.some(b=>/^RB[123]/.test(b.mark)),false);
  assert.equal(renderRbBeamSections(none,{report:true}),'');assert.doesNotMatch(nativeEquationTables(none),/RB[123]/);
  assert.equal(none.equationLedger.equations.some(e=>e.id==='frontRbBeam'),false);
  assert.ok(nativeEquationTables(none).includes('wu·Lสุทธิ²/8'));
  assert.deepEqual(one.geometry.capBeams.map(b=>b.mark),['RB2']);
  assert.deepEqual(one.reportSoldier.capBeams.map(b=>b.name),['RB2']);
  assert.equal(one.checks.some(c=>/^RB[13]/.test(c.key)),false);
  for(const s of [none,one]){
   const forceValues=x=>({...x.forces,rearAnchor:{...x.forces.rearAnchor,identity:'same-result'}});
   assert.deepEqual(forceValues(s),forceValues(old),'pile/soil/stay/anchor original forces exact; timestamp excluded');
   assert.deepEqual(s.checks.filter(c=>!/^RB[123]/.test(c.key)),old.checks.filter(c=>!/^RB[123]/.test(c.key)));
   assert.deepEqual(inputGeometry('soldier',s.input).g.capBeams.map(b=>b.mark),s.geometry.capBeams.map(b=>b.mark));
   const text=nativeCadViews(s).section(50).entities.filter(e=>e.t==='text').map(e=>e.s).join(' ');
   assert.equal(/RB1|RB3/.test(text),false);
  }
 }
 const saved={...i};delete saved.frontBeamMode;
 assert.equal(normalizeRearAnchorInput(saved,'soldier').frontBeamMode,'legacy');
 assert.equal(createSystemSnapshot(saved).geometry.capBeams.length,3,'old project keeps its original arrangement');
 assert.throws(()=>createSystemSnapshot({...i,frontBeamMode:'unknown'}),RangeError);
 assert.throws(()=>createSystemSnapshot({...i,frontBeamMode:'waler',soldierSys:'cant'}),RangeError);
 assert.doesNotThrow(()=>createSystemSnapshot({...i,rb1Bw:'',rbAgg:''}),'absent member fields do not block the wall');
});

test('condensed D/C retains every failure, even excluded diagnostic checks, and actual governing values',()=>{
 const checks=[
  {key:'เสา · P–M · แรงอัดสูง · เสา 1',ok:true,dc:.4},
  {key:'เสา · P–M · แรงอัดต่ำ · เสา 2',ok:true,dc:.8},
  {key:'RB1 · ระยะจัดเหล็กชั้นเดียว',ok:true,dc:.5},
  {key:'RB2 · ระยะจัดเหล็กชั้นเดียว',ok:false,dc:1.3},
  {key:'พฤติกรรมเข็ม (point spring)',ok:false,dc:2},
 ];
 assert.deepEqual(essentialCheckRows(checks),[checks[1],checks[3],checks[4]]);
 for(const type of ['pile','pilecf','soldier','duckfoot']){
  const s=createSystemSnapshot({...getPassingExample(type).values,hp:8});
  for(const c of s.checks.filter(c=>!c.ok))assert.ok(essentialCheckRows(s.checks).includes(c));
 }
});

test('worked steel examples choose As demand per arrangement, while all selected positions remain in legacy A4',()=>{
 const members=[{name:'พนัง z 1 m',bar:'DB16@200',As:900},{name:'พนัง z 2 m',bar:'DB16@200',As:1100},
  {name:'พนัง z 3 m',bar:'DB20@200',As:1500},{name:'Heel บน',bar:'DB16@200',As:900}];
 assert.deepEqual(governingReportMembers(members),[members[1],members[2],members[3]]);
 for(const type of legacy){
  const s=computeForUi(getPassingExample(type).values).snapshot;
  const all=texts(reportForUi(s));
  assert.ok(all.includes('เหล็กที่เลือกในแต่ละตำแหน่ง'));
  for(const m of s.result.stemTab||[])assert.ok(all.includes(m.bar.txt));
 }
});
