import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, templates, filterTemplates } from '../app/data/messageTemplates.mjs';

const ids = (items) => items.map((item) => item.id);
test('범주와 문구 ID가 각각 고유하다', () => {
  assert.equal(new Set(ids(categories)).size, categories.length);
  assert.equal(new Set(ids(templates)).size, templates.length);
});
test('필수 여덟 범주가 모두 있다', () => {
  for (const id of ['wedding', 'birth', 'birthday', 'promotion', 'opening', 'condolence', 'celebration-thanks', 'condolence-thanks']) assert.ok(ids(categories).includes(id));
});
test('문구는 실존하는 범주에 속한다', () => {
  for (const item of templates) assert.ok(ids(categories).includes(item.categoryId), item.id);
});
test('각 범주에 최소 세 문구가 있다', () => {
  for (const category of categories) assert.ok(filterTemplates(category.id).length >= 3, category.id);
});
test('문구 수가 24개 이상 32개 이하다', () => {
  assert.ok(templates.length >= 24 && templates.length <= 32);
});
test('범주명과 문구의 라벨과 본문이 비어 있지 않다', () => {
  for (const category of categories) assert.ok(category.label.trim());
  for (const item of templates) assert.ok(item.id && item.label.trim() && item.body.trim(), item.id);
});
test('본문에는 치환 표시나 가짜 연락처가 없다', () => {
  for (const item of templates) {
    assert.doesNotMatch(item.body, /\{[^}]*\}|\[[^\]]*\]|<[^>]*>|(?:010|02|031)[- .]?\d{3,4}[- .]?\d{4}|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i, item.id);
  }
});
test('필터는 지정 범주만 돌려준다', () => {
  for (const category of categories) {
    const result = filterTemplates(category.id);
    assert.ok(result.length > 0);
    assert.ok(result.every((item) => item.categoryId === category.id));
  }
});
test('알 수 없는 범주는 빈 목록, 미지정은 전체 목록이다', () => {
  assert.deepEqual(filterTemplates('not-a-category'), []);
  assert.equal(filterTemplates().length, templates.length);
});
test('조문 문구에 느낌표와 과한 단정이 없고 중립 대안이 있다', () => {
  const condolences = filterTemplates('condolence');
  for (const item of condolences) assert.doesNotMatch(item.body, /[!！]|좋은\s*곳|힘내/);
  assert.ok(condolences.some((item) => item.id === 'condolence-neutral'));
  assert.ok(condolences.find((item) => item.id === 'condolence-formal').note.includes('신념'));
});
test('특정 상황을 전제하는 예문에 사용 조건이 있다', () => {
  for (const id of ['promotion-short', 'promotion-formal', 'opening-short', 'opening-move', 'condolence-thanks-visit']) assert.ok(templates.find((item) => item.id === id)?.note);
});
