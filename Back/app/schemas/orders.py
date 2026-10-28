"""발주 확정·내역 DTOs — 02_implementation_design.md §3.7."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.types import JsonDecimal


class OrderApproveItem(BaseModel):
    item_id: str
    final_quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=3)


class OrderApproveRequest(BaseModel):
    recommendation_id: str | None = None
    items: list[OrderApproveItem] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=500)

    @field_validator("items")
    @classmethod
    def _unique_items(cls, v: list[OrderApproveItem]) -> list[OrderApproveItem]:
        if len({i.item_id for i in v}) != len(v):
            raise ValueError("같은 재료가 중복되었습니다.")
        return v


class OrderApproveResponse(BaseModel):
    order_id: str
    approved_at: datetime
    total_estimated_cost: int
    status: str


class OrderSummary(OrderApproveResponse):
    item_count: int


class OrderListResponse(BaseModel):
    items: list[OrderSummary]
    total: int
    page: int
    size: int
    total_pages: int


class OrderCoupangProduct(BaseModel):
    product_id: str
    vendor_item_id: str
    product_name: str
    rocket_fresh: bool  # 비로그인이면 확장이 이 품목도 검색한다


class OrderDetailItem(BaseModel):
    order_item_id: str
    item_id: str
    item_name: str
    final_quantity: float
    unit: str
    unit_price: float | None  # 확정 시 단가 미설정이면 null
    subtotal: int | None
    receipt_status: str
    coupang_search_required: bool  # 자동 담기 때 쿠팡 검색이 필요한지 (01_basic_design.md §3.8.1)
    coupang_product: OrderCoupangProduct | None  # 재료에 연결된 공용 쿠팡 상품


class OrderDetailResponse(BaseModel):
    order_id: str
    approved_at: datetime
    status: str
    total_estimated_cost: int
    note: str | None
    items: list[OrderDetailItem]


class ApprovalLogItem(BaseModel):
    item_id: str
    item_name: str
    recommended_quantity: float
    final_quantity: float
    unit: str
    was_modified: bool


class ApprovalLogResponse(BaseModel):
    order_id: str
    items: list[ApprovalLogItem]


# ---------------------------------------------------------------- 쿠팡 자동 담기 (§3.7)

_DIGITS = r"^\d{1,20}$"
MAX_RESULTS_PER_ITEM = 60


class CoupangSearchResult(BaseModel):
    """확장이 검색 결과 카드에서 읽은 값 (04_fe.md §12.4 허용 필드)."""

    product_id: str = Field(pattern=_DIGITS)
    vendor_item_id: str = Field(pattern=_DIGITS)
    product_name: str = Field(min_length=1, max_length=300)
    display_price: int = Field(gt=0)
    discount_label: str | None = Field(default=None, max_length=50)
    unit_price_text: str | None = Field(default=None, max_length=50)
    rocket_fresh: bool
    rating: float | None = Field(default=None, ge=0, le=5)
    review_count: int | None = Field(default=None, ge=0)

    @field_validator("rating")
    @classmethod
    def _half_step(cls, v: float | None) -> float | None:
        if v is not None and (v * 2) != int(v * 2):
            raise ValueError("별점은 0.5 단위입니다.")
        return v


class MatchCandidate(BaseModel):
    item_id: str
    results: list[CoupangSearchResult] = Field(max_length=MAX_RESULTS_PER_ITEM)


class MatchRequest(BaseModel):
    coupang_logged_in: bool
    candidates: list[MatchCandidate]

    @field_validator("candidates")
    @classmethod
    def _unique_items(cls, v: list[MatchCandidate]) -> list[MatchCandidate]:
        if len({c.item_id for c in v}) != len(v):
            raise ValueError("같은 품목이 중복되었습니다.")
        return v


class MatchSelected(BaseModel):
    product_id: str
    vendor_item_id: str
    quantity: int  # 담을 상품 개수 — 서버가 발주 수량 ÷ 포장 수량을 올림
    pack_quantity: JsonDecimal | None  # LLM 판정 포장 수량. 단위가격 표시로 용량이 계산되면 null
    reason: str


class MatchSelection(BaseModel):
    item_id: str
    selected: MatchSelected | None


class MatchResponse(BaseModel):
    selections: list[MatchSelection]


class AutomationSucceeded(BaseModel):
    item_id: str
    product_id: str = Field(pattern=_DIGITS)
    vendor_item_id: str = Field(pattern=_DIGITS)
    product_name: str = Field(min_length=1, max_length=300)
    display_price: int = Field(gt=0)
    discount_label: str | None = Field(default=None, max_length=50)
    unit_price_text: str | None = Field(default=None, max_length=50)
    rocket_fresh: bool
    pack_quantity: JsonDecimal | None = Field(default=None, gt=0)  # match 응답 값 그대로
    searched: bool  # 이번에 검색으로 고른 상품이면 true


class AutomationFailed(BaseModel):
    item_id: str
    reason: Literal["NO_RESULT", "SELECTOR_MISMATCH", "TIMEOUT", "EXTENSION_UNAVAILABLE"]


class AutomationResultRequest(BaseModel):
    succeeded: list[AutomationSucceeded] = Field(default_factory=list)
    failed: list[AutomationFailed] = Field(default_factory=list)

    @model_validator(mode="after")
    def _unique_items(self) -> AutomationResultRequest:
        ids = [s.item_id for s in self.succeeded] + [f.item_id for f in self.failed]
        if len(set(ids)) != len(ids):
            raise ValueError("같은 품목이 중복되었습니다.")
        return self


class AutomationResultResponse(BaseModel):
    order_id: str
    status: str  # AUTOMATED | MANUAL_REQUIRED
    automated_at: datetime
    manual_guide_url: str | None  # MANUAL_REQUIRED일 때 쿠팡 링크
