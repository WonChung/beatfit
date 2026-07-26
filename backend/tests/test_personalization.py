from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api_models import (
    MAX_EQUIPMENT_COUNT,
    MAX_EXERCISE_ID_LENGTH,
    MAX_PREFERENCE_EXERCISE_ID_COUNT,
    MAX_SONG_DURATION_MS,
    GeneratedWorkout,
    UserPreferencesUpdate,
)
from app.auth import get_token_verifier
from app.database import Base, get_db
from app.exercise_catalog import EXERCISE_CATALOG
from app.main import app

USER_ONE_ID = "11111111-1111-4111-8111-111111111111"
USER_TWO_ID = "22222222-2222-4222-8222-222222222222"
CATALOG = {exercise.id: exercise for exercise in EXERCISE_CATALOG}


class TestTokenVerifier:
    def verify(self, token: str) -> dict:
        if token == "valid-user-one":
            return {"sub": USER_ONE_ID, "email": "one@example.com", "role": "authenticated"}
        if token == "valid-user-two":
            return {"sub": USER_TWO_ID, "email": "two@example.com", "role": "authenticated"}
        raise jwt.InvalidTokenError()


@pytest.fixture()
def client() -> TestClient:
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
    Base.metadata.drop_all(engine)
    engine.dispose()


def test_preferences_have_safe_defaults_and_are_user_owned(client: TestClient):
    defaults = client.get("/user-preferences")
    assert defaults.status_code == 200
    assert defaults.json()["default_difficulty"] == "intermediate"
    assert defaults.json()["available_equipment"] == ["bodyweight"]
    assert defaults.json()["preferred_goal"] == "endurance"
    assert defaults.json()["work_rest_preference"] == "balanced"

    updated = client.put(
        "/user-preferences",
        json={"available_equipment": ["bodyweight", "dumbbells"]},
    )
    assert updated.status_code == 200
    other = client.get(
        "/user-preferences",
        headers={"Authorization": "Bearer valid-user-two"},
    )
    assert other.json()["available_equipment"] == ["bodyweight"]


def test_preference_payload_accepts_exact_schema_boundaries(client: TestClient):
    exercise_id = "e" * MAX_EXERCISE_ID_LENGTH
    payload = UserPreferencesUpdate(
        available_equipment=["bodyweight", "dumbbells", "gym"],
        avoided_exercise_ids=[exercise_id] * MAX_PREFERENCE_EXERCISE_ID_COUNT,
        favorite_exercise_ids=[exercise_id] * MAX_PREFERENCE_EXERCISE_ID_COUNT,
    )

    assert len(payload.available_equipment or []) == MAX_EQUIPMENT_COUNT
    assert len(payload.avoided_exercise_ids or []) == MAX_PREFERENCE_EXERCISE_ID_COUNT
    assert len(payload.favorite_exercise_ids or []) == MAX_PREFERENCE_EXERCISE_ID_COUNT

    response = client.put(
        "/user-preferences",
        json={
            "available_equipment": ["bodyweight", "dumbbells", "gym"],
            "avoided_exercise_ids": [EXERCISE_CATALOG[0].id] * MAX_PREFERENCE_EXERCISE_ID_COUNT,
        },
    )
    assert response.status_code == 200
    assert response.json()["available_equipment"] == [
        "bodyweight",
        "dumbbells",
        "gym",
    ]


@pytest.mark.parametrize(
    "payload",
    [
        {"available_equipment": ["bodyweight", "dumbbells", "gym", "bodyweight"]},
        {"avoided_exercise_ids": ["core-plank"] * (MAX_PREFERENCE_EXERCISE_ID_COUNT + 1)},
        {
            "favorite_exercise_ids": ["e" * (MAX_EXERCISE_ID_LENGTH + 1)],
        },
    ],
)
def test_preference_payload_rejects_over_limits(
    client: TestClient,
    payload: dict,
):
    response = client.put("/user-preferences", json=payload)

    assert response.status_code == 422


def test_preferences_and_personalized_generation_require_authentication(
    client: TestClient,
):
    client.headers.pop("Authorization")
    assert client.get("/user-preferences").status_code == 401
    assert (
        client.post("/workouts/generate/personalized", json=_generate_payload()).status_code == 401
    )


def test_public_generation_and_old_snapshots_use_neutral_explanation(client: TestClient):
    public_workout = client.post("/workouts/generate", json=_generate_payload()).json()
    old_snapshot = {
        key: value
        for key, value in public_workout.items()
        if key not in {"personalization", "workout_id"}
    }

    restored = GeneratedWorkout.model_validate(old_snapshot)

    assert public_workout["personalization"] == {
        "personalized": False,
        "summary": "No personalization was applied.",
        "feedback_signal": None,
        "history_sessions_considered": 0,
        "adjustments": [],
    }
    assert restored.personalization.personalized is False


