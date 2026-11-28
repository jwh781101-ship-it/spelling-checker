import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anchorEdits, anchorChunkEdits, buildCorrection, contextOf, splitTextWithContext } from '../app/lib/corrections.mjs';
const a = (s, e) => anchorEdits(s, e);
const b = (s, e) => buildCorrection(s, e);
test('유일한 위치 복구',()=>assert.equal(a('가 나',[{wrong:'나',right:'너'}])[0].start,2));
test('올바른 위치 사용',()=>assert.equal(a('가 가',[{wrong:'가',right:'나',start:2,end:3}])[0].start,2));
test('반복은 보류',()=>assert.equal(a('가 가',[{wrong:'가',right:'나'}])[0].status,'needs_review'));
test('반복 뒤 앵커',()=>assert.equal(a('가나 가다',[{wrong:'가',right:'고',anchorAfter:'다'}])[0].start,3));
test('반복 앞 앵커',()=>assert.equal(a('첫가 둘가',[{wrong:'가',right:'고',anchorBefore:'둘'}])[0].start,4));
test('틀린 위치 유일 복구',()=>assert.equal(a('가 나',[{wrong:'나',right:'너',start:0,end:1}])[0].start,2));
test('틀린 위치 반복 보류',()=>assert.equal(a('가 가',[{wrong:'가',right:'나',start:9,end:10}])[0].start,null));
test('원문 없는 후보 보류',()=>assert.equal(a('가',[{wrong:'나',right:'다'}])[0].status,'needs_review'));
test('동일 교정 제거',()=>assert.equal(a('가',[{wrong:'가',right:'가'}]).length,0));
test('이모지 UTF16 위치',()=>assert.equal(a('😀가',[{wrong:'가',right:'나'}])[0].start,2));
test('이모지 문맥',()=>assert.equal(contextOf('😀가 나',{wrong:'나',start:4,end:5}),'😀가 나'));
test('잘못된 문맥 위치',()=>assert.equal(contextOf('가',{wrong:'가',start:1,end:2}),''));
test('pending 원문',()=>assert.equal(b('가',a('가',[{wrong:'가',right:'나'}])).text,'가'));
test('applied 적용',()=>assert.equal(b('가',[{wrong:'가',right:'나',start:0,end:1,status:'applied'}]).text,'나'));
test('manual apply 적용',()=>assert.equal(b('가',[{wrong:'가',right:'나',start:0,end:1,manual:'apply'}]).text,'나'));
test('manual keep 우선',()=>assert.equal(b('가',[{wrong:'가',right:'나',start:0,end:1,status:'applied',manual:'keep'}]).text,'가'));
test('위치 불일치 원문',()=>assert.equal(b('가',[{wrong:'나',right:'다',start:0,end:1,status:'applied'}]).text,'가'));
test('중첩 전부 보류',()=>{let es=a('가나다',[{wrong:'가나',right:'x',start:0,end:2},{wrong:'나다',right:'y',start:1,end:3}]); assert.ok(es.every(e=>e.overlap)); assert.equal(b('가나다',es.map(e=>({...e,manual:'apply'}))).text,'가나다')});
test('중첩 방어',()=>assert.equal(b('가나다',[{wrong:'가나',right:'x',start:0,end:2,status:'applied'},{wrong:'나다',right:'y',start:1,end:3,status:'applied'}]).text,'가나다'));
test('여러 교정 순서',()=>assert.equal(b('abc',[{wrong:'c',right:'z',start:2,end:3,status:'applied'},{wrong:'a',right:'x',start:0,end:1,status:'applied'}]).text,'xbz'));
test('마크 대상만 강조',()=>{const r=b('가 가',[{wrong:'가',right:'나',start:2,end:3,status:'applied'}]);assert.deepEqual(r.segments.map(x=>x.text),['가 ','나']);assert.equal(r.appliedCount,1)});
test('XSS는 텍스트 세그먼트',()=>assert.equal(b('<script>x</script>',[]).segments[0].text,'<script>x</script>'));
test('청크 원문 복원',()=>{const s=' 첫 문장.  둘째 문장!\n\n😀 셋째 끝 '; assert.equal(splitTextWithContext(s,8,3).map(c=>c.text).join(''),s)});
test('청크 앞뒤 문맥',()=>{const s='abcdefghij';const c=splitTextWithContext(s,4,2);assert.equal(c[1].contextBefore,'cd');assert.equal(c[1].contextAfter,'ij')});
test('청크 전역 위치',()=>{const s='abcdefghij';for(const c of splitTextWithContext(s,3,2)) assert.equal(s.slice(c.start,c.end),c.text)});
test('빈 입력',()=>assert.deepEqual(splitTextWithContext(''),[]));
test('검증 보류 원문',()=>assert.equal(b('가',[{wrong:'가',right:'나',start:0,end:1,status:'needs_review'}]).text,'가'));
test('서로 다른 id',()=>{const es=a('가 가',[{wrong:'가',right:'나',start:0,end:1},{wrong:'가',right:'다',start:2,end:3}]); assert.notEqual(es[0].id,es[1].id)});

