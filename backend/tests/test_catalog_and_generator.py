from itertools import pairwise

import pytest
from fastapi.testclient import TestClient

from app.domain import Difficulty, Equipment, MuscleGroup
from app.exercise_catalog import EXERCISE_CATALOG
from app.main import app


client = TestClient(app)
CATALOG_BY_ID = {exercise.id: exercise for exercise in EXERCISE_CATALOG}


def test_exercise_catalog_endpoint_and_filters():
    response = client.get(
        "/exercises",
        params={"muscle_group": "chest", "equipment": "dumbbells", "difficulty": "beginner"},
    )

    assert response.status_code == 200
    exercises = response.json()
    assert len(exercises) >= 2
    assert all("dumbbells" in exercise["equipment"] for exercise in exercises)
    assert all(exercise["minimum_difficulty"] == "beginner" for exercise in exercises)
    assert all(
        exercise["primary_muscle_group"] == "chest"
        or "chest" in exercise["secondary_muscle_groups"]
        for exercise in exercises
    )
    assert all(exercise["instructions"] for exercise in exercises)


@pytest.mark.parametrize("equipment", list(Equipment))
def test_generator_filters_exercises_by_equipment(equipment: Equipment):
    response = client.post(
        "/workouts/generate",
        json=_payload(equipment=[equipment], random_seed=11),
    )

    assert response.status_code == 200
    for exercise_id in _exercise_ids(response.json()):
        assert equipment in CATALOG_BY_ID[exercise_id].equipment


def test_beginner_workout_excludes_harder_exercises():
    response = client.post(
        "/workouts/generate",
        json=_payload(difficulty="beginner", equipment=["gym"], random_seed=7),
    )

    assert response.status_code == 200
    for exercise_id in _exercise_ids(response.json()):
        assert CATALOG_BY_ID[exercise_id].minimum_difficulty == Difficulty.beginner


@pytest.mark.parametrize("muscle_group", list(MuscleGroup))
@pytest.mark.parametrize("equipment", list(Equipment))
@pytest.mark.parametrize("difficulty", list(Difficulty))
def test_every_supported_combination_generates_a_workout(
    muscle_group: MuscleGroup,
    equipment: Equipment,
    difficulty: Difficulty,
):
    response = client.post(
        "/workouts/generate",
        json=_payload(
            muscle_group=muscle_group,
            equipment=[equipment],
            difficulty=difficulty,
            duration_ms=90_000,
            random_seed=3,
        ),
    )

    assert response.status_code == 200
    assert response.json()["blocks"][0]["intervals"]


@pytest.mark.parametrize("duration_ms", [1, 8_000, 21_000, 225_000, 1_200_000])
def test_interval_timing_is_contiguous_and_exact(duration_ms: int):
    response = client.post(
        "/workouts/generate",
        json=_payload(duration_ms=duration_ms, random_seed=19),
    )

    assert response.status_code == 200
    block = response.json()["blocks"][0]
    intervals = block["intervals"]
    assert intervals[0]["start_seconds"] == 0
    assert intervals[-1]["end_seconds"] == block["duration_seconds"]
    assert all(interval["start_seconds"] < interval["end_seconds"] for interval in intervals)
    assert all(
        previous["end_seconds"] == current["start_seconds"]
        for previous, current in pairwise(intervals)
    )
    assert all(interval["end_seconds"] <= block["duration_seconds"] for interval in intervals)


def test_random_seed_produces_deterministic_output():
    payload = _payload(
        muscle_group="full_body",
        equipment=["bodyweight", "dumbbells", "gym"],
        difficulty="advanced",
        goal="cardio",
        random_seed=42,
    )

    first = client.post("/workouts/generate", json=payload)
    second = client.post("/workouts/generate", json=payload)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()


def test_multi_song_playlist_preserves_every_song_and_reduces_repetition():
    songs = [
        {"title": f"Song {index}", "artist": "Artist", "duration_ms": 240_000}
        for index in range(4)
    ]
    response = client.post(
        "/workouts/generate",
        json=_payload(
            muscle_group="legs",
            equipment=["bodyweight", "dumbbells"],
            difficulty="advanced",
            random_seed=22,
            songs=songs,
        ),
    )

    assert response.status_code == 200
    data = response.json()
    assert [block["song"]["title"] for block in data["blocks"]] == [
        song["title"] for song in songs
    ]
    work_ids = [
        interval["exercise_id"]
        for block in data["blocks"]
        for interval in block["intervals"]
        if interval["type"] in {"work", "burnout"}
    ]
    assert all(previous != current for previous, current in pairwise(work_ids))
    assert len(set(work_ids)) >= 3


def test_high_impact_exercises_are_not_consecutive_when_alternatives_exist():
    response = client.post(
        "/workouts/generate",
        json=_payload(
            muscle_group="full_body",
            equipment=["bodyweight", "dumbbells", "gym"],
            difficulty="advanced",
            goal="cardio",
            duration_ms=900_000,
            random_seed=8,
        ),
    )

    exercises = [CATALOG_BY_ID[exercise_id] for exercise_id in _exercise_ids(response.json())]
    assert not any(previous.high_impact and current.high_impact for previous, current in pairwise(exercises))


def test_invalid_equipment_goal_and_filters_fail_validation():
    bad_equipment = client.post(
        "/workouts/generate",
        json=_payload(equipment=["resistance_bands"]),
    )
    bad_goal = client.post("/workouts/generate", json=_payload(goal="mobility"))
    bad_filter = client.get("/exercises", params={"difficulty": "elite"})

    assert bad_equipment.status_code == 422
    assert bad_goal.status_code == 422
    assert bad_filter.status_code == 422


def test_omitted_goal_uses_backward_compatible_default():
    without_goal = _payload(random_seed=5)
    without_goal.pop("goal")
    explicit_goal = {**without_goal, "goal": "endurance"}

    default_response = client.post("/workouts/generate", json=without_goal)
    explicit_response = client.post("/workouts/generate", json=explicit_goal)

    assert default_response.status_code == explicit_response.status_code == 200
    assert default_response.json()["goal"] == "endurance"
    assert default_response.json() == explicit_response.json()


def _exercise_ids(workout: dict) -> list[str]:
    return [
        interval["exercise_id"]
        for block in workout["blocks"]
        for interval in block["intervals"]
        if interval["exercise_id"] is not None
    ]


def _payload(
    *,
    muscle_group: MuscleGroup | str = "chest",
    difficulty: Difficulty | str = "intermediate",
    equipment: list[Equipment | str] | None = None,
    duration_ms: int = 225_000,
    goal: str = "endurance",
    random_seed: int | None = None,
    songs: list[dict] | None = None,
) -> dict:
    return {
        "muscle_group": muscle_group,
        "difficulty": difficulty,
        "equipment": equipment or ["bodyweight"],
        "goal": goal,
        "random_seed": random_seed,
        "songs": songs
        or [{"title": "Song 1", "artist": "Test Artist", "duration_ms": duration_ms}],
    }
