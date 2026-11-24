'use client';

import { useEffect, useRef, useState } from 'react';
import { categories, filterTemplates } from '../data/messageTemplates.mjs';
import { shareOccasionText } from '../lib/sharing.mjs';
import './message-templates.css';

export default function MessageTemplates({ onUse, onClose }) {
  const [categoryId, setCategoryId] = useState(categories[0].id);
  const [selected, setSelected] = useState(null);
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const revision = useRef(0);
  const shareInFlight = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const confirmRef = useRef(null);
  const [navigation, setNavigation] = useState({ target: null, sequence: 0 });

  useEffect(() => {
    const target = navigation.target === 'editor' ? editorRef.current : navigation.target === 'confirm' ? confirmRef.current : null;
    const focusTarget = navigation.target === 'editor' ? textareaRef.current : target;
    if (target && focusTarget) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      focusTarget.focus({ preventScroll: true });
    }
  }, [navigation]);

  function navigateTo(target) {
    setNavigation((current) => ({ target, sequence: current.sequence + 1 }));
  }

  function choose(template) {
    revision.current += 1;
    setSelected(template);
    setBody(template.body);
    setPending(null);
    setCopyStatus('');
    navigateTo('editor');
  }

  function requestSelection(template) {
    if (selected && body !== selected.body) {
      setPending(template);
      navigateTo('confirm');
    } else {
      choose(template);
    }
  }

  function editBody(event) {
    revision.current += 1;
    setBody(event.target.value);
    setCopyStatus('');
  }

  async function copyBody() {
    const currentRevision = revision.current;
    setCopyStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(body);
      if (revision.current === currentRevision) setCopyStatus('복사했습니다.');
    } catch {
      if (revision.current === currentRevision) {
        setCopyStatus('복사하지 못했습니다. 편집창의 글을 직접 선택해 복사하거나 다시 시도해 주세요.');
      }
    }
  }

  async function shareBody() {
    if (shareInFlight.current || !body.trim()) return;
    const currentRevision = revision.current;
    shareInFlight.current = true;
    setIsSharing(true);
    setCopyStatus('');
    try {
      const result = await shareOccasionText(body, navigator);
      if (revision.current === currentRevision) setCopyStatus(result.message);
    } catch {
      if (revision.current === currentRevision) setCopyStatus('공유창을 열지 못했습니다. 문구 복사 버튼을 이용해 주세요.');
    } finally {
      shareInFlight.current = false;
      setIsSharing(false);
    }
  }

  return (
    <section className="mt-root" aria-label="경조사 문구 예문">
      <div className="mt-heading">
        <div>
          <h2>경조사 문구</h2>
          <p>상황과 관계에 맞게 고쳐 쓰는 예문입니다. 자동 발송되지 않습니다.</p>
        </div>
        {onClose && <button type="button" className="mt-button mt-close" onClick={onClose}>닫기</button>}
      </div>
      <div className="mt-categories" role="group" aria-label="문구 범주">
        {categories.map((category) => (
          <button type="button" className="mt-category" aria-pressed={categoryId === category.id} key={category.id} onClick={() => setCategoryId(category.id)}>
            {category.label}
          </button>
        ))}
      </div>
      <div className="mt-list" aria-label="문구 목록">
        {filterTemplates(categoryId).map((template) => (
          <article className="mt-card" key={template.id}>
            <h3>{template.label}</h3>
            <p className="mt-preview">{template.body}</p>
            {template.note && <p className="mt-note">{template.note}</p>}
            <button type="button" className="mt-button" onClick={() => requestSelection(template)} aria-label={`${template.label} 문구 선택`}>선택</button>
          </article>
        ))}
      </div>
      {pending && (
        <div className="mt-confirm" ref={confirmRef} tabIndex={-1} role="group" aria-label="편집 내용 변경 확인">
          <p>편집한 내용이 있습니다. 다른 문구를 선택하면 편집한 내용이 사라집니다. 바꾸시겠어요?</p>
          <div className="mt-actions">
            <button type="button" className="mt-button" onClick={() => choose(pending)}>확인</button>
            <button type="button" className="mt-button" onClick={() => { setPending(null); navigateTo('editor'); }}>취소</button>
          </div>
        </div>
      )}
      {selected && (
        <div className="mt-editor" ref={editorRef}>
          <p>선택한 문구: {categories.find((category) => category.id === selected.categoryId)?.label} · {selected.label}</p>
          <label htmlFor="mt-message-body">문구 편집</label>
          <textarea id="mt-message-body" ref={textareaRef} value={body} onChange={editBody} rows={5} />
          <p className="mt-count">{Array.from(body).length}자</p>
          <div className="mt-actions">
            <button type="button" className="mt-button" disabled={!body.trim()} onClick={copyBody}>문구 복사</button>
            <button type="button" className="mt-button mt-primary" disabled={!body.trim() || typeof onUse !== 'function'} onClick={() => onUse(body)}>맞춤법 검사에 넣기</button>
          </div>
          <button type="button" className="mt-button mt-share" disabled={!body.trim() || isSharing} onClick={shareBody}>{isSharing ? '공유창 여는 중...' : '카톡·문자로 보내기'}</button>
          <p className="mt-share-hint">공유창에서 카카오톡이나 문자 앱을 선택하고, 받는 사람과 내용을 확인한 뒤 직접 전송해 주세요.</p>
          <p className="mt-status" role="status" aria-live="polite">{copyStatus}</p>
        </div>
      )}
    </section>
  );
}
