/**
 * มาตรฐานการเขียนแบบ — ตัวตั้งของลายเส้นทั้งระบบ
 *
 * ไฟล์นี้เป็น "ค่าคงที่ล้วน" ห้ามมีตรรกะการวาด และห้ามมีตัวเลขลายเส้นกระจายอยู่ที่อื่น
 * geometry layer ไม่รู้จักไฟล์นี้เลย — เฉพาะ renderer เท่านั้นที่เปิดตารางนี้
 *
 * น้ำหนัก/ชนิดเส้น  ISO 128     ตัวอักษร  ISO 3098     กระดาษ/ขอบ  ISO 5457
 * ป้าย หน่วย และ title block เป็นภาษาไทยตามที่ผู้รับเหมาไทยใช้จริง (Owner สั่ง 2026-08-29)
 *
 * หน่วยทุกค่าในไฟล์นี้คือ "มิลลิเมตรบนกระดาษที่พิมพ์จริง" ไม่ใช่มิลลิเมตรของตัวอาคาร
 */

/**
 * ชนิดของเส้นตามความสัมพันธ์กับระนาบมอง
 * นี่คือหัวใจที่ทำให้แบบดูเป็นงานเขียนแบบจริง — น้ำหนักเส้นถูกกำหนดโดย
 * "ชิ้นส่วนนี้อยู่ตรงไหนเทียบกับระนาบตัด" ไม่ใช่โดยคนวาดเลือกเอง
 */
export const PROJECTION_CLASS = Object.freeze({
  CUT: 'CUT',                 // ระนาบตัดผ่านเนื้อวัสดุ — หนักที่สุดเสมอ
  OUTLINE: 'OUTLINE',         // ขอบวัตถุที่เห็น แต่ระนาบไม่ได้ตัด
  REBAR: 'REBAR',             // แกนเหล็กเสริม
  PROJECTION: 'PROJECTION',   // เส้นฉายทั่วไป ผิวดิน ระดับน้ำ
  HIDDEN: 'HIDDEN',           // อยู่หลังระนาบตัด
  CENTRELINE: 'CENTRELINE',   // ศูนย์กลาง แกนอ้างอิง
  DIM: 'DIM',                 // เส้นบอกระยะและเส้นต่อ
  HATCH: 'HATCH',             // ลายหน้าตัด
  BEYOND: 'BEYOND',           // อยู่ไกลกว่าระนาบมอง
});

/**
 * บันไดน้ำหนักเส้น ISO 128 — 0.13 / 0.18 / 0.25 / 0.35 / 0.50 / 0.70
 * dash เป็นรูปแบบ [ขีด, เว้น, ...] หน่วยมิลลิเมตรบนกระดาษ · null = เส้นต่อเนื่อง
 */
export const LINE_STYLE = Object.freeze({
  CUT:        Object.freeze({ w: 0.70, dash: null,                 dxfColor: 7,  dxfLtype: 'CONTINUOUS' }),
  OUTLINE:    Object.freeze({ w: 0.50, dash: null,                 dxfColor: 7,  dxfLtype: 'CONTINUOUS' }),
  REBAR:      Object.freeze({ w: 0.50, dash: null,                 dxfColor: 1,  dxfLtype: 'CONTINUOUS' }),
  PROJECTION: Object.freeze({ w: 0.35, dash: null,                 dxfColor: 7,  dxfLtype: 'CONTINUOUS' }),
  HIDDEN:     Object.freeze({ w: 0.25, dash: Object.freeze([4, 2]), dxfColor: 8, dxfLtype: 'HIDDEN' }),
  CENTRELINE: Object.freeze({ w: 0.25, dash: Object.freeze([12, 2, 2, 2]), dxfColor: 4, dxfLtype: 'CENTER' }),
  DIM:        Object.freeze({ w: 0.18, dash: null,                 dxfColor: 4,  dxfLtype: 'CONTINUOUS' }),
  HATCH:      Object.freeze({ w: 0.13, dash: null,                 dxfColor: 9,  dxfLtype: 'CONTINUOUS' }),
  BEYOND:     Object.freeze({ w: 0.13, dash: null,                 dxfColor: 8,  dxfLtype: 'CONTINUOUS' }),
});

/** ความสูงตัวอักษรมาตรฐาน ISO 3098 (มม. บนกระดาษ) */
export const TEXT_HEIGHT = Object.freeze({
  MICRO: 1.8,   // ป้ายย่อย หมายเหตุเล็ก
  SMALL: 2.5,   // ตัวเลขบอกระยะ · มาร์คเหล็ก · ช่องตาราง
  BODY: 3.5,    // ป้ายชิ้นส่วน · หัวตาราง
  TITLE: 5.0,   // ชื่อรูป
  SHEET: 7.0,   // ชื่อแผ่น
});

