/* BM-02 provided-rebar/detailing candidate engine.
 *
 * This file is intentionally a browser-classic script so the isolated mockup
 * still works from file://.  It is also pure and is exercised from Node through
 * a VM harness.  Analysis actions stay in bm02-continuous-beam-mockup.html;
 * this module consumes one completed result and never re-solves the frame.
 */
(function attachBM02Detailing(root, factory) {
  root.BM02Detailing = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function createBM02Detailing() {
  'use strict';

  var VERSION = 'BM02-DETAIL-5';
  var DEFAULT_AGGREGATE_MM = 19;
  var STIRRUP_SPACINGS_CM = [7.5, 10, 12.5, 15, 17.5, 20, 25, 30];
  var KSC_TO_MPA = 0.0980665;
  var KGF_TO_N = 9.80665;
  /* Product-admitted ordinary-material domain for this Beta engine.
   * The narrower steel ceiling keeps the existing Grade-60 equations and
   * development-length factors authoritative; higher-strength grades need a
   * separate reviewed engine path.  Values outside this envelope fail closed
   * before any provided steel, capacity, or Calculation Snapshot is created. */
  var MATERIAL_DOMAIN = Object.freeze({
    concreteStrengthKsc: Object.freeze({ minimum: 180, maximum: 700, label: "f'c" }),
    mainSteelYieldKsc: Object.freeze({ minimum: 2400, maximum: 4200, label: 'fy' }),
    stirrupSteelYieldKsc: Object.freeze({ minimum: 2400, maximum: 2400, label: 'fyv (RB6/RB9 · SR24)' })
  });

  function finite(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function validateMaterialDomain(input) {
    var source = input || {};
    var values = {
      concreteStrengthKsc: Number(source.concreteStrengthKsc),
      mainSteelYieldKsc: Number(source.mainSteelYieldKsc),
      stirrupSteelYieldKsc: Number(source.stirrupSteelYieldKsc)
    };
    var reasons = [];
    Object.keys(MATERIAL_DOMAIN).forEach(function (key) {
      var rule = MATERIAL_DOMAIN[key];
      var value = values[key];
      if (!Number.isFinite(value)) {
        reasons.push(rule.label + ' ต้องเป็นตัวเลข');
      } else if (value < rule.minimum || value > rule.maximum) {
        reasons.push(rule.minimum === rule.maximum
          ? rule.label + ' ต้องเท่ากับ ' + rule.minimum + ' ksc'
          : rule.label + ' ต้องอยู่ในช่วง ' + rule.minimum + '–' + rule.maximum + ' ksc');
      }
    });
    return Object.freeze({
      ok: reasons.length === 0,
      values: Object.freeze(values),
      reasons: Object.freeze(reasons),
      domain: MATERIAL_DOMAIN
    });
  }

  function assertMaterialDomain(input) {
    var validation = validateMaterialDomain(input);
    if (!validation.ok) {
      var error = new RangeError('BM02_MATERIAL_DOMAIN_REQUIRED: ' + validation.reasons.join(' · '));
      error.code = 'BM02_MATERIAL_DOMAIN_REQUIRED';
      error.validation = validation;
      throw error;
    }
    return validation;
  }

  function barAreaCm2(diameterMm) {
    var diameterCm = finite(diameterMm, 0) / 10;
    return Math.PI * diameterCm * diameterCm / 4;
  }

  function distributeBars(count, layerCount) {
    var base = Math.floor(count / layerCount);
    var remainder = count % layerCount;
    return Array.from({ length: layerCount }, function (_, index) {
      return base + (index < remainder ? 1 : 0);
    }).filter(function (value) { return value > 0; });
  }

  function layoutBars(input) {
    var selectedLayerSource = Array.isArray(input.layers) ? input.layers.slice() : null;
    var selectedLayerValues = selectedLayerSource
      ? selectedLayerSource.slice(0, 2).map(function (value) { return Number(value); })
      : null;
    var selectedLayerSlots = selectedLayerValues
      ? selectedLayerValues.map(function (value) {
        return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
      })
      : null;
    while (selectedLayerSlots && selectedLayerSlots.length < 2) selectedLayerSlots.push(0);
    var count = selectedLayerSlots
      ? selectedLayerSlots.reduce(function (sum, value) { return sum + value; }, 0)
      : Math.max(0, Math.round(finite(input.count, 0)));
    var diameterMm = Math.max(6, finite(input.diameterMm, 12));
    var widthCm = Math.max(10, finite(input.widthCm, 20));
    var depthCm = Math.max(15, finite(input.depthCm, 40));
    var coverCm = Math.max(1.5, finite(input.coverCm, 3));
    var stirrupDiameterMm = Math.max(6, finite(input.stirrupDiameterMm, 9));
    var aggregateMm = Math.max(10, finite(input.aggregateMm, DEFAULT_AGGREGATE_MM));
    var diameterCm = diameterMm / 10;
    var stirrupCm = stirrupDiameterMm / 10;
    var minimumClearCm = Math.max(2.5, diameterCm, (4 / 3) * aggregateMm / 10);
    var clearWidthCm = widthCm - 2 * (coverCm + stirrupCm);
    var rawMaximumPerLayer = Math.floor(
      (clearWidthCm + minimumClearCm) / (diameterCm + minimumClearCm)
    );
    var maximumPerLayer = Math.max(0, rawMaximumPerLayer);
    var automaticLayerCount = count > 0 && maximumPerLayer > 0
      ? Math.ceil(count / maximumPerLayer)
      : 0;
    var layerSlots = selectedLayerSlots || (automaticLayerCount > 0
      ? distributeBars(count, automaticLayerCount)
      : []);
    var layers = layerSlots.filter(function (value) { return value > 0; });
    var layerCount = layers.length;
    var verticalCenterSpacingCm = diameterCm + minimumClearCm;
    var outerCenterFromFaceCm = coverCm + stirrupCm + diameterCm / 2;
    var weightedOffset = 0;
    layerSlots.forEach(function (layerBars, index) {
      weightedOffset += layerBars * (outerCenterFromFaceCm + index * verticalCenterSpacingCm);
    });
    var centroidFromTensionFaceCm = count > 0 ? weightedOffset / count : null;
    var effectiveDepthCm = centroidFromTensionFaceCm === null
      ? null
      : depthCm - centroidFromTensionFaceCm;
    var layerClearSpacingsCm = layerSlots.map(function (layerBars) {
      if (layerBars <= 0) return null;
      if (layerBars <= 1) return clearWidthCm - diameterCm;
      return (clearWidthCm - layerBars * diameterCm) / (layerBars - 1);
    });
    var deepestActiveLayerIndex = -1;
    layerSlots.forEach(function (layerBars, index) { if (layerBars > 0) deepestActiveLayerIndex = index; });
    var innermostCenterFromTensionFaceCm = deepestActiveLayerIndex >= 0
      ? outerCenterFromFaceCm + deepestActiveLayerIndex * verticalCenterSpacingCm
      : null;
    /* Opposite continuity bars use the same outer centerline offset from their face.
       In tension-face coordinates their center is (depth - outerCenter); therefore
       clear surface distance = center-to-center distance - one full bar diameter. */
    var oppositeFaceClearCm = innermostCenterFromTensionFaceCm === null
      ? null
      : depthCm - outerCenterFromFaceCm - innermostCenterFromTensionFaceCm - diameterCm;
    var reasons = [];
    if (selectedLayerSource) {
      if (selectedLayerSource.length > 2) reasons.push('เลือกเหล็กได้ไม่เกิน 2 ชั้น');
      if (selectedLayerValues.some(function (value) { return !Number.isFinite(value) || value < 0 || Math.round(value) !== value; })) {
        reasons.push('จำนวนเหล็กแต่ละชั้นต้องเป็นจำนวนเต็มไม่ติดลบ');
      }
      if (selectedLayerSlots[0] < 2) reasons.push('ชั้น 1 ต้องมีเหล็กอย่างน้อย 2 เส้น');
      if (selectedLayerSlots[1] === 1) reasons.push('ชั้น 2 ต้องเป็น 0 หรืออย่างน้อย 2 เส้น');
      if (selectedLayerSlots.some(function (value) { return value > maximumPerLayer; })) {
        reasons.push('จำนวนเหล็กในชั้นเกินพื้นที่วางตามระยะห่างขั้นต่ำ');
      }
    }
    if (count < 2) reasons.push('ต้องมีเหล็กอย่างน้อย 2 เส้นต่อหน้า');
    if (rawMaximumPerLayer < 2) reasons.push('หน้ากว้างสุทธิไม่พอวางเหล็ก 2 เส้นต่อชั้น');
    if (layerCount > 2) reasons.push('ต้องจัดเหล็กเกิน 2 ชั้น');
    if (layerClearSpacingsCm.some(function (spacing) { return spacing !== null && spacing + 1e-9 < minimumClearCm; })) {
      reasons.push('ระยะห่างใสต่ำกว่าระยะขั้นต่ำ');
    }
    if (oppositeFaceClearCm !== null && oppositeFaceClearCm + 1e-9 < minimumClearCm) {
      reasons.push('ระยะดิ่งระหว่างชั้นเหล็กกับเหล็กต่อเนื่องฝั่งตรงข้ามต่ำกว่าระยะขั้นต่ำ');
    }
    if (!(effectiveDepthCm > 0)) reasons.push('ความลึกประสิทธิผลไม่เป็นบวก');
    return {
      count: count,
      diameterMm: diameterMm,
      widthCm: widthCm,
      depthCm: depthCm,
      coverCm: coverCm,
      stirrupDiameterMm: stirrupDiameterMm,
      aggregateMm: aggregateMm,
      clearWidthCm: clearWidthCm,
      minimumClearCm: minimumClearCm,
      rawMaximumPerLayer: rawMaximumPerLayer,
      maximumPerLayer: maximumPerLayer,
      layerCount: layerCount,
      layers: layers,
      layerSlots: layerSlots,
      selectionMode: selectedLayerSource ? 'manual-layers' : 'automatic-distribution',
      layerClearSpacingsCm: layerClearSpacingsCm,
      verticalCenterSpacingCm: verticalCenterSpacingCm,
      outerCenterFromFaceCm: outerCenterFromFaceCm,
      centroidFromTensionFaceCm: centroidFromTensionFaceCm,
      innermostCenterFromTensionFaceCm: innermostCenterFromTensionFaceCm,
      oppositeFaceClearCm: oppositeFaceClearCm,
      effectiveDepthCm: effectiveDepthCm,
      pass: reasons.length === 0,
      reasons: reasons
    };
  }

  function flexuralCapacity(input) {
    var steelAreaCm2 = Math.max(0, finite(input.steelAreaCm2, 0));
    var steelYieldKsc = Math.max(1, finite(input.steelYieldKsc, 4000));
    var concreteStrengthKsc = Math.max(1, finite(input.concreteStrengthKsc, 240));
    var widthCm = Math.max(1, finite(input.widthCm, 20));
    var effectiveDepthCm = Math.max(0, finite(input.effectiveDepthCm, 0));
    var phi = clamp(finite(input.phi, 0.9), 0, 1);
    if (!(steelAreaCm2 > 0) || !(effectiveDepthCm > 0)) {
      return { compressionBlockCm: 0, phiMnKgm: 0, rho: 0 };
    }
    var compressionBlockCm = steelAreaCm2 * steelYieldKsc
      / (0.85 * concreteStrengthKsc * widthCm);
    var phiMnKgm = phi * steelAreaCm2 * steelYieldKsc
      * (effectiveDepthCm - compressionBlockCm / 2) / 100;
    return {
      compressionBlockCm: compressionBlockCm,
      phiMnKgm: Math.max(0, phiMnKgm),
      rho: steelAreaCm2 / (widthCm * effectiveDepthCm)
    };
  }

  function designProvidedFace(input) {
    var demandKgm = Math.max(0, finite(input.demandKgm, 0));
    var requiredAreaCm2 = Math.max(0, finite(input.requiredAreaCm2, 0));
    var diameterMm = Math.max(6, finite(input.diameterMm, 12));
    var areaPerBarCm2 = barAreaCm2(diameterMm);
    var selectedLayers = Array.isArray(input.providedLayers) ? input.providedLayers.slice() : null;
    var hasSelectedLayers = selectedLayers !== null;
    var selectedCount = Number(input.providedCount);
    var hasSelectedCount = !hasSelectedLayers && input.providedCount !== null
      && input.providedCount !== undefined
      && input.providedCount !== ''
      && Number.isFinite(selectedCount);
    var count = hasSelectedCount
      ? Math.max(0, Math.round(selectedCount))
      : Math.max(2, Math.ceil(requiredAreaCm2 / Math.max(areaPerBarCm2, 1e-9)));
    var layout = layoutBars({
      count: count,
      diameterMm: diameterMm,
      widthCm: input.widthCm,
      depthCm: input.depthCm,
      coverCm: input.coverCm,
      stirrupDiameterMm: input.stirrupDiameterMm,
      aggregateMm: input.aggregateMm,
      layers: selectedLayers
    });
    count = layout.count;
    var providedAreaCm2 = count * areaPerBarCm2;
    var capacity = flexuralCapacity({
      steelAreaCm2: providedAreaCm2,
      steelYieldKsc: input.steelYieldKsc,
      concreteStrengthKsc: input.concreteStrengthKsc,
      widthCm: input.widthCm,
      effectiveDepthCm: layout.effectiveDepthCm,
      phi: input.phi
    });
    var utilization = capacity.phiMnKgm > 0
      ? demandKgm / capacity.phiMnKgm
      : (demandKgm > 0 ? Number.POSITIVE_INFINITY : 0);
    var reasons = layout.reasons.slice();
    if (hasSelectedCount && Math.abs(selectedCount - count) > 1e-9) {
      reasons.push('จำนวนเหล็กที่เลือกต้องเป็นจำนวนเต็ม');
    }
    if ((hasSelectedCount || hasSelectedLayers) && providedAreaCm2 + 1e-9 < requiredAreaCm2) {
      reasons.push('A_s,prov ต่ำกว่า A_s,required (รวม rho_min)');
    }
    if (input.designMode === 'doubly') {
      reasons.push('หน้าตัดเสริมสองทางยังไม่มี provided compression-bar model');
    }
    if (Number.isFinite(finite(input.rhoMaximum, NaN)) && capacity.rho > Number(input.rhoMaximum) + 1e-9) {
      reasons.push('อัตราส่วนเหล็กที่จัดให้เกิน rho_max');
    }
    if (utilization > 1 + 1e-9) reasons.push('กำลังดัดจาก As_prov ต่ำกว่า demand');
    return {
      demandKgm: demandKgm,
      requiredAreaCm2: requiredAreaCm2,
      providedAreaCm2: providedAreaCm2,
      areaPerBarCm2: areaPerBarCm2,
      diameterMm: diameterMm,
      count: count,
      designation: count + '-DB' + diameterMm,
      layerDesignation: layout.layers.map(function (bars, index) {
        return 'L' + (index + 1) + ' ' + bars + '-DB' + diameterMm;
      }).join(' + '),
      selectedLayers: selectedLayers,
      selectionMode: hasSelectedCount || hasSelectedLayers ? 'manual' : 'auto',
      layout: layout,
      effectiveDepthCm: layout.effectiveDepthCm,
      compressionBlockCm: capacity.compressionBlockCm,
      rhoProvided: capacity.rho,
      phiMnKgm: capacity.phiMnKgm,
      utilization: utilization,
      status: reasons.length === 0 ? 'ok' : 'bad',
      reasons: reasons
    };
  }

  function designStirrups(input) {
    assertMaterialDomain({
      concreteStrengthKsc: input.concreteStrengthKsc,
      mainSteelYieldKsc: MATERIAL_DOMAIN.mainSteelYieldKsc.minimum,
      stirrupSteelYieldKsc: input.steelYieldKsc
    });
    var demandKg = Math.max(0, finite(input.demandKg, 0));
    var concreteStrengthKsc = Number(input.concreteStrengthKsc);
    var widthCm = Math.max(1, finite(input.widthCm, 20));
    var effectiveDepthCm = Math.max(1, finite(input.effectiveDepthCm, 30));
    var steelYieldKsc = Number(input.steelYieldKsc);
    var diameterMm = Math.max(6, finite(input.diameterMm, 9));
    var legs = Math.max(2, Math.round(finite(input.legs, 2)));
    var phi = clamp(finite(input.phi, 0.85), 0, 1);
    var avCm2 = legs * barAreaCm2(diameterMm);
    var concreteStrengthMpa = concreteStrengthKsc * KSC_TO_MPA;
    var steelYieldMpa = steelYieldKsc * KSC_TO_MPA;
    var widthMm = widthCm * 10;
    var effectiveDepthMm = effectiveDepthCm * 10;
    var avMm2 = avCm2 * 100;
    var vcKg = 0.53 * Math.sqrt(concreteStrengthKsc) * widthCm * effectiveDepthCm;
    var vsRequiredKg = Math.max(0, demandKg / Math.max(phi, 1e-9) - vcKg);
    /* ACI 318-19 9.6.3.3, 22.5.1.2, and 22.5.8.5.3, evaluated in SI units.
     * The admitted simplified Vc expression is valid only while Av >= Av,min,
     * so every candidate spacing is capped by the minimum-reinforcement ratio. */
    var avMinimumPerSpacingMm2PerMm = Math.max(
      0.062 * Math.sqrt(concreteStrengthMpa),
      0.35
    ) * widthMm / steelYieldMpa;
    var minimumReinforcementSpacingCm = avMinimumPerSpacingMm2PerMm > 0
      ? avMm2 / avMinimumPerSpacingMm2PerMm / 10
      : 0;
    var vsMaximumKg = 0.66 * Math.sqrt(concreteStrengthMpa)
      * widthMm * effectiveDepthMm / KGF_TO_N;
    var exceedsMaximumShearContribution = vsRequiredKg > vsMaximumKg + 1e-9;
    var capacitySpacingCm = vsRequiredKg > 0
      ? avCm2 * steelYieldKsc * effectiveDepthCm / vsRequiredKg
      : Number.POSITIVE_INFINITY;
    var highShear = vsRequiredKg > 2 * vcKg;
    var codeMaximumSpacingCm = effectiveDepthCm / (highShear ? 4 : 2);
    var spacingLimitCm = Math.min(
      capacitySpacingCm,
      codeMaximumSpacingCm,
      minimumReinforcementSpacingCm,
      30
    );
    var selectedSpacingNumber = Number(input.selectedSpacingCm);
    var hasSelectedSpacing = input.selectedSpacingCm !== null
      && input.selectedSpacingCm !== undefined
      && input.selectedSpacingCm !== ''
      && Number.isFinite(selectedSpacingNumber);
    var catalog = (input.spacingsCm || STIRRUP_SPACINGS_CM)
      .map(function (spacing) { return finite(spacing, NaN); })
      .filter(function (spacing) { return Number.isFinite(spacing) && spacing > 0; })
      .sort(function (a, b) { return b - a; });
    var candidateSpacingCm = hasSelectedSpacing
      ? selectedSpacingNumber
      : catalog.find(function (spacing) { return spacing <= spacingLimitCm + 1e-9; });
    var reasons = [];
    if (hasSelectedSpacing && !(candidateSpacingCm > 0)) {
      reasons.push('ระยะปลอกที่เลือกต้องมากกว่า 0');
      candidateSpacingCm = null;
    } else if (!candidateSpacingCm) {
      reasons.push('ไม่มีระยะปลอกใน catalog ที่ไม่เกิน spacing limit');
    }
    if (exceedsMaximumShearContribution) {
      reasons.push('V_s,req เกิน V_s,max — ต้องขยายหน้าตัด');
    }
    var vsProvidedKg = candidateSpacingCm
      ? avCm2 * steelYieldKsc * effectiveDepthCm / candidateSpacingCm
      : 0;
    var providedAvPerSpacingMm2PerMm = candidateSpacingCm
      ? avMm2 / (candidateSpacingCm * 10)
      : 0;
    if (candidateSpacingCm
      && providedAvPerSpacingMm2PerMm + 1e-12 < avMinimumPerSpacingMm2PerMm) {
      reasons.push('A_v/s ต่ำกว่า A_v,min/s');
    }
    var creditedVsKg = Math.min(vsProvidedKg, vsMaximumKg);
    var phiVnKg = phi * (vcKg + creditedVsKg);
    var utilization = phiVnKg > 0
      ? demandKg / phiVnKg
      : (demandKg > 0 ? Number.POSITIVE_INFINITY : 0);
    if (candidateSpacingCm && candidateSpacingCm > spacingLimitCm + 1e-9) reasons.push('ระยะปลอกเกิน spacing limit');
    if (utilization > 1 + 1e-9) reasons.push('กำลังเฉือนจากปลอกที่จัดให้ต่ำกว่า demand');
    var status = reasons.length === 0 ? 'ok' : 'bad';
    var spacingCm = status === 'ok' ? candidateSpacingCm : null;
    var selectedSpacingCm = hasSelectedSpacing && candidateSpacingCm ? candidateSpacingCm : null;
    var selectedDesignation = selectedSpacingCm
      ? 'RB' + diameterMm + '@' + selectedSpacingCm + 'cm'
      : null;
    return {
      demandKg: demandKg,
      concreteNominalKg: vcKg,
      stirrupNominalKg: creditedVsKg,
      providedStirrupNominalKg: vsProvidedKg,
      requiredStirrupNominalKg: vsRequiredKg,
      maximumStirrupNominalKg: vsMaximumKg,
      phiVnKg: phiVnKg,
      utilization: utilization,
      phi: phi,
      diameterMm: diameterMm,
      legs: legs,
      steelYieldKsc: steelYieldKsc,
      avCm2: avCm2,
      avMm2: avMm2,
      minimumAvPerSpacingMm2PerMm: avMinimumPerSpacingMm2PerMm,
      providedAvPerSpacingMm2PerMm: providedAvPerSpacingMm2PerMm,
      minimumReinforcementSpacingCm: minimumReinforcementSpacingCm,
      spacingCm: spacingCm,
      selectedSpacingCm: selectedSpacingCm,
      selectionMode: hasSelectedSpacing ? 'manual' : 'auto',
      candidateSpacingCm: candidateSpacingCm || null,
      designation: selectedDesignation
        ? selectedDesignation + (status === 'ok' ? '' : ' · CHECK FAIL')
        : (spacingCm ? 'RB' + diameterMm + '@' + spacingCm + 'cm'
          : (exceedsMaximumShearContribution ? 'NO SOLUTION · ENLARGE SECTION' : 'NO SOLUTION')),
      capacitySpacingCm: capacitySpacingCm,
      codeMaximumSpacingCm: codeMaximumSpacingCm,
      spacingLimitCm: spacingLimitCm,
      spacingRule: highShear ? 'd/4' : 'd/2',
      minimumReinforcementGoverns: minimumReinforcementSpacingCm <= Math.min(capacitySpacingCm, codeMaximumSpacingCm, 30) + 1e-9,
      exceedsMaximumShearContribution: exceedsMaximumShearContribution,
      status: status,
      reasons: reasons
    };
  }

  /* ACI 318-19 25.4.2.3 expression and project minimums, kept byte-for-byte
   * equivalent in behavior to AdvancedDesign.developmentLength_tension. */
  function developmentLengthTension(input) {
    var diameterMm = Math.max(1, finite(input.diameterMm, 12));
    var concreteStrengthMpa = Math.max(0.01, finite(input.concreteStrengthKsc, 240) * 0.0980665);
    var steelYieldMpa = Math.max(0.01, finite(input.steelYieldKsc, 4000) * 0.0980665);
    var psiTop = input.isTop ? 1.3 : 1;
    var psiEpoxy = input.epoxyCoated ? 1.5 : 1;
    var psiSize = diameterMm <= 19 ? 0.8 : 1;
    var psiGrade = Math.max(1, finite(input.psiGrade, 1));
    var cbKtr = clamp(finite(input.cbKtrRatio, 2), 1, 2.5);
    var calculatedMm = steelYieldMpa * psiTop * psiEpoxy * psiSize * psiGrade
      / (1.1 * Math.sqrt(concreteStrengthMpa) * cbKtr) * diameterMm;
    var projectMinimumMm = diameterMm <= 16 ? 40 * diameterMm : 50 * diameterMm;
    return Math.max(calculatedMm, projectMinimumMm, 300);
  }

  function anchorageAtExterior(input) {
    if (input.supportType === 'free') {
      return {
        side: input.side,
        supportType: input.supportType,
        status: 'not-applicable',
        reason: 'ปลายอิสระ ไม่มีฐานสำหรับตรวจระยะฝัง'
      };
    }
    var supportWidthCm = Math.max(0, finite(input.supportWidthCm, 0));
    var coverCm = Math.max(0, finite(input.coverCm, 0));
    var diameterCm = Math.max(0, finite(input.diameterMm, 0) / 10);
    var availableStraightCm = Math.max(0, supportWidthCm - coverCm - diameterCm / 2);
    var requiredStraightCm = Math.max(0, finite(input.requiredLengthMm, 0) / 10);
    var pass = availableStraightCm + 1e-9 >= requiredStraightCm;
    return {
      side: input.side,
      supportType: input.supportType,
      supportWidthCm: supportWidthCm,
      availableStraightCm: availableStraightCm,
      requiredStraightCm: requiredStraightCm,
      status: pass ? 'ok' : 'hold',
      reason: pass
        ? 'ระยะฝังตรงภายในฐานไม่น้อยกว่า Ld'
        : 'ระยะฝังตรงไม่พอ ต้องระบุ hook/headed bar หรือ geometry จุดต่อเพิ่ม'
    };
  }

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
    return value;
  }

  function buildDetailing(input) {
    var materialDomain = assertMaterialDomain({
      concreteStrengthKsc: input.concreteStrengthKsc,
      mainSteelYieldKsc: input.mainSteelYieldKsc,
      stirrupSteelYieldKsc: input.stirrupSteelYieldKsc
    });
    var positive = designProvidedFace({
      demandKgm: input.positiveMomentKgm,
      requiredAreaCm2: input.positiveRequiredAreaCm2,
      designMode: input.positiveDesignMode,
      diameterMm: input.mainBarDiameterMm,
      widthCm: input.widthCm,
      depthCm: input.depthCm,
      coverCm: input.coverCm,
      stirrupDiameterMm: input.stirrupDiameterMm,
      aggregateMm: input.aggregateMm,
      steelYieldKsc: input.mainSteelYieldKsc,
      concreteStrengthKsc: input.concreteStrengthKsc,
      phi: input.phiFlexure,
      rhoMaximum: input.positiveRhoMaximum,
      providedCount: input.positiveProvidedCount,
      providedLayers: input.positiveProvidedLayers
    });
    var negative = designProvidedFace({
      demandKgm: input.negativeMomentKgm,
      requiredAreaCm2: input.negativeRequiredAreaCm2,
      designMode: input.negativeDesignMode,
      diameterMm: input.mainBarDiameterMm,
      widthCm: input.widthCm,
      depthCm: input.depthCm,
      coverCm: input.coverCm,
      stirrupDiameterMm: input.stirrupDiameterMm,
      aggregateMm: input.aggregateMm,
      steelYieldKsc: input.mainSteelYieldKsc,
      concreteStrengthKsc: input.concreteStrengthKsc,
      phi: input.phiFlexure,
      rhoMaximum: input.negativeRhoMaximum,
      providedCount: input.negativeProvidedCount,
      providedLayers: input.negativeProvidedLayers
    });
    var effectiveDepthCm = Math.min(
      finite(positive.effectiveDepthCm, Number.POSITIVE_INFINITY),
      finite(negative.effectiveDepthCm, Number.POSITIVE_INFINITY)
    );
    if (!Number.isFinite(effectiveDepthCm)) effectiveDepthCm = finite(input.depthCm, 40) - finite(input.coverCm, 3);
    var stirrup = designStirrups({
      demandKg: input.shearKg,
      concreteStrengthKsc: input.concreteStrengthKsc,
      widthCm: input.widthCm,
      effectiveDepthCm: effectiveDepthCm,
      steelYieldKsc: input.stirrupSteelYieldKsc,
      diameterMm: input.stirrupDiameterMm,
      legs: input.stirrupLegs,
      phi: input.phiShear,
      spacingsCm: input.stirrupSpacingsCm,
      selectedSpacingCm: input.manualStirrupSpacingCm
    });
    var ldTopMm = developmentLengthTension({
      diameterMm: input.mainBarDiameterMm,
      concreteStrengthKsc: input.concreteStrengthKsc,
      steelYieldKsc: input.mainSteelYieldKsc,
      isTop: true,
      cbKtrRatio: input.cbKtrRatio,
      psiGrade: input.psiGrade
    });
    var ldBottomMm = developmentLengthTension({
      diameterMm: input.mainBarDiameterMm,
      concreteStrengthKsc: input.concreteStrengthKsc,
      steelYieldKsc: input.mainSteelYieldKsc,
      isTop: false,
      cbKtrRatio: input.cbKtrRatio,
      psiGrade: input.psiGrade
    });
    var supportWidthsCm = (input.supportWidthsCm || []).map(function (value) {
      return Math.max(0, finite(value, 0));
    });
    var exterior = [
      anchorageAtExterior({
        side: 'left',
        supportType: input.leftSupportType,
        supportWidthCm: supportWidthsCm[0],
        coverCm: input.coverCm,
        diameterMm: input.mainBarDiameterMm,
        requiredLengthMm: Math.max(ldTopMm, ldBottomMm)
      }),
      anchorageAtExterior({
        side: 'right',
        supportType: input.rightSupportType,
        supportWidthCm: supportWidthsCm[supportWidthsCm.length - 1],
        coverCm: input.coverCm,
        diameterMm: input.mainBarDiameterMm,
        requiredLengthMm: Math.max(ldTopMm, ldBottomMm)
      })
    ];
    var standardStatus = input.standardCoherent === false ? 'hold' : 'ok';
    var capacityStatus = positive.status === 'bad' || negative.status === 'bad' || stirrup.status === 'bad'
      ? 'bad'
      : 'ok';
    /* The admitted Ld expression is the existing ACI 318-19 project contract.
     * Any other or unlocked strength basis must fail closed instead of silently
     * borrowing this detailing clause. */
    var developmentStandardStatus = input.standardId === 'aci_318_19' ? 'ok' : 'hold';
    var anchorageStatus = developmentStandardStatus === 'hold'
      || exterior.some(function (item) { return item.status === 'hold'; }) ? 'hold' : 'ok';
    return deepFreeze({
      version: VERSION,
      materialDomain: materialDomain,
      standardId: input.standardId || 'unlocked',
      standardStatus: standardStatus,
      faces: { positive: positive, negative: negative },
      stirrup: stirrup,
      development: {
        topMm: ldTopMm,
        bottomMm: ldBottomMm,
        cbKtrRatio: finite(input.cbKtrRatio, 2),
        exterior: exterior,
        standardStatus: developmentStandardStatus,
        status: anchorageStatus,
        limitation: developmentStandardStatus === 'hold'
          ? 'The selected strength basis has no admitted development-length engine; anchorage is not evaluated.'
          : (anchorageStatus === 'hold'
          ? 'Straight anchorage is insufficient; hook/headed-bar and joint geometry are not evaluated.'
          : null
          )
      },
      supportWidthsCm: supportWidthsCm,
      capacityStatus: capacityStatus,
      detailingStatus: capacityStatus === 'bad' ? 'bad'
        : (standardStatus === 'hold' || anchorageStatus === 'hold' ? 'hold' : 'ok')
    });
  }

  return Object.freeze({
    VERSION: VERSION,
    MATERIAL_DOMAIN: MATERIAL_DOMAIN,
    STIRRUP_SPACINGS_CM: STIRRUP_SPACINGS_CM.slice(),
    validateMaterialDomain: validateMaterialDomain,
    barAreaCm2: barAreaCm2,
    layoutBars: layoutBars,
    flexuralCapacity: flexuralCapacity,
    designProvidedFace: designProvidedFace,
    designStirrups: designStirrups,
    developmentLengthTension: developmentLengthTension,
    anchorageAtExterior: anchorageAtExterior,
    buildDetailing: buildDetailing
  });
}));
