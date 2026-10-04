// View-only controls shared by draft and calculated RW-01 scenes.
export function mountCameraViewState(camera, controls, onChange) {
  const frames=new Map();let current='custom';
  const changed=()=>{
    const direction=camera.position.clone().sub(controls.target).normalize(),up=camera.up.clone().normalize();
    const name=[...frames].find(([,frame])=>direction.dot(frame.direction)>.99999&&up.dot(frame.up)>.99999)?.[0]||'custom';
    if(name!==current){current=name;onChange?.(current);}
  };
  controls.addEventListener('change',changed);
  return {remember(name){frames.set(name,{direction:camera.position.clone().sub(controls.target).normalize(),up:camera.up.clone().normalize()});current=name;onChange?.(current);},
    get current(){return current;},dispose(){controls.removeEventListener('change',changed);}};
}

export function fitCameraToBounds(THREE, camera, controls, bounds, padding = 1.18) {
  if (!bounds || bounds.isEmpty()) return;
  const center = bounds.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  if (direction.lengthSq() < .5) direction.set(.95, .65, 1.1).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction);
  if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
  right.normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
  let distance = Math.max(1, camera.near * 2);
  for (const x of [bounds.min.x, bounds.max.x])
    for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).sub(center);
        distance = Math.max(distance, point.dot(direction)
          + padding * Math.max(Math.abs(point.dot(right)) / tanH, Math.abs(point.dot(up)) / tanV));
      }
  camera.position.copy(center).addScaledVector(direction, distance);
  controls.target.copy(center);
  camera.lookAt(center);
  controls.update();
}

export function mountCameraKeys(canvas, controls, zoom, actions) {
  const oldTabIndex = canvas.getAttribute('tabindex');
  const oldShortcuts = canvas.getAttribute('aria-keyshortcuts');
  canvas.setAttribute('tabindex', '0');
  canvas.setAttribute('aria-keyshortcuts', '+ - F Home 0 ArrowLeft ArrowRight ArrowUp ArrowDown');
  const onKey = event => {
    if (!controls.enabled || event.target !== canvas || event.isComposing || event.altKey) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      // Native OrbitControls handles pan / Shift+arrow orbit on this canvas.
      // Stop the legacy stage's preset-switch shortcut from also handling it.
      actions.onInput?.(); zoom.cancel(); event.preventDefault(); event.stopPropagation();
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    const command = ['+', '='].includes(event.key) ? () => zoom.by(.8)
      : ['-', '_'].includes(event.key) ? () => zoom.by(1.25)
        : ['f', 'F', 'Home'].includes(event.key) ? actions.fit
          : event.key === '0' ? actions.reset : null;
    if (!command) return;
    event.preventDefault(); event.stopImmediatePropagation(); actions.onInput?.(); command();
  };
  canvas.addEventListener('keydown', onKey);
  controls.listenToKeyEvents(canvas);
  return { dispose() {
    canvas.removeEventListener('keydown', onKey);
    controls.stopListenToKeyEvents();
    if (oldTabIndex === null) canvas.removeAttribute('tabindex'); else canvas.setAttribute('tabindex', oldTabIndex);
    if (oldShortcuts === null) canvas.removeAttribute('aria-keyshortcuts'); else canvas.setAttribute('aria-keyshortcuts', oldShortcuts);
  }};
}
