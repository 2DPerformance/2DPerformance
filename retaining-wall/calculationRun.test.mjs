import test from 'node:test';import assert from 'node:assert/strict';
import {createCalculationRun} from './calculationRun.mjs';
function harness(calculate){
  const events=[],queue=[];
  const run=createCalculationRun({calculate:()=>calculate(run),onStart:()=>events.push('start'),onFinish:outcome=>events.push(outcome),onError:error=>events.push(error.message),schedule:task=>queue.push(task)});
  return {run,events,queue};
}
test('busy state precedes work, duplicate requests never enqueue a second calculation',async()=>{
  let calls=0;const h=harness(run=>{calls++;run.observe({ready:true,running:false,state:'PASS'});});
  assert.equal(h.run.start(),true);assert.equal(h.run.active,true);assert.equal(calls,0);
  assert.equal(h.run.start(),false);assert.equal(h.queue.length,1);
  await h.queue.shift()();assert.equal(calls,1);assert.deepEqual(h.events,['start','complete']);assert.equal(h.run.active,false);
  assert.equal(h.run.start(),true);await h.queue.shift()();assert.equal(calls,2);
});
test('legacy queued work must wait for terminal state instead of callback return',async()=>{
  const h=harness(()=>undefined);h.run.start();await h.queue.shift()();assert.equal(h.run.active,true);
  for(const state of ['LOADING','RUNNING'])h.run.observe({state,running:true,ready:false});
  assert.deepEqual(h.events,['start']);h.run.observe({state:'READY',ready:true,running:false});
  assert.deepEqual(h.events,['start','complete']);
});
test('real FAIL is a completed calculation and never becomes PASS',async()=>{
  const result={state:'FAIL',ready:true,running:false,checks:[{ok:false}]};
  const h=harness(run=>run.observe(result));h.run.start();await h.queue.shift()();
  assert.deepEqual(h.events,['start','complete']);assert.equal(result.state,'FAIL');assert.equal(result.checks[0].ok,false);
});
test('validation terminal error releases the run and permits a corrected calculation',async()=>{
  const h=harness(run=>run.observe({state:'ERROR',ready:false,running:false}));
  h.run.start();await h.queue.shift()();assert.equal(h.run.active,false);assert.deepEqual(h.events,['start','error']);assert.equal(h.run.start(),true);
});
test('synchronous exceptions and asynchronous rejections unlock without success',async()=>{
  for(const calculate of [()=>{throw Error('invalid input');},()=>Promise.reject(Error('invalid input'))]){
    const h=harness(calculate);h.run.start();await h.queue.shift()();assert.deepEqual(h.events,['start','invalid input','error']);assert.equal(h.run.active,false);
  }
});
test('boot/stale/result changes outside an explicit calculation produce no completion',()=>{
  const h=harness(()=>{});
  for(const state of [{state:'LOADING',running:true},{state:'STALE'},{state:'ERROR'},{state:'PASS',ready:true}])h.run.observe(state);
  assert.deepEqual(h.events,[]);
});
test('completion waits for callback rendering, and a later render error cannot announce success',async()=>{
  const h=harness(run=>{run.observe({state:'READY',ready:true,running:false});assert.equal(run.active,true);run.observe({state:'ERROR',ready:false,running:false});});
  h.run.start();await h.queue.shift()();assert.deepEqual(h.events,['start','error']);
});
test('accepted deferred result stays busy until the actual callback promise resolves',async()=>{
  let resolve;const h=harness(run=>{run.observe({state:'READY',ready:true,running:false});return new Promise(r=>{resolve=r;});});
  h.run.start();const pending=h.queue.shift()();assert.equal(h.run.active,true);assert.deepEqual(h.events,['start']);resolve();await pending;assert.deepEqual(h.events,['start','complete']);
});
