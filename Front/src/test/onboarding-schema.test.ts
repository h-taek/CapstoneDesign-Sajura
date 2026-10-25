import { describe, expect, it } from "vitest";
import {
  formatPhone,
  posStepSchema,
  storeStepSchema,
} from "../schemas/onboarding";

describe("formatPhone", () => {
  it("masks Seoul number", () => {
    expect(formatPhone("0212345678")).toBe("02-1234-5678");
  });
  it("masks mobile number", () => {
    expect(formatPhone("01012345678")).toBe("010-1234-5678");
  });
  it("strips non digits", () => {
    expect(formatPhone("010-abcd-5678")).toBe("010-5678");
  });
});

describe("storeStepSchema", () => {
  const valid = {
    store_name: "길동 카페",
    business_type: "카페",
    store_size: "SMALL" as const,
    operation_type: "HALL" as const,
    address: "서울시 강남구",
    phone: "02-1234-5678",
  };
  it("accepts valid input", () => {
    expect(storeStepSchema.safeParse(valid).success).toBe(true);
  });
  it("rejects bad phone", () => {
    expect(storeStepSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
  });
});

describe("posStepSchema", () => {
  it("requires credentials when not CSV_ONLY", () => {
    const r = posStepSchema.safeParse({ pos_type: "TOSSPLACE" });
    expect(r.success).toBe(false);
  });
  it("allows CSV_ONLY without credentials", () => {
    const r = posStepSchema.safeParse({ pos_type: "CSV_ONLY" });
    expect(r.success).toBe(true);
  });
});
