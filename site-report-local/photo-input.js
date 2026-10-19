/* Local photo ingestion. No upload, bundled decoder, or universal HEIC support.
 * Native capability: https://developer.apple.com/videos/play/wwdc2023/10122/
 * Local conversion/camera advice: https://support.apple.com/en-gb/116944
 */
(() => {
  'use strict';

  const MAX_BYTES = 10 * 1024 * 1024;
  const MAX_PIXELS = 100000000;
  const ORIGINAL_BYTES = 2 * 1024 * 1024;
  const MAX_SIDE = 1920;
  const TIMEOUT_MS = 15000;
  const rasterTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
  const heicTypes = new Set(['image/heic', 'image/heif']);
  const extensions = Object.freeze({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif' });
  const accept = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif';
  const help = 'JPG / PNG / WebP หรือ HEIC / HEIF ไม่เกิน 10 MB ต่อรูป · HEIC / HEIF อ่านได้เฉพาะเบราว์เซอร์ที่รองรับ หากอ่านไม่ได้ ให้ส่งออกภาพเดิมเป็น JPEG / PNG ในเครื่องก่อน รูปที่ถ่ายใหม่บน iPhone เลือก การตั้งค่า > กล้อง > รูปแบบ > เข้ากันได้มากที่สุด (Most Compatible) ได้ แต่ไม่เปลี่ยนรูปเก่า';
  const messages = Object.freeze({
    unsupportedType: 'ชนิดไฟล์ไม่รองรับ กรุณาเลือก JPG / PNG / WebP หรือ HEIC / HEIF',
    tooLarge: 'รูปใหญ่เกินขีดจำกัด กรุณาใช้ไฟล์ไม่เกิน 10 MB และภาพไม่เกิน 100 ล้านพิกเซล',
    decode: 'อ่านภาพไม่ได้ ไฟล์อาจเสียหาย กรุณาส่งออกภาพใหม่เป็น JPEG / PNG ในเครื่องแล้วลองอีกครั้ง',
    heicUnsupported: 'อ่าน HEIC / HEIF ไม่ได้ เบราว์เซอร์นี้อาจไม่รองรับหรือไฟล์อาจเสียหาย กรุณาส่งออกภาพเดิมเป็น JPEG / PNG ในเครื่องก่อน แล้วเลือกไฟล์ใหม่',
    timeout: 'อ่านภาพนานเกินไป กรุณาลองใหม่ หรือส่งออกภาพเป็น JPEG / PNG ขนาดเล็กลงในเครื่องก่อน',
    resources: 'เตรียมภาพไม่สำเร็จ เบราว์เซอร์อาจมีหน่วยความจำไม่พอ กรุณาปิดแท็บที่ไม่ใช้หรือเลือกรูปขนาดเล็กลงแล้วลองใหม่',
  });

  function photoError(code) {
    const error = new Error(messages[code]);
    error.name = 'SiteReportPhotoInputError';
    error.code = code;
    return error;
  }

  function rasterSignature(base64) {
    const bytes = atob(base64.slice(0, 64));
    if (bytes.startsWith('\xff\xd8\xff')) return 'image/jpeg';
    if (bytes.startsWith('\x89PNG\r\n\x1a\n')) return 'image/png';
    if (bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WEBP') return 'image/webp';
    return null;
  }

  function classify(file) {
    if (!(file instanceof Blob)) throw photoError('unsupportedType');
    const mime = String(file.type || '').toLowerCase().trim();
    const extension = String(file.name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    const fromName = Object.prototype.hasOwnProperty.call(extensions, extension) ? extensions[extension] : null;
    // A filename never overrides an explicitly unsupported type, including SVG/GIF.
    if (mime && mime !== 'application/octet-stream' && !rasterTypes.has(mime) && !heicTypes.has(mime)) throw photoError('unsupportedType');
    const type = rasterTypes.has(mime) || heicTypes.has(mime) ? mime : fromName;
    if (!type) throw photoError('unsupportedType');
    return { type, heic: heicTypes.has(type) || heicTypes.has(fromName) };
  }

  function read(file) {
    return new Promise((resolve, reject) => {
      let format;
      try {
        format = classify(file);
        if (file.size > MAX_BYTES) throw photoError('tooLarge');
      } catch (error) { reject(error); return; }

      let image = null;
      let reader = null;
      let canvas = null;
      let objectUrl = null;
      let timer = null;
      let settled = false;

      function cleanup() {
        let failed = false;
        const release = action => { try { action(); } catch { failed = true; } };
        release(() => clearTimeout(timer));
        if (reader) release(() => { reader.onload = null; reader.onerror = null; reader.onabort = null; if (reader.readyState === 1) reader.abort(); });
        if (image) release(() => { image.onload = null; image.onerror = null; image.src = ''; });
        if (objectUrl) release(() => URL.revokeObjectURL(objectUrl));
        if (canvas) release(() => { canvas.width = 1; canvas.height = 1; });
        return !failed;
      }

      function finish(error, result) {
        if (settled) return;
        settled = true;
        const released = cleanup();
        if (error) reject(error);
        else if (!released) reject(photoError('resources'));
        else resolve(result);
      }

      function fail(code) { finish(photoError(code)); }

      function keepOriginal(width, height) {
        try {
          reader = new FileReader();
          reader.onerror = () => fail('decode');
          reader.onabort = () => fail('decode');
          reader.onload = () => {
            if (settled) return;
            try {
              const result = reader.result;
              if (typeof result !== 'string' || !/^data:[^,]*;base64,[A-Za-z0-9+/]+=*$/.test(result)) { fail('decode'); return; }
              const bytes = result.slice(result.indexOf(',') + 1);
              const actualType = rasterSignature(bytes);
              if (!actualType) { fail('decode'); return; }
              // Empty/mistyped MIME must not persist a mislabeled data URL. The
              // already decoded original raster bytes are otherwise unchanged.
              const src = `data:${actualType};base64,${bytes}`;
              finish(null, { src, width, height });
            } catch { fail('decode'); }
          };
          reader.readAsDataURL(file);
        } catch { fail('resources'); }
      }

      try {
        timer = setTimeout(() => fail('timeout'), TIMEOUT_MS);
        image = new Image();
        image.onerror = () => fail(format.heic ? 'heicUnsupported' : 'decode');
        image.onload = () => {
          if (settled) return;
          try {
            const width = image.naturalWidth;
            const height = image.naturalHeight;
            if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) { fail('decode'); return; }
            if (width * height > MAX_PIXELS) { fail('tooLarge'); return; }
            const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
            if (!format.heic && scale === 1 && file.size <= ORIGINAL_BYTES) { keepOriginal(width, height); return; }
            canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(width * scale));
            canvas.height = Math.max(1, Math.round(height * scale));
            const context = canvas.getContext('2d');
            if (!context) { fail('resources'); return; }
            context.fillStyle = '#ffffff';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            const src = canvas.toDataURL('image/jpeg', 0.86);
            if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(src)) { fail('resources'); return; }
            finish(null, { src, width: canvas.width, height: canvas.height });
          } catch { fail('resources'); }
        };
        objectUrl = URL.createObjectURL(file);
        image.src = objectUrl;
      } catch { fail('resources'); }
    });
  }

  window.SiteReportPhotoInput = Object.freeze({ version: '1.0.0', accept, help, read });
})();
