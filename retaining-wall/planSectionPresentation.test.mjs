import test from 'node:test';
import assert from 'node:assert/strict';
import {inputDiagram} from './inputDiagram.mjs?rwv=20261003-main-equations-1';
import {PASSING_EXAMPLES} from './passingExamples.mjs?rwv=20261003-main-equations-1';

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);

test('seven draft systems expose a section cut and finite Plan/Section geometry',()=>{
  for(const [type,example] of Object.entries(PASSING_EXAMPLES)){
    for(const view of ['plan','section']){
      const svg=inputDiagram(type,example.values,'hp',view).svg;
      const box=svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number);
      assert.ok(box.every(Number.isFinite)&&box[0]<=0&&box[1]<=0&&box[2]>=440&&box[3]>=270,`${type} ${view}: labels remain inside expanded viewport`);
      assert.doesNotMatch(svg,/NaN|Infinity|undefined/,`${type} ${view}`);
      if(view==='plan')assert.match(svg,/>A<|>A<\/text>/,`${type} section cut`);
    }
  }
});

test('piled draft uses the input edge-to-CENTRE distances in both views',()=>{
  const i={hp:3,hz:.4,B:3,toe:.8,t:.3,ttop:.15,heel:1.9,Lw:10,
    pileB:.35,pileEmb:4,pileEdT:.55,pileEdH:.6,pileSt:2,pileSh:2,beta:0};
  const section=inputDiagram('pile',i,'pileEdT','section').svg;
  const heads=[...section.matchAll(/data-support="connection" cx="([\d.]+)" cy="([\d.]+)"/g)];
  assert.equal(heads.length,2);
  const sectionScale=Math.min(170/(i.hp+i.hz+i.pileEmb),265/i.B);
  near(Number(heads[0][1]),98+i.pileEdT*sectionScale);
  near(Number(heads[1][1]),98+(i.B-i.pileEdH)*sectionScale);
  const plan=inputDiagram('pile',i,'pileEdT','plan').svg;
  assert.match(inputDiagram('pile',i,'pileEdT').note,/ขอบฐานถึงศูนย์เข็ม Toe/);
  assert.match(inputDiagram('pile',i,'pileEdH').note,/ขอบฐานถึงศูนย์เข็ม Heel/);
  const rows=[...new Set([...plan.matchAll(/data-support="connection" cx="([\d.]+)" cy="([\d.]+)"/g)]
    .map(match=>Number(match[2])))].sort((a,b)=>a-b);
  assert.equal(rows.length,2);
  const planScale=Math.min(300/i.Lw,125/i.B);
  near(rows[0],75+i.pileEdT*planScale);
  near(rows[1],75+(i.B-i.pileEdH)*planScale);
});

test('tapered Section soil follows the back face and the entered backfill slope',()=>{
  const i={hp:3.5,hz:.4,B:4.2,toe:.8,t:.6,ttop:.25,heel:2.8,Lw:10,beta:20};
  const svg=inputDiagram('gravity',i,'ttop','section').svg;
  const soil=svg.match(/<path d="M([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)L([\d.-]+) ([\d.-]+)Z" fill="#e7e0ce"/);
  assert.ok(soil,'soil polygon');
  const rise=i.heel*Math.tan(i.beta*Math.PI/180);
  const scale=Math.min(170/(i.hp+i.hz+rise),265/i.B);
  near(Number(soil[1]),98+(i.toe+i.t)*scale);
  near(Number(soil[3]),98+(i.toe+i.ttop)*scale);
  assert.ok(Number(soil[6])<Number(soil[4]),'backfill surface rises toward the heel');
});

test('soldier rear cap remains labelled schematic in both views; duckfoot bearing is shown without piles',()=>{
  const soldier=PASSING_EXAMPLES.soldier.values;
  for(const view of ['plan','section']){
    const svg=inputDiagram('soldier',soldier,'stayLb',view).svg;
    assert.match(svg,/ไม่ตรวจดัด\/เฉือน\/เหล็ก/);
    assert.match(svg,/ฐานหัวเข็มสมอ|แคปสมอ/);
  }
  const duck=inputDiagram('duckfoot',PASSING_EXAMPLES.duckfoot.values,'beamH','section').svg;
  assert.match(duck,/data-support="soil-bearing"/);
  assert.doesNotMatch(duck,/pile-head|เข็มสมอ/);
});

test('short Soldier sections preserve one metric scale and entered member sizes',()=>{
  const values=PASSING_EXAMPLES.soldier.values;
  const widths=[];
  for(const hp of [5.4,3,1,.5]){
    const svg=inputDiagram('soldier',{...values,hp},'hp','section').svg;
    const scale=Number(svg.match(/data-soldier-scale="([\d.]+)"/)[1]);
    const pile=svg.match(/data-member="front-pile" data-width="([\d.]+)"><rect[^>]+width="([\d.]+)" height="([\d.]+)"/);
    near(Number(pile[1]),.4);near(Number(pile[2]),.4*scale);
    near(Number(pile[3]),hp*1.7*scale);assert.ok(scale<=20);
    widths.push(Number(pile[2]));
    assert.match(svg,/data-member="stay" data-width="0.25" data-depth="0.5"/);
    assert.match(svg,/เข็ม I40 cm · สเตย์ 25 × 50 cm/);
    assert.doesNotMatch(svg,/Auto m|NaN|Infinity/);
  }
  assert.ok(Math.max(...widths)/Math.min(...widths)<1.05,'lowering H must not greatly magnify the same I40 section');
  for(const soldierSys of ['cant','anchor'])assert.doesNotMatch(inputDiagram('soldier',{...values,hp:.5,soldierSys},'hp').svg,/NaN|Infinity/);
});
