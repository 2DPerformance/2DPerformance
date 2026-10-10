// Optical presentation only. Never changes physical vertices or engineering materials.
export const MEMBER_NAMES={base:'ฐานราก',cap:'ฐานหัวเข็ม / คานหัวเข็ม',key:'เดือยกันเลื่อน',wall:'ผนัง',rib:'ครีบค้ำยัน',pile:'เสาเข็ม',strap:'คานเชื่อม',stay:'คานสเตย์',anchorTendon:'สมอยึดดิน',lag:'แผ่นกันดิน',boundary:'แนวเขต',rebar:'เหล็กเสริม'};

// One deterministic atlas: R fine aggregate, G mineral variation, B sparse pores.
// World-space sampling avoids stretched Box/Extrude/Cylinder UVs.
function surfaceAtlas(THREE,renderer){
  const size=512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);let seed=145903;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const grids=[8,32].map(n=>({n,values:Float32Array.from({length:n*n},random)}));
  const noise=(x,y,{n,values})=>{x=x/size*n;y=y/size*n;const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v),at=(a,b)=>values[(b%n)*n+a%n];return(1-t)*((1-s)*at(ix,iy)+s*at(ix+1,iy))+t*((1-s)*at(ix,iy+1)+s*at(ix+1,iy+1));};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const k=(y*size+x)*4;pixels.data[k]=Math.round(85+random()*150);
    pixels.data[k+1]=Math.round(255*(.7*noise(x,y,grids[0])+.3*noise(x,y,grids[1])));
    pixels.data[k+2]=255;pixels.data[k+3]=255;
  }
  for(let i=0;i<1900;i++){
    const cx=random()*size,cy=random()*size,r=.6+random()*1.8;
    for(let y=Math.floor(cy-r);y<=cy+r;y++)for(let x=Math.floor(cx-r);x<=cx+r;x++){
      const d=Math.hypot(x-cx,y-cy)/r;if(d>=1)continue;
      const k=(((y+size)%size)*size+(x+size)%size)*4+2;
      pixels.data[k]=Math.min(pixels.data[k],Math.round(255-130*(1-d)**2));
    }
  }
  ctx.putImageData(pixels,0,0);const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.NoColorSpace;
  texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}

// Local daylight reflection, prefiltered once. No network HDR or render pass.
// Apply to physical materials only, never numerical contour/force glyphs.
function daylightEnvironment(THREE,renderer){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const ctx=canvas.getContext('2d'),sky=ctx.createLinearGradient(0,0,0,256);
  for(const [stop,color]of [[0,'#7f9bb4'],[.36,'#c6d6df'],[.5,'#eef0ea'],[.54,'#aaa79a'],[1,'#666965']])sky.addColorStop(stop,color);
  ctx.fillStyle=sky;ctx.fillRect(0,0,512,256);
  const sun=ctx.createRadialGradient(128,68,0,128,68,55);
  sun.addColorStop(0,'rgba(255,250,233,1)');sun.addColorStop(.25,'rgba(255,250,233,.9)');sun.addColorStop(1,'rgba(255,250,233,0)');ctx.fillStyle=sun;ctx.fillRect(0,0,512,256);
  const source=new THREE.CanvasTexture(canvas);source.colorSpace=THREE.SRGBColorSpace;
  const pmrem=new THREE.PMREMGenerator(renderer);let target;
  try{target=pmrem.fromEquirectangular(source);}finally{source.dispose();pmrem.dispose();}
  return target;
}

