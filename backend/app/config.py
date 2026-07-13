"""Runtime configuration parsing and production safety checks."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from functools import lru_cache
from urllib.parse import urlsplit

LOCAL_CORS_ORIGINS = (
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8081",
    "http://127.0.0.1:8081",
)
VALID_ENVIRONMENTS = {"development", "test", "production"}
VALID_LOG_LEVELS = {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}


class ConfigurationError(RuntimeError):
    """Raised when runtime configuration is unsafe or incomplete."""


@dataclass(frozen=True)
class RuntimeSettings:
    environment: str
    log_level: str
    cors_allowed_origins: tuple[str, ...]
    cors_allow_credentials: bool

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_runtime_settings() -> RuntimeSettings:
    environment = os.getenv("APP_ENV", "development").strip().lower()
    if environment not in VALID_ENVIRONMENTS:
        raise ConfigurationError("APP_ENV must be one of: development, test, production.")

    log_level = os.getenv("LOG_LEVEL", "INFO").strip().upper()
    if log_level not in VALID_LOG_LEVELS:
        raise ConfigurationError(
            f"LOG_LEVEL must be one of: {', '.join(sorted(VALID_LOG_LEVELS))}."
        )

    configured_origins = os.getenv("CORS_ALLOWED_ORIGINS")
    cors_allowed_origins = (
        _parse_origins(configured_origins)
        if configured_origins is not None
        else (() if environment == "production" else LOCAL_CORS_ORIGINS)
    )
    allow_credentials = _parse_bool(
        os.getenv("CORS_ALLOW_CREDENTIALS", "true"),
        variable_name="CORS_ALLOW_CREDENTIALS",
    )

    settings = RuntimeSettings(
        environment=environment,
        log_level=log_level,
        cors_allowed_origins=cors_allowed_origins,
        cors_allow_credentials=allow_credentials,
    )
    validate_runtime_settings(settings)
    return settings


def validate_runtime_settings(settings: RuntimeSettings) -> None:
    """Reject configurations that are unsafe for a production process."""

    for origin in settings.cors_allowed_origins:
        _validate_origin(origin, require_https=settings.is_production)

    if "*" in settings.cors_allowed_origins and settings.cors_allow_credentials:
        raise ConfigurationError(
            "CORS_ALLOWED_ORIGINS cannot contain '*' when credentials are enabled."
        )

    if not settings.is_production:
        return

    if not settings.cors_allowed_origins:
        raise ConfigurationError(
            "CORS_ALLOWED_ORIGINS must explicitly list trusted HTTPS origins in production."
        )

    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        raise ConfigurationError("DATABASE_URL must be configured in production.")
    parsed_database = urlsplit(database_url)
    if not parsed_database.scheme.startswith("postgresql") or not parsed_database.hostname:
        raise ConfigurationError("DATABASE_URL must be a PostgreSQL URL in production.")
    if parsed_database.hostname in {"localhost", "127.0.0.1", "::1"}:
        raise ConfigurationError("DATABASE_URL cannot use a loopback host in production.")
    if parsed_database.username == "beatfit" or parsed_database.password == "beatfit_dev":
        raise ConfigurationError(
            "DATABASE_URL cannot use the documented development credentials in production."
        )

    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_issuer = os.getenv("SUPABASE_JWT_ISSUER", "").strip()
    if not _is_https_url(supabase_url) or "your-project-ref" in supabase_url:
        raise ConfigurationError("SUPABASE_URL must be an HTTPS URL in production.")
    if not _is_https_url(supabase_issuer) or "your-project-ref" in supabase_issuer:
        raise ConfigurationError("SUPABASE_JWT_ISSUER must be an HTTPS URL in production.")


def _parse_origins(raw_origins: str) -> tuple[str, ...]:
    origins = tuple(
        dict.fromkeys(
            origin.strip().rstrip("/") for origin in raw_origins.split(",") if origin.strip()
        )
    )
    return origins


def _parse_bool(raw_value: str, *, variable_name: str) -> bool:
    normalized = raw_value.strip().lower()
    if normalized in {"true", "1", "yes", "on"}:
        return True
    if normalized in {"false", "0", "no", "off"}:
        return False
    raise ConfigurationError(f"{variable_name} must be true or false.")


def _validate_origin(origin: str, *, require_https: bool) -> None:
    if origin == "*":
        if require_https:
            raise ConfigurationError("CORS_ALLOWED_ORIGINS cannot contain '*' in production.")
        return

    parsed = urlsplit(origin)
    allowed_schemes = {"https"} if require_https else {"http", "https"}
    if (
        parsed.scheme not in allowed_schemes
        or not parsed.hostname
        or parsed.path not in {"", "/"}
        or parsed.query
        or parsed.fragment
        or parsed.username
        or parsed.password
    ):
        protocol = "HTTPS" if require_https else "HTTP or HTTPS"
        raise ConfigurationError(
            f"Each CORS_ALLOWED_ORIGINS entry must be a valid {protocol} origin."
        )


def _is_https_url(value: str) -> bool:
    parsed = urlsplit(value)
    return parsed.scheme == "https" and bool(parsed.hostname)


def log_level_number(settings: RuntimeSettings) -> int:
    return getattr(logging, settings.log_level)
