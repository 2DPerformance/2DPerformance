import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import {
  DEFAULT_SPREAD_FOOTING_DRAFT,
  createSpreadFootingSnapshot,
  selectSpreadFooting3DData,
} from './spread-footing-engine.mjs'
import {
  describeSpreadFootingSnapshot3D,
  initSpreadFootingSnapshot3D,
  initSpreadFootingSymbolicResponse3D,
  projectBarCutCenterline3D,
} from './spread-footing-snapshot-3d.mjs'

const approximatelyEqual = (actual, expected, tolerance = 1e-12) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `Expected ${actual} to be within ${tolerance} of ${expected}`
  )
}

const polylineLengthM = (polyline) => polyline.slice(1).reduce(
  (sum, point, index) => sum + Math.hypot(
    point.xMm - polyline[index].xMm,
    point.zMm - polyline[index].zMm
  ) / 1000,
  0
)

const defaultSnapshot = await createSpreadFootingSnapshot(
  DEFAULT_SPREAD_FOOTING_DRAFT,
  new Date('2026-07-29T06:00:00.000Z')
)
assert.equal(defaultSnapshot.ok, true)

const defaultProjection = selectSpreadFooting3DData(defaultSnapshot)
const defaultDescription = describeSpreadFootingSnapshot3D(defaultProjection.data)
const defaultBarCutA = defaultProjection.data.barCut.A
const defaultBarCutB = defaultProjection.data.barCut.B
assert.equal(defaultDescription.width, 1.5)
assert.equal(defaultDescription.length, 1.5)
assert.equal(defaultDescription.thickness, 0.3)
assert.equal(defaultDescription.columnWidth, 0.25)
assert.equal(defaultDescription.columnLength, 0.25)
assert.equal(defaultDescription.bars.A.mark, 'F01-A')
assert.equal(defaultDescription.bars.B.mark, 'F01-B')
assert.equal(defaultDescription.bars.A.count, 8)
assert.equal(defaultDescription.bars.B.count, 8)
assert.equal(defaultDescription.bars.A.diameterM, 0.016)
assert.equal(defaultDescription.bars.B.diameterM, 0.016)
assert.equal(defaultDescription.bars.A.topElevationM, 0.25)
assert.equal(defaultDescription.bars.B.topElevationM, 0.25)
assert.equal(defaultDescription.bars.A.bottomCenterElevationM, 0.058)
assert.equal(defaultDescription.bars.B.bottomCenterElevationM, 0.074)
assert.equal(defaultDescription.bars.A.centerlineRadiusM, defaultBarCutA.centerlineRadiusMm / 1000)
assert.equal(defaultDescription.bars.B.centerlineRadiusM, defaultBarCutB.centerlineRadiusMm / 1000)
assert.equal(defaultDescription.bars.A.centerlineLengthM, defaultBarCutA.centerlineLengthMm / 1000)
assert.equal(defaultDescription.bars.B.centerlineLengthM, defaultBarCutB.centerlineLengthMm / 1000)
assert.deepEqual(defaultDescription.bars.A.polylineMm, defaultBarCutA.polylineMm)
assert.deepEqual(defaultDescription.bars.B.polylineMm, defaultBarCutB.polylineMm)

