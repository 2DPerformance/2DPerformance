const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value))

const finiteNumber = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

const requirePositive = (value, label) => {
  const number = finiteNumber(value, NaN)
  if (!(number > 0)) throw new TypeError(`3D result is missing ${label}`)
  return number
}

const getDirection = (record, direction) =>
  record?.[direction] || record?.[direction.toLowerCase()] || {}

const pressureValue = (corner) =>
  finiteNumber(corner?.pressureKPa ?? corner?.value ?? corner, 0)

const makePressureColor = (THREE, value, minimum, maximum) => {
  const range = Math.max(maximum - minimum, Number.EPSILON)
  const ratio = clamp((value - minimum) / range, 0, 1)
  return new THREE.Color().setHSL(0.61 - 0.58 * ratio, 0.82, 0.49)
}

const addBoxEdges = (THREE, group, geometry, color, opacity = 1) => {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity })
  )
  group.add(edges)
  return edges
}

const formatDimensionM = (value) =>
  Number(value).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  })

const drawRoundedLabel = (context, width, height, radius) => {
  context.beginPath()
  context.moveTo(radius, 1)
  context.lineTo(width - radius, 1)
  context.quadraticCurveTo(width - 1, 1, width - 1, radius)
  context.lineTo(width - 1, height - radius)
  context.quadraticCurveTo(width - 1, height - 1, width - radius, height - 1)
  context.lineTo(radius, height - 1)
  context.quadraticCurveTo(1, height - 1, 1, height - radius)
  context.lineTo(1, radius)
  context.quadraticCurveTo(1, 1, radius, 1)
  context.closePath()
}

const createDimensionLabelSprite = (
  THREE,
  documentRef,
  { name, dimension, text, valueM, color = '#183d5c', worldHeight = 0.16 }
) => {
  const canvas = documentRef.createElement('canvas')
  canvas.height = 96
  let context = canvas.getContext('2d')
  if (!context) throw new TypeError('3D dimension label canvas is unavailable')
  context.font = '700 44px "Sarabun", Tahoma, sans-serif'
  canvas.width = Math.round(clamp(context.measureText(text).width + 76, 320, 960))
  context = canvas.getContext('2d')
  context.font = '700 44px "Sarabun", Tahoma, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  drawRoundedLabel(context, canvas.width, canvas.height, 12)
  context.fillStyle = 'rgba(248, 250, 252, 0.96)'
  context.fill()
  context.lineWidth = 3
  context.strokeStyle = '#9fb7cd'
  context.stroke()
  context.fillStyle = color
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.name = name
  sprite.renderOrder = 20
  sprite.scale.set(worldHeight * (canvas.width / canvas.height), worldHeight, 1)
  sprite.userData = { dimension, text, valueM, source: 'design-input' }
  return sprite
}

const createSnapshotDimensionGuides = (
  THREE,
  documentRef,
  { width, length, thickness, columnWidth, columnLength, columnHeight }
) => {
  const group = new THREE.Group()
  group.name = 'snapshot-dimension-guides'
  group.userData = {
    source: 'design-input',
    width,
    length,
    thickness,
    columnWidth,
    columnLength,
  }
  const margin = Math.max(width, length) * 0.075 + 0.045
  const tick = Math.max(width, length) * 0.025
  const elevation = -0.075
  const points = []
  const segment = (first, second) => points.push(
    new THREE.Vector3(...first),
    new THREE.Vector3(...second)
  )

  const halfWidth = width / 2
  const halfLength = length / 2
  const aLineZ = halfLength + margin
  segment([-halfWidth, elevation, halfLength], [-halfWidth, elevation, aLineZ])
  segment([halfWidth, elevation, halfLength], [halfWidth, elevation, aLineZ])
  segment([-halfWidth, elevation, aLineZ], [halfWidth, elevation, aLineZ])
  segment([-halfWidth, elevation, aLineZ - tick], [-halfWidth, elevation, aLineZ + tick])
  segment([halfWidth, elevation, aLineZ - tick], [halfWidth, elevation, aLineZ + tick])

  const bLineX = halfWidth + margin
  segment([halfWidth, elevation, -halfLength], [bLineX, elevation, -halfLength])
  segment([halfWidth, elevation, halfLength], [bLineX, elevation, halfLength])
  segment([bLineX, elevation, -halfLength], [bLineX, elevation, halfLength])
  segment([bLineX - tick, elevation, -halfLength], [bLineX + tick, elevation, -halfLength])
  segment([bLineX - tick, elevation, halfLength], [bLineX + tick, elevation, halfLength])

  const tLineX = -halfWidth - margin
  const tLineZ = halfLength + margin * 0.35
  segment([-halfWidth, 0, halfLength], [tLineX, 0, tLineZ])
  segment([-halfWidth, thickness, halfLength], [tLineX, thickness, tLineZ])
  segment([tLineX, 0, tLineZ], [tLineX, thickness, tLineZ])
  segment([tLineX - tick, 0, tLineZ], [tLineX + tick, 0, tLineZ])
  segment([tLineX - tick, thickness, tLineZ], [tLineX + tick, thickness, tLineZ])

  const columnLeadStart = [columnWidth / 2, thickness + columnHeight * 0.58, -columnLength / 2]
  const columnLeadEnd = [
    columnWidth / 2 + margin * 1.28,
    thickness + columnHeight * 0.78,
    -columnLength / 2 - margin * 0.48,
  ]
  segment(columnLeadStart, columnLeadEnd)

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const guides = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.82 })
  )
  guides.name = 'snapshot-dimension-lines'
  guides.userData = { A: width, B: length, t: thickness, columnA: columnWidth, columnB: columnLength }
  group.add(guides)

  const labels = [
    {
      name: 'snapshot-dimension-label-a',
      dimension: 'footing-a',
      text: `A / X = ${formatDimensionM(width)} m`,
      valueM: width,
      color: '#c2410c',
      position: [0, elevation + 0.035, aLineZ + margin * 0.62],
    },
    {
      name: 'snapshot-dimension-label-b',
      dimension: 'footing-b',
      text: `B / Y = ${formatDimensionM(length)} m`,
      valueM: length,
      color: '#0f766e',
      position: [bLineX + margin * 0.72, elevation + 0.035, 0],
    },
    {
      name: 'snapshot-dimension-label-t',
      dimension: 'footing-t',
      text: `t = ${formatDimensionM(thickness)} m`,
      valueM: thickness,
      position: [tLineX + margin * 0.3, thickness / 2, tLineZ + margin * 0.1],
    },
    {
      name: 'snapshot-dimension-label-column',
      dimension: 'column-a-b',
      text: `เสา a × b ${formatDimensionM(columnWidth)} × ${formatDimensionM(columnLength)} m`,
      valueM: [columnWidth, columnLength],
      color: '#6d28d9',
      worldHeight: 0.13,
      position: [columnLeadEnd[0] + margin * 0.82, columnLeadEnd[1], columnLeadEnd[2]],
    },
  ]
  for (const label of labels) {
    const sprite = createDimensionLabelSprite(THREE, documentRef, label)
    sprite.position.set(...label.position)
    group.add(sprite)
  }
  group.userData.labels = labels.map(({ dimension, text, valueM }) => ({ dimension, text, valueM }))
  return group
}

