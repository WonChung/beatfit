"""Secure Apple developer-token signing and catalog access."""

import os
import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol

import httpx
import jwt


class AppleMusicConfigurationError(Exception):
    pass


class AppleMusicUpstreamError(Exception):
    pass


@dataclass(frozen=True)
class AppleMusicSettings:
    team_id: str
    key_id: str
    media_id: str
    private_key: str
    token_ttl_seconds: int
    api_base_url: str
    web_origins: tuple[str, ...]


def load_apple_music_settings() -> AppleMusicSettings:
    private_key = os.getenv("APPLE_MUSIC_PRIVATE_KEY_PEM", "").replace("\\n", "\n").strip()
    private_key_path = os.getenv("APPLE_MUSIC_PRIVATE_KEY_PATH", "").strip()
    if not private_key and private_key_path:
        try:
            private_key = Path(private_key_path).read_text(encoding="utf-8").strip()
        except OSError as error:
            raise AppleMusicConfigurationError(
                "The Apple Music signing key is unavailable."
            ) from error
    team_id = os.getenv("APPLE_MUSIC_TEAM_ID", "").strip()
    key_id = os.getenv("APPLE_MUSIC_KEY_ID", "").strip()
    media_id = os.getenv("APPLE_MUSIC_MEDIA_ID", "").strip()
    if not all((team_id, key_id, media_id, private_key)):
        raise AppleMusicConfigurationError("Apple Music server credentials are not configured.")
    ttl = min(
        max(int(os.getenv("APPLE_MUSIC_DEVELOPER_TOKEN_TTL_SECONDS", "3600")), 60), 15_777_000
    )
    origins = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv("APPLE_MUSIC_WEB_ORIGINS", "").split(",")
        if origin.strip()
    )
    return AppleMusicSettings(
        team_id=team_id,
        key_id=key_id,
        media_id=media_id,
        private_key=private_key,
        token_ttl_seconds=ttl,
        api_base_url=os.getenv("APPLE_MUSIC_API_BASE_URL", "https://api.music.apple.com").rstrip(
            "/"
        ),
        web_origins=origins,
    )


class DeveloperTokenService:
    def __init__(self, settings: AppleMusicSettings):
        self.settings = settings
        self._cache: dict[str | None, tuple[str, int]] = {}

    def issue(self, origin: str | None = None) -> tuple[str, int]:
        normalized_origin = origin.rstrip("/") if origin else None
        if normalized_origin and normalized_origin not in self.settings.web_origins:
            raise AppleMusicConfigurationError("This web origin is not approved for Apple Music.")
        now = int(time.time())
        cached = self._cache.get(normalized_origin)
        if cached and cached[1] - now > 30:
            return cached
        expires_at = now + self.settings.token_ttl_seconds
        claims: dict[str, Any] = {"iss": self.settings.team_id, "iat": now, "exp": expires_at}
        if normalized_origin:
            claims["origin"] = [normalized_origin]
        token = jwt.encode(
            claims,
            self.settings.private_key,
            algorithm="ES256",
            headers={"kid": self.settings.key_id},
        )
        self._cache[normalized_origin] = (token, expires_at)
        return token, expires_at


class AppleMusicCatalog(Protocol):
    def search(self, term: str, storefront: str, limit: int) -> dict[str, Any]: ...


class HttpAppleMusicCatalog:
    def __init__(self, settings: AppleMusicSettings, tokens: DeveloperTokenService):
        self.settings = settings
        self.tokens = tokens

    def search(self, term: str, storefront: str, limit: int) -> dict[str, Any]:
        token, _ = self.tokens.issue()
        try:
            response = httpx.get(
                f"{self.settings.api_base_url}/v1/catalog/{storefront}/search",
                params={"term": term, "types": "songs", "limit": limit},
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as error:
            raise AppleMusicUpstreamError(
                "Apple Music catalog is temporarily unavailable."
            ) from error


@lru_cache
def get_developer_token_service() -> DeveloperTokenService:
    return DeveloperTokenService(load_apple_music_settings())


@lru_cache
def get_apple_music_catalog() -> AppleMusicCatalog:
    settings = load_apple_music_settings()
    return HttpAppleMusicCatalog(settings, get_developer_token_service())
