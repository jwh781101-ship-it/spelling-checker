// 공유 대상과 실제 전송은 운영체제 공유창 및 선택한 앱에서 사용자가 정합니다.
export async function shareOccasionText(text, platform = {}) {
  if (typeof text !== 'string' || !text.trim()) return {status:'empty',message:'보낼 문구를 먼저 입력해 주세요.'};
  const payload = {text};
  let supported = typeof platform?.share === 'function';
  if (supported && typeof platform.canShare === 'function') {
    try { supported = platform.canShare(payload); }
    catch { return {status:'error',message:'공유 가능 여부를 확인하지 못했습니다. 문구 복사 버튼을 이용해 주세요.'}; }
  }
  if (supported) {
    try {
      await platform.share(payload);
      return {status:'shared',message:'공유창에 문구를 전달했습니다. 선택한 앱에서 받는 사람과 내용을 확인한 뒤 전송해 주세요.'};
    } catch (error) {
      if (error?.name === 'AbortError') return {status:'cancelled',message:'공유를 취소했습니다. 문구는 그대로 유지됩니다.'};
      // 권한 거부·공유 오류를 우회하여 자동 복사하거나 전송하지 않습니다.
      return {status:'error',message:'공유창을 열지 못했습니다. 문구 복사 버튼으로 복사한 뒤 카카오톡이나 문자 앱에 붙여넣어 주세요.'};
    }
  }
  try {
    if (typeof platform?.clipboard?.writeText !== 'function') return {status:'unsupported',message:'이 환경에서는 공유창을 지원하지 않습니다. 편집창의 문구를 직접 선택해 복사한 뒤 보내 주세요.'};
    await platform.clipboard.writeText(text);
    return {status:'copied',message:'공유창을 지원하지 않아 문구를 복사했습니다. 카카오톡이나 문자 앱에 붙여넣어 보내 주세요.'};
  } catch {
    return {status:'error',message:'공유창과 자동 복사를 사용할 수 없습니다. 편집창의 문구를 직접 선택해 복사한 뒤 보내 주세요.'};
  }
}
