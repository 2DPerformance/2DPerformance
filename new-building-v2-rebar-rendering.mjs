/** Presentation only: render the existing paths without selecting steel,
 * changing stations, or feeding a quantity/report pipeline. */
import { tubeGeometryData } from './new-building-v2-rebar-path3d.mjs';

export const REBAR_RENDERING_API = 1;
const EPS = 1e-10;
const declared = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const point = value => Array.isArray(value) && value.length === 3 && value.every(declared);
const asPoint = value => point(value) ? value.map(Number)
  : value && [value.x, value.y, value.z].every(declared) ? [Number(value.x), Number(value.y), Number(value.z)] : null;
const radiusOf = path => declared(path?.radiusM) && Number(path.radiusM) > 0 ? Number(path.radiusM) : null;
const cleanPoints = path => {
  const input = Array.isArray(path) ? path : path?.points;
  if (!Array.isArray(input) || !input.every(point) || !radiusOf(path)) return [];
  const clean = input.map(row => row.map(Number)).filter((row, index, rows) => !index
    || Math.hypot(...row.map((value, axis) => value - rows[index - 1][axis])) > EPS);
  return clean.length >= 2 ? clean : [];
};
const designationOf = path => String(path?.metadata?.designation ?? '').trim().toUpperCase();
const ribbed = path => {
  const tokens = [...designationOf(path).matchAll(/\bDB\s*(\d+(?:\.\d+)?)(?=$|[\s@,+;])/g)];
  return tokens.length > 0 && tokens.every(match => Number(match[1]) === radiusOf(path) * 2000);
};
const isTie = path => {
  const data = path?.metadata || {};
  const kind = `${data.type || ''} ${data.role || ''}`;
  return /(?:tie|stirrup|hanger)/i.test(kind) || (['shear', 'end-zone', 'hanger'].includes(data.kind)
    && (Number.isInteger(data.hookCorner) || declared(data.hookAngleDeg) || data.rounded === true));
};

/** A local shape is only reusable if translating it reconstructs EVERY stored
 * coordinate exactly. Binary subtraction can fail this test; those paths stay
 * merged tubes. No rounding or geometric tolerance creates an instance. */
function translatedShape(path, points) {
  if (!isTie(path) || !points.length) return null;
  let shape = path?.instanceShape, translation = asPoint(path?.instanceTranslation);
  if (shape !== undefined || translation) {
    if (!Array.isArray(shape) || !shape.every(point) || shape.length !== points.length || !translation) return null;
    shape = shape.map(row => row.map(Number));
  } else {
    translation = points[0];
    shape = points.map(row => row.map((value, axis) => value - translation[axis]));
  }
  if (!shape.every((row, index) => row.every((value, axis) => value + translation[axis] === points[index][axis]))) return null;
  return { shape, translation, key: JSON.stringify([radiusOf(path), shape]) };
}

/** Procedural normal-map port of the read-only legacy rib presentation. The
 * diameter/pitch lives in the tube UV; this texture does not alter geometry. */
export function createRebarRibNormalMap(THREE) {
  const width = 64, height = 32, pixels = new Uint8Array(width * height * 4);
  const heightAt = (u, v) => .9 * Math.exp(-(((u - .5 - .12 * Math.sin(v * Math.PI * 2)) / .12) ** 2))
    + .6 * (Math.exp(-(((v - .25) / .03) ** 2)) + Math.exp(-(((v - .75) / .03) ** 2)));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, v = y / height;
    const du = (heightAt(u + 1 / width, v) - heightAt(u - 1 / width, v)) * width / 2;
    const dv = (heightAt(u, v + 1 / height) - heightAt(u, v - 1 / height)) * height / 2;
    const nx = -.08 * du, ny = -.04 * dv, size = Math.hypot(nx, ny, 1), offset = (y * width + x) * 4;
    pixels[offset] = Math.round((nx / size * .5 + .5) * 255);
    pixels[offset + 1] = Math.round((ny / size * .5 + .5) * 255);
    pixels[offset + 2] = Math.round((1 / size * .5 + .5) * 255);
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  texture.name = 'NBV2_DB_RIB_NORMAL_PRESENTATION_ONLY';
  return texture;
}

