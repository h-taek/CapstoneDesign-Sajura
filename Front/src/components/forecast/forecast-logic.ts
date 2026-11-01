// 매출 예측 화면 순수 계산 — 기간(주·월·년) 범위·이전 기간 넘김 끝·예측 정확도(일별/월별)·메뉴 비중.
import { HTTPError } from "ky";
import type { ForecastActualPoint } from "../../api/endpoints/dashboard";
import type { DailyPrediction } from "../../api/endpoints/forecast";
import { accuracyRatio } from "../../lib/accuracy";
import { formatMonthDay, formatWonShort, toIsoDate } from "../../lib/format";

export type PeriodRange = "week" | "month" | "year";

export type MenuForecastItem = DailyPrediction["menu_forecast"][number];

const HORIZON_DAY_LABELS: Record<number, string> = {
  1: "오늘",
  2: "내일",
  3: "모레",
};

const LOW_CONFIDENCE_REASONS: Record<string, string> = {
  SHORT_HISTORY: "신뢰도 낮음 — 판매 이력이 짧아 오차가 클 수 있어요",
  MISSING_FEATURES: "신뢰도 낮음 — 최근 판매 기록이 비어 있어 오차가 클 수 있어요",
  SPECIAL_DAY: "신뢰도 낮음 — 공휴일이라 평소와 다를 수 있어요",
  LONG_HORIZON: "신뢰도 낮음 — 사흘 뒤 예측이라 오차가 클 수 있어요",
  WIDE_INTERVAL: "신뢰도 낮음 — 예상 매출 범위가 넓어 오차가 클 수 있어요",
  DRIFT: "신뢰도 낮음 — 최근 매출 흐름이 평소와 달라 오차가 클 수 있어요",
};

/** horizon_days(1~3)를 오늘·내일·모레로 바꾼다. */
export function horizonDayLabel(horizonDays: number, index: number): string {
  return HORIZON_DAY_LABELS[horizonDays] ?? HORIZON_DAY_LABELS[index + 1] ?? `${horizonDays}일 뒤`;
}

/** 예상 범위 표기 — "86만~130만원". */
export function formatIntervalRange(p10: number, p90: number): string {
  const low = formatWonShort(p10).replace(/원$/, "");
  const high = formatWonShort(p90);
  return `${low}~${high}`;
}

/** 신뢰도 낮음 배지 마우스오버 문구(low_confidence_reason). */
export function lowConfidenceTooltip(reason: string | null | undefined): string {
  if (!reason) return "신뢰도 낮음";
  return LOW_CONFIDENCE_REASONS[reason] ?? `신뢰도 낮음 — ${reason}`;
}

/** 예측 조회 실패 안내 문구 (04_fe.md §4.4). */
export function forecastErrorMessage(error: unknown): string {
  if (error instanceof HTTPError && error.response.status === 422) {
    return "AI 예측에 필요한 판매 이력이 부족합니다 (최소 10일 이상 필요).";
  }
  return "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.";
}

export interface PeriodBounds {
  start: Date;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
  queryStart: Date;
  queryEnd: Date;
  label: string;
  unit: "일별 매출" | "월별 매출";
  prevName: string | null;
  latest: boolean;
}

