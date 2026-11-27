'use client';
import { useState, useEffect, useRef } from 'react';
import { tipsFor } from './data/tips';
import { findQuickErrors } from './lib/quickCheck.mjs';
import { anchorEdits, buildCorrection, contextOf, splitTextWithContext } from './lib/corrections.mjs';
import EasyReview from './components/EasyReview';
import MessageTemplates from './components/MessageTemplates';
import { insertTemplate } from './lib/templateInsertion.mjs';
import { callAI, verifyInBatches, missingVerification, applyVerifiedEdits } from './lib/checkFlow.mjs';
import './components/home-features.css';

async function fetchRules(refs, signal) {
  try {
    const res = await fetch('/api/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refs }), signal
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

const VERDICT_TEXT = {
  nikl: { '일치': '✅ AI 교정과 같아요', 'AI교정틀림': '⚠️ AI 교정이 틀려서 자료 대조 결과가 AI 제안과 달라요', '부분': '🔸 일부만 맞아서 자료 대조 결과 일부만 같아요', '둘다가능': '🟰 둘 다 맞는 표현이에요 (원래 쓰신 대로 두었어요)' },
  web:  { '일치': '✅ AI 교정과 같아요', 'AI교정틀림': '⚠️ 웹 자료로는 AI 교정이 틀릴 수 있어요', '부분': '🔸 웹 자료로는 일부만 맞아요', '둘다가능': '🟰 웹 자료로는 둘 다 쓸 수 있어요' },
};

function VerifyBox({ v, stage }) {
  const waitingWeb = stage === 'web' && (!v || v.source === 'none');
  if ((stage === 'nikl' || stage === 'local') && !v) return <div className="vbox vbox-wait">🏛️ 국립국어원 자료를 찾고 있어요...</div>;
  if (waitingWeb) return <div className="vbox vbox-wait">🔎 국립국어원 자료가 없어서 웹에서 찾고 있어요...</div>;
  if (!v) {
    if (stage === 'error') return <div className="vbox vbox-none">⚠️ 자료 확인 중 문제가 생겼어요. AI 판단만 보여 드려요.</div>;
    return null;
  }
  if (v.source === 'none') {
    return <div className="vbox vbox-none">{v.verificationFailed ? '검증 응답을 받지 못해 원문을 유지합니다.' : v.localOnly ? '제공된 공식 자료만으로 근거를 확인하지 못해 원문을 유지합니다. 필요하면 자료 검색 포함 검사를 선택해 주세요.' : '국립국어원·웹 자료에서 근거를 찾지 못했어요. 원문을 유지하고 제안만 보여 드려요.'}</div>;
  }
  const isNikl = v.source === 'nikl';
  return (
    <div className={`vbox ${isNikl ? 'vbox-nikl' : 'vbox-web'}`}>
      <div className="vbox-head">
        {isNikl ? '🏛️ AI의 국립국어원 자료 대조 결과' : '🔎 국립국어원 자료 없음 · AI 웹 검색 결과 (참고용)'}
      </div>
      {VERDICT_TEXT[v.source]?.[v.verdict] && <div className="vbox-verdict">{VERDICT_TEXT[v.source][v.verdict]}</div>}
      {v.verificationFailed && <div className="vbox-explain">공식 자료 대조 응답을 받지 못했어요. 웹 자료는 참고만 해 주세요.</div>}
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
  const [checkProfile, setCheckProfile] = useState('fast');
  const [elapsedMs, setElapsedMs] = useState(null);
  const requestControllerRef = useRef(null);
  const [result, setResult] = useState(null);
  const [quickActive, setQuickActive] = useState(false);
  const [showExpressionSearch, setShowExpressionSearch] = useState(false);
  const [expressionQuery, setExpressionQuery] = useState('');
  const [expressionResults, setExpressionResults] = useState(null);
  const [expressionStatus, setExpressionStatus] = useState('');
  const expressionRunRef = useRef(0);
  const expressionControllerRef = useRef(null);
  const [dictResult, setDictResult] = useState(null);
  const [tips, setTips] = useState([]);
  const [saved, setSaved] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [fontScale, setFontScale] = useState(0);
  const [reviewMode, setReviewMode] = useState('all');
  const [showTemplates, setShowTemplates] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState(null);
  const [templateNotice, setTemplateNotice] = useState('');
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
  const inputRef = useRef(null);
  const templatePromptRef = useRef(null);
  const checkFeatureRef = useRef(null);
  const copySequenceRef = useRef(0);

  useEffect(() => () => { verifyRunRef.current++; requestControllerRef.current?.abort(); expressionRunRef.current++; expressionControllerRef.current?.abort(); }, []);

  useEffect(() => {
    if (pendingTemplate !== null) {
      templatePromptRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
      templatePromptRef.current?.focus();
    }
  }, [pendingTemplate]);

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

  function cancelInspection() {
    verifyRunRef.current++;
    requestControllerRef.current?.abort();
    setLoading(false); setProgress(''); setVerifyStage('done');
    if(result)setVerify(prev=>{const map={...prev};for(const e of result.errors)if(!map[e.id])map[e.id]=missingVerification(e,result.profile==='full');return map;});
    setErrorMsg({text:'검사를 취소했습니다. 입력한 글과 이미 확인된 결과는 유지됩니다.'});
    setResult(prev => prev ? {...prev, errors:prev.errors.map(e => e.status === 'pending' ? {...e,status:'needs_review'} : e)} : prev);
  }

  async function checkSpellingDirect(inputText, profile = checkProfile) {
    const t = inputText ?? text;
    setErrorMsg(null);
    if (!t.trim()) { setErrorMsg({text:'글을 먼저 입력해 주세요.'}); return; }
    if (profile === 'fast') {
      requestControllerRef.current?.abort(); verifyRunRef.current++;
      setCheckProfile('fast'); setLoading(false); setProgress(''); setElapsedMs(null);
      setResult(null); setDictResult(null); setVerify({}); setVerifyStage(''); setAiRules([]);
      setQuickActive(true);
      setTimeout(() => resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100);
      return;
    }
    if (t.trim().length < 2) { setErrorMsg({text:'조금 더 길게 입력해 주세요.'}); return; }
    setQuickActive(false);
    requestControllerRef.current?.abort();
    const controller = new AbortController(); requestControllerRef.current = controller;
    const runId = ++verifyRunRef.current, startedAt = Date.now();
    setCheckProfile(profile); setElapsedMs(null);
    setVerify({}); setVerifyStage(''); setAiRules([]);
    setLoading(true); setResult(null); setDictResult(null);
    try {
      const apiProfile = profile === 'full' ? 'fast' : profile;
      const chunks = splitTextWithContext(t); let done = 0;
      setProgress(chunks.length > 1 ? '글을 나누어 살펴보고 있어요 (0/' + chunks.length + ')' : '');
      const parts = await Promise.all(chunks.map(async c => {
        if (!c.text.trim()) return {errors:[]};
        const r = await callAI('check',c.text,c.contextBefore,c.contextAfter,{profile:apiProfile,signal:controller.signal});
        if (verifyRunRef.current === runId) { done++; if(chunks.length > 1)setProgress('글을 나누어 살펴보고 있어요 ('+done+'/'+chunks.length+')'); }
        return r;
      }));
      if (verifyRunRef.current !== runId) return;
      const candidates = parts.flatMap((p,i) => anchorEdits(chunks[i].text,p.errors||[]).map(e => ({...e,start:e.start===null?null:e.start+chunks[i].start,end:e.end===null?null:e.end+chunks[i].start})));
      const errors = anchorEdits(t,candidates);
      const parsed = {originalText:t,errors,profile,hasErrors:errors.length>0,overallComment:errors.length?'AI가 제안한 교정 항목입니다. 자료가 발견되어도 판단이 틀릴 수 있습니다.':'AI가 제안한 교정 항목이 없습니다. 결과가 정확하다는 보장은 아닙니다.'};
      setResult(parsed);
      setTimeout(() => resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100);
      if(!errors.length)setElapsedMs(Date.now()-startedAt);
      runVerify(t,parsed,runId,{profile:apiProfile,signal:controller.signal,startedAt});
    } catch(e) {
      if(verifyRunRef.current===runId && e?.name!=='AbortError')setErrorMsg({text:friendlyError(e),retry:'check'});
    } finally {if(verifyRunRef.current===runId){setLoading(false);setProgress('');}}
  }

  async function runVerify(original,parsed,runId,options) {
    const errs=parsed?.errors||[];
    if(!errs.length){setVerifyStage('');return;}
    const localOnly=options.profile==='fast';
    fetchRules(errs.map(e=>e.rule||''),options.signal).then(r=>{if(verifyRunRef.current===runId)setAiRules(r);});
    const items=errs.map(e=>({id:e.id,wrong:e.wrong,right:e.right,rule:e.rule||'',context:contextOf(original,e)}));
    const map={}; setVerifyStage(localOnly?'local':'nikl');
    try {
      const r1=await verifyInBatches(localOnly?'local':'nikl',items,{signal:options.signal});
      if(verifyRunRef.current!==runId)return;
      r1.forEach(v=>{map[v.id]=v;});
      setResult(prev=>verifyRunRef.current===runId&&prev?.originalText===original?{...prev,errors:applyVerifiedEdits(original,prev.errors,map)}:prev);
      setVerify({...map});
      const rest=items.filter(it=>!map[it.id]||map[it.id].source==='none');
      if(!localOnly&&rest.length){
        setVerifyStage('web');
        const r2=await verifyInBatches('web',rest,{signal:options.signal});
        if(verifyRunRef.current!==runId)return;
        r2.forEach(v=>{map[v.id]={...v,verificationFailed:!!(v.verificationFailed||map[v.id]?.verificationFailed)};});
        setVerify({...map});
      }
      if(verifyRunRef.current===runId){setVerifyStage('done');setElapsedMs(Date.now()-options.startedAt);}
    } catch(e) {
      if(verifyRunRef.current===runId&&e?.name!=='AbortError'){
        items.forEach(it=>{if(!map[it.id])map[it.id]=missingVerification(it,localOnly);});
        setResult(prev=>prev?.originalText===original?{...prev,errors:applyVerifiedEdits(original,prev.errors,map)}:prev);
        setVerify({...map});setVerifyStage('done');setElapsedMs(Date.now()-options.startedAt);
      }
    }
  }

  function chooseCorrection(id, manual) {
    setCopied(false);
    setResult(prev => prev && ({ ...prev, errors: prev.errors.map(e => e.id === id ? { ...e, manual } : e) }));
  }

  async function searchDictDirect(inputText) {
    const t=(inputText||text).trim();setErrorMsg(null);
    if(!t){setErrorMsg({text:'찾을 단어를 먼저 입력해 주세요.'});return;}
    if(t.length>30){setErrorMsg({text:'사전은 단어 하나만 찾을 수 있어요. 단어만 남기고 다시 눌러 주세요.'});return;}
    requestControllerRef.current?.abort();const controller=new AbortController();requestControllerRef.current=controller;
    const runId=++verifyRunRef.current;setVerifyStage('');setElapsedMs(null);
    setLoading(true);setResult(null);setDictResult(null);setQuickActive(false);
    try{const parsed=await callAI('dict',t,'','',{signal:controller.signal});if(verifyRunRef.current!==runId)return;parsed.searchWord=t;setDictResult(parsed);setTimeout(()=>resultRef.current?.scrollIntoView({behavior:'smooth',block:'start'}),100);}
    catch(e){if(verifyRunRef.current===runId&&e?.name!=='AbortError')setErrorMsg({text:friendlyError(e),retry:'dict'});}
    finally{if(verifyRunRef.current===runId)setLoading(false);}
  }

  async function searchExpressions(e) {
    e.preventDefault();
    const q = expressionQuery.trim();
    expressionControllerRef.current?.abort();
    const run = ++expressionRunRef.current;
    if (!q) { setExpressionResults(null); setExpressionStatus('찾을 표현을 입력해 주세요.'); return; }
    const controller = new AbortController(); expressionControllerRef.current = controller;
    setExpressionResults(null); setExpressionStatus('자료를 찾고 있어요.');
    try {
      const response = await fetch('/api/expressions?q=' + encodeURIComponent(q), {signal:controller.signal});
      if (!response.ok) throw new Error('search failed');
      const data = await response.json();
      if (!Array.isArray(data.items)) throw new Error('invalid response');
      if (run !== expressionRunRef.current) return;
      setExpressionResults(data.items); setExpressionStatus(data.items.length ? '' : '검색 결과가 없어요. 다른 표현으로 검색해 주세요.');
    } catch (err) { if (run === expressionRunRef.current && err?.name !== 'AbortError') setExpressionStatus('자료를 불러오지 못했어요. 다시 검색해 주세요.'); }
  }

  function updateInput(value) {
    requestControllerRef.current?.abort(); verifyRunRef.current++;
    setLoading(false); setProgress(''); setVerifyStage(''); setResult(null); setDictResult(null); setErrorMsg(null);
    setText(value);
  }

  function applyQuick(error) {
    if (!Number.isInteger(error.start) || !Number.isInteger(error.end) || error.start < 0 || error.end <= error.start || text.slice(error.start,error.end) !== error.wrong) return;
    updateInput(text.slice(0,error.start) + error.right + text.slice(error.end));
  }

  async function checkSpelling() { await checkSpellingDirect(); }
  async function searchDict() { await searchDictDirect(); }

  function clearAll() {
    requestControllerRef.current?.abort(); setLoading(false); setProgress(''); setElapsedMs(null);
    verifyRunRef.current++; setVerify({}); setVerifyStage(''); setAiRules([]);
    setText(''); setResult(null); setDictResult(null); setQuickActive(false); setErrorMsg(null);
  }

  function closeTemplates(target = 'tab') {
    setShowTemplates(false);
    setPendingTemplate(null);
    setTemplateNotice('');
    setTimeout(() => {
      if (target === 'input') {
        inputRef.current?.scrollIntoView({behavior:'smooth',block:'center'});
        inputRef.current?.focus();
      } else checkFeatureRef.current?.focus({preventScroll:true});
    }, 0);
  }

  function cancelTemplateInsertion() {
    setPendingTemplate(null);
    setTemplateNotice('');
    setTimeout(() => document.getElementById('mt-message-body')?.focus(), 0);
  }

  function applyTemplate(body, method = 'replace') {
    const next = insertTemplate(text, body, method);
    if (!next.ok) { setTemplateNotice(next.error); return; }
    requestControllerRef.current?.abort();setLoading(false);setElapsedMs(null);
    verifyRunRef.current++;
    recognitionRef.current?.abort?.();
    setIsRecording(false);
    setVerify({}); setVerifyStage(''); setAiRules([]);
    setResult(null); setDictResult(null); setQuickActive(false); setErrorMsg(null); setCopied(false);
    setMode('check'); setText(next.text);
    closeTemplates('input');
  }

  function findCeremonyTerm(term) {
    if (loading || isRecording || typeof term !== 'string' || !term.trim()) return;
    const word = term.trim();
    if (((text && text !== word) || result || dictResult) && !window.confirm('입력한 글이 검색어로 바뀌고 이전 검사·사전 결과가 사라집니다. 계속하시겠어요?')) return;
    setText(word);
    setMode('dict');
    setVerify({});
    setShowTemplates(false);
    setPendingTemplate(null);
    setTemplateNotice('');
    searchDictDirect(word);
  }

  function requestTemplate(body) {
    if (loading || isRecording) { setTemplateNotice('검사나 음성 입력을 마친 뒤 문구를 넣어 주세요.'); return; }
    if (typeof body !== 'string' || !body.trim()) { setTemplateNotice('넣을 문구를 먼저 선택해 주세요.'); return; }
    setTemplateNotice('');
    if (text === body) { closeTemplates('input'); return; }
    if (text.length) { setPendingTemplate(body); return; }
    applyTemplate(body);
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
      if (final) { const current = inputRef.current?.value || ''; updateInput((current && !/\s$/.test(current) ? current + ' ' : current) + final.trim()); }
    };
    rec.onend = () => setIsRecording(false);
    rec.onerror = () => rec.stop();
    recognitionRef.current = rec;
    rec.start();
  }

  async function copyText() {
    if (!result) return;
    const snapshot = buildCorrection(result.originalText, result.errors).text;
    const sequence = ++copySequenceRef.current;
    setCopied(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard-unavailable');
      await navigator.clipboard.writeText(snapshot);
      if (sequence !== copySequenceRef.current) return;
      setCopied(snapshot);
      setTimeout(() => { if (sequence === copySequenceRef.current) setCopied(false); }, 2000);
    } catch {
      if (sequence === copySequenceRef.current) setErrorMsg({ text: '복사가 안 됐어요. 교정된 글을 길게 눌러서 복사해 주세요.' });
    }
  }

  // 휴대폰 공유창(카카오톡, 문자 등)으로 바로 보내기
  function shareText() {
    if (!result || !navigator.share) return;
    navigator.share({ text: buildCorrection(result.originalText, result.errors).text }).catch(() => {});
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

  const correction = result ? buildCorrection(result.originalText, result.errors) : null;
  const quickErrors = quickActive ? findQuickErrors(text) : [];

  useEffect(() => {
    copySequenceRef.current++;
    setCopied(false);
  }, [correction?.text]);

  function renderEvidence(err, i) {
    return <>
      {verify[err.id]
        ? (verify[err.id].source === 'nikl' && <RuleBox rule={verify[err.id].rule} quote={verify[err.id].ruleQuote} />)
        : <RuleBox rule={aiRules[i]} pending={verifyStage === 'nikl' ? 'nikl' : 'ai'} />}
      <VerifyBox v={verify[err.id]} stage={verifyStage} />
    </>;
  }

  return (
    <>
      <header>
        <div className="logo">바른 한마디 ✏️</div>
        <p className="tagline">맞춤법은 바르게, 축하와 위로는 알맞게</p>
        <div className="font-ctrl">
          <span className="font-lbl">글자 크기</span>
          <button className="font-btn" aria-label="글자 작게" onClick={() => setFontScale(s => Math.max(-2, s-1))} disabled={fontScale <= -2}>가-</button>
          <button className="font-btn" aria-label="글자 크게" onClick={() => setFontScale(s => Math.min(4, s+1))} disabled={fontScale >= 4}>가+</button>
        </div>
      </header>

      <main>
        <nav className="app-feature-switch" aria-label="기능 선택">
          <button type="button" ref={checkFeatureRef} aria-pressed={!showTemplates} onClick={closeTemplates}>글 검사</button>
          <button type="button" aria-pressed={showTemplates} disabled={loading || isRecording} onClick={() => setShowTemplates(true)}>경조사 문구</button>
        </nav>
        <section className="check-speed-options" hidden={showTemplates} aria-label="검사 방식">
          <div role="group" aria-label="검사 속도 선택">
            <button type="button" aria-pressed={checkProfile==='fast'} disabled={loading || ['local','nikl','web'].includes(verifyStage)} onClick={()=>setCheckProfile('fast')}>빠른 검사</button>
            <button type="button" aria-pressed={checkProfile==='full'} disabled={loading || ['local','nikl','web'].includes(verifyStage)} onClick={()=>setCheckProfile('full')}>전체 검사</button>
            <button type="button" aria-pressed={checkProfile==='thorough'} disabled={loading || ['local','nikl','web'].includes(verifyStage)} onClick={()=>setCheckProfile('thorough')}>자료 검색 포함</button>
          </div>
          <p>{checkProfile==='fast'?'기기에 저장된 규칙으로 검사합니다. 외부 API를 호출하지 않습니다.':checkProfile==='full'?'AI와 공식 자료를 활용해 문장 전체를 검사합니다.':'AI와 공식 자료, 웹 검색까지 추가로 확인합니다. 시간이 더 걸릴 수 있습니다.'}</p>
        </section>
        <div hidden={!showTemplates} className="phrase-panel">
          <p className="phrase-panel-note">예문을 고르고 편집·복사할 때는 AI를 호출하지 않습니다. 검사창에 넣어도 검사가 자동으로 시작되지는 않습니다.</p>
          {pendingTemplate !== null && <section className="template-confirm" role="alert" tabIndex={-1} ref={templatePromptRef} aria-label="기존 글 보존 확인">
            <h3>입력해 둔 글이 있습니다</h3>
            <p>선택한 문구를 어떻게 넣을까요? 글을 바꾸거나 붙이면 이전 검사 결과는 초기화됩니다.</p>
            <div className="template-confirm-actions">
              <button type="button" onClick={() => applyTemplate(pendingTemplate, 'replace')}>기존 글 바꾸기</button>
              <button type="button" onClick={() => applyTemplate(pendingTemplate, 'append')}>기존 글 뒤에 붙이기</button>
              <button type="button" onClick={cancelTemplateInsertion}>취소</button>
            </div>
          </section>}
          {templateNotice && <p className="template-inline-notice" role="alert">{templateNotice}</p>}
          <MessageTemplates onUse={requestTemplate} onClose={closeTemplates} onFindDictionary={findCeremonyTerm} />
        </div>
        <div hidden={showTemplates}>
        {/* 입력 카드 */}
        <div className="card">
          <div className="card-head">
            <span className="icon">📝</span>
            <h2>{mode === 'check' ? '글을 입력해 주세요' : '단어를 입력해 주세요'}</h2>
            <button className="btn-clear-head" onClick={clearAll}>지우기</button>
          </div>
          <div className="ta-wrap">
            <textarea
              ref={inputRef}
              aria-label={mode === 'dict' ? '찾을 단어' : '검사할 글'}
              value={text}
              onChange={e => updateInput(e.target.value)}
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
          <p style={{ margin: '12px 0', padding: '12px 14px', border: '1px solid #a56b35', borderRadius: 8, background: '#fff8e8', color: '#55300f', lineHeight: 1.6 }}>
            빠른 검사는 글을 외부로 보내지 않습니다. 전체 검사와 기존 사전 검색은 입력한 글을 외부 AI 서비스로 전송합니다. 개인정보·민감정보는 입력하지 마세요. 결과가 틀릴 수 있으니 확인해 주세요.
          </p>
          <div className="btn-row">
            <button
              className={`btn-mode${mode === 'check' ? ' active' : ''}`}
              onClick={() => { setMode('check'); setResult(null); setDictResult(null); verifyRunRef.current++; setVerify({}); setVerifyStage(''); checkSpellingDirect(); }}
              disabled={loading}
            >✏️ 맞춤법</button>
            <button
              className={`btn-mode${mode === 'dict' ? ' active' : ''}`}
              onClick={() => { setMode('dict'); setResult(null); setDictResult(null); verifyRunRef.current++; setVerify({}); setVerifyStage(''); searchDictDirect(); }}
              disabled={loading}
            >📖 사전</button>
            <button type="button" className={`btn-mode${showExpressionSearch ? ' active' : ''}`} aria-expanded={showExpressionSearch} aria-controls="expression-search" onClick={() => setShowExpressionSearch(value => !value)}>자주 헷갈리는 표현</button>
          </div>
        </div>

        {showExpressionSearch && <section id="expression-search" className="expression-search" aria-labelledby="expression-title">
          <h2 id="expression-title">자주 헷갈리는 표현</h2>
          <p>검사할 글과 별도로 표현 자료를 검색합니다.</p>
          <form onSubmit={searchExpressions}>
            <label htmlFor="expression-query">찾을 표현</label>
            <div className="expression-search-row"><input id="expression-query" value={expressionQuery} onChange={e => { expressionRunRef.current++; expressionControllerRef.current?.abort(); setExpressionQuery(e.target.value); setExpressionResults(null); setExpressionStatus(''); }} placeholder="예) 오랜만에" /><button type="submit">자료 검색</button></div>
          </form>
          {expressionStatus && <p role="status">{expressionStatus}</p>}
          {expressionResults?.map((item, i) => <article className="expression-item" key={item.id ?? i}>
            <h3>{item.correct}</h3>{item.wrong ? <p>헷갈리는 표현: {Array.isArray(item.wrong) ? item.wrong.join(', ') : item.wrong}</p> : <p>쓰임에 따라 구분하는 표현입니다.</p>}
            <p>{item.explanation}</p>{item.example && <p>예) {item.example}</p>}
            {item.sourceUrl && /^https?:\/\//i.test(item.sourceUrl) ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">출처: {item.sourceName || item.sourceUrl}</a> : item.sourceName && <p>출처: {item.sourceName}</p>}
          </article>)}
        </section>}

        {quickActive && mode === 'check' && <div className="result-card show quick-results" ref={resultRef} aria-live="polite">
          <div className="score-banner"><div className="score-text"><h3>빠른 검사 {quickErrors.length}곳</h3><p>일부 표현만 찾는 검사입니다. 문장 전체의 정확성을 보장하지 않습니다.</p></div></div>
          <div className="errors-sec">{quickErrors.length === 0 ? <p>빠른 검사에서 찾은 항목이 없어요. 문장 전체는 전체 검사에서 확인할 수 있어요.</p> : quickErrors.map((err, i) => <div className="error-item" key={`${err.start}-${err.end}-${i}`}><div className="err-num">{i+1}</div><div className="err-body"><div className="err-words"><span className="word-wrong">{err.wrong}</span> → <span className="word-right">{err.right}</span></div><p>위치: {Array.from(text.slice(0, err.start)).length + 1}~{Array.from(text.slice(0, err.end)).length}번째</p><div className="err-reason">{err.reason}</div><div className="accuracy-choice"><button type="button" onClick={() => applyQuick(err)}>이 위치만 바꾸기</button></div></div></div>)}</div>
        </div>}

        {/* 로딩 */}
        {loading && (
          <div className="loading-card show">
            <div className="spinner"></div>
            <p className="loading-text">{mode === 'dict' ? '사전을 찾고 있습니다...' : '글을 꼼꼼히 살펴보고 있습니다...'}</p>
            <p className="loading-hint">{progress || '오류 후보를 찾고 있어요. 자동 재시도 없이 결과를 확인합니다.'}</p>
            <button type="button" className="check-cancel" onClick={cancelInspection}>검사 취소</button>
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
                <h3>{result.hasErrors ? `AI 제안 ${result.errors.length}곳 · 적용 ${correction.appliedCount}곳` : 'AI 교정 제안이 없어요'}</h3>
                <p>{result.overallComment}</p>
              </div>
            </div>
            {verifyStage && verifyStage !== 'done' && verifyStage !== 'error' && (
              <div className="verify-status">
                <div className="spinner small"></div>
                {verifyStage === 'local' ? '제공된 공식 자료로 독립 대조 중입니다. 실시간 웹 검색은 생략합니다.' : verifyStage === 'nikl' ? '국립국어원 자료로 한 번 더 확인하고 있어요' : '국립국어원에 없는 항목은 웹에서 찾고 있어요'}
                <button type="button" className="check-cancel" onClick={cancelInspection}>검사 취소</button>
              </div>
            )}
            {verifyStage === 'done' && (
              <div className="verify-status done">
                AI의 공식 자료 대조 결과: 국립국어원 자료 {Object.values(verify).filter(v => v.source === 'nikl').length}개 발견 · 웹 자료 {Object.values(verify).filter(v => v.source === 'web').length}개 발견 · 근거 미확인 {Object.values(verify).filter(v => v.source === 'none').length}개 · 검증 응답 누락·실패 {Object.values(verify).filter(v => v.verificationFailed).length}개
              </div>
            )}
            {elapsedMs!==null && <p className="check-time" role="status">{result.profile==='full'?'전체 검사':'자료 검색 포함'} 완료 · {(elapsedMs/1000).toFixed(1)}초{result.profile==='full'?' · 실시간 웹 검색 생략':''}</p>}
            {verifyStage==='done' && result.profile==='full' && <div className="check-more"><button type="button" onClick={()=>checkSpellingDirect(result.originalText,'thorough')}>자료 검색까지 다시 검사</button><p>더 많은 자료를 찾아 원문부터 다시 검사합니다. 직접 선택한 적용·유지 내용은 초기화되며 시간이 더 걸립니다.</p></div>}
            <div className="corrected-sec">
              <div className="sec-label">교정된 글</div>
              <div className="corrected-text">{correction.segments.map((segment, i) => segment.marked ? <mark key={segment.id || i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>)}</div>
            </div>
            {result.errors?.length > 0 && (
              <div className="errors-sec">
                <div className="sec-label" style={{marginBottom:'12px'}}>수정 내역</div>
                <div className="review-view-switch" role="group" aria-label="수정 확인 방식">
                  <button type="button" aria-pressed={reviewMode === 'all'} onClick={() => setReviewMode('all')}>전체 목록</button>
                  <button type="button" aria-pressed={reviewMode === 'simple'} onClick={() => setReviewMode('simple')}>하나씩 크게 확인</button>
                </div>
                {reviewMode === 'simple' ? <EasyReview original={result.originalText} errors={result.errors} verify={verify} verifyStage={verifyStage} onChoose={chooseCorrection} renderDetails={renderEvidence} /> : result.errors.map((err, i) => (
                  <div key={err.id} className="error-item" style={{animationDelay: i*0.05+'s'}}>
                    <div className="err-num">{i+1}</div>
                    <div className="err-body">
                      <div className="err-words">
                        <span className="word-wrong">{err.wrong}</span>
                        <span style={{color:'var(--ink-faint)'}}>→</span>
                        <span className="word-right">{err.right}</span>
                        <span className="err-type">{err.type}</span>
                      </div>
                      {err.aiRight && <div className="err-override">AI의 공식 자료 대조 결과 제안: {err.aiRight} → {err.right}. 자료 발견이 정답을 보장하지는 않습니다.</div>}
                      <div className="err-reason">{err.explain || err.reason}</div>
                      {err.example && <div className="err-example">예) {err.example}</div>}
                      <p>{err.manual === 'apply' ? '직접 적용 선택' : err.manual === 'keep' ? '직접 원문 유지 선택' : err.status === 'applied' ? 'AI의 공식 자료 대조 결과를 적용했어요' : err.status === 'pending' ? '자료 대조 중 · 원문 유지' : err.status === 'kept' && verify[err.id]?.source === 'nikl' && verify[err.id]?.verdict === '둘다가능' ? '원문도 허용되어 유지' : err.status === 'kept' ? '원문 유지' : '근거 미확인 제안 · 원문 유지'}</p>
                      {(err.start === null || err.overlap) && <p>위치가 모호하거나 다른 제안과 겹쳐 적용할 수 없어요.</p>}
                      <div className="accuracy-choice">
                        <button type="button" disabled={err.start === null || err.overlap} aria-pressed={err.manual === 'apply'} onClick={() => chooseCorrection(err.id, 'apply')}>이 교정 적용</button>
                        <button type="button" aria-pressed={err.manual === 'keep'} onClick={() => chooseCorrection(err.id, 'keep')}>원문 유지</button>
                      </div>
                      <details className="review-evidence">
                        <summary>근거와 자료 대조 자세히 보기</summary>
                        {renderEvidence(err, i)}
                      </details>
                    </div>
                    <button className="btn-star" onClick={() => toggleSave(err)}>
                      {isItemSaved(err.wrong, err.right) ? '⭐' : '☆'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="copy-row">
              <button className={`btn-copy${copied === correction.text ? ' copied' : ''}`} onClick={copyText}>
                {copied === correction.text ? '✅ 복사되었습니다!' : '📋 교정된 글 복사하기'}
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
                  <div className="saved-reason">{s.explain || s.reason}</div>
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
        </div>
      </main>
      <footer style={{ textAlign: 'center', padding: '20px' }}>
        <a href="/privacy">개인정보처리방침</a> · <a href="/sources">자료와 검증 방식</a>
      </footer>

    </>
  );
}
