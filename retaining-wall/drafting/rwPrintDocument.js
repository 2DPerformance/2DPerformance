/**
 * เอกสารพร้อมพิมพ์ — รวมชุดแบบ A3 และรายการคำนวณ A4 ไว้ในไฟล์เดียว
 *
 * ทำไมต้องมีชั้นนี้:
 * ผู้ใช้เอาแบบไปยื่นและไปหน้างานจริง มาตราส่วนบนกระดาษต้องตรงเมื่อวัดด้วยไม้บรรทัด
 * การพิมพ์จากหน้าจอทั่วไปจะโดนบีบให้พอดีหน้ากระดาษ (fit to page) ซึ่งทำให้มาตราส่วนเพี้ยน
 * เอกสารนี้จึงกำหนดขนาดหน้าเป็นมิลลิเมตรจริงและตัดขอบพิมพ์ออกทั้งหมด
 *
 * ใช้ @page แบบตั้งชื่อ เพื่อให้แผ่น A3 แนวนอนกับหน้า A4 แนวตั้งอยู่ในไฟล์เดียวกันได้
 * ผู้ใช้ต้องเลือก "ขนาดจริง / Actual size" และปิด "ปรับให้พอดีหน้า" ในกล่องพิมพ์
 */
import { SHEET } from './draftingStandard.js';
import { renderSvg } from './svgRenderer.js';

/** ชื่อหน้ากระดาษใน CSS ต้องเป็นตัวอักษรล้วน */
const pageName = (key) => 'p' + String(key).toLowerCase().replace(/[^a-z0-9]/g, '');

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {Array} items [{ drawing, size }] — size คือคีย์ใน SHEET เช่น 'A3' หรือ 'A4P'
 * @param {object} [opt]
 * @param {string} [opt.title]     ชื่อเอกสาร (ขึ้นบนแท็บเบราว์เซอร์และชื่อไฟล์ PDF ที่เสนอ)
 * @param {string} [opt.fontHref]  ที่อยู่ไฟล์ฟอนต์ Sarabun — ไม่ส่งมาก็ใช้ฟอนต์ระบบ
 * @returns {string} HTML เอกสารสมบูรณ์หนึ่งไฟล์
 */
export function printableDocument(items, opt = {}) {
  if (!Array.isArray(items) || !items.length) {
    throw new TypeError('printableDocument: ต้องมีหน้าอย่างน้อยหนึ่งหน้า');
  }

  const sizes = new Map();
  const body = items.map((it, k) => {
    const sh = SHEET[it.size];
    if (!sh) throw new RangeError('printableDocument: ไม่รู้จักขนาดกระดาษ "' + it.size + '"');
    if (!it.drawing || !Array.isArray(it.drawing.entities)) {
      throw new TypeError('printableDocument: หน้าที่ ' + (k + 1) + ' ไม่มีรูป');
    }
    sizes.set(it.size, sh);
    const svg = renderSvg(it.drawing, { scale: 1, padPaper: 0, page: { w: sh.w, h: sh.h } });
    return '<section class="sheet ' + pageName(it.size) + '">' + svg + '</section>';
  }).join('\n');

  /* @page ตั้งชื่อแยกตามขนาด เพื่อให้ไฟล์เดียวมีทั้ง A3 แนวนอนและ A4 แนวตั้ง
     margin 0 เพราะกรอบและ title block ถูกวาดไว้ในรูปแล้ว ให้เครื่องพิมพ์เติมขอบซ้ำไม่ได้ */
  const pageRules = [...sizes.entries()].map(([key, sh]) =>
    '@page ' + pageName(key) + ' { size: ' + sh.w + 'mm ' + sh.h + 'mm; margin: 0; }\n'
    + '.' + pageName(key) + ' { page: ' + pageName(key) + '; width: ' + sh.w + 'mm; height: ' + sh.h + 'mm; }'
  ).join('\n');

  const font = opt.fontHref
    ? '<link rel="stylesheet" href="' + esc(opt.fontHref) + '">'
    : '';

  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8">
<title>${esc(opt.title || 'เอกสารกำแพงกันดิน')}</title>
${font}
<style>
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:#e8edf3}
  body{font-family:Sarabun,system-ui,sans-serif;color:#000}
  ${pageRules}
  .sheet{background:#fff;overflow:hidden;break-after:page;margin:0 auto 10mm;
         box-shadow:0 6px 24px rgb(15 44 78/.18)}
  .sheet:last-child{break-after:auto;margin-bottom:0}
  .sheet svg{display:block;width:100%;height:100%}
  .hint{max-width:180mm;margin:8mm auto;padding:6mm 8mm;background:#fff;border:1px solid #cbd5e1;
        font-size:11px;line-height:1.7}
  .hint b{display:block;margin-bottom:3px}
  @media print{ html,body{background:#fff} .sheet{box-shadow:none;margin:0} .hint{display:none} }
</style></head><body>
<div class="hint"><b>ก่อนสั่งพิมพ์</b>
เลือกขนาดกระดาษให้ตรงกับแต่ละแผ่น · ตั้งมาตราส่วนการพิมพ์เป็น <b>ขนาดจริง 100%</b>
และปิด “ปรับให้พอดีหน้ากระดาษ” มิฉะนั้นมาตราส่วนบนแบบจะไม่ตรงเมื่อวัดด้วยไม้บรรทัด ·
ขอบกระดาษตั้งเป็น 0 เพราะกรอบแบบวาดมาในรูปแล้ว</div>
${body}
</body></html>`;
}
