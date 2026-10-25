"""Rate Limit — 03_be.md §13.4 (fastapi-limiter + Redis).

키는 접속자 IP + 경로. IP는 uvicorn이 신뢰 프록시(FORWARDED_ALLOW_IPS = Caddy가 있는
Docker 내부 대역)의 X-Forwarded-For를 반영한 request.client.host다. 라이브러리 기본
식별자는 X-Forwarded-For를 검증 없이 믿어 헤더 위조로 우회되므로 쓰지 않는다.
"""
from __future__ import annotations

from math import ceil

from fastapi import Depends, HTTPException, Request, Response
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter
from redis.asyncio import Redis


async def _client_ip(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{request.scope['path']}"


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
