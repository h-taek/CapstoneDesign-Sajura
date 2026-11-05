// 인증 API — 02_implementation_design.md §3.2·§3.3.
import { HTTPError } from "ky";
import { api } from "../../lib/api";
import type { AuthUser } from "../../stores/auth-store";
import type { components } from "../types.gen";

type S = components["schemas"];

export type TokenResponse = S["TokenResponse"];

type RefreshResponse = S["TokenResponse"];

type LoginResponse = S["TokenResponse"];

export type SocialSignupInfo = S["SocialSignupResponse"];

export type ChangePasswordRequest = S["ChangePasswordRequest"];

export type DeleteAccountRequest = S["DeleteAccountRequest"];

export type BusinessVerifyResponse = S["BusinessVerifyResponse"];

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

function businessForm(businessNo: string, cert: File | null): FormData {
  const form = new FormData();
  form.append("business_no", businessNo);
  if (cert) form.append("cert", cert);
  return form;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  businessNo: string;
  cert: File | null;
}

/** 이메일 회원가입 (multipart) — 사업자 검증을 통과해야 계정 생성, 응답은 로그인과 같다. */
export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const form = businessForm(payload.businessNo, payload.cert);
  form.append("email", payload.email);
  form.append("password", payload.password);
  form.append("name", payload.name);
  return api.post("auth/register", { body: form }).json<TokenResponse>();
}

/** 소셜 가입 대기 정보 — Cookie signup_token이 없거나 만료면 401 AUTH_SIGNUP_TOKEN_INVALID. */
export async function fetchSocialSignup(): Promise<SocialSignupInfo> {
  return api.get("auth/register/social").json<SocialSignupInfo>();
}

/** 소셜 회원가입 (multipart) — 가입 대기 토큰의 계정으로, 사업자 검증을 통과해야 계정 생성. */
export async function registerSocial(
  businessNo: string,
  cert: File | null,
): Promise<TokenResponse> {
  return api
    .post("auth/register/social", { body: businessForm(businessNo, cert) })
    .json<TokenResponse>();
}

/** BE 에러 envelope의 error 코드. 본문은 clone으로 읽어 메시지 파싱과 겹치지 않게 한다. */
export async function authErrorCode(error: unknown): Promise<string | null> {
  if (!(error instanceof HTTPError)) return null;
  const body = (await error.response
    .clone()
    .json()
    .catch(() => null)) as { error?: string } | null;
  return body?.error ?? null;
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

export type UpdateMePayload = S["UpdateMeRequest"];

export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  return api.patch("auth/me", { json: payload }).json<AuthUser>();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch("auth/password", {
    json: { current_password: currentPassword, new_password: newPassword },
  });
}

type VerifyBusinessResponse = S["BusinessVerifyResponse"];

/** 사업자 검증 (multipart) — 사업자번호 + 등록증 파일. 성공 시 PENDING(마스터면 VERIFIED). */
export async function verifyBusiness(
  businessNo: string,
  cert: File | null,
): Promise<VerifyBusinessResponse> {
  return api
    .post("store/business/verify", { body: businessForm(businessNo, cert) })
    .json<VerifyBusinessResponse>();
}

/** 회원 탈퇴 — 30일 유예 후 파기 (01_basic_design.md §5.2.1). 소셜 계정은 빈 비밀번호. */
export async function deleteAccount(password: string): Promise<void> {
  await api.delete("auth/me", { json: { password } });
}

export async function logout(): Promise<void> {
  await api.post("auth/logout");
}

/** OAuth 인가 URL (BE 302 redirect 진입점). */
export function oauthLoginUrl(provider: "kakao" | "google"): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "/api";
  return `${base.replace(/\/$/, "")}/auth/login/${provider}`;
}
