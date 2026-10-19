/** Validate the engine-owned transverse base layout before any projection.
 * Coordinates: metres, x from toe edge, y from base bottom, z along wall. */
export function requireRebarProjection(r, projection){
  const rows=r?.qty?.bbs;
  if(!rows?.length||projection?.source!=='engine.qty'||projection.bbs?.length!==rows.length
    ||projection.steelKg!==r.qty.steelKg)throw new TypeError('model3d: quantityProjection / engine.qty inconsistent');
  for(let j=0;j<rows.length;j++){
    const source=rows[j],p=projection.bbs[j];
    if(!p||['mk','size','n','len','kg','detail'].some(k=>p[k]!==source[k])
      ||JSON.stringify(p.bend)!==JSON.stringify(source.bend))
      throw new TypeError('model3d: quantityProjection row '+source.mk+' inconsistent');
  }
  return projection;
}

export function requireTransverseBaseLayout(r){
  const g=r?.rebarGeometry8,row=r?.qty?.bbs?.find(b=>b.mk==='⑧');
  const bad=()=>{throw new TypeError('RW rebar ⑧: shared layout / BBS / selected depth inconsistent');};
  if(!g||g.schema!=='rw-transverse-base/1'||g.source!=='engine'||!row
    ||g.db!==row.size||g.count!==row.n||g.paths?.length!==row.n||row.bend.type!=='straight'
    ||Math.abs(row.len-g.length)>1e-8||Math.abs(g.yTop-r.dTtop)>1e-8)bad();
  for(const p of g.paths){
    if(p.length!==2||p.some(v=>v.length!==3||v.some(x=>!Number.isFinite(x))))bad();
    if(Math.abs(Math.hypot(...p[1].map((v,j)=>v-p[0][j]))-row.len)>1e-8)bad();
    if(p.some(v=>Math.abs(v[1]-g.yTop)>1e-8&&Math.abs(v[1]-g.yBottom)>1e-8))bad();
  }
  return g;
}

/** Design reinforcement axes. This is a section/force illustration, not a
 * fabrication layout: no splice, bending or cutting-length claim is inferred.
 * Selected diameters, design depths and spacings come only from the engine. */
