import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
  createSpreadFootingSnapshot,
  DEFAULT_SPREAD_FOOTING_DRAFT,
} from './spread-footing-engine.mjs'
import {
  renderSpreadFootingAnalysisSurface,
  renderSpreadFootingCalculationBookSurface,
  renderSpreadFootingChecksSurface,
  renderSpreadFootingDrawingSurface,
  renderSpreadFootingReportSurface,
  renderSpreadFootingSectionSurface,
  renderSpreadFootingSnapshotHydrationPlan,
  renderSpreadFootingSnapshotSurfaces,
  renderSpreadFootingSummarySurface,
  renderSpreadFootingThreeSurface,
} from './spread-footing-snapshot-renderers.mjs'

const deepFreeze = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  return Object.freeze(value)
}

const metric = (value, display, unit) => deepFreeze({ value, display, unit })

const officialAciSource = deepFreeze({
  sourceId: 'ACI-318-19',
  standard: 'ACI 318',
  edition: '2019',
  clause: 'Table 22.5.5.1(c)',
  sourceTitle: 'ACI CODE-318-19 official product page',
  sourceUrl:
    'https://www.concrete.org/store/productdetail.aspx?ItemID=318U19&Language=English&Units=US_and_Metric',
  verificationStatus: 'CONTROLLED_REFERENCE_REVIEW',
})

const thaiSource = deepFreeze({
  sourceId: 'TH-MR-2566',
  standard: 'กฎกระทรวง',
  edition: 'พ.ศ. 2566',
  clause: 'ข้อ 7',
  sourceTitle: 'ราชกิจจานุเบกษา <ฉบับทดสอบ>',
  sourceUrl: 'https://ratchakitcha.soc.go.th/documents/140A054N0000000000400.pdf',
  verificationStatus: 'OFFICIAL_SOURCE',
})

const unsafeSource = deepFreeze({
  sourceId: 'UNSAFE-URL',
  standard: 'ข้อมูลผู้ใช้',
  edition: 'draft',
  clause: 'ไม่มี',
  sourceTitle: 'ชื่อเอกสาร </a><script>alert("source")</script>',
  sourceUrl: 'javascript:alert("unsafe")',
  verificationStatus: 'HOLD',
})

const unsafeSbcSource = 'รายงานดิน <script>alert("sbc")</script> & Owner/PE'

const checks = deepFreeze([
  {
    id: 'BRG-01',
    label: 'แรงดันดินใช้งาน qmax / SBC',
    demand: metric(168, '168.0 kPa', 'kPa'),
    capacity: metric(200, '200.0 kPa', 'kPa'),
    utilization: metric(0.84, '0.840', 'ratio'),
    evaluated: true,
    applicability: 'EVALUATED',
    status: 'PASS',
    capacitySource: unsafeSbcSource,
    ...thaiSource,
  },
  {
    id: 'FLX-A',
    label: 'กำลังดัดทิศ A',
    demand: metric(65, '65.0 kN·m/m', 'kN·m/m'),
    capacity: metric(60, '60.0 kN·m/m', 'kN·m/m'),
    utilization: metric(1.083, '1.083', 'ratio'),
    applicability: 'EVALUATED',
    status: 'FAIL',
    standard: 'ACI 318',
    edition: '2019',
    clause: '§22.2',
    sourceTitle: officialAciSource.sourceTitle,
    sourceUrl: officialAciSource.sourceUrl,
    verificationStatus: 'CONTROLLED_REFERENCE_REVIEW',
  },
  {
    id: 'SET-01',
    label: 'การทรุดตัว <svg onload=alert("settlement")>',
    demand: 'ไม่มีข้อมูลชั้นดิน',
    capacity: 'อยู่นอก R1',
    utilization: 'ไม่มี',
    evaluated: false,
    applicability: 'NOT_EVALUATED',
    status: 'PASS',
    ...unsafeSource,
  },
  {
    id: 'ANC-01',
    label: 'Development / anchorage / standard hook',
    demand: 'ไม่มีหลักฐาน ldh',
    capacity: 'ต้องให้ Owner/PE อนุมัติ',
    utilization: 'ไม่มี',
    evaluated: false,
    applicability: 'NOT_EVALUATED',
    status: 'HOLD',
    ...officialAciSource,
    clause: 'Chapter 25',
  },
  {
    id: 'BBS-01',
    label: 'Released BBS / fabrication authorization',
    demand: 'ไม่มีใบอนุมัติผลิต',
    capacity: 'ต้องมี released BBS',
    utilization: 'ไม่มี',
    evaluated: false,
    applicability: 'NOT_EVALUATED',
    status: 'NOT EVALUATED',
    ...unsafeSource,
  },
])

const equations = deepFreeze([
  {
    equationId: 'EQ-BRG-01',
    title: 'แรงดันดินใช้งานสูงสุด',
    formula: 'qmax = q0 + Mx/Sx + My/Sy',
    substitution: '168.0 = 160.0 + 4.0 + 4.0 kPa',
    canonicalUnits: 'kN, m, kPa',
    assumptions: ['full contact', 'linear elastic bearing', 'ข้อความ <b>ผู้ใช้</b> ถูก escape'],
    ...thaiSource,
  },
  {
    equationId: 'EQ-OWS-A',
    title: 'กำลังเฉือนทางเดียวทิศ A',
    formula: 'φVc = φs × Vc',
    substitution: 'φVc = 0.75 × 225.0 = 168.75 kN/m',
    canonicalUnits: 'MPa, mm, kN/m',
    assumptions: ['normalweight concrete', 'no shear reinforcement', 'interior footing'],
    ...officialAciSource,
  },
  {
    equationId: 'EQ-SET-HOLD',
    title: 'การทรุดตัว',
    formula: 'NOT EVALUATED',
    substitution: 'ไม่มีข้อมูลปฐพีกลศาสตร์',
    canonicalUnits: 'NOT EVALUATED',
    assumptions: ['outside SF-SDM-ACI19-R1'],
    ...unsafeSource,
  },
])

const geometry = deepFreeze({
  footing: {
    width: metric(2.0, '2.00 m', 'm'),
    length: metric(2.4, '2.40 m', 'm'),
    thickness: metric(0.45, '0.45 m', 'm'),
  },
  column: {
    width: metric(0.3, '0.30 m', 'm'),
    length: metric(0.4, '0.40 m', 'm'),
  },
  cover: metric(75, '75 mm', 'mm'),
  effectiveDepth: {
    A: metric(367, '367 mm', 'mm'),
    B: metric(351, '351 mm', 'mm'),
  },
})

const reinforcement = deepFreeze({
  A: {
    mark: 'F01-A',
    direction: 'X',
    layer: 'ชั้นล่าง',
    count: 10,
    designation: 'DB16',
    spacing: metric(205, '205 mm', 'mm'),
    effectiveDepth: metric(367, '367 mm', 'mm'),
    status: 'PASS',
    evaluated: true,
  },
  B: {
    mark: 'F01-B',
    direction: 'Y',
    layer: 'ชั้นบน',
    count: 12,
    designation: 'DB16',
    spacing: metric(164, '164 mm', 'mm'),
    effectiveDepth: metric(351, '351 mm', 'mm'),
    status: 'PASS',
    evaluated: true,
  },
})

const barCut = deepFreeze({
  A: {
    mark: 'F01-A',
    width: metric(1850, '1,850 mm O/O', 'mm'),
    verticalTail: metric(214, '214 mm C/L', 'mm'),
    centerlineRadius: metric(56, '56 mm C/L', 'mm'),
    cutLength: metric(2296.9, '2,296.9 mm', 'mm'),
    status: 'HOLD',
  },
  B: {
    mark: 'F01-B',
    width: metric(2250, '2,250 mm O/O', 'mm'),
    verticalTail: metric(198, '198 mm C/L', 'mm'),
    centerlineRadius: metric(56, '56 mm C/L', 'mm'),
    cutLength: metric(2664.9, '2,664.9 mm', 'mm'),
    status: 'NOT EVALUATED',
  },
})

const diagrams = deepFreeze({
  A: {
    direction: 'A',
    moment: {
      maximum: metric(65, '65.0 kN·m/m', 'kN·m/m'),
      svgPath: 'M42 118 Q210 31 378 118',
    },
    shear: {
      maximum: metric(120, '120.0 kN/m', 'kN/m'),
      svgPoints: [
        [42, 28],
        [210, 118],
        [378, 28],
      ],
    },
  },
  B: {
    direction: 'B',
    moment: {
      maximum: metric(58, '58.0 kN·m/m', 'kN·m/m'),
      svgPath: 'M42 118 Q210 38 378 118',
    },
    shear: {
      maximum: metric(109, '109.0 kN/m', 'kN/m'),
      svgPath: 'M42 35 L210 118 L378 35',
    },
  },
})

const designBasis = deepFreeze({
  profileId: 'SF-SDM-ACI19-R1',
  standard: 'กฎกระทรวง พ.ศ. 2566 + ACI 318-19',
  governingStandard: 'กฎกระทรวง พ.ศ. 2566 + ACI 318-19 member-strength reference',
  edition: 'พ.ศ. 2566 / 2019',
  engineVersion: '1.0.0-review',
  loadCombination: {
    id: 'TH_MR_2566_C7_1_4D_1_7L',
    label: 'U = 1.4D + 1.7L',
    equation: 'U = 1.4D + 1.7L',
  },
  sources: [thaiSource, officialAciSource, unsafeSource],
  assumptions: ['centered interior column', 'full contact', 'normalweight concrete'],
})

const project = deepFreeze({
  projectName: 'โครงการ <img src=x onerror=alert("project")> & ทดสอบ',
  projectOwner: 'เจ้าของ "นาย ก." </dd><script>alert("owner")</script>',
  projectLocation: 'กรุงเทพฯ <เขตทดสอบ>',
  memberMark: 'F-01',
  calculationNumber: 'CAL-SF-001',
  drawingNumber: 'DWG-SF-001',
  revision: 'R1',
  preparedBy: 'ผู้จัดทำ <Codex>',
  checkedBy: 'รอตรวจ',
  approvedBy: 'รอ Owner/PE',
})

const results = deepFreeze({
  overall: {
    status: 'ENGINEERING REVIEW REQUIRED',
    message: 'มีแถว FAIL และ HOLD ต้องทบทวน',
    governingCheckId: 'FLX-A',
  },
  loads: {
    serviceColumn: metric(700, '700.0 kN', 'kN'),
    factoredColumn: metric(980, '980.0 kN', 'kN'),
    quNet: metric(204.17, '204.17 kPa', 'kPa'),
  },
  bearing: {
    qMax: metric(168, '168.0 kPa', 'kPa'),
    qMin: metric(152, '152.0 kPa', 'kPa'),
    sbc: metric(200, '200.0 kPa', 'kPa'),
    sbcSource: unsafeSbcSource,
    corners: [
      metric(168, '168.0 kPa', 'kPa'),
      metric(164, '164.0 kPa', 'kPa'),
      metric(152, '152.0 kPa', 'kPa'),
      metric(156, '156.0 kPa', 'kPa'),
    ],
    check: checks[0],
  },
  geometry,
  reinforcement,
  flexure: {
    A: { demand: metric(65, '65.0 kN·m/m', 'kN·m/m'), status: 'FAIL', evaluated: true },
    B: { demand: metric(58, '58.0 kN·m/m', 'kN·m/m'), status: 'PASS', evaluated: true },
  },
  oneWayShear: {
    A: { demand: metric(120, '120.0 kN/m', 'kN/m'), status: 'PASS', evaluated: true },
    B: { demand: metric(109, '109.0 kN/m', 'kN/m'), status: 'PASS', evaluated: true },
  },
  punching: {
    criticalPerimeter: metric(2.84, '2.84 m', 'm'),
    demand: metric(410, '410.0 kN', 'kN'),
    capacity: metric(530, '530.0 kN', 'kN'),
    status: 'PASS',
    evaluated: true,
  },
  checks,
  equations,
  diagrams,
  barCut,
  takeoff: {
    items: [
      { id: 'TK-A', label: 'F01-A น้ำหนักเชิงทฤษฎี', value: '36.3 kg' },
      { id: 'TK-B', label: 'F01-B น้ำหนักเชิงทฤษฎี', value: '50.5 kg' },
      { id: 'TK-TOTAL', label: 'รวมเหล็กฐานราก', value: '86.8 kg · reference' },
    ],
  },
})

const constructionAuthorization = deepFreeze({
  status: 'NOT FOR CONSTRUCTION',
  bbsStatus: 'NOT RELEASED BBS',
  exportStatus: 'LOCKED',
})

const limitations = deepFreeze([
  {
    id: 'LIM-SET',
    label: 'การทรุดตัว',
    status: 'NOT EVALUATED',
    evaluated: false,
  },
  {
    id: 'LIM-DOWEL',
    label: 'เหล็กเดือยและการถ่ายแรงเสา–ฐาน',
    status: 'HOLD',
    evaluated: false,
  },
  {
    id: 'LIM-BBS',
    label: 'Construction BBS',
    status: 'NOT RELEASED BBS',
    evaluated: false,
  },
])

