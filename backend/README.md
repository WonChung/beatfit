# BeatFit Backend

The BeatFit API uses FastAPI and generates timed workouts from a structured,
filterable exercise catalog.

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
fastapi dev app/main.py
```

Interactive documentation is available at `http://127.0.0.1:8000/docs`.

## Architecture

- `app/domain.py`: exercise and workout domain enums/models.
- `app/api_models.py`: Pydantic request and response schemas.
- `app/exercise_catalog.py`: seeded exercise data and catalog filtering.
- `app/generator_service.py`: playlist-aware workout generation.
- `app/routes.py`: FastAPI route handlers.
- `app/models.py` and `app/workout_generator.py`: compatibility exports for
  older imports.

## Generate a workout

`POST /workouts/generate`

```json
{
  "muscle_group": "legs",
  "difficulty": "intermediate",
  "equipment": ["bodyweight", "dumbbells"],
  "goal": "endurance",
  "random_seed": 42,
  "songs": [
    {
      "title": "Song 1",
      "artist": "Test Artist",
      "duration_ms": 225000
    }
  ]
}
```

Supported goals are `strength`, `pump`, `endurance`, and `cardio`. `goal`
defaults to `endurance`, so clients using the original request shape remain
valid. `random_seed` is optional; supplying it makes exercise selection
deterministic.

Equipment values are `bodyweight`, `dumbbells`, and `gym`.

The response keeps the original workout fields and also includes `goal` and an
optional `exercise_id` on each interval. Rest intervals have no exercise ID.

## Exercise catalog

`GET /exercises`

Optional query filters:

- `muscle_group`
- `equipment`
- `difficulty`

Example:

```text
GET /exercises?muscle_group=chest&equipment=dumbbells&difficulty=beginner
```

Difficulty filtering returns exercises whose minimum difficulty is at or below
the requested level. Muscle-group filtering includes primary and secondary
muscle-group matches.

## Tests

```bash
cd backend
.venv/bin/pytest -q
```
