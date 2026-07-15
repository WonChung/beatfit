# BeatFit Backend

BeatFit's FastAPI service turns song metadata into timed workouts. It also owns
Supabase access-token verification, PostgreSQL persistence, deterministic
personalization, Apple Music developer-token signing, and operational checks.

The catalog currently contains 70 exercises: ten primary exercises for each of
the seven supported muscle groups. Generation and personalization are local,
rule-based algorithms; the backend does not call an LLM or another AI service.

For monorepo-wide installation and verification, use the commands in the
[repository README](../README.md). This guide covers the backend by itself.

## Prerequisites

- Python 3.13 or newer (CI uses Python 3.13)
- PostgreSQL 17, either installed locally or through Docker Compose
- A Supabase project using asymmetric JWT signing for authenticated endpoints
- Optional Apple Developer credentials for the Apple Music endpoints

## Quick start

From `backend/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
set -a
source .env
set +a
docker compose up -d postgres
.venv/bin/alembic upgrade head
.venv/bin/fastapi dev app/main.py
```

The API starts at `http://127.0.0.1:8000`. OpenAPI UI is available at
`http://127.0.0.1:8000/docs`, and the schema is available at `/openapi.json`.

The Compose initialization creates both `beatfit` and the isolated
`beatfit_test` database. If the volume already exists, initialization scripts do
not run again; create the missing database manually or perform the destructive
reset described below.

## Configuration

`.env.example` is the checked-in reference. The application reads environment
variables from its process; it does not load `.env` itself, so source the file
before running FastAPI or Alembic.

| Variable | Default or requirement | Purpose |
| --- | --- | --- |
| `APP_ENV` | `development` | `development`, `test`, or `production`. Production enables fail-closed configuration checks. |
| `LOG_LEVEL` | `INFO` | `CRITICAL`, `ERROR`, `WARNING`, `INFO`, or `DEBUG`. |
| `CORS_ALLOWED_ORIGINS` | Local web/Expo origins outside production | Comma-separated origin allowlist. Values are de-duplicated and trailing slashes are removed. |
| `CORS_ALLOW_CREDENTIALS` | `true` | Boolean CORS credential setting. A wildcard origin cannot be combined with credentials. |
| `DATABASE_URL` | Local `beatfit` PostgreSQL URL | SQLAlchemy URL used by the API and Alembic. |
| `TEST_DATABASE_URL` | Unset | Optional isolated PostgreSQL URL used by persistence tests; tests otherwise use in-memory SQLite. |
| `SUPABASE_URL` | Required for auth | Public project URL. |
| `SUPABASE_JWT_ISSUER` | Derived from `SUPABASE_URL` | Expected JWT issuer, normally `<SUPABASE_URL>/auth/v1`. |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` | Expected JWT audience. |
| `SUPABASE_JWKS_URL` | Derived from the issuer | Public JWKS endpoint. |
| `APPLE_MUSIC_TEAM_ID` | Apple feature only | Apple developer Team ID used as the token issuer. |
| `APPLE_MUSIC_KEY_ID` | Apple feature only | Media Services key ID. |
| `APPLE_MUSIC_MEDIA_ID` | Apple feature only | Media ID associated with the signing key. |
| `APPLE_MUSIC_PRIVATE_KEY_PATH` | Apple feature only | Preferred path to a read-only mounted `.p8` secret. |
| `APPLE_MUSIC_PRIVATE_KEY_PEM` | Optional alternative | Multiline key supplied by a secret manager; literal `\n` sequences are converted to newlines. |
| `APPLE_MUSIC_DEVELOPER_TOKEN_TTL_SECONDS` | `3600` | Token lifetime, clamped to 60 through 15,777,000 seconds. |
| `APPLE_MUSIC_API_BASE_URL` | `https://api.music.apple.com` | Apple catalog API base URL. |
| `APPLE_MUSIC_WEB_ORIGINS` | Empty | Comma-separated web origins allowed to receive origin-restricted developer tokens. |

Production startup rejects:

- missing, wildcard, non-HTTPS, or malformed CORS origins;
- a missing, non-PostgreSQL, loopback, or example-credential database URL;
- missing, placeholder, or non-HTTPS Supabase URL and issuer values.

