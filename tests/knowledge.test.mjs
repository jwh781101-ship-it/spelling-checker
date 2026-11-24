import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeKnowledgeIndex, retrieveKnowledge, filterSeenSources, normalizeVerification, parseModelJSON } from '../app/lib/knowledge.mjs';
const rules=JSON.parse(fs.readFileSync(new URL('../app/data/kornorms.json',import.meta.url),'utf8'));
const cases=JSON.parse(fs.readFileSync(new URL('../app/data/usageCases.json',import.meta.url),'utf8'));
const index=makeKnowledgeIndex(rules.rules,cases);
test('공식 규범 348개와 40개 용례의 ID·연결 무결성',()=>{
 assert.equal(rules.rules.length,348);assert.equal(cases.length,40);assert.equal(new Set(rules.rules.map(r=>r.id)).size,348);
 for(const c of cases)for(const id of c.ruleIds)assert.ok(rules.rules.some(r=>r.id===id),id);
});
test('사이시옷 오기에서도 공식 조문과 사례 검색',()=>{
 const r=retrieveKnowledge(index,'나무잎이 바람에 날린다.');assert.ok(r.ruleIds.includes('M30'));assert.ok(r.caseIds.includes('C032'));
});
test('공백 있는 표기와 붙임 허용 표기 모두 관련 근거 검색',()=>{
 for(const text of ['사과를 먹어 보았다.','사과를 먹어보았다.']) {const r=retrieveKnowledge(index,text);assert.ok(r.ruleIds.includes('M47'));assert.ok(r.caseIds.includes('C005'));}
});
test('있다가를 무조건 오기로 취급하지 않도록 문맥 카드 검색',()=>{assert.ok(retrieveKnowledge(index,'집에 잠시 있다가 나왔다.').caseIds.includes('C030'));});
test('복수 표준어를 다루는 카드 검색',()=>{assert.ok(retrieveKnowledge(index,'이쁜 꽃이 피었다.').caseIds.includes('C001'));});
test('검증용 검색 예산과 자료 수 제한',()=>{const r=retrieveKnowledge(index,'먹어보았다',{ruleIds:['M47'],maxChars:4500,maxRules:3,maxCases:2,maxDocChars:1600});assert.ok(r.characters<=4500);assert.ok(r.ruleIds.length<=3);});
test('같은 도메인의 지어낸 경로는 근거가 아니다',()=>{const seen=new Set(['https://www.korean.go.kr/a']);assert.equal(filterSeenSources([{url:'https://www.korean.go.kr/fake'}],seen,true).length,0);});
test('실제 URL만 인정하고 외부·위장 도메인은 제외',()=>{const seen=new Set(['https://www.korean.go.kr/a','https://korean.go.kr.evil.test/a']);const r=filterSeenSources([{url:'https://www.korean.go.kr/a'},{url:'https://korean.go.kr.evil.test/a'}],seen,true);assert.equal(r.length,1);});
const item={id:1,wrong:'할수 있다',right:'할 수 있다'};
const yes={found:true,originalCorrect:false,verdict:'일치',officialRight:'할 수 있다'};
const evidence={rule:{id:'M42'},ruleQuote:'의존 명사는 띄어 쓴다.'};
test('조항 존재만으로는 검증 성공 처리하지 않는다',()=>{const r=normalizeVerification(item,yes,{rule:{id:'M42'}});assert.equal(r.found,false);assert.equal(r.officialRight,item.wrong);});
test('근거를 확인한 확실한 교정만 승인',()=>{const r=normalizeVerification(item,yes,evidence);assert.equal(r.found,true);assert.equal(r.officialRight,item.right);});
test('확인불가는 AI 수정이 아니라 원문 유지',()=>{const r=normalizeVerification(item,{...yes,found:false},evidence);assert.equal(r.officialRight,item.wrong);assert.equal(r.found,false);});
test('원문이 허용되면 대안도 맞더라도 원문 유지',()=>{const r=normalizeVerification(item,{...yes,originalCorrect:true},evidence);assert.equal(r.verdict,'둘다가능');assert.equal(r.officialRight,item.wrong);});
test('띄어쓰기를 지워 두 표현을 같다고 보지 않는다',()=>{const r=normalizeVerification(item,{...yes,officialRight:'할수 있다'},evidence);assert.equal(r.found,false);});
test('원문 오류 여부를 판단하지 못했으면 자동 반영하지 않는다',()=>{const r=normalizeVerification(item,{...yes,originalCorrect:null},evidence);assert.equal(r.found,false);});
test('의미가 서로 다른 복수 정답 문자열은 교정문에 넣지 않는다',()=>{const r=normalizeVerification(item,{...yes,verdict:'부분',officialRight:'할수 있다 / 할 수 있다'},evidence);assert.equal(r.found,false);});
test('완전한 JSON·코드블록 해석, 불완전 응답 거부',()=>{assert.deepEqual(parseModelJSON('```json\n{"items":[]}\n```'),{items:[]});assert.throws(()=>parseModelJSON('{"items":['));});
test('여러 오류가 있는 문맥에서도 대상 오탈자의 용례를 먼저 검색',()=>{
 const r=retrieveKnowledge(index,'나는 할수 있다. 다 됬다. 나무잎이 떨어졌다. 다시 할수 있다.',{words:['됬다','됐다'],maxCases:2});
 assert.ok(r.caseIds.includes('C035'));assert.ok(r.ruleIds.includes('M35'));
});
test('대상 사이시옷 교정은 다른 띄어쓰기 용례에 밀리지 않는다',()=>{
 const r=retrieveKnowledge(index,'나는 할수 있다. 다 됬다. 나무잎이 떨어졌다. 다시 할수 있다.',{words:['나무잎','나뭇잎'],maxCases:2});
 assert.ok(r.caseIds.includes('C032'));assert.ok(r.ruleIds.includes('M30'));
});

test('이미지 특수문자를 빈칸으로 숨기지 않고 전사·미확인 표기',()=>{
 const r=rules.rules.find(r=>r.id==='M35');assert.ok(r.rule.includes('[ㅘ+받침ㅆ]'));assert.ok(r.rule.includes('[ㅙ+받침ㅆ]'));assert.equal(r.hasUntranscribedImages,false);
 const f=rules.rules.find(r=>r.id==='F438');assert.equal(f.hasUntranscribedImages,true);assert.ok(f.rule.includes('[그림]'));assert.ok(f.images.length>0);
});

test('되다·뵈다 활용형도 해당 공식 용례를 우선 검색',()=>{for(const [wrong,right,id]of [['됬어요','됐어요','C035'],['뵈요','봬요','C036']]){const r=retrieveKnowledge(index,'저도 할수 있어요. 준비가 됬어요. 내일 뵈요.',{words:[wrong,right],maxCases:2});assert.ok(r.caseIds.includes(id));}});
