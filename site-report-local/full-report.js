/* Optional, self-reported Daily Report fields. No engineering verdict or approval. */
(function (global) {
  'use strict';
  const VERSION = 1;
  const limits = Object.freeze({ tasks: 20, photos: 120, followups: 12, materials: 12, logoBytes: 1024 * 1024, logoDimension: 1920, logoPixels: 4000000 });
  const fields = Object.freeze(['companyName', 'companyEnglish', 'companyService', 'formCode', 'formRevision', 'reportNumber', 'ownerName', 'contractorName', 'workStart', 'workEnd', 'weatherMorning', 'weatherAfternoon', 'rain', 'plannedOverall', 'actualOverall', 'quality', 'safetyIncident', 'nearMiss', 'ppe', 'toolboxTime', 'scheduleImpact', 'coordination']);
  const longFields = new Set(['quality', 'safetyIncident', 'nearMiss', 'ppe', 'scheduleImpact', 'coordination', 'title', 'usage', 'status']);
  const laborKeys = Object.freeze(['engineer', 'foreman', 'formwork', 'rebar', 'mason', 'systems', 'general', 'other']);
  const signatureKeys = Object.freeze(['preparer', 'supervisor', 'ownerRepresentative', 'preparerDate', 'supervisorDate', 'ownerRepresentativeDate']);
  function fail(message) { const error = new Error('รายงานเต็มรูปแบบ: ' + message); error.code = 'VALIDATION'; throw error; }
  function plain(input, name) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail(name + ' ต้องเป็น object ปกติ');
  }
  function safeTree(input, depth = 0, seen = new Set()) {
    if (depth > 10) fail('ข้อมูลซ้อนลึกเกินกำหนด');
    if (input === null || typeof input === 'string' || typeof input === 'boolean' || (typeof input === 'number' && Number.isFinite(input))) return;
    if (!input || typeof input !== 'object' || seen.has(input)) fail('ข้อมูลต้องเป็น JSON และไม่มีวงรอบ');
    if (Array.isArray(input)) { if (input.length > limits.photos) fail('จำนวนรายการเกินกำหนด'); }
    else plain(input, 'ข้อมูล');
    seen.add(input);
    for (const key of Reflect.ownKeys(input)) {
      if (Array.isArray(input) && key === 'length') continue;
      if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key) || (Array.isArray(input) && !/^(0|[1-9]\d*)$/.test(key))) fail('พบชื่อฟิลด์ที่ไม่อนุญาต');
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) fail('ข้อมูลต้องไม่มี accessor หรือฟิลด์ซ่อน');
      safeTree(descriptor.value, depth + 1, seen);
    }
    seen.delete(input);
  }
  function keys(input, allowed, name) {
    plain(input, name);
    for (const key of Object.keys(input)) if (!allowed.includes(key)) fail(name + ' ไม่รองรับฟิลด์ ' + key);
    for (const key of allowed) if (!Object.hasOwn(input, key)) fail(name + ' ขาดฟิลด์ ' + key);
  }
  function text(input, name, maximum = longFields.has(name) ? 10000 : 500) {
    if (typeof input !== 'string' || input.length > maximum) fail(name + ' ต้องเป็นข้อความไม่เกิน ' + maximum + ' ตัวอักษร');
  }
  function choice(input, allowed, name) { text(input, name); if (!allowed.includes(input)) fail(name + ' มีค่าที่ไม่รองรับ'); }
  function numeric(input, name, maximum, integer = false) {
    text(input, name, 32);
    if (input === '') return null;
    if (!(integer ? /^(0|[1-9]\d*)$/ : /^(0|[1-9]\d*)(\.\d+)?$/).test(input) || !Number.isFinite(Number(input)) || Number(input) > maximum || (integer && !Number.isSafeInteger(Number(input)))) fail(name + ' ต้องเป็น' + (integer ? 'จำนวนเต็ม' : 'ตัวเลข') + ' 0–' + maximum + ' หรือเว้นว่าง');
    return Number(input);
  }
  function date(input, name) {
    text(input, name, 10);
    if (input === '') return;
    const parsed = Date.parse(input + 'T00:00:00.000Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input) || !Number.isFinite(parsed) || new Date(parsed).toISOString().slice(0, 10) !== input) fail(name + ' ต้องเป็นวันที่ที่ถูกต้อง');
  }
  function time(input, name) { text(input, name, 5); if (input !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) fail(name + ' ต้องเป็นเวลา HH:MM'); }
  function localDateTime(input, name) {
    text(input, name, 19);
    if (input === '') return;
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:[0-5]\d)?$/.test(input)) fail(name + ' ต้องเป็นวันเวลาในเครื่อง ไม่ใช่เวลาถ่ายที่ยืนยันอัตโนมัติ');
    date(input.slice(0, 10), name); time(input.slice(11, 16), name);
  }
  function identifier(input, name) { text(input, name, 100); if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(input)) fail(name + ' ไม่ถูกต้อง'); }
  function validateLogo(logo) {
    if (logo === null) return;
    keys(logo, ['src', 'width', 'height'], 'โลโก้');
    for (const key of ['width', 'height']) if (!Number.isSafeInteger(logo[key]) || logo[key] < 1 || logo[key] > limits.logoDimension) fail('โลโก้กว้างและสูงได้ไม่เกิน 1920 px');
    if (logo.width * logo.height > limits.logoPixels) fail('โลโก้มีความละเอียดเกินกำหนด');
    if (typeof logo.src !== 'string' || logo.src.length > Math.ceil(limits.logoBytes / 3) * 4 + 32) fail('โลโก้ต้องมีขนาดไม่เกิน 1 MiB');
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(logo.src);
    if (!match || match[2].length % 4 !== 0) fail('โลโก้ต้องเป็น JPEG, PNG หรือ WebP แบบ data URL');
    const bytes = match[2].length / 4 * 3 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
    if (bytes < 12 || bytes > limits.logoBytes) fail('โลโก้ต้องเป็นไฟล์จริงขนาดไม่เกิน 1 MiB');
    let prefix;
    try { prefix = global.atob(match[2].slice(0, 32)); } catch (_) { fail('ข้อมูล base64 ของโลโก้ไม่ถูกต้อง'); }
    const correct = match[1] === 'png' ? prefix.startsWith('\x89PNG\r\n\x1a\n') : match[1] === 'jpeg' ? prefix.startsWith('\xff\xd8\xff') : prefix.startsWith('RIFF') && prefix.slice(8, 12) === 'WEBP';
    if (!correct) fail('ชนิดไฟล์โลโก้ไม่ตรงกับข้อมูลจริง');
  }
  function defaults() {
    return { version: VERSION, ...Object.fromEntries(fields.map(key => [key, ''])), logo: null, progress: {}, labor: Object.fromEntries(laborKeys.map(key => [key, ''])), followups: [], materials: [], photoDetails: {}, signatures: Object.fromEntries(signatureKeys.map(key => [key, ''])) };
  }
  function validateLabor(labor) { keys(labor, laborKeys, 'แรงงาน'); for (const key of laborKeys) numeric(labor[key], 'แรงงาน ' + key, 9999, true); }
  function validate(input) {
    safeTree(input);
    keys(input, ['version', ...fields, 'logo', 'progress', 'labor', 'followups', 'materials', 'photoDetails', 'signatures'], 'ข้อมูล');
    if (input.version !== VERSION) fail('ไม่รองรับข้อมูลรุ่นนี้');
    for (const key of fields) text(input[key], key);
    for (const key of ['plannedOverall', 'actualOverall']) numeric(input[key], key, 100);
    for (const key of ['workStart', 'workEnd', 'toolboxTime']) time(input[key], key);
    validateLogo(input.logo);
    const catalog = global.SiteReportCatalog;
    if (catalog?.version !== 1 || !Object.isFrozen(catalog) || !Array.isArray(catalog.tasks) || !Object.isFrozen(catalog.tasks) || catalog.tasks.length > limits.tasks || !catalog.tasks.every(task => Object.isFrozen(task) && typeof task.id === 'string') || new Set(catalog.tasks.map(task => task.id)).size !== catalog.tasks.length) fail('ยังเปิดรายการงานที่เชื่อถือได้ไม่ได้ กรุณาโหลดหน้าใหม่');
    plain(input.progress, 'แผนและผลจริง');
    if (Object.keys(input.progress).length > limits.tasks) fail('แผนและผลจริงเกิน 20 งาน');
    for (const [id, item] of Object.entries(input.progress)) {
      if (!catalog.tasks.some(task => task.id === id)) fail('แผนและผลจริงอ้างอิงงานที่ไม่รองรับ');
      keys(item, ['planned', 'actual'], 'แผนและผลจริง ' + id);
      numeric(item.planned, 'แผน ' + id, 100); numeric(item.actual, 'ผลจริง ' + id, 100);
    }
    validateLabor(input.labor);
    for (const [name, allowed] of [['followups', ['id', 'title', 'responsible', 'due', 'priority', 'status']], ['materials', ['id', 'name', 'quantity', 'unit', 'usage', 'status']]]) {
      if (!Array.isArray(input[name]) || input[name].length > limits[name]) fail(name + ' เก็บได้ไม่เกิน ' + limits[name] + ' รายการ');
      const ids = new Set();
      for (const item of input[name]) {
        keys(item, allowed, name); identifier(item.id, name + '.id');
        if (ids.has(item.id)) fail(name + ' มีรหัสซ้ำ'); ids.add(item.id);
        for (const key of allowed) text(item[key], key);
        if (name === 'followups') {
          date(item.due, 'กำหนดเสร็จ'); choice(item.priority, ['', 'low', 'normal', 'high'], 'ความสำคัญ'); choice(item.status, ['', 'open', 'doing', 'done'], 'สถานะติดตาม');
        } else numeric(item.quantity, 'จำนวนวัสดุ', 1000000000);
      }
    }
    plain(input.photoDetails, 'ข้อมูลภาพ');
    if (Object.keys(input.photoDetails).length > limits.photos) fail('ข้อมูลภาพเกิน 120 รูป');
    for (const [id, item] of Object.entries(input.photoDetails)) {
      if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) fail('รหัสข้อมูลภาพไม่ถูกต้อง');
      keys(item, ['capturedAt', 'photographer', 'condition'], 'ข้อมูลภาพ ' + id);
      localDateTime(item.capturedAt, 'วันเวลาที่ผู้บันทึกระบุ'); text(item.photographer, 'ผู้ถ่าย'); choice(item.condition, ['', 'normal', 'watch', 'issue'], 'สถานะภาพ');
    }
    keys(input.signatures, signatureKeys, 'ช่องลงชื่อ');
    for (const key of signatureKeys) { if (key.endsWith('Date')) date(input.signatures[key], key); else text(input.signatures[key], key); }
    return input;
  }
  function normalize(input) { return input === undefined || input === null ? defaults() : JSON.parse(JSON.stringify(validate(input))); }
  function progress(planned, actual) {
    const p = numeric(planned, 'แผนสะสม', 100), a = numeric(actual, 'ผลจริงสะสม', 100);
    if (p === null || a === null) return null;
    const difference = Math.round((a - p) * 100) / 100;
    return Object.is(difference, -0) ? 0 : difference;
  }
  function workforce(labor) {
    safeTree(labor); validateLabor(labor);
    const recorded = laborKeys.filter(key => labor[key] !== '');
    return { total: recorded.length ? recorded.reduce((sum, key) => sum + Number(labor[key]), 0) : null, complete: recorded.length === laborKeys.length, filled: recorded.length };
  }
  global.SiteReportFullReport = Object.freeze({ version: '1.0.0', limits, defaults, normalize, validate, progress, workforce });
})(globalThis);
