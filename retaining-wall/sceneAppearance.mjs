// Optical presentation only. Never changes physical vertices or engineering materials.
export const MEMBER_NAMES={base:'ฐานราก',cap:'ฐานหัวเข็ม / คานหัวเข็ม',key:'เดือยกันเลื่อน',wall:'ผนัง',rib:'ครีบค้ำยัน',pile:'เสาเข็ม',strap:'คานเชื่อม',stay:'คานสเตย์',anchorTendon:'สมอยึดดิน',lag:'แผ่นกันดิน',boundary:'แนวเขต',rebar:'เหล็กเสริม'};
export function mountSceneAppearance(THREE,scene,renderer,{dark=false}={}){
  const textures=[],materials=new Set(),saved=new Map();let disposed=false;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(128,128);let seed=145903;
  for(let k=0;k<pixels.data.length;k+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const grain=220+(seed>>>24)%36;pixels.data[k]=pixels.data[k+1]=pixels.data[k+2]=grain;pixels.data[k+3]=255;}
  ctx.putImageData(pixels,0,0);
  const grain=new THREE.CanvasTexture(canvas);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.colorSpace=THREE.NoColorSpace;grain.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());textures.push(grain);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  // Keep existing semantic contour/force colors linear: tone mapping only on physical materials.
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.shadowMap.autoUpdate=false;
  const previousLights=scene.children.filter(o=>o.isLight);previousLights.forEach(o=>scene.remove(o));
  const sky=new THREE.HemisphereLight(0xf1f6ff,0x897761,1.65),key=new THREE.DirectionalLight(0xfff1db,2.6),fill=new THREE.DirectionalLight(0xc8dfff,.7);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.0003;key.shadow.normalBias=.025;key.shadow.radius=3;
  scene.add(sky,key,fill,key.target);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({color:dark?0x000000:0x3b4149,opacity:dark?.28:.17}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.rwPresentationOnly=true;scene.add(floor);
  function material(mat,kind,steel=false){
    if(!mat?.isMeshStandardMaterial||materials.has(mat))return;materials.add(mat);
    saved.set(mat,{onBeforeCompile:mat.onBeforeCompile,customProgramCacheKey:mat.customProgramCacheKey,bumpMap:mat.bumpMap,bumpScale:mat.bumpScale,color:mat.color.clone(),roughness:mat.roughness,metalness:mat.metalness});
    if(kind==='boundary'||kind==='rebar'){mat.roughness=.48;mat.metalness=kind==='rebar'?.3:0;return;}
    const soil=['soil','ground'].includes(kind);
    mat.color.setHex(soil?(kind==='ground'?0xb79a70:0xc4ad86):steel?0x4a6476:({base:0xbec3c1,cap:0xc7cbc7,rib:0xc4c7c1}[kind]||0xd1d1c9));
    mat.roughness=soil?.98:steel?.38:.86;mat.metalness=steel?.42:0;
    mat.bumpMap=grain;mat.bumpScale=soil?.012:steel?.00045:.0025;
    // World-space grain stays the same size when H/B/L changes; no fake geometry displacement.
    mat.onBeforeCompile=shader=>{
      shader.uniforms.rwGrain={value:grain};shader.uniforms.rwGrainScale={value:soil?5:18};
      shader.vertexShader='varying vec3 rwWorldPosition;\nvarying vec3 rwWorldNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n rwWorldPosition=(modelMatrix*vec4(transformed,1.0)).xyz;rwWorldNormal=normalize(mat3(modelMatrix)*normal);');
      shader.fragmentShader='varying vec3 rwWorldPosition;\nvarying vec3 rwWorldNormal;\nuniform sampler2D rwGrain;\nuniform float rwGrainScale;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        vec3 rwP=rwWorldPosition*rwGrainScale;
        vec3 rwWeight=pow(abs(normalize(rwWorldNormal)),vec3(4.0));rwWeight/=max(dot(rwWeight,vec3(1.0)),0.001);
        float rwNoise=texture2D(rwGrain,rwP.yz).r*rwWeight.x+texture2D(rwGrain,rwP.xz).r*rwWeight.y+texture2D(rwGrain,rwP.xy).r*rwWeight.z;
        diffuseColor.rgb*=mix(0.91,1.03,rwNoise);`);
    };
    mat.customProgramCacheKey=()=>`rw01-grain-${soil?'soil':'solid'}`;mat.needsUpdate=true;
  }
  function dress(mesh,kind,{steel=false,label=MEMBER_NAMES[kind]}={}){
    if(!mesh?.isMesh)return;
    // Support/contact glyphs keep their semantic orange and are never physical shadow casters.
    if(['support','contact'].includes(kind))return;
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])material(mat,kind,steel);
    const physical=!['soil','ground','boundary','rebar'].includes(kind);
    mesh.castShadow=physical;mesh.receiveShadow=physical||kind==='ground';
    if(label&&!['soil','ground','boundary'].includes(kind))mesh.userData.rwMember={id:mesh.uuid,kind,label};
  }
  function update(bounds){
    if(!bounds||bounds.isEmpty())return;const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),span=Math.max(size.x,size.y,size.z,1),r=span*1.1;
    key.position.copy(center).add(new THREE.Vector3(-span*.8,span*1.4,span*.65));key.target.position.copy(center);fill.position.copy(center).add(new THREE.Vector3(span,span*.4,-span));
    const c=key.shadow.camera;c.left=c.bottom=-r;c.right=c.top=r;c.near=.05;c.far=span*5+1;c.updateProjectionMatrix();
    floor.position.set(center.x,bounds.min.y-.025,center.z);floor.scale.set(span*3,span*3,1);floor.updateMatrixWorld(true);renderer.shadowMap.needsUpdate=true;
  }
  return{dress,update,invalidate(){renderer.shadowMap.needsUpdate=true;},dispose(){if(disposed)return;disposed=true;for(const[mat,state]of saved)Object.assign(mat,state);textures.forEach(t=>t.dispose());key.shadow.map?.dispose();floor.geometry.dispose();floor.material.dispose();scene.remove(sky,key,fill,key.target,floor);}};
}
