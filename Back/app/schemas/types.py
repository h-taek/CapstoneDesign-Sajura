"""스키마 공용 타입."""

from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, PlainSerializer

# 수량 소수 — 검증·계산은 Decimal, JSON 응답은 숫자 (02_implementation_design.md §3 예시)
JsonDecimal = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


def _as_utc(v: datetime) -> datetime:
    return v if v.tzinfo else v.replace(tzinfo=UTC)


# DB에 UTC로 저장한 시각 — 시간대 없이 읽히므로 UTC를 붙여 JSON에 "Z"로 낸다
UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]
