"""오류 응답 — BE와 같은 형식 {error, message, detail}.

BE가 그대로 PWA에 돌려준다 (03_be.md §2.4.5).
"""

from __future__ import annotations

from typing import Any


class AgentError(Exception):
    def __init__(self, status_code: int, error: str, message: str, detail: Any = None) -> None:
        super().__init__(f"{status_code} {error}")
        self.status_code = status_code
        self.error = error
        self.message = message
        self.detail = detail

    def body(self) -> dict[str, Any]:
        return {"error": self.error, "message": self.message, "detail": self.detail}


def validation_error(message: str) -> AgentError:
    return AgentError(400, "VALIDATION_ERROR", message)


def quota_exceeded() -> AgentError:
    return AgentError(
        429, "ORDER_LLM_QUOTA_EXCEEDED",
        "자동 담기 호출 횟수를 넘었습니다. 쿠팡에서 직접 담아 주세요.",
    )


def guard_rejected(reason: str) -> AgentError:
    return AgentError(
        422, "ORDER_LLM_GUARD_REJECTED", "보안 검사에서 요청이 거부되었습니다.",
        {"reason": reason},
    )


def unavailable() -> AgentError:
    return AgentError(
        503, "ORDER_LLM_UNAVAILABLE",
        "담기 에이전트를 지금 쓸 수 없습니다. 쿠팡에서 직접 담아 주세요.",
    )