export function buildDesignRebarLayout(r){
  const i=r.i,c=i.cov/1000,h=i.hp,hz=i.hz,B=i.B,L=i.Lw,xF=i.toe,xB=xF+i.t;
  const groups=[];
  const positions=(a,b,s)=>{if(!(b>=a&&s>0))return [];
    const n=Math.max(1,Math.ceil((b-a)/s));return Array.from({length:n+1},(_,j)=>a+(b-a)*j/n);};
  const back=y=>xB+((r.tTop||i.t)-i.t)*(y-hz)/h;
  const add=(mark,db,spacing,paths,face)=>{
    if(!Number.isFinite(db)||db<=0||!paths.length)return;
    groups.push({mark,db,spacing,face,source:'engine.selectedBars',paths});
  };
  const row=mark=>r.qty.bbs.find(b=>b.mk===mark);
  const srow=mark=>Number(/@(\d+(?:\.\d+)?)/.exec(row(mark)?.detail||'')?.[1]);
  const vertical=(mark,db,s,face,inner=0)=>{
    const y0=hz+c+db/2000,y1=hz+h-c-db/2000;
    add(mark,db,s,positions(c+db/2000,L-c-db/2000,s/1000).map(z=>[
      [face==='back'?back(y0)-c-inner-db/2000:xF+c+inner+db/2000,y0,z],
      [face==='back'?back(y1)-c-inner-db/2000:xF+c+inner+db/2000,y1,z]]),face);
  };
  const cross=(mark,bar,y,a,b)=>add(mark,bar.db,bar.s,
    positions(.075+bar.db/2000,L-.075-bar.db/2000,bar.s/1000).map(z=>[[a,y,z],[b,y,z]]),'base-x');
  const along=(mark,db,s,y,a,b)=>add(mark,db,s,
    positions(a,b,s/1000).map(x=>[[x,y,.075+db/2000],[x,y,L-.075-db/2000]]),'base-z');
  if(r.mode==='but'){
    for(const strip of r.strips)for(const [key,mark,face] of [['b_','①a','back'],['b$','①b','front']]){
      const b=strip[key],ys=positions(hz+h-strip.z2+b.s/2000,hz+h-strip.z1-b.s/2000,b.s/1000);
      add(mark,b.db,b.s,ys.map(y=>{const x=face==='back'?back(y)-c-b.db/2000:xF+c+b.db/2000;
        return [[x,y,c+b.db/2000],[x,y,L-c-b.db/2000]];}),face);
    }
    vertical('②',row('②').size,srow('②'),'front',Math.max(...r.strips.map(s=>s.b$.db))/1000);
    vertical('②',row('②').size,srow('②'),'back',Math.max(...r.strips.map(s=>s.b_.db))/1000);
    along('③',r.barH_.db,r.barH_.s,r.dH,xB+.075,B-.075-r.barH_.db/2000);
    along('④',r.barH$.db,r.barH$.s,hz-r.dHbottom,xB+.075,B-.075-r.barH$.db/2000);
    const ribZ=Array.from({length:r.qty.nBut},(_,k)=>Math.min(k*r.Lt,L-i.bs)+i.bs/2);
    const b=r.but,off=c+b.barSize/2000,slant=Math.hypot(r.cfLr,r.cfHr);
    const xAt=y=>xB+r.cfLr*(1-(y-hz)/r.cfHr)-off*slant/r.cfHr;
    for(const [mark,count,top] of [['⑥',b.finCut.nFul,r.cfHr],['⑥b',b.finCut.nCut,b.finCut.cutLen]]){
      if(!count)continue;
      const y0=hz+off,y1=hz+top-off;
      add(mark,b.barSize,null,ribZ.flatMap(z=>Array.from({length:count},(_,j)=>{
        const total=b.finCut.nFul+b.finCut.nCut,index=j+(mark==='⑥b'?b.finCut.nFul:0);
        const perLayer=b.nPerLayer||total,layer=Math.floor(index/perLayer);
        const inLayer=Math.min(perLayer,total-layer*perLayer),slot=index%perLayer;
        const zz=inLayer===1?z:z-i.bs/2+off+(i.bs-2*off)*slot/(inLayer-1);
        const inset=layer*((b.clrMin||25)+b.barSize)/1000*slant/r.cfHr;
        return [[xAt(y0)-inset,y0,zz],[xAt(y1)-inset,y1,zz]];})),'rib');
    }
    for(const mark of ['⑦a','⑦b']){
      const db=row(mark).size,off=c+db/2000,paths=[];
      for(const z of ribZ){
        if(mark==='⑦a')for(const y of positions(hz+off,hz+r.cfHr-off,srow(mark)/1000)){
          const xEnd=xAt(y)-b.barSize/1000;
          if(xEnd>xB+off)paths.push([[xF+off,y,z-i.bs/2+off],[xEnd,y,z-i.bs/2+off],
            [xEnd,y,z+i.bs/2-off],[xF+off,y,z+i.bs/2-off]]);
        }else for(const x of positions(xB+off,xB+r.cfLr-off,srow(mark)/1000)){
          const yEnd=hz+r.cfHr*(1-(x-xB)/r.cfLr)-off*slant/r.cfLr;
          if(yEnd>hz+off)paths.push([[x,.075+db/2000,z-i.bs/2+off],[x,yEnd,z-i.bs/2+off],
            [x,yEnd,z+i.bs/2-off],[x,.075+db/2000,z+i.bs/2-off]]);
        }
      }
      add(mark,db,srow(mark),paths,'rib-ties');
    }
  }else{
    const main=r.stemTab.at(-1).bar;
    vertical('①',main.db,main.s,'back');vertical('②',row('②').size,srow('②'),'front');
    const db=row('③').size,s=srow('③');
    for(const face of ['front','back'])add('③',db,s,
      positions(hz+c+db/2000,hz+h-c-db/2000,s/1000).map(y=>{
        const x=face==='back'?back(y)-c-main.db/1000-db/2000:xF+c+row('②').size/1000+db/2000;
        return [[x,y,c+db/2000],[x,y,L-c-db/2000]];
      }),face);
    cross('④',r.barH_,r.dH,xB,B-.075-r.barH_.db/2000);
    const db6=row('⑥').size;
    along('⑥',db6,srow('⑥'),r.dH-r.barH_.db/2000-db6/2000,.075+db6/2000,B-.075-db6/2000);
    along('⑥',db6,srow('⑥'),hz-r.dT+r.barT.db/2000+db6/2000,.075+db6/2000,B-.075-db6/2000);
  }
  if(i.toe>.075+r.barT.db/2000)cross('⑤',r.barT,hz-r.dT,.075+r.barT.db/2000,xF);
  const base8=requireTransverseBaseLayout(r);add('⑧',base8.db,base8.spacing*1000,base8.paths,'base-x-inner');
  if(r.keyChk?.bar&&i.dk>0){const k=r.keyChk,b=k.bar,d=b.db/1000;
    add('K1',b.db,b.s,positions(c+d/2,L-c-d/2,b.s/1000).map(z=>[
      [xF+.075+d/2,.075,z],[xF+.075+d/2,-i.dk+.075+d/2,z],
      [xB-.075-d/2,-i.dk+.075+d/2,z],[xB-.075-d/2,.075,z]]),'key');
  }
  return {schema:'rw-design-rebar-axes/1',source:'engine.selectedBars',
    purpose:'DESIGN_ILLUSTRATION',fabricationAuthority:false,groups,
    label:'ตำแหน่งและทิศเหล็กออกแบบ · DB/ระยะจากผลคำนวณ · ไม่ใช่รายการตัดดัด'};
}

