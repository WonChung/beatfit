from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "app": "BeatFit API"}


def test_valid_chest_workout_request():
    response = client.post("/workouts/generate", json=_request_payload())

    assert response.status_code == 200
    data = response.json()
    assert data["muscle_group"] == "chest"
    assert data["difficulty"] == "intermediate"
    assert data["equipment"] == ["bodyweight"]
    assert len(data["blocks"]) == 1
    assert data["blocks"][0]["duration_seconds"] == 225
    assert data["blocks"][0]["intervals"][0]["type"] == "warmup"
    assert data["blocks"][0]["intervals"][-1]["type"] == "burnout"


def test_spotify_song_metadata_does_not_require_apple_storefront():
    payload = _request_payload()
    payload["songs"][0].update(
        {
            "artwork_url": "https://i.scdn.co/image/example",
            "provider_identifier": {
                "provider": "spotify",
                "catalog_id": "spotify-track-1",
            },
        }
    )

    response = client.post("/workouts/generate", json=payload)

    assert response.status_code == 200
    song = response.json()["blocks"][0]["song"]
    assert song["provider_identifier"] == {
        "provider": "spotify",
        "catalog_id": "spotify-track-1",
    }


def test_apple_song_metadata_still_requires_storefront():
    payload = _request_payload()
    payload["songs"][0]["provider_identifier"] = {
        "provider": "apple_music",
        "catalog_id": "apple-track-1",
    }

    response = client.post("/workouts/generate", json=payload)

    assert response.status_code == 422


def test_intervals_are_non_overlapping():
    response = client.post("/workouts/generate", json=_request_payload())

    intervals = response.json()["blocks"][0]["intervals"]
    for previous, current in zip(intervals, intervals[1:], strict=False):
        assert previous["end_seconds"] == current["start_seconds"]
        assert previous["start_seconds"] < previous["end_seconds"]
        assert current["start_seconds"] < current["end_seconds"]


def test_final_interval_ends_at_song_duration():
    response = client.post("/workouts/generate", json=_request_payload())

    block = response.json()["blocks"][0]
    assert block["intervals"][-1]["end_seconds"] == block["duration_seconds"]


def test_invalid_muscle_group_fails_validation():
    payload = _request_payload()
    payload["muscle_group"] = "calves"

    response = client.post("/workouts/generate", json=payload)

    assert response.status_code == 422


def test_short_song_still_returns_valid_intervals():
    payload = _request_payload(duration_ms=8000)

    response = client.post("/workouts/generate", json=payload)

    assert response.status_code == 200
    block = response.json()["blocks"][0]
    intervals = block["intervals"]
    assert intervals
    assert intervals[0]["start_seconds"] == 0
    assert intervals[-1]["end_seconds"] == block["duration_seconds"]
    for previous, current in zip(intervals, intervals[1:], strict=False):
        assert previous["end_seconds"] == current["start_seconds"]
        assert previous["end_seconds"] <= block["duration_seconds"]


def _request_payload(duration_ms: int = 225000):
    return {
        "muscle_group": "chest",
        "difficulty": "intermediate",
        "equipment": ["bodyweight"],
        "songs": [
            {
                "title": "Song 1",
                "artist": "Test Artist",
                "duration_ms": duration_ms,
            }
        ],
    }
