import {
  selectSpreadFooting3DData,
  selectSpreadFootingCalculationBookData,
  selectSpreadFootingChecksData,
  selectSpreadFootingDiagramData,
  selectSpreadFootingDrawingData,
  selectSpreadFootingReportData,
  selectSpreadFootingSectionData,
  selectSpreadFootingSummaryData,
  selectSpreadFootingTakeoffData,
} from './spread-footing-engine.mjs'

const EMPTY = 'ไม่ระบุ'
const REVIEW_REQUIRED = 'ENGINEERING REVIEW REQUIRED'
const NOT_EVALUATED = 'NOT EVALUATED · นอกขอบเขต'
const NOT_FOR_CONSTRUCTION = 'NOT FOR CONSTRUCTION'
const NOT_RELEASED_BBS = 'NOT RELEASED BBS'
const KGF_TO_KN = 0.00980665

const SURFACE_KEYS = Object.freeze([
  'summary',
  'dc',
  'analysis',
  'section',
  'three',
  'report',
  'calc',
  'drawing',
])

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const escapeAttribute = escapeHtml

const deepFreeze = (value, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return value
  seen.add(value)
  for (const child of Object.values(value)) deepFreeze(child, seen)
  return Object.freeze(value)
}

const publicResultCopy = (value) =>
  String(value)
    .replaceAll('ไม่มีเส้นผลจาก Snapshot', 'ไม่มีเส้นผลคำนวณ')
    .replaceAll(' (Snapshot)', '')
    .replaceAll('(Snapshot)', '')
    .replaceAll('NO CURRENT SNAPSHOT', 'ยังไม่มีผลคำนวณปัจจุบัน')
    .replaceAll('NO SNAPSHOT', 'ยังไม่มีผลคำนวณ')
    .replaceAll('SNAPSHOT CURRENT', 'ผลคำนวณปัจจุบัน')
    .replaceAll('SNAPSHOT READY', 'ผลคำนวณพร้อม')
    .replaceAll('CALCULATION SNAPSHOT', 'ชุดผลคำนวณ')
    .replaceAll('Calculation Snapshot', 'ชุดผลคำนวณ')
    .replaceAll('Snapshot ID', 'รหัสผลคำนวณ')
    .replaceAll('Snapshot', 'ผลคำนวณ')
    .replaceAll('SNAPSHOT', 'ผลคำนวณ')
    .replaceAll('จาก ชุดผลคำนวณ', 'จากชุดผลคำนวณ')
    .replaceAll('จาก ผลคำนวณ', 'จากผลคำนวณ')
    .replaceAll('ผลทุกแท็บอ่านจากชุดผลคำนวณ ชุดเดียว', 'ผลทุกแท็บใช้ชุดผลคำนวณเดียวกัน')
    .replaceAll('A4 ชุดแบบ และ Bar Cut อ่านข้อมูลจากผลคำนวณ เดียวกัน', 'A4 ชุดแบบ และ Bar Cut ใช้ผลคำนวณชุดเดียวกัน')

const publicResultCopyDeep = (value) => {
  if (typeof value === 'string') return publicResultCopy(value)
  if (Array.isArray(value)) return value.map(publicResultCopyDeep)
  if (!value || typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, publicResultCopyDeep(child)])
  )
}

const getPath = (source, path) => {
  if (!source || typeof source !== 'object') return undefined
  return String(path)
    .split('.')
    .reduce((current, key) => (current == null ? undefined : current[key]), source)
}

const firstValue = (source, paths, fallback = undefined) => {
  for (const path of paths) {
    const value = typeof path === 'function' ? path(source) : getPath(source, path)
    if (value !== undefined && value !== null && value !== '') return value
  }
  return fallback
}

const toList = (value) => {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return value == null ? [] : [value]
  return Object.values(value)
}

const rawMetricText = (value, fallback = EMPTY) => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return String(value)
  }
  if (typeof value === 'boolean') return value ? 'ใช่' : 'ไม่'
  if (Array.isArray(value)) return value.map((item) => rawMetricText(item, fallback)).join(', ')
  if (typeof value !== 'object') return String(value)

  const explicit = firstValue(value, ['display', 'formatted', 'displayValue', 'text'])
  if (explicit !== undefined) return String(explicit)

  const scalar = firstValue(value, ['value', 'amount', 'result', 'label', 'name'])
  if (scalar === undefined) return fallback
  const unit = firstValue(value, ['unit', 'canonicalUnit', 'units'], '')
  return unit ? `${rawMetricText(scalar, fallback)} ${rawMetricText(unit, '')}` : rawMetricText(scalar, fallback)
}

const metricText = (value, fallback = EMPTY) => escapeHtml(rawMetricText(value, fallback))

const rawValueWithUnit = (value, unit, fallback = EMPTY) => {
  const text = rawMetricText(value, fallback)
  if (text === fallback || !unit || (value && typeof value === 'object')) return text
  return `${text} ${unit}`
}

const valueWithUnit = (value, unit, fallback = EMPTY) =>
  escapeHtml(rawValueWithUnit(value, unit, fallback))

const numericValue = (value) => {
  const candidate =
    value && typeof value === 'object'
      ? firstValue(value, ['value', 'amount', 'result'])
      : value
  if (candidate === undefined || candidate === null || candidate === '') return null
  const number = Number(candidate)
  return Number.isFinite(number) ? number : null
}

const displayNumberFormatters = new Map()

const formattedNumber = (value, maximumFractionDigits = 1, fallback = EMPTY) => {
  const number = numericValue(value)
  if (number === null) return rawMetricText(value, fallback)
  const digits = Math.max(0, Math.min(6, Math.trunc(maximumFractionDigits)))
  if (!displayNumberFormatters.has(digits)) {
    displayNumberFormatters.set(
      digits,
      new Intl.NumberFormat('en-US', {
        maximumFractionDigits: digits,
        minimumFractionDigits: 0,
        useGrouping: true,
      })
    )
  }
  return displayNumberFormatters.get(digits).format(number)
}

const rawFormattedMetric = (value, maximumFractionDigits = 1, fallback = EMPTY) => {
  const number = numericValue(value)
  if (number === null) return rawMetricText(value, fallback)
  const unit =
    value && typeof value === 'object'
      ? firstValue(value, ['unit', 'canonicalUnit', 'units'], '')
      : ''
  return `${formattedNumber(number, maximumFractionDigits, fallback)}${
    unit ? ` ${rawMetricText(unit, '')}` : ''
  }`
}

const formattedMetric = (value, maximumFractionDigits = 1, fallback = EMPTY) =>
  escapeHtml(rawFormattedMetric(value, maximumFractionDigits, fallback))

const rawFormattedValueWithUnit = (
  value,
  unit,
  maximumFractionDigits = 1,
  fallback = EMPTY
) => {
  const text = rawFormattedMetric(value, maximumFractionDigits, fallback)
  if (text === fallback || !unit || (value && typeof value === 'object')) return text
  return `${text} ${unit}`
}

const formattedValueWithUnit = (value, unit, maximumFractionDigits = 1, fallback = EMPTY) =>
  escapeHtml(rawFormattedValueWithUnit(value, unit, maximumFractionDigits, fallback))

const normalizeForceDisplayUnit = (unit) => unit === 'kg' ? 'kg' : 'kN'

const formattedForceFromKn = (value, unit = 'kN', fallback = EMPTY) => {
  const forceKn = numericValue(value)
  if (forceKn === null) return escapeHtml(rawMetricText(value, fallback))
  const normalizedUnit = normalizeForceDisplayUnit(unit)
  const displayedValue = normalizedUnit === 'kg' ? forceKn / KGF_TO_KN : forceKn
  return formattedValueWithUnit(
    displayedValue,
    normalizedUnit,
    normalizedUnit === 'kg' ? 0 : 2,
    fallback
  )
}

const exactValueAttribute = (value, attribute = 'data-exact-value') => {
  const number = numericValue(value)
  return number === null
    ? ''
    : ` ${attribute}="${escapeAttribute(String(number))}"`
}

const exactNamedAttributes = (entries = {}) =>
  Object.entries(entries)
    .map(([name, value]) => {
      const safeName = String(name)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+|-+$/g, '')
      return safeName ? exactValueAttribute(value, `data-exact-${safeName}`) : ''
    })
    .join('')

const engineeringMetricDigits = (value, fallbackUnit = '') => {
  const unit = rawMetricText(
    value && typeof value === 'object'
      ? firstValue(value, ['unit', 'canonicalUnit', 'units'], fallbackUnit)
      : fallbackUnit,
    ''
  ).toLowerCase()
  if (unit.includes('ratio') || unit.includes('strain') || unit.includes('dimensionless')) return 3
  if (unit.includes('mm2') || unit.includes('mm²')) return 1
  if (/(^|[^a-z])mm([^a-z]|$)/.test(unit)) return 1
  if (
    unit.includes('kpa') ||
    unit.includes('kn') ||
    unit.includes('kg') ||
    unit.includes('mpa') ||
    unit === 'm' ||
    unit.includes('m2') ||
    unit.includes('m3')
  ) {
    return 2
  }
  return 3
}

const formattedEngineeringMetric = (value, fallbackUnit = '', fallback = EMPTY) =>
  formattedValueWithUnit(
    value,
    fallbackUnit,
    engineeringMetricDigits(value, fallbackUnit),
    fallback
  )

const rawFormattedEngineeringMetric = (value, fallbackUnit = '', fallback = EMPTY) =>
  rawFormattedValueWithUnit(
    value,
    fallbackUnit,
    engineeringMetricDigits(value, fallbackUnit),
    fallback
  )

const safeNumber = (value, fallback = '0') => {
  const number = numericValue(value)
  return number === null ? fallback : String(Number(number.toFixed(3)))
}

const safeSvgPath = (value, fallback) => {
  const candidate = String(value ?? '')
  return /^[MmZzLlHhVvCcSsQqTtAaEe0-9+\-.,\s]+$/.test(candidate) ? candidate : fallback
}

const safeSvgPoints = (value) => {
  const candidate = Array.isArray(value)
    ? value
        .map((point) => {
          if (Array.isArray(point)) return `${safeNumber(point[0])},${safeNumber(point[1])}`
          return `${safeNumber(point?.x)},${safeNumber(point?.y)}`
        })
        .join(' ')
    : String(value ?? '')
  return /^[0-9+\-.,\s]+$/.test(candidate) ? candidate : ''
}

const safeOfficialUrl = (value) => {
  try {
    const parsed = new URL(String(value ?? ''))
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : ''
  } catch {
    return ''
  }
}

const normalizedStatus = (value) =>
  rawMetricText(value, NOT_EVALUATED)
    .trim()
    .toUpperCase()
    .replaceAll('_', ' ')
    .replace(/\s+/g, ' ')

const verificationStatusLabel = (value) => {
  const token = normalizedStatus(value)
  if (token === 'OWNER AUTHORIZED SPEC PENDING INDEPENDENT REVIEW') {
    return 'ข้อกำหนด Owner · รอตรวจทานอิสระ'
  }
  if (token === 'INDEPENDENTLY REVIEWED') return 'ตรวจทานอิสระแล้ว'
  if (token === 'VERIFIED') return 'ตรวจสอบหลักฐานแล้ว'
  if (token === 'PENDING REVIEW') return 'รอตรวจทาน'
  return rawMetricText(value, NOT_EVALUATED)
}

const isExplicitlyEvaluated = (record) => {
  if (!record || typeof record !== 'object') return false
  if (record.evaluated === true || record.isEvaluated === true) return true
  const evaluation = normalizedStatus(
    firstValue(record, ['applicability', 'evaluation', 'evaluationStatus', 'evidence.evaluationStatus'], '')
  )
  return evaluation === 'EVALUATED' || evaluation === 'APPLICABLE AND EVALUATED'
}

const displayStatus = (record, fallback = NOT_EVALUATED) => {
  const raw = normalizedStatus(firstValue(record, ['status', 'verdict', 'resultStatus'], fallback))
  if ((raw === 'PASS' || raw === 'FAIL') && !isExplicitlyEvaluated(record)) return NOT_EVALUATED
  return raw || fallback
}

const overallStatus = (envelope, data) => {
  const raw = normalizedStatus(
    firstValue(data, ['overall.status', 'overall.verdict'], envelope.overallStatus || REVIEW_REQUIRED)
  )
  return raw === 'PASS' || raw === 'FAIL' || !raw ? REVIEW_REQUIRED : raw
}

const statusClass = (status) => {
  const token = normalizedStatus(status)
  if (token === 'PASS') return 'is-pass'
  if (token === 'FAIL') return 'is-fail'
  if (token.includes('HOLD') || token.includes('NOT EVALUATED') || token.includes('REVIEW')) {
    return 'is-review'
  }
  return 'is-neutral'
}

const professionalResultLabel = (record) => {
  const status = displayStatus(record)
  if (status === 'PASS') return 'ผ่าน · OK'
  if (status === 'FAIL') return 'ไม่ผ่าน · FAIL'
  if (status.includes('HOLD') || status.includes('NOT EVALUATED') || status.includes('REVIEW')) {
    return 'รอตรวจ · HOLD'
  }
  return status
}

const normalizeChecks = (data) =>
  toList(firstValue(data, ['checks', 'results.checks'], [])).filter(
    (check) => check && typeof check === 'object'
  )

const evaluatedSurfaceVerdict = (data) => {
  const evaluated = normalizeChecks(data).filter(isExplicitlyEvaluated)
  if (evaluated.some((check) => displayStatus(check) === 'FAIL')) {
    return { status: 'FAIL', label: 'ผลที่ประเมิน · FAIL' }
  }
  if (evaluated.length > 0 && evaluated.every((check) => displayStatus(check) === 'PASS')) {
    return { status: 'PASS', label: 'ผลที่ประเมิน · OK' }
  }
  return { status: NOT_EVALUATED, label: 'ยังไม่มีผลที่ประเมิน' }
}

const normalizeEquations = (data) =>
  toList(firstValue(data, ['equations', 'results.equations'], [])).filter(
    (equation) => equation && typeof equation === 'object'
  )

const isPresentableEquation = (record) => {
  if (!record || typeof record !== 'object') return false
  const verificationStatus = normalizedStatus(
    firstValue(
      record,
      ['verificationStatus', 'evidence.verificationStatus', 'source.verificationStatus'],
      ''
    )
  )
  return !verificationStatus.includes('NOT EVALUATED') && !verificationStatus.includes('HOLD')
}

const sourceRecord = (record) => {
  const nested = firstValue(record, ['evidence', 'source', 'reference'], {})
  const source = nested && typeof nested === 'object' ? nested : {}
  return {
    sourceId: firstValue(
      record,
      ['sourceId', 'equationId'],
      firstValue(source, ['sourceId', 'id', 'equationId'], 'SOURCE')
    ),
    standard: firstValue(record, ['standard'], firstValue(source, ['standard', 'code'], EMPTY)),
    edition: firstValue(record, ['edition'], firstValue(source, ['edition'], EMPTY)),
    clause: firstValue(record, ['clause'], firstValue(source, ['clause', 'article', 'section'], EMPTY)),
    equation: firstValue(record, ['equationId'], firstValue(source, ['equationId'], EMPTY)),
    formula: firstValue(record, ['formula'], firstValue(source, ['formula'], EMPTY)),
    substitution: firstValue(
      record,
      ['substitution'],
      firstValue(source, ['substitution'], EMPTY)
    ),
    canonicalUnits: firstValue(
      record,
      ['canonicalUnits', 'units'],
      firstValue(source, ['canonicalUnits', 'units'], EMPTY)
    ),
    assumptions: firstValue(record, ['assumptions'], firstValue(source, ['assumptions'], [])),
    title: firstValue(record, ['sourceTitle'], firstValue(source, ['sourceTitle', 'title'], EMPTY)),
    url: firstValue(record, ['sourceUrl'], firstValue(source, ['sourceUrl', 'url'], '')),
    verificationStatus: firstValue(
      record,
      ['verificationStatus'],
      firstValue(source, ['verificationStatus', 'status'], EMPTY)
    ),
  }
}

const renderSourceInline = (record) => {
  const source = sourceRecord(record)
  return `<span class="sf-source-inline">
    <b>${metricText(source.sourceId)}</b>
    <span>หลักฐานเต็มอยู่ใน Flow 07</span>
  </span>`
}

const referencesFrom = (...candidates) => {
  const collected = []
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue
    const embedded = firstValue(candidate, ['evidence', 'source', 'reference'], null)
    if (embedded && typeof embedded === 'object') collected.push(embedded)
    if (candidate.sourceUrl || candidate.url) collected.push(candidate)
    const groups = [
      firstValue(candidate, ['sources'], []),
      firstValue(candidate, ['references'], []),
      firstValue(candidate, ['sourceRegister'], []),
      firstValue(candidate, ['standards'], []),
    ]
    for (const group of groups) {
      for (const item of toList(group)) {
        if (item && typeof item === 'object') collected.push(item)
      }
    }
  }

  const seen = new Set()
  return collected.filter((item) => {
    const source = sourceRecord(item)
    const key = `${rawMetricText(source.sourceId, '')}|${rawMetricText(source.url, '')}|${rawMetricText(
      source.title,
      ''
    )}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const requireEnvelope = (envelope, selectorName) => {
  if (!envelope || envelope.ok !== true || typeof envelope.data !== 'object') {
    throw new TypeError(`${selectorName} did not return a valid Spread Footing result projection`)
  }
  for (const key of ['snapshotId', 'payloadHash', 'fingerprint']) {
    if (envelope[key] === undefined || envelope[key] === null || envelope[key] === '') {
      throw new TypeError(`${selectorName} projection is missing ${key}`)
    }
  }
  return envelope
}

const traceValue = (envelope, key) =>
  key === 'calculationFingerprint'
    ? envelope.calculationFingerprint ?? envelope.fingerprint
    : envelope[key]

const assertProjectionParity = (base, candidate, label) => {
  for (const key of ['snapshotId', 'payloadHash', 'fingerprint', 'calculationFingerprint']) {
    if (String(traceValue(base, key)) !== String(traceValue(candidate, key))) {
      throw new TypeError(`Spread Footing ${label} projection does not match the immutable result ${key}`)
    }
  }
}

const surfaceAttributes = (envelope, surface) => {
  const calculationFingerprint = traceValue(envelope, 'calculationFingerprint')
  return [
    `data-snapshot-surface="${escapeAttribute(surface)}"`,
    `data-snapshot-id="${escapeAttribute(envelope.snapshotId)}"`,
    `data-payload-hash="${escapeAttribute(envelope.payloadHash)}"`,
    `data-calculation-fingerprint="${escapeAttribute(calculationFingerprint)}"`,
    `data-fingerprint="${escapeAttribute(envelope.fingerprint)}"`,
    `data-profile-id="${escapeAttribute(envelope.profileId || EMPTY)}"`,
  ].join(' ')
}

const snapshotTrace = (envelope) => `<details class="sf-snapshot-trace-details">
  <summary>สายตรวจสอบ Calculation Snapshot · ${metricText(envelope.snapshotId)}</summary>
  <dl class="sf-snapshot-trace" aria-label="สายตรวจสอบชุดผลคำนวณฉบับเต็ม">
    <div><dt>ชุดผลคำนวณ (Snapshot)</dt><dd>${metricText(envelope.snapshotId)}</dd></div>
    <div><dt>แฮชข้อมูล (Payload hash)</dt><dd>${metricText(envelope.payloadHash)}</dd></div>
    <div><dt>ลายนิ้วมือข้อมูลนำเข้า</dt><dd>${metricText(envelope.fingerprint)}</dd></div>
    <div><dt>ลายนิ้วมือการคำนวณ</dt><dd>${metricText(
      traceValue(envelope, 'calculationFingerprint')
    )}</dd></div>
  </dl>
</details>`

const checkId = (check) =>
  rawMetricText(firstValue(check, ['id', 'checkId', 'equationId', 'key'], 'CHECK'))

const THAI_CHECK_LABELS = Object.freeze({
  'bearing-capacity': 'แรงดันดินใช้งานสูงสุดเทียบ SBC',
  'full-contact-qmin': 'การสัมผัสดินเต็มพื้นที่ โดย qmin ≥ 0',
  'combined-kern': 'เงื่อนไขแกนกลางหนึ่งในสามแบบสองทิศ',
  'strength-applicability': 'ขอบเขตใช้การตรวจกำลัง R1 สำหรับแรงกดตรงศูนย์',
  'provided-steel-a': 'เหล็กเสริมที่จัดให้ ทิศ A',
  'tension-controlled-a': 'เกณฑ์หน้าตัดควบคุมด้วยแรงดึง ทิศ A',
  'flexure-capacity-a': 'กำลังดัด ทิศ A',
  'one-way-shear-a': 'กำลังเฉือนทางเดียว ทิศ A',
  'provided-steel-b': 'เหล็กเสริมที่จัดให้ ทิศ B',
  'tension-controlled-b': 'เกณฑ์หน้าตัดควบคุมด้วยแรงดึง ทิศ B',
  'flexure-capacity-b': 'กำลังดัด ทิศ B',
  'one-way-shear-b': 'กำลังเฉือนทางเดียว ทิศ B',
  'short-direction-band-distribution': 'การกระจายเหล็กทิศสั้นในแถบกลาง',
  'punching-shear': 'กำลังเฉือนทะลุภายใน',
  'punching-minimum-steel-a': 'เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ A',
  'punching-minimum-steel-b': 'เกณฑ์เหล็กดัดขั้นต่ำแบบอนุรักษ์นิยม R1 จากเฉือนทะลุ ทิศ B',
  settlement: 'การทรุดตัว',
  'sliding-overturning': 'การเลื่อนและการพลิกคว่ำ',
  'partial-contact-redistribution': 'การกระจายแรงเมื่อสัมผัสดินไม่เต็มพื้นที่หรือเกิดแรงยก',
  'durability-cover': 'สภาพแวดล้อมและระยะหุ้มขั้นต่ำตามมาตรฐาน',
  'minimum-clear-spacing': 'ระยะห่างใสขั้นต่ำพร้อมหลักฐานขนาดมวลรวม',
  'development-anchorage': 'ระยะพัฒนา การยึดเหนี่ยว และขอมาตรฐาน',
  'column-footing-transfer': 'แรงกดและการถ่ายแรงระหว่างเสากับฐานราก',
  dowels: 'เหล็กเดือย ชั้นคุณภาพ ระยะฝัง ระยะทาบ และเหล็กปลอก',
  'construction-tolerances': 'ค่าคลาดเคลื่อนงานก่อสร้าง',
  'released-bbs': 'บัญชีตัดดัดเหล็กที่อนุมัติผลิต (BBS)',
})

const checkLabel = (check) =>
  THAI_CHECK_LABELS[checkId(check)] ??
  firstValue(check, ['label', 'title', 'name', 'topic', 'description'], checkId(check))

const CORE_CHECK_IDS = Object.freeze([
  'bearing-capacity',
  'flexure-capacity-a',
  'flexure-capacity-b',
  'one-way-shear-a',
  'one-way-shear-b',
  'punching-shear',
])

const REPORT_CHECK_CODES = Object.freeze({
  'strength-applicability': 'DC-03',
  'bearing-capacity': 'DC-04',
  'full-contact-qmin': 'DC-04A',
  'combined-kern': 'DC-04B',
  'partial-contact-redistribution': 'DC-04C',
  'flexure-capacity-a': 'DC-05A',
  'provided-steel-a': 'DC-05A-S',
  'tension-controlled-a': 'DC-05A-T',
  'flexure-capacity-b': 'DC-05B',
  'provided-steel-b': 'DC-05B-S',
  'tension-controlled-b': 'DC-05B-T',
  'short-direction-band-distribution': 'DC-05C',
  'one-way-shear-a': 'DC-06A',
  'one-way-shear-b': 'DC-06B',
  'punching-shear': 'DC-07',
  'punching-minimum-steel-a': 'DC-07A-S',
  'punching-minimum-steel-b': 'DC-07B-S',
  'durability-cover': 'DC-08A',
  'minimum-clear-spacing': 'DC-08B',
  'development-anchorage': 'DC-08C',
  'column-footing-transfer': 'DC-09',
})

const REPORT_SUPPLEMENTAL_LABELS = Object.freeze({
  'strength-applicability': 'ขอบเขตตรวจกำลัง R1',
  'full-contact-qmin': 'สัมผัสดินเต็มพื้นที่ qmin ≥ 0',
  'combined-kern': 'แกนกลางหนึ่งในสามแบบสองทิศ',
  'provided-steel-a': 'พื้นที่เหล็กที่จัดให้ ทิศ A',
  'provided-steel-b': 'พื้นที่เหล็กที่จัดให้ ทิศ B',
  'tension-controlled-a': 'หน้าตัดควบคุมแรงดึง ทิศ A',
  'tension-controlled-b': 'หน้าตัดควบคุมแรงดึง ทิศ B',
  'short-direction-band-distribution': 'กระจายเหล็กทิศสั้นในแถบกลาง',
  'punching-minimum-steel-a': 'เหล็กขั้นต่ำจากเฉือนทะลุ ทิศ A',
  'punching-minimum-steel-b': 'เหล็กขั้นต่ำจากเฉือนทะลุ ทิศ B',
})

const INVALIDATING_HOLD_IDS = new Set([
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

const REVIEW_REGISTER_IDS = new Set([
  ...INVALIDATING_HOLD_IDS,
  'settlement',
  'sliding-overturning',
  'partial-contact-redistribution',
  'dowels',
  'construction-tolerances',
  'released-bbs',
])

const selectDecisionChecks = (data, { includeReviewRegister = false } = {}) => {
  const checks = normalizeChecks(data)
  if (!checks.some((check) => CORE_CHECK_IDS.includes(checkId(check)))) return checks
  const governingId = rawMetricText(
    firstValue(
      data,
      ['overall.governingCheckId', 'summary.overall.governingCheckId', 'governingCheck.id'],
      ''
    ),
    ''
  )
  const selectedIds = new Set(CORE_CHECK_IDS)
  if (governingId) selectedIds.add(governingId)

  for (const check of checks) {
    const id = checkId(check)
    const status = normalizedStatus(firstValue(check, ['status'], ''))
    if (isExplicitlyEvaluated(check) && status === 'FAIL') selectedIds.add(id)
    if (
      status === 'HOLD' &&
      (INVALIDATING_HOLD_IDS.has(id) || (includeReviewRegister && REVIEW_REGISTER_IDS.has(id)))
    ) {
      selectedIds.add(id)
    }
  }

  const byId = new Map(checks.map((check) => [checkId(check), check]))
  const ordered = []
  for (const id of CORE_CHECK_IDS) {
    if (byId.has(id)) ordered.push(byId.get(id))
  }
  for (const check of checks) {
    const id = checkId(check)
    if (selectedIds.has(id) && !ordered.includes(check)) ordered.push(check)
  }
  return ordered.length ? ordered : checks
}

const checkDemand = (check) =>
  firstValue(check, ['demandDisplay', 'demand', 'demandValue', 'operands.demand'], EMPTY)

const checkCapacity = (check) =>
  firstValue(check, ['capacityDisplay', 'capacity', 'allowable', 'limit', 'operands.capacity'], EMPTY)

const checkRatio = (check) =>
  firstValue(check, ['utilizationDisplay', 'utilization', 'dcRatio', 'ratio', 'demandCapacityRatio'], EMPTY)

const checkCapacitySource = (check) =>
  firstValue(check, ['capacitySource', 'sbcSource', 'allowableSource'], null)

const renderCheckRow = (check) => {
  const status = displayStatus(check)
  const evaluated = isExplicitlyEvaluated(check)
  const sourceStatus = normalizedStatus(firstValue(check, ['status'], ''))
  const auditStatus =
    !evaluated && sourceStatus === 'HOLD' ? 'รอตรวจ · HOLD' : status
  const evaluation = evaluated ? 'evaluated' : 'not-evaluated'
  const demandValue = checkDemand(check)
  const capacityValue = checkCapacity(check)
  const ratioValue = checkRatio(check)
  const capacitySource = checkCapacitySource(check)
  const demand = rawMetricText(demandValue)
  const capacity = rawMetricText(capacityValue)
  const ratio = rawMetricText(ratioValue)
  return `<tr class="${statusClass(status)}" data-check-id="${escapeAttribute(
    checkId(check)
  )}" data-evaluation="${evaluation}">
    <th scope="row"><span class="check-id">${metricText(checkId(check))}</span>${metricText(
      checkLabel(check)
    )}${
      capacitySource
        ? `<small class="sf-check-capacity-source">ที่มา SBC: ${metricText(capacitySource)}</small>`
        : ''
    }</th>
    <td${evaluated ? exactValueAttribute(demandValue) : ''}>${
      evaluated
        ? demand === EMPTY
          ? 'ไม่ใช้ค่าความต้องการเชิงตัวเลข'
          : formattedEngineeringMetric(demandValue)
        : NOT_EVALUATED
    }</td>
    <td${evaluated ? exactValueAttribute(capacityValue) : ''}>${
      evaluated
        ? capacity === EMPTY
          ? 'ไม่ใช้ค่าความสามารถเชิงตัวเลข'
          : formattedEngineeringMetric(capacityValue)
        : NOT_EVALUATED
    }</td>
    <td${evaluated ? exactValueAttribute(ratioValue) : ''}>${
      evaluated
        ? ratio === EMPTY
          ? 'ไม่ใช้ค่า D/C เชิงตัวเลข'
          : formattedMetric(ratioValue, 3)
        : NOT_EVALUATED
    }</td>
    <td>${renderSourceInline(check)}</td>
    <td><strong class="sf-status-token ${statusClass(status)}">${metricText(
      auditStatus
    )}</strong></td>
  </tr>`
}

const renderChecksTable = (checks, caption) => `<div class="dc-table-wrap" tabindex="0" role="region"
  aria-label="${escapeAttribute(caption)}">
  <table class="dc-table sf-snapshot-checks">
    <caption class="sr-only">${escapeHtml(caption)}</caption>
    <thead><tr>
      <th scope="col">รายการตรวจสอบ</th>
      <th scope="col">ค่าความต้องการ</th>
      <th scope="col">ค่าความสามารถ / เกณฑ์</th>
      <th scope="col">D/C</th>
      <th scope="col">รหัสหลักฐาน</th>
      <th scope="col">สถานะ</th>
    </tr></thead>
    <tbody>${checks.length ? checks.map(renderCheckRow).join('') : `<tr class="is-review">
      <td colspan="6"><strong>${NOT_EVALUATED}</strong> ไม่มีรายการตรวจจากชุดผลคำนวณ</td>
    </tr>`}</tbody>
  </table>
</div>`

const footingGeometry = (geometry) => firstValue(geometry, ['footing', 'foundation'], geometry || {})
const columnGeometry = (geometry) => firstValue(geometry, ['column', 'support'], {})

const geometryDimension = (geometry, member, dimension) => {
  const target = member === 'footing' ? footingGeometry(geometry) : columnGeometry(geometry)
  const aliases = {
    width: ['width', 'B', 'b', 'widthM', 'xM', 'x'],
    length: ['length', 'L', 'l', 'lengthM', 'yM', 'y'],
    thickness: ['thickness', 'depth', 'h', 'height', 'thicknessM'],
  }
  return firstValue(target, aliases[dimension] || [dimension], EMPTY)
}

const reinforcementDirection = (reinforcement, direction) =>
  firstValue(reinforcement, [direction, direction.toLowerCase(), `direction${direction}`], {})

const reinforcementMark = (bar, fallback) =>
  firstValue(bar, ['mark', 'barMark', 'id'], fallback)

const reinforcementDesignation = (bar) => {
  const diameter = firstValue(bar, ['diameterMm'], null)
  return rawMetricText(
    firstValue(
      bar,
      ['designation', 'barSize', 'size', 'diameterDisplay'],
      diameter == null ? EMPTY : `DB${rawMetricText(diameter)}`
    )
  )
}

const reinforcementDiameterMm = (bar, fallback = 16) => {
  const direct = numericValue(firstValue(bar, ['diameterMm'], null))
  if (direct !== null && direct > 0) return direct
  const match = reinforcementDesignation(bar).match(/^DB\s*(\d+(?:\.\d+)?)$/i)
  const parsed = numericValue(match?.[1])
  return parsed !== null && parsed > 0 ? parsed : fallback
}

const reinforcementLayerLabel = (bar) => {
  const layer = rawMetricText(firstValue(bar, ['layer', 'layerLabel'], ''))
  const labels = {
    LOWEST: 'ชั้นล่างสุด',
    ABOVE_A: 'ชั้นเหนือเหล็กทิศ A',
    BOTTOM: 'ชั้นล่าง',
    TOP: 'ชั้นบน',
  }
  return labels[layer.toUpperCase()] || layer
}

const reinforcementSummary = (bar, fallback) => {
  const mark = rawMetricText(reinforcementMark(bar, fallback))
  const count = rawMetricText(firstValue(bar, ['count', 'barCount', 'quantity'], EMPTY))
  const size = reinforcementDesignation(bar)
  const direction = rawMetricText(firstValue(bar, ['direction', 'axis', 'orientation'], ''))
  const layer = reinforcementLayerLabel(bar)
  return [mark, count !== EMPTY || size !== EMPTY ? `${count}-${size}` : '', direction, layer]
    .filter(Boolean)
    .join(' · ')
}

const metricCard = ({ label, value, detail, status = '', exact = {} }) => `<article class="sf-metric-card ${
  status ? statusClass(status) : ''
}"${exactNamedAttributes(exact)}>
  <span>${escapeHtml(label)}</span>
  <strong>${metricText(value)}</strong>
  <p>${metricText(detail)}</p>
