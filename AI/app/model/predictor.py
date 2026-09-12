"""V1-t 서빙 — stateless 학습·예측 (11_ai_spec.md §3, 모델 카드: notebooks/05).

설계 (MVP, 야간 배치 1회 호출 전제 — 04_feature_spec.md §5.1):
- 요청 payload의 판매 이력으로 요청 시점에 학습(fit)하고 target_dates를 예측한다.
  256 영업일 × LightGBM(60 iter) ×3(점+P10/P90) ≈ 1~2초 — 별도 모델 저장소 없이 재현 가능.
  주간 재학습·모델 아티팩트 관리(pipeline_jobs)는 M7.A5 [2단계].
- 타깃: log1p(매출) − log1p(직전 7영업일 평균) 편차 — 복원 ŷ = expm1(pred + log1p(roll7_h)).
  워밍업 NaN 라벨은 학습에서 명시 제거(정의의 일부, 04 §3 재현 노트).
- 예측 근거: LightGBM 내장 `pred_contrib`(TreeSHAP 동일값) → top-3 + rule-based 문장 (11_ai_spec.md §8).
- 신뢰도: 04_feature_spec.md §5.3 트리거 — SHORT_HISTORY·MISSING_FEATURES·SPECIAL_DAY·LONG_HORIZON·
  WIDE_INTERVAL(θ = train in-sample 폭 P80). DRIFT는 운영 배치 몫(11_ai_spec.md §10).
"""
from __future__ import annotations

import datetime as dt
import math

import lightgbm as lgb
import numpy as np
import pandas as pd

from app.model.features import CORE_LAG_COLUMNS, FEATURE_COLUMNS, build_row, is_holiday

# 05 모델 카드 확정값(Optuna·선택 fold)의 네이티브 API 표기 — n_estimators는 best_iteration 중앙값(53) 근거.
# sklearn 래퍼의 subsample은 subsample_freq=0 기본값으로 비활성이었으므로 bagging 미설정이 동일 동작.
V1T_PARAMS = {
    "learning_rate": 0.0257,
    "num_leaves": 9,
    "min_data_in_leaf": 10,
    "feature_fraction": 0.6796,
    "lambda_l1": 0.001,
    "lambda_l2": 0.0,
    "seed": 42,
    "verbosity": -1,
}
N_ESTIMATORS = 60
MIN_OPEN_DAYS = 10          # 이 미만이면 학습 자체 거부(422) — lag·roll 구성 불가
SHORT_HISTORY_DAYS = 60     # 신뢰도 T1
LONG_HORIZON_DAYS = 3       # 신뢰도 T4 — D+3부터 (06 §1: 모델 우위 소멸)
WIDE_INTERVAL_PCTL = 0.80   # 신뢰도 T5 θ

LABELS = {
    "is_holiday": "공휴일", "semester_week": "학기 진행 주차", "is_semester_first2w": "개강 직후 효과",
    "temp_avg": "기온", "temp_range": "일교차", "lag_sales_h": "직전 영업일 매출 흐름",
    "lag_tx_h": "직전 영업일 주문 수", "lag_dow_sales": "지난주 같은 요일 매출",
    "roll7_h": "최근 일주일 매출 수준", "roll4dow_mean": "최근 같은 요일 평균",
    "roll_atv_h": "최근 객단가 흐름", "is_post_renewal": "리뉴얼 이후 체제",
    "days_since_reopen": "재개장 경과",
    **{f"dow_{i}": f"{d}요일 효과" for i, d in enumerate("월화수목금토일")},
}
BASELINE_LABEL = "직전 7영업일 평균"


