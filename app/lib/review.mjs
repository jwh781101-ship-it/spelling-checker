// Offsets are UTF-16 code units in the unchanged original.
export function validLocation(original, e) {
  return typeof original === 'string' && !!e && typeof e.wrong === 'string' && !!e.wrong && Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 && e.end > e.start && e.end <= original.length && original.slice(e.start, e.end) === e.wrong;
}
export function locationIssue(original, e, errors = []) {
  if (!validLocation(original, e)) return '원문에서 정확한 위치를 확인할 수 없어 수정할 수 없어요.';
  if (e.overlap || (Array.isArray(errors) && errors.some(x => x && x !== e && validLocation(original, x) && e.start < x.end && x.start < e.end))) return '다른 제안과 위치가 겹쳐 수정할 수 없어요.';
  if (typeof e.right !== 'string' || e.right === e.wrong) return '사용할 수정 제안을 확인할 수 없어요.';
  return '';
}
export function reviewContext(original, e, radius = 70) {
  if (!validLocation(original, e)) return null;
  const size = Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 70;
  let left = Math.max(0, e.start - size), right = Math.min(original.length, e.end + size);
  if (left > 0 && /[\uDC00-\uDFFF]/.test(original[left]) && /[\uD800-\uDBFF]/.test(original[left - 1])) left--;
  if (right < original.length && /[\uD800-\uDBFF]/.test(original[right - 1]) && /[\uDC00-\uDFFF]/.test(original[right])) right++;
  return { prefix: original.slice(left, e.start), target: original.slice(e.start, e.end), suffix: original.slice(e.end, right), truncatedStart: left > 0, truncatedEnd: right < original.length };
}
export function clampReviewIndex(index, errors) {
  const count = Array.isArray(errors) ? errors.length : 0;
  return count ? Math.min(Math.max(Number.isInteger(index) ? index : 0, 0), count - 1) : 0;
}
export function reviewState(e, verification, stage, safe = true) {
  if (!e) return { selection: 'keep', label: '원문 유지' };
  const applied = safe && e.manual !== 'keep' && (e.manual === 'apply' || e.status === 'applied');
  let label;
  if (e.manual === 'keep') label = '사용자 선택 · 원문 유지';
  else if (e.manual === 'apply' && safe) label = '사용자 선택 · 수정 사용';
  else if (!safe) label = '위치 확인 필요 · 원문 유지';
  else if (e.status === 'applied') label = 'AI 자료 대조 반영 · 수정 사용';
  else if (e.status === 'kept' && verification?.verdict === '둘다가능') label = '원문도 허용됨 · 원문 유지';
  else if (e.status === 'kept') label = '자료 대조 결과 · 원문 유지';
  else if (e.status === 'pending' || ((!e.status || e.status === 'needs_review') && (stage === 'nikl' || stage === 'web') && !verification)) label = '자료 대조 중 · 원문 유지';
  else label = '근거 미확인 · 원문 유지';
  const uncertain = e.status === 'pending' || e.status === 'needs_review' || !e.status || verification?.source === 'none' || !!verification?.verificationFailed;
  return { selection: applied ? 'apply' : 'keep', label, uncertain };
}
