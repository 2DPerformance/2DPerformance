import test from 'node:test';
import assert from 'node:assert/strict';
import {WheelZoomTarget, wheelPixels} from './smoothZoom.mjs?rwv=20260930-load-units-1';

test('equivalent wheel pixel/line/page gestures reach the same distance', () => {
  const distances = [{deltaY: 120, deltaMode: 0}, {deltaY: 7.5, deltaMode: 1}, {deltaY: .15, deltaMode: 2}].map(event => {
    const zoom = new WheelZoomTarget(); zoom.queue(event, 20, 1, 100, 800); return zoom.step(20, 1, true);
  });
  assert.ok(distances.every(d => Math.abs(d - distances[0]) < 1e-9));
  assert.equal(wheelPixels({deltaY: 1, deltaMode: 0}), 1, 'trackpad precision preserved');
});
test('wheel zoom is continuous, frame-rate independent and stops at its target', () => {
  const simulate = fps => {
    const zoom = new WheelZoomTarget(); zoom.queue({deltaY: -120, deltaMode: 0}, 20, 1, 100, 800);
    let distance = 20, first;
    for (let i = 0; i < fps; i++) { const previous = distance; distance = zoom.step(distance, 1/fps); first ??= distance; assert.ok(distance <= previous && distance >= 1); }
    assert.ok(first > distance && first < 20, 'gesture spans multiple rendered frames');
    assert.equal(zoom.target, null, 'no residual inertia'); return distance;
  };
  assert.ok(Math.abs(simulate(60) - simulate(144)) < .0001);
});
test('reversal, reduced motion, cancel and bounds do not overshoot', () => {
  const zoom = new WheelZoomTarget(); zoom.queue({deltaY: -600, deltaMode: 0}, 1, 1, 100, 800);
  assert.equal(zoom.step(1, 1, true), 1);
  zoom.queue({deltaY: 600, deltaMode: 0}, 90, 1, 100, 800); assert.equal(zoom.step(90, 1, true), 100);
  zoom.queue({deltaY: -120, deltaMode: 0}, 20, 1, 100, 800);
  zoom.queue({deltaY: 120, deltaMode: 0}, 20, 1, 100, 800); assert.ok(Math.abs(zoom.step(20, 1, true) - 20) < 1e-9);
  zoom.queue({deltaY: -1, deltaMode: 0}, 20, 1, 100, 800); zoom.cancel(); assert.equal(zoom.step(20, 1), 20);
});

test('button and keyboard zoom accumulate smoothly and share wheel bounds', () => {
  const zoom=new WheelZoomTarget();
  zoom.by(.8,20,1,100);zoom.by(.8,20,1,100);
  const first=zoom.step(20,1/60);
  assert.ok(first>12.8&&first<20);
  zoom.by(1.25,first,1,100);
  assert.ok(Math.abs(zoom.step(first,1,true)-16)<1e-9);
  zoom.by(.001,16,1,100);assert.equal(zoom.step(16,1,true),1);
  zoom.by(1000,1,1,100);assert.equal(zoom.step(1,1,true),100);
  for(const invalid of [0,-1,NaN,Infinity]) {zoom.by(invalid,20,1,100);assert.equal(zoom.target,null);}
});
