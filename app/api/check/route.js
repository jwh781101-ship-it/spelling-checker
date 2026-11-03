// 맞춤법 검사 / 사전 찾기
// 프롬프트·모델·토큰 수는 서버에서 정함 → 다른 사람이 이 주소로 API 키를 마음대로 쓰지 못함
import { SYSTEM_CHECK, SYSTEM_DICT } from '../../lib/prompts';
import { isForeignOrigin } from '../../lib/guard';

export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-6';
const MODES = {
  check: { system: SYSTEM_CHECK, maxTokens: 4000, maxChars: 1200, prefix: '다음 글을 검사해주세요:\n\n' },
  dict:  { system: SYSTEM_DICT,  maxTokens: 1500, maxChars: 50,   prefix: '다음 단어를 찾아주세요: ' },
};

export async function POST(request) {
  try {
    if (isForeignOrigin(request)) return Response.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
    const { mode, text } = await request.json();
    const m = MODES[mode];
    const t = String(text || '').trim();
    if (!m || !t) return Response.json({ error: '잘못된 요청입니다.' }, { status: 400 });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: m.maxTokens,
        system: m.system,
        messages: [{ role: 'user', content: m.prefix + t.slice(0, m.maxChars) }],
      }),
    });

    const data = await response.json();
    if (data.error) return Response.json({ error: data.error.message || 'AI 응답 오류' }, { status: 502 });
    const out = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return Response.json({ text: out, stop: data.stop_reason });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
