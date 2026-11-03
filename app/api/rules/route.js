// AI가 근거로 든 조항 번호 → 어문 규범 원문 (AI 호출 없음, 즉시 응답)
import { refToId, getRule, publicRule } from '../../lib/kornorms';

export async function POST(request) {
  try {
    const { refs } = await request.json();
    const list = (Array.isArray(refs) ? refs : []).slice(0, 20);
    const rules = list.map(ref => publicRule(getRule(refToId(ref))));
    return Response.json({ rules });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
