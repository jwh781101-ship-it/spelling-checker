import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCorrection } from '../app/lib/corrections.mjs';
import { applyVerifiedEdits } from '../app/lib/checkFlow.mjs';
const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/components/home-features.css', import.meta.url), 'utf8');
const helpers = page.slice(page.indexOf('function sameQuickAndAI('), page.indexOf('function safeDisplayErrors('));
const { sameQuickAndAI, resultOverview } = new Function(helpers + '; return { sameQuickAndAI, resultOverview };')();
const q = {start:0,end:2,wrong:'몇일',right:'며칠'};
const ai = {...q,id:'a',status:'needs_review'};
test('같은 위치와 원문과 제안만 합치고 다른 후보는 보존한다', () => {
  assert.equal(sameQuickAndAI(q,ai),true);
  for (const x of [{...ai,start:3,end:5},{...ai,right:'몇 일'},{...ai,wrong:'다른'},{...ai,start:null,end:null}]) assert.equal(sameQuickAndAI(q,x),false);
  const extra={start:3,end:5,wrong:'몇일',right:'며칠'};
  const o=resultOverview([ai],[q,extra],buildCorrection('몇일 몇일',[ai]));
  assert.deepEqual(o.uniqueQuick,[extra]); assert.equal(o.suggested,2); assert.equal(o.review,2);
});
test('실제 반영, 직접 유지와 미확인 수를 구분한다', () => {
  const errors=[{...ai,manual:'apply'},{id:'b',start:3,end:5,wrong:'몇일',right:'며칠',manual:'keep',status:'applied'},{id:'c',start:null,end:null,wrong:'x',right:'y',status:'needs_review'}];
  const c=buildCorrection('몇일 몇일',errors); const o=resultOverview(errors,[],c);
  assert.equal(c.text,'며칠 몇일'); assert.equal(o.applied,1); assert.equal(o.review,1); assert.ok(o.appliedIds.has('a')); assert.ok(!o.appliedIds.has('b'));
});
test('겹치거나 위치가 불명확한 자동 적용 후보는 반영 수에 포함하지 않는다', () => {
  const errors=[{...ai,status:'applied',overlap:true},{id:'b',start:null,end:null,wrong:'x',right:'y',status:'needs_review'}];
  const o=resultOverview(errors,[],buildCorrection('몇일',errors)); assert.equal(o.applied,0); assert.equal(o.review,2);
});
test('수동 선택은 비동기 자료 대조 후에도 보존된다', () => {
  const errors=[{...ai,manual:'keep'},{...ai,id:'b',manual:'apply'}];
  const result=applyVerifiedEdits('몇일',errors,{}); assert.deepEqual(result.map(e=>e.manual),['keep','apply']);
});
test('요약 이동, 선택 상태, 터치 크기와 초점 스타일이 연결된다', () => {
  assert.match(page,/aria-label="검사 결과 요약"/); for(const id of ['result-suggestions','result-applied','result-review-needed']) assert.ok(page.includes(id));
  assert.match(page,/aria-pressed=\{overview\.appliedIds\.has\(err\.id\)\}/); assert.match(page,/선택됨/);
  assert.match(css,/\.result-card \.accuracy-choice button\{[^}]*min-height:48px/); assert.match(css,/\.result-card \.accuracy-choice button:focus-visible/); assert.match(css,/aria-pressed="true"/);
  assert.match(page,/cancelInspection/); assert.match(page,/restorePreviousResult/);
});
test('보호 구간 경고는 수동 선택을 바꾸지 않고 양쪽 보기의 이유에 남는다', () => {
  const source=page.slice(page.indexOf('function warnProtectedEdits('),page.indexOf('function verificationForDisplay('));
  const warn=new Function(source+';return warnProtectedEdits')();
  const errors=[{...ai,manual:'apply',explain:'원래 이유'}, {...ai,id:'b',start:4,end:6,manual:'keep'}];
  const api={protectedRanges:()=>[{start:0,end:3}],overlapsProtectedRange:(ranges,start,end)=>ranges.some(r=>start<r.end&&r.start<end)};
  const out=warn('몇일 글',errors,api);
  assert.match(out[0].explain,/인용·주소 등 원문 보존/); assert.equal(out[0].manual,'apply'); assert.equal(out[1].manual,'keep'); assert.equal(out[1].protectedWarning,undefined);
  assert.equal(warn('몇일',errors,{}),errors);
  assert.match(page,/errors=\{displayErrors\} verify=\{verify\}/);
});
test('조사까지 같은 접미사를 보존한 AI 교정은 통합하되 겹침이나 모호한 위치는 빠른 후보를 남긴다', () => {
  const suffix={...ai,wrong:'몇일에',right:'며칠에',end:3};
  assert.equal(sameQuickAndAI(q,suffix),true);
  assert.equal(sameQuickAndAI(q,{...suffix,overlap:true}),false);
  assert.equal(sameQuickAndAI(q,{...suffix,start:null,end:null}),false);
  assert.equal(sameQuickAndAI(q,{...suffix,end:2}),false);
  for (const candidate of [{...suffix,overlap:true},{...suffix,start:null,end:null}]) {
    const o=resultOverview([candidate],[q],buildCorrection('몇일에',[candidate]));
    assert.deepEqual(o.uniqueQuick,[q]);
  }
  assert.deepEqual(resultOverview([suffix],[q],buildCorrection('몇일에',[suffix])).uniqueQuick,[]);
});