// This fixture is deliberately assembled by hand. It does not call the calculation engine.
const fixture = deepFreeze({
  ok: true,
  schemaVersion: 'spread-footing-snapshot-v1',
  snapshotSchema: 'spread-footing-snapshot-v1',
  engineId: 'structvault.spread-footing',
  engineVersion: '1.0.0-review',
  profileId: 'SF-SDM-ACI19-R1',
  id: 'SF-20260729-0001',
  snapshotId: 'SF-20260729-0001',
  payloadHash: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  fingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  calculationFingerprint: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  createdAt: '2026-07-29T02:30:00.000Z',
  project,
  projectMetadata: project,
  designBasis,
  normalizedInputs: {
    project,
    designBasis,
    geometry,
  },
  input: {
    project,
    designBasis,
    geometry,
  },
  inputs: {
    project,
    designBasis,
    geometry,
  },
  results,
  limitations,
  constructionAuthorization,
})

assert.ok(Object.isFrozen(fixture), 'hand-made Snapshot fixture must be deeply frozen')
assert.ok(Object.isFrozen(fixture.results.checks), 'fixture check evidence must be frozen')

const surfaces = renderSpreadFootingSnapshotSurfaces(fixture)
const expectedSurfaceKeys = ['summary', 'dc', 'analysis', 'section', 'three', 'report', 'calc', 'drawing']

assert.deepEqual(Object.keys(surfaces), expectedSurfaceKeys, 'renderer must return the eight ordered surfaces')
assert.ok(Object.isFrozen(surfaces), 'surface markup map must be frozen')

for (const surface of expectedSurfaceKeys) {
  const markup = surfaces[surface]
  assert.equal(typeof markup, 'string', `${surface} must render markup`)
  assert.match(
    markup,
    new RegExp(`data-snapshot-surface="${surface}"`),
    `${surface} root must identify its surface`
  )
  assert.ok(
    markup.includes(`data-snapshot-id="${fixture.snapshotId}"`),
    `${surface} root must carry the exact Snapshot ID`
  )
  assert.ok(
    markup.includes(`data-payload-hash="${fixture.payloadHash}"`),
    `${surface} root must carry the exact payload hash`
  )
  assert.ok(
    markup.includes(`data-calculation-fingerprint="${fixture.calculationFingerprint}"`),
    `${surface} root must carry the exact calculation fingerprint`
  )
  assert.ok(
    markup.includes(`data-fingerprint="${fixture.fingerprint}"`),
    `${surface} root must carry the exact fingerprint`
  )
  assert.ok(
    markup.includes(`data-profile-id="${fixture.profileId}"`),
    `${surface} root must carry the exact Design Standard profile ID`
  )
}

const separatelyRendered = {
  summary: renderSpreadFootingSummarySurface(fixture),
  dc: renderSpreadFootingChecksSurface(fixture),
  analysis: renderSpreadFootingAnalysisSurface(fixture),
  section: renderSpreadFootingSectionSurface(fixture),
  three: renderSpreadFootingThreeSurface(fixture),
  report: renderSpreadFootingReportSurface(fixture),
  calc: renderSpreadFootingCalculationBookSurface(fixture),
  drawing: renderSpreadFootingDrawingSurface(fixture),
}

for (const surface of expectedSurfaceKeys) {
  assert.equal(
    separatelyRendered[surface],
    surfaces[surface],
    `${surface} individual renderer must match the coordinated renderer`
  )
}

const allMarkup = Object.values(surfaces).join('\n')
const visibleTextFromMarkup = (markup) =>
  markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

assert.doesNotMatch(
  `${surfaces.summary}\n${surfaces.dc}\n${surfaces.analysis}\n${surfaces.section}\n${surfaces.three}\n${visibleTextFromMarkup(
    surfaces.calc
  )}`,
  /ENGINEERING REVIEW REQUIRED|Owner\s*\/\s*PE review/,
  'calculation flows must not repeat the project-approval request'
)
assert.match(
  surfaces.summary,
  /ผลที่ประเมิน · (?:OK|FAIL)/,
  'Summary must project the evaluated governing result instead of a neutral empty state'
)

