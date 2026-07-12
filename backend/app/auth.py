"""Supabase access-token verification and local profile synchronization."""

import os
import uuid
from dataclasses import dataclass
from functools import lru_cache
from typing import Any, Protocol

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import get_db
from app.db_models import User


bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthSettings:
    issuer: str
    audience: str
    jwks_url: str


class TokenVerifier(Protocol):
    def verify(self, token: str) -> dict[str, Any]: ...


class SupabaseTokenVerifier:
    def __init__(self, settings: AuthSettings):
        self.settings = settings
        self.jwks_client = PyJWKClient(settings.jwks_url, cache_jwk_set=True, lifespan=600)

    def verify(self, token: str) -> dict[str, Any]:
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=self.settings.audience,
            issuer=self.settings.issuer,
            options={"require": ["exp", "iat", "sub", "iss", "aud"]},
        )
        if claims.get("role") != "authenticated":
            raise jwt.InvalidTokenError("Token does not have the authenticated role.")
        return claims


@lru_cache
def get_auth_settings() -> AuthSettings:
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    issuer = os.getenv("SUPABASE_JWT_ISSUER", f"{supabase_url}/auth/v1").rstrip("/")
    jwks_url = os.getenv(
        "SUPABASE_JWKS_URL", f"{issuer}/.well-known/jwks.json"
    )
    audience = os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated")
    if not supabase_url or not issuer.startswith("https://"):
        raise RuntimeError("SUPABASE_URL and a valid HTTPS JWT issuer must be configured.")
    return AuthSettings(issuer=issuer, audience=audience, jwks_url=jwks_url)


@lru_cache
def get_token_verifier() -> TokenVerifier:
    return SupabaseTokenVerifier(get_auth_settings())


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    verifier: TokenVerifier = Depends(get_token_verifier),
    database: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="A valid Supabase access token is required.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized
    try:
        claims = verifier.verify(credentials.credentials)
        user_id = uuid.UUID(str(claims["sub"]))
    except (KeyError, ValueError, jwt.PyJWTError):
        raise unauthorized from None

    email = claims.get("email")
    if not isinstance(email, str) or not email.strip():
        raise unauthorized
    metadata = claims.get("user_metadata")
    display_name = (
        metadata.get("display_name")
        if isinstance(metadata, dict) and isinstance(metadata.get("display_name"), str)
        else email.split("@", 1)[0]
    )
    try:
        user = database.get(User, user_id)
        if user is None:
            existing_email = database.scalar(select(User).where(User.email == email.lower()))
            if existing_email is not None:
                raise unauthorized
            user = User(
                id=user_id,
                email=email.lower(),
                display_name=display_name[:120],
                is_temporary=False,
            )
            database.add(user)
        else:
            user.email = email.lower()
            user.display_name = display_name[:120]
            user.is_temporary = False
        database.commit()
        database.refresh(user)
        return user
    except HTTPException:
        raise
    except (IntegrityError, SQLAlchemyError):
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The authenticated profile could not be synchronized.",
        ) from None
