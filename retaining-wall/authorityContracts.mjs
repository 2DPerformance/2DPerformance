/**
 * Immutable cross-surface authority contracts for Retaining Wall Beta.
 *
 * Kept independent from Snapshot/renderers so A3, A4, DXF and 3D can validate
 * exact identity without circular imports or locally invented wording.
 */
export const RW_REBAR_GEOMETRY_HOLD = Object.freeze({
  status: 'ENGINE_SHARED_TRANSVERSE_LAYOUT',
  constructionAuthority: false,
  marks: Object.freeze(['⑧']),
  label: 'REBAR ⑧ · SHARED ENGINE LAYOUT · NOT FOR CONSTRUCTION',
  reason: 'มาร์ค ⑧ ใช้ centerline เดียวจาก Engine; ตรวจชั้นเหล็ก ระยะหุ้ม ความยาว จำนวน และระยะพัฒนากำลังร่วมกับ D/C',
});
