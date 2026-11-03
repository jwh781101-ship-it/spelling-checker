// 교정 항목 검증 API
// stage 'nikl' : ① 앱에 넣어 둔 한국어 어문 규범 원문(한글 맞춤법·표준어 규정)으로 먼저 판단
//                ② 규정만으로 모자라면 국립국어원(korean.go.kr) 자료만 검색해서 확인
// stage 'web'  : 국립국어원 자료에서 못 찾은 항목만 일반 웹 검색으로 확인 (참고용)
import { ruleContext, refToId, getRule, publicRule, quoteInRule } from '../../lib/kornorms';
import { isForeignOrigin } from '../../lib/guard';

export const maxDuration = 120;

const MODEL = 'claude-sonnet-4-6';
const NIKL_DOMAIN = 'korean.go.kr';

const OUTPUT_FORMAT = `최종 답은 아래 JSON만 출력하세요. 마크다운 코드블록 없이 순수 JSON:
{"items":[{"id":0,"found":true,"verdict":"일치|AI교정틀림|부분|둘다가능|확인불가","officialRight":"자료 기준 올바른 표현","explain":"어르신도 이해할 쉬운 설명 1~2문장","ruleId":"M42","ruleQuote":"규정 원문에서 그대로 옮긴 한 문장","sources":[{"title":"자료 제목","url":"https://...","quote":"자료의 핵심 문장 짧게"}]}]}
- verdict 뜻: 일치=AI 교정이 자료와 같음 / AI교정틀림=자료에 따르면 AI 교정이 틀림 / 부분=일부만 맞음 / 둘다가능=자료에 따르면 뜻이나 문맥에 따라 원래 표현(wrong)도 맞을 수 있음 / 확인불가=자료 못 찾음
- verdict는 고친 표현(right)이 맞는지만 보고 정할 것. AI가 조항 번호를 잘못 골랐더라도 표현이 맞으면 "일치" (조항 선택 여부는 explain에 쓰지 말고 ruleId로만 바로잡을 것)
- 둘다가능이면 officialRight에 wrong을 그대로 적고, explain에 언제 붙이고 언제 띄는지 등 구분법을 쉬운 말로 쓸 것
- officialRight: 자료에 따른 올바른 표현 하나만 (슬래시·'또는'으로 여러 개를 적지 말 것, 교정된 글에 그대로 들어감). 원래 쓴 표현(wrong)이 맞다면 wrong을 그대로 적을 것
- AI가 고친 표현(right)이 맞으면 다른 맞는 표현이 더 있더라도 verdict는 "일치", officialRight는 right 그대로
- 자료는 끝까지 읽고 판단할 것 ('다만', '참고로', '허용' 뒤에 붙는 예외를 놓치지 말 것)
- sources의 url은 검색 결과에 실제로 나온 주소만 쓸 것 (지어내지 말 것). 검색을 안 했으면 빈 배열
- 모든 id에 대해 빠짐없이 답할 것`;

const SYSTEM_NIKL = `당신은 국립국어원 공식 자료로 맞춤법 교정 결과를 검증하는 담당자입니다.

판단 순서:
1) 각 항목에 붙은 [규정 원문]을 먼저 읽으세요. 국립국어원 한국어 어문 규범(korean.go.kr/kornorms)의 한글 맞춤법(2017년 고시)·표준어 규정 원문과 해설입니다.
   - 이 항목을 직접 설명하는 조항이면 ruleId에 그 번호(예: M42=한글 맞춤법 제42항, S17=표준어 규정 제17항)를, ruleQuote에 원문 문장을 글자 그대로 옮겨 적으세요.
   - 붙은 조항이 엉뚱하면 ruleId를 빈 문자열로 두세요. 붙지 않은 조항 번호를 지어내지 마세요.
2) 규정만으로 판단이 안 되는 것(낱말이 사전에 한 단어로 올라 있는지, 복수 표준어인지 등)은 web_search로 국립국어원 자료를 찾으세요.
   찾을 자료: 표준국어대사전(stdict.korean.go.kr), 우리말샘(opendict.korean.go.kr), 온라인가나다·묻고 답하기(korean.go.kr)
   검색어는 짧게. 예) "되요 돼요 온라인가나다". 항목당 검색은 0~2번, 규정으로 충분하면 검색하지 마세요.
규칙:
- 규정 원문이나 국립국어원 자료에서 직접 확인한 내용만 근거로 쓰세요. 둘 다 없으면 found=false, verdict="확인불가".
- 국립국어원 자료가 AI 교정과 다르면 반드시 국립국어원 자료를 따르세요.
- explain에는 해당 조항이 무엇을 말하는지 쉬운 말로 풀어 주세요.
${OUTPUT_FORMAT}`;

const SYSTEM_WEB = `당신은 맞춤법 교정 결과를 검증하는 담당자입니다.
아래 항목들은 국립국어원 자료에서 근거를 찾지 못한 것들입니다.
web_search 도구로 믿을 만한 자료(국어사전, 대학·연구기관의 국어 자료, 신문사 교열 기사 등)를 찾아 확인하세요.
항목당 검색은 1~2번이면 충분합니다.
규칙:
- 개인 블로그·커뮤니티 글만 있으면 확신하지 말고 그렇다고 설명하세요.
- 확인하지 못하면 found=false, verdict="확인불가".
- ruleId, ruleQuote는 빈 문자열로 두세요.
${OUTPUT_FORMAT}`;