/** สไตล์บอกระยะ — ปลายเป็นขีดเฉียง 45° แบบงานโยธา ไม่ใช่หัวลูกศรทึบ */
export const DIM_STYLE = Object.freeze({
  extGap: 1.0,        // เว้นจากวัตถุก่อนเริ่มเส้นต่อ
  extBeyond: 2.0,     // เส้นต่อเลยเส้นบอกระยะ
  tickLength: 2.5,    // ความยาวขีดเฉียง
  tickAngle: 45,      // องศา
  textGap: 1.0,       // ระยะจากเส้นถึงใต้ตัวเลข
  /* 3.5 มม. ไม่ใช่ 2.5 — ตัวเลขบอกระยะคือสิ่งที่ต้องอ่านมากที่สุดในแบบ
     ISO 3098 รองรับทั้งสองขนาด งานโยธาไทยที่พิมพ์ A3 ใช้ 3.5 อ่านง่ายกว่าชัดเจน */
  textHeight: TEXT_HEIGHT.BODY,
  chainStep: 9.0,     // ระยะห่างระหว่างโซ่บอกระยะแต่ละชั้น
  decimals: 0,        // ตัวเลขเป็นมิลลิเมตรจำนวนเต็ม
  unitNote: 'หน่วย: มิลลิเมตร',   // ระบุครั้งเดียวใน title block ไม่พิมพ์ต่อท้ายทุกตัวเลข
});

/**
 * ความยาวของเส้นบอกระยะ "บนกระดาษ" จากพิกัดปัจจุบันของมัน
 *
 * ★ ห้ามใช้ค่าที่ล็อกไว้ใน measured มาตัดสินเรื่องการวางตัวเลข
 *   measured คือระยะจริงของอาคาร (เช่น 3600 มม.) ซึ่งถูกล็อกไว้ตอนรูปถูกย่อลงแผ่น
 *   พอแผ่นถูกเรนเดอร์ที่มาตราส่วน 1 การหารด้วยมาตราส่วนจึงคืนระยะของอาคาร ไม่ใช่ของกระดาษ
 *   ผลที่วัดได้จริง: ก่อนจัดลงแผ่นมีเส้นสั้น 5 จาก 21 เส้น หลังจัดลงแผ่นเหลือ 0
 *   แปลว่าแบบเดียวกัน เรนเดอร์เดี่ยวกับเรนเดอร์บนแผ่น วางตัวเลขคนละที่ — ยอมไม่ได้
 */
export const dimPaperSpan = (d, scale) =>
  (d.vertical ? Math.abs(d.b.y - d.a.y) : Math.abs(d.b.x - d.a.x)) / scale;

/** เส้นบอกระยะสั้นเกินกว่าจะวางตัวเลขไว้กลางเส้น ต้องผลักตัวเลขออกไปนอกขีดเฉียง */
export const dimTextIsTight = (d, scale) => dimPaperSpan(d, scale) < DIM_STYLE.textHeight * 2.4;

/**
 * ลายหน้าตัด — ระยะเป็นมิลลิเมตรบนกระดาษ ไม่ใช่ระยะจริงของวัสดุ
 * ทำให้ลายมีความถี่คงที่ไม่ว่าจะพิมพ์ที่มาตราส่วนใด
 */
export const HATCH_PATTERN = Object.freeze({
  CONCRETE:     Object.freeze({ kind: 'lines', angle: 45, spacing: 3.0, dxfName: 'ANSI31' }),
  LEAN:         Object.freeze({ kind: 'lines', angle: 45, spacing: 6.0, dxfName: 'ANSI31' }),
  /* ลายดินถม: จุดโปรยบาง ๆ + ขีดสั้นเป็นครั้งคราว
     density = จำนวนจุดต่อ 1 ตารางมิลลิเมตรบนกระดาษ — ค่าสูงกว่านี้ลายจะทึบจนกลืนเส้นโครงสร้าง */
  SOIL_FILL:    Object.freeze({ kind: 'stipple', density: 0.006, dashLength: 2.5, dashEvery: 4, dxfName: 'EARTH' }),
  SOIL_NATURAL: Object.freeze({ kind: 'cross', angle: 45, spacing: 4.0, dxfName: 'ANSI37' }),
  WATER:        Object.freeze({ kind: 'water', spacing: 2.0, dxfName: 'SOLID' }),
});