</article>`

const bearingCorners = (bearing) => {
  const direct = firstValue(bearing, ['corners', 'cornerPressures', 'pressureCorners'], null)
  if (Array.isArray(direct)) {
    return direct
      .slice(0, 4)
      .map((corner) =>
        corner && typeof corner === 'object'
          ? firstValue(corner, ['pressureKPa', 'pressure', 'value'], EMPTY)
          : corner
      )
  }
  if (direct && typeof direct === 'object') {
    return ['q1', 'q2', 'q3', 'q4'].map((key) => firstValue(direct, [key, key.toUpperCase()], EMPTY))
  }
  const qMax = firstValue(bearing, ['qMaxKPa', 'qMax', 'qmax', 'service.qMax'], EMPTY)
  const qMin = firstValue(bearing, ['qMinKPa', 'qMin', 'qmin', 'service.qMin'], qMax)
  return [qMax, qMax, qMin, qMin]
}

const renderBearingIsometric = (
  bearing,
  geometry,
  variant = 'summary',
  reinforcement = {},
  punching = {}
) => {
  const corners = bearingCorners(bearing)
  const qMax = firstValue(bearing, ['qMaxKPa', 'qMax', 'qmax', 'service.qMax'], EMPTY)
  const qMin = firstValue(bearing, ['qMinKPa', 'qMin', 'qmin', 'service.qMin'], EMPTY)
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const footingWidthM = numericValue(footingB) ?? 1.5
  const footingLengthM = numericValue(footingL) ?? 1.5
  const footingThicknessM = numericValue(footingH) ?? 0.3
  const columnA = geometryDimension(geometry, 'column', 'width')
  const columnB = geometryDimension(geometry, 'column', 'length')
  const columnWidthM = numericValue(columnA) ?? 0.25
  const columnLengthM = numericValue(columnB) ?? 0.25
  const longest = Math.max(footingWidthM, footingLengthM, 0.1)
  const scale = 242 / longest
  const project = ({ x = 0, y = 0, z = 0 }) => ({
    x: 350 + (x - y) * scale * 0.78,
    y: 154 + (x + y) * scale * 0.34 - z * scale,
  })
  const polygon = (points) =>
    points.map((point) => {
      const projected = project(point)
      return `${safeNumber(projected.x)},${safeNumber(projected.y)}`
    }).join(' ')
  const halfX = footingWidthM / 2
  const halfY = footingLengthM / 2
  const top = [
    { x: -halfX, y: -halfY, z: footingThicknessM },
    { x: halfX, y: -halfY, z: footingThicknessM },
    { x: halfX, y: halfY, z: footingThicknessM },
    { x: -halfX, y: halfY, z: footingThicknessM },
  ]
  const front = [
    top[3],
    top[2],
    { x: halfX, y: halfY, z: 0 },
    { x: -halfX, y: halfY, z: 0 },
  ]
  const side = [
    top[1],
    top[2],
    { x: halfX, y: halfY, z: 0 },
    { x: halfX, y: -halfY, z: 0 },
  ]
  const pressureElevation = -longest * 0.11
  const pressurePlane = [
    { x: -halfX, y: -halfY, z: pressureElevation },
    { x: halfX, y: -halfY, z: pressureElevation },
    { x: halfX, y: halfY, z: pressureElevation },
    { x: -halfX, y: halfY, z: pressureElevation },
  ]
  const columnHalfX = columnWidthM / 2
  const columnHalfY = columnLengthM / 2
  const columnTopElevation = footingThicknessM + longest * 0.28
  const columnTopCenter = project({ x: 0, y: 0, z: columnTopElevation })
  const columnBase = [
    { x: -columnHalfX, y: -columnHalfY, z: footingThicknessM },
    { x: columnHalfX, y: -columnHalfY, z: footingThicknessM },
    { x: columnHalfX, y: columnHalfY, z: footingThicknessM },
    { x: -columnHalfX, y: columnHalfY, z: footingThicknessM },
  ]
  const columnTop = columnBase.map((point) => ({ ...point, z: columnTopElevation }))
  const pressureSamples = toList(firstValue(bearing, ['pressureSamples'], []))
  const pressureArrows = pressureSamples
    .filter((sample) => numericValue(sample?.xM) !== null && numericValue(sample?.yM) !== null)
    .map((sample) => {
      const base = project({
        x: numericValue(sample.xM),
        y: numericValue(sample.yM),
        z: pressureElevation,
      })
      return `<path d="M${safeNumber(base.x)} ${safeNumber(base.y)}V${safeNumber(
        base.y - 30
      )}" data-pressure-kpa="${escapeAttribute(sample.pressureKPa)}"/>`
    })
    .join('')
  const renderBarLines = (lines, layer, color) =>
    toList(lines)
      .map((line) => {
        const start = project({
          x: numericValue(line?.start?.xM) ?? 0,
          y: numericValue(line?.start?.yM) ?? 0,
          z: numericValue(line?.start?.zM) ?? 0,
        })
        const end = project({
          x: numericValue(line?.end?.xM) ?? 0,
          y: numericValue(line?.end?.yM) ?? 0,
          z: numericValue(line?.end?.zM) ?? 0,
        })
        return `<line x1="${safeNumber(start.x)}" y1="${safeNumber(start.y)}"
          x2="${safeNumber(end.x)}" y2="${safeNumber(end.y)}" stroke="${color}"
          stroke-width="2.4" data-select-mark="${escapeAttribute(line?.mark || layer)}"/>`
      })
      .join('')
  const renderModel = firstValue(geometry, ['renderModel'], {})
  const barsA = firstValue(renderModel, ['barsA'], firstValue(reinforcement, ['A.planCenterlines'], []))
  const barsB = firstValue(renderModel, ['barsB'], firstValue(reinforcement, ['B.planCenterlines'], []))
  const punchingRect = firstValue(renderModel, ['punchingRect'], null)
  const punchingPolygon = punchingRect
    ? polygon([
        { x: punchingRect.x, y: punchingRect.y, z: footingThicknessM + 0.005 },
        {
          x: punchingRect.x + punchingRect.width,
          y: punchingRect.y,
          z: footingThicknessM + 0.005,
        },
        {
          x: punchingRect.x + punchingRect.width,
          y: punchingRect.y + punchingRect.height,
          z: footingThicknessM + 0.005,
        },
        {
          x: punchingRect.x,
          y: punchingRect.y + punchingRect.height,
          z: footingThicknessM + 0.005,
        },
      ])
    : ''
  return `<svg class="sf-bearing-isometric ${variant}-bearing-isometric" viewBox="0 0 720 380"
    role="img" aria-label="ภาพไอโซเมตริกฐานรากและสนามแรงดันดินจากชุดผลคำนวณ"
    data-diagram-model="bearing-pressure">
    <defs>
      <marker id="${variant}-sf-pressure-arrow" viewBox="0 0 10 10" refX="5" refY="3"
        markerWidth="6" markerHeight="6" orient="auto">
        <path d="M0 10 5 0 10 10Z" fill="#2563eb"/>
      </marker>
    </defs>
    <rect width="720" height="380" fill="#f7fafc"/>
    <g data-model-layer="bearing">
      <polygon points="${polygon(pressurePlane)}" fill="#f59e0b" fill-opacity=".18"
        stroke="#c2410c" stroke-width="2"/>
      <g stroke="#2563eb" stroke-width="2.4" marker-end="url(#${variant}-sf-pressure-arrow)">
        ${pressureArrows}
      </g>
      <g class="sf-pressure-corner-labels">
        <text x="32" y="285"${exactValueAttribute(corners[0])}>q1 ${formattedValueWithUnit(
          corners[0],
          'kPa',
          2
        )}</text>
        <text x="32" y="307"${exactValueAttribute(corners[1])}>q2 ${formattedValueWithUnit(
          corners[1],
          'kPa',
          2
        )}</text>
        <text x="32" y="329"${exactValueAttribute(corners[2])}>q3 ${formattedValueWithUnit(
          corners[2],
          'kPa',
          2
        )}</text>
        <text x="32" y="351"${exactValueAttribute(corners[3])}>q4 ${formattedValueWithUnit(
          corners[3],
          'kPa',
          2
        )}</text>
      </g>
    </g>
    <g data-model-layer="concrete" stroke="#344b5e" stroke-width="2" stroke-linejoin="round">
      <polygon points="${polygon(top)}" fill="#e8eef4"/>
      <polygon points="${polygon(front)}" fill="#9cadba"/>
      <polygon points="${polygon(side)}" fill="#7e93a5"/>
      <polygon points="${polygon(columnTop)}" fill="#f7fafc" data-visual-symbolic-column="true"/>
      <polygon points="${polygon([columnBase[3], columnBase[2], columnTop[2], columnTop[3]])}" fill="#b7c5d0"/>
      <polygon points="${polygon([columnBase[1], columnBase[2], columnTop[2], columnTop[1]])}" fill="#879baa"/>
    </g>
    <g data-model-layer="barA">${renderBarLines(
      barsA,
      reinforcementMark(reinforcementDirection(reinforcement, 'A'), 'BAR-A'),
      '#c2410c'
    )}</g>
    <g data-model-layer="barB">${renderBarLines(
      barsB,
      reinforcementMark(reinforcementDirection(reinforcement, 'B'), 'BAR-B'),
      '#0f766e'
    )}</g>
    ${
      punchingPolygon
        ? `<polygon points="${punchingPolygon}" fill="none" stroke="#7c3aed" stroke-width="2"
          stroke-dasharray="7 5" data-model-layer="critical"
          data-punching-perimeter="${escapeAttribute(
            firstValue(
              punching,
              ['perimeterM', 'criticalPerimeter', 'bo'],
              firstValue(geometry, ['criticalSections.punching.perimeterM'], 'not-provided-on-surface')
            )
          )}"/>`
        : ''
    }
    <g class="sf-svg-dimension-guides" aria-hidden="true">
      <path d="M161 252V264M539 252V264M161 258H539"/>
      <path d="M145 106H157M145 236H157M151 106V236"/>
      <path d="M545 188H557M545 236H557M551 188V236"/>
    </g>
    <g class="sf-svg-dimension-labels"${exactNamedAttributes({
      'footing-a-m': footingB,
      'footing-b-m': footingL,
      'footing-t-m': footingH,
      'column-a-m': columnA,
      'column-b-m': columnB,
    })}>
      <g data-dimension="footing-a">
        <rect x="286" y="247" width="128" height="23" rx="4"/>
        <text x="350" y="263" text-anchor="middle">A / X = ${formattedValueWithUnit(
          footingB,
          'm',
          2
        )}</text>
      </g>
      <g data-dimension="footing-b">
        <rect x="22" y="158" width="112" height="23" rx="4"/>
        <text x="78" y="174" text-anchor="middle">B / Y = ${formattedValueWithUnit(
          footingL,
          'm',
          2
        )}</text>
      </g>
      <g data-dimension="footing-t">
        <rect x="560" y="199" width="100" height="23" rx="4"/>
        <text x="610" y="215" text-anchor="middle">t = ${formattedValueWithUnit(
          footingH,
          'm',
          2
        )}</text>
      </g>
      <g data-dimension="column-a-b">
        <path d="M${safeNumber(columnTopCenter.x)} ${safeNumber(
          columnTopCenter.y
        )}L432 53"/>
        <rect x="432" y="40" width="258" height="25" rx="4"/>
        <text x="561" y="57" text-anchor="middle">เสา a × b = ${formattedValueWithUnit(
          columnA,
          'm',
          2
        )} × ${formattedValueWithUnit(columnB, 'm', 2)}</text>
      </g>
    </g>
    <g class="sf-svg-callout"${exactNamedAttributes({
      'footing-b-m': footingB,
      'footing-l-m': footingL,
      'footing-h-m': footingH,
      'column-a-m': columnA,
      'column-b-m': columnB,
      'qmax-kpa': qMax,
      'qmin-kpa': qMin,
    })}>
      <rect x="421" y="314" width="273" height="48" rx="5" fill="#fff" stroke="#cbd5df"/>
      <text x="434" y="333">qmax ${formattedValueWithUnit(qMax, 'kPa', 2)}</text>
      <text x="434" y="352">qmin ${formattedValueWithUnit(qMin, 'kPa', 2)}</text>
    </g>
  </svg>`
}

const barCount = (bar) => {
  const count = numericValue(firstValue(bar, ['count', 'barCount', 'quantity'], 0))
  if (count === null) return 0
  return Math.max(0, Math.min(40, Math.trunc(count)))
}

const renderPlanBars = (bar, orientation, bounds, centerlines = [], transform = null) => {
  const count = barCount(bar)
  if (!count) return ''
  const { x, y, width, height } = bounds
  const mark = reinforcementMark(bar, orientation === 'horizontal' ? 'A' : 'B')
  const modelLines =
    transform && Array.isArray(centerlines) && centerlines.length
      ? centerlines
          .map((line) => {
            const start = transform(line?.start?.xM, line?.start?.yM)
            const end = transform(line?.end?.xM, line?.end?.yM)
            if (!start || !end) return ''
            return `<line x1="${safeNumber(start.x)}" y1="${safeNumber(start.y)}"
              x2="${safeNumber(end.x)}" y2="${safeNumber(end.y)}"
              data-bar-id="${escapeAttribute(line?.id || '')}"/>`
          })
          .join('')
      : ''
  const fallbackLines = Array.from({ length: count }, (_, index) => {
    const fraction = (index + 1) / (count + 1)
    if (orientation === 'horizontal') {
      const lineY = y + height * fraction
      return `<line x1="${safeNumber(x)}" y1="${safeNumber(lineY)}" x2="${safeNumber(
        x + width
      )}" y2="${safeNumber(lineY)}"/>`
    }
    const lineX = x + width * fraction
    return `<line x1="${safeNumber(lineX)}" y1="${safeNumber(y)}" x2="${safeNumber(
      lineX
    )}" y2="${safeNumber(y + height)}"/>`
  }).join('')
  return `<g data-select-mark="${escapeAttribute(mark)}" data-bar-count="${count}"
    data-model-layer="${orientation === 'horizontal' ? 'barA' : 'barB'}">${
      modelLines || fallbackLines
    }</g>`
}

const planViewLayout = (geometry) => {
  const width = numericValue(geometryDimension(geometry, 'footing', 'width'))
  const length = numericValue(geometryDimension(geometry, 'footing', 'length'))
  const columnWidth = numericValue(geometryDimension(geometry, 'column', 'width'))
  const columnLength = numericValue(geometryDimension(geometry, 'column', 'length'))
  const usable = 300
  const longest = width && length ? Math.max(width, length) : null
  const footingWidth = longest ? (width / longest) * usable : usable
  const footingHeight = longest ? (length / longest) * usable : usable
  const scale = longest ? usable / longest : null
  const supportWidth = scale && columnWidth ? Math.max(18, columnWidth * scale) : 48
  const supportHeight = scale && columnLength ? Math.max(18, columnLength * scale) : 48
  return {
    footing: {
      x: 260 - footingWidth / 2,
      y: 180 - footingHeight / 2,
      width: footingWidth,
      height: footingHeight,
    },
    support: {
      x: 260 - supportWidth / 2,
      y: 180 - supportHeight / 2,
      width: supportWidth,
      height: supportHeight,
    },
  }
}

const fittedSvgTextLength = (text, width, threshold = 22) =>
  String(text).length > threshold
    ? ` textLength="${escapeAttribute(width)}" lengthAdjust="spacingAndGlyphs"`
    : ''

const directionPresentation = (direction) => {
  const normalized = String(direction).toUpperCase() === 'B' ? 'B' : 'A'
  return normalized === 'A'
    ? Object.freeze({
        direction: 'A',
        axis: 'X',
        axisSymbol: '↔',
        orientation: 'แนวนอน',
        layer: 'ชั้นล่างสุด',
        color: '#c2410c',
      })
    : Object.freeze({
        direction: 'B',
        axis: 'Y',
        axisSymbol: '↕',
        orientation: 'แนวตั้ง',
        layer: 'ชั้นเหนือ A',
        color: '#0f766e',
      })
}

const renderPlanRebarCallout = (bar, direction, y) => {
  const presentation = directionPresentation(direction)
  const mark = rawMetricText(reinforcementMark(bar, `BAR-${direction}`))
  const count = rawMetricText(firstValue(bar, ['count', 'barCount', 'quantity'], EMPTY))
  const size = reinforcementDesignation(bar)
  const spacing = firstValue(bar, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY)
  const heading = `${mark} · ${presentation.direction}/${presentation.axis} ${presentation.axisSymbol}`
  const specification = `${presentation.layer} · ${count}-${size} @ ${rawFormattedValueWithUnit(spacing, 'mm', 1)}`
  return `<g class="sf-plan-rebar-callout" data-plan-callout="${escapeAttribute(direction)}"
    data-axis="${presentation.axis}" data-layer-order="${presentation.direction === 'A' ? 'lowest' : 'above-a'}"
    data-mark="${escapeAttribute(mark)}" data-count="${escapeAttribute(count)}"
    data-size="${escapeAttribute(size)}"${exactValueAttribute(spacing, 'data-spacing-mm')}
    data-callout-x="438" data-callout-y="${escapeAttribute(y)}"
    data-callout-width="168" data-callout-height="58">
    <title>${escapeHtml(`${heading} · ${specification}`)}</title>
    <rect x="438" y="${safeNumber(y)}" width="168" height="58" rx="5"
      fill="#fff" stroke="${direction === 'A' ? '#e7a17f' : '#86c8c0'}"/>
    <text x="448" y="${safeNumber(y + 21)}"${fittedSvgTextLength(heading, 148)}>
      ${escapeHtml(heading)}</text>
    <text x="448" y="${safeNumber(y + 43)}"${fittedSvgTextLength(specification, 148, 20)}>
      ${escapeHtml(specification)}</text>
  </g>`
}

const renderPlanSvg = (geometry, reinforcement, label = 'แปลนฐานราก') => {
  const layout = planViewLayout(geometry)
  let footing = layout.footing
  let support = layout.support
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const renderModel = firstValue(geometry, ['renderModel'], {})
  const bounds = firstValue(renderModel, ['planBounds'], null)
  const transform =
    bounds &&
    Number.isFinite(Number(bounds.minX)) &&
    Number.isFinite(Number(bounds.maxX)) &&
    Number.isFinite(Number(bounds.minY)) &&
    Number.isFinite(Number(bounds.maxY)) &&
    Number(bounds.maxX) > Number(bounds.minX) &&
    Number(bounds.maxY) > Number(bounds.minY)
      ? (x, y) => {
          if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null
          return {
            x:
              layout.footing.x +
              ((Number(x) - Number(bounds.minX)) / (Number(bounds.maxX) - Number(bounds.minX))) *
                layout.footing.width,
            y:
              layout.footing.y +
              ((Number(bounds.maxY) - Number(y)) / (Number(bounds.maxY) - Number(bounds.minY))) *
                layout.footing.height,
          }
        }
      : null
  const transformRect = (rect, fallback) => {
    if (!transform || !rect) return fallback
    const topLeft = transform(rect.x, Number(rect.y) + Number(rect.height))
    const bottomRight = transform(Number(rect.x) + Number(rect.width), rect.y)
    if (!topLeft || !bottomRight) return fallback
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }
  footing = transformRect(firstValue(renderModel, ['footingRect'], null), footing)
  support = transformRect(firstValue(renderModel, ['columnRect'], null), support)
  const punchingRect = transformRect(firstValue(renderModel, ['punchingRect'], null), null)
  const renderCriticalLines = (lines, direction) =>
    transform
      ? toList(lines)
          .map((line) => {
            const start = transform(line?.x1, line?.y1)
            const end = transform(line?.x2, line?.y2)
            if (!start || !end) return ''
            return `<line x1="${safeNumber(start.x)}" y1="${safeNumber(start.y)}"
              x2="${safeNumber(end.x)}" y2="${safeNumber(end.y)}"
              data-critical-direction="${escapeAttribute(direction)}"/>`
          })
          .join('')
      : ''
  return `<svg class="sf-plan-svg" viewBox="0 0 620 390" role="img"
    aria-label="${escapeAttribute(label)}" data-drawing-role="plan" data-scale="NTS"
    data-responsive-svg="viewbox">
    <rect width="620" height="390" fill="#fbfcfd"/>
    <rect x="${safeNumber(footing.x)}" y="${safeNumber(footing.y)}"
      width="${safeNumber(footing.width)}" height="${safeNumber(footing.height)}"
      fill="#f7fafc" stroke="#27384d" stroke-width="2.4"/>
    <g stroke="#c2410c" stroke-width="1.8">
      ${renderPlanBars(
        barA,
        'horizontal',
        footing,
        firstValue(renderModel, ['barsA'], firstValue(barA, ['planCenterlines'], [])),
        transform
      )}
    </g>
    <g stroke="#0f766e" stroke-width="1.8">
      ${renderPlanBars(
        barB,
        'vertical',
        footing,
        firstValue(renderModel, ['barsB'], firstValue(barB, ['planCenterlines'], [])),
        transform
      )}
    </g>
    ${
      punchingRect
        ? `<rect x="${safeNumber(punchingRect.x)}" y="${safeNumber(punchingRect.y)}"
          width="${safeNumber(punchingRect.width)}" height="${safeNumber(punchingRect.height)}"
          fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="7 5"
          data-model-layer="critical"/>`
        : ''
    }
    <g stroke="#64748b" stroke-width="1.5" stroke-dasharray="5 4" data-critical-sections="one-way">
      ${renderCriticalLines(firstValue(renderModel, ['oneWayLines.A'], []), 'A')}
      ${renderCriticalLines(firstValue(renderModel, ['oneWayLines.B'], []), 'B')}
    </g>
    <rect x="${safeNumber(support.x)}" y="${safeNumber(support.y)}"
      width="${safeNumber(support.width)}" height="${safeNumber(support.height)}"
      fill="#e7edf3" stroke="#27384d" stroke-width="2"/>
    <path d="M260 12V348M72 180H448" stroke="#8796a6" stroke-dasharray="7 4 2 4"/>
    <g class="sf-section-cut-line" data-section-cut="X-X" data-section-direction="A">
      <path d="M72 194H448" fill="none" stroke="#243b5a" stroke-width="2"
        stroke-dasharray="10 4"/>
      <path d="M72 194L88 186V202ZM448 194L432 186V202Z" fill="#243b5a"/>
      <text x="56" y="200" text-anchor="middle" fill="#243b5a" font-weight="700">X</text>
      <text x="464" y="200" text-anchor="middle" fill="#243b5a" font-weight="700">X</text>
      <text x="260" y="214" text-anchor="middle" fill="#243b5a" font-weight="700">
        รูปตัด X-X · ทิศ A</text>
    </g>
    <text x="606" y="20" text-anchor="end" class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</text>
    ${renderPlanRebarCallout(barA, 'A', 42)}
    ${renderPlanRebarCallout(barB, 'B', 108)}
    <g class="sf-plan-labels">
      <text x="84" y="372"${exactNamedAttributes({
        'footing-b-m': geometryDimension(geometry, 'footing', 'width'),
        'footing-l-m': geometryDimension(geometry, 'footing', 'length'),
      })}>ฐาน ${formattedValueWithUnit(
        geometryDimension(geometry, 'footing', 'width')
      , 'm', 2)} × ${formattedValueWithUnit(
        geometryDimension(geometry, 'footing', 'length'),
        'm',
        2
      )}</text>
      <text x="350" y="372"${exactNamedAttributes({
        'column-b-m': geometryDimension(geometry, 'column', 'width'),
        'column-l-m': geometryDimension(geometry, 'column', 'length'),
      })}>เสา ${formattedValueWithUnit(
        geometryDimension(geometry, 'column', 'width')
      , 'm', 2)} × ${formattedValueWithUnit(
        geometryDimension(geometry, 'column', 'length'),
        'm',
        2
      )}</text>
    </g>
  </svg>`
}

const renderSectionSvg = (
  geometry,
  reinforcement,
  label = 'รูปตัดฐานราก',
  options = {}
) => {
  const includeBarCutReference = options.includeBarCutReference !== false
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const countB = barCount(barB)
  const renderModel = firstValue(geometry, ['renderModel'], {})
  const sectionBounds = firstValue(renderModel, ['sectionBoundsMm'], {})
  const sectionWidthMm =
    numericValue(firstValue(sectionBounds, ['widthX'], null)) ??
    (numericValue(geometryDimension(geometry, 'footing', 'width')) ?? 1) * 1000
  const sectionHeightMm =
    numericValue(firstValue(sectionBounds, ['height'], null)) ??
    (numericValue(geometryDimension(geometry, 'footing', 'thickness')) ?? 0.3) * 1000
  const sectionX = (xMm) => 82 + ((numericValue(xMm) ?? 0) / sectionWidthMm) * 376
  const sectionY = (zMm) => 258 - ((numericValue(zMm) ?? 0) / sectionHeightMm) * 126
  const sectionHorizontalScale = 376 / sectionWidthMm
  const barAStrokeWidth = reinforcementDiameterMm(barA) * sectionHorizontalScale
  const barBRadius = (reinforcementDiameterMm(barB) * sectionHorizontalScale) / 2
  const sectionTopY = sectionY(sectionHeightMm)
  const barCutAPoints = safeSvgPoints(
    toList(firstValue(renderModel, ['barCutA'], [])).map((point) => [
      sectionX(point?.xMm),
      sectionY(point?.zMm),
    ])
  )
  const dA = firstValue(barA, ['effectiveDepthMm', 'effectiveDepth', 'd', 'depth'], EMPTY)
  const dB = firstValue(barB, ['effectiveDepthMm', 'effectiveDepth', 'd', 'depth'], EMPTY)
  const centerElevationA =
    numericValue(firstValue(barA, ['centerElevationMm'], null)) ??
    (numericValue(dA) === null ? null : sectionHeightMm - numericValue(dA))
  const centerElevationB =
    numericValue(firstValue(barB, ['centerElevationMm'], null)) ??
    (numericValue(dB) === null ? null : sectionHeightMm - numericValue(dB))
  const barCenterAY = centerElevationA === null ? 237 : sectionY(centerElevationA)
  const barCenterBY = centerElevationB === null ? 233 : sectionY(centerElevationB)
  const planBounds = firstValue(renderModel, ['planBounds'], {})
  const planMinX = numericValue(firstValue(planBounds, ['minX'], null))
  const planMaxX = numericValue(firstValue(planBounds, ['maxX'], null))
  const sectionXFromPlanM =
    planMinX !== null && planMaxX !== null && planMaxX > planMinX
      ? (xM) => {
          const numericXM = numericValue(xM)
          return numericXM === null
            ? null
            : 82 + ((numericXM - planMinX) / (planMaxX - planMinX)) * 376
        }
      : null
  const barBCenterlines = toList(
    firstValue(renderModel, ['barsB'], firstValue(barB, ['planCenterlines'], []))
  )
  const modelCircles = sectionXFromPlanM
    ? barBCenterlines
        .map((line, index) => {
          const xM = firstValue(line, ['start.xM', 'end.xM'], null)
          const zM = firstValue(line, ['start.zM', 'end.zM'], null)
          const x = sectionXFromPlanM(xM)
          const zMm = numericValue(zM) === null ? centerElevationB : numericValue(zM) * 1000
          if (x === null || zMm === null) return ''
          return `<circle cx="${safeNumber(x)}" cy="${safeNumber(sectionY(zMm))}"
            r="${safeNumber(barBRadius)}"
            data-bar-id="${escapeAttribute(firstValue(line, ['id'], `${reinforcementMark(
              barB,
              'BAR-B'
            )}-${index + 1}`))}" data-center-x-m="${escapeAttribute(xM)}"
            data-center-z-mm="${escapeAttribute(zMm)}"
            data-bar-diameter-mm="${safeNumber(reinforcementDiameterMm(barB))}"
            data-svg-radius="${safeNumber(barBRadius)}"/>`
        })
        .join('')
    : ''
  const fallbackCircles = Array.from({ length: countB }, (_, index) => {
    const x = countB > 1 ? 111 + (318 * index) / (countB - 1) : 270
    return `<circle cx="${safeNumber(x)}" cy="${safeNumber(barCenterBY)}"
      r="${safeNumber(barBRadius)}" data-bar-diameter-mm="${safeNumber(
        reinforcementDiameterMm(barB)
      )}" data-svg-radius="${safeNumber(barBRadius)}"/>`
  }).join('')
  const circles = modelCircles || fallbackCircles
  const spacingA = firstValue(barA, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY)
  const spacingB = firstValue(barB, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY)
  const cover = firstValue(
    geometry,
    ['footing.coverM', 'cover', 'clearCover', 'reinforcementCover'],
    EMPTY
  )
  const coverNumeric = numericValue(cover)
  const coverMm =
    coverNumeric === null ? EMPTY : coverNumeric <= 2 ? coverNumeric * 1000 : coverNumeric
  return `<svg class="sf-section-svg" viewBox="0 0 620 360" role="img"
    aria-label="${escapeAttribute(label)}" data-drawing-role="section" data-scale="NTS"
    data-responsive-svg="viewbox">
    <rect width="620" height="360" fill="#fbfcfd"/>
    <text x="590" y="20" text-anchor="end" class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</text>
    <path d="M30 98H235M305 98H590" stroke="#8495a7" stroke-width="1.5"/>
    <rect x="235" y="20" width="70" height="112" fill="#eef3f7" stroke="#334155" stroke-width="2.2"/>
    <rect x="82" y="132" width="376" height="126" fill="#f8fafc" stroke="#334155" stroke-width="2.4"
      data-model-layer="concrete"/>
    ${
      barCutAPoints
        ? `<polyline points="${escapeAttribute(barCutAPoints)}" fill="none" stroke="#c2410c"
          stroke-width="${safeNumber(barAStrokeWidth)}" stroke-linecap="butt"
          stroke-linejoin="round" data-cut-end="butt"
          data-bar-diameter-mm="${safeNumber(reinforcementDiameterMm(barA))}"
          data-svg-stroke-width="${safeNumber(barAStrokeWidth)}"
          data-select-mark="${escapeAttribute(
            reinforcementMark(barA, 'BAR-A')
          )}" data-model-layer="barA"${exactValueAttribute(
            centerElevationA,
            'data-center-z-mm'
          )}/>`
        : `<path d="M102 155V${safeNumber(barCenterAY - 23)}Q102 ${safeNumber(
            barCenterAY
          )} 122 ${safeNumber(barCenterAY)}H418Q438 ${safeNumber(
            barCenterAY
          )} 438 ${safeNumber(barCenterAY - 23)}V155"
          fill="none" stroke="#c2410c" stroke-width="${safeNumber(
            barAStrokeWidth
          )}" stroke-linecap="butt" stroke-linejoin="round" data-cut-end="butt"
          data-bar-diameter-mm="${safeNumber(reinforcementDiameterMm(barA))}"
          data-svg-stroke-width="${safeNumber(barAStrokeWidth)}"
          data-select-mark="${escapeAttribute(
            reinforcementMark(barA, 'BAR-A')
          )}" data-model-layer="barA"${exactValueAttribute(
            centerElevationA,
            'data-center-z-mm'
          )}/>`
    }
    <g fill="#0f766e" stroke="#f8fafc" stroke-width="1"
      data-select-mark="${escapeAttribute(reinforcementMark(barB, 'BAR-B'))}"
      data-model-layer="barB" data-bar-count="${countB}"
      ${exactValueAttribute(spacingB, 'data-spacing-mm').trim()}>${circles}</g>
    <g class="sf-section-dimensions">
      <path d="M482 ${safeNumber(sectionTopY)}V${safeNumber(barCenterAY)}
        M475 ${safeNumber(sectionTopY)}H489M475 ${safeNumber(barCenterAY)}H489"
        stroke="#c2410c" data-dimension="dA"${exactValueAttribute(
          sectionHeightMm,
          'data-from-z-mm'
        )}${exactValueAttribute(centerElevationA, 'data-to-z-mm')}
        data-svg-y1="${safeNumber(sectionTopY)}" data-svg-y2="${safeNumber(barCenterAY)}"/>
      <text x="500" y="${safeNumber((sectionTopY + barCenterAY) / 2)}"
        transform="rotate(-90 500 ${safeNumber((sectionTopY + barCenterAY) / 2)})"
        text-anchor="middle">dA ${formattedValueWithUnit(dA, 'mm', 1)}</text>
      <path d="M532 ${safeNumber(sectionTopY)}V${safeNumber(barCenterBY)}
        M525 ${safeNumber(sectionTopY)}H539M525 ${safeNumber(barCenterBY)}H539"
        stroke="#0f766e" data-dimension="dB"${exactValueAttribute(
          sectionHeightMm,
          'data-from-z-mm'
        )}${exactValueAttribute(centerElevationB, 'data-to-z-mm')}
        data-svg-y1="${safeNumber(sectionTopY)}" data-svg-y2="${safeNumber(barCenterBY)}"/>
      <text x="550" y="${safeNumber((sectionTopY + barCenterBY) / 2)}"
        transform="rotate(-90 550 ${safeNumber((sectionTopY + barCenterBY) / 2)})"
        text-anchor="middle">dB ${formattedValueWithUnit(dB, 'mm', 1)}</text>
    </g>
    <g class="sf-section-labels">
      <text x="88" y="286" fill="#c2410c" data-section-direction="A" data-axis="X"
        ${fittedSvgTextLength(`${rawMetricText(reinforcementMark(barA, 'BAR-A'))} · A/X ↔ · ชั้นล่างสุด · ${rawMetricText(
          firstValue(barA, ['count', 'barCount'], EMPTY)
        )}-${reinforcementDesignation(barA)} @ ${rawFormattedValueWithUnit(spacingA, 'mm', 1)}`, 360, 44)}>
        ${metricText(reinforcementMark(barA, 'BAR-A'))} · A/X ↔ · ชั้นล่างสุด ·
        ${metricText(firstValue(barA, ['count', 'barCount'], EMPTY))}-${metricText(reinforcementDesignation(barA))}
        @ ${formattedValueWithUnit(spacingA, 'mm', 1)}</text>
      <text x="88" y="318" fill="#0f766e" data-section-direction="B" data-axis="Y"
        ${fittedSvgTextLength(`${rawMetricText(reinforcementMark(barB, 'BAR-B'))} · B/Y ↕ · ชั้นเหนือ A · ${rawMetricText(
          firstValue(barB, ['count', 'barCount'], EMPTY)
        )}-${reinforcementDesignation(barB)} @ ${rawFormattedValueWithUnit(spacingB, 'mm', 1)}`, 360, 44)}>
        ${metricText(reinforcementMark(barB, 'BAR-B'))} · B/Y ↕ · ชั้นเหนือ A ·
        ${metricText(firstValue(barB, ['count', 'barCount'], EMPTY))}-${metricText(reinforcementDesignation(barB))}
        @ ${formattedValueWithUnit(spacingB, 'mm', 1)}</text>
      <text x="88" y="344"${exactValueAttribute(cover, 'data-exact-cover')}${
        coverMm === EMPTY ? '' : exactValueAttribute(coverMm, 'data-cover-mm')
      }>ระยะหุ้ม ${formattedValueWithUnit(coverMm, 'mm', 0)}${
          includeBarCutReference ? ' · รูปดัดต้องตรวจจากชุดข้อมูล Bar Cut' : ''
        }</text>
    </g>
  </svg>`
}

