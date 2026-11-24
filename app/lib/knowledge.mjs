// 검색 전용: 원문을 통째로 모델에 넣거나 공개 웹 전체를 학습했다는 뜻이 아닙니다.
export const KNOWLEDGE_VERSION = '2026.11.24-1';
export const compact = s => String(s || '').normalize('NFC').replace(/[\s\u00ad\u200b]+/gu, '');
const unique = xs => [...new Set(xs)];
const STOP = new Set(['그리고','그러나','합니다','있습니다','없습니다','오늘','나는','저는','그것은','이것은','정말','매우','우리','하기','하는','하고','있는','없는','이런','그런']);
export function searchTerms(text) {
  const words = String(text || '').normalize('NFC').match(/[가-힣]{2,20}|[A-Za-z]{3,20}/g) || [];
  const out = [];
  for (const w of words) {
    if (STOP.has(w)) continue;
    out.push(w);
    const stem = w.replace(/(?:에서는|에게서|으로는|이라는|이라고|이라고는|에서|에게|으로|까지|부터|처럼|보다|하고|하며|한다|했다|합니다|습니다|어요|아요|네요|어요|으면|지만|거나|이라|이다|은|는|이|가|을|를|에|와|과|도|만)$/u, '');
    if (stem.length >= 2 && stem !== w && !STOP.has(stem)) out.push(stem);
    if (w.length >= 4) for (let n = 2; n <= Math.min(4, w.length); n++) for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i+n));
  }
  return unique(out).slice(0, 120);
}
export function makeKnowledgeIndex(rules, cases = []) {
  return {
    rules: rules.map(r => ({...r, _body: compact(r.rule + '\n' + r.explain)})),
    cases: cases.map(c => ({...c, _keys: (c.keywords || []).map(compact).filter(k => k.length >= 2)})),
  };
}
function excerpt(rule, explain, keys, limit) {
  const full = String(rule || '') + (explain ? '\n해설:\n' + explain : '');
  if (full.length <= limit) return {text: full, truncated: false};
  const lines = full.split('\n').filter(Boolean);
  const selected = new Set([0]);
  // 본문을 먼저 확보하고 관련 용례와 예외·허용의 이웃 문단을 함께 보냅니다.
  let used = 0;
  for (let i=0; i<lines.length && used < Math.min(rule.length, limit * .45); i++) { selected.add(i); used += lines[i].length; }
  for (let i=0; i<lines.length; i++) if (keys.some(k => compact(lines[i]).includes(k))) {
    for (let j=Math.max(0,i-1); j<=Math.min(lines.length-1,i+1);j++) selected.add(j);
  }
  for (let i=0; i<lines.length; i++) if (/다만|허용|예외|붙임|주의|원칙/.test(lines[i])) selected.add(i);
  let result = '';
  for (const i of [...selected].sort((a,b)=>a-b)) {
    const line = lines[i];
    if (result.length + line.length + 1 <= limit - 55) result += (result ? '\n' : '') + line;
  }
  if (!result) result = full.slice(0, limit - 55);
  return {text: result + '\n[관련 부분 발췌. 빠진 조건·예외는 원문 확인 필요]', truncated: true};
}
export function retrieveKnowledge(index, text, options = {}) {
  const maxRules = options.maxRules ?? 7, maxCases = options.maxCases ?? 5;
  const maxChars = options.maxChars ?? 14000, maxDocChars = options.maxDocChars ?? 2300;
  const keys = unique([...(options.words || []).map(compact).filter(x=>x.length>=2), ...searchTerms(text).map(compact)]).slice(0,120);
  const target = compact(text);
  const matchedCases = index.cases.map(c => ({c,score:c._keys.reduce((n,k)=>n+(target.includes(k)?Math.min(k.length,8):0),0)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,maxCases);
  const priorities = unique([...(options.ruleIds || []),...matchedCases.flatMap(x=>x.c.ruleIds || [])]);
  const frequencies = keys.map(k => index.rules.reduce((n,r)=>n+Number(r._body.includes(k)),0));
  const ranks = index.rules.map(r => {
    let score = priorities.includes(r.id) ? 100 : 0;
    for(let i=0;i<keys.length;i++) if(r._body.includes(keys[i])) score += Math.log(1+index.rules.length/(1+frequencies[i])) * Math.min(keys[i].length,5);
    if (['M2','M41','M42','M47'].includes(r.id)) score += .1;
    // 발음법/로마자는 표기법으로 무조건 적용하지 않습니다.
    if (/^[VR]/.test(r.id) && !/발음|로마자|roman|영문|알파벳/i.test(text) && !priorities.includes(r.id)) score *= .25;
    return {r,score};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score).slice(0,maxRules);
  const blocks = [];
  let size = 0;
  for(const {c} of matchedCases) {
    const src = (c.sources || []).map(s => `${s.title || '국립국어원'} ${s.url}`).join('\n');
    const b = {id:c.id,kind:'usage',title:c.title,url:c.sources?.[0]?.url || '',text:`[용례 ${c.id}] ${c.title}\n${c.note}\n출처:\n${src}`,truncated:false};
    if(size+b.text.length<=maxChars){blocks.push(b);size+=b.text.length;}
  }
  for(const {r} of ranks) {
    const e = excerpt(r.rule,r.explain,keys,maxDocChars);
    const b = {id:r.id,kind:'rule',title:`${r.law} ${r.article}`,url:r.url,truncated:e.truncated,text:`[${r.id}] ${r.law} ${r.article} (${r.chapter})\n출처: ${r.url}\n${e.text}`};
    if(size+b.text.length<=maxChars){blocks.push(b);size+=b.text.length;}
  }
  return {blocks,ruleIds:blocks.filter(b=>b.kind==='rule').map(b=>b.id),caseIds:blocks.filter(b=>b.kind==='usage').map(b=>b.id),context:blocks.map(b=>b.text).join('\n\n---\n\n'),characters:size};
}
export function normalizeSourceUrl(value) {
  try {const u = new URL(String(value));if(u.protocol!=='https:' && u.protocol!=='http:')return '';if(u.username||u.password)return '';u.hash='';return u.href;} catch{return '';}
}
export function isNiklUrl(value) {try{const h=new URL(value).hostname.toLowerCase();return h==='korean.go.kr'||h.endsWith('.korean.go.kr');}catch{return false;}}
export function filterSeenSources(sources, seenUrls, mustBeNikl = false) {
  const seen = new Set([...seenUrls].map(normalizeSourceUrl).filter(Boolean));
  const used = new Set();
  return (Array.isArray(sources)?sources:[]).filter(s=>s&&typeof s.url==='string').map(s=>({...s,url:normalizeSourceUrl(s.url)})).filter(s=>s.url&&seen.has(s.url)&&(!mustBeNikl||isNiklUrl(s.url))&&!used.has(s.url)&&used.add(s.url)).slice(0,3).map(s=>({title:String(s.title||'자료').slice(0,120),url:s.url,quote:String(s.quote||'').slice(0,350)}));
}
export function parseModelJSON(text) {
  const value=String(text||'').trim();
  const fenced=value.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw=fenced?fenced[1]:value.slice(value.indexOf('{'),value.lastIndexOf('}')+1);
  if(!raw)throw new Error('AI가 완전한 JSON 결과를 반환하지 않았습니다.');
  return JSON.parse(raw);
}
export function normalizeVerification(item, proposal, {sources = [], rule = null, ruleQuote = '', localSources = []} = {}) {
  const allowed = new Set(['일치','AI교정틀림','부분','둘다가능','확인불가']);
  let verdict=allowed.has(proposal?.verdict)?proposal.verdict:'확인불가';
  if(proposal?.originalCorrect===true)verdict='둘다가능';
  if(verdict==='일치' && (proposal?.originalCorrect!==false || proposal?.officialRight!==item.right))verdict='확인불가';
  const validRule=!!rule && !!ruleQuote;
  const evidence = sources.length>0 || validRule || localSources.length>0;
  const found=proposal?.found===true && evidence && verdict!=='확인불가';
  let official=String(proposal?.officialRight??'');
  // 띄어쓰기를 제거해서 동등 판정하지 않습니다. 공백도 교정의 핵심입니다.
  if(!found || verdict==='둘다가능')official=item.wrong;
  else if(verdict==='일치')official=item.right;
  else if(!Object.hasOwn(proposal||{},'officialRight') || official.length>150 || /[\n\r]|\s또는\s|\s\/\s/.test(official)) {verdict='확인불가';official=item.wrong;}
  const finalFound=found&&verdict!=='확인불가';
  return {id:item.id,source:finalFound?'nikl':'none',found:finalFound,verdict:finalFound?verdict:'확인불가',officialRight:finalFound?official:item.wrong,explain:String(proposal?.explain||'').slice(0,650),rule:validRule?rule:null,ruleQuote:validRule?ruleQuote:'',sources:[...sources,...localSources].slice(0,3),evidence:{ruleQuoteMatched:validRule,searchUrlsMatched:sources.length,localCaseSources:localSources.length},requiresReview:!finalFound};
}
