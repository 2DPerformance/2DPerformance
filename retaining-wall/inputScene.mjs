import { inputGeometry } from './inputGeometry.mjs?rwv=20261003-main-equations-1';
import { mountSmoothZoom } from './smoothZoom.mjs?rwv=20261001-component-camera-1';
import { fitCameraToBounds, mountCameraKeys, mountCameraViewState } from './cameraControls.mjs?rwv=20261001-component-camera-1';
import {mountSceneAppearance} from './sceneAppearance.mjs?rwv=20261003-realistic-3d-1';
import {mountSceneInteraction,mountCameraTransition,mountCameraRenderSignal} from './sceneInteraction.mjs?rwv=20261003-realistic-3d-1';
export function mountInputScene(stage,toolbar){
  const canvas=stage.querySelector('canvas'),note=stage.querySelector('.rw-model-note');
  let runtime=null,pending=null,visible=true,spin=false,updateTimer=0;
  async function start(){
    try{
      const [THREE,{OrbitControls},{stayBeamTransform}]=await Promise.all([import('/vendor/three/three.module.js'),import('/vendor/three/addons/controls/OrbitControls.js'),import('./systems3d.mjs?rwv=20261003-realistic-3d-1')]);
      if(!stage.isConnected)return;
      const scene=new THREE.Scene();scene.background=new THREE.Color(0xf4f7fb);
      scene.add(new THREE.HemisphereLight(0xfefeff,0x667b91,2.4));const sun=new THREE.DirectionalLight(0xffffff,2.3);sun.position.set(-6,12,8);scene.add(sun);
      const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));
      const camera=new THREE.PerspectiveCamera(36,1,.01,2000),controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.autoRotateSpeed=.8;
      const mats=Object.fromEntries(Object.entries({base:0x91a7bf,cap:0xa6b8c9,wall:0xc0ccda,rib:0x708da9,pile:0x36536e,strap:0x295e87,soil:0xcbb78f,ground:0xb8a47d,boundary:0xc36638}).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:.87,transparent:['soil','ground'].includes(key),opacity:key==='soil'?.17:key==='ground'?.58:1,depthWrite:!['soil','ground'].includes(key),side:key==='ground'?THREE.DoubleSide:THREE.FrontSide})]));
      const appearance=mountSceneAppearance(THREE,scene,renderer);let dirty=true;const invalidate=()=>{dirty=true;};
      const edge=new THREE.LineBasicMaterial({color:0x29445e,transparent:true,opacity:.68});let model=new THREE.Group();scene.add(model);
      let radius=5,center=new THREE.Vector3(),bounds=null,view='iso',raf=0,shapeStamp='',lastType='',cameraReady=false,transition=null,lastWidth=0,lastHeight=0;
      const stopSpin=()=>{transition=null;spin=false;controls.autoRotate=false;toolbar.querySelector('[data-spin]').setAttribute('aria-pressed','false');toolbar.querySelector('[data-spin]').textContent='▶ หมุน';};
      const zoom=mountSmoothZoom(camera,controls,canvas,{onInput:stopSpin});
      const cameraMotion=mountCameraTransition(camera,controls,canvas,{invalidate});
      const interaction=mountSceneInteraction(THREE,{canvas,scene,camera,controls,renderer,model:()=>model,zoom,invalidate,transition:cameraMotion});
      const cameraSignal=mountCameraRenderSignal(camera,controls,invalidate);
      const viewState=mountCameraViewState(camera,controls,name=>toolbar.querySelectorAll('[data-camera]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===name))));
      const motion=matchMedia('(prefers-reduced-motion:reduce)'),onMotion=()=>{if(motion.matches)stopSpin();controls.enableDamping=!motion.matches;toolbar.querySelector('[data-spin]').disabled=motion.matches;};
      motion.addEventListener('change',onMotion);
      function fitDistance(direction,aspect=camera.aspect){
        // Fit the physical model, excluding the presentation grid, to both axes.
        const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right);
        const tanV=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),tanH=tanV*aspect;
        let distance=1;
        if(bounds)for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
          const point=new THREE.Vector3(x,y,z).sub(center),depth=point.dot(direction);
          distance=Math.max(distance,depth+Math.max(Math.abs(point.dot(right))/tanH,Math.abs(point.dot(up))/tanV)*1.18);
        }
        return distance;
      }
      function setViewNow(next='iso'){
        stopSpin();view=next;transition=null;zoom.cancel();
        const direction=new THREE.Vector3(...({iso:[.95,.65,1.1],plan:[0,1.6,.001],section:[0,.08,1.6]}[view])).normalize();
        camera.position.copy(center).addScaledVector(direction,fitDistance(direction));controls.target.copy(center);camera.lookAt(center);controls.update();invalidate();
        viewState.remember(view);
      }
      function setView(next='iso'){cameraMotion.run(()=>setViewNow(next),()=>viewState.remember(next));}
      function fit(){stopSpin();zoom.cancel();cameraMotion.run(()=>fitCameraToBounds(THREE,camera,controls,bounds));}
      const keys=mountCameraKeys(canvas,controls,zoom,{fit,reset:()=>setView('iso'),onInput:stopSpin});
      function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h||w===lastWidth&&h===lastHeight)return;lastWidth=w;lastHeight=h;renderer.setSize(w,h,false);
        const oldAspect=camera.aspect,offset=camera.position.clone().sub(controls.target),direction=offset.clone().normalize();
        transition=null;cameraMotion.cancel();
        camera.aspect=w/h;camera.updateProjectionMatrix();
        if(cameraReady){const factor=fitDistance(direction)/fitDistance(direction,oldAspect);camera.position.copy(controls.target).add(offset.multiplyScalar(factor));zoom.rescale(factor);}
        renderer.render(scene,camera);
      }
      const observer=new ResizeObserver(resize);observer.observe(stage);
      function disposeModel(){model.traverse(o=>{o.geometry?.dispose();if(o.userData.previewGrid){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});}
      function update(type,input){const data=inputGeometry(type,input),nextStamp=JSON.stringify([type,data.parts]);note.textContent=data.note;if(nextStamp===shapeStamp)return;shapeStamp=nextStamp;const typeChanged=lastType!==type;lastType=type;
        const oldCenter=controls.target.clone(),panOffset=oldCenter.clone().sub(center),offset=camera.position.clone().sub(oldCenter),direction=offset.clone().normalize();
        interaction.clear();cameraMotion.cancel();disposeModel();scene.remove(model);model=new THREE.Group();scene.add(model);
        for(const part of data.parts){let geometry,mesh;
          if(part.polygon){const shape=new THREE.Shape();part.polygon.forEach(([x,y],k)=>k?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();geometry=new THREE.ExtrudeGeometry(shape,{depth:part.depth,bevelEnabled:false});mesh=new THREE.Mesh(geometry,mats[part.kind]);mesh.position.z=part.z;}
          else if(part.member){geometry=new THREE.BoxGeometry(part.member.length,part.member.depth,part.member.width);mesh=new THREE.Mesh(geometry,mats[part.kind]);const t=stayBeamTransform(THREE,part.member);mesh.position.copy(t.position);mesh.quaternion.copy(t.quaternion);}
          else if(part.line){const a=new THREE.Vector3(...part.line[0]),b=new THREE.Vector3(...part.line[1]),v=b.clone().sub(a);geometry=new THREE.CylinderGeometry(part.diameter/2,part.diameter/2,v.length(),12);mesh=new THREE.Mesh(geometry,mats[part.kind]);mesh.position.copy(a.add(b).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());}
          else{geometry=new THREE.BoxGeometry(...part.size);mesh=new THREE.Mesh(geometry,mats[part.kind]);mesh.position.set(...part.position);}
          appearance.dress(mesh,part.kind,{steel:type==='soldier'&&['pile','strap'].includes(part.kind),label:part.kind==='strap'?(part.member?'คานสเตย์':part.line?'สมอยึดดิน':'คานเชื่อม'):type==='duckfoot'&&part.kind==='cap'?'ฐานรากตีนเป็ด':undefined});model.add(mesh);if(!['soil','ground'].includes(part.kind)){const lines=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),edge);lines.position.copy(mesh.position);lines.quaternion.copy(mesh.quaternion);model.add(lines);}
        }
        const box=new THREE.Box3().setFromObject(model);bounds=box.clone();appearance.update(bounds);invalidate();center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());radius=Math.max(size.x,size.y,size.z);
        controls.minDistance=Math.max(.15,radius*.025);controls.maxDistance=Math.max(fitDistance(direction),fitDistance(new THREE.Vector3(.95,.65,1.1).normalize()))*8;
        const grid=new THREE.GridHelper(Math.max(size.x,size.z)*1.6,20,0xa5b6c9,0xe0e7ef);grid.userData.previewGrid=true;grid.position.set(center.x,box.min.y-.03,center.z);model.add(grid);
        stage.dataset.ready='true';toolbar.querySelectorAll('button').forEach(button=>{button.disabled=button.hasAttribute('data-spin')&&matchMedia('(prefers-reduced-motion:reduce)').matches;});resize();
        if(!cameraReady||typeChanged){cameraReady=true;setViewNow(view);}
        // Editing dimensions preserves world scale and the user's zoom; Fit is an explicit action.
        else{const nextTarget=center.clone().add(panOffset),targetPosition=nextTarget.clone().add(offset);
          if(zoom.active||matchMedia('(prefers-reduced-motion:reduce)').matches){camera.position.copy(targetPosition);controls.target.copy(nextTarget);transition=null;}
          else transition={fromPosition:camera.position.clone(),toPosition:targetPosition,fromTarget:oldCenter,toTarget:nextTarget,start:performance.now()};}
      }
      function frame(time){if(visible&&!window.frameElement?.hidden&&document.visibilityState!=='hidden'){if(transition){const t=Math.min(1,(performance.now()-transition.start)/180),k=t*t*(3-2*t);camera.position.copy(transition.fromPosition).lerp(transition.toPosition,k);controls.target.copy(transition.fromTarget).lerp(transition.toTarget,k);if(t===1)transition=null;}const moving=cameraMotion.update(time),zooming=zoom.update(time);controls.autoRotate=spin&&!transition&&!matchMedia('(prefers-reduced-motion:reduce)').matches;controls.enableDamping=!matchMedia('(prefers-reduced-motion:reduce)').matches;const changed=controls.update();interaction.update();if(dirty||moving||zooming||spin||transition){renderer.render(scene,camera);dirty=false;}}raf=requestAnimationFrame(frame);}frame();
      canvas.addEventListener('pointerdown',stopSpin);
      runtime={update,setView,fit,zoomBy:factor=>zoom.by(factor),dispose(){cancelAnimationFrame(raf);interaction.dispose();cameraMotion.dispose();appearance.dispose();cameraSignal.dispose();observer.disconnect();motion.removeEventListener('change',onMotion);viewState.dispose();keys.dispose();zoom.dispose();canvas.removeEventListener('pointerdown',stopSpin);controls.dispose();disposeModel();Object.values(mats).forEach(m=>m.dispose());edge.dispose();renderer.dispose();}};
      if(pending)runtime.update(...pending);
    }catch(error){stage.dataset.ready='false';note.textContent='เปิดโมเดล 3D ไม่สำเร็จ · ใช้ Plan / Section ประกอบได้';console.error(error);}
  }
  toolbar.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||button.disabled)return;const view=button.dataset.camera;if(view){spin=false;runtime?.setView(view);}const action=button.dataset.cameraAction;if(action==='in')runtime?.zoomBy(.8);if(action==='out')runtime?.zoomBy(1.25);if(action==='fit')runtime?.fit();if(action==='reset'){spin=false;runtime?.setView('iso');}if(button.hasAttribute('data-spin'))spin=!spin;toolbar.querySelector('[data-spin]').setAttribute('aria-pressed',String(spin));toolbar.querySelector('[data-spin]').textContent=spin?'Ⅱ หยุด':'▶ หมุน';});
  start();window.addEventListener('pagehide',e=>{if(!e.persisted){clearTimeout(updateTimer);runtime?.dispose();}},{once:true});
  return{update(type,input){pending=[type,input];clearTimeout(updateTimer);updateTimer=setTimeout(()=>runtime?.update(...pending),75);},setVisible(value){visible=value;}};
}
