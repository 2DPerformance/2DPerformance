/* One immutable work-item catalog for the local report UI and storage validator. */
(function (global) {
  'use strict';
  const groups = [
    { id: 'site', title: 'เตรียมพื้นที่ / งานภายนอก' },
    { id: 'structure', title: 'งานโครงสร้าง' },
    { id: 'architecture', title: 'งานสถาปัตยกรรม' },
    { id: 'systems', title: 'งานระบบ / สุขภัณฑ์' },
  ];
  // The first six IDs and their existing labels are persistent-data identities.
  // Do not rename them or rewrite old photo metadata when adding new categories.
  const tasks = [
    { id: 'prepare', title: 'เตรียมพื้นที่', note: 'เคลียร์พื้นที่ · ขนย้าย · เตรียมหน้างาน', icon: 'shovel', groupId: 'site' },
    { id: 'structure', title: 'งานโครงสร้าง', note: 'แบบหล่อ · เหล็ก · คอนกรีต', icon: 'building-2', groupId: 'structure' },
    { id: 'wall', title: 'งานก่อ–ฉาบ', note: 'ก่อผนัง · ฉาบ · ปรับผิว', icon: 'brick-wall', groupId: 'architecture' },
    { id: 'systems', title: 'งานระบบ', note: 'ไฟฟ้า · ประปา · สุขาภิบาล', icon: 'wrench', groupId: 'systems' },
    { id: 'roof', title: 'งานหลังคา', note: 'โครงหลังคา · มุง · รางน้ำ', icon: 'house', groupId: 'architecture' },
    { id: 'finish', title: 'งานตกแต่ง / เก็บงาน', note: 'สี · กระเบื้อง · ตรวจเก็บงาน', icon: 'paint-roller', groupId: 'architecture' },
    { id: 'floor', title: 'งานพื้น / ปรับระดับ', note: 'ปรับระดับ · พื้นปูนขัดมัน · วัสดุปูพื้นอื่น', icon: 'layers', groupId: 'architecture' },
    { id: 'tile', title: 'งานกระเบื้อง', note: 'กระเบื้องพื้น · กระเบื้องผนัง · ยาแนว', icon: 'layout-grid', groupId: 'architecture' },
    { id: 'ceiling', title: 'งานฝ้าเพดาน', note: 'โครงคร่าว · แผ่นฝ้า · ช่องเซอร์วิส', icon: 'square', groupId: 'architecture' },
    { id: 'painting', title: 'งานสี', note: 'เตรียมผิว · รองพื้น · ทาสี', icon: 'paint-roller', groupId: 'architecture' },
    { id: 'doors', title: 'งานประตู', note: 'วงกบ · บานประตู · อุปกรณ์ประตู', icon: 'door-open', groupId: 'architecture' },
    { id: 'windows', title: 'งานหน้าต่าง', note: 'วงกบ · บานหน้าต่าง · ซีลรอยต่อ', icon: 'panel-top', groupId: 'architecture' },
    { id: 'waterproofing', title: 'งานกันซึม', note: 'ห้องน้ำ · ดาดฟ้า · รอยต่อกันน้ำ', icon: 'droplets', groupId: 'architecture' },
    { id: 'facade', title: 'งานผนังภายนอก / ฟาซาด', note: 'แผ่นกรุ · ผิวอาคาร · รอยต่อภายนอก', icon: 'building-2', groupId: 'architecture' },
    { id: 'glass', title: 'งานกระจก', note: 'กระจกติดตาย · ผนังกระจก · อุปกรณ์ยึด', icon: 'square', groupId: 'architecture' },
    { id: 'metalwork', title: 'งานโลหะ / ราวกันตก', note: 'ราวบันได · ราวกันตก · งานโลหะตกแต่ง', icon: 'fence', groupId: 'architecture' },
    { id: 'joinery', title: 'งานไม้ / บิลต์อิน', note: 'ตู้ · เคาน์เตอร์ · งานไม้ประกอบ', icon: 'hammer', groupId: 'architecture' },
    { id: 'sanitary', title: 'งานสุขภัณฑ์', note: 'โถสุขภัณฑ์ · อ่างล้างหน้า · ก๊อกและอุปกรณ์', icon: 'bath', groupId: 'systems' },
    { id: 'landscape', title: 'งานภายนอก / ภูมิทัศน์', note: 'ทางเดิน · ปลูกต้นไม้ · จัดพื้นที่ภายนอก', icon: 'trees', groupId: 'site' },
    { id: 'cleaning', title: 'งานทำความสะอาด', note: 'เก็บเศษวัสดุ · ล้างพื้น · ทำความสะอาดพื้นที่', icon: 'brush', groupId: 'site' },
  ];
  global.SiteReportCatalog = Object.freeze({
    version: 1,
    groups: Object.freeze(groups.map(group => Object.freeze(group))),
    tasks: Object.freeze(tasks.map(task => Object.freeze(task))),
  });
})(globalThis);
