// 서버 전용: 공식 규범 본문·해설과 직접 정리한 용례를 문맥으로 검색합니다.
import data from '../data/kornorms.json';
import cases from '../data/usageCases.json';
import { makeKnowledgeIndex, retrieveKnowledge } from './knowledge.mjs';
const BY_ID = Object.fromEntries(data.rules.map(r => [r.id, r]));
const BY_CASE = Object.fromEntries(cases.map(c => [c.id, c]));
const INDEX = makeKnowledgeIndex(data.rules, cases);
export function refToId(ref) {
  const s = String(ref || '').trim();
  if (BY_ID[s]) return s;
  const n = s.match(/제?\s*(\d+)\s*항/)?.[1];
  if (!n) return null;
  const prefix = /발음/.test(s) ? 'V' : /표준어/.test(s) ? 'S' : /맞춤법/.test(s) || /^제?\s*\d+\s*항$/.test(s) ? 'M' : '';
  return BY_ID[prefix+n] ? prefix+n : null;
}
export const getRule = id => BY_ID[id] || null;
export const getCase = id => BY_CASE[id] || null;
export function publicRule(r) {
  if (!r) return null;
  const lines = r.rule.split('\n');
  return {id:r.id,title:`${r.law} ${r.article}`,chapter:r.chapter,statement:lines[0],examples:lines.slice(1,9).filter(l=>l.length<=40).slice(0,6).join(' · '),url:r.url};
}
const normalizedQuote = s => String(s || '').normalize('NFC').replace(/\s+/gu,' ').trim();
export function quoteInRule(id, quote) {
  const r = getRule(id), q = normalizedQuote(quote);
  return !!r && q.length >= 12 && q.length <= 450 && normalizedQuote(r.rule+'\n'+r.explain).includes(q);
}
export function quoteInCase(id, quote) {
  const c = getCase(id), q = normalizedQuote(quote);
  return !!c && q.length >= 12 && normalizedQuote(c.note).includes(q);
}
export const knowledgeForText = (text, options = {}) => retrieveKnowledge(INDEX,text,options);
export function knowledgeForItem(item) {
  return knowledgeForText(item.context || '',{words:[item.wrong,item.right],ruleIds:[refToId(item.rule)].filter(Boolean),maxRules:3,maxCases:2,maxChars:5500,maxDocChars:2100});
}
export const ruleContext = item => knowledgeForItem(item).blocks.map(b=>b.text);
export function knowledgeSummary() {
  return {version:'2026.11.24-1',source:data.source,fetchedAt:data.fetchedAt,rules:data.rules.length,counts:data.counts,cases:cases.length,sourceUrls:data.sourceUrls,attribution:data.attribution,copyrightPolicy:data.copyrightPolicy};
}