// 인증 폼 zod 스키마 — api_spec.md §2 register/login + feature_spec.md §1.2.
import { z } from "zod";

// BE _BIZ_NO_RE: ^\d{3}-?\d{2}-?\d{5}$ — FE는 NNN-NN-NNNNN(10자리) 마스크로 정규화.
const BUSINESS_NO_REGEX = /^\d{3}-\d{2}-\d{5}$/;
// 시연/테스트용 마스터 코드(security.md §2.4)는 숫자 형식이 아니라서 별도 허용 — 실제
// 코드값은 BE만 알고 FE는 검증하지 않는다. 문자를 하나 이상 포함해야 매칭시켜서
// (예: "DEMO1234") 자릿수 부족한 순수 숫자(예: "12345")까지 통과되는 걸 막는다.
const MASTER_CODE_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9]{4,20}$/;

export const loginSchema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다."),
  password: z.string().min(1, "비밀번호를 입력하세요."),
});
export type LoginValues = z.infer<typeof loginSchema>;

// 회원가입은 email·password·name만 (사업자 검증·매장 정보는 이후 단계).
export const registerSchema = z
  .object({
    email: z.string().email("이메일 형식이 올바르지 않습니다."),
    password: z
      .string()
      .min(8, "비밀번호는 8자 이상이어야 합니다.")
      .max(128, "비밀번호는 128자 이하여야 합니다."),
    password_confirm: z.string(),
    name: z.string().min(1, "이름을 입력하세요.").max(50),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "비밀번호가 일치하지 않습니다.",
    path: ["password_confirm"],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

// 사업자 검증 단계 — 사업자번호 형식 검증 (파일은 RHF 밖에서 별도 관리).
export const verifyBusinessSchema = z.object({
  business_no: z
    .string()
    .refine(
      (v) => BUSINESS_NO_REGEX.test(v) || MASTER_CODE_REGEX.test(v),
      "사업자등록번호 형식: 123-45-67890",
    ),
});
export type VerifyBusinessValues = z.infer<typeof verifyBusinessSchema>;

/** 사업자번호 입력 마스크: 숫자만 받아 NNN-NN-NNNNN 형태로 정렬.
 * 문자가 섞인 값(시연용 마스터 코드 등)은 마스킹하지 않고 그대로 통과시킨다. */
export function formatBusinessNo(raw: string): string {
  if (/[A-Za-z]/.test(raw)) return raw;
  const d = raw.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}
