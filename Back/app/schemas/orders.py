"""발주 내역·쿠팡 담기 DTOs — 02_implementation_design.md §3.7."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, field_validator


class OrderSummary(BaseModel):
    order_id: str
    approved_at: datetime
    total_estimated_cost: int
    item_count: int


class OrderListResponse(BaseModel):
    items: list[OrderSummary]
    total: int
    page: int
    size: int
    total_pages: int


class OrderCoupangProduct(BaseModel):
    item_id: str  # 쿠팡 itemId
    product_id: str
    product_name: str
    option_name: str | None
    rocket_fresh: bool


class OrderDetailItem(BaseModel):
    order_item_id: str
    item_id: str
    item_name: str
    final_quantity: float
    unit: str
    unit_price: float | None  # 담기 결과로 계산하지 못했으면 null
    subtotal: int | None
    receipt_status: str
    coupang_product: OrderCoupangProduct | None  # 재료에 연결된 공용 쿠팡 상품


class OrderDetailResponse(BaseModel):
    order_id: str
    approved_at: datetime
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


# ---------------------------------------------------------------- 쿠팡 담기 (§3.7)

_DIGITS = r"^\d{1,20}$"


class AutomateItem(BaseModel):
    item_id: str
    final_quantity: Decimal = Field(gt=0, max_digits=10, decimal_places=3)


class AutomateStartRequest(BaseModel):
    recommendation_id: str | None = None
    items: list[AutomateItem] = Field(min_length=1)
    note: str | None = Field(default=None, max_length=500)
    coupang_logged_in: bool

    @field_validator("items")
    @classmethod
    def _unique_items(cls, v: list[AutomateItem]) -> list[AutomateItem]:
        if len({i.item_id for i in v}) != len(v):
            raise ValueError("같은 재료가 중복되었습니다.")
        return v


class AutomateTarget(BaseModel):
    item_id: str
    item_name: str


class AutomateStartResponse(BaseModel):
    run_id: str
    targets: list[AutomateTarget]


class PageElement(BaseModel):
    """요소 목록의 요소 하나 (04_fe.md §12.4)."""

    ref: str = Field(max_length=20)
    role: str = Field(max_length=30)
    text: str
    depth: int = Field(ge=0)
    product_id: str | None = Field(default=None, pattern=_DIGITS)
    item_id: str | None = Field(default=None, pattern=_DIGITS)
    vendor_item_id: str | None = Field(default=None, pattern=_DIGITS)
    non_wow_price: int | None = Field(default=None, gt=0)  # 상품 페이지의 비회원 가격


class ElementsResult(BaseModel):
    kind: Literal["elements"]
    url: str = Field(max_length=2000)
    elements: list[PageElement]


class CartAdded(BaseModel):
    """상품 페이지에서 담기 완료 표시가 나타났을 때의 담기 결과."""

    item_id: str = Field(pattern=_DIGITS)
    product_id: str = Field(pattern=_DIGITS)
    vendor_item_id: str | None = Field(default=None, pattern=_DIGITS)  # 없을 수 있다
    price: int = Field(gt=0)  # 그 상품 페이지의 표시 가격(원)


class ActionResult(BaseModel):
    kind: Literal["action"]
    ok: bool
    page_changed: bool
    message: str | None = Field(default=None, max_length=200)
    cart_added: CartAdded | None = None


StepResult = Annotated[ElementsResult | ActionResult, Field(discriminator="kind")]


class NonWowPrice(BaseModel):
    """확장이 뒤에서 받은 와우 할인 카드의 비회원 가격 (04_fe.md §12.5)."""

    item_id: str = Field(pattern=_DIGITS)
    non_wow_price: int = Field(gt=0)
    display_price: int = Field(gt=0)  # 그 카드의 화면 표시 가격 — 단위가격 대조용
    unit_price_text: str | None = Field(default=None, max_length=50)


class AutomateStepRequest(BaseModel):
    target: str  # 품목 item_id 또는 "cart_check"
    result: StepResult | None = None  # 새 대화면 null
    non_wow_prices: list[NonWowPrice] = Field(default_factory=list)


class AgentCall(BaseModel):
    tool: str
    args: dict[str, Any]


class AutomateStepAction(BaseModel):
    action: AgentCall


class AutomateStepDone(BaseModel):
    done: AgentCall


class AutomateFinishRequest(BaseModel):
    non_wow_prices: list[NonWowPrice] = Field(default_factory=list)


class AutomateItemResult(BaseModel):
    item_id: str
    status: Literal["ADDED", "CHECK_NEEDED", "FAILED"]
    reason: str | None  # 담지 못한 사유(에이전트의 finish_item). 없으면 null


class AutomateFinishResponse(BaseModel):
    order_id: str | None  # 담긴 품목이 없으면 null
    approved_at: datetime
    total_estimated_cost: int
    manual_guide_url: str | None  # 실패 품목이 있으면 쿠팡 첫 화면
    items: list[AutomateItemResult]
