"""AuthService — docs/plan/01_be.md 서비스별 주요 메서드."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import UploadFile
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors, security
from app.models.refresh_token import RefreshToken
from app.models.store import BusinessStatus, Store
from app.models.user import AuthProvider, User
from app.services.store_service import apply_business, check_business_no


@dataclass(slots=True)
class IssuedTokens:
    access_token: str
    expires_in: int
    # 사업자 검증 전 계정(UNVERIFIED·REJECTED)은 None
    # — 로그인이 Access Token만으로 유지된다 (03_be.md §7.3)
    refresh_token: str | None


def _before_verification(store: Store | None) -> bool:
    return store is None or store.business_status in (
        BusinessStatus.UNVERIFIED, BusinessStatus.REJECTED,
    )


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(
        self, *, email: str, password: str, name: str,
        business_no: str, cert: UploadFile | None,
    ) -> tuple[IssuedTokens, Store]:
        """이메일 회원가입 — 사업자 검증을 통과해야 계정을 만들고 곧바로 로그인한다 (01 §3.1.2)."""
        existing = await self.session.scalar(select(User).where(User.email == email))
        if existing is not None:
            if existing.withdrawn_at is not None:
                raise errors.auth_account_withdrawn(409)
            raise errors.auth_email_duplicate()
        normalized = await check_business_no(self.session, business_no)

        user = User(
            email=email, password_hash=security.hash_password(password),
            name=name, auth_provider=AuthProvider.LOCAL,
        )
        return await self._create_with_business(user, normalized, cert)

    async def register_social(
        self, *, provider: str, social_id: str, email: str, name: str,
        business_no: str, cert: UploadFile | None,
    ) -> tuple[IssuedTokens, Store]:
        """소셜 회원가입 — 가입 대기 토큰의 계정 정보로 만든다 (01 §3.1.1)."""
        ap = AuthProvider(provider.upper())
        existing = await self.session.scalar(
            select(User).where(User.auth_provider == ap, User.social_id == social_id)
        )
        if existing is not None:
            if existing.withdrawn_at is not None:
                raise errors.auth_account_withdrawn(403)
            # 같은 가입 대기 토큰으로 이미 가입을 마쳤다(중복 제출) — 로그인으로 처리한다
            store = await self.session.scalar(
                select(Store).where(Store.user_id == existing.user_id)
            )
            tokens = await self._issue_tokens(
                user_id=existing.user_id, store_id=store.store_id if store else None,
                with_refresh=not _before_verification(store),
            )
            await self.session.commit()
            return tokens, store
        normalized = await check_business_no(self.session, business_no)

        # 다른 계정이 쓰는 이메일이면 소셜 로그인 때와 같은 대체 주소를 쓴다
        email_taken = await self.session.scalar(select(User.user_id).where(User.email == email))
        if email_taken is not None:
            email = f"{provider}_{social_id}@social.local"
        user = User(
            email=email, password_hash=None, name=name, auth_provider=ap, social_id=social_id
        )
        return await self._create_with_business(user, normalized, cert)

    async def _create_with_business(
        self, user: User, business_no: str | None, cert: UploadFile | None
    ) -> tuple[IssuedTokens, Store]:
        """사용자·매장을 사업자 정보와 함께 만들고 로그인 토큰을 발급한다. 실패하면 행이 없다."""
        self.session.add(user)
        await self.session.flush()
        store = Store(user_id=user.user_id, onboarding_completed=False)
        self.session.add(store)
        await self.session.flush()
        await apply_business(store, business_no, cert)
        tokens = await self._issue_tokens(user_id=user.user_id, store_id=store.store_id)
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            if "uq_users_email" in str(exc.orig).lower():
                raise errors.auth_email_duplicate() from exc
            if "uq_stores_business_no" in str(exc.orig).lower():
                raise errors.auth_business_no_duplicate() from exc
            raise
        await self.session.refresh(store)
        return tokens, store

    async def issue_session(self, *, user_id: str, store_id: str) -> IssuedTokens:
        """사업자 검증 화면에서 통과한 순간 Refresh Token을 처음 발급한다 (03_be.md §7.3)."""
        tokens = await self._issue_tokens(user_id=user_id, store_id=store_id)
        await self.session.commit()
        return tokens

    async def login_with_email(
        self, *, email: str, password: str
    ) -> tuple[IssuedTokens, Store | None]:
        user = await self.session.scalar(select(User).where(User.email == email))
        if user is None or user.password_hash is None:
            raise errors.auth_invalid_credentials()
        if not security.verify_password(password, user.password_hash):
            raise errors.auth_invalid_credentials()
        if user.withdrawn_at is not None:
            raise errors.auth_account_withdrawn(403)
        store = await self.session.scalar(select(Store).where(Store.user_id == user.user_id))
        tokens = await self._issue_tokens(
            user_id=user.user_id, store_id=store.store_id if store else None,
            with_refresh=not _before_verification(store),
        )
        await self.session.commit()
        return tokens, store

    async def login_with_oauth(
        self, *, provider: str, social_id: str
    ) -> tuple[IssuedTokens, Store] | None:
        """기존 소셜 계정이면 로그인 토큰, 처음 보는 계정이면 None — 계정은 회원가입에서 만든다.

        사업자 검증 전 계정에도 FE 인계용 Refresh Token을 발급한다.
        FE의 첫 refresh가 폐기한다 (03_be.md §7.3).
        """
        ap = AuthProvider(provider.upper())
        user = await self.session.scalar(
            select(User).where(User.auth_provider == ap, User.social_id == social_id)
        )
        if user is None:
            return None
        if user.withdrawn_at is not None:
            raise errors.auth_account_withdrawn(403)
        store = await self.session.scalar(select(Store).where(Store.user_id == user.user_id))
        if store is None:
            # 계정 생성 시 빈 매장 행 1:1 생성 (business_verified=False) — 이메일/소셜 공통.
            store = Store(user_id=user.user_id, onboarding_completed=False)
            self.session.add(store)
            await self.session.flush()
        tokens = await self._issue_tokens(user_id=user.user_id, store_id=store.store_id)
        await self.session.commit()
        return tokens, store

    async def refresh(self, *, raw_refresh: str) -> IssuedTokens:
        token_hash = security.hash_refresh_token(raw_refresh)
        # 행 잠금: 같은 refresh_token으로 동시 요청이 와도 한 쪽만 회전에 성공하도록 한다.
        existing = await self.session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash).with_for_update()
        )
        if existing is None or existing.is_revoked:
            raise errors.auth_refresh_token_invalid()
        if existing.expires_at.replace(tzinfo=UTC) < datetime.now(UTC):
            raise errors.auth_refresh_token_invalid()
        existing.is_revoked = True
        store = await self.session.scalar(select(Store).where(Store.user_id == existing.user_id))
        # 사업자 검증 전 계정은 새 Refresh Token 없이 Access Token만 — Cookie는 호출 쪽이 지운다
        tokens = await self._issue_tokens(
            user_id=existing.user_id, store_id=store.store_id if store else None,
            with_refresh=not _before_verification(store),
        )
        await self.session.commit()
        return tokens

    async def logout(self, *, raw_refresh: str | None) -> None:
        if not raw_refresh:
            return
        h = security.hash_refresh_token(raw_refresh)
        await self.session.execute(
            update(RefreshToken).where(RefreshToken.token_hash == h).values(is_revoked=True)
        )
        await self.session.commit()

    async def logout_all(self, *, user_id: str) -> None:
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False))
            .values(is_revoked=True)
        )
        await self.session.commit()

    async def get_user(self, user_id: str) -> User:
        user = await self.session.get(User, user_id)
        if user is None:
            raise errors.unauthorized()
        return user

    async def get_store(self, user_id: str) -> Store | None:
        return await self.session.scalar(select(Store).where(Store.user_id == user_id))

    async def update_me(
        self, *, user_id: str, name: str | None, store_name: str | None
    ) -> User:
        user = await self.get_user(user_id)
        if name is not None:
            user.name = name
        if store_name is not None:
            store = await self.get_store(user_id)
            if store is not None:
                store.store_name = store_name
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def change_password(
        self, *, user_id: str, current_password: str, new_password: str
    ) -> None:
        user = await self.get_user(user_id)
        if user.auth_provider != AuthProvider.LOCAL or user.password_hash is None:
            raise errors.auth_password_not_allowed()
        if not security.verify_password(current_password, user.password_hash):
            raise errors.auth_invalid_credentials()
        user.password_hash = security.hash_password(new_password)
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False))
            .values(is_revoked=True)
        )
        await self.session.commit()

    async def delete_account(self, *, user_id: str, password: str) -> None:
        """탈퇴 유예 진입 — 30일 뒤 AccountPurgeService가 파기한다 (01_basic_design.md §5.2.1)."""
        user = await self.get_user(user_id)
        if user.auth_provider == AuthProvider.LOCAL:
            if user.password_hash is None or not security.verify_password(password, user.password_hash):
                raise errors.auth_invalid_credentials()
        user.withdrawn_at = datetime.now(UTC).replace(tzinfo=None)
        await self.session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.is_revoked.is_(False))
            .values(is_revoked=True)
        )
        await self.session.commit()

    async def _issue_tokens(
        self, *, user_id: str, store_id: str | None, with_refresh: bool = True
    ) -> IssuedTokens:
        access, ttl = security.create_access_token(user_id=user_id, store_id=store_id)
        if not with_refresh:
            return IssuedTokens(access_token=access, expires_in=ttl, refresh_token=None)
        raw = security.generate_refresh_token()
        self.session.add(
            RefreshToken(
                user_id=user_id,
                token_hash=security.hash_refresh_token(raw),
                expires_at=security.refresh_token_expiry().replace(tzinfo=None),
                is_revoked=False,
            )
        )
        await self.session.flush()
        return IssuedTokens(access_token=access, expires_in=ttl, refresh_token=raw)
