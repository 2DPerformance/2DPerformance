/** Shared NBV2 presentation only. BOQ-V2 real.js/viewer3d behaviour and surface
 * constants are adapted here; no input, bar path, quantity or card is written. */
export const REALISTIC_3D_API = 1;
export const REALISTIC_SURFACES = Object.freeze({
  concrete: Object.freeze({ color: 0xbdbab3, roughness: .9, metalness: 0, scale: 2.4, size: 512, bump: .005 }),
  lean: Object.freeze({ color: 0xb9b3a7, roughness: 1, metalness: 0, scale: 1.2, size: 256, bump: .012 }),
  soil: Object.freeze({ color: 0x8a6b45, roughness: 1, metalness: 0, scale: 2, size: 256, bump: .012 }),
  brick: Object.freeze({ color: 0xa86b51, roughness: .9, metalness: 0, scale: .6, size: 512, bump: .03 }),
  plaster: Object.freeze({ color: 0xe9e5dc, roughness: .9, metalness: 0, scale: 2, size: 256, bump: .003 }),
});
const WORLD_AXIS = Object.freeze({ x: 0, y: 2, z: 1 }); // NBV2 is Y-up, UI uses Z for elevation.
const finite = value => typeof value === 'number' && Number.isFinite(value);
const fraction = value => finite(value) ? Math.max(0, Math.min(1, value)) : null;
const components = value => Array.isArray(value) ? value : value && [value.x, value.y, value.z];

export function normalizeSceneBounds(bounds) {
  const min = components(bounds?.min), max = components(bounds?.max);
  if (!min || !max || min.length !== 3 || max.length !== 3
    || !min.every(finite) || !max.every(finite) || min.some((value, axis) => value > max[axis])) return null;
  return { min: [...min], max: [...max] };
}

/** Three discards the negative half-space. Axis cuts retain values below the
 * slider; box clipping retains the intersection of its six inner half-spaces. */
export function cutPlaneDescriptors(bounds, state = {}, axisSigns = {}) {
  const box = normalizeSceneBounds(bounds);
  if (!box) return [];
  const result = [];
  const add = (uiAxis, at, lower = false) => {
    const axis = WORLD_AXIS[uiAxis], normal = [0, 0, 0];
    const sign = axisSigns[uiAxis] === -1 ? -1 : 1;
    normal[axis] = (lower ? 1 : -1) * sign;
    const coordinate = box.min[axis] + (box.max[axis] - box.min[axis]) * (sign < 0 ? 1 - at : at);
    result.push({ axis: uiAxis, normal, constant: -normal[axis] * coordinate, fraction: at, lower });
  };
  for (const [index, axis] of ['x', 'y', 'z'].entries()) {
    if (state.box) {
      const lo = fraction(state.box?.min?.[index]) ?? 0;
      const hi = fraction(state.box?.max?.[index]) ?? fraction(state[axis]) ?? 1;
      add(axis, Math.min(lo, hi), true); add(axis, Math.max(lo, hi));
    } else {
      const at = fraction(state[axis]);
      if (at !== null) add(axis, at);
    }
  }
  return result;
}

/** BOQ-V2 envFit proportions, rotated from its Z-up convention to NBV2 Y-up. */
export function sceneFitDescriptors(bounds, shadowSize = 2048) {
  const box = normalizeSceneBounds(bounds);
  if (!box) return null;
  const center = box.min.map((value, axis) => (value + box.max[axis]) / 2);
  const radius = Math.max(1, Math.hypot(...box.max.map((value, axis) => value - box.min[axis])) / 2);
  const sunDirection = [.45, 1, -.7], length = Math.hypot(...sunDirection);
  const groundY = box.min[1] - Math.max(.005, .0008 * radius), shadowExtent = 1.15 * radius;
  return { center, radius, groundY, groundSize: 28 * radius, skyRadius: 16 * radius,
    sunPosition: center.map((value, axis) => value + sunDirection[axis] / length * 3 * radius),
    shadow: { extent: shadowExtent, near: .8 * radius, far: 5.5 * radius,
      bias: -.0003, normalBias: 2.5 * shadowExtent / shadowSize }, fogNear: 4 * radius, fogFar: 13 * radius };
}

