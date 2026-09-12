"""일별 피처 테이블 생성 — M6.A3.

processed/ 산출물(판매·기상·공휴일·인구)과 manual/(학사일정)을 조인해
캘린더 그레인(2025-04-03~2026-04-16, 379일)의 피처 후보 테이블을 만든다.
산출: processed/features_daily.{csv,parquet}

누수 방지 원칙 (`docs/spec/11_ai_spec.md` §5)
- 타깃 유래 피처(lag·rolling)는 전부 shift(1) 이후 — 예측일 값은 절대 포함하지 않는다
- 유동인구는 전월(lag 1M) 값만 사용 (당월 값은 월말까지 확정되지 않음)
- 기상은 학습 시 실측 사용 — 운영 서빙에서는 예보로 대체됨(Phase 7) → 후보 근거는 EDA §4
- 결측 보간·이상치 처리는 하지 않는다(M6.A4에서 train 기준 확정) — NaN 그대로 둔다

피처 근거: notebooks/01_eda.ipynb §9 후보 목록. 선별 결과는 notebooks/02_features.ipynb.

실행: python AI/data_prep/features_build.py
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from paths import MANUAL_DIR, PROCESSED_DIR

WEATHER_STATION = 611  # 세종연서 — 조치원 최근접 (data/README.md)
REOPEN = pd.Timestamp("2026-02-26")  # 장기 휴업(2025-12-21~2026-02-25) 후 재개장
OPEN_DAY = pd.Timestamp("2025-04-10")  # 첫 매출일 = 실질 개업일 (04-03은 POS 테스트일)

# 그룹별 피처 후보 — 노트북·문서가 이 정의를 SSOT로 참조한다
FEATURE_GROUPS: dict[str, list[str]] = {
    "달력": ["dow", "is_weekend", "month", "month_sin", "month_cos", "is_holiday", "is_holiday_eve"],
    "학사": ["is_semester", "is_exam", "is_session", "is_makeup_week", "is_festival",
           "semester_week", "is_semester_first2w"],
    "기상": ["temp_avg", "temp_min", "temp_max", "temp_range", "precip_mm",
           "is_rain", "is_rain_heavy", "is_cold", "is_hot"],
    "타깃 lag·rolling": ["lag1_sales", "lag7_sales", "lag_dow_sales", "roll7_mean", "roll14_mean",
                       "roll4dow_mean", "lag1_tx", "days_gap_prev_open"],
    "운영 구간(regime)": ["is_post_renewal", "days_since_reopen", "days_since_open"],
    "유동인구": ["floating_prev_m"],
    "메뉴 집계": ["roll7_alcohol_share", "roll7_atv"],
}
ALL_FEATURES = [f for g in FEATURE_GROUPS.values() for f in g]


def build_features() -> pd.DataFrame:
    tot = pd.read_csv(PROCESSED_DIR / "sales_daily_total.csv", parse_dates=["date"])
    menu = pd.read_csv(PROCESSED_DIR / "sales_daily_menu.csv", parse_dates=["date"])
    wx = pd.read_csv(PROCESSED_DIR / "weather_daily.csv", parse_dates=["date"])
    hol = pd.read_csv(PROCESSED_DIR / "holidays.csv", parse_dates=["date"])
    acad = pd.read_csv(MANUAL_DIR / "academic_calendar.csv", parse_dates=["start_date", "end_date"])
    pop = pd.read_csv(PROCESSED_DIR / "population_monthly.csv")

    cal = pd.date_range(tot["date"].min(), tot["date"].max(), freq="D")
    df = tot.set_index("date").reindex(cal).rename_axis("date")
    df["total_amount"] = df["total_amount"].fillna(0)
    df["tx_count"] = df["tx_count"].fillna(0)
    df["is_open"] = df["total_amount"] > 0
    df = df.drop(columns=["source_file"])

    # ── 달력 ──
    df["dow"] = df.index.dayofweek
    df["is_weekend"] = df["dow"] >= 5
    df["month"] = df.index.month
    df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
    df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)
    hol_set = set(hol["date"])
    df["is_holiday"] = df.index.isin(hol_set)
    df["is_holiday_eve"] = (df.index + pd.DateOffset(days=1)).isin(hol_set)

    # ── 학사 (semester_week: 개강 후 경과 주차, 학기 밖 0) ──
    for c in ("is_semester", "is_exam", "is_session", "is_makeup_week", "is_festival"):
        df[c] = False
    df["semester_week"] = 0
    event_flag = {"semester": "is_semester", "midterm_exam": "is_exam", "final_exam": "is_exam",
                  "summer_session": "is_session", "winter_session": "is_session",
                  "makeup_week": "is_makeup_week", "festival": "is_festival"}
    for _, r in acad.iterrows():
        lo, hi = max(r["start_date"], cal[0]), min(r["end_date"], cal[-1])
        if lo > hi:
            continue
        idx = df.loc[lo:hi].index
        df.loc[idx, event_flag[r["event"]]] = True
        if r["event"] == "semester":
            df.loc[idx, "semester_week"] = ((idx - r["start_date"]).days // 7) + 1
    df["is_semester_first2w"] = df["semester_week"].isin([1, 2])

    # ── 기상 (세종연서 611) ──
    w = wx[wx["station_id"] == WEATHER_STATION].set_index("date")
    df = df.join(w[["temp_avg", "temp_min", "temp_max", "precip_mm"]])
    df["temp_range"] = df["temp_max"] - df["temp_min"]
    df["is_rain"] = df["precip_mm"] > 0
    df["is_rain_heavy"] = df["precip_mm"] >= 10
    df["is_cold"] = df["temp_avg"] < 5
    df["is_hot"] = df["temp_avg"] >= 25

    # ── 타깃 lag·rolling — 영업일 시퀀스 기준, 전부 shift(1) 이후 ──
    open_days = df.index[df["is_open"]]
    s = df.loc[open_days, "total_amount"]  # 영업일 매출 시퀀스
    df["lag1_sales"] = s.shift(1)  # 직전 영업일
    df["roll7_mean"] = s.shift(1).rolling(7).mean()
    df["roll14_mean"] = s.shift(1).rolling(14).mean()
    df["lag1_tx"] = df.loc[open_days, "tx_count"].shift(1)
    # 같은 요일 기준 — 직전 같은 요일 영업일, 직전 4회 평균
    by_dow = s.groupby(s.index.dayofweek)
    df["lag_dow_sales"] = by_dow.shift(1)
    df["roll4dow_mean"] = by_dow.apply(lambda g: g.shift(1).rolling(4).mean()).droplevel(0)
    # 캘린더 7일 전 매출 (그날이 무매출이면 NaN — 휴업 구간 반영)
    cal_sales = df["total_amount"].where(df["is_open"])
    df["lag7_sales"] = cal_sales.shift(7)
    # 직전 영업일로부터의 간격(일) — 연휴·휴업 직후 효과
    gap = pd.Series(open_days, index=open_days).diff().dt.days
    df["days_gap_prev_open"] = gap

    # ── 운영 구간(regime) — EDA §2.6 업종 개편 ──
    df["is_post_renewal"] = df.index >= REOPEN
    df["days_since_reopen"] = np.maximum((df.index - REOPEN).days, 0)
    df["days_since_open"] = np.maximum((df.index - OPEN_DAY).days, 0)

    # ── 유동인구 — 조치원읍 전월 값 (누락 월 NaN 유지) ──
    jc = pop[pop["dong"] == "조치원읍"].set_index("month")["floating_pop"]
    prev_month = (df.index.to_period("M") - 1).strftime("%Y-%m")  # 항상 직전 달
    df["floating_prev_m"] = pd.Series(prev_month, index=df.index).map(jc)

    # ── 메뉴 집계 — 직전 7영업일 술 매출 비중·평균 객단가 ──
    alcohol = (menu[menu["category_std"] == "술"].groupby("date")["amount_net"].sum()
               .reindex(open_days, fill_value=0))
    share = (alcohol / s).rename("alcohol_share")
    df["roll7_alcohol_share"] = share.shift(1).rolling(7).mean()
    atv = s / df.loc[open_days, "tx_count"]
    df["roll7_atv"] = atv.shift(1).rolling(7).mean()

    return df.reset_index()


def main() -> int:
    df = build_features()
    df.to_csv(PROCESSED_DIR / "features_daily.csv", index=False)
    df.to_parquet(PROCESSED_DIR / "features_daily.parquet", index=False)

    ob = df[df["is_open"]]
    print(f"캘린더 {len(df)}일 / 영업일(모델링 행) {len(ob)}일 / 피처 후보 {len(ALL_FEATURES)}개")
    for g, cols in FEATURE_GROUPS.items():
        print(f"  {g}: {len(cols)}개 — {', '.join(cols)}")
    na = ob[ALL_FEATURES].isna().sum()
    na = na[na > 0]
    print("\n영업일 기준 NaN (보간은 M6.A4):")
    print(na.to_string() if len(na) else "  없음")
    print(f"\n산출: {PROCESSED_DIR / 'features_daily.csv'} (+ .parquet)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
