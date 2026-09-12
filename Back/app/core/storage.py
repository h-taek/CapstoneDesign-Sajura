"""사업자등록증 파일 저장 — 12_security.md §4.2.

서버 볼륨(UPLOAD_DIR)에 저장하고 DB엔 경로만 둔다. 파일명은 store_id + uuid로
생성해 사용자 입력 경로(path traversal)를 차단한다. 형식·용량 검증 포함.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import get_settings
from app.core import errors

_ALLOWED = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}


async def save_business_cert(upload: UploadFile, store_id: str) -> str:
    """등록증 파일을 저장하고 DB에 보관할 상대 경로를 반환한다."""
    s = get_settings()
    ext = _ALLOWED.get(upload.content_type or "")
    if ext is None:
        raise errors.DomainError(
            status_code=400, error_code="VALIDATION_ERROR",
            message="등록증은 이미지(jpg/png/webp) 또는 PDF만 업로드할 수 있습니다.",
        )
    data = await upload.read()
    if len(data) == 0:
        raise errors.DomainError(
            status_code=400, error_code="VALIDATION_ERROR", message="빈 파일입니다.",
        )
    if len(data) > s.UPLOAD_MAX_BYTES:
        raise errors.DomainError(
            status_code=400, error_code="VALIDATION_ERROR",
            message=f"파일이 너무 큽니다(최대 {s.UPLOAD_MAX_BYTES // (1024 * 1024)}MB).",
        )
    cert_dir = Path(s.UPLOAD_DIR) / "business_cert"
    cert_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{store_id}_{uuid.uuid4().hex}{ext}"
    (cert_dir / filename).write_bytes(data)
    # DB 보관 경로(웹 루트 밖). 조회는 ADMIN 가드 하 전용 엔드포인트로만 (PR-B).
    return f"business_cert/{filename}"
