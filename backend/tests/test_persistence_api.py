from datetime import UTC, datetime, timedelta
import os

import pytest
import jwt
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.auth import get_token_verifier
from app.main import app


USER_ONE_ID = "11111111-1111-4111-8111-111111111111"
USER_TWO_ID = "22222222-2222-4222-8222-222222222222"


class TestTokenVerifier:
    def verify(self, token: str) -> dict:
        if token == "valid-user-one":
            return {"sub": USER_ONE_ID, "email": "one@example.com", "role": "authenticated"}
        if token == "valid-user-two":
            return {"sub": USER_TWO_ID, "email": "two@example.com", "role": "authenticated"}
        if token == "expired":
            raise jwt.ExpiredSignatureError()
        raise jwt.InvalidTokenError()


@pytest.fixture()
def client() -> TestClient:
    test_database_url = os.getenv("TEST_DATABASE_URL")
    if test_database_url:
        engine = create_engine(test_database_url, pool_pre_ping=True)
    else:
        engine = create_engine(
            "sqlite+pysqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        @event.listens_for(engine, "connect")
        def enable_foreign_keys(dbapi_connection, _connection_record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        for table in reversed(Base.metadata.sorted_tables):
            connection.execute(table.delete())
    testing_session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_database():
        database: Session = testing_session()
        try:
            yield database
        except Exception:
            database.rollback()
            raise
        finally:
            database.close()

    app.dependency_overrides[get_db] = override_database
    app.dependency_overrides[get_token_verifier] = lambda: TestTokenVerifier()
    with TestClient(app) as test_client:
        test_client.headers["Authorization"] = "Bearer valid-user-one"
        yield test_client
    app.dependency_overrides.clear()
    if not test_database_url:
        Base.metadata.drop_all(engine)
    engine.dispose()


def test_workout_crud_and_pagination(client: TestClient):
    created = client.post("/workouts", json=_workout_payload(name="Persisted workout"))

    assert created.status_code == 201
    workout_id = created.json()["id"]
    assert created.json()["blocks"][0]["intervals"][0]["exercise_id"] == "core-plank"
    assert created.json()["blocks"][0]["song"]["artwork_url"] == "https://example.test/art.jpg"
    assert created.json()["blocks"][0]["song"]["provider_identifier"]["catalog_id"] == "catalog-1"

    listing = client.get("/workouts", params={"page": 1, "page_size": 1})
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == workout_id

    fetched = client.get(f"/workouts/{workout_id}")
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Persisted workout"

    deleted = client.delete(f"/workouts/{workout_id}")
    assert deleted.status_code == 204
    assert client.get(f"/workouts/{workout_id}").status_code == 404


def test_session_create_patch_feedback_and_list(client: TestClient):
    workout_id = client.post("/workouts", json=_workout_payload()).json()["id"]
    started_at = datetime.now(UTC)
    session = client.post(
        "/workout-sessions",
        json={
            "workout_id": workout_id,
            "started_at": started_at.isoformat(),
            "ended_at": (started_at + timedelta(seconds=30)).isoformat(),
            "actual_elapsed_seconds": 30,
            "completed_intervals": 1,
            "completed_work_intervals": 1,
            "completed_song_blocks": 1,
            "status": "completed",
        },
    )

    assert session.status_code == 201
    session_id = session.json()["id"]
    assert session.json()["planned_duration_seconds"] == 30
    assert session.json()["workout_snapshot"]["blocks"][0]["song"]["title"] == "Song"

    patched = client.patch(
        f"/workout-sessions/{session_id}",
        json={"feedback": {"rating": "about_right", "notes": "Good pace"}},
    )
    assert patched.status_code == 200
    assert patched.json()["feedback"]["rating"] == "about_right"

    listing = client.get("/workout-sessions", params={"page": 1, "page_size": 10})
    assert listing.status_code == 200
    assert listing.json()["total"] == 1
    assert listing.json()["items"][0]["id"] == session_id


def test_session_survives_workout_deletion_with_snapshot(client: TestClient):
    workout_id = client.post("/workouts", json=_workout_payload()).json()["id"]
    now = datetime.now(UTC)
    session_id = client.post(
        "/workout-sessions",
        json={
            "workout_id": workout_id,
            "started_at": now.isoformat(),
            "ended_at": now.isoformat(),
            "actual_elapsed_seconds": 0,
            "completed_intervals": 0,
            "completed_work_intervals": 0,
            "completed_song_blocks": 0,
            "status": "ended_early",
        },
    ).json()["id"]

    assert client.delete(f"/workouts/{workout_id}").status_code == 204
    history = client.get("/workout-sessions").json()["items"]
    assert history[0]["id"] == session_id
    assert history[0]["workout_id"] is None
    assert history[0]["workout_snapshot"]["muscle_group"] == "core"


def test_not_found_validation_and_untrusted_owner_rejection(client: TestClient):
    missing = client.get("/workouts/00000000-0000-4000-8000-000000000099")
    invalid_intervals = _workout_payload()
    invalid_intervals["blocks"][0]["intervals"][0]["end_seconds"] = 29
    invalid = client.post("/workouts", json=invalid_intervals)
    untrusted_owner = client.post(
        "/workouts",
        json={**_workout_payload(), "user_id": "00000000-0000-4000-8000-000000000099"},
    )
    invalid_page = client.get("/workouts", params={"page_size": 101})

    assert missing.status_code == 404
    assert invalid.status_code == 422
    assert untrusted_owner.status_code == 422
    assert invalid_page.status_code == 422


def test_authentication_errors_and_profile_sync(client: TestClient):
    client.headers.pop("Authorization")
    assert client.get("/workouts").status_code == 401

    assert client.get("/workouts", headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.get("/workouts", headers={"Authorization": "Bearer expired"}).status_code == 401

    authenticated = client.get(
        "/workouts", headers={"Authorization": "Bearer valid-user-one"}
    )
    assert authenticated.status_code == 200


def test_cross_user_workout_access_is_denied(client: TestClient):
    created = client.post("/workouts", json=_workout_payload())
    assert created.status_code == 201
    workout_id = created.json()["id"]

    other_user_headers = {"Authorization": "Bearer valid-user-two"}
    assert client.get(f"/workouts/{workout_id}", headers=other_user_headers).status_code == 404
    assert client.delete(f"/workouts/{workout_id}", headers=other_user_headers).status_code == 404
    assert client.get("/workouts", headers=other_user_headers).json()["total"] == 0


def _workout_payload(name: str | None = None) -> dict:
    return {
        "name": name,
        "muscle_group": "core",
        "difficulty": "intermediate",
        "equipment": ["bodyweight"],
        "goal": "endurance",
        "random_seed": 7,
        "blocks": [
            {
                "song": {
                    "title": "Song", "artist": "Artist", "duration_ms": 30_000,
                    "artwork_url": "https://example.test/art.jpg",
                    "provider_identifier": {
                        "provider": "apple_music", "catalog_id": "catalog-1",
                        "library_id": "library-1", "storefront": "us",
                    },
                },
                "duration_seconds": 30,
                "intervals": [
                    {
                        "start_seconds": 0,
                        "end_seconds": 30,
                        "type": "work",
                        "exercise": "Plank",
                        "exercise_id": "core-plank",
                    }
                ],
            }
        ],
    }
