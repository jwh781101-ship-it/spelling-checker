export const funeralTerms = [
  {word:'빙부상',hanja:'聘父喪',meaning:'장인어른이 돌아가셨을 때 쓰는 말'},
  {word:'빙모상',hanja:'聘母喪',meaning:'장모님이 돌아가셨을 때 쓰는 말'},
];

export function getFuneralDictionaryEntry(text) {
  if (typeof text !== 'string') return null;
  const term = funeralTerms.find(item => item.word === text.trim().normalize('NFC'));
  if (!term) return null;
  return {
    word:term.word, hanja:term.hanja,
    meanings:[{pos:'명사',definition:term.meaning,example:''}],
    synonyms:[], antonyms:[],
    note:'앱에 저장된 쉬운 풀이입니다. 정확한 뜻과 용례는 아래 표준국어대사전에서 확인해 주세요.',
  };
}
