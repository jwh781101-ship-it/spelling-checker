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
  for (const text of ['며칠', '몇 일 만에', '몇일째', '3일 몇일', '12 몇일', '몇일간', '안 되다 안되다', '그런데 그렇대', '역활용', '설겆이를', '뵈요가', 'A몇일', '몇일2', '몇일\u0301']) {
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
