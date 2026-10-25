"""스키마 공용 타입."""

from __future__ import annotations

from decimal import Decimal
from typing import Annotated

from pydantic import PlainSerializer

# 수량 소수 — 검증·계산은 Decimal, JSON 응답은 숫자 (02_implementation_design.md §3 예시)
JsonDecimal = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]