/** ชั้นงานเขียนแบบ — ชื่อเป็น ASCII เพื่อให้ DXF เปิดได้ทุกโปรแกรม */
export const LAYER = Object.freeze({
  CONCRETE: 'RW-CONCRETE',
  REBAR: 'RW-REBAR',
  SOIL: 'RW-SOIL',
  WATER: 'RW-WATER',
  DIM: 'RW-DIM',
  TEXT: 'RW-TEXT',
  GRID: 'RW-GRID',
  HATCH: 'RW-HATCH',
  MARK: 'RW-MARK',
  BORDER: 'RW-BORDER',
  TITLE: 'RW-TITLE',
});

/** กระดาษ ISO 5457 — ขอบเย็บด้านซ้าย 20 มม. ที่เหลือ 10 มม. */
export const SHEET = Object.freeze({
  A3: Object.freeze({ w: 420, h: 297, margin: 10, bindingMargin: 20 }),
  A2: Object.freeze({ w: 594, h: 420, margin: 10, bindingMargin: 20 }),
  A1: Object.freeze({ w: 841, h: 594, margin: 10, bindingMargin: 20 }),
  A4: Object.freeze({ w: 297, h: 210, margin: 10, bindingMargin: 20 }),
  /* แนวตั้ง — ใช้กับรายการคำนวณ ไม่ใช่แผ่นเขียนแบบ เอกสารคำนวณอ่านเป็นคอลัมน์เดียวจากบนลงล่าง */
  A4P: Object.freeze({ w: 210, h: 297, margin: 10, bindingMargin: 20 }),
});

/** กรอบชื่อแบบ มุมล่างขวา */
export const TITLE_BLOCK = Object.freeze({
  w: 180,
  h: 40,
  rowH: 5,
  labelHeight: TEXT_HEIGHT.MICRO,
  valueHeight: TEXT_HEIGHT.SMALL,
  sheetTitleHeight: TEXT_HEIGHT.BODY,
  fields: Object.freeze([
    'ชื่อโครงการ', 'ชื่อแบบ', 'มาตราส่วน', 'หน่วย',
    'เขียนโดย', 'ตรวจโดย', 'อนุมัติโดย',
    'เลขที่แบบ', 'แผ่นที่', 'วันที่', 'แก้ไขครั้งที่',
  ]),
  /** คงอยู่ตลอดช่วง Beta — ปลดได้ต่อเมื่อ Owner/PE อนุมัติเป็นลายลักษณ์อักษร */
  stamp: 'NOT FOR CONSTRUCTION',
});

/** มาตราส่วนประจำแผ่น — ตัวเลขคือส่วนหลังของ 1:N */
export const SHEET_SCALE = Object.freeze({
  'RW-01': 50,    // รูปตัดขวาง — 1:25 ทำให้แผ่นเป็น 228x380 มม. ล้น A3
  'RW-02': 100,   // ผังฐานราก — 1:50 กว้าง 242 มม. ล้นพื้นที่เขียนแบบของ A3
  'RW-03': 20,    // รายละเอียดเหล็ก — 1:10 ลงได้แค่รายละเอียดเดียวต่อแผ่น
  'RW-04': null,  // ตารางเหล็ก ไม่มีมาตราส่วน
  'RW-05': null,  // สรุปผลตรวจสอบ ไม่มีมาตราส่วน
  'RW-06': 25,    // ผังพนังระหว่างครีบ (เฉพาะ counterfort)
});

/** ชื่อแผ่นภาษาไทยและอังกฤษ */
export const SHEET_TITLE = Object.freeze({
  'RW-01': Object.freeze({ th: 'รูปตัดขวางกำแพงกันดิน', en: 'RETAINING WALL — CROSS SECTION' }),
  'RW-02': Object.freeze({ th: 'ผังฐานราก', en: 'FOUNDATION PLAN' }),
  'RW-03': Object.freeze({ th: 'รายละเอียดเหล็กเสริม', en: 'REINFORCEMENT DETAIL' }),
  'RW-04': Object.freeze({ th: 'ตารางเหล็กเสริม', en: 'BAR BENDING SCHEDULE' }),
  'RW-05': Object.freeze({ th: 'สรุปผลตรวจสอบ', en: 'DESIGN CHECK SUMMARY' }),
  'RW-06': Object.freeze({ th: 'ผังพนังระหว่างครีบ', en: 'WALL PANEL DETAIL' }),
});

/** มาตราส่วนที่ยอมให้ใช้ — นอกบันไดนี้ช่างอ่านแบบจะวัดด้วยสเกลไม้บรรทัดไม่ได้ */
export const SCALE_LADDER = Object.freeze([5, 10, 20, 25, 50, 100, 200, 500]);