/** Front RB cages only, in the soldier scene's world metre frame.
 * Bar centers/diameters come from the Engine's frozen nominal detail.
 * Rectangular link axes illustrate placement, not hooks or cut lengths. */
export function buildSoldierDesignRebarLayout(r){
  const groups=[];
  for(const b of r.capD?.beams||[]){
    if(!b.present||!b.detailing?.physicalOK)continue;
    const d=b.detailing,y=b.name==='RB1'?r.H:b.name==='RB2'?r.H-r.a:0;
    const world=([x,yy],z)=>[x/1000-b.bw/2,y-b.bh/2+yy/1000,z];
    const end=(d.cover+b.db/2)/1000;
    for(const [face,centers]of [['top',d.top],['bottom',d.bottom]])groups.push({
      mark:b.name,face,db:b.db,source:'engine.capD.detailing',
      paths:centers.map(p=>[world(p,-r.Lw/2+end),world(p,r.Lw/2-end)]),
    });
    const n=r.qty?.bbs?.find(row=>row.mk===b.name+'s')?.n;
    if(!Number.isInteger(n)||n<1)throw new TypeError('RB cage requires its Engine stirrup quantity');
    const linkEnd=(d.cover+b.linkDb/2)/1000;
    const step=n>1?Math.min(b.linkSp/1000,(r.Lw-2*linkEnd)/(n-1)):0;
    groups.push({mark:b.name+'-ties',face:'link',db:b.linkDb,source:'engine.capD.detailing',
      schematicHooks:true,spacing:step*1000,
      paths:Array.from({length:n},(_,j)=>d.link.map(p=>world(p,-step*(n-1)/2+j*step))),
    });
  }
  return {schema:'rw-design-rebar-axes/1',source:'engine.capD.detailing',frame:'soldier-world-metres',
    purpose:'DESIGN_ILLUSTRATION',fabricationAuthority:false,groups,
    label:groups.length?'เหล็กคานตามแนวกำแพงที่เลือก · ไม่แสดงขอ/ระยะยึดเหนี่ยว/เหล็กสเตย์และแคปสมอ':'ไม่มีคานตามแนวกำแพง · ยังไม่แสดงเหล็กสเตย์/แคปสมอ'};
}