const BAR_GEOMETRY_TOLERANCE_M = 1e-6

const requireFiniteCoordinate = (value, label) => {
  const number = finiteNumber(value, NaN)
  if (!Number.isFinite(number)) throw new TypeError(`3D result is missing ${label}`)
  return number
}

const distance3D = (first, second) =>
  Math.hypot(
    second.xM - first.xM,
    second.yM - first.yM,
    second.zM - first.zM
  )

export function projectBarCutCenterline3D(centerline, cut, context = {}) {
  const start = centerline?.start
  const end = centerline?.end
  const label = context.direction ? `reinforcement.${context.direction}` : 'reinforcement'
  if (!start || !end) throw new TypeError(`3D result is missing ${label}.planCenterline`)

  const startPlanX = requireFiniteCoordinate(start.xM, `${label}.start.xM`)
  const startPlanY = requireFiniteCoordinate(start.yM, `${label}.start.yM`)
  const endPlanX = requireFiniteCoordinate(end.xM, `${label}.end.xM`)
  const endPlanY = requireFiniteCoordinate(end.yM, `${label}.end.yM`)
  const startElevationM = requireFiniteCoordinate(start.zM, `${label}.start.zM`)
  const endElevationM = requireFiniteCoordinate(end.zM, `${label}.end.zM`)
  const polylineMm = Array.isArray(cut?.polylineMm) ? cut.polylineMm : []
  if (polylineMm.length < 2) {
    throw new TypeError(`3D result is missing barCut.${context.direction || '?'}.polylineMm`)
  }
  const profile = polylineMm.map((point, index) => Object.freeze({
    xMm: requireFiniteCoordinate(
      point?.xMm,
      `barCut.${context.direction || '?'}.polylineMm[${index}].xMm`
    ),
    zMm: requireFiniteCoordinate(
      point?.zMm,
      `barCut.${context.direction || '?'}.polylineMm[${index}].zMm`
    ),
  }))
  const firstProfileX = profile[0].xMm
  const lastProfileX = profile.at(-1).xMm
  const horizontalProfileLengthM = (lastProfileX - firstProfileX) / 1000
  if (!(horizontalProfileLengthM > 0)) {
    throw new TypeError(`3D result has invalid barCut.${context.direction || '?'}.polylineMm`)
  }

  const planDeltaX = endPlanX - startPlanX
  const planDeltaY = endPlanY - startPlanY
  const planLengthM = Math.hypot(planDeltaX, planDeltaY)
  if (!(planLengthM > 0)) {
    throw new TypeError(`3D result has invalid ${label}.planCenterline length`)
  }
  if (Math.abs(planLengthM - horizontalProfileLengthM) > BAR_GEOMETRY_TOLERANCE_M) {
    throw new TypeError(
      `3D result barCut.${context.direction || '?'} and plan centerline lengths do not match`
    )
  }

  const bottomCenterElevationM = requirePositive(
    cut?.bottomCenterElevationMm,
    `barCut.${context.direction || '?'}.bottomCenterElevationMm`
  ) / 1000
  const topCutEndElevationM = requirePositive(
    cut?.topCutEndElevationMm,
    `barCut.${context.direction || '?'}.topCutEndElevationMm`
  ) / 1000
  const centerlineRadiusM = requirePositive(
    cut?.centerlineRadiusMm,
    `barCut.${context.direction || '?'}.centerlineRadiusMm`
  ) / 1000
  const centerlineLengthM = requirePositive(
    cut?.centerlineLengthMm ?? finiteNumber(cut?.centerlineLengthM, NaN) * 1000,
    `barCut.${context.direction || '?'}.centerlineLengthMm`
  ) / 1000
  const profileBottomM = Math.min(...profile.map((point) => point.zMm)) / 1000
  const profileTopM = Math.max(...profile.map((point) => point.zMm)) / 1000
  if (
    Math.abs(startElevationM - bottomCenterElevationM) > BAR_GEOMETRY_TOLERANCE_M
    || Math.abs(endElevationM - bottomCenterElevationM) > BAR_GEOMETRY_TOLERANCE_M
    || Math.abs(profileBottomM - bottomCenterElevationM) > BAR_GEOMETRY_TOLERANCE_M
    || Math.abs(profileTopM - topCutEndElevationM) > BAR_GEOMETRY_TOLERANCE_M
  ) {
    throw new TypeError(
      `3D result barCut.${context.direction || '?'} elevations do not match the plan layer`
    )
  }

  const unitPlanX = planDeltaX / planLengthM
  const unitPlanY = planDeltaY / planLengthM
  const points = profile.map((point) => {
    const alongM = (point.xMm - firstProfileX) / 1000
    return Object.freeze({
      xM: startPlanX + unitPlanX * alongM,
      yM: point.zMm / 1000,
      zM: startPlanY + unitPlanY * alongM,
    })
  })
  const polylineLengthM = points
    .slice(1)
    .reduce((sum, point, index) => sum + distance3D(points[index], point), 0)
  return Object.freeze({
    id: centerline.id || '',
    mark: context.mark || cut?.mark || centerline.mark || '',
    direction: context.direction || cut?.direction || centerline.direction || '',
    geometrySource: 'barCut.polylineMm',
    centerlineRadiusM,
    centerlineLengthM,
    polylineLengthM,
    planLengthM,
    bottomCenterElevationM,
    topCutEndElevationM,
    points: Object.freeze(points),
  })
}

const createBarMesh = (THREE, projectedCenterline, diameterM, material) => {
  const curve = new THREE.CurvePath()
  const points = projectedCenterline.points.map(
    (point) => new THREE.Vector3(point.xM, point.yM, point.zM)
  )
  for (let index = 1; index < points.length; index += 1) {
    curve.add(new THREE.LineCurve3(points[index - 1], points[index]))
  }
  const tubularSegments = Math.max(48, (points.length - 1) * 6)
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, diameterM / 2, 8, false)
  const mesh = new THREE.Mesh(geometry, material)
  mesh.name = `${projectedCenterline.mark || 'rebar'}-${projectedCenterline.id || 'centerline'}`
  mesh.userData = {
    geometrySource: projectedCenterline.geometrySource,
    mark: projectedCenterline.mark,
    direction: projectedCenterline.direction,
    centerlineId: projectedCenterline.id,
    centerlineRadiusM: projectedCenterline.centerlineRadiusM,
    centerlineLengthM: projectedCenterline.centerlineLengthM,
    polylineLengthM: projectedCenterline.polylineLengthM,
  }
  mesh.castShadow = true
  return mesh
}

