// All positions are UTF-16 offsets in the unchanged original string.
const valid = (text, e) => Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start && e.end <= text.length && text.slice(e.start, e.end) === e.wrong;

export function anchorEdits(original, candidates = []) {
  original = String(original ?? '');
  const errors = [];
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (!candidate || typeof candidate.wrong !== 'string' || !candidate.wrong || typeof candidate.right !== 'string' || candidate.wrong === candidate.right) continue;
    const e = { ...candidate };
    const before = typeof e.anchorBefore === 'string' ? e.anchorBefore : (typeof e.before === 'string' ? e.before : '');
    const after = typeof e.anchorAfter === 'string' ? e.anchorAfter : (typeof e.after === 'string' ? e.after : '');
    const anchorsMatch = i => (!before || original.slice(Math.max(0, i - before.length), i) === before) && (!after || original.slice(i + e.wrong.length, i + e.wrong.length + after.length) === after);
    let start = valid(original, e) && anchorsMatch(e.start) ? e.start : -1;
    if (start < 0) {
      const occurrences = [];
      for (let i = original.indexOf(e.wrong); i !== -1; i = original.indexOf(e.wrong, i + 1)) occurrences.push(i);
      const matched = occurrences.filter(anchorsMatch);
      if (matched.length === 1) start = matched[0];
      // 유일한 원문 일치는 잘못 생성된 앞뒤 단서와 무관하게 위치가 확정됩니다.
      else if (occurrences.length === 1) start = occurrences[0];
    }
    e.start = start < 0 ? null : start;
    e.end = start < 0 ? null : start + e.wrong.length;
    // 위치가 확정된 동일 후보만 합친다. 위치 미확정이나 다른 제안은 보류 대상으로 남긴다.
    if (start >= 0 && errors.some(existing => existing.start === e.start && existing.end === e.end && existing.wrong === e.wrong && existing.right === e.right)) continue;
    // 다음 처리 단계에는 AI가 쓴 단서가 아니라 확인된 원문의 단서를 전달합니다.
    if (start >= 0) {
      e.anchorBefore = original.slice(Math.max(0, start - 20), start);
      e.anchorAfter = original.slice(e.end, e.end + 20);
    }
    e.status = start < 0 || e.status === 'needs_review' ? 'needs_review' : (e.status || 'pending');
    e.id = 'edit-' + (start < 0 ? 'unresolved' : start + '-' + e.end) + '-' + errors.length;
    errors.push(e);
  }
  for (let i = 0; i < errors.length; i++) for (let j = i + 1; j < errors.length; j++) {
    const a = errors[i], b = errors[j];
    if (a.start !== null && b.start !== null && a.start < b.end && b.start < a.end) {
      a.status = b.status = 'needs_review'; a.overlap = b.overlap = true;
    }
  }
  return errors;
}

export function buildCorrection(original, errors = []) {
  original = String(original ?? '');
  const eligible = (Array.isArray(errors) ? errors : []).filter(e => e && valid(original, e) && typeof e.right === 'string' && e.right !== e.wrong && e.manual !== 'keep' && (e.manual === 'apply' || e.status === 'applied') && !e.overlap);
  // Reject every member of an overlap, regardless of input order.
  const safe = eligible.filter((e, i) => !eligible.some((x, j) => i !== j && e.start < x.end && x.start < e.end)).sort((a,b) => a.start - b.start);
  const segments = []; let cursor = 0;
  for (const e of safe) {
    if (cursor < e.start) segments.push({ text: original.slice(cursor, e.start), marked: false });
    segments.push({ text: e.right, marked: true, id: e.id }); cursor = e.end;
  }
  if (cursor < original.length) segments.push({ text: original.slice(cursor), marked: false });
  return { text: segments.map(s => s.text).join(''), segments, appliedCount: safe.length };
}

export function contextOf(original, error) {
  if (!error || !valid(original, error)) return '';
  return original.slice(Math.max(0, error.start - 40), Math.min(original.length, error.end + 40));
}

export function splitTextWithContext(original, maxTarget = 500, contextSize = 120) {
  original = String(original ?? '');
  const max = Math.max(1, Math.floor(Number(maxTarget) || 500));
  const context = Math.max(0, Math.floor(Number(contextSize) || 0));
  const chunks = []; let start = 0;
  while (start < original.length) {
    let end = Math.min(start + max, original.length);
    if (end < original.length) {
      const window = original.slice(start, end); let best = -1;
      for (const pattern of [/\n+/g, /[.!?。！？][\s]*/g, /\s+/g]) {
        let m, last = -1; while ((m = pattern.exec(window))) last = m.index + m[0].length;
        if (last >= Math.max(1, Math.floor(max * 0.4))) { best = last; break; }
      }
      if (best > 0) end = start + best;
      // Avoid splitting a surrogate pair when possible.
      if (end < original.length && end > start && /[\uD800-\uDBFF]/.test(original[end-1]) && /[\uDC00-\uDFFF]/.test(original[end])) end = end - 1 > start ? end - 1 : end + 1;
    }
    chunks.push({ start, end, text: original.slice(start, end), contextBefore: original.slice(Math.max(0, start-context), start), contextAfter: original.slice(end, Math.min(original.length,end+context)) });
    start = end;
  }
  return chunks;
}
