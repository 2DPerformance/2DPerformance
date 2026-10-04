import {fitCameraToBounds} from './cameraControls.mjs?rwv=20261001-component-camera-1';

// Camera transitions are independent of geometry/results and yield to direct manipulation.
export function mountCameraTransition(camera,controls,canvas,{invalidate=()=>{}}={}){
  const motion=matchMedia('(prefers-reduced-motion:reduce)');let transition=null;
  const state=()=>({position:camera.position.clone(),target:controls.target.clone(),up:camera.up.clone()});
  const apply=s=>{camera.position.copy(s.position);controls.target.copy(s.target);camera.up.copy(s.up);camera.lookAt(controls.target);};
  const cancel=()=>{transition=null;};controls.addEventListener('start',cancel);canvas.addEventListener('wheel',cancel,{capture:true,passive:true});
  const keyCancel=e=>{if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&['+','=','-','_','f','F','Home','0','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))cancel();};canvas.addEventListener('keydown',keyCancel,true);
  const changed=()=>{if(motion.matches&&transition){const t=transition;transition=null;apply(t.to);controls.update();t.done?.();invalidate();}};motion.addEventListener('change',changed);
  return{run(action,done){cancel();const from=state();const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;apply(from);action();const to=state();if(motion.matches){done?.();invalidate();return;}apply(from);transition={from,to,start:performance.now(),done};invalidate();},
    update(time){if(!transition)return false;const t=transition,k=Math.min(1,Math.max(0,(time-t.start)/220)),ease=1-(1-k)**3;camera.position.copy(t.from.position).lerp(t.to.position,ease);controls.target.copy(t.from.target).lerp(t.to.target,ease);camera.up.copy(t.from.up).lerp(t.to.up,ease).normalize();camera.lookAt(controls.target);if(k===1){transition=null;t.done?.();}return true;},
    cancel,get active(){return!!transition;},dispose(){cancel();controls.removeEventListener('start',cancel);canvas.removeEventListener('wheel',cancel,true);canvas.removeEventListener('keydown',keyCancel,true);motion.removeEventListener('change',changed);}};
}

// OrbitControls r160 reports every infinitesimal damped pan as change (target delta >0).
// A 0.01mm world movement is below a display pixel; retain exact camera state but skip GPU work.
export function mountCameraRenderSignal(camera,controls,invalidate){
  let position=camera.position.clone(),target=controls.target.clone(),rotation=camera.quaternion.clone();
  const changed=()=>{if(position.distanceToSquared(camera.position)>1e-10||target.distanceToSquared(controls.target)>1e-10||1-Math.abs(rotation.dot(camera.quaternion))>1e-12){position.copy(camera.position);target.copy(controls.target);rotation.copy(camera.quaternion);invalidate();}};
  controls.addEventListener('change',changed);return{dispose(){controls.removeEventListener('change',changed);}};
}

export function mountSceneInteraction(THREE,{canvas,scene,camera,controls,model,zoom,invalidate=()=>{},transition,renderer}){
  const host=canvas.parentElement;host.classList.add('rw-scene-host');
  if(!document.querySelector('[data-rw-scene-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('./sceneInteraction.css?rwv=20261003-realistic-3d-1',import.meta.url).href;link.dataset.rwSceneStyle='';document.head.append(link);}
  const panel=document.createElement('div');panel.className='rw-scene-inspect';panel.dataset.selected='false';
  panel.innerHTML='<div class="rw-scene-caption"><strong data-member-label>คลิกเลือกชิ้นส่วน</strong><span data-member-size>ลากหมุน · คลิกขวาเลื่อน · สองนิ้วซูม</span></div><div class="rw-scene-actions"><button type="button" data-inspect-action="focus" disabled title="ซูมดูชิ้นส่วนที่เลือก">โฟกัส</button><button type="button" data-inspect-action="clear" disabled title="ยกเลิกการเลือก">ล้าง</button><button type="button" data-inspect-action="fullscreen" aria-pressed="false" title="เปิดโมเดลเต็มจอ">เต็มจอ</button></div>';
  panel.setAttribute('aria-label','เลือกและตรวจชิ้นส่วนโมเดล');panel.querySelector('.rw-scene-caption').setAttribute('aria-live','polite');host.append(panel);
  const label=panel.querySelector('[data-member-label]'),size=panel.querySelector('[data-member-size]'),full=panel.querySelector('[data-inspect-action="fullscreen"]'),ray=new THREE.Raycaster(),mouse=new THREE.Vector2();
  const helper=new THREE.Box3Helper(new THREE.Box3(),0x2479c6);helper.visible=false;helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.9;helper.renderOrder=100;helper.userData.rwPresentationOnly=true;scene.add(helper);
  let selected=null,down=null,disposed=false;const pointers=new Set();
  const visible=object=>{for(let p=object;p;p=p.parent)if(!p.visible)return false;return true;};
  const root=()=>typeof model==='function'?model():model;
  const clear=()=>{selected=null;helper.visible=false;panel.dataset.selected='false';label.textContent='คลิกเลือกชิ้นส่วน';size.textContent='ลากหมุน · คลิกขวาเลื่อน · สองนิ้วซูม';panel.querySelectorAll('[data-inspect-action]').forEach(b=>{if(b!==full)b.disabled=true;});invalidate();};
  const select=object=>{selected=object;helper.box.setFromObject(object);helper.visible=true;panel.dataset.selected='true';label.textContent=object.userData.rwMember.label;const p=object.geometry.parameters;
    size.textContent=p.radiusTop!=null?`Ø ${(p.radiusTop*2000).toFixed(0)} มม. · ยาว ${p.height.toFixed(2)} ม.`:p.radius!=null?`Ø ${(p.radius*2000).toFixed(0)} มม.`:p.width!=null?`${p.width.toFixed(2)} × ${p.height.toFixed(2)} × ${p.depth.toFixed(2)} ม.`:'รูปทรงตามขนาดที่กรอก';
    panel.querySelectorAll('[data-inspect-action]').forEach(b=>b.disabled=false);invalidate();};
  const focus=()=>{if(!selected)return;zoom.cancel();transition.run(()=>fitCameraToBounds(THREE,camera,controls,new THREE.Box3().setFromObject(selected),1.45));};
  const previousDescription=canvas.getAttribute('aria-description');canvas.setAttribute('aria-description',(previousDescription||'')+'; Enter เลือกชิ้นส่วนถัดไป; Shift+Enter ย้อนกลับ; Escape ล้างการเลือกหรือย่อเต็มจอ');
  const keyboardSelect=e=>{if(e.target!==canvas||!controls.enabled||e.ctrlKey||e.metaKey||e.altKey)return;if(e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();const members=[];root()?.traverse(o=>{if(o.userData.rwMember&&visible(o))members.push(o);});if(members.length){const index=members.indexOf(selected),next=(index+(e.shiftKey?-1:1)+members.length)%members.length;select(members[index<0?(e.shiftKey?members.length-1:0):next]);}}else if(e.key==='Escape'&&!document.fullscreenElement&&selected){e.preventDefault();clear();}};
  const pointerDown=e=>{pointers.add(e.pointerId);if(pointers.size>1||transition.active){down=null;return;}down=e.button===0?{id:e.pointerId,x:e.clientX,y:e.clientY}:null;};
  const pointerUp=e=>{pointers.delete(e.pointerId);const start=down;down=null;if(!start||start.id!==e.pointerId||pointers.size||Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)return;const rect=canvas.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);const hits=ray.intersectObject(root(),true),hit=hits.find(h=>h.object.userData.rwMember&&visible(h.object));if(hit)select(hit.object);else clear();};
  const cancelPointer=e=>{pointers.delete(e.pointerId);down=null;};
  const doubleClick=e=>{if(e.button===0&&selected)focus();};
  const fullscreenChanged=()=>{const active=document.fullscreenElement===host;full.setAttribute('aria-pressed',String(active));full.textContent=active?'ย่อจอ':'เต็มจอ';invalidate();};
  const escape=e=>{if(e.key==='Escape'&&document.fullscreenElement===host)document.exitFullscreen().catch(()=>{size.textContent='กดปุ่มย่อจอเพื่อกลับ';});};
  let contextText='',controlsEnabled=true;
  const contextLost=()=>{contextText=size.textContent;controlsEnabled=controls.enabled;controls.enabled=false;down=null;pointers.clear();transition.cancel();zoom.cancel();host.dataset.graphics='lost';size.textContent='ภาพ 3D หยุดชั่วคราว · กำลังรอระบบกราฟิกกลับมา';panel.querySelector('[data-inspect-action="focus"]').disabled=true;};
  const contextRestored=()=>{controls.enabled=controlsEnabled;host.dataset.graphics='ready';size.textContent=contextText;panel.querySelector('[data-inspect-action="focus"]').disabled=!selected;if(renderer)renderer.shadowMap.needsUpdate=true;invalidate();};
  const click=async e=>{const action=e.target.closest('[data-inspect-action]')?.dataset.inspectAction;if(action==='focus')focus();if(action==='clear')clear();if(action==='fullscreen'){try{if(document.fullscreenElement===host)await document.exitFullscreen();else if(host.requestFullscreen)await host.requestFullscreen();else throw Error('unsupported');}catch{size.textContent='เบราว์เซอร์นี้เปิดเต็มจอไม่ได้ · ใช้ปุ่ม Fit ได้';}}};
  canvas.addEventListener('pointerdown',pointerDown,true);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('dblclick',doubleClick);canvas.addEventListener('keydown',keyboardSelect);panel.addEventListener('click',click);document.addEventListener('fullscreenchange',fullscreenChanged);document.addEventListener('keydown',escape);canvas.addEventListener('webglcontextlost',contextLost);canvas.addEventListener('webglcontextrestored',contextRestored);
  return{clear,update(){if(selected&&(!selected.parent||!visible(selected)))clear();},dispose(){if(disposed)return;disposed=true;if(document.fullscreenElement===host)document.exitFullscreen().catch(()=>{});canvas.removeEventListener('pointerdown',pointerDown,true);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',cancelPointer);canvas.removeEventListener('dblclick',doubleClick);canvas.removeEventListener('keydown',keyboardSelect);canvas.removeEventListener('webglcontextlost',contextLost);canvas.removeEventListener('webglcontextrestored',contextRestored);if(previousDescription===null)canvas.removeAttribute('aria-description');else canvas.setAttribute('aria-description',previousDescription);panel.removeEventListener('click',click);document.removeEventListener('fullscreenchange',fullscreenChanged);document.removeEventListener('keydown',escape);panel.remove();scene.remove(helper);helper.geometry.dispose();helper.material.dispose();host.classList.remove('rw-scene-host');delete host.dataset.graphics;}};
}
