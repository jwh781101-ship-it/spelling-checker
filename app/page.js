'use client';
import { useState, useEffect, useRef } from 'react';

const SYSTEM_CHECK = `당신은 국립국어원 한글 맞춤법 규정(문화체육관광부 고시 제2017-12호)을 기준으로 맞춤법을 검사하는 전문가입니다.
핵심 규정:
[총칙] 제1항: 표준어를 소리대로 적되 어법에 맞도록 함. 제2항: 각 단어는 띄어 씀.
[두음법칙] 녀→여, 뇨→요, 년→연 등
[띄어쓰기] 조사는 붙여쓰기, 의존명사·보조용언은 띄어쓰기
[혼동표현] 오랫만에→오랜만에, 왠지O/웬지X, 어떡해O/어떻해X, 며칠O/몇일X, 금세O/금새X, 이따가O/있다가X, 안 돼O/안 되X, 어이없다O/어의없다X, 설레다O/설레이다X
JSON으로만 응답. 마크다운 없이 순수 JSON:
{"hasErrors":true,"correctedText":"교정된 전체 문장","errors":[{"wrong":"틀린표현","right":"올바른표현","type":"맞춤법|띄어쓰기|용례|표현","reason":"쉬운 설명 + 국립국어원 근거","example":"올바른 예시"}],"overallComment":"총평 1-2문장"}`;

const SYSTEM_DICT = `당신은 국립국어원 표준국어대사전을 기반으로 한국어 단어를 설명하는 전문가입니다.

반드시 다음 규칙을 따르세요:
- 표준국어대사전에 등재된 뜻만 정확하게 설명할 것
- 임의의 사회적 판단, 도덕적 주석, 사용 권고/비권고 의견을 절대 추가하지 말 것
- 사전에 없는 뜻을 추측하거나 만들어내지 말 것
- 한자어는 한자 표기도 함께 제공할 것
- 동음이의어가 있으면 모두 설명할 것

입력된 단어의 사전 정보를 JSON으로만 반환하세요. 마크다운 없이 순수 JSON.
형식:
{"word":"단어","hanja":"한자(있을 경우)","pronunciation":"발음(필요시)","meanings":[{"pos":"품사","definition":"표준국어대사전 기준 뜻풀이","example":"예문"}],"synonyms":["유의어1","유의어2"],"antonyms":["반의어1"],"note":"어원이나 용법 등 사전적 참고사항(있을 경우에만, 사회적 판단 절대 금지)"}
- meanings는 최대 3개
- synonyms, antonyms는 없으면 빈 배열
- note는 없으면 빈 문자열
- 어르신도 이해할 수 있게 쉽게 설명`;

const SYSTEM_TIPS = `국립국어원 한글 맞춤법 기준으로 맞춤법 팁을 JSON으로만 반환. 마크다운 없이 순수 JSON.
형식: {"tips":[{"wrong":"틀린표현","right":"올바른표현","desc":"20자 이내 쉬운 설명"}]}
규칙: 정확히 6개. 금세/오랜만에/왠지/며칠/어떡해/이따가 등 흔한 예시 절대 금지. 덜 알려진 것 위주. 매번 다른 카테고리(동사혼동/띄어쓰기/발음표기/조사어미/외래어/순우리말)에서 각 1개씩.`;

function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escRx(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

async function callAPI(system, userMsg, maxTokens = 1000) {
  const res = await fetch('/api/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMsg }]
    })
  });
  return res.json();
}

