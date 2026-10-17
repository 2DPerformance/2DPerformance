import { soldierStayGeometry,soldierCapGeometry } from './engine.mjs?rwv=20261003-main-equations-1&stay=20261004-alternate-1';
import { duckfootGeometry, DUCK_BEAM_CLEAR_DEFAULT } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { rearPileCaps } from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import {resultUnits} from './resultUnits.mjs?rwv=20261002-legacy-output-units-1';
import {textWidthEm} from './drafting/textMetrics.js?rwv=20260930-load-units-1';
import {clearAnnotationSegments} from './drafting/dimensionLinework.mjs?rwv=20261001-leader-layout-1';
import {RB_DETAIL_DEFAULTS,soldierBarInset} from './soldierBeamDetailing.mjs?rwv=20261003-main-equations-1';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(+v)&&v!==''?Number((+v).toFixed(2)).toString():'—';
const positive=(v,f)=>Number.isFinite(+v)&&+v>0?+v:f;
const aliases={H:'hp',baseT:'hz',stemT:'t',wallLength:'Lw',cfSpan:'L',cfThick:'bs',cfDepth:'cfL',cfHeight:'cfH',waterH:'waterH',frontDepth:'Df',cover:'cov'};
const planKeys=new Set(['Lw','L','bs','cfL','pileSt','pileSh','pileEdT','pileEdH','capL','postSpacing','nPosts','colDepth','pileS']);
const names={hp:'H · ความสูงเหนือฐาน / ระดับขุด',hz:'hz · ความหนาฐาน',t:'t · ความหนาพนัง / เสากว้าง',ttop:'ttop · ความหนาพนังยอด',B:'B · ความกว้างฐานรวม',toe:'Toe · ฐานยื่นด้านหน้า',heel:'Heel · ฐานยื่นด้านหลัง',Lw:'Lw · ความยาวตามแนวกำแพง',L:'L · ช่วงใสระหว่างครีบ',bs:'bs · ความหนาครีบ',cfL:'cfL · ความลึกครีบจากหลังพนัง',cfH:'cfH · ความสูงครีบเหนือฐาน',pileB:'Bp · ขนาดเข็ม',pileEmb:'Le · ความยาวเข็มใต้ฐาน',pileEdT:'eT · ขอบฐานถึงศูนย์เข็ม Toe',pileEdH:'eH · ขอบฐานถึงศูนย์เข็ม Heel',pileSt:'sT · ระยะศูนย์เข็มแถว Toe',pileSh:'sH · ระยะศูนย์เข็มแถว Heel',pileS:'S · ระยะศูนย์เข็มหน้า',pileEmbS:'D · ระยะฝังใต้ระดับขุด',ipile:'I · ขนาดหน้าตัดเข็มหน้า',tLag:'tLag · ความหนาแผ่นเสียบ',stayLvl:'a · ลึกจากยอดถึงจุดยึดสเตย์',stayLb:'Lb · ระยะฉายราบถึงศูนย์สมอ',capLvl:'hcap · ลึกจากยอดถึงหัวเข็มสมอ',ancLe:'La · หัวถึงปลายเข็มสมอ',ancPileSec:'Ia · ขนาดเข็มสมอ',stayBw:'b · สเตย์กว้าง',stayBh:'h · สเตย์ลึก',stayAng:'α · มุมสมอจากแนวราบ',gaFreeLength:'Lfree · ความยาวตามแนวสมอ',gaBondLength:'Lbond · ช่วงยึดเหนี่ยวตามแนวสมอ',gaBondDia:'Øgrout · ขนาดช่วงยึดเหนี่ยว',capL:'Lpad · ฐานยาวตามแนวเขต',postSpacing:'Spost · ระยะศูนย์เสาตามแนวเขต',nPosts:'n · จำนวนเสาในแนวเดียวกัน',colDepth:'dc · เสาลึกตามแนวเขต',beamB:'bb · คานตีนเสากว้าง',beamH:'hb · คานตีนเสาลึก',zw:'zw · น้ำลึกจากผิวดิน',waterH:'Hw · ระดับน้ำสูงเหนือฐาน',Df:'Df · ดินด้านหน้าสูงจากท้องฐาน',cov:'cover · ระยะหุ้มคอนกรีต'};
planKeys.add('ancCapL');planKeys.add('stayPattern');
Object.assign(names,{ancCapB:'Bc · แคปกว้างตามแกน X',ancCapL:'Lc · แคปยาวตามแกน Z',ancCapH:'hc · ความหนาแคป',ancDowelDb:'APd · เส้นผ่านศูนย์กลางเหล็กเดือย',ancDowelN:'APd · จำนวนเดือยต่อสมอ (0=Engine เลือก)'});
names.beamClear='c · ผิวบน footing ถึงท้องคาน';
names.rbCover='c · ระยะหุ้มคาน RB ถึงผิวนอกปลอก';names.rbAgg='dagg · ขนาดมวลรวมหยาบสูงสุดคาน RB';
for(const p of ['rb1','rb2','rb3'])for(const [suffix,name]of Object.entries({Bw:'b · ความกว้างคาน',Bh:'h · ความลึกคาน',Db:'DB · เหล็กหลัก',Nt:'เหล็กบน',Nb:'เหล็กล่าง',Ldb:'RB · เหล็กปลอก',Lsp:'s · ระยะปลอก'}))names[p+suffix]=p.toUpperCase()+' · '+name;