class SalesForecaster:
    """요청 단위 stateless 예측기 — fit() 후 predict_one()."""

    def __init__(self, history: pd.DataFrame, weather: pd.DataFrame,
                 reopen_date: dt.date | None) -> None:
        """history: date·total_amount·order_count (일계), weather: date·temp_min·temp_max."""
        h = history.sort_values("date")
        opened = h[h["total_amount"] > 0]
        self.open_sales = pd.Series(opened["total_amount"].values,
                                    index=pd.DatetimeIndex(opened["date"]), dtype=float)
        self.open_tx = pd.Series(opened["order_count"].values,
                                 index=pd.DatetimeIndex(opened["date"]), dtype=float)
        self.weather = weather.copy()
        self.weather["date"] = pd.to_datetime(self.weather["date"])
        self.reopen_date = reopen_date
        self.n_open = len(self.open_sales)
        self.last_open_date: dt.date | None = (
            self.open_sales.index.max().date() if self.n_open else None)
        self.models: dict[str, lgb.Booster] = {}
        self.width_theta = math.inf

    # ── 학습 ──────────────────────────────────────────────
    def fit(self) -> None:
        rows, targets = [], []
        for i in range(1, self.n_open):  # 각 과거 영업일을 h=1 관점으로 — prefix만 사용(누수 방지)
            day = self.open_sales.index[i].date()
            row = build_row(self.open_sales.iloc[:i], self.open_tx.iloc[:i],
                            self.weather, day, h=1, reopen_date=self.reopen_date)
            r7 = row["roll7_h"].iloc[0]
            if not np.isfinite(r7):  # 워밍업 — 비율 타깃 라벨 NaN은 명시 제거
                continue
            rows.append(row)
            targets.append(math.log1p(self.open_sales.iloc[i]) - math.log1p(r7))
        X = pd.concat(rows)
        y = pd.Series(targets, index=X.index)

        specs = {"point": {"objective": "regression"},
                 "p10": {"objective": "quantile", "alpha": 0.10},
                 "p90": {"objective": "quantile", "alpha": 0.90}}
        for name, extra in specs.items():
            params = {**V1T_PARAMS, **extra}
            self.models[name] = lgb.train(params, lgb.Dataset(X, label=y),
                                          num_boost_round=N_ESTIMATORS)

        # 신뢰도 T5 임계 θ — train 구간 in-sample 상대 폭의 P80 (04_feature_spec.md §5.3)
        lo = np.expm1(self.models["p10"].predict(X) + np.log1p(X["roll7_h"].values))
        hi = np.expm1(self.models["p90"].predict(X) + np.log1p(X["roll7_h"].values))
        widths = np.abs(hi - lo) / X["roll7_h"].values
        self.width_theta = float(np.quantile(widths, WIDE_INTERVAL_PCTL))

    # ── 예측 ──────────────────────────────────────────────
    def predict_one(self, target_date: dt.date) -> dict:
        horizon = (target_date - self.last_open_date).days if self.last_open_date else 99
        X = build_row(self.open_sales, self.open_tx, self.weather, target_date,
                      h=max(horizon, 1), reopen_date=self.reopen_date)
        r7 = float(X["roll7_h"].iloc[0])

        preds = {}
        for name, m in self.models.items():
            raw = float(m.predict(X.values)[0])
            preds[name] = float(np.expm1(raw + np.log1p(r7))) if np.isfinite(r7) else float("nan")
        point = preds["point"]
        lo, hi = sorted((preds["p10"], preds["p90"]))  # 분위 교차 시 정렬 (08 §2)

        contrib = self.models["point"].predict(X.values, pred_contrib=True)[0]
        phi = pd.Series(contrib[:-1], index=FEATURE_COLUMNS)
        base = float(contrib[-1])
        top = phi.reindex(phi.abs().sort_values(ascending=False).index)[:3]
        deviation = float(np.exp(base + phi.sum()) - 1)
        factors = [{"feature": c, "label": LABELS.get(c, c), "pct": round(float(np.exp(v) - 1), 3)}
                   for c, v in top.items()]
        updown = "높을" if deviation > 0 else "낮을"
        parts = ", ".join(f"{f['label']}({f['pct']:+.0%})" for f in factors)
        sentence = (f"{target_date:%m월 %d일}({'월화수목금토일'[target_date.weekday()]})은 평소보다 "
                    f"약 {abs(deviation):.0%} {updown} 것으로 예상됩니다 — 주요 요인: {parts}.")

        reason = self._confidence_reason(X, target_date, horizon, lo, hi, r7)
        return {
            "target_date": target_date,
            "horizon_days": horizon,
            "predicted_sales": int(round(point)) if np.isfinite(point) else 0,
            "interval_p10": int(round(lo)) if np.isfinite(lo) else 0,
            "interval_p90": int(round(hi)) if np.isfinite(hi) else 0,
            "is_low_confidence": reason is not None,
            "low_confidence_reason": reason,
            "explanation": {"baseline": BASELINE_LABEL,
                            "deviation_vs_baseline": round(deviation, 3),
                            "top_factors": factors, "sentence": sentence},
        }

    def _confidence_reason(self, X: pd.DataFrame, target_date: dt.date, horizon: int,
                           lo: float, hi: float, r7: float) -> str | None:
        """트리거 우선순위 판정 — 04_feature_spec.md §5.3 (T6 DRIFT는 운영 배치 몫)."""
        if self.n_open < SHORT_HISTORY_DAYS:
            return "SHORT_HISTORY"
        if X[CORE_LAG_COLUMNS].isna().any(axis=1).iloc[0]:
            return "MISSING_FEATURES"
        if is_holiday(target_date):
            return "SPECIAL_DAY"
        if horizon >= LONG_HORIZON_DAYS:
            return "LONG_HORIZON"
        if np.isfinite(r7) and r7 > 0 and (hi - lo) / r7 > self.width_theta:
            return "WIDE_INTERVAL"
        return None
