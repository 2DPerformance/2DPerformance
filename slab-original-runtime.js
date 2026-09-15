(function slabOriginalRuntimeFactory(global){
  'use strict';

  const RUNTIME_VERSION = '20260809-16';
  const SNAPSHOT_SCHEMA = 'sv-unified-slab-snapshot-v1';
  const SOURCE_SPECS = deepFreeze({
    ground: {
      path: '/slab-on-ground/standalone-v3.html',
      sha256: 'D6DFC36345BEB426AE942DA414040C56671DFFAF1FCECE3B927E5669EBCB572D',
      bytes: 1458884,
      mark: 'SL-04'
    },
    oneway: {
      path: '/slab-studio-source/one-way-slab.html',
      /* Re-pinned 2026-08-10: takes its load factors from the caller so the
         owner-approved design-standard selector can switch มยผ. / ACI 318-19.
         Defaults to 1.4/1.7, so a caller that sends none is unchanged. */
      sha256: 'C55F405F7C67CCA7364E35FCB9F137F93434A89CB7176B2D4C42E6B62EF57EA0',
      bytes: 162179,
      mark: 'SL-01'
    },
    cantilever: {
      path: '/slab-studio-source/cantilever-slab.html',
      /* Re-pinned 2026-08-10: takes its load factors from the caller for the
         design-standard selector, and its report now prints the standard that
         produced the numbers instead of the literal 1.4DL + 1.7LL. */
      sha256: 'E8496472F4617217CF0D2041D32A1B2056AF35CED24F0DD9B4CCB4459BD902D3',
      bytes: 218109,
      mark: 'SL-03'
    },
    twoway: {
      path: '/slab-studio-source/two-way-slab.html',
      /* Re-pinned 2026-08-10, owner-approved two-way corrections:
         - every rounding in the design chain now goes the safe way. Measured on
           the engine's own code over 5.29M realistic sections, 9.16% used to
           deliver less steel than their own moment needed (worst 1.50%) while
           every gate still read pass; that is now 0, and the owner's own run
           keeps all six spacings unchanged.
         - the printed S_max formula says 2t, which is what the code computes.
         - the thickness bar no longer captions itself as a deflection check.
         - the moment diagram labels the three design moments instead of the
           fitted curve's extrema, so the second negative moment is no longer
           missing and the positive one is no longer 1.3% high. */
      sha256: 'DF4CCBFAEBDECFEA87D5A5AB7E8C14BB006488705B7B5DE447F7853C7BA157F9',
      bytes: 131244,
      mark: 'SL-02'
    }
  });
  const SOURCE_FILES = Object.freeze(Object.fromEntries(
    Object.entries(SOURCE_SPECS).map(([type, spec])=>[type, spec.path])
  ));
  const DEPENDENCY_SPECS = deepFreeze({
    '/slab-studio-source/ck-fnd.js': {
      path:'/slab-studio-source/ck-fnd.js',
      sha256:'421AC8B235DE29034C6C85111169B095B37C48F1E3CA2631965C2BDFEC54E7FA',
      bytes:23460
    },
    '/slab-studio-source/ck-slab-result-contract.js': {
      path:'/slab-studio-source/ck-slab-result-contract.js',
      sha256:'4BA2BF76023C4FBD35E172DADA690E05988B26155BA0CBEE217D03D9DF2556BC',
      bytes:7075
    },
    '/slab-studio-source/three-r128.min.js': {
      path:'/slab-studio-source/three-r128.min.js',
      sha256:'7AE04663BB431808BC025280122162029EA3A354EFC5FCCA8BD8F95D1A1933E9',
      bytes:603451
    },
    '/slab-studio-source/ws-layer.js': {
      path:'/slab-studio-source/ws-layer.js',
      sha256:'B77F8ADE487887D7B9A8385BE3640ABE5A9CA556910863060C77C7E219D27D1B',
      bytes:6990
    },
    '/slab-studio-source/ws-3d.js': {
      path:'/slab-studio-source/ws-3d.js',
      sha256:'53AA147CEC3942545957B992FF20EDFBDA60114224CBCE73867C90E67C7A1559',
      bytes:19693
    },
    '/slab-studio-source/ck-report.js': {
      path:'/slab-studio-source/ck-report.js',
      sha256:'0577D38B3AD4B7AE870D2E2EC4D6E47569E062161F671095494A9432685070F2',
      bytes:35854
    },
    '/slab-studio-source/ck-wire-mesh.js': {
      path:'/slab-studio-source/ck-wire-mesh.js',
      sha256:'80DD3947D4D3CE8C2B7F63C82E628C5C15244AFA70CFEBF976B1FEADD0C4A6CA',
      bytes:32363
    }
  });
  const DEPENDENCY_ORDER = deepFreeze({
    ground:[],
    oneway:[
      '/slab-studio-source/ck-fnd.js',
      '/slab-studio-source/three-r128.min.js',
      '/slab-studio-source/ws-3d.js',
      '/slab-studio-source/ck-report.js',
      '/slab-studio-source/ck-wire-mesh.js'
    ],
    cantilever:[
      '/slab-studio-source/ck-fnd.js',
      '/slab-studio-source/ck-slab-result-contract.js',
      '/slab-studio-source/three-r128.min.js',
      '/slab-studio-source/ws-layer.js',
      '/slab-studio-source/ws-3d.js',
      '/slab-studio-source/ck-report.js',
      '/slab-studio-source/ck-wire-mesh.js'
    ],
    twoway:[
      '/slab-studio-source/ck-fnd.js',
      '/slab-studio-source/ck-slab-result-contract.js',
      '/slab-studio-source/three-r128.min.js',
      '/slab-studio-source/ws-layer.js',
      '/slab-studio-source/ws-3d.js',
      '/slab-studio-source/ck-report.js',
      '/slab-studio-source/ck-wire-mesh.js'
    ]
  });
  const REMOTE_DEPENDENCY_ALIASES = Object.freeze({
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js':'/slab-studio-source/three-r128.min.js'
  });
  const CANTILEVER_TRANSIENT_RESULT_KEYS = Object.freeze(['h_x','d_x','Mu_x','Vu_x']);
  const DOCUMENT_FIELDS = Object.freeze([
    'name','client','location','mark','drawing','revision','date','prepared','checked'
  ]);
  const SNAPSHOT_TOP_LEVEL_KEYS = Object.freeze([
    'document','evidence','fingerprint','id','input','labels','ledger','overall','result',
    'runtimeVersion','schedule','schema','selection','source','type'
  ].sort());
  /* These are the source engines' existing render-time input guards, moved in
     front of direct compute() calls. The Unified wrapper must not let invalid
     values bypass the same boundary merely because it calls the preserved
     calculation function without clicking the source page's Render button. */
  const STRUCTURAL_INPUT_GUARDS = deepFreeze({
    oneway: {
      positive:['fc','fy1','fy2','S','L','tdef','cov','phib','phiv','mainDia','tempDia'],
      nonnegative:['sdl','ll'],
      cases:[0,1,2]
    },
    twoway: {
      positive:['fc','fy','fy1','fy2','S','L','tdef','cov','phib','phiv','dia','mainDia','tempDia'],
      nonnegative:['sdl','ll'],
      cases:[1,2,3,4,5,6,7,8,9]
    },
    cantilever: {
      positive:['fc','fy1','fy2','L','B','cov','phib','phiv','mainDia','tempDia'],
      nonnegative:['sdl','ll','finw'],
      modes:['uniform','tapered']
    }
  });
  const GROUND_INPUT_BOUNDS = deepFreeze({
    fc:[180,600],fy:[2400,6000],F:[.5,3.5],t:[8,30],Lj:[1.5,8],
    B:[1,30],L:[1,60],barSpacing:[10,45],lean:[0,15],sand:[0,30]
  });
  const sessions = new Map();
  const surfaceOperations = new Map();

  document.documentElement.dataset.slabOriginalRuntime = RUNTIME_VERSION;

  function typeSpec(type){
    const spec = SOURCE_SPECS[type];
    if(!spec) throw new Error('ไม่พบไฟล์ Engine เดิมสำหรับชนิดพื้นที่เลือก');
    return spec;
  }

  function dependencySpecs(type){
    typeSpec(type);
    return DEPENDENCY_ORDER[type].map(path=>DEPENDENCY_SPECS[path]);
  }

  function deepFreeze(value, seen=new Set()){
    if(value===null || (typeof value!=='object' && typeof value!=='function')) return value;
    if(seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach(key=>deepFreeze(value[key],seen));
    return Object.freeze(value);
  }

  function clonePlain(value,path='$',ancestors=new Set()){
    if(value===null || typeof value==='string' || typeof value==='boolean') return value;
    if(typeof value==='number'){
      if(!Number.isFinite(value)) throw new Error(`${path} ต้องเป็นตัวเลข finite`);
      return value;
    }
    if(typeof value!=='object') throw new Error(`${path} ต้องเป็น plain data เท่านั้น`);
    if(ancestors.has(value)) throw new Error(`${path} มีวงอ้างอิงซ้ำ`);
    ancestors.add(value);
    try{
      if(Array.isArray(value)){
        const output=[];
        for(let index=0;index<value.length;index++){
          if(!Object.prototype.hasOwnProperty.call(value,index)) throw new Error(`${path}[${index}] เป็น sparse array`);
          output.push(clonePlain(value[index],`${path}[${index}]`,ancestors));
        }
        return output;
      }
      if(Object.prototype.toString.call(value)!=='[object Object]') throw new Error(`${path} ต้องเป็น plain object`);
      if(Object.getOwnPropertySymbols(value).length) throw new Error(`${path} มี symbol key ที่ไม่รองรับ`);
      const descriptors=Object.getOwnPropertyDescriptors(value);
      const output={};
      Object.keys(descriptors).sort().forEach(key=>{
        const descriptor=descriptors[key];
        if(!descriptor.enumerable) throw new Error(`${path}.${key} ต้องเป็น enumerable plain data`);
        if(!Object.prototype.hasOwnProperty.call(descriptor,'value')) throw new Error(`${path}.${key} ต้องไม่เป็น accessor`);
        if(key==='__proto__'||key==='prototype'||key==='constructor') throw new Error(`${path}.${key} เป็น key ที่ไม่รองรับ`);
        output[key]=clonePlain(descriptor.value,`${path}.${key}`,ancestors);
      });
      return output;
    }finally{
      ancestors.delete(value);
    }
  }

  function validateStructuralInput(type,input){
    if(type==='ground'){
      const issues=[];
      Object.entries(GROUND_INPUT_BOUNDS).forEach(([key,[min,max]])=>{
        const value=input?.[key];
        if(typeof value!=='number'||!Number.isFinite(value)) issues.push(`${key} ต้องเป็นตัวเลข finite`);
        else if(value<min||value>max) issues.push(`${key} ต้องอยู่ระหว่าง ${min}–${max}`);
      });
      const cov=input?.cov;
      if(typeof cov!=='number'||!Number.isFinite(cov)||cov<0) issues.push('cov ต้องเป็นตัวเลข finite และไม่น้อยกว่า 0');
      if(!['soil','structural'].includes(input?.sogScope)) issues.push('sogScope ต้องเป็น soil หรือ structural');
      if(!['wm','rb','db'].includes(input?.steelType)) issues.push('steelType ต้องเป็น wm, rb หรือ db');
      if(typeof input?.barDia!=='number'||![6,9,12,16].includes(input.barDia)) issues.push('barDia ต้องเป็น 6, 9, 12 หรือ 16 mm');
      if(!Number.isInteger(input?.meshIdx)||input.meshIdx < -1||input.meshIdx > 6) issues.push('meshIdx ต้องเป็น -1 หรือรายการ 0–6');
      if(issues.length) throw new Error(`ข้อมูลนำเข้าไม่ผ่านด่าน Engine เดิม: ${issues.join(' · ')}`);
      return;
    }
    const guard=STRUCTURAL_INPUT_GUARDS[type];
    if(!guard) throw new Error('ไม่พบด่านข้อมูลนำเข้าของ Engine พื้นชนิดนี้');
    const issues=[];
    const number=(key)=>{
      const value=input?.[key];
      if(typeof value!=='number'||!Number.isFinite(value)){
        issues.push(`${key} ต้องเป็นตัวเลข finite`);
        return null;
      }
      return value;
    };
    guard.positive.forEach(key=>{
      const value=number(key);
      if(value!==null&&value<=0) issues.push(`${key} ต้องมากกว่า 0`);
    });
    guard.nonnegative.forEach(key=>{
      const value=number(key);
      if(value!==null&&value<0) issues.push(`${key} ต้องไม่น้อยกว่า 0`);
    });
    if(guard.cases){
      const cs=number('cs');
      if(cs!==null&&!guard.cases.includes(cs)) issues.push(`cs ต้องเป็น ${guard.cases.join(', ')}`);
    }
    if(type==='cantilever'){
      if(typeof input.mode!=='string'||!guard.modes.includes(input.mode)) issues.push(`mode ต้องเป็น ${guard.modes.join(' หรือ ')}`);
      const thicknessKey=input.mode==='tapered'?'h_root':'tdef';
      const thickness=number(thicknessKey);
      if(thickness!==null&&thickness<=0) issues.push(`${thicknessKey} ต้องมากกว่า 0`);
      if(input.mode==='tapered'){
        const tip=number('h_tip');
        if(tip!==null&&tip<=0) issues.push('h_tip ต้องมากกว่า 0');
      }
    }
    if(type==='twoway'){
      const ratio=Number(input.S)/Number(input.L);
      if(!Number.isFinite(ratio)||ratio<.5||ratio>1) issues.push('อัตราส่วนด้านสั้นต่อด้านยาว S/L ต้องอยู่ระหว่าง 0.5–1.0');
    }
    if(issues.length) throw new Error(`ข้อมูลนำเข้าไม่ผ่านด่าน Engine เดิม: ${issues.join(' · ')}`);
  }

  function projectEngineResult(type,result){
    if(!result || Object.prototype.toString.call(result)!=='[object Object]') throw new Error('Engine เดิมไม่ส่งชุดผลคำนวณกลับมา');
    const output={};
    Object.keys(result).sort().forEach(key=>{
      const value=result[key];
      if(type==='cantilever' && CANTILEVER_TRANSIENT_RESULT_KEYS.includes(key)){
        if(typeof value!=='function') throw new Error(`result.${key} ต้องเป็นฟังก์ชันภายใน Engine`);
        return;
      }
      // V3 publishes s2=NaN as an unused legacy placeholder. It is neither a
      // demand nor a capacity and is intentionally absent from the snapshot;
      // every other non-finite value fails closed below.
      if(type==='ground' && key==='s2' && Number.isNaN(value)) return;
      output[key]=clonePlain(value,`result.${key}`);
    });
    return output;
  }

  function canonicalJson(value){
    return JSON.stringify(clonePlain(value));
  }

  function assertDeepFrozen(value,path='$',seen=new Set()){
    if(value===null || typeof value!=='object') return;
    if(seen.has(value)) return;
    seen.add(value);
    if(!Object.isFrozen(value)) throw new Error(`${path} ต้องเป็น immutable snapshot`);
    if(Array.isArray(value)) value.forEach((item,index)=>assertDeepFrozen(item,`${path}[${index}]`,seen));
    else Object.keys(value).forEach(key=>assertDeepFrozen(value[key],`${path}.${key}`,seen));
  }

  function bytesToHex(buffer){
    return Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('').toUpperCase();
  }

  async function sha256Bytes(bytes){
    if(!global.crypto?.subtle) throw new Error('เบราว์เซอร์นี้ไม่มี SHA-256 สำหรับตรวจ Engine');
    const view=bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    return bytesToHex(await global.crypto.subtle.digest('SHA-256',view));
  }

  async function sha256Text(value){
    return sha256Bytes(new global.TextEncoder().encode(String(value)));
  }

  function dependencyDescriptor(spec,sha256=spec.sha256,bytes=spec.bytes){
    return deepFreeze({algorithm:'SHA-256',bytes:Number(bytes),path:spec.path,sha256:String(sha256)});
  }

  function sourceDescriptor(type,sha256,bytes,dependencies){
    const spec=typeSpec(type);
    const ordered=(dependencies||[]).map(value=>dependencyDescriptor(value,value.sha256,value.bytes));
    return deepFreeze({algorithm:'SHA-256',bytes:Number(bytes),dependencies:ordered,path:spec.path,sha256:String(sha256),type});
  }

  function manifestSourceDescriptor(type){
    const spec=typeSpec(type);
    return sourceDescriptor(type,spec.sha256,spec.bytes,dependencySpecs(type));
  }

  function nextSurfaceOperation(type){
    const token = (surfaceOperations.get(type) || 0) + 1;
    surfaceOperations.set(type, token);
    return token;
  }

  function isCurrentSurfaceOperation(type, token){
    return surfaceOperations.get(type) === token;
  }

  function stopFramePlacement(session){
    if(session.frameResizeObserver){
      session.frameResizeObserver.disconnect();
      session.frameResizeObserver=null;
    }
    if(session.framePlacementHandler){
      global.removeEventListener('resize',session.framePlacementHandler);
      global.removeEventListener('scroll',session.framePlacementHandler,true);
      session.framePlacementHandler=null;
    }
    session.mountContainer=null;
  }

  function placeFrame(session,container){
    stopFramePlacement(session);
    session.mountContainer=container;
    const sync=()=>{
      if(!session.mountContainer?.isConnected) return;
      const rect=session.mountContainer.getBoundingClientRect();
      Object.assign(session.frame.style,{
        position:'fixed',left:`${rect.left}px`,top:`${rect.top}px`,
        width:`${Math.max(1,rect.width)}px`,height:`${Math.max(1,rect.height)}px`,
        zIndex:'40',visibility:'visible',pointerEvents:'auto',background:'#fff'
      });
    };
    let queued=false;
    const schedule=()=>{
      if(queued) return;
      queued=true;
      global.requestAnimationFrame(()=>{queued=false;sync();});
    };
    session.framePlacementHandler=schedule;
    global.addEventListener('resize',schedule);
    global.addEventListener('scroll',schedule,true);
    if(global.ResizeObserver){
      session.frameResizeObserver=new global.ResizeObserver(schedule);
      session.frameResizeObserver.observe(container);
    }
    sync();
  }

  function dependencyPathForScript(type,src){
    const sourceUrl=new URL(typeSpec(type).path,global.location.href);
    const resolved=new URL(src,sourceUrl);
    const localOrigin=new URL(global.location.href).origin;
    const normalized=resolved.origin===localOrigin
      ? resolved.pathname
      : `${resolved.origin}${resolved.pathname}`;
    const path=REMOTE_DEPENDENCY_ALIASES[normalized]||normalized;
    return DEPENDENCY_ORDER[type].includes(path)?path:null;
  }

  function sanitizeSource(source,type,verifiedDependencies){
    const parser = new global.DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    doc.getElementById('sv-member-route-guard')?.remove();
    const verifiedByPath=new Map(verifiedDependencies.map(value=>[value.descriptor.path,value]));
    const inlined=[];
    doc.querySelectorAll('script[src]').forEach(script=>{
      const src = script.getAttribute('src') || '';
      const dependencyPath=dependencyPathForScript(type,src);
      if(dependencyPath){
        const dependency=verifiedByPath.get(dependencyPath);
        if(!dependency) throw new Error(`Dependency ${dependencyPath} ยังไม่ได้ตรวจ exact bytes`);
        const replacement=doc.createElement('script');
        replacement.setAttribute('data-sv-verified-dependency',dependencyPath);
        replacement.textContent=dependency.text;
        script.replaceWith(replacement);
        inlined.push(dependencyPath);
      }else{
        script.remove();
      }
    });
    const expected=DEPENDENCY_ORDER[type];
    if(canonicalJson(inlined)!==canonicalJson(expected)){
      throw new Error(`Dependency order ของ Engine ${typeSpec(type).mark} ไม่ตรง manifest`);
    }
    if(doc.querySelector('script[src]')) throw new Error('runtime srcdoc ยังมี script[src] ที่ไม่ได้ตรวจ exact bytes');
    doc.querySelectorAll('link').forEach(link=>{
      const href = link.getAttribute('href') || '';
      if(/fonts\.googleapis|fonts\.gstatic|preconnect|app-icon/i.test(href)) link.remove();
    });
    const base = doc.createElement('base');
    base.href = new URL(type === 'ground' ? '/slab-on-ground/' : '/slab-studio-source/', global.location.href).href;
    doc.head.prepend(base);
    const storageBridge = doc.createElement('script');
    storageBridge.textContent = 'window.SVConcreteSaveSafety=window.parent.SVConcreteSaveSafety;';
    doc.head.prepend(storageBridge);
    const style = doc.createElement('style');
    style.id = 'sv-runtime-shell';
    style.textContent = `
      html,body{width:100%;height:100%;margin:0!important;overflow:hidden!important;background:#fff!important}
      html[data-sv-runtime-surface] body{overflow:hidden!important}
      html[data-sv-runtime-surface] .sv-runtime-target{position:fixed!important;inset:0!important;z-index:2147483000!important;display:block!important;width:100vw!important;height:100vh!important;min-height:0!important;margin:0!important;border:0!important;border-radius:0!important;background:#fff!important;overflow:hidden!important}
      html[data-sv-runtime-surface] .sv-runtime-target.diagram>svg{display:block!important;width:100%!important;height:100%!important;max-width:none!important}
      html[data-sv-runtime-surface="analysis"] .sv-runtime-target.diag-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;padding:12px!important;box-sizing:border-box!important;overflow:auto!important;background:#f4f8fc!important}
      html[data-sv-runtime-surface="analysis"] .sv-runtime-target.diag-row>.diag-cell{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;min-width:0!important;min-height:0!important;margin:0!important;padding:10px!important;border:1px solid #c7d5e5!important;border-radius:10px!important;background:#fff!important;box-shadow:0 8px 22px rgba(18,47,82,.08)!important;overflow:hidden!important}
      html[data-sv-runtime-surface="analysis"] .sv-runtime-target.diag-row .diagram{min-width:0!important;min-height:0!important;height:100%!important;margin:0!important;padding:0!important}
      html[data-sv-runtime-surface="analysis"] .sv-runtime-target.diag-row svg{display:block!important;width:100%!important;height:100%!important;max-width:none!important;min-height:250px!important}
      html[data-sv-runtime-surface] .sv-runtime-target.viewer3d canvas{display:block!important;width:100%!important;height:100%!important}
      html[data-sv-runtime-surface] .sv-runtime-target .v3d-help,html[data-sv-runtime-surface] .sv-runtime-target .v3d-note{font-family:Sarabun,Arial,sans-serif!important}
    `;
    doc.head.append(style);
    return '<!doctype html>\n' + doc.documentElement.outerHTML;
  }

  function waitForFrame(frame){
    return new Promise((resolve,reject)=>{
      const timeout = global.setTimeout(()=>reject(new Error('Engine เดิมใช้เวลาโหลดนานเกินกำหนด')), 15000);
      frame.addEventListener('load', ()=>{
        global.clearTimeout(timeout);
        const win = frame.contentWindow;
        if(!win || typeof win.compute !== 'function'){
          reject(new Error('ไฟล์เดิมไม่มีฟังก์ชัน compute ที่เรียกใช้ได้'));
          return;
        }
        resolve(win);
      }, {once:true});
    });
  }

  async function fetchVerifiedAsset(spec,label){
    const response = await global.fetch(spec.path, {cache:'no-store'});
    if(!response.ok) throw new Error(`โหลด ${label} ไม่สำเร็จ (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const actualHash = await sha256Bytes(bytes);
    if(actualHash!==spec.sha256 || bytes.byteLength!==spec.bytes){
      throw new Error(`${label} เปลี่ยน served bytes · SHA-256/ขนาดไม่ตรง manifest จึงหยุดคำนวณ`);
    }
    return {
      descriptor:dependencyDescriptor(spec,actualHash,bytes.byteLength),
      text:new global.TextDecoder('utf-8').decode(bytes)
    };
  }

  async function loadVerifiedSourceBundle(type){
    const spec=typeSpec(type);
    const source=await fetchVerifiedAsset(spec,`Engine ${spec.mark}`);
    const dependencies=[];
    for(const dependencySpec of dependencySpecs(type)){
      dependencies.push(await fetchVerifiedAsset(dependencySpec,`Dependency ${dependencySpec.path}`));
    }
    // Source bytes are verified above. This allowlisted adapter changes only
    // persistence acknowledgements, never numerical/diagram/report computation.
    const adaptedSource = type === 'ground'
      ? (await import('/concrete-storage-source-adapter.mjs')).adaptGroundStorageSafety(source.text)
      : source.text;
    return {
      dependencies,
      descriptor:sourceDescriptor(type,source.descriptor.sha256,source.descriptor.bytes,dependencies.map(value=>value.descriptor)),
      source:adaptedSource
    };
  }

  async function createSession(type){
    const bundle=await loadVerifiedSourceBundle(type);
    const frame = document.createElement('iframe');
    frame.className = 'slab-original-runtime-frame';
    frame.title = `ตัววาดและ Engine เดิมของ ${type}`;
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.setAttribute('aria-label', 'มุมมองจาก Engine พื้นเดิม');
    Object.assign(frame.style, {
      position:'fixed', left:'-12000px', top:'0', width:'980px', height:'620px',
      border:'0', visibility:'hidden', pointerEvents:'none', background:'#fff'
    });
    document.body.append(frame);
    try{
      const ready = waitForFrame(frame);
      frame.srcdoc = sanitizeSource(bundle.source,type,bundle.dependencies);
      const win = await ready;
      return {type,frame,win,source:bundle.descriptor};
    }catch(error){
      frame.remove();
      throw error;
    }
  }

  async function getSession(type){
    if(!sessions.has(type)) sessions.set(type, createSession(type));
    return sessions.get(type);
  }

  function copyIntoFrame(win,value){
    const frameJson=win.JSON || JSON;
    return frameJson.parse(canonicalJson(value));
  }

  function spacingDown(win,value){
    if(typeof win.rdown === 'function') return win.rdown(value,2);
    return Math.floor((Number(value)+1e-9)*100)/100;
  }

  function initializeSpacing(session,input,firstResult,override){
    const {win,type} = session;
    const pick=(key,auto)=>{
      const value=override && Number(override[key]);
      return Number.isFinite(value) && value > 0 ? value : auto;
    };
    win.chosen = {};
    if(type === 'cantilever'){
      win.chosen[0] = pick(0, spacingDown(win, firstResult.SmaxMain));
      win.chosenTemp = pick('temp', spacingDown(win, firstResult.SmaxTemp));
    }else{
      (firstResult.sections || []).forEach((section,index)=>{
        win.chosen[index] = pick(index, spacingDown(win, section.Smax));
      });
      win.chosenTemp = type==='twoway' ? null : pick('temp', spacingDown(win, firstResult.tempS));
    }
    return {
      barLabel:(Number(type === 'twoway' ? input.fy : input.fy1) < 3000 ? 'RB' : 'DB'),
      tempLabel:(Number(type === 'twoway' ? input.fy : input.fy2) < 3000 ? 'RB' : 'DB')
    };
  }

  function groundLedger(I,R){
    return [
      {id:'scope',name:'ขอบเขตพื้นรองรับด้วยดิน',sub:'soil-supported / structural',dem:R.scopeOk?0:1,cap:0,unit:'',ratio:R.scopeOk?0:2,ok:R.scopeOk},
      {id:'reinf',name:'เหล็กผ่าน legacy drag screen',sub:'As·screen / As·provided',dem:R.AsDesign,cap:R.reinf.As,unit:'cm²/m',ratio:R.AsDesign/R.reinf.As,ok:R.reinfOk},
      {id:'ratio',name:'อัตราส่วนเหล็ก jointed slab',sub:'ρ / 0.10%',dem:R.rho*100,cap:0.1,unit:'%',ratio:R.rho/0.001,ok:R.strategyOk},
      {id:'spacing',name:'ระยะเรียงเหล็ก',sub:'s·used / project cap',dem:R.spUsed,cap:R.Smax,unit:'m',ratio:R.spUsed/R.Smax,ok:R.spOk},
      {id:'joint',name:'ระยะรอยต่อ Lj',sub:'Lj / min(36t, 5.5m)',dem:I.Lj,cap:R.joint.hi,unit:'m',ratio:I.Lj/R.joint.hi,ok:R.jointOk}
    ];
  }

  function structuralLedger(type,R,chosen,chosenTemp){
    const rows=[];
    const push=(id,name,dem,cap,unit,ok)=>rows.push({
      id,name,dem:Number(dem),cap:Number(cap),unit,
      ratio:Number(cap)>0?Number(dem)/Number(cap):null,ok:Boolean(ok)
    });
    const expectedSectionCount=type==='oneway'?3:type==='twoway'?6:null;
    if(expectedSectionCount!==null){
      if(!Array.isArray(R.sections)||R.sections.length!==expectedSectionCount){
        throw new Error(`${type} ledger ต้องมี section ครบ ${expectedSectionCount} รายการ`);
      }
      R.sections.forEach((section,index)=>{
        if(!section||Object.prototype.toString.call(section)!=='[object Object]'||typeof section.Smax!=='number'||!Number.isFinite(section.Smax)){
          throw new Error(`${type} ledger section ${index+1} ต้องเป็น plain section และมี Smax finite`);
        }
      });
    }
    if(type==='oneway'){
      push('oneway-type','ตรวจชนิดพื้นทางเดียว',R.m,.5,'m = S/L',R.chkType);
      push('oneway-thickness','ความหนาขั้นต่ำ',R.tmin,R.t,'cm',R.chkThick);
      push('oneway-depth','ความลึกประสิทธิผล',R.dreq,R.d,'cm',R.chkDepth);
      push('oneway-shear','แรงเฉือนทางเดียว',R.Vu,R.phiVc,'kgf/m',R.chkShear);
    }else if(type==='cantilever'){
      if(R.mode==='tapered') push('cantilever-thickness','การแอ่นตัวควบคุมหน้าตัดเรียว',R.delta_tip,R.delta_limit,'cm',R.chkThick);
      else push('cantilever-thickness','ความหนาขั้นต่ำ',R.tmin,R.t,'cm',R.chkThick);
      push('cantilever-depth','ความลึกประสิทธิผล',R.dreq,R.d||R.d_root,'cm',R.chkDepth);
      push('cantilever-shear','แรงเฉือนทางเดียว',R.Vu||R.Vu0,R.phiVc,'kgf/m',R.chkShear);
      const deflectionFields=['delta_tip','delta_limit','delta_long','delta_long_limit'];
      const missingDeflection=deflectionFields.filter(field=>!Number.isFinite(Number(R[field])));
      if(missingDeflection.length) throw new Error(`cantilever deflection evidence ไม่เป็น finite: ${missingDeflection.join(', ')}`);
      if(R.mode!=='tapered') push('cantilever-deflection-immediate','การแอ่นตัวทันที',R.delta_tip,R.delta_limit,'cm',R.chkDefl);
      push('cantilever-deflection-long','การแอ่นตัวระยะยาว',R.delta_long,R.delta_long_limit,'cm',R.chkDeflLong);
    }else if(type==='twoway'){
      push('twoway-type','ตรวจชนิดพื้นสองทาง',.5,R.m,'m = S/L',R.chkType);
      push('twoway-thickness','ความหนาขั้นต่ำ',R.tmin,R.t,'cm',R.chkThick);
      push('twoway-depth','ความลึกประสิทธิผล',R.dreq,Math.min(R.dS,R.dL),'cm',R.chkDepth);
      push('twoway-shear-short','เฉือนทิศสั้น',R.Vu,R.phiVcS,'kgf/m',R.phiVcS>=R.Vu);
      push('twoway-shear-long','เฉือนทิศยาว',R.Vu,R.phiVcL,'kgf/m',R.phiVcL>=R.Vu);
    }else{
      throw new Error('ชนิดพื้นไม่รองรับ ledger');
    }
    if(type==='cantilever'){
      push('cantilever-spacing-main','เหล็กหลัก · เสริมผิวบน',chosen[0],R.SmaxMain,'m',chosen[0]<=R.SmaxMain+1e-9);
    }else{
      R.sections.forEach((section,index)=>push(
        `${type}-spacing-${index}`,section.label||`ระยะเหล็ก ${index+1}`,
        chosen[index],section.Smax,'m',chosen[index]<=section.Smax+1e-9
      ));
    }
    if(type!=='twoway') push(
      `${type}-spacing-temp`,type==='cantilever'?'เหล็กแจกแรง':'เหล็กกันร้าว',
      chosenTemp,type==='cantilever'?R.SmaxTemp:R.tempS,'m',
      chosenTemp<=(type==='cantilever'?R.SmaxTemp:R.tempS)+1e-9
    );
    const invalid=rows.filter(row=>!Number.isFinite(row.dem)||!Number.isFinite(row.cap));
    if(invalid.length) throw new Error(`ledger มี Demand/Capacity ไม่เป็น finite: ${invalid.map(row=>row.id).join(', ')}`);
    return rows;
  }

  function ledgerFor(type,input,result,selection){
    const rows=type==='ground'
      ? groundLedger(input,result)
      : structuralLedger(type,result,selection.chosen,selection.chosenTemp);
    return clonePlain(rows,'ledger');
  }

  function overallFor(ledger){
    if(!Array.isArray(ledger)||!ledger.length) throw new Error('ledger ต้องมีรายการตรวจอย่างน้อยหนึ่งรายการ');
    const passed=ledger.filter(row=>row.ok).length;
    const ok=passed===ledger.length;
    const governing=ledger.reduce((current,row)=>{
      if(!Number.isFinite(row.ratio)) return current;
      return !current || row.ratio>current.ratio ? row : current;
    },null);
    return clonePlain({
      failed:ledger.length-passed,
      governingId:governing?.id||null,
      governingRatio:governing?.ratio??null,
      ok,
      passed,
      status:ok?'PASS':'FAIL',
      total:ledger.length,
      verdict:`${ok?'ผ่าน':'ไม่ผ่าน'} ${passed}/${ledger.length}`
    },'overall');
  }

  function bbsRound(value,places){const q=Math.pow(10,places||0);return Math.round((Number(value)||0)*q)/q;}
  function bbsQty(widthM,spacingM){return Math.max(2,Math.floor(Number(widthM)/Number(spacingM))+1);}
  function bbsMass(diaMm,count,lengthM){return bbsRound(Number(count)*Number(lengthM)*Number(diaMm)*Number(diaMm)/162,2);}
  function bbsRow(mark,member,code,bar,dia,spacingM,count,lengthM,note){
    return {mark,member,code,bar,size:bbsRound(dia),spacing:bbsRound(spacingM*1000),
      n:Math.round(count),Lcut:bbsRound(lengthM,3),totMass:bbsMass(dia,count,lengthM),note};
  }

  function oneWaySchedule(I,R,spacings,tempSpacing){
    const num=(v)=>{const x=Number(v);return Number.isFinite(x)?x:NaN;};
    const issues=[];
    if(!(num(I.S)>0&&num(I.L)>0&&num(I.mainDia)>0&&num(I.tempDia)>0)) issues.push('OW-GEOMETRY');
    const s=(spacings||[]).map(num);
    if(s.length<3||!s.slice(0,3).every(v=>v>0)||!(num(tempSpacing)>0)) issues.push('OW-SPACING');
    if(issues.length) return {version:'sl04-oneway-1',bbs:[],ok:false,issues};
    const mainBar=(num(I.fy1)<3000?'RB':'DB')+num(I.mainDia);
    const tempBar=(num(I.fy2)<3000?'RB':'DB')+num(I.tempDia);
    const cs=Number(I.cs);
    const leftCont=cs>=1, rightCont=cs===2;
    const extLeft=I.S/(leftCont?3:4), extRight=I.S/(rightCont?3:4);
    const bbs=[
      bbsRow('SL-11','เหล็กบน · ปลายซ้าย','CK-DP',mainBar,I.mainDia,s[0],bbsQty(I.L,s[0]),extLeft,
        'Design path S/'+(leftCont?3:4)+' (left end '+(leftCont?'continuous':'discontinuous')+'); confirm support width and development'),
      bbsRow('SL-12','เหล็กล่าง · กลางช่วง','CK-DP',mainBar,I.mainDia,s[1],bbsQty(I.L,s[1]),I.S,
        'Full short-span design path; confirm anchorage at supports'),
      bbsRow('SL-13','เหล็กบน · ปลายขวา','CK-DP',mainBar,I.mainDia,s[2],bbsQty(I.L,s[2]),extRight,
        'Design path S/'+(rightCont?3:4)+' (right end '+(rightCont?'continuous':'discontinuous')+'); confirm support width and development'),
      bbsRow('SL-14','เหล็กกันร้าว/อุณหภูมิ','CK-DP',tempBar,I.tempDia,num(tempSpacing),bbsQty(I.S,num(tempSpacing)),I.L,
        'Panel-length design path; confirm lap and edge tails in shop drawing')
    ];
    const spacingOK=(R.sections||[]).every((section,index)=>
      !Number.isFinite(num(section.Smax))||s[index]===undefined||s[index]<=num(section.Smax)+1e-9);
    return {version:'sl04-oneway-1',bbs,
      ok:!!(R.chkType&&R.chkThick&&R.chkDepth&&R.chkShear&&spacingOK),issues:[]};
  }

  function buildSchedule(session,input,result,selection){
    const {win,type}=session;
    const contract=win.CKSlabResultContract;
    try{
      if(type==='ground'){
        if(!contract||typeof contract.slabOnGround!=='function') return {version:null,bbs:[],ok:false,issues:['NO-CONTRACT']};
        return contract.slabOnGround(input,result);
      }
      if(type==='twoway'){
        if(!contract||typeof contract.twoWay!=='function') return {version:null,bbs:[],ok:false,issues:['NO-CONTRACT']};
        const spacings=(result.sections||[]).map((_section,index)=>selection.chosen[index]);
        return contract.twoWay(input,result,spacings);
      }
      if(type==='cantilever'){
        if(!contract||typeof contract.cantilever!=='function') return {version:null,bbs:[],ok:false,issues:['NO-CONTRACT']};
        return contract.cantilever(input,result,selection.chosen[0],selection.chosenTemp);
      }
      if(type==='oneway'){
        const spacings=(result.sections||[]).map((_section,index)=>selection.chosen[index]);
        return oneWaySchedule(input,result,spacings,selection.chosenTemp);
      }
    }catch(error){
      return {version:null,bbs:[],ok:false,issues:['SCHEDULE-ERROR: '+(error.message||error)]};
    }
    return {version:null,bbs:[],ok:false,issues:['UNSUPPORTED-TYPE']};
  }

  function alignScheduleWithOverall(value,overall){
    const schedule=clonePlain(value,'schedule');
    const contractOk=schedule.ok===true;
    // The source BBS contract checks its own geometry/check subset. In the
    // legacy cantilever contract, uniform-mode deflection is not part of that
    // subset. Preserve that source outcome as contractOk, while the public ok
    // flag can never claim consistency when the authoritative ledger fails.
    return clonePlain({
      ...schedule,
      contractOk,
      ok:contractOk&&overall.ok,
      overallOk:overall.ok
    },'schedule');
  }

  function captureAnalysisProfiles(session,input,result){
    const {type,win}=session;
    if(type==='ground'||typeof win.drawAnalysis!=='function') return null;
    const expected=type==='twoway'?2:1;
    const extractProfile=(svg,mode,index)=>{
      const curve=svg.querySelector('polyline[points]');
      if(!curve) return null;
      const rawPoints=String(curve.getAttribute('points')||'').trim().split(/\s+/).map(pair=>{
        const parts=pair.split(',').map(Number);
        return {x:parts[0],y:parts[1]};
      }).filter(point=>Number.isFinite(point.x)&&Number.isFinite(point.y));
      if(rawPoints.length<3) return null;
      const baseline=[...svg.querySelectorAll('line')].map(line=>({
        x1:Number(line.getAttribute('x1')),x2:Number(line.getAttribute('x2')),
        y1:Number(line.getAttribute('y1')),y2:Number(line.getAttribute('y2'))
      })).filter(line=>Object.values(line).every(Number.isFinite)&&Math.abs(line.y1-line.y2)<.01)
        .sort((a,b)=>Math.abs(b.x2-b.x1)-Math.abs(a.x2-a.x1))[0];
      if(!baseline) return null;
      const minX=Math.min(...rawPoints.map(point=>point.x)),maxX=Math.max(...rawPoints.map(point=>point.x));
      const span=Math.max(maxX-minX,1e-9),baselineY=(baseline.y1+baseline.y2)/2;
      const maxOffset=Math.max(...rawPoints.map(point=>Math.abs(point.y-baselineY)),1e-9);
      const valueSign=mode==='moment'&&type!=='cantilever'?1:-1;
      const points=rawPoints.map(point=>{
        const visualOffset=(point.y-baselineY)/maxOffset;
        return {position:(point.x-minX)/span,visualOffset,normalizedValue:visualOffset*valueSign};
      });
      const labels=[...svg.querySelectorAll('text')].map(text=>{
        const display=String(text.textContent||'').trim();
        const normalized=display.replace(/[−–—]/g,'-').replace(/,/g,'');
        if(!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
        const value=Number(normalized),x=Number(text.getAttribute('x'));
        if(!Number.isFinite(value)||!Number.isFinite(x)) return null;
        return {position:Math.max(0,Math.min(1,(x-minX)/span)),value,display};
      }).filter(Boolean);
      const title=String(svg.querySelector('text')?.textContent||'').trim();
      return {
        axis:type==='twoway'&&index===1?'z':'x',
        direction:type==='twoway'?(index===0?'ด้านสั้น':'ด้านยาว'):'แนวพาด',
        title,unit:mode==='moment'?'kg·m':'kg',points,labels
      };
    };
    try{
      win.drawAnalysis(input,result);
      const collect=(id,mode)=>[...win.document.querySelectorAll(`#${id} svg`)].map((svg,index)=>extractProfile(svg,mode,index));
      const bmd=collect('anaBMD','moment'),sfd=collect('anaSFD','shear');
      if(bmd.length!==expected||sfd.length!==expected||bmd.some(profile=>!profile)||sfd.some(profile=>!profile)) return null;
      return {source:'original-engine-svg',bmd,sfd};
    }catch(_error){
      return null;
    }
  }

  function emptyDocumentIdentity(){
    return Object.fromEntries(DOCUMENT_FIELDS.map(field=>[field,'']));
  }

  function normalizeDocumentIdentity(value,path='options.document'){
    const output=emptyDocumentIdentity();
    if(value===undefined||value===null) return output;
    const raw=clonePlain(value,path);
    Object.keys(raw).forEach(key=>{
      if(!DOCUMENT_FIELDS.includes(key)) throw new Error(`${path}.${key} ไม่รองรับ`);
      if(typeof raw[key]!=='string') throw new Error(`${path}.${key} ต้องเป็นข้อความ`);
      output[key]=raw[key];
    });
    return output;
  }

  function normalizeCalculateOptions(value){
    if(value===undefined||value===null) return {spacingOverride:{},document:emptyDocumentIdentity()};
    const raw=clonePlain(value,'options');
    const isNamed=['spacingOverride','document','projectMark'].some(key=>Object.prototype.hasOwnProperty.call(raw,key));
    if(!isNamed) return {spacingOverride:raw,document:emptyDocumentIdentity()};
    const allowed=new Set(['spacingOverride','document','projectMark']);
    Object.keys(raw).forEach(key=>{if(!allowed.has(key)) throw new Error(`options.${key} ไม่รองรับ`);});
    const spacingOverride=raw.spacingOverride===undefined?{}:clonePlain(raw.spacingOverride,'options.spacingOverride');
    const documentIdentity=normalizeDocumentIdentity(raw.document);
    if(raw.projectMark!==undefined){
      if(typeof raw.projectMark!=='string') throw new Error('options.projectMark ต้องเป็นข้อความ');
      if(documentIdentity.mark && documentIdentity.mark!==raw.projectMark) throw new Error('options.projectMark ไม่ตรง options.document.mark');
      documentIdentity.mark=raw.projectMark;
    }
    return {spacingOverride,document:documentIdentity};
  }

  function snapshotCoreFromPlain(snapshot){
    const core={};
    Object.keys(snapshot).filter(key=>key!=='id'&&key!=='fingerprint').sort().forEach(key=>{core[key]=snapshot[key];});
    return core;
  }

  async function finalizeSnapshot(core){
    const cleanCore=clonePlain(core,'snapshotCore');
    const fingerprint=await sha256Text(canonicalJson(cleanCore));
    const spec=typeSpec(cleanCore.type);
    const id=`${spec.mark}-${fingerprint.slice(0,16)}`;
    return deepFreeze(clonePlain({...cleanCore,fingerprint,id},'snapshot'));
  }

  async function verifySnapshotEnvelope(snapshot){
    if(!snapshot||typeof snapshot!=='object') throw new Error('ต้องส่ง immutable snapshot ให้ mountSurface');
    assertDeepFrozen(snapshot);
    const plain=clonePlain(snapshot,'snapshot');
    if(canonicalJson(Object.keys(plain).sort())!==canonicalJson(SNAPSHOT_TOP_LEVEL_KEYS)) throw new Error('snapshot schema fields ไม่ตรง contract');
    if(plain.schema!==SNAPSHOT_SCHEMA||plain.runtimeVersion!==RUNTIME_VERSION) throw new Error('snapshot schema/runtime version ไม่ตรง');
    const spec=typeSpec(plain.type);
    validateStructuralInput(plain.type,plain.input);
    if(canonicalJson(plain.source)!==canonicalJson(manifestSourceDescriptor(plain.type)))
      throw new Error('snapshot source/type/hash ไม่ตรง Engine manifest');
    if(canonicalJson(Object.keys(plain.document||{}).sort())!==canonicalJson([...DOCUMENT_FIELDS].sort())) throw new Error('snapshot document identity fields ไม่ครบ');
    DOCUMENT_FIELDS.forEach(field=>{
      if(typeof plain.document[field]!=='string') throw new Error(`snapshot document.${field} ต้องเป็นข้อความ`);
    });
    const expectedLedger=ledgerFor(plain.type,plain.input,plain.result,plain.selection);
    if(canonicalJson(expectedLedger)!==canonicalJson(plain.ledger)) throw new Error('snapshot ledger ไม่ตรง input/result/spacing');
    const expectedOverall=overallFor(expectedLedger);
    if(canonicalJson(expectedOverall)!==canonicalJson(plain.overall)) throw new Error('snapshot overall ไม่ตรง authoritative ledger');
    if(plain.schedule?.overallOk!==plain.overall.ok||plain.schedule?.ok!==(plain.schedule?.contractOk===true&&plain.overall.ok))
      throw new Error('snapshot schedule status ไม่ตรง authoritative overall');
    if(typeof plain.evidence?.report?.html!=='string'||plain.evidence.report.format!=='text/html') throw new Error('snapshot report evidence ไม่สมบูรณ์');
    if(await sha256Text(plain.evidence.report.html)!==plain.evidence.report.sha256) throw new Error('snapshot report evidence hash ไม่ตรง');
    const fingerprint=await sha256Text(canonicalJson(snapshotCoreFromPlain(plain)));
    if(fingerprint!==plain.fingerprint) throw new Error('snapshot fingerprint ถูกแก้ไขหรือไม่ตรง payload');
    if(plain.id!==`${spec.mark}-${fingerprint.slice(0,16)}`) throw new Error('snapshot id ไม่ตรง fingerprint');
    return plain;
  }

  async function calculate(type,input,options){
    typeSpec(type);
    const cleanInput=clonePlain(input,'input');
    validateStructuralInput(type,cleanInput);
    const normalizedOptions=normalizeCalculateOptions(options);
    const session=await getSession(type);
    const frameInput=copyIntoFrame(session.win,cleanInput);
    let liveResult;
    let labels={barLabel:'',meshLabel:'',tempLabel:''};
    let selection={chosen:{},chosenTemp:null};

    if(type==='ground'){
      liveResult=session.win.compute(frameInput);
      const firstProjection=projectEngineResult(type,liveResult);
      if(firstProjection.inputValid!==true){
        const reasons=Array.isArray(firstProjection.inputErrors)&&firstProjection.inputErrors.length
          ? firstProjection.inputErrors.join(' · ')
          : 'ข้อมูลนำเข้าพื้นบนดินไม่ผ่าน validation ของ Engine';
        throw new Error(reasons);
      }
      labels.meshLabel=String(firstProjection.reinf?.label||'–');
    }else{
      const firstResult=session.win.compute(frameInput);
      if(!firstResult||typeof firstResult!=='object') throw new Error('Engine เดิมไม่ส่งชุดผลคำนวณกลับมา');
      const spacingLabels=initializeSpacing(session,frameInput,firstResult,normalizedOptions.spacingOverride);
      liveResult=session.win.compute(frameInput);
      labels={...labels,...spacingLabels};
      selection={
        chosen:clonePlain(session.win.chosen||{},'selection.chosen'),
        chosenTemp:type==='twoway'?null:Number(session.win.chosenTemp)
      };
    }

    const result=projectEngineResult(type,liveResult);
    selection=clonePlain(selection,'selection');
    labels=clonePlain(labels,'labels');
    const ledger=ledgerFor(type,cleanInput,result,selection);
    const overall=overallFor(ledger);
    const schedule=alignScheduleWithOverall(buildSchedule(session,frameInput,liveResult,selection),overall);
    if(overall.ok&&schedule.contractOk!==true){
      const issues=Array.isArray(schedule.issues)&&schedule.issues.length?schedule.issues.join(' · '):'BBS contract ไม่ผ่าน';
      throw new Error(`ผลตรวจผ่านแต่ตารางเหล็กจาก Engine ไม่สอดคล้อง จึงหยุดสร้าง Snapshot: ${issues}`);
    }
    let reportHtml='';
    if(typeof session.win.buildReport==='function'){
      reportHtml=type==='ground'
        ? session.win.buildReport(frameInput,liveResult,labels.meshLabel,overall.ok)
        : session.win.buildReport(frameInput,liveResult,labels.barLabel,labels.tempLabel);
    }
    if(typeof reportHtml!=='string') throw new Error('Engine เดิมส่งรายงานที่ไม่ใช่ HTML text');
    const analysis=captureAnalysisProfiles(session,frameInput,liveResult);
    const resultAfterEvidence=projectEngineResult(type,liveResult);
    if(canonicalJson(resultAfterEvidence)!==canonicalJson(result)) throw new Error('Engine renderer แก้ชุดผลคำนวณระหว่างสร้าง evidence');
    const evidence={
      analysis:analysis===null?null:clonePlain(analysis,'evidence.analysis'),
      report:{format:'text/html',html:reportHtml,sha256:await sha256Text(reportHtml)}
    };
    return finalizeSnapshot({
      document:normalizedOptions.document,
      evidence,
      input:cleanInput,
      labels,
      ledger,
      overall,
      result,
      runtimeVersion:RUNTIME_VERSION,
      schedule,
      schema:SNAPSHOT_SCHEMA,
      selection,
      source:session.source,
      type
    });
  }

  function restoreIsolatedTarget(session,reason='restore'){
    if(!session.isolatedTarget) return;
    if(session.targetStyle === null) session.isolatedTarget.removeAttribute('style');
    else session.isolatedTarget.setAttribute('style',session.targetStyle);
    session.isolatedTarget.classList.remove('sv-runtime-target');
    session.win.document.documentElement.removeAttribute('data-sv-runtime-surface');
    session.frame.dataset.isolation=`restored:${reason}`;
    session.isolatedTarget = null;
    session.targetStyle = null;
  }

  function targetFor(session,surface){
    if(surface === 'three') return session.win.document.getElementById('v3d');
    if(surface === 'section') return session.win.document.getElementById('diagSec');
    if(surface === 'analysis'){
      const bmd = session.win.document.getElementById('anaBMD');
      return bmd && (bmd.closest('.diag-row') || bmd);
    }
    if(surface === 'plan') return session.win.document.getElementById(session.type === 'cantilever' || session.type === 'ground' ? 'diagTop' : 'diagBot');
    return null;
  }

  function prepareDrawingPayload(session,snapshot){
    const {win,type}=session;
    const input=copyIntoFrame(win,snapshot.input);
    win.chosen=copyIntoFrame(win,snapshot.selection.chosen);
    win.chosenTemp=snapshot.selection.chosenTemp;
    const rehydrated=win.compute(input);
    const rehydratedPlain=projectEngineResult(type,rehydrated);
    if(canonicalJson(rehydratedPlain)!==canonicalJson(snapshot.result)) throw new Error('Engine ปัจจุบันคำนวณไม่ตรง immutable snapshot จึงไม่วาด');
    const result=copyIntoFrame(win,snapshot.result);
    if(type==='cantilever'){
      CANTILEVER_TRANSIENT_RESULT_KEYS.forEach(key=>{
        if(typeof rehydrated[key]!=='function') throw new Error(`Engine ไม่มี ${key} สำหรับวาดพื้นยื่น`);
        result[key]=rehydrated[key];
      });
    }
    if(type==='ground' && Number.isNaN(rehydrated.s2)) result.s2=rehydrated.s2;
    return {input,result,labels:copyIntoFrame(win,snapshot.labels)};
  }

  function drawSurface(session,surface,payload){
    const {win,type}=session;
    const {input,result,labels}=payload;
    if(type === 'ground'){
      if(surface === 'three'){
        if(typeof win.draw3D !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาด 3D');
        win.draw3D(input,result,labels.meshLabel);
      }else if(surface === 'plan'){
        if(typeof win.drawPlan !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาดแปลน');
        win.drawPlan(input,result,labels.meshLabel);
      }else if(surface === 'section'){
        if(typeof win.drawSection !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาดรูปตัด');
        win.drawSection(input,result,labels.meshLabel);
      }else{
        throw new Error('ไฟล์พื้นบนดินไม่มีมุมมองที่เลือก');
      }
      return;
    }
    if(surface === 'three'){
      if(typeof win.draw3D !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาด 3D');
      win.draw3D(input,result);
    }else if(surface === 'analysis'){
      if(typeof win.drawAnalysis !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาดกราฟวิเคราะห์');
      win.drawAnalysis(input,result);
    }else{
      if(typeof win.drawDiagram !== 'function') throw new Error('ไฟล์เดิมไม่มีตัววาดแปลน/รูปตัด');
      win.drawDiagram(input,result,labels.barLabel,labels.tempLabel);
      if(surface === 'section' && typeof win.drawSection === 'function') win.drawSection(input,result,labels.barLabel,labels.tempLabel);
    }
  }

  async function mountSurface(snapshot,surface,container){
    // Reserve the operation token before asynchronous fingerprint/report-hash
    // verification. Otherwise an older, larger snapshot can finish verify
    // after a newer click and incorrectly become the visible surface.
    const requestedType=snapshot&&typeof snapshot==='object'&&typeof snapshot.type==='string'&&SOURCE_SPECS[snapshot.type]
      ? snapshot.type
      : null;
    const operation=requestedType?nextSurfaceOperation(requestedType):null;
    const verified=await verifySnapshotEnvelope(snapshot);
    const type=verified.type;
    if(requestedType!==type||!isCurrentSurfaceOperation(type,operation)) return null;
    const session=await getSession(type);
    if(!isCurrentSurfaceOperation(type,operation)) return null;
    if(canonicalJson(session.source)!==canonicalJson(verified.source)) throw new Error('snapshot source ไม่ตรง served Engine session');
    restoreIsolatedTarget(session,`mount:${surface}:start`);
    const drawingPayload=prepareDrawingPayload(session,verified);
    drawSurface(session,surface,drawingPayload);
    const doc=session.win.document;
    const target=targetFor(session,surface);
    if(!target) throw new Error('ไม่พบพื้นที่วาดของ Engine เดิม');
    session.targetStyle=target.getAttribute('style');
    session.isolatedTarget=target;
    target.classList.add('sv-runtime-target');
    doc.documentElement.setAttribute('data-sv-runtime-surface',surface);
    container.replaceChildren();
    placeFrame(session,container);
    session.frame.dataset.surface=surface;
    session.frame.dataset.surfaceMode='fixed-target';
    session.frame.dataset.isolation='isolated';
    session.frame.dataset.snapshotId=verified.id;
    session.frame.dataset.snapshotFingerprint=verified.fingerprint;
    session.frame.dataset.targetAfterDraw=target.className;
    return session.frame;
  }

  async function hide(type){
    if(!sessions.has(type)) return;
    const operation=nextSurfaceOperation(type);
    const session=await getSession(type);
    if(!isCurrentSurfaceOperation(type,operation)) return;
    restoreIsolatedTarget(session,'hide');
    stopFramePlacement(session);
    Object.assign(session.frame.style,{position:'fixed',left:'-12000px',top:'0',width:'980px',height:'620px',zIndex:'-1',visibility:'hidden',pointerEvents:'none'});
    if(session.frame.parentNode!==document.body) document.body.append(session.frame);
  }

  async function hideAll(){
    await Promise.all(Array.from(sessions.keys(),type=>hide(type)));
  }

  const publicApi={calculate,mountSurface,hide,hideAll,sourceFiles:SOURCE_FILES,snapshotSchema:SNAPSHOT_SCHEMA};
  if(global.__SV_SLAB_RUNTIME_TEST__===true){
    publicApi.__testContract=Object.freeze({
      canonicalJson,
      freezePlain:value=>deepFreeze(clonePlain(value)),
      installSession(type,win,frame={}){
        const spec=typeSpec(type);
        sessions.set(type,Promise.resolve({
          type,win,frame,
          source:manifestSourceDescriptor(type)
        }));
      },
      clearSessions(){sessions.clear();surfaceOperations.clear();},
      ledgerFor,
      dependencyOrder:DEPENDENCY_ORDER,
      dependencySpecs:DEPENDENCY_SPECS,
      loadVerifiedSourceBundle,
      overallFor,
      sourceSpecs:SOURCE_SPECS,
      verifySnapshot:verifySnapshotEnvelope
    });
  }
  global.SlabOriginalRuntime=Object.freeze(publicApi);
})(window);
