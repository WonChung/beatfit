# BeatFit documentation

This directory contains cross-platform provider architecture and build
guidance. Setup and component-specific documentation stays beside the code it
describes. The checked-in READMEs describe the current implementation; provider
plans clearly label target or backlog behavior.

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

Spotify provides authorization, paginated playlist metadata, artwork, duration,
and track selection on mobile and web. Apple Music provides the same baseline on
web and iOS development builds, but its current UIs load only the first page.
The Apple Music Android native bridge and client UI for backend public catalog
search remain backlog work. Playback, beat analysis, BPM detection, and
playback-state synchronization are outside the implemented scope.

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