function soldierBeamGuide(g,active,i){
  const p=painter(active),beam=/^rb[123]/.test(active)?g.capBeams.find(b=>b.mark.toLowerCase()===active.slice(0,3)):g.capBeams[0];
  if(!beam){p.text(220,160,'ไม่มีคานระดับนี้ในระบบที่เลือก');return p.svg('คานรัด · ไม่มีสมาชิกระดับนี้');}
  const sy=170/g.hp,Y=y=>55+(g.hp-y)*sy;
  p.line(85,55,85,225,'#647f94',10);
  for(const b of g.capBeams){const y=Y(b.y);p.rect(67,y-5,36,10,b===beam?'#c26b2e':'#8ea4b7');p.text(115,y+4,b.mark,b===beam?'#a74b12':'#536b7d','start');}
  p.text(90,270,'แนวตั้งเข็มหน้า');
  const scale=Math.min(110/beam.width,135/beam.depth),x=270-beam.width*scale/2,y=135-beam.depth*scale/2;
  p.rect(x,y,beam.width*scale,beam.depth*scale,'url(#rw-concrete)');
  p.dim(beam.prefix+'Bw',x,40,x+beam.width*scale,40,'b '+num(beam.width*100)+' cm');
  p.dim(beam.prefix+'Bh',365,y,365,y+beam.depth*scale,'h '+num(beam.depth*100)+' cm',{x:385,y:138});
  const cover=Number(Object.hasOwn(i,'rbCover')?i.rbCover:RB_DETAIL_DEFAULTS.rbCover);
  const agg=Number(Object.hasOwn(i,'rbAgg')?i.rbAgg:RB_DETAIL_DEFAULTS.rbAgg);
  const db=positive(i[beam.prefix+'Db'],16),dt=positive(i[beam.prefix+'Ldb'],9),inset=soldierBarInset(cover,dt,db)/1000;
  if(Number.isFinite(cover)&&cover>=25&&inset<Math.min(beam.width,beam.depth)/2){
    const o=(cover+dt/2)/1000*scale;
    p.add('<rect x="'+(x+o)+'" y="'+(y+o)+'" width="'+(beam.width*scale-2*o)+'" height="'+(beam.depth*scale-2*o)+'" fill="none" stroke="#a74b12" stroke-width="1"/>');
    for(const [suffix,yy]of [['Nt',inset],['Nb',beam.depth-inset]]){
      const count=Number(i[beam.prefix+suffix]);
      if(!Number.isInteger(count)||count<2||count>100)continue;
      for(let j=0;j<count;j++)p.add('<circle data-input-rb-bar="'+suffix+'" cx="'+(x+(inset+j*(beam.width-2*inset)/(count-1))*scale)+'" cy="'+(y+yy*scale)+'" r="'+(db/2000*scale)+'" fill="#a74b12"/>');
    }
  }
  p.text(270,235,beam.mark+' · รูปตัดคานตามแนวกำแพง');
  p.text(270,262,'c '+(i.rbCover===''?'—':num(cover))+' · dagg '+(i.rbAgg===''?'—':num(agg))+' mm');
  p.text(220,300,'จุดเหล็กตามที่กรอก · จำนวน Auto รอคำนวณ');
  return p.svg(beam.mark+' · ตำแหน่งและรูปตัดคานรัด');
}

function painter(active=''){
  let body='<defs><pattern id="rw-concrete" width="13" height="13" patternUnits="userSpaceOnUse"><path d="m2 3 2-1 1 3zM9 10l2-2" fill="none" stroke="#8298ac" stroke-width=".55" opacity=".55"/></pattern><pattern id="rw-soil" width="10" height="10" patternUnits="userSpaceOnUse"><path d="m0 8 3-3m3 5 4-4" stroke="#a49371" stroke-width=".6" opacity=".55"/></pattern></defs>';
  const boxes=[],annotations=[];
  const text=(x,y,s,color='#30485c',anchor='middle')=>{
    // Reserve fallback-font width too; the input guide can load before Sarabun.
    const w=textWidthEm(String(s))*12*1.2,left=x-(anchor==='end'?w:anchor==='middle'?w/2:0);
    boxes.push({min:{x:left-2,y:y-18},max:{x:left+w+2,y:y+6}});
    body+=`<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" font-size="12" paint-order="stroke" stroke="#f9fbfd" stroke-width="3" stroke-linejoin="round">${esc(s)}</text>`;
  };
  const line=(x1,y1,x2,y2,color='#38536b',width=1.5,dash='')=>body+=`<path d="M${x1} ${y1}L${x2} ${y2}" fill="none" stroke="${color}" stroke-width="${width}" ${dash?'stroke-dasharray="'+dash+'"':''}/>`;
  const annotationLine=(x1,y1,x2,y2,color='#637789',width=1)=>{
    const token='<!--rw-annotation-'+annotations.length+'-->';
    annotations.push({token,a:{x:x1,y:y1},b:{x:x2,y:y2},color,width});body+=token;
  };
  const rect=(x,y,w,h,fill='#cbd6df')=>{body+=`<rect x="${x}" y="${y}" width="${Math.max(.1,w)}" height="${Math.max(.1,h)}" fill="${fill}" stroke="#536b7d" stroke-width="1"/>`;if(['#cbd6df','#e7e0ce','#e3e9ee'].includes(fill))body+=`<rect x="${x}" y="${y}" width="${Math.max(.1,w)}" height="${Math.max(.1,h)}" fill="url(#${fill==='#e7e0ce'?'rw-soil':'rw-concrete'})"/>`;};
  const dot=(x,y)=>body+=`<circle data-support="connection" cx="${x}" cy="${y}" r="3.5" fill="#fff" stroke="#b85c24" stroke-width="2"/>`;
  const dim=(key,x1,y1,x2,y2,label,placement=null)=>{
    const color=key===active?'#b34815':'#637789',dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*4,ny=dx/L*4;
    body+=`<g data-dimension="${key}" data-active="${key===active}">`;
    annotationLine(x1,y1,x2,y2,color,key===active?2:1);annotationLine(x1-nx,y1-ny,x1+nx,y1+ny,color);annotationLine(x2-nx,y2-ny,x2+nx,y2+ny,color);
    // Short end extensions distinguish dimensions from physical member edges.
    if(Math.abs(dy)<.1){annotationLine(x1,y1-5,x1,y1+5,color,.7);annotationLine(x2,y2-5,x2,y2+5,color,.7);}
    if(placement){annotationLine((x1+x2)/2,(y1+y2)/2,placement.x-5,placement.y-4,color,.7);text(placement.x,placement.y,label,color,'start');}
    else if(Math.abs(dx)<.1)text(x1-7,(y1+y2)/2+4,label,color,'end');else text((x1+x2)/2,(y1+y2)/2-7,label,color);
    body+='</g>';
  };
  return {text,line,rect,dot,dim,annotationLine,add:s=>body+=s,svg:(title)=>{
    let drawing=body;
    for(const item of annotations){
      const segments=clearAnnotationSegments([{a:item.a,b:item.b}],boxes);
      drawing=drawing.replace(item.token,segments.length?`<path data-annotation="dimension" d="${segments.map(({a,b})=>`M${a.x} ${a.y}L${b.x} ${b.y}`).join(' ')}" fill="none" stroke="${item.color}" stroke-width="${item.width}"/>`:'');
    }
    const x=Math.min(0,...boxes.map(b=>b.min.x-3)),y=Math.min(0,...boxes.map(b=>b.min.y-3));
    const maxX=Math.max(440,...boxes.map(b=>b.max.x+3)),maxY=Math.max(270,...boxes.map(b=>b.max.y+3));
    return `<svg class="rw-cad-input" data-cad-guide="true" xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${maxX-x} ${maxY-y}" role="img" aria-label="${esc(title)}" style="font-family:Sarabun,Prompt,sans-serif;background:#fcfdfe"><title>${esc(title)}</title><style>
      .rw-cad-input rect[fill="#cbd6df"],.rw-cad-input rect[fill="#e3e9ee"]{fill:#f4f6f8}
      .rw-cad-input rect[fill="#91a8ba"],.rw-cad-input rect[fill="#8ba3b5"],.rw-cad-input rect[fill="#869eb1"],.rw-cad-input path[fill="#91a8ba"],.rw-cad-input path[fill="#678ba6"],.rw-cad-input path[fill="#67879c"]{fill:#e4e9ed;opacity:1}
      .rw-cad-input rect[fill="#e7e0ce"],.rw-cad-input path[fill="#e7e0ce"]{fill:#f4f1e9}
      .rw-cad-input [data-support="connection"]{fill:#fcfdfe;stroke:#243747;stroke-width:1.2}
      .rw-cad-input [data-active="true"] [data-annotation]{stroke:#a64e19}
    </style>${drawing}</svg>`;
  }};
}

