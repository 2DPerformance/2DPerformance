/* SC01 R31: collect native geometry on isolated inputs, without a result or GPU. */
(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x));
  const physical=new Set(['steel','purlin','roof-frame','concrete','plate','root-plate',
    'brace','stiffener','gutter','truss-chord','truss-web']);
  function input(state,items){
    let next=clone(state);
    for(const item of items||[])next=root.NCYSC01MaterialInputs.propose(next,item.slot,item.row.id).next;
    return next;
  }
  function build(source,state,items=[]){
    const next=input(state,items),M=root.NCYV5,CAD=root.NCYCAD;
    const errors=root.NCYSC01MaterialInputs?root.NCYSC01MaterialInputs.validationErrors(next,M.validate):M.validate(next);
    if(errors.length)throw Error(errors.join(' · '));
    // Native build reads the anchor stations for holes. Supply only coordinates,
    // never old forces, a fabricated capacity or the accepted calculation object.
    const coordinates=root.NCYEngine.anchorCoordinates(next).anchors;
    const v=Object.create(CAD.Viewer.prototype);
    next.v61.deflectionShow=false;next.v61.deflectionAnimate=false;next.v62.showRootForces=false;
    const data={state:next,checks:{},cases:[],governing:{group:{forces:coordinates},normal:{contact:[]},action:{}},
      v62:{rootConnection:{geometry:root.NCYV62.rootGeometry(next)}}};
    Object.assign(v,{sc01GeometryOnly:true,data,quick:null,gl:null,canvas:null,overlay:null,software:true,
      meshes:[],annotations:[],dims:[],warnings:[],hasFit:true,field:'geometry',loadMode:'geometry',
      v6Scene:source?.v6Scene||'project',range:source?.range||'full',roofScope:source?.roofScope||'project',
      showRoof:true,showPurlins:next.takeoff.includePurlins!==false,showAccessories:true,
      showLoads:false,showDims:false,showTributary:false,xray:false,exploded:false,
      clear(){this.meshes=[];this.annotations=[];this.dims=[];},draw(){},fit(){},
      add(g,id,kind,color=[.4,.47,.53],alpha=1,metal=.5){const m={g,id,kind,color,alpha,metal};this.meshes.push(m);return m;}
    });
    v.build();
    if(['project','support'].includes(v.v6Scene)&&!v.projectLayout)throw Error('จัดรูปทรงตามข้อมูลนี้ไม่ได้ ตรวจขนาดและระยะโครงสร้าง');
    const meshes=v.meshes.filter(m=>physical.has(m.kind));
    if(!meshes.length)throw Error('ไม่มีรูปทรงจากข้อมูลที่กรอก');
    const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
    for(const m of meshes)for(let i=0;i<m.g.p.length;i++){
      const value=m.g.p[i],axis=i%3;if(!Number.isFinite(value))throw Error('พิกัดโมเดลไม่ถูกต้อง');
      bounds.min[axis]=Math.min(bounds.min[axis],value);bounds.max[axis]=Math.max(bounds.max[axis],value);
    }
    const member={H:next.member.H,B:next.member.B,t:next.member.tNom},web={H:next.brace.H,B:next.brace.B,t:next.brace.tNom},
      purlin={H:next.takeoff.purlinH,B:next.takeoff.purlinB,t:next.takeoff.purlinT};
    for(const mesh of meshes){
      const section=['steel','roof-frame','truss-chord'].includes(mesh.kind)?member:mesh.kind==='truss-web'||mesh.kind==='brace'?web:mesh.kind==='purlin'?purlin:null;
      if(section)mesh.section={...section};
    }
    return {meshes,bounds,member,web,purlin,truss:next.v61.systemType==='truss',
      supportType:next.v61.supportType,supportLabel:root.NCYV61.supportLabel(next),
      mains:meshes.filter(m=>['steel','truss-chord'].includes(m.kind)).length,
      purlins:meshes.filter(m=>m.kind==='purlin').length};
  }
  root.NCYSC01GeometryDraft=Object.freeze({VERSION:'r31',input,build});
})(typeof window==='undefined'?globalThis:window);
