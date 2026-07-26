from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api_models import (
    MAX_BLOCK_DURATION_SECONDS,
    MAX_EQUIPMENT_COUNT,
    MAX_EXERCISE_ID_LENGTH,
    MAX_EXERCISE_NAME_LENGTH,
    MAX_INTERVAL_TYPE_LENGTH,
    MAX_INTERVALS_PER_BLOCK,
    MAX_RANDOM_SEED,
    MAX_SESSION_ELAPSED_SECONDS,
    MAX_SONG_COUNT,
    MAX_SONG_DURATION_MS,
    MAX_WORKOUT_INTERVAL_COUNT,
    MIN_RANDOM_SEED,
    Song,
    WorkoutBlock,
    WorkoutCreate,
    WorkoutInterval,
    WorkoutSessionUpdate,
)
from app.auth import get_token_verifier
from app.database import Base, get_db
from app.main import app
from app.persistence_routes import MAX_PAGE_NUMBER
from tests.database_safety import configured_postgresql_test_database_url

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
    test_database_url = configured_postgresql_test_database_url()
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


@pytest.mark.parametrize("random_seed", [MIN_RANDOM_SEED, MAX_RANDOM_SEED])
def test_workout_persistence_accepts_storage_boundaries(
    client: TestClient,
    random_seed: int,
):
    payload = _workout_payload()
    payload["equipment"] = ["bodyweight", "dumbbells", "gym"]
    payload["random_seed"] = random_seed
    blocks = [
        _one_second_block(
            index,
            interval_type="t" * MAX_INTERVAL_TYPE_LENGTH,
            exercise="e" * MAX_EXERCISE_NAME_LENGTH,
            exercise_id="i" * MAX_EXERCISE_ID_LENGTH,
        )
        for index in range(MAX_SONG_COUNT)
    ]
    blocks[0]["song"]["duration_ms"] = MAX_SONG_DURATION_MS
    blocks[0]["duration_seconds"] = MAX_BLOCK_DURATION_SECONDS
    blocks[0]["intervals"][0]["end_seconds"] = MAX_BLOCK_DURATION_SECONDS
    payload["blocks"] = blocks

    response = client.post("/workouts", json=payload)

    assert response.status_code == 201
    assert len(response.json()["equipment"]) == MAX_EQUIPMENT_COUNT
    assert len(response.json()["blocks"]) == MAX_SONG_COUNT
    assert response.json()["random_seed"] == random_seed


def test_workout_model_enforces_interval_count_boundaries():
    interval = WorkoutInterval(
        start_seconds=0,
        end_seconds=1,
        type="work",
        exercise="Plank",
    )
    exact_block = WorkoutBlock(
        song=Song(title="Song", artist="Artist", duration_ms=1_000),
        duration_seconds=1,
        intervals=[interval] * MAX_INTERVALS_PER_BLOCK,
    )

    exact_workout = _workout_model_with_interval_count(MAX_WORKOUT_INTERVAL_COUNT)

    assert len(exact_block.intervals) == MAX_INTERVALS_PER_BLOCK
    assert sum(len(block.intervals) for block in exact_workout.blocks) == (
        MAX_WORKOUT_INTERVAL_COUNT
    )
    with pytest.raises(ValidationError):
        WorkoutBlock(
            song=Song(title="Song", artist="Artist", duration_ms=1_000),
            duration_seconds=1,
            intervals=[interval] * (MAX_INTERVALS_PER_BLOCK + 1),
        )
    with pytest.raises(ValidationError):
        _workout_model_with_interval_count(MAX_WORKOUT_INTERVAL_COUNT + 1)


def test_workout_persistence_accepts_exact_aggregate_duration(client: TestClient):
    payload = _workout_payload()
    payload["blocks"] = [
        {
            "song": {
                "title": f"Hour {index}",
                "artist": "Artist",
                "duration_ms": MAX_SONG_DURATION_MS,
            },
            "duration_seconds": MAX_BLOCK_DURATION_SECONDS,
            "intervals": [
                {
                    "start_seconds": 0,
                    "end_seconds": MAX_BLOCK_DURATION_SECONDS,
                    "type": "work",
                    "exercise": "Plank",
                }
            ],
        }
        for index in range(4)
    ]

    response = client.post("/workouts", json=payload)

    assert response.status_code == 201


