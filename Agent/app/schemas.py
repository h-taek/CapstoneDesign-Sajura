"""요청 형식 — 03_be.md §2.4.5·§2.4.6.

실행 결과는 02_implementation_design.md §3.7 automate/step의 result와 같다.
"""

from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field

_DIGITS = r"^\d{1,20}$"


class PageElement(BaseModel):
    ref: str = Field(max_length=20)
    role: str = Field(max_length=30)
    text: str
    depth: int = Field(ge=0)
    product_id: str | None = Field(default=None, pattern=_DIGITS)
    item_id: str | None = Field(default=None, pattern=_DIGITS)
    vendor_item_id: str | None = Field(default=None, pattern=_DIGITS)
    non_wow_price: int | None = Field(default=None, gt=0)


class ElementsResult(BaseModel):
    kind: Literal["elements"]
    url: str = Field(max_length=2000)
    elements: list[PageElement]


class ActionResult(BaseModel):
    kind: Literal["action"]
    ok: bool
    page_changed: bool
    message: str | None = Field(default=None, max_length=200)


StepResult = Annotated[ElementsResult | ActionResult, Field(discriminator="kind")]


class StepRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=64)
    kind: Literal["item", "cart_check"]  # 대화 종류 — 새 대화에서 쓸 도구를 정한다
    store_id: str = Field(min_length=1, max_length=64)
    order_id: str = Field(min_length=1, max_length=64)
    instruction: str | None = None  # 새 대화의 고정 지시문 — 서버가 쓴 글, 매장 데이터 없음
    # 새 대화의 발주 데이터 — DB 값. 분류기는 이것과 확장의 실행 결과만 본다
    order: str | None = Field(default=None, max_length=20_000)
    result: StepResult | None = None  # 직전 실행 결과. 새 대화면 null


class Ingredient(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    unit: str = Field(min_length=1, max_length=10)


class Candidate(BaseModel):
    ref: str = Field(min_length=1, max_length=20)
    product_name: str = Field(max_length=500)
    option_name: str | None = Field(default=None, max_length=500)


class FilterRequest(BaseModel):
    store_id: str = Field(min_length=1, max_length=64)
    ingredient: Ingredient
    candidates: list[Candidate] = Field(max_length=50)