test('위치와 뒤 앵커 충돌 시 유일한 앵커 위치로 복구', () => {
  const [e] = anchorEdits('가나 가다', [{ wrong: '가', right: '고', start: 0, end: 1, anchorAfter: '다' }]);
  assert.equal(e.start, 3); assert.equal(e.end, 4);
});
test('위치와 앵커 충돌하고 일치 위치가 없으면 보류', () => {
  const [e] = anchorEdits('가나 가다', [{ wrong: '가', right: '고', start: 0, end: 1, anchorAfter: '라' }]);
  assert.equal(e.start, null); assert.equal(e.status, 'needs_review');
});
test('위치와 앵커 충돌하고 일치 위치가 여럿이면 보류', () => {
  const [e] = anchorEdits('가나 가다 가다', [{ wrong: '가', right: '고', start: 0, end: 1, anchorAfter: '다' }]);
  assert.equal(e.start, null); assert.equal(e.status, 'needs_review');
});

test('유일한 원문 일치는 잘못 생성된 앞뒤 단서로 잃지 않는다',()=>{
 const [e]=a('나무잎이 떨어졌다.',[{wrong:'나무잎',right:'나뭇잎',start:7,end:10,anchorBefore:'없는 단서',anchorAfter:'잘못된 단서'}]);
 assert.equal(e.start,0);assert.equal(e.status,'pending');
});
test('확정 위치의 단서는 실제 원문에서 다시 생성한다',()=>{
 const original='다 됬다. 나무잎이 떨어졌다.';
 const [e]=a(original,[{wrong:'나무잎',right:'나뭇잎',anchorBefore:'다 됐다. '}]);
 assert.equal(e.start,6);assert.equal(e.anchorBefore,'다 됬다. ');assert.equal(e.anchorAfter,'이 떨어졌다.');
});
test('청크 위치를 전역 위치로 옮겨도 확정한 단서를 보존한다',()=>{
 const local='나무잎이 떨어졌다.';const original='앞 문장. '+local+' 뒤 문장.';
 const [e]=a(local,[{wrong:'나무잎',right:'나뭇잎',anchorBefore:'없는 단서'}]);
 const [global]=a(original,[{...e,start:e.start+6,end:e.end+6}]);
 assert.equal(global.start,6);assert.equal(global.status,'pending');
});

