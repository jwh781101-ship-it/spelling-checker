import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../app/components/CeremonyGuide.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/components/ceremony-guide.css', import.meta.url), 'utf8');

test('봉투와 장례 용어를 클라이언트 named export로 제공한다', () => {
  assert.match(source, /'use client'/);
  assert.match(source, /export function EnvelopeGuide\(/);
  assert.match(source, /export function FuneralTerms\(/);
  assert.match(source, /import \{ funeralTerms \} from '..\/data\/funeralTerms\.mjs'/);
});

test('앞면 예시와 접근 가능한 선택 상태가 있다', () => {
  for (const value of ['결혼식', '장례식', '祝結婚', '賻儀', '축결혼', '부의', '앞면', '뒷면']) assert.ok(source.includes(value), value);
  assert.match(source, /aria-pressed=\{occasion === key\}/);
  assert.match(source, /aria-label=\{description\}/);
});

test('뒷면의 이름과 소속은 독립 상태로 세로 분리되고 입력을 지우면 소속은 빠진다', () => {
  assert.match(source, /useState\('홍길동'\)/);
  assert.match(source, /useState\('회사이름'\)/);
  assert.match(source, /Array\.from\(value\)\.map/);
  assert.match(source, /example === 'company' && Boolean\(affiliation\.trim\(\)\)/);
  assert.match(source, /<VerticalText value=\{name\} \/>\{showAffiliation && <VerticalText value=\{affiliation\} \/>\}/);
  assert.match(css, /\.cg-back-writing\s*\{[^}]*left:8%/);
  assert.match(css, /\.cg-vertical\s*\{[^}]*flex-direction:column/);
});

test('장례 용어 뜻을 한자보다 먼저 보여주고 선택적 사전 콜백을 사용한다', () => {
  assert.ok(source.indexOf('className="cg-term-meaning"') < source.indexOf('className="cg-term-hanja"'));
  assert.match(source, /typeof onFindDictionary === 'function'/);
  assert.match(source, /onFindDictionary\(word\)/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
});


test('소속 수정과 삭제는 회사 모드로 반영하고 이름 수정은 봉투 면을 바꾸지 않는다', () => {
  assert.ok(source.includes("onChange={(event) => { setAffiliation(event.target.value); setExample('company'); }}"));
  assert.ok(source.includes('onChange={(event) => setName(event.target.value)}'));
  assert.ok(source.includes("example === 'company' && Boolean(affiliation.trim())"));
  assert.ok(source.includes("onClick={() => setExample('name')}"));
});

test('봉투 앞면 한자와 뒷면 이름 모두 공개 궁서 글꼴을 쓴다',()=>{
 assert.match(css,/@font-face\s*\{[^}]*font-family:'BareunGungsuh'/);
 assert.match(css,/\.cg-front-writing\s*\{[^}]*font-family:'BareunGungsuh'/);
 assert.match(css,/\.cg-back-writing\s*\{[^}]*font-family:'BareunGungsuh'/);
 assert.match(css,/font-display:swap/);
});