const createPressureField = (THREE, bearing, footingWidth, footingLength) => {
  const group = new THREE.Group()
  group.name = 'snapshot-bearing-field'
  const corners = Array.isArray(bearing?.corners) ? bearing.corners.slice(0, 4) : []
  const fallback = finiteNumber(bearing?.qMaxKPa ?? bearing?.qMinKPa, 0)
  const values = [0, 1, 2, 3].map((index) => pressureValue(corners[index] ?? fallback))
  const minimum = Math.min(...values)
  const maximum = Math.max(...values)
  const y = -0.035
  const positions = new Float32Array([
    -footingWidth / 2, y, -footingLength / 2,
     footingWidth / 2, y, -footingLength / 2,
     footingWidth / 2, y,  footingLength / 2,
    -footingWidth / 2, y,  footingLength / 2,
  ])
  const colors = new Float32Array(12)
  values.forEach((value, index) => {
    const color = makePressureColor(THREE, value, minimum, maximum)
    color.toArray(colors, index * 3)
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  const plane = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    })
  )
  group.add(plane)
  addBoxEdges(
    THREE,
    group,
    new THREE.BoxGeometry(footingWidth, 0.008, footingLength),
    0xc2410c,
    0.9
  ).position.y = y

  const samples = Array.isArray(bearing?.pressureSamples) && bearing.pressureSamples.length
    ? bearing.pressureSamples
    : values.map((value, index) => ({
        xM: index === 0 || index === 3 ? -footingWidth / 2 : footingWidth / 2,
        yM: index < 2 ? -footingLength / 2 : footingLength / 2,
        pressureKPa: value,
      }))
  const maximumMagnitude = Math.max(...samples.map((sample) => Math.abs(pressureValue(sample))), 1)
  for (const sample of samples.slice(0, 16)) {
    const value = pressureValue(sample)
    const length = 0.10 + 0.13 * Math.abs(value) / maximumMagnitude
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(finiteNumber(sample.xM), y - 0.18, finiteNumber(sample.yM)),
      length,
      makePressureColor(THREE, value, minimum, maximum),
      0.045,
      0.025
    )
    group.add(arrow)
  }
  return group
}

export function describeSpreadFootingSnapshot3D(model) {
  const geometryModel = model?.geometry || {}
  const footing = geometryModel.footing || {}
  const column = geometryModel.column || {}
  const reinforcement = model?.reinforcement || {}
  const barCut = model?.barCut || {}
  const punching = model?.punching || {}
  const width = requirePositive(footing.xM, 'footing.xM')
  const length = requirePositive(footing.yM, 'footing.yM')
  const thickness = requirePositive(footing.thicknessM, 'footing.thicknessM')
  const columnWidth = requirePositive(column.xM, 'column.xM')
  const columnLength = requirePositive(column.yM, 'column.yM')
  const bars = {}
  for (const direction of ['A', 'B']) {
    const bar = getDirection(reinforcement, direction)
    const cut = getDirection(barCut, direction)
    const mark = cut.mark || bar.mark || `F01-${direction}`
    const planCenterlines = Array.isArray(bar.planCenterlines) ? bar.planCenterlines : []
    const projectedCenterlines = planCenterlines.map((centerline, index) =>
      projectBarCutCenterline3D(centerline, cut, { direction, mark, index })
    )
    bars[direction] = Object.freeze({
      mark,
      count: planCenterlines.length,
      diameterM: requirePositive(bar.diameterMm, `reinforcement.${direction}.diameterMm`) / 1000,
      centerlineRadiusM: requirePositive(
        cut.centerlineRadiusMm,
        `barCut.${direction}.centerlineRadiusMm`
      ) / 1000,
      centerlineLengthM: requirePositive(
        cut.centerlineLengthMm ?? finiteNumber(cut.centerlineLengthM, NaN) * 1000,
        `barCut.${direction}.centerlineLengthMm`
      ) / 1000,
      bottomCenterElevationM: requirePositive(
        cut.bottomCenterElevationMm,
        `barCut.${direction}.bottomCenterElevationMm`
      ) / 1000,
      topElevationM: requirePositive(
        cut.topCutEndElevationMm,
        `barCut.${direction}.topCutEndElevationMm`
      ) / 1000,
      planCenterlines,
      polylineMm: Object.freeze(
        (Array.isArray(cut.polylineMm) ? cut.polylineMm : []).map((point) =>
          Object.freeze({
            xMm: requireFiniteCoordinate(point?.xMm, `barCut.${direction}.polylineMm.xMm`),
            zMm: requireFiniteCoordinate(point?.zMm, `barCut.${direction}.polylineMm.zMm`),
          })
        )
      ),
      projectedCenterlines: Object.freeze(projectedCenterlines),
    })
  }
  return Object.freeze({
    geometryModel,
    footing,
    column,
    reinforcement,
    punching,
    bearing: model?.bearing || {},
    width,
    length,
    thickness,
    columnWidth,
    columnLength,
    bars: Object.freeze(bars),
  })
}

