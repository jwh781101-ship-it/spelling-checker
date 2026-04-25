export async function POST(request) {
  try {
    const { word } = await request.json();
    if (!word) return Response.json({ error: '단어를 입력해 주세요.' }, { status: 400 });

    const apiKey = process.env.KOREAN_DICT_API_KEY;
    const url = `https://stdict.korean.go.kr/api/search.do?key=${apiKey}&q=${encodeURIComponent(word)}&type_search=search&part=word&num=5&pos=0&advanced=n&method=exact`;

    const res = await fetch(url);
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

    return Response.json({ items, raw: text });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
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
