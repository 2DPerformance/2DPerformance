import * as THREE from '../../vendor/three/three.module.js';
import { OrbitControls } from '../../vendor/three/addons/controls/OrbitControls.js';
import { FRAME_CATALOG, createScaffoldLayout } from './scaffold-layout.js';
import { createFrameProfile } from './frame-profile.js';
import { ACCESSORY_VISUALS, createBayInspection, createFrameBraceHardware } from './assembly-accessories.js';

const FRAME_PROFILE = createFrameProfile(FRAME_CATALOG);

const WHEEL_LINE_PIXELS = 16;
const WHEEL_EVENT_LIMIT = 240;
// Match the native OrbitControls wheel sensitivity (~5% per 100 px at DPR 1)
// while spreading the distance change over demand-driven frames.
const WHEEL_ZOOM_RATE = 0.0005;
const WHEEL_ZOOM_TIME_CONSTANT_MS = 92;

export function normalizeWheelDelta(deltaY, deltaMode = 0, viewportHeight = 800) {
  if (!Number.isFinite(deltaY) || deltaY === 0) return 0;
  const unit = deltaMode === 1
    ? WHEEL_LINE_PIXELS
    : deltaMode === 2 ? Math.max(1, Number(viewportHeight) || 800) : 1;
  return THREE.MathUtils.clamp(deltaY * unit, -WHEEL_EVENT_LIMIT, WHEEL_EVENT_LIMIT);
}

export function nextWheelZoomTarget(currentDistance, previousTarget, wheelDelta, minDistance, maxDistance) {
  const minimum = Math.max(0, Number(minDistance) || 0);
  const maximum = Math.max(minimum, Number(maxDistance) || minimum);
  const current = THREE.MathUtils.clamp(Number(currentDistance) || minimum, minimum, maximum);
  const base = Number.isFinite(previousTarget)
    ? THREE.MathUtils.clamp(previousTarget, minimum, maximum)
    : current;
  if (!Number.isFinite(wheelDelta) || wheelDelta === 0) return base;
  return THREE.MathUtils.clamp(base * Math.exp(wheelDelta * WHEEL_ZOOM_RATE), minimum, maximum);
}

export function advanceWheelZoom(currentDistance, targetDistance, elapsedMs = 16, reducedMotion = false) {
  const current = Number(currentDistance);
  const target = Number(targetDistance);
  if (!Number.isFinite(current) || !Number.isFinite(target)) return { distance: current, settled: true };
  const tolerance = Math.max(0.0015, Math.abs(target) * 0.00015);
  if (reducedMotion || Math.abs(target - current) <= tolerance) return { distance: target, settled: true };
  const duration = THREE.MathUtils.clamp(Number(elapsedMs) || 16, 1, 50);
  const blend = 1 - Math.exp(-duration / WHEEL_ZOOM_TIME_CONSTANT_MS);
  const distance = current + (target - current) * blend;
  if (Math.abs(target - distance) <= tolerance) return { distance: target, settled: true };
  return { distance, settled: false };
}

