import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import './Concrete-design/corbel-engine.js';
import './Concrete-design/corbel-workbench-model.js';
import './corbel-rebar-detail.js';
import './corbel-cad-drawing.js';
const {designCorbel,DEFAULT_CORBEL_INPUT}=globalThis.CorbelDesign;
const {createCorbelResultSnapshot,selectCorbelViewModel}=globalThis.CorbelWorkbenchModel;
const {build,section,FIELD_IDS,TRIAL_DETAILS,VERTICAL_FIELDS,VERTICAL_TRIAL}=globalThis.CorbelRebarDetail;
const current=(input=DEFAULT_CORBEL_INPUT,details={})=>createCorbelResultSnapshot(designCorbel(input),{createdAt:'2026-10-05T20:00:00Z',wallHeightM:2.8,detailGeometry:details});
const full={detailSupportWidth:350,detailSupportDepth:700,detailEmbed:200,detailMainBend:72,detailSupportTail:15,detailNoseTail:15,detailTieBend:36};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('legacy geometry with unchanged trial numbers genuinely passes native checks and keeps original 90-degree tails',()=>{
  const html=readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8');
  const val=id=>Number(html.match(new RegExp(`<input[^>]*id="${id}"[^>]*value="([^"]+)"`))?.[1]);
  const input={...DEFAULT_CORBEL_INPUT,widthMm:val('wallRun')/val('supportCount'),heightMm:val('height'),tipHeightMm:val('tipHeight'),lengthMm:val('length'),depthMm:val('depth'),coverMm:val('cover'),vuKg:(val('wallUnitWeight')+val('finishUnitWeight'))*val('wallHeight')*val('wallRun')/1000*val('deadLoadFactor')};
  const details=Object.fromEntries(FIELD_IDS.map(id=>[id,val(id)])),s=current(input,details),before=JSON.stringify(s),g=build(s);
  assert.equal(s.verdict,'pass');assert.ok(s.checks.every(c=>c.status==='pass'));assert.equal(g.status,'GEOMETRY CANDIDATE');assert.deepEqual(g.errors,[]);
  assert.equal(g.main.length,3);assert.equal(g.ties.length,3);assert.equal(g.ledger.mainLabel,'3-DB12');assert.equal(g.ledger.tieLabel,'3-RB9');
  near(g.ledger.mainPitchMm,91.48528137423858);near(g.ledger.mainClearSpacingMm,79.48528137423858);near(g.ledger.engineAvailableClearMm,92);
  for(const bar of g.main){assert.ok(bar.supportHook&&bar.noseHook);near(bar.points[0][1],256);near(bar.points.at(-1)[1],256);near(bar.radiusMm,6);}
  for(const tie of g.ties){assert.ok(tie.closed);near(tie.backXMm,-300);near(tie.radiusMm,4.5);near(tie.bendCenterRadiusMm,22.5);}
  // Independent analytic rounded-corner containment, using nominal diameters.
  const zMain=Math.max(...g.main.map(bar=>Math.abs(bar.points[0][2]))),xMain=g.main[0].points.at(-1)[0];
  const cornerX=450-40-4.5-22.5,cornerZ=150-40-4.5-22.5;
  near(Math.hypot(xMain-cornerX,zMain-cornerZ)+6+4.5,22.5);
  const k=(500-350)/450;
  for(const bar of g.main)for(const [x,y,z] of bar.points){assert.ok(Math.abs(z)+6<=150-40+1e-7);if(x>=0)assert.ok((500-k*x-y)/Math.hypot(1,k)>=46-1e-7);else {assert.ok(x-6>=-400+40);assert.ok(y+6<=700-40);}}
  assert.equal(JSON.stringify(s),before);assert.equal(g.constructionAuthorized,false);assert.equal(g.anchorageVerified,false);
  const native=designCorbel(input);assert.deepEqual(s.provided,native.provided);assert.deepEqual(s.checks,native.checks);
});
test('nested trial catches shortened support clearance, excessive nose tails and rounded-corner congestion',()=>{
  const input={...DEFAULT_CORBEL_INPUT,tipHeightMm:350};
  for(const patch of [{detailTieEmbed:250},{detailSupportWidth:330},{detailNoseTail:260},{detailTieBend:220}]){
    const s=current(input,{...TRIAL_DETAILS,...patch}),g=build(s);assert.equal(s.verdict,'pass');assert.equal(g.status,'DETAIL HOLD');assert.ok(g.errors.length||g.issues.some(i=>i.code.includes('CLASH')));
  }
  const old=current(input,full);assert.equal(build(old).ledger.layout,'legacy-seven-field');
});
test('CAD uses three independent large monochrome views and every actual Ah layer',()=>{
  const s=current({...DEFAULT_CORBEL_INPUT,tipHeightMm:350},TRIAL_DETAILS),g=build(s),svg=section(s);
  assert.equal((svg.match(/data-cad-view=/g)||[]).length,3);assert.ok(svg.includes('01 · SIDE'));assert.ok(svg.includes('02 · FRONT'));assert.ok(svg.includes('03 · PLAN'));
  assert.equal((svg.match(/data-ah-layer=/g)||[]).length,g.ties.length);assert.equal((svg.match(/data-front-main=/g)||[]).length,g.main.length);assert.equal((svg.match(/data-front-tie=/g)||[]).length,2*g.ties.length);
  assert.ok(svg.includes('data-cad-ledger="true"'));assert.ok(svg.includes('79.5'));assert.ok(svg.includes('ก่อนวางปลอก'));assert.ok(svg.includes('REVIEW / NOT FOR CONSTRUCTION'));
  assert.ok(!svg.includes('#2563eb'));assert.ok(!svg.includes('#eff6ff'));
});
test('native count/diameter, h-d, actual pitch and two-leg Ah area stay immutable',()=>{
  const s=current(),before=JSON.stringify(s),g=build(s),m=s.provided.main,t=s.provided.ties;
  assert.equal(g.status,'DETAIL INCOMPLETE');assert.equal(g.main.length,m.count);assert.equal(g.ties.length,t.count);
  for(const bar of g.main)assert.equal(bar.radiusMm,m.diameterMm/2);
  for(const bar of g.ties)assert.equal(bar.radiusMm,t.diameterMm/2);
  near(g.main[0].points[0][1],s.input.heightMm-s.input.depthMm);
  near(g.ledger.mainClearSpacingMm,(s.input.widthMm-2*s.input.coverMm-m.count*m.diameterMm)/(m.count-1));
  near(g.ledger.tieAreaMm2,t.count*2*Math.PI*t.diameterMm**2/4);
  assert.equal(g.main.some(b=>b.supportHook||b.noseHook),false);assert.equal(g.ties.some(b=>b.closed),false);
  assert.equal(JSON.stringify(s),before);assert.ok(Object.isFrozen(g.ties[0].points[0]));
});
test('all eight native selected ties survive; no artificial three/eight clamp',()=>{
  const s=current(),fixture={...s,provided:{...s.provided,ties:{...s.provided.ties,count:8}}};
  const g=build(fixture);assert.equal(g.ties.length,8);near(g.ledger.tiePitchMm,2*s.input.depthMm/27);
});
test('independent sloping-face normal cover and end/side envelopes are satisfied',()=>{
  for(const tipHeightMm of [250,400,500]){
    const s=current({...DEFAULT_CORBEL_INPUT,tipHeightMm}),g=build(s),{h,h2,L,c,b}=g.dimensions,k=(h-h2)/L;
    assert.ok(g.renderable);
    for(const t of g.ties)for(const [x,y,z] of t.points){
      assert.ok((h-k*x-y)/Math.hypot(1,k)>=c+t.radiusMm-1e-7);
      assert.ok(x+t.radiusMm<=L-c+1e-7);assert.ok(Math.abs(z)+t.radiusMm<=b/2-c+1e-7);
    }
  }
});
test('explicit 90-degree main bends preserve nominal inside diameter, tails and support cover',()=>{
  const s=current(DEFAULT_CORBEL_INPUT,full),g=build(s);
  assert.equal(g.status,'GEOMETRY CANDIDATE');assert.equal(g.main.length,s.provided.main.count);
  for(const bar of g.main){assert.ok(bar.supportHook&&bar.noseHook);near(bar.points[0][0],-200);near(bar.points[0][1],70+42+15);near(bar.points.at(-1)[1],70+42+15);
    const supportArc=bar.points.slice(1,38);for(const p of supportArc)near(Math.hypot(p[0]-(-200+42),p[1]-(70+42)),42);
  }
  for(const t of g.ties){assert.ok(t.closed);assert.deepEqual(t.points[0],t.points.at(-1));near(t.bendCenterRadiusMm,(36+t.diameterMm)/2);}
  assert.equal(g.anchorageVerified,false);assert.equal(g.constructionAuthorized,false);
});
test('actual nose/support hook clashes cannot silently become a successful detailing status',()=>{
  for(const patch of [{detailSupportWidth:200},{detailSupportDepth:150},{detailNoseTail:200}]){
    const s=current(DEFAULT_CORBEL_INPUT,{...full,...patch}),g=build(s);
    assert.equal(s.verdict,'pass');assert.equal(g.status,'DETAIL HOLD');assert.ok(g.issues.some(i=>i.code.includes('CLASH')));
  }
});
test('bar-to-bar congestion blocks the proposed cage, without changing local strength checks',()=>{
  const s=current(DEFAULT_CORBEL_INPUT,{...full,detailSupportTail:144}),g=build(s);
  assert.equal(s.verdict,'pass');assert.ok(g.errors.some(i=>i.code==='BAR_CLASH'));assert.equal(g.renderable,false);assert.equal(g.main.length,0);
});
test('invalid actual h-d cover is held, rather than moved by renderer clamps',()=>{
  const s=current(),g=build({...s,input:{...s.input,depthMm:490}});
  assert.equal(g.renderable,false);assert.ok(g.errors.some(i=>i.code==='MAIN_COVER'));
});
test('stale/running/FAIL close 3D; FAIL drawings retain checked rejected evidence only',()=>{
  const s=current();for(const state of [{dirty:true},{runState:'running'},{runState:'error'}])assert.equal(build(s,state).main.length,0);
  const failed=current({...DEFAULT_CORBEL_INPUT,heightMm:300,depthMm:240,tipHeightMm:150,lengthMm:200});
  assert.equal(failed.verdict,'fail');assert.equal(build(failed).main.length,0);
  const svg=section(selectCorbelViewModel(failed,{runState:'ready'}));assert.ok(svg.includes('CHECKED / REJECTED'));assert.ok(svg.includes('data-front-main='));
  assert.ok(svg.includes('data-support-anchor-verified="false"'));assert.ok(svg.includes('NOT FOR CONSTRUCTION'));
});
test('side/front/plan drawings consume same actual geometry, bearing/load datums and snapshot',()=>{
  const s=current(DEFAULT_CORBEL_INPUT,full),g=build(s),svg=section(selectCorbelViewModel(s,{runState:'ready'}));
  assert.equal((svg.match(/data-front-main=/g)||[]).length,g.main.length);
  assert.equal((svg.match(/data-front-tie=/g)||[]).length,g.ties.length*2);
  assert.equal((svg.match(/data-ah-layer=/g)||[]).length,g.ties.length);
  assert.ok(svg.includes('data-closed="true"'));assert.ok(svg.includes(s.presentation.snapshotId));assert.ok(svg.includes('data-rebar-label="As"'));assert.ok(svg.includes('data-rebar-label="Ah"'));
  for(const datum of ['data-section-member="support-beam" data-top-mm="0"','data-section-member="corbel" data-top-mm="0" data-tip-mm="450"','data-section-member="masonry" data-base-mm="0" data-outer-mm="450"','data-load-line="Vu-center"','data-load="Nu" data-origin="wall-tip"','data-dimension="c-anchor-zone"'])assert.ok(svg.includes(datum),datum);
  assert.ok(!section({...s,memberId:'<script>x</script>'}).includes('<script>'));
});
test('detail dimensions enter deep-frozen Snapshot identity, not Engine operands',()=>{
  const a=current(DEFAULT_CORBEL_INPUT,full),b=current(DEFAULT_CORBEL_INPUT,{...full,detailSupportTail:16});
  assert.notEqual(a.presentation.snapshotId,b.presentation.snapshotId);assert.deepEqual(a.checks,b.checks);assert.deepEqual(a.provided,b.provided);assert.deepEqual(a.input,b.input);
});
test('project v5 roundtrip and v1-v4 migration preserve legacy meaning; hostile imports reject',()=>{
  const html=readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8');
  const controls=new Map([...html.matchAll(/<(input|select)\b[^>]*\bid="([^"]+)"[^>]*>/g)].map(m=>[m[2],{id:m[2],type:m[0].includes('checkbox')?'checkbox':'number',value:'',checked:false,tagName:'INPUT',dispatchEvent(){}}]));
  const mode={dataset:{loadMode:'direct'},click(){}};let events=0;
  const ctx=vm.createContext({window:{CorbelRebarDetail:globalThis.CorbelRebarDetail,dispatchEvent(){events++;}},document:{getElementById:id=>controls.get(id),querySelector:()=>mode},Event:class{},console});
  const source=readFileSync(new URL('./corbel-project-inputs.js',import.meta.url),'utf8').split("  import('/concrete-project-store.mjs')")[0]+'})();';vm.runInContext(source,ctx);
  const api=ctx.window.SVCorbelProjectInputs;for(const id of FIELD_IDS)controls.get(id).value='150';
  controls.get('detailRebarPattern').value='reference-return';
  const v5=api.capture();assert.ok(api.validate(v5));assert.equal(v5.version,5);assert.equal(Object.keys(v5.fields).length,51);api.apply(v5);
  const v4={...v5,version:4,fields:Object.fromEntries(Object.entries(v5.fields).filter(([k])=>!VERTICAL_FIELDS.includes(k)))};assert.ok(api.validate(v4));assert.equal(Object.keys(v4.fields).length,39);api.apply(v4);for(const id of VERTICAL_FIELDS){const el=controls.get(id);assert.equal(el.type==='checkbox'?el.checked:el.value,el.type==='checkbox'?false:'');}assert.equal(controls.get('detailEmbed').value,'150');assert.equal(controls.get('detailRebarPattern').value,'reference-return');
  const v3={version:3,mode:'wall',fields:Object.fromEntries(Object.entries(v4.fields).filter(([k])=>k!=='detailRebarPattern'))};assert.ok(api.validate(v3));api.apply(v3);assert.equal(controls.get('detailRebarPattern').value,'legacy-90');
  const v2={version:2,mode:'wall',fields:Object.fromEntries(Object.entries(v3.fields).filter(([k])=>k!=='detailTieEmbed'))};assert.ok(api.validate(v2));api.apply(v2);assert.equal(controls.get('detailTieEmbed').value,'');assert.equal(controls.get('detailEmbed').value,'150');
  const v1={version:1,mode:'wall',fields:Object.fromEntries(Object.entries(v3.fields).filter(([k])=>!FIELD_IDS.includes(k)))};assert.ok(api.validate(v1));api.apply(v1);for(const id of FIELD_IDS)assert.equal(controls.get(id).value,'');assert.equal(events,5);assert.equal(controls.get('detailRebarPattern').value,'legacy-90');
  assert.equal(api.validate({...v3,authority:'IFC'}),false);assert.equal(api.validate({...v3,fields:{...v3.fields,detailEmbed:150}}),false);
  assert.equal(api.validate({...v3,fields:{...v3.fields,evil:'x'}}),false);
  assert.equal(api.validate({...v4,fields:{...v4.fields,detailRebarPattern:'fabricated-pattern'}}),false);
});
test('explicit Reset restores a complete trial, never borrows edited detailing values',()=>{
  const html=readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8');
  const start=html.indexOf('      const initial='),end=html.indexOf('      if(!window.THREE)',start),controls=new Map();
  const get=id=>{if(!controls.has(id))controls.set(id,{value:'144',textContent:'',events:{},addEventListener(t,fn){this.events[t]=fn;}});return controls.get(id);};
  const ctx=vm.createContext({$:get,window:{CorbelRebarDetail:{FIELD_IDS,TRIAL_DETAILS}},document:{body:{dataset:{},classList:{remove(){}}},querySelector:()=>({disabled:false})},setLoadMode(){},setStep(){},setWorkView(){},update(){}});
  vm.runInContext(html.slice(start,end),ctx);get('resetBtn').events.click();
  for(const id of FIELD_IDS)assert.equal(get(id).value,TRIAL_DETAILS[id]);assert.equal(get('detailRebarPattern').value,'reference-return');assert.equal(get('fc').value,24);assert.equal(get('height').value,500);assert.equal(get('tipHeight').value,350);assert.equal(ctx.document.body.dataset.runState,'idle');
});
test('Owner reference has one continuous soffit return per As and a separate transverse Anchor; no Engine credit',()=>{
  for(const tipHeightMm of [350,400,500]){
    const input={...DEFAULT_CORBEL_INPUT,tipHeightMm},native=designCorbel(input),s=createCorbelResultSnapshot(native,{detailGeometry:TRIAL_DETAILS,detailRebarPattern:'reference-return'}),before=JSON.stringify(s),g=build(s),k=(500-tipHeightMm)/450;
    assert.equal(native.verdict,'pass');assert.equal(g.status,'GEOMETRY CANDIDATE');assert.equal(g.main.length,native.provided.main.count);assert.equal(g.ties.length,native.provided.ties.count);assert.equal(g.anchors.length,1);
    for(const bar of g.main){assert.equal(bar.supportReturn,true);assert.equal(bar.supportHook,false);near(bar.points[0][0],-250);near(bar.points[0][1],70);near(bar.points.at(-1)[0],-250);assert.ok(bar.points.at(-1)[1]>400);near(Math.hypot(bar.points.at(-1)[0]-bar.points.at(-2)[0],bar.points.at(-1)[1]-bar.points.at(-2)[1]),144);
      for(const [x,y,z] of bar.points){assert.ok(Math.abs(z)+6<=110+1e-7);assert.ok(y-6>=40);if(x>=0)assert.ok((500-k*x-y)/Math.hypot(1,k)>=46-1e-7);else {assert.ok(x-6>=-360);assert.ok(y+6<=660);}}
      const nose=g.ledger.referenceReturn.noseXMm,r=42;for(const p of bar.points.filter(p=>p[0]>=nose-r-1e-7&&p[1]<=112+1e-7))near(Math.hypot(p[0]-(nose-r),p[1]-112),r);
    }
    const a=g.anchors[0];assert.equal(a.diameterMm,native.provided.main.diameterMm);assert.equal(a.includedInAsAh,false);assert.equal(a.connectionVerified,false);near(a.points[0][0],g.ledger.referenceReturn.noseXMm-12);near(a.points[0][1],124);near(a.points[0][1],a.points[1][1]);near(a.points[0][0],a.points[1][0]);
    assert.deepEqual(s.provided,native.provided);assert.deepEqual(s.checks,native.checks);assert.equal(JSON.stringify(s),before);assert.equal(g.constructionAuthorized,false);assert.equal(g.anchorageVerified,false);assert.ok(Object.isFrozen(g.anchors[0].points[0]));
  }
});
test('reference geometry holds impossible return/tail/cover without altering the native PASS',()=>{
  for(const patch of [{detailNoseTail:170},{detailSupportDepth:400},{detailSupportTail:300},{detailMainBend:220}]){
    const s=createCorbelResultSnapshot(designCorbel({...DEFAULT_CORBEL_INPUT,tipHeightMm:350}),{detailGeometry:{...TRIAL_DETAILS,...patch},detailRebarPattern:'reference-return'}),g=build(s);
    assert.equal(s.verdict,'pass');assert.equal(g.status,'DETAIL HOLD');assert.ok(g.errors.length);assert.equal(g.main.length,0);assert.equal(g.ties.length,0);assert.equal(g.anchors.length,0);
  }
});
test('reference CAD uses the same Anchor and upper/return cuts without doubling selected As',()=>{
  const s=createCorbelResultSnapshot(designCorbel({...DEFAULT_CORBEL_INPUT,tipHeightMm:350}),{detailGeometry:TRIAL_DETAILS,detailRebarPattern:'reference-return'}),g=build(s),cad=section(s);
  assert.equal((cad.match(/data-front-main=/g)||[]).length,3);assert.equal((cad.match(/data-front-return=/g)||[]).length,3);assert.equal((cad.match(/data-side-anchor=/g)||[]).length,1);assert.equal((cad.match(/data-plan-anchor=/g)||[]).length,1);assert.ok(cad.includes('data-rebar-pattern="reference-return"'));assert.ok(cad.includes('ขากลับ Aₛ เส้นเดิม'));assert.ok(cad.includes('165.6'));assert.ok(cad.includes('ไม่เพิ่มพื้นที่ Aₛ/Aₕ'));assert.equal(g.main.length,3);
  const legacy=current({...DEFAULT_CORBEL_INPUT,tipHeightMm:350},TRIAL_DETAILS);assert.equal(build(legacy).pattern,'legacy-90');assert.equal(build(legacy).anchors.length,0);assert.ok(!section(legacy).includes('data-front-return='));assert.notEqual(s.presentation.snapshotId,legacy.presentation.snapshotId);assert.deepEqual(s.provided,legacy.provided);
  for(const state of [{dirty:true},{runState:'running'},{runState:'error'}])assert.equal(build(s,state).anchors.length,0);
});
test('actual Three mesh has 3 selected As, 3 selected Ah and one separately identified Anchor',()=>{
  const html=readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8'),s=createCorbelResultSnapshot(designCorbel({...DEFAULT_CORBEL_INPUT,tipHeightMm:350}),{detailGeometry:TRIAL_DETAILS,detailRebarPattern:'reference-return'});
  const ctx=vm.createContext({console,stage:{dataset:{}},window:{CorbelRebarDetail:globalThis.CorbelRebarDetail,getCorbelResultSnapshot:()=>s}});vm.runInContext(readFileSync(new URL('./Concrete-design/three.min.js',import.meta.url),'utf8'),ctx);
  ctx.mat={blue:new ctx.THREE.MeshStandardMaterial(),violet:new ctx.THREE.MeshStandardMaterial(),sideBar:new ctx.THREE.MeshStandardMaterial()};vm.runInContext(html.slice(html.indexOf('      function supportGeometry('),html.indexOf('      window.applyLayerVisibility='))+'\nglobalThis.addCage=addCorbelRebarCage;',ctx);
  const group=new ctx.THREE.Group();ctx.addCage(group,.45,.5,.3,s);assert.equal(group.children.length,7);assert.equal(group.children.filter(m=>m.userData.role==='As').length,3);assert.equal(group.children.filter(m=>m.userData.role==='Ah').length,3);assert.equal(group.children.filter(m=>m.userData.role==='Anchor').length,1);assert.equal(ctx.stage.dataset.supportReturnCount,'3');assert.equal(ctx.stage.dataset.supportHookCount,'0');assert.equal(ctx.stage.dataset.anchorBars,'1');assert.equal(ctx.stage.dataset.rebarPattern,'reference-return');assert.equal(ctx.stage.dataset.beamBars,'0');
  for(const mesh of group.children){near(mesh.geometry.parameters.radius,mesh.userData.role==='Ah'?.0045:.006);assert.equal(mesh.userData.snapshotId,s.presentation.snapshotId);assert.equal(mesh.userData.constructionAuthorized,false);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
});
test('actual Three.js cage uses nominal tube radii, all selected bars and no invented support steel',()=>{
  const html=readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8');let s=current(DEFAULT_CORBEL_INPUT,full);
  const ctx=vm.createContext({console,stage:{dataset:{}},window:{CorbelRebarDetail:globalThis.CorbelRebarDetail,getCorbelResultSnapshot:()=>s}});
  vm.runInContext(readFileSync(new URL('./Concrete-design/three.min.js',import.meta.url),'utf8'),ctx);
  ctx.mat={blue:new ctx.THREE.MeshStandardMaterial(),violet:new ctx.THREE.MeshStandardMaterial()};
  const source=html.slice(html.indexOf('      function supportGeometry('),html.indexOf('      window.applyLayerVisibility='));
  vm.runInContext(source+'\nglobalThis.addCage=addCorbelRebarCage;',ctx);
  const group=new ctx.THREE.Group(),before=JSON.stringify(s);ctx.addCage(group,.45,.5,.3,s);
  assert.equal(group.children.length,s.provided.main.count+s.provided.ties.count);assert.equal(ctx.stage.dataset.beamBars,'0');
  for(const mesh of group.children){const source=mesh.userData.role==='As'?s.provided.main:s.provided.ties;near(mesh.geometry.parameters.radius,source.diameterMm/2000);assert.equal(mesh.userData.snapshotId,s.presentation.snapshotId);assert.equal(mesh.userData.constructionAuthorized,false);assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
  assert.equal(JSON.stringify(s),before);
  s=current(DEFAULT_CORBEL_INPUT,{...full,detailSupportTail:144});const rejected=new ctx.THREE.Group();ctx.addCage(rejected,.45,.5,.3,s);assert.equal(rejected.children.length,0);assert.equal(ctx.stage.dataset.rebarStatus,'detail-hold');assert.equal(ctx.stage.dataset.supportAnchor,'detail-hold');
});
