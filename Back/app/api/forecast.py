"""/api/forecast — AI 서버 연동 수요예측·발주추천 (api_spec.md §8 BE 프록시)."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUserDep, SessionDep
from app.models.inventory_item import InventoryItem
from app.models.menu import Menu
from app.schemas.forecast import AIRecommendResponse, ForecastPredictResponse
from app.services.forecast_service import ForecastService
from app.services.store_service import StoreService

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


async def _store_id(session, user_id: str) -> str:
    return (await StoreService(session).get_store(user_id)).store_id


@router.get("/predict", response_model=ForecastPredictResponse)
async def predict(session: SessionDep, current: CurrentUserDep) -> ForecastPredictResponse:
    store_id = await _store_id(session, current.user_id)
    result = await ForecastService(session).predict(store_id=store_id)
    return ForecastPredictResponse(predictions=result["predictions"])


@router.get("/recommend", response_model=AIRecommendResponse)
async def recommend(session: SessionDep, current: CurrentUserDep) -> AIRecommendResponse:
    store_id = await _store_id(session, current.user_id)
    result = await ForecastService(session).recommend(store_id=store_id)

    menu_names = dict(
        (await session.execute(select(Menu.menu_id, Menu.name).where(Menu.store_id == store_id))).all()
    )
    item_rows = (
        await session.execute(
            select(InventoryItem.item_id, InventoryItem.name, InventoryItem.unit)
            .where(InventoryItem.store_id == store_id)
        )
    ).all()
    item_info = {item_id: (name, unit) for item_id, name, unit in item_rows}

    return AIRecommendResponse(
        target_dates=result["target_dates"],
        is_low_confidence=result["is_low_confidence"],
        low_confidence_reason=result.get("low_confidence_reason"),
        menu_forecast=[
            {
                "menu_id": m["menu_id"],
                "menu_name": menu_names.get(m["menu_id"], "알 수 없음"),
                "expected_quantity": m["expected_quantity"],
            }
            for m in result["menu_forecast"]
        ],
        recommendations=[
            {
                "item_id": r["item_id"],
                "item_name": item_info.get(r["item_id"], ("알 수 없음", ""))[0],
                "unit": item_info.get(r["item_id"], ("", ""))[1],
                "recommended_quantity": r["recommended_quantity"],
                "expected_stockout_date": r.get("expected_stockout_date"),
                "lead_time_days": r["lead_time_days"],
                "safety_stock": r["safety_stock"],
                "config_status": r["config_status"],
                "recommendation_reason": r["recommendation_reason"],
            }
            for r in result["recommendations"]
        ],
    )
