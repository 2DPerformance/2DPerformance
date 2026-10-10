import assert from 'node:assert/strict';
import {test} from 'node:test';
import {computeForUi,legacyPresentation,reportForUi} from './workbench.mjs';
import {getPassingExample} from './passingExamples.mjs';
import {legacyRecoveryQuantity} from './legacyOutputUnits.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const plain=pages=>pages.flatMap(p=>p.entities.filter(e=>e.t==='text').map(e=>e.s)).join('\n');

for(const type of ['cantilever','counterfort','gravity']) for(const profile of ['thai2566','aci318','wsd']) {
  test(`${type}/${profile}: typed kgf output, signed stations, DC, steel, authority and Snapshot unchanged`,()=>{
    for(const overrides of [{},{baseT:.25,delta:5},{waterEnabled:true,waterH:1}]) {
      const ui={...getPassingExample(type).values,wtype:type,...overrides};
      const s=computeForUi(ui,profile).snapshot; assert.ok(s.ok);
      const before=JSON.stringify(s),si=legacyPresentation(s,'si'),kg=legacyPresentation(s,'kgf');
      for(const key of ['P','V','Mo','Mr','muStem','muHeel','muToe','qMax','qToe','qHeel','qa','q'])
        if(Number.isFinite(si[key]))close(kg[key],si[key]*1000/9.80665);
      for(const key of ['H','B','baseT','stemT','toe','heel','fsOt','fsSl','bearingFs','e','xR','kern'])
        assert.equal(kg[key],si[key]);
      for(const key of ['verdict','authority','engineeringCoverage','recovery','stemDesign','toeDesign','heelDesign'])
        assert.equal(kg[key],si[key]);
      assert.deepEqual(kg.checks.map(c=>[c.k,c.u,c.ok]),s.checks.map(c=>[c.k,c.u,c.ok]));
      for(const [i,member] of kg.forceDesign.members.entries()) {
        const origin=s.forceDesign.members[i];
        close(member.moment,origin.moment*1000/9.80665);close(member.shear,origin.shear*1000/9.80665);
        close(member.shearCapacity,origin.shearCapacity*1000/9.80665);
        assert.equal(member.shearDc,origin.shearDc);assert.equal(member.governingSteel,origin.governingSteel);
        assert.equal(member.designs,origin.designs);assert.equal(member.maxDesignUtilization,origin.maxDesignUtilization);
        for(const key of ['bmd','bmdAlt','sfd']) for(const [j,p] of member[key].entries()) {
          assert.equal(p.x,origin[key][j].x);close(p.y,origin[key][j].y*1000/9.80665);
        }
      }
      const bearing=kg.checks.find(c=>c.k==='BEARING q,max');
      assert.ok(bearing.v.includes((s.result.qmaxEff*1000/9.80665).toFixed(2)+' kgf/m²'));
      for(const [part,key] of [['STEM','S'],['HEEL','H'],['TOE','T']]) {
        const check=kg.checks.find(c=>c.k==='SHEAR — '+part);
        assert.equal(check.v,(s.result['Vu'+key]*1000/9.80665).toFixed(2)+' kgf');
        assert.ok(check.req.includes((s.result['phiVc'+key]*1000/9.80665).toFixed(2)+' kgf'));
      }
      assert.equal(reportForUi(s,'si'),s.report); assert.equal(reportForUi(s,'mks'),s.report);
      const pages=reportForUi(s,'kgf'),text=plain(pages);
      assert.equal(reportForUi(s,'kgf'),pages,'cached display only');
      assert.ok(pages.every(p=>!p.meta.overflow&&p.meta.rendererRecomputed===false
        &&p.meta.equationBasis==='si'&&p.meta.verdict===s.verdict&&p.meta.authority===s.authority));
      assert.ok(text.includes('แปลงผล SI:'));assert.ok(text.includes('1000 / 9.80665'));
      assert.ok(text.includes((s.forceDesign.loads.lateral*1000/9.80665).toFixed(2)+' kgf/m'));
      assert.ok(text.includes('สมการแทนค่า SI'));assert.ok(text.includes('kgf/cm²'));
      assert.ok(!text.includes('NaN'));assert.ok(pages.at(-1).meta.finalSectionSummary);
      // The CAD outline and selected bars stay exact; just force-unit furniture
      // and the total page number may change when kgf adds conversion lines.
      const geometry=pages=>pages.filter(p=>p.meta.cadSheet).map(p=>p.entities.filter(e=>e.t!=='text')
        .map(({annotationClearance,...physical})=>physical));
      assert.ok(geometry(pages).length>0);
      assert.deepEqual(geometry(pages),geometry(s.report));
      for(let i=0;i<20;i++)assert.equal(legacyPresentation(s,'si'),si);
      assert.equal(JSON.stringify(s),before,'no display number feeds back to the immutable result');
    }
  });
}

test('independent exact golden and dimension/material-grade recovery fields',()=>{
  const golden=legacyRecoveryQuantity(9.80665,'kPa','kgf');
  close(golden.value,1000);assert.equal(golden.unit,'kgf/m²');
  assert.deepEqual(legacyRecoveryQuantity(.2,'m','kgf'),{value:.2,unit:'m'});
  assert.deepEqual(legacyRecoveryQuantity(24,'MPa','kgf'),{value:24,unit:'MPa'});
  assert.throws(()=>legacyPresentation({ok:false},'kgf'));
  const s=computeForUi({...getPassingExample('cantilever').values,wtype:'cantilever'}).snapshot;
  assert.throws(()=>legacyPresentation(s,'kg'));assert.throws(()=>reportForUi(s,'kg'));
});