const projectedA = projectBarCutCenterline3D(
  defaultProjection.data.reinforcement.A.planCenterlines[0],
  defaultBarCutA,
  { direction: 'A', mark: defaultBarCutA.mark }
)
assert.equal(projectedA.geometrySource, 'barCut.polylineMm')
assert.equal(projectedA.mark, 'F01-A')
assert.equal(projectedA.points.length, defaultBarCutA.polylineMm.length)
assert.deepEqual(projectedA.points[0], {
  xM: -0.692,
  yM: 0.25,
  zM: -0.692,
})
approximatelyEqual(projectedA.points.at(-1).xM, 0.692)
approximatelyEqual(projectedA.points.at(-1).yM, 0.25)
approximatelyEqual(projectedA.points.at(-1).zM, -0.692)
approximatelyEqual(projectedA.planLengthM, 1.384)
approximatelyEqual(projectedA.centerlineRadiusM, defaultBarCutA.centerlineRadiusMm / 1000)
approximatelyEqual(projectedA.centerlineLengthM, defaultBarCutA.centerlineLengthMm / 1000)
approximatelyEqual(projectedA.polylineLengthM, polylineLengthM(defaultBarCutA.polylineMm))
defaultBarCutA.polylineMm.forEach((point, index) => {
  approximatelyEqual(projectedA.points[index].yM, point.zMm / 1000)
  approximatelyEqual(projectedA.points[index].xM, point.xMm / 1000 - 0.75)
})

const changedSnapshot = await createSpreadFootingSnapshot({
  ...DEFAULT_SPREAD_FOOTING_DRAFT,
  footingX: 1.8,
  footingY: 1.6,
  columnX: 30,
  columnY: 35,
  barsA: 10,
  barsB: 9,
  barDiaA: 'DB20',
  barDiaB: 'DB12',
})
assert.equal(changedSnapshot.ok, true)
const changedDescription = describeSpreadFootingSnapshot3D(
  selectSpreadFooting3DData(changedSnapshot).data
)
assert.equal(changedDescription.width, 1.8)
assert.equal(changedDescription.length, 1.6)
assert.equal(changedDescription.columnWidth, 0.3)
assert.ok(Math.abs(changedDescription.columnLength - 0.35) < 1e-12)
assert.equal(changedDescription.bars.A.count, 10)
assert.equal(changedDescription.bars.B.count, 9)
assert.equal(changedDescription.bars.A.diameterM, 0.02)
assert.equal(changedDescription.bars.B.diameterM, 0.012)
assert.equal(
  changedDescription.bars.A.centerlineRadiusM,
  selectSpreadFooting3DData(changedSnapshot).data.barCut.A.centerlineRadiusMm / 1000
)
assert.equal(
  changedDescription.bars.B.centerlineRadiusM,
  selectSpreadFooting3DData(changedSnapshot).data.barCut.B.centerlineRadiusMm / 1000
)
assert.equal(
  changedDescription.bars.A.projectedCenterlines[0].points.length,
  selectSpreadFooting3DData(changedSnapshot).data.barCut.A.polylineMm.length
)

const dynamicMarkModel = structuredClone(defaultProjection.data)
dynamicMarkModel.reinforcement.A.mark = 'FT-OWNER-A'
dynamicMarkModel.barCut.A.mark = 'FT-OWNER-A'
dynamicMarkModel.reinforcement.A.planCenterlines.forEach((centerline, index) => {
  centerline.mark = 'FT-OWNER-A'
  centerline.id = `FT-OWNER-A-${String(index + 1).padStart(2, '0')}`
})
const dynamicMarkDescription = describeSpreadFootingSnapshot3D(dynamicMarkModel)
assert.equal(dynamicMarkDescription.bars.A.mark, 'FT-OWNER-A')
assert.equal(dynamicMarkDescription.bars.A.projectedCenterlines[0].mark, 'FT-OWNER-A')
assert.equal(dynamicMarkDescription.bars.A.projectedCenterlines[0].id, 'FT-OWNER-A-01')
assert.equal(dynamicMarkDescription.bars.A.projectedCenterlines[0].geometrySource, 'barCut.polylineMm')

assert.throws(
  () => describeSpreadFootingSnapshot3D({ geometry: {}, reinforcement: {}, barCut: {} }),
  /3D result is missing/
)
assert.equal(typeof initSpreadFootingSnapshot3D, 'function')
assert.equal(typeof initSpreadFootingSymbolicResponse3D, 'function')

