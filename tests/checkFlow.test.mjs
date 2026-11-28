import test from 'node:test';
import assert from 'node:assert/strict';
import {callAI,verifyInBatches,applyVerifiedEdits} from '../app/lib/checkFlow.mjs';
const res=items=>new Response(JSON.stringify({items}),{headers:{'Content-Type':'application/json'}});
const item={id:'a',wrong:'할수',right:'할 수',start:0,end:2,status:'pending'};
test('빠른 검사 프로필과 취소 신호 전달',async()=>{const controller=new AbortController();let init;await callAI('check','할수','','',{signal:controller.signal,fetcher:async(_,o)=>{init=o;return new Response(JSON.stringify({text:'{"errors":[]}'}));}});assert.equal(JSON.parse(init.body).profile,'fast');assert.equal(init.signal,controller.signal);});
test('실패하면 자동 재시도하지 않음',async()=>{let n=0;await assert.rejects(callAI('check','글','','',{fetcher:async()=>{n++;return new Response('{"error":"busy"}',{status:503});}}));assert.equal(n,1);});
test('손상된 JSON을 성공 결과로 처리하지 않음',async()=>{await assert.rejects(callAI('check','글','','',{fetcher:async()=>new Response('{"text":"not-json"}')}));});
test('누락 및 중복 검증 ID는 모두 보류',async()=>{const r=await verifyInBatches('local',[item,{...item,id:'b'}],{fetcher:async()=>res([{id:'a',found:true},{id:'a',found:true}])});assert.equal(r.length,2);assert.ok(r.every(v=>v.verificationFailed&&v.source==='none'&&v.localOnly));});
test('검증 HTTP 오류도 원문 유지',async()=>{const r=await verifyInBatches('local',[item],{fetcher:async()=>new Response('{}',{status:502})});assert.equal(r[0].officialRight,item.wrong);assert.equal(r[0].found,false);});
test('취소된 검증은 실패 완료로 위장하지 않음',async()=>{const c=new AbortController();c.abort();await assert.rejects(verifyInBatches('local',[item],{signal:c.signal,fetcher:async()=>{throw new Error('호출 금지')}}),{name:'AbortError'});});
test('검증 요청 병렬 수를 최대 3개로 제한하고 순서 보존',async()=>{let active=0,peak=0;const list=Array.from({length:30},(_,i)=>({...item,id:String(i)}));const r=await verifyInBatches('local',list,{fetcher:async(_,o)=>{active++;peak=Math.max(peak,active);await new Promise(resolve=>setTimeout(resolve,2));active--;return res(JSON.parse(o.body).items.map(x=>({id:x.id,found:false})));}});assert.ok(peak<=3);assert.deepEqual(r.map(x=>x.id),list.map(x=>x.id));});
test('공식 자료와 일치하고 자체 규칙과 위치가 같은 항목만 자동 적용',()=>{const known={...item,wrong:'역활',right:'역할'}; const v={source:'nikl',found:true,verdict:'일치',officialRight:'역할',evidence:{candidateMentioned:true}};assert.equal(applyVerifiedEdits('역활',[known],{a:v})[0].status,'applied');for(const source of ['none','web'])assert.equal(applyVerifiedEdits('역활',[known],{a:{...v,source}})[0].status,'needs_review');assert.equal(applyVerifiedEdits('할수',[item],{a:{...v,officialRight:'할 수'}})[0].status,'needs_review');});
test('일치라 해도 최종 표현이 다르면 자동 적용하지 않음',()=>{assert.equal(applyVerifiedEdits('할수',[item],{a:{source:'nikl',found:true,verdict:'일치',officialRight:'다른 말'}})[0].status,'needs_review');});
test('허용 원문·수동 원문 유지·잘못된 위치와 중첩 보호',()=>{const map={a:{source:'nikl',found:true,verdict:'둘다가능',officialRight:'할수'}};assert.equal(applyVerifiedEdits('할수',[item],map)[0].status,'kept');assert.equal(applyVerifiedEdits('할수',[{...item,manual:'keep'}],map)[0].manual,'keep');assert.equal(applyVerifiedEdits('할수',[{...item,start:1}],map)[0].status,'needs_review');assert.equal(applyVerifiedEdits('할수',[{...item,overlap:true}],map)[0].status,'needs_review');});

test('독립 자료 대조 설명이 최초 후보의 잘못된 설명보다 우선',()=>{const v={source:'nikl',found:true,verdict:'둘다가능',officialRight:'할수',explain:'원문도 허용되는 표기입니다.'};assert.equal(applyVerifiedEdits('할수',[{...item,explain:'무조건 오류'}],{a:v})[0].explain,v.explain);});

test('부분 또는 교정틀림 판정의 제3 표현은 자동 적용하지 않는다',()=>{
  for(const verdict of ['부분','AI교정틀림']) {
    const e={id:'a',wrong:'역활',right:'역할',start:0,end:2};
    for(const alternative of ['권한','역활','역할','']) {
      const result=applyVerifiedEdits('역활 역활',[e],{a:{source:'nikl',found:true,verdict,officialRight:alternative}})[0];
      assert.equal(result.status,'needs_review');assert.equal(result.right,'역할');assert.equal(result.aiRight,undefined);
    }
    assert.equal(applyVerifiedEdits('역활',[{...e,manual:'apply'}],{a:{source:'nikl',found:true,verdict,officialRight:'권한'}})[0].manual,'apply');
  }
});

test('인용에 후보 표현이 등장하지 않으면 일치 판정도 자동 적용하지 않는다',()=>{
 for(const evidence of [undefined,{candidateMentioned:false}]) assert.equal(applyVerifiedEdits('할수',[item],{a:{source:'nikl',found:true,verdict:'일치',officialRight:'할 수',evidence}})[0].status,'needs_review');
});

test('보호 구간은 공식 검증이 일치해도 자동 적용하지 않는다',()=>{
 const v={source:'nikl',found:true,verdict:'일치',officialRight:'역할',evidence:{candidateMentioned:true}};
 for(const text of ['“역활”','`역활`','https://example.com/역활','앞 “역활.']) {const start=text.indexOf('역활');const e={id:'a',wrong:'역활',right:'역할',start,end:start+2};assert.equal(applyVerifiedEdits(text,[e],{a:v})[0].status,'needs_review',text);}
});
test('직접 선택은 자동 판정이 덮어쓰지 않는다',()=>{
 const text='“역활”',e={id:'a',wrong:'역활',right:'역할',start:1,end:3,manual:'apply'};assert.equal(applyVerifiedEdits(text,[e],{})[0].manual,'apply');
});
test('조사 앞 오타만 정확히 검증된 경우 자동 적용한다',()=>{
 const text='설겆이를',e={id:'a',wrong:'설겆이',right:'설거지',start:0,end:3};const v={source:'nikl',found:true,verdict:'일치',officialRight:'설거지',evidence:{candidateMentioned:true}};assert.equal(applyVerifiedEdits(text,[e],{a:v})[0].status,'applied');
});