@pytest.mark.parametrize(
    "limit_name",
    [
        "equipment",
        "blocks",
        "random_seed_below",
        "random_seed_above",
        "interval_type",
        "exercise_name",
        "exercise_id",
        "block_duration",
        "interval_end",
        "song_duration_total",
        "block_duration_total",
        "intervals_per_block",
    ],
)
def test_workout_persistence_rejects_payloads_over_limits(
    client: TestClient,
    limit_name: str,
):
    response = client.post(
        "/workouts",
        json=_over_limit_workout_payload(limit_name),
    )

    assert response.status_code == 422


@pytest.mark.parametrize("invalid_shape", ["zero_duration", "gap", "song_mismatch"])
def test_workout_persistence_rejects_invalid_timing(
    client: TestClient,
    invalid_shape: str,
):
    payload = _workout_payload()
    if invalid_shape == "zero_duration":
        payload["blocks"][0]["intervals"][0] = {
            "start_seconds": 10,
            "end_seconds": 10,
            "type": "work",
            "exercise": "Plank",
        }
    elif invalid_shape == "gap":
        payload["blocks"][0]["intervals"] = [
            {
                "start_seconds": 0,
                "end_seconds": 10,
                "type": "work",
                "exercise": "Plank",
            },
            {
                "start_seconds": 11,
                "end_seconds": 30,
                "type": "work",
                "exercise": "Plank",
            },
        ]
    else:
        payload["blocks"][0]["duration_seconds"] = 29
        payload["blocks"][0]["intervals"][0]["end_seconds"] = 29

    response = client.post("/workouts", json=payload)

    assert response.status_code == 422


def test_workout_persistence_uses_generator_rounding_for_block_duration(
    client: TestClient,
):
    payload = _workout_payload()
    payload["blocks"][0]["song"]["duration_ms"] = 30_500

    response = client.post("/workouts", json=payload)

    assert response.status_code == 201


@pytest.mark.parametrize("endpoint", ["/workouts", "/workout-sessions"])
def test_persistence_page_number_has_an_upper_bound(
    client: TestClient,
    endpoint: str,
):
    boundary = client.get(endpoint, params={"page": MAX_PAGE_NUMBER})
    over_limit = client.get(endpoint, params={"page": MAX_PAGE_NUMBER + 1})

    assert boundary.status_code == 200
    assert over_limit.status_code == 422


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


def test_session_elapsed_seconds_accepts_int32_boundary_and_rejects_overflow(
    client: TestClient,
):
    workout_id = client.post("/workouts", json=_workout_payload()).json()["id"]
    now = datetime.now(UTC)
    created = client.post(
        "/workout-sessions",
        json={
            "workout_id": workout_id,
            "started_at": now.isoformat(),
            "ended_at": now.isoformat(),
            "actual_elapsed_seconds": MAX_SESSION_ELAPSED_SECONDS,
            "completed_intervals": 0,
            "completed_work_intervals": 0,
            "completed_song_blocks": 0,
            "status": "ended_early",
        },
    )

    assert created.status_code == 201
    assert created.json()["actual_elapsed_seconds"] == MAX_SESSION_ELAPSED_SECONDS
    overflow = client.patch(
        f"/workout-sessions/{created.json()['id']}",
        json={"actual_elapsed_seconds": MAX_SESSION_ELAPSED_SECONDS + 1},
    )
    assert overflow.status_code == 422