test('위치 확정 후 동일 원문과 제안만 중복 제거하고 첫 항목을 보존한다',()=>{
 const es=a('앞 역활 뒤',[{wrong:'역활',right:'역할',start:2,end:4,explain:'첫 설명'}, {wrong:'역활',right:'역할',start:99,end:101,explain:'둘째 설명'}]);
 assert.equal(es.length,1);assert.equal(es[0].explain,'첫 설명');assert.equal(es[0].start,2);assert.equal(es[0].overlap,undefined);
 assert.equal(b('앞 역활 뒤',es.map(e=>({...e,status:'applied'}))).text,'앞 역할 뒤');
});
test('같은 위치의 다른 제안과 부분 중첩은 제거하지 않고 모두 보류한다',()=>{
 for(const [text,candidates] of [
  ['역활',[{wrong:'역활',right:'역할'},{wrong:'역활',right:'구실'}]],
  ['가나다',[{wrong:'가나',right:'x'},{wrong:'나다',right:'y'}]],
 ]) {const es=a(text,candidates);assert.equal(es.length,2);assert.ok(es.every(e=>e.overlap&&e.status==='needs_review'));assert.equal(b(text,es.map(e=>({...e,manual:'apply'}))).text,text);}
});
test('반복 원문의 서로 다른 확정 위치와 미확정 중복 후보는 보존한다',()=>{
 let es=a('역활 역활',[{wrong:'역활',right:'역할',start:0,end:2},{wrong:'역활',right:'역할',start:3,end:5}]);assert.equal(es.length,2);assert.ok(es.every(e=>!e.overlap));
 es=a('역활 역활',[{wrong:'역활',right:'역할'},{wrong:'역활',right:'역할'}]);assert.equal(es.length,2);assert.ok(es.every(e=>e.start===null&&e.status==='needs_review'));
});

test('청크에 없는 후보는 다른 청크 또는 앞뒤 문맥에만 있어도 전체에서 재고정하지 않는다',()=>{
 const original='역활은 앞 문맥이다. 정상인 청크다.';const chunk='정상인 청크다.';
 const [local]=anchorEdits(chunk,[{wrong:'역활',right:'역할'}]);assert.equal(local.start,null);
 const [global]=anchorChunkEdits(original,[local]);assert.equal(global.start,null);assert.equal(global.end,null);assert.equal(global.locationUnresolved,true);assert.equal(global.status,'needs_review');
 assert.equal(buildCorrection(original,[{...global,status:'applied'}]).text,original);
});
test('반복 청크의 미확정 후보는 전체 원문에 유일하거나 여러 번 있어도 미확정이다',()=>{
 for(const original of ['앞 역활 끝','역활 앞 역활 끝']) {
  const e={wrong:'역활',right:'역할',start:null,end:null,anchorBefore:'앞 ',status:'needs_review'};
  const [r]=anchorChunkEdits(original,[e]);assert.equal(r.start,null);assert.equal(r.end,null);assert.equal(r.locationUnresolved,true);
 }
});
test('지정된 전역 위치가 틀리면 다른 곳에서 찾지 않으며 일치하면 앵커가 달라도 유지한다',()=>{
 const original='앞 역활 뒤 역활';
 const [bad]=anchorChunkEdits(original,[{wrong:'역활',right:'역할',start:0,end:2}]);assert.equal(bad.start,null);assert.equal(bad.end,null);assert.equal(bad.locationUnresolved,true);
 const [good]=anchorChunkEdits(original,[{wrong:'역활',right:'역할',start:2,end:4,anchorBefore:'틀린 단서'}]);assert.equal(good.start,2);assert.equal(good.end,4);assert.equal(good.anchorBefore,'앞 ');
});
test('청크 위치 고정은 완전 중복만 제거하고 다른 겹침은 보류한다',()=>{
 const original='역활과';const c={wrong:'역활',right:'역할',start:0,end:2};
 let es=anchorChunkEdits(original,[c,{...c},{...c,right:'구실'}]);assert.equal(es.length,2);assert.ok(es.every(e=>e.overlap&&e.status==='needs_review'));
 es=anchorChunkEdits(original,[c,{...c}]);assert.equal(es.length,1);assert.equal(es[0].status,'pending');assert.equal(buildCorrection(original,[{...es[0],status:'applied'}]).text,'역할과');
});
test('일반 위치 고정은 기존대로 검색 복구하고 청크 출처 불명 표식은 재고정을 막는다',()=>{
 assert.equal(anchorEdits('앞 역활',[{wrong:'역활',right:'역할'}])[0].start,2);
 const [e]=anchorChunkEdits('앞 역활',[{wrong:'역활',right:'역할',start:2,end:4,locationUnresolved:true}]);assert.equal(e.start,null);assert.equal(e.end,null);
});
