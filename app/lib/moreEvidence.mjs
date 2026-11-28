// 기존 후보만 자료 검색합니다. 원문 전체에 대한 AI 검사를 다시 실행하지 않습니다.
import { verifyInBatches } from './checkFlow.mjs';
import { contextOf } from './corrections.mjs';

export function pendingEvidenceItems(original, errors, verify = {}) {
  return (Array.isArray(errors) ? errors : []).filter(e => {
    if (!e || e.manual || e.overlap || !Number.isInteger(e.start) || !Number.isInteger(e.end)) return false;
    // 검토 필요와 별개로, 이미 추가 검색을 마친 동일 후보는 비용을 들여 반복 검색하지 않습니다.
    if (verify[e.id]?.additionalEvidenceComplete === true) return false;
    if (e.start < 0 || e.end <= e.start || original.slice(e.start,e.end) !== e.wrong) return false;
    return e.status === 'needs_review' || verify[e.id]?.verificationFailed === true;
  }).map(e => ({ id:e.id, wrong:e.wrong, right:e.right, rule:e.rule || '', context:contextOf(original,e) }));
}

export async function searchPendingEvidence(items, previous, options = {}) {
  const verify = options.verify || verifyInBatches;
  const results = {...previous};
  if (!items.length) return {results, failures:0};
  options.onStage?.('nikl');
  const official = await verify('nikl',items,{signal:options.signal});
  if (options.signal?.aborted) throw new DOMException('검색 취소','AbortError');
  const unresolved = []; let failures = 0;
  for (const item of items) {
    const matches=official.filter(v=>v && String(v.id)===String(item.id));
    const v=matches.length===1 ? matches[0] : null;
    if (!v || v.verificationFailed) { failures++; continue; }
    if (v.source === 'none') unresolved.push(item); else results[item.id]={...v, additionalEvidenceComplete:true};
  }
  if (unresolved.length) {
    options.onStage?.('web');
    const web=await verify('web',unresolved,{signal:options.signal});
    if (options.signal?.aborted) throw new DOMException('검색 취소','AbortError');
    for (const item of unresolved) {
      const matches=web.filter(v=>v && String(v.id)===String(item.id));
      const v=matches.length===1 ? matches[0] : null;
      if (!v || v.verificationFailed) {failures++; continue;}
      results[item.id]={...v, additionalEvidenceComplete:true};
    }
  }
  return {results, failures};
}
