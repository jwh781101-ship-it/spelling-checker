'use client';
import { useState, useEffect, useRef } from 'react';
import { tipsFor } from './data/tips';

// 원문에서 틀린 표현 주변 문장 잘라 오기 (검증할 때 문맥으로 씀)
function contextOf(original, wrong) {
  const i = original.indexOf(wrong);
  if (i < 0) return '';
  return original.slice(Math.max(0, i - 40), i + wrong.length + 40);
}

async function fetchRules(refs) {
  try {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refs })
    });
    const data = await res.json();
    return data.rules || [];
  } catch { return []; }
}

const plainTxt = s => String(s || '').replace(/[\s‘’'"“”.,-]/g, '');

// 국립국어원 한국어 어문 규범 조항 안내
function RuleBox({ rule, quote, pending }) {
  if (!rule) return null;
  return (
    <div className="rbox">
      <div className="rbox-head">
        📘 {rule.title}
        <span className="rbox-chap">{rule.chapter}</span>
        {pending && <span className="rbox-pending">{pending === 'nikl' ? 'AI가 고른 조항 · 확인 중' : 'AI가 고른 조항'}</span>}
      </div>
      <div className="rbox-stmt">{rule.statement}</div>
      {rule.examples && <div className="rbox-ex">{rule.examples}</div>}
      {quote && plainTxt(quote) !== plainTxt(rule.statement) && <div className="rbox-quote">“{quote}”</div>}
      <a className="rbox-link" href={rule.url} target="_blank" rel="noopener noreferrer">
        규정 원문과 해설 보기 (국립국어원 한국어 어문 규범) →
      </a>
    </div>
  );
}

async function callVerify(stage, items) {
  const res = await fetch('/api/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stage, items })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.items || [];
}

// 한 번에 너무 많이 보내면 서버가 10개까지만 보므로 6개씩 나눠 동시에 확인
async function verifyInBatches(stage, items) {
  const batches = [];
  for (let i = 0; i < items.length; i += 6) batches.push(items.slice(i, i + 6));
  const results = await Promise.all(batches.map(b => callVerify(stage, b).catch(() => [])));
  const flat = results.flat();
  if (!flat.length && items.length) throw new Error('verify-failed');
  return flat;
}

const VERDICT_TEXT = {
  nikl: { '일치': '✅ AI 교정과 같아요', 'AI교정틀림': '⚠️ AI 교정이 틀려서 국립국어원 기준으로 바꿨어요', '부분': '🔸 일부만 맞아서 국립국어원 기준으로 다듬었어요', '둘다가능': '🟰 둘 다 맞는 표현이에요 (원래 쓰신 대로 두었어요)' },
  web:  { '일치': '✅ AI 교정과 같아요', 'AI교정틀림': '⚠️ 웹 자료로는 AI 교정이 틀릴 수 있어요', '부분': '🔸 웹 자료로는 일부만 맞아요', '둘다가능': '🟰 웹 자료로는 둘 다 쓸 수 있어요' },
};

function VerifyBox({ v, stage }) {
  const waitingWeb = stage === 'web' && (!v || v.source === 'none');
  if (stage === 'nikl' && !v) return <div className="vbox vbox-wait">🏛️ 국립국어원 자료를 찾고 있어요...</div>;
  if (waitingWeb) return <div className="vbox vbox-wait">🔎 국립국어원 자료가 없어서 웹에서 찾고 있어요...</div>;
  if (!v) {
    if (stage === 'error') return <div className="vbox vbox-none">⚠️ 자료 확인 중 문제가 생겼어요. AI 판단만 보여 드려요.</div>;
    return null;
  }
  if (v.source === 'none') {
    return <div className="vbox vbox-none">❔ 국립국어원·웹 자료에서 근거를 찾지 못했어요. AI 판단만으로 고친 항목이에요.</div>;
  }
  const isNikl = v.source === 'nikl';
  return (
    <div className={`vbox ${isNikl ? 'vbox-nikl' : 'vbox-web'}`}>
      <div className="vbox-head">
        {isNikl ? '🏛️ 국립국어원 공식 자료' : '🔎 국립국어원 자료 없음 · AI 웹 검색 결과 (참고용)'}
      </div>
      {VERDICT_TEXT[v.source]?.[v.verdict] && <div className="vbox-verdict">{VERDICT_TEXT[v.source][v.verdict]}</div>}
      {v.explain && <div className="vbox-explain">{v.explain}</div>}
      {v.sources?.map((s, k) => (
        <a key={k} className="vbox-src" href={s.url} target="_blank" rel="noopener noreferrer">
          📎 {s.title || s.url}
          {s.quote && <span className="vbox-quote">“{s.quote}”</span>}
        </a>
      ))}
    </div>
  );
}

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// AI 답에서 JSON만 꺼내기 (앞뒤에 설명이나 코드블록 표시가 붙어도 괜찮게)
function parseJSON(text) {
  const s = String(text || '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('bad-json');
  return JSON.parse(s.slice(a, b + 1));
}

// 서버에 맞춤법 검사 / 사전 찾기 요청 (실패하면 한 번 더 시도)
async function callAI(mode, text) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, text })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status));
      return parseJSON(data.text);
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// 긴 글은 문단·문장 단위로 나눠서 검사 (한 번에 너무 길면 AI 답이 잘림)
const CHUNK = 500;
function splitText(t) {
  const parts = [];
  for (const seg of t.split(/(\n+)/)) {
    if (seg.length <= CHUNK) { parts.push(seg); continue; }
    const sentences = seg.match(/[^.!?。]+[.!?。]+[\s"'”’)]*|[^.!?。]+$/g) || [seg];
    for (const s of sentences) {
      if (s.length <= CHUNK) parts.push(s);
      else for (let i = 0; i < s.length; i += CHUNK) parts.push(s.slice(i, i + CHUNK));
    }
  }
  const chunks = [];
  let cur = '';
  for (const p of parts) {
    if (cur && (cur + p).length > CHUNK) { chunks.push(cur); cur = ''; }
    cur += p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

function friendlyError(e) {
  const m = String(e?.message || e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '인터넷 연결이 불안정해요. 와이파이나 데이터를 확인한 뒤 다시 눌러 주세요.';
  if (/overloaded|529|rate|429/i.test(m)) return '지금 사용하는 사람이 많아요. 잠시 뒤에 다시 눌러 주세요.';
  return '잠깐 문제가 생겼어요. 아래 버튼으로 다시 해 보세요.';
}

export default function Home() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('check'); // 'check' | 'dict'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dictResult, setDictResult] = useState(null);
  const [tips, setTips] = useState([]);
  const [saved, setSaved] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [fontScale, setFontScale] = useState(0);
  const [tipPage, setTipPage] = useState(0);
  const [errorMsg, setErrorMsg] = useState(null); // { text, retry }
  const [progress, setProgress] = useState(''); // 긴 글 검사 진행 상황
  const [canShare, setCanShare] = useState(false);
  const fontLoadedRef = useRef(false);
  const [verify, setVerify] = useState({});       // 항목별 검증 결과 { id: {...} }
  const [verifyStage, setVerifyStage] = useState(''); // '' | 'nikl' | 'web' | 'done' | 'error'
  const [aiRules, setAiRules] = useState([]);     // AI가 근거로 든 조항 (어문 규범 원문)
  const verifyRunRef = useRef(0);
  const recognitionRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const s = localStorage.getItem('bareun_saved');
    try { if (s) setSaved(JSON.parse(s)); } catch { /* 저장 내용이 깨졌으면 무시 */ }
    const f = Number(localStorage.getItem('bareun_font'));
    if (f >= -2 && f <= 4) setFontScale(f);
    fontLoadedRef.current = true;
    setTips(tipsFor(0));
    setCanShare(typeof navigator !== 'undefined' && !!navigator.share);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = (18 + fontScale * 2) + 'px';
    if (fontLoadedRef.current) localStorage.setItem('bareun_font', String(fontScale));
  }, [fontScale]);

  function loadTips() {
    const next = tipPage + 1;
    setTipPage(next);
    setTips(tipsFor(next));
  }

  async function checkSpellingDirect(inputText) {
    const t = (inputText || text).trim();
    setErrorMsg(null);
    if (!t) { setErrorMsg({ text: '글을 먼저 입력해 주세요.' }); return; }
    if (t.length < 2) { setErrorMsg({ text: '조금 더 길게 입력해 주세요.' }); return; }
    setLoading(true); setResult(null); setDictResult(null);
    try {
      const chunks = splitText(t);
      let done = 0;
      setProgress(chunks.length > 1 ? `글이 길어서 ${chunks.length}부분으로 나눠 살펴보고 있어요 (0/${chunks.length})` : '');
      const parts = await Promise.all(chunks.map(async (c) => {
        const lead = c.match(/^\s*/)[0], trail = c.match(/\s*$/)[0];
        const body = c.trim();
        if (body.length < 2) return { correctedText: c, errors: [] };
        const r = await callAI('check', body);
        done++;
        if (chunks.length > 1) setProgress(`글이 길어서 ${chunks.length}부분으로 나눠 살펴보고 있어요 (${done}/${chunks.length})`);
        return { ...r, correctedText: lead + String(r.correctedText || body).trim() + trail };
      }));
      const seen = new Set();
      const errors = [];
      for (const p of parts) for (const e of (p.errors || [])) {
        if (!e || !e.wrong || !e.right || e.wrong === e.right) continue;
        const k = e.wrong + '→' + e.right;
        if (seen.has(k)) continue;
        seen.add(k); errors.push(e);
      }
      const comments = parts.map(p => p.overallComment).filter(Boolean);
      // 나눠 검사하면 한쪽에서만 고친 낱말이 생길 수 있어서, 찾은 오류를 글 전체에 똑같이 반영
      let merged = parts.map(p => p.correctedText).join('');
      if (chunks.length > 1) {
        for (const e of errors) {
          if (e.wrong.length >= 2 && !e.right.includes(e.wrong)) merged = merged.split(e.wrong).join(e.right);
        }
      }
      const parsed = {
        hasErrors: errors.length > 0,
        correctedText: merged,
        errors,
        overallComment: errors.length === 0 ? (comments[0] || '고칠 곳이 없는 바른 글입니다.') : (chunks.length > 1 ? `전체 글에서 ${errors.length}곳을 찾았어요.` : (comments[0] || '')),
      };
      setResult(parsed);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      setLoading(false); setProgress('');
      runVerify(t, parsed); // 국립국어원 자료로 한 번 더 확인 (기다리지 않고 뒤에서 진행)
    } catch(e) {
      setErrorMsg({ text: friendlyError(e), retry: 'check' });
    }
    finally { setLoading(false); setProgress(''); }
  }

  // 1단계: 국립국어원 자료 검색 → 2단계: 못 찾은 것만 웹 검색
  async function runVerify(original, parsed) {
    const errs = parsed?.errors || [];
    const runId = Date.now();
    verifyRunRef.current = runId;
    setVerify({});
    setAiRules([]);
    if (!errs.length) { setVerifyStage(''); return; }
    // AI가 든 조항의 원문을 먼저 바로 보여 줌
    fetchRules(errs.map(e => e.rule || '')).then(r => { if (verifyRunRef.current === runId) setAiRules(r); });
    const items = errs.map((e, i) => ({ id: i, wrong: e.wrong, right: e.right, rule: e.rule || '', context: contextOf(original, e.wrong) }));
    const map = {};
    setVerifyStage('nikl');
    try {
      const r1 = await verifyInBatches('nikl', items);
      if (verifyRunRef.current !== runId) return;
      r1.forEach(v => { map[v.id] = v; });
      applyOfficial(r1);
      setVerify({ ...map });

      const rest = items.filter(it => !map[it.id] || map[it.id].source === 'none');
      if (rest.length) {
        setVerifyStage('web');
        try {
          const r2 = await verifyInBatches('web', rest);
          if (verifyRunRef.current !== runId) return;
          r2.forEach(v => { map[v.id] = v; });
          setVerify({ ...map });
        } catch (e) { /* 웹 검색 실패 시 '못 찾음'으로 둠 */ }
      }
      if (verifyRunRef.current === runId) setVerifyStage('done');
    } catch (e) {
      if (verifyRunRef.current === runId) setVerifyStage('error');
    }
  }

  // 국립국어원 자료가 AI 교정과 다르면 교정된 글을 국립국어원 기준으로 바꿈
  function applyOfficial(list) {
    setResult(prev => {
      if (!prev) return prev;
      let txt = prev.correctedText;
      const errors = (prev.errors || []).map((err, i) => {
        const v = list.find(x => x.id === i);
        if (!v || v.source !== 'nikl' || !v.officialRight || v.officialRight === err.right) return err;
        if (txt.includes(err.right)) txt = txt.replace(err.right, v.officialRight);
        return { ...err, aiRight: err.right, aiReason: err.reason, reason: v.explain || err.reason, example: '', right: v.officialRight, keptOriginal: v.officialRight === err.wrong, bothOk: v.verdict === '둘다가능' };
      });
      const realCount = errors.filter(e => !e.keptOriginal).length;
      return { ...prev, correctedText: txt, errors, hasErrors: realCount > 0 };
    });
  }

  async function searchDictDirect(inputText) {
    const t = (inputText || text).trim();
    setErrorMsg(null);
    if (!t) { setErrorMsg({ text: '찾을 단어를 먼저 입력해 주세요.' }); return; }
    if (t.length > 30) { setErrorMsg({ text: '사전은 단어 하나만 찾을 수 있어요. 단어만 남기고 다시 눌러 주세요. (글 검사는 ✏️ 맞춤법 버튼)' }); return; }
    setLoading(true); setResult(null); setDictResult(null);
    try {
      const parsed = await callAI('dict', t);
      parsed.searchWord = t;
      setDictResult(parsed);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch(e) {
      setErrorMsg({ text: friendlyError(e), retry: 'dict' });
    }
    finally { setLoading(false); }
  }

  async function checkSpelling() { await checkSpellingDirect(); }
  async function searchDict() { await searchDictDirect(); }

  function clearAll() {
    verifyRunRef.current = 0; setVerify({}); setVerifyStage(''); setAiRules([]);
    setText(''); setResult(null); setDictResult(null); setErrorMsg(null);
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setErrorMsg({ text: '이 브라우저에서는 음성 입력이 안 돼요. 크롬이나 사파리에서 열어 주세요.' }); return;
    }
    if (isRecording) { recognitionRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = 'ko-KR'; rec.interimResults = true; rec.continuous = true;
    rec.onstart = () => setIsRecording(true);
    rec.onresult = (e) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++)
        if (e.results[i].isFinal) final += e.results[i][0].transcript;
      if (final) setText(prev => (prev && !/\s$/.test(prev) ? prev + ' ' : prev) + final.trim());
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => rec.stop();
    recognitionRef.current = rec;
    rec.start();
  }

  function copyText() {
    if (!result) return;
    navigator.clipboard.writeText(result.correctedText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => setErrorMsg({ text: '복사가 안 됐어요. 교정된 글을 길게 눌러서 복사해 주세요.' }));
  }

  // 휴대폰 공유창(카카오톡, 문자 등)으로 바로 보내기
  function shareText() {
    if (!result || !navigator.share) return;
    navigator.share({ text: result.correctedText }).catch(() => {});
  }

  function isItemSaved(wrong, right) {
    return saved.some(s => s.wrong === wrong && s.right === right);
  }

  function toggleSave(err) {
    let newSaved = [...saved];
    const idx = newSaved.findIndex(s => s.wrong === err.wrong && s.right === err.right);
    if (idx >= 0) { newSaved.splice(idx, 1); }
    else { newSaved.unshift({ ...err, savedAt: new Date().toLocaleDateString('ko-KR') }); }
    setSaved(newSaved);
    localStorage.setItem('bareun_saved', JSON.stringify(newSaved));
  }

  function deleteSaved(idx) {
    const newSaved = saved.filter((_, i) => i !== idx);
    setSaved(newSaved);
    localStorage.setItem('bareun_saved', JSON.stringify(newSaved));
  }

  function clearAllSaved() {
    if (!confirm('저장된 항목을 모두 삭제할까요?')) return;
    setSaved([]);
    localStorage.removeItem('bareun_saved');
  }

  return (
    <>
      <header>
        <div className="logo">바른 글씨 ✏️</div>
        <p className="tagline">맞춤법과 용례를 바르게 — 쉽고 편하게</p>
        <div className="font-ctrl">
          <span className="font-lbl">글자 크기</span>
          <button className="font-btn" aria-label="글자 작게" onClick={() => setFontScale(s => Math.max(-2, s-1))} disabled={fontScale <= -2}>가-</button>
          <button className="font-btn" aria-label="글자 크게" onClick={() => setFontScale(s => Math.min(4, s+1))} disabled={fontScale >= 4}>가+</button>
        </div>
      </header>

      <main>
        {/* 입력 카드 */}
        <div className="card">
          <div className="card-head">
            <span className="icon">📝</span>
            <h2>{mode === 'check' ? '글을 입력해 주세요' : '단어를 입력해 주세요'}</h2>
            <button className="btn-clear-head" onClick={clearAll}>지우기</button>
          </div>
          <div className="ta-wrap">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={mode === 'check'
                ? "여기에 글을 입력하거나 붙여넣기 하세요.\n예) 오늘 날씨가 참 맑네요. 오랫만에 산책을 나갔습니다."
                : "찾고 싶은 단어를 입력하세요.\n예) 설레다, 어이없다, 금세"}
              maxLength={2000}
            />
          </div>
          <div className="voice-row">
            <span className="voice-label">🎙️ 음성 입력:</span>
            <button className={`voice-btn${isRecording ? ' recording' : ''}`} onClick={toggleVoice}>
              <span>{isRecording ? '⏹' : '🎤'}</span>
              <span>{isRecording ? '중지' : '말하기 시작'}</span>
            </button>
            {isRecording && <span className="rec-status show">● 녹음 중...</span>}
          </div>
          <div className="btn-row">
            <button
              className={`btn-mode${mode === 'check' ? ' active' : ''}`}
              onClick={() => { setMode('check'); setResult(null); setDictResult(null); verifyRunRef.current = 0; setVerify({}); setVerifyStage(''); checkSpellingDirect(); }}
              disabled={loading}
            >✏️ 맞춤법</button>
            <button
              className={`btn-mode${mode === 'dict' ? ' active' : ''}`}
              onClick={() => { setMode('dict'); setResult(null); setDictResult(null); verifyRunRef.current = 0; setVerify({}); setVerifyStage(''); searchDictDirect(); }}
              disabled={loading}
            >📖 사전</button>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="loading-card show">
            <div className="spinner"></div>
            <p className="loading-text">{mode === 'dict' ? '사전을 찾고 있습니다...' : '글을 꼼꼼히 살펴보고 있습니다...'}</p>
            <p className="loading-hint">{progress || '보통 10~20초 걸려요. 잠시만 기다려 주세요.'}</p>
          </div>
        )}

        {/* 안내·오류 메시지 (알림창 대신 화면에 표시) */}
        {errorMsg && !loading && (
          <div className="notice-card" role="alert">
            <p>⚠️ {errorMsg.text}</p>
            {errorMsg.retry && (
              <button className="btn-retry" onClick={() => errorMsg.retry === 'dict' ? searchDictDirect() : checkSpellingDirect()}>
                🔄 다시 해 보기
              </button>
            )}
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="result-card show" ref={resultRef}>
            <div className={`score-banner ${result.hasErrors ? 'has-errors' : 'perfect'}`}>
              <span className="score-emoji">{result.hasErrors ? '📌' : '🎉'}</span>
              <div className="score-text">
                <h3>{result.hasErrors ? `${result.errors.filter(e => !e.keptOriginal).length}곳을 고쳐드렸어요` : '완벽합니다!'}</h3>
                <p>{result.overallComment}</p>
              </div>
            </div>
            {verifyStage && verifyStage !== 'done' && verifyStage !== 'error' && (
              <div className="verify-status">
                <div className="spinner small"></div>
                {verifyStage === 'nikl'
                  ? '국립국어원 자료로 한 번 더 확인하고 있어요 (30초쯤 걸려요)'
                  : '국립국어원에 없는 항목은 웹에서 찾고 있어요'}
              </div>
            )}
            {verifyStage === 'done' && (
              <div className="verify-status done">
                ✔ 확인 끝: 국립국어원 자료 {Object.values(verify).filter(v => v.source === 'nikl').length}개 · 웹 자료 {Object.values(verify).filter(v => v.source === 'web').length}개 · 근거 못 찾음 {Object.values(verify).filter(v => v.source === 'none').length}개
              </div>
            )}
            <div className="corrected-sec">
              <div className="sec-label">교정된 글</div>
              <div className="corrected-text" dangerouslySetInnerHTML={{
                __html: (() => {
                  let txt = esc(result.correctedText || '');
                  (result.errors || []).forEach(e => {
                    // correctedText에 right가 있으면 하이라이트
                    const r = esc(e.right || '');
                    if (r && !e.keptOriginal && txt.includes(r)) {
                      txt = txt.replace(new RegExp(escRx(r), 'g'), `<mark>${r}</mark>`);
                    }
                  });
                  return txt;
                })()
              }} />
            </div>
            {result.errors?.length > 0 && (
              <div className="errors-sec">
                <div className="sec-label" style={{marginBottom:'12px'}}>수정 내역</div>
                {result.errors.map((err, i) => (
                  <div key={i} className="error-item" style={{animationDelay: i*0.05+'s'}}>
                    <div className="err-num">{i+1}</div>
                    <div className="err-body">
                      <div className="err-words">
                        <span className="word-wrong">{err.wrong}</span>
                        <span style={{color:'var(--ink-faint)'}}>→</span>
                        <span className="word-right">{err.right}</span>
                        <span className="err-type">{err.type}</span>
                      </div>
                      {err.aiRight && (
                        <div className="err-override">
                          {err.bothOk
                            ? `국립국어원 자료에 따르면 '${err.wrong}', '${err.aiRight}' 둘 다 쓸 수 있어요. 원래 쓰신 대로 두었어요.`
                            : err.keptOriginal
                            ? `원래 쓰신 '${err.wrong}'이(가) 맞아요. (처음 AI는 '${err.aiRight}'(으)로 고쳤지만 국립국어원 기준과 달라 되돌렸어요)`
                            : `처음 AI는 '${err.aiRight}'(으)로 고쳤지만 국립국어원 기준에 맞춰 '${err.right}'(으)로 바꿨어요.`}
                        </div>
                      )}
                      {!err.aiRight && <div className="err-reason">{err.reason}</div>}
                      {!err.aiRight && err.example && <div className="err-example">예) {err.example}</div>}
                      {verify[i]
                        ? (verify[i].source === 'nikl' && <RuleBox rule={verify[i].rule} quote={verify[i].ruleQuote} />)
                        : <RuleBox rule={aiRules[i]} pending={verifyStage === 'nikl' ? 'nikl' : 'ai'} />}
                      <VerifyBox v={verify[i]} stage={verifyStage} />
                    </div>
                    <button className="btn-star" onClick={() => toggleSave(err)}>
                      {isItemSaved(err.wrong, err.right) ? '⭐' : '☆'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="copy-row">
              <button className={`btn-copy${copied ? ' copied' : ''}`} onClick={copyText}>
                {copied ? '✅ 복사되었습니다!' : '📋 교정된 글 복사하기'}
              </button>
              {canShare && (
                <button className="btn-share" onClick={shareText}>💬 카톡·문자로 보내기</button>
              )}
            </div>
          </div>
        )}

        {/* 사전 결과 */}
        {dictResult && (
          <div className="result-card show" ref={resultRef}>
            <div className="score-banner has-errors" style={{background:'#e8f0fe',borderBottom:'2px solid #93b4f7'}}>
              <span className="score-emoji">📖</span>
              <div className="score-text">
                <h3 style={{color:'#1a3a8f'}}>
                  {dictResult.word}
                  {dictResult.hanja && <span style={{fontSize:'0.85rem',fontWeight:500,color:'#5a7abf'}}> ({dictResult.hanja})</span>}
                </h3>
                {dictResult.pronunciation && <p>[ {dictResult.pronunciation} ]</p>}
              </div>
            </div>
            <div className="errors-sec">
              {dictResult.meanings?.map((m, i) => (
                <div key={i} className="error-item" style={{animationDelay: i*0.05+'s'}}>
                  <div className="err-num">{i+1}</div>
                  <div className="err-body">
                    <div className="err-words">
                      <span className="err-type">{m.pos}</span>
                    </div>
                    <div className="err-reason" style={{fontWeight:600,color:'var(--ink)',marginBottom:'4px'}}>{m.definition}</div>
                    {m.example && <div className="err-example">예) {m.example}</div>}
                  </div>
                </div>
              ))}
              {(dictResult.synonyms?.length > 0 || dictResult.antonyms?.length > 0) && (
                <div style={{padding:'10px 4px',fontSize:'0.9rem',color:'var(--ink-light)'}}>
                  {dictResult.synonyms?.length > 0 && <div style={{marginBottom:'4px'}}>📌 유의어: <b>{dictResult.synonyms.join(', ')}</b></div>}
                  {dictResult.antonyms?.length > 0 && <div>🔄 반의어: <b>{dictResult.antonyms.join(', ')}</b></div>}
                </div>
              )}
              {dictResult.note && (
                <div style={{marginTop:'8px',padding:'12px 16px',background:'#f0f4ff',borderRadius:'10px',border:'1.5px solid #93b4f7',fontSize:'0.9rem',color:'var(--ink-light)'}}>
                  📝 {dictResult.note}
                </div>
              )}
            </div>
            <div className="copy-row">
              <a
                href={`https://stdict.korean.go.kr/search/searchResult.do?searchKeyword=${encodeURIComponent(dictResult.searchWord || dictResult.word)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{display:'block',width:'100%',padding:'14px',borderRadius:'10px',border:'2px solid #3b5bdb',background:'white',color:'#3b5bdb',fontSize:'1rem',fontWeight:700,textAlign:'center',textDecoration:'none',transition:'all 0.2s'}}
              >
                📚 국립국어원 표준국어대사전에서 확인하기
              </a>
            </div>
          </div>
        )}

        {/* 저장 목록 */}
        <div className="saved-card">
          <div className="saved-head">
            <div>
              <div className="saved-head-title">⭐ 저장한 오류</div>
              <div className="saved-count">{saved.length}개</div>
            </div>
            <button className="btn-clear-all" onClick={clearAllSaved}>전체 삭제</button>
          </div>
          <div className="saved-list">
            {saved.length === 0 ? (
              <div className="saved-empty">저장된 항목이 없습니다.<br/>오류 항목의 ☆ 버튼을 눌러 저장하세요.</div>
            ) : saved.map((s, i) => (
              <div key={i} className="saved-item">
                <div className="saved-item-body">
                  <div className="saved-words">
                    <span className="saved-wrong">{s.wrong}</span>
                    <span style={{color:'var(--ink-faint)'}}>→</span>
                    <span className="saved-right">{s.right}</span>
                    <span className="saved-type">{s.type}</span>
                  </div>
                  <div className="saved-reason">{s.reason}</div>
                  <div className="saved-date">📅 {s.savedAt}</div>
                </div>
                <button className="btn-del-saved" onClick={() => deleteSaved(i)}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* 오늘의 팁 */}
        <div className="tips-card">
          <div className="tips-head">
            <div className="tips-title">💡 오늘의 맞춤법 팁 <span>— 국립국어원 기준</span></div>
            <button className="btn-refresh" onClick={loadTips}>🔄 다른 팁 보기</button>
          </div>
          {tips.map((t, i) => (
            <div key={i} className="tip-item">
              <span className="tip-dot">◆</span>
              <span><b>{t.wrong} → {t.right}</b> &nbsp;{t.desc}</span>
            </div>
          ))}
          <p className="tips-src">출처: 국립국어원 한글 맞춤법(문화체육관광부 고시 제2017-12호)·표준어 규정·표준국어대사전</p>
        </div>
      </main>

    </>
  );
}
