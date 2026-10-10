/**
 * Read-only, text-only projection of a current RW-01 calculation failure.
 * The Engine/Snapshot owns checks and recommendations; this module never
 * computes a new capacity, changes a verdict, or treats an example as a fix.
 */

const text = (value) => String(value ?? '').replace(/<[^>]*>/g, '').trim();
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const dimension = (value) => finite(value) ? value.toFixed(2) : '—';

const DUCK_DIMENSIONS = Object.freeze({
  t: 'เสากว้าง', colDepth: 'เสาลึก', B: 'ฐานกว้าง', capL: 'ฐานยาว',
  hz: 'ฐานหนา', beamB: 'คานกว้าง', beamH: 'คานลึก',
});
const LEGACY_DIMENSIONS = Object.freeze({
  hz: 'ฐานหนา', B: 'ฐานกว้าง', heel: 'ยื่นหลัง', toe: 'ยื่นหน้า',
  t: 'ผนังหนา', ttop: 'ยอดผนังหนา', fc: 'กำลังคอนกรีต',
  bs: 'ความหนาครีบ', L: 'ช่วงว่างระหว่างครีบ',
});

function changeText(change, labels) {
  if (!change || !finite(change.from) || !finite(change.to)
      || !text(change.key) || change.from === change.to) return null;
  const label = labels[change.key];
  if (!label) return null;
  const unit = text(change.unit) || (change.key === 'fc' ? 'MPa' : 'ม.');
  return `${label} ${dimension(change.from)} → ${dimension(change.to)} ${unit}`;
}

function summary(failed, first, adviceKind, adviceText, caveat) {
  return {
    count: failed.length,
    first: { key: text(first.key), value: text(first.value), criterion: text(first.criterion) },
    adviceKind,
    adviceText,
    caveat,
  };
}

/** Native pile/pilecf/soldier/duckfoot Snapshot; returns null without a current FAIL. */
export function summarizeSystemFailure(snap) {
  if (!snap || snap.ok === false || snap.stale === true || snap.state === 'STALE'
      || snap.status !== 'FAIL' || !Array.isArray(snap.checks)) return null;
  const failed = snap.checks.filter((row) => row?.ok === false);
  if (!failed.length) return null;
  const first = {
    key: failed[0].key, value: failed[0].value, criterion: failed[0].criterion,
  };

  if (snap.type === 'soldier') {
    // Only the Snapshot's full-register Engine rerun can authorize an exact size.
    const verified = snap.recommendations?.find((row) =>
      /^I-(18|22|26|30|35|40|45)$/.test(text(row?.value))
      && text(row?.title).includes('ผ่านทะเบียน Engine')
      && text(row?.basis).includes('ทดสอบใหม่ทุกเกณฑ์'));
    if (verified) {
      return summary(failed, first, 'verified',
        `เปลี่ยนเข็มตัวไอเป็น ${verified.value} แล้วกดคำนวณใหม่`,
        'Engine ทดลองซ้ำกับข้อมูลเดิมแล้วผ่านรายการที่ลงทะเบียน; ต้องยืนยันแค็ตตาล็อกผู้ผลิตและข้อมูลดิน · REVIEW / NOT FOR CONSTRUCTION');
    }
  }

  if (snap.type === 'duckfoot') {
    const recommendation = snap.recommendation;
    const changes = recommendation?.verified === true && Array.isArray(recommendation.changes)
      ? recommendation.changes.map((change) => changeText(change, DUCK_DIMENSIONS)) : [];
    if (changes.length && changes.every(Boolean)
        && changes.length === recommendation.changes.length) {
      return summary(failed, first, 'verified',
        `ปรับขนาดร่วมกัน: ${changes.join(' · ')} แล้วกดคำนวณใหม่`,
        'Engine ทดลองชุดขนาดนี้พร้อมกันกับแรง วัสดุ และดินเดิม; ห้ามเลือกปรับเพียงบางค่า · REVIEW / NOT FOR CONSTRUCTION');
    }
  }

  if (snap.type === 'pile' || snap.type === 'pilecf') {
    const minima = (Array.isArray(snap.recommendations) ? snap.recommendations : [])
      .filter((row) => text(row?.title) && text(row?.value)
        && /ขั้นต่ำ|ต้องมี/.test(text(row.title)));
    if (minima.length) {
      return summary(failed, first, 'minimum',
        `กำลังที่ต้องมีตามผลชุดนี้: ${minima.map((row) => `${text(row.title)} ${text(row.value)}`).join(' · ')}`,
        'ตัวเลขนี้เป็นกำลังขั้นต่ำ ไม่ใช่ขนาดเสาเข็มหรือเดือยที่ตรวจผ่านครบ; ยืนยันผลดิน/กำลังจากผู้ผลิตและคำนวณใหม่ · REVIEW / NOT FOR CONSTRUCTION');
    }
  }

  return summary(failed, first, 'none',
    'ยังไม่มีชุดแก้ที่ Engine ยืนยันว่าผ่านทุกรายการ; เปิด Flow 02 เพื่อตรวจข้อที่ตก',
    'คงสถานะไม่ผ่านไว้จนกว่าจะกรอกข้อมูลที่แก้แล้วและคำนวณใหม่ · REVIEW / NOT FOR CONSTRUCTION');
}

/** Legacy cantilever/gravity/counterfort presentation or Snapshot. */
export function summarizeLegacyFailure(c) {
  if (!c || c.ok === false || c.state === 'STALE' || c.stale === true
      || c.verdict?.pass !== false || !Array.isArray(c.checks)) return null;
  const failed = c.checks.filter((row) => row?.ok === false);
  if (!failed.length) return null;
  const first = { key: failed[0].k, value: failed[0].v, criterion: failed[0].req };
  const candidates = c.recovery?.source === 'engine.trial'
    && c.recovery?.authority === 'ADVISORY_APPLY_THEN_RECALCULATE'
    && Array.isArray(c.recovery.items)
      ? c.recovery.items.flatMap((item) => Array.isArray(item.candidates) ? item.candidates : []) : [];
  const verified = candidates.find((candidate) =>
    candidate?.targetCheckPass === true && candidate.allRegisteredPass === true
    && Array.isArray(candidate.changes) && candidate.changes.length > 0
    && candidate.changes.map((change) => changeText(change, LEGACY_DIMENSIONS)).every(Boolean));
  if (verified) {
    const changes = verified.changes.map((change) => changeText(change, LEGACY_DIMENSIONS));
    return summary(failed, first, 'verified',
      `ปรับขนาดร่วมกัน: ${changes.join(' · ')} แล้วกดคำนวณใหม่`,
      'Engine ทดลองซ้ำจนผ่านรายการที่ลงทะเบียนทั้งหมดของ input เดิม; ต้องยืนยันข้อมูลดินและกดคำนวณใหม่ · REVIEW / NOT FOR CONSTRUCTION');
  }
  return summary(failed, first, 'none',
    'ยังไม่มีชุดแก้ที่ Engine ยืนยันว่าผ่านทุกรายการ; เปิด Flow 02 เพื่อตรวจข้อที่ตก',
    'ค่าที่แก้ข้อเดียวได้อาจยังตกข้ออื่น โดยเฉพาะ Global Slip ที่ต้องทบทวนดิน · REVIEW / NOT FOR CONSTRUCTION');
}
