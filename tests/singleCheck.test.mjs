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
    let text=initial; let state={}; const verifyRunRef={current:0}, requestControllerRef={current:null}, resultRef={current:null}, retryBackupRef={current:null};
    const result=previous, verify={a:{source:'nikl'}}, verifyStage='done', aiRules=['rule'], elapsedMs=42;
    let resolveAI, rejectAI; const pending=new Promise((r,j)=>{resolveAI=r;rejectAI=j});
    const callAI=(...args)=>{state.call=args; return pending};
    const splitTextWithContext=t=>[{text:t,start:0}];
    const anchorEdits=(t,e)=>e;
    const runVerify=(t,p,id,o)=>{state.verification=o};
    const setTimeout=()=>{};
    const setErrorMsg=v=>state.error=v, setQuickActive=v=>state.quick=v, setElapsedMs=v=>state.elapsed=v,
      setVerify=v=>state.verify=v, setVerifyStage=v=>state.stage=v, setAiRules=v=>state.rules=v,
      setLoading=v=>state.loading=v, setResult=v=>state.result=v, setDictResult=v=>state.dict=v,
      setProgress=v=>state.progress=v, setText=v=>{text=v;state.text=v};
    const friendlyError=()=> 'failed';
    __HELPERS__
    __CHECK__
    __INPUT__
    return {state, checkSpellingDirect, applyQuick, cancelInspection, resolveAI, rejectAI, verifyRunRef};
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
  assert.equal(signal.aborted,true); assert.equal(h.state.text,'며칠'); assert.match(h.state.error.text,/다시 눌러/);
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
