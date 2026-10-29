"""도구와 인자 검사 — 03_be.md §2.4.4·§2.4.6.

인자가 스키마에 맞지 않으면 응답 형식 오류(같은 요청을 다시 보냄)다. 글자 인자는 오류로 보지 않고
길이를 자른다.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, field_validator

PRODUCT_URL_PREFIX = "https://www.coupang.com/vp/products/"
TEXT_MAX = 50
REASON_MAX = 200


class _Args(BaseModel):
    model_config = ConfigDict(extra="ignore", coerce_numbers_to_str=True)


class NoArgs(_Args):
    pass


class RefArgs(_Args):
    ref: str


class TypeTextArgs(_Args):
    ref: str
    text: str

    @field_validator("text")
    @classmethod
    def _cut(cls, v: str) -> str:
        return v[:TEXT_MAX]


class ScrollArgs(_Args):
    direction: Literal["up", "down"]


class OpenUrlArgs(_Args):
    url: str

    @field_validator("url")
    @classmethod
    def _product_page(cls, v: str) -> str:
        if not v.startswith(PRODUCT_URL_PREFIX):
            raise ValueError("쿠팡 상품 페이지 주소가 아니다")
        return v


class FinishItemArgs(_Args):
    reason: str

    @field_validator("reason")
    @classmethod
    def _cut(cls, v: str) -> str:
        return v[:REASON_MAX]


class CartCheckEntry(_Args):
    item_id: str
    status: Literal["OK", "CHECK_NEEDED"]


class FinishCartCheckArgs(_Args):
    items: list[CartCheckEntry]


class KeepArgs(_Args):
    refs: list[str]


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    properties: dict[str, Any]
    args: type[_Args]

    def spec(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": {
                    "type": "object",
                    "properties": self.properties,
                    "required": list(self.properties),
                    "additionalProperties": False,
                },
            },
        }


_REF = {"type": "string", "description": "요소 번호"}

READ_ELEMENTS = Tool("read_elements", "지금 쿠팡 화면의 요소 목록을 본다.", {}, NoArgs)
CLICK = Tool("click", "요소를 누른다.", {"ref": _REF}, RefArgs)
TYPE_TEXT = Tool(
    "type_text",
    "입력칸에 글자를 넣는다.",
    {"ref": _REF, "text": {"type": "string", "maxLength": TEXT_MAX}},
    TypeTextArgs,
)
SCROLL = Tool(
    "scroll", "화면을 내리거나 올린다.",
    {"direction": {"type": "string", "enum": ["up", "down"]}}, ScrollArgs,
)
OPEN_URL = Tool(
    "open_url",
    f"작업 탭에서 쿠팡 상품 페이지 주소를 연다. {PRODUCT_URL_PREFIX}로 시작하는 주소만 쓴다.",
    {"url": {"type": "string"}},
    OpenUrlArgs,
)
FINISH_ITEM = Tool(
    "finish_item",
    "품목을 담지 못했을 때 대화를 끝낸다. 담기에 성공하면 쓰지 않는다.",
    {"reason": {"type": "string", "maxLength": REASON_MAX, "description": "담지 못한 사유"}},
    FinishItemArgs,
)
FINISH_CART_CHECK = Tool(
    "finish_cart_check",
    "장바구니 검수를 끝낸다. 품목마다 결과를 답한다.",
    {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string"},
                    "status": {"type": "string", "enum": ["OK", "CHECK_NEEDED"]},
                },
                "required": ["item_id", "status"],
                "additionalProperties": False,
            },
        }
    },
    FinishCartCheckArgs,
)
KEEP_CANDIDATES = Tool(
    "keep_candidates",
    "재료와 같은 식자재로 남길 후보 번호를 답한다.",
    {"refs": {"type": "array", "items": {"type": "string"}}},
    KeepArgs,
)

_ACTIONS = (READ_ELEMENTS, CLICK, TYPE_TEXT, SCROLL, OPEN_URL)
DONE_TOOLS = {FINISH_ITEM.name, FINISH_CART_CHECK.name}


def tools_for(kind: str) -> dict[str, Tool]:
    """대화 종류별 도구 — 품목은 finish_item, 장바구니 검수는 finish_cart_check."""
    done = FINISH_ITEM if kind == "item" else FINISH_CART_CHECK
    return {t.name: t for t in (*_ACTIONS, done)}
