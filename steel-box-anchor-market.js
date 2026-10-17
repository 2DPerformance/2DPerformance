(function (root) {
  'use strict';

  // Manufacturer reference tables are NOT an ACI product profile or group capacity.
  // Engineering-reviewed transcription: RE 500 V4 Feb-2026, PDF pp. 6, 8, 14.
  const freeze = (value) => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  const source = 'https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_22070995.pdf';
  const sourceInfo = freeze({
    title: 'Hilti HIT-RE 500 V4 technical data', publication: '2026-02',
    capacityPdfPages: [6, 8], installationPdfPage: 14,
    sha256: '47DAD82A68690E22885C71BE69C213DB3DAB73206E9089B114A24FAAA5E06FB8',
    areaSource: {
      url: 'https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_11768542.pdf',
      publication: '2023-01', pdfPage: 9, table: 'Mechanical properties for HAS-U',
      scope: 'HAS-U threaded steel area only; no HY 200 adhesive capacities adopted',
    },
    materialSource: {
      url: 'https://productdata.hilti.com/APQ_HC_RAW/ASSET_DOC_13313268.pdf',
      report: 'ETA-20/0541', date: '2025-09-10', pdfPage: 10,
      table: 'Table A2, Annex A5 (printed page 9)',
      scope: 'HAS-U steel fuk only; ETA is not an ACI product qualification',
    },
  });
  const conditions = freeze([
    'REFERENCE ONLY — แรงแนะนำของพุกเดี่ยว ไม่ใช่กำลังออกแบบกลุ่มพุกหรือผล PASS',
    'คอนกรีต C20/25; อายุใช้งานอ้างอิง 50 ปี',
    'แรงระยะสั้นแบบ static หรือ quasi-static; action factor γ = 1.4',
    'ไม่มีผลลดจากระยะขอบและระยะห่าง; ห้ามนำ Nrec/Vrec คูณจำนวนพุก',
    'ติดตั้งถูกต้องด้วยระบบ HD หรือ HDB ตามคู่มือผู้ผลิต',
    'อุณหภูมิใช้งานระยะยาวไม่เกิน 24°C และระยะสั้นไม่เกิน 40°C',
    'HAS-U 5.8 / 8.8 electroplated สำหรับภายในแห้ง; ไม่ครอบคลุม HDG หรือสเตนเลส',
    'ต้องตรวจการกัดกร่อนและสภาพสัมผัสจริง; ไม่รับรองการใช้ภายนอกอาคารจากชื่อยี่ห้อ',
    'ระยะขอบ/ระยะห่างขั้นต่ำเป็นข้อกำหนดติดตั้ง ไม่ใช่ระยะที่ไม่มีการลดกำลัง',
    'ต้องตรวจแรงดึงร่วมแรงเฉือน กลุ่มพุก ระยะขอบ และการฝังจริงแยกต่างหาก',
  ]);
  const sizes = [8, 10, 12, 16, 20, 24, 27, 30];
  const areas = [36.6, 58, 84.3, 157, 245, 353, 459, 561];
  const hef = [80, 90, 110, 125, 170, 210, 240, 270];
  const hmin = [110, 120, 140, 161, 214, 266, 300, 340];
  const drill = [10, 12, 14, 18, 22, 28, 30, 35];
  const hefMin = [60, 60, 70, 80, 90, 96, 108, 120];
  const hefMax = [160, 200, 240, 320, 400, 480, 540, 600];
  const torque = [10, 20, 40, 80, 150, 200, 270, 300];
  const spacing = [40, 50, 60, 75, 90, 115, 120, 140];
  const edge = [40, 45, 45, 50, 55, 60, 75, 80];
  const crackedTension = [7.2, 12.1, 18.9, 22.9, 36.3, 49.9, 61.0, 72.7];
  const rods = freeze([
    {
      id: 'hasu-5-8', label: 'HAS-U 5.8 · electroplated', futa: 500,
      uncrackedTension: [8.7, 13.8, 20.1, 32.7, 51.9, 71.3, 87.1, 103.9],
      shear: [6.3, 9.9, 14.5, 26.9, 42.0, 60.5, 78.7, 96.2],
    },
    {
      id: 'hasu-8-8', label: 'HAS-U 8.8 · electroplated', futa: 800,
      uncrackedTension: [13.9, 20, 27, 32.7, 51.9, 71.3, 87.1, 103.9],
      shear: [8.4, 13.3, 19.3, 35.9, 56.0, 80.7, 104.9, 128.2],
    },
  ]);
  const FAMILIES = freeze([{
    id: 'hit-re-500-v4', label: 'Hilti HIT-RE 500 V4', type: 'adhesive',
    rods: rods.map(({ id, label }) => ({ id, label })), sizes: [...sizes], source,
  }]);
  const rows = new Map();
  for (const rod of rods) {
    sizes.forEach((diameter, index) => {
      for (const cracked of [true, false]) {
        rows.set(`${rod.id}:${diameter}:${cracked}`, freeze({
          familyId: FAMILIES[0].id, familyLabel: FAMILIES[0].label,
          rodId: rod.id, rodLabel: rod.label, type: 'adhesive', diameter, cracked,
          hef: hef[index], hmin: hmin[index], Ase: areas[index], futa: rod.futa,
          Nrec: (cracked ? crackedTension : rod.uncrackedTension)[index],
          Vrec: rod.shear[index], forceUnit: 'kN', lengthUnit: 'mm',
          areaUnit: 'mm²', stressUnit: 'MPa', recommendedOnly: true,
          conditions, source, sourceInfo,
          installation: {
            holeDiameter: drill[index], drillDepth: hef[index], hefMin: hefMin[index],
            hefMax: hefMax[index], torqueNm: torque[index],
            minSpacing: spacing[index], minEdge: edge[index],
          },
        }));
      }
    });
  }

  function getRow(familyId, rodId, diameter, cracked) {
    if (familyId !== FAMILIES[0].id || typeof rodId !== 'string'
      || !Number.isInteger(diameter) || typeof cracked !== 'boolean') return null;
    return rows.get(`${rodId}:${diameter}:${cracked}`) || null;
  }

  // Deliberately lookup-only: no project, engine, native area table, evidence,
  // product identity or capacity is written by selecting a manufacturer row.
  root.NCYSC01AnchorMarket = freeze({ VERSION: '1.0.0', FAMILIES, getRow });
}(typeof window !== 'undefined' ? window : globalThis));
