"""Rate Limit — 03_be.md §13.4 (fastapi-limiter + Redis).

키는 접속자 IP + 경로. IP는 uvicorn이 신뢰 프록시(FORWARDED_ALLOW_IPS = Caddy 고정 IP)의
X-Forwarded-For를 반영한 request.client.host다. 라이브러리 기본
식별자는 X-Forwarded-For를 검증 없이 믿어 헤더 위조로 우회되므로 쓰지 않는다.
"""
from __future__ import annotations

from math import ceil

from fastapi import Depends, HTTPException, Request, Response
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from jose import JWTError
from redis.asyncio import Redis

from app.core import security


async def _client_ip(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{request.scope['path']}"


async def _user_id(request: Request) -> str:
    """토큰의 사용자(sub) + 경로. 토큰이 없거나 깨졌으면 IP로 — 그런 요청은 인증에서 401이다."""
    authorization = request.headers.get("authorization", "")
    if authorization.lower().startswith("bearer "):
        try:
            sub = security.decode_access_token(authorization.split(" ", 1)[1].strip()).get("sub")
        except JWTError:
            sub = None
        if isinstance(sub, str):
            return f"user:{sub}:{request.scope['path']}"
    return await _client_ip(request)


async def _too_many_requests(request: Request, response: Response, pexpire: int) -> None:
    raise HTTPException(
        status_code=429,
        detail={
            "error": "TOO_MANY_REQUESTS",
            "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            "detail": None,
        },
        headers={"Retry-After": str(ceil(pexpire / 1000))},
    )


async def init_rate_limit(redis: Redis) -> None:
    await FastAPILimiter.init(redis, identifier=_client_ip, http_callback=_too_many_requests)


# 로그인·회원가입 IP당 5/min, refresh 30/min
CREDENTIAL_LIMIT = Depends(RateLimiter(times=5, minutes=1))
REFRESH_LIMIT = Depends(RateLimiter(times=30, minutes=1))
# 알림 목록 사용자당 60/min, 푸시 구독 등록 10/min
NOTIFICATION_LIST_LIMIT = Depends(RateLimiter(times=60, minutes=1, identifier=_user_id))
NOTIFICATION_SUBSCRIBE_LIMIT = Depends(RateLimiter(times=10, minutes=1, identifier=_user_id))