const renderA4PlanSvg = (geometry, reinforcement, label = 'แปลนฐานรากในรายงาน A4') => {
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const renderModel = firstValue(geometry, ['renderModel'], {})
  const bounds = firstValue(renderModel, ['planBounds'], null)
  const footingWidthM = numericValue(geometryDimension(geometry, 'footing', 'width')) ?? 1
  const footingLengthM = numericValue(geometryDimension(geometry, 'footing', 'length')) ?? 1
  const largestDimension = Math.max(footingWidthM, footingLengthM, 0.001)
  const footing = {
    width: (footingWidthM / largestDimension) * 172,
    height: (footingLengthM / largestDimension) * 172,
  }
  footing.x = 16 + (172 - footing.width) / 2
  footing.y = 10 + (172 - footing.height) / 2
  const transform =
    bounds &&
    Number.isFinite(Number(bounds.minX)) &&
    Number.isFinite(Number(bounds.maxX)) &&
    Number.isFinite(Number(bounds.minY)) &&
    Number.isFinite(Number(bounds.maxY)) &&
    Number(bounds.maxX) > Number(bounds.minX) &&
    Number(bounds.maxY) > Number(bounds.minY)
      ? (x, y) => {
          if (!Number.isFinite(Number(x)) || !Number.isFinite(Number(y))) return null
          return {
            x:
              footing.x +
              ((Number(x) - Number(bounds.minX)) / (Number(bounds.maxX) - Number(bounds.minX))) *
                footing.width,
            y:
              footing.y +
              ((Number(bounds.maxY) - Number(y)) / (Number(bounds.maxY) - Number(bounds.minY))) *
                footing.height,
          }
        }
      : null
  const transformRect = (rect, fallback) => {
    if (!transform || !rect) return fallback
    const topLeft = transform(rect.x, Number(rect.y) + Number(rect.height))
    const bottomRight = transform(Number(rect.x) + Number(rect.width), rect.y)
    if (!topLeft || !bottomRight) return fallback
    return {
      x: topLeft.x,
      y: topLeft.y,
      width: bottomRight.x - topLeft.x,
      height: bottomRight.y - topLeft.y,
    }
  }
  const columnWidthM = numericValue(geometryDimension(geometry, 'column', 'width')) ?? 0.25
  const columnLengthM = numericValue(geometryDimension(geometry, 'column', 'length')) ?? 0.25
  const fallbackColumn = {
    width: (columnWidthM / footingWidthM) * footing.width,
    height: (columnLengthM / footingLengthM) * footing.height,
  }
  fallbackColumn.x = footing.x + (footing.width - fallbackColumn.width) / 2
  fallbackColumn.y = footing.y + (footing.height - fallbackColumn.height) / 2
  const support = transformRect(firstValue(renderModel, ['columnRect'], null), fallbackColumn)
  const punchingRect = transformRect(firstValue(renderModel, ['punchingRect'], null), null)
  const barCenterlines = (bar, direction) =>
    toList(
      firstValue(
        renderModel,
        [direction === 'A' ? 'barsA' : 'barsB'],
        firstValue(bar, ['planCenterlines'], [])
      )
    )
  const barTarget = (bar, direction) => {
    const lines = barCenterlines(bar, direction)
      .map((line) => {
        if (!transform) return null
        const start = transform(line?.start?.xM, line?.start?.yM)
        const end = transform(line?.end?.xM, line?.end?.yM)
        return start && end ? { start, end } : null
      })
      .filter(Boolean)
    if (lines.length) {
      const desiredCoordinate =
        direction === 'A'
          ? footing.y + footing.height * 0.22
          : footing.x + footing.width * 0.82
      const selected = [...lines].sort((left, right) => {
        const leftMid =
          direction === 'A'
            ? (left.start.y + left.end.y) / 2
            : (left.start.x + left.end.x) / 2
        const rightMid =
          direction === 'A'
            ? (right.start.y + right.end.y) / 2
            : (right.start.x + right.end.x) / 2
        return (
          Math.abs(leftMid - desiredCoordinate) -
          Math.abs(rightMid - desiredCoordinate)
        )
      })[0]
      return direction === 'A'
        ? {
            x: selected.start.x + (selected.end.x - selected.start.x) * 0.88,
            y: (selected.start.y + selected.end.y) / 2,
          }
        : {
            x: (selected.start.x + selected.end.x) / 2,
            y: selected.start.y + (selected.end.y - selected.start.y) * 0.72,
          }
    }
    const count = Math.max(1, barCount(bar))
    const index = direction === 'A' ? Math.min(1, count - 1) : Math.max(0, count - 2)
    const fraction = (index + 1) / (count + 1)
    return direction === 'A'
      ? {
          x: footing.x + footing.width * 0.88,
          y: footing.y + footing.height * fraction,
        }
      : {
          x: footing.x + footing.width * fraction,
          y: footing.y + footing.height * 0.72,
        }
  }
  const callout = (bar, direction, y, color) => {
    const axis = direction === 'A' ? 'X' : 'Y'
    const axisSymbol = direction === 'A' ? '↔' : '↕'
    const layer = direction === 'A' ? 'ชั้นล่างสุด' : 'ชั้นเหนือ A'
    const summary = `${rawMetricText(
      reinforcementMark(bar, `BAR-${direction}`)
    )} · ${direction}/${axis} ${axisSymbol} · ${layer}`
    const specification = `${barCount(bar)}-${reinforcementDesignation(bar)} @ ${rawFormattedValueWithUnit(
      firstValue(bar, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY),
      'mm',
      1
    )}`
    const target = barTarget(bar, direction)
    return `<g class="a4-compact-callout a4-compact-callout--leader"
      data-plan-callout="${direction}" data-axis="${axis}"
      data-layer-order="${direction === 'A' ? 'lowest' : 'above-a'}">
      <path d="M216 ${safeNumber(y + 18)}H202L${safeNumber(target.x)} ${safeNumber(
        target.y
      )}" fill="none" stroke="${color}" stroke-width="2"
        marker-end="url(#a4-plan-bar-arrow-${direction.toLowerCase()})"
        data-callout-leader="${direction}" data-leader-target="bar${direction}"
        data-target-x="${safeNumber(target.x)}" data-target-y="${safeNumber(target.y)}"/>
      <circle cx="216" cy="${safeNumber(y + 18)}" r="2.8" fill="${color}"/>
      <text x="224" y="${safeNumber(y + 12)}" fill="${color}"${fittedSvgTextLength(
        summary,
        180,
        20
      )}>${escapeHtml(summary)}</text>
      <text x="224" y="${safeNumber(y + 42)}"${fittedSvgTextLength(
        specification,
        180,
        20
      )}>${escapeHtml(specification)}</text>
    </g>`
  }
  return `<svg class="sf-plan-svg a4-compact-diagram" viewBox="0 0 420 220"
    role="img" aria-label="${escapeAttribute(label)}" data-drawing-role="plan"
    data-scale="NTS" data-responsive-svg="viewbox" data-a4-compact-drawing="plan">
    <rect width="420" height="220" fill="#fbfcfd"/>
    <defs>
      <marker id="a4-plan-bar-arrow-a" viewBox="0 0 8 8" refX="7" refY="4"
        markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="#c2410c"/>
      </marker>
      <marker id="a4-plan-bar-arrow-b" viewBox="0 0 8 8" refX="7" refY="4"
        markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M0 0L8 4L0 8Z" fill="#0f766e"/>
      </marker>
    </defs>
    <rect x="${safeNumber(footing.x)}" y="${safeNumber(footing.y)}"
      width="${safeNumber(footing.width)}" height="${safeNumber(footing.height)}"
      fill="#f7fafc" stroke="#27384d" stroke-width="2.4" data-model-layer="concrete"/>
    <g stroke="#c2410c" stroke-width="1.8" data-model-layer="barA">
      ${renderPlanBars(
        barA,
        'horizontal',
        footing,
        firstValue(renderModel, ['barsA'], firstValue(barA, ['planCenterlines'], [])),
        transform
      )}
    </g>
    <g stroke="#0f766e" stroke-width="1.8" data-model-layer="barB">
      ${renderPlanBars(
        barB,
        'vertical',
        footing,
        firstValue(renderModel, ['barsB'], firstValue(barB, ['planCenterlines'], [])),
        transform
      )}
    </g>
    ${
      punchingRect
        ? `<rect x="${safeNumber(punchingRect.x)}" y="${safeNumber(punchingRect.y)}"
          width="${safeNumber(punchingRect.width)}" height="${safeNumber(punchingRect.height)}"
          fill="none" stroke="#7c3aed" stroke-width="2" stroke-dasharray="6 4"
          data-model-layer="critical"/>`
        : ''
    }
    <rect x="${safeNumber(support.x)}" y="${safeNumber(support.y)}"
      width="${safeNumber(support.width)}" height="${safeNumber(support.height)}"
      fill="#e7edf3" stroke="#27384d" stroke-width="2.2"/>
    <path d="M${safeNumber(footing.x - 5)} ${safeNumber(footing.y + footing.height / 2)}
      H${safeNumber(footing.x + footing.width + 5)}" fill="none" stroke="#243b5a"
      stroke-width="1.8" stroke-dasharray="8 4" data-section-cut="X-X"/>
    <text x="${safeNumber(footing.x - 9)}" y="${safeNumber(
      footing.y + footing.height / 2 + 7
    )}" text-anchor="end" data-section-tag="X-left">X</text>
    <text x="${safeNumber(footing.x + footing.width + 9)}" y="${safeNumber(
      footing.y + footing.height / 2 + 7
    )}" data-section-tag="X-right">X</text>
    <text x="${safeNumber(footing.x + footing.width / 2)}" y="207" text-anchor="middle"
      ${exactNamedAttributes({
        'footing-b-m': footingWidthM,
        'footing-l-m': footingLengthM,
      })}>ฐาน ${formattedNumber(footingWidthM, 2)} × ${formattedNumber(
        footingLengthM,
        2
      )} m</text>
    ${callout(barA, 'A', 28, '#c2410c')}
    ${callout(barB, 'B', 122, '#0f766e')}
    <text x="404" y="207" text-anchor="end">NTS</text>
  </svg>`
}

const renderA4SectionSvg = (
  geometry,
  reinforcement,
  label = 'รูปตัดฐานรากในรายงาน A4'
) => {
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const renderModel = firstValue(geometry, ['renderModel'], {})
  const widthMm =
    numericValue(firstValue(renderModel, ['sectionBoundsMm.widthX'], null)) ??
    (numericValue(geometryDimension(geometry, 'footing', 'width')) ?? 1) * 1000
  const thicknessMm =
    numericValue(firstValue(renderModel, ['sectionBoundsMm.height'], null)) ??
    (numericValue(geometryDimension(geometry, 'footing', 'thickness')) ?? 0.3) * 1000
  const columnWidthMm =
    (numericValue(geometryDimension(geometry, 'column', 'width')) ?? 0.25) * 1000
  const cover = firstValue(
    geometry,
    ['footing.coverM', 'cover', 'clearCover', 'reinforcementCover'],
    EMPTY
  )
  const coverNumeric = numericValue(cover)
  const coverMm =
    coverNumeric === null ? EMPTY : coverNumeric <= 2 ? coverNumeric * 1000 : coverNumeric
  const footingBox = { x: 18, y: 58, width: 262, height: 92 }
  const sectionX = (xMm) => footingBox.x + ((numericValue(xMm) ?? 0) / widthMm) * footingBox.width
  const sectionY = (zMm) =>
    footingBox.y + footingBox.height - ((numericValue(zMm) ?? 0) / thicknessMm) * footingBox.height
  const dA = firstValue(barA, ['effectiveDepthMm', 'effectiveDepth', 'd', 'depth'], EMPTY)
  const dB = firstValue(barB, ['effectiveDepthMm', 'effectiveDepth', 'd', 'depth'], EMPTY)
  const centerElevationA =
    numericValue(firstValue(barA, ['centerElevationMm'], null)) ??
    (numericValue(dA) === null ? 50 : thicknessMm - numericValue(dA))
  const centerElevationB =
    numericValue(firstValue(barB, ['centerElevationMm'], null)) ??
    (numericValue(dB) === null ? 70 : thicknessMm - numericValue(dB))
  const barCutAPoints = safeSvgPoints(
    toList(firstValue(renderModel, ['barCutA'], [])).map((point) => [
      sectionX(point?.xMm),
      sectionY(point?.zMm),
    ])
  )
  const barAStroke = Math.max(2.5, reinforcementDiameterMm(barA) * (footingBox.width / widthMm))
  const barBRadius = Math.max(
    2.1,
    (reinforcementDiameterMm(barB) * (footingBox.width / widthMm)) / 2
  )
  const planBounds = firstValue(renderModel, ['planBounds'], {})
  const planMinX = numericValue(firstValue(planBounds, ['minX'], null))
  const planMaxX = numericValue(firstValue(planBounds, ['maxX'], null))
  const sectionXFromPlanM =
    planMinX !== null && planMaxX !== null && planMaxX > planMinX
      ? (xM) => {
          const value = numericValue(xM)
          return value === null
            ? null
            : footingBox.x + ((value - planMinX) / (planMaxX - planMinX)) * footingBox.width
        }
      : null
  const barBCenterlines = toList(
    firstValue(renderModel, ['barsB'], firstValue(barB, ['planCenterlines'], []))
  )
  const circles = sectionXFromPlanM
    ? barBCenterlines
        .map((line, index) => {
          const xM = firstValue(line, ['start.xM', 'end.xM'], null)
          const zM = firstValue(line, ['start.zM', 'end.zM'], null)
          const x = sectionXFromPlanM(xM)
          const zMm =
            numericValue(zM) === null ? centerElevationB : numericValue(zM) * 1000
          return x === null
            ? ''
            : `<circle cx="${safeNumber(x)}" cy="${safeNumber(sectionY(zMm))}"
              r="${safeNumber(barBRadius)}" data-bar-id="${escapeAttribute(
                firstValue(line, ['id'], `${reinforcementMark(barB, 'BAR-B')}-${index + 1}`)
              )}"/>`
        })
        .join('')
    : Array.from({ length: barCount(barB) }, (_, index) => {
        const x =
          barCount(barB) > 1
            ? footingBox.x +
              18 +
              ((footingBox.width - 36) * index) / (barCount(barB) - 1)
            : footingBox.x + footingBox.width / 2
        return `<circle cx="${safeNumber(x)}" cy="${safeNumber(sectionY(centerElevationB))}"
          r="${safeNumber(barBRadius)}"/>`
      }).join('')
  const columnWidth = (columnWidthMm / widthMm) * footingBox.width
  const columnX = footingBox.x + (footingBox.width - columnWidth) / 2
  const rebarCallout = (bar, direction, x, y, color) => {
    const presentation = directionPresentation(direction)
    const text = `${rawMetricText(reinforcementMark(bar, `BAR-${direction}`))} · ${presentation.direction}/${presentation.axis} ${presentation.axisSymbol} · ${presentation.layer} ·
      ${barCount(bar)}-${reinforcementDesignation(bar)} @ ${rawFormattedValueWithUnit(
        firstValue(bar, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY),
        'mm',
        1
      )}`
    return `<text x="${safeNumber(x)}" y="${safeNumber(y)}" fill="${color}"
      data-section-callout="${direction}" data-axis="${presentation.axis}"
      data-layer-order="${presentation.direction === 'A' ? 'lowest' : 'above-a'}"
      ${fittedSvgTextLength(text, 187, 28)}>${escapeHtml(text)}</text>`
  }
  return `<svg class="sf-section-svg a4-compact-diagram" viewBox="0 0 420 220"
    role="img" aria-label="${escapeAttribute(label)}" data-drawing-role="section"
    data-scale="NTS" data-responsive-svg="viewbox" data-a4-compact-drawing="section">
    <rect width="420" height="220" fill="#fbfcfd"/>
    <path d="M8 58H${safeNumber(columnX)}M${safeNumber(
      columnX + columnWidth
    )} 58H410" stroke="#8495a7" stroke-width="1.5"/>
    <rect x="${safeNumber(columnX)}" y="8" width="${safeNumber(columnWidth)}" height="50"
      fill="#eef3f7" stroke="#334155" stroke-width="2.2"/>
    <rect x="${footingBox.x}" y="${footingBox.y}" width="${footingBox.width}"
      height="${footingBox.height}" fill="#f8fafc" stroke="#334155" stroke-width="2.4"
      data-model-layer="concrete"/>
    ${
      barCutAPoints
        ? `<polyline points="${escapeAttribute(barCutAPoints)}" fill="none" stroke="#c2410c"
          stroke-width="${safeNumber(barAStroke)}" stroke-linecap="butt"
          stroke-linejoin="round" data-model-layer="barA" data-cut-end="butt"/>`
        : `<path d="M${safeNumber(sectionX(coverMm))} ${safeNumber(
            sectionY(thicknessMm - coverMm)
          )}V${safeNumber(sectionY(centerElevationA))}H${safeNumber(
            sectionX(widthMm - coverMm)
          )}V${safeNumber(sectionY(thicknessMm - coverMm))}"
          fill="none" stroke="#c2410c" stroke-width="${safeNumber(barAStroke)}"
          stroke-linecap="butt" stroke-linejoin="round" data-model-layer="barA"
          data-cut-end="butt"/>`
    }
    <g fill="#0f766e" stroke="#f8fafc" stroke-width="0.8" data-model-layer="barB"
      data-bar-count="${barCount(barB)}">${circles}</g>
    <g class="a4-compact-dimensions"
      aria-label="t ${formattedNumber(thicknessMm, 0)} mm; dA ${formattedNumber(
        dA,
        0
      )} mm; dB ${formattedNumber(dB, 0)} mm; ระยะหุ้ม ${formattedNumber(
        coverMm,
        0
      )} mm">
      <path d="M292 58V150M286 58H298M286 150H298" stroke="#334155"/>
      <rect x="296" y="46" width="118" height="132" rx="4"
        fill="#fbfcfd" stroke="#d8e0e8" data-dimension-rail="section"/>
      <path d="M345 50V174" stroke="#d8e0e8"/>
      <text x="302" y="68" data-section-dimension="thickness">t =</text>
      <text x="408" y="68" text-anchor="end" data-section-dimension-value="thickness"
        ${exactValueAttribute(thicknessMm, 'data-thickness-mm')}>${formattedNumber(
          thicknessMm,
          0
        )} mm</text>
      <text x="302" y="100" fill="#c2410c" data-section-dimension="dA">dA =</text>
      <text x="408" y="100" text-anchor="end" fill="#c2410c"
        data-section-dimension-value="dA"${exactValueAttribute(dA, 'data-depth-mm')}>
        ${formattedNumber(dA, 0)} mm</text>
      <text x="302" y="132" fill="#0f766e" data-section-dimension="dB">dB =</text>
      <text x="408" y="132" text-anchor="end" fill="#0f766e"
        data-section-dimension-value="dB"${exactValueAttribute(dB, 'data-depth-mm')}>
        ${formattedNumber(dB, 0)} mm</text>
      <text x="302" y="164" data-section-dimension="cover"
        ${fittedSvgTextLength('ระยะหุ้ม', 36, 0)}>ระยะหุ้ม</text>
      <text x="408" y="164" text-anchor="end" data-section-dimension-value="cover"
        ${exactValueAttribute(coverMm, 'data-cover-mm')}>${formattedNumber(
          coverMm,
          0
        )} mm</text>
    </g>
    ${rebarCallout(barA, 'A', 18, 210, '#c2410c')}
    ${rebarCallout(barB, 'B', 215, 210, '#0f766e')}
    <text x="404" y="32" text-anchor="end">NTS</text>
  </svg>`
}

const diagramDirections = (diagrams) => {
  if (Array.isArray(diagrams)) {
    return diagrams.map((model, index) => ({
      direction: firstValue(model, ['direction', 'axis', 'label'], `ทิศ ${index + 1}`),
      model,
    }))
  }
  if (!diagrams || typeof diagrams !== 'object') return []
  const direct = firstValue(diagrams, ['directions', 'models', 'strips'], null)
  if (direct) return diagramDirections(direct)
  const entries = []
  for (const direction of ['A', 'B']) {
    const model = firstValue(diagrams, [direction, direction.toLowerCase()], null)
    if (model) entries.push({ direction, model })
  }
  return entries.length
    ? entries
    : [{ direction: firstValue(diagrams, ['direction', 'axis'], 'A / B'), model: diagrams }]
}

const renderSingleDiagram = (entry, kind, options = {}) => {
  const nestedModel = firstValue(entry.model, [kind, `${kind}Diagram`, `${kind}Model`], null)
  const model = nestedModel || entry.model || {}
  const stations = toList(firstValue(entry.model, ['stations'], firstValue(model, ['stations'], [])))
  const stationField = kind === 'moment' ? 'momentKNmPerM' : 'shearKNPerM'
  const stationValues = stations
    .map((station) => numericValue(firstValue(station, [stationField], null)))
    .filter((value) => value !== null)
  const stationMaximum = stationValues.length
    ? stationValues.reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0)
    : null
  const plottedStations =
    stations.length && stationMaximum !== null
      ? stations
          .map((station, index) => {
            const ratio =
              numericValue(firstValue(station, ['ratio'], null)) ??
              (stations.length > 1 ? index / (stations.length - 1) : 0)
            const stationValue = numericValue(firstValue(station, [stationField], 0)) ?? 0
            return {
              x: 62 + 406 * (1 - Math.max(0, Math.min(1, ratio))),
              y: stationMaximum > 0 ? 112 - (Math.abs(stationValue) / stationMaximum) * 78 : 112,
            }
          })
          .sort((a, b) => a.x - b.x)
      : []
  const stationPoints = safeSvgPoints(plottedStations)
  const points =
    stationPoints ||
    safeSvgPoints(firstValue(model, ['svgPoints', 'points', 'renderPoints'], ''))
  const value = firstValue(
    model,
    ['maximum', 'max', 'peak', 'demand', 'value', 'governingValue'],
    stationMaximum ?? EMPTY
  )
  const unit = firstValue(
    model,
    ['unit', 'canonicalUnits'],
    firstValue(entry.model, [`units.${kind}`], kind === 'moment' ? 'kN.m/m' : 'kN/m')
  )
  const evaluationStatus = normalizedStatus(
    firstValue(entry.model, ['status'], stationPoints ? 'EVALUATED' : 'HOLD')
  )
  const evaluated = evaluationStatus === 'EVALUATED' && Boolean(stationPoints)
  const title = kind === 'moment' ? 'ขนาดโมเมนต์ดัด' : 'แรงเฉือนทางเดียว'
  const cantileverM = firstValue(entry.model, ['cantileverM', 'cantilever', 'projectionM'], EMPTY)
  const criticalDistanceM = firstValue(
    entry.model,
    ['criticalDistanceFromColumnFaceM', 'criticalDistanceM', 'effectiveDepthM'],
    EMPTY
  )
  const cantileverNumber = numericValue(cantileverM)
  const criticalNumber = numericValue(criticalDistanceM)
  const criticalRatio =
    cantileverNumber !== null && cantileverNumber > 0 && criticalNumber !== null
      ? Math.max(0, Math.min(1, criticalNumber / cantileverNumber))
      : null
  const criticalX =
    kind === 'moment' ? 62 : criticalRatio === null ? 265 : 62 + 406 * criticalRatio
  const criticalValue =
    kind === 'moment' ? value : firstValue(options, ['criticalValue', 'designValue'], EMPTY)
  const criticalValueNumber = numericValue(criticalValue)
  const criticalY =
    stationMaximum !== null && stationMaximum > 0 && criticalValueNumber !== null
      ? 112 - Math.max(0, Math.min(1, Math.abs(criticalValueNumber) / stationMaximum)) * 78
      : kind === 'moment'
        ? 34
        : 73
  const lineClass = kind === 'moment' ? 'chart-result--moment' : 'chart-result--shear'
  const resultColor = kind === 'moment' ? '#c2410c' : '#0f766e'
  const headlineValue =
    kind === 'shear' && criticalValueNumber !== null ? criticalValue : value
  const headlineText =
    kind === 'moment'
      ? `|Mu| @ x=0 = ${evaluated ? rawFormattedValueWithUnit(headlineValue, unit, 3) : NOT_EVALUATED}`
      : `Vu @ x=d = ${
          evaluated ? rawFormattedValueWithUnit(headlineValue, unit, 3) : NOT_EVALUATED
        } · Vmax @ x=0 = ${
          evaluated ? rawFormattedValueWithUnit(value, unit, 3) : NOT_EVALUATED
        }`
  const axisTitle = kind === 'moment' ? `|M(x)| [${rawMetricText(unit)}]` : `V(x) [${rawMetricText(unit)}]`
  return `<figure class="sf-analysis-diagram evidence-panel chart-panel" data-diagram="${kind}"
    data-direction="${escapeAttribute(entry.direction)}"
    ${kind === 'moment' ? 'data-moment-sign="magnitude-only"' : ''}
    data-evaluation="${evaluated ? 'evaluated' : 'not-evaluated'}"${
      evaluated ? exactValueAttribute(value) : ''
    }>
    <figcaption class="chart-heading"><span>${
      kind === 'moment' ? 'BMD · |M(x)|' : 'SFD · V(x)'
    } ทิศ ${
      metricText(entry.direction)
    }</span><b>${metricText(headlineText)}</b></figcaption>
    <svg class="engineering-chart" viewBox="0 0 520 138" role="img"
      data-axis-x="distance-from-column-face" data-axis-y="${escapeAttribute(kind)}"
      data-critical-station="${kind === 'moment' ? 'column-face' : 'effective-depth'}"
      aria-label="${escapeAttribute(
        `${title} ทิศ ${rawMetricText(
          entry.direction
        )} กราฟแสดงเฉพาะขนาดสัมบูรณ์ แกนระยะ x จากหน้าเสาถึงขอบฐาน ${
          kind === 'moment'
            ? 'โมเมนต์วิกฤตที่หน้าเสา x เท่ากับศูนย์'
            : 'แรงเฉือนออกแบบที่หน้าตัดวิกฤต x เท่ากับ d'
        } และค่าลดเป็นศูนย์ที่ขอบฐาน`
      )}">
      <rect x="62" y="22" width="406" height="90" rx="2" class="chart-plot"/>
      <path d="M62 52H468M62 82H468M164 22V112M265 22V112M367 22V112"
        class="chart-gridline"/>
      ${
        evaluated && points
          ? `<polyline points="${escapeAttribute(points)}" fill="none"
              stroke="${resultColor}" stroke-width="3.5" class="chart-result ${lineClass}"/>`
          : ''
      }
      <path d="M62 116V18M57 27L62 18L67 27M58 112H478M469 107L478 112L469 117"
        class="chart-axis"/>
      ${
        evaluated && kind === 'shear'
          ? `<path d="M${safeNumber(criticalX)} 22V116" class="chart-critical"/>
            <circle cx="${safeNumber(criticalX)}" cy="${safeNumber(criticalY)}" r="4.5"
              class="chart-critical-point chart-critical-point--shear"/>
            <text x="${safeNumber(criticalX)}" y="130" text-anchor="middle"
              class="chart-tick-label">d=${formattedValueWithUnit(
                criticalDistanceM,
                'm',
                3
              )}</text>`
          : evaluated
            ? `<circle cx="62" cy="${safeNumber(criticalY)}" r="4.5"
              class="chart-critical-point chart-critical-point--moment"/>`
            : ''
      }
      ${
        evaluated
          ? ''
          : `<text x="265" y="72" text-anchor="middle"
              class="chart-empty-label">${NOT_EVALUATED} · ไม่มีเส้นผลจาก Snapshot</text>`
      }
      <text transform="translate(17 68) rotate(-90)" text-anchor="middle"
        class="chart-axis-title">${metricText(axisTitle)}</text>
      <text x="486" y="104" class="chart-axis-title">x [m]</text>
      <text x="62" y="130" text-anchor="start" class="chart-tick-label">0 · หน้าเสา</text>
      <text x="468" y="130" text-anchor="end" class="chart-tick-label">L=${
        formattedValueWithUnit(cantileverM, 'm', 3)
      } · ขอบฐาน</text>
    </svg>
  </figure>`
}

