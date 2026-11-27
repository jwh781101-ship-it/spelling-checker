import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const section = (start, end) => { const a = page.indexOf(start), b = page.indexOf(end, a); assert.ok(a >= 0 && b > a); return page.slice(a,b); };
function harness(initial) {
  const check = section('  async function checkSpellingDirect(', '  async function runVerify(');
  const input = section('  function updateInput(', '  async function checkSpelling()');
  const make = new Function('initial', `
    let text=initial; let state={}; const verifyRunRef={current:0}, requestControllerRef={current:null}, resultRef={current:null};
    let resolveAI; const pending=new Promise(r=>{resolveAI=r});
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
    __CHECK__
    __INPUT__
    return {state, checkSpellingDirect, applyQuick, resolveAI, verifyRunRef};
  `.replace('__CHECK__', check).replace('__INPUT__', input));
  return make(initial);
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
    const state={}; const verifyRunRef={current:1}; let resolveVerification;
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