const createSnapshotScene = (THREE, model, documentRef) => {
  const description = describeSpreadFootingSnapshot3D(model)
  const {
    footing,
    column,
    reinforcement,
    barCut,
    punching,
    width,
    length,
    thickness,
    columnWidth,
    columnLength,
    bars,
  } = description
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xeaf1f7)
  scene.fog = new THREE.Fog(0xeaf1f7, 5.5, 9)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x60758a, 1.6))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.1)
  keyLight.position.set(3.5, 5.2, 4.2)
  keyLight.castShadow = true
  scene.add(keyLight)

  const root = new THREE.Group()
  root.name = 'spread-footing-calculation-snapshot'
  scene.add(root)
  const layers = {
    concrete: [],
    barA: [],
    barB: [],
    dowel: [],
    critical: [],
    pressure: [],
    soil: [],
  }

  const footingGeometry = new THREE.BoxGeometry(width, thickness, length)
  const footingMesh = new THREE.Mesh(
    footingGeometry,
    new THREE.MeshPhysicalMaterial({
      color: 0xcbd7e2,
      transparent: true,
      opacity: 0.42,
      roughness: 0.72,
      metalness: 0,
      depthWrite: false,
    })
  )
  footingMesh.position.y = thickness / 2
  footingMesh.receiveShadow = true
  root.add(footingMesh)
  layers.concrete.push(footingMesh)
  const footingEdges = addBoxEdges(THREE, root, footingGeometry, 0x31475b, 0.95)
  footingEdges.position.y = thickness / 2
  layers.concrete.push(footingEdges)

  const columnHeight = Math.max(thickness * 2.3, 0.65)
  const columnGeometry = new THREE.BoxGeometry(columnWidth, columnHeight, columnLength)
  const columnGroup = new THREE.Group()
  columnGroup.position.set(
    finiteNumber(column.offsetXM),
    thickness + columnHeight / 2,
    finiteNumber(column.offsetYM)
  )
  const columnMesh = new THREE.Mesh(
    columnGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xdbe4ec,
      transparent: true,
      opacity: 0.72,
      roughness: 0.75,
    })
  )
  columnMesh.castShadow = true
  columnGroup.add(columnMesh)
  addBoxEdges(THREE, columnGroup, columnGeometry, 0x31475b)
  root.add(columnGroup)
  layers.concrete.push(columnGroup)

  const barMaterials = {
    A: new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.46, metalness: 0.12 }),
    B: new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.46, metalness: 0.12 }),
  }
  for (const direction of ['A', 'B']) {
    const barGroup = new THREE.Group()
    barGroup.name = `rebar-${bars[direction].mark}`
    barGroup.userData = {
      mark: bars[direction].mark,
      direction,
      geometrySource: 'barCut.polylineMm',
      centerlineRadiusM: bars[direction].centerlineRadiusM,
      centerlineLengthM: bars[direction].centerlineLengthM,
    }
    for (const projectedCenterline of bars[direction].projectedCenterlines) {
      const mesh = createBarMesh(
        THREE,
        projectedCenterline,
        bars[direction].diameterM,
        barMaterials[direction]
      )
      barGroup.add(mesh)
    }
    root.add(barGroup)
    layers[`bar${direction}`].push(barGroup)
  }

  const criticalX = finiteNumber(punching?.criticalDimensionsM?.xM)
  const criticalY = finiteNumber(punching?.criticalDimensionsM?.yM)
  if (criticalX > 0 && criticalY > 0) {
    const halfX = criticalX / 2
    const halfY = criticalY / 2
    const points = [
      new THREE.Vector3(-halfX, thickness + 0.008, -halfY),
      new THREE.Vector3(halfX, thickness + 0.008, -halfY),
      new THREE.Vector3(halfX, thickness + 0.008, halfY),
      new THREE.Vector3(-halfX, thickness + 0.008, halfY),
    ]
    const criticalLoop = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineDashedMaterial({ color: 0x7c3aed, dashSize: 0.045, gapSize: 0.025 })
    )
    criticalLoop.name = 'snapshot-critical-perimeter'
    root.add(criticalLoop)
    criticalLoop.computeLineDistances?.()
    layers.critical.push(criticalLoop)
  }

  const bearingField = createPressureField(THREE, description.bearing, width, length)
  root.add(bearingField)
  layers.pressure.push(bearingField)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(Math.max(width, length) * 3.2, Math.max(width, length) * 3.2),
    new THREE.MeshStandardMaterial({ color: 0xdbe5ee, roughness: 1 })
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.24
  ground.receiveShadow = true
  root.add(ground)
  layers.soil.push(ground)

  root.add(
    createSnapshotDimensionGuides(THREE, documentRef, {
      width,
      length,
      thickness,
      columnWidth,
      columnLength,
      columnHeight,
    })
  )

  return {
    scene,
    root,
    layers,
    bounds: { width, length, thickness, columnWidth, columnLength, columnHeight },
  }
}

