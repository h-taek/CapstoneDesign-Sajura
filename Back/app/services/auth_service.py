"""AuthService — docs/plan/01_be.md 서비스별 주요 메서드."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import errors, security
from app.models.refresh_token import RefreshToken
from app.models.store import Store
from app.models.user import AuthProvider, User


@dataclass(slots=True)
class IssuedTokens:
    access_token: str
    expires_in: int
    refresh_token: str


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register(self, *, email: str, password: str, name: str) -> User:
        # 회원가입은 email·password·name만 받는다. 사업자 검증·매장 정보는
        # 가입 후 별도 단계(StoreService.verify_business, 온보딩)에서 채운다.
        existing = await self.session.scalar(select(User).where(User.email == email))
        if existing is not None:
            raise errors.auth_email_duplicate()

        user = User(
            email=email, password_hash=security.hash_password(password),
            name=name, auth_provider=AuthProvider.LOCAL,
        )
        self.session.add(user)
        await self.session.flush()
        # 계정 생성 시 빈 매장 행을 1:1로 함께 생성 (business_verified=False).
        self.session.add(Store(user_id=user.user_id, onboarding_completed=False))
        try:
            await self.session.commit()
        except IntegrityError as exc:
            await self.session.rollback()
            if "uq_users_email" in str(exc.orig).lower():
                raise errors.auth_email_duplicate() from exc
            raise
        await self.session.refresh(user)
        return user

    async def login_with_email(
        self, *, email: str, password: str
    ) -> tuple[IssuedTokens, Store | None]:
        user = await self.session.scalar(select(User).where(User.email == email))
        if user is None or user.password_hash is None:
            raise errors.auth_invalid_credentials()
        if not security.verify_password(password, user.password_hash):
            raise errors.auth_invalid_credentials()
        store = await self.session.scalar(select(Store).where(Store.user_id == user.user_id))
        tokens = await self._issue_tokens(
            user_id=user.user_id, store_id=store.store_id if store else None
        )
        await self.session.commit()
        return tokens, store

    async def login_with_oauth(
        self, *, provider: str, social_id: str, email: str, name: str
    ) -> tuple[IssuedTokens, Store | None]:
        ap = AuthProvider(provider.upper())
        user = await self.session.scalar(
            select(User).where(User.auth_provider == ap, User.social_id == social_id)
        )
        if user is None:
            user = User(email=email, password_hash=None, name=name, auth_provider=ap, social_id=social_id)
            self.session.add(user)
            try:
                await self.session.flush()
            except IntegrityError:
                await self.session.rollback()
                user = User(
                    email=f"{provider}_{social_id}@social.local",
                    password_hash=None, name=name, auth_provider=ap, social_id=social_id,
                )
                self.session.add(user)
                await self.session.flush()
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
        tokens = await self._issue_tokens(
            user_id=existing.user_id, store_id=store.store_id if store else None
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
        user = await self.get_user(user_id)
        if user.auth_provider == AuthProvider.LOCAL:
            if user.password_hash is None or not security.verify_password(password, user.password_hash):
                raise errors.auth_invalid_credentials()
        await self.session.delete(user)
        await self.session.commit()

    async def _issue_tokens(self, *, user_id: str, store_id: str | None) -> IssuedTokens:
        access, ttl = security.create_access_token(user_id=user_id, store_id=store_id)
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
