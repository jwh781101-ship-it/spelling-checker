'use client';
import { useEffect, useState } from 'react';
import { clampReviewIndex, locationIssue, reviewContext, reviewState } from '../lib/review.mjs';
import './easy-review.css';

function ContextLine({ context, target }) {
  return <p className="er-context">{context.truncatedStart && '…'}{context.prefix}<mark>{target}</mark>{context.suffix}{context.truncatedEnd && '…'}</p>;
}
function ReviewItem({ error, index, count, original, errors, verify, verifyStage, onChoose, renderDetails, onPrevious, onNext }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const issue = locationIssue(original, error, errors);
  const context = reviewContext(original, error, 40, true);
  const state = reviewState(error, verify?.[error.id], verifyStage, !issue);
  return <section className="er-review" aria-label={`수정 ${index + 1}/${count}`}>
    <h3 className="er-heading">수정 {index + 1}/{count}</h3>
    <p className="er-status" role="status">{state.label}</p>
    {context && <p className="er-hint">현재 항목만 비교합니다. 전체 결과는 위 교정된 글에서 확인하세요.</p>}
    {context ? <div className="er-comparison">
      <div className="er-line"><h4>원문</h4><ContextLine context={context} target={context.target} /></div>
      <div className="er-line"><h4>수정 제안</h4><ContextLine context={context} target={typeof error.right === 'string' ? error.right : ''} /></div>
    </div> : <p className="er-warning">해당 부분의 문맥을 표시할 수 없어요.</p>}
    {issue && <p className="er-warning">{issue} 원문은 유지할 수 있어요.</p>}
    {state.uncertain && <p className="er-warning">자료 근거가 아직 확인되지 않았거나 대조 중이에요. 제안이 틀릴 수 있으니 직접 살펴봐 주세요.</p>}
    {(error.explain || error.reason) && <p className="er-reason"><strong>이유: </strong>{error.explain || error.reason}</p>}
    <div className="er-choices" aria-label="수정 선택">
      <button type="button" className="er-choice" aria-pressed={state.selection === 'keep'} onClick={() => onChoose?.(error.id, 'keep')}>원문 유지</button>
      <button type="button" className="er-choice" aria-pressed={state.selection === 'apply'} disabled={!!issue} onClick={() => onChoose?.(error.id, 'apply')}>수정 사용</button>
    </div>
    <details className="er-details" onToggle={event => setDetailsOpen(event.currentTarget.open)}>
      <summary>상세 규정과 검증 출처</summary>
      {detailsOpen && typeof renderDetails === 'function' && renderDetails(error, index)}
    </details>
    <nav className="er-nav" aria-label="수정 항목 이동">
      <button type="button" disabled={index === 0} onClick={onPrevious}>이전 수정</button>
      <button type="button" disabled={index === count - 1} onClick={onNext}>다음 수정</button>
    </nav>
  </section>;
}
// Parent mounts only while result exists and owns all correction state.
export default function EasyReview({ original, errors, verify, verifyStage, onChoose, renderDetails }) {
  const [index, setIndex] = useState(0);
  const list = Array.isArray(errors) ? errors : [];
  const safeIndex = clampReviewIndex(index, list);
  // Async verification replaces the array; IDs/order, not object identity, identify a new list.
  const identity = JSON.stringify(list.map(e => e?.id));
  useEffect(() => { setIndex(0); }, [original, identity]);
  if (!list.length) return <section className="er-review"><p>확인할 수정 제안이 없어요.</p></section>;
  const error = list[safeIndex];
  if (!error) return null;
  return <ReviewItem key={`${identity}:${safeIndex}`} error={error} index={safeIndex} count={list.length} original={original} errors={list} verify={verify} verifyStage={verifyStage} onChoose={onChoose} renderDetails={renderDetails} onPrevious={() => setIndex(i => clampReviewIndex(i - 1, list))} onNext={() => setIndex(i => clampReviewIndex(i + 1, list))} />;
}
