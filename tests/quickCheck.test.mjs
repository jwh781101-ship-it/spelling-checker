import test from 'node:test';
import assert from 'node:assert/strict';
import { QUICK_RULES, findQuickErrors } from '../app/lib/quickCheck.mjs';

test('소수의 보수적인 규칙만 공개한다', () => {
  assert.ok(QUICK_RULES.length > 0 && QUICK_RULES.length <= 5);
  assert.equal(QUICK_RULES.some((r) => r.wrong === '몇 일'), false);
});
test('반복 오류와 이모지 뒤 UTF-16 위치를 독립적으로 반환한다', () => {
  const text = '😀 몇일, 몇일! 설겆이';
  const found = findQuickErrors(text);
  assert.deepEqual(found.map(({wrong,right,start,end}) => ({wrong,right,start,end})), [
    {wrong:'몇일',right:'며칠',start:3,end:5},
    {wrong:'몇일',right:'며칠',start:7,end:9},
    {wrong:'설겆이',right:'설거지',start:11,end:14},
  ]);
  for (const e of found) { assert.equal(text.slice(e.start,e.end), e.wrong); assert.ok(e.reason); }
  assert.equal(text, '😀 몇일, 몇일! 설겆이');
});
test('정상 표현과 문맥이 모호하거나 어절 일부인 표현은 건드리지 않는다', () => {
  for (const text of ['며칠', '몇 일 만에', '몇일째', '3일 몇일', '12 몇일', '몇일간', '안 되다 안되다', '그런데 그렇대', '역활용', '뵈요가', 'A몇일', '몇일2', '몇일\u0301']) {
    assert.deepEqual(findQuickErrors(text), [], text);
  }
});
test('규칙별 독립 어절을 감지하고 텍스트 순서대로 반환한다', () => {
  const text = '뵈요 역활 설겆이 오랫만 몇일';
  assert.deepEqual(findQuickErrors(text).map(e => e.right), ['봬요','역할','설거지','오랜만','며칠']);
});
test('빈 값과 문자열 이외의 값은 안전하게 처리한다', () => {
  for (const x of ['', null, undefined, 1, {}]) assert.deepEqual(findQuickErrors(x), []);
});

test('날짜 질문의 명확한 서술 연결형을 오류 부분만 반복 검출한다', () => {
  const text = '😀 오늘은 몇일인가요? 몇일인지, 몇일이에요?';
  const errors = findQuickErrors(text);
  assert.equal(errors.length, 3);
  assert.deepEqual(errors.map(e => text.slice(e.start, e.end)), ['몇일', '몇일', '몇일']);
  assert.deepEqual(errors.map(e => e.start), [7, 14, 20]);
  for (const text of ['3일 몇일인가요?', '12 몇일인지', '몇일인가요라는', '몇일이므로', '몇일째인가요?']) {
    assert.deepEqual(findQuickErrors(text), [], text);
  }
});

test('월과 생일에 대한 날짜 질문을 검출한다', () => {
  for (const text of ['오늘은 3월 몇일인가요?', '생일 몇일인가요?']) {
    const matches = findQuickErrors(text);
    assert.equal(matches.length, 1, text);
    assert.equal(text.slice(matches[0].start, matches[0].end), '몇일');
  }
});

test('안전한 조사만 어근 위치로 검출하고 나머지 어절은 유지한다',()=>{
 for(const text of ['오랫만에','설겆이를','설겆이가','역활을']) {const e=findQuickErrors(text);assert.equal(e.length,1,text);assert.equal(text.slice(e[0].start,e[0].end),e[0].wrong);}
 for(const text of ['오랫만에라서','설겆이를통해','설겆이집','역활용','설겆이2','설겆이를\u0301','뵈요가','몇일째']) assert.deepEqual(findQuickErrors(text),[],text);
});
test('인용 URL 코드 식별자를 보호하고 바깥 반복만 검출한다',()=>{
 const text='😀 “설겆이를” 설겆이를 `오랫만에` https://example.com/설겆이 #역활 @설겆이 역활을';
 const e=findQuickErrors(text);assert.deepEqual(e.map(x=>x.wrong),['설겆이','역활']);for(const x of e)assert.equal(text.slice(x.start,x.end),x.wrong);
 for(const t of ['"역활"','‘역활’','「역활」',"'역활'",'```\n설겆이\n```','www.example.com/역활','x@역활.com']) assert.deepEqual(findQuickErrors(t),[],t);
});
test('미닫힘 인용과 코드는 끝까지 보호하고 단어 속 아포스트로피는 인용으로 보지 않는다',()=>{
 for(const t of ['앞 “설겆이. 역활','앞 `설겆이. 역활',"앞 '설겆이\n역활"]) assert.deepEqual(findQuickErrors(t),[],t);
 assert.deepEqual(findQuickErrors("don't 역활. 설겆이").map(e=>e.wrong),['역활','설겆이']);
});
test('문장 부호와 유니코드 경계를 구분한다',()=>{
 const text='😀역활. 설겆이! "역활"? 오랫만에';assert.deepEqual(findQuickErrors(text).map(e=>e.wrong),['역활','설겆이','오랫만']);
 for(const t of ['𐐀역활','역활𐐀','a역활','역활_','역활\u0301']) assert.deepEqual(findQuickErrors(t),[],t);
});

test('앞뒤 글자에 붙은 인용과 미닫힘 인용을 보호한다',()=>{
 for(const text of ['그는"역활"이라고 했다. 설겆이','그는\'역활\'이라고 했다. 설겆이','그는"역활. 설겆이','그는\'역활. 설겆이']) {
  const found=findQuickErrors(text);
  assert.deepEqual(found.map(e=>e.wrong),text.includes('이라고')?['설겆이']:[],text);
 }
});
test('작은따옴표의 축약 예외는 양쪽이 영문일 때만 허용한다',()=>{
 for(const text of ["don't 역활", "they're 역활", "I'm 역활"]) assert.deepEqual(findQuickErrors(text).map(e=>e.wrong),['역활'],text);
 for(const text of ["한'역활'이다", "A'역활'이다", "한'A 역활", "A'한 역활"]) assert.deepEqual(findQuickErrors(text),[],text);
 assert.deepEqual(findQuickErrors("'don't 역활' 설겆이").map(e=>e.wrong),['설겆이']);
 assert.deepEqual(findQuickErrors('‘don’t 역활’ 설겆이').map(e=>e.wrong),['설겆이']);
});
