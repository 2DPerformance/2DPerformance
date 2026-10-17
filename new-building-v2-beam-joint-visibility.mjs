// Pure drawing projection implemented by the standalone rebar geometry kernel.
import { collectBeamJointOmissionBoxes } from './new-building-v2-rebar-path3d.mjs';
export { collectBeamJointOmissionBoxes, projectBeamJointVisiblePaths } from './new-building-v2-rebar-path3d.mjs';

export const beamJointDetailNotDrawnNote = mark => `จุดต่อคาน–เสา ${mark}: ไม่ได้วาดรายละเอียดขอเหล็กเพราะหัวเสาแคบ · ปริมาณเหล็กใน BOQ คิดครบ`;

/** One small drawing marker per cropped joint. Never a quantity/rebar path. */
export function collectBeamJointOmissionMarkers({ geometry, designMembers = [], omissionBoxes } = {}) {
  const markers = new Map();
  const boxes = omissionBoxes || collectBeamJointOmissionBoxes({ geometry, designMembers });
  for (const box of boxes) {
    if (markers.has(box.jointId)) continue;
    const centre = box.lo.map((value, index) => (value + box.hi[index]) / 2);
    markers.set(box.jointId, {
      jointId: box.jointId, columnMark: box.columnMark,
      note: beamJointDetailNotDrawnNote(box.columnMark), centre,
      from: [centre[0] - .07, centre[1], centre[2]],
      to: [centre[0] + .07, centre[1], centre[2]],
      memberIds: [...new Set(boxes.filter(row => row.jointId === box.jointId).map(row => row.memberId))],
    });
  }
  return [...markers.values()];
}

/** Visible amber cross; xyz source coordinates are mapped by each viewer. */
export function addBeamJointOmissionMarkers({ THREE, root, markers = [], transform = point => point }) {
  if (!markers.length) return [];
  const material = new THREE.LineBasicMaterial({ color: 0xf59e0b, depthTest: false, depthWrite: false });
  return markers.map(marker => {
    const [x, y, z] = marker.centre;
    const points = [[x - .07, y, z], [x + .07, y, z], [x, y - .07, z], [x, y + .07, z], [x, y, z - .07], [x, y, z + .07]];
    const object = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(
      points.map(point => new THREE.Vector3(...transform(point)))), material);
    object.name = marker.note;
    object.userData = { beamJointId: marker.jointId, beamJointDetailNotDrawn: true, note: marker.note, quantityIncluded: true };
    object.renderOrder = 20;
    root.add(object);
    return object;
  });
}
