import assert from 'node:assert/strict';
import {test} from 'node:test';
import {getPassingExample} from './passingExamples.mjs';
import {designRetainingWall,DESIGN_PROFILES} from './engine.mjs';
import {designRetainingWall as mirrorDesign} from '../../src/features/concrete/retainingWall/retainingWallEngine.js';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {nativeEquationRows} from './essentialReport.mjs';
import {renderRearAnchorActions} from './rearAnchorPresentation.mjs';
const i=()=>({...getPassingExample('soldier').values,qD:0,qL:100,q:100,ancDowelDb:16,ancDowelN:4});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('independent uplift/WSD arithmetic rejects previously unsafe manual 4-DB16',()=>{
 const r=designRetainingWall(i(),{profile:'wsd'}),s=createSystemSnapshot(i(),'wsd'),dw=r.stay.anchorPile.dowel;
 // V-stay pair: vertical reaction = 2 Hfront * drop / horizontal setback.
 near(dw.serviceT,2*r.Tpile*r.stay.layout.drop/r.stay.layout.Lb);
 near(dw.serviceT,179.37126592000058);
 near(dw.AsReq,1121.0704120000036); // 179.37126592 kN * 1000 N/kN / 160 N/mm²
 near(dw.AsProv,804.4); // existing catalogue 4 * 201.1 mm²
 assert.equal(dw.ok,false);assert.equal(dw.nAuto,6);
 const c=s.checks.find(c=>c.key.includes('APd'));
 near(c.dc,1121.0704120000036/804.4);assert.equal(c.ok,false);assert.equal(s.status,'FAIL');
 assert.match(c.value,/T_service/);assert.match(c.fix,/6-DB16/);
 assert.equal(s.forces.rearAnchor.capacityVerified,false);
});

test('auto supplies six DB16 for WSD; one fewer remains a genuine steel failure',()=>{
 const automatic=createSystemSnapshot({...i(),ancDowelN:0},'wsd');
 const manual=createSystemSnapshot({...i(),ancDowelN:5},'wsd');
 assert.equal(automatic.forces.rearAnchor.dowel.spec,'6-DB16');
 assert.equal(automatic.checks.find(c=>c.key.includes('APd')).ok,true);
 assert.match(automatic.bbs.find(b=>b.mark==='APd').detail,/6-DB16/);
 assert.equal(manual.checks.find(c=>c.key.includes('APd')).ok,false);
 // Other structural failures are not overwritten by the automatic dowel fix.
 assert.equal(automatic.status,'FAIL');
});

test('existing WSD material tiers and inherited minimum rule are preserved',()=>{
 for(const [fy,fs]of [[235,120],[240,150],[390,160],[400,170],[490,170]]){
  const r=designRetainingWall({...i(),fy},{profile:'wsd'}),dw=r.stay.anchorPile.dowel;
  assert.equal(dw.stressLimitMPa,fs);near(dw.AsReq,dw.serviceT*1000/fs);
  near(dw.AsMin,Math.max(.005*dw.grossAreaMM2,452.4));
 }
 const dw=designRetainingWall(getPassingExample('soldier').values,{profile:'wsd'}).stay.anchorPile.dowel;
 assert.equal(dw.govern,'ขั้นต่ำ');near(dw.AsNeed,452.4);assert.equal(dw.nAuto,4);
});

test('SDM area and PC-wire screening use their original demand/strength arithmetic',()=>{
 for(const profile of Object.keys(DESIGN_PROFILES))for(const mode of ['db','pcwire']){
  const r=designRetainingWall({...i(),ancDowelMode:mode},{profile}),dw=r.stay.anchorPile.dowel;
  near(dw.Tu,DESIGN_PROFILES[profile].gH*r.stay.perAnchor);
  if(profile!=='wsd'||mode==='pcwire')near(dw.AsReq,dw.Tu*1000/(.90*390));
  near(dw.pc.Tcap,.75*(8*Math.PI/4*25)*400/1000);
  assert.equal(dw.pc.strOK,dw.Tu<=dw.pc.Tcap);
  if(mode==='pcwire')assert.equal(dw.ok,dw.pc.strOK);
 }
});

test('public/source-mirror force and dowel results stay identical',()=>{
 for(const profile of Object.keys(DESIGN_PROFILES)){
  assert.deepEqual(JSON.parse(JSON.stringify(mirrorDesign(i(),{profile}))),
    JSON.parse(JSON.stringify(designRetainingWall(i(),{profile}))));
 }
});

test('A4 substitution shows actual WSD demand, stress, minimum and selected count in SI/kgf',()=>{
 const s=createSystemSnapshot(i(),'wsd'),before=JSON.stringify(s);
 for(const mode of ['si','kgf']){
  const rows=nativeEquationRows(s,mode),area=rows.find(r=>r[0]==='APd · As จากแรงถอน');
  assert.equal(area[1],'As,T = Tservice·1000/fs,allow');
  assert.equal(area[2],'179.371 kN × 1000 / 160.0 MPa');assert.equal(area[3],'1121.1 mm²');
  const minimum=rows.find(r=>r[0]==='APd · เหล็กขั้นต่ำ');assert.equal(minimum[3],'452.4 mm²');
  const chosen=rows.find(r=>r[0]==='APd · พื้นที่เหล็ก');assert.match(chosen[2],/4 × 201.1 = 804.4/);
  assert.match(chosen[3],/ไม่ผ่านพื้นที่เหล็ก; ต้อง ≥ 6-DB16/);
  const html=renderRearAnchorActions(s.forces.rearAnchor,{mode});
  assert.match(html,/Tใช้งาน/);assert.match(html,/fs,allow = 160.0 MPa/);
  assert.match(html,/เหล็กเดือยหล่อพร้อมกัน/);assert(!/40db|15db|พื้นที่ฝังในโมเดล|NaN|undefined|Infinity/.test(html));
  assert.ok(html.includes(mode==='kgf'?'18290.78 kgf':'179.37 kN'));
 }
 assert.equal(JSON.stringify(s),before);
});