export async function initSpreadFootingSnapshot3D({ container, canvas, snapshot, model }) {
  if (!(container instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
    return Object.freeze({ ready: false, reason: 'MISSING_CONTAINER_OR_CANVAS' })
  }
  const fallback = container.querySelector('[data-snapshot-3d-fallback]')
  container.classList.remove('is-webgl-ready')
  container.classList.add('is-webgl-loading')
  container.setAttribute('aria-busy', 'true')
  canvas.hidden = true
  canvas.tabIndex = -1
  canvas.setAttribute('aria-hidden', 'true')
  fallback?.setAttribute('hidden', '')
  const failClosed = (reason) => {
    container.classList.remove('is-webgl-ready', 'is-webgl-loading')
    container.setAttribute('aria-busy', 'false')
    canvas.hidden = true
    canvas.tabIndex = -1
    canvas.setAttribute('aria-hidden', 'true')
    fallback?.removeAttribute('hidden')
    return Object.freeze({ ready: false, reason })
  }

  try {
    if (!snapshot?.id || canvas.dataset.snapshotId !== snapshot.id) {
      return failClosed('SNAPSHOT_TRACE_MISMATCH')
    }
    const THREE = await import('/vendor/three/three.module.js')
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace
    }
    const { scene, root, layers, bounds } = createSnapshotScene(
      THREE,
      model,
      canvas.ownerDocument || document
    )
    const camera = new THREE.PerspectiveCamera(38, 1, 0.03, 50)
    const fittedRadius = Math.max(bounds.width, bounds.length) * 2.78
    const orbit = {
      theta: 0.82,
      phi: 0.62,
      radius: fittedRadius,
      targetY: bounds.thickness * 0.42,
    }
    const pointer = { active: false, x: 0, y: 0 }
    let frame = 0
    let disposed = false
    let displayMode = 'overview'

    let status = container.querySelector('[data-snapshot-3d-status]')
    if (!status) {
      status = document.createElement('p')
      status.setAttribute('data-snapshot-3d-status', '')
      status.className = 'sf-snapshot-3d-status'
      status.id = `snapshot-3d-status-${snapshot.id.replace(/[^a-z0-9_-]/gi, '-')}`
      status.textContent = 'ภาพรวม · ลากเพื่อหมุน · ล้อเมาส์เพื่อซูม · ปุ่มลูกศรเพื่อหมุน · 0 เพื่อจัดภาพ · ไม่มีผลการทรุดตัว'
      container.append(status)
    }
    canvas.setAttribute('aria-describedby', status.id)

    const materialState = new WeakMap()
    const rememberMaterial = (material) => {
      if (!material || materialState.has(material)) return
      materialState.set(material, {
        opacity: material.opacity,
        transparent: material.transparent,
        depthWrite: material.depthWrite,
      })
    }
    scene.traverse((object) => {
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach(rememberMaterial)
    })
    const visitLayerMaterials = (layer, visitor) => {
      const visited = new Set()
      for (const object of layers[layer] || []) {
        object.traverse?.((child) => {
          const materials = Array.isArray(child.material) ? child.material : [child.material]
          materials.filter(Boolean).forEach((material) => {
            if (visited.has(material)) return
            visited.add(material)
            visitor(material, materialState.get(material))
          })
        })
      }
    }
    const restoreMaterials = () => {
      scene.traverse((object) => {
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.filter(Boolean).forEach((material) => {
          const original = materialState.get(material)
          if (!original) return
          material.opacity = original.opacity
          material.transparent = original.transparent
          material.depthWrite = original.depthWrite
          material.needsUpdate = true
        })
      })
    }
    const softenLayer = (layer, opacityFactor) => {
      visitLayerMaterials(layer, (material, original) => {
        if (!original) return
        material.opacity = clamp(original.opacity * opacityFactor, 0.04, 0.95)
        material.transparent = true
        material.depthWrite = false
        material.needsUpdate = true
      })
    }

    const updateCamera = () => {
      const horizontal = orbit.radius * Math.cos(orbit.phi)
      camera.position.set(
        horizontal * Math.sin(orbit.theta),
        orbit.radius * Math.sin(orbit.phi) + orbit.targetY,
        horizontal * Math.cos(orbit.theta)
      )
      camera.lookAt(0, orbit.targetY, 0)
    }
    const resize = () => {
      if (disposed) return
      const width = Math.max(320, container.clientWidth)
      const height = Math.max(360, Math.min(560, Math.round(width * 0.62)))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const render = () => {
      frame = 0
      if (disposed) return
      resize()
      updateCamera()
      renderer.render(scene, camera)
    }
    const scheduleRender = () => {
      if (!frame && !disposed) frame = requestAnimationFrame(render)
    }
    const fit = () => {
      orbit.theta = 0.82
      orbit.phi = 0.62
      orbit.radius = fittedRadius
      orbit.targetY = bounds.thickness * 0.42
      scheduleRender()
    }
    const setView = (view) => {
      const views = {
        iso: { theta: 0.82, phi: 0.62 },
        top: { theta: 0, phi: Math.PI / 2 - 0.025 },
        front: { theta: 0, phi: 0.025 },
        right: { theta: Math.PI / 2, phi: 0.025 },
      }
      const next = views[view]
      if (!next) return false
      orbit.theta = next.theta
      orbit.phi = next.phi
      orbit.radius = fittedRadius
      orbit.targetY = bounds.thickness * 0.42
      scheduleRender()
      return true
    }
    const setLayer = (layer, visible) => {
      const objects = layers[layer]
      if (!Array.isArray(objects)) return false
      for (const object of objects) object.visible = Boolean(visible)
      scheduleRender()
      return true
    }
    const setDisplayMode = (mode) => {
      const nextMode = mode === 'rebar' ? 'rebar' : 'overview'
      displayMode = nextMode
      restoreMaterials()
      if (nextMode === 'rebar') {
        softenLayer('concrete', 0.25)
        softenLayer('soil', 0.18)
        softenLayer('pressure', 0.22)
        softenLayer('critical', 0.55)
        status.textContent = 'เปิดชั้นเหล็ก · ลดความทึบวัสดุรอบข้างเท่านั้น · พิกัดเหล็ก ระยะหุ้ม และความลึกประสิทธิผลไม่เปลี่ยน'
      } else {
        status.textContent = 'ภาพรวม · ลากเพื่อหมุน · ล้อเมาส์เพื่อซูม · ปุ่มลูกศรเพื่อหมุน · 0 เพื่อจัดภาพ · ไม่มีผลการทรุดตัว'
      }
      container.dataset.modelDisplayMode = nextMode
      canvas.dataset.modelDisplayMode = nextMode
      scheduleRender()
      return true
    }
    const selectLayer = (layer) => {
      if (!Array.isArray(layers[layer])) return false
      canvas.dataset.selectedLayer = layer
      scheduleRender()
      return true
    }
    const onPointerDown = (event) => {
      pointer.active = true
      pointer.x = event.clientX
      pointer.y = event.clientY
      canvas.setPointerCapture?.(event.pointerId)
    }
    const onPointerMove = (event) => {
      if (!pointer.active) return
      orbit.theta -= (event.clientX - pointer.x) * 0.008
      orbit.phi = clamp(orbit.phi + (event.clientY - pointer.y) * 0.006, 0.16, 1.28)
      pointer.x = event.clientX
      pointer.y = event.clientY
      scheduleRender()
    }
    const onPointerUp = (event) => {
      pointer.active = false
      canvas.releasePointerCapture?.(event.pointerId)
    }
    const onWheel = (event) => {
      event.preventDefault()
      orbit.radius = clamp(orbit.radius * Math.exp(event.deltaY * 0.001), 1.5, 9)
      scheduleRender()
    }
    const onKeyDown = (event) => {
      const key = event.key
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '0'].includes(key)) return
      event.preventDefault()
      if (key === 'ArrowLeft') orbit.theta -= 0.12
      if (key === 'ArrowRight') orbit.theta += 0.12
      if (key === 'ArrowUp') orbit.phi = clamp(orbit.phi + 0.08, 0.16, 1.28)
      if (key === 'ArrowDown') orbit.phi = clamp(orbit.phi - 0.08, 0.16, 1.28)
      if (key === '+' || key === '=') orbit.radius = clamp(orbit.radius * 0.9, 1.5, 9)
      if (key === '-' || key === '_') orbit.radius = clamp(orbit.radius * 1.1, 1.5, 9)
      if (key === '0') return fit()
      scheduleRender()
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('keydown', onKeyDown)
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleRender) : null
    resizeObserver?.observe(container)

    canvas.hidden = false
    canvas.tabIndex = 0
    canvas.removeAttribute('aria-hidden')
    fallback?.setAttribute('hidden', '')
    container.classList.remove('is-webgl-loading')
    container.classList.add('is-webgl-ready')
    container.setAttribute('aria-busy', 'false')
    canvas.dataset.webglState = 'ready'
    setDisplayMode(displayMode)
    fit()

    const dispose = () => {
      if (disposed) return
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKeyDown)
      scene.traverse((object) => {
        object.geometry?.dispose?.()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials.filter(Boolean)) {
          material.map?.dispose?.()
          material.dispose?.()
        }
      })
      renderer.dispose()
      root.clear()
      container.classList.remove('is-webgl-ready', 'is-webgl-loading')
      container.setAttribute('aria-busy', 'false')
    }
    return Object.freeze({
      ready: true,
      fit,
      resize: scheduleRender,
      setView,
      setLayer,
      setDisplayMode,
      selectLayer,
      dispose,
    })
  } catch {
    return failClosed('WEBGL_OR_SNAPSHOT_MODEL_UNAVAILABLE')
  }
}

const symbolicShapeAt = ({ x, z, width, length, columnX, columnZ }) => {
  const edgeX = Math.max(0, 1 - Math.pow(Math.abs((2 * x) / width), 2))
  const edgeZ = Math.max(0, 1 - Math.pow(Math.abs((2 * z) / length), 2))
  const radiusX = Math.max(width * 0.38, Number.EPSILON)
  const radiusZ = Math.max(length * 0.38, Number.EPSILON)
  const distance = Math.pow((x - columnX) / radiusX, 2)
    + Math.pow((z - columnZ) / radiusZ, 2)
  return edgeX * edgeZ * (0.38 + 0.62 * Math.exp(-1.45 * distance))
}

