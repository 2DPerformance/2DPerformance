/**
 * ขอบเขตที่รูป "กินจริง" บนกระดาษ
 *
 * ทำไมต้องมีไฟล์นี้แยกจาก bboxOf():
 * bboxOf() อยู่ใน cadPrimitives ซึ่งตั้งใจไม่ให้รู้จัก style และไม่รู้มาตราส่วน
 * มันจึงวัดได้แค่ "จุดที่ระบุไว้ใน primitive" เช่นเส้นบอกระยะวัดแค่จุด a กับ b
 * แต่สิ่งที่ renderer วาดออกมาจริงมีมากกว่านั้นมาก — เส้นบอกระยะไปอยู่ที่ระยะเยื้อง off
 * มีขีดเฉียง มีเส้นต่อที่เลยออกไป และมีตัวเลขวางอยู่ด้วย
 *
 * ผลของการวัดผิด (เกิดจริง 2026-08-30 · เจ้าของงานเห็นจากแบบที่พิมพ์ออกมา):
 *   แผ่น 1 รายงานว่าไม่ล้น แต่โซ่บอกระยะชั้นนอกยื่นพ้นขอบบนกรอบไป 6.5 มม.
 *   แผ่น 2 รายงานว่าไม่ล้น แต่ยื่นพ้นขอบซ้ายไป 5.0 มม.
 *   ตัวจัดหน้าคิดว่ารูปเล็กกว่าความจริง จึงยัดลงแผ่นเกินพอดี
 *
 * กติกาของไฟล์นี้
 *   1. ต้องสะท้อน "สิ่งที่ svgRenderer วาดจริง" ทีละชนิด ถ้า renderer เปลี่ยนวิธีวาด
 *      ต้องแก้ที่นี่ด้วย มีเคสทดสอบผูกไว้แล้ว
 *   2. ต้องรู้มาตราส่วน เพราะระยะเยื้อง ขีดเฉียง และตัวอักษร เป็นมิลลิเมตร "บนกระดาษ"
 *      ส่วนพิกัดเป็นมิลลิเมตร "ของอาคาร"
 *   3. เผื่อความสูงตัวอักษรแบบไทย — สระบนกับวรรณยุกต์กินที่เหนือเส้นฐานมากกว่าอักษรละติน
 */
import { DIM_STYLE, TEXT_HEIGHT, HATCH_PATTERN, paperToModel, dimTextIsTight } from './draftingStandard.js';
import { dimLength } from './cadPrimitives.js';
import { textWidthEm } from './textMetrics.js';

/**
 * @deprecated เหลือไว้ให้โค้ดเก่า import ได้ — ความกว้างจริงใช้ textWidthEm จาก textMetrics
 * ค่าเฉลี่ย 0.58 พิสูจน์แล้วว่าเผื่อขาดกับขีดยาว เลขวงกลม และพยัญชนะไทยส่วนใหญ่
 */
export const TEXT_WIDTH_RATIO = 0.58;

/**
 * ที่ว่างเหนือและใต้เส้นฐานของตัวอักษร คิดเป็นเท่าของความสูงตัวอักษร
 * ไทยมีสระบน–วรรณยุกต์ซ้อนสองชั้น (เช่น ที่ ปุ่ม) จึงกินเหนือเส้นฐานเกือบเต็มความสูง
 * และมีสระล่าง (เช่น ญ ฐ ุ ู) กินใต้เส้นฐานราวสามส่วนสิบ
 */
export const TEXT_ASCENT = 1.0;
export const TEXT_DESCENT = 0.4;

/** ตัวอักษรที่จัดกึ่งกลางแนวตั้ง (align ขึ้นต้นด้วย M) กระจายขึ้นลงเท่ากัน */
const CENTRED_HALF = 0.7;

/**
 * ขอบเขตจริงของชุด primitive
 *
 * @param {Array} entities
 * @param {number} scale  ส่วนหลังของ 1:N — ตารางที่ไม่มีมาตราส่วนใช้ 1
 * @returns {{min: {x: number, y: number}, max: {x: number, y: number}}}
 */
