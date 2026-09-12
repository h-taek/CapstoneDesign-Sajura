// 온보딩 zod 스키마 — 10_frontend_design.md §7 + 07_api_spec.md §3·§4.
import { z } from "zod";

const PHONE_REGEX = /^0\d{1,2}-\d{3,4}-\d{4}$/;

export const storeStepSchema = z.object({
  store_name: z.string().min(1, "매장명을 입력하세요.").max(50),
  business_type: z.string().min(1, "업종을 선택하세요."),
  store_size: z.enum(["SMALL", "MEDIUM", "LARGE"], {
    message: "매장 규모를 선택하세요.",
  }),
  operation_type: z.enum(["HALL", "DELIVERY", "BOTH"], {
    message: "운영 형태를 선택하세요.",
  }),
  address: z.string().min(1, "주소를 입력하세요.").max(200),
  phone: z
    .string()
    .regex(PHONE_REGEX, "전화번호 형식: 02-1234-5678 또는 010-1234-5678"),
});
export type StoreStepValues = z.infer<typeof storeStepSchema>;

export const posStepSchema = z
  .object({
    pos_type: z.enum(["UNIONPOS", "OKPOS", "POSBANK", "CSV_ONLY"], {
      message: "POS 종류를 선택하세요.",
    }),
    api_key: z.string().optional(),
    store_code: z.string().optional(),
  })
  .refine(
    (val) =>
      val.pos_type === "CSV_ONLY" ||
      (val.api_key && val.api_key.length > 0 && val.store_code && val.store_code.length > 0),
    {
      message: "POS API 키와 매장 코드를 입력하세요.",
      path: ["api_key"],
    },
  );
export type PosStepValues = z.infer<typeof posStepSchema>;

export const menuItemSchema = z.object({
  name: z.string().min(1, "메뉴명을 입력하세요.").max(50),
  category: z.string().min(1, "카테고리를 입력하세요.").max(30),
  price: z.coerce
    .number({ message: "숫자로 입력하세요." })
    .int("정수로 입력하세요.")
    .min(0, "0 이상이어야 합니다."),
  is_active: z.boolean(),
  use_inventory_deduction: z.boolean(),
});

export const menusStepSchema = z.object({
  menus: z
    .array(menuItemSchema)
    .min(1, "메뉴를 1개 이상 등록하세요.")
    .max(50, "한 번에 최대 50개까지 등록할 수 있습니다."),
});
export type MenusStepValues = z.infer<typeof menusStepSchema>;

/** 전화번호 입력 마스크: 숫자만 입력받아 0xx-xxxx-xxxx 형태로 정렬. */
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.startsWith("02")) {
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9)
      return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}
