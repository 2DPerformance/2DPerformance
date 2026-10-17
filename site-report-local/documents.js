/* Task-owned mockup report renderer. No upload, network, approval or certification. */
(function installSiteReportDocuments(global) {
  'use strict';

  const WIDTH = 1240;
  const HEIGHT = 1754;
  const MARGIN = 84;
  const CONTENT_WIDTH = WIDTH - MARGIN * 2;
  const CONTENT_TOP = 177;
  const CONTENT_BOTTOM = 1585;
  // Export-operation budgets only. Stored photos/history are never changed or truncated.
  const limits = Object.freeze({
    maxTasks: 20,
    maxPhotosPerTask: 6,
    maxPhotos: 120,
    maxPages: 200,
    maxInputDataUrlChars: 24 * 1024 * 1024,
    maxRetainedDataUrlChars: 32 * 1024 * 1024,
    // A4 RGBA is 8,699,840 bytes (11,599,788 base64 characters). Reserve
    // 12 Mi characters before each encode, including >0.9 Mi PNG filter,
    // deflate/container headroom. Reject an encoder result outside this envelope.
    maxEncodeDataUrlChars: 12 * 1024 * 1024
  });
  const resourceError = detail => new Error('รายงานเกินขีดจำกัดการส่งออก (' + detail + ') กรุณาแบ่งรายงานเป็นชุดย่อย ข้อมูลและรูปต้นฉบับยังอยู่ครบ ไม่มีการตัดหรือลดคุณภาพ');
  const COLORS = { ink: '#152c43', body: '#24394b', muted: '#617180', line: '#dce4e9', soft: '#f3f6f8', accent: '#285e70', white: '#ffffff', amber: '#916118' };
  const FONT = '"Sarabun", "Leelawadee UI", "Tahoma", sans-serif';
  const encoder = new TextEncoder();
  const nextFrame = () => new Promise(resolve => setTimeout(resolve, 0));
  const value = input => input === undefined || input === null || input === '' ? 'ยังไม่ระบุ' : String(input);
  const graphemeSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
  const wordSegmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('th', { granularity: 'word' }) : null;

  function graphemes(text) {
    if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), part => part.segment);
    const groups = [];
    for (const character of Array.from(text)) {
      if (/[\u0300-\u036f\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\ufe00-\ufe0f]/u.test(character) && groups.length) groups[groups.length - 1] += character;
      else groups.push(character);
    }
    return groups;
  }

  function wrapText(context, input, width) {
    const output = [];
    for (const paragraph of String(input).replace(/\r\n?/g, '\n').split('\n')) {
      if (paragraph === '') { output.push(''); continue; }
      const words = wordSegmenter ? Array.from(wordSegmenter.segment(paragraph), part => part.segment) : graphemes(paragraph);
      let line = '';
      for (const word of words) {
        if (context.measureText(line + word).width <= width) { line += word; continue; }
        if (line) { output.push(line); line = ''; }
        if (context.measureText(word).width <= width) { line = word; continue; }
        for (const character of graphemes(word)) {
          if (line && context.measureText(line + character).width > width) { output.push(line); line = ''; }
          line += character;
        }
      }
      if (line) output.push(line);
    }
    return output;
  }

  async function decodePhoto(photo, taskId, trackImage) {
    if (photo.sample && !photo.src) return null;
    if (!photo.src || !/^(data:image\/|blob:)/i.test(photo.src)) {
      throw new Error('อ่านภาพไม่ได้: งาน ' + taskId + ' / รูป ' + photo.id + ' (ต้องเป็นรูปที่แนบใน mockup)');
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (trackImage) trackImage(image);
      let settled = false;
      const complete = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = null;
        image.onerror = null;
        if (error) { image.removeAttribute('src'); reject(error); }
        else resolve(result);
      };
      const timer = setTimeout(() => complete(new Error('อ่านภาพนานเกิน 15 วินาที: งาน ' + taskId + ' / รูป ' + photo.id + ' กรุณาแนบรูปใหม่')), 15000);
      image.onload = () => {
        if (!image.naturalWidth || !image.naturalHeight) complete(new Error('ภาพไม่มีขนาด: ' + photo.id));
        else complete(null, image);
      };
      image.onerror = () => complete(new Error('อ่านไฟล์รูปไม่สำเร็จ: งาน ' + taskId + ' / รูป ' + photo.id + ' กรุณาแนบรูปใหม่'));
      image.src = photo.src;
    });
  }

  async function requireThaiFonts() {
    const message = 'โหลดฟอนต์ภาษาไทย Sarabun ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ รีเฟรชหน้า แล้วสร้างรายงานอีกครั้ง';
    if (!document.fonts || !Array.from(document.fonts).some(face => face.family.replace(/["']/g, '').toLowerCase() === 'sarabun')) throw new Error(message);
    let timer;
    try {
      const sample = 'รายงานหน้างาน ภาษาไทย กำลังก่อผนัง';
      const loaded = await Promise.race([
        Promise.all([400, 700].map(weight => document.fonts.load(weight + ' 25px "Sarabun"', sample))),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), 15000); })
      ]);
      if (loaded.some(faces => !faces.length || faces.some(face => face.status !== 'loaded')) || ![400, 700].every(weight => document.fonts.check(weight + ' 25px "Sarabun"', sample))) throw new Error(message);
    } catch { throw new Error(message); }
    finally { clearTimeout(timer); }
  }

  async function render(snapshot, options = {}) {
    if (!snapshot || !Array.isArray(snapshot.tasks)) throw new Error('ไม่มีข้อมูลรายงานสำหรับสร้างเอกสาร');
    const hasFull = Object.prototype.hasOwnProperty.call(snapshot, 'fullReport');
    const full = hasFull ? snapshot.fullReport : null;
    if (hasFull && (!full || typeof full !== 'object' || Array.isArray(full) || full.version !== 1)) throw new Error('รุ่นข้อมูลรายงานเต็มรูปแบบไม่รองรับ');
    if (full) {
      if (!global.SiteReportFullReport) throw new Error('โหลดเครื่องมือตรวจข้อมูลรายงานไม่สำเร็จ กรุณาเปิดหน้าใหม่');
      global.SiteReportFullReport.validate(full);
    }
    const checkCancelled = () => {
      if (typeof options.shouldCancel === 'function' && options.shouldCancel()) {
        const error = new Error('ยกเลิกการสร้างรายงานแล้ว ข้อมูลและรูปต้นฉบับยังอยู่ครบ');
        error.code = 'RENDER_CANCELLED';
        throw error;
      }
    };
    const progress = (phase, completed, total) => {
      checkCancelled();
      if (typeof options.onProgress === 'function') options.onProgress({ phase, completed, total });
      checkCancelled();
    };
    checkCancelled();
    if (snapshot.tasks.length > limits.maxTasks) throw resourceError('ไม่เกิน ' + limits.maxTasks + ' งาน');
    const taskIds = new Set();
    const photoIds = new Set();
    const expectedPhotos = [];
    let inputChars = 0;
    if (full?.logo?.src) {
      inputChars += full.logo.src.length;
      if (inputChars > limits.maxInputDataUrlChars) throw resourceError('ข้อมูลโลโก้เกินขีดจำกัด');
    }
    for (const task of snapshot.tasks) {
      if (!task || typeof task.id !== 'string' || !task.id || taskIds.has(task.id)) throw new Error('รหัสงานไม่ถูกต้องหรือซ้ำกัน กรุณาตรวจรายการงานก่อนสร้างรายงาน');
      taskIds.add(task.id);
      if (task.photos !== undefined && !Array.isArray(task.photos)) throw new Error('รายการรูปไม่ถูกต้อง: งาน ' + task.id);
      if ((task.photos || []).length > limits.maxPhotosPerTask) throw resourceError('ไม่เกิน ' + limits.maxPhotosPerTask + ' รูปต่องาน');
      for (const photo of task.photos || []) {
        if (!photo || !Number.isSafeInteger(photo.id) || photo.id <= 0 || photoIds.has(photo.id)) throw new Error('รหัสรูปไม่ถูกต้องหรือซ้ำกัน: งาน ' + task.id);
        photoIds.add(photo.id);
        expectedPhotos.push({ taskId: task.id, photoId: photo.id });
        if (expectedPhotos.length > limits.maxPhotos) throw resourceError('ไม่เกิน ' + limits.maxPhotos + ' รูป');
        if (typeof photo.src === 'string' && /^data:/i.test(photo.src)) {
          inputChars += photo.src.length;
          if (inputChars > limits.maxInputDataUrlChars) throw resourceError('ข้อมูลรูปเกิน 24 Mi ตัวอักษร');
        }
      }
    }
    // Existing blob URLs and legacy image dimensions retain their decoder behavior.
    // One large legacy photo can still require a large browser image-decoder allocation.
    await requireThaiFonts();
    checkCancelled();
    const audit = {
      schemaVersion: 1,
      docId: snapshot.docId,
      pageCount: 0,
      pageSize: { width: WIDTH, height: HEIGHT, paper: 'A4' },
      taskIds: snapshot.tasks.map(task => task.id),
      expectedPhotoIds: [],
      renderedPhotoIds: [],
      textBlocks: [],
      layoutVersion: full ? 'full-report-v1' : 'photo-grid-v1',
      pageHeaders: [],
      tableRows: [],
      tableHeaders: [],
      documentReferences: [],
      photos: [],
      missing: Array.isArray(snapshot.missing) ? snapshot.missing.slice() : [],
      warnings: ['MOCKUP / DRAFT: ไม่ใช่เอกสารรับรองหรือตรวจรับงาน', 'PDF เป็นภาพรายงาน ไม่ใช่ข้อความที่เลือกค้นหาได้'],
      footerSafe: true,
      bounds: { top: CONTENT_TOP, bottom: CONTENT_BOTTOM },
      fonts: FONT
    };
    const sheets = [];
    const pages = [];
    let sheet;
    let context;
    let activeCanvas;
    let activeImage;
    let retainedChars = 0;
    let completed = false;
    let y;
    let bodyTop = CONTENT_TOP;

    function releaseImage() {
      if (!activeImage) return;
      activeImage.onload = null;
      activeImage.onerror = null;
      activeImage.removeAttribute('src');
      activeImage = null;
    }
    function releaseCanvas() {
      if (activeCanvas) { activeCanvas.width = 0; activeCanvas.height = 0; }
      context = null;
      activeCanvas = null;
    }
    function allocateCanvas() {
      activeCanvas = document.createElement('canvas');
      activeCanvas.width = WIDTH;
      activeCanvas.height = HEIGHT;
      context = activeCanvas.getContext('2d');
      if (!context) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างภาพรายงาน');
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.textBaseline = 'top';
      context.textAlign = 'left';
    }
    function encodePage(type, quality) {
      checkCancelled();
      if (retainedChars + limits.maxEncodeDataUrlChars > limits.maxRetainedDataUrlChars) throw resourceError('หน่วยความจำภาพระหว่างสร้างรายงาน');
      const encoded = activeCanvas.toDataURL(type, quality);
      const prefix = 'data:' + type + ';base64,';
      if (typeof encoded !== 'string' || !encoded.startsWith(prefix) || encoded.length <= prefix.length) throw new Error('สร้างภาพหน้ารายงานไม่สำเร็จ กรุณาลองอีกครั้ง ข้อมูลต้นฉบับยังอยู่ครบ');
      if (encoded.length > limits.maxEncodeDataUrlChars || retainedChars + encoded.length > limits.maxRetainedDataUrlChars) throw resourceError('ขนาดภาพหน้ารายงาน');
      retainedChars += encoded.length;
      return encoded;
    }
    function sealPage() {
      if (!activeCanvas) return;
      try { sheet.pngDataUrl = encodePage('image/png'); }
      finally { releaseCanvas(); }
    }
    function font(size, weight = 400) { context.font = weight + ' ' + size + 'px ' + FONT; }
    function fullMasthead() {
      const top = 48, leftWidth = 664, rightWidth = CONTENT_WIDTH - leftWidth;
      const record = { page: sheets.length, x: MARGIN, y: top, width: CONTENT_WIDTH, height: 0, bodyTop: 0, fields: [] };
      function lines(field, input, x, topY, width, size = 22, weight = 400) {
        font(size, weight);
        const text = value(input), parts = wrapText(context, text, width), leading = Math.ceil(size * 1.3);
        const entry = { field, text, x, y: topY, width, height: parts.length * leading, lines: [] };
        context.fillStyle = COLORS.ink;
        for (let index = 0; index < parts.length; index++) {
          const line = { text: parts[index], x, y: topY + index * leading, width: context.measureText(parts[index]).width, height: leading };
          if (line.width > width + 0.1) throw resourceError('ข้อความหัวรายงานกว้างเกินช่อง');
          context.fillText(line.text, line.x, line.y); entry.lines.push(line);
        }
        record.fields.push(entry); return topY + entry.height;
      }
      const logoSpace = full.logo && sheets.length === 1 ? 124 : 0;
      let leftY = top + 5;
      // The generated document belongs to the project/client.  Keep an
      // explicitly supplied company identity, otherwise use the factual
      // project name instead of injecting the platform brand into the report.
      leftY = lines(full.companyName ? 'fullReport.companyName' : 'project', full.companyName || snapshot.project, MARGIN + logoSpace, leftY, leftWidth - logoSpace - 16, 27, 700);
      if (full.companyEnglish) leftY = lines('fullReport.companyEnglish', full.companyEnglish, MARGIN + logoSpace, leftY + 3, leftWidth - logoSpace - 16, 22, 700);
      if (full.companyService) leftY = lines('fullReport.companyService', full.companyService, MARGIN + logoSpace, leftY + 3, leftWidth - logoSpace - 16, 20);
      if (logoSpace) leftY = Math.max(leftY, top + 110);
      let rightY = top;
      const refs = [['fullReport.reportNumber', 'เลขที่ผู้ใช้: ', full.reportNumber], ['docId', 'รหัสระบบ: ', snapshot.docId], ['dateLabel', 'วันที่: ', snapshot.dateLabel || snapshot.date]];
      if (snapshot.reportTimestampText) refs.push(['reportTimestampText', (snapshot.reportTimestampLabel || 'จัดทำไฟล์เมื่อ') + ': ', snapshot.reportTimestampText]);
      if (full.formCode || full.formRevision) refs.unshift(['fullReport.formReference', 'แบบฟอร์ม: ', value(full.formCode) + ' / Rev. ' + value(full.formRevision)]);
      for (const [field, prefix, input] of refs) rightY = lines(field, prefix + value(input), MARGIN + leftWidth + 10, rightY, rightWidth - 10, 20);
      const stripY = Math.max(top + 112, leftY + 8, rightY + 8);
      const heading = 'DAILY SITE REPORT  |  ' + value(snapshot.title || 'รายงานประจำวัน');
      font(24, 700); const stripHeight = wrapText(context, heading, CONTENT_WIDTH - 20).length * 32 + 8;
      context.fillStyle = '#eaf0f5'; context.fillRect(MARGIN, stripY, CONTENT_WIDTH, stripHeight);
      lines('reportType', heading, MARGIN + 10, stripY + 4, CONTENT_WIDTH - 20, 24, 700);
      bodyTop = stripY + stripHeight + 8;
      if (bodyTop > CONTENT_BOTTOM - 500) throw resourceError('หัวรายงานยาวเกินพื้นที่ กรุณาย่อข้อมูลหัวกระดาษก่อนส่งออก');
      record.height = bodyTop - top - 8; record.bodyTop = bodyTop;
      audit.bounds.top = audit.pageHeaders.length ? Math.min(audit.bounds.top, bodyTop) : bodyTop;
      audit.pageHeaders.push(record); y = bodyTop;
    }
    function masthead() {
      const top = 48;
      const padding = 14;
      const widths = [280, 350, 442];
      const record = { page: sheets.length, x: MARGIN, y: top, width: CONTENT_WIDTH, height: 0, bodyTop: 0, fields: [] };
      const measure = (field, input, width, size = 22, weight = 400) => {
        const text = value(input);
        font(size, weight);
        const lines = wrapText(context, text, width);
        return { field, text, width, size, weight, lines, leading: Math.ceil(size * 1.4) };
      };
      function draw(item, x, topY, centered = false) {
        font(item.size, item.weight);
        context.fillStyle = COLORS.ink;
        const entry = { field: item.field, text: item.text, x, y: topY, width: item.width, height: item.lines.length * item.leading, lines: [] };
        item.lines.forEach((text, index) => {
          const width = context.measureText(text).width;
          if (width > item.width + 0.1) throw resourceError('ข้อความหัวรายงานกว้างเกินช่อง');
          const line = { text, x: centered ? x + (item.width - width) / 2 : x, y: topY + index * item.leading, width, height: item.leading };
          context.fillText(text, line.x, line.y);
          entry.lines.push(line);
        });
        record.fields.push(entry);
      }
      const title = measure('title', snapshot.title || 'รายงานความก้าวหน้าประจำวัน', widths[1] - padding * 2, 22);
      const references = [
        ['REPORT NO.', measure('docId', snapshot.docId, widths[2] - 112, 20, 700)],
        ['DATE', measure('dateLabel', snapshot.dateLabel || snapshot.date, widths[2] - 112, 20)],
        ...(snapshot.reportTimestampText ? [['TIME', measure('reportTimestampText', (snapshot.reportTimestampLabel || 'จัดทำไฟล์เมื่อ') + ': ' + snapshot.reportTimestampText, widths[2] - 112, 18)]] : []),
        ['STATUS', measure('status', 'MOCKUP / DRAFT', widths[2] - 112, 20, 700)]
      ];
      const referenceHeight = references.reduce((sum, [, item]) => sum + item.lines.length * item.leading + 12, 0);
      const height = Math.max(114, 56 + title.lines.length * title.leading + padding, referenceHeight);
      context.strokeStyle = '#748591'; context.lineWidth = 1;
      let left = MARGIN;
      for (const width of widths) { context.strokeRect(left, top, width, height); left += width; }
      draw(measure('documentLabel', 'SITE REPORT', widths[0] - padding * 2, 24, 700), MARGIN + padding, top + 20);
      draw(measure('documentDescription', 'รายงานหน้างานประจำวัน', widths[0] - padding * 2, 20), MARGIN + padding, top + 60);
      draw(measure('reportType', 'DAILY REPORT', widths[1] - padding * 2, 34, 700), MARGIN + widths[0] + padding, top + 13, true);
      draw(title, MARGIN + widths[0] + padding, top + 62, true);
      left = MARGIN + widths[0] + widths[1];
      let rowY = top;
      for (const [name, item] of references) {
        draw(measure('label.' + item.field, name, 88, 16), left + 9, rowY + 8);
        draw(item, left + 98, rowY + 6);
        rowY += item.lines.length * item.leading + 12;
        if (rowY < top + height) { context.strokeStyle = '#aebdc8'; context.beginPath(); context.moveTo(left, rowY); context.lineTo(left + widths[2], rowY); context.stroke(); }
      }
      rowY = top + height + 10;
      for (const [field, name, input] of [['project', 'PROJECT / โครงการ', snapshot.project], ['site', 'LOCATION / สถานที่', snapshot.site]]) {
        const item = measure(field, input, CONTENT_WIDTH - 190, 23, field === 'project' ? 700 : 400);
        const label = measure('label.' + field, name, 148, 17);
        const rowHeight = Math.max(item.lines.length * item.leading, label.lines.length * label.leading) + 16;
        context.strokeStyle = '#aebdc8'; context.strokeRect(MARGIN, rowY, CONTENT_WIDTH, rowHeight);
        context.beginPath(); context.moveTo(MARGIN + 168, rowY); context.lineTo(MARGIN + 168, rowY + rowHeight); context.stroke();
        draw(label, MARGIN + 10, rowY + 8);
        draw(item, MARGIN + 180, rowY + 8);
        rowY += rowHeight;
      }
      bodyTop = rowY + 12;
      if (bodyTop > CONTENT_BOTTOM - 450) throw resourceError('หัวรายงานยาวเกินพื้นที่ กรุณาย่อชื่อโครงการหรือสถานที่ก่อนส่งออก');
      record.height = rowY - top; record.bodyTop = bodyTop;
      audit.pageHeaders.push(record);
      audit.bounds.top = bodyTop;
      y = bodyTop;
    }
    function newPage(kind = 'รายละเอียดรายงาน') {
      checkCancelled();
      if (sheets.length >= limits.maxPages) throw resourceError('ไม่เกิน ' + limits.maxPages + ' หน้า');
      sealPage();
      allocateCanvas();
      sheet = { kind, photoCount: 0, pngDataUrl: null };
      sheets.push(sheet);
      context.fillStyle = COLORS.white;
      context.fillRect(0, 0, WIDTH, HEIGHT);
      if (full) fullMasthead(); else masthead();
      if (/^(ข้อมูลภาพ|คำบรรยายภาพ) /.test(kind)) block('table.photo.continue.' + sheets.length, kind, { size: 23, leading: 34, weight: 700, after: 10 });
      else if (full && sheets.length > 1 && kind.includes('(ต่อ)')) block('table.section.continue.' + sheets.length, kind, { size: 22, leading: 29, weight: 700, after: 8 });
    }

    function ensure(height, kind) {
      if (y + height > CONTENT_BOTTOM) newPage(kind || 'รายละเอียดรายงาน (ต่อ)');
    }

    function block(field, input, options = {}) {
      const text = value(input);
      const x = options.x === undefined ? MARGIN : options.x;
      const width = options.width || CONTENT_WIDTH;
      const size = options.size || 25;
      const leading = options.leading || Math.ceil(size * 1.56);
      const weight = options.weight || 400;
      font(size, weight);
      const lines = wrapText(context, text, width);
      const entry = { field, text, pages: [], lines: [] };
      audit.textBlocks.push(entry);
      for (const line of lines) {
        ensure(leading, options.continuation);
        font(size, weight);
        context.fillStyle = options.color || COLORS.body;
        context.fillText(line, x, y);
        const page = sheets.length;
        if (!entry.pages.includes(page)) entry.pages.push(page);
        entry.lines.push({ page, x, y, width: context.measureText(line).width, height: leading, text: line });
        y += leading;
      }
      y += options.after === undefined ? 10 : options.after;
      return entry;
    }

    function rule(space = 17) {
      ensure(space + 2);
      y += space;
      context.fillStyle = COLORS.line;
      context.fillRect(MARGIN, y, CONTENT_WIDTH, 1);
      y += space + 1;
    }

    function section(number, title, reserve = 120) {
      ensure(reserve);
      context.fillStyle = COLORS.soft;
      context.fillRect(MARGIN, y, CONTENT_WIDTH, 47);
      y += 5;
      block('section.' + number, number + '  ' + title, { x: MARGIN + 12, width: CONTENT_WIDTH - 24, size: 27, leading: 37, weight: 700, color: COLORS.ink, after: 13 });
    }

    const cell = (field, input, extra = {}) => ({ field, text: value(input), ...extra });
    const label = text => ({ text, label: true, size: 22 });

    // Keep physical cells and every drawn line in the audit. A long row is split,
    // never clipped/shrunk, and carries its identity and column headers forward.
    async function table(tableId, widths, rows, options = {}) {
      if (widths.reduce((sum, width) => sum + width, 0) !== CONTENT_WIDTH) throw new Error('ความกว้างตารางรายงานไม่ถูกต้อง');
      const padding = full ? 6 : 12;
      const leading = full ? 29 : 34;
      const prepare = (cells, rowIndex, header = false) => cells.map((input, column) => {
        const item = typeof input === 'string' ? label(input) : input;
        const field = item.field || `table.${tableId}.${header ? 'header' : 'label.' + rowIndex}.${column}`;
        const entry = { field, text: value(item.text), pages: [], lines: [] };
        audit.textBlocks.push(entry);
        const size = item.size || (full ? 22 : (header ? 23 : 24));
        const weight = item.weight || (header ? 700 : 400);
        font(size, weight);
        const lines = wrapText(context, entry.text, widths[column] - padding * 2);
        if (lines.some(line => context.measureText(line).width > widths[column] - padding * 2 + 0.1)) throw new Error('ข้อความกว้างเกินช่องตาราง กรุณาตรวจข้อมูลรายงาน');
        return { ...item, entry, size, weight, lines };
      });
      const prepared = rows.map((row, rowIndex) => prepare(row, rowIndex));
      const headers = options.headers ? prepare(options.headers, -1, true) : null;
      const lineCount = row => Math.max(1, ...row.map(item => item.lines.length));
      const headerHeight = headers ? lineCount(headers) * leading + padding * 2 : 0;
      const rowHeight = row => lineCount(row) * leading + padding * 2;
      function draw(row, rowIndex, part, offset, count, header = false) {
        const height = count * leading + padding * 2;
        const record = { tableId, rowIndex, part, page: sheets.length, x: MARGIN, y, width: CONTENT_WIDTH, height, cells: [] };
        let x = MARGIN;
        for (let column = 0; column < row.length; column++) {
          const item = row[column];
          const width = widths[column];
          context.fillStyle = full ? (header || item.label ? '#e3ecf3' : (rowIndex % 2 ? '#f6f8fa' : COLORS.white)) : (header || item.label ? COLORS.soft : COLORS.white);
          context.fillRect(x, y, width, height);
          context.strokeStyle = '#aebdc8';
          context.lineWidth = 1;
          context.strokeRect(x, y, width, height);
          font(item.size, item.weight);
          context.fillStyle = item.color || (item.label ? COLORS.muted : COLORS.body);
          const box = { field: item.entry.field, text: item.entry.text, x, y, width, height, lines: [] };
          for (let index = offset; index < Math.min(offset + count, item.lines.length); index++) {
            const line = item.lines[index];
            const position = { page: sheets.length, x: x + padding, y: y + padding + (index - offset) * leading, width: context.measureText(line).width, height: leading, text: line };
            context.fillText(line, position.x, position.y);
            if (!item.entry.pages.includes(sheets.length)) item.entry.pages.push(sheets.length);
            item.entry.lines.push(position);
            box.lines.push(position);
          }
          record.cells.push(box);
          x += width;
        }
        (header ? audit.tableHeaders : audit.tableRows).push(record);
        y += height;
      }
      function drawHeaders() { if (headers) draw(headers, -1, 0, 0, lineCount(headers), true); }
      if (!prepared.length) return;
      const firstRowFitsPage = rowHeight(prepared[0]) <= CONTENT_BOTTOM - bodyTop - headerHeight;
      const firstHeight = full && firstRowFitsPage ? rowHeight(prepared[0]) : leading + padding * 2;
      if (y + headerHeight + firstHeight > CONTENT_BOTTOM) newPage(options.title || 'รายละเอียดตาราง (ต่อ)');
      drawHeaders();
      for (let rowIndex = 0; rowIndex < prepared.length; rowIndex++) {
        checkCancelled();
        const row = prepared[rowIndex];
        const total = lineCount(row);
        // Move an ordinary row intact. A row taller than a page is explicitly split.
        if (rowIndex > 0 && y + rowHeight(row) > CONTENT_BOTTOM && rowHeight(row) <= CONTENT_BOTTOM - bodyTop - headerHeight) {
          newPage(options.title || 'รายละเอียดตาราง (ต่อ)');
          drawHeaders();
        }
        let offset = 0;
        let part = 0;
        while (offset < total) {
          checkCancelled();
          let available = Math.floor((CONTENT_BOTTOM - y - padding * 2) / leading);
          if (available < 1) {
            newPage(options.title || 'รายละเอียดตาราง (ต่อ)');
            if (offset) block(`table.${tableId}.continue.${rowIndex}.${part}`, (options.identities?.[rowIndex] || 'รายการ ' + (rowIndex + 1)) + ' (ต่อ)', { size: 23, leading: 34, weight: 700, after: 8 });
            drawHeaders();
            available = Math.floor((CONTENT_BOTTOM - y - padding * 2) / leading);
          }
          const count = Math.min(total - offset, available);
          draw(row, rowIndex, part, offset, count);
          offset += count;
          part++;
          await nextFrame();
          checkCancelled();
        }
      }
      y += full ? 8 : 15;
    }

    async function summary() {
    newPage('สรุปรายงานประจำวัน');
    block('title', snapshot.title || 'รายงานความก้าวหน้าประจำวัน', { size: 38, leading: 56, weight: 700, color: COLORS.ink, after: 15 });
    section('01', 'ข้อมูลโครงการ');
    await table('project', [164, 372, 164, 372], [
      [label('เลขที่รายงาน'), cell('docId', snapshot.docId, { size: 23 }), label('วันที่รายงาน'), cell('dateLabel', snapshot.dateLabel || snapshot.date)],
      [label('โครงการ'), cell('project', snapshot.project, { weight: 700 }), label('สถานที่'), cell('site', snapshot.site)],
      [label('ผู้บันทึก'), cell('reporter', snapshot.reporter), label('เรียน / ผู้รับรายงาน'), cell('recipient', snapshot.recipient)],
      [label('สภาพอากาศ'), cell('weather', snapshot.weather), label('ทีมงาน'), cell('workersLabel', snapshot.workersLabel)]
    ], { title: 'ข้อมูลโครงการ (ต่อ)', identities: ['เลขที่รายงาน / วันที่', 'โครงการ / สถานที่', 'ผู้บันทึก / ผู้รับรายงาน', 'อากาศ / ทีมงาน'] });
    section('02', 'งานที่ดำเนินการ', 260);
    block('summary.counts', snapshot.tasks.length + ' รายการงาน  /  ' + snapshot.tasks.reduce((sum, task) => sum + (task.photos || []).length, 0) + ' รูปประกอบ', { size: 22, leading: 32, color: COLORS.muted, after: 10 });

    if (snapshot.tasks.length === 0) block('tasks.empty', 'ยังไม่ได้เลือกรายการงาน');
    await table('work', [245, 190, 190, 337, 110], snapshot.tasks.map((task, taskIndex) => {
      const prefix = 'tasks.' + task.id;
      const count = (task.photos || []).length;
      return [cell(prefix + '.title', String(taskIndex + 1).padStart(2, '0') + '  ' + value(task.title), { weight: 700 }), cell(prefix + '.zone', task.zone), cell(prefix + '.statusLabel', task.statusLabel, { weight: 700 }), cell(prefix + '.note', task.note), cell(count ? prefix + '.photoCount' : 'table.work.photoCount.' + task.id, count + ' รูป')];
    }), { title: 'งานที่ดำเนินการ (ต่อ)', headers: ['งานที่ดำเนินการ', 'จุด / ชั้น', 'สถานะตามบันทึก', 'รายละเอียด / หมายเหตุ', 'รูป'], identities: snapshot.tasks.map((_, index) => 'งาน ' + String(index + 1).padStart(2, '0')) });

    section('03', 'ปัญหาและการประสานงาน');
    const issue = snapshot.issue || {};
    const issueStateLabel = issue.state === 'yes' ? 'มีปัญหา / รอประสานงาน' : issue.state === 'no' ? 'ผู้บันทึกระบุว่าไม่มีเรื่องแจ้งในรายงานนี้' : value(issue.state);
    await table('issue-state', [164, 908], [[label('สถานะปัญหา'), cell('issue.state', issueStateLabel, { weight: 700 })]], { title: 'ปัญหาและการประสานงาน (ต่อ)' });
    if (issue.state === 'yes') {
      await table('issue-details', [164, 372, 164, 372], [
        [label('งานที่เกี่ยวข้อง'), cell('issue.taskLabel', issue.taskLabel), label('ประเภทปัญหา'), cell('issue.type', issue.type)],
        [label('ความเร่งด่วน'), cell('issue.urgencyLabel', issue.urgencyLabel), label('ผู้ประสานงาน'), cell('issue.owner', issue.owner)]
      ], { title: 'รายละเอียดปัญหา (ต่อ)', identities: ['งาน / ประเภทปัญหา', 'ความเร่งด่วน / ผู้ประสานงาน'] });
      await table('issue-notes', [164, 908], [[label('กำหนดติดตาม'), cell('issue.dueLabel', issue.dueLabel)], [label('รายละเอียด'), cell('issue.note', issue.note)]], { title: 'รายละเอียดปัญหา (ต่อ)', identities: ['กำหนดติดตาม', 'รายละเอียดปัญหา'] });
    }

    section('04', 'ทรัพยากรและแผนถัดไป');
    await table('resources', [164, 908], [[label('วัสดุ / เครื่องจักร'), cell('resources', snapshot.resources)], [label('งานพรุ่งนี้'), cell('tomorrow', snapshot.tomorrow)]], { title: 'ทรัพยากรและแผนถัดไป (ต่อ)', identities: ['วัสดุ / เครื่องจักร', 'งานพรุ่งนี้'] });
    if (audit.missing.length) {
      section('05', 'ข้อมูลที่ยังไม่ครบ');
      await table('missing', [CONTENT_WIDTH], audit.missing.map((item, index) => [cell('missing.' + index, (index + 1) + '. ' + item, { size: 23, color: COLORS.amber })]), { title: 'ข้อมูลที่ยังไม่ครบ (ต่อ)' });
    }
    }

    // The full report is an additive snapshot format. Legacy revisions keep the
    // original rendering path and source fields; neither path mutates its input.
    async function fullDocument(allPhotos) {
      const conditionLabels = { normal: 'ปกติ', watch: 'เฝ้าระวัง', issue: 'มีประเด็น' };
      const priorityLabels = { low: 'ต่ำ', normal: 'กลาง', high: 'สูง' };
      const followupLabels = { open: 'รอติดตาม', doing: 'กำลังดำเนินการ', done: 'ผู้บันทึกระบุว่าเสร็จ' };
      const num = input => input === '' || input === null || input === undefined ? null : Number(input);
      const percent = input => num(input) === null ? 'ยังไม่ระบุ' : String(input) + '%';
      const delta = (planned, actual) => {
        const difference = global.SiteReportFullReport.progress(planned ?? '', actual ?? '');
        return difference === null ? 'ยังไม่ระบุ' : (difference > 0 ? '+' : '') + difference + ' จุดเปอร์เซ็นต์';
      };
      const laborKeys = ['engineer', 'foreman', 'formwork', 'rebar', 'mason', 'systems', 'general', 'other'];
      const laborLabels = ['วิศวกร / ผู้ควบคุมงาน', 'โฟร์แมน', 'ช่างไม้แบบ', 'ช่างเหล็ก', 'ช่างก่อ', 'ช่างระบบ', 'คนงานทั่วไป', 'ผู้รับเหมาช่วงอื่น'];
      const labor = full.labor, workforce = global.SiteReportFullReport.workforce(labor);
      const laborSummary = workforce.filled ? (workforce.complete ? 'รวมทั้งหมด: ' : 'รวมที่ระบุ: ') + workforce.total + ' คน (' + workforce.filled + '/8 ประเภท)' : 'แรงงาน: ยังไม่ระบุ';
      audit.sourceFields = [];
      function recordSource(input, path) {
        if (input === null || typeof input !== 'object') { audit.sourceFields.push({ field: path, value: input }); return; }
        for (const [key, child] of Object.entries(input)) if (key !== 'src') recordSource(child, path + '.' + key);
      }
      recordSource(snapshot, 'snapshot');
      function band(number, title, reserve = 76) {
        ensure(reserve, title + ' (ต่อ)');
        context.fillStyle = '#173d61'; context.fillRect(MARGIN, y, CONTENT_WIDTH, 36);
        y += 2;
        block('section.' + number, number + '  ' + title, { x: MARGIN + 10, width: CONTENT_WIDTH - 20, size: 24, leading: 32, weight: 700, color: '#f8fafc', after: 10 });
      }
      const fc = (field, text, extra = {}) => cell(field, text, { size: 22, ...extra });
      const joined = (...parts) => parts.join('  |  ');
      const field = (key, prefix = '') => prefix + value(full[key]);
      function contain(image, x, top, width, height) {
        context.fillStyle = '#f1f5f8'; context.fillRect(x, top, width, height);
        if (!image) {
          font(22, 700); context.fillStyle = COLORS.muted;
          context.fillText('ภาพจำลอง - ไม่ใช่หลักฐานจริง', x + 12, top + height / 2);
          return { x, y: top, width, height };
        }
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const bounds = { x: x + (width - image.naturalWidth * scale) / 2, y: top + (height - image.naturalHeight * scale) / 2, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
        context.drawImage(image, bounds.x, bounds.y, bounds.width, bounds.height); return bounds;
      }
      newPage('ข้อมูลรายงานและภาพหน้างาน');
      if (full.logo) {
        const logo = await decodePhoto({ id: 'company-logo', src: full.logo.src }, 'company', image => { activeImage = image; });
        checkCancelled();
        if (logo.naturalWidth !== full.logo.width || logo.naturalHeight !== full.logo.height) throw new Error('ขนาดโลโก้ไม่ตรงกับข้อมูลที่บันทึก กรุณาแนบโลโก้ใหม่');
        audit.logo = { page: 1, contained: true, sourceWidth: logo.naturalWidth, sourceHeight: logo.naturalHeight, bounds: contain(logo, MARGIN, 48, 110, 110) };
        releaseImage();
      }
      band('01', 'ข้อมูลรายงานและสภาพหน้างาน');
      await table('full-project', [172, 900], [
        [label('ชื่อโครงการ'), fc('project', snapshot.project, { weight: 700 })],
        [label('สถานที่ก่อสร้าง'), fc('site', snapshot.site)],
        [label('ผู้เกี่ยวข้อง'), fc('fullReport.parties', joined(field('ownerName', 'เจ้าของ: '), field('contractorName', 'ผู้รับเหมา: ')))],
        [label('ผู้จัดทำ / เวลา'), fc('fullReport.reporterHours', joined(value(snapshot.reporter), value(full.workStart) + '-' + value(full.workEnd), 'ผู้รับ: ' + value(snapshot.recipient)))],
        [label('สภาพอากาศ'), fc('fullReport.weather', joined(field('weatherMorning', 'เช้า: '), field('weatherAfternoon', 'บ่าย: '), field('rain', 'ฝน: '), 'บันทึกเดิม: ' + value(snapshot.weather)))]
      ], { title: 'ข้อมูลรายงาน (ต่อ)' });
      band('02', 'แผนเทียบผลงานจริง (ตามที่ผู้บันทึกกรอก)');
      await table('full-work', [45, 235, 130, 85, 85, 190, 302], snapshot.tasks.length ? snapshot.tasks.map((task, index) => {
        const progress = full.progress?.[task.id] || {}, prefix = 'tasks.' + task.id;
        return [fc(prefix + '.index', String(index + 1)), fc(prefix + '.title', task.title, { weight: 700 }), fc(prefix + '.zone', task.zone), fc('fullReport.progress.' + task.id + '.planned', percent(progress.planned)), fc('fullReport.progress.' + task.id + '.actual', percent(progress.actual)), fc(prefix + '.statusDelta', value(task.statusLabel) + '\n' + delta(progress.planned, progress.actual)), fc(prefix + '.note', value(task.note) + ' | ' + (task.photos || []).length + ' รูป')];
      }) : [[fc('tasks.empty', '-'), fc('tasks.emptyText', 'ยังไม่ได้เลือกรายการงาน'), fc('tasks.emptyZone', '-'), fc('tasks.emptyPlan', '-'), fc('tasks.emptyActual', '-'), fc('tasks.emptyStatus', '-'), fc('tasks.emptyNote', '-')]], { title: 'แผนเทียบผลงานจริง (ต่อ)', headers: ['ที่', 'งานที่ดำเนินการ', 'ตำแหน่ง', 'แผน %', 'จริง %', 'สถานะ / ผลต่าง', 'รายละเอียด / รูป'], identities: snapshot.tasks.map((task, index) => 'งาน ' + (index + 1) + ' ' + task.title) });
      await table('full-overall', [245, 245, 292, 290], [[fc('fullReport.plannedOverall', 'แผนสะสม: ' + percent(full.plannedOverall)), fc('fullReport.actualOverall', 'ผลจริง: ' + percent(full.actualOverall)), fc('fullReport.overallDelta', 'ผลต่าง: ' + delta(full.plannedOverall, full.actualOverall)), fc('fullReport.laborSummary', laborSummary)]], { title: 'สรุปภาพรวม (ต่อ)' });

      const gap = 12, padding = 8, width = (CONTENT_WIDTH - gap) / 2, textWidth = width - padding * 2;
      function textsFor(task, photo, index) {
        const details = full.photoDetails?.[photo.id] || {};
        return [
          { key: 'titleCaption', text: 'ภาพ ' + String(index + 1).padStart(2, '0') + ' / ' + allPhotos.length + ': ' + value(photo.caption || (photo.sample ? 'ภาพตัวอย่าง' : 'ยังไม่ระบุคำบรรยายภาพ')), size: 22, weight: 700, leading: 28 },
          { key: 'zonePhase', text: joined(value(photo.taskTitle || task.title), value(photo.zone || task.zone), value(photo.phase)), size: 20, leading: 25 },
          { key: 'manualDetails', text: joined('เวลาถ่าย (กรอกเอง): ' + value(details.capturedAt), 'ผู้ถ่าย: ' + value(details.photographer), 'สภาพ: ' + value(conditionLabels[details.condition])), size: 20, leading: 25 },
          { key: 'source', text: photo.sample ? 'ภาพจำลอง - ไม่ใช่หลักฐานหน้างาน' : 'นำเข้า: ' + value(photo.importedAt) + ' (ไม่ใช่เวลาถ่าย)', size: 20, leading: 25 }
        ];
      }
      const textHeight = texts => texts.reduce((sum, item) => { font(item.size, item.weight || 400); return sum + wrapText(context, item.text, textWidth).length * item.leading + 2; }, 0);
      let grid = null;
      for (let index = 0; index < allPhotos.length; index++) {
        const { task, photo } = allPhotos[index], prefix = 'tasks.' + task.id + '.photos.' + photo.id;
        const texts = textsFor(task, photo, index);
        if (!grid || grid.count === 4) {
          const batch = allPhotos.slice(index, index + 4), rows = Math.ceil(batch.length / 2);
          const tallest = Math.max(...batch.map((item, offset) => textHeight(textsFor(item.task, item.photo, index + offset))));
          const minimum = rows * (tallest + 130 + padding * 3) + (rows - 1) * gap + 44;
          if (CONTENT_BOTTOM - y < minimum) newPage('ภาพถ่ายหน้างาน (ต่อ)');
          band('03' + (index ? '-ต่อ' : ''), 'ภาพถ่ายหน้างาน · ' + allPhotos.length + ' ภาพ', 76);
          grid = { top: y, height: Math.floor((CONTENT_BOTTOM - y - (rows - 1) * gap) / rows), count: 0 };
        }
        let image = await decodePhoto(photo, task.id, image => { activeImage = image; }); checkCancelled();
        const sourceWidth = image ? image.naturalWidth : null, sourceHeight = image ? image.naturalHeight : null;
        const frameHeight = grid.height - textHeight(texts) - padding * 3;
        let bounds, cardBounds, titlePages, photoPage, layout;
        if (frameHeight >= 130) {
          const x = MARGIN + grid.count % 2 * (width + gap), top = grid.top + Math.floor(grid.count / 2) * (grid.height + gap);
          cardBounds = { x, y: top, width, height: grid.height };
          context.strokeStyle = '#bac9d4'; context.lineWidth = 1; context.strokeRect(x, top, width, grid.height);
          bounds = contain(image, x + padding, top + padding, textWidth, frameHeight);
          let textY = top + padding * 2 + frameHeight;
          for (const item of texts) {
            const savedY = y; y = textY;
            const entry = block(prefix + '.' + item.key, item.text, { x: x + padding, width: textWidth, size: item.size, leading: item.leading, weight: item.weight || 400, after: 2 });
            if (item.key === 'titleCaption') titlePages = entry.pages.slice();
            textY = y; y = savedY;
          }
          photoPage = sheets.length; layout = 'full-report-grid-2x2'; grid.count++;
          y = grid.top + (Math.floor((grid.count - 1) / 2) + 1) * (grid.height + gap);
        } else {
          if (grid.count) newPage('ข้อมูลภาพ ' + (index + 1) + ' (รายละเอียด)'); else y = grid.top;
          grid = null;
          titlePages = block(prefix + '.identity', 'ภาพ ' + (index + 1) + ' / ' + allPhotos.length, { size: 24, leading: 32, after: 8 }).pages;
          if (CONTENT_BOTTOM - y < 300) newPage('ข้อมูลภาพ ' + (index + 1) + ' (ต่อ)');
          const height = Math.min(440, CONTENT_BOTTOM - y - 40);
          bounds = contain(image, MARGIN, y, CONTENT_WIDTH, height); photoPage = sheets.length;
          y += height + 10; layout = 'full-report-detail'; releaseImage(); image = null;
          for (const item of texts) block(prefix + '.' + item.key, item.text, { size: 22, leading: 29, weight: item.weight || 400, after: 8, continuation: 'คำบรรยายภาพ ' + (index + 1) + ' (ต่อ)' });
        }
        sheet.photoCount++; audit.renderedPhotoIds.push(photo.id);
        audit.photos.push({ taskId: task.id, photoId: photo.id, page: photoPage, titlePages, sample: !!photo.sample, caption: value(photo.caption), phase: photo.phase, zone: photo.zone, taskTitle: photo.taskTitle, importedAt: photo.importedAt, capturedAt: full.photoDetails?.[photo.id]?.capturedAt, photographer: full.photoDetails?.[photo.id]?.photographer, condition: full.photoDetails?.[photo.id]?.condition, contained: true, sourceWidth, sourceHeight, bounds, cardBounds, layout });
        releaseImage(); image = null; progress('photos', index + 1, allPhotos.length); await nextFrame(); checkCancelled();
      }
      if (!allPhotos.length) { band('03', 'ภาพถ่ายหน้างาน'); block('photos.empty', 'ยังไม่ได้แนบรูปถ่าย', { size: 22, leading: 29 }); }

      newPage('แรงงาน ทรัพยากร และการติดตาม');
      band('04', 'แรงงานประจำวัน');
      await table('full-labor', [350, 186, 350, 186], Array.from({ length: 4 }, (_, index) => {
        const a = index * 2, b = a + 1;
        return [label(laborLabels[a]), fc('fullReport.labor.' + laborKeys[a], num(labor[laborKeys[a]]) === null ? 'ยังไม่ระบุ' : labor[laborKeys[a]] + ' คน'), label(laborLabels[b]), fc('fullReport.labor.' + laborKeys[b], num(labor[laborKeys[b]]) === null ? 'ยังไม่ระบุ' : labor[laborKeys[b]] + ' คน')];
      }), { title: 'แรงงานประจำวัน (ต่อ)' });
      await table('full-labor-total', [CONTENT_WIDTH], [[fc('fullReport.laborTotal', laborSummary + ' | จำนวนทีมงานในฟอร์มเดิม: ' + value(snapshot.workersLabel) + ' (ข้อมูลคนละช่อง โปรดตรวจให้ตรงกัน)')]], { title: 'สรุปแรงงาน (ต่อ)' });
      band('05', 'รายการติดตามจากวันก่อน');
      await table('full-followups', [382, 196, 174, 126, 194], (full.followups || []).length ? full.followups.map(item => [fc('fullReport.followups.' + item.id + '.title', item.title), fc('fullReport.followups.' + item.id + '.responsible', item.responsible), fc('fullReport.followups.' + item.id + '.due', item.due), fc('fullReport.followups.' + item.id + '.priority', priorityLabels[item.priority]), fc('fullReport.followups.' + item.id + '.status', followupLabels[item.status])]) : [[fc('followups.empty', 'ยังไม่ระบุรายการติดตาม'), fc('followups.owner.empty', '-'), fc('followups.due.empty', '-'), fc('followups.priority.empty', '-'), fc('followups.status.empty', '-')]], { title: 'รายการติดตาม (ต่อ)', headers: ['ประเด็น / งานค้าง', 'ผู้รับผิดชอบ', 'กำหนดเสร็จ', 'ความสำคัญ', 'สถานะตามบันทึก'] });
      band('06', 'วัสดุและเครื่องจักรสำคัญ');
      await table('full-materials', [310, 160, 116, 244, 242], (full.materials || []).length ? full.materials.map(item => ['name', 'quantity', 'unit', 'usage', 'status'].map(key => fc('fullReport.materials.' + item.id + '.' + key, item[key]))) : [[fc('materials.empty', 'ยังไม่ระบุรายการ'), fc('materials.quantity.empty', '-'), fc('materials.unit.empty', '-'), fc('materials.usage.empty', '-'), fc('materials.status.empty', '-')]], { title: 'วัสดุและเครื่องจักร (ต่อ)', headers: ['รายการ', 'จำนวน', 'หน่วย', 'การใช้ / รับเข้า', 'สถานะ / หมายเหตุ'] });
      if (snapshot.resources) await table('full-resources-note', [172, 900], [[label('บันทึกทรัพยากร'), fc('resources', snapshot.resources)]], { title: 'บันทึกทรัพยากร (ต่อ)' });
      band('07', 'คุณภาพ ความปลอดภัย และแผนงานถัดไป');
      await table('full-quality', [212, 860], [
        [label('ตรวจคุณภาพ'), fc('fullReport.quality', full.quality)],
        [label('ความปลอดภัย'), fc('fullReport.safety', joined(field('safetyIncident', 'อุบัติเหตุ: '), field('nearMiss', 'Near miss: '), field('ppe', 'PPE: '), field('toolboxTime', 'Toolbox: ')))],
        [label('ผลกระทบต่อแผน'), fc('fullReport.scheduleImpact', full.scheduleImpact)],
        [label('แผนงานวันถัดไป'), fc('tomorrow', snapshot.tomorrow)]
      ], { title: 'คุณภาพและแผนถัดไป (ต่อ)' });
      band('08', 'หมายเหตุ / การประสานงาน');
      await table('full-coordination', [172, 900], [[label('การประสานงาน'), fc('fullReport.coordination', full.coordination)]], { title: 'การประสานงาน (ต่อ)' });
      const issue = snapshot.issue || {};
      const issueLabel = issue.state === 'yes' ? 'มีปัญหา / รอประสานงาน' : issue.state === 'no' ? 'ผู้บันทึกระบุว่าไม่มีเรื่องแจ้งในรายงานนี้' : value(issue.state);
      const issueRows = [[label('ปัญหาวันนี้'), fc('issue.state', issueLabel)]];
      if (issue.state === 'yes') for (const [key, name] of [['taskLabel', 'งานที่เกี่ยวข้อง'], ['type', 'ประเภทปัญหา'], ['urgencyLabel', 'ความเร่งด่วน'], ['owner', 'ผู้ประสานงาน'], ['dueLabel', 'กำหนดติดตาม'], ['note', 'รายละเอียด']]) issueRows.push([label(name), fc('issue.' + key, issue[key])]);
      await table('full-issue', [172, 900], issueRows, { title: 'ปัญหาวันนี้ (ต่อ)' });
      band('09', 'ช่องลงชื่อ (ยังไม่ลงนาม / ไม่ใช่การรับรอง)', 220);
      const signatures = full.signatures || {}, signatureKeys = ['preparer', 'supervisor', 'ownerRepresentative'];
      await table('full-signatures', [357, 358, 357], [
        signatureKeys.map(key => fc('fullReport.signatures.' + key, 'ลงชื่อ ................................\n' + value(signatures[key]))),
        signatureKeys.map(key => fc('fullReport.signatures.' + key + 'Date', 'วันที่: ' + value(signatures[key + 'Date'])))
      ], { title: 'ช่องลงชื่อ (ต่อ)', headers: ['ผู้จัดทำรายงาน', 'ผู้ควบคุมงาน', 'ผู้แทนเจ้าของงาน'] });
      if (audit.missing.length) {
        band('10', 'ข้อมูลที่ยังไม่ครบ');
        await table('full-missing', [CONTENT_WIDTH], audit.missing.map((item, index) => [fc('missing.' + index, item, { color: COLORS.amber })]), { title: 'ข้อมูลที่ยังไม่ครบ (ต่อ)' });
      }
    }

    try {
    progress('photos', 0, expectedPhotos.length);
    const allPhotos = snapshot.tasks.flatMap(task => (task.photos || []).map(photo => ({ task, photo })));
    audit.expectedPhotoIds = allPhotos.map(({ photo }) => photo.id);
    if (full) await fullDocument(allPhotos);
    else {
    const gap = 18;
    const cardWidth = (CONTENT_WIDTH - gap) / 2;
    const photoPadding = 10;
    let grid = null;
    function photoBand() {
      context.fillStyle = COLORS.ink;
      context.fillRect(MARGIN, y, CONTENT_WIDTH, 38);
      block('section.PHOTO', 'PHOTO RECORD - ภาพประกอบการทำงาน', { x: MARGIN + 12, width: CONTENT_WIDTH - 24, size: 22, leading: 32, weight: 700, color: COLORS.white, after: 20 });
    }
    function gridPage() {
      newPage('ภาพประกอบการทำงาน');
      photoBand();
      grid = { top: y, height: Math.floor((CONTENT_BOTTOM - y - gap) / 2), count: 0 };
    }
    function containedImage(image, x, top, width, height) {
      context.fillStyle = COLORS.soft; context.fillRect(x, top, width, height);
      if (image) {
        const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
        const placed = { x: x + (width - image.naturalWidth * scale) / 2, y: top + (height - image.naturalHeight * scale) / 2, width: image.naturalWidth * scale, height: image.naturalHeight * scale };
        context.drawImage(image, placed.x, placed.y, placed.width, placed.height);
        return placed;
      }
      context.strokeStyle = '#aebdc8'; context.setLineDash([8, 6]); context.strokeRect(x + 8, top + 8, width - 16, height - 16); context.setLineDash([]);
      font(23, 700); context.fillStyle = COLORS.muted; context.fillText('ภาพจำลอง - ไม่ใช่หลักฐานจริง', x + 18, top + height / 2);
      return { x, y: top, width, height };
    }
    function photoText(field, input, x, top, width, size, leading, weight) {
      font(size, weight);
      const text = value(input), lines = wrapText(context, text, width);
      const entry = { field, text, pages: [sheets.length], lines: [] };
      audit.textBlocks.push(entry); context.fillStyle = COLORS.body;
      for (let index = 0; index < lines.length; index++) {
        const line = { page: sheets.length, x, y: top + index * leading, width: context.measureText(lines[index]).width, height: leading, text: lines[index] };
        context.fillText(line.text, line.x, line.y); entry.lines.push(line);
      }
      return { entry, bottom: top + lines.length * leading };
    }
    for (let index = 0; index < allPhotos.length; index++) {
      const { task, photo } = allPhotos[index];
      checkCancelled();
      if (!grid || grid.count === 4) gridPage();
      let image = await decodePhoto(photo, task.id, image => { activeImage = image; });
      checkCancelled();
      const sourceWidth = image ? image.naturalWidth : null;
      const sourceHeight = image ? image.naturalHeight : null;
      const prefix = 'tasks.' + task.id + '.photos.' + photo.id;
      const caption = value(photo.caption || (photo.sample ? 'ภาพตัวอย่างสำหรับทดลองหน้ารายงาน' : 'ยังไม่ระบุคำบรรยายภาพ'));
      const photoTitle = 'ภาพ ' + String(index + 1).padStart(2, '0') + ' / ' + allPhotos.length + '  ·  ' + value(photo.taskTitle || task.title);
      const photoMeta = 'จุด: ' + value(photo.zone || task.zone) + '   |   ช่วงงาน: ' + value(photo.phase);
      const source = photo.sample ? 'ภาพจำลอง - ไม่ใช่หลักฐานหน้างาน' : 'ภาพที่ผู้ใช้แนบ  ·  เวลานำเข้า: ' + value(photo.importedAt) + ' (ไม่ใช่เวลาถ่ายภาพ)';
      const texts = [
        { key: 'title', text: photoTitle, size: 23, leading: 32, weight: 700 },
        { key: 'zonePhase', text: photoMeta, size: 21, leading: 29, weight: 400 },
        { key: 'caption', text: caption, size: 22, leading: 30, weight: 400 },
        { key: 'source', text: source, size: 18, leading: 25, weight: 400 }
      ];
      const textWidth = cardWidth - photoPadding * 2;
      const textHeight = texts.reduce((sum, item) => { font(item.size, item.weight); return sum + wrapText(context, item.text, textWidth).length * item.leading + 4; }, 0);
      const frameHeight = grid.height - textHeight - photoPadding * 3;
      let placed, titleEntry, photoPage, cardBounds, layout;
      if (frameHeight >= 200) {
        const x = MARGIN + (grid.count % 2) * (cardWidth + gap);
        const top = grid.top + Math.floor(grid.count / 2) * (grid.height + gap);
        cardBounds = { x, y: top, width: cardWidth, height: grid.height };
        context.strokeStyle = '#aebdc8'; context.lineWidth = 1; context.strokeRect(x, top, cardWidth, grid.height);
        placed = containedImage(image, x + photoPadding, top + photoPadding, textWidth, frameHeight);
        let textY = top + photoPadding * 2 + frameHeight;
        for (const item of texts) {
          const drawn = photoText(prefix + '.' + item.key, item.text, x + photoPadding, textY, textWidth, item.size, item.leading, item.weight);
          if (item.key === 'title') titleEntry = drawn.entry;
          textY = drawn.bottom + 4;
        }
        photoPage = sheets.length; sheet.photoCount++; grid.count++; layout = 'grid-2x2';
        y = grid.top + (Math.floor((grid.count - 1) / 2) + 1) * (grid.height + gap);
      } else {
        // Preserve unusually long metadata at full width, not as clipped grid captions.
        if (grid.count) newPage('ข้อมูลภาพ ' + (index + 1) + ' (รายละเอียด)');
        else y = grid.top;
        grid = null;
        const continuation = 'ข้อมูลภาพ ' + (index + 1) + ' (ต่อ)';
        titleEntry = block(prefix + '.title', photoTitle, { size: 25, leading: 36, weight: 700, after: 6, continuation });
        block(prefix + '.zonePhase', photoMeta, { size: 23, leading: 34, after: 12, continuation });
        if (CONTENT_BOTTOM - y < 300) newPage(continuation);
        const height = Math.min(540, CONTENT_BOTTOM - y - 60);
        placed = containedImage(image, MARGIN, y, CONTENT_WIDTH, height);
        photoPage = sheets.length; sheet.photoCount++; layout = 'full-width-detail';
        y += height + 14;
        // Release decoder before a long caption can create subsequent page canvases.
        releaseImage(); image = null;
        block(prefix + '.caption', caption, { size: 24, leading: 35, after: 8, continuation: 'คำบรรยายภาพ ' + (index + 1) + ' (ต่อ)' });
        block(prefix + '.source', source, { size: 20, leading: 29, after: 12, continuation });
      }
      audit.renderedPhotoIds.push(photo.id);
      audit.photos.push({ taskId: task.id, photoId: photo.id, page: photoPage, titlePages: titleEntry.pages.slice(), sample: !!photo.sample, caption, phase: photo.phase, zone: photo.zone, taskTitle: photo.taskTitle, importedAt: photo.importedAt, contained: true, sourceWidth, sourceHeight, bounds: placed, cardBounds, layout });
      releaseImage();
      image = null;
      progress('photos', index + 1, allPhotos.length);
      await nextFrame();
      checkCancelled();
    }
    await summary();
    }

    sealPage();
    progress('pages', 0, sheets.length);
    for (let index = 0; index < sheets.length; index++) {
      checkCancelled();
      const item = sheets[index];
      activeImage = await decodePhoto({ id: 'page-' + (index + 1), src: item.pngDataUrl }, 'report', image => { activeImage = image; });
      checkCancelled();
      allocateCanvas();
      context.drawImage(activeImage, 0, 0);
      releaseImage();
      retainedChars -= item.pngDataUrl.length;
      item.pngDataUrl = null;
      const ctx = context;
      ctx.fillStyle = COLORS.line;
      ctx.fillRect(MARGIN, 1620, CONTENT_WIDTH, 1);
      ctx.font = '400 20px ' + FONT;
      ctx.fillStyle = COLORS.muted;
      ctx.fillText('MOCKUP / DRAFT · ข้อมูลจากผู้บันทึก ยังไม่ใช่การรับรองหรือตรวจรับงาน', MARGIN, 1644);
      const reference = 'เลขที่รายงาน: ' + value(snapshot.docId);
      let referenceSize = 18;
      ctx.font = '400 ' + referenceSize + 'px ' + FONT;
      let referenceLines = wrapText(ctx, reference, CONTENT_WIDTH - 180);
      while (referenceLines.length > 2 && referenceSize > 14) {
        referenceSize -= 1;
        ctx.font = '400 ' + referenceSize + 'px ' + FONT;
        referenceLines = wrapText(ctx, reference, CONTENT_WIDTH - 180);
      }
      if (referenceLines.length > 2) throw new Error('เลขที่รายงานยาวเกินพื้นที่อ้างอิงท้ายหน้า กรุณาใช้เลขที่รายงานที่สั้นลง');
      referenceLines.forEach((line, lineIndex) => ctx.fillText(line, MARGIN, 1681 + lineIndex * 24));
      audit.documentReferences.push({ page: index + 1, docId: snapshot.docId, lines: referenceLines, fontSize: referenceSize });
      ctx.font = '400 18px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('หน้า ' + (index + 1) + ' / ' + sheets.length, WIDTH - MARGIN, 1681);
      ctx.textAlign = 'left';
      const page = { pngDataUrl: null, jpegDataUrl: null, width: WIDTH, height: HEIGHT, label: 'หน้า ' + (index + 1) + ' - ' + item.kind };
      pages.push(page);
      page.pngDataUrl = encodePage('image/png');
      page.jpegDataUrl = encodePage('image/jpeg', 0.93);
      releaseCanvas();
      progress('pages', index + 1, sheets.length);
      await nextFrame();
      checkCancelled();
    }
    audit.pageCount = pages.length;
    audit.photoCount = audit.photos.length;
    const pageTop = page => full ? audit.pageHeaders[page - 1].bodyTop : bodyTop;
    const tablesSafe = [...audit.tableRows, ...audit.tableHeaders].every(row => row.y >= pageTop(row.page) && row.y + row.height <= CONTENT_BOTTOM && row.cells.every(box => box.x >= MARGIN && box.x + box.width <= WIDTH - MARGIN && box.lines.every(line => line.x >= box.x && line.x + line.width <= box.x + box.width && line.y >= box.y && line.y + line.height <= box.y + box.height)));
    const within = (inner, outer) => inner.x >= outer.x - 0.1 && inner.y >= outer.y - 0.1 && inner.x + inner.width <= outer.x + outer.width + 0.1 && inner.y + inner.height <= outer.y + outer.height + 0.1;
    const pageBounds = page => ({ x: MARGIN, y: pageTop(page), width: CONTENT_WIDTH, height: CONTENT_BOTTOM - pageTop(page) });
    const headersSafe = audit.pageHeaders.length === pages.length && audit.pageHeaders.every(header => header.bodyTop <= CONTENT_BOTTOM - 450 && header.fields.every(field => field.lines.every(line => within(line, header) && within(line, field))));
    const photosSafe = audit.photos.every(photo => {
      const bodyBounds = pageBounds(photo.page);
      if (!within(photo.bounds, bodyBounds)) return false;
      if (!photo.cardBounds) return true;
      const prefix = 'tasks.' + photo.taskId + '.photos.' + photo.photoId + '.';
      return within(photo.cardBounds, bodyBounds) && within(photo.bounds, photo.cardBounds) && audit.textBlocks.filter(entry => entry.field.startsWith(prefix)).every(entry => entry.lines.every(line => line.page === photo.page && within(line, photo.cardBounds)));
    });
    const logoSafe = !audit.logo || within(audit.logo.bounds, audit.pageHeaders[audit.logo.page - 1]);
    audit.footerSafe = tablesSafe && headersSafe && logoSafe && audit.textBlocks.every(entry => entry.lines.every(line => within(line, pageBounds(line.page)))) && photosSafe;
    const photoParity = expectedPhotos.length === audit.photos.length && expectedPhotos.every((expected, index) => expected.taskId === audit.photos[index].taskId && expected.photoId === audit.photos[index].photoId && expected.photoId === audit.renderedPhotoIds[index] && expected.photoId === audit.expectedPhotoIds[index]);
    if (!audit.footerSafe || !photoParity) throw new Error('สร้างรายงานไม่ครบหรือเนื้อหาเกินขอบหน้า กรุณาลองอีกครั้ง');
    completed = true;
    return { pages, audit };
    } finally {
      releaseImage();
      releaseCanvas();
      for (const item of sheets) item.pngDataUrl = null;
      sheets.length = 0;
      sheet = null;
      if (!completed) {
        for (const page of pages) { page.pngDataUrl = null; page.jpegDataUrl = null; }
        pages.length = 0;
      }
      retainedChars = 0;
    }
  }

  function jpegBytes(dataUrl) {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl || '');
    if (!match) throw new Error('ไม่มีภาพ JPEG ของหน้ารายงานสำหรับสร้าง PDF');
    const decoded = atob(match[1]);
    return Uint8Array.from(decoded, character => character.charCodeAt(0));
  }

  function pdf(pages) {
    if (!Array.isArray(pages) || !pages.length) throw new Error('ยังไม่มีหน้ารายงานสำหรับสร้าง PDF');
    if (pages.length > limits.maxPages) throw resourceError('ไม่เกิน ' + limits.maxPages + ' หน้า');
    let inputChars = 0;
    for (const page of pages) {
      if (!page || typeof page.jpegDataUrl !== 'string' || page.jpegDataUrl.length > limits.maxEncodeDataUrlChars) throw resourceError('ขนาดภาพสำหรับ PDF');
      inputChars += page.jpegDataUrl.length;
      if (inputChars > limits.maxRetainedDataUrlChars) throw resourceError('ข้อมูลภาพสำหรับ PDF');
    }
    const objects = [];
    const text = string => encoder.encode(string);
    const pageObjectIds = pages.map((_, index) => 5 + index * 3);
    objects.push([text('<< /Type /Catalog /Pages 2 0 R >>')]);
    objects.push([text('<< /Type /Pages /Kids [' + pageObjectIds.map(id => id + ' 0 R').join(' ') + '] /Count ' + pages.length + ' >>')]);
    pages.forEach((page, index) => {
      if (!Number.isInteger(page.width) || !Number.isInteger(page.height) || page.width <= 0 || page.height <= 0) throw new Error('ขนาดหน้ารายงานไม่ถูกต้อง');
      const bytes = jpegBytes(page.jpegDataUrl);
      const imageId = 3 + index * 3;
      const contentId = imageId + 1;
      const draw = text('q\n595.2756 0 0 841.8898 0 0 cm\n/Im0 Do\nQ\n');
      objects.push([text('<< /Type /XObject /Subtype /Image /Width ' + page.width + ' /Height ' + page.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + bytes.length + ' >>\nstream\n'), bytes, text('\nendstream')]);
      objects.push([text('<< /Length ' + draw.length + ' >>\nstream\n'), draw, text('endstream')]);
      objects.push([text('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.2756 841.8898] /Resources << /XObject << /Im0 ' + imageId + ' 0 R >> >> /Contents ' + contentId + ' 0 R >>')]);
    });
    const infoId = objects.length + 1;
    objects.push([text('<< /Title (Daily Site Progress Report - MOCKUP DRAFT) /Producer (SiteReportDocuments - local mockup) /Subject (User-reported information. Not an approval or certification.) >>')]);
    const chunks = [new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10])];
    const offsets = [0];
    let length = chunks[0].length;
    const append = chunk => { chunks.push(chunk); length += chunk.length; };
    objects.forEach((body, index) => {
      offsets.push(length);
      append(text((index + 1) + ' 0 obj\n'));
      body.forEach(append);
      append(text('\nendobj\n'));
    });
    const xrefOffset = length;
    let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
    for (let index = 1; index < offsets.length; index++) xref += String(offsets[index]).padStart(10, '0') + ' 00000 n \n';
    xref += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R /Info ' + infoId + ' 0 R >>\nstartxref\n' + xrefOffset + '\n%%EOF\n';
    append(text(xref));
    return new Blob(chunks, { type: 'application/pdf' });
  }

  global.SiteReportDocuments = Object.freeze({ render, pdf, limits, version: '1.5.0' });
})(globalThis);
