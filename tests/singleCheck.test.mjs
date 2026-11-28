import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const section = (start, end) => { const a = page.indexOf(start), b = page.indexOf(end, a); assert.ok(a >= 0 && b > a); return page.slice(a,b); };
function harness(initial, previous = null) {
  const helpers = section('  function restorePreviousResult(', '  async function checkSpellingDirect(');
  const check = section('  async function checkSpellingDirect(', '  async function runVerify(');
  const input = section('  function updateInput(', '  async function checkSpelling()');
  const make = new Function('initial', 'previous', `
    let text=initial; let state={}; const verifyRunRef={current:0}, requestControllerRef={current:null}, resultRef={current:{scrollIntoView:()=>state.scrolled=true}}, retryBackupRef={current:null};
    const result=previous, verify={a:{source:'nikl'}}, aiRules=['rule'], elapsedMs=42; let verifyStage='done', loading=false, dictResult=null;
    let resolveAI, rejectAI; const pending=new Promise((r,j)=>{resolveAI=r;rejectAI=j});
    const callAI=(...args)=>{state.call=args; return pending};
    const splitTextWithContext=t=>[{text:t,start:0}];
    const anchorEdits=(t,e)=>e;
    const anchorChunkEdits=(t,e)=>e;
    const findQuickErrors=t=>t.includes('몇일') ? [{wrong:'몇일',right:'며칠',start:t.indexOf('몇일'),end:t.indexOf('몇일')+2}] : [];
    const runVerify=(t,p,id,o)=>{state.verification=o};
    const setTimeout=fn=>{(state.timers ||= []).push(fn)};
    const setErrorMsg=v=>state.error=v, setQuickActive=v=>state.quick=v, setElapsedMs=v=>state.elapsed=v,
      setVerify=v=>state.verify=v, setVerifyStage=v=>{verifyStage=v;state.stage=v}, setAiRules=v=>state.rules=v,
      setLoading=v=>{loading=v;state.loading=v}, setResult=v=>state.result=v, setDictResult=v=>{dictResult=v;state.dict=v},
      setProgress=v=>state.progress=v, setText=v=>{text=v;state.text=v};
    const friendlyError=()=> 'failed';
    __HELPERS__
    __CHECK__
    __INPUT__
    return {state, checkSpellingDirect, applyQuick, updateInput, cancelInspection, resolveAI, rejectAI, verifyRunRef};
  `.replace('__HELPERS__', helpers).replace('__CHECK__', check).replace('__INPUT__', input));
  return make(initial, previous);
}
test('로컬 후보가 없어도 즉시 fast AI 검사와 공식자료 대조를 시작한다', async () => {
  const h=harness('반가워요'); const done=h.checkSpellingDirect();
  assert.equal(h.state.quick,true); assert.equal(h.state.call[0],'check'); assert.equal(h.state.call[4].profile,'fast');
  h.resolveAI({errors:[]}); await done;
  assert.equal(h.state.result.originalText,'반가워요'); assert.equal(h.state.verification.profile,'fast');
});
test('후보 적용은 요청 abort 및 세대 무효화 후 늦은 응답을 버린다', async () => {
  const h=harness('몇일'); const done=h.checkSpellingDirect(); const signal=h.state.call[4].signal;
  h.applyQuick({start:0,end:2,wrong:'몇일',right:'며칠'});
  assert.equal(signal.aborted,true); assert.equal(h.state.text,'며칠'); assert.match(h.state.error.text,/이미 발생한 AI 이용 비용은 취소되지 않을 수 있습니다/);
  h.resolveAI({errors:[{wrong:'몇일',right:'며칠'}]}); await done;
  assert.equal(h.state.result,null); assert.equal(h.state.verification,undefined);
});
test('추가 자료 검색은 명시적 thorough 재검사만 사용한다', async () => {
  const h=harness('글입니다'); const done=h.checkSpellingDirect(undefined,'thorough');
  assert.equal(h.state.call[4].profile,'thorough'); h.resolveAI({errors:[]}); await done;
  assert.equal(h.state.verification.profile,'thorough');
});
test('독립 표현 검색은 원문과 유료 검사 함수에 접근하지 않는다', () => {
  const body=section('  async function searchExpressions(', '  function updateInput(');
  assert.doesNotMatch(body,/setText|updateInput|callAI|checkSpellingDirect|searchDictDirect/);
  assert.match(body,/\/api\/expressions/);
  assert.match(page,/hidden=\{showTemplates \|\| showExpressionSearch\}/);
  assert.doesNotMatch(page,/aria-label="검사 속도 선택"/);
  assert.match(page,/자료 검색까지 다시 검사/);
});

