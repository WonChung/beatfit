# BeatFit Backend

The BeatFit API uses FastAPI and generates timed workouts from a structured,
filterable exercise catalog.

## Local database

Copy the example environment file and keep real credentials out of source
control:

```bash
cd backend
cp .env.example .env
set -a
source .env
set +a
```

Start the PostgreSQL-only Compose service:

```bash
docker compose up -d postgres
docker compose ps
```

The Compose initialization script creates both `beatfit` and the isolated
`beatfit_test` database. Existing local PostgreSQL installations can be used
instead; create both databases and make their URLs match `.env`.

Apply migrations before starting the API:

```bash
.venv/bin/alembic upgrade head
.venv/bin/alembic current
```

## Run locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
set -a
source .env
set +a
.venv/bin/alembic upgrade head
fastapi dev app/main.py
```

Interactive documentation is available at `http://127.0.0.1:8000/docs`.

## Architecture

- `app/domain.py`: exercise and workout domain enums/models.
- `app/api_models.py`: Pydantic request and response schemas.
- `app/exercise_catalog.py`: seeded exercise data and catalog filtering.
- `app/generator_service.py`: playlist-aware workout generation.
- `app/routes.py`: FastAPI route handlers.
- `app/database.py`: SQLAlchemy engine, sessions, and declarative base.
- `app/db_models.py`: normalized persistence models.
- `app/persistence_service.py`: ownership, transactions, validation, and
  database-error translation.
- `app/persistence_routes.py`: persisted workout and session endpoints.
- `app/development_user.py`: isolated temporary server-owned user identity.
- `migrations/`: Alembic environment and versioned schema changes.
- `app/models.py` and `app/workout_generator.py`: compatibility exports for
  older imports.

The temporary development user has a fixed server-owned UUID. Persistence
requests never accept an ownership ID from the client. Replace this module with
authenticated identity resolution when authentication is introduced.

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

## Persistence API

- `POST /workouts`: persist a generated workout, optionally with a saved name.
- `GET /workouts?page=1&page_size=20`: list the development user's workouts.
- `GET /workouts/{id}`: get one workout.
- `DELETE /workouts/{id}`: delete one workout.
- `POST /workout-sessions`: persist a completed or ended-early session.
- `PATCH /workout-sessions/{id}`: update session progress, status, or feedback.
- `GET /workout-sessions?page=1&page_size=20`: list sessions.

List responses contain `items`, `page`, `page_size`, and `total`. Page size is
limited to 100. Workout deletion cascades through blocks, intervals, and saved
workout metadata. Sessions retain a JSON workout snapshot and survive deletion
of the source workout.

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
set -a
source .env
set +a
TEST_DATABASE_URL="$TEST_DATABASE_URL" .venv/bin/pytest -q
```

Persistence tests use the separate `TEST_DATABASE_URL` and clear only tables in
that database between tests. If it is omitted, those tests use an in-memory
SQLite fallback for fast, isolated runs. Never point `TEST_DATABASE_URL` at the
development or production database.

## Migrations, rollback, and reset

Create future migrations after changing ORM models, then inspect the generated
revision before applying it:

```bash
.venv/bin/alembic revision --autogenerate -m "describe change"
.venv/bin/alembic upgrade head
```

Roll back one revision with `.venv/bin/alembic downgrade -1`, or roll back all
schema revisions with `.venv/bin/alembic downgrade base`. Downgrades can destroy
data and should be backed up first.

For a complete local Compose reset (destructive), remove the database volume,
restart PostgreSQL, and reapply the migration:

```bash
docker compose down -v
docker compose up -d postgres
.venv/bin/alembic upgrade head
```
