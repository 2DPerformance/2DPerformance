import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import './Concrete-design/corbel-engine.js';
import './Concrete-design/corbel-workbench-model.js';
import './corbel-rebar-detail.js';
import './corbel-cad-drawing.js';
const E=globalThis.CorbelDesign,M=globalThis.CorbelWorkbenchModel,G=globalThis.CorbelRebarDetail;
const input={...E.DEFAULT_CORBEL_INPUT,widthMm:300,heightMm:500,tipHeightMm:350,lengthMm:450,depthMm:430,coverMm:40,vuKg:129.948};
const current=(verticalDetail=G.VERTICAL_TRIAL,detailGeometry=G.TRIAL_DETAILS)=>M.createCorbelResultSnapshot(E.designCorbel(input),{createdAt:'2026-10-06T06:30:00Z',wallHeightM:2.8,detailRebarPattern:'reference-return',detailGeometry,verticalDetail});
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),clamp=v=>Math.max(0,Math.min(1,v));
// Independent minimization of the quadratic over a [0,1]^2 rectangle:
// evaluate all four edges and the stationary interior point, not the producer.
function distance(a,b,c,d){const u=sub(b,a),v=sub(d,c),w=sub(a,c),aa=dot(u,u),bb=dot(u,v),cc=dot(v,v),dd=dot(u,w),ee=dot(v,w),candidates=[[0,cc?clamp(ee/cc):0],[1,cc?clamp((bb+ee)/cc):0],[aa?clamp(-dd/aa):0,0],[aa?clamp((bb-dd)/aa):0,1]],det=aa*cc-bb*bb;
  if(det>1e-10){const t=(bb*ee-cc*dd)/det,s=(aa*ee-bb*dd)/det;if(t>=0&&t<=1&&s>=0&&s<=1)candidates.push([t,s]);}
  return Math.min(...candidates.map(([t,s])=>Math.hypot(...w.map((p,i)=>p+t*u[i]-s*v[i]))));}
function pointDistance(p,bar){return Math.min(...bar.points.slice(1).map((b,i)=>distance(p,p,bar.points[i],b)));}

