# BeatFit

BeatFit turns songs and playlists into timed workouts. The repository contains
an Expo mobile application, a Next.js web application, and a FastAPI API backed
by PostgreSQL.

## Repository layout

```text
apps/mobile/  Expo Router mobile application
apps/web/     Next.js App Router web application
backend/      FastAPI API, SQLAlchemy models, and Alembic migrations
docs/         Product and provider-integration documentation
```

## Current product surface

- Mobile: authenticated workout setup, personalized generation, preview,
  interval timer, completion summaries, saved workouts, history, preferences,
  session feedback, provider metadata selection, and bundled exercise
  silhouettes with an offline fallback.
- Web: authenticated dashboard, workout setup and generation, preview, timer,
  completion feedback, preferences, and Apple Music or Spotify metadata
  selection when enabled.
- Backend: structured exercise catalog, deterministic rule-based generation and
  personalization, Supabase JWT verification, PostgreSQL persistence, Apple
  developer-token support, structured logging, and health/readiness endpoints.

Music-provider playback is not implemented. Apple Music and Spotify are
metadata and track-selection integrations only.

## Prerequisites

- Node.js 22 and npm
- Python 3.13 or newer
- GNU Make (the macOS/Xcode and Linux versions are sufficient)
- PostgreSQL 17, or Docker with Compose for the included local database

CI uses Node.js 22 and Python 3.13. Keeping local versions aligned avoids
platform-only failures.

## First-time setup

Create local environment files from the tracked, non-secret examples:

```bash
cp backend/.env.example backend/.env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/web/.env.example apps/web/.env.local
```

Review every value before running the applications. Never put production
credentials in these files or commit them.

Install the Python and npm dependencies from the repository root:

```bash
make setup
```

This creates `backend/.venv`, installs the backend runtime and development
requirements, and runs `npm ci` for both applications.

### Local PostgreSQL

Start the repository's PostgreSQL-only Compose service and apply migrations:

```bash
cd backend
docker compose up -d postgres
set -a
source .env
set +a
.venv/bin/alembic upgrade head
cd ..
```

The Compose initialization creates separate `beatfit` and `beatfit_test`
databases. An existing PostgreSQL installation can be used instead by updating
`DATABASE_URL` and `TEST_DATABASE_URL`. Never point `TEST_DATABASE_URL` at a
development or production database.

## Environment configuration

The `.env.example` files are the source of truth for supported variables.
Important values include:

| Location | Variables | Notes |
|---|---|---|
| Backend | `APP_ENV`, `LOG_LEVEL`, `CORS_ALLOWED_ORIGINS`, `CORS_ALLOW_CREDENTIALS` | Production mode validates configuration at startup. Origins are a comma-separated allowlist; do not use `*` in production. |
| Backend | `DATABASE_URL`, `TEST_DATABASE_URL` | SQLAlchemy PostgreSQL URLs. The test URL must use an isolated database. |
| Backend | `SUPABASE_URL`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWT_AUDIENCE`, `SUPABASE_JWKS_URL` | Public JWT-verification configuration; no Supabase service-role key is required. |
| Backend | `APPLE_MUSIC_*` | Developer-token signing configuration. Apple private keys are backend-only and must stay outside Git. |
| Mobile | `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_*`, provider client IDs and feature flags | All `EXPO_PUBLIC_` values are embedded in the client and must be non-secret. A physical device must use the development Mac's LAN IP instead of `127.0.0.1`. |
| Web | `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SUPABASE_*`, provider client IDs and feature flags | All `NEXT_PUBLIC_` values are browser-visible and must be non-secret. |

Spotify uses Authorization Code with PKCE, so its client secret is not present in
mobile or web configuration. Supabase service-role keys, Apple `.p8` contents,
database passwords, access/refresh tokens, and provider tokens must never be
placed in public variables.

For a production backend, set `APP_ENV=production`, use an explicit production
database URL and HTTPS CORS origins, and provide valid Supabase verification
settings. Startup fails closed when required production configuration is unsafe
or incomplete.

## Run the applications

Export the backend environment once in the shell that starts the API:

```bash
set -a
source backend/.env
set +a
```

Then use the root developer commands in separate terminals:

```bash
make run-backend  # FastAPI at http://127.0.0.1:8000
make run-mobile   # Expo development server
make run-web      # Next.js at http://localhost:3000
```

FastAPI's interactive API documentation is available at
`http://127.0.0.1:8000/docs`. `GET /health` is the process liveness check and
`GET /ready` verifies that required dependencies, including the database, are
available.

