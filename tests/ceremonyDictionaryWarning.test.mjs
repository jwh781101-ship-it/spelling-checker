import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../app/page.js', import.meta.url), 'utf8');
const match = page.match(/  function findCeremonyTerm\(term\) \{[\s\S]*?\n  \}/);
assert.ok(match, '사전 이동 함수를 찾을 수 있어야 합니다');
const create = new Function('ctx', `
  const { loading, isRecording, text, result, dictResult, window,
    setText, setMode, setVerify, setShowTemplates, setPendingTemplate,
    setTemplateNotice, searchDictDirect } = ctx;
  ${match[0]}
  return findCeremonyTerm;
`);

function run({ text = '', result = null, dictResult = null, accept = true } = {}) {
  const calls = [];
  const ctx = { loading:false, isRecording:false, text, result, dictResult,
    window: { confirm(message) { calls.push(['confirm', message]); return accept; } } };
  for (const name of ['setText', 'setMode', 'setVerify', 'setShowTemplates', 'setPendingTemplate', 'setTemplateNotice', 'searchDictDirect']) {
    ctx[name] = value => calls.push([name, value]);
  }
  create(ctx)('빙부상');
  return calls;
}

for (const [name, state] of [
  ['다른 입력', {text:'기존 글'}],
  ['검사 결과', {text:'빙부상', result:{errors:[]}}],
  ['사전 결과', {text:'빙부상', dictResult:{word:'빙부상'}}],
  ['빈 입력에 남은 결과', {result:{errors:[]}}],
]) {
  test(`${name}이 있으면 취소 시 확인 외에 상태를 변경하지 않는다`, () => {
    const calls = run({...state, accept:false});
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'confirm');
    assert.match(calls[0][1], /입력한 글이 검색어로 바뀌고 이전 검사·사전 결과가 사라집니다/);
  });
  test(`${name}이 있어도 승인하면 검색한다`, () => {
    const calls = run({...state, accept:true});
    assert.equal(calls.filter(([name]) => name === 'confirm').length, 1);
    assert.deepEqual(calls.find(([name]) => name === 'setText'), ['setText','빙부상']);
    assert.deepEqual(calls.find(([name]) => name === 'searchDictDirect'), ['searchDictDirect','빙부상']);
  });
}

test('입력과 결과가 없으면 확인 없이 검색한다', () => {
  const calls = run();
  assert.equal(calls.some(([name]) => name === 'confirm'), false);
  assert.deepEqual(calls.find(([name]) => name === 'searchDictDirect'), ['searchDictDirect','빙부상']);
});

test('입력이 검색어와 같고 결과가 없으면 확인 없이 검색한다', () => {
  const calls = run({text:'빙부상'});
  assert.equal(calls.some(([name]) => name === 'confirm'), false);
  assert.deepEqual(calls.find(([name]) => name === 'searchDictDirect'), ['searchDictDirect','빙부상']);
});
