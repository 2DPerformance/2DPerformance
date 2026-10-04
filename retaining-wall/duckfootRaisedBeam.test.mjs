import assert from 'node:assert/strict';
import test from 'node:test';
import {duckBeam,duckColumnActions,calculateDuckfoot,duckColumnCurve} from './duckfootEngine.mjs?rwv=20261003-main-equations-1';
import {duckfootGeometry,duckfootConcreteBoxes,DUCK_BEAM_CLEAR_DEFAULT} from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import {SYSTEM_DEFAULTS,createSystemSnapshot} from './systemsSnapshot.mjs?rwv=20261003-main-equations-1';
import {inputDiagram,duckfootDrawing} from './inputDiagram.mjs?rwv=20261003-main-equations-1';
import {duckDesignEquations} from './duckfootPresentation.mjs?rwv=20260930-load-units-1';

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const base={...SYSTEM_DEFAULTS,wtype:'duckfoot',hp:2.3,t:.35,colDepth:.35,B:1.5,capL:1.4,hz:.45,
  gc:24,postSpacing:2.5,nPosts:4,beamB:.3,beamH:.3,beamClear:.4,Npost:100,Hpost:10,Mpost:0,
  fc:24,fy:390,cov:40,qa:150,mu:.5,factorN:1.4,factorH:1.7,qBeam:0};

function extent(b,k){return [b.position[k]-b.size[k]/2,b.position[k]+b.size[k]/2];}
function intersection(a,b){
  const limits=[0,1,2].map(k=>[Math.max(extent(a,k)[0],extent(b,k)[0]),Math.min(extent(a,k)[1],extent(b,k)[1])]);
  const volume=limits.reduce((v,[lo,hi])=>v*Math.max(hi-lo,0),1);
  return {volume,x:(limits[0][0]+limits[0][1])/2};
}

test('3D boxes, Plan/Section and input dimensions share the raised beam datum',()=>{
  for(const beamClear of [0,.35,1]){
    const i={...base,beamClear,beamH:.6},g=duckfootGeometry(i),boxes=duckfootConcreteBoxes(g);
    const beam=boxes.find(b=>b.kind==='strap');
    near(extent(beam,1)[0],beamClear);near(extent(beam,1)[1],beamClear+.6);
    for(const pad of boxes.filter(b=>b.kind==='base')){
      near(extent(pad,1)[1],0);near(intersection(pad,beam).volume,0);
    }
    for(const col of boxes.filter(b=>b.kind==='wall'))near(extent(col,0)[0],0);
    for(const view of ['plan','section']){
      const live=inputDiagram('duckfoot',i,'beamClear',view).svg;
      assert.equal(live,duckfootDrawing(g,view,'beamClear'));
      assert.match(live,new RegExp(`data-bottom="${beamClear}"`));
      assert.doesNotMatch(live,/NaN|undefined/);
    }
    assert.match(inputDiagram('duckfoot',i,'beamClear').svg,/data-dimension="beamClear" data-active="true"/);
  }
});

test('beam reactions conserve actual concrete union volume and transverse first moment',()=>{
  for(const t of [.2,.3,.45])for(const nPosts of [2,4,9]){
    const i={...base,t,nPosts,qBeam:2},g=duckfootGeometry(i),boxes=duckfootConcreteBoxes(g);
    const beamBox=boxes.find(b=>b.kind==='strap'),volume=beamBox.size.reduce((a,b)=>a*b,1);
    const overlaps=boxes.filter(b=>b.kind==='wall').map(b=>intersection(b,beamBox));
    const weight=i.gc*(volume-overlaps.reduce((v,o)=>v+o.volume,0));
    const firstMoment=i.gc*(volume*beamBox.position[0]-overlaps.reduce((v,o)=>v+o.volume*o.x,0));
    const r=duckBeam(i),qWeight=i.qBeam*g.beamSpan;
    near(r.concreteWeight,weight);near(r.reactions.reduce((a,b)=>a+b,0),weight+qWeight);
    near(r.reactionFirstMoments.reduce((a,b)=>a+b,0),firstMoment+qWeight*i.beamB/2);
    const changedPad=duckBeam({...i,capL:2,hz:.9,beamClear:1});
    assert.deepEqual(changedPad.reactions,r.reactions,'pad volume/elevation must not remove above-pad beam gravity');
    for(let j=1;j<r.spans.length;j++)near(r.spans[j-1].rightMoment,r.spans[j].leftMoment);
  }
});

