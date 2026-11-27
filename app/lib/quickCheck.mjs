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

export function findQuickErrors(text) {
  if (typeof text !== "string" || !text) return [];
  const errors = [];
  for (const rule of QUICK_RULES) {
    let from = 0;
    while (from < text.length) {
      const start = text.indexOf(rule.wrong, from);
      if (start < 0) break;
      const end = start + rule.wrong.length;
      from = end;
      if (wordChar.test(previousCodePoint(text, start))) continue;
      if (wordChar.test(nextCodePoint(text, end)) &&
          !(rule.wrong === "몇일" && isDateEnding(text, end))) continue;
      // 숫자에 이어지는 일자 표기는 자동 교정하지 않는다.
      if (rule.wrong === "몇일" && /\d(?:\s*일)?\s*$/u.test(text.slice(0, start))) continue;
      errors.push({ wrong: rule.wrong, right: rule.right, start, end, reason: rule.reason });
    }
  }
  return errors.sort((a, b) => a.start - b.start || a.end - b.end);
}