const renderSettlementHold = (data, displayOptions = {}) => {
  const loads = firstValue(data, ['loads'], {})
  const factoredReaction = firstValue(
    loads,
    ['factored.columnReactionKN', 'factoredColumn', 'puColumn', 'PuColumn'],
    EMPTY
  )
  const netPressure = firstValue(
    loads,
    ['factored.netPressureKPa', 'quNet', 'netFactoredPressure'],
    EMPTY
  )
  const forceUnit = normalizeForceDisplayUnit(displayOptions.forceUnit)
  const reactionText = formattedForceFromKn(factoredReaction, forceUnit)
  const pressureText = formattedValueWithUnit(netPressure, 'kPa', 2)
  return `<article class="evidence-panel deflection-panel sf-symbolic-settlement sf-symbolic-behavior is-review"
    data-check-topic="settlement" data-evaluation="not-evaluated"
    data-visualization-scope="symbolic-only">
    <div class="panel-title deflection-panel-title"><div>
      <span>CONCEPTUAL LOAD PATH · ภาพอธิบายพฤติกรรม</span>
      <h3>แรงกดจากเสา → ฐานราก → แรงปฏิกิริยาดิน</h3></div>
      <span class="reference-badge">${NOT_EVALUATED} · ไม่ใช่ผลทรุดตัว</span></div>
    <div class="deflection-scope-note" id="sfSymbolicScopeNote" role="note"
      data-visualization-scope="symbolic-only">
      <span class="deflection-scope-mark" aria-hidden="true">NTS</span>
      <div><strong>ภาพนี้ใช้สื่อเส้นทางแรงเท่านั้น</strong>
        <span>รูปทรงถูกขยายเพื่อให้อ่านง่าย ไม่มีค่าการกระจัด ไม่มีแบบจำลองดิน และไม่ใช่ FEA contour</span></div>
    </div>
    <div class="deflection-fact-strip" aria-label="ค่าจากชุดผลคำนวณและขอบเขตการประเมิน">
      <div class="deflection-fact deflection-fact--load">
        <span>แรงกดออกแบบจากเสา</span>
        <strong>P<sub>u</sub> <b data-symbolic-pu-value
          data-force-kn="${escapeAttribute(String(numericValue(factoredReaction) ?? ''))}"
          data-force-display-unit="${forceUnit}">${reactionText}</b></strong>
        <small>ค่าจริงจากชุดผลคำนวณ</small>
      </div>
      <div class="deflection-fact deflection-fact--reaction">
        <span>แรงดันดินสุทธิออกแบบ</span>
        <strong>q<sub>net</sub> <b>${pressureText}</b></strong>
        <small>ใช้เป็นป้ายกำกับ ไม่กำหนดรูปทรงในภาพ</small>
      </div>
      <div class="deflection-fact deflection-fact--scope">
        <span>ขอบเขตการประเมิน</span>
        <strong>${NOT_EVALUATED}</strong>
        <small>Settlement / displacement / soil stiffness</small>
      </div>
    </div>
    <div class="symbolic-response-shell" data-visualization-scope="symbolic-only">
      <div class="symbolic-response-toolbar">
        <div>
          <span>3D SYMBOLIC RESPONSE · NTS</span>
          <strong>หมุนดูเส้นทางแรง · สีระหว่างเล่นเป็นจุดเน้นเชิงภาพ ไม่ใช่ผลวิกฤต</strong>
        </div>
        <button class="symbolic-response-replay" type="button"
          data-symbolic-3d-replay disabled aria-describedby="sfSymbolic3dStatus">
          <span aria-hidden="true">↻</span> เล่นภาพตอบสนองอีกครั้ง
        </button>
      </div>
      <div class="symbolic-response-stage" data-symbolic-3d-stage
        data-visualization-scope="symbolic-only" data-response-kind="conceptual-load-path"
        aria-busy="false">
        <div class="symbolic-response-badges" aria-hidden="true">
          <span>NTS</span><span>NO Δ RESULT</span><span>VISUAL COLOR ≠ CRITICAL</span>
        </div>
        <div class="symbolic-response-fallback" data-snapshot-3d-fallback>
          <p class="diagram-scroll-hint">ภาพสำรอง 2D · เลื่อนดูได้ · ไม่มีสเกลการกระจัด</p>
          <div class="deflection-diagram-scroll" tabindex="0" role="region"
            aria-label="ภาพอธิบายเส้นทางแรงของฐานรากเชิงสัญลักษณ์ เลื่อนแนวนอนได้">
      <svg class="deflection-diagram" data-engineering-evidence="symbolic-deflection"
        viewBox="0 0 920 430" role="img" data-force-display-unit="${forceUnit}"
        aria-labelledby="sfSymbolicDiagramTitle sfSymbolicDiagramDesc"
        aria-describedby="sfSymbolicScopeNote">
        <title id="sfSymbolicDiagramTitle">เส้นทางแรงของฐานรากแผ่เชิงสัญลักษณ์</title>
        <desc id="sfSymbolicDiagramDesc">แรงกดจากเสาถ่ายผ่านฐานรากไปยังแรงปฏิกิริยาดิน รูปทรงไม่ใช่ผลวิเคราะห์การทรุดตัวหรือค่าการกระจัด</desc>
        <defs>
          <marker id="sfSymbolicArrowDown" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10Z" fill="#c92a2a"/>
          </marker>
          <marker id="sfSymbolicArrowUp" viewBox="0 0 10 10" refX="9" refY="5"
            markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10Z" fill="#2563a8"/>
          </marker>
          <pattern id="sfSymbolicGrid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" class="deflection-grid-line"/>
          </pattern>
        </defs>
        <rect x="1" y="1" width="918" height="428" rx="8" class="deflection-canvas"/>
        <rect x="18" y="18" width="884" height="394" rx="6" fill="url(#sfSymbolicGrid)"/>
        <g class="deflection-kicker" transform="translate(34 30)">
          <rect width="162" height="28" rx="3"/>
          <text x="12" y="19">SYMBOLIC RESPONSE · NTS</text>
        </g>
        <text x="886" y="49" text-anchor="end" class="deflection-note">ไม่ใช่ displacement contour</text>
        <path class="deflection-reference" d="M170 154H750V246H170Z"/>
        <text x="48" y="145" class="deflection-reference-label">แนวอ้างอิงก่อนรับแรง</text>
        <path d="M48 154H160" class="deflection-reference-leader"/>
        <path class="deflection-column" d="M410 76H510V226H410Z"/>
        <path class="deflection-column-cap" d="M398 226H522V244H398Z"/>
        <path class="deflection-shape-fill"
          d="M170 154C282 194 360 221 460 226C560 221 638 194 750 154L750 246C638 292 560 326 460 331C360 326 282 292 170 246Z"/>
        <g class="deflection-ordinates">
          <path d="M170 154V246" class="deflection-band"/>
          <path d="M206 167V262" class="deflection-band"/>
          <path d="M242 180V278" class="deflection-band"/>
          <path d="M278 192V292" class="deflection-band"/>
          <path d="M314 204V305" class="deflection-band"/>
          <path d="M350 214V315" class="deflection-band"/>
          <path d="M386 221V323" class="deflection-band"/>
          <path d="M422 225V329" class="deflection-band"/>
          <path d="M460 226V331" class="deflection-band deflection-band--center"/>
          <path d="M498 225V329" class="deflection-band"/>
          <path d="M534 221V323" class="deflection-band"/>
          <path d="M570 214V315" class="deflection-band"/>
          <path d="M606 204V305" class="deflection-band"/>
          <path d="M642 192V292" class="deflection-band"/>
          <path d="M678 180V278" class="deflection-band"/>
          <path d="M714 167V262" class="deflection-band"/>
          <path d="M750 154V246" class="deflection-band"/>
        </g>
        <path class="deflection-envelope"
          d="M170 154C282 194 360 221 460 226C560 221 638 194 750 154"/>
        <path class="deflection-envelope"
          d="M170 246C282 292 360 326 460 331C560 326 638 292 750 246"/>
        <path class="deflection-envelope" d="M170 154V246M750 154V246"/>
        <path d="M460 18V68" class="deflection-load" marker-end="url(#sfSymbolicArrowDown)"/>
        <text x="484" y="48" class="deflection-load-label">แรงกด P<tspan baseline-shift="sub"
          font-size="10">u</tspan></text>
        <g class="deflection-flow-label deflection-flow-label--load" transform="translate(532 86)">
          <rect width="170" height="45" rx="4"/>
          <text x="12" y="18">INPUT LOAD</text>
          <text x="12" y="35">ถ่ายแรงผ่านหน้าเสา</text>
        </g>
        <g class="deflection-reactions" marker-end="url(#sfSymbolicArrowUp)">
          <path d="M240 402V342"/><path d="M328 402V342"/><path d="M416 402V342"/>
          <path d="M504 402V342"/><path d="M592 402V342"/><path d="M680 402V342"/>
        </g>
        <text x="460" y="419" text-anchor="middle" class="deflection-soil-label">แรงปฏิกิริยาดิน · กระจายขึ้นสู่ฐานราก</text>
        <g class="deflection-flow-label deflection-flow-label--footing" transform="translate(700 286)">
          <rect width="184" height="51" rx="4"/>
          <text x="12" y="19">SYMBOLIC SHAPE</text>
          <text x="12" y="37">ไม่แสดง Δ หรือ settlement</text>
        </g>
      </svg>
          </div>
        </div>
        <div class="symbolic-response-help" aria-hidden="true">
          ลากเพื่อหมุน · ล้อเมาส์เพื่อซูม · ปุ่มลูกศร · 0 จัดภาพ
        </div>
      </div>
      <p class="symbolic-response-status" id="sfSymbolic3dStatus"
        data-symbolic-3d-status role="status" aria-live="polite">
        สี Blue → Cyan → Amber → Red ใช้เน้นการถ่ายแรงระหว่างเล่นเท่านั้น · ไม่ใช่ผล critical, deformation หรือ settlement
      </p>
    </div>
    <div class="deflection-boundary">
      <b>ขอบเขตผล: ${NOT_EVALUATED}</b>
      <span>ภาพนี้ไม่สร้างค่าการกระจัด ไม่ประเมินการทรุด และไม่ใช้ตัดสิน PASS/FAIL หรือออกแบบงานก่อสร้าง</span>
    </div>
  </article>`
}

const barCutDirection = (barCut, direction) =>
  firstValue(barCut, [direction, direction.toLowerCase(), `direction${direction}`], {})

const barCutPolylineBounds = (cut) => {
  const polyline = toList(firstValue(cut, ['polylineMm'], []))
  const xValues = polyline
    .map((point) => numericValue(point?.xMm))
    .filter((value) => value !== null)
  const zValues = polyline
    .map((point) => numericValue(point?.zMm))
    .filter((value) => value !== null)
  if (xValues.length < 2 || zValues.length < 2) return null
  const minX = Math.min(...xValues)
  const maxX = Math.max(...xValues)
  const minZ = Math.min(...zValues)
  const maxZ = Math.max(...zValues)
  if (!(maxX > minX) || !(maxZ > minZ)) return null
  return { polyline, minX, maxX, minZ, maxZ, width: maxX - minX, height: maxZ - minZ }
}

const sharedBarCutFrame = (barCut) => {
  const bounds = ['A', 'B']
    .map((direction) => barCutPolylineBounds(barCutDirection(barCut, direction)))
    .filter(Boolean)
  return {
    width: Math.max(1, ...bounds.map((item) => item.width)),
    height: Math.max(1, ...bounds.map((item) => item.height)),
  }
}

const renderBarCutSvg = (barCut, reinforcement, direction, detailId, commonFrame = null) => {
  const cut = barCutDirection(barCut, direction)
  const bar = reinforcementDirection(reinforcement, direction)
  const mark = firstValue(cut, ['mark', 'barMark'], reinforcementMark(bar, `BAR-${direction}`))
  const count = firstValue(cut, ['count'], firstValue(bar, ['count', 'barCount', 'quantity'], EMPTY))
  const size =
    firstValue(cut, ['diameterMm'], null) == null
      ? reinforcementDesignation(bar)
      : `DB${rawMetricText(firstValue(cut, ['diameterMm']))}`
  const cutLength = firstValue(
    cut,
    ['centerlineLengthMm', 'cutLength', 'centerlineLength', 'length', 'Lcl'],
    EMPTY
  )
  const horizontalTangent = firstValue(
    cut,
    ['horizontalTangentMm', 'width', 'outToOutWidth', 'W'],
    EMPTY
  )
  const tail = firstValue(cut, ['verticalTangentMm', 'verticalTail', 'tail', 'Bcl'], EMPTY)
  const radius = firstValue(
    cut,
    ['centerlineRadiusMm', 'centerlineRadius', 'bendRadius', 'Rcl'],
    EMPTY
  )
  const diameterMm = reinforcementDiameterMm(bar, numericValue(firstValue(cut, ['diameterMm'], 16)) ?? 16)
  const innerRadius = firstValue(
    cut,
    ['innerRadiusMm', 'innerRadius', 'Ri'],
    Math.max(0, (numericValue(radius) ?? 0) - diameterMm / 2)
  )
  const outsideWidthMm =
    numericValue(horizontalTangent) !== null && numericValue(radius) !== null
      ? numericValue(horizontalTangent) + 2 * numericValue(radius) + diameterMm
      : EMPTY
  const outsideHeightMm =
    numericValue(tail) !== null && numericValue(radius) !== null
      ? numericValue(tail) + numericValue(radius) + diameterMm / 2
      : EMPTY
  const totalLengthM = firstValue(
    cut,
    ['totalCenterlineLengthM', 'totalLengthM'],
    numericValue(cutLength) !== null && numericValue(count) !== null
      ? (numericValue(cutLength) * numericValue(count)) / 1000
      : EMPTY
  )
  const bounds = barCutPolylineBounds(cut)
  const sharedWidth = commonFrame?.width || bounds?.width || 1
  const sharedHeight = commonFrame?.height || bounds?.height || 1
  const horizontalScale = 274 / sharedWidth
  const verticalScale = 152 / sharedHeight
  const drawingWidth = bounds ? bounds.width * horizontalScale : 274
  const drawingOffsetX = 215 - drawingWidth / 2
  const modelPoints =
    bounds
      ? safeSvgPoints(
          bounds.polyline.map((point) => [
            drawingOffsetX + (numericValue(point?.xMm) - bounds.minX) * horizontalScale,
            230 - (numericValue(point?.zMm) - bounds.minZ) * verticalScale,
          ])
        )
      : ''
  const color = direction === 'A' ? '#c2410c' : '#0f766e'
  const layer = reinforcementLayerLabel(bar) || (direction === 'A' ? 'ชั้นล่าง' : 'ชั้นบน')
  const axis = rawMetricText(firstValue(bar, ['direction', 'axis', 'orientation'], direction))
  return `<figure class="sf-barcut-form" data-barcut-detail="${escapeAttribute(detailId)}"
    data-select-mark="${escapeAttribute(mark)}" data-scale="NTS"
    data-bar-count="${escapeAttribute(count)}" data-bar-size="${escapeAttribute(size)}">
    <figcaption><b>${metricText(mark)} · ${metricText(detailId)}</b>
      <span>NTS · ${NOT_RELEASED_BBS}</span></figcaption>
    <svg viewBox="0 0 430 340" role="img" data-scale="NTS"
      data-responsive-svg="viewbox"
      aria-label="แบบตัดเหล็ก ${escapeAttribute(mark)} จาก Calculation Snapshot">
      <rect x="8" y="8" width="414" height="324" rx="5" fill="#f8fafc" stroke="#94a3b8"/>
      <text x="18" y="24" fill="${color}" font-weight="700" data-annotation-zone="bar-spec">${metricText(
        mark
      )} · ${metricText(count)}-${metricText(size)} · ${metricText(axis)} ${metricText(layer)}</text>
      <text x="18" y="48" data-annotation-zone="vertical-tangent"${exactValueAttribute(
        tail
      )}>ขาตรง Bcl = ${formattedValueWithUnit(tail, 'mm', 1)} C/L</text>
      <text x="412" y="48" text-anchor="end" data-annotation-zone="radius"${exactValueAttribute(
        radius
      )}>รัศมี Rc = ${formattedValueWithUnit(radius, 'mm', 1)} C/L</text>
      ${
        modelPoints
          ? `<polyline points="${escapeAttribute(modelPoints)}" fill="none"
            stroke="${color}" stroke-width="10"
            stroke-linecap="butt" stroke-linejoin="round" data-cut-end="butt"
            data-geometry-source="barCut.polylineMm"/>`
          : `<path d="M78 72V206Q78 232 104 232H326Q352 232 352 206V72"
            fill="none" stroke="${color}"
            stroke-width="10" stroke-linecap="butt" stroke-linejoin="round"
            data-cut-end="butt"/>`
      }
      <path d="M62 248H368M62 240V256M368 240V256" stroke="#334155"/>
      <text x="215" y="266" text-anchor="middle"${exactValueAttribute(
        outsideWidthMm
      )}>W = ${formattedValueWithUnit(outsideWidthMm, 'mm', 1)} O/O</text>
      <path d="M50 78V230M42 78H58M42 230H58" stroke="#334155"/>
      <text x="34" y="204" transform="rotate(-90 34 204)"${exactValueAttribute(
        outsideHeightMm
      )}>H = ${formattedValueWithUnit(outsideHeightMm, 'mm', 1)} O/O</text>
      <path d="M116 178 154 157" stroke="#334155"/>
      <text x="158" y="154">Ri ${formattedValueWithUnit(innerRadius, 'mm', 1)} ·
        Di ${formattedValueWithUnit((numericValue(innerRadius) ?? 0) * 2, 'mm', 1)} ·
        Rc ${formattedValueWithUnit(radius, 'mm', 1)}</text>
      <text x="215" y="283" text-anchor="middle" data-annotation-zone="horizontal-tangent"${
        exactValueAttribute(horizontalTangent)
      }>ช่วงตรง Scl = ${formattedValueWithUnit(horizontalTangent, 'mm', 1)} C/L</text>
      <text x="215" y="309" text-anchor="middle" data-annotation-zone="centerline-length"${
        exactValueAttribute(cutLength)
      }>Lcl = ${formattedValueWithUnit(cutLength, 'mm', 1)} / เส้น · รวม
        ${formattedValueWithUnit(totalLengthM, 'm', 3)}</text>
      <text x="215" y="332" text-anchor="middle" data-annotation-zone="scale">
        NTS · มิติตาม Snapshot · ไม่ใช่รหัสรูปดัดสำหรับผลิต</text>
    </svg>
    <p><strong>${NOT_RELEASED_BBS}</strong> ความยาวตามแนวแกนเชิงทฤษฎี · ยังไม่รับรอง ldh,
      การสลับเหล็กที่มุม หรือรหัสผลิต</p>
  </figure>`
}

const renderReferenceLedger = (references, title = 'บัญชีแหล่งอ้างอิง') => `<section class="sf-source-ledger"
  aria-label="${escapeAttribute(title)}">
  <h4>${escapeHtml(title)}</h4>
  ${
    references.length
      ? `<ol>${references
          .map((reference) => {
            const source = sourceRecord(reference)
            const url = safeOfficialUrl(source.url)
            return `<li data-source-id="${escapeAttribute(source.sourceId)}">
              <b>${metricText(source.standard)} · ${metricText(source.edition)}</b>
              <span>${metricText(source.clause)} · ${metricText(source.equation)}</span>
              <span>Units: ${metricText(source.canonicalUnits)}</span>
              <span>Assumptions: ${toList(source.assumptions)
                .map((assumption) => metricText(assumption))
                .join(' · ')}</span>
              <span>${metricText(source.title)} · ${metricText(source.verificationStatus)}</span>
              ${
                url
                  ? `<a href="${escapeAttribute(url)}" rel="noreferrer noopener">แหล่งอ้างอิงทางการ</a>`
                  : '<em>ไม่มี URL ทางการที่ใช้ได้</em>'
              }
            </li>`
          })
          .join('')}</ol>`
      : `<p class="is-review"><strong>${NOT_EVALUATED}</strong> ไม่มีบัญชีแหล่งอ้างอิงใน Snapshot</p>`
  }
</section>`

const renderReportReferenceSummary = (references) => {
  const sourceCount = references.length
  const visibleSources = references.slice(0, 4)
  return `<section class="a4-reference-summary" data-reference-count="${sourceCount}"
    data-visible-reference-count="${visibleSources.length}"
    data-reference-presentation="source-id-only"
    aria-label="สรุปเอกสารอ้างอิงสำคัญในรายงาน A4">
    <ol>${visibleSources
      .map((reference, index) => {
        const source = sourceRecord(reference)
        return `<li data-source-id="${escapeAttribute(source.sourceId)}"
          data-standard="${escapeAttribute(source.standard)}"
          data-edition="${escapeAttribute(source.edition)}"
          data-verification-status="${escapeAttribute(source.verificationStatus)}">
          <b><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
            ${metricText(source.sourceId)}</b>
          <span>ดูรายละเอียดเอกสารใน Flow 07</span>
        </li>`
      })
      .join('')}</ol>
    ${
      sourceCount > visibleSources.length
        ? `<p>เอกสารอ้างอิงอีก ${sourceCount - visibleSources.length} รายการอยู่ใน Calculation Book</p>`
        : '<p>สมการ หน่วย สมมติฐาน และ URL ทางการฉบับเต็มอยู่ใน Calculation Book</p>'
    }
  </section>`
}

const renderLimitations = (limitations) => {
  const items = toList(limitations)
  return `<ul class="sf-limitations">${
    items.length
      ? items
          .map((item) => {
            const label =
              item && typeof item === 'object'
                ? checkLabel(item)
                : item
            const status =
              item && typeof item === 'object'
                ? displayStatus(item)
                : NOT_EVALUATED
            return `<li class="${statusClass(status)}"><span>${metricText(label)}</span><strong>${metricText(
              status
            )}</strong></li>`
          })
          .join('')
      : `<li class="is-review"><span>รายการที่อยู่นอกขอบเขต R1</span><strong>${NOT_EVALUATED}</strong></li>`
  }</ul>`
}

const renderSummaryFromEnvelope = (envelope) => {
  const data = envelope.data
  const geometry = firstValue(data, ['geometry'], {})
  const reinforcement = firstValue(data, ['reinforcement'], {})
  const bearing = firstValue(data, ['bearing'], {})
  const loads = firstValue(data, ['loads'], {})
  const governing = firstValue(data, ['governingCheck'], {})
  const governingStatus = displayStatus(governing)
  const evaluatedVerdict =
    governingStatus === 'FAIL'
      ? { status: 'FAIL', label: 'ผลที่ประเมิน · FAIL' }
      : governingStatus === 'PASS'
        ? { status: 'PASS', label: 'ผลที่ประเมิน · OK' }
        : evaluatedSurfaceVerdict(data)
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const columnB = geometryDimension(geometry, 'column', 'width')
  const columnL = geometryDimension(geometry, 'column', 'length')
  const qMax = firstValue(bearing, ['qMaxKPa', 'qMax', 'qmax', 'service.qMax'], EMPTY)
  const qMin = firstValue(bearing, ['qMinKPa', 'qMin', 'qmin', 'service.qMin'], EMPTY)
  const sbc = firstValue(
    bearing,
    ['sbcGrossKPa', 'sbc', 'allowable', 'allowableBearing'],
    EMPTY
  )
  const sbcSource = firstValue(bearing, ['sbcSource', 'capacitySource'], EMPTY)
  const factoredReaction = firstValue(
    loads,
    ['factored.columnReactionKN', 'factoredColumn', 'puColumn', 'PuColumn', 'strength.column'],
    EMPTY
  )
  const netPressure = firstValue(
    loads,
    ['factored.netPressureKPa', 'quNet', 'netFactoredPressure', 'strength.quNet'],
    EMPTY
  )
  const governingRatio = checkRatio(governing)
  return `<section class="sf-snapshot-surface sf-snapshot-surface--summary" lang="th"
    ${surfaceAttributes(envelope, 'summary')} aria-label="สรุปผลฐานรากแผ่จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>ชุดผลคำนวณ · ฐานรากแผ่ (Snapshot)</span><h3>สรุปผลและหลักฐานควบคุม</h3></div>
      <strong class="sf-status-token ${statusClass(evaluatedVerdict.status)}">${metricText(
        evaluatedVerdict.label
      )}</strong>
    </header>
    <div class="metric-strip sf-metric-strip">
      ${metricCard({
        label: 'รูปทรงฐานราก · B × L × h',
        value: `${rawFormattedValueWithUnit(footingB, 'm', 2)} × ${rawFormattedValueWithUnit(
          footingL,
          'm',
          2
        )} × ${rawFormattedValueWithUnit(footingH, 'm', 2)}`,
        detail: `เสา ${rawFormattedValueWithUnit(columnB, 'm', 2)} × ${rawFormattedValueWithUnit(
          columnL,
          'm',
          2
        )}`,
        exact: {
          'footing-b-m': footingB,
          'footing-l-m': footingL,
          'footing-h-m': footingH,
          'column-b-m': columnB,
          'column-l-m': columnL,
        },
      })}
      ${metricCard({
        label: 'แรงดันดินใช้งาน · qmax / SBC',
        value: `${rawFormattedValueWithUnit(qMax, 'kPa', 2)} / ${rawFormattedValueWithUnit(
          sbc,
          'kPa',
          2
        )}`,
        detail: `qmin ${rawFormattedValueWithUnit(qMin, 'kPa', 2)} · ที่มา SBC: ${rawMetricText(
          sbcSource
        )}`,
        status: displayStatus(firstValue(bearing, ['check', 'bearingCheck'], bearing)),
        exact: { 'qmax-kpa': qMax, 'qmin-kpa': qMin, 'sbc-kpa': sbc },
      })}
      ${metricCard({
        label: 'แรงประลัยและแรงดันสุทธิ',
        value: rawFormattedValueWithUnit(factoredReaction, 'kN', 2),
        detail: `qu,net ${rawFormattedValueWithUnit(netPressure, 'kPa', 2)}`,
        exact: { 'pu-kn': factoredReaction, 'qu-net-kpa': netPressure },
      })}
      ${metricCard({
        label: 'รายการควบคุม',
        value:
          governing && typeof governing === 'object' && Object.keys(governing).length
            ? checkLabel(governing)
            : 'รอรายการควบคุม',
        detail: `${
          rawMetricText(governingRatio) === EMPTY
            ? 'ไม่มี D/C เชิงตัวเลข'
            : rawFormattedMetric(governingRatio, 3)
        } · ${displayStatus(governing)}`,
        status: displayStatus(governing),
        exact: { 'governing-dc': governingRatio },
      })}
    </div>
    <div class="summary-grid sf-summary-grid">
      <article class="evidence-panel evidence-panel--wide">
        <div class="panel-title"><div><span>สนามแรงดันดิน</span>
          <h3>แรงดันดินแบบไอโซเมตริก (Bearing pressure)</h3></div>
          <span class="reference-badge">อ่านค่าจากชุดผลคำนวณเท่านั้น</span></div>
        ${renderBearingIsometric(bearing, geometry, 'summary', reinforcement)}
      </article>
      <article class="evidence-panel">
        <div class="panel-title"><div><span>รูปตัดย่อ</span><h3>เหล็กเสริมที่ตรวจจริง</h3></div></div>
        ${renderSectionSvg(geometry, reinforcement, 'รูปตัดย่อพร้อมเหล็กเสริมจาก Snapshot')}
        <dl class="sf-compact-inspector">
          <div><dt>ทิศ A</dt><dd>${metricText(reinforcementSummary(barA, 'BAR-A'))}</dd></div>
          <div><dt>ทิศ B</dt><dd>${metricText(reinforcementSummary(barB, 'BAR-B'))}</dd></div>
        </dl>
      </article>
    </div>
  </section>`
}

const renderChecksFromEnvelope = (envelope, summaryEnvelope = null) => {
  const checks = selectDecisionChecks(envelope.data).filter(isExplicitlyEvaluated)
  const evaluatedVerdict = evaluatedSurfaceVerdict(envelope.data)
  const sbcSource = firstValue(
    summaryEnvelope?.data,
    ['bearing.sbcSource', 'bearing.capacitySource'],
    EMPTY
  )
  return `<section class="sf-snapshot-surface sf-snapshot-surface--dc" lang="th"
    ${surfaceAttributes(envelope, 'dc')} aria-label="ตาราง D/C จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>ค่าความต้องการ / ความสามารถ (D/C)</span>
        <h3>รายการตรวจที่เครื่องคำนวณประเมินแล้ว</h3></div>
      <strong class="sf-status-token ${statusClass(evaluatedVerdict.status)}">${metricText(
        evaluatedVerdict.label
      )}</strong>
    </header>
    <p class="sf-dc-source"><b>ที่มา SBC</b><span>${metricText(sbcSource)}</span></p>
    ${renderChecksTable(checks, 'รายการตรวจฐานรากแผ่ ค่าความต้องการต่อความสามารถ')}
  </section>`
}

const renderAnalysisFromEnvelope = (envelope, displayOptions = {}) => {
  const data = envelope.data
  const diagrams = firstValue(data, ['diagrams'], {})
  const oneWayShear = firstValue(data, ['oneWayShear'], {})
  const entries = diagramDirections(diagrams)
  return `<section class="sf-snapshot-surface sf-snapshot-surface--analysis" lang="th"
    ${surfaceAttributes(envelope, 'analysis')} aria-label="แผนภาพโมเมนต์และแรงเฉือนจากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>หลักฐานการวิเคราะห์</span><h3>โมเมนต์ดัดและแรงเฉือนทางเดียว</h3></div>
      <span class="reference-badge">เส้นและค่าสูงสุดจากชุดข้อมูลแผนภาพ (Diagram selector)</span>
    </header>
    <div class="sf-analysis-grid">
      ${
        entries.length
          ? entries
              .flatMap((entry) => {
                const shearEvidence = firstValue(
                  oneWayShear,
                  [entry.direction, String(entry.direction).toLowerCase()],
                  {}
                )
                return [
                  renderSingleDiagram(entry, 'moment'),
                  renderSingleDiagram(entry, 'shear', {
                    criticalValue: firstValue(
                      shearEvidence,
                      ['vuKNPerM', 'demand', 'criticalValue'],
                      EMPTY
                    ),
                  }),
                ]
              })
              .join('')
          : `<p class="is-review"><strong>${NOT_EVALUATED}</strong> ไม่มีแบบจำลองแผนภาพในชุดผลคำนวณ</p>`
      }
    </div>
    ${renderSettlementHold(data, displayOptions)}
  </section>`
}

const renderSectionFromEnvelope = (envelope) => {
  const data = envelope.data
  const geometry = firstValue(data, ['geometry'], {})
  const reinforcement = firstValue(data, ['reinforcement'], {})
  const barCut = firstValue(data, ['barCut'], {})
  const cutFrame = sharedBarCutFrame(barCut)
  const footing = footingGeometry(geometry)
  const coverM = firstValue(
    footing,
    ['coverM', 'cover'],
    firstValue(geometry, ['coverMm', 'cover'], EMPTY)
  )
  const coverMm =
    numericValue(coverM) !== null
      ? numericValue(coverM) <= 2
        ? numericValue(coverM) * 1000
        : numericValue(coverM)
      : EMPTY
  return `<section class="sf-snapshot-surface sf-snapshot-surface--section" lang="th"
    ${surfaceAttributes(envelope, 'section')} aria-label="แปลน รูปตัด และแบบตัดเหล็กจากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>แปลน / รูปตัด / แบบตัดเหล็ก (Bar Cut)</span>
        <h3>รูปทรงและเหล็กเสริมจากชุดผลคำนวณเดียวกัน</h3></div>
      <strong class="sf-status-token">SNAPSHOT CURRENT</strong>
    </header>
    <div class="section-diagrams sf-section-diagrams">
      <figure class="section-diagram"><figcaption>แปลนฐานรากและแนวเหล็ก</figcaption>
        ${renderPlanSvg(geometry, reinforcement)}</figure>
      <figure class="section-diagram"><figcaption>รูปตัด X-X · ทิศ A และชั้นเหล็ก A / B</figcaption>
        ${renderSectionSvg(geometry, reinforcement)}</figure>
    </div>
    <article class="section-diagram hook-detail-card barcut-detail-card">
      <header><span>รายละเอียด H-01 / H-02 · แบบตัดเหล็ก</span>
        <b>W,H = O/O · Scl,Bcl,Ri,Di,Rc,Lcl = C/L · มิติ mm · NTS</b></header>
      <h4>รูปทรงเหล็กจาก Calculation Snapshot เดียวกับรูปตัด 3D และชุดแบบ</h4>
      <div class="barcut-forms sf-barcut-forms">
        ${renderBarCutSvg(barCut, reinforcement, 'A', 'H-01', cutFrame)}
        ${renderBarCutSvg(barCut, reinforcement, 'B', 'H-02', cutFrame)}
      </div>
      <p class="barcut-cover-note">ระยะหุ้มที่ใช้สร้างรูปทรง =
        ${formattedValueWithUnit(coverMm, 'mm', 0)} ถึงผิวเหล็ก ·
        มิติและความยาวทั้งหมดอ่านจาก Calculation Snapshot ปัจจุบัน</p>
      <p class="barcut-warning">${NOT_RELEASED_BBS} · รูปทรงและความยาวตามแนวแกนเชิงทฤษฎีเท่านั้น ·
        ldh, รหัสรูปดัด, แกนดัด, springback, tolerance และการสลับเหล็กที่มุม
        ไม่รวมในผลคำนวณรุ่นนี้</p>
    </article>
  </section>`
}

