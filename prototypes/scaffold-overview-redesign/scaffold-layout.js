// Nominal catalogue geometry only. No capacity, fit recommendation or BOQ authority.
export const FRAME_CATALOG = Object.freeze({
  id: 'FS-F1700-W1219-B1829', width: 1.219, height: 1.7, bay: 1.829,
  sourceUrl: 'https://www.futuresign.co.th/CatalogFS2023.pdf', sourcePage: 5,
  status: 'nominal-geometry-only', schematicTubeOD: 0.0427,
});

export function createScaffoldLayout(input) {
  const values = {};
  for (const [key, [min, max]] of Object.entries({width:[2,12],length:[2,12],height:[1.5,6],joistSpacing:[0.2,0.8],layers:[1,3]})) {
    const raw = input?.[key];
    const value = Number(raw);
    if ((typeof raw !== 'number' && typeof raw !== 'string') || String(raw).trim() === '' ||
        !Number.isFinite(value) || value < min || value > max || (key === 'layers' && !Number.isInteger(value))) {
      throw new RangeError(`Invalid illustrative geometry: ${key}`);
    }
    values[key] = value;
  }
  const {width, length, height, joistSpacing, layers} = values;
  const module = FRAME_CATALOG;
  // These offsets/gaps are illustration choices, NOT permissible jack extension,
  // insertion length, engineered lane spacing or verified effective stacking pitch.
  const laneGap = 0.15, baseOffset = 0.20, headOffset = 0.15, deckStack = 0.31;
  const laneCount = Math.floor((width - module.schematicTubeOD + laneGap) / (module.width + laneGap));
  const bayCount = Math.floor((length - module.schematicTubeOD) / module.bay);
  const occupiedX = laneCount * module.width + (laneCount - 1) * laneGap;
  const occupiedY = bayCount * module.bay;
  const edgeGapX = (width - occupiedX) / 2;
  const edgeGapY = (length - occupiedY) / 2;
  const lanes = Array.from({length:laneCount}, (_,index) => {
    const x1 = -occupiedX / 2 + index * (module.width + laneGap);
    return {index, x1, x2:x1 + module.width};
  });
  const stations = Array.from({length:bayCount + 1}, (_,i) => -occupiedY / 2 + i * module.bay);
  const frames = [], footPositions = [];
  for (const lane of lanes) for (const [station, z] of stations.entries()) {
    footPositions.push({x:lane.x1,z}, {x:lane.x2,z});
    for (let layer = 0; layer < layers; layer++) {
      const bottom = baseOffset + layer * module.height;
      frames.push({id:`L${lane.index+1}-S${station+1}-F${layer+1}`,lane:lane.index,station,layer,
        x1:lane.x1,x2:lane.x2,z,bottom,top:bottom + module.height});
    }
  }
  const frameStackHeight = layers * module.height;
  const nominalSlabTop = baseOffset + frameStackHeight + headOffset + deckStack;
  return {
    width,length,requestedSlabTop:height,joistSpacing,layers,module,deckStack,baseOffset,headOffset,
    frameStackHeight,nominalSlabTop,residualGap:height-nominalSlabTop,
    rawFrameResidual:height-deckStack-frameStackHeight,status:'HOLD',
    laneGap,edgeGapX,edgeGapY,lanes,stations,frames,footPositions,
    counts:{lanes:laneCount,bays:bayCount,frames:frames.length,legSegments:frames.length*2},
    brace:{pinLow:0.2405,pinHigh:1.4595,vertical:1.219,bay:1.829,nominalLength:2.198,drawnLength:Math.hypot(1.219,1.829)},
  };
}
