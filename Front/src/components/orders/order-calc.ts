// 추천발주 화면 계산 순수 함수 — 04_fe.md §4.8, §7.0.
import type { OrderRecommendation } from "../../api/endpoints/orders";
import {
  WEEKDAYS,
  formatMonthDayDow,
  formatSlashDate,
  formatWon,
  parseLocalDate,
} from "../../lib/format";

/** 날짜 문자열(YYYY-MM-DD)을 "M/D" (예: "10/21") 형태로 변환. 없으면 "—" */
export function formatStockoutDate(dateStr: string | null | undefined): string {
  return dateStr ? formatSlashDate(dateStr) : "—";
}

/**
 * 추천 대상 날짜 목록(target_dates)으로 머리글 안내 문구 생성.
 * 예: "10월 19일 판매까지 반영 · 10월 20일 (화) ~ 22일 (목) 3일분"
 */
export function formatTargetPeriod(targetDates: string[] | undefined | null): string {
  if (!targetDates || targetDates.length === 0) {
    return "";
  }
  const first = parseLocalDate(targetDates[0]!);
  if (Number.isNaN(first.getTime())) return "";

  // 반영 기준일: 첫 추천 대상일 하루 전
  const prevDate = new Date(first.getFullYear(), first.getMonth(), first.getDate() - 1);
  const reflectedText = `${prevDate.getMonth() + 1}월 ${prevDate.getDate()}일 판매까지 반영`;

  const count = targetDates.length;
  if (count === 1) {
    return `${reflectedText} · ${formatMonthDayDow(first)} 1일분`;
  }

  const last = parseLocalDate(targetDates[count - 1]!);
  const firstText = formatMonthDayDow(first);

  // 같은 월이면 마지막 날은 "D일 (요일)", 다른 월이면 "M월 D일 (요일)"
  const lastWeekday = WEEKDAYS[last.getDay()] ?? "";
  const lastText =
    first.getMonth() === last.getMonth()
      ? `${last.getDate()}일 (${lastWeekday})`
      : `${last.getMonth() + 1}월 ${last.getDate()}일 (${lastWeekday})`;

  return `${reflectedText} · ${firstText} ~ ${lastText} ${count}일분`;
}

/**
 * 품목 기본 정렬:
 * 1. 예상 소진 시점이 이른 순 (오름차순)
 * 2. 같으면 재료명 가나다순
 * 3. 예상 소진 시점이 없는 품목은 맨 뒤 (소진일 없는 품목끼리도 재료명 가나다순)
 */
export function sortRecommendations(items: OrderRecommendation[]): OrderRecommendation[] {
  return [...items].sort((a, b) => {
    const aDate = a.expected_stockout_date;
    const bDate = b.expected_stockout_date;

    if (aDate && bDate) {
      if (aDate !== bDate) {
        return aDate.localeCompare(bDate);
      }
      return a.item_name.localeCompare(b.item_name, "ko-KR");
    }

    if (aDate && !bDate) return -1;
    if (!aDate && bDate) return 1;

    return a.item_name.localeCompare(b.item_name, "ko-KR");
  });
}

export interface OrderSummaryCalculation {
  selectedCount: number;
  estimatedTotal: number;
  unpricedCount: number;
  unpricedNames: string[];
  unpricedMessage: string | null;
}

/**
 * 고른 품목 수, 예상 합계(단가 미설정 제외), 단가 미설정 품목 안내 계산
 */
export function calculateOrderSummary(
  items: OrderRecommendation[],
  selected: Set<string>,
  quantities: Record<string, string>,
): OrderSummaryCalculation {
  const selectedItems = items.filter((item) => {
    if (!selected.has(item.item_id)) return false;
    const qty = Number(quantities[item.item_id]);
    return Number.isFinite(qty) && qty > 0;
  });

  const selectedCount = selectedItems.length;

  let estimatedTotal = 0;
  const unpricedNames: string[] = [];

  for (const item of selectedItems) {
    const qty = Number(quantities[item.item_id]);
    if (item.unit_price == null) {
      unpricedNames.push(item.item_name);
    } else {
      estimatedTotal += Math.round(item.unit_price * qty);
    }
  }

  const unpricedCount = unpricedNames.length;
  const unpricedMessage =
    unpricedCount > 0
      ? `단가 미설정 ${unpricedCount}개(${unpricedNames.join(", ")})는 합계에서 빠져요`
      : null;

  return {
    selectedCount,
    estimatedTotal,
    unpricedCount,
    unpricedNames,
    unpricedMessage,
  };
}

/** 단가 × 수량 계산. 단가가 없으면 null */
export function calculateItemEstimate(
  unitPrice: number | null | undefined,
  quantityStr: string,
): number | null {
  if (unitPrice == null) return null;
  const q = Number(quantityStr);
  if (!Number.isFinite(q) || q <= 0) return 0;
  return Math.round(unitPrice * q);
}

/** 확정 발주 예상 금액. 담은 상품 단가를 하나도 못 읽어 합계가 0이면 "—" */
export function formatOrderCost(totalEstimatedCost: number): string {
  return totalEstimatedCost > 0 ? formatWon(totalEstimatedCost) : "—";
}