const inspectorRow = ({ layer, title, value, trace, mark = '', exact = {} }) => `<li
  data-model-layer="${escapeAttribute(layer)}" ${
    mark ? `data-select-mark="${escapeAttribute(mark)}"` : ''
  }${exactNamedAttributes(exact)}>
  <b>${escapeHtml(title)}</b><span>${metricText(value)}</span><em>${metricText(trace)}</em>
</li>`

const renderThreeFromEnvelope = (envelope) => {
  const data = envelope.data
  const geometry = firstValue(data, ['geometry'], {})
  const bearing = firstValue(data, ['bearing'], {})
  const reinforcement = firstValue(data, ['reinforcement'], {})
  const punching = firstValue(data, ['punching'], {})
  const barCut = firstValue(data, ['barCut'], {})
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const cutA = barCutDirection(barCut, 'A')
  const cutB = barCutDirection(barCut, 'B')
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const qMax = firstValue(bearing, ['qMaxKPa', 'qMax', 'qmax', 'service.qMax'], EMPTY)
  const qMin = firstValue(bearing, ['qMinKPa', 'qMin', 'qmin', 'service.qMin'], EMPTY)
  const lclA = firstValue(
    cutA,
    ['centerlineLengthMm', 'cutLength', 'centerlineLength', 'Lcl'],
    EMPTY
  )
  const lclB = firstValue(
    cutB,
    ['centerlineLengthMm', 'cutLength', 'centerlineLength', 'Lcl'],
    EMPTY
  )
  const punchingPerimeter = firstValue(
    punching,
    ['perimeterM', 'criticalPerimeter', 'bo', 'perimeter'],
    EMPTY
  )
  const directionA = directionPresentation('A')
  const directionB = directionPresentation('B')
  return `<section class="sf-snapshot-surface sf-snapshot-surface--three" lang="th"
    ${surfaceAttributes(envelope, 'three')} aria-label="แบบจำลองสามมิติฐานรากแผ่จากชุดผลคำนวณ">
    <header class="sf-surface-heading">
      <div><span>มุมมองวิศวกรรมแบบโต้ตอบ</span>
        <h3>แบบจำลอง 3D และรายการหลักฐาน</h3></div>
      <strong class="sf-status-token">SNAPSHOT MODEL</strong>
    </header>
    <div class="three-layout sf-three-layout">
      <div class="model-stage sf-model-stage" data-model-scene>
        <canvas data-snapshot-3d data-snapshot-id="${escapeAttribute(envelope.snapshotId)}"
          data-payload-hash="${escapeAttribute(envelope.payloadHash)}" tabindex="0" role="region"
          aria-label="พื้นที่สามมิติฐานราก เหล็กเสริม และสนามแรงดันดินจากชุดผลคำนวณ"></canvas>
        <div class="sf-model-fallback" data-snapshot-3d-fallback>
          ${renderBearingIsometric(bearing, geometry, 'three', reinforcement, punching)}
          <p>ภาพ SVG สำรองใช้ค่ารูปทรงและแรงดันจากชุดข้อมูล 3D</p>
        </div>
      </div>
      <aside class="model-inspector sf-model-inspector" aria-label="รายการหลักฐานสามมิติ">
        <h4>รายการหลักฐานแบบจำลอง</h4>
        <ol>
          ${inspectorRow({
            layer: 'concrete',
            title: 'ฐานรากและเสา',
            value: `${rawFormattedValueWithUnit(footingB, 'm', 2)} × ${rawFormattedValueWithUnit(
              footingL,
              'm',
              2
            )} × ${rawFormattedValueWithUnit(footingH, 'm', 2)}`,
            trace: 'ชุดข้อมูล 3D · รูปทรง',
            exact: {
              'footing-b-m': footingB,
              'footing-l-m': footingL,
              'footing-h-m': footingH,
            },
          })}
          ${inspectorRow({
            layer: 'bearing',
            title: 'สนามแรงดันดิน',
            value: `qmax ${rawFormattedValueWithUnit(
              qMax,
              'kPa',
              2
            )} · qmin ${rawFormattedValueWithUnit(qMin, 'kPa', 2)}`,
            trace: 'ชุดข้อมูล 3D · แรงดันดิน',
            exact: { 'qmax-kpa': qMax, 'qmin-kpa': qMin },
          })}
          ${inspectorRow({
            layer: 'barA',
            title: `เหล็ก ${directionA.direction}/${directionA.axis} ${directionA.axisSymbol} · ${directionA.layer}`,
            value: reinforcementSummary(barA, 'BAR-A'),
            trace: `Lcl ${rawFormattedValueWithUnit(lclA, 'mm', 1)}`,
            mark: reinforcementMark(barA, 'BAR-A'),
            exact: { 'lcl-mm': lclA },
          })}
          ${inspectorRow({
            layer: 'barB',
            title: `เหล็ก ${directionB.direction}/${directionB.axis} ${directionB.axisSymbol} · ${directionB.layer}`,
            value: reinforcementSummary(barB, 'BAR-B'),
            trace: `Lcl ${rawFormattedValueWithUnit(lclB, 'mm', 1)}`,
            mark: reinforcementMark(barB, 'BAR-B'),
            exact: { 'lcl-mm': lclB },
          })}
          ${inspectorRow({
            layer: 'critical',
            title: 'แนววิกฤตเฉือนทะลุ',
            value: rawFormattedValueWithUnit(punchingPerimeter, 'm', 3),
            trace: 'แนวตรวจรอบเสากลางจาก Snapshot',
            exact: { 'perimeter-m': punchingPerimeter },
          })}
        </ol>
      </aside>
    </div>
  </section>`
}

const projectField = (project, ...paths) => firstValue(project, paths, EMPTY)

const renderReportCheckRows = (checks) =>
  checks
    .map((check) => {
      const status = displayStatus(check)
      const evaluated = isExplicitlyEvaluated(check)
      const demandValue = checkDemand(check)
      const capacityValue = checkCapacity(check)
      const ratioValue = checkRatio(check)
      const demand = rawMetricText(demandValue)
      const capacity = rawMetricText(capacityValue)
      const ratio = rawMetricText(ratioValue)
      const id = checkId(check)
      const compactNotEvaluated = `<span aria-hidden="true">—</span><span class="sr-only">${NOT_EVALUATED}</span>`
      return `<tr class="${statusClass(status)}" data-check-id="${escapeAttribute(
        id
      )}" data-evaluation="${evaluated ? 'evaluated' : 'not-evaluated'}">
        <td><span title="${escapeAttribute(id)}">${metricText(
          REPORT_CHECK_CODES[id] || id
        )}</span></td><td>${metricText(checkLabel(check))}</td>
        <td${evaluated ? exactValueAttribute(demandValue) : ''}>${
          evaluated
            ? demand === EMPTY
              ? 'ไม่ใช้ค่าความต้องการเชิงตัวเลข'
              : formattedEngineeringMetric(demandValue)
            : compactNotEvaluated
        }</td>
        <td${evaluated ? exactValueAttribute(capacityValue) : ''}>${
          evaluated
            ? capacity === EMPTY
              ? 'ไม่ใช้ค่าความสามารถเชิงตัวเลข'
              : formattedEngineeringMetric(capacityValue)
            : compactNotEvaluated
        }</td>
        <td${evaluated ? exactValueAttribute(ratioValue) : ''}>${
          evaluated
            ? ratio === EMPTY
              ? 'ไม่ใช้ D/C เชิงตัวเลข'
              : formattedMetric(ratioValue, 3)
            : compactNotEvaluated
        }</td>
        <td><strong>${metricText(professionalResultLabel(check))}</strong></td>
      </tr>`
    })
    .join('')

const engineeringMathPlainText = (value) =>
  rawMetricText(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const engineeringFraction = (numerator, denominator) =>
  `<span class="a4-fraction" aria-label="${escapeAttribute(
    `${engineeringMathPlainText(numerator)} หารด้วย ${engineeringMathPlainText(denominator)}`
  )}">
    <span class="a4-fraction__numerator">${numerator}</span>
    <span class="a4-fraction__denominator">${denominator}</span>
  </span>`

const engineeringEquationLine = (content, className = '') =>
  `<span class="a4-equation-line${className ? ` ${className}` : ''}">${content}</span>`

const engineeringEquationSystem = (...lines) =>
  `<span class="a4-equation-system">${lines.filter(Boolean).join('')}</span>`

const engineeringEquationText = (value, fallback = EMPTY) =>
  metricText(value, fallback).replace(/\bLr\b/g, 'L<sub>r</sub>')

const engineeringSquareRoot = (content) =>
  `<span class="a4-square-root"><span aria-hidden="true">√</span><span>${content}</span></span>`

const renderPrincipalEquationDisplay = (
  id,
  formula,
  loads = {},
  applicabilityConfirmation = {}
) => {
  if (id === 'SF-EQ-SERVICE-GROSS-WEIGHTS') {
    return engineeringEquationSystem(
      engineeringEquationLine('W<sub>f</sub> = γ<sub>c</sub>(B · L · h)'),
      engineeringEquationLine(
        'W<sub>s</sub> = γ<sub>s</sub>[(B · L − b<sub>c</sub> · l<sub>c</sub>) · z]'
      ),
      engineeringEquationLine(
        'P<sub>service,gross</sub> = P<sub>D</sub> + P<sub>L</sub> + W<sub>f</sub> + W<sub>s</sub>',
        'a4-equation-line--result'
      )
    )
  }
  if (id === 'SF-EQ-SERVICE-BIAXIAL-PRESSURE') {
    return engineeringEquationSystem(
      engineeringEquationLine(
        `q(x,y) = ${engineeringFraction('P', 'A')} +
          ${engineeringFraction('M<sub>x</sub> · y', 'I<sub>x</sub>')} +
          ${engineeringFraction('M<sub>y</sub> · x', 'I<sub>y</sub>')}`
      ),
      engineeringEquationLine(
        `S<sub>x</sub> = ${engineeringFraction('B · L<sup>2</sup>', '6')}
          <span class="a4-equation-separator">;</span>
          S<sub>y</sub> = ${engineeringFraction('L · B<sup>2</sup>', '6')}`,
        'a4-equation-line--secondary'
      )
    )
  }
  if (id === 'SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM') {
    return engineeringEquationSystem(
      engineeringEquationLine(
        `q<sub>u,gross</sub> =
          ${engineeringFraction(
            'P<sub>u,column</sub> + γ<sub>D</sub>(W<sub>f</sub> + W<sub>s</sub>)',
            'B · L'
          )}`
      ),
      engineeringEquationLine(
        `q<sub>u,net</sub> = q<sub>u,gross</sub> −
          ${engineeringFraction('γ<sub>D</sub>(W<sub>f</sub> + W<sub>s</sub>)', 'B · L')}`,
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        `q<sub>u,net</sub> = ${engineeringFraction('P<sub>u,column</sub>', 'B · L')}`,
        'a4-equation-line--result'
      )
    )
  }
  if (id === 'SF-EQ-FLEXURE-A' || id === 'SF-EQ-FLEXURE-B') {
    return engineeringEquationSystem(
      engineeringEquationLine(
        `M<sub>u</sub> = ${engineeringFraction('q<sub>u,net</sub> · l<sup>2</sup>', '2')}`
      ),
      engineeringEquationLine(
        `a = ${engineeringFraction(
          'A<sub>s</sub> · f<sub>y</sub>',
          '0.85 · f′<sub>c</sub> · b'
        )}`,
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        `φM<sub>n</sub> = φ · A<sub>s</sub> · f<sub>y</sub>
          (d − ${engineeringFraction('a', '2')})`,
        'a4-equation-line--result'
      )
    )
  }
  if (id === 'SF-EQ-ONE-WAY-SHEAR-A' || id === 'SF-EQ-ONE-WAY-SHEAR-B') {
    return engineeringEquationSystem(
      engineeringEquationLine(
        `V<sub>u</sub> = q<sub>u,net</sub> · max(l − d, 0)
          <span class="a4-equation-separator">;</span>
          ρ<sub>w</sub> = ${engineeringFraction('A<sub>s</sub>', 'b · d')}`
      ),
      engineeringEquationLine(
        `V<sub>c</sub> = min [
          0.66 · λ<sub>s</sub> · λ · ρ<sub>w</sub><sup>1/3</sup> ·
          ${engineeringSquareRoot('f′<sub>c</sub>')} · b · d`,
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        `0.42 · λ · ${engineeringSquareRoot('f′<sub>c</sub>')} · b · d ]
          <span class="a4-equation-separator">;</span>
          φV<sub>c</sub> = 0.75 · V<sub>c</sub>`,
        'a4-equation-line--secondary'
      )
    )
  }
  if (id === 'SF-EQ-INTERIOR-PUNCHING-SHEAR') {
    return engineeringEquationSystem(
      engineeringEquationLine(
        'b<sub>o</sub> = 2[(c<sub>x</sub> + d) + (c<sub>y</sub> + d)]'
      ),
      engineeringEquationLine(
        'V<sub>u</sub> = P<sub>u,column</sub> − q<sub>u,net</sub>(c<sub>x</sub> + d)(c<sub>y</sub> + d)',
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        `v<sub>c</sub> = min [
          0.33,
          0.17(1 + ${engineeringFraction('2', 'β')}),
          0.083(2 + ${engineeringFraction('α<sub>s</sub> · d', 'b<sub>o</sub>')})
          ] · λ<sub>s</sub> · λ · ${engineeringSquareRoot('f′<sub>c</sub>')}`,
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        'φV<sub>c</sub> = 0.75 · v<sub>c</sub> · b<sub>o</sub> · d',
        'a4-equation-line--result'
      )
    )
  }
  if (
    id.startsWith('SF-EQ-') &&
    (id.includes('1_4D_1_7L') || id.includes('1_2D_1_6L'))
  ) {
    const sourceEquation = firstValue(
      loads,
      ['combination.normativeEquation'],
      formula
    )
    const executableEquation = firstValue(
      loads,
      ['combination.equation'],
      formula
    )
    const clause = firstValue(loads, ['combination.clause'], 'ข้อกำหนดชุดน้ำหนัก')
    const applicability = firstValue(
      loads,
      ['combination.applicability'],
      'ใช้ตามขอบเขตข้อมูลของ Calculation Snapshot'
    )
    const confirmationRequired = firstValue(
      applicabilityConfirmation,
      ['required'],
      false
    ) === true
    const confirmationAccepted = firstValue(
      applicabilityConfirmation,
      ['confirmed'],
      false
    ) === true
    return engineeringEquationSystem(
      engineeringEquationLine(
        `${metricText(clause)}: ${engineeringEquationText(sourceEquation)}`
      ),
      engineeringEquationLine(
        `สมการที่ Engine ใช้: ${engineeringEquationText(executableEquation)}`,
        'a4-equation-line--secondary'
      ),
      engineeringEquationLine(
        `ขอบเขต: ${engineeringEquationText(applicability)}`,
        'a4-equation-line--secondary'
      ),
      confirmationRequired
        ? engineeringEquationLine(
            `การยืนยันขอบเขต: ${
              confirmationAccepted
                ? 'ยืนยันแล้วว่า Lr, S และ R ไม่ใช้กับกรณีตรวจนี้'
                : 'ยังไม่ยืนยัน · ไม่สร้างผลคำนวณ'
            }`,
            confirmationAccepted
              ? 'a4-equation-line--result'
              : 'a4-equation-line--secondary'
          )
        : '',
      engineeringEquationLine(
        `P<sub>u,column</sub> =
          ${formattedMetric(firstValue(loads, ['combination.gammaD'], EMPTY), 2)}
          P<sub>D</sub> +
          ${formattedMetric(firstValue(loads, ['combination.gammaL'], EMPTY), 2)}
          P<sub>L</sub>`,
        'a4-equation-line--result'
      )
    )
  }
  return engineeringEquationLine(
    `<span class="a4-equation-fallback">${metricText(formula)}</span>`
  )
}

const renderPrincipalEquationLine = ({
  id,
  formula,
  loads,
  applicabilityConfirmation,
  surface = 'a4',
}) => {
  const equationAttribute =
    surface === 'flow07' ? 'data-flow07-equation-id' : 'data-a4-equation-id'
  const extraClass =
    surface === 'flow07' ? ' calc-story-equation__formula' : ''
  return `<div class="a4-worked-formula a4-math-row${extraClass}"
    ${equationAttribute}="${escapeAttribute(id)}"
    data-math-layout="stacked"
    data-formula-source="${escapeAttribute(formula)}">
    <span class="a4-math-row__label">สมการ</span>
    <span class="a4-equation-stack" role="math" aria-label="${escapeAttribute(formula)}">
      ${renderPrincipalEquationDisplay(id, formula, loads, applicabilityConfirmation)}
    </span>
  </div>`
}

const renderReportFromEnvelope = (envelope) => {
  const data = envelope.data
  const project = firstValue(data, ['project'], {})
  const inputs = firstValue(data, ['inputs'], {})
  const inputMaterials = firstValue(inputs, ['materials'], {})
  const inputLoads = firstValue(inputs, ['loads'], {})
  const inputSoil = firstValue(inputs, ['soil'], {})
  const designBasis = firstValue(data, ['designBasis'], {})
  const summary = firstValue(data, ['summary'], {})
  const loads = firstValue(summary, ['loads'], {})
  const serviceLoads = firstValue(loads, ['service'], {})
  const factoredLoads = firstValue(loads, ['factored'], {})
  const bearing = firstValue(summary, ['bearing'], {})
  const flexure = firstValue(data, ['flexure'], {})
  const oneWayShear = firstValue(data, ['oneWayShear'], {})
  const punching = firstValue(data, ['punching'], {})
  const sbcSource = firstValue(bearing, ['sbcSource', 'capacitySource'], EMPTY)
  const checks = selectDecisionChecks(data).filter(isExplicitlyEvaluated)
  const allChecks = normalizeChecks(data)
  const equations = normalizeEquations(data)
  const section = firstValue(data, ['section'], {})
  const geometry = firstValue(section, ['geometry'], firstValue(summary, ['geometry'], {}))
  const reinforcement = firstValue(
    section,
    ['reinforcement'],
    firstValue(summary, ['reinforcement'], {})
  )
  const memberMark = projectField(project, 'memberMark', 'mark', 'memberId')
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const columnB = geometryDimension(geometry, 'column', 'width')
  const columnL = geometryDimension(geometry, 'column', 'length')
  const footing = footingGeometry(geometry)
  const coverM = firstValue(
    footing,
    ['coverM', 'cover'],
    firstValue(geometry, ['coverMm', 'cover'], EMPTY)
  )
  const coverMm =
    numericValue(coverM) !== null
      ? numericValue(coverM) <= 2
        ? numericValue(coverM) * 1000
        : numericValue(coverM)
      : EMPTY
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const flexureA = firstValue(flexure, ['A'], {})
  const flexureB = firstValue(flexure, ['B'], {})
  const oneWayShearA = firstValue(oneWayShear, ['A'], {})
  const oneWayShearB = firstValue(oneWayShear, ['B'], {})
  const punchingGeometry = firstValue(geometry, ['criticalSections.punching'], {})
  const punchingPerimeterM = firstValue(
    punchingGeometry,
    ['perimeterM', 'criticalPerimeter', 'bo'],
    EMPTY
  )
  const punchingDepthMm = firstValue(
    geometry,
    ['effectiveDepthMm.punching', 'effectiveDepth.punching'],
    EMPTY
  )
  const cantileverA = firstValue(geometry, ['cantileversM.A', 'cantilevers.A'], EMPTY)
  const cantileverB = firstValue(geometry, ['cantileversM.B', 'cantilevers.B'], EMPTY)
  const effectiveDepthA = firstValue(
    geometry,
    ['effectiveDepthMm.A', 'effectiveDepth.A'],
    EMPTY
  )
  const effectiveDepthB = firstValue(
    geometry,
    ['effectiveDepthMm.B', 'effectiveDepth.B'],
    EMPTY
  )
  // The compact decision table intentionally omits non-governing PASS checks.
  // Footing-specific evidence cards must still read those evaluated checks from
  // the same Snapshot so As,required / As,provided is not mislabeled as HOLD.
  const reportCheck = (id) => allChecks.find((check) => checkId(check) === id) || {}
  const reportTableChecks = CORE_CHECK_IDS.map((id) => reportCheck(id)).filter(
    isExplicitlyEvaluated
  )
  const supplementalFailureChecks = allChecks.filter(
    (check) =>
      isExplicitlyEvaluated(check) &&
      displayStatus(check) === 'FAIL' &&
      !CORE_CHECK_IDS.includes(checkId(check))
  )
  const reportEquation = (id) =>
    equations.find((equation) => equationId(equation) === id) || null
  const reportFormula = (id) => {
    const equation = reportEquation(id)
    if (!isPresentableEquation(equation)) return EMPTY
    const source = sourceRecord(equation)
    return rawMetricText(source.formula)
  }
  const bearingCapacityCheck = reportCheck('bearing-capacity')
  const shortDirectionBandCheck = reportCheck('short-direction-band-distribution')
  const structuredShortDirection = rawMetricText(
    firstValue(reinforcement, ['distribution.shortDirection'], ''),
    ''
  ).toUpperCase()
  const evidenceShortDirection = rawMetricText(
    sourceRecord(shortDirectionBandCheck).substitution,
    ''
  )
    .match(/short-direction\s*=\s*([AB])/i)?.[1]
    ?.toUpperCase()
  const shortDirectionBandAxis = ['A', 'B'].includes(structuredShortDirection)
    ? structuredShortDirection
    : evidenceShortDirection
  const directionalRebarChecks = (direction) => {
    const normalizedDirection = String(direction).toUpperCase()
    const directionalIds = [
      `provided-steel-${normalizedDirection.toLowerCase()}`,
      `tension-controlled-${normalizedDirection.toLowerCase()}`,
      `flexure-capacity-${normalizedDirection.toLowerCase()}`,
      `punching-minimum-steel-${normalizedDirection.toLowerCase()}`,
    ]
    if (
      isExplicitlyEvaluated(shortDirectionBandCheck) &&
      (!shortDirectionBandAxis || shortDirectionBandAxis === normalizedDirection)
    ) {
      directionalIds.push('short-direction-band-distribution')
    }
    return directionalIds.map((id) => reportCheck(id)).filter(isExplicitlyEvaluated)
  }
  const selectedRebarInline = (direction, bar) => {
    const check = reportCheck(`provided-steel-${String(direction).toLowerCase()}`)
    if (!isExplicitlyEvaluated(check)) return ''
    const relatedChecks = directionalRebarChecks(direction)
    const hasDirectionalFailure = relatedChecks.some(
      (record) => displayStatus(record) === 'FAIL'
    )
    const aggregateStatus =
      hasDirectionalFailure ||
      !relatedChecks.length ||
      !relatedChecks.every((record) => displayStatus(record) === 'PASS')
        ? hasDirectionalFailure
          ? 'FAIL'
          : NOT_EVALUATED
        : 'PASS'
    const spacingMm = firstValue(bar, ['spacingMm', 'spacing'], EMPTY)
    const spacingCm =
      numericValue(spacingMm) === null ? EMPTY : numericValue(spacingMm) / 10
    return `<p class="${statusClass(aggregateStatus)}"
      data-rebar-check="${escapeAttribute(checkId(check))}"
      data-rebar-result="${escapeAttribute(aggregateStatus)}"
      data-related-checks="${escapeAttribute(relatedChecks.map(checkId).join(' '))}"
      data-check-id="${escapeAttribute(checkId(check))}">
      <span>เลือกใช้เหล็ก · ทิศ ${escapeHtml(direction)}</span>
      <b>${barCount(bar)}-${metricText(reinforcementDesignation(bar))}
        @ ${formattedValueWithUnit(spacingMm, 'mm', 1)}
        ${spacingCm === EMPTY ? '' : `(≈ ${formattedValueWithUnit(spacingCm, 'cm', 1)})`}</b>
      <em>As,req = ${formattedEngineeringMetric(checkDemand(check))} ·
        As,prov = ${formattedEngineeringMetric(checkCapacity(check))} ·
        ผลรวมทิศ ${escapeHtml(direction)} · ${
          aggregateStatus === 'PASS'
            ? 'ผ่าน · O.K.'
            : aggregateStatus === 'FAIL'
              ? 'ไม่ผ่าน · FAIL'
              : 'รอตรวจ · REVIEW'
        }</em>
    </p>`
  }
  const reportEquationLine = (id) =>
    renderPrincipalEquationLine({
      id,
      formula: reportFormula(id),
      loads,
      applicabilityConfirmation: firstValue(
        designBasis,
        ['loadApplicabilityConfirmation'],
        {}
      ),
      surface: 'a4',
    })
  const reportResultStatus = (checkIdValue) => {
    const check = reportCheck(checkIdValue)
    return isExplicitlyEvaluated(check)
      ? metricText(professionalResultLabel(check))
      : metricText(NOT_EVALUATED)
  }
  const reportStrengthUnavailable = (checkIdValue, equationIdValue) =>
    !isExplicitlyEvaluated(reportCheck(checkIdValue))
      ? `<p class="a4-not-evaluated-block" data-a4-not-evaluated="${escapeAttribute(
          checkIdValue
        )}" data-a4-equation-id="${escapeAttribute(equationIdValue)}">
          <strong>NOT EVALUATED · นอกขอบเขตการคำนวณรุ่นนี้</strong>
          <span>ไม่แสดงค่าความต้องการ กำลัง หรือ D/C · ดูหลักฐานและเหตุผลใน Flow 07</span>
        </p>`
      : ''
  const supplementalFailureStrip = () => {
    if (!supplementalFailureChecks.length) return ''
    return `<div class="a4-supplemental-failures"
      data-a4-supplemental-failures="${supplementalFailureChecks.length}"
      aria-label="รายการที่ประเมินแล้วและไม่ผ่านเพิ่มเติม">
      <b>ผลไม่ผ่านเพิ่มเติมจากตารางหลัก</b>
      <div>${supplementalFailureChecks
        .map((check) => {
          const ratio = numericValue(checkRatio(check))
          return `<span data-check-id="${escapeAttribute(checkId(check))}">
            <strong>${metricText(REPORT_CHECK_CODES[checkId(check)] || checkId(check))}</strong>
            ${metricText(REPORT_SUPPLEMENTAL_LABELS[checkId(check)] || checkLabel(check))}
            ${ratio === null ? '' : ` · D/C ${formattedMetric(ratio, 3)}`}
            · ไม่ผ่าน · FAIL
          </span>`
        })
        .join('')}</div>
    </div>`
  }
  const bearingCornerValues = bearingCorners(bearing)
  const overallSummary = firstValue(summary, ['overall'], {})
  const governingCheckId = rawMetricText(firstValue(overallSummary, ['governingCheckId'], EMPTY))
  const governingCheck = reportCheck(governingCheckId)
  const calculatedReportFailed = checks.some((check) => displayStatus(check) === 'FAIL')
  const calculatedReportComplete =
    rawMetricText(firstValue(overallSummary, ['bearingStatus'], EMPTY)) === 'PASS' &&
    rawMetricText(firstValue(overallSummary, ['strengthStatus'], EMPTY)) === 'PASS' &&
    rawMetricText(firstValue(overallSummary, ['evaluatedEquationStatus'], EMPTY)) === 'PASS'
  const calculatedResultState = calculatedReportFailed
    ? 'FAIL'
    : calculatedReportComplete
      ? 'PASS'
      : 'REVIEW'
  const evaluatedPassCount = checks.filter((check) => displayStatus(check) === 'PASS').length
  const evaluatedFailCount = checks.filter((check) => displayStatus(check) === 'FAIL').length
  const documentReviewState = 'REVIEW'
  const profileId = rawMetricText(
    firstValue(designBasis, ['profileId', 'resolvedProfile.profileId'], envelope.profileId || EMPTY)
  )
  const profileDisplayLabel = rawMetricText(
    firstValue(
      designBasis,
      ['displayLabel', 'profileLabel', 'label', 'resolvedProfile.displayLabel'],
      profileId
    )
  )
  const calculationFingerprint = traceValue(envelope, 'calculationFingerprint')
  const revision = projectField(project, 'revision', 'rev')
  const reportPageAttributes = (pageNumber) =>
    [
      `data-report-page="${pageNumber}"`,
      'data-document-class="CALCULATION_REVIEW"',
      `data-snapshot-id="${escapeAttribute(envelope.snapshotId)}"`,
      `data-payload-hash="${escapeAttribute(envelope.payloadHash)}"`,
      `data-calculation-fingerprint="${escapeAttribute(calculationFingerprint)}"`,
      `data-profile-id="${escapeAttribute(profileId)}"`,
      `data-member-mark="${escapeAttribute(memberMark)}"`,
      `data-revision="${escapeAttribute(revision)}"`,
    ].join(' ')
  const reportHeaderProjectLine = () =>
    `<dl class="a4-header-context" aria-label="ข้อมูลประกอบหัวรายงาน">
      <div><dt>โครงการ</dt><dd>${metricText(
        projectField(project, 'projectName', 'name')
      )}</dd></div>
      <div><dt>ชิ้นส่วน</dt><dd>${metricText(memberMark)}</dd></div>
      <div><dt>เลขที่คำนวณ</dt><dd>${metricText(
        projectField(project, 'calculationNumber', 'calculationNo')
      )}</dd></div>
      <div><dt>Revision</dt><dd>${metricText(revision)}</dd></div>
      <div><dt>จัดทำโดย</dt><dd>${metricText(
        projectField(project, 'preparedBy')
      )}</dd></div>
      <div><dt>ตรวจสอบโดย</dt><dd>${metricText(
        projectField(project, 'checkedBy')
      )}</dd></div>
    </dl>`
  return `<section class="sf-snapshot-surface sf-snapshot-surface--report report-document"
    lang="th" ${surfaceAttributes(envelope, 'report')} data-sbc-source="${escapeAttribute(
      sbcSource
    )}" aria-label="รายงาน A4 ฐานรากแผ่สองหน้า">
    <article class="report-sheet report-product report-bw" ${reportPageAttributes(1)}
      aria-label="รายงานฐานรากแผ่ หน้า 1 จาก 2">
    <header class="report-sheet__header">
      <div class="a4-header-title"><span>นายช่างใหญ่ Civil Apps · เครื่องมือฐานรากแผ่</span>
        <h3>รายการคำนวณฐานรากแผ่ · หน้า 1 / 2</h3>
        ${reportHeaderProjectLine()}
      </div>
      <dl>
        <dt>เลขที่แบบ</dt><dd>${metricText(projectField(project, 'drawingNumber', 'drawingNo'))}</dd>
        <dt>โพรไฟล์</dt><dd>${metricText(profileId)}</dd>
        <dt>รุ่นเครื่องคำนวณ</dt><dd>${metricText(
          firstValue(designBasis, ['engineVersion'], envelope.engineVersion || EMPTY)
        )}</dd>
        <dt>ชุดผลคำนวณ</dt><dd>${metricText(envelope.snapshotId)}</dd>
      </dl>
      <div class="a4-header-signoff" aria-label="ช่องลงนาม">
        <div><span>จัดทำโดย</span><i></i><b>${metricText(
          projectField(project, 'preparedBy')
        )}</b></div>
        <div><span>ตรวจสอบโดย</span><i></i><b>${metricText(
          projectField(project, 'checkedBy')
        )}</b></div>
        <div><span>อนุมัติโดย</span><i></i><b>${metricText(
          projectField(project, 'approvedBy')
        )}</b></div>
      </div>
    </header>
    <section class="a4-basis" aria-label="ข้อมูลโครงการและฐานการออกแบบ">
      <h4>01 · ข้อมูลโครงการ / ฐานการออกแบบ</h4>
      <table><tbody>
        <tr><th scope="row">เจ้าของ / สถานที่</th><td>${metricText(
          projectField(project, 'projectOwner', 'owner')
        )} · ${metricText(projectField(project, 'projectLocation', 'location'))}</td>
          <th scope="row">โพรไฟล์ / รุ่นเครื่องคำนวณ</th><td>${metricText(
            firstValue(designBasis, ['profileId', 'profile'], EMPTY)
          )} · ${metricText(firstValue(designBasis, ['engineVersion'], envelope.engineVersion || EMPTY))}</td></tr>
        <tr><th scope="row">ฐานราก / เสา</th><td>${formattedValueWithUnit(
          footingB,
          'm',
          2
        )} × ${formattedValueWithUnit(footingL, 'm', 2)} × ${formattedValueWithUnit(
          footingH,
          'm',
          2
        )} · เสา ${formattedValueWithUnit(columnB, 'm', 2)} × ${formattedValueWithUnit(
          columnL,
          'm',
          2
        )}</td>
          <th scope="row">ดิน / ระยะหุ้ม</th><td>SBC<sub>gross</sub> ${formattedValueWithUnit(
            firstValue(bearing, ['sbcGrossKPa', 'sbc'], EMPTY),
            'kPa',
            2
          )} · ระยะหุ้ม ${formattedValueWithUnit(coverMm, 'mm', 0)}
            <small class="a4-sbc-source" title="${escapeAttribute(sbcSource)}">ที่มา SBC<sub>gross</sub>:
              ${metricText(sbcSource)}</small></td></tr>
        <tr><th scope="row">Pservice,gross / Pu,column</th><td>${formattedValueWithUnit(
          firstValue(serviceLoads, ['grossReactionKN', 'columnReactionKN'], EMPTY),
          'kN',
          2
        )} / ${formattedValueWithUnit(
          firstValue(factoredLoads, ['columnReactionKN', 'column'], EMPTY),
          'kN',
          2
        )}</td>
          <th scope="row">เหล็กเสริมที่เลือก</th><td>${metricText(
            reinforcementSummary(barA, 'BAR-A')
          )}<br>${metricText(reinforcementSummary(barB, 'BAR-B'))}</td></tr>
        <tr><th scope="row">กำลังชิ้นส่วน</th><td>${metricText(
          firstValue(
            designBasis,
            ['memberStrengthStandard', 'standard', 'governingStandard'],
            EMPTY
          )
        )}</td>
          <th scope="row">มาตรฐานชุดน้ำหนัก</th><td><strong>${metricText(
            firstValue(
              designBasis,
              [
                'loadStandard.displayLabel',
                'resolvedProfile.loadStandard.displayLabel',
                'loadCombination.standard',
              ],
              EMPTY
            )
          )}</strong><br><small>${metricText(
            firstValue(designBasis, ['loadCombination.clause'], EMPTY)
          )} · ${metricText(
            firstValue(
              designBasis,
              ['loadCombination.equation', 'loadCombination.label'],
              EMPTY
            )
          )}</small></td></tr>
        <tr><th scope="row">คอนกรีต / เหล็ก</th><td>f′c ${formattedValueWithUnit(
          firstValue(inputMaterials, ['fcMPa'], EMPTY),
          'MPa',
          2
        )} · fy ${formattedValueWithUnit(
          firstValue(inputMaterials, ['fyMPa'], EMPTY),
          'MPa',
          2
        )}</td>
          <th scope="row">น้ำหนัก D / L</th><td>${formattedValueWithUnit(
            firstValue(inputLoads, ['deadKN'], EMPTY),
            'kN',
            2
          )} / ${formattedValueWithUnit(
            firstValue(inputLoads, ['liveKN'], EMPTY),
            'kN',
            2
          )}</td></tr>
        <tr><th scope="row">หน่วยน้ำหนักคอนกรีต / ดิน</th><td>${formattedValueWithUnit(
          firstValue(inputMaterials, ['concreteUnitWeightKNPerM3'], EMPTY),
          'kN/m³',
          2
        )} / ${formattedValueWithUnit(
          firstValue(inputMaterials, ['soilUnitWeightKNPerM3'], EMPTY),
          'kN/m³',
          2
        )}</td>
          <th scope="row">SBC<sub>gross</sub> ที่กรอก</th><td>${formattedValueWithUnit(
            firstValue(inputSoil, ['sbcGrossKPa'], EMPTY),
            'kPa',
            2
          )}</td></tr>
        <tr><th scope="row">ระยะยื่น A / B</th><td>${formattedValueWithUnit(
          cantileverA,
          'm',
          3
        )} / ${formattedValueWithUnit(cantileverB, 'm', 3)}</td>
          <th scope="row">โพรไฟล์ที่ใช้คำนวณ</th><td>${metricText(
            profileDisplayLabel
          )}<br><small>${metricText(profileId)}</small></td></tr>
      </tbody></table>
    </section>
    <section class="a4-worked-calculations" aria-label="สมการ การแทนค่า และผลคำนวณฐานราก">
      <div class="a4-section-title"><b>02 · น้ำหนัก แรงดันดิน และสมดุลแรง</b>
        <span>ข้อมูล → สมการ → แทนค่า → ผลจาก Snapshot</span></div>
      <div class="a4-worked-grid">
        <article class="a4-worked-card a4-calculation-band" data-calculation-step="self-weights">
          <header><b>02.1 · น้ำหนักฐานและดินเหนือฐาน</b>
            <em>${reportResultStatus('bearing-capacity')}</em></header>
          ${reportEquationLine('SF-EQ-SERVICE-GROSS-WEIGHTS')}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
            P<sub>service,gross</sub> =
            ${formattedValueWithUnit(firstValue(inputLoads, ['deadKN'], EMPTY), 'kN', 2)}
            + ${formattedValueWithUnit(firstValue(inputLoads, ['liveKN'], EMPTY), 'kN', 2)}
            + ${formattedValueWithUnit(
              firstValue(serviceLoads, ['footingWeightKN'], EMPTY),
              'kN',
              2
            )}
            + ${formattedValueWithUnit(
              firstValue(serviceLoads, ['soilOverburdenWeightKN'], EMPTY),
              'kN',
              2
            )}
            = ${formattedValueWithUnit(
              firstValue(serviceLoads, ['grossReactionKN'], EMPTY),
              'kN',
              2
            )}</strong></p>
        </article>
        <article class="a4-worked-card a4-calculation-band" data-calculation-step="service-bearing">
          <header><b>02.2 · แรงดันดินใช้งานและการสัมผัส</b>
            <em>${reportResultStatus('bearing-capacity')}</em></header>
          ${reportEquationLine('SF-EQ-SERVICE-BIAXIAL-PRESSURE')}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่าแรงดัน</span><strong>
            P / A = ${formattedValueWithUnit(
              firstValue(serviceLoads, ['grossReactionKN'], EMPTY),
              'kN',
              2
            )} / ${formattedValueWithUnit(firstValue(bearing, ['areaM2'], EMPTY), 'm²', 3)}
            = ${formattedValueWithUnit(firstValue(bearing, ['q0KPa'], EMPTY), 'kPa', 2)} ·
            M<sub>x</sub> = ${formattedValueWithUnit(
              firstValue(inputLoads, ['serviceMxKNm'], EMPTY),
              'kN·m',
              2
            )} · M<sub>y</sub> = ${formattedValueWithUnit(
              firstValue(inputLoads, ['serviceMyKNm'], EMPTY),
              'kN·m',
              2
            )}</strong></p>
          <p class="a4-worked-substitution a4-math-row"><span>แรงดันมุม</span><strong>
            ${bearingCornerValues
              .map(
                (corner, index) =>
                  `q${index + 1}${['(−X,−Y)', '(+X,−Y)', '(+X,+Y)', '(−X,+Y)'][index]} =
                    ${formattedValueWithUnit(corner, 'kPa', 2)}`
              )
              .join(' / ')}</strong></p>
          <p class="a4-worked-result"><span>ผล</span><strong>
            q<sub>min</sub> / q<sub>max</sub> / SBC<sub>gross</sub> =
            ${formattedValueWithUnit(firstValue(bearing, ['qMinKPa'], EMPTY), 'kPa', 2)} /
            ${formattedValueWithUnit(firstValue(bearing, ['qMaxKPa'], EMPTY), 'kPa', 2)} /
            ${formattedValueWithUnit(firstValue(bearing, ['sbcGrossKPa'], EMPTY), 'kPa', 2)}
          </strong><em>D/C ${formattedMetric(
            checkRatio(bearingCapacityCheck),
            3
          )} · ${reportResultStatus('bearing-capacity')}</em></p>
          <p class="a4-worked-result"><span>การสัมผัสดิน</span><strong>
            ${metricText(
              firstValue(bearing, ['fullContact'], false)
                ? 'สัมผัสเต็มพื้นที่'
                : 'แรงดึงเกิดขึ้นใต้ฐาน'
            )}</strong><em>kern ${formattedMetric(
              firstValue(bearing, ['combinedKernRatio'], EMPTY),
              3
            )}</em></p>
        </article>

        <article class="a4-worked-card a4-calculation-band" data-calculation-step="factored-pressure">
          <header><b>02.3 · แรงประลัยและแรงดันสุทธิ</b>
            <em>${metricText(
              firstValue(designBasis, ['loadCombination.equation'], EMPTY)
            )}</em></header>
          ${reportEquationLine(
            firstValue(loads, ['combination.id'], EMPTY) === 'TH_MR_2566_C7_1_4D_1_7L'
              ? 'SF-EQ-TH_MR_2566_C7_1_4D_1_7L'
              : `SF-EQ-${rawMetricText(firstValue(loads, ['combination.id'], EMPTY))}`
          )}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
            P<sub>u,column</sub> =
            ${formattedMetric(firstValue(loads, ['combination.gammaD'], EMPTY), 2)}
            (${formattedValueWithUnit(firstValue(inputLoads, ['deadKN'], EMPTY), 'kN', 2)})
            + ${formattedMetric(firstValue(loads, ['combination.gammaL'], EMPTY), 2)}
            (${formattedValueWithUnit(firstValue(inputLoads, ['liveKN'], EMPTY), 'kN', 2)})
            = ${formattedValueWithUnit(
              firstValue(factoredLoads, ['columnReactionKN'], EMPTY),
              'kN',
              2
            )}</strong></p>
          ${reportEquationLine('SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM')}
          <p class="a4-worked-substitution a4-math-row"><span>แทนค่าแรงดัน</span><strong>
            ${formattedValueWithUnit(
              firstValue(factoredLoads, ['grossPressureKPa'], EMPTY),
              'kPa',
              2
            )} − ${formattedValueWithUnit(
              firstValue(factoredLoads, ['distributedDeadPressureKPa'], EMPTY),
              'kPa',
              2
            )} = ${formattedValueWithUnit(
              firstValue(factoredLoads, ['netPressureKPa'], EMPTY),
              'kPa',
              2
            )}</strong></p>
          <p class="a4-worked-result"><span>ผล</span><strong>
            P<sub>u,gross</sub> =
            ${formattedValueWithUnit(
              firstValue(factoredLoads, ['grossReactionKN'], EMPTY),
              'kN',
              2
            )} ·
            q<sub>u,gross</sub> / q<sub>u,net</sub> =
            ${formattedValueWithUnit(
              firstValue(factoredLoads, ['grossPressureKPa'], EMPTY),
              'kPa',
              2
            )} / ${formattedValueWithUnit(
              firstValue(factoredLoads, ['netPressureKPa'], EMPTY),
              'kPa',
              2
            )}</strong><em>สมดุลแรงขึ้น–ลง</em></p>
          </article>
      </div>
    </section>
    <section class="report-evidence">
      <div class="report-diagram"><h4>03 · แปลนฐานราก / เหล็กเสริม</h4>
        ${renderA4PlanSvg(geometry, reinforcement, 'แปลนฐานรากในรายงาน A4')}</div>
      <div class="report-diagram"><h4>04 · รูปตัด X-X · แนว A/X / เหล็กเสริม</h4>
        ${renderA4SectionSvg(
          geometry,
          reinforcement,
          'รูปตัดฐานรากในรายงาน A4'
        )}</div>
    </section>
    </article>

    <article class="report-sheet report-product report-bw" ${reportPageAttributes(2)}
      aria-label="รายงานฐานรากแผ่ หน้า 2 จาก 2">
      <header class="report-sheet__header report-sheet__header--continuation">
        <div class="a4-header-title"><span>นายช่างใหญ่ Civil Apps · เครื่องมือฐานรากแผ่</span>
          <h3>รายการคำนวณฐานรากแผ่ · หน้า 2 / 2</h3>
          ${reportHeaderProjectLine()}
        </div>
        <dl>
          <dt>เลขที่แบบ</dt><dd>${metricText(
            projectField(project, 'drawingNumber', 'drawingNo')
          )}</dd>
          <dt>โพรไฟล์</dt><dd>${metricText(profileId)}</dd>
          <dt>ชุดผลคำนวณ</dt><dd>${metricText(envelope.snapshotId)}</dd>
          <dt>แผ่น</dt><dd>02 / 02</dd>
        </dl>
      </header>
      <section class="a4-effective-depths a4-calculation-band" aria-label="ระยะยื่นและความลึกประสิทธิผล">
        <div class="a4-section-title"><b>01 · ระยะยื่นและความลึกประสิทธิผล</b>
          <span>ค่าจากเรขาคณิต Snapshot เดียวกัน</span></div>
        <dl class="calc-story-values">
          <div><dt>ระยะยื่น A / B</dt><dd>${formattedValueWithUnit(
            cantileverA,
            'm',
            3
          )} / ${formattedValueWithUnit(cantileverB, 'm', 3)}</dd></div>
          <div><dt>dA / dB / d punching</dt><dd>${formattedValueWithUnit(
            effectiveDepthA,
            'mm',
            0
          )} / ${formattedValueWithUnit(effectiveDepthB, 'mm', 0)} /
            ${formattedValueWithUnit(punchingDepthMm, 'mm', 0)}</dd></div>
        </dl>
      </section>
      <section class="a4-worked-calculations" aria-label="กำลังและเหล็กเสริม">
        <div class="a4-section-title"><b>02 · กำลังและเหล็กเสริม</b>
          <span>ดัด → เฉือนทางเดียว → เฉือนทะลุ</span></div>
        <div class="a4-worked-grid">

        ${[
          ['A', flexureA, barA, 'flexure-capacity-a'],
          ['B', flexureB, barB, 'flexure-capacity-b'],
        ]
          .map(
            ([direction, result, bar, flexureCheckId]) => `
          <article class="a4-worked-card a4-calculation-band" data-calculation-step="flexure-${String(
            direction
          ).toLowerCase()}">
            <header><b>02.${direction === 'A' ? '1' : '2'} · ดัดและเหล็กเสริม ทิศ ${direction}</b>
              <em>${reportResultStatus(flexureCheckId)}</em></header>
            ${
              reportStrengthUnavailable(flexureCheckId, `SF-EQ-FLEXURE-${direction}`) ||
              `${reportEquationLine(`SF-EQ-FLEXURE-${direction}`)}
            <p class="a4-worked-substitution a4-math-row"><span>แทนค่า</span><strong>
              q<sub>u,net</sub> = ${formattedValueWithUnit(
                firstValue(factoredLoads, ['netPressureKPa'], EMPTY),
                'kPa',
                2
              )} ·
              l = ${formattedValueWithUnit(firstValue(result, ['cantileverM'], EMPTY), 'm', 3)} ·
              d = ${formattedValueWithUnit(firstValue(result, ['depthMm'], EMPTY), 'mm', 0)} ·
              M<sub>u</sub> = ${formattedValueWithUnit(
                firstValue(result, ['muKNmPerM'], EMPTY),
                'kN·m/m',
                3
              )}</strong></p>
            <p class="a4-worked-result"><span>เหล็กที่ต้องการ</span><strong>
              A<sub>s,strength</sub> = ${formattedValueWithUnit(
                firstValue(result, ['asStrengthMm2PerM'], EMPTY),
                'mm²/m',
                1
              )} · A<sub>s,min</sub> = ${formattedValueWithUnit(
                firstValue(result, ['asMinimumMm2PerM'], EMPTY),
                'mm²/m',
                1
              )} · A<sub>s,req</sub> = ${formattedValueWithUnit(
                firstValue(result, ['asRequiredMm2PerM'], EMPTY),
                'mm²/m',
                1
              )}</strong></p>
            ${selectedRebarInline(direction, bar)}
            <p class="a4-worked-result"><span>กำลังดัด</span><strong>
              φM<sub>n</sub> = ${formattedValueWithUnit(
                firstValue(result, ['phiMnKNmPerM'], EMPTY),
                'kN·m/m',
                2
              )}</strong><em>D/C ${formattedMetric(
                firstValue(result, ['utilization'], EMPTY),
                3
              )} · ${reportResultStatus(flexureCheckId)}</em></p>
            `
            }
          </article>`
          )
          .join('')}

        ${[
          ['A', oneWayShearA, 'one-way-shear-a'],
          ['B', oneWayShearB, 'one-way-shear-b'],
        ]
          .map(
            ([direction, result, shearCheckId]) => `
          <article class="a4-worked-card a4-worked-card--compact a4-calculation-band"
            data-calculation-step="one-way-shear-${String(direction).toLowerCase()}">
            <header><b>02.${direction === 'A' ? '3' : '4'} · แรงเฉือนทางเดียว ทิศ ${direction}</b>
              <em>${reportResultStatus(shearCheckId)}</em></header>
            ${
              reportStrengthUnavailable(shearCheckId, `SF-EQ-ONE-WAY-SHEAR-${direction}`) ||
              `${reportEquationLine(`SF-EQ-ONE-WAY-SHEAR-${direction}`)}
            <p class="a4-worked-substitution a4-math-row"><span>แนววิกฤต</span><strong>
              x = d = ${formattedValueWithUnit(
                firstValue(result, ['criticalDistanceFromColumnFaceM'], EMPTY),
                'm',
                3
              )} · d = ${formattedValueWithUnit(
                firstValue(result, ['depthMm'], EMPTY),
                'mm',
                0
              )}</strong></p>
            <p class="a4-worked-substitution a4-math-row"><span>แทนค่ากำลัง</span><strong>
              ρ<sub>w</sub> = ${formattedMetric(firstValue(result, ['rhoW'], EMPTY), 5)} ·
              V<sub>c,ρ</sub> / V<sub>c,cap</sub> =
              ${formattedValueWithUnit(
                firstValue(result, ['vcRhoKNPerM'], EMPTY),
                'kN/m',
                2
              )} / ${formattedValueWithUnit(
                firstValue(result, ['vcCapKNPerM'], EMPTY),
                'kN/m',
                2
              )} · V<sub>c,governing</sub> =
              ${formattedValueWithUnit(
                firstValue(result, ['governingVcKNPerM'], EMPTY),
                'kN/m',
                2
              )}</strong></p>
            <p class="a4-worked-result"><span>ผล</span><strong>
              V<sub>u</sub> / φV<sub>c</sub> =
              ${formattedValueWithUnit(firstValue(result, ['vuKNPerM'], EMPTY), 'kN/m', 2)} /
              ${formattedValueWithUnit(
                firstValue(result, ['phiVcKNPerM'], EMPTY),
                'kN/m',
                2
              )}</strong><em>D/C ${formattedMetric(
                firstValue(result, ['utilization'], EMPTY),
                3
              )} · ${reportResultStatus(shearCheckId)}</em></p>
            `
            }
          </article>`
          )
          .join('')}

        <article class="a4-worked-card a4-worked-card--wide a4-calculation-band"
          data-calculation-step="interior-punching">
          <header><b>02.5 · แรงเฉือนทะลุรอบเสากลาง</b>
            <em>${reportResultStatus('punching-shear')}</em></header>
          ${
            reportStrengthUnavailable('punching-shear', 'SF-EQ-INTERIOR-PUNCHING-SHEAR') ||
            `${reportEquationLine('SF-EQ-INTERIOR-PUNCHING-SHEAR')}
          <div class="a4-punching-values">
            <p class="a4-worked-substitution a4-math-row"><span>แนววิกฤต</span><strong>
              d = ${formattedValueWithUnit(firstValue(punching, ['depthMm'], EMPTY), 'mm', 0)} ·
              b<sub>o</sub> = ${formattedValueWithUnit(
                firstValue(punching, ['perimeterMm'], punchingPerimeterM),
                numericValue(firstValue(punching, ['perimeterMm'], EMPTY)) === null ? 'm' : 'mm',
                numericValue(firstValue(punching, ['perimeterMm'], EMPTY)) === null ? 3 : 0
              )} · A<sub>in</sub> = ${formattedValueWithUnit(
                firstValue(punching, ['insideAreaM2'], EMPTY),
                'm²',
                4
              )}</strong></p>
            <p class="a4-worked-substitution a4-math-row"><span>กำลังเฉือนคอนกรีต</span><strong>
              v<sub>c1</sub> / v<sub>c2</sub> / v<sub>c3</sub> =
              ${formattedValueWithUnit(
                firstValue(punching, ['vcCandidatesMPa.vc1'], EMPTY),
                'MPa',
                3
              )} / ${formattedValueWithUnit(
                firstValue(punching, ['vcCandidatesMPa.vc2'], EMPTY),
                'MPa',
                3
              )} / ${formattedValueWithUnit(
                firstValue(punching, ['vcCandidatesMPa.vc3'], EMPTY),
                'MPa',
                3
              )} · v<sub>c,governing</sub> =
              ${formattedValueWithUnit(
                firstValue(punching, ['governingVcStressMPa'], EMPTY),
                'MPa',
                3
              )}</strong></p>
            <p class="a4-worked-result"><span>ผล</span><strong>
              V<sub>u</sub> / φV<sub>c</sub> =
              ${formattedValueWithUnit(firstValue(punching, ['vuKN'], EMPTY), 'kN', 2)} /
              ${formattedValueWithUnit(firstValue(punching, ['phiVcKN'], EMPTY), 'kN', 2)}
            </strong><em>D/C ${formattedMetric(
              firstValue(punching, ['utilization'], EMPTY),
              3
            )} · ${reportResultStatus('punching-shear')}</em></p>
          </div>
          `
          }
        </article>
      </div>
    </section>
    <section class="a4-checks" aria-label="รายการตรวจสำคัญ">
      <div class="a4-section-title"><b>03 · ผลตรวจที่คำนวณได้</b>
        <span class="a4-report-verdicts" data-document-status="${escapeAttribute(
          documentReviewState
        )}">
          <strong class="a4-calculated-verdict is-${calculatedResultState.toLowerCase()}"
            data-calculation-result="${calculatedResultState}">
            ${
              calculatedResultState === 'FAIL'
                ? `${evaluatedPassCount}/${checks.length} รายการผ่าน · ${evaluatedFailCount} รายการไม่ผ่าน · FAIL`
                : calculatedResultState === 'PASS'
                  ? `${evaluatedPassCount}/${checks.length} รายการที่คำนวณ · ผ่าน · O.K.`
                  : 'ผลรายการที่คำนวณ · ต้องตรวจเพิ่มเติม'
            }${
              isExplicitlyEvaluated(governingCheck)
                ? ` · ควบคุม ${metricText(REPORT_CHECK_CODES[governingCheckId] || governingCheckId)}
                  D/C ${formattedMetric(checkRatio(governingCheck), 3)}`
                : ''
            }</strong>
          <em class="a4-document-verdict" data-a4-scope-state="NOT_EVALUATED">
            สถานะรวม · REVIEW · ขอบเขตนอก R1 ยังไม่ประเมิน
          </em>
        </span></div>
      <table><colgroup><col class="a4-check-code"><col class="a4-check-label">
        <col class="a4-check-demand"><col class="a4-check-capacity">
        <col class="a4-check-ratio"><col class="a4-check-status"></colgroup>
        <thead><tr><th>รหัส</th><th>รายการ</th><th>ค่าความต้องการ</th>
        <th>ค่าความสามารถ</th><th>D/C</th><th>สถานะ</th></tr></thead>
        <tbody>${renderReportCheckRows(reportTableChecks) || `<tr><td colspan="6">${NOT_EVALUATED}</td></tr>`}</tbody></table>
      ${supplementalFailureStrip()}
    </section>
    <section class="a4-selected-rebar" aria-label="เหล็กเสริมล่างที่เลือก">
      <div class="a4-section-title"><b>04 · เหล็กเสริมล่างที่เลือก</b>
        <span>อ่านค่าจากผลที่ประเมินแล้ว</span></div>
      ${selectedRebarInline('A', barA)}
      ${selectedRebarInline('B', barB)}
    </section>
    <div class="a4-header-signoff a4-header-signoff--continuation" aria-label="ช่องลงนามต่อเนื่อง">
      <div><span>จัดทำโดย</span><i></i><b>${metricText(
        projectField(project, 'preparedBy')
      )}</b></div>
      <div><span>ตรวจสอบโดย</span><i></i><b>${metricText(
        projectField(project, 'checkedBy')
      )}</b></div>
      <div><span>อนุมัติโดย</span><i></i><b>${metricText(
        projectField(project, 'approvedBy')
      )}</b></div>
    </div>
    </article>
  </section>`
}