// Used by both the live input guide and the immutable calculated drawings.
export function soldierDrawing(g,view='section',active='',labels={}){
  const p=painter(active),v=(key,symbol,value)=>{const label=labels[key]??num(value);return symbol+' '+label+(label==='Auto'?'':' m');};
  const H=g.hp,D=g.embed,layout=g.stayLayout,a=g.stayLevel;
  if(view==='plan'){
    const setback=g.staySystem==='stay'?g.stayLength:(g.anchor?.totalLength||0)*Math.cos((g.anchor?.angle||20)*Math.PI/180);
    const scale=Math.min(320/g.Lw,140/Math.max(setback,1)),x=z=>220+z*scale,y=x=>66+x*scale;
    p.line(x(-g.Lw/2),y(0),x(g.Lw/2),y(0),'#91a3b2',8);
    const count=Math.ceil(g.Lw/g.pileS-1e-9)+1;
    const fronts=layout?.fronts||Array.from({length:count},(_,k)=>({z:Math.min(k*g.pileS,g.Lw)-g.Lw/2}));
    for(const f of fronts)p.rect(x(f.z)-3,y(0)-6,6,12,'#385875');
    for(const m of layout?.members||[])p.line(x(m.front.z),y(m.front.x),x(m.rear.z),y(m.rear.x),'#496b84',3);
    for(const ap of layout?.anchors||[]){const cap=(g.rearCaps||rearPileCaps(layout))[ap.id],w=cap.size[2]*scale,h=cap.size[0]*scale;p.rect(x(ap.head.z)-w/2,y(ap.head.x)-h/2,w,h,'#cbd6df');p.dot(x(ap.head.z),y(ap.head.x));}
    if(layout?.anchors?.length){
      const cap=(g.rearCaps||rearPileCaps(layout))[0],cx=x(cap.position[2]),cy=y(cap.position[0]);
      p.annotationLine(cx,cy-5,314,43,'#536b7d',1);
      p.text(320,25,'แคปสมอ · รูปประกอบ','#355675','start');
      p.text(320,47,'ไม่ตรวจดัด/เฉือน/เหล็ก','#355675','start');
      if(active==='ancCapL')p.dim('ancCapL',cx-cap.size[2]*scale/2,cy+cap.size[0]*scale/2+20,cx+cap.size[2]*scale/2,cy+cap.size[0]*scale/2+20,'Lc '+num(cap.size[2])+' m');
    }
    if(g.staySystem==='anchor')for(const f of fronts){p.line(x(f.z),y(0),x(f.z),y(setback),'#ad6c30',2);p.dot(x(f.z),y(0));}
    const cut=x(g.Lw*.28-g.Lw/2);
    p.line(cut,y(0)-17,cut,Math.min(225,y(Math.max(setback,0))+7),'#a75224',1,'6 3');
    p.text(cut+8,y(0)-12,'A','#a75224','start');
    p.text(cut+8,Math.min(232,y(Math.max(setback,0))+14),'A','#a75224','start');
    p.dim('pileS',x(fronts[0].z),43,x(fronts[1].z),43,v('pileS','S',g.pileS));
    p.dim('Lw',x(-g.Lw/2),250,x(g.Lw/2),250,v('Lw','Lw',g.Lw));
    if(layout){p.text(220,275,'แคปหัวเข็มหลังเป็นรูปประกอบ · ไม่ตรวจดัด/เฉือน/เหล็ก');p.text(220,301,'V: 2 เข็มหน้า / 1 สมอ · ปลายคี่มีสมอแยก');}
    return p.svg('Plan · ผังเข็มหน้าและระบบยึดรั้ง');
  }
  const rearTip=g.staySystem==='anchor'?H-a-(g.anchor?.totalLength||0)*Math.sin((g.anchor?.angle||20)*Math.PI/180):(layout?.anchors?.[0]?.tip.y??-D);
  const extent=g.staySystem==='anchor'?(g.anchor?.totalLength||g.stayLength)*Math.cos((g.anchor?.angle||20)*Math.PI/180):g.stayLength;
  const draft=Object.keys(labels).length>0;
  // One metric scale for lengths AND sections; never squash member thickness.
  // Keep short input previews in a wider context instead of magnifying I40/25x50.
  const total=H+Math.max(D,-rearTip),scale=Math.min(draft?20:Infinity,180/total,155/Math.max(extent+g.pileB+.4,2));
  const top=52+Math.max(0,180-total*scale)/2,X=x=>126+x*scale,Y=y=>top+(H-y)*scale;
  p.add(`<g data-soldier-scale="${scale}" data-draft="${draft}">`);
  p.rect(X(0),Y(H),Math.min(278,Math.max(2.2,extent+1.2)*scale),H*scale,'#e7e0ce');
  p.line(50,Y(0),408,Y(0),'#98866b',1,'4 3');p.text(410,Y(0)-5,'ระดับขุด','#6b604f','end');
  p.add(`<g data-member="front-pile" data-width="${g.pileB}">`);
  p.rect(X(0)-g.pileB*scale/2,Y(H),g.pileB*scale,(H+D)*scale,'#91a8ba');p.add('</g>');
  p.line(X(0),Y(H),X(0),Y(-D),'#38536b',.7,'5 3');
  p.line(X(0)-10,Y(0),X(0)-10,Y(-D),'#c58e52',5);
  p.dim('hp',62,Y(H),62,Y(0),v('hp','H',H));
  p.dim('pileEmbS',91,Y(0),91,Y(-D),v('pileEmbS','D',D));
  if(g.staySystem==='stay'&&layout){
    const ap=layout.anchors[0],w=ap.width*scale;
    p.rect(X(ap.head.x)-w/2,Y(ap.head.y),w,layout.rearLength*scale,'#869eb1');
    const cap=(g.rearCaps||rearPileCaps(layout))[0];
    p.rect(X(cap.position[0]-cap.size[0]/2),Y(cap.position[1]+cap.size[1]/2),cap.size[0]*scale,cap.size[1]*scale,'#cbd6df');
    // Orthographic x-y projection of the same oriented V-stay box as 3D.
    const member=layout.members[0],u=member.direction,hn=Math.hypot(u[0],u[2]),up=[-u[0]*u[1]/hn,hn],across=[-u[2]/hn,0];
    const corners=[];
    for(const end of [member.front,member.rear])for(const signH of [-1,1])for(const signB of [-1,1])corners.push([
      end.x+signH*up[0]*member.depth/2+signB*across[0]*member.width/2,
      end.y+signH*up[1]*member.depth/2]);
    const sorted=corners.sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const half=points=>{const hull=[];for(const point of points){while(hull.length>1&&cross(hull.at(-2),hull.at(-1),point)<=0)hull.pop();hull.push(point);}return hull.slice(0,-1);};
    const outline=half(sorted).concat(half([...sorted].reverse()));
    p.add(`<path data-member="stay" data-width="${member.width}" data-depth="${member.depth}" d="${outline.map(([x,y],k)=>(k?'L':'M')+X(x)+' '+Y(y)).join('')}Z" fill="#678ba6" stroke="#365c7b" stroke-width="1"/>`);
    p.line(X(0),Y(layout.frontY),X(g.stayLength),Y(layout.rearY),'#365c7b',.7,'5 3');
    p.dot(X(0),Y(layout.frontY));p.dot(X(g.stayLength),Y(layout.rearY));
    if(active==='ancCapB')p.dim('ancCapB',X(cap.position[0]-cap.size[0]/2),Y(cap.position[1]+cap.size[1]/2)-18,X(cap.position[0]+cap.size[0]/2),Y(cap.position[1]+cap.size[1]/2)-18,'Bc '+num(cap.size[0])+' m',{x:328,y:196});
    if(active==='ancCapH')p.dim('ancCapH',X(cap.position[0]+cap.size[0]/2)+22,Y(cap.position[1]+cap.size[1]/2),X(cap.position[0]+cap.size[0]/2)+22,Y(cap.position[1]-cap.size[1]/2),'hc '+num(cap.size[1])+' m',{x:328,y:218});
    const capFocus=['ancCapB','ancCapH'].includes(active);
    const captionY=capFocus?30:Math.min(89,Y(0)-78);
    p.text(286,captionY,'ฐานหัวเข็มสมอ','#355675','start');
    p.text(286,captionY+22,'รูปประกอบ','#355675','start');
    p.text(286,captionY+44,'ไม่ตรวจดัด/เฉือน/เหล็ก','#355675','start');
    if(!capFocus)p.annotationLine(X(ap.head.x)+cap.size[0]*scale/2,Y(ap.head.y),280,captionY+46,'#637789',.7);
    p.dim('stayLb',X(0),52,X(g.stayLength),52,v('stayLb','Lb',g.stayLength));
    if(active==='capLvl')p.dim('capLvl',X(g.stayLength)+44,Y(H),X(g.stayLength)+44,Y(layout.rearY),v('capLvl','hcap',H-layout.rearY),H*scale<60?{x:286,y:187}:null);
    else if(!capFocus)p.dim('ancLe',X(g.stayLength)+52,Y(layout.rearY),X(g.stayLength)+52,Y(ap.tip.y),v('ancLe','La',layout.rearLength),H*scale<60?{x:286,y:187}:null);
    p.text(126,16,'เข็ม I'+num(g.pileB*100)+' cm · สเตย์ '+num(g.stayB*100)+' × '+num(g.stayH*100)+' cm','#30485c','start');
    if(['stayBw','stayBh'].includes(active)){p.rect(290,165,36,52);p.dim('stayBw',290,236,326,236,'b '+num(g.stayB*100)+' cm');p.dim('stayBh',372,165,372,217,'h '+num(g.stayH*100)+' cm');}
    p.text(220,260,draft?'หน้าตัดตามช่องกรอก · ระยะ Auto รอคำนวณ':'SECTION · ฉายสเตย์ลงระนาบรูปตัด');
  }else if(g.staySystem==='anchor'){
    const ga=g.anchor||{},ang=(ga.angle||20)*Math.PI/180,l=ga.freeLength||g.stayLength,b=ga.bondLength||1;
    const xf=l*Math.cos(ang),yf=H-a-l*Math.sin(ang),xe=(l+b)*Math.cos(ang),ye=H-a-(l+b)*Math.sin(ang);
    p.line(X(0),Y(H-a),X(xf),Y(yf),'#926631',2);p.line(X(xf),Y(yf),X(xe),Y(ye),'#667d8d',8);p.dot(X(0),Y(H-a));
    p.dim('gaFreeLength',X(0),Y(H-a)-16,X(xf),Y(yf)-16,v('gaFreeLength','Lfree',ga.freeLength));
    p.dim('gaBondLength',X(xf),Y(yf)+24,X(xe),Y(ye)+24,v('gaBondLength','Lbond',ga.bondLength));
    p.text(300,262,'α '+num(ga.angle)+'° จากแนวราบ · ไม่มีเข็มสมอ');
  }
  if(g.staySystem!=='cant')p.dim('stayLvl',X(0)+44,Y(H),X(0)+44,Y(H-a),v('stayLvl','a',a),H*scale<60?{x:286,y:164}:null);
  if(g.staySystem!=='stay')p.text(126,16,'เข็มหน้า I'+num(g.pileB*100)+' cm','#30485c','start');
  if(['ipile','ancPileSec','tLag','gaBondDia'].includes(active)){
    p.rect(264,166,143,76,'#fff');p.text(335,182,'ขยายหน้าตัด');
    if(active==='gaBondDia')p.add('<circle cx="330" cy="211" r="14" fill="#d5e1e9" stroke="#536b7d"/>');
    else if(active==='tLag')p.rect(308,194,44,8);
    else {p.rect(308,192,44,6);p.rect(325,198,10,21);p.rect(308,219,44,6);}
    p.dim(active,308,235,352,235,(active==='gaBondDia'?'Ø':active==='tLag'?'t':active==='ipile'?'I':'Ia')+' '+(labels[active]??num((active==='ipile'?g.pileB:layout?.anchors[0]?.width)*100)));
  }
  if(active==='stayAng'){
    const y=Y(H-a);p.line(X(0),y,X(0)+45,y,'#8fa0ab',1,'3 2');
    p.dim('stayAng',X(0)+38,y,X(0)+38,y+16,'α '+num(g.anchor?.angle)+'°');
  }
  p.add('</g>');
  return p.svg('Section · ระดับขุด เข็ม และจุดยึดรั้ง');
}

