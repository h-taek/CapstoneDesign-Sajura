"""메일 발송 — fastapi-mail SMTP (03_be.md §1). 파기 증빙(01_basic_design.md §5.2.1)에 쓴다.

MAIL_SUPPRESS_SEND=true(dev 기본)면 SMTP에 접속하지 않고 발송 기록만 남긴다.
"""

from __future__ import annotations

from datetime import datetime

from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

from app.config import get_settings


def fast_mail() -> FastMail:
    s = get_settings()
    return FastMail(
        ConnectionConfig(
            MAIL_SERVER=s.MAIL_SERVER,
            MAIL_PORT=s.MAIL_PORT,
            MAIL_USERNAME=s.MAIL_USERNAME,
            MAIL_PASSWORD=s.MAIL_PASSWORD,
            MAIL_FROM=s.MAIL_FROM,
            MAIL_FROM_NAME="사주라",
            MAIL_STARTTLS=s.MAIL_STARTTLS,
            MAIL_SSL_TLS=s.MAIL_SSL_TLS,
            USE_CREDENTIALS=bool(s.MAIL_USERNAME),
            SUPPRESS_SEND=s.MAIL_SUPPRESS_SEND,
        )
    )


async def send_purge_notice(*, email: str, purged_at: datetime) -> None:
    body = (
        f"사주라 계정({email})과 매장 데이터를 {purged_at:%Y-%m-%d %H:%M} (UTC)에 파기했습니다.\n"
        "회원 탈퇴 후 30일 유예 기간이 지나 계정 정보, 매장·판매·재고·발주 데이터, "
        "사업자등록증 파일을 백업을 포함해 모두 삭제했습니다.\n"
    )
    await fast_mail().send_message(
        MessageSchema(
            subject="[사주라] 계정 정보 파기 완료",
            recipients=[email],
            body=body,
            subtype=MessageType.plain,
        )
    )
