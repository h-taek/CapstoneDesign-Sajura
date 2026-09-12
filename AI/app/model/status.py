"""서빙 자가 점검 — /ai/health 컴포넌트 상태 (M7.A6).

stateless 설계(predictor.py)에 맞춘 의미 재정의:
- serving_stack : 합성 이력으로 미니 학습·예측 1회(스모크) — 통과 시 model_loaded=True.
  결과는 프로세스 수명 동안 캐시(첫 /ai/health 호출 시 1회 실행, ~수십 ms).
- academic_calendar : 내장 학사 지식의 커버리지 — 오늘이 범위를 벗어나면 stale(=degraded).
  plan의 "외부 데이터 fresh check"의 본 설계식 구현. DB 연결 점검은 해당 없음 —
  AI Server는 DB에 접근하지 않는다(n8n이 조회해 payload로 전달, 04_feature_spec.md §5.1).
- holidays : 공휴일 패키지 동작 확인.
"""
from __future__ import annotations

import datetime as dt
import time

import lightgbm
import pandas as pd

from app.model.features import _academic  # noqa: PLC2701 — 내장 지식 캐시 재사용
from app.model.features import _kr_holidays
from app.model.predictor import SalesForecaster

_WEEKDAY_MULT = [1.0, 0.9, 1.1, 1.6, 1.2, 0.8, 0.6]
_cache: dict[str, dict] = {}


def _selfcheck() -> dict:
    """고정 앵커의 합성 45일 이력으로 fit + D+1 예측 스모크 — 결정적."""
    try:
        t0 = time.time()
        anchor = dt.date(2026, 3, 2)
        rows = [{"date": anchor + dt.timedelta(days=i), "order_count": 8,
                 "total_amount": int(400_000 * _WEEKDAY_MULT[(anchor + dt.timedelta(days=i)).weekday()])}
                for i in range(45)]
        history = pd.DataFrame(rows)
        weather = pd.DataFrame([{"date": r["date"], "temp_min": 5.0, "temp_max": 15.0,
                                 "rainfall_mm": 0.0} for r in rows])
        f = SalesForecaster(history, weather, reopen_date=None)
        f.fit()
        pred = f.predict_one(anchor + dt.timedelta(days=45))
        assert pred["predicted_sales"] > 0
        return {"status": "ok", "elapsed_ms": int((time.time() - t0) * 1000),
                "lightgbm_version": lightgbm.__version__}
    except Exception as exc:  # noqa: BLE001 — 헬스체크는 원인 문자열로 보고
        return {"status": "fail", "detail": f"{type(exc).__name__}: {exc}"}


def _academic_status(today: dt.date) -> dict:
    try:
        coverage_until = _academic()["end_date"].max().date()
        stale = today > coverage_until
        return {"status": "stale" if stale else "ok",
                "coverage_until": coverage_until.isoformat(), "stale": stale}
    except Exception as exc:  # noqa: BLE001
        return {"status": "fail", "detail": f"{type(exc).__name__}: {exc}"}


def _holidays_status(today: dt.date) -> dict:
    try:
        assert len(_kr_holidays(today.year)) > 0
        return {"status": "ok"}
    except Exception as exc:  # noqa: BLE001
        return {"status": "fail", "detail": f"{type(exc).__name__}: {exc}"}


def health_components() -> dict[str, dict]:
    if "serving_stack" not in _cache:  # 스모크는 1회만 — 이후 캐시
        _cache["serving_stack"] = _selfcheck()
    today = dt.date.today()
    return {"serving_stack": _cache["serving_stack"],
            "academic_calendar": _academic_status(today),
            "holidays": _holidays_status(today)}
