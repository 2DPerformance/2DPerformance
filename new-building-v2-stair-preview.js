// Drawing-only stair preview. No support, reaction, analysis or design authority.
(function attachStairPreview(root) {
  const finite = value => Number.isFinite(Number(value));
  const number = value => Number(value);
  const hold = code => ({ current: false, code, parts: [], ends: [], supportEdges: [] });

  function build(record, options = {}) {
    if (record?.stairType !== 'Straight single-flight with one landing') return hold('STAIR_TYPE_NOT_MODELED');
    if (options.recordCurrent !== true) return hold('STAIR_DRAWING_NOT_CURRENT');
    const bounds = record.bounds || {};
    const input = record.stairGeometryInput || {};
    const fields = [bounds.left, bounds.right, bounds.top, bounds.bottom,
      input.treadM, input.riserM, input.treadCount, input.riserCount,
      input.waistM, input.landingThicknessM, record.landingDepthM,
      options.lowerElevationM, options.upperElevationM, options.originX, options.originY, options.unitsPerMetre];
    if (!fields.every(finite) || !Number.isInteger(number(input.treadCount))
      || !Number.isInteger(number(input.riserCount)) || !(number(input.treadCount) > 0)
      || !(number(input.riserCount) > 0) || [input.treadM, input.riserM, input.waistM,
        input.landingThicknessM, record.landingDepthM, options.unitsPerMetre].some(value => !(number(value) > 0))) {
      return hold('STAIR_GEOMETRY_INPUT_HOLD');
    }
    const edge = String(record.upEdgeRef || '');
    if (!['left', 'right', 'top', 'bottom'].includes(edge)) return hold('STAIR_DIRECTION_HOLD');
    const xMin = (number(bounds.left) - number(options.originX)) / number(options.unitsPerMetre);
    const xMax = (number(bounds.right) - number(options.originX)) / number(options.unitsPerMetre);
    const yMin = (number(bounds.top) - number(options.originY)) / number(options.unitsPerMetre);
    const yMax = (number(bounds.bottom) - number(options.originY)) / number(options.unitsPerMetre);
    const axis = ['left', 'right'].includes(edge) ? 'x' : 'y';
    const sign = ['right', 'bottom'].includes(edge) ? 1 : -1;
    const runMin = axis === 'x' ? xMin : yMin;
    const runMax = axis === 'x' ? xMax : yMax;
    const crossMin = axis === 'x' ? yMin : xMin;
    const crossMax = axis === 'x' ? yMax : xMax;
    const runLength = runMax - runMin;
    const width = crossMax - crossMin;
    const landing = number(record.landingDepthM);
    const flight = runLength - landing;
    const treadCount = number(input.treadCount);
    const riserCount = number(input.riserCount);
    const rise = number(options.upperElevationM) - number(options.lowerElevationM);
    if (!(width > 0) || !(flight > 0) || !(rise > 0)
      || Math.abs(treadCount * number(input.treadM) - flight) > .03
      || Math.abs(riserCount * number(input.riserM) - rise) > .015
      || riserCount !== treadCount + 1) return hold('STAIR_FLIGHT_LEVEL_MISMATCH');
    const from = sign > 0 ? runMin : runMax;
    const across = (crossMin + crossMax) / 2;
    const point = (run, elevation) => axis === 'x'
      ? { x: run, y: across, z: elevation }
      : { x: across, y: run, z: elevation };
    const crossEdge = (run, elevation) => axis === 'x'
      ? [{ x: run, y: crossMin, z: elevation }, { x: run, y: crossMax, z: elevation }]
      : [{ x: crossMin, y: run, z: elevation }, { x: crossMax, y: run, z: elevation }];
    const lower = number(options.lowerElevationM);
    const upper = number(options.upperElevationM);
    const treadM = number(input.treadM);
    const riserM = number(input.riserM);
    const parts = [{ kind: 'waist', from: point(from, lower - number(input.waistM) / 2),
      to: point(from + sign * flight, upper - riserM - number(input.waistM) / 2),
      widthM: width, thicknessM: number(input.waistM) }];
    for (let index = 0; index < treadCount; index += 1) {
      parts.push({ kind: 'tread', index: index + 1,
        center: point(from + sign * (index + .5) * treadM, lower + (index + 1) * riserM - .0125),
        runM: treadM, widthM: width, thicknessM: .025, axis });
    }
    parts.push({ kind: 'landing', center: point(from + sign * (flight + landing / 2), upper - number(input.landingThicknessM) / 2),
      runM: landing, widthM: width, thicknessM: number(input.landingThicknessM), axis });
    return {
      current: true, code: 'STAIR_DRAWING_PREVIEW_ENGINE_0', parts,
      ends: [
        { role: 'lower', levelId: record.lowerLevelId, edge: crossEdge(from, lower) },
        { role: 'upper', levelId: record.upperLevelId, edge: crossEdge(from + sign * runLength, upper) },
      ],
      supportEdges: [
        {
          role: 'flight-landing-junction',
          levelId: record.upperLevelId,
          edge: crossEdge(from + sign * flight, upper),
        },
      ],
      supportStatus: 'NOT_EVALUATED', constructionAuthorized: false,
    };
  }

  function adjacentBeam(end, beams = [], toleranceM = .15) {
    const [left, right] = end?.edge || [];
    if (!left || !right) return null;
    const sameX = Math.abs(left.x - right.x) < 1e-6;
    const fixed = sameX ? left.x : left.y;
    const cross = sameX ? 'y' : 'x';
    const low = Math.min(left[cross], right[cross]);
    const high = Math.max(left[cross], right[cross]);
    const candidates = beams.filter(beam => String(beam.levelId) === String(end.levelId)
      && Math.abs(number(beam.z) - left.z) < .02
      && finite(beam.a?.x) && finite(beam.a?.y) && finite(beam.b?.x) && finite(beam.b?.y)
      && Math.abs(number(beam.a[sameX ? 'x' : 'y']) - fixed) <= toleranceM
      && Math.abs(number(beam.b[sameX ? 'x' : 'y']) - fixed) <= toleranceM
      && Math.min(number(beam.a[cross]), number(beam.b[cross])) <= low + toleranceM
      && Math.max(number(beam.a[cross]), number(beam.b[cross])) >= high - toleranceM);
    return candidates.length === 1 ? { id: candidates[0].id, mark: candidates[0].mark,
      levelId: candidates[0].levelId, distanceM: Math.abs(number(candidates[0].a[sameX ? 'x' : 'y']) - fixed) }
      : null;
  }

  const landingSupportHold = (code, details = {}) => ({
    current: false,
    code,
    mode: 'hold',
    proposal: null,
    existingBeam: null,
    receivers: [],
    supportVerified: false,
    reactionStatus: 'NOT_EVALUATED',
    loadPathStatus: 'NOT_EVALUATED',
    analysisInclusion: 'excluded',
    constructionAuthorized: false,
    engineRecords: 0,
    ...details,
  });

  function landingSupportBeamReview(preview, beams = [], options = {}) {
    const junction = preview?.supportEdges?.find(edge => edge?.role === 'flight-landing-junction');
    const [first, second] = junction?.edge || [];
    if (preview?.current !== true || !first || !second) {
      return landingSupportHold('STAIR_LANDING_JUNCTION_UNAVAILABLE');
    }
    const toleranceM = finite(options.toleranceM) ? Math.max(.001, number(options.toleranceM)) : .05;
    const axisToleranceM = finite(options.axisToleranceM) ? Math.max(.001, number(options.axisToleranceM)) : .02;
    const elevationToleranceM = finite(options.elevationToleranceM)
      ? Math.max(.001, number(options.elevationToleranceM)) : .02;
    const sameX = Math.abs(number(first.x) - number(second.x)) <= axisToleranceM;
    const sameY = Math.abs(number(first.y) - number(second.y)) <= axisToleranceM;
    if (sameX === sameY) return landingSupportHold('STAIR_LANDING_JUNCTION_AXIS_HOLD');
    const fixedAxis = sameX ? 'x' : 'y';
    const spanAxis = sameX ? 'y' : 'x';
    const fixed = (number(first[fixedAxis]) + number(second[fixedAxis])) / 2;
    const clearLow = Math.min(number(first[spanAxis]), number(second[spanAxis]));
    const clearHigh = Math.max(number(first[spanAxis]), number(second[spanAxis]));
    const levelId = String(junction.levelId || '');
    const elevationM = number(first.z);
    const axisAligned = (beam, constantAxis) => Math.abs(number(beam.a?.[constantAxis]) - number(beam.b?.[constantAxis])) <= axisToleranceM;
    const atLevel = beam => String(beam?.levelId || '') === levelId
      && finite(beam?.z) && Math.abs(number(beam.z) - elevationM) <= elevationToleranceM
      && finite(beam?.a?.x) && finite(beam?.a?.y) && finite(beam?.b?.x) && finite(beam?.b?.y);
    const receiverCandidates = beams.filter(beam => atLevel(beam)
      && axisAligned(beam, spanAxis)
      && Math.min(number(beam.a[fixedAxis]), number(beam.b[fixedAxis])) <= fixed + toleranceM
      && Math.max(number(beam.a[fixedAxis]), number(beam.b[fixedAxis])) >= fixed - toleranceM)
      .map(beam => ({
        beam,
        coordinate: (number(beam.a[spanAxis]) + number(beam.b[spanAxis])) / 2,
      }));
    const chooseReceiver = (side, boundary) => {
      const candidates = receiverCandidates.filter(candidate => side === 'low'
        ? candidate.coordinate <= boundary + toleranceM
        : candidate.coordinate >= boundary - toleranceM)
        .map(candidate => ({ ...candidate, distance: Math.abs(candidate.coordinate - boundary) }))
        .sort((a, b) => a.distance - b.distance || String(a.beam.id || '').localeCompare(String(b.beam.id || '')));
      if (!candidates.length) return { code: side === 'low' ? 'STAIR_LANDING_RECEIVER_LOW_MISSING' : 'STAIR_LANDING_RECEIVER_HIGH_MISSING' };
      if (candidates[1] && Math.abs(candidates[1].distance - candidates[0].distance) <= toleranceM) {
        return { code: side === 'low' ? 'STAIR_LANDING_RECEIVER_LOW_AMBIGUOUS' : 'STAIR_LANDING_RECEIVER_HIGH_AMBIGUOUS' };
      }
      return { candidate: candidates[0] };
    };
    const lowReview = chooseReceiver('low', clearLow);
    if (!lowReview.candidate) return landingSupportHold(lowReview.code, { junction });
    const highReview = chooseReceiver('high', clearHigh);
    if (!highReview.candidate) return landingSupportHold(highReview.code, { junction });
    if (String(lowReview.candidate.beam.id || '') === String(highReview.candidate.beam.id || '')) {
      return landingSupportHold('STAIR_LANDING_RECEIVER_PAIR_HOLD', { junction });
    }
    const receiverLow = lowReview.candidate;
    const receiverHigh = highReview.candidate;
    const requiredLow = Math.min(receiverLow.coordinate, receiverHigh.coordinate);
    const requiredHigh = Math.max(receiverLow.coordinate, receiverHigh.coordinate);
    if (!(requiredHigh - requiredLow > axisToleranceM)) {
      return landingSupportHold('STAIR_LANDING_RECEIVER_SPAN_HOLD', { junction });
    }
    const transverse = beams.filter(beam => atLevel(beam)
      && axisAligned(beam, fixedAxis)
      && Math.abs(number(beam.a[fixedAxis]) - fixed) <= toleranceM
      && Math.abs(number(beam.b[fixedAxis]) - fixed) <= toleranceM
      && Math.min(number(beam.a[spanAxis]), number(beam.b[spanAxis])) <= requiredLow + toleranceM
      && Math.max(number(beam.a[spanAxis]), number(beam.b[spanAxis])) >= requiredHigh - toleranceM);
    const receivers = [receiverLow, receiverHigh].map(receiver => ({
      id: receiver.beam.id,
      mark: receiver.beam.mark,
      levelId: receiver.beam.levelId,
      coordinateM: receiver.coordinate,
    }));
    if (transverse.length > 1) {
      return landingSupportHold('STAIR_LANDING_TRANSVERSE_AMBIGUOUS', { junction, receivers });
    }
    const base = {
      current: true,
      junction,
      receivers,
      supportVerified: false,
      reactionStatus: 'NOT_EVALUATED',
      loadPathStatus: 'NOT_EVALUATED',
      analysisInclusion: 'excluded',
      constructionAuthorized: false,
      engineRecords: 0,
    };
    if (transverse.length === 1) {
      const beam = transverse[0];
      return {
        ...base,
        code: 'STAIR_LANDING_SUPPORT_EXISTING_REFERENCE',
        mode: 'existing-reference',
        proposal: null,
        existingBeam: { id: beam.id, mark: beam.mark, levelId: beam.levelId },
      };
    }
    const a = sameX ? { x: fixed, y: requiredLow, z: elevationM } : { x: requiredLow, y: fixed, z: elevationM };
    const b = sameX ? { x: fixed, y: requiredHigh, z: elevationM } : { x: requiredHigh, y: fixed, z: elevationM };
    const stairId = String(options.stairId || 'STAIR');
    const stairMark = String(options.stairMark || stairId);
    return {
      ...base,
      code: 'STAIR_LANDING_SUPPORT_AUTO_PROPOSAL',
      mode: 'auto-proposal',
      existingBeam: null,
      proposal: {
        id: `${stairId}:AUTO-LANDING-RECEIVER`,
        mark: `${stairMark}-SB-AUTO`,
        role: 'flight-landing-junction-support',
        levelId,
        z: elevationM,
        a,
        b,
        receiverIds: receivers.map(receiver => receiver.id),
        receiverMarks: receivers.map(receiver => receiver.mark),
        authority: 'AUTO STAIR SUPPORT PROPOSAL · DRAWING INPUT · ENGINE 0',
        engineeringStatus: 'not_evaluated',
        analysisInclusion: 'excluded',
        supportStatus: 'NOT_EVALUATED',
        reactionStatus: 'NOT_EVALUATED',
        loadPathStatus: 'NOT_EVALUATED',
        constructionAuthorized: false,
        engineRecords: 0,
      },
    };
  }
  root.NBV2StairPreview = Object.freeze({ build, adjacentBeam, landingSupportBeamReview });
})(globalThis);
