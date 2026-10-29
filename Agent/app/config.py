"""환경변수 — 03_be.md §2.4·§2.4.3. 설정 변경은 재시작으로 반영한다."""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # 에이전트 LLM (§2.4) — openai_compatible 어댑터
    LLM_MODEL: str = ""
    LLM_API_KEY: str = ""  # 키가 필요 없는 로컬 서버는 빈 값
    LLM_BASE_URL: str = ""  # 비우면 OpenAI API
    LLM_REASONING_EFFORT: str = ""  # 비우면 보내지 않는다

    # 보안 분류기 (§2.4.3)
    LLM_GUARD_ENABLED: bool = False
    LLM_GUARD_ADAPTER: Literal["openai_chat"] = "openai_chat"
    LLM_GUARD_BASE_URL: str = ""
    LLM_GUARD_MODEL: str = ""

    @model_validator(mode="after")
    def _guard_configured(self) -> Settings:
        # 켜졌는데 주소나 모델이 비면 에이전트 서버가 시작하지 않는다
        if self.LLM_GUARD_ENABLED and not (self.LLM_GUARD_BASE_URL and self.LLM_GUARD_MODEL):
            raise ValueError(
                "LLM_GUARD_ENABLED=true면 LLM_GUARD_BASE_URL·LLM_GUARD_MODEL이 필요하다"
            )
        return self

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


@lru_cache
def get_settings() -> Settings:
    return Settings()