const equationId = (equation) =>
  firstValue(equation, ['equationId', 'id', 'key'], 'EQ')

const renderEquation = (equation) => {
  const source = sourceRecord(equation)
  const url = safeOfficialUrl(source.url)
  const assumptions = toList(firstValue(equation, ['assumptions'], []))
  const verificationStatus = firstValue(
    equation,
    ['verificationStatus', 'status'],
    source.verificationStatus
  )
  return `<article class="sf-equation-record" data-equation-id="${escapeAttribute(
    equationId(equation)
  )}" data-verification-status="${escapeAttribute(verificationStatus)}">
    <header><span>${metricText(equationId(equation))}</span>
      <h4>${metricText(firstValue(equation, ['title', 'label', 'name'], equationId(equation)))}</h4>
      <strong title="${escapeAttribute(verificationStatus)}">${metricText(
        verificationStatusLabel(verificationStatus)
      )}</strong></header>
    <dl class="sf-equation-ledger">
      <div><dt>สมการ (Formula)</dt><dd><code>${metricText(
        firstValue(equation, ['formula', 'expression'], EMPTY)
      )}</code></dd></div>
      <div><dt>การแทนค่า (Substitution)</dt><dd><code>${metricText(
        firstValue(equation, ['substitution', 'operandsText'], EMPTY)
      )}</code></dd></div>
      <div><dt>หน่วยมาตรฐาน (Canonical units)</dt><dd>${metricText(
        firstValue(equation, ['canonicalUnits', 'units', 'unit'], EMPTY)
      )}</dd></div>
      <div><dt>มาตรฐาน / ฉบับ (Edition)</dt><dd>${metricText(source.standard)} · ${metricText(
        source.edition
      )}</dd></div>
      <div><dt>ข้อกำหนด / รหัสสมการ</dt><dd>${metricText(source.clause)} · ${metricText(
        source.equation
      )}</dd></div>
      <div><dt>สมมติฐาน (Assumptions)</dt><dd>${
        assumptions.length
          ? assumptions.map((assumption) => `<span>${metricText(assumption)}</span>`).join('')
          : EMPTY
      }</dd></div>
      <div><dt>แหล่งอ้างอิงทางการ</dt><dd>${metricText(source.title)}
        ${
          url
            ? `<a href="${escapeAttribute(url)}" rel="noreferrer noopener">เปิดเอกสารทางการ</a>`
            : '<em>ไม่มี URL ทางการที่ใช้ได้</em>'
        }</dd></div>
    </dl>
  </article>`
}

const calculationChapterKey = (equation) => {
  const id = equationId(equation).toUpperCase()
  if (/SF-HOLD-/.test(id)) return 'holds'
  if (/SERVICE-(?:GROSS|BIAXIAL|COMBINED)|KERN/.test(id)) return 'bearing'
  if (/FACTORED|EFFECTIVE-DEPTH|BETA1|MATERIAL|STRENGTH-APPLICABILITY|LOAD|TH_MR|ACI_318/.test(id)) {
    return 'strength'
  }
  if (/FLEXURE-A|MINIMUM-STEEL-A|PROVIDED-REBAR-A|TENSION-CONTROL-A/.test(id)) return 'flexure-a'
  if (/FLEXURE-B|MINIMUM-STEEL-B|PROVIDED-REBAR-B|TENSION-CONTROL-B|BAND-DISTRIBUTION/.test(id)) {
    return 'flexure-b'
  }
  if (/ONE-WAY-SHEAR|PUNCHING/.test(id)) return 'shear'
  if (/BAR-CUT|TAKEOFF/.test(id)) return 'detailing'
  return 'strength'
}

const renderCalculationChapter = ({ number, id, eyebrow, title, status = '', body }) => `<section
  class="calc-chapter" id="${escapeAttribute(id)}">
  <b aria-hidden="true">${escapeHtml(number)}</b>
  <div>
    <header><div><span>${escapeHtml(eyebrow)}</span><h4>${escapeHtml(title)}</h4></div>
      ${status ? `<em>${metricText(status)}</em>` : ''}</header>
    ${body}
  </div>
</section>`

