import { FRAME_CATALOG } from './scaffold-layout.js';

// Visual hardware envelope only. No manufacturer compatibility, extension,
// bearing area, capacity or quantity authority is represented by these values.
export const ACCESSORY_VISUALS = Object.freeze({
  braceRadius: 0.013,
  braceFaceClearance: 0.008,
  // Keep the two schematic brace tubes visibly independent at the X crossing.
  // 0.030 m centreline spacing = 0.004 m clear gap for 0.026 m OD tubes.
  bracePairSeparation: 0.030,
  pinRadius: 0.012,
  pinProjection: 0.080,
  lockRadius: 0.020,
  lockLength: 0.012,
  soleBoard: Object.freeze({ width: 0.125, height: 0.054, length: 0.21 }),
  basePlate: Object.freeze({ width: 0.115, height: 0.02, length: 0.14 }),
  uHead: Object.freeze({ width: 0.14, plateHeight: 0.02, depth: 0.14, sideHeight: 0.07 }),
});

export function createFrameBraceHardware(layout, frame) {
  if (!layout || layout.module?.id !== FRAME_CATALOG.id || !frame ||
      ![frame.x1, frame.x2, frame.z, frame.bottom, frame.layer].every(Number.isFinite) ||
      typeof frame.id !== 'string' || !frame.id || !Number.isInteger(frame.layer)) {
    throw new RangeError('A valid nominal frame is required for brace hardware.');
  }
  const pins = [];
  const locks = [];
  for (const [side, legX, direction] of [['left', frame.x1, -1], ['right', frame.x2, 1]]) {
    const connectorX = legX + direction * (FRAME_CATALOG.schematicTubeOD / 2 + ACCESSORY_VISUALS.braceRadius +
      ACCESSORY_VISUALS.braceFaceClearance + ACCESSORY_VISUALS.bracePairSeparation / 2);
    for (const [elevation, pin] of [['low', layout.brace.pinLow], ['high', layout.brace.pinHigh]]) {
      const pinId = `pin-${frame.id}-${side}-${elevation}`;
      const y = frame.bottom + pin;
      const fromX = direction < 0 ? legX - ACCESSORY_VISUALS.pinProjection : legX;
      const toX = direction > 0 ? legX + ACCESSORY_VISUALS.pinProjection : legX;
      pins.push(Object.freeze({ id: pinId, frameId: frame.id, side, elevation, layer: frame.layer,
        from: Object.freeze([fromX, y, frame.z]), to: Object.freeze([toX, y, frame.z]),
        connector: Object.freeze([connectorX, y, frame.z]) }));
      locks.push(Object.freeze({ id: `lock-${frame.id}-${side}-${elevation}`, pinId, frameId: frame.id,
        side, elevation, layer: frame.layer, center: Object.freeze([connectorX, y, frame.z]),
        from: Object.freeze([connectorX - ACCESSORY_VISUALS.lockLength / 2, y, frame.z]),
        to: Object.freeze([connectorX + ACCESSORY_VISUALS.lockLength / 2, y, frame.z]) }));
    }
  }
  return Object.freeze({ pins: Object.freeze(pins), locks: Object.freeze(locks) });
}

export function createBayInspection(layout, options = {}) {
  const { laneIndex = 0, bayIndex = 0 } = options;
  if (!layout || layout.module?.id !== FRAME_CATALOG.id) throw new RangeError('A current nominal F1700 layout is required.');
  if (Object.keys(options).some(key => !['laneIndex', 'bayIndex'].includes(key)) ||
      ![laneIndex, bayIndex].every(Number.isInteger) || laneIndex < 0 || bayIndex < 0 ||
      laneIndex >= layout.lanes.length || bayIndex >= layout.stations.length - 1) {
    throw new RangeError('Invalid illustrative bay selection.');
  }
  const lane = layout.lanes[laneIndex];
  const z1 = layout.stations[bayIndex];
  const z2 = layout.stations[bayIndex + 1];
  const frames = layout.frames.filter(frame => frame.lane === laneIndex &&
    (frame.station === bayIndex || frame.station === bayIndex + 1)).map(frame => Object.freeze({ ...frame }));
  if (frames.length !== 2 * layout.layers) throw new RangeError('The complete illustrative bay needs two end frames per layer.');
  const bottom = layout.baseOffset;
  const top = bottom + layout.layers * FRAME_CATALOG.height;
  const legs = [];
  for (const z of [z1, z2]) for (const [side, x] of [['left', lane.x1], ['right', lane.x2]]) {
    legs.push(Object.freeze({ id: `${side}-${z === z1 ? 'start' : 'end'}`, side, x, z, bottom, top }));
  }
  const braces = [];
  const pins = [];
  const locks = [];
  for (let layer = 0; layer < layout.layers; layer += 1) {
    const layerBottom = bottom + layer * FRAME_CATALOG.height;
    for (const [side, legX, direction] of [['left', lane.x1, -1], ['right', lane.x2, 1]]) {
    const faceX = legX + direction * (FRAME_CATALOG.schematicTubeOD / 2 + ACCESSORY_VISUALS.braceRadius +
      ACCESSORY_VISUALS.braceFaceClearance + ACCESSORY_VISUALS.bracePairSeparation / 2);
    const barX = [faceX - ACCESSORY_VISUALS.bracePairSeparation / 2, faceX + ACCESSORY_VISUALS.bracePairSeparation / 2];
    braces.push(Object.freeze({ id: `brace-L${layer + 1}-${side}-rising`, side, x: barX[0],
      layer, from: Object.freeze([barX[0], layerBottom + layout.brace.pinLow, z1]), to: Object.freeze([barX[0], layerBottom + layout.brace.pinHigh, z2]) }));
    braces.push(Object.freeze({ id: `brace-L${layer + 1}-${side}-falling`, side, x: barX[1],
      layer, from: Object.freeze([barX[1], layerBottom + layout.brace.pinHigh, z1]), to: Object.freeze([barX[1], layerBottom + layout.brace.pinLow, z2]) }));
    }
  }
  for (const frame of frames) {
    const hardware = createFrameBraceHardware(layout, frame);
    pins.push(...hardware.pins);
    locks.push(...hardware.locks);
  }
  const stackConnectors = [];
  for (let joint = 1; joint < layout.layers; joint += 1) for (const leg of legs) {
    stackConnectors.push(Object.freeze({ id: `stack-${leg.id}-${joint}`, x: leg.x,
      y: bottom + joint * FRAME_CATALOG.height, z: leg.z, joint }));
  }
  const displayCounts = Object.freeze({ endFrames: frames.length, braceAssemblies: 2 * layout.layers,
    diagonalTubes: braces.length, bottomSupports: legs.length, topHeads: legs.length,
    connectorPins: pins.length, schematicLocks: locks.length, stackConnectors: stackConnectors.length });
  return Object.freeze({ id: `L${laneIndex + 1}-B${bayIndex + 1}-STACK${layout.layers}`, status: 'schematic-accessories-hold',
    laneIndex, bayIndex, layers: layout.layers, bottom, top, bay: z2 - z1, frames: Object.freeze(frames), legs: Object.freeze(legs),
    braces: Object.freeze(braces), pins: Object.freeze(pins), locks: Object.freeze(locks),
    stackConnectors: Object.freeze(stackConnectors),
    displayCounts, accessories: ACCESSORY_VISUALS });
}
