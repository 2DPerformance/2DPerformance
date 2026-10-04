(function (root) {
  'use strict';
  const slots = Object.freeze(['member', 'trussWeb', 'purlin', 'plate', 'anchor', 'ceiling']);
  const labels = Object.freeze({ member: 'เหล็กคานยื่น', trussWeb: 'เหล็กเอวตั้ง / ทแยง Truss', purlin: 'แปเหล็กกล่อง (H แนวดิ่ง)', plate: 'เพลท', anchor: 'พุก / สตัด / น้ำยา', ceiling: 'ฝ้า' });
  const isTruss = s => s.v61?.systemType === 'truss';
  const catalogSlot = slot => slot === 'trussWeb' ? 'member' : slot;
  const labelFor = (slot,s) => isTruss(s) ? ({member:'คอร์ดบน–ล่าง Truss (ใช้หน้าตัดเดียวกัน)',plate:'เพลทรากบน–ล่าง Truss',anchor:'พุกเพลทรากบน–ล่าง'}[slot] || labels[slot]) : labels[slot];
  const clone = value => JSON.parse(JSON.stringify(value));
  const stable = value => Array.isArray(value) ? '[' + value.map(stable).join(',') + ']'
    : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}' : JSON.stringify(value);
  const records = root.NCYSC01RetailMaterials?.records || [];
  const productShape = root.NCYV5?.defaultState?.().product || {};
  const byId = new Map(records.map(row => [row.id, row]));
  if (byId.size !== records.length) throw Error('รหัสวัสดุซ้ำ');
  const key = (slot, suffix) => 'retail' + slot[0].toUpperCase() + slot.slice(1) + suffix;
  const metadataKeys = Object.freeze(slots.flatMap(slot => [key(slot, 'Id'), key(slot, 'Binding')]));
  const has = (value, name) => Object.prototype.hasOwnProperty.call(value || {}, name);
  const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
  function signature(slot, s) {
    if (slot === 'member') return stable([s.member.H, s.member.B, s.member.tNom, s.member.Fy, s.member.Fu, s.member.designThicknessFactor]);
    if (slot === 'trussWeb') return stable([s.brace.H,s.brace.B,s.brace.tNom,s.member.Fy,s.member.Fu,s.member.designThicknessFactor]);
    if (slot === 'purlin') return stable([s.takeoff.purlinH,s.takeoff.purlinB,s.takeoff.purlinT,s.member.Fy,s.member.Fu,s.member.designThicknessFactor]);
    if (slot === 'plate') return stable([s.plate.width, s.plate.height, s.plate.thickness, s.plate.holeDiameterMM, s.plate.Fy, s.plate.Fu,...(isTruss(s)?['truss-root',s.v62.rootPlateWidthMM,s.v62.rootPlateHeightMM]:[])]);
    if (slot === 'anchor') return stable([s.anchors.type, s.anchors.diameter, s.anchors.Ase, s.anchors.futa, s.product]);
    return stable([s.quick.roofType, s.quick.hasCeiling, s.quick.hasGutter, s.quick.hasSolar, s.loads.deadKPa]);
  }
  function selected(s, slot) {
    if (!slots.includes(slot)) return null;
    const row = byId.get(s.v6?.[key(slot, 'Id')]);
    if (row?.slot !== catalogSlot(slot)) return null;
    if (slot === 'purlin' && (s.takeoff.purlinH !== row.specs.depthMm || s.takeoff.purlinB !== row.specs.widthMm || s.takeoff.purlinT !== row.specs.thicknessMm)) return null;
    if (slot === 'member' && (s.member.H !== row.specs.depthMm || s.member.B !== row.specs.widthMm || s.member.tNom !== row.specs.thicknessMm)) return null;
    if (slot === 'trussWeb' && (s.brace.H !== row.specs.depthMm || s.brace.B !== row.specs.widthMm || s.brace.tNom !== row.specs.thicknessMm)) return null;
    if (slot === 'plate' && (s.plate.width !== row.specs.widthMm || s.plate.height !== row.specs.heightMm || s.plate.thickness !== row.specs.thicknessMm || s.plate.holeDiameterMM !== row.specs.holeDiameterMm)) return null;
    if (slot === 'plate' && isTruss(s) && (s.v62.rootPlateWidthMM !== row.specs.widthMm || s.v62.rootPlateHeightMM !== row.specs.heightMm)) return null;
    if (slot === 'anchor' && row.specs.metricSize && s.anchors.diameter !== row.specs.metricSize) return null;
    return row.mode !== 'unavailable'
      && s.v6?.[key(slot, 'Binding')] === signature(slot, s) ? row : null;
  }
  function cleanMetadata(value) {
    const s = clone(value);
    for (const slot of slots) if (!selected(s, slot) && s.v6) {
      delete s.v6[key(slot, 'Id')]; delete s.v6[key(slot, 'Binding')];
    }
    return s;
  }
  function validMetadata(s) {
    try {
      for (const slot of slots) {
        const id = key(slot, 'Id'), binding = key(slot, 'Binding');
        if (!has(s.v6, id) && !has(s.v6, binding)) continue;
        if (typeof s.v6[id] !== 'string' || s.v6[id].length > 100
          || typeof s.v6[binding] !== 'string' || s.v6[binding].length > 20000 || !(selected(s, slot) || legacyTrussPlate(s,slot))) return false;
      }
      return true;
    } catch (_) { return false; }
  }
  function legacyTrussPlate(s,slot) {
    // R19-R28 stored ordinary plate identity even in Truss. Accept that exact
    // old input-only record, then cleanMetadata drops the misleading name.
    if(slot !== 'plate' || !isTruss(s))return false;
    const plain=clone(s);plain.v61.systemType='member';
    return !!selected(plain,'plate');
  }
  const forceName = row => row.name + ' (คำนวณแรงเท่านั้น)';
  function forceOnlyAnchor(s, engine = root.NCYEngine) {
    const row = selected(s, 'anchor');
    if (row?.mode !== 'anchor_demand_only' || s.anchors.type !== 'adhesive'
      || s.product?.name !== forceName(row) || s.anchors.futa !== 0
      || s.product.report || s.product.revision || s.product.reportDate || s.product.qualification
      || !positive(engine?.ANCHOR_THREAD_AREAS?.[s.anchors.diameter])
      || s.anchors.Ase !== engine.ANCHOR_THREAD_AREAS[s.anchors.diameter]
      || row.specs.metricSize && s.anchors.diameter !== row.specs.metricSize) return false;
    // A known name never imports the previous manufacturer's strength or approval.
    for (const [name, template] of Object.entries(productShape)) {
      const value = s.product[name];
      if (typeof value !== typeof template) return false;
      if (typeof template === 'number' && value !== 0) return false;
      if (typeof template === 'boolean' && value !== false) return false;
      if (typeof template === 'string' && name !== 'name' && value !== '') return false;
    }
    if (Object.keys(s.product).some(name => !has(productShape, name))) return false;
    return true;
  }
  function dimensionalErrors(s) {
    const errors = [], row = selected(s, 'anchor');
    if(isTruss(s)&&(![s.brace?.H,s.brace?.B,s.brace?.tNom].every(positive)||2*s.brace.tNom>=Math.min(s.brace.H,s.brace.B)))
      errors.push('หน้าตัดเหล็กเอว Truss ต้องมี H/B/t มากกว่า 0 และ 2t น้อยกว่าด้านที่เล็กที่สุด');
    const rootPlate = selected(s,'plate');
    if(isTruss(s) && rootPlate && root.NCYV62?.rootGeometry) {
      const g=root.NCYV62.rootGeometry(clone(s));
      if(Math.abs(g.plateW-rootPlate.specs.widthMm)>1e-7 || Math.abs(g.plateH-rootPlate.specs.heightMm)>1e-7)
        errors.push('เพลทรากที่เลือก '+rootPlate.specs.widthMm+'×'+rootPlate.specs.heightMm+' มม. ไม่พอดีกับคอร์ดและคอนกรีตที่กรอก เลือกเพลทที่พอดีหรือแก้ขนาดรองรับ ระบบไม่เปลี่ยนขนาดสินค้าให้เอง');
    }
    if (row?.mode === 'anchor_demand_only') {
      const length = row.specs.rodOverallLengthMm;
      const occupied = s.anchors.hef + s.plate.thickness + (s.plate.standOffMM || 0);
      if (length && occupied >= length) errors.push('สตัดยาว ' + length + ' มม. ไม่เหลือปลายยึด: ระยะฝัง + เพลท + ระยะห่างรวม ' + occupied + ' มม. ตรวจระยะฝังและความยาวสตัดก่อน');
      if (!(s.plate.holeDiameterMM > s.anchors.diameter)) errors.push('รูเพลทต้องใหญ่กว่าขนาดพุกที่เลือก');
    }
    return errors;
  }
  const deferredProductErrors = new Set([
    'anchors.futa ต้องมากกว่า 0',
    'รูเจาะสำหรับพุกเคมีต้องใหญ่กว่าเส้นผ่านศูนย์กลางแกน',
    'ความลึกเจาะต้องไม่น้อยกว่าระยะฝัง'
  ]);
  function validationErrors(s, nativeValidate, engine = root.NCYEngine) {
    const errors = nativeValidate(s);
    if (!forceOnlyAnchor(s, engine)) return [...errors,...dimensionalErrors(s)];
    // Missing manufacturer strength/drilling data blocks CAPACITY, not static
    // demand. The retained engine receives zeros and reports INCOMPLETE. Every
    // other original error, including physical geometry, remains effective.
    return [...errors.filter(error => !deferredProductErrors.has(error)), ...dimensionalErrors(s)];
  }
  function restoreMetadata(s, source) {
    for (const name of metadataKeys) if (has(source.v6, name)) s.v6[name] = source.v6[name];
    // The base importer has already restored the physical sections, but the
    // outer V6.1/V6.2 importers restore their namespaces only after this call.
    // Validate the imported dimensions with that source context, without
    // installing it early or changing the native import order.
    const context = {...s,v61:source.v61,v62:source.v62};
    if (!validMetadata(context)) throw Error('ชื่อวัสดุไม่ตรงกับค่ากรอกที่บันทึกไว้');
    if(legacyTrussPlate(context,'plate')) {
      delete s.v6[key('plate','Id')];delete s.v6[key('plate','Binding')];
    }
    return s;
  }
  function resetProduct(s, row) {
    for (const [name, value] of Object.entries(s.product)) {
      if (typeof value === 'number') s.product[name] = 0;
      else if (typeof value === 'boolean') s.product[name] = false;
      else if (typeof value === 'string') s.product[name] = '';
    }
    s.product.name = forceName(row);
    s.product.confirmed = false;
    s.product.conditionQualified = false;
  }
  function noteManualLoad(s, path) {
    // The retained engineer fields used to leave the hidden roof Auto flag on.
    // Record an actual numeric load edit without rendering/replacing its input.
    if (!['loads.deadKPa','loads.liveKPa','loads.roofKPa'].includes(path)) return;
    s.v6 ||= {}; s.v6.roofLoadMode = 'manual';
    s.v57 ||= {}; s.v57.loadOrigin = 'manual';
  }
  function propose(input, slot, id, deps = root) {
    const row = byId.get(id), E = deps.NCYEngine, U = deps.NCYAuto;
    if (!row || row.slot !== catalogSlot(slot) || row.mode === 'unavailable') throw Error(row?.reason || 'ไม่พบวัสดุที่ใช้คำนวณได้');
    const next = cleanMetadata(input), notices = [row.reason];
    if (slot === 'member') {
      Object.assign(next.member, { H: row.specs.depthMm, B: row.specs.widthMm, tNom: row.specs.thicknessMm });
      notices.push('Fy/Fu ' + next.member.Fy + '/' + next.member.Fu + ' MPa ตามค่าของงาน ไม่ใช่ใบรับรองสินค้าล็อตนี้');
      if(isTruss(next))notices.push('ใช้กับคอร์ดบนและคอร์ดล่างทุกช่วง เหล็กเอวตั้ง/ทแยงเลือกแยกด้านล่าง');
    } else if (slot === 'trussWeb') {
      if(!isTruss(next))throw Error('เหล็กเอวตั้ง/ทแยงใช้เมื่อเลือกระบบ Truss');
      Object.assign(next.brace,{H:row.specs.depthMm,B:row.specs.widthMm,tNom:row.specs.thicknessMm});
      notices.push('ใช้กับสมาชิกเอวตั้งและทแยงทุกชิ้น; Fy/Fu และตัวคูณความหนาใช้ค่าของงาน');
    } else if (slot === 'purlin') {
      Object.assign(next.takeoff,{purlinH:row.specs.depthMm,purlinB:row.specs.widthMm,purlinT:row.specs.thicknessMm,includePurlins:true});
      notices.push('คง DL รวม '+next.loads.deadKPa.toFixed(3)+' kN/m² ไว้: ต้องรวมแปแล้ว ไม่บวกน้ำหนักแปซ้ำ; แยกน้ำหนักแปจริงในรายการคำนวณ');
      notices.push('Fy/Fu และตัวคูณความหนาใช้ร่วมกับเหล็กคานของงาน ไม่ใช่ใบรับรองสินค้า; ไม่เปลี่ยนแป/เหล็กยึดของโมเดล Space Truss');
    } else if (slot === 'plate') {
      Object.assign(next.plate, { width: row.specs.widthMm, height: row.specs.heightMm, thickness: row.specs.thicknessMm, holeDiameterMM: row.specs.holeDiameterMm });
      if(isTruss(next)) {
        Object.assign(next.v62,{rootPlateWidthMM:row.specs.widthMm,rootPlateHeightMM:row.specs.heightMm});
        notices.push('ใช้ขนาดเดียวกันกับเพลทรากบนและล่าง; จำนวนพุกต่อเพลทยังใช้ค่าของงาน');
      }
      notices.push('แผ่น ' + next.plate.width + '×' + next.plate.height + '×' + next.plate.thickness + ' มม.; รู Ø' + next.plate.holeDiameterMM + ' มม. ตรวจรูสำเร็จรูปให้ตรงแบบก่อนซื้อ');
    } else if (slot === 'anchor') {
      const diameter = row.specs.metricSize || next.anchors.diameter;
      const area = E?.ANCHOR_THREAD_AREAS?.[diameter];
      if (!positive(area)) throw Error('ขนาดพุกนี้ยังไม่มีพื้นที่เกลียวในตารางเอนจิ้น');
      Object.assign(next.anchors, { type: 'adhesive', diameter, Ase: area, futa: 0 });
      resetProduct(next, row);
      notices.push('ยังใช้ระยะฝังของงาน ' + next.anchors.hef + ' มม. ไม่ได้แปลงความยาวสตัดเป็นระยะฝัง');
      if (row.specs.assemblyKind !== 'kit') notices.push('รายการนี้เป็น' + ({ rod_only: 'สตัดแยก', capsule_only: 'หลอดเคมีแยก', resin_only: 'น้ำยาแยก' }[row.specs.assemblyKind] || 'ชิ้นส่วนแยก') + ' ยังไม่ใช่ชุดพุกที่ยืนยันการใช้ร่วมกัน');
    } else if (slot === 'ceiling') {
      if (next.mode !== 'basic') throw Error('โหมดแรงหน้าเพลทโดยตรงไม่ใช้ DL หลังคา เปลี่ยนไปกรอกโหลดบนคานก่อน');
      if (!E?.ROOF_PRESETS?.[next.quick.roofType]) throw Error('ไม่พบชุดน้ำหนักหลังคาเดิมที่ตรวจสอบได้');
      next.quick.hasCeiling = !row.specs.none;
      if (row.specs.none && next.quick.roofType === 'metal_ceiling') next.quick.roofType = 'metal_bare';
      const preset = U.syncQuickLoads(clone(next)).state;
      // The existing total assembly already includes framing/ancillaries.
      // Do not add retailer sheet weight again, reset LL, or invent allowances.
      const manual = next.v6?.roofLoadMode === 'manual';
      if (!manual) {
        next.loads.deadKPa = preset.loads.deadKPa;
        if (next.v57) next.v57.loadOrigin = 'preset';
      }
      if (next.v55?.criteria) next.v55.criteria.basisConfirmed = false;
      notices.push((manual ? 'โหมดกรอก DL เอง: คงค่า ' : 'DL ชุดรวมเดิม ') + next.loads.deadKPa.toFixed(3) + ' kN/m²; คง LL, R และแรงลมของงานไว้');
      if (manual) notices.push('ผูกชื่อฝ้าเท่านั้น ไม่ลดหรือแทน DL ที่กรอกเอง ต้องตรวจว่าค่า DL ของงานรวมฝ้าและโครงคร่าวแล้ว');
    }
    next.v6 ||= {};
    next.v6[key(slot, 'Id')] = row.id;
    next.v6[key(slot, 'Binding')] = signature(slot, next);
    return { next: cleanMetadata(next), row, notices };
  }
  function loadProof(result) {
    if (!result?.cases?.length) return null;
    if(isTruss(result.state)) {
      const cases=result.v63?.root?.cases;
      if(!Array.isArray(cases)||cases.length!==result.cases.length)return null;
      const roots=[];
      for(const c of result.cases){
        const rows=cases.filter(r=>r.caseName===c.caseDef?.name);
        if(rows.length!==1||!Number.isFinite(c.action?.Vy)||!Number.isFinite(c.action?.Mx))return null;
        for(const side of ['top','bottom']){
          const r=rows[0][side];if(!r||!['Tper','Vper'].every(k=>Number.isFinite(r[k])&&r[k]>=0))return null;
          roots.push(r);
        }
      }
      return {cases:cases.length,shearKN:null,momentKNm:null,
        anchorTensionKN:Math.max(...roots.map(r=>r.Tper)),anchorShearKN:Math.max(...roots.map(r=>r.Vper)),truss:true};
    }
    if (result.cases.some(c => !Number.isFinite(c.action?.Vy) || !Number.isFinite(c.action?.Mx)
      || !c.group?.forces?.length || c.group.forces.some(a => !Number.isFinite(a.T) || !Number.isFinite(a.V)))) return null;
    const max = (rows, read) => rows.reduce((value, row) => Number.isFinite(read(row)) ? Math.max(value, Math.abs(read(row))) : value, 0);
    const forces = result.cases.flatMap(c => c.group?.forces || []);
    return { cases: result.cases.length,
      shearKN: max(result.cases, c => c.action?.Vy), momentKNm: max(result.cases, c => c.action?.Mx),
      anchorTensionKN: max(forces, a => a.T), anchorShearKN: max(forces, a => a.V) };
  }
  const api = { version: '20260908-r29', slots, labels, labelFor, catalogSlot, isTruss, records, metadataKeys, clone, stable, key,
    signature, selected, cleanMetadata, validMetadata, restoreMetadata, forceOnlyAnchor, validationErrors, dimensionalErrors, noteManualLoad, propose, loadProof };
  root.NCYSC01MaterialInputs = Object.freeze(api);
}(typeof window !== 'undefined' ? window : globalThis));
