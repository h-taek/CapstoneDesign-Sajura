// 탈퇴 직후 로그인 화면의 '탈퇴가 접수되었어요' 안내 (mockup v2 02_login '탈퇴 안내').
// 로그인 정보를 비우는 순간 설정 화면의 단계 가드가 상태 없이 /login으로 먼저 보내서,
// 이동 상태(location.state)로 넘기면 안내가 사라진다. 그래서 이동과 따로 표시를 남긴다.
let withdrawn = false;

export function markWithdrawn(): void {
  withdrawn = true;
}

export function hasWithdrawnNotice(): boolean {
  return withdrawn;
}

export function clearWithdrawnNotice(): void {
  withdrawn = false;
}