export function lowEndRenderer(renderer, device = globalThis.navigator) {
  if ((device?.hardwareConcurrency ?? 8) <= 4 || /Mobi|Android/i.test(device?.userAgent || '')) return true;
  const capabilities = renderer?.capabilities;
  if (finite(capabilities?.maxTextureSize) && capabilities.maxTextureSize < 4096) return true;
  try {
    const gl = renderer?.getContext?.(), extension = gl?.getExtension?.('WEBGL_debug_renderer_info');
    const gpu = extension && gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    if (/swiftshader|llvmpipe|software|microsoft basic/i.test(String(gpu || ''))) return true;
  } catch { /* An unavailable renderer description is not a reason to break the scene. */ }
  return false;
}

/** Seeded porous/formwork-free surfaces. Colour is a neutral multiplier so
 * material colour, transparency and any existing selection cue can survive. */
export function proceduralSurfacePixels(kind, size) {
  const pixels = new Uint8Array(size * size * 4), bump = new Uint8Array(size * size * 4);
  let seed = [...kind].reduce((value, letter) => (value * 31 + letter.charCodeAt(0)) >>> 0, 7);
  const random = () => { seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0; return seed / 4294967296; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const at = (y * size + x) * 4, noise = random(), broad = Math.sin(x / size * 6.283) * Math.cos(y / size * 12.566);
    let value = .91 + .065 * noise + .025 * broad;
    if (noise < .012) value -= .12;
    if (kind === 'soil') value = .78 + .2 * noise + .02 * broad;
    if (kind === 'plaster') value = .94 + .045 * noise;
    if (kind === 'brick') {
      const rowHeight = size / 4, shiftedX = x + (Math.floor(y / rowHeight) % 2) * size / 4;
      if (y % rowHeight < size / 60 || shiftedX % (size / 2) < size / 60) value = .72;
    }
    const grey = Math.round(Math.max(0, Math.min(1, value)) * 255);
    pixels[at] = pixels[at + 1] = pixels[at + 2] = grey; pixels[at + 3] = 255;
    bump[at] = bump[at + 1] = bump[at + 2] = Math.round(noise * 255); bump[at + 3] = 255;
  }
  return { pixels, bump };
}

function inheritedData(object) {
  const data = {};
  for (let current = object; current; current = current.parent) {
    for (const [key, value] of Object.entries(current.userData || {})) if (data[key] === undefined) data[key] = value;
  }
  return data;
}
function rolesOf(object, material) {
  const data = inheritedData(object), description = `${data.family || ''} ${data.kind || ''} ${data.type || ''} ${data.layer || ''} ${data.detailRole || ''} ${data.materialKey || ''} ${material?.userData?.key || ''} ${object.name || ''}`;
  const rebar = Boolean(data.rebarResources || data.rebar || data.rebarLines !== undefined || data.instanceMetadata
    || data.ranges?.some?.(row => row.metadata?.designation) || /rebar|stirrup|tie|dowel|longitudinal|slabTop|slabBottom/i.test(description));
  const roof = Boolean(data.roof || data.isRoof || data.roofPathKind || data.roofFramingMemberId || data.roofFramingRole || /roof/i.test(description));
  let surface = null;
  if (!rebar && !roof && object.isMesh) {
    if (/lean/i.test(description)) surface = 'lean';
    else if (/soil|ground/i.test(description)) surface = 'soil';
    else if (/brick/i.test(description)) surface = 'brick';
    else if (/plaster/i.test(description)) surface = 'plaster';
    else if (/concrete|beam|column|footing|slab|stair|pile|solid/i.test(description)
      || data.cardFingerprint || data.sourceElementId || data.visualSectionSource) surface = 'concrete';
  }
  return { surface, roof, rebar, opaque: data.realisticOpaque === true };
}

