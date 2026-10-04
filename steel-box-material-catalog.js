(function(root){'use strict';
// Dated retailer identity/dimension records, not engineering certification.
const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
const records=[
  {
    "id": "globalhouse-0810012000058",
    "name": "เหล็กแป๊บแบน 4×2 นิ้ว หนา 2.3 มม.",
    "retailer": "Global House",
    "sku": "0810012000058",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B9%81%E0%B8%9A%E0%B8%99--4x2-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-2.3-%E0%B8%A1%E0%B8%A1.-%E0%B8%A1%E0%B8%AD%E0%B8%81.-i.0810012000058",
    "slot": "member",
    "mode": "member_dimensions",
    "reason": "ร้านระบุ OD100×50×2.3 มม.; กำลังตามค่าของงาน ตรวจเกรดและสต็อกก่อนซื้อ",
    "specs": {
      "section": "RHS",
      "tradeSize": "4x2 in",
      "widthMm": 50,
      "depthMm": 100,
      "thicknessMm": 2.3,
      "lengthMm": 6000,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-8822005860036",
    "name": "เหล็กแป๊บแบนกัลวาไนซ์ 4×2 นิ้ว หนา 2.3 มม.",
    "retailer": "Global House",
    "sku": "8822005860036",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B9%81%E0%B8%9A%E0%B8%99-%E0%B8%81%E0%B8%B1%E0%B8%A5%E0%B8%A7%E0%B8%B2%E0%B9%84%E0%B8%99%E0%B8%8B%E0%B9%8C-4x2-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-2.3-%E0%B8%A1%E0%B8%A1.-i.8822005860036",
    "slot": "member",
    "mode": "unavailable",
    "reason": "ขนาดชื่อการค้าเป็นนิ้ว ยังไม่ยืนยันมิติจริงเป็นมิลลิเมตร",
    "specs": {
      "section": "RHS",
      "tradeSize": "4x2 in",
      "widthMm": null,
      "depthMm": null,
      "thicknessMm": 2.3,
      "lengthMm": null,
      "finishAsListed": "galvanized",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-0810012000126",
    "name": "เหล็กแป๊บแบน 4×2 นิ้ว หนา 3.2 มม.",
    "retailer": "Global House",
    "sku": "0810012000126",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B9%81%E0%B8%9A%E0%B8%99--4x2-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-3.2%E0%B8%A1%E0%B8%A1.-%E0%B8%A1%E0%B8%AD%E0%B8%81.JIS.-i.0810012000126",
    "slot": "member",
    "mode": "unavailable",
    "reason": "ขนาดชื่อการค้าเป็นนิ้ว ยังไม่ยืนยันมิติจริงเป็นมิลลิเมตร",
    "specs": {
      "section": "RHS",
      "tradeSize": "4x2 in",
      "widthMm": null,
      "depthMm": null,
      "thicknessMm": 3.2,
      "lengthMm": null,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-0810012000120",
    "name": "เหล็กแป๊บแบน 6×2 นิ้ว หนา 3.2 มม.",
    "retailer": "Global House",
    "sku": "0810012000120",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B9%81%E0%B8%9A%E0%B8%996x2%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A73.2%E0%B8%A1%E0%B8%A1.%E0%B8%A1%E0%B8%AD%E0%B8%81.JIS-i.0810012000120",
    "slot": "member",
    "mode": "unavailable",
    "reason": "ขนาดชื่อการค้าเป็นนิ้ว ยังไม่ยืนยันมิติจริงเป็นมิลลิเมตร",
    "specs": {
      "section": "RHS",
      "tradeSize": "6x2 in",
      "widthMm": null,
      "depthMm": null,
      "thicknessMm": 3.2,
      "lengthMm": 6000,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-022011204402",
    "name": "TMT เหล็กแป๊บแบน 150×75×3.2 มม.",
    "retailer": "Global House",
    "sku": "022011204402",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B9%81%E0%B8%9A%E0%B8%99-150-x-75-x-3.2-%E0%B8%A1%E0%B8%A1.--JIS-i.022011204402",
    "slot": "member",
    "mode": "member_dimensions",
    "reason": "ขนาดตามร้าน กำลังและตัวคูณความหนาตามค่าของโครงการ",
    "specs": {
      "section": "RHS",
      "widthMm": 75,
      "depthMm": 150,
      "thicknessMm": 3.2,
      "lengthMm": 6000,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-022007104471",
    "name": "เหล็กแป๊บสี่เหลี่ยม 3×3 นิ้ว หนา 2.3 มม.",
    "retailer": "Global House",
    "sku": "022007104471",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9B%E0%B9%8A%E0%B8%9A%E0%B8%AA%E0%B8%B5%E0%B9%88%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B8%B5%E0%B9%88%E0%B8%A2%E0%B8%A1-3x3-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7--2.3-%E0%B8%A1%E0%B8%A1.JIS-i.022007104471",
    "slot": "member",
    "mode": "unavailable",
    "reason": "ขนาดชื่อการค้าเป็นนิ้ว ยังไม่ยืนยันมิติจริงเป็นมิลลิเมตร",
    "specs": {
      "section": "SHS",
      "tradeSize": "3x3 in",
      "widthMm": null,
      "depthMm": null,
      "thicknessMm": 2.3,
      "lengthMm": null,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-08014100",
    "name": "เหล็กตัวซีมีขอบ 100×50×20×2.3 มม.",
    "retailer": "Global House",
    "sku": "08014100",
    "url": "https://globalhouse.co.th/product/08014100",
    "slot": "member",
    "mode": "unavailable",
    "reason": "เอนจิ้นคานนี้ใช้เหล็กกล่อง ยังไม่รองรับหน้าตัดตัวซี",
    "specs": {
      "section": "lipped_channel",
      "depthMm": 100,
      "widthMm": 50,
      "lipMm": 20,
      "thicknessMm": 2.3,
      "lengthMm": 6000,
      "gradeAsListed": "SS400"
    }
  },
  {
    "id": "thaiwatsadu-60268320",
    "name": "เหล็กตัวซีมีขอบ 75×45×15×2.3 มม. พ่นปลายสีชมพู",
    "retailer": "ไทวัสดุ",
    "sku": "60268320",
    "url": "https://www.thaiwatsadu.com/th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B8%8B%E0%B8%B5%E0%B8%A1%E0%B8%B5%E0%B8%82%E0%B8%AD%E0%B8%9A-%E0%B8%A1%E0%B8%AD%E0%B8%81-%E0%B8%82%E0%B8%99%E0%B8%B2%E0%B8%94-75-x-45-x-15-x-23-%E0%B8%A1%E0%B8%A1-%E0%B8%9E%E0%B9%88%E0%B8%99%E0%B8%9B%E0%B8%A5%E0%B8%B2%E0%B8%A2%E0%B8%AA%E0%B8%B5%E0%B8%8A%E0%B8%A1%E0%B8%9E%E0%B8%B9-60268320",
    "slot": "member",
    "mode": "unavailable",
    "reason": "ยังไม่ยืนยันหน้าสินค้าปัจจุบัน",
    "specs": {
      "section": "lipped_channel",
      "depthMm": 75,
      "widthMm": 45,
      "lipMm": 15,
      "thicknessMm": 2.3,
      "lengthMm": null,
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-8822006360016",
    "name": "ปืนใหญ่ เพลทเจาะรู 4×4 นิ้ว หนา 6 มม.",
    "retailer": "Global House",
    "sku": "8822006360016",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-4x4-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-6-%E0%B8%A1%E0%B8%A1.-i.8822006360016",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "4x4 in",
      "widthMm": 101.6,
      "heightMm": 101.6,
      "thicknessMm": 6,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610818",
    "name": "ปืนใหญ่ เพลทเจาะรู 5×5 นิ้ว หนา 6 มม.",
    "retailer": "Global House",
    "sku": "3222005610818",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-5x5-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-6-%E0%B8%A1%E0%B8%A1.-i.3222005610818",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "5x5 in",
      "widthMm": 127,
      "heightMm": 127,
      "thicknessMm": 6,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610832",
    "name": "ปืนใหญ่ เพลทเจาะรู 6×6 นิ้ว หนา 9 มม.",
    "retailer": "Global House",
    "sku": "3222005610832",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-6x6-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-9-%E0%B8%A1%E0%B8%A1.-i.3222005610832",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "6x6 in",
      "widthMm": 152.4,
      "heightMm": 152.4,
      "thicknessMm": 9,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610863",
    "name": "ปืนใหญ่ เพลทเจาะรู 8×8 นิ้ว หนา 6 มม.",
    "retailer": "Global House",
    "sku": "3222005610863",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-8x8-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-6-%E0%B8%A1%E0%B8%A1.-i.3222005610863",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "8x8 in",
      "widthMm": 203.2,
      "heightMm": 203.2,
      "thicknessMm": 6,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610870",
    "name": "ปืนใหญ่ เพลทเจาะรู 8×8 นิ้ว หนา 9 มม.",
    "retailer": "Global House",
    "sku": "3222005610870",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-8x8-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-9-%E0%B8%A1%E0%B8%A1.-i.3222005610870",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "8x8 in",
      "widthMm": 203.2,
      "heightMm": 203.2,
      "thicknessMm": 9,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3622006760077",
    "name": "ปืนใหญ่ เพลทกัลวาไนซ์เจาะรู 6×6 นิ้ว หนา 6 มม.",
    "retailer": "Global House",
    "sku": "3622006760077",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%81%E0%B8%B1%E0%B8%A5%E0%B8%A7%E0%B8%B2%E0%B9%84%E0%B8%99%E0%B8%8B%E0%B9%8C%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-6x6-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-6-%E0%B8%A1%E0%B8%A1.-i.3622006760077",
    "slot": "plate",
    "mode": "plate_dimensions",
    "reason": "ใช้ขนาดแผ่นและรูตามร้าน ผังรูและเกรดตามค่าของงาน ยังไม่ยืนยันรูสำเร็จรูป",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "6x6 in",
      "widthMm": 152.4,
      "heightMm": 152.4,
      "thicknessMm": 6,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "galvanized",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3622006760114",
    "name": "ปืนใหญ่ เพลทกัลวาไนซ์เจาะรู 8×8 นิ้ว หนา 6 มม.",
    "retailer": "Global House",
    "sku": "3622006760114",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%81%E0%B8%B1%E0%B8%A5%E0%B8%A7%E0%B8%B2%E0%B9%84%E0%B8%99%E0%B8%8B%E0%B9%8C%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-8x8-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-6-%E0%B8%A1%E0%B8%A1.-i.3622006760114",
    "slot": "plate",
    "mode": "unavailable",
    "reason": "ยังไม่มีมิติแผ่น/รูครบพอเชื่อมคำนวณ",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "8x8 in",
      "widthMm": null,
      "heightMm": null,
      "thicknessMm": 6,
      "holeDiameterMm": null,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "galvanized",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610894",
    "name": "ปืนใหญ่ เพลทเจาะรู 10×10 นิ้ว (ความหนาข้อมูลขัดกัน)",
    "retailer": "Global House",
    "sku": "3222005610894",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-10x10-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-12-%E0%B8%A1%E0%B8%A1.-i.3222005610894",
    "slot": "plate",
    "mode": "unavailable",
    "reason": "ข้อมูลต้นทางขัดกัน รอตรวจรุ่น/ขนาด",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "10x10 in",
      "widthMm": 254,
      "heightMm": 254,
      "thicknessMm": null,
      "holeDiameterMm": 15,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-3222005610931",
    "name": "เพลทเจาะรู 14×14 นิ้ว หนา 12 มม.",
    "retailer": "Global House",
    "sku": "3222005610931",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%81%E0%B8%9C%E0%B9%88%E0%B8%99%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B9%80%E0%B8%88%E0%B8%B2%E0%B8%B0%E0%B8%A3%E0%B8%B9-14x14-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7-12-%E0%B8%A1%E0%B8%A1.-i.3222005610931",
    "slot": "plate",
    "mode": "unavailable",
    "reason": "ยังไม่มีมิติแผ่น/รูครบพอเชื่อมคำนวณ",
    "specs": {
      "material": "steel_plate",
      "tradeSize": "14x14 in",
      "widthMm": null,
      "heightMm": null,
      "thicknessMm": 12,
      "holeDiameterMm": null,
      "holeCentersMm": null,
      "holeCount": null,
      "finishAsListed": "black_steel",
      "gradeAsListed": null
    }
  },
  {
    "id": "globalhouse-062203104623",
    "name": "U-HENG พุกเคมีชนิดปั่นพร้อมสตัด M12×160",
    "retailer": "Global House",
    "sku": "062203104623",
    "url": "https://globalhouse.co.th/product/%E0%B8%9E%E0%B8%B8%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5%E0%B8%8A%E0%B8%99%E0%B8%B4%E0%B8%94%E0%B8%9B%E0%B8%B1%E0%B9%88%E0%B8%99%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%94-%E0%B8%82%E0%B8%99%E0%B8%B2%E0%B8%94-M12x160-i.062203104623",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "kit",
      "metricSize": 12,
      "rodOverallLengthMm": 160,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "globalhouse-8850100001900",
    "name": "PANSIAM พุกเคมีชนิดตอกพร้อมสตัด M16×190",
    "retailer": "Global House",
    "sku": "8850100001900",
    "url": "https://globalhouse.co.th/product/%E0%B8%9E%E0%B8%B8%E0%B9%8A%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5%E0%B8%8A%E0%B8%99%E0%B8%B4%E0%B8%94%E0%B8%95%E0%B8%AD%E0%B8%81%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%94-M16x190-i.8850100001900",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "kit",
      "metricSize": 16,
      "rodOverallLengthMm": 190,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "globalhouse-8859177001790",
    "name": "PANSIAM สตัดพุกเคมี M10×130",
    "retailer": "Global House",
    "sku": "8859177001790",
    "url": "https://globalhouse.co.th/product/%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%B8%E0%B9%8A%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5-M10x130mm.-i.8859177001790",
    "slot": "anchor",
    "mode": "unavailable",
    "reason": "M10 ยังไม่มีพื้นที่เกลียวในตารางเอนจิ้นชุดนี้",
    "specs": {
      "assemblyKind": "rod_only",
      "metricSize": 10,
      "rodOverallLengthMm": 130,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "globalhouse-8859177001806",
    "name": "PANSIAM สตัดพุกเคมี M12×160",
    "retailer": "Global House",
    "sku": "8859177001806",
    "url": "https://globalhouse.co.th/product/%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%B8%E0%B9%8A%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5-M12x160mm.-i.8859177001806",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "rod_only",
      "metricSize": 12,
      "rodOverallLengthMm": 160,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "globalhouse-8859177001820",
    "name": "U-HENG สตัดพุกเคมี M20×260",
    "retailer": "Global House",
    "sku": "8859177001820",
    "url": "https://globalhouse.co.th/product/%E0%B8%AA%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%9E%E0%B8%B8%E0%B9%8A%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5-M20x260mm.-i.8859177001820",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "rod_only",
      "metricSize": 20,
      "rodOverallLengthMm": 260,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "globalhouse-8852278175995",
    "name": "จระเข้ เคมแองเคอร์-1 300 มล.",
    "retailer": "Global House",
    "sku": "8852278175995",
    "url": "https://globalhouse.co.th/product/%E0%B8%88%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%82%E0%B9%89-%E0%B9%80%E0%B8%84%E0%B8%A1-%E0%B9%81%E0%B8%AD%E0%B8%87%E0%B9%80%E0%B8%84%E0%B8%AD%E0%B8%A3%E0%B9%8C1-%E0%B9%80%E0%B8%84%E0%B8%A1%E0%B8%B5%E0%B9%80%E0%B8%AA%E0%B8%B5%E0%B8%A2%E0%B8%9A%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B8%8A%E0%B8%99%E0%B8%B4%E0%B8%94%E0%B9%81%E0%B8%AB%E0%B9%89%E0%B8%87%E0%B9%80%E0%B8%A3%E0%B9%87%E0%B8%A7-300-%E0%B8%A1%E0%B8%A5.-%E0%B8%AA%E0%B8%B5%E0%B9%80%E0%B8%97%E0%B8%B2%E0%B8%AD%E0%B9%88%E0%B8%AD%E0%B8%99--i.8852278175995",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "resin_only",
      "metricSize": null,
      "rodOverallLengthMm": null,
      "cartridgeVolumeMl": 300,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "homepro-171040",
    "name": "SIKA AnchorFix-1 300 มล.",
    "retailer": "HomePro",
    "sku": "171040",
    "url": "https://www.homepro.co.th/p/171040",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "resin_only",
      "metricSize": null,
      "rodOverallLengthMm": null,
      "cartridgeVolumeMl": 300,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "homepro-1254555",
    "name": "DEXZON พุกเคมีแบบตอก M12",
    "retailer": "HomePro",
    "sku": "1254555",
    "url": "https://www.homepro.co.th/p/1254555",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "capsule_only",
      "metricSize": 12,
      "rodOverallLengthMm": null,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "homepro-1254546",
    "name": "DEXZON พุกเคมีแบบตอก M16",
    "retailer": "HomePro",
    "sku": "1254546",
    "url": "https://www.homepro.co.th/p/1254546",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "capsule_only",
      "metricSize": 16,
      "rodOverallLengthMm": null,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "homepro-1254545",
    "name": "DEXZON พุกเคมีแบบตอก M20",
    "retailer": "HomePro",
    "sku": "1254545",
    "url": "https://www.homepro.co.th/p/1254545",
    "slot": "anchor",
    "mode": "anchor_demand_only",
    "reason": "คำนวณแรงที่ลงพุก ไม่ยืนยันกำลังรับแรงของรุ่นนี้",
    "specs": {
      "assemblyKind": "capsule_only",
      "metricSize": 20,
      "rodOverallLengthMm": null,
      "cartridgeVolumeMl": null,
      "effectiveEmbedmentMm": null,
      "compatibleSystemId": null,
      "designTensionKN": null,
      "designShearKN": null
    }
  },
  {
    "id": "thaiwatsadu-60426943",
    "name": "BLUESCOPE เมทัลชีทลอน 760 หนา 0.35 มม. สีแดง",
    "retailer": "ไทวัสดุ",
    "sku": "60426943",
    "url": "https://www.thaiwatsadu.com/th/product/%E0%B9%80%E0%B8%A1%E0%B8%97%E0%B8%B1%E0%B8%A5%E0%B8%8A%E0%B8%B5%E0%B8%97-%E0%B8%AB%E0%B8%99%E0%B8%B2-035-%E0%B8%A1%E0%B8%A1-%E0%B8%A5%E0%B8%AD%E0%B8%99-760-BLUESCOPE-%E0%B8%AA%E0%B8%B5%E0%B9%81%E0%B8%94%E0%B8%87-%28%E0%B8%95%E0%B8%B1%E0%B8%94%E0%B8%82%E0%B8%B2%E0%B8%A2%E0%B9%80%E0%B8%9B%E0%B9%87%E0%B8%99%E0%B9%80%E0%B8%A1%E0%B8%95%E0%B8%A3%29-60426943",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่ยืนยันหน้าสินค้าปัจจุบัน",
    "specs": {
      "kind": "profiled_metal_roof",
      "profileAsListed": "760",
      "thicknessAsListedMm": 0.35,
      "baseSteelThicknessMm": null,
      "thicknessBasis": "unknown_BMT_or_TCT",
      "saleDescription": "ตัดขายเป็นเมตร",
      "massPerAreaKgM2": null
    }
  },
  {
    "id": "globalhouse-700004",
    "name": "KINROOF SNAPLOCK 300 สี Forest Green (ข้อมูลความหนารอตรวจ)",
    "retailer": "Global House",
    "sku": "700004",
    "url": "https://globalhouse.co.th/product/KINROOF-%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%B2%E0%B9%80%E0%B8%AB%E0%B8%A5%E0%B9%87%E0%B8%81%E0%B9%80%E0%B8%84%E0%B8%A5%E0%B8%B7%E0%B8%AD%E0%B8%9A%E0%B9%80%E0%B8%8B%E0%B8%A3%E0%B8%B2%E0%B8%A1%E0%B8%B4%E0%B8%81-%E0%B8%A5%E0%B8%AD%E0%B8%99%E0%B8%AA%E0%B9%81%E0%B8%99%E0%B8%9B%E0%B8%A5%E0%B9%87%E0%B8%AD%E0%B8%84-300-%E0%B8%82%E0%B8%99%E0%B8%B2%E0%B8%94-35x100x0.4-%E0%B8%8B%E0%B8%A1.%E0%B9%80%E0%B8%A1%E0%B9%87%E0%B8%94%E0%B8%9B%E0%B8%81%E0%B8%95%E0%B8%B4-%E0%B8%AA%E0%B8%B5-Forest-Green-i.700004",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ข้อมูลต้นทางขัดกัน รอตรวจรุ่น/ขนาด",
    "specs": {
      "kind": "coated_metal_roof",
      "profileAsListed": "SNAPLOCK 300",
      "retailDimensions": "35x100x0.4 cm",
      "baseSteelThicknessMm": null,
      "massPerAreaKgM2": null
    }
  },
  {
    "id": "globalhouse-8858831450219",
    "name": "ตราเพชร DECRA Senator Shingle สี Eclipse",
    "retailer": "Global House",
    "sku": "8858831450219",
    "url": "https://globalhouse.co.th/product/%E0%B8%95%E0%B8%A3%E0%B8%B2%E0%B9%80%E0%B8%9E%E0%B8%8A%E0%B8%A3-%E0%B8%81%E0%B8%A3%E0%B8%B0%E0%B9%80%E0%B8%9A%E0%B8%B7%E0%B9%89%E0%B8%AD%E0%B8%87%E0%B8%AB%E0%B8%A5%E0%B8%B1%E0%B8%87%E0%B8%84%E0%B8%B2Decra-%E0%B8%A3%E0%B8%B8%E0%B9%88%E0%B8%99-Senator-Shingle-%E0%B8%AA%E0%B8%B5-Eclipse-i.8858831450219",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่มีตัวเชื่อมคุณสมบัติของวัสดุชนิดนี้",
    "specs": {
      "kind": "stone_coated_metal_roof",
      "massPerAreaKgM2": 6.6,
      "massEvidence": "retailer_claim",
      "baseSteelThicknessMm": null
    }
  },
  {
    "id": "homepro-281641",
    "name": "GYPROC ยิปซัมธรรมดาขอบลาด RE 9 มม. 120×240 ซม.",
    "retailer": "HomePro",
    "sku": "281641",
    "url": "https://www.homepro.co.th/p/281641",
    "slot": "ceiling",
    "mode": "ceiling_assembly",
    "reason": "ใช้ DL ชุดฝ้ารวมโครงคร่าวตาม preset เดิม ไม่ใช่น้ำหนักแผ่นอย่างเดียว; สินค้าระบุใช้ภายใน",
    "specs": {
      "kind": "gypsum_ceiling",
      "widthMm": 1200,
      "lengthMm": 2400,
      "thicknessMm": 9,
      "sheetMassKg": 15.5,
      "massEvidence": "retailer_claim",
      "applicationAsListed": "interior",
      "areaFromDimensionsM2": 2.88
    }
  },
  {
    "id": "homepro-1110611",
    "name": "DURAONE ยิปซัมทนชื้นขอบลาด RE 9 มม. 120×240 ซม.",
    "retailer": "HomePro",
    "sku": "1110611",
    "url": "https://www.homepro.co.th/p/1110611",
    "slot": "ceiling",
    "mode": "ceiling_assembly",
    "reason": "ใช้ DL ชุดฝ้ารวมโครงคร่าวตาม preset เดิม ไม่ใช่น้ำหนักแผ่นอย่างเดียว; สินค้าระบุใช้ภายใน",
    "specs": {
      "kind": "moisture_resistant_gypsum_ceiling",
      "widthMm": 1200,
      "lengthMm": 2400,
      "thicknessMm": 9,
      "sheetMassKg": 15.5,
      "massEvidence": "retailer_claim",
      "applicationAsListed": "interior_moisture_areas",
      "areaFromDimensionsM2": 2.88
    }
  },
  {
    "id": "homepro-1079057",
    "name": "SHERA ฝ้าบอร์ดโปรขอบตรง 4 มม. 120×240 ซม.",
    "retailer": "HomePro",
    "sku": "1079057",
    "url": "https://www.homepro.co.th/p/1079057",
    "slot": "ceiling",
    "mode": "unavailable",
    "reason": "ข้อมูลต้นทางขัดกัน รอตรวจรุ่น/ขนาด",
    "specs": {
      "kind": "fibre_cement_ceiling",
      "widthMm": 1200,
      "lengthMm": 2400,
      "thicknessMm": 4,
      "sheetMassKg": 17.6,
      "massEvidence": "retailer_claim",
      "applicationAsListed": "interior_and_exterior_soffit",
      "areaFromDimensionsM2": 2.88,
      "approvedAreaM2": null
    }
  },
  {
    "id": "homepro-1109531",
    "name": "SHERA ฝ้าบอร์ดโปรขอบตรง 4 มม. 60×240 ซม.",
    "retailer": "HomePro",
    "sku": "1109531",
    "url": "https://www.homepro.co.th/p/1109531",
    "slot": "ceiling",
    "mode": "unavailable",
    "reason": "ข้อมูลต้นทางขัดกัน รอตรวจรุ่น/ขนาด",
    "specs": {
      "kind": "fibre_cement_ceiling",
      "widthMm": 600,
      "lengthMm": 2400,
      "thicknessMm": 4,
      "sheetMassKg": 8.81,
      "massEvidence": "retailer_claim",
      "applicationAsListed": "interior_and_exterior_soffit",
      "areaFromDimensionsM2": 1.44,
      "approvedAreaM2": null
    }
  },
  {
    "id": "globalhouse-070601281",
    "name": "ลวดสลิงชุบสังกะสี 6 มม. 6×19 FC ไส้เชือก",
    "retailer": "Global House",
    "sku": "070601281",
    "url": "https://globalhouse.co.th/product/%E0%B8%A5%E0%B8%A7%E0%B8%94%E0%B8%AA%E0%B8%A5%E0%B8%B4%E0%B8%87%C2%A06-%E0%B8%A1%E0%B8%B4%E0%B8%A5-6x19-FC-%E0%B9%84%E0%B8%AA%E0%B9%89%E0%B9%80%E0%B8%8A%E0%B8%B7%E0%B8%AD%E0%B8%81-i.070601281",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่มีตัวเชื่อมคุณสมบัติของวัสดุชนิดนี้",
    "specs": {
      "kind": "wire_rope",
      "diameterMm": 6,
      "constructionAsListed": "6x19 FC",
      "finishAsListed": "galvanized",
      "minimumBreakingLoadKN": null,
      "workingLoadKN": null,
      "compatibleAssemblyId": null
    }
  },
  {
    "id": "globalhouse-6061100000534",
    "name": "เกลียวเร่ง 3/4 นิ้ว",
    "retailer": "Global House",
    "sku": "6061100000534",
    "url": "https://globalhouse.co.th/product/%E0%B9%80%E0%B8%81%E0%B8%A5%E0%B8%B5%E0%B8%A2%E0%B8%A7%E0%B9%80%E0%B8%A3%E0%B9%88%E0%B8%87%C2%A03%2F4-i.6061100000534",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่ยืนยันหน้าสินค้าปัจจุบัน",
    "specs": {
      "kind": "turnbuckle",
      "tradeSize": "3/4 in",
      "workingLoadKN": null,
      "compatibleAssemblyId": null
    }
  },
  {
    "id": "globalhouse-1903122051834",
    "name": "FIX-XY กิ๊บจับลวดสลิง 3/16 นิ้ว EQ-002-S แพ็ก 6 ชิ้น",
    "retailer": "Global House",
    "sku": "1903122051834",
    "url": "https://globalhouse.co.th/product/FIXXY-%E0%B8%81%E0%B8%B4%E0%B9%8A%E0%B8%9A%E0%B8%88%E0%B8%B1%E0%B8%9A%E0%B8%A5%E0%B8%A7%E0%B8%94%E0%B8%AA%E0%B8%A5%E0%B8%B4%E0%B8%87316-%E0%B8%99%E0%B8%B4%E0%B9%89%E0%B8%A7--%E0%B8%A3%E0%B8%B8%E0%B9%88%E0%B8%99-EQ002S-6%E0%B8%8A%E0%B8%B4%E0%B9%89%E0%B8%99%E0%B9%81%E0%B8%9E%E0%B9%87%E0%B8%84-i.1903122051834",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่มีตัวเชื่อมคุณสมบัติของวัสดุชนิดนี้",
    "specs": {
      "kind": "wire_rope_clip",
      "tradeSize": "3/16 in",
      "packQuantity": 6,
      "compatibleRopeDiameterMm": null,
      "workingLoadKN": null,
      "compatibleAssemblyId": null
    }
  },
  {
    "id": "globalhouse-8859177004203",
    "name": "FIX-XY นอตตัวเมีย M12 แพ็ก 10 ชิ้น",
    "retailer": "Global House",
    "sku": "8859177004203",
    "url": "https://globalhouse.co.th/product/FIXXY-%E0%B8%99%E0%B9%87%E0%B8%AD%E0%B8%95%E0%B8%95%E0%B8%B1%E0%B8%A7%E0%B9%80%E0%B8%A1%E0%B8%B5%E0%B8%A2-M12-10-%E0%B8%8A%E0%B8%B4%E0%B9%89%E0%B8%99-%E0%B8%96%E0%B8%B8%E0%B8%87-i.8859177004203",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่มีตัวเชื่อมคุณสมบัติของวัสดุชนิดนี้",
    "specs": {
      "kind": "nut",
      "metricSize": 12,
      "packQuantity": 10,
      "propertyClass": null,
      "threadPitchMm": null
    }
  },
  {
    "id": "homepro-1126649",
    "name": "SEALTEX สกรูยึดท้องลอนปลายสว่าน 10-16×20 มม. แพ็ก 100 ชิ้น",
    "retailer": "HomePro",
    "sku": "1126649",
    "url": "https://www.homepro.co.th/m/p/1126649",
    "slot": "reference",
    "mode": "unavailable",
    "reason": "ยังไม่มีตัวเชื่อมคุณสมบัติของวัสดุชนิดนี้",
    "specs": {
      "kind": "roof_self_drilling_screw",
      "threadDesignation": "10-16",
      "lengthMm": 20,
      "packQuantity": 100,
      "diameterMm": null,
      "designPulloutKN": null,
      "designPulloverKN": null
    }
  },
  {
    "id": "ceiling-none",
    "name": "ไม่มีฝ้า",
    "slot": "ceiling",
    "mode": "ceiling_assembly",
    "reason": "เอาฝ้าออกจากชุดน้ำหนักเดิม",
    "specs": {
      "none": true
    },
    "url": "",
    "retailer": "",
    "sku": ""
  }
];
records.push({id:'globalhouse-0810012000034',name:'เหล็กกล่อง 50×50×2.3 มม. (2×2 นิ้ว)',retailer:'Global House',sku:'0810012000034',
  url:'https://globalhouse.co.th/product/เหล็กแป๊บสีเหลี่ยม-2x2-นิ้ว-2.3มม.มอก-i.0810012000034',slot:'member',mode:'member_dimensions',
  reason:'ร้านระบุ OD50×50×2.3 มม.; กำลังตามค่าของงาน ตรวจเกรดและสต็อกก่อนซื้อ',
  specs:{section:'SHS',depthMm:50,widthMm:50,thicknessMm:2.3,lengthMm:6000,gradeAsListed:null}});
// Manufacturer ranges are NOT retailer SKU/stock confirmations. The endpoints
// below are transcribed from TMT's published dimension/thickness tables.
const ranges={RHS:[[50,25,1.6,3.2],[60,30,1.6,3.2],[75,38,1.6,3.2],[75,45,1.6,4.5],[100,50,1.6,6],[125,50,2.3,6],[125,75,2.3,6],[150,50,2.3,6],[150,75,3.2,6],[150,100,3.2,6],[200,100,3.2,6]],
  SHS:[[25,25,1.6,2.3],[32,32,1.6,2.3],[38,38,1.6,2.3],[50,50,1.6,4.5],[75,75,1.6,6],[100,100,2,6],[125,125,3.2,6],[150,150,3.2,6]]};
for(const [section,rows] of Object.entries(ranges))for(const [H,B,min,max] of rows)for(const t of [1.6,2,2.3,3.2,4.5,6].filter(t=>t>=min&&t<=max)){
  records.push({id:`tmt-range-${H}x${B}x${t}`,name:`TMT ${H}×${B}×${t} มม. (ช่วงแค็ตตาล็อก)`,retailer:'TMT Steel',sku:'สอบถามขนาดย่อย / สต็อก',
    url:section==='RHS'?'https://tmtsteel.co.th/en/cold-formed-product/tube-and-pipe/rectangular-tube/':'https://tmtsteel.co.th/cold-formed-product/tube-and-pipe/square-tube/',
    slot:'member',mode:'member_dimensions',evidence:'manufacturer_range',reason:`ผู้ผลิตระบุ ${H}×${B} มม. หนา ${min}–${max} มม.; ขนาดย่อยนี้อยู่ในช่วง ไม่ใช่การยืนยัน SKU หรือสต็อกสาขา`,
    specs:{section,depthMm:H,widthMm:B,thicknessMm:t,gradeAsListed:null}});
}
for(const row of [...records].filter(r=>r.slot==='member'&&r.mode==='member_dimensions'))records.push({...row,id:row.id+'-purlin',slot:'purlin',mode:'purlin_dimensions'});
root.NCYSC01RetailMaterials=freeze({version:'20260906-r25',ranges,records});
}(typeof window!=='undefined'?window:globalThis));
