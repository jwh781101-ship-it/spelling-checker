export const MAX_INPUT_LENGTH = 2000;
// 기존 글을 자르거나 암묵적으로 덮어쓰지 않도록 삽입 결과를 먼저 계산합니다.
export function insertTemplate(existing, template, method = 'replace', limit = MAX_INPUT_LENGTH) {
  if (typeof existing !== 'string' || typeof template !== 'string' || !template.trim()) {
    return {ok:false,error:'넣을 문구를 먼저 선택해 주세요.'};
  }
  if (!['replace','append'].includes(method)) return {ok:false,error:'문구를 넣는 방법을 확인해 주세요.'};
  const text = method === 'append' && existing.length ? existing + '\n\n' + template : template;
  if (text.length > limit) return {ok:false,error:'합친 글이 '+limit+'자를 넘습니다. 글을 줄이거나 기존 글 바꾸기를 선택해 주세요.'};
  return {ok:true,text};
}
