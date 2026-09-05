/**
 * Immutable cross-surface authority contracts for Retaining Wall Beta.
 *
 * Kept independent from Snapshot/renderers so A3, A4, DXF and 3D can validate
 * exact identity without circular imports or locally invented wording.
 */
export const RW_REBAR_GEOMETRY_HOLD = Object.freeze({
  status: 'HOLD_BBS_A3_GEOMETRY_UNRECONCILED',
  constructionAuthority: false,
  marks: Object.freeze(['⑧']),
  label: 'REBAR ⑧ PLACEMENT OMITTED · BBS ONLY · PE DETAIL HOLD · NOT FOR CONSTRUCTION',
  reason: 'มาร์ค ⑧ แสดงเฉพาะ BBS/ปริมาณจาก Engine; A3/DXF/3D ละเว้น placement จนกว่า Owner/PE จะอนุมัติ shared centerline/cover/layer contract',
});
