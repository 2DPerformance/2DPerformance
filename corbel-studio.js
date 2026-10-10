/* Materials and lighting only. Native physical meshes, bar paths and snapshots stay owned by the card. */
(function installCorbelStudio(root) {
  'use strict';
  function attach({THREE,renderer,scene,stage,groups,materials,requestRender}) {
    const textures=[];
    function texture(kind) {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
      const ctx=canvas.getContext('2d');let seed=kind==='steel'?117:417;
      const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
      ctx.fillStyle=kind==='steel'?'#a7adb5':kind==='wall'?'#d9d4c9':'#cbd0d2';ctx.fillRect(0,0,128,128);
      for(let i=0;i<3400;i++) {const shade=kind==='steel'?Math.floor(105+rand()*85):Math.floor(115+rand()*100);
        ctx.fillStyle=`rgba(${shade},${shade},${shade},${kind==='steel'?.14:.27})`;
        const size=rand()*1.6+.3;ctx.fillRect(rand()*128,rand()*128,size,size);
      }
      if(kind==='steel') {ctx.strokeStyle='#6d747b';ctx.lineWidth=2;for(let y=-128;y<256;y+=18){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y+52);ctx.stroke();}}
      else for(let i=0;i<38;i++) {ctx.fillStyle='#59636b25';ctx.beginPath();ctx.arc(rand()*128,rand()*128,.4+rand()*1.2,0,Math.PI*2);ctx.fill();}
      const t=new THREE.CanvasTexture(canvas);t.wrapS=t.wrapT=THREE.RepeatWrapping;
      t.repeat.set(kind==='steel'?1:4,kind==='steel'?3:4);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      t.encoding=THREE.sRGBEncoding;textures.push(t);return t;
    }
    const concrete=texture('concrete'),wall=texture('wall'),steel=texture('steel');
    Object.assign(materials.concrete,{color:new THREE.Color(0xd2d5d7),map:concrete,bumpMap:concrete,bumpScale:.002,roughness:.92,metalness:0});
    Object.assign(materials.wall,{color:new THREE.Color(0xe9e4d8),map:wall,bumpMap:wall,bumpScale:.0015,roughness:.98,metalness:0,opacity:.94,transparent:true,depthWrite:true});
    materials.edge.color.setHex(0x516275);materials.edge.opacity=.27;
    const roles=[[materials.blue,0x4c83bc],[materials.violet,0x329176],[materials.sideBar,0x8a7055],[materials.verticalCorbel,0x9270b7],[materials.verticalSupport,0xbf852e],[materials.columnBar,0x697780]];
    roles.forEach(([m,color])=>{m.color.setHex(color);m.map=steel;m.bumpMap=steel;m.bumpScale=.0005;m.roughness=.56;m.metalness=.48;m.emissive?.setHex(0);});
    // RB ties are smooth bars. The DB rib texture must not imply deformed RB.
    [materials.violet,materials.verticalCorbel,materials.verticalSupport].forEach(m=>{m.map=null;m.bumpMap=null;m.roughness=.45;});
    materials.red.color.setHex(0xba3828);materials.red.roughness=.66;
    scene.background=new THREE.Color(0xecf2f7);
    scene.children.filter(o=>o.isLight).forEach(o=>scene.remove(o));
    scene.add(new THREE.HemisphereLight(0xffffff,0x697e91,.65));
    const sun=new THREE.DirectionalLight(0xfffaf3,1.25);sun.position.set(3.5,7,4);sun.castShadow=true;
    sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:6,bottom:-2,near:.1,far:18});
    sun.shadow.camera.updateProjectionMatrix();sun.shadow.bias=-.0002;sun.shadow.normalBias=.012;sun.shadow.radius=3;scene.add(sun);
    const fill=new THREE.DirectionalLight(0xe9f2ff,.45);fill.position.set(-4,3,-4);scene.add(fill);
    scene.children.filter(o=>o.type==='GridHelper').forEach(o=>{o.material.opacity=.17;o.material.transparent=true;});
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(16,16),new THREE.ShadowMaterial({opacity:.16}));
    floor.name='presentation-shadow-receiver';floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
    renderer.outputEncoding=THREE.sRGBEncoding;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
    let exposed=true,roleColors=true,wallVisible=true;
    function sync() {
      materials.concrete.transparent=exposed;materials.concrete.opacity=exposed?.25:1;
      materials.concrete.depthWrite=!exposed;materials.concrete.needsUpdate=true;
      roles.forEach(([m,color])=>m.color.setHex(roleColors?color:0x7d8790));
      document.querySelectorAll('#modelLegend .swatch').forEach((swatch,i)=>{if(i<5)swatch.style.background=roleColors?['#4c83bc','#329176','#8a7055','#9270b7','#bf852e'][i]:'#7d8790';});
      groups.wall.visible=wallVisible&&document.querySelector('.layer[data-layer="load"]')?.checked!==false;
      stage.dataset.concreteSurface=exposed?'exposed':'solid';stage.dataset.steelPalette=roleColors?'roles':'natural';
      document.getElementById('corbelConcreteBtn')?.setAttribute('aria-pressed',String(exposed));
      document.getElementById('corbelSteelBtn')?.setAttribute('aria-pressed',String(roleColors));
      document.getElementById('corbelWallBtn')?.setAttribute('aria-pressed',String(wallVisible));
      requestRender();
    }
    document.getElementById('corbelConcreteBtn')?.addEventListener('click',()=>{exposed=!exposed;sync();});
    document.getElementById('corbelSteelBtn')?.addEventListener('click',()=>{roleColors=!roleColors;sync();});
    document.getElementById('corbelWallBtn')?.addEventListener('click',()=>{wallVisible=!wallVisible;sync();});
    renderer.domElement.addEventListener('webglcontextrestored',requestRender);
    renderer.domElement.addEventListener('webglcontextlost',()=>{stage.dataset.rendererState='recovering';});
    renderer.domElement.addEventListener('webglcontextrestored',()=>{stage.dataset.rendererState='ready';});
    stage.dataset.rendererState='ready';sync();
    return {sync};
  }
  root.CorbelStudio=Object.freeze({attach});
})(typeof window==='undefined'?globalThis:window);
