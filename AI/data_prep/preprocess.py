"""전처리 규칙 SSOT — M6.A4 확정 (근거·검증: notebooks/03_preprocessing.ipynb).

`11_ai_spec.md` §6의 "별도 확정 예정" 항목을 채우는 규칙 모음.
features_build.py 산출(features_daily)은 원본 실측 그대로 두고,
보간·이상치·fold 분할은 전부 여기서 — 학습(M6.A5~) 직전에만 적용한다.

확정 규칙 요약
1. 검증 분할: 월 단위 walk-forward — 검증 fold = 영업일 10일 이상인 캘린더 월(2025-09부터),
   train = 해당 월 이전 전체 영업일. 휴업 월(2026-01 영업 0일·02 3일)은 자동 배제.
2. 유동인구: 전월 값을 ffill(직전 가용 월)로 보간 + staleness(개월) 플래그.
   선형 보간은 미래 월 값을 참조하므로 금지(서빙 시점에 미확정). ※ M6.A4 ablation
   결과 모델 1군에서 제외 — 규칙은 재평가(원본 확보·일별 데이터 전환) 대비 유지.
3. 기상 결측: 판매 기간 내 NA(강수 1일)는 캘린더 선형 보간 — 과거 실측 구간이라 누수 없음.
4. lag 워밍업 NaN: 트리 모델은 네이티브 NaN 유지, 선형·통계 모델은 core lag
   (lag1·roll7·lag_dow) 완비 행만 사용(256→249일).
5. 타깃 이상치: log1p 스케일 IQR k=3.0, train 구간 fit → 경계 밖 값은 경계로 캡(winsorize).
   현 데이터 기준 플래그 0건(= 개입 없음). raw 스케일·k=1.5·P1/P99 캡은 실수요 오탐으로 기각.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from paths import PROCESSED_DIR

# ── 확정 상수 ──
FIRST_VAL_MONTH = "2025-09"   # 최소 학습 이력 4개월(2025-04~08) 확보 후 검증 시작
VAL_MONTH_MIN_OPEN_DAYS = 10  # 이보다 영업일이 적은 월은 검증 fold로 쓰지 않는다 (2026-02 = 3일 배제)
OUTLIER_K = 3.0               # log1p IQR 계수 — train 구간에만 fit
CORE_LAGS = ["lag1_sales", "roll7_mean", "lag_dow_sales"]  # 선형 모델용 완비 요구 셋


def make_monthly_folds(open_dates: pd.DatetimeIndex) -> list[dict]:
    """월 단위 walk-forward fold. 반환: [{month, train, val}] (train/val = DatetimeIndex)."""
    ym = pd.Series(open_dates.strftime("%Y-%m"), index=open_dates)
    counts = ym.value_counts()
    val_months = sorted(m for m in counts.index
                        if m >= FIRST_VAL_MONTH and counts[m] >= VAL_MONTH_MIN_OPEN_DAYS)
    return [{"month": m,
             "train": open_dates[ym < m],
             "val": open_dates[ym == m]} for m in val_months]


def impute_weather(df: pd.DataFrame) -> tuple[pd.DataFrame, int]:
    """기상 NA 캘린더 선형 보간 (판매 기간 내 강수 1일). 보간 건수 반환."""
    out = df.copy()
    cols = [c for c in ("temp_avg", "temp_min", "temp_max", "temp_range", "precip_mm") if c in out]
    n_before = int(out[cols].isna().sum().sum())
    out[cols] = out[cols].interpolate(method="linear", limit_direction="both")
    return out, n_before


def impute_floating(df: pd.DataFrame) -> pd.DataFrame:
    """유동인구 전월 값을 ffill로 보간한 floating_prev_ffill(+staleness 개월) 추가.

    원본 floating_prev_m 컬럼은 보존. ffill만 쓰는 이유: 선형 보간은 누락 월의
    다음 달 값(예측 시점 미확정)을 참조하므로 누수. 현 데이터에서 staleness ≤ 1개월.
    """
    pop = pd.read_csv(PROCESSED_DIR / "population_monthly.csv")
    jc = pop[pop["dong"] == "조치원읍"].set_index("month")["floating_pop"]
    months = pd.period_range("2025-01", jc.index.max(), freq="M").strftime("%Y-%m")
    s = jc.reindex(months)
    ff = s.ffill()
    stale = s.isna().astype(int).groupby(s.notna().cumsum()).cumsum()
    prev = (df.index.to_period("M") - 1).strftime("%Y-%m")
    out = df.copy()
    out["floating_prev_ffill"] = pd.Series(prev, index=df.index).map(ff)
    out["floating_prev_stale"] = pd.Series(prev, index=df.index).map(
        pd.Series(stale.values, index=months)).fillna(0).astype(int)
    return out


def outlier_bounds(train_target: pd.Series, k: float = OUTLIER_K) -> tuple[float, float]:
    """train 구간 원 단위 타깃 → log1p IQR k 경계(원 단위로 환원해 반환)."""
    z = np.log1p(train_target)
    q1, q3 = z.quantile([0.25, 0.75])
    iqr = q3 - q1
    return float(np.expm1(q1 - k * iqr)), float(np.expm1(q3 + k * iqr))


def winsorize_target(target: pd.Series, bounds: tuple[float, float]) -> pd.Series:
    """train-fit 경계로 캡. 현 데이터 기준 변화 0건 — 재학습 대비 절차로 유지."""
    return target.clip(lower=bounds[0], upper=bounds[1])


def linear_model_mask(df: pd.DataFrame) -> pd.Series:
    """선형·통계 모델용 행 필터 — core lag 완비 (트리 모델은 필터 없이 NaN 네이티브)."""
    return df[CORE_LAGS].notna().all(axis=1)


def main() -> int:
    df = pd.read_parquet(PROCESSED_DIR / "features_daily.parquet").set_index("date")
    ob = df[df["is_open"]]

    folds = make_monthly_folds(ob.index)
    print(f"fold {len(folds)}개 (검증 월: {', '.join(f['month'] for f in folds)})")
    for f in folds:
        print(f"  {f['month']}: train {len(f['train'])}일 / val {len(f['val'])}일")

    _, n_wx = impute_weather(df)
    imp = impute_floating(ob)
    print(f"기상 보간 {n_wx}건 | floating ffill staleness 최대 {int(imp['floating_prev_stale'].max())}개월")

    bounds = outlier_bounds(ob.loc[:folds[-1]['train'].max(), 'total_amount'])
    capped = int(((ob['total_amount'] < bounds[0]) | (ob['total_amount'] > bounds[1])).sum())
    print(f"이상치 경계(최종 fold train fit): {bounds[0]:,.0f} ~ {bounds[1]:,.0f} → 캡 {capped}건")
    print(f"선형 모델용 완비 행: {int(linear_model_mask(ob).sum())}/{len(ob)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
