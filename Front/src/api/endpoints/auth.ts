// 인증 API — api_spec.md §2·§3.
import { HTTPError } from "ky";
import { api } from "../../lib/api";
import type { AuthUser, BusinessStatus } from "../../stores/auth-store";

interface RefreshResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

interface LoginResponse extends RefreshResponse {
  business_status: BusinessStatus | null;
  onboarding_completed: boolean | null;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

interface RegisterResponse {
  user_id: string;
  email: string;
  name: string;
}

/** BE 에러 envelope({ error, message }) → 사용자 메시지. 파싱 불가 시 fallback. */
export async function authErrorMessage(error: unknown, fallback: string): Promise<string> {
  if (error instanceof HTTPError) {
    try {
      const body = (await error.response.json()) as { message?: string };
      if (body?.message) return body.message;
    } catch {
      // 본문 파싱 불가 시 fallback
    }
  }
  return fallback;
}

export async function register(payload: RegisterPayload): Promise<RegisterResponse> {
  return api.post("auth/register", { json: payload }).json<RegisterResponse>();
}

export async function loginWithEmail(email: string, password: string): Promise<LoginResponse> {
  return api.post("auth/login", { json: { email, password } }).json<LoginResponse>();
}

// 동일 탭 내 동시 호출(StrictMode 이중 effect·HMR·라우트 가드 동시 진입)이
// 같은 in-flight Promise를 공유하도록 한다. BE refresh가 SELECT FOR UPDATE로
// 옛 토큰을 즉시 revoke 처리하기 때문에, FE에서 동시 2회가 떠나면 두 번째가
// "이미 revoke됨" 401을 받으면서 OAuth 직후 진입이 막혀 더블클릭처럼 보이는
// 회귀(34차 픽스 이후 cd7c02f race fix로 재발)를 막는다.
let inflightRefresh: Promise<RefreshResponse | null> | null = null;

export async function refreshAccessToken(): Promise<RefreshResponse | null> {
  if (inflightRefresh) return inflightRefresh;
  inflightRefresh = (async () => {
    try {
      return await api.post("auth/refresh").json<RefreshResponse>();
    } catch {
      return null;
    } finally {
      inflightRefresh = null;
    }
  })();
  return inflightRefresh;
}

export async function fetchMe(): Promise<AuthUser> {
  return api.get("auth/me").json<AuthUser>();
}

export interface UpdateMePayload {
  name?: string;
  store_name?: string;
}

export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  return api.patch("auth/me", { json: payload }).json<AuthUser>();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch("auth/password", {
    json: { current_password: currentPassword, new_password: newPassword },
  });
}

interface VerifyBusinessResponse {
  business_status: BusinessStatus;
  business_no: string | null;
}

/** 사업자 검증 (multipart) — 사업자번호 + 등록증 파일. 성공 시 PENDING(마스터면 VERIFIED). */
export async function verifyBusiness(
  businessNo: string,
  cert: File | null,
): Promise<VerifyBusinessResponse> {
  const form = new FormData();
  form.append("business_no", businessNo);
  if (cert) form.append("cert", cert);
  return api.post("store/business/verify", { body: form }).json<VerifyBusinessResponse>();
}

export async function logout(): Promise<void> {
  await api.post("auth/logout");
}

/** OAuth 인가 URL (BE 302 redirect 진입점). */
export function oauthLoginUrl(provider: "kakao" | "google"): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
  return `${base.replace(/\/$/, "")}/auth/login/${provider}`;
}
