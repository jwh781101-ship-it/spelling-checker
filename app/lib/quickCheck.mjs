// 빠른 검사는 확신할 수 있는 독립 어절만 다룬다. 입력 문자열은 변경하지 않는다.
export const QUICK_RULES = Object.freeze([
  { wrong: "몇일", right: "며칠", reason: "날짜나 기간을 물을 때는 '며칠'로 적습니다." },
  { wrong: "오랫만", right: "오랜만", reason: "표준 표기는 '오랜만'입니다." },
  { wrong: "설겆이", right: "설거지", reason: "표준 표기는 '설거지'입니다." },
  { wrong: "역활", right: "역할", reason: "맡은 구실은 '역할'로 적습니다." },
  { wrong: "뵈요", right: "봬요", reason: "'뵈어요'의 준말은 '봬요'입니다." },
].map(Object.freeze));

// 유니코드 문자, 결합 부호, 숫자 및 밑줄은 단어의 일부로 취급한다.
const wordChar = /[\p{L}\p{M}\p{N}_]/u;
const previousCodePoint = (text, i) => {
  if (i <= 0) return "";
  const last = text.charCodeAt(i - 1);
  return last >= 0xDC00 && last <= 0xDFFF && i > 1
    ? text.slice(i - 2, i) : text[i - 1];
};
const nextCodePoint = (text, i) => i < text.length ? String.fromCodePoint(text.codePointAt(i)) : "";

// 날짜 질문에서만 확신할 수 있는 완결된 서술 연결형을 허용한다.
const dateEndings = ["인가요", "이에요", "입니까", "이냐", "이야", "인지", "인가"];
function isDateEnding(text, end) {
  return dateEndings.some((ending) => text.startsWith(ending, end) &&
    !wordChar.test(nextCodePoint(text, end + ending.length)));
}

// 보호 범위는 원문의 UTF-16 반열림 구간이다. 닫히지 않은 따옴표와 코드는 끝까지 보호한다.
// 고유명사는 일반 텍스트만으로 판별할 수 없어 URL, 이메일, @/# 식별자 등 명시적 형태만 보호한다.
export function protectedRanges(text) {
  if (typeof text !== 'string' || !text) return [];
  const ranges=[];
  const add=(start,end)=>ranges.push({start,end});
  for (const re of [/https?:\/\/[^\s<>"'“”‘’]+/giu, /www\.[^\s<>"'“”‘’]+/giu, /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu, /(?:^|(?<=[^\p{L}\p{M}\p{N}_]))[@#][\p{L}\p{M}\p{N}_]+/gu]) {
    for (const m of text.matchAll(re)) add(m.index,m.index+m[0].length);
  }
  const inside=i=>ranges.some(r=>i>=r.start&&i<r.end);
  const pairs={'“':'”','‘':'’','「':'」','『':'』','«':'»','‹':'›','"':'"',"'":"'"};
  for(let i=0;i<text.length;i++) {
    if(inside(i)) continue;
    const ch=text[i];
    if(ch===String.fromCharCode(96)) {
      let n=1; while(text[i+n]===ch) n++;
      const marker=ch.repeat(n); let end=text.indexOf(marker,i+n);
      end=end<0?text.length:end+n; add(i,end); i=end-1; continue;
    }
    const close=pairs[ch]; if(!close) continue;
    // 작은따옴표가 양쪽 영문 사이에 있을 때만 축약형으로 본다. 큰따옴표는 붙어 있어도 인용이다.
    if(ch==="'" && /[A-Za-z]/.test(previousCodePoint(text,i)) && /[A-Za-z]/.test(nextCodePoint(text,i+1))) continue;
    let j=i+1;
    while(j<text.length) {
      if(text[j]==='\\') {j+=2;continue;}
      if(text[j]===close && !((ch==="'" || ch==='‘') && /[A-Za-z]/.test(previousCodePoint(text,j)) && /[A-Za-z]/.test(nextCodePoint(text,j+1)))) break;
      j++;
    }
    const end=j<text.length?j+1:text.length; add(i,end); i=end-1;
  }
  return ranges.sort((a,b)=>a.start-b.start||a.end-b.end);
}
export function overlapsProtectedRange(ranges,start,end) {
  return Number.isInteger(start)&&Number.isInteger(end)&&ranges.some(r=>start<r.end&&r.start<end);
}
// 규칙별로 확실한 조사만 허용하며 접미사가 더 이어지면 제외한다.
const particles={
  '오랫만':['에'],
  '설겆이':['를','가','는','도','만','로','까지','부터','하고','와','랑'],
  '역활':['을','이','은','도','만','까지','부터','과','하고'],
};
function hasParticle(text,end,rule) {
  return (particles[rule.wrong]||[]).some(p=>text.startsWith(p,end)&&!wordChar.test(nextCodePoint(text,end+p.length)));
}
export function findQuickErrors(text) {
  if (typeof text !== 'string' || !text) return [];
  const errors=[],ranges=protectedRanges(text);
  for (const rule of QUICK_RULES) {
    let from=0;
    while(from<text.length) {
      const start=text.indexOf(rule.wrong,from); if(start<0) break;
      const end=start+rule.wrong.length; from=end;
      if(overlapsProtectedRange(ranges,start,end)) continue;
      if(wordChar.test(previousCodePoint(text,start))) continue;
      if(wordChar.test(nextCodePoint(text,end)) && !(rule.wrong==='몇일' && isDateEnding(text,end)) && !hasParticle(text,end,rule)) continue;
      if(rule.wrong==='몇일' && /\d(?:\s*일)?\s*$/u.test(text.slice(0,start))) continue;
      errors.push({wrong:rule.wrong,right:rule.right,start,end,reason:rule.reason});
    }
  }
  return errors.sort((a,b)=>a.start-b.start||a.end-b.end);
}
