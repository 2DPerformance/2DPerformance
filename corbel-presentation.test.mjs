import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=fs.readFileSync(new URL('./corbel-design-mockup.html',import.meta.url),'utf8');
const controller=html.slice(html.indexOf('let queuedCorbelRunToken=0;'),html.indexOf('    function resetProductionUi()'));
class Control {
  constructor(){this.disabled=false;this.textContent='คำนวณและออกแบบอัตโนมัติ';this.attrs={};this.events={};this.value='';this.className='';}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k]??null;}removeAttribute(k){delete this.attrs[k];}
  addEventListener(type,fn){(this.events[type]??=[]).push(fn);}focus(){}closest(){return null;}
}
function harness() {
  const controls=new Map(),get=id=>{if(!controls.has(id))controls.set(id,new Control());return controls.get(id);};
  const frames=[],calls={begin:0,calculate:0,commit:0,render:0,fail:0};
  let load={ok:true,vuKg:129.948,mode:'wall',nucKg:25.9896},throws=false;
  const input=new Control();const ctx={$:get,document:{querySelectorAll:s=>s==='input:not(.layer),select'?[input]:[],querySelector:()=>get('section')},
    requestAnimationFrame:fn=>frames.push(fn),numberAt:()=>2.8,inputFromPage:()=>({vuKg:129.948}),
    calculateCorbel:()=>{calls.calculate++;if(throws)throw Error('test render failure');return {errors:[]};},
    renderResult:()=>calls.render++,currentResult:null,console:{error(){}},
    window:{beginCorbelRun:()=>calls.begin++,failCorbelRun:()=>calls.fail++,resolveCorbelLoadCase:()=>load,
      commitCorbelResultSnapshot:result=>{calls.commit++;return result;},setTimeout(){}},JSON};
  vm.createContext(ctx);vm.runInContext(controller+'\nglobalThis.run=runProductionDesign;',ctx);
  return {ctx,get,input,frames,calls,setLoad:v=>load=v,setThrows:()=>throws=true,flush:()=>{while(frames.length)frames.shift()();}};
}
test('trusted Calculate paints busy before one native Run and rejects duplicate clicks',()=>{
  const h=harness();h.ctx.run({isTrusted:true});h.ctx.run({isTrusted:true});
  assert.equal(h.calls.begin,1);assert.equal(h.calls.calculate,0);assert.equal(h.get('autoDesignBtn').disabled,true);
  assert.equal(h.get('autoDesignBtn').textContent,'กำลังคำนวณ…');assert.equal(h.frames.length,1);
  h.frames.shift()();assert.equal(h.calls.calculate,0);h.flush();
  assert.equal(h.calls.calculate,1);assert.equal(h.calls.commit,1);assert.equal(h.calls.render,1);
  assert.equal(h.get('autoDesignBtn').disabled,false);assert.equal(h.get('autoDesignBtn').getAttribute('aria-busy'),null);
});
test('AI and Open programmatic native Run retains synchronous contract',()=>{
  const h=harness();h.ctx.run({isTrusted:false});assert.equal(h.calls.commit,1);assert.equal(h.frames.length,0);
  h.ctx.run();assert.equal(h.calls.commit,2);
});
for(const type of ['input','change','reset'])test('pending Calculate is cancelled by '+type+' without creating a stale Snapshot',()=>{
  const h=harness();h.ctx.run({isTrusted:true});
  (type==='reset'?h.get('resetBtn').events.click:h.input.events[type]).forEach(fn=>fn());h.flush();
  assert.equal(h.calls.commit,0);assert.equal(h.calls.calculate,0);assert.equal(h.calls.fail,1);assert.equal(h.get('autoDesignBtn').disabled,false);
  h.ctx.run();assert.equal(h.calls.commit,1);
});
test('invalid load and unexpected exception both restore the busy control and fail closed',()=>{
  const h=harness();h.setLoad({ok:false,errors:[{field:'quickLoad',message:'invalid'}]});h.ctx.run();
  assert.equal(h.calls.fail,1);assert.equal(h.calls.commit,0);assert.equal(h.get('autoDesignBtn').disabled,false);
  const fail=harness();fail.setThrows();fail.ctx.run({isTrusted:true});fail.flush();
  assert.equal(fail.calls.fail,1);assert.equal(fail.calls.commit,0);assert.equal(fail.get('autoDesignBtn').getAttribute('aria-busy'),null);
});

