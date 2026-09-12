"""Store DTOs — 07_api_spec.md §3."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

StoreSizeLit = Literal["SMALL", "MEDIUM", "LARGE"]
OperationLit = Literal["HALL", "DELIVERY", "BOTH"]
BusinessStatusLit = Literal["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"]


class StoreResponse(BaseModel):
    store_id: str
    store_name: str | None
    business_no: str | None
    business_status: BusinessStatusLit
    business_reject_reason: str | None
    business_type: str | None
    store_size: StoreSizeLit | None
    operation_type: OperationLit | None
    address: str | None
    phone: str | None
    onboarding_completed: bool
    created_at: datetime


# business_no는 multipart form field로 받는다 (cert 파일과 함께). 라우터에서 Form()으로 파싱.
class BusinessVerifyResponse(BaseModel):
    business_status: BusinessStatusLit
    business_no: str | None


class StoreUpdateRequest(BaseModel):
    store_name: str | None = Field(default=None, min_length=1, max_length=100)
    business_type: str | None = Field(default=None, min_length=1, max_length=50)
    store_size: StoreSizeLit | None = None
    operation_type: OperationLit | None = None
    address: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)


# ── 관리자 심사 (M3.B9, 07_api_spec.md §3 관리자 API) ──
class VerificationItem(BaseModel):
    store_id: str
    user_email: str
    business_no: str | None
    business_status: BusinessStatusLit
    cert_url: str | None
    submitted_at: datetime


class VerificationListResponse(BaseModel):
    items: list[VerificationItem]
    total: int
    page: int
    size: int
    total_pages: int


class RejectRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=255)


class VerificationActionResponse(BaseModel):
    store_id: str
    business_status: BusinessStatusLit
    reason: str | None = None


class OnboardingCompleteResponse(BaseModel):
    onboarding_completed: bool
    store_id: str
