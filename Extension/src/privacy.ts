// 개인정보 가리기 (04_fe.md §12.4). 요소는 남기고 값만 --- 로 바꾼다.
// 이름은 위치로(머리말의 이름 표시·'마이쿠팡' 링크 설명 글), 전화번호·이메일·주소는 모양으로 찾는다.

export const MASK = "---";

const PHONE = /(?<!\d)(?:0\d{1,2}|1\d{3})[-.\s)]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 도로명(…로·…길 + 번호)과 행정구역(…시·도·군·구)이 함께 있으면 주소로 본다
const ROAD = /[가-힣\d]+(?:로|길)\s?\d+(?:-\d+)?/;
const REGION = /[가-힣]+(?:시|도|군|구)(?:\s|$)/;

/** 화면 어디서든 전화번호·이메일·주소 모양을 가린다. */
export function maskShapes(text: string): string {
  if (ROAD.test(text) && REGION.test(text)) return MASK;
  return text.replace(EMAIL, MASK).replace(PHONE, MASK);
}

/** '마이쿠팡' 링크의 설명 글('<이름>님 마이쿠팡 바로가기')인가. */
export function isMyCoupangLabel(text: string): boolean {
  return /님\s*마이쿠팡/.test(text);
}

/**
 * 머리말의 이름 표시가 있는 곳 — 로그인 상태의 '로그아웃' 링크가 든 머리말 목록.
 * 그 안에서 '님'으로 끝나는 글자와, '님'만 따로 떨어진 경우 바로 앞 글자를 이름 표시로 본다.
 */
export function headerNameZone(doc: Document): Element | null {
  const logout = doc.querySelector('a[href*="logout"]');
  if (!logout) return null;
  return logout.closest("ul") ?? logout.parentElement?.parentElement ?? null;
}
