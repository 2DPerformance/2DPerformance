/** Physical input projection only. Uses the same paper CAD renderer as accepted A4.
 * No Engine run, force, capacity, bar selection or accepted Snapshot is fabricated. */
import {inputGeometry} from './inputGeometry.mjs?rwv=20261003-main-equations-1';
import {drawing,poly,line,hatch,dim,text,levelMark,sectionMark,leader} from './drafting/cadPrimitives.js?rwv=20260930-load-units-1';
import {screenCadView,renderScreenCad} from './nativeCadScreen.mjs?rwv=20261003-cad-contour-1';
const point=(x,y)=>({x:x*1000,y:y*1000});
const aliases={H:'hp',baseT:'hz',stemT:'t',wallLength:'Lw',cfSpan:'L',cfThick:'bs',cfDepth:'cfL',cfHeight:'cfH'};
const positive=(v,f)=>Number.isFinite(+v)&&+v>0?+v:f;
export function inputCadView(type,raw,view='section',selected='') {
  const i={...raw};for(const [a,b] of Object.entries(aliases))if(raw[a]!=null)i[b]=raw[a];
  const {g,parts}=inputGeometry(type,i),field=aliases[selected]||selected;
  return scale=>{
    const E=[],seen=new Set(),piled=['pile','pilecf'].includes(type),duck=type==='duckfoot',soldier=type==='soldier';
    const path=(points,kind='concrete',pc='CUT')=>{
      const pts=points.map(p=>point(...p)),key=kind+JSON.stringify(pts);if(seen.has(key))return;seen.add(key);
      const layer=kind==='soil'?'RW-SOIL':kind==='pile'?'RW-PILE':'RW-CONCRETE';
      if(pc==='CUT'||kind==='soil')E.push(hatch(pts,kind==='soil'?'SOIL_FILL':'CONCRETE',kind==='soil'?'RW-SOIL':'RW-HATCH'));
      E.push(poly(pts,pc,layer,true));
    };
    const rectangle=(x,y,w,h,kind,pc)=>path([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],kind,pc);
    const dimension=(key,a,b,off,vertical=false,note=key)=>{
      const value=vertical?Math.abs(b[1]-a[1]):Math.abs(b[0]-a[0]);if(value<1e-8)return;
      E.push(dim(point(...a),point(...b),off*scale,'RW-DIM',{vertical,note,chain:'input:'+key}));
    };
    for(const p of parts){
      if(['ground','boundary','soil'].includes(p.kind))continue;
      if(p.position){const [x,y,z]=p.position,[w,h,d]=p.size;
        if(view==='plan')rectangle(z-d/2,x-w/2,d,w,p.kind,p.kind==='pile'||p.kind==='base'&&duck?'HIDDEN':p.kind==='wall'?'CUT':'OUTLINE');
        else rectangle(x-w/2,y-h/2,w,h,p.kind,['pile','wall'].includes(p.kind)&&soldier?'OUTLINE':'CUT');
      }else if(p.polygon){
        if(view==='section')path(p.polygon,p.kind,p.kind==='rib'?'OUTLINE':'CUT');
        else{const xs=p.polygon.map(a=>a[0]);rectangle(p.z,Math.min(...xs),p.depth,Math.max(...xs)-Math.min(...xs),p.kind,p.kind==='wall'?'CUT':'OUTLINE');}
      }else if(p.member||p.line){
        const m=p.member,a=m?['x','y','z'].map(k=>m.front[k]):p.line[0],b=m?['x','y','z'].map(k=>m.rear[k]):p.line[1];
        const aa=view==='section'?a.slice(0,2):[a[2],a[0]],bb=view==='section'?b.slice(0,2):[b[2],b[0]],depth=m?(view==='section'?m.depth:m.width):p.diameter;
        const dx=bb[0]-aa[0],dy=bb[1]-aa[1],len=Math.hypot(dx,dy);
        if(len>1e-8){const nx=-dy/len*depth/2,ny=dx/len*depth/2;
          path([[aa[0]+nx,aa[1]+ny],[bb[0]+nx,bb[1]+ny],[bb[0]-nx,bb[1]-ny],[aa[0]-nx,aa[1]-ny]],p.kind,'OUTLINE');
          E.push(line(point(...aa),point(...bb),'CENTRELINE','RW-CENTRE'));
        }
      }
    }
    const H=g.hp,L=g.Lw||g.beamSpan,B=g.B||Math.max(2,g.stayLength+1.2),bottom=soldier?-g.embed:piled?-g.hz-positive(i.pileEmb,6):-g.hz;
    if(view==='section'){
      if(duck){path([[0,-g.hz],[B+.3,-g.hz],[B+.3,-g.hz-.3],[0,-g.hz-.3]],'soil','PROJECTION');
        E.push(line(point(-.08,bottom-.3),point(-.08,H+.1),'CENTRELINE','RW-BOUNDARY'));
        dimension('beamClear',[g.beamB,0],[g.beamB,g.beamBottom],9,true,'c');
        dimension('beamH',[g.beamB,g.beamBottom],[g.beamB,g.beamTop],19,true,'hb');
        E.push(leader([point(g.beamB,g.beamAxis),point(B+.015*scale,g.beamTop+.018*scale),point(B+.018*scale,g.beamTop+.018*scale)],'GB1 '+Math.round(g.beamB*1000)+'×'+Math.round(g.beamH*1000),2.8,'RW-TEXT'));
      }else{const back=soldier?g.pileB/2:g.toe+g.t,crest=soldier?back:g.toe+g.ttop,reach=soldier?B:Math.max(B,back+.5),rise=(reach-back)*Math.tan((+i.beta||0)*Math.PI/180);
        path([[back,0],[reach,0],[reach,H+rise],[crest,H]],'soil','PROJECTION');
      }
      dimension('hp',[soldier?-g.pileB/2:0,0],[soldier?-g.pileB/2:0,H],-16,true,'H');
      if(!soldier){dimension('B',[0,bottom],[B,bottom],-18,false,'B');dimension('hz',[B,-g.hz],[B,0],8,true,'hz');dimension('t',[g.toe||0,H],[(g.toe||0)+(g.ttop||g.t),H],8,false,'t');
        if(!duck){dimension('toe',[0,bottom],[g.toe,bottom],-7,false,'Toe');dimension('heel',[g.toe+g.t,bottom],[B,bottom],-7,false,'Heel');}
        if(piled)dimension('pileEmb',[B,-g.hz],[B,bottom],19,true,'Le');
      }else{dimension('pileEmbS',[-g.pileB/2,bottom],[-g.pileB/2,0],-16,true,+i.pileEmbS>0?'D':'D~');
        if(g.staySystem!=='cant'){dimension('stayLb',[0,H],[g.stayLength,H],12,false,+i.stayLb>0?'Lb':'Lb~');dimension('stayLvl',[g.pileB/2,H-g.stayLevel],[g.pileB/2,H],8,true,+i.stayLvl>0?'a':'a~');}
      }
      const legacy=['cantilever','counterfort','gravity'].includes(type),datumShift=legacy?g.hz:0;
      const lv=value=>E.push({...levelMark(point(B+.030*scale,value),(value+datumShift)*1000,'RW-DIM'),textHeight:2.8});lv(0);if(legacy)lv(-g.hz);if(!duck)lv(H);
    }else{
      const z0=-L/2,z1=L/2;
      dimension('Lw',[z0,0],[z1,0],-15,false,duck?'แนวเสา':'Lw');
      if(!soldier)dimension('B',[z1,0],[z1,B],13,true,'B');
      if(duck)dimension('postSpacing',[z0,0],[z0+g.postSpacing,0],-6,false,'S');
      if(soldier)dimension('pileS',[z0,0],[z0+Math.min(g.pileS,L),0],-6,false,'S');
      E.push({...sectionMark(point(0,-.012*scale),point(0,B+.012*scale),'A','RW-MARK'),textHeight:2.8});
    }
    // Show the selected component size in an uncluttered paper label, rather
    // than inventing a leader endpoint for non-geometric fields (loads/material).
    if(field&&Number.isFinite(+i[field])&&i[field]!=='')E.push(text(point(view==='plan'?-L/2:0,bottom-.036*scale),field+' = '+i[field]+(['cov','ipile','tLag'].includes(field)?' (หน่วยตามช่องกรอก)':' (ค่ากรอก)'),2.8,'RW-INPUT-TEXT'));
    return drawing('RW-INPUT-'+view.toUpperCase(),'แบบประกอบการกรอก',E,{draft:true,type,physicalUnits:'mm',selectedField:field,noCalculatedResults:true});
  };
}
export function renderInputCadView(type,input,field,view='section'){
  const cad=screenCadView(inputCadView(type,input,view,field),view,{type,draft:true});
  return renderScreenCad(cad,view,'draft-'+type,{draft:true,field});
}
