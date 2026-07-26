import pytest

from tests.database_safety import (
    UnsafeTestDatabaseError,
    configured_postgresql_test_database_url,
    require_safe_postgresql_test_database_url,
)

SAFE_TEST_URL = "postgresql+psycopg://beatfit:beatfit_test@127.0.0.1:5432/beatfit_test"
APPLICATION_URL = "postgresql+psycopg://beatfit:beatfit_dev@127.0.0.1:5432/beatfit"


def test_missing_test_database_url_preserves_sqlite_fallback():
    assert (
        configured_postgresql_test_database_url(
            {"APP_ENV": "test", "DATABASE_URL": APPLICATION_URL}
        )
        is None
    )


@pytest.mark.parametrize("app_env", [None, "", "development", "production"])
def test_postgresql_target_requires_test_environment(app_env: str | None):
    with pytest.raises(UnsafeTestDatabaseError, match="APP_ENV=test"):
        require_safe_postgresql_test_database_url(
            app_env=app_env,
            test_database_url=SAFE_TEST_URL,
            application_database_url=APPLICATION_URL,
        )


@pytest.mark.parametrize("test_database_url", [None, "", "  "])
def test_postgresql_target_requires_explicit_test_database_url(
    test_database_url: str | None,
):
    with pytest.raises(UnsafeTestDatabaseError, match="explicit TEST_DATABASE_URL"):
        require_safe_postgresql_test_database_url(
            app_env="test",
            test_database_url=test_database_url,
            application_database_url=APPLICATION_URL,
        )


@pytest.mark.parametrize(
    "test_database_url",
    [
        "not a URL",
        "sqlite+pysqlite:///:memory:",
        "postgresql+psycopg:///beatfit_test",
        "postgresql+psycopg://localhost",
    ],
)
def test_postgresql_target_rejects_invalid_or_non_postgresql_urls(
    test_database_url: str,
):
    with pytest.raises(UnsafeTestDatabaseError):
        require_safe_postgresql_test_database_url(
            app_env="test",
            test_database_url=test_database_url,
            application_database_url=APPLICATION_URL,
        )


@pytest.mark.parametrize(
    "database_name",
    ["beatfit", "contest", "latest", "testimony", "beatfit_testing"],
)
def test_postgresql_target_requires_delimited_test_database_name(database_name: str):
    with pytest.raises(UnsafeTestDatabaseError, match="clearly test-scoped"):
        require_safe_postgresql_test_database_url(
            app_env="test",
            test_database_url=f"postgresql+psycopg://localhost/{database_name}",
            application_database_url=APPLICATION_URL,
        )


@pytest.mark.parametrize(
    "database_name",
    ["beatfit_test", "test_beatfit", "beatfit-test-2"],
)
def test_postgresql_target_accepts_clearly_test_scoped_names(database_name: str):
    test_database_url = f"postgresql+psycopg://localhost/{database_name}"

    assert (
        require_safe_postgresql_test_database_url(
            app_env=" TEST ",
            test_database_url=test_database_url,
            application_database_url=APPLICATION_URL,
        )
        == test_database_url
    )


def test_postgresql_target_rejects_application_database_with_equivalent_url():
    with pytest.raises(UnsafeTestDatabaseError, match="must not target"):
        require_safe_postgresql_test_database_url(
            app_env="test",
            test_database_url=(
                "postgresql+psycopg://test-user:test-password@127.0.0.1:5432/"
                "beatfit_test?sslmode=disable"
            ),
            application_database_url=(
                "postgresql://app-user:app-password@localhost/beatfit_test?application_name=beatfit"
            ),
        )


def test_configured_postgresql_target_is_validated_and_returned():
    assert (
        configured_postgresql_test_database_url(
            {
                "APP_ENV": "test",
                "DATABASE_URL": APPLICATION_URL,
                "TEST_DATABASE_URL": SAFE_TEST_URL,
            }
        )
        == SAFE_TEST_URL
    )