// Independent RK4 shooting solution of M'' = -(P/EI)M. M'(0)=-H;
// at the raised connection M jumps by -J, M' stays continuous, M(hp)=Mtop.
function shoot(i,P,H,Mtop,J,a,EI){
  const integrate=initial=>{
    let M=initial,v=-H;
    for(const [lo,hi,jump] of [[0,a,J],[a,i.hp,0]]){
      const step=(hi-lo)/400,k2=P/EI;
      for(let n=0;n<400;n++){
        const k1=[v,-k2*M],k2v=[v+step*k1[1]/2,-k2*(M+step*k1[0]/2)],
          k3=[v+step*k2v[1]/2,-k2*(M+step*k2v[0]/2)],k4=[v+step*k3[1],-k2*(M+step*k3[0])];
        M+=step*(k1[0]+2*k2v[0]+2*k3[0]+k4[0])/6;
        v+=step*(k1[1]+2*k2v[1]+2*k3[1]+k4[1])/6;
      }
      M-=jump;
    }
    return M;
  };
  const zero=integrate(0),one=integrate(1);
  return (Mtop-zero)/(one-zero);
}

test('raised eccentric beam couple satisfies zero-P and independent shooting boundaries',()=>{
  for(const P of [0,80,180])for(const J of [-8,0,8])for(const a of [.2,.8,1.8]){
    const r=duckColumnActions(base,P,10,-4,{moment:J,level:a});
    near(r.baseM,shoot(base,P,10,-4,J,a,r.EI),1e-7);
    near(r.grid.at(-1).m,-4);
    if(P===0)near(r.baseM,-4+10*base.hp+J);
    if(J){const pair=r.grid.filter(p=>p.z===a);assert.equal(pair.length,2);near(pair[0].m-pair[1].m,J);}
  }
});

test('all column reactions reach their own pad once and selected cage checks every post',()=>{
  const r=calculateDuckfoot(base),wCol=base.t*base.colDepth*base.hp*base.gc,wPad=base.B*base.capL*base.hz*base.gc;
  near(r.pads.reduce((v,p)=>v+p.totalV,0),base.nPosts*(base.Npost+wCol+wPad)+r.beam.totalLoad);
  for(const p of r.pads){
    near(p.columnP,base.Npost+wCol+p.beamReaction);
    near(p.beamCouple,p.beamMoment-p.beamReaction*base.t/2);
    near(p.totalM,p.columnP*base.t/2+wPad*base.B/2+p.serviceColumn.baseM);
    const cases=r.column.cases.filter(c=>c.index===p.index);assert.equal(cases.length,2);
    for(const c of cases){near(c.P,c.gN*p.columnP);near(c.nodeMoment,c.gN*p.beamCouple);near(c.nodeLevel,base.beamClear+base.beamH/2);}
  }
  const curve=duckColumnCurve({b:base.colDepth,h:base.t,fc:base.fc,fy:base.fy,cover:base.cov/1000,db:r.column.db,n:r.column.n});
  for(const c of r.column.cases)near(c.capacityM,curve.capacityAt(c.P));
  const raised=calculateDuckfoot({...base,beamClear:1});
  near(raised.column.Pcr,r.column.Pcr); // full height remains the buckling reference
  assert.notEqual(raised.equilibrium.baseM,r.equilibrium.baseM,'eccentric couple acts at the actual elevation');
});

test('clearance validation accepts a beam deeper than pad and rejects missing or invalid elevations',()=>{
  for(const beamClear of [0,.7]){
    const s=createSystemSnapshot({...base,beamClear,beamH:.7,hz:.25});
    near(s.geometry.beamBottom,beamClear);assert.equal(s.schema,'rw01-systems/4');
  }
  for(const beamClear of [-.1,'',null,NaN,2.1])assert.throws(()=>createSystemSnapshot({...base,beamClear}),/beamClear/);
  const old={...base};delete old.beamClear;
  near(createSystemSnapshot(old).input.beamClear,DUCK_BEAM_CLEAR_DEFAULT);
  assert.match(inputDiagram('duckfoot',{...base,beamClear:''},'beamClear').svg,/c — m/);
  const s=createSystemSnapshot({...base,beamClear:.7}),report=duckDesignEquations(s);
  assert.match(report,/ท้องคาน c = 0.70 m/);assert.match(report,/ไม่หักช่วงเหนือ footing/);
  assert.doesNotMatch(report,/เฉพาะช่วงนอกฐาน|ฐานทุกต้น · สมดุล/);
});
