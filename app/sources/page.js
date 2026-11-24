import { knowledgeSummary } from '../lib/kornorms';
export const metadata={title:'자료와 검증 방식 | 바른 글씨'};
export default function SourcesPage(){
  const s=knowledgeSummary();
  const rows=[['한글 맞춤법',s.counts.M],['표준어 사정 원칙',s.counts.S],['표준 발음법',s.counts.V],['문장 부호',s.counts.P],['외래어 표기법의 조항·표',s.counts.F],['로마자 표기법',s.counts.R]];
  return <main style={{maxWidth:760,margin:'0 auto',padding:'32px 22px 70px',lineHeight:1.85,color:'#263746',background:'#fff'}}>
    <a href="/" style={{color:'#286d5b'}}>맞춤법 검사로 돌아가기</a>
    <h1 style={{fontSize:'1.8rem',marginTop:22}}>자료와 검증 방식</h1>
    <p>국립국어원의 공개 규범을 문맥에 맞게 찾아 참고합니다. 맞는 표현을 다른 맞는 표현으로 바꾸지 않는 것을 우선합니다.</p>
    <section style={{background:'#eef7f2',padding:22,borderRadius:16,margin:'24px 0'}}>
      <h2 style={{marginTop:0,fontSize:'1.3rem'}}>공식 규범 {s.rules}개 단위 · 선별 용례 {s.cases}개</h2>
      <p>자료 확인일: {s.fetchedAt} · 자료 버전 {s.version}</p>
      <ul>{rows.map(([name,count])=><li key={name}>{name}: {count}개</li>)}</ul>
      <p style={{fontSize:'.92rem'}}>조항·표·문장 부호 항목을 합한 검색 단위 수입니다. 별개의 맞춤법 오류 {s.rules}가지를 모두 검증했다는 뜻은 아닙니다.</p>
    </section>
    <h2>어떻게 확인하나요?</h2>
    <ol>
      <li>문장과 앞뒤 문맥에 관련된 규범 본문·해설·용례를 찾아 AI가 교정 후보를 제안합니다.</li>
      <li>실제 규범의 인용문이나 출처를 다시 대조하고, 허용 표기와 예외를 확인합니다. 필요한 경우 국립국어원 자료를 추가 검색합니다.</li>
      <li>공식 근거를 확인한 교정만 원문의 해당 위치에 반영합니다. 모호하거나 확인하지 못한 제안은 원문을 유지하며 사용자가 따로 선택할 수 있습니다.</li>
    </ol>
    <h2>알아 두실 점</h2>
    <ul>
      <li>인터넷 전체나 사전 전체를 내려받아 학습한 것이 아닙니다. 입력에 관련된 일부 자료를 찾아 참고하는 방식입니다.</li>
      <li>자료 검색·적용 판단에도 AI가 관여하므로 오류나 누락이 있을 수 있습니다. 100% 정확도나 국립국어원의 감수를 뜻하지 않습니다.</li>
      <li>표준국어대사전 API의 실시간 전수 조회가 아닙니다. 사전 뜻풀이 화면의 AI 설명은 공식 사전 원문과 구분해 확인하세요.</li>
      <li>표준 발음법은 표기와 발음을 혼동하지 않기 위한 참고 자료입니다. 고유명사, 전문 용어, 방언, 직접 인용문은 특히 신중하게 살펴야 합니다.</li>
      <li>규범의 문단·표를 검색용 텍스트로 정리했으며, 모델에는 관련 부분이 발췌되어 전달될 수 있습니다. 조항 번호만 있다는 이유로 정확한 적용이 보장되지는 않습니다.</li>
      <li>일반 웹 자료만 확인한 제안은 참고용입니다. 중요한 문서는 원문과 공식 자료를 직접 다시 확인하세요.</li>
    </ul>
    <h2>출처와 이용 안내</h2>
    <p>{s.attribution}</p>
    <ul>{s.sourceUrls.map((u,i)=><li key={u}><a href={u} target="_blank" rel="noopener noreferrer">국립국어원 {['한글 맞춤법·문장 부호','표준어 규정·표준 발음법','외래어 표기법','국어의 로마자 표기법'][i]}</a></li>)}</ul>
    <p>용례 카드는 국립국어원의 규범·상담·표준어 추가 자료를 확인해 앱에서 짧게 정리한 설명입니다. 타인이 작성한 질문이나 출전이 있는 사전 예문을 일괄 복제한 자료가 아닙니다.</p>
    <p><a href={s.copyrightPolicy} target="_blank" rel="noopener noreferrer">국립국어원 저작권 정책</a>에 따라 출처를 표시하며, 별도 조건이 있는 자료는 해당 조건을 우선합니다. 국립국어원이 이 앱을 후원·보증한다는 의미가 아닙니다.</p>
    <p><a href="/privacy">개인정보처리방침</a></p>
  </main>;
}