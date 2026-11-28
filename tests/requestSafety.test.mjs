import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>fs.readFileSync(new URL(p,root),'utf8');
const strip=s=>s.replace(/^import\s[\s\S]*?;\s*/gm,'').replace(/\bexport\s+/g,'');
const guard=new Function(strip(read('app/lib/guard.js'))+';return {isForeignOrigin,allowRequest}')();
const deps={...guard,SYSTEM_CHECK:'',SYSTEM_FAST_CHECK:'',SYSTEM_DICT:'',knowledgeForText:()=>({context:'',ruleIds:[],caseIds:[]}),knowledgeSummary:()=>({}),parseModelJSON:()=>({errors:[],items:[]}),anchorEdits:()=>[],getFuneralDictionaryEntry:()=>null,knowledgeForItem:()=>({context:'',ruleIds:[],caseIds:[]}),refToId:()=>null,getRule:()=>null,getCase:()=>null,publicRule:()=>null,quoteInRule:()=>false,quoteInCase:()=>false,filterSeenSources:()=>[],normalizeVerification:()=>({found:false}),normalizeSourceUrl:s=>s};
const route=(p,overrides={})=>{const d={...deps,...overrides};return new Function(...Object.keys(d),strip(read(p))+';return POST')(...Object.values(d));};
const check=route('app/api/check/route.js'),verify=route('app/api/verify/route.js'),dict=route('app/api/dict/route.js');
let n=0;const req=(body,extra={})=>new Request('https://example.invalid/api',{method:'POST',headers:{host:'example.invalid','x-vercel-forwarded-for':String(++n),...extra},body});
const json=x=>JSON.stringify(x);
const item={id:'e1',wrong:'할수',right:'할 수',context:'할수 있다',rule:''};
test('잘못된 JSON과 배열 본문은 400',async()=>{for(const f of [check,verify,dict])for(const b of ['{','[]','null'])assert.equal((await f(req(b))).status,400);});
test('실제 수신 바이트와 Content-Length 모두 제한',async()=>{for(const f of [check,verify,dict]){assert.equal((await f(req(json({padding:'가'.repeat(23000)})))).status,413);assert.equal((await f(req('{}',{'content-length':'999999'}))).status,413);}});
test('검증 단계와 ID 누락, 중복, 비정상 형식 차단',async()=>{for(const x of [{stage:'bogus',items:[item]},{items:[item]},{stage:'web',items:[{...item,id:null}]},{stage:'web',items:[item,item]},{stage:'web',items:[{...item,id:{}}]},{stage:'web',items:[{...item,id:'x'.repeat(101)}]},{stage:'web',items:[{...item,id:1},{...item,id:'1'}]}])assert.equal((await verify(req(json(x)))).status,400);});
test('정상 빈 검증과 문자열 필드 검증',async()=>{assert.deepEqual(await (await verify(req(json({stage:'local',items:[]})))).json(),{items:[]});assert.equal((await verify(req(json({stage:'nikl',items:[{...item,context:{}}]})))).status,400);assert.equal((await check(req(json({mode:'check',text:'글',contextAfter:{}})))).status,400);});
test('비활성 사전은 외부 요청 없이 503, 단어 형식 및 출처 검사',async()=>{const old=process.env.KOREAN_DICT_API_KEY,fetchOld=globalThis.fetch;delete process.env.KOREAN_DICT_API_KEY;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('secret')};try{assert.equal((await dict(req(json({word:'사전'})))).status,503);assert.equal((await dict(req(json({word:{}})))).status,400);assert.equal((await dict(req(json({word:'가'.repeat(51)})))).status,400);assert.equal((await dict(req(json({word:'사전'}),{origin:'https://evil.invalid'}))).status,403);assert.equal(calls,0);}finally{globalThis.fetch=fetchOld;if(old!==undefined)process.env.KOREAN_DICT_API_KEY=old;}});
test('사전 예외는 민감한 예외 내용을 노출하지 않음',async()=>{const old=process.env.KOREAN_DICT_API_KEY,fetchOld=globalThis.fetch;process.env.KOREAN_DICT_API_KEY='test-placeholder';globalThis.fetch=async()=>{throw Error('sensitive-exception')};try{const r=await dict(req(json({word:'사전'})));assert.equal(r.status,502);assert.ok(!(await r.text()).includes('sensitive-exception'));}finally{globalThis.fetch=fetchOld;if(old===undefined)delete process.env.KOREAN_DICT_API_KEY;else process.env.KOREAN_DICT_API_KEY=old;}});

test('검증 가능한 후보를 먼저 고르고 30개 초과 여부를 반환',async()=>{
  const old=process.env.ANTHROPIC_API_KEY,fetchOld=globalThis.fetch;
  process.env.ANTHROPIC_API_KEY='test-placeholder';
  globalThis.fetch=async()=>Response.json({content:[{type:'text',text:'{}'}],stop_reason:'end_turn'});
  try {
    const valid=Array.from({length:31},(_,i)=>({confidence:'high',wrong:'오류'+i,right:'수정'+i}));
    const invalid=Array.from({length:35},()=>({confidence:'low',wrong:'오류',right:'수정'}));
    for(const [input,count,truncated] of [[invalid.concat(valid),30,true],[invalid.concat(valid.slice(0,30)),30,false],[invalid,0,false]]) {
      const run=route('app/api/check/route.js',{parseModelJSON:()=>({errors:input}),anchorEdits:(_text,candidates)=>candidates});
      const response=await run(req(json({mode:'check',text:'검사할 글'})));
      assert.equal(response.status,200);
      const result=JSON.parse((await response.json()).text);
      assert.equal(result.errors.length,count);
      assert.equal(result.truncated,truncated);
      if(count) { assert.equal(result.errors[0].wrong,'오류0'); assert.equal(result.errors[29].wrong,'오류29'); }
    }
  } finally { globalThis.fetch=fetchOld; if(old===undefined)delete process.env.ANTHROPIC_API_KEY;else process.env.ANTHROPIC_API_KEY=old; }
});
