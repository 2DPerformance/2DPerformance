/**
 * ตัวแปลง primitive → SVG
 *
 * นี่คือที่เดียวที่รู้จัก "สไตล์" — geometry ไม่รู้จักสีหรือความหนาเส้นเลย
 * renderer เปิดตาราง draftingStandard ตาม projectionClass ของแต่ละ primitive
 *
 * ระบบพิกัด
 *   โมเดล : มิลลิเมตรของตัวอาคารจริง แกน y ชี้ขึ้น
 *   SVG   : แกน y ชี้ลง จึงพลิกด้วย Y() ครั้งเดียวที่นี่
 *   viewBox หน่วยเป็นมิลลิเมตรของโมเดล ดังนั้นความหนาเส้น 0.70 มม. บนกระดาษ
 *   ที่มาตราส่วน 1:25 ต้องวาดหนา 0.70 × 25 = 17.5 หน่วยโมเดล
 *
 * ผลลัพธ์ต้อง deterministic — วาดสองครั้งจากรูปเดิมต้องได้สตริงเดียวกันทุกไบต์
 * ลายโปรยจุดจึงใช้ตัวสุ่มที่มี seed จากรูปหลายเหลี่ยมนั้นเอง ไม่ใช่ Math.random
 */
import {
  PROJECTION_CLASS, LINE_STYLE, TEXT_HEIGHT, DIM_STYLE,
  SHEET_SCALE, paperToModel, dimTextIsTight, styleFor,
} from './draftingStandard.js';
import { dimLength, bboxOf } from './cadPrimitives.js';
import { hatchSegments } from './hatchGeometry.js';
import { drawnBoxOf } from './extentGeometry.js';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** ตัวเลขในไฟล์ SVG — ทศนิยมคงที่ เพื่อให้ผลลัพธ์เท่ากันทุกครั้ง */
const n3 = (v) => {
  if (!Number.isFinite(v)) throw new RangeError('svgRenderer: พบค่าที่ใช้ไม่ได้ในพิกัด (' + v + ')');
  const s = v.toFixed(3);
  return s === '-0.000' ? '0.000' : s;
};

/* ── ตัวเรนเดอร์ ── */

/**
 * @param {object} dwg   ผลจาก drawing() ใน cadPrimitives
 * @param {object} [opt]
 * @param {number} [opt.scale]   ส่วนหลังของ 1:N — ไม่ระบุจะใช้ SHEET_SCALE ตาม id ของรูป
 * @param {number} [opt.padPaper] ระยะเผื่อรอบรูป หน่วยมิลลิเมตรบนกระดาษ
 * @returns {string} SVG หนึ่งชิ้น พร้อมฝังในหน้าเว็บหรือแปลงเป็น PDF/PNG
 */
