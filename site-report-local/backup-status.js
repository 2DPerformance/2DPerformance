/* Advisory metadata only. Never part of a draft, revision, restore file or save/leave authority. */
(function (global) {
  'use strict';
  const key = 'naichangyai-site-report-backup-receipt-v1';
  const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  function manifest(records) {
    // Immutable revision identities and monotonic draft versions detect old-dated imports too.
    return JSON.stringify({
      drafts: records.drafts.map(record => [record.id, record.version]).sort((a, b) => a[0].localeCompare(b[0])),
      revisions: records.revisions.map(record => record.id).sort(),
    });
  }
  function validReceipt(value) {
    if (!value || value.version !== 1 || !validDate(value.exportedAt) || !validDate(value.confirmedAt) || value.exportedAt > value.confirmedAt
      || typeof value.filename !== 'string' || !/^site-report-backup-\d+\.json$/.test(value.filename)
      || typeof value.manifest !== 'string' || value.manifest.length > 100000) return false;
    const data = JSON.parse(value.manifest);
    return Array.isArray(data.drafts) && data.drafts.length <= 200 && Array.isArray(data.revisions) && data.revisions.length <= 200
      && data.drafts.every(row => Array.isArray(row) && row.length === 2 && typeof row[0] === 'string' && row[0].length <= 100 && Number.isSafeInteger(row[1]) && row[1] > 0)
      && data.revisions.every(id => typeof id === 'string' && id.length <= 100);
  }
  function read() {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return { receipt: null, error: '' };
      if (raw.length > 110000) throw new Error('invalid metadata');
      const receipt = JSON.parse(raw);
      if (!validReceipt(receipt)) throw new Error('invalid metadata');
      return { receipt, error: '' };
    } catch { return { receipt: null, error: 'อ่านประวัติยืนยันไฟล์สำรองไม่ได้ ยังสำรองและบันทึกรายงานได้ตามปกติ' }; }
  }
  function prepare(backup, filename) {
    return Object.freeze({ filename, exportedAt: backup.exportedAt, manifest: manifest(backup) });
  }
  function confirm(candidate) {
    try {
      const receipt = { version: 1, ...candidate, confirmedAt: new Date().toISOString() };
      if (!validReceipt(receipt)) throw new Error('invalid candidate');
      const previous = read().receipt;
      // An older pending download in another tab must not overwrite a newer confirmed file.
      if (previous && previous.exportedAt > receipt.exportedAt) return { receipt: previous, error: '', notice: 'มีไฟล์สำรองที่ยืนยันใหม่กว่านี้แล้ว จึงคงวันที่ไฟล์ใหม่ไว้' };
      global.localStorage.setItem(key, JSON.stringify(receipt));
      return { receipt, error: '' };
    } catch { return { receipt: null, error: 'จำวันที่ยืนยันไฟล์สำรองไม่ได้ ตรวจเก็บไฟล์ไว้เอง รายงานยังบันทึกได้ตามปกติ' }; }
  }
  const day = value => { const date = new Date(value); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`; };
  function reason(receipt, currentManifest, dirty, now = new Date().toISOString()) {
    if (!receipt) return 'ยังไม่มีประวัติยืนยันไฟล์สำรองในเบราว์เซอร์นี้';
    if (dirty || currentManifest !== null && currentManifest !== receipt.manifest) return 'มีข้อมูลเปลี่ยนจากไฟล์สำรอง ควรสำรองใหม่';
    if (currentManifest === null) return 'ยังตรวจความตรงกับข้อมูลปัจจุบันไม่ได้ ควรสำรองก่อนปิดงาน';
    if (day(receipt.exportedAt) !== day(now)) return 'ควรสำรองประจำวันก่อนปิดงาน';
    return 'ข้อมูลที่ตรวจตรงกับไฟล์ที่ยืนยัน เก็บไฟล์ไว้ในที่ส่วนตัว';
  }
  global.SiteReportBackupStatus = Object.freeze({ version: '1.0.0', key, manifest, read, prepare, confirm, reason });
})(globalThis);