The Expo terminal offers simulator and device launch options. When testing on a
physical phone, update `EXPO_PUBLIC_API_BASE_URL` to a reachable LAN URL such as
`http://192.168.1.25:8000` and ensure the backend accepts connections from the
device.

## Developer checks

Run individual check groups from the repository root:

```bash
make lint       # Ruff lint/format validation plus mobile and web ESLint
make typecheck  # Mobile and web TypeScript checks
make test       # Backend pytest, mobile Jest, and web Vitest
make build-web  # Next.js production build
```

Run the complete local CI-equivalent suite with:

```bash
make check
```

Backend persistence tests use an in-memory SQLite fallback when
`TEST_DATABASE_URL` is not set. To exercise PostgreSQL explicitly, export the
isolated test URL from `backend/.env` before `make test`.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and every push to `main`.
It uses lockfile-aware pip/npm caches and executes independent backend, mobile,
and web jobs:

- Backend: Ruff lint, Ruff format validation, and the full pytest suite.
- Mobile: dependency install, ESLint, TypeScript, and Jest.
- Web: dependency install, ESLint, TypeScript, Vitest, and a production build.

CI has read-only repository permission and receives no application credentials.
`.github/workflows/dependency-review.yml` rejects pull requests that introduce
known dependencies with moderate-or-higher vulnerabilities. Dependabot checks
Python, both npm applications, and GitHub Actions weekly. Repository maintainers
should also enable dependency alerts, secret scanning, push protection, private
vulnerability reporting, and required branch checks as described in
[the security policy](.github/SECURITY.md).

## API and data model

The public generator is `POST /workouts/generate`. Authenticated endpoints
persist generated workouts, sessions, preferences, and feedback; ownership is
derived from the verified Supabase JWT and never from a client-supplied user ID.
The exercise catalog and deterministic rule-based personalization live in the
backend. Apple Music and Spotify currently provide metadata and track selection
only; playback is outside the current scope.

Detailed backend setup, migrations, rollback/reset instructions, endpoint
examples, authentication behavior, and personalization rules are documented in
[backend/README.md](backend/README.md).

Mobile exercise artwork is bundled locally. Display-name aliases resolve to a
small typed posture-asset registry, and unsupported names use a generic
placeholder without making a network request. See the
[exercise visual asset guide](apps/mobile/assets/exercises/README.md) for the
replacement workflow and current limitations.

## Documentation

- [Documentation index](docs/README.md)
- [Mobile application](apps/mobile/README.md)
- [Exercise visual assets](apps/mobile/assets/exercises/README.md)
- [Web application](apps/web/README.md)
- [Backend API and database](backend/README.md)
- [Apple Music architecture](docs/apple-music-plan.md)
- [Apple Music build configuration](docs/apple-music-build-setup.md)
- [Spotify metadata integration](docs/spotify-integration.md)
- [Security policy](.github/SECURITY.md)

## Security notes

- Commit only `.env.example` files containing placeholders.
- Do not log authorization headers, request bodies, provider tokens, connection
  strings, signing credentials, or exception stack traces in API responses.
- Rotate a credential immediately if it may have entered a commit; deleting it
  in a later commit is not sufficient.
- Keep `main` protected and require CI and dependency review before merging.
- Report suspected vulnerabilities privately through GitHub's Security tab.

This repository does not contain deployment automation. Production hosting,
managed database provisioning, monitoring/alerting, backups, TLS, domain setup,
and release procedures remain deployment work.