test('공식 자료 대조가 진행 중 취소되면 늦은 대조 응답도 반영하지 않는다', async () => {
  const source = section('  async function runVerify(', '  function chooseCorrection(');
  const make = new Function(`
    const state={}; const verifyRunRef={current:1}, retryBackupRef={current:null}; const restorePreviousResult=()=>false; let resolveVerification;
    const pending=new Promise(r=>{resolveVerification=r});
    const fetchRules=async()=>[]; const contextOf=()=>'';
    const verifyInBatches=(stage,items,options)=>{state.args={stage,items,options};return pending};
    const setVerifyStage=v=>state.stage=v, setAiRules=v=>state.rules=v, setVerify=v=>state.verify=v,
      setResult=v=>state.result=v, setElapsedMs=v=>state.elapsed=v;
    const applyVerifiedEdits=()=>{throw Error('취소된 결과를 적용하면 안 됩니다')};
    const missingVerification=()=>({});
    ${source}
    return {state, verifyRunRef, runVerify, resolveVerification};
  `);
  const h=make(), controller=new AbortController();
  const done=h.runVerify('몇일',{errors:[{id:'a',wrong:'몇일',right:'며칠'}]},1,{profile:'fast',signal:controller.signal,startedAt:Date.now()});
  assert.equal(h.state.stage,'local'); assert.equal(h.state.args.stage,'local');
  h.verifyRunRef.current++; controller.abort(); h.resolveVerification([{id:'a',source:'nikl'}]); await done;
  assert.equal(h.state.result,undefined); assert.equal(h.state.verify,undefined); assert.equal(h.state.elapsed,undefined);
});

test('위치가 원문과 다르면 참고 후보를 적용하거나 검사를 중단하지 않는다', async () => {
  const h=harness('몇일'); const done=h.checkSpellingDirect(); const signal=h.state.call[4].signal;
  h.applyQuick({start:0,end:1,wrong:'몇일',right:'며칠'});
  assert.equal(signal.aborted,false); assert.equal(h.state.text,undefined);
  h.resolveAI({errors:[]}); await done; assert.equal(h.state.result.originalText,'몇일');
});

test('자료 검색 재검사 실패 시 기존 수동 선택과 자료 대조 결과 복원', async () => {
  const previous={originalText:'몇일',errors:[{id:'a',manual:'keep'}],profile:'full'};
  const h=harness('몇일',previous), done=h.checkSpellingDirect(undefined,'thorough');
  const signal=h.state.call[4].signal; h.rejectAI(new Error('network')); await done;
  assert.equal(signal.aborted,true); assert.equal(h.state.result,previous); assert.equal(h.state.result.errors[0].manual,'keep');
  assert.deepEqual(h.state.verify,{a:{source:'nikl'}}); assert.equal(h.state.stage,'done'); assert.equal(h.state.elapsed,42);
  assert.match(h.state.error.text,/끝나지 않아/); assert.match(h.state.error.text,/복원/);
});

test('자료 검색 재검사 취소 시 이전 결과를 복원하고 늦은 응답을 버린다', async () => {
  const previous={originalText:'몇일',errors:[{id:'a',manual:'apply'}],profile:'full'};
  const h=harness('몇일',previous), done=h.checkSpellingDirect(undefined,'thorough');
  const signal=h.state.call[4].signal; h.cancelInspection();
  assert.equal(signal.aborted,true); assert.equal(h.state.result,previous); assert.equal(h.state.result.errors[0].manual,'apply');
  h.resolveAI({errors:[]}); await done; assert.equal(h.state.result,previous); assert.match(h.state.error.text,/복원/);
});

