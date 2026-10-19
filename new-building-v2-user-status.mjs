/** NBV2 public wording. This module never changes a result, gate or saved input. */
const missing = 'ต้องการข้อมูลเพิ่ม';
const calculate = 'ยังไม่ได้คำนวณ — กด วิเคราะห์และออกแบบ';
const stale = 'ข้อมูลเปลี่ยน — คำนวณใหม่';
const unsupported = 'ยังไม่รองรับในรุ่นนี้';
const outOfReport = 'ไม่อยู่ในขอบเขตรายงานนี้';
const engineerSignoff = 'วิศวกรผู้รับผิดชอบต้องตรวจและลงนาม';
const internal = /(?:AUTHORITY|FINGERPRINT|LINEAGE|ENGINE[_ ]?0|CONSTRUCTION[_ ](?:LOCKED|UNAUTHORIZED)|NOT[_ ]FOR[_ ]CONSTRUCTION)/i;
// Shared by the P3 notice and the status translator. Each entry identifies an
// actual input or recovery action; a missing receiver must never look like an
// unspecified request for more project data.
const secondaryIssueGroups = [
  ['SECONDARY_NO_RECEIVER_FOUND SECONDARY_SUPPORT_MISSING', 'ปลายทั้งสองยังไม่มีคานหรือเสารับ', 'P1', 'คานซอย'],
  ['SECONDARY_SINGLE_RECEIVER', 'มีคานหรือเสารับเพียงปลายเดียว ต้องมีจุดรองรับครบสองปลาย', 'P1', 'คานซอย'],
  ['SECONDARY_RECEIVER_AT_JOINT', 'ปลายคานอยู่ที่จุดต่อซึ่งไม่มีเสาหรือคานต่อเนื่องรับแรง', 'P1', 'คานซอย'],
  ['SECONDARY_RECEIVER_AT_SECONDARY_END', 'ปลายคานอยู่ที่ปลายคานซอยอีกเส้น ต้องระบุจุดรองรับที่รับแรงได้', 'P1', 'คานซอย'],
  ['SECONDARY_AMBIGUOUS_RECEIVERS EXACT_SECONDARY_AMBIGUOUS_RECEIVERS_REJECTED', 'มีคานรับซ้อนกันมากกว่าหนึ่งเส้นที่ปลายคาน ต้องระบุคานรับให้ชัด', 'P1', 'คานซอย'],
  ['SECONDARY_SAME_RECEIVER_BOTH_ENDS', 'ปลายทั้งสองอ้างคานรับเส้นเดียวกัน ต้องตรวจตำแหน่งจุดรองรับ', 'P1', 'คานซอย'],
  ['SECONDARY_SUPPORT_HIERARCHY_MISSING EXACT_SECONDARY_CROSSING_REJECTED', 'จุดตัดคานซอยยังไม่ระบุว่าคานเส้นใดรับอีกเส้น', 'P1', 'คานซอย'],
  ['SECONDARY_HIERARCHY_CYCLE', 'คานซอยรับกันเป็นวง ไม่มีทางถ่ายแรงลงคานหลักหรือเสา', 'P1', 'คานซอย'],
  ['SECONDARY_PARENT_SECONDARY_HOLD', 'คานซอยที่เป็นคานรับยังมีจุดรองรับไม่ครบ', 'P1', 'คานซอย'],
  ['SECONDARY_INTERSECTION_REGISTRY_UNRESOLVED', 'คานซอยร่วมชั้นมีตำแหน่งไม่ครบ จึงตรวจจุดตัดไม่ได้', 'P1', 'คานซอย'],
  ['SECONDARY_OVERLAPS_MAIN_BEAM', 'คานซอยวางทับแนวคานหลัก ต้องลบหรือแก้เส้นที่ซ้ำ', 'P1', 'คานซอย'],
  ['SECONDARY_INTERIOR_SUPPORT_UNMODELED', 'คานผ่านจุดรองรับกลางช่วง ต้องแบ่งช่วงคานที่จุดรองรับ', 'P1', 'คานซอย'],
  ['SECONDARY_MEMBER_NOT_IN_DRAWING', 'ไม่พบคานซอยเส้นนี้ในแปลนที่บันทึก', 'P1', 'คานซอย'],
  ['SECONDARY_SOURCE_MEMBER_NOT_FOUND', 'ไม่พบคานต้นทางที่ใช้กำหนดตำแหน่งคานซอย', 'P1', 'คานซอย'],
  ['SECONDARY_SOURCE_NODE_NOT_FOUND', 'คานต้นทางไม่มีพิกัดปลายครบสองจุด', 'P1', 'คานซอย'],
  ['SECONDARY_SOURCE_AXIS_INVALID', 'แนวคานต้นทางไม่ตรงกับแกนที่ใช้กำหนดคานซอย', 'P1', 'คานซอย'],
  ['SECONDARY_SEGMENT_ZERO_LENGTH SECONDARY_EXACT_SEGMENT_DEGENERATE', 'จุดปลายคานซ้อนกันหรือช่วงคานสั้นเกินกำหนด', 'P1', 'คานซอย'],
  ['SECONDARY_EXACT_SEGMENT_POINTS_INVALID', 'พิกัดปลายคานต้องเป็นตัวเลขครบสองจุด', 'P1', 'คานซอย'],
  ['SECONDARY_EXACT_DIAGONAL_UNSUPPORTED', 'รุ่นนี้ยังคำนวณคานซอยแนวทแยงไม่ได้', 'P1', 'คานซอย'],
  ['SECONDARY_LEVEL_REFERENCE_INVALID', 'ชั้นที่คานซอยอ้างอิงไม่มีอยู่ในแปลนปัจจุบัน', 'P1', 'คานซอย'],
  ['SECONDARY_EXACT_SEGMENT_CONTRACT_INVALID SECONDARY_DRAWING_AUTHORITY_INVALID', 'ข้อมูลคานซอยที่บันทึกไม่ตรงรูปแบบแปลน ต้องบันทึกคานซอยใหม่', 'P1', 'คานซอย'],
  ['SECONDARY_RECEIVER_PROJECTION_INVALID', 'ตำแหน่งจุดรองรับทำให้แนวคานเปลี่ยน ต้องตรวจพิกัดปลายคาน', 'P1', 'คานซอย'],
  ['SECONDARY_SOURCE_OFFSET_ATOMIC_SUPPORT_UNEVALUATED', 'คานซอยแบบอ้างระยะยังไม่มีผลตรวจจุดรองรับเมื่อรับคานซอยอีกเส้น', 'P1', 'คานซอย'],
  ['SECONDARY_SOURCE_OFFSET_SEGMENT_INVALID', 'ระยะหรือช่วงคานซอยที่คัดลอกไม่ตรงกับคานต้นทางในชั้นนี้', 'P1', 'คานซอย'],
  ['SECONDARY_AREA_NOT_FOUND', 'ยังระบุพื้นที่พื้นหรือช่องเปิดที่สัมพันธ์กับคานซอยไม่ได้', 'P2', 'พื้น'],
  ['SECONDARY_AREA_AMBIGUOUS', 'คานซอยสัมพันธ์กับพื้นที่พื้นมากกว่าหนึ่งช่อง ต้องตรวจขอบเขตพื้น', 'P2', 'พื้น'],
  ['SECONDARY_BASELINE_PHYSICAL_SOURCE_ROWS_MISSING', 'ยังไม่มีน้ำหนักพื้นจากพื้นที่ที่คานซอยรับ', 'P2', 'พื้น'],
  ['SECONDARY_BASELINE_SOURCE_REGISTRY_HOLD', 'ทะเบียนน้ำหนักพื้นหรือผนังยังมีรายการไม่ครบ ต้องตรวจรายการโหลด', 'P2', 'พื้น / P2 ผนัง'],
  ['SECONDARY_LOAD_PROVENANCE_MISSING EXACT_SECONDARY_SOURCE_EVIDENCE_UNAVAILABLE', 'ยังไม่มีแหล่งน้ำหนักพื้นหรือผนังที่ผูกกับคานซอย', 'P2', 'พื้น / P2 ผนัง'],
  ['EXACT_SECONDARY_LOAD_PROVENANCE_CONFLICT_HOLD', 'แหล่งน้ำหนักคานซอยซ้ำหรือขัดกัน ต้องเลือกแหล่งน้ำหนักให้ตรงกัน', 'P2', 'พื้น / P2 ผนัง'],
  ['EXACT_SECONDARY_SOURCE_CONSERVATION_REQUIRED EXACT_SECONDARY_SOURCE_RECONCILIATION_HOLD', 'น้ำหนักที่ถ่ายเข้าคานซอยไม่สมดุลกับแหล่งน้ำหนักพื้นหรือผนัง', 'P2', 'พื้น / P2 ผนัง'],
  ['EXACT_SECONDARY_SIMPLE_TWO_END_REQUIRED EXACT_SECONDARY_SIMPLE_TWO_END_EVIDENCE_MISMATCH', 'รูปแบบจุดรองรับยังไม่ใช่คานที่มีจุดรองรับสองปลายตามข้อมูลปัจจุบัน', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_DYNAMIC_JOINT_COLLISION_REJECTED', 'จุดต่อคานซอยซ้ำกับจุดต่ออื่นจนแยกทางถ่ายแรงไม่ได้', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_DYNAMIC_JOINT_COORDINATE_INVALID', 'พิกัดจุดต่อคานซอยไม่ถูกต้อง', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_DYNAMIC_JOINT_PREFLIGHT_UNAVAILABLE', 'ยังตรวจจุดต่อคานซอยกับแบบจำลองปัจจุบันไม่ได้ ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_SUPPORT_PROPOSAL_INVALID SECONDARY_SUPPORT_PROPOSAL_EXACT_GEOMETRY_INVALID SECONDARY_SUPPORT_PROPOSAL_RECEIVERS_INVALID', 'ข้อมูลตำแหน่งคานหรือจุดรองรับที่บันทึกไม่ครบ ต้องบันทึกคานซอยใหม่', 'P1', 'คานซอย'],
  ['SECONDARY_SUPPORT_PROPOSAL_FINGERPRINT_MISMATCH SECONDARY_SUPPORT_REVIEW_FINGERPRINT_MISMATCH SECONDARY_SUPPORT_PROPOSAL_STALE EXACT_SECONDARY_SUPPORT_NOT_CURRENT', 'จุดรองรับเปลี่ยนจากแปลนที่ใช้ตรวจ ต้องบันทึกแปลนแล้ววิเคราะห์ใหม่', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_REVIEW_P1_NOT_CURRENT EXACT_SECONDARY_DRAFT_NOT_CURRENT', 'แปลนคานซอยที่บันทึกยังไม่ตรงแบบร่างปัจจุบัน', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_REVIEW_P2_NOT_CURRENT EXACT_SECONDARY_REVIEW_LOAD_READINESS_STALE', 'น้ำหนักคานซอยที่ยืนยันยังไม่ตรงรายการปัจจุบัน', 'P2', 'พื้น / P2 ผนัง'],
  ['EXACT_SECONDARY_REVIEW_MEMBER_EMPTY', 'แปลนไม่มีคานซอยแบบระบุจุดปลายให้วิเคราะห์', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_REVIEW_MEMBER_SET_INVALID EXACT_SECONDARY_SELECTED_MEMBER_SET_INVALID', 'รหัสคานซอยว่างหรือซ้ำ ต้องตรวจรายการคานซอย', 'P1', 'คานซอย'],
  ['EXACT_SECONDARY_REVIEW_CODE_STANDARD_INVALID', 'ยังไม่ได้เลือกมาตรฐานคำนวณที่ระบบรองรับ', 'P0', 'มาตรฐานคำนวณ'],
  ['EXACT_SECONDARY_REVIEW_NO_ELIGIBLE_MEMBERS', 'คานซอยทุกเส้นยังมีข้อมูลจุดรองรับหรือแหล่งน้ำหนักไม่ครบ', 'P1', 'คานซอย / P2 พื้น / P2 ผนัง'],
  ['EXACT_SECONDARY_AREA_GROUP_SELECTION_INCOMPLETE EXACT_SECONDARY_REVIEW_AUTH_MEMBER_SET_MISMATCH EXACT_SECONDARY_LEGACY_REATTESTATION_MEMBER_SET_MISMATCH', 'ชุดคานซอยที่ใช้รับน้ำหนักพื้นที่เดียวกันไม่ครบ ต้องวิเคราะห์ชุดปัจจุบันใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_SELECTED_MEMBER_NOT_CURRENT EXACT_SECONDARY_REVIEW_PRESENTATION_NOT_CURRENT', 'รายการคานซอยเปลี่ยนจากชุดที่ใช้คำนวณ ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_EXCLUSION_NOT_EXPLICIT', 'ยังระบุไม่ครบว่าคานซอยเส้นใดรวมอยู่ในผลวิเคราะห์', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_REQUIRED EXACT_SECONDARY_REVIEW_BASELINE_NOT_RECORDED SECONDARY_DECISION_GATE_NOT_RECORDED', 'ยังไม่ได้สร้างทะเบียนจุดรองรับและน้ำหนักคานซอยจากแปลนปัจจุบัน', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_AUTH_NOT_RECORDED EXACT_SECONDARY_ANALYSIS_AUTHORIZATION_REQUIRED EXACT_SECONDARY_ANALYSIS_BOUNDARY_NOT_RECORDED EXACT_SECONDARY_MEMBER_AUTHORITY_NOT_RECORDED', 'ยังไม่ได้บันทึกชุดคานซอยที่พร้อมเข้าวิเคราะห์', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_STALE EXACT_SECONDARY_REVIEW_BASELINE_EVIDENCE_STALE EXACT_SECONDARY_REVIEW_AUTH_BASELINE_NOT_CURRENT EXACT_SECONDARY_REVIEW_AUTH_BASELINE_STALE EXACT_SECONDARY_REVIEW_AUTH_STALE EXACT_SECONDARY_ANALYSIS_BOUNDARY_AUTHORIZATION_NOT_CURRENT EXACT_SECONDARY_ANALYSIS_BOUNDARY_DECISION_NOT_CURRENT EXACT_SECONDARY_ANALYSIS_BOUNDARY_MEMBER_AUTHORITY_NOT_CURRENT EXACT_SECONDARY_MEMBER_AUTHORITY_NOT_CURRENT EXACT_SECONDARY_RECONCILIATION_BASELINE_NOT_CURRENT EXACT_SECONDARY_RECONCILIATION_DRAWING_SET_STALE EXACT_SECONDARY_RECONCILIATION_INTEGRATION_NOT_CURRENT EXACT_SECONDARY_POST_RUN_AUTHORIZATION_NOT_CURRENT EXACT_SECONDARY_POST_RUN_BASELINE_NOT_CURRENT', 'ทะเบียนคานซอยไม่ตรงแปลนหรือน้ำหนักปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_CONTRACT_MISMATCH EXACT_SECONDARY_REVIEW_BASELINE_FINGERPRINT_MISMATCH EXACT_SECONDARY_REVIEW_BASELINE_AUTHORITY_TAMPERED EXACT_SECONDARY_REVIEW_BASELINE_RECORD_INVALID EXACT_SECONDARY_REVIEW_AUTH_BASELINE_CONTRACT_MISMATCH EXACT_SECONDARY_REVIEW_AUTH_BASELINE_FINGERPRINT_MISMATCH EXACT_SECONDARY_REVIEW_AUTH_BASELINE_AUTHORITY_TAMPERED EXACT_SECONDARY_REVIEW_AUTH_CONTRACT_MISMATCH EXACT_SECONDARY_REVIEW_AUTH_FINGERPRINT_MISMATCH EXACT_SECONDARY_REVIEW_AUTH_RECORD_INVALID EXACT_SECONDARY_MEMBER_AUTHORITY_INPUT_INVALID EXACT_SECONDARY_MEMBER_AUTHORITY_JSON_INVALID EXACT_SECONDARY_MEMBER_AUTHORITY_BINDING_MISMATCH EXACT_SECONDARY_ANALYSIS_BOUNDARY_BINDING_MISMATCH EXACT_SECONDARY_ANALYSIS_BOUNDARY_MEMBER_AUTHORITY_INVALID', 'ทะเบียนคานซอยที่บันทึกไม่สอดคล้องกับข้อมูลต้นทาง ต้องเปิดโปรเจกต์แล้ววิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_STORAGE_UNAVAILABLE EXACT_SECONDARY_REVIEW_BASELINE_STORAGE_READ_FAILED EXACT_SECONDARY_REVIEW_AUTH_STORAGE_UNAVAILABLE EXACT_SECONDARY_REVIEW_AUTH_STORAGE_READ_FAILED EXACT_SECONDARY_MEMBER_AUTHORITY_STORAGE_UNAVAILABLE EXACT_SECONDARY_MEMBER_AUTHORITY_STORAGE_READ_FAILED EXACT_SECONDARY_TRANSACTION_STORAGE_UNAVAILABLE EXACT_SECONDARY_TRANSACTION_STORAGE_READ_FAILED', 'เปิดทะเบียนคานซอยที่บันทึกไว้ไม่ได้ ต้องเปิดโปรเจกต์ใหม่แล้ววิเคราะห์อีกครั้ง', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_STORAGE_WRITE_FAILED EXACT_SECONDARY_REVIEW_AUTH_STORAGE_WRITE_FAILED EXACT_SECONDARY_MEMBER_AUTHORITY_STORAGE_WRITE_FAILED EXACT_SECONDARY_MEMBER_AUTHORITY_CREATE_FAILED EXACT_SECONDARY_POST_RUN_SNAPSHOT_COMMITTER_UNAVAILABLE EXACT_SECONDARY_POST_RUN_SNAPSHOT_COMMIT_FAILED', 'บันทึกทะเบียนหรือผลวิเคราะห์คานซอยไม่สำเร็จ ต้องเปิดโปรเจกต์ใหม่แล้ววิเคราะห์อีกครั้ง', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_READBACK_MISMATCH EXACT_SECONDARY_REVIEW_AUTH_READBACK_MISMATCH EXACT_SECONDARY_MEMBER_AUTHORITY_READBACK_MISMATCH EXACT_SECONDARY_TRANSACTION_READBACK_MISMATCH EXACT_SECONDARY_TRANSACTION_ROLLBACK_FAILED', 'ตรวจข้อมูลคานซอยหลังบันทึกไม่ตรงกัน ต้องเปิดโปรเจกต์ใหม่แล้ววิเคราะห์อีกครั้ง', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_TIME_INVALID EXACT_SECONDARY_REVIEW_AUTH_TIME_INVALID EXACT_SECONDARY_DECISION_TIME_INVALID', 'เวลาบันทึกทะเบียนคานซอยไม่ถูกต้อง ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_AUTHENTICATED_OWNER_REQUIRED EXACT_SECONDARY_REVIEW_AUTHENTICATED_OWNER_REQUIRED EXACT_SECONDARY_TRUSTED_OWNER_SESSION_REQUIRED', 'ยังระบุผู้บันทึกข้อมูลคานซอยไม่ได้ ต้องเปิดโปรเจกต์แล้ววิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_ANALYSIS_BOUNDARY_CONCURRENT_CHANGE_HOLD EXACT_SECONDARY_TRANSACTION_CONCURRENT_WRITE_HOLD EXACT_SECONDARY_POST_RUN_CLOSURE_CHANGED', 'ข้อมูลคานซอยเปลี่ยนระหว่างคำนวณ ต้องวิเคราะห์ชุดปัจจุบันใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_ANALYSIS_BOUNDARY_RECORD_SET_INCOMPLETE EXACT_SECONDARY_RECONCILIATION_BASELINE_ROW_MISSING EXACT_SECONDARY_ORPHAN_AUTHORIZATION_HOLD EXACT_SECONDARY_ORPHAN_MEMBER_AUTHORITY_HOLD', 'ทะเบียนวิเคราะห์คานซอยมีรายการขาดหรือเกินจากแปลน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_INTEGRATION_RECONCILIATION_HOLD EXACT_SECONDARY_INTEGRATION_ROW_MISMATCH EXACT_SECONDARY_RECONCILIATION_HOLD EXACT_SECONDARY_POST_RUN_CLOSURE_MISMATCH EXACT_SECONDARY_POST_RUN_RESULT_AUTHORITY_HOLD', 'ผลวิเคราะห์คานซอยไม่ตรงทะเบียนจุดรองรับและน้ำหนัก ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_RESULT_AUTHORITY_STALE EXACT_SECONDARY_RESULT_RERUN_REQUIRED EXACT_SECONDARY_INTEGRATION_HOLD', 'ผลคานซอยยังไม่ตรงแบบจำลองปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_BEAM_MATERIAL_FC_INVALID', 'กำลังอัดคอนกรีตของคานซอยต้องเป็นตัวเลขมากกว่าศูนย์', 'P0', 'วัสดุ'],
  ['SECONDARY_BEAM_MATERIAL_FY_MAIN_INVALID', 'กำลังครากเหล็กหลักของคานซอยต้องเป็นตัวเลขมากกว่าศูนย์', 'P0', 'วัสดุ'],
  ['SECONDARY_BEAM_MATERIAL_FY_STIRRUP_INVALID', 'กำลังครากเหล็กปลอกของคานซอยต้องเป็นตัวเลขมากกว่าศูนย์', 'P0', 'วัสดุ'],
  ['SECONDARY_BEAM_MATERIAL_COVER_INVALID', 'ระยะหุ้มเหล็กคานซอยต้องเป็นตัวเลขมากกว่าศูนย์', 'P0', 'วัสดุ'],
  ['SECONDARY_WALL_ASSIGNMENT_ID_AMBIGUOUS SECONDARY_WALL_ASSIGNMENT_ID_STALE', 'ผนังอ้างคานซอยที่ซ้ำหรือไม่มีอยู่ในแปลนปัจจุบัน ต้องเลือกคานรับผนังใหม่', 'P2', 'ผนัง'],
  ['SECONDARY_WALL_SOURCE_DUPLICATE', 'น้ำหนักผนังเดียวกันถูกกำหนดให้คานซอยซ้ำ ต้องแก้รายการซ้ำ', 'P2', 'ผนัง'],
  ['SECONDARY_WALL_INPUT_INVALID', 'น้ำหนักผนังคานซอยต้องเป็นตัวเลขไม่ติดลบ', 'P2', 'ผนัง'],
  ['SECONDARY_AREA_GROUP_AXIS_AMBIGUOUS', 'คานซอยในพื้นที่พื้นเดียวกันมีหลายแนวที่ยังจัดทางถ่ายแรงไม่ได้', 'P2', 'พื้น'],
  ['SECONDARY_ONE_WAY_SPAN_DIRECTION_UNSUPPORTED', 'ทิศทางพาดพื้นทางเดียวไม่ตรงแนวที่คานซอยรับได้ในรุ่นนี้', 'P2', 'พื้น'],
  ['SECONDARY_AREA_GROUP_MEMBER_OVERLAP', 'คานซอยในพื้นที่พื้นเดียวกันวางซ้อนแนวกัน ต้องแก้เส้นซ้ำ', 'P1', 'คานซอย'],
  ['SECONDARY_AREA_GROUP_PARTITION_INVALID SECONDARY_PROFILE_INVALID SECONDARY_PROFILE_MAPPING_FAILED', 'ยังแบ่งน้ำหนักพื้นที่พื้นเข้าคานซอยตามขอบเขตจริงไม่ได้', 'P2', 'พื้น'],
  ['SECONDARY_SLAB_BOUNDARY_RECEIVER_UNRESOLVED SECONDARY_SLAB_BOUNDARY_MAPPING_FAILED', 'ขอบพื้นยังไม่มีคานรับที่ระบุได้ครบ ต้องตรวจขอบพื้นและคานรอบพื้น', 'P2', 'พื้น'],
  ['SECONDARY_AREA_GROUP_MEMBER_TRIBUTARY_EMPTY', 'คานซอยไม่มีพื้นที่รับน้ำหนักในกลุ่มพื้นซึ่งกำหนดไว้', 'P2', 'พื้น'],
  ['SECONDARY_SLAB_FIRST_MOMENT_MAPPING_FAILED SECONDARY_SLAB_FORCE_NOT_CONSERVED SECONDARY_SLAB_FIRST_MOMENT_NOT_CONSERVED SECONDARY_SLAB_PHYSICAL_AUDIT_INVALID', 'แรงหรือโมเมนต์จากน้ำหนักพื้นยังถ่ายเข้าคานซอยไม่สมดุล', 'P2', 'พื้น'],
  ['SECONDARY_AREA_LOAD_MISSING', 'พื้นที่พื้นซึ่งคานซอยรับยังไม่มีน้ำหนักบรรทุก', 'P2', 'พื้น'],
  ['SECONDARY_PARENT_OUTSIDE_AREA_GROUP', 'คานซอยลูกและคานรับอยู่คนละกลุ่มพื้นจนยังถ่ายแรงต่อกันไม่ได้', 'P2', 'พื้น'],
  ['SECONDARY_HIERARCHY_MEMBER_HOLD SECONDARY_PARENT_NOT_INTEGRATED', 'คานซอยที่รับต่อกันมีเส้นหนึ่งคำนวณไม่ได้ ต้องแก้เหตุของคานในชุดเดียวกัน', 'P1', 'คานซอย / P2 พื้น'],
  ['SECONDARY_AREA_GROUP_MEMBER_HOLD SECONDARY_AREA_GROUP_AUTHORIZATION_INCOMPLETE', 'คานซอยในกลุ่มพื้นเดียวกันยังคำนวณได้ไม่ครบ ต้องแก้เหตุของคานในกลุ่ม', 'P2', 'พื้น'],
  ['SECONDARY_AREA_GROUP_SOURCE_SET_MISMATCH SECONDARY_AREA_GROUP_AUTHORITY_STALE SECONDARY_ANALYSIS_AUTH_SOURCE_SET_STALE', 'กลุ่มคานซอยอ้างน้ำหนักพื้นคนละชุดกับข้อมูลปัจจุบัน ต้องยืนยันโหลดแล้ววิเคราะห์ใหม่', 'P2', 'พื้น'],
  ['SECONDARY_AREA_GROUP_SOURCE_AREA_MISSING', 'ไม่พบพื้นที่พื้นซึ่งกลุ่มคานซอยอ้างอิงในแปลนปัจจุบัน', 'P2', 'พื้น'],
  ['SECONDARY_AREA_GROUP_AUDIT_EVIDENCE_MISSING', 'ยังตรวจสมดุลน้ำหนักพื้นของกลุ่มคานซอยไม่ได้ ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_STAIR_POINT_LOAD_INVALID', 'แรงจากบันไดที่ลงคานซอยยังไม่เป็นตัวเลขที่ถูกต้อง', 'P2', 'บันได'],
  ['SECONDARY_STAIR_POINT_LOAD_OUTSIDE_SPAN', 'ตำแหน่งแรงบันไดอยู่นอกช่วงคานซอย ต้องแก้ตำแหน่งคานรับบันได', 'P1', 'บันได / P1 คานซอย'],
  ['SECONDARY_STAIR_POINT_LOAD_REFERENCE_MISMATCH', 'ข้อมูลแรงบันไดไม่ตรงคานซอยที่ระบุเป็นจุดรองรับ', 'P2', 'บันได'],
  ['SECONDARY_SIMPLE_BEAM_MOMENT_ENVELOPE_INVALID SECONDARY_SIMPLE_BEAM_NEGATIVE_MOMENT_ANOMALY', 'ผลโมเมนต์คานซอยไม่สอดคล้องกับรูปแบบจุดรองรับและแรง ต้องตรวจทางถ่ายแรง', 'P1', 'คานซอย / P2 พื้น / P2 ผนัง'],
  ['SECONDARY_SECTION_STRENGTH_OR_FIT_HOLD SECONDARY_SECTION_NO_PASSING_PRESET', 'ยังไม่มีหน้าตัดคานซอยที่รับแรงและจัดเหล็กได้ตามเกณฑ์', 'P4', 'หน้าตัดคานซอย'],
  ['SECONDARY_SECTION_DEPTH_CAP_HOLD', 'ความลึกคานซอยที่ต้องใช้เกินความลึกคานรับที่กำหนด', 'P4', 'หน้าตัดคานซอยและคานรับ'],
  ['SECONDARY_SERVICEABILITY_NOT_EVALUATED', 'ยังตรวจการโก่งตัวคานซอยจากข้อมูลหน้าตัดและน้ำหนักไม่ได้', 'P4', 'หน้าตัดคานซอย'],
  ['SECONDARY_IMMEDIATE_DEFLECTION_LIMIT_HOLD', 'การโก่งตัวคานซอยเกินเกณฑ์ ต้องตรวจช่วงคาน น้ำหนัก และหน้าตัด', 'P4', 'หน้าตัดคานซอย'],
  ['SECONDARY_BEAM_REBAR_EVIDENCE_HOLD', 'ข้อมูลเหล็กคานซอยยังไม่ครบสำหรับหน้าตัดที่ใช้', 'P4', 'เหล็กคานซอย'],
  ['SECONDARY_BAR_CROSSING_NOT_EVALUATED SECONDARY_BAR_CROSSING_HOLD SECONDARY_CHILD_EQUAL_DEPTH_BAR_CROSSING_HOLD SECONDARY_CHILD_BAR_CROSSING_NOT_EVALUATED', 'ยังตรวจการวางเหล็กที่จุดคานซอยตัดคานรับไม่ครบ', 'P4', 'หน้าตัดและเหล็กคานซอย'],
  ['SECONDARY_CHILD_DEEPER_THAN_PARENT SECONDARY_DEEPER_THAN_GIRDER', 'คานซอยลึกกว่าคานรับ จึงยังวางทางถ่ายแรงและเหล็กไม่ได้', 'P4', 'หน้าตัดคานซอยและคานรับ'],
  ['SECONDARY_RECEIVER_DEPTH_MISSING', 'ยังไม่ได้ระบุความลึกคานรับคานซอย', 'P4', 'หน้าตัดคานรับ'],
  ['SECONDARY_RECEIVER_WIDTH_MISSING', 'ยังไม่ได้ระบุความกว้างคานรับคานซอย', 'P4', 'หน้าตัดคานรับ'],
  ['SECONDARY_CHILD_TOO_CLOSE_TO_PARENT_END', 'คานซอยลงใกล้ปลายคานรับเกินระยะที่จัดเหล็กได้', 'P1', 'คานซอย'],
  ['SECONDARY_SLAB_CELL_TOO_NARROW', 'ช่องพื้นระหว่างคานซอยแคบเกินเกณฑ์แบ่งน้ำหนักของรุ่นนี้', 'P2', 'พื้น'],
  ['SECONDARY_HANGER_NO_ROOM', 'จุดคานซอยลงคานรับไม่มีที่จัดเหล็กแขวนตามเกณฑ์', 'P4', 'หน้าตัดและเหล็กคานรับ'],
  ['SECONDARY_CHILD_POINT_LOAD_OUTSIDE_SPAN', 'จุดถ่ายแรงจากคานซอยลูกอยู่นอกช่วงคานรับ', 'P1', 'คานซอย'],
  ['SECONDARY_JOINT_END_UNSUPPORTED', 'จุดต่อปลายคานซอยยังไม่มีทางถ่ายแรงที่รองรับในรุ่นนี้', 'P1', 'คานซอย'],
  ['SECONDARY_SIMPLE_TWO_END_REQUIRED', 'คานซอยยังไม่มีข้อมูลรองรับแบบสองปลายครบ', 'P1', 'คานซอย'],
  ['SECONDARY_INTEGRATION_LINEAGE_MISSING SECONDARY_INTEGRATION_LINEAGE_STALE', 'แปลนหรือน้ำหนักที่ใช้รวมคานซอยยังไม่ตรงข้อมูลปัจจุบัน', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_ANALYSIS_AUTH_CONTRACT_MISMATCH SECONDARY_PRESENTATION_IDENTITY_HOLD', 'ทะเบียนคานซอยที่จะวิเคราะห์ไม่ตรงแปลนปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_ANALYSIS_AUTH_MEMBER_NOT_AUTHORIZED', 'คานซอยเส้นนี้ยังไม่อยู่ในชุดที่ข้อมูลพร้อมวิเคราะห์', 'P1', 'คานซอย / P2 พื้น'],
  ['SECONDARY_ANALYSIS_AUTH_SUPPORT_STALE', 'จุดรองรับคานซอยเปลี่ยนจากชุดที่ใช้วิเคราะห์ ต้องบันทึกแปลนแล้ววิเคราะห์ใหม่', 'P1', 'คานซอย'],
  ['SECONDARY_INTEGRATION_MEMBER_EMPTY', 'ไม่มีคานซอยในแปลนที่บันทึกสำหรับวิเคราะห์', 'P1', 'คานซอย'],
  ['SECONDARY_INTEGRATION_NO_ELIGIBLE_MEMBER', 'คานซอยทุกเส้นยังมีปัญหาจุดรองรับ น้ำหนัก หรือหน้าตัด ต้องแก้ตามรายการคาน', 'P1', 'คานซอย / P2 พื้น / P4 หน้าตัด'],
  ['SECONDARY_ANALYTICAL_MEMBER_ID_COLLISION SECONDARY_ANALYTICAL_NODE_ID_COLLISION', 'รหัสคานหรือจุดต่อซ้ำกันในแบบจำลองคานซอย ต้องตรวจรายการคาน', 'P1', 'คานซอย'],
  ['SECONDARY_ANALYTICAL_RESULT_INCOMPLETE SECONDARY_MEMBER_RESULT_PROJECTION_HOLD SECONDARY_MEMBER_RESULT_PROJECTION_FAILED', 'ผลวิเคราะห์คานซอยยังไม่ครบชุด ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SECONDARY_ANALYTICAL_EQUILIBRIUM_FAILED', 'ผลแรงคานซอยยังไม่ผ่านการตรวจสมดุล ต้องตรวจจุดรองรับและน้ำหนัก', 'P1', 'คานซอย / P2 พื้น / P2 ผนัง'],
  ['SECONDARY_DECISION_GATE_LINEAGE_HOLD EXACT_SECONDARY_REVIEW_BASELINE_LINEAGE_HOLD EXACT_SECONDARY_REVIEW_AUTHORIZATION_CHANGED', 'ทะเบียนคานซอยเปลี่ยนจากชุดที่ใช้คำนวณ ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_ANALYSIS_BOUNDARY_HOLD', 'ยังบันทึกชุดคานซอยเข้าระบบวิเคราะห์ไม่ครบ ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_REVIEW_BASELINE_COMMIT_FAILED EXACT_SECONDARY_DEMO_AUTHORITY_READBACK_HOLD', 'บันทึกทะเบียนคานซอยไม่สำเร็จ ต้องเปิดโปรเจกต์แล้ววิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['EXACT_SECONDARY_DEMO_COVERAGE_HOLD', 'คานซอยในตัวอย่างมีข้อมูลจุดรองรับหรือแหล่งน้ำหนักไม่ครบ', 'P1', 'คานซอย / P2 พื้น'],
];
export const exactSecondaryUserIssues = Object.freeze(Object.fromEntries(secondaryIssueGroups.flatMap(
  ([codes, reason, phase, field]) => codes.split(' ').map(code => [code, Object.freeze({ reason, phase, field })]),
)));
// P4 banners must describe the input that can repair the actual native issue.
// These captions do not change readiness, dimensions, steel or attestation.
const p4IssueGroups = [
  ['COLUMN_CARD_REQUIRES_SDM', 'โครงการนี้เลือกวิธีหน่วยแรงใช้งาน (WSD) แต่ ACI 318-19 ออกแบบเสาด้วยวิธีกำลัง (SDM) เท่านั้น · เปลี่ยนทั้งโครงการเป็น SDM แล้วคำนวณใหม่ทุกชิ้น · ส่วนที่ใช้ SDM เท่านั้น: เสา, ฐานรากแผ่, เหล็กกลุ่มคาน', 'P0', 'วิธีออกแบบ'],
  ['SERVICE_BASIS_UNPROVABLE', 'ผลคานยังไม่มีแรงใช้งานที่ตรวจย้อนกลับได้สำหรับ WSD ให้ตรวจวิธีออกแบบและข้อมูลโหลดก่อนคำนวณใหม่', 'P0/P2', 'วิธีออกแบบและโหลด'],
  ['AUTO_SECTION_RECEIVER_CARD_MISSING', 'ยังไม่มีผล Card คานรับที่ใช้เลือกหน้าตัดร่วมได้ ให้แก้ผลคานรับและวิธีออกแบบก่อน', 'P4/P0', 'คานรับและวิธีออกแบบ'],
  ['BEAM_FAMILY_SECTION_MISMATCH', 'คานประเภทเดียวกันยังใช้หน้าตัดต่างกัน กดออกแบบอัตโนมัติเพื่อใช้หน้าตัดเดียวทั้งกลุ่ม', 'P4', 'คาน · วิธีจัดกลุ่มและหน้าตัด'],
  ['BEAM_FAMILY_MARKS_EXCEEDED', 'ประเภทคานนี้ยังรวมเหล็กให้เหลือสามชุดไม่ได้ ให้เพิ่มหน้าตัดหรือเลือกละเอียดรายตัว', 'P4', 'คาน · วิธีจัดกลุ่มและหน้าตัด'],
  ['BEAM_FAMILY_REBAR_CARD_REJECTED', 'ชุดเหล็กของกลุ่มจัดวางหรือรับแรงไม่พอ ให้เพิ่มหน้าตัดคาน', 'P4', 'คาน · หน้าตัด'],
  ['NO_SOIL_BEARING_BASIS SOIL_BEARING_BASIS_MISSING SOIL_BEARING_BASIS_NOT_VERIFIED', 'ยังไม่ได้ยืนยันกำลังรับน้ำหนักดินสำหรับฐานรากแผ่', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_QA_REQUIRED', 'กรอกกำลังรับน้ำหนักดิน q_a หน่วยตัน/ม²', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_QA_OUT_OF_RANGE', 'q_a มากเกินหน่วยตัน/ม² ถ้าหมายถึง 10,000 กก./ม² ให้ใส่ 10', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_SOIL_DENSITY_REQUIRED', 'กรอกหน่วยน้ำหนักดิน หน่วยกก./ม³', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_FOUNDING_REQUIRED SOIL_BEARING_BASIS_FOUNDING_INVALID SOIL_BEARING_BASIS_FOUNDING_STALE', 'ยืนยันระดับหลังฐานและท้องฐานให้ตรงความหนาฐานที่ออกแบบ', 'P4', 'ฐานราก · ระดับฐาน'],
  ['SOIL_BEARING_BASIS_NODES_INVALID', 'ยังไม่ได้เลือกตำแหน่งเสาที่ใช้ฐานรากแผ่', 'P4', 'ฐานราก · ตำแหน่งฐานรากแผ่'],
  ['FOUNDATION_DECLARATION_INVALID', 'ชนิดฐานรากเปลี่ยนแล้ว ให้ตรวจและเลือกชนิดเป็นรายต้นก่อนยืนยันดิน', 'P4', 'ฐานราก · ชนิดฐานรากรายต้น'],
  ['FOUNDATION_INDIVIDUAL_SELECTION_REQUIRED', 'โครงการมีชนิดฐานรากต่างกัน ให้เลือกชนิดและกรอกข้อมูลเป็นรายต้น', 'P4', 'ฐานราก · ชนิดฐานรากรายต้น'],
  ['SPREAD_FOOTING_PILE_PROJECT', 'โครงการนี้ใช้เสาเข็ม ให้กรอกและยืนยันข้อมูลเสาเข็ม', 'P4', 'ฐานราก · ข้อมูลเสาเข็ม'],
  ['SPREAD_FOOTING_NODE_NOT_IN_P3', 'ยังไม่มีผลวิเคราะห์ของตำแหน่งฐานรากที่เลือก ให้วิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['SOIL_BEARING_BASIS_SOURCE_REQUIRED', 'กรอกแหล่งค่ากำลังรับน้ำหนักดิน', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_TRUSTED_OWNER_REQUIRED SOIL_BEARING_BASIS_CONFIRMATION_DATE_INVALID', 'เจ้าของโครงการต้องกดยืนยันค่าดินที่ใช้', 'P4', 'ฐานราก · ยืนยันข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_KIND_UNSUPPORTED', 'เลือกกำลังรับน้ำหนักดินแบบรวม GROSS', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_PROFILE_REQUIRED SOIL_BEARING_BASIS_PROFILE_STALE SOIL_BEARING_BASIS_CONTEXT_INVALID', 'ข้อมูลดินยังไม่ตรงโปรไฟล์โครงการปัจจุบัน ให้ยืนยันใหม่', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_SCHEMA_MISMATCH SOIL_BEARING_BASIS_FINGERPRINT_MISMATCH SOIL_BEARING_BASIS_RECORD_INVALID SOIL_BEARING_BASIS_TEACHING_SCOPE_EXCEEDED', 'ข้อมูลดินที่บันทึกใช้กับชุดนี้ไม่ได้ ให้ยืนยันค่าดินใหม่', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SOIL_BEARING_BASIS_STORAGE_UNAVAILABLE SOIL_BEARING_BASIS_STORAGE_READ_FAILED SOIL_BEARING_BASIS_STORAGE_WRITE_FAILED SOIL_BEARING_BASIS_ATOMIC_ROLLBACK_FAILED', 'บันทึกข้อมูลดินไม่สำเร็จ ให้เปิดโครงการและยืนยันอีกครั้ง', 'P4', 'ฐานราก · ข้อมูลดิน'],
  ['SPREAD_FOOTING_FOUNDATION_DATUM_MISSING', 'ยังไม่มีระดับหลังฐาน FND ในแปลน', 'P1', 'ระดับฐานราก FND'],
  ['SPREAD_FOOTING_GROUND_SLAB_SURCHARGE_UNMODELLED', 'น้ำหนักพื้นบนดินหรือดินถมที่ลงฐานยังไม่ครบ', 'P2', 'พื้นบนดินและน้ำหนักดินถม'],
  ['SPREAD_FOOTING_SDM_REQUIRED', 'ฐานรากแผ่ชุดนี้ต้องใช้วิธีกำลัง SDM', 'P0', 'วิธีออกแบบ'],
  ['SPREAD_FOOTING_NO_CONFIGURATION SPREAD_FOOTING_NO_PASSING_CONFIGURATION FOOTING_NO_PASSING_CONFIGURATION', 'ยังไม่มีขนาดฐานและเหล็กในรายการที่รับแรงชุดนี้ได้', 'P4', 'ฐานราก · ขนาดและเหล็ก'],
  ['FOOTING_RESULT_MISSING', 'ยังไม่มีผลออกแบบฐานรากจากแรงที่วิเคราะห์', 'P3', 'วิเคราะห์และออกแบบ'],
  ['FOOTING_DESIGN_INPUT_REQUIRED', 'ตรวจข้อมูลดินหรือเสาเข็มและขนาดฐานรากให้ครบก่อนออกแบบ', 'P4', 'ฐานราก · ข้อมูลและขนาดฐาน'],
  ['FOOTING_PROFILE_RESULT_MATERIAL_MISMATCH FOOTING_MEMBER_CARD_IDENTITY_MISMATCH', 'ผลฐานรากไม่ตรงวัสดุหรือผลวิเคราะห์ปัจจุบัน ต้องคำนวณใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['FOOTING_RECEIVER_REDESIGN_INCOMPLETE PILE_FOOTING_MOMENT_RECEIVER_MISSING', 'คานคอดินที่รับโมเมนต์จากฐานรากยังตรวจไม่ครบ', 'P4', 'คานคอดิน · หน้าตัดและเหล็ก'],
  ['GROUND_BEAM_RESULT_MISSING', 'ยังไม่มีผลออกแบบคานคอดินที่รับแรงจากฐานราก', 'P4', 'คานคอดิน · หน้าตัดและเหล็ก'],
  ['PROFILE_INVALID', 'ยังไม่ได้บันทึกโปรไฟล์โครงการที่ใช้คำนวณ', 'P0', 'ข้อมูลโครงการ'],
  ['SNAPSHOT_CONTRACT_MISMATCH SNAPSHOT_PROJECT_MISMATCH', 'ผลวิเคราะห์ไม่ตรงโครงการหรือรูปแบบผลปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['LOAD_FACTORS_MISSING', 'ผลวิเคราะห์ยังไม่มีตัวคูณน้ำหนักคงที่และน้ำหนักจร ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['MATERIAL_MISSING', 'กรอกกำลังคอนกรีตและเหล็กที่ใช้กับฐานราก', 'P0', 'วัสดุ'],
  ['SERVICE_REACTION_MISSING', 'ผลวิเคราะห์ยังไม่มีแรงปฏิกิริยาใช้งานแยกน้ำหนักคงที่และน้ำหนักจร ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['COLUMN_SIZE_MISSING', 'ผลวิเคราะห์ยังไม่มีหน้าตัดเสาที่ลงฐานราก ให้ยืนยันหน้าตัดแล้ววิเคราะห์ใหม่', 'P4', 'เสา · หน้าตัด'],
  ['FOUNDATION_BASE_MOMENT_MISSING', 'ผลวิเคราะห์ยังไม่มีโมเมนต์ที่ฐานเสาสำหรับออกแบบฐานราก ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['COLUMN_DOWEL_BAR_MISSING', 'ยังไม่มีขนาดเหล็กยืนเสาสำหรับตรวจเหล็กเดือยฐานราก', 'P4', 'เสา · เหล็กยืน'],
  ['FACTORED_REACTION_MISSING', 'ผลวิเคราะห์ยังไม่มีแรงดิ่งประลัยสำหรับตรวจฐานราก ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['FOUNDATION_BASE_SHEAR_MISSING', 'ผลวิเคราะห์ยังไม่มีแรงเฉือนที่ฐานเสาสำหรับตรวจฐานราก ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['PILE_CAPACITY_REFERENCE_NOT_VERIFIED PILE_BASIS_MISSING NO_PILE_BASIS', 'ยังไม่ได้ยืนยันกำลังรับน้ำหนักเสาเข็ม', 'P4', 'ฐานราก · ข้อมูลเสาเข็ม'],
  ['PILE_CATALOG_MISSING PILE_SPACING_MISSING', 'เลือกชนิดเสาเข็มและระยะห่างเข็มให้ครบ', 'P4', 'ฐานราก · ข้อมูลเสาเข็ม'],
  ['STAIR_RECEIVER_MEMBER_REQUIRED STAIR_RECEIVER_AMBIGUOUS STAIR_SUPPORT_COUNT_INVALID STAIR_SUPPORT_BOUNDARY_COVERAGE_MISMATCH STAIR_SUPPORT_FRACTION_MISMATCH STAIR_RECEIVER_DUPLICATE', 'ระบุคานหรือพื้นที่รับปลายเที่ยวและชานพักบันไดให้ครบ', 'P1', 'บันได · จุดรองรับ'],
  ['STAIR_RECEIVER_SECTION_REQUIRED STAIR_SUPPORT_DIMENSIONS_REQUIRED', 'ระบุหน้าตัดคานหรือความหนาพื้นที่รับบันได', 'P4', 'คานและพื้นรับบันได'],
  ['STAIR_GEOMETRY_INPUT_REQUIRED STAIR_P1_GEOMETRY_INPUT_MISSING STAIR_FOOTPRINT_OR_LANDING_INVALID STAIR_STEP_GEOMETRY_MISMATCH STAIR_SEGMENT_PARTITION_REQUIRED STAIR_SEGMENT_PARTITION_MISMATCH STAIR_SEGMENT_WIDTH_MISMATCH STAIR_FLIGHT_GEOMETRY_MISMATCH STAIR_LANDING_GEOMETRY_MISMATCH STAIR_DRAWING_LANDING_DEPTH_MISMATCH', 'กรอกลูกตั้ง ลูกนอน จำนวนขั้น ความหนาท้องและขนาดชานพักให้ตรงแปลน', 'P1', 'บันได · รูปร่างและขั้น'],
  ['STAIR_LEVEL_LINEAGE_INVALID STAIR_UPPER_LEVEL_REQUIRED', 'ระบุระดับล่างและระดับบนของบันไดให้ครบ', 'P1', 'บันได · ระดับชั้น'],
  ['STAIR_P2_LOAD_INPUT_REQUIRED STAIR_SEGMENT_LOAD_REQUIRED STAIR_LIVE_LOAD_BASIS_REQUIRED STAIR_LIVE_LOAD_BELOW_MINIMUM STAIR_LOAD_COMBINATION_REQUIRED STAIR_LOWER_LEVEL_LOAD_NOT_CURRENT STAIR_UPPER_LEVEL_LOAD_NOT_CURRENT', 'กรอกน้ำหนักคงที่และน้ำหนักจรของเที่ยวบันไดและชานพัก', 'P2', 'บันได · น้ำหนักบรรทุก'],
  ['STAIR_MATERIAL_INPUT_REQUIRED', 'กรอกกำลังคอนกรีตและเหล็กสำหรับบันได', 'P0', 'วัสดุ'],
  ['NO_STAIR_ENGINEERING_RECORD STAIR_ENGINEERING_INPUT_INVALID STAIR_ENGINEERING_INPUT_STALE STAIR_FORMULA_REFERENCE_APPROVAL_REQUIRED STAIR_APPROVAL_IDENTITY_REQUIRED STAIR_APPROVAL_FINGERPRINT_MISMATCH', 'ข้อมูลคำนวณบันไดยังไม่ครบ ให้ตรวจขั้น จุดรองรับและน้ำหนักแล้วคำนวณใหม่', 'P4', 'บันได'],
  ['STAIR_LOAD_PATH_INCOMPLETE STAIR_RESULT_INTEGRATION_CONTRACT_MISSING STAIR_LANDING_SUPPORT_PREVIEW_HOLD', 'ทางถ่ายแรงบันไดเข้าคานหรือพื้นยังไม่ครบ', 'P1', 'บันได · จุดรองรับ'],
  ['STAIR_DRAFT_LINEAGE_HOLD STAIR_RESULT_AUTHORITY_STALE STAIR_ENGINEERING_LINEAGE_STALE STAIR_RECEIVER_NOT_CURRENT STAIR_RECEIVER_POINT_MISMATCH STAIR_SUPPORT_BOUNDARY_MISMATCH STAIR_RECEIVER_FACE_BEARING_OUTSIDE_WIDTH', 'จุดรองรับบันไดเปลี่ยนจากชุดที่คำนวณ ให้บันทึกแปลนแล้ววิเคราะห์ใหม่', 'P1', 'บันได · จุดรองรับ / P3 วิเคราะห์'],
  ['STAIR_CONTINUITY_REQUIRED STAIR_LANDING_PATH_UNSUPPORTED', 'ระบุรูปแบบต่อเนื่องของเที่ยวบันไดและชานพัก', 'P1', 'บันได · จุดรองรับ'],
  ['STAIR_FOOTPRINT_RECTANGLE_REQUIRED STAIR_UP_DIRECTION_INVALID STAIR_SEGMENT_ID_INVALID STAIR_GEOMETRY_INPUT_HOLD STAIR_LEVEL_HOLD STAIR_REVIEW_GEOMETRY_ADAPTER_HOLD STAIR_SOLID_GEOMETRY_HOLD', 'รูปร่าง ทิศขึ้นหรือระดับบันไดยังไม่ครบ ให้ตรวจบันไดในแปลน', 'P1', 'บันได · รูปร่างและระดับ'],
  ['STAIR_ENGINEERING_MODEL_UNSUPPORTED STAIR_USE_BASIS_UNSUPPORTED STAIR_USE_REQUIRED', 'เลือกรูปแบบและการใช้งานบันไดที่ระบบรองรับ', 'P1', 'บันได · รูปแบบและการใช้งาน'],
  ['STAIR_LANDING_PATH_COVERAGE_MISMATCH', 'จุดรองรับของเที่ยวบันไดและชานพักยังไม่ครบทุกรายการ', 'P1', 'บันได · จุดรองรับ'],
  ['STAIR_PROFILE_THAI_SDM_REQUIRED', 'เลือกมาตรฐานไทยและวิธีกำลัง SDM ที่บันไดชุดนี้รองรับ', 'P0', 'มาตรฐานและวิธีออกแบบ'],
  ['STAIR_CONCRETE_DENSITY_REQUIRED STAIR_MATERIAL_PROFILE_MISMATCH', 'ยืนยันหน่วยน้ำหนักคอนกรีตและวัสดุบันไดให้ตรงโครงการ', 'P0', 'วัสดุ'],
  ['STAIR_LOAD_COVERAGE_MISMATCH STAIR_P2_LOAD_LEVEL_MISMATCH STAIR_LIVE_LOAD_BASIS_PROFILE_MISMATCH STAIR_LOAD_COMBINATION_PROFILE_MISMATCH', 'น้ำหนักบันไดยังไม่ตรงรูปแบบ ระดับหรือมาตรฐานปัจจุบัน ให้บันทึกน้ำหนักใหม่', 'P2', 'บันได · น้ำหนักบรรทุก'],
  ['STAIR_SOURCE_AUTHORITY_INVALID STAIR_ENGINEERING_CONTRACT_MISMATCH STAIR_ENGINEERING_PROFILE_MISMATCH STAIR_ENGINEERING_AUTHORITY_MISMATCH STAIR_ENGINEERING_SOURCE_MISMATCH STAIR_ENGINEERING_FINGERPRINT_MISMATCH STAIR_ENGINEERING_CONTEXT_INVALID STAIR_ENGINEERING_RECORD_INVALID STAIR_ENGINEERING_RECORD_HOLD', 'ข้อมูลคำนวณบันไดที่บันทึกยังไม่ตรงแปลน วัสดุหรือน้ำหนักปัจจุบัน ให้ตรวจและคำนวณใหม่', 'P4', 'บันได'],
  ['STAIR_ENGINEERING_STORAGE_READ_FAILED STAIR_ENGINEERING_STORAGE_WRITE_FAILED STAIR_ENGINEERING_ATOMIC_ROLLBACK_FAILED', 'บันทึกข้อมูลบันไดไม่สำเร็จ ให้เปิดโครงการแล้วคำนวณบันไดอีกครั้ง', 'P4', 'บันได'],
  ['STAIR_RECEIVER_POSITION_INVALID STAIR_RECEIVER_FRACTION_INVALID STAIR_SUPPORT_MOMENT_GEOMETRY_INVALID', 'ตำแหน่งรับแรงบันไดอยู่นอกช่วงคานหรือพื้นที่รับ ให้แก้จุดรองรับ', 'P1', 'บันได · จุดรองรับ'],
  ['STAIR_SUPPORT_MOMENT_ACTION_ADAPTER_REQUIRED STAIR_SUPPORT_MOMENT_MISMATCH STAIR_TRANSFER_ACTION_SOURCE_MISMATCH STAIR_TRANSFER_ACTION_VALUE_MISMATCH STAIR_TRANSFER_ACTION_COVERAGE_MISMATCH STAIR_GRAVITY_CANDIDATE_HOLD STAIR_GRAVITY_BASIS_MISMATCH STAIR_TRANSFER_CANDIDATE_HOLD', 'แรงบันไดยังถ่ายเข้าจุดรองรับไม่ครบหรือตรงกับน้ำหนักปัจจุบัน ให้ตรวจจุดรองรับและวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['STAIR_INTEGRATION_AUTH_IDENTITY_REQUIRED STAIR_INTEGRATION_AUTH_CONTRACT_MISMATCH STAIR_INTEGRATION_AUTH_LINEAGE_STALE STAIR_INTEGRATION_AUTH_EVIDENCE_STALE STAIR_INTEGRATION_AUTHORITY_MISMATCH STAIR_INTEGRATION_AUTH_FINGERPRINT_MISMATCH STAIR_INTEGRATION_AUTH_CONTEXT_INVALID STAIR_INTEGRATION_AUTH_RECORD_INVALID STAIR_INTEGRATION_AUTH_READBACK_MISMATCH STAIR_INTEGRATION_LINEAGE_MISSING STAIR_INTEGRATION_AUTHORIZATION_SET_INVALID STAIR_INTEGRATION_SOURCE_COVERAGE_MISMATCH STAIR_INTEGRATION_AUTHORIZATION_COVERAGE_MISMATCH STAIR_INTEGRATION_EQUILIBRIUM_FAILED', 'ชุดแรงบันไดที่ใช้วิเคราะห์ยังไม่ตรงข้อมูลปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['STAIR_INTEGRATION_AUTH_STORAGE_READ_FAILED STAIR_INTEGRATION_AUTH_STORAGE_WRITE_FAILED STAIR_INTEGRATION_AUTH_ATOMIC_ROLLBACK_FAILED', 'บันทึกชุดแรงบันไดไม่สำเร็จ ให้เปิดโครงการแล้ววิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['STAIR_CARD_P3_MEMBER_INTEGRATION_STALE STAIR_CARD_FORMULA_IDENTITY_MISMATCH STAIR_RESULT_AUTHORITY_HOLD STAIR_CARD_SOURCE_SET_STALE STAIR_CARD_SNAPSHOT_IDENTITY_MISSING STAIR_CARD_RECORD_COVERAGE_MISMATCH STAIR_CARD_EVIDENCE_MISSING STAIR_CARD_EVIDENCE_CONTRACT_MISMATCH STAIR_CARD_AUTHORITY_ESCALATION_REJECTED STAIR_CARD_EVIDENCE_FINGERPRINT_MISMATCH STAIR_CARD_EVIDENCE_STALE STAIR_REBAR_ADAPTER_REQUIRED', 'ผลหน้าตัดและเหล็กบันไดยังไม่ครบหรือตรงชุดผลปัจจุบัน ให้คำนวณบันไดใหม่', 'P4', 'บันได · หน้าตัดและเหล็ก'],
  ['P4_CONTRACT_LOADING', 'กำลังโหลดระบบตรวจหน้าตัด', 'P4', 'หน้าตัดและเหล็ก'],
  ['DESIGN_SET_INVALID DESIGN_SET_INCOMPLETE DESIGN_HOLD DESIGN_GROUPING_HOLD DESIGN_GROUPS_HOLD DESIGN_PRESENTATION_IDENTITY_HOLD', 'ผลหน้าตัดและเหล็กบางสมาชิกยังไม่ครบ ให้ดูรายการปัญหาแล้วออกแบบใหม่', 'P4', 'หน้าตัดและเหล็ก'],
  ['BINDING_MISSING MEMBER_IDS_MISSING MEMBER_DEMANDS_MISSING MEMBER_DEMAND_MISMATCH ADAPTER_RESULT_BINDING_MISMATCH UPSTREAM_TRACE_HOLD', 'ยังไม่มีแรงสมาชิกที่ตรงกับชุดผลปัจจุบัน ต้องวิเคราะห์ใหม่', 'P3', 'วิเคราะห์และออกแบบ'],
  ['ADAPTER_MISSING ADAPTER_RESULT_MISSING ADAPTER_RESULT_MUTABLE ADAPTER_RESULT_CONTRACT_MISMATCH ADAPTER_GATE_MISSING GATE_MISSING EQUATION_SHEET_UNPROVEN', 'ผลตรวจสมาชิกยังไม่ครบ ต้องออกแบบหน้าตัดและเหล็กใหม่', 'P4', 'หน้าตัดและเหล็ก'],
  ['SECTION_PROPERTIES_MISSING APPROXIMATE_SECTION_PROPERTIES', 'ยืนยันขนาดหน้าตัดและคุณสมบัติวัสดุที่ใช้คำนวณ', 'P4', 'หน้าตัดและเหล็ก'],
  ['CODE_PROFILE_UNAPPROVED', 'เลือกมาตรฐานและวิธีคำนวณของโครงการให้ครบ', 'P0', 'มาตรฐานและวิธีออกแบบ'],
];
export const p4UserIssues = Object.freeze(Object.fromEntries(p4IssueGroups.flatMap(
  ([codes, reason, phase, field]) => codes.split(' ').map(code => [code, Object.freeze({ reason, phase, field })]),
)));
const terms = Object.freeze({
  ...Object.fromEntries(Object.entries(p4UserIssues).map(([code, issue]) => [code, [issue.reason, issue.phase, issue.field]])),
  ...Object.fromEntries(Object.entries(exactSecondaryUserIssues).map(([code, issue]) => [code, [issue.reason, issue.phase, issue.field]])),
  PILE_LENGTH_MISSING: ['ความยาวเสาเข็ม'],
  PILE_BASIS_MISSING: [p4UserIssues.PILE_BASIS_MISSING.reason, 'P4', 'data-p4-pile-id'],
  SOIL_BEARING_BASIS_MISSING: [p4UserIssues.SOIL_BEARING_BASIS_MISSING.reason, 'P4', 'data-p4-soil-qa'],
  P1_DRAWING_MISSING: ['แปลนและสมาชิกอาคาร', 'P1'],
  P2_LOAD_MISSING: ['น้ำหนักบรรทุก', 'P2'],
  SECTION_NOT_SELECTED: ['หน้าตัดคานและเสา', 'P4'],
  THICKNESS_NOT_SELECTED: ['ความหนาพื้น', 'P4'],
  P3_RESULT_NOT_CURRENT: [null, 'P3'],
  L_G: ['ระดับดิน'], L_GF: ['ชั้นล่าง'], L_F1: ['ชั้น 1'], L_F2: ['ชั้น 2'], L_RF: ['ชั้นหลังคา'],
});
const rawCode = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const fingerprintToken = /\b[A-Z][A-Z0-9]{1,10}-[A-F0-9]{8,64}\b/g;
function codeMeaning(code) {
  // Equation symbols are engineering notation, not workflow state codes.
  if (/^[A-Z]{1,2}_[A-Z0-9]{1,2}$/.test(code) && !/^L_/.test(code) || /^S\d+_[BC]\d+$/.test(code)
    || /^(?:B|SB|GB|CL|COL|C|S|F)_[A-Z]\d+(?:_[A-Z]\d+)*$/.test(code)) return code;
  if (p4UserIssues[code]) {
    const issue = p4UserIssues[code];
    return `${missing}: ${issue.reason} · แก้ที่ ${issue.phase} ${issue.field}`;
  }
  if (code === 'NO_STAIR_INPUT_CURRENT') return 'โครงการนี้ไม่มีบันได';
  if (terms[code]?.[0]) return `${missing}: ${terms[code][0]}`;
  if (code === 'HOLD_OWNER_PE') return engineerSignoff;
  if (code === 'NOT_EVALUATED') return outOfReport;
  if (/^(?:READ_ONLY|REVIEW_ONLY)$/.test(code)) return 'ดูอย่างเดียว';
  if (/STALE|NOT_CURRENT|CHANGED|MISMATCH/.test(code)) return stale;
  if (/UNSUPPORTED|OUT_OF_SCOPE|NOT_SUPPORTED/.test(code)) return unsupported;
  if (internal.test(code)) return '';
  if (/NOT_COMPUTED|NOT_RUN|NOT_EVALUATED|NOT_VERIFIED|ANALYSIS_MISSING|SNAPSHOT_MISSING|RESULT_MISSING/.test(code)) return calculate;
  if (/PILE.*(?:LENGTH|MISSING)/.test(code)) return `${missing}: ข้อมูลเสาเข็ม`;
  if (/SOIL.*(?:MISSING|BASIS)/.test(code)) return `${missing}: ข้อมูลดิน`;
  if (/LOAD.*(?:MISSING|INVALID|INCOMPLETE)/.test(code)) return `${missing}: น้ำหนักบรรทุก`;
  if (/SUPPORT|RECEIVER/.test(code)) return `${missing}: จุดรองรับสมาชิก`;
  if (/PRICE|COST/.test(code)) return `${missing}: ราคาและค่าแรง`;
  if (/REBAR|BAR_|LAP|DEVELOPMENT|STOCK/.test(code)) return `${missing}: รายละเอียดเหล็ก`;
  if (/DRAWING|GEOMETRY|LEVEL|GRID/.test(code)) return `${missing}: แปลนและระดับอาคาร`;
  if (/SECTION|THICKNESS/.test(code)) return `${missing}: หน้าตัดและความหนา`;
  if (/STAIR/.test(code)) return `${missing}: รายละเอียดบันได`;
  if (/ROOF/.test(code)) return `${missing}: รายละเอียดหลังคา`;
  return `${missing}: ข้อมูลสำหรับรายการนี้`;
}
/** Plain, bounded per-member notice; no eligibility or gate decisions happen here. */
export function exactSecondaryHoldNotice(value, { blocked = true } = {}) {
  const record = value?.record || value || {};
  const sourceItems = Array.isArray(record) ? record : record.items || record.holds || [];
  const items = sourceItems.map(item => ({ ...item, secondaryMemberId: item.secondaryMemberId || item.memberId }));
  const held = items.filter(item => item?.secondaryMemberId && item.ready !== true);
  if (!held.length) return '';
  const eligibleCount = Array.isArray(record.eligibleMemberIds)
    ? record.eligibleMemberIds.length : items.filter(item => item?.ready === true).length;
  const markById = new Map(items.map((item, index) => {
    const caption = userStatusText(item?.mark || item?.secondaryMemberId || '');
    return [String(item?.secondaryMemberId || ''), caption && !caption.includes(missing)
      ? caption : `คานซอยลำดับ ${index + 1}`];
  }));
  const lines = held.slice(0, 6).map((item) => {
    const codes = [...new Set([item.code, ...(item.holdCodes || [])].filter(Boolean))];
    const issues = codes.map(code => exactSecondaryUserIssues[code]).filter(Boolean);
    const proposal = item.supportProposal || {};
    const parentIssue = exactSecondaryUserIssues[proposal.parentCode];
    const parentMark = markById.get(String(proposal.parentMemberId || ''));
    const intermediateSupports = item.intermediateSupports || proposal.intermediateSupports || [];
    const supportMarks = [...new Set(intermediateSupports.flatMap(row => [
      ...(row.columnMarks || []), ...(row.receiverMarks || []),
    ]).map(mark => userStatusText(mark)).filter(Boolean))];
    const reason = item.code === 'SECONDARY_INTERIOR_SUPPORT_UNMODELED' && supportMarks.length
      ? `คานผ่านจุดรองรับกลางช่วง (${supportMarks.join(', ')}) ต้องแบ่งช่วงคานที่จุดรองรับ`
      : parentIssue && parentMark
      ? `คานรับ ${parentMark}: ${parentIssue.reason}`
      : issues.map(issue => issue.reason).join(' / ')
        || 'ข้อมูลตำแหน่ง จุดรองรับ หรือแหล่งน้ำหนักคานซอยไม่ครบ';
    const actions = [...new Set(issues.map(issue => `${issue.phase} ${issue.field}`))];
    return `${markById.get(String(item.secondaryMemberId))}: ${reason} · แก้ที่ ${actions.join(' / ') || 'P1 คานซอย / P2 พื้น / P2 ผนัง'}`;
  });
  if (held.length > 6) lines.push(`และอีก ${held.length - 6} รายการ`);
  const inclusion = eligibleCount > 0
    ? `คานซอยที่ข้อมูลครบ ${eligibleCount} เส้นและสมาชิกส่วนอื่นวิเคราะห์ต่อได้ตามเกณฑ์เดิม · ${held.length} เส้นต่อไปนี้ยังไม่รวมในผล`
    : `คานซอย ${held.length} เส้นยังคำนวณไม่ได้`;
  return `${blocked ? 'ยังไป P4 ไม่ได้ · ' : ''}${inclusion}\n${lines.join('\n')}`;
}
export function userStatus(value, options = {}) {
  const source = String(value ?? '');
  const code = options.code || source.trim();
  const known = terms[code];
  let text = userStatusText(source, options);
  if (options.kind === 'missing' && options.missing) text = `${missing}: ${userStatusText(options.missing)}`;
  if (options.kind === 'stale') text = stale;
  if (options.kind === 'uncomputed') text = calculate;
  if (options.kind === 'unsupported') text = unsupported;
  if (options.kind === 'view-only') text = 'ดูอย่างเดียว';
  if (options.kind === 'internal') text = '';
  return { text, tone: /ไม่ผ่าน|FAIL/i.test(text) ? 'fail' : /ผ่าน|PASS/.test(text) && !/ยัง|ต้องการ/.test(text) ? 'pass' : 'neutral',
    phase: options.phase || known?.[1] || (/คำนวณใหม่|ยังไม่ได้คำนวณ/.test(text) ? 'P3' : null),
    field: options.field || known?.[2] || null };
}
export function userStatusInputAction(value, options = {}) {
  const status = userStatus(value, options);
  return status.phase ? { label: 'ไปกรอก', phase: status.phase, field: status.field } : null;
}
export function userStatusText(value, options = {}) {
  if (value == null) return '';
  let text = String(value);
  const original = text;
  // Explicit context supplies actionable wording for generic incomplete states.
  if (options.kind) return ({ stale, uncomputed: calculate, unsupported, 'view-only': 'ดูอย่างเดียว', internal: '',
    missing: `${missing}: ${options.missing ? userStatusText(options.missing) : 'ข้อมูลสำหรับรายการนี้'}` }[options.kind] ?? userStatusText(value));
  // These exact presentation captions contain internal provenance, not saved input data.
  if (/^\s*DRAWING SAVED(?:\s*·\s*(?:CURRENT|[A-Z0-9]{8}))?\s*$/i.test(text)) return 'บันทึกแปลนแล้ว';
  if (/^\s*P1\/P2 CURRENT\s*·\s*ENGINE RESULT CURRENT\s*·\s*EQUILIBRIUM CURRENT\s*→\s*P4\s*$/i.test(text)) return '';
  if (!/\b(?:HOLD|REVIEW|PENDING|STALE|PARTIAL|REFERENCE\s+ONLY|READ[ -]+ONLY|NOT[ -]+(?:VERIFIED|EVALUATED|DESIGNED|FOR\s+CONSTRUCTION)|ENGINE\s*0)\b|ยังไม่ประเมิน|รอ\s*Review|รอรีวิว|รอตรวจ|รอยืนยัน|ตรวจทานโดยวิศวกร|รอวิศวกรตรวจ|\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b|\b[A-Z][A-Z0-9]{1,10}-[A-F0-9]{8,64}\b/i.test(text)) return text;
  text = text.replace(/\bPARTIAL\b/g, 'เฉพาะรายการที่แสดง')
    .replace(/\bREFERENCE\s+ONLY\b/gi, 'ใช้อ้างอิง')
    .replace(/รอยืนยัน/g, missing)
    .replace(/\bSTALE\s*·\s*HOLD\b/gi, stale)
    .replace(/\b(?:ENGINEERING|ENGINE)\s+REVIEW\s+REQUIRED\b/gi, engineerSignoff)
    .replace(/\b(?:REPORT\s+)?ENGINEERING\s+REVIEW\b/gi, 'ขอบเขตผลคำนวณ')
    .replace(/\bENGINE\s+REVIEW\b/gi, engineerSignoff)
    .replace(/\bPENDING\s+PE\s+(?:CLAUSE\s+)?VERIFICATION\b/gi, 'ต้องยืนยันเกณฑ์กับวิศวกรผู้รับผิดชอบ')
    .replace(/\bREVIEW\s+REQUIRED\b/gi, engineerSignoff)
    .replace(/\b(?:NOT[ -]+EVALUATED)\b|ยังไม่ประเมิน/gi, outOfReport)
    .replace(/รอวิศวกรตรวจรับและลงนาม/gi, engineerSignoff);
  text = text.replace(/\bFull\s+Review\s+ZIP\b/gi, 'ไฟล์โมเดล ZIP')
    .replace(/\b(?:Full\s+)?Review\s+Package\b/gi, 'ชุดไฟล์โมเดล')
    .replace(/\bStair\s+Equation\s+Review\b/gi, 'ผลคำนวณบันได')
    .replace(/\bSECTION\s+HOLD\b/gi, `${missing}: หน้าตัด`)
    .replace(/\bROOF\s+TOPOLOGY\s+REVIEW\b/gi, 'ข้อมูลโครงหลังคา')
    .replace(/\bROOF\s+(?:REVIEW|HOLD)\b/gi, `${missing}: รายละเอียดหลังคา`)
    .replace(/\bSTAIR\s+(?:REVIEW|HOLD)\b/gi, `${missing}: รายละเอียดบันได`)
    .replace(/\bSUPPORT\s+(?:REVIEW|HOLD)\b/gi, 'จุดรองรับยังไม่ครบ · แก้ที่ P1 จุดรองรับ / P4 หน้าตัดสมาชิกที่รับแรง')
    .replace(/\bDESIGN\s+HOLD\b/gi, 'ผลออกแบบยังไม่ครบ · แก้ที่ P4 หน้าตัดและเหล็กตามรายการปัญหา')
    .replace(/โมดูลที่ยังไม่รองรับจะคืนผล\s*HOLD/gi, 'โมดูลนี้ยังไม่รองรับในรุ่นนี้');
  text = text.replace(fingerprintToken, '').replace(rawCode, code => terms[code]?.[0] && /^L_/.test(code) ? terms[code][0] : codeMeaning(code));
  text = text.replace(/\bFULL\s+SYSTEM\s+HOLD\b/gi, '').replace(/\b(?:ENGINE\s*0|(?:DESIGN\s*\/\s*)?CONSTRUCTION\s+(?:HOLD|LOCKED)|AUTHORITY\s+HOLD)\b/gi, '')
    .replace(/\bREVIEW\s+ONLY\b/gi, 'ดูอย่างเดียว')
    .replace(/\bNOT\s+FOR\s+CONSTRUCTION\b/gi, 'ไม่ใช่แบบก่อสร้าง')
    .replace(/\bREAD[ -]+ONLY\b|อ่านอย่างเดียว/gi, 'ดูอย่างเดียว')
    .replace(/\b(?:NOT\s+VERIFIED|NOT\s+EVALUATED|NOT\s+DESIGNED)\b/gi, calculate)
    .replace(/\bENGINE\s*0\b/gi, '')
    .replace(/\b(?:REVIEW\s+ONLY|REVIEW\s+REQUIRED|REVIEW|HOLD|PENDING)\b/gi, `${missing}: ข้อมูลสำหรับรายการนี้`)
    .replace(/รอ\s*Review|รอรีวิว|รอตรวจ(?:ทาน)?|ตรวจทานโดยวิศวกร|รอวิศวกรตรวจ/gi, `${missing}: ข้อมูลสำหรับรายการนี้`);
  if (text === original) return original;
  text = text.replace(/(?:ต้องการข้อมูลเพิ่ม: ข้อมูลสำหรับรายการนี้\s*[·/:—-]\s*)+(?=ต้องการข้อมูลเพิ่ม:)/g, '')
    .replace(/วิศวกรผู้รับผิดชอบต้องตรวจและลงนาม\s*·\s*วิศวกรผู้รับผิดชอบต้องตรวจและลงนาม/g, engineerSignoff)
    .replace(/ไม่ใช่แบบก่อสร้าง\s*[·/|—-]\s*ไม่ใช่แบบก่อสร้าง/g, 'ไม่ใช่แบบก่อสร้าง')
    .replace(/(^|\s)[·|]\s*(?=[·|]|$)/g, '$1').replace(/^[\s·|/]+|[\s·|/]+$/g, '');
  return text;
}
export const sanitizeUserText = userStatusText;
/** JSX boundary: preserve React nodes, numbers, booleans and evidence objects. */
export function userVisibleText(value) {
  return typeof value === 'string' ? userStatusText(value) : Array.isArray(value) ? value.map(userVisibleText) : value;
}
/** Translate only exact visible attributes; consume every other value atomically. */
function publicHtmlAttributes(tag) {
  const head = tag.match(/^<[A-Za-z][\w:-]*/);
  if (!head) return tag;
  const edits = [];
  let index = head[0].length;
  while (index < tag.length) {
    while (/\s/.test(tag[index] || '') && index < tag.length) index += 1;
    if (!tag[index] || tag[index] === '>') break;
    if (tag[index] === '/') { index += 1; continue; }
    const nameStart = index;
    while (index < tag.length && !/[\s=/>]/.test(tag[index])) index += 1;
    if (index === nameStart) { index += 1; continue; }
    const name = tag.slice(nameStart, index).toLowerCase();
    while (/\s/.test(tag[index] || '') && index < tag.length) index += 1;
    if (tag[index] !== '=') continue;
    index += 1;
    while (/\s/.test(tag[index] || '') && index < tag.length) index += 1;
    const valueStart = index;
    const quote = tag[index] === '"' || tag[index] === "'" ? tag[index++] : '';
    const contentStart = index;
    if (quote) while (index < tag.length && tag[index] !== quote) index += 1;
    else while (index < tag.length && !/[\s>]/.test(tag[index])) index += 1;
    const value = tag.slice(contentStart, index);
    if (quote && tag[index] === quote) index += 1;
    if (!['title', 'aria-label', 'placeholder', 'alt'].includes(name)) continue;
    const translated = userStatusText(value);
    if (translated === value) continue;
    const delimiter = quote || (!translated || /[\s"'`=<>]/.test(translated) ? '"' : '');
    const safe = delimiter ? translated.replace(delimiter === '"' ? /"/g : /'/g, delimiter === '"' ? '&quot;' : '&#39;') : translated;
    edits.push({ start: valueStart, end: index, text: `${delimiter}${safe}${delimiter}` });
  }
  for (const edit of edits.reverse()) tag = tag.slice(0, edit.start) + edit.text + tag.slice(edit.end);
  return tag;
}

function publicHtmlTagEnd(html, start) {
  let quote = '';
  for (let index = start + 1; index < html.length; index += 1) {
    const character = html[index];
    if (quote) { if (character === quote) quote = ''; }
    else if (character === '"' || character === "'") quote = character;
    else if (character === '>') return index + 1;
  }
  return -1;
}

/** Visible template text only. Attributes and raw input/script/style bodies retain their bytes. */
export function userVisibleHtml(value) {
  const html = String(value ?? '');
  const output = [];
  let index = 0;
  while (index < html.length) {
    const start = html.indexOf('<', index);
    if (start < 0) { output.push(userStatusText(html.slice(index))); break; }
    if (start > index) output.push(userStatusText(html.slice(index, start)));
    if (html.startsWith('<!--', start)) {
      const closing = html.indexOf('-->', start + 4);
      const end = closing < 0 ? html.length : closing + 3;
      output.push(html.slice(start, end)); index = end; continue;
    }
    if (!/^<(?:\/?[A-Za-z][\w:-]*|!|\?)/.test(html.slice(start))) {
      output.push('<'); index = start + 1; continue;
    }
    const end = publicHtmlTagEnd(html, start);
    if (end < 0) { output.push(html.slice(start)); break; }
    const tag = html.slice(start, end);
    const name = tag.match(/^<([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase();
    output.push(publicHtmlAttributes(tag)); index = end;
    if (['script', 'style', 'textarea'].includes(name) && !/\/\s*>$/.test(tag)) {
      const closing = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'ig');
      closing.lastIndex = index;
      const match = closing.exec(html);
      const rawEnd = match ? match.index : html.length;
      output.push(html.slice(index, rawEnd)); index = rawEnd;
    }
  }
  return output.join('');
}
export function translateUserTextNodes(root) {
  if (!root || typeof document === 'undefined') return;
  const walk = document.createTreeWalker(root, 4);
  let node;
  while ((node = walk.nextNode())) {
    if (node.parentElement?.closest('script,style,textarea,[data-nbv2-technical]')) continue;
    node.textContent = userStatusText(node.textContent);
  }
  const elements = [...(root.querySelectorAll?.('[title],[aria-label],[placeholder],[alt]') || [])];
  if (root.nodeType === 1) elements.push(root);
  for (const element of elements) for (const name of ['title', 'aria-label', 'placeholder', 'alt']) {
    if (element.hasAttribute(name) && !element.closest('[data-nbv2-technical]')) element.setAttribute(name, userStatusText(element.getAttribute(name)));
  }
}
