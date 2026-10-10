import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resultUnits,displayEngineText,displayedChecks} from './resultUnits.mjs';
import {createSystemSnapshot} from './systemsSnapshot.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {duckDesignEquations,duckForceFigures} from './duckfootPresentation.mjs';
import {nativeA4ReportSheets} from './a4NativeReport.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('NIST independent force/pressure/stress/stiffness goldens and tf Engine basis',()=>{
  const kg=resultUnits('kgf'),si=resultUnits('si');
  for(const unit of ['kN','kN/ต้น','kN/m','kN/m³','kN·m','kN·m/m','kN·m²','kPa'])near(kg.value(9.80665,unit),1000);
  near(kg.value(.0980665,'MPa'),1);
  for(const unit of ['tf','tf/ต้น','tf/m','tf·m/m']){
    near(kg.value(1,unit),1000);near(si.value(1,unit),9.80665);
  }
  near(si.value(1000,'kgf/m²'),9.80665);near(kg.value(1000,'kgf/m²'),1000);
  assert.equal(kg.quantity(-9.80665,'kN·m'),'-1000.00 kgf·m');
  for(const invalid of ['mks','kg','',null])assert.throws(()=>resultUnits(invalid));
  for(const invalid of ['mm','constructor','toString'])assert.throws(()=>kg.value(1,invalid));
  assert.equal(kg.format(null,'kN'),'—');
  assert.equal(kg.format(Infinity,'kN'),'—');
});

test('recognised prose quantities only; geometry, material grades, ratios and clauses preserved',()=>{
  const source='DB12@150 · 4 ต้น · FS 1.5 · D/C 0.99 · §22.6 · H 2.3 m · 9.80665 kN·m/ม. · 0.0980665 MPa';
  assert.equal(displayEngineText(source,'kgf'),'DB12@150 · 4 ต้น · FS 1.5 · D/C 0.99 · §22.6 · H 2.3 m · 1000.00 kgf·m/m · 1.00 kgf/cm²');
  assert.equal(displayEngineText('รับ 1000 กก./ม²','si'),'รับ 9.81 kPa');
  assert.equal(displayEngineText('Pa ≥ 30 ตัน/ต้น','kgf'),'Pa ≥ 30000.00 kgf/ต้น');
});

for(const type of ['pile','pilecf','soldier','duckfoot'])for(const profile of ['thai2566','aci318','wsd']){
  test(`${type}/${profile}: display modes preserve accepted PASS/FAIL, DC, reinforcement and identity`,()=>{
    const input=getPassingExample(type).values;
    for(const changed of [{},{hp:8}]){
      const s=createSystemSnapshot({...input,...changed},profile),before=JSON.stringify(s);
      for(const mode of ['si','kgf','si']){
        const rows=displayedChecks(s,mode);
        assert.deepEqual(rows.map(c=>[c.key,c.dc,c.ok]),s.checks.map(c=>[c.key,c.dc,c.ok]));
        assert.equal(rows.length,s.checks.length);
        const report=nativeA4ReportSheets(s,{title:type,profileLabel:profile,support:'support',unitMode:mode});
        assert.ok(report.includes(resultUnits(mode).title));
        assert.ok(report.includes(s.stamp));assert.ok(report.includes(s.status));
        assert.equal((report.match(/data-report-final-section=/g)||[]).length,1);
        assert.ok(!report.includes('NaN'));assert.equal(JSON.stringify(s),before);
      }
    }
  });
}

test('mixed tf and kN pile quantities converted once, implicit check criteria remain typed',()=>{
  const s=createSystemSnapshot(getPassingExample('pile').values),u=resultUnits('kgf');
  const rows=displayedChecks(s,'kgf');
  assert.equal(rows.find(c=>c.key==='PILE โมเมนต์ดัด').value,u.quantity(s.forces.pile.Mu,'kN·m'));
  assert.ok(rows.find(c=>c.key==='PILE แกน toe/heel').criterion.includes('30000.00 kgf/ต้น'));
  const pressure=rows.find(c=>c.key==='PILE แรงราบ · batter');
  assert.equal(pressure.value,u.quantity(s.forces.pile.hcap,'tf/m'));
  assert.ok(pressure.criterion.includes(u.quantity(s.forces.pile.Rh,'tf/m')));
});

test('duck: actual beam/column/footing load substitutions use kgf, dimensioned ACI SI constants explicit',()=>{
  const s=createSystemSnapshot(getPassingExample('duckfoot').values),before=JSON.stringify(s);
  const u=resultUnits('kgf'),html=duckDesignEquations(s,'kgf');
  assert.ok(html.includes(u.format(s.input.Npost,'kN')+' kgf'));
  assert.ok(html.includes(u.format(s.beamDesign.M,'kN·m')+' kgf·m'));
  assert.ok(html.includes('data-equation-basis="si"'));assert.ok(html.includes('0.75×0.17√f′c'));
  assert.ok(html.includes(s.beamDesign.capacity.toFixed(2)+' kN·m = '+u.quantity(s.beamDesign.capacity,'kN·m')));
  const punch=displayedChecks(s,'kgf').find(c=>c.key==='ฐาน · เจาะทะลุขอบรวมโมเมนต์');
  assert.equal(punch.value,u.quantity(s.footing.punch.stress,'MPa'));
  const calls=[];
  const figures=duckForceFigures(s,(values,label,unit)=>{calls.push({values,label,unit});return '<svg/>';},'kgf');
  assert.ok(figures.includes('SFD · kgf'));assert.ok(figures.includes('BMD · kgf·m'));
  assert.ok(calls.every(c=>c.unit.startsWith('kN')),'graph adapter receives canonical values exactly once');
  assert.deepEqual(calls[0].values,s.equilibrium.columnDiagram.map(p=>p.v));
  assert.equal(JSON.stringify(s),before);
});
