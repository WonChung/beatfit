from datetime import UTC, datetime, timedelta

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.auth import AuthSettings, SupabaseTokenVerifier


PRIVATE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
PUBLIC_KEY = PRIVATE_KEY.public_key()
SETTINGS = AuthSettings(
    issuer="https://test.supabase.co/auth/v1",
    audience="authenticated",
    jwks_url="https://test.supabase.co/auth/v1/.well-known/jwks.json",
)


class SigningKey:
    key = PUBLIC_KEY


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