export function drawnBoxOf(entities, scale) {
  if (!Array.isArray(entities)) throw new TypeError('drawnBoxOf: ต้องส่งอาร์เรย์ของ primitive');
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new RangeError('drawnBoxOf: ต้องระบุมาตราส่วนเป็นจำนวนบวก (ได้ ' + scale + ')');
  }
  const P = (paperMm) => paperToModel(paperMm, scale);

  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const eat = (x, y) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };

  /**
   * กล่องของข้อความหนึ่งชิ้น — ต้องตรงกับที่ renderer วางจริง
   * renderer ใช้ dominant-baseline central เมื่อ align ขึ้นต้นด้วย M · นอกนั้นวางบนเส้นฐาน
   */
  const eatText = (p, s, paperHeight, align, rot) => {
    const h = P(paperHeight);
    /* ความกว้างจากตาราง metric ของฟอนต์จริง — ค่าเฉลี่ยตัวเดียวเผื่อขาดกับ
       "—" (1.0em) เลขวงกลม ①–⑩ (1.0em) และพยัญชนะไทย (0.63–0.73em) */
    const w = textWidthEm(s) * h;
    const a = String(align || 'L');
    const centred = a.startsWith('M');
    const back = a === 'C' || a === 'MC' ? w / 2 : (a === 'R' || a === 'MR' ? w : 0);
    const up = centred ? h * CENTRED_HALF : h * TEXT_ASCENT;
    const down = centred ? h * CENTRED_HALF : h * TEXT_DESCENT;
    if (Math.abs(rot || 0) === 90) {
      /* หมุน 90° — ความยาวข้อความไปอยู่แกน y และความสูงไปอยู่แกน x
         renderer ใช้ rotate(-90) ในพิกัดจอ ซึ่งพลิกให้ "ด้านบนของตัวอักษร" ไปอยู่ทาง -x ของโมเดล
         เคยเผื่อผิดข้าง ทำให้กันที่ให้สระบนไว้ผิดด้านราว 2 มม.กระดาษ */
      const dir = (rot || 0) > 0 ? 1 : -1;
      const yStart = p.y - dir * back;
      eat(p.x - up, Math.min(yStart, yStart + dir * w));
      eat(p.x + down, Math.max(yStart, yStart + dir * w));
    } else {
      eat(p.x - back, p.y - down);
      eat(p.x - back + w, p.y + up);
    }
  };

  for (const e of entities) {
    switch (e.t) {
      case 'line':
        eat(e.a.x, e.a.y); eat(e.b.x, e.b.y);
        break;

      case 'poly':
        for (const p of e.pts) eat(p.x, p.y);
        break;

      case 'hatch': {
        for (const p of e.pts) eat(p.x, p.y);
        /* ลายเส้นเฉียงกับลายน้ำถูกตัดเข้ารูปจึงไม่เกินขอบ
           แต่ลายโปรยจุด (ดินถม) มีขีดสั้นที่ลากจากจุดในรูปออกไปข้างละครึ่งความยาว
           และจุดเองมีรัศมี — ทั้งสองอย่างยื่นพ้นขอบรูปได้ */
        const pat = HATCH_PATTERN[e.pattern];
        if (pat && pat.kind === 'stipple') {
          const out = Math.max(P(pat.dashLength) / 2, P(0.25));
          /* ต้องคิดจากขอบของรูปหลายเหลี่ยมนี้เอง ไม่ใช่จากกล่องรวมที่กำลังสะสมอยู่
             ไม่งั้นทั้งแผ่นจะถูกพองออกทุกด้าน */
          const xs = e.pts.map((p) => p.x), ys = e.pts.map((p) => p.y);
          eat(Math.min(...xs) - out, Math.min(...ys) - out);
          eat(Math.max(...xs) + out, Math.max(...ys) + out);
        }
        break;
      }

      case 'circle': case 'arc':
        /* ส่วนโค้งกินไม่เกินวงกลมเต็ม — เผื่อเต็มวงเพื่อความปลอดภัยของการจัดหน้า */
        eat(e.c.x - e.r, e.c.y - e.r); eat(e.c.x + e.r, e.c.y + e.r);
        break;

      case 'text':
        eatText(e.p, e.s, e.h, e.align, e.rot);
        break;

      case 'dim': {
        /* ★ จุดที่ bboxOf พลาด — เส้นบอกระยะไม่ได้อยู่ที่จุด a,b แต่อยู่ที่ระยะเยื้อง off */
        const len = dimLength(e);
        const label = len.toFixed(DIM_STYLE.decimals) + (e.note ? ' ' + e.note : '');
        const beyond = P(DIM_STYLE.extBeyond);
        const tick = P(DIM_STYLE.tickLength) / 2;
        const s = Math.sign(e.off) || 1;
        const tight = dimTextIsTight(e, scale);
        eat(e.a.x, e.a.y); eat(e.b.x, e.b.y);
        if (e.vertical) {
          const xl = e.a.x + e.off;
          const ya = Math.min(e.a.y, e.b.y), yb = Math.max(e.a.y, e.b.y);
          eat(xl + s * beyond, ya); eat(xl + s * beyond, yb);
          eat(xl - tick, ya - tick); eat(xl + tick, yb + tick);
          const ty = tight ? yb + P(DIM_STYLE.textHeight * 1.1) : (ya + yb) / 2;
          eatText({ x: xl, y: ty }, label, DIM_STYLE.textHeight, tight ? 'ML' : 'MC', 90);
        } else {
          const yl = e.a.y + e.off;
          const xa = Math.min(e.a.x, e.b.x), xb = Math.max(e.a.x, e.b.x);
          eat(xa, yl + s * beyond); eat(xb, yl + s * beyond);
          eat(xa - tick, yl - tick); eat(xb + tick, yl + tick);
          const tx = tight ? xb + P(DIM_STYLE.textHeight * 0.6) : (xa + xb) / 2;
          eatText({ x: tx, y: yl + s * P(DIM_STYLE.textGap) }, label,
            DIM_STYLE.textHeight, tight ? 'L' : 'C', 0);
        }
        break;
      }

      case 'level': {
        const h = P(TEXT_HEIGHT.SMALL);
        const half = h * 0.6;
        const px = e.extendTo == null ? e.p.x : e.extendTo;
        eat(e.p.x, e.p.y);
        eat(px - half, e.p.y); eat(px + half, e.p.y + h);
        /* ป้ายค่าระดับ — ค่าติดลบยาวกว่าค่าบวกหนึ่งอักขระ ต้องคิดจากข้อความจริง */
        const label = (e.value >= 0 ? '+' : '−') + Math.abs(e.value / 1000).toFixed(3);
        const dir = e.side === 'left' ? -1 : 1;
        eatText({ x: px + dir * half * 2, y: e.p.y + P(1.2) }, label,
          TEXT_HEIGHT.SMALL, e.side === 'left' ? 'R' : 'L', 0);
        break;
      }

      case 'sectionMark': {
        const r = P(3.5);
        eat(e.a.x, e.a.y); eat(e.b.x, e.b.y);
        for (const p of [e.a, e.b]) {
          eat(p.x - r, p.y - r); eat(p.x + r, p.y + r);
        }
        break;
      }

      case 'leader': {
        for (const p of e.pts) eat(p.x, p.y);
        const tail = e.pts[e.pts.length - 1];
        const prev = e.pts[e.pts.length - 2];
        const toRight = tail.x >= prev.x;
        eatText({ x: tail.x + (toRight ? P(1.2) : -P(1.2)), y: tail.y }, e.label, e.h,
          toRight ? 'ML' : 'MR', 0);
        break;
      }

      default:
        throw new RangeError('drawnBoxOf: ไม่รู้จัก primitive ชนิด "' + e.t + '"');
    }
  }

  if (!Number.isFinite(x0)) return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  return { min: { x: x0, y: y0 }, max: { x: x1, y: y1 } };
}

/**
 * ขนาดที่รูปจะกินบนกระดาษ (มิลลิเมตรบนกระดาษ) พร้อมระยะที่เนื้อหายื่นออกนอก bbox เรขาคณิต
 * ตัวจัดหน้าใช้ค่านี้ในการกันที่และในการเลื่อนรูปให้เนื้อหาอยู่ในกรอบพอดี
 */
export function drawnSize(dwg, scale) {
  const box = drawnBoxOf(dwg.entities, scale);
  const k = 1 / scale;
  return {
    w: (box.max.x - box.min.x) * k,
    h: (box.max.y - box.min.y) * k,
    box,
    /* ระยะจากขอบซ้าย/ล่างของเนื้อหา ไปถึงจุดอ้างอิงเดิม (bbox เรขาคณิต) หน่วยมิลลิเมตรกระดาษ */
    padLeft: (dwg.bbox.min.x - box.min.x) * k,
    padBottom: (dwg.bbox.min.y - box.min.y) * k,
  };
}