Apple Music settings are loaded only when an Apple endpoint is used. A core API
deployment may leave them unconfigured if the provider feature is disabled in
both clients.

## API conventions

Authenticated routes require:

```text
Authorization: Bearer <supabase-access-token>
```

The verifier accepts RS256 or ES256, validates issuer, audience, expiration,
issued-at time, subject, and the `authenticated` role, then synchronizes a local
`users` record. The token subject is the local user ID. Request bodies never
accept an ownership ID.

Every response includes `X-Request-ID`. A client value is retained only when it
contains 1–128 letters, numbers, dots, underscores, or hyphens; otherwise the
API generates a UUID. Error bodies also contain `request_id`:

```json
{
  "detail": "Workout not found.",
  "request_id": "b4713b9a-5ee8-451c-bc67-79fac5e70e1d"
}
```

Validation errors expose only field locations, safe messages, and error types.
Unhandled failures return a generic `500` response. One-line JSON request logs
contain method, path, status, duration, request ID, and exception type where
applicable; headers, bodies, query strings, credentials, and raw exception
messages are not logged.

Paginated database lists accept `page` (default `1`) and `page_size` (default
`20`, maximum `100`) and return `items`, `page`, `page_size`, and `total`.

## Endpoint reference

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `GET` | `/` | No | Legacy service-identification response. |
| `GET` | `/health` | No | Process liveness; has no external dependency. |
| `GET` | `/ready` | No | Runs `SELECT 1`; returns `503` safely when the database is unavailable. |
| `GET` | `/exercises` | No | Lists the exercise catalog with optional filters. |
| `POST` | `/workouts/generate` | No | Generates a workout without user personalization or persistence. |
| `POST` | `/workouts/generate/personalized` | Yes | Applies preferences/history, persists the generated workout, and returns its ID. |
| `POST` | `/workouts` | Yes | Validates and persists a supplied generated workout; returns `201`. |
| `GET` | `/workouts` | Yes | Lists the caller's persisted workouts. |
| `GET` | `/workouts/{workout_id}` | Yes | Gets one owned workout. |
| `DELETE` | `/workouts/{workout_id}` | Yes | Deletes one owned workout; returns `204`. |
| `POST` | `/workout-sessions` | Yes | Records a completed or ended-early session; returns `201`. |
| `PATCH` | `/workout-sessions/{session_id}` | Yes | Partially updates session progress, status, or feedback. |
| `GET` | `/workout-sessions` | Yes | Lists the caller's sessions. |
| `GET` | `/user-preferences` | Yes | Returns preferences, creating safe defaults if needed. |
| `PUT` | `/user-preferences` | Yes | Partially updates supplied preference fields. Extra fields are rejected. |
| `POST` | `/user-preferences/reset` | Yes | Starts a fresh feedback-history window without deleting preferences or sessions. |
| `GET` | `/music/apple/developer-token` | Yes | Returns a short-lived Apple developer token. |
| `GET` | `/music/apple/catalog/search` | Yes | Proxies and normalizes one page of public Apple song search. |

Expected domain errors use `401`, `404`, `409`, `422`, `502`, or `503` as
appropriate. Cross-user resource access returns the same `404` as a missing
resource.

## Workout generation