test('추가 검색 중 취소는 늦은 응답을 버리고 검색 중 수동 선택과 재검색 가능 상태를 보존한다', async () => {
  const cancel=page.slice(page.indexOf('  function restorePreviousResult('),page.indexOf('  async function checkSpellingDirect('));
  const search=page.slice(page.indexOf('  async function searchUnresolvedEvidence('),page.indexOf('  async function searchDictDirect('));
  const make=new Function(`
    let result={originalText:'몇일',errors:[{id:'a',wrong:'몇일',right:'며칠',start:0,end:2,status:'needs_review'}]};
    let verify={a:{source:'none'}}, verifyStage='done', loading=false, aiRules=[], elapsedMs=0;
    const retryBackupRef={current:null}, requestControllerRef={current:null}, additionalSearchRef={current:null}, verifyRunRef={current:0};
    let resolveSearch; const pending=new Promise(r=>{resolveSearch=r}); let state={};
    const pendingEvidenceItems=()=>[result.errors[0]], searchPendingEvidence=(items,v,o)=>{state.signal=o.signal;return pending};
    const setLoading=v=>loading=v,setProgress=()=>{},setErrorMsg=v=>state.error=v,setVerifyStage=v=>verifyStage=v,setAiRules=()=>{},setElapsedMs=()=>{},setCopied=()=>{};
    const setVerify=v=>verify=typeof v==='function'?v(verify):v, setResult=v=>result=typeof v==='function'?v(result):v;
    const missingVerification=()=>({});
    __CANCEL__
    __SEARCH__
    return {start:searchUnresolvedEvidence,cancel:()=>cancelInspection(true),choose:chooseCorrection,resolveSearch,get:()=>({result,verify,verifyStage,run:verifyRunRef.current,signal:state.signal})};
  `.replace('__CANCEL__',cancel).replace('__SEARCH__',search));
  const h=make(), promise=h.start(); h.choose('a','keep'); const run=h.get().run; h.cancel();
  assert.equal(h.get().run,run+1); assert.equal(h.get().signal.aborted,true); assert.equal(h.get().verifyStage,'done'); assert.equal(h.get().result.errors[0].manual,'keep');
  h.resolveSearch({results:{a:{source:'nikl'}},failures:0}); await promise;
  assert.equal(h.get().verify.a.source,'none'); assert.equal(h.get().result.errors[0].manual,'keep'); assert.equal(h.get().verifyStage,'done');
});

test('빠른 교정은 기존 결과가 있을 때 확인 후에만 바꾸며 확인 시 위치를 재검증한다', () => {
  const src=page.slice(page.indexOf('  function applyQuick('),page.indexOf('  async function checkSpelling()'));
  const make=new Function(`
    let text='몇일', result={errors:[{manual:'keep'}]}, pendingQuick=null, changed=false, error=null;
    const retryBackupRef={current:null}, quickTriggerRef={current:null};
    const setPendingQuick=v=>pendingQuick=v, setErrorMsg=v=>error=v, updateInput=v=>{text=v;changed=true;result=null};
    __SOURCE__
    return {requestQuick,cancelQuick,confirmQuick,setText:v=>text=v,get:()=>({text,result,pendingQuick,changed,error})};
  `.replace('__SOURCE__',src));
  const candidate={start:0,end:2,wrong:'몇일',right:'며칠'};
  const h=make();h.requestQuick(candidate,null);assert.equal(h.get().changed,false);assert.equal(h.get().pendingQuick.error,candidate);
  h.cancelQuick();assert.equal(h.get().changed,false);assert.ok(h.get().result);
  h.requestQuick(candidate,null);h.setText('다른 글');h.confirmQuick();assert.equal(h.get().changed,false);assert.ok(h.get().result);assert.match(h.get().error.text,/위치/);
  const h2=make();h2.requestQuick(candidate,null);h2.confirmQuick();assert.equal(h2.get().text,'며칠');assert.equal(h2.get().result,null);
  assert.match(page,/aria-labelledby="quick-confirm-title" aria-describedby="quick-confirm-description"/);
  assert.match(page,/기존 검사 결과와 직접 선택한 적용·원문 유지 내용이 지워집니다/);
  assert.match(page,/onClick=\{cancelQuick\}>취소/);assert.match(page,/onClick=\{confirmQuick\}>확인하고 바꾸기/);
});

