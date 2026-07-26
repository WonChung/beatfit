# BeatFit documentation

This directory indexes cross-platform architecture, provider, and build
guidance. Component-specific setup stays beside the code it describes.
Checked-in READMEs describe repository behavior, not a hosted deployment;
provider plans label target and backlog work separately.

## Application guides

- [Repository setup and CI](../README.md)
- [Expo mobile application](../apps/mobile/README.md)
- [Mobile exercise visual assets](../apps/mobile/assets/exercises/README.md)
- [Mobile exercise animation assets](../apps/mobile/assets/exercise-animations/README.md)
- [Next.js web application](../apps/web/README.md)
- [Web exercise animation assets](../apps/web/public/exercise-animations/README.md)
- [FastAPI backend, database, and API](../backend/README.md)
- [Security policy](../.github/SECURITY.md)

## Music-provider guides

- [Apple Music architecture and phased design](apple-music-plan.md)
- [Apple Music Phase A/B manual configuration](apple-music-build-setup.md)
- [Spotify metadata integration](spotify-integration.md)

Apple Music support is metadata-only: FastAPI issues developer tokens and
provides authenticated catalog search, the web app browses library metadata
through MusicKit JS, and the mobile native module browses library metadata on
iOS. That native module is registered for iOS only; an Android bridge and client
UI for backend catalog search remain backlog work.

Spotify authorization and playlist metadata access run entirely in the web and
mobile clients using Authorization Code with PKCE. BeatFit does not exchange or
store Spotify tokens in FastAPI. Both clients support paginated playlist and
track metadata, including artwork and duration where Spotify returns them.

Neither provider integration plays music. In-app or synchronized playback,
audio analysis, BPM and beat detection, and playback-state synchronization are
outside the implemented scope.

## Verified system boundaries

- Workout generation is rules-based, not AI. It creates contiguous interval
  timelines that end exactly at each song block's computed duration; supplying
  the same `random_seed` for the same inputs and personalization state makes
  exercise selection reproducible.
- The web app uses cookie-backed Supabase sessions. FastAPI independently
  verifies bearer JWTs against Supabase JWKS and derives record ownership from
  the verified `sub` claim.
- GitHub Actions runs backend checks against an isolated PostgreSQL test
  database after applying and checking Alembic migrations. Separate mobile and
  web jobs run dependency audits, linting, type checks, tests, and their 
- platform-specific build/export checks. Pull-request dependency review runs on
  public repository pull requests and rejects dependency changes that introduce
  known moderate-or-higher vulnerabilities.

## Where behavior lives

| Concern | Source of truth | Documentation |
| --- | --- | --- |
| Setup, versions, and CI | `Makefile`, package manifests, GitHub workflows | [Repository README](../README.md) |
| API, schemas, persistence, and personalization | `backend/app`, migrations, backend tests | [Backend README](../backend/README.md) |
| Mobile routes, state, storage, and native adapters | `apps/mobile/src`, `apps/mobile/modules` | [Mobile README](../apps/mobile/README.md) |
| Web routes, browser adapters, and timer | `apps/web/src` | [Web README](../apps/web/README.md) |
| Provider dashboard/platform setup | Provider docs and current adapters | Apple/Spotify guides below |

## Documentation maintenance

When behavior changes:

1. Update the README closest to the changed code.
2. Update the root README when setup, commands, environment variables, or the
   cross-platform product surface changes.
3. Update provider documents when dashboard configuration, scopes, redirect
   URIs, token handling, or platform limitations change.
4. Keep real credentials, access tokens, signing keys, database URLs, and user
   data out of examples and screenshots.
5. Verify every documented command against the corresponding package script,
   Make target, or backend tool before merging.
6. Separate implemented behavior from architecture targets, and date provider
   policy reviews because external requirements can change independently of the
   repository.
