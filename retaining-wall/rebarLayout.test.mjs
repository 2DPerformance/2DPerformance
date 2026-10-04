import test from 'node:test';
import assert from 'node:assert/strict';
import { designRetainingWall, checksFor } from './engine.mjs?rwv=20261003-main-equations-1';
import { RW_DEFAULT_INPUT } from './snapshot.mjs?rwv=20261003-main-equations-1';
import { buildDesignRebarLayout, buildDuckDesignRebarLayout, requireTransverseBaseLayout } from './rebarLayout.mjs?rwv=20261003-main-equations-1';
import { calculateDuckfoot } from './duckfootEngine.mjs?rwv=20261003-main-equations-1';

test('mark 8 independent centreline cover, length, count, layer and development check',()=>{
  for(const hz of [.20,.40,.60]){
    const r=designRetainingWall({...RW_DEFAULT_INPUT,hz});
    const g=requireTransverseBaseLayout(r),row=r.qty.bbs.find(b=>b.mk==='⑧');
    assert.ok(Math.abs(row.len-(r.i.B-.15-row.size/1000))<1e-9);
    assert.equal(row.n,2*(Math.ceil((r.i.Lw-.15-row.size/1000)/(r.barFT.s/1000))+1));
    for(const path of g.paths){
      assert.ok(path[0][0]-row.size/2000>=.075-1e-9);
      assert.ok(r.i.B-path[1][0]-row.size/2000>=.075-1e-9);
      assert.ok(path[0][2]-row.size/2000>=.075-1e-9);
      assert.ok(r.i.Lw-path[0][2]-row.size/2000>=.075-1e-9);
    }
    const check=checksFor(r).find(c=>c.k==='REBAR ⑧');
    assert.equal(check.ok,g.status==='PASS');
    if(hz===.20)assert.equal(check.ok,false,'thin base must fail the actual layer check');
    if(check.ok)assert.ok(g.yTop-g.yBottom>=row.size/1000+.025-1e-9);
    assert.throws(()=>requireTransverseBaseLayout({...r,dTtop:r.dTtop+.005}),/inconsistent/);
  }
});

test('selected design axes stay inside concrete and carry no cutting authority',()=>{
  for(const wtype of ['cant','but','gravity']){
    const r=designRetainingWall({...RW_DEFAULT_INPUT,wtype,hp:3,hz:.6,t:.5,ttop:.4,B:3.5,toe:.6,L:2,bs:.4,Lw:10});
    const a=buildDesignRebarLayout(r);
    assert.equal(a.purpose,'DESIGN_ILLUSTRATION');assert.equal(a.fabricationAuthority,false);
    for(const group of a.groups)for(const path of group.paths)for(const [x,y,z]of path){
      assert.ok([x,y,z].every(Number.isFinite));
      assert.ok(x>=0&&x<=r.i.B&&y>=0&&y<=r.i.hz+r.i.hp&&z>=0&&z<=r.i.Lw,
        `${wtype} ${group.mark}: ${x}, ${y}, ${z} outside member bounds`);
    }
  }
});

test('duck-foot cage follows the selected bars in each post, pad and longitudinal beam',()=>{
  const i={hp:2.3,t:.35,colDepth:.35,B:1.5,capL:1.3,hz:.45,gc:24,
    postSpacing:2.5,nPosts:4,beamB:.3,beamH:.3,Npost:100,Hpost:10,Mpost:0,
    fc:24,fy:390,cov:40,qa:150,mu:.5,factorN:1.4,factorH:1.7,qBeam:0};
  const r=calculateDuckfoot(i),a=buildDuckDesignRebarLayout(i,r);
  // Raised-beam gravity now makes this former fixture exceed qa slightly;
  // an overall PASS is not needed to inspect the selected concrete/steel axes.
  assert.equal(r.status,'FAIL');assert.ok(r.checks.some(c=>c.key.includes('กำลังแบกทาน')&&!c.ok));
  assert.equal(a.fabricationAuthority,false);
  const col=a.groups.filter(g=>g.mark==='C1');
  assert.equal(col.length,i.nPosts);
  assert.ok(col.every(g=>g.db===r.column.db&&g.paths.length===r.column.n));
  const span=(i.nPosts-1)*i.postSpacing;
  for(const g of a.groups)for(const p of g.paths)for(const [x,y,z]of p){
    assert.ok([x,y,z].every(Number.isFinite));
    assert.ok(x>=0&&x<=i.B&&y>=-Math.max(i.hz,i.beamH)&&y<=i.hp
      &&Math.abs(z)<=(span+i.capL)/2,`${g.mark}: outside footprint`);
    if(g.mark.startsWith('GB1'))assert.ok(y-g.db/2000>=r.geometry.beamBottom+i.cov/1000-1e-9
      &&y+g.db/2000<=r.geometry.beamTop-i.cov/1000+1e-9,'beam steel must be ABOVE the pad, inside the raised beam cover');
  }
});

test('counterfort selected two-layer bars retain engine clear spacing and bar count',()=>{
  const r=designRetainingWall({...RW_DEFAULT_INPUT,wtype:'but',hp:3.5,hz:.4,t:.3,ttop:.3,
    toe:.8,heel:1.9,B:3,L:3,bs:.3,cfL:0,cfH:0,q:10,Lw:10,zw:2.5});
  assert.equal(r.but.twoLayer,true);
  const layout=buildDesignRebarLayout(r),full=layout.groups.find(g=>g.mark==='⑥'),cut=layout.groups.find(g=>g.mark==='⑥b');
  assert.equal(full.paths.length+cut.paths.length,r.but.nB25*r.qty.nBut);
  const bottomFull=full.paths[0][0],bottomCut=cut.paths[0][0];
  const normalDistance=(bottomFull[0]-bottomCut[0])*r.cfHr/Math.hypot(r.cfLr,r.cfHr);
  assert.ok(Math.abs(normalDistance-(r.but.clrMin+r.but.barSize)/1000)<1e-9);
  for(const group of [full,cut]){
    const n=group.mark==='⑥'?r.but.finCut.nFul:r.but.finCut.nCut;
    for(let j=1;j<n;j++)assert.ok(group.paths[j][0][2]-group.paths[j-1][0][2]
      -r.but.barSize/1000>=r.but.clrMin/1000-1e-9);
  }
});