function tubeGeometry(THREE, rows, radialSegments) {
  const data = tubeGeometryData(rows.map(row => row.path), null, radialSegments);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  if (data.uvs) geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
  if (data.positions.length) geometry.computeBoundingSphere();
  return { geometry, ranges: data.ranges.map(range => ({ ...range, pathIndex: rows[range.pathIndex].pathIndex })) };
}

function lineGeometry(THREE, rows) {
  const positions = [], ranges = [];
  for (const row of rows) {
    const start = positions.length / 3, points = cleanPoints(row.path);
    for (let index = 1; index < points.length; index++) positions.push(...points[index - 1], ...points[index]);
    ranges.push({ pathIndex: row.pathIndex, start, count: positions.length / 3 - start, metadata: row.path?.metadata });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (positions.length) geometry.computeBoundingSphere();
  return { geometry, ranges };
}

/** Returns unattached THREE objects. Zero-count ranges retain rejected source
 * paths; merged ranges and instanceMetadata retain original station/bar IDs. */
export function createRebarBatchMeshes(THREE, paths, material, options = {}) {
  const { radialSegments = 8, lineMode = false, instancing = true, realistic = false,
    forceLines: _forceLines, ...metadata } = options;
  if (!Array.isArray(paths) || !paths.length) return [];
  const rows = paths.map((path, pathIndex) => ({ path, pathIndex }));
  const resources = { materials: [], textures: [] };
  const materialCache = new Map();
  let ribTexture = null;
  const materialFor = textured => {
    const key = lineMode ? 'line' : textured ? 'rib' : 'plain';
    if (materialCache.has(key)) return materialCache.get(key);
    let result = material;
    if (lineMode && material?.isLineBasicMaterial !== true) {
      result = new THREE.LineBasicMaterial({ color: material?.color, transparent: material?.transparent,
        opacity: material?.opacity ?? 1, depthTest: material?.depthTest ?? true, depthWrite: material?.depthWrite ?? true });
      resources.materials.push(result);
    } else if (textured && typeof material?.clone === 'function') {
      result = material.clone();
      ribTexture ||= createRebarRibNormalMap(THREE);
      result.normalMap = ribTexture;
      result.normalScale?.set?.(.3, .3);
      result.needsUpdate = true;
      resources.materials.push(result);
      if (!resources.textures.includes(ribTexture)) resources.textures.push(ribTexture);
    } else if (realistic && material?.normalMap && typeof material?.clone === 'function') {
      // A stored RB designation (or absent designation) remains a smooth bar.
      result = material.clone(); result.normalMap = null; result.needsUpdate = true;
      resources.materials.push(result);
    }
    materialCache.set(key, result);
    return result;
  };
  const objects = [];
  const ids = new Set(paths.map(path => String(path?.metadata?.memberId ?? '').trim()).filter(Boolean));
  const dataFor = extra => ({ ...(ids.size === 1 ? { memberId: [...ids][0] } : {}),
    ...metadata, presentationOnly: true, ...extra, rebarResources: resources });
  const addObject = object => {
    if (typeof options.name === 'string') object.name = options.name;
    if (typeof options.castShadow === 'boolean') object.castShadow = options.castShadow;
    objects.push(object);
  };
  if (lineMode) {
    const { geometry, ranges } = lineGeometry(THREE, rows);
    const object = new THREE.LineSegments(geometry, materialFor(false));
    object.userData = dataFor({ ranges, rebarLines: true }); addObject(object);
    return objects;
  }
  const instanceGroups = new Map(), merged = new Map();
  const merge = row => {
    const key = JSON.stringify([radiusOf(row.path), realistic && ribbed(row.path)]);
    if (!merged.has(key)) merged.set(key, []);
    merged.get(key).push(row);
  };
  for (const row of rows) {
    const shape = instancing ? translatedShape(row.path, cleanPoints(row.path)) : null;
    if (!shape) { merge(row); continue; }
    const key = JSON.stringify([shape.key, realistic && ribbed(row.path)]);
    if (!instanceGroups.has(key)) instanceGroups.set(key, []);
    instanceGroups.get(key).push({ ...row, ...shape });
  }
  for (const group of instanceGroups.values()) {
    if (group.length < 2) { merge(group[0]); continue; }
    const source = group[0];
    const shapePath = { ...source.path, points: source.shape };
    const { geometry, ranges } = tubeGeometry(THREE, [{ path: shapePath, pathIndex: source.pathIndex }], radialSegments);
    const mesh = new THREE.InstancedMesh(geometry, materialFor(realistic && ribbed(source.path)), group.length);
    const matrix = new THREE.Matrix4();
    group.forEach((row, index) => mesh.setMatrixAt(index, matrix.makeTranslation(...row.translation)));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere?.();
    mesh.userData = dataFor({ ranges, rebarLines: false,
      instanceMetadata: group.map(row => ({ ...row.path?.metadata, pathIndex: row.pathIndex })),
      instancePathIndexes: group.map(row => row.pathIndex), instanceShape: source.shape,
      instanceTranslations: group.map(row => row.translation) });
    addObject(mesh);
  }
  for (const group of merged.values()) {
    // A singleton instance candidate joins this group after the first pass.
    // Restore source order so ranges remain deterministic without dropping it.
    group.sort((a, b) => a.pathIndex - b.pathIndex);
    const { geometry, ranges } = tubeGeometry(THREE, group, radialSegments);
    const mesh = new THREE.Mesh(geometry, materialFor(realistic && ribbed(group[0].path)));
    mesh.userData = dataFor({ ranges, rebarLines: false }); addObject(mesh);
  }
  return objects;
}

function pathDistance(path, target) {
  const points = Array.isArray(path?.selectionPoints) && path.selectionPoints.every(point)
    ? path.selectionPoints.map(row => row.map(Number)) : cleanPoints(path);
  let minimum = Infinity;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index], delta = b.map((value, axis) => value - a[axis]);
    const squared = delta.reduce((sum, value) => sum + value * value, 0);
    const fraction = squared > 0 ? Math.max(0, Math.min(1,
      delta.reduce((sum, value, axis) => sum + value * (target[axis] - a[axis]), 0) / squared)) : 0;
    minimum = Math.min(minimum, Math.hypot(...a.map((value, axis) => value + fraction * delta[axis] - target[axis])));
  }
  return minimum;
}