/** 주·월·년 단위와 이전 넘김 단계(back)로 조회 기간과 직전 비교 기간을 계산한다. */
export function getPeriodBounds(range: PeriodRange, back: number, refDate: Date): PeriodBounds {
  const safeBack = Math.max(0, back);
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

  if (range === "week") {
    const end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - 7 * safeBack);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 1);
    const prevStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    return {
      start,
      end,
      prevStart,
      prevEnd,
      queryStart: prevStart,
      queryEnd: end,
      label: `${formatMonthDay(start)} ~ ${formatMonthDay(end)}`,
      unit: "일별 매출",
      prevName: "직전 7일",
      latest: safeBack === 0,
    };
  }

  if (range === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth() - safeBack, 1);
    const end = safeBack === 0 ? ref : new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1);
    const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0);
    const m = start.getMonth() + 1;
    const prevM = prevStart.getMonth() + 1;
    return {
      start,
      end,
      prevStart,
      prevEnd,
      queryStart: prevStart,
      queryEnd: end,
      label: `${start.getFullYear()}년 ${m}월`,
      unit: "일별 매출",
      prevName: `${prevM}월`,
      latest: safeBack === 0,
    };
  }

  const endMonth = new Date(ref.getFullYear(), ref.getMonth() - 12 * safeBack, 1);
  const start = new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1);
  const end = safeBack === 0 ? ref : new Date(endMonth.getFullYear(), endMonth.getMonth() + 1, 0);
  return {
    start,
    end,
    prevStart: null,
    prevEnd: null,
    // 앞 12개월도 받는다 — 그 안에 판매가 있어야 이전 기간으로 넘길 수 있다
    queryStart: new Date(start.getFullYear() - 1, start.getMonth(), 1),
    queryEnd: end,
    label: `${start.getFullYear()}년 ${start.getMonth() + 1}월 ~ ${endMonth.getFullYear()}년 ${endMonth.getMonth() + 1}월`,
    unit: "월별 매출",
    prevName: null,
    latest: false,
  };
}

/** 구간(일 또는 월) 배열에서 1 − |예측 − 실제| ÷ 실제의 평균(%)을 계산한다. */
export function calcBucketAccuracy(
  values: readonly number[],
  predicted: readonly (number | null)[],
): number | null {
  let sum = 0;
  let count = 0;
  for (let i = 0; i < values.length; i++) {
    const actual = values[i];
    const pred = predicted[i];
    const ratio = accuracyRatio(actual, pred);
    if (ratio == null) continue;
    sum += ratio;
    count++;
  }
  if (count === 0) return null;
  return Math.round((sum / count) * 100);
}

export interface PeriodView {
  label: string;
  unit: "일별 매출" | "월별 매출";
  labels: string[];
  values: number[];
  predicted: (number | null)[];
  total: number;
  accuracy: number | null;
  prev: number | null;
  prevName: string | null;
  avg: number | null;
  latest: boolean;
  canBack: boolean;
  start: Date;
  end: Date;
}

