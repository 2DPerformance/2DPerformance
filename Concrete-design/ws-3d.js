/* ════════════════════════════════════════════════════════════════
   ws-3d.js — Foundation Lab · Revit-grade 3D viewport enhancer
   ----------------------------------------------------------------
   ครอบ viewer 3D เดิมของทุกเครื่องมือ (Three.js) ให้ได้ระดับ Revit:
     · ViewCube มุมขวาบน — คลิกหน้า/มุม เพื่อสแน็ปมุมมอง
     · แถบนำทาง — Fit / Top / Front / Right / ISO / Persp↔Ortho
     · Pan (คลิกขวา หรือ กลางลาก) · Orbit/Zoom เดิมยังทำงาน
     · แสงสตูดิโอนุ่ม + เงาสัมผัสพื้น (contact shadow)
     · ปิดการหมุนเองอัตโนมัติ (static = มืออาชีพ)
   ----------------------------------------------------------------
   ทำงานโดย "เป็นเจ้าของกล้องชั้นบนสุด": อ่านตัวแปรมุมของ engine เดิม
   (az/pol — Pattern A · theta/phi — Pattern B) เป็น source of truth
   แล้ว render ทับเป็นเฟรมสุดท้าย → ไม่ต้องแก้โค้ด engine เดิมเลย
   ════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  if(typeof window==='undefined') return;
  if(window.__WS3D_LOADED) return; window.__WS3D_LOADED=true;

  var DEG=180/Math.PI, RAD=Math.PI/180;

  /* ---------- inject CSS once ---------- */
  function injectCSS(){
    if(document.getElementById('ws3d-css')) return;
    var css=[
".ws3d-ui{position:absolute;inset:0;pointer-events:none;z-index:6;font-family:'IBM Plex Mono',ui-monospace,Consolas,monospace}",
/* relocate legacy legend to bottom-right so cube owns top-right */
".viewer3d .v3d-legend{top:auto!important;bottom:10px!important;right:10px!important}",
/* ViewCube */
".ws3d-cube-wrap{position:absolute;top:12px;right:12px;width:76px;height:76px;pointer-events:auto;perspective:340px}",
".ws3d-cube{position:relative;width:76px;height:76px;transform-style:preserve-3d;transition:transform .05s linear}",
".ws3d-face{position:absolute;width:76px;height:76px;display:flex;align-items:center;justify-content:center;",
  "font-size:11px;font-weight:600;letter-spacing:.5px;color:#33425C;cursor:pointer;",
  "background:rgba(255,255,255,.82);border:1px solid #9fb4d0;box-sizing:border-box;",
  "backface-visibility:hidden;transition:background .12s,color .12s;text-transform:uppercase}",
".ws3d-face:hover{background:#F58220;color:#fff;border-color:#F58220}",
".ws3d-corner{position:absolute;width:18px;height:18px;cursor:pointer;pointer-events:auto;z-index:2}",
/* nav toolbar */
".ws3d-bar{position:absolute;top:100px;right:12px;display:flex;flex-direction:column;gap:5px;pointer-events:auto}",
".ws3d-bar button{width:34px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;",
  "background:rgba(255,255,255,.92);border:1px solid #C7D6E8;border-radius:8px;color:#1B4F8C;",
  "box-shadow:0 2px 6px rgba(10,22,40,.12);transition:background .12s,border-color .12s,color .12s;padding:0}",
".ws3d-bar button:hover{background:#1B4F8C;border-color:#1B4F8C;color:#fff}",
".ws3d-bar button.on{background:#F58220;border-color:#F58220;color:#fff}",
".ws3d-bar button svg{width:17px;height:17px;display:block}",
".ws3d-bar .lbl{font-size:8.5px;font-weight:700;line-height:1}",
/* nav hint pill bottom-left */
".ws3d-help{position:absolute;left:11px;bottom:10px;pointer-events:none;font-family:'IBM Plex Mono',monospace;",
  "font-size:9.5px;color:#5B6C84;background:rgba(255,255,255,.86);border:1px solid #DCE5F0;",
  "border-radius:7px;padding:4px 9px;letter-spacing:.2px;max-width:60%}",
"@media(max-width:560px){.ws3d-bar{top:96px}.ws3d-cube-wrap{width:62px;height:62px}.ws3d-cube,.ws3d-face{width:62px;height:62px}.ws3d-help{display:none}}",
"@media print{.ws3d-ui{display:none!important}}"
    ].join('\n');
    var st=document.createElement('style'); st.id='ws3d-css'; st.textContent=css;
    document.head.appendChild(st);
  }

  /* ---------- SVG icons ---------- */
  var IC={
    fit:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3"/><circle cx="12" cy="12" r="2.5"/></svg>',
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>',
    persp:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l16-2v16L4 18z"/><path d="M4 6v12M20 4v16"/></svg>',
    ortho:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="1"/></svg>'
  };

  /* ---------- named view directions (target→camera unit vector) ---------- */
  // โลก: Y ขึ้น · ISO = มองจากหน้า-ขวา-บน
  var VIEWS={
    iso:   [ 1, 0.82, 1 ],
    top:   [ 0, 1, 0.0001 ],
    bottom:[ 0,-1, 0.0001 ],
    front: [ 0, 0.0001, 1 ],
    back:  [ 0, 0.0001,-1 ],
    right: [ 1, 0.0001, 0 ],
    left:  [-1, 0.0001, 0 ]
  };
  function norm(a){ var L=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/L,a[1]/L,a[2]/L]; }

  /* ---------- one controller per page (single viewer) ---------- */
  function attach(V3){
    if(!V3 || !V3.camera || !V3.renderer || !V3.scene){ return false; }
    if(V3.__ws3d) return true;
    var THREE = window.THREE; if(!THREE) return false;

    var canvas = V3.renderer.domElement;
    var host = canvas.closest ? canvas.closest('.viewer3d') : canvas.parentElement;
    if(!host) host = canvas.parentElement;
    if(getComputedStyle(host).position==='static') host.style.position='relative';

    var patternB = ('theta' in V3) && ('phi' in V3);   // footings
    var fov = V3.camera.fov || 40;

    var ws = {
      pan:new THREE.Vector3(0,0,0),
      ortho:false,
      anim:null,                       // {az,pol}|{theta,phi}, r
      perspCam:V3.camera,
      orthoCam:new THREE.OrthographicCamera(-1,1,1,-1,-500,2000),
      baseTarget:patternB ? V3.target.clone() : new THREE.Vector3(0,0,0),
      shadow:null, fitRadius:1
    };
    V3.__ws3d = ws;
    if(typeof V3.idle!=='number') V3.idle = 0;   // ensure pinnable

    /* ----- current direction (target→camera) from engine vars ----- */
    function curDir(){
      if(patternB){
        var cp=Math.cos(V3.phi), sp=Math.sin(V3.phi);
        return [cp*Math.cos(V3.theta), sp, cp*Math.sin(V3.theta)];
      }
      var s=Math.sin(V3.pol);
      return [s*Math.sin(V3.az), Math.cos(V3.pol), s*Math.cos(V3.az)];
    }
    function centerVec(){
      var c=(patternB ? V3.target : ws.baseTarget);
      return new THREE.Vector3(c.x+ws.pan.x, c.y+ws.pan.y, c.z+ws.pan.z);
    }

    /* ----- write a named view into engine vars (with tween) ----- */
    function dirToVars(d){
      d=norm(d);
      if(patternB){
        var phi=Math.asin(Math.max(-0.999,Math.min(0.999,d[1])));
        var theta=Math.atan2(d[2],d[0]);
        return {theta:theta, phi:Math.max(0.06,Math.min(Math.PI/2-0.03,phi))};
      }
      var pol=Math.acos(Math.max(-0.999,Math.min(0.999,d[1])));
      var az=Math.atan2(d[0],d[2]);
      return {az:az, pol:Math.max(0.10,Math.min(1.54,pol))};
    }
    function setView(name){
      var d=VIEWS[name]||VIEWS.iso;
      var t=dirToVars(d);
      ws.anim={to:t, fr:0};
      ws.pan.set(0,0,0);
    }
    function lerpAng(a,b,f){ var d=b-a; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return a+d*f; }

    /* ----- fit camera to model bbox ----- */
    function fit(reset){
      var box=new THREE.Box3(), tmp=new THREE.Box3(), any=false;
      V3.scene.traverse(function(o){
        if(o.isMesh && o.geometry && o.visible && !o.__ws3dShadow){
          // skip very large ground/grid helpers
          if(o.type==='GridHelper') return;
          tmp.setFromObject(o);
          if(isFinite(tmp.min.x)){ if(!any){box.copy(tmp);any=true;} else box.union(tmp); }
        }
      });
      if(!any) return;
      var c=box.getCenter(new THREE.Vector3());
      var sz=box.getSize(new THREE.Vector3());
      var radius=0.5*Math.max(sz.x,Math.max(sz.y,sz.z))||1;
      ws.fitRadius=radius;
      if(patternB){ V3.target.copy(c); ws.baseTarget.copy(c); }
      else { ws.baseTarget.copy(c); }
      ws.pan.set(0,0,0);
      var dist=radius/Math.sin((fov*RAD)/2)*1.25;
      V3.r=dist;
      buildShadow(box);
      if(reset) setView('iso');
    }

    /* ----- soft contact shadow under model ----- */
    function buildShadow(box){
      try{
        if(ws.shadow){ V3.scene.remove(ws.shadow); if(ws.shadow.material.map) ws.shadow.material.map.dispose(); ws.shadow.geometry.dispose(); ws.shadow.material.dispose(); ws.shadow=null; }
        var sz=box.getSize(new THREE.Vector3());
        var c=box.getCenter(new THREE.Vector3());
        var R=Math.max(sz.x,sz.z)*1.5||1;
        var cv=document.createElement('canvas'); cv.width=cv.height=128;
        var g=cv.getContext('2d');
        var gr=g.createRadialGradient(64,64,4,64,64,62);
        gr.addColorStop(0,'rgba(20,36,59,0.40)'); gr.addColorStop(0.55,'rgba(20,36,59,0.16)'); gr.addColorStop(1,'rgba(20,36,59,0)');
        g.fillStyle=gr; g.beginPath(); g.arc(64,64,64,0,6.2832); g.fill();
        var tex=new THREE.CanvasTexture(cv);
        var geo=new THREE.PlaneGeometry(R*2,R*2);
        var mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false});
        var m=new THREE.Mesh(geo,mat);
        m.rotation.x=-Math.PI/2;
        var baseY=(typeof V3.gridY==='number')?V3.gridY:box.min.y;
        m.position.set(c.x, baseY-0.001, c.z);
        m.renderOrder=-1; m.__ws3dShadow=true;
        V3.scene.add(m); ws.shadow=m;
      }catch(e){}
    }

    /* ----- studio fill lighting (additive, subtle) ----- */
    function addLights(){
      try{
        var hasHemi=false; V3.scene.traverse(function(o){ if(o.isHemisphereLight) hasHemi=true; });
        if(!hasHemi){
          var hemi=new THREE.HemisphereLight(0xffffff,0x8a98ad,0.30); V3.scene.add(hemi);
        }
        var rim=new THREE.DirectionalLight(0xeaf2ff,0.22); rim.position.set(-4,6,-6); V3.scene.add(rim);
      }catch(e){}
    }

    /* ----- background gradient for flat-color scenes (footings) ----- */
    function niceBg(){
      try{
        if(V3.scene.background && V3.scene.background.isColor){
          var cv=document.createElement('canvas'); cv.width=4; cv.height=256;
          var g=cv.getContext('2d'); var gr=g.createLinearGradient(0,0,0,256);
          gr.addColorStop(0,'#f4f8fc'); gr.addColorStop(0.55,'#e6edf6'); gr.addColorStop(1,'#d3dde9');
          g.fillStyle=gr; g.fillRect(0,0,4,256);
          V3.scene.background=new THREE.CanvasTexture(cv);
        }
      }catch(e){}
    }

    /* ----- build ViewCube + toolbar UI ----- */
    var cubeEl, ui;
    function buildUI(){
      ui=document.createElement('div'); ui.className='ws3d-ui';
      // cube
      var wrap=document.createElement('div'); wrap.className='ws3d-cube-wrap';
      cubeEl=document.createElement('div'); cubeEl.className='ws3d-cube';
      var faces=[
        ['front','หน้า','translateZ(38px)'],
        ['back','หลัง','rotateY(180deg) translateZ(38px)'],
        ['right','ขวา','rotateY(90deg) translateZ(38px)'],
        ['left','ซ้าย','rotateY(-90deg) translateZ(38px)'],
        ['top','บน','rotateX(90deg) translateZ(38px)'],
        ['bottom','ล่าง','rotateX(-90deg) translateZ(38px)']
      ];
      faces.forEach(function(f){
        var d=document.createElement('div'); d.className='ws3d-face'; d.textContent=f[1];
        d.style.transform=f[2];
        d.addEventListener('click',function(ev){ ev.stopPropagation(); setView(f[0]); });
        cubeEl.appendChild(d);
      });
      wrap.appendChild(cubeEl); ui.appendChild(wrap);
      // toolbar
      var bar=document.createElement('div'); bar.className='ws3d-bar';
      function btn(html,title,fn,isText){
        var b=document.createElement('button'); b.title=title;
        b.innerHTML = isText ? '<span class="lbl">'+html+'</span>' : html;
        b.addEventListener('click',function(ev){ ev.stopPropagation(); fn(b); });
        bar.appendChild(b); return b;
      }
      btn(IC.fit,'พอดีจอ · Fit',function(){ fit(false); });
      btn(IC.home,'มุมมองเริ่มต้น (ISO)',function(){ fit(false); setView('iso'); });
      btn('TOP','มองจากบน · Top',function(){ setView('top'); },true);
      btn('FRO','มองด้านหน้า · Front',function(){ setView('front'); },true);
      btn('RHT','มองด้านขวา · Right',function(){ setView('right'); },true);
      btn('ISO','มุมมองสามมิติ · ISO',function(){ setView('iso'); },true);
      var orthoBtn=btn(IC.persp,'สลับ Perspective ↔ Orthographic',function(b){
        ws.ortho=!ws.ortho;
        b.classList.toggle('on',ws.ortho);
        b.innerHTML=ws.ortho?IC.ortho:IC.persp;
        b.title=ws.ortho?'โหมดฉายขนาน (Orthographic) — คลิกเพื่อกลับ Perspective':'โหมดทัศนมิติ (Perspective) — คลิกเพื่อใช้ Orthographic';
      });
      ui.appendChild(bar);
      // help pill
      var help=document.createElement('div'); help.className='ws3d-help';
      help.textContent='ลาก = หมุน · คลิกขวา/2 นิ้ว = เลื่อน · ล้อ = ซูม · ViewCube = สแน็ปมุมมอง';
      ui.appendChild(help);
      host.appendChild(ui);
    }

    /* ----- right-drag / middle-drag PAN ----- */
    function installPan(){
      var panning=false, px=0, py=0;
      function worldPerPixel(){
        var h=canvas.clientHeight||1;
        if(ws.ortho){
          return (2*(V3.r*Math.tan((fov*RAD)/2)))/h;
        }
        return (2*V3.r*Math.tan((fov*RAD)/2))/h;
      }
      function start(x,y){ panning=true; px=x; py=y; }
      function move(x,y){
        if(!panning) return;
        var dx=x-px, dy=y-py; px=x; py=y;
        var cam=V3.camera;
        var right=new THREE.Vector3(), up=new THREE.Vector3();
        cam.matrixWorld.extractBasis(right,up,new THREE.Vector3());
        var k=worldPerPixel();
        ws.pan.addScaledVector(right,-dx*k);
        ws.pan.addScaledVector(up, dy*k);
      }
      canvas.addEventListener('contextmenu',function(e){ e.preventDefault(); });
      canvas.addEventListener('mousedown',function(e){
        if(e.button===2 || e.button===1){ e.preventDefault(); start(e.clientX,e.clientY); }
      });
      window.addEventListener('mousemove',function(e){ if(panning) move(e.clientX,e.clientY); });
      window.addEventListener('mouseup',function(e){ if(e.button===2||e.button===1) panning=false; });
      // two-finger pan (touch)
      canvas.addEventListener('touchstart',function(e){
        if(e.touches.length===2){ var t=e.touches; start((t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2); }
      },{passive:true});
      canvas.addEventListener('touchmove',function(e){
        if(e.touches.length===2){ var t=e.touches; move((t[0].clientX+t[1].clientX)/2,(t[0].clientY+t[1].clientY)/2); }
      },{passive:true});
      canvas.addEventListener('touchend',function(){ panning=false; });
    }

    /* ----- master render loop (authoritative camera) ----- */
    function applyCamera(){
      var center=centerVec();
      var d=curDir();
      var cam = ws.ortho ? ws.orthoCam : ws.perspCam;
      if(V3.camera!==cam){ V3.camera=cam; }   // engine loops read V3.camera each frame
      var w=canvas.clientWidth||canvas.width||1, h=canvas.clientHeight||canvas.height||1;
      if(ws.ortho){
        var hh=V3.r*Math.tan((fov*RAD)/2);
        var hw=hh*(w/h);
        cam.left=-hw; cam.right=hw; cam.top=hh; cam.bottom=-hh;
        cam.near=-500; cam.far=2000; cam.updateProjectionMatrix();
      }else{
        if(cam.aspect!==w/h){ cam.aspect=w/h; cam.updateProjectionMatrix(); }
      }
      cam.position.set(center.x+d[0]*V3.r, center.y+d[1]*V3.r, center.z+d[2]*V3.r);
      cam.up.set(0,1,0);
      cam.lookAt(center);
      V3.renderer.render(V3.scene, cam);
    }

    function syncCube(){
      if(!cubeEl) return;
      var d=curDir();
      var yaw=Math.atan2(d[0],d[2])*DEG;
      var pitch=Math.asin(Math.max(-1,Math.min(1,d[1])))*DEG;
      cubeEl.style.transform='translateZ(-38px) rotateX('+pitch.toFixed(1)+'deg) rotateY('+(-yaw).toFixed(1)+'deg)';
    }

    function tick(){
      try{
        // pin auto-rotate off
        if(typeof V3.idle==='number') V3.idle=-1e6;
        // tween named-view
        if(ws.anim){
          var a=ws.anim, f=0.18;
          if(patternB){
            V3.theta=lerpAng(V3.theta,a.to.theta,f);
            V3.phi += (a.to.phi-V3.phi)*f;
            if(Math.abs(lerpAng(V3.theta,a.to.theta,1)-V3.theta)<0.002 && Math.abs(a.to.phi-V3.phi)<0.002){ V3.theta=a.to.theta; V3.phi=a.to.phi; ws.anim=null; }
          }else{
            V3.az=lerpAng(V3.az,a.to.az,f);
            V3.pol += (a.to.pol-V3.pol)*f;
            if(Math.abs(lerpAng(V3.az,a.to.az,1)-V3.az)<0.002 && Math.abs(a.to.pol-V3.pol)<0.002){ V3.az=a.to.az; V3.pol=a.to.pol; ws.anim=null; }
          }
          a.fr++; if(a.fr>120) ws.anim=null;
        }
        applyCamera();
        syncCube();
      }catch(e){}
    }
    var raf;
    function frame(){ tick(); raf=requestAnimationFrame(frame); }
    V3.ws3dTick=tick;   // manual stepper (verification / hidden-tab resilience)

    /* ---- go ---- */
    injectCSS();
    addLights();
    niceBg();
    buildUI();
    installPan();
    // initial fit shortly after first draw so bbox is populated
    setTimeout(function(){ try{ fit(false); }catch(e){} },120);
    setTimeout(function(){ try{ fit(false); }catch(e){} },650);
    frame();

    // expose for debugging / external calls
    V3.ws3dSetView=setView;
    V3.ws3dFit=fit;
    return true;
  }

  /* ---------- wait for engine V3 to exist, then attach ---------- */
  var tries=0;
  function poll(){
    tries++;
    try{
      if(window.V3 && window.V3.camera && window.V3.renderer && window.V3.scene){
        if(attach(window.V3)) return;
      }
    }catch(e){}
    if(tries<200) setTimeout(poll, 120);   // up to ~24s
  }
  if(document.readyState==='complete' || document.readyState==='interactive') setTimeout(poll,300);
  else window.addEventListener('DOMContentLoaded',function(){ setTimeout(poll,300); });
})();