`POST /workouts/generate` and the personalized variant accept the same request:

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
      "duration_ms": 225000,
      "artwork_url": "https://example.test/artwork.jpg",
      "provider_identifier": {
        "provider": "spotify",
        "catalog_id": "spotify-track-id"
      }
    }
  ]
}
```

Supported values:

- muscle groups: `chest`, `back`, `legs`, `shoulders`, `arms`, `core`,
  `full_body`;
- difficulty: `beginner`, `intermediate`, `advanced`;
- equipment: `bodyweight`, `dumbbells`, `gym`;
- goal: `strength`, `pump`, `endurance`, `cardio`.

`goal` defaults to `endurance`, and `random_seed` is optional. Supplying a seed
makes exercise selection deterministic for the same request and personalization
inputs. Provider identifiers are discriminated objects: Spotify stores a
catalog ID; Apple Music stores a catalog ID, optional library ID, and
storefront.

Each song becomes one workout block. Durations are rounded to seconds and never
fall below one second. Songs of at most 20 seconds become one work interval.
Longer songs receive a warm-up, alternating work/rest intervals, and a burnout;
the intervals are contiguous and end exactly at the block duration. Selection
honors requested muscle group, allowed difficulty, and at least one matching
equipment value, discourages immediate repetition, varies movement patterns,
and avoids consecutive high-impact exercises when alternatives exist.

The public route returns a neutral `personalization` object and
`workout_id: null`. The authenticated route returns the effective difficulty,
an explanation of every applied rule, and the persisted `workout_id`.

## Exercise catalog

`GET /exercises` accepts `muscle_group`, `equipment`, and `difficulty` query
parameters. Difficulty filtering includes exercises whose minimum difficulty
is at or below the requested level. Muscle-group filtering includes primary and
secondary matches; generation itself uses primary matches only.

Example:

```text
GET /exercises?muscle_group=chest&equipment=dumbbells&difficulty=beginner
```

Catalog IDs are stable API identifiers used by workout intervals and user
preferences. Display names should not be used as database keys.

## Personalization rules

New accounts receive these defaults:

```json
{
  "default_difficulty": "intermediate",
  "available_equipment": ["bodyweight"],
  "preferred_goal": "endurance",
  "avoided_exercise_ids": [],
  "favorite_exercise_ids": [],
  "high_impact_allowed": true,
  "work_rest_preference": "balanced"
}
```

Default difficulty and preferred goal initialize client forms; explicit values
in a generation request remain authoritative. Requested equipment must be a
subset of `available_equipment`, or personalized generation returns `422`.

The service considers at most the three most recent rated sessions after
`history_reset_at` whose snapshots match both the requested muscle group and
goal:

- two `too_easy` ratings with no `too_hard` rating increase difficulty by at
  most one level, add 5 seconds of work, and remove 3 seconds of rest;
- two `too_hard` ratings with no `too_easy` rating decrease difficulty by at
  most one level, remove 5 seconds of work, and add 5 seconds of rest;
- two `about_right` ratings, insufficient history, or conflicting extremes do
  not change feedback-driven structure;
- `more_work` adds 5 work seconds and removes 3 rest seconds;
- `more_rest` removes 5 work seconds and adds 5 rest seconds.

Avoided exercises and high-impact opt-out are hard constraints. Avoided wins
when an ID is also a favorite. Compatible favorites are considered only after
impact, repetition, movement-pattern, and effective-difficulty rules. Preference
updates de-duplicate catalog IDs and reject unknown or empty IDs.

Resetting personalization records the current UTC time. It does not erase
preferences, workouts, sessions, or feedback records; earlier feedback is
simply excluded from future rule evaluation.

## Persistence and data integrity

`POST /workouts` can store an optional display `name` and can create a saved
entry with `saved_name` and `is_favorite`. Saved names are unique per user. The
current clients use personalized generation for server persistence; mobile's
named saved-workout library is a separate local-first store.

Persisted blocks must contain intervals, start at zero, remain contiguous, and
end at the block duration. Session creation derives planned duration, total
intervals, and the immutable workout snapshot on the server. It rejects:

- an end time before the start time;
- completed intervals above the workout total;
- completed work intervals above completed intervals;
- completed song blocks above the block total.

Session status is `completed` or `ended_early`. Optional feedback is
`too_easy`, `about_right`, or `too_hard`, with notes limited to 2,000
characters.

Deleting a workout cascades through its blocks, intervals, and saved entries.
Existing sessions survive: their `workout_id` becomes null and their JSON
snapshot remains available.

The normalized schema is:

```text
users
├── user_preferences (one per user)
├── workouts
│   ├── workout_blocks
│   │   └── workout_intervals
│   └── saved_workouts
└── workout_sessions
    └── session_feedback (zero or one per session)
