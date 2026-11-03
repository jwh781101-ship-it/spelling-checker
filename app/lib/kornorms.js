// 국립국어원 한국어 어문 규범 원문 조회 (서버 전용)
import data from '../data/kornorms.json';

const RULES = data.rules;
const BY_ID = Object.fromEntries(RULES.map(r => [r.id, r]));

// "한글 맞춤법 제42항", "맞춤법 42항", "표준어 규정 제17항" → 'M42' / 'S17'
export function refToId(ref) {
  if (!ref) return null;
  const s = String(ref);
  if (BY_ID[s]) return s;
  const n = (s.match(/제?\s*(\d+)\s*항/) || [])[1];
  if (!n) return null;
  if (/표준어/.test(s)) return BY_ID['S' + n] ? 'S' + n : null;
  if (/맞춤법/.test(s) || !/규정/.test(s)) return BY_ID['M' + n] ? 'M' + n : null;
  return null;
}

export function getRule(id) {
  return BY_ID[id] || null;
}

// 화면에 보여 줄 짧은 형태
export function publicRule(r) {
  if (!r) return null;
  const lines = r.rule.split('\n');
  return {
    id: r.id,
    title: `${r.law} ${r.article}`,
    chapter: r.chapter,
    statement: lines[0],
    examples: lines.slice(1, 9).filter(l => l.length <= 40).slice(0, 6).join(' · '),
    url: r.url,
  };
}

// 하이픈·공백 무시 비교용
const plain = s => String(s || '').replace(/[-\s·]/g, '');

// 틀린 말/고친 말이 규정 본문(예시 목록)에 직접 나오는 조항 찾기
export function findRulesByWords(words) {
  const keys = words.map(plain).filter(w => w.length >= 2);
  if (!keys.length) return [];
  const hits = [];
  for (const r of RULES) {
    const lines = r.rule.split('\n');
    const matched = lines.filter(l => keys.some(k => plain(l).includes(k)));
    if (matched.length) hits.push({ rule: r, lines: matched.slice(0, 4) });
  }
  return hits.slice(0, 3);
}

// 검증 AI에게 넘길 규정 원문 묶음
export function ruleContext(item) {
  const blocks = [];
  const seen = new Set();
  const cited = getRule(refToId(item.rule));
  if (cited) {
    seen.add(cited.id);
    blocks.push(`[${cited.id}] ${cited.law} ${cited.article} (${cited.chapter})\n조문:\n${cited.rule.slice(0, 1500)}\n해설:\n${cited.explain.slice(0, 2000)}`);
  }
  for (const h of findRulesByWords([item.wrong, item.right])) {
    if (seen.has(h.rule.id)) continue;
    seen.add(h.rule.id);
    blocks.push(`[${h.rule.id}] ${h.rule.law} ${h.rule.article} (${h.rule.chapter})\n조문 첫 줄: ${h.rule.rule.split('\n')[0]}\n이 낱말이 나오는 줄:\n${h.lines.join('\n')}`);
  }
  return blocks;
}

// 인용문이 실제로 규정 원문에 있는지 확인
export function quoteInRule(id, quote) {
  const r = getRule(id);
  if (!r || !quote) return false;
  const q = plain(quote).replace(/[‘’'"“”.,]/g, '');
  if (q.length < 4) return false;
  const body = plain(r.rule + r.explain).replace(/[‘’'"“”.,]/g, '');
  return body.includes(q);
}
