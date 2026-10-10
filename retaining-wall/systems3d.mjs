/* RW-01 system geometry. This is a physical arrangement viewer, not checked rebar detailing. */
import { duckfootConcreteBoxes } from './duckfootGeometry.mjs?rwv=20260930-load-units-1';
import { rearPileCaps } from './rearPileCapGeometry.mjs?rwv=20261002-rear-anchor-1';
import { soldierLaggingParts } from './soldierLaggingGeometry.mjs?rwv=20261004-pile-panel-1';
import { pileDrawingRows } from './pileDrawingLayout.mjs?rwv=20261001-a4-cad-1';
import { mountSmoothZoom } from './smoothZoom.mjs?rwv=20261001-component-camera-1';
import { fitCameraToBounds, mountCameraKeys, mountCameraViewState } from './cameraControls.mjs?rwv=20261001-component-camera-1';
import {mountStressOverlay} from './stressContour.mjs?rwv=20261003-cad-contour-1&stay=20261004-alternate-1';
import {mountSceneAppearance} from './sceneAppearance.mjs?rwv=20261004-material-realism-1';
import {mountSceneInteraction,mountCameraTransition,mountCameraRenderSignal} from './sceneInteraction.mjs?rwv=20261004-material-realism-1';
export function stayBeamTransform(THREE,member){
  const a=new THREE.Vector3(member.front.x,member.front.y,member.front.z),b=new THREE.Vector3(member.rear.x,member.rear.y,member.rear.z);
  const axis=b.clone().sub(a).normalize(),across=axis.clone().cross(new THREE.Vector3(0,1,0)).normalize();
  const up=across.clone().cross(axis).normalize();
  return {position:a.add(b).multiplyScalar(.5),quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,up,across))};
}
export function mountSystem3D(THREE, OrbitControls, canvas, snap, options={}) {
  if (!snap || !snap.geometry) throw new TypeError('ต้องมี Snapshot เรขาคณิต');
  const g = snap.geometry;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2f5f8);
  scene.add(new THREE.HemisphereLight(0xfefeff, 0x7b8a98, 2.1));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-8, 15, 10);
  scene.add(sun);
  const group = new THREE.Group();
  scene.add(group);
  const mats = {
    wall: new THREE.MeshStandardMaterial({ color: 0xb6c2cd, roughness: .86 }),
    base: new THREE.MeshStandardMaterial({ color: 0x859bb0, roughness: .83 }),
    cap: new THREE.MeshStandardMaterial({ color: 0xa6b8c9, roughness: .84 }),
    rib: new THREE.MeshStandardMaterial({ color: 0x748ca0, roughness: .86 }),
    pile: new THREE.MeshStandardMaterial({ color: 0x344e69, roughness: .68 }),
    lag: new THREE.MeshStandardMaterial({ color: 0xabb8c2, roughness: .92 }),
    strap: new THREE.MeshStandardMaterial({ color: 0x2e6487, roughness: .74 }),
    boundary: new THREE.MeshStandardMaterial({ color: 0xb65b47, roughness: .8 }),
    soil: new THREE.MeshStandardMaterial({ color: 0xc5af89, transparent: true, opacity: .23, depthWrite: false }),
    ground: new THREE.MeshStandardMaterial({ color: 0xb8a47d, transparent: true, opacity: .58, depthWrite: false, side: THREE.DoubleSide, roughness: .94 }),
    support: new THREE.MeshStandardMaterial({ color: 0xd98524, emissive: 0x633008, roughness: .36 }),
    contact: new THREE.MeshStandardMaterial({ color: 0xd98524, transparent: true, opacity: .48,
      depthWrite: false, roughness: .7 }),
  };
  const edge = new THREE.LineBasicMaterial({ color: 0x22384e, transparent: true, opacity: .46 });
  const soilGroup = new THREE.Group();
  group.add(soilGroup);
  const rebarGroup=new THREE.Group();rebarGroup.visible=false;group.add(rebarGroup);
  mats.rebar=new THREE.MeshStandardMaterial({color:0xc34439,roughness:.62});
  const box = (parent, x, y, z, w, h, d, mat, outline = true) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    if (outline && mat !== mats.soil) {
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), edge);
      lines.position.copy(mesh.position);
      parent.add(lines);
    }
    return mesh;
  };
  const terrain = (near,far,level,wallLength,beta=0) => {
    const angle=Math.max(-60,Math.min(60,Number.isFinite(+beta)?+beta:0));
    const rise=(far-near)*Math.tan(angle*Math.PI/180),shape=new THREE.Shape();
    shape.moveTo(near,level-.025);
    shape.lineTo(far,level+rise-.025);
    shape.lineTo(far,level+rise+.025);
    shape.lineTo(near,level+.025);
    shape.closePath();
    const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:wallLength,bevelEnabled:false}),mats.ground);
    mesh.position.z=-wallLength/2;
    soilGroup.add(mesh);
  };
  const cylinder = (parent, x1, y1, z1, x2, y2, z2, diameter, mat) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const v = b.clone().sub(a), length = v.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(diameter / 2, diameter / 2, length, 12), mat);
    mesh.position.copy(a.add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    parent.add(mesh);
  };
  const stayBeam=(member)=>{
    const transform=stayBeamTransform(THREE,member);
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(member.length,member.depth,member.width),mats.strap);
    mesh.quaternion.copy(transform.quaternion);
    mesh.position.copy(transform.position);mesh.userData.kind='stay';group.add(mesh);
  };
  const supportRadius = Math.max(.065, Math.min(.16, g.hp * .035));
  const supportPoint = (x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(supportRadius, 12, 8), mats.support);
    mesh.position.set(x, y, z);
    group.add(mesh);
  };
  let centerX = 0, centerY = 0, length = g.Lw, depth = 0;
  if (snap.type === 'pile' || snap.type === 'pilecf') {
    const B = g.B, Lw = g.Lw, hz = g.hz;
    box(group, B / 2, -hz / 2, 0, B, hz, Lw, mats.base);
    const wallSection=new THREE.Shape();
    wallSection.moveTo(g.toe,0);wallSection.lineTo(g.toe+g.t,0);
    wallSection.lineTo(g.toe+g.ttop,g.hp);wallSection.lineTo(g.toe,g.hp);wallSection.closePath();
    const wallMesh=new THREE.Mesh(new THREE.ExtrudeGeometry(wallSection,{depth:Lw,bevelEnabled:false}),mats.wall);
    wallMesh.position.z=-Lw/2;group.add(wallMesh);
    if (snap.type === 'pilecf') {
      const count = g.ribCount;
      for (let k = 0; k < count; k += 1) {
        const z = -Lw/2+Math.min(k*g.ribCentreSpacing,Lw-g.ribThickness)+g.ribThickness/2;
        const span = g.ribLength;
        const shape = new THREE.Shape();
        shape.moveTo(g.toe + g.t, 0);
        shape.lineTo(g.toe + g.t, g.ribHeight);
        shape.lineTo(g.toe + g.t + span, 0);
        shape.closePath();
        const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {
          depth: g.ribThickness, bevelEnabled: false,
        }), mats.rib);
        mesh.position.z = z - g.ribThickness / 2;
        group.add(mesh);
      }
    }
    const pileRows = pileDrawingRows(g,snap.quantities.piles).map(row=>({...row,
      batter:row.id==='toe'?+snap.input.pileBatT:+snap.input.pileBatH}));
    pileRows.forEach((row) => {
      const count = row.count;
      for (let k = 0; k < count; k += 1) {
        const z = -Lw / 2 + row.stations[k];
        const dx = Math.tan(row.batter * Math.PI / 180) * g.pileEmb;
        cylinder(group, row.x, -hz, z, row.x - dx, -hz - g.pileEmb, z, g.pileB, mats.pile);
        supportPoint(row.x, -hz, z); // pile-head connection, not an ideal pin/fixed node
      }
    });
    const rearWidth=Math.max(g.heel*1.2,.5),rearStart=g.toe+g.t;
    box(soilGroup,rearStart+rearWidth/2,g.hp/2,0,rearWidth,g.hp,Lw,mats.soil,false);
    terrain(rearStart,rearStart+rearWidth,g.hp,Lw,snap.input.beta);
    box(soilGroup,-.6,-.015,0,1.2,.03,Lw,mats.ground,false);
    centerX = B / 2; centerY = (g.hp - g.pileEmb) / 4;
    depth = g.pileEmb;
  } else if (snap.type === 'soldier') {
    const Lw = g.Lw, H = g.hp, D = g.embed, S = g.pileS;
    const count = Math.max(2, Math.ceil(Lw / S-1e-9) + 1);
    for (let k = 0; k < count; k += 1) {
      const z = -Lw / 2 + Math.min(k*S,Lw);
      const y = (H - D) / 2;
      const w = g.pileB;
      box(group, 0, y, z - w * .32, w, H + D, w * .17, mats.pile);
      box(group, 0, y, z + w * .32, w, H + D, w * .17, mats.pile);
      box(group, 0, y, z, w * .23, H + D, w * .64, mats.pile);
      if(g.staySystem==='anchor'&&g.anchor?.complete){
        const a=g.anchor,angle=a.angle*Math.PI/180,yHead=H-g.stayLevel;
        const xFree=a.freeLength*Math.cos(angle),yFree=yHead-a.freeLength*Math.sin(angle);
        const xEnd=a.totalLength*Math.cos(angle),yEnd=yHead-a.totalLength*Math.sin(angle);
        cylinder(group,0,yHead,z,xFree,yFree,z,.03,mats.strap);
        cylinder(group,xFree,yFree,z,xEnd,yEnd,z,a.bondDiameter,mats.pile);
        supportPoint(0,yHead,z);
      }
    }
    if(g.staySystem==='stay'&&g.stayLayout){
      for(const ap of g.stayLayout.anchors){
        const w=ap.width,y=(ap.head.y+ap.tip.y)/2,h=ap.head.y-ap.tip.y,z=ap.head.z;
        box(group,ap.head.x,y,z-w*.32,w,h,w*.17,mats.pile);
        box(group,ap.head.x,y,z+w*.32,w,h,w*.17,mats.pile);
        box(group,ap.head.x,y,z,w*.23,h,w*.64,mats.pile);
        // Connection envelope only: the rear cap is not a separately designed member.
        supportPoint(ap.head.x,ap.head.y,z);
      }
      for(const cap of g.rearCaps||rearPileCaps(g.stayLayout))box(group,...cap.position,...cap.size,mats.cap);
      for(const member of g.stayLayout.members){stayBeam(member);supportPoint(member.front.x,member.front.y,member.front.z);}
    }
    for(const part of soldierLaggingParts(g)) {
      const plank=box(group,...part.position,...part.size,mats.lag);
      plank.userData.rwLaggingLabel=part.label;
    }
    for(const b of g.capBeams||[])box(group,0,b.y,0,b.width,b.depth,Lw,mats.base);
    // Soil resistance below excavation is distributed; a translucent band avoids a false toe pin.
    box(group, g.pileB * .9, -D / 2, 0, g.pileB * .2, D, Lw,
      mats.contact, false);
    const reach=Math.max(2.2,(g.stayLength||0)+1.2);
    box(soilGroup,reach/2,H/2,0,reach,H,Lw,mats.soil,false);
    terrain(0,reach,H,Lw,snap.input.beta);
    box(soilGroup,-.6,-.015,0,1.2,.03,Lw,mats.ground,false);
    centerX = (g.stayLength||0)/2; centerY = (H - D) / 3;
    depth = Math.max(D,-(g.stayLayout?.anchors[0]?.tip.y||0));
  } else if (snap.type === 'duckfoot') {
    const span = (g.nPosts - 1) * g.postSpacing;
    length = span + g.capL;
    for(const member of duckfootConcreteBoxes(g))box(group,...member.position,...member.size,mats[member.kind]);
    for (let k = 0; k < g.nPosts; k += 1) {
      const z = -span / 2 + k * g.postSpacing;
      supportPoint(g.t / 2, .04, z); // column-pad joint, while soil contact remains distributed
      supportPoint(g.t / 2, g.beamAxis, z); // vertical beam support at the column, not a lateral brace
      const e = snap.pads?.[k] || snap.equilibrium;
      if (e.contactWidth != null) {
        const x = e.fullContact || e.xResultant < g.B / 2
          ? e.contactWidth / 2 : g.B - e.contactWidth / 2;
        box(group, x, -g.hz - .035, z, e.contactWidth, .05, g.capL,
          mats.contact, false);
      }
    }
    box(group, -.035, .018, 0, .025, .036, length + .25, mats.boundary, false);
    box(soilGroup, g.B / 2, -g.hz - .24, 0,
      g.B + .25, .48, length + .4, mats.soil, false);
    box(soilGroup,g.B/2,-g.hz-.015,0,g.B+.25,.03,length+.4,mats.ground,false);
    centerX = g.B / 2;
    centerY = (g.hp - g.hz) / 2;
  }
  const stress=mountStressOverlay(THREE,group,snap);
  const paths=snap.rebarLayout?.groups||[];
  const stride=Math.max(1,Math.ceil(paths.reduce((n,p)=>n+p.paths.length,0)/1400));
  for(const run of paths)for(let j=0;j<run.paths.length;j+=stride){
    const points=run.paths[j].map(([x,y,z])=>['duckfoot','soldier'].includes(snap.type)?[x,y,z]:[x,y-g.hz,z-g.Lw/2]);
    for(let k=1;k<points.length;k++)cylinder(rebarGroup,...points[k-1],...points[k],run.db/1000,mats.rebar);
  }
  const grid = new THREE.GridHelper(Math.max(length, g.B || 0, depth) * 2, 24, 0xa7b5c2, 0xd6dee6);
  grid.position.y = snap.type === 'soldier' ? -.08 : -(g.hz || 0) - .08;
  scene.add(grid);
  const camera = new THREE.PerspectiveCamera(40, 1, .05, 500);
  const radius = Math.max(length, g.hp + depth, g.B || 0,g.stayLength||0,g.anchor?.totalLength||0)
    * (snap.type === 'duckfoot' ? 1.15 : 1.8);
  const target = new THREE.Vector3(centerX, centerY, 0);
  const views = {
    iso: [radius * .74, radius * .55, radius * .9],
    plan: [0, radius * 1.3, .001],
    section: [0, radius * .2, radius],
    elevation: [radius, radius * .2, 0],
  };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const appearance=mountSceneAppearance(THREE,scene,renderer);
  const matKinds=new Map(Object.entries(mats).map(([kind,mat])=>[mat,kind]));
    group.traverse(obj=>{const kind=matKinds.get(obj.material);if(kind)appearance.dress(obj,kind,{steel:snap.type==='soldier'&&kind==='strap'&&snap.input.soldierSys==='anchor',label:obj.userData.rwLaggingLabel||(obj.userData.kind==='stay'?'คานสเตย์':snap.type==='soldier'&&kind==='strap'&&obj.geometry?.type==='CylinderGeometry'?'สมอยึดดิน':snap.type==='duckfoot'&&kind==='cap'?'ฐานรากตีนเป็ด':undefined)});});
  const controls = new OrbitControls(camera, renderer.domElement);
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const onMotion=()=>{controls.enableDamping=!motion.matches;};onMotion();motion.addEventListener('change',onMotion);
  controls.target.copy(target);
  controls.minDistance=Math.max(.15,radius*.025);controls.maxDistance=radius*10;
  const zoom=mountSmoothZoom(camera,controls,canvas);
  let dirty=true;const invalidate=()=>{dirty=true;};const cameraSignal=mountCameraRenderSignal(camera,controls,invalidate);
  const cameraMotion=mountCameraTransition(camera,controls,canvas,{invalidate});
  const interaction=mountSceneInteraction(THREE,{canvas,scene,camera,controls,renderer,appearance,model:group,zoom,invalidate,transition:cameraMotion});
  const viewState=mountCameraViewState(camera,controls,options.onViewChange);
  const bounds=new THREE.Box3().setFromObject(group);
  appearance.update(bounds);
  const fitNow=()=>{zoom.cancel();fitCameraToBounds(THREE,camera,controls,bounds);invalidate();};
  const fit=()=>cameraMotion.run(fitNow);
  let viewportScale = 1;
  const setViewNow = (name) => {
    zoom.cancel();
    const v = views[name] || views.iso;
    camera.position.set(target.x + v[0] * viewportScale, target.y + v[1] * viewportScale,
      target.z + v[2] * viewportScale);
    controls.target.copy(target);
    fitNow();
    viewState.remember(Object.hasOwn(views,name)?name:'iso');
  };
  const setView=name=>cameraMotion.run(()=>setViewNow(name),()=>viewState.remember(Object.hasOwn(views,name)?name:'iso'));
  setViewNow('iso');
  const keys=mountCameraKeys(canvas,controls,zoom,{fit,reset:()=>setView('iso')});
  let lastWidth=0,lastHeight=0;const resize = () => {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height||width===lastWidth&&height===lastHeight) return;lastWidth=width;lastHeight=height;cameraMotion.cancel();
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Preserve the user's orbit/zoom while fitting the narrower field of view.
    const nextScale = Math.max(1, height / width);
    camera.position.sub(controls.target).multiplyScalar(nextScale / viewportScale).add(controls.target);
    zoom.rescale(nextScale / viewportScale);
    viewportScale = nextScale;
    camera.updateProjectionMatrix();invalidate();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  let live = true,raf=0;
  const render = (time) => {
    if (!live) return;
    if(!window.frameElement?.hidden&&document.visibilityState!=='hidden'&&canvas.offsetParent!==null){
      const moving=cameraMotion.update(time),zooming=zoom.update(time),changed=controls.update();interaction.update();
      if(dirty||moving||zooming){renderer.render(scene,camera);dirty=false;}
    }
    raf=requestAnimationFrame(render);
  };
  render();
  return {
    setContour(visible){stress.setVisible(visible);interaction.update();invalidate();},
    setView,
    fit,
    zoomBy:factor=>zoom.by(factor),
    setSoil(visible) { soilGroup.visible = visible;appearance.invalidate();invalidate(); },
    setRebar(visible) {rebarGroup.visible=!!visible;
      appearance.setInspection(visible);
      stress.setRebar(visible);
      for(const name of ['wall','base','cap','rib','strap','pile']){mats[name].transparent=!!visible;mats[name].opacity=visible?.2:1;mats[name].depthWrite=!visible;mats[name].needsUpdate=true;}
      interaction.update();appearance.invalidate();invalidate();},
    image() { renderer.render(scene,camera); return canvas.toDataURL('image/png'); },
    dispose() {
      stress.dispose();
      live = false;cancelAnimationFrame(raf);interaction.dispose();cameraMotion.dispose();appearance.dispose();cameraSignal.dispose();
      observer.disconnect();
      motion.removeEventListener('change',onMotion);
      viewState.dispose();
      keys.dispose();
      zoom.dispose();
      controls.dispose();
      group.traverse((obj) => { obj.geometry?.dispose(); });
      grid.geometry.dispose();for(const mat of Array.isArray(grid.material)?grid.material:[grid.material])mat.dispose();
      Object.values(mats).forEach((mat) => mat.dispose());
      edge.dispose();
      renderer.dispose();
    },
  };
}
