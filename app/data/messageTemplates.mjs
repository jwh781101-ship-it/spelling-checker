// 직접 작성한 예문입니다. 실제 상황과 관계에 맞게 고쳐 쓰세요.
export const categories = [
  { id: 'wedding', label: '결혼 축하' },
  { id: 'birth', label: '출산 축하' },
  { id: 'birthday', label: '생일·생신' },
  { id: 'promotion', label: '승진·취임' },
  { id: 'opening', label: '개업·이전' },
  { id: 'condolence', label: '조문·위로' },
  { id: 'celebration-thanks', label: '축하 감사' },
  { id: 'condolence-thanks', label: '조문 감사' },
];

export const templates = [
  { id: 'wedding-short', categoryId: 'wedding', label: '짧게', body: '결혼을 진심으로 축하드립니다. 두 분의 앞날을 응원합니다.' },
  { id: 'wedding-formal', categoryId: 'wedding', label: '정중하게', body: '두 분의 결혼을 진심으로 축하드리며, 함께하실 앞날에 따뜻한 날들이 이어지기를 바랍니다.' },
  { id: 'wedding-warm', categoryId: 'wedding', label: '따뜻하게', body: '서로의 곁에서 함께 걸어갈 두 분을 응원해요. 결혼을 축하해요.' },
  { id: 'birth-short', categoryId: 'birth', label: '짧게', body: '소중한 아기의 탄생을 진심으로 축하드립니다.' },
  { id: 'birth-formal', categoryId: 'birth', label: '정중하게', body: '아기의 탄생을 진심으로 축하드리며, 가족 모두에게 평안한 날들이 함께하기를 바랍니다.' },
  { id: 'birth-warm', categoryId: 'birth', label: '따뜻하게', body: '새로운 가족을 맞이하신 것을 축하해요. 아기와 함께하는 하루하루를 응원합니다.' },
  { id: 'birthday-short', categoryId: 'birthday', label: '짧게', body: '생일을 진심으로 축하해요. 오늘을 따뜻하게 보내시길 바랍니다.' },
  { id: 'birthday-formal', categoryId: 'birthday', label: '생신을 정중하게', body: '생신을 진심으로 축하드립니다. 늘 평안하시기를 바랍니다.' },
  { id: 'birthday-warm', categoryId: 'birthday', label: '따뜻하게', body: '생일을 축하해요. 앞으로의 날들에도 웃을 일이 자주 찾아오길 바라요.' },
  { id: 'promotion-short', categoryId: 'promotion', label: '승진 축하', body: '승진을 진심으로 축하드립니다. 앞으로의 걸음을 응원합니다.', note: '승진 소식을 전할 때 사용하세요.' },
  { id: 'promotion-formal', categoryId: 'promotion', label: '취임 축하', body: '취임을 진심으로 축하드립니다. 새롭게 시작하시는 일들을 응원합니다.', note: '취임 소식을 전할 때 사용하세요.' },
  { id: 'promotion-warm', categoryId: 'promotion', label: '새 출발 응원', body: '새로운 자리에서의 시작을 축하드립니다. 앞으로의 여정을 응원하겠습니다.' },
  { id: 'opening-short', categoryId: 'opening', label: '개업 축하', body: '개업을 진심으로 축하드립니다. 새로운 시작을 응원합니다.', note: '개업한 경우에 사용하세요.' },
  { id: 'opening-move', categoryId: 'opening', label: '이전 축하', body: '새로운 곳으로의 이전을 축하드립니다. 앞으로도 뜻하시는 일이 순조롭기를 바랍니다.', note: '이전한 경우에 사용하세요.' },
  { id: 'opening-warm', categoryId: 'opening', label: '새 출발 응원', body: '새로운 공간에서 시작하실 일들을 진심으로 응원합니다.' },
  { id: 'condolence-neutral', categoryId: 'condolence', label: '중립적인 위로', body: '깊은 슬픔을 위로하며, 애도의 마음을 전합니다.' },
  { id: 'condolence-formal', categoryId: 'condolence', label: '정중하게', body: '삼가 고인의 명복을 빕니다. 유가족분들께 깊은 위로를 전합니다.', note: '상대의 종교나 신념에 맞는지 살펴보고, 맞지 않으면 중립적인 위로를 선택하세요.' },
  { id: 'condolence-warm', categoryId: 'condolence', label: '곁을 지키는 마음', body: '어떤 말로도 슬픔을 다 헤아릴 수 없겠지만, 깊은 위로의 마음을 전합니다.' },
  { id: 'celebration-thanks-short', categoryId: 'celebration-thanks', label: '짧게', body: '축하해 주셔서 진심으로 감사합니다. 보내주신 마음을 소중히 간직하겠습니다.' },
  { id: 'celebration-thanks-formal', categoryId: 'celebration-thanks', label: '정중하게', body: '따뜻한 축하를 보내주셔서 깊이 감사드립니다. 전해주신 마음을 오래 기억하겠습니다.' },
  { id: 'celebration-thanks-warm', categoryId: 'celebration-thanks', label: '따뜻하게', body: '축하하는 마음을 전해주셔서 고마워요. 덕분에 마음이 따뜻해졌어요.' },
  { id: 'condolence-thanks-short', categoryId: 'condolence-thanks', label: '짧게', body: '위로의 마음을 전해주셔서 진심으로 감사드립니다.' },
  { id: 'condolence-thanks-formal', categoryId: 'condolence-thanks', label: '정중하게', body: '슬픔을 함께해 주시고 따뜻한 위로를 전해주셔서 깊이 감사드립니다.' },
  { id: 'condolence-thanks-visit', categoryId: 'condolence-thanks', label: '조문 답례', body: '바쁘신 가운데 조문해 주시고 위로해 주셔서 진심으로 감사드립니다.', note: '직접 조문한 분께 전할 때 사용하세요.' },
];

export function filterTemplates(categoryId) {
  return categoryId ? templates.filter((item) => item.categoryId === categoryId) : templates;
}