test('materials and surface toggles never change native geometry or create result authority',()=>{
  const elements=new Map(),get=id=>{if(!elements.has(id))elements.set(id,new Control());return elements.get(id);};
  const fakeCanvas=()=>({width:0,height:0,getContext:()=>({fillRect(){},beginPath(){},arc(){},fill(){},moveTo(){},lineTo(){},stroke(){}})});
  const ctx={console,document:{createElement:()=>fakeCanvas(),querySelector:()=>({checked:true}),querySelectorAll:()=>[],getElementById:get}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('./Concrete-design/three.min.js',import.meta.url),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(new URL('./corbel-studio.js',import.meta.url),'utf8'),ctx);
  const T=ctx.THREE,scene=new T.Scene(),groups={wall:new T.Group(),rebar:new T.Group(),concrete:new T.Group(),load:new T.Group()};
  const originalBar=new T.Mesh(new T.CylinderGeometry(.011,.011,.4,14));groups.rebar.add(originalBar);
  const nativePositions=Array.from(originalBar.geometry.attributes.position.array),nativeUuid=originalBar.geometry.uuid;
  const materials=Object.fromEntries(['concrete','wall','blue','violet','sideBar','verticalCorbel','verticalSupport','columnBar','red'].map(k=>[k,new T.MeshStandardMaterial()]));materials.edge=new T.LineBasicMaterial();
  const canvas=new Control(),stage={dataset:{}},renderer={capabilities:{getMaxAnisotropy:()=>4},domElement:canvas};let draws=0;
  const studio=ctx.CorbelStudio.attach({THREE:T,renderer,scene,stage,groups,materials,requestRender:()=>draws++});
  assert.equal(materials.concrete.opacity,.25);assert.ok(materials.concrete.map);assert.ok(materials.blue.bumpMap);
  for(const id of ['corbelConcreteBtn','corbelSteelBtn','corbelWallBtn'])get(id).events.click.forEach(fn=>fn());
  assert.equal(materials.concrete.opacity,1);assert.equal(materials.concrete.depthWrite,true);assert.equal(groups.wall.visible,false);
  assert.equal(stage.dataset.steelPalette,'natural');assert.ok(draws>=4);studio.sync();
  assert.equal(groups.rebar.children.length,1);assert.equal(originalBar.geometry.uuid,nativeUuid);
  assert.deepEqual(Array.from(originalBar.geometry.attributes.position.array),nativePositions);
  assert.equal(ctx.CorbelDesign,undefined);assert.equal(ctx.getCorbelResultSnapshot,undefined);
});

test('two-pointer camera zoom/pan and cancellation release pointer state without touching results',()=>{
  const canvas=new Control();canvas.setPointerCapture=()=>{};
  const ctx={console,renderer:{domElement:canvas},window:{},spherical:{theta:.75,phi:1.12,radius:3},draws:0,applyCamera(){ctx.draws++;}};
  vm.createContext(ctx);vm.runInContext(fs.readFileSync(new URL('./Concrete-design/three.min.js',import.meta.url),'utf8'),ctx);
  ctx.target=new ctx.THREE.Vector3(.2,1.2,0);ctx.camera=new ctx.THREE.PerspectiveCamera();
  const source=html.slice(html.indexOf('let drag=false,px=0,py=0;'),html.indexOf('      window.focusCorbelDetail='));
  vm.runInContext(source,ctx);
  const send=(type,id,x,y)=>canvas.events[type].forEach(fn=>fn({pointerId:id,clientX:x,clientY:y,buttons:1,preventDefault(){}}));
  send('pointerdown',1,100,100);send('pointerdown',2,200,100);
  send('pointermove',1,50,120);send('pointermove',2,250,120);
  assert.ok(ctx.spherical.radius<2);assert.equal(ctx.spherical.theta,.75);assert.equal(ctx.spherical.phi,1.12);
  assert.notEqual(ctx.target.y,1.2);
  send('pointercancel',1,50,120);send('pointermove',2,260,120);assert.notEqual(ctx.spherical.theta,.75);
  send('lostpointercapture',2,260,120);const draws=ctx.draws;send('pointermove',2,290,160);assert.equal(ctx.draws,draws);
  assert.equal(ctx.currentResult,undefined);assert.equal(ctx.window.constructionAuthorized,undefined);
});
