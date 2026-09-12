"""서빙 피처 빌더 — keep 20열 (02_features §7 확정) 을 요청 payload에서 재구성.

원칙 (notebooks/06_enhancement.ipynb §1 h-안전 규칙과 동일):
- 타깃 유래 피처는 전부 대상일 D 기준 h영업일 이전 정보만 사용 (shift(h) 등가)
- 같은 요일 피처(lag_dow·roll4dow)는 정의상 ≥7일 이전이라 h≤7에서 안전
- 달력·학사 지식은 AI Server 내장(공휴일 패키지 + data/manual/academic_calendar.csv),
  기상은 요청 payload(과거 관측 + 대상일 예보) — 예보에 평균기온이 없어 (min+max)/2 근사

Docker 배포 시 data/manual/ 을 이미지에 COPY해야 한다 (docker/ai/Dockerfile — Phase 배포 단계).
"""
from __future__ import annotations

import datetime as dt
from functools import lru_cache
from pathlib import Path

import holidays as holidays_pkg
import pandas as pd

# 모델 행렬 컬럼 순서 — 학습·예측 간 고정 (05 모델 카드)
FEATURE_COLUMNS = [
    "is_holiday", "semester_week", "is_semester_first2w", "temp_avg", "temp_range",
    "lag_sales_h", "lag_tx_h", "lag_dow_sales", "roll7_h", "roll4dow_mean", "roll_atv_h",
    "is_post_renewal", "days_since_reopen",
    "dow_0", "dow_1", "dow_2", "dow_3", "dow_4", "dow_5", "dow_6",
]
CORE_LAG_COLUMNS = ["lag_sales_h", "roll7_h", "lag_dow_sales"]  # 신뢰도 T2 (04_feature_spec.md §5.3)

_ACADEMIC_CSV = Path(__file__).resolve().parents[2] / "data" / "manual" / "academic_calendar.csv"
_MANUAL_HOLIDAYS = {dt.date(2025, 10, 10)}  # 임시공휴일 수동 보정 (data/README 검수 항목)


@lru_cache(maxsize=1)
def _academic() -> pd.DataFrame:
    df = pd.read_csv(_ACADEMIC_CSV, parse_dates=["start_date", "end_date"])
    return df[["event", "start_date", "end_date"]]


@lru_cache(maxsize=8)
def _kr_holidays(year: int) -> set[dt.date]:
    return set(holidays_pkg.KR(years=year).keys())


def is_holiday(day: dt.date) -> bool:
    return day in _kr_holidays(day.year) or day in _MANUAL_HOLIDAYS


def semester_week_of(day: dt.date) -> int:
    """개강 후 경과 주차(학기 밖 0) — features_build.py 정의와 동일."""
    ts = pd.Timestamp(day)
    for _, r in _academic().iterrows():
        if r["event"] == "semester" and r["start_date"] <= ts <= r["end_date"]:
            return int((ts - r["start_date"]).days // 7) + 1
    return 0


def calendar_features(day: dt.date, reopen_date: dt.date | None) -> dict[str, float]:
    week = semester_week_of(day)
    feats: dict[str, float] = {
        "is_holiday": float(is_holiday(day)),
        "semester_week": float(week),
        "is_semester_first2w": float(week in (1, 2)),
        "is_post_renewal": float(reopen_date is not None and day >= reopen_date),
        "days_since_reopen": float(max((day - reopen_date).days, 0)) if reopen_date else 0.0,
    }
    for i in range(7):
        feats[f"dow_{i}"] = float(day.weekday() == i)
    return feats


def lag_features(open_sales: pd.Series, open_tx: pd.Series, day: dt.date, h: int) -> dict[str, float]:
    """영업일 시퀀스(open_sales: date-index, 매출>0만)에서 h영업일-안전 lag·rolling 산출.

    시퀀스에 없는 값은 NaN 유지 — 보간하지 않는다(M6.A4 규칙: 'lag 없음'도 정보).
    """
    n = len(open_sales)
    nan = float("nan")
    out = {"lag_sales_h": nan, "lag_tx_h": nan, "roll7_h": nan,
           "roll_atv_h": nan, "lag_dow_sales": nan, "roll4dow_mean": nan}
    if n >= h:
        out["lag_sales_h"] = float(open_sales.iloc[n - h])
        out["lag_tx_h"] = float(open_tx.iloc[n - h])
    if n >= h + 6:
        out["roll7_h"] = float(open_sales.iloc[n - h - 6 : n - h + 1].mean())
        atv = open_sales / open_tx.replace(0, pd.NA)
        out["roll_atv_h"] = float(atv.iloc[n - h - 6 : n - h + 1].mean())
    same_dow = open_sales[open_sales.index.dayofweek == pd.Timestamp(day).dayofweek]
    if len(same_dow) >= 1:
        out["lag_dow_sales"] = float(same_dow.iloc[-1])
    if len(same_dow) >= 4:
        out["roll4dow_mean"] = float(same_dow.iloc[-4:].mean())
    return out


def weather_features(weather: pd.DataFrame, day: dt.date) -> dict[str, float]:
    """요청 weather(date·temp_min·temp_max)에서 대상일 기온 피처 — 없으면 NaN(LGBM 네이티브)."""
    nan = float("nan")
    row = weather[weather["date"] == pd.Timestamp(day)]
    if row.empty:
        return {"temp_avg": nan, "temp_range": nan}
    r = row.iloc[0]
    return {"temp_avg": (float(r["temp_min"]) + float(r["temp_max"])) / 2.0,
            "temp_range": float(r["temp_max"]) - float(r["temp_min"])}


def build_row(open_sales: pd.Series, open_tx: pd.Series, weather: pd.DataFrame,
              day: dt.date, h: int, reopen_date: dt.date | None) -> pd.DataFrame:
    """대상일 1행의 모델 행렬(FEATURE_COLUMNS 순서)."""
    feats = {**calendar_features(day, reopen_date),
             **lag_features(open_sales, open_tx, day, h),
             **weather_features(weather, day)}
    return pd.DataFrame([feats], index=[pd.Timestamp(day)])[FEATURE_COLUMNS]