const createSymbolicResponseGeometry = (
  THREE,
  { width, length, thickness, columnX, columnZ, visualAmplitude }
) => {
  const segmentsX = 20
  const segmentsZ = 18
  const rowSize = segmentsX + 1
  const layerSize = rowSize * (segmentsZ + 1)
  const positions = new Float32Array(layerSize * 2 * 3)
  const colors = new Float32Array(layerSize * 2 * 3)
  const shapeFactors = new Float32Array(layerSize)
  let maximumShape = Number.EPSILON

  for (let zIndex = 0; zIndex <= segmentsZ; zIndex += 1) {
    const z = -length / 2 + (length * zIndex) / segmentsZ
    for (let xIndex = 0; xIndex <= segmentsX; xIndex += 1) {
      const x = -width / 2 + (width * xIndex) / segmentsX
      const index = zIndex * rowSize + xIndex
      const shape = symbolicShapeAt({ x, z, width, length, columnX, columnZ })
      shapeFactors[index] = shape
      maximumShape = Math.max(maximumShape, shape)
      for (let layer = 0; layer < 2; layer += 1) {
        const vertex = (layer * layerSize + index) * 3
        positions[vertex] = x
        positions[vertex + 1] = layer === 0 ? 0 : -thickness
        positions[vertex + 2] = z
      }
    }
  }
  for (let index = 0; index < shapeFactors.length; index += 1) {
    shapeFactors[index] /= maximumShape
  }

  const indices = []
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
      const a = zIndex * rowSize + xIndex
      const b = a + 1
      const c = a + rowSize
      const d = c + 1
      indices.push(a, c, b, b, c, d)
      indices.push(layerSize + a, layerSize + b, layerSize + c)
      indices.push(layerSize + b, layerSize + d, layerSize + c)
    }
  }
  const sideQuad = (topA, topB) => {
    const bottomA = layerSize + topA
    const bottomB = layerSize + topB
    indices.push(topA, topB, bottomA, topB, bottomB, bottomA)
  }
  for (let xIndex = 0; xIndex < segmentsX; xIndex += 1) {
    sideQuad(xIndex, xIndex + 1)
    const back = segmentsZ * rowSize + xIndex
    sideQuad(back + 1, back)
  }
  for (let zIndex = 0; zIndex < segmentsZ; zIndex += 1) {
    const left = zIndex * rowSize
    sideQuad(left + rowSize, left)
    const right = zIndex * rowSize + segmentsX
    sideQuad(right, right + rowSize)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setIndex(indices)

  const baseTop = new THREE.Color(0xcbd7e1)
  const baseBottom = new THREE.Color(0xaebdca)
  const blue = new THREE.Color(0x2563a8)
  const cyan = new THREE.Color(0x0aa8c6)
  const amber = new THREE.Color(0xe38a22)
  const red = new THREE.Color(0xc92a2a)
  const highlight = new THREE.Color()
  const mixed = new THREE.Color()
  const updateHighlight = (shape) => {
    if (shape <= 0.42) return highlight.lerpColors(blue, cyan, shape / 0.42)
    if (shape <= 0.78) return highlight.lerpColors(cyan, amber, (shape - 0.42) / 0.36)
    return highlight.lerpColors(amber, red, (shape - 0.78) / 0.22)
  }
  const update = (factor, colorEmphasis = 0) => {
    const position = geometry.getAttribute('position')
    const color = geometry.getAttribute('color')
    const nextFactor = clamp(factor, 0, 1)
    const nextEmphasis = clamp(colorEmphasis, 0, 1)
    for (let index = 0; index < layerSize; index += 1) {
      const offset = -visualAmplitude * shapeFactors[index] * nextFactor
      position.setY(index, offset)
      position.setY(layerSize + index, offset - thickness)
      updateHighlight(shapeFactors[index])
      // Keep the complete visual spectrum legible while the one-shot response
      // plays. The floor is presentation-only: it does not represent a demand,
      // displacement, contour interval, or engineering acceptance threshold.
      const intensity = nextEmphasis * (0.24 + 0.76 * Math.pow(shapeFactors[index], 1.12))
      mixed.copy(baseTop).lerp(highlight, intensity)
      color.setXYZ(index, mixed.r, mixed.g, mixed.b)
      mixed.copy(baseBottom).lerp(highlight, intensity * 0.48)
      color.setXYZ(layerSize + index, mixed.r, mixed.g, mixed.b)
    }
    position.needsUpdate = true
    color.needsUpdate = true
    geometry.computeVertexNormals()
    geometry.computeBoundingSphere()
  }
  update(0, 0)
  return { geometry, update, shapeFactors, segmentsX, segmentsZ, rowSize }
}

const createSymbolicSurfaceGrid = (
  THREE,
  { width, length, columnX, columnZ, visualAmplitude, lines = 7, samples = 36 }
) => {
  const group = new THREE.Group()
  group.name = 'symbolic-response-grid'
  const records = []
  const material = new THREE.LineBasicMaterial({
    color: 0x305f87,
    transparent: true,
    opacity: 0.64,
  })
  const createLine = (axis, fixed) => {
    const positions = new Float32Array((samples + 1) * 3)
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    const line = new THREE.Line(geometry, material)
    line.userData = { axis, fixed, source: 'symbolic-only' }
    group.add(line)
    records.push({ axis, fixed, geometry })
  }
  for (let index = 0; index < lines; index += 1) {
    const ratio = lines === 1 ? 0.5 : index / (lines - 1)
    createLine('x', -length / 2 + length * ratio)
    createLine('z', -width / 2 + width * ratio)
  }
  const update = (factor) => {
    for (const record of records) {
      const position = record.geometry.getAttribute('position')
      for (let index = 0; index <= samples; index += 1) {
        const ratio = index / samples
        const x = record.axis === 'x' ? -width / 2 + width * ratio : record.fixed
        const z = record.axis === 'x' ? record.fixed : -length / 2 + length * ratio
        const shape = symbolicShapeAt({ x, z, width, length, columnX, columnZ })
        position.setXYZ(index, x, -visualAmplitude * shape * factor + 0.006, z)
      }
      position.needsUpdate = true
      record.geometry.computeBoundingSphere()
    }
  }
  update(0)
  return { group, update }
}

