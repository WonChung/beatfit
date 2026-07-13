from datetime import UTC, datetime
import uuid

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app.apple_music import AppleMusicSettings, DeveloperTokenService, get_apple_music_catalog, get_developer_token_service
from app.auth import get_current_user
from app.db_models import User
from app.main import app


class MockCatalog:
    def search(self, term: str, storefront: str, limit: int) -> dict:
        assert (term, storefront, limit) == ("run", "us", 10)
        return {
            "results": {
                "songs": {
                    "data": [
                        {
                            "id": "catalog-1",
                            "attributes": {
                                "name": "Run Song",
                                "artistName": "Test Artist",
                                "durationInMillis": 225000,
                                "artwork": {"url": "https://img/{w}x{h}.jpg"},
                                "playParams": {"id": "catalog-1"},
                            },
                        },
                        {"id": "partial", "attributes": {}},
                    ]
                }
            }
        }


@pytest.fixture()
def client():
    user = User(id=uuid.uuid4(), email="music@example.com", display_name="Music User")
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_apple_music_catalog] = lambda: MockCatalog()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def settings(private_key: str) -> AppleMusicSettings:
    return AppleMusicSettings(
        team_id="TEAM123456",
        key_id="KEY1234567",
        media_id="com.test.music",
        private_key=private_key,
        token_ttl_seconds=3600,
        api_base_url="https://api.music.apple.com",
        web_origins=("https://beatfit.example",),
    )


def test_developer_token_is_es256_origin_restricted():
    private_key = ec.generate_private_key(ec.SECP256R1())
    service = DeveloperTokenService(settings(private_key))
    token, expires_at = service.issue("https://beatfit.example")
    claims = jwt.decode(
        token,
        private_key.public_key(),
        algorithms=["ES256"],
        issuer="TEAM123456",
        options={"verify_aud": False},
    )

    assert jwt.get_unverified_header(token)["kid"] == "KEY1234567"
    assert claims["origin"] == ["https://beatfit.example"]
    assert 0 < expires_at - int(datetime.now(UTC).timestamp()) <= 3600


def test_developer_token_rejects_unapproved_origin():
    service = DeveloperTokenService(settings(ec.generate_private_key(ec.SECP256R1())))
    with pytest.raises(Exception, match="not approved"):
        service.issue("https://attacker.example")


def test_catalog_search_normalizes_full_and_partial_metadata(client: TestClient):
    response = client.get("/music/apple/catalog/search?term=run&storefront=us&limit=10")
    assert response.status_code == 200
    first, partial = response.json()["items"]
    assert first["duration_ms"] == 225000
    assert first["artwork_url"] == "https://img/600x600.jpg"
    assert first["provider_identifier"]["catalog_id"] == "catalog-1"
    assert partial["title"] == "Unknown title"
    assert partial["duration_ms"] is None


def test_developer_token_endpoint_never_returns_signing_credentials(client: TestClient):
    private_key = ec.generate_private_key(ec.SECP256R1())
    service = DeveloperTokenService(settings(private_key))
    app.dependency_overrides[get_developer_token_service] = lambda: service
    response = client.get(
        "/music/apple/developer-token", headers={"Origin": "https://beatfit.example"}
    )
    assert response.status_code == 200
    assert set(response.json()) == {"token", "expires_at"}