const renderCalculationBookFromEnvelope = (envelope) => {
  const data = envelope.data
  const project = firstValue(data, ['project'], {})
  const designBasis = firstValue(data, ['designBasis'], {})
  const equations = normalizeEquations(data)
  const checks = normalizeChecks(data)
  const limitations = firstValue(data, ['limitations'], [])
  const evaluatedSurface = evaluatedSurfaceVerdict(data)
  const loads = firstValue(data, ['loads'], {})
  const serviceLoads = firstValue(loads, ['service'], {})
  const factoredLoads = firstValue(loads, ['factored'], {})
  const bearing = firstValue(data, ['bearing'], {})
  const geometry = firstValue(data, ['geometry'], {})
  const reinforcement = firstValue(data, ['reinforcement'], {})
  const flexure = firstValue(data, ['flexure'], {})
  const flexureA = firstValue(flexure, ['A', 'a'], {})
  const flexureB = firstValue(flexure, ['B', 'b'], {})
  const oneWayShear = firstValue(data, ['oneWayShear'], {})
  const oneWayShearA = firstValue(oneWayShear, ['A', 'a'], {})
  const oneWayShearB = firstValue(oneWayShear, ['B', 'b'], {})
  const punching = firstValue(data, ['punching'], {})
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const columnB = geometryDimension(geometry, 'column', 'width')
  const columnL = geometryDimension(geometry, 'column', 'length')
  const profileId = rawMetricText(
    firstValue(designBasis, ['profileId', 'resolvedProfile.profileId'], envelope.profileId || EMPTY)
  )
  const profileDisplayLabel = rawMetricText(
    firstValue(
      designBasis,
      ['displayLabel', 'profileLabel', 'label', 'resolvedProfile.displayLabel'],
      profileId
    )
  )
  const calcCheck = (id) => checks.find((check) => checkId(check) === id) || {}
  const resultCheckIds = [
    'bearing-capacity',
    'full-contact-qmin',
    'flexure-capacity-a',
    'provided-steel-a',
    'flexure-capacity-b',
    'provided-steel-b',
    'one-way-shear-a',
    'one-way-shear-b',
    'punching-shear',
  ]
  const preferredResultChecks = resultCheckIds
    .map(calcCheck)
    .filter((check) => checkId(check) !== 'CHECK' && isExplicitlyEvaluated(check))
  const evaluatedChecks = checks.filter(isExplicitlyEvaluated)
  const evaluatedFailChecks = evaluatedChecks.filter((check) => displayStatus(check) === 'FAIL')
  const resultChecks = [...preferredResultChecks, ...evaluatedFailChecks].filter(
    (check, index, list) =>
      list.findIndex((candidate) => checkId(candidate) === checkId(check)) === index
  )
  const passCount = evaluatedChecks.filter((check) => displayStatus(check) === 'PASS').length
  const failCount = evaluatedFailChecks.length
  const evaluatedVerdict =
    failCount > 0
      ? 'พบรายการไม่ผ่าน · FAIL'
      : evaluatedChecks.length > 0 && passCount === evaluatedChecks.length
        ? 'รายการที่ประเมินแล้วผ่าน · OK'
        : 'ยังไม่มีรายการที่ประเมินครบ'
  const evaluatedBadge =
    failCount > 0
      ? { className: 'is-fail', label: 'FAIL' }
      : evaluatedChecks.length > 0 && passCount === evaluatedChecks.length
        ? { className: 'is-pass', label: 'OK' }
        : { className: 'is-neutral', label: '—' }
  const summaryCheckRow = (check) => {
    const evaluated = isExplicitlyEvaluated(check)
    const checkStatus = displayStatus(check)
    return `<tr class="${statusClass(checkStatus)}" data-summary-check="${escapeAttribute(
      checkId(check)
    )}">
      <th scope="row">${metricText(checkLabel(check))}</th>
      <td data-label="ค่าความต้องการ">${
        evaluated ? formattedEngineeringMetric(checkDemand(check)) : '—'
      }</td>
      <td data-label="ค่าความสามารถ">${
        evaluated ? formattedEngineeringMetric(checkCapacity(check)) : '—'
      }</td>
      <td data-label="D/C">${evaluated ? formattedMetric(checkRatio(check), 3) : '—'}</td>
      <td data-label="ผลตรวจ"><strong>${metricText(
        professionalResultLabel(check)
      )}</strong></td>
    </tr>`
  }
  const conciseCheck = (id, label) => {
    const check = calcCheck(id)
    const evaluated = isExplicitlyEvaluated(check)
    if (!evaluated) {
      return `<p class="calc-story-scope">
        <span>${escapeHtml(label)}</span>
        <em>ไม่รวมในขอบเขตการคำนวณรุ่นนี้</em>
      </p>`
    }
    return `<p class="calc-story-check ${statusClass(displayStatus(check))}">
      <span>${escapeHtml(label)}</span>
      <b>${
        evaluated
          ? `${formattedEngineeringMetric(checkDemand(check))} / ${formattedEngineeringMetric(
              checkCapacity(check)
            )}`
          : NOT_EVALUATED
      }</b>
      <em>${
        evaluated && rawMetricText(checkRatio(check)) !== EMPTY
          ? `D/C ${formattedMetric(checkRatio(check), 3)} · ${metricText(
              professionalResultLabel(check)
            )}`
          : metricText(professionalResultLabel(check))
      }</em>
    </p>`
  }
  const conciseEquation = (record) => {
    if (!isPresentableEquation(record)) return ''
    const source = sourceRecord(record)
    const id = equationId(record)
    return `<div class="calc-story-equation calc-story-equation--worked">
      <span>หลักฐานสมการ · ${metricText(source.sourceId)} · ${metricText(source.clause)}</span>
      ${renderPrincipalEquationLine({
        id,
        formula: rawMetricText(source.formula),
        loads,
        applicabilityConfirmation: firstValue(
          designBasis,
          ['loadApplicabilityConfirmation'],
          {}
        ),
        surface: 'flow07',
      })}
      <p class="calc-story-equation__substitution">
        <span>แทนค่า</span><strong>${metricText(source.substitution)}</strong>
      </p>
    </div>`
  }
  const factList = (items) => `<dl class="calc-story-values">${items
    .map(
      ([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`
    )
    .join('')}</dl>`
  const equationsByChapter = equations.reduce((groups, equation) => {
    const key = calculationChapterKey(equation)
    if (!groups[key]) groups[key] = []
    groups[key].push(equation)
    return groups
  }, {})
  const chapterEquation = (key, preferredId = '') => {
    const records = equationsByChapter[key] || []
    if (!preferredId) return records[0]
    return records.find((record) => equationId(record) === preferredId) || records[0]
  }
  const equationBody = (key) =>
    equationsByChapter[key]?.length
      ? `<div class="sf-equations">${equationsByChapter[key].map(renderEquation).join('')}</div>`
      : `<p class="is-review"><strong>${NOT_EVALUATED}</strong> ไม่มีสมการในบทนี้</p>`
  const chapters = [
    {
      number: '01',
      id: 'sf-calc-design-basis',
      label: 'ฐานออกแบบ',
      title: 'ข้อมูลโครงการและฐานการออกแบบ',
    },
    {
      number: '02',
      id: 'sf-calc-bearing',
      label: 'แรงดันดิน',
      title: 'น้ำหนักใช้งาน แรงดันดิน และเงื่อนไขสัมผัส',
    },
    {
      number: '03',
      id: 'sf-calc-strength-load',
      label: 'แรงประลัย',
      title: 'ชุดรวมน้ำหนัก แรงดันสุทธิ และเรขาคณิตกำลัง',
    },
    {
      number: '04',
      id: 'sf-calc-flexure-a',
      label: 'ดัด A',
      title: 'กำลังดัดและเหล็กเสริมทิศ A',
    },
    {
      number: '05',
      id: 'sf-calc-flexure-b',
      label: 'ดัด B',
      title: 'กำลังดัดและเหล็กเสริมทิศ B',
    },
    {
      number: '06',
      id: 'sf-calc-shear',
      label: 'แรงเฉือน',
      title: 'เฉือนทางเดียวและเฉือนทะลุ',
    },
    {
      number: '07',
      id: 'sf-calc-detailing',
      label: 'เหล็ก/Bar Cut',
      title: 'รูปทรงเหล็ก ความยาวตัด และปริมาณ',
    },
    {
      number: '08',
      id: 'sf-calc-checks',
      label: 'ทะเบียนตรวจ',
      title: 'ค่าความต้องการ ความสามารถ D/C และสถานะ',
    },
    {
      number: '09',
      id: 'sf-calc-holds',
      label: 'HOLD',
      title: 'ข้อจำกัดและรายการที่ยังไม่ประเมิน',
    },
    {
      number: '10',
      id: 'sf-calc-trace',
      label: 'Trace',
      title: 'แหล่งอ้างอิงและลายนิ้วมือ Snapshot',
    },
  ]
  return `<section class="sf-snapshot-surface sf-snapshot-surface--calc calculation-book" lang="th"
    ${surfaceAttributes(envelope, 'calc')} aria-label="รายการคำนวณฐานรากแผ่">
    <header class="sf-surface-heading">
      <div><span>รายการคำนวณฐานรากแผ่ · CALCULATION BOOK</span>
        <h3>วิธีคำนวณเต็มรูปแบบทีละขั้นตอน</h3>
        <p>${metricText(projectField(project, 'projectName', 'name'))} · ${metricText(
          projectField(project, 'memberMark', 'mark')
        )} · ${metricText(profileDisplayLabel)} · Snapshot ${metricText(envelope.snapshotId)}</p></div>
      <strong class="sf-status-token ${statusClass(evaluatedSurface.status)}">${metricText(
        evaluatedSurface.label
      )}</strong>
    </header>
    <section class="calc-narrative" aria-label="วิธีคำนวณเต็มรูปแบบทีละขั้นตอน">
      <header class="calc-narrative__header"><span>WORKED CALCULATION</span>
        <h4>ข้อมูลตั้งต้น → แรงดันดิน → กำลัง → ผลตรวจและ Trace</h4>
        <p>ตัวเลขทุกค่าดึงจาก Calculation Snapshot เดียวกับหน้าสรุป 3D แบบ และรายงาน A4</p></header>
      <div class="calc-story-list">
        <article class="calc-story-card" id="sf-story-input" data-calculation-step="1">
          <b class="calc-story-number">01</b><div>
            <header><span>ข้อมูลออกแบบและโพรไฟล์ที่ระบบจับคู่แล้ว</span>
              <h5>Design data · Resolved Design Standard profile</h5></header>
            ${factList([
              [
                'ฐานราก B × L × t',
                `${formattedValueWithUnit(footingB, 'm', 2)} × ${formattedValueWithUnit(
                  footingL,
                  'm',
                  2
                )} × ${formattedValueWithUnit(footingH, 'm', 2)}`,
              ],
              [
                'เสา b × l',
                `${formattedValueWithUnit(columnB, 'm', 2)} × ${formattedValueWithUnit(
                  columnL,
                  'm',
                  2
                )}`,
              ],
              [
                'โพรไฟล์ที่ระบบเลือกใช้',
                `${metricText(profileDisplayLabel)}<br><small>${metricText(profileId)}</small>`,
              ],
              [
                'มาตรฐานกำลังชิ้นส่วน',
                metricText(
                  firstValue(
                    designBasis,
                    ['memberStrengthStandard', 'resolvedProfile.memberStandard'],
                    EMPTY
                  )
                ),
              ],
              [
                'มาตรฐานชุดน้ำหนัก',
                `${metricText(
                  firstValue(
                    designBasis,
                    [
                      'loadStandard.displayLabel',
                      'resolvedProfile.loadStandard.displayLabel',
                      'loadCombination.standard',
                    ],
                    EMPTY
                  )
                )}<br><small>${metricText(
                  firstValue(designBasis, ['loadCombination.clause'], EMPTY)
                )} · ${metricText(
                  firstValue(
                    designBasis,
                    ['loadCombination.equation', 'loadCombination.label'],
                    EMPTY
                  )
                )}</small>`,
              ],
              [
                'ชุดรวมน้ำหนัก',
                metricText(
                  firstValue(
                    designBasis,
                    ['loadCombination.label', 'loadCombination.equation', 'loadCombination'],
                    EMPTY
                  )
                ),
              ],
              [
                'ระยะยื่น A / B',
                `${formattedValueWithUnit(
                  firstValue(geometry, ['cantileversM.A', 'cantilevers.A'], EMPTY),
                  'm',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(geometry, ['cantileversM.B', 'cantilevers.B'], EMPTY),
                  'm',
                  3
                )}`,
              ],
              [
                'เหล็กที่เลือก',
                `${metricText(reinforcementSummary(barA, 'BAR-A'))}<br>${metricText(
                  reinforcementSummary(barB, 'BAR-B')
                )}`,
              ],
            ])}
            ${conciseCheck('strength-applicability', 'ขอบเขตใช้การตรวจกำลัง R1')}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-self-weights" data-calculation-step="2">
          <b class="calc-story-number">02</b><div>
            <header><span>น้ำหนักฐานและดินเหนือฐาน</span>
              <h5>Footing self-weight · soil-overburden self-weight · Pservice,gross</h5></header>
            ${factList([
              [
                'Pservice,gross',
                formattedValueWithUnit(
                  firstValue(serviceLoads, ['grossReactionKN', 'gross'], EMPTY),
                  'kN',
                  2
                ),
              ],
              [
                'น้ำหนักฐาน / ดินถม',
                `${formattedValueWithUnit(
                  firstValue(serviceLoads, ['footingWeightKN'], EMPTY),
                  'kN',
                  2
                )} / ${formattedValueWithUnit(
                  firstValue(serviceLoads, ['soilOverburdenWeightKN'], EMPTY),
                  'kN',
                  2
                )}`,
              ],
            ])}
            ${conciseEquation(
              chapterEquation('bearing', 'SF-EQ-SERVICE-GROSS-WEIGHTS')
            )}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-bearing" data-calculation-step="3">
          <b class="calc-story-number">03</b><div>
            <header><span>แรงดันดินใช้งานและการสัมผัส</span>
              <h5>q1–q4 → qmin / qmax → SBC → kern / full contact</h5></header>
            ${factList([
              [
                'แรงดันมุม q1 / q2 / q3 / q4',
                bearingCorners(bearing)
                  .map((corner) => formattedValueWithUnit(corner, 'kPa', 2))
                  .join(' / '),
              ],
              [
                'qmin / qmax',
                `${formattedValueWithUnit(
                  firstValue(bearing, ['qMinKPa', 'qMin'], EMPTY),
                  'kPa',
                  2
                )} / ${formattedValueWithUnit(
                  firstValue(bearing, ['qMaxKPa', 'qMax'], EMPTY),
                  'kPa',
                  2
                )}`,
              ],
              [
                'SBC ที่ยอมให้',
                formattedValueWithUnit(
                  firstValue(bearing, ['sbcGrossKPa', 'sbc'], EMPTY),
                  'kPa',
                  2
                ),
              ],
              [
                'การสัมผัสดิน / Kern',
                `${firstValue(bearing, ['fullContact'], false) ? 'เต็มพื้นที่' : 'ต้องทบทวน'} · ${formattedMetric(
                  firstValue(bearing, ['combinedKernRatio'], EMPTY),
                  3
                )}`,
              ],
            ])}
            <div class="calc-story-checks">
              ${conciseCheck('bearing-capacity', 'qmax / SBC')}
              ${conciseCheck('full-contact-qmin', 'qmin ≥ 0 · สัมผัสดินเต็มพื้นที่')}
              ${conciseCheck('combined-kern', 'แกนกลางหนึ่งในสามแบบสองทิศ')}
            </div>
            ${conciseEquation(
              chapterEquation('bearing', 'SF-EQ-SERVICE-BIAXIAL-PRESSURE')
            )}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-strength" data-calculation-step="4">
          <b class="calc-story-number">04</b><div>
            <header><span>แรงประลัยและสมดุลแรงดัน</span>
              <h5>Factored column load · gross/net equilibrium</h5></header>
            ${factList([
              [
                'Pu,column',
                formattedValueWithUnit(
                  firstValue(factoredLoads, ['columnReactionKN', 'column'], EMPTY),
                  'kN',
                  2
                ),
              ],
              [
                'qu,gross / qu,net',
                `${formattedValueWithUnit(
                  firstValue(factoredLoads, ['grossPressureKPa', 'grossPressure'], EMPTY),
                  'kPa',
                  2
                )} / ${formattedValueWithUnit(
                  firstValue(factoredLoads, ['netPressureKPa', 'netPressure'], EMPTY),
                  'kPa',
                  2
                )}`,
              ],
            ])}
            ${conciseEquation(
              chapterEquation(
                'strength',
                firstValue(loads, ['combination.id'], EMPTY) === 'TH_MR_2566_C7_1_4D_1_7L'
                  ? 'SF-EQ-TH_MR_2566_C7_1_4D_1_7L'
                  : `SF-EQ-${rawMetricText(firstValue(loads, ['combination.id'], EMPTY))}`
              )
            )}
            ${conciseEquation(
              chapterEquation('strength', 'SF-EQ-FACTORED-GROSS-NET-EQUILIBRIUM')
            )}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-depths" data-calculation-step="5">
          <b class="calc-story-number">05</b><div>
            <header><span>ระยะยื่นและความลึกประสิทธิผล</span>
              <h5>Cantilevers · dA · dB · punching depth</h5></header>
            ${factList([
              [
                'ระยะยื่น A / B',
                `${formattedValueWithUnit(
                  firstValue(geometry, ['cantileversM.A', 'cantilevers.A'], EMPTY),
                  'm',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(geometry, ['cantileversM.B', 'cantilevers.B'], EMPTY),
                  'm',
                  3
                )}`,
              ],
              [
                'dA / dB / d(punch)',
                `${formattedValueWithUnit(
                  firstValue(geometry, ['effectiveDepthMm.A', 'effectiveDepth.A'], EMPTY),
                  'mm',
                  0
                )} / ${formattedValueWithUnit(
                  firstValue(geometry, ['effectiveDepthMm.B', 'effectiveDepth.B'], EMPTY),
                  'mm',
                  0
                )} / ${formattedValueWithUnit(
                  firstValue(
                    geometry,
                    ['effectiveDepthMm.punching', 'effectiveDepth.punching'],
                    EMPTY
                  ),
                  'mm',
                  0
                )}`,
              ],
            ])}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-flexure" data-calculation-step="6">
          <b class="calc-story-number">06</b><div>
            <header><span>กำลังดัดและเหล็กเสริม</span>
              <h5>Mu / φMn และ As,required / As,provided แยกทิศ A–B</h5></header>
            <div class="calc-story-direction-grid">
              <section><h6>ทิศ A</h6>${factList([
                [
                  'Mu / φMn',
                  `${formattedValueWithUnit(
                    firstValue(flexureA, ['muKNmPerM'], EMPTY),
                    'kN·m/m',
                    2
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureA, ['phiMnKNmPerM'], EMPTY),
                    'kN·m/m',
                    2
                  )}`,
                ],
                [
                  'As,strength / As,min',
                  `${formattedValueWithUnit(
                    firstValue(flexureA, ['asStrengthMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureA, ['asMinimumMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )}`,
                ],
                [
                  'As,required / As,provided',
                  `${formattedValueWithUnit(
                    firstValue(flexureA, ['asRequiredMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureA, ['asProvidedMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )}`,
                ],
                [
                  'เหล็กที่เลือก / ระยะเรียง',
                  `${metricText(reinforcementSummary(barA, 'BAR-A'))} @ ${formattedValueWithUnit(
                    firstValue(barA, ['spacingMm', 'spacing'], EMPTY),
                    'mm',
                    1
                  )}`,
                ],
              ])}
                ${conciseCheck('flexure-capacity-a', 'Mu / φMn · ทิศ A')}
                ${conciseCheck('provided-steel-a', 'As,req / As,prov · ทิศ A')}</section>
              <section><h6>ทิศ B</h6>${factList([
                [
                  'Mu / φMn',
                  `${formattedValueWithUnit(
                    firstValue(flexureB, ['muKNmPerM'], EMPTY),
                    'kN·m/m',
                    2
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureB, ['phiMnKNmPerM'], EMPTY),
                    'kN·m/m',
                    2
                  )}`,
                ],
                [
                  'As,strength / As,min',
                  `${formattedValueWithUnit(
                    firstValue(flexureB, ['asStrengthMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureB, ['asMinimumMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )}`,
                ],
                [
                  'As,required / As,provided',
                  `${formattedValueWithUnit(
                    firstValue(flexureB, ['asRequiredMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )} / ${formattedValueWithUnit(
                    firstValue(flexureB, ['asProvidedMm2PerM'], EMPTY),
                    'mm²/m',
                    1
                  )}`,
                ],
                [
                  'เหล็กที่เลือก / ระยะเรียง',
                  `${metricText(reinforcementSummary(barB, 'BAR-B'))} @ ${formattedValueWithUnit(
                    firstValue(barB, ['spacingMm', 'spacing'], EMPTY),
                    'mm',
                    1
                  )}`,
                ],
              ])}
                ${conciseCheck('flexure-capacity-b', 'Mu / φMn · ทิศ B')}
                ${conciseCheck('provided-steel-b', 'As,req / As,prov · ทิศ B')}</section>
            </div>
            <div class="calc-story-equation-grid">
              ${conciseEquation(chapterEquation('flexure-a', 'SF-EQ-FLEXURE-A'))}
              ${conciseEquation(chapterEquation('flexure-b', 'SF-EQ-FLEXURE-B'))}
            </div>
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-one-way-shear"
          data-calculation-step="7">
          <b class="calc-story-number">07</b><div>
            <header><span>แรงเฉือนทางเดียว ทิศ A และ B</span>
              <h5>Critical section · Vu · governing Vc · φVc · D/C</h5></header>
            <div class="calc-story-direction-grid">
              ${[
                ['A', oneWayShearA, 'one-way-shear-a'],
                ['B', oneWayShearB, 'one-way-shear-b'],
              ]
                .map(
                  ([direction, result, id]) => `<section><h6>ทิศ ${direction}</h6>${factList([
                    [
                      'dcrit / Vu',
                      `${formattedValueWithUnit(
                        firstValue(result, ['criticalDistanceFromColumnFaceM'], EMPTY),
                        'm',
                        3
                      )} / ${formattedValueWithUnit(
                        firstValue(result, ['vuKNPerM'], EMPTY),
                        'kN/m',
                        2
                      )}`,
                    ],
                    [
                      'Vc,ρ / Vc,cap / Vc,governing',
                      `${formattedValueWithUnit(
                        firstValue(result, ['vcRhoKNPerM'], EMPTY),
                        'kN/m',
                        2
                      )} / ${formattedValueWithUnit(
                        firstValue(result, ['vcCapKNPerM'], EMPTY),
                        'kN/m',
                        2
                      )} / ${formattedValueWithUnit(
                        firstValue(result, ['governingVcKNPerM'], EMPTY),
                        'kN/m',
                        2
                      )}`,
                    ],
                    [
                      'φVc / D/C',
                      `${formattedValueWithUnit(
                        firstValue(result, ['phiVcKNPerM'], EMPTY),
                        'kN/m',
                        2
                      )} / ${formattedMetric(firstValue(result, ['utilization'], EMPTY), 3)}`,
                    ],
                  ])}${conciseCheck(id, `Vu / φVc · ทางเดียว ${direction}`)}</section>`
                )
                .join('')}
            </div>
            ${conciseEquation(
              chapterEquation('shear', 'SF-EQ-ONE-WAY-SHEAR-A')
            )}
            ${conciseEquation(
              chapterEquation('shear', 'SF-EQ-ONE-WAY-SHEAR-B')
            )}
          </div>
        </article>
        <article class="calc-story-card" id="sf-story-punching" data-calculation-step="8">
          <b class="calc-story-number">08</b><div>
            <header><span>แรงเฉือนทะลุภายในรอบเสากลาง</span>
              <h5>bo · area inside perimeter · vc candidates · Vu / φVc · D/C</h5></header>
            ${factList([
              [
                'bo / พื้นที่ภายในแนววิกฤต',
                `${formattedValueWithUnit(
                  firstValue(punching, ['perimeterM', 'criticalPerimeter'], EMPTY),
                  'm',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(punching, ['insideAreaM2'], EMPTY),
                  'm²',
                  4
                )}`,
              ],
              [
                'vc1 / vc2 / vc3 / vc,governing',
                `${formattedValueWithUnit(
                  firstValue(punching, ['vcCandidatesMPa.vc1'], EMPTY),
                  'MPa',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(punching, ['vcCandidatesMPa.vc2'], EMPTY),
                  'MPa',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(punching, ['vcCandidatesMPa.vc3'], EMPTY),
                  'MPa',
                  3
                )} / ${formattedValueWithUnit(
                  firstValue(punching, ['governingVcStressMPa'], EMPTY),
                  'MPa',
                  3
                )}`,
              ],
              [
                'Vu / φVc / D/C',
                `${formattedValueWithUnit(
                  firstValue(punching, ['vuKN'], EMPTY),
                  'kN',
                  2
                )} / ${formattedValueWithUnit(
                  firstValue(punching, ['phiVcKN'], EMPTY),
                  'kN',
                  2
                )} / ${formattedMetric(firstValue(punching, ['utilization'], EMPTY), 3)}`,
              ],
            ])}
            ${conciseCheck('punching-shear', 'Vu / φVc · เฉือนทะลุ')}
            ${conciseEquation(
              chapterEquation('shear', 'SF-EQ-INTERIOR-PUNCHING-SHEAR')
            )}
          </div>
        </article>
        <article class="calc-story-card calc-story-card--trace" id="sf-story-trace"
          data-calculation-step="9">
          <b class="calc-story-number">09</b><div>
            <header><span>สรุปผล เหล็กที่เลือก และสายตรวจสอบ</span>
              <h5>Evaluated results · selected reinforcement · profile/source trace</h5></header>
            <section class="calc-result-summary" aria-label="สรุปผลตรวจฐานรากแผ่">
              <header>
                <div><span>สรุปผลตรวจฐานรากแผ่</span><h4>${escapeHtml(evaluatedVerdict)}</h4>
                  <p>ประเมินแล้ว ${evaluatedChecks.length} · ผ่าน ${passCount} · ไม่ผ่าน ${failCount}</p></div>
                <strong class="${evaluatedBadge.className}">${evaluatedBadge.label}</strong>
              </header>
              <div class="calc-result-table-wrap">
                <table class="calc-result-table">
                  <thead><tr><th>รายการสำคัญ</th><th>ค่าความต้องการ</th>
                    <th>ค่าความสามารถ</th><th>D/C</th><th>ผลตรวจ</th></tr></thead>
                  <tbody>${resultChecks.map(summaryCheckRow).join('')}</tbody>
                </table>
              </div>
            </section>
            ${factList([
              [
                'เหล็กเสริมล่าง ทิศ A',
                `${metricText(reinforcementSummary(barA, 'BAR-A'))} @ ${formattedValueWithUnit(
                  firstValue(barA, ['spacingMm', 'spacing'], EMPTY),
                  'mm',
                  1
                )}`,
              ],
              [
                'เหล็กเสริมล่าง ทิศ B',
                `${metricText(reinforcementSummary(barB, 'BAR-B'))} @ ${formattedValueWithUnit(
                  firstValue(barB, ['spacingMm', 'spacing'], EMPTY),
                  'mm',
                  1
                )}`,
              ],
              ['โพรไฟล์ / แหล่งมาตรฐาน', `${metricText(profileDisplayLabel)} · ${metricText(profileId)}`],
            ])}
            <ul class="calc-scope-list">
              <li>ผลรุ่นนี้ครอบคลุม bearing, flexure, one-way shear และ punching
                สำหรับฐานรากแผ่เสากลางตามโปรไฟล์ที่เลือก</li>
              <li>ข้อมูลปฐพีกลศาสตร์และเสถียรภาพของโครงการเป็นหลักฐานแยกจากผลที่ประเมินนี้</li>
              <li>สถานะเอกสารยังเป็น REVIEW จนกว่าการอนุมัติโครงการจะครบถ้วน</li>
            </ul>
            <p class="calc-story-trace-line">Calculation Snapshot ·
              <strong>${metricText(envelope.snapshotId)}</strong> · Profile
              <strong>${metricText(profileId)}</strong> · Calculation fingerprint
              <strong>${metricText(traceValue(envelope, 'calculationFingerprint'))}</strong></p>
          </div>
        </article>
      </div>
    </section>
    <details class="calc-evidence-vault">
      <summary><div><span>หลักฐานการคำนวณฉบับเต็ม</span>
        <b>เปิดทะเบียนสมการ แหล่งอ้างอิง และ Trace</b>
        <small>${equations.length} สมการ · ${checks.length} รายการตรวจ · 10 บท</small></div>
        <strong aria-hidden="true">เปิดดู</strong></summary>
      <div class="calc-evidence-vault__body">
        <nav class="calc-index" aria-label="สารบัญรายการคำนวณ">
          ${chapters
            .map(
              (chapter) => `<a href="#${escapeAttribute(chapter.id)}"><b>${chapter.number}</b>
                <span>${escapeHtml(chapter.label)}</span></a>`
            )
            .join('')}
        </nav>
        <div class="report-steps calc-chapters">
          ${renderCalculationChapter({
            number: '01',
            id: 'sf-calc-design-basis',
            eyebrow: 'Design basis',
            title: 'ข้อมูลโครงการและฐานการออกแบบ',
            status: 'CALCULATION PROFILE',
            body: `<div class="sf-calc-basis"><dl>
              <div><dt>โครงการ / ชิ้นส่วน</dt><dd>${metricText(
                projectField(project, 'projectName', 'name')
              )} · ${metricText(projectField(project, 'memberMark', 'mark'))}</dd></div>
              <div><dt>โพรไฟล์</dt><dd>${metricText(
                firstValue(designBasis, ['profileId', 'profile'], EMPTY)
              )}</dd></div>
              <div><dt>มาตรฐานกำลังชิ้นส่วน / ฉบับ</dt><dd>${metricText(
                firstValue(
                  designBasis,
                  [
                    'memberStandard.displayLabel',
                    'resolvedProfile.memberStandard.displayLabel',
                    'memberStrengthStandard',
                    'standard',
                    'governingStandard',
                  ],
                  EMPTY
                )
              )} · ${metricText(
                firstValue(
                  designBasis,
                  ['memberStandard.edition', 'resolvedProfile.memberStandard.edition'],
                  EMPTY
                )
              )}</dd></div>
              <div><dt>มาตรฐานชุดน้ำหนัก / ฉบับ</dt><dd>${metricText(
                firstValue(
                  designBasis,
                  [
                    'loadStandard.displayLabel',
                    'resolvedProfile.loadStandard.displayLabel',
                    'loadCombination.standard',
                  ],
                  EMPTY
                )
              )} · ${metricText(
                firstValue(
                  designBasis,
                  [
                    'loadStandard.edition',
                    'resolvedProfile.loadStandard.edition',
                    'loadCombination.edition',
                  ],
                  EMPTY
                )
              )}</dd></div>
              <div><dt>ข้อกำหนด / สมการชุดน้ำหนัก</dt><dd>${metricText(
                firstValue(designBasis, ['loadCombination.clause'], EMPTY)
              )} · ${metricText(
                firstValue(
                  designBasis,
                  ['loadCombination.equation', 'loadCombination.label'],
                  EMPTY
                )
              )}</dd></div>
              <div><dt>สมการมาตรฐานต้นฉบับ</dt><dd>${metricText(
                firstValue(designBasis, ['loadCombination.normativeEquation'], EMPTY)
              )}</dd></div>
              <div><dt>ขอบเขตสมการที่ใช้</dt><dd>${metricText(
                firstValue(designBasis, ['loadCombination.applicability'], EMPTY)
              )}</dd></div>
            </dl></div>`,
          })}
          ${renderCalculationChapter({
            number: '02',
            id: 'sf-calc-bearing',
            eyebrow: 'Service bearing',
            title: 'น้ำหนักใช้งาน แรงดันดิน และเงื่อนไขสัมผัส',
            body: equationBody('bearing'),
          })}
          ${renderCalculationChapter({
            number: '03',
            id: 'sf-calc-strength-load',
            eyebrow: 'Strength load',
            title: 'ชุดรวมน้ำหนัก แรงดันสุทธิ และเรขาคณิตกำลัง',
            body: equationBody('strength'),
          })}
          ${renderCalculationChapter({
            number: '04',
            id: 'sf-calc-flexure-a',
            eyebrow: 'Flexure A',
            title: 'กำลังดัดและเหล็กเสริมทิศ A',
            body: equationBody('flexure-a'),
          })}
          ${renderCalculationChapter({
            number: '05',
            id: 'sf-calc-flexure-b',
            eyebrow: 'Flexure B',
            title: 'กำลังดัดและเหล็กเสริมทิศ B',
            body: equationBody('flexure-b'),
          })}
          ${renderCalculationChapter({
            number: '06',
            id: 'sf-calc-shear',
            eyebrow: 'Shear',
            title: 'เฉือนทางเดียวและเฉือนทะลุ',
            body: equationBody('shear'),
          })}
          ${renderCalculationChapter({
            number: '07',
            id: 'sf-calc-detailing',
            eyebrow: 'Rebar / Bar Cut',
            title: 'รูปทรงเหล็ก ความยาวตัด และปริมาณ',
            status: NOT_RELEASED_BBS,
            body: equationBody('detailing'),
          })}
          ${renderCalculationChapter({
            number: '08',
            id: 'sf-calc-checks',
            eyebrow: 'Check register',
            title: 'ค่าความต้องการ ความสามารถ D/C และสถานะ',
            body: `<div class="sf-calc-checks">${renderChecksTable(
              checks,
              'รายการตรวจในรายการคำนวณ'
            )}</div>`,
          })}
          ${renderCalculationChapter({
            number: '09',
            id: 'sf-calc-holds',
            eyebrow: 'Limitations / HOLD',
            title: 'ข้อจำกัดและรายการที่ยังไม่ประเมิน',
            status: NOT_EVALUATED,
            body: `<div class="sf-calc-limitations">${equationBody('holds')}
              ${renderLimitations(limitations)}</div>`,
          })}
          ${renderCalculationChapter({
            number: '10',
            id: 'sf-calc-trace',
            eyebrow: 'Immutable trace',
            title: 'แหล่งอ้างอิงและลายนิ้วมือ Snapshot',
            body: snapshotTrace(envelope),
          })}
        </div>
      </div>
    </details>
  </section>`
}

const takeoffItems = (takeoff) => {
  const direct = firstValue(takeoff, ['items', 'lines', 'rows'], null)
  if (direct) return toList(direct)
  return toList(takeoff).filter((item) => item && typeof item === 'object')
}

const renderRebarSchedule = (reinforcement, barCut, takeoff) => {
  const rows = ['A', 'B'].map((direction) => {
    const bar = reinforcementDirection(reinforcement, direction)
    const cut = barCutDirection(barCut, direction)
    const mark = reinforcementMark(bar, `BAR-${direction}`)
    return `<tr data-select-mark="${escapeAttribute(mark)}">
      <th scope="row">${metricText(mark)}</th>
      <td>${metricText(firstValue(bar, ['direction', 'axis'], direction))}</td>
      <td>${metricText(reinforcementLayerLabel(bar) || EMPTY)}</td>
      <td>${metricText(firstValue(bar, ['count', 'barCount', 'quantity'], EMPTY))}</td>
      <td>${metricText(reinforcementDesignation(bar))}</td>
      <td${exactValueAttribute(
        firstValue(bar, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY)
      )}>${formattedValueWithUnit(
        firstValue(bar, ['spacingMm', 'spacing', 'spacingDisplay'], EMPTY),
        'mm',
        1
      )}</td>
      <td${exactValueAttribute(
        firstValue(cut, ['centerlineLengthMm', 'cutLength', 'centerlineLength', 'Lcl'], EMPTY)
      )}>${formattedValueWithUnit(
        firstValue(cut, ['centerlineLengthMm', 'cutLength', 'centerlineLength', 'Lcl'], EMPTY),
        'mm',
        1
      )}</td>
      <td>${NOT_RELEASED_BBS}</td>
    </tr>`
  })
  return `<table class="sf-rebar-schedule">
    <caption>ตารางเหล็กเสริม (Rebar schedule) · ${NOT_RELEASED_BBS}</caption>
    <thead><tr><th>รหัสเหล็ก</th><th>ทิศ</th><th>ชั้น</th><th>จำนวน</th><th>ขนาด</th>
      <th>ระยะ</th><th>Lcl</th><th>สถานะ</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <dl class="sf-takeoff-list">${takeoffItems(takeoff)
    .map((item) => {
      const explicit = firstValue(item, ['display', 'value', 'quantity', 'total'], null)
      const derived =
        explicit ??
        `${rawMetricText(firstValue(item, ['count'], EMPTY))} เส้น · DB${rawMetricText(
          firstValue(item, ['diameterMm'], EMPTY)
        )} · Lcl ${rawFormattedValueWithUnit(
          firstValue(item, ['eachCenterlineLengthM'], EMPTY),
          'm',
          3
        )} · รวม ${rawFormattedValueWithUnit(
          firstValue(item, ['totalCenterlineLengthM'], EMPTY),
          'm',
          3
        )}`
      return `<div><dt>${metricText(firstValue(item, ['label', 'name', 'mark', 'id'], EMPTY))}</dt>
      <dd>${metricText(derived)}</dd></div>`
    })
    .join('')}</dl>`
}

const renderDrawingTitleBlock = (envelope, project, sheetId, title) => `<footer class="sf-drawing-titleblock">
  <div><b>นายช่างใหญ่ Civil Apps</b><span>${escapeHtml(title)}</span></div>
  <dl>
    <dt>โครงการ</dt><dd>${metricText(projectField(project, 'projectName', 'name'))}</dd>
    <dt>ชิ้นส่วน</dt><dd>${metricText(projectField(project, 'memberMark', 'mark'))}</dd>
    <dt>ชุดผลคำนวณ</dt><dd>${metricText(envelope.snapshotId)}</dd>
    <dt>แผ่น</dt><dd>${escapeHtml(sheetId)}</dd>
    <dt>มาตราส่วน</dt><dd>NTS · ไม่กำหนดมาตราส่วน</dd>
  </dl>
  <strong>${NOT_FOR_CONSTRUCTION}</strong>
