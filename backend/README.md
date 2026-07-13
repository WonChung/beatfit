# BeatFit Backend

The BeatFit API uses FastAPI and generates timed workouts from a structured,
filterable exercise catalog.

For a repository-wide setup, use `make setup`, `make run-backend`, and the
other verified root commands documented in the [main README](../README.md).
The commands below are the backend-only equivalents.

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
pip install -r requirements-dev.txt
set -a
source .env
set +a
.venv/bin/alembic upgrade head
fastapi dev app/main.py
```

Interactive documentation is available at `http://127.0.0.1:8000/docs`.

## Runtime hardening

`APP_ENV` accepts `development`, `test`, or `production`. Local development
uses the documented loopback CORS origins when `CORS_ALLOWED_ORIGINS` is not
set. Set the variable to a comma-separated origin allowlist to override it.

Production startup fails before serving traffic unless it has:

- explicit HTTPS `CORS_ALLOWED_ORIGINS` with no wildcard;
- a non-loopback PostgreSQL `DATABASE_URL` without the example credentials;
- valid HTTPS `SUPABASE_URL` and `SUPABASE_JWT_ISSUER` values.

Application request logs are one-line JSON and contain request metadata only;
headers, request bodies, query strings, credentials, and exception messages are
not logged. Clients may provide a valid `X-Request-ID`, and every response
returns the request ID in that header. Error responses include the same ID but
never include stack traces or raw internal exception messages.

- `GET /health` is the process liveness check and has no external dependency.
- `GET /ready` executes a minimal database query and returns `503` safely when
  PostgreSQL is unavailable.

## Architecture

- `app/domain.py`: exercise and workout domain enums/models.
- `app/api_models.py`: Pydantic request and response schemas.
- `app/exercise_catalog.py`: seeded exercise data and catalog filtering.
- `app/generator_service.py`: playlist-aware workout generation.
- `app/personalization_service.py`: deterministic preference and recent-feedback rules.
- `app/personalization_routes.py`: authenticated preference and personalized-generation API.
- `app/routes.py`: FastAPI route handlers.
- `app/database.py`: SQLAlchemy engine, sessions, and declarative base.
- `app/db_models.py`: normalized persistence models.
- `app/persistence_service.py`: ownership, transactions, validation, and
  database-error translation.
- `app/persistence_routes.py`: persisted workout and session endpoints.
- `app/auth.py`: Supabase JWT verification and local user-profile synchronization.
- `app/apple_music.py`: backend-only Apple developer-token signing and public catalog access.
- `app/apple_music_routes.py`: authenticated Apple developer-token and catalog endpoints.
- `app/config.py`: runtime environment loading and production validation.
- `app/observability.py`: structured logging, request IDs, and safe exception handling.
- `app/operational_routes.py`: liveness and database-readiness endpoints.
- `migrations/`: Alembic environment and versioned schema changes.
- `app/models.py` and `app/workout_generator.py`: compatibility exports for
  older imports.

Persistence requests require a Supabase bearer access token. Ownership always
comes from the verified token subject; request bodies never accept a user ID.
The first authenticated request creates or updates the matching local `users`
record.

## Supabase authentication