export function buildDuckDesignRebarLayout(i,r){
  const groups=[],c=i.cov/1000,span=(i.nPosts-1)*i.postSpacing;
  const beamTop=r.geometry.beamTop;
  const run=(a,b,s)=>{const n=Math.max(1,Math.ceil((b-a)/s));return Array.from({length:n+1},(_,j)=>a+(b-a)*j/n);};
  const add=(mark,db,paths)=>{if(paths.length)groups.push({mark,db,paths,source:'engine.selectedBars'});};
  const col=r.column,beam=r.beamDesign,foot=r.footing;
  for(let j=0;j<i.nPosts;j++){
    const z=-span/2+j*i.postSpacing;
    if(col.fit){
      const off=c+.01+col.db/2000,paths=[];
      for(const x of [off,i.t-off])for(const zz of run(z-i.colDepth/2+off,z+i.colDepth/2-off,
        (i.colDepth-2*off)/Math.max(col.n/2-1,1)))paths.push([[x,0,zz],[x,i.hp-c-col.db/2000,zz]]);
      add('C1',col.db,paths);
      const tieOff=c+.005;
      add('C1-ties',10,run(c,i.hp-c,col.tie.spacing/1000).map(y=>[
        [tieOff,y,z-i.colDepth/2+tieOff],[i.t-tieOff,y,z-i.colDepth/2+tieOff],
        [i.t-tieOff,y,z+i.colDepth/2-tieOff],[tieOff,y,z+i.colDepth/2-tieOff],
        [tieOff,y,z-i.colDepth/2+tieOff]]));
    }
    if(foot?.barX.ok&&foot?.barY.ok){
      const X=foot.barX,Y=foot.barY,xoff=.075+X.db/2000,yoff=.075+X.db/1000+Y.db/2000;
      add('F1',X.db,[xoff,i.hz-xoff].flatMap(y=>run(z-i.capL/2+xoff,z+i.capL/2-xoff,X.spacing/1000)
        .map(zz=>[[xoff,y-i.hz,zz],[i.B-xoff,y-i.hz,zz]])));
      add('F2',Y.db,[yoff,i.hz-yoff].flatMap(y=>run(.075+Y.db/2000,i.B-.075-Y.db/2000,Y.spacing/1000)
        .map(x=>[[x,y-i.hz,z-i.capL/2-.0+.075+Y.db/2000],[x,y-i.hz,z+i.capL/2-.075-Y.db/2000]])));
    }
  }
  if(beam.ok){
    const off=c+.01+beam.db/2000,xs=run(off,i.beamB-off,(i.beamB-2*off)/Math.max(beam.n-1,1));
    add('GB1',beam.db,[off,i.beamH-off].flatMap(y=>xs.map(x=>[[x,beamTop-y,-span/2],[x,beamTop-y,span/2]])));
    if(beam.linkS>=50){const o=c+.005;
      add('GB1-ties',10,run(-span/2,span/2,beam.linkS/1000).map(z=>[
        [o,beamTop-o,z],[i.beamB-o,beamTop-o,z],[i.beamB-o,beamTop-i.beamH+o,z],
        [o,beamTop-i.beamH+o,z],[o,beamTop-o,z]]));
    }
  }
  return {schema:'rw-design-rebar-axes/1',source:'engine.selectedBars',purpose:'DESIGN_ILLUSTRATION',
    fabricationAuthority:false,groups,label:'ตำแหน่งและทิศเหล็กออกแบบ ไม่ใช่รายการตัดดัด'};
}