// Stage 0 nominal catalogue geometry only. The separate layout module owns
// validation and fixed module placement; this renderer creates no capacity result.
export function createScaffoldScene(host, { onSelect = () => {}, onReady = () => {}, onLayout = () => {} } = {}) {
  if (!host) throw new Error('The illustrative model needs a host element.');
  let dimensions = { width: 8, length: 6, height: 3.5, joistSpacing: 0.5, layers: 1 };
  let layout = createScaffoldLayout(dimensions);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch {
    const fallback = document.createElement('p');
    fallback.className = 'scene-fallback';
    fallback.textContent = 'อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ คุณยังดูและทดลองจัดหน้า UI ได้ (ไม่มีการคำนวณใน Mockup นี้)';
    host.append(fallback);
    onLayout(layout);
    onReady({ webgl: false });
    return {
      setView() {}, setLayer() {},
      setInspection(next) {
        const mode = next === true ? 'frame' : next === false ? 'assembly' : next;
        if (!['assembly', 'frame', 'bay'].includes(mode)) return false;
        if (mode !== 'assembly') return false;
        host.dataset.inspection = mode;
        return true;
      },
      focus() {}, resetCamera() {}, zoomByStep() { return false; },
      setDimensions(next = {}) {
        const proposed = { ...dimensions, ...next };
        try { layout = createScaffoldLayout(proposed); } catch { return false; }
        dimensions = proposed;
        onLayout(layout);
        return true;
      },
      dispose() { fallback.remove(); }
    };
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe9eef1);
  const perspective = new THREE.PerspectiveCamera(34, 1, 0.05, 250);
  const plan = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.05, 250);
  let camera = perspective;
  let view = '3d';
  let layer = 'all';
  let selected = '';
  let inspection = 'assembly';
  let inspectionFrame = layout.frames[0];
  let inspectionBay = createBayInspection(layout);
  let disposed = false;
  let frameRequest = 0;
  let zoomFrameRequest = 0;
  let zoomTargetDistance = null;
  let zoomFrameTime = 0;
  let specimen = new THREE.Group();
  let highlight = null;
  let focusBounds = {};
  const textures = [];
  const materials = [];
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const unitTube = new THREE.CylinderGeometry(1, 1, 1, 12, 1);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pickable = [];
  const labels = { joist: 'คานซอยตัวอย่าง', bearer: 'คานหลักตัวอย่าง', form: 'พื้นและแบบหล่อตัวอย่าง', support: 'ฐานรองรับตัวอย่าง', frame: 'เฟรมนั่งร้านตัวอย่าง' };
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute('aria-label', 'โมเดลนั่งร้านประกอบหน้า UI ตัวอย่าง ลากเพื่อหมุน ใช้ล้อเมาส์เพื่อซูม ไม่ใช่แบบก่อสร้าง');
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  host.append(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  // No animation loop or auto-rotation. Pointer changes request one frame.
  controls.enableDamping = false;
  controls.minDistance = 2.5;
  controls.maxDistance = 70;
  controls.maxPolarAngle = Math.PI * 0.485;
  controls.screenSpacePanning = true;
  controls.addEventListener('change', requestRender);

  function grainTexture(wood = false) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d');
    const pixels = context.createImageData(128, 128);
    let seed = 581;
    for (let y = 0; y < 128; y += 1) {
      for (let x = 0; x < 128; x += 1) {
        seed = (seed * 16807) % 2147483647;
        const noise = seed / 2147483647;
        const grain = wood ? Math.sin(y * 0.9 + Math.sin(x * 0.05) * 1.5) * 9 : 0;
        const base = 220 + noise * 27 + grain;
        const offset = (y * 128 + x) * 4;
        pixels.data[offset] = base;
        pixels.data[offset + 1] = base;
        pixels.data[offset + 2] = base;
        pixels.data[offset + 3] = 255;
      }
    }
    context.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(wood ? 3 : 7, wood ? 1 : 7);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    return texture;
  }
  function material(color, roughness, metalness, map = null) {
    const result = new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
    materials.push(result);
    return result;
  }
  const blue = material(0x2163af, 0.36, 0.55);
  const steel = material(0x647988, 0.33, 0.73);
  const zinc = material(0xb8c5cc, 0.31, 0.78);
  const dark = material(0x233b4b, 0.68, 0.3);
  const wood = material(0xd1ad79, 0.83, 0, grainTexture(true));
  const concrete = material(0xc6c9c8, 0.94, 0, grainTexture());
  const floorMaterial = material(0xe4e9e9, 0.94, 0);
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x728897, transparent: true, opacity: 0.6 });
  const selectedMaterial = new THREE.LineBasicMaterial({ color: 0x7844d4, depthTest: false });
  const ghostMaterial = new THREE.LineDashedMaterial({ color: 0xb46a0b, dashSize: 0.14, gapSize: 0.09, transparent: true, opacity: 0.92, depthTest: false });
  const heightMaterial = new THREE.LineBasicMaterial({ color: 0xb46a0b, depthTest: false });
  materials.push(outlineMaterial, selectedMaterial, ghostMaterial, heightMaterial);

  scene.add(new THREE.HemisphereLight(0xf5f8fc, 0x8e9baf, 2.4));
  const key = new THREE.DirectionalLight(0xfff7eb, 3.2);
  key.position.set(-7, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0002;
  key.shadow.camera.left = key.shadow.camera.bottom = -19;
  key.shadow.camera.right = key.shadow.camera.top = 19;
  key.shadow.camera.near = 0.2;
  key.shadow.camera.far = 60;
  key.shadow.radius = 3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcfe5ff, 1.3);
  fill.position.set(8, 5, -8);
  scene.add(fill);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), floorMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.0005;
  ground.receiveShadow = true;
  scene.add(ground);
  scene.add(specimen);

  function requestRender() {
    if (disposed || frameRequest) return;
    frameRequest = requestAnimationFrame(() => {
      frameRequest = 0;
      if (!disposed) renderer.render(scene, camera);
    });
  }

  function cancelSmoothWheelZoom() {
    if (zoomFrameRequest) cancelAnimationFrame(zoomFrameRequest);
    zoomFrameRequest = 0;
    zoomTargetDistance = null;
    zoomFrameTime = 0;
  }

  function applyPerspectiveDistance(distance) {
    const bounded = THREE.MathUtils.clamp(distance, controls.minDistance, controls.maxDistance);
    const offset = perspective.position.clone().sub(controls.target);
    if (offset.lengthSq() < 1e-10) offset.set(0, 0, 1);
    offset.setLength(bounded);
    perspective.position.copy(controls.target).add(offset);
    perspective.lookAt(controls.target);
    perspective.updateMatrixWorld();
  }

  function animateSmoothWheelZoom(timestamp) {
    zoomFrameRequest = 0;
    if (disposed || view !== '3d' || camera !== perspective || !Number.isFinite(zoomTargetDistance)) {
      cancelSmoothWheelZoom();
      return;
    }
    const elapsed = zoomFrameTime ? timestamp - zoomFrameTime : 16;
    zoomFrameTime = timestamp;
    const step = advanceWheelZoom(controls.getDistance(), zoomTargetDistance, elapsed);
    applyPerspectiveDistance(step.distance);
    renderer.render(scene, camera);
    if (!step.settled) zoomFrameRequest = requestAnimationFrame(animateSmoothWheelZoom);
    else {
      zoomTargetDistance = null;
      zoomFrameTime = 0;
    }
  }

  function queueSmoothPerspectiveZoom(wheelDelta) {
    if (disposed || view !== '3d' || camera !== perspective || !controls.enabled || !controls.enableZoom || !wheelDelta) return false;
    const nextTarget = nextWheelZoomTarget(controls.getDistance(), zoomTargetDistance, wheelDelta,
      controls.minDistance, controls.maxDistance);
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      cancelSmoothWheelZoom();
      const step = advanceWheelZoom(controls.getDistance(), nextTarget, 16, true);
      applyPerspectiveDistance(step.distance);
      requestRender();
      return true;
    }
    zoomTargetDistance = nextTarget;
    if (!zoomFrameRequest) {
      zoomFrameTime = 0;
      zoomFrameRequest = requestAnimationFrame(animateSmoothWheelZoom);
    }
    return true;
  }

  function handleSmoothWheelZoom(event) {
    // Keep the browser's accessible page-zoom gesture. Stopping propagation
    // prevents OrbitControls from calling preventDefault for Ctrl/Meta+wheel.
    if (event.ctrlKey || event.metaKey) {
      event.stopImmediatePropagation();
      return;
    }
    const wheelDelta = normalizeWheelDelta(event.deltaY, event.deltaMode, host.clientHeight);
    if (!queueSmoothPerspectiveZoom(wheelDelta)) return;
    // Capture before OrbitControls consumes its wheel scale. Other views and
    // non-wheel interaction keep the library's existing mouse/touch behavior.
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function releaseSpecimen() {
    specimen.traverse(object => {
      if (object.isInstancedMesh) object.dispose();
      if (object.userData.ownedGeometry) object.geometry.dispose();
      if (object.userData.ownedMaterial) { object.material.map?.dispose(); object.material.dispose(); }
    });
    scene.remove(specimen);
    specimen = new THREE.Group();
    scene.add(specimen);
    pickable.length = 0;
  }

  function buildSpecimen() {
    releaseSpecimen();
    const { width: w, length: l, nominalSlabTop: h, requestedSlabTop, joistSpacing, lanes, stations, frames, footPositions, brace } = layout;
    const batches = new Map();
    function add(kind, surface, part, subgroup, x, y, z, sx, sy, sz, quaternion = null, metadata = null) {
      const id = `${kind}-${surface.uuid}-${part}-${subgroup}`;
      if (!batches.has(id)) batches.set(id, { geometry: kind === 'tube' ? unitTube : unitBox, surface, part, subgroup, transforms: [], records: [] });
      position.set(x, y, z);
      scale.set(sx, sy, sz);
      rotation.copy(quaternion || new THREE.Quaternion());
      matrix.compose(position, rotation, scale);
      batches.get(id).transforms.push(matrix.clone());
      batches.get(id).records.push(metadata);
    }
    function box(surface, part, subgroup, x, y, z, sx, sy, sz, metadata = null) { add('box', surface, part, subgroup, x, y, z, sx, sy, sz, null, metadata); }
    function tube(surface, part, a, b, radius = FRAME_CATALOG.schematicTubeOD / 2, metadata = null, subgroup = 'frame') {
      const from = new THREE.Vector3(...a);
      const to = new THREE.Vector3(...b);
      const direction = to.clone().sub(from);
      const mid = from.add(to).multiplyScalar(0.5);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.clone().normalize());
      add('tube', surface, part, subgroup, mid.x, mid.y, mid.z, radius, direction.length(), radius, quaternion, metadata);
    }
    inspectionFrame = frames[0];
    inspectionBay = createBayInspection(layout);
    function drawFrameProfile(frame, subgroup = 'frame') {
      const centerX = (frame.x1 + frame.x2) / 2;
      const transform = point => [
        point[0] === -FRAME_PROFILE.nominalWidth / 2 ? frame.x1 : point[0] === FRAME_PROFILE.nominalWidth / 2 ? frame.x2 : centerX + point[0],
        point[1] === FRAME_PROFILE.nominalHeight ? frame.top : frame.bottom + point[1],
        frame.z + point[2],
      ];
      for (const component of FRAME_PROFILE.components) {
        const metadata = { frameId: frame.id, layer: frame.layer + 1, moduleId: FRAME_CATALOG.id,
          nominalWidth: FRAME_CATALOG.width, nominalHeight: FRAME_CATALOG.height,
          profileComponent: component.id, profileRole: component.role };
        // Bounded 16-chord quarter-circle returns share the exact pure profile
        // between assembly and inspection; no separate hand-drawn inspection.
        for (let index = 1; index < component.points.length; index += 1) {
          tube(blue, 'frame', transform(component.points[index - 1]), transform(component.points[index]), component.radius, metadata, subgroup);
        }
      }
    }
    function drawBraceHardware(hardware, subgroup = 'frame', sharedMetadata = {}) {
      for (const pin of hardware.pins) {
        const metadata = { ...sharedMetadata, component: 'connector-pin', frameId: pin.frameId,
          layer: pin.layer + 1, moduleId: FRAME_CATALOG.id, profileComponent: 'connector-pin' };
        tube(zinc, 'frame', pin.from, pin.to, ACCESSORY_VISUALS.pinRadius, metadata, subgroup);
      }
      for (const lock of hardware.locks) {
        const metadata = { ...sharedMetadata, component: 'connector-lock', frameId: lock.frameId,
          layer: lock.layer + 1, moduleId: FRAME_CATALOG.id, profileComponent: 'schematic-lock-collar' };
        tube(zinc, 'frame', lock.from, lock.to, ACCESSORY_VISUALS.lockRadius, metadata, subgroup);
      }
    }
    const frameTop = layout.baseOffset + layout.frameStackHeight;
    const headTop = frameTop + layout.headOffset;
    for (const { x, z } of footPositions) {
      const soleMetadata = { component: 'sole-board' };
      const plateMetadata = { component: 'base-plate' };
      const baseJackMetadata = { component: 'base-jack' };
      const headMetadata = { component: 'u-head' };
      // Small schematic bases stay visually independent across adjacent lanes;
      // these dimensions are not an approved bearing-pad specification.
      box(wood, 'support', 'frame', x, 0.027, z, 0.125, 0.054, 0.21, soleMetadata);
      box(zinc, 'support', 'frame', x, 0.064, z, 0.115, 0.02, 0.14, plateMetadata);
      tube(zinc, 'support', [x, 0.073, z], [x, layout.baseOffset + 0.07, z], 0.016, baseJackMetadata);
      tube(zinc, 'frame', [x, frameTop - 0.07, z], [x, headTop, z], 0.016, headMetadata);
      for (let ring = 0; ring < 4; ring += 1) {
        tube(zinc, 'support', [x, 0.095 + ring * 0.022, z], [x, 0.104 + ring * 0.022, z], 0.024, baseJackMetadata);
        tube(zinc, 'frame', [x, frameTop + 0.022 + ring * 0.022, z], [x, frameTop + 0.031 + ring * 0.022, z], 0.024, headMetadata);
      }
      box(zinc, 'frame', 'frame', x, headTop - 0.01, z, 0.14, 0.02, 0.14, headMetadata);
      box(zinc, 'frame', 'frame', x, headTop + 0.035, z - 0.064, 0.14, 0.07, 0.012, headMetadata);
      box(zinc, 'frame', 'frame', x, headTop + 0.035, z + 0.064, 0.14, 0.07, 0.012, headMetadata);
    }
    for (const frame of frames) {
      const { x1, x2, z, bottom } = frame;
      const metadata = { frameId: frame.id, layer: frame.layer + 1, moduleId: FRAME_CATALOG.id, nominalWidth: FRAME_CATALOG.width, nominalHeight: FRAME_CATALOG.height };
      drawFrameProfile(frame);
      drawBraceHardware(createFrameBraceHardware(layout, frame));
      for (const x of [x1, x2]) {
        if (frame.layer > 0) {
          const connectorMetadata = { ...metadata, component: 'stack-connector', joint: frame.layer };
          // Insertion crosses the nominal joint without adding stack height.
          tube(zinc, 'frame', [x, bottom - 0.075, z], [x, bottom + 0.075, z], 0.015, connectorMetadata);
          tube(zinc, 'frame', [x, bottom - 0.015, z], [x, bottom + 0.015, z], 0.026, connectorMetadata);
        }
      }
    }
    drawFrameProfile(inspectionFrame, 'inspection-frame');
    drawBraceHardware(createFrameBraceHardware(layout, inspectionFrame), 'inspection-frame',
      { nominalWidth: FRAME_CATALOG.width, nominalHeight: FRAME_CATALOG.height });
    const bayMetadata = { bayId: inspectionBay.id, component: 'complete-bay', status: inspectionBay.status,
      nominalWidth: FRAME_CATALOG.width, nominalHeight: FRAME_CATALOG.height, bay: inspectionBay.bay };
    for (const frame of inspectionBay.frames) drawFrameProfile(frame, 'inspection-bay');
    drawBraceHardware({ pins: inspectionBay.pins, locks: inspectionBay.locks }, 'inspection-bay', bayMetadata);
    for (const braceBar of inspectionBay.braces) {
      tube(steel, 'frame', braceBar.from, braceBar.to, ACCESSORY_VISUALS.braceRadius,
        { ...bayMetadata, component: 'crossbrace', layer: braceBar.layer + 1, nominalLength: brace.nominalLength,
          pinSeparation: brace.vertical, profileComponent: braceBar.id }, 'inspection-bay');
    }
    for (const connector of inspectionBay.stackConnectors) {
      const connectorMetadata = { ...bayMetadata, component: 'stack-connector', joint: connector.joint,
        layer: connector.joint + 1,
        profileComponent: connector.id };
      tube(zinc, 'frame', [connector.x, connector.y - 0.075, connector.z],
        [connector.x, connector.y + 0.075, connector.z], 0.015, connectorMetadata, 'inspection-bay');
      tube(zinc, 'frame', [connector.x, connector.y - 0.015, connector.z],
        [connector.x, connector.y + 0.015, connector.z], 0.026, connectorMetadata, 'inspection-bay');
    }
    for (const leg of inspectionBay.legs) {
      const accessoryMetadata = { ...bayMetadata, legId: leg.id };
      const sole = ACCESSORY_VISUALS.soleBoard;
      const plate = ACCESSORY_VISUALS.basePlate;
      box(wood, 'support', 'inspection-bay', leg.x, sole.height / 2, leg.z, sole.width, sole.height, sole.length,
        { ...accessoryMetadata, component: 'sole-board' });
      box(zinc, 'support', 'inspection-bay', leg.x, sole.height + plate.height / 2, leg.z,
        plate.width, plate.height, plate.length, { ...accessoryMetadata, component: 'base-plate' });
      tube(zinc, 'support', [leg.x, sole.height + plate.height - 0.001, leg.z],
        [leg.x, leg.bottom + 0.07, leg.z], 0.016, { ...accessoryMetadata, component: 'base-jack' }, 'inspection-bay');
      for (let ring = 0; ring < 4; ring += 1) {
        tube(zinc, 'support', [leg.x, 0.095 + ring * 0.022, leg.z], [leg.x, 0.104 + ring * 0.022, leg.z],
          0.024, { ...accessoryMetadata, component: 'base-jack' }, 'inspection-bay');
      }
      tube(zinc, 'frame', [leg.x, leg.top - 0.07, leg.z], [leg.x, leg.top + layout.headOffset, leg.z],
        0.016, { ...accessoryMetadata, component: 'u-head' }, 'inspection-bay');
      const head = ACCESSORY_VISUALS.uHead;
      box(zinc, 'frame', 'inspection-bay', leg.x, leg.top + layout.headOffset - head.plateHeight / 2, leg.z,
        head.width, head.plateHeight, head.depth, { ...accessoryMetadata, component: 'u-head' });
      box(zinc, 'frame', 'inspection-bay', leg.x, leg.top + layout.headOffset + head.sideHeight / 2 - head.plateHeight,
        leg.z - head.depth / 2, head.width, head.sideHeight, 0.012, { ...accessoryMetadata, component: 'u-head' });
      box(zinc, 'frame', 'inspection-bay', leg.x, leg.top + layout.headOffset + head.sideHeight / 2 - head.plateHeight,
        leg.z + head.depth / 2, head.width, head.sideHeight, 0.012, { ...accessoryMetadata, component: 'u-head' });
    }
    for (const lane of lanes) {
      for (let level = 0; level < layout.layers; level += 1) {
        const bottom = layout.baseOffset + level * FRAME_CATALOG.height;
        for (let index = 0; index < stations.length - 1; index += 1) {
          for (const x of [lane.x1, lane.x2]) {
            const metadata = { component: 'crossbrace', layer: level + 1, nominalLength: brace.nominalLength, pinSeparation: brace.vertical, bay: brace.bay };
            const direction = x === lane.x1 ? -1 : 1;
            const faceX = x + direction * (FRAME_CATALOG.schematicTubeOD / 2 + ACCESSORY_VISUALS.braceRadius +
              ACCESSORY_VISUALS.braceFaceClearance + ACCESSORY_VISUALS.bracePairSeparation / 2);
            tube(steel, 'frame', [faceX - ACCESSORY_VISUALS.bracePairSeparation / 2, bottom + brace.pinLow, stations[index]],
              [faceX - ACCESSORY_VISUALS.bracePairSeparation / 2, bottom + brace.pinHigh, stations[index + 1]], ACCESSORY_VISUALS.braceRadius, metadata);
            tube(steel, 'frame', [faceX + ACCESSORY_VISUALS.bracePairSeparation / 2, bottom + brace.pinHigh, stations[index]],
              [faceX + ACCESSORY_VISUALS.bracePairSeparation / 2, bottom + brace.pinLow, stations[index + 1]], ACCESSORY_VISUALS.braceRadius, metadata);
          }
        }
      }
    }
    for (const z of stations) {
      // Nominal specimen sections match the mockup's read-only material labels.
      box(steel, 'bearer', 'deck', 0, h - 0.26, z, w + 0.34, 0.1, 0.05);
      box(dark, 'bearer', 'deck', -w / 2 - 0.1705, h - 0.26, z, 0.003, 0.08, 0.03);
      box(dark, 'bearer', 'deck', w / 2 + 0.1705, h - 0.26, z, 0.003, 0.08, 0.03);
    }
    const joistCount = Math.max(1, Math.ceil(w / joistSpacing));
    const drawnSpacing = w / joistCount;
    for (let index = 0; index <= joistCount; index += 1) {
      const x = -w / 2 + index * drawnSpacing;
      box(steel, 'joist', 'deck', x, h - 0.1725, 0, 0.038, 0.075, l + 0.4);
      box(dark, 'joist', 'deck', x, h - 0.1725, l / 2 + 0.201, 0.024, 0.061, 0.003);
    }
    box(wood, 'form', 'form', 0, h - 0.1275, 0, w + 0.44, 0.015, l + 0.44);
    box(concrete, 'form', 'slab', 0, h - 0.06, 0, w + 0.4, 0.12, l + 0.4);
    for (const batch of batches.values()) {
      const mesh = new THREE.InstancedMesh(batch.geometry, batch.surface, batch.transforms.length);
      batch.transforms.forEach((transform, index) => mesh.setMatrixAt(index, transform));
      mesh.instanceMatrix.needsUpdate = true;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { part: batch.part, subgroup: batch.subgroup, records: batch.records };
      mesh.computeBoundingSphere();
      specimen.add(mesh);
      pickable.push(mesh);
    }
    const perimeter = [
      new THREE.Vector3(-w / 2, h + 0.013, -l / 2), new THREE.Vector3(w / 2, h + 0.013, -l / 2),
      new THREE.Vector3(w / 2, h + 0.013, l / 2), new THREE.Vector3(-w / 2, h + 0.013, l / 2)
    ];
    const perimeterLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(perimeter), outlineMaterial);
    perimeterLine.userData = { ownedGeometry: true, subgroup: 'slab' };
    specimen.add(perimeterLine);
    function wire(points, surface, subgroup, dashed = false) {
      const geometry = new THREE.BufferGeometry().setFromPoints(points.map(point => new THREE.Vector3(...point)));
      const line = new THREE.LineSegments(geometry, surface);
      if (dashed) line.computeLineDistances();
      line.userData = { ownedGeometry: true, subgroup };
      line.renderOrder = subgroup === 'ghost' ? 9 : 0;
      specimen.add(line);
    }
    function rectangle(y, subgroup, surface, dashed = false) {
      wire([[-w / 2, y, -l / 2], [w / 2, y, -l / 2], [w / 2, y, -l / 2], [w / 2, y, l / 2], [w / 2, y, l / 2], [-w / 2, y, l / 2], [-w / 2, y, l / 2], [-w / 2, y, -l / 2]], surface, subgroup, dashed);
    }
    rectangle(0.008, 'footprint', outlineMaterial);
    rectangle(requestedSlabTop, 'ghost', ghostMaterial, true);
    const measureX = w / 2 + 0.5;
    const measureZ = l / 2 + 0.24;
    wire([[measureX, h, measureZ], [measureX, requestedSlabTop, measureZ], [measureX - 0.13, h, measureZ], [measureX + 0.13, h, measureZ], [measureX - 0.13, requestedSlabTop, measureZ], [measureX + 0.13, requestedSlabTop, measureZ]], heightMaterial, 'ghost');
    const labelCanvas = document.createElement('canvas');
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const labelContext = labelCanvas.getContext('2d');
    labelContext.fillStyle = '#fff3d8';
    labelContext.fillRect(0, 0, 512, 128);
    labelContext.fillStyle = '#75470c';
    labelContext.font = 'bold 35px system-ui';
    labelContext.textAlign = 'center';
    labelContext.fillText(`Δ ${layout.residualGap >= 0 ? '+' : ''}${layout.residualGap.toFixed(3)} m`, 256, 49);
    labelContext.font = '23px system-ui';
    labelContext.fillText('TARGET · HOLD', 256, 95);
    const labelTexture = new THREE.CanvasTexture(labelCanvas);
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture, depthTest: false, transparent: true }));
    label.position.set(measureX + 0.18, (h + requestedSlabTop) / 2, measureZ);
    label.scale.set(1.6, 0.4, 1);
    label.renderOrder = 10;
    label.userData = { ownedMaterial: true, subgroup: 'ghost' };
    specimen.add(label);
    const exampleFrame = frames[frames.length - 1];
    const exampleFoot = footPositions[footPositions.length - 1];
    const lastStation = stations[stations.length - 1];
    const exampleJoistX = -w / 2 + Math.floor(joistCount / 2) * drawnSpacing;
    focusBounds = {
      joist: new THREE.Box3(new THREE.Vector3(exampleJoistX - 0.022, h - 0.215, -l / 2 - 0.25), new THREE.Vector3(exampleJoistX + 0.022, h - 0.13, l / 2 + 0.25)),
      bearer: new THREE.Box3(new THREE.Vector3(-w / 2 - 0.2, h - 0.315, lastStation - 0.03), new THREE.Vector3(w / 2 + 0.2, h - 0.205, lastStation + 0.03)),
      form: new THREE.Box3(new THREE.Vector3(-w / 2 - 0.23, h - 0.14, -l / 2 - 0.23), new THREE.Vector3(w / 2 + 0.23, h + 0.01, l / 2 + 0.23)),
      support: new THREE.Box3(new THREE.Vector3(exampleFoot.x - 0.14, 0, exampleFoot.z - 0.14), new THREE.Vector3(exampleFoot.x + 0.14, layout.baseOffset + 0.07, exampleFoot.z + 0.14)),
      frame: new THREE.Box3(new THREE.Vector3(exampleFrame.x1 - 0.035, exampleFrame.bottom, exampleFrame.z - 0.04), new THREE.Vector3(exampleFrame.x2 + 0.035, exampleFrame.top + 0.025, exampleFrame.z + 0.04))
    };
    host.dataset.frameCount = String(layout.counts.frames);
    host.dataset.layers = String(layout.layers);
    host.dataset.nominalTop = String(layout.nominalSlabTop);
    host.dataset.requestedTop = String(layout.requestedSlabTop);
    host.dataset.residual = String(layout.residualGap);
    host.dataset.layoutStatus = layout.status;
    host.dataset.frameModule = FRAME_CATALOG.id;
    host.dataset.legSegments = String(layout.counts.legSegments);
    host.dataset.inspectionEndFrames = String(inspectionBay.displayCounts.endFrames);
    host.dataset.inspectionBraceAssemblies = String(inspectionBay.displayCounts.braceAssemblies);
    host.dataset.inspectionDiagonalTubes = String(inspectionBay.displayCounts.diagonalTubes);
    host.dataset.inspectionBottomSupports = String(inspectionBay.displayCounts.bottomSupports);
    host.dataset.inspectionTopHeads = String(inspectionBay.displayCounts.topHeads);
    host.dataset.inspectionConnectorPins = String(inspectionBay.displayCounts.connectorPins);
    host.dataset.inspectionLocks = String(inspectionBay.displayCounts.schematicLocks);
    host.dataset.inspectionStackConnectors = String(inspectionBay.displayCounts.stackConnectors);
    host.dataset.inspectionStatus = inspectionBay.status;
    host.dataset.inspection = inspection;
    if (inspection === 'frame') host.dataset.inspectedFrameId = inspectionFrame.id;
    else delete host.dataset.inspectedFrameId;
    if (inspection === 'bay') host.dataset.inspectedBayId = inspectionBay.id;
    else delete host.dataset.inspectedBayId;
    applyLayers();
    updateHighlight();
    onLayout(layout);
  }

  function applyLayers() {
    for (const object of specimen.children) {
      const subgroup = object.userData.subgroup;
      if (inspection !== 'assembly') { object.visible = subgroup === `inspection-${inspection}`; continue; }
      if (subgroup.startsWith('inspection-')) { object.visible = false; continue; }
      object.visible = layer === 'all' || (layer === 'frame' ? subgroup === 'frame' || subgroup === 'deck' : subgroup !== 'frame');
      if (subgroup === 'footprint') object.visible = true;
      if (subgroup === 'ghost') object.visible = view === '3d';
      // In top view, opening the illustrative form deck reveals member layout.
      if (view === '2d' && (subgroup === 'slab' || subgroup === 'form')) object.visible = false;
    }
    requestRender();
  }

  function updateHighlight(bounds = focusBounds[selected]) {
    if (highlight) { scene.remove(highlight); highlight.geometry.dispose(); highlight = null; }
    if (selected && bounds) {
      highlight = new THREE.Box3Helper(bounds, 0x7844d4);
      highlight.material.dispose();
      highlight.material = selectedMaterial;
      highlight.renderOrder = 10;
      scene.add(highlight);
    }
    requestRender();
  }

  function fitCamera() {
    cancelSmoothWheelZoom();
    if (inspection !== 'assembly') {
      const bayZ = inspectionBay.legs.map(leg => leg.z);
      const bounds = inspection === 'bay'
        ? { x1: inspectionBay.frames[0].x1 - 0.17, x2: inspectionBay.frames[0].x2 + 0.17,
            z1: Math.min(...bayZ) - 0.2, z2: Math.max(...bayZ) + 0.2,
            bottom: 0, top: inspectionBay.top + layout.headOffset + ACCESSORY_VISUALS.uHead.sideHeight }
        : { x1: inspectionFrame.x1 - 0.06, x2: inspectionFrame.x2 + 0.06,
            z1: inspectionFrame.z - 0.06, z2: inspectionFrame.z + 0.06,
            bottom: inspectionFrame.bottom - 0.04, top: inspectionFrame.top + 0.04 };
      const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
      // Leave room above the frame for the floating toolbar on a 360 px pane.
      const target = new THREE.Vector3((bounds.x1 + bounds.x2) / 2, (bounds.bottom + bounds.top) / 2 + 0.08,
        (bounds.z1 + bounds.z2) / 2);
      const eyeDirection = (inspection === 'bay' ? new THREE.Vector3(0.72, 0.42, 1.3) : new THREE.Vector3(0.07, 0.055, 1)).normalize();
      const rightDirection = new THREE.Vector3().crossVectors(up, eyeDirection).normalize();
      const cameraUp = new THREE.Vector3().crossVectors(eyeDirection, rightDirection).normalize();
      const tanVertical = Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2);
      let distance = 2.5;
      for (const x of [bounds.x1, bounds.x2]) for (const y of [bounds.bottom, bounds.top]) for (const depthZ of [bounds.z1, bounds.z2]) {
        const corner = new THREE.Vector3(x, y, depthZ).sub(target);
        distance = Math.max(distance, corner.dot(eyeDirection) + Math.abs(corner.dot(rightDirection)) * 1.2 / (tanVertical * aspect),
          corner.dot(eyeDirection) + Math.abs(corner.dot(cameraUp)) * 1.43 / tanVertical);
      }
      perspective.aspect = aspect;
      perspective.position.copy(target).add(eyeDirection.multiplyScalar(distance));
      perspective.lookAt(target);
      perspective.updateProjectionMatrix();
      controls.target.copy(target);
      controls.update();
      requestRender();
      return;
    }
    const { width: w, length: l } = layout;
    const h = Math.max(layout.nominalSlabTop, layout.requestedSlabTop);
    const aspect = Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1);
    const target = new THREE.Vector3(0, h * 0.46, 0);
    perspective.aspect = aspect;
    const eyeDirection = new THREE.Vector3(0.83, 0.61, 1.05).normalize();
    const rightDirection = new THREE.Vector3().crossVectors(up, eyeDirection).normalize();
    const cameraUp = new THREE.Vector3().crossVectors(eyeDirection, rightDirection).normalize();
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(perspective.fov) / 2);
    const tanHorizontal = tanVertical * aspect;
    let distance = 2.5;
    // Fit all eight specimen corners against the actual view basis and FOV.
    // x/z overhangs and the near front corner matter at narrow aspect ratios.
    for (const x of [-w / 2 - 0.24, w / 2 + 1.52]) {
      for (const y of [0, h + 0.2]) {
        for (const z of [-l / 2 - 0.24, l / 2 + 0.64]) {
          const corner = new THREE.Vector3(x, y, z).sub(target);
          const depth = corner.dot(eyeDirection);
          distance = Math.max(distance,
            depth + Math.abs(corner.dot(rightDirection)) * 1.15 / tanHorizontal,
            depth + Math.abs(corner.dot(cameraUp)) * 1.22 / tanVertical);
        }
      }
    }
    controls.maxDistance = Math.max(70, distance * 2);
    perspective.far = Math.max(250, distance * 3);
    perspective.position.copy(target).add(eyeDirection.multiplyScalar(distance));
    perspective.lookAt(target);
    perspective.updateProjectionMatrix();
    const halfHeight = Math.max((l + 1.3) / 2, (w + 1.3) / (2 * aspect)) * 1.12;
    plan.left = -halfHeight * aspect;
    plan.right = halfHeight * aspect;
    plan.top = halfHeight;
    plan.bottom = -halfHeight;
    plan.position.set(0, Math.max(h + 18, 30), 0);
    plan.up.set(0, 0, -1);
    plan.lookAt(0, 0, 0);
    plan.zoom = 1;
    plan.updateProjectionMatrix();
    controls.target.copy(view === '2d' ? new THREE.Vector3(0, 0, 0) : target);
    controls.update();
    requestRender();
  }

  function resize() {
    if (disposed) return;
    renderer.setSize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight), false);
    // This separate mockup refits when its pane changes size, so a desktop
    // orbit cannot leave most of the specimen clipped at a mobile breakpoint.
    fitCamera();
  }
  let pointerDown = null;
  function pointerStart(event) {
    cancelSmoothWheelZoom();
    pointerDown = { x: event.clientX, y: event.clientY };
  }
  function pointerEnd(event) {
    if (!pointerDown || Math.hypot(pointerDown.x - event.clientX, pointerDown.y - event.clientY) > 5) { pointerDown = null; return; }
    pointerDown = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable.filter(object => object.visible), false)[0];
    if (hit) {
      selected = hit.object.userData.part;
      hit.object.geometry.computeBoundingBox();
      const instanceTransform = new THREE.Matrix4();
      hit.object.getMatrixAt(hit.instanceId, instanceTransform);
      instanceTransform.premultiply(hit.object.matrixWorld);
      const pickedBounds = hit.object.geometry.boundingBox.clone().applyMatrix4(instanceTransform);
      updateHighlight(pickedBounds);
      onSelect(selected, { label: labels[selected], illustrative: true, ...(hit.object.userData.records[hit.instanceId] || {}) });
    }
  }
  renderer.domElement.addEventListener('pointerdown', pointerStart);
  renderer.domElement.addEventListener('pointerup', pointerEnd);
  renderer.domElement.addEventListener('wheel', handleSmoothWheelZoom, { passive: false, capture: true });
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  buildSpecimen();
  resize();
  fitCamera();
  onReady({ webgl: true, illustrative: true });

  return {
    setInspection(next) {
      const mode = next === true ? 'frame' : next === false ? 'assembly' : next;
      if (!['assembly', 'frame', 'bay'].includes(mode)) return false;
      cancelSmoothWheelZoom();
      inspection = mode;
      host.dataset.inspection = inspection;
      if (inspection === 'frame') host.dataset.inspectedFrameId = inspectionFrame.id;
      else delete host.dataset.inspectedFrameId;
      if (inspection === 'bay') host.dataset.inspectedBayId = inspectionBay.id;
      else delete host.dataset.inspectedBayId;
      camera = inspection !== 'assembly' || view === '3d' ? perspective : plan;
      controls.object = camera;
      controls.enableRotate = inspection !== 'assembly' || view === '3d';
      ground.visible = inspection === 'assembly' && view === '3d';
      selected = '';
      updateHighlight();
      applyLayers();
      fitCamera();
      return true;
    },
    setView(next) {
      if (next !== '2d' && next !== '3d') return;
      cancelSmoothWheelZoom();
      view = next;
      camera = next === '2d' ? plan : perspective;
      renderer.shadowMap.enabled = next === '3d';
      ground.visible = inspection === 'assembly' && next === '3d';
      renderer.shadowMap.needsUpdate = true;
      controls.object = camera;
      controls.enableRotate = next === '3d';
      controls.target.set(0, next === '2d' ? 0 : Math.max(layout.nominalSlabTop, layout.requestedSlabTop) * 0.46, 0);
      controls.update();
      selected = '';
      updateHighlight();
      applyLayers();
      requestRender();
    },
    setLayer(next) {
      if (!['all', 'frame', 'form'].includes(next)) return;
      layer = next;
      selected = '';
      updateHighlight();
      applyLayers();
    },
    setDimensions(next = {}) {
      const proposed = { ...dimensions, ...next };
      let nextLayout;
      try { nextLayout = createScaffoldLayout(proposed); } catch { return false; }
      dimensions = proposed;
      layout = nextLayout;
      selected = '';
      buildSpecimen();
      fitCamera();
      return true;
    },
    focus(part) {
      if (!Object.hasOwn(labels, part)) return;
      selected = part;
      // Selection is not a demand heat-map or a governing-member marker.
      updateHighlight();
      requestRender();
    },
    zoomByStep(direction) {
      const wheelDelta = direction === 'in' || direction === -1
        ? -100
        : direction === 'out' || direction === 1 ? 100 : 0;
      return queueSmoothPerspectiveZoom(wheelDelta);
    },
    resetCamera() { selected = ''; updateHighlight(); fitCamera(); },
    dispose() {
      disposed = true;
      if (frameRequest) cancelAnimationFrame(frameRequest);
      cancelSmoothWheelZoom();
      observer.disconnect();
      controls.removeEventListener('change', requestRender);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerStart);
      renderer.domElement.removeEventListener('pointerup', pointerEnd);
      renderer.domElement.removeEventListener('wheel', handleSmoothWheelZoom, { capture: true });
      releaseSpecimen();
      if (highlight) highlight.geometry.dispose();
      unitBox.dispose();
      unitTube.dispose();
      ground.geometry.dispose();
      textures.forEach(texture => texture.dispose());
      materials.forEach(surface => surface.dispose());
      key.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
