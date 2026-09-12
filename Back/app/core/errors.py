"""도메인 예외 — 09_service_design.md §8 / 07_api_spec.md §1.3."""
from __future__ import annotations

from typing import Any

from fastapi import HTTPException


class DomainError(HTTPException):
    def __init__(self, *, status_code: int, error_code: str, message: str, detail: Any = None) -> None:
        super().__init__(
            status_code=status_code,
            detail={"error": error_code, "message": message, "detail": detail},
        )


def unauthorized(message: str = "인증이 필요합니다.") -> DomainError:
    return DomainError(status_code=401, error_code="UNAUTHORIZED", message=message)


def forbidden(message: str = "권한이 없습니다.") -> DomainError:
    return DomainError(status_code=403, error_code="FORBIDDEN", message=message)


def auth_email_duplicate() -> DomainError:
    return DomainError(status_code=409, error_code="AUTH_EMAIL_DUPLICATE", message="이미 가입된 이메일입니다.")


def auth_invalid_credentials() -> DomainError:
    return DomainError(status_code=401, error_code="AUTH_INVALID_CREDENTIALS", message="이메일 또는 비밀번호가 일치하지 않습니다.")


def auth_invalid_token() -> DomainError:
    return DomainError(status_code=401, error_code="AUTH_INVALID_TOKEN", message="토큰이 유효하지 않습니다.")


def auth_token_expired() -> DomainError:
    return DomainError(status_code=401, error_code="AUTH_TOKEN_EXPIRED", message="토큰이 만료되었습니다.")


def auth_refresh_token_invalid() -> DomainError:
    return DomainError(status_code=401, error_code="AUTH_REFRESH_TOKEN_INVALID", message="Refresh Token이 유효하지 않습니다.")


def state_conflict(message: str = "현재 상태에서는 수행할 수 없습니다.") -> DomainError:
    return DomainError(status_code=409, error_code="STATE_CONFLICT", message=message)


def auth_password_not_allowed() -> DomainError:
    return DomainError(status_code=422, error_code="AUTH_PASSWORD_NOT_ALLOWED", message="소셜 계정은 비밀번호를 변경할 수 없습니다.")
