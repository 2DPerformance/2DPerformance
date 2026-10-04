import { FRAME_CATALOG } from './scaffold-layout.js';

// Undimensioned proportions interpreted from the F1700 silhouette, not
// manufacturer fabrication dimensions or an approved member specification.
export const FRAME_VISUAL_PROPORTIONS = Object.freeze({
  innerInset: 0.18,
  bendRadius: 0.18,
  returnY: 0.43,
  headerBelowTop: 0.13,
  sideTieY: Object.freeze([0.9, 1.28]),
  innerTubeRadius: 0.017,
  arcSegments: 16,
});

export function createFrameProfile(module = FRAME_CATALOG) {
  if (module.width !== FRAME_CATALOG.width || module.height !== FRAME_CATALOG.height ||
      module.schematicTubeOD !== FRAME_CATALOG.schematicTubeOD) {
    throw new RangeError('This visual profile is only defined for the selected nominal F1700 frame.');
  }
  const { width, height } = module;
  const p = FRAME_VISUAL_PROPORTIONS;
  const outerRadius = module.schematicTubeOD / 2;
  const topRailY = height - outerRadius;
  const outerLeft = -width / 2;
  const outerRight = width / 2;
  const innerLeft = outerLeft + p.innerInset;
  const innerRight = outerRight - p.innerInset;
  const headerY = height - p.headerBelowTop;
  const components = [];
  function add(id, role, side, points, radius) {
    components.push(Object.freeze({ id, role, side, radius,
      points: Object.freeze(points.map(point => Object.freeze([...point]))) }));
  }
  add('outer-leg-left', 'outer-leg', 'left', [[outerLeft, 0, 0], [outerLeft, height, 0]], outerRadius);
  add('outer-leg-right', 'outer-leg', 'right', [[outerRight, 0, 0], [outerRight, height, 0]], outerRadius);
  add('outer-top-rail', 'outer-top', 'center', [[outerLeft, topRailY, 0], [outerRight, topRailY, 0]], outerRadius);
  for (const [side, outerX, sign] of [['left', outerLeft, 1], ['right', outerRight, -1]]) {
    const points = [];
    for (let step = 0; step <= p.arcSegments; step += 1) {
      const angle = -Math.PI / 2 + step / p.arcSegments * Math.PI / 2;
      points.push([outerX + sign * p.bendRadius * Math.cos(angle),
        p.returnY + p.bendRadius + p.bendRadius * Math.sin(angle), 0]);
    }
    points[0] = [outerX, p.returnY, 0];
    points[p.arcSegments] = [outerX + sign * p.innerInset, p.returnY + p.bendRadius, 0];
    points.push([outerX + sign * p.innerInset, topRailY, 0]);
    add(`inner-j-${side}`, 'inner-j', side, points, p.innerTubeRadius);
    for (const [index, y] of p.sideTieY.entries()) {
      add(`side-tie-${side}-${index + 1}`, 'side-tie', side,
        [[outerX, y, 0], [outerX + sign * p.innerInset, y, 0]], p.innerTubeRadius);
    }
  }
  add('inner-header', 'inner-header', 'center', [[innerLeft, headerY, 0], [innerRight, headerY, 0]], p.innerTubeRadius);
  add('center-top-link', 'center-top-link', 'center', [[0, headerY, 0], [0, topRailY, 0]], p.innerTubeRadius);
  return Object.freeze({ moduleId: module.id, nominalWidth: width, nominalHeight: height,
    topRailY, headerY, status: 'schematic-profile-only', components: Object.freeze(components) });
}
