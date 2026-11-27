'use client';

import { useEffect, useRef, useState } from 'react';
import { categories, filterTemplates } from '../data/messageTemplates.mjs';
import { shareOccasionText } from '../lib/sharing.mjs';
import { EnvelopeGuide, FuneralTerms } from './CeremonyGuide';
import './message-templates.css';

export default function MessageTemplates({ onUse, onClose, onFindDictionary }) {
  const [categoryId, setCategoryId] = useState(categories[0].id);
  const [length, setLength] = useState('short');
  const [tab, setTab] = useState('write');
  const [selected, setSelected] = useState(() => filterTemplates(categories[0].id, 'short')[0] || null);
  const [body, setBody] = useState(() => filterTemplates(categories[0].id, 'short')[0]?.body || '');
  const [pending, setPending] = useState(null);
  const [copyStatus, setCopyStatus] = useState('');
  const revision = useRef(0);
  const shareInFlight = useRef(false);
  const [isSharing, setIsSharing] = useState(false);
  const editorRef = useRef(null);
  const textareaRef = useRef(null);
  const confirmRef = useRef(null);
  const [navigation, setNavigation] = useState({ target: null, sequence: 0 });
  const edited = selected && body !== selected.body;

  useEffect(() => {
    const target = navigation.target === 'editor' ? editorRef.current : navigation.target === 'confirm' ? confirmRef.current : null;
    const focusTarget = navigation.target === 'editor' ? textareaRef.current : target;
    if (target && focusTarget) {
      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      focusTarget.focus({ preventScroll: true });
    }
  }, [navigation]);

  function navigateTo(target) { setNavigation((current) => ({ target, sequence: current.sequence + 1 })); }
  function applyAction(action) {
    setPending(null);
    if (action.kind === 'tab') { setTab(action.value); return; }
    let template = action.template;
    if (action.kind === 'category') {
      setCategoryId(action.value);
      template = filterTemplates(action.value, length)[0] || null;
    } else if (action.kind === 'length') {
      setLength(action.value);
      template = filterTemplates(categoryId, action.value)[0] || null;
    }
    revision.current += 1;
    setSelected(template);
    setBody(template?.body || '');
    setCopyStatus('');
    if (action.kind === 'template') navigateTo('editor');
  }
  function requestAction(action) {
    if ((action.kind === 'category' && action.value === categoryId) ||
        (action.kind === 'length' && action.value === length) ||
        (action.kind === 'tab' && action.value === tab)) return;
    if (action.kind === 'template' && action.template.id === selected?.id) {
      navigateTo('editor');
      return;
    }
    if (edited) { setPending(action); navigateTo('confirm'); }
    else applyAction(action);
  }
  function editBody(event) { revision.current += 1; setBody(event.target.value); setCopyStatus(''); }
  async function copyBody() {
    const currentRevision = revision.current;
    setCopyStatus('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(body);
      if (revision.current === currentRevision) setCopyStatus('복사했습니다.');
    } catch {
      if (revision.current === currentRevision) {
        textareaRef.current?.focus();
        textareaRef.current?.select();
        setCopyStatus('자동 복사하지 못했습니다. 선택된 글을 Ctrl+C 또는 길게 눌러 복사해 주세요.');
      }
    }
  }
  async function shareBody() {
    if (shareInFlight.current || !body.trim()) return;
    const currentRevision = revision.current;
    shareInFlight.current = true; setIsSharing(true); setCopyStatus('');
    try {
      const result = await shareOccasionText(body, navigator);
      if (revision.current === currentRevision) setCopyStatus(result.message);
    } catch {
      if (revision.current === currentRevision) setCopyStatus('공유창을 열지 못했습니다. 문구 복사 버튼을 이용해 주세요.');
    } finally { shareInFlight.current = false; setIsSharing(false); }
  }

  return (
    <section className="mt-root" aria-label="경조사 문구 예문">
      <div className="mt-heading"><div><h2>경조사 문구</h2><p>상황과 관계에 맞게 고쳐 쓰는 예문입니다. 자동 발송되지 않습니다.</p></div>
        {onClose && <button type="button" className="mt-button mt-close" onClick={onClose}>닫기</button>}
      </div>
      <nav className="mt-tabs" aria-label="경조사 안내 선택">
        {[['write', '문구 작성'], ['envelope', '봉투 쓰는 법'], ['terms', '부고 용어']].map(([id, label]) =>
          <button type="button" className="mt-category" key={id} aria-pressed={tab === id} onClick={() => requestAction({kind:'tab', value:id})}>{label}</button>)}
      </nav>
      {pending && <div className="mt-confirm" ref={confirmRef} tabIndex={-1} role="group" aria-label="편집 내용 변경 확인">
        <p>{pending.kind === 'tab' ? '편집한 문구가 있습니다. 이동해도 편집 내용은 유지됩니다. 이동하시겠어요?' : '편집한 내용이 있습니다. 바꾸면 편집한 내용이 사라집니다. 바꾸시겠어요?'}</p>
        <div className="mt-actions"><button type="button" className="mt-button" onClick={() => applyAction(pending)}>확인</button>
          <button type="button" className="mt-button" onClick={() => { setPending(null); if (tab === 'write') navigateTo('editor'); }}>취소</button></div>
      </div>}
      {tab === 'envelope' && <EnvelopeGuide />}
      {tab === 'terms' && <FuneralTerms onFindDictionary={onFindDictionary} />}
      <div hidden={tab !== 'write'}>
        <div className="mt-categories" role="group" aria-label="문구 범주">
          {categories.map((category) => <button type="button" className="mt-category" aria-pressed={categoryId === category.id} key={category.id} onClick={() => requestAction({kind:'category', value:category.id})}>
            {category.id === 'bereavement-comfort' ? '부고 받고 보내는 위로' : category.id === 'funeral-gratitude' ? '장례 마친 사람이 감사' : category.label}
          </button>)}
        </div>
        <div className="mt-length" role="group" aria-label="문구 길이">
          {[['short','짧게'], ['long','정성스럽게']].map(([id,label]) => <button type="button" className="mt-category" key={id} aria-pressed={length === id} onClick={() => requestAction({kind:'length',value:id})}>{label}</button>)}
        </div>
        <div className="mt-list" aria-label="문구 목록">
          {filterTemplates(categoryId, length).map((template) => <article className="mt-card" key={template.id}>
            <h3>{template.label}{template.tone === 'friend' && !template.label.includes('친구') ? ' · 친구에게' : template.tone === 'formal' ? ' · 존댓말' : ''}</h3><p className="mt-preview">{template.body}</p>
            {template.note && <p className="mt-note">{template.note}</p>}
            <button type="button" className="mt-button" aria-pressed={selected?.id === template.id} onClick={() => requestAction({kind:'template',template})} aria-label={`${template.label} 문구 선택`}>{selected?.id === template.id ? '선택됨' : '선택'}</button>
          </article>)}
        </div>
        {selected && <div className="mt-editor" ref={editorRef}>
          <p>선택한 문구: {categories.find((category) => category.id === selected.categoryId)?.label} · {selected.label}</p>
          <label htmlFor="mt-message-body">문구 편집</label><textarea id="mt-message-body" ref={textareaRef} value={body} onChange={editBody} rows={5} />
          <p className="mt-count">{Array.from(body).length}자</p>
          <div className="mt-actions"><button type="button" className="mt-button" disabled={!body.trim()} onClick={copyBody}>문구 복사</button>
            <button type="button" className="mt-button mt-primary" disabled={!body.trim() || typeof onUse !== 'function'} onClick={() => onUse(body)}>맞춤법 검사에 넣기</button></div>
          <button type="button" className="mt-button mt-share" disabled={!body.trim() || isSharing} onClick={shareBody}>{isSharing ? '공유창 여는 중...' : '카톡·문자로 보내기'}</button>
          <p className="mt-share-hint">공유창에서 카카오톡이나 문자 앱을 선택하고, 받는 사람과 내용을 확인한 뒤 직접 전송해 주세요.</p>
          <p className="mt-status" role="status" aria-live="polite">{copyStatus}</p>
        </div>}
      </div>
    </section>
  );
}
