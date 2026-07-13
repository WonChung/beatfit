import json
import logging

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import ConfigurationError, RuntimeSettings, validate_runtime_settings
from app.database import get_db
from app.main import create_app
from app.observability import JsonFormatter

TEST_SETTINGS = RuntimeSettings(
    environment="test",
    log_level="INFO",
    cors_allowed_origins=("http://test.example",),
    cors_allow_credentials=True,
)


def test_health_and_request_id_header() -> None:
    client = TestClient(create_app(TEST_SETTINGS))

    response = client.get("/health", headers={"X-Request-ID": "test-request-123"})

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "beatfit-api"}
    assert response.headers["X-Request-ID"] == "test-request-123"


def test_invalid_request_id_is_replaced() -> None:
    client = TestClient(create_app(TEST_SETTINGS))

    response = client.get("/health", headers={"X-Request-ID": "invalid request id"})

    assert response.status_code == 200
    assert response.headers["X-Request-ID"] != "invalid request id"
    assert len(response.headers["X-Request-ID"]) == 36


def test_validation_response_omits_submitted_values() -> None:
    client = TestClient(create_app(TEST_SETTINGS))
    secret_input = "provider-token-that-must-not-be-reflected"

    response = client.post(
        "/workouts/generate",
        json={
            "muscle_group": "not-a-muscle-group",
            "difficulty": "beginner",
            "equipment": ["bodyweight"],
            "songs": [{"title": secret_input, "artist": "Artist", "duration_ms": 0}],
        },
    )

    assert response.status_code == 422
    assert secret_input not in response.text
    assert "request_id" in response.json()
    assert all("input" not in issue for issue in response.json()["detail"])


def test_unexpected_exception_returns_generic_response() -> None:
    application = create_app(TEST_SETTINGS)

    @application.get("/test-unexpected-error")
    def raise_unexpected_error() -> None:
        raise RuntimeError("postgresql://user:password@db.internal/beatfit")

    client = TestClient(application, raise_server_exceptions=False)
    response = client.get("/test-unexpected-error")

    assert response.status_code == 500
    assert response.json()["detail"] == "An unexpected error occurred."
    assert "password" not in response.text
    assert "RuntimeError" not in response.text


def test_readiness_checks_database() -> None:
    application = create_app(TEST_SETTINGS)
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine)

    def override_database():
        with testing_session() as database:
            yield database

    application.dependency_overrides[get_db] = override_database
    response = TestClient(application).get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "database": "available"}
    engine.dispose()


def test_readiness_failure_is_safe() -> None:
    application = create_app(TEST_SETTINGS)

    class BrokenDatabase:
        def execute(self, _statement) -> None:
            raise SQLAlchemyError("postgresql://user:password@db.internal/beatfit")

        def rollback(self) -> None:
            pass

    def override_database():
        yield BrokenDatabase()

    application.dependency_overrides[get_db] = override_database
    response = TestClient(application).get("/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == "The service is not ready."
    assert "password" not in response.text


def test_cors_uses_configured_origin() -> None:
    client = TestClient(create_app(TEST_SETTINGS))

    allowed = client.options(
        "/health",
        headers={
            "Origin": "http://test.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    denied = client.options(
        "/health",
        headers={
            "Origin": "https://untrusted.example",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert allowed.headers["Access-Control-Allow-Origin"] == "http://test.example"
    assert "Access-Control-Allow-Origin" not in denied.headers


def test_production_configuration_requires_safe_explicit_values(monkeypatch) -> None:
    settings = RuntimeSettings(
        environment="production",
        log_level="INFO",
        cors_allowed_origins=("https://app.beatfit.example",),
        cors_allow_credentials=True,
    )
    monkeypatch.setenv(
        "DATABASE_URL", "postgresql+psycopg://app:strong-password@db.internal/beatfit"
    )
    monkeypatch.setenv("SUPABASE_URL", "https://project-ref.supabase.co")
    monkeypatch.setenv("SUPABASE_JWT_ISSUER", "https://project-ref.supabase.co/auth/v1")

    validate_runtime_settings(settings)

    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://beatfit:beatfit_dev@localhost:5432/beatfit",
    )
    with pytest.raises(ConfigurationError, match="loopback"):
        validate_runtime_settings(settings)


def test_production_rejects_wildcard_cors(monkeypatch) -> None:
    settings = RuntimeSettings(
        environment="production",
        log_level="INFO",
        cors_allowed_origins=("*",),
        cors_allow_credentials=False,
    )

    with pytest.raises(ConfigurationError, match="cannot contain"):
        validate_runtime_settings(settings)


def test_structured_formatter_allowlists_context_fields() -> None:
    record = logging.LogRecord(
        name="beatfit.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="Safe event",
        args=(),
        exc_info=None,
    )
    record.event = "test.event"
    record.authorization = "Bearer provider-secret"
    record.database_url = "postgresql://user:password@db.internal/beatfit"

    payload = json.loads(JsonFormatter().format(record))

    assert payload["message"] == "Safe event"
    assert payload["event"] == "test.event"
    assert "authorization" not in payload
    assert "database_url" not in payload