test('서버 text 내부의 truncation 신호를 읽고 일부 결과임을 안내한다', async () => {
  const {callAI}=await import('../app/lib/checkFlow.mjs');
  const payload={errors:[],truncated:true};
  const response=await callAI('check','글','','',{fetcher:async()=>({ok:true,json:async()=>({text:JSON.stringify(payload)})})});
  assert.equal(response.truncated,true);
  assert.match(page,/truncated:parts\.some\(p=>p\.truncated===true\)/);
  assert.match(page,/result\.truncated && <p role="status">후보가 많아 일부만 표시합니다\. 글을 나누어 다시 검사해 주세요/);
});
test('청크에서 위치 미확정인 제안을 다른 청크의 원문에서 다시 찾지 않는다', async () => {
  const {anchorEdits,anchorChunkEdits}=await import('../app/lib/corrections.mjs');
  const body=page.slice(page.indexOf('  async function checkSpellingDirect('),page.indexOf('  async function runVerify('));
  const make=new Function('anchorEdits','anchorChunkEdits',`
    const text='가나다 몇일',result=null,verify={},verifyStage='',aiRules=[],elapsedMs=null;
    const retryBackupRef={current:null},requestControllerRef={current:null},verifyRunRef={current:0},resultRef={current:null};let state={};
    const splitTextWithContext=()=>[{text:'가나다',start:0},{text:' 몇일',start:3}];
    const callAI=async(mode,t)=>({errors:t==='가나다'?[{wrong:'몇일',right:'며칠'}]:[]});
    const setErrorMsg=()=>{},setQuickActive=()=>{},setElapsedMs=()=>{},setVerify=()=>{},setVerifyStage=()=>{},setAiRules=()=>{},setLoading=()=>{},setDictResult=()=>{},setProgress=()=>{};
    const setResult=v=>state.result=v,findQuickErrors=()=>[],runVerify=()=>{},setTimeout=()=>{},friendlyError=()=>'',restorePreviousResult=()=>false;
    __BODY__
    return {checkSpellingDirect,state};
  `.replace('__BODY__',body));
  const h=make(anchorEdits,anchorChunkEdits);await h.checkSpellingDirect();
  assert.equal(h.state.result.errors[0].start,null);assert.equal(h.state.result.errors[0].end,null);
  assert.match(page,/const errors = anchorChunkEdits\(t,candidates\)/);
});
test('최초 대조 취소 결과는 추가 검색과 전체 재검사로 안전하게 재개할 수 있다', async () => {
  const {pendingEvidenceItems}=await import('../app/lib/moreEvidence.mjs');
  const original='몇일 몇일';
  const errors=[{id:'a',start:0,end:2,wrong:'몇일',right:'며칠',status:'needs_review'},{id:'b',start:3,end:5,wrong:'몇일',right:'며칠',status:'needs_review',manual:'keep'},{id:'c',start:null,end:null,wrong:'몇일',right:'며칠',status:'needs_review'},{id:'d',start:3,end:5,wrong:'몇일',right:'며칠',status:'needs_review',overlap:true}];
  const verify=Object.fromEntries(errors.map(e=>[e.id,{verificationFailed:true}]));
  assert.deepEqual(pendingEvidenceItems(original,errors,verify).map(e=>e.id),['a']);
  assert.match(page,/verifyStage==='cancelled' && <div className="check-more" role="status"/);
  assert.match(page,/\['done','cancelled'\]\.includes\(verifyStage\) && pendingEvidence\.length > 0/);
  assert.match(page,/result\.profile==='full' \|\| verifyStage==='cancelled'/);
  assert.match(page,/재검사를 취소하거나 실패하면 이전 결과와 선택이 복원됩니다/);
  const search=page.slice(page.indexOf('  async function searchUnresolvedEvidence('),page.indexOf('  function chooseCorrection('));
  assert.match(search,/pendingEvidenceItems\(original,result\.errors,verify\)/);
  assert.doesNotMatch(search,/setResult\(/);
});