async function callClaude(system, userMsg, allowedDomains, maxUses) {
  const tool = { type: 'web_search_20250305', name: 'web_search', max_uses: maxUses };
  if (allowedDomains) tool.allowed_domains = allowedDomains;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      system,
      tools: [tool],
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'API 오류');
  return data;
}

// 응답에서 JSON 꺼내기 + 검색 결과에 실제로 나온 주소 모으기
function parseResult(data) {
  const blocks = data.content || [];
  const seenUrls = new Set();
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) if (r.url) seenUrls.add(r.url);
    }
  }
  // 마지막 검색 결과 이후의 글만 사용 (중간 설명 글 제외)
  let lastTool = -1;
  blocks.forEach((b, i) => { if (b.type === 'web_search_tool_result') lastTool = i; });
  const text = blocks.slice(lastTool + 1).filter(b => b.type === 'text').map(b => b.text).join('');

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let raw = fenced ? fenced[1] : text;
  raw = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const parsed = JSON.parse(raw);
  return { items: parsed.items || [], seenUrls };
}

function hostOf(u) {
  try { return new URL(u).hostname; } catch { return ''; }
}

// 검색 결과에 없던 주소(지어낸 주소)는 버림
function cleanSources(sources, seenUrls, mustBeNikl) {
  const seenHosts = new Set([...seenUrls].map(hostOf));
  return (sources || []).filter(s => {
    const h = hostOf(s.url);
    if (!h) return false;
    if (mustBeNikl && !(h === NIKL_DOMAIN || h.endsWith('.' + NIKL_DOMAIN))) return false;
    return seenUrls.has(s.url) || seenHosts.has(h);
  }).slice(0, 3);
}

export async function POST(request) {
  try {
    if (isForeignOrigin(request)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const { stage, items } = await request.json();
    if (!Array.isArray(items) || items.length === 0) return Response.json({ items: [] });

    const list = items.slice(0, 10).map(it => ({
      id: it.id,
      wrong: String(it.wrong || '').slice(0, 100),
      right: String(it.right || '').slice(0, 100),
      context: String(it.context || '').slice(0, 300),
      rule: String(it.rule || '').slice(0, 50),
    }));
    const isNikl = stage !== 'web';
    const maxUses = Math.min(12, list.length * 2 + 1);

    let userMsg;
    if (isNikl) {
      userMsg = list.map(it => {
        const ctx = ruleContext(it);
        return `■ 항목 id=${it.id}\nwrong(원래 쓴 표현): ${it.wrong}\nright(AI가 고친 표현): ${it.right}\ncontext(원래 문장): ${it.context}\nAI가 든 근거 조항: ${it.rule || '(없음)'}\n[규정 원문]\n${ctx.length ? ctx.join('\n---\n') : '(관련 조항을 찾지 못함)'}`;
      }).join('\n\n');
    } else {
      userMsg = `검증할 교정 항목 (wrong=원래 쓴 표현, right=AI가 고친 표현, context=원래 문장):\n${JSON.stringify(list.map(({ rule, ...x }) => x), null, 1)}`;
    }

    const data = await callClaude(
      isNikl ? SYSTEM_NIKL : SYSTEM_WEB,
      userMsg,
      isNikl ? [NIKL_DOMAIN] : null,
      maxUses
    );
    const { items: out, seenUrls } = parseResult(data);

    const result = list.map(it => {
      const r = out.find(o => String(o.id) === String(it.id)) || {};
      const sources = cleanSources(r.sources, seenUrls, isNikl);
      // 조항 번호는 실제로 있는 것만, 인용문은 원문에 그대로 있을 때만 인정
      const ruleId = isNikl ? refToId(r.ruleId) : null;
      const rule = ruleId ? publicRule(getRule(ruleId)) : null;
      const ruleQuote = rule && quoteInRule(ruleId, r.ruleQuote) ? r.ruleQuote : '';
      const found = !!r.found && (sources.length > 0 || !!rule);
      // 고친 표현이 자료와 같으면 '일치'로 바로잡기 (조항만 달랐던 경우 등)
      // '가 / 나', '가 또는 나'처럼 여러 개를 적었으면 하나만 골라 교정된 글이 이상해지지 않게
      const same = (a, b) => String(a || '').replace(/\s/g, '') === String(b || '').replace(/\s/g, '');
      let official = String(r.officialRight || '').trim();
      let verdict = r.verdict || '일치';
      const alts = official.split(/\s*(?:\/|·|,|\s또는\s)\s*/).map(s => s.trim()).filter(Boolean);
      if (alts.length > 1) official = alts.find(a => same(a, it.right)) || alts.find(a => same(a, it.wrong)) || alts[0];
      if (verdict !== '둘다가능' && same(official, it.right)) { verdict = '일치'; official = it.right; }
      return {
        id: it.id,
        source: found ? (isNikl ? 'nikl' : 'web') : 'none',
        found,
        verdict: found ? verdict : '확인불가',
        officialRight: !found ? it.right : (verdict === '둘다가능' ? it.wrong : (official || it.right)),
        explain: r.explain || '',
        rule,
        ruleQuote,
        sources,
      };
    });

    return Response.json({ items: result });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
