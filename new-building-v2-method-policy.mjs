export function getNewBuildingV2SdmOnlyReason(codeStandard) {
  return codeStandard === 'aci_318_19'
    ? 'ACI 318-19 ออกแบบเสาด้วยวิธีกำลัง (SDM) เท่านั้น'
    : 'การ์ดเสา ฐานรากแผ่ และเหล็กกลุ่มคานในเส้นทางนี้ออกแบบด้วยวิธีกำลัง (SDM) เท่านั้น';
}
export function getNewBuildingV2SdmSwitchMessage(codeStandard) {
  return `โครงการนี้เลือกวิธีหน่วยแรงใช้งาน (WSD) แต่ ${getNewBuildingV2SdmOnlyReason(codeStandard)} · เปลี่ยนทั้งโครงการเป็น SDM แล้วคำนวณใหม่ทุกชิ้น`;
}
export const NEW_BUILDING_V2_SDM_SWITCH_MESSAGE = getNewBuildingV2SdmSwitchMessage('aci_318_19');
export const NEW_BUILDING_V2_SDM_ONLY_PARTS = 'ส่วนที่ใช้ SDM เท่านั้น: เสา, ฐานรากแผ่, เหล็กกลุ่มคาน';