test('manual groups follow different physical member axes; native trial and immutable strength remain exact',()=>{
  const s=current(),before=JSON.stringify(s),g=G.build(s),native=E.designCorbel(input);
  assert.equal(g.status,'GEOMETRY CANDIDATE');assert.deepEqual(g.errors,[]);assert.equal(g.verticalTies.length,3);assert.equal(g.supportTies.length,2);
  assert.deepEqual(g.ledger.vertical.corbel.centersMm,[50,200,350]);assert.deepEqual(g.ledger.vertical.support.centersMm,[-95,55]);
  assert.equal(g.ledger.vertical.corbel.orientation,'yz');assert.equal(g.ledger.vertical.support.orientation,'xy');
  for(const bar of g.verticalTies){assert.ok(bar.points.every(p=>p[0]===bar.centerXMm));near(bar.topYMm,44.5);near(bar.sideZMm,96.5);}
  for(const bar of g.supportTies){assert.ok(bar.points.every(p=>p[2]===bar.centerZMm));near(bar.backXMm,-355.5);near(bar.frontXMm,-44.5);near(bar.bottomYMm,655.5);}
  for(const bar of [...g.verticalTies,...g.supportTies]){assert.deepEqual(bar.points[0],bar.points.at(-1));near(bar.radiusMm,4.5);near(bar.bendCenterRadiusMm,22.5);for(const key of ['includedInAsAh','creditedInDesign','closureVerified','standardVerified'])assert.equal(bar[key],false);assert.equal(bar.diameterSource,'manual-demo');assert.ok(Object.isFrozen(bar.points[0]));}
  near(g.ledger.mainClearSpacingMm,70.48528137423857);near(g.ledger.engineAvailableClearMm,92);assert.equal(g.main.length,3);assert.equal(g.ties.length,3);assert.equal(g.anchors.length,1);
  assert.deepEqual(s.provided,native.provided);assert.deepEqual(s.required,native.required);assert.deepEqual(s.checks,native.checks);assert.equal(s.verdict,native.verdict);assert.ok(s.checks.every(c=>c.status==='pass'));assert.equal(JSON.stringify(s),before);assert.equal(g.constructionAuthorized,false);
});
test('independent nominal-capsule checks find no intersection and satisfy real sloping/beam/zone cover',()=>{
  const g=G.build(current()),manual=[...g.verticalTies,...g.supportTies],all=[...g.main,...g.ties,...g.anchors,...manual],normal=Math.hypot(1,1/3);
  for(const bar of manual){for(const p of bar.points){assert.ok(Math.abs(p[2])+4.5<=110+1e-7);assert.ok(p[1]-4.5>=40-1e-7);if(bar.role==='CorbelVertical')assert.ok((500-p[0]/3-p[1])/normal>=44.5-1e-7);else{assert.ok(p[0]-4.5>=-360-1e-7);assert.ok(p[0]+4.5<=-40+1e-7);assert.ok(p[1]+4.5<=660+1e-7);}}
    for(const other of all.filter(t=>t!==bar)){let minimum=Infinity;for(let i=1;i<bar.points.length;i++)for(let j=1;j<other.points.length;j++)minimum=Math.min(minimum,distance(bar.points[i-1],bar.points[i],other.points[j-1],other.points[j]));assert.ok(minimum>=bar.radiusMm+other.radiusMm-1e-6,`${bar.id}/${other.id} min${minimum}`);}
  }
});
test('unknown manual dimensions never borrow the demo, independently for both groups',()=>{
  for(const prefix of ['verticalCorbel','verticalSupport'])for(const name of ['Diameter','Pitch','Bend','Cover','Start']){const other=prefix==='verticalCorbel'?'verticalSupport':'verticalCorbel',s=current({...G.VERTICAL_TRIAL,[other+'Enabled']:false,[prefix+name]:''}),g=G.build(s);assert.equal(g.status,'DETAIL INCOMPLETE',prefix+name);assert.ok(g.issues.some(i=>i.code.endsWith('_UNKNOWN')));assert.equal(prefix==='verticalCorbel'?g.verticalTies.length:g.supportTies.length,0);assert.equal(s.verdict,'pass');}
  const g=G.build(current(G.VERTICAL_TRIAL,{...G.TRIAL_DETAILS,detailSupportDepth:''}));assert.equal(g.supportTies.length,0);assert.ok(g.issues.some(i=>i.code==='SUPPORT_VT_UNKNOWN'));
  const mixed=G.build(current({...G.VERTICAL_TRIAL,verticalSupportPitch:''}));assert.equal(mixed.status,'DETAIL INCOMPLETE');assert.equal(mixed.verticalTies.length,3);assert.equal(mixed.supportTies.length,0);
  // Without the unknown corbel diameter its nesting layer is unknown; real
  // remaining support/As collision must still HOLD, not become a demo fallback.
  const collision=G.build(current({...G.VERTICAL_TRIAL,verticalCorbelDiameter:''}));assert.equal(collision.status,'DETAIL HOLD');assert.ok(collision.issues.some(i=>i.code==='CORBEL_VT_UNKNOWN'));assert.ok(collision.errors.some(i=>i.code==='VERTICAL_CLASH'));assert.equal(collision.supportTies.length,0);
});
test('explicit pitches/starts/cover/bends fail closed when they clash or do not fit; strength is not modified',()=>{
  for(const patch of [{verticalCorbelStart:380},{verticalSupportStart:50},{verticalCorbelDiameter:40},{verticalSupportCover:210},{verticalCorbelBend:500},{verticalSupportBend:500},{verticalCorbelPitch:1},{verticalCorbelStart:0},{verticalSupportEnabled:'true'}]){const s=current({...G.VERTICAL_TRIAL,...patch}),g=G.build(s);assert.equal(g.status,'DETAIL HOLD',JSON.stringify(patch));assert.ok(g.errors.length);assert.equal([...g.main,...g.ties,...g.anchors,...g.verticalTies,...g.supportTies].length,0);assert.equal(s.verdict,'pass');assert.deepEqual(s.provided,E.designCorbel(input).provided);}
});
test('disabled/legacy groups preserve every original As/Ah/Anchor point and stale states hide both new groups',()=>{
  const original=G.build(current({})),disabled=G.build(current({...G.VERTICAL_TRIAL,verticalCorbelEnabled:false,verticalSupportEnabled:false}));
  for(const key of ['main','ties','anchors'])assert.deepEqual(disabled[key],original[key]);assert.equal(disabled.verticalTies.length+disabled.supportTies.length,0);
  for(const state of [{dirty:true},{runState:'running'},{runState:'error'}]){const g=G.build(current(),state);assert.equal(g.status,'LOCKED');assert.equal([...g.main,...g.ties,...g.anchors,...g.verticalTies,...g.supportTies].length,0);}
});
test('numbered CAD targets and cut dots lie on actual 3D bars; six readable views share one trace',()=>{
  const s=current(),g=G.build(s),cad=G.section(s),bars=[...g.main,...g.ties,...g.anchors,...g.verticalTies,...g.supportTies];assert.equal((cad.match(/data-cad-view=/g)||[]).length,6);
  for(const match of cad.matchAll(/data-steel-mark="(\d+)" data-steel-family="([^"]+)" data-target-bar="([^"]+)" data-target-mm="([^"]+)"/g)){const bar=bars.find(t=>t.id===match[3]);assert.ok(bar,match[3]);const p=match[4].split(',').map(Number);assert.ok(pointDistance(p,bar)<1e-6,`leader ${match[1]} ${bar.id} ${p}`);}
  const byId=Object.fromEntries(bars.map(b=>[b.id,b]));for(const m of cad.matchAll(/data-actual-cut-bar="([^"]+)" data-cut-point-mm="([^"]+)"/g)){const p=m[2].split(',').map(Number);assert.ok(pointDistance(p,byId[m[1]])<1e-6);}
  assert.equal((cad.match(/data-side-manual=/g)||[]).length,5);assert.equal((cad.match(/data-plan-manual=/g)||[]).length,5);assert.ok(cad.includes('data-cut-axis="x" data-cut-position-mm="50"'));assert.ok(cad.includes('data-cut-axis="z" data-cut-position-mm="55"'));assert.ok(cad.includes('ไม่มีข้อมูลเหล็กตามยาวคาน'));assert.ok(!cad.includes('NaN'));assert.ok(cad.includes('REVIEW / NOT FOR CONSTRUCTION'));
});
test('real Three.js mesh includes two manual roles with nominal radii and no authority or Engine credit',()=>{
  const html=fs.readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8'),s=current(),ctx=vm.createContext({console,stage:{dataset:{}},window:{CorbelRebarDetail:G,getCorbelResultSnapshot:()=>s}});vm.runInContext(fs.readFileSync(new URL('./Concrete-design/three.min.js',import.meta.url),'utf8'),ctx);ctx.mat=Object.fromEntries(['blue','violet','sideBar','verticalCorbel','verticalSupport'].map(k=>[k,new ctx.THREE.MeshStandardMaterial()]));vm.runInContext(html.slice(html.indexOf('      function supportGeometry('),html.indexOf('      window.applyLayerVisibility='))+'\nglobalThis.addCage=addCorbelRebarCage;',ctx);
  const group=new ctx.THREE.Group();ctx.addCage(group,.45,.5,.3,s);assert.equal(group.children.length,12);assert.equal(group.children.filter(m=>m.userData.role==='CorbelVertical').length,3);assert.equal(group.children.filter(m=>m.userData.role==='SupportVertical').length,2);assert.equal(ctx.stage.dataset.verticalCorbelTies,'3');assert.equal(ctx.stage.dataset.verticalSupportTies,'2');assert.equal(ctx.stage.dataset.beamBars,'0');
  for(const mesh of group.children){assert.equal(mesh.userData.creditedInDesign,false);assert.equal(mesh.userData.constructionAuthorized,false);if(mesh.userData.manualDetail){near(mesh.geometry.parameters.radius,.0045);assert.equal(mesh.geometry.parameters.closed,true);}assert.ok([...mesh.geometry.attributes.position.array].every(Number.isFinite));}
});
