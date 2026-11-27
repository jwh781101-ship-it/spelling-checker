// wrong이 빈 문자열인 항목은 제시된 두 표현이 모두 바른 경우입니다.
export const confusables = [
  {
    id: 'myeochil', label: '며칠 / 몇일 / 몇 일', correct: '며칠', wrong: '몇일 / 몇 일',
    explanation: '날짜나 기간을 물을 때는 모두 며칠로 적습니다.',
    example: '다음 수업은 며칠 뒤에 열리나요?', aliases: ['며칠', '몇일', '몇 일'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id&pageIndex=1&qna_seq=328160'
  },
  {
    id: 'seolgeoji', label: '설거지 / 설겆이', correct: '설거지', wrong: '설겆이',
    explanation: '그릇을 씻어 정리하는 일을 나타내는 명사는 설거지입니다.',
    example: '저녁을 먹고 내가 설거지를 맡았다.', aliases: ['설거지', '설겆이'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=5697'
  },
  {
    id: 'yeokhal', label: '역할 / 역활', correct: '역할', wrong: '역활',
    explanation: '맡은 임무나 직책을 뜻하는 말은 역할입니다.',
    example: '각자 맡은 역할을 차분히 살펴보자.', aliases: ['역할', '역활'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=9248'
  },
  {
    id: 'doe-dwae', label: '되 / 돼', correct: '되 / 돼', wrong: '',
    explanation: '두 표현 모두 맞습니다. 어간 되-에 어가 결합해 줄면 돼가 되고, 되고·되면처럼 줄지 않는 형태도 있습니다.',
    example: '준비가 되면 출발해도 돼.', aliases: ['되', '돼', '되어', '되다'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=73&pageIndex=1&qna_seq=322400'
  },
  {
    id: 'de-dae', label: '-데 / -대', correct: '-데 / -대', wrong: '',
    explanation: '두 표현 모두 맞습니다. 직접 경험한 사실을 전할 때는 -데, 남에게 들은 내용을 간접적으로 전할 때는 -대를 씁니다.',
    example: '내가 가 본 공원은 조용하데. 친구는 내일 비가 온대.', aliases: ['데', '대', '-데', '-대'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=73&pageIndex=1&qna_seq=322400'
  },
  {
    id: 'an-anh', label: '안 / 않', correct: '안 / 않', wrong: '',
    explanation: '두 표현 모두 맞습니다. 서술어 앞에서 부정할 때는 안을, 뒤에서 -지 않다로 부정할 때는 않을 씁니다.',
    example: '나는 커피를 안 마시고 동생도 마시지 않는다.', aliases: ['안', '않', '않다', '안 먹다'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=73&pageIndex=1&qna_seq=322400'
  },
  {
    id: 'an-doeda', label: '안 되다 / 안되다', correct: '안 되다 / 안되다', wrong: '',
    explanation: '두 표현 모두 맞습니다. 단순한 부정은 안 되다로 띄고, 일이 잘 이루어지지 않거나 가엾어 마음이 언짢다는 뜻의 한 단어는 안되다로 붙입니다.',
    example: '지금은 출발하면 안 된다. 비가 오니 장사가 안된다.', aliases: ['안 되다', '안되다', '안 돼', '안돼'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=73&pageIndex=1&qna_seq=322400'
  },
  {
    id: 'waenji', label: '왠지 / 웬지', correct: '왠지', wrong: '웬지',
    explanation: '이유를 뚜렷이 알 수 없다는 뜻에는 왜인지가 줄어든 왠지를 씁니다.',
    example: '오늘은 왠지 산책하고 싶다.', aliases: ['왠지', '웬지', '왜인지'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200203/44_12.html'
  },
  {
    id: 'wen', label: '웬 / 왠', correct: '웬', wrong: '왠',
    explanation: '어찌 된 또는 어떠한의 뜻으로 명사를 꾸밀 때는 웬을 씁니다. 왜인지가 줄어든 왠지는 별도 표현입니다.',
    example: '현관 앞에 웬 상자가 놓여 있다.', aliases: ['웬', '왠', '웬일', '왠일'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200203/44_12.html'
  },
  {
    id: 'bwaeyo', label: '봬요 / 뵈요', correct: '봬요', wrong: '뵈요',
    explanation: '뵈어요가 줄어든 형태는 봬요입니다.',
    example: '내일 도서관 앞에서 봬요.', aliases: ['봬요', '뵈요', '뵈어요'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=8554'
  },
  {
    id: 'natda-natda', label: '낫다 / 낳다', correct: '낫다 / 낳다', wrong: '',
    explanation: '두 표현 모두 맞습니다. 낫다는 병이 회복되거나 더 좋다는 뜻이고, 낳다는 아이를 출산하거나 결과를 가져온다는 뜻입니다.',
    example: '감기가 낫고 나서 함께 심은 씨앗이 좋은 결실을 낳았다.', aliases: ['낫다', '낳다', '나았다', '낳았다'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=306897'
  },
  {
    id: 'neomeo', label: '넘어 / 너머', correct: '넘어 / 너머', wrong: '',
    explanation: '두 표현 모두 맞습니다. 넘어는 넘다의 활용형이고, 너머는 경계로 가로막힌 곳의 저쪽을 뜻하는 명사입니다.',
    example: '언덕을 넘어 언덕 너머 마을로 갔다.', aliases: ['넘어', '너머', '넘다'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=306897'
  },
  {
    id: 'eotteoke', label: '어떻게 / 어떡해', correct: '어떻게 / 어떡해', wrong: '',
    explanation: '두 표현 모두 맞습니다. 어떻게는 어떻다의 활용형이고, 어떡해는 어떡하다의 활용형입니다.',
    example: '이 문제를 어떻게 풀지? 시간이 없으니 어떡해?', aliases: ['어떻게', '어떡해', '어떡하다'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id=216&pageIndex=1&qna_seq=306897'
  },
  {
    id: 'gyeolje', label: '결제 / 결재', correct: '결제 / 결재', wrong: '',
    explanation: '두 표현 모두 맞습니다. 대금을 주고받아 거래를 마치는 것은 결제, 권한자가 안건을 검토해 승인하는 것은 결재입니다.',
    example: '물품 대금은 카드로 결제하고 구매 계획서는 팀장의 결재를 받았다.', aliases: ['결제', '결재'],
    sourceName: '국립국어원 온라인 소식지 2023년 5월 호', sourceUrl: 'https://www.korean.go.kr/nkview/news_pdf/2023_5%282%29.pdf'
  },
  {
    id: 'roseo-rosseo', label: '로서 / 로써', correct: '로서 / 로써', wrong: '',
    explanation: '두 표현 모두 맞습니다. 지위나 자격을 나타낼 때는 로서, 수단이나 도구를 나타낼 때는 로써를 씁니다.',
    example: '대표로서 의견을 전하고 자료로써 근거를 보탰다.', aliases: ['로서', '로써', '으로서', '으로써'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=5568'
  },
  {
    id: 'halgeyo', label: '할게요 / 할께요', correct: '할게요', wrong: '할께요',
    explanation: '어미 -ㄹ게는 된소리로 발음하더라도 예사소리로 적습니다.',
    example: '제가 창문을 닫을게요. 정리는 함께 할게요.', aliases: ['할게요', '할께요', 'ㄹ게'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id&pageIndex=1&qna_seq=314870'
  },
  {
    id: 'yeppeuda', label: '예쁘다 / 이쁘다', correct: '예쁘다 / 이쁘다', wrong: '',
    explanation: '예쁘다와 이쁘다는 같은 뜻의 복수 표준어입니다.',
    example: '화분의 꽃이 예쁘다. 새로 핀 꽃도 이쁘다.', aliases: ['예쁘다', '이쁘다', '예뻐', '이뻐'],
    sourceName: '국립국어원 2015년 표준어 추가 보도자료', sourceUrl: 'https://www.korean.go.kr/front/board/boardStandardView.do?b_seq=576&board_id=6&mn_id=19'
  },
  {
    id: 'chaljida', label: '차지다 / 찰지다', correct: '차지다 / 찰지다', wrong: '',
    explanation: '차지다와 찰지다는 복수 표준어입니다.',
    example: '오늘 지은 밥은 차지고 찰지다.', aliases: ['차지다', '찰지다', '차진', '찰진'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://www.korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=6278&mn_id=217'
  },
  {
    id: 'pureureuda', label: '푸르다 / 푸르르다', correct: '푸르다 / 푸르르다', wrong: '',
    explanation: '두 표현 모두 표준어입니다. 푸르르다는 푸르다와 쓰임이 다른 별도의 표준어이므로 무조건 바꾸지 않습니다.',
    example: '멀리 보이는 바다는 푸르고 산은 푸르르다.', aliases: ['푸르다', '푸르르다', '푸른', '푸르른'],
    sourceName: '국립국어원 2015년 표준어 추가 보도자료', sourceUrl: 'https://www.korean.go.kr/front/board/boardStandardView.do?b_seq=576&board_id=6&mn_id=19'
  },
  {
    id: 'ipsae', label: '잎새 / 잎사귀', correct: '잎새 / 잎사귀', wrong: '',
    explanation: '두 표현 모두 표준어입니다. 잎새는 나무의 잎사귀를 가리키며 주로 문학적 표현에 쓰입니다.',
    example: '나뭇가지에 새 잎새가 돋고 넓은 잎사귀가 흔들린다.', aliases: ['잎새', '잎사귀'],
    sourceName: '국립국어원 2015년 표준어 추가 보도자료', sourceUrl: 'https://www.korean.go.kr/front/board/boardStandardView.do?b_seq=576&board_id=6&mn_id=19'
  },
  {
    id: 'jajangmyeon', label: '자장면 / 짜장면', correct: '자장면 / 짜장면', wrong: '',
    explanation: '자장면과 짜장면은 모두 표준 표기로 인정됩니다.',
    example: '나는 자장면을 주문했고 친구는 짜장면을 골랐다.', aliases: ['자장면', '짜장면'],
    sourceName: '국립국어원 온라인가나다', sourceUrl: 'https://www.korean.go.kr/front/onlineQna/onlineQnaView.do?mn_id&pageIndex=1&qna_seq=332092'
  },
  {
    id: 'bandeusi', label: '반드시 / 반듯이', correct: '반드시 / 반듯이', wrong: '',
    explanation: '두 표현 모두 맞습니다. 반드시에는 꼭이라는 뜻이 있고, 반듯이는 비뚤어지지 않고 바른 모양을 나타냅니다.',
    example: '신청서를 반드시 제출하고 책은 반듯이 꽂아 주세요.', aliases: ['반드시', '반듯이', '반듯하다'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200512/89_3.html'
  },
  {
    id: 'jigeusi', label: '지긋이 / 지그시', correct: '지긋이 / 지그시', wrong: '',
    explanation: '두 표현 모두 맞습니다. 나이가 비교적 많은 모습은 지긋이, 힘을 살짝 주거나 조용히 응시하는 모습은 지그시로 씁니다.',
    example: '나이가 지긋이 든 손님이 창밖을 지그시 바라보았다.', aliases: ['지긋이', '지그시', '지긋하다'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200512/89_3.html'
  },
  {
    id: 'nungop', label: '눈곱 / 눈꼽', correct: '눈곱', wrong: '눈꼽',
    explanation: '눈에 끼는 분비물을 뜻할 때는 눈곱으로 적습니다.',
    example: '아침에 세수하며 눈곱을 닦았다.', aliases: ['눈곱', '눈꼽'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200512/89_3.html'
  },
  {
    id: 'nunsal', label: '눈살 / 눈쌀', correct: '눈살', wrong: '눈쌀',
    explanation: '두 눈썹 사이의 살을 나타내는 말은 눈살로 적습니다.',
    example: '눈부신 햇살에 아이가 눈살을 찌푸렸다.', aliases: ['눈살', '눈쌀'],
    sourceName: '국립국어원 새국어소식', sourceUrl: 'https://www.korean.go.kr/nkview/nknews/200512/89_3.html'
  },
  {
    id: 'geumse', label: '금세 / 금새', correct: '금세', wrong: '금새 (금세 뜻으로 쓸 때)',
    explanation: '지금 바로라는 뜻의 부사는 금시에가 줄어든 금세로 적습니다. 다른 뜻의 명사 금새와는 구별합니다.',
    example: '구름이 걷히자 하늘이 금세 밝아졌다.', aliases: ['금세', '금새', '금시에'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=5901'
  },
  {
    id: 'oraenman', label: '오랜만 / 오랫만', correct: '오랜만', wrong: '오랫만',
    explanation: '오래간만의 준말은 오랜만입니다.',
    example: '우리는 오랜만에 함께 산책했다.', aliases: ['오랜만', '오랫만', '오래간만'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=6119'
  },
  {
    id: 'oraetdongan', label: '오랫동안 / 오랜동안', correct: '오랫동안', wrong: '오랜동안',
    explanation: '오래와 동안이 결합한 말은 사이시옷을 넣어 오랫동안으로 적습니다.',
    example: '할머니는 이 정원을 오랫동안 돌보셨다.', aliases: ['오랫동안', '오랜동안'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=6119'
  },
  {
    id: 'buchida', label: '붙이다 / 부치다', correct: '붙이다 / 부치다', wrong: '',
    explanation: '두 표현 모두 맞습니다. 우표 등을 붙게 할 때는 붙이다, 편지를 보내거나 안건을 회의에 넘길 때는 부치다를 씁니다.',
    example: '봉투에 우표를 붙이고 편지를 부쳤다.', aliases: ['붙이다', '부치다', '붙여', '부쳐'],
    sourceName: '국립국어원 상담 사례', sourceUrl: 'https://korean.go.kr/front/mcfaq/mcfaqView.do?mcfaq_seq=9083'
  }
];