export default function Home() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('check'); // 'check' | 'dict'
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dictResult, setDictResult] = useState(null);
  const [tips, setTips] = useState([]);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [saved, setSaved] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [fontScale, setFontScale] = useState(0);
  const recognitionRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    const s = localStorage.getItem('bareun_saved');
    if (s) setSaved(JSON.parse(s));
    loadTips();
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = (18 + fontScale * 2) + 'px';
  }, [fontScale]);

  async function loadTips() {
    setTipsLoading(true);
    try {
      const data = await callAPI(SYSTEM_TIPS,
        `시드: ${Date.now() + Math.floor(Math.random()*99999)}. 6가지 카테고리에서 각 1개씩, 흔하지 않은 팁 6개 주세요.`, 600);
      const raw = data.content[0].text.replace(/```json\n?|```/g, '').trim();
      setTips(JSON.parse(raw).tips);
    } catch(e) { setTips([]); }
    finally { setTipsLoading(false); }
  }

  async function checkSpellingDirect(inputText) {
    const t = (inputText || text).trim();
    if (!t) { alert('글을 먼저 입력해 주세요.'); return; }
    if (t.length < 2) { alert('조금 더 길게 입력해 주세요.'); return; }
    setLoading(true); setResult(null); setDictResult(null);
    try {
      const data = await callAPI(SYSTEM_CHECK, `다음 글을 검사해주세요:\n\n${t}`);
      const raw = data.content[0].text.replace(/```json\n?|```/g, '').trim();
      setResult(JSON.parse(raw));
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch(e) { alert('오류: ' + e.message); }
    finally { setLoading(false); }
  }

  async function searchDictDirect(inputText) {
    const t = (inputText || text).trim();
    if (!t) { alert('단어를 먼저 입력해 주세요.'); return; }
    setLoading(true); setResult(null); setDictResult(null);
    try {
      // 1차: 표준국어대사전 API 직접 조회
      const dictRes = await fetch('/api/dict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: t })
      });
      const dictData = await dictRes.json();

      if (dictData.items && dictData.items.length > 0) {
        // 표준국어대사전에서 찾은 경우 → 그대로 표시
        const first = dictData.items[0];
        setDictResult({
          word: first.word,
          hanja: first.hanja,
          pronunciation: '',
          meanings: first.senses.slice(0, 3).map(s => ({
            pos: first.pos,
            definition: s.definition,
            example: s.example
          })),
          synonyms: [],
          antonyms: [],
          note: dictData.items.length > 1
            ? `동음이의어 ${dictData.items.length}개가 있습니다: ${dictData.items.map(i => i.word + (i.hanja ? `(${i.hanja})` : '')).join(', ')}`
            : '',
          source: '표준국어대사전'
        });
      } else {
        // 2차: 표준국어대사전에 없으면 Claude로 fallback
        const data = await callAPI(SYSTEM_DICT, `다음 단어를 찾아주세요: ${t}`);
        const raw = data.content[0].text.replace(/```json\n?|```/g, '').trim();
        const parsed = JSON.parse(raw);
        parsed.source = 'AI';
        setDictResult(parsed);
      }
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch(e) { alert('오류: ' + e.message); }
    finally { setLoading(false); }
  }

  async function checkSpelling() { await checkSpellingDirect(); }
  async function searchDict() { await searchDictDirect(); }

  function clearAll() {
    setText(''); setResult(null);
  }

  function toggleVoice() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('음성 입력은 Chrome/Safari에서 지원됩니다.'); return;
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
      if (final) setText(prev => prev + final);
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
    });
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
              onClick={() => { setMode('check'); setResult(null); setDictResult(null); checkSpellingDirect(); }}
              disabled={loading}
            >✏️ 맞춤법</button>
            <button
              className={`btn-mode${mode === 'dict' ? ' active' : ''}`}
              onClick={() => { setMode('dict'); setResult(null); setDictResult(null); searchDictDirect(); }}
              disabled={loading}
            >📖 사전</button>
          </div>
        </div>

        {/* 로딩 */}
        {loading && (
          <div className="loading-card show">
            <div className="spinner"></div>
            <p className="loading-text">글을 꼼꼼히 살펴보고 있습니다...</p>
          </div>
        )}

        {/* 결과 */}
        {result && (
          <div className="result-card show" ref={resultRef}>
            <div className={`score-banner ${result.hasErrors ? 'has-errors' : 'perfect'}`}>
              <span className="score-emoji">{result.hasErrors ? '📌' : '🎉'}</span>
              <div className="score-text">
                <h3>{result.hasErrors ? `${result.errors.length}곳을 고쳐드렸어요` : '완벽합니다!'}</h3>
                <p>{result.overallComment}</p>
              </div>
            </div>
            <div className="corrected-sec">
              <div className="sec-label">교정된 글</div>
              <div className="corrected-text" dangerouslySetInnerHTML={{
                __html: (result.errors || []).reduce((txt, e) =>
                  txt.replace(new RegExp(escRx(e.right), 'g'), `<mark>${e.right}</mark>`),
                  result.correctedText)
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
                      <div className="err-reason">{err.reason}</div>
                      {err.example && <div className="err-example">예) {err.example}</div>}
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
                <p style={{fontSize:'0.72rem',color:'#5a7abf',marginTop:'2px'}}>
                  {dictResult.source === '표준국어대사전' ? '📚 국립국어원 표준국어대사전' : '🤖 AI 추정 (표준국어대사전 미등재)'}
                </p>
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
            <button className="btn-refresh" onClick={loadTips} disabled={tipsLoading}>🔄 새로 받기</button>
          </div>
          {tipsLoading ? (
            <div style={{textAlign:'center',padding:'16px',color:'var(--ink-faint)'}}>✨ 불러오는 중...</div>
          ) : tips.map((t, i) => (
            <div key={i} className="tip-item">
              <span className="tip-dot">◆</span>
              <span><b>{t.wrong} → {t.right}</b> &nbsp;{t.desc}</span>
            </div>
          ))}
          <p className="tips-src">출처: 국립국어원 한글 맞춤법(문화체육관광부 고시 제2017-12호)</p>
        </div>
      </main>

      {/* 글자 크기 */}
      <div className="font-ctrl">
        <button className="font-btn" onClick={() => setFontScale(s => Math.min(4, s+1))}>가+</button>
        <span className="font-lbl">글자</span>
        <button className="font-btn" onClick={() => setFontScale(s => Math.max(-2, s-1))}>가-</button>
      </div>
    </>
  );
}
