/* All-page PNG ZIP, dependency-free and local only. No photo/report rewriting. */
(function (global) {
  'use strict';
  const LIMITS = Object.freeze({ maxPages: 200, maxPageBytes: 16 * 1024 * 1024, maxTotalBytes: 128 * 1024 * 1024 });
  const encoder = new TextEncoder();
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  function crc32(bytes, from = 0, to = bytes.length) {
    let crc = 0xffffffff;
    for (let index = from; index < to; index++) crc = table[(crc ^ bytes[index]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function fail(message) { throw new Error(message); }
  function base64Payload(value) {
    if (typeof value !== 'string' || !value.startsWith('data:image/png;base64,')) fail('หน้ารายงานต้องเป็นภาพ PNG ในเครื่อง');
    const payload = value.slice(22);
    if (!payload || payload.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) fail('ข้อมูล PNG ไม่ถูกต้อง');
    const byteLength = payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0);
    if (byteLength > LIMITS.maxPageBytes) fail('ภาพหน้ารายงานใหญ่เกิน 16 MiB');
    return { payload, byteLength };
  }
  function pngBytes(payload) {
    let binary;
    try { binary = atob(payload); } catch { fail('อ่านข้อมูล PNG ไม่สำเร็จ'); }
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 57 || signature.some((value, index) => bytes[index] !== value)) fail('ไฟล์หน้ารายงานไม่ใช่ PNG ที่สมบูรณ์');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8, hasHeader = false, hasData = false, ended = false;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) fail('ข้อมูลส่วนท้าย PNG ไม่ครบ');
      const length = view.getUint32(offset, false);
      const end = offset + 12 + length;
      if (end > bytes.length || length > LIMITS.maxPageBytes) fail('ข้อมูลส่วน PNG ไม่ครบ');
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes, offset + 4, end - 4) !== view.getUint32(end - 4, false)) fail('ข้อมูล PNG เสียหาย ตรวจสอบภาพแล้วลองใหม่');
      if (!hasHeader) {
        if (type !== 'IHDR' || length !== 13) fail('ไม่พบส่วนหัว PNG ที่ถูกต้อง');
        const width = view.getUint32(offset + 8, false), height = view.getUint32(offset + 12, false);
        if (!width || !height || width > 32768 || height > 32768 || width * height > 80 * 1024 * 1024) fail('ขนาดภาพ PNG ไม่รองรับ');
        hasHeader = true;
      } else if (type === 'IHDR') fail('ส่วนหัว PNG ซ้ำ');
      if (type === 'IDAT' && length) hasData = true;
      if (type === 'IEND') {
        if (length || !hasData || end !== bytes.length) fail('ข้อมูลส่วนท้าย PNG ไม่ถูกต้อง');
        ended = true; break;
      }
      offset = end;
    }
    if (!ended) fail('ข้อมูล PNG ไม่ครบทั้งภาพ');
    return bytes;
  }
  function safePrefix(value) {
    const raw = typeof value === 'string' ? value : 'site-report';
    const cleaned = raw.normalize('NFKC').replace(/[\\/<>:"|?*\x00-\x1f\x7f-\x9f]/g, '_').replace(/^[.\s]+|[.\s]+$/g, '');
    return Array.from(cleaned).slice(0, 80).join('') || 'site-report';
  }
  function header(size) { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; }
  async function pngZip(pages, filenamePrefix = 'site-report') {
    if (!Array.isArray(pages) || !pages.length) fail('ยังไม่มีหน้ารายงานสำหรับรวม PNG');
    if (pages.length > LIMITS.maxPages) fail('รวม PNG ได้ไม่เกิน 200 หน้า กรุณาแบ่งรายงาน');
    // Copy the source strings before yielding; later UI edits cannot mix pages.
    let total = 0;
    const sources = pages.map(page => {
      const source = base64Payload(page?.pngDataUrl);
      total += source.byteLength;
      if (total > LIMITS.maxTotalBytes) fail('PNG รวมใหญ่เกิน 128 MiB กรุณาแบ่งรายงาน');
      return source;
    });
    const prefix = safePrefix(filenamePrefix), digits = Math.max(2, String(sources.length).length);
    const localParts = [], directoryParts = [];
    let offset = 0, directorySize = 0;
    for (let index = 0; index < sources.length; index++) {
      const bytes = pngBytes(sources[index].payload);
      const name = encoder.encode(`${prefix}-p${String(index + 1).padStart(digits, '0')}.png`);
      const checksum = crc32(bytes);
      const local = header(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true); // UTF-8 filenames, no data descriptor.
      local.view.setUint16(10, 0, true); local.view.setUint16(12, 33, true); // 1980-01-01.
      local.view.setUint32(14, checksum, true);
      local.view.setUint32(18, bytes.length, true); local.view.setUint32(22, bytes.length, true);
      local.view.setUint16(26, name.length, true);
      localParts.push(local.bytes, name, bytes);
      const central = header(46);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true); central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x0800, true);
      central.view.setUint16(14, 33, true);
      central.view.setUint32(16, checksum, true);
      central.view.setUint32(20, bytes.length, true); central.view.setUint32(24, bytes.length, true);
      central.view.setUint16(28, name.length, true);
      central.view.setUint32(38, 0x20, true); // DOS archive attribute, regular file.
      central.view.setUint32(42, offset, true);
      directoryParts.push(central.bytes, name);
      directorySize += central.bytes.length + name.length;
      offset += local.bytes.length + name.length + bytes.length;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const end = header(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, sources.length, true); end.view.setUint16(10, sources.length, true);
    end.view.setUint32(12, directorySize, true); end.view.setUint32(16, offset, true);
    return new Blob([...localParts, ...directoryParts, end.bytes], { type: 'application/zip' });
  }
  global.SiteReportArchive = Object.freeze({ pngZip, limits: LIMITS, version: '1.0.0' });
})(globalThis);
