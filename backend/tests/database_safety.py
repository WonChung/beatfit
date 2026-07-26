from __future__ import annotations

import os
import re
from collections.abc import Mapping
from ipaddress import ip_address

from sqlalchemy.engine import URL, make_url
from sqlalchemy.exc import ArgumentError

_TEST_DATABASE_NAME = re.compile(r"(?:^|[_-])test(?:$|[_-])", re.IGNORECASE)


class UnsafeTestDatabaseError(RuntimeError):
    """Raised before a persistence test can target an unsafe database."""


def configured_postgresql_test_database_url(
    environ: Mapping[str, str] | None = None,
) -> str | None:
    """Return a validated PostgreSQL test URL, or None for the SQLite fallback."""

    environment = os.environ if environ is None else environ
    test_database_url = environment.get("TEST_DATABASE_URL", "").strip()
    if not test_database_url:
        return None

    return require_safe_postgresql_test_database_url(
        app_env=environment.get("APP_ENV"),
        test_database_url=test_database_url,
        application_database_url=environment.get("DATABASE_URL"),
    )


def require_safe_postgresql_test_database_url(
    *,
    app_env: str | None,
    test_database_url: str | None,
    application_database_url: str | None,
) -> str:
    """Fail closed unless a destructive test target is clearly isolated."""

    if (app_env or "").strip().lower() != "test":
        raise UnsafeTestDatabaseError("PostgreSQL persistence tests require APP_ENV=test.")

    candidate = (test_database_url or "").strip()
    if not candidate:
        raise UnsafeTestDatabaseError(
            "PostgreSQL persistence tests require an explicit TEST_DATABASE_URL."
        )

    test_url = _parse_database_url(candidate, variable_name="TEST_DATABASE_URL")
    if test_url.get_backend_name() != "postgresql":
        raise UnsafeTestDatabaseError("TEST_DATABASE_URL must be a PostgreSQL URL.")
    if not test_url.host:
        raise UnsafeTestDatabaseError("TEST_DATABASE_URL must include an explicit host.")

    database_name = (test_url.database or "").strip()
    if not database_name or not _TEST_DATABASE_NAME.search(database_name):
        raise UnsafeTestDatabaseError(
            "TEST_DATABASE_URL must name a clearly test-scoped database "
            "(for example, beatfit_test)."
        )

    application_url = (application_database_url or "").strip()
    if application_url:
        parsed_application_url = _parse_database_url(
            application_url,
            variable_name="DATABASE_URL",
        )
        if _database_target(test_url) == _database_target(parsed_application_url):
            raise UnsafeTestDatabaseError(
                "TEST_DATABASE_URL must not target the application DATABASE_URL database."
            )

    return candidate


def _parse_database_url(value: str, *, variable_name: str) -> URL:
    try:
        return make_url(value)
    except (ArgumentError, ValueError) as error:
        raise UnsafeTestDatabaseError(f"{variable_name} is not a valid database URL.") from error


def _database_target(url: URL) -> tuple[str, str, int | None, str]:
    try:
        port = url.port
    except ValueError as error:
        raise UnsafeTestDatabaseError("Database URL contains an invalid port.") from error

    backend = url.get_backend_name().lower()
    default_port = 5432 if backend == "postgresql" else None
    return (
        backend,
        _normalized_host(url.host),
        port or default_port,
        (url.database or "").casefold(),
    )


def _normalized_host(host: str | None) -> str:
    normalized = (host or "").strip().casefold().rstrip(".")
    if normalized == "localhost":
        return "loopback"
    try:
        if ip_address(normalized).is_loopback:
            return "loopback"
    except ValueError:
        pass
    return normalized