def test_session_count_models_enforce_exact_boundaries():
    boundary = WorkoutSessionUpdate(
        completed_intervals=MAX_WORKOUT_INTERVAL_COUNT,
        completed_work_intervals=MAX_WORKOUT_INTERVAL_COUNT,
        completed_song_blocks=MAX_SONG_COUNT,
    )

    assert boundary.completed_intervals == MAX_WORKOUT_INTERVAL_COUNT
    assert boundary.completed_work_intervals == MAX_WORKOUT_INTERVAL_COUNT
    assert boundary.completed_song_blocks == MAX_SONG_COUNT
    for field_name, over_limit in (
        ("completed_intervals", MAX_WORKOUT_INTERVAL_COUNT + 1),
        ("completed_work_intervals", MAX_WORKOUT_INTERVAL_COUNT + 1),
        ("completed_song_blocks", MAX_SONG_COUNT + 1),
    ):
        with pytest.raises(ValidationError):
            WorkoutSessionUpdate.model_validate({field_name: over_limit})


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

    authenticated = client.get("/workouts", headers={"Authorization": "Bearer valid-user-one"})
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
                    "title": "Song",
                    "artist": "Artist",
                    "duration_ms": 30_000,
                    "artwork_url": "https://example.test/art.jpg",
                    "provider_identifier": {
                        "provider": "apple_music",
                        "catalog_id": "catalog-1",
                        "library_id": "library-1",
                        "storefront": "us",
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


def _one_second_block(
    index: int,
    *,
    interval_type: str = "work",
    exercise: str = "Plank",
    exercise_id: str | None = "core-plank",
) -> dict:
    return {
        "song": {
            "title": f"Song {index}",
            "artist": "Artist",
            "duration_ms": 1,
        },
        "duration_seconds": 1,
        "intervals": [
            {
                "start_seconds": 0,
                "end_seconds": 1,
                "type": interval_type,
                "exercise": exercise,
                "exercise_id": exercise_id,
            }
        ],
    }


def _workout_model_with_interval_count(interval_count: int) -> WorkoutCreate:
    interval = WorkoutInterval(
        start_seconds=0,
        end_seconds=1,
        type="work",
        exercise="Plank",
    )
    blocks: list[WorkoutBlock] = []
    remaining = interval_count
    while remaining:
        block_interval_count = min(remaining, MAX_INTERVALS_PER_BLOCK)
        blocks.append(
            WorkoutBlock(
                song=Song(
                    title=f"Song {len(blocks)}",
                    artist="Artist",
                    duration_ms=1_000,
                ),
                duration_seconds=1,
                intervals=[interval] * block_interval_count,
            )
        )
        remaining -= block_interval_count
    return WorkoutCreate(
        muscle_group="core",
        difficulty="intermediate",
        equipment=["bodyweight"],
        blocks=blocks,
    )


def _over_limit_workout_payload(limit_name: str) -> dict:
    payload = _workout_payload()
    interval = payload["blocks"][0]["intervals"][0]

    if limit_name == "equipment":
        payload["equipment"] = ["bodyweight", "dumbbells", "gym", "bodyweight"]
    elif limit_name == "blocks":
        payload["blocks"] = [_one_second_block(index) for index in range(MAX_SONG_COUNT + 1)]
    elif limit_name == "random_seed_below":
        payload["random_seed"] = MIN_RANDOM_SEED - 1
    elif limit_name == "random_seed_above":
        payload["random_seed"] = MAX_RANDOM_SEED + 1
    elif limit_name == "interval_type":
        interval["type"] = "t" * (MAX_INTERVAL_TYPE_LENGTH + 1)
    elif limit_name == "exercise_name":
        interval["exercise"] = "e" * (MAX_EXERCISE_NAME_LENGTH + 1)
    elif limit_name == "exercise_id":
        interval["exercise_id"] = "i" * (MAX_EXERCISE_ID_LENGTH + 1)
    elif limit_name == "block_duration":
        payload["blocks"][0]["duration_seconds"] = MAX_BLOCK_DURATION_SECONDS + 1
        interval["end_seconds"] = MAX_BLOCK_DURATION_SECONDS
    elif limit_name == "interval_end":
        interval["end_seconds"] = MAX_BLOCK_DURATION_SECONDS + 1
    elif limit_name == "song_duration_total":
        payload["blocks"] = [
            {
                "song": {
                    "title": f"Hour {index}",
                    "artist": "Artist",
                    "duration_ms": MAX_SONG_DURATION_MS,
                },
                "duration_seconds": MAX_BLOCK_DURATION_SECONDS,
                "intervals": [
                    {
                        "start_seconds": 0,
                        "end_seconds": MAX_BLOCK_DURATION_SECONDS,
                        "type": "work",
                        "exercise": "Plank",
                    }
                ],
            }
            for index in range(5)
        ]
    elif limit_name == "block_duration_total":
        payload["blocks"] = [
            {
                **_one_second_block(index),
                "duration_seconds": MAX_BLOCK_DURATION_SECONDS,
                "intervals": [
                    {
                        "start_seconds": 0,
                        "end_seconds": MAX_BLOCK_DURATION_SECONDS,
                        "type": "work",
                        "exercise": "Plank",
                    }
                ],
            }
            for index in range(5)
        ]
    elif limit_name == "intervals_per_block":
        payload["blocks"][0]["song"]["duration_ms"] = MAX_SONG_DURATION_MS
        payload["blocks"][0]["duration_seconds"] = MAX_BLOCK_DURATION_SECONDS
        payload["blocks"][0]["intervals"] = [
            {
                "start_seconds": 0,
                "end_seconds": 1,
                "type": "work",
                "exercise": "Plank",
            }
        ] * (MAX_INTERVALS_PER_BLOCK + 1)
    else:
        raise AssertionError(f"Unhandled persistence limit: {limit_name}")

    return payload