export function createRealistic3D({ THREE, renderer, scene, modelRoot, bounds, invalidate = () => {}, lowend, axisSigns = {} } = {}) {
  if (!THREE || !renderer || !scene || !modelRoot) throw new TypeError('NBV2 realistic 3D requires THREE, renderer, scene and modelRoot');
  const lowEnd = lowend ?? lowEndRenderer(renderer), shadowSize = lowEnd ? 0 : 2048;
  const initial = { environment: scene.environment, background: scene.background, fog: scene.fog,
    toneMapping: renderer.toneMapping, exposure: renderer.toneMappingExposure,
    outputColorSpace: renderer.outputColorSpace, outputEncoding: renderer.outputEncoding,
    clipping: renderer.localClippingEnabled, shadows: renderer.shadowMap?.enabled, shadowType: renderer.shadowMap?.type };
  const technicalLights = [];
  scene.traverse(object => { if (object.isLight) technicalLights.push({ object, visible: object.visible }); });
  const tracked = new Map(), materialCache = new Map(), ownedMaterials = new Set(), textures = new Map(), addedUVs = new Map();
  let mode = 'technical', cut = { x: null, y: null, z: null, box: false }, roofStyle = 'normal', disposed = false;
  let normalizedBounds = normalizeSceneBounds(bounds), planes = [], environment = null, environmentGroup = null;
  let sky = null, ground = null, sun = null, fog = null;

  const textureFor = kind => {
    if (textures.has(kind)) return textures.get(kind);
    const spec = REALISTIC_SURFACES[kind], size = lowEnd ? Math.min(spec.size, 128) : spec.size;
    const data = proceduralSurfacePixels(kind, size);
    const map = new THREE.DataTexture(data.pixels, size, size, THREE.RGBAFormat);
    const bumpMap = new THREE.DataTexture(data.bump, size, size, THREE.RGBAFormat);
    for (const texture of [map, bumpMap]) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(1 / spec.scale, 1 / spec.scale); texture.needsUpdate = true;
    }
    map.colorSpace = THREE.SRGBColorSpace;
    textures.set(kind, { map, bumpMap }); return textures.get(kind);
  };
  const materialFor = (original, object) => {
    const role = rolesOf(object, original), key = `${original.uuid}|${mode}|${role.surface || ''}|${role.opaque}|${role.roof && roofStyle === 'xray'}|${planes.length}`;
    if (materialCache.has(key)) return materialCache.get(key);
    if (mode === 'technical' && !planes.length && !(role.roof && roofStyle === 'xray')) return original;
    let material;
    if (mode === 'realistic' && role.surface) {
      const spec = REALISTIC_SURFACES[role.surface], maps = textureFor(role.surface);
      material = new THREE.MeshStandardMaterial({ color: spec.color, roughness: spec.roughness,
        metalness: spec.metalness, envMapIntensity: .45, map: maps.map, bumpMap: maps.bumpMap, bumpScale: spec.bump,
        transparent: role.opaque ? false : original.transparent, opacity: role.opaque ? 1 : original.opacity,
        depthWrite: role.opaque ? true : original.depthWrite,
        side: original.side, vertexColors: original.vertexColors, wireframe: original.wireframe,
        polygonOffset: original.polygonOffset, polygonOffsetFactor: original.polygonOffsetFactor,
        polygonOffsetUnits: original.polygonOffsetUnits });
      // Keep explicit active selection/status accents and avoid recolouring rebar.
      if (original.userData?.preservePresentationColor || object.userData?.selected) material.color.copy(original.color);
      if (original.emissive) material.emissive.copy(original.emissive);
      material.emissiveIntensity = original.emissiveIntensity ?? 1;
    } else material = original.clone();
    material.name = `NBV2_${mode}_${original.name || role.surface || 'preserved'}`;
    material.clippingPlanes = planes.length ? [...(original.clippingPlanes || []), ...planes] : original.clippingPlanes;
    material.clipIntersection = false; material.clipShadows = planes.length > 0 || original.clipShadows;
    if (role.roof && roofStyle === 'xray') {
      material.transparent = true; material.opacity = .18; material.depthWrite = false;
    }
    material.needsUpdate = true; ownedMaterials.add(material); materialCache.set(key, material); return material;
  };
  const refresh = () => {
    if (disposed) return;
    const seen = new Set();
    modelRoot.traverse(object => {
      if ((!object.isMesh && !object.isLine) || !object.material || object.userData?.nbv2Environment) return;
      seen.add(object);
      let entry = tracked.get(object);
      if (!entry || (object.material !== entry.applied && object.material !== entry.original)) {
        entry = { original: object.material, applied: object.material, visible: object.visible,
          castShadow: object.castShadow, receiveShadow: object.receiveShadow }; tracked.set(object, entry);
      }
      const originals = Array.isArray(entry.original) ? entry.original : [entry.original];
      const surface = rolesOf(object, originals[0]).surface;
      const geometry = object.geometry, position = geometry?.getAttribute?.('position');
      if (mode === 'realistic' && surface && position && !geometry.getAttribute('uv')) {
        // Metre-based planar coordinates for existing custom slab/stair faces.
        // Positions, indices, authored geometry and engineering data stay exact.
        const normal = geometry.getAttribute('normal'), uv = new Float32Array(position.count * 2);
        for (let index = 0; index < position.count; index++) {
          const nx = Math.abs(normal?.getX(index) || 0), ny = Math.abs(normal?.getY(index) || 0), nz = Math.abs(normal?.getZ(index) || 0);
          const axis = nx > ny && nx > nz ? 0 : nz > ny ? 2 : 1;
          uv[index * 2] = axis === 0 ? position.getZ(index) : position.getX(index);
          uv[index * 2 + 1] = axis === 1 ? position.getZ(index) : position.getY(index);
        }
        const attribute = new THREE.BufferAttribute(uv, 2);
        geometry.setAttribute('uv', attribute); addedUVs.set(geometry, attribute);
      }
      const applied = originals.map(material => materialFor(material, object));
      entry.applied = Array.isArray(entry.original) ? applied : applied[0]; object.material = entry.applied;
      const role = rolesOf(object, originals[0]);
      if (role.roof) {
        if (roofStyle === 'hidden' && !entry.roofHidden) { entry.visible = object.visible; entry.roofHidden = true; }
        if (entry.roofHidden && roofStyle !== 'hidden') { object.visible = entry.visible; entry.roofHidden = false; }
        if (roofStyle === 'hidden') object.visible = false;
      }
      object.castShadow = mode === 'realistic' && !lowEnd && object.isMesh ? true : entry.castShadow;
      object.receiveShadow = mode === 'realistic' && !lowEnd && object.isMesh ? true : entry.receiveShadow;
    });
    for (const [object, entry] of tracked) if (!seen.has(object)) {
      if (object.material === entry.applied) object.material = entry.original;
      if (entry.roofHidden) object.visible = entry.visible;
      object.castShadow = entry.castShadow; object.receiveShadow = entry.receiveShadow;
      tracked.delete(object);
    }
    // A changed plane count can retire clones. Keep only applied/cached ones;
    // repeated cut toggles never accumulate GPU materials.
    const originalIds = new Set();
    for (const entry of tracked.values()) for (const material of Array.isArray(entry.original) ? entry.original : [entry.original]) originalIds.add(material.uuid);
    for (const key of materialCache.keys()) if (!originalIds.has(key.split('|', 1)[0])) materialCache.delete(key);
    const retained = new Set(materialCache.values());
    for (const entry of tracked.values()) for (const material of Array.isArray(entry.applied) ? entry.applied : [entry.applied]) retained.add(material);
    for (const material of ownedMaterials) if (!retained.has(material)) { material.dispose(); ownedMaterials.delete(material); }
    renderer.localClippingEnabled = initial.clipping || planes.length > 0;
    invalidate();
  };
  const updatePlanes = () => {
    const descriptors = cutPlaneDescriptors(normalizedBounds, cut, axisSigns);
    if (descriptors.length === planes.length) {
      descriptors.forEach((row, index) => { planes[index].normal.fromArray(row.normal); planes[index].constant = row.constant; });
    } else {
      planes = descriptors.map(row => new THREE.Plane(new THREE.Vector3(...row.normal), row.constant));
      materialCache.clear();
    }
  };
  const fit = nextBounds => {
    if (disposed) return;
    normalizedBounds = normalizeSceneBounds(nextBounds) || normalizedBounds;
    if (!normalizedBounds) normalizedBounds = normalizeSceneBounds(new THREE.Box3().setFromObject(modelRoot));
    updatePlanes();
    const fitted = sceneFitDescriptors(normalizedBounds, shadowSize || 1024);
    if (environmentGroup && fitted) {
      sun.position.fromArray(fitted.sunPosition); sun.target.position.fromArray(fitted.center);
      const camera = sun.shadow.camera, ext = fitted.shadow.extent;
      Object.assign(camera, { left: -ext, right: ext, top: ext, bottom: -ext,
        near: fitted.shadow.near, far: fitted.shadow.far }); camera.updateProjectionMatrix();
      sun.shadow.bias = fitted.shadow.bias; sun.shadow.normalBias = fitted.shadow.normalBias; sun.shadow.needsUpdate = true;
      ground.position.set(fitted.center[0], fitted.groundY, fitted.center[2]);
      ground.scale.set(fitted.groundSize, fitted.groundSize, 1);
      sky.position.fromArray(fitted.center); sky.scale.setScalar(fitted.skyRadius);
      fog.near = fitted.fogNear; fog.far = fitted.fogFar;
    }
    refresh(); return fitted;
  };
  const ensureEnvironment = () => {
    if (environmentGroup) return;
    const width = lowEnd ? 128 : 256, height = width / 2, pixels = new Uint8Array(width * height * 4);
    const horizon = new THREE.Color('#dde6ec'), zenith = new THREE.Color('#4f86c4'), earth = new THREE.Color('#6f6a5b');
    const color = new THREE.Color();
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const elevation = Math.cos(y / (height - 1) * Math.PI), at = (y * width + x) * 4;
      color.copy(horizon).lerp(elevation >= 0 ? zenith : earth,
        elevation >= 0 ? Math.pow(elevation, .55) : Math.min(1, -elevation * 5));
      color.convertLinearToSRGB();
      // A small warm sun disc is part of the reflection map, as in BOQ-V2.
      const sunDisc = Math.exp(-(((x / width - .64) * 65) ** 2) - (((y / height - .25) * 45) ** 2));
      pixels[at] = Math.min(255, Math.round(color.r * 255 + sunDisc * 75));
      pixels[at + 1] = Math.min(255, Math.round(color.g * 255 + sunDisc * 65));
      pixels[at + 2] = Math.min(255, Math.round(color.b * 255 + sunDisc * 45)); pixels[at + 3] = 255;
    }
    environment = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
    environment.mapping = THREE.EquirectangularReflectionMapping; environment.colorSpace = THREE.SRGBColorSpace;
    environment.needsUpdate = true; environment.name = 'NBV2_PROCEDURAL_SKY_ENVIRONMENT';
    environmentGroup = new THREE.Group(); environmentGroup.userData.nbv2Environment = true;
    environmentGroup.name = 'NBV2_REALISTIC_PRESENTATION_ONLY'; scene.add(environmentGroup);
    sky = new THREE.Mesh(new THREE.SphereGeometry(1, lowEnd ? 16 : 32, lowEnd ? 8 : 16),
      new THREE.MeshBasicMaterial({ map: environment, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -10; sky.userData.nbv2Environment = true; environmentGroup.add(sky);
    environmentGroup.add(new THREE.HemisphereLight(0xdbe8f7, 0x8b7d66, .32));
    sun = new THREE.DirectionalLight(0xfff1dc, 1.75); sun.castShadow = !lowEnd;
    sun.shadow.mapSize.set(shadowSize || 1024, shadowSize || 1024);
    environmentGroup.add(sun, sun.target);
    const maps = textureFor('soil');
    ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({
      color: 0x9bad8a, roughness: 1, metalness: 0, map: maps.map, bumpMap: maps.bumpMap, bumpScale: .015 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = !lowEnd;
    ground.userData.nbv2Environment = true; environmentGroup.add(ground);
    fog = new THREE.Fog(0xdde6ec, 50, 200);
  };
  const setMode = next => {
    if (disposed) return;
    mode = next === 'realistic' ? 'realistic' : 'technical';
    if (mode === 'realistic') ensureEnvironment();
    if (environmentGroup) environmentGroup.visible = mode === 'realistic';
    technicalLights.forEach(({ object, visible }) => { object.visible = mode === 'technical' && visible; });
    scene.environment = mode === 'realistic' ? environment : initial.environment;
    scene.background = mode === 'realistic' ? new THREE.Color(0xdde6ec) : initial.background;
    scene.fog = mode === 'realistic' ? fog : initial.fog;
    renderer.toneMapping = mode === 'realistic' ? THREE.ACESFilmicToneMapping : initial.toneMapping;
    renderer.toneMappingExposure = mode === 'realistic' ? .95 : initial.exposure;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = mode === 'realistic' ? THREE.SRGBColorSpace : initial.outputColorSpace;
    else renderer.outputEncoding = mode === 'realistic' ? THREE.sRGBEncoding : initial.outputEncoding;
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = mode === 'realistic' ? !lowEnd : initial.shadows;
      renderer.shadowMap.type = mode === 'realistic' ? THREE.PCFSoftShadowMap : initial.shadowType;
      renderer.shadowMap.needsUpdate = true;
    }
    fit();
  };
  const setCut = state => {
    if (disposed) return;
    cut = { x: fraction(state?.x), y: fraction(state?.y), z: fraction(state?.z), box: state?.box || false };
    if (!normalizedBounds) fit(); else { updatePlanes(); refresh(); }
  };
  const setRoofStyle = value => {
    if (disposed) return;
    roofStyle = ['xray', 'hidden'].includes(value) ? value : 'normal'; refresh();
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const [object, entry] of tracked) {
      if (object.material === entry.applied) object.material = entry.original;
      if (entry.roofHidden) object.visible = entry.visible;
      object.castShadow = entry.castShadow; object.receiveShadow = entry.receiveShadow;
    }
    for (const material of ownedMaterials) material.dispose();
    for (const [geometry, attribute] of addedUVs) if (geometry.getAttribute('uv') === attribute) geometry.deleteAttribute('uv');
    addedUVs.clear();
    for (const maps of textures.values()) { maps.map.dispose(); maps.bumpMap.dispose(); }
    if (environmentGroup) {
      scene.remove(environmentGroup);
      sky.geometry.dispose(); sky.material.dispose(); ground.geometry.dispose(); ground.material.dispose();
      sun.shadow.map?.dispose(); environment.dispose();
    }
    technicalLights.forEach(({ object, visible }) => { object.visible = visible; });
    scene.environment = initial.environment; scene.background = initial.background; scene.fog = initial.fog;
    renderer.toneMapping = initial.toneMapping; renderer.toneMappingExposure = initial.exposure;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = initial.outputColorSpace;
    else renderer.outputEncoding = initial.outputEncoding;
    renderer.localClippingEnabled = initial.clipping;
    if (renderer.shadowMap) { renderer.shadowMap.enabled = initial.shadows; renderer.shadowMap.type = initial.shadowType; }
    tracked.clear(); materialCache.clear(); ownedMaterials.clear(); textures.clear(); invalidate();
  };
  return { setMode, fit, setCut, setRoofStyle, refresh, dispose,
    get state() { return { mode, cut: { ...cut }, roofStyle, lowEnd, bounds: normalizeSceneBounds(normalizedBounds) }; } };
}