/**
 * พื้นที่เขียนแบบที่เหลือบนกระดาษ หลังหักขอบและกรอบชื่อแบบ (มม.)
 * ใช้ตรวจว่ารูปที่มาตราส่วนหนึ่ง ๆ ลงกระดาษได้จริงไหม
 */
export function usableArea(sheetKey = 'A3') {
  const s = SHEET[sheetKey];
  if (!s) throw new RangeError('usableArea: ไม่รู้จักขนาดกระดาษ "' + sheetKey + '"');
  return {
    w: s.w - s.bindingMargin - s.margin - TITLE_BLOCK.w - 10,
    h: s.h - 2 * s.margin - 12,
  };
}

/**
 * แปลงความยาวบนกระดาษ → ความยาวในโมเดล
 * ตัวอักษรสูง 2.5 มม. ที่มาตราส่วน 1:25 ต้องวาดสูง 62.5 มม. ในโมเดลจึงจะพิมพ์ออกมา 2.5 มม.
 */
export function paperToModel(paperMm, scaleDenominator) {
  if (!Number.isFinite(paperMm)) throw new TypeError('paperToModel: paperMm ต้องเป็นตัวเลข');
  if (!Number.isFinite(scaleDenominator) || scaleDenominator <= 0) {
    throw new RangeError('paperToModel: มาตราส่วนต้องเป็นจำนวนบวก');
  }
  return paperMm * scaleDenominator;
}


/* ชั้นคุณภาพเหล็กตาม f_y — สำเนาของตาราง GRADES ใน engine (engine.mjs:208)
   engine ไม่ได้ export ตารางนี้ จึงต้องคัดลอกมา และมีเทสต์บังคับว่าสองที่ต้องตรงกัน
   สำคัญ: SR24 เป็นเหล็กกลมผิวเรียบ ต้องเขียนนำหน้าด้วย RB ไม่ใช่ DB
   ถ้าเขียน DB ทั้งที่เป็น SR24 ช่างจะสั่งเหล็กผิดชนิด */
export const BAR_GRADES = Object.freeze({
  235: { label: 'SR24', prefix: 'RB' },
  295: { label: 'SD30', prefix: 'DB' },
  390: { label: 'SD40', prefix: 'DB' },
  490: { label: 'SD50', prefix: 'DB' },
});

/** คำนำหน้าขนาดเหล็กตามชั้นคุณภาพ — f_y ที่ไม่รู้จักถือเป็นความผิดพลาด ไม่เดา */
export function barPrefix(fy) {
  const g = BAR_GRADES[fy];
  if (!g) throw new RangeError('barPrefix: ไม่รู้จักชั้นคุณภาพเหล็ก f_y = ' + fy + ' — ต้องเป็นหนึ่งใน ' + Object.keys(BAR_GRADES).join(', '));
  return g.prefix;
}

/** ชื่อขนาดเหล็กที่พิมพ์ในแบบ เช่น DB16 หรือ RB9 */
export const barName = (fy, db) => barPrefix(fy) + db;

/**
 * ตารางระยะหุ้มคอนกรีต — engine ฝังค่าฐานรากไว้ที่ 75 มม. ตายตัว (หล่อติดดิน)
 * ส่วนพนังใช้ค่าที่ผู้ใช้กรอก การเขียนระยะหุ้มเป็นประโยคเดียวจึงผิด เพราะมีสองค่า
 */
export function coverTable(i) {
  if (!Number.isFinite(i.cov)) {
    throw new RangeError('coverTable: ไม่มีค่าระยะหุ้มพนัง (i.cov) — engine ไม่มีค่าสำรองให้ ต้องหยุดก่อนพิมพ์แบบ');
  }
  return [
    { th: 'พนัง — ผิวด้านดิน', mm: i.cov, src: 'input' },
    { th: 'พนัง — ผิวด้านนอก', mm: i.cov, src: 'input' },
    { th: 'ฐานราก — ท้องฐาน (หล่อติดดิน)', mm: 75, src: 'engine-embedded/code-constant' },
    { th: 'ฐานราก — ผิวบน', mm: 75, src: 'engine-embedded/code-constant' },
    { th: 'Shear key — ผิวด้านดิน', mm: 75, src: 'engine-embedded/code-constant' },
  ];
}

/** ค้นสไตล์เส้นจาก projection class — ไม่รู้จักคลาสไหนถือเป็นความผิดพลาด ไม่เดา */
export function styleFor(projectionClass) {
  const s = LINE_STYLE[projectionClass];
  if (!s) throw new RangeError('styleFor: ไม่รู้จัก projection class "' + projectionClass + '"');
  return s;
}