test('여러 청크 중 하나가 실패하면 다른 요청도 즉시 abort하고 미완료를 알린다', async () => {
  const source=section('  async function checkSpellingDirect(', '  async function runVerify(');
  const make=new Function(`
    const state={}; const text='긴 글'; const result=null, verify={}, verifyStage='', aiRules=[], elapsedMs=null;
    const retryBackupRef={current:null}, requestControllerRef={current:null}, verifyRunRef={current:0};
    const splitTextWithContext=()=>[{text:'첫 글'},{text:'둘째 글'}];
    let rejectFirst; const first=new Promise((_,reject)=>{rejectFirst=reject});
    const callAI=(mode,t,a,b,opt)=>{(state.signals ||= []).push(opt.signal);return t==='첫 글'?first:new Promise(()=>{});};
    const restorePreviousResult=()=>false, friendlyError=()=> '실패';
    const setErrorMsg=v=>state.error=v, setQuickActive=()=>{}, setElapsedMs=()=>{}, setVerify=()=>{}, setVerifyStage=()=>{}, setAiRules=()=>{}, setLoading=()=>{}, setResult=()=>{}, setDictResult=()=>{}, setProgress=()=>{};
    __SOURCE__
    return {state,checkSpellingDirect,rejectFirst};
  `.replace('__SOURCE__',source));
  const h=make(), done=h.checkSpellingDirect(); assert.equal(h.state.signals.length,2);
  h.rejectFirst(new Error('one failed')); await done;
  assert.ok(h.state.signals.every(signal=>signal.aborted)); assert.match(h.state.error.text,/끝나지 않아/); assert.match(h.state.error.text,/부분 결과는 표시하지/);
});

test('사전 유효성 검사 실패 시 모드와 기존 결과, 진행 중 요청을 변경하지 않는다', async () => {
  const source=section('  async function searchDictDirect(', '  async function searchExpressions(');
  const make=new Function('text', `
    const state={}; const retryBackupRef={current:null}, requestControllerRef={current:{abort:()=>state.aborted=true}}, verifyRunRef={current:3};
    const setErrorMsg=v=>state.error=v, setMode=()=>state.changed=true, setVerify=()=>state.changed=true, setAiRules=()=>state.changed=true, setVerifyStage=()=>state.changed=true, setElapsedMs=()=>state.changed=true, setLoading=()=>state.changed=true, setResult=()=>state.changed=true, setDictResult=()=>state.changed=true, setQuickActive=()=>state.changed=true;
    __SOURCE__
    return {state,searchDictDirect,verifyRunRef};
  `.replace('__SOURCE__',source));
  const h=make('가'.repeat(31)); await h.searchDictDirect();
  assert.equal(h.state.aborted,undefined); assert.equal(h.state.changed,undefined); assert.equal(h.verifyRunRef.current,3); assert.match(h.state.error.text,/단어 하나/);
  assert.match(page,/onClick=\{\(\) => searchDictDirect\(\)\}/);
});