def test_two_too_easy_ratings_progress_difficulty_and_exercises(client: TestClient):
    _add_feedback_sessions(client, ["too_easy", "too_easy"])

    response = client.post("/workouts/generate/personalized", json=_generate_payload())

    assert response.status_code == 200
    workout = response.json()
    assert workout["difficulty"] == "advanced"
    assert workout["workout_id"] is not None
    persisted = client.get(f"/workouts/{workout['workout_id']}")
    assert persisted.status_code == 200
    assert persisted.json()["difficulty"] == "advanced"
    assert workout["personalization"]["feedback_signal"] == "too_easy"
    assert "two recent matching workouts" in workout["personalization"]["summary"]
    assert any(
        CATALOG[exercise_id].minimum_difficulty.value == "advanced"
        for exercise_id in _exercise_ids(workout)
    )


def test_two_too_hard_ratings_reduce_difficulty_and_add_rest(client: TestClient):
    _add_feedback_sessions(client, ["too_hard", "too_hard"])
    payload = _generate_payload()

    baseline = client.post("/workouts/generate", json=payload).json()
    response = client.post("/workouts/generate/personalized", json=payload)

    assert response.status_code == 200
    workout = response.json()
    assert workout["difficulty"] == "beginner"
    assert _first_interval_duration(workout, "rest") > _first_interval_duration(baseline, "rest")
    assert _first_interval_duration(workout, "work") < _first_interval_duration(baseline, "work")
    assert workout["personalization"]["summary"].startswith("Rest increased")


def test_about_right_maintains_requested_structure(client: TestClient):
    _add_feedback_sessions(client, ["about_right", "about_right"])
    payload = _generate_payload()

    baseline = client.post("/workouts/generate", json=payload).json()
    personalized = client.post("/workouts/generate/personalized", json=payload).json()

    assert personalized["difficulty"] == baseline["difficulty"]
    assert _timing_signature(personalized) == _timing_signature(baseline)
    assert personalized["personalization"]["feedback_signal"] == "about_right"


def test_single_rating_is_insufficient_for_feedback_adjustment(client: TestClient):
    _add_feedback_sessions(client, ["too_easy"])

    workout = client.post("/workouts/generate/personalized", json=_generate_payload()).json()

    assert workout["difficulty"] == "intermediate"
    assert workout["personalization"]["feedback_signal"] is None
    assert "fewer than two" in workout["personalization"]["summary"]


def test_opposite_rating_blocks_feedback_adjustment(client: TestClient):
    _add_feedback_sessions(client, ["too_easy", "too_easy", "too_hard"])

    workout = client.post("/workouts/generate/personalized", json=_generate_payload()).json()

    assert workout["difficulty"] == "intermediate"
    assert workout["personalization"]["feedback_signal"] is None
    assert "conflict" in workout["personalization"]["summary"]


def test_avoided_exercise_is_a_hard_constraint(client: TestClient):
    avoided_id = "chest-bodyweight-push-up"
    assert (
        client.put("/user-preferences", json={"avoided_exercise_ids": [avoided_id]}).status_code
        == 200
    )

    workout = client.post("/workouts/generate/personalized", json=_generate_payload()).json()

    assert avoided_id not in _exercise_ids(workout)
    assert "Avoided exercises were excluded." in workout["personalization"]["adjustments"]


def test_compatible_favorite_is_preferred(client: TestClient):
    favorite_id = "chest-bodyweight-push-up"
    client.put("/user-preferences", json={"favorite_exercise_ids": [favorite_id]})
    payload = _generate_payload(difficulty="beginner")

    workout = client.post("/workouts/generate/personalized", json=payload).json()
    work_ids = [
        interval["exercise_id"]
        for block in workout["blocks"]
        for interval in block["intervals"]
        if interval["type"] == "work"
    ]

    assert favorite_id in work_ids


def test_avoid_wins_when_an_exercise_is_also_favorite(client: TestClient):
    conflicted_id = "chest-bodyweight-push-up"
    client.put(
        "/user-preferences",
        json={
            "avoided_exercise_ids": [conflicted_id],
            "favorite_exercise_ids": [conflicted_id],
        },
    )

    workout = client.post("/workouts/generate/personalized", json=_generate_payload()).json()

    assert conflicted_id not in _exercise_ids(workout)
    assert (
        "Compatible favorite exercises were preferred."
        not in workout["personalization"]["adjustments"]
    )


def test_unavailable_equipment_is_rejected_instead_of_overridden(client: TestClient):
    response = client.post(
        "/workouts/generate/personalized",
        json=_generate_payload(equipment=["dumbbells"]),
    )

    assert response.status_code == 422
    assert "not available" in response.json()["detail"]


def test_personalized_generation_uses_bounded_generation_request(client: TestClient):
    valid_payload = _generate_payload()
    valid_payload["songs"][0]["duration_ms"] = 1_200_000
    over_limit_payload = _generate_payload()
    over_limit_payload["songs"][0]["duration_ms"] = MAX_SONG_DURATION_MS + 1

    valid_response = client.post(
        "/workouts/generate/personalized",
        json=valid_payload,
    )
    over_limit_response = client.post(
        "/workouts/generate/personalized",
        json=over_limit_payload,
    )

    assert valid_response.status_code == 200
    assert over_limit_response.status_code == 422


