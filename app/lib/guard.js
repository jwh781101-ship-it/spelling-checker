// 출처 검사와 인스턴스 메모리 내의 기본 요청 제한. 인증/계정별 비용 한도를 대체하지 않습니다.
export function isForeignOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try { return new URL(origin).host !== request.headers.get('host'); } catch { return true; }
}
const requests = new Map();
export function allowRequest(request, bucket, limit = 45, windowMs = 60_000) {
  const ip = request.headers.get('x-vercel-forwarded-for') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  const key = bucket + ':' + ip, now = Date.now();
  const previous = requests.get(key);
  const entry = previous && previous.until > now ? previous : {count:0,until:now+windowMs};
  entry.count++;requests.set(key,entry);
  if(requests.size > 500) for(const [k,v] of requests) if(v.until<now) requests.delete(k);
  return entry.count <= limit;
}