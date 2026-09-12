"""M7.A1 골격 검증 — OpenAPI 노출 + 계약 경로 + stub 동작 (07_api_spec.md §8)."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import create_app

client = TestClient(create_app())

SPEC_PATHS = {
    "/ai/health": "get",
    "/ai/forecast/predict": "post",
    "/ai/forecast/train": "post",
    "/ai/forecast/status": "get",
    "/ai/orders/recommend": "post",
}


def test_openapi_exposes_all_spec_paths():
    spec = client.get("/openapi.json").json()
    for path, method in SPEC_PATHS.items():
        assert path in spec["paths"], path
        assert method in spec["paths"][path], (path, method)


def test_health_matches_spec_shape():
    r = client.get("/ai/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["model_loaded"] is True  # M7.A6 — 서빙 스택 자가 점검 통과
    assert body["last_trained_at"] is None  # stateless MVP — M7.A5 [2단계]에서 채움
    comps = body["components"]
    assert set(comps) == {"serving_stack", "academic_calendar", "holidays"}
    assert comps["serving_stack"]["status"] == "ok"
    assert comps["academic_calendar"]["stale"] is False  # 내장 학사 지식 커버리지 유효
    assert comps["holidays"]["status"] == "ok"


def test_unimplemented_endpoints_return_501():
    assert client.get("/ai/forecast/status", params={"job_id": "u"}).status_code == 501
    train_body = {"store_id": "u", "training_data": []}
    assert client.post("/ai/forecast/train", json=train_body).status_code == 501


def test_predict_validates_request_schema():
    r = client.post("/ai/forecast/predict", json={"store_id": "u"})  # 필수 필드 누락
    assert r.status_code == 422


def test_recommend_validates_request_schema():
    # 구 계약(forecast_results 입력)은 v2에서 폐기 — 필수 필드 누락 시 422
    old_body = {"store_id": "u", "target_date": "2026-05-07",
                "forecast_results": [], "recipes": [], "inventory": []}
    assert client.post("/ai/orders/recommend", json=old_body).status_code == 422