def test_high_impact_disabled_and_explicit_goal_and_muscle_remain(client: TestClient):
    client.put(
        "/user-preferences",
        json={
            "available_equipment": ["bodyweight", "gym"],
            "preferred_goal": "strength",
            "high_impact_allowed": False,
        },
    )
    payload = _generate_payload(
        muscle_group="full_body",
        goal="cardio",
        difficulty="advanced",
        equipment=["bodyweight", "gym"],
    )

    workout = client.post("/workouts/generate/personalized", json=payload).json()

    assert workout["muscle_group"] == "full_body"
    assert workout["goal"] == "cardio"
    assert all(not CATALOG[exercise_id].high_impact for exercise_id in _exercise_ids(workout))


def test_work_rest_preference_applies_a_modest_deterministic_bias(client: TestClient):
    client.put("/user-preferences", json={"work_rest_preference": "more_rest"})
    payload = _generate_payload()

    first = client.post("/workouts/generate/personalized", json=payload).json()
    second = client.post("/workouts/generate/personalized", json=payload).json()
    baseline = client.post("/workouts/generate", json=payload).json()

    assert _without_workout_id(first) == _without_workout_id(second)
    assert _first_interval_duration(first, "rest") == _first_interval_duration(baseline, "rest") + 5
    assert _first_interval_duration(first, "work") == _first_interval_duration(baseline, "work") - 5


def test_reset_excludes_all_earlier_feedback_without_erasing_preferences(client: TestClient):
    client.put("/user-preferences", json={"favorite_exercise_ids": ["chest-bodyweight-push-up"]})
    _add_feedback_sessions(client, ["too_easy", "too_easy"])
    before = client.post("/workouts/generate/personalized", json=_generate_payload()).json()
    assert before["difficulty"] == "advanced"

    reset = client.post("/user-preferences/reset")
    after = client.post("/workouts/generate/personalized", json=_generate_payload()).json()

    assert reset.status_code == 200
    assert reset.json()["history_reset_at"] is not None
    assert reset.json()["favorite_exercise_ids"] == ["chest-bodyweight-push-up"]
    assert after["difficulty"] == "intermediate"
    assert after["personalization"]["history_sessions_considered"] == 0


def test_invalid_exercise_preference_is_rejected(client: TestClient):
    response = client.put("/user-preferences", json={"favorite_exercise_ids": ["not-in-catalog"]})
    assert response.status_code == 422


def _add_feedback_sessions(client: TestClient, ratings: list[str]) -> None:
    base_time = datetime.now(UTC) - timedelta(hours=1)
    for index, rating in enumerate(ratings):
        workout_id = client.post("/workouts", json=_persisted_workout_payload()).json()["id"]
        ended_at = base_time + timedelta(minutes=index)
        response = client.post(
            "/workout-sessions",
            json={
                "workout_id": workout_id,
                "started_at": (ended_at - timedelta(seconds=225)).isoformat(),
                "ended_at": ended_at.isoformat(),
                "actual_elapsed_seconds": 225,
                "completed_intervals": 1,
                "completed_work_intervals": 1,
                "completed_song_blocks": 1,
                "status": "completed",
                "feedback": {"rating": rating},
            },
        )
        assert response.status_code == 201


def _persisted_workout_payload() -> dict:
    return {
        "muscle_group": "chest",
        "difficulty": "intermediate",
        "equipment": ["bodyweight"],
        "goal": "endurance",
        "blocks": [
            {
                "song": {"title": "History", "artist": "BeatFit", "duration_ms": 225_000},
                "duration_seconds": 225,
                "intervals": [
                    {
                        "start_seconds": 0,
                        "end_seconds": 225,
                        "type": "work",
                        "exercise": "Push-up",
                        "exercise_id": "chest-bodyweight-push-up",
                    }
                ],
            }
        ],
    }


def _generate_payload(
    *,
    muscle_group: str = "chest",
    difficulty: str = "intermediate",
    equipment: list[str] | None = None,
    goal: str = "endurance",
) -> dict:
    return {
        "muscle_group": muscle_group,
        "difficulty": difficulty,
        "equipment": equipment or ["bodyweight"],
        "goal": goal,
        "random_seed": 13,
        "songs": [{"title": "Current", "artist": "BeatFit", "duration_ms": 225_000}],
    }


def _exercise_ids(workout: dict) -> list[str]:
    return [
        interval["exercise_id"]
        for block in workout["blocks"]
        for interval in block["intervals"]
        if interval["exercise_id"] is not None
    ]


def _first_interval_duration(workout: dict, interval_type: str) -> int:
    interval = next(
        interval
        for interval in workout["blocks"][0]["intervals"]
        if interval["type"] == interval_type
    )
    return interval["end_seconds"] - interval["start_seconds"]


def _timing_signature(workout: dict) -> list[tuple[str, int]]:
    return [
        (interval["type"], interval["end_seconds"] - interval["start_seconds"])
        for interval in workout["blocks"][0]["intervals"]
    ]


def _without_workout_id(workout: dict) -> dict:
    return {key: value for key, value in workout.items() if key != "workout_id"}
