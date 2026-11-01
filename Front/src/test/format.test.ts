// 날짜 표시 — lib/format.ts.
import { describe, expect, it } from "vitest";
import {
  formatMonthDay,
  formatMonthDayDow,
  formatMonthDayTime,
  formatSlashDate,
  parseLocalDate,
  toIsoDate,
} from "../lib/format";

describe("날짜 표시", () => {
  it("parseLocalDate: YYYY-MM-DD를 로컬 자정으로", () => {
    const d = parseLocalDate("2026-10-20");
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 20, 0]);
  });

  it("parseLocalDate: 일시·Date는 로컬 날짜 자정으로", () => {
    const fromIso = parseLocalDate("2026-10-27T21:30:00");
    expect([fromIso.getDate(), fromIso.getHours()]).toEqual([27, 0]);
    const fromDate = parseLocalDate(new Date(2026, 9, 19, 15, 4));
    expect([fromDate.getDate(), fromDate.getHours()]).toEqual([19, 0]);
  });

  it("toIsoDate: 로컬 날짜 그대로", () => {
    expect(toIsoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });

  it("월·일·요일·시각 표기", () => {
    expect(formatMonthDay("2026-10-19")).toBe("10월 19일");
    expect(formatMonthDayDow("2026-10-20")).toBe("10월 20일 (화)");
    expect(formatMonthDayDow(new Date(2026, 9, 21))).toBe("10월 21일 (수)");
    expect(formatSlashDate("2026-10-19")).toBe("10/19");
    expect(formatMonthDayTime(new Date(2026, 9, 17, 14, 2))).toBe("10월 17일 14:02");
  });
});
