// 로그인 뒤 돌아갈 주소 — 로그인 전에 앱 화면(알림이 연 /inventory 등)으로 들어와 로그인 화면으로 보내졌으면,
// 로그인(이메일·소셜 모두 끝나면 '/'에 도착한다)을 마친 뒤 홈 대신 그 화면으로 보낸다. 이 탭에만 둔다.
const KEY = "sajura:login-return";

export function rememberLoginReturn(path: string): void {
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    // 저장소를 못 쓰면 지금처럼 홈으로 간다
  }
}

export function peekLoginReturn(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearLoginReturn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
