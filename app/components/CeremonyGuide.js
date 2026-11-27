'use client';

import { useId, useState } from 'react';
import { funeralTerms } from '../data/funeralTerms.mjs';
import './ceremony-guide.css';

const occasions = {
  wedding: { label: '결혼식', hanja: '祝結婚', korean: '축결혼' },
  funeral: { label: '장례식', hanja: '賻儀', korean: '부의' },
};

function VerticalText({ value }) {
  return <span className="cg-vertical" aria-hidden="true">{Array.from(value).map((character, index) => <span key={index}>{character === ' ' ? '\u00a0' : character}</span>)}</span>;
}

export function EnvelopeGuide() {
  const [occasion, setOccasion] = useState('wedding');
  const [side, setSide] = useState('front');
  const [example, setExample] = useState('name');
  const [name, setName] = useState('김민수');
  const [affiliation, setAffiliation] = useState('엔씨 모임');
  const id = useId();
  const selected = occasions[occasion];
  const showAffiliation = example === 'company' && Boolean(affiliation.trim());
  const longestColumn = Math.max(Array.from(name).length, showAffiliation ? Array.from(affiliation).length : 0, 1);
  const backFontSize = Math.min(1.15, 9 / longestColumn) + 'rem';
  const description = side === 'front'
    ? selected.label + ' 봉투 앞면: 가운데에 ' + selected.hanja + ', 한글로는 ' + selected.korean + '이라고 씁니다.'
    : '봉투 뒷면: 바라보는 기준 왼쪽 아래에 이름 ' + (name || '(이름 없음)') + (showAffiliation ? ', 이름 오른쪽에 ' + affiliation : '') + '.';

  return (
    <section className="cg-root" aria-label="경조사 봉투 쓰는 법">
      <div className="cg-heading"><h2>경조사 봉투 쓰는 법</h2><p>봉투를 바라보는 방향을 기준으로, 일반적으로 쓰는 위치를 살펴보세요.</p></div>
      <div className="cg-switches" role="group" aria-label="경조사 선택">
        {Object.entries(occasions).map(([key, item]) => <button key={key} type="button" aria-pressed={occasion === key} onClick={() => setOccasion(key)}>{item.label}</button>)}
      </div>
      <div className="cg-switches" role="group" aria-label="봉투 면 선택">
        <button type="button" aria-pressed={side === 'front'} onClick={() => setSide('front')}>앞면</button>
        <button type="button" aria-pressed={side === 'back'} onClick={() => setSide('back')}>뒷면</button>
      </div>
      <div className="cg-layout">
        <div className="cg-envelope-wrap">
          <p className="cg-envelope-label">{selected.label} 봉투 · {side === 'front' ? '앞면' : '뒷면'}</p>
          <div className={'cg-envelope cg-envelope-' + side} role="img" aria-label={description}>
            {side === 'front' ? <div className="cg-front-writing" aria-hidden="true"><VerticalText value={selected.hanja} /></div> : <div className="cg-back-writing" style={{ fontSize: backFontSize }} aria-hidden="true"><VerticalText value={name} />{showAffiliation && <VerticalText value={affiliation} />}</div>}
          </div>
          <p className="cg-caption">{side === 'front' ? <>앞면 가운데 <strong>{selected.hanja}</strong> (한글 예시: {selected.korean})</> : '뒷면 왼쪽 아래에 이름, 소속을 함께 적을 때는 이름 오른쪽에 적는 예시입니다.'}</p>
        </div>
        <div className="cg-controls">
          <h3>뒷면 직접 써 보기</h3>
          <div className="cg-switches" role="group" aria-label="뒷면 예시 선택">
            <button type="button" aria-pressed={example === 'name'} onClick={() => setExample('name')}>이름만</button>
            <button type="button" aria-pressed={example === 'company'} onClick={() => setExample('company')}>회사명 + 이름</button>
          </div>
          <label htmlFor={id + '-name'}>이름</label>
          <input id={id + '-name'} value={name} onChange={(event) => setName(event.target.value)} maxLength={30} autoComplete="name" />
          <label htmlFor={id + '-affiliation'}>회사명 또는 모임명 (선택)</label>
          <input id={id + '-affiliation'} value={affiliation} onChange={(event) => { setAffiliation(event.target.value); setExample('company'); }} maxLength={30} autoComplete="organization" />
          <p className="cg-hint">소속을 입력하면 ‘회사명 + 이름’ 예시로 바뀝니다. 입력한 내용은 예시를 바꿔도 유지됩니다. 앞면을 보고 있다면 뒷면을 선택해 확인하세요.</p>
          {side === 'front' && <button className="cg-back-link" type="button" onClick={() => setSide('back')}>뒷면에서 확인하기</button>}
        </div>
      </div>
    </section>
  );
}

export function FuneralTerms({ onFindDictionary } = {}) {
  return <section className="cg-root cg-terms" aria-label="장례 용어">
    <div className="cg-heading"><h2>장례 용어</h2><p>낯선 장례 용어의 뜻을 먼저 살펴보세요.</p></div>
    <div className="cg-term-list">{funeralTerms.map(({ word, meaning, hanja }) => <article className="cg-term" key={word}>
      <h3>{word}</h3><p className="cg-term-meaning">{meaning}</p>{hanja && <p className="cg-term-hanja">한자: {hanja}</p>}
      {typeof onFindDictionary === 'function' && <button type="button" onClick={() => onFindDictionary(word)} aria-label={word + ' 사전에서 찾기'}>사전에서 찾기</button>}
    </article>)}</div>
  </section>;
}