assert.doesNotMatch(allMarkup, /<img\b[^>]*onerror/i, 'user HTML must never become an image element')
assert.doesNotMatch(allMarkup, /<script\b/i, 'user HTML must never become a script element')
assert.doesNotMatch(allMarkup, /<svg\b[^>]*onload/i, 'user SVG text must never become executable markup')
assert.match(allMarkup, /&lt;img src=x onerror=alert\(&quot;project&quot;\)&gt;/)
assert.match(allMarkup, /&lt;script&gt;alert\(&quot;owner&quot;\)&lt;\/script&gt;/)
assert.match(allMarkup, /&lt;svg onload=alert\(&quot;settlement&quot;\)&gt;/)
assert.doesNotMatch(allMarkup, /href="javascript:/i, 'unsafe source URLs must not be links')
for (const surface of ['summary', 'dc', 'report', 'calc']) {
  assert.match(
    surfaces[surface],
    /รายงานดิน &lt;script&gt;alert\(&quot;sbc&quot;\)&lt;\/script&gt; &amp; Owner\/PE/,
    `${surface} must expose the escaped SBC provenance`
  )
  assert.doesNotMatch(
    surfaces[surface],
    /รายงานดิน <script>/,
    `${surface} must never render SBC provenance as executable markup`
  )
}
assert.match(
  surfaces.report,
  /data-sbc-source="รายงานดิน &lt;script&gt;alert\(&quot;sbc&quot;\)&lt;\/script&gt; &amp; Owner\/PE"/,
  'A4 root must retain the escaped exact SBC provenance'
)

for (const surface of expectedSurfaceKeys.filter((surface) => surface !== 'calc')) {
  const visibleText = visibleTextFromMarkup(surfaces[surface])
  assert.doesNotMatch(
    visibleText,
    new RegExp(fixture.payloadHash),
    `${surface} must keep the raw payload hash out of visible result copy`
  )
  assert.doesNotMatch(
    visibleText,
    new RegExp(fixture.calculationFingerprint),
    `${surface} must keep the raw calculation fingerprint out of visible result copy`
  )
  assert.doesNotMatch(
    surfaces[surface],
    /sf-snapshot-trace-details|sf-snapshot-trace\b/,
    `${surface} must expose only concise Snapshot identity; full trace belongs in Calculation Book`
  )
  assert.doesNotMatch(
    surfaces[surface],
    /https?:\/\/|data-equation-id=|sf-equation-record|sf-equation-ledger/,
    `${surface} must not leak full URLs or equation-ledger evidence outside Calculation Book`
  )
}
assert.match(
  visibleTextFromMarkup(surfaces.calc),
  new RegExp(fixture.payloadHash),
  'Calculation Book must visibly expose the full payload hash'
)
assert.match(
  visibleTextFromMarkup(surfaces.calc),
  new RegExp(fixture.calculationFingerprint),
  'Calculation Book must visibly expose the full calculation fingerprint'
)

const evaluatedPassRow = surfaces.dc.match(
  /<tr[^>]*data-check-id="BRG-01"[\s\S]*?<\/tr>/
)?.[0]
const evaluatedFailRow = surfaces.dc.match(
  /<tr[^>]*data-check-id="FLX-A"[\s\S]*?<\/tr>/
)?.[0]
const unsupportedPassClaimRow = surfaces.dc.match(
  /<tr[^>]*data-check-id="SET-01"[\s\S]*?<\/tr>/
)?.[0]
const explicitHoldRow = surfaces.dc.match(
  /<tr[^>]*data-check-id="ANC-01"[\s\S]*?<\/tr>/
)?.[0]
const unsupportedAuditRow = surfaces.calc.match(
  /<tr[^>]*data-check-id="SET-01"[\s\S]*?<\/tr>/
)?.[0]
const explicitHoldAuditRow = surfaces.calc.match(
  /<tr[^>]*data-check-id="ANC-01"[\s\S]*?<\/tr>/
)?.[0]

assert.ok(evaluatedPassRow, 'evaluated PASS row must render')
assert.match(evaluatedPassRow, /data-evaluation="evaluated"/)
assert.match(evaluatedPassRow, />PASS</)
assert.ok(evaluatedFailRow, 'evaluated FAIL row must render')
assert.match(evaluatedFailRow, /data-evaluation="evaluated"/)
assert.match(evaluatedFailRow, />FAIL</)
assert.equal(unsupportedPassClaimRow, undefined, 'D/C main table must omit unsupported rows')
assert.equal(explicitHoldRow, undefined, 'D/C main table must omit HOLD rows')
assert.ok(unsupportedAuditRow, 'unsupported fixture row must remain in the audit vault')
assert.match(unsupportedAuditRow, /data-evaluation="not-evaluated"/)
assert.match(unsupportedAuditRow, /NOT EVALUATED · นอกขอบเขต/)
assert.doesNotMatch(
  unsupportedAuditRow,
  />PASS</,
  'a PASS token on a non-evaluated topic must fail closed'
)
assert.ok(explicitHoldAuditRow, 'explicit HOLD row must remain in the audit vault')
assert.match(explicitHoldAuditRow, />รอตรวจ · HOLD</)

assert.match(surfaces.summary, /sf-metric-card/, 'Summary must contain status and metric cards')
assert.equal(
  [...surfaces.summary.matchAll(/class="sf-metric-card\b/g)].length,
  4,
  'all four Summary metric cards must share the responsive wrapping contract'
)
assert.match(surfaces.summary, /data-diagram-model="bearing-pressure"/)
assert.match(surfaces.summary, /data-drawing-role="section"/)
assert.match(surfaces.analysis, /data-diagram="moment"/)
assert.match(surfaces.analysis, /data-diagram="shear"/)
assert.match(surfaces.analysis, /data-check-topic="settlement" data-evaluation="not-evaluated"/)
assert.match(
  surfaces.analysis,
  /data-visualization-scope="symbolic-only"/,
  'symbolic behavior panel must advertise a non-quantitative visualization scope'
)
assert.match(
  surfaces.analysis,
  /class="deflection-scope-note"[^>]*data-visualization-scope="symbolic-only"/,
  'symbolic-only scope must survive live slot hydration when the outer article is stripped'
)
assert.match(
  surfaces.analysis,
  /class="[^"]*sf-symbolic-settlement[^"]*sf-symbolic-behavior[^"]*"/,
  'symbolic behavior redesign must retain the live hydration selector contract'
)
assert.match(surfaces.analysis, /ไม่มีค่าการกระจัด(?:เชิงตัวเลข)?/)
assert.match(
  surfaces.analysis,
  /ไม่ใช่ FEA contour/,
  'symbolic behavior panel must explicitly reject an FEA-contour interpretation'
)
assert.match(
  surfaces.analysis,
  /<title id="sfSymbolicDiagramTitle">/,
  'symbolic diagram must expose an accessible title'
)
assert.match(
  surfaces.analysis,
  /<desc id="sfSymbolicDiagramDesc">[^<]*ไม่ใช่ผลวิเคราะห์การทรุดตัวหรือค่าการกระจัด<\/desc>/,
  'symbolic diagram description must retain the settlement/displacement boundary'
)
assert.match(
  surfaces.analysis,
  /data-symbolic-3d-stage[^>]*data-visualization-scope="symbolic-only"[^>]*data-response-kind="conceptual-load-path"/,
  'symbolic behavior panel must provide a fail-closed 3D stage without changing its evidence scope'
)
assert.match(surfaces.analysis, /data-symbolic-3d-replay disabled/)
assert.match(surfaces.analysis, /data-snapshot-3d-fallback/)
assert.match(surfaces.analysis, /3D SYMBOLIC RESPONSE · NTS/)
assert.match(surfaces.analysis, /NO Δ RESULT/)
assert.match(surfaces.analysis, /VISUAL COLOR ≠ CRITICAL/)
assert.match(surfaces.analysis, /ไม่ใช่ผล critical, deformation หรือ settlement/)
assert.doesNotMatch(
  surfaces.analysis,
  /deflection-legend|deflection-band--max|ขนาดเชิงสัญลักษณ์/,
  'symbolic behavior panel must not imitate a quantitative contour legend'
)
assert.equal(
  [...surfaces.analysis.matchAll(/<svg class="engineering-chart" viewBox="0 0 520 138"/g)].length,
  4,
  'all four engineering diagrams must use the compact print-readable 520 × 138 canvas'
)
assert.equal(
  [...surfaces.analysis.matchAll(/class="chart-area"/g)].length,
  0,
  'BMD/SFD must remain line graphs that do not depend on colored fill'
)
assert.equal(
  [...surfaces.analysis.matchAll(/data-axis-x="distance-from-column-face"/g)].length,
  4,
  'every engineering diagram must expose an explicit distance x-axis'
)
assert.equal(
  [...surfaces.analysis.matchAll(/data-critical-station="column-face"/g)].length,
  2,
  'BMD A/B must place the governing moment at the column face x=0'
)
assert.equal(
  [...surfaces.analysis.matchAll(/data-critical-station="effective-depth"/g)].length,
  2,
  'SFD A/B must place the design shear at x=d'
)
assert.equal(
  [...surfaces.analysis.matchAll(/ขอบฐาน/g)].length >= 4,
  true,
  'the footing edge must be the right/zero boundary on every engineering diagram'
)
assert.match(surfaces.section, /data-drawing-role="plan"/)
assert.match(surfaces.section, /data-barcut-detail="H-01"/)
assert.match(surfaces.section, /data-barcut-detail="H-02"/)
assert.match(surfaces.section, /class="section-diagram hook-detail-card barcut-detail-card"/)
assert.match(surfaces.section, /W,H = O\/O · Scl,Bcl,Ri,Di,Rc,Lcl = C\/L/)
assert.match(surfaces.three, /<canvas data-snapshot-3d/)
assert.match(surfaces.three, /data-snapshot-3d-fallback/)
assert.match(surfaces.three, /data-model-layer="concrete"/)
assert.match(surfaces.three, /data-model-layer="critical"/)

assert.match(
  surfaces.report,
  /^<section class="sf-snapshot-surface sf-snapshot-surface--report report-document"/
)
assert.equal(
  [...surfaces.report.matchAll(/<article class="report-sheet report-product report-bw"/g)].length,
  2,
  'A4 report must have exactly two physical page articles inside one hydration root'
)
assert.deepEqual(
  [...surfaces.report.matchAll(/data-report-page="([12])"/g)].map((match) => match[1]),
  ['1', '2'],
  'A4 pages must be ordered page 1 then page 2'
)
assert.match(surfaces.report, /01 · ข้อมูลโครงการ \/ ฐานการออกแบบ/)
assert.match(surfaces.report, /03 · ผลตรวจที่คำนวณได้/)
assert.match(surfaces.report, /02\.1 · น้ำหนักฐานและดินเหนือฐาน/)
assert.match(surfaces.report, /02\.2 · แรงดันดินใช้งานและการสัมผัส/)
assert.match(surfaces.report, /02\.1 · ดัดและเหล็กเสริม ทิศ A/)
assert.match(surfaces.report, /02\.5 · แรงเฉือนทะลุรอบเสากลาง/)
assert.doesNotMatch(surfaces.report, /Bar Cut|Lcl ทิศ [AB]/)
assert.doesNotMatch(surfaces.report, /a4-reference-summary/)
assert.doesNotMatch(surfaces.report, /06 · ขอบเขตของรายงาน|a4-scope-(?:note|list)/)
assert.match(surfaces.report, /class="a4-header-signoff"/)
assert.match(surfaces.report, /จัดทำโดย[\s\S]*?ตรวจสอบโดย[\s\S]*?อนุมัติโดย/)
assert.match(
  surfaces.report,
  /data-document-class="CALCULATION_REVIEW"/
)
assert.match(
  surfaces.report,
  /class="a4-header-context"[\s\S]*?โครงการ[\s\S]*?ชิ้นส่วน[\s\S]*?เลขที่คำนวณ[\s\S]*?Revision[\s\S]*?จัดทำโดย[\s\S]*?ตรวจสอบโดย/,
  'A4 title area must show the complete project and document context instead of a warning badge'
)
assert.doesNotMatch(
  surfaces.report,
  /class="a4-footer a4-trace-footer"/,
  'Owner removed the raw Snapshot/hash trace footer from the printed A4'
)
assert.doesNotMatch(surfaces.report, /BMD|SFD|data-diagram="(?:moment|shear)"/)
assert.doesNotMatch(
  visibleTextFromMarkup(surfaces.report),
  /\bHOLD\b/,
  'A4 main report must not mix unevaluated HOLD records into calculation results'
)
assert.doesNotMatch(surfaces.report, /NOT RELEASED BBS/)

for (const sourceMarker of [
  'สมการ (Formula)',
  'การแทนค่า (Substitution)',
  'หน่วยมาตรฐาน (Canonical units)',
  'มาตรฐาน / ฉบับ (Edition)',
  'ข้อกำหนด / รหัสสมการ',
  'สมมติฐาน (Assumptions)',
  'แหล่งอ้างอิงทางการ',
  'ACI 318',
  '2019',
  'Table 22.5.5.1(c)',
  'CONTROLLED_REFERENCE_REVIEW',
]) {
  assert.ok(surfaces.calc.includes(sourceMarker), `Calculation Book must expose ${sourceMarker}`)
}
assert.match(surfaces.calc, /data-equation-id="EQ-OWS-A"/)
assert.match(surfaces.calc, /href="https:\/\/www\.concrete\.org\//)
assert.match(
  surfaces.calc,
  /data-equation-id="EQ-OWS-A"[\s\S]*?<dt>แหล่งอ้างอิงทางการ<\/dt>[\s\S]*?<a [^>]*>เปิดเอกสารทางการ<\/a>/,
  'Calculation Book must retain an official source link within each equation record'
)
assert.match(surfaces.calc, /NOT EVALUATED/)
assert.match(surfaces.calc, /HOLD/)
assert.match(surfaces.calc, /<nav class="calc-index" aria-label="สารบัญรายการคำนวณ">/)
assert.match(
  surfaces.calc,
  /<section class="calc-result-summary" aria-label="สรุปผลตรวจฐานรากแผ่">/
)
assert.match(
  surfaces.calc,
  /<section class="calc-narrative" aria-label="วิธีคำนวณเต็มรูปแบบทีละขั้นตอน">/
)
assert.match(surfaces.calc, /รายการคำนวณฐานรากแผ่ · CALCULATION BOOK/)
assert.match(surfaces.calc, /วิธีคำนวณเต็มรูปแบบทีละขั้นตอน/)
const fixtureCalcPresentation = surfaces.calc.split('<details class="calc-evidence-vault">')[0]
assert.equal(
  [...fixtureCalcPresentation.matchAll(/class="calc-story-card\b/g)].length,
  9,
  'Flow 07 open narrative must contain exactly nine professional calculation sections'
)
assert.doesNotMatch(
  fixtureCalcPresentation,
  /Bar Cut|NOT RELEASED BBS|ความยาวพัฒนา|บัญชีผลิต/,
  'Flow 07 open narrative must not contain fabrication or Bar Cut narrative'
)
assert.match(
  surfaces.calc,
  /<details class="calc-evidence-vault">[\s\S]*?<nav class="calc-index"/,
  'the complete equation register must remain available behind progressive disclosure'
)
assert.doesNotMatch(
  surfaces.calc,
  /<details class="calc-evidence-vault"[^>]*\sopen(?:\s|>)/,
  'the complete equation register must be collapsed by default'
)
assert.equal(
  [...surfaces.calc.matchAll(/class="calc-chapter"/g)].length,
  10,
  'Calculation Book must present ten vertical footing calculation chapters'
)
assert.match(surfaces.calc, /id="sf-calc-bearing"/)
assert.match(surfaces.calc, /id="sf-calc-flexure-a"/)
assert.match(surfaces.calc, /id="sf-calc-flexure-b"/)
assert.match(surfaces.calc, /id="sf-calc-shear"/)
assert.match(surfaces.calc, /id="sf-calc-trace"/)

for (const sheetId of ['SF-01', 'SF-02', 'SF-03']) {
  assert.match(
    surfaces.drawing,
    new RegExp(`data-sheet-id="${sheetId}"`),
    `Drawing Pack must include ${sheetId}`
  )
}
assert.match(surfaces.drawing, /ตารางเหล็กเสริม \(Rebar schedule\) · NOT RELEASED BBS/)
assert.match(surfaces.drawing, /F01-A น้ำหนักเชิงทฤษฎี/)
assert.match(surfaces.drawing, /NOT FOR CONSTRUCTION/)
assert.match(surfaces.drawing, /NOT RELEASED BBS/)

const rendererPath = fileURLToPath(new URL('./spread-footing-snapshot-renderers.mjs', import.meta.url))
const rendererSource = await readFile(rendererPath, 'utf8')
const workbenchCssPath = fileURLToPath(
  new URL('./spread-footing-workbench-mockup.css', import.meta.url)
)
const workbenchCssSource = await readFile(workbenchCssPath, 'utf8')
const workbenchHtmlPath = fileURLToPath(
  new URL('./spread-footing-workbench-mockup.html', import.meta.url)
)
const workbenchHtmlSource = await readFile(workbenchHtmlPath, 'utf8')
const workbenchJsPath = fileURLToPath(
  new URL('./spread-footing-workbench-mockup.js', import.meta.url)
)
const workbenchJsSource = await readFile(workbenchJsPath, 'utf8')

for (const selectorName of [
  'selectSpreadFootingSummaryData',
  'selectSpreadFootingChecksData',
  'selectSpreadFootingDiagramData',
  'selectSpreadFootingSectionData',
  'selectSpreadFooting3DData',
  'selectSpreadFootingReportData',
  'selectSpreadFootingCalculationBookData',
  'selectSpreadFootingDrawingData',
  'selectSpreadFootingTakeoffData',
]) {
  assert.ok(rendererSource.includes(selectorName), `renderer must import and use ${selectorName}`)
}

assert.doesNotMatch(rendererSource, /\bMath\.(?:sqrt|pow)\b/, 'renderer must not calculate resistance')
assert.doesNotMatch(rendererSource, /\b(?:phiMn|rhoW|punchingCapacity)\s*=/, 'renderer must not recreate capacity equations')
assert.doesNotMatch(rendererSource, /0\.66\s*\*|0\.42\s*\*|0\.85\s*\*/, 'renderer must not hide code coefficients')
assert.match(rendererSource, /combination\.normativeEquation/)
assert.match(rendererSource, /combination\.equation/)
assert.match(rendererSource, /combination\.applicability/)
assert.doesNotMatch(rendererSource, /ข้อ 7\(1\): นป\. = 1\.4นค\. \+ 1\.7นจ\./)
assert.doesNotMatch(
  rendererSource,
  /Table 5\.3\.1\(b\): U = 1\.2D \+ 1\.6L \+ 0\.5/
)
assert.doesNotMatch(
  rendererSource,
  /\b(?:gammaD|gammaL|loadFactorDead|loadFactorLive)\s*=/,
  'renderer must not recreate load combinations'
)
assert.doesNotMatch(
  rendererSource,
  /status\s*=\s*[^;\n]*(?:demand|capacity)[^;\n]*(?:<=|>=|<|>)/,
  'renderer must not synthesize PASS or FAIL from demand and capacity'
)
assert.doesNotMatch(
  rendererSource,
  /F01-[AB]/,
  'renderer must receive rebar marks from the Snapshot instead of hard-coding F01'
)

const defaultSnapshot = await createSpreadFootingSnapshot(
  DEFAULT_SPREAD_FOOTING_DRAFT,
  new Date('2026-07-29T03:00:00.000Z')
)
assert.equal(defaultSnapshot.ok, true, 'engine default draft must produce a selector integration Snapshot')
const defaultSurfaces = renderSpreadFootingSnapshotSurfaces(defaultSnapshot)
const defaultHydrationPlan = renderSpreadFootingSnapshotHydrationPlan(defaultSnapshot)
assert.equal(defaultHydrationPlan.modelEvidence.barA.controlLabel, 'F01-A · A/X')
assert.equal(defaultHydrationPlan.modelEvidence.barB.controlLabel, 'F01-B · B/Y')
assert.match(defaultHydrationPlan.modelEvidence.barA.title, /A\/X ↔ · ชั้นล่างสุด/)
assert.match(defaultHydrationPlan.modelEvidence.barB.title, /B\/Y ↕ · ชั้นเหนือ A/)
assert.match(
  JSON.stringify(defaultHydrationPlan.panels.three),
  new RegExp(`ชุดผลคำนวณ · ${defaultSnapshot.id}`)
)
for (const surface of ['summary', 'three']) {
  assert.match(defaultSurfaces[surface], /data-dimension="footing-a"/)
  assert.match(defaultSurfaces[surface], /data-dimension="footing-b"/)
  assert.match(defaultSurfaces[surface], /data-dimension="footing-t"/)
  assert.match(defaultSurfaces[surface], /data-dimension="column-a-b"/)
  assert.match(defaultSurfaces[surface], /data-exact-column-a-m="0\.25"/)
  assert.match(defaultSurfaces[surface], /A \/ X = 1\.5 m/)
  assert.match(defaultSurfaces[surface], /B \/ Y = 1\.5 m/)
  assert.match(defaultSurfaces[surface], /เสา a × b/)
}
for (const [surface, markup] of Object.entries(defaultSurfaces)) {
  assert.doesNotMatch(
    visibleTextFromMarkup(markup),
    /snapshot/i,
    `${surface} must not expose the internal result-set term to the user`
  )
}

const changedDimensionSnapshot = await createSpreadFootingSnapshot({
  ...DEFAULT_SPREAD_FOOTING_DRAFT,
  footingX: 1.8,
  footingY: 1.6,
  thickness: 35,
  foundationDepth: 1.05,
  columnX: 30,
  columnY: 35,
})
assert.equal(changedDimensionSnapshot.ok, true)
const changedDimensionSurfaces = renderSpreadFootingSnapshotSurfaces(changedDimensionSnapshot)
for (const surface of ['summary', 'three']) {
  assert.match(changedDimensionSurfaces[surface], /data-exact-footing-a-m="1\.8"/)
  assert.match(changedDimensionSurfaces[surface], /data-exact-footing-b-m="1\.6"/)
  assert.match(changedDimensionSurfaces[surface], /data-exact-footing-t-m="0\.35/)
  assert.match(changedDimensionSurfaces[surface], /data-exact-column-a-m="0\.3"/)
  assert.match(changedDimensionSurfaces[surface], /data-exact-column-b-m="0\.35/)
  assert.match(changedDimensionSurfaces[surface], /A \/ X = 1\.8 m/)
  assert.match(changedDimensionSurfaces[surface], /B \/ Y = 1\.6 m/)
}
for (const [surfaceName, markup] of Object.entries(defaultSurfaces)) {
  assert.match(
    markup,
    new RegExp(`data-profile-id="${defaultSnapshot.profileId}"`),
    `${surfaceName} surface must carry the resolved profile ID from the same Snapshot`
  )
}
const coreCheckIds = [
  'bearing-capacity',
  'flexure-capacity-a',
  'flexure-capacity-b',
  'one-way-shear-a',
  'one-way-shear-b',
  'punching-shear',
]

for (const surface of ['dc', 'report']) {
  for (const checkId of coreCheckIds) {
    assert.match(
      defaultSurfaces[surface],
      new RegExp(`data-check-id="${checkId}"`),
      `${surface} must include core decision check ${checkId}`
    )
  }
  assert.match(
    defaultSurfaces[surface],
    new RegExp(`data-check-id="${defaultSnapshot.results.overall.governingCheckId}"`),
    `${surface} must include the governing check`
  )
}
const defaultCalcPresentation = defaultSurfaces.calc.split(
  '<details class="calc-evidence-vault">'
)[0]
assert.equal(
  [...defaultSurfaces.report.matchAll(/<article class="report-sheet report-product report-bw"/g)].length,
  2,
  'A4 must contain exactly two portrait calculation sheets'
)
for (const pageNumber of ['1', '2']) {
  const pageTag = defaultSurfaces.report.match(
    new RegExp(`<article class="report-sheet report-product report-bw"[^>]*data-report-page="${pageNumber}"[^>]*>`)
  )?.[0]
  assert.ok(pageTag, `A4 page ${pageNumber} must exist`)
  for (const [attribute, expected] of [
    ['data-snapshot-id', defaultSnapshot.id],
    ['data-payload-hash', defaultSnapshot.payloadHash],
    ['data-calculation-fingerprint', defaultSnapshot.calculationFingerprint],
    ['data-profile-id', defaultSnapshot.designBasis.profileId],
    ['data-member-mark', DEFAULT_SPREAD_FOOTING_DRAFT.memberMark],
    ['data-revision', DEFAULT_SPREAD_FOOTING_DRAFT.revision],
  ]) {
    assert.match(
      pageTag,
      new RegExp(`${attribute}="${String(expected).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
      `A4 page ${pageNumber} must carry identical ${attribute} trace evidence`
    )
  }
}
const alternateProfileSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    designStandardProfileId: 'SF-SDM-ACI31819-DL-R1',
    combination: 'ACI_318_19_1_2D_1_6L',
    loadApplicabilityConfirmed: true,
  },
  new Date('2026-07-29T03:00:30.000Z')
)
assert.equal(alternateProfileSnapshot.ok, true, 'alternate executable profile fixture must resolve')
const alternateProfileReport = renderSpreadFootingReportSurface(alternateProfileSnapshot)
const alternateProfileCalc = renderSpreadFootingCalculationBookSurface(
  alternateProfileSnapshot
)
const alternateProfileSurfaces = renderSpreadFootingSnapshotSurfaces(alternateProfileSnapshot)
for (const [surfaceName, markup] of Object.entries(alternateProfileSurfaces)) {
  assert.match(
    markup,
    /data-profile-id="SF-SDM-ACI31819-DL-R1"/,
    `${surfaceName} surface must carry the alternate resolved profile ID`
  )
}
const alternateProfileOpenNarrative = alternateProfileCalc.split(
  '<details class="calc-evidence-vault">'
)[0]
const defaultDesignBasisChapter = defaultSurfaces.calc.match(
  /<section\s+class="calc-chapter" id="sf-calc-design-basis">[\s\S]*?<\/section>/
)?.[0]
const alternateDesignBasisChapter = alternateProfileCalc.match(
  /<section\s+class="calc-chapter" id="sf-calc-design-basis">[\s\S]*?<\/section>/
)?.[0]
assert.ok(defaultDesignBasisChapter, 'Hybrid evidence vault must retain its design-basis chapter')
assert.match(
  defaultDesignBasisChapter,
  /มาตรฐานกำลังชิ้นส่วน \/ ฉบับ<\/dt><dd>ACI 318-19 · สูตรกำลังชิ้นส่วน · 318-19/
)
assert.match(
  defaultDesignBasisChapter,
  /มาตรฐานชุดน้ำหนัก \/ ฉบับ<\/dt><dd>กฎกระทรวง พ\.ศ\. 2566 · ข้อ 7\(1\) · U = 1\.4D \+ 1\.7L · B\.E\. 2566/
)
assert.match(
  defaultDesignBasisChapter,
  /ข้อกำหนด \/ สมการชุดน้ำหนัก<\/dt><dd>Article 7\(1\) · U = 1\.4D \+ 1\.7L/
)
assert.match(
  defaultDesignBasisChapter,
  /สมการมาตรฐานต้นฉบับ<\/dt><dd>นป\. = 1\.4นค\. \+ 1\.7นจ\./
)
assert.match(
  defaultDesignBasisChapter,
  /ขอบเขตสมการที่ใช้<\/dt><dd>แทน U = นป\., D = นค\. และ L = นจ\.; นจ\. ต้องรวมแรงกระแทก/
)
assert.doesNotMatch(
  defaultDesignBasisChapter,
  /ACI 318-19 · สูตรกำลังชิ้นส่วน · B\.E\. 2566/,
  'Hybrid evidence must never pair the member-resistance label with the load-standard edition'
)
assert.ok(
  alternateDesignBasisChapter,
  'alternate ACI evidence vault must retain its design-basis chapter'
)
assert.match(
  alternateDesignBasisChapter,
  /มาตรฐานกำลังชิ้นส่วน \/ ฉบับ<\/dt><dd>ACI 318-19 · สูตรกำลังชิ้นส่วน · 318-19/
)
assert.match(
  alternateDesignBasisChapter,
  /มาตรฐานชุดน้ำหนัก \/ ฉบับ<\/dt><dd>ACI 318-19 · Table 5\.3\.1\(b\) · U = 1\.2D \+ 1\.6L · 318-19/
)
assert.match(
  alternateDesignBasisChapter,
  /ข้อกำหนด \/ สมการชุดน้ำหนัก<\/dt><dd>Table 5\.3\.1\(b\) · U = 1\.2D \+ 1\.6L/
)
assert.match(
  alternateDesignBasisChapter,
  /สมการมาตรฐานต้นฉบับ<\/dt><dd>U = 1\.2D \+ 1\.6L \+ 0\.5\(Lr or S or R\)/
)
assert.match(
  alternateDesignBasisChapter,
  /ขอบเขตสมการที่ใช้<\/dt><dd>โปรไฟล์ R1 ใช้ได้เฉพาะเมื่อผู้รับผิดชอบยืนยันว่า Lr, S และ R ไม่ใช้/
)
assert.match(alternateProfileReport, /ACI 318-19 · 1\.2D \+ 1\.6L/)
assert.match(alternateProfileReport, /data-profile-id="SF-SDM-ACI31819-DL-R1"/)
for (const markup of [alternateProfileReport, alternateProfileCalc]) {
  assert.match(
    markup,
    /การยืนยันขอบเขต:[\s\S]*?ยืนยันแล้วว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้/,
    'ACI A4 and Flow 07 must print the confirmed load-applicability state'
  )
}
assert.doesNotMatch(
  defaultSurfaces.report,
  /การยืนยันขอบเขต:/,
  'the Thai profile must not print an irrelevant ACI acknowledgement'
)
const defaultLoadStandardCell = defaultSurfaces.report.match(
  /<th scope="row">มาตรฐานชุดน้ำหนัก<\/th><td>[\s\S]*?<\/td>/
)?.[0]
assert.ok(defaultLoadStandardCell, 'Hybrid A4 must render the load-standard table cell')
assert.match(
  defaultLoadStandardCell,
  /<strong>กฎกระทรวง พ\.ศ\. 2566 · ข้อ 7\(1\) · U = 1\.4D \+ 1\.7L<\/strong>[\s\S]*Article 7\(1\)[\s\S]*U = 1\.4D \+ 1\.7L/,
  'Hybrid A4 must lead with the resolved Thai load-standard label and retain combination clause/equation'
)
const alternateLoadStandardCell = alternateProfileReport.match(
  /<th scope="row">มาตรฐานชุดน้ำหนัก<\/th><td>[\s\S]*?<\/td>/
)?.[0]
assert.ok(alternateLoadStandardCell, 'alternate A4 must render the load-standard table cell')
assert.match(
  alternateLoadStandardCell,
  /<strong>ACI 318-19 · Table 5\.3\.1\(b\) · U = 1\.2D \+ 1\.6L<\/strong>[\s\S]*Table 5\.3\.1\(b\)[\s\S]*U = 1\.2D \+ 1\.6L/,
  'alternate A4 must lead with its resolved load-standard label and retain combination clause/equation'
)
for (const markup of [defaultSurfaces.report, defaultSurfaces.calc]) {
  assert.match(markup, /Article 7\(1\): นป\. = 1\.4นค\. \+ 1\.7นจ\./)
  assert.match(markup, /สมการที่ Engine ใช้: U = 1\.4D \+ 1\.7L/)
  assert.match(markup, /ขอบเขต: แทน U = นป\., D = นค\. และ L = นจ\.; นจ\. ต้องรวมแรงกระแทก/)
}
for (const markup of [alternateProfileReport, alternateProfileCalc]) {
  assert.match(
    markup,
    /Table 5\.3\.1\(b\): U = 1\.2D \+ 1\.6L \+ 0\.5\(L<sub>r<\/sub> or S or R\)/
  )
  assert.match(
    markup,
    /สมการที่ Engine ใช้: U = 1\.2D \+ 1\.6L/
  )
  assert.match(markup, /ขอบเขต: โปรไฟล์ R1 ใช้ได้เฉพาะเมื่อผู้รับผิดชอบยืนยันว่า L<sub>r<\/sub>, S และ R ไม่ใช้/)
}
assert.equal(
  [...alternateProfileReport.matchAll(/data-report-page="[12]"/g)].length,
  2,
  'alternate profile report must retain the exact two-page contract'
)
assert.equal(
  [...alternateProfileReport.matchAll(/data-a4-equation-id="/g)].length,
  9,
  'alternate profile report must retain all nine principal Snapshot equations'
)
assert.match(
  alternateProfileReport,
  /data-a4-equation-id="SF-EQ-ACI_318_19_1_2D_1_6L"/,
  'alternate profile A4 must use its own precomputed load-combination equation'
)
assert.doesNotMatch(
  alternateProfileReport,
  /data-a4-equation-id="SF-EQ-TH_MR_2566_C7_1_4D_1_7L"/,
  'alternate profile A4 must not retain the default load-combination equation'
)
assert.equal(
  [...alternateProfileOpenNarrative.matchAll(/class="calc-story-card\b/g)].length,
  9,
  'alternate profile Flow 07 must retain exactly nine open narrative sections'
)
assert.doesNotMatch(
  alternateProfileOpenNarrative,
  /Bar Cut|BBS|ความยาวพัฒนา|บัญชีผลิต/,
  'alternate profile Flow 07 must keep fabrication narrative outside the open calculation'
)
assert.equal(
  [...defaultSurfaces.report.matchAll(/data-a4-compact-drawing="(?:plan|section)"/g)].length,
  2,
  'A4 must use two dedicated compact drawings instead of shrinking full-size drawing SVGs'
)
assert.match(
  defaultSurfaces.report,
  /data-a4-compact-drawing="plan"[\s\S]*8-DB16[\s\S]*data-a4-compact-drawing="section"[\s\S]*ระยะหุ้ม 50 mm/,
  'compact plan and section must keep selected reinforcement and 50 mm cover legible'
)
assert.match(
  defaultSurfaces.report,
  /data-plan-callout="A" data-axis="X"[\s\S]*?data-callout-leader="A" data-leader-target="barA"[\s\S]*?F01-A · A\/X ↔ · ชั้นล่างสุด[\s\S]*?8-DB16/,
  'compact plan A leader must name A/X and terminate on an actual horizontal reinforcement line'
)
assert.match(
  defaultSurfaces.report,
  /data-plan-callout="B" data-axis="Y"[\s\S]*?data-callout-leader="B" data-leader-target="barB"[\s\S]*?F01-B · B\/Y ↕ · ชั้นเหนือ A[\s\S]*?8-DB16/,
  'compact plan B leader must name B/Y and terminate on an actual vertical reinforcement line'
)
const defaultCompactPlan =
  defaultSurfaces.report.match(
    /<svg[^>]+data-a4-compact-drawing="plan"[\s\S]*?<\/svg>/
  )?.[0] || ''
assert.ok(defaultCompactPlan, 'compact A4 plan must be rendered')
assert.doesNotMatch(
  defaultCompactPlan,
  /class="a4-compact-callout[^"]*"[\s\S]*?<rect/,
  'compact A4 plan direction leaders must not fall back to floating callout boxes'
)
assert.match(
  defaultCompactPlan,
  /data-section-tag="X-left">X<\/text>[\s\S]*data-section-tag="X-right">X<\/text>/,
  'compact A4 plan must label both ends of the X-X section line'
)
assert.match(
  defaultSurfaces.report,
  /y="207" text-anchor="middle"[\s\S]*?>ฐาน [^<]+<\/text>[\s\S]*?<text x="404" y="207" text-anchor="end">NTS<\/text>/,
  'compact plan footing label and NTS must remain inset from the viewBox edges'
)
assert.match(
  defaultSurfaces.report,
  /class="a4-compact-dimensions"[\s\S]*?data-dimension-rail="section"[\s\S]*?data-section-dimension="thickness"[\s\S]*?data-section-dimension-value="thickness"[\s\S]*?data-section-dimension="dA"[\s\S]*?data-section-dimension-value="dA"[\s\S]*?data-section-dimension="dB"[\s\S]*?data-section-dimension-value="dB"[\s\S]*?data-section-dimension="cover"[\s\S]*?data-section-dimension-value="cover"[\s\S]*?data-section-callout="A"[\s\S]*?data-section-callout="B"[\s\S]*?<text x="404" y="32" text-anchor="end">NTS<\/text>/,
  'compact section must keep every dimension in an inset label/value rail before the reinforcement callouts'
)
assert.match(
  defaultSurfaces.report,
  /data-document-class="CALCULATION_REVIEW"/
)
assert.doesNotMatch(
  defaultSurfaces.report,
  /ENGINEERING REVIEW REQUIRED|NOT FOR CONSTRUCTION|NOT RELEASED BBS|เพื่อการตรวจสอบ · ไม่ใช่เอกสารอนุมัติให้ก่อสร้าง/
)
assert.match(
  defaultSurfaces.report,
  /data-document-status="REVIEW"[\s\S]*data-calculation-result="PASS"[\s\S]*รายการที่คำนวณ · ผ่าน · O\.K\./,
  'A4 must separate the passing calculated checks from the locked document REVIEW state'
)
assert.match(
  defaultSurfaces.report,
  /data-a4-scope-state="NOT_EVALUATED"[\s\S]*สถานะรวม · REVIEW · ขอบเขตนอก R1 ยังไม่ประเมิน/,
  'A4 must disclose unevaluated scope without mixing raw HOLD records into the result table'
)
const defaultA4CheckTable =
  defaultSurfaces.report.match(/<section class="a4-checks"[\s\S]*?<\/section>/)?.[0] || ''
assert.ok(defaultA4CheckTable, 'A4 must retain its compact evaluated-result table')
assert.doesNotMatch(
  visibleTextFromMarkup(defaultA4CheckTable),
  /\bHOLD\b/,
  'A4 evaluated-result table must not contain HOLD rows or counts'
)
for (const check of defaultSnapshot.results.checks.filter(
  (record) => record.applicability !== 'EVALUATED'
)) {
  assert.doesNotMatch(
    defaultA4CheckTable,
    new RegExp(`data-check-id="${check.id}"`),
    `A4 evaluated-result table must omit unevaluated record ${check.id}`
  )
}

const failSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    deadLoad: 300000,
    liveLoad: 200000,
    barsA: 6,
    barsB: 6,
    barDiaA: 'DB12',
    barDiaB: 'DB12',
  },
  new Date('2026-07-29T03:02:00.000Z')
)
const failSummarySurface = renderSpreadFootingSummarySurface(failSnapshot)
assert.match(
  failSummarySurface,
  /ผลที่ประเมิน · FAIL/,
  'default Summary selector must project a real evaluated failure'
)
assert.equal(failSnapshot.ok, true, 'high-demand fixture must create a valid FAIL Snapshot')
const failSurfaces = renderSpreadFootingSnapshotSurfaces(failSnapshot)
const failHydrationPlan = renderSpreadFootingSnapshotHydrationPlan(failSnapshot)
assert.match(
  failSurfaces.report,
  /data-document-status="REVIEW"[\s\S]*data-calculation-result="FAIL"[\s\S]*รายการไม่ผ่าน · FAIL/,
  'A4 must keep document REVIEW while preserving an evaluated FAIL result'
)
assert.doesNotMatch(
  visibleTextFromMarkup(failSurfaces.report),
  /provided-steel-[ab]|short-direction-band-distribution|punching-minimum-steel-[ab]/,
  'A4 must show compact check codes and Thai labels instead of wrapping raw engine IDs'
)
assert.doesNotMatch(
  visibleTextFromMarkup(failSurfaces.report),
  /ขอบเขตของรายงาน|การทรุดตัว|Bar Cut/,
  'A4 must stay focused on evaluated footing calculation results'
)
const evaluatedFailIds = failSnapshot.results.checks
  .filter((check) => check.applicability === 'EVALUATED' && check.status === 'FAIL')
  .map((check) => check.id)
const invalidatingHoldCheckIds = new Set([
  'strength-applicability',
  'provided-steel-a',
  'provided-steel-b',
  'short-direction-band-distribution',
  'punching-minimum-steel-a',
  'punching-minimum-steel-b',
  'durability-cover',
  'minimum-clear-spacing',
  'development-anchorage',
  'column-footing-transfer',
])
const invalidatingHoldIds = failSnapshot.results.checks
  .filter((check) => check.status === 'HOLD' && invalidatingHoldCheckIds.has(check.id))
  .map((check) => check.id)
assert.ok(evaluatedFailIds.length > 1, 'high-demand fixture must exercise multiple evaluated FAIL rows')
assert.ok(invalidatingHoldIds.length > 1, 'high-demand fixture must exercise the R1 HOLD register')
assert.match(
  failSurfaces.report,
  /data-a4-supplemental-failures="4"/,
  'A4 must surface every evaluated non-core FAIL without expanding the six-row core table'
)
for (const checkId of [
  'provided-steel-a',
  'provided-steel-b',
  'punching-minimum-steel-a',
  'punching-minimum-steel-b',
]) {
  assert.match(
    failSurfaces.report,
    new RegExp(`data-check-id="${checkId}"`),
    `A4 supplemental failure strip must include ${checkId}`
  )
}

const rectangularDistributionSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    footingX: 2,
    footingY: 1.5,
    barsB: 11,
    barDiaB: 'DB12',
  },
  new Date('2026-07-29T03:03:00.000Z')
)
assert.equal(
  rectangularDistributionSnapshot.results.overall.governingCheckId,
  'short-direction-band-distribution',
  'rectangular regression must isolate the short-direction band distribution verdict'
)
const rectangularDistributionReport = renderSpreadFootingReportSurface(
  rectangularDistributionSnapshot
)
assert.match(
  rectangularDistributionReport,
  /data-calculation-result="FAIL"/,
  'A4 must preserve the rectangular-footing distribution FAIL at report level'
)
assert.match(
  rectangularDistributionReport,
  /data-a4-supplemental-failures="1"[\s\S]*data-check-id="short-direction-band-distribution"/,
  'A4 must name the evaluated short-direction band distribution FAIL'
)
assert.match(
  rectangularDistributionReport,
  /data-rebar-check="provided-steel-b"[\s\S]*?data-rebar-result="FAIL"[\s\S]*?ผลรวมทิศ B · ไม่ผ่าน · FAIL/,
  'selected reinforcement B must aggregate the governing distribution FAIL'
)
assert.match(
  rectangularDistributionReport,
  /data-rebar-check="provided-steel-a"[\s\S]*?data-rebar-result="PASS"[\s\S]*?ผลรวมทิศ A · ผ่าน · O\.K\./,
  'unaffected reinforcement A must retain its directional PASS'
)

const tensionControlSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    barsA: 40,
    barsB: 40,
    barDiaA: 'DB32',
    barDiaB: 'DB32',
  },
  new Date('2026-07-29T03:04:00.000Z')
)
const tensionControlReport = renderSpreadFootingReportSurface(tensionControlSnapshot)
for (const checkId of ['tension-controlled-a', 'tension-controlled-b']) {
  assert.match(
    tensionControlReport,
    new RegExp(`data-check-id="${checkId}"`),
    `A4 must surface the evaluated ${checkId} failure`
  )
}
assert.match(
  tensionControlReport,
  /data-a4-supplemental-failures="2"/,
  'A4 must disclose both directional tension-control failures'
)
assert.match(
  tensionControlReport,
  /data-calculation-result="FAIL"/,
  'tension-control failure must keep the A4 calculated result at FAIL'
)

for (const checkId of new Set([
  ...coreCheckIds,
  failSnapshot.results.overall.governingCheckId,
  ...evaluatedFailIds,
])) {
  assert.match(
    failSurfaces.dc,
    new RegExp(`data-check-id="${checkId}"`),
    `D/C main view must include governing/core/evaluated FAIL result ${checkId}`
  )
}
for (const checkId of new Set([
  ...coreCheckIds,
  failSnapshot.results.overall.governingCheckId,
  ...evaluatedFailIds,
])) {
  assert.match(
    failSurfaces.report,
    new RegExp(`data-check-id="${checkId}"`),
    `A4 must include governing/core/evaluated FAIL result ${checkId}`
  )
}
for (const checkId of invalidatingHoldIds) {
  assert.doesNotMatch(
    failSurfaces.dc,
    new RegExp(`data-check-id="${checkId}"`),
    `D/C main view must not mix unevaluated record ${checkId} into results`
  )
  assert.doesNotMatch(
    failSurfaces.report,
    new RegExp(`data-check-id="${checkId}"`),
    `A4 must not mix unevaluated HOLD record ${checkId} into calculated results`
  )
  assert.match(
    failSurfaces.calc,
    new RegExp(`data-check-id="${checkId}"`),
    `the closed calculation evidence vault must retain audit record ${checkId}`
  )
}
const failCalcPresentation = failSurfaces.calc.split('<details class="calc-evidence-vault">')[0]
assert.doesNotMatch(
  visibleTextFromMarkup(failCalcPresentation),
  /\bHOLD\b/,
  'Flow 07 main calculation story must not report HOLD as a calculation result'
)
assert.doesNotMatch(
  visibleTextFromMarkup(failSurfaces.report),
  /\bHOLD\b/,
  'A4 main report must not report HOLD as a calculation result'
)
for (const checkId of evaluatedFailIds) {
  assert.match(
    failCalcPresentation,
    new RegExp(`data-summary-check="${checkId}"`),
    `Flow 07 summary must surface every evaluated FAIL ${checkId}`
  )
}
for (const checkId of invalidatingHoldIds) {
  if (evaluatedFailIds.includes(checkId)) continue
  if (failSnapshot.results.checks.find((check) => check.id === checkId)?.status !== 'HOLD') continue
  assert.doesNotMatch(
    failCalcPresentation,
    new RegExp(`data-summary-check="${checkId}"`),
    `Flow 07 summary must keep unevaluated record ${checkId} out of result rows`
  )
}
for (const [label, momentX] of [
  ['nonzero moment', 1000],
  ['partial contact', 10000],
]) {
  const boundarySnapshot = await createSpreadFootingSnapshot(
    {
      ...DEFAULT_SPREAD_FOOTING_DRAFT,
      mx: momentX,
      my: 0,
    },
    new Date('2026-07-29T03:03:00.000Z')
  )
  assert.equal(boundarySnapshot.ok, true, `${label} fixture must create a valid Snapshot`)
  const boundaryCalculation = renderSpreadFootingCalculationBookSurface(boundarySnapshot)
  const boundaryPresentation = boundaryCalculation.split(
    '<details class="calc-evidence-vault">'
  )[0]
  assert.doesNotMatch(
    visibleTextFromMarkup(boundaryPresentation),
    /\bHOLD\b/,
    `${label} Flow 07 presentation must keep raw HOLD wording inside the closed vault`
  )
  assert.match(
    boundaryCalculation,
    /<details class="calc-evidence-vault">[\s\S]*?\bHOLD\b/,
    `${label} Flow 07 evidence vault must retain the raw engineering audit`
  )
  assert.doesNotMatch(
    visibleTextFromMarkup(renderSpreadFootingReportSurface(boundarySnapshot)),
    /\bHOLD\b/,
    `${label} A4 must not leak raw HOLD equation substitutions`
  )
  const boundaryAnalysis = renderSpreadFootingAnalysisSurface(boundarySnapshot)
  assert.equal(
    [...boundaryAnalysis.matchAll(/class="chart-result\b/g)].length,
    0,
    `${label} analysis must not draw synthetic BMD/SFD result lines`
  )
  assert.equal(
    [...boundaryAnalysis.matchAll(/ไม่มีเส้นผลคำนวณ/g)].length,
    4,
    `${label} analysis must fail closed with an explicit empty graph state`
  )
  const boundaryReport = renderSpreadFootingReportSurface(boundarySnapshot)
  assert.equal(
    [...boundaryReport.matchAll(/class="chart-result\b/g)].length,
    0,
    `${label} A4 must not draw synthetic BMD/SFD result lines`
  )
  assert.equal(
    [...boundaryReport.matchAll(/data-a4-not-evaluated=/g)].length,
    5,
    `${label} A4 must replace all unevaluated strength results with neutral closed blocks`
  )
  assert.equal(
    [...boundaryReport.matchAll(/data-a4-equation-id="/g)].length,
    9,
    `${label} A4 must retain all nine principal equation IDs without leaking raw HOLD substitutions`
  )
  assert.equal(
    [...boundaryReport.matchAll(/data-report-page="[12]"/g)].length,
    2,
    `${label} A4 must retain its exact two-page physical report contract`
  )
  assert.doesNotMatch(
    boundaryReport,
    /φM<sub>n<\/sub>|V<sub>u<\/sub> \/ φV<sub>c<\/sub>|v<sub>c1<\/sub>/,
    `${label} A4 must not expose standalone numeric capacity evidence outside R1`
  )
}
const failDeflectionRegion = failHydrationPlan.panels.analysis.regions.find(
  (region) => region.slot === 'analysis-deflection'
)
assert.ok(failDeflectionRegion, 'high-demand Snapshot must also hydrate symbolic deflection')
assert.ok(
  failSurfaces.analysis.includes(
    `${failSnapshot.results.loads.factored.columnReactionKN.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} kN`
  ),
  'high-demand symbolic deflection must display the current factored column reaction'
)
assert.notEqual(
  failSnapshot.results.loads.factored.columnReactionKN,
  defaultSnapshot.results.loads.factored.columnReactionKN,
  'dynamic Pu fixture must differ from the default run'
)

assert.ok(Object.isFrozen(defaultHydrationPlan), 'hydration plan must be deeply frozen')
assert.equal(defaultHydrationPlan.snapshotId, defaultSnapshot.id)
assert.equal(defaultHydrationPlan.payloadHash, defaultSnapshot.payloadHash)
assert.equal(defaultHydrationPlan.fingerprint, defaultSnapshot.fingerprint)
assert.equal(
  defaultHydrationPlan.calculationFingerprint,
  defaultSnapshot.calculationFingerprint
)
assert.notEqual(
  defaultHydrationPlan.fingerprint,
  defaultHydrationPlan.calculationFingerprint,
  'input and calculation fingerprints are distinct evidence and must not be flattened'
)
assert.deepEqual(
  new Set(Object.keys(defaultHydrationPlan.panels)),
  new Set(expectedSurfaceKeys),
  'hydration plan must cover the same eight approved panel shells'
)
for (const surface of expectedSurfaceKeys.filter((name) => name !== 'calc')) {
  assert.doesNotMatch(
    visibleTextFromMarkup(defaultHydrationPlan.markup[surface]),
    /\bHOLD\b/,
    `${surface} customer-facing projection must not present HOLD as a calculation result`
  )
}
for (const [surface, panelPlan] of Object.entries(defaultHydrationPlan.panels)) {
  assert.ok(Object.isFrozen(panelPlan), `${surface} hydration panel must be frozen`)
  for (const region of panelPlan.regions) {
    assert.ok(
      workbenchHtmlSource.includes(`data-sf-slot="${region.slot}"`),
      `${surface} hydration slot ${region.slot} must exist in the neutral Flow shell`
    )
  }
}

assert.equal(
  [...workbenchHtmlSource.matchAll(/\bdata-sf-flow-shell="([^"]+)"/g)].length,
  8,
  'the workbench must keep exactly eight neutral Flow shells'
)
for (const surface of expectedSurfaceKeys) {
  assert.match(
    workbenchHtmlSource,
    new RegExp(`data-panel="${surface}"[^>]*data-sf-flow-shell="${surface}"`),
    `${surface} must use the neutral Flow shell marker`
  )
}
assert.doesNotMatch(
  workbenchJsSource,
  /snapshot-generated-mount/,
  'controller must hydrate the approved shell instead of mounting a parallel result tree'
)
assert.doesNotMatch(
  workbenchJsSource,
  /staticSurfaceChildren/,
  'controller must not hide direct children of the approved Flow shell'
)
assert.doesNotMatch(
  workbenchJsSource,
  /restoreReferenceSlots|referenceSurfaceSlots|referenceRuntimeCanvasMarkup|__spreadFootingReferenceGeometry/,
  'the controller must not retain a runtime Reference-result restore path'
)

const mainDcRows = [...defaultSurfaces.dc.matchAll(/data-check-id="/g)].length
const calculationBookRows = [...defaultSurfaces.calc.matchAll(/data-check-id="/g)].length
const calculationBookEquations = [...defaultSurfaces.calc.matchAll(/data-equation-id="/g)].length
assert.ok(
  mainDcRows >= coreCheckIds.length,
  'main D/C view must include at least the six core decision checks'
)
assert.equal(calculationBookRows, 26, 'Calculation Book must retain the complete check ledger')
assert.equal(calculationBookEquations, 36, 'Calculation Book must retain the complete equation ledger')
assert.equal(
  [...defaultSurfaces.calc.matchAll(/data-summary-check="/g)].length,
  9,
  'Calculation Book must put the nine governing footing results ahead of the equation ledger'
)
assert.match(defaultSurfaces.calc, /รายการที่ประเมินแล้วผ่าน · OK/)
assert.match(defaultSurfaces.calc, /<strong class="is-pass">OK<\/strong>/)
for (const calculationStep of [
  'ข้อมูลออกแบบและโพรไฟล์ที่ระบบจับคู่แล้ว',
  'น้ำหนักฐานและดินเหนือฐาน',
  'แรงดันดินใช้งานและการสัมผัส',
  'แรงประลัยและสมดุลแรงดัน',
  'ระยะยื่นและความลึกประสิทธิผล',
  'กำลังดัดและเหล็กเสริม',
  'แรงเฉือนทางเดียว ทิศ A และ B',
  'แรงเฉือนทะลุภายในรอบเสากลาง',
  'สรุปผล เหล็กที่เลือก และสายตรวจสอบ',
]) {
  assert.match(
    defaultSurfaces.calc,
    new RegExp(calculationStep),
    `Calculation Book must expose professional footing sequence step ${calculationStep}`
  )
}
assert.equal(
  [...defaultCalcPresentation.matchAll(/class="calc-story-card\b/g)].length,
  9,
  'Flow 07 must keep exactly nine open calculation sections'
)
assert.deepEqual(
  [...defaultCalcPresentation.matchAll(/data-calculation-step="([1-9])"/g)].map(
    (match) => match[1]
  ),
  ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  'Flow 07 narrative sections must be numbered in professional calculation order'
)
assert.doesNotMatch(
  defaultCalcPresentation,
  /ลำดับคำนวณสำคัญและผลตรวจจาก Snapshot เดียว|เหล็กเสริมและ Bar Cut|NOT RELEASED BBS/,
  'Flow 07 must remove the old heading and Bar Cut narrative'
)
assert.match(defaultSurfaces.calc, /ผ่าน · OK/)
assert.doesNotMatch(
  visibleTextFromMarkup(defaultCalcPresentation),
  /\bHOLD\b/,
  'Flow 07 main calculation story must show only evaluated OK/FAIL results'
)
assert.match(
  defaultCalcPresentation,
  /ประเมินแล้ว \d+ · ผ่าน \d+ · ไม่ผ่าน 0/,
  'Flow 07 headline must count evaluated calculation results without a HOLD count'
)
assert.match(
  defaultSurfaces.calc,
  /<details class="calc-evidence-vault">[\s\S]*?\bHOLD\b/,
  'raw HOLD audit evidence must remain inside the closed evidence vault'
)
assert.match(
  defaultSurfaces.report,
  /P<sub>service,gross<\/sub>[\s\S]*?q<sub>u,gross<\/sub> \/ q<sub>u,net<\/sub>/
)
assert.match(defaultSurfaces.report, /ระยะยื่น A \/ B/)
assert.match(defaultSurfaces.report, /dA \/ dB \/ d punching/)
assert.match(
  defaultSurfaces.report,
  /<span>แนววิกฤต<\/span>[\s\S]*?d =[\s\S]*?b<sub>o<\/sub> =/
)
assert.match(
  defaultSurfaces.report,
  /data-check-id="bearing-capacity"[\s\S]*?ผ่าน · OK/,
  'A4 must show a clear Thai OK result for an evaluated passing footing check'
)
assert.doesNotMatch(defaultSurfaces.dc, /provided-steel-a|provided-steel-b/)
assert.match(defaultSurfaces.calc, /data-check-id="provided-steel-a"/)
assert.match(defaultSurfaces.calc, /data-check-id="provided-steel-b"/)
for (const surface of ['summary', 'dc', 'report', 'calc']) {
  assert.match(
    defaultSurfaces[surface],
    new RegExp(
      DEFAULT_SPREAD_FOOTING_DRAFT.sbcSource.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ),
    `${surface} must preserve the input SBC provenance`
  )
}
assert.match(
  defaultSurfaces.report,
  new RegExp(
    `data-sbc-source="${DEFAULT_SPREAD_FOOTING_DRAFT.sbcSource.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    )}"`
  ),
  'A4 must carry the exact input SBC provenance as trace data'
)

for (const [surface, markup] of Object.entries(defaultHydrationPlan.markup)) {
  if (surface === 'calc') continue
  if (surface === 'report') {
    assert.doesNotMatch(
      markup,
      /sf-equation-record|sf-equation-ledger/,
      'A4 must not expose the backstage equation ledger'
    )
    assert.equal(
      [...markup.matchAll(/data-a4-equation-id="/g)].length,
      9,
      'A4 must expose the nine compact worked formulas across the two-page calculation report'
    )
    continue
  }
  assert.doesNotMatch(
    markup,
    /sf-equation-record|sf-equation-ledger|data-equation-id=/,
    `${surface} must not expose the backstage equation ledger`
  )
}
const summaryMetricsRegion = defaultHydrationPlan.panels.summary.regions.find(
  (region) => region.slot === 'summary-metrics'
)
assert.ok(summaryMetricsRegion, 'Summary hydration must include the approved metric strip')
assert.equal(
  [...summaryMetricsRegion.html.matchAll(/class="sf-metric-card\b/g)].length,
  4,
  'all four hydrated Summary cards must share the responsive wrapping contract'
)
assert.match(
  summaryMetricsRegion.html,
  /D\/C 0\.861/,
  'approved Summary topology must show the calculated default bearing ratio'
)
assert.deepEqual(
  defaultHydrationPlan.panels.analysis.regions.map((region) => region.slot),
  [
    'analysis-moment-a',
    'analysis-shear-a',
    'analysis-moment-b',
    'analysis-shear-b',
    'analysis-deflection',
  ],
  'analysis hydration must update all four chart cards and the symbolic deflection/load-path card'
)
const deflectionRegion = defaultHydrationPlan.panels.analysis.regions.find(
  (region) => region.slot === 'analysis-deflection'
)
assert.ok(deflectionRegion, 'symbolic deflection must be hydrated from the current Snapshot')
assert.ok(
  defaultSurfaces.analysis.includes(
    `${defaultSnapshot.results.loads.factored.columnReactionKN.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} kN`
  ),
  'symbolic deflection must retain the exact current factored column reaction'
)
assert.match(defaultSurfaces.analysis, /NOT EVALUATED|NOT_EVALUATED/)
assert.doesNotMatch(
  defaultSurfaces.analysis,
  /22[,\s]?500\s*kg/,
  'symbolic deflection must never carry the old fixed Pu sample'
)

for (const surface of ['summary', 'analysis', 'section']) {
  assert.doesNotMatch(
    defaultSurfaces[surface],
    /ไม่ระบุ/,
    `${surface} must consume every evaluated default selector field`
  )
}

for (const [surface, markers] of Object.entries({
  summary: [
    '1.5 m',
    '84.45 kPa',
    'data-exact-qmax-kpa="84.45160091666668"',
    'DB16',
    'dA 242 mm',
    'dB 226 mm',
  ],
  analysis: ['19.154 kN.m/m', 'data-exact-value="19.153613281250003"'],
  section: ['1719.929', 'mm', 'data-geometry-source="barCut.polylineMm"'],
})) {
  for (const marker of markers) {
    assert.ok(
      defaultSurfaces[surface].includes(marker),
      `${surface} must project the default selector value ${marker}`
    )
  }
}

assert.equal(
  [...defaultSurfaces.analysis.matchAll(/Vu @ x=d/g)].length,
  2,
  'evaluated SFD A/B must label the design shear demand at x=d'
)
assert.equal(
  [...defaultSurfaces.analysis.matchAll(/Vmax @ x=0/g)].length,
  2,
  'evaluated SFD A/B must also distinguish the face maximum from Vu@d'
)
for (const direction of ['A', 'B']) {
  const diagram = defaultSnapshot.results.diagrams[direction]
  const faceStation = diagram.stations.find((station) => station.ratio === 1)
  const edgeStation = diagram.stations.find((station) => station.ratio === 0)
  const flexureDemand = defaultSnapshot.results.checks.find(
    (check) => check.id === `flexure-capacity-${direction.toLowerCase()}`
  )?.demand?.value
  const shearDemand = defaultSnapshot.results.checks.find(
    (check) => check.id === `one-way-shear-${direction.toLowerCase()}`
  )?.demand?.value
  assert.ok(
    Math.abs(faceStation.momentKNmPerM - flexureDemand) < 1e-9,
    `BMD ${direction} face ordinate must equal the Snapshot Mu demand`
  )
  assert.ok(
    Math.abs(defaultSnapshot.results.oneWayShear[direction].vuKNPerM - shearDemand) < 1e-9,
    `SFD ${direction} critical ordinate must equal the Snapshot Vu@d demand`
  )
  assert.equal(edgeStation.momentKNmPerM, 0, `BMD ${direction} must close at the footing edge`)
  assert.equal(edgeStation.shearKNPerM, 0, `SFD ${direction} must close at the footing edge`)
}

for (const surface of ['summary', 'dc', 'analysis', 'section', 'three', 'report', 'drawing']) {
  const visibleText = visibleTextFromMarkup(defaultSurfaces[surface])
  assert.doesNotMatch(
    visibleText,
    /\d+\.\d{5,}/,
    `${surface} must not expose floating-point noise with five or more decimal places`
  )
  assert.match(
    defaultSurfaces[surface],
    /data-exact-[a-z0-9-]+="/,
    `${surface} must retain exact raw engineering values in trace attributes`
  )
}

assert.doesNotMatch(
  visibleTextFromMarkup(defaultSurfaces.summary),
  /Calculation Snapshot · Spread Footing|Gross service bearing|Isometric bearing pressure/,
  'Summary generic headings and governing label must not remain English-first'
)
for (const marker of [
  'ชุดผลคำนวณ · ฐานรากแผ่',
  'แรงดันดินใช้งานสูงสุดเทียบ SBC',
  'แรงดันดินแบบไอโซเมตริก (Bearing pressure)',
]) {
  assert.ok(
    defaultSurfaces.summary.includes(marker),
    `Summary must expose Thai-first copy: ${marker}`
  )
}
assert.match(defaultSurfaces.dc, /ค่าความต้องการ \/ ความสามารถ \(D\/C\)/)
assert.match(defaultSurfaces.analysis, /หลักฐานการวิเคราะห์/)
assert.match(defaultSurfaces.section, /แปลน \/ รูปตัด \/ แบบตัดเหล็ก \(Bar Cut\)/)
assert.match(defaultSurfaces.three, /แบบจำลอง 3D และรายการหลักฐาน/)
assert.match(defaultSurfaces.section, /data-plan-callout="A"[\s\S]*?data-axis="X"[\s\S]*?F01-A · A\/X ↔/)
assert.match(defaultSurfaces.section, /data-plan-callout="B"[\s\S]*?data-axis="Y"[\s\S]*?F01-B · B\/Y ↕/)
assert.match(defaultSurfaces.section, /data-section-direction="A" data-axis="X"[\s\S]*?ชั้นล่างสุด/)
assert.match(defaultSurfaces.section, /data-section-direction="B" data-axis="Y"[\s\S]*?ชั้นเหนือ A/)
assert.match(defaultSurfaces.three, /เหล็ก A\/X ↔ · ชั้นล่างสุด/)
assert.match(defaultSurfaces.three, /เหล็ก B\/Y ↕ · ชั้นเหนือ A/)
assert.match(defaultSurfaces.report, /03 · ผลตรวจที่คำนวณได้/)
assert.match(defaultSurfaces.drawing, /ชุดแบบ \(Drawing Pack\)/)
assert.match(defaultSurfaces.section, /ชั้นล่างสุด/)
assert.match(defaultSurfaces.section, /ชั้นเหนือเหล็กทิศ A/)
assert.match(
  defaultSurfaces.calc,
  /เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ A/
)
assert.match(
  defaultSurfaces.calc,
  /เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ B/
)
assert.equal(
  [...defaultSurfaces.drawing.matchAll(/data-responsive-svg="viewbox"/g)].length,
  4,
  'SF-01 plan, SF-02 section, and both SF-03 Bar Cut SVGs must use responsive viewBox sizing'
)

const buttEndedBars = [
  ...defaultSurfaces.section.matchAll(/<(?:polyline|path)\b[^>]*data-cut-end="butt"[^>]*>/g),
]
assert.ok(
  buttEndedBars.length >= 3,
  'Section and both Bar Cut details must expose an explicit butt-ended cut-face contract'
)
for (const tag of buttEndedBars) {
  assert.match(tag[0], /stroke-linecap="butt"/, 'cut faces must stop at their exact Snapshot endpoint')
  assert.match(tag[0], /stroke-linejoin="round"/, '90-degree bend joins must remain rounded')
}
assert.doesNotMatch(
  defaultSurfaces.section,
  /<(?:polyline|path)\b[^>]*data-cut-end="butt"[^>]*stroke-linecap="round"/,
  'a cut-end contract must never regain a round cap'
)

for (const [contract, pattern] of [
  [
    'generated A4 must restore the Beam-family flex height budget',
    /\.report-product\.sf-snapshot-surface\s*\{[\s\S]*?display:\s*flex;[\s\S]*?gap:\s*0;/,
  ],
  [
    'generated A4 section rhythm must stay within the physical one-sheet budget',
    /\.report-product\.sf-snapshot-surface > section\s*\{[\s\S]*?margin-top:\s*0\.8mm;/,
  ],
  [
    'generated A4 worked calculations must use a compact two-column ledger',
    /\.report-product \.a4-worked-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2,/,
  ],
  [
    'generated A4 punching evidence must span the worked ledger width',
    /\.report-product \.a4-worked-card--wide\s*\{[\s\S]*?grid-column:\s*1\s*\/\s*-1;/,
  ],
  [
    'generated A4 worked evidence must keep the Sarabun minimum size',
    /\.report-product \.a4-worked-card > header :is\(b,\s*em\)\s*\{[\s\S]*?font-size:\s*7\.5pt;/,
  ],
  [
    'A4 header and footer must retain their full intrinsic height',
    /\.report-product\.sf-snapshot-surface > :is\(\.report-sheet__header,\s*\.a4-footer\)\s*\{[\s\S]*?flex-shrink:\s*0;/,
  ],
  [
    'A4 worked calculation ledger must not flex-shrink over the footer',
    /\.report-product \.a4-worked-calculations\s*\{[\s\S]*?flex-shrink:\s*0;/,
  ],
  [
    'Drawing Pack sheets must occupy one responsive row',
    /\.sf-drawing-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  ],
  [
    'Drawing Pack SVGs must override the legacy 760px minimum',
    /\.sf-drawing-sheet > :is\(\.sf-plan-svg,\s*\.sf-section-svg\),[\s\S]*?min-width:\s*0;[\s\S]*?max-width:\s*100%;/,
  ],
  [
    'A4 header must carry compact prepared, checked and approved signature rows',
    /\.report-product \.a4-header-signoff\s*\{[\s\S]*?display:\s*grid;/,
  ],
  [
    'A4 worked formulas must wrap inside their own calculation cards',
    /\.report-product \.a4-worked-card \.a4-worked-formula\s*\{[\s\S]*?grid-template-columns:\s*15mm\s+minmax\(0,\s*1fr\);/,
  ],
]) {
  assert.match(workbenchCssSource, pattern, contract)
}
for (const footingEvidence of [
  '02.1 · น้ำหนักฐานและดินเหนือฐาน',
  '02.2 · แรงดันดินใช้งานและการสัมผัส',
  '02.3 · แรงประลัยและแรงดันสุทธิ',
  '02.1 · ดัดและเหล็กเสริม ทิศ A',
  '02.4 · แรงเฉือนทางเดียว ทิศ B',
  'แรงดันมุม',
]) {
  assert.match(
    defaultSurfaces.report,
    new RegExp(footingEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    `A4 must retain footing-specific evidence: ${footingEvidence}`
  )
}
assert.match(
  defaultSurfaces.report,
  /q1[\s\S]*?q2[\s\S]*?q3[\s\S]*?q4/,
  'A4 must retain the ordered q1-q4 corner pressures'
)
assert.match(defaultSurfaces.report, /A<sub>s,strength<\/sub>/)
assert.match(defaultSurfaces.report, /V<sub>u<\/sub>/)
for (const equationId of [
  'SF-EQ-SERVICE-GROSS-WEIGHTS',
  'SF-EQ-SERVICE-BIAXIAL-PRESSURE',
  'SF-EQ-TH_MR_2566_C7_1_4D_1_7L',
  'SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM',
  'SF-EQ-FLEXURE-A',
  'SF-EQ-FLEXURE-B',
  'SF-EQ-ONE-WAY-SHEAR-A',
  'SF-EQ-ONE-WAY-SHEAR-B',
  'SF-EQ-INTERIOR-PUNCHING-SHEAR',
]) {
  assert.match(
    defaultSurfaces.report,
    new RegExp(`data-a4-equation-id="${equationId}"`),
    `A4 must retain important Snapshot equation ${equationId}`
  )
  assert.match(
    defaultCalcPresentation,
    new RegExp(`data-flow07-equation-id="${equationId}"`),
    `Flow 07 must reuse the A4 presentation for important Snapshot equation ${equationId}`
  )
}
assert.equal(
  (defaultSurfaces.report.match(/data-math-layout="stacked"/g) || []).length,
  9,
  'all nine principal A4 equations must use the stacked print-math layout'
)
assert.equal(
  (defaultCalcPresentation.match(/data-math-layout="stacked"/g) || []).length,
  9,
  'all nine principal Flow 07 equations must use the same stacked math layout as A4'
)
assert.equal(
  (defaultSurfaces.report.match(/class="a4-fraction__numerator"/g) || []).length,
  (defaultSurfaces.report.match(/class="a4-fraction__denominator"/g) || []).length,
  'every printed fraction must have one numerator and one denominator'
)
assert.equal(
  (defaultCalcPresentation.match(/class="a4-fraction__numerator"/g) || []).length,
  (defaultCalcPresentation.match(/class="a4-fraction__denominator"/g) || []).length,
  'every Flow 07 fraction must have one numerator and one denominator'
)
assert.ok(
  (defaultSurfaces.report.match(/class="a4-fraction__numerator"/g) || []).length >= 18,
  'A4 must typeset the principal bearing, flexure and shear divisions as stacked fractions'
)
assert.ok(
  (defaultCalcPresentation.match(/class="a4-fraction__numerator"/g) || []).length >= 18,
  'Flow 07 must typeset the same bearing, flexure and shear divisions as stacked fractions'
)
assert.doesNotMatch(
  defaultSurfaces.report,
  /<div class="a4-worked-formula[^>]*>(?:(?!<\/div>)[\s\S])*?<code>/,
  'A4 must not collapse principal engineering formulas back into raw inline code text'
)
assert.match(
  defaultSurfaces.report,
  /data-a4-equation-id="SF-EQ-SERVICE-BIAXIAL-PRESSURE"[\s\S]*?class="a4-fraction__numerator">P<\/span>[\s\S]*?class="a4-fraction__denominator">A<\/span>/,
  'service bearing pressure must visibly typeset P over A'
)
assert.match(
  workbenchCssSource,
  /\.report-document \.a4-fraction__denominator\s*\{[\s\S]*?border-top:\s*0\.22mm solid currentColor;/,
  'stacked fractions must retain a printable horizontal division bar'
)
assert.match(
  workbenchCssSource,
  /\.report-document \[data-report-page="1"\] \.a4-worked-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);/,
  'page 1 calculations must use one ordered column without an empty orphan grid cell'
)
assert.match(
  workbenchCssSource,
  /\.report-document \[data-report-page="1"\] \.report-evidence\s*\{[\s\S]*?height:\s*auto;[\s\S]*?min-height:\s*32mm;[\s\S]*?flex:\s*1 1 46mm;/,
  'page 1 plan and section evidence must absorb the remaining A4 height without leaving a blank band'
)
for (const [direction, checkId] of [
  ['A', 'provided-steel-a'],
  ['B', 'provided-steel-b'],
]) {
  assert.match(
    defaultSurfaces.report,
    new RegExp(
      `data-rebar-check="${checkId}"[\\s\\S]*?เลือกใช้เหล็ก · ทิศ ${direction}` +
        '[\\s\\S]*?8-DB16[\\s\\S]*?As,req[\\s\\S]*?As,prov[\\s\\S]*?ผ่าน · OK'
    ),
    `A4 must clearly summarize the selected ${direction} reinforcement and OK result`
  )
  assert.match(
    defaultSurfaces.report,
    new RegExp(
      `data-rebar-check="${checkId}"[\\s\\S]*?` +
        'As,req\\s*=\\s*540 mm2/m[\\s\\S]*?As,prov\\s*=\\s*1,016\\.9 mm2/m'
    ),
    `A4 ${direction} must preserve As,required before As,provided with exact Snapshot values`
  )
}
assert.doesNotMatch(
  defaultSurfaces.report,
  /BMD|SFD|data-diagram="(?:moment|shear)"|data-axis-x="distance-from-column-face"/,
  'BMD/SFD belong in Flow 03 Analysis and must not consume A4 calculation space'
)
assert.doesNotMatch(
  defaultSurfaces.report,
  /Bar Cut|BBS|Lcl ทิศ [AB]|ขอบเขตของรายงาน|หมายเหตุ R1/,
  'A4 must omit Bar Cut, scope and note blocks requested by the Owner'
)
assert.doesNotMatch(
  defaultSurfaces.report,
  /class="a4-reference-summary"|data-reference-presentation="source-id-only"/,
  'reference ledgers belong in Calculation Book, not the footing one-sheet A4'
)
assert.doesNotMatch(
  defaultSurfaces.report,
  /สมมติฐาน \(Assumptions\)|หน่วยมาตรฐาน \(Canonical units\)|เปิดเอกสารทางการ/,
  'full equation, assumption, unit, and URL evidence belongs in Calculation Book, not the one-sheet A4'
)

const attributeFromTag = (tag, name) => {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`))
  return match?.[1] ?? null
}

const defaultGeometry = defaultSnapshot.results.geometry
const defaultRebarA = defaultSnapshot.results.reinforcement.A
const defaultRebarB = defaultSnapshot.results.reinforcement.B
const sectionMarkup = defaultSurfaces.section
const planBounds = defaultGeometry.renderModel.planBounds
const sectionBounds = defaultGeometry.renderModel.sectionBoundsMm

for (const line of defaultGeometry.renderModel.barsB) {
  const circleTag = sectionMarkup.match(
    new RegExp(`<circle\\b[^>]*data-bar-id="${line.id}"[^>]*>`)
  )?.[0]
  assert.ok(circleTag, `Section must render Snapshot B centerline ${line.id}`)
  const expectedX =
    82 +
    ((line.start.xM - planBounds.minX) / (planBounds.maxX - planBounds.minX)) * 376
  const expectedY = 258 - ((line.start.zM * 1000) / sectionBounds.height) * 126
  assert.ok(
    Math.abs(Number(attributeFromTag(circleTag, 'cx')) - expectedX) < 0.001,
    `${line.id} section x-coordinate must come from its plan centerline`
  )
  assert.ok(
    Math.abs(Number(attributeFromTag(circleTag, 'cy')) - expectedY) < 0.001,
    `${line.id} section elevation must come from its Snapshot centerline`
  )
  assert.equal(
    Number(attributeFromTag(circleTag, 'data-center-z-mm')),
    line.start.zM * 1000,
    `${line.id} must retain its exact Snapshot center elevation`
  )
}

const unequalDiameterSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    memberMark: 'F-02',
    barsA: 10,
    barDiaA: 'DB32',
    barsB: 9,
    barDiaB: 'DB12',
  },
  new Date('2026-07-29T03:05:00.000Z')
)
assert.equal(
  unequalDiameterSnapshot.ok,
  true,
  'DB32/DB12 unequal-diameter fixture must calculate for drawing containment QA'
)
const unequalSectionMarkup = renderSpreadFootingSectionSurface(unequalDiameterSnapshot)
const unequalHydrationPlan = renderSpreadFootingSnapshotHydrationPlan(unequalDiameterSnapshot)
assert.equal(
  unequalHydrationPlan.modelEvidence.dowel.mark,
  'F-02-D',
  '3D dowel evidence mark must derive from the selected Snapshot member mark'
)
assert.match(unequalHydrationPlan.modelEvidence.dowel.title, /^F-02-D ·/)
assert.doesNotMatch(
  JSON.stringify(unequalHydrationPlan.modelEvidence.dowel),
  /F01-D|F-01-D/,
  'F-02 3D dowel evidence must not inherit an F01 mark'
)
assert.match(
  unequalHydrationPlan.modelEvidence.dowel.auth,
  /NOT EVALUATED.*รายละเอียดรอยต่อไม่รวมในรุ่นนี้/,
  'dynamic dowel evidence must remain neutral while disclosing its unevaluated scope'
)
const unequalGeometry = unequalDiameterSnapshot.results.geometry
const unequalBarA = unequalDiameterSnapshot.results.reinforcement.A
const unequalBarB = unequalDiameterSnapshot.results.reinforcement.B
const unequalBarATag = unequalSectionMarkup.match(
  /<polyline\b[^>]*data-model-layer="barA"[^>]*>/
)?.[0]
assert.ok(unequalBarATag, 'unequal-diameter Section must render the A-bar envelope')
assert.equal(Number(attributeFromTag(unequalBarATag, 'data-bar-diameter-mm')), 32)
assert.equal(attributeFromTag(unequalBarATag, 'stroke-linecap'), 'butt')
assert.equal(attributeFromTag(unequalBarATag, 'stroke-linejoin'), 'round')
const unequalSectionScale = 376 / unequalGeometry.renderModel.sectionBoundsMm.widthX
const unequalStrokeWidth = Number(attributeFromTag(unequalBarATag, 'stroke-width'))
assert.ok(
  Math.abs(unequalStrokeWidth - unequalBarA.diameterMm * unequalSectionScale) < 0.001,
  'A-bar stroke width must scale from its exact Snapshot diameter'
)
const unequalBarAXs = attributeFromTag(unequalBarATag, 'points')
  .trim()
  .split(/\s+/)
  .map((pair) => Number(pair.split(',')[0]))
const unequalEnvelopeMinX = Math.min(...unequalBarAXs) - unequalStrokeWidth / 2
const unequalEnvelopeMaxX = Math.max(...unequalBarAXs) + unequalStrokeWidth / 2
const unequalEndBars = [
  unequalGeometry.renderModel.barsB[0],
  unequalGeometry.renderModel.barsB.at(-1),
]
for (const line of unequalEndBars) {
  const circleTag = unequalSectionMarkup.match(
    new RegExp(`<circle\\b[^>]*data-bar-id="${line.id}"[^>]*>`)
  )?.[0]
  assert.ok(circleTag, `${line.id} must render for unequal-diameter face-containment QA`)
  const centerX = Number(attributeFromTag(circleTag, 'cx'))
  const radius = Number(attributeFromTag(circleTag, 'r'))
  assert.equal(Number(attributeFromTag(circleTag, 'data-bar-diameter-mm')), 12)
  assert.ok(
    Math.abs(radius - (unequalBarB.diameterMm * unequalSectionScale) / 2) < 0.001,
    `${line.id} radius must scale from its exact Snapshot diameter`
  )
  assert.ok(
    centerX - radius >= unequalEnvelopeMinX - 0.001,
    `${line.id} left face must stay inside the A-bar envelope`
  )
  assert.ok(
    centerX + radius <= unequalEnvelopeMaxX + 0.001,
    `${line.id} right face must stay inside the A-bar envelope`
  )
}

for (const [direction, bar] of [
  ['dA', defaultRebarA],
  ['dB', defaultRebarB],
]) {
  const dimensionTag = sectionMarkup.match(
    new RegExp(`<path\\b[^>]*data-dimension="${direction}"[^>]*>`)
  )?.[0]
  assert.ok(dimensionTag, `${direction} dimension must render`)
  assert.equal(
    Number(attributeFromTag(dimensionTag, 'data-from-z-mm')),
    sectionBounds.height,
    `${direction} must start at the concrete top`
  )
  assert.equal(
    Number(attributeFromTag(dimensionTag, 'data-to-z-mm')),
    bar.centerElevationMm,
    `${direction} must end at the matching bar center`
  )
  const expectedBarY = 258 - (bar.centerElevationMm / sectionBounds.height) * 126
  assert.ok(
    Math.abs(Number(attributeFromTag(dimensionTag, 'data-svg-y2')) - expectedBarY) < 0.001,
    `${direction} SVG endpoint must coincide with the matching bar center`
  )
}

for (const [direction, bar] of [
  ['A', defaultRebarA],
  ['B', defaultRebarB],
]) {
  const calloutTag = sectionMarkup.match(
    new RegExp(`<g\\b[^>]*data-plan-callout="${direction}"[^>]*>`)
  )?.[0]
  assert.ok(calloutTag, `Plan callout ${direction} must render`)
  assert.equal(attributeFromTag(calloutTag, 'data-mark'), bar.mark)
  assert.equal(Number(attributeFromTag(calloutTag, 'data-count')), bar.count)
  assert.equal(attributeFromTag(calloutTag, 'data-size'), `DB${bar.diameterMm}`)
  assert.equal(Number(attributeFromTag(calloutTag, 'data-spacing-mm')), bar.spacingMm)
  assert.ok(
    Number(attributeFromTag(calloutTag, 'data-callout-x')) +
      Number(attributeFromTag(calloutTag, 'data-callout-width')) <=
      620,
    `Plan callout ${direction} must remain inside the SVG viewBox`
  )
  assert.ok(
    Number(attributeFromTag(calloutTag, 'data-callout-y')) +
      Number(attributeFromTag(calloutTag, 'data-callout-height')) <=
      390,
    `Plan callout ${direction} must remain inside the SVG viewBox`
  )
}

for (const sheetId of ['SF-01', 'SF-02', 'SF-03']) {
  assert.match(
    defaultSurfaces.drawing,
    new RegExp(
      `<article\\b[^>]*data-sheet-id="${sheetId}"[^>]*data-scale="NTS"[\\s\\S]*?<header>[\\s\\S]*?NTS · ไม่กำหนดมาตราส่วน`
    ),
    `${sheetId} must state NTS / no prescribed scale`
  )
}

for (const [zone, expectedY] of [
  ['bar-spec', 24],
  ['vertical-tangent', 48],
  ['radius', 48],
  ['horizontal-tangent', 283],
  ['centerline-length', 309],
  ['scale', 332],
]) {
  const annotationTag = sectionMarkup.match(
    new RegExp(`<text\\b[^>]*y="${expectedY}"[^>]*data-annotation-zone="${zone}"[^>]*>`)
  )?.[0]
  assert.ok(annotationTag, `Bar Cut annotation ${zone} must occupy its reserved row`)
}
assert.match(
  sectionMarkup,
  /<svg viewBox="0 0 430 340" role="img" data-scale="NTS"/,
  'Bar Cut viewBox must contain the final annotation row without clipping'
)

const scheduleRowA = defaultSurfaces.drawing.match(
  new RegExp(`<tr data-select-mark="${defaultRebarA.mark}">[\\s\\S]*?<\\/tr>`)
)?.[0]
assert.ok(scheduleRowA, 'formatted schedule row A must render')
assert.match(
  scheduleRowA,
  new RegExp(`data-exact-value="${defaultRebarA.spacingMm}">197\\.7 mm<`),
  'schedule spacing must be readable while retaining the exact Snapshot value'
)
assert.match(
  scheduleRowA,
  new RegExp(
    `data-exact-value="${defaultSnapshot.results.barCut.A.centerlineLengthMm}">1,719\\.9 mm<`
  ),
  'schedule cut length must be readable while retaining the exact Snapshot value'
)

const bearingReportRow = defaultSurfaces.report.match(
  /<tr[^>]*data-check-id="bearing-capacity"[\s\S]*?<\/tr>/
)?.[0]
assert.ok(bearingReportRow, 'A4 bearing row must render')
assert.match(
  bearingReportRow,
  new RegExp(
    `data-exact-value="${defaultSnapshot.results.bearing.qMaxKPa}">84\\.45 kPa<`
  ),
  'A4 must round the visible demand and retain its exact Snapshot value'
)
assert.doesNotMatch(
  bearingReportRow,
  />84\.45160091666668 kPa</,
  'A4 must not print unrounded floating-point noise'
)

const dynamicMarkSnapshot = await createSpreadFootingSnapshot(
  {
    ...DEFAULT_SPREAD_FOOTING_DRAFT,
    memberMark: 'FT-LONG-MEMBER-GRID-27',
  },
  new Date('2026-07-29T03:10:00.000Z')
)
assert.equal(dynamicMarkSnapshot.ok, true, 'dynamic-mark fixture must calculate')
const dynamicMarkSurfaces = renderSpreadFootingSnapshotSurfaces(dynamicMarkSnapshot)
for (const direction of ['A', 'B']) {
  const mark = dynamicMarkSnapshot.results.reinforcement[direction].mark
  assert.ok(dynamicMarkSurfaces.section.includes(`data-mark="${mark}"`))
  assert.ok(dynamicMarkSurfaces.drawing.includes(`data-select-mark="${mark}"`))
}
assert.doesNotMatch(
  `${dynamicMarkSurfaces.section}\n${dynamicMarkSurfaces.drawing}`,
  /data-(?:select-)?mark="F01-[AB]"/,
  'a non-F01 Snapshot must not inherit F01 drawing marks from presentation code'
)
assert.match(
  dynamicMarkSurfaces.section,
  /textLength="148" lengthAdjust="spacingAndGlyphs"/,
  'long plan callouts must fit inside their reserved bounds'
)

console.log('Spread footing snapshot renderers: PASS')
console.log('  Surfaces: summary / dc / analysis / section / three / report / calc / drawing')
console.log('  Snapshot trace: ID / payload hash / calculation fingerprint / fingerprint')
console.log('  Safety: escaped user text / evaluated verdict gate / NFC / BBS hold')
console.log('  Evidence: source, edition, clause, equation, units, assumptions, official URL')
console.log('  Drawing QA: centerlines / d endpoints / callout bounds / NTS / display formatting')