const createSymbolicResponseScene = (THREE, model) => {
  const description = describeSpreadFootingSnapshot3D(model)
  const { width, length, thickness, columnWidth, columnLength, column } = description
  const maximumPlan = Math.max(width, length)
  const columnX = clamp(finiteNumber(column?.offsetXM), -width * 0.34, width * 0.34)
  const columnZ = clamp(finiteNumber(column?.offsetYM), -length * 0.34, length * 0.34)
  const visualAmplitude = Math.min(thickness * 0.44, maximumPlan * 0.058)
  const columnHeight = Math.max(thickness * 2.4, maximumPlan * 0.36)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0xeff5f9)
  scene.fog = new THREE.Fog(0xeff5f9, maximumPlan * 3.7, maximumPlan * 6.7)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6b8094, 1.7))
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.35)
  keyLight.position.set(maximumPlan * 1.6, maximumPlan * 2.5, maximumPlan * 1.8)
  keyLight.castShadow = true
  scene.add(keyLight)
  const rimLight = new THREE.DirectionalLight(0x9dc8ee, 0.8)
  rimLight.position.set(-maximumPlan * 1.5, maximumPlan, -maximumPlan)
  scene.add(rimLight)

  const root = new THREE.Group()
  root.name = 'spread-footing-symbolic-response'
  root.userData = {
    visualizationScope: 'symbolic-only',
    evaluation: 'NOT_EVALUATED',
    visualScale: 'NTS',
    displacementResult: null,
    soilStiffnessResult: null,
  }
  scene.add(root)

  const symbolicSurface = createSymbolicResponseGeometry(THREE, {
    width,
    length,
    thickness,
    columnX,
    columnZ,
    visualAmplitude,
  })
  const footing = new THREE.Mesh(
    symbolicSurface.geometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  )
  footing.name = 'symbolic-footing-envelope'
  footing.castShadow = true
  footing.receiveShadow = true
  root.add(footing)

  const surfaceGrid = createSymbolicSurfaceGrid(THREE, {
    width,
    length,
    columnX,
    columnZ,
    visualAmplitude,
  })
  root.add(surfaceGrid.group)

  const referencePoints = [
    new THREE.Vector3(-width / 2, 0.025, -length / 2),
    new THREE.Vector3(width / 2, 0.025, -length / 2),
    new THREE.Vector3(width / 2, 0.025, length / 2),
    new THREE.Vector3(-width / 2, 0.025, length / 2),
  ]
  const reference = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(referencePoints),
    new THREE.LineDashedMaterial({
      color: 0x8499ad,
      dashSize: maximumPlan * 0.04,
      gapSize: maximumPlan * 0.025,
      transparent: true,
      opacity: 0.88,
    })
  )
  reference.name = 'symbolic-undeformed-reference'
  reference.computeLineDistances()
  root.add(reference)

  const columnGeometry = new THREE.BoxGeometry(columnWidth, columnHeight, columnLength)
  const columnGroup = new THREE.Group()
  const columnMesh = new THREE.Mesh(
    columnGeometry,
    new THREE.MeshStandardMaterial({ color: 0xdce5ec, roughness: 0.74 })
  )
  columnMesh.castShadow = true
  columnGroup.add(columnMesh)
  addBoxEdges(THREE, columnGroup, columnGeometry, 0x263e55, 0.94)
  columnGroup.name = 'symbolic-column-load-transfer'
  root.add(columnGroup)

  const loadArrowLength = maximumPlan * 0.34
  const loadArrow = new THREE.ArrowHelper(
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(columnX, columnHeight + loadArrowLength, columnZ),
    loadArrowLength,
    0xc92a2a,
    maximumPlan * 0.085,
    maximumPlan * 0.05
  )
  loadArrow.name = 'symbolic-column-load-arrow'
  root.add(loadArrow)

  const soilPlaneY = -thickness - visualAmplitude - maximumPlan * 0.2
  const soil = new THREE.Mesh(
    new THREE.PlaneGeometry(maximumPlan * 2.45, maximumPlan * 2.45),
    new THREE.MeshStandardMaterial({ color: 0xdce7ef, roughness: 1 })
  )
  soil.rotation.x = -Math.PI / 2
  soil.position.y = soilPlaneY
  soil.receiveShadow = true
  root.add(soil)
  const soilGrid = new THREE.GridHelper(maximumPlan * 2.35, 16, 0x9eb4c7, 0xcbd8e3)
  soilGrid.position.y = soilPlaneY + 0.004
  root.add(soilGrid)

  const reactionArrows = []
  const reactionXs = [-0.34, 0, 0.34]
  const reactionZs = [-0.3, 0.3]
  const reactionLength = maximumPlan * 0.21
  for (const xRatio of reactionXs) {
    for (const zRatio of reactionZs) {
      const arrow = new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(width * xRatio, soilPlaneY + maximumPlan * 0.025, length * zRatio),
        reactionLength,
        0x2563a8,
        maximumPlan * 0.06,
        maximumPlan * 0.038
      )
      arrow.name = 'symbolic-soil-reaction-arrow'
      root.add(arrow)
      reactionArrows.push(arrow)
    }
  }

  const columnShape = symbolicShapeAt({
    x: columnX,
    z: columnZ,
    width,
    length,
    columnX,
    columnZ,
  })
  const updateResponse = (factor, colorEmphasis = 0) => {
    const nextFactor = clamp(factor, 0, 1)
    symbolicSurface.update(nextFactor, colorEmphasis)
    surfaceGrid.update(nextFactor)
    const columnShift = -visualAmplitude * columnShape * nextFactor
    columnGroup.position.set(columnX, columnShift + columnHeight / 2, columnZ)
    loadArrow.position.set(
      columnX,
      columnShift + columnHeight + loadArrowLength + maximumPlan * 0.045,
      columnZ
    )
  }
  updateResponse(0)

  return {
    scene,
    root,
    updateResponse,
    bounds: {
      width,
      length,
      thickness,
      columnHeight,
      visualAmplitude,
      maximumPlan,
    },
  }
}

