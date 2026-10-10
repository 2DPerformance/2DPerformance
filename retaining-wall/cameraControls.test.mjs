import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../vendor/three/three.module.js';
import {fitCameraToBounds,mountCameraKeys} from './cameraControls.mjs';

test('fit keeps the current viewing direction and contains all physical corners',()=>{
  const bounds=new THREE.Box3(new THREE.Vector3(-2,-8,-6),new THREE.Vector3(15,5,6));
  for(const aspect of [.4,1,2.4])for(const dir of [[.95,.65,1.1],[0,1.6,.001],[0,.08,1.6]]) {
    const camera=new THREE.PerspectiveCamera(36,aspect,.01,2000);
    const target=new THREE.Vector3(9,4,-2);camera.position.copy(target).add(new THREE.Vector3(...dir));
    const before=camera.position.clone().sub(target).normalize();
    const controls={target,update(){}};
    fitCameraToBounds(THREE,camera,controls,bounds);camera.updateMatrixWorld();
    assert.ok(camera.position.clone().sub(target).normalize().distanceTo(before)<1e-8);
    assert.ok(target.distanceTo(bounds.getCenter(new THREE.Vector3()))<1e-9,'fit recentres panned model');
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]) {
      const projected=new THREE.Vector3(x,y,z).project(camera);
      assert.ok(Math.abs(projected.x)<.86&&Math.abs(projected.y)<.86,'all corners fit with readable margin');
      assert.ok(projected.z>-1&&projected.z<1,'no clipping');
    }
  }
});

test('canvas shortcuts retain native arrows, ignore browser shortcuts and clean up',()=>{
  const canvas=new EventTarget(),attrs=new Map();
  canvas.getAttribute=k=>attrs.get(k)??null;canvas.setAttribute=(k,v)=>attrs.set(k,v);canvas.removeAttribute=k=>attrs.delete(k);
  let fit=0,reset=0,cancel=0,arrow=0,input=0;const factors=[];
  const native=e=>{if(e.key.startsWith('Arrow'))arrow++;};
  const controls={enabled:true,listenToKeyEvents(el){el.addEventListener('keydown',native);},stopListenToKeyEvents(){canvas.removeEventListener('keydown',native);}};
  const keys=mountCameraKeys(canvas,controls,{by:v=>factors.push(v),cancel(){cancel++;}},{fit(){fit++;},reset(){reset++;},onInput(){input++;}});
  const key=(value,extra={})=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key:value,...extra});canvas.dispatchEvent(e);return e;};
  key('+');key('-');key('f');key('Home');key('0');key('ArrowLeft');key('ArrowUp',{shiftKey:true});
  assert.deepEqual(factors,[.8,1.25]);assert.equal(fit,2);assert.equal(reset,1);assert.equal(arrow,2);assert.equal(cancel,2);assert.equal(input,7);
  assert.equal(key('+',{ctrlKey:true}).defaultPrevented,false);
  controls.enabled=false;key('f');assert.equal(fit,2);
  keys.dispose();assert.equal(canvas.getAttribute('tabindex'),null);assert.equal(canvas.getAttribute('aria-keyshortcuts'),null);
  controls.enabled=true;key('f');key('ArrowLeft');assert.equal(fit,2);assert.equal(arrow,2);
});
