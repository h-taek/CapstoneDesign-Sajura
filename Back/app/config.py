"""Application settings — pydantic-settings + .env.

Spec: docs/spec/09_service_design.md §1 (pydantic-settings),
      §10.2 CORS / §10.3 TrustedHost / §11.2 환경 분리.
"""
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # Application
    APP_ENV: Literal["development", "staging", "production"] = "development"
    APP_NAME: str = "sajura-be"
    LOG_LEVEL: str = "INFO"

    # Database (MySQL)
    DB_HOST: str
    DB_PORT: int = 3306
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: str

    # Redis
    REDIS_HOST: str = "redis"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0

    # OAuth (Authlib)
    KAKAO_CLIENT_ID: str = ""
    KAKAO_CLIENT_SECRET: str = ""
    KAKAO_REDIRECT_URI: str = ""
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""

    # JWT (python-jose)
    JWT_SECRET: str = "change_me_jwt_secret"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_TTL_SECONDS: int = 900
    JWT_REFRESH_TOKEN_TTL_SECONDS: int = 60 * 60 * 24 * 30

    # AES-256-GCM (12_security.md §4.1, pos_connections.api_key)
    AES_GCM_KEY_BASE64: str = ""

    # VAPID (pywebpush, 08_schema.md §3.23)
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_SUBJECT: str = "mailto:ops@example.com"

    # Sentry
    SENTRY_DSN: str = ""
    SENTRY_ENVIRONMENT: str = "development"
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_RELEASE: str = ""

    # External
    AI_SERVER_BASE_URL: str = "http://ai:8001"  # docker-compose 서비스명 = ai
    N8N_BASE_URL: str = "http://n8n:5678"

    # 국세청 사업자등록 조회 (M3.B3)
    NTS_API_BASE_URL: str = "https://api.odcloud.kr/api/nts-businessman/v1"
    NTS_API_SERVICE_KEY: str = ""
    NTS_API_STUB_MODE: bool = True
    # 시연/테스트용 강제 패스 코드 (12_security.md §2.4). 빈 값이면 비활성(운영 기본).
    NTS_MASTER_BYPASS_CODE: str = ""

    # KAMIS(한국농수산식품유통공사) 농산물 가격정보 오픈API — 홈 화면 "실시간 최저가 추천".
    # 키 미설정 또는 STUB_MODE=true 시 샘플 데이터 반환(NTS 어댑터와 동일 패턴).
    KAMIS_API_BASE_URL: str = "http://www.kamis.or.kr/service/price/xml.do"
    KAMIS_API_CERT_KEY: str = ""
    KAMIS_API_CERT_ID: str = ""
    KAMIS_API_STUB_MODE: bool = True

    # 사업자등록증 업로드 저장 (12_security.md §4.2) — be 컨테이너 볼륨 마운트 경로
    UPLOAD_DIR: str = "/app/uploads"
    UPLOAD_MAX_BYTES: int = 10 * 1024 * 1024  # 10MB

    # Middleware policy (09_service_design.md §10)
    CORS_ALLOW_ORIGINS: str = "http://localhost:5173"
    TRUSTED_HOSTS: str = "localhost,be"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ALLOW_ORIGINS.split(",") if o.strip()]

    @property
    def trusted_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.TRUSTED_HOSTS.split(",") if h.strip()]

    @property
    def database_url_async(self) -> str:
        # SQLAlchemy 2.x async + aiomysql (09_service_design.md §1)
        return (
            f"mysql+aiomysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def database_url_sync(self) -> str:
        # Alembic only — PyMySQL sync driver (09_service_design.md §1)
        return (
            f"mysql+pymysql://{self.DB_USER}:{self.DB_PASSWORD}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}?charset=utf8mb4"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