// One vertical datum for draft, calculated Plan/Section and A4.
export function duckfootDrawing(g,view='section',active='',contact=null,labels={}){
  const p=painter(active),n=key=>labels[key]??num(g[key]),v=(key,symbol)=>symbol+' '+n(key)+' m';
  if(view==='plan'){
    const length=g.beamSpan+g.capL,scale=Math.min(330/length,115/g.B),X=z=>55+z*scale,Y=x=>84+x*scale;
    p.line(45,Y(0)-8,401,Y(0)-8,'#b75c38',1,'4 3');
    p.text(55,18,'แนวเขต · เสาอยู่แนวเดียวกัน','#a65c34','start');
    for(let j=0;j<g.nPosts;j++){
      p.rect(X(j*g.postSpacing),Y(0),g.capL*scale,g.B*scale,'#e3e9ee');
    }
    p.add(`<g data-member="raised-beam" data-bottom="${g.beamBottom}" data-top="${g.beamTop}">`);
    p.rect(X(g.capL/2),Y(0),g.beamSpan*scale,g.beamB*scale,'#426986');p.add('</g>');
    for(let j=0;j<g.nPosts;j++){
      const centre=g.capL/2+j*g.postSpacing;
      p.rect(X(centre-g.colDepth/2),Y(0),g.colDepth*scale,g.t*scale,'#91a8ba');
      if(contact)p.dot(X(centre),Y(g.t/2));
    }
    const cut=X(g.capL/2);
    p.line(cut,Y(0)-10,cut,Y(g.B)+7,'#a75224',1,'6 3');
    p.text(cut+7,Y(0)-14,'A','#a75224','start');
    p.text(cut+7,Y(g.B)+15,'A','#a75224','start');
    p.dim('postSpacing',X(g.capL/2),47,X(g.capL/2+g.postSpacing),47,v('postSpacing','S'));
    const key=active==='colDepth'?'colDepth':'capL',start=key==='colDepth'?(g.capL-g.colDepth)/2:0;
    p.dim(key,X(start),Y(g.B)+57,X(start+g[key]),Y(g.B)+57,v(key,key==='colDepth'?'dc':'Lpad'));
    const captionY=Math.max(238,Y(g.B)+78);
    p.text(220,captionY,'คานเหนือฐาน · '+n('beamB')+' × '+n('beamH')+' m · '+n('nPosts')+' เสา');
    p.text(220,captionY+26,'สีเทาอ่อน = footing ใต้คาน');
    return p.svg('Plan · คานเชื่อมเสาเหนือ footing');
  }
  const scale=Math.min(176/(g.hp+g.hz),250/g.B),X=x=>104+x*scale,Y=y=>36+(g.hp-y)*scale;
  p.line(X(0)-6,23,X(0)-6,225,'#b75c38',1,'4 3');
  p.rect(X(0),Y(0),g.B*scale,g.hz*scale,'#cbd6df');
  p.add(`<path d="M${X(0)} ${Y(-g.hz)+2}h${g.B*scale}" data-support="soil-bearing" stroke="#b68b55" stroke-width="4"/>`);
  p.rect(X(0),Y(g.hp),g.t*scale,g.hp*scale,'#91a8ba');
  p.add(`<g data-member="raised-beam" data-bottom="${g.beamBottom}" data-top="${g.beamTop}">`);
  p.rect(X(0),Y(g.beamTop),g.beamB*scale,g.beamH*scale,'#426986');p.add('</g>');
  p.annotationLine(X(g.beamB)+3,Y(g.beamAxis),252,Y(g.beamAxis),'#426986',1);
  p.text(256,Y(g.beamAxis)-3,'หน้าตัดขวางคาน','#30485c','start');
  p.text(256,Y(g.beamAxis)+13,'bb×hb '+n('beamB')+'×'+n('beamH')+' m','#30485c','start');
  p.dim('hp',64,Y(g.hp),64,Y(0),v('hp','H'));
  const dimensionX=X(g.B)+40;
  let clearanceY=(Y(g.beamBottom)+Y(0))/2+4,thicknessY=(Y(0)+Y(-g.hz))/2+4;
  const extra=Math.max(0,22-(thicknessY-clearanceY))/2;
  clearanceY-=extra;thicknessY+=extra;
  clearanceY=Math.max(clearanceY,Y(g.beamAxis)+35);
  thicknessY=Math.max(thicknessY,clearanceY+26);
  p.dim('beamClear',dimensionX,Y(g.beamBottom),dimensionX,Y(0),v('beamClear','c'),{x:dimensionX+10,y:clearanceY});
  p.dim('hz',dimensionX,Y(0),dimensionX,Y(-g.hz),v('hz','hz'),{x:dimensionX+10,y:thicknessY});
  p.dim('B',X(0),237,X(g.B),237,v('B','B'));
  if(active==='beamH')p.dim('beamH',X(0)+70,Y(g.beamTop),X(0)+70,Y(g.beamBottom),v('beamH','hb'));
  if(active==='beamB')p.dim('beamB',X(0),Y(g.beamTop)-15,X(g.beamB),Y(g.beamTop)-15,v('beamB','bb'));
  if(active==='t')p.dim('t',X(0),23,X(g.t),23,v('t','t'));
  if(contact){
    p.dot(X(g.t/2),Y(0));
    p.dot(X(g.t/2),Y(g.beamAxis));
    if(contact.contactWidth!=null){const x=contact.fullContact||contact.xResultant<g.B/2?0:g.B-contact.contactWidth;
      p.add(`<path data-support="soil-contact" d="M${X(x)} ${Y(-g.hz)+4}h${contact.contactWidth*scale}" stroke="#be752b" stroke-width="4"/>`);}
  }
  p.text(220,Math.max(260,thicknessY+28),'คานวิ่งตั้งฉากกับรูปตัด · ดูแนวยาวใน Plan / 3D');
  return p.svg('Section · คานเหนือ footing และช่วงตอม่อ');
}

