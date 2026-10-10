// Camera presentation only. Distances never become engineering inputs.
export const wheelPixels = (event, pageHeight = 800) => event.deltaY
  * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1);

export class WheelZoomTarget {
  constructor() { this.target = null; }
  cancel() { this.target = null; }
  by(factor, current, min, max) {
    if (!(Number.isFinite(factor) && factor > 0)) return;
    this.target = Math.max(min, Math.min(max, (this.target ?? current) * factor));
  }
  queue(event, current, min, max, pageHeight) {
    const pixels = Math.max(-600, Math.min(600, wheelPixels(event, pageHeight)));
    this.by(Math.exp(pixels * .0014), current, min, max);
  }
  step(current, seconds, reducedMotion = false) {
    if (this.target === null) return current;
    const next = reducedMotion ? this.target : current + (this.target - current) * (1 - Math.exp(-Math.max(0, seconds) / .075));
    if (Math.abs(this.target - next) <= Math.max(.0001, this.target * .0001)) {
      const result = this.target; this.cancel(); return result;
    }
    return next;
  }
}

export function mountSmoothZoom(camera, controls, element, options = {}) {
  const zoom = new WheelZoomTarget(), offset = camera.position.clone();
  const reduced = () => !!element.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastTime = null;
  const onWheel = event => {
    if (!controls.enabled || !controls.enableZoom || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault(); event.stopImmediatePropagation();
    options.onInput?.();
    zoom.queue(event, camera.position.distanceTo(controls.target), controls.minDistance, controls.maxDistance, element.clientHeight || 800);
    if (reduced()) update(performance.now());
  };
  const cancel = () => { zoom.cancel(); lastTime = null; };
  const by = factor => {
    if (!controls.enabled || !controls.enableZoom || !(Number.isFinite(factor) && factor > 0)) return;
    options.onInput?.();
    zoom.by(factor, camera.position.distanceTo(controls.target), controls.minDistance, controls.maxDistance);
    if (reduced()) update(performance.now());
  };
  function update(time = performance.now()) {
    const seconds = lastTime === null ? 1 / 60 : Math.min(.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    if (zoom.target === null) return;
    zoom.target=Math.max(controls.minDistance,Math.min(controls.maxDistance,zoom.target));
    offset.copy(camera.position).sub(controls.target);
    const distance = offset.length();
    const next = zoom.step(distance, seconds, reduced());
    camera.position.copy(controls.target).addScaledVector(offset.normalize(), next);
  }
  // Keep OrbitControls enabled for native orbit, pan and touch/pinch.
  element.addEventListener('wheel', onWheel, {capture: true, passive: false});
  element.addEventListener('pointerdown', cancel, {capture: true});
  return {update, cancel, by, rescale(factor) { if(zoom.target!==null)zoom.target*=factor; }, get active() { return zoom.target !== null; }, dispose() {
    cancel(); element.removeEventListener('wheel', onWheel, true); element.removeEventListener('pointerdown', cancel, true);
  }};
}