/** Above the global presentation budget every path remains in the line base.
 * Nearby tubes are an overlay, bounded by source member IDs, not new steel. */
export function chooseRebarDisplayPlan(paths, { totalPathCount = paths?.length || 0, target = [0, 0, 0],
  nearDistanceM = 7, maxMembers = 80, selectedMemberId = null } = {}) {
  const source = Array.isArray(paths) ? paths : [], targetPoint = asPoint(target);
  const memberId = path => String(path?.metadata?.memberId ?? '').trim();
  const count = declared(totalPathCount) ? Math.max(source.length, Number(totalPathCount)) : source.length;
  if (count <= 9000) return { lineMode: false, linePaths: [], tubePaths: source,
    detailMemberIds: [...new Set(source.map(memberId).filter(Boolean))].sort(), totalPathCount: count };
  const cap = Math.max(1, Math.min(80, Number.isFinite(Number(maxMembers)) ? Math.floor(Number(maxMembers)) : 80));
  const distance = declared(nearDistanceM) && Number(nearDistanceM) >= 0 ? Number(nearDistanceM) : 7;
  const members = new Map();
  for (const path of source) {
    const id = memberId(path); if (!id) continue;
    const nearest = targetPoint ? pathDistance(path, targetPoint) : Infinity;
    members.set(id, Math.min(members.get(id) ?? Infinity, nearest));
  }
  const selected = String(selectedMemberId ?? '').trim(), detailMemberIds = [];
  if (selected && members.has(selected)) detailMemberIds.push(selected);
  const nearby = [...members].filter(([id, nearest]) => id !== selected && nearest <= distance)
    .sort(([a, ad], [b, bd]) => ad - bd || a.localeCompare(b));
  for (const [id] of nearby) { if (detailMemberIds.length >= cap) break; detailMemberIds.push(id); }
  const detail = new Set(detailMemberIds);
  return { lineMode: true, linePaths: source, tubePaths: source.filter(path => detail.has(memberId(path))),
    detailMemberIds, totalPathCount: count };
}

