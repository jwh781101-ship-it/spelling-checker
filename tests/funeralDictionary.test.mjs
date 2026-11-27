import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {funeralTerms,getFuneralDictionaryEntry} from '../app/data/funeralTerms.mjs';
import {callAI} from '../app/lib/checkFlow.mjs';
const load=async p=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(new URL(p,import.meta.url))).toString('base64'));
const guard=await load('../app/lib/guard.js');
const source=fs.readFileSync(new URL('../app/api/check/route.js',import.meta.url),'utf8').replace(/^import\s[\s\S]*?;\s*/gm,'').replace(/\bexport\s+/g,'');
const deps={...guard,getFuneralDictionaryEntry,SYSTEM_CHECK:'check',SYSTEM_FAST_CHECK:'fast',SYSTEM_DICT:'dict',knowledgeForText:()=>({context:'',ruleIds:[],caseIds:[]}),knowledgeSummary:()=>({}),parseModelJSON:JSON.parse,anchorEdits:()=>[]};
const post=new Function(...Object.keys(deps),source+';return POST')(...Object.values(deps));
const request=(body,headers={})=>new Request('https://example.test/api/check',{method:'POST',headers:{'content-type':'application/json',host:'example.test',...headers},body:JSON.stringify(body)});
const invoke=(body,headers)=>post(request(body,headers));
test('두 표제어와 한자·정확한 쉬운 풀이',()=>{
 assert.deepEqual(funeralTerms,[{word:'빙부상',hanja:'聘父喪',meaning:'장인어른이 돌아가셨을 때 쓰는 말'},{word:'빙모상',hanja:'聘母喪',meaning:'장모님이 돌아가셨을 때 쓰는 말'}]);
 for(const term of funeralTerms){const e=getFuneralDictionaryEntry(term.word);assert.equal(e.hanja,term.hanja);assert.deepEqual(e.meanings,[{pos:'명사',definition:term.meaning,example:''}]);assert.deepEqual(e.synonyms,[]);assert.deepEqual(e.antonyms,[]);assert.match(e.note,/앱에 저장된 쉬운 풀이/);}
});
test('앞뒤 공백과 유니코드 정규화만 허용하고 부분 검색은 불허',()=>{
 for(const term of funeralTerms){assert.equal(getFuneralDictionaryEntry(' \n'+term.word+' \t').word,term.word);assert.equal(getFuneralDictionaryEntry(term.word.normalize('NFD')).word,term.word);}
 for(const word of ['빙부','빙모','빙부상 뜻','빙모상입니다','빙 부상','',null,12])assert.equal(getFuneralDictionaryEntry(word),null);
});
test('사전 API는 키와 네트워크 없이 기존 callAI 응답 계약으로 반환',async()=>{
 const old=process.env.ANTHROPIC_API_KEY,fetch0=globalThis.fetch;delete process.env.ANTHROPIC_API_KEY;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('외부 호출 금지');};
 try{for(const term of funeralTerms){const result=await callAI('dict','  '+term.word+'  ','','',{fetcher:(_url,init)=>post(new Request('https://example.test/api/check',init))});assert.equal(result.word,term.word);assert.equal(result.meanings[0].definition,term.meaning);}assert.equal(calls,0);}finally{globalThis.fetch=fetch0;if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;}
});
test('유효성 검사와 길이 제한은 로컬 사전보다 먼저 적용',async()=>{
 for(const body of [{mode:'dict',text:''},{mode:'dict',text:null},{mode:'bad',text:'빙부상'},{mode:'dict',text:'빙부상'+' '.repeat(48)},{mode:'check',text:'빙부상',profile:'invalid'}])assert.equal((await invoke(body)).status,400);
});
test('교차 출처 차단 및 요청 제한을 로컬 사전도 우회하지 못함',async()=>{
 assert.equal((await invoke({mode:'dict',text:'빙부상'},{origin:'https://evil.test'})).status,403);
 const headers={'x-forwarded-for':'192.0.2.199'};for(let i=0;i<45;i++)assert.equal((await invoke({mode:'dict',text:'빙모상'},headers)).status,200);assert.equal((await invoke({mode:'dict',text:'빙모상'},headers)).status,429);
});
test('부분 일치·다른 단어와 맞춤법 모드는 기존 AI 처리 경로 사용',async()=>{
 const old=process.env.ANTHROPIC_API_KEY,fetch0=globalThis.fetch;process.env.ANTHROPIC_API_KEY='test-key';const sent=[];
 globalThis.fetch=async(_url,init)=>{const payload=JSON.parse(init.body);sent.push(payload);const result=payload.system==='dict'?{word:JSON.parse(payload.messages[0].content).word,meanings:[]}:{errors:[]};return Response.json({content:[{type:'text',text:JSON.stringify(result)}],stop_reason:'end_turn'});};
 try{for(const word of ['빙부상 뜻','마음']){const r=await invoke({mode:'dict',text:word});assert.equal(r.status,200);assert.equal(JSON.parse((await r.json()).text).word,word);}const r=await invoke({mode:'check',text:'빙부상'});assert.equal(r.status,200);assert.equal(JSON.parse((await r.json()).text).originalText,'빙부상');assert.equal(sent.length,3);assert.deepEqual(sent.map(x=>x.system),['dict','dict','fast']);}finally{globalThis.fetch=fetch0;if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old;}
});