</footer>`

const renderDrawingFromEnvelope = (drawingEnvelope, takeoffEnvelope) => {
  const data = drawingEnvelope.data
  const takeoffData = takeoffEnvelope.data
  const project = firstValue(data, ['project'], firstValue(takeoffData, ['project'], {}))
  const geometry = firstValue(data, ['geometry'], {})
  const reinforcement = firstValue(data, ['reinforcement'], {})
  const barCut = firstValue(data, ['barCut'], {})
  const takeoff = firstValue(data, ['takeoff'], firstValue(takeoffData, ['takeoff'], {}))
  return `<section class="sf-snapshot-surface sf-snapshot-surface--drawing drawing-pack" lang="th"
    ${surfaceAttributes(drawingEnvelope, 'drawing')} data-authorization="not-for-construction"
    data-bbs-status="not-released" aria-label="ชุดแบบฐานรากแผ่ SF-01 ถึง SF-03">
    <header class="sf-surface-heading">
      <div><span>ชุดแบบ (Drawing Pack)</span><h3>SF-01 / SF-02 / SF-03</h3>
        <p>ทุกแผ่นอ่านรูปทรง เหล็กเสริม แบบตัดเหล็ก และรายการปริมาณจากชุดผลคำนวณเดียวกัน</p></div>
      <div><strong class="sf-status-token is-review">${NOT_FOR_CONSTRUCTION}</strong>
        <strong class="sf-status-token is-review">${NOT_RELEASED_BBS}</strong></div>
    </header>
    <div class="drawing-grid sf-drawing-grid">
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-01"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-01</span><h4>แปลนฐานราก / เหล็กเสริม</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${NOT_FOR_CONSTRUCTION}</strong></header>
        ${renderPlanSvg(geometry, reinforcement, 'SF-01 แปลนฐานรากและเหล็กเสริม')}
        ${renderDrawingTitleBlock(drawingEnvelope, project, 'SF-01', 'แปลนฐานรากและเหล็กเสริม')}
      </article>
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-02"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-02</span><h4>รูปตัด X-X · ทิศ A / ตารางเหล็กเสริม</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${NOT_FOR_CONSTRUCTION}</strong></header>
        ${renderSectionSvg(geometry, reinforcement, 'SF-02 รูปตัดฐานรากและชั้นเหล็ก')}
        ${renderRebarSchedule(reinforcement, barCut, takeoff)}
        ${renderDrawingTitleBlock(drawingEnvelope, project, 'SF-02', 'รูปตัดและตารางเหล็ก')}
      </article>
      <article class="drawing-sheet sf-drawing-sheet" data-sheet-id="SF-03"
        data-authorization="not-for-construction" data-scale="NTS">
        <header><span>SF-03</span><h4>แบบตัดเหล็กอ้างอิง / รายการปริมาณ</h4>
          <small class="sf-drawing-scale">NTS · ไม่กำหนดมาตราส่วน</small>
          <strong>${NOT_RELEASED_BBS}</strong></header>
        <div class="barcut-forms sf-barcut-forms">
          ${renderBarCutSvg(barCut, reinforcement, 'A', 'H-01')}
          ${renderBarCutSvg(barCut, reinforcement, 'B', 'H-02')}
        </div>
        ${renderDrawingTitleBlock(drawingEnvelope, project, 'SF-03', 'แบบตัดเหล็กอ้างอิงและ Take-off')}
      </article>
    </div>
    <p class="sf-construction-warning"><strong>ห้ามใช้เพื่อการก่อสร้าง · ${NOT_FOR_CONSTRUCTION}</strong>
      <span>${NOT_RELEASED_BBS} · ระยะพัฒนา การยึดเหนี่ยว เหล็กเดือย ค่าคลาดเคลื่อน
        และการอนุมัติผลิตไม่รวมในผลคำนวณรุ่นนี้</span>
    </p>
  </section>`
}

const selectSurfaceEnvelopes = (snapshot) => {
  const selected = {
    summary: requireEnvelope(selectSpreadFootingSummaryData(snapshot), 'selectSpreadFootingSummaryData'),
    dc: requireEnvelope(selectSpreadFootingChecksData(snapshot), 'selectSpreadFootingChecksData'),
    analysis: requireEnvelope(selectSpreadFootingDiagramData(snapshot), 'selectSpreadFootingDiagramData'),
    section: requireEnvelope(selectSpreadFootingSectionData(snapshot), 'selectSpreadFootingSectionData'),
    three: requireEnvelope(selectSpreadFooting3DData(snapshot), 'selectSpreadFooting3DData'),
    report: requireEnvelope(selectSpreadFootingReportData(snapshot), 'selectSpreadFootingReportData'),
    calc: requireEnvelope(
      selectSpreadFootingCalculationBookData(snapshot),
      'selectSpreadFootingCalculationBookData'
    ),
    drawing: requireEnvelope(selectSpreadFootingDrawingData(snapshot), 'selectSpreadFootingDrawingData'),
    takeoff: requireEnvelope(selectSpreadFootingTakeoffData(snapshot), 'selectSpreadFootingTakeoffData'),
  }
  const base = selected.summary
  for (const [label, envelope] of Object.entries(selected)) {
    assertProjectionParity(base, envelope, label)
  }
  return selected
}

const renderSurfaceMarkupFromSelected = (selected, displayOptions = {}) => ({
  summary: publicResultCopy(renderSummaryFromEnvelope(selected.summary)),
  dc: publicResultCopy(renderChecksFromEnvelope(selected.dc, selected.summary)),
  analysis: publicResultCopy(renderAnalysisFromEnvelope(selected.analysis, displayOptions)),
  section: publicResultCopy(renderSectionFromEnvelope(selected.section)),
  three: publicResultCopy(renderThreeFromEnvelope(selected.three)),
  report: publicResultCopy(renderReportFromEnvelope(selected.report)),
  calc: publicResultCopy(renderCalculationBookFromEnvelope(selected.calc)),
  drawing: publicResultCopy(renderDrawingFromEnvelope(selected.drawing, selected.takeoff)),
})

const findCheck = (checks, id) =>
  checks.find((check) => checkId(check) === id) || null

const conciseRatio = (check, fallback = '—') => {
  const ratio = numericValue(checkRatio(check))
  return ratio === null ? fallback : formattedMetric(ratio, 3)
}

const pressureTonnesPerSquareMeter = (value) => {
  const kPa = numericValue(value)
  return kPa === null ? null : kPa / 9.80665
}

const renderParityMetricStrip = (selected) => {
  const summary = selected.summary.data
  const checks = normalizeChecks(selected.dc.data)
  const geometry = firstValue(summary, ['geometry'], {})
  const bearing = firstValue(summary, ['bearing'], {})
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const area = numericValue(footingB) !== null && numericValue(footingL) !== null
    ? numericValue(footingB) * numericValue(footingL)
    : null
  const qMaxKPa = firstValue(bearing, ['qMaxKPa', 'qMax', 'qmax'], EMPTY)
  const sbcKPa = firstValue(bearing, ['sbcGrossKPa', 'sbc', 'allowable'], EMPTY)
  const sbcSource = firstValue(bearing, ['sbcSource', 'capacitySource'], EMPTY)
  const bearingCheck = findCheck(checks, 'bearing-capacity')
  const flexureA = findCheck(checks, 'flexure-capacity-a')
  const flexureB = findCheck(checks, 'flexure-capacity-b')
  const shearA = findCheck(checks, 'one-way-shear-a')
  const shearB = findCheck(checks, 'one-way-shear-b')
  const governing = firstValue(summary, ['governingCheck'], bearingCheck || {})
  return `<article class="sf-metric-card">
      <span>รูปทรง · A × B × t</span>
      <strong>${formattedNumber(footingB, 2)} × ${formattedNumber(footingL, 2)} <small>m</small></strong>
      <p>พื้นที่ ${formattedNumber(area, 2)} m² · หนา ${formattedNumber(footingH, 2)} m</p>
    </article>
    <article class="sf-metric-card">
      <span>แรงดันดิน · q<sub>service,max</sub> / SBC</span>
      <strong>${formattedNumber(pressureTonnesPerSquareMeter(qMaxKPa), 2)} / ${formattedNumber(
        pressureTonnesPerSquareMeter(sbcKPa),
        2
      )}</strong>
      <p>D/C ${conciseRatio(bearingCheck)} · ${displayStatus(
        bearingCheck
      )}<small class="sf-bearing-source">ที่มา SBC: ${metricText(sbcSource)}</small></p>
    </article>
    <article class="sf-metric-card">
      <span>หลักฐานด้านกำลัง · D/C</span>
      <strong>ดัด ${conciseRatio(flexureA)} / ${conciseRatio(flexureB)}</strong>
      <p>เฉือนทางเดียว ${conciseRatio(shearA)} / ${conciseRatio(shearB)} · ดูรายละเอียดในแท็บตรวจ D/C</p>
    </article>
    <article class="sf-metric-card metric-strip__review">
      <span>รายการควบคุม</span>
      <strong>${metricText(checkLabel(governing))}</strong>
      <p>D/C ${conciseRatio(governing, 'ไม่ใช้ค่าเชิงตัวเลข')} · ${displayStatus(governing)}
        · อ่านจาก Calculation Snapshot</p>
    </article>`
}

const renderParityGoverningList = (selected) => {
  const checks = normalizeChecks(selected.dc.data)
  const rows = [
    ['bearing-capacity', 'แรงดันดินใช้งาน'],
    ['full-contact-qmin', 'สัมผัสดินเต็มพื้นที่'],
    ['flexure-capacity-a', 'ดัดทิศ A'],
    ['flexure-capacity-b', 'ดัดทิศ B'],
    ['one-way-shear-a', 'เฉือนทางเดียวทิศ A'],
    ['one-way-shear-b', 'เฉือนทางเดียวทิศ B'],
    ['punching-shear', 'เฉือนทะลุ · เสากลาง'],
  ]
    .map(([id, label]) => {
      const check = findCheck(checks, id)
      if (!isExplicitlyEvaluated(check)) return null
      const status = displayStatus(check)
      return {
        id,
        label,
        value: conciseRatio(check, '—'),
        status,
        className: statusClass(status),
      }
    })
    .filter(Boolean)
  return rows
    .map(
      (row) => `<li class="${escapeAttribute(row.className)}" data-check-id="${escapeAttribute(row.id)}">
        <b>${metricText(row.value)}</b><span>${escapeHtml(row.label)}</span><em>${metricText(row.status)}</em>
      </li>`
    )
    .join('')
}

const renderParityCoverage = (selected) => {
  const checks = normalizeChecks(selected.dc.data)
  const evaluated = checks.filter(isExplicitlyEvaluated)
  const passing = evaluated.filter((check) => normalizedStatus(firstValue(check, ['status'], '')) === 'PASS')
  const failing = evaluated.filter((check) => normalizedStatus(firstValue(check, ['status'], '')) === 'FAIL')
  return `<div class="panel-title">
      <div><span>ขอบเขตชุดผลคำนวณ</span>
        <h3>ผลทุกแท็บอ่านจาก Calculation Snapshot ชุดเดียว</h3></div>
      <span class="reference-badge reference-badge--ready">SNAPSHOT READY</span>
    </div>
    <div class="coverage-grid" data-snapshot-id="${escapeAttribute(selected.summary.snapshotId)}">
      <div><b>01</b><span>ประเมินแล้ว ${evaluated.length} รายการ · PASS ${passing.length} · FAIL ${failing.length}</span></div>
      <div><b>02</b><span>ผลหลักแสดงเฉพาะรายการที่คำนวณได้เป็น OK หรือ FAIL</span></div>
      <div><b>03</b><span>หน้าจอหลักแสดงอัตราส่วนแบบย่อ รายการสมการฉบับเต็มอยู่ในรายการคำนวณ</span></div>
      <div><b>04</b><span>A4 ชุดแบบ และ Bar Cut อ่านข้อมูลจาก Snapshot เดียวกัน</span></div>
    </div>`
}

const renderSectionMeta = (selected) => {
  const section = selected.section.data
  const summary = selected.summary.data
  const checks = normalizeChecks(selected.dc.data)
  const geometry = firstValue(section, ['geometry'], {})
  const reinforcement = firstValue(section, ['reinforcement'], {})
  const barCut = firstValue(section, ['barCut'], {})
  const bearing = firstValue(summary, ['bearing'], {})
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const cutA = barCutDirection(barCut, 'A')
  const cutB = barCutDirection(barCut, 'B')
  const footingB = geometryDimension(geometry, 'footing', 'width')
  const footingL = geometryDimension(geometry, 'footing', 'length')
  const footingH = geometryDimension(geometry, 'footing', 'thickness')
  const coverM = firstValue(footingGeometry(geometry), ['coverM', 'cover'], EMPTY)
  const dA = firstValue(barA, ['effectiveDepthMm'], firstValue(geometry, ['effectiveDepthMm.A'], EMPTY))
  const dB = firstValue(barB, ['effectiveDepthMm'], firstValue(geometry, ['effectiveDepthMm.B'], EMPTY))
  const qMin = pressureTonnesPerSquareMeter(firstValue(bearing, ['qMinKPa', 'qMin'], EMPTY))
  const qMax = pressureTonnesPerSquareMeter(firstValue(bearing, ['qMaxKPa', 'qMax'], EMPTY))
  const flexureA = findCheck(checks, 'flexure-capacity-a')
  const flexureB = findCheck(checks, 'flexure-capacity-b')
  const shearA = findCheck(checks, 'one-way-shear-a')
  const shearB = findCheck(checks, 'one-way-shear-b')
  const lclA = firstValue(cutA, ['centerlineLengthMm', 'cutLength', 'Lcl'], EMPTY)
  const lclB = firstValue(cutB, ['centerlineLengthMm', 'cutLength', 'Lcl'], EMPTY)
  return `<div class="panel-title">
      <div><span>การเชื่อมโยงรูปตัด</span><h3>ความสัมพันธ์รูปตัดกับ D/C, 3D และแบบ</h3></div>
      <span class="reference-badge">Calculation Snapshot เดียว</span>
    </div>
    <div class="section-meta">
      <div class="section-meta-card"><span>A, B, t</span><strong>${formattedNumber(
        footingB,
        2
      )} × ${formattedNumber(footingL, 2)} × ${formattedNumber(footingH, 2)} m</strong>
        <small>รูปทรงเดียวกับแปลน 3D A4 และชุดแบบ</small></div>
      <div class="section-meta-card"><span>ระยะหุ้ม / ขนาดเหล็ก</span><strong>${formattedNumber(
        numericValue(coverM) === null ? null : numericValue(coverM) * 1000,
        0
      )} mm / ${reinforcementDesignation(barA)} + ${reinforcementDesignation(barB)}</strong>
        <small>การรับรองความทนทานตามโครงการไม่รวมในผลคำนวณรุ่นนี้</small></div>
      <div class="section-meta-card"><span>dA / dB</span><strong>${formattedNumber(
        dA,
        0
      )} / ${formattedNumber(dB, 0)} mm</strong><small>อ่านจากเรขาคณิตชั้นเหล็กใน Snapshot</small></div>
      <div class="section-meta-card"><span>D/C สรุปหลัก</span><strong>ดัด ${conciseRatio(
        flexureA
      )}/${conciseRatio(flexureB)} · เฉือน ${conciseRatio(shearA)}/${conciseRatio(
        shearB
      )}</strong><small>สมการและการแทนค่าอยู่ในรายการคำนวณเท่านั้น</small></div>
      <div class="section-meta-card"><span>แรงดันใช้งาน</span><strong>qmin ${formattedNumber(
        qMin,
        2
      )} · qmax ${formattedNumber(qMax, 2)} t/m²</strong><small>เชื่อมโยงถึงสนามแรงดันใน 3D</small></div>
      <div class="section-meta-card"><span>แบบตัดเหล็กตามแนวแกน</span><strong>${
        metricText(reinforcementMark(barA, 'BAR-A'))
      } ${formattedNumber(lclA, 0)} · ${metricText(reinforcementMark(barB, 'BAR-B'))} ${formattedNumber(
        lclB,
        0
      )} mm/เส้น</strong><small>${NOT_RELEASED_BBS} · ldh และการผลิตไม่รวมในรุ่นนี้</small></div>
    </div>`
}

const buildModelEvidence = (selected) => {
  const section = selected.section.data
  const summary = selected.summary.data
  const project = firstValue(summary, ['project'], {})
  const memberMark = rawMetricText(
    projectField(project, 'memberMark', 'mark', 'memberId'),
    'F'
  )
  const dowelMark = `${memberMark}-D`
  const checks = normalizeChecks(selected.dc.data)
  const geometry = firstValue(section, ['geometry'], {})
  const reinforcement = firstValue(section, ['reinforcement'], {})
  const barCut = firstValue(section, ['barCut'], {})
  const bearing = firstValue(summary, ['bearing'], {})
  const sbcSource = firstValue(bearing, ['sbcSource', 'capacitySource'], EMPTY)
  const barA = reinforcementDirection(reinforcement, 'A')
  const barB = reinforcementDirection(reinforcement, 'B')
  const cutA = barCutDirection(barCut, 'A')
  const cutB = barCutDirection(barCut, 'B')
  const evidenceForBar = (direction, bar, cut) => {
    const presentation = directionPresentation(direction)
    const mark = rawMetricText(reinforcementMark(bar, `BAR-${direction}`))
    const flexure = findCheck(checks, `flexure-capacity-${direction.toLowerCase()}`)
    const shear = findCheck(checks, `one-way-shear-${direction.toLowerCase()}`)
    const count = firstValue(bar, ['count', 'barCount'], EMPTY)
    const spacing = firstValue(bar, ['spacingMm'], EMPTY)
    const depth = firstValue(bar, ['effectiveDepthMm'], EMPTY)
    const cover = firstValue(footingGeometry(geometry), ['coverM', 'cover'], EMPTY)
    const tail = firstValue(cut, ['verticalTangentMm', 'verticalTail', 'tail', 'Bcl'], EMPTY)
    const lcl = firstValue(cut, ['centerlineLengthMm', 'cutLength', 'Lcl'], EMPTY)
    return {
      mark,
      controlLabel: `${mark} · ${presentation.direction}/${presentation.axis}`,
      title: `${mark} · ${presentation.direction}/${presentation.axis} ${presentation.axisSymbol} · ${presentation.layer}`,
      layer: `${presentation.orientation}ตามแกน ${presentation.axis} · ${presentation.layer}`,
      detail: `${rawMetricText(count)}-${reinforcementDesignation(bar)} · ระยะ ${formattedNumber(
        spacing,
        1
      )} mm · ขาตรง ${formattedNumber(tail, 0)} mm · Lcl ${formattedNumber(lcl, 0)} mm`,
      depth: `ระยะหุ้ม ${formattedNumber(
        numericValue(cover) === null ? null : numericValue(cover) * 1000,
        0
      )} mm · d${direction} ${formattedNumber(depth, 0)} mm`,
      check: `ดัด D/C ${conciseRatio(flexure)} · เฉือน D/C ${conciseRatio(shear)}`,
      trace: `${selected.summary.snapshotId} · ${checkId(flexure)} · ${checkId(shear)}`,
      auth: 'SNAPSHOT CURRENT · รูปทรงเชิงทฤษฎี',
    }
  }
  const pressureCheck = findCheck(checks, 'bearing-capacity')
  const punchingCheck = findCheck(checks, 'punching-shear')
  const qMin = pressureTonnesPerSquareMeter(firstValue(bearing, ['qMinKPa', 'qMin'], EMPTY))
  const qMax = pressureTonnesPerSquareMeter(firstValue(bearing, ['qMaxKPa', 'qMax'], EMPTY))
  return {
    barA: evidenceForBar('A', barA, cutA),
    barB: evidenceForBar('B', barB, cutB),
    dowel: {
      mark: dowelMark,
      title: `${dowelMark} · ขอบเขตรอยต่อเสากับฐานราก`,
      layer: 'รอยต่อเสากับฐานรากเท่านั้น',
      detail: 'ขนาด จำนวน เหล็กปลอก ระยะฝัง และระยะทาบยังไม่ประเมิน',
      depth: 'การถ่ายแรงและระยะยึดเหนี่ยวไม่รวมในผลคำนวณรุ่นนี้',
      check: NOT_EVALUATED,
      trace: `${selected.summary.snapshotId} · dowels · column-footing-transfer`,
      auth: `${NOT_EVALUATED} · รายละเอียดรอยต่อไม่รวมในรุ่นนี้`,
    },
    critical: {
      mark: 'PUNCH',
      title: 'PUNCH · แนววิกฤตเฉือนทะลุ',
      layer: 'แนวรอบวิกฤตจากเรขาคณิต Snapshot',
      detail: `D/C ${conciseRatio(punchingCheck)} · ${displayStatus(punchingCheck)}`,
      depth: 'ใช้ d สำหรับเฉือนทะลุจาก Snapshot',
      check: `${checkLabel(punchingCheck)} · D/C ${conciseRatio(punchingCheck)}`,
      trace: `${selected.summary.snapshotId} · ${checkId(punchingCheck)}`,
      auth: 'SNAPSHOT CURRENT · ผลตรวจเฉือนทะลุ',
    },
    pressure: {
      mark: 'SOIL',
      title: 'ดิน · สนามแรงดันดินจาก Calculation Snapshot',
      layer: 'แรงดันใช้งานที่สี่มุม',
      detail: `qmin ${formattedNumber(qMin, 2)} · qmax ${formattedNumber(qMax, 2)} t/m²`,
      depth: 'สนามแรงดันอ่านจากชุดข้อมูล 3D เดียวกับ Summary',
      check: `D/C ${conciseRatio(pressureCheck)} · ${displayStatus(
        pressureCheck
      )} · ที่มา SBC: ${rawMetricText(sbcSource)}`,
      trace: `${selected.summary.snapshotId} · ${checkId(pressureCheck)}`,
      auth: 'SNAPSHOT CURRENT · ผลตรวจแรงดันดิน',
    },
  }
}

const hydrationFragment = (surface, selector, take = 'outer') => ({
  surface,
  selector,
  take,
})

const buildHydrationPanels = (selected) => publicResultCopyDeep({
  summary: {
    regions: [
      { slot: 'summary-metrics', html: renderParityMetricStrip(selected) },
      {
        slot: 'summary-bearing-fallback',
        mode: 'replace',
        fragments: [hydrationFragment('summary', '.summary-bearing-isometric')],
      },
      { slot: 'summary-governing', html: renderParityGoverningList(selected) },
      {
        slot: 'summary-section',
        mode: 'replace',
        fragments: [hydrationFragment('summary', '.sf-section-svg')],
      },
      { slot: 'summary-coverage', html: renderParityCoverage(selected) },
      {
        slot: 'summary-badge',
        mode: 'text',
        text: `Calculation Snapshot · ${selected.summary.snapshotId}`,
      },
      {
        slot: 'summary-bearing-badge',
        mode: 'text',
        text: '3D แบบโต้ตอบ · อ่านรูปทรงและแรงดันจาก Snapshot',
      },
      {
        slot: 'summary-bearing-readout',
        html: `<b>qmin / qmax / SBC</b><span>${formattedNumber(
          pressureTonnesPerSquareMeter(
            firstValue(selected.summary.data.bearing, ['qMinKPa', 'qMin'], EMPTY)
          ),
          2
        )} / ${formattedNumber(
          pressureTonnesPerSquareMeter(
            firstValue(selected.summary.data.bearing, ['qMaxKPa', 'qMax'], EMPTY)
          ),
          2
        )} / ${formattedNumber(
          pressureTonnesPerSquareMeter(
            firstValue(selected.summary.data.bearing, ['sbcGrossKPa', 'sbc'], EMPTY)
          ),
          2
        )} t/m²</span>`,
      },
    ],
  },
  dc: {
    regions: [
      { slot: 'dc-title', mode: 'text', text: 'รายการตรวจสอบจาก Calculation Snapshot' },
      { slot: 'dc-badge', mode: 'text', text: 'แสดง D/C และสถานะรายข้อ' },
      {
        slot: 'dc-content',
        mode: 'replace',
        fragments: [
          hydrationFragment('dc', '.sf-dc-source'),
          hydrationFragment('dc', '.dc-table-wrap'),
        ],
      },
    ],
  },
  analysis: {
    regions: [
      {
        slot: 'analysis-moment-a',
        fragments: [hydrationFragment('analysis', '.sf-analysis-diagram[data-direction="A"][data-diagram="moment"]', 'inner')],
      },
      {
        slot: 'analysis-shear-a',
        fragments: [hydrationFragment('analysis', '.sf-analysis-diagram[data-direction="A"][data-diagram="shear"]', 'inner')],
      },
      {
        slot: 'analysis-moment-b',
        fragments: [hydrationFragment('analysis', '.sf-analysis-diagram[data-direction="B"][data-diagram="moment"]', 'inner')],
      },
      {
        slot: 'analysis-shear-b',
        fragments: [hydrationFragment('analysis', '.sf-analysis-diagram[data-direction="B"][data-diagram="shear"]', 'inner')],
      },
      {
        slot: 'analysis-deflection',
        fragments: [hydrationFragment('analysis', '.sf-symbolic-settlement', 'inner')],
      },
    ],
  },
  section: {
    regions: [
      {
        slot: 'section-geometry',
        html: `<div class="panel-title"><div><span>แปลน รูปตัด และแบบตัดเหล็ก</span>
          <h3>รูปทรงและเหล็กเสริมจาก Calculation Snapshot</h3></div>
          <span class="reference-badge reference-badge--ready">SNAPSHOT CURRENT</span></div>`,
        fragments: [
          hydrationFragment('section', '.sf-section-diagrams'),
          hydrationFragment('section', '.barcut-detail-card'),
        ],
      },
      { slot: 'section-meta', html: renderSectionMeta(selected) },
    ],
  },
  three: {
    regions: [
      {
        slot: 'three-fallback',
        mode: 'replace',
        fragments: [hydrationFragment('three', '.three-bearing-isometric')],
      },
      {
        slot: 'three-badge',
        mode: 'text',
        text: `Calculation Snapshot · ${selected.three.snapshotId}`,
      },
      {
        slot: 'three-model-badge',
        mode: 'text',
        text: `CALCULATION SNAPSHOT · ${selected.three.snapshotId} · ตำแหน่งจริง · NTS`,
      },
    ],
  },
  report: {
    regions: [
      {
        slot: 'report-content',
        fragments: [hydrationFragment('report', '.sf-snapshot-surface--report')],
      },
    ],
  },
  calc: {
    regions: [
      {
        slot: 'calc-content',
        fragments: [
          hydrationFragment('calc', '.sf-snapshot-surface--calc', 'inner'),
        ],
      },
    ],
  },
  drawing: {
    regions: [
      {
        slot: 'drawing-content',
        fragments: [hydrationFragment('drawing', '.sf-drawing-grid', 'inner')],
      },
    ],
  },
})

export const renderSpreadFootingSnapshotHydrationPlan = (snapshot, displayOptions = {}) => {
  const selected = selectSurfaceEnvelopes(snapshot)
  const markup = renderSurfaceMarkupFromSelected(selected, displayOptions)
  if (Object.keys(markup).join('|') !== SURFACE_KEYS.join('|')) {
    throw new TypeError('Spread Footing renderer surface order is invalid')
  }
  const base = selected.summary
  return deepFreeze({
    snapshotId: base.snapshotId,
    payloadHash: base.payloadHash,
    fingerprint: base.fingerprint,
    calculationFingerprint: traceValue(base, 'calculationFingerprint'),
    markup,
    panels: buildHydrationPanels(selected),
    modelEvidence: publicResultCopyDeep(buildModelEvidence(selected)),
  })
}

export const renderSpreadFootingSummarySurface = (snapshot) =>
  publicResultCopy(
    renderSummaryFromEnvelope(
      requireEnvelope(selectSpreadFootingSummaryData(snapshot), 'selectSpreadFootingSummaryData')
    )
  )

export const renderSpreadFootingChecksSurface = (snapshot) => {
  const checks = requireEnvelope(
    selectSpreadFootingChecksData(snapshot),
    'selectSpreadFootingChecksData'
  )
  const summary = requireEnvelope(
    selectSpreadFootingSummaryData(snapshot),
    'selectSpreadFootingSummaryData'
  )
  assertProjectionParity(checks, summary, 'summary for D/C')
  return publicResultCopy(renderChecksFromEnvelope(checks, summary))
}

export const renderSpreadFootingAnalysisSurface = (snapshot, displayOptions = {}) =>
  publicResultCopy(
    renderAnalysisFromEnvelope(
      requireEnvelope(selectSpreadFootingDiagramData(snapshot), 'selectSpreadFootingDiagramData'),
      displayOptions
    )
  )

export const renderSpreadFootingSectionSurface = (snapshot) =>
  publicResultCopy(
    renderSectionFromEnvelope(
      requireEnvelope(selectSpreadFootingSectionData(snapshot), 'selectSpreadFootingSectionData')
    )
  )

export const renderSpreadFootingThreeSurface = (snapshot) =>
  publicResultCopy(
    renderThreeFromEnvelope(
      requireEnvelope(selectSpreadFooting3DData(snapshot), 'selectSpreadFooting3DData')
    )
  )

export const renderSpreadFootingReportSurface = (snapshot) =>
  publicResultCopy(
    renderReportFromEnvelope(
      requireEnvelope(selectSpreadFootingReportData(snapshot), 'selectSpreadFootingReportData')
    )
  )

export const renderSpreadFootingCalculationBookSurface = (snapshot) =>
  publicResultCopy(
    renderCalculationBookFromEnvelope(
      requireEnvelope(
        selectSpreadFootingCalculationBookData(snapshot),
        'selectSpreadFootingCalculationBookData'
      )
    )
  )

export const renderSpreadFootingDrawingSurface = (snapshot) => {
  const drawing = requireEnvelope(
    selectSpreadFootingDrawingData(snapshot),
    'selectSpreadFootingDrawingData'
  )
  const takeoff = requireEnvelope(
    selectSpreadFootingTakeoffData(snapshot),
    'selectSpreadFootingTakeoffData'
  )
  assertProjectionParity(drawing, takeoff, 'takeoff')
  return publicResultCopy(renderDrawingFromEnvelope(drawing, takeoff))
}

export const renderSpreadFootingSnapshotSurfaces = (snapshot, displayOptions = {}) => {
  const selected = selectSurfaceEnvelopes(snapshot)
  const surfaces = renderSurfaceMarkupFromSelected(selected, displayOptions)
  if (Object.keys(surfaces).join('|') !== SURFACE_KEYS.join('|')) {
    throw new TypeError('Spread Footing renderer surface order is invalid')
  }
  return deepFreeze(surfaces)
}
