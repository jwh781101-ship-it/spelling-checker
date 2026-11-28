import { isForeignOrigin, allowRequest } from '../../lib/guard';
// Content-Length만 신뢰하지 않고 실제 수신 바이트를 제한합니다.
async function readBoundedJSON(request, maxBytes = 65536) {
  const length = request.headers.get('content-length');
  if (length && /^\d+$/.test(length) && Number(length) > maxBytes) return {error:'요청 본문이 너무 큽니다.',status:413};
  if (!request.body) return {error:'요청 본문을 확인해 주세요.',status:400};
  const reader = request.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) { const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>maxBytes) { reader.cancel().catch(()=>{}); return {error:'요청 본문이 너무 큽니다.',status:413}; } chunks.push(value); }
    const bytes=new Uint8Array(size); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('invalid');
    return {value};
  } catch { return {error:'올바른 JSON 요청을 보내 주세요.',status:400}; }
}
export async function POST(request) {
  try {
    if(isForeignOrigin(request))return Response.json({error:'허용되지 않은 요청입니다.'},{status:403});
    const body=await readBoundedJSON(request); if(body.error)return Response.json({error:body.error},{status:body.status});
    const { word } = body.value;
    if (typeof word !== 'string' || !word.trim() || word.length > 50) return Response.json({ error: '단어를 입력해 주세요.' }, { status: 400 });

    const apiKey = process.env.KOREAN_DICT_API_KEY;
    if (!apiKey) return Response.json({ items: [], configured: false, message: '공식 사전 API가 연결되지 않았습니다. 사전 링크에서 직접 확인해 주세요.' }, { status: 503 });
    if(!allowRequest(request,'dict'))return Response.json({error:'사전 요청이 많습니다. 잠시 후 다시 시도해 주세요.'},{status:429});
    const url = `https://stdict.korean.go.kr/api/search.do?key=${apiKey}&q=${encodeURIComponent(word)}&type_search=search&part=word&num=5&method=exact`;

    const res = await fetch(url, {signal: AbortSignal.timeout(15000)});
    if(!res.ok)return Response.json({error:'사전 서비스가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:502});
    const text = await res.text();

    // XML 파싱
    const items = [];
    const itemMatches = text.match(/<item>([\s\S]*?)<\/item>/g) || [];

    for (const item of itemMatches) {
      const word = (item.match(/<word>([^<]*)<\/word>/) || [])[1] || '';
      const pos = (item.match(/<pos_code>([^<]*)<\/pos_code>/) || [])[1] || '';
      const hanja = (item.match(/<origin>([^<]*)<\/origin>/) || [])[1] || '';
      const senseMatches = item.match(/<sense>([\s\S]*?)<\/sense>/g) || [];

      const senses = senseMatches.map(s => {
        const definition = (s.match(/<definition>([^<]*)<\/definition>/) || [])[1] || '';
        const example = (s.match(/<example>([^<]*)<\/example>/) || [])[1] || '';
        return { definition, example };
      });

      if (word && senses.length > 0) {
        items.push({ word, pos: posCodeToName(pos), hanja, senses });
      }
    }

    return Response.json({ items, configured: true });
  } catch {
    return Response.json({ error: '사전 조회를 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }
}

function posCodeToName(code) {
  const map = {
    '1': '명사', '2': '대명사', '3': '수사', '4': '조사',
    '5': '동사', '6': '형용사', '7': '관형사', '8': '부사',
    '9': '감탄사', '10': '접사', '11': '어근', '12': '의존 명사',
    '13': '보조 동사', '14': '보조 형용사', '27': '품사 없음'
  };
  return map[code] || '단어';
}
