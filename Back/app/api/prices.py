"""/api/prices — 홈 화면 "실시간 최저가 추천" (KAMIS 연동)."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.api.deps import CurrentUserDep, require_business_access
from app.integrations import kamis
from app.schemas.prices import IngredientPriceResponse

router = APIRouter(
    prefix="/api/prices", tags=["prices"], dependencies=[Depends(require_business_access)]
)


@router.get("/ingredients", response_model=list[IngredientPriceResponse])
async def get_ingredient_prices(current: CurrentUserDep) -> list[IngredientPriceResponse]:
    """식당에서 자주 쓰는 식자재 소매가 — KAMIS 오픈API(키 미설정 시 샘플 데이터)."""
    prices = await kamis.get_ingredient_prices()
    return [
        IngredientPriceResponse(
            item_name=p.item_name,
            price=p.price,
            unit=p.unit,
            direction=p.direction.value,
            change_percent=p.change_percent,
        )
        for p in prices
    ]