/** 일별 예측·실제 매출 데이터로 주·월·년 기간 매출 뷰와 이전 기간 넘김 가능 여부를 만든다. */
export function buildPeriodView(
  range: PeriodRange,
  back: number,
  refDate: Date,
  points: readonly ForecastActualPoint[],
): PeriodView {
  const bounds = getPeriodBounds(range, back, refDate);
  const byDate = new Map<string, ForecastActualPoint>();
  for (const p of points) {
    byDate.set(p.date.slice(0, 10), p);
  }

  if (range === "year") {
    const labels: string[] = [];
    const values: number[] = [];
    const predicted: (number | null)[] = [];
    // 정확도는 예측이 있는 날끼리만 달마다 비교한다 — 그달 전체 실제 매출과 일부 날짜 예측을 견주지 않는다
    const pairedActual: number[] = [];
    const pairedPredicted: (number | null)[] = [];
    const monthIndex = new Map<string, number>();

    for (let i = 0; i < 12; i++) {
      const mDate = new Date(bounds.start.getFullYear(), bounds.start.getMonth() + i, 1);
      const ym = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, "0")}`;
      monthIndex.set(ym, i);
      labels.push(`${mDate.getMonth() + 1}월`);
      values.push(0);
      predicted.push(null);
      pairedActual.push(0);
      pairedPredicted.push(null);
    }

    const startIso = toIsoDate(bounds.start);
    const endIso = toIsoDate(bounds.end);
    let hasEarlierSales = false;

    for (const p of points) {
      const iso = p.date.slice(0, 10);
      if (iso < startIso) {
        if ((p.actual_sales ?? 0) > 0) hasEarlierSales = true;
        continue;
      }
      if (iso > endIso) continue;
      const idx = monthIndex.get(iso.slice(0, 7));
      if (idx === undefined) continue;
      values[idx] = (values[idx] ?? 0) + (p.actual_sales ?? 0);
      if (p.predicted_sales != null) {
        predicted[idx] = (predicted[idx] ?? 0) + p.predicted_sales;
        pairedPredicted[idx] = (pairedPredicted[idx] ?? 0) + p.predicted_sales;
        pairedActual[idx] = (pairedActual[idx] ?? 0) + (p.actual_sales ?? 0);
      }
    }

    const total = values.reduce((a, b) => a + b, 0);
    return {
      label: bounds.label,
      unit: bounds.unit,
      labels,
      values,
      predicted,
      total,
      accuracy: calcBucketAccuracy(pairedActual, pairedPredicted),
      prev: null,
      prevName: null,
      avg: total / 12,
      latest: false,
      canBack: hasEarlierSales,
      start: bounds.start,
      end: bounds.end,
    };
  }

  const labels: string[] = [];
  const values: number[] = [];
  const predicted: (number | null)[] = [];
  const spanDays = Math.round((bounds.end.getTime() - bounds.start.getTime()) / 86_400_000) + 1;

  for (let i = 0; i < spanDays; i++) {
    const d = new Date(
      bounds.start.getFullYear(),
      bounds.start.getMonth(),
      bounds.start.getDate() + i,
    );
    const iso = toIsoDate(d);
    const p = byDate.get(iso);
    labels.push(`${d.getMonth() + 1}/${d.getDate()}`);
    values.push(p?.actual_sales ?? 0);
    predicted.push(p?.predicted_sales ?? null);
  }

  let prevSum = 0;
  if (bounds.prevStart && bounds.prevEnd) {
    const prevSpan =
      Math.round((bounds.prevEnd.getTime() - bounds.prevStart.getTime()) / 86_400_000) + 1;
    for (let i = 0; i < prevSpan; i++) {
      const d = new Date(
        bounds.prevStart.getFullYear(),
        bounds.prevStart.getMonth(),
        bounds.prevStart.getDate() + i,
      );
      const p = byDate.get(toIsoDate(d));
      prevSum += p?.actual_sales ?? 0;
    }
  }

  const total = values.reduce((a, b) => a + b, 0);
  const prev = prevSum > 0 ? prevSum : null;

  return {
    label: bounds.label,
    unit: bounds.unit,
    labels,
    values,
    predicted,
    total,
    accuracy: calcBucketAccuracy(values, predicted),
    prev,
    prevName: bounds.prevName,
    avg: null,
    latest: bounds.latest,
    canBack: prev !== null,
    start: bounds.start,
    end: bounds.end,
  };
}

/** 어제(마지막 판매일) 예측 정확도 배지 값과 마우스오버 문구. */
export function calcYesterdayAccuracy(
  point: ForecastActualPoint | undefined,
): { pct: number; title: string } | null {
  const ratio = accuracyRatio(point?.actual_sales, point?.predicted_sales);
  if (!point || ratio == null || point.actual_sales == null || point.predicted_sales == null) {
    return null;
  }
  const pct = Math.round(ratio * 100);
  return {
    pct,
    title: `어제 예측 ${formatWonShort(point.predicted_sales)}, 실제 ${formatWonShort(point.actual_sales)}`,
  };
}

export interface MenuShareCardItem extends MenuForecastItem {
  rank: number;
  sharePct: number;
  strokeDasharray: string;
}

/** 고른 날의 메뉴별 예상 판매 목록을 판매량 내림차순·비중(%)·도넛 둘레(r=36, 226.2)로 변환한다. */
export function buildMenuShareItems(items: readonly MenuForecastItem[]): MenuShareCardItem[] {
  const sorted = [...items].sort((a, b) => b.expected_quantity - a.expected_quantity);
  const totalQty = sorted.reduce((acc, m) => acc + m.expected_quantity, 0);
  return sorted.map((item, idx) => {
    const sharePct = totalQty > 0 ? Math.round((item.expected_quantity / totalQty) * 100) : 0;
    const dash = ((sharePct / 100) * 226.2).toFixed(1);
    return {
      ...item,
      rank: idx + 1,
      sharePct,
      strokeDasharray: `${dash} 226.2`,
    };
  });
}
