from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import AuthSettings, SupabaseTokenVerifier, get_auth_settings
from app.config import ConfigurationError

PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = PRIVATE_KEY.public_key()
SETTINGS = AuthSettings(
    issuer="https://test.supabase.co/auth/v1",
    audience="authenticated",
    jwks_url="https://test.supabase.co/auth/v1/.well-known/jwks.json",
)


class SigningKey:
    key = PUBLIC_KEY


@pytest.fixture(autouse=True)
def clear_auth_settings_cache():
    get_auth_settings.cache_clear()
    yield
    get_auth_settings.cache_clear()


def verifier() -> SupabaseTokenVerifier:
    result = SupabaseTokenVerifier(SETTINGS)
    result.jwks_client.get_signing_key_from_jwt = lambda _token: SigningKey()
    return result


def token(*, expires_at: datetime, key=PRIVATE_KEY) -> str:
    now = datetime.now(UTC)
    return jwt.encode(
        {
            "sub": "11111111-1111-4111-8111-111111111111",
            "email": "user@example.com",
            "role": "authenticated",
            "iss": SETTINGS.issuer,
            "aud": SETTINGS.audience,
            "iat": now,
            "exp": expires_at,
        },
        key,
        algorithm="RS256",
        headers={"kid": "test-key"},
    )


def test_verifies_valid_supabase_access_token():
    claims = verifier().verify(token(expires_at=datetime.now(UTC) + timedelta(minutes=5)))
    assert claims["sub"] == "11111111-1111-4111-8111-111111111111"


def test_rejects_expired_access_token():
    with pytest.raises(jwt.ExpiredSignatureError):
        verifier().verify(token(expires_at=datetime.now(UTC) - timedelta(seconds=1)))


def test_rejects_invalid_signature():
    other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(jwt.InvalidSignatureError):
        verifier().verify(token(expires_at=datetime.now(UTC) + timedelta(minutes=5), key=other_key))


def test_auth_settings_derive_custom_domain_defaults(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", " https://auth.beatfit.example/ ")
    monkeypatch.delenv("SUPABASE_JWT_ISSUER", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_AUDIENCE", raising=False)

    settings = get_auth_settings()

    assert settings.issuer == "https://auth.beatfit.example/auth/v1"
    assert settings.audience == "authenticated"
    assert settings.jwks_url == "https://auth.beatfit.example/auth/v1/.well-known/jwks.json"


def test_auth_settings_normalize_explicit_values(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://api.beatfit.example")
    monkeypatch.setenv(
        "SUPABASE_JWT_ISSUER",
        " https://issuer.beatfit.example/custom/ ",
    )
    monkeypatch.setenv(
        "SUPABASE_JWKS_URL",
        " https://keys.beatfit.example/jwks.json/ ",
    )
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", " beatfit-users ")

    settings = get_auth_settings()

    assert settings.issuer == "https://issuer.beatfit.example/custom"
    assert settings.jwks_url == "https://keys.beatfit.example/jwks.json"
    assert settings.audience == "beatfit-users"


def test_auth_settings_reject_blank_audience(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://auth.beatfit.example")
    monkeypatch.setenv("SUPABASE_JWT_AUDIENCE", " ")

    with pytest.raises(ConfigurationError, match="SUPABASE_JWT_AUDIENCE"):
        get_auth_settings()