Configure Supabase Auth to use an asymmetric JWT signing key (RS256 or ES256),
then set `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, and
`SUPABASE_JWT_AUDIENCE=authenticated`. `SUPABASE_JWKS_URL` is optional and is
normally derived from the issuer.

The backend downloads only public verification keys from the project's JWKS
endpoint. It does not need the legacy JWT secret or a service-role key. All
persistence calls require:

```text
Authorization: Bearer <supabase-access-token>
```

## Apple Music metadata API

The implemented Phase A/B Apple Music backend surface is authenticated:

- `GET /music/apple/developer-token`: returns a short-lived developer token;
  browser requests receive an origin-restricted token when their `Origin` is
  included in `APPLE_MUSIC_WEB_ORIGINS`.
- `GET /music/apple/catalog/search?term=...&storefront=us`: proxies public song
  search and normalizes title, artist, duration, artwork, and provider IDs.

Only FastAPI reads the Media Services `.p8` signing key. Mobile and web clients
receive a signed developer token but never receive signing credentials or a
server-stored Music User Token. Migration `20260713_0002` preserves optional
artwork and provider identifiers in workout snapshots.

See the [Apple Music architecture](../docs/apple-music-plan.md) for trust
boundaries and remaining playback work, and the
[Phase A/B build guide](../docs/apple-music-build-setup.md) for Apple Developer,
native-build, and environment configuration.

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
It also includes a neutral `personalization` explanation. The public endpoint
remains unpersonalized and backward compatible.

## Rule-based personalization

Authenticated clients manage preferences with:

- `GET /user-preferences`: read preferences, creating safe defaults when needed.
- `PUT /user-preferences`: partially update supplied preference fields.
- `POST /user-preferences/reset`: ignore feedback history recorded before the
  reset time without deleting saved preferences or sessions.
- `POST /workouts/generate/personalized`: generate with preferences and recent
  matching feedback, persist the result for the authenticated user, and return
  its `workout_id`.

Preferences include default difficulty, available equipment, preferred goal,
avoided and favorite exercise catalog IDs, whether high-impact movements are
allowed, and a `balanced`, `more_work`, or `more_rest` timing preference. The
default difficulty and goal are UI defaults; the explicit difficulty, muscle
group, and goal in a generation request remain authoritative.

Personalization examines at most the three most recent rated sessions after
the last reset whose workout snapshot matches both the requested muscle group
and goal. A timing/difficulty feedback change requires at least two
`too_easy` or two `too_hard` ratings and no rating of the opposite extreme in
that window:

- Two `too_easy` ratings raise difficulty by at most one level, add 5 seconds
  of work, and remove 3 seconds of rest.
- Two `too_hard` ratings lower difficulty by at most one level, remove 5
  seconds of work, and add 5 seconds of rest.
- `about_right`, insufficient history, and conflicting extremes do not change
  the feedback-driven structure.
- `more_work` and `more_rest` add the same modest timing bias independently of
  feedback.

All rules are deterministic when `random_seed` is supplied. Requested
equipment must be present in the user's available-equipment preference or the
request returns `422`. Avoided exercises, high-impact opt-out, request
equipment, selected muscle group, and selected goal are hard constraints.
Avoiding an exercise wins if the same ID is also a favorite. Compatible
favorites are preferred only after repetition and movement-pattern rules.

Every generated workout returns a structured `personalization` object with a
plain-language `summary`, the feedback signal, number of matching sessions
considered, and a list of exact adjustments. No LLM or external AI service is
used. Public generation returns `workout_id: null`; authenticated personalized
generation returns an owned ID that is immediately available through
`GET /workouts/{id}`.

## Persistence API

- `POST /workouts`: persist a generated workout, optionally with a saved name.
- `GET /workouts?page=1&page_size=20`: list the authenticated user's workouts.
- `GET /workouts/{id}`: get one workout.
- `DELETE /workouts/{id}`: delete one workout.
- `POST /workout-sessions`: persist a completed or ended-early session.
- `PATCH /workout-sessions/{id}`: update session progress, status, or feedback.
- `GET /workout-sessions?page=1&page_size=20`: list sessions.

List responses contain `items`, `page`, `page_size`, and `total`. Page size is
limited to 100. Workout deletion cascades through blocks, intervals, and saved
workout metadata. Sessions retain a JSON workout snapshot and survive deletion
of the source workout.

Migration `20260713_0003` adds the one-to-one `user_preferences` table. Apply
it with the normal `alembic upgrade head` command above.

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

From the repository root, `make lint` and `make test` run the backend checks as
part of the full project suites. To run only the backend checks:

```bash
cd backend
set -a
source .env
set +a
TEST_DATABASE_URL="$TEST_DATABASE_URL" .venv/bin/pytest -q
```

Lint and format validation use Ruff from `requirements-dev.txt`:

```bash
cd backend
.venv/bin/ruff check app tests migrations
.venv/bin/ruff format --check app tests migrations
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
