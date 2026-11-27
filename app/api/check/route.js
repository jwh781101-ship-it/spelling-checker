import { SYSTEM_CHECK, SYSTEM_FAST_CHECK, SYSTEM_DICT } from '../../lib/prompts';
import { isForeignOrigin, allowRequest } from '../../lib/guard';
import { knowledgeForText, knowledgeSummary } from '../../lib/kornorms';
import { parseModelJSON } from '../../lib/knowledge.mjs';
import { anchorEdits } from '../../lib/corrections.mjs';
import { getFuneralDictionaryEntry } from '../../data/funeralTerms.mjs';
export const maxDuration = 60;
export async function POST(request) {
  try {
    if(isForeignOrigin(request))return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
    if(!allowRequest(request,'check'))return Response.json({error:'요청이 많습니다. 1분 후 다시 검사해 주세요.'},{status:429});
    const {mode,text,contextBefore,contextAfter,profile='fast'}=await request.json();
    if(mode==='check'&&!['fast','thorough'].includes(profile))return Response.json({error:'검사 방식을 확인해 주세요.'},{status:400});
    const fast=mode==='check'&&profile==='fast';
    if(!['check','dict'].includes(mode)||typeof text!=='string'||!text.trim())return Response.json({error:'검사할 글을 입력해 주세요.'},{status:400});
    const limit=mode==='check'?1200:50;
    if(text.length>limit)return Response.json({error:`한 번에 ${limit}자까지 검사할 수 있습니다. 글을 나누어 주세요.`},{status:400});
    if(mode==='dict'){
      const entry=getFuneralDictionaryEntry(text);
      if(entry)return Response.json({text:JSON.stringify(entry),stop:'end_turn'});
    }
    if(!process.env.ANTHROPIC_API_KEY)return Response.json({error:'AI 서비스 설정을 확인해 주세요.'},{status:503});
    const before=typeof contextBefore==='string'?contextBefore.slice(-300):'';
    const after=typeof contextAfter==='string'?contextAfter.slice(0,300):'';
    const knowledge=mode==='check'?knowledgeForText(before+text+after):null;
    const user=mode==='check'?JSON.stringify({text,contextBefore:before,contextAfter:after})+'\n\n[문맥 검색으로 고른 공식 규범 및 선별 용례]\n'+knowledge.context:JSON.stringify({word:text});
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:fast?'claude-haiku-4-5-20251001':'claude-sonnet-4-6',max_tokens:mode==='check'?6000:1800,system:mode==='check'?(fast?SYSTEM_FAST_CHECK:SYSTEM_CHECK):SYSTEM_DICT,messages:[{role:'user',content:user}]}),
      signal:AbortSignal.any([request.signal,AbortSignal.timeout(fast?25000:55000)])
    });
    const data=await response.json();
    if(!response.ok||data.error)return Response.json({error:'AI 서비스가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502});
    if(data.stop_reason==='max_tokens')return Response.json({error:'검사 결과가 너무 길었습니다. 글을 더 짧게 나누어 다시 검사해 주세요.'},{status:502});
    const parsed=parseModelJSON((data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(''));
    if(mode==='dict')return Response.json({text:JSON.stringify(parsed),stop:data.stop_reason});
    if(!Array.isArray(parsed.errors))return Response.json({error:'검사 결과 형식을 확인하지 못했습니다. 원문은 바꾸지 않았습니다.'},{status:502});
    const candidates=(Array.isArray(parsed.errors)?parsed.errors:[]).slice(0,30).filter(e=>e&&e.confidence==='high'&&typeof e.wrong==='string'&&e.wrong.length<=120&&typeof e.right==='string'&&e.right.length<=150).map(e=>({wrong:e.wrong,right:e.right,start:e.start,end:e.end,anchorBefore:typeof e.anchorBefore==='string'?e.anchorBefore.slice(-40):'',anchorAfter:typeof e.anchorAfter==='string'?e.anchorAfter.slice(0,40):'',type:String(e.type||'맞춤법').slice(0,20),explain:String(e.explain||'').slice(0,500),rule:knowledge.ruleIds.includes(e.rule)?e.rule:'',context:String(e.context||'').slice(0,600),confidence:'high',status:'pending'}));
    const errors=anchorEdits(text,candidates);
    const result={originalText:text,correctedText:text,errors,summary:String(parsed.summary||'검증한 제안만 반영합니다.').slice(0,300),knowledge:{...knowledgeSummary(),retrievedRules:knowledge.ruleIds,retrievedCases:knowledge.caseIds}};
    return Response.json({text:JSON.stringify(result),stop:data.stop_reason});
  }catch{return Response.json({error:'검사를 완료하지 못했습니다. 원문은 바꾸지 않았습니다. 다시 시도해 주세요.'},{status:500});}
}