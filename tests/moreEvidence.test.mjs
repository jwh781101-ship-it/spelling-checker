import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingEvidenceItems,searchPendingEvidence} from '../app/lib/moreEvidence.mjs';
const original='오랫만에 뵈요';
const errs=[{id:'a',wrong:'오랫만',right:'오랜만',start:0,end:3,status:'needs_review'},{id:'b',wrong:'뵈요',right:'봬요',start:5,end:7,status:'needs_review'}];
test('사용자가 선택하지 않은 유효한 확인 필요 항목만 검색한다',()=>{
 assert.deepEqual(pendingEvidenceItems(original,errs).map(x=>x.id),['a','b']);
 assert.deepEqual(pendingEvidenceItems(original,[{...errs[0],manual:'keep'},errs[1]]).map(x=>x.id),['b']);
 assert.deepEqual(pendingEvidenceItems(original,[{...errs[0],start:1},{...errs[1],overlap:true}]),[]);
});
test('기존 AI 제안만 공식 검색 후 미확인 항목만 웹 참고하고 이전 결과를 보존한다',async()=>{
 const calls=[]; const previous={a:{id:'a',source:'none'},z:{id:'z',source:'nikl'}};
 const r=await searchPendingEvidence(errs,previous,{verify:async(stage,items)=>{calls.push([stage,items.map(x=>x.id)]);return stage==='nikl'?[{id:'a',source:'nikl',found:true},{id:'b',source:'none'}]:[{id:'b',source:'web',found:true}];}});
 assert.deepEqual(calls,[['nikl',['a','b']],['web',['b']]]);assert.equal(r.results.a.source,'nikl');assert.equal(r.results.b.source,'web');assert.deepEqual(r.results.z,previous.z);assert.equal(r.failures,0);
});
test('공식 요청 실패는 웹으로 넘기지 않고 기존 결과를 보존한다',async()=>{
 const calls=[];const prev={a:{id:'a',source:'none',note:'기존'},b:{id:'b',source:'none'}};
 const r=await searchPendingEvidence(errs,prev,{verify:async(stage,items)=>{calls.push(stage);return items.map(x=>({id:x.id,source:'none',verificationFailed:true}));}});
 assert.deepEqual(calls,['nikl']);assert.equal(r.failures,2);assert.deepEqual(r.results,prev);
});
test('취소된 검색은 반영하지 않고 종료한다',async()=>{
 const c=new AbortController();c.abort();await assert.rejects(searchPendingEvidence(errs,{}, {signal:c.signal,verify:async()=>[]}),{name:'AbortError'});
});
test('대상이 없으면 비용이 드는 요청을 보내지 않는다',async()=>{
 let called=false;const r=await searchPendingEvidence([],{}, {verify:async()=>{called=true;return[]}});assert.equal(called,false);assert.equal(r.failures,0);
});

test('추가 검색을 완료한 항목은 근거 미발견이어도 다시 검색하지 않고 실패 항목만 재시도한다',async()=>{
 const r=await searchPendingEvidence(errs,{}, {verify:async(stage,items)=>stage==='nikl'?items.map(x=>({id:x.id,source:'none'})):items.map(x=>x.id==='a'?{id:x.id,source:'none'}:{id:x.id,source:'none',verificationFailed:true})});
 assert.equal(r.results.a.additionalEvidenceComplete,true);assert.equal(r.results.a.source,'none');assert.equal(r.failures,1);
 assert.deepEqual(pendingEvidenceItems(original,errs,r.results).map(x=>x.id),['b']);
 assert.equal(errs[0].status,'needs_review');
});

test('웹 검색만 실패하면 공식 검색을 반복하지 않고 웹만 재시도한다',async()=>{
 const calls=[];const prev={a:{id:'a',source:'none',note:'이전'}};
 const first=await searchPendingEvidence([errs[0]],prev,{verify:async(stage,items)=>{calls.push(stage);return items.map(x=>({id:x.id,source:'none',verificationFailed:stage==='web'}));}});
 assert.deepEqual(calls,['nikl','web']); assert.equal(first.failures,1); assert.equal(first.results.a.note,'이전'); assert.equal(first.results.a.additionalOfficialNoMatch,true);
 const second=await searchPendingEvidence([errs[0]],first.results,{verify:async(stage,items)=>{calls.push(stage);return items.map(x=>({id:x.id,source:'none'}));}});
 assert.deepEqual(calls,['nikl','web','web']);assert.equal(second.results.a.additionalEvidenceComplete,true);assert.equal(second.failures,0);
});