const source = await readFile(new URL('./spread-footing-snapshot-3d.mjs', import.meta.url), 'utf8')
assert.doesNotMatch(source, /FOOTING_REFERENCE_GEOMETRY/)
assert.doesNotMatch(source, /CatmullRomCurve3/)
assert.match(source, /barCut\.polylineMm/)
assert.match(source, /new THREE\.CurvePath/)
assert.match(source, /new THREE\.LineCurve3/)
assert.match(source, /data-snapshot-3d/)
assert.match(source, /WEBGL_OR_SNAPSHOT_MODEL_UNAVAILABLE/)
assert.match(source, /ไม่มีผลการทรุดตัว/)
assert.match(source, /const setView = \(view\)/)
assert.match(source, /const setLayer = \(layer, visible\)/)
assert.match(source, /const setDisplayMode = \(mode\)/)
assert.match(source, /softenLayer\('concrete', 0\.25\)/)
assert.match(source, /พิกัดเหล็ก ระยะหุ้ม และความลึกประสิทธิผลไม่เปลี่ยน/)
assert.match(source, /const selectLayer = \(layer\)/)
assert.match(source, /snapshot-critical-perimeter/)
assert.match(source, /snapshot-dimension-guides/)
assert.match(source, /const createDimensionLabelSprite/)
assert.match(source, /snapshot-dimension-label-a/)
assert.match(source, /snapshot-dimension-label-b/)
assert.match(source, /snapshot-dimension-label-t/)
assert.match(source, /snapshot-dimension-label-column/)
assert.match(source, /text: `A \/ X = \$\{formatDimensionM\(width\)\} m`/)
assert.match(source, /text: `B \/ Y = \$\{formatDimensionM\(length\)\} m`/)
assert.match(source, /material\.map\?\.dispose\?\.\(\)/)
assert.match(source, /container\.classList\.add\('is-webgl-loading'\)/)
assert.match(source, /fallback\?\.removeAttribute\('hidden'\)/)
assert.match(source, /spread-footing-symbolic-response/)
assert.match(source, /visualizationScope: 'symbolic-only'/)
assert.match(source, /evaluation: 'NOT_EVALUATED'/)
assert.match(source, /visualScale: 'NTS'/)
assert.match(source, /displacementResult: null/)
assert.match(source, /soilStiffnessResult: null/)
assert.match(source, /data-symbolic-3d-replay/)
assert.match(source, /prefers-reduced-motion: reduce/)
assert.match(source, /const replay = \(\) =>/)
assert.match(source, /responseStartedAt\) \/ 760/)
assert.match(source, /ภาพปลายทางเชิงสัญลักษณ์/)
assert.match(source, /ไม่ใช่ผล critical หรือ deformation/)
assert.match(source, /vertexColors: true/)
assert.match(source, /const colorEmphasis = progress < 0\.18/)
assert.match(source, /progress < 0\.72/)
assert.match(source, /Blue → Cyan → Amber → Red/)
const symbolicSceneSource = source.slice(
  source.indexOf('const createSymbolicResponseScene'),
  source.indexOf('export async function initSpreadFootingSymbolicResponse3D')
)
assert.doesNotMatch(
  symbolicSceneSource,
  /columnReactionKN|netPressure|qnet|soilModulus|springConstant|settlementMm|displacementMm/,
  'symbolic 3D geometry must not derive a deformation shape from unevaluated engineering values'
)
assert.ok(
  source.indexOf("fallback?.setAttribute('hidden', '')")
    < source.indexOf("await import('/vendor/three/three.module.js')"),
  'SVG fallback must be hidden before the asynchronous WebGL module import can paint'
)

console.log('Spread footing snapshot 3D: PASS')
console.log('  Geometry/rebar: plan centerlines + barCut.polylineMm, Rcl, Lcl and dynamic marks')
console.log('  Controls: snapshot view/layer/display-mode/selection API plus dimensions attached to 3D guides')
console.log('  Safety: Snapshot trace gate, SVG fallback, no displacement claim')
