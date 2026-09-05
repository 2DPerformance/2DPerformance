/* SC01 R17 — support-bound presentation, NOT a new structural engine.
 * The upper-restraint study owns a separate canvas with copied geometry only.
 * No engine state, capacities, verdicts, BOQ or saved project are modified. */
(function (root) {
  'use strict';
  const VERSION = 'r17-support-study';
  const copy = value => JSON.parse(JSON.stringify(value));
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const add = (a, b) => a.map((v, i) => v + b[i]);
  const mul = (a, k) => a.map(v => v * k);
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
  const unit = a => mul(a, 1 / (Math.hypot(...a) || 1));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const validBox = b => b && b.min?.length === 3 && b.max?.length === 3 &&
    b.min.every((v, i) => finite(v) && finite(b.max[i]) && v <= b.max[i]);

  function bounds(points) {
    if (!points?.length || points.length % 3) return null;
    const b = {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
    for (let i = 0; i < points.length; i++) {
      if (!finite(points[i])) return null;
      const axis = i % 3;
      b.min[axis] = Math.min(b.min[axis], points[i]);
      b.max[axis] = Math.max(b.max[axis], points[i]);
    }
    return b;
  }

  // A frame must actually cross a concrete column's face. Proximity outside
  // that face is not permission to invent a support or alter the roof grid.
  function columnMatches(frames, columns, margin) {
    const matches = [], missing = [], errors = [], used = new Set();
    if (!finite(margin) || margin <= 0 || !Array.isArray(frames) || !Array.isArray(columns)) {
      return {matches, missing, errors: ['ข้อมูลแนวเสาหรือระยะเผื่อไม่ถูกต้อง']};
    }
    for (const frame of frames) {
      if (!finite(frame.positionMM)) { errors.push('ตำแหน่งแนวโครงไม่ใช่ตัวเลข'); continue; }
      const candidates = columns.filter(c => validBox(c.bounds) && frame.positionMM >= c.bounds.min[0] - .001 && frame.positionMM <= c.bounds.max[0] + .001);
      if (candidates.length !== 1) { missing.push(frame.frameId); continue; }
      const c = candidates[0], b = c.bounds;
      if (used.has(c.id)) { errors.push(`มีหลายแนวโครงทับเสา ${c.id} — ต้องจัดจุดยึดแยก`); missing.push(frame.frameId); continue; }
      if (b.max[0] - b.min[0] < 2 * margin) { errors.push(`หน้าเสา ${c.id} แคบกว่าชิ้นส่วนที่แสดง`); missing.push(frame.frameId); continue; }
      used.add(c.id);
      matches.push({frameId: frame.frameId, frameX: frame.positionMM, columnId: c.id, column: copy(b),
        rootX: clamp(frame.positionMM, b.min[0] + margin, b.max[0] - margin)});
    }
    if (!matches.length) errors.push('ไม่มีแนวโครงตรงกับหน้าเสาคอนกรีตจริง');
    return {matches, missing, errors};
  }

  function lowerPlan({frames, columns, brace, member, beamStart}) {
    const values = [brace?.B, brace?.H, brace?.tNom, brace?.dropM, brace?.attachM, member?.H, member?.lengthM, beamStart];
    if (values.some(v => !finite(v)) || values.slice(0, 7).some(v => v <= 0) ||
        brace.tNom * 2 >= Math.min(brace.B, brace.H) || brace.attachM > member.lengthM) {
      return {members: [], missing: frames?.map(f => f.frameId) || [], errors: ['มิติค้ำล่างไม่ถูกต้อง — ไม่วาดค่าที่เดาหรือแก้ให้อัตโนมัติ']};
    }
    const margin = Math.max(brace.B, brace.H) / 2 + 5;
    const map = columnMatches(frames, columns, margin), members = [], errors = [...map.errors], missing = [...map.missing];
    for (const match of map.matches) {
      const y = -brace.dropM * 1000, b = match.column;
      if (y < b.min[1] + margin || y > b.max[1] - margin) {
        errors.push(`${match.frameId}: จุดค้ำอยู่นอกความสูงเสา — ปรับมิติในข้อมูลโครงสร้าง`);
        missing.push(match.frameId); continue;
      }
      members.push({...match, start: [match.rootX, y, b.max[2]],
        end: [match.frameX, -member.H / 2 - brace.H / 2, beamStart + brace.attachM * 1000]});
    }
    return {members, missing, errors, frameCount: frames.length, originalRepeatedCount: frames.length};
  }

  function studyNumber(value) {
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') return NaN;
    return Number(value);
  }

  // Conservative geometric intersection with the roof envelope. It is only a
  // clash test; a clear segment is NOT a designed cable or connection.
  function crossesRoof(start, end, roof, radius) {
    if (!validBox(roof)) return true;
    let near = 0, far = 1;
    const d = sub(end, start);
    for (let axis = 0; axis < 3; axis++) {
      const lo = roof.min[axis] - radius, hi = roof.max[axis] + radius;
      if (Math.abs(d[axis]) < 1e-9) { if (start[axis] < lo || start[axis] > hi) return false; }
      else {
        let a = (lo - start[axis]) / d[axis], b = (hi - start[axis]) / d[axis];
        if (a > b) [a, b] = [b, a];
        near = Math.max(near, a); far = Math.min(far, b);
        if (near > far) return false;
      }
    }
    return far >= 0 && near <= 1;
  }

  function upperPlan({frames, columns, member, roof, beamStart}, values) {
    const riseM = studyNumber(values.riseM), attachM = studyNumber(values.attachM), diameterMM = studyNumber(values.diameterMM);
    const errors = [], members = [], extensions = [];
    if (!['rod', 'cable'].includes(values.kind)) errors.push('เลือกเหล็กดึงหรือสลิง');
    if (!finite(riseM) || riseM < .25 || riseM > 5) errors.push('ยกยอดเสา 0.25–5.00 ม. สำหรับศึกษารูปทรง');
    if (!finite(member?.lengthM) || !finite(member?.B) || !finite(member?.H) || !finite(beamStart) ||
        !finite(attachM) || attachM < .25 || attachM > member.lengthM) errors.push('จุดยึดต้องอยู่บนช่วงคานยื่น ตั้งแต่ 0.25 ม. ถึงปลายคาน');
    if (!finite(diameterMM) || diameterMM < 6 || diameterMM > 60) errors.push('เส้นผ่านศูนย์กลางภาพตัวอย่าง 6–60 มม. ไม่ใช่ขนาดออกแบบ');
    if (!validBox(roof)) errors.push('ไม่พบขอบเขตแผ่นหลังคา — ยังตรวจแนวรั้งไม่ได้');
    if (errors.length) return {members, extensions, errors};
    const map = columnMatches(frames, columns, Math.max(25, diameterMM / 2 + 5));
    errors.push(...map.errors);
    for (const match of map.matches) {
      const b = match.column, side = Math.sign(match.frameX);
      if (!side) { errors.push(`${match.frameId}: ไม่มีแนวข้างคานที่พ้นแผ่นหลังคา`); continue; }
      const top = b.max[1] + riseM * 1000;
      const start = [(b.min[0] + b.max[0]) / 2, top - 100, b.max[2]];
      // Reference attachment is on the OUTBOARD SIDE of the structural beam,
      // not on the roof covering. End fittings still need a designed detail.
      const end = [match.frameX + side * (member.B / 2 + diameterMM / 2 + 5), 0, beamStart + attachM * 1000];
      if (start[1] <= end[1] || crossesRoof(start, end, roof, diameterMM / 2)) {
        errors.push(`${match.frameId}: แนวรั้งตัดซองแผ่นหลังคา — เพิ่มความสูงหรือปรับจุดยึด`); continue;
      }
      members.push({...match, start, end, diameterMM, kind: values.kind,
        beamReference: [match.frameX + side * member.B / 2, 0, end[2]], lengthMM: Math.hypot(...sub(end, start))});
      extensions.push({columnId: match.columnId, bounds: {min: [...b.min], max: [b.max[0], top, b.max[2]]}, oldTop: b.max[1]});
    }
    if (members.length !== columns.length && !errors.length) errors.push('แนวหลังคาไม่ตรงกับเสาครบทุกต้น — ไม่เพิ่มจุดรั้งสมมติ');
    return {members, extensions, missing: map.missing, errors};
  }

  function rodGeometry(start, end, diameter, sides = 12) {
    const direction = unit(sub(end, start)), u = unit(cross(direction, Math.abs(direction[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), v = cross(direction, u);
    const g = {p: [], n: []}, radius = diameter / 2;
    const pt = (center, angle) => add(center, add(mul(u, radius * Math.cos(angle)), mul(v, radius * Math.sin(angle))));
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides, b = (i + 1) * Math.PI * 2 / sides;
      const p = [pt(start, a), pt(start, b), pt(end, b), pt(end, a)];
      const normal = unit(add(mul(u, Math.cos((a+b)/2)), mul(v, Math.sin((a+b)/2))));
      for (const index of [0, 1, 2, 0, 2, 3]) { g.p.push(...p[index]); g.n.push(...normal); }
    }
    return g;
  }

  function removeMeshes(viewer, predicate) {
    viewer.meshes = viewer.meshes.filter(mesh => {
      if (!predicate(mesh)) return true;
      viewer.gl?.deleteBuffer(mesh.pb); viewer.gl?.deleteBuffer(mesh.nb); return false;
    });
  }
  function context(viewer) {
    return {frames: copy(viewer.projectLayout?.frames || []),
      columns: (viewer.meshes || []).filter(m => /^v61-support-column-[LR]$/.test(m.id)).map(m => ({id: m.id, bounds: bounds(m.g.p)})),
      member: copy(viewer.data?.state?.member || {}), brace: copy(viewer.data?.state?.brace || {}),
      beamStart: viewer.geo?.face,
      roof: bounds((viewer.meshes || []).filter(m => m.id === 'roof-covering').flatMap(m => m.g.p))};
  }
  function correctLower(viewer, cad) {
    const s = viewer.data?.state;
    viewer.sc01SupportBracing = null;
    if (!viewer.projectLayout || !['project', 'support'].includes(viewer.v6Scene) ||
        s?.v61?.supportType !== 'dual_columns' || s?.v61?.systemType === 'truss' || s?.connectionType !== 'bracket') return;
    const ctx = context(viewer), plan = lowerPlan(ctx);
    const templates = viewer.meshes.filter(m => m.instance?.sourceId === 'brace');
    // Rebuild the donor first on every change; never mutate its templates.
    removeMeshes(viewer, m => m.instance?.sourceId === 'brace' || m.sc01SupportMember);
    for (const member of plan.members) {
      const template = templates.find(m => m.instance.frameId === member.frameId);
      if (!template) { plan.errors.push(`${member.frameId}: ไม่พบชิ้นส่วนค้ำจากแบบเดิม`); continue; }
      const d = sub(member.end, member.start);
      const mesh = viewer.add(cad.geometry.hss(ctx.brace.B, ctx.brace.H, ctx.brace.tNom, Math.hypot(...d), member.start, unit(d)),
        template.id, template.kind, template.color, template.alpha, template.metal);
      mesh.instance = {...template.instance, sourceId: 'support-bracing-study', individuallyChecked: false};
      mesh.sc01SupportMember = copy(member);
    }
    const rendered = viewer.meshes.filter(m => m.sc01SupportMember).length;
    viewer.sc01SupportBracing = {...plan, rendered, analysis: 'NOT_ANALYSED_PER_FRAME', boqUnchanged: true};
    viewer.projectLayout.supportBracing = copy(viewer.sc01SupportBracing);
    const code = 'SC01_SUPPORT_TOPOLOGY_NOT_ANALYSED';
    const message = `VISIBLE LOWER BRACES ${rendered}/${plan.frameCount || ctx.frames.length}; concrete-column matches only. Retained C01/BOQ unchanged; per-frame, collector, column and foot connections NOT checked.`;
    if (!viewer.projectLayout.warningCodes.includes(code)) {
      viewer.projectLayout.warningCodes.push(code);
      viewer.projectLayout.warnings.push({code, state: 'hold', message});
    }
    viewer.warnings.push(message);
    viewer.draw();
  }

  const api = {VERSION, bounds, columnMatches, lowerPlan, upperPlan, crossesRoof, rodGeometry, context, correctLower};
  root.NCYSupportBracing = api;
  if (!root.document) return;
  const doc = root.document;
  let pending = false, activeStudy = null;
  const node = (tag, text, cls) => { const e = doc.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  const button = (label, handler, cls) => { const b = node('button', label, cls); b.type = 'button'; b.addEventListener('click', handler); return b; };

  function showScope(viewer) {
    const out = doc.getElementById('pickedPart');
    if (!out) return;
    const evidence = viewer.sc01SupportBracing;
    out.replaceChildren(node('strong', 'ตำแหน่ง 3D ตามเสาจริง · ยังไม่ตรวจแรงแยกรายแนว'),
      node('div', `แสดงค้ำล่าง ${evidence.rendered} จุด จาก ${evidence.frameCount} แนวโครง ไม่แสดงแรง C01 เดิมเป็นผลของแนวนี้ ต้องตรวจคานกลาง คานรวบแรง เสา และจุดยึดเพิ่มเติม`));
  }

  function sync() {
    const viewer = root.NCYApp?.getViewer?.(), area = doc.getElementById('viewerArea');
    if (!viewer || !area) return;
    const s = viewer.data?.state;
    let bar = doc.getElementById('sc01SupportBracing');
    if (!bar) {
      bar = node('section', '', 'sc01-support-bar'); bar.id = 'sc01SupportBracing';
      const details = node('details'), summary = node('summary'); summary.id = 'sc01SupportSummary';
      details.append(summary, node('p', '3D ผูกตำแหน่งกับหน้าเสาที่มีจริง ไม่ได้เพิ่มเสากลางหรือเปลี่ยนแรงคำนวณเดิม คานกลาง การรวบแรง เสา และจุดยึดต้องตรวจแยก ปริมาณ BOQ เดิมยังไม่ได้ปรับตามภาพนี้'));
      bar.append(details, button('↗ ลองเหล็กดึง / สลิงด้านบน', () => openStudy(viewerForStudy()), 'sc01-support-launch'));
      (doc.getElementById('projectLayoutStatus') || area.firstElementChild).after(bar);
    }
    const available = s?.v61?.supportType === 'dual_columns' && s?.v61?.systemType !== 'truss' &&
      ['project', 'support'].includes(viewer.v6Scene) && !!viewer.projectLayout;
    bar.hidden = !available;
    const evidence = viewer.sc01SupportBracing;
    doc.getElementById('sc01SupportSummary').textContent = evidence ?
      `ค้ำล่าง ${evidence.rendered} จุดตามเสาจริง / ${evidence.frameCount} แนวโครง · ยังไม่ตรวจแยกรายแนว` : 'รั้งจากยอดเสา · ทดลองรูปทรงแยกจากผลคำนวณ';
    bar.dataset.invalid = String(!!evidence?.errors.length);
    let error = bar.querySelector('.sc01-support-errors');
    if (!error) { error = node('p', '', 'sc01-support-errors'); bar.querySelector('details').append(error); }
    error.textContent = evidence?.errors.join(' · ') || ''; error.hidden = !error.textContent;
  }
  function schedule() { if (!pending) { pending = true; root.requestAnimationFrame(() => { pending = false; sync(); }); } }
  function viewerForStudy() { return root.NCYApp?.getViewer?.(); }

  function geometryPick(viewer, x, y) {
    const r = viewer.canvas.getBoundingClientRect();
    const origin = add(viewer.eye, add(mul(viewer.right, (x/r.width*2-1)*viewer.halfX), mul(viewer.up, (1-y/r.height*2)*viewer.halfY)));
    const direction = mul(viewer.direction, -1);
    let nearest = Infinity, hit = null;
    for (const mesh of viewer.meshes) {
      if (mesh.alpha < .5 || ['load', 'field', 'edge'].includes(mesh.kind)) continue;
      const p = mesh.g.p;
      for (let i = 0; i < p.length; i += 9) {
        const a = p.slice(i, i+3), e1 = sub(p.slice(i+3, i+6), a), e2 = sub(p.slice(i+6, i+9), a);
        const h = cross(direction, e2), det = dot(e1, h);
        if (Math.abs(det) < 1e-8) continue;
        const f = 1/det, s = sub(origin, a), u = f*dot(s,h);
        if (u < 0 || u > 1) continue;
        const q = cross(s,e1), v = f*dot(direction,q), t = f*dot(e2,q);
        if (v < 0 || u+v > 1 || t <= 0 || t >= nearest) continue;
        nearest = t; hit = mesh;
      }
    }
    viewer.selected = hit?.id || ''; viewer.draw(); return hit;
  }

  function openStudy(source) {
    if (activeStudy || !source?.projectLayout || source.data?.state?.v61?.supportType !== 'dual_columns' || source.data?.state?.v61?.systemType === 'truss') return;
    const ctx = context(source), cad = root.NCYCAD, returnFocus = doc.activeElement;
    const qa = new URLSearchParams(root.location.search).get('qa') === '1';
    // Local QA receipt only. Compare full values in memory; expose only the
    // boolean outcome, never project data or a supposedly approved snapshot.
    const projectSignature = () => {
      const app = root.NCYApp;
      return JSON.stringify([app.getState(), app.getResult(), app.getBOQ(), app.getFormulaSteps(), app.getRevision()]);
    };
    const before = qa ? projectSignature() : null;
    const geometry = source.meshes.filter(m => !m.sc01SupportMember && m.instance?.sourceId !== 'brace' &&
      !['load', 'field'].includes(m.kind)).map(m => ({g: copy(m.g), id: m.id, kind: m.kind, color: [...m.color], alpha: m.alpha, metal: m.metal}));
    const dialog = node('dialog', '', 'sc01-restraint-dialog'); dialog.id = 'sc01UpperStudy'; dialog.setAttribute('aria-labelledby', 'sc01UpperTitle');
    const header = node('header'), titleBox = node('div');
    titleBox.append(node('small', 'SC01 / ศึกษารูปทรงเท่านั้น'));
    const title = node('h2', 'เหล็กดึง / สลิงรั้งจากยอดเสา'); title.id = 'sc01UpperTitle'; titleBox.append(title);
    const close = button('กลับสู่งานเดิม ×', () => dialog.close()); header.append(titleBox, close);
    const note = node('p', 'ภาพทดลองแยกจากงานจริง · ยังไม่คำนวณแรงดึง/แรงลม จุดยึด และเสาต่อสูง · ไม่บันทึกหรือใช้ในรายงาน', 'sc01-study-scope');
    const body = node('div', '', 'sc01-study-body'), form = node('form', '', 'sc01-study-controls'); form.noValidate = true;
    form.append(node('h3', '1 เลือกรูปแบบและมิติภาพ'));
    const inputs = {};
    function field(key, label, type, value, min, max, step) {
      const wrap = node('label', label), input = node(type === 'select' ? 'select' : 'input');
      input.id = `sc01Study-${key}`; inputs[key] = input;
      if (type === 'select') for (const [v, label] of [['rod', 'เหล็กดึง (แท่งกลม)'], ['cable', 'สลิง (เส้นตรงเชิงสัญลักษณ์)']]) { const o = node('option', label); o.value = v; input.append(o); }
      else { input.type = 'number'; input.min = min; input.max = max; input.step = step; input.inputMode = 'decimal'; }
      input.value = value; wrap.append(input); form.append(wrap);
    }
    field('kind', 'ชนิดรั้งด้านบน', 'select', 'rod');
    field('riseM', 'ยกยอดเสาจากระดับเดิม (ม.)', 'number', '1.20', '.25', '5', '.05');
    field('attachM', 'จุดยึดห่างจากโคนคาน (ม.)', 'number', String(ctx.member.lengthM), '.25', String(ctx.member.lengthM), '.05');
    field('diameterMM', 'เส้นผ่านศูนย์กลางที่แสดง (มม.)', 'number', '16', '6', '60', '1');
    form.append(node('p', 'มิติเริ่มต้นเป็นตัวอย่างภาพ ไม่ใช่ขนาดที่เลือกให้ผ่าน จุดสีส้มเป็นตำแหน่งอ้างอิงบนเสา/ด้านข้างคาน ไม่ใช่แบบหัวจับ พุก หรือรอยเชื่อม', 'sc01-study-help'));
    const apply = node('button', '2 อัปเดตภาพ 3D', 'sc01-study-apply'); apply.type = 'submit'; form.append(apply);
    const status = node('p', '', 'sc01-study-result'); status.setAttribute('role', 'status'); status.id = 'sc01StudyStatus'; form.append(status);
    const stage = node('section', '', 'sc01-study-stage'), tools = node('div', '', 'sc01-study-tools');
    const canvasWrap = node('div', '', 'sc01-study-canvas-wrap'), canvas = node('canvas'); canvas.id = 'sc01StudyCanvas';
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'ภาพรั้งบน 3D ใช้ปุ่มบวกลบเพื่อซูม ลูกศรเพื่อหมุน และ Home เพื่อพอดีจอ');
    const stamp = node('span', 'ภาพทดลองเท่านั้น · ยังไม่ใช่ผลคำนวณ', 'sc01-study-watermark'); canvasWrap.append(canvas, stamp);
    const pick = node('p', 'หมุน: ลากภาพ · ซูม: ลูกกลิ้ง / สองนิ้ว / ปุ่ม + − · เลื่อน: Shift + ลาก', 'sc01-study-pick');
    stage.append(tools, canvasWrap, pick); body.append(form, stage);
    dialog.append(header, note, body); doc.body.append(dialog); dialog.showModal(); doc.body.classList.add('sc01-upper-study-open');
    let viewer;
    const fail = error => { status.textContent = `เปิดภาพไม่ได้: ${error.message} — กลับสู่งานเดิมได้โดยไม่เปลี่ยนข้อมูล`; };
    // The retained constructor reloads location on context restoration. This
    // separate study must never reload the user's underlying unsaved project.
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); event.stopImmediatePropagation();
      if (viewer) viewer.lost = true;
      status.textContent = 'ภาพ 3D หยุดทำงานชั่วคราว — ปิดตัวอย่างแล้วเปิดใหม่ ข้อมูลโครงการเดิมยังอยู่';
      stamp.textContent = 'ภาพไม่พร้อมใช้งาน · ปิดตัวอย่างแล้วเปิดใหม่';
    }, true);
    canvas.addEventListener('webglcontextrestored', event => {
      event.stopImmediatePropagation();
      status.textContent = 'ระบบภาพกลับมาแล้ว — ปิดตัวอย่างแล้วเปิดใหม่ โดยไม่โหลดโครงการเดิมซ้ำ';
    }, true);
    try { viewer = new cad.Viewer(canvas, null, null); } catch (error) { fail(error); }
    activeStudy = {dialog, viewer};
    function cleanup() {
      viewer?.dispose(); activeStudy = null; doc.body.classList.remove('sc01-upper-study-open'); dialog.remove();
      const bar = doc.getElementById('sc01SupportBracing');
      if (qa && bar) bar.dataset.studyProjectUnchanged = String(before === projectSignature());
      if (returnFocus?.isConnected) returnFocus.focus({preventScroll: true});
    }
    dialog.addEventListener('close', cleanup, {once: true});
    if (!viewer) return;
    // No data/result is assigned and no retained build/pick/overlay/report path
    // is called by this viewer. Main engine and project controller stay inert.
    viewer.renderOverlay = function () {};
    viewer.build = function () {};
    viewer.snapshot = function () { throw Error('UPPER_GEOMETRY_STUDY_NOT_A_CALCULATED_OUTPUT'); };
    viewer.pick = (x,y) => {
      const hit = geometryPick(viewer,x,y);
      pick.textContent = hit?.sc01Tie ? `${hit.sc01Tie.frameId} · ${hit.sc01Tie.kind === 'cable' ? 'สลิง' : 'เหล็กดึง'} Ø${hit.sc01Tie.diameterMM} มม. · ความยาวแนวศูนย์กลาง ${(hit.sc01Tie.lengthMM/1000).toFixed(2)} ม. · ยังไม่มีแรงดึงหรือกำลังรับแรง` : 'ชิ้นส่วนอ้างอิงจากภาพเดิม · ไม่ดึงแรง C01 มาใช้กับระบบรั้งบน';
      return hit?.id || null;
    };
    function zoom(k) { viewer.zoom = clamp(viewer.zoom*k, .15, 10); viewer.draw(); }
    tools.append(button('−', () => zoom(1/1.2)), button('+', () => zoom(1.2)), button('พอดีจอ', () => viewer.fit('iso')),
      button('ด้านข้าง', () => viewer.fit('side')), button('มุม 3D', () => viewer.fit('iso')));
    tools.children[0].setAttribute('aria-label','ย่อภาพรั้งบน'); tools.children[1].setAttribute('aria-label','ขยายภาพรั้งบน');
    canvas.addEventListener('keydown', event => {
      if (['+', '=', '-', 'Home', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault(); else return;
      if (event.key === '+' || event.key === '=') zoom(1.2);
      else if (event.key === '-') zoom(1/1.2);
      else if (event.key === 'Home') viewer.fit('iso');
      else { viewer.az += ({ArrowLeft: .1, ArrowRight: -.1}[event.key] || 0); viewer.el = clamp(viewer.el + ({ArrowUp: .1, ArrowDown: -.1}[event.key] || 0), -1.45, 1.45); viewer.draw(); }
    });
    function render() {
      const values = Object.fromEntries(Object.entries(inputs).map(([key,input]) => [key, input.value]));
      const plan = upperPlan(ctx, values);
      viewer.clear();
      // Fail visibly as an entire study, never leave a previously valid cable
      // on screen against new invalid/partial inputs.
      const valid = !plan.errors.length && plan.members.length > 0;
      for (const mesh of geometry) {
        const extension = valid && plan.extensions.find(e => e.columnId === mesh.id);
        const b = extension?.bounds;
        const g = b ? cad.geometry.box(b.min[0],b.max[0],b.min[1],b.max[1],b.min[2],b.max[2]) : mesh.g;
        viewer.add(g, mesh.id, mesh.kind, mesh.color, mesh.kind === 'concrete' ? .75 : mesh.alpha, mesh.metal);
      }
      if (valid) for (const tie of plan.members) {
        const m = viewer.add(rodGeometry(tie.start, tie.end, tie.diameterMM), `R17/${tie.frameId}/TIE`, 'steel', tie.kind === 'cable' ? [.26,.34,.40] : [.77,.49,.16], 1, .65);
        m.sc01Tie = tie;
        for (const [index,p] of [tie.start,tie.end].entries()) {
          const r = Math.max(18, tie.diameterMM / 2 + 5);
          viewer.add(cad.geometry.box(p[0]-r,p[0]+r,p[1]-r,p[1]+r,p[2]-r,p[2]+r), `R17/${tie.frameId}/REFERENCE-${index}`, 'steel', [.96,.43,.12], 1, .2);
        }
      }
      const b = bounds(viewer.meshes.flatMap(m => m.g.p));
      if (b) { viewer.bounds = b; viewer.fit('iso'); }
      status.dataset.valid = String(valid);
      status.textContent = valid ? `แสดง ${plan.members.length} จุดรั้งตามเสาจริง / ${ctx.frames.length} แนวโครง · ไม่มีค้ำล่างในภาพทดลองนี้ · ยังไม่คำนวณ ไม่ใช่ PASS` : `ยังไม่วาดรั้งบน: ${plan.errors.join(' · ')}`;
      canvas.dataset.studyValid = String(valid); canvas.dataset.tieCount = String(valid ? plan.members.length : 0);
      canvas.dataset.zoom = String(viewer.zoom);
      stamp.textContent = valid ? 'ภาพทดลองรั้งบน · ไม่ใช่แบบหรือผลคำนวณ' : 'ข้อมูลภาพไม่ครบ / ขัดแย้ง · ไม่แสดงรั้งบน';
      pick.textContent = 'หมุน: ลากภาพ · ซูม: ลูกกลิ้ง / สองนิ้ว / ปุ่ม + − · เลื่อน: Shift + ลาก';
    }
    form.addEventListener('submit', event => { event.preventDefault(); try { render(); } catch (error) { viewer.clear(); viewer.draw(); fail(error); } });
    form.addEventListener('input', () => { status.textContent = 'มิติยังไม่ได้อัปเดตภาพ — กด “2 อัปเดตภาพ 3D”'; stamp.textContent = 'ภาพก่อนแก้มิติ · รออัปเดตภาพ 3D'; });
    // QA-visible pose is a description of this canvas, never an engine input.
    const draw = viewer.draw;
    viewer.draw = function () { const out = draw.call(this); canvas.dataset.zoom = String(this.zoom); return out; };
    try { render(); } catch (error) { fail(error); }
  }

  function mount() {
    const cad = root.NCYCAD, app = root.NCYApp;
    if (!cad?.Viewer || !app?.getViewer) return;
    const proto = cad.Viewer.prototype;
    if (proto.sc01SupportBracingR17) return;
    proto.sc01SupportBracingR17 = true;
    const build = proto.build, pick = proto.pick, debug = proto.debug;
    proto.build = function () { const out = build.apply(this, arguments); correctLower(this, cad); schedule(); return out; };
    proto.pick = function () {
      if (!this.sc01SupportBracing) return pick.apply(this, arguments);
      const callback = this.onPick; this.onPick = () => {};
      let out; try { out = pick.apply(this, arguments); } finally { this.onPick = callback; }
      if (out) showScope(this); return out;
    };
    proto.debug = function () { return {...debug.call(this), supportBracing: this.sc01SupportBracing ? copy(this.sc01SupportBracing) : null}; };
    const viewer = app.getViewer();
    if (viewer) correctLower(viewer, cad);
    root.addEventListener('ncy:v5-updated', schedule);
    doc.addEventListener('click', () => schedule());
    schedule();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})(typeof window !== 'undefined' ? window : globalThis);