export async function initSpreadFootingSymbolicResponse3D({ container, canvas, snapshot, model }) {
  if (!(container instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
    return Object.freeze({ ready: false, reason: 'MISSING_CONTAINER_OR_CANVAS' })
  }
  const fallback = container.querySelector('[data-snapshot-3d-fallback]')
  const status = container.parentElement?.querySelector('[data-symbolic-3d-status]')
    || container.querySelector('[data-symbolic-3d-status]')
  const replayButton = container.parentElement?.querySelector('[data-symbolic-3d-replay]')
  container.classList.remove('is-webgl-ready')
  container.classList.add('is-webgl-loading')
  container.setAttribute('aria-busy', 'true')
  canvas.hidden = true
  canvas.tabIndex = -1
  canvas.setAttribute('aria-hidden', 'true')
  fallback?.setAttribute('hidden', '')
  replayButton?.setAttribute('disabled', '')

  const failClosed = (reason) => {
    container.classList.remove('is-webgl-ready', 'is-webgl-loading')
    container.setAttribute('aria-busy', 'false')
    canvas.hidden = true
    canvas.tabIndex = -1
    canvas.setAttribute('aria-hidden', 'true')
    fallback?.removeAttribute('hidden')
    replayButton?.setAttribute('disabled', '')
    if (status) status.textContent = 'ใช้ภาพสำรอง 2D · WebGL ไม่พร้อม · ขอบเขตยังเป็นภาพเชิงสัญลักษณ์เท่านั้น'
    return Object.freeze({ ready: false, reason })
  }

  try {
    if (!snapshot?.id || canvas.dataset.snapshotId !== snapshot.id) {
      return failClosed('SNAPSHOT_TRACE_MISMATCH')
    }
    const THREE = await import('/vendor/three/three.module.js')
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace
    }
    const { scene, root, updateResponse, bounds } = createSymbolicResponseScene(THREE, model)
    const camera = new THREE.PerspectiveCamera(38, 1, 0.03, bounds.maximumPlan * 12)
    const fittedRadius = bounds.maximumPlan * 2.65
    const orbit = {
      theta: 0.78,
      phi: 0.56,
      radius: fittedRadius,
      targetY: -bounds.visualAmplitude * 0.18,
    }
    const pointer = { active: false, x: 0, y: 0 }
    const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')
    let reducedMotion = Boolean(motionQuery?.matches)
    let renderFrame = 0
    let responseFrame = 0
    let responseStartedAt = 0
    let disposed = false

    const updateCamera = () => {
      const horizontal = orbit.radius * Math.cos(orbit.phi)
      camera.position.set(
        horizontal * Math.sin(orbit.theta),
        orbit.radius * Math.sin(orbit.phi) + orbit.targetY,
        horizontal * Math.cos(orbit.theta)
      )
      camera.lookAt(0, orbit.targetY, 0)
    }
    const resize = () => {
      if (disposed) return
      const width = Math.max(300, container.clientWidth)
      const height = Math.max(340, Math.min(520, Math.round(width * 0.58)))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const render = () => {
      renderFrame = 0
      if (disposed) return
      resize()
      updateCamera()
      renderer.render(scene, camera)
    }
    const scheduleRender = () => {
      if (!renderFrame && !disposed) renderFrame = requestAnimationFrame(render)
    }
    const fit = () => {
      orbit.theta = 0.78
      orbit.phi = 0.56
      orbit.radius = fittedRadius
      orbit.targetY = -bounds.visualAmplitude * 0.18
      scheduleRender()
    }
    const setResponseFactor = (factor, colorEmphasis = 0) => {
      updateResponse(clamp(factor, 0, 1), clamp(colorEmphasis, 0, 1))
      scheduleRender()
    }
    const animateResponse = (timestamp) => {
      responseFrame = 0
      if (disposed) return
      if (!responseStartedAt) responseStartedAt = timestamp
      const progress = clamp((timestamp - responseStartedAt) / 760, 0, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const colorEmphasis = progress < 0.18
        ? progress / 0.18
        : progress < 0.72
          ? 1
          : 1 - (progress - 0.72) / 0.28
      setResponseFactor(eased, colorEmphasis)
      if (progress < 1) {
        responseFrame = requestAnimationFrame(animateResponse)
      } else if (status) {
        status.textContent = 'ภาพปลายทางเชิงสัญลักษณ์ · สีระหว่างเล่นจางกลับแล้ว · ไม่ใช่ผล critical หรือ deformation'
      }
    }
    const replay = () => {
      if (responseFrame) cancelAnimationFrame(responseFrame)
      responseFrame = 0
      responseStartedAt = 0
      if (reducedMotion) {
        setResponseFactor(1, 0)
        if (status) status.textContent = 'ภาพนิ่งเชิงสัญลักษณ์ตาม Reduce Motion · ไม่แสดงสีเคลื่อนไหว · ไม่ใช่ผล critical หรือ deformation'
        return true
      }
      setResponseFactor(0, 0)
      if (status) status.textContent = 'สี Blue → Cyan → Amber → Red กำลังเน้นเส้นทางแรงเชิงภาพ · ไม่ใช่ critical result'
      responseFrame = requestAnimationFrame(animateResponse)
      return true
    }
    const onPointerDown = (event) => {
      pointer.active = true
      pointer.x = event.clientX
      pointer.y = event.clientY
      canvas.setPointerCapture?.(event.pointerId)
    }
    const onPointerMove = (event) => {
      if (!pointer.active) return
      orbit.theta -= (event.clientX - pointer.x) * 0.008
      orbit.phi = clamp(orbit.phi + (event.clientY - pointer.y) * 0.006, 0.15, 1.28)
      pointer.x = event.clientX
      pointer.y = event.clientY
      scheduleRender()
    }
    const onPointerUp = (event) => {
      pointer.active = false
      canvas.releasePointerCapture?.(event.pointerId)
    }
    const onWheel = (event) => {
      event.preventDefault()
      orbit.radius = clamp(
        orbit.radius * Math.exp(event.deltaY * 0.001),
        bounds.maximumPlan * 1.48,
        bounds.maximumPlan * 5.6
      )
      scheduleRender()
    }
    const onKeyDown = (event) => {
      const key = event.key
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', '0'].includes(key)) return
      event.preventDefault()
      if (key === 'ArrowLeft') orbit.theta -= 0.12
      if (key === 'ArrowRight') orbit.theta += 0.12
      if (key === 'ArrowUp') orbit.phi = clamp(orbit.phi + 0.08, 0.15, 1.28)
      if (key === 'ArrowDown') orbit.phi = clamp(orbit.phi - 0.08, 0.15, 1.28)
      if (key === '+' || key === '=') orbit.radius = Math.max(bounds.maximumPlan * 1.48, orbit.radius * 0.9)
      if (key === '-' || key === '_') orbit.radius = Math.min(bounds.maximumPlan * 5.6, orbit.radius * 1.1)
      if (key === '0') return fit()
      scheduleRender()
    }
    const onMotionPreferenceChange = (event) => {
      reducedMotion = Boolean(event.matches)
      if (reducedMotion) {
        if (responseFrame) cancelAnimationFrame(responseFrame)
        responseFrame = 0
        setResponseFactor(1, 0)
        if (status) status.textContent = 'ภาพนิ่งเชิงสัญลักษณ์ตาม Reduce Motion · ไม่แสดงสีเคลื่อนไหว · ไม่ใช่ผล critical หรือ deformation'
      }
    }
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('keydown', onKeyDown)
    replayButton?.addEventListener('click', replay)
    motionQuery?.addEventListener?.('change', onMotionPreferenceChange)
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleRender) : null
    resizeObserver?.observe(container)

    canvas.hidden = false
    canvas.tabIndex = 0
    canvas.removeAttribute('aria-hidden')
    canvas.style.touchAction = 'none'
    fallback?.setAttribute('hidden', '')
    replayButton?.removeAttribute('disabled')
    container.classList.remove('is-webgl-loading')
    container.classList.add('is-webgl-ready')
    container.setAttribute('aria-busy', 'false')
    canvas.dataset.webglState = 'ready'
    canvas.dataset.visualizationScope = 'symbolic-only'
    canvas.dataset.responseScale = 'NTS'
    fit()
    replay()

    const dispose = () => {
      if (disposed) return
      disposed = true
      if (renderFrame) cancelAnimationFrame(renderFrame)
      if (responseFrame) cancelAnimationFrame(responseFrame)
      resizeObserver?.disconnect()
      motionQuery?.removeEventListener?.('change', onMotionPreferenceChange)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('keydown', onKeyDown)
      replayButton?.removeEventListener('click', replay)
      replayButton?.setAttribute('disabled', '')
      scene.traverse((object) => {
        object.geometry?.dispose?.()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        for (const material of materials.filter(Boolean)) material.dispose?.()
      })
      renderer.dispose()
      root.clear()
      container.classList.remove('is-webgl-ready', 'is-webgl-loading')
      container.setAttribute('aria-busy', 'false')
    }
    return Object.freeze({ ready: true, fit, resize: scheduleRender, replay, dispose })
  } catch {
    return failClosed('WEBGL_OR_SYMBOLIC_MODEL_UNAVAILABLE')
  }
}