export const inputGuideNote=field=>names[aliases[field]||field]||'เลือกช่องขนาดเพื่อดูเส้นมิติ · ดิน โหลด และวัสดุเป็นข้อมูลคำนวณ';
export const inputGuideView=field=>planKeys.has(aliases[field]||field)?'plan':'section';
export function inputDiagram(type,raw={},field='',forcedView=''){
  const key=aliases[field]||field,i={...raw};
  for(const [old,newKey] of Object.entries(aliases))if(raw[old]!=null)i[newKey]=raw[old];
  const view=forcedView||(planKeys.has(key)?'plan':'section');
  const value=(k,s=names[k]?.split(' · ')[0]||k)=>s+' '+(['cfL','cfH'].includes(k)&&+i[k]===0?'Auto':num(i[k]))+' m';
  const note=inputGuideNote(field);
  if(type==='duckfoot'){
    const fallback={hp:2.3,t:.15,colDepth:.15,hz:.25,B:1.5,capL:1.2,postSpacing:2.5,nPosts:4,beamB:.20,beamH:.40};
    const safe=Object.fromEntries(Object.entries(fallback).map(([k,v])=>[k,positive(i[k],v)]));
    safe.nPosts=Math.max(2,Math.min(20,Math.round(safe.nPosts)));
    safe.beamClear=i.beamClear!==''&&Number.isFinite(+i.beamClear)&&+i.beamClear>=0?+i.beamClear:DUCK_BEAM_CLEAR_DEFAULT;
    const labels=Object.fromEntries(Object.keys(fallback).concat('beamClear').filter(k=>i[k]==null||i[k]===''||!Number.isFinite(+i[k])||+i[k]<(k==='beamClear'?0:Number.EPSILON)).map(k=>[k,'—']));
    return {view,note:Object.keys(labels).length?'ขนาดยังกรอกไม่ครบ · รูปประกอบชั่วคราว':note,
      svg:duckfootDrawing(duckfootGeometry(safe),view,key,null,labels)};
  }
  if(type==='soldier'){
    const H=positive(i.hp,3),D=positive(i.pileEmbS,H*.7),S=positive(i.pileS,1.2),Lw=positive(i.Lw,8);
    const a=positive(i.stayLvl,Math.min(Math.max(H/4,.8),H-.2)),Lb=positive(i.stayLb,H),bw=positive(i.stayBw,25)/100,bh=positive(i.stayBh,50)/100;
    const layout=i.soldierSys==='stay'?soldierStayGeometry({H,D,S,Lw,a,Lb,capLvl:+i.capLvl||0,ancLe:+i.ancLe||0,ancB:positive(i.ancPileSec,i.ipile)/100,bw,bh,stayPattern:i.stayPattern}):null;
    const autoKeys=['pileEmbS','stayLvl','stayLb','capLvl','ancLe'];
    const labels=Object.fromEntries(['hp','Lw','pileS',...autoKeys,'gaFreeLength','gaBondLength'].map(k=>[k,+i[k]>0?num(i[k]):autoKeys.includes(k)&&i[k]!==''&&+i[k]===0?'Auto':'—']));
    const capBeams=soldierCapGeometry(i,H,positive(i.ipile,35)/100,i.soldierSys==='cant'?0:a,i.soldierSys!=='cant').filter(b=>b.present);
    if(/^rb[123]/.test(key)||['rbCover','rbAgg'].includes(key))return {view:'section',note,svg:soldierBeamGuide({hp:H,capBeams},key,i)};
    for(const k of ['ipile','ancPileSec','tLag','gaBondDia'])labels[k]=num(i[k])+(k==='gaBondDia'?' mm':' cm');
    return {view,note,svg:soldierDrawing({hp:H,embed:D,Lw,pileS:S,pileB:positive(i.ipile,35)/100,stayLevel:a,stayLength:Lb,stayLayout:layout,rearCaps:rearPileCaps(layout,i),staySystem:i.soldierSys,stayB:bw,stayH:bh,
      anchor:{angle:+i.stayAng||20,freeLength:positive(i.gaFreeLength,H),bondLength:positive(i.gaBondLength,1),totalLength:positive(i.gaFreeLength,H)+positive(i.gaBondLength,1)}},view,key,labels)};
  }
  const p=painter(key),piled=['pile','pilecf'].includes(type),rib=['pilecf','counterfort'].includes(type),gravity=type==='gravity';
  const H=positive(i.hp,3),B=positive(i.B,3),hz=positive(i.hz,.4),t=positive(i.t,.3),toe=+i.toe||0,heel=+i.heel||0,Le=piled?positive(i.pileEmb,4):0;
  if(view==='section'){
    const topT=positive(i.ttop,t),rise=Math.max(0,heel)*Math.tan(Math.max(0,Math.min(30,+i.beta||0))*Math.PI/180);
    const scale=Math.min(170/(H+hz+Le+rise),265/B),X=x=>98+x*scale,Y=y=>32+(H+rise-y)*scale;
    const backBase=X(toe+t),backTop=X(toe+topT),soilRight=Math.min(408,X(B)+18);
    const soilPath=`M${backBase} ${Y(0)}L${backTop} ${Y(H)}L${soilRight} ${Y(H+rise)}L${soilRight} ${Y(0)}Z`;
    p.add(`<path d="${soilPath}" fill="#e7e0ce" stroke="none"/><path d="${soilPath}" fill="url(#rw-soil)" stroke="none"/>`);
    p.rect(X(0),Y(0),B*scale,hz*scale);p.add(`<path d="M${X(toe)} ${Y(0)}L${X(toe)} ${Y(H)}L${X(toe+positive(i.ttop,t))} ${Y(H)}L${X(toe+t)} ${Y(0)}Z" fill="#91a8ba" stroke="#38536b"/>`);
    p.line(backTop,Y(H),soilRight,Y(H+rise),'#816e4e',1.4);
    p.text(Math.min(soilRight-12,backTop+Math.max(heel*scale/2,18)),Y(H)+24,'ดินถม','#78633e');
    p.line(X(0)-18,Y(-hz),X(B)+18,Y(-hz),'#7f8f9e',1.2,'5 3');
    if(!piled){p.rect(X(0),Y(-hz)+3,B*scale,9,'#e7e0ce');}
    p.text(X(0),290,piled?'ฐานถ่ายแรงลงเข็ม':'ฐานแผ่บนดิน','#627386','start');
    const q=+(i.q??(+i.surcharge+(+i.surchargeD||0)))||0;
    if(q>0){for(let k=1;k<=4;k++){const x=X(toe+t)+(X(B)-X(toe+t))*k/5;p.line(x,Y(H)-22,x,Y(H)-3,'#b55c31',1.2);p.add(`<path d="m${x-3} ${Y(H)-8} 3 5 3-5" fill="none" stroke="#b55c31"/>`);}const u=resultUnits(i.unitMode==='kgf'?'kgf':'si');p.text(X(B),Y(H)-19,'q '+u.quantity(q,'kPa'),'#9c4723','end');}
    if(rib)p.add(`<path d="M${X(toe+t)} ${Y(positive(i.cfH,H))}L${X(toe+t+positive(i.cfL,heel))} ${Y(0)}L${X(toe+t)} ${Y(0)}Z" fill="#67879c" opacity=".65"/>`);
    if(piled)for(const [x,bat] of [[positive(i.pileEdT,.5),+i.pileBatT||0],[B-positive(i.pileEdH,.5),+i.pileBatH||0]]){
      const tip=x-Le*Math.tan(bat*Math.PI/180),dx=tip-x,dy=-Le,len=Math.hypot(dx,dy),half=positive(i.pileB,.35)/2;
      const nx=-dy/len*half,ny=dx/len*half;
      p.add(`<path data-member="pile" d="M${X(x+nx)} ${Y(-hz+ny)}L${X(tip+nx)} ${Y(-hz-Le+ny)}L${X(tip-nx)} ${Y(-hz-Le-ny)}L${X(x-nx)} ${Y(-hz-ny)}Z" fill="#e4e9ed" stroke="#273f52" stroke-width="1.4"/>`);
      p.line(X(x),Y(-hz),X(tip),Y(-hz-Le),'#718493',.7,'9 3 2 3');p.dot(X(x),Y(-hz));
    }
    p.dim('hp',66,Y(H),66,Y(0),value('hp','H'));p.dim('B',X(0),235,X(B),235,value('B'));
    const dims={hz:[X(B)+40,Y(0),X(B)+40,Y(-hz),value('hz')],toe:[X(0),Y(0)-15,X(toe),Y(0)-15,value('toe','Toe')],heel:[X(toe+t),Y(0)-15,X(B),Y(0)-15,value('heel','Heel')],t:[X(toe),22,X(toe+t),22,value('t')],ttop:[X(toe),22,X(toe+positive(i.ttop,t)),22,value('ttop')],pileEmb:[X(B)+55,Y(-hz),X(B)+55,Y(-hz-Le),value('pileEmb','Le')],beamB:[X(0),Y(0)-12,X(positive(i.beamB,.25)),Y(0)-12,value('beamB','bb')],beamH:[X(B)+40,Y(0),X(B)+40,Y(-positive(i.beamH,.25)),value('beamH','hb')],cfH:[X(toe+t)+35,Y(positive(i.cfH,H)),X(toe+t)+35,Y(0),value('cfH')]};
    if(dims[key])p.dim(key,...dims[key]);else if(!['hp','B'].includes(key))p.dim('hz',X(B)+40,Y(0),X(B)+40,Y(-hz),value('hz'));
    if(key!=='toe'){
      p.annotationLine(X(toe/2),Y(0),148,242,'#637789',.7);
      p.text(148,261,'Toe '+num(toe)+' m','#244d76');
    }
    if(key!=='heel'){
      p.annotationLine(X(toe+t+heel/2),Y(0),306,242,'#637789',.7);
      p.text(306,261,'Heel '+num(heel)+' m','#244d76');
    }
    if(!['t','ttop'].includes(key)){
      p.annotationLine(X(toe),Y(H*.65),X(toe)-24,Y(H*.65)-9,'#38536b',.9);
      p.text(X(toe)-27,Y(H*.65)-12,'t '+num(t)+' m','#244d76','end');
    }
    if(key==='waterH'||key==='zw'){const y=key==='waterH'?+i.waterH:H-(+i.zw);if(Number.isFinite(y)&&y>=0&&y<=H){p.line(X(toe+t),Y(y),X(B)+35,Y(y),'#308ba8',2,'5 3');p.dim(key,X(B)+55,Y(key==='zw'?H:0),X(B)+55,Y(y),value(key));}}
    if(key==='pileB'&&piled){const e=positive(i.pileEdT,.5),w=positive(i.pileB,.35);p.dim(key,X(e-w/2),Y(-hz)+15,X(e+w/2),Y(-hz)+15,value(key,'Bp'));}
    if(key==='Df'){const d=+i.Df||0;p.line(X(0)-25,Y(-hz+d),X(toe),Y(-hz+d),'#98866b',2);p.dim('Df',X(0)-20,Y(-hz),X(0)-20,Y(-hz+d),value('Df'));}
    if(key==='cov'){p.rect(270,160,115,65,'#fff');p.rect(289,174,60,35);p.dot(301,186);p.dim('cov',289,218,301,218,'cover '+num(i.cov)+' mm');}
  }else{
    const length=positive(i.Lw,12),scale=Math.min(300/length,125/B),X=z=>65+z*scale,Y=x=>75+x*scale;
    {
      p.rect(X(0),Y(0),length*scale,B*scale);p.rect(X(0),Y(toe),length*scale,Math.max(t*scale,3),'#8ba3b5');
      p.line(X(0),Y(toe+t/2),X(length),Y(toe+t/2),'#38536b',.8,'9 3 2 3');
      p.text(X(length*.32),Y(toe+t+heel/2),'HEEL '+num(heel)+' m','#48637c');
      p.text(220,26,'PLAN · มองจากด้านบน','#183e68');
      p.text(X(length/2),Y(0)-13,'ด้านหน้า · TOE','#244d76');
      p.text(X(length/2),Y(B)+34,'ด้านดินถม · HEEL','#7b6543');
      p.dim('B',45,Y(0),45,Y(B),value('B'));
      const cut=X(length*.72);p.line(cut,Y(0)-9,cut,Y(B)+8,'#a75224',1,'7 3');
      p.text(cut+8,Y(0)-2,'A','#a75224','start');p.text(cut+8,Y(B)+8,'A','#a75224','start');
      p.annotationLine(X(length*.18),Y(toe+t/2),X(length*.18),Y(0)-25,'#38536b',1);p.text(X(length*.18),Y(0)-30,'แนวพนังกำแพง','#244d76');
      if(rib){const thick=positive(i.bs,.25),sp=positive(i.L,2)+thick;for(let z=0;z<length;z+=sp)p.rect(X(Math.min(z,Math.max(0,length-thick))),Y(toe+t),Math.max(3,Math.min(thick,length)*scale),Math.max(1,heel*scale),'#5d7b93');p.dim('L',X(thick),32,X(sp),32,value('L'));}
      if(piled)for(const [centre,sp] of [[positive(i.pileEdT,.5),positive(i.pileSt,2)],[B-positive(i.pileEdH,.5),positive(i.pileSh,2)]])for(let z=0;z<=length;z+=sp)p.dot(X(z),Y(centre));
      p.dim('Lw',X(0),271,X(length),271,value('Lw'));
      p.text(220,294,piled?'วงกลม = แนวศูนย์เข็ม · จังหวะตามยาวเป็นรูปช่วยกรอก':rib?'ครีบด้านดินถม · แนวประ A–A = ตำแหน่งรูปตัด':'พื้นที่สีอ่อน = ฐานราก · แนวประ A–A = ตำแหน่งรูปตัด','#627386');
      if(['pileSt','pileSh','bs','cfL','pileEdT','pileEdH'].includes(key)){
        const along=['pileSt','pileSh','bs'].includes(key),d=positive(i[key],key==='cfL'?heel:.3);
        const start=key==='cfL'?toe+t:key==='pileEdH'?B-d:0;
        p.dim(key,X(0),along?33:Y(start),along?X(d):X(0),along?33:Y(start+d),value(key));
      }
    }
  }
  return {view,note,svg:p.svg(view==='plan'?'Plan · รูปช่วยกรอกตามแนวยาว':'Section · รูปช่วยกรอกขนาด')};
}