function disposeObjects(objects) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = new Set();
  for (const object of objects) {
    object.parent?.remove?.(object);
    // Three releases uploaded instanceMatrix/instanceColor attributes on the
    // InstancedMesh dispose event, separately from BufferGeometry disposal.
    if (object.isInstancedMesh) instances.add(object);
    if (object.geometry) geometries.add(object.geometry);
    const resources = object.userData?.rebarResources;
    for (const material of resources?.materials || []) materials.add(material);
    for (const texture of resources?.textures || []) textures.add(texture);
  }
  for (const object of instances) object.dispose?.();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
}

/** Bind deferred cages once, using their GLOBAL source count. Source materials
 * belong to the caller. Only generated geometry, material clones and maps are
 * released on an overlay change; repeated near-member sets do no GPU work. */
export function bindRebarLOD(THREE, records, options = {}) {
  const source = (Array.isArray(records) ? records : []).filter(row => row?.parent && Array.isArray(row.paths));
  const paths = source.flatMap(row => row.paths), totalPathCount = paths.length;
  const { target = [0, 0, 0], selectedMemberId = null } = options;
  let staticObjects = [], tubeObjects = [], signature = null, disposed = false;
  let lastTarget = null, lastSelected = null;
  const stats = { evidencePathCount: totalPathCount, linePathCount: 0, tubePathCount: 0,
    drawObjectCount: 0, geometryVertices: 0, renderedVertices: 0, instancedPathCount: 0, detailMemberIds: [] };
  const add = (row, subset, lineMode) => {
    const objects = createRebarBatchMeshes(THREE, subset, row.material, {
      ...options, ...row.options, ...row.metadata, target: undefined, selectedMemberId: undefined,
      nearDistanceM: undefined, maxMembers: undefined, lineMode });
    for (const object of objects) row.parent.add(object);
    return objects;
  };
  const refreshStats = plan => {
    const objects = [...staticObjects, ...tubeObjects];
    stats.drawObjectCount = objects.length;
    stats.geometryVertices = stats.renderedVertices = stats.instancedPathCount = 0;
    for (const object of objects) {
      const count = object.geometry?.getAttribute?.('position')?.count || 0;
      stats.geometryVertices += count;
      stats.renderedVertices += count * (object.isInstancedMesh ? object.count : 1);
      if (object.isInstancedMesh) stats.instancedPathCount += object.count;
    }
    stats.detailMemberIds = plan.detailMemberIds.slice();
  };
  const update = (nextTarget = target, nextSelected = selectedMemberId) => {
    if (disposed) return false;
    if (signature !== null && totalPathCount <= 9000) return false;
    const targetPoint = asPoint(nextTarget), selected = String(nextSelected ?? '').trim();
    if (signature !== null && selected === lastSelected && (targetPoint === null && lastTarget === null
      || targetPoint && lastTarget && targetPoint.every((value, axis) => value === lastTarget[axis]))) return false;
    lastTarget = targetPoint; lastSelected = selected;
    const plan = chooseRebarDisplayPlan(paths, { ...options, totalPathCount, target: nextTarget, selectedMemberId: nextSelected });
    const nextSignature = JSON.stringify([plan.lineMode, plan.detailMemberIds.slice().sort()]);
    if (signature === nextSignature) return false;
    if (signature === null) {
      for (const row of source) if (plan.lineMode || row.options?.forceLines === true) {
        staticObjects.push(...add(row, row.paths, true)); stats.linePathCount += row.paths.length;
      }
    }
    disposeObjects(tubeObjects); tubeObjects = [];
    const details = new Set(plan.tubePaths);
    stats.tubePathCount = 0;
    for (const row of source) {
      if (row.options?.forceLines === true) continue;
      const subset = row.paths.filter(path => details.has(path));
      tubeObjects.push(...add(row, subset, false)); stats.tubePathCount += subset.length;
    }
    signature = nextSignature; refreshStats(plan); return true;
  };
  update(target, selectedMemberId);
  return { update, stats, dispose() {
    if (disposed) return;
    disposed = true; disposeObjects([...staticObjects, ...tubeObjects]); staticObjects = tubeObjects = [];
  } };
}
