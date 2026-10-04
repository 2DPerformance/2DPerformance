// Data-only annotation boundary, shared by rendering and project-file import.
export const ANNOTATION_COLORS = new Set([
  'oklch(60% 0.2 350)', 'oklch(52% 0.2 28)', 'oklch(62% 0.16 70)',
  'oklch(57% 0.19 255)', 'oklch(53% 0.15 145)', '#111827', '#ffffff', '#facc15',
]);
const styles = a => {
  const out = {};
  for (const [key, min, max] of [['strokeWidth', 1, 48], ['opacity', 0.1, 1], ['fontSize', 8, 120]]) {
    if (a[key] == null) continue;
    if (typeof a[key] !== 'number' || !Number.isFinite(a[key]) || a[key] < min || a[key] > max) throw new Error('รูปแบบความหนา/ความเข้ม/ขนาดข้อความไม่ถูกต้อง');
    out[key] = a[key];
  }
  return out;
};
export function sanitizeAnnotations(input, size) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 500) throw new Error('รองรับมาร์กไม่เกิน 500 ชิ้นต่อรายการ');
  if (!Array.isArray(size) || size.length !== 2 || !size.every(n => Number.isSafeInteger(n) && n > 0 && n <= 10000)) throw new Error('ขนาดแปลนไม่ถูกต้อง');
  const [width, height] = size;
  const finitePoint = (value, limit) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= limit;
  const point = (a, x, y) => {
    if (!finitePoint(a[x], width) || !finitePoint(a[y], height)) throw new Error('จุดมาร์กอยู่นอกแปลนหรือไม่ถูกต้อง');
    return [a[x], a[y]];
  };
  return input.map(a => {
    if (!a || typeof a !== 'object' || Array.isArray(a)) throw new Error('ข้อมูลมาร์กไม่ถูกต้อง');
    const { type, color } = a;
    if (!ANNOTATION_COLORS.has(color)) throw new Error('สีมาร์กไม่รองรับ');
    const style = styles(a);
    if (['pen', 'brush'].includes(type)) {
      if (!Array.isArray(a.pts) || a.pts.length < 2 || a.pts.length > 5000) throw new Error('เส้นมาร์กต้องมี 2–5000 จุด');
      const pts = a.pts.map(p => {
        if (!Array.isArray(p) || p.length !== 2 || !finitePoint(p[0], width) || !finitePoint(p[1], height)) throw new Error('จุดเส้นมาร์กไม่ถูกต้อง');
        return [...p];
      });
      return { type, color, pts, ...style };
    }
    const [x0, y0] = point(a, 'x0', 'y0');
    if (['pin', 'text'].includes(type)) {
      if (typeof a.text !== 'string' || !a.text.trim() || a.text.trim().length > 240) throw new Error('ข้อความต้องยาว 1–240 ตัวอักษร');
      return { type, color, x0, y0, text: a.text.trim(), ...style };
    }
    if (!['highlight', 'rect', 'arrow', 'ellipse', 'line'].includes(type)) throw new Error('ชนิดมาร์กไม่รองรับ');
    const [x1, y1] = point(a, 'x1', 'y1');
    return { type, color, x0, y0, x1, y1, ...style };
  });
}
const escape = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function renderAnnotation(input, size) {
  const a = sanitizeAnnotations([input], size)[0];
  const W = size[0], c = a.color, w = a.strokeWidth ?? 3;
  const opacity = a.opacity ?? (a.type === 'highlight' || a.type === 'brush' ? 0.28 : 1);
  const stroke = `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  let shape = '';
  if (['pen', 'brush'].includes(a.type)) shape = `<polyline points="${a.pts.map(p => p.join(',')).join(' ')}" ${stroke}/>`;
  else if (['pin', 'text'].includes(a.type)) {
    const r = W / 92, fs = a.fontSize == null ? W / 46 : a.fontSize * W / 1400;
    const x = a.x0 + (a.type === 'pin' ? r * 1.5 : 0), y = a.y0 + fs * 0.34;
    const pin = a.type === 'pin' ? `<circle cx="${a.x0}" cy="${a.y0}" r="${r}" fill="var(--paper,white)" stroke="${c}" stroke-width="2" vector-effect="non-scaling-stroke"/>` : '';
    shape = `${pin}<text x="${x}" y="${y}" font-size="${fs}" fill="${c}" font-weight="700" paint-order="stroke" stroke="var(--paper,white)" stroke-width="${a.fontSize == null ? 6 : fs * 0.15}" stroke-linejoin="round">${escape(a.text)}</text>`;
  } else {
    const x = Math.min(a.x0, a.x1), y = Math.min(a.y0, a.y1), width = Math.abs(a.x1 - a.x0), height = Math.abs(a.y1 - a.y0);
    if (a.type === 'highlight') shape = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="6" fill="${c}"/>`;
    else if (a.type === 'rect') shape = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" ${stroke}/>`;
    else if (a.type === 'ellipse') shape = `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}" ${stroke}/>`;
    else {
      shape = `<line x1="${a.x0}" y1="${a.y0}" x2="${a.x1}" y2="${a.y1}" ${stroke}/>`;
      if (a.type === 'arrow') {
        const angle = Math.atan2(a.y1 - a.y0, a.x1 - a.x0), length = W * 0.022;
        shape += `<polygon points="${a.x1},${a.y1} ${a.x1 - length * Math.cos(angle - 0.42)},${a.y1 - length * Math.sin(angle - 0.42)} ${a.x1 - length * Math.cos(angle + 0.42)},${a.y1 - length * Math.sin(angle + 0.42)}" fill="${c}"/>`;
      }
    }
  }
  return `<g opacity="${opacity}">${shape}</g>`;
}

// History is scoped by the evidence object. Image replacement/import changes
// the identity or source key and starts a fresh history, preventing old marks
// from being restored onto a different drawing.
export function createAnnotationHistory(limit = 40) {
  const states = new WeakMap();
  const state = ctx => {
    const key = `${ctx.evidenceHash || ctx.image || ''}|${ctx.size?.join(',')}`;
    let s = states.get(ctx);
    if (!s || s.key !== key) { s = { key, undo: [], redo: [] }; states.set(ctx, s); }
    return s;
  };
  const clone = list => structuredClone(list || []);
  return {
    reset: ctx => { if (ctx) states.delete(ctx); },
    canUndo: ctx => !!ctx && (state(ctx).undo.length > 0 || (ctx.userAnno?.length || 0) > 0),
    canRedo: ctx => !!ctx && state(ctx).redo.length > 0,
    commit: (ctx, next) => { const s = state(ctx); s.undo.push(clone(ctx.userAnno)); if (s.undo.length > limit) s.undo.shift(); s.redo = []; ctx.userAnno = clone(next); },
    undo: ctx => { const s = state(ctx); if (!s.undo.length && !ctx.userAnno?.length) return false; s.redo.push(clone(ctx.userAnno)); ctx.userAnno = s.undo.length ? s.undo.pop() : clone(ctx.userAnno.slice(0, -1)); return true; },
    redo: ctx => { const s = state(ctx); if (!s.redo.length) return false; s.undo.push(clone(ctx.userAnno)); ctx.userAnno = s.redo.pop(); return true; },
  };
}
