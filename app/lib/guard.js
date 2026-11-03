// 다른 사이트에서 이 앱의 API를 끌어다 쓰지 못하게 막는 간단한 확인
export function isForeignOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false; // 같은 사이트의 일반 요청은 origin이 없을 수도 있음
  try {
    return new URL(origin).host !== request.headers.get('host');
  } catch {
    return true;
  }
}