export function renderSvg(dwg, opt = {}) {
  const scale = opt.scale || SHEET_SCALE[dwg.id];
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('renderSvg: ต้องระบุมาตราส่วนของรูป "' + dwg.id + '"');
  }
  /** ความยาวบนกระดาษ → หน่วยโมเดล */
  const P = (paperMm) => paperToModel(paperMm, scale);
  const pad = P(Number.isFinite(opt.padPaper) ? opt.padPaper : 14);

  /* ★ กรอบภาพต้องครอบ "สิ่งที่วาดจริง" ไม่ใช่แค่จุดที่ระบุใน primitive
     เดิมคำนวณจาก bbox แล้วเผื่อความกว้างข้อความเอง ซึ่งยังมองไม่เห็นเส้นบอกระยะ
     ที่ไปวางอยู่ที่ระยะเยื้อง off — โซ่บอกระยะชั้นนอกจึงถูกตัดขอบเงียบ ๆ */
  const box = drawnBoxOf(dwg.entities, scale);
  const tx0 = box.min.x, ty0 = box.min.y, tx1 = box.max.x, ty1 = box.max.y;

  const x0 = tx0 - pad, y0 = ty0 - pad;
  let x1 = tx1 + pad, y1 = ty1 + pad;
  let X0 = x0, Y0 = y0;

  /* opt.page บังคับให้กรอบภาพเป็นขนาดกระดาษเต็มแผ่น ไม่ใช่กรอบพอดีเนื้อหา
     เอกสารที่จะพิมพ์ต้องเห็นขอบกระดาษจริง มิฉะนั้นระยะขอบและมาตราส่วนจะเพี้ยนตอนสั่งพิมพ์ */
  if (opt.page) {
    const pw = Number(opt.page.w), ph = Number(opt.page.h);
    if (!Number.isFinite(pw) || !Number.isFinite(ph) || pw <= 0 || ph <= 0) {
      throw new RangeError('renderSvg: opt.page ต้องมีขนาดกระดาษ w และ h เป็นบวก');
    }
    X0 = 0; Y0 = 0; x1 = P(pw); y1 = P(ph);
  }
  const flip = Y0 + y1;
  const Y = (y) => flip - y;

  const out = [];
  const put = (s) => out.push(s);

  /** แอตทริบิวต์เส้นจาก projection class */
  /* fill ต้องออกมาครั้งเดียวเสมอ — ถ้าผู้เรียกจะเติม fill เองต้องส่งมาทางนี้
     เคยพลาดมาแล้ว: เขียน fill ซ้ำสองครั้งในแท็กเดียว HTML ยอมแต่ XML ไม่ยอม
     ผลคือเบราว์เซอร์โหลด SVG เป็นภาพไม่ได้ ส่งออก PNG จึงล้มทั้งหมด */
  const strokeAttr = (pc, fill) => {
    const st = styleFor(pc);
    const w = P(st.w);
    let a = ' stroke="currentColor" stroke-width="' + n3(w) + '" fill="' + (fill || 'none') + '"'
      + ' stroke-linecap="round" stroke-linejoin="round"';
    if (st.dash) a += ' stroke-dasharray="' + st.dash.map((d) => n3(P(d))).join(' ') + '"';
    return a;
  };
  const cls = (e) => ' class="pc-' + e.pc + ' ly-' + e.layer + '"';

  const textAnchor = { L: 'start', C: 'middle', R: 'end', ML: 'start', MC: 'middle', MR: 'end' };
  function emitText(p, s, paperH, align, rot, bold, extra = '') {
    const h = P(paperH);
    const anchor = textAnchor[align] || 'start';
    const baseline = align.startsWith('M') ? 'central' : 'auto';
    const tx = n3(p.x), ty = n3(Y(p.y));
    const rotAttr = rot ? ' transform="rotate(' + n3(-rot) + ' ' + tx + ' ' + ty + ')"' : '';
    put('<text x="' + tx + '" y="' + ty + '" font-size="' + n3(h) + '"'
      + ' text-anchor="' + anchor + '" dominant-baseline="' + baseline + '"'
      + (bold ? ' font-weight="700"' : '') + rotAttr + extra + '>' + esc(s) + '</text>');
  }

  for (const e of dwg.entities) {
    switch (e.t) {
      case 'line':
        put('<path' + cls(e) + strokeAttr(e.pc) + ' d="M ' + n3(e.a.x) + ' ' + n3(Y(e.a.y))
          + ' L ' + n3(e.b.x) + ' ' + n3(Y(e.b.y)) + '"/>');
        break;

      case 'poly': {
        const d = e.pts.map((p, i) => (i ? 'L ' : 'M ') + n3(p.x) + ' ' + n3(Y(p.y))).join(' ')
          + (e.closed ? ' Z' : '');
        put('<path' + cls(e) + strokeAttr(e.pc) + ' d="' + d + '"/>');
        break;
      }

      case 'circle':
        put('<circle' + cls(e) + strokeAttr(e.pc, e.fill ? 'currentColor' : null)
          + ' cx="' + n3(e.c.x) + '" cy="' + n3(Y(e.c.y)) + '" r="' + n3(e.r) + '"/>');
        break;

      case 'arc': {
        /* มุมในโมเดลนับทวนเข็มจากแกน x บวก · SVG พลิกแกน y จึงต้องกลับ sweep หนึ่งครั้ง
           (บั๊กที่พบระหว่างตรวจ: ถ้าใส่ sweep คงที่ 0 ส่วนโค้งจะโป่งผ่านจุดศูนย์กลาง) */
        let d = e.a1 - e.a0;
        while (d <= -360) d += 360;
        while (d > 360) d -= 360;
        const rad = (deg) => (deg * Math.PI) / 180;
        const sx = e.c.x + e.r * Math.cos(rad(e.a0));
        const sy = e.c.y + e.r * Math.sin(rad(e.a0));
        const ex = e.c.x + e.r * Math.cos(rad(e.a1));
        const ey = e.c.y + e.r * Math.sin(rad(e.a1));
        const large = Math.abs(d) > 180 ? 1 : 0;
        const sweep = d > 0 ? 0 : 1;           // กลับทิศเพราะแกน y ถูกพลิก
        put('<path' + cls(e) + strokeAttr(e.pc)
          + ' d="M ' + n3(sx) + ' ' + n3(Y(sy))
          + ' A ' + n3(e.r) + ' ' + n3(e.r) + ' 0 ' + large + ' ' + sweep + ' '
          + n3(ex) + ' ' + n3(Y(ey)) + '"/>');
        break;
      }

      case 'text':
        emitText(e.p, e.s, e.h, e.align, e.rot, e.bold, cls(e) + ' fill="currentColor" stroke="none"');
        break;

      case 'hatch': {
        /* ลายมาจากตัวกลาง hatchGeometry — DXF ใช้ตัวเดียวกัน แบบบนจอกับใน CAD จึงตรงกันเสมอ
           ลำดับต้องคงเดิม: จุดโปรยก่อน แล้วค่อยรวมเส้นเป็น path เดียว */
        const { segs, dots } = hatchSegments(e, scale);
        for (const d of dots) {
          put('<circle class="pc-HATCH ly-' + e.layer + '" cx="' + n3(d.x) + '" cy="' + n3(Y(d.y))
            + '" r="' + n3(d.r) + '" fill="currentColor" stroke="none"/>');
        }
        if (segs.length) {
          const d = segs.map((s) => 'M ' + n3(s[0]) + ' ' + n3(Y(s[1])) + ' L ' + n3(s[2]) + ' ' + n3(Y(s[3]))).join(' ');
          put('<path class="pc-HATCH ly-' + e.layer + '"' + strokeAttr('HATCH') + ' d="' + d + '"/>');
        }
        break;
      }

      case 'dim': {
        const len = dimLength(e);
        const sa = strokeAttr('DIM');
        const gap = P(DIM_STYLE.extGap), beyond = P(DIM_STYLE.extBeyond);
        const tick = P(DIM_STYLE.tickLength) / 2;
        if (e.vertical) {
          const xl = e.a.x + e.off;
          const ya = Math.min(e.a.y, e.b.y), yb = Math.max(e.a.y, e.b.y);
          const s = Math.sign(e.off) || 1;
          put('<path' + cls(e) + sa + ' d="M ' + n3(e.a.x + s * gap) + ' ' + n3(Y(e.a.y))
            + ' L ' + n3(xl + s * beyond) + ' ' + n3(Y(e.a.y)) + '"/>');
          put('<path' + cls(e) + sa + ' d="M ' + n3(e.b.x + s * gap) + ' ' + n3(Y(e.b.y))
            + ' L ' + n3(xl + s * beyond) + ' ' + n3(Y(e.b.y)) + '"/>');
          put('<path' + cls(e) + sa + ' d="M ' + n3(xl) + ' ' + n3(Y(ya)) + ' L ' + n3(xl) + ' ' + n3(Y(yb)) + '"/>');
          for (const y of [ya, yb]) {
            put('<path' + cls(e) + sa + ' d="M ' + n3(xl - tick) + ' ' + n3(Y(y) + tick)
              + ' L ' + n3(xl + tick) + ' ' + n3(Y(y) - tick) + '"/>');
          }
          {const tight = dimTextIsTight(e, scale);
           const ty = tight ? yb + P(DIM_STYLE.textHeight * 1.1) : (ya + yb) / 2;
           emitText({ x: xl, y: ty }, len.toFixed(DIM_STYLE.decimals) + (e.note ? ' ' + e.note : ''),
            DIM_STYLE.textHeight, tight ? 'ML' : 'MC', 90, false, cls(e) + ' fill="currentColor" stroke="none"');}
        } else {
          const yl = e.a.y + e.off;
          const xa = Math.min(e.a.x, e.b.x), xb = Math.max(e.a.x, e.b.x);
          const s = Math.sign(e.off) || 1;
          put('<path' + cls(e) + sa + ' d="M ' + n3(e.a.x) + ' ' + n3(Y(e.a.y + s * gap))
            + ' L ' + n3(e.a.x) + ' ' + n3(Y(yl + s * beyond)) + '"/>');
          put('<path' + cls(e) + sa + ' d="M ' + n3(e.b.x) + ' ' + n3(Y(e.b.y + s * gap))
            + ' L ' + n3(e.b.x) + ' ' + n3(Y(yl + s * beyond)) + '"/>');
          put('<path' + cls(e) + sa + ' d="M ' + n3(xa) + ' ' + n3(Y(yl)) + ' L ' + n3(xb) + ' ' + n3(Y(yl)) + '"/>');
          for (const x of [xa, xb]) {
            put('<path' + cls(e) + sa + ' d="M ' + n3(x - tick) + ' ' + n3(Y(yl) + tick)
              + ' L ' + n3(x + tick) + ' ' + n3(Y(yl) - tick) + '"/>');
          }
          {const tight = dimTextIsTight(e, scale);
           const tx = tight ? xb + P(DIM_STYLE.textHeight * 0.6) : (xa + xb) / 2;
           emitText({ x: tx, y: yl + Math.sign(e.off) * P(DIM_STYLE.textGap) },
            len.toFixed(DIM_STYLE.decimals) + (e.note ? ' ' + e.note : ''),
            DIM_STYLE.textHeight, tight ? 'L' : 'C', 0, false, cls(e) + ' fill="currentColor" stroke="none"');}
        }
        break;
      }

      case 'level': {
        const sa = strokeAttr('DIM');
        const h = P(TEXT_HEIGHT.SMALL);
        const half = h * 0.6;
        /* ยืดออกนอกรูปด้วยเส้นประก่อน แล้วค่อยวางสามเหลี่ยมกับตัวเลขที่ปลาย */
        const px = e.extendTo == null ? e.p.x : e.extendTo;
        if (e.extendTo != null) {
          put('<path' + cls(e) + strokeAttr('HIDDEN') + ' d="M ' + n3(e.p.x) + ' ' + n3(Y(e.p.y))
            + ' L ' + n3(px) + ' ' + n3(Y(e.p.y)) + '"/>');
        }
        put('<path' + cls(e) + strokeAttr('DIM', 'currentColor') + ' d="M ' + n3(px) + ' ' + n3(Y(e.p.y))
          + ' L ' + n3(px - half) + ' ' + n3(Y(e.p.y) - h)
          + ' L ' + n3(px + half) + ' ' + n3(Y(e.p.y) - h) + ' Z"/>');
        const label = (e.value >= 0 ? '+' : '−') + Math.abs(e.value / 1000).toFixed(3);
        const dir = e.side === 'left' ? -1 : 1;
        emitText({ x: px + dir * half * 2, y: e.p.y + P(1.2) },
          label, TEXT_HEIGHT.SMALL, e.side === 'left' ? 'R' : 'L', 0, false,
          cls(e) + ' fill="currentColor" stroke="none"');
        break;
      }

      case 'sectionMark': {
        const sa = strokeAttr('CENTRELINE');
        put('<path' + cls(e) + sa + ' d="M ' + n3(e.a.x) + ' ' + n3(Y(e.a.y))
          + ' L ' + n3(e.b.x) + ' ' + n3(Y(e.b.y)) + '"/>');
        const r = P(3.5);
        for (const p of [e.a, e.b]) {
          put('<circle' + cls(e) + strokeAttr('DIM', '#fff') + ' cx="' + n3(p.x) + '" cy="' + n3(Y(p.y))
            + '" r="' + n3(r) + '"/>');
          emitText(p, e.label, TEXT_HEIGHT.SMALL, 'MC', 0, true,
            cls(e) + ' fill="currentColor" stroke="none"');
        }
        break;
      }

      case 'leader': {
        const sa = strokeAttr('DIM');
        const d = e.pts.map((p, i) => (i ? 'L ' : 'M ') + n3(p.x) + ' ' + n3(Y(p.y))).join(' ');
        put('<path' + cls(e) + sa + ' d="' + d + '"/>');
        const head = e.pts[0], tail = e.pts[e.pts.length - 1];
        put('<circle' + cls(e) + ' fill="currentColor" stroke="none" cx="' + n3(head.x) + '" cy="' + n3(Y(head.y))
          + '" r="' + n3(P(0.6)) + '"/>');
        const prev = e.pts[e.pts.length - 2];
        const toRight = tail.x >= prev.x;
        emitText({ x: tail.x + (toRight ? P(1.2) : -P(1.2)), y: tail.y },
          e.label, e.h, toRight ? 'ML' : 'MR', 0, false,
          cls(e) + ' fill="currentColor" stroke="none"');
        break;
      }

      default:
        throw new RangeError('renderSvg: ไม่รู้จัก primitive ชนิด "' + e.t + '"');
    }
  }

  const w = x1 - X0, h = y1 - Y0;
  /* renderer ไม่กำหนดขนาดที่แสดงผล — ปล่อยให้หน้าจอหรือแผ่นกระดาษเป็นคนคุม
     preserveAspectRatio ค่าปริยายคือ xMidYMid meet ระบุไว้ให้ชัดเพื่อไม่ให้รูปยืด */
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + n3(X0) + ' ' + n3(Y(y1)) + ' ' + n3(w) + ' ' + n3(h) + '"'
    + ' preserveAspectRatio="xMidYMid meet"'
    + ' data-drawing="' + esc(dwg.id) + '" data-scale="1:' + scale + '"'
    + ' data-aspect="' + (h / w).toFixed(4) + '"'
    + ' role="img" aria-label="' + esc(dwg.title) + '"'
    + ' style="color:#111;font-family:Sarabun,sans-serif;background:#fff">'
    + out.join('') + '</svg>';
}

/** ชื่อคลาสของทุก projection class — ให้หน้าจอเปิด/ปิดชั้นได้โดยไม่ต้องรู้จักภายใน */
export const PROJECTION_CLASS_NAMES = Object.freeze(Object.keys(PROJECTION_CLASS));

/** ความหนาเส้นที่จะพิมพ์จริง (มม.) ของแต่ละ class — ใช้ทำคำอธิบายสัญลักษณ์ */
export const lineWeightTable = () =>
  Object.entries(LINE_STYLE).map(([pc, st]) => ({ pc, weightMm: st.w, dash: st.dash }));