```

## Apple Music metadata API

Only FastAPI reads the Media Services `.p8` key. The backend signs ES256 tokens
and caches them by requested origin until 30 seconds before expiration.
Browser requests with an `Origin` header receive a token only when that exact
origin appears in `APPLE_MUSIC_WEB_ORIGINS`; the token carries Apple's `origin`
claim. Requests without `Origin`, including native and server catalog use,
receive an unrestricted-by-origin developer token.

`GET /music/apple/catalog/search` accepts:

- `term`: 1–120 characters after API validation;
- `storefront`: two lowercase letters, default `us`;
- `limit`: 1–25, default `25`.

It returns a normalized `Page<AppleMusicTrack>` with `page: 1`; malformed
resources are skipped, missing titles/artists receive safe fallbacks, missing
or non-positive durations become null, and artwork placeholders are expanded
to 600×600. `total` is the number of normalized tracks in that response, not an
upstream catalog total. This endpoint does not expose Apple pagination and is
not currently used by the mobile or web playlist browsers. Those clients browse
personalized libraries through their platform MusicKit adapters.

The service does not store Music User Tokens. Apple Music playback, Android's
native bridge, client-side catalog search UI, and Apple library pagination UI
remain outside the implemented backend surface. See the
[Apple Music architecture](../docs/apple-music-plan.md) and
[build guide](../docs/apple-music-build-setup.md).

## Source layout

| Path | Responsibility |
| --- | --- |
| `app/main.py` | Application factory, middleware, and router registration. |
| `app/config.py` | Runtime settings and production validation. |
| `app/domain.py` | Shared enums and the exercise domain record. |
| `app/api_models.py` | Pydantic request and response schemas. |
| `app/exercise_catalog.py` | Seeded catalog and public filtering. |
| `app/generator_service.py` | Deterministic interval and exercise selection. |
| `app/personalization_service.py` | Preference constraints and recent-feedback rules. |
| `app/routes.py` | Public catalog and generation routes plus legacy root response. |
| `app/personalization_routes.py` | Preference and personalized-generation routes. |
| `app/database.py` | SQLAlchemy engine, sessions, and declarative base. |
| `app/db_models.py` | ORM persistence models and relationships. |
| `app/persistence_service.py` | Ownership, validation, transactions, and serialization. |
| `app/persistence_routes.py` | Workout and session persistence routes. |
| `app/auth.py` | Supabase JWT verification and local user synchronization. |
| `app/apple_music.py` | Apple configuration, token signing, and catalog HTTP client. |
| `app/apple_music_routes.py` | Authenticated Apple endpoints and response normalization. |
| `app/observability.py` | JSON logging, request IDs, and safe exception handlers. |
| `app/operational_routes.py` | Liveness and database readiness. |
| `migrations/` | Alembic environment and versioned schema changes. |
| `app/models.py`, `app/workout_generator.py` | Compatibility exports for older imports. |

## Tests and static checks

From `backend/`:

```bash
APP_ENV=test .venv/bin/pytest -q
.venv/bin/ruff check app tests migrations
.venv/bin/ruff format --check app tests migrations
```

The default test suite uses in-memory SQLite for persistence fixtures and test
token verifiers/mocked provider boundaries. To run the persistence fixture
against PostgreSQL, export an isolated `TEST_DATABASE_URL` first:

```bash
set -a
source .env
set +a
APP_ENV=test .venv/bin/pytest -q
```

Tests create and clear their own tables. Never point `TEST_DATABASE_URL` at a
development or production database.

From the repository root, `make lint`, `make test`, and `make check` include the
backend in the monorepo checks.

## Migrations, rollback, and reset

Apply and inspect migrations:

```bash
.venv/bin/alembic upgrade head
.venv/bin/alembic current
.venv/bin/alembic check
```

After changing ORM models, create a revision and inspect it before applying:

```bash
.venv/bin/alembic revision --autogenerate -m "describe change"
.venv/bin/alembic upgrade head
```

Roll back one revision with `.venv/bin/alembic downgrade -1`, or all revisions
with `.venv/bin/alembic downgrade base`. Downgrades can destroy data; back up a
non-disposable database first.

To completely reset the local Compose database and both databases created by
its initialization script:

```bash
docker compose down -v
docker compose up -d postgres
.venv/bin/alembic upgrade head
```

This removes the Compose volume and all local data in it.