export function mountSceneAppearance(THREE,scene,renderer,{dark=false}={}){
  const grain=surfaceAtlas(THREE,renderer);let environment=daylightEnvironment(THREE,renderer);
  const saved=new Map(),styles=new Map(),meshes=new Map(),soils=new Map();let disposed=false,soilSolid=false,inspection=false;
  const rendererState={outputColorSpace:renderer.outputColorSpace},shadowState={enabled:renderer.shadowMap.enabled,type:renderer.shadowMap.type,autoUpdate:renderer.shadowMap.autoUpdate};
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Retain numerical colour mapping; no global tone mapping on overlays.
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  const previousLights=scene.children.filter(o=>o.isLight);previousLights.forEach(o=>scene.remove(o));
  const sky=new THREE.HemisphereLight(0xe5edf3,0x8b8171,.75),key=new THREE.DirectionalLight(0xfff5e6,2.15),fill=new THREE.DirectionalLight(0xe2edff,.35);
  key.castShadow=true;const shadowSize=renderer.capabilities.maxTextureSize>=2048?2048:1024;key.shadow.mapSize.set(shadowSize,shadowSize);
  key.shadow.bias=-.00015;key.shadow.normalBias=.012;key.shadow.radius=3;
  scene.add(sky,key,fill,key.target);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({color:dark?0x000000:0x343b42,opacity:dark?.3:.2}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.rwPresentationOnly=true;scene.add(floor);
  function material(mat,kind,steel=false){
    const signature=kind+':'+steel;
    if(!mat?.isMeshStandardMaterial||styles.get(mat)===signature)return;
    styles.set(mat,signature);
    if(!saved.has(mat))saved.set(mat,{onBeforeCompile:mat.onBeforeCompile,customProgramCacheKey:mat.customProgramCacheKey,bumpMap:mat.bumpMap,bumpScale:mat.bumpScale,envMap:mat.envMap,envMapIntensity:mat.envMapIntensity,color:mat.color.clone(),roughness:mat.roughness,metalness:mat.metalness,transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite});
    if(kind==='boundary')return;
    mat.envMap=environment.texture;mat.envMapIntensity=steel?.9:kind==='rebar'?.65:.5;
    if(kind==='rebar'){mat.roughness=.46;mat.metalness=.55;mat.needsUpdate=true;return;}
    const soil=['soil','ground'].includes(kind),style=soil?1:steel?2:0;
    if(soil)soils.set(mat,{transparent:mat.transparent,opacity:mat.opacity,depthWrite:mat.depthWrite});
    mat.color.setHex(soil?(kind==='ground'?0xa78a60:0xb69a70):steel?0x76848d:({base:0xbabbb5,cap:0xc4c5bf,rib:0xc5c5be}[kind]||0xcdcdc6));
    mat.roughness=soil?1:steel?.36:.88;mat.metalness=steel?.85:0;
    mat.bumpMap=grain;mat.bumpScale=soil?.006:steel?.00012:.00065;
    const before=saved.get(mat).onBeforeCompile;
    mat.onBeforeCompile=function(shader,gl){
      before.call(this,shader,gl);
      shader.uniforms.rwSurface={value:grain};shader.uniforms.rwSurfaceSettings={value:new THREE.Vector4(style,mat.bumpScale,soil?.38:steel?.055:.18,soil?1.4:.8)};
      shader.vertexShader='varying vec3 rwWorldPosition;\nvarying vec3 rwWorldNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n rwWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;rwWorldNormal=inverseTransformDirection(transformedNormal,viewMatrix);');
      shader.fragmentShader=`varying vec3 rwWorldPosition;
        varying vec3 rwWorldNormal;
        uniform sampler2D rwSurface;
        uniform vec4 rwSurfaceSettings;
        vec3 rwSample(vec3 p,vec3 w){return texture2D(rwSurface,p.yz).rgb*w.x+texture2D(rwSurface,p.xz).rgb*w.y+texture2D(rwSurface,p.xy).rgb*w.z;}
        `+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 rwW=pow(abs(normalize(rwWorldNormal)),vec3(4.0));rwW/=max(dot(rwW,vec3(1.0)),.001);
        vec3 rwTex=rwSample(rwWorldPosition*rwSurfaceSettings.w,rwW);
        vec3 rwFine=rwSample(rwWorldPosition*rwSurfaceSettings.w*7.0,rwW);
        float rwHeight=rwSurfaceSettings.y*(rwTex.r*.28+rwTex.b*.48+rwFine.r*.24);
        float rwMineral=1.0+(rwTex.g-.5)*rwSurfaceSettings.z*2.0;
        diffuseColor.rgb*=rwMineral*mix(.96,1.02,rwTex.r)*mix(.85,1.0,rwTex.b);
        if(rwSurfaceSettings.x>.5&&rwSurfaceSettings.x<1.5){
          float rwTop=smoothstep(.4,.9,rwWorldNormal.y);
          diffuseColor.rgb*=mix(vec3(1.04,1.0,.92),vec3(.91,.92,.92),rwTop);
          rwHeight+=rwTex.g*.012;
        }`);
      // Derivatives use world-metre relief, independent of UVs, orbit or zoom.
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        vec3 rwDx=dFdx(-vViewPosition),rwDy=dFdy(-vViewPosition);
        vec3 rwRx=cross(rwDy,normal),rwRy=cross(normal,rwDx);
        float rwDet=dot(rwDx,rwRx)*faceDirection;
        normal=normalize(abs(rwDet)*normal-sign(rwDet)*(dFdx(rwHeight)*rwRx+dFdy(rwHeight)*rwRy));`);
    };
    mat.customProgramCacheKey=()=>`rw01-surface-20261004-${style}`;mat.needsUpdate=true;
  }
  function dress(mesh,kind,{steel=false,label=MEMBER_NAMES[kind]}={}){
    if(!mesh?.isMesh||['support','contact'].includes(kind))return;
    if(!meshes.has(mesh))meshes.set(mesh,{castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow});
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])material(mat,kind,steel);
    const physical=!['soil','ground','boundary','rebar'].includes(kind);
    mesh.castShadow=physical;mesh.receiveShadow=physical||kind==='ground';
    if(label&&!['soil','ground','boundary'].includes(kind))mesh.userData.rwMember={id:mesh.uuid,kind,label};
  }
  function applySoil(){
    for(const[mat,state]of soils){const solid=soilSolid&&!inspection;mat.transparent=solid?false:state.transparent;mat.opacity=solid?1:state.opacity;mat.depthWrite=solid?true:state.depthWrite;mat.needsUpdate=true;}
    renderer.shadowMap.needsUpdate=true;
  }
  function update(bounds){
    // Draft dimensions replace the model repeatedly; retain no detached meshes.
    for(const[mesh,state]of meshes){let root=mesh;while(root.parent)root=root.parent;if(root!==scene){Object.assign(mesh,state);meshes.delete(mesh);}}
    if(!bounds||bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,1),r=span*.85;
    key.position.copy(center).add(new THREE.Vector3(-span*.65,span*1.3,span*.8));key.target.position.copy(center);fill.position.copy(center).add(new THREE.Vector3(span,span*.4,-span));
    const c=key.shadow.camera;c.left=c.bottom=-r;c.right=c.top=r;c.near=.05;c.far=span*4+1;c.updateProjectionMatrix();
    floor.position.set(center.x,bounds.min.y-.012,center.z);floor.scale.set(span*3,span*3,1);floor.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;
  }
  return{dress,update,get soilState(){return{solid:soilSolid&&!inspection,available:soils.size>0&&!inspection};},setSoilSolid(value){if(inspection)return;soilSolid=!!value;applySoil();},setInspection(value){inspection=!!value;applySoil();},invalidate(){renderer.shadowMap.needsUpdate=true;},restore(){
    // A render-target texture loses its pixels with the context. Regenerate the
    // prefiltered daylight; ordinary canvas textures can upload their source again.
    const old=environment;environment=daylightEnvironment(THREE,renderer);
    for(const mat of saved.keys())if(mat.envMap===old.texture){mat.envMap=environment.texture;mat.needsUpdate=true;}
    old.dispose();grain.needsUpdate=true;renderer.shadowMap.needsUpdate=true;
  },dispose(){
    if(disposed)return;disposed=true;
    for(const[mat,state]of saved){const{color,...props}=state;Object.assign(mat,props);mat.color.copy(color);mat.needsUpdate=true;}
    for(const[mesh,state]of meshes)Object.assign(mesh,state);
    grain.dispose();environment.dispose();key.shadow.map?.dispose();floor.geometry.dispose();floor.material.dispose();scene.remove(sky,key,fill,key.target,floor);previousLights.forEach(light=>scene.add(light));Object.assign(renderer,rendererState);Object.assign(renderer.shadowMap,shadowState);saved.clear();styles.clear();meshes.clear();soils.clear();
  }};
}