test('다른 메뉴에서도 진행 표시와 취소를 제공하고 대조 미완료를 명시한다', () => {
  assert.match(page,/\(showTemplates \|\| showExpressionSearch\).*loading \|\| \['local','nikl','web'\]/);
  assert.match(page,/진행 중이던 자료 대조는 끝나지 않았습니다/);
  assert.match(page,/onClick=\{cancelInspection\}>검사 취소/);
  assert.doesNotMatch(page,/aria-pressed=\{showTemplates\} disabled=\{loading/);
});

test('웹 자료 대조 실패 시 새 결과 대신 이전 선택과 대조 결과를 복원한다', async () => {
  const source=section('  async function runVerify(', '  function chooseCorrection(');
  const restore=section('  function restorePreviousResult(', '  function cancelInspection(');
  const make=new Function(`
    const previous={originalText:'글',errors:[{id:'old',manual:'keep'}]};
    const backup={result:previous,verify:{old:{source:'nikl'}},verifyStage:'done',aiRules:['old rule'],elapsedMs:35};
    const state={result:{originalText:'글',errors:[{id:'new'}]}}, retryBackupRef={current:backup}, verifyRunRef={current:1}, requestControllerRef={current:null};
    const fetchRules=async()=>[], contextOf=()=>'', missingVerification=()=>({});
    const verifyInBatches=async(stage)=>stage==='nikl'?[{id:'new',source:'none'}]:[{id:'new',source:'none',verificationFailed:true}];
    const applyVerifiedEdits=(original,errors)=>errors;
    const setResult=v=>state.result=typeof v==='function'?v(state.result):v, setVerify=v=>state.verify=v,
      setVerifyStage=v=>state.stage=v, setAiRules=v=>state.rules=v, setElapsedMs=v=>state.elapsed=v,
      setErrorMsg=v=>state.error=v, setLoading=v=>state.loading=v, setProgress=v=>state.progress=v;
    __RESTORE__
    __RUN__
    return {state,previous,runVerify};
  `.replace('__RESTORE__',restore).replace('__RUN__',source));
  const h=make(); await h.runVerify('글',{errors:[{id:'new',wrong:'글',right:'글자'}]},1,{profile:'thorough',signal:new AbortController().signal,startedAt:Date.now()});
  assert.equal(h.state.result,h.previous); assert.equal(h.state.result.errors[0].manual,'keep');
  assert.deepEqual(h.state.verify,{old:{source:'nikl'}}); assert.equal(h.state.stage,'done'); assert.match(h.state.error.text,/복원/);
});

test('자료 검색 재검사 실패 후 복원할 때 기본 검사 재시도 버튼을 노출하지 않는다', async () => {
  const previous={originalText:'몇일',errors:[{id:'a',manual:'keep'}],profile:'full'};
  const h=harness('몇일',previous), done=h.checkSpellingDirect(undefined,'thorough');
  h.rejectAI(new Error('network')); await done;
  assert.equal(h.state.result,previous); assert.equal(h.state.error.retry,undefined);
  assert.match(h.state.error.text,/자료 검색까지 다시 검사 버튼/);
});

test('일반 검사 실패 시에는 기존 다시 해 보기 버튼을 유지한다', async () => {
  const h=harness('검사할 글'), done=h.checkSpellingDirect(); h.rejectAI(new Error('network')); await done;
  assert.equal(h.state.error.retry,'check'); assert.match(h.state.error.text,/부분 결과는 표시하지/);
});

test('AI 제안이 없어도 먼저 찾은 날짜 표현이 있으면 AI 결과로 이동하지 않고 안내한다', async () => {
  const h=harness('오늘은 몇일인가요?'), done=h.checkSpellingDirect();
  h.resolveAI({errors:[]}); await done;
  assert.equal(h.state.result.hasErrors,false); assert.equal(h.state.timers,undefined);
  assert.match(page,/!result\.hasErrors && currentQuickErrors\.length > 0/);
  assert.match(page,/먼저 찾은 표현 \{currentQuickErrors\.length\}곳은 위에서 확인해 주세요/);
});

test('로컬 후보가 없으면 결과로 이동하지만 원문 변경 후 예약된 이동은 무효화한다', async () => {
  const h=harness('안녕하세요'), done=h.checkSpellingDirect(); h.resolveAI({errors:[]}); await done;
  assert.equal(h.state.timers.length,1); h.updateInput('글이 바뀌었어요'); h.state.timers[0]();
  assert.equal(h.state.scrolled,undefined); assert.equal(h.state.result,null);
  const h2=harness('안녕하세요'), done2=h2.checkSpellingDirect(); h2.resolveAI({errors:[]}); await done2;
  h2.state.timers[0](); assert.equal(h2.state.scrolled,true);
});

test('같은 위치와 같은 원문·제안인 경우만 중복으로 세고 각 로컬 후보는 한 번만 센다', () => {
  const source=section('function countDuplicateQuickErrors(', 'export default function Home()');
  const count=new Function(source+';return countDuplicateQuickErrors')();
  const local=[{start:4,end:6,wrong:'몇일',right:'며칠'},{start:9,end:11,wrong:'몇일',right:'며칠'}];
  assert.equal(count(local,[{...local[0]},{...local[0]},{...local[1],right:'다른 표현'}]),1);
  assert.equal(count(local,[{...local[0],start:null,end:null}]),0);
  assert.match(page,/먼저 찾은 표현 중 \{duplicateQuickCount\}곳은 아래 AI 제안과 같은 내용입니다/);
});

test('다섯 규칙은 정확히 일치하는 국립국어원 자료만 표시하며 알 수 없는 후보는 제외한다', () => {
  const raw=readFileSync(new URL('../app/data/confusables.mjs',import.meta.url),'utf8');
  const data=new Function(raw.replace('export const confusables', 'const confusables')+';return confusables')();
  const source=section('function findQuickSource(', 'function countDuplicateQuickErrors(');
  const lookup=new Function('confusables',source+';return findQuickSource')(data);
  for (const [wrong,right,id] of [['몇일','며칠','myeochil'],['오랫만','오랜만','oraenman'],['설겆이','설거지','seolgeoji'],['역활','역할','yeokhal'],['뵈요','봬요','bwaeyo']]) {
    const match=lookup({wrong,right}); assert.equal(match?.id,id); assert.match(match.sourceUrl,/^https:\/\/(?:www\.)?korean\.go\.kr\//);
  }
  assert.equal(lookup({wrong:'몇일',right:'오랜만'}),undefined);
  const unsafe=new Function('confusables',source+';return findQuickSource')([{wrong:'몇일',correct:'며칠',sourceName:'국립국어원',sourceUrl:'https://korean.go.kr.example.com/path'}]);
  assert.equal(unsafe({wrong:'몇일',right:'며칠'}),undefined);
  assert.match(page,/href=\{err\.source\.sourceUrl\} target="_blank" rel="noopener noreferrer"/);
});

test('며칠의 잘못된 AI 어원 설명은 정확한 위치·표기 일치 시 안전한 설명과 공식 출처로 대체한다', () => {
  const confRaw=readFileSync(new URL('../app/data/confusables.mjs',import.meta.url),'utf8');
  const confusables=new Function(confRaw.replace('export const confusables','const confusables')+';return confusables')();
  const quickRaw=readFileSync(new URL('../app/lib/quickCheck.mjs',import.meta.url),'utf8');
  const findQuickErrors=new Function(quickRaw.replaceAll('export ', '')+';return findQuickErrors')();
  const lookupSource=section('function findQuickSource(', 'function countDuplicateQuickErrors(');
  const findQuickSource=new Function('confusables',lookupSource+';return findQuickSource')(confusables);
  const helper=section('function safeDisplayErrors(', 'export default function Home()');
  const sameSource=section('function sameQuickAndAI(', '// 수동 선택은');
  const sameQuickAndAI=new Function(sameSource+';return sameQuickAndAI')();
  const safe=new Function('findQuickErrors','findQuickSource','sameQuickAndAI',helper+';return safeDisplayErrors')(findQuickErrors,findQuickSource,sameQuickAndAI);
  const original='오늘은 몇일인가요?';
  const input={id:'a',start:4,end:6,wrong:'몇일',right:'며칠',explain:'몇과 일의 결합으로 발음이 변해 며칠입니다.',reason:'잘못된 AI 설명',status:'needs_review',manual:'keep'};
  const out=safe(original,[input])[0];
  assert.match(out.explain,/날짜나 기간/); assert.doesNotMatch(out.explain,/결합|발음/);
  assert.equal(out.officialQuickSource.id,'myeochil'); assert.equal(out.status,'needs_review'); assert.equal(out.manual,'keep');
  assert.match(input.explain,/결합/); assert.equal(input.officialQuickSource,undefined);
  for (const change of [{start:0,end:2},{start:null,end:null},{wrong:'몇 일'},{right:'다른 표현'}]) {
    const candidate={...input,...change}; assert.equal(safe(original,[candidate])[0],candidate);
  }
  assert.match(page,/errors=\{displayErrors\} verify=\{verify\}/);
  assert.match(page,/: displayErrors\.map\(\(err, i\)/);
  assert.match(page,/verificationForDisplay\(verification, !!err\.officialQuickSource\)/);
  assert.match(page,/이 링크는 별도 자료이며 AI 대조 완료를 뜻하지 않습니다/);
});


test('공식 로컬 후보와 상충하는 AI 대조 판정은 불확실성 표시와 함께 설명을 보존한다', () => {
  const source=section('function verificationForDisplay(', 'export default function Home()');
  const display=new Function(source+';return verificationForDisplay')();
  for(const verdict of ['둘다가능','AI교정틀림','부분']) {
    const original={source:'nikl',verdict,explain:'대조 판단의 이유',verificationFailed:true};
    const shown=display(original,true);
    assert.equal(shown,original); assert.equal(shown.explain,'대조 판단의 이유'); assert.equal(shown.verificationFailed,true);
  }
  for(const verdict of ['일치','확인불가',undefined]) {
    const original={source:'nikl',verdict,explain:'검증되지 않은 설명',verificationFailed:true};
    const shown=display(original,true);
    assert.equal(shown.explain,undefined); assert.equal(shown.verdict,verdict); assert.equal(shown.verificationFailed,true);
    assert.equal(original.explain,'검증되지 않은 설명');
  }
  const unrelated={verdict:'일치',explain:'기존 AI 설명'};
  assert.equal(display(unrelated,false),unrelated); assert.equal(display(null,true),null);
  assert.ok(page.includes('AI 대조 설명 (판단이 틀릴 수 있음)'));
});

test('자료 대조 중 새 검사 및 사전 호출을 막고 상충 판단을 두 화면에서 안내한다',()=>{
 const busy="disabled={loading || ['local','nikl','web'].includes(verifyStage)}";
 assert.equal(page.split(busy).length-1,2);
 assert.match(page,/AI의 자료 대조 판단이 최초 제안과 다릅니다/);
 const easy=readFileSync(new URL('../app/components/EasyReview.js',import.meta.url),'utf8');
 assert.match(easy,/AI의 자료 대조 판단이 최초 제안과 다릅니다/);
});

test('공식 대조 실패는 웹 미발견과 구별하고 사전 출처를 명시한다',async()=>{
  const source=section('  async function runVerify(', '  function chooseCorrection(');
  const make=new Function(`
    const state={calls:[]}, verifyRunRef={current:1}, retryBackupRef={current:null};
    const fetchRules=async()=>{state.rulesCalled=true;return []}, contextOf=()=>'';
    const verifyInBatches=async(stage,items)=>{state.calls.push(stage);return items.map(x=>({id:x.id,source:'none',verificationFailed:true}))};
    const restorePreviousResult=()=>false, applyVerifiedEdits=(o,e)=>e, missingVerification=()=>({});
    const setResult=()=>{}, setVerify=()=>{}, setVerifyStage=()=>{}, setAiRules=()=>{}, setElapsedMs=()=>{}, setErrorMsg=()=>{};
    ${source}
    return {state,runVerify};
  `);
  const h=make();await h.runVerify('글',{errors:[{id:'a',wrong:'글',right:'글자'}]},1,{profile:'thorough',signal:new AbortController().signal,startedAt:Date.now()});
  assert.deepEqual(h.state.calls,['nikl']);assert.equal(h.state.rulesCalled,undefined);
  assert.match(page,/AI가 작성한 뜻풀이이며 공식 사전을 실시간 조회한 결과가 아닙니다/);
  assert.match(page,/앱에 저장된 부고 용어 설명/);
});

test('표현 메뉴는 처음에 전체 목록을 보이고 검색 후 전체로 되돌릴 수 있다',()=>{
 const sectionBody=section('        {showExpressionSearch && <section id="expression-search"','        <div hidden={showTemplates || showExpressionSearch}>');
 assert.match(sectionBody,/전체 \{confusables\.length\}개 표현/);
 assert.match(sectionBody,/\(expressionResults \?\? confusables\)\.map/);
 assert.match(sectionBody,/<details className="expression-item"/);
 assert.match(sectionBody,/전체 표현 다시 보기/);
 assert.match(sectionBody,/setExpressionQuery\(''\); setExpressionResults\(null\)/);
 const search=section('  async function searchExpressions(', '  function updateInput(');
 assert.match(search,/if \(!q\) \{ setExpressionResults\(null\); setExpressionStatus\(''\); return; \}/);
 assert.doesNotMatch(search,/callAI|checkSpellingDirect|setText/);
});

test('조사를 포함한 같은 교정만 빠른 후보와 합친다',()=>{
 const body=section('function sameQuickAndAI(', '// 수동 선택은'); const same=new Function(body+';return sameQuickAndAI')();
 const local={start:0,end:3,wrong:'오랫만',right:'오랜만'};
 assert.equal(same(local,{start:0,end:4,wrong:'오랫만에',right:'오랜만에'}),true);
 assert.equal(same(local,{start:0,end:4,wrong:'오랫만에',right:'오랜만으로'}),false);
 assert.equal(same(local,{start:1,end:5,wrong:'오랫만에',right:'오랜만에'}),false);
});